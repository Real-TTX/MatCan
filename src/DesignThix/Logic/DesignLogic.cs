using System.Linq.Expressions;
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

    /// <summary>The area of the design; null for the system templates.</summary>
    public long? SpaceId { get; init; }

    public long? FolderId { get; init; }

    public DateTime UpdateDate { get; init; }

    public string Size => $"{Services.Fmt.Number((decimal)Width, Width % 1 == 0 ? 0 : 1)} × {Services.Fmt.Number((decimal)Height, Height % 1 == 0 ? 0 : 1)} {Unit}";

    public string? ThumbnailUrl => ThumbnailHash is null ? null : $"/designs/{Id}/thumbnail.png?v={ThumbnailHash[..Math.Min(12, ThumbnailHash.Length)]}";
}

/// <summary>An earlier state of a design (history tab).</summary>
public sealed record DesignRevisionRow(int Revision, DateTime Date, string? UserName);

/// <summary>The outcome of a save of the document: the new revision and the normalised document.</summary>
public sealed record DesignSaved(int Revision, string DocumentJson, IReadOnlyList<string> Warnings);

/// <summary>What the designer loads: <c>{ id, name, revision, document, canEdit, canManage, spaceId }</c>; <c>canEdit</c> is false for a design the person may only view.</summary>
public sealed record DesignLoaded(long Id, string Name, int Revision, string DocumentJson, bool CanEdit, bool CanManage, long? SpaceId, long? FolderId);

/// <summary>Designs: the records, their documents (validated and normalised by the Core), the history and the thumbnails.</summary>
public static class DesignLogic
{
    public const int KeptRevisions = 30;

    /// <summary>Autosaves of one person within this time share one entry of the history (an explicit save, Ctrl+S, starts a new one).</summary>
    public static readonly TimeSpan AutosaveWindow = TimeSpan.FromMinutes(10);

    public const int MaxThumbnailBytes = 2 * 1024 * 1024;

    /// <summary>The designs the person may see: their own, those of their teams, what was shared with them, and the system templates. Not what is in the trash.</summary>
    public static IQueryable<DesignRow> Query(Biz biz)
    {
        biz.RequireSignedIn();
        return Project(Access.Visible<Design>(biz));
    }

    private static IQueryable<DesignRow> Project(IQueryable<Design> designs)
        => designs.AsNoTracking().Select(d => new DesignRow { Id = d.Id, Name = d.Name, Category = d.Category, Description = d.Description, IsTemplate = d.IsTemplate, Revision = d.Revision, Width = d.Width, Height = d.Height, Unit = d.Unit, ThumbnailHash = d.ThumbnailHash, SpaceId = d.SpaceId, FolderId = d.FolderId, UpdateDate = d.UpdateDate });

    /// <summary>The design as a list row, or null when it does not exist or the person may not see it.</summary>
    public static async Task<DesignRow?> GetAsync(Biz biz, long id) => await Query(biz).FirstOrDefaultAsync(d => d.Id == id);

    public static async Task<List<string>> CategoriesAsync(Biz biz)
    {
        biz.RequireSignedIn();
        return await Access.Visible<Design>(biz).AsNoTracking().Where(d => d.Category != null && d.Category != "").Select(d => d.Category!).Distinct().OrderBy(c => c).ToListAsync();
    }

    /// <summary>The categories that templates have (for the filter of the gallery of templates).</summary>
    public static async Task<List<string>> TemplateCategoriesAsync(Biz biz)
    {
        biz.RequireSignedIn();
        return await Templates(biz).AsNoTracking().Where(d => d.Category != null && d.Category != "").Select(d => d.Category!).Distinct().OrderBy(c => c).ToListAsync();
    }

    public static async Task<List<Choice>> ChoicesAsync(Biz biz, bool templatesOnly = false)
    {
        biz.RequireSignedIn();
        var query = Access.Visible<Design>(biz).AsNoTracking();
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
        var designs = Access.Visible<Design>(biz);
        return new Counts(await designs.CountAsync(), await Templates(biz).CountAsync(), await Access.Visible<DataList>(biz).CountAsync(), await Access.Visible<Asset>(biz).CountAsync(), await Access.VisibleInSpaces<Font>(biz).CountAsync());
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
    public static IQueryable<DesignRow> TemplateQuery(Biz biz) => Project(Templates(biz));

    /// <summary>The templates the person may use: the system templates, those of their own areas (personal and teams). A template that was only shared with them is not offered as one.</summary>
    public static IQueryable<Design> Templates(Biz biz) => Access.Visible<Design>(biz, AccessLevel.View, AccessVia.Membership).Where(d => d.IsTemplate);

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
        Expression<Func<DesignRow, bool>> matches = d => EF.Functions.ILike(d.Name, like, "\\") || (d.Category != null && EF.Functions.ILike(d.Category, like, "\\")) || (d.Description != null && EF.Functions.ILike(d.Description, like, "\\"));
        var designs = await Query(biz).Where(d => !d.IsTemplate).Where(matches).OrderByDescending(d => d.UpdateDate).ThenByDescending(d => d.Id).Take(take).ToListAsync();
        var templates = await TemplateQuery(biz).Where(matches).OrderBy(d => d.Category).ThenBy(d => d.Name).ThenBy(d => d.Id).Take(take).ToListAsync();
        return new SearchResult(clean, designs, templates);
    }

    public static async Task<int> CountAsync(Biz biz)
    {
        biz.RequireSignedIn();
        return await Access.Visible<Design>(biz).CountAsync();
    }

    /// <summary>The document as the Core normalises it (never null: a damaged document becomes an empty one). The person must be allowed to view the design.</summary>
    public static async Task<DesignDocument> DocumentAsync(Biz biz, long id)
    {
        await Access.RequireAsync(biz, ItemKind.Design, id, AccessLevel.View);
        var json = await biz.Db.Design.AsNoTracking().Where(d => d.Id == id).Select(d => d.DocumentJson).FirstOrDefaultAsync() ?? throw new NotFoundException();
        return DocumentValidator.Parse(json) ?? DocumentValidator.Create(100, 100);
    }

    /// <summary>Which of these designs the person manages (delete, rename, template flag): one query for a page of tiles.</summary>
    public static async Task<HashSet<long>> ManageableAsync(Biz biz, IEnumerable<long> ids)
    {
        var wanted = ids.Distinct().ToList();
        return wanted.Count == 0 ? [] : (await Access.Visible<Design>(biz, AccessLevel.Manage).Where(d => wanted.Contains(d.Id)).Select(d => d.Id).ToListAsync()).ToHashSet();
    }

    /// <summary>The designs of an area that are not templates yet, by name (the choice of "Als Teamvorlage"): the person must be allowed to change them.</summary>
    public static async Task<List<Choice>> TemplateCandidatesAsync(Biz biz, long spaceId)
    {
        await Access.RequireSpaceRole(biz, spaceId, SpaceRole.Editor);
        var rows = await Access.Visible<Design>(biz, AccessLevel.Manage, AccessVia.Membership).AsNoTracking().Where(d => d.SpaceId == spaceId && !d.IsTemplate).OrderBy(d => d.Name).Take(300)
            .Select(d => new { d.Id, d.Name, d.Width, d.Height, d.Unit }).ToListAsync();
        return [.. rows.Select(d => new Choice(d.Id, d.Name, $"{Services.Fmt.Number((decimal)d.Width, d.Width % 1 == 0 ? 0 : 1)} × {Services.Fmt.Number((decimal)d.Height, d.Height % 1 == 0 ? 0 : 1)} {d.Unit}"))];
    }

    /// <summary>Makes a design a template of its area (or a normal design again). Needs Manage on the design, like the template flag in its properties.</summary>
    public static async Task SetTemplateAsync(Biz biz, long id, bool isTemplate)
    {
        await Access.RequireAsync(biz, ItemKind.Design, id, AccessLevel.Manage);
        var design = await biz.Db.Design.FirstOrDefaultAsync(d => d.Id == id) ?? throw new NotFoundException();
        if (design.IsTemplate == isTemplate)
        {
            return;
        }

        design.IsTemplate = isTemplate;
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync(isTemplate ? "Design als Vorlage angeboten" : "Design ist keine Vorlage mehr", nameof(Design), id, design.Name);
    }

    /// <summary>Where the design is and what the person may do with it (the flags of the pages); <see cref="NotFoundException"/> when they may not see it.</summary>
    public static Task<ItemPlace> PlaceAsync(Biz biz, long id) => Access.PlaceAsync(biz, ItemKind.Design, id);

    // ------------------------------------------------------------------------------------------------ create, change, delete

    /// <summary>
    /// A new design. <paramref name="SpaceId"/> and <paramref name="FolderId"/> say where it goes (the person must be allowed to write there); without them it goes into their personal area.
    /// </summary>
    public sealed record NewDesign(string Name, string? Category, string? PresetKey, double? Width, double? Height, string? Unit, long? TemplateId, long? SpaceId = null, long? FolderId = null);

    public static async Task<Design> CreateAsync(Biz biz, NewDesign input)
    {
        biz.RequireSignedIn();
        var (space, folder) = await Access.PlacementAsync(biz, input.SpaceId, input.FolderId);
        var name = (input.Name ?? "").Trim();
        if (name.Length == 0)
        {
            throw new BizException("Bitte gib den Namen ein.", "Input.Name");
        }

        DesignDocument document;
        string? description = null;
        string? category = Clean(input.Category, 80);
        long? sourceId = null;
        if (input.TemplateId is { } templateId)
        {
            if (await Access.LevelAsync(biz, ItemKind.Design, templateId) == AccessLevel.None)
            {
                throw new BizException("Die Vorlage gibt es nicht mehr.", "Input.TemplateId");
            }

            var template = await biz.Db.Design.AsNoTracking().FirstOrDefaultAsync(d => d.Id == templateId) ?? throw new BizException("Die Vorlage gibt es nicht mehr.", "Input.TemplateId");
            document = DocumentValidator.Parse(template.DocumentJson) ?? DocumentValidator.Create(template.Width, template.Height, template.Unit);
            description = template.Description;
            category ??= template.Category;
            sourceId = templateId;
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
            SpaceId = space,
            FolderId = folder,
        };
        design.Revisions.Add(new DesignRevision { Revision = 1, DocumentJson = design.DocumentJson });
        biz.Db.Design.Add(design);
        await biz.Db.SaveChangesAsync();
        if (sourceId is not null)
        {
            // the images of a template the person may view are theirs to look at
            await AssetRefs.SyncAsync(biz.Db, ItemKind.Design, design.Id, AssetRefs.KeysOf(document));
            await biz.Db.SaveChangesAsync();
        }

        await biz.Log.LogAsync("Design angelegt", nameof(Design), design.Id, design.Name);
        await ItemLogic.VisitAsync(biz, ItemKind.Design, design.Id);
        return design;
    }

    /// <summary>The name of a design that was started from a tile or a size and has not been named yet.</summary>
    public const string UnnamedDesign = "Unbenanntes Design";

    /// <summary>
    /// Starts a design with one click: from a format preset (<paramref name="presetKey"/>, e.g. "business-card") or from a custom size, with an empty white page.
    /// Without a name it is called "Unbenannt – &lt;format&gt;" ("Unbenanntes Design" for a custom size). It goes into the area asked for or the personal area.
    /// </summary>
    public static async Task<Design> CreateFromFormatAsync(Biz biz, string? presetKey, double? width, double? height, string? unit, string? name, long? spaceId = null, long? folderId = null)
    {
        biz.RequireSignedIn();
        var preset = FormatPresets.Find(presetKey);
        if (preset is null && !string.IsNullOrWhiteSpace(presetKey) && !string.Equals(presetKey, FormatPresets.CustomKey, StringComparison.OrdinalIgnoreCase))
        {
            throw new BizException("Dieses Format kenne ich nicht.", "Input.PresetKey");
        }

        var title = Clean(name, 200) ?? (preset is null ? UnnamedDesign : "Unbenannt – " + preset.ShortName);
        return await CreateAsync(biz, new NewDesign(title, null, preset?.Key, width, height, unit, null, spaceId, folderId));
    }

    /// <summary>
    /// A copy of a template as a new design (the template stays): the document with everything in it, name, category and description, the thumbnail. The copy is not a template. The person
    /// needs to see the template; the copy goes into the area asked for or the personal area.
    /// </summary>
    public static async Task<Design> UseTemplateAsync(Biz biz, long templateId, long? spaceId = null, long? folderId = null)
    {
        biz.RequireSignedIn();
        var (space, folder) = await Access.PlacementAsync(biz, spaceId, folderId);
        await Access.RequireAsync(biz, ItemKind.Design, templateId, AccessLevel.View);
        var template = await biz.Db.Design.AsNoTracking().FirstOrDefaultAsync(d => d.Id == templateId) ?? throw new NotFoundException();
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
            SpaceId = space,
            FolderId = folder,
        };
        copy.Revisions.Add(new DesignRevision { Revision = 1, DocumentJson = json });
        biz.Db.Design.Add(copy);
        await biz.Db.SaveChangesAsync();
        await AssetRefs.SyncAsync(biz.Db, ItemKind.Design, copy.Id, AssetRefs.KeysOf(document));
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Design aus Vorlage angelegt", nameof(Design), copy.Id, $"{copy.Name} (Vorlage {templateId})");
        return copy;
    }

    /// <summary>The templates (designs marked as Vorlage) the person may use, by category and name, for the start page and the gallery of templates.</summary>
    public static async Task<List<DesignRow>> TemplatesAsync(Biz biz)
    {
        biz.RequireSignedIn();
        return await TemplateQuery(biz).OrderBy(d => d.Category).ThenBy(d => d.Name).ThenBy(d => d.Id).ToListAsync();
    }

    /// <summary>The limits of a page size per unit: 5 to 5000 mm, 16 to 20000 px.</summary>
    public static (double Min, double Max) SizeLimits(string unit) => unit == "px" ? (16d, 20000d) : (5d, 5000d);

    /// <summary>
    /// "Größe ändern": a new page size (and unit) for every page of the design. With <paramref name="scale"/> the content of all pages grows or shrinks with the page and is centred
    /// (<see cref="DocumentResize"/>), otherwise it keeps its place. Saved as a new revision (so the old state stays in the history). Needs Edit.
    /// </summary>
    public static async Task<DesignSaved> ResizeAsync(Biz biz, long id, double width, double height, string? unit, bool scale)
    {
        await Access.RequireAsync(biz, ItemKind.Design, id, AccessLevel.Edit);
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

        var design = await biz.Db.Design.AsNoTracking().Where(d => d.Id == id).Select(d => new { d.Revision, d.DocumentJson }).FirstOrDefaultAsync() ?? throw new NotFoundException();
        var document = DocumentValidator.Parse(design.DocumentJson) ?? throw new BizException("Das Design ist beschädigt.");
        var resized = DocumentResize.Resize(document, width, height, kind, scale);
        var saved = await SaveDocumentAsync(biz, id, design.Revision, DocumentValidator.ToJson(resized));
        await biz.Log.LogAsync("Design: Größe geändert", nameof(Design), id, $"{Services.Fmt.Number((decimal)width, 1)} × {Services.Fmt.Number((decimal)height, 1)} {kind}{(scale ? ", Inhalt skaliert" : "")}");
        return saved;
    }

    public sealed record DesignInput(string Name, string? Category, string? Description, bool IsTemplate);

    /// <summary>Name, category and description need Edit; turning the design into a template (or back) needs Manage.</summary>
    public static async Task UpdatePropertiesAsync(Biz biz, long id, DesignInput input)
    {
        await Access.RequireAsync(biz, ItemKind.Design, id, AccessLevel.Edit);
        var design = await biz.Db.Design.FirstOrDefaultAsync(d => d.Id == id) ?? throw new NotFoundException();
        var name = (input.Name ?? "").Trim();
        if (name.Length == 0)
        {
            throw new BizException("Bitte gib den Namen ein.", "Input.Name");
        }

        if (design.IsTemplate != input.IsTemplate)
        {
            await Access.RequireAsync(biz, ItemKind.Design, id, AccessLevel.Manage);
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

    /// <summary>A copy of a design (viewing it is enough): next to the original when the person may write there, else in their personal area. The copy is not a template.</summary>
    public static async Task<Design> DuplicateAsync(Biz biz, long id)
    {
        await Access.RequireAsync(biz, ItemKind.Design, id, AccessLevel.View);
        var source = await biz.Db.Design.AsNoTracking().Where(d => d.Id == id).Select(d => new { d.SpaceId, d.FolderId }).FirstOrDefaultAsync() ?? throw new NotFoundException();
        var (space, folder) = await Access.CopyTargetAsync(biz, source.SpaceId, source.FolderId);
        var copy = await DuplicateToAsync(biz, id, space, folder, true);
        await ItemLogic.VisitAsync(biz, ItemKind.Design, copy.Id);
        return copy;
    }

    /// <summary>A copy of a design (viewing it is enough) in a given place the caller checked: the area and folder. <paramref name="markAsCopy"/> adds " (Kopie)" to the name.</summary>
    internal static async Task<Design> DuplicateToAsync(Biz biz, long id, long space, long? folder, bool markAsCopy)
    {
        await Access.RequireAsync(biz, ItemKind.Design, id, AccessLevel.View);
        var source = await biz.Db.Design.AsNoTracking().FirstOrDefaultAsync(d => d.Id == id) ?? throw new NotFoundException();
        var copy = new Design
        {
            Name = Clip(markAsCopy ? source.Name + " (Kopie)" : source.Name, 200),
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
            SpaceId = space,
            FolderId = folder,
        };
        copy.Revisions.Add(new DesignRevision { Revision = 1, DocumentJson = copy.DocumentJson });
        biz.Db.Design.Add(copy);
        await biz.Db.SaveChangesAsync();
        await AssetRefs.CopyAsync(biz.Db, ItemKind.Design, id, copy.Id);
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Design dupliziert", nameof(Design), copy.Id, $"{copy.Name} (aus {id})");
        return copy;
    }

    /// <summary>Changes only the name (the designer's title field); the revision of the document stays. Needs Edit.</summary>
    public static async Task<string> RenameAsync(Biz biz, long id, string? name)
    {
        await Access.RequireAsync(biz, ItemKind.Design, id, AccessLevel.Edit);
        var clean = Clip((name ?? "").Trim(), 200);
        if (clean.Length == 0)
        {
            throw new BizException("Bitte gib den Namen ein.", "Input.Name");
        }

        var design = await biz.Db.Design.FirstOrDefaultAsync(d => d.Id == id) ?? throw new NotFoundException();
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
    /// original; the document is validated and normalised like any save. Viewing the original is enough; the copy goes next to it when the person may write there, else into their personal area.
    /// </summary>
    public static async Task<Design> CopyWithDocumentAsync(Biz biz, long id, string? documentJson)
    {
        await Access.RequireAsync(biz, ItemKind.Design, id, AccessLevel.View);
        var result = DocumentValidator.Validate(documentJson);
        if (!result.Ok || result.Document is null || result.Json is null)
        {
            throw new BizException(result.Error ?? "Das Dokument ist ungültig.");
        }

        var source = await biz.Db.Design.AsNoTracking().FirstOrDefaultAsync(d => d.Id == id) ?? throw new NotFoundException();
        var keys = AssetRefs.KeysOf(result.Document);
        await AssetRefs.RequireUsableAsync(biz, keys, await AssetRefs.StoredAsync(biz.Db, ItemKind.Design, id));
        var (space, folder) = await Access.CopyTargetAsync(biz, source.SpaceId, source.FolderId);
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
            SpaceId = space,
            FolderId = folder,
        };
        copy.Revisions.Add(new DesignRevision { Revision = 1, DocumentJson = copy.DocumentJson });
        biz.Db.Design.Add(copy);
        await biz.Db.SaveChangesAsync();
        await AssetRefs.SyncAsync(biz.Db, ItemKind.Design, copy.Id, keys);
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("Design als Kopie gespeichert", nameof(Design), copy.Id, $"{copy.Name} (aus {id})");
        return copy;
    }

    /// <summary>
    /// Deletes a design: one of an area goes to the trash (the people who manage it can bring it back for the days the platform keeps the trash), a system template is deleted softly at
    /// once (an administrator). Needs Manage.
    /// </summary>
    public static async Task DeleteAsync(Biz biz, long id)
    {
        await Access.RequireAsync(biz, ItemKind.Design, id, AccessLevel.Manage);
        var design = await biz.Db.Design.FirstOrDefaultAsync(d => d.Id == id) ?? throw new NotFoundException();
        if (design.SpaceId is null)
        {
            design.ThumbnailPng = null;
            design.ThumbnailHash = null;
            biz.Db.Design.Remove(design);
            await biz.Db.SaveChangesAsync();
        }
        else
        {
            await ItemLogic.TrashAsync(biz, [new ItemRef(ItemKind.Design, id)]);
        }

        await biz.Log.LogAsync("Design gelöscht", nameof(Design), id, design.Name);
    }

    private static string? Clean(string? text, int max)
    {
        var t = (text ?? "").Trim();
        return t.Length == 0 ? null : Clip(t, max);
    }

    private static string Clip(string text, int max) => text.Length > max ? text[..max] : text;

    // ------------------------------------------------------------------------------------------------ the document (API of the designer)

    /// <summary>What the designer loads; null when the design does not exist or the person may not see it.</summary>
    public static async Task<DesignLoaded?> LoadAsync(Biz biz, long id)
    {
        var level = await Access.LevelAsync(biz, ItemKind.Design, id);
        if (level == AccessLevel.None)
        {
            return null;
        }

        var design = await biz.Db.Design.AsNoTracking().Where(d => d.Id == id).Select(d => new { d.Id, d.Name, d.Revision, d.DocumentJson, d.SpaceId, d.FolderId }).FirstOrDefaultAsync();
        if (design is null)
        {
            return null;
        }

        return new DesignLoaded(design.Id, design.Name, design.Revision, DocumentValidator.Current(design.DocumentJson), level >= AccessLevel.Edit, level >= AccessLevel.Manage, design.SpaceId, design.FolderId);
    }

    /// <summary>
    /// Saves a document: validated and normalised by the Core, the revision bumped, the state written to the history (the newest 30 stay). Needs Edit. An image key that the document did not
    /// use before must be one the person may use (<see cref="AssetRefs.RequireUsableAsync"/>); the keys of the document are stored with the design.
    /// A stale revision throws <see cref="RevisionConflictException"/>; an invalid document a <see cref="BizException"/>.
    /// </summary>
    public static async Task<DesignSaved> SaveDocumentAsync(Biz biz, long id, int revision, string? documentJson, bool autosave = false)
    {
        await Access.RequireAsync(biz, ItemKind.Design, id, AccessLevel.Edit);
        var result = DocumentValidator.Validate(documentJson);
        if (!result.Ok || result.Document is null || result.Json is null)
        {
            throw new BizException(result.Error ?? "Das Dokument ist ungültig.");
        }

        // saves of one design take turns: the second of two at the same moment reads the new revision and gets the ordinary conflict (not a unique-index error)
        await using var turn = await ItemLock.AcquireAsync(biz.Db, ItemKind.Design, id);
        var design = await biz.Db.Design.FirstOrDefaultAsync(d => d.Id == id) ?? throw new NotFoundException();
        if (design.Revision != revision)
        {
            throw new RevisionConflictException(design.Revision);
        }

        var keys = AssetRefs.KeysOf(result.Document);
        await AssetRefs.RequireUsableAsync(biz, keys, await AssetRefs.StoredAsync(biz.Db, ItemKind.Design, id));

        design.Revision++;
        design.DocumentJson = result.Json;
        design.Width = result.Document.Width;
        design.Height = result.Document.Height;
        design.Unit = result.Document.Unit;
        await AssetRefs.SyncAsync(biz.Db, ItemKind.Design, id, keys);
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

        await turn.CommitAsync();
        var oldest = design.Revision - KeptRevisions;
        if (oldest > 0)
        {
            await biz.Db.DesignRevision.Where(r => r.DesignId == id && r.Revision <= oldest).ExecuteDeleteAsync();
        }

        await ItemLogic.VisitAsync(biz, ItemKind.Design, id);
        return new DesignSaved(design.Revision, result.Json, result.Warnings);
    }

    /// <summary>The earlier states of a design (the history). The person must be allowed to view it.</summary>
    public static async Task<List<DesignRevisionRow>> RevisionsAsync(Biz biz, long id)
    {
        await Access.RequireAsync(biz, ItemKind.Design, id, AccessLevel.View);
        return await (from r in biz.Db.DesignRevision.AsNoTracking()
                      where r.DesignId == id
                      join u in biz.Db.User.AsNoTracking() on r.CreateUserId equals u.Id into users
                      from u in users.DefaultIfEmpty()
                      orderby r.Revision descending
                      select new DesignRevisionRow(r.Revision, r.CreateDate, u == null ? null : u.DisplayName)).ToListAsync();
    }

    /// <summary>Makes an earlier state the current one (as a new revision, so nothing is lost). Needs Edit.</summary>
    public static async Task<DesignSaved> RestoreAsync(Biz biz, long id, int revision)
    {
        await Access.RequireAsync(biz, ItemKind.Design, id, AccessLevel.Edit);
        var json = await biz.Db.DesignRevision.AsNoTracking().Where(r => r.DesignId == id && r.Revision == revision).Select(r => r.DocumentJson).FirstOrDefaultAsync()
            ?? throw new BizException("Diesen Stand gibt es nicht mehr.");
        var current = await biz.Db.Design.AsNoTracking().Where(d => d.Id == id).Select(d => (int?)d.Revision).FirstOrDefaultAsync() ?? throw new NotFoundException();
        var saved = await SaveDocumentAsync(biz, id, current, json);
        await biz.Log.LogAsync("Design wiederhergestellt", nameof(Design), id, $"Stand {revision}");
        return saved;
    }

    // ------------------------------------------------------------------------------------------------ thumbnails

    public static async Task SaveThumbnailAsync(Biz biz, long id, byte[] png)
    {
        await Access.RequireAsync(biz, ItemKind.Design, id, AccessLevel.Edit);
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
            throw new NotFoundException();
        }
    }

    /// <summary>
    /// The thumbnail of a design. The address with its hash (<paramref name="version"/>, at least 12 hex characters) is a capability that serves signed in or not (the APIs only hand it to people
    /// who may see the design, and the public pages need it); without it the person must be signed in and allowed to view the design. Null: 404.
    /// </summary>
    public static async Task<(byte[] Bytes, string Hash)?> ThumbnailAsync(Biz biz, long id, string? version = null)
    {
        var thumb = await biz.Db.Design.AsNoTracking().Where(d => d.Id == id && d.ThumbnailPng != null).Select(d => new { d.ThumbnailPng, d.ThumbnailHash }).FirstOrDefaultAsync();
        if (thumb is null)
        {
            return null;
        }

        var hash = thumb.ThumbnailHash ?? "";
        var capability = version is { Length: >= 12 } v && hash.StartsWith(v, StringComparison.OrdinalIgnoreCase);
        if (!capability && (biz.User.UserId is null || await Access.LevelAsync(biz, ItemKind.Design, id) == AccessLevel.None))
        {
            return null;
        }

        return (thumb.ThumbnailPng!, hash);
    }

    public static async Task<string?> ThumbnailHashAsync(Biz biz, long id)
    {
        await Access.RequireAsync(biz, ItemKind.Design, id, AccessLevel.View);
        return await biz.Db.Design.AsNoTracking().Where(d => d.Id == id).Select(d => d.ThumbnailHash).FirstOrDefaultAsync();
    }
}
