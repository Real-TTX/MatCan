using System.Text.Json;
using System.Text.RegularExpressions;
using MatCan.Core.Documents;

namespace MatCan.Core.Data;

/// <summary>One column of a data list. <see cref="Type"/> is text, multiline, number, price or image (a cell of an image column holds an asset key).</summary>
public sealed record ColumnDef(string Key, string Label, string Type, int? Decimals, string? Category);

/// <summary>Reading, checking and writing the columns of a data list (stored as JSON in the list).</summary>
public static partial class ColumnDefs
{
    public const int MaxColumns = 100;
    public const int MaxLabelLength = 80;

    public static readonly IReadOnlyList<string> Types = ["text", "multiline", "number", "price", "image"];

    [GeneratedRegex("^[A-Za-z][A-Za-z0-9_]{0,39}$", RegexOptions.CultureInvariant)]
    private static partial Regex KeyPattern();

    public static bool IsValidKey(string? key) => key is not null && KeyPattern().IsMatch(key);

    /// <summary>Reads the columns leniently: entries without a valid key are dropped, keys are unique without regard to case, values are clamped. Never throws.</summary>
    public static IReadOnlyList<ColumnDef> Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        try
        {
            using var document = JsonDocument.Parse(json, new JsonDocumentOptions { MaxDepth = 16 });
            if (document.RootElement.ValueKind != JsonValueKind.Array)
            {
                return [];
            }

            var columns = new List<ColumnDef>();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var entry in document.RootElement.EnumerateArray())
            {
                if (entry.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                var key = Text(entry, "key");
                if (!IsValidKey(key) || !seen.Add(key!))
                {
                    continue;
                }

                columns.Add(Clean(key!, Text(entry, "label"), Text(entry, "type"), Number(entry, "decimals"), Text(entry, "category")));
                if (columns.Count >= MaxColumns)
                {
                    break;
                }
            }

            return columns;
        }
        catch (JsonException)
        {
            return [];
        }
    }

    /// <summary>A column with its defaults and limits: the label is the key when empty, an unknown type is text, decimals only for number and price (price: 2 by default).</summary>
    public static ColumnDef Clean(string key, string? label, string? type, int? decimals, string? category)
    {
        var kind = type is not null && Types.Contains(type) ? type : "text";
        int? places = kind is "number" or "price" ? decimals is { } d ? Math.Clamp(d, 0, 4) : null : null;
        if (kind == "price" && places is null)
        {
            places = 2;
        }

        var shownLabel = string.IsNullOrWhiteSpace(label) ? key : label.Trim();
        if (shownLabel.Length > MaxLabelLength)
        {
            shownLabel = shownLabel[..MaxLabelLength];
        }

        var group = string.IsNullOrWhiteSpace(category) ? null : category.Trim();
        if (group is { Length: > 80 })
        {
            group = group[..80];
        }

        return new ColumnDef(key, shownLabel, kind, places, kind == "image" ? group : null);
    }

    private static readonly JsonSerializerOptions Writer = new(JsonSerializerDefaults.Web);

    /// <summary>The JSON of the columns: <c>[{"key","label","type","decimals","category"}]</c>.</summary>
    public static string ToJson(IEnumerable<ColumnDef> columns)
        => JsonSerializer.Serialize(columns.Select(c => new { key = c.Key, label = c.Label, type = c.Type, decimals = c.Decimals, category = c.Category }), Writer);

    /// <summary>Null when the columns are fine, otherwise what is wrong, in German (for the form).</summary>
    public static string? Check(IEnumerable<ColumnDef> columns)
    {
        var list = columns.ToList();
        if (list.Count > MaxColumns)
        {
            return $"Eine Datenliste kann höchstens {MaxColumns} Spalten haben.";
        }

        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < list.Count; i++)
        {
            var column = list[i];
            if (!IsValidKey(column.Key))
            {
                return $"Spalte {i + 1}: ungültiger Schlüssel '{column.Key}'. Erlaubt sind Buchstaben, Ziffern und Unterstrich, am Anfang ein Buchstabe, höchstens 40 Zeichen.";
            }

            if (!seen.Add(column.Key))
            {
                return $"Der Schlüssel '{column.Key}' kommt doppelt vor.";
            }

            if (!Types.Contains(column.Type))
            {
                return $"Spalte {i + 1}: unbekannter Typ '{column.Type}'.";
            }
        }

        return null;
    }

    /// <summary>The columns that match the fields of a design (the keys are already valid and unique in a normalised document).</summary>
    public static IReadOnlyList<ColumnDef> FromFields(IEnumerable<FieldDef> fields)
        => [.. fields.Select(f => Clean(f.Key, f.Label, f.Type, f.Decimals, f.Category))];

    private static string? Text(JsonElement element, string name)
        => element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    private static int? Number(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.Number || !value.TryGetDouble(out var number) || !double.IsFinite(number))
        {
            return null;
        }

        return (int)Math.Round(Math.Clamp(number, 0, 4));
    }
}
