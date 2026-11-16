using System.ComponentModel.DataAnnotations;
using MatCan.Logic;
using MatCan.Services.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MatCan.Pages.Account;

/// <summary>
/// "Konto erstellen" (docs/PLAN-PLATFORM.md section 1.15): name, e-mail, password. The page exists while the administrator allows registration (open or with approval), and always for a person with an
/// invitation (<c>?invitation=token</c>; the address is prefilled and locked when the invitation named one). The page never says whether an address has an account: see <see cref="RegistrationLogic"/>.
/// </summary>
[AllowAnonymous]
public sealed class RegisterModel(Biz biz, SignInService signIn) : PageModelBase
{
    public sealed class InputModel
    {
        [Required(ErrorMessage = "Bitte gib deinen Namen ein.")]
        [StringLength(120, ErrorMessage = "Der Name darf höchstens 120 Zeichen haben.")]
        [Display(Name = "Name")]
        public string DisplayName { get; set; } = "";

        [Required(ErrorMessage = "Bitte gib deine E-Mail-Adresse ein.")]
        [EmailAddress(ErrorMessage = "Das ist keine gültige E-Mail-Adresse.")]
        [Display(Name = "E-Mail-Adresse")]
        public string Email { get; set; } = "";

        [Required(ErrorMessage = "Bitte wähle ein Passwort.")]
        [Display(Name = "Passwort")]
        public string Password { get; set; } = "";

        [Required(ErrorMessage = "Bitte wiederhole das Passwort.")]
        [Display(Name = "Passwort wiederholen")]
        public string PasswordRepeat { get; set; } = "";
    }

    [BindProperty]
    public InputModel Input { get; set; } = new();

    [BindProperty(SupportsGet = true)]
    public Guid? Invitation { get; set; }

    public InvitePreview? Preview { get; private set; }

    public bool Approval => biz.Platform.Registration == "approval" && Invitation is null;

    public IReadOnlyList<string> Domains { get; private set; } = [];

    /// <summary>The address is fixed by the invitation.</summary>
    public bool EmailLocked => !string.IsNullOrEmpty(Preview?.Email);

    private async Task<IActionResult?> PrepareAsync()
    {
        ViewData["Title"] = "Konto erstellen";
        if (User.Identity?.IsAuthenticated == true)
        {
            return Invitation is { } token ? Redirect($"/Einladung/{token:D}") : Redirect("/");
        }

        if (Invitation is { } t)
        {
            Preview = await InviteLogic.PreviewAsync(biz, t);
            if (Preview.Status != InviteStatus.Valid)
            {
                return Redirect($"/Einladung/{t:D}");
            }
        }
        else if (!RegistrationLogic.IsOpen(biz))
        {
            return Redirect("/Account/Login");
        }

        Domains = Invitation is null ? RegistrationLogic.AllowedDomains(biz) : [];
        return null;
    }

    public async Task<IActionResult> OnGetAsync()
    {
        if (await PrepareAsync() is { } redirect)
        {
            return redirect;
        }

        if (EmailLocked)
        {
            Input.Email = Preview!.Email!;
        }

        return Page();
    }

    public async Task<IActionResult> OnPostAsync()
    {
        if (await PrepareAsync() is { } redirect)
        {
            return redirect;
        }

        if (EmailLocked)
        {
            Input.Email = Preview!.Email!;
            ModelState.Remove("Input.Email");
        }

        if (!ModelState.IsValid)
        {
            return Page();
        }

        try
        {
            var result = await RegistrationLogic.RegisterAsync(biz, new RegisterInput(Input.DisplayName, Input.Email, Input.Password, Input.PasswordRepeat, Invitation));
            if (result.SignInUser is { } user)
            {
                // came through an invitation: the person is in the team and signed in
                await signIn.StartSessionAsync(HttpContext, user, HttpContext.RequestAborted);
                var landing = result.Invitation?.TeamSlug is { } slug ? $"/Teams/{slug}/Projekte" : "/";
                Flash(result.Invitation?.TeamSlug is null ? "Willkommen bei MatCan! Dein Konto ist angelegt." : $"Willkommen bei MatCan! Du bist jetzt im Team „{Preview?.TeamName}“.");
                return LocalRedirect(landing);
            }

            if (result.Outcome == RegisterOutcome.Pending)
            {
                return RedirectToPage("/Account/Pending");
            }

            // the same words whether the address is new or was known: nothing here says which
            Flash("Deine Registrierung ist eingegangen. Du kannst dich jetzt anmelden.");
            return RedirectToPage("/Account/Login");
        }
        catch (BizException ex)
        {
            ModelState.AddModelError(ex.Field ?? string.Empty, ex.Message);
            Input.Password = "";
            Input.PasswordRepeat = "";
            return Page();
        }
    }
}
