using DesignThix.Logic;
using DesignThix.Services;
using DesignThix.UiKit;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Pages.Templates;

/// <summary>
/// The gallery of templates (docs/PLAN-CANVA.md section 1.3), grouped by category, with the toolbar of the lists (search, category, sort). "Vorlage verwenden" copies a template
/// and opens the copy in the designer (designers and administrators; a viewer sees the button disabled), "Bearbeiten" opens the template itself.
/// </summary>
public sealed class IndexModel(Biz biz) : PageModelBase
{
    public ToolbarModel Toolbar { get; private set; } = null!;

    public PagerModel Pager { get; private set; } = null!;

    public IReadOnlyList<DesignRow> Items { get; private set; } = [];

    /// <summary>The items of this page grouped by category, in the order of the list ("Weitere" for a template without category).</summary>
    public IReadOnlyList<IGrouping<string, DesignRow>> Groups => [.. Items.GroupBy(d => string.IsNullOrEmpty(d.Category) ? "Weitere" : d.Category!)];

    public bool CanEdit => biz.IsDesigner;

    public async Task OnGetAsync()
    {
        Head("Vorlagen", "Fertige Entwürfe zum Anpassen: Du bekommst eine Kopie, die Vorlage bleibt, wie sie ist.", ("Gestalten", null), ("Vorlagen", null));
        ViewData["ActiveHref"] = "/Templates";

        var categories = (await DesignLogic.TemplateCategoriesAsync(biz)).Select(c => new FilterOption(c, c)).ToList();
        var spec = new ListSpec<DesignRow>
        {
            Id = "templates",
            Action = "/Templates",
            Label = "Vorlagen",
            Noun = "Vorlagen",
            SearchPlaceholder = "Name, Kategorie oder Beschreibung ...",
            PageSize = 48,
            Search = (q, text) =>
            {
                var like = Like.Contains(text);
                return q.Where(d => EF.Functions.ILike(d.Name, like, "\\") || (d.Category != null && EF.Functions.ILike(d.Category, like, "\\")) || (d.Description != null && EF.Functions.ILike(d.Description, like, "\\")));
            },
            Filters = [new FilterSpec<DesignRow>("kategorie", "Kategorie", categories, (q, v) => q.Where(d => d.Category == v))],
            Sorts = new Dictionary<string, (string, Func<IQueryable<DesignRow>, bool, IOrderedQueryable<DesignRow>>)>
            {
                ["category"] = ("Kategorie", (q, d) => d ? q.OrderByDescending(x => x.Category).ThenByDescending(x => x.Name) : q.OrderBy(x => x.Category).ThenBy(x => x.Name)),
                ["name"] = ("Name", (q, d) => d ? q.OrderByDescending(x => x.Name) : q.OrderBy(x => x.Name)),
                ["changed"] = ("Zuletzt geändert", (q, d) => d ? q.OrderByDescending(x => x.UpdateDate) : q.OrderBy(x => x.UpdateDate)),
            },
            DefaultSort = "category",
        };

        var result = await ListBuilder.RunAsync(DesignLogic.TemplateQuery(biz), Request, spec, HttpContext.RequestAborted);
        Toolbar = result.Toolbar;
        Pager = result.Pager;
        Items = result.Items;
    }
}
