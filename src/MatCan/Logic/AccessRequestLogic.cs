using MatCan.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace MatCan.Logic;

/// <summary>One open request as the people who manage the item see it.</summary>
public sealed record AccessRequestRow(long Id, long UserId, string Name, string? Email, SharePermission Permission, string? Message, DateTime Created);

/// <summary>
/// "Zugriff anfordern" (docs/PLAN-PLATFORM.md section 1.9). A signed-in person who opens something they may not see asks for access (View or Edit, with a message); the people who manage the item see the
/// request in the "Teilen" dialog and grant it (which makes a share with the person) or decline it. <b>Nothing here tells a person whether an item exists</b>: asking for an id that is not there is answered
/// like any other request and writes nothing, so the page cannot be used to probe ids.
/// <para>Notifications (<see cref="NotificationLogic"/>): a new request goes to the people who manage the item (with the request in the data, so the bell offers "Gewähren" and "Ablehnen"), the decision to the requester.</para>
/// </summary>
public static class AccessRequestLogic
{
    public const int MaxMessage = 500;
    public const int MaxOpenPerPerson = 50;

    private static void RequireShareable(ItemKind kind)
    {
        if (kind is not (ItemKind.Folder or ItemKind.Design or ItemKind.DataList or ItemKind.OutputJob))
        {
            throw new BizException("Dafür kann man keinen Zugriff anfordern.");
        }
    }

    private static async Task<bool> ExistsAsync(Biz biz, ItemKind kind, long id)
    {
        var db = biz.Db;
        return kind switch
        {
            ItemKind.Folder => await db.Folder.AnyAsync(x => x.Id == id && x.TrashedDate == null),
            ItemKind.Design => await db.Design.AnyAsync(x => x.Id == id && x.TrashedDate == null),
            ItemKind.DataList => await db.DataList.AnyAsync(x => x.Id == id && x.TrashedDate == null),
            ItemKind.OutputJob => await db.OutputJob.AnyAsync(x => x.Id == id && x.TrashedDate == null),
            _ => false,
        };
    }

    private static string? CleanMessage(string? message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return null;
        }

        var text = new string(message.Where(c => !char.IsControl(c) || c is '\n').ToArray()).Trim();
        return text.Length == 0 ? null : text.Length > MaxMessage ? text[..MaxMessage] : text;
    }

    /// <summary>
    /// Asks for access to an item the person cannot see (or sees with less than they ask for). A request that is still open is changed, not doubled. Returns normally for an item that does not exist, too.
    /// </summary>
    public static async Task CreateAsync(Biz biz, ItemKind kind, long itemId, SharePermission permission, string? message)
    {
        biz.RequireSignedIn();
        RequireShareable(kind);
        var uid = biz.UserId;
        var level = await Access.LevelAsync(biz, kind, itemId);
        if (level >= (permission == SharePermission.Edit ? AccessLevel.Edit : AccessLevel.View))
        {
            throw new BizException("Du hast schon Zugriff darauf.");
        }

        if (!await ExistsAsync(biz, kind, itemId))
        {
            return;
        }

        var db = biz.Db;
        var open = await db.AccessRequest.FirstOrDefaultAsync(r => r.ItemKind == kind && r.ItemId == itemId && r.UserId == uid && r.State == AccessRequestState.Open);
        if (open is null)
        {
            if (await db.AccessRequest.CountAsync(r => r.UserId == uid && r.State == AccessRequestState.Open) >= MaxOpenPerPerson)
            {
                throw new BizException("Du hast schon sehr viele offene Anfragen. Warte, bis jemand antwortet.");
            }

            open = new AccessRequest { ItemKind = kind, ItemId = itemId, UserId = uid };
            db.AccessRequest.Add(open);
        }

        var isNew = open.Id == 0;
        open.Permission = permission;
        open.Message = CleanMessage(message);
        await db.SaveChangesAsync();
        await biz.Log.LogAsync("Zugriff angefordert", kind.ToString(), itemId, permission.ToString());
        if (isNew)
        {
            // the people who manage the item hear about it; the notification carries the request, so "Gewähren" and "Ablehnen" are one click away
            var by = await NotificationLogic.ActorNameAsync(biz);
            var itemName = await NotificationLogic.ItemNameAsync(db, kind, itemId);
            await NotificationLogic.NotifyAsync(biz, await NotificationLogic.ManagersOfAsync(db, kind, itemId), NotificationKinds.AccessRequest,
                new { by, byId = uid, itemKind = kind.ToString(), itemId, itemName, permission = permission.ToString(), message = open.Message, requestId = open.Id }, NotificationLogic.ItemUrl(kind, itemId));
        }
    }

    /// <summary>The request the person has open for the item (what the page "Zugriff anfordern" shows after sending), or null.</summary>
    public static async Task<SharePermission?> MineAsync(Biz biz, ItemKind kind, long itemId)
    {
        biz.RequireSignedIn();
        var uid = biz.UserId;
        return await biz.Db.AccessRequest.AsNoTracking().Where(r => r.ItemKind == kind && r.ItemId == itemId && r.UserId == uid && r.State == AccessRequestState.Open)
            .Select(r => (SharePermission?)r.Permission).FirstOrDefaultAsync();
    }

    /// <summary>The open requests for an item, oldest first. Needs Manage on the item.</summary>
    public static async Task<List<AccessRequestRow>> ListAsync(Biz biz, ItemKind kind, long itemId)
    {
        RequireShareable(kind);
        await Access.RequireAsync(biz, kind, itemId, AccessLevel.Manage);
        return await (from r in biz.Db.AccessRequest.AsNoTracking()
                      where r.ItemKind == kind && r.ItemId == itemId && r.State == AccessRequestState.Open
                      join u in biz.Db.User.AsNoTracking() on r.UserId equals u.Id
                      orderby r.CreateDate, r.Id
                      select new AccessRequestRow(r.Id, u.Id, u.DisplayName, u.Email, r.Permission, r.Message, r.CreateDate)).ToListAsync();
    }

    /// <summary>
    /// Grants or declines a request. Needs Manage on the item. Granting shares the item with the person (View or Edit: <paramref name="permission"/> or what they asked for; a person who already has more
    /// keeps it). The request is closed in both cases; one that is closed cannot be decided again.
    /// </summary>
    public static async Task DecideAsync(Biz biz, long requestId, bool grant, SharePermission? permission = null)
    {
        var db = biz.Db;
        var request = await db.AccessRequest.FirstOrDefaultAsync(r => r.Id == requestId) ?? throw new NotFoundException();
        await Access.RequireAsync(biz, request.ItemKind, request.ItemId, AccessLevel.Manage);
        if (request.State != AccessRequestState.Open)
        {
            throw new BizException("Diese Anfrage ist schon beantwortet.");
        }

        if (grant)
        {
            var wanted = permission ?? request.Permission;
            var hasEdit = await db.Share.AnyAsync(s => s.ItemKind == request.ItemKind && s.ItemId == request.ItemId && s.UserId == request.UserId && s.Permission == SharePermission.Edit);
            var hasShare = await db.Share.AnyAsync(s => s.ItemKind == request.ItemKind && s.ItemId == request.ItemId && s.UserId == request.UserId);
            if (!(hasEdit || (hasShare && wanted == SharePermission.View)))
            {
                await ShareLogic.AddAsync(biz, request.ItemKind, request.ItemId, false, request.UserId, wanted, null, notify: false);
            }
        }

        request.State = grant ? AccessRequestState.Granted : AccessRequestState.Declined;
        request.DecidedUserId = biz.UserId;
        request.DecidedDate = biz.Now;
        await db.SaveChangesAsync();
        await biz.Log.LogAsync(grant ? "Zugriff gewährt" : "Zugriff abgelehnt", request.ItemKind.ToString(), request.ItemId, $"Person {request.UserId}");
        var decidedBy = await NotificationLogic.ActorNameAsync(biz);
        var name = await NotificationLogic.ItemNameAsync(db, request.ItemKind, request.ItemId);
        var granted = grant ? await db.Share.AsNoTracking().Where(s => s.ItemKind == request.ItemKind && s.ItemId == request.ItemId && s.UserId == request.UserId).Select(s => (SharePermission?)s.Permission).FirstOrDefaultAsync() ?? permission ?? request.Permission : request.Permission;
        await NotificationLogic.NotifyAsync(biz, [request.UserId], grant ? NotificationKinds.AccessGranted : NotificationKinds.AccessDeclined,
            new { by = decidedBy, itemKind = request.ItemKind.ToString(), itemId = request.ItemId, itemName = name, permission = granted.ToString() }, grant ? NotificationLogic.ItemUrl(request.ItemKind, request.ItemId) : null);
    }
}
