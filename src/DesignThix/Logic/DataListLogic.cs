using System.Text;
using System.Text.Json;
using DesignThix.Core.Data;
using DesignThix.Core.Documents;
using DesignThix.Core.Text;
using DesignThix.Data;
using DesignThix.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Logic;

/// <summary>Somebody else saved a list or a design meanwhile: the revision the caller started from is no longer the current one.</summary>
public sealed class RevisionConflictException(int currentRevision) : Exception("Jemand hat das inzwischen geändert.")
{
    public int CurrentRevision { get; } = currentRevision;
}

/// <summary>A data list in the list page.</summary>
public sealed record DataListRow
{
    public long Id { get; init; }

    public string Name { get; init; } = "";

    public string? Description { get; init; }

    public int Revision { get; init; }

    public int RowCount { get; init; }

    public bool ContainsPersonalData { get; init; }

    public DateTime UpdateDate { get; init; }

    public string ColumnsJson { get; init; } = "[]";
}

/// <summary>One row of the grid: the values by column key, how many labels, whether it is printed.</summary>
public sealed record GridRow(long? Id, Dictionary<string, string> Values, int Copies, bool IsActive);

/// <summary>Everything the grid needs to start.</summary>
public sealed record GridData(long Id, string Name, int Revision, bool CanEdit, IReadOnlyList<ColumnDef> Columns, IReadOnlyList<GridRow> Rows);

/// <summary>What a pasted or uploaded CSV looks like: shown before anything is imported, with a mapping of its columns to the columns of the list.</summary>
public sealed record ImportPreview(char Delimiter, IReadOnlyList<string> Headers, IReadOnlyList<IReadOnlyList<string>> SampleRows, int RowCount, IReadOnlyList<string> SuggestedMapping);

/// <summary>Data lists: columns, rows, the grid's save with a revision check, CSV import and export.</summary>
public static class DataListLogic
{
    public const int MaxRows = 5000;

    public const int MaxCsvChars = 4_000_000;

    public const int MaxValueLength = 2000;

    public const string MapIgnore = "";
    public const string MapNew = "@new";
    public const string MapCopies = "@copies";
    public const string MapActive = "@active";

    public static IQueryable<DataListRow> Query(Biz biz)
    {
        biz.RequireSignedIn();
        return biz.Db.DataList.AsNoTracking().Select(l => new DataListRow { Id = l.Id, Name = l.Name, Description = l.Description, Revision = l.Revision, RowCount = l.Rows.Count, ContainsPersonalData = l.ContainsPersonalData, UpdateDate = l.UpdateDate, ColumnsJson = l.ColumnsJson });
    }

    public static async Task<int> RowCountAsync(Biz biz, long id)
    {
        biz.RequireSignedIn();
        return await biz.Db.DataRow.CountAsync(r => r.DataListId == id);
    }

    public static async Task<DataList?> GetAsync(Biz biz, long id)
    {
        biz.RequireSignedIn();
        return await biz.Db.DataList.AsNoTracking().FirstOrDefaultAsync(l => l.Id == id);
    }

    public static async Task<List<Choice>> ChoicesAsync(Biz biz)
    {
        biz.RequireSignedIn();
        return await biz.Db.DataList.AsNoTracking().OrderBy(l => l.Name).Select(l => new Choice(l.Id, l.Name, null)).ToListAsync();
    }

    public static async Task<int> CountAsync(Biz biz)
    {
        biz.RequireSignedIn();
        return await biz.Db.DataList.CountAsync();
    }

    // ------------------------------------------------------------------------------------------------ the list itself

    public sealed record ListInput(string Name, string? Description, bool ContainsPersonalData);

    public static async Task<DataList> SaveGeneralAsync(Biz biz, long? id, ListInput input)
    {
        biz.RequireDesigner();
        var name = (input.Name ?? "").Trim();
        if (name.Length == 0)
        {
            throw new BizException("Bitte gib den Namen ein.", "Input.Name");
        }

        DataList list;
        if (id is null)
        {
            list = new DataList { ColumnsJson = "[]" };
            biz.Db.DataList.Add(list);
        }
        else
        {
            list = await biz.Db.DataList.FirstOrDefaultAsync(l => l.Id == id) ?? throw new BizException("Die Datenliste gibt es nicht mehr.");
        }

        list.Name = name.Length > 200 ? name[..200] : name;
        list.Description = string.IsNullOrWhiteSpace(input.Description) ? null : input.Description.Trim();
        list.ContainsPersonalData = input.ContainsPersonalData;
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync(id is null ? "Datenliste angelegt" : "Datenliste geändert", nameof(DataList), list.Id, list.Name);
        return list;
    }

    public static async Task DeleteAsync(Biz biz, long id)
    {
        biz.RequireDesigner();
        var list = await biz.Db.DataList.FirstOrDefaultAsync(l => l.Id == id) ?? throw new BizException("Die Datenliste gibt es nicht mehr.");
        await biz.Db.DataRow.Where(r => r.DataListId == id).ExecuteDeleteAsync();
        biz.Db.DataList.Remove(list);
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Datenliste gelöscht", nameof(DataList), id, list.Name);
    }

    /// <summary>Copies a list with its columns and rows ("Duplizieren").</summary>
    public static async Task<DataList> DuplicateAsync(Biz biz, long id)
    {
        biz.RequireDesigner();
        var source = await biz.Db.DataList.AsNoTracking().FirstOrDefaultAsync(l => l.Id == id) ?? throw new BizException("Die Datenliste gibt es nicht mehr.");
        var copy = new DataList { Name = Clip(source.Name + " (Kopie)", 200), Description = source.Description, ColumnsJson = source.ColumnsJson, ContainsPersonalData = source.ContainsPersonalData };
        biz.Db.DataList.Add(copy);
        await biz.Db.SaveChangesAsync();
        var rows = await biz.Db.DataRow.AsNoTracking().Where(r => r.DataListId == id).OrderBy(r => r.Position).ToListAsync();
        foreach (var r in rows)
        {
            biz.Db.DataRow.Add(new DataRow { DataListId = copy.Id, Position = r.Position, ValuesJson = r.ValuesJson, Copies = r.Copies, IsActive = r.IsActive });
        }

        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Datenliste dupliziert", nameof(DataList), copy.Id, copy.Name);
        return copy;
    }

    private static string Clip(string text, int max) => text.Length > max ? text[..max] : text;

    // ------------------------------------------------------------------------------------------------ columns

    public static IReadOnlyList<ColumnDef> ColumnsOf(DataList list) => ColumnDefs.Parse(list.ColumnsJson);

    /// <summary>Saves the columns (key, label, type, decimals, category). Values of a column that is removed stay in the rows until the grid is saved.</summary>
    public static async Task SaveColumnsAsync(Biz biz, long id, IReadOnlyList<ColumnDef> columns)
    {
        biz.RequireDesigner();
        var list = await biz.Db.DataList.FirstOrDefaultAsync(l => l.Id == id) ?? throw new BizException("Die Datenliste gibt es nicht mehr.");
        if (ColumnDefs.Check(columns) is { } problem)
        {
            throw new BizException(problem, "Columns");
        }

        list.ColumnsJson = ColumnDefs.ToJson(columns);
        list.Revision++;
        await SaveWithRevisionAsync(biz, list);
        await biz.Log.LogAsync("Spalten geändert", nameof(DataList), id, $"{list.Name}: {columns.Count} Spalten");
    }

    /// <summary>"Spalten aus Design übernehmen": the fields of the design are added as columns (a key that is there stays as it is).</summary>
    public static async Task<int> AddColumnsFromDesignAsync(Biz biz, long id, long designId)
    {
        biz.RequireDesigner();
        var list = await biz.Db.DataList.FirstOrDefaultAsync(l => l.Id == id) ?? throw new BizException("Die Datenliste gibt es nicht mehr.");
        var json = await biz.Db.Design.AsNoTracking().Where(d => d.Id == designId).Select(d => d.DocumentJson).FirstOrDefaultAsync() ?? throw new BizException("Das Design gibt es nicht mehr.");
        var document = DocumentValidator.Parse(json);
        var current = ColumnDefs.Parse(list.ColumnsJson).ToList();
        var known = current.Select(c => c.Key.ToLowerInvariant()).ToHashSet();
        var added = 0;
        foreach (var column in ColumnDefs.FromFields(document?.Fields ?? []))
        {
            if (known.Add(column.Key.ToLowerInvariant()) && current.Count < 100)
            {
                current.Add(column);
                added++;
            }
        }

        if (added > 0)
        {
            list.ColumnsJson = ColumnDefs.ToJson(current);
            list.Revision++;
            await SaveWithRevisionAsync(biz, list);
            await biz.Log.LogAsync("Spalten aus Design übernommen", nameof(DataList), id, $"{list.Name}: {added} neu");
        }

        return added;
    }

    private static async Task SaveWithRevisionAsync(Biz biz, DataList list)
    {
        try
        {
            await biz.Db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new BizException("Jemand hat die Datenliste inzwischen geändert. Bitte lade die Seite neu.");
        }
    }

    // ------------------------------------------------------------------------------------------------ rows (the grid)

    private static Dictionary<string, string> ParseValues(string json)
    {
        var values = new Dictionary<string, string>(StringComparer.Ordinal);
        try
        {
            using var document = JsonDocument.Parse(json);
            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                return values;
            }

            foreach (var property in document.RootElement.EnumerateObject())
            {
                values[property.Name] = property.Value.ValueKind switch
                {
                    JsonValueKind.String => property.Value.GetString() ?? "",
                    JsonValueKind.Number or JsonValueKind.True or JsonValueKind.False => property.Value.GetRawText(),
                    _ => "",
                };
            }
        }
        catch (JsonException)
        {
            // a damaged row has no values
        }

        return values;
    }

    /// <summary>Keeps only the columns of the list (key matched without regard to case), values as short as the limit says.</summary>
    private static Dictionary<string, string> CleanValues(IReadOnlyDictionary<string, string>? values, IReadOnlyList<ColumnDef> columns)
    {
        var clean = new Dictionary<string, string>(StringComparer.Ordinal);
        if (values is null)
        {
            return clean;
        }

        var byLower = values.GroupBy(v => v.Key.ToLowerInvariant()).ToDictionary(g => g.Key, g => g.First().Value);
        foreach (var column in columns)
        {
            if (byLower.TryGetValue(column.Key.ToLowerInvariant(), out var value) && !string.IsNullOrEmpty(value))
            {
                clean[column.Key] = value.Length > MaxValueLength ? value[..MaxValueLength] : value;
            }
        }

        return clean;
    }

    private static string ToJson(Dictionary<string, string> values) => JsonSerializer.Serialize(values);

    public static async Task<GridData> GridAsync(Biz biz, long id)
    {
        biz.RequireSignedIn();
        var list = await biz.Db.DataList.AsNoTracking().FirstOrDefaultAsync(l => l.Id == id) ?? throw new BizException("Die Datenliste gibt es nicht mehr.");
        var rows = await biz.Db.DataRow.AsNoTracking().Where(r => r.DataListId == id).OrderBy(r => r.Position).ThenBy(r => r.Id).ToListAsync();
        return new GridData(list.Id, list.Name, list.Revision, biz.IsDesigner, ColumnsOf(list),
            [.. rows.Select(r => new GridRow(r.Id, ParseValues(r.ValuesJson), r.Copies, r.IsActive))]);
    }

    /// <summary>Saves the whole grid in its order. A stale revision throws <see cref="RevisionConflictException"/>; rows that are not in the set are deleted.</summary>
    public static async Task<(int Revision, List<long> RowIds)> SaveRowsAsync(Biz biz, long id, int revision, IReadOnlyList<GridRow> rows)
    {
        biz.RequireDesigner();
        var list = await biz.Db.DataList.FirstOrDefaultAsync(l => l.Id == id) ?? throw new BizException("Die Datenliste gibt es nicht mehr.");
        if (list.Revision != revision)
        {
            throw new RevisionConflictException(list.Revision);
        }

        if (rows.Count > MaxRows)
        {
            throw new BizException($"Eine Datenliste hat höchstens {Services.Fmt.Integer(MaxRows)} Zeilen.");
        }

        var columns = ColumnsOf(list);
        var existing = await biz.Db.DataRow.Where(r => r.DataListId == id).ToDictionaryAsync(r => r.Id);
        var keep = new HashSet<long>();
        var ordered = new List<DataRow>(rows.Count);
        for (var i = 0; i < rows.Count; i++)
        {
            var incoming = rows[i];
            var values = CleanValues(incoming.Values, columns);
            var copies = Math.Clamp(incoming.Copies, 1, 999);
            DataRow row;
            if (incoming.Id is { } rowId && existing.TryGetValue(rowId, out var found) && keep.Add(rowId))
            {
                row = found;
                if (!ParseValues(row.ValuesJson).OrderBy(p => p.Key, StringComparer.Ordinal).SequenceEqual(values.OrderBy(p => p.Key, StringComparer.Ordinal)))
                {
                    row.ValuesJson = ToJson(values);
                }

                row.Copies = copies;
                row.IsActive = incoming.IsActive;
                row.Position = i;
            }
            else
            {
                row = new DataRow { DataListId = id, Position = i, ValuesJson = ToJson(values), Copies = copies, IsActive = incoming.IsActive };
                biz.Db.DataRow.Add(row);
            }

            ordered.Add(row);
        }

        biz.Db.DataRow.RemoveRange(existing.Values.Where(r => !keep.Contains(r.Id)));
        list.Revision++;
        try
        {
            await biz.Db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            var current = await biz.Db.DataList.AsNoTracking().Where(l => l.Id == id).Select(l => l.Revision).FirstOrDefaultAsync();
            throw new RevisionConflictException(current);
        }

        await biz.Log.LogAsync("Zeilen gespeichert", nameof(DataList), id, $"{list.Name}: {rows.Count} Zeilen");
        return (list.Revision, [.. ordered.Select(r => r.Id)]);
    }

    // ------------------------------------------------------------------------------------------------ export

    public static async Task<(byte[] Bytes, string FileName)> ExportCsvAsync(Biz biz, long id)
    {
        biz.RequireSignedIn();
        var list = await biz.Db.DataList.AsNoTracking().FirstOrDefaultAsync(l => l.Id == id) ?? throw new BizException("Die Datenliste gibt es nicht mehr.");
        var columns = ColumnsOf(list);
        var rows = await biz.Db.DataRow.AsNoTracking().Where(r => r.DataListId == id).OrderBy(r => r.Position).ThenBy(r => r.Id).ToListAsync();
        var table = new List<IReadOnlyList<string>>(rows.Count + 1);
        // The header carries the keys (what the placeholders say) and two helper columns that start with an underscore (no key can).
        table.Add([.. columns.Select(c => c.Key), "_Kopien", "_Aktiv"]);
        foreach (var row in rows)
        {
            var values = ParseValues(row.ValuesJson);
            table.Add([.. columns.Select(c => values.GetValueOrDefault(c.Key, "")), row.Copies.ToString(System.Globalization.CultureInfo.InvariantCulture), row.IsActive ? "ja" : "nein"]);
        }

        var name = Slug.From(list.Name, 60);
        return (Csv.WriteBytes(table, ';'), (name.Length == 0 ? "datenliste" : name) + ".csv");
    }

    // ------------------------------------------------------------------------------------------------ import

    /// <summary>Reads a CSV text and proposes what each of its columns means for this list.</summary>
    public static async Task<ImportPreview> PreviewImportAsync(Biz biz, long id, string text, bool hasHeader)
    {
        biz.RequireDesigner();
        var list = await biz.Db.DataList.AsNoTracking().FirstOrDefaultAsync(l => l.Id == id) ?? throw new BizException("Die Datenliste gibt es nicht mehr.");
        var table = ReadTable(text);
        var width = table.Rows.Max(r => r.Count);
        var headers = hasHeader ? Pad(table.Rows[0], width) : [.. Enumerable.Range(1, width).Select(n => $"Spalte {n}")];
        var body = hasHeader ? table.Rows.Skip(1).ToList() : table.Rows.ToList();
        var columns = ColumnsOf(list);
        var mapping = SuggestMapping(headers, columns, hasHeader);
        return new ImportPreview(table.Delimiter, headers, [.. body.Take(8).Select(r => (IReadOnlyList<string>)Pad(r, width))], body.Count, mapping);
    }

    private static Csv.ParseResult ReadTable(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            throw new BizException("Es gibt nichts zu importieren: Die Datei oder der eingefügte Text ist leer.");
        }

        if (text.Length > MaxCsvChars)
        {
            throw new BizException("Der Text ist zu groß für einen Import.");
        }

        var table = Csv.Parse(text);
        return table.Rows.Count == 0 ? throw new BizException("Es wurden keine Zeilen erkannt.") : table;
    }

    private static List<string> Pad(IReadOnlyList<string> row, int width)
    {
        var padded = new List<string>(row);
        while (padded.Count < width)
        {
            padded.Add("");
        }

        return padded;
    }

    private static List<string> SuggestMapping(IReadOnlyList<string> headers, IReadOnlyList<ColumnDef> columns, bool hasHeader)
    {
        var result = new List<string>(headers.Count);
        var used = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < headers.Count; i++)
        {
            var header = headers[i].Trim();
            string target = MapIgnore;
            if (hasHeader && header.Equals("_Kopien", StringComparison.OrdinalIgnoreCase))
            {
                target = MapCopies;
            }
            else if (hasHeader && header.Equals("_Aktiv", StringComparison.OrdinalIgnoreCase))
            {
                target = MapActive;
            }
            else if (hasHeader)
            {
                var match = columns.FirstOrDefault(c => c.Key.Equals(header, StringComparison.OrdinalIgnoreCase) && !used.Contains(c.Key))
                    ?? columns.FirstOrDefault(c => c.Label.Equals(header, StringComparison.OrdinalIgnoreCase) && !used.Contains(c.Key));
                if (match is not null)
                {
                    target = match.Key;
                    used.Add(match.Key);
                }
                else if (columns.Count == 0 && header.Length > 0)
                {
                    target = MapNew;
                }
            }
            else if (i < columns.Count)
            {
                target = columns[i].Key;
            }

            result.Add(target);
        }

        return result;
    }

    public sealed record ImportRequest(string Text, bool HasHeader, IReadOnlyList<string> Mapping, bool Replace);

    /// <summary>Imports the rows: the mapping says, per CSV column, which column of the list it fills (or a new one, or copies/active, or nothing).</summary>
    public static async Task<int> ImportAsync(Biz biz, long id, ImportRequest request)
    {
        biz.RequireDesigner();
        var list = await biz.Db.DataList.FirstOrDefaultAsync(l => l.Id == id) ?? throw new BizException("Die Datenliste gibt es nicht mehr.");
        var table = ReadTable(request.Text);
        var width = table.Rows.Max(r => r.Count);
        var headers = request.HasHeader ? Pad(table.Rows[0], width) : [.. Enumerable.Range(1, width).Select(n => $"Spalte {n}")];
        var body = (request.HasHeader ? table.Rows.Skip(1) : table.Rows).Select(r => Pad(r, width)).ToList();

        var columns = ColumnsOf(list).ToList();
        var targets = new string[width];
        var taken = columns.Select(c => c.Key).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var added = new List<ColumnDef>();
        for (var i = 0; i < width; i++)
        {
            var wish = i < request.Mapping.Count ? request.Mapping[i] : MapIgnore;
            if (wish == MapNew)
            {
                var column = NewColumn(headers[i], body.Select(r => r[i]), taken, columns.Count + added.Count);
                if (column is null)
                {
                    wish = MapIgnore;
                }
                else
                {
                    added.Add(column);
                    wish = column.Key;
                }
            }
            else if (wish is not (MapIgnore or MapCopies or MapActive))
            {
                wish = columns.FirstOrDefault(c => c.Key.Equals(wish, StringComparison.OrdinalIgnoreCase))?.Key ?? MapIgnore;
            }

            targets[i] = wish;
        }

        columns.AddRange(added);
        var existingCount = request.Replace ? 0 : await biz.Db.DataRow.CountAsync(r => r.DataListId == id);
        if (existingCount + body.Count > MaxRows)
        {
            throw new BizException($"Eine Datenliste hat höchstens {Services.Fmt.Integer(MaxRows)} Zeilen: {Services.Fmt.Integer(existingCount)} sind da, {Services.Fmt.Integer(body.Count)} kämen dazu.");
        }

        if (request.Replace)
        {
            await biz.Db.DataRow.Where(r => r.DataListId == id).ExecuteDeleteAsync();
        }

        var position = existingCount == 0 ? 0 : await biz.Db.DataRow.Where(r => r.DataListId == id).MaxAsync(r => r.Position) + 1;
        foreach (var cells in body)
        {
            var values = new Dictionary<string, string>(StringComparer.Ordinal);
            var copies = 1;
            var active = true;
            for (var i = 0; i < width; i++)
            {
                var target = targets[i];
                var cell = cells[i];
                if (target == MapIgnore)
                {
                    continue;
                }

                if (target == MapCopies)
                {
                    copies = int.TryParse(cell.Trim(), out var n) ? Math.Clamp(n, 1, 999) : 1;
                }
                else if (target == MapActive)
                {
                    active = ParseYes(cell);
                }
                else if (cell.Length > 0)
                {
                    values[target] = cell.Length > MaxValueLength ? cell[..MaxValueLength] : cell;
                }
            }

            biz.Db.DataRow.Add(new DataRow { DataListId = id, Position = position++, ValuesJson = ToJson(values), Copies = copies, IsActive = active });
        }

        if (added.Count > 0)
        {
            list.ColumnsJson = ColumnDefs.ToJson(columns);
        }

        list.Revision++;
        await SaveWithRevisionAsync(biz, list);
        await biz.Log.LogAsync("Zeilen importiert", nameof(DataList), id, $"{list.Name}: {body.Count} Zeilen{(request.Replace ? " (ersetzt)" : "")}");
        return body.Count;
    }

    private static bool ParseYes(string text)
        => text.Trim().ToLowerInvariant() is not ("nein" or "n" or "no" or "false" or "0" or "aus" or "-");

    /// <summary>A column for a header of the CSV: a key made of the header, a type guessed from the values (price when the header says so and the values are numbers).</summary>
    private static ColumnDef? NewColumn(string header, IEnumerable<string> values, HashSet<string> taken, int count)
    {
        if (count >= 100 || string.IsNullOrWhiteSpace(header))
        {
            return null;
        }

        var key = KeyFromHeader(header);
        var candidate = key;
        for (var n = 2; taken.Contains(candidate); n++)
        {
            candidate = key[..Math.Min(key.Length, 37)] + "_" + n;
        }

        taken.Add(candidate);
        var filled = values.Where(v => !string.IsNullOrWhiteSpace(v)).Take(200).ToList();
        var numeric = filled.Count > 0 && filled.All(v => ValueFormat.ParseNumber(v) is not null);
        var type = numeric && System.Text.RegularExpressions.Regex.IsMatch(header, "preis|price|betrag|€|eur", System.Text.RegularExpressions.RegexOptions.IgnoreCase) ? "price" : numeric ? "number" : "text";
        return new ColumnDef(candidate, header.Trim().Length > 80 ? header.Trim()[..80] : header.Trim(), type, type == "price" ? 2 : null, null);
    }

    /// <summary>"Fett i. Tr." becomes "FettiTr": letters and digits only, umlauts written out, starting with a letter.</summary>
    public static string KeyFromHeader(string header)
    {
        var sb = new StringBuilder();
        foreach (var ch in header.Trim().Replace("ä", "ae").Replace("ö", "oe").Replace("ü", "ue").Replace("Ä", "Ae").Replace("Ö", "Oe").Replace("Ü", "Ue").Replace("ß", "ss"))
        {
            if (char.IsAsciiLetterOrDigit(ch) || ch == '_')
            {
                sb.Append(ch);
            }
            else if (ch is ' ' or '-' or '.')
            {
                // words are joined: "Milch art" becomes "MilchArt" only when the next letter is lower case, so a plain join keeps what was typed
            }
        }

        var key = sb.ToString();
        if (key.Length == 0 || !char.IsAsciiLetter(key[0]))
        {
            key = "Spalte" + key;
        }

        return key.Length > 40 ? key[..40] : key;
    }
}
