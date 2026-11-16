using MatCan.Configuration;
using MatCan.Data;
using MatCan.Data.Entities;
using MatCan.Services;
using Microsoft.EntityFrameworkCore;

namespace MatCan.Logic;

/// <summary>An action is not allowed for the person who asked: the request ends with 403, whatever the page did or did not check.</summary>
public sealed class ForbiddenException(string message = "Dafür fehlt die Berechtigung.") : Exception(message);

/// <summary>
/// The thing does not exist or the person may not even see it (the two look the same, so ids cannot be probed): the request ends with 404. A visible thing with too low a level is a
/// <see cref="ForbiddenException"/> (403).
/// </summary>
public sealed class NotFoundException(string message = "Das gibt es nicht (mehr).") : Exception(message);

/// <summary>A rule of the business was broken ("the slug is taken"): the message is for the person and is shown at the form.</summary>
public sealed class BizException(string message, string? field = null) : Exception(message)
{
    public string? Field { get; } = field;
}

/// <summary>
/// What every operation of the business layer works with: the database, who is acting, the clock and the shared services. The logic itself
/// lives in static classes (<c>UserLogic</c>, <c>AiLogic</c> ...) that take this as their first argument, and every one of them checks
/// the permission itself (<see cref="RequireAdmin"/>, <see cref="RequireSignedIn"/> and, for everything with an owner, <c>Access</c>): a page that forgets to check opens nothing.
/// </summary>
public sealed class Biz(DtDbContext db, ICurrentUser user, TimeProvider clock, ActivityLogger log, SecretProtector secrets, ConfigStore config, IServiceProvider services)
{
    public DtDbContext Db { get; } = db;

    public ICurrentUser User { get; } = user;

    public TimeProvider Clock { get; } = clock;

    public ActivityLogger Log { get; } = log;

    public SecretProtector Secrets { get; } = secrets;

    public ConfigStore Config { get; } = config;

    public IServiceProvider Services { get; } = services;

    public DateTime Now => Clock.GetUtcNow().UtcDateTime;

    public long UserId => User.UserId ?? throw new ForbiddenException("Bitte melde dich an.");

    public bool IsAdmin => User.IsAdmin;

    /// <summary>The rules of the platform the administrator set (registration, public links, quotas, trash).</summary>
    public PlatformSettings Platform => Service<SettingStore>().Get<PlatformSettings>(SettingStore.Platform);

    private long? _personalSpaceId;

    /// <summary>The personal area of the person who acts ("Meine Projekte"), where new things go unless another area is asked for.</summary>
    public async Task<long> PersonalSpaceIdAsync()
    {
        if (_personalSpaceId is { } known)
        {
            return known;
        }

        var id = UserId;
        var found = await Db.User.AsNoTracking().Where(u => u.Id == id).Select(u => u.PersonalSpaceId).FirstOrDefaultAsync();
        _personalSpaceId = found ?? throw new ForbiddenException("Dein persönlicher Bereich fehlt.");
        return found.Value;
    }

    public void RequireAdmin()
    {
        if (!User.IsAdmin)
        {
            throw new ForbiddenException("Das dürfen nur Administratoren.");
        }
    }

    /// <summary>Any signed-in person, whatever the role.</summary>
    public void RequireSignedIn()
    {
        if (User.UserId is null)
        {
            throw new ForbiddenException("Bitte melde dich an.");
        }
    }

    public T Service<T>() where T : notnull => Services.GetRequiredService<T>();
}
