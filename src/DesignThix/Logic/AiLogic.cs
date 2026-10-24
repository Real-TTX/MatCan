using System.Text;
using System.Text.Json;
using DesignThix.Configuration;
using DesignThix.Core.Ai;
using DesignThix.Data;
using DesignThix.Data.Entities;
using DesignThix.Services.Ai;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Logic;

/// <summary>
/// What the AI does in DesignThix, and the boundary around it. Every call goes through <see cref="RunAsync"/>: limits first (before anything is
/// sent), then the transport (the active profile, else the operator's relay), the layered instructions, one JSON object as the answer, read
/// leniently and then checked in code (allowlists for choices and keys). Every step is written to the run; changes go into the
/// journal and can be taken back, the newest run first. Which data the AI sees is decided here, never by the model.
/// </summary>
public static class AiLogic
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>The outcome of a run for its caller: the run (with its status), the checked JSON object, or what went wrong.</summary>
    public sealed record Outcome(AiRun Run, JsonElement? Result, string? Error)
    {
        public bool Ok => Error is null && Result is not null;
    }

    /// <summary>What a run is asked to do: the action, the situation text the model sees, and what it works on (for the run list).</summary>
    internal sealed record Call(AiAction Action, string Situation, string? StepInstruction, string? SubjectType, long? SubjectId, long? UserId, string? Address);

    // ================================================================================================ the run

    internal static async Task<Outcome> RunAsync(DtDbContext db, IServiceProvider services, Call call, CancellationToken ct = default)
    {
        var store = services.GetRequiredService<SettingStore>();
        var settings = store.Get<AiSettings>(SettingStore.Ai);
        var site = store.Get<SiteSettings>(SettingStore.Site);
        var config = services.GetRequiredService<ConfigStore>();
        var clock = services.GetRequiredService<TimeProvider>();
        var now = clock.GetUtcNow().UtcDateTime;
        var run = new AiRun
        {
            Action = call.Action,
            SubjectType = call.SubjectType,
            SubjectId = call.SubjectId,
            UserId = call.UserId,
            AddressHash = call.Address is null ? null : services.GetRequiredService<AiRateLimiter>().Hash(call.Address),
            StartDate = now,
            CreateUserId = call.UserId,
        };
        db.AiRun.Add(run);
        var stepNo = 0;
        void Step(AiStepKind kind, string text) => run.Steps.Add(new AiRunStep { Kind = kind, Text = Limit(text, 40_000), Number = ++stepNo, OccurredDate = clock.GetUtcNow().UtcDateTime, CreateUserId = call.UserId });

        async Task<Outcome> End(AiRunStatus status, string? error, JsonElement? result = null)
        {
            run.Status = status;
            run.Error = error;
            run.EndDate = clock.GetUtcNow().UtcDateTime;
            if (error is not null)
            {
                Step(status == AiRunStatus.LimitReached ? AiStepKind.Warning : AiStepKind.Result, error);
            }

            await db.SaveChangesAsync(ct);
            return new Outcome(run, result, error);
        }

        Step(AiStepKind.Action, $"Aktion: {UiKit.Labels.Of(call.Action)}");

        // ---- limits, before anything is sent ----
        if (!settings.Enabled)
        {
            return await End(AiRunStatus.Cancelled, "Die KI ist in den Einstellungen ausgeschaltet.");
        }

        if (!services.GetRequiredService<AiRateLimiter>().TryTake(call.Address, settings.PerMinutePerAddress))
        {
            return await End(AiRunStatus.LimitReached, "Zu viele Anfragen in kurzer Zeit. Bitte in einer Minute erneut versuchen.");
        }

        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var monthTokens = await db.AiRun.Where(r => r.StartDate >= monthStart).SumAsync(r => r.PromptTokens + r.CompletionTokens, ct);
        if (settings.MonthlyTokens > 0 && monthTokens >= settings.MonthlyTokens)
        {
            return await End(AiRunStatus.LimitReached, "Das Monatsbudget der KI ist aufgebraucht.");
        }

        if (call.UserId is { } userId && settings.UserDailyTokens > 0)
        {
            var dayTokens = await db.AiRun.Where(r => r.UserId == userId && r.StartDate >= now.Date).SumAsync(r => r.PromptTokens + r.CompletionTokens, ct);
            if (dayTokens >= settings.UserDailyTokens)
            {
                return await End(AiRunStatus.LimitReached, "Dein Tagesbudget der KI ist aufgebraucht. Morgen geht es weiter.");
            }
        }

        if (run.AddressHash is { } address && settings.AddressDailyRuns > 0
            && await db.AiRun.CountAsync(r => r.AddressHash == address && r.StartDate >= now.Date, ct) >= settings.AddressDailyRuns)
        {
            return await End(AiRunStatus.LimitReached, "Von diesem Anschluss aus sind für heute keine weiteren KI-Aufrufe möglich.");
        }

        // ---- transport ----
        var transport = await TransportAsync(db, services, config, ct);
        if (transport is null)
        {
            return await End(AiRunStatus.Error, "Es ist keine KI eingerichtet (Verwaltung → KI → Profile).");
        }

        run.ProfileName = transport.Name;
        run.Model = transport.Model;
        run.Transport = transport.Kind;

        // ---- instructions ----
        var system = AiInstructions.SystemText(config.Current.Ai, settings, site, call.Action, call.StepInstruction);
        var messages = new List<AiMessage> { AiMessage.System(system), AiMessage.User(call.Situation) };
        Step(AiStepKind.Message, $"An {transport.Name} ({transport.Model}):\n\n{system}\n\n---\n\n{call.Situation}");

        var required = AiInstructions.RequiredField(call.Action);
        for (var attempt = 0; ; attempt++)
        {
            var response = await transport.CompleteAsync(new AiRequest { Messages = messages, Json = true, MaxTokens = settings.MaxTokens }, ct);
            var estimated = response.PromptTokens == 0 && response.CompletionTokens == 0;
            run.PromptTokens += estimated ? TokenEstimate.Of(messages) : response.PromptTokens;
            run.CompletionTokens += estimated ? TokenEstimate.Of(response.Text) : response.CompletionTokens;
            run.TokensEstimated |= estimated;
            if (!response.Ok)
            {
                return await End(AiRunStatus.Error, response.Error ?? "Die KI hat nicht geantwortet.");
            }

            Step(AiStepKind.Result, response.Text ?? "");
            if (response.Note is { Length: > 0 } note)
            {
                Step(AiStepKind.Warning, note);
            }

            var obj = LenientJson.FirstObject(response.Text);
            if (obj is { } o && o.TryGetProperty(required, out _))
            {
                run.ResultJson = o.GetRawText();
                return await End(AiRunStatus.Done, null, o);
            }

            // Only an announcement ("Ich schaue mir das an ...") or another shape: at most two nudges, then the run hangs.
            if (attempt >= 2)
            {
                return await End(AiRunStatus.Stuck, "Die KI hat nicht im verlangten Format geantwortet (zweimal angestoßen).");
            }

            run.Nudges++;
            messages.Add(AiMessage.Assistant(response.Text ?? ""));
            messages.Add(AiMessage.User(AiInstructions.Nudge(call.Action)));
            Step(AiStepKind.Warning, "Antwort ohne das verlangte JSON-Objekt: Anstoß zum Weitermachen.");
        }
    }

    // ================================================================================================ transport: own connection, else relay

    private sealed record Transport(string Kind, string Name, string Model, Func<AiRequest, CancellationToken, Task<AiResponse>> Complete)
    {
        public Task<AiResponse> CompleteAsync(AiRequest request, CancellationToken ct) => Complete(request, ct);
    }

    private static async Task<Transport?> TransportAsync(DtDbContext db, IServiceProvider services, ConfigStore config, CancellationToken ct)
    {
        var secrets = services.GetRequiredService<AiSecretStore>();
        var http = services.GetRequiredService<IHttpClientFactory>();
        var settings = services.GetRequiredService<SettingStore>().Get<AiSettings>(SettingStore.Ai);
        var logger = services.GetRequiredService<ILoggerFactory>().CreateLogger("Ai");
        var profile = await db.AiProfile.AsNoTracking().FirstOrDefaultAsync(p => p.IsActive, ct);
        if (profile is not null)
        {
            if (profile.Provider == AiProvider.ChatGpt)
            {
                var account = AiProfileLogic.Account(services, profile);
                if (await account.IsConnectedAsync(ct))
                {
                    return new Transport("profile", profile.Name, profile.Model, (r, c) => account.CompleteAsync(profile.Model, r.Messages, c));
                }
            }
            else if (await secrets.LoadAsync(profile.SecretToken, AiSecretStore.ApiKey, ct) is { Length: > 0 } key)
            {
                return new Transport("profile", profile.Name, profile.Model, (r, c) =>
                    ChatCompletionsClient.CompleteAsync(http.CreateClient("ai"), profile.BaseUrl, key, profile.Model, r, settings.MaxTokens, m => logger.LogWarning("{Message}", m), c));
            }
        }

        var op = config.Current.Ai;
        if (!string.IsNullOrWhiteSpace(op.RelayUrl))
        {
            return new Transport("relay", "Relay des Betreibers", op.RelayModel, (r, c) =>
                ChatCompletionsClient.CompleteAsync(http.CreateClient("ai"), op.RelayUrl, op.RelayKey, op.RelayModel, r, settings.MaxTokens, m => logger.LogWarning("{Message}", m), c));
        }

        return null;
    }

    /// <summary>Whether a call could go out at all (a usable profile or a relay): pages hide the AI buttons otherwise.</summary>
    public static async Task<bool> IsAvailableAsync(Biz biz)
    {
        var settings = SettingLogic.Get<AiSettings>(biz, SettingStore.Ai);
        if (!settings.Enabled)
        {
            return false;
        }

        if (!string.IsNullOrWhiteSpace(biz.Config.Current.Ai.RelayUrl))
        {
            return true;
        }

        var profile = await biz.Db.AiProfile.AsNoTracking().FirstOrDefaultAsync(p => p.IsActive);
        return profile is not null && biz.Service<AiSecretStore>().Has(profile.SecretToken, profile.Provider == AiProvider.ChatGpt ? AiSecretStore.ChatGpt : AiSecretStore.ApiKey);
    }

    // ================================================================================================ settings page: test and the full instruction

    public static async Task<string> TestAsync(Biz biz, string? address)
    {
        biz.RequireAdmin();
        var outcome = await RunAsync(biz.Db, biz.Services, new Call(AiAction.Test, "Bitte bestätige kurz, dass du erreichbar bist.", null, null, null, biz.UserId, address));
        return outcome.Ok
            ? $"Verbindung steht ({outcome.Run.ProfileName}, {outcome.Run.Model}): {outcome.Result!.Value.Text("message")}"
            : $"Fehlgeschlagen: {outcome.Error}";
    }

    /// <summary>"Vollständige Anweisung anzeigen": exactly the text that would go to the model for this action.</summary>
    public static string FullInstruction(Biz biz, AiAction action)
    {
        biz.RequireAdmin();
        var store = biz.Service<SettingStore>();
        var system = AiInstructions.SystemText(biz.Config.Current.Ai, store.Get<AiSettings>(SettingStore.Ai), store.Get<SiteSettings>(SettingStore.Site), action, null);
        var situation = action == AiAction.Test ? "Bitte bestätige kurz, dass du erreichbar bist." : "(die Lage: das Design, die Datenliste, die Eingaben)";
        return $"[system]\n{system}\n\n[user]\n{situation}";
    }

    // ================================================================================================ runs, journal, undo

    public static IQueryable<AiRun> Runs(Biz biz)
    {
        biz.RequireAdmin();
        return biz.Db.AiRun.AsNoTracking();
    }

    public sealed record RunDetails(AiRun Run, List<AiJournalEntry> Journal, bool CanUndo, string? UndoBlockedBy);

    public static async Task<RunDetails?> RunDetailsAsync(Biz biz, long id)
    {
        biz.RequireAdmin();
        var run = await biz.Db.AiRun.AsNoTracking().Include(r => r.Steps.OrderBy(s => s.Number)).FirstOrDefaultAsync(r => r.Id == id);
        if (run is null)
        {
            return null;
        }

        var journal = await biz.Db.AiJournalEntry.AsNoTracking().Where(j => j.AiRunId == id).OrderBy(j => j.Id).ToListAsync();
        var blocker = await NewerRunAsync(biz.Db, journal);
        return new RunDetails(run, journal, journal.Any(j => j.RevertedDate is null) && blocker is null, blocker is null ? null : $"Erst Lauf #{blocker} rückgängig machen (neuester zuerst).");
    }

    /// <summary>A newer run that changed the same records and is not undone: it has to be undone first.</summary>
    private static async Task<long?> NewerRunAsync(DtDbContext db, List<AiJournalEntry> journal)
    {
        var open = journal.Where(j => j.RevertedDate is null).ToList();
        if (open.Count == 0)
        {
            return null;
        }

        var runId = open[0].AiRunId;
        var keys = open.Select(j => j.EntityType + ":" + j.EntityId).Distinct().ToList();
        var newer = await db.AiJournalEntry.AsNoTracking()
            .Where(j => j.AiRunId > runId && j.RevertedDate == null)
            .Select(j => new { j.AiRunId, Key = j.EntityType + ":" + j.EntityId })
            .ToListAsync();
        return newer.Where(n => keys.Contains(n.Key)).OrderByDescending(n => n.AiRunId).Select(n => (long?)n.AiRunId).FirstOrDefault();
    }

    /// <summary>Takes back what a run changed. A value somebody changed since is left alone (and said so).</summary>
    public static async Task<string> UndoAsync(Biz biz, long runId)
    {
        biz.RequireAdmin();
        var journal = await biz.Db.AiJournalEntry.Where(j => j.AiRunId == runId && j.RevertedDate == null).OrderByDescending(j => j.Id).ToListAsync();
        if (journal.Count == 0)
        {
            throw new BizException("Dieser Lauf hat nichts geändert, oder es ist schon rückgängig gemacht.");
        }

        if (await NewerRunAsync(biz.Db, journal) is { } blocker)
        {
            throw new BizException($"Ein neuerer Lauf (#{blocker}) hat dieselben Daten geändert. Mach zuerst ihn rückgängig.");
        }

        var skipped = 0;
        foreach (var entry in journal)
        {
            if (!await RevertEntryAsync(biz.Db, entry))
            {
                skipped++;
            }

            entry.RevertedDate = biz.Now;
        }

        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("KI-Lauf rückgängig gemacht", nameof(AiRun), runId);
        return skipped == 0 ? "Rückgängig gemacht." : $"Rückgängig gemacht. {skipped} Wert(e) waren inzwischen von Hand geändert und blieben, wie sie sind.";
    }

    /// <summary>
    /// Takes back one journal entry; false when the record is gone or somebody changed the value since. The actions that change data (data import, data
    /// fill) add their entity types here.
    /// </summary>
    private static Task<bool> RevertEntryAsync(DtDbContext db, AiJournalEntry entry) => Task.FromResult(false);

    /// <summary>"Weitermachen": a run that hung or failed is started again with the same action.</summary>
    public static async Task<string> ContinueAsync(Biz biz, long runId, string? address)
    {
        biz.RequireAdmin();
        var run = await biz.Db.AiRun.AsNoTracking().FirstOrDefaultAsync(r => r.Id == runId) ?? throw new BizException("Den Lauf gibt es nicht.");
        if (run.Status is not (AiRunStatus.Stuck or AiRunStatus.Error or AiRunStatus.LimitReached or AiRunStatus.Waiting))
        {
            throw new BizException("Nur ein Lauf, der hängt, wartet oder fehlgeschlagen ist, kann weitermachen.");
        }

        return run.Action switch
        {
            AiAction.Test => await TestAsync(biz, address),
            _ => throw new BizException("Diesen Lauf startet man an seiner Stelle neu."),
        };
    }

    public sealed record Usage(int TodayTokens, int MonthTokens, int TodayRuns, int MonthRuns);

    public static async Task<Usage> UsageAsync(Biz biz)
    {
        biz.RequireAdmin();
        var now = biz.Now;
        var month = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var runs = biz.Db.AiRun.AsNoTracking();
        return new Usage(
            await runs.Where(r => r.StartDate >= now.Date).SumAsync(r => r.PromptTokens + r.CompletionTokens),
            await runs.Where(r => r.StartDate >= month).SumAsync(r => r.PromptTokens + r.CompletionTokens),
            await runs.CountAsync(r => r.StartDate >= now.Date),
            await runs.CountAsync(r => r.StartDate >= month));
    }

    // ================================================================================================ helpers

    internal static async Task RejectAsync(DtDbContext db, AiRun run, string reason)
    {
        run.Status = AiRunStatus.Error;
        run.Error = reason;
        Warn(run, reason);
        await db.SaveChangesAsync();
    }

    internal static void Warn(AiRun run, string text) => run.Steps.Add(new AiRunStep { Kind = AiStepKind.Warning, Text = text, Number = run.Steps.Count + 1, OccurredDate = DateTime.UtcNow });

    internal static string Limit(string? text, int max)
    {
        var t = text ?? "";
        return t.Length <= max ? t : t[..max] + " …";
    }
}
