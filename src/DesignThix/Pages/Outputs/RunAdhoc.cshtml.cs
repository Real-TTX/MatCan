using DesignThix.Logic;
using Microsoft.AspNetCore.Mvc;

namespace DesignThix.Pages.Outputs;

/// <summary>
/// The run page of a single print (<c>/Outputs/Run?design=5&amp;adhoc=token</c>): nothing is saved. The values the person typed wait in the sessionStorage of the browser
/// under the token; <c>output.js</c> posts them to <c>/api/outputs/adhoc</c> and renders the answer like any other run.
/// </summary>
public sealed class RunAdhocModel(Biz biz) : PageModelBase
{
    [BindProperty(SupportsGet = true, Name = "design")]
    public long DesignId { get; set; }

    public RunView View { get; private set; } = null!;

    public async Task<IActionResult> OnGetAsync()
    {
        biz.RequireSignedIn();
        var design = await DesignLogic.GetAsync(biz, DesignId);
        if (design is null)
        {
            return NotFound();
        }

        Head($"Einzeldruck: {design.Name}", null, ("Gestalten", null), ("Designs", "/Designs"), (design.Name, $"/Designs/{design.Id}"), ("Einzeldruck", null));
        View = new RunView(design.Name, "/api/outputs/adhoc", null, true, $"/Designs/{design.Id}/Print");
        return Page();
    }
}
