using DesignThix.UiKit;

namespace DesignThix.Pages.Teams;

/// <summary>The tab Marke of a team: the brand kit of the team area (the same control as /Brand). Every member looks, Owner and Admin change it; the editor uses it for the designs of the team.</summary>
public sealed class BrandModel(Logic.Biz biz) : TeamPageBase(biz)
{
    public BrandPageView View { get; private set; } = null!;

    public async Task OnGetAsync(string slug)
    {
        await LoadTeamAsync(slug, TeamTabs.Brand, "Marke");
        View = await BrandPageView.BuildAsync(Biz, Team.Id, CanAdmin, $"/Teams/{Team.Slug}/Projekte", "Die Marke des Teams ändern nur Inhaber und Admins. Du darfst sie ansehen und im Designer benutzen.");
    }
}
