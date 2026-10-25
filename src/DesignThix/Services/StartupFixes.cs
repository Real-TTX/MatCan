using DesignThix.Core.Documents;
using DesignThix.Data;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Services;

/// <summary>
/// Data fixes that run at start-up, after the migrations and the seeders, and are safe to run again: the stored documents of designs and of their history are brought to
/// document schema 2 (pages) once, and the media category of earlier uploads is renamed to "Uploads" once.
/// </summary>
public static class StartupFixes
{
    /// <summary>The setting that remembers that the category of earlier uploads was renamed (it is done once, so a category that somebody chooses later stays).</summary>
    public const string UploadsMarker = "Media.UploadsCategory";

    private const int Batch = 100;

    public static async Task RunAsync(IServiceProvider services, ILogger logger, CancellationToken ct = default)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DtDbContext>();
        await UpgradeDocumentsAsync(db, logger, ct);
        await RenameUploadsCategoryAsync(db, logger, ct);
    }

    /// <summary>
    /// Writes every stored document that is not schema 2 again as schema 2 (the schema 1 background and elements become the first page). Designs and design revisions;
    /// the revision number, the audit columns and the thumbnail stay. A document that cannot be read is left as it is and named in the log. Returns (designs, revisions).
    /// </summary>
    public static async Task<(int Designs, int Revisions)> UpgradeDocumentsAsync(DtDbContext db, ILogger logger, CancellationToken ct = default)
    {
        var designs = 0;
        var revisions = 0;

        long last = 0;
        while (true)
        {
            var ids = await db.Database.SqlQuery<long>($"SELECT \"Id\" AS \"Value\" FROM \"Design\" WHERE (\"DocumentJson\"->>'schema') IS DISTINCT FROM '2' AND \"Id\" > {last} ORDER BY \"Id\" LIMIT {Batch}").ToListAsync(ct);
            if (ids.Count == 0)
            {
                break;
            }

            foreach (var id in ids)
            {
                last = id;
                var json = await db.Design.IgnoreQueryFilters().Where(d => d.Id == id).Select(d => d.DocumentJson).FirstOrDefaultAsync(ct);
                var upgraded = Upgraded(json, $"design {id}", logger);
                if (upgraded is null)
                {
                    continue;
                }

                await db.Design.IgnoreQueryFilters().Where(d => d.Id == id).ExecuteUpdateAsync(s => s.SetProperty(d => d.DocumentJson, upgraded), ct);
                designs++;
            }
        }

        last = 0;
        while (true)
        {
            var ids = await db.Database.SqlQuery<long>($"SELECT \"Id\" AS \"Value\" FROM \"DesignRevision\" WHERE (\"DocumentJson\"->>'schema') IS DISTINCT FROM '2' AND \"Id\" > {last} ORDER BY \"Id\" LIMIT {Batch}").ToListAsync(ct);
            if (ids.Count == 0)
            {
                break;
            }

            foreach (var id in ids)
            {
                last = id;
                var json = await db.DesignRevision.IgnoreQueryFilters().Where(r => r.Id == id).Select(r => r.DocumentJson).FirstOrDefaultAsync(ct);
                var upgraded = Upgraded(json, $"design revision {id}", logger);
                if (upgraded is null)
                {
                    continue;
                }

                await db.DesignRevision.IgnoreQueryFilters().Where(r => r.Id == id).ExecuteUpdateAsync(s => s.SetProperty(r => r.DocumentJson, upgraded), ct);
                revisions++;
            }
        }

        if (designs + revisions > 0)
        {
            logger.LogInformation("{Designs} designs and {Revisions} earlier states of designs were upgraded to document schema 2 (pages).", designs, revisions);
        }

        return (designs, revisions);
    }

    private static string? Upgraded(string? json, string what, ILogger logger)
    {
        var result = DocumentValidator.Validate(json);
        if (!result.Ok || result.Json is null)
        {
            logger.LogWarning("The document of {What} was not upgraded: {Error}", what, result.Error);
            return null;
        }

        return result.Json;
    }

    /// <summary>Uploads of people used to go to "Sonstiges"; they are now "Uploads". Built-in images are left alone (Flaggen, Siegel). Once per database.</summary>
    public static async Task<int> RenameUploadsCategoryAsync(DtDbContext db, ILogger logger, CancellationToken ct = default)
    {
        if (await db.Setting.AnyAsync(s => s.Key == UploadsMarker, ct))
        {
            return 0;
        }

        var changed = await db.Asset.IgnoreQueryFilters().Where(a => !a.IsBuiltIn && a.Category == "Sonstiges").ExecuteUpdateAsync(s => s.SetProperty(a => a.Category, AssetLogic.UploadsCategory), ct);
        db.Setting.Add(new Setting { Key = UploadsMarker, Value = DateTime.UtcNow.ToString("yyyy-MM-dd") });
        await db.SaveChangesAsync(ct);
        if (changed > 0)
        {
            logger.LogInformation("{Count} earlier uploads were moved to the category \"Uploads\".", changed);
        }

        return changed;
    }
}
