using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using DesignThix.Configuration;
using DesignThix.Logic;

namespace DesignThix.Catalogs.Providers;

/// <summary>
/// Pixabay (docs/PLAN-CATALOGS.md section 4; rules verified 2026-10-26, see the "C2 status"): photos, illustrations and vector graphics under the Pixabay Content License (free, no credit needed). The key
/// is a query parameter (<c>key=</c>), 100 requests per 60 seconds per key; requests must be cached for 24 hours; the image addresses may only be used for temporarily showing results, never as
/// permanent links: thumbnails go through the proxy (kept a day at most) and a chosen image is downloaded into the library (<c>fullHDURL</c> where the key has full API access, else
/// <c>largeImageURL</c>, 1 280 px). The categories are the collections; the first page without words is the popular images; "Empfehlung" is the Editor's Choice.
/// <para>The key sits in the address of every request, so nothing of that address is ever logged, shown or put into a message: <see cref="CatalogHttp"/> names only the host.</para>
/// </summary>
public sealed partial class PixabayCatalog : ICatalog
{
    public const string EditorsChoiceId = "empfehlung";

    /// <summary>The categories of the API (value) with their German names.</summary>
    private static readonly (string Id, string Name)[] Categories =
    [
        (EditorsChoiceId, "Empfehlung"), ("backgrounds", "Hintergründe"), ("nature", "Natur"), ("food", "Essen"), ("business", "Business"), ("people", "Menschen"), ("animals", "Tiere"),
        ("places", "Orte"), ("travel", "Reisen"), ("buildings", "Gebäude"), ("fashion", "Mode"), ("education", "Bildung"), ("health", "Gesundheit"), ("feelings", "Gefühle"),
        ("science", "Wissenschaft"), ("industry", "Industrie"), ("computer", "Computer"), ("sports", "Sport"), ("transportation", "Verkehr"), ("music", "Musik"), ("religion", "Religion"),
    ];

    private static readonly Dictionary<string, string> ColourMap = new(StringComparer.Ordinal) { ["violet"] = "lilac" };

    public string Id => "pixabay";

    public string Name => "Pixabay";

    public CatalogKinds Kinds => CatalogKinds.Photo | CatalogKinds.Illustration | CatalogKinds.Vector;

    public CatalogCaps Caps => CatalogCaps.External | CatalogCaps.Browse | CatalogCaps.Search | CatalogCaps.Collections | CatalogCaps.Filters | CatalogCaps.Colour | CatalogCaps.NeedsKey;

    public CatalogInfo Info { get; } = new(
        Homepage: "https://pixabay.com",
        KeyHelpUrl: "https://pixabay.com/api/docs/",
        ProviderLink: new CatalogLink("Bilder von Pixabay", "https://pixabay.com"),
        LicenceSummary: "Pixabay Content License: Die Bilder dürfen kostenlos genutzt und verändert werden, auch kommerziell; eine Nennung ist nicht nötig. Nicht erlaubt: Bilder unverändert verkaufen oder verteilen, Marken und Logos darauf kommerziell nutzen, Personen irreführend oder abwertend zeigen.",
        Description: "Kostenlose Fotos, Illustrationen und Vektorgrafiken von Pixabay.",
        DefaultPerUserPerMinute: 30,
        DefaultPerHour: 0,
        Notice: "Bilder von Pixabay. Gewählte Bilder kopiert DesignThix auf diesen Server; die Adressen von Pixabay werden nur für die Vorschau benutzt.",
        Rules:
        [
            "Pixabay bittet darum, bei den Suchergebnissen zu zeigen, woher die Bilder kommen: DesignThix zeigt den Link „Bilder von Pixabay“ über den Treffern.",
            "Suchanfragen müssen 24 Stunden zwischengespeichert werden: DesignThix hält jede Antwort einen Tag und fragt Pixabay in der Zeit nicht noch einmal.",
            "Die Adressen der Bilder dürfen nur kurz für die Vorschau benutzt werden, nicht als dauerhafte Verweise: Vorschaubilder laufen über den Server (höchstens einen Tag im Zwischenspeicher), und was jemand benutzt, wird in die Bibliothek heruntergeladen.",
            "Pixabay erlaubt 100 Anfragen pro 60 Sekunden und Schlüssel (eine höhere Grenze auf Anfrage) und keine systematischen Massen-Downloads: DesignThix hält 90 Anfragen pro Minute ein und wartet bei einer Antwort „zu viele Anfragen“.",
            "Ohne die Freigabe für die volle Schnittstelle liefert Pixabay Bilder bis 1 280 Pixel Breite; mit Freigabe nimmt DesignThix automatisch die Full-HD-Datei (1 920 Pixel).",
        ],
        KeyHint: "Den Schlüssel zeigt Pixabay nach der Anmeldung (kostenlos) oben auf der Seite der Schnittstellen-Dokumentation. Er steht in der Adresse jeder Anfrage; DesignThix schreibt ihn nie in ein Protokoll, eine Seite oder eine Meldung.",
        HasSafeSearch: true,
        KeyPerMinute: 90);

    public bool EnabledByDefault => false;

    public string? DefaultBaseUrl => "https://pixabay.com";

    public IReadOnlyList<string> AllowedHosts => ["pixabay.com", "cdn.pixabay.com"];

    public bool IsAvailable(ConfigStore config) => true;

    [GeneratedRegex("^[0-9]{1,12}$")]
    private static partial Regex ImageIdPattern();

    private static string Key(CatalogContext ctx)
        => string.IsNullOrWhiteSpace(ctx.Key)
            ? throw new CatalogException("Pixabay braucht einen Schlüssel. Bitte frag eine Administratorin oder einen Administrator.", CatalogFailure.Key)
            : Uri.EscapeDataString(ctx.Key.Trim());

    public Task<IReadOnlyList<CatalogCollection>> CollectionsAsync(CatalogContext ctx, CancellationToken ct)
        => Task.FromResult<IReadOnlyList<CatalogCollection>>([.. Categories.Select(c => new CatalogCollection(c.Id, c.Name))]);

    public async Task<CatalogPage> SearchAsync(CatalogContext ctx, CatalogQuery query, CancellationToken ct)
    {
        var key = Key(ctx);
        var text = (query.Text ?? "").Trim();
        if (text.Length > 100)
        {
            text = text[..100];
        }

        var collection = (query.Collection ?? "").Trim();
        if (collection.Length > 0 && !Categories.Any(c => c.Id == collection))
        {
            return CatalogPage.Empty();
        }

        var page = Math.Clamp(query.Page, 1, CatalogQuery.MaxPage);
        var per = Math.Clamp(query.PerPage, 3, CatalogQuery.MaxPerPage);
        var type = query.Kind switch
        {
            CatalogKinds.Photo => "photo",
            CatalogKinds.Illustration => "illustration",
            CatalogKinds.Vector => "vector",
            _ => "all",
        };
        var colour = ProviderSupport.Colour(query.Colour);
        var url = $"{ctx.BaseUrl}/api/?lang=de&image_type={type}"
                  + (text.Length > 0 ? "&q=" + Uri.EscapeDataString(text) : "")
                  + (query.Orientation == "landscape" ? "&orientation=horizontal" : query.Orientation == "portrait" ? "&orientation=vertical" : "")
                  + (collection == EditorsChoiceId ? "&editors_choice=true" : collection.Length > 0 ? "&category=" + collection : "")
                  + (colour.Length > 0 ? "&colors=" + (ColourMap.TryGetValue(colour, out var mapped) ? mapped : colour) : "")
                  + (ctx.Settings.SafeSearch ? "&safesearch=true" : "")
                  + $"&page={page.ToString(CultureInfo.InvariantCulture)}&per_page={per.ToString(CultureInfo.InvariantCulture)}&key={key}";
        using var doc = JsonDocument.Parse(await ctx.GetTextAsync(new Uri(url), null, TimeSpan.FromHours(24), ct));
        var items = new List<CatalogItem>();
        foreach (var e in ProviderSupport.Array(doc.RootElement, "hits"))
        {
            if (ReadItem(ctx, e) is { } item)
            {
                items.Add(item);
            }
        }

        // the API shows at most 500 hits of a query (totalHits)
        var reachable = ProviderSupport.Total(doc.RootElement, "totalHits");
        var more = reachable is { } all ? page * per < all : items.Count >= per;
        return new CatalogPage(items, page, per, ProviderSupport.Total(doc.RootElement, "total"), more && page < CatalogQuery.MaxPage);
    }

    /// <summary>One image of Pixabay, or null when it has no usable id or no preview on a host of Pixabay.</summary>
    private CatalogItem? ReadItem(CatalogContext ctx, JsonElement e)
    {
        var id = ProviderSupport.IdText(e, "id");
        if (!ImageIdPattern().IsMatch(id))
        {
            return null;
        }

        var thumb = ctx.Thumb(ProviderSupport.Str(e, "webformatURL"));
        if (thumb.Length == 0)
        {
            thumb = ctx.Thumb(ProviderSupport.Str(e, "previewURL"));
        }

        if (thumb.Length == 0)
        {
            return null;
        }

        var author = CatalogLicences.Clean(ProviderSupport.Str(e, "user"), 80);
        var userId = ProviderSupport.IdText(e, "user_id");
        var type = ProviderSupport.Str(e, "type").ToLowerInvariant();
        var tags = CatalogLicences.Clean(ProviderSupport.Str(e, "tags"), 120);
        return new CatalogItem
        {
            Id = id,
            Kind = type.Contains("vector", StringComparison.Ordinal) ? CatalogKinds.Vector : type.Contains("illustration", StringComparison.Ordinal) ? CatalogKinds.Illustration : CatalogKinds.Photo,
            Title = ProviderSupport.Title(ProviderSupport.Capitalise(tags), "Pixabay-Bild " + id),
            Width = ProviderSupport.Int(e, "imageWidth") ?? ProviderSupport.Int(e, "webformatWidth"),
            Height = ProviderSupport.Int(e, "imageHeight") ?? ProviderSupport.Int(e, "webformatHeight"),
            Thumb = thumb,
            Author = author,
            // https://pixabay.com/users/{name}-{id}/ as the documentation says; the name is written as the provider sent it, so it is escaped
            AuthorUrl = author.Length > 0 && ImageIdPattern().IsMatch(userId) ? $"https://pixabay.com/users/{Uri.EscapeDataString(author)}-{userId}/" : "",
            SourceUrl = ProviderSupport.OwnLink(ProviderSupport.Str(e, "pageURL"), "pixabay.com"),
            Licence = CatalogLicences.Describe("Pixabay", "Pixabay Content License", "https://pixabay.com/service/license-summary/", attribution: false),
        };
    }

    public async Task<CatalogFetch> FetchAsync(CatalogContext ctx, string itemId, CancellationToken ct)
    {
        if (!ImageIdPattern().IsMatch(itemId))
        {
            throw new BizException("Das Bild gibt es nicht (mehr).");
        }

        var url = $"{ctx.BaseUrl}/api/?id={itemId}&lang=de&key={Key(ctx)}";
        using var doc = JsonDocument.Parse(await ctx.GetTextAsync(new Uri(url), null, TimeSpan.FromHours(24), ct));
        JsonElement e = default;
        foreach (var hit in ProviderSupport.Array(doc.RootElement, "hits"))
        {
            if (ProviderSupport.IdText(hit, "id") == itemId)
            {
                e = hit;
                break;
            }
        }

        if (e.ValueKind != JsonValueKind.Object)
        {
            throw new CatalogException("Das gibt es bei Pixabay nicht (mehr).", CatalogFailure.NotFound);
        }

        var item = ReadItem(ctx, e) ?? throw new CatalogException("Pixabay nennt zu diesem Bild keine Datei.", CatalogFailure.Unavailable);
        // fullHDURL only comes with full API access; largeImageURL (1 280 px) is what a plain key gets. Neither is kept as a link: the file is downloaded now.
        var download = new[] { "fullHDURL", "largeImageURL", "webformatURL" }.Select(n => ProviderSupport.Str(e, n)).FirstOrDefault(u => Uri.TryCreate(u, UriKind.Absolute, out _));
        if (download is null)
        {
            throw new CatalogException("Pixabay nennt zu diesem Bild keine Datei.", CatalogFailure.Unavailable);
        }

        var file = await ctx.DownloadAsync(new Uri(download), null, CatalogHttp.MaxDownloadBytes, ct);
        var by = item.Author.Length > 0 ? $"Bild von {item.Author} auf Pixabay" : "Bild auf Pixabay";
        return new CatalogFetch { Item = item, FileName = "pixabay-" + itemId + ".jpg", Bytes = file.Bytes, Attribution = by };
    }
}
