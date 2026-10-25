using DesignThix.Data;
using DesignThix.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Logic;

/// <summary>An item named by kind and id (what the move, copy, trash and star calls take).</summary>
public sealed record ItemRef(ItemKind Kind, long Id);

/// <summary>
/// One entry of the browser: a folder, design, data list, output job or image, in the same shape. <see cref="Starred"/> and <see cref="Opened"/> are the person's own; the names of the owner
/// and of the area are filled in after the query. <see cref="ThumbUrl"/> carries the hash (the capability that lets the browser load it).
/// </summary>
public sealed record ItemRow
{
    public ItemKind Kind { get; init; }

    public long Id { get; init; }

    public string Name { get; init; } = "";

    /// <summary>The folder it is in (a folder: its parent); null at the top of an area.</summary>
    public long? FolderId { get; init; }

    public long? SpaceId { get; init; }

    public DateTime CreateDate { get; init; }

    public DateTime UpdateDate { get; init; }

    public long? CreateUserId { get; init; }

    public string? ThumbHash { get; init; }

    /// <summary>The key of an image.</summary>
    public string Key { get; init; } = "";

    public long SizeBytes { get; init; }

    public double Width { get; init; }

    public double Height { get; init; }

    public string Unit { get; init; } = "";

    public int RowCount { get; init; }

    public string? Color { get; init; }

    public DateTime? TrashedDate { get; init; }

    public bool IsTemplate { get; init; }

    public bool Starred { get; init; }

    public DateTime? Opened { get; init; }

    public string? Owner { get; set; }

    public string? SpaceName { get; set; }

    public string? ThumbUrl => ThumbHash is null ? null : Kind switch
    {
        ItemKind.Design => $"/designs/{Id}/thumbnail.png?v={ThumbHash[..Math.Min(12, ThumbHash.Length)]}",
        ItemKind.Asset => AssetLogic.Url(Key, ThumbHash),
        _ => null,
    };

    /// <summary>The second line of a tile: the size of a design, the rows of a list, the pixels of an image.</summary>
    public string Detail => Kind switch
    {
        ItemKind.Design => $"{Services.Fmt.Number((decimal)Width, Width % 1 == 0 ? 0 : 1)} × {Services.Fmt.Number((decimal)Height, Height % 1 == 0 ? 0 : 1)} {Unit}",
        ItemKind.DataList => RowCount == 1 ? "1 Zeile" : $"{Services.Fmt.Integer(RowCount)} Zeilen",
        ItemKind.Asset => Width > 0 ? $"{Width:0} × {Height:0} px" : Services.Fmt.FileSize(SizeBytes),
        _ => "",
    };
}

/// <summary>Where a list of items comes from.</summary>
public enum ItemScope
{
    /// <summary>What lies in a folder or at the top of an area (or, with <see cref="ItemQuery.Recursive"/> or without area and folder, everything the person may see).</summary>
    Space,

    /// <summary>What was shared with the person (a share to them or their team, or a link they opened), not what they have through the membership of an area.</summary>
    Shared,

    /// <summary>What the person opened or changed lately, newest first.</summary>
    Recent,

    /// <summary>What the person marked with a star.</summary>
    Starred,

    /// <summary>What was deleted from the areas the person manages.</summary>
    Trash,
}

/// <summary>What the browser asks for: a scope, an area or folder, the kinds, a search text, a sort and a page.</summary>
public sealed record ItemQuery
{
    public ItemScope Scope { get; init; } = ItemScope.Space;

    public long? SpaceId { get; init; }

    public long? FolderId { get; init; }

    /// <summary>Look into all folders of the area (a search), not only at the one that is open.</summary>
    public bool Recursive { get; init; }

    public IReadOnlyCollection<ItemKind>? Kinds { get; init; }

    public string? Q { get; init; }

    /// <summary>"updated" (default), "name" or "created".</summary>
    public string Sort { get; init; } = "updated";

    public bool Desc { get; init; } = true;

    public bool FoldersFirst { get; init; } = true;

    public int Skip { get; init; }

    public int Take { get; init; } = 60;
}

public sealed record ItemPage(IReadOnlyList<ItemRow> Items, int Total);

/// <summary>
/// What the browser does with items of every kind (docs/PLAN-PLATFORM.md section 1.2 to 1.4): the cross-kind query with filter, sort and paging, move, copy, trash (a folder takes its content with
/// it and brings it back), restore, delete for good, stars and the list of what was opened lately. Everything goes through <see cref="Access"/>: a list only holds what the person may see,
/// a change needs Manage on what it touches (and Edit on the place it goes to).
/// </summary>
public static class ItemLogic
{
    public const int MaxPage = 200;

    // ------------------------------------------------------------------------------------------------ the query

    private static IQueryable<ItemRow> Branch(Biz biz, ItemKind kind, ItemScope scope)
    {
        var db = biz.Db;
        var uid = biz.UserId;
        switch (kind)
        {
            case ItemKind.Folder:
                return Source<Folder>(biz, scope).AsNoTracking().Select(x => new ItemRow
                {
                    Kind = ItemKind.Folder, Id = x.Id, Name = x.Name, FolderId = x.ParentId, SpaceId = x.SpaceId, CreateDate = x.CreateDate, UpdateDate = x.UpdateDate, CreateUserId = x.CreateUserId,
                    ThumbHash = null, Key = "", SizeBytes = 0, Width = 0, Height = 0, Unit = "", RowCount = 0, Color = x.Color, TrashedDate = x.TrashedDate, IsTemplate = false,
                    Starred = db.Star.Any(s => s.UserId == uid && s.ItemKind == ItemKind.Folder && s.ItemId == x.Id),
                    Opened = db.ItemVisit.Where(v => v.UserId == uid && v.ItemKind == ItemKind.Folder && v.ItemId == x.Id).Select(v => (DateTime?)v.LastOpenedDate).FirstOrDefault(),
                });
            case ItemKind.Design:
                return Source<Design>(biz, scope).AsNoTracking().Select(x => new ItemRow
                {
                    Kind = ItemKind.Design, Id = x.Id, Name = x.Name, FolderId = x.FolderId, SpaceId = x.SpaceId, CreateDate = x.CreateDate, UpdateDate = x.UpdateDate, CreateUserId = x.CreateUserId,
                    ThumbHash = x.ThumbnailHash, Key = "", SizeBytes = 0, Width = x.Width, Height = x.Height, Unit = x.Unit, RowCount = 0, Color = null, TrashedDate = x.TrashedDate, IsTemplate = x.IsTemplate,
                    Starred = db.Star.Any(s => s.UserId == uid && s.ItemKind == ItemKind.Design && s.ItemId == x.Id),
                    Opened = db.ItemVisit.Where(v => v.UserId == uid && v.ItemKind == ItemKind.Design && v.ItemId == x.Id).Select(v => (DateTime?)v.LastOpenedDate).FirstOrDefault(),
                });
            case ItemKind.DataList:
                return Source<DataList>(biz, scope).AsNoTracking().Select(x => new ItemRow
                {
                    Kind = ItemKind.DataList, Id = x.Id, Name = x.Name, FolderId = x.FolderId, SpaceId = x.SpaceId, CreateDate = x.CreateDate, UpdateDate = x.UpdateDate, CreateUserId = x.CreateUserId,
                    ThumbHash = null, Key = "", SizeBytes = 0, Width = 0, Height = 0, Unit = "", RowCount = x.Rows.Count, Color = null, TrashedDate = x.TrashedDate, IsTemplate = false,
                    Starred = db.Star.Any(s => s.UserId == uid && s.ItemKind == ItemKind.DataList && s.ItemId == x.Id),
                    Opened = db.ItemVisit.Where(v => v.UserId == uid && v.ItemKind == ItemKind.DataList && v.ItemId == x.Id).Select(v => (DateTime?)v.LastOpenedDate).FirstOrDefault(),
                });
            case ItemKind.OutputJob:
                return Source<OutputJob>(biz, scope).AsNoTracking().Select(x => new ItemRow
                {
                    Kind = ItemKind.OutputJob, Id = x.Id, Name = x.Name, FolderId = x.FolderId, SpaceId = x.SpaceId, CreateDate = x.CreateDate, UpdateDate = x.UpdateDate, CreateUserId = x.CreateUserId,
                    ThumbHash = null, Key = "", SizeBytes = 0, Width = 0, Height = 0, Unit = "", RowCount = 0, Color = null, TrashedDate = x.TrashedDate, IsTemplate = false,
                    Starred = db.Star.Any(s => s.UserId == uid && s.ItemKind == ItemKind.OutputJob && s.ItemId == x.Id),
                    Opened = db.ItemVisit.Where(v => v.UserId == uid && v.ItemKind == ItemKind.OutputJob && v.ItemId == x.Id).Select(v => (DateTime?)v.LastOpenedDate).FirstOrDefault(),
                });
            default:
                return Source<Asset>(biz, scope).AsNoTracking().Select(x => new ItemRow
                {
                    Kind = ItemKind.Asset, Id = x.Id, Name = x.Name, FolderId = x.FolderId, SpaceId = x.SpaceId, CreateDate = x.CreateDate, UpdateDate = x.UpdateDate, CreateUserId = x.CreateUserId,
                    ThumbHash = x.ContentHash, Key = x.Key, SizeBytes = x.SizeBytes, Width = x.Width ?? 0, Height = x.Height ?? 0, Unit = "px", RowCount = 0, Color = null, TrashedDate = x.TrashedDate, IsTemplate = false,
                    Starred = db.Star.Any(s => s.UserId == uid && s.ItemKind == ItemKind.Asset && s.ItemId == x.Id),
                    Opened = db.ItemVisit.Where(v => v.UserId == uid && v.ItemKind == ItemKind.Asset && v.ItemId == x.Id).Select(v => (DateTime?)v.LastOpenedDate).FirstOrDefault(),
                });
        }
    }

    private static IQueryable<T> Source<T>(Biz biz, ItemScope scope) where T : class => scope switch
    {
        ItemScope.Trash => Access.VisibleTrashed<T>(biz),
        ItemScope.Shared => Access.SharedWithMe<T>(biz),
        _ => Access.Visible<T>(biz),
    };

    /// <summary>The page of items the query asks for: only what the person may see, folders first when asked, one SQL statement for all kinds.</summary>
    public static async Task<ItemPage> QueryAsync(Biz biz, ItemQuery query)
    {
        biz.RequireSignedIn();
        var kinds = (query.Kinds is { Count: > 0 } ? query.Kinds : [ItemKind.Folder, ItemKind.Design, ItemKind.DataList, ItemKind.OutputJob, ItemKind.Asset]).Distinct().ToList();
        if (query.Scope == ItemScope.Shared)
        {
            kinds.Remove(ItemKind.Asset);
        }

        if (kinds.Count == 0)
        {
            return new ItemPage([], 0);
        }

        IQueryable<ItemRow>? all = null;
        foreach (var kind in kinds)
        {
            var branch = Branch(biz, kind, query.Scope);
            all = all is null ? branch : all.Concat(branch);
        }

        var rows = all!;
        if (query.SpaceId is { } space)
        {
            rows = rows.Where(r => r.SpaceId == space);
        }

        if (query.Scope == ItemScope.Space)
        {
            if (query.FolderId is { } folder)
            {
                rows = rows.Where(r => r.FolderId == folder);
            }
            else if (query.SpaceId is not null && !query.Recursive)
            {
                rows = rows.Where(r => r.FolderId == null);
            }
        }

        if (query.Scope == ItemScope.Starred)
        {
            rows = rows.Where(r => r.Starred);
        }

        if (query.Scope == ItemScope.Recent)
        {
            rows = rows.Where(r => r.Opened != null);
        }

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var like = Services.Like.Contains(query.Q.Trim()[..Math.Min(query.Q.Trim().Length, 100)]);
            rows = rows.Where(r => EF.Functions.ILike(r.Name, like, "\\"));
        }

        var total = await rows.CountAsync();
        IOrderedQueryable<ItemRow> ordered;
        var desc = query.Desc;
        if (query.Scope == ItemScope.Recent)
        {
            ordered = rows.OrderByDescending(r => r.Opened);
        }
        else if (query.FoldersFirst)
        {
            var first = rows.OrderBy(r => r.Kind == ItemKind.Folder ? 0 : 1);
            ordered = query.Sort switch
            {
                "name" => desc ? first.ThenByDescending(r => r.Name) : first.ThenBy(r => r.Name),
                "created" => desc ? first.ThenByDescending(r => r.CreateDate) : first.ThenBy(r => r.CreateDate),
                _ => desc ? first.ThenByDescending(r => r.UpdateDate) : first.ThenBy(r => r.UpdateDate),
            };
        }
        else
        {
            ordered = query.Sort switch
            {
                "name" => desc ? rows.OrderByDescending(r => r.Name) : rows.OrderBy(r => r.Name),
                "created" => desc ? rows.OrderByDescending(r => r.CreateDate) : rows.OrderBy(r => r.CreateDate),
                _ => desc ? rows.OrderByDescending(r => r.UpdateDate) : rows.OrderBy(r => r.UpdateDate),
            };
        }

        var page = await ordered.ThenBy(r => r.Kind).ThenBy(r => r.Id).Skip(Math.Max(0, query.Skip)).Take(Math.Clamp(query.Take, 1, MaxPage)).ToListAsync();
        await FillNamesAsync(biz, page);
        return new ItemPage(page, total);
    }

    private static async Task FillNamesAsync(Biz biz, List<ItemRow> rows)
    {
        if (rows.Count == 0)
        {
            return;
        }

        var userIds = rows.Where(r => r.CreateUserId is not null).Select(r => r.CreateUserId!.Value).Distinct().ToList();
        var users = await biz.Db.User.AsNoTracking().Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.DisplayName);
        var spaceIds = rows.Where(r => r.SpaceId is not null).Select(r => r.SpaceId!.Value).Distinct().ToList();
        var spaces = await biz.Db.Space.AsNoTracking().Where(s => spaceIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id, s => s.Kind == SpaceKind.Personal ? SpaceLogic.PersonalName : s.Name);
        foreach (var row in rows)
        {
            row.Owner = row.CreateUserId is { } uid && users.TryGetValue(uid, out var name) ? name : null;
            row.SpaceName = row.SpaceId is { } sid && spaces.TryGetValue(sid, out var space) ? space : null;
        }
    }

    /// <summary>What the person opened or changed lately, newest first (the start page, the filter "Zuletzt verwendet").</summary>
    public static async Task<List<ItemRow>> RecentAsync(Biz biz, int take, IReadOnlyCollection<ItemKind>? kinds = null)
        => [.. (await QueryAsync(biz, new ItemQuery { Scope = ItemScope.Recent, Take = take, Kinds = kinds ?? [ItemKind.Design, ItemKind.DataList, ItemKind.OutputJob] })).Items];

    // ------------------------------------------------------------------------------------------------ stars and visits

    /// <summary>Marks an item with a star (or takes it away). The person must be allowed to view it.</summary>
    public static async Task StarAsync(Biz biz, ItemKind kind, long id, bool on)
    {
        await Access.RequireAsync(biz, kind, id, AccessLevel.View);
        var uid = biz.UserId;
        var existing = await biz.Db.Star.FirstOrDefaultAsync(s => s.UserId == uid && s.ItemKind == kind && s.ItemId == id);
        if (on && existing is null)
        {
            biz.Db.Star.Add(new Star { UserId = uid, ItemKind = kind, ItemId = id });
            await SaveIgnoringDuplicateAsync(biz.Db);
        }
        else if (!on && existing is not null)
        {
            biz.Db.Star.Remove(existing);
            await biz.Db.SaveChangesAsync();
        }
    }

    private static async Task SaveIgnoringDuplicateAsync(DtDbContext db)
    {
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // the same star arrived twice at once: one is enough
            foreach (var entry in db.ChangeTracker.Entries().Where(e => e.State == EntityState.Added).ToList())
            {
                entry.State = EntityState.Detached;
            }
        }
    }

    /// <summary>Notes that the person opened or changed an item ("Zuletzt verwendet"). Nothing happens without a signed-in person; the caller has checked the access.</summary>
    public static async Task VisitAsync(Biz biz, ItemKind kind, long id)
    {
        if (biz.User.UserId is not { } uid)
        {
            return;
        }

        var now = biz.Now;
        var changed = await biz.Db.ItemVisit.Where(v => v.UserId == uid && v.ItemKind == kind && v.ItemId == id).ExecuteUpdateAsync(s => s.SetProperty(v => v.LastOpenedDate, now));
        if (changed > 0)
        {
            return;
        }

        var visit = new ItemVisit { UserId = uid, ItemKind = kind, ItemId = id, LastOpenedDate = now };
        biz.Db.ItemVisit.Add(visit);
        try
        {
            await biz.Db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // another request noted the same visit first
            biz.Db.Entry(visit).State = EntityState.Detached;
            await biz.Db.ItemVisit.Where(v => v.UserId == uid && v.ItemKind == kind && v.ItemId == id).ExecuteUpdateAsync(s => s.SetProperty(v => v.LastOpenedDate, now));
        }
    }

    // ------------------------------------------------------------------------------------------------ move and copy

    private static IEnumerable<ItemRef> Distinct(IEnumerable<ItemRef> items) => items.Distinct();

    /// <summary>
    /// Moves items to a folder (the person needs Edit on it) or to the top of an area (they must be allowed to write there). Every item needs Manage. Moving to another area takes images and
    /// folders along; the shares of an item stay.
    /// </summary>
    public static async Task<int> MoveAsync(Biz biz, IEnumerable<ItemRef> items, long? targetSpaceId, long? targetFolderId)
    {
        biz.RequireSignedIn();
        var list = Distinct(items).ToList();
        var (space, folder) = await Access.PlacementAsync(biz, targetSpaceId, targetFolderId);
        foreach (var item in list)
        {
            await Access.RequireAsync(biz, item.Kind, item.Id, AccessLevel.Manage);
        }

        var moved = 0;
        foreach (var item in list)
        {
            if (item.Kind == ItemKind.Folder)
            {
                await FolderLogic.MoveCoreAsync(biz.Db, item.Id, space, folder);
                moved++;
                continue;
            }

            var (oldSpace, _) = await Access.RawPlaceAsync(biz.Db, item.Kind, item.Id);
            if (item.Kind == ItemKind.Asset && oldSpace != space)
            {
                var size = await biz.Db.Asset.Where(a => a.Id == item.Id).Select(a => a.SizeBytes).FirstAsync();
                await StorageLogic.RequireRoomAsync(biz, space, size);
            }

            var changed = item.Kind switch
            {
                ItemKind.Design => await biz.Db.Design.Where(d => d.Id == item.Id).ExecuteUpdateAsync(s => s.SetProperty(d => d.SpaceId, space).SetProperty(d => d.FolderId, folder)),
                ItemKind.DataList => await biz.Db.DataList.Where(d => d.Id == item.Id).ExecuteUpdateAsync(s => s.SetProperty(d => d.SpaceId, space).SetProperty(d => d.FolderId, folder)),
                ItemKind.OutputJob => await biz.Db.OutputJob.Where(d => d.Id == item.Id).ExecuteUpdateAsync(s => s.SetProperty(d => d.SpaceId, space).SetProperty(d => d.FolderId, folder)),
                _ => await biz.Db.Asset.Where(d => d.Id == item.Id).ExecuteUpdateAsync(s => s.SetProperty(d => d.SpaceId, space).SetProperty(d => d.FolderId, folder)),
            };
            moved += changed;
        }

        await biz.Log.LogAsync("Elemente verschoben", nameof(Folder), folder, $"{moved} Element(e)");
        return moved;
    }

    private const int MaxCopyItems = 500;

    /// <summary>
    /// Copies items (viewing them is enough) into a folder (Edit on it) or to the top of an area (the person must be allowed to write there; by default the personal area). A design, data list,
    /// output job or image becomes a new one with " (Kopie)" in its name; a folder is copied with everything in it (up to 500 items). Returns the new items.
    /// </summary>
    public static async Task<List<ItemRef>> CopyAsync(Biz biz, IEnumerable<ItemRef> items, long? targetSpaceId, long? targetFolderId)
    {
        biz.RequireSignedIn();
        var (space, folder) = await Access.PlacementAsync(biz, targetSpaceId, targetFolderId);
        var created = new List<ItemRef>();
        foreach (var item in Distinct(items))
        {
            await Access.RequireAsync(biz, item.Kind, item.Id, AccessLevel.View);
            await CopyOneAsync(biz, item, space, folder, created, topLevel: true);
        }

        await biz.Log.LogAsync("Elemente kopiert", nameof(Folder), folder, $"{created.Count} Element(e)");
        return created;
    }

    private static async Task CopyOneAsync(Biz biz, ItemRef item, long space, long? folder, List<ItemRef> created, bool topLevel)
    {
        if (created.Count >= MaxCopyItems)
        {
            throw new BizException($"Das sind mehr als {MaxCopyItems} Elemente auf einmal. Kopiere sie in kleineren Teilen.");
        }

        var db = biz.Db;
        switch (item.Kind)
        {
            case ItemKind.Design:
            {
                var copy = await DesignLogic.DuplicateToAsync(biz, item.Id, space, folder, topLevel);
                created.Add(new ItemRef(ItemKind.Design, copy.Id));
                break;
            }

            case ItemKind.DataList:
            {
                var copy = await DataListLogic.DuplicateToAsync(biz, item.Id, space, folder, topLevel);
                created.Add(new ItemRef(ItemKind.DataList, copy.Id));
                break;
            }

            case ItemKind.OutputJob:
            {
                var source = await db.OutputJob.AsNoTracking().FirstOrDefaultAsync(j => j.Id == item.Id) ?? throw new NotFoundException();
                var copy = new OutputJob
                {
                    Name = Clip(topLevel ? source.Name + " (Kopie)" : source.Name, 200),
                    DesignId = source.DesignId,
                    DataListId = source.DataListId,
                    RowSelection = source.RowSelection,
                    SelectedRowIdsJson = source.SelectedRowIdsJson,
                    Copies = source.Copies,
                    Mode = source.Mode,
                    SheetLayoutId = source.SheetLayoutId,
                    Format = source.Format,
                    Dpi = source.Dpi,
                    CropMarks = source.CropMarks,
                    Scale = source.Scale,
                    StartPosition = source.StartPosition,
                    FileNamePattern = source.FileNamePattern,
                    SpaceId = space,
                    FolderId = folder,
                };
                db.OutputJob.Add(copy);
                await db.SaveChangesAsync();
                created.Add(new ItemRef(ItemKind.OutputJob, copy.Id));
                break;
            }

            case ItemKind.Asset:
            {
                var source = await db.Asset.AsNoTracking().FirstOrDefaultAsync(a => a.Id == item.Id) ?? throw new NotFoundException();
                await StorageLogic.RequireRoomAsync(biz, space, source.SizeBytes);
                var copy = new Asset
                {
                    Key = await AssetLogic.FreeKeyAsync(db, source.Key.Length > 56 ? source.Key[..56] : source.Key),
                    Name = Clip(topLevel ? source.Name + " (Kopie)" : source.Name, 200),
                    Category = source.Category,
                    Tags = source.Tags,
                    ContentType = source.ContentType,
                    Extension = source.Extension,
                    Width = source.Width,
                    Height = source.Height,
                    Bytes = source.Bytes,
                    ContentHash = source.ContentHash,
                    SizeBytes = source.SizeBytes,
                    SpaceId = space,
                    FolderId = folder,
                };
                db.Asset.Add(copy);
                await db.SaveChangesAsync();
                created.Add(new ItemRef(ItemKind.Asset, copy.Id));
                break;
            }

            default:
            {
                var source = await db.Folder.AsNoTracking().FirstOrDefaultAsync(f => f.Id == item.Id) ?? throw new NotFoundException();
                var parentPath = folder is { } parent ? await db.Folder.AsNoTracking().Where(f => f.Id == parent).Select(f => f.Path).FirstAsync() : "/";
                if (parentPath.Split('/', StringSplitOptions.RemoveEmptyEntries).Length >= FolderLogic.MaxDepth)
                {
                    throw new BizException($"Ordner lassen sich nur {FolderLogic.MaxDepth} Ebenen tief verschachteln.");
                }

                var copy = new Folder { SpaceId = space, ParentId = folder, Name = Clip(topLevel ? source.Name + " (Kopie)" : source.Name, FolderLogic.MaxNameLength), Color = source.Color, Path = "/" };
                db.Folder.Add(copy);
                await db.SaveChangesAsync();
                copy.Path = parentPath + copy.Id + "/";
                await db.SaveChangesAsync();
                created.Add(new ItemRef(ItemKind.Folder, copy.Id));

                // everything inside that the person may view
                foreach (var child in await db.Folder.AsNoTracking().Where(f => f.ParentId == item.Id && f.TrashedDate == null).Select(f => f.Id).ToListAsync())
                {
                    if (await Access.LevelAsync(biz, ItemKind.Folder, child) >= AccessLevel.View)
                    {
                        await CopyOneAsync(biz, new ItemRef(ItemKind.Folder, child), space, copy.Id, created, false);
                    }
                }

                foreach (var (kind, ids) in new[]
                {
                    (ItemKind.Design, await Access.Visible<Design>(biz).Where(d => d.FolderId == item.Id).Select(d => d.Id).ToListAsync()),
                    (ItemKind.DataList, await Access.Visible<DataList>(biz).Where(d => d.FolderId == item.Id).Select(d => d.Id).ToListAsync()),
                    (ItemKind.OutputJob, await Access.Visible<OutputJob>(biz).Where(d => d.FolderId == item.Id).Select(d => d.Id).ToListAsync()),
                    (ItemKind.Asset, await Access.Visible<Asset>(biz).Where(d => d.FolderId == item.Id).Select(d => d.Id).ToListAsync()),
                })
                {
                    foreach (var id in ids)
                    {
                        await CopyOneAsync(biz, new ItemRef(kind, id), space, copy.Id, created, false);
                    }
                }

                break;
            }
        }
    }

    private static string Clip(string text, int max) => text.Length > max ? text[..max] : text;

    // ------------------------------------------------------------------------------------------------ trash

    /// <summary>
    /// Puts items into the trash (every item needs Manage). A folder takes everything inside with it: restoring the folder brings that content back, whatever was in the trash before stays
    /// where it was. The trash is emptied by itself after the days the platform settings say (<see cref="TrashPurger"/>).
    /// </summary>
    public static async Task TrashAsync(Biz biz, IEnumerable<ItemRef> items)
    {
        biz.RequireSignedIn();
        var list = Distinct(items).ToList();
        foreach (var item in list)
        {
            await Access.RequireAsync(biz, item.Kind, item.Id, AccessLevel.Manage);
        }

        var db = biz.Db;
        var now = biz.Now;
        foreach (var item in list)
        {
            switch (item.Kind)
            {
                case ItemKind.Folder:
                    var path = await db.Folder.AsNoTracking().Where(f => f.Id == item.Id).Select(f => f.Path).FirstOrDefaultAsync();
                    if (path is null)
                    {
                        continue;
                    }

                    var root = item.Id;
                    await db.Folder.Where(f => f.Path.StartsWith(path) && f.TrashedDate == null).ExecuteUpdateAsync(s => s.SetProperty(f => f.TrashedDate, now).SetProperty(f => f.TrashedWithFolderId, f => f.Id == root ? (long?)null : (long?)root));
                    var inside = db.Folder.Where(f => f.Path.StartsWith(path)).Select(f => f.Id);
                    await db.Design.Where(d => d.TrashedDate == null && d.FolderId != null && inside.Contains(d.FolderId.Value)).ExecuteUpdateAsync(s => s.SetProperty(d => d.TrashedDate, now).SetProperty(d => d.TrashedWithFolderId, root));
                    await db.DataList.Where(d => d.TrashedDate == null && d.FolderId != null && inside.Contains(d.FolderId.Value)).ExecuteUpdateAsync(s => s.SetProperty(d => d.TrashedDate, now).SetProperty(d => d.TrashedWithFolderId, root));
                    await db.OutputJob.Where(d => d.TrashedDate == null && d.FolderId != null && inside.Contains(d.FolderId.Value)).ExecuteUpdateAsync(s => s.SetProperty(d => d.TrashedDate, now).SetProperty(d => d.TrashedWithFolderId, root));
                    await db.Asset.Where(d => d.TrashedDate == null && d.FolderId != null && inside.Contains(d.FolderId.Value)).ExecuteUpdateAsync(s => s.SetProperty(d => d.TrashedDate, now).SetProperty(d => d.TrashedWithFolderId, root));
                    break;
                case ItemKind.Design:
                    await db.Design.Where(d => d.Id == item.Id && d.TrashedDate == null).ExecuteUpdateAsync(s => s.SetProperty(d => d.TrashedDate, now).SetProperty(d => d.TrashedWithFolderId, (long?)null));
                    break;
                case ItemKind.DataList:
                    await db.DataList.Where(d => d.Id == item.Id && d.TrashedDate == null).ExecuteUpdateAsync(s => s.SetProperty(d => d.TrashedDate, now).SetProperty(d => d.TrashedWithFolderId, (long?)null));
                    break;
                case ItemKind.OutputJob:
                    await db.OutputJob.Where(d => d.Id == item.Id && d.TrashedDate == null).ExecuteUpdateAsync(s => s.SetProperty(d => d.TrashedDate, now).SetProperty(d => d.TrashedWithFolderId, (long?)null));
                    break;
                default:
                    await db.Asset.Where(d => d.Id == item.Id && d.TrashedDate == null).ExecuteUpdateAsync(s => s.SetProperty(d => d.TrashedDate, now).SetProperty(d => d.TrashedWithFolderId, (long?)null));
                    break;
            }
        }

        await biz.Log.LogAsync("In den Papierkorb gelegt", nameof(Folder), null, $"{list.Count} Element(e)");
    }

    private static async Task RequireInTrashAsync(Biz biz, ItemRef item)
    {
        var exists = item.Kind switch
        {
            ItemKind.Folder => await Access.VisibleTrashed<Folder>(biz).AnyAsync(x => x.Id == item.Id),
            ItemKind.Design => await Access.VisibleTrashed<Design>(biz).AnyAsync(x => x.Id == item.Id),
            ItemKind.DataList => await Access.VisibleTrashed<DataList>(biz).AnyAsync(x => x.Id == item.Id),
            ItemKind.OutputJob => await Access.VisibleTrashed<OutputJob>(biz).AnyAsync(x => x.Id == item.Id),
            _ => await Access.VisibleTrashed<Asset>(biz).AnyAsync(x => x.Id == item.Id),
        };
        if (!exists)
        {
            throw new NotFoundException();
        }
    }

    /// <summary>
    /// Brings items back from the trash (the people who manage them). A folder brings back what went into the trash with it. What lay in a folder that is still in the trash (or gone) goes
    /// to the top of its area.
    /// </summary>
    public static async Task RestoreAsync(Biz biz, IEnumerable<ItemRef> items)
    {
        biz.RequireSignedIn();
        var list = Distinct(items).ToList();
        foreach (var item in list)
        {
            await RequireInTrashAsync(biz, item);
        }

        var db = biz.Db;
        foreach (var item in list)
        {
            switch (item.Kind)
            {
                case ItemKind.Folder:
                    var folder = await db.Folder.FirstAsync(f => f.Id == item.Id);
                    if (folder.ParentId is { } parent && !await db.Folder.AnyAsync(f => f.Id == parent && f.TrashedDate == null))
                    {
                        await FolderLogic.MoveCoreAsync(db, folder.Id, folder.SpaceId, null);
                    }

                    var id = item.Id;
                    await db.Folder.Where(f => f.Id == id || f.TrashedWithFolderId == id).ExecuteUpdateAsync(s => s.SetProperty(f => f.TrashedDate, (DateTime?)null).SetProperty(f => f.TrashedWithFolderId, (long?)null));
                    await db.Design.Where(d => d.TrashedWithFolderId == id).ExecuteUpdateAsync(s => s.SetProperty(d => d.TrashedDate, (DateTime?)null).SetProperty(d => d.TrashedWithFolderId, (long?)null));
                    await db.DataList.Where(d => d.TrashedWithFolderId == id).ExecuteUpdateAsync(s => s.SetProperty(d => d.TrashedDate, (DateTime?)null).SetProperty(d => d.TrashedWithFolderId, (long?)null));
                    await db.OutputJob.Where(d => d.TrashedWithFolderId == id).ExecuteUpdateAsync(s => s.SetProperty(d => d.TrashedDate, (DateTime?)null).SetProperty(d => d.TrashedWithFolderId, (long?)null));
                    await db.Asset.Where(d => d.TrashedWithFolderId == id).ExecuteUpdateAsync(s => s.SetProperty(d => d.TrashedDate, (DateTime?)null).SetProperty(d => d.TrashedWithFolderId, (long?)null));
                    break;
                case ItemKind.Design:
                    await db.Design.Where(d => d.Id == item.Id).ExecuteUpdateAsync(s => s.SetProperty(d => d.TrashedDate, (DateTime?)null).SetProperty(d => d.TrashedWithFolderId, (long?)null));
                    await db.Design.Where(d => d.Id == item.Id && d.FolderId != null && !db.Folder.Any(f => f.Id == d.FolderId && f.TrashedDate == null)).ExecuteUpdateAsync(s => s.SetProperty(d => d.FolderId, (long?)null));
                    break;
                case ItemKind.DataList:
                    await db.DataList.Where(d => d.Id == item.Id).ExecuteUpdateAsync(s => s.SetProperty(d => d.TrashedDate, (DateTime?)null).SetProperty(d => d.TrashedWithFolderId, (long?)null));
                    await db.DataList.Where(d => d.Id == item.Id && d.FolderId != null && !db.Folder.Any(f => f.Id == d.FolderId && f.TrashedDate == null)).ExecuteUpdateAsync(s => s.SetProperty(d => d.FolderId, (long?)null));
                    break;
                case ItemKind.OutputJob:
                    await db.OutputJob.Where(d => d.Id == item.Id).ExecuteUpdateAsync(s => s.SetProperty(d => d.TrashedDate, (DateTime?)null).SetProperty(d => d.TrashedWithFolderId, (long?)null));
                    await db.OutputJob.Where(d => d.Id == item.Id && d.FolderId != null && !db.Folder.Any(f => f.Id == d.FolderId && f.TrashedDate == null)).ExecuteUpdateAsync(s => s.SetProperty(d => d.FolderId, (long?)null));
                    break;
                default:
                    await db.Asset.Where(d => d.Id == item.Id).ExecuteUpdateAsync(s => s.SetProperty(d => d.TrashedDate, (DateTime?)null).SetProperty(d => d.TrashedWithFolderId, (long?)null));
                    await db.Asset.Where(d => d.Id == item.Id && d.FolderId != null && !db.Folder.Any(f => f.Id == d.FolderId && f.TrashedDate == null)).ExecuteUpdateAsync(s => s.SetProperty(d => d.FolderId, (long?)null));
                    break;
            }
        }

        await biz.Log.LogAsync("Aus dem Papierkorb geholt", nameof(Folder), null, $"{list.Count} Element(e)");
    }

    /// <summary>Deletes items in the trash for good (the people who manage them): data and bytes are let go, shares, links, stars and references end with them. A folder takes its content along.</summary>
    public static async Task PurgeAsync(Biz biz, IEnumerable<ItemRef> items)
    {
        biz.RequireSignedIn();
        var list = Distinct(items).ToList();
        foreach (var item in list)
        {
            await RequireInTrashAsync(biz, item);
        }

        var db = biz.Db;
        foreach (var item in list)
        {
            if (item.Kind == ItemKind.Folder)
            {
                var id = item.Id;
                await PurgeKindAsync(db, ItemKind.Design, await db.Design.Where(d => d.TrashedWithFolderId == id).Select(d => d.Id).ToListAsync());
                await PurgeKindAsync(db, ItemKind.DataList, await db.DataList.Where(d => d.TrashedWithFolderId == id).Select(d => d.Id).ToListAsync());
                await PurgeKindAsync(db, ItemKind.OutputJob, await db.OutputJob.Where(d => d.TrashedWithFolderId == id).Select(d => d.Id).ToListAsync());
                await PurgeKindAsync(db, ItemKind.Asset, await db.Asset.Where(d => d.TrashedWithFolderId == id).Select(d => d.Id).ToListAsync());
                await PurgeKindAsync(db, ItemKind.Folder, await db.Folder.Where(f => f.Id == id || f.TrashedWithFolderId == id).Select(f => f.Id).ToListAsync());
            }
            else
            {
                await PurgeKindAsync(db, item.Kind, [item.Id]);
            }
        }

        await biz.Log.LogAsync("Endgültig gelöscht", nameof(Folder), null, $"{list.Count} Element(e)");
    }

    /// <summary>Deletes everything in the trash of an area for good (the people who manage it).</summary>
    public static async Task<int> EmptyTrashAsync(Biz biz, long? spaceId)
    {
        biz.RequireSignedIn();
        var all = (await QueryAsync(biz, new ItemQuery { Scope = ItemScope.Trash, SpaceId = spaceId, Take = MaxPage, FoldersFirst = false })).Items;
        if (all.Count == 0)
        {
            return 0;
        }

        await PurgeAsync(biz, all.Select(r => new ItemRef(r.Kind, r.Id)));
        return all.Count;
    }

    /// <summary>The delete for good itself, without a check of the person (the trash purger and the checks above call it): soft-deletes the records, lets go of the bytes and the rows.</summary>
    internal static async Task PurgeKindAsync(DtDbContext db, ItemKind kind, IReadOnlyCollection<long> ids)
    {
        if (ids.Count == 0)
        {
            return;
        }

        var list = ids.ToList();
        switch (kind)
        {
            case ItemKind.Design:
                await db.DesignRevision.Where(r => list.Contains(r.DesignId)).ExecuteDeleteAsync();
                await db.Comment.Where(c => list.Contains(c.DesignId)).ExecuteDeleteAsync();
                await db.Design.Where(d => list.Contains(d.Id)).ExecuteUpdateAsync(s => s.SetProperty(d => d.ThumbnailPng, (byte[]?)null).SetProperty(d => d.ThumbnailHash, (string?)null).SetProperty(d => d.UpdateState, UpdateState.Deleted));
                break;
            case ItemKind.DataList:
                await db.DataRow.Where(r => list.Contains(r.DataListId)).ExecuteDeleteAsync();
                await db.DataList.Where(d => list.Contains(d.Id)).ExecuteUpdateAsync(s => s.SetProperty(d => d.UpdateState, UpdateState.Deleted));
                break;
            case ItemKind.OutputJob:
                await db.OutputJob.Where(d => list.Contains(d.Id)).ExecuteUpdateAsync(s => s.SetProperty(d => d.UpdateState, UpdateState.Deleted));
                break;
            case ItemKind.Asset:
                await db.Asset.Where(d => list.Contains(d.Id)).ExecuteUpdateAsync(s => s.SetProperty(d => d.Bytes, new byte[0]).SetProperty(d => d.SizeBytes, 0L).SetProperty(d => d.UpdateState, UpdateState.Deleted));
                break;
            default:
                await db.Folder.Where(d => list.Contains(d.Id)).ExecuteUpdateAsync(s => s.SetProperty(d => d.UpdateState, UpdateState.Deleted));
                break;
        }

        await db.Share.Where(s => s.ItemKind == kind && list.Contains(s.ItemId)).ExecuteDeleteAsync();
        await db.ShareLink.Where(l => l.ItemKind == kind && list.Contains(l.ItemId)).ExecuteDeleteAsync();
        await db.AccessRequest.Where(a => a.ItemKind == kind && list.Contains(a.ItemId)).ExecuteDeleteAsync();
        await db.Star.Where(s => s.ItemKind == kind && list.Contains(s.ItemId)).ExecuteDeleteAsync();
        await db.ItemVisit.Where(v => v.ItemKind == kind && list.Contains(v.ItemId)).ExecuteDeleteAsync();
        if (kind is ItemKind.Design or ItemKind.DataList)
        {
            await db.ItemAssetRef.Where(r => r.ItemKind == kind && list.Contains(r.ItemId)).ExecuteDeleteAsync();
        }
    }

    /// <summary>Puts everything of an area into the trash (the team is deleted): folders, designs, lists, jobs and images that are not there yet.</summary>
    internal static async Task TrashSpaceContentAsync(DtDbContext db, long spaceId, DateTime now)
    {
        await db.Folder.Where(f => f.SpaceId == spaceId && f.TrashedDate == null).ExecuteUpdateAsync(s => s.SetProperty(f => f.TrashedDate, now));
        await db.Design.Where(d => d.SpaceId == spaceId && d.TrashedDate == null).ExecuteUpdateAsync(s => s.SetProperty(d => d.TrashedDate, now));
        await db.DataList.Where(d => d.SpaceId == spaceId && d.TrashedDate == null).ExecuteUpdateAsync(s => s.SetProperty(d => d.TrashedDate, now));
        await db.OutputJob.Where(d => d.SpaceId == spaceId && d.TrashedDate == null).ExecuteUpdateAsync(s => s.SetProperty(d => d.TrashedDate, now));
        await db.Asset.Where(d => d.SpaceId == spaceId && d.TrashedDate == null).ExecuteUpdateAsync(s => s.SetProperty(d => d.TrashedDate, now));
    }

    /// <summary>
    /// Deletes for good what has been in the trash since before <paramref name="olderThan"/>, in every area (nobody is acting: the trash purger calls it). Returns how many items went.
    /// </summary>
    public static async Task<int> PurgeOlderAsync(DtDbContext db, DateTime olderThan)
    {
        var count = 0;
        async Task Run(ItemKind kind, List<long> ids)
        {
            await PurgeKindAsync(db, kind, ids);
            count += ids.Count;
        }

        await Run(ItemKind.Design, await db.Design.Where(d => d.TrashedDate != null && d.TrashedDate < olderThan).Select(d => d.Id).ToListAsync());
        await Run(ItemKind.DataList, await db.DataList.Where(d => d.TrashedDate != null && d.TrashedDate < olderThan).Select(d => d.Id).ToListAsync());
        await Run(ItemKind.OutputJob, await db.OutputJob.Where(d => d.TrashedDate != null && d.TrashedDate < olderThan).Select(d => d.Id).ToListAsync());
        await Run(ItemKind.Asset, await db.Asset.Where(d => d.TrashedDate != null && d.TrashedDate < olderThan).Select(d => d.Id).ToListAsync());
        await Run(ItemKind.Folder, await db.Folder.Where(d => d.TrashedDate != null && d.TrashedDate < olderThan).Select(d => d.Id).ToListAsync());
        await db.ItemVisit.Where(v => v.LastOpenedDate < olderThan.AddDays(-60)).ExecuteDeleteAsync();
        return count;
    }
}
