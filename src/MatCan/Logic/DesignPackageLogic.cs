using MatCan.Core.Documents;
using MatCan.Core.Media;
using MatCan.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace MatCan.Logic;

/// <summary>What an import did: the new design and how its media and fonts were met (new, already there, or put under another key).</summary>
public sealed record ImportResult(
    Design Design,
    int AssetsAdded,
    int AssetsReused,
    IReadOnlyList<(string From, string To)> AssetsRenamed,
    int FontsAdded,
    int FontsReused,
    IReadOnlyList<string> Warnings);

/// <summary>
/// Export and import of a design as a file (<c>.dtx.json</c>, see <see cref="DesignPackageFormat"/>): the document with the media and the fonts that are not built in.
/// Everything that comes in is checked like an upload (document validator, file sniffer, SVG sanitiser). Export needs View on the design; import makes a design in an area the person may write in
/// (by default their personal area) and counts the new images and fonts against its storage.
/// </summary>
public static class DesignPackageLogic
{
    public static async Task<(byte[] Bytes, string FileName)> ExportAsync(Biz biz, long designId)
    {
        await Access.RequireAsync(biz, ItemKind.Design, designId, AccessLevel.View);
        var design = await biz.Db.Design.AsNoTracking().Where(d => d.Id == designId).Select(d => new { d.Name, d.Category, d.Description, d.DocumentJson }).FirstOrDefaultAsync()
            ?? throw new NotFoundException();
        var document = DocumentValidator.Parse(design.DocumentJson) ?? throw new BizException("Das Design ist beschädigt und kann nicht exportiert werden.");

        var keys = Placeholders.AssetKeys(document).Select(k => k.ToLowerInvariant()).Distinct().ToList();
        var assets = keys.Count == 0
            ? []
            : await (await AssetRefs.UsableAsync(biz, ItemKind.Design, designId, keys)).AsNoTracking().OrderBy(a => a.Key).ToListAsync();

        // The built-in fonts are on every installation: they travel by reference (the family name in the document). Only the fonts somebody uploaded are packed.
        var families = Placeholders.FontFamilies(document);
        var fonts = new List<Font>();
        if (families.Count > 0)
        {
            var usable = (await FontLogic.AllAsync(biz, designId)).Where(f => !f.IsBuiltIn).Select(f => f.Id).ToList();
            var uploaded = await biz.Db.Font.AsNoTracking().Where(f => usable.Contains(f.Id)).ToListAsync();
            fonts = [.. uploaded.Where(f => families.Contains(Placeholders.CleanFamily(f.Family), StringComparer.OrdinalIgnoreCase)).OrderBy(f => f.Family).ThenBy(f => f.Style).ThenBy(f => f.Weight)];
        }

        var package = new DesignPackage(
            design.Name,
            design.Category,
            design.Description,
            DocumentValidator.ToJson(document),
            [.. assets.Select(a => new PackageAsset(a.Key, a.Name, a.Category, a.ContentType, a.Bytes, a.SourceJson))],
            [.. fonts.Select(f => new PackageFont(f.Family, f.Weight, f.Style, f.Format, f.Bytes))]);
        await biz.Log.LogAsync("Design exportiert", nameof(Design), designId, $"{design.Name}: {assets.Count} Medien, {fonts.Count} Schriften");
        return (DesignPackageFormat.Write(package), DesignPackageFormat.FileName(design.Name));
    }

    /// <summary>
    /// Reads an export file and creates a new design from it. A medium whose key is taken is reused when its content is the same, otherwise it is added under a new key
    /// (the document is rewritten). A font is reused when the same file is there; a font of a face that is there with other content is not added (the one there is used).
    /// A file that is not a design, or has a medium or font that does not pass the checks of an upload, is refused as a whole: nothing is saved.
    /// </summary>
    public static async Task<ImportResult> ImportAsync(Biz biz, byte[] file, long? spaceId = null, long? folderId = null)
    {
        biz.RequireSignedIn();
        var (space, folder) = await Access.PlacementAsync(biz, spaceId, folderId);
        if (file.LongLength > DesignPackageFormat.MaxFileBytes)
        {
            throw new BizException("Die Datei ist zu groß (höchstens 50 MB).");
        }

        var read = DesignPackageFormat.Read(file);
        if (!read.Ok || read.Package is null)
        {
            throw new BizException(read.Error ?? "Die Datei ist keine Design-Datei.");
        }

        var package = read.Package;
        var db = biz.Db;

        // 1. Check every file like an upload (before anything is changed).
        var preparedAssets = new List<(PackageAsset Source, AssetLogic.Prepared Prepared, string RawHash)>();
        foreach (var asset in package.Assets)
        {
            try
            {
                preparedAssets.Add((asset, AssetLogic.Prepare(asset.Bytes), AssetLogic.Sha256Hex(asset.Bytes)));
            }
            catch (BizException ex)
            {
                throw new BizException($"Das Medium „{asset.Key}“ wurde abgelehnt: {ex.Message}");
            }
        }

        var preparedFonts = new List<(PackageFont Source, SniffResult Sniffed, string Hash)>();
        foreach (var font in package.Fonts)
        {
            var sniffed = FileSniffer.Sniff(font.Bytes);
            if (!sniffed.IsFont)
            {
                throw new BizException($"Die Schrift „{font.Family}“ wurde abgelehnt: Das ist keine Schriftdatei (TTF, OTF, WOFF oder WOFF2).");
            }

            preparedFonts.Add((font, sniffed, AssetLogic.Sha256Hex(font.Bytes)));
        }

        var document = DocumentValidator.Parse(package.DocumentJson) ?? throw new BizException("Das Dokument in der Datei ist ungültig.");
        var warnings = new List<string>();

        // 2. Media: reuse by content (only what the person may see: another area's image with the same key is a taken key, nothing more), else a new key where the key is taken.
        //    The storage of the area must have room for everything that is new.
        var takenKeys = (await db.Asset.Select(a => a.Key).ToListAsync()).ToHashSet(StringComparer.Ordinal);
        var existingHashes = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var chunk in preparedAssets.Select(p => p.Source.Key).Chunk(500))
        {
            foreach (var row in await Access.Visible<Asset>(biz).AsNoTracking().Where(a => chunk.Contains(a.Key)).Select(a => new { a.Key, a.ContentHash }).ToListAsync())
            {
                existingHashes[row.Key] = row.ContentHash;
            }
        }

        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var renamed = new List<(string From, string To)>();
        var added = 0;
        var reused = 0;
        foreach (var (source, prepared, rawHash) in preparedAssets)
        {
            var key = source.Key;
            if (takenKeys.Contains(key))
            {
                if (existingHashes.TryGetValue(key, out var existingHash) && (existingHash == prepared.Hash || existingHash == rawHash))
                {
                    reused++;
                    continue;
                }

                var newKey = FreeKey(key, takenKeys);
                map[key] = newKey;
                renamed.Add((key, newKey));
                key = newKey;
            }

            takenKeys.Add(key);
            db.Asset.Add(new Asset
            {
                Key = key,
                Name = source.Name,
                Category = AssetLogic.CleanCategory(source.Category),
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
                SourceJson = source.SourceJson,
            });
            added++;
        }

        // 3. Fonts: the same file is reused; another file of a face that is there is not added.
        var knownFonts = (await Access.VisibleInSpaces<Font>(biz).AsNoTracking().Select(f => new { f.Family, f.Weight, f.Style, f.ContentHash }).ToListAsync())
            .Select(f => (f.Family, f.Weight, f.Style, f.ContentHash)).ToList();
        var fontsAdded = 0;
        var fontsReused = 0;
        foreach (var (source, sniffed, hash) in preparedFonts)
        {
            if (knownFonts.Any(f => f.ContentHash == hash))
            {
                fontsReused++;
                continue;
            }

            if (knownFonts.Any(f => f.Family.Equals(source.Family, StringComparison.OrdinalIgnoreCase) && f.Weight == source.Weight && f.Style == source.Style))
            {
                warnings.Add($"Die Schrift „{source.Family}“ ({source.Weight}, {(source.Style == "italic" ? "kursiv" : "normal")}) gibt es schon mit anderem Inhalt: die vorhandene wird verwendet.");
                continue;
            }

            db.Font.Add(new Font
            {
                Family = source.Family.Length > 100 ? source.Family[..100] : source.Family,
                Weight = source.Weight,
                Style = source.Style,
                Format = sniffed.Extension,
                Bytes = source.Bytes,
                ContentHash = hash,
                SizeBytes = source.Bytes.LongLength,
                License = "importiert",
                SpaceId = space,
            });
            knownFonts.Add((source.Family, source.Weight, source.Style, hash));
            fontsAdded++;
        }

        // 4. The design: its document with the keys that changed.
        var rewritten = DocumentValidator.Normalize(DesignPackageFormat.RewriteAssetKeys(document, map));
        var json = DocumentValidator.ToJson(rewritten);

        var haveFamilies = knownFonts.Select(f => Placeholders.CleanFamily(f.Family)).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var family in Placeholders.FontFamilies(rewritten).Where(f => !haveFamilies.Contains(f)))
        {
            warnings.Add($"Die Schrift „{family}“ gibt es hier nicht: es wird eine Ersatzschrift verwendet.");
        }

        var importedKeys = preparedAssets.Select(p => map.TryGetValue(p.Source.Key, out var renamedKey) ? renamedKey : p.Source.Key).Select(k => k.ToLowerInvariant()).ToHashSet(StringComparer.Ordinal);
        var usableKeys = (await Access.Visible<Asset>(biz).Select(a => a.Key).ToListAsync()).ToHashSet(StringComparer.Ordinal);
        usableKeys.UnionWith(importedKeys);
        var unknown = Placeholders.AssetKeys(rewritten).Where(k => !usableKeys.Contains(k.ToLowerInvariant())).ToList();
        if (unknown.Count > 0)
        {
            warnings.Add($"Medien fehlen: {string.Join(", ", unknown.Take(8).Select(k => "„" + k + "“"))}. Dort bleibt die Fläche leer.");
        }

        await StorageLogic.RequireRoomAsync(biz, space, db.ChangeTracker.Entries<Asset>().Where(e => e.State == EntityState.Added).Sum(e => e.Entity.SizeBytes)
            + db.ChangeTracker.Entries<Font>().Where(e => e.State == EntityState.Added).Sum(e => e.Entity.SizeBytes));

        var design = new Design
        {
            Name = package.Name.Length > 200 ? package.Name[..200] : package.Name,
            Category = package.Category,
            Description = package.Description,
            IsTemplate = false,
            DocumentJson = json,
            Revision = 1,
            Width = rewritten.Width,
            Height = rewritten.Height,
            Unit = rewritten.Unit,
            SpaceId = space,
            FolderId = folder,
        };
        design.Revisions.Add(new DesignRevision { Revision = 1, DocumentJson = json });
        db.Design.Add(design);
        await db.SaveChangesAsync();

        // the images the design may load: the ones it brought, and those the person may see (a key that is not theirs stays out of the references, so it cannot be loaded through this design)
        var documentKeys = AssetRefs.KeysOf(rewritten);
        var seenKeys = (await Access.Visible<Asset>(biz).Where(a => documentKeys.Contains(a.Key)).Select(a => a.Key).ToListAsync()).ToHashSet(StringComparer.Ordinal);
        await AssetRefs.SyncAsync(db, ItemKind.Design, design.Id, documentKeys.Where(seenKeys.Contains));
        await db.SaveChangesAsync();
        await biz.Log.LogAsync("Design importiert", nameof(Design), design.Id, $"{design.Name}: {added} Medien neu, {reused} vorhanden, {fontsAdded} Schriften neu");
        return new ImportResult(design, added, reused, renamed, fontsAdded, fontsReused, warnings);
    }

    /// <summary>"flag-de" becomes "flag-de-2", "flag-de-3" ... the first one that is free; the whole key stays within 64 characters.</summary>
    internal static string FreeKey(string key, ISet<string> taken)
    {
        for (var n = 2; ; n++)
        {
            var suffix = "-" + n;
            var candidate = (key.Length + suffix.Length > AssetLogic.MaxKeyLength ? key[..(AssetLogic.MaxKeyLength - suffix.Length)] : key) + suffix;
            if (!taken.Contains(candidate))
            {
                return candidate;
            }
        }
    }
}
