using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;
using DesignThix.Logic;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace DesignThix.Pages.Admin;

/// <summary>
/// The rules of the platform (docs/PLAN-PLATFORM.md section 2, <see cref="PlatformSettings"/>): who may register (nobody but with an invitation, anybody, anybody after approval) and from which e-mail
/// domains, whether members invite and make teams, public links, the default storage of a personal area and of a team, and how long the trash keeps things.
/// </summary>
public sealed partial class PlatformModel(Biz biz) : PageModelBase
{
    public sealed class InputModel
    {
        [Display(Name = "Registrierung")]
        public string Registration { get; set; } = "off";

        [Display(Name = "Erlaubte Domains")]
        public string? AllowedDomains { get; set; }

        public bool MembersMayInvite { get; set; } = true;

        public bool MembersMayCreateTeams { get; set; } = true;

        public bool PublicLinks { get; set; } = true;

        [Range(1, 10_000_000, ErrorMessage = "Der Speicherplatz pro Person muss zwischen 1 und 10 000 000 MB liegen.")]
        [Display(Name = "Speicherplatz pro Person (MB)")]
        public int PersonalQuotaMb { get; set; } = 2048;

        [Range(1, 10_000_000, ErrorMessage = "Der Speicherplatz pro Team muss zwischen 1 und 10 000 000 MB liegen.")]
        [Display(Name = "Speicherplatz pro Team (MB)")]
        public int TeamQuotaMb { get; set; } = 10240;

        [Range(1, 365, ErrorMessage = "Der Papierkorb muss zwischen 1 und 365 Tagen aufbewahren.")]
        [Display(Name = "Papierkorb (Tage)")]
        public int TrashDays { get; set; } = 30;
    }

    [GeneratedRegex(@"^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$", RegexOptions.CultureInvariant)]
    private static partial Regex DomainPattern();

    [BindProperty]
    public InputModel Input { get; set; } = new();

    public IReadOnlyList<SelectListItem> RegistrationItems { get; } =
    [
        new("Aus: nur mit Einladung", "off"),
        new("Offen: jede Person kann sich registrieren", "open"),
        new("Mit Freigabe: Konten warten, bis ein Administrator sie freigibt", "approval"),
    ];

    public void OnGet()
    {
        Prepare();
        var p = SettingLogic.Get<PlatformSettings>(biz, SettingStore.Platform);
        Input = new InputModel
        {
            Registration = p.Registration is "open" or "approval" ? p.Registration : "off",
            AllowedDomains = string.Join(Environment.NewLine, p.AllowedDomains),
            MembersMayInvite = p.MembersMayInvite,
            MembersMayCreateTeams = p.MembersMayCreateTeams,
            PublicLinks = p.PublicLinks,
            PersonalQuotaMb = p.PersonalQuotaMb,
            TeamQuotaMb = p.TeamQuotaMb,
            TrashDays = p.TrashDays,
        };
    }

    public async Task<IActionResult> OnPostAsync()
    {
        Prepare();
        biz.RequireAdmin();
        var domains = new List<string>();
        foreach (var part in Regex.Split(Input.AllowedDomains ?? "", @"[,;\s]+"))
        {
            var domain = part.Trim().TrimStart('@').ToLowerInvariant();
            if (domain.Length == 0)
            {
                continue;
            }

            if (!DomainPattern().IsMatch(domain))
            {
                ModelState.AddModelError("Input.AllowedDomains", $"„{domain}“ ist keine gültige Domain. Schreibe sie wie example.com.");
                break;
            }

            if (!domains.Contains(domain))
            {
                domains.Add(domain);
            }
        }

        if (Input.Registration is not ("off" or "open" or "approval"))
        {
            ModelState.AddModelError("Input.Registration", "Bitte wähle eine der Möglichkeiten.");
        }

        if (!ModelState.IsValid)
        {
            return Page();
        }

        await SettingLogic.SaveAsync(biz, SettingStore.Platform, new PlatformSettings
        {
            Registration = Input.Registration,
            AllowedDomains = domains,
            MembersMayInvite = Input.MembersMayInvite,
            MembersMayCreateTeams = Input.MembersMayCreateTeams,
            PublicLinks = Input.PublicLinks,
            PersonalQuotaMb = Input.PersonalQuotaMb,
            TeamQuotaMb = Input.TeamQuotaMb,
            TrashDays = Input.TrashDays,
        }, "Plattform-Einstellungen geändert");
        Flash("Die Einstellungen sind gespeichert.");
        return RedirectToPage();
    }

    private void Prepare()
    {
        Head("Plattform", "Wer sich registrieren darf, was Mitglieder dürfen und wie viel Platz es gibt.", ("Verwaltung", null), ("Plattform", null));
        ViewData["Width"] = "narrow";
    }
}
