using DesignThix.Logic;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace DesignThix.Pages.Assets;

/// <summary>Uploads one or several images at once: the key of each comes from its file name, a key that is taken gets a suffix.</summary>
[RequestSizeLimit(250_000_000)]
[RequestFormLimits(MultipartBodyLengthLimit = 250_000_000)]
public sealed class UploadModel(Biz biz) : PageModelBase
{
    private const long MaxFileBytes = AssetLogic.MaxUploadFileBytes;

    [BindProperty]
    public List<IFormFile> Files { get; set; } = [];

    [BindProperty]
    public string Category { get; set; } = AssetLogic.UploadsCategory;

    public IReadOnlyList<AssetUploadResult> Results { get; private set; } = [];

    public List<SelectListItem> CategoryItems { get; private set; } = [];

    public async Task OnGetAsync() => await PrepareAsync();

    public async Task<IActionResult> OnPostAsync()
    {
        await PrepareAsync();
        var files = Files.Where(f => f.Length > 0 || !string.IsNullOrEmpty(f.FileName)).ToList();
        if (files.Count == 0)
        {
            ModelState.AddModelError("Files", "Bitte wähle mindestens ein Bild aus.");
            return Page();
        }

        var results = new List<AssetUploadResult>();
        foreach (var file in files)
        {
            if (file.Length > MaxFileBytes)
            {
                results.Add(new AssetUploadResult(file.FileName, null, $"Die Datei ist zu groß (höchstens {Services.Fmt.FileSize(MaxFileBytes)}).", []));
                continue;
            }

            await using var stream = file.OpenReadStream();
            using var buffer = new MemoryStream();
            await stream.CopyToAsync(buffer, HttpContext.RequestAborted);
            results.Add(await AssetLogic.UploadAsync(biz, Path.GetFileName(file.FileName), buffer.ToArray(), Category));
        }

        Results = results;
        var uploaded = results.Where(r => r.Asset is not null).ToList();
        var clean = results.All(r => r.Error is null && r.Cleaned.Count == 0);
        if (clean)
        {
            Flash(uploaded.Count == 1 ? "Das Bild ist hochgeladen." : $"{uploaded.Count} Bilder sind hochgeladen.");
            return uploaded.Count == 1 ? RedirectToPage("/Assets/Edit", new { id = uploaded[0].Asset!.Id }) : RedirectToPage("/Assets/Index");
        }

        if (uploaded.Count > 0)
        {
            Flash(uploaded.Count == 1 ? "Ein Bild ist hochgeladen." : $"{uploaded.Count} Bilder sind hochgeladen.");
        }

        return Page();
    }

    private async Task PrepareAsync()
    {
        Head("Medien hochladen", "PNG, JPEG, WebP, GIF und SVG. Der Schlüssel entsteht aus dem Dateinamen; du kannst ihn danach ändern.", ("Bibliothek", null), ("Uploads & Medien", "/Assets"), ("Hochladen", null));
        ViewData["Width"] = "narrow";
        ViewData["ActiveHref"] = "/Assets";
        var categories = AssetLogic.Categories.Union(await AssetLogic.UsedCategoriesAsync(biz));
        CategoryItems = [.. categories.Select(c => new SelectListItem(c, c, c == Category))];
    }
}
