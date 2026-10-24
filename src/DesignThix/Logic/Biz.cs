using DesignThix.Configuration;
using DesignThix.Data;
using DesignThix.Data.Entities;
using DesignThix.Services;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Logic;

/// <summary>An action is not allowed for the person who asked: the request ends with 403, whatever the page did or did not check.</summary>
public sealed class ForbiddenException(string message = "Dafür fehlt die Berechtigung.") : Exception(message);

/// <summary>A rule of the business was broken ("the slug is taken"): the message is for the person and is shown at the form.</summary>
public sealed class BizException(string message, string? field = null) : Exception(message)
{
    public string? Field { get; } = field;
}

/// <summary>
/// What every operation of the business layer works with: the database, who is acting, the clock and the shared services. The logic itself
/// lives in static classes (<c>UserLogic</c>, <c>AiLogic</c> ...) that take this as their first argument, and every one of them checks
/// the permission itself (<see cref="RequireAdmin"/>, <see cref="RequireDesigner"/>, <see cref="RequireSignedIn"/>): a page that forgets to check opens nothing.
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

    /// <summary>Administrators and designers: the people who change designs, media, fonts, data lists, sheets and outputs.</summary>
    public bool IsDesigner => User.Role is UserRole.Admin or UserRole.Designer;

    public void RequireAdmin()
    {
        if (!User.IsAdmin)
        {
            throw new ForbiddenException("Das dürfen nur Administratoren.");
        }
    }

    /// <summary>Administrators and designers.</summary>
    public void RequireDesigner()
    {
        if (!IsDesigner)
        {
            throw new ForbiddenException("Das dürfen nur Gestalter und Administratoren.");
        }
    }

    /// <summary>Any signed-in person, whatever the role (viewers included).</summary>
    public void RequireSignedIn()
    {
        if (User.UserId is null)
        {
            throw new ForbiddenException("Bitte melde dich an.");
        }
    }

    public T Service<T>() where T : notnull => Services.GetRequiredService<T>();
}
