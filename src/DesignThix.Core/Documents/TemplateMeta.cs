using System.Text.RegularExpressions;

namespace DesignThix.Core.Documents;

/// <summary>
/// The metadata of a built-in template (plan 6, docs/PLAN-TEMPLATES.md section 2): the occasion from a fixed list, the German search words, the family slug and the
/// format key. Pure functions, so the seeder, the gallery and the tests agree on what is valid.
/// </summary>
public static partial class TemplateMeta
{
    /// <summary>The fixed list of occasions: the navigation of the gallery of templates. Do not change the spelling, files and the database carry these words.</summary>
    public static IReadOnlyList<string> Occasions { get; } =
    [
        "Geburtstag", "Hochzeit", "Kinder & Familie", "Feiertage", "Feste & Events", "Trauer", "Business", "Gastronomie", "Verein & Schule", "Handel & Preise", "Social Media", "Formulare & Planer",
    ];

    public const int MaxTags = 30;
    public const int MaxTagLength = 40;

    [GeneratedRegex("^[a-z0-9][a-z0-9-]{0,63}\\z", RegexOptions.CultureInvariant)]
    private static partial Regex SlugPattern();

    /// <summary>The occasion as the list spells it (case-insensitive match), or null when it is none of them.</summary>
    public static string? OccasionOf(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : Occasions.FirstOrDefault(o => string.Equals(o, value.Trim(), StringComparison.OrdinalIgnoreCase));

    /// <summary>A family slug: lower case letters, digits and hyphens, at most 64 characters.</summary>
    public static bool IsSlug(string? value) => value is not null && SlugPattern().IsMatch(value);

    /// <summary>The search words cleaned: trimmed, no commas or control characters, at most 40 characters each and 30 in all, no duplicates (case-insensitive), order kept.</summary>
    public static IReadOnlyList<string> CleanTags(IEnumerable<string?>? tags)
    {
        var result = new List<string>();
        foreach (var raw in tags ?? [])
        {
            var tag = new string([.. (raw ?? "").Where(c => !char.IsControl(c) && c != ',')]).Trim();
            if (tag.Length > MaxTagLength)
            {
                tag = tag[..MaxTagLength].Trim();
            }

            if (tag.Length > 0 && !result.Contains(tag, StringComparer.OrdinalIgnoreCase))
            {
                result.Add(tag);
            }

            if (result.Count >= MaxTags)
            {
                break;
            }
        }

        return result;
    }

    /// <summary>The tags as one stored text (comma separated), or null for none.</summary>
    public static string? JoinTags(IEnumerable<string?>? tags)
    {
        var clean = CleanTags(tags);
        return clean.Count == 0 ? null : string.Join(", ", clean);
    }

    /// <summary>The stored text as a list again.</summary>
    public static IReadOnlyList<string> SplitTags(string? stored)
        => string.IsNullOrWhiteSpace(stored) ? [] : [.. stored.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)];
}
