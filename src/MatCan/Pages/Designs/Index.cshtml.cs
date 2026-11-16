using MatCan.Logic;
using MatCan.Services;
using MatCan.UiKit;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MatCan.Pages.Designs;

/// <summary>The designs as a gallery of thumbnails or a table. <c>?filter=templates</c> (the old menu item "Vorlagen") redirects to the page <c>/Templates</c>.</summary>
public sealed class IndexModel(Biz biz) : PageModelBase
{
    public ToolbarModel Toolbar { get; private set; } = null!;

    public PagerModel Pager { get; private set; } = null!;

    public TableModel Table { get; private set; } = null!;

    public IReadOnlyList<DesignRow> Items { get; private set; } = [];

    /// <summary>Everybody who is signed in may make things (in their own area), so the buttons that make something new are always there; what a person may do with one item is decided on its page.</summary>
    public bool CanEdit => true;

    public async Task<IActionResult> OnGetAsync()
    {
        // The old address of the menu item "Vorlagen" now is a page of its own.
        if (string.Equals(Request.Query["filter"], "templates", StringComparison.Ordinal))
        {
            var q = Request.Query["q"].ToString();
            return Redirect(string.IsNullOrWhiteSpace(q) ? "/Templates" : "/Templates?q=" + Uri.EscapeDataString(q));
        }

        Head("Designs", "Deine Etiketten, Karten, Flyer, Poster und Beiträge.", ("Gestalten", null), ("Designs", null));
        ViewData["ActiveHref"] = "/Designs";

        var categories = (await DesignLogic.CategoriesAsync(biz)).Select(c => new FilterOption(c, c)).ToList();
        var spec = new ListSpec<DesignRow>
        {
            Id = "designs",
            Action = "/Designs",
            Label = "Designs",
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
                await AreaFilter.CreateAsync<DesignRow>(biz, d => d.SpaceId),
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
        return Page();
    }
}
