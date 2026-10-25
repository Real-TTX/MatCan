using System.ComponentModel.DataAnnotations;
using DesignThix.Core.Documents;
using DesignThix.Logic;
using Microsoft.AspNetCore.Mvc;

namespace DesignThix.Pages.Designs;

/// <summary>The properties of a design (not the drawing): name, category, template switch; the fields it uses; the history. The designer opens from here.</summary>
public sealed class EditModel(Biz biz) : PageModelBase
{
    public sealed class InputModel
    {
        [Required(ErrorMessage = "Bitte gib den Namen ein.")]
        [Display(Name = "Name")]
        public string Name { get; set; } = "";

        [Display(Name = "Kategorie")]
        public string? Category { get; set; }

        [Display(Name = "Beschreibung")]
        public string? Description { get; set; }

        public bool IsTemplate { get; set; }
    }

    /// <summary>A field of the design with where it is used; <see cref="Defined"/> false means a placeholder without a field.</summary>
    public sealed record FieldView(string Key, string Label, string Type, string Sample, bool Defined, IReadOnlyList<string> Uses);

    [BindProperty(SupportsGet = true)]
    public long Id { get; set; }

    [BindProperty]
    public InputModel Input { get; set; } = new();

    [BindProperty(SupportsGet = true)]
    public string? Tab { get; set; }

    public DesignRow Design { get; private set; } = null!;

    public IReadOnlyList<FieldView> Fields { get; private set; } = [];

    public IReadOnlyList<DesignRevisionRow> Revisions { get; private set; } = [];

    public IReadOnlyList<string> Categories { get; private set; } = [];

    public bool CanEdit => biz.IsDesigner;

    public async Task<IActionResult> OnGetAsync()
    {
        if (!await LoadAsync())
        {
            return NotFound();
        }

        var d = Design;
        Input = new InputModel { Name = d.Name, Category = d.Category, Description = d.Description, IsTemplate = d.IsTemplate };
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
            await DesignLogic.UpdatePropertiesAsync(biz, Id, new DesignLogic.DesignInput(Input.Name, Input.Category, Input.Description, Input.IsTemplate));
            Flash("Das Design ist gespeichert.");
            return RedirectToPage(new { id = Id });
        }
        catch (BizException ex)
        {
            ModelState.AddModelError(ex.Field ?? string.Empty, ex.Message);
            return Page();
        }
    }

    /// <summary>"Exportieren": the design as a file with the media and fonts it uses (<c>.dtx.json</c>).</summary>
    public async Task<IActionResult> OnGetExportAsync()
    {
        try
        {
            var (bytes, name) = await DesignPackageLogic.ExportAsync(biz, Id);
            return File(bytes, "application/json", name);
        }
        catch (BizException)
        {
            return NotFound();
        }
    }

    public async Task<IActionResult> OnPostDuplicateAsync()
    {
        try
        {
            var copy = await DesignLogic.DuplicateAsync(biz, Id);
            Flash("Das Design ist dupliziert. Du siehst jetzt die Kopie.");
            return RedirectToPage(new { id = copy.Id });
        }
        catch (BizException ex)
        {
            FlashError(ex.Message);
            return RedirectToPage(new { id = Id });
        }
    }

    public async Task<IActionResult> OnPostRestoreAsync(int revision)
    {
        try
        {
            var saved = await DesignLogic.RestoreAsync(biz, Id, revision);
            Flash($"Stand {revision} ist wiederhergestellt (als neuer Stand {saved.Revision}).");
        }
        catch (BizException ex)
        {
            FlashError(ex.Message);
        }
        catch (RevisionConflictException)
        {
            FlashError("Jemand hat das Design gerade gespeichert. Bitte versuche es noch einmal.");
        }

        return RedirectToPage(new { id = Id, tab = "history" });
    }

    public async Task<IActionResult> OnPostDeleteAsync()
    {
        try
        {
            await DesignLogic.DeleteAsync(biz, Id);
            Flash("Das Design ist gelöscht.");
            return RedirectToPage("/Designs/Index");
        }
        catch (BizException ex)
        {
            FlashError(ex.Message);
            return RedirectToPage(new { id = Id });
        }
    }

    public static string TypeLabel(string type) => type switch
    {
        "multiline" => "Mehrzeiliger Text",
        "number" => "Zahl",
        "price" => "Preis",
        "image" => "Bild",
        _ => "Text",
    };

    public static string KindLabel(string kind) => kind switch
    {
        "image" => "Bild",
        "strip" => "Bildleiste",
        "showIf" => "Anzeigen, wenn gefüllt",
        "qr" => "QR-Code",
        "barcode" => "Strichcode",
        _ => "Text",
    };

    private async Task<bool> LoadAsync()
    {
        var design = await DesignLogic.GetAsync(biz, Id);
        if (design is null)
        {
            return false;
        }

        Design = design;
        var document = await DesignLogic.DocumentAsync(biz, Id);
        var usage = Placeholders.FieldsUsed(document).ToDictionary(u => u.Key, StringComparer.OrdinalIgnoreCase);
        var views = new List<FieldView>();
        foreach (var f in document.Fields)
        {
            var uses = usage.TryGetValue(f.Key, out var u) ? UseTexts(u) : [];
            views.Add(new FieldView(f.Key, f.Label, f.Type, f.Sample, true, uses));
        }

        foreach (var u in usage.Values.Where(u => !u.Defined))
        {
            views.Add(new FieldView(u.Key, "", "text", "", false, UseTexts(u)));
        }

        Fields = views;
        Revisions = await DesignLogic.RevisionsAsync(biz, Id);
        Categories = await DesignLogic.CategoriesAsync(biz);
        Head(design.Name, null, ("Gestalten", null), ("Designs", "/Designs"), (design.Name, null));
        ViewData["ActiveHref"] = "/Designs";
        return true;
    }

    private static List<string> UseTexts(FieldUsage usage)
        => [.. usage.Uses.Select(u => $"{(string.IsNullOrWhiteSpace(u.ElementName) ? u.ElementId : u.ElementName)} ({KindLabel(u.Kind)})")];
}
