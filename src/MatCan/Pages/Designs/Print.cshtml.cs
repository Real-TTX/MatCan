using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using MatCan.Controls;
using MatCan.Core.Documents;
using MatCan.Logic;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

namespace MatCan.Pages.Designs;

/// <summary>
/// Single print (Einzeldruck): a form made of the fields of a design, copies, and how to lay them out; "Drucken" or "PNG" opens the run page with the typed values.
/// Nothing is saved (no output job): the values travel through the sessionStorage of the browser. Everybody who is signed in may use it.
/// </summary>
public sealed class PrintModel(Biz biz) : PageModelBase
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    [BindProperty(SupportsGet = true)]
    public long Id { get; set; }

    public DesignRow Design { get; private set; } = null!;

    public IReadOnlyList<FieldDef> Fields { get; private set; } = [];

    public int Dpi { get; private set; } = 300;

    public List<SelectListItem> SheetItems { get; private set; } = [];

    public string SheetsJson { get; private set; } = "[]";

    public List<SelectListItem> ModeItems { get; } = [new("Ein Etikett pro Seite", "single"), new("Mehrere Etiketten auf einem Druckbogen", "sheet")];

    public List<SelectListItem> ScaleItems { get; } = [new("Verkleinern, bis es passt", "fit"), new("Nicht verkleinern", "none")];

    public async Task<IActionResult> OnGetAsync()
    {
        var design = await DesignLogic.GetAsync(biz, Id);
        if (design is null)
        {
            return RedirectToPage("/Share/NoAccess", new { kind = "design", id = Id });
        }

        ViewData["FontsHref"] = $"/fonts.css?design={Id}";
        Design = design;
        var document = await DesignLogic.DocumentAsync(biz, Id);
        Fields = document.Fields;
        Dpi = document.Dpi;
        var sheets = await SheetLogic.Query(biz).OrderBy(s => s.Name).ToListAsync();
        SheetItems = [.. sheets.Select(s => new SelectListItem(s.Name, s.Id.ToString(System.Globalization.CultureInfo.InvariantCulture)))];
        SheetsJson = JsonSerializer.Serialize(sheets.Select(s => new { id = s.Id, name = s.Name, paperWidth = s.PaperWidth, paperHeight = s.PaperHeight, marginTop = s.MarginTop, marginLeft = s.MarginLeft, columns = s.Columns, rows = s.Rows, cellWidth = s.CellWidth, cellHeight = s.CellHeight, gapX = s.GapX, gapY = s.GapY, cropMarks = s.CropMarks }), Web);
        Head($"Einzeldruck: {design.Name}", "Trage die Werte ein und drucke ein einzelnes Etikett, ohne eine Datenliste oder eine gespeicherte Serienausgabe.", ("Gestalten", null), ("Designs", "/Designs"), (design.Name, $"/Designs/Edit/{design.Id}"), ("Einzeldruck", null));
        ViewData["ActiveHref"] = "/Designs";
        ViewData["Width"] = "wide";
        return Page();
    }
}
