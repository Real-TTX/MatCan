using System.Text.Json;
using DesignThix.Core.Documents;
using DesignThix.Logic;
using Microsoft.AspNetCore.Mvc;

namespace DesignThix.Pages.Designs;

/// <summary>
/// The designer: the page is only the frame (top bar, panels, the empty canvas); the document is fetched by designer.js from <c>/api/designs/{id}</c> and saved
/// back with its revision. A viewer opens the same page read-only (no saving, panels disabled; the preview with data still works).
/// </summary>
public sealed class DesignerModel(Biz biz) : PageModelBase
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    [BindProperty(SupportsGet = true)]
    public long Id { get; set; }

    public DesignRow Design { get; private set; } = null!;

    public bool CanEdit => biz.IsDesigner;

    /// <summary>The format presets for the document panel, as JSON for the page (a data attribute, no inline script).</summary>
    public string PresetsJson { get; } = JsonSerializer.Serialize(
        FormatPresets.All.Select(p => new { key = p.Key, name = p.Name, group = p.Group, width = p.Width, height = p.Height, unit = p.Unit }), Web);

    public async Task<IActionResult> OnGetAsync()
    {
        var design = await DesignLogic.GetAsync(biz, Id);
        if (design is null)
        {
            return NotFound();
        }

        Design = design;
        Head(design.Name, null, ("Designs", "/Designs"), (design.Name, $"/Designs/{design.Id}"), ("Designer", null));
        return Page();
    }
}
