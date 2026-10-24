using System.ComponentModel.DataAnnotations;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using Microsoft.AspNetCore.Mvc;

namespace DesignThix.Pages.Sheets;

/// <summary>One sheet layout with a live preview: the paper, the label cells, the crop marks.</summary>
public sealed class EditModel(Biz biz) : PageModelBase
{
    public sealed class InputModel
    {
        [Required(ErrorMessage = "Bitte gib den Namen ein.")]
        [Display(Name = "Name")]
        public string Name { get; set; } = "";

        [Display(Name = "Papierbreite (mm)")]
        public double PaperWidth { get; set; } = 210;

        [Display(Name = "Papierhöhe (mm)")]
        public double PaperHeight { get; set; } = 297;

        [Display(Name = "Rand oben (mm)")]
        public double MarginTop { get; set; }

        [Display(Name = "Rand links (mm)")]
        public double MarginLeft { get; set; }

        [Display(Name = "Spalten")]
        public int Columns { get; set; } = 2;

        [Display(Name = "Zeilen")]
        public int Rows { get; set; } = 4;

        [Display(Name = "Etikettbreite (mm)")]
        public double CellWidth { get; set; } = 99.1;

        [Display(Name = "Etiketthöhe (mm)")]
        public double CellHeight { get; set; } = 67.7;

        [Display(Name = "Abstand zwischen den Spalten (mm)")]
        public double GapX { get; set; }

        [Display(Name = "Abstand zwischen den Zeilen (mm)")]
        public double GapY { get; set; }

        public bool CropMarks { get; set; }
    }

    [BindProperty(SupportsGet = true)]
    public long? Id { get; set; }

    [BindProperty]
    public InputModel Input { get; set; } = new();

    public SheetLayout? Sheet { get; private set; }

    public bool CanEdit => biz.IsDesigner;

    public async Task<IActionResult> OnGetAsync()
    {
        if (!await LoadAsync())
        {
            return NotFound();
        }

        if (Sheet is { } s)
        {
            Input = new InputModel
            {
                Name = s.Name, PaperWidth = s.PaperWidth, PaperHeight = s.PaperHeight, MarginTop = s.MarginTop, MarginLeft = s.MarginLeft, Columns = s.Columns, Rows = s.Rows,
                CellWidth = s.CellWidth, CellHeight = s.CellHeight, GapX = s.GapX, GapY = s.GapY, CropMarks = s.CropMarks,
            };
        }

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
            var saved = await SheetLogic.SaveAsync(biz, Id, new SheetLogic.SheetInput(Input.Name, Input.PaperWidth, Input.PaperHeight, Input.MarginTop, Input.MarginLeft, Input.Columns, Input.Rows,
                Input.CellWidth, Input.CellHeight, Input.GapX, Input.GapY, Input.CropMarks));
            Flash(Id is null ? "Der Druckbogen ist angelegt." : "Der Druckbogen ist gespeichert.");
            return RedirectToPage("/Sheets/Edit", new { id = saved.Id });
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
            await SheetLogic.DeleteAsync(biz, Id ?? 0);
            Flash("Der Druckbogen ist gelöscht.");
            return RedirectToPage("/Sheets/Index");
        }
        catch (BizException ex)
        {
            FlashError(ex.Message);
            return RedirectToPage(new { id = Id });
        }
    }

    private async Task<bool> LoadAsync()
    {
        if (Id is { } id)
        {
            Sheet = await SheetLogic.GetAsync(biz, id);
            if (Sheet is null)
            {
                return false;
            }
        }

        var title = Sheet?.Name ?? "Neuer Druckbogen";
        Head(title, null, ("Ausgabe", null), ("Druckbögen", "/Sheets"), (title, null));
        ViewData["ActiveHref"] = "/Sheets";
        return true;
    }
}
