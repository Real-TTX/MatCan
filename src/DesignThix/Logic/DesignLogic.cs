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

    /// <summary>Autosaves of one person within this time share one entry of the history (an explicit save, Ctrl+S, starts a new one).</summary>
    public static readonly TimeSpan AutosaveWindow = TimeSpan.FromMinutes(10);

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

    /// <summary>The categories that templates have (for the filter of the gallery of templates).</summary>
    public static async Task<List<string>> TemplateCategoriesAsync(Biz biz)
    {
        biz.RequireSignedIn();
        return await biz.Db.Design.AsNoTracking().Where(d => d.IsTemplate && d.Category != null && d.Category != "").Select(d => d.Category!).Distinct().OrderBy(c => c).ToListAsync();
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

    /// <summary>The designs worked on last ("Zuletzt bearbeitet" of the start page): the newest first, templates not included (they have their own page).</summary>
    public static async Task<List<DesignRow>> RecentAsync(Biz biz, int take)
        => await Query(biz).Where(d => !d.IsTemplate).OrderByDescending(d => d.UpdateDate).ThenByDescending(d => d.Id).Take(take).ToListAsync();

    /// <summary>
    /// A few templates of every category for the row on the start page: the first of each category, then the second of each, and so on, until <paramref name="take"/> are found,
    /// so the row shows the variety (labels, cards, flyers, social media) and not only the category that comes first in the alphabet.
    /// </summary>
    public static async Task<List<DesignRow>> FeaturedTemplatesAsync(Biz biz, int take)
    {
        var groups = (await TemplatesAsync(biz)).GroupBy(d => d.Category ?? "").Select(g => g.ToList()).ToList();
        var picked = new List<DesignRow>();
        for (var round = 0; picked.Count < take && groups.Any(g => g.Count > round); round++)
        {
            foreach (var group in groups.Where(g => g.Count > round))
            {
                if (picked.Count < take)
                {
                    picked.Add(group[round]);
                }
            }
        }

        return picked;
    }

    /// <summary>The designs that are templates, for the gallery of templates (the list builder adds search, filters and paging).</summary>
    public static IQueryable<DesignRow> TemplateQuery(Biz biz) => Query(biz).Where(d => d.IsTemplate);

    /// <summary>What the search of the start page found: own designs and templates whose name, category or description contains the text.</summary>
    public sealed record SearchResult(string Text, IReadOnlyList<DesignRow> Designs, IReadOnlyList<DesignRow> Templates)
    {
        public bool Empty => Designs.Count == 0 && Templates.Count == 0;
    }

    /// <summary>
    /// Searches designs and templates (case-insensitive, name, category and description). A blank text finds nothing (the start page then shows its normal content).
    /// At most <paramref name="take"/> of each kind, the newest first.
    /// </summary>
    public static async Task<SearchResult> SearchAsync(Biz biz, string? text, int take = 24)
    {
        biz.RequireSignedIn();
        var clean = (text ?? "").Trim();
        if (clean.Length == 0)
        {
            return new SearchResult("", [], []);
        }

        if (clean.Length > 100)
        {
            clean = clean[..100];
        }

        var like = Services.Like.Contains(clean);
        var found = Query(biz).Where(d => EF.Functions.ILike(d.Name, like, "\\") || (d.Category != null && EF.Functions.ILike(d.Category, like, "\\")) || (d.Description != null && EF.Functions.ILike(d.Description, like, "\\")));
        var designs = await found.Where(d => !d.IsTemplate).OrderByDescending(d => d.UpdateDate).ThenByDescending(d => d.Id).Take(take).ToListAsync();
        var templates = await found.Where(d => d.IsTemplate).OrderBy(d => d.Category).ThenBy(d => d.Name).ThenBy(d => d.Id).Take(take).ToListAsync();
        return new SearchResult(clean, designs, templates);
    }

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
            var (min, max) = SizeLimits(unit);
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

    /// <summary>The name of a design that was started from a tile or a size and has not been named yet.</summary>
    public const string UnnamedDesign = "Unbenanntes Design";

    /// <summary>
    /// Starts a design with one click: from a format preset (<paramref name="presetKey"/>, e.g. "business-card") or from a custom size, with an empty white page.
    /// Without a name it is called "Unbenannt – &lt;format&gt;" ("Unbenanntes Design" for a custom size). Designers and administrators.
    /// </summary>
    public static async Task<Design> CreateFromFormatAsync(Biz biz, string? presetKey, double? width, double? height, string? unit, string? name)
    {
        biz.RequireDesigner();
        var preset = FormatPresets.Find(presetKey);
        if (preset is null && !string.IsNullOrWhiteSpace(presetKey) && !string.Equals(presetKey, FormatPresets.CustomKey, StringComparison.OrdinalIgnoreCase))
        {
            throw new BizException("Dieses Format kenne ich nicht.", "Input.PresetKey");
        }

        var title = Clean(name, 200) ?? (preset is null ? UnnamedDesign : "Unbenannt – " + preset.ShortName);
        return await CreateAsync(biz, new NewDesign(title, null, preset?.Key, width, height, unit, null));
    }

    /// <summary>
    /// A copy of a template as a new design (the template stays): the document with everything in it, name, category and description, the thumbnail. The copy is not a template.
    /// Designers and administrators.
    /// </summary>
    public static async Task<Design> UseTemplateAsync(Biz biz, long templateId)
    {
        biz.RequireDesigner();
        var template = await biz.Db.Design.AsNoTracking().FirstOrDefaultAsync(d => d.Id == templateId) ?? throw new BizException("Die Vorlage gibt es nicht mehr.");
        if (!template.IsTemplate)
        {
            throw new BizException("Dieses Design ist keine Vorlage.");
        }

        var document = DocumentValidator.Parse(template.DocumentJson) ?? DocumentValidator.Create(template.Width, template.Height, template.Unit);
        var json = DocumentValidator.ToJson(document);
        var copy = new Design
        {
            Name = template.Name,
            Category = template.Category,
            Description = template.Description,
            IsTemplate = false,
            DocumentJson = json,
            Revision = 1,
            Width = document.Width,
            Height = document.Height,
            Unit = document.Unit,
            ThumbnailPng = template.ThumbnailPng,
            ThumbnailHash = template.ThumbnailHash,
        };
        copy.Revisions.Add(new DesignRevision { Revision = 1, DocumentJson = json });
        biz.Db.Design.Add(copy);
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Design aus Vorlage angelegt", nameof(Design), copy.Id, $"{copy.Name} (Vorlage {templateId})");
        return copy;
    }

    /// <summary>The templates (designs marked as Vorlage), by category and name, for the start page and the gallery of templates.</summary>
    public static async Task<List<DesignRow>> TemplatesAsync(Biz biz)
    {
        biz.RequireSignedIn();
        return await Query(biz).Where(d => d.IsTemplate).OrderBy(d => d.Category).ThenBy(d => d.Name).ThenBy(d => d.Id).ToListAsync();
    }

    /// <summary>The limits of a page size per unit: 5 to 5000 mm, 16 to 20000 px.</summary>
    public static (double Min, double Max) SizeLimits(string unit) => unit == "px" ? (16d, 20000d) : (5d, 5000d);

    /// <summary>
    /// "Größe ändern": a new page size (and unit) for every page of the design. With <paramref name="scale"/> the content of all pages grows or shrinks with the page and is centred
    /// (<see cref="DocumentResize"/>), otherwise it keeps its place. Saved as a new revision (so the old state stays in the history). Designers and administrators.
    /// </summary>
    public static async Task<DesignSaved> ResizeAsync(Biz biz, long id, double width, double height, string? unit, bool scale)
    {
        biz.RequireDesigner();
        var kind = unit == "px" ? "px" : "mm";
        var (min, max) = SizeLimits(kind);
        if (!double.IsFinite(width) || width < min || width > max)
        {
            throw new BizException($"Die Breite liegt zwischen {min} und {max} {kind}.", "Input.Width");
        }

        if (!double.IsFinite(height) || height < min || height > max)
        {
            throw new BizException($"Die Höhe liegt zwischen {min} und {max} {kind}.", "Input.Height");
        }

        var design = await biz.Db.Design.AsNoTracking().Where(d => d.Id == id).Select(d => new { d.Revision, d.DocumentJson }).FirstOrDefaultAsync() ?? throw new BizException("Das Design gibt es nicht mehr.");
        var document = DocumentValidator.Parse(design.DocumentJson) ?? throw new BizException("Das Design ist beschädigt.");
        var resized = DocumentResize.Resize(document, width, height, kind, scale);
        var saved = await SaveDocumentAsync(biz, id, design.Revision, DocumentValidator.ToJson(resized));
        await biz.Log.LogAsync("Design: Größe geändert", nameof(Design), id, $"{Services.Fmt.Number((decimal)width, 1)} × {Services.Fmt.Number((decimal)height, 1)} {kind}{(scale ? ", Inhalt skaliert" : "")}");
        return saved;
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
        return design is null ? null : new DesignLoaded(design.Id, design.Name, design.Revision, DocumentValidator.Current(design.DocumentJson), biz.IsDesigner);
    }

    /// <summary>
    /// Saves a document: validated and normalised by the Core, the revision bumped, the state written to the history (the newest 30 stay).
    /// A stale revision throws <see cref="RevisionConflictException"/>; an invalid document a <see cref="BizException"/>.
    /// </summary>
    public static async Task<DesignSaved> SaveDocumentAsync(Biz biz, long id, int revision, string? documentJson, bool autosave = false)
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
        // The editor saves by itself after every pause: such saves of one person in a short time refresh the newest entry of the history instead of filling it (30 entries are
        // only a few minutes of work otherwise). A save the person asked for (Ctrl+S, restore, resize, no autosave flag) is always a new entry.
        var newest = autosave ? await biz.Db.DesignRevision.FirstOrDefaultAsync(r => r.DesignId == id && r.Revision == design.Revision - 1) : null;
        if (newest is not null && newest.CreateUserId == biz.UserId && biz.Now - newest.CreateDate < AutosaveWindow)
        {
            newest.Revision = design.Revision;
            newest.DocumentJson = result.Json;
        }
        else
        {
            biz.Db.DesignRevision.Add(new DesignRevision { DesignId = id, Revision = design.Revision, DocumentJson = result.Json });
        }

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
