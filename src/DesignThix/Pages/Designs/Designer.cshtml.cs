using DesignThix.Logic;
using Microsoft.AspNetCore.Mvc;

namespace DesignThix.Pages.Designs;

/// <summary>
/// The editor: the page is only the frame (top bar, rail, panel, toolbar, page strip, the empty canvas); the document is fetched by designer.js from <c>/api/designs/{id}</c> and saved
/// back with its revision (autosave). A viewer opens the same page read-only (nothing editable; downloading and printing work).
/// </summary>
public sealed class DesignerModel(Biz biz) : PageModelBase
{
    [BindProperty(SupportsGet = true)]
    public long Id { get; set; }

    public DesignRow Design { get; private set; } = null!;

    public bool CanEdit => biz.IsDesigner;

    /// <summary>The button "Mit KI formulieren" is offered to people who may change the design, when the AI is switched on.</summary>
    public bool AiVisible => biz.IsDesigner && AiLogic.IsEnabled(biz);

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
