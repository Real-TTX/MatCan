using MatCan.Logic;
using MatCan.Services;
using MatCan.UiKit;
using Microsoft.AspNetCore.Mvc;

namespace MatCan.Pages.Admin.Teams;

/// <summary>
/// One team for the administrator: members with roles, storage and its limit. "Mir beitreten (Support)" makes the administrator an Admin of the team (the activity log says so, and the team sees it in its
/// member list); that is the only way the administrator gets to a team's content.
/// </summary>
public sealed class DetailsModel(Biz biz) : PageModelBase
{
    [BindProperty(SupportsGet = true)]
    public long Id { get; set; }

    [BindProperty]
    public long? QuotaMb { get; set; }

    public SpaceLogic.AdminTeamDetails Team { get; private set; } = null!;

    public async Task<IActionResult> OnGetAsync()
    {
        if (!await LoadAsync())
        {
            return NotFound();
        }

        QuotaMb = Team.Team.StorageQuotaBytes is { } bytes ? bytes / (1024 * 1024) : null;
        return Page();
    }

    private async Task<bool> LoadAsync()
    {
        var team = await SpaceLogic.AdminTeamAsync(biz, Id);
        if (team is null)
        {
            return false;
        }

        Team = team;
        Head(team.Team.Name, null, ("Verwaltung", null), ("Teams", "/Admin/Teams"), (team.Team.Name, null));
        ViewData["ActiveHref"] = "/Admin/Teams";
        ViewData["Width"] = "narrow";
        return true;
    }

    public async Task<IActionResult> OnPostJoinAsync()
    {
        try
        {
            await SpaceLogic.JoinAsSupportAsync(biz, Id);
            Flash("Du bist dem Team als Admin beigetreten. Das Team sieht dich in der Mitgliederliste; der Beitritt ist protokolliert.");
        }
        catch (BizException ex)
        {
            FlashError(ex.Message);
        }

        return RedirectToPage(new { id = Id });
    }

    public async Task<IActionResult> OnPostQuotaAsync()
    {
        try
        {
            if (QuotaMb is < 1)
            {
                throw new BizException("Der Speicherplatz muss mindestens 1 MB betragen (leer lassen für den Standard).");
            }

            await StorageLogic.SetQuotaAsync(biz, Id, QuotaMb is null ? null : QuotaMb.Value * 1024 * 1024);
            Flash(QuotaMb is null ? "Der Speicherplatz des Teams ist wieder der Standard der Plattform." : $"Der Speicherplatz des Teams ist auf {Fmt.Integer(QuotaMb.Value)} MB gesetzt.");
        }
        catch (BizException ex)
        {
            FlashError(ex.Message);
        }

        return RedirectToPage(new { id = Id });
    }
}
