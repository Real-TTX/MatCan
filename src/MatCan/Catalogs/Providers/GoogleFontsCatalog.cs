using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using MatCan.Configuration;
using MatCan.Core.Media;
using MatCan.Logic;

namespace MatCan.Catalogs.Providers;

/// <summary>
/// The fonts of Google Fonts (docs/PLAN-CATALOGS.md section 4, decision and facts in the "C3 status"). The Google Fonts Developer API needs a key and says nothing about the licence of a family, so the
/// catalogue reads the key-free metadata of <b>Fontsource</b> (<c>api.fontsource.org/v1/fonts</c>), which mirrors the fonts of the google/fonts repository with their licence (<c>type: google</c>, <c>license</c>:
/// OFL-1.1, Apache-2.0, UFL-1.0 ...), and takes the files from its CDN (<c>cdn.jsdelivr.net/fontsource/fonts/&lt;id&gt;@latest/latin-400-normal.woff2</c>). Only families under OFL, Apache or the Ubuntu
/// font licence are offered. The import adds the regular, bold, italic and bold-italic faces (the Latin subset, which covers German) as fonts of the area, so a design prints without the internet.
/// <para>The address of a file is built here from the id and the weight, never taken from an answer or from the browser; the test base address of the operator serves the files under <c>/files</c>.</para>
/// </summary>
public sealed partial class GoogleFontsCatalog : ICatalog
{
    private const string DefaultFiles = "https://cdn.jsdelivr.net/fontsource/fonts";

    public static readonly IReadOnlyList<string> DefaultLicences = ["OFL-1.1", "Apache-2.0", "UFL-1.0"];

    private static readonly (string Id, string Name)[] Categories =
    [
        ("sans-serif", "Serifenlos"), ("serif", "Serif"), ("display", "Display"), ("handwriting", "Handschrift"), ("monospace", "Monospace"),
    ];

    public string Id => "googlefonts";

    public string Name => "Google Fonts";

    public CatalogKinds Kinds => CatalogKinds.Font;

    public CatalogCaps Caps => CatalogCaps.External | CatalogCaps.Browse | CatalogCaps.Search | CatalogCaps.Collections;

    public CatalogInfo Info { get; } = new(
        Homepage: "https://fonts.google.com",
        KeyHelpUrl: null,
        ProviderLink: new CatalogLink("Schriften von Google Fonts", "https://fonts.google.com"),
        LicenceSummary: "Die Schriften stehen unter der SIL Open Font License, der Apache-Lizenz oder der Ubuntu-Font-Lizenz: Sie dürfen in Designs und gedruckt kommerziell genutzt werden. Die Schrift selbst darf nicht für sich allein verkauft werden.",
        Description: "Über 1 900 freie Schriften aus Google Fonts, als Dateien auf diesem Server gespeichert.",
        DefaultPerUserPerMinute: 120,
        DefaultPerHour: 0,
        Notice: "Schriften von Google Fonts. Was jemand hinzufügt, speichert MatCan auf diesem Server; gedruckt und im Editor wird nichts aus dem Internet geladen.",
        Rules:
        [
            "MatCan liest die Liste und die Dateien der Schriften nicht bei Google, sondern bei Fontsource (api.fontsource.org und cdn.jsdelivr.net), das die Schriften des Google-Fonts-Archivs mit ihrer Lizenz bereitstellt und keinen Schlüssel verlangt. Fontsource erlaubt 2 500 Anfragen in 10 Sekunden; MatCan hält jede Antwort einen Tag im Zwischenspeicher.",
            "Es gibt nur Schriften unter OFL, Apache oder Ubuntu-Font-Lizenz. Die Dateien dürfen eingebettet und weitergegeben werden, solange sie nicht allein verkauft werden.",
            "Hinzugefügt werden die normale, die fette und (falls vorhanden) die kursive Variante mit den lateinischen Zeichen (alle deutschen Umlaute, Euro- und Anführungszeichen). Eine Schrift, die nur andere Schriftsysteme hat, gibt es hier nicht.",
        ],
        HasLicenceChoice: true,
        KeyLabel: "");

    public bool EnabledByDefault => false;

    public string? DefaultBaseUrl => "https://api.fontsource.org";

    public IReadOnlyList<string> AllowedHosts => ["api.fontsource.org", "cdn.jsdelivr.net"];

    public bool IsAvailable(ConfigStore config) => true;

    [GeneratedRegex("^[a-z0-9]+(?:-[a-z0-9]+)*$")]
    private static partial Regex IdPattern();

    private static bool IsId(string? text) => text is { Length: > 0 and <= 80 } && IdPattern().IsMatch(text);

    /// <summary>One family as the list of Fontsource describes it.</summary>
    private sealed record FamilyInfo(string Id, string Family, string Category, string Licence, int[] Weights, bool Italic);

    /// <summary>Where the files are: the CDN of Fontsource, or (a test installation with an address of its own) below that address.</summary>
    private string FilesBase(CatalogContext ctx) => string.Equals(ctx.BaseUrl.TrimEnd('/'), DefaultBaseUrl, StringComparison.OrdinalIgnoreCase) ? DefaultFiles : ctx.BaseUrl.TrimEnd('/') + "/files";

    private async Task<List<FamilyInfo>> FamiliesAsync(CatalogContext ctx, CancellationToken ct)
    {
        using var doc = JsonDocument.Parse(await ctx.GetTextAsync(new Uri(ctx.BaseUrl + "/v1/fonts"), null, TimeSpan.FromHours(24), ct));
        var list = new List<FamilyInfo>();
        if (doc.RootElement.ValueKind != JsonValueKind.Array)
        {
            return list;
        }

        foreach (var e in doc.RootElement.EnumerateArray().Take(10_000))
        {
            var id = ProviderSupport.Str(e, "id");
            var licence = ProviderSupport.Str(e, "license");
            if (!IsId(id) || ProviderSupport.Str(e, "type") != "google" || !CatalogLicences.Allowed(licence, ctx.Settings.AllowedLicences, DefaultLicences))
            {
                continue;
            }

            var subsets = ProviderSupport.AllStrings(e, "subsets").ToList();
            var styles = ProviderSupport.AllStrings(e, "styles").ToList();
            var weights = e.TryGetProperty("weights", out var w) && w.ValueKind == JsonValueKind.Array
                ? w.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.Number && x.TryGetInt32(out var n) && n is >= 100 and <= 900 && n % 100 == 0).Select(x => x.GetInt32()).Distinct().Order().ToArray()
                : [];
            var family = FontLogic.CssName(CatalogLicences.Clean(ProviderSupport.Str(e, "family"), 100));
            if (!subsets.Contains("latin") || !styles.Contains("normal") || weights.Length == 0 || family.Length == 0)
            {
                continue;
            }

            list.Add(new FamilyInfo(id, family, ProviderSupport.Str(e, "category"), licence, weights, styles.Contains("italic")));
        }

        return list.OrderBy(f => f.Family, StringComparer.OrdinalIgnoreCase).ToList();
    }

    public Task<IReadOnlyList<CatalogCollection>> CollectionsAsync(CatalogContext ctx, CancellationToken ct)
        => Task.FromResult<IReadOnlyList<CatalogCollection>>([.. Categories.Select(c => new CatalogCollection(c.Id, c.Name))]);

    public async Task<CatalogPage> SearchAsync(CatalogContext ctx, CatalogQuery query, CancellationToken ct)
    {
        var text = (query.Text ?? "").Trim();
        var collection = (query.Collection ?? "").Trim();
        if (collection.Length > 0 && Categories.All(c => c.Id != collection))
        {
            return CatalogPage.Empty();
        }

        var matches = (await FamiliesAsync(ctx, ct))
            .Where(f => collection.Length == 0 || f.Category == collection)
            .Where(f => text.Length == 0 || f.Family.Contains(text, StringComparison.OrdinalIgnoreCase) || f.Id.Contains(text.Replace(' ', '-'), StringComparison.OrdinalIgnoreCase))
            .ToList();
        var page = Math.Clamp(query.Page, 1, CatalogQuery.MaxPage);
        var per = Math.Clamp(query.PerPage, 1, CatalogQuery.MaxPerPage);
        var items = new List<CatalogItem>();
        foreach (var f in matches.Skip((page - 1) * per).Take(per))
        {
            items.Add(ItemOf(ctx, f));
        }

        return new CatalogPage(items, page, per, matches.Count, page * per < matches.Count && page < CatalogQuery.MaxPage);
    }

    private CatalogItem ItemOf(CatalogContext ctx, FamilyInfo f)
    {
        var preview = Closest(f.Weights, 400);
        return new CatalogItem
        {
            Id = f.Id,
            Kind = CatalogKinds.Font,
            Title = f.Family,
            Thumb = ctx.Thumb(FileUrl(ctx, f.Id, preview, "normal")),
            Author = "Google Fonts",
            AuthorUrl = "https://fonts.google.com",
            SourceUrl = "https://fonts.google.com/specimen/" + Uri.EscapeDataString(f.Family).Replace("%20", "+", StringComparison.Ordinal),
            Licence = LicenceOf(f.Licence),
            FontFamily = f.Family,
        };
    }

    private static CatalogLicence LicenceOf(string code)
    {
        var n = CatalogLicences.Normalize(code);
        return n.StartsWith("OFL", StringComparison.Ordinal) ? CatalogLicences.Describe(code, "SIL Open Font License 1.1", "https://openfontlicense.org", attribution: false)
            : n.StartsWith("APACHE", StringComparison.Ordinal) ? CatalogLicences.Describe(code, "Apache License 2.0", "https://www.apache.org/licenses/LICENSE-2.0", attribution: false)
            : n.StartsWith("UFL", StringComparison.Ordinal) ? CatalogLicences.Describe(code, "Ubuntu Font Licence 1.0", "https://ubuntu.com/legal/font-licence", attribution: false)
            : CatalogLicences.Describe(code, null, null, attribution: false);
    }

    private static int Closest(int[] weights, int target) => weights.OrderBy(w => Math.Abs(w - target)).ThenBy(w => w).First();

    private string FileUrl(CatalogContext ctx, string id, int weight, string style)
        => $"{FilesBase(ctx)}/{id}@latest/latin-{weight.ToString(CultureInfo.InvariantCulture)}-{style}.woff2";

    /// <summary>The faces the import adds: the regular and the bold weight, each also in italic when the family has one (at most four).</summary>
    internal static List<(int Weight, string Style)> Faces(int[] weights, bool italic)
    {
        var regular = Closest(weights, 400);
        var bolds = weights.Where(w => w >= 600 && w != regular).ToArray();
        var list = new List<(int, string)> { (regular, "normal") };
        var bold = bolds.Length > 0 ? Closest(bolds, 700) : 0;
        if (bold > 0)
        {
            list.Add((bold, "normal"));
        }

        if (italic)
        {
            list.Add((regular, "italic"));
            if (bold > 0)
            {
                list.Add((bold, "italic"));
            }
        }

        return list;
    }

    public async Task<CatalogFetch> FetchAsync(CatalogContext ctx, string itemId, CancellationToken ct)
    {
        var id = (itemId ?? "").Trim();
        if (!IsId(id))
        {
            throw new BizException("Die Schrift gibt es nicht (mehr).");
        }

        // the family must be one the list shows now (licence and Latin letters checked there): a crafted id downloads nothing
        var family = (await FamiliesAsync(ctx, ct)).FirstOrDefault(f => f.Id == id) ?? throw new CatalogException("Diese Schrift gibt es bei Google Fonts nicht (mehr) oder sie ist hier nicht freigegeben.", CatalogFailure.NotFound);
        var files = new List<CatalogFontFile>();
        foreach (var (weight, style) in Faces(family.Weights, family.Italic))
        {
            var url = new Uri(FileUrl(ctx, id, weight, style));
            // a face a provider does not have (an italic that is listed but missing) is left out; the regular face must be there
            try
            {
                var result = await ctx.DownloadAsync(url, null, FontLogic.MaxFontBytes, ct);
                files.Add(new CatalogFontFile($"{id}-{weight}-{style}.woff2", result.Bytes, weight.ToString(CultureInfo.InvariantCulture), style));
            }
            catch (CatalogException ex) when (ex.Failure == CatalogFailure.NotFound && files.Count > 0)
            {
            }
        }

        return new CatalogFetch { Item = ItemOf(ctx, family), FontFamily = family.Family, FontFiles = files, FileName = id + ".woff2" };
    }
}
