using MatCan.Logic;
using MatCan.Pages.Projects;
using MatCan.UiKit;

namespace MatCan.Pages.Starred;

/// <summary>/Mit-Stern: what the person marked with a star (the file browser in the mode "starred").</summary>
public sealed class IndexModel(Biz biz) : BrowserPageBase(biz)
{
    public async Task OnGetAsync()
    {
        View = await BrowserViews.ForStarredAsync(Biz);
        HeadFor(View, ("Mit Stern", null));
    }
}
