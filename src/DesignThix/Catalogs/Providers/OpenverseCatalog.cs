using System.Collections.Concurrent;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using DesignThix.Configuration;
using DesignThix.Logic;

namespace DesignThix.Catalogs.Providers;

/// <summary>
/// Openverse (docs/PLAN-CATALOGS.md section 4; rules verified 2026-10-26, see the "C2 status"): openly licensed images (Creative Commons, public domain) from Flickr, Wikimedia Commons and others. Search
/// only. It works without a key (anonymous: 20 requests a minute, 200 a day, pages of at most 20 results and at most 240 results per query, 1 000 thumbnails a day); optional client credentials
/// ("Client-ID:Client-Secret", the OAuth2 client-credentials flow) raise the limits.
/// <para><b>Licences</b>: every request asks <c>license_type=commercial,modification</c>, and every result is checked again here: only CC0, public domain, CC BY and CC BY-SA (or the narrower list the
/// administrator chose) are offered, never NC or ND, never an unknown licence, and the same check runs when an image is fetched by id.</para>
/// <para><b>Hosts</b>: the pictures of Openverse live on thousands of hosts, so the catalogue never fetches a provider's address: thumbnails and the import both go through Openverse's own
/// <c>/v1/images/{id}/thumb/</c> (with <c>full_size=true</c> for the import), so the only host is <c>api.openverse.org</c>.</para>
/// </summary>
public sealed partial class OpenverseCatalog : ICatalog
{
    /// <summary>The licences offered unless the administrator narrows them (the beginning of the normalised code, followed by a version).</summary>
    public static readonly IReadOnlyList<string> DefaultLicences = ["CC0", "PDM", "CC-BY", "CC-BY-SA"];

    /// <summary>The anonymous limit for the depth of a query (results 1 to 240) and the size of a page.</summary>
    private const int AnonymousDepth = 240;

    private const int AnonymousPageSize = 20;

    private readonly ConcurrentDictionary<string, (string Token, DateTime Until)> _tokens = new();

    /// <summary>One token request at a time: a page of results asks for twenty thumbnails at once, and all of them need the same token.</summary>
    private readonly SemaphoreSlim _tokenGate = new(1, 1);

    public string Id => "openverse";

    public string Name => "Openverse";

    public CatalogKinds Kinds => CatalogKinds.Photo | CatalogKinds.Illustration;

    public CatalogCaps Caps => CatalogCaps.External | CatalogCaps.Search | CatalogCaps.Filters;

    public CatalogInfo Info { get; } = new(
        Homepage: "https://openverse.org",
        KeyHelpUrl: "https://api.openverse.org/v1/#tag/auth/operation/auth_tokens_register",
        ProviderLink: new CatalogLink("Bilder über Openverse", "https://openverse.org"),
        LicenceSummary: "Creative-Commons-Lizenzen und gemeinfreie Werke. Angeboten werden nur Lizenzen, die kommerzielle Nutzung und Bearbeitung erlauben: CC0, Public Domain Mark, CC BY und CC BY-SA. Bei CC BY und CC BY-SA muss die Urheberin oder der Urheber genannt werden (die Bildnachweise tun das); bei CC BY-SA gilt für Bearbeitungen des Bildes dieselbe Lizenz.",
        Description: "Offen lizenzierte Bilder von Flickr, Wikimedia Commons und weiteren Quellen, über Openverse.",
        DefaultPerUserPerMinute: 10,
        DefaultPerHour: 40,
        Notice: "Bilder über Openverse, mit Creative-Commons-Lizenzen. Openverse empfiehlt oder prüft DesignThix nicht; die Urheberin oder der Urheber kommt in die Bildnachweise.",
        Rules:
        [
            "Openverse verlangt, dass ein Dienst auf Openverse hinweist und sagt, dass Openverse ihn nicht empfiehlt oder prüft: DesignThix zeigt den Link „Bilder über Openverse“ und diesen Hinweis über den Treffern.",
            "Werke müssen richtig genannt werden (Urheber, Titel, Quelle, Lizenz): DesignThix speichert das mit jedem Bild und nimmt es in die Bildnachweise auf. Die Lizenz der einzelnen Treffer steht auf der Kachel.",
            "Ohne Anmeldung erlaubt Openverse 20 Anfragen pro Minute und 200 pro Tag, Seiten mit höchstens 20 Treffern, höchstens 240 Treffer pro Suche und 1 000 Vorschaubilder pro Tag. Mit Zugangsdaten (kostenlos, die E-Mail-Adresse muss bestätigt werden) sind die Grenzen etwas höher; DesignThix hält die Grenzen ein und wartet bei „zu viele Anfragen“ die Zeit ab, die Openverse nennt.",
            "Scrapen ist verboten: DesignThix übernimmt nur Bilder, die jemand benutzt.",
            "Openverse prüft die Lizenzen der Quellen nicht selbst: DesignThix lässt nur CC0, Public Domain Mark, CC BY und CC BY-SA durch und prüft das bei jedem Bild noch einmal; NC (nichtkommerziell) und ND (keine Bearbeitung) gibt es nie.",
        ],
        KeyLabel: "Zugangsdaten (optional)",
        KeyHint: "Ohne Eintrag geht Openverse auch (mit den niedrigen Grenzen für Anonyme). Für höhere Grenzen registrierst du dich bei Openverse (POST /v1/auth_tokens/register/) und trägst hier „Client-ID:Client-Secret“ ein, getrennt durch einen Doppelpunkt.",
        HasSafeSearch: true,
        HasLicenceChoice: true,
        KeyPerMinute: 18);

    public bool EnabledByDefault => false;

    public string? DefaultBaseUrl => "https://api.openverse.org";

    public IReadOnlyList<string> AllowedHosts => ["api.openverse.org"];

    public bool IsAvailable(ConfigStore config) => true;

    public bool ThumbsNeedAuth => true;

    [GeneratedRegex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")]
    private static partial Regex ImageIdPattern();

    [GeneratedRegex("^[a-z0-9+-]{1,20}$")]
    private static partial Regex LicenceWordPattern();

    [GeneratedRegex("^[0-9]{1,2}(\\.[0-9]{1,2})?$")]
    private static partial Regex VersionPattern();

    public Task<IReadOnlyList<CatalogCollection>> CollectionsAsync(CatalogContext ctx, CancellationToken ct) => Task.FromResult<IReadOnlyList<CatalogCollection>>([]);

    // ------------------------------------------------------------------------------------------------ the licence

    /// <summary>The licence of an item as <see cref="CatalogLicences"/> writes codes: "by" + "2.0" = CC-BY-2.0, "cc0" = CC0-1.0, "pdm" = PDM-1.0. Null for something that is no licence word.</summary>
    internal static string? LicenceCode(string licence, string version)
    {
        var word = licence.Trim().ToLowerInvariant();
        if (!LicenceWordPattern().IsMatch(word))
        {
            return null;
        }

        var v = VersionPattern().IsMatch(version.Trim()) ? version.Trim() : "";
        return word switch
        {
            "cc0" => "CC0-" + (v.Length > 0 ? v : "1.0"),
            "pdm" => "PDM-" + (v.Length > 0 ? v : "1.0"),
            _ => "CC-" + word.ToUpperInvariant() + (v.Length > 0 ? "-" + v : ""),
        };
    }

    private static string LicenceName(string licence, string version)
    {
        var word = licence.Trim().ToLowerInvariant();
        var v = VersionPattern().IsMatch(version.Trim()) ? " " + version.Trim() : "";
        return word switch
        {
            "cc0" => "CC0" + v,
            "pdm" => "Public Domain Mark" + v,
            _ => "CC " + word.ToUpperInvariant().Replace('-', ' ') + v,
        };
    }

    /// <summary>Whether a licence code is one the catalogue offers now: usable at all (no NC, no ND), and in the list of the administrator (the defaults when it is empty).</summary>
    internal static bool Allowed(string code, IReadOnlyList<string> chosen)
    {
        if (!CatalogLicences.IsUsable(code))
        {
            return false;
        }

        var normalized = CatalogLicences.Normalize(code);
        var list = chosen.Count == 0 ? DefaultLicences : chosen;
        return list.Select(CatalogLicences.Normalize).Any(a => a.Length > 0 && (normalized == a || (normalized.StartsWith(a + "-", StringComparison.Ordinal) && char.IsAsciiDigit(normalized[a.Length + 1]))));
    }

    /// <summary>The words of the "license" parameter for the licences the administrator allows (empty = leave it to license_type).</summary>
    private static string LicenceParameter(IReadOnlyList<string> chosen)
    {
        if (chosen.Count == 0)
        {
            return "";
        }

        var words = new List<string>();
        foreach (var code in chosen.Select(CatalogLicences.Normalize))
        {
            var word = code switch
            {
                _ when code.StartsWith("CC0", StringComparison.Ordinal) => "cc0",
                _ when code.StartsWith("PDM", StringComparison.Ordinal) => "pdm",
                _ when code.StartsWith("CC-BY-SA", StringComparison.Ordinal) => "by-sa",
                _ when code.StartsWith("CC-BY", StringComparison.Ordinal) => "by",
                _ => null,
            };
            if (word is not null && !words.Contains(word))
            {
                words.Add(word);
            }
        }

        return string.Join(',', words);
    }

    // ------------------------------------------------------------------------------------------------ the credentials

    /// <summary>The header of a request: "Bearer token" when the administrator saved client credentials, else nothing (anonymous).</summary>
    private async Task<IReadOnlyDictionary<string, string>?> AuthAsync(CatalogContext ctx, CancellationToken ct)
    {
        var key = (ctx.Key ?? "").Trim();
        if (key.Length == 0)
        {
            return null;
        }

        var colon = key.IndexOf(':');
        if (colon <= 0 || colon == key.Length - 1)
        {
            throw new CatalogException("Die Zugangsdaten für Openverse müssen so aussehen: Client-ID:Client-Secret (mit einem Doppelpunkt dazwischen). Lass das Feld leer, um Openverse ohne Anmeldung zu nutzen.", CatalogFailure.Key);
        }

        var cacheKey = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(key)));
        var now = ctx.Biz.Now;
        if (_tokens.TryGetValue(cacheKey, out var known) && known.Until > now)
        {
            return new Dictionary<string, string> { ["Authorization"] = "Bearer " + known.Token };
        }

        await _tokenGate.WaitAsync(ct);
        try
        {
            if (_tokens.TryGetValue(cacheKey, out known) && known.Until > ctx.Biz.Now)
            {
                return new Dictionary<string, string> { ["Authorization"] = "Bearer " + known.Token };
            }

            return await RequestTokenAsync(ctx, cacheKey, key, colon, ct);
        }
        finally
        {
            _tokenGate.Release();
        }
    }

    private async Task<IReadOnlyDictionary<string, string>?> RequestTokenAsync(CatalogContext ctx, string cacheKey, string key, int colon, CancellationToken ct)
    {
        var now = ctx.Biz.Now;
        var form = new Dictionary<string, string> { ["grant_type"] = "client_credentials", ["client_id"] = key[..colon], ["client_secret"] = key[(colon + 1)..] };
        var answer = await ctx.PostFormAsync(new Uri(ctx.BaseUrl + "/v1/auth_tokens/token/"), form, ct);
        try
        {
            using var doc = JsonDocument.Parse(answer.Bytes);
            var token = ProviderSupport.Str(doc.RootElement, "access_token");
            var seconds = doc.RootElement.TryGetProperty("expires_in", out var e) && e.TryGetInt32(out var s) ? s : 3600;
            if (token.Length == 0 || token.Length > 2000 || token.Any(char.IsControl) || token.Contains(' '))
            {
                throw new CatalogException("Openverse hat kein Zugriffstoken geschickt. Prüfe die Zugangsdaten.", CatalogFailure.Key);
            }

            // a minute less than the provider says, so a token never runs out in the middle of a request
            _tokens[cacheKey] = (token, now.AddSeconds(Math.Clamp(seconds - 60, 30, 43200)));
            return new Dictionary<string, string> { ["Authorization"] = "Bearer " + token };
        }
        catch (JsonException)
        {
            throw new CatalogException("Openverse hat etwas geantwortet, das DesignThix nicht versteht.", CatalogFailure.Unavailable);
        }
    }

    public Task<IReadOnlyDictionary<string, string>?> ThumbHeadersAsync(CatalogContext ctx, CancellationToken ct) => AuthAsync(ctx, ct);

    // ------------------------------------------------------------------------------------------------ search

    public async Task<CatalogPage> SearchAsync(CatalogContext ctx, CatalogQuery query, CancellationToken ct)
    {
        var text = (query.Text ?? "").Trim();
        if (text.Length == 0)
        {
            return CatalogPage.Empty("Gib einen Suchbegriff ein.");
        }

        var per = Math.Clamp(query.PerPage, 1, AnonymousPageSize);
        var page = Math.Clamp(query.Page, 1, CatalogQuery.MaxPage);
        if (page * per > AnonymousDepth)
        {
            // Openverse shows the first 240 results of a query and refuses the next page
            return new CatalogPage([], page, per, null, false);
        }

        var headers = await AuthAsync(ctx, ct);
        var licences = LicenceParameter(ctx.Settings.AllowedLicences);
        var category = query.Kind switch
        {
            CatalogKinds.Photo => "&category=photograph",
            CatalogKinds.Illustration => "&category=illustration,digitized_artwork",
            _ => "",
        };
        var aspect = query.Orientation switch { "landscape" => "&aspect_ratio=wide", "portrait" => "&aspect_ratio=tall", "square" => "&aspect_ratio=square", _ => "" };
        var url = $"{ctx.BaseUrl}/v1/images/?q={Uri.EscapeDataString(text)}&license_type=commercial,modification"
                  + (licences.Length > 0 ? "&license=" + licences : "")
                  + category + aspect
                  + (ctx.Settings.SafeSearch ? "" : "&mature=true")
                  + $"&page={page.ToString(CultureInfo.InvariantCulture)}&page_size={per.ToString(CultureInfo.InvariantCulture)}";
        using var doc = JsonDocument.Parse(await ctx.GetTextAsync(new Uri(url), headers, TimeSpan.FromHours(24), ct));
        var items = new List<CatalogItem>();
        foreach (var e in ProviderSupport.Array(doc.RootElement, "results"))
        {
            if (ReadItem(ctx, e) is { } item)
            {
                items.Add(item);
            }
        }

        var total = ProviderSupport.Total(doc.RootElement, "result_count");
        var pages = ProviderSupport.Total(doc.RootElement, "page_count");
        var more = (pages is { } count ? page < count : items.Count >= per) && (page + 1) * per <= AnonymousDepth;
        return new CatalogPage(items, page, per, total is { } t ? Math.Min(t, AnonymousDepth) : null, more);
    }

    /// <summary>One result of Openverse, or null when its licence is not one that may be offered, its id is no id or it is sensitive content.</summary>
    private CatalogItem? ReadItem(CatalogContext ctx, JsonElement e)
    {
        var id = ProviderSupport.Str(e, "id").ToLowerInvariant();
        if (!ImageIdPattern().IsMatch(id))
        {
            return null;
        }

        var licence = ProviderSupport.Str(e, "license");
        var version = ProviderSupport.Str(e, "license_version");
        var code = LicenceCode(licence, version);
        if (code is null || !Allowed(code, ctx.Settings.AllowedLicences))
        {
            return null;
        }

        if (ctx.Settings.SafeSearch && e.TryGetProperty("mature", out var mature) && mature.ValueKind == JsonValueKind.True)
        {
            return null;
        }

        // the thumbnail is made by Openverse from the original, on Openverse's own host
        var thumb = ctx.Thumb($"{ctx.BaseUrl}/v1/images/{id}/thumb/");
        if (thumb.Length == 0)
        {
            return null;
        }

        var category = ProviderSupport.Str(e, "category");
        return new CatalogItem
        {
            Id = id,
            Kind = category is "illustration" or "digitized_artwork" ? CatalogKinds.Illustration : CatalogKinds.Photo,
            Title = ProviderSupport.Title(ProviderSupport.Str(e, "title"), "Bild"),
            Width = ProviderSupport.Int(e, "width"),
            Height = ProviderSupport.Int(e, "height"),
            Thumb = thumb,
            Author = CatalogLicences.Clean(ProviderSupport.Str(e, "creator"), 80),
            AuthorUrl = CatalogLicences.SafeUrl(ProviderSupport.Str(e, "creator_url")),
            SourceUrl = CatalogLicences.SafeUrl(ProviderSupport.Str(e, "foreign_landing_url")),
            Licence = CatalogLicences.Describe(code, LicenceName(licence, version), CatalogLicences.SafeUrl(ProviderSupport.Str(e, "license_url")), attribution: licence.ToLowerInvariant() is not ("cc0" or "pdm")),
        };
    }

    // ------------------------------------------------------------------------------------------------ the import

    public async Task<CatalogFetch> FetchAsync(CatalogContext ctx, string itemId, CancellationToken ct)
    {
        var id = (itemId ?? "").Trim().ToLowerInvariant();
        if (!ImageIdPattern().IsMatch(id))
        {
            throw new BizException("Das Bild gibt es nicht (mehr).");
        }

        var headers = await AuthAsync(ctx, ct);
        using var doc = JsonDocument.Parse(await ctx.GetTextAsync(new Uri($"{ctx.BaseUrl}/v1/images/{id}/"), headers, TimeSpan.FromHours(24), ct));
        var e = doc.RootElement;
        // the licence check again, by id: an item that is NC, ND or unknown cannot be imported even when its id is known
        var item = ReadItem(ctx, e) ?? throw new CatalogException("Dieses Bild darf nicht verwendet werden (Lizenz).", CatalogFailure.Refused);
        if (item.Id != id)
        {
            throw new BizException("Das Bild gibt es nicht (mehr).");
        }

        // full_size: the original through Openverse (a thumbnail would be 600 px); the address is built here, never taken from the answer
        var file = await ctx.DownloadAsync(new Uri($"{ctx.BaseUrl}/v1/images/{id}/thumb/?full_size=true"), headers, CatalogHttp.MaxDownloadBytes, ct);
        var source = CatalogLicences.Clean(ProviderSupport.Str(e, "source"), 40);
        var line = new StringBuilder("„").Append(item.Title).Append('“');
        if (item.Author.Length > 0)
        {
            line.Append(" von ").Append(item.Author);
        }

        line.Append(" (").Append(item.Licence?.Name).Append(')');
        if (source.Length > 0)
        {
            line.Append(", Quelle: ").Append(source).Append(" über Openverse");
        }

        return new CatalogFetch { Item = item, FileName = "openverse-" + id + ".img", Bytes = file.Bytes, Attribution = line.ToString() };
    }
}
