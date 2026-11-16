using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using DesignThix.Configuration;
using DesignThix.Logic;

namespace DesignThix.Catalogs.Providers;

/// <summary>
/// Unsplash (docs/PLAN-CATALOGS.md "Unsplash status"; rules verified 2026-11-01): photos under the Unsplash License (free to use and change, no credit needed by the licence). Through the API
/// Unsplash demands three things the other catalogues do not, and this class and the framework around it answer each of them:
/// <list type="number">
/// <item><b>Hotlinking</b>: the pictures are shown from the addresses of <c>photo.urls</c> (<c>images.unsplash.com</c>, the <c>ixid</c> kept). The thumbnails of the results are therefore NOT proxied: the browser loads
/// them itself, and <see cref="CatalogCsp"/> lets it while this catalogue is on (<see cref="HotlinkHosts"/>).</item>
/// <item><b>Download tracking</b>: when somebody CHOOSES a photo (the import, and again when an already imported photo is used again) the server asks <c>photo.links.download_location</c> with the key. The photo is then
/// copied into the library like every other catalogue's, so a design prints offline.</item>
/// <item><b>Attribution</b>: the photographer and Unsplash, both linked, with <c>?utm_source=DesignThix&amp;utm_medium=referral</c> (<see cref="WithUtm"/>): in the tile ("Foto: Name / Unsplash"), in the source record of
/// the asset and so in the Bildnachweise of the editor and of the public view.</item>
/// </list>
/// Needs an Access Key (<c>Authorization: Client-ID &lt;key&gt;</c>); a new application is in demo mode (50 requests an hour) until Unsplash approves it (1 000 an hour). The first page without words is the
/// editorial feed (<c>/photos</c>; "Alle" in the tabs); the collections are the open topics of Unsplash (<c>/topics</c>). A 403 with nothing left is a limit, not a refused key (<see cref="CatalogHttp"/>).
/// </summary>
public sealed partial class UnsplashCatalog : ICatalog
{
    /// <summary>The name this application gives Unsplash in its links (<c>utm_source</c>); the Unsplash application is registered under the same name.</summary>
    public const string UtmSource = "DesignThix";

    public const string EditorialId = "editorial";

    /// <summary>How long a list of results or the details of a photo are kept (the other catalogues keep a day: Unsplash states no rule, and a short time keeps the views and the topics fresh).</summary>
    public static readonly TimeSpan CacheTime = TimeSpan.FromHours(1);

    /// <summary>The details of a photo are only needed for an import; ten minutes are plenty.</summary>
    private static readonly TimeSpan DetailTime = TimeSpan.FromMinutes(10);

    /// <summary>The longest side of the copy that goes into the library: enough for A4 at 300 dpi, a few MB as JPEG.</summary>
    public const int ImportWidth = 2400;

    public string Id => "unsplash";

    public string Name => "Unsplash";

    public CatalogKinds Kinds => CatalogKinds.Photo;

    public CatalogCaps Caps => CatalogCaps.External | CatalogCaps.Browse | CatalogCaps.Search | CatalogCaps.Collections | CatalogCaps.Filters | CatalogCaps.Colour | CatalogCaps.NeedsKey;

    public CatalogInfo Info { get; } = new(
        Homepage: "https://unsplash.com",
        KeyHelpUrl: "https://unsplash.com/oauth/applications",
        ProviderLink: new CatalogLink("Fotos von Unsplash", Link("https://unsplash.com/")),
        LicenceSummary: "Unsplash-Lizenz: Die Fotos dürfen kostenlos genutzt und verändert werden, auch kommerziell, ohne Erlaubnis und ohne Nennung. Nicht erlaubt: Fotos unverändert weiterverkaufen und aus ihnen einen ähnlichen oder konkurrierenden Dienst aufbauen. Über die Schnittstelle verlangt Unsplash trotzdem, die Fotografin oder den Fotografen und Unsplash zu nennen, mit Link.",
        Description: "Kostenlose Fotos von Unsplash.",
        DefaultPerUserPerMinute: 10,
        DefaultPerHour: 50,
        Notice: "Fotos von Unsplash. Dein Browser lädt die Vorschaubilder direkt von Unsplash; Unsplash sieht dabei deine IP-Adresse. Ein Foto, das du wählst, wird bei Unsplash als Download gemeldet und in die Bibliothek kopiert.",
        Rules:
        [
            "Vorschaubilder direkt von Unsplash: Unsplash verlangt, dass die Bilder von seinen eigenen Adressen (images.unsplash.com) angezeigt werden. Wenn Unsplash eingeschaltet ist, lädt der Browser die Vorschaubilder deshalb direkt von Unsplash, und Unsplash sieht dabei die IP-Adresse der Person. DesignThix erlaubt diese eine Adresse nur in der Content-Security-Policy der Seiten für angemeldete Personen, die den Medienbrowser oder den Editor zeigen (nicht in der öffentlichen Ansicht), und nur solange der Katalog eingeschaltet ist und einen Schlüssel hat.",
            "Download melden: Wählt jemand ein Foto aus (auch ein zweites Mal), meldet der Server das bei Unsplash („download_location“ des Fotos, mit dem Schlüssel; der Schlüssel kommt nie in den Browser) und kopiert das Foto in die Bibliothek des Bereichs, damit das Design offline druckt. Das Anmelden des Downloads gehört zur Schnittstelle; bleibt es aus (Unsplash nicht erreichbar), wird das Foto trotzdem übernommen.",
            "Nennung mit Link: Unsplash verlangt, die Fotografin oder den Fotografen und Unsplash zu nennen und auf deren Unsplash-Profil zu verlinken, mit ?utm_source=DesignThix&utm_medium=referral. DesignThix zeigt „Foto: Name / Unsplash“ mit Links unter jedem Treffer und nimmt das Foto mit Quelle und Fotografin oder Fotograf in die Bildnachweise auf (Editor: Datei, Bildnachweise; öffentliche Ansicht: Fußzeile).",
            "Der Name: Lege die Anwendung bei Unsplash unter dem Namen „DesignThix“ an (der Name darf nicht „Unsplash“ enthalten, das Unsplash-Logo ist tabu). Der Schlüssel heißt dort „Access Key“; den „Secret Key“ braucht DesignThix nicht.",
            "Grenzen: Eine neue Anwendung läuft im Demo-Modus mit 50 Anfragen pro Stunde. Für mehr muss Unsplash die Anwendung als „Production“ freigeben (1 000 Anfragen pro Stunde; Antrag mit Screenshots, die zeigen, dass Hotlinking, Download-Meldung und Nennung stimmen). Trage das Limit dann bei „Anfragen pro Stunde“ ein. Bilddateien von images.unsplash.com zählen nicht dazu. Eine Antwort „Rate Limit Exceeded“ wartet DesignThix bis zur nächsten vollen Stunde ab.",
            "Erlaubte Nutzung: Die Schnittstelle ist für nicht automatisierte, hochwertige Erlebnisse gedacht. Nicht erlaubt sind Werbung neben den Bildern, Datensammeln, das Training von KI-Modellen und der Nachbau von Unsplash selbst. DesignThix zeigt Unsplash nur innerhalb des Designers und übernimmt nur Fotos, die jemand benutzt.",
            "Datenschutz: Die API-Bedingungen verlangen für jede Anwendung eine Datenschutzerklärung. Erwähne darin, dass die Vorschaubilder direkt von Unsplash geladen werden und Unsplash dabei die IP-Adresse sieht; Unsplash zählt außerdem Ansichten, Suchen und Downloads.",
            "Antworten von Unsplash bleiben bis zu einer Stunde im Zwischenspeicher, damit gleiche Suchen den Schlüssel nicht verbrauchen.",
        ],
        KeyLabel: "Access Key",
        KeyHint: "Bei Unsplash unter „Your apps“ eine Anwendung anlegen (kostenlos, mit Konto); dort steht der „Access Key“. Nur dieser Schlüssel wird gebraucht; er wird verschlüsselt auf dem Server gespeichert und nie an einen Browser geschickt.",
        HasSafeSearch: true,
        LinkedCredit: true);

    public bool EnabledByDefault => false;

    public string? DefaultBaseUrl => "https://api.unsplash.com";

    public IReadOnlyList<string> AllowedHosts => ["api.unsplash.com", "images.unsplash.com"];

    public IReadOnlyList<string> HotlinkHosts => ["images.unsplash.com"];

    public bool IsAvailable(ConfigStore config) => true;

    [GeneratedRegex("^[A-Za-z0-9_-]{5,40}$")]
    private static partial Regex PhotoIdPattern();

    [GeneratedRegex("^[a-z0-9][a-z0-9-]{0,62}$")]
    private static partial Regex TopicPattern();

    [GeneratedRegex("^[A-Za-z0-9_.-]{1,60}$")]
    private static partial Regex UserPattern();

    /// <summary>What Unsplash wants after a query string it wrote itself: plain pairs only (<c>ixid</c> and friends).</summary>
    [GeneratedRegex(@"^\?[A-Za-z0-9_=&.~+-]{1,600}$")]
    private static partial Regex PlainQueryPattern();

    /// <summary>A link to Unsplash with the parameters the guidelines ask for (<c>?utm_source=...&amp;utm_medium=referral</c>); any query the address had is replaced.</summary>
    public static string Link(string url)
    {
        var safe = ProviderSupport.OwnLink(url, "unsplash.com");
        return safe.Length == 0 || !Uri.TryCreate(safe, UriKind.Absolute, out var uri) ? "" : uri.GetLeftPart(UriPartial.Path) + "?utm_source=" + UtmSource + "&utm_medium=referral";
    }

    /// <summary>The orientations of Unsplash: "squarish" is our "square".</summary>
    private static string OrientationOf(string? orientation) => orientation switch { "landscape" => "landscape", "portrait" => "portrait", "square" => "squarish", _ => "" };

    /// <summary>Colours of our filter that Unsplash has (turquoise = teal, violet = purple, pink = magenta); brown and gray it does not.</summary>
    private static string ColourOf(string? colour) => ProviderSupport.Colour(colour) switch
    {
        "red" => "red",
        "orange" => "orange",
        "yellow" => "yellow",
        "green" => "green",
        "turquoise" => "teal",
        "blue" => "blue",
        "violet" => "purple",
        "pink" => "magenta",
        "black" => "black",
        "white" => "white",
        _ => "",
    };

    private static IReadOnlyDictionary<string, string> Headers(CatalogContext ctx)
        => string.IsNullOrWhiteSpace(ctx.Key)
            ? throw new CatalogException("Unsplash braucht einen Schlüssel. Bitte frag eine Administratorin oder einen Administrator.", CatalogFailure.Key)
            : new Dictionary<string, string> { ["Authorization"] = "Client-ID " + ctx.Key.Trim(), ["Accept-Version"] = "v1" };

    public async Task<IReadOnlyList<CatalogCollection>> CollectionsAsync(CatalogContext ctx, CancellationToken ct)
    {
        // "Alle" (no collection) is the editorial feed itself; the collections are the open topics
        var list = new List<CatalogCollection>();
        using var doc = JsonDocument.Parse(await ctx.GetTextAsync(new Uri($"{ctx.BaseUrl}/topics?per_page=30&order_by=position"), Headers(ctx), TimeSpan.FromHours(24), ct));
        foreach (var topic in Elements(doc.RootElement))
        {
            var slug = ProviderSupport.Str(topic, "slug");
            var status = ProviderSupport.Str(topic, "status");
            var title = CatalogLicences.Clean(ProviderSupport.Str(topic, "title"), 60);
            if (!TopicPattern().IsMatch(slug) || slug == EditorialId || title.Length == 0 || (status.Length > 0 && status != "open") || list.Any(c => c.Id == slug))
            {
                continue;
            }

            list.Add(new CatalogCollection(slug, title, ProviderSupport.Total(topic, "total_photos")));
        }

        return list;
    }

    /// <summary>The photos of an answer that is either a list or an object with <c>results</c>.</summary>
    private static IEnumerable<JsonElement> Elements(JsonElement root)
        => root.ValueKind == JsonValueKind.Array ? root.EnumerateArray().Take(CatalogQuery.MaxPerPage * 2) : ProviderSupport.Array(root, "results");

    public async Task<CatalogPage> SearchAsync(CatalogContext ctx, CatalogQuery query, CancellationToken ct)
    {
        var headers = Headers(ctx);
        var text = (query.Text ?? "").Trim();
        var collection = (query.Collection ?? "").Trim();
        var page = Math.Clamp(query.Page, 1, CatalogQuery.MaxPage);
        var per = Math.Clamp(query.PerPage, 1, 30);   // Unsplash: at most 30 per page
        var paging = $"page={page.ToString(CultureInfo.InvariantCulture)}&per_page={per.ToString(CultureInfo.InvariantCulture)}";
        var orientation = OrientationOf(query.Orientation);

        string url;
        var searching = text.Length > 0;
        if (searching)
        {
            // a search covers all photos (its "collections" parameter wants collection ids, not topics)
            url = $"{ctx.BaseUrl}/search/photos?query={Uri.EscapeDataString(text)}&{paging}&order_by=relevant&content_filter={(ctx.Settings.SafeSearch ? "high" : "low")}"
                  + (orientation.Length > 0 ? "&orientation=" + orientation : "")
                  + (ColourOf(query.Colour) is { Length: > 0 } colour ? "&color=" + colour : "");
        }
        else if (collection.Length == 0 || collection == EditorialId)
        {
            url = $"{ctx.BaseUrl}/photos?{paging}&order_by=latest";
        }
        else if (TopicPattern().IsMatch(collection))
        {
            url = $"{ctx.BaseUrl}/topics/{collection}/photos?{paging}&order_by=popular" + (orientation.Length > 0 ? "&orientation=" + orientation : "");
        }
        else
        {
            return CatalogPage.Empty();
        }

        using var doc = JsonDocument.Parse(await ctx.GetTextAsync(new Uri(url), headers, CacheTime, ct));
        var items = new List<CatalogItem>();
        var raw = 0;
        foreach (var e in Elements(doc.RootElement))
        {
            raw++;
            if (ReadItem(ctx, e) is { } item && (searching || orientation.Length == 0 || collection.Length > 0 && collection != EditorialId || Matches(item, orientation)))
            {
                items.Add(item);
            }
        }

        if (searching)
        {
            var pages = ProviderSupport.Total(doc.RootElement, "total_pages");
            return new CatalogPage(items, page, per, ProviderSupport.Total(doc.RootElement, "total"), (pages is { } all ? page < all : raw >= per) && page < CatalogQuery.MaxPage);
        }

        // a list has no total; a full page means there may be more
        return new CatalogPage(items, page, per, null, raw >= per && page < CatalogQuery.MaxPage);
    }

    /// <summary>The editorial feed has no orientation filter: it is applied to the page.</summary>
    private static bool Matches(CatalogItem item, string orientation)
        => item.Width is not { } w || item.Height is not { } h || (orientation == "landscape" ? w > h : orientation == "portrait" ? h > w : Math.Abs(w - h) <= Math.Max(w, h) / 10);

    /// <summary>One photo of Unsplash, or null when it has no usable id, is a paid (Unsplash+) photo or has no thumbnail on the image host of Unsplash.</summary>
    private CatalogItem? ReadItem(CatalogContext ctx, JsonElement e)
    {
        var id = ProviderSupport.Str(e, "id");
        if (!PhotoIdPattern().IsMatch(id) || !e.TryGetProperty("urls", out var urls) || urls.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        // Unsplash+ photos have a licence of their own (no templates, no use for machine learning): never offered
        if ((e.TryGetProperty("premium", out var premium) && premium.ValueKind == JsonValueKind.True) || (e.TryGetProperty("plus", out var plus) && plus.ValueKind == JsonValueKind.True))
        {
            return null;
        }

        // hotlinked, as the guidelines demand: the address of photo.urls itself (with its ixid), loaded by the browser
        var thumb = ctx.Hotlink(ProviderSupport.Str(urls, "small"));
        if (thumb.Length == 0)
        {
            thumb = ctx.Hotlink(ProviderSupport.Str(urls, "thumb"));
        }

        if (thumb.Length == 0)
        {
            thumb = ctx.Hotlink(ProviderSupport.Str(urls, "regular"));
        }

        if (thumb.Length == 0)
        {
            return null;
        }

        var user = e.TryGetProperty("user", out var u) && u.ValueKind == JsonValueKind.Object ? u : default;
        var username = ProviderSupport.Str(user, "username");
        var author = CatalogLicences.Clean(ProviderSupport.Str(user, "name"), 80);
        if (author.Length == 0 && UserPattern().IsMatch(username))
        {
            author = username;
        }

        var links = user.ValueKind == JsonValueKind.Object && user.TryGetProperty("links", out var l) && l.ValueKind == JsonValueKind.Object ? l : default;
        var profile = Link(ProviderSupport.Str(links, "html"));
        if (profile.Length == 0 && UserPattern().IsMatch(username))
        {
            profile = Link("https://unsplash.com/@" + Uri.EscapeDataString(username));
        }

        var photoLinks = e.TryGetProperty("links", out var pl) && pl.ValueKind == JsonValueKind.Object ? pl : default;
        var page = Link(ProviderSupport.Str(photoLinks, "html"));
        if (page.Length == 0)
        {
            page = Link("https://unsplash.com/photos/" + id);
        }

        // the short generated description first ("brown rocks during golden hour"), else the photographer's own words
        var alt = ProviderSupport.Str(e, "alt_description");
        var title = ProviderSupport.Title(ProviderSupport.Capitalise(CatalogLicences.Clean(alt.Length > 0 ? alt : ProviderSupport.Str(e, "description"), 120)), author.Length > 0 ? "Foto von " + author : "Unsplash-Foto " + id);
        return new CatalogItem
        {
            Id = id,
            Kind = CatalogKinds.Photo,
            Title = title,
            Width = ProviderSupport.Int(e, "width"),
            Height = ProviderSupport.Int(e, "height"),
            Thumb = thumb,
            Author = author,
            AuthorUrl = profile,
            SourceUrl = page,
            Licence = CatalogLicences.Describe("Unsplash", "Unsplash-Lizenz", "https://unsplash.com/license", attribution: true),
        };
    }

    private async Task<JsonDocument> PhotoAsync(CatalogContext ctx, string itemId, CancellationToken ct)
        => JsonDocument.Parse(await ctx.GetTextAsync(new Uri($"{ctx.BaseUrl}/photos/{itemId}"), Headers(ctx), DetailTime, ct));

    public async Task<CatalogFetch> FetchAsync(CatalogContext ctx, string itemId, CancellationToken ct)
    {
        if (!PhotoIdPattern().IsMatch(itemId))
        {
            throw new BizException("Das Bild gibt es nicht (mehr).");
        }

        using var doc = await PhotoAsync(ctx, itemId, ct);
        var e = doc.RootElement;
        var item = ReadItem(ctx, e) ?? throw new CatalogException("Unsplash nennt zu diesem Foto keine Datei.", CatalogFailure.Unavailable);
        if (item.Id != itemId)
        {
            throw new BizException("Das Bild gibt es nicht (mehr).");
        }

        var download = DownloadAddress(e.GetProperty("urls")) ?? throw new CatalogException("Unsplash nennt zu diesem Foto keine Datei.", CatalogFailure.Unavailable);

        // the person chose this photo: Unsplash is told about the download at the same time as the file is fetched (a failure of the message never fails the import)
        var ping = PingAsync(ctx, itemId, e, ct);
        CatalogHttpResult file;
        try
        {
            file = await ctx.DownloadAsync(download, null, CatalogHttp.MaxDownloadBytes, ct);
        }
        finally
        {
            await ping;
        }

        var by = item.Author.Length > 0 ? $"Foto von {item.Author} auf Unsplash" : "Foto auf Unsplash";
        return new CatalogFetch { Item = item, FileName = "unsplash-" + itemId + ".jpg", Bytes = file.Bytes, Attribution = by };
    }

    /// <summary>
    /// The file for the library: <c>urls.raw</c> with the custom size the API allows (<c>w</c>, <c>fit</c>, <c>q</c>, <c>fm</c>; the <c>ixid</c> stays), else <c>full</c> or <c>regular</c> as they are. The host is checked
    /// when the file is asked for (the images host of Unsplash or the operator's address).
    /// </summary>
    private static Uri? DownloadAddress(JsonElement urls)
    {
        foreach (var name in new[] { "raw", "full", "regular" })
        {
            var url = ProviderSupport.Str(urls, name);
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || url.Length > 800 || url.Any(char.IsControl))
            {
                continue;
            }

            return name == "raw" ? new Uri(uri.AbsoluteUri + (string.IsNullOrEmpty(uri.Query) ? "?" : "&") + $"w={ImportWidth}&fit=max&q=85&fm=jpg") : uri;
        }

        return null;
    }

    /// <summary>
    /// Tells Unsplash about a download: a GET to the <c>download_location</c> of the photo with the key. The address is built from the API address and the id (never taken from the answer); only the query
    /// Unsplash wrote (<c>ixid</c>) is kept, as the guideline asks. Best effort: a refused or failed message is swallowed, the person's work goes on.
    /// </summary>
    private static async Task PingAsync(CatalogContext ctx, string itemId, JsonElement photo, CancellationToken ct)
    {
        try
        {
            var links = photo.TryGetProperty("links", out var l) && l.ValueKind == JsonValueKind.Object ? l : default;
            var query = "";
            if (Uri.TryCreate(ProviderSupport.Str(links, "download_location"), UriKind.Absolute, out var given) && given.AbsolutePath == $"/photos/{itemId}/download" && PlainQueryPattern().IsMatch(given.Query))
            {
                query = given.Query;
            }

            await ctx.GetAsync(new Uri($"{ctx.BaseUrl}/photos/{itemId}/download{query}"), Headers(ctx), ct);
        }
        catch (CatalogException)
        {
            // the guideline wants the message; a person who has chosen a photo is not stopped by a failure of it
        }
    }

    public async Task UsedAgainAsync(CatalogContext ctx, string itemId, CancellationToken ct)
    {
        if (!PhotoIdPattern().IsMatch(itemId))
        {
            return;
        }

        try
        {
            using var doc = await PhotoAsync(ctx, itemId, ct);
            await PingAsync(ctx, itemId, doc.RootElement, ct);
        }
        catch (CatalogException)
        {
            // best effort, see PingAsync
        }
    }
}
