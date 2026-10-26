using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using DesignThix.Core.Ai;
using DesignThix.Data;
using DesignThix.Data.Entities;
using DesignThix.Services;
using DesignThix.Services.Ai;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Logic;

/// <summary>A message as the model sees it. <c>Tool</c> marks the results of tools (so older ones can be shortened), <c>Run</c> the run it belongs to.</summary>
public sealed record HistoryMessage(string Role, string Content, bool Tool = false, int Run = 0);

/// <summary>
/// One run of the design assistant (docs/PLAN-AI-DESIGN.md 3.1), the loop of MatCMS's assistant: the message of the person is in the history; now the model and the tools take turns until the model says it is
/// done (or asks something back). The model answers every call with one JSON object (<see cref="AgentProtocol"/>); its actions run in order, each as its own step; their results go back as ONE message. Every
/// message, action and error is a step in the database the moment it happens, so the editor can show the work (polling) instead of waiting for a result. Bounded: at most
/// <see cref="AiSettings.AgentMaxCallsPerRun"/> calls, <see cref="AgentProtocol.MaxActionsPerReply"/> actions per answer; a run that hits the limit stops and says so. Every run ends with an <c>End</c> step.
/// </summary>
public static class AiAgentLoop
{
    /// <summary>A busy or slow provider is asked again this often (after a growing pause) before the run gives up.</summary>
    public const int MaxRetries = 2;

    /// <summary>How often a model that only ANNOUNCED its next step is told to go on, and how often a wrong format is asked for again.</summary>
    public const int MaxNudges = 2;

    /// <summary>The first pause before asking again (then four times as long). A field so the tests need not wait.</summary>
    public static TimeSpan RetryPause { get; set; } = TimeSpan.FromSeconds(5);

    /// <summary>Older tool results are shortened to this in the request; the newest few stay whole.</summary>
    public const int OldResultChars = 2500;

    public const int KeepWholeResults = 4;

    /// <summary>The request never gets longer than this (characters of all messages); the oldest messages go first.</summary>
    public const int MaxHistoryChars = 400_000;

    /// <summary>An answer of the model that is an error worth one more try: timeouts, rate limits, the provider's own 5xx, a broken connection.</summary>
    public static bool Transient(string? error)
    {
        var e = (error ?? "").ToLowerInvariant();
        return e.Contains("nicht rechtzeitig") || e.Contains("timeout") || e.Contains("429") || e.Contains("überlast") || e.Contains("rate limit")
            || System.Text.RegularExpressions.Regex.IsMatch(e, @"\b5\d\d\b") || e.Contains("verbindung") || e.Contains("unterbrochen");
    }

    public static List<HistoryMessage> ReadHistory(string? json)
    {
        try
        {
            return JsonSerializer.Deserialize<List<HistoryMessage>>(json ?? "[]", new JsonSerializerOptions(JsonSerializerDefaults.Web)) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    public static string WriteHistory(List<HistoryMessage> history) => JsonSerializer.Serialize(history, new JsonSerializerOptions(JsonSerializerDefaults.Web));

    // ================================================================================================ the request

    /// <summary>
    /// The messages of one call: the system text, then the history. Results of tools older than the newest <see cref="KeepWholeResults"/> are cut to <see cref="OldResultChars"/>; the long texts of attachments of
    /// earlier runs are cut too; when everything is still too long the oldest messages go (the first of the current run stays). The pictures of THIS run ride on its user message (earlier runs' pictures are
    /// not sent again); <paramref name="extraPictures"/> (what <c>look</c> drew) ride on the last message and are for this one call only.
    /// </summary>
    public static List<AiMessage> Messages(string system, List<HistoryMessage> history, int runNumber, int imageIndex, IReadOnlyList<Core.Ai.AiAttachment> images, IReadOnlyList<Core.Ai.AiAttachment>? extraPictures = null)
    {
        var toolIdx = history.Select((m, i) => (m, i)).Where(x => x.m.Tool).Select(x => x.i).ToList();
        var keepWhole = toolIdx.Skip(Math.Max(0, toolIdx.Count - KeepWholeResults)).ToHashSet();
        var items = new List<(int Index, AiMessage Message)>();
        for (var i = 0; i < history.Count; i++)
        {
            var m = history[i];
            var content = m.Content;
            if (m.Tool && !keepWhole.Contains(i) && content.Length > OldResultChars)
            {
                content = content[..OldResultChars] + " …[älteres Ergebnis gekürzt – bei Bedarf neu lesen]";
            }
            else if (!m.Tool && m.Role == "user" && m.Run != runNumber && content.Length > 6000)
            {
                content = content[..6000] + " …[älterer Anhangstext gekürzt]";
            }

            var message = new AiMessage { Role = m.Role == "assistant" ? "assistant" : "user", Content = content };
            if (i == imageIndex && images.Count > 0)
            {
                message.Attachments = [.. images];
            }

            items.Add((i, message));
        }

        // too long: the oldest messages go, in pairs, but never the message that started the current run
        var total = items.Sum(x => x.Message.Content.Length) + system.Length;
        var firstOfRun = items.FindIndex(x => history[x.Index].Run == runNumber && !history[x.Index].Tool && history[x.Index].Role == "user");
        while (total > MaxHistoryChars && items.Count > 1 && (firstOfRun < 0 || firstOfRun > 0))
        {
            total -= items[0].Message.Content.Length;
            items.RemoveAt(0);
            if (firstOfRun > 0)
            {
                firstOfRun--;
            }
        }

        var list = new List<AiMessage> { new() { Role = "system", Content = system } };
        list.AddRange(items.Select(x => x.Message));
        if (extraPictures is { Count: > 0 } && list.Count > 1)
        {
            // the picture belongs to the results message that ends the history; on a model that reads no pictures it falls away with a note
            var last = list[^1];
            last.Attachments = [.. last.Attachments, .. extraPictures];
        }

        return list;
    }

    private static string Trim(string? s, int max) => (s ?? "").Length > max ? s![..max] : s ?? "";

    // ================================================================================================ the run

    /// <summary>
    /// Runs the message of the conversation (its newest run) to the end. Needs a <see cref="Biz"/> of the person who sent it (the tools check access as that person). Never throws except for a bug: whatever
    /// goes wrong becomes an error step and an end state.
    /// </summary>
    public static async Task RunAsync(Biz biz, long conversationId, string? address, CancellationToken ct)
    {
        biz.RequireSignedIn();
        var db = biz.Db;
        var services = biz.Services;
        var conv = await db.AiConversation.FirstOrDefaultAsync(c => c.Id == conversationId, CancellationToken.None);
        if (conv is null)
        {
            return;
        }

        if (conv.UserId != biz.UserId)
        {
            throw new NotFoundException();   // a run works as the person who sent the message, nobody else's
        }

        var run = await db.AiRun.FirstOrDefaultAsync(r => r.ConversationId == conversationId && r.Number == conv.Runs, CancellationToken.None);
        if (run is null || run.Status != AiRunStatus.Running)
        {
            return;
        }

        var settings = biz.Service<SettingStore>().Get<AiSettings>(SettingStore.Ai);
        var clock = biz.Clock;
        var partial = biz.Service<AiPartialStore>();
        var broker = biz.Service<AiRenderBroker>();
        var history = ReadHistory(conv.HistoryJson);
        var number = await db.AiRunStep.Where(s => s.AiRunId == run.Id).Select(s => (int?)s.Number).MaxAsync(CancellationToken.None) ?? 0;
        (string State, string Text) end = ("stalled", "Die KI hat aufgehört, ohne den Auftrag abzuschließen.");
        var session = new AiToolSession
        {
            ConversationId = conv.Id,
            RunId = run.Id,
            RunNumber = run.Number,
            DesignId = conv.SubjectId,
            UserId = conv.UserId,
            Scope = AiScope.Parse(conv.ScopeJson),
            Note = "KI: " + Trim(conv.Title, 80),
            MaxLooks = Math.Max(0, settings.AgentMaxLooks),
            PictureFolder = Path.Combine(AiAttachmentLogic.Root(biz), conv.Id.ToString(CultureInfo.InvariantCulture)),
        };

        async Task Step(AiStepKind kind, string text, JsonObject? data = null)
        {
            db.AiRunStep.Add(new AiRunStep
            {
                AiRunId = run.Id,
                Number = ++number,
                Kind = kind,
                Text = AiLogic.Limit(text, 40_000),
                OccurredDate = clock.GetUtcNow().UtcDateTime,
                DataJson = data?.ToJsonString(new JsonSerializerOptions { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping }) ?? "{}",
            });
            await db.SaveChangesAsync(CancellationToken.None);
        }

        try
        {
            // what the run may read: the references of the conversation (data lists), the images that came with it
            var attachments = await db.AiAttachment.AsNoTracking().Where(a => a.ConversationId == conv.Id && a.Refused == null).ToListAsync(CancellationToken.None);
            foreach (var a in attachments)
            {
                if (a is { RefKind: "datalist", RefId: { } listId })
                {
                    session.ReferencedLists.Add(listId);
                }

                if (a.AssetId is { } assetId)
                {
                    session.AttachmentAssets.Add(assetId);
                }
            }

            var images = await AiAttachmentLogic.ModelImagesAsync(biz, conv.Id, run.Number);
            var imageIndex = history.FindLastIndex(m => m.Run == run.Number && m.Role == "user" && !m.Tool);

            var transport = await AiLogic.TransportAsync(db, services, ct);
            if (transport is null)
            {
                await Step(AiStepKind.Error, "Es ist keine KI eingerichtet.");
                end = ("error", "Es ist keine KI eingerichtet.");
                return;
            }

            run.ProfileName = transport.Name;
            run.Model = transport.Model;
            run.Transport = transport.Kind;
            await db.SaveChangesAsync(CancellationToken.None);

            var badAnswers = 0;
            var nudges = 0;
            var retries = 0;
            var recorded = false;
            var maxCalls = Math.Clamp(settings.AgentMaxCallsPerRun, 1, 200);
            for (var call = 0; call < maxCalls; call++)
            {
                ct.ThrowIfCancellationRequested();
                settings = biz.Service<SettingStore>().Get<AiSettings>(SettingStore.Ai);
                if (!settings.Enabled)
                {
                    await Step(AiStepKind.Error, "Die KI ist in den Einstellungen ausgeschaltet.");
                    end = ("error", "Die KI ist in den Einstellungen ausgeschaltet.");
                    break;
                }

                // the limits count per call: the budgets and the brake per address and minute
                if (await AiLogic.BudgetReasonAsync(db, settings, conv.UserId, clock.GetUtcNow().UtcDateTime, CancellationToken.None) is { } budget)
                {
                    await Step(AiStepKind.Info, budget);
                    end = ("limit", budget);
                    break;
                }

                if (!services.GetRequiredService<AiRateLimiter>().TryTake(address, settings.PerMinutePerAddress))
                {
                    await Step(AiStepKind.Info, AiLogic.RateReason);
                    end = ("limit", AiLogic.RateReason);
                    break;
                }

                var design = await AiAgentLogic.LoadDesignAsync(biz, conv.SubjectId);
                var (system, situation) = await AiAgentLogic.ComposeAsync(biz, design, session.Scope, conv.Id, AutoFormat(conv));
                var fullSystem = system + "\n\n## Die Lage\n" + situation;
                if (!recorded)
                {
                    recorded = true;
                    await Step(AiStepKind.Message, $"An {transport.Name} ({transport.Model}):\n\n{fullSystem}");
                }

                var pictures = session.PicturesForNextCall.ToList();
                session.PicturesForNextCall.Clear();
                var messages = Messages(fullSystem, history, run.Number, imageIndex, images, pictures);
                var request = new AiRequest { Messages = messages, Json = true, MaxTokens = Math.Clamp(settings.AgentMaxTokens, 1000, 64_000), OnDelta = piece => partial.Append(run.Id, piece) };
                partial.Begin(run.Id);
                AiResponse answer;
                try
                {
                    answer = await transport.CompleteAsync(request, ct);
                }
                finally
                {
                    partial.End(run.Id);
                }

                var estimated = answer.PromptTokens == 0 && answer.CompletionTokens == 0;
                var promptTokens = estimated ? TokenEstimate.Of(messages) : answer.PromptTokens;
                var completionTokens = estimated ? TokenEstimate.Of(answer.Text) : answer.CompletionTokens;
                run.PromptTokens += promptTokens;
                run.CompletionTokens += completionTokens;
                run.TokensEstimated |= estimated;
                conv.Tokens += promptTokens + completionTokens;
                var meta = new JsonObject
                {
                    ["model"] = transport.Model,
                    ["tokens"] = promptTokens + completionTokens,
                    ["note"] = answer.Note,
                    ["raw"] = Trim(answer.Text, 20_000),
                };

                if (!answer.Ok)
                {
                    // a provider that is busy or slow for a moment is asked again (it does not count as a call); anything else ends the run
                    if (retries < MaxRetries && Transient(answer.Error))
                    {
                        retries++;
                        await Step(AiStepKind.Info, $"Der KI-Anbieter antwortet gerade nicht ({answer.Error}) – neuer Versuch {retries}/{MaxRetries} …");
                        await Task.Delay(RetryPause * (retries * retries), ct);
                        call--;
                        continue;
                    }

                    await Step(AiStepKind.Error, answer.Error ?? "Der KI-Aufruf ist fehlgeschlagen.", meta);
                    end = ("error", "Der KI-Anbieter hat einen Fehler gemeldet.");
                    break;
                }

                retries = 0;
                if (answer.Note is { Length: > 0 } note)
                {
                    await Step(AiStepKind.Info, note);
                }

                var parsed = AgentProtocol.Parse(answer.Text);
                if (parsed is null)
                {
                    history.Add(new HistoryMessage("assistant", Trim(answer.Text, 4000), false, run.Number));
                    if (badAnswers++ < MaxNudges)
                    {
                        history.Add(new HistoryMessage("user", "Deine letzte Antwort war nicht das verlangte JSON-Objekt {\"message\", \"actions\", \"done\"}. Antworte jetzt NUR mit diesem JSON-Objekt.", false, run.Number));
                        await Step(AiStepKind.Info, "Die Antwort hatte nicht das verlangte Format – die KI wird noch einmal gefragt.", meta);
                        continue;
                    }

                    await Step(AiStepKind.Assistant, answer.Text ?? "", meta);
                    end = ("stalled", "Die KI hat nicht im verlangten Format geantwortet.");
                    break;
                }

                history.Add(new HistoryMessage("assistant", parsed.Canonical, false, run.Number));
                meta["actions"] = parsed.Actions.Count;
                // a last answer that acts AND says it is done describes the result ("Erledigt: …"): shown after its actions, where it reads true
                var closing = parsed.Done && parsed.Actions.Count > 0 && parsed.Message.Length > 0;
                if (!closing)
                {
                    await Step(AiStepKind.Assistant, parsed.Message, meta);
                }

                if (parsed.Actions.Count == 0)
                {
                    if (parsed.Done || AgentProtocol.AsksUser(parsed.Message))
                    {
                        end = AgentProtocol.AsksUser(parsed.Message) ? ("waiting", "Die KI wartet auf deine Antwort.") : ("done", "Fertig.");
                        break;
                    }

                    // "done": false and nothing to do: it announced the next step instead of taking it. It is told to go on, twice; then the run stops and says so
                    if (nudges++ < MaxNudges)
                    {
                        history.Add(new HistoryMessage("user", "Du hast \"done\": false gesetzt, aber keine Aktion geschickt. Mach jetzt weiter und schicke die nächsten Aktionen. "
                            + "Ist der Auftrag erledigt, antworte mit \"done\": true und einer kurzen Zusammenfassung. Brauchst du eine Antwort der Person, stelle die Frage und setze \"done\": true.", false, run.Number));
                        await SaveHistoryAsync(db, conv, history);
                        continue;
                    }

                    end = ("stalled", "Die KI hat nicht weitergemacht.");
                    break;
                }

                nudges = 0;
                var results = new JsonArray();
                var problems = false;
                foreach (var action in parsed.Actions.Take(AgentProtocol.MaxActionsPerReply))
                {
                    ct.ThrowIfCancellationRequested();
                    ToolOutcome outcome;
                    try
                    {
                        outcome = await AiDesignTools.RunAsync(biz, session, action.Tool, action.Args, ct);
                    }
                    catch (Exception ex) when (ex is NotFoundException or ForbiddenException)
                    {
                        await Step(AiStepKind.Error, "Dir fehlt inzwischen die Berechtigung für dieses Design: der Auftrag endet hier.");
                        end = ("error", "Die Berechtigung für das Design fehlt.");
                        problems = true;
                        goto finished;
                    }

                    problems |= !outcome.Ok || outcome.Warnings.Count > 0;
                    await Step(AiStepKind.Action, outcome.Summary, ActionData(action, outcome));
                    results.Add(new JsonObject
                    {
                        ["tool"] = action.Tool,
                        ["ok"] = outcome.Ok,
                        ["summary"] = outcome.Summary,
                        ["result"] = outcome.Result?.DeepClone(),
                        ["warnings"] = new JsonArray(outcome.Warnings.Select(w => (JsonNode)JsonValue.Create(w)!).ToArray()),
                    });
                }

                if (parsed.Actions.Count > AgentProtocol.MaxActionsPerReply)
                {
                    results.Add(new JsonObject { ["note"] = $"Nur die ersten {AgentProtocol.MaxActionsPerReply} Aktionen wurden ausgeführt – schicke den Rest im nächsten Schritt." });
                }

                history.Add(new HistoryMessage("user", "Ergebnisse der Aktionen:\n" + results.ToJsonString(new JsonSerializerOptions { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping }), true, run.Number));
                await SaveHistoryAsync(db, conv, history);
                if (closing)
                {
                    await Step(AiStepKind.Assistant, parsed.Message, meta);
                }

                // "done" with actions that all went through ends the run; a refusal or a warning gives the model one more look
                if (parsed.Done && !problems)
                {
                    end = ("done", "Fertig.");
                    break;
                }

                if (call == maxCalls - 1)
                {
                    end = ("limit", $"Nach {maxCalls} Schritten angehalten, damit ein Auftrag nicht endlos läuft.");
                }
            }

        finished:;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            end = ("cancelled", "Abgebrochen.");
        }
        catch (Exception ex) when (ex is not OutOfMemoryException)
        {
            services.GetRequiredService<ILoggerFactory>().CreateLogger("AiAgent").LogError(ex, "Design assistant run {Run} of conversation {Conversation} failed", run.Number, conv.Id);
            try
            {
                await Step(AiStepKind.Error, "Interner Fehler: " + ex.GetBaseException().Message);
            }
            catch (Exception)
            {
                // the context is no good any more: the end below is written through a fresh one
            }

            end = ("error", "Ein interner Fehler hat den Auftrag beendet.");
        }
        finally
        {
            partial.End(run.Id);
            broker.Forget(run.Id);
            await FinishAsync(biz, conv.Id, run.Id, end, run.PromptTokens, run.CompletionTokens, run.TokensEstimated, run.ProfileName, run.Model, run.Transport, history);
        }
    }

    private static bool AutoFormat(AiConversation conv)
    {
        // only the very first run of a conversation that was started from a prompt without a chosen format
        if (conv.Runs != 1)
        {
            return false;
        }

        try
        {
            return JsonNode.Parse(conv.ScopeJson) is JsonObject o && AiDocOps.Flag(o["autoFormat"]);
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static async Task SaveHistoryAsync(DtDbContext db, AiConversation conv, List<HistoryMessage> history)
    {
        conv.HistoryJson = WriteHistory(history);
        await db.SaveChangesAsync(CancellationToken.None);
    }

    /// <summary>The data of an action step: the call, what became of it, and what the editor should show; a long result is cut (the model got all of it).</summary>
    private static JsonObject ActionData(AgentAction action, ToolOutcome outcome)
    {
        var result = outcome.Result;
        if (result is not null && result.ToJsonString().Length > 12_000)
        {
            var text = result.ToJsonString();
            result = new JsonObject { ["truncated"] = true, ["chars"] = text.Length, ["preview"] = text[..2000] };
        }

        return new JsonObject
        {
            ["tool"] = action.Tool,
            ["args"] = action.Args.DeepClone(),
            ["ok"] = outcome.Ok,
            ["summary"] = outcome.Summary,
            ["warnings"] = new JsonArray(outcome.Warnings.Select(w => (JsonNode)JsonValue.Create(w)!).ToArray()),
            ["result"] = result?.DeepClone(),
            ["pageId"] = outcome.PageId,
            ["elementIds"] = new JsonArray((outcome.ElementIds ?? []).Take(100).Select(i => (JsonNode)JsonValue.Create(i)!).ToArray()),
            ["changed"] = outcome.Changed,
            ["revision"] = outcome.Revision,
            ["picture"] = outcome.Picture,
        };
    }

    /// <summary>
    /// Writes how the run ended: the state of the run, the history, the tokens, the end step, the conversation idle. Through a fresh scope, so a context that a failed step left in a bad state cannot stop
    /// the end from being written.
    /// </summary>
    private static async Task FinishAsync(Biz biz, long conversationId, long runId, (string State, string Text) end, int promptTokens, int completionTokens, bool estimated, string profile, string model, string transport, List<HistoryMessage> history)
    {
        using var scope = biz.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DtDbContext>();
        var now = biz.Clock.GetUtcNow().UtcDateTime;
        var run = await db.AiRun.FirstOrDefaultAsync(r => r.Id == runId);
        if (run is not null)
        {
            run.Status = end.State switch
            {
                "done" => AiRunStatus.Done,
                "waiting" => AiRunStatus.Waiting,
                "limit" => AiRunStatus.LimitReached,
                "error" => AiRunStatus.Error,
                "cancelled" => AiRunStatus.Cancelled,
                _ => AiRunStatus.Stuck,
            };
            run.Error = end.State is "done" or "waiting" ? null : end.Text;
            run.EndDate = now;
            run.PromptTokens = promptTokens;
            run.CompletionTokens = completionTokens;
            run.TokensEstimated = estimated;
            run.ProfileName = profile;
            run.Model = model;
            run.Transport = transport;
            var number = await db.AiRunStep.Where(s => s.AiRunId == runId).Select(s => (int?)s.Number).MaxAsync() ?? 0;
            db.AiRunStep.Add(new AiRunStep
            {
                AiRunId = runId,
                Number = number + 1,
                Kind = AiStepKind.End,
                Text = end.Text,
                OccurredDate = now,
                DataJson = new JsonObject { ["state"] = end.State }.ToJsonString(),
            });
        }

        var conv = await db.AiConversation.FirstOrDefaultAsync(c => c.Id == conversationId);
        if (conv is not null)
        {
            conv.Status = AiConversationStatus.Idle;
            conv.HistoryJson = WriteHistory(history);
            var tokens = await db.AiRun.Where(r => r.ConversationId == conversationId && r.Id != runId).SumAsync(r => r.PromptTokens + r.CompletionTokens);
            conv.Tokens = tokens + promptTokens + completionTokens;
        }

        await db.SaveChangesAsync();
    }
}
