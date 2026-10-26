using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using DesignThix.Catalogs.Providers;
using DesignThix.Configuration;
using DesignThix.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Catalogs;

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
public sealed class CatalogServices(CatalogRegistry registry, CatalogHttp http, CatalogProxy proxy, CatalogLimiter limiter, CatalogSecretStore secrets, CatalogThumbCache thumbs, ConfigStore config, IServiceProvider services)
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
    public string? BaseUrl(ICatalog catalog)
    {
        if (Seam is { } seam && seam.BaseUrls.TryGetValue(catalog.Id, out var forTest) && !string.IsNullOrWhiteSpace(forTest))
        {
            return forTest.TrimEnd('/');
        }

        return Config.Current.Catalogs.TryGetValue(catalog.Id, out var configured) && !string.IsNullOrWhiteSpace(configured.BaseUrl) ? configured.BaseUrl.TrimEnd('/') : catalog.DefaultBaseUrl;
    }

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
        Limiter.TakePerson(ctx.Biz.UserId, ctx.Catalog, EffectivePerMinute(ctx.Catalog, ctx.Settings));
        Limiter.TakeBudget(ctx.Catalog, EffectivePerHour(ctx.Catalog, ctx.Settings));
        var result = await Http.GetAsync(url, AllowedHosts(ctx.Catalog), AllowsHttp(ctx.Catalog), ctx.Catalog.Name, headers, CatalogHttp.SearchTimeout, CatalogHttp.MaxJsonBytes, ct);
        var text = Encoding.UTF8.GetString(result.Bytes);
        try
        {
            using var _ = JsonDocument.Parse(text);
        }
        catch (JsonException)
        {
            throw new CatalogException($"{ctx.Catalog.Name} hat etwas geantwortet, das DesignThix nicht versteht.", CatalogFailure.Unavailable);
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

    public Task<CatalogHttpResult> DownloadAsync(CatalogContext ctx, Uri url, IReadOnlyDictionary<string, string>? headers, long maxBytes, CancellationToken ct)
        => Http.GetAsync(url, AllowedHosts(ctx.Catalog), AllowsHttp(ctx.Catalog), ctx.Catalog.Name, headers, CatalogHttp.DownloadTimeout, Math.Min(maxBytes, CatalogHttp.MaxDownloadBytes), ct);

    public static int EffectivePerMinute(ICatalog catalog, CatalogSetting setting) => setting.PerUserPerMinute > 0 ? setting.PerUserPerMinute : catalog.Info.DefaultPerUserPerMinute;

    public static int EffectivePerHour(ICatalog catalog, CatalogSetting setting) => setting.PerHour > 0 ? setting.PerHour : catalog.Info.DefaultPerHour;
}
