using System.ComponentModel.DataAnnotations;
using DesignThix.Logic;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace DesignThix.Pages.Fonts;

/// <summary>One font file: its family, weight and style (as the style sheet declares them), the licence, and a specimen.</summary>
public sealed class EditModel(Biz biz) : PageModelBase
{
    public sealed class InputModel
    {
        [Required(ErrorMessage = "Bitte gib den Namen der Schriftfamilie ein.")]
        [Display(Name = "Familie")]
        public string Family { get; set; } = "";

        [Required(ErrorMessage = "Bitte gib das Gewicht ein.")]
        [Display(Name = "Gewicht")]
        public string Weight { get; set; } = "400";

        [Display(Name = "Stil")]
        public string Style { get; set; } = "normal";

        [Display(Name = "Lizenz")]
        public string? License { get; set; }
    }

    [BindProperty(SupportsGet = true)]
    public long Id { get; set; }

    [BindProperty]
    public InputModel Input { get; set; } = new();

    public FontRow Font { get; private set; } = null!;

    public List<SelectListItem> Styles { get; } = [new("Normal", "normal"), new("Kursiv", "italic")];

    public bool CanEdit => biz.IsDesigner;

    public async Task<IActionResult> OnGetAsync()
    {
        if (!await LoadAsync())
        {
            return NotFound();
        }

        Input = new InputModel { Family = Font.Family, Weight = Font.Weight, Style = Font.Style, License = Font.License };
        return Page();
    }

    public async Task<IActionResult> OnPostAsync()
    {
        biz.RequireDesigner();
        if (!await LoadAsync())
        {
            return NotFound();
        }

        if (!ModelState.IsValid)
        {
            return Page();
        }

        try
        {
            await FontLogic.UpdateAsync(biz, Id, new FontLogic.FontInput(Input.Family, Input.Weight, Input.Style, Input.License));
            Flash("Die Schrift ist gespeichert.");
            return RedirectToPage(new { id = Id });
        }
        catch (BizException ex)
        {
            ModelState.AddModelError(ex.Field ?? string.Empty, ex.Message);
            return Page();
        }
    }

    public async Task<IActionResult> OnPostDeleteAsync()
    {
        try
        {
            await FontLogic.DeleteAsync(biz, Id);
            Flash("Die Schrift ist gelöscht. Designs, die sie benutzen, zeigen eine Ersatzschrift.");
            return RedirectToPage("/Fonts/Index");
        }
        catch (BizException ex)
        {
            FlashError(ex.Message);
            return RedirectToPage(new { id = Id });
        }
    }

    private async Task<bool> LoadAsync()
    {
        var font = await FontLogic.GetAsync(biz, Id);
        if (font is null)
        {
            return false;
        }

        Font = font;
        Head(font.Family, null, ("Bibliothek", null), ("Schriften", "/Fonts"), (font.Family, null));
        ViewData["Width"] = "narrow";
        ViewData["ActiveHref"] = "/Fonts";
        return true;
    }
}
