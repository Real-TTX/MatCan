using MatCan.Logic;

namespace MatCan.Pages.Teams;

/// <summary>"Teams": the teams of the person as tiles (name, colour, member avatars, storage) and "Team erstellen" where the platform allows it.</summary>
public sealed class IndexModel(Biz biz) : PageModelBase
{
    public IReadOnlyList<SpaceLogic.TeamTile> Tiles { get; private set; } = [];

    public bool MayCreate { get; private set; }

    public bool MayInvite { get; private set; }

    public async Task OnGetAsync()
    {
        Head("Teams", "Hier arbeitest du mit anderen zusammen: gemeinsame Projekte, eine gemeinsame Marke und Vorlagen.", ("Teams", null));
        ViewData["ActiveHref"] = "/Teams";
        Tiles = await SpaceLogic.MyTeamTilesAsync(biz);
        MayCreate = SpaceLogic.MayCreateTeam(biz);
        MayInvite = biz.IsAdmin || biz.Platform.MembersMayInvite;
    }
}
