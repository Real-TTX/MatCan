using System.ComponentModel.DataAnnotations;
using DesignThix.Logic;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace DesignThix.Pages.Assets;

/// <summary>One medium: preview, key, name, category and tags; the file (replace it, see what it is); where it is used.</summary>
[RequestSizeLimit(60_000_000)]
[RequestFormLimits(MultipartBodyLengthLimit = 60_000_000)]
public sealed class EditModel(Biz biz) : PageModelBase
{
    public sealed class InputModel
    {
        [Required(ErrorMessage = "Bitte gib den Schlüssel ein.")]
        [Display(Name = "Schlüssel")]
        public string Key { get; set; } = "";

        [Required(ErrorMessage = "Bitte gib den Namen ein.")]
        [Display(Name = "Name")]
        public string Name { get; set; } = "";

        [Display(Name = "Kategorie")]
        public string Category { get; set; } = "Sonstiges";

        [Display(Name = "Stichwörter")]
        public string? Tags { get; set; }
    }

    [BindProperty(SupportsGet = true)]
    public long Id { get; set; }

    [BindProperty]
    public InputModel Input { get; set; } = new();

    [BindProperty]
    public IFormFile? NewFile { get; set; }

    [BindProperty(SupportsGet = true)]
    public string? Tab { get; set; }

    public AssetRow Asset { get; private set; } = null!;

    public AssetUsage Usage { get; private set; } = new([], []);

    public List<SelectListItem> CategoryItems { get; private set; } = [];

    /// <summary>The person manages the image (its area, or an administrator for a built-in one): only they change or delete it.</summary>
    public bool CanEdit { get; private set; }

    public async Task<IActionResult> OnGetAsync()
    {
        if (!await LoadAsync())
        {
            return NotFound();
        }

        Input = new InputModel { Key = Asset.Key, Name = Asset.Name, Category = Asset.Category, Tags = Asset.Tags };
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
            var message = "Das Medium ist gespeichert.";
            if (NewFile is { Length: > 0 } file)
            {
                await using var stream = file.OpenReadStream();
                using var buffer = new MemoryStream();
                await stream.CopyToAsync(buffer, HttpContext.RequestAborted);
                var replaced = await AssetLogic.ReplaceFileAsync(biz, Id, buffer.ToArray());
                message = replaced.Cleaned.Count > 0 ? "Das Medium ist gespeichert. Die neue Datei wurde bereinigt: " + string.Join(", ", replaced.Cleaned.Take(5)) + "." : "Das Medium ist gespeichert, die Datei ist ersetzt.";
            }

            await AssetLogic.UpdateAsync(biz, Id, new AssetLogic.AssetInput(Input.Key, Input.Name, Input.Category, Input.Tags));
            Flash(message);
            return RedirectToPage(new { id = Id, tab = Tab });
        }
        catch (BizException ex)
        {
            ModelState.AddModelError(ex.Field ?? string.Empty, ex.Message);
            Tab = ex.Field is null ? "file" : "general";
            return Page();
        }
    }

    public async Task<IActionResult> OnPostDeleteAsync()
    {
        try
        {
            await AssetLogic.DeleteAsync(biz, Id);
            Flash("Das Medium ist gelöscht.");
            return RedirectToPage("/Assets/Index");
        }
        catch (BizException ex)
        {
            FlashError(ex.Message);
            return RedirectToPage(new { id = Id });
        }
    }

    private async Task<bool> LoadAsync()
    {
        var asset = await AssetLogic.GetAsync(biz, Id);
        if (asset is null)
        {
            return false;
        }

        Asset = asset;
        CanEdit = await Access.LevelAsync(biz, Data.Entities.ItemKind.Asset, asset.Id) >= AccessLevel.Manage;
        Usage = await AssetLogic.UsageAsync(biz, asset.Key);
        var categories = AssetLogic.Categories.Union(await AssetLogic.UsedCategoriesAsync(biz));
        CategoryItems = [.. categories.Select(c => new SelectListItem(c, c))];
        Head(asset.Name, null, ("Bibliothek", null), ("Uploads & Medien", "/Assets"), (asset.Name, null));
        ViewData["Width"] = "narrow";
        ViewData["ActiveHref"] = "/Assets";
        return true;
    }
}
