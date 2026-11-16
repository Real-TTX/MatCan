using MatCan.Logic;
using Microsoft.AspNetCore.Mvc;

namespace MatCan.Pages.Fonts;

/// <summary>Uploads font files (TTF, OTF, WOFF, WOFF2). Family, weight and style are read from the file; they can be corrected afterwards.</summary>
[RequestSizeLimit(120_000_000)]
[RequestFormLimits(MultipartBodyLengthLimit = 120_000_000)]
public sealed class UploadModel(Biz biz) : PageModelBase
{
    [BindProperty]
    public List<IFormFile> Files { get; set; } = [];

    [BindProperty]
    public string? License { get; set; }

    public IReadOnlyList<FontUploadResult> Results { get; private set; } = [];

    public void OnGet() => Prepare();

    public async Task<IActionResult> OnPostAsync()
    {
        Prepare();
        var files = Files.Where(f => f.Length > 0).ToList();
        if (files.Count == 0)
        {
            ModelState.AddModelError("Files", "Bitte wähle mindestens eine Schriftdatei aus.");
            return Page();
        }

        var results = new List<FontUploadResult>();
        foreach (var file in files)
        {
            if (file.Length > FontLogic.MaxFontBytes)
            {
                results.Add(new FontUploadResult(file.FileName, null, $"Die Datei ist zu groß (höchstens {Services.Fmt.FileSize(FontLogic.MaxFontBytes)})."));
                continue;
            }

            await using var stream = file.OpenReadStream();
            using var buffer = new MemoryStream();
            await stream.CopyToAsync(buffer, HttpContext.RequestAborted);
            results.Add(await FontLogic.UploadAsync(biz, Path.GetFileName(file.FileName), buffer.ToArray(), License));
        }

        Results = results;
        var uploaded = results.Where(r => r.Font is not null).ToList();
        if (results.All(r => r.Error is null))
        {
            Flash(uploaded.Count == 1 ? "Die Schrift ist hochgeladen." : $"{uploaded.Count} Schriften sind hochgeladen.");
            return uploaded.Count == 1 ? RedirectToPage("/Fonts/Edit", new { id = uploaded[0].Font!.Id }) : RedirectToPage("/Fonts/Index");
        }

        if (uploaded.Count > 0)
        {
            Flash(uploaded.Count == 1 ? "Eine Schrift ist hochgeladen." : $"{uploaded.Count} Schriften sind hochgeladen.");
        }

        return Page();
    }

    private void Prepare()
    {
        Head("Schrift hochladen", "TTF, OTF, WOFF und WOFF2. Achte darauf, dass du die Schrift nutzen und weitergeben darfst.", ("Bibliothek", null), ("Schriften", "/Fonts"), ("Hochladen", null));
        ViewData["Width"] = "narrow";
        ViewData["ActiveHref"] = "/Fonts";
    }
}
