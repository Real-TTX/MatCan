using DesignThix.Logic;
using DesignThix.UiKit;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Pages.Teams;

/// <summary>
/// The templates of a team: the designs of its area that are marked as templates. Every member may use one ("Vorlage verwenden" makes a copy), editors offer a design of the team as a template
/// ("Als Teamvorlage") or take it back. The templates of the team also show up in the gallery "Vorlagen" for its members.
/// </summary>
public sealed class TemplatesModel(Biz biz) : TeamPageBase(biz)
{
    public IReadOnlyList<DesignRow> Items { get; private set; } = [];

    public IReadOnlySet<long> Manageable { get; private set; } = new HashSet<long>();

    public IReadOnlyList<SelectListItem> Candidates { get; private set; } = [];

    public async Task OnGetAsync(string slug)
    {
        await LoadAsync(slug);
    }

    private async Task LoadAsync(string slug)
    {
        await LoadTeamAsync(slug, TeamTabs.Templates, "Vorlagen");
        Items = await SpaceLogic.TeamTemplates(Biz, Team.Id).OrderBy(d => d.Name).Take(200).ToListAsync();
        Manageable = await DesignLogic.ManageableAsync(Biz, Items.Select(d => d.Id));
        Candidates = CanEdit ? [.. (await DesignLogic.TemplateCandidatesAsync(Biz, Team.Id)).Select(c => new SelectListItem($"{c.Name} ({c.Detail})", c.Id.ToString()))] : [];
    }

    public async Task<IActionResult> OnPostAddAsync(string slug, long id)
    {
        await LoadTeamAsync(slug, TeamTabs.Templates, "Vorlagen");
        await DesignLogic.SetTemplateAsync(Biz, id, true);
        Flash("Das Design ist jetzt eine Vorlage des Teams.");
        return RedirectToPage(new { slug });
    }

    public async Task<IActionResult> OnPostRemoveAsync(string slug, long id)
    {
        await LoadTeamAsync(slug, TeamTabs.Templates, "Vorlagen");
        await DesignLogic.SetTemplateAsync(Biz, id, false);
        Flash("Das Design ist keine Vorlage mehr. Es bleibt im Team.");
        return RedirectToPage(new { slug });
    }
}
