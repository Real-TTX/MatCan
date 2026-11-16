using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using MatCan.Configuration;
using MatCan.Logic;

namespace MatCan.Catalogs.Providers;

/// <summary>
/// The reference implementation of an EXTERNAL catalogue, and the fixture of the tests and browser checks: a small stock-photo API (<c>/api/collections</c>, <c>/api/search</c>, <c>/api/items/{id}</c>)
/// that <c>tests/e2e/fake-catalogs.js</c> and the integration tests answer. It exists only when the operator names an address for it (<c>MATCAN__Catalogs__example-browse__BaseUrl</c>), so a
/// production installation never shows it. A real provider (Pexels, Pixabay ...) copies its shape: build the request from the ids and the settings, read the answer with care, drop what the licence
/// does not allow, give every thumbnail to <see cref="CatalogContext.Thumb"/>, and fill in author and licence.
/// <para>Two instances: <c>example-browse</c> (collections, a first page without a query, no key) and <c>example-search</c> (search only, needs a key).</para>
/// </summary>
public sealed partial class ExampleCatalog(string id, string name, bool browsable) : ICatalog
{
    public string Id => id;

    public string Name => name;

    public CatalogKinds Kinds => CatalogKinds.Photo | CatalogKinds.Illustration;

    public CatalogCaps Caps => CatalogCaps.External | CatalogCaps.Search | CatalogCaps.Filters | (browsable ? CatalogCaps.Browse | CatalogCaps.Collections : CatalogCaps.NeedsKey);

    public CatalogInfo Info { get; } = new("https://example.invalid", browsable ? null : "https://example.invalid/key", new CatalogLink("Bilder vom Beispielanbieter", "https://example.invalid"),
        "Beispielbilder für Tests: frei verwendbar.", "Ein Katalog zum Ausprobieren und für die Tests.", DefaultPerUserPerMinute: 30, DefaultPerHour: 0, HasSafeSearch: true, HasLicenceChoice: true);

    public bool EnabledByDefault => false;

    public string? DefaultBaseUrl => null;

    public IReadOnlyList<string> AllowedHosts => [];

    public bool IsAvailable(ConfigStore config) => config.Current.Catalogs.TryGetValue(id, out var configured) && !string.IsNullOrWhiteSpace(configured.BaseUrl);

    [GeneratedRegex("^[A-Za-z0-9_-]{1,64}$")]
    private static partial Regex ItemIdPattern();

    private Dictionary<string, string>? Headers(CatalogContext ctx)
    {
        if (!browsable && string.IsNullOrWhiteSpace(ctx.Key))
        {
            throw new CatalogException($"{Name} braucht einen Schlüssel. Bitte frag eine Administratorin oder einen Administrator.", CatalogFailure.Key);
        }

        return string.IsNullOrWhiteSpace(ctx.Key) ? null : new Dictionary<string, string> { ["Authorization"] = ctx.Key };
    }

    public async Task<IReadOnlyList<CatalogCollection>> CollectionsAsync(CatalogContext ctx, CancellationToken ct)
    {
        if (!browsable)
        {
            return [];
        }

        using var doc = JsonDocument.Parse(await ctx.GetTextAsync(new Uri(ctx.BaseUrl + "/api/collections"), Headers(ctx), TimeSpan.FromHours(24), ct));
        var list = new List<CatalogCollection>();
        if (doc.RootElement.TryGetProperty("collections", out var collections) && collections.ValueKind == JsonValueKind.Array)
        {
            foreach (var c in collections.EnumerateArray().Take(100))
            {
                var cid = Str(c, "id");
                if (cid.Length > 0 && ItemIdPattern().IsMatch(cid))
                {
                    list.Add(new CatalogCollection(cid, CatalogLicences.Clean(Str(c, "name"), 80), c.TryGetProperty("count", out var n) && n.TryGetInt32(out var count) ? count : null));
                }
            }
        }

        return list;
    }

    public async Task<CatalogPage> SearchAsync(CatalogContext ctx, CatalogQuery query, CancellationToken ct)
    {
        var text = (query.Text ?? "").Trim();
        var collection = (query.Collection ?? "").Trim();
        if (collection.Length > 0 && !ItemIdPattern().IsMatch(collection))
        {
            return CatalogPage.Empty();
        }

        if (!browsable && text.Length == 0)
        {
            return CatalogPage.Empty("Gib einen Suchbegriff ein.");
        }

        var page = Math.Clamp(query.Page, 1, CatalogQuery.MaxPage);
        var per = Math.Clamp(query.PerPage, 1, CatalogQuery.MaxPerPage);
        var url = $"{ctx.BaseUrl}/api/search?query={Uri.EscapeDataString(text)}&page={page.ToString(CultureInfo.InvariantCulture)}&per_page={per.ToString(CultureInfo.InvariantCulture)}"
                  + (query.Orientation is "landscape" or "portrait" or "square" ? "&orientation=" + query.Orientation : "")
                  + (collection.Length > 0 ? "&collection=" + Uri.EscapeDataString(collection) : "")
                  + (ctx.Settings.SafeSearch ? "&safe=1" : "");
        using var doc = JsonDocument.Parse(await ctx.GetTextAsync(new Uri(url), Headers(ctx), TimeSpan.FromHours(24), ct));
        var items = new List<CatalogItem>();
        if (doc.RootElement.TryGetProperty("items", out var array) && array.ValueKind == JsonValueKind.Array)
        {
            foreach (var e in array.EnumerateArray().Take(CatalogQuery.MaxPerPage))
            {
                if (ReadItem(ctx, e) is { } item)
                {
                    items.Add(item);
                }
            }
        }

        int? total = doc.RootElement.TryGetProperty("total", out var t) && t.TryGetInt32(out var totalCount) ? totalCount : null;
        var more = total is { } all ? page * per < all : items.Count >= per;
        return new CatalogPage(items, page, per, total, more);
    }

    /// <summary>One result, or null when it must not be offered: no usable licence (NC, ND, unknown), an id that is no id, no thumbnail on an allowed host.</summary>
    private CatalogItem? ReadItem(CatalogContext ctx, JsonElement e)
    {
        var itemId = Str(e, "id");
        if (!ItemIdPattern().IsMatch(itemId) || !e.TryGetProperty("licence", out var l) || l.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        var code = Str(l, "code");
        if (!CatalogLicences.IsUsable(code))
        {
            return null;
        }

        var thumb = ctx.Thumb(Str(e, "thumb"));
        if (thumb.Length == 0)
        {
            return null;
        }

        return new CatalogItem
        {
            Id = itemId,
            Kind = Str(e, "kind") == "illustration" ? CatalogKinds.Illustration : CatalogKinds.Photo,
            Title = CatalogLicences.Clean(Str(e, "title"), 120),
            Width = Int(e, "width"),
            Height = Int(e, "height"),
            Thumb = thumb,
            Author = CatalogLicences.Clean(Str(e, "author"), 80),
            AuthorUrl = CatalogLicences.SafeUrl(Str(e, "authorUrl")),
            SourceUrl = CatalogLicences.SafeUrl(Str(e, "url")),
            Licence = CatalogLicences.Describe(code, Str(l, "name"), Str(l, "url")),
        };
    }

    public async Task<CatalogFetch> FetchAsync(CatalogContext ctx, string itemId, CancellationToken ct)
    {
        if (!ItemIdPattern().IsMatch(itemId))
        {
            throw new BizException("Das Bild gibt es nicht (mehr).");
        }

        var headers = Headers(ctx);
        using var doc = JsonDocument.Parse(await ctx.GetTextAsync(new Uri($"{ctx.BaseUrl}/api/items/{itemId}"), headers, TimeSpan.FromHours(24), ct));
        var e = doc.RootElement;
        var item = ReadItem(ctx, e) ?? throw new CatalogException("Dieses Bild darf nicht verwendet werden (Lizenz).", CatalogFailure.Refused);
        if (!Uri.TryCreate(Str(e, "download"), UriKind.Absolute, out var download))
        {
            throw new CatalogException($"{Name} nennt keine Datei zu diesem Bild.", CatalogFailure.Unavailable);
        }

        var file = await ctx.DownloadAsync(download, headers, CatalogHttp.MaxDownloadBytes, ct);
        return new CatalogFetch { Item = item, FileName = item.Id + ".img", Bytes = file.Bytes, Attribution = CatalogLicences.Clean(Str(e, "credit"), 300) };
    }

    private static string Str(JsonElement e, string name) => e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";

    private static int? Int(JsonElement e, string name) => e.TryGetProperty(name, out var v) && v.TryGetInt32(out var n) && n is > 0 and < 100_000 ? n : null;
}
