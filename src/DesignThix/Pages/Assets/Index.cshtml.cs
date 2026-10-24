using DesignThix.Logic;
using DesignThix.Services;
using DesignThix.UiKit;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Pages.Assets;

/// <summary>The media library: flags, seals, logos and photos, as a gallery of thumbnails or as a table.</summary>
public sealed class IndexModel(Biz biz) : PageModelBase
{
    public ToolbarModel Toolbar { get; private set; } = null!;

    public PagerModel Pager { get; private set; } = null!;

    public TableModel Table { get; private set; } = null!;

    public IReadOnlyList<AssetRow> Items { get; private set; } = [];

    public bool CanEdit => biz.IsDesigner;

    public async Task OnGetAsync()
    {
        Head("Medien", "Bilder für deine Designs: Flaggen, Siegel, Logos und Fotos. Sie werden über ihren Schlüssel angesprochen.", ("Bibliothek", null), ("Medien", null));

        var categories = AssetLogic.Categories.Union(await AssetLogic.UsedCategoriesAsync(biz)).Select(c => new FilterOption(c, c)).ToList();
        var spec = new ListSpec<AssetRow>
        {
            Id = "assets",
            Action = "/Assets",
            Label = "Medien",
            Noun = "Medien",
            SearchPlaceholder = "Name, Schlüssel oder Stichwort ...",
            PageSize = 24,
            Views = [new("gallery", "Kacheln", "grid"), new("list", "Tabelle", "list")],
            Search = (q, text) =>
            {
                var like = Like.Contains(text);
                return q.Where(a => EF.Functions.ILike(a.Name, like) || EF.Functions.ILike(a.Key, like) || EF.Functions.ILike(a.Tags, like));
            },
            Filters = [new FilterSpec<AssetRow>("kategorie", "Kategorie", categories, (q, v) => q.Where(a => a.Category == v))],
            Sorts = new Dictionary<string, (string, Func<IQueryable<AssetRow>, bool, IOrderedQueryable<AssetRow>>)>
            {
                ["name"] = ("Name", (q, d) => d ? q.OrderByDescending(a => a.Name) : q.OrderBy(a => a.Name)),
                ["key"] = ("Schlüssel", (q, d) => d ? q.OrderByDescending(a => a.Key) : q.OrderBy(a => a.Key)),
                ["category"] = ("Kategorie", (q, d) => d ? q.OrderByDescending(a => a.Category).ThenBy(a => a.Name) : q.OrderBy(a => a.Category).ThenBy(a => a.Name)),
                ["changed"] = ("Zuletzt geändert", (q, d) => d ? q.OrderByDescending(a => a.UpdateDate) : q.OrderBy(a => a.UpdateDate)),
                ["size"] = ("Dateigröße", (q, d) => d ? q.OrderByDescending(a => a.SizeBytes) : q.OrderBy(a => a.SizeBytes)),
            },
            DefaultSort = "name",
        };

        var result = await ListBuilder.RunAsync(AssetLogic.Query(biz), Request, spec, HttpContext.RequestAborted);
        Toolbar = result.Toolbar;
        Pager = result.Pager;
        Items = result.Items;
        Table = TableModel.Of("asset-table", "Medien", result.Items,
        [
            (new TableColumn("Medium"), a => LibraryUi.AssetCell(a, $"/Assets/Edit/{a.Id}")),
            (new TableColumn("Kategorie"), a => Ui.Text(a.Category)),
            (new TableColumn("Bildgröße", HideOnPhone: true), a => a.Width is { } w && a.Height is { } h ? Ui.Text($"{w} × {h} px") : Ui.None()),
            (new TableColumn("Dateigröße", Numeric: true, HideOnPhone: true), a => Ui.Text(Fmt.FileSize(a.SizeBytes))),
            (new TableColumn("Herkunft"), a => a.IsBuiltIn ? Ui.Pill("mitgeliefert", "plain") : Ui.Pill("eigenes", "accent")),
        ],
        a => [new RowAction("edit", CanEdit ? "Bearbeiten" : "Ansehen", $"/Assets/Edit/{a.Id}")]) with { EmptyIcon = "image", EmptyTitle = "Keine Medien gefunden", View = result.Items.Count == 0 ? null : "list" };
    }
}
