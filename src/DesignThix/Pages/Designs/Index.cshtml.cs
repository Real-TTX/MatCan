using DesignThix.Logic;
using DesignThix.Services;
using DesignThix.UiKit;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Pages.Designs;

/// <summary>The designs as a gallery of thumbnails or a table. <c>?filter=templates</c> is the menu item "Vorlagen".</summary>
public sealed class IndexModel(Biz biz) : PageModelBase
{
    public ToolbarModel Toolbar { get; private set; } = null!;

    public PagerModel Pager { get; private set; } = null!;

    public TableModel Table { get; private set; } = null!;

    public IReadOnlyList<DesignRow> Items { get; private set; } = [];

    public bool CanEdit => biz.IsDesigner;

    public bool TemplatesOnly { get; private set; }

    public async Task OnGetAsync()
    {
        TemplatesOnly = string.Equals(Request.Query["filter"], "templates", StringComparison.Ordinal);
        if (TemplatesOnly)
        {
            Head("Vorlagen", "Designs, die in „Neues Design“ als Startpunkt angeboten werden.", ("Gestalten", null), ("Vorlagen", null));
            ViewData["ActiveHref"] = "/Designs?filter=templates";
        }
        else
        {
            Head("Designs", "Deine Etiketten, Karten, Schilder und Plakate.", ("Gestalten", null), ("Designs", null));
            ViewData["ActiveHref"] = "/Designs";
        }

        var categories = (await DesignLogic.CategoriesAsync(biz)).Select(c => new FilterOption(c, c)).ToList();
        var spec = new ListSpec<DesignRow>
        {
            Id = "designs",
            Action = "/Designs",
            Label = TemplatesOnly ? "Vorlagen" : "Designs",
            Noun = "Designs",
            SearchPlaceholder = "Name, Kategorie oder Beschreibung ...",
            PageSize = 24,
            Views = [new("gallery", "Kacheln", "grid"), new("list", "Tabelle", "list")],
            Search = (q, text) =>
            {
                var like = Like.Contains(text);
                return q.Where(d => EF.Functions.ILike(d.Name, like) || (d.Category != null && EF.Functions.ILike(d.Category, like)) || (d.Description != null && EF.Functions.ILike(d.Description, like)));
            },
            Filters =
            [
                new FilterSpec<DesignRow>("filter", "Vorlagen", [new("templates", "Nur Vorlagen"), new("designs", "Ohne Vorlagen")], (q, v) => v == "templates" ? q.Where(d => d.IsTemplate) : q.Where(d => !d.IsTemplate)),
                new FilterSpec<DesignRow>("kategorie", "Kategorie", categories, (q, v) => q.Where(d => d.Category == v)),
            ],
            Sorts = new Dictionary<string, (string, Func<IQueryable<DesignRow>, bool, IOrderedQueryable<DesignRow>>)>
            {
                ["changed"] = ("Zuletzt geändert", (q, d) => d ? q.OrderByDescending(x => x.UpdateDate) : q.OrderBy(x => x.UpdateDate)),
                ["name"] = ("Name", (q, d) => d ? q.OrderByDescending(x => x.Name) : q.OrderBy(x => x.Name)),
            },
            DefaultSort = "changed",
            DefaultDescending = true,
        };

        var result = await ListBuilder.RunAsync(DesignLogic.Query(biz), Request, spec, HttpContext.RequestAborted);
        Toolbar = result.Toolbar;
        Pager = result.Pager;
        Items = result.Items;
        Table = TableModel.Of("design-table", "Designs", result.Items,
        [
            (new TableColumn("Design"), d => new Microsoft.AspNetCore.Html.HtmlString("<span class=\"dt-designcell\">" + LibraryUi.DesignThumb(d).ToHtml() + Ui.NameWithSub(d.Name, $"/Designs/Edit/{d.Id}", d.Size).ToHtml() + "</span>")),
            (new TableColumn("Kategorie", HideOnPhone: true), d => string.IsNullOrEmpty(d.Category) ? Ui.None() : Ui.Text(d.Category)),
            (new TableColumn("Vorlage"), d => d.IsTemplate ? Ui.Pill("Vorlage", "accent") : Ui.None()),
            (new TableColumn("Geändert", HideOnPhone: true), d => Ui.Text(Fmt.Date(d.UpdateDate))),
        ],
        d => [new RowAction("edit", CanEdit ? "Eigenschaften" : "Ansehen", $"/Designs/Edit/{d.Id}")]) with { EmptyIcon = "layers", EmptyTitle = "Keine Designs gefunden", View = result.Items.Count == 0 ? null : "list" };
    }
}
