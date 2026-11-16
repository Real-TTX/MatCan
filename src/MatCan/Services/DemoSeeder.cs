using System.Reflection;
using System.Text.Json;
using MatCan.Core.Data;
using MatCan.Core.Documents;
using MatCan.Data;
using MatCan.Data.Entities;
using MatCan.Logic;
using Microsoft.EntityFrameworkCore;

namespace MatCan.Services;

/// <summary>
/// Puts the demo into a database that has no designs and no data lists yet: the template "Käsetheke – Preisschild", the data list "Käsetheke (Beispiel)"
/// and the output job "Käsetheke – A4 mit 4 Etiketten". It runs once per database: the day it ran is remembered in the setting <see cref="Marker"/>
/// (also when the database was not empty), so a demo that was deleted does not come back at the next start. The content is the embedded file
/// <c>Demo/kaesetheke.json</c>, the same file the browser checks read. Must run after <see cref="LibrarySeeder"/> (the demo needs its media and sheet layouts).
/// </summary>
public static class DemoSeeder
{
    public const string Marker = "Demo.Seeded";

    /// <summary>Set when the data list and the output job of the demo were put into somebody's personal area (or were there already).</summary>
    public const string PersonalMarker = "Demo.PersonalSeeded";

    private const string ResourceName = "MatCan.Demo.kaesetheke.json";

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
            logger.LogInformation("The demo template was added (the data list and the output job follow when the first administrator is made).");
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
    }

    /// <summary>The metadata of the demo design as the template seeder writes it (key <c>kaesetheke</c>), or null without the demo file.</summary>
    public static TemplateSeeder.TemplateInfo? Info()
    {
        using var file = ReadFile(Microsoft.Extensions.Logging.Abstractions.NullLogger.Instance);
        return file is null ? null : TemplateSeeder.ReadInfo("kaesetheke", file.RootElement, root => root.GetProperty("design"));
    }

    /// <summary>The name of the demo design (it tells the demo template from other templates when a database is migrated).</summary>
    public static string? DesignName()
    {
        using var file = ReadFile(Microsoft.Extensions.Logging.Abstractions.NullLogger.Instance);
        return file?.RootElement.GetProperty("design").GetProperty("name").GetString();
    }

    /// <summary>The embedded demo file as a JSON document (design, list, output and rows).</summary>
    private static JsonDocument? ReadFile(ILogger logger)
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(ResourceName);
        if (stream is null)
        {
            logger.LogWarning("The demo file is not part of the assembly.");
            return null;
        }

        return JsonDocument.Parse(stream);
    }

    /// <summary>
    /// Puts the data list and the output job of the demo into the personal area of <paramref name="user"/> (the first administrator), once per database. The demo design must be there as a system template;
    /// without it, or when the demo was seeded for somebody already, nothing happens.
    /// </summary>
    public static async Task SeedPersonalAsync(DtDbContext db, User user, ILogger logger, CancellationToken ct = default)
    {
        if (await db.Setting.AnyAsync(s => s.Key == PersonalMarker, ct))
        {
            return;
        }

        var personal = user.PersonalSpaceId ?? (await SpaceLogic.EnsurePersonalAsync(db, user)).Id;
        using var file = ReadFile(logger);
        if (file is null)
        {
            return;
        }

        var root = file.RootElement;
        var designName = root.GetProperty("design").GetProperty("name").GetString();
        var design = await db.Design.FirstOrDefaultAsync(d => d.IsTemplate && d.SpaceId == null && d.Name == designName, ct);
        var added = false;
        if (design is not null)
        {
            var check = DocumentValidator.Validate(root.GetProperty("document").GetRawText());
            if (check.Ok && check.Document is not null)
            {
                var listMeta = root.GetProperty("list");
                var list = new DataList
                {
                    Name = listMeta.GetProperty("name").GetString() ?? "Demo",
                    Description = listMeta.GetProperty("description").GetString(),
                    ColumnsJson = ColumnDefs.ToJson(ColumnDefs.FromFields(check.Document.Fields)),
                    SpaceId = personal,
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
                    SpaceId = personal,
                });
                await db.SaveChangesAsync(ct);
                await DataListLogic.RebuildRefsAsync(db, list);
                added = true;
            }
        }

        db.Setting.Add(new Setting { Key = PersonalMarker, Value = DateTime.UtcNow.ToString("yyyy-MM-dd") });
        await db.SaveChangesAsync(ct);
        if (added)
        {
            logger.LogInformation("The demo (data list and output job) was added to the personal area of the first administrator.");
        }
    }
}
