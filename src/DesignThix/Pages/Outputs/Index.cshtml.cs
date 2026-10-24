using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.Services;
using DesignThix.UiKit;
using Microsoft.AspNetCore.Html;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Pages.Outputs;

/// <summary>The saved outputs (Ausgaben): which design prints which list, how, and when it ran last. "Ausführen" opens the run page.</summary>
public sealed class IndexModel(Biz biz) : PageModelBase
{
    public ToolbarModel Toolbar { get; private set; } = null!;

    public PagerModel Pager { get; private set; } = null!;

    public TableModel Table { get; private set; } = null!;

    public bool CanEdit => biz.IsDesigner;

    public async Task OnGetAsync()
    {
        Head("Ausgaben", "Gespeicherte Druckaufträge: ein Design, eine Datenliste, ein Layout. Ausführen heißt drucken oder als PNG herunterladen.", ("Ausgabe", null), ("Ausgaben", null));

        var designs = (await DesignLogic.ChoicesAsync(biz)).Select(c => new FilterOption(c.Id.ToString(System.Globalization.CultureInfo.InvariantCulture), c.Name)).ToList();
        var spec = new ListSpec<OutputRow>
        {
            Id = "outputs",
            Action = "/Outputs",
            Label = "Ausgaben",
            Noun = "Ausgaben",
            SearchPlaceholder = "Name der Ausgabe, des Designs oder der Liste ...",
            Search = (q, text) =>
            {
                var like = Like.Contains(text);
                return q.Where(o => EF.Functions.ILike(o.Name, like) || (o.DesignName != null && EF.Functions.ILike(o.DesignName, like)) || (o.DataListName != null && EF.Functions.ILike(o.DataListName, like)));
            },
            Filters =
            [
                new FilterSpec<OutputRow>("design", "Design", designs, (q, v) => long.TryParse(v, out var id) ? q.Where(o => o.DesignId == id) : q),
                new FilterSpec<OutputRow>("format", "Format", [new("Print", "Drucken / PDF"), new("Png", "PNG-ZIP")], (q, v) => q.Where(o => o.Format == (v == "Png" ? OutputFormat.Png : OutputFormat.Print))),
            ],
            Sorts = new Dictionary<string, (string, Func<IQueryable<OutputRow>, bool, IOrderedQueryable<OutputRow>>)>
            {
                ["changed"] = ("Zuletzt geändert", (q, d) => d ? q.OrderByDescending(o => o.UpdateDate) : q.OrderBy(o => o.UpdateDate)),
                ["lastrun"] = ("Zuletzt ausgeführt", (q, d) => d ? q.OrderByDescending(o => o.LastRunDate != null).ThenByDescending(o => o.LastRunDate) : q.OrderBy(o => o.LastRunDate != null).ThenBy(o => o.LastRunDate)),
                ["name"] = ("Name", (q, d) => d ? q.OrderByDescending(o => o.Name) : q.OrderBy(o => o.Name)),
            },
            DefaultSort = "changed",
            DefaultDescending = true,
        };

        var result = await ListBuilder.RunAsync(OutputLogic.Query(biz), Request, spec, HttpContext.RequestAborted);
        Toolbar = result.Toolbar;
        Pager = result.Pager;
        var counts = await OutputLogic.LabelCountsAsync(biz, result.Items);
        Table = TableModel.Of("output-table", "Ausgaben", result.Items,
        [
            (new TableColumn("Ausgabe"), o => Ui.NameWithSub(o.Name, $"/Outputs/Edit/{o.Id}", o.Format == OutputFormat.Png ? "Einzelne PNG-Bilder in einer ZIP-Datei" : o.Mode == OutputMode.Sheet ? "Mehrere Etiketten auf einem Druckbogen" : "Ein Etikett pro Seite")),
            (new TableColumn("Design", HideOnPhone: true), DesignCell),
            (new TableColumn("Datenliste", HideOnPhone: true), o => o.DataListId is null ? Ui.Concat(Ui.Text("Beispielwerte"), new HtmlString(" "), Ui.Pill("ohne Liste", "plain")) : o.DataListName is null ? Ui.Pill("gelöscht", "warn", "alert") : Ui.Link(o.DataListName, $"/DataLists/Edit/{o.DataListId}")),
            (new TableColumn("Etiketten", Numeric: true), o => CountCell(counts.GetValueOrDefault(o.Id))),
            (new TableColumn("Format", HideOnPhone: true), o => o.Format == OutputFormat.Png ? Ui.Pill($"PNG-ZIP · {o.Dpi} dpi", "info") : Ui.Pill("Drucken / PDF", "accent")),
            (new TableColumn("Zuletzt ausgeführt", HideOnPhone: true), o => o.LastRunDate is null ? Ui.Text("noch nie") : Ui.NameWithSub(Fmt.Moment(o.LastRunDate), null, o.LastRunUserName)),
        ],
        o => [new RowAction("play", "Ausführen", $"/Outputs/{o.Id}/Run"), new RowAction("edit", CanEdit ? "Bearbeiten" : "Ansehen", $"/Outputs/Edit/{o.Id}")]) with { EmptyIcon = "dashboard", EmptyTitle = "Keine Ausgaben gefunden", EmptyText = "Lege eine Ausgabe an oder ändere Suche und Filter." };
    }

    private static IHtmlContent CountCell(OutputLogic.LabelCount? count)
        => count is null
            ? Ui.None()
            : new HtmlString($"{Fmt.Integer(count.Labels)}" + (count.Rows is { } rows ? $"<small class=\"mat-muted dt-sub\">aus {Ui.CountNoun(rows, "Zeilen")}</small>" : ""));

    private static IHtmlContent DesignCell(OutputRow o)
    {
        if (o.DesignName is null)
        {
            return Ui.Pill("gelöscht", "warn", "alert");
        }

        var thumb = o.DesignThumbnailUrl is { } url
            ? $"<span class=\"dt-designthumb\"><img src=\"{System.Net.WebUtility.HtmlEncode(url)}\" alt=\"\" loading=\"lazy\" decoding=\"async\" /></span>"
            : $"<span class=\"dt-designthumb\" data-dt-preview=\"{o.DesignId}\" data-dt-preview-url=\"/api/designs/{o.DesignId}\" aria-hidden=\"true\"></span>";
        return new HtmlString("<span class=\"dt-designcell\">" + thumb + Ui.NameWithSub(o.DesignName, $"/Designs/Edit/{o.DesignId}", null).ToHtml() + "</span>");
    }
}
