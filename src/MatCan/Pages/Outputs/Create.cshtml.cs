using MatCan.Logic;
using Microsoft.AspNetCore.Mvc;

namespace MatCan.Pages.Outputs;

/// <summary>A new output. <c>?designId=</c> preselects the design (the "Serienausgabe" button of the designer links here).</summary>
public sealed class CreateModel(Biz biz) : OutputFormPage(biz)
{
    [BindProperty(SupportsGet = true)]
    public long? DesignId { get; set; }

    public async Task<IActionResult> OnGetAsync()
    {
        await PrepareAsync("Neue Serienausgabe", "Neue Serienausgabe");
        if (DesignId is { } id && DesignItems.Any(d => d.Value == id.ToString(System.Globalization.CultureInfo.InvariantCulture)))
        {
            var design = await DesignLogic.GetAsync(Biz, id);
            Input.DesignId = id;
            Input.Name = design is null ? "" : $"{design.Name} – Serienausgabe";
            Input.Dpi = (await DesignLogic.DocumentAsync(Biz, id)).Dpi;
        }

        return Page();
    }

    public async Task<IActionResult> OnPostAsync()
    {
        await PrepareAsync("Neue Serienausgabe", "Neue Serienausgabe");
        if (!ModelState.IsValid)
        {
            return Page();
        }

        try
        {
            var job = await OutputLogic.SaveAsync(Biz, null, ToLogic());
            Flash("Die Serienausgabe ist angelegt.");
            return RedirectToPage("/Outputs/Edit", new { id = job.Id });
        }
        catch (BizException ex)
        {
            ModelState.AddModelError(ex.Field ?? string.Empty, ex.Message);
            return Page();
        }
    }
}
