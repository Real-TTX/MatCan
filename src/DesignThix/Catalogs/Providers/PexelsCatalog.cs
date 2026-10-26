using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using DesignThix.Configuration;
using DesignThix.Logic;

namespace DesignThix.Catalogs.Providers;

/// <summary>
/// Pexels (docs/PLAN-CATALOGS.md section 4; rules verified 2026-10-26, see the "C2 status"): photos with the Pexels licence (free to use and change, a credit is appreciated, not required). Needs a key
/// (<c>Authorization: &lt;key&gt;</c>), 200 requests per hour and 20 000 per month. The first page without words is <c>/v1/curated</c>; the collections are "Kuratiert" and the featured collections of
/// Pexels; a search covers all photos. A visible link to Pexels is shown with the results and the photographer is named in the credits. The import downloads <c>large2x</c> (about 1 900 px wide)
/// into the library, so a design never loads from Pexels.
/// </summary>
public sealed partial class PexelsCatalog : ICatalog
{
    public const string CuratedId = "curated";

    public string Id => "pexels";

    public string Name => "Pexels";

    public CatalogKinds Kinds => CatalogKinds.Photo;

    public CatalogCaps Caps => CatalogCaps.External | CatalogCaps.Browse | CatalogCaps.Search | CatalogCaps.Collections | CatalogCaps.Filters | CatalogCaps.Colour | CatalogCaps.NeedsKey;

    public CatalogInfo Info { get; } = new(
        Homepage: "https://www.pexels.com",
        KeyHelpUrl: "https://www.pexels.com/api/",
        ProviderLink: new CatalogLink("Fotos von Pexels", "https://www.pexels.com"),
        LicenceSummary: "Pexels-Lizenz: Die Fotos dürfen kostenlos genutzt und verändert werden, auch kommerziell. Eine Nennung ist nicht verlangt, aber willkommen. Nicht erlaubt: unveränderte Kopien verkaufen, Personen in schlechtem Licht zeigen, Fotos als Teil einer Marke benutzen.",
        Description: "Kostenlose Fotos von Pexels.",
        DefaultPerUserPerMinute: 20,
        DefaultPerHour: 200,
        Notice: "Fotos von Pexels. Der Name der Fotografin oder des Fotografen kommt in die Bildnachweise.",
        Rules:
        [
            "Pexels verlangt einen sichtbaren Link auf Pexels bei den Ergebnissen: DesignThix zeigt ihn über den Treffern („Fotos von Pexels“).",
            "Die Fotografin oder der Fotograf wird genannt, soweit möglich: DesignThix speichert den Namen mit dem Bild und nimmt ihn in die Bildnachweise auf.",
            "Pexels erlaubt standardmäßig 200 Anfragen pro Stunde und 20 000 pro Monat. Wer mehr braucht, kann bei Pexels eine höhere Grenze erfragen (mit einem Beispiel, wie Pexels genannt wird); trage sie dann hier ein.",
            "Das Umgehen der Grenzen ist verboten und führt zum Entzug des Schlüssels: DesignThix wartet bei einer Antwort „zu viele Anfragen“ die Zeit ab, die Pexels nennt, und fragt in der Zeit nicht weiter.",
            "Pexels-Inhalte dürfen nicht kopiert oder als eigener Dienst nachgebaut werden, und die Schnittstelle ist nicht dafür da, Fotos in großer Zahl für KI-Training zu sammeln: DesignThix übernimmt nur Bilder, die jemand benutzt.",
            "Antworten von Pexels bleiben bis zu 24 Stunden im Zwischenspeicher, damit gleiche Suchen den Schlüssel nicht verbrauchen.",
        ],
        KeyHint: "Den Schlüssel stellt Pexels aus (kostenlos, mit Konto). Pexels hat die Ausgabe neuer Schlüssel zeitweise ausgesetzt; ein vorhandener Schlüssel funktioniert weiter.");

    public bool EnabledByDefault => false;

    public string? DefaultBaseUrl => "https://api.pexels.com";

    public IReadOnlyList<string> AllowedHosts => ["api.pexels.com", "images.pexels.com"];

    public bool IsAvailable(ConfigStore config) => true;

    [GeneratedRegex("^[0-9]{1,12}$")]
    private static partial Regex PhotoIdPattern();

    [GeneratedRegex("^[A-Za-z0-9]{1,24}$")]
    private static partial Regex CollectionIdPattern();

    private static IReadOnlyDictionary<string, string> Headers(CatalogContext ctx)
        => string.IsNullOrWhiteSpace(ctx.Key)
            ? throw new CatalogException("Pexels braucht einen Schlüssel. Bitte frag eine Administratorin oder einen Administrator.", CatalogFailure.Key)
            : new Dictionary<string, string> { ["Authorization"] = ctx.Key.Trim() };

    public async Task<IReadOnlyList<CatalogCollection>> CollectionsAsync(CatalogContext ctx, CancellationToken ct)
    {
        var list = new List<CatalogCollection> { new(CuratedId, "Kuratiert") };
        using var doc = JsonDocument.Parse(await ctx.GetTextAsync(new Uri($"{ctx.BaseUrl}/v1/collections/featured?per_page=24&page=1"), Headers(ctx), TimeSpan.FromHours(24), ct));
        foreach (var c in ProviderSupport.Array(doc.RootElement, "collections"))
        {
            var id = ProviderSupport.IdText(c, "id");
            var photos = ProviderSupport.Total(c, "photos_count");
            if (!CollectionIdPattern().IsMatch(id) || id == CuratedId || photos == 0 || (c.TryGetProperty("private", out var isPrivate) && isPrivate.ValueKind == JsonValueKind.True))
            {
                continue;
            }

            var title = CatalogLicences.Clean(ProviderSupport.Str(c, "title"), 80);
            if (title.Length > 0)
            {
                list.Add(new CatalogCollection(id, title, photos));
            }
        }

        return list;
    }

    public async Task<CatalogPage> SearchAsync(CatalogContext ctx, CatalogQuery query, CancellationToken ct)
    {
        var headers = Headers(ctx);
        var text = (query.Text ?? "").Trim();
        var collection = (query.Collection ?? "").Trim();
        var page = Math.Clamp(query.Page, 1, CatalogQuery.MaxPage);
        var per = Math.Clamp(query.PerPage, 1, CatalogQuery.MaxPerPage);
        var paging = $"page={page.ToString(CultureInfo.InvariantCulture)}&per_page={per.ToString(CultureInfo.InvariantCulture)}";

        string url;
        string arrayName = "photos";
        if (text.Length > 0)
        {
            // a search covers all photos of Pexels (the API cannot search inside a collection)
            url = $"{ctx.BaseUrl}/v1/search?query={Uri.EscapeDataString(text)}&locale=de-DE&{paging}"
                  + (query.Orientation is "landscape" or "portrait" or "square" ? "&orientation=" + query.Orientation : "")
                  + (ProviderSupport.Colour(query.Colour) is { Length: > 0 } colour ? "&color=" + colour : "");
        }
        else if (collection.Length == 0 || collection == CuratedId)
        {
            url = $"{ctx.BaseUrl}/v1/curated?{paging}";
        }
        else if (CollectionIdPattern().IsMatch(collection))
        {
            url = $"{ctx.BaseUrl}/v1/collections/{collection}?type=photos&{paging}";
            arrayName = "media";
        }
        else
        {
            return CatalogPage.Empty();
        }

        using var doc = JsonDocument.Parse(await ctx.GetTextAsync(new Uri(url), headers, TimeSpan.FromHours(24), ct));
        var items = new List<CatalogItem>();
        foreach (var e in ProviderSupport.Array(doc.RootElement, arrayName))
        {
            // a collection may hold videos: only photos count
            if (e.TryGetProperty("type", out var type) && type.ValueKind == JsonValueKind.String && !string.Equals(type.GetString(), "Photo", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (ReadItem(ctx, e) is { } item)
            {
                items.Add(item);
            }
        }

        var total = ProviderSupport.Total(doc.RootElement, "total_results");
        var more = doc.RootElement.TryGetProperty("next_page", out var next) && next.ValueKind == JsonValueKind.String && page < CatalogQuery.MaxPage;
        return new CatalogPage(items, page, per, total, more);
    }

    /// <summary>One photo of Pexels, or null when it has no usable id or no thumbnail on a host of Pexels.</summary>
    private CatalogItem? ReadItem(CatalogContext ctx, JsonElement e)
    {
        var id = ProviderSupport.IdText(e, "id");
        if (!PhotoIdPattern().IsMatch(id) || !e.TryGetProperty("src", out var src) || src.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        var thumb = ctx.Thumb(ProviderSupport.Str(src, "medium"));
        if (thumb.Length == 0)
        {
            thumb = ctx.Thumb(ProviderSupport.Str(src, "small"));
        }

        if (thumb.Length == 0)
        {
            return null;
        }

        var author = CatalogLicences.Clean(ProviderSupport.Str(e, "photographer"), 80);
        return new CatalogItem
        {
            Id = id,
            Kind = CatalogKinds.Photo,
            Title = ProviderSupport.Title(ProviderSupport.Str(e, "alt"), author.Length > 0 ? "Foto von " + author : "Pexels-Foto " + id),
            Width = ProviderSupport.Int(e, "width"),
            Height = ProviderSupport.Int(e, "height"),
            Thumb = thumb,
            Author = author,
            AuthorUrl = ProviderSupport.OwnLink(ProviderSupport.Str(e, "photographer_url"), "pexels.com"),
            SourceUrl = ProviderSupport.OwnLink(ProviderSupport.Str(e, "url"), "pexels.com"),
            Licence = CatalogLicences.Describe("Pexels", "Pexels-Lizenz", "https://www.pexels.com/license/", attribution: false),
        };
    }

    public async Task<CatalogFetch> FetchAsync(CatalogContext ctx, string itemId, CancellationToken ct)
    {
        if (!PhotoIdPattern().IsMatch(itemId))
        {
            throw new BizException("Das Bild gibt es nicht (mehr).");
        }

        using var doc = JsonDocument.Parse(await ctx.GetTextAsync(new Uri($"{ctx.BaseUrl}/v1/photos/{itemId}"), Headers(ctx), TimeSpan.FromHours(24), ct));
        var e = doc.RootElement;
        var item = ReadItem(ctx, e) ?? throw new CatalogException("Pexels nennt zu diesem Foto keine Datei.", CatalogFailure.Unavailable);
        if (item.Id != itemId)
        {
            throw new BizException("Das Bild gibt es nicht (mehr).");
        }

        // large2x: about 1 900 px wide, plenty for a poster at screen quality and small enough for the library; the original of a Pexels photo can be 25 MB
        var src = e.GetProperty("src");
        var download = new[] { "large2x", "large", "original" }.Select(n => ProviderSupport.Str(src, n)).FirstOrDefault(u => Uri.TryCreate(u, UriKind.Absolute, out _));
        if (download is null)
        {
            throw new CatalogException("Pexels nennt zu diesem Foto keine Datei.", CatalogFailure.Unavailable);
        }

        var file = await ctx.DownloadAsync(new Uri(download), null, CatalogHttp.MaxDownloadBytes, ct);
        var by = item.Author.Length > 0 ? $"Foto von {item.Author} auf Pexels" : "Foto auf Pexels";
        return new CatalogFetch { Item = item, FileName = "pexels-" + itemId + ".jpg", Bytes = file.Bytes, Attribution = by };
    }
}
