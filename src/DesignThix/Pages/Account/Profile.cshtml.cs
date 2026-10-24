using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.Services;
using DesignThix.Services.Auth;
using Microsoft.AspNetCore.Mvc;

namespace DesignThix.Pages.Account;

/// <summary>The own account: name, phone, the look, the password.</summary>
public sealed class ProfileModel(Biz biz, SignInService signIn) : PageModelBase
{
    public sealed class ProfileInput
    {
        [Required(ErrorMessage = "Bitte gib deinen Namen ein.")]
        [Display(Name = "Name")]
        public string DisplayName { get; set; } = "";

        [Display(Name = "Telefon")]
        public string? Phone { get; set; }

        [Display(Name = "Darstellung")]
        public string Theme { get; set; } = "system";

    }

    public sealed class PasswordInput
    {
        [Display(Name = "Aktuelles Passwort")]
        public string? Current { get; set; }

        [Required(ErrorMessage = "Bitte gib das neue Passwort ein.")]
        [Display(Name = "Neues Passwort")]
        public string New { get; set; } = "";

        [Required(ErrorMessage = "Bitte wiederhole das neue Passwort.")]
        [Display(Name = "Neues Passwort wiederholen")]
        public string Repeat { get; set; } = "";
    }

    [BindProperty]
    public ProfileInput Profile { get; set; } = new();

    [BindProperty]
    public PasswordInput Password { get; set; } = new();

    public string Email { get; private set; } = "";

    public UserRole Role { get; private set; }

    public async Task OnGetAsync()
    {
        var user = await UserLogic.MeAsync(biz);
        Profile = new ProfileInput { DisplayName = user.DisplayName, Phone = user.Phone, Theme = user.Theme };
        Prepare(user);
    }

    public async Task<IActionResult> OnPostProfileAsync()
    {
        ModelState.Remove("Password.New");
        ModelState.Remove("Password.Repeat");
        if (ModelState.IsValid)
        {
            try
            {
                var user = await UserLogic.SaveProfileAsync(biz, Profile.DisplayName, Profile.Phone, Profile.Theme);
                await signIn.RefreshAsync(HttpContext, user);
                Flash("Dein Profil ist gespeichert.");
                return RedirectToPage();
            }
            catch (BizException ex)
            {
                ModelState.AddModelError(ex.Field ?? string.Empty, ex.Message);
            }
        }

        Prepare(await UserLogic.MeAsync(biz));
        return Page();
    }

    public async Task<IActionResult> OnPostPasswordAsync()
    {
        ModelState.Remove("Profile.DisplayName");
        if (ModelState.IsValid)
        {
            try
            {
                var keep = Guid.TryParse(User.FindFirstValue(AppClaims.Session), out var token) ? token : (Guid?)null;
                await UserLogic.ChangeOwnPasswordAsync(biz, Password.Current, Password.New, Password.Repeat, keep);
                Flash("Das Passwort ist geändert. Andere Geräte sind abgemeldet.");
                return RedirectToPage();
            }
            catch (BizException ex)
            {
                ModelState.AddModelError(ex.Field ?? string.Empty, ex.Message);
            }
        }

        var user = await UserLogic.MeAsync(biz);
        Profile = new ProfileInput { DisplayName = user.DisplayName, Phone = user.Phone, Theme = user.Theme };
        Prepare(user);
        return Page();
    }

    private void Prepare(User user)
    {
        Email = user.Email;
        Role = user.Role;
        Head("Profil", "Dein Name, deine Darstellung und dein Passwort.", ("Profil", null));
    }
}
