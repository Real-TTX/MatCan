using System.Text.Json;

namespace MatCan.Catalogs.Providers;

/// <summary>
/// What the real provider catalogues (Pexels, Pixabay, Openverse) share: reading a provider's JSON with care (a missing or odd field is an empty one, never an exception), the colours the
/// colour filter knows, and the check that an address a provider names belongs to the provider. The answer of a provider is data, never trusted: every id is checked against a pattern before it
/// is put into an address, every text is cleaned, every link must be http(s).
/// </summary>
internal static class ProviderSupport
{
    /// <summary>The colours of the colour select (the media browser and the panel Fotos offer exactly these).</summary>
    public static readonly string[] ColourNames = ["red", "orange", "yellow", "green", "turquoise", "blue", "violet", "pink", "brown", "black", "gray", "white"];

    public static string Str(JsonElement e, string name)
        => e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";

    /// <summary>A number the provider sent as a number or as a string, as text of digits (an id), or "".</summary>
    public static string IdText(JsonElement e, string name)
    {
        if (e.ValueKind != JsonValueKind.Object || !e.TryGetProperty(name, out var v))
        {
            return "";
        }

        return v.ValueKind switch
        {
            JsonValueKind.Number when v.TryGetInt64(out var n) && n > 0 => n.ToString(System.Globalization.CultureInfo.InvariantCulture),
            JsonValueKind.String => v.GetString() ?? "",
            _ => "",
        };
    }

    public static int? Int(JsonElement e, string name)
        => e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var n) && n is > 0 and < 100_000 ? n : null;

    public static int? Total(JsonElement e, string name)
        => e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var n) && n >= 0 ? n : null;

    public static IEnumerable<JsonElement> Array(JsonElement e, string name)
        => e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Array ? v.EnumerateArray().Take(CatalogQuery.MaxPerPage * 2) : [];

    /// <summary>All the strings of an array property (a list of names; at most 50 000), without the small cap of <see cref="Array"/>.</summary>
    public static IEnumerable<string> AllStrings(JsonElement e, string name)
        => e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Array
            ? v.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => x.GetString() ?? "").Take(50_000)
            : [];

    /// <summary>The colour of a request if the colour filter knows it ("blue", or "violet" for a provider that has it), else empty: never anything a person typed ends up in an address unchecked.</summary>
    public static string Colour(string? text)
    {
        var colour = (text ?? "").Trim().ToLowerInvariant();
        return ColourNames.Contains(colour, StringComparer.Ordinal) ? colour : "";
    }

    /// <summary>A link of a provider's answer that may be shown: https, and the host is the provider's own (or one of its sub-domains).</summary>
    public static string OwnLink(string? url, params string[] domains)
    {
        var safe = CatalogLicences.SafeUrl(url);
        if (safe.Length == 0 || !Uri.TryCreate(safe, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps)
        {
            return "";
        }

        return domains.Any(d => uri.Host.Equals(d, StringComparison.OrdinalIgnoreCase) || uri.Host.EndsWith("." + d, StringComparison.OrdinalIgnoreCase)) ? safe : "";
    }

    /// <summary>The title of a picture: the provider's words, cleaned, and a fallback.</summary>
    public static string Title(string? text, string fallback)
    {
        var clean = CatalogLicences.Clean(text, 120);
        return clean.Length == 0 ? fallback : clean;
    }

    public static string Capitalise(string text) => text.Length == 0 ? text : char.ToUpperInvariant(text[0]) + text[1..];
}
