using DesignThix.Core.Documents;
using DesignThix.Core.Media;
using DesignThix.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Logic;

/// <summary>A design in a list or a gallery: everything but the document and the thumbnail bytes.</summary>
public sealed record DesignRow
{
    public long Id { get; init; }

    public string Name { get; init; } = "";

    public string? Category { get; init; }

    public string? Description { get; init; }

    public bool IsTemplate { get; init; }

    public int Revision { get; init; }

    public double Width { get; init; }

    public double Height { get; init; }

    public string Unit { get; init; } = "mm";

    public string? ThumbnailHash { get; init; }

    public DateTime UpdateDate { get; init; }

    public string Size => $"{Services.Fmt.Number((decimal)Width, Width % 1 == 0 ? 0 : 1)} × {Services.Fmt.Number((decimal)Height, Height % 1 == 0 ? 0 : 1)} {Unit}";

    public string? ThumbnailUrl => ThumbnailHash is null ? null : $"/designs/{Id}/thumbnail.png?v={ThumbnailHash[..Math.Min(12, ThumbnailHash.Length)]}";
}

/// <summary>An earlier state of a design (history tab).</summary>
public sealed record DesignRevisionRow(int Revision, DateTime Date, string? UserName);

/// <summary>The outcome of a save of the document: the new revision and the normalised document.</summary>
public sealed record DesignSaved(int Revision, string DocumentJson, IReadOnlyList<string> Warnings);

/// <summary>What the designer loads: <c>{ id, name, revision, document, canEdit }</c>.</summary>
public sealed record DesignLoaded(long Id, string Name, int Revision, string DocumentJson, bool CanEdit);

/// <summary>Designs: the records, their documents (validated and normalised by the Core), the history and the thumbnails.</summary>
public static class DesignLogic
{
    public const int KeptRevisions = 30;

    public const int MaxThumbnailBytes = 2 * 1024 * 1024;

    public static IQueryable<DesignRow> Query(Biz biz)
    {
        biz.RequireSignedIn();
        return biz.Db.Design.AsNoTracking().Select(d => new DesignRow { Id = d.Id, Name = d.Name, Category = d.Category, Description = d.Description, IsTemplate = d.IsTemplate, Revision = d.Revision, Width = d.Width, Height = d.Height, Unit = d.Unit, ThumbnailHash = d.ThumbnailHash, UpdateDate = d.UpdateDate });
    }

    public static async Task<DesignRow?> GetAsync(Biz biz, long id) => await Query(biz).FirstOrDefaultAsync(d => d.Id == id);

    public static async Task<List<string>> CategoriesAsync(Biz biz)
    {
        biz.RequireSignedIn();
        return await biz.Db.Design.AsNoTracking().Where(d => d.Category != null && d.Category != "").Select(d => d.Category!).Distinct().OrderBy(c => c).ToListAsync();
    }

    public static async Task<List<Choice>> ChoicesAsync(Biz biz, bool templatesOnly = false)
    {
        biz.RequireSignedIn();
        var query = biz.Db.Design.AsNoTracking().AsQueryable();
        if (templatesOnly)
        {
            query = query.Where(d => d.IsTemplate);
        }

        var rows = await query.OrderBy(d => d.Name).Select(d => new { d.Id, d.Name, d.Width, d.Height, d.Unit }).ToListAsync();
        return [.. rows.Select(d => new Choice(d.Id, d.Name, $"{Services.Fmt.Number((decimal)d.Width, d.Width % 1 == 0 ? 0 : 1)} × {Services.Fmt.Number((decimal)d.Height, d.Height % 1 == 0 ? 0 : 1)} {d.Unit}"))];
    }

    /// <summary>What the start page counts: designs, templates, data lists, media and fonts.</summary>
    public sealed record Counts(int Designs, int Templates, int DataLists, int Assets, int Fonts);

    public static async Task<Counts> CountsAsync(Biz biz)
    {
        biz.RequireSignedIn();
        var db = biz.Db;
        return new Counts(await db.Design.CountAsync(), await db.Design.CountAsync(d => d.IsTemplate), await db.DataList.CountAsync(), await db.Asset.CountAsync(), await db.Font.CountAsync());
    }

    public static async Task<List<DesignRow>> RecentAsync(Biz biz, int take)
        => await Query(biz).OrderByDescending(d => d.UpdateDate).Take(take).ToListAsync();

    public static async Task<int> CountAsync(Biz biz)
    {
        biz.RequireSignedIn();
        return await biz.Db.Design.CountAsync();
    }

    /// <summary>The document as the Core normalises it (never null: a damaged document becomes an empty one).</summary>
    public static async Task<DesignDocument> DocumentAsync(Biz biz, long id)
    {
        biz.RequireSignedIn();
        var json = await biz.Db.Design.AsNoTracking().Where(d => d.Id == id).Select(d => d.DocumentJson).FirstOrDefaultAsync() ?? throw new BizException("Das Design gibt es nicht mehr.");
        return DocumentValidator.Parse(json) ?? DocumentValidator.Create(100, 100);
    }

    // ------------------------------------------------------------------------------------------------ create, change, delete

    public sealed record NewDesign(string Name, string? Category, string? PresetKey, double? Width, double? Height, string? Unit, long? TemplateId);

    public static async Task<Design> CreateAsync(Biz biz, NewDesign input)
    {
        biz.RequireDesigner();
        var name = (input.Name ?? "").Trim();
        if (name.Length == 0)
        {
            throw new BizException("Bitte gib den Namen ein.", "Input.Name");
        }

        DesignDocument document;
        string? description = null;
        string? category = Clean(input.Category, 80);
        if (input.TemplateId is { } templateId)
        {
            var template = await biz.Db.Design.AsNoTracking().FirstOrDefaultAsync(d => d.Id == templateId) ?? throw new BizException("Die Vorlage gibt es nicht mehr.", "Input.TemplateId");
            document = DocumentValidator.Parse(template.DocumentJson) ?? DocumentValidator.Create(template.Width, template.Height, template.Unit);
            description = template.Description;
            category ??= template.Category;
        }
        else if (FormatPresets.Find(input.PresetKey) is { } preset)
        {
            document = DocumentValidator.Create(preset.Width, preset.Height, preset.Unit);
        }
        else
        {
            var unit = input.Unit is "px" ? "px" : "mm";
            var (min, max) = unit == "px" ? (16d, 20000d) : (5d, 5000d);
            if (input.Width is not { } w || w < min || w > max)
            {
                throw new BizException($"Die Breite liegt zwischen {min} und {max} {unit}.", "Input.Width");
            }

            if (input.Height is not { } h || h < min || h > max)
            {
                throw new BizException($"Die Höhe liegt zwischen {min} und {max} {unit}.", "Input.Height");
            }

            document = DocumentValidator.Create(w, h, unit);
        }

        var design = new Design
        {
            Name = Clip(name, 200),
            Category = category,
            Description = description,
            DocumentJson = DocumentValidator.ToJson(document),
            Revision = 1,
            Width = document.Width,
            Height = document.Height,
            Unit = document.Unit,
        };
        design.Revisions.Add(new DesignRevision { Revision = 1, DocumentJson = design.DocumentJson });
        biz.Db.Design.Add(design);
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Design angelegt", nameof(Design), design.Id, design.Name);
        return design;
    }

    public sealed record DesignInput(string Name, string? Category, string? Description, bool IsTemplate);

    public static async Task UpdatePropertiesAsync(Biz biz, long id, DesignInput input)
    {
        biz.RequireDesigner();
        var design = await biz.Db.Design.FirstOrDefaultAsync(d => d.Id == id) ?? throw new BizException("Das Design gibt es nicht mehr.");
        var name = (input.Name ?? "").Trim();
        if (name.Length == 0)
        {
            throw new BizException("Bitte gib den Namen ein.", "Input.Name");
        }

        design.Name = Clip(name, 200);
        design.Category = Clean(input.Category, 80);
        design.Description = Clean(input.Description, 2000);
        design.IsTemplate = input.IsTemplate;
        try
        {
            await biz.Db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new BizException("Jemand hat das Design gerade gespeichert. Bitte versuche es noch einmal.");
        }

        await biz.Log.LogAsync("Design geändert", nameof(Design), id, design.Name);
    }

    public static async Task<Design> DuplicateAsync(Biz biz, long id)
    {
        biz.RequireDesigner();
        var source = await biz.Db.Design.AsNoTracking().FirstOrDefaultAsync(d => d.Id == id) ?? throw new BizException("Das Design gibt es nicht mehr.");
        var copy = new Design
        {
            Name = Clip(source.Name + " (Kopie)", 200),
            Category = source.Category,
            Description = source.Description,
            IsTemplate = false,
            DocumentJson = source.DocumentJson,
            Revision = 1,
            Width = source.Width,
            Height = source.Height,
            Unit = source.Unit,
            ThumbnailPng = source.ThumbnailPng,
            ThumbnailHash = source.ThumbnailHash,
        };
        copy.Revisions.Add(new DesignRevision { Revision = 1, DocumentJson = copy.DocumentJson });
        biz.Db.Design.Add(copy);
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Design dupliziert", nameof(Design), copy.Id, $"{copy.Name} (aus {id})");
        return copy;
    }

    /// <summary>Changes only the name (the designer's title field); the revision of the document stays.</summary>
    public static async Task<string> RenameAsync(Biz biz, long id, string? name)
    {
        biz.RequireDesigner();
        var clean = Clip((name ?? "").Trim(), 200);
        if (clean.Length == 0)
        {
            throw new BizException("Bitte gib den Namen ein.", "Input.Name");
        }

        var design = await biz.Db.Design.FirstOrDefaultAsync(d => d.Id == id) ?? throw new BizException("Das Design gibt es nicht mehr.");
        if (design.Name == clean)
        {
            return clean;
        }

        design.Name = clean;
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Design umbenannt", nameof(Design), id, clean);
        return clean;
    }

    /// <summary>
    /// Saves the document the designer holds as a new design (the answer to an edit conflict: "Als Kopie speichern"). Name, category and description come from the
    /// original; the document is validated and normalised like any save.
    /// </summary>
    public static async Task<Design> CopyWithDocumentAsync(Biz biz, long id, string? documentJson)
    {
        biz.RequireDesigner();
        var result = DocumentValidator.Validate(documentJson);
        if (!result.Ok || result.Document is null || result.Json is null)
        {
            throw new BizException(result.Error ?? "Das Dokument ist ungültig.");
        }

        var source = await biz.Db.Design.AsNoTracking().FirstOrDefaultAsync(d => d.Id == id) ?? throw new BizException("Das Design gibt es nicht mehr.");
        var copy = new Design
        {
            Name = Clip(source.Name + " (Kopie)", 200),
            Category = source.Category,
            Description = source.Description,
            IsTemplate = false,
            DocumentJson = result.Json,
            Revision = 1,
            Width = result.Document.Width,
            Height = result.Document.Height,
            Unit = result.Document.Unit,
        };
        copy.Revisions.Add(new DesignRevision { Revision = 1, DocumentJson = copy.DocumentJson });
        biz.Db.Design.Add(copy);
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Design als Kopie gespeichert", nameof(Design), copy.Id, $"{copy.Name} (aus {id})");
        return copy;
    }

    public static async Task DeleteAsync(Biz biz, long id)
    {
        biz.RequireDesigner();
        var design = await biz.Db.Design.FirstOrDefaultAsync(d => d.Id == id) ?? throw new BizException("Das Design gibt es nicht mehr.");
        design.ThumbnailPng = null;
        design.ThumbnailHash = null;
        biz.Db.Design.Remove(design);
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Design gelöscht", nameof(Design), id, design.Name);
    }

    private static string? Clean(string? text, int max)
    {
        var t = (text ?? "").Trim();
        return t.Length == 0 ? null : Clip(t, max);
    }

    private static string Clip(string text, int max) => text.Length > max ? text[..max] : text;

    // ------------------------------------------------------------------------------------------------ the document (API of the designer)

    public static async Task<DesignLoaded?> LoadAsync(Biz biz, long id)
    {
        biz.RequireSignedIn();
        var design = await biz.Db.Design.AsNoTracking().Where(d => d.Id == id).Select(d => new { d.Id, d.Name, d.Revision, d.DocumentJson }).FirstOrDefaultAsync();
        return design is null ? null : new DesignLoaded(design.Id, design.Name, design.Revision, design.DocumentJson, biz.IsDesigner);
    }

    /// <summary>
    /// Saves a document: validated and normalised by the Core, the revision bumped, the state written to the history (the newest 30 stay).
    /// A stale revision throws <see cref="RevisionConflictException"/>; an invalid document a <see cref="BizException"/>.
    /// </summary>
    public static async Task<DesignSaved> SaveDocumentAsync(Biz biz, long id, int revision, string? documentJson)
    {
        biz.RequireDesigner();
        var result = DocumentValidator.Validate(documentJson);
        if (!result.Ok || result.Document is null || result.Json is null)
        {
            throw new BizException(result.Error ?? "Das Dokument ist ungültig.");
        }

        var design = await biz.Db.Design.FirstOrDefaultAsync(d => d.Id == id) ?? throw new BizException("Das Design gibt es nicht mehr.");
        if (design.Revision != revision)
        {
            throw new RevisionConflictException(design.Revision);
        }

        design.Revision++;
        design.DocumentJson = result.Json;
        design.Width = result.Document.Width;
        design.Height = result.Document.Height;
        design.Unit = result.Document.Unit;
        biz.Db.DesignRevision.Add(new DesignRevision { DesignId = id, Revision = design.Revision, DocumentJson = result.Json });
        try
        {
            await biz.Db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            var current = await biz.Db.Design.AsNoTracking().Where(d => d.Id == id).Select(d => d.Revision).FirstOrDefaultAsync();
            throw new RevisionConflictException(current);
        }

        var oldest = design.Revision - KeptRevisions;
        if (oldest > 0)
        {
            await biz.Db.DesignRevision.Where(r => r.DesignId == id && r.Revision <= oldest).ExecuteDeleteAsync();
        }

        return new DesignSaved(design.Revision, result.Json, result.Warnings);
    }

    public static async Task<List<DesignRevisionRow>> RevisionsAsync(Biz biz, long id)
    {
        biz.RequireSignedIn();
        return await (from r in biz.Db.DesignRevision.AsNoTracking()
                      where r.DesignId == id
                      join u in biz.Db.User.AsNoTracking() on r.CreateUserId equals u.Id into users
                      from u in users.DefaultIfEmpty()
                      orderby r.Revision descending
                      select new DesignRevisionRow(r.Revision, r.CreateDate, u == null ? null : u.DisplayName)).ToListAsync();
    }

    /// <summary>Makes an earlier state the current one (as a new revision, so nothing is lost).</summary>
    public static async Task<DesignSaved> RestoreAsync(Biz biz, long id, int revision)
    {
        biz.RequireDesigner();
        var json = await biz.Db.DesignRevision.AsNoTracking().Where(r => r.DesignId == id && r.Revision == revision).Select(r => r.DocumentJson).FirstOrDefaultAsync()
            ?? throw new BizException("Diesen Stand gibt es nicht mehr.");
        var current = await biz.Db.Design.AsNoTracking().Where(d => d.Id == id).Select(d => (int?)d.Revision).FirstOrDefaultAsync() ?? throw new BizException("Das Design gibt es nicht mehr.");
        var saved = await SaveDocumentAsync(biz, id, current, json);
        await biz.Log.LogAsync("Design wiederhergestellt", nameof(Design), id, $"Stand {revision}");
        return saved;
    }

    // ------------------------------------------------------------------------------------------------ thumbnails

    public static async Task SaveThumbnailAsync(Biz biz, long id, byte[] png)
    {
        biz.RequireDesigner();
        if (png.Length == 0 || png.Length > MaxThumbnailBytes)
        {
            throw new BizException("Das Vorschaubild ist leer oder größer als 2 MB.");
        }

        if (FileSniffer.Sniff(png).Kind != FileKind.Png)
        {
            throw new BizException("Das Vorschaubild muss ein PNG sein.");
        }

        var hash = AssetLogic.Sha256Hex(png);
        var changed = await biz.Db.Design.Where(d => d.Id == id).ExecuteUpdateAsync(s => s.SetProperty(d => d.ThumbnailPng, png).SetProperty(d => d.ThumbnailHash, hash));
        if (changed == 0)
        {
            throw new BizException("Das Design gibt es nicht mehr.");
        }
    }

    public static async Task<(byte[] Bytes, string Hash)?> ThumbnailAsync(Biz biz, long id)
    {
        biz.RequireSignedIn();
        var thumb = await biz.Db.Design.AsNoTracking().Where(d => d.Id == id && d.ThumbnailPng != null).Select(d => new { d.ThumbnailPng, d.ThumbnailHash }).FirstOrDefaultAsync();
        return thumb is null ? null : (thumb.ThumbnailPng!, thumb.ThumbnailHash ?? "");
    }

    public static async Task<string?> ThumbnailHashAsync(Biz biz, long id)
    {
        biz.RequireSignedIn();
        return await biz.Db.Design.AsNoTracking().Where(d => d.Id == id).Select(d => d.ThumbnailHash).FirstOrDefaultAsync();
    }
}
