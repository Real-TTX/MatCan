using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.UiKit;

namespace DesignThix.Pages.Brand;

/// <summary>
/// The brand kit (Marke) of the personal area: the colours, the three fonts and the logos that the designs of the person share. A person who is Owner or Admin of teams gets a switch to the brand
/// of each of them (the same control as the tab Marke of the team page).
/// </summary>
public sealed class IndexModel(Biz biz) : PageModelBase
{
    public BrandPageView View { get; private set; } = null!;

    /// <summary>The switch between "Meine Marke" and the teams the person may change the brand of; null when there are none.</summary>
    public LinkTabsModel? Switch { get; private set; }

    public async Task OnGetAsync()
    {
        Head("Marke", "Farben, Schriften und Logos deiner Marke: Sie stehen im Designer bereit, damit jedes Design gleich aussieht.", ("Bibliothek", null), ("Marke", null));
        View = await BrandPageView.BuildAsync(biz, null, true, "/", "Du darfst die Marke nur ansehen.");
        var teams = (await SpaceLogic.MyTeamsAsync(biz)).Where(t => t.MyRole is SpaceRole.Owner or SpaceRole.Admin).ToList();
        if (teams.Count > 0)
        {
            var tabs = new List<LinkTab> { new("mine", "Meine Marke", "/Brand", "user") };
            tabs.AddRange(teams.Select(t => new LinkTab("team-" + t.Slug, t.Name, $"/Teams/{t.Slug}/Marke", "users")));
            Switch = new LinkTabsModel("Marke von", tabs, "mine");
        }
    }
}
