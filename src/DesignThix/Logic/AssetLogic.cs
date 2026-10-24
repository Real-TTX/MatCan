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

    public DateTime UpdateDate { get; init; }

    /// <summary>The address of the file; the hash makes it immutable for the browser.</summary>
    public string Url => AssetLogic.Url(Key, ContentHash);
}

/// <summary>The content of an asset for the endpoint: <see cref="Bytes"/> is null when the browser already has this version.</summary>
public sealed record AssetContent(string ContentHash, string ContentType, string Extension, byte[]? Bytes);

/// <summary>Where an asset key is used (a search in the JSON of designs and data rows).</summary>
public sealed record AssetUsage(IReadOnlyList<Choice> Designs, IReadOnlyList<Choice> DataLists);

/// <summary>The outcome of one uploaded file: the new asset, or the reason it was refused (shown to the person).</summary>
public sealed record AssetUploadResult(string FileName, AssetRow? Asset, string? Error, IReadOnlyList<string> Cleaned);

/// <summary>Media (images): the library of flags, seals, logos and photos that designs and data lists refer to by key.</summary>
public static class AssetLogic
{
    public static readonly IReadOnlyList<string> Categories = ["Flaggen", "Siegel", "Icons", "Logos", "Fotos", "Hintergründe", "Sonstiges"];

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

    public static IQueryable<AssetRow> Query(Biz biz)
    {
        biz.RequireSignedIn();
        return biz.Db.Asset.AsNoTracking().Select(a => new AssetRow { Id = a.Id, Key = a.Key, Name = a.Name, Category = a.Category, Tags = a.Tags, ContentType = a.ContentType, Extension = a.Extension, Width = a.Width, Height = a.Height, SizeBytes = a.SizeBytes, ContentHash = a.ContentHash, IsBuiltIn = a.IsBuiltIn, UpdateDate = a.UpdateDate });
    }

    public static async Task<AssetRow?> GetAsync(Biz biz, long id)
        => await Query(biz).FirstOrDefaultAsync(a => a.Id == id);

    public static async Task<AssetRow?> GetByKeyAsync(Biz biz, string key)
    {
        var normalized = (key ?? "").Trim().ToLowerInvariant();
        return await Query(biz).FirstOrDefaultAsync(a => a.Key == normalized);
    }

    /// <summary>The pickers' search: by name, key, tag or category; ordered by name.</summary>
    public static async Task<List<AssetRow>> SearchAsync(Biz biz, string? q, string? category, int take)
    {
        var query = Query(biz);
        if (!string.IsNullOrWhiteSpace(category))
        {
            var c = category.Trim();
            query = query.Where(a => a.Category == c);
        }

        if (!string.IsNullOrWhiteSpace(q))
        {
            var like = Services.Like.Contains(q);
            query = query.Where(a => EF.Functions.ILike(a.Name, like) || EF.Functions.ILike(a.Key, like) || EF.Functions.ILike(a.Tags, like));
        }

        return await query.OrderBy(a => a.Name).ThenBy(a => a.Key).Take(Math.Clamp(take, 1, 500)).ToListAsync();
    }

    /// <summary>The bytes of an asset by key. When <paramref name="knownHash"/> is the current version the bytes are not even read.</summary>
    public static async Task<AssetContent?> ContentAsync(Biz biz, string key, string? knownHash)
    {
        biz.RequireSignedIn();
        var normalized = (key ?? "").Trim().ToLowerInvariant();
        var head = await biz.Db.Asset.AsNoTracking().Where(a => a.Key == normalized).Select(a => new { a.Id, a.ContentHash, a.ContentType, a.Extension }).FirstOrDefaultAsync();
        if (head is null)
        {
            return null;
        }

        if (knownHash is not null && knownHash == head.ContentHash)
        {
            return new AssetContent(head.ContentHash, head.ContentType, head.Extension, null);
        }

        var bytes = await biz.Db.Asset.AsNoTracking().Where(a => a.Id == head.Id).Select(a => a.Bytes).FirstAsync();
        return new AssetContent(head.ContentHash, head.ContentType, head.Extension, bytes);
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

    private static string CleanCategory(string? category)
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

    /// <summary>Uploads one file; the key comes from the file name, a taken key gets a suffix. A refused file is reported in the result, not thrown.</summary>
    public static async Task<AssetUploadResult> UploadAsync(Biz biz, string fileName, byte[] bytes, string? category)
    {
        biz.RequireDesigner();
        Prepared prepared;
        try
        {
            prepared = Prepare(bytes);
        }
        catch (BizException ex)
        {
            return new AssetUploadResult(fileName, null, ex.Message, []);
        }

        var key = await FreeKeyAsync(biz.Db, KeyFromFileName(fileName));
        var asset = new Asset
        {
            Key = key,
            Name = DisplayName(fileName),
            Category = CleanCategory(category),
            Tags = "",
            ContentType = prepared.ContentType,
            Extension = prepared.Extension,
            Width = prepared.Width,
            Height = prepared.Height,
            Bytes = prepared.Bytes,
            ContentHash = prepared.Hash,
            SizeBytes = prepared.Bytes.LongLength,
        };
        biz.Db.Asset.Add(asset);
        await biz.Db.SaveChangesAsync();
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
        biz.RequireDesigner();
        var asset = await biz.Db.Asset.FirstOrDefaultAsync(a => a.Id == id) ?? throw new BizException("Das Medium gibt es nicht mehr.");
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
        biz.RequireDesigner();
        var asset = await biz.Db.Asset.FirstOrDefaultAsync(a => a.Id == id) ?? throw new BizException("Das Medium gibt es nicht mehr.");
        var prepared = Prepare(bytes);
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

    /// <summary>Deletes softly. The bytes are let go; the record stays, so a built-in that was deleted is not seeded again.</summary>
    public static async Task DeleteAsync(Biz biz, long id)
    {
        biz.RequireDesigner();
        var asset = await biz.Db.Asset.FirstOrDefaultAsync(a => a.Id == id) ?? throw new BizException("Das Medium gibt es nicht mehr.");
        asset.Bytes = [];
        asset.SizeBytes = 0;
        biz.Db.Asset.Remove(asset);
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Medium gelöscht", nameof(Asset), asset.Id, asset.Key);
    }

    // ------------------------------------------------------------------------------------------------ usage

    /// <summary>Designs and data lists that mention the key: a simple search in their JSON (quoted, so "flag-d" does not find "flag-de").</summary>
    public static async Task<AssetUsage> UsageAsync(Biz biz, string key)
    {
        biz.RequireSignedIn();
        var pattern = Services.Like.Contains("\"" + key + "\"");
        var designs = await biz.Db.Design.FromSqlInterpolated($"SELECT * FROM \"Design\" WHERE \"DocumentJson\"::text ILIKE {pattern} ESCAPE '\\'")
            .AsNoTracking().OrderBy(d => d.Name).Select(d => new Choice(d.Id, d.Name, d.Category)).Take(200).ToListAsync();
        var listIds = await biz.Db.DataRow.FromSqlInterpolated($"SELECT * FROM \"DataRow\" WHERE \"ValuesJson\"::text ILIKE {pattern} ESCAPE '\\'")
            .AsNoTracking().Select(r => r.DataListId).Distinct().Take(200).ToListAsync();
        var lists = await biz.Db.DataList.AsNoTracking().Where(l => listIds.Contains(l.Id)).OrderBy(l => l.Name).Select(l => new Choice(l.Id, l.Name, null)).ToListAsync();
        return new AssetUsage(designs, lists);
    }
}
