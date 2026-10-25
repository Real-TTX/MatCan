using DesignThix.Data;
using DesignThix.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Logic;

/// <summary>How much of its storage an area uses: images and fonts count (also while they wait in the trash), against the limit of the area or the default of the platform.</summary>
public sealed record StorageUsage(long UsedBytes, long QuotaBytes)
{
    public double Fraction => QuotaBytes <= 0 ? 1 : Math.Min(1, (double)UsedBytes / QuotaBytes);

    public long FreeBytes => Math.Max(0, QuotaBytes - UsedBytes);
}

/// <summary>Storage quotas (docs/PLAN-PLATFORM.md section 3): the used bytes of an area, its limit, and the check that an upload, a font or an import must pass before anything is written.</summary>
public static class StorageLogic
{
    private const long Mb = 1024L * 1024;

    /// <summary>The bytes of the images and fonts of an area that are not deleted.</summary>
    public static async Task<long> UsedBytesAsync(DtDbContext db, long spaceId)
    {
        var assets = await db.Asset.Where(a => a.SpaceId == spaceId).SumAsync(a => (long?)a.SizeBytes) ?? 0;
        var fonts = await db.Font.Where(f => f.SpaceId == spaceId).SumAsync(f => (long?)f.SizeBytes) ?? 0;
        return assets + fonts;
    }

    /// <summary>The limit of an area: its own when the administrator set one, else the default for a personal area or a team.</summary>
    public static async Task<long> QuotaBytesAsync(DtDbContext db, PlatformSettings platform, long spaceId)
    {
        var space = await db.Space.AsNoTracking().Where(s => s.Id == spaceId).Select(s => new { s.Kind, s.StorageQuotaBytes }).FirstOrDefaultAsync();
        if (space is null)
        {
            return 0;
        }

        return space.StorageQuotaBytes ?? (space.Kind == SpaceKind.Personal ? platform.PersonalQuotaMb : platform.TeamQuotaMb) * Mb;
    }

    /// <summary>Used and limit of an area the person may look at (a member).</summary>
    public static async Task<StorageUsage> UsageAsync(Biz biz, long spaceId)
    {
        await Access.RequireSpaceRole(biz, spaceId, SpaceRole.Viewer);
        return new StorageUsage(await UsedBytesAsync(biz.Db, spaceId), await QuotaBytesAsync(biz.Db, biz.Platform, spaceId));
    }

    /// <summary>Refuses (with a message for the person) when <paramref name="additionalBytes"/> more would not fit into the area.</summary>
    public static async Task RequireRoomAsync(Biz biz, long spaceId, long additionalBytes)
    {
        if (additionalBytes <= 0)
        {
            return;
        }

        var used = await UsedBytesAsync(biz.Db, spaceId);
        var quota = await QuotaBytesAsync(biz.Db, biz.Platform, spaceId);
        if (used + additionalBytes > quota)
        {
            var name = await biz.Db.Space.AsNoTracking().Where(s => s.Id == spaceId).Select(s => s.Kind == SpaceKind.Personal ? "Meine Projekte" : s.Name).FirstOrDefaultAsync() ?? "Der Bereich";
            throw new BizException($"Der Speicherplatz von „{name}“ reicht nicht: {Services.Fmt.FileSize(used)} von {Services.Fmt.FileSize(quota)} sind belegt, die Datei braucht {Services.Fmt.FileSize(additionalBytes)}.");
        }
    }

    /// <summary>Sets the limit of one area (administrators); null = the default of the platform.</summary>
    public static async Task SetQuotaAsync(Biz biz, long spaceId, long? quotaBytes)
    {
        biz.RequireAdmin();
        if (quotaBytes is < 0)
        {
            throw new BizException("Der Speicherplatz darf nicht negativ sein.");
        }

        var space = await biz.Db.Space.FirstOrDefaultAsync(s => s.Id == spaceId) ?? throw new NotFoundException();
        space.StorageQuotaBytes = quotaBytes;
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Speicherplatz geändert", nameof(Space), spaceId, quotaBytes is null ? "Standard" : Services.Fmt.FileSize(quotaBytes.Value));
    }
}
