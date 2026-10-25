using DesignThix.Logic;
using Microsoft.AspNetCore.Mvc;

namespace DesignThix.Pages.Teams;

/// <summary>/Teams/{slug}: the team's own address leads to its first tab, the file browser of the team area.</summary>
public sealed class TeamModel(Biz biz) : PageModelBase
{
    public async Task<IActionResult> OnGetAsync(string slug)
    {
        var team = await SpaceLogic.GetBySlugAsync(biz, slug) ?? throw new NotFoundException();
        return Redirect($"/Teams/{team.Slug}/Projekte");
    }
}
