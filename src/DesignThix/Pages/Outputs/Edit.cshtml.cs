using DesignThix.Logic;
using Microsoft.AspNetCore.Mvc;

namespace DesignThix.Pages.Outputs;

/// <summary>One output in tabs: Allgemein, Auswahl (which rows, how many copies), Layout (one label per page or a sheet) and Format (print/PDF or PNG).</summary>
public sealed class EditModel(Biz biz) : OutputFormPage(biz)
{
    [BindProperty(SupportsGet = true)]
    public long Id { get; set; }

    public async Task<IActionResult> OnGetAsync()
    {
        if (!await LoadAsync())
        {
            return RedirectToPage("/Share/NoAccess", new { kind = "outputjob", id = Id });
        }

        FillFrom(Job!);
        return Page();
    }

    public async Task<IActionResult> OnPostAsync()
    {
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
            var job = await OutputLogic.SaveAsync(Biz, Id, ToLogic());
            Flash("Die Serienausgabe ist gespeichert.");
            return RedirectToPage(new { id = job.Id });
        }
        catch (BizException ex)
        {
            ModelState.AddModelError(ex.Field ?? string.Empty, ex.Message);
            return Page();
        }
    }

    /// <summary>"Ausführen" saves what is on the page and opens the run page.</summary>
    public async Task<IActionResult> OnPostRunAsync()
    {
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
            var job = await OutputLogic.SaveAsync(Biz, Id, ToLogic());
            return Redirect($"/Outputs/{job.Id}/Run");
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
            await OutputLogic.DeleteAsync(Biz, Id);
            Flash("Die Serienausgabe ist gelöscht.");
            return RedirectToPage("/Outputs/Index");
        }
        catch (BizException ex)
        {
            FlashError(ex.Message);
            return RedirectToPage(new { id = Id });
        }
    }

    private async Task<bool> LoadAsync()
    {
        Job = await OutputLogic.GetAsync(Biz, Id);
        if (Job is null)
        {
            return false;
        }

        CanEdit = (await OutputLogic.PlaceAsync(Biz, Id)).CanEdit;
        await ItemLogic.VisitAsync(Biz, Data.Entities.ItemKind.OutputJob, Id);
        await PrepareAsync(Job.Name, Job.Name);
        return true;
    }
}
