using System.Text.RegularExpressions;
using DesignThix.Data;
using DesignThix.Data.Entities;
using DesignThix.Services;
using DesignThix.Services.Auth;
using DesignThix.Services.Mail;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Logic;

public enum InviteStatus
{
    Valid,
    Expired,
    UsedUp,
    Revoked,

    /// <summary>No invitation has this token (the page says the same as for the others: the link is no longer valid).</summary>
    NotFound,
}

/// <summary>What the invitation page shows before anybody has done anything: whether the link works and what it is for. The address is shown (and locked) when the invitation named one.</summary>
public sealed record InvitePreview(InviteStatus Status, long? SpaceId, string? TeamName, string? TeamSlug, SpaceRole Role, string? Email, string? InviterName, DateTime Expires);

/// <summary>One invitation of a list (the link's token is only handed to the people who may manage invitations).</summary>
public sealed record InviteRow(long Id, Guid Token, long? SpaceId, string? TeamName, string? Email, SpaceRole Role, DateTime Created, DateTime Expires, int MaxUses, int Uses, InviteStatus Status, string InviterName);

/// <summary>The result of an invitation: what was made and what was left out (with the reason, per address).</summary>
public sealed record InviteResult(IReadOnlyList<Invitation> Created, IReadOnlyList<string> Skipped);

/// <summary>Where a person ends up after accepting.</summary>
public sealed record InviteAccepted(long? SpaceId, string? TeamSlug, bool AlreadyMember);

/// <summary>
/// Invitations (docs/PLAN-PLATFORM.md section 1.14): a team's Owner or Admin invites by e-mail address or with a link (role, expiry 1/7/30 days, maximum uses); an administrator (or a member when
/// <c>membersMayInvite</c> is on) invites to the platform without a team. The token is a uuid. Accepting needs a signed-in person (the address must match when the invitation named one); an
/// invitation also lets a person register while self-registration is off (<see cref="RegistrationLogic"/>). An invitation that is revoked, expired or used up says so in friendly words.
/// </summary>
public static partial class InviteLogic
{
    public const int MaxEmailsAtOnce = 20;
    public const int MaxOpenPerTeam = 200;

    [GeneratedRegex(@"^[^\s@,;<>""]+@[^\s@,;<>""]+\.[^\s@,;<>""]{2,}$", RegexOptions.CultureInvariant)]
    private static partial Regex EmailPattern();

    public static bool IsEmail(string? text) => text is { Length: <= 254 } && EmailPattern().IsMatch(text.Trim());

    /// <summary>The addresses of a text (comma, semicolon or line breaks between them): lower case, each once, and the ones that are no address.</summary>
    public static (List<string> Valid, List<string> Invalid) ParseAddresses(string? text)
    {
        var valid = new List<string>();
        var invalid = new List<string>();
        foreach (var part in Regex.Split(text ?? "", @"[,;\r\n\t ]+"))
        {
            var address = SignInService.NormalizeEmail(part);
            if (address.Length == 0)
            {
                continue;
            }

            if (!IsEmail(address))
            {
                invalid.Add(address.Length > 60 ? address[..60] : address);
            }
            else if (!valid.Contains(address))
            {
                valid.Add(address);
            }
        }

        return (valid, invalid);
    }

    // ------------------------------------------------------------------------------------------------ the state of one invitation

    public static InviteStatus StatusOf(Invitation i, DateTime now)
        => i.RevokedDate is not null ? InviteStatus.Revoked : i.Uses >= i.MaxUses ? InviteStatus.UsedUp : i.ExpiresDate <= now ? InviteStatus.Expired : InviteStatus.Valid;

    public static string Words(InviteStatus status) => status switch
    {
        InviteStatus.Valid => "Offen",
        InviteStatus.Expired => "Abgelaufen",
        InviteStatus.UsedUp => "Aufgebraucht",
        InviteStatus.Revoked => "Zurückgezogen",
        _ => "Ungültig",
    };

    // ------------------------------------------------------------------------------------------------ making invitations

    /// <summary>
    /// Invites to a team (<paramref name="spaceId"/>; Owner and Admin of the team, only an Owner invites Owners) or to the platform (null: an administrator, or a member when the platform allows it). With
    /// addresses: one invitation per address, one use each, and a mail when the mail server is set up. Without addresses: one link that may be used <paramref name="maxUses"/> times. The expiry is
    /// <paramref name="days"/> (1 to 90).
    /// </summary>
    public static async Task<InviteResult> CreateAsync(Biz biz, long? spaceId, SpaceRole role, string? addresses, bool asLink, int days, int maxUses)
    {
        biz.RequireSignedIn();
        var db = biz.Db;
        if (spaceId is { } team)
        {
            await Access.RequireSpaceRole(biz, team, SpaceRole.Admin);
            if (!await db.Space.AnyAsync(s => s.Id == team && s.Kind == SpaceKind.Team))
            {
                throw new BizException("Zu einem persönlichen Bereich lädt man nicht ein.");
            }

            if (role == SpaceRole.Owner && await Access.RoleInAsync(biz, team) != SpaceRole.Owner)
            {
                throw new ForbiddenException("Nur ein Inhaber kann zum Inhaber einladen.");
            }

            if (await db.Invitation.CountAsync(i => i.SpaceId == team && i.RevokedDate == null && i.ExpiresDate > biz.Now && i.Uses < i.MaxUses) >= MaxOpenPerTeam)
            {
                throw new BizException($"Es sind schon {MaxOpenPerTeam} Einladungen offen. Ziehe ein paar zurück.");
            }
        }
        else if (!biz.IsAdmin && !biz.Platform.MembersMayInvite)
        {
            throw new ForbiddenException("Der Administrator hat das Einladen durch Mitglieder ausgeschaltet.");
        }

        var expires = biz.Now.AddDays(Math.Clamp(days, 1, 90));
        var created = new List<Invitation>();
        var skipped = new List<string>();
        if (asLink)
        {
            var link = new Invitation { SpaceId = spaceId, Role = role, ExpiresDate = expires, MaxUses = Math.Clamp(maxUses, 1, 100) };
            db.Invitation.Add(link);
            created.Add(link);
        }
        else
        {
            var (valid, invalid) = ParseAddresses(addresses);
            if (valid.Count == 0 && invalid.Count == 0)
            {
                throw new BizException("Bitte gib mindestens eine E-Mail-Adresse ein.", "Addresses");
            }

            if (invalid.Count > 0)
            {
                throw new BizException($"„{invalid[0]}“ ist keine gültige E-Mail-Adresse.", "Addresses");
            }

            if (valid.Count > MaxEmailsAtOnce)
            {
                throw new BizException($"Du kannst höchstens {MaxEmailsAtOnce} Adressen auf einmal einladen.", "Addresses");
            }

            foreach (var address in valid)
            {
                if (spaceId is { } space && await db.SpaceMember.AnyAsync(m => m.SpaceId == space && m.User!.Email == address))
                {
                    skipped.Add($"{address} ist schon im Team.");
                    continue;
                }

                // a newer invitation replaces an older one for the same address and place
                var older = await db.Invitation.Where(i => i.SpaceId == spaceId && i.Email == address && i.RevokedDate == null && i.Uses < i.MaxUses).ToListAsync();
                foreach (var old in older)
                {
                    old.RevokedDate = biz.Now;
                }

                var invitation = new Invitation { SpaceId = spaceId, Email = address, Role = role, ExpiresDate = expires, MaxUses = 1 };
                db.Invitation.Add(invitation);
                created.Add(invitation);
            }
        }

        await db.SaveChangesAsync();
        var queue = biz.Service<MailQueue>();
        foreach (var invitation in created.Where(i => i.Email is not null))
        {
            queue.InvitationCreated(invitation.Id);
        }

        await biz.Log.LogAsync("Einladung erstellt", nameof(Invitation), created.FirstOrDefault()?.Id, spaceId is null ? $"Plattform, {created.Count}" : $"Team {spaceId}, {created.Count} ({role})");
        return new InviteResult(created, skipped);
    }

    // ------------------------------------------------------------------------------------------------ lists

    private static IQueryable<InviteRow> Rows(DtDbContext db, IQueryable<Invitation> invitations, DateTime now)
        => from i in invitations.AsNoTracking()
           join s in db.Space.AsNoTracking() on i.SpaceId equals s.Id into spaces
           from s in spaces.DefaultIfEmpty()
           join u in db.User.AsNoTracking() on i.CreateUserId equals u.Id into users
           from u in users.DefaultIfEmpty()
           select new InviteRow(i.Id, i.Token, i.SpaceId, s == null ? null : s.Name, i.Email, i.Role, i.CreateDate, i.ExpiresDate, i.MaxUses, i.Uses,
               i.RevokedDate != null ? InviteStatus.Revoked : i.Uses >= i.MaxUses ? InviteStatus.UsedUp : i.ExpiresDate <= now ? InviteStatus.Expired : InviteStatus.Valid,
               u == null ? "" : u.DisplayName);

    /// <summary>The invitations of a team that wait (open or expired; used up and revoked ones are done), newest first. Owner and Admin of the team.</summary>
    public static async Task<List<InviteRow>> ListAsync(Biz biz, long spaceId)
    {
        await Access.RequireSpaceRole(biz, spaceId, SpaceRole.Admin);
        var now = biz.Now;
        // sorted after the query: a record with a positional constructor cannot be sorted in SQL (see CLAUDE.md, gotchas)
        var rows = await Rows(biz.Db, biz.Db.Invitation.Where(i => i.SpaceId == spaceId && i.RevokedDate == null && i.Uses < i.MaxUses), now).ToListAsync();
        return [.. rows.OrderByDescending(r => r.Created).ThenByDescending(r => r.Id)];
    }

    /// <summary>The platform invitations (without a team) that wait: an administrator sees all, a member their own.</summary>
    public static async Task<List<InviteRow>> ListPlatformAsync(Biz biz)
    {
        biz.RequireSignedIn();
        var uid = biz.UserId;
        var query = biz.Db.Invitation.Where(i => i.SpaceId == null && i.RevokedDate == null && i.Uses < i.MaxUses);
        if (!biz.IsAdmin)
        {
            query = query.Where(i => i.CreateUserId == uid);
        }

        var rows = await Rows(biz.Db, query, biz.Now).ToListAsync();
        return [.. rows.OrderByDescending(r => r.Created).ThenByDescending(r => r.Id)];
    }

    private static async Task<Invitation> ManagedAsync(Biz biz, long id)
    {
        biz.RequireSignedIn();
        var invitation = await biz.Db.Invitation.FirstOrDefaultAsync(i => i.Id == id) ?? throw new NotFoundException();
        if (invitation.SpaceId is { } space)
        {
            await Access.RequireSpaceRole(biz, space, SpaceRole.Admin);
        }
        else if (!biz.IsAdmin && invitation.CreateUserId != biz.UserId)
        {
            throw new NotFoundException();
        }

        return invitation;
    }

    /// <summary>Takes an invitation back: the link stops working at once.</summary>
    public static async Task RevokeAsync(Biz biz, long id)
    {
        var invitation = await ManagedAsync(biz, id);
        invitation.RevokedDate ??= biz.Now;
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Einladung zurückgezogen", nameof(Invitation), id);
    }

    /// <summary>Sends the mail of an invitation (by address) again; an expired one gets seven more days. Owner and Admin of the team.</summary>
    public static async Task<Invitation> ResendAsync(Biz biz, long id)
    {
        var invitation = await ManagedAsync(biz, id);
        if (string.IsNullOrEmpty(invitation.Email))
        {
            throw new BizException("Ein Einladungslink hat keine Adresse, an die man ihn schicken könnte. Kopiere den Link.");
        }

        if (StatusOf(invitation, biz.Now) is InviteStatus.UsedUp or InviteStatus.Revoked)
        {
            throw new BizException("Diese Einladung ist nicht mehr offen. Lade die Person neu ein.");
        }

        var wanted = biz.Now.AddDays(7);
        if (invitation.ExpiresDate < wanted)
        {
            invitation.ExpiresDate = wanted;
        }

        await biz.Db.SaveChangesAsync();
        biz.Service<MailQueue>().InvitationCreated(invitation.Id);
        await biz.Log.LogAsync("Einladung erneut gesendet", nameof(Invitation), id);
        return invitation;
    }

    // ------------------------------------------------------------------------------------------------ the person who got an invitation

    /// <summary>What the link is for, for the page everybody who has the link may open. Nothing else about the platform is told.</summary>
    public static async Task<InvitePreview> PreviewAsync(Biz biz, Guid token)
    {
        var db = biz.Db;
        var invitation = await db.Invitation.AsNoTracking().FirstOrDefaultAsync(i => i.Token == token);
        if (invitation is null)
        {
            return new InvitePreview(InviteStatus.NotFound, null, null, null, SpaceRole.Viewer, null, null, default);
        }

        var team = invitation.SpaceId is { } id ? await db.Space.AsNoTracking().Where(s => s.Id == id).Select(s => new { s.Name, s.Slug }).FirstOrDefaultAsync() : null;
        if (invitation.SpaceId is not null && team is null)
        {
            return new InvitePreview(InviteStatus.Revoked, invitation.SpaceId, null, null, invitation.Role, null, null, invitation.ExpiresDate);
        }

        var inviter = invitation.CreateUserId is { } by ? await db.User.AsNoTracking().Where(u => u.Id == by).Select(u => u.DisplayName).FirstOrDefaultAsync() : null;
        return new InvitePreview(StatusOf(invitation, biz.Now), invitation.SpaceId, team?.Name, team?.Slug, invitation.Role, invitation.Email, inviter, invitation.ExpiresDate);
    }

    /// <summary>The friendly sentence for a link that does not work (the same words whatever is wrong with it, except the plain cases).</summary>
    public static string Problem(InviteStatus status) => status switch
    {
        InviteStatus.Expired => "Diese Einladung ist abgelaufen. Bitte die Person, die dich eingeladen hat, um eine neue.",
        InviteStatus.UsedUp => "Diese Einladung wurde schon benutzt. Bitte die Person, die dich eingeladen hat, um eine neue.",
        _ => "Dieser Einladungslink ist nicht mehr gültig. Bitte die Person, die dich eingeladen hat, um eine neue.",
    };

    /// <summary>
    /// Accepts an invitation as the signed-in person: they become a member of the team with the invited role (a person who is a member already stays as they are, and the invitation is not used up). The
    /// address must match when the invitation named one. The person who invited is notified.
    /// </summary>
    public static async Task<InviteAccepted> AcceptAsync(Biz biz, Guid token)
    {
        biz.RequireSignedIn();
        var db = biz.Db;
        var uid = biz.UserId;
        var user = await db.User.AsNoTracking().FirstOrDefaultAsync(u => u.Id == uid && u.IsActive && u.ApprovalState == ApprovalState.Approved) ?? throw new ForbiddenException();
        var invitation = await db.Invitation.FirstOrDefaultAsync(i => i.Token == token) ?? throw new BizException(Problem(InviteStatus.NotFound));
        var status = StatusOf(invitation, biz.Now);
        // somebody who is in the team already, and opens the link again later, is told so (also after the link was used up or ran out), not that the link is dead
        var already = invitation.SpaceId is { } joined && await db.SpaceMember.AnyAsync(m => m.SpaceId == joined && m.UserId == user.Id);
        if (status is not InviteStatus.Valid && !(already && status is not InviteStatus.Revoked))
        {
            throw new BizException(Problem(status));
        }

        if (!string.IsNullOrEmpty(invitation.Email) && !string.Equals(invitation.Email, user.Email, StringComparison.OrdinalIgnoreCase))
        {
            throw new BizException($"Diese Einladung gilt für {invitation.Email}. Du bist mit {user.Email} angemeldet: melde dich mit der eingeladenen Adresse an.");
        }

        return await ClaimAsync(biz, invitation, user);
    }

    /// <summary>Uses the invitation for a person (checked by the caller): joins the team and tells the inviter. A person who is a member already does not use it up.</summary>
    internal static async Task<InviteAccepted> ClaimAsync(Biz biz, Invitation invitation, User user)
    {
        var db = biz.Db;
        string? slug = null;
        string? teamName = null;
        var already = false;
        if (invitation.SpaceId is { } space)
        {
            var team = await db.Space.AsNoTracking().Where(s => s.Id == space).Select(s => new { s.Name, s.Slug }).FirstOrDefaultAsync() ?? throw new BizException(Problem(InviteStatus.Revoked));
            slug = team.Slug;
            teamName = team.Name;
            already = await db.SpaceMember.AnyAsync(m => m.SpaceId == space && m.UserId == user.Id);
        }

        if (!already)
        {
            // the use is claimed with one statement, so two people with the last use of a link cannot both get in
            var now = biz.Now;
            var claimed = await db.Invitation.Where(i => i.Id == invitation.Id && i.Uses < i.MaxUses && i.RevokedDate == null && i.ExpiresDate > now).ExecuteUpdateAsync(s => s.SetProperty(i => i.Uses, i => i.Uses + 1));
            if (claimed == 0)
            {
                throw new BizException(Problem(InviteStatus.UsedUp));
            }

            if (invitation.SpaceId is { } joining)
            {
                db.SpaceMember.Add(new SpaceMember { SpaceId = joining, UserId = user.Id, Role = invitation.Role });
                await db.SaveChangesAsync();
            }

            if (invitation.CreateUserId is { } inviter && inviter != user.Id)
            {
                var url = slug is null ? "/" : $"/Teams/{slug}/Mitglieder";
                await NotificationLogic.NotifyAsync(biz, [inviter], NotificationKinds.InviteAccepted, new { by = user.DisplayName, byId = user.Id, teamName, spaceId = invitation.SpaceId }, url);
            }

            await biz.Log.LogAsync("Einladung angenommen", nameof(Invitation), invitation.Id, $"{user.Email}{(teamName is null ? "" : " → " + teamName)}");
        }

        return new InviteAccepted(invitation.SpaceId, slug, already);
    }
}
