using MatCan.Data;
using MatCan.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace MatCan.Logic;

/// <summary>A folder as the browser and the move dialog need it. <see cref="Depth"/> is 1 for a folder at the top of an area.</summary>
public sealed record FolderRow(long Id, long SpaceId, long? ParentId, string Name, string? Color, string Path, int Depth, DateTime UpdateDate);

/// <summary>The folders of one area the person may write in, for the move dialog: the area and all its folders (the browser builds the tree from <see cref="FolderRow.ParentId"/>).</summary>
public sealed record SpaceTree(long SpaceId, SpaceKind Kind, string Name, string Color, IReadOnlyList<FolderRow> Folders);

/// <summary>
/// Folders (docs/PLAN-PLATFORM.md section 1.1 and 2): nested up to 8 levels, in one area. <c>Path</c> holds the ids of the ancestors and of the folder itself (<c>/1/7/12/</c>), so a folder and
/// everything below it share a prefix: moving a folder rewrites the path of the whole subtree in one statement and cannot make a cycle. Needs Edit on the parent to make one, Manage to
/// rename or move one; sharing and trashing are in <see cref="ShareLogic"/> and <see cref="ItemLogic"/>.
/// </summary>
public static class FolderLogic
{
    public const int MaxDepth = 8;

    public const int MaxNameLength = 120;

    private static int DepthOf(string path) => path.Split('/', StringSplitOptions.RemoveEmptyEntries).Length;

    private static FolderRow ToRow(Folder f) => new(f.Id, f.SpaceId, f.ParentId, f.Name, f.Color, f.Path, DepthOf(f.Path), f.UpdateDate);

    private static string CleanName(string? name)
    {
        var clean = (name ?? "").Trim();
        if (clean.Length == 0)
        {
            throw new BizException("Bitte gib dem Ordner einen Namen.", "Input.Name");
        }

        return clean.Length > MaxNameLength ? clean[..MaxNameLength] : clean;
    }

    private static string? CleanColor(string? color) => string.IsNullOrWhiteSpace(color) ? null : BrandLogic.NormalizeColor(color) ?? throw new BizException("Das ist keine Farbe. Erlaubt sind Hex-Werte wie #1fb3d6.", "Input.Color");

    /// <summary>The folder as a row, or null when it does not exist or the person may not see it.</summary>
    public static async Task<FolderRow?> GetAsync(Biz biz, long id)
    {
        var folder = await Access.Visible<Folder>(biz).AsNoTracking().FirstOrDefaultAsync(f => f.Id == id);
        return folder is null ? null : ToRow(folder);
    }

    /// <summary>Where the folder is and what the person may do with it.</summary>
    public static Task<ItemPlace> PlaceAsync(Biz biz, long id) => Access.PlaceAsync(biz, ItemKind.Folder, id);

    /// <summary>
    /// Makes a folder inside <paramref name="parentId"/> (the person needs Edit on it; the area is its area) or at the top of an area (the person must be allowed to write there, by default
    /// the personal area). At most 8 levels.
    /// </summary>
    public static async Task<FolderRow> CreateAsync(Biz biz, long? spaceId, long? parentId, string? name, string? color = null)
    {
        biz.RequireSignedIn();
        var (space, parent) = await Access.PlacementAsync(biz, spaceId, parentId);
        var clean = CleanName(name);
        var folderColor = CleanColor(color);
        string parentPath = "/";
        if (parent is { } parentFolder)
        {
            parentPath = await biz.Db.Folder.AsNoTracking().Where(f => f.Id == parentFolder).Select(f => f.Path).FirstAsync();
            if (DepthOf(parentPath) >= MaxDepth)
            {
                throw new BizException($"Ordner lassen sich nur {MaxDepth} Ebenen tief verschachteln.");
            }
        }

        var folder = new Folder { SpaceId = space, ParentId = parent, Name = clean, Color = folderColor, Path = "/" };
        biz.Db.Folder.Add(folder);
        await biz.Db.SaveChangesAsync();
        folder.Path = parentPath + folder.Id + "/";
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Ordner angelegt", nameof(Folder), folder.Id, folder.Name);
        return ToRow(folder);
    }

    /// <summary>Name and colour of a folder. Needs Manage.</summary>
    public static async Task<FolderRow> UpdateAsync(Biz biz, long id, string? name, string? color)
    {
        await Access.RequireAsync(biz, ItemKind.Folder, id, AccessLevel.Manage);
        var folder = await biz.Db.Folder.FirstOrDefaultAsync(f => f.Id == id) ?? throw new NotFoundException();
        folder.Name = CleanName(name);
        folder.Color = CleanColor(color);
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Ordner geändert", nameof(Folder), id, folder.Name);
        return ToRow(folder);
    }

    /// <summary>Only the name of a folder (the context menu "Umbenennen"). Needs Manage.</summary>
    public static async Task<FolderRow> RenameAsync(Biz biz, long id, string? name)
    {
        await Access.RequireAsync(biz, ItemKind.Folder, id, AccessLevel.Manage);
        var folder = await biz.Db.Folder.FirstOrDefaultAsync(f => f.Id == id) ?? throw new NotFoundException();
        folder.Name = CleanName(name);
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Ordner umbenannt", nameof(Folder), id, folder.Name);
        return ToRow(folder);
    }

    /// <summary>
    /// Moves a folder with everything in it to another folder (the person needs Edit on it) or to the top of an area (they must be allowed to write there). Needs Manage on the folder. A folder
    /// cannot go into itself or below itself, and the tree must stay within 8 levels. Moving to another area takes the content along.
    /// </summary>
    public static async Task<FolderRow> MoveAsync(Biz biz, long id, long? targetSpaceId, long? targetParentId)
    {
        await Access.RequireAsync(biz, ItemKind.Folder, id, AccessLevel.Manage);
        var (space, parent) = await Access.PlacementAsync(biz, targetSpaceId, targetParentId);
        return await MoveCoreAsync(biz.Db, id, space, parent);
    }

    /// <summary>The move itself, without any permission check (the caller made them): the checks of the tree and the rewrite of the paths.</summary>
    internal static async Task<FolderRow> MoveCoreAsync(DtDbContext db, long id, long space, long? parent)
    {
        var folder = await db.Folder.FirstOrDefaultAsync(f => f.Id == id) ?? throw new NotFoundException();
        var parentPath = "/";
        if (parent is { } parentId)
        {
            var target = await db.Folder.AsNoTracking().FirstOrDefaultAsync(f => f.Id == parentId) ?? throw new BizException("Der Zielordner ist nicht mehr da.");
            if (target.Path.StartsWith(folder.Path, StringComparison.Ordinal))
            {
                throw new BizException("Ein Ordner lässt sich nicht in sich selbst oder in einen seiner Unterordner verschieben.");
            }

            if (target.TrashedDate is not null)
            {
                throw new BizException("Der Zielordner liegt im Papierkorb.");
            }

            parentPath = target.Path;
        }

        // how deep is the deepest folder below this one, counted from the folder itself
        var oldPrefix = folder.Path;
        var deepest = (await db.Folder.IgnoreQueryFilters().Where(f => f.Path.StartsWith(oldPrefix)).Select(f => f.Path).ToListAsync()).Select(DepthOf).DefaultIfEmpty(DepthOf(oldPrefix)).Max();
        var height = deepest - DepthOf(oldPrefix) + 1;
        if (DepthOf(parentPath) + height > MaxDepth)
        {
            throw new BizException($"Ordner lassen sich nur {MaxDepth} Ebenen tief verschachteln.");
        }

        var newPrefix = parentPath + folder.Id + "/";
        var oldSpace = folder.SpaceId;
        await using var transaction = await db.Database.BeginTransactionAsync();
        if (newPrefix != oldPrefix)
        {
            await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE \"Folder\" SET \"Path\" = {newPrefix} || substr(\"Path\", {oldPrefix.Length + 1}) WHERE \"Path\" LIKE {oldPrefix + "%"}");
        }

        if (oldSpace != space)
        {
            await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE \"Folder\" SET \"SpaceId\" = {space} WHERE \"Path\" LIKE {newPrefix + "%"}");
            await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE \"Design\" SET \"SpaceId\" = {space} WHERE \"FolderId\" IN (SELECT \"Id\" FROM \"Folder\" WHERE \"Path\" LIKE {newPrefix + "%"})");
            await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE \"DataList\" SET \"SpaceId\" = {space} WHERE \"FolderId\" IN (SELECT \"Id\" FROM \"Folder\" WHERE \"Path\" LIKE {newPrefix + "%"})");
            await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE \"OutputJob\" SET \"SpaceId\" = {space} WHERE \"FolderId\" IN (SELECT \"Id\" FROM \"Folder\" WHERE \"Path\" LIKE {newPrefix + "%"})");
            await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE \"Asset\" SET \"SpaceId\" = {space} WHERE \"FolderId\" IN (SELECT \"Id\" FROM \"Folder\" WHERE \"Path\" LIKE {newPrefix + "%"})");
        }

        await db.Folder.Where(f => f.Id == id).ExecuteUpdateAsync(s => s.SetProperty(f => f.ParentId, parent).SetProperty(f => f.SpaceId, space));
        await transaction.CommitAsync();
        await db.Entry(folder).ReloadAsync();
        return ToRow(folder);
    }

    /// <summary>The way from the top to a folder, as far as the person may see it: for a folder that was shared with them the way starts at the shared folder.</summary>
    public static async Task<List<FolderRow>> BreadcrumbAsync(Biz biz, long folderId)
    {
        await Access.RequireAsync(biz, ItemKind.Folder, folderId, AccessLevel.View);
        var path = await biz.Db.Folder.AsNoTracking().Where(f => f.Id == folderId).Select(f => f.Path).FirstAsync();
        var ids = path.Split('/', StringSplitOptions.RemoveEmptyEntries).Select(long.Parse).ToList();
        var folders = await Access.Visible<Folder>(biz).AsNoTracking().Where(f => ids.Contains(f.Id)).ToListAsync();
        return [.. folders.OrderBy(f => DepthOf(f.Path)).Select(ToRow)];
    }

    /// <summary>The areas the person may write in with all their folders (not those in the trash), for the "Verschieben nach ..." dialog.</summary>
    public static async Task<List<SpaceTree>> TreeAsync(Biz biz)
    {
        var spaces = await SpaceLogic.WritableAsync(biz);
        var ids = spaces.Select(s => s.Id).ToList();
        var folders = await biz.Db.Folder.AsNoTracking().Where(f => ids.Contains(f.SpaceId) && f.TrashedDate == null).OrderBy(f => f.Name).ToListAsync();
        var colors = await biz.Db.Space.AsNoTracking().Where(s => ids.Contains(s.Id)).ToDictionaryAsync(s => s.Id, s => s.Color);
        return [.. spaces.Select(s => new SpaceTree(s.Id, s.Kind, s.Kind == SpaceKind.Personal ? SpaceLogic.PersonalName : s.Name, colors.GetValueOrDefault(s.Id, "#1fb3d6"),
            [.. folders.Where(f => f.SpaceId == s.Id).OrderBy(f => DepthOf(f.Path)).ThenBy(f => f.Name, StringComparer.CurrentCultureIgnoreCase).Select(ToRow)]))];
    }

    /// <summary>The thumbnails (up to <paramref name="perFolder"/> addresses) of the designs inside each folder, for the tiles of the browser. Only designs the person may see.</summary>
    public static async Task<Dictionary<long, List<string>>> PreviewsAsync(Biz biz, IEnumerable<long> folderIds, int perFolder = 4)
    {
        var wanted = folderIds.Distinct().ToList();
        var result = wanted.ToDictionary(id => id, _ => new List<string>());
        if (wanted.Count == 0)
        {
            return result;
        }

        var designs = await Access.Visible<Design>(biz).AsNoTracking()
            .Where(d => d.FolderId != null && wanted.Contains(d.FolderId.Value) && d.ThumbnailHash != null)
            .OrderByDescending(d => d.UpdateDate)
            .Select(d => new { d.Id, FolderId = d.FolderId!.Value, d.ThumbnailHash })
            .Take(wanted.Count * perFolder * 3).ToListAsync();
        foreach (var d in designs)
        {
            if (result[d.FolderId].Count < perFolder)
            {
                var hash = d.ThumbnailHash ?? "";
                result[d.FolderId].Add($"/designs/{d.Id}/thumbnail.png?v={hash[..Math.Min(12, hash.Length)]}");
            }
        }

        // images count as well: they are what a folder of pictures looks like
        var assets = await Access.Visible<Asset>(biz).AsNoTracking()
            .Where(a => a.FolderId != null && wanted.Contains(a.FolderId.Value))
            .OrderByDescending(a => a.UpdateDate)
            .Select(a => new { a.Key, a.ContentHash, FolderId = a.FolderId!.Value })
            .Take(wanted.Count * perFolder * 3).ToListAsync();
        foreach (var a in assets)
        {
            if (result[a.FolderId].Count < perFolder)
            {
                result[a.FolderId].Add(AssetLogic.Url(a.Key, a.ContentHash));
            }
        }

        return result;
    }
}
