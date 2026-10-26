using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using DesignThix.Configuration;
using DesignThix.Core.Media;
using DesignThix.Logic;

namespace DesignThix.Catalogs.Providers;

/// <summary>
/// Iconify (docs/PLAN-CATALOGS.md section 4, facts verified 2026-10-26: see the "C3 status"): about 240 open-source icon sets behind one key-free API. The sets are the collections; the sets that are
/// offered are the ones the administrator lists (default: <see cref="DefaultSets"/>) whose licence is on the list of allowed licences (default MIT, Apache-2.0, ISC, CC0, CC BY 4.0, OFL: never a
/// share-alike or non-commercial set) and that are monochrome (<c>palette: false</c>). An icon is imported by storing its checked body (<see cref="IconBodies"/>), so a design with it draws offline
/// and never asks Iconify again; a design names it <c>prefix:name</c>.
/// <para>What the API answers: <c>/collections</c> (every set with author, licence and size), <c>/collection?prefix=</c> (the names of one set), <c>/search?query=&amp;prefixes=&amp;limit=&amp;start=</c> (names
/// as <c>prefix:name</c>) and <c>/{prefix}.json?icons=a,b</c> (the bodies, on the grid <c>width</c> x <c>height</c> of the set, 16 when the set says nothing).</para>
/// </summary>
public sealed partial class IconifyCatalog : ICatalog
{
    /// <summary>The sets offered unless the administrator names others: popular, monochrome, and licensed for any use.</summary>
    public static readonly IReadOnlyList<string> DefaultSets = ["tabler", "ph", "mdi", "material-symbols", "fa7-solid", "fa7-regular", "fa7-brands", "bi", "carbon", "heroicons", "ri", "solar", "iconoir"];

    private const int DefaultGrid = 16;

    public string Id => "iconify";

    public string Name => "Icons (Iconify)";

    public CatalogKinds Kinds => CatalogKinds.Icon;

    public CatalogCaps Caps => CatalogCaps.External | CatalogCaps.Browse | CatalogCaps.Search | CatalogCaps.Collections;

    public CatalogInfo Info { get; } = new(
        Homepage: "https://iconify.design",
        KeyHelpUrl: null,
        ProviderLink: null,
        LicenceSummary: "Jeder Icon-Satz hat seine eigene Lizenz. DesignThix bietet nur Sätze unter MIT, Apache 2.0, ISC, CC0, CC BY 4.0 und OFL an (kommerziell nutzbar und veränderbar, ohne Weitergabe unter gleichen Bedingungen). Bei CC BY, zum Beispiel Font Awesome Free, muss der Urheber genannt werden: DesignThix schreibt ihn in die Bildnachweise.",
        Description: "Über 200 offene Icon-Sätze, darunter Material Design, Tabler, Phosphor und Font Awesome Free.",
        DefaultPerUserPerMinute: 240,
        DefaultPerHour: 0,
        Notice: "Icons aus offenen Sätzen über Iconify. Was jemand benutzt, speichert DesignThix auf diesem Server; die Icons zeichnen sich danach ohne Internet.",
        Rules:
        [
            "Die öffentliche Schnittstelle von Iconify ist kostenlos und braucht keinen Schlüssel; sie hat Grenzen gegen Missbrauch und ist dafür gedacht, Icons bei Bedarf zu laden. DesignThix hält jede Antwort einen Tag im Zwischenspeicher und fragt nur für die Icons, die auf dem Bildschirm sind.",
            "Wer keine Grenzen will, betreibt einen eigenen Iconify-Server und trägt seine Adresse in der Konfiguration ein (DESIGNTHIX__Catalogs__iconify__BaseUrl); nie über diese Seite.",
            "Angeboten werden nur einfarbige Sätze, deren Lizenz kommerzielle Nutzung und Veränderung erlaubt und keine Weitergabe unter gleichen Bedingungen verlangt. Sätze unter CC BY-SA, GPL, MPL, NC oder ND und Sätze mit Farben gibt es nie.",
            "Icons, die mit Farbverläufen, Masken, Filtern, Transformationen oder Skripten gebaut sind, zeichnet DesignThix nicht und bietet sie nicht an. Animierte Icons erscheinen im Endzustand.",
            "Bei CC BY (zum Beispiel Font Awesome Free, Solar) steht der Satz mit Urheber und Lizenz in den Bildnachweisen des Designs und in der öffentlichen Ansicht.",
        ],
        HasLicenceChoice: true,
        KeyLabel: "",
        SetChoiceLabel: "Icon-Sets",
        SetChoiceHint: "Eine Kennung pro Zeile (zum Beispiel tabler, mdi, fa7-solid). Leer: die Standardauswahl. Es erscheinen nur Sätze, deren Lizenz oben erlaubt ist und die einfarbig sind.");

    public bool EnabledByDefault => false;

    public string? DefaultBaseUrl => "https://api.iconify.design";

    public IReadOnlyList<string> AllowedHosts => ["api.iconify.design"];

    public bool IsAvailable(ConfigStore config) => true;

    [GeneratedRegex("^[a-z0-9]+(?:-[a-z0-9]+)*$")]
    private static partial Regex WordPattern();

    private static bool IsPrefix(string? text) => text is { Length: > 0 and <= 40 } && WordPattern().IsMatch(text);

    private static bool IsName(string? text) => text is { Length: > 0 and <= 64 } && WordPattern().IsMatch(text);

    /// <summary>What the page of a set says: name, size, author and licence.</summary>
    private sealed record SetInfo(string Prefix, string Name, int Total, string Author, string AuthorUrl, string LicenceCode, string LicenceName, string LicenceUrl);

    // ------------------------------------------------------------------------------------------------ the sets

    /// <summary>The sets offered now: listed by the administrator (or the defaults), known to Iconify, monochrome, with an allowed licence; in the order of the list.</summary>
    private async Task<List<SetInfo>> SetsAsync(CatalogContext ctx, CancellationToken ct)
    {
        using var doc = JsonDocument.Parse(await ctx.GetTextAsync(new Uri(ctx.BaseUrl + "/collections"), null, TimeSpan.FromHours(24), ct));
        var wanted = ctx.Settings.Sets.Where(IsPrefix).Distinct(StringComparer.Ordinal).Take(60).ToList();
        if (wanted.Count == 0)
        {
            wanted = [.. DefaultSets];
        }

        var list = new List<SetInfo>();
        if (doc.RootElement.ValueKind != JsonValueKind.Object)
        {
            return list;
        }

        foreach (var prefix in wanted)
        {
            if (!doc.RootElement.TryGetProperty(prefix, out var e) || e.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            // a set with colours of its own is not monochrome: it cannot take the colour of the icon element
            if (e.TryGetProperty("palette", out var palette) && palette.ValueKind == JsonValueKind.True)
            {
                continue;
            }

            var licence = e.TryGetProperty("license", out var l) && l.ValueKind == JsonValueKind.Object ? l : default;
            var code = ProviderSupport.Str(licence, "spdx");
            if (!CatalogLicences.Allowed(code, ctx.Settings.AllowedLicences, CatalogLicences.DefaultAllowed))
            {
                continue;
            }

            var author = e.TryGetProperty("author", out var a) && a.ValueKind == JsonValueKind.Object ? a : default;
            var total = ProviderSupport.Total(e, "total") ?? 0;
            if (total == 0)
            {
                continue;
            }

            list.Add(new SetInfo(prefix, ProviderSupport.Title(ProviderSupport.Str(e, "name"), prefix), total, CatalogLicences.Clean(ProviderSupport.Str(author, "name"), 80),
                CatalogLicences.SafeUrl(ProviderSupport.Str(author, "url")), code, CatalogLicences.Clean(ProviderSupport.Str(licence, "title"), 60), CatalogLicences.SafeUrl(ProviderSupport.Str(licence, "url"))));
        }

        return list;
    }

    public async Task<IReadOnlyList<CatalogCollection>> CollectionsAsync(CatalogContext ctx, CancellationToken ct)
        => [.. (await SetsAsync(ctx, ct)).Select(s => new CatalogCollection(s.Prefix, s.Name, s.Total))];

    // ------------------------------------------------------------------------------------------------ search and browse

    public async Task<CatalogPage> SearchAsync(CatalogContext ctx, CatalogQuery query, CancellationToken ct)
    {
        var sets = await SetsAsync(ctx, ct);
        var text = (query.Text ?? "").Trim();
        var collection = (query.Collection ?? "").Trim();
        if (sets.Count == 0)
        {
            return CatalogPage.Empty("Es ist kein Icon-Satz freigegeben. Frag eine Administratorin oder einen Administrator.");
        }

        if (collection.Length > 0 && sets.All(s => s.Prefix != collection))
        {
            return CatalogPage.Empty();
        }

        var page = Math.Clamp(query.Page, 1, CatalogQuery.MaxPage);
        var per = Math.Clamp(query.PerPage, 32, CatalogQuery.MaxPerPage);
        if (text.Length == 0)
        {
            return collection.Length == 0 ? CatalogPage.Empty("Wähle einen Icon-Satz oder gib einen Suchbegriff ein.") : await BrowseAsync(ctx, sets.First(s => s.Prefix == collection), page, per, ct);
        }

        var scope = collection.Length > 0 ? "&prefix=" + collection : "&prefixes=" + string.Join(',', sets.Select(s => s.Prefix));
        var url = $"{ctx.BaseUrl}/search?query={Uri.EscapeDataString(text)}&limit={per.ToString(CultureInfo.InvariantCulture)}&start={((page - 1) * per).ToString(CultureInfo.InvariantCulture)}{scope}";
        using var doc = JsonDocument.Parse(await ctx.GetTextAsync(new Uri(url), null, TimeSpan.FromHours(24), ct));
        var names = new List<(string Prefix, string Name)>();
        foreach (var n in ProviderSupport.Array(doc.RootElement, "icons"))
        {
            var full = n.ValueKind == JsonValueKind.String ? n.GetString() ?? "" : "";
            var colon = full.IndexOf(':');
            if (colon > 0 && IsPrefix(full[..colon]) && IsName(full[(colon + 1)..]) && sets.Any(s => s.Prefix == full[..colon]))
            {
                names.Add((full[..colon], full[(colon + 1)..]));
            }
        }

        var returned = ProviderSupport.Array(doc.RootElement, "icons").Count();
        var items = await ItemsAsync(ctx, sets, names, ct);
        return new CatalogPage(items, page, per, null, returned >= per && page < CatalogQuery.MaxPage);
    }

    /// <summary>The icons of one set, alphabetical, a page at a time.</summary>
    private async Task<CatalogPage> BrowseAsync(CatalogContext ctx, SetInfo set, int page, int per, CancellationToken ct)
    {
        using var doc = JsonDocument.Parse(await ctx.GetTextAsync(new Uri($"{ctx.BaseUrl}/collection?prefix={set.Prefix}"), null, TimeSpan.FromHours(24), ct));
        var all = new HashSet<string>(StringComparer.Ordinal);
        foreach (var n in ProviderSupport.AllStrings(doc.RootElement, "uncategorized"))
        {
            all.Add(n);
        }

        if (doc.RootElement.ValueKind == JsonValueKind.Object && doc.RootElement.TryGetProperty("categories", out var categories) && categories.ValueKind == JsonValueKind.Object)
        {
            foreach (var category in categories.EnumerateObject())
            {
                foreach (var n in ProviderSupport.AllStrings(categories, category.Name))
                {
                    all.Add(n);
                }
            }
        }

        foreach (var hidden in ProviderSupport.AllStrings(doc.RootElement, "hidden"))
        {
            all.Remove(hidden);
        }

        var ordered = all.Where(IsName).OrderBy(n => n, StringComparer.Ordinal).ToList();
        var slice = ordered.Skip((page - 1) * per).Take(per).Select(n => (set.Prefix, n)).ToList();
        var items = await ItemsAsync(ctx, [set], slice, ct);
        return new CatalogPage(items, page, per, ordered.Count, page * per < ordered.Count && page < CatalogQuery.MaxPage);
    }

    /// <summary>The tiles for these names: the bodies come from one request per set; an icon whose body the allowlist refuses is not offered.</summary>
    private async Task<List<CatalogItem>> ItemsAsync(CatalogContext ctx, List<SetInfo> sets, List<(string Prefix, string Name)> names, CancellationToken ct)
    {
        var items = new List<CatalogItem>();
        var bodies = new Dictionary<string, IconBodyParsed>(StringComparer.Ordinal);
        foreach (var group in names.GroupBy(n => n.Prefix, StringComparer.Ordinal))
        {
            foreach (var found in await BodiesAsync(ctx, group.Key, group.Select(n => n.Name).Distinct(StringComparer.Ordinal).ToList(), ct))
            {
                bodies[group.Key + ":" + found.Key] = found.Value;
            }
        }

        foreach (var (prefix, name) in names)
        {
            if (bodies.TryGetValue(prefix + ":" + name, out var body) && sets.FirstOrDefault(s => s.Prefix == prefix) is { } set)
            {
                items.Add(ItemOf(set, name, body));
            }
        }

        return items;
    }

    private static CatalogItem ItemOf(SetInfo set, string name, IconBodyParsed body)
        => new()
        {
            Id = set.Prefix + ":" + name,
            Kind = CatalogKinds.Icon,
            Title = name.Replace('-', ' '),
            Width = body.Width,
            Height = body.Height,
            Author = set.Author,
            AuthorUrl = set.AuthorUrl,
            SourceUrl = $"https://icon-sets.iconify.design/{set.Prefix}/{name}/",
            Licence = CatalogLicences.Describe(set.LicenceCode, set.LicenceName.Length > 0 ? set.LicenceName : set.LicenceCode, set.LicenceUrl, attribution: CatalogLicences.Normalize(set.LicenceCode).StartsWith("CC-BY", StringComparison.Ordinal)),
            IconName = set.Prefix + ":" + name,
            Collection = set.Name,
            Icon = new CatalogIcon(body.Markup, body.Width, body.Height),
        };

    /// <summary>The checked bodies of these icons of one set (the ones the provider has and the allowlist accepts).</summary>
    private static async Task<Dictionary<string, IconBodyParsed>> BodiesAsync(CatalogContext ctx, string prefix, List<string> names, CancellationToken ct)
    {
        var result = new Dictionary<string, IconBodyParsed>(StringComparer.Ordinal);
        if (names.Count == 0)
        {
            return result;
        }

        var url = $"{ctx.BaseUrl}/{prefix}.json?icons={string.Join(',', names.Where(IsName))}";
        using var doc = JsonDocument.Parse(await ctx.GetTextAsync(new Uri(url), null, TimeSpan.FromHours(24), ct));
        var root = doc.RootElement;
        if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty("icons", out var icons) || icons.ValueKind != JsonValueKind.Object)
        {
            return result;
        }

        var setWidth = Dimension(root, "width") ?? DefaultGrid;
        var setHeight = Dimension(root, "height") ?? DefaultGrid;
        foreach (var name in names)
        {
            if (!icons.TryGetProperty(name, out var e) || e.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            // an icon with an offset or a flip of its own would need a transform the allowlist does not have
            if (Dimension(e, "left") is not (null or 0) || Dimension(e, "top") is not (null or 0) || Truthy(e, "hFlip") || Truthy(e, "vFlip") || (Dimension(e, "rotate") is not (null or 0)))
            {
                continue;
            }

            var parsed = IconBodies.Parse(ProviderSupport.Str(e, "body"), Dimension(e, "width") ?? setWidth, Dimension(e, "height") ?? setHeight, out _);
            if (parsed is not null)
            {
                result[name] = parsed;
            }
        }

        return result;
    }

    private static int? Dimension(JsonElement e, string name)
        => e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetDouble(out var n) && n is >= 0 and <= IconBodies.MaxDimension ? (int)Math.Round(n) : null;

    private static bool Truthy(JsonElement e, string name) => e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.True;

    // ------------------------------------------------------------------------------------------------ the import

    public async Task<CatalogFetch> FetchAsync(CatalogContext ctx, string itemId, CancellationToken ct)
    {
        var text = (itemId ?? "").Trim();
        var colon = text.IndexOf(':');
        if (colon <= 0 || !IsPrefix(text[..colon]) || !IsName(text[(colon + 1)..]))
        {
            throw new BizException("Das Icon gibt es nicht (mehr).");
        }

        var prefix = text[..colon];
        var name = text[(colon + 1)..];
        // the set must be one this installation offers (its licence is checked there, so a crafted id of another set never gets this far)
        var set = (await SetsAsync(ctx, ct)).FirstOrDefault(s => s.Prefix == prefix) ?? throw new BizException("Dieser Icon-Satz ist hier nicht freigegeben.");
        var bodies = await BodiesAsync(ctx, prefix, [name], ct);
        if (!bodies.TryGetValue(name, out var body))
        {
            throw new BizException("Dieses Icon gibt es nicht (mehr) oder DesignThix kann es nicht zeichnen.");
        }

        var item = ItemOf(set, name, body);
        var by = set.Author.Length > 0 ? $", {set.Author}" : "";
        return new CatalogFetch
        {
            Item = item,
            Icon = body,
            FileName = prefix + "-" + name + ".svg",
            Attribution = CatalogLicences.Clean($"Icon „{name}“ aus {set.Name}{by} ({item.Licence!.Name}), über Iconify", 300),
        };
    }
}
