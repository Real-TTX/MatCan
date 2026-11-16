using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using MatCan.Catalogs.Providers;
using MatCan.Configuration;
using MatCan.Data.Entities;
using MatCan.Logic;
using Microsoft.EntityFrameworkCore;

namespace MatCan.Catalogs;

/// <summary>
/// THE list of catalogues (docs/PLAN-CATALOGS.md section 1): a new source is one class that implements <see cref="ICatalog"/> and one line here. The pages, the media browser, the admin page, the
/// thumbnail proxy, the import and the credits are generic and know no catalogue by name.
/// </summary>
public sealed class CatalogRegistry
{
    private readonly IReadOnlyList<ICatalog> _all;

    public CatalogRegistry(ConfigStore config)
    {
        ICatalog[] known =
        [
            new BuiltinCatalog(),
            new UploadsCatalog(),
            new FolderCatalog(),
            new PexelsCatalog(),
            new PixabayCatalog(),
            new OpenverseCatalog(),
            new UnsplashCatalog(),
            new IconifyCatalog(),
            new GoogleFontsCatalog(),
            new ExampleCatalog("example-browse", "Beispiel-Katalog", browsable: true),
            new ExampleCatalog("example-search", "Beispiel-Suche", browsable: false),
        ];
        _all = [.. known.Where(c => c.IsAvailable(config))];
    }

    /// <summary>Every catalogue of this installation in the order of the list above (the administrator's order is applied by <see cref="Logic.CatalogLogic"/>).</summary>
    public IReadOnlyList<ICatalog> All => _all;

    public ICatalog? Find(string? id) => _all.FirstOrDefault(c => string.Equals(c.Id, id, StringComparison.Ordinal));
}

/// <summary>What the catalogues share and the logic needs in one place: the registry, the guarded HTTP client, the proxy, the brakes and the keys. A singleton.</summary>
public sealed partial class CatalogServices(CatalogRegistry registry, CatalogHttp http, CatalogProxy proxy, CatalogLimiter limiter, CatalogSecretStore secrets, CatalogThumbCache thumbs, ConfigStore config, IServiceProvider services)
{
    public CatalogRegistry Registry { get; } = registry;

    public CatalogHttp Http { get; } = http;

    public CatalogProxy Proxy { get; } = proxy;

    public CatalogLimiter Limiter { get; } = limiter;

    public CatalogSecretStore Secrets { get; } = secrets;

    public CatalogThumbCache Thumbs { get; } = thumbs;

    public ConfigStore Config { get; } = config;

    private CatalogTestSeam? Seam => services.GetService<CatalogTestSeam>();

    /// <summary>The address of the provider's API: the test seam, else the operator's (configuration file, environment), else the catalogue's own. Never from a page.</summary>
    public string? BaseUrl(ICatalog catalog) => OperatorBaseUrl(catalog) ?? catalog.DefaultBaseUrl;

    /// <summary>The address the operator named for the catalogue (the test seam, the configuration file, the environment); null when the catalogue uses its own.</summary>
    public string? OperatorBaseUrl(ICatalog catalog)
    {
        if (Seam is { } seam && seam.BaseUrls.TryGetValue(catalog.Id, out var forTest) && !string.IsNullOrWhiteSpace(forTest))
        {
            return forTest.TrimEnd('/');
        }

        return Config.Current.Catalogs.TryGetValue(catalog.Id, out var configured) && !string.IsNullOrWhiteSpace(configured.BaseUrl) ? configured.BaseUrl.TrimEnd('/') : null;
    }

    /// <summary>
    /// The hosts the browser may load pictures of this catalogue from (only for a catalogue with <see cref="ICatalog.HotlinkHosts"/>): its own image hosts and the host of the operator's address, so a
    /// test installation can serve them from a fake provider. Empty for every other catalogue.
    /// </summary>
    public IReadOnlyCollection<string> HotlinkHosts(ICatalog catalog)
    {
        var hosts = new List<string>(catalog.HotlinkHosts);
        if (hosts.Count > 0 && OperatorBaseUrl(catalog) is { } baseUrl && Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri))
        {
            hosts.Add(uri.Host);
        }

        return hosts;
    }

    /// <summary>
    /// The origins the content security policy adds to <c>img-src</c> for the signed-in pages that show the media browser: the image hosts of every catalogue that asks for hotlinking, while that catalogue
    /// is switched on and has its key (the same rule as <see cref="Logic.CatalogLogic.ListAsync"/>), else nothing. With every such catalogue off the list is empty and the policy is unchanged.
    /// </summary>
    public IReadOnlyList<string> HotlinkOrigins()
    {
        var settings = services.GetRequiredService<SettingStore>().Get<CatalogsSettings>(SettingStore.Catalogs);
        var origins = new List<string>();
        foreach (var catalog in Registry.All)
        {
            if (catalog.HotlinkHosts.Count == 0)
            {
                continue;
            }

            settings.Items.TryGetValue(catalog.Id, out var setting);
            if (!(setting?.Enabled ?? catalog.EnabledByDefault) || (catalog.Caps.HasFlag(CatalogCaps.NeedsKey) && !Secrets.Has(catalog.Id)))
            {
                continue;
            }

            origins.AddRange(catalog.HotlinkHosts.Select(h => "https://" + h));
            if (OperatorBaseUrl(catalog) is { } baseUrl && Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri))
            {
                origins.Add(uri.GetLeftPart(UriPartial.Authority));
            }
        }

        // only plain origins ever reach a header: scheme, host, an optional port
        return [.. origins.Where(o => OriginPattern().IsMatch(o)).Distinct(StringComparer.Ordinal)];
    }

    [GeneratedRegex(@"^https?://[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?(:[0-9]{1,5})?$")]
    private static partial Regex OriginPattern();

    /// <summary>The hosts a catalogue may reach: its own and the host of the address the operator named.</summary>
    public IReadOnlyCollection<string> AllowedHosts(ICatalog catalog)
    {
        var hosts = new List<string>(catalog.AllowedHosts);
        if (BaseUrl(catalog) is { } baseUrl && Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri))
        {
            hosts.Add(uri.Host);
        }

        return hosts;
    }

    /// <summary>Plain http is only for an address the operator typed by hand (the fake providers of the checks).</summary>
    public bool AllowsHttp(ICatalog catalog) => BaseUrl(catalog) is { } baseUrl && baseUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase);

    /// <summary>The answer of a provider as text, from the cache while it is a day old at most (or the time the catalogue asks for), else asked.</summary>
    public async Task<string> GetTextAsync(CatalogContext ctx, Uri url, IReadOnlyDictionary<string, string>? headers, TimeSpan ttl, CancellationToken ct)
    {
        var db = ctx.Biz.Db;
        var hash = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(ctx.Catalog.Id + "\n" + url.AbsoluteUri)));
        var now = ctx.Biz.Now;
        var cached = await db.CatalogCacheEntry.AsNoTracking().Where(e => e.Catalog == ctx.Catalog.Id && e.KeyHash == hash && e.ExpiresDate > now).Select(e => e.ResponseJson).FirstOrDefaultAsync(ct);
        if (cached is not null)
        {
            return cached;
        }

        // only a request to the provider costs: the brake of the person (so one person cannot use up the key) and the hourly budget of the key
        Limiter.CheckBlock(ctx.Catalog);
        Limiter.TakePerson(ctx.Biz.UserId, ctx.Catalog, EffectivePerMinute(ctx.Catalog, ctx.Settings));
        Limiter.TakeBudget(ctx.Catalog, EffectivePerHour(ctx.Catalog, ctx.Settings), ctx.Catalog.Info.KeyPerMinute);
        var result = await RequestAsync(ctx.Catalog, () => Http.GetAsync(url, AllowedHosts(ctx.Catalog), AllowsHttp(ctx.Catalog), ctx.Catalog.Name, headers, CatalogHttp.SearchTimeout, CatalogHttp.MaxJsonBytes, ct, ctx.Catalog.AllowedHosts));
        var text = Encoding.UTF8.GetString(result.Bytes);
        try
        {
            using var _ = JsonDocument.Parse(text);
        }
        catch (JsonException)
        {
            throw new CatalogException($"{ctx.Catalog.Name} hat etwas geantwortet, das MatCan nicht versteht.", CatalogFailure.Unavailable);
        }

        try
        {
            await db.CatalogCacheEntry.Where(e => e.Catalog == ctx.Catalog.Id && e.KeyHash == hash).ExecuteDeleteAsync(ct);
            db.CatalogCacheEntry.Add(new CatalogCacheEntry { Catalog = ctx.Catalog.Id, KeyHash = hash, ResponseJson = text, ExpiresDate = now + ttl });
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // two people asked the same thing at the same moment: the other one cached it
            foreach (var entry in db.ChangeTracker.Entries<CatalogCacheEntry>().Where(e => e.State == EntityState.Added).ToList())
            {
                entry.State = EntityState.Detached;
            }
        }

        return text;
    }

    /// <summary>An event request (Unsplash's download ping): counts for the budget of the key, not cached, a short answer, the same door as everything else.</summary>
    public Task<CatalogHttpResult> GetEventAsync(CatalogContext ctx, Uri url, IReadOnlyDictionary<string, string>? headers, CancellationToken ct)
    {
        Limiter.CheckBlock(ctx.Catalog);
        Limiter.TakeBudget(ctx.Catalog, EffectivePerHour(ctx.Catalog, ctx.Settings), ctx.Catalog.Info.KeyPerMinute);
        return RequestAsync(ctx.Catalog, () => Http.GetAsync(url, AllowedHosts(ctx.Catalog), AllowsHttp(ctx.Catalog), ctx.Catalog.Name, headers, CatalogHttp.SearchTimeout, 16 * 1024, ct, ctx.Catalog.AllowedHosts));
    }

    /// <summary>
    /// The bytes of a file. A file at the image host of a catalogue that is shown from the provider's own addresses (Unsplash: "Image file requests do not count against your rate limit") is no API request:
    /// a pause the API asked for (a limit at the download message, say) does not hold it back, and it reports no limits.
    /// </summary>
    public Task<CatalogHttpResult> DownloadAsync(CatalogContext ctx, Uri url, IReadOnlyDictionary<string, string>? headers, long maxBytes, CancellationToken ct)
        => RequestAsync(ctx.Catalog, () => Http.GetAsync(url, AllowedHosts(ctx.Catalog), AllowsHttp(ctx.Catalog), ctx.Catalog.Name, headers, CatalogHttp.DownloadTimeout, Math.Min(maxBytes, CatalogHttp.MaxDownloadBytes), ct, ctx.Catalog.AllowedHosts),
            api: !HotlinkHosts(ctx.Catalog).Contains(url.Host, StringComparer.OrdinalIgnoreCase));

    /// <summary>A thumbnail for the proxy: the same door as every other request (a provider that said "not now" is left alone), with the size limit of a thumbnail.</summary>
    public Task<CatalogHttpResult> GetThumbAsync(ICatalog catalog, Uri url, IReadOnlyDictionary<string, string>? headers, CancellationToken ct)
        => RequestAsync(catalog, () => Http.GetAsync(url, AllowedHosts(catalog), AllowsHttp(catalog), catalog.Name, headers, CatalogHttp.SearchTimeout, CatalogHttp.MaxThumbBytes, ct, catalog.AllowedHosts));

    public Task<CatalogHttpResult> PostFormAsync(CatalogContext ctx, Uri url, IReadOnlyDictionary<string, string> form, CancellationToken ct)
        => RequestAsync(ctx.Catalog, () => Http.PostFormAsync(url, AllowedHosts(ctx.Catalog), AllowsHttp(ctx.Catalog), ctx.Catalog.Name, form, CatalogHttp.SearchTimeout, 64 * 1024, ct, ctx.Catalog.AllowedHosts));

    /// <summary>
    /// Every request to a provider goes through here: a provider that asked for a pause is left alone until it is over (the person is told in German how long), a 429 starts such a pause with the
    /// time the provider named, and what it reports about its limits is remembered (and closes the door for a moment when nothing is left).
    /// </summary>
    private async Task<CatalogHttpResult> RequestAsync(ICatalog catalog, Func<Task<CatalogHttpResult>> call, bool api = true)
    {
        if (!api)
        {
            return await call();
        }

        Limiter.CheckBlock(catalog);
        try
        {
            var result = await call();
            Limiter.Note(catalog, result.Rate);
            return result;
        }
        catch (CatalogException ex) when (ex.Failure == CatalogFailure.Limit && ex.RetryAfterSeconds > 0)
        {
            Limiter.Block(catalog, ex.RetryAfterSeconds);
            throw;
        }
    }

    public static int EffectivePerMinute(ICatalog catalog, CatalogSetting setting) => setting.PerUserPerMinute > 0 ? setting.PerUserPerMinute : catalog.Info.DefaultPerUserPerMinute;

    public static int EffectivePerHour(ICatalog catalog, CatalogSetting setting) => setting.PerHour > 0 ? setting.PerHour : catalog.Info.DefaultPerHour;
}
