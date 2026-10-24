using System.Text.Json;
using DesignThix.Core.Data;
using DesignThix.Core.Documents;
using DesignThix.Core.Output;
using DesignThix.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Logic;

/// <summary>An output job in the list: the names of what it points to (a design or list that was deleted is null) and the figures of its last run.</summary>
public sealed record OutputRow
{
    public long Id { get; init; }

    public string Name { get; init; } = "";

    public long DesignId { get; init; }

    public string? DesignName { get; init; }

    public string? DesignThumbnailHash { get; init; }

    public long? DataListId { get; init; }

    public string? DataListName { get; init; }

    public OutputRowSelection RowSelection { get; init; }

    public string SelectedRowIdsJson { get; init; } = "[]";

    public int Copies { get; init; }

    public OutputMode Mode { get; init; }

    public OutputFormat Format { get; init; }

    public int Dpi { get; init; }

    public DateTime? LastRunDate { get; init; }

    public string? LastRunUserName { get; init; }

    public DateTime UpdateDate { get; init; }

    public string? DesignThumbnailUrl => DesignThumbnailHash is null ? null : $"/designs/{DesignId}/thumbnail.png?v={DesignThumbnailHash[..Math.Min(12, DesignThumbnailHash.Length)]}";
}

/// <summary>How the sheet looks that the labels are placed on (all lengths in mm).</summary>
public sealed record PayloadSheet(string Name, double PaperWidth, double PaperHeight, double MarginTop, double MarginLeft, int Columns, int Rows, double CellWidth, double CellHeight, double GapX, double GapY);

/// <summary>One entry of the labels of a run: the values of the fields and how often the label is made (copies of the row times copies of the job).</summary>
public sealed record PayloadLabel(long? RowId, int Copies, IReadOnlyDictionary<string, string> Values);

/// <summary>A font face the run page registers before it draws (the family names the faces of the families the design uses).</summary>
public sealed record PayloadFont(string Family, string Weight, string Style, string Url);

/// <summary>
/// Everything the run page needs to render a job in the browser: the document, the labels, the sheet, the fonts, the media (key in lower case → address with a hash)
/// and the warnings that are known before anything is drawn. <see cref="Id"/> is null for a single print (no job is saved, no run is recorded).
/// </summary>
public sealed record OutputPayload(
    long? Id,
    string Name,
    string DesignName,
    string Mode,
    string Format,
    int Dpi,
    bool CropMarks,
    string Scale,
    int StartPosition,
    string FileNamePattern,
    string DocumentJson,
    PayloadSheet? Sheet,
    IReadOnlyList<PayloadLabel> Labels,
    long LabelCount,
    IReadOnlyList<PayloadFont> Fonts,
    IReadOnlyDictionary<string, string> Assets,
    IReadOnlyList<string> Warnings);

/// <summary>What a single print (<c>/Designs/{id}/Print</c>) asks for: typed values for the fields of a design, copies and how to lay them out.</summary>
public sealed record AdhocRequest(
    long DesignId,
    IReadOnlyDictionary<string, string>? Values,
    int Copies,
    string? Mode,
    long? SheetLayoutId,
    bool CropMarks,
    string? Scale,
    int StartPosition,
    string? Format,
    int? Dpi,
    string? FileNamePattern);

/// <summary>
/// Outputs: saved batch runs (design + data list + selection + layout + format) and the data the run page renders them from. Designers and administrators
/// change jobs; everybody who is signed in may read them and run them (the run is rendered in the browser, nothing is changed but the time of the last run).
/// </summary>
public static class OutputLogic
{
    public const string DefaultFileNamePattern = "{Design}-{Nr}";

    private const int MaxValueLength = 2000;

    // ------------------------------------------------------------------------------------------------ reading

    public static IQueryable<OutputRow> Query(Biz biz)
    {
        biz.RequireSignedIn();
        var db = biz.Db;
        return from j in db.OutputJob.AsNoTracking()
               join d in db.Design.AsNoTracking() on j.DesignId equals d.Id into designs
               from d in designs.DefaultIfEmpty()
               join l in db.DataList.AsNoTracking() on j.DataListId equals l.Id into lists
               from l in lists.DefaultIfEmpty()
               join u in db.User.AsNoTracking() on j.LastRunUserId equals u.Id into users
               from u in users.DefaultIfEmpty()
               select new OutputRow
               {
                   Id = j.Id,
                   Name = j.Name,
                   DesignId = j.DesignId,
                   DesignName = d == null ? null : d.Name,
                   DesignThumbnailHash = d == null ? null : d.ThumbnailHash,
                   DataListId = j.DataListId,
                   DataListName = l == null ? null : l.Name,
                   RowSelection = j.RowSelection,
                   SelectedRowIdsJson = j.SelectedRowIdsJson,
                   Copies = j.Copies,
                   Mode = j.Mode,
                   Format = j.Format,
                   Dpi = j.Dpi,
                   LastRunDate = j.LastRunDate,
                   LastRunUserName = u == null ? null : u.DisplayName,
                   UpdateDate = j.UpdateDate,
               };
    }

    public static async Task<OutputJob?> GetAsync(Biz biz, long id)
    {
        biz.RequireSignedIn();
        return await biz.Db.OutputJob.AsNoTracking().FirstOrDefaultAsync(j => j.Id == id);
    }

    public static async Task<int> CountAsync(Biz biz)
    {
        biz.RequireSignedIn();
        return await biz.Db.OutputJob.CountAsync();
    }

    /// <summary>The jobs worked on or run last, for the start page.</summary>
    public static async Task<List<OutputRow>> RecentAsync(Biz biz, int take)
        => await Query(biz).OrderByDescending(o => o.LastRunDate ?? o.UpdateDate).Take(take).ToListAsync();

    /// <summary>The ids of the rows a job selected (the list of the "Auswahl" tab), as saved.</summary>
    public static IReadOnlyList<long> SelectedIds(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        try
        {
            return JsonSerializer.Deserialize<List<long>>(json)?.Where(id => id > 0).Distinct().ToList() ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    /// <summary>How many labels a job makes and from how many rows of its list (null without a list).</summary>
    public sealed record LabelCount(long Labels, int? Rows);

    /// <summary>The number of labels each of the jobs makes (by the rows of its list as they are now); a job without a list makes one label per copy.</summary>
    public static async Task<Dictionary<long, LabelCount>> LabelCountsAsync(Biz biz, IEnumerable<OutputRow> jobs)
    {
        biz.RequireSignedIn();
        var list = jobs.ToList();
        var rowsByList = new Dictionary<long, List<PlanRow>>();
        foreach (var listId in list.Where(j => j.DataListId is not null).Select(j => j.DataListId!.Value).Distinct())
        {
            rowsByList[listId] = await PlanRowsAsync(biz, listId);
        }

        var counts = new Dictionary<long, LabelCount>();
        foreach (var job in list)
        {
            if (job.DataListId is { } listId && rowsByList.TryGetValue(listId, out var rows))
            {
                var selected = SelectedIds(job.SelectedRowIdsJson).ToHashSet();
                counts[job.Id] = new LabelCount(OutputPlan.LabelCount(rows, job.RowSelection.ToString(), selected, job.Copies), OutputPlan.Select(rows, job.RowSelection.ToString(), selected).Count);
            }
            else
            {
                counts[job.Id] = new LabelCount(Math.Clamp(job.Copies, 1, OutputPlan.MaxCopies), null);
            }
        }

        return counts;
    }

    private static async Task<List<PlanRow>> PlanRowsAsync(Biz biz, long listId)
        => (await biz.Db.DataRow.AsNoTracking().Where(r => r.DataListId == listId).OrderBy(r => r.Position).ThenBy(r => r.Id).Select(r => new { r.Id, r.Copies, r.IsActive }).ToListAsync())
            .Select(r => new PlanRow(r.Id, r.Copies, r.IsActive)).ToList();

    // ------------------------------------------------------------------------------------------------ saving

    public sealed record OutputInput(
        string Name,
        long DesignId,
        long? DataListId,
        OutputRowSelection RowSelection,
        IReadOnlyList<long> SelectedRowIds,
        int Copies,
        OutputMode Mode,
        long? SheetLayoutId,
        bool CropMarks,
        OutputScale Scale,
        int StartPosition,
        OutputFormat Format,
        int? Dpi,
        string? FileNamePattern);

    public static async Task<OutputJob> SaveAsync(Biz biz, long? id, OutputInput input)
    {
        biz.RequireDesigner();
        var name = (input.Name ?? "").Trim();
        if (name.Length == 0)
        {
            throw new BizException("Bitte gib den Namen ein.", "Input.Name");
        }

        var design = await biz.Db.Design.AsNoTracking().Where(d => d.Id == input.DesignId).Select(d => new { d.Id, d.DocumentJson }).FirstOrDefaultAsync()
            ?? throw new BizException("Bitte wähle ein Design aus.", "Input.DesignId");
        if (input.Copies is < 1 or > OutputPlan.MaxCopies)
        {
            throw new BizException($"Die Anzahl der Kopien liegt zwischen 1 und {OutputPlan.MaxCopies}.", "Input.Copies");
        }

        var selection = input.RowSelection;
        var selected = new List<long>();
        List<PlanRow> rows = [];
        if (input.DataListId is { } listId)
        {
            if (!await biz.Db.DataList.AnyAsync(l => l.Id == listId))
            {
                throw new BizException("Die Datenliste gibt es nicht mehr.", "Input.DataListId");
            }

            rows = await PlanRowsAsync(biz, listId);
            if (selection == OutputRowSelection.Selected)
            {
                var existing = rows.Select(r => r.Id).ToHashSet();
                selected = [.. input.SelectedRowIds.Where(existing.Contains).Distinct()];
                if (selected.Count == 0)
                {
                    throw new BizException("Wähle mindestens eine Zeile aus.", "Input.SelectedRowIds");
                }
            }
        }
        else
        {
            // Without a list the design prints its sample values: there is nothing to select.
            selection = OutputRowSelection.All;
        }

        long? sheetId = null;
        var startPosition = 1;
        var crop = false;
        var scale = OutputScale.Fit;
        if (input.Mode == OutputMode.Sheet && input.Format == OutputFormat.Print)
        {
            var sheet = await biz.Db.SheetLayout.AsNoTracking().Where(s => s.Id == input.SheetLayoutId).Select(s => new { s.Id, s.Columns, s.Rows }).FirstOrDefaultAsync()
                ?? throw new BizException("Bitte wähle einen Druckbogen aus.", "Input.SheetLayoutId");
            sheetId = sheet.Id;
            if (input.StartPosition < 1 || input.StartPosition > sheet.Columns * sheet.Rows)
            {
                throw new BizException($"Die Startposition liegt zwischen 1 und {sheet.Columns * sheet.Rows} (so viele Etiketten hat der Druckbogen).", "Input.StartPosition");
            }

            startPosition = input.StartPosition;
            crop = input.CropMarks;
            scale = input.Scale;
        }

        var dpi = input.Dpi ?? DesignDpi(design.DocumentJson);
        if (input.Format == OutputFormat.Png && dpi is < 72 or > 600)
        {
            throw new BizException("Die Auflösung liegt zwischen 72 und 600 dpi.", "Input.Dpi");
        }

        dpi = Math.Clamp(dpi, 72, 600);
        var pattern = (input.FileNamePattern ?? "").Trim();
        if (pattern.Length > 200)
        {
            throw new BizException("Das Muster für die Dateinamen ist zu lang (höchstens 200 Zeichen).", "Input.FileNamePattern");
        }

        var count = input.DataListId is null ? Math.Clamp(input.Copies, 1, OutputPlan.MaxCopies) : OutputPlan.LabelCount(rows, selection.ToString(), selected.ToHashSet(), input.Copies);
        if (count > OutputPlan.MaxLabels)
        {
            throw new BizException($"Das wären {Services.Fmt.Integer(count)} Etiketten: eine Ausgabe macht höchstens {Services.Fmt.Integer(OutputPlan.MaxLabels)}. Teile die Auswahl auf mehrere Ausgaben auf.", "Input.Copies");
        }

        OutputJob job;
        if (id is null)
        {
            job = new OutputJob();
            biz.Db.OutputJob.Add(job);
        }
        else
        {
            job = await biz.Db.OutputJob.FirstOrDefaultAsync(j => j.Id == id) ?? throw new BizException("Die Ausgabe gibt es nicht mehr.");
        }

        job.Name = name.Length > 200 ? name[..200] : name;
        job.DesignId = design.Id;
        job.DataListId = input.DataListId;
        job.RowSelection = selection;
        job.SelectedRowIdsJson = JsonSerializer.Serialize(selected);
        job.Copies = input.Copies;
        job.Mode = input.Format == OutputFormat.Png ? OutputMode.Single : input.Mode;
        job.SheetLayoutId = sheetId;
        job.CropMarks = crop;
        job.Scale = scale;
        job.StartPosition = startPosition;
        job.Format = input.Format;
        job.Dpi = dpi;
        job.FileNamePattern = pattern.Length == 0 ? DefaultFileNamePattern : pattern;
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync(id is null ? "Ausgabe angelegt" : "Ausgabe geändert", nameof(OutputJob), job.Id, $"{job.Name}: {Services.Fmt.Integer(count)} Etiketten");
        return job;
    }

    private static int DesignDpi(string documentJson) => DocumentValidator.Parse(documentJson)?.Dpi ?? 300;

    public static async Task DeleteAsync(Biz biz, long id)
    {
        biz.RequireDesigner();
        var job = await biz.Db.OutputJob.FirstOrDefaultAsync(j => j.Id == id) ?? throw new BizException("Die Ausgabe gibt es nicht mehr.");
        biz.Db.OutputJob.Remove(job);
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Ausgabe gelöscht", nameof(OutputJob), id, job.Name);
    }

    /// <summary>Notes that a job was run (printed or downloaded): time and person. Does not count as a change of the job (the audit columns stay).</summary>
    public static async Task MarkRanAsync(Biz biz, long id)
    {
        biz.RequireSignedIn();
        var now = biz.Now;
        var userId = biz.UserId;
        var changed = await biz.Db.OutputJob.Where(j => j.Id == id).ExecuteUpdateAsync(s => s.SetProperty(j => j.LastRunDate, now).SetProperty(j => j.LastRunUserId, userId));
        if (changed == 0)
        {
            throw new BizException("Die Ausgabe gibt es nicht mehr.");
        }

        var name = await biz.Db.OutputJob.AsNoTracking().Where(j => j.Id == id).Select(j => j.Name).FirstOrDefaultAsync();
        await biz.Log.LogAsync("Ausgabe ausgeführt", nameof(OutputJob), id, name);
    }

    // ------------------------------------------------------------------------------------------------ the payload of the run page

    private static string ModeName(OutputMode mode) => mode == OutputMode.Sheet ? "sheet" : "single";

    private static string FormatName(OutputFormat format) => format == OutputFormat.Png ? "png" : "print";

    private static string ScaleName(OutputScale scale) => scale == OutputScale.None ? "none" : "fit";

    /// <summary>The data for the run page of a saved job: nothing is drawn on the server, the browser renders it with the engine.</summary>
    public static async Task<OutputPayload> PayloadAsync(Biz biz, long id)
    {
        biz.RequireSignedIn();
        var job = await biz.Db.OutputJob.AsNoTracking().FirstOrDefaultAsync(j => j.Id == id) ?? throw new BizException("Die Ausgabe gibt es nicht mehr.");
        var design = await biz.Db.Design.AsNoTracking().Where(d => d.Id == job.DesignId).Select(d => new { d.Name, d.DocumentJson }).FirstOrDefaultAsync()
            ?? throw new BizException("Das Design dieser Ausgabe gibt es nicht mehr.");
        var document = DocumentValidator.Parse(design.DocumentJson) ?? throw new BizException("Das Design ist beschädigt.");
        var warnings = new List<string>();

        var labels = new List<PayloadLabel>();
        if (job.DataListId is { } listId)
        {
            var list = await biz.Db.DataList.AsNoTracking().FirstOrDefaultAsync(l => l.Id == listId) ?? throw new BizException("Die Datenliste dieser Ausgabe gibt es nicht mehr.");
            var columns = ColumnDefs.Parse(list.ColumnsJson);
            var rows = await biz.Db.DataRow.AsNoTracking().Where(r => r.DataListId == listId).OrderBy(r => r.Position).ThenBy(r => r.Id).ToListAsync();
            var chosen = OutputPlan.Select(rows.Select(r => new PlanRow(r.Id, r.Copies, r.IsActive)), job.RowSelection.ToString(), SelectedIds(job.SelectedRowIdsJson).ToHashSet())
                .Select(p => p.Id).ToHashSet();
            var jobCopies = Math.Clamp(job.Copies, 1, OutputPlan.MaxCopies);
            var usedKeys = UsedKeys(document);
            var samples = SampleValues(document);
            var exactKeys = columns.Where(c => usedKeys.Contains(c.Key)).ToDictionary(c => c.Key, c => ExactKey(document, c.Key), StringComparer.Ordinal);
            foreach (var row in rows.Where(r => chosen.Contains(r.Id)))
            {
                var values = new Dictionary<string, string>(samples, StringComparer.Ordinal);
                var cells = ParseValues(row.ValuesJson);
                foreach (var (columnKey, exactKey) in exactKeys)
                {
                    values[exactKey] = cells.GetValueOrDefault(columnKey, "");
                }

                labels.Add(new PayloadLabel(row.Id, Math.Clamp(row.Copies, 1, OutputPlan.MaxCopies) * jobCopies, values));
            }

            if (labels.Count == 0)
            {
                warnings.Add("Die Auswahl enthält keine Zeile: es gibt nichts zu drucken.");
            }

            var missing = document.Fields.Where(f => columns.All(c => !c.Key.Equals(f.Key, StringComparison.OrdinalIgnoreCase))).Select(f => f.Key).ToList();
            if (missing.Count > 0 && columns.Count > 0)
            {
                warnings.Add($"Die Datenliste hat keine Spalte für {string.Join(", ", missing.Select(k => "„" + k + "“"))}: dort steht der Beispielwert des Designs.");
            }
        }
        else
        {
            labels.Add(new PayloadLabel(null, Math.Clamp(job.Copies, 1, OutputPlan.MaxCopies), SampleValues(document)));
        }

        var sheet = job.Mode == OutputMode.Sheet && job.Format == OutputFormat.Print ? await SheetOfAsync(biz, job.SheetLayoutId) : null;
        return await BuildAsync(biz, job.Id, job.Name, design.Name, design.DocumentJson, document, labels, warnings, ModeName(sheet is null ? OutputMode.Single : OutputMode.Sheet),
            FormatName(job.Format), job.Dpi, job.CropMarks, ScaleName(job.Scale), job.StartPosition, job.FileNamePattern, sheet);
    }

    /// <summary>The data for a single print of a design: no job is saved. Every signed-in person may print (a viewer prints what he sees).</summary>
    public static async Task<OutputPayload> AdhocPayloadAsync(Biz biz, AdhocRequest request)
    {
        biz.RequireSignedIn();
        var design = await biz.Db.Design.AsNoTracking().Where(d => d.Id == request.DesignId).Select(d => new { d.Name, d.DocumentJson }).FirstOrDefaultAsync()
            ?? throw new BizException("Das Design gibt es nicht mehr.");
        var document = DocumentValidator.Parse(design.DocumentJson) ?? throw new BizException("Das Design ist beschädigt.");
        var values = new Dictionary<string, string>(SampleValues(document), StringComparer.Ordinal);
        foreach (var field in document.Fields)
        {
            if (request.Values is not null && request.Values.FirstOrDefault(v => v.Key.Equals(field.Key, StringComparison.OrdinalIgnoreCase)) is { Key: not null } given)
            {
                values[field.Key] = Clip(given.Value ?? "", MaxValueLength);
            }
        }

        var copies = Math.Clamp(request.Copies, 1, OutputPlan.MaxCopies);
        var format = string.Equals(request.Format, "png", StringComparison.OrdinalIgnoreCase) ? OutputFormat.Png : OutputFormat.Print;
        var sheetMode = format == OutputFormat.Print && string.Equals(request.Mode, "sheet", StringComparison.OrdinalIgnoreCase);
        var sheet = sheetMode ? await SheetOfAsync(biz, request.SheetLayoutId) : null;
        var dpi = Math.Clamp(request.Dpi ?? document.Dpi, 72, 600);
        var pattern = string.IsNullOrWhiteSpace(request.FileNamePattern) ? DefaultFileNamePattern : Clip(request.FileNamePattern.Trim(), 200);
        var scale = string.Equals(request.Scale, "none", StringComparison.OrdinalIgnoreCase) ? "none" : "fit";
        return await BuildAsync(biz, null, design.Name, design.Name, design.DocumentJson, document, [new PayloadLabel(null, copies, values)], [], sheet is null ? "single" : "sheet",
            FormatName(format), dpi, sheet is not null && request.CropMarks, scale, request.StartPosition, pattern, sheet);
    }

    private static async Task<PayloadSheet> SheetOfAsync(Biz biz, long? id)
    {
        var s = await biz.Db.SheetLayout.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id) ?? throw new BizException("Der Druckbogen gibt es nicht mehr.");
        return new PayloadSheet(s.Name, s.PaperWidth, s.PaperHeight, s.MarginTop, s.MarginLeft, s.Columns, s.Rows, s.CellWidth, s.CellHeight, s.GapX, s.GapY);
    }

    private static async Task<OutputPayload> BuildAsync(Biz biz, long? id, string name, string designName, string documentJson, DesignDocument document, List<PayloadLabel> labels,
        List<string> warnings, string mode, string format, int dpi, bool cropMarks, string scale, int startPosition, string? pattern, PayloadSheet? sheet)
    {
        long count = labels.Sum(l => (long)l.Copies);
        if (count > OutputPlan.MaxLabels)
        {
            throw new BizException($"Das wären {Services.Fmt.Integer(count)} Etiketten: eine Ausgabe macht höchstens {Services.Fmt.Integer(OutputPlan.MaxLabels)}.");
        }

        var cells = sheet is null ? 1 : sheet.Columns * sheet.Rows;
        if (sheet is not null && (startPosition < 1 || startPosition > cells))
        {
            startPosition = Math.Clamp(startPosition, 1, cells);
        }

        // Media: the keys of the design and the values of the fields that feed an image.
        var wanted = new HashSet<string>(Placeholders.AssetKeys(document).Select(k => k.ToLowerInvariant()), StringComparer.Ordinal);
        var imageFields = ImageFieldKeys(document);
        foreach (var label in labels)
        {
            foreach (var (key, value) in label.Values)
            {
                if (imageFields.Contains(key) && !string.IsNullOrWhiteSpace(value))
                {
                    wanted.Add(value.Trim().ToLowerInvariant());
                }
            }
        }

        var assets = new Dictionary<string, string>(StringComparer.Ordinal);
        if (wanted.Count > 0)
        {
            var keys = wanted.ToList();
            foreach (var asset in await biz.Db.Asset.AsNoTracking().Where(a => keys.Contains(a.Key)).Select(a => new { a.Key, a.ContentHash }).ToListAsync())
            {
                assets[asset.Key] = AssetLogic.Url(asset.Key, asset.ContentHash);
            }

            var missingKeys = keys.Where(k => !assets.ContainsKey(k)).OrderBy(k => k, StringComparer.Ordinal).ToList();
            if (missingKeys.Count > 0)
            {
                warnings.Add($"Medien fehlen: {string.Join(", ", missingKeys.Take(8).Select(k => "„" + k + "“"))}{(missingKeys.Count > 8 ? $" und {missingKeys.Count - 8} weitere" : "")}. Dort bleibt die Fläche leer.");
            }
        }

        // Fonts: the faces of the families the texts use.
        var families = Placeholders.FontFamilies(document);
        var allFonts = families.Count == 0 ? [] : await FontLogic.AllAsync(biz);
        var fonts = new List<PayloadFont>();
        foreach (var family in families)
        {
            var faces = allFonts.Where(f => Placeholders.CleanFamily(f.Family).Equals(family, StringComparison.OrdinalIgnoreCase)).ToList();
            if (faces.Count == 0)
            {
                warnings.Add($"Die Schrift „{family}“ gibt es nicht: es wird eine Ersatzschrift verwendet.");
                continue;
            }

            fonts.AddRange(faces.Select(f => new PayloadFont(f.Family, f.Weight, f.Style, f.Url)));
        }

        return new OutputPayload(id, name, designName, mode, format, dpi, cropMarks, scale, startPosition, string.IsNullOrWhiteSpace(pattern) ? DefaultFileNamePattern : pattern,
            documentJson, sheet, labels, count, fonts, assets, warnings);
    }

    // ------------------------------------------------------------------------------------------------ small helpers

    private static Dictionary<string, string> SampleValues(DesignDocument document)
        => document.Fields.ToDictionary(f => f.Key, f => f.Sample, StringComparer.Ordinal);

    /// <summary>The keys the design uses (fields and placeholders), compared without regard to case.</summary>
    private static HashSet<string> UsedKeys(DesignDocument document)
    {
        var keys = new HashSet<string>(document.Fields.Select(f => f.Key), StringComparer.OrdinalIgnoreCase);
        foreach (var usage in Placeholders.FieldsUsed(document))
        {
            keys.Add(usage.Key);
        }

        return keys;
    }

    /// <summary>The key the design writes a field with ("Name"), or the key of the column when the design only uses the placeholder.</summary>
    private static string ExactKey(DesignDocument document, string columnKey)
        => document.Fields.FirstOrDefault(f => f.Key.Equals(columnKey, StringComparison.OrdinalIgnoreCase))?.Key
           ?? Placeholders.FieldsUsed(document).FirstOrDefault(u => u.Key.Equals(columnKey, StringComparison.OrdinalIgnoreCase))?.Key
           ?? columnKey;

    /// <summary>The fields whose value is an asset key: fields of the type image and every field an image or a strip takes its source from.</summary>
    private static HashSet<string> ImageFieldKeys(DesignDocument document)
    {
        var keys = new HashSet<string>(document.Fields.Where(f => f.Type == "image").Select(f => f.Key), StringComparer.OrdinalIgnoreCase);
        foreach (var usage in Placeholders.FieldsUsed(document).Where(u => u.Uses.Any(use => use.Kind is "image" or "strip")))
        {
            keys.Add(usage.Key);
        }

        return keys;
    }

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

    private static string Clip(string text, int max) => text.Length > max ? text[..max] : text;
}
