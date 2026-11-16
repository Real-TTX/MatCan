using System.Globalization;
using System.Text;
using MatCan.Core.Documents;
using Microsoft.EntityFrameworkCore;

namespace MatCan.Logic;

/// <summary>
/// The variants of one kind of template (plan 6): "Geburtstagskarte" in the styles Klassisch, Modern, Verspielt. A template without a family is a family of one (its key is <c>t&lt;id&gt;</c>).
/// <see cref="Variants"/> is sorted by <c>TemplateOrder</c>, then id; the first one is the one the tile shows.
/// </summary>
public sealed record TemplateFamilyRow(string Key, string Name, string? Occasion, string? Category, IReadOnlyList<DesignRow> Variants)
{
    public DesignRow First => Variants[0];

    /// <summary>The words the search looks at (already folded: see <see cref="TemplateLogic.Fold"/>).</summary>
    internal string Haystack { get; init; } = "";
}

/// <summary>What the gallery narrows by: the occasion, the format key, the search text. Anything blank is "all".</summary>
public sealed record TemplateFilter(string? Occasion = null, string? Format = null, string? Query = null);

/// <summary>An entry of a filter list with its count of families ("Hochzeit (14)"); <paramref name="Group"/> is the group of a format.</summary>
public sealed record TemplateFacet(string Key, string Name, int Count, string? Group = null);

/// <summary>One page of the gallery: the families of the page, how many there are in all (for the filter), and the lists for the filters, counted with the other filter applied.</summary>
public sealed record TemplateGallery(int Total, int Templates, IReadOnlyList<TemplateFamilyRow> Families, IReadOnlyList<TemplateFacet> Occasions, IReadOnlyList<TemplateFacet> Formats);

/// <summary>The gallery of templates: families, occasions, formats, search (docs/PLAN-TEMPLATES.md section 2). The person sees the templates of the platform and of their own areas, as before.</summary>
public static class TemplateLogic
{
    public const int PageSize = 24;
    public const int MaxPageSize = 60;

    /// <summary>
    /// Lower case without accents, umlauts as their base letter (ä to a, ß to ss): "grusskarte" finds "Grußkarte", "kinder" finds "Kinder &amp; Familie". The JS twin is <c>D.fold</c> of the designer.
    /// </summary>
    public static string Fold(string? text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return "";
        }

        var decomposed = text.ToLowerInvariant().Replace("ß", "ss", StringComparison.Ordinal).Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(decomposed.Length);
        foreach (var c in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
            {
                sb.Append(c);
            }
        }

        return sb.ToString().Normalize(NormalizationForm.FormC);
    }

    /// <summary>All the templates the person may use as families, in the order of the gallery: by occasion (the order of the list, none last), then the number of the family's first file, then the name.</summary>
    public static async Task<List<TemplateFamilyRow>> FamiliesAsync(Biz biz)
    {
        biz.RequireSignedIn();
        var rows = await DesignLogic.TemplateQuery(biz).ToListAsync();
        return Group(rows);
    }

    /// <summary>Groups template rows into families (see <see cref="TemplateFamilyRow"/>) and orders them.</summary>
    public static List<TemplateFamilyRow> Group(IEnumerable<DesignRow> rows)
    {
        var families = rows
            .GroupBy(d => string.IsNullOrEmpty(d.TemplateFamily) ? "t" + d.Id.ToString(CultureInfo.InvariantCulture) : d.TemplateFamily!)
            .Select(g =>
            {
                var variants = g.OrderBy(d => d.TemplateOrder).ThenBy(d => d.Id).Select(d => d with { Variants = g.Count() }).ToList();
                var first = variants[0];
                var name = string.IsNullOrWhiteSpace(first.TemplateFamilyName) ? first.Name : first.TemplateFamilyName!;
                var haystack = Fold(string.Join(' ', new[] { name, first.Category, first.TemplateOccasion }.Concat(variants.SelectMany(v => new[] { v.Name, v.TemplateVariant, v.Description, v.TemplateTags }))));
                return new TemplateFamilyRow(g.Key, name, first.TemplateOccasion, first.Category, variants) { Haystack = haystack };
            })
            .ToList();
        var occasionOrder = TemplateMeta.Occasions.ToList();
        int Rank(string? occasion) => occasion is null ? int.MaxValue : occasionOrder.IndexOf(occasion) is var i and >= 0 ? i : int.MaxValue - 1;
        return [.. families.OrderBy(f => Rank(f.Occasion)).ThenBy(f => f.First.TemplateOrder == 0 ? int.MaxValue : f.First.TemplateOrder).ThenBy(f => f.Name, StringComparer.CurrentCultureIgnoreCase).ThenBy(f => f.First.Id)];
    }

    /// <summary>The family that holds the template (null when the person may not see it or it is no template).</summary>
    public static async Task<TemplateFamilyRow?> FamilyOfAsync(Biz biz, long templateId)
        => (await FamiliesAsync(biz)).FirstOrDefault(f => f.Variants.Any(v => v.Id == templateId));

    private static bool MatchesQuery(TemplateFamilyRow family, string[] words) => words.All(w => family.Haystack.Contains(w, StringComparison.Ordinal));

    private static bool MatchesFormat(TemplateFamilyRow family, string? format) => string.IsNullOrEmpty(format) || family.Variants.Any(v => string.Equals(v.TemplateFormat, format, StringComparison.OrdinalIgnoreCase));

    /// <summary>The occasion filter: empty = all, <see cref="NoOccasion"/> = the templates without one (the chip "Weitere"), else the occasion.</summary>
    private static bool MatchesOccasion(TemplateFamilyRow family, string? occasion)
        => string.IsNullOrEmpty(occasion) || (occasion == NoOccasion ? family.Occasion is null : string.Equals(family.Occasion, occasion, StringComparison.OrdinalIgnoreCase));

    /// <summary>The key of the filter entry for templates that have no occasion.</summary>
    public const string NoOccasion = "none";

    /// <summary>The families that fit the filter, then a page of them (<paramref name="skip"/>, <paramref name="take"/>).</summary>
    public static async Task<TemplateGallery> GalleryAsync(Biz biz, TemplateFilter filter, int skip = 0, int take = PageSize)
    {
        var all = await FamiliesAsync(biz);
        return Gallery(all, filter, skip, take);
    }

    public static TemplateGallery Gallery(IReadOnlyList<TemplateFamilyRow> all, TemplateFilter filter, int skip, int take)
    {
        var query = (filter.Query ?? "").Trim();
        if (query.Length > 100)
        {
            query = query[..100];
        }

        var words = Fold(query).Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var occasion = filter.Occasion == NoOccasion ? NoOccasion : TemplateMeta.OccasionOf(filter.Occasion);
        var format = string.IsNullOrWhiteSpace(filter.Format) ? null : FormatPresets.Find(filter.Format.Trim())?.Key;
        var searched = all.Where(f => MatchesQuery(f, words)).ToList();

        var matching = searched.Where(f => MatchesOccasion(f, occasion) && MatchesFormat(f, format)).ToList();

        // the counts of the filter lists: each is counted with the OTHER filter applied, so a click never leads to an empty page
        var occasions = TemplateMeta.Occasions
            .Select(o => new TemplateFacet(o, o, searched.Count(f => string.Equals(f.Occasion, o, StringComparison.OrdinalIgnoreCase) && MatchesFormat(f, format))))
            .Where(f => f.Count > 0)
            .ToList();
        var other = searched.Count(f => f.Occasion is null && MatchesFormat(f, format));
        if (other > 0)
        {
            occasions.Add(new TemplateFacet(NoOccasion, "Weitere", other));
        }

        var formatKeys = searched.Where(f => MatchesOccasion(f, occasion)).SelectMany(f => f.Variants.Select(v => v.TemplateFormat).Where(k => !string.IsNullOrEmpty(k)).Distinct(StringComparer.OrdinalIgnoreCase).Select(k => (Family: f, Key: k!)))
            .GroupBy(x => x.Key, StringComparer.OrdinalIgnoreCase)
            .Select(g => (Preset: FormatPresets.Find(g.Key), Key: g.Key, Count: g.Select(x => x.Family.Key).Distinct().Count()))
            .Where(x => x.Preset is not null)
            .OrderBy(x => FormatPresets.All.ToList().FindIndex(p => p.Key == x.Preset!.Key))
            .Select(x => new TemplateFacet(x.Preset!.Key, x.Preset.ShortName, x.Count, x.Preset.Group))
            .ToList();

        var size = Math.Clamp(take, 1, MaxPageSize);
        var page = matching.Skip(Math.Max(0, skip)).Take(size).ToList();
        return new TemplateGallery(matching.Count, all.Sum(f => f.Variants.Count), page, occasions, formatKeys);
    }

    /// <summary>
    /// The row on the start page: one template per family (the first variant, with its number of variants), the first of each occasion, then the second of each, and so on, so the row shows the variety.
    /// </summary>
    public static async Task<List<DesignRow>> FeaturedAsync(Biz biz, int take)
    {
        var families = await FamiliesAsync(biz);
        var groups = families.GroupBy(f => f.Occasion ?? f.Category ?? "").Select(g => g.ToList()).ToList();
        var picked = new List<DesignRow>();
        for (var round = 0; picked.Count < take && groups.Any(g => g.Count > round); round++)
        {
            foreach (var group in groups.Where(g => g.Count > round))
            {
                if (picked.Count < take)
                {
                    picked.Add(group[round].First);
                }
            }
        }

        return picked;
    }
}
