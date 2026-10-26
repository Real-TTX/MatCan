using System.ComponentModel.DataAnnotations;
using DesignThix.Catalogs;
using DesignThix.Catalogs.Providers;
using DesignThix.Logic;
using Microsoft.AspNetCore.Mvc;

namespace DesignThix.Pages.Admin.Catalogs;

/// <summary>
/// One catalogue: on or off, its place among the tabs, the limits, safe search, the licences it lets through, for the folder catalogue the folder names; the key of a provider (stored encrypted, never
/// shown again) and a test search.
/// </summary>
public sealed class EditModel(Biz biz) : PageModelBase
{
    public sealed class InputModel
    {
        public bool Enabled { get; set; }

        [Range(-1000, 1000, ErrorMessage = "Die Reihenfolge ist eine Zahl zwischen -1000 und 1000.")]
        public int Order { get; set; }

        [Range(0, 1000, ErrorMessage = "Die Suchen pro Person und Minute müssen zwischen 0 und 1000 liegen.")]
        public int PerUserPerMinute { get; set; }

        [Range(0, 100000, ErrorMessage = "Die Anfragen pro Stunde müssen zwischen 0 und 100 000 liegen.")]
        public int PerHour { get; set; }

        public bool SafeSearch { get; set; } = true;

        public string? AllowedLicences { get; set; }

        public string? Folders { get; set; }

        public string? Key { get; set; }

        public bool RemoveKey { get; set; }
    }

    [BindProperty(SupportsGet = true)]
    public string? Id { get; set; }

    [BindProperty]
    public InputModel Input { get; set; } = new();

    public CatalogAdminRow Row { get; private set; } = null!;

    public bool IsFolder => Row.Catalog is FolderCatalog;

    public IReadOnlyList<string> FoldersOnDisk { get; private set; } = [];

    public string FolderRoot { get; private set; } = "";

    public string? BaseUrlNote { get; private set; }

    public async Task<IActionResult> OnGetAsync()
    {
        await LoadAsync();
        var s = Row.Setting;
        Input = new InputModel
        {
            Enabled = Row.Enabled,
            Order = s.Order,
            PerUserPerMinute = s.PerUserPerMinute,
            PerHour = s.PerHour,
            SafeSearch = s.SafeSearch,
            AllowedLicences = string.Join(Environment.NewLine, s.AllowedLicences),
            Folders = string.Join(Environment.NewLine, s.Folders),
        };
        return Page();
    }

    public async Task<IActionResult> OnPostAsync()
    {
        await LoadAsync();
        if (ModelState.IsValid)
        {
            try
            {
                await CatalogLogic.SaveAsync(biz, Id, new CatalogInput(Input.Enabled, Input.Order, Input.PerUserPerMinute, Input.PerHour, Input.SafeSearch, Lines(Input.AllowedLicences), Lines(Input.Folders)));
                await CatalogLogic.SetKeyAsync(biz, Id, Input.Key, Input.RemoveKey);
                Flash("Der Katalog ist gespeichert.");
                return RedirectToPage(new { id = Id });
            }
            catch (BizException ex)
            {
                ModelState.AddModelError(ex.Field ?? string.Empty, ex.Message);
            }
        }

        return Page();
    }

    public async Task<IActionResult> OnPostTestAsync()
    {
        ModelState.Clear();
        var result = await CatalogLogic.TestAsync(biz, Id, HttpContext.RequestAborted);
        if (result.StartsWith("Verbindung steht", StringComparison.Ordinal))
        {
            Flash(result);
        }
        else
        {
            FlashError(result);
        }

        return RedirectToPage(new { id = Id });
    }

    private static List<string> Lines(string? text)
        => [.. (text ?? "").Split(['\r', '\n', ',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)];

    private async Task LoadAsync()
    {
        Row = await CatalogLogic.AdminGetAsync(biz, Id);
        var title = Row.Catalog.Name;
        Head(title, Row.Catalog.Info.Description, ("Verwaltung", null), ("Kataloge", "/Admin/Catalogs"), (title, null));
        ViewData["Width"] = "narrow";
        ViewData["ActiveHref"] = "/Admin/Catalogs";
        if (IsFolder)
        {
            FolderRoot = ServerFolders.Root(biz.Config.DataDir);
            FoldersOnDisk = ServerFolders.Existing(biz.Config.DataDir);
        }

        BaseUrlNote = CatalogLogic.Svc(biz).Config.Current.Catalogs.ContainsKey(Row.Id) ? "Die Adresse des Anbieters hat der Betreiber in der Konfiguration festgelegt." : null;
    }
}
