using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.Services;
using DesignThix.UiKit;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Pages.Sheets;

/// <summary>The sheet layouts (Druckbögen): how many labels of which size sit on a sheet of paper.</summary>
public sealed class IndexModel(Biz biz) : PageModelBase
{
    public ToolbarModel Toolbar { get; private set; } = null!;

    public PagerModel Pager { get; private set; } = null!;

    public TableModel Table { get; private set; } = null!;

    public bool CanEdit => biz.IsDesigner;

    public async Task OnGetAsync()
    {
        Head("Druckbögen", "Wie die Etiketten auf dem Papier sitzen: Anzahl, Größe, Ränder und Abstände.", ("Ausgabe", null), ("Druckbögen", null));

        var spec = new ListSpec<SheetLayout>
        {
            Id = "sheets",
            Action = "/Sheets",
            Label = "Druckbögen",
            Noun = "Druckbögen",
            SearchPlaceholder = "Name des Druckbogens ...",
            Search = (q, text) => q.Where(s => EF.Functions.ILike(s.Name, Like.Contains(text))),
            Filters = [new FilterSpec<SheetLayout>("herkunft", "Herkunft", [new("mitgeliefert", "Mitgeliefert"), new("eigene", "Eigene")], (q, v) => v == "eigene" ? q.Where(s => !s.IsBuiltIn) : q.Where(s => s.IsBuiltIn))],
            Sorts = new Dictionary<string, (string, Func<IQueryable<SheetLayout>, bool, IOrderedQueryable<SheetLayout>>)>
            {
                ["name"] = ("Name", (q, d) => d ? q.OrderByDescending(s => s.Name) : q.OrderBy(s => s.Name)),
                ["cells"] = ("Etiketten pro Bogen", (q, d) => d ? q.OrderByDescending(s => s.Columns * s.Rows) : q.OrderBy(s => s.Columns * s.Rows)),
                ["changed"] = ("Zuletzt geändert", (q, d) => d ? q.OrderByDescending(s => s.UpdateDate) : q.OrderBy(s => s.UpdateDate)),
            },
            DefaultSort = "name",
        };

        var result = await ListBuilder.RunAsync(SheetLogic.Query(biz), Request, spec, HttpContext.RequestAborted);
        Toolbar = result.Toolbar;
        Pager = result.Pager;
        Table = TableModel.Of("sheet-table", "Druckbögen", result.Items,
        [
            (new TableColumn("Druckbogen"), s => Ui.NameWithSub(s.Name, $"/Sheets/Edit/{s.Id}", $"Papier {Mm(s.PaperWidth)} × {Mm(s.PaperHeight)} mm")),
            (new TableColumn("Raster", HideOnPhone: true), s => Ui.Text($"{s.Columns} × {s.Rows} = {s.Columns * s.Rows}")),
            (new TableColumn("Etikett"), s => Ui.Text($"{Mm(s.CellWidth)} × {Mm(s.CellHeight)} mm")),
            (new TableColumn("Schnittmarken", HideOnPhone: true), s => s.CropMarks ? Ui.Pill("ja", "ok") : Ui.Pill("nein", "plain")),
            (new TableColumn("Herkunft"), s => s.IsBuiltIn ? Ui.Pill("mitgeliefert", "plain") : Ui.Pill("eigener", "accent")),
        ],
        s => [new RowAction("edit", CanEdit ? "Bearbeiten" : "Ansehen", $"/Sheets/Edit/{s.Id}")]) with { EmptyIcon = "grid", EmptyTitle = "Keine Druckbögen gefunden" };
    }

    public static string Mm(double value) => Math.Round(value, 2).ToString("0.##", Fmt.Culture);
}
