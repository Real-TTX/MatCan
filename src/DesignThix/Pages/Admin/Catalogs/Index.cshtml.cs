using DesignThix.Logic;
using Microsoft.AspNetCore.Mvc;

namespace DesignThix.Pages.Admin.Catalogs;

/// <summary>The catalogues (docs/PLAN-CATALOGS.md): which are on, which still need a key, a test search per catalogue and "Cache leeren".</summary>
public sealed class IndexModel(Biz biz) : PageModelBase
{
    public List<CatalogAdminRow> Rows { get; private set; } = [];

    public async Task OnGetAsync()
    {
        Head("Kataloge", "Quellen für Bilder: was mitkommt, was auf dem Server liegt und was Anbieter im Internet bieten.", ("Verwaltung", null), ("Kataloge", null));
        Rows = await CatalogLogic.AdminListAsync(biz);
    }

    public async Task<IActionResult> OnPostTestAsync(string id)
    {
        var result = await CatalogLogic.TestAsync(biz, id, HttpContext.RequestAborted);
        if (result.StartsWith("Verbindung steht", StringComparison.Ordinal))
        {
            Flash(result);
        }
        else
        {
            FlashError(result);
        }

        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostClearCacheAsync()
    {
        await CatalogLogic.ClearCacheAsync(biz);
        Flash("Der Zwischenspeicher der Kataloge ist geleert.");
        return RedirectToPage();
    }
}
