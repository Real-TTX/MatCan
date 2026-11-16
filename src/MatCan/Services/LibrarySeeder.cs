using System.Text.Json;
using MatCan.Core.Media;
using MatCan.Data;
using MatCan.Data.Entities;
using MatCan.Logic;
using Microsoft.EntityFrameworkCore;

namespace MatCan.Services;

/// <summary>
/// Puts the built-in library into an empty or older database at start-up: the flags and seals of <c>wwwroot/builtin/builtin.json</c>, the fonts of
/// <c>wwwroot/fonts/fonts.json</c> and the sheet layouts for common label paper. It is idempotent and decides by the key a record was seeded with
/// (<c>BuiltInKey</c>, kept also when the record is renamed or deleted softly): a built-in that a person deleted stays deleted, one that was
/// edited is left alone, and a new one that a later version ships is added.
/// </summary>
public static class LibrarySeeder
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private sealed record BuiltInAsset(string Key, string Name, string Category, string File, string[]? Tags);

    private sealed record BuiltInFont(string Family, string File, string Weight, string Style, string? License, string? Source);

    private sealed record BuiltInSheet(string Key, string Name, double PaperWidth, double PaperHeight, double MarginTop, double MarginLeft, int Columns, int Rows, double CellWidth, double CellHeight, double GapX, double GapY);

    /// <summary>The sheets of the stationery shop: margins are worked out so that the labels sit centred.</summary>
    private static readonly BuiltInSheet[] Sheets =
    [
        new("a4-2x4", "A4 · 8 Etiketten · 2 × 4 · 99,1 × 67,7 mm", 210, 297, 13.1, 4.65, 2, 4, 99.1, 67.7, 2.5, 0),
        new("a4-3x8", "A4 · 24 Etiketten · 3 × 8 · 70 × 37 mm", 210, 297, 0.5, 0, 3, 8, 70, 37, 0, 0),
        new("a4-2x2-a6", "A4 quer · 4 × A6 · 2 × 2 · 148,5 × 105 mm", 297, 210, 0, 0, 2, 2, 148.5, 105, 0, 0),
        new("a4-1x1", "A4 · 1 Etikett · 190 × 277 mm", 210, 297, 10, 10, 1, 1, 190, 277, 0, 0),
        new("a4-2x5", "A4 · 10 Etiketten · 2 × 5 · 105 × 57 mm", 210, 297, 6, 0, 2, 5, 105, 57, 0, 0),
        new("a4-3x7", "A4 · 21 Etiketten · 3 × 7 · 70 × 42,3 mm", 210, 297, 0.45, 0, 3, 7, 70, 42.3, 0, 0),
    ];

    public static async Task SeedAsync(IServiceProvider services, string webRoot, ILogger logger, CancellationToken ct = default)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DtDbContext>();
        await SeedAssetsAsync(db, webRoot, logger, ct);
        await SeedFontsAsync(db, webRoot, logger, ct);
        await SeedSheetsAsync(db, ct);
    }

    private static async Task SeedAssetsAsync(DtDbContext db, string webRoot, ILogger logger, CancellationToken ct)
    {
        var listFile = Path.Combine(webRoot, "builtin", "builtin.json");
        if (!File.Exists(listFile))
        {
            return;
        }

        var items = JsonSerializer.Deserialize<List<BuiltInAsset>>(await File.ReadAllTextAsync(listFile, ct), Json) ?? [];
        var seeded = (await db.Asset.IgnoreQueryFilters().Where(a => a.BuiltInKey != null).Select(a => a.BuiltInKey!).ToListAsync(ct)).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var taken = (await db.Asset.Select(a => a.Key).ToListAsync(ct)).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var added = 0;
        foreach (var item in items)
        {
            var key = item.Key.Trim().ToLowerInvariant();
            if (seeded.Contains(key))
            {
                continue;
            }

            var path = Path.Combine(webRoot, "builtin", item.File.Replace('/', Path.DirectorySeparatorChar));
            if (!File.Exists(path) || taken.Contains(key))
            {
                logger.LogWarning("The built-in image {Key} was not seeded ({Reason}).", key, File.Exists(path) ? "the key is taken" : "the file is missing");
                continue;
            }

            AssetLogic.Prepared prepared;
            try
            {
                prepared = AssetLogic.Prepare(await File.ReadAllBytesAsync(path, ct));
            }
            catch (BizException ex)
            {
                logger.LogWarning("The built-in image {Key} was refused: {Message}", key, ex.Message);
                continue;
            }

            db.Asset.Add(new Asset
            {
                Key = key,
                Name = item.Name,
                Category = item.Category,
                Tags = string.Join(", ", item.Tags ?? []),
                ContentType = prepared.ContentType,
                Extension = prepared.Extension,
                Width = prepared.Width,
                Height = prepared.Height,
                Bytes = prepared.Bytes,
                ContentHash = prepared.Hash,
                SizeBytes = prepared.Bytes.LongLength,
                IsBuiltIn = true,
                BuiltInKey = key,
            });
            added++;
        }

        if (added > 0)
        {
            await db.SaveChangesAsync(ct);
            logger.LogInformation("{Count} built-in images were added to the library.", added);
        }
    }

    private static async Task SeedFontsAsync(DtDbContext db, string webRoot, ILogger logger, CancellationToken ct)
    {
        var listFile = Path.Combine(webRoot, "fonts", "fonts.json");
        if (!File.Exists(listFile))
        {
            return;
        }

        var items = JsonSerializer.Deserialize<List<BuiltInFont>>(await File.ReadAllTextAsync(listFile, ct), Json) ?? [];
        var seeded = (await db.Font.IgnoreQueryFilters().Where(f => f.BuiltInKey != null).Select(f => f.BuiltInKey!).ToListAsync(ct)).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var added = 0;
        foreach (var item in items)
        {
            var path = Path.Combine(webRoot, "fonts", item.File);
            if (seeded.Contains(item.File) || !File.Exists(path))
            {
                continue;
            }

            var bytes = await File.ReadAllBytesAsync(path, ct);
            var sniffed = FileSniffer.Sniff(bytes);
            if (!sniffed.IsFont)
            {
                logger.LogWarning("The built-in font {File} is not a font file.", item.File);
                continue;
            }

            db.Font.Add(new Font
            {
                Family = FontLogic.CssName(item.Family),
                Weight = FontLogic.IsValidWeight(item.Weight) ? item.Weight : "400",
                Style = item.Style == "italic" ? "italic" : "normal",
                Format = sniffed.Extension,
                Bytes = bytes,
                ContentHash = AssetLogic.Sha256Hex(bytes),
                SizeBytes = bytes.LongLength,
                IsBuiltIn = true,
                BuiltInKey = item.File,
                License = item.License ?? "OFL-1.1",
                Source = item.Source,
            });
            added++;
        }

        if (added > 0)
        {
            await db.SaveChangesAsync(ct);
            logger.LogInformation("{Count} built-in fonts were added to the library.", added);
        }
    }

    private static async Task SeedSheetsAsync(DtDbContext db, CancellationToken ct)
    {
        var seeded = (await db.SheetLayout.IgnoreQueryFilters().Where(s => s.BuiltInKey != null).Select(s => s.BuiltInKey!).ToListAsync(ct)).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var added = false;
        foreach (var s in Sheets.Where(s => !seeded.Contains(s.Key)))
        {
            db.SheetLayout.Add(new SheetLayout
            {
                Name = s.Name,
                PaperWidth = s.PaperWidth,
                PaperHeight = s.PaperHeight,
                MarginTop = s.MarginTop,
                MarginLeft = s.MarginLeft,
                Columns = s.Columns,
                Rows = s.Rows,
                CellWidth = s.CellWidth,
                CellHeight = s.CellHeight,
                GapX = s.GapX,
                GapY = s.GapY,
                IsBuiltIn = true,
                BuiltInKey = s.Key,
            });
            added = true;
        }

        if (added)
        {
            await db.SaveChangesAsync(ct);
        }
    }
}
