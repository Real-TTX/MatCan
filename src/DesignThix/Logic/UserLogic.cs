using DesignThix.Core.Security;
using DesignThix.Data;
using DesignThix.Data.Entities;
using DesignThix.Services;
using DesignThix.Services.Auth;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Logic;

/// <summary>Accounts: the first administrator, the administration of users, and what everybody changes on their own account.</summary>
public static class UserLogic
{
    public const int MinPasswordLength = 10;

    /// <summary>Null when the password is acceptable, otherwise what is wrong with it.</summary>
    public static string? CheckPassword(string? password, string? email = null)
    {
        if (string.IsNullOrEmpty(password) || password.Length < MinPasswordLength)
        {
            return $"Das Passwort braucht mindestens {MinPasswordLength} Zeichen.";
        }

        return email is not null && password.Equals(email, StringComparison.OrdinalIgnoreCase) ? "Das Passwort darf nicht die E-Mail-Adresse sein." : null;
    }

    /// <summary>Trimmed text; null when nothing is left.</summary>
    public static string? Clean(string? text) => string.IsNullOrWhiteSpace(text) ? null : text.Trim();

    // ------------------------------------------------------------------------------------------------ first start

    public static Task<bool> HasAdminAsync(DtDbContext db) => db.User.AnyAsync(u => u.Role == UserRole.Admin);

    /// <summary>Creates the first administrator; only while there is none (anyone may call it then, nobody afterwards).</summary>
    public static async Task<User> CreateFirstAdminAsync(Biz biz, string email, string displayName, string password)
    {
        if (await HasAdminAsync(biz.Db))
        {
            throw new ForbiddenException("Es gibt schon einen Administrator.");
        }

        var admin = await CreateAsync(biz.Db, email, displayName, UserRole.Admin, password, biz.Now);
        // the demo's data list and output job go into the first administrator's personal area (the demo design is a system template that was seeded at start-up)
        await DemoSeeder.SeedPersonalAsync(biz.Db, admin, biz.Service<ILoggerFactory>().CreateLogger("Demo"));
        return admin;
    }

    private static async Task<User> CreateAsync(DtDbContext db, string email, string displayName, UserRole role, string? password, DateTime now)
    {
        var normalized = SignInService.NormalizeEmail(email);
        if (await db.User.AnyAsync(u => u.Email == normalized))
        {
            throw new BizException("Zu dieser E-Mail-Adresse gibt es schon ein Konto.", "Email");
        }

        var user = new User
        {
            Email = normalized,
            DisplayName = displayName.Trim(),
            Role = role,
            PasswordHash = password is null ? null : PasswordHasher.Hash(password),
            PasswordChangedDate = password is null ? null : now,
        };
        db.User.Add(user);
        await db.SaveChangesAsync();
        await SpaceLogic.EnsurePersonalAsync(db, user);
        return user;
    }

    // ------------------------------------------------------------------------------------------------ administration of users

    public static IQueryable<User> Query(Biz biz)
    {
        biz.RequireAdmin();
        return biz.Db.User.AsNoTracking().Include(u => u.Totp);
    }

    public sealed record UserDetails(User User, int Sessions, bool IsLocked);

    public static async Task<UserDetails?> DetailsAsync(Biz biz, long id)
    {
        biz.RequireAdmin();
        var user = await biz.Db.User.AsNoTracking().Include(u => u.Totp).FirstOrDefaultAsync(u => u.Id == id);
        if (user is null)
        {
            return null;
        }

        var now = biz.Now;
        var sessions = await biz.Db.UserSession.CountAsync(s => s.UserId == id && s.RevokedDate == null && s.ExpiresDate > now);
        return new UserDetails(user, sessions, user.LockoutEndDate > now);
    }

    public sealed record UserInput(string DisplayName, string Email, string? Phone, UserRole Role, bool IsActive, string? Password);

    public static async Task<User> SaveAsync(Biz biz, long? id, UserInput input)
    {
        biz.RequireAdmin();
        var email = SignInService.NormalizeEmail(input.Email);
        if (await biz.Db.User.AnyAsync(u => u.Email == email && u.Id != id))
        {
            throw new BizException("Zu dieser E-Mail-Adresse gibt es schon ein Konto.", "Input.Email");
        }

        if (!string.IsNullOrEmpty(input.Password) && CheckPassword(input.Password, email) is { } weak)
        {
            throw new BizException(weak, "Input.Password");
        }

        var signIn = biz.Service<SignInService>();
        var cache = biz.Service<SessionCache>();
        User user;
        if (id is null)
        {
            user = await CreateAsync(biz.Db, email, input.DisplayName, input.Role, string.IsNullOrEmpty(input.Password) ? null : input.Password, biz.Now);
        }
        else
        {
            user = await biz.Db.User.FirstOrDefaultAsync(u => u.Id == id) ?? throw new BizException("Den Benutzer gibt es nicht mehr.");
            var losesAdmin = user.Role == UserRole.Admin && user.IsActive && (input.Role != UserRole.Admin || !input.IsActive);
            if (losesAdmin && !await biz.Db.User.AnyAsync(u => u.Id != user.Id && u.Role == UserRole.Admin && u.IsActive))
            {
                throw new BizException("Das ist der einzige aktive Administrator. Es muss immer einen geben.", "Input.Role");
            }

            if (user.Id == biz.User.UserId && losesAdmin)
            {
                throw new BizException("Du kannst dir nicht selbst die Rechte nehmen oder dich sperren.", "Input.Role");
            }

            user.DisplayName = input.DisplayName.Trim();
            user.Email = email;
            user.Role = input.Role;
            if (!string.IsNullOrEmpty(input.Password))
            {
                user.PasswordHash = PasswordHasher.Hash(input.Password);
                user.PasswordChangedDate = biz.Now;
                user.FailedLogins = 0;
                user.LockoutEndDate = null;
            }
        }

        user.Phone = Clean(input.Phone);
        var deactivated = user.IsActive && !input.IsActive;
        user.IsActive = input.IsActive;
        await biz.Db.SaveChangesAsync();

        cache.InvalidateUser(user.Id);
        if (deactivated || (id is not null && !string.IsNullOrEmpty(input.Password)))
        {
            await signIn.EndAllSessionsAsync(user.Id, null);
        }

        await biz.Log.LogAsync(id is null ? "Benutzer angelegt" : "Benutzer geändert", nameof(User), user.Id, $"{user.Email} ({user.Role})");
        return user;
    }

    public static async Task DeleteAsync(Biz biz, long id)
    {
        biz.RequireAdmin();
        var user = await biz.Db.User.FirstOrDefaultAsync(u => u.Id == id) ?? throw new BizException("Den Benutzer gibt es nicht mehr.");
        if (user.Id == biz.User.UserId)
        {
            throw new BizException("Du kannst dich nicht selbst löschen.");
        }

        if (user.Role == UserRole.Admin && user.IsActive && !await biz.Db.User.AnyAsync(u => u.Id != user.Id && u.Role == UserRole.Admin && u.IsActive))
        {
            throw new BizException("Das ist der einzige aktive Administrator.");
        }

        await ReleaseAreasAsync(biz, user);
        await biz.Service<SignInService>().EndAllSessionsAsync(user.Id, null);
        biz.Db.User.Remove(user);
        await biz.Db.SaveChangesAsync();
        biz.Service<SessionCache>().InvalidateUser(user.Id);
        await biz.Log.LogAsync("Benutzer gelöscht", nameof(User), user.Id, user.Email);
    }

    /// <summary>
    /// What a deleted account leaves behind: a team the person owns alone and shares with others must be handed over first; a team they were alone in is deleted; the personal area goes to the trash
    /// (the purger removes it); shares, link grants, stars and visits of the person end.
    /// </summary>
    private static async Task ReleaseAreasAsync(Biz biz, User user)
    {
        var db = biz.Db;
        var owned = await db.SpaceMember.Where(m => m.UserId == user.Id && m.Role == SpaceRole.Owner && m.SpaceId != user.PersonalSpaceId).Select(m => m.SpaceId).ToListAsync();
        foreach (var teamId in owned)
        {
            var owners = await db.SpaceMember.CountAsync(m => m.SpaceId == teamId && m.Role == SpaceRole.Owner);
            var members = await db.SpaceMember.CountAsync(m => m.SpaceId == teamId);
            if (owners <= 1 && members > 1)
            {
                var name = await db.Space.Where(s => s.Id == teamId).Select(s => s.Name).FirstAsync();
                throw new BizException($"{user.DisplayName} ist der einzige Inhaber des Teams „{name}“. Übertrage zuerst die Inhaberschaft.");
            }
        }

        foreach (var teamId in owned)
        {
            if (await db.SpaceMember.CountAsync(m => m.SpaceId == teamId) <= 1)
            {
                await ItemLogic.TrashSpaceContentAsync(db, teamId, biz.Now);
                var team = await db.Space.FirstAsync(s => s.Id == teamId);
                team.DeletedDate = biz.Now;
                db.Space.Remove(team);
                await db.Share.Where(s => s.SpaceId == teamId).ExecuteDeleteAsync();
            }
        }

        await db.SpaceMember.Where(m => m.UserId == user.Id).ExecuteDeleteAsync();
        if (user.PersonalSpaceId is { } personal)
        {
            await ItemLogic.TrashSpaceContentAsync(db, personal, biz.Now);
            var space = await db.Space.FirstOrDefaultAsync(s => s.Id == personal);
            if (space is not null)
            {
                space.DeletedDate = biz.Now;
                db.Space.Remove(space);
            }
        }

        await db.Share.Where(s => s.UserId == user.Id).ExecuteDeleteAsync();
        await db.LinkGrant.Where(g => g.UserId == user.Id).ExecuteDeleteAsync();
        await db.Star.Where(s => s.UserId == user.Id).ExecuteDeleteAsync();
        await db.ItemVisit.Where(v => v.UserId == user.Id).ExecuteDeleteAsync();
        await db.SaveChangesAsync();
    }

    public static async Task UnlockAsync(Biz biz, long id)
    {
        biz.RequireAdmin();
        var user = await biz.Db.User.FirstOrDefaultAsync(u => u.Id == id) ?? throw new BizException("Den Benutzer gibt es nicht mehr.");
        user.FailedLogins = 0;
        user.LockoutEndDate = null;
        await biz.Db.SaveChangesAsync();
        biz.Service<SessionCache>().InvalidateUser(id);
    }

    public static async Task ResetTotpAsync(Biz biz, long id)
    {
        biz.RequireAdmin();
        var user = await biz.Db.User.Include(u => u.Totp).FirstOrDefaultAsync(u => u.Id == id) ?? throw new BizException("Den Benutzer gibt es nicht mehr.");
        await biz.Service<TwoFactorService>().DisableAsync(user);
        await biz.Log.LogAsync("Zwei-Faktor-Anmeldung zurückgesetzt", nameof(User), id, user.Email);
    }

    public static async Task EndSessionsAsync(Biz biz, long id, Guid? keep)
    {
        biz.RequireAdmin();
        await biz.Service<SignInService>().EndAllSessionsAsync(id, id == biz.User.UserId ? keep : null);
        await biz.Log.LogAsync("Sitzungen beendet", nameof(User), id);
    }

    // ------------------------------------------------------------------------------------------------ the own account

    /// <summary>The signed-in person's own row (tracked, for the account pages).</summary>
    public static async Task<User> MeAsync(Biz biz)
    {
        var id = biz.UserId;
        return await biz.Db.User.Include(u => u.Totp).FirstAsync(u => u.Id == id);
    }

    public static async Task<User> SaveProfileAsync(Biz biz, string displayName, string? phone, string theme)
    {
        var user = await MeAsync(biz);
        if (string.IsNullOrWhiteSpace(displayName))
        {
            throw new BizException("Bitte gib deinen Namen ein.", "Profile.DisplayName");
        }

        user.DisplayName = displayName.Trim();
        user.Phone = Clean(phone);
        user.Theme = theme is "light" or "dark" ? theme : "system";
        await biz.Db.SaveChangesAsync();
        return user;
    }

    public static async Task SetThemeAsync(Biz biz, string theme)
    {
        var user = await MeAsync(biz);
        user.Theme = theme is "light" or "dark" ? theme : "system";
        await biz.Db.SaveChangesAsync();
    }

    public static async Task ChangeOwnPasswordAsync(Biz biz, string? currentPassword, string newPassword, string repeat, Guid? keepSession)
    {
        var user = await MeAsync(biz);
        if (user.PasswordHash is not null && !PasswordHasher.Verify(currentPassword ?? "", user.PasswordHash))
        {
            throw new BizException("Das aktuelle Passwort stimmt nicht.", "Password.Current");
        }

        if (CheckPassword(newPassword, user.Email) is { } problem)
        {
            throw new BizException(problem, "Password.New");
        }

        if (newPassword != repeat)
        {
            throw new BizException("Die Passwörter stimmen nicht überein.", "Password.Repeat");
        }

        user.PasswordHash = PasswordHasher.Hash(newPassword);
        user.PasswordChangedDate = biz.Now;
        await biz.Db.SaveChangesAsync();
        await biz.Service<SignInService>().EndAllSessionsAsync(user.Id, keepSession);
        await biz.Log.LogAsync("Passwort geändert", nameof(User), user.Id);
    }

    public sealed record SessionRow(long Id, string? UserAgent, string? Ip, DateTime LastSeen, DateTime Created, bool IsThis);

    public static async Task<List<SessionRow>> MySessionsAsync(Biz biz, Guid? current)
    {
        var id = biz.UserId;
        var now = biz.Now;
        return await biz.Db.UserSession.AsNoTracking()
            .Where(s => s.UserId == id && s.RevokedDate == null && s.ExpiresDate > now)
            .OrderByDescending(s => s.LastSeenDate)
            .Select(s => new SessionRow(s.Id, s.UserAgent, s.IpAddress, s.LastSeenDate, s.CreateDate, s.Token == current))
            .ToListAsync();
    }

    public static async Task EndMySessionAsync(Biz biz, long sessionId)
    {
        var id = biz.UserId;
        var session = await biz.Db.UserSession.FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == id);
        if (session is null)
        {
            return;
        }

        session.RevokedDate = biz.Now;
        await biz.Db.SaveChangesAsync();
        biz.Service<SessionCache>().InvalidateUser(id);
    }

    /// <summary>The user a pending second step belongs to (the ticket of the first step names them).</summary>
    public static Task<User?> ForSecondStepAsync(DtDbContext db, long userId)
        => db.User.Include(u => u.Totp).FirstOrDefaultAsync(u => u.Id == userId && u.IsActive);
}
