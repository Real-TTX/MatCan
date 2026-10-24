using DesignThix.Logic;
using Microsoft.AspNetCore.Mvc;

namespace DesignThix.Pages.Designs;

/// <summary>Imports a design from a <c>.dtx.json</c> file (see <c>DesignPackageFormat</c>). Administrators and designers only (the page policy and the logic).</summary>
[RequestSizeLimit(60_000_000)]
[RequestFormLimits(MultipartBodyLengthLimit = 60_000_000)]
public sealed class ImportModel(Biz biz) : PageModelBase
{
    [BindProperty]
    public IFormFile? DesignFile { get; set; }

    public ImportResult? Result { get; private set; }

    public void OnGet() => Prepare();

    public async Task<IActionResult> OnPostAsync()
    {
        biz.RequireDesigner();
        Prepare();
        ModelState.Clear();
        if (DesignFile is not { Length: > 0 } file)
        {
            ModelState.AddModelError("DesignFile", "Bitte wähle eine Datei aus.");
            return Page();
        }

        if (file.Length > 50L * 1024 * 1024)
        {
            ModelState.AddModelError("DesignFile", "Die Datei ist zu groß (höchstens 50 MB).");
            return Page();
        }

        try
        {
            await using var stream = file.OpenReadStream();
            using var buffer = new MemoryStream();
            await stream.CopyToAsync(buffer, HttpContext.RequestAborted);
            Result = await DesignPackageLogic.ImportAsync(biz, buffer.ToArray());
        }
        catch (BizException ex)
        {
            ModelState.AddModelError("DesignFile", ex.Message);
        }

        return Page();
    }

    private void Prepare()
    {
        Head("Design importieren", "Lege ein Design aus einer exportierten Datei neu an.", ("Gestalten", null), ("Designs", "/Designs"), ("Importieren", null));
        ViewData["ActiveHref"] = "/Designs";
        ViewData["Width"] = "narrow";
    }
}
