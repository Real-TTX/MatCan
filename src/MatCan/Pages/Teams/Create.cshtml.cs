using System.ComponentModel.DataAnnotations;
using MatCan.Logic;
using Microsoft.AspNetCore.Mvc;

namespace MatCan.Pages.Teams;

/// <summary>Makes a team: name, colour, description. The person becomes its Owner; the address (slug) is made from the name.</summary>
public sealed class CreateModel(Biz biz) : PageModelBase
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

    public IActionResult OnGet()
    {
        Prepare();
        return SpaceLogic.MayCreateTeam(biz) ? Page() : Forbid();
    }

    public async Task<IActionResult> OnPostAsync()
    {
        Prepare();
        if (!SpaceLogic.MayCreateTeam(biz))
        {
            return Forbid();
        }

        if (ModelState.IsValid)
        {
            try
            {
                var team = await SpaceLogic.CreateTeamAsync(biz, Input.Name, Input.Description, Input.Color);
                Flash($"Das Team „{team.Name}“ ist angelegt. Lade jetzt die Leute ein, mit denen du arbeitest.");
                return Redirect($"/Teams/{team.Slug}/Mitglieder");
            }
            catch (BizException ex)
            {
                ModelState.AddModelError(ex.Field ?? string.Empty, ex.Message);
            }
        }

        return Page();
    }

    private void Prepare()
    {
        Head("Team erstellen", null, ("Teams", "/Teams"), ("Team erstellen", null));
        ViewData["Width"] = "narrow";
        ViewData["ActiveHref"] = "/Teams";
    }
}
