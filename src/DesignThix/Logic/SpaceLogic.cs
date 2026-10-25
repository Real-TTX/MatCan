using DesignThix.Core.Text;
using DesignThix.Data;
using DesignThix.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Logic;

/// <summary>An area as a list or a header shows it. <see cref="MyRole"/> is null when the person is no member (an administrator looking at a team).</summary>
public sealed record SpaceRow
{
    public long Id { get; init; }

    public SpaceKind Kind { get; init; }

    public string Name { get; init; } = "";

    public string? Slug { get; init; }

    public string? Description { get; init; }

    public string Color { get; init; } = "#1fb3d6";

    public SpaceRole? MyRole { get; init; }

    public int MemberCount { get; init; }

    public long? StorageQuotaBytes { get; init; }
}

public sealed record MemberRow(long UserId, string DisplayName, string Email, SpaceRole Role, DateTime Since, bool IsActive);

/// <summary>
/// The areas of the platform (docs/PLAN-PLATFORM.md section 1.12): the personal area that every person has and the teams. A team has members with a role (Owner, Admin, Editor, Viewer); there is at
/// least one Owner at all times. Deleting a team sends its content to the trash and takes the memberships away; the trash purger removes the content when the days are over.
/// </summary>
public static class SpaceLogic
{
    public const string PersonalName = "Meine Projekte";

    public const int MaxNameLength = 120;

    // ------------------------------------------------------------------------------------------------ the personal area

    /// <summary>
    /// Makes the personal area of a user (when they have none): a space of kind Personal with the person as its only Owner, and sets <see cref="User.PersonalSpaceId"/>. Saves.
    /// Called when an account is made (setup, administrator, registration) and by the migration of the platform.
    /// </summary>
    internal static async Task<Space> EnsurePersonalAsync(DtDbContext db, User user)
    {
        if (user.PersonalSpaceId is { } existing && await db.Space.FirstOrDefaultAsync(s => s.Id == existing) is { } found)
        {
            return found;
        }

        var space = new Space { Kind = SpaceKind.Personal, Name = PersonalName };
        db.Space.Add(space);
        await db.SaveChangesAsync();
        db.SpaceMember.Add(new SpaceMember { SpaceId = space.Id, UserId = user.Id, Role = SpaceRole.Owner });
        user.PersonalSpaceId = space.Id;
        await db.SaveChangesAsync();
        return space;
    }

    // ------------------------------------------------------------------------------------------------ reading

    private static IQueryable<SpaceRow> Rows(Biz biz, IQueryable<Space> spaces)
    {
        var db = biz.Db;
        var uid = biz.UserId;
        return spaces.AsNoTracking().Select(s => new SpaceRow
        {
            Id = s.Id, Kind = s.Kind, Name = s.Name, Slug = s.Slug, Description = s.Description, Color = s.Color,
            MyRole = db.SpaceMember.Where(m => m.SpaceId == s.Id && m.UserId == uid).Select(m => (SpaceRole?)m.Role).FirstOrDefault(),
            MemberCount = db.SpaceMember.Count(m => m.SpaceId == s.Id), StorageQuotaBytes = s.StorageQuotaBytes,
        });
    }

    /// <summary>The areas the person is a member of: their personal area first, then their teams by name.</summary>
    public static async Task<List<SpaceRow>> MySpacesAsync(Biz biz)
    {
        biz.RequireSignedIn();
        return await Rows(biz, Access.MemberSpaces(biz)).OrderBy(s => s.Kind).ThenBy(s => s.Name).ThenBy(s => s.Id).ToListAsync();
    }

    /// <summary>The teams the person is a member of, by name.</summary>
    public static async Task<List<SpaceRow>> MyTeamsAsync(Biz biz)
    {
        biz.RequireSignedIn();
        return await Rows(biz, Access.MemberSpaces(biz).Where(s => s.Kind == SpaceKind.Team)).OrderBy(s => s.Name).ThenBy(s => s.Id).ToListAsync();
    }

    /// <summary>The areas the person may write in (where "Speichern in" offers to put a new design).</summary>
    public static async Task<List<SpaceRow>> WritableAsync(Biz biz)
    {
        biz.RequireSignedIn();
        return await Rows(biz, Access.WritableSpaces(biz)).OrderBy(s => s.Kind).ThenBy(s => s.Name).ThenBy(s => s.Id).ToListAsync();
    }

    /// <summary>An area the person is a member of; <see cref="NotFoundException"/> for a stranger.</summary>
    public static async Task<SpaceRow> GetAsync(Biz biz, long id)
    {
        await Access.RequireSpaceRole(biz, id, SpaceRole.Viewer);
        return await Rows(biz, biz.Db.Space.Where(s => s.Id == id)).FirstAsync();
    }

    /// <summary>A team of the person by the slug of its address; null when there is none.</summary>
    public static async Task<SpaceRow?> GetBySlugAsync(Biz biz, string slug)
    {
        biz.RequireSignedIn();
        var wanted = (slug ?? "").Trim().ToLowerInvariant();
        return await Rows(biz, Access.MemberSpaces(biz).Where(s => s.Kind == SpaceKind.Team && s.Slug == wanted)).FirstOrDefaultAsync();
    }

    /// <summary>The members of an area (any member may look).</summary>
    public static async Task<List<MemberRow>> MembersAsync(Biz biz, long spaceId)
    {
        await Access.RequireSpaceRole(biz, spaceId, SpaceRole.Viewer);
        return await (from m in biz.Db.SpaceMember.AsNoTracking()
                      where m.SpaceId == spaceId
                      join u in biz.Db.User.AsNoTracking() on m.UserId equals u.Id
                      orderby m.Role, u.DisplayName
                      select new MemberRow(u.Id, u.DisplayName, u.Email, m.Role, m.CreateDate, u.IsActive)).ToListAsync();
    }

    // ------------------------------------------------------------------------------------------------ teams

    private static string CleanName(string? name)
    {
        var clean = (name ?? "").Trim();
        if (clean.Length == 0)
        {
            throw new BizException("Bitte gib dem Team einen Namen.", "Input.Name");
        }

        return clean.Length > MaxNameLength ? clean[..MaxNameLength] : clean;
    }

    private static string? CleanColor(string? color)
    {
        var normalized = BrandLogic.NormalizeColor(color);
        return normalized;
    }

    private static async Task<string> FreeSlugAsync(DtDbContext db, string name, long? except)
    {
        var baseSlug = Slug.From(name, 60);
        if (baseSlug.Length == 0)
        {
            baseSlug = "team";
        }

        var taken = (await db.Space.Where(s => s.Slug != null && (s.Slug == baseSlug || s.Slug.StartsWith(baseSlug + "-")) && s.Id != except).Select(s => s.Slug!).ToListAsync()).ToHashSet(StringComparer.Ordinal);
        if (!taken.Contains(baseSlug))
        {
            return baseSlug;
        }

        for (var n = 2; ; n++)
        {
            var candidate = $"{baseSlug}-{n}";
            if (!taken.Contains(candidate))
            {
                return candidate;
            }
        }
    }

    /// <summary>Makes a team with the person as its Owner. Members may do it unless the administrator switched it off.</summary>
    public static async Task<Space> CreateTeamAsync(Biz biz, string? name, string? description = null, string? color = null)
    {
        biz.RequireSignedIn();
        if (!biz.IsAdmin && !biz.Platform.MembersMayCreateTeams)
        {
            throw new ForbiddenException("Der Administrator hat das Anlegen von Teams ausgeschaltet.");
        }

        var clean = CleanName(name);
        var db = biz.Db;
        var space = new Space
        {
            Kind = SpaceKind.Team,
            Name = clean,
            Slug = await FreeSlugAsync(db, clean, null),
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim()[..Math.Min(description.Trim().Length, 500)],
            Color = CleanColor(color) ?? "#1fb3d6",
        };
        db.Space.Add(space);
        await db.SaveChangesAsync();
        db.SpaceMember.Add(new SpaceMember { SpaceId = space.Id, UserId = biz.UserId, Role = SpaceRole.Owner });
        await db.SaveChangesAsync();
        await biz.Log.LogAsync("Team angelegt", nameof(Space), space.Id, space.Name);
        return space;
    }

    private static async Task<Space> TeamAsync(Biz biz, long id, SpaceRole min)
    {
        await Access.RequireSpaceRole(biz, id, min);
        var space = await biz.Db.Space.FirstOrDefaultAsync(s => s.Id == id) ?? throw new NotFoundException();
        if (space.Kind != SpaceKind.Team)
        {
            throw new BizException("Das geht nur bei einem Team.");
        }

        return space;
    }

    /// <summary>Name, colour and description of a team (Owner and Admin).</summary>
    public static async Task<Space> UpdateTeamAsync(Biz biz, long id, string? name, string? description, string? color)
    {
        var space = await TeamAsync(biz, id, SpaceRole.Admin);
        var clean = CleanName(name);
        if (!string.Equals(clean, space.Name, StringComparison.Ordinal))
        {
            space.Name = clean;
            space.Slug = await FreeSlugAsync(biz.Db, clean, space.Id);
        }

        space.Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim()[..Math.Min(description.Trim().Length, 500)];
        space.Color = CleanColor(color) ?? space.Color;
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Team geändert", nameof(Space), id, space.Name);
        return space;
    }

    /// <summary>
    /// Deletes a team (the Owner; the name is typed to confirm). The content goes to the trash, memberships and shares to the team end, and the trash purger removes the content when the
    /// days of the trash are over.
    /// </summary>
    public static async Task DeleteTeamAsync(Biz biz, long id, string? confirmName)
    {
        var space = await TeamAsync(biz, id, SpaceRole.Owner);
        if (!string.Equals((confirmName ?? "").Trim(), space.Name, StringComparison.Ordinal))
        {
            throw new BizException("Zur Bestätigung musst du den Namen des Teams genau eintippen.", "Confirm");
        }

        await ItemLogic.TrashSpaceContentAsync(biz.Db, id, biz.Now);
        await biz.Db.SpaceMember.Where(m => m.SpaceId == id).ExecuteDeleteAsync();
        await biz.Db.Share.Where(s => s.SpaceId == id).ExecuteDeleteAsync();
        await biz.Db.Invitation.Where(i => i.SpaceId == id).ExecuteDeleteAsync();
        space.DeletedDate = biz.Now;
        biz.Db.Space.Remove(space);
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Team gelöscht", nameof(Space), id, space.Name);
    }

    // ------------------------------------------------------------------------------------------------ members

    private static async Task<int> OwnerCountAsync(DtDbContext db, long spaceId) => await db.SpaceMember.CountAsync(m => m.SpaceId == spaceId && m.Role == SpaceRole.Owner);

    /// <summary>
    /// Adds a person to a team with a role (Owner and Admin of the team; only an Owner makes Owners). The person must have an active, approved account. An administrator of the platform may add
    /// themselves to a team (for support); that is logged.
    /// </summary>
    public static async Task AddMemberAsync(Biz biz, long spaceId, long userId, SpaceRole role)
    {
        var space = await TeamForMembersAsync(biz, spaceId, userId, role);
        var user = await biz.Db.User.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId && u.IsActive && u.ApprovalState == ApprovalState.Approved) ?? throw new BizException("Diese Person gibt es nicht oder ihr Konto ist nicht aktiv.");
        if (await biz.Db.SpaceMember.AnyAsync(m => m.SpaceId == spaceId && m.UserId == userId))
        {
            throw new BizException($"{user.DisplayName} ist schon im Team.");
        }

        biz.Db.SpaceMember.Add(new SpaceMember { SpaceId = spaceId, UserId = userId, Role = role });
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync(userId == biz.UserId ? "Administrator ist einem Team beigetreten" : "Mitglied hinzugefügt", nameof(Space), spaceId, $"{space.Name}: {user.DisplayName} ({role})");
    }

    private static async Task<Space> TeamForMembersAsync(Biz biz, long spaceId, long userId, SpaceRole role)
    {
        biz.RequireSignedIn();
        if (biz.IsAdmin && userId == biz.UserId && await Access.RoleInAsync(biz, spaceId) is null)
        {
            var asAdmin = await biz.Db.Space.FirstOrDefaultAsync(s => s.Id == spaceId) ?? throw new NotFoundException();
            return asAdmin.Kind == SpaceKind.Team ? asAdmin : throw new BizException("Das geht nur bei einem Team.");
        }

        var space = await TeamAsync(biz, spaceId, SpaceRole.Admin);
        var mine = await Access.RoleInAsync(biz, spaceId);
        if (role == SpaceRole.Owner && mine != SpaceRole.Owner)
        {
            throw new ForbiddenException("Nur ein Inhaber kann andere zu Inhabern machen.");
        }

        return space;
    }

    /// <summary>Changes the role of a member (Owner and Admin; only an Owner touches Owners). The last Owner cannot be demoted.</summary>
    public static async Task ChangeRoleAsync(Biz biz, long spaceId, long userId, SpaceRole role)
    {
        var space = await TeamAsync(biz, spaceId, SpaceRole.Admin);
        var mine = await Access.RoleInAsync(biz, spaceId);
        var member = await biz.Db.SpaceMember.FirstOrDefaultAsync(m => m.SpaceId == spaceId && m.UserId == userId) ?? throw new BizException("Diese Person ist nicht im Team.");
        if ((role == SpaceRole.Owner || member.Role == SpaceRole.Owner) && mine != SpaceRole.Owner)
        {
            throw new ForbiddenException("Nur ein Inhaber kann Inhaber ernennen oder ändern.");
        }

        if (member.Role == SpaceRole.Owner && role != SpaceRole.Owner && await OwnerCountAsync(biz.Db, spaceId) <= 1)
        {
            throw new BizException("Ein Team braucht mindestens einen Inhaber. Ernenne zuerst jemand anderen zum Inhaber.");
        }

        member.Role = role;
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Rolle im Team geändert", nameof(Space), spaceId, $"{space.Name}: Benutzer {userId} ist {role}");
    }

    /// <summary>Takes a member out of a team (Owner and Admin; an Admin cannot remove an Owner). The last Owner stays.</summary>
    public static async Task RemoveMemberAsync(Biz biz, long spaceId, long userId)
    {
        var space = await TeamAsync(biz, spaceId, SpaceRole.Admin);
        var mine = await Access.RoleInAsync(biz, spaceId);
        var member = await biz.Db.SpaceMember.FirstOrDefaultAsync(m => m.SpaceId == spaceId && m.UserId == userId) ?? throw new BizException("Diese Person ist nicht im Team.");
        if (member.Role == SpaceRole.Owner && mine != SpaceRole.Owner)
        {
            throw new ForbiddenException("Nur ein Inhaber kann einen Inhaber entfernen.");
        }

        if (member.Role == SpaceRole.Owner && await OwnerCountAsync(biz.Db, spaceId) <= 1)
        {
            throw new BizException("Das ist der letzte Inhaber. Ernenne zuerst jemand anderen zum Inhaber.");
        }

        biz.Db.SpaceMember.Remove(member);
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Mitglied entfernt", nameof(Space), spaceId, $"{space.Name}: Benutzer {userId}");
    }

    /// <summary>The person leaves a team. The last Owner cannot leave (transfer the ownership first).</summary>
    public static async Task LeaveAsync(Biz biz, long spaceId)
    {
        var space = await TeamAsync(biz, spaceId, SpaceRole.Viewer);
        var uid = biz.UserId;
        var member = await biz.Db.SpaceMember.FirstAsync(m => m.SpaceId == spaceId && m.UserId == uid);
        if (member.Role == SpaceRole.Owner && await OwnerCountAsync(biz.Db, spaceId) <= 1)
        {
            throw new BizException("Du bist der letzte Inhaber. Übertrage zuerst die Inhaberschaft oder lösche das Team.");
        }

        biz.Db.SpaceMember.Remove(member);
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Team verlassen", nameof(Space), spaceId, space.Name);
    }

    /// <summary>An Owner hands the ownership to another member of the team: that member becomes Owner and the person themselves Admin.</summary>
    public static async Task TransferOwnershipAsync(Biz biz, long spaceId, long newOwnerUserId)
    {
        var space = await TeamAsync(biz, spaceId, SpaceRole.Owner);
        var uid = biz.UserId;
        if (newOwnerUserId == uid)
        {
            throw new BizException("Du bist schon Inhaber.");
        }

        var target = await biz.Db.SpaceMember.FirstOrDefaultAsync(m => m.SpaceId == spaceId && m.UserId == newOwnerUserId) ?? throw new BizException("Diese Person ist nicht im Team.");
        var me = await biz.Db.SpaceMember.FirstAsync(m => m.SpaceId == spaceId && m.UserId == uid);
        target.Role = SpaceRole.Owner;
        me.Role = SpaceRole.Admin;
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Inhaberschaft übertragen", nameof(Space), spaceId, $"{space.Name}: an Benutzer {newOwnerUserId}");
    }
}
