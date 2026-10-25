using DesignThix.Logic;
using DesignThix.Pages.Projects;
using DesignThix.UiKit;

namespace DesignThix.Pages.Trash;

/// <summary>/Papierkorb: what was deleted from the areas the person manages (the file browser in the mode "trash").</summary>
public sealed class IndexModel(Biz biz) : BrowserPageBase(biz)
{
    public async Task OnGetAsync()
    {
        View = await BrowserViews.ForTrashAsync(Biz);
        HeadFor(View, ("Papierkorb", null));
    }
}
