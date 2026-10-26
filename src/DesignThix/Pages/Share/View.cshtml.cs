using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.Services;
using Microsoft.AspNetCore.Mvc;

namespace DesignThix.Pages.Share;

/// <summary>
/// The page of a link, <c>/s/{token}</c> (docs/PLAN-PLATFORM.md section 1.8). A <b>public</b> link shows the viewer to anybody (no sign-in; the script loads <c>/api/s/{token}</c>). A <b>signed-in</b> link
/// needs a person: not signed in goes to the sign-in and comes back here, signed in gets the access the link gives and lands on the item. A link that is revoked, reset, expired or whose item is gone shows a
/// friendly "Dieser Link ist nicht mehr gültig" (status 404). Never indexed, never cached.
/// </summary>
public sealed class ViewModel(Biz biz, PublicRateLimiter limiter) : PageModelBase
{
    [BindProperty(SupportsGet = true)]
    public string Token { get; set; } = "";

    public bool Dead { get; private set; }

    public bool IsFolder { get; private set; }

    public string ItemName { get; private set; } = "";

    public bool AllowDownload { get; private set; }

    /// <summary>A signed-in person who may open the item in the app gets a link to it.</summary>
    public string? OpenUrl { get; private set; }

    public bool SignedIn => biz.User.UserId is not null;

    public async Task<IActionResult> OnGetAsync()
    {
        Response.Headers["X-Robots-Tag"] = "noindex, nofollow";
        Response.Headers.CacheControl = "no-store";
        // the same brake as the public endpoints (a request that finds nothing costs more): the page is the other way to try tokens
        if (!limiter.TryTake(biz.User.IpAddress, PublicShareLogic.RequestsPerMinute))
        {
            Response.Headers.RetryAfter = "60";
            return StatusCode(StatusCodes.Status429TooManyRequests);
        }

        if (!Guid.TryParse(Token, out var token))
        {
            limiter.Charge(biz.User.IpAddress, 4);
            return Gone();
        }

        var target = await ShareLogic.ResolveAsync(biz.Db, token, biz.Now);
        if (target is null)
        {
            limiter.Charge(biz.User.IpAddress, 4);
            return Gone();
        }

        if (target.Audience == LinkAudience.SignedIn)
        {
            if (!SignedIn)
            {
                return RedirectToPage("/Account/Login", new { returnUrl = $"/s/{token}" });
            }

            var opened = await ShareLogic.OpenAsync(biz, token);
            return opened is null ? Gone() : Redirect(AppUrl(opened.Kind, opened.ItemId));
        }

        var info = await PublicShareLogic.InfoAsync(biz, token);
        if (info is null)
        {
            return Gone();
        }

        IsFolder = info.Kind == ItemKind.Folder;
        ItemName = info.Name;
        AllowDownload = info.AllowDownload;
        if (SignedIn && await Access.LevelAsync(biz, info.Kind, info.ItemId) >= AccessLevel.View)
        {
            OpenUrl = AppUrl(info.Kind, info.ItemId);
        }

        ViewData["Title"] = info.Name;
        return Page();
    }

    private IActionResult Gone()
    {
        Dead = true;
        ViewData["Title"] = "Link nicht gültig";
        Response.StatusCode = StatusCodes.Status404NotFound;
        return Page();
    }

    /// <summary>Where an item opens in the app.</summary>
    public static string AppUrl(ItemKind kind, long id) => kind switch
    {
        ItemKind.Design => $"/Designs/{id}/Designer",
        ItemKind.Folder => $"/Freigegeben/Ordner/{id}",   // the page redirects to the area when the person is a member of it
        ItemKind.DataList => $"/DataLists/Edit/{id}",
        ItemKind.OutputJob => $"/Outputs/{id}/Run",
        _ => "/",
    };
}
