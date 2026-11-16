using MatCan.Core.Documents;
using MatCan.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace MatCan.Logic;

/// <summary>What the page of a public link needs to know before the script runs: what the link points to and whether downloading is allowed.</summary>
public sealed record PublicLinkInfo(ItemKind Kind, long ItemId, string Name, bool AllowDownload);

public sealed record PublicFont(string Family, string Weight, string Style, string Url);

/// <summary>One design for the public viewer: the document (its own sample values, no data list rows), the faces of the fonts it uses and the addresses of the images it uses.</summary>
public sealed record PublicDesignPayload(long Id, string Name, bool AllowDownload, long? FolderId, int Pages, string DocumentJson, IReadOnlyList<PublicFont> Fonts, IReadOnlyDictionary<string, string> Assets,
    IReadOnlyList<string> Warnings, IReadOnlyList<CreditRow> Credits, IReadOnlyDictionary<string, IconView>? Icons = null);

public sealed record PublicCrumb(long Id, string Name);

/// <summary>A tile of the gallery of a shared folder: a subfolder or a design (the thumbnail address carries its hash, so it can be loaded without signing in).</summary>
public sealed record PublicFolderItem(string Kind, long Id, string Name, string? ThumbUrl, int Count);

public sealed record PublicFolderPayload(long RootId, long FolderId, string Name, bool AllowDownload, IReadOnlyList<PublicCrumb> Breadcrumb, IReadOnlyList<PublicFolderItem> Items);

/// <summary>
/// The public side of sharing (docs/PLAN-PLATFORM.md section 1.8): what a <b>public link</b> shows to somebody who is not signed in. Nothing here needs a person: the token is the secret, and the rules are
/// in this class, not in the page. A link that is revoked, expired, switched off by the administrator (<c>publicLinks</c>), whose item is in the trash or whose kind is not a design or a folder is dead and
/// every method says so with <c>null</c>. The payload is built from the design itself: its own sample values, never the rows of a data list; images only for the keys the design uses and that belong to the
/// design's area, are built in or are stored as used by the design; fonts only those of the families the design uses (built in, or of the design's area). For a folder only the designs and the folders
/// inside its subtree are reachable, never a design somewhere else.
/// </summary>
public static class PublicShareLogic
{
    public const int MaxFolderItems = 500;

    /// <summary>Requests per minute and address for the public endpoints (a gallery draws a tile without a saved picture with one request; a request that finds nothing costs five).</summary>
    public const int RequestsPerMinute = 240;

    // ------------------------------------------------------------------------------------------------ the link

    private static async Task<LinkTarget?> LiveAsync(Biz biz, Guid token)
    {
        if (!biz.Platform.PublicLinks)
        {
            return null;
        }

        var target = await ShareLogic.ResolveAsync(biz.Db, token, biz.Now);
        return target is { Audience: LinkAudience.Public, Kind: ItemKind.Design or ItemKind.Folder } ? target : null;
    }

    /// <summary>What the token points to when it is a live public link; null otherwise.</summary>
    public static async Task<PublicLinkInfo?> InfoAsync(Biz biz, Guid token)
        => await LiveAsync(biz, token) is { } t ? new PublicLinkInfo(t.Kind, t.ItemId, t.Name, t.AllowDownload) : null;

    // ------------------------------------------------------------------------------------------------ a design

    /// <summary>
    /// The payload of a design. For the link of a design <paramref name="designId"/> is null (or its own id); for the link of a folder it names a design inside that folder or below it. Null when the link is
    /// dead or the design is not (or no longer) reachable through it.
    /// </summary>
    public static async Task<PublicDesignPayload?> DesignAsync(Biz biz, Guid token, long? designId)
    {
        var target = await LiveAsync(biz, token);
        if (target is null)
        {
            return null;
        }

        long id;
        if (target.Kind == ItemKind.Design)
        {
            if (designId is { } other && other != target.ItemId)
            {
                return null;
            }

            id = target.ItemId;
        }
        else
        {
            if (designId is not { } inside || !await InsideFolderAsync(biz, target.ItemId, inside))
            {
                return null;
            }

            id = inside;
        }

        var db = biz.Db;
        var design = await db.Design.AsNoTracking().Where(d => d.Id == id && d.TrashedDate == null).Select(d => new { d.Id, d.Name, d.DocumentJson, d.SpaceId, d.FolderId }).FirstOrDefaultAsync();
        if (design is null)
        {
            return null;
        }

        var document = DocumentValidator.Parse(design.DocumentJson);
        if (document is null)
        {
            return null;
        }

        var warnings = new List<string>();

        // images: only the keys the design uses, and only those that are the design's to use
        var keys = AssetRefs.KeysOf(document);
        var assets = new Dictionary<string, string>(StringComparer.Ordinal);
        if (keys.Count > 0)
        {
            var stored = (await db.ItemAssetRef.AsNoTracking().Where(r => r.ItemKind == ItemKind.Design && r.ItemId == design.Id && keys.Contains(r.AssetKey)).Select(r => r.AssetKey).ToListAsync()).ToHashSet(StringComparer.Ordinal);
            var space = design.SpaceId;
            var rows = await db.Asset.AsNoTracking().Where(a => keys.Contains(a.Key)).Select(a => new { a.Key, a.ContentHash, a.SpaceId }).ToListAsync();
            foreach (var a in rows)
            {
                if (a.SpaceId is null || a.SpaceId == space || stored.Contains(a.Key))
                {
                    assets[a.Key] = AssetLogic.Url(a.Key, a.ContentHash);
                }
            }

            var missing = keys.Where(k => !assets.ContainsKey(k)).OrderBy(k => k, StringComparer.Ordinal).ToList();
            if (missing.Count > 0)
            {
                warnings.Add($"Medien fehlen: {string.Join(", ", missing.Take(8).Select(k => "„" + k + "“"))}.");
            }
        }

        // fonts: the faces of the families the texts use
        var families = Placeholders.FontFamilies(document);
        var fonts = new List<PublicFont>();
        if (families.Count > 0)
        {
            var available = await db.Font.AsNoTracking().Where(f => f.SpaceId == null || f.SpaceId == design.SpaceId)
                .Select(f => new { f.Id, f.Family, f.Weight, f.Style, f.Format, f.ContentHash, f.SpaceId }).ToListAsync();
            // the design's own area wins where a face exists twice
            var own = available.Where(f => f.SpaceId == design.SpaceId && design.SpaceId != null).Select(f => (f.Family.ToLowerInvariant(), f.Weight, f.Style)).ToHashSet();
            foreach (var family in families)
            {
                var faces = available.Where(f => Placeholders.CleanFamily(f.Family).Equals(family, StringComparison.OrdinalIgnoreCase)
                    && (f.SpaceId == design.SpaceId || !own.Contains((f.Family.ToLowerInvariant(), f.Weight, f.Style)))).ToList();
                fonts.AddRange(faces.Select(f => new PublicFont(f.Family, f.Weight, f.Style, FontLogic.Url(f.Id, f.ContentHash, f.Format))));
            }
        }

        // the Bildnachweise: author, licence and source of the pictures that came from a catalogue on the internet (the attribution of CC BY material has to travel with the design); only for the images
        // this payload delivers
        var credits = assets.Count == 0 ? [] : await CatalogLogic.CreditsOfKeysAsync(biz, [.. assets.Keys]);
        // the icons of catalogues the design uses: their bodies travel with the payload (an anonymous viewer cannot ask /api/icons), and the sets that need a credit join the Bildnachweise
        var documentJson = DocumentValidator.ToJson(document);
        var iconNames = IconLogic.NamesIn(documentJson);
        var icons = await IconLogic.ResolveAsync(db, iconNames);
        credits = [.. credits, .. await CatalogLogic.CreditsOfIconsAsync(biz, icons.Keys)];
        return new PublicDesignPayload(design.Id, design.Name, target.AllowDownload, design.FolderId, document.Pages.Count, documentJson, fonts, assets, warnings, credits, icons);
    }

    /// <summary>Whether the design sits in the folder or below it, and no folder on the way is in the trash.</summary>
    private static async Task<bool> InsideFolderAsync(Biz biz, long rootFolderId, long designId)
    {
        var db = biz.Db;
        var folderId = await db.Design.AsNoTracking().Where(d => d.Id == designId && d.TrashedDate == null).Select(d => d.FolderId).FirstOrDefaultAsync();
        if (folderId is not { } folder)
        {
            return false;
        }

        return await InsideAsync(db, rootFolderId, folder);
    }

    private static async Task<bool> InsideAsync(Data.DtDbContext db, long rootFolderId, long folderId)
    {
        var root = await db.Folder.AsNoTracking().Where(f => f.Id == rootFolderId && f.TrashedDate == null).Select(f => f.Path).FirstOrDefaultAsync();
        var path = await db.Folder.AsNoTracking().Where(f => f.Id == folderId && f.TrashedDate == null).Select(f => f.Path).FirstOrDefaultAsync();
        if (root is null || path is null || !path.StartsWith(root, StringComparison.Ordinal))
        {
            return false;
        }

        // every folder between the root and this one must be live
        var between = path.Split('/', StringSplitOptions.RemoveEmptyEntries).Select(long.Parse).ToList();
        return await db.Folder.CountAsync(f => between.Contains(f.Id) && f.TrashedDate == null) == between.Count;
    }

    // ------------------------------------------------------------------------------------------------ a folder

    /// <summary>
    /// The gallery of a shared folder (<paramref name="folderId"/> null = the shared folder itself, else a folder inside it): the subfolders and the designs, with the way from the shared folder down.
    /// Null when the link is dead or the folder is not inside the shared one.
    /// </summary>
    public static async Task<PublicFolderPayload?> FolderAsync(Biz biz, Guid token, long? folderId)
    {
        var target = await LiveAsync(biz, token);
        if (target is not { Kind: ItemKind.Folder })
        {
            return null;
        }

        var db = biz.Db;
        var current = folderId ?? target.ItemId;
        if (!await InsideAsync(db, target.ItemId, current))
        {
            return null;
        }

        var folder = await db.Folder.AsNoTracking().Where(f => f.Id == current).Select(f => new { f.Id, f.Name, f.Path }).FirstAsync();
        var root = await db.Folder.AsNoTracking().Where(f => f.Id == target.ItemId).Select(f => f.Path).FirstAsync();
        var chain = folder.Path[root.Length..].Split('/', StringSplitOptions.RemoveEmptyEntries).Select(long.Parse).ToList();
        var rootCrumb = new PublicCrumb(target.ItemId, target.Name);
        var names = chain.Count == 0 ? [] : await db.Folder.AsNoTracking().Where(f => chain.Contains(f.Id)).ToDictionaryAsync(f => f.Id, f => f.Name);
        var crumbs = new List<PublicCrumb> { rootCrumb };
        crumbs.AddRange(chain.Select(c => new PublicCrumb(c, names.GetValueOrDefault(c, ""))));

        var subs = await db.Folder.AsNoTracking().Where(f => f.ParentId == current && f.TrashedDate == null).OrderBy(f => f.Name).Take(MaxFolderItems)
            .Select(f => new { f.Id, f.Name, Designs = db.Design.Count(d => d.FolderId == f.Id && d.TrashedDate == null) }).ToListAsync();
        var designs = await db.Design.AsNoTracking().Where(d => d.FolderId == current && d.TrashedDate == null).OrderBy(d => d.Name).Take(MaxFolderItems)
            .Select(d => new { d.Id, d.Name, d.ThumbnailHash }).ToListAsync();
        var items = new List<PublicFolderItem>();
        items.AddRange(subs.Select(s => new PublicFolderItem("folder", s.Id, s.Name, null, s.Designs)));
        items.AddRange(designs.Select(d => new PublicFolderItem("design", d.Id, d.Name, d.ThumbnailHash is { Length: > 0 } h ? $"/designs/{d.Id}/thumbnail.png?v={h[..Math.Min(12, h.Length)]}" : null, 0)));
        return new PublicFolderPayload(target.ItemId, current, folder.Name, target.AllowDownload, crumbs, items);
    }
}
