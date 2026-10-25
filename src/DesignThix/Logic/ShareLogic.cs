using DesignThix.Data;
using DesignThix.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Logic;

/// <summary>A person or team the "Teilen" dialog offers (<see cref="Type"/> is "user" or "team").</summary>
public sealed record ShareTargetRow(string Type, long Id, string Name, string? Email, string? Color);

/// <summary>
/// One line of "who has access": the owner, a member of the team, a share to a person or a team, directly or through a folder above. <see cref="Permission"/> is "manage" (owner, team Owner/Admin/Editor),
/// "view" or "edit". <see cref="CanChange"/> tells whether the person who looks may change or remove the line (shares only: the others are changed in the team).
/// </summary>
public sealed record AccessEntry(string Kind, long? ShareId, long? UserId, long? SpaceId, string Name, string? Email, string? Color, SpaceRole? Role, string Permission, bool Inherited, long? ViaFolderId, string? ViaFolderName, bool CanChange);

/// <summary>The live link of an item (only people who manage the item see it, with its secret token).</summary>
public sealed record LinkInfo(long Id, Guid Token, LinkAudience Audience, SharePermission Permission, bool AllowDownload, DateTime? ExpiresDate);

/// <summary>Everything the "Teilen" dialog shows for an item.</summary>
public sealed record AccessInfo(ItemKind Kind, long Id, string Name, AccessLevel MyLevel, long? SpaceId, string? SpaceName, SpaceKind? SpaceKind, IReadOnlyList<AccessEntry> Entries, LinkInfo? Link,
    bool CanShare, bool CanLink, bool PublicLinksAllowed, bool PublicLinkPossible);

/// <summary>What a link points to, as long as it is live (an item in the trash does not count).</summary>
public sealed record LinkTarget(long LinkId, ItemKind Kind, long ItemId, string Name, LinkAudience Audience, SharePermission Permission, bool AllowDownload);

/// <summary>
/// Sharing (docs/PLAN-PLATFORM.md section 1.6 and 3): shares with people and teams (View or Edit), the link of an item (SignedIn: whoever signs in and opens it gets its permission; Public: anybody
/// may look, designs and folders only, when the administrator allows it), and the list of who has access. Rules: Manage may share View or Edit and set links; Edit may share with people and teams up
/// to Edit but no links, and change only the shares they made; View cannot share. A share goes to people with an active, approved account, or to a team the sharer is in.
/// </summary>
public static class ShareLogic
{
    public const int MaxSearchResults = 8;

    private static bool CanShareKind(ItemKind kind) => kind is ItemKind.Folder or ItemKind.Design or ItemKind.DataList or ItemKind.OutputJob;

    private static void RequireShareable(ItemKind kind)
    {
        if (!CanShareKind(kind))
        {
            throw new BizException("Bilder werden nicht einzeln geteilt: lege sie in einen Ordner und teile den Ordner.");
        }
    }

    private static async Task<string> NameOfAsync(DtDbContext db, ItemKind kind, long id) => (kind switch
    {
        ItemKind.Folder => await db.Folder.AsNoTracking().Where(x => x.Id == id).Select(x => x.Name).FirstOrDefaultAsync(),
        ItemKind.Design => await db.Design.AsNoTracking().Where(x => x.Id == id).Select(x => x.Name).FirstOrDefaultAsync(),
        ItemKind.DataList => await db.DataList.AsNoTracking().Where(x => x.Id == id).Select(x => x.Name).FirstOrDefaultAsync(),
        ItemKind.OutputJob => await db.OutputJob.AsNoTracking().Where(x => x.Id == id).Select(x => x.Name).FirstOrDefaultAsync(),
        _ => await db.Asset.AsNoTracking().Where(x => x.Id == id).Select(x => x.Name).FirstOrDefaultAsync(),
    }) ?? "";

    /// <summary>The folder ids on the way from the top to the item (the folder itself included for a folder); empty for an item at the top of an area.</summary>
    private static async Task<List<long>> FolderChainAsync(DtDbContext db, ItemKind kind, long id)
    {
        var (_, folder) = await Access.RawPlaceAsync(db, kind, id);
        long? start = kind == ItemKind.Folder ? id : folder;
        if (start is not { } startId)
        {
            return [];
        }

        var path = await db.Folder.AsNoTracking().Where(f => f.Id == startId).Select(f => f.Path).FirstOrDefaultAsync();
        return path is null ? [] : [.. path.Split('/', StringSplitOptions.RemoveEmptyEntries).Select(long.Parse)];
    }

    // ------------------------------------------------------------------------------------------------ who has access

    /// <summary>
    /// Who has access to an item and how, and what the person may do in the dialog. Viewing the item is enough to look at the list; the link with its secret only goes to people who manage the item.
    /// </summary>
    public static async Task<AccessInfo> InfoAsync(Biz biz, ItemKind kind, long id)
    {
        RequireShareable(kind);
        var level = await Access.RequireAsync(biz, kind, id, AccessLevel.View);
        var db = biz.Db;
        var uid = biz.UserId;
        var (spaceId, _) = await Access.RawPlaceAsync(db, kind, id);
        var entries = new List<AccessEntry>();
        string? spaceName = null;
        SpaceKind? spaceKind = null;
        if (spaceId is { } space)
        {
            var s = await db.Space.AsNoTracking().Where(x => x.Id == space).Select(x => new { x.Kind, x.Name, x.Color }).FirstAsync();
            spaceKind = s.Kind;
            spaceName = s.Kind == SpaceKind.Personal ? SpaceLogic.PersonalName : s.Name;
            var members = await (from m in db.SpaceMember.AsNoTracking()
                                 where m.SpaceId == space
                                 join u in db.User.AsNoTracking() on m.UserId equals u.Id
                                 orderby m.Role, u.DisplayName
                                 select new { m.Role, u.Id, u.DisplayName, u.Email }).ToListAsync();
            foreach (var m in members)
            {
                entries.Add(new AccessEntry(s.Kind == SpaceKind.Personal ? "owner" : "member", null, m.Id, space, m.DisplayName, m.Email, null, m.Role, m.Role == SpaceRole.Viewer ? "view" : "manage", false, null, null, false));
            }
        }

        var chain = await FolderChainAsync(db, kind, id);
        var folderNames = chain.Count == 0 ? [] : await db.Folder.AsNoTracking().Where(f => chain.Contains(f.Id)).ToDictionaryAsync(f => f.Id, f => f.Name);
        var shares = await db.Share.AsNoTracking()
            .Where(s => (s.ItemKind == kind && s.ItemId == id) || (s.ItemKind == ItemKind.Folder && chain.Contains(s.ItemId)))
            .ToListAsync();
        var userIds = shares.Where(s => s.UserId is not null).Select(s => s.UserId!.Value).Distinct().ToList();
        var teamIds = shares.Where(s => s.SpaceId is not null).Select(s => s.SpaceId!.Value).Distinct().ToList();
        var users = await db.User.AsNoTracking().Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id);
        var teams = await db.Space.AsNoTracking().Where(t => teamIds.Contains(t.Id)).ToDictionaryAsync(t => t.Id);
        foreach (var share in shares.OrderBy(s => s.ItemKind == kind && s.ItemId == id ? 0 : 1).ThenBy(s => s.Id))
        {
            var direct = share.ItemKind == kind && share.ItemId == id;
            var canChange = direct && (level >= AccessLevel.Manage || (level >= AccessLevel.Edit && share.CreateUserId == uid));
            var viaId = direct ? (long?)null : share.ItemId;
            var viaName = viaId is { } v && folderNames.TryGetValue(v, out var n) ? n : null;
            var permission = share.Permission == SharePermission.Edit ? "edit" : "view";
            if (share.UserId is { } shareUser && users.TryGetValue(shareUser, out var user))
            {
                entries.Add(new AccessEntry("user", share.Id, user.Id, null, user.DisplayName, user.Email, null, null, permission, !direct, viaId, viaName, canChange));
            }
            else if (share.SpaceId is { } shareTeam && teams.TryGetValue(shareTeam, out var team))
            {
                entries.Add(new AccessEntry("team", share.Id, null, team.Id, team.Name, null, team.Color, null, permission, !direct, viaId, viaName, canChange));
            }
        }

        var publicPossible = kind is ItemKind.Design or ItemKind.Folder;
        LinkInfo? link = null;
        if (level >= AccessLevel.Manage)
        {
            var live = await LiveLinkAsync(db, kind, id, biz.Now);
            link = live is null ? null : new LinkInfo(live.Id, live.Token, live.Audience, live.Permission, live.AllowDownload, live.ExpiresDate);
        }

        return new AccessInfo(kind, id, await NameOfAsync(db, kind, id), level, spaceId, spaceName, spaceKind, entries, link, level >= AccessLevel.Edit, level >= AccessLevel.Manage,
            biz.Platform.PublicLinks, publicPossible && biz.Platform.PublicLinks);
    }

    /// <summary>The link of an item that was not switched off (it may have expired: whoever manages the item sees it and may set a new date). At most one.</summary>
    private static Task<ShareLink?> LiveLinkAsync(DtDbContext db, ItemKind kind, long id, DateTime now)
        => db.ShareLink.AsNoTracking().Where(l => l.ItemKind == kind && l.ItemId == id && l.RevokedDate == null).OrderByDescending(l => l.Id).FirstOrDefaultAsync();

    // ------------------------------------------------------------------------------------------------ shares

    /// <summary>
    /// Shares an item with a person (<paramref name="isTeam"/> false) or a team. Needs Edit on the item (Manage for everything the rules allow). A share that exists is changed. The person must have an active,
    /// approved account; a team must be one the sharer is a member of. Returns the share.
    /// </summary>
    public static async Task<Share> AddAsync(Biz biz, ItemKind kind, long itemId, bool isTeam, long targetId, SharePermission permission)
    {
        RequireShareable(kind);
        var level = await Access.RequireAsync(biz, kind, itemId, AccessLevel.Edit);
        var db = biz.Db;
        var uid = biz.UserId;
        if (!isTeam)
        {
            if (targetId == uid)
            {
                throw new BizException("Du kannst nichts mit dir selbst teilen.");
            }

            if (!await db.User.AnyAsync(u => u.Id == targetId && u.IsActive && u.ApprovalState == ApprovalState.Approved))
            {
                throw new BizException("Diese Person gibt es nicht, oder ihr Konto ist nicht aktiv.");
            }
        }
        else if (await Access.RoleInAsync(biz, targetId) is null || !await db.Space.AnyAsync(s => s.Id == targetId && s.Kind == SpaceKind.Team))
        {
            throw new BizException("Dieses Team gibt es nicht, oder du bist kein Mitglied.");
        }

        var share = await db.Share.FirstOrDefaultAsync(s => s.ItemKind == kind && s.ItemId == itemId && (isTeam ? s.SpaceId == targetId : s.UserId == targetId));
        if (share is null)
        {
            share = new Share { ItemKind = kind, ItemId = itemId, UserId = isTeam ? null : targetId, SpaceId = isTeam ? targetId : null, Permission = permission };
            db.Share.Add(share);
        }
        else
        {
            if (level < AccessLevel.Manage && share.CreateUserId != uid)
            {
                throw new ForbiddenException("Diese Freigabe hat jemand anderes gemacht: ändern darf sie nur, wer das Element verwaltet.");
            }

            share.Permission = permission;
        }

        await db.SaveChangesAsync();
        await biz.Log.LogAsync("Freigabe", kind.ToString(), itemId, $"{(isTeam ? "Team" : "Person")} {targetId}: {permission}");
        return share;
    }

    private static async Task<(Share Share, AccessLevel Level)> OwnShareAsync(Biz biz, long shareId)
    {
        var share = await biz.Db.Share.FirstOrDefaultAsync(s => s.Id == shareId) ?? throw new NotFoundException();
        var level = await Access.RequireAsync(biz, share.ItemKind, share.ItemId, AccessLevel.Edit);
        if (level < AccessLevel.Manage && share.CreateUserId != biz.UserId)
        {
            throw new ForbiddenException("Diese Freigabe hat jemand anderes gemacht: ändern darf sie nur, wer das Element verwaltet.");
        }

        return (share, level);
    }

    /// <summary>Changes what a share allows. Needs Manage on the item, or Edit for a share the person made.</summary>
    public static async Task ChangeAsync(Biz biz, long shareId, SharePermission permission)
    {
        var (share, _) = await OwnShareAsync(biz, shareId);
        share.Permission = permission;
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Freigabe geändert", share.ItemKind.ToString(), share.ItemId, permission.ToString());
    }

    /// <summary>Takes a share away. Needs Manage on the item, or Edit for a share the person made.</summary>
    public static async Task RemoveAsync(Biz biz, long shareId)
    {
        var (share, _) = await OwnShareAsync(biz, shareId);
        biz.Db.Share.Remove(share);
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Freigabe entfernt", share.ItemKind.ToString(), share.ItemId, null);
    }

    /// <summary>A person leaves a share that was made with them (the share to the person themselves, not one to a team).</summary>
    public static async Task LeaveShareAsync(Biz biz, ItemKind kind, long itemId)
    {
        biz.RequireSignedIn();
        var uid = biz.UserId;
        await biz.Db.Share.Where(s => s.ItemKind == kind && s.ItemId == itemId && s.UserId == uid).ExecuteDeleteAsync();
        await RemoveLinkGrantAsync(biz, kind, itemId);
    }

    // ------------------------------------------------------------------------------------------------ links

    private static async Task<ShareLink> RequireLinkRightsAsync(Biz biz, ItemKind kind, long id, LinkAudience audience)
    {
        RequireShareable(kind);
        await Access.RequireAsync(biz, kind, id, AccessLevel.Manage);
        if (audience == LinkAudience.Public)
        {
            if (kind is not (ItemKind.Design or ItemKind.Folder))
            {
                throw new BizException("Einen öffentlichen Link gibt es nur für Designs und Ordner.");
            }

            if (!biz.Platform.PublicLinks)
            {
                throw new BizException("Der Administrator hat öffentliche Links ausgeschaltet.");
            }
        }

        return await LiveLinkAsync(biz.Db, kind, id, biz.Now) is { } live ? await biz.Db.ShareLink.FirstAsync(l => l.Id == live.Id) : new ShareLink { ItemKind = kind, ItemId = id };
    }

    /// <summary>
    /// Makes the link of an item or changes it (Manage). SignedIn: whoever signs in and opens it gets <paramref name="permission"/> on the item. Public: anybody may look at it without signing in
    /// (designs and folders only, when the administrator allows it; View only). An item has at most one live link.
    /// </summary>
    public static async Task<ShareLink> SetLinkAsync(Biz biz, ItemKind kind, long id, LinkAudience audience, SharePermission permission, bool allowDownload, DateTime? expiresDate)
    {
        var link = await RequireLinkRightsAsync(biz, kind, id, audience);
        if (expiresDate is { } expires && expires <= biz.Now)
        {
            throw new BizException("Das Ablaufdatum liegt in der Vergangenheit.");
        }

        var wasSignedIn = link.Id != 0 && link.Audience == LinkAudience.SignedIn;
        link.Audience = audience;
        link.Permission = audience == LinkAudience.Public ? SharePermission.View : permission;
        link.AllowDownload = audience == LinkAudience.Public && allowDownload;
        link.ExpiresDate = expiresDate;
        if (link.Id == 0)
        {
            biz.Db.ShareLink.Add(link);
        }

        await biz.Db.SaveChangesAsync();
        if (wasSignedIn && audience == LinkAudience.Public)
        {
            await biz.Db.LinkGrant.Where(g => g.ShareLinkId == link.Id).ExecuteDeleteAsync();
        }

        await biz.Log.LogAsync("Link gesetzt", kind.ToString(), id, $"{audience}, {link.Permission}");
        return link;
    }

    /// <summary>Makes the old link dead and gives the item a new one with the same settings (a new token).</summary>
    public static async Task<ShareLink> ResetLinkAsync(Biz biz, ItemKind kind, long id)
    {
        RequireShareable(kind);
        await Access.RequireAsync(biz, kind, id, AccessLevel.Manage);
        var old = await LiveLinkAsync(biz.Db, kind, id, biz.Now) ?? throw new BizException("Es gibt noch keinen Link.");
        await RevokeAsync(biz.Db, old.Id, biz.Now);
        var fresh = new ShareLink { ItemKind = kind, ItemId = id, Audience = old.Audience, Permission = old.Permission, AllowDownload = old.AllowDownload, ExpiresDate = old.ExpiresDate is { } e && e > biz.Now ? e : null };
        biz.Db.ShareLink.Add(fresh);
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Link zurückgesetzt", kind.ToString(), id, null);
        return fresh;
    }

    /// <summary>Switches the link of an item off (back to "Nur Personen mit Zugriff").</summary>
    public static async Task RevokeLinkAsync(Biz biz, ItemKind kind, long id)
    {
        RequireShareable(kind);
        await Access.RequireAsync(biz, kind, id, AccessLevel.Manage);
        var live = await LiveLinkAsync(biz.Db, kind, id, biz.Now);
        if (live is not null)
        {
            await RevokeAsync(biz.Db, live.Id, biz.Now);
            await biz.Log.LogAsync("Link entfernt", kind.ToString(), id, null);
        }
    }

    private static async Task RevokeAsync(DtDbContext db, long linkId, DateTime now)
    {
        await db.ShareLink.Where(l => l.Id == linkId).ExecuteUpdateAsync(s => s.SetProperty(l => l.RevokedDate, now));
        await db.LinkGrant.Where(g => g.ShareLinkId == linkId).ExecuteDeleteAsync();
    }

    /// <summary>
    /// What a token points to, when the link is live: not revoked, not expired, the item there and not in the trash. No sign-in is needed (the public pages call it); null otherwise.
    /// </summary>
    public static async Task<LinkTarget?> ResolveAsync(DtDbContext db, Guid token, DateTime now)
    {
        var link = await db.ShareLink.AsNoTracking().FirstOrDefaultAsync(l => l.Token == token);
        if (link is null || link.RevokedDate is not null || (link.ExpiresDate is { } expires && expires <= now))
        {
            return null;
        }

        var exists = link.ItemKind switch
        {
            ItemKind.Folder => await db.Folder.AnyAsync(x => x.Id == link.ItemId && x.TrashedDate == null),
            ItemKind.Design => await db.Design.AnyAsync(x => x.Id == link.ItemId && x.TrashedDate == null),
            ItemKind.DataList => await db.DataList.AnyAsync(x => x.Id == link.ItemId && x.TrashedDate == null),
            ItemKind.OutputJob => await db.OutputJob.AnyAsync(x => x.Id == link.ItemId && x.TrashedDate == null),
            _ => false,
        };
        return exists ? new LinkTarget(link.Id, link.ItemKind, link.ItemId, await NameOfAsync(db, link.ItemKind, link.ItemId), link.Audience, link.Permission, link.AllowDownload) : null;
    }

    /// <summary>
    /// A signed-in person opens a link. A live SignedIn link gives them its permission on the item (and on what is in it, for a folder) from now on, as long as the link is live. Null when the link is
    /// dead. A public link grants nothing in the app; the caller shows the public view.
    /// </summary>
    public static async Task<LinkTarget?> OpenAsync(Biz biz, Guid token)
    {
        biz.RequireSignedIn();
        var target = await ResolveAsync(biz.Db, token, biz.Now);
        if (target is null || target.Audience != LinkAudience.SignedIn)
        {
            return target;
        }

        var uid = biz.UserId;
        var now = biz.Now;
        var changed = await biz.Db.LinkGrant.Where(g => g.ShareLinkId == target.LinkId && g.UserId == uid).ExecuteUpdateAsync(s => s.SetProperty(g => g.LastUsedDate, now));
        if (changed == 0)
        {
            var grant = new LinkGrant { ShareLinkId = target.LinkId, UserId = uid, LastUsedDate = now };
            biz.Db.LinkGrant.Add(grant);
            try
            {
                await biz.Db.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                biz.Db.Entry(grant).State = EntityState.Detached;
            }
        }

        return target;
    }

    /// <summary>"Entfernen" in the list of what was shared with the person: their access that came through a link ends (a share to them stays; use <see cref="LeaveShareAsync"/>).</summary>
    public static async Task RemoveLinkGrantAsync(Biz biz, ItemKind kind, long itemId)
    {
        biz.RequireSignedIn();
        var uid = biz.UserId;
        var links = biz.Db.ShareLink.Where(l => l.ItemKind == kind && l.ItemId == itemId).Select(l => l.Id);
        await biz.Db.LinkGrant.Where(g => g.UserId == uid && links.Contains(g.ShareLinkId)).ExecuteDeleteAsync();
    }

    // ------------------------------------------------------------------------------------------------ the people and teams to share with

    /// <summary>
    /// People and teams to share with, found by the text (at least two characters): the teams of the person whose name contains it first, then active, approved people by name or e-mail address, at most
    /// eight lines in all. The person themselves is left out.
    /// </summary>
    public static async Task<List<ShareTargetRow>> SearchAsync(Biz biz, string? q)
    {
        biz.RequireSignedIn();
        var text = (q ?? "").Trim();
        if (text.Length < 2)
        {
            return [];
        }

        text = text[..Math.Min(text.Length, 80)];
        var like = Services.Like.Contains(text);
        var uid = biz.UserId;
        var result = new List<ShareTargetRow>();
        var teams = await Access.MemberSpaces(biz).AsNoTracking().Where(s => s.Kind == SpaceKind.Team && EF.Functions.ILike(s.Name, like, "\\")).OrderBy(s => s.Name).Take(MaxSearchResults).ToListAsync();
        result.AddRange(teams.Select(t => new ShareTargetRow("team", t.Id, t.Name, null, t.Color)));
        var room = MaxSearchResults - result.Count;
        if (room > 0)
        {
            var users = await biz.Db.User.AsNoTracking()
                .Where(u => u.Id != uid && u.IsActive && u.ApprovalState == ApprovalState.Approved && (EF.Functions.ILike(u.DisplayName, like, "\\") || EF.Functions.ILike(u.Email, like, "\\")))
                .OrderBy(u => u.DisplayName).ThenBy(u => u.Id).Take(room).ToListAsync();
            result.AddRange(users.Select(u => new ShareTargetRow("user", u.Id, u.DisplayName, u.Email, null)));
        }

        return result;
    }
}
