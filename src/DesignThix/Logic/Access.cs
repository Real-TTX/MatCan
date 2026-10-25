using System.Linq.Expressions;
using DesignThix.Data;
using DesignThix.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Logic;

/// <summary>What a person may do with an item. Each level includes the ones below it.</summary>
public enum AccessLevel
{
    None = 0,

    /// <summary>Look at it, run it, copy it.</summary>
    View = 1,

    /// <summary>Change it.</summary>
    Edit = 2,

    /// <summary>Share it, move it, rename a folder, trash it, restore it, delete it for good.</summary>
    Manage = 3,
}

/// <summary>Which ways to an item count: all of them, or only the membership of its area (and what the platform owns).</summary>
public enum AccessVia
{
    Any,
    Membership,
}

/// <summary>An item that is somewhere: where it lives and what the person may do there. Pages receive these flags instead of asking for a role.</summary>
public sealed record ItemPlace(long? SpaceId, long? FolderId, AccessLevel Level)
{
    public bool CanEdit => Level >= AccessLevel.Edit;

    public bool CanManage => Level >= AccessLevel.Manage;
}

/// <summary>
/// The heart of the platform (docs/PLAN-PLATFORM.md section 3). The level of a person on an item is the highest of: the membership of the item's area (personal owner, team
/// Owner, Admin and Editor = Manage; team Viewer = View), a share on the item or on a folder above it (to the person or to a team of the person), and a live "signed-in" link of the item
/// or of a folder above it that the person opened. What the platform owns (<c>SpaceId</c> null: built-in images, system templates) is for everybody to view, and for administrators
/// to manage. A platform administrator gets nothing else from the role. A trashed item is missing for everybody but the people who manage it, and for them only through the trash.
/// <para>
/// <b>Lists are one SQL each</b>: <see cref="Visible{T}"/> adds a <c>WHERE</c> made of <c>EXISTS</c> subqueries over the memberships, the shares (with the path prefix of the folder tree)
/// and the link grants, so a page never loads what it may not show. A single item is checked by <see cref="LevelAsync"/> and <see cref="RequireAsync"/>: an item that is missing or invisible
/// is a <see cref="NotFoundException"/> (404, so ids cannot be probed), a visible one with too low a level a <see cref="ForbiddenException"/> (403).
/// </para>
/// </summary>
public static class Access
{
    private static readonly SharePermission[] ViewPermissions = [SharePermission.View, SharePermission.Edit];
    private static readonly SharePermission[] EditPermissions = [SharePermission.Edit];

    private enum Trash
    {
        Live,
        Trashed,
        Ignore,
    }

    // ------------------------------------------------------------------------------------------------ one item

    /// <summary>The kind of item an entity is.</summary>
    public static ItemKind KindOf<T>() => KindOf(typeof(T));

    public static ItemKind KindOf(Type type)
        => type == typeof(Design) ? ItemKind.Design
            : type == typeof(DataList) ? ItemKind.DataList
            : type == typeof(OutputJob) ? ItemKind.OutputJob
            : type == typeof(Asset) ? ItemKind.Asset
            : type == typeof(Folder) ? ItemKind.Folder
            : throw new ArgumentException("Not an item: " + type.Name);

    /// <summary>The level of the person on the item (None when it does not exist, is in the trash or may not be seen).</summary>
    public static Task<AccessLevel> LevelAsync(Biz biz, ItemKind kind, long id) => kind switch
    {
        ItemKind.Design => LevelAsync<Design>(biz, id),
        ItemKind.DataList => LevelAsync<DataList>(biz, id),
        ItemKind.OutputJob => LevelAsync<OutputJob>(biz, id),
        ItemKind.Asset => LevelAsync<Asset>(biz, id),
        ItemKind.Folder => LevelAsync<Folder>(biz, id),
        _ => Task.FromResult(AccessLevel.None),
    };

    public static async Task<AccessLevel> LevelAsync<T>(Biz biz, long id) where T : class
    {
        biz.RequireSignedIn();
        var x = Expression.Parameter(typeof(T), "x");
        var manage = Inline(Predicate<T>(biz, AccessLevel.Manage, AccessVia.Any, Trash.Live), x);
        var edit = Inline(Predicate<T>(biz, AccessLevel.Edit, AccessVia.Any, Trash.Live), x);
        var view = Inline(Predicate<T>(biz, AccessLevel.View, AccessVia.Any, Trash.Live), x);
        var level = Expression.Condition(manage, Expression.Constant(3), Expression.Condition(edit, Expression.Constant(2), Expression.Condition(view, Expression.Constant(1), Expression.Constant(0))));
        var select = Expression.Lambda<Func<T, int>>(level, x);
        var found = await biz.Db.Set<T>().AsNoTracking().Where(HasId<T>(id)).Select(select).FirstOrDefaultAsync();
        return (AccessLevel)found;
    }

    /// <summary>Throws <see cref="NotFoundException"/> when the person may not see the item, <see cref="ForbiddenException"/> when they see it but may not do <paramref name="min"/> with it.</summary>
    public static async Task<AccessLevel> RequireAsync(Biz biz, ItemKind kind, long id, AccessLevel min)
    {
        var level = await LevelAsync(biz, kind, id);
        if (level == AccessLevel.None)
        {
            throw new NotFoundException();
        }

        if (level < min)
        {
            throw new ForbiddenException(Denied(min));
        }

        return level;
    }

    public static Task<AccessLevel> RequireAsync<T>(Biz biz, long id, AccessLevel min) where T : class => RequireAsync(biz, KindOf<T>(), id, min);

    private static string Denied(AccessLevel min) => min switch
    {
        AccessLevel.Manage => "Dafür fehlt dir die Berechtigung (das darf nur, wer das Element verwaltet).",
        AccessLevel.Edit => "Dafür fehlt dir die Berechtigung (du darfst es nur ansehen).",
        _ => "Dafür fehlt die Berechtigung.",
    };

    /// <summary>Where the item is and what the person may do with it; <see cref="NotFoundException"/> when it is not visible.</summary>
    public static async Task<ItemPlace> PlaceAsync(Biz biz, ItemKind kind, long id)
    {
        var level = await LevelAsync(biz, kind, id);
        if (level == AccessLevel.None)
        {
            throw new NotFoundException();
        }

        var (space, folder) = await RawPlaceAsync(biz.Db, kind, id);
        return new ItemPlace(space, folder, level);
    }

    /// <summary>Space and folder of an item, without any check (the caller has made one).</summary>
    internal static async Task<(long? SpaceId, long? FolderId)> RawPlaceAsync(DtDbContext db, ItemKind kind, long id)
    {
        PlaceRow? row = kind switch
        {
            ItemKind.Design => await db.Design.Where(d => d.Id == id).Select(d => new PlaceRow { SpaceId = d.SpaceId, FolderId = d.FolderId }).FirstOrDefaultAsync(),
            ItemKind.DataList => await db.DataList.Where(d => d.Id == id).Select(d => new PlaceRow { SpaceId = d.SpaceId, FolderId = d.FolderId }).FirstOrDefaultAsync(),
            ItemKind.OutputJob => await db.OutputJob.Where(d => d.Id == id).Select(d => new PlaceRow { SpaceId = d.SpaceId, FolderId = d.FolderId }).FirstOrDefaultAsync(),
            ItemKind.Asset => await db.Asset.Where(d => d.Id == id).Select(d => new PlaceRow { SpaceId = d.SpaceId, FolderId = d.FolderId }).FirstOrDefaultAsync(),
            ItemKind.Folder => await db.Folder.Where(d => d.Id == id).Select(d => new PlaceRow { SpaceId = d.SpaceId, FolderId = d.ParentId }).FirstOrDefaultAsync(),
            _ => null,
        };
        return row is null ? (null, null) : (row.SpaceId, row.FolderId);
    }

    private sealed class PlaceRow
    {
        public long? SpaceId { get; init; }

        public long? FolderId { get; init; }
    }

    // ------------------------------------------------------------------------------------------------ lists

    /// <summary>
    /// The items of kind <typeparamref name="T"/> (design, data list, output job, asset, folder) the person may see with at least <paramref name="min"/>, not in the trash. One SQL statement:
    /// every list, search, picker and API that returns items goes through here. <see cref="AccessVia.Membership"/> leaves out what is only shared or linked.
    /// </summary>
    public static IQueryable<T> Visible<T>(Biz biz, AccessLevel min = AccessLevel.View, AccessVia via = AccessVia.Any) where T : class
    {
        biz.RequireSignedIn();
        return biz.Db.Set<T>().Where(Predicate<T>(biz, min, via, Trash.Live));
    }

    /// <summary>The items in the trash that the person manages (membership of the area; a platform administrator also the trashed system items).</summary>
    public static IQueryable<T> VisibleTrashed<T>(Biz biz) where T : class
    {
        biz.RequireSignedIn();
        return biz.Db.Set<T>().Where(Predicate<T>(biz, AccessLevel.Manage, AccessVia.Membership, Trash.Trashed));
    }

    /// <summary>
    /// Things that belong to an area and not to a folder (fonts, sheet layouts): the person's areas and what the platform owns. For <see cref="AccessLevel.Edit"/> and above the person
    /// must be allowed to write in the area (a platform administrator also in the platform's own).
    /// </summary>
    public static IQueryable<T> VisibleInSpaces<T>(Biz biz, AccessLevel min = AccessLevel.View) where T : class
    {
        biz.RequireSignedIn();
        var x = Expression.Parameter(typeof(T), "x");
        var template = MembershipTemplate(biz, min);
        var body = Substitute(template, Expression.Property(x, "Id"), Convert(Expression.Property(x, "SpaceId"), typeof(long?)), Expression.Constant(null, typeof(long?)));
        return biz.Db.Set<T>().Where(Expression.Lambda<Func<T, bool>>(body, x));
    }

    /// <summary>The items the person got through a share or a link (not through the membership of the area), the item itself: what "Freigegeben" lists. Folders below a shared folder are reached through it.</summary>
    public static IQueryable<T> SharedWithMe<T>(Biz biz) where T : class
    {
        biz.RequireSignedIn();
        var db = biz.Db;
        var uid = biz.UserId;
        var now = biz.Now;
        var kind = KindOf<T>();
        Expression<Func<long, long?, long?, bool>> shared = (id, space, folder) =>
            db.Share.Any(s => s.ItemKind == kind && s.ItemId == id && (s.UserId == uid || (s.SpaceId != null && db.SpaceMember.Any(m => m.SpaceId == s.SpaceId && m.UserId == uid))))
            || db.LinkGrant.Any(g => g.UserId == uid && db.ShareLink.Any(l => l.Id == g.ShareLinkId && l.ItemKind == kind && l.ItemId == id && l.Audience == LinkAudience.SignedIn && l.RevokedDate == null && (l.ExpiresDate == null || l.ExpiresDate > now)));
        Expression<Func<long, long?, long?, bool>> member = (id, space, folder) => db.SpaceMember.Any(m => m.SpaceId == space && m.UserId == uid);
        var predicate = For<T>(Combine(shared, Not(member)), Trash.Live);
        return db.Set<T>().Where(predicate);
    }

    /// <summary>The areas the person may write in (their own, and the teams where they are Owner, Admin or Editor).</summary>
    public static IQueryable<Space> WritableSpaces(Biz biz)
    {
        biz.RequireSignedIn();
        var db = biz.Db;
        var uid = biz.UserId;
        return db.Space.Where(s => db.SpaceMember.Any(m => m.SpaceId == s.Id && m.UserId == uid && m.Role != SpaceRole.Viewer));
    }

    /// <summary>The areas the person is a member of, in any role.</summary>
    public static IQueryable<Space> MemberSpaces(Biz biz)
    {
        biz.RequireSignedIn();
        var db = biz.Db;
        var uid = biz.UserId;
        return db.Space.Where(s => db.SpaceMember.Any(m => m.SpaceId == s.Id && m.UserId == uid));
    }

    // ------------------------------------------------------------------------------------------------ areas

    private static int Rank(SpaceRole role) => role switch
    {
        SpaceRole.Owner => 3,
        SpaceRole.Admin => 2,
        SpaceRole.Editor => 1,
        _ => 0,
    };

    /// <summary>True when <paramref name="role"/> is <paramref name="min"/> or stronger.</summary>
    public static bool AtLeast(SpaceRole role, SpaceRole min) => Rank(role) >= Rank(min);

    /// <summary>The role of the person in an area; null when they are no member.</summary>
    public static async Task<SpaceRole?> RoleInAsync(Biz biz, long spaceId)
    {
        var uid = biz.UserId;
        return await biz.Db.SpaceMember.AsNoTracking().Where(m => m.SpaceId == spaceId && m.UserId == uid).Select(m => (SpaceRole?)m.Role).FirstOrDefaultAsync();
    }

    /// <summary>The person must be a member of the area with at least this role: a stranger gets 404 (the area is not theirs to know), a member with too weak a role 403.</summary>
    public static async Task<SpaceRole> RequireSpaceRole(Biz biz, long spaceId, SpaceRole min)
    {
        biz.RequireSignedIn();
        var role = await RoleInAsync(biz, spaceId) ?? throw new NotFoundException();
        if (!AtLeast(role, min))
        {
            throw new ForbiddenException(min switch
            {
                SpaceRole.Owner => "Das darf nur der Inhaber des Bereichs.",
                SpaceRole.Admin => "Das dürfen nur Inhaber und Admins des Bereichs.",
                _ => "In diesem Bereich darfst du nur ansehen.",
            });
        }

        return role;
    }

    /// <summary>The area new things go to: the one asked for (the person must be allowed to write there) or their personal area.</summary>
    public static async Task<long> WritableSpaceAsync(Biz biz, long? spaceId)
    {
        if (spaceId is null)
        {
            return await biz.PersonalSpaceIdAsync();
        }

        await RequireSpaceRole(biz, spaceId.Value, SpaceRole.Editor);
        return spaceId.Value;
    }

    /// <summary>
    /// Where something new goes. A folder wins (the person needs Edit on it, the area is the folder's); otherwise the area asked for, otherwise the personal area.
    /// </summary>
    public static async Task<(long SpaceId, long? FolderId)> PlacementAsync(Biz biz, long? spaceId, long? folderId)
    {
        if (folderId is { } folder)
        {
            await RequireAsync(biz, ItemKind.Folder, folder, AccessLevel.Edit);
            var folderSpace = await biz.Db.Folder.AsNoTracking().Where(f => f.Id == folder).Select(f => f.SpaceId).FirstAsync();
            if (spaceId is { } asked && asked != folderSpace)
            {
                throw new BizException("Der Ordner liegt in einem anderen Bereich.");
            }

            return (folderSpace, folder);
        }

        return (await WritableSpaceAsync(biz, spaceId), null);
    }

    /// <summary>Where a copy of an item goes: next to the original when the person may write in its area, else into their personal area.</summary>
    public static async Task<(long SpaceId, long? FolderId)> CopyTargetAsync(Biz biz, long? sourceSpaceId, long? sourceFolderId)
    {
        if (sourceSpaceId is { } space && await RoleInAsync(biz, space) is { } role && role != SpaceRole.Viewer)
        {
            return (space, sourceFolderId);
        }

        return (await biz.PersonalSpaceIdAsync(), null);
    }

    // ------------------------------------------------------------------------------------------------ the predicate

    /// <summary>A test of the access of one item as an expression over the entity (what <c>Where</c> and <c>Select</c> need).</summary>
    private static Expression<Func<T, bool>> Predicate<T>(Biz biz, AccessLevel min, AccessVia via, Trash trash) where T : class
        => For<T>(CoreTemplate(biz, KindOf<T>(), min, via), trash);

    private static Expression<Func<long, long?, long?, bool>> CoreTemplate(Biz biz, ItemKind kind, AccessLevel min, AccessVia via)
    {
        if (min == AccessLevel.None)
        {
            throw new ArgumentException("A level is needed.", nameof(min));
        }

        var parts = new List<Expression<Func<long, long?, long?, bool>>> { MembershipTemplate(biz, min) };
        if (via == AccessVia.Any && min != AccessLevel.Manage)
        {
            var db = biz.Db;
            var uid = biz.UserId;
            var now = biz.Now;
            var perms = min == AccessLevel.Edit ? EditPermissions : ViewPermissions;

            // a share on the item itself
            parts.Add((id, space, folder) => db.Share.Any(s => s.ItemKind == kind && s.ItemId == id && perms.Contains(s.Permission)
                && (s.UserId == uid || (s.SpaceId != null && db.SpaceMember.Any(m => m.SpaceId == s.SpaceId && m.UserId == uid)))));

            // a share on a folder above it: the folder's path starts with the path of the shared folder (a folder counts itself)
            parts.Add((id, space, folder) => folder != null && db.Share.Any(s => s.ItemKind == ItemKind.Folder && perms.Contains(s.Permission)
                && (s.UserId == uid || (s.SpaceId != null && db.SpaceMember.Any(m => m.SpaceId == s.SpaceId && m.UserId == uid)))
                && db.Folder.Any(g => g.Id == s.ItemId && db.Folder.Any(f => f.Id == folder && f.Path.StartsWith(g.Path)))));

            // a live link of the item or of a folder above it that the person opened
            parts.Add((id, space, folder) => db.LinkGrant.Any(g => g.UserId == uid && db.ShareLink.Any(l => l.Id == g.ShareLinkId
                && l.Audience == LinkAudience.SignedIn && l.RevokedDate == null && (l.ExpiresDate == null || l.ExpiresDate > now) && perms.Contains(l.Permission)
                && ((l.ItemKind == kind && l.ItemId == id)
                    || (folder != null && l.ItemKind == ItemKind.Folder && db.Folder.Any(h => h.Id == l.ItemId && db.Folder.Any(f => f.Id == folder && f.Path.StartsWith(h.Path))))))));
        }

        return parts.Aggregate(Or);
    }

    /// <summary>What the platform owns and what the membership of the area gives.</summary>
    private static Expression<Func<long, long?, long?, bool>> MembershipTemplate(Biz biz, AccessLevel min)
    {
        var db = biz.Db;
        var uid = biz.UserId;
        var systemOk = min == AccessLevel.View || biz.IsAdmin;
        Expression<Func<long, long?, long?, bool>> system = systemOk ? (id, space, folder) => space == null : (id, space, folder) => false;
        Expression<Func<long, long?, long?, bool>> member = min == AccessLevel.View
            ? (id, space, folder) => space != null && db.SpaceMember.Any(m => m.SpaceId == space && m.UserId == uid)
            : (id, space, folder) => space != null && db.SpaceMember.Any(m => m.SpaceId == space && m.UserId == uid && m.Role != SpaceRole.Viewer);
        return Or(system, member);
    }

    private static Expression<Func<long, long?, long?, bool>> Or(Expression<Func<long, long?, long?, bool>> a, Expression<Func<long, long?, long?, bool>> b)
    {
        var id = Expression.Parameter(typeof(long), "id");
        var space = Expression.Parameter(typeof(long?), "space");
        var folder = Expression.Parameter(typeof(long?), "folder");
        var left = Substitute(a, id, space, folder);
        var right = Substitute(b, id, space, folder);
        return Expression.Lambda<Func<long, long?, long?, bool>>(Expression.OrElse(left, right), id, space, folder);
    }

    private static Expression<Func<long, long?, long?, bool>> Combine(Expression<Func<long, long?, long?, bool>> a, Expression<Func<long, long?, long?, bool>> b)
    {
        var id = Expression.Parameter(typeof(long), "id");
        var space = Expression.Parameter(typeof(long?), "space");
        var folder = Expression.Parameter(typeof(long?), "folder");
        return Expression.Lambda<Func<long, long?, long?, bool>>(Expression.AndAlso(Substitute(a, id, space, folder), Substitute(b, id, space, folder)), id, space, folder);
    }

    private static Expression<Func<long, long?, long?, bool>> Not(Expression<Func<long, long?, long?, bool>> a)
    {
        var id = Expression.Parameter(typeof(long), "id");
        var space = Expression.Parameter(typeof(long?), "space");
        var folder = Expression.Parameter(typeof(long?), "folder");
        return Expression.Lambda<Func<long, long?, long?, bool>>(Expression.Not(Substitute(a, id, space, folder)), id, space, folder);
    }

    /// <summary>Turns the template over (id, space, folder) into a test over the entity: <c>Id</c>, <c>SpaceId</c>, and <c>FolderId</c> (a folder: its own id) are read from it.</summary>
    private static Expression<Func<T, bool>> For<T>(Expression<Func<long, long?, long?, bool>> template, Trash trash) where T : class
    {
        var x = Expression.Parameter(typeof(T), "x");
        var id = Expression.Property(x, "Id");
        var space = Convert(Expression.Property(x, "SpaceId"), typeof(long?));
        var folder = typeof(T) == typeof(Folder) ? Convert(id, typeof(long?)) : Convert(Expression.Property(x, "FolderId"), typeof(long?));
        Expression body = Substitute(template, id, space, folder);
        if (trash != Trash.Ignore)
        {
            var trashed = Expression.Property(x, "TrashedDate");
            var isNull = Expression.Equal(trashed, Expression.Constant(null, typeof(DateTime?)));
            body = Expression.AndAlso(trash == Trash.Live ? isNull : Expression.Not(isNull), body);
        }

        return Expression.Lambda<Func<T, bool>>(body, x);
    }

    private static Expression Convert(Expression expression, Type type) => expression.Type == type ? expression : Expression.Convert(expression, type);

    private static Expression<Func<T, bool>> HasId<T>(long id) where T : class
    {
        var x = Expression.Parameter(typeof(T), "x");
        return Expression.Lambda<Func<T, bool>>(Expression.Equal(Expression.Property(x, "Id"), Expression.Constant(id)), x);
    }

    private static Expression Inline<T>(Expression<Func<T, bool>> predicate, ParameterExpression x) => new Replacer(predicate.Parameters[0], x).Visit(predicate.Body);

    private static Expression Substitute(Expression<Func<long, long?, long?, bool>> template, Expression id, Expression space, Expression folder)
    {
        var map = new Dictionary<ParameterExpression, Expression>
        {
            [template.Parameters[0]] = id,
            [template.Parameters[1]] = space,
            [template.Parameters[2]] = folder,
        };
        return new MapReplacer(map).Visit(template.Body);
    }

    private sealed class Replacer(ParameterExpression from, Expression to) : ExpressionVisitor
    {
        protected override Expression VisitParameter(ParameterExpression node) => node == from ? to : base.VisitParameter(node);
    }

    private sealed class MapReplacer(Dictionary<ParameterExpression, Expression> map) : ExpressionVisitor
    {
        protected override Expression VisitParameter(ParameterExpression node) => map.TryGetValue(node, out var to) ? to : base.VisitParameter(node);
    }
}
