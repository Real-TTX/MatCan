using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using MatCan.Data.Entities;
using MatCan.Logic;
using MatCan.Services;
using MatCan.UiKit;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace MatCan.Pages.Account;

/// <summary>
/// "Zu MatCan einladen": invitations to the platform without a team (docs/PLAN-PLATFORM.md section 1.14). An administrator, or a member while the administrator allows it, invites people by e-mail address
/// or with a link; registration through the invitation works even when self-registration is off. Invitations to a team are made on the team page (Mitglieder).
/// </summary>
public sealed class InvitationsModel(Biz biz, PublicUrl url) : PageModelBase
{
    public sealed class InviteInput
    {
        /// <summary>"email" or "link".</summary>
        public string Mode { get; set; } = "email";

        [Display(Name = "E-Mail-Adressen")]
        public string? Addresses { get; set; }

        public int Days { get; set; } = 7;

        public int MaxUses { get; set; } = 10;
    }

    public sealed record NewLink(string Label, string Url);

    [BindProperty]
    public InviteInput Input { get; set; } = new();

    public IReadOnlyList<InviteRow> Invitations { get; private set; } = [];

    public IReadOnlyList<NewLink> NewLinks { get; private set; } = [];

    public bool Allowed { get; private set; }

    public bool MailReady { get; private set; }

    public IReadOnlyList<SelectListItem> DaysItems { get; } = [new("1 Tag", "1"), new("7 Tage", "7"), new("30 Tage", "30")];

    public IReadOnlyList<SelectListItem> ModeItems { get; } = [new("Per E-Mail einladen", "email"), new("Einladungslink erzeugen", "link")];

    public string LinkOf(InviteRow invitation) => url.Absolute($"/Einladung/{invitation.Token:D}");

    private async Task LoadAsync()
    {
        Head("Zu MatCan einladen", "Lade Leute ein, die noch kein Konto haben.", ("Einladungen", null));
        ViewData["Width"] = "narrow";
        Allowed = biz.IsAdmin || biz.Platform.MembersMayInvite;
        MailReady = SettingLogic.Get<MailSettings>(biz, SettingStore.Mail).IsUsable;
        Invitations = Allowed ? await InviteLogic.ListPlatformAsync(biz) : [];
        if (TempData["InviteLinks"] is string json)
        {
            NewLinks = JsonSerializer.Deserialize<List<NewLink>>(json) ?? [];
        }
    }

    public async Task OnGetAsync() => await LoadAsync();

    public async Task<IActionResult> OnPostAsync()
    {
        await LoadAsync();
        try
        {
            var asLink = Input.Mode == "link";
            var result = await InviteLogic.CreateAsync(biz, null, SpaceRole.Editor, Input.Addresses, asLink, Input.Days, Input.MaxUses);
            TempData["InviteLinks"] = JsonSerializer.Serialize(result.Created.Select(i => new NewLink(i.Email ?? "Einladungslink", url.Absolute($"/Einladung/{i.Token:D}"))).ToList());
            Flash(asLink ? "Der Einladungslink ist erstellt. Kopiere ihn und schicke ihn weiter."
                : MailReady ? $"{Ui.Plural(result.Created.Count, "Einladung", "Einladungen")} per E-Mail verschickt."
                : $"{Ui.Plural(result.Created.Count, "Einladung", "Einladungen")} erstellt. Der Mailversand ist nicht eingerichtet: kopiere die Links und schicke sie selbst.");
            return RedirectToPage();
        }
        catch (BizException ex)
        {
            ModelState.AddModelError(ex.Field is null ? string.Empty : "Input." + ex.Field, ex.Message);
            return Page();
        }
    }

    public async Task<IActionResult> OnPostRevokeAsync(long id)
    {
        await InviteLogic.RevokeAsync(biz, id);
        Flash("Die Einladung ist zurückgezogen. Der Link funktioniert nicht mehr.");
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostResendAsync(long id)
    {
        try
        {
            await InviteLogic.ResendAsync(biz, id);
            Flash(SettingLogic.Get<MailSettings>(biz, SettingStore.Mail).IsUsable ? "Die Einladung ist noch einmal verschickt." : "Der Mailversand ist nicht eingerichtet: kopiere den Link und schicke ihn selbst.");
        }
        catch (BizException ex)
        {
            FlashError(ex.Message);
        }

        return RedirectToPage();
    }
}
