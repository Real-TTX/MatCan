using System.Text.Json;
using DesignThix.Core.Documents;
using DesignThix.Data;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Services;

/// <summary>
/// The data migration of plan 3 (docs/PLAN-PLATFORM.md section 6), run once per database right after the schema migration <c>Platform</c> and before anything else touches the data: it is
/// idempotent (the setting <see cref="Marker"/>), runs in ONE transaction and does what the schema migration cannot (it needs the old roles, which the new <c>UserRole</c> cannot even read):
/// <list type="number">
/// <item>every user: Designer and Viewer become Member, Approved, and get a personal area (Owner);</item>
/// <item>when the database holds content of people (designs that are not built-in templates, data lists, output jobs, uploaded images or fonts, own sheet layouts, a brand kit) the team
/// "Gemeinsamer Bereich" is made with every user (Admin = Owner, Designer = Editor, Viewer = Viewer) and takes all that content, so everybody keeps exactly the rights they had; the global
/// brand kit becomes the team's;</item>
/// <item>built-in templates and the demo template stay system templates (no area, everybody may view them); templates somebody made go to the team;</item>
/// <item>the references from designs and data lists to their images (<see cref="ItemAssetRef"/>) are filled;</item>
/// <item>a database that had users or the demo before is marked so the demo is not seeded again.</item>
/// </list>
/// </summary>
public static class PlatformMigration
{
    public const string Marker = "Platform.Migrated";

    public const string TeamName = "Gemeinsamer Bereich";

    private sealed class LegacyUser
    {
        public long Id { get; set; }

        public string Role { get; set; } = "";

        public short UpdateState { get; set; }
    }

    private const int Batch = 100;

    /// <summary>Runs the migration when it has not run; returns true when it did.</summary>
    public static async Task<bool> RunAsync(DtDbContext db, ILogger logger, CancellationToken ct = default)
    {
        if (await db.Setting.AnyAsync(s => s.Key == Marker, ct))
        {
            return false;
        }

        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        // 1. the old roles, read before they are replaced
        var legacy = await db.Database.SqlQuery<LegacyUser>($"SELECT \"Id\", \"Role\", \"UpdateState\" FROM \"User\"").ToListAsync(ct);
        await db.Database.ExecuteSqlRawAsync("UPDATE \"User\" SET \"Role\" = 'Member' WHERE \"Role\" IN ('Designer', 'Viewer')", ct);
        await db.Database.ExecuteSqlRawAsync("UPDATE \"User\" SET \"ApprovalState\" = 'Approved' WHERE \"ApprovalState\" IS NULL OR \"ApprovalState\" = ''", ct);
        var roleOf = legacy.ToDictionary(u => u.Id, u => u.Role);
        var users = await db.User.ToListAsync(ct);
        foreach (var user in users)
        {
            await SpaceLogic.EnsurePersonalAsync(db, user);
        }

        // 2. the shared team, when there is content
        var builtInTemplates = BuiltInTemplateNames();
        var brand = db.Setting.FirstOrDefault(s => s.Key == SettingStore.Brand)?.Value;
        var movedAnything = false;
        var hasContent = await db.Design.AnyAsync(d => !d.IsTemplate || !builtInTemplates.Contains(d.Name), ct)
            || await db.DataList.AnyAsync(ct) || await db.OutputJob.AnyAsync(ct)
            || await db.Asset.AnyAsync(a => !a.IsBuiltIn, ct) || await db.Font.AnyAsync(f => !f.IsBuiltIn, ct) || await db.SheetLayout.AnyAsync(s => !s.IsBuiltIn, ct)
            || BrandHasContent(brand);
        if (hasContent && users.Count > 0)
        {
            var team = new Space { Kind = SpaceKind.Team, Name = TeamName, Slug = "gemeinsamer-bereich", Color = "#1fb3d6", Description = "Hier liegt, was vor der Einführung der persönlichen Bereiche allen gehörte.", BrandJson = BrandHasContent(brand) ? brand! : "{}" };
            db.Space.Add(team);
            await db.SaveChangesAsync(ct);
            foreach (var user in users)
            {
                var old = roleOf.GetValueOrDefault(user.Id, "Designer");
                db.SpaceMember.Add(new SpaceMember { SpaceId = team.Id, UserId = user.Id, Role = old == "Admin" ? SpaceRole.Owner : old == "Viewer" ? SpaceRole.Viewer : SpaceRole.Editor });
            }

            await db.SaveChangesAsync(ct);
            var names = builtInTemplates.ToArray();
            await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE \"Design\" SET \"SpaceId\" = {team.Id} WHERE \"SpaceId\" IS NULL AND NOT (\"IsTemplate\" AND \"Name\" = ANY({names}))", ct);
            await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE \"DataList\" SET \"SpaceId\" = {team.Id} WHERE \"SpaceId\" IS NULL", ct);
            await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE \"OutputJob\" SET \"SpaceId\" = {team.Id} WHERE \"SpaceId\" IS NULL", ct);
            await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE \"Asset\" SET \"SpaceId\" = {team.Id} WHERE \"SpaceId\" IS NULL AND NOT \"IsBuiltIn\"", ct);
            await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE \"Font\" SET \"SpaceId\" = {team.Id} WHERE \"SpaceId\" IS NULL AND NOT \"IsBuiltIn\"", ct);
            await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE \"SheetLayout\" SET \"SpaceId\" = {team.Id} WHERE \"SpaceId\" IS NULL AND NOT \"IsBuiltIn\"", ct);
            movedAnything = true;
        }

        // 3. the references of designs and data lists to their images
        await FillReferencesAsync(db, logger, ct);

        // 4. the demo: a database that had one (or users) does not get a second
        if ((users.Count > 0 || await db.Setting.AnyAsync(s => s.Key == DemoSeeder.Marker, ct)) && !await db.Setting.AnyAsync(s => s.Key == DemoSeeder.PersonalMarker, ct))
        {
            db.Setting.Add(new Setting { Key = DemoSeeder.PersonalMarker, Value = DateTime.UtcNow.ToString("yyyy-MM-dd") });
        }

        db.Setting.Add(new Setting { Key = Marker, Value = DateTime.UtcNow.ToString("yyyy-MM-dd") });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        if (users.Count > 0)
        {
            logger.LogInformation("The platform migration ran: {Users} users got a personal area{Team}.", users.Count, movedAnything ? $", the content went into the team \"{TeamName}\"" : "");
        }

        return true;
    }

    private static bool BrandHasContent(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return false;
        }

        try
        {
            var kit = JsonSerializer.Deserialize<BrandKit>(json, new JsonSerializerOptions(JsonSerializerDefaults.Web));
            return kit is not null && ((kit.Colors?.Count ?? 0) > 0 || (kit.Logos?.Count ?? 0) > 0 || !string.IsNullOrWhiteSpace(kit.Fonts?.Heading) || !string.IsNullOrWhiteSpace(kit.Fonts?.Subheading) || !string.IsNullOrWhiteSpace(kit.Fonts?.Body));
        }
        catch (JsonException)
        {
            return false;
        }
    }

    /// <summary>The names of the templates the app ships (the ten built-in ones and the demo): they stay system templates.</summary>
    private static HashSet<string> BuiltInTemplateNames()
    {
        var names = new HashSet<string>(StringComparer.Ordinal);
        foreach (var slug in TemplateSeeder.Slugs())
        {
            try
            {
                using var file = JsonDocument.Parse(TemplateSeeder.Read(slug) ?? "{}");
                if (file.RootElement.TryGetProperty("name", out var name) && name.GetString() is { } text)
                {
                    names.Add(text);
                }
            }
            catch (JsonException)
            {
                // a file that cannot be read has no name to protect
            }
        }

        if (DemoSeeder.DesignName() is { } demo)
        {
            names.Add(demo);
        }

        return names;
    }

    /// <summary>Fills <see cref="ItemAssetRef"/> for every design and data list that has none yet (the migration; also safe to call again).</summary>
    public static async Task FillReferencesAsync(DtDbContext db, ILogger logger, CancellationToken ct = default)
    {
        long last = 0;
        while (true)
        {
            var designs = await db.Design.AsNoTracking().Where(d => d.Id > last).OrderBy(d => d.Id).Take(Batch).Select(d => new { d.Id, d.DocumentJson }).ToListAsync(ct);
            if (designs.Count == 0)
            {
                break;
            }

            foreach (var design in designs)
            {
                last = design.Id;
                var document = DocumentValidator.Parse(design.DocumentJson);
                if (document is null)
                {
                    logger.LogWarning("The images of design {Id} could not be listed: the document cannot be read.", design.Id);
                    continue;
                }

                await AssetRefs.SyncAsync(db, ItemKind.Design, design.Id, AssetRefs.KeysOf(document));
            }

            await db.SaveChangesAsync(ct);
            db.ChangeTracker.Clear();
        }

        last = 0;
        while (true)
        {
            var lists = await db.DataList.AsNoTracking().Where(l => l.Id > last).OrderBy(l => l.Id).Take(Batch).Select(l => new { l.Id, l.ColumnsJson }).ToListAsync(ct);
            if (lists.Count == 0)
            {
                break;
            }

            foreach (var list in lists)
            {
                last = list.Id;
                var rows = await db.DataRow.AsNoTracking().Where(r => r.DataListId == list.Id).Select(r => r.ValuesJson).ToListAsync(ct);
                await AssetRefs.SyncAsync(db, ItemKind.DataList, list.Id, AssetRefs.KeysOf(list.ColumnsJson, rows.Select(DataListLogic.ParseValues)));
            }

            await db.SaveChangesAsync(ct);
            db.ChangeTracker.Clear();
        }
    }
}
