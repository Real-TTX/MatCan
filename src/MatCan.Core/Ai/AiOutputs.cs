using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using MatCan.Core.Data;
using MatCan.Core.Documents;

namespace MatCan.Core.Ai;

/// <summary>
/// The boundary around the model's answers, in code: nothing a model writes is trusted. Values are cleaned (scripts refused with a reason, HTML tags
/// stripped, control characters removed, absurd lengths refused), checked against the column they are for (numbers parsed with <see cref="ValueFormat"/>,
/// image cells only from an allowlist the CODE built from the database), and only known keys and row ids get through. Every check returns what is
/// accepted and a German reason for everything that is not, so the person sees both in the preview. Pure functions: no database, no web types.
/// </summary>
public static partial class AiText
{
    /// <summary>A value that passed (<see cref="Value"/>, maybe changed, with a <see cref="Warning"/> saying so) or was refused (<see cref="Value"/> null, with the reason).</summary>
    public readonly record struct Cleaned(string? Value, string? Warning)
    {
        public bool Refused => Value is null;
    }

    [GeneratedRegex(@"<\s*/?\s*(script|iframe|object|embed|frame|frameset|applet|meta|link|base|form|style|svg|math|template)\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex DangerousTag();

    [GeneratedRegex(@"(javascript|vbscript)\s*:|data\s*:\s*text/html", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex DangerousScheme();

    [GeneratedRegex(@"<[^<>]*\son[a-z]+\s*=", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex EventHandlerInTag();

    [GeneratedRegex(@"<!--.*?-->|<\?.*?\?>|</?[A-Za-z][^<>]*>", RegexOptions.Singleline | RegexOptions.CultureInvariant)]
    private static partial Regex AnyTag();

    /// <summary>
    /// Plain text from model output: a script or a dangerous tag refuses the whole value; other HTML tags are stripped; control characters, bidi overrides
    /// and zero-width marks are removed; line breaks stay for <paramref name="multiline"/> and become spaces otherwise; longer than <paramref name="max"/> is refused.
    /// </summary>
    public static Cleaned Clean(string? raw, int max, bool multiline)
    {
        if (string.IsNullOrEmpty(raw))
        {
            return new Cleaned(string.Empty, null);
        }

        if (DangerousTag().IsMatch(raw) || DangerousScheme().IsMatch(raw) || EventHandlerInTag().IsMatch(raw))
        {
            return new Cleaned(null, "enthält ein Skript oder gefährliche Markierungen und wurde verworfen");
        }

        string warning = string.Empty;
        var text = raw;
        if (AnyTag().IsMatch(text))
        {
            text = AnyTag().Replace(text, string.Empty);
            warning = "HTML-Markierungen wurden entfernt";
        }

        var sb = new StringBuilder(text.Length);
        for (var i = 0; i < text.Length; i++)
        {
            var c = text[i];
            if (c == '\r')
            {
                if (i + 1 < text.Length && text[i + 1] == '\n')
                {
                    continue;
                }

                c = '\n';
            }

            if (c == (char)0x2028 || c == (char)0x2029)
            {
                c = '\n';
            }

            if (c == '\n')
            {
                sb.Append(multiline ? '\n' : ' ');
            }
            else if (c == '\t')
            {
                sb.Append(' ');
            }
            else if (char.IsControl(c) || IsInvisible(c))
            {
                // dropped
            }
            else
            {
                sb.Append(c);
            }
        }

        var clean = sb.ToString().Trim();
        if (!multiline)
        {
            clean = Regex.Replace(clean, " {2,}", " ");
        }

        if (clean.Length > max)
        {
            return new Cleaned(null, $"ist zu lang ({clean.Length.ToString(CultureInfo.InvariantCulture)} Zeichen, erlaubt sind {max.ToString(CultureInfo.InvariantCulture)}) und wurde verworfen");
        }

        return new Cleaned(clean, warning.Length == 0 ? null : warning);
    }

    /// <summary>How long a cell of a column may be (the data list itself allows 2000).</summary>
    public static int MaxLength(string type) => type switch
    {
        "multiline" => 2000,
        "number" or "price" => 40,
        "image" => 80,
        _ => 500,
    };

    /// <summary>The text of a JSON value (string, number, true/false, null = empty); null when it has another shape (list, object).</summary>
    public static string? Raw(JsonElement value) => value.ValueKind switch
    {
        JsonValueKind.String => value.GetString() ?? string.Empty,
        JsonValueKind.Number => value.GetRawText(),
        JsonValueKind.True => "true",
        JsonValueKind.False => "false",
        JsonValueKind.Null or JsonValueKind.Undefined => string.Empty,
        _ => null,
    };

    /// <summary>
    /// A value for a cell of <paramref name="column"/>: cleaned, then by type. A number or price must parse as one (and is written like the grid does: price with
    /// its decimals); an image cell must be a key of the allowlist (matched without regard to case, written as the key is spelled).
    /// </summary>
    public static Cleaned ForColumn(ColumnDef column, JsonElement value, ImageAllowlist? images)
    {
        var raw = Raw(value);
        if (raw is null)
        {
            return new Cleaned(null, "hat eine unpassende Form (keine einfache Angabe) und wurde verworfen");
        }

        var cleaned = Clean(raw, MaxLength(column.Type), column.Type == "multiline");
        if (cleaned.Refused || cleaned.Value!.Length == 0)
        {
            return cleaned;
        }

        var text = cleaned.Value!;
        switch (column.Type)
        {
            case "number" or "price":
                if (ValueFormat.ParseNumber(text) is not { } number || Math.Abs(number) > 1e12)
                {
                    return new Cleaned(null, $"„{Shorten(text)}“ ist keine brauchbare Zahl und wurde verworfen");
                }

                var formatted = column.Type == "price" || column.Decimals is not null ? ValueFormat.Format(column.Type, column.Decimals, text) : text;
                return new Cleaned(formatted, cleaned.Warning);
            case "image":
                return images is not null && images.TryGet(text, out var key)
                    ? new Cleaned(key, cleaned.Warning)
                    : new Cleaned(null, $"Das Medium „{Shorten(text)}“ gibt es nicht in der Liste der erlaubten Medien und wurde verworfen");
            default:
                return cleaned;
        }
    }

    internal static string Shorten(string text) => text.Length <= 40 ? text : text[..40] + " …";

    /// <summary>Characters that draw nothing or turn the text around: the byte order mark, zero-width marks, the word joiner and the bidi overrides and isolates.</summary>
    private static bool IsInvisible(char c)
        => c is (char)0xFEFF or (char)0x200B or (char)0x200C or (char)0x200D or (char)0x2060 || c is >= (char)0x202A and <= (char)0x202E || c is >= (char)0x2066 and <= (char)0x2069;
}

/// <summary>The asset keys a model may use in an image cell: built by the code from the database, matched without regard to case.</summary>
public sealed class ImageAllowlist
{
    public static readonly ImageAllowlist Empty = new([]);

    private readonly Dictionary<string, string> _byLower;

    public ImageAllowlist(IEnumerable<string> keys)
    {
        _byLower = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var key in keys)
        {
            _byLower.TryAdd(key, key);
        }
    }

    public int Count => _byLower.Count;

    public bool TryGet(string text, out string key)
    {
        var found = _byLower.TryGetValue(text.Trim(), out var canonical);
        key = canonical ?? string.Empty;
        return found;
    }
}

/// <summary>One proposed new row of a data list: the cleaned values by column key, and a reason per cell that was dropped or changed.</summary>
public sealed record ProposedRow(IReadOnlyDictionary<string, string> Values, IReadOnlyDictionary<string, string> Warnings);

/// <summary>What <see cref="DataImportCheck"/> accepted, the reasons for everything it did not, and the note of the model (cleaned).</summary>
public sealed record ImportProposal(IReadOnlyList<ProposedRow> Rows, IReadOnlyList<string> Warnings, string? Notes);

/// <summary>Checks the answer of the data import: <c>{ "rows": [ { "&lt;key&gt;": "value" } ], "notes": "..." }</c>.</summary>
public static class DataImportCheck
{
    public const int MaxRows = 500;

    public static ImportProposal Check(JsonElement? result, IReadOnlyList<ColumnDef> columns, Func<ColumnDef, ImageAllowlist> allowed)
    {
        var warnings = new List<string>();
        var rows = new List<ProposedRow>();
        if (result is not { ValueKind: JsonValueKind.Object } root || !root.TryGetProperty("rows", out var list) || list.ValueKind != JsonValueKind.Array)
        {
            warnings.Add("Die Antwort enthielt keine Liste „rows“.");
            return new ImportProposal(rows, warnings, null);
        }

        var byKey = new Dictionary<string, ColumnDef>(StringComparer.OrdinalIgnoreCase);
        foreach (var column in columns)
        {
            byKey.TryAdd(column.Key, column);
        }

        var byLabel = new Dictionary<string, ColumnDef>(StringComparer.OrdinalIgnoreCase);
        foreach (var column in columns)
        {
            if (!byKey.ContainsKey(column.Label))
            {
                byLabel.TryAdd(column.Label, column);
            }
        }

        var lists = new Dictionary<string, ImageAllowlist>(StringComparer.OrdinalIgnoreCase);
        var unknown = new SortedSet<string>(StringComparer.OrdinalIgnoreCase);
        var number = 0;
        var truncated = false;
        foreach (var entry in list.EnumerateArray())
        {
            number++;
            if (rows.Count >= MaxRows)
            {
                truncated = true;
                break;
            }

            if (entry.ValueKind != JsonValueKind.Object)
            {
                warnings.Add($"Eintrag {number} ist keine Zeile und wurde übersprungen.");
                continue;
            }

            var values = new Dictionary<string, string>(StringComparer.Ordinal);
            var cellWarnings = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var property in entry.EnumerateObject())
            {
                if (!byKey.TryGetValue(property.Name, out var column) && !byLabel.TryGetValue(property.Name, out column))
                {
                    unknown.Add(AiText.Shorten(property.Name));
                    continue;
                }

                if (values.ContainsKey(column.Key) || cellWarnings.ContainsKey(column.Key))
                {
                    continue;
                }

                if (!lists.TryGetValue(column.Key, out var images))
                {
                    images = column.Type == "image" ? allowed(column) : ImageAllowlist.Empty;
                    lists[column.Key] = images;
                }

                var cleaned = AiText.ForColumn(column, property.Value, images);
                if (cleaned.Refused)
                {
                    cellWarnings[column.Key] = $"{column.Label}: {cleaned.Warning}";
                    continue;
                }

                if (cleaned.Value!.Length > 0)
                {
                    values[column.Key] = cleaned.Value;
                }

                if (cleaned.Warning is not null)
                {
                    cellWarnings[column.Key] = $"{column.Label}: {cleaned.Warning}";
                }
            }

            if (values.Count == 0)
            {
                warnings.Add($"Eintrag {number} enthielt keine verwertbaren Werte und wurde übersprungen" + (cellWarnings.Count > 0 ? " (" + string.Join("; ", cellWarnings.Values) + ")." : "."));
                continue;
            }

            rows.Add(new ProposedRow(values, cellWarnings));
        }

        if (truncated)
        {
            warnings.Add($"Es werden höchstens {MaxRows} Zeilen auf einmal übernommen; der Rest wurde weggelassen.");
        }

        if (unknown.Count > 0)
        {
            warnings.Add("Unbekannte Spalten wurden ignoriert: " + string.Join(", ", unknown.Take(10)) + (unknown.Count > 10 ? " …" : string.Empty) + ".");
        }

        string? notes = null;
        if (root.TryGetProperty("notes", out var noteElement) && AiText.Raw(noteElement) is { Length: > 0 } rawNote)
        {
            var clean = AiText.Clean(rawNote, 1000, true);
            notes = clean.Value is { Length: > 0 } ? clean.Value : null;
        }

        return new ImportProposal(rows, warnings, notes);
    }
}

/// <summary>One proposed change of a cell: the row, the value now, the value proposed, and a remark when it was changed on the way.</summary>
public sealed record ProposedValue(long RowId, string Old, string New, string? Warning);

/// <summary>What <see cref="DataFillCheck"/> accepted, how many rows stayed as they were, how many got no answer, and the reasons for what was dropped.</summary>
public sealed record FillProposal(IReadOnlyList<ProposedValue> Values, int Unchanged, int Missing, IReadOnlyList<string> Warnings);

/// <summary>Checks the answer of the data fill: <c>{ "values": [ { "row": 12, "value": "..." } ] }</c>. Only the rows that were sent may be answered.</summary>
public static class DataFillCheck
{
    public static FillProposal Check(JsonElement? result, ColumnDef target, IReadOnlyDictionary<long, string> current, ImageAllowlist images)
    {
        var warnings = new List<string>();
        var values = new List<ProposedValue>();
        if (result is not { ValueKind: JsonValueKind.Object } root || !root.TryGetProperty("values", out var list) || list.ValueKind != JsonValueKind.Array)
        {
            warnings.Add("Die Antwort enthielt keine Liste „values“.");
            return new FillProposal(values, 0, current.Count, warnings);
        }

        var seen = new HashSet<long>();
        var unchanged = 0;
        var foreign = new SortedSet<long>();
        foreach (var entry in list.EnumerateArray())
        {
            if (entry.ValueKind != JsonValueKind.Object || entry.Long("row") is not { } rowId)
            {
                warnings.Add("Ein Eintrag der Antwort hatte keine Zeilennummer und wurde übersprungen.");
                continue;
            }

            if (!current.TryGetValue(rowId, out var old))
            {
                foreign.Add(rowId);
                continue;
            }

            if (!seen.Add(rowId))
            {
                warnings.Add($"Zeile {rowId} kam mehrfach vor; nur die erste Antwort zählt.");
                continue;
            }

            if (!entry.TryGetProperty("value", out var raw))
            {
                warnings.Add($"Zeile {rowId}: Die Antwort hatte keinen Wert.");
                continue;
            }

            var cleaned = AiText.ForColumn(target, raw, images);
            if (cleaned.Refused)
            {
                warnings.Add($"Zeile {rowId}: Der Wert {cleaned.Warning}.");
                continue;
            }

            if (cleaned.Value!.Length == 0)
            {
                warnings.Add($"Zeile {rowId}: leere Antwort, der Wert bleibt, wie er ist.");
                continue;
            }

            if (string.Equals(cleaned.Value, old, StringComparison.Ordinal))
            {
                unchanged++;
                continue;
            }

            values.Add(new ProposedValue(rowId, old, cleaned.Value, cleaned.Warning is null ? null : $"{cleaned.Warning[..1].ToUpperInvariant()}{cleaned.Warning[1..]}"));
        }

        if (foreign.Count > 0)
        {
            warnings.Add("Antworten zu Zeilen, die nicht ausgewählt waren, wurden ignoriert (Nr. " + string.Join(", ", foreign.Take(10)) + (foreign.Count > 10 ? " …" : string.Empty) + ").");
        }

        return new FillProposal(values, unchanged, current.Keys.Count(id => !seen.Contains(id)), warnings);
    }
}

/// <summary>What <see cref="TextSuggestCheck"/> accepted (each with the same placeholders as the original) and why it dropped the rest.</summary>
public sealed record TextSuggestions(IReadOnlyList<string> Items, IReadOnlyList<string> Warnings);

/// <summary>Checks the answer of the text suggestion: <c>{ "suggestions": [ "..." ] }</c>. A suggestion must keep exactly the placeholders of the original.</summary>
public static class TextSuggestCheck
{
    public const int MaxSuggestions = 5;

    public const int MaxTextLength = 5000;

    public static TextSuggestions Check(JsonElement? result, string original, int maxLength = MaxTextLength)
    {
        var warnings = new List<string>();
        var items = new List<string>();
        if (result is not { ValueKind: JsonValueKind.Object } root || !root.TryGetProperty("suggestions", out var list) || list.ValueKind != JsonValueKind.Array)
        {
            warnings.Add("Die Antwort enthielt keine Liste „suggestions“.");
            return new TextSuggestions(items, warnings);
        }

        var originalKeys = Placeholders.Keys(original);
        var wanted = originalKeys.Select(k => k.ToLowerInvariant()).ToHashSet();
        var seen = new HashSet<string>(StringComparer.Ordinal) { original.Trim() };
        var number = 0;
        foreach (var entry in list.EnumerateArray())
        {
            number++;
            var raw = entry.ValueKind == JsonValueKind.Object && entry.TryGetProperty("text", out var inner) ? AiText.Raw(inner) : AiText.Raw(entry);
            if (raw is null)
            {
                warnings.Add($"Vorschlag {number} hatte eine unpassende Form und wurde verworfen.");
                continue;
            }

            var cleaned = AiText.Clean(raw, maxLength, true);
            if (cleaned.Refused)
            {
                warnings.Add($"Vorschlag {number} {cleaned.Warning}.");
                continue;
            }

            if (cleaned.Value!.Length == 0)
            {
                continue;
            }

            var got = Placeholders.Keys(cleaned.Value).Select(k => k.ToLowerInvariant()).ToHashSet();
            if (!got.SetEquals(wanted))
            {
                warnings.Add($"Vorschlag {number} wurde verworfen: Er hat die Platzhalter verändert" + (wanted.Count == 0 ? " (das Original hat keine)." : $" (nötig: {string.Join(", ", originalKeys.Select(k => "{{" + k + "}}"))})."));
                continue;
            }

            if (!seen.Add(cleaned.Value))
            {
                continue;
            }

            if (items.Count >= MaxSuggestions)
            {
                warnings.Add($"Es werden höchstens {MaxSuggestions} Vorschläge angezeigt.");
                break;
            }

            items.Add(cleaned.Value);
        }

        return new TextSuggestions(items, warnings);
    }
}
