using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.Services;
using DesignThix.UiKit;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace DesignThix.Pages.Teams;

/// <summary>
/// The members of a team: the list with the role (Owner and Admin change it), remove, leave, the open invitations ("Erneut senden", "Link kopieren", "Zurückziehen") and the dialog "Einladen" (by e-mail
/// address or with a link). The rules (at least one Owner, who may touch Owners) are in <see cref="SpaceLogic"/> and <see cref="InviteLogic"/>; this page shows their messages.
/// </summary>
public sealed class MembersModel(Biz biz, PublicUrl url) : TeamPageBase(biz)
{
    public sealed class InviteInput
    {
        /// <summary>"email" or "link".</summary>
        public string Mode { get; set; } = "email";

        [Display(Name = "E-Mail-Adressen")]
        public string? Addresses { get; set; }

        public SpaceRole Role { get; set; } = SpaceRole.Editor;

        public int Days { get; set; } = 7;

        public int MaxUses { get; set; } = 10;
    }

    /// <summary>A link that was just made (shown once at the top, so it can be copied when no mail goes out).</summary>
    public sealed record NewLink(string Label, string Url);

    [BindProperty]
    public InviteInput Input { get; set; } = new();

    public IReadOnlyList<MemberRow> Members { get; private set; } = [];

    public IReadOnlyList<InviteRow> Invitations { get; private set; } = [];

    public IReadOnlyList<NewLink> NewLinks { get; private set; } = [];

    public bool MailReady { get; private set; }

    public bool OpenInviteDialog { get; private set; }

    public bool IsLastOwner { get; private set; }

    public long Me => Biz.UserId;

    public IReadOnlyList<SelectListItem> RoleItems => TeamRoleItems(IsOwner);

    public IReadOnlyList<SelectListItem> DaysItems { get; } = [new("1 Tag", "1"), new("7 Tage", "7"), new("30 Tage", "30")];

    public IReadOnlyList<SelectListItem> ModeItems { get; } = [new("Per E-Mail einladen", "email"), new("Einladungslink erzeugen", "link")];

    /// <summary>The roles a person may give: only an Owner makes Owners.</summary>
    public static IReadOnlyList<SelectListItem> TeamRoleItems(bool includeOwner)
    {
        var roles = new List<SelectListItem>();
        if (includeOwner)
        {
            roles.Add(new SelectListItem(Labels.Of(SpaceRole.Owner), nameof(SpaceRole.Owner)));
        }

        roles.Add(new SelectListItem(Labels.Of(SpaceRole.Admin), nameof(SpaceRole.Admin)));
        roles.Add(new SelectListItem(Labels.Of(SpaceRole.Editor), nameof(SpaceRole.Editor)));
        roles.Add(new SelectListItem(Labels.Of(SpaceRole.Viewer), nameof(SpaceRole.Viewer)));
        return roles;
    }

    public bool CanChange(MemberRow member) => CanAdmin && member.UserId != Me && (member.Role != SpaceRole.Owner || IsOwner);

    public string LinkOf(InviteRow invitation) => url.Absolute($"/Einladung/{invitation.Token:D}");

    public async Task<IActionResult> OnGetAsync(string slug)
    {
        await LoadAsync(slug);
        return Page();
    }

    private async Task LoadAsync(string slug)
    {
        await LoadTeamAsync(slug, TeamTabs.Members, "Mitglieder");
        Members = await SpaceLogic.MembersAsync(Biz, Team.Id);
        Invitations = CanAdmin ? await InviteLogic.ListAsync(Biz, Team.Id) : [];
        MailReady = SettingLogic.Get<MailSettings>(Biz, SettingStore.Mail).IsUsable;
        IsLastOwner = await SpaceLogic.IsLastOwnerAsync(Biz, Team.Id, Me);
        if (TempData["InviteLinks"] is string json)
        {
            NewLinks = JsonSerializer.Deserialize<List<NewLink>>(json) ?? [];
        }
    }

    public async Task<IActionResult> OnPostInviteAsync(string slug)
    {
        await LoadAsync(slug);
        try
        {
            var asLink = Input.Mode == "link";
            var result = await InviteLogic.CreateAsync(Biz, Team.Id, Input.Role, Input.Addresses, asLink, Input.Days, Input.MaxUses);
            var links = result.Created.Select(i => new NewLink(i.Email ?? $"Einladungslink für {Labels.Of(i.Role)}", url.Absolute($"/Einladung/{i.Token:D}"))).ToList();
            TempData["InviteLinks"] = JsonSerializer.Serialize(links);
            var mailed = !asLink && SettingLogic.Get<MailSettings>(Biz, SettingStore.Mail).IsUsable;
            Flash(result.Created.Count == 0 ? string.Join(" ", result.Skipped)
                : asLink ? "Der Einladungslink ist erstellt. Kopiere ihn und schicke ihn weiter."
                : mailed ? $"{Ui.Plural(result.Created.Count, "Einladung", "Einladungen")} per E-Mail verschickt." + (result.Skipped.Count > 0 ? " " + string.Join(" ", result.Skipped) : "")
                : $"{Ui.Plural(result.Created.Count, "Einladung", "Einladungen")} erstellt. Der Mailversand ist nicht eingerichtet: kopiere die Links und schicke sie selbst.");
            return RedirectToPage(new { slug });
        }
        catch (BizException ex)
        {
            ModelState.AddModelError(ex.Field is null ? string.Empty : "Input." + ex.Field, ex.Message);
            OpenInviteDialog = true;
            return Page();
        }
    }

    public async Task<IActionResult> OnPostRoleAsync(string slug, long userId, SpaceRole role)
    {
        await LoadTeamAsync(slug, TeamTabs.Members, "Mitglieder");
        try
        {
            await SpaceLogic.ChangeRoleAsync(Biz, Team.Id, userId, role);
            Flash("Die Rolle ist geändert.");
        }
        catch (BizException ex)
        {
            FlashError(ex.Message);
        }

        return RedirectToPage(new { slug });
    }

    public async Task<IActionResult> OnPostRemoveAsync(string slug, long userId)
    {
        await LoadTeamAsync(slug, TeamTabs.Members, "Mitglieder");
        try
        {
            await SpaceLogic.RemoveMemberAsync(Biz, Team.Id, userId);
            Flash("Das Mitglied ist aus dem Team entfernt.");
        }
        catch (BizException ex)
        {
            FlashError(ex.Message);
        }

        return RedirectToPage(new { slug });
    }

    public async Task<IActionResult> OnPostLeaveAsync(string slug)
    {
        await LoadTeamAsync(slug, TeamTabs.Members, "Mitglieder");
        try
        {
            await SpaceLogic.LeaveAsync(Biz, Team.Id);
            Flash($"Du hast das Team „{Team.Name}“ verlassen.");
            return Redirect("/Teams");
        }
        catch (BizException ex)
        {
            FlashError(ex.Message);
            return RedirectToPage(new { slug });
        }
    }

    public async Task<IActionResult> OnPostResendAsync(string slug, long id)
    {
        await LoadTeamAsync(slug, TeamTabs.Members, "Mitglieder");
        try
        {
            await InviteLogic.ResendAsync(Biz, id);
            Flash(SettingLogic.Get<MailSettings>(Biz, SettingStore.Mail).IsUsable ? "Die Einladung ist noch einmal verschickt." : "Der Mailversand ist nicht eingerichtet: kopiere den Link und schicke ihn selbst.");
        }
        catch (BizException ex)
        {
            FlashError(ex.Message);
        }

        return RedirectToPage(new { slug });
    }

    public async Task<IActionResult> OnPostRevokeAsync(string slug, long id)
    {
        await LoadTeamAsync(slug, TeamTabs.Members, "Mitglieder");
        await InviteLogic.RevokeAsync(Biz, id);
        Flash("Die Einladung ist zurückgezogen. Der Link funktioniert nicht mehr.");
        return RedirectToPage(new { slug });
    }
}
