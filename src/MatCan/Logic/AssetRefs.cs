using MatCan.Core.Data;
using MatCan.Core.Documents;
using MatCan.Data;
using MatCan.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace MatCan.Logic;

/// <summary>
/// Which images a design or a data list uses (<see cref="ItemAssetRef"/>), and the two rules built on it (docs/PLAN-PLATFORM.md section 3): a person who may view an item may load its images
/// (<see cref="ResolveAsync"/>), and nobody can use a foreign image by guessing its key (<see cref="RequireUsableAsync"/> refuses a new key that is not theirs to use).
/// </summary>
public static class AssetRefs
{
    /// <summary>The asset keys of a document in lower case: the backgrounds, the image sources and slots, and the samples of image fields.</summary>
    public static IReadOnlyList<string> KeysOf(DesignDocument document)
        => [.. Placeholders.AssetKeys(document).Select(k => k.Trim().ToLowerInvariant()).Where(k => k.Length > 0).Distinct(StringComparer.Ordinal)];

    /// <summary>The image keys in the cells of the image columns of a data list's rows, in lower case.</summary>
    public static IReadOnlyList<string> KeysOf(string columnsJson, IEnumerable<IReadOnlyDictionary<string, string>> rows)
    {
        var imageColumns = ColumnDefs.Parse(columnsJson).Where(c => c.Type == "image").Select(c => c.Key).ToList();
        if (imageColumns.Count == 0)
        {
            return [];
        }

        var keys = new HashSet<string>(StringComparer.Ordinal);
        foreach (var row in rows)
        {
            foreach (var column in imageColumns)
            {
                if (row.TryGetValue(column, out var value) && value.Trim().ToLowerInvariant() is { Length: > 0 } key && key.Length <= AssetLogic.MaxKeyLength)
                {
                    keys.Add(key);
                }
            }
        }

        return [.. keys.Order(StringComparer.Ordinal)];
    }

    /// <summary>The keys stored for an item.</summary>
    public static async Task<HashSet<string>> StoredAsync(DtDbContext db, ItemKind kind, long id)
        => (await db.ItemAssetRef.AsNoTracking().Where(r => r.ItemKind == kind && r.ItemId == id).Select(r => r.AssetKey).ToListAsync()).ToHashSet(StringComparer.Ordinal);

    /// <summary>Makes the stored keys of an item the given ones (the changes are tracked; the caller saves).</summary>
    public static async Task SyncAsync(DtDbContext db, ItemKind kind, long id, IEnumerable<string> keys)
    {
        var wanted = keys.Select(k => k.Trim().ToLowerInvariant()).Where(k => k.Length > 0 && k.Length <= 80).ToHashSet(StringComparer.Ordinal);
        var existing = await db.ItemAssetRef.Where(r => r.ItemKind == kind && r.ItemId == id).ToListAsync();
        foreach (var gone in existing.Where(r => !wanted.Contains(r.AssetKey)))
        {
            db.ItemAssetRef.Remove(gone);
        }

        var have = existing.Select(r => r.AssetKey).ToHashSet(StringComparer.Ordinal);
        foreach (var key in wanted.Where(k => !have.Contains(k)))
        {
            db.ItemAssetRef.Add(new ItemAssetRef { ItemKind = kind, ItemId = id, AssetKey = key });
        }
    }

    /// <summary>Copies the stored keys of one item to another (a duplicate, a copy of a template); the caller saves.</summary>
    public static async Task CopyAsync(DtDbContext db, ItemKind kind, long fromId, long toId)
        => await SyncAsync(db, kind, toId, await StoredAsync(db, kind, fromId));

    /// <summary>
    /// The keys among <paramref name="keys"/> that the person may NOT use: no such image, or one that is not theirs. Usable are the images they may see (their areas, what is built in, what sits
    /// in a folder shared with them) and those that an item they may view uses (they have seen the image there).
    /// </summary>
    public static async Task<List<string>> UnavailableAsync(Biz biz, IEnumerable<string> keys)
    {
        var wanted = keys.Select(k => k.Trim().ToLowerInvariant()).Where(k => k.Length > 0).Distinct(StringComparer.Ordinal).ToList();
        if (wanted.Count == 0)
        {
            return [];
        }

        var db = biz.Db;
        var mine = await Access.Visible<Asset>(biz).Where(a => wanted.Contains(a.Key)).Select(a => a.Key).ToListAsync();
        var rest = wanted.Except(mine, StringComparer.Ordinal).ToList();
        if (rest.Count == 0)
        {
            return [];
        }

        var designs = Access.Visible<Design>(biz);
        var lists = Access.Visible<DataList>(biz);
        var seen = await db.ItemAssetRef.AsNoTracking()
            .Where(r => rest.Contains(r.AssetKey) && db.Asset.Any(a => a.Key == r.AssetKey) && ((r.ItemKind == ItemKind.Design && designs.Any(d => d.Id == r.ItemId)) || (r.ItemKind == ItemKind.DataList && lists.Any(l => l.Id == r.ItemId))))
            .Select(r => r.AssetKey).Distinct().ToListAsync();
        var seenKeys = seen.ToHashSet(StringComparer.Ordinal);
        return [.. rest.Where(k => !seenKeys.Contains(k))];
    }

    /// <summary>The save rule: every key that is new compared with <paramref name="stored"/> must be one the person may use; the first that is not is a message for the person.</summary>
    public static async Task RequireUsableAsync(Biz biz, IEnumerable<string> keys, ISet<string> stored)
    {
        var added = keys.Where(k => !stored.Contains(k)).ToList();
        if (added.Count == 0)
        {
            return;
        }

        var unavailable = await UnavailableAsync(biz, added);
        if (unavailable.Count > 0)
        {
            var shown = unavailable.Order(StringComparer.Ordinal).First();
            throw new BizException($"Das Bild „{shown}“ ist für dich nicht verfügbar.");
        }
    }

    /// <summary>The images among <paramref name="keys"/> that an item the person may view uses, or that they may see anyway (a query for the caller to read).</summary>
    public static async Task<IQueryable<Asset>> UsableAsync(Biz biz, ItemKind kind, long itemId, IEnumerable<string> keys)
    {
        await Access.RequireAsync(biz, kind, itemId, AccessLevel.View);
        var wanted = keys.Select(k => k.Trim().ToLowerInvariant()).Distinct(StringComparer.Ordinal).ToList();
        var stored = (await biz.Db.ItemAssetRef.AsNoTracking().Where(r => r.ItemKind == kind && r.ItemId == itemId && wanted.Contains(r.AssetKey)).Select(r => r.AssetKey).ToListAsync()).ToHashSet(StringComparer.Ordinal);
        var visible = Access.Visible<Asset>(biz);
        return biz.Db.Asset.Where(a => wanted.Contains(a.Key) && (stored.Contains(a.Key) || visible.Any(v => v.Id == a.Id)));
    }

    /// <summary>What <c>/api/assets/resolve</c> answers for one key.</summary>
    public sealed record Resolved(string Key, string Url, string Hash, string Name, int? Width, int? Height, string ContentType);

    /// <summary>
    /// The address (with its hash, the capability) of the images an item uses: the item must be viewable (<c>design</c> or <c>datalist</c>, or an output job through its design and list); a key is
    /// answered when it is built in, in an area of the person, or stored as used by the item. Everything else is simply left out.
    /// </summary>
    public static async Task<Dictionary<string, Resolved>> ResolveAsync(Biz biz, ItemKind kind, long itemId, IEnumerable<string> keys)
    {
        await Access.RequireAsync(biz, kind, itemId, AccessLevel.View);
        var wanted = keys.Select(k => (k ?? "").Trim().ToLowerInvariant()).Where(k => k.Length is > 0 and <= 80).Distinct(StringComparer.Ordinal).Take(500).ToList();
        var result = new Dictionary<string, Resolved>(StringComparer.Ordinal);
        if (wanted.Count == 0)
        {
            return result;
        }

        var db = biz.Db;
        var stored = (await db.ItemAssetRef.AsNoTracking().Where(r => r.ItemKind == kind && r.ItemId == itemId && wanted.Contains(r.AssetKey)).Select(r => r.AssetKey).ToListAsync()).ToHashSet(StringComparer.Ordinal);
        var visible = Access.Visible<Asset>(biz);
        var rows = await db.Asset.AsNoTracking()
            .Where(a => wanted.Contains(a.Key) && (stored.Contains(a.Key) || visible.Any(v => v.Id == a.Id)))
            .Select(a => new { a.Key, a.ContentHash, a.Name, a.Width, a.Height, a.ContentType })
            .ToListAsync();
        foreach (var a in rows)
        {
            result[a.Key] = new Resolved(a.Key, AssetLogic.Url(a.Key, a.ContentHash), a.ContentHash[..Math.Min(12, a.ContentHash.Length)], a.Name, a.Width, a.Height, a.ContentType);
        }

        return result;
    }
}
