using DesignThix.Logic;
using Microsoft.AspNetCore.Mvc;

namespace DesignThix.Pages.Outputs;

/// <summary>What the body of the run page needs: the title, where the data comes from, where "Zurück" goes.</summary>
public sealed record RunView(string Title, string PayloadUrl, long? OutputId, bool Adhoc, string BackHref);

/// <summary>
/// The run page of a saved output (<c>/Outputs/{id}/Run</c>): the page only frames it, <c>output.js</c> renders every label in the browser. Everybody who is signed in
/// may run an output (a viewer too): the payload endpoint checks that again.
/// </summary>
public sealed class RunModel(Biz biz) : PageModelBase
{
    [BindProperty(SupportsGet = true)]
    public long Id { get; set; }

    public RunView View { get; private set; } = null!;

    public async Task<IActionResult> OnGetAsync()
    {
        biz.RequireSignedIn();
        var job = await OutputLogic.GetAsync(biz, Id);
        if (job is null)
        {
            return RedirectToPage("/Share/NoAccess", new { kind = "outputjob", id = Id });
        }

        Head(job.Name, null, ("Serien (Zusatz)", null), ("Serienausgaben", "/Outputs"), (job.Name, null));
        View = new RunView(job.Name, $"/api/outputs/{job.Id}/payload", job.Id, false, $"/Outputs/Edit/{job.Id}");
        return Page();
    }
}
