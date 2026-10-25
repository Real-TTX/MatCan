using DesignThix.Core.Security;
using DesignThix.Data;
using DesignThix.Data.Entities;
using DesignThix.Services;
using DesignThix.Services.Auth;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Logic;

public enum RegisterOutcome
{
    /// <summary>The account may sign in (registration is open, or it came through an invitation).</summary>
    Done,

    /// <summary>The account waits for an administrator.</summary>
    Pending,
}

/// <summary>The result of a registration: what happened and, for an invitation, the person (so the page can sign them in) and where they landed.</summary>
public sealed record RegisterResult(RegisterOutcome Outcome, User? SignInUser, InviteAccepted? Invitation);

public sealed record RegisterInput(string? DisplayName, string? Email, string? Password, string? PasswordRepeat, Guid? InvitationToken);

/// <summary>
/// Self-registration (docs/PLAN-PLATFORM.md section 1.15). The administrator sets the mode (<c>off</c>: only invitations, <c>open</c>, <c>approval</c>: the account waits) and optionally the e-mail
/// domains that may register. An invitation always works, also while registration is off, and skips approval and the domain list; when it names an address the person registers with that address.
/// <para>
/// <b>Nothing here tells whether an e-mail address already has an account</b>: a registration with an address that exists creates nothing and ends exactly like one that worked (the password is hashed
/// either way, so the time is the same). Registering is limited per address of the client and per e-mail address. An invitation that is used for an address that exists says "not possible" without saying why.
/// </para>
/// </summary>
public static class RegistrationLogic
{
    public const int PerClientPerMinute = 10;
    public const int PerEmailPerMinute = 3;
    public const int MaxNameLength = 120;

    /// <summary>The words that every registration that did not create anything, or that could not be told apart, ends with.</summary>
    public const string NotPossible = "Mit diesen Angaben ist die Registrierung nicht möglich. Hast du schon ein Konto? Dann melde dich an.";

    /// <summary>Whether the page "Registrieren" is offered: self-registration is on (open or with approval).</summary>
    public static bool IsOpen(Biz biz) => biz.Platform.Registration is "open" or "approval";

    public static string Domain(string email) => email[(email.LastIndexOf('@') + 1)..].ToLowerInvariant();

    /// <summary>The domains the administrator allows, spelled the way they are compared (lower case, no @).</summary>
    public static IReadOnlyList<string> AllowedDomains(Biz biz)
        => [.. biz.Platform.AllowedDomains.Select(d => d.Trim().TrimStart('@').ToLowerInvariant()).Where(d => d.Length > 0).Distinct()];

    public static async Task<RegisterResult> RegisterAsync(Biz biz, RegisterInput input)
    {
        var db = biz.Db;
        var limiter = biz.Service<PublicRateLimiter>();
        var client = biz.User.IpAddress;
        var email = SignInService.NormalizeEmail(input.Email);

        InvitePreview? invitation = null;
        if (input.InvitationToken is { } token)
        {
            invitation = await InviteLogic.PreviewAsync(biz, token);
            if (invitation.Status != InviteStatus.Valid)
            {
                throw new BizException(InviteLogic.Problem(invitation.Status));
            }
        }
        else if (!IsOpen(biz))
        {
            throw new BizException("Die Registrierung ist ausgeschaltet. Du brauchst eine Einladung.");
        }

        if (!limiter.TryTake("register:" + client, PerClientPerMinute) || (email.Length > 0 && !limiter.TryTake("register-mail:" + email, PerEmailPerMinute)))
        {
            throw new BizException("Zu viele Versuche. Bitte warte eine Minute und versuche es dann noch einmal.");
        }

        var name = (input.DisplayName ?? "").Trim();
        if (name.Length == 0)
        {
            throw new BizException("Bitte gib deinen Namen ein.", "Input.DisplayName");
        }

        if (name.Length > MaxNameLength)
        {
            name = name[..MaxNameLength];
        }

        if (!InviteLogic.IsEmail(email))
        {
            throw new BizException("Das ist keine gültige E-Mail-Adresse.", "Input.Email");
        }

        if (UserLogic.CheckPassword(input.Password, email) is { } weak)
        {
            throw new BizException(weak, "Input.Password");
        }

        if (input.Password != input.PasswordRepeat)
        {
            throw new BizException("Die Passwörter stimmen nicht überein.", "Input.PasswordRepeat");
        }

        if (invitation is not null)
        {
            if (!string.IsNullOrEmpty(invitation.Email) && !string.Equals(invitation.Email, email, StringComparison.OrdinalIgnoreCase))
            {
                throw new BizException($"Diese Einladung gilt für {invitation.Email}. Bitte registriere dich mit dieser Adresse.", "Input.Email");
            }
        }
        else if (AllowedDomains(biz) is { Count: > 0 } domains && !domains.Contains(Domain(email)))
        {
            throw new BizException($"Mit dieser Adresse kannst du dich nicht registrieren. Erlaubt sind nur Adressen von {string.Join(", ", domains)}.", "Input.Email");
        }

        // hashed whatever follows, so an address that exists costs as much time as a new one
        var hash = PasswordHasher.Hash(input.Password!);
        var approval = invitation is null && biz.Platform.Registration == "approval" ? ApprovalState.Pending : ApprovalState.Approved;
        var exists = await db.User.AnyAsync(u => u.Email == email);
        User? created = null;
        if (!exists)
        {
            try
            {
                created = new User { Email = email, DisplayName = name, Role = UserRole.Member, PasswordHash = hash, PasswordChangedDate = biz.Now, ApprovalState = approval };
                db.User.Add(created);
                await db.SaveChangesAsync();
                await SpaceLogic.EnsurePersonalAsync(db, created);
            }
            catch (DbUpdateException)
            {
                // somebody registered the same address at the same moment: it exists now
                db.ChangeTracker.Clear();
                created = null;
                exists = true;
            }
        }

        if (invitation is not null)
        {
            if (created is null)
            {
                // the invitation does not say that the address has an account
                throw new BizException(NotPossible);
            }

            var row = await db.Invitation.FirstAsync(i => i.Token == input.InvitationToken!.Value);
            var accepted = await InviteLogic.ClaimAsync(biz, row, created);
            await biz.Log.LogAsync("Registrierung über Einladung", nameof(User), created.Id, created.Email);
            return new RegisterResult(RegisterOutcome.Done, created, accepted);
        }

        if (created is not null)
        {
            await biz.Log.LogAsync("Registrierung", nameof(User), created.Id, $"{created.Email} ({approval})");
            if (approval == ApprovalState.Pending)
            {
                var admins = await db.User.AsNoTracking().Where(u => u.Role == UserRole.Admin && u.IsActive).Select(u => u.Id).ToListAsync();
                await NotificationLogic.NotifyAsync(biz, admins, NotificationKinds.RegistrationPending, new { by = created.DisplayName, byId = created.Id }, "/Admin/Users?status=pending");
            }
        }

        return new RegisterResult(approval == ApprovalState.Pending ? RegisterOutcome.Pending : RegisterOutcome.Done, null, null);
    }
}
