using DesignThix.Data.Entities;
using DesignThix.Logic;
using Microsoft.AspNetCore.Mvc;

namespace DesignThix.Pages.Admin.Ai;

/// <summary>
/// The AI of the site: on or off, the base instruction (the second layer; empty means the built-in text), personal data, the limits, and what
/// the layers look like together ("Vollständige Anweisung anzeigen").
/// </summary>
public sealed class IndexModel(Biz biz) : PageModelBase
{
    [BindProperty]
    public AiSettings Input { get; set; } = new();

    /// <summary>The tab to open (<c>?tab=limits</c>: the link of the limit notice of the design assistant).</summary>
    [BindProperty(SupportsGet = true)]
    public string? Tab { get; set; }

    public AiLogic.Usage Usage { get; private set; } = null!;

    public string OperatorInstruction { get; private set; } = "";

    public bool RelayConfigured { get; private set; }

    public Dictionary<AiAction, string> Preview { get; private set; } = [];

    public async Task OnGetAsync()
    {
        Input = SettingLogic.Get<AiSettings>(biz, SettingStore.Ai);
        await LoadAsync();
    }

    public async Task<IActionResult> OnPostAsync()
    {
        if (Input.UserDailyTokens < 0 || Input.UserMonthlyTokens < 0 || Input.MonthlyTokens < 0 || Input.AddressDailyRuns < 0 || Input.PerMinutePerAddress < 0)
        {
            ModelState.AddModelError(string.Empty, "Grenzen können nicht negativ sein (0 heißt: keine Grenze).");
        }

        Input.MaxTokens = Math.Clamp(Input.MaxTokens, 1000, 64_000);
        Input.TimeoutSeconds = Math.Clamp(Input.TimeoutSeconds, 30, 600);
        Input.AgentMaxCallsPerRun = Math.Clamp(Input.AgentMaxCallsPerRun, 1, 200);
        Input.AgentMaxTokens = Math.Clamp(Input.AgentMaxTokens, 1000, 64_000);
        Input.AgentMaxConcurrent = Math.Clamp(Input.AgentMaxConcurrent, 1, 10);
        Input.AgentMaxLooks = Math.Clamp(Input.AgentMaxLooks, 0, 20);
        Input.AgentMaxFilesPerMessage = Math.Clamp(Input.AgentMaxFilesPerMessage, 1, 20);
        Input.BaseInstruction = (Input.BaseInstruction ?? "").Trim();
        Input.ActionInstructions = (Input.ActionInstructions ?? [])
            .Where(p => Enum.TryParse<AiAction>(p.Key, out _) && !string.IsNullOrWhiteSpace(p.Value))
            .ToDictionary(p => p.Key, p => p.Value.Trim().Length > 2000 ? p.Value.Trim()[..2000] : p.Value.Trim());
        if (!ModelState.IsValid)
        {
            await LoadAsync();
            return Page();
        }

        await SettingLogic.SaveAsync(biz, SettingStore.Ai, Input, "KI-Einstellungen geändert");
        Flash("Die KI-Einstellungen sind gespeichert.");
        return RedirectToPage();
    }

    private async Task LoadAsync()
    {
        Head("KI: Einstellungen", "Was die KI darf, was sie bekommt und wie viel sie kosten darf.", ("Verwaltung", null), ("KI", null));
        Usage = await AiLogic.UsageAsync(biz);
        OperatorInstruction = biz.Config.Current.Ai.OperatorInstruction;
        RelayConfigured = !string.IsNullOrWhiteSpace(biz.Config.Current.Ai.RelayUrl);
        foreach (var action in Enum.GetValues<AiAction>())
        {
            Preview[action] = AiLogic.FullInstruction(biz, action);
        }
    }
}
