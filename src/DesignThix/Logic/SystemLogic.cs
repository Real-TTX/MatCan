using DesignThix.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Logic;

/// <summary>The activity log and the facts of the system page.</summary>
public static class SystemLogic
{
    public static IQueryable<ActivityLog> Activity(Biz biz)
    {
        biz.RequireAdmin();
        return biz.Db.ActivityLog.AsNoTracking();
    }

    public sealed record Facts(int Users, int AiRuns, string Database);

    public static async Task<Facts> FactsAsync(Biz biz)
    {
        biz.RequireAdmin();
        var db = biz.Db;
        var version = "";
        try
        {
            await db.Database.OpenConnectionAsync();
            await using var command = db.Database.GetDbConnection().CreateCommand();
            command.CommandText = "SHOW server_version";
            version = "PostgreSQL " + await command.ExecuteScalarAsync();
        }
        finally
        {
            await db.Database.CloseConnectionAsync();
        }

        return new Facts(await db.User.CountAsync(), await db.AiRun.CountAsync(), version);
    }
}
