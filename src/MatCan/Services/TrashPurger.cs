using MatCan.Data;
using MatCan.Logic;

namespace MatCan.Services;

/// <summary>
/// Empties the trash by itself (docs/PLAN-PLATFORM.md section 1.4): once an hour everything that has been in the trash for longer than the days of the platform settings (<c>trashDays</c>, 30
/// by default) is deleted for good in every area. The bytes of images are let go, so the storage of the area is free again.
/// </summary>
public sealed class TrashPurger(IServiceScopeFactory scopes, SettingStore settings, TimeProvider clock, ILogger<TrashPurger> logger) : BackgroundService
{
    public static readonly TimeSpan Interval = TimeSpan.FromHours(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // a minute after the start, then every hour: the start-up has other work, and a restart loop must not hammer the database
        try
        {
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await RunOnceAsync(null, stoppingToken);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogWarning(ex, "The trash could not be emptied.");
                }

                await Task.Delay(Interval, stoppingToken);
            }
        }
        catch (OperationCanceledException)
        {
            // the app is stopping
        }
    }

    /// <summary>One round: deletes for good what is older than the cutoff (by default the days of the settings back from now). Returns how many items went.</summary>
    public async Task<int> RunOnceAsync(DateTime? cutoff = null, CancellationToken ct = default)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DtDbContext>();
        var days = Math.Max(0, settings.Get<PlatformSettings>(SettingStore.Platform).TrashDays);
        var limit = cutoff ?? clock.GetUtcNow().UtcDateTime.AddDays(-days);
        var count = await ItemLogic.PurgeOlderAsync(db, limit);
        if (count > 0)
        {
            logger.LogInformation("{Count} items were deleted from the trash.", count);
        }

        return count;
    }
}
