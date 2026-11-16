using MatCan.Data.Entities;
using MatCan.Logic;
using MatCan.UiKit;

namespace MatCan.Pages.Teams;

/// <summary>What the pages of one team have in common: the team of the address (a member's only: anybody else gets a 404), the role of the person, the head with the tabs.</summary>
public abstract class TeamPageBase(Biz biz) : PageModelBase
{
    protected Biz Biz { get; } = biz;

    public SpaceRow Team { get; private set; } = null!;

    public TeamHeaderModel Header { get; private set; } = null!;

    /// <summary>Owner or Admin: members, invitations, brand, templates and settings.</summary>
    public bool CanAdmin => Team.MyRole is SpaceRole.Owner or SpaceRole.Admin;

    public int TrashDays => Biz.Platform.TrashDays;

    public bool IsOwner => Team.MyRole == SpaceRole.Owner;

    /// <summary>Owner, Admin and Editor may create and change in the team area.</summary>
    public bool CanEdit => Team.MyRole is SpaceRole.Owner or SpaceRole.Admin or SpaceRole.Editor;

    protected async Task LoadTeamAsync(string slug, string tab, string title)
    {
        Team = await SpaceLogic.GetBySlugAsync(Biz, slug) ?? throw new NotFoundException();
        var storage = await StorageLogic.UsageAsync(Biz, Team.Id);
        Header = new TeamHeaderModel(Team, tab, await SpaceLogic.MemberNamesAsync(Biz, Team.Id, 5), storage);
        Head(title + " · " + Team.Name, null, ("Teams", "/Teams"), (Team.Name, TeamTabs.Projects == tab ? null : $"/Teams/{Team.Slug}/Projekte"), (title, null));
        ViewData["OwnHead"] = true;
        ViewData["ActiveHref"] = $"/Teams/{Team.Slug}/Projekte";
    }
}
