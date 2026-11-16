using MatCan.Logic;
using MatCan.UiKit;
using Microsoft.AspNetCore.Mvc;

namespace MatCan.Pages.Projects;

/// <summary>
/// What the pages of the file browser have in common: the view for the control, and the way a folder is found at its own address (a folder of a team opens under the team, a folder that was only
/// shared under "Freigegeben").
/// </summary>
public abstract class BrowserPageBase(Biz biz) : PageModelBase
{
    protected Biz Biz { get; } = biz;

    public BrowserView View { get; protected set; } = null!;

    protected void HeadFor(BrowserView view, params (string Text, string? Url)[] crumbs)
    {
        Head(view.Title, null, crumbs);
        ViewData["OwnHead"] = true;
    }

    /// <summary>The personal area of the person.</summary>
    protected async Task<SpaceRow> PersonalAsync()
    {
        var id = await Biz.PersonalSpaceIdAsync();
        return (await SpaceLogic.MySpacesAsync(Biz)).First(s => s.Id == id);
    }

    /// <summary>
    /// The folder's own address: <c>null</c> when this is it, else where to go. A folder the person may not see (or that does not exist: the two look the same) sends them to the page "Zugriff anfordern", like every
    /// other page of an item does.
    /// </summary>
    protected async Task<(FolderRow? Folder, SpaceRow? Space, string? Redirect)> LocateFolderAsync(long id, string current)
    {
        var folder = await FolderLogic.GetAsync(Biz, id);
        if (folder is null)
        {
            return (null, null, $"/Zugriff/folder/{id}");
        }

        var space = (await SpaceLogic.MySpacesAsync(Biz)).FirstOrDefault(s => s.Id == folder.SpaceId);
        var home = space is null ? $"/Freigegeben/Ordner/{id}" : $"{BrowserViews.BaseOf(space)}/Ordner/{id}";
        return (folder, space, string.Equals(home, current, StringComparison.OrdinalIgnoreCase) ? null : home);
    }
}

/// <summary>/Projekte: the personal area.</summary>
public sealed class IndexModel(Biz biz) : BrowserPageBase(biz)
{
    public async Task OnGetAsync()
    {
        View = await BrowserViews.ForSpaceAsync(Biz, await PersonalAsync(), null);
        HeadFor(View, ("Projekte", null));
    }
}

/// <summary>/Projekte/Ordner/{id}: a folder of the personal area.</summary>
public sealed class FolderModel(Biz biz) : BrowserPageBase(biz)
{
    public async Task<IActionResult> OnGetAsync(long id)
    {
        var (_, space, redirect) = await LocateFolderAsync(id, $"/Projekte/Ordner/{id}");
        if (redirect is not null)
        {
            return Redirect(redirect);
        }

        View = await BrowserViews.ForSpaceAsync(Biz, space!, id);
        HeadFor(View, ("Projekte", "/Projekte"), (View.Title, null));
        return Page();
    }
}

/// <summary>/Teams/{slug}/Projekte: the area of a team.</summary>
public sealed class TeamModel(Biz biz) : BrowserPageBase(biz)
{
    public async Task OnGetAsync(string slug)
    {
        var team = await SpaceLogic.GetBySlugAsync(Biz, slug) ?? throw new NotFoundException();
        View = await BrowserViews.ForSpaceAsync(Biz, team, null);
        HeadFor(View, ("Teams", "/Teams"), (team.Name, null));
    }
}

/// <summary>/Teams/{slug}/Projekte/Ordner/{id}: a folder of a team.</summary>
public sealed class TeamFolderModel(Biz biz) : BrowserPageBase(biz)
{
    public async Task<IActionResult> OnGetAsync(string slug, long id)
    {
        var team = await SpaceLogic.GetBySlugAsync(Biz, slug) ?? throw new NotFoundException();
        var (folder, _, redirect) = await LocateFolderAsync(id, $"{BrowserViews.TeamBase(team.Slug ?? "")}/Ordner/{id}");
        if (redirect is not null)
        {
            return Redirect(redirect);
        }

        View = await BrowserViews.ForSpaceAsync(Biz, team, folder!.Id);
        HeadFor(View, ("Teams", "/Teams"), (team.Name, BrowserViews.TeamBase(team.Slug ?? "")), (View.Title, null));
        return Page();
    }
}
