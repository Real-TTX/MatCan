using System.Text.Json;
using DesignThix.Configuration;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Catalogs.Providers;

/// <summary>The part the catalogues over assets of the library share: the tile of an asset and the paging.</summary>
internal static class AssetItems
{
    public static CatalogItem Item(AssetRow a) => new()
    {
        Id = a.Key,
        Kind = a.Extension == "svg" ? CatalogKinds.Vector : CatalogKinds.Photo,
        Title = a.Name,
        Width = a.Width,
        Height = a.Height,
        Thumb = a.Url,
        AssetKey = a.Key,
    };

    /// <summary>The page of an ordered query: one more row than asked tells whether there is a next page.</summary>
    public static async Task<CatalogPage> PageAsync(IQueryable<AssetRow> ordered, CatalogQuery query, CancellationToken ct)
    {
        var page = Math.Clamp(query.Page, 1, CatalogQuery.MaxPage);
        var per = Math.Clamp(query.PerPage, 1, CatalogQuery.MaxPerPage);
        var rows = await ordered.Skip((page - 1) * per).Take(per + 1).ToListAsync(ct);
        return new CatalogPage([.. rows.Take(per).Select(a => Item(a))], page, per, null, rows.Count > per);
    }

    public static IQueryable<AssetRow> Filter(IQueryable<AssetRow> rows, CatalogQuery query)
    {
        if (!string.IsNullOrWhiteSpace(query.Text))
        {
            var like = Services.Like.Contains(query.Text.Trim());
            rows = rows.Where(a => EF.Functions.ILike(a.Name, like) || EF.Functions.ILike(a.Key, like) || EF.Functions.ILike(a.Tags, like));
        }

        return rows;
    }

    public static CatalogFetch Fetched(AssetRow a, CatalogItem item) => new() { Item = item, FileName = a.Key + "." + a.Extension };
}

/// <summary>
/// <b>Mitgeliefert</b>: the images that come with DesignThix (flags, seals), by category as collections. Already in the library, so choosing one imports nothing. (Lucide icons and the bundled
/// fonts have their own places, the panel Elemente and the font select; their items join this catalogue with the sets of plan 5 C3.)
/// </summary>
public sealed class BuiltinCatalog : ICatalog
{
    public string Id => "builtin";

    public string Name => "Mitgeliefert";

    public CatalogKinds Kinds => CatalogKinds.Illustration | CatalogKinds.Vector;

    public CatalogCaps Caps => CatalogCaps.Browse | CatalogCaps.Search | CatalogCaps.Collections;

    public CatalogInfo Info { get; } = new("", null, null, "Flaggen und Siegel, die mit DesignThix kommen. Du darfst sie frei verwenden.", "Flaggen und Siegel, die mit DesignThix kommen.");

    public bool EnabledByDefault => true;

    public string? DefaultBaseUrl => null;

    public IReadOnlyList<string> AllowedHosts => [];

    public bool IsAvailable(ConfigStore config) => true;

    private static IQueryable<AssetRow> BuiltIns(CatalogContext ctx) => AssetLogic.Query(ctx.Biz).Where(a => a.IsBuiltIn && a.SpaceId == null);

    public async Task<IReadOnlyList<CatalogCollection>> CollectionsAsync(CatalogContext ctx, CancellationToken ct)
        => [.. (await BuiltIns(ctx).GroupBy(a => a.Category).Select(g => new { Category = g.Key, Count = g.Count() }).OrderBy(g => g.Category).ToListAsync(ct)).Select(g => new CatalogCollection(g.Category, g.Category, g.Count))];

    public async Task<CatalogPage> SearchAsync(CatalogContext ctx, CatalogQuery query, CancellationToken ct)
    {
        var rows = AssetItems.Filter(BuiltIns(ctx), query);
        if (!string.IsNullOrWhiteSpace(query.Collection))
        {
            var collection = query.Collection.Trim();
            rows = rows.Where(a => a.Category == collection);
        }

        return await AssetItems.PageAsync(rows.OrderBy(a => a.Category).ThenBy(a => a.Name), query, ct);
    }

    public async Task<CatalogFetch> FetchAsync(CatalogContext ctx, string itemId, CancellationToken ct)
    {
        var asset = await BuiltIns(ctx).FirstOrDefaultAsync(a => a.Key == itemId, ct) ?? throw new BizException("Das Bild gibt es nicht (mehr).");
        return AssetItems.Fetched(asset, AssetItems.Item(asset));
    }
}

/// <summary>
/// <b>Uploads</b>: the images of the person's own areas and of the teams, one collection per area ("Meine Uploads", each team), and "Freigegeben" for what only a share brought. Everything goes through
/// <c>Access.Visible</c>, so nobody sees an image they could not see anywhere else.
/// </summary>
public sealed class UploadsCatalog : ICatalog
{
    public const string SharedCollection = "shared";

    public string Id => "uploads";

    public string Name => "Uploads";

    public CatalogKinds Kinds => CatalogKinds.Photo | CatalogKinds.Illustration | CatalogKinds.Vector;

    public CatalogCaps Caps => CatalogCaps.Browse | CatalogCaps.Search | CatalogCaps.Collections;

    public CatalogInfo Info { get; } = new("", null, null, "Deine eigenen Bilder und die deiner Teams.", "Bilder, die du oder dein Team hochgeladen oder aus einem Katalog übernommen habt.");

    public bool EnabledByDefault => true;

    public string? DefaultBaseUrl => null;

    public IReadOnlyList<string> AllowedHosts => [];

    public bool IsAvailable(ConfigStore config) => true;

    private static IQueryable<AssetRow> Mine(CatalogContext ctx) => AssetLogic.Query(ctx.Biz).Where(a => !a.IsBuiltIn && a.SpaceId != null);

    public async Task<IReadOnlyList<CatalogCollection>> CollectionsAsync(CatalogContext ctx, CancellationToken ct)
    {
        var spaces = await SpaceLogic.MySpacesAsync(ctx.Biz);
        var counts = await Mine(ctx).GroupBy(a => a.SpaceId!.Value).Select(g => new { Space = g.Key, Count = g.Count() }).ToListAsync(ct);
        var list = new List<CatalogCollection>();
        foreach (var space in spaces)
        {
            list.Add(new CatalogCollection(space.Id.ToString(System.Globalization.CultureInfo.InvariantCulture), space.Kind == SpaceKind.Personal ? "Meine Uploads" : space.Name, counts.FirstOrDefault(c => c.Space == space.Id)?.Count ?? 0));
        }

        var memberIds = spaces.Select(s => s.Id).ToHashSet();
        var shared = counts.Where(c => !memberIds.Contains(c.Space)).Sum(c => c.Count);
        if (shared > 0)
        {
            list.Add(new CatalogCollection(SharedCollection, "Freigegeben", shared));
        }

        return list;
    }

    public async Task<CatalogPage> SearchAsync(CatalogContext ctx, CatalogQuery query, CancellationToken ct)
    {
        var rows = AssetItems.Filter(Mine(ctx), query);
        var collection = (query.Collection ?? "").Trim();
        if (collection == SharedCollection)
        {
            var memberIds = (await SpaceLogic.MySpacesAsync(ctx.Biz)).Select(s => s.Id).ToList();
            rows = rows.Where(a => !memberIds.Contains(a.SpaceId!.Value));
        }
        else if (long.TryParse(collection, System.Globalization.NumberStyles.None, System.Globalization.CultureInfo.InvariantCulture, out var space))
        {
            rows = rows.Where(a => a.SpaceId == space);
        }

        return await AssetItems.PageAsync(rows.OrderByDescending(a => a.CreateDate).ThenByDescending(a => a.Id), query, ct);
    }

    public async Task<CatalogFetch> FetchAsync(CatalogContext ctx, string itemId, CancellationToken ct)
    {
        var asset = await Mine(ctx).FirstOrDefaultAsync(a => a.Key == itemId, ct) ?? throw new BizException("Das Bild gibt es nicht (mehr).");
        return AssetItems.Fetched(asset, AssetItems.Item(asset));
    }
}

/// <summary>
/// <b>Ordner</b>: pictures in folders of the server (<c>{data}/catalogs/&lt;name&gt;/</c>), for a company's own picture archive that is mounted into the container. Read only. The administrator
/// names the folders; the first level of sub-folders are collections. Everything a person sends is a path RELATIVE to one of the named folders, checked segment by segment
/// (<see cref="ServerFolders"/>); a file is a picture only if its first bytes say so, never by its name.
/// </summary>
public sealed class FolderCatalog : ICatalog
{
    private static readonly string[] Extensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];

    /// <summary>How many files a listing looks at before it stops (a folder with a million files must not stall the server).</summary>
    private const int MaxScanned = 5000;

    public string Id => "folder";

    public string Name => "Ordner";

    public CatalogKinds Kinds => CatalogKinds.Photo | CatalogKinds.Illustration | CatalogKinds.Vector;

    public CatalogCaps Caps => CatalogCaps.Browse | CatalogCaps.Search | CatalogCaps.Collections;

    public CatalogInfo Info { get; } = new("", null, null, "Bilder aus Ordnern des Servers. Die Rechte an diesen Bildern regelt deine Organisation.", "Bildarchiv der Organisation: Ordner im Datenvolume unter catalogs/.");

    public bool EnabledByDefault => false;

    public string? DefaultBaseUrl => null;

    public IReadOnlyList<string> AllowedHosts => [];

    public bool IsAvailable(ConfigStore config) => true;

    public Task<IReadOnlyList<CatalogCollection>> CollectionsAsync(CatalogContext ctx, CancellationToken ct)
    {
        var root = ServerFolders.Root(ctx.Biz.Config.DataDir);
        var list = new List<CatalogCollection>();
        foreach (var folder in ctx.Settings.Folders)
        {
            if (ServerFolders.ResolveFolder(root, folder) is not { } path)
            {
                continue;
            }

            list.Add(new CatalogCollection(folder, folder));
            foreach (var sub in ServerFolders.SubFolders(path))
            {
                list.Add(new CatalogCollection(folder + "/" + sub, folder + " / " + sub));
            }
        }

        return Task.FromResult<IReadOnlyList<CatalogCollection>>(list);
    }

    public Task<CatalogPage> SearchAsync(CatalogContext ctx, CatalogQuery query, CancellationToken ct)
    {
        var root = ServerFolders.Root(ctx.Biz.Config.DataDir);
        var page = Math.Clamp(query.Page, 1, CatalogQuery.MaxPage);
        var per = Math.Clamp(query.PerPage, 1, CatalogQuery.MaxPerPage);
        var text = (query.Text ?? "").Trim();
        var wanted = new List<string>();
        var collection = (query.Collection ?? "").Trim();
        if (collection.Length > 0)
        {
            wanted.Add(collection);
        }
        else
        {
            wanted.AddRange(ctx.Settings.Folders);
        }

        var candidates = new List<(string Relative, string Full)>();
        var scanned = 0;
        foreach (var relative in wanted)
        {
            if (!ServerFolders.IsListed(ctx.Settings.Folders, relative) || ServerFolders.ResolvePath(root, ctx.Settings.Folders, relative) is not { } directory || !Directory.Exists(directory))
            {
                continue;
            }

            // with words: every file below the collection whose name has them; without: the files in the collection itself
            var recurse = text.Length > 0;
            IEnumerable<string> files;
            try
            {
                files = Directory.EnumerateFiles(directory, "*", new EnumerationOptions { RecurseSubdirectories = recurse, IgnoreInaccessible = true, AttributesToSkip = FileAttributes.ReparsePoint | FileAttributes.Hidden | FileAttributes.System, MaxRecursionDepth = 4 });
            }
            catch (IOException)
            {
                continue;
            }

            foreach (var file in files)
            {
                if (++scanned > MaxScanned)
                {
                    break;
                }

                if (!Extensions.Contains(Path.GetExtension(file), StringComparer.OrdinalIgnoreCase) || (text.Length > 0 && !Path.GetFileNameWithoutExtension(file).Contains(text, StringComparison.OrdinalIgnoreCase)))
                {
                    continue;
                }

                var relativeFile = ServerFolders.RelativeOf(root, file);
                if (relativeFile is not null)
                {
                    candidates.Add((relativeFile, file));
                }
            }
        }

        // only what the first bytes call a picture is listed; the page is cut after that check so a text file called x.png leaves no hole
        var items = new List<CatalogItem>();
        var skip = (page - 1) * per;
        var hasMore = false;
        foreach (var (relative, full) in candidates.OrderBy(c => c.Relative, StringComparer.OrdinalIgnoreCase))
        {
            var sniffed = ServerFolders.SniffImage(full);
            if (sniffed is null)
            {
                continue;
            }

            if (skip > 0)
            {
                skip--;
                continue;
            }

            if (items.Count == per)
            {
                hasMore = true;
                break;
            }

            items.Add(new CatalogItem { Id = relative, Kind = sniffed.Kind == Core.Media.FileKind.Svg ? CatalogKinds.Vector : CatalogKinds.Photo, Title = TitleOf(relative), Width = sniffed.Width, Height = sniffed.Height, Thumb = ctx.ThumbOfItem(relative) });
        }

        return Task.FromResult(new CatalogPage(items, page, per, null, hasMore));
    }

    internal static string TitleOf(string relative)
    {
        var name = Path.GetFileNameWithoutExtension(relative).Replace('_', ' ').Replace('-', ' ').Trim();
        return name.Length == 0 ? "Bild" : name.Length > 120 ? name[..120] : name;
    }

    public Task<CatalogFetch> FetchAsync(CatalogContext ctx, string itemId, CancellationToken ct)
    {
        var root = ServerFolders.Root(ctx.Biz.Config.DataDir);
        var path = ServerFolders.ResolvePath(root, ctx.Settings.Folders, itemId);
        if (path is null || !File.Exists(path))
        {
            throw new BizException("Das Bild gibt es nicht (mehr).");
        }

        var info = new FileInfo(path);
        if (info.Length > AssetLogic.MaxUploadFileBytes)
        {
            throw new BizException($"Das Bild ist zu groß (höchstens {Services.Fmt.FileSize(AssetLogic.MaxUploadFileBytes)}).");
        }

        var bytes = File.ReadAllBytes(path);
        var sniffed = Core.Media.FileSniffer.Sniff(bytes);
        if (!sniffed.IsImage)
        {
            throw new BizException("Das ist kein Bild, das DesignThix kennt. Erlaubt sind PNG, JPEG, WebP, GIF und SVG.");
        }

        var item = new CatalogItem { Id = itemId, Kind = sniffed.Kind == Core.Media.FileKind.Svg ? CatalogKinds.Vector : CatalogKinds.Photo, Title = TitleOf(itemId), Width = sniffed.Width, Height = sniffed.Height };
        return Task.FromResult(new CatalogFetch { Item = item, FileName = Path.GetFileName(path), Bytes = bytes });
    }
}
