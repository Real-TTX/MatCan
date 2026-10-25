using System.ComponentModel.DataAnnotations;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Pages.Admin.Users;

/// <summary>
/// One account: name, address, role (Administrator or Mitglied), whether it may sign in, a new password, the approval of a registration, the storage of the personal area, the second factor and the
/// sessions; and the deletion with a transfer of the content to another person or to a team.
/// </summary>
public sealed class EditModel(Biz biz) : PageModelBase
{
    public sealed class InputModel
    {
        [Required(ErrorMessage = "Bitte gib den Namen ein.")]
        [Display(Name = "Name")]
        public string DisplayName { get; set; } = "";

        [Required(ErrorMessage = "Bitte gib die E-Mail-Adresse ein.")]
        [EmailAddress(ErrorMessage = "Das ist keine gültige E-Mail-Adresse.")]
        [Display(Name = "E-Mail-Adresse")]
        public string Email { get; set; } = "";

        [Display(Name = "Telefon")]
        public string? Phone { get; set; }

        [Display(Name = "Rolle")]
        public UserRole Role { get; set; } = UserRole.Member;

        public bool IsActive { get; set; } = true;

        [Display(Name = "Passwort")]
        public string? Password { get; set; }
    }

    [BindProperty(SupportsGet = true)]
    public long? Id { get; set; }

    [BindProperty]
    public InputModel Input { get; set; } = new();

    /// <summary>The storage limit of the personal area in megabytes; empty = the default of the platform.</summary>
    [BindProperty]
    public long? QuotaMb { get; set; }

    /// <summary>"person", "team" or "trash": where the content of a deleted account goes.</summary>
    [BindProperty]
    public string TransferKind { get; set; } = "trash";

    [BindProperty]
    public long? TransferUserId { get; set; }

    [BindProperty]
    public long? TransferTeamId { get; set; }

    public UserLogic.UserDetails? Details { get; private set; }

    public User? Account => Details?.User;

    public bool IsMe => Account is not null && Account.Id == biz.User.UserId;

    public StorageUsage? Storage { get; private set; }

    public IReadOnlyList<SelectListItem> People { get; private set; } = [];

    public IReadOnlyList<SelectListItem> Teams { get; private set; } = [];

    public IReadOnlyList<SelectListItem> TransferKinds { get; } = [new("Inhalte an eine Person übertragen", "person"), new("Inhalte an ein Team übertragen", "team"), new("Nicht übertragen: alles in den Papierkorb", "trash")];

    public async Task<IActionResult> OnGetAsync()
    {
        if (!await LoadAsync())
        {
            return NotFound();
        }

        if (Details is { } d)
        {
            Input = new InputModel { DisplayName = d.User.DisplayName, Email = d.User.Email, Phone = d.User.Phone, Role = d.User.Role, IsActive = d.User.IsActive };
            QuotaMb = QuotaOverrideMb;
        }

        return Page();
    }

    private long? QuotaOverrideMb { get; set; }

    public async Task<IActionResult> OnPostAsync()
    {
        if (!await LoadAsync())
        {
            return NotFound();
        }

        ModelState.Remove(nameof(QuotaMb));
        ModelState.Remove(nameof(TransferKind));
        if (ModelState.IsValid)
        {
            try
            {
                var user = await UserLogic.SaveAsync(biz, Id, new UserLogic.UserInput(Input.DisplayName, Input.Email, Input.Phone, Input.Role, Input.IsActive, Input.Password));
                Flash(Id is null ? "Der Benutzer ist angelegt." : "Der Benutzer ist gespeichert.");
                return RedirectToPage("/Admin/Users/Edit", new { id = user.Id });
            }
            catch (BizException ex)
            {
                ModelState.AddModelError(ex.Field ?? string.Empty, ex.Message);
            }
        }

        return Page();
    }

    public async Task<IActionResult> OnPostApproveAsync()
    {
        await UserLogic.SetApprovalAsync(biz, Id ?? 0, true);
        Flash("Das Konto ist freigegeben. Die Person kann sich jetzt anmelden.");
        return RedirectToPage(new { id = Id });
    }

    public async Task<IActionResult> OnPostDeclineAsync()
    {
        await UserLogic.SetApprovalAsync(biz, Id ?? 0, false);
        Flash("Das Konto ist abgelehnt.");
        return RedirectToPage(new { id = Id });
    }

    public async Task<IActionResult> OnPostQuotaAsync()
    {
        try
        {
            if (QuotaMb is < 1)
            {
                throw new BizException("Der Speicherplatz muss mindestens 1 MB betragen (leer lassen für den Standard).");
            }

            await UserLogic.SetPersonalQuotaAsync(biz, Id ?? 0, QuotaMb);
            Flash(QuotaMb is null ? "Der Speicherplatz ist wieder der Standard der Plattform." : $"Der Speicherplatz ist auf {Fmt.Integer(QuotaMb.Value)} MB gesetzt.");
        }
        catch (BizException ex)
        {
            FlashError(ex.Message);
        }

        return RedirectToPage(new { id = Id });
    }

    public async Task<IActionResult> OnPostResetTotpAsync()
    {
        await UserLogic.ResetTotpAsync(biz, Id ?? 0);
        Flash("Die Zwei-Faktor-Anmeldung ist abgeschaltet. Die Person kann sie neu einrichten.");
        return RedirectToPage(new { id = Id });
    }

    public async Task<IActionResult> OnPostEndSessionsAsync()
    {
        var keep = Guid.TryParse(User.FindFirst(Services.AppClaims.Session)?.Value, out var token) ? token : (Guid?)null;
        await UserLogic.EndSessionsAsync(biz, Id ?? 0, keep);
        Flash("Alle Sitzungen sind beendet. Die Person muss sich neu anmelden.");
        return RedirectToPage(new { id = Id });
    }

    public async Task<IActionResult> OnPostUnlockAsync()
    {
        await UserLogic.UnlockAsync(biz, Id ?? 0);
        Flash("Die Sperre nach falschen Anmeldungen ist aufgehoben.");
        return RedirectToPage(new { id = Id });
    }

    public async Task<IActionResult> OnPostDeleteAsync()
    {
        try
        {
            var target = TransferKind switch
            {
                "person" => new UserLogic.TransferTarget(TransferUserId ?? throw new BizException("Bitte wähle die Person, die die Inhalte bekommt."), null),
                "team" => new UserLogic.TransferTarget(null, TransferTeamId ?? throw new BizException("Bitte wähle das Team, das die Inhalte bekommt.")),
                _ => UserLogic.TransferTarget.None,
            };
            await UserLogic.DeleteAsync(biz, Id ?? 0, target);
            Flash(target.IsNone ? "Der Benutzer ist gelöscht. Seine Inhalte liegen im Papierkorb und werden nach der eingestellten Zeit entfernt." : "Der Benutzer ist gelöscht. Seine Inhalte sind übertragen.");
            return RedirectToPage("/Admin/Users/Index");
        }
        catch (BizException ex)
        {
            FlashError(ex.Message);
            return RedirectToPage(new { id = Id });
        }
    }

    private async Task<bool> LoadAsync()
    {
        if (Id is { } id)
        {
            Details = await UserLogic.DetailsAsync(biz, id);
            if (Details is null)
            {
                return false;
            }

            Storage = await UserLogic.PersonalStorageAsync(biz, id);
            if (Details.User.PersonalSpaceId is { } space)
            {
                QuotaOverrideMb = await biz.Db.Space.AsNoTracking().Where(s => s.Id == space).Select(s => s.StorageQuotaBytes).FirstOrDefaultAsync() is { } bytes ? bytes / (1024 * 1024) : null;
            }

            People = [.. (await UserLogic.TransferPeopleAsync(biz, id)).Select(p => new SelectListItem($"{p.Name} ({p.Detail})", p.Id.ToString()))];
            Teams = [.. await SpaceLogic.AdminTeams(biz).OrderBy(t => t.Name).Select(t => new SelectListItem(t.Name, t.Id.ToString())).ToListAsync()];
        }

        var title = Id is null ? "Neuer Benutzer" : Account!.DisplayName;
        Head(title, null, ("Verwaltung", null), ("Benutzer", "/Admin/Users"), (title, null));
        ViewData["Width"] = "narrow";
        ViewData["ActiveHref"] = "/Admin/Users";
        return true;
    }
}
