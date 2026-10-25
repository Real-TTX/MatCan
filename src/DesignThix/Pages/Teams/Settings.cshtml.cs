using System.ComponentModel.DataAnnotations;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.UiKit;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace DesignThix.Pages.Teams;

/// <summary>
/// The settings of a team (Owner and Admin): name, colour, description; and for the Owner the two serious things: hand the ownership to another member and delete the team (the name is typed to
/// confirm; the content goes to the trash of the team and is removed when the days of the trash are over).
/// </summary>
public sealed class SettingsModel(Biz biz) : TeamPageBase(biz)
{
    public sealed class InputModel
    {
        [Required(ErrorMessage = "Bitte gib dem Team einen Namen.")]
        [StringLength(120, ErrorMessage = "Der Name darf höchstens 120 Zeichen haben.")]
        [Display(Name = "Name")]
        public string Name { get; set; } = "";

        [Display(Name = "Farbe")]
        public string Color { get; set; } = "#1fb3d6";

        [StringLength(500, ErrorMessage = "Die Beschreibung darf höchstens 500 Zeichen haben.")]
        [Display(Name = "Beschreibung")]
        public string? Description { get; set; }
    }

    [BindProperty]
    public InputModel Input { get; set; } = new();

    [BindProperty]
    public string? ConfirmName { get; set; }

    [BindProperty]
    public long NewOwnerId { get; set; }

    public IReadOnlyList<SelectListItem> OtherMembers { get; private set; } = [];

    private async Task LoadAsync(string slug)
    {
        await LoadTeamAsync(slug, TeamTabs.Settings, "Einstellungen");
        if (!CanAdmin)
        {
            throw new ForbiddenException("Die Einstellungen sehen nur Inhaber und Admins des Teams.");
        }

        var me = Biz.UserId;
        OtherMembers = [.. (await SpaceLogic.MembersAsync(Biz, Team.Id)).Where(m => m.UserId != me && m.IsActive).Select(m => new SelectListItem($"{m.DisplayName} ({Labels.Of(m.Role)})", m.UserId.ToString()))];
    }

    public async Task OnGetAsync(string slug)
    {
        await LoadAsync(slug);
        Input = new InputModel { Name = Team.Name, Color = Team.Color, Description = Team.Description };
    }

    public async Task<IActionResult> OnPostAsync(string slug)
    {
        await LoadAsync(slug);
        ModelState.Remove(nameof(ConfirmName));
        if (ModelState.IsValid)
        {
            try
            {
                var team = await SpaceLogic.UpdateTeamAsync(Biz, Team.Id, Input.Name, Input.Description, Input.Color);
                Flash("Die Einstellungen sind gespeichert.");
                return Redirect($"/Teams/{team.Slug}/Einstellungen");
            }
            catch (BizException ex)
            {
                ModelState.AddModelError(ex.Field is null ? string.Empty : "Input." + ex.Field, ex.Message);
            }
        }

        return Page();
    }

    public async Task<IActionResult> OnPostTransferAsync(string slug)
    {
        await LoadAsync(slug);
        try
        {
            await SpaceLogic.TransferOwnershipAsync(Biz, Team.Id, NewOwnerId);
            Flash("Die Inhaberschaft ist übergeben. Du bist jetzt Admin im Team.");
        }
        catch (BizException ex)
        {
            FlashError(ex.Message);
        }

        return RedirectToPage(new { slug });
    }

    public async Task<IActionResult> OnPostDeleteAsync(string slug)
    {
        await LoadAsync(slug);
        try
        {
            await SpaceLogic.DeleteTeamAsync(Biz, Team.Id, ConfirmName);
            Flash($"Das Team „{Team.Name}“ ist gelöscht. Sein Inhalt wird nach {Biz.Platform.TrashDays} Tagen endgültig gelöscht.");
            return Redirect("/Teams");
        }
        catch (BizException ex)
        {
            FlashError(ex.Message);
            return RedirectToPage(new { slug });
        }
    }
}
