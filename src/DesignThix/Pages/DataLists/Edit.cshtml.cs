using System.ComponentModel.DataAnnotations;
using DesignThix.Core.Data;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace DesignThix.Pages.DataLists;

/// <summary>A column as the form posts it: the columns of a list are edited as a set.</summary>
public sealed class ColumnInput
{
    public string Key { get; set; } = "";

    public string? Label { get; set; }

    public string Type { get; set; } = "text";

    public int? Decimals { get; set; }

    public string? Category { get; set; }
}

/// <summary>
/// One data list in tabs: Allgemein, Spalten (key, label, type; or taken from a design), Zeilen (the grid of <c>datalist.js</c>) and Import/Export (CSV and
/// text pasted from Excel, with a preview and a mapping of the columns).
/// </summary>
[RequestSizeLimit(30_000_000)]
[RequestFormLimits(MultipartBodyLengthLimit = 30_000_000, ValueLengthLimit = 5_000_000)]
public sealed class EditModel(Biz biz) : PageModelBase
{
    public sealed class InputModel
    {
        [Required(ErrorMessage = "Bitte gib den Namen ein.")]
        [Display(Name = "Name")]
        public string Name { get; set; } = "";

        [Display(Name = "Beschreibung")]
        public string? Description { get; set; }

        public bool ContainsPersonalData { get; set; }
    }

    [BindProperty(SupportsGet = true)]
    public long? Id { get; set; }

    [BindProperty(SupportsGet = true)]
    public string? Tab { get; set; }

    [BindProperty]
    public InputModel Input { get; set; } = new();

    [BindProperty]
    public List<ColumnInput> Columns { get; set; } = [];

    [BindProperty]
    public long? DesignId { get; set; }

    [BindProperty]
    public IFormFile? CsvFile { get; set; }

    [BindProperty]
    public string? PasteText { get; set; }

    [BindProperty]
    public string? CsvText { get; set; }

    [BindProperty]
    public bool HasHeader { get; set; } = true;

    [BindProperty]
    public List<string> Mapping { get; set; } = [];

    [BindProperty]
    public string ImportMode { get; set; } = "append";

    public DataList? List { get; private set; }

    public int RowCount { get; private set; }

    public ImportPreview? Preview { get; private set; }

    public List<SelectListItem> DesignItems { get; private set; } = [];

    public List<SelectListItem> TypeItems { get; } =
    [
        new("Text", "text"), new("Mehrzeiliger Text", "multiline"), new("Zahl", "number"), new("Preis", "price"), new("Bild (Medium)", "image"),
    ];

    public List<SelectListItem> ModeItems { get; } = [new("Zeilen anhängen", "append"), new("Alle bisherigen Zeilen ersetzen", "replace")];

    public IReadOnlyList<string> Categories => AssetLogic.Categories;

    public bool CanEdit => biz.IsDesigner;

    public IReadOnlyList<ColumnDef> CurrentColumns => List is null ? [] : DataListLogic.ColumnsOf(List);

    // ------------------------------------------------------------------------------------------------ get

    public async Task<IActionResult> OnGetAsync()
    {
        if (!await LoadAsync())
        {
            return NotFound();
        }

        FillForms();
        return Page();
    }

    public async Task<IActionResult> OnGetExportAsync()
    {
        try
        {
            var (bytes, name) = await DataListLogic.ExportCsvAsync(biz, Id ?? 0);
            return File(bytes, "text/csv; charset=utf-8", name);
        }
        catch (BizException)
        {
            return NotFound();
        }
    }

    // ------------------------------------------------------------------------------------------------ post: general

    public async Task<IActionResult> OnPostGeneralAsync()
    {
        biz.RequireDesigner();
        if (!await LoadAsync())
        {
            return NotFound();
        }

        Tab = "general";
        FillColumnsOnly();
        if (!ModelState.IsValid)
        {
            return Page();
        }

        try
        {
            var saved = await DataListLogic.SaveGeneralAsync(biz, Id, new DataListLogic.ListInput(Input.Name, Input.Description, Input.ContainsPersonalData));
            Flash(Id is null ? "Die Datenliste ist angelegt. Lege jetzt die Spalten fest." : "Die Datenliste ist gespeichert.");
            return RedirectToPage("/DataLists/Edit", new { id = saved.Id, tab = Id is null ? "columns" : "general" });
        }
        catch (BizException ex)
        {
            ModelState.AddModelError(ex.Field ?? string.Empty, ex.Message);
            return Page();
        }
    }

    public async Task<IActionResult> OnPostDuplicateAsync()
    {
        try
        {
            var copy = await DataListLogic.DuplicateAsync(biz, Id ?? 0);
            Flash("Die Datenliste ist dupliziert.");
            return RedirectToPage("/DataLists/Edit", new { id = copy.Id });
        }
        catch (BizException ex)
        {
            FlashError(ex.Message);
            return RedirectToPage(new { id = Id });
        }
    }

    public async Task<IActionResult> OnPostDeleteAsync()
    {
        try
        {
            await DataListLogic.DeleteAsync(biz, Id ?? 0);
            Flash("Die Datenliste ist gelöscht.");
            return RedirectToPage("/DataLists/Index");
        }
        catch (BizException ex)
        {
            FlashError(ex.Message);
            return RedirectToPage(new { id = Id });
        }
    }

    // ------------------------------------------------------------------------------------------------ post: columns

    public async Task<IActionResult> OnPostColumnsAsync()
    {
        biz.RequireDesigner();
        ModelState.Clear();
        if (!await LoadAsync())
        {
            return NotFound();
        }

        Tab = "columns";
        FillGeneralOnly();
        try
        {
            var columns = Columns.Where(c => !string.IsNullOrWhiteSpace(c.Key) || !string.IsNullOrWhiteSpace(c.Label))
                .Select(c => ColumnDefs.Clean(c.Key?.Trim() ?? "", c.Label, c.Type, c.Decimals, c.Category)).ToList();
            await DataListLogic.SaveColumnsAsync(biz, Id ?? 0, columns);
            Flash("Die Spalten sind gespeichert.");
            return RedirectToPage(new { id = Id, tab = "columns" });
        }
        catch (BizException ex)
        {
            ModelState.AddModelError(string.Empty, ex.Message);
            return Page();
        }
    }

    public async Task<IActionResult> OnPostFromDesignAsync()
    {
        biz.RequireDesigner();
        if (DesignId is null)
        {
            FlashError("Bitte wähle ein Design aus.");
            return RedirectToPage(new { id = Id, tab = "columns" });
        }

        try
        {
            var added = await DataListLogic.AddColumnsFromDesignAsync(biz, Id ?? 0, DesignId ?? 0);
            Flash(added == 0 ? "Alle Felder des Designs sind schon Spalten dieser Liste." : added == 1 ? "Eine Spalte ist dazugekommen." : $"{added} Spalten sind dazugekommen.");
        }
        catch (BizException ex)
        {
            FlashError(ex.Message);
        }

        return RedirectToPage(new { id = Id, tab = "columns" });
    }

    // ------------------------------------------------------------------------------------------------ post: import

    public async Task<IActionResult> OnPostPreviewAsync()
    {
        biz.RequireDesigner();
        ModelState.Clear();
        if (!await LoadAsync())
        {
            return NotFound();
        }

        Tab = "import";
        FillGeneralOnly();
        FillColumnsOnly();
        try
        {
            string text;
            if (CsvFile is { Length: > 0 } file)
            {
                if (file.Length > 10_000_000)
                {
                    throw new BizException("Die Datei ist zu groß für einen Import (höchstens 10 MB).");
                }

                await using var stream = file.OpenReadStream();
                using var buffer = new MemoryStream();
                await stream.CopyToAsync(buffer, HttpContext.RequestAborted);
                text = TextDecoder.Decode(buffer.ToArray());
            }
            else
            {
                text = PasteText ?? "";
            }

            Preview = await DataListLogic.PreviewImportAsync(biz, Id ?? 0, text, HasHeader);
            CsvText = text;
            Mapping = [.. Preview.SuggestedMapping];
        }
        catch (BizException ex)
        {
            ModelState.AddModelError("CsvFile", ex.Message);
        }

        return Page();
    }

    public async Task<IActionResult> OnPostImportAsync()
    {
        biz.RequireDesigner();
        try
        {
            var count = await DataListLogic.ImportAsync(biz, Id ?? 0, new DataListLogic.ImportRequest(CsvText ?? "", HasHeader, Mapping, ImportMode == "replace"));
            Flash(count == 1 ? "Eine Zeile ist importiert." : $"{count} Zeilen sind importiert.");
            return RedirectToPage(new { id = Id, tab = "rows" });
        }
        catch (BizException ex)
        {
            FlashError(ex.Message);
            return RedirectToPage(new { id = Id, tab = "import" });
        }
    }

    // ------------------------------------------------------------------------------------------------ helpers

    private async Task<bool> LoadAsync()
    {
        if (Id is { } id)
        {
            List = await DataListLogic.GetAsync(biz, id);
            if (List is null)
            {
                return false;
            }

            RowCount = await DataListLogic.RowCountAsync(biz, id);
            DesignItems = [.. (await DesignLogic.ChoicesAsync(biz)).Select(c => new SelectListItem(string.IsNullOrEmpty(c.Detail) ? c.Name : $"{c.Name} ({c.Detail})", c.Id.ToString(System.Globalization.CultureInfo.InvariantCulture)))];
        }

        var title = List?.Name ?? "Neue Datenliste";
        Head(title, null, ("Daten", null), ("Datenlisten", "/DataLists"), (title, null));
        ViewData["ActiveHref"] = "/DataLists";
        ViewData["Width"] = Tab == "rows" ? "wide" : null;
        return true;
    }

    private void FillForms()
    {
        FillGeneralOnly();
        FillColumnsOnly();
    }

    private void FillGeneralOnly()
    {
        if (List is { } l && !ModelState.ContainsKey("Input.Name") && Input.Name == "")
        {
            Input = new InputModel { Name = l.Name, Description = l.Description, ContainsPersonalData = l.ContainsPersonalData };
        }
    }

    private void FillColumnsOnly()
    {
        if (Columns.Count == 0 && List is not null)
        {
            Columns = [.. CurrentColumns.Select(c => new ColumnInput { Key = c.Key, Label = c.Label, Type = c.Type, Decimals = c.Decimals, Category = c.Category })];
        }
    }
}
