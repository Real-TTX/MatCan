using DesignThix.Logic;
using DesignThix.Services.Mail;
using Microsoft.AspNetCore.Mvc;

namespace DesignThix.Pages.Admin;

/// <summary>The mail server for the mails of the platform (invitations, shares, access requests, mentions). The password is stored encrypted and never shown again; without settings no mail goes out and nothing breaks.</summary>
public sealed class MailModel(Biz biz, MailQueue queue) : PageModelBase
{
    public sealed class InputModel
    {
        public bool Enabled { get; set; }

        public string Host { get; set; } = "";

        public int Port { get; set; } = 587;

        public string Security { get; set; } = "starttls";

        public string? UserName { get; set; }

        public string? Password { get; set; }

        public string FromAddress { get; set; } = "";

        public string FromName { get; set; } = "DesignThix";

        public string? PublicBase { get; set; }
    }

    [BindProperty]
    public InputModel Input { get; set; } = new();

    [BindProperty]
    public string? TestTo { get; set; }

    public bool HasPassword { get; private set; }

    public void OnGet()
    {
        var s = SettingLogic.Get<MailSettings>(biz, SettingStore.Mail);
        Input = new InputModel { Enabled = s.Enabled, Host = s.Host, Port = s.Port, Security = s.Security, UserName = s.UserName, FromAddress = s.FromAddress, FromName = s.FromName, PublicBase = s.PublicBase };
        // what the administrator reaches the app by is the proposal for the address of the links in mails
        CurrentBase = Services.PublicUrl.Base(biz.Config, HttpContext);
        Load(s);
    }

    /// <summary>The address of this request, offered as the address of the links in mails.</summary>
    public string CurrentBase { get; private set; } = "";

    public async Task<IActionResult> OnPostAsync()
    {
        biz.RequireAdmin();
        var current = SettingLogic.Get<MailSettings>(biz, SettingStore.Mail);
        if (Input.Enabled && (string.IsNullOrWhiteSpace(Input.Host) || !InviteLogic.IsEmail(Input.FromAddress)))
        {
            ModelState.AddModelError(string.Empty, "Zum Einschalten braucht es den Server und eine gültige Absenderadresse.");
            CurrentBase = Services.PublicUrl.Base(biz.Config, HttpContext);
            Load(current);
            return Page();
        }

        // an empty field takes the address the administrator is using right now (they are the only person whose address counts); a typed one must be a plain web address
        var publicBase = string.IsNullOrWhiteSpace(Input.PublicBase) ? Services.PublicUrl.Base(biz.Config, HttpContext) : Services.PublicUrl.Normalize(Input.PublicBase);
        if (publicBase is null)
        {
            ModelState.AddModelError("Input.PublicBase", "Das ist keine Webadresse. Schreibe sie so: https://design.example.de");
            CurrentBase = Services.PublicUrl.Base(biz.Config, HttpContext);
            Load(current);
            return Page();
        }

        await SettingLogic.SaveAsync(biz, SettingStore.Mail, new MailSettings
        {
            Enabled = Input.Enabled,
            Host = (Input.Host ?? "").Trim(),
            Port = Math.Clamp(Input.Port, 1, 65535),
            Security = Input.Security is "ssl" or "none" ? Input.Security : "starttls",
            UserName = (Input.UserName ?? "").Trim(),
            PasswordProtected = SettingLogic.KeepOrProtect(biz, Input.Password, current.PasswordProtected),
            FromAddress = (Input.FromAddress ?? "").Trim(),
            FromName = string.IsNullOrWhiteSpace(Input.FromName) ? "DesignThix" : Input.FromName.Trim(),
            PublicBase = publicBase,
        }, "Mail-Einstellungen geändert");
        Flash("Die Mail-Einstellungen sind gespeichert.");
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostTestAsync()
    {
        biz.RequireAdmin();
        if (!InviteLogic.IsEmail(TestTo))
        {
            FlashError("Bitte gib eine gültige Adresse für den Test ein.");
            return RedirectToPage();
        }

        var error = await queue.TestAsync(TestTo!.Trim());
        if (error is null)
        {
            Flash($"Die Testnachricht an {TestTo} ist verschickt.");
        }
        else
        {
            FlashError("Der Test ist fehlgeschlagen: " + error);
        }

        return RedirectToPage();
    }

    private void Load(MailSettings s)
    {
        HasPassword = s.PasswordProtected.Length > 0;
        Head("E-Mail", "Einladungen, Freigaben und Hinweise per Mail.", ("Verwaltung", null), ("E-Mail", null));
        ViewData["Width"] = "narrow";
    }
}
