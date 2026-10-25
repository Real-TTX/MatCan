using DesignThix.Logic;
using DesignThix.Services;
using DesignThix.UiKit;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Pages.Admin.Teams;

/// <summary>
/// Every team of the platform for the administrator: name, members, storage, when it was made. The administrator sees how big a team is and who is in it, never what it holds; to help a team
/// they can join it (the detail page).
/// </summary>
public sealed class IndexModel(Biz biz) : PageModelBase
{
    public ToolbarModel Toolbar { get; private set; } = null!;

    public PagerModel Pager { get; private set; } = null!;

    public TableModel Table { get; private set; } = null!;

    public async Task OnGetAsync()
    {
        Head("Teams", "Alle Teams der Plattform: Mitglieder und Speicherplatz.", ("Verwaltung", null), ("Teams", null));
        ViewData["ActiveHref"] = "/Admin/Teams";

        var spec = new ListSpec<SpaceLogic.AdminTeamRow>
        {
            Id = "adminteams",
            Action = "/Admin/Teams",
            Label = "Teams",
            Noun = "Teams",
            SearchPlaceholder = "Name des Teams ...",
            Search = (q, text) => q.Where(t => EF.Functions.ILike(t.Name, Like.Contains(text), "\\")),
            Sorts = new Dictionary<string, (string, Func<IQueryable<SpaceLogic.AdminTeamRow>, bool, IOrderedQueryable<SpaceLogic.AdminTeamRow>>)>
            {
                ["name"] = ("Name", (q, d) => d ? q.OrderByDescending(t => t.Name) : q.OrderBy(t => t.Name)),
                ["members"] = ("Mitglieder", (q, d) => d ? q.OrderByDescending(t => t.MemberCount).ThenBy(t => t.Name) : q.OrderBy(t => t.MemberCount).ThenBy(t => t.Name)),
                ["storage"] = ("Speicherplatz", (q, d) => d ? q.OrderByDescending(t => t.UsedBytes).ThenBy(t => t.Name) : q.OrderBy(t => t.UsedBytes).ThenBy(t => t.Name)),
                ["created"] = ("Erstellt", (q, d) => d ? q.OrderByDescending(t => t.Created) : q.OrderBy(t => t.Created)),
            },
            DefaultSort = "name",
        };

        var result = await ListBuilder.RunAsync(SpaceLogic.AdminTeams(biz), Request, spec, HttpContext.RequestAborted);
        Toolbar = result.Toolbar;
        Pager = result.Pager;
        var defaultQuota = biz.Platform.TeamQuotaMb * 1024L * 1024;
        Table = TableModel.Of("admin-teams", "Teams", result.Items,
        [
            (new TableColumn("Team"), t => Ui.NameWithSub(t.Name, $"/Admin/Teams/Details?id={t.Id}", t.Slug is null ? null : "/Teams/" + t.Slug)),
            (new TableColumn("Mitglieder", Numeric: true), t => Ui.Text(Fmt.Integer(t.MemberCount))),
            (new TableColumn("Speicherplatz"), t => Ui.Text($"{Fmt.FileSize(t.UsedBytes)} von {Fmt.FileSize(t.StorageQuotaBytes ?? defaultQuota)}")),
            (new TableColumn("Erstellt", HideOnPhone: true), t => Ui.Text(Fmt.Date(t.Created))),
        ],
        t => [new RowAction("eye", "Ansehen", $"/Admin/Teams/Details?id={t.Id}")]);
        Table = Table with { EmptyIcon = "users", EmptyTitle = "Keine Teams", EmptyText = "Es gibt noch keine Teams, oder die Suche findet keins." };
    }
}
