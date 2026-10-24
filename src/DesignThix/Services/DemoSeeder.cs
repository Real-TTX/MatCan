using System.Reflection;
using System.Text.Json;
using DesignThix.Core.Data;
using DesignThix.Core.Documents;
using DesignThix.Data;
using DesignThix.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Services;

/// <summary>
/// Puts the demo into a database that has no designs and no data lists yet: the template "Käsetheke – Preisschild", the data list "Käsetheke (Beispiel)"
/// and the output job "Käsetheke – A4 mit 4 Etiketten". It runs once per database: the day it ran is remembered in the setting <see cref="Marker"/>
/// (also when the database was not empty), so a demo that was deleted does not come back at the next start. The content is the embedded file
/// <c>Demo/kaesetheke.json</c>, the same file the browser checks read. Must run after <see cref="LibrarySeeder"/> (the demo needs its media and sheet layouts).
/// </summary>
public static class DemoSeeder
{
    public const string Marker = "Demo.Seeded";

    private const string ResourceName = "DesignThix.Demo.kaesetheke.json";

    public static async Task SeedAsync(IServiceProvider services, ILogger logger, CancellationToken ct = default)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DtDbContext>();
        var clock = scope.ServiceProvider.GetRequiredService<TimeProvider>();
        if (await db.Setting.AnyAsync(s => s.Key == Marker, ct))
        {
            return;
        }

        var empty = !await db.Design.IgnoreQueryFilters().AnyAsync(ct)
            && !await db.DataList.IgnoreQueryFilters().AnyAsync(ct)
            && !await db.OutputJob.IgnoreQueryFilters().AnyAsync(ct);
        if (empty)
        {
            await AddDemoAsync(db, logger, ct);
        }

        db.Setting.Add(new Setting { Key = Marker, Value = clock.GetUtcNow().ToString("yyyy-MM-dd") });
        await db.SaveChangesAsync(ct);
        if (empty)
        {
            logger.LogInformation("The demo (template, data list and output job) was added.");
        }
    }

    private static async Task AddDemoAsync(DtDbContext db, ILogger logger, CancellationToken ct)
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(ResourceName);
        if (stream is null)
        {
            logger.LogWarning("The demo file is not part of the assembly.");
            return;
        }

        using var file = JsonDocument.Parse(stream);
        var root = file.RootElement;
        var check = DocumentValidator.Validate(root.GetProperty("document").GetRawText());
        if (!check.Ok || check.Document is null || check.Json is null)
        {
            logger.LogWarning("The demo document is not valid: {Error}", check.Error);
            return;
        }

        var meta = root.GetProperty("design");
        var design = new Design
        {
            Name = meta.GetProperty("name").GetString() ?? "Demo",
            Category = meta.GetProperty("category").GetString(),
            Description = meta.GetProperty("description").GetString(),
            IsTemplate = true,
            DocumentJson = check.Json,
            Revision = 1,
            Width = check.Document.Width,
            Height = check.Document.Height,
            Unit = check.Document.Unit,
        };
        design.Revisions.Add(new DesignRevision { Revision = 1, DocumentJson = check.Json });
        db.Design.Add(design);

        var listMeta = root.GetProperty("list");
        var list = new DataList
        {
            Name = listMeta.GetProperty("name").GetString() ?? "Demo",
            Description = listMeta.GetProperty("description").GetString(),
            ColumnsJson = ColumnDefs.ToJson(ColumnDefs.FromFields(check.Document.Fields)),
        };
        var position = 0;
        foreach (var row in root.GetProperty("rows").EnumerateArray())
        {
            var values = row.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.GetString() ?? "");
            list.Rows.Add(new DataRow { Position = position++, ValuesJson = JsonSerializer.Serialize(values), Copies = 1, IsActive = true });
        }

        db.DataList.Add(list);

        var outputMeta = root.GetProperty("output");
        var sheetKey = outputMeta.GetProperty("sheet").GetString();
        var sheet = await db.SheetLayout.FirstOrDefaultAsync(s => s.BuiltInKey == sheetKey, ct);
        db.OutputJob.Add(new OutputJob
        {
            Name = outputMeta.GetProperty("name").GetString() ?? "Demo",
            Design = design,
            DataList = list,
            RowSelection = OutputRowSelection.Active,
            Copies = 1,
            Mode = sheet is null ? OutputMode.Single : OutputMode.Sheet,
            SheetLayout = sheet,
            Format = OutputFormat.Print,
            Scale = OutputScale.Fit,
        });
    }
}
