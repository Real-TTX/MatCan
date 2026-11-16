using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using MatCan.Data.Entities;
using MatCan.Logic;
using MatCan.Services;
using MatCan.Services.Auth;
using Microsoft.AspNetCore.Mvc;

namespace MatCan.Pages.Account;

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

    /// <summary>"E-Mail bei ...": which kinds of notifications also arrive by mail.</summary>
    public sealed class NotifyInput
    {
        public bool Shares { get; set; }

        public bool Requests { get; set; }

        public bool Mentions { get; set; }

        public bool Invitations { get; set; }
    }

    [BindProperty]
    public NotifyInput Notify { get; set; } = new();

    /// <summary>Whether the administrator has set up the mail server (without it the settings are kept but nothing is sent).</summary>
    public bool MailReady { get; private set; }

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

    public async Task<IActionResult> OnPostMailAsync()
    {
        await NotificationLogic.SaveMailSettingsAsync(biz, new NotifyMailSettings { Shares = Notify.Shares, Requests = Notify.Requests, Mentions = Notify.Mentions, Invitations = Notify.Invitations });
        Flash("Deine Einstellungen für E-Mails sind gespeichert.");
        return RedirectToPage();
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
        MailReady = SettingLogic.Get<MailSettings>(biz, SettingStore.Mail).IsUsable;
        var mail = NotifyMailSettings.Parse(user.NotifyMailJson);
        Notify = new NotifyInput { Shares = mail.Shares, Requests = mail.Requests, Mentions = mail.Mentions, Invitations = mail.Invitations };
        Head("Profil", "Dein Name, deine Darstellung und dein Passwort.", ("Profil", null));
    }
}
