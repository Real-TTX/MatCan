using DesignThix.Logic;
using DesignThix.Pages.Projects;
using DesignThix.UiKit;
using Microsoft.AspNetCore.Mvc;

namespace DesignThix.Pages.Shared;

/// <summary>/Freigegeben: what other people shared with the person (the file browser in the mode "shared").</summary>
public sealed class FreigegebenModel(Biz biz) : BrowserPageBase(biz)
{
    public async Task OnGetAsync()
    {
        View = await BrowserViews.ForSharedAsync(Biz);
        HeadFor(View, ("Freigegeben", null));
    }
}

/// <summary>/Freigegeben/Ordner/{id}: a folder that was shared with the person; the path starts at the folder they were given. A folder of an area they belong to opens in that area.</summary>
public sealed class FreigegebenOrdnerModel(Biz biz) : BrowserPageBase(biz)
{
    public async Task<IActionResult> OnGetAsync(long id)
    {
        var (_, _, redirect) = await LocateFolderAsync(id, $"/Freigegeben/Ordner/{id}");
        if (redirect is not null)
        {
            return Redirect(redirect);
        }

        View = await BrowserViews.ForSharedFolderAsync(Biz, id);
        HeadFor(View, ("Freigegeben", "/Freigegeben"), (View.Title, null));
        return Page();
    }
}
