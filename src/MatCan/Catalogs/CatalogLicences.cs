using System.Text;

namespace MatCan.Catalogs;

/// <summary>
/// Licences in code (docs/PLAN-CATALOGS.md section 1, principle 6): which licences a catalogue may let through. Designs change pictures and may be used commercially, so items with a
/// non-commercial (NC) or no-derivatives (ND) licence are never offered, and an item whose licence is unknown is not either.
/// </summary>
public static class CatalogLicences
{
    /// <summary>The licences Iconify and Openverse let through unless the administrator chooses others.</summary>
    public static readonly IReadOnlyList<string> DefaultAllowed = ["CC0-1.0", "MIT", "Apache-2.0", "ISC", "CC-BY-4.0", "OFL-1.1"];

    private static readonly string[] Families = ["CC0", "PDM", "CC-BY", "MIT", "APACHE", "ISC", "OFL", "BSD", "PEXELS", "PIXABAY", "UNSPLASH", "PUBLIC", "UFL", "UNLICENSE"];

    /// <summary>"cc by-nc 4.0" becomes "CC-BY-NC-4.0".</summary>
    public static string Normalize(string? code)
        => string.Join('-', (code ?? "").Trim().ToUpperInvariant().Split([' ', '_', '-'], StringSplitOptions.RemoveEmptyEntries));

    /// <summary>Whether a picture or font under this licence may be offered and used in a design: commercial use and changes are allowed. Anything NC or ND, and anything unknown, is not.</summary>
    public static bool IsUsable(string? code)
    {
        var normalized = Normalize(code);
        if (normalized.Length == 0)
        {
            return false;
        }

        var tokens = normalized.Split('-');
        if (tokens.Contains("NC") || tokens.Contains("ND") || normalized.Contains("NONCOMMERCIAL", StringComparison.Ordinal) || normalized.Contains("NODERIV", StringComparison.Ordinal))
        {
            return false;
        }

        return Families.Any(f => normalized == f || normalized.StartsWith(f + "-", StringComparison.Ordinal));
    }

    /// <summary>Whether the licence asks that the author is named: the creative commons licences with BY do.</summary>
    public static bool NeedsAttribution(string? code)
    {
        var normalized = Normalize(code);
        return normalized.StartsWith("CC-BY", StringComparison.Ordinal) || normalized.StartsWith("APACHE", StringComparison.Ordinal) || normalized.StartsWith("MIT", StringComparison.Ordinal) || normalized.StartsWith("OFL", StringComparison.Ordinal);
    }

    /// <summary>
    /// Whether a licence code is one a catalogue offers now: usable at all (no NC, no ND), and in the list of the administrator (the <paramref name="defaults"/> of the catalogue when it is empty). A code in the
    /// list matches itself and the same licence with a version ("CC-BY" matches "CC-BY-4.0" but never "CC-BY-SA-4.0").
    /// </summary>
    public static bool Allowed(string? code, IReadOnlyList<string> chosen, IReadOnlyList<string> defaults)
    {
        if (!IsUsable(code))
        {
            return false;
        }

        var normalized = Normalize(code);
        var list = chosen.Count == 0 ? defaults : chosen;
        return list.Select(Normalize).Any(a => a.Length > 0 && (normalized == a || (normalized.StartsWith(a + "-", StringComparison.Ordinal) && char.IsAsciiDigit(normalized[a.Length + 1]))));
    }

    /// <summary>The licence of an item as the pages show it: the code as the provider wrote it, a name, a link when the provider gave one (http or https only).</summary>
    public static CatalogLicence Describe(string code, string? name = null, string? url = null, bool? attribution = null)
    {
        var clean = Clip(code, 40);
        return new CatalogLicence(clean, Clip(string.IsNullOrWhiteSpace(name) ? clean : name, 80), SafeUrl(url), attribution ?? NeedsAttribution(clean));
    }

    /// <summary>The credit line: "Foto von Anna auf Pexels (CC BY 4.0)" if the provider has its own, else made from title, author, catalogue and licence.</summary>
    public static string Attribution(CatalogItem item, string catalogName, string? providerLine = null)
    {
        if (!string.IsNullOrWhiteSpace(providerLine))
        {
            return Clip(providerLine, 300);
        }

        var sb = new StringBuilder();
        sb.Append(string.IsNullOrWhiteSpace(item.Title) ? "Bild" : "„" + Clip(item.Title, 80) + "“");
        if (!string.IsNullOrWhiteSpace(item.Author))
        {
            sb.Append(" von ").Append(Clip(item.Author, 80));
        }

        sb.Append(" auf ").Append(catalogName);
        if (item.Licence is { } licence)
        {
            sb.Append(" (").Append(licence.Name).Append(')');
        }

        return sb.ToString();
    }

    /// <summary>An address that may be shown as a link: absolute, http or https; anything else is empty.</summary>
    public static string SafeUrl(string? url)
        => Uri.TryCreate((url ?? "").Trim(), UriKind.Absolute, out var uri) && uri.Scheme is "http" or "https" && url!.Length <= 500 ? uri.AbsoluteUri : "";

    /// <summary>Text from a provider made safe to keep and to show: control and bidi characters out, cut to the length.</summary>
    public static string Clean(string? text, int max)
    {
        var sb = new StringBuilder();
        foreach (var c in (text ?? "").Trim())
        {
            if (char.IsControl(c) || IsInvisible(c))
            {
                continue;
            }

            sb.Append(c);
        }

        return Clip(sb.ToString(), max);
    }

    /// <summary>Zero-width and bidirectional control characters (by number, so the source stays readable).</summary>
    private static bool IsInvisible(char c) => (int)c is 0x200B or 0x200C or 0x200D or 0x2060 or 0xFEFF or (>= 0x202A and <= 0x202E) or (>= 0x2066 and <= 0x2069);

    private static string Clip(string text, int max) => text.Length > max ? text[..max] : text;
}
