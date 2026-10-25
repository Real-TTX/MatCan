using DesignThix.Core.Data;
using DesignThix.Logic;
using DesignThix.Services;
using DesignThix.UiKit;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Pages.DataLists;

/// <summary>The data lists: tables of values that fill the placeholders of a design, one label per row.</summary>
public sealed class IndexModel(Biz biz) : PageModelBase
{
    public ToolbarModel Toolbar { get; private set; } = null!;

    public PagerModel Pager { get; private set; } = null!;

    public TableModel Table { get; private set; } = null!;

    /// <summary>Everybody who is signed in may make things (in their own area), so the buttons that make something new are always there; what a person may do with one item is decided on its page.</summary>
    public bool CanEdit => true;

    public async Task OnGetAsync()
    {
        Head("Datenlisten", "Die Werte für deine Etiketten: eine Zeile pro Etikett.", ("Serien (Zusatz)", null), ("Datenlisten", null));

        var spec = new ListSpec<DataListRow>
        {
            Id = "datalists",
            Action = "/DataLists",
            Label = "Datenlisten",
            Noun = "Datenlisten",
            SearchPlaceholder = "Name oder Beschreibung ...",
            Search = (q, text) =>
            {
                var like = Like.Contains(text);
                return q.Where(l => EF.Functions.ILike(l.Name, like) || (l.Description != null && EF.Functions.ILike(l.Description, like)));
            },
            Filters = [new FilterSpec<DataListRow>("personen", "Personenbezogene Daten", [new("ja", "Enthält Personendaten"), new("nein", "Ohne Personendaten")], (q, v) => q.Where(l => l.ContainsPersonalData == (v == "ja")))],
            Sorts = new Dictionary<string, (string, Func<IQueryable<DataListRow>, bool, IOrderedQueryable<DataListRow>>)>
            {
                ["name"] = ("Name", (q, d) => d ? q.OrderByDescending(l => l.Name) : q.OrderBy(l => l.Name)),
                ["rows"] = ("Zeilen", (q, d) => d ? q.OrderByDescending(l => l.RowCount) : q.OrderBy(l => l.RowCount)),
                ["changed"] = ("Zuletzt geändert", (q, d) => d ? q.OrderByDescending(l => l.UpdateDate) : q.OrderBy(l => l.UpdateDate)),
            },
            DefaultSort = "name",
        };

        var result = await ListBuilder.RunAsync(DataListLogic.Query(biz), Request, spec, HttpContext.RequestAborted);
        Toolbar = result.Toolbar;
        Pager = result.Pager;
        Table = TableModel.Of("datalist-table", "Datenlisten", result.Items,
        [
            (new TableColumn("Datenliste"), l => Ui.NameWithSub(l.Name, $"/DataLists/Edit/{l.Id}", l.Description)),
            (new TableColumn("Zeilen", Numeric: true), l => Ui.Text(Fmt.Integer(l.RowCount))),
            (new TableColumn("Spalten", Numeric: true, HideOnPhone: true), l => Ui.Text(Fmt.Integer(ColumnDefs.Parse(l.ColumnsJson).Count))),
            (new TableColumn("Personendaten", HideOnPhone: true), l => l.ContainsPersonalData ? Ui.Pill("enthält Personendaten", "warn", "user") : Ui.None()),
            (new TableColumn("Geändert", HideOnPhone: true), l => Ui.Text(Fmt.Date(l.UpdateDate))),
        ],
        l => [new RowAction("edit", CanEdit ? "Bearbeiten" : "Ansehen", $"/DataLists/Edit/{l.Id}")]) with { EmptyIcon = "table", EmptyTitle = "Keine Datenlisten gefunden", EmptyText = "Lege eine Datenliste an oder ändere Suche und Filter." };
    }
}
