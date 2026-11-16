using System.Text.RegularExpressions;
using MatCan.Core.Data;

namespace MatCan.Core.Documents;

/// <summary>Where a field is used: the element, and how (<c>text</c>, <c>qr</c> or <c>barcode</c> placeholder, <c>image</c> source, <c>strip</c> slot, <c>showIf</c> condition).</summary>
public sealed record FieldUse(string ElementId, string ElementName, string Kind);

/// <summary>A key used in a document, whether the document defines a field for it, and where it is used.</summary>
public sealed record FieldUsage(string Key, bool Defined, FieldDef? Field, IReadOnlyList<FieldUse> Uses);

/// <summary>The <c>{{Key}}</c> placeholders of texts, with the same rules as <c>DtEngine.resolveText</c> and <c>DtEngine.fieldsUsed</c>.</summary>
public static partial class Placeholders
{
    [GeneratedRegex(@"\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}", RegexOptions.CultureInvariant)]
    private static partial Regex Token();

    /// <summary>The distinct keys of the placeholders of a text, in order of appearance (case-insensitive).</summary>
    public static IReadOnlyList<string> Keys(string? text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return [];
        }

        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var keys = new List<string>();
        foreach (Match match in Token().Matches(text))
        {
            if (seen.Add(match.Groups[1].Value))
            {
                keys.Add(match.Groups[1].Value);
            }
        }

        return keys;
    }

    /// <summary>
    /// Replaces the placeholders with the values, formatted by the type of the field of that key (price "2,99"). Keys are matched without regard to case; an unknown key or
    /// a missing (null) value gives an empty text, or the token itself (<c>{{Key}}</c>) with <paramref name="keepMissingTokens"/>.
    /// </summary>
    public static string Render(string? text, IReadOnlyList<FieldDef> fields, IReadOnlyDictionary<string, string?> values, string locale = "de-DE", bool keepMissingTokens = false)
    {
        if (string.IsNullOrEmpty(text))
        {
            return string.Empty;
        }

        var byKey = new Dictionary<string, FieldDef>(StringComparer.OrdinalIgnoreCase);
        foreach (var field in fields)
        {
            byKey.TryAdd(field.Key, field);
        }

        var valueByKey = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        foreach (var (key, value) in values)
        {
            valueByKey[key] = value;
        }

        return Token().Replace(text, match =>
        {
            var key = match.Groups[1].Value;
            if (!valueByKey.TryGetValue(key, out var raw) || raw is null)
            {
                return keepMissingTokens ? "{{" + key + "}}" : string.Empty;
            }

            return byKey.TryGetValue(key, out var field) ? ValueFormat.Format(field, raw, locale) : raw;
        });
    }

    /// <summary>
    /// The keys a document uses (placeholders in texts, QR codes and barcodes, image sources, strip slots, showIf) on every page and in every group, each once, in order of
    /// first use, with the places.
    /// </summary>
    public static IReadOnlyList<FieldUsage> FieldsUsed(DesignDocument document)
    {
        var byKey = new Dictionary<string, FieldDef>(StringComparer.OrdinalIgnoreCase);
        foreach (var field in document.Fields)
        {
            byKey.TryAdd(field.Key, field);
        }

        var order = new List<string>();
        var keys = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var uses = new Dictionary<string, List<FieldUse>>(StringComparer.OrdinalIgnoreCase);

        void Add(string key, DesignElement element, string kind)
        {
            if (!uses.TryGetValue(key, out var list))
            {
                list = [];
                uses[key] = list;
                keys[key] = byKey.TryGetValue(key, out var defined) ? defined.Key : key;
                order.Add(key);
            }

            if (!list.Any(u => u.ElementId == element.Id && u.Kind == kind))
            {
                list.Add(new FieldUse(element.Id, element.Name, kind));
            }
        }

        foreach (var element in document.AllElements)
        {
            if (element.ShowIf is { } showIf)
            {
                Add(showIf, element, "showIf");
            }

            switch (element)
            {
                case TextElement text:
                    foreach (Match match in Token().Matches(text.Text))
                    {
                        Add(match.Groups[1].Value, element, "text");
                    }

                    break;
                case QrElement qr:
                    foreach (Match match in Token().Matches(qr.Value))
                    {
                        Add(match.Groups[1].Value, element, "qr");
                    }

                    break;
                case BarcodeElement barcode:
                    foreach (Match match in Token().Matches(barcode.Value))
                    {
                        Add(match.Groups[1].Value, element, "barcode");
                    }

                    break;
                case ImageElement { Source.Field: { } imageField }:
                    Add(imageField, element, "image");
                    break;
                case ImageStripElement strip:
                    foreach (var item in strip.Items)
                    {
                        if (item?.Field is { } stripField)
                        {
                            Add(stripField, element, "strip");
                        }
                    }

                    break;
            }
        }

        return [.. order.Select(key => new FieldUsage(keys[key], byKey.ContainsKey(key), byKey.GetValueOrDefault(key), uses[key]))];
    }

    private static readonly HashSet<string> GenericFamilies = new(StringComparer.OrdinalIgnoreCase)
    {
        "serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace",
    };

    /// <summary>
    /// The font families the texts (and the labels of barcodes) use on every page and in every group, each once (case-insensitive), as the engine reads them: the name without quotes, semicolons or commas.
    /// The generic families (sans-serif ...) are not listed: they need no file.
    /// </summary>
    public static IReadOnlyList<string> FontFamilies(DesignDocument document)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var families = new List<string>();
        foreach (var family in document.AllElements.Select(FamilyOf))
        {
            if (family.Length > 0 && !GenericFamilies.Contains(family) && seen.Add(family))
            {
                families.Add(family);
            }
        }

        return families;
    }

    /// <summary>The family a text or a barcode is set in (cleaned); empty for the other elements.</summary>
    private static string FamilyOf(DesignElement element) => element switch
    {
        TextElement text => CleanFamily(text.FontFamily),
        BarcodeElement barcode => CleanFamily(barcode.FontFamily),
        _ => "",
    };

    /// <summary>The family name the way the engine cleans it (<c>cleanFamily</c>): control characters, quotes, backslashes, semicolons, braces, angle brackets and commas become spaces.</summary>
    public static string CleanFamily(string? family)
    {
        var sb = new System.Text.StringBuilder();
        foreach (var c in family ?? "")
        {
            sb.Append(c < ' ' || c is '"' or '\'' or '\\' or ';' or '{' or '}' or '<' or '>' or ',' ? ' ' : c);
        }

        var cleaned = Regex.Replace(sb.ToString(), @"\s+", " ").Trim();
        return cleaned.Length > 100 ? cleaned[..100] : cleaned;
    }

    /// <summary>The asset keys a document refers to: the backgrounds of all pages, image sources and strip slots (also inside groups) and the sample values of image fields. Distinct without regard to case.</summary>
    public static IReadOnlyList<string> AssetKeys(DesignDocument document)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var keys = new List<string>();

        void Add(string? key)
        {
            if (!string.IsNullOrWhiteSpace(key) && seen.Add(key.Trim()))
            {
                keys.Add(key.Trim());
            }
        }

        foreach (var page in document.Pages)
        {
            Add(page.Background.Asset);
            foreach (var element in page.Elements.SelectMany(DesignDocument.Flatten))
            {
                switch (element)
                {
                    case ImageElement image:
                        Add(image.Source?.Asset);
                        break;
                    case ImageStripElement strip:
                        foreach (var item in strip.Items)
                        {
                            Add(item?.Asset);
                        }

                        break;
                }
            }
        }

        foreach (var field in document.Fields.Where(f => f.Type == "image"))
        {
            Add(field.Sample);
        }

        return keys;
    }
}
