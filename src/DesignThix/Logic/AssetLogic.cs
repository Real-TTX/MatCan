using System.Security.Cryptography;
using DesignThix.Core.Media;
using DesignThix.Core.Text;
using DesignThix.Data;
using DesignThix.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Logic;

/// <summary>An asset as the lists and pickers need it: everything but the bytes.</summary>
public sealed record AssetRow
{
    public long Id { get; init; }

    public string Key { get; init; } = "";

    public string Name { get; init; } = "";

    public string Category { get; init; } = "";

    public string Tags { get; init; } = "";

    public string ContentType { get; init; } = "";

    public string Extension { get; init; } = "";

    public int? Width { get; init; }

    public int? Height { get; init; }

    public long SizeBytes { get; init; }

    public string ContentHash { get; init; } = "";

    public bool IsBuiltIn { get; init; }

    /// <summary>The area the image lives in; null for the built-in images.</summary>
    public long? SpaceId { get; init; }

    public long? FolderId { get; init; }

    public DateTime UpdateDate { get; init; }

    public DateTime CreateDate { get; init; }

    /// <summary>The address of the file; the hash makes it immutable for the browser.</summary>
    public string Url => AssetLogic.Url(Key, ContentHash);
}

/// <summary>The content of an asset for the endpoint: <see cref="Bytes"/> is null when the browser already has this version.</summary>
public sealed record AssetContent(string ContentHash, string ContentType, string Extension, byte[]? Bytes, bool IsBuiltIn);

/// <summary>Where an asset key is used (a search in the JSON of designs and data rows).</summary>
public sealed record AssetUsage(IReadOnlyList<Choice> Designs, IReadOnlyList<Choice> DataLists);

/// <summary>The outcome of one uploaded file: the new asset, or the reason it was refused (shown to the person).</summary>
public sealed record AssetUploadResult(string FileName, AssetRow? Asset, string? Error, IReadOnlyList<string> Cleaned);

/// <summary>Media (images): the library of flags, seals, logos and photos that designs and data lists refer to by key.</summary>
public static class AssetLogic
{
    /// <summary>The category the files of people go to unless they choose another; the built-in flags and seals keep Flaggen and Siegel.</summary>
    public const string UploadsCategory = "Uploads";

    public static readonly IReadOnlyList<string> Categories = [UploadsCategory, "Flaggen", "Siegel", "Icons", "Logos", "Fotos", "Hintergründe", "Sonstiges"];

    /// <summary>The most files one upload request takes.</summary>
    public const int MaxUploadFiles = 40;

    /// <summary>The largest file of an upload request (the page and the API); after the checks an image is limited to 10 MB and an SVG to 2 MB.</summary>
    public const long MaxUploadFileBytes = 12 * 1024 * 1024;

    public const long MaxImageBytes = 10 * 1024 * 1024;

    public const int MaxKeyLength = 64;

    public static string Url(string key, string hash) => $"/media/{Uri.EscapeDataString(key)}?v={hash[..Math.Min(12, hash.Length)]}";

    public static string Sha256Hex(ReadOnlySpan<byte> bytes) => Convert.ToHexStringLower(SHA256.HashData(bytes));

    /// <summary>The asset key a person typed, in its canonical form (lower case); null when it is not a valid key.</summary>
    public static string? NormalizeKey(string? key)
    {
        var k = (key ?? "").Trim().ToLowerInvariant();
        return k.Length is >= 1 and <= MaxKeyLength && KeyChars(k) ? k : null;
    }

    private static bool KeyChars(string key)
        => char.IsAsciiLetterOrDigit(key[0]) && key.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_');

    /// <summary>The key a file name makes: "Käse Logo.png" becomes "kaese-logo".</summary>
    public static string KeyFromFileName(string? fileName)
    {
        var name = Path.GetFileNameWithoutExtension(fileName ?? "");
        var slug = Slug.From(name, MaxKeyLength - 6);
        return slug.Length == 0 ? "bild" : slug;
    }

    /// <summary>The images the person may see: their areas, what is built in, and what sits in a folder that was shared with them.</summary>
    public static IQueryable<AssetRow> Query(Biz biz)
    {
        biz.RequireSignedIn();
        return Access.Visible<Asset>(biz).AsNoTracking().Select(a => new AssetRow { Id = a.Id, Key = a.Key, Name = a.Name, Category = a.Category, Tags = a.Tags, ContentType = a.ContentType, Extension = a.Extension, Width = a.Width, Height = a.Height, SizeBytes = a.SizeBytes, ContentHash = a.ContentHash, IsBuiltIn = a.IsBuiltIn, SpaceId = a.SpaceId, FolderId = a.FolderId, UpdateDate = a.UpdateDate, CreateDate = a.CreateDate });
    }

    public static async Task<AssetRow?> GetAsync(Biz biz, long id)
        => await Query(biz).FirstOrDefaultAsync(a => a.Id == id);

    public static async Task<AssetRow?> GetByKeyAsync(Biz biz, string key)
    {
        var normalized = (key ?? "").Trim().ToLowerInvariant();
        return await Query(biz).FirstOrDefaultAsync(a => a.Key == normalized);
    }

    /// <summary>
    /// The pickers' search: by name, key, tag or category (the category without regard to case: <c>uploads</c> finds "Uploads"); ordered by name, or with
    /// <paramref name="sort"/> <c>new</c> newest first (the media browser's uploads); <paramref name="spaceId"/> keeps the images of one area.
    /// </summary>
    public static async Task<List<AssetRow>> SearchAsync(Biz biz, string? q, string? category, int take, string? sort = null, long? spaceId = null)
    {
        var query = Query(biz);
        if (spaceId is { } space)
        {
            query = query.Where(a => a.SpaceId == space);
        }

        if (!string.IsNullOrWhiteSpace(category))
        {
            var c = category.Trim().ToLowerInvariant();
            query = query.Where(a => a.Category.ToLower() == c);
        }

        if (!string.IsNullOrWhiteSpace(q))
        {
            var like = Services.Like.Contains(q);
            query = query.Where(a => EF.Functions.ILike(a.Name, like) || EF.Functions.ILike(a.Key, like) || EF.Functions.ILike(a.Tags, like));
        }

        var ordered = string.Equals(sort, "new", StringComparison.OrdinalIgnoreCase)
            ? query.OrderByDescending(a => a.CreateDate).ThenByDescending(a => a.Id)
            : query.OrderBy(a => a.Name).ThenBy(a => a.Key);
        return await ordered.Take(Math.Clamp(take, 1, 500)).ToListAsync();
    }

    /// <summary>
    /// The bytes of an asset by key, for <c>/media/{key}</c>. The address with its hash (<paramref name="version"/>, at least 12 hex characters of the content hash) is a capability: it serves
    /// whoever has it, signed in or not (the APIs only hand it to people who may see the image). Without it the image must be built in or visible to the signed-in person; anything else is
    /// <c>null</c> (404), the same answer as for a key that does not exist. When <paramref name="knownHash"/> is the current version the bytes are not even read.
    /// </summary>
    public static async Task<AssetContent?> ContentAsync(Biz biz, string key, string? knownHash, string? version = null)
    {
        var normalized = (key ?? "").Trim().ToLowerInvariant();
        var head = await biz.Db.Asset.AsNoTracking().Where(a => a.Key == normalized).Select(a => new { a.Id, a.ContentHash, a.ContentType, a.Extension, a.IsBuiltIn, a.SpaceId }).FirstOrDefaultAsync();
        if (head is null)
        {
            return null;
        }

        var capability = version is { Length: >= 12 } v && head.ContentHash.StartsWith(v, StringComparison.OrdinalIgnoreCase);
        if (!capability && (biz.User.UserId is null || !await Access.Visible<Asset>(biz).AnyAsync(a => a.Id == head.Id)))
        {
            return null;
        }

        var builtIn = head.IsBuiltIn || head.SpaceId is null;
        if (knownHash is not null && knownHash == head.ContentHash)
        {
            return new AssetContent(head.ContentHash, head.ContentType, head.Extension, null, builtIn);
        }

        var bytes = await biz.Db.Asset.AsNoTracking().Where(a => a.Id == head.Id).Select(a => a.Bytes).FirstAsync();
        return new AssetContent(head.ContentHash, head.ContentType, head.Extension, bytes, builtIn);
    }

    public static async Task<List<string>> UsedCategoriesAsync(Biz biz)
        => await Query(biz).Select(a => a.Category).Distinct().OrderBy(c => c).ToListAsync();

    // ------------------------------------------------------------------------------------------------ upload

    /// <summary>What a file becomes: checked by its first bytes (never by its name), an SVG cleaned, the size and the hash worked out.</summary>
    public sealed record Prepared(byte[] Bytes, string ContentType, string Extension, int? Width, int? Height, string Hash, IReadOnlyList<string> Cleaned);

    /// <summary>What the sanitiser took out of an SVG, in German for the person who uploaded it ("Element „script“ entfernt").</summary>
    public static string DescribeRemoved(string removed)
    {
        const string suffix = " entfernt";
        if (removed == "DOCTYPE declaration")
        {
            return "DOCTYPE-Zeile" + suffix;
        }

        if (removed == "element style (unsafe rules)")
        {
            return "Stilregeln mit unsicherem Inhalt" + suffix;
        }

        if (removed.StartsWith("element ", StringComparison.Ordinal))
        {
            var rest = removed["element ".Length..];
            const string without = " without a safe reference";
            return rest.EndsWith(without, StringComparison.Ordinal) ? $"Element „{rest[..^without.Length]}“ ohne sicheren Verweis{suffix}" : $"Element „{rest}“{suffix}";
        }

        if (removed.StartsWith("attribute ", StringComparison.Ordinal))
        {
            var rest = removed["attribute ".Length..];
            const string unsafeValue = " (unsafe value)";
            return rest.EndsWith(unsafeValue, StringComparison.Ordinal) ? $"Attribut „{rest[..^unsafeValue.Length]}“ mit unsicherem Wert{suffix}" : $"Attribut „{rest}“{suffix}";
        }

        return removed.StartsWith("href ", StringComparison.Ordinal) ? $"Verweis „{removed["href ".Length..]}“{suffix}" : removed + suffix;
    }

    /// <summary>Checks a file as an image. Throws <see cref="BizException"/> with the reason in German when it is refused.</summary>
    public static Prepared Prepare(byte[] bytes)
    {
        if (bytes.Length == 0)
        {
            throw new BizException("Die Datei ist leer.");
        }

        var sniffed = FileSniffer.Sniff(bytes);
        if (!sniffed.IsImage)
        {
            throw new BizException("Das ist kein Bild, das DesignThix kennt. Erlaubt sind PNG, JPEG, WebP, GIF und SVG.");
        }

        if (sniffed.Kind == FileKind.Svg)
        {
            var clean = SvgSafe.Sanitize(bytes);
            if (!clean.Ok || clean.Bytes is null)
            {
                throw new BizException(clean.Error ?? "Die SVG-Datei ist nicht sicher genug und wurde abgelehnt.");
            }

            return new Prepared(clean.Bytes, "image/svg+xml", "svg", clean.Width, clean.Height, Sha256Hex(clean.Bytes), [.. clean.Removed.Select(DescribeRemoved).Distinct()]);
        }

        if (bytes.LongLength > MaxImageBytes)
        {
            throw new BizException($"Das Bild ist zu groß (höchstens {Services.Fmt.FileSize(MaxImageBytes)}).");
        }

        return new Prepared(bytes, sniffed.ContentType, sniffed.Extension, sniffed.Width, sniffed.Height, Sha256Hex(bytes), []);
    }

    public static string CleanCategory(string? category)
    {
        var c = (category ?? "").Trim();
        return Categories.FirstOrDefault(x => string.Equals(x, c, StringComparison.OrdinalIgnoreCase)) ?? (c.Length is > 0 and <= 60 ? c : "Sonstiges");
    }

    /// <summary>Takes a free key: the wish, else the wish with "-2", "-3" ... (a deleted asset does not hold its key).</summary>
    public static async Task<string> FreeKeyAsync(DtDbContext db, string wish)
    {
        var taken = await db.Asset.Where(a => a.Key == wish || a.Key.StartsWith(wish + "-")).Select(a => a.Key).ToListAsync();
        if (!taken.Contains(wish))
        {
            return wish;
        }

        var set = taken.ToHashSet();
        for (var n = 2; ; n++)
        {
            var candidate = $"{wish}-{n}";
            if (!set.Contains(candidate))
            {
                return candidate;
            }
        }
    }

    /// <summary>
    /// The category of an upload: the one that was asked for when it is a known category (without regard to case) or a plain name of at most 60 characters,
    /// else <see cref="UploadsCategory"/>.
    /// </summary>
    public static string UploadCategory(string? category)
    {
        var c = (category ?? "").Trim();
        if (c.Length == 0)
        {
            return UploadsCategory;
        }

        if (Categories.FirstOrDefault(x => string.Equals(x, c, StringComparison.OrdinalIgnoreCase)) is { } known)
        {
            return known;
        }

        return c.Length <= 60 && c.All(ch => char.IsLetterOrDigit(ch) || ch is ' ' or '-' or '_' or '.' or '&') ? c : UploadsCategory;
    }

    /// <summary>A pasted image has no name of its own: the browser calls it "image.png" or "blob", or sends none.</summary>
    public static bool IsGenericName(string? fileName)
    {
        var name = Path.GetFileNameWithoutExtension((fileName ?? "").Trim()).ToLowerInvariant();
        return name is "" or "image" or "blob";
    }

    /// <summary>
    /// Uploads one file into the area asked for (the person must be allowed to write there; by default their personal area) and the folder, if any; the key comes from the file name, a taken key gets
    /// a suffix. A refused file (not an image, no room left in the storage) is reported in the result, not thrown.
    /// </summary>
    public static async Task<AssetUploadResult> UploadAsync(Biz biz, string fileName, byte[] bytes, string? category, long? spaceId = null, long? folderId = null)
    {
        biz.RequireSignedIn();
        var (space, folder) = await Access.PlacementAsync(biz, spaceId, folderId);
        Prepared prepared;
        try
        {
            prepared = Prepare(bytes);
            await StorageLogic.RequireRoomAsync(biz, space, prepared.Bytes.LongLength);
        }
        catch (BizException ex)
        {
            return new AssetUploadResult(fileName, null, ex.Message, []);
        }

        // A pasted image has no name: it is called after the moment it came in, "bild-20261025-143005".
        var moment = Services.Fmt.Local(biz.Now);
        var pasted = IsGenericName(fileName);
        var wish = pasted ? "bild-" + moment.ToString("yyyyMMdd-HHmmss", System.Globalization.CultureInfo.InvariantCulture) : KeyFromFileName(fileName);
        var displayName = pasted ? "Bild vom " + moment.ToString("dd.MM.yyyy HH:mm:ss", System.Globalization.CultureInfo.InvariantCulture) : DisplayName(fileName);
        Asset asset;
        for (var attempt = 1; ; attempt++)
        {
            // Two uploads with the same name at the same moment both see the key as free; the unique index lets one win and the other asks again.
            asset = new Asset
            {
                Key = await FreeKeyAsync(biz.Db, wish),
                Name = displayName,
                Category = UploadCategory(category),
                Tags = "",
                ContentType = prepared.ContentType,
                Extension = prepared.Extension,
                Width = prepared.Width,
                Height = prepared.Height,
                Bytes = prepared.Bytes,
                ContentHash = prepared.Hash,
                SizeBytes = prepared.Bytes.LongLength,
                SpaceId = space,
                FolderId = folder,
            };
            biz.Db.Asset.Add(asset);
            try
            {
                await biz.Db.SaveChangesAsync();
                break;
            }
            catch (DbUpdateException) when (attempt < 10)
            {
                biz.Db.Entry(asset).State = EntityState.Detached;
            }
        }

        await biz.Log.LogAsync("Medium hochgeladen", nameof(Asset), asset.Id, $"{asset.Key} ({asset.ContentType}, {Services.Fmt.FileSize(asset.SizeBytes)})");
        return new AssetUploadResult(fileName, await GetAsync(biz, asset.Id), null, prepared.Cleaned);
    }

    private static string DisplayName(string fileName)
    {
        var name = Path.GetFileNameWithoutExtension(fileName).Replace('_', ' ').Replace('-', ' ').Trim();
        return name.Length == 0 ? "Bild" : name.Length > 200 ? name[..200] : name;
    }

    // ------------------------------------------------------------------------------------------------ change

    public sealed record AssetInput(string Key, string Name, string Category, string? Tags);

    public static async Task<AssetRow> UpdateAsync(Biz biz, long id, AssetInput input)
    {
        await Access.RequireAsync(biz, ItemKind.Asset, id, AccessLevel.Manage);
        var asset = await biz.Db.Asset.FirstOrDefaultAsync(a => a.Id == id) ?? throw new NotFoundException();
        var key = NormalizeKey(input.Key) ?? throw new BizException("Der Schlüssel darf nur Kleinbuchstaben, Ziffern, Bindestrich und Unterstrich enthalten (höchstens 64 Zeichen).", "Input.Key");
        if (await biz.Db.Asset.AnyAsync(a => a.Key == key && a.Id != id))
        {
            throw new BizException("Diesen Schlüssel hat schon ein anderes Medium.", "Input.Key");
        }

        var name = (input.Name ?? "").Trim();
        if (name.Length == 0)
        {
            throw new BizException("Bitte gib den Namen ein.", "Input.Name");
        }

        asset.Key = key;
        asset.Name = name.Length > 200 ? name[..200] : name;
        asset.Category = CleanCategory(input.Category);
        asset.Tags = CleanTags(input.Tags);
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Medium geändert", nameof(Asset), asset.Id, asset.Key);
        return (await GetAsync(biz, id))!;
    }

    /// <summary>Tags as one text: trimmed, no empty ones, no duplicates, separated by ", ".</summary>
    public static string CleanTags(string? tags)
        => string.Join(", ", (tags ?? "").Split([',', ';', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Where(t => t.Length > 0).Select(t => t.Length > 40 ? t[..40] : t).Distinct(StringComparer.OrdinalIgnoreCase).Take(30));

    public static async Task<(AssetRow Asset, IReadOnlyList<string> Cleaned)> ReplaceFileAsync(Biz biz, long id, byte[] bytes)
    {
        await Access.RequireAsync(biz, ItemKind.Asset, id, AccessLevel.Manage);
        var asset = await biz.Db.Asset.FirstOrDefaultAsync(a => a.Id == id) ?? throw new NotFoundException();
        var prepared = Prepare(bytes);
        if (asset.SpaceId is { } space)
        {
            await StorageLogic.RequireRoomAsync(biz, space, prepared.Bytes.LongLength - asset.SizeBytes);
        }

        asset.ContentType = prepared.ContentType;
        asset.Extension = prepared.Extension;
        asset.Width = prepared.Width;
        asset.Height = prepared.Height;
        asset.Bytes = prepared.Bytes;
        asset.ContentHash = prepared.Hash;
        asset.SizeBytes = prepared.Bytes.LongLength;
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Medium ersetzt", nameof(Asset), asset.Id, asset.Key);
        return ((await GetAsync(biz, id))!, prepared.Cleaned);
    }

    /// <summary>
    /// Deletes an image: one of an area goes to the trash (it keeps its bytes and its key until it is emptied or purged), one the platform owns (a built-in) is deleted softly at once: the bytes
    /// are let go, the record stays, so a built-in that was deleted is not seeded again. Needs Manage (the area, for a built-in an administrator).
    /// </summary>
    public static async Task DeleteAsync(Biz biz, long id)
    {
        await Access.RequireAsync(biz, ItemKind.Asset, id, AccessLevel.Manage);
        var asset = await biz.Db.Asset.FirstOrDefaultAsync(a => a.Id == id) ?? throw new NotFoundException();
        if (asset.SpaceId is null)
        {
            asset.Bytes = [];
            asset.SizeBytes = 0;
            biz.Db.Asset.Remove(asset);
            await biz.Db.SaveChangesAsync();
        }
        else
        {
            await ItemLogic.TrashAsync(biz, [new ItemRef(ItemKind.Asset, id)]);
        }

        await biz.Log.LogAsync("Medium gelöscht", nameof(Asset), asset.Id, asset.Key);
    }

    // ------------------------------------------------------------------------------------------------ usage

    /// <summary>The designs and data lists the person may see that use the image (by the stored references of <see cref="AssetRefs"/>).</summary>
    public static async Task<AssetUsage> UsageAsync(Biz biz, string key)
    {
        biz.RequireSignedIn();
        var wanted = (key ?? "").Trim().ToLowerInvariant();
        var db = biz.Db;
        var designs = await (from r in db.ItemAssetRef.AsNoTracking()
                             where r.AssetKey == wanted && r.ItemKind == ItemKind.Design
                             join d in Access.Visible<Design>(biz).AsNoTracking() on r.ItemId equals d.Id
                             orderby d.Name
                             select new Choice(d.Id, d.Name, d.Category)).Take(200).ToListAsync();
        var lists = await (from r in db.ItemAssetRef.AsNoTracking()
                           where r.AssetKey == wanted && r.ItemKind == ItemKind.DataList
                           join l in Access.Visible<DataList>(biz).AsNoTracking() on r.ItemId equals l.Id
                           orderby l.Name
                           select new Choice(l.Id, l.Name, null)).Take(200).ToListAsync();
        return new AssetUsage(designs, lists);
    }
}
