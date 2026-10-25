using DesignThix.Logic;
using DesignThix.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DesignThix.Pages.Account;

/// <summary>
/// The page of an invitation link, <c>/Einladung/{token}</c> (docs/PLAN-PLATFORM.md section 1.14): what the invitation is for, then "Einladung annehmen" for a signed-in person (their address must match when
/// the invitation named one), "Anmelden" or "Konto erstellen" for everybody else (registration through an invitation also works while self-registration is off). A link that is revoked, expired or used up
/// says so in friendly words. Accepting is a button (POST), not a side effect of opening the page: a link that a mail program or another page fetches joins nobody.
/// </summary>
[AllowAnonymous]
public sealed class InviteModel(Biz biz, PublicRateLimiter limiter) : PageModelBase
{
    public InvitePreview Preview { get; private set; } = null!;

    public bool SignedIn => User.Identity?.IsAuthenticated == true;

    public string? MyEmail { get; private set; }

    /// <summary>The invitation names another address than the one the person is signed in with.</summary>
    public bool WrongAddress => SignedIn && !string.IsNullOrEmpty(Preview.Email) && !string.Equals(Preview.Email, MyEmail, StringComparison.OrdinalIgnoreCase);

    public Guid Token { get; private set; }

    public async Task<IActionResult> OnGetAsync(Guid token)
    {
        ViewData["Title"] = "Einladung";
        Token = token;
        if (!limiter.TryTake("invite:" + biz.User.IpAddress, 30))
        {
            return StatusCode(StatusCodes.Status429TooManyRequests);
        }

        Preview = await InviteLogic.PreviewAsync(biz, token);
        if (SignedIn)
        {
            MyEmail = (await UserLogic.MeAsync(biz)).Email;
        }

        if (Preview.Status != InviteStatus.Valid)
        {
            Response.StatusCode = StatusCodes.Status404NotFound;
        }

        return Page();
    }

    public async Task<IActionResult> OnPostAsync(Guid token)
    {
        if (!SignedIn)
        {
            return Redirect($"/Account/Login?returnUrl=/Einladung/{token:D}");
        }

        if (!limiter.TryTake("invite:" + biz.User.IpAddress, 30))
        {
            return StatusCode(StatusCodes.Status429TooManyRequests);
        }

        try
        {
            var accepted = await InviteLogic.AcceptAsync(biz, token);
            if (accepted.TeamSlug is { } slug)
            {
                var preview = await InviteLogic.PreviewAsync(biz, token);
                Flash(accepted.AlreadyMember ? $"Du bist schon im Team „{preview.TeamName}“." : $"Willkommen im Team „{preview.TeamName}“!");
                return Redirect($"/Teams/{slug}/Projekte");
            }

            Flash("Die Einladung ist angenommen.");
            return Redirect("/");
        }
        catch (BizException ex)
        {
            FlashError(ex.Message);
            return Redirect($"/Einladung/{token:D}");
        }
    }
}
