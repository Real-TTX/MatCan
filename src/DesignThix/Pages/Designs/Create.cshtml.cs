using System.ComponentModel.DataAnnotations;
using DesignThix.Core.Documents;
using DesignThix.Logic;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace DesignThix.Pages.Designs;

/// <summary>A new design: from a format (preset or own size) or from a template, whose document is copied.</summary>
public sealed class CreateModel(Biz biz) : PageModelBase
{
    public const string CustomPreset = "custom";

    public sealed class InputModel
    {
        [Required(ErrorMessage = "Bitte gib den Namen ein.")]
        [Display(Name = "Name")]
        public string Name { get; set; } = "";

        [Display(Name = "Kategorie")]
        public string? Category { get; set; }

        [Display(Name = "Start")]
        public string Start { get; set; } = "format";

        [Display(Name = "Format")]
        public string PresetKey { get; set; } = "label-150x100";

        [Display(Name = "Breite")]
        public double? Width { get; set; } = 100;

        [Display(Name = "Höhe")]
        public double? Height { get; set; } = 100;

        [Display(Name = "Einheit")]
        public string Unit { get; set; } = "mm";

        [Display(Name = "Vorlage")]
        public long? TemplateId { get; set; }
    }

    [BindProperty]
    public InputModel Input { get; set; } = new();

    [BindProperty(SupportsGet = true)]
    public long? Template { get; set; }

    /// <summary>The key of a format tile (<c>?format=price-tag</c>, or <c>custom</c>): the link of a tile without script lands here with the format chosen.</summary>
    [BindProperty(SupportsGet = true)]
    public string? Format { get; set; }

    public List<SelectListItem> Presets { get; private set; } = [];

    public List<SelectListItem> Templates { get; private set; } = [];

    public List<SelectListItem> StartItems { get; } = [new("Leeres Design im gewählten Format", "format"), new("Aus Vorlage", "template")];

    public List<SelectListItem> Units { get; } = [new("Millimeter (mm)", "mm"), new("Pixel (px)", "px")];

    public IReadOnlyList<string> Categories { get; private set; } = [];

    public async Task OnGetAsync()
    {
        await PrepareAsync();
        if (!string.IsNullOrEmpty(Format) && (Format == CustomPreset || FormatPresets.Find(Format) is not null))
        {
            Input.Start = "format";
            Input.PresetKey = FormatPresets.Find(Format)?.Key ?? CustomPreset;
            Input.Name = FormatPresets.Find(Format) is { } chosen ? chosen.ShortName : "";
        }

        if (Template is { } id && Templates.Any(t => t.Value == id.ToString(System.Globalization.CultureInfo.InvariantCulture)))
        {
            Input.Start = "template";
            Input.TemplateId = id;
        }
    }

    public async Task<IActionResult> OnPostAsync()
    {
        biz.RequireDesigner();
        await PrepareAsync();
        var fromTemplate = Input.Start == "template";
        if (fromTemplate && Input.TemplateId is null)
        {
            ModelState.AddModelError("Input.TemplateId", "Bitte wähle eine Vorlage aus.");
        }

        if (!ModelState.IsValid)
        {
            return Page();
        }

        try
        {
            var preset = Input.PresetKey == CustomPreset ? null : Input.PresetKey;
            var design = await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign(Input.Name, Input.Category, fromTemplate ? null : preset, Input.Width, Input.Height, Input.Unit, fromTemplate ? Input.TemplateId : null));
            Flash("Das Design ist angelegt.");
            return Redirect($"/Designs/{design.Id}/Designer");
        }
        catch (BizException ex)
        {
            ModelState.AddModelError(ex.Field ?? string.Empty, ex.Message);
            return Page();
        }
    }

    private async Task PrepareAsync()
    {
        Head("Design erstellen", "Fange mit einem Format an oder kopiere eine Vorlage.", ("Gestalten", null), ("Designs", "/Designs"), ("Design erstellen", null));
        ViewData["Width"] = "narrow";
        ViewData["ActiveHref"] = "/Designs/Create";
        Presets = [.. FormatPresets.All.Select(p => new SelectListItem(p.Name, p.Key) { Group = new SelectListGroup { Name = p.Group } }), new SelectListItem("Eigene Größe ...", CustomPreset)];
        Templates = [.. (await DesignLogic.ChoicesAsync(biz, templatesOnly: true)).Select(c => new SelectListItem($"{c.Name} ({c.Detail})", c.Id.ToString(System.Globalization.CultureInfo.InvariantCulture)))];
        Categories = await DesignLogic.CategoriesAsync(biz);
    }
}
