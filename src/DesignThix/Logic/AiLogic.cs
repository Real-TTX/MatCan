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
/// The actions themselves live in <see cref="AiDataLogic"/> (data import, data fill) and <see cref="AiTextLogic"/> (text suggestions).
/// </summary>
public static class AiLogic
{
    /// <summary>The outcome of a run for its caller: the run (with its status), the checked JSON object, or what went wrong (with a code the pages use).</summary>
    public sealed record Outcome(AiRun Run, JsonElement? Result, string? Error, string? Code = null)
    {
        public bool Ok => Error is null && Result is not null;
    }

    /// <summary>The reason codes of <see cref="Outcome.Code"/>.</summary>
    public static class Codes
    {
        public const string Disabled = "disabled";
        public const string NotConfigured = "not-configured";
        public const string Limit = "limit";
        public const string Refused = "refused";
        public const string Failed = "failed";
    }

    /// <summary>
    /// What a run is asked to do: the action, the situation text the model sees, the instruction of the person for this step, what it works on (for the run list),
    /// a <paramref name="Refusal"/> (the run is cancelled with this reason before anything is sent, e.g. a list with personal data) and the request as JSON (for "Weitermachen").
    /// </summary>
    internal sealed record Call(AiAction Action, string Situation, string? StepInstruction, string? SubjectType, long? SubjectId, long? UserId, string? Address,
        string? Refusal = null, string? RequestJson = null);

    /// <summary>The exact text of a call: the system message and the situation. This is what the run sends and what "Vollständige Anweisung anzeigen" shows.</summary>
    internal static (string System, string Situation) Compose(IServiceProvider services, Call call)
    {
        var store = services.GetRequiredService<SettingStore>();
        var system = AiInstructions.SystemText(services.GetRequiredService<ConfigStore>().Current.Ai, store.Get<AiSettings>(SettingStore.Ai), store.Get<SiteSettings>(SettingStore.Site), call.Action, call.StepInstruction);
        return (system, call.Situation);
    }

    /// <summary>The text of <see cref="Compose"/> as the person reads it.</summary>
    internal static string Show(IServiceProvider services, Call call)
    {
        var (system, situation) = Compose(services, call);
        return $"[system]\n{system}\n\n[user]\n{situation}";
    }

    // ================================================================================================ the run

    internal static async Task<Outcome> RunAsync(DtDbContext db, IServiceProvider services, Call call, CancellationToken ct = default)
    {
        var store = services.GetRequiredService<SettingStore>();
        var settings = store.Get<AiSettings>(SettingStore.Ai);
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
            RequestJson = call.RequestJson ?? "{}",
        };
        db.AiRun.Add(run);
        var stepNo = 0;
        void Step(AiStepKind kind, string text) => run.Steps.Add(new AiRunStep { Kind = kind, Text = Limit(text, 40_000), Number = ++stepNo, OccurredDate = clock.GetUtcNow().UtcDateTime, CreateUserId = call.UserId });

        async Task<Outcome> End(AiRunStatus status, string? error, string? code = null, JsonElement? result = null)
        {
            run.Status = status;
            run.Error = error;
            run.EndDate = clock.GetUtcNow().UtcDateTime;
            if (error is not null)
            {
                Step(status is AiRunStatus.LimitReached or AiRunStatus.Cancelled ? AiStepKind.Warning : AiStepKind.Result, error);
            }

            await db.SaveChangesAsync(CancellationToken.None);
            return new Outcome(run, result, error, code);
        }

        Step(AiStepKind.Action, $"Aktion: {UiKit.Labels.Of(call.Action)}");

        // ---- refusals and limits, before anything is sent ----
        if (call.Refusal is not null)
        {
            return await End(AiRunStatus.Cancelled, call.Refusal, Codes.Refused);
        }

        if (!settings.Enabled)
        {
            return await End(AiRunStatus.Cancelled, "Die KI ist in den Einstellungen ausgeschaltet.", Codes.Disabled);
        }

        if (!services.GetRequiredService<AiRateLimiter>().TryTake(call.Address, settings.PerMinutePerAddress))
        {
            return await End(AiRunStatus.LimitReached, "Zu viele Anfragen in kurzer Zeit. Bitte in einer Minute erneut versuchen.", Codes.Limit);
        }

        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var monthTokens = await db.AiRun.Where(r => r.StartDate >= monthStart).SumAsync(r => r.PromptTokens + r.CompletionTokens, ct);
        if (settings.MonthlyTokens > 0 && monthTokens >= settings.MonthlyTokens)
        {
            return await End(AiRunStatus.LimitReached, "Das Monatsbudget der KI ist aufgebraucht.", Codes.Limit);
        }

        if (call.UserId is { } userId)
        {
            if (settings.UserDailyTokens > 0)
            {
                var dayTokens = await db.AiRun.Where(r => r.UserId == userId && r.StartDate >= now.Date).SumAsync(r => r.PromptTokens + r.CompletionTokens, ct);
                if (dayTokens >= settings.UserDailyTokens)
                {
                    return await End(AiRunStatus.LimitReached, "Dein Tagesbudget der KI ist aufgebraucht. Morgen geht es weiter.", Codes.Limit);
                }
            }

            if (settings.UserMonthlyTokens > 0)
            {
                var userMonth = await db.AiRun.Where(r => r.UserId == userId && r.StartDate >= monthStart).SumAsync(r => r.PromptTokens + r.CompletionTokens, ct);
                if (userMonth >= settings.UserMonthlyTokens)
                {
                    return await End(AiRunStatus.LimitReached, "Dein Monatsbudget der KI ist aufgebraucht.", Codes.Limit);
                }
            }
        }

        if (run.AddressHash is { } address && settings.AddressDailyRuns > 0
            && await db.AiRun.CountAsync(r => r.AddressHash == address && r.StartDate >= now.Date, ct) >= settings.AddressDailyRuns)
        {
            return await End(AiRunStatus.LimitReached, "Von diesem Anschluss aus sind für heute keine weiteren KI-Aufrufe möglich.", Codes.Limit);
        }

        // ---- transport ----
        var transport = await TransportAsync(db, services, ct);
        if (transport is null)
        {
            return await End(AiRunStatus.Error, "Es ist keine KI eingerichtet.", Codes.NotConfigured);
        }

        run.ProfileName = transport.Name;
        run.Model = transport.Model;
        run.Transport = transport.Kind;

        // ---- instructions ----
        var (system, situation) = Compose(services, call);
        var messages = new List<AiMessage> { AiMessage.System(system), AiMessage.User(situation) };
        Step(AiStepKind.Message, $"An {transport.Name} ({transport.Model}):\n\n{system}\n\n---\n\n{situation}");

        var required = AiInstructions.RequiredField(call.Action);
        try
        {
            for (var attempt = 0; ; attempt++)
            {
                var response = await transport.CompleteAsync(new AiRequest { Messages = messages, Json = true, MaxTokens = settings.MaxTokens }, ct);
                var estimated = response.PromptTokens == 0 && response.CompletionTokens == 0;
                run.PromptTokens += estimated ? TokenEstimate.Of(messages) : response.PromptTokens;
                run.CompletionTokens += estimated ? TokenEstimate.Of(response.Text) : response.CompletionTokens;
                run.TokensEstimated |= estimated;
                if (!response.Ok)
                {
                    return await End(AiRunStatus.Error, response.Error ?? "Die KI hat nicht geantwortet.", Codes.Failed);
                }

                Step(AiStepKind.Result, response.Text ?? "");
                if (response.Note is { Length: > 0 } note)
                {
                    Step(AiStepKind.Warning, note);
                }

                var obj = LenientJson.FirstObject(response.Text);
                if (obj is { } o && o.TryGetProperty(required, out _))
                {
                    run.ResultJson = System.Text.Json.JsonSerializer.Serialize(o);
                    return await End(AiRunStatus.Done, null, null, o);
                }

                // Only an announcement ("Ich schaue mir das an ...") or another shape: at most two nudges, then the run hangs.
                if (attempt >= 2)
                {
                    return await End(AiRunStatus.Stuck, "Die KI hat nicht im verlangten Format geantwortet (zweimal angestoßen).", Codes.Failed);
                }

                run.Nudges++;
                messages.Add(AiMessage.Assistant(response.Text ?? ""));
                messages.Add(AiMessage.User(AiInstructions.Nudge(call.Action)));
                Step(AiStepKind.Warning, "Antwort ohne das verlangte JSON-Objekt: Anstoß zum Weitermachen.");
            }
        }
        catch (OperationCanceledException)
        {
            return await End(AiRunStatus.Cancelled, "Abgebrochen.", Codes.Failed);
        }
        catch (Exception ex) when (ex is not OutOfMemoryException)
        {
            services.GetRequiredService<ILoggerFactory>().CreateLogger("Ai").LogWarning(ex, "AI run failed");
            return await End(AiRunStatus.Error, "Beim Aufruf der KI ist etwas schiefgegangen: " + ex.Message, Codes.Failed);
        }
    }

    // ================================================================================================ transport: own connection, else relay

    private sealed record Transport(string Kind, string Name, string Model, Func<AiRequest, CancellationToken, Task<AiResponse>> Complete)
    {
        public Task<AiResponse> CompleteAsync(AiRequest request, CancellationToken ct) => Complete(request, ct);
    }

    private static async Task<Transport?> TransportAsync(DtDbContext db, IServiceProvider services, CancellationToken ct)
    {
        if (services.GetService<AiTestSeam>() is { Handler: { } handler } seam)
        {
            return new Transport("profile", "Testprofil", "test-model", (r, c) =>
            {
                lock (seam.Requests)
                {
                    seam.Requests.Add(r);
                }

                return handler(r, c);
            });
        }

        var config = services.GetRequiredService<ConfigStore>();
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
                    ChatCompletionsClient.CompleteAsync(http.CreateClient("ai"), profile.BaseUrl, key, profile.Model, r, settings.MaxTokens, m => logger.LogWarning("{Message}", m), c, settings.TimeoutSeconds));
            }
        }

        var op = config.Current.Ai;
        if (!string.IsNullOrWhiteSpace(op.RelayUrl))
        {
            return new Transport("relay", "Relay des Betreibers", op.RelayModel, (r, c) =>
                ChatCompletionsClient.CompleteAsync(http.CreateClient("ai"), op.RelayUrl, op.RelayKey, op.RelayModel, r, settings.MaxTokens, m => logger.LogWarning("{Message}", m), c, settings.TimeoutSeconds));
        }

        return null;
    }

    /// <summary>Whether the AI is switched on in the settings: the pages show the AI buttons only then.</summary>
    public static bool IsEnabled(Biz biz) => SettingLogic.Get<AiSettings>(biz, SettingStore.Ai).Enabled;

    /// <summary>Whether a call could go out at all (switched on and a usable profile or a relay).</summary>
    public static async Task<bool> IsAvailableAsync(Biz biz)
    {
        var settings = SettingLogic.Get<AiSettings>(biz, SettingStore.Ai);
        if (!settings.Enabled)
        {
            return false;
        }

        if (biz.Services.GetService<AiTestSeam>() is { Handler: not null })
        {
            return true;
        }

        if (!string.IsNullOrWhiteSpace(biz.Config.Current.Ai.RelayUrl))
        {
            return true;
        }

        var profile = await biz.Db.AiProfile.AsNoTracking().FirstOrDefaultAsync(p => p.IsActive);
        return profile is not null && biz.Service<AiSecretStore>().Has(profile.SecretToken, profile.Provider == AiProvider.ChatGpt ? AiSecretStore.ChatGpt : AiSecretStore.ApiKey);
    }

    /// <summary>The message for a run that did not deliver, for the person who asked: an administrator gets the way to the settings, others a neutral hint.</summary>
    public static string ReasonFor(Biz biz, Outcome outcome) => outcome.Code switch
    {
        Codes.NotConfigured => biz.IsAdmin
            ? "Es ist noch keine KI eingerichtet. Lege unter Verwaltung → KI → Profile eine Verbindung an und mach sie aktiv."
            : "Die KI ist noch nicht eingerichtet. Bitte wende dich an einen Administrator.",
        Codes.Disabled => biz.IsAdmin ? "Die KI ist ausgeschaltet (Verwaltung → KI → Allgemein)." : "Die KI ist ausgeschaltet.",
        _ => outcome.Error ?? "Die KI hat nicht geantwortet.",
    };

    /// <summary>Where an administrator can fix a missing or switched-off AI; null for everybody else.</summary>
    public static string? SettingsLinkFor(Biz biz, Outcome outcome)
        => !biz.IsAdmin ? null : outcome.Code switch
        {
            Codes.NotConfigured => "/Admin/Ai/Profiles",
            Codes.Disabled => "/Admin/Ai",
            _ => null,
        };

    // ================================================================================================ settings page: test and the full instruction

    public static async Task<string> TestAsync(Biz biz, string? address)
    {
        biz.RequireAdmin();
        var outcome = await RunAsync(biz.Db, biz.Services, new Call(AiAction.Test, "Bitte bestätige kurz, dass du erreichbar bist.", null, null, null, biz.UserId, address));
        return outcome.Ok
            ? $"Verbindung steht ({outcome.Run.ProfileName}, {outcome.Run.Model}): {outcome.Result!.Value.Text("message")}"
            : $"Fehlgeschlagen: {ReasonFor(biz, outcome)}";
    }

    /// <summary>"Vollständige Anweisung anzeigen" on the settings page: the text of an action with a sketch of the situation (the real one depends on the data).</summary>
    public static string FullInstruction(Biz biz, AiAction action)
    {
        biz.RequireAdmin();
        var situation = action switch
        {
            AiAction.Test => "Bitte bestätige kurz, dass du erreichbar bist.",
            AiAction.DataImport => "(die Lage: die Spalten der Datenliste mit Art und Beschriftung, die erlaubten Medien, der Text der Person)",
            AiAction.DataFill => "(die Lage: die Zielspalte, die ausgewählten Zeilen mit den gewählten Spalten)",
            _ => "(die Lage: der Text des Elements, die Felder des Designs mit Beispielwerten)",
        };
        return Show(biz.Services, new Call(action, situation, action == AiAction.Test ? null : "(was die Person im Dialog schreibt)", null, null, null, null));
    }

    // ================================================================================================ runs, journal, undo

    public static IQueryable<AiRun> Runs(Biz biz)
    {
        biz.RequireAdmin();
        return biz.Db.AiRun.AsNoTracking();
    }

    /// <summary>What a run worked on, for the run list and the details: the name and a link (null when the record is gone).</summary>
    public sealed record Subject(string Kind, string Name, string? Href);

    public sealed record RunDetails(AiRun Run, List<AiJournalEntry> Journal, bool CanUndo, string? UndoBlockedBy, Subject? Subject, string? OpenHref);

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
        var subject = (await SubjectsAsync(biz, [run])).GetValueOrDefault(run.Id);
        var open = run.Status == AiRunStatus.Waiting && run.Action is AiAction.DataImport or AiAction.DataFill && run.SubjectType == nameof(DataList) && subject?.Href is { } href
            ? href + (href.Contains('?') ? "&" : "?") + "aiRun=" + run.Id
            : null;
        return new RunDetails(run, journal, journal.Any(j => j.RevertedDate is null) && blocker is null, blocker is null ? null : $"Erst Lauf #{blocker} rückgängig machen (neuester zuerst).", subject, open);
    }

    /// <summary>The subjects (data list, design) of some runs, by run id. A record that is gone has no entry.</summary>
    public static async Task<Dictionary<long, Subject>> SubjectsAsync(Biz biz, IEnumerable<AiRun> runs)
    {
        biz.RequireAdmin();
        var list = runs.ToList();
        var result = new Dictionary<long, Subject>();
        var listIds = list.Where(r => r.SubjectType == nameof(DataList) && r.SubjectId is not null).Select(r => r.SubjectId!.Value).Distinct().ToList();
        var designIds = list.Where(r => r.SubjectType == nameof(Design) && r.SubjectId is not null).Select(r => r.SubjectId!.Value).Distinct().ToList();
        var lists = listIds.Count == 0 ? [] : await biz.Db.DataList.AsNoTracking().Where(l => listIds.Contains(l.Id)).ToDictionaryAsync(l => l.Id, l => l.Name);
        var designs = designIds.Count == 0 ? [] : await biz.Db.Design.AsNoTracking().Where(d => designIds.Contains(d.Id)).ToDictionaryAsync(d => d.Id, d => d.Name);
        foreach (var run in list)
        {
            if (run.SubjectId is not { } subjectId)
            {
                continue;
            }

            if (run.SubjectType == nameof(DataList) && lists.TryGetValue(subjectId, out var listName))
            {
                result[run.Id] = new Subject("Datenliste", listName, $"/DataLists/Edit/{subjectId}?tab=rows");
            }
            else if (run.SubjectType == nameof(Design) && designs.TryGetValue(subjectId, out var designName))
            {
                result[run.Id] = new Subject("Design", designName, $"/Designs/{subjectId}");
            }
        }

        return result;
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
        var types = open.Select(j => j.EntityType).Distinct().ToList();
        var ids = open.Select(j => j.EntityId).Distinct().ToList();
        var keys = open.Select(j => j.EntityType + ":" + j.EntityId).ToHashSet();
        var newer = await db.AiJournalEntry.AsNoTracking()
            .Where(j => j.AiRunId > runId && j.RevertedDate == null && types.Contains(j.EntityType) && ids.Contains(j.EntityId))
            .Select(j => new { j.AiRunId, j.EntityType, j.EntityId })
            .ToListAsync();
        return newer.Where(n => keys.Contains(n.EntityType + ":" + n.EntityId)).OrderByDescending(n => n.AiRunId).Select(n => (long?)n.AiRunId).FirstOrDefault();
    }

    /// <summary>One run in the short list on a page of its subject.</summary>
    public sealed record RunLine(long Id, AiAction Action, AiRunStatus Status, DateTime StartDate, string? Who, int Tokens, bool Estimated, int Changes, int Open, string? Error);

    /// <summary>
    /// The newest runs on one record (a data list, a design), for the panel on its page: a designer sees their own, an administrator everybody's. Everybody who may use the AI
    /// there can take back what they changed ("Rückgängig"), an administrator also that of others.
    /// </summary>
    public static async Task<List<RunLine>> RunsOfAsync(Biz biz, string subjectType, long subjectId, int take = 8)
    {
        biz.RequireDesigner();
        var query = biz.Db.AiRun.AsNoTracking().Where(r => r.SubjectType == subjectType && r.SubjectId == subjectId && r.Action != AiAction.Test);
        if (!biz.IsAdmin)
        {
            var me = biz.UserId;
            query = query.Where(r => r.UserId == me);
        }

        var runs = await query.OrderByDescending(r => r.Id).Take(take).ToListAsync();
        var ids = runs.Select(r => r.Id).ToList();
        var journal = await biz.Db.AiJournalEntry.AsNoTracking().Where(j => ids.Contains(j.AiRunId)).Select(j => new { j.AiRunId, j.RevertedDate }).ToListAsync();
        var userIds = runs.Where(r => r.UserId is not null).Select(r => r.UserId!.Value).Distinct().ToList();
        var names = await biz.Db.User.AsNoTracking().Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.DisplayName);
        return [.. runs.Select(r => new RunLine(r.Id, r.Action, r.Status, r.StartDate, r.UserId is { } uid && names.TryGetValue(uid, out var n) ? n : null, r.TotalTokens, r.TokensEstimated,
            journal.Count(j => j.AiRunId == r.Id), journal.Count(j => j.AiRunId == r.Id && j.RevertedDate is null), r.Error))];
    }

    /// <summary>
    /// Takes back what a run changed, newest run first. A designer may take back their own runs, an administrator any. A value somebody changed since is left alone
    /// (and said so).
    /// </summary>
    public static async Task<string> UndoAsync(Biz biz, long runId)
    {
        biz.RequireDesigner();
        var run = await biz.Db.AiRun.AsNoTracking().FirstOrDefaultAsync(r => r.Id == runId) ?? throw new BizException("Den Lauf gibt es nicht.");
        if (!biz.IsAdmin && run.UserId != biz.UserId)
        {
            throw new ForbiddenException("Du kannst nur deine eigenen KI-Läufe rückgängig machen.");
        }

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
        var touched = new HashSet<long>();
        foreach (var entry in journal)
        {
            if (!await RevertEntryAsync(biz.Db, entry, touched))
            {
                skipped++;
            }

            entry.RevertedDate = biz.Now;
        }

        if (touched.Count > 0)
        {
            foreach (var list in await biz.Db.DataList.Where(l => touched.Contains(l.Id)).ToListAsync())
            {
                list.Revision++;
            }
        }

        try
        {
            await biz.Db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new BizException("Jemand hat die Datenliste gerade geändert. Bitte versuche es gleich noch einmal.");
        }

        await biz.Log.LogAsync("KI-Lauf rückgängig gemacht", nameof(AiRun), runId, UiKit.Labels.Of(run.Action));
        return skipped == 0 ? "Rückgängig gemacht." : $"Rückgängig gemacht. {skipped} Eintrag/Einträge waren inzwischen von Hand geändert und blieben, wie sie sind.";
    }

    /// <summary>Takes back one journal entry; false when the record is gone or somebody changed the value since.</summary>
    private static Task<bool> RevertEntryAsync(DtDbContext db, AiJournalEntry entry, HashSet<long> touchedLists)
        => entry.EntityType == nameof(DataRow) ? AiDataLogic.RevertAsync(db, entry, touchedLists) : Task.FromResult(false);

    /// <summary>"Weitermachen": a run that hung or failed is started again with the same request.</summary>
    public static async Task<(string Message, long? RunId)> ContinueAsync(Biz biz, long runId, string? address)
    {
        biz.RequireAdmin();
        var run = await biz.Db.AiRun.AsNoTracking().FirstOrDefaultAsync(r => r.Id == runId) ?? throw new BizException("Den Lauf gibt es nicht.");
        if (run.Status is not (AiRunStatus.Stuck or AiRunStatus.Error or AiRunStatus.LimitReached or AiRunStatus.Cancelled))
        {
            throw new BizException("Nur ein Lauf, der hängt oder fehlgeschlagen ist, kann weitermachen.");
        }

        return run.Action switch
        {
            AiAction.Test => (await TestAsync(biz, address), null),
            AiAction.DataImport or AiAction.DataFill => await AiDataLogic.ContinueAsync(biz, run, address),
            _ => throw new BizException("Diesen Lauf startet man an seiner Stelle neu (im Designer)."),
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

    internal static void Warn(AiRun run, string text, TimeProvider clock)
        => run.Steps.Add(new AiRunStep { Kind = AiStepKind.Warning, Text = Limit(text, 40_000), Number = run.Steps.Count + 1, OccurredDate = clock.GetUtcNow().UtcDateTime });

    internal static void Note(AiRun run, AiStepKind kind, string text, TimeProvider clock)
        => run.Steps.Add(new AiRunStep { Kind = kind, Text = Limit(text, 40_000), Number = run.Steps.Count + 1, OccurredDate = clock.GetUtcNow().UtcDateTime });

    internal static string Limit(string? text, int max)
    {
        var t = text ?? "";
        return t.Length <= max ? t : t[..max] + " …";
    }
}
