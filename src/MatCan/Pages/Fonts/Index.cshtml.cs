using MatCan.Logic;
using MatCan.Services;
using MatCan.UiKit;
using Microsoft.EntityFrameworkCore;

namespace MatCan.Pages.Fonts;

/// <summary>The fonts of the library, each with a line set in that font (the style sheet /fonts.css makes the families known to the page).</summary>
public sealed class IndexModel(Biz biz) : PageModelBase
{
    public ToolbarModel Toolbar { get; private set; } = null!;

    public PagerModel Pager { get; private set; } = null!;

    public TableModel Table { get; private set; } = null!;

    /// <summary>Everybody who is signed in may make things (in their own area), so the buttons that make something new are always there; what a person may do with one item is decided on its page.</summary>
    public bool CanEdit => true;

    public async Task OnGetAsync()
    {
        Head("Schriften", "Die Schriften, die deine Designs benutzen können. Sie werden von MatCan selbst geliefert, nichts kommt aus dem Internet.", ("Bibliothek", null), ("Schriften", null));

        var spec = new ListSpec<FontRow>
        {
            Id = "fonts",
            Action = "/Fonts",
            Label = "Schriften",
            Noun = "Schriften",
            SearchPlaceholder = "Name der Schrift ...",
            Search = (q, text) => q.Where(f => EF.Functions.ILike(f.Family, Like.Contains(text)) || EF.Functions.ILike(f.License, Like.Contains(text))),
            Filters =
            [
                new FilterSpec<FontRow>("herkunft", "Herkunft", [new("mitgeliefert", "Mitgeliefert"), new("eigene", "Eigene")], (q, v) => v == "eigene" ? q.Where(f => !f.IsBuiltIn) : q.Where(f => f.IsBuiltIn)),
                new FilterSpec<FontRow>("stil", "Stil", [new("normal", "Normal"), new("italic", "Kursiv")], (q, v) => q.Where(f => f.Style == v)),
                await AreaFilter.CreateAsync<FontRow>(biz, f => f.SpaceId, withShared: false),
            ],
            Sorts = new Dictionary<string, (string, Func<IQueryable<FontRow>, bool, IOrderedQueryable<FontRow>>)>
            {
                ["family"] = ("Name", (q, d) => d ? q.OrderByDescending(f => f.Family).ThenBy(f => f.Style).ThenBy(f => f.Weight) : q.OrderBy(f => f.Family).ThenBy(f => f.Style).ThenBy(f => f.Weight)),
                ["size"] = ("Dateigröße", (q, d) => d ? q.OrderByDescending(f => f.SizeBytes) : q.OrderBy(f => f.SizeBytes)),
                ["changed"] = ("Zuletzt geändert", (q, d) => d ? q.OrderByDescending(f => f.UpdateDate) : q.OrderBy(f => f.UpdateDate)),
            },
            DefaultSort = "family",
            PageSize = 25,
        };

        var result = await ListBuilder.RunAsync(FontLogic.Query(biz), Request, spec, HttpContext.RequestAborted);
        Toolbar = result.Toolbar;
        Pager = result.Pager;
        Table = TableModel.Of("font-table", "Schriften", result.Items,
        [
            (new TableColumn("Schrift"), f => Ui.NameWithSub(f.Family, $"/Fonts/Edit/{f.Id}", FontLabel(f))),
            (new TableColumn("Beispiel"), f => LibraryUi.Specimen(f)),
            (new TableColumn("Format", HideOnPhone: true), f => Ui.Text(f.Format.ToUpperInvariant())),
            (new TableColumn("Größe", Numeric: true, HideOnPhone: true), f => Ui.Text(Fmt.FileSize(f.SizeBytes))),
            (new TableColumn("Lizenz", HideOnPhone: true), f => string.IsNullOrWhiteSpace(f.License) ? Ui.None() : Ui.Text(f.License)),
            (new TableColumn("Herkunft"), f => f.IsBuiltIn ? Ui.Pill("mitgeliefert", "plain") : Ui.Pill("eigene", "accent")),
        ],
        f => [new RowAction("edit", CanEdit ? "Bearbeiten" : "Ansehen", $"/Fonts/Edit/{f.Id}")]) with { EmptyIcon = "type", EmptyTitle = "Keine Schriften gefunden" };
    }

    public static string FontLabel(FontRow f) => $"{(f.Weight.Contains(' ') ? "variabel " + f.Weight : f.Weight)} · {(f.Style == "italic" ? "kursiv" : "normal")}";
}
