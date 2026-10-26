using System.Text.Json.Nodes;
using DesignThix.Core.Ai;
using ModelFile = DesignThix.Core.Ai.AiAttachment;
using DesignThix.Core.Documents;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.Services.Ai;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DesignThix.Tests.Integration;

/// <summary>
/// The loop of the design assistant (docs/PLAN-AI-DESIGN.md 3.1) with the scripted fake model against a real PostgreSQL: the states a run ends in (done, waiting, stuck after the re-asks and nudges, limit,
/// cancelled, error), every step written as it happens, the transient retries, one run per design, the concurrency limit, the restart recovery, the words that appear while the model writes, the picture of
/// <c>look</c>, the layers of the instruction and the trimming of the history.
/// </summary>
[Collection("app")]
public sealed class AiAgentTests(AppTests.AppFactory factory) : AiAgentTestBase(factory)
{
    private const string Title = """{"elements": [{"type": "text", "x": 20, "y": 20, "w": 170, "h": 30, "text": "Sommerfest", "fontSize": 40}]}""";

    // ------------------------------------------------------------------------------------------------ the happy path

    [Fact]
    public async Task A_run_reads_changes_the_design_and_ends_done_with_every_step_written_in_order()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var design = await DesignAsync(Role.Designer, name: "Mein Plakat");
        Seam.Script(
            AiScripted.Say("Ich schaue mir das Design an.", false, Call("read_design")),
            AiScripted.Say("Ich lege eine Überschrift an.", false, Call("add_elements", Title)),
            AiScripted.Say("Fertig: die Überschrift steht.", true));
        var sent = await SendAsync(Role.Designer, design, "Mach eine Überschrift „Sommerfest“");
        Assert.Equal(1, sent.RunNumber);
        var run = await WaitEndAsync(sent.ConversationId);

        Assert.Equal(AiRunStatus.Done, run.Status);
        Assert.Equal(AiAction.DesignAgent, run.Action);
        Assert.Equal(sent.ConversationId, run.ConversationId);
        Assert.Equal(45, run.TotalTokens);   // three calls of 10 + 5
        Assert.Equal("test-model", run.Model);
        Assert.NotNull(run.EndDate);
        var steps = await StepsOfAsync(sent.ConversationId);
        Assert.Equal("User,Assistant,Action,Assistant,Action,Assistant,End", Kinds(steps));
        Assert.Equal(steps.Select(s => s.Number).OrderBy(n => n), steps.Select(s => s.Number));   // numbered in the order they were written
        Assert.Equal("Mach eine Überschrift „Sommerfest“", steps[0].Text);
        var read = Obj(steps.First(s => s.Kind == AiStepKind.Action).DataJson);
        Assert.Equal("read_design", (string)read["tool"]!);
        Assert.True((bool)read["ok"]!);
        Assert.False((bool)read["changed"]!);
        var write = Obj(steps.Last(s => s.Kind == AiStepKind.Action).DataJson);
        Assert.True((bool)write["changed"]!);
        Assert.Equal("Text „Sommerfest“ hinzugefügt – Seite 1", steps.Last(s => s.Kind == AiStepKind.Action).Text);
        Assert.Equal("p1", (string)write["pageId"]!);
        Assert.Single((JsonArray)write["elementIds"]!);
        Assert.Equal(2, (int)write["revision"]!);
        var end = steps.Last();
        Assert.Equal("done", (string)Obj(end.DataJson)["state"]!);
        var assistant = steps.Where(s => s.Kind == AiStepKind.Assistant).Select(s => Obj(s.DataJson)).First();
        Assert.Equal(15, (int)assistant["tokens"]!);
        Assert.Contains("read_design", (string)assistant["raw"]!);

        Assert.Equal("Sommerfest", Elements(await StoredDocAsync(design)).Single()["text"]!.ToString());
        var conversation = await Db(db => db.AiConversation.AsNoTracking().FirstAsync(c => c.Id == sent.ConversationId));
        Assert.Equal(AiConversationStatus.Idle, conversation.Status);
        Assert.Equal(1, conversation.Runs);
        Assert.Equal(45, conversation.Tokens);
        Assert.StartsWith("Mach eine Überschrift", conversation.Title);
        Assert.Equal(await UserAsync(Role.Designer), conversation.UserId);
        Assert.Equal(1, await Db(db => db.AiJournalEntry.CountAsync(j => j.AiRunId == run.Id)));
        // the runner worked AS the person: the design was saved by them
        Assert.Equal(await UserAsync(Role.Designer), await Db(db => db.Design.AsNoTracking().Where(d => d.Id == design).Select(d => d.UpdateUserId).FirstAsync()));
        Assert.Equal("KI: Mach eine Überschrift „Sommerfest“", await Db(db => db.DesignRevision.AsNoTracking().Where(r => r.DesignId == design).OrderByDescending(r => r.Revision).Select(r => r.Note).FirstAsync()));

        // what went to the model: the layers of the instruction, the situation, the history with the results
        var requests = Seam.Requests.ToList();
        Assert.Equal(3, requests.Count);
        Assert.All(requests, r => Assert.True(r.Json));
        var system = requests[0].Messages[0].Content;
        Assert.Equal("system", requests[0].Messages[0].Role);
        Assert.Contains("ANTWORTFORMAT", system);
        Assert.Contains("WERKZEUGE", system);
        Assert.Contains("ELEMENTE UND SEITEN", system);
        Assert.Contains("## Die Lage", system);
        Assert.Contains("Mein Plakat", system);
        Assert.Contains("210 × 297 mm", system);
        Assert.Contains("Mach eine Überschrift „Sommerfest“", requests[0].Messages[1].Content);
        var last = requests[2].Messages[^1];
        Assert.Equal("user", last.Role);
        Assert.StartsWith("Ergebnisse der Aktionen:", last.Content);
        Assert.Contains("add_elements", last.Content);
        Assert.Equal(["system", "user", "assistant", "user", "assistant", "user"], requests[2].Messages.Select(m => m.Role));
        // the first step of the run (hidden from the chat) is the exact instruction that was sent
        var first = steps.First(s => s.Kind == AiStepKind.Message);
        Assert.Contains(system, first.Text);
    }

    [Fact]
    public async Task The_poll_gives_the_steps_after_the_last_one_the_state_and_the_undo_run()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var design = await DesignAsync(Role.Designer);
        Seam.Script(AiScripted.Say("Ich lege an.", false, Call("add_elements", Title)), AiScripted.Say("Fertig.", true));
        var sent = await SendAsync(Role.Designer, design, "Titel bitte");
        await WaitEndAsync(sent.ConversationId);

        var all = await As(Role.Designer, biz => AiAgentLogic.StepsAsync(biz, sent.ConversationId, 0));
        Assert.Equal("Idle", all.Status);
        Assert.Equal(1, all.Run);
        Assert.Equal(30, all.Tokens);
        Assert.Equal(1, all.UndoRun);
        Assert.False(all.UndoOther);
        Assert.Null(all.Partial);
        Assert.Null(all.RenderRequest);
        Assert.Equal(["user", "assistant", "action", "assistant", "end"], all.Steps.Select(s => s.Kind));
        Assert.All(all.Steps, s => Assert.Equal(1, s.Run));
        Assert.Equal(all.Steps.Select(s => s.Id).Order(), all.Steps.Select(s => s.Id));
        var afterThird = await As(Role.Designer, biz => AiAgentLogic.StepsAsync(biz, sent.ConversationId, all.Steps[2].Id));
        Assert.Equal(["assistant", "end"], afterThird.Steps.Select(s => s.Kind));
        var none = await As(Role.Designer, biz => AiAgentLogic.StepsAsync(biz, sent.ConversationId, all.Steps[^1].Id));
        Assert.Empty(none.Steps);
        // the data of a step is JSON, not text
        Assert.Equal("add_elements", (string)all.Steps[2].Data!["tool"]!);
        // the conversation as the panel loads it
        var info = await As(Role.Designer, biz => AiAgentLogic.ConversationAsync(biz, sent.ConversationId));
        Assert.Equal(design, info.DesignId);
        Assert.Equal("Idle", info.Status);
        var runInfo = Assert.Single(info.Runs);
        Assert.True(runInfo.Changed);
        Assert.False(runInfo.Undone);
        Assert.Equal(1, info.Undo!.Run);
        var list = await As(Role.Designer, biz => AiAgentLogic.ConversationsAsync(biz, design));
        Assert.Equal(sent.ConversationId, Assert.Single(list).Id);
    }

    // ------------------------------------------------------------------------------------------------ the other ends

    [Fact]
    public async Task A_question_ends_waiting_and_the_answer_goes_on_in_the_same_conversation()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var design = await DesignAsync(Role.Designer);
        Seam.Script(AiScripted.Say("Soll der Hintergrund blau sein?", false), AiScripted.Say("Ich setze ihn.", false, Call("set_page", """{"background": {"color": "#0b3d5c"}}""")), AiScripted.Say("Fertig.", true));
        var first = await SendAsync(Role.Designer, design, "Mach einen Hintergrund");
        var run = await WaitEndAsync(first.ConversationId);
        Assert.Equal(AiRunStatus.Waiting, run.Status);
        Assert.Null(run.Error);
        var steps = await StepsOfAsync(first.ConversationId);
        Assert.Equal("waiting", (string)Obj(steps.Last().DataJson)["state"]!);

        var second = await SendAsync(Role.Designer, design, "Ja, blau.", conversationId: first.ConversationId);
        Assert.Equal(first.ConversationId, second.ConversationId);
        Assert.Equal(2, second.RunNumber);
        var run2 = await WaitEndAsync(first.ConversationId);
        Assert.Equal(AiRunStatus.Done, run2.Status);
        Assert.Equal(2, run2.Number);
        Assert.Equal("#0b3d5c", (string)AiDocOps.Pages(await StoredDocAsync(design))[0]!["background"]!["color"]!);
        // the second request carries the first message, the question, the answer
        var request = Seam.Requests.ToList()[1];
        Assert.Equal(["system", "user", "assistant", "user"], request.Messages.Select(m => m.Role));
        Assert.Contains("Soll der Hintergrund blau sein?", request.Messages[2].Content);
        Assert.Equal("Ja, blau.", request.Messages[3].Content);
        Assert.Equal(2, (await As(Role.Designer, biz => AiAgentLogic.ConversationAsync(biz, first.ConversationId))).Runs.Count);
    }

    [Fact]
    public async Task A_model_that_does_not_use_the_protocol_is_asked_twice_and_then_the_run_is_stuck()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var design = await DesignAsync(Role.Designer);
        Seam.Script(new AiScripted("Ich schaue mir das gleich an."), new AiScripted("Noch ein Satz ohne JSON."), new AiScripted("Und noch einer."));
        var sent = await SendAsync(Role.Designer, design, "Mach etwas");
        var run = await WaitEndAsync(sent.ConversationId);
        Assert.Equal(AiRunStatus.Stuck, run.Status);
        Assert.Equal(3, Seam.Calls);
        var steps = await StepsOfAsync(sent.ConversationId);
        Assert.Equal("User,Info,Info,Assistant,End", Kinds(steps));
        Assert.Contains("Format", steps.First(s => s.Kind == AiStepKind.Info).Text);
        Assert.Equal("Und noch einer.", steps.First(s => s.Kind == AiStepKind.Assistant).Text);   // shown as it is
        Assert.Equal("stalled", (string)Obj(steps.Last().DataJson)["state"]!);
        // the re-asks are in the request
        var third = Seam.Requests.ToList()[2];
        Assert.Contains(third.Messages, m => m.Role == "user" && m.Content.Contains("nicht das verlangte JSON-Objekt"));

        // one wrong answer and then a good one: the run goes on
        await ResetAsync();
        Seam.Script(new AiScripted("kein json"), AiScripted.Say("Jetzt richtig.", true));
        var again = await SendAsync(Role.Designer, design, "Nochmal");
        var ok = await WaitEndAsync(again.ConversationId);
        Assert.Equal(AiRunStatus.Done, ok.Status);
    }

    [Fact]
    public async Task A_model_that_only_announces_is_told_to_go_on_twice_and_then_the_run_stops()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var design = await DesignAsync(Role.Designer);
        Seam.Script(AiScripted.Say("Gleich geht es los.", false), AiScripted.Say("Noch einen Moment.", false), AiScripted.Say("Gleich.", false));
        var sent = await SendAsync(Role.Designer, design, "Los");
        var run = await WaitEndAsync(sent.ConversationId);
        Assert.Equal(AiRunStatus.Stuck, run.Status);
        Assert.Equal(3, Seam.Calls);
        Assert.Equal("stalled", (string)Obj((await StepsOfAsync(sent.ConversationId)).Last().DataJson)["state"]!);
        Assert.Contains(Seam.Requests.ToList()[1].Messages, m => m.Role == "user" && m.Content.Contains("keine Aktion geschickt"));

        // one nudge is enough
        await ResetAsync();
        Seam.Script(AiScripted.Say("Gleich.", false), AiScripted.Say("Ich lese.", false, Call("read_design")), AiScripted.Say("Fertig.", true));
        var ok = await SendAsync(Role.Designer, design, "Los 2");
        Assert.Equal(AiRunStatus.Done, (await WaitEndAsync(ok.ConversationId)).Status);
    }

    [Fact]
    public async Task A_run_that_uses_up_its_calls_ends_with_limit_and_continues_with_the_next_message()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync(s => s.AgentMaxCallsPerRun = 2);
        var design = await DesignAsync(Role.Designer);
        Seam.Respond((_, _) => AiScripted.Say("Ich lese weiter.", false, Call("read_design")));
        var sent = await SendAsync(Role.Designer, design, "Lies alles");
        var run = await WaitEndAsync(sent.ConversationId);
        Assert.Equal(AiRunStatus.LimitReached, run.Status);
        Assert.Equal(2, Seam.Calls);
        var end = (await StepsOfAsync(sent.ConversationId)).Last();
        Assert.Equal("limit", (string)Obj(end.DataJson)["state"]!);
        Assert.Contains("2 Schritten", end.Text);

        // "Weitermachen" is the next message
        Seam.Reset();
        Seam.Script(AiScripted.Say("Fertig.", true));
        var next = await SendAsync(Role.Designer, design, "Mach weiter.", conversationId: sent.ConversationId);
        Assert.Equal(2, next.RunNumber);
        Assert.Equal(AiRunStatus.Done, (await WaitEndAsync(sent.ConversationId)).Status);
    }

    [Fact]
    public async Task The_budget_counts_per_call_and_a_message_is_not_even_stored_when_it_is_used_up()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync(s => s.UserDailyTokens = 100);
        var design = await DesignAsync(Role.Designer);
        Seam.Script(new AiScripted(AiScripted.Say("Ich lese.", false, Call("read_design")).Text, 90, 90), AiScripted.Say("Fertig.", true));
        var sent = await SendAsync(Role.Designer, design, "Lies");
        var run = await WaitEndAsync(sent.ConversationId);
        Assert.Equal(AiRunStatus.LimitReached, run.Status);
        Assert.Equal(1, Seam.Calls);   // the second call was not made
        Assert.Contains("Tagesbudget", (await StepsOfAsync(sent.ConversationId)).Last(s => s.Kind == AiStepKind.Info).Text);

        var conversations = await Db(db => db.AiConversation.CountAsync());
        var runs = await Db(db => db.AiRun.CountAsync());
        var refused = await Assert.ThrowsAsync<AiLimitException>(() => SendAsync(Role.Designer, design, "Noch eins"));
        Assert.Contains("Tagesbudget", refused.Message);
        Assert.Equal(conversations, await Db(db => db.AiConversation.CountAsync()));
        Assert.Equal(runs, await Db(db => db.AiRun.CountAsync()));
        Assert.Equal(1, Seam.Calls);
        await ResetAsync();
    }

    [Fact]
    public async Task The_brake_per_minute_and_the_runs_per_day_are_checked_too()
    {
        if (!Enabled)
        {
            return;
        }

        var limiter = Factory.Services.GetRequiredService<AiRateLimiter>();
        try
        {
            limiter.Reset();
            await ResetAsync(s => s.PerMinutePerAddress = 1);
            var design = await DesignAsync(Role.Designer);
            Seam.Respond((_, _) => AiScripted.Say("Ich lese.", false, Call("read_design")));
            var sent = await SendAsync(Role.Designer, design, "Lies");
            var run = await WaitEndAsync(sent.ConversationId);
            Assert.Equal(AiRunStatus.LimitReached, run.Status);
            Assert.Equal(1, Seam.Calls);
            Assert.Equal(AiLogic.RateReason, (await StepsOfAsync(sent.ConversationId)).Last(s => s.Kind == AiStepKind.Info).Text);
            var refused = await Assert.ThrowsAsync<AiLimitException>(() => SendAsync(Role.Designer, design, "Und noch eins"));
            Assert.Equal(AiLogic.RateReason, refused.Message);
        }
        finally
        {
            limiter.Reset();
        }

        await ResetAsync();
    }

    // ------------------------------------------------------------------------------------------------ errors and retries

    [Fact]
    public async Task A_busy_provider_is_asked_again_twice_without_counting_and_a_real_error_ends_the_run()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync(s => s.AgentMaxCallsPerRun = 1);
        var design = await DesignAsync(Role.Designer);
        Seam.Script(new AiScripted(Error: "Anbieter-Fehler 503: überlastet"), new AiScripted(Error: "Die KI hat nicht rechtzeitig geantwortet."), AiScripted.Say("Fertig.", true));
        var sent = await SendAsync(Role.Designer, design, "Hallo");
        var run = await WaitEndAsync(sent.ConversationId);
        Assert.Equal(AiRunStatus.Done, run.Status);   // with only ONE call allowed: the retries did not count
        Assert.Equal(3, Seam.Calls);
        var infos = (await StepsOfAsync(sent.ConversationId)).Where(s => s.Kind == AiStepKind.Info).Select(s => s.Text).ToList();
        Assert.Equal(2, infos.Count);
        Assert.Contains("neuer Versuch 1/2", infos[0]);
        Assert.Contains("neuer Versuch 2/2", infos[1]);

        await ResetAsync();
        Seam.Script(new AiScripted(Error: "Anbieter-Fehler 502: a"), new AiScripted(Error: "Anbieter-Fehler 502: b"), new AiScripted(Error: "Anbieter-Fehler 502: c"), AiScripted.Say("nie", true));
        var third = await SendAsync(Role.Designer, design, "Hallo 2");
        var failed = await WaitEndAsync(third.ConversationId);
        Assert.Equal(AiRunStatus.Error, failed.Status);
        Assert.Equal(3, Seam.Calls);
        var steps = await StepsOfAsync(third.ConversationId);
        Assert.Contains("502: c", steps.Last(s => s.Kind == AiStepKind.Error).Text);
        Assert.Equal("error", (string)Obj(steps.Last().DataJson)["state"]!);

        await ResetAsync();
        Seam.Script(new AiScripted(Error: "Der API-Schlüssel wurde abgelehnt (HTTP 401)."), AiScripted.Say("nie", true));
        var auth = await SendAsync(Role.Designer, design, "Hallo 3");
        Assert.Equal(AiRunStatus.Error, (await WaitEndAsync(auth.ConversationId)).Status);
        Assert.Equal(1, Seam.Calls);   // not retried
    }

    [Fact]
    public async Task A_tool_that_fails_is_a_red_step_and_the_model_gets_the_reason_and_can_correct()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var design = await DesignAsync(Role.Designer);
        Seam.Script(
            AiScripted.Say("Ich füge ein Symbol hinzu.", false, Call("add_elements", """{"elements": [{"type": "icon", "icon": "gibt-es-nicht-xyz", "x": 1, "y": 1, "w": 10, "h": 10}]}""")),
            AiScripted.Say("Dann ein anderes.", false, Call("add_elements", """{"elements": [{"type": "icon", "icon": "star", "x": 1, "y": 1, "w": 10, "h": 10}]}""")),
            AiScripted.Say("Fertig.", true));
        var sent = await SendAsync(Role.Designer, design, "Ein Symbol bitte");
        var run = await WaitEndAsync(sent.ConversationId);
        Assert.Equal(AiRunStatus.Done, run.Status);
        var actions = (await StepsOfAsync(sent.ConversationId)).Where(s => s.Kind == AiStepKind.Action).Select(s => Obj(s.DataJson)).ToList();
        Assert.False((bool)actions[0]["ok"]!);
        Assert.True((bool)actions[1]["ok"]!);
        var second = Seam.Requests.ToList()[1].Messages[^1].Content;
        Assert.Contains("gibt-es-nicht-xyz", second);
        Assert.Contains("\"ok\":false", second);
        Assert.Equal("star", Elements(await StoredDocAsync(design)).Single()["icon"]!.ToString());
        // "done" with a failed action does not end the run: the model got one more call after the failure
        await ResetAsync();
        Seam.Script(AiScripted.Say("Fertig!", true, Call("delete_elements", """{"ids": ["nope"]}""")), AiScripted.Say("Es ging nicht, ich lasse es.", true));
        var done = await SendAsync(Role.Designer, design, "Lösch etwas");
        Assert.Equal(AiRunStatus.Done, (await WaitEndAsync(done.ConversationId)).Status);
        Assert.Equal(2, Seam.Calls);
    }

    [Fact]
    public async Task At_most_eight_actions_of_one_answer_are_run_and_the_model_is_told()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var design = await DesignAsync(Role.Designer);
        var ten = Enumerable.Range(0, 10).Select(_ => Call("list_formats")).ToArray();
        Seam.Script(AiScripted.Say("Zehn Aktionen.", false, ten), AiScripted.Say("Fertig.", true));
        var sent = await SendAsync(Role.Designer, design, "Viel");
        await WaitEndAsync(sent.ConversationId);
        Assert.Equal(8, (await StepsOfAsync(sent.ConversationId)).Count(s => s.Kind == AiStepKind.Action));
        Assert.Contains("Nur die ersten 8 Aktionen", Seam.Requests.ToList()[1].Messages[^1].Content);
    }

    // ------------------------------------------------------------------------------------------------ stop, one run per design, the slots

    [Fact]
    public async Task Stop_ends_a_slow_run_as_cancelled_and_only_then_may_the_next_message_start()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var design = await DesignAsync(Role.Designer);
        Seam.Script(new AiScripted(AiScripted.Say("Langsam.", true).Text, Delay: TimeSpan.FromSeconds(60)));
        var sent = await SendAsync(Role.Designer, design, "Mach langsam");
        await WaitUntilAsync(() => Task.FromResult(Seam.Requests.Count == 1 && Runner.IsRunning(sent.ConversationId)), "the call");

        // one run per design: a second message of the same person and one of somebody else with Edit are refused while it works
        await Assert.ThrowsAsync<BizException>(() => SendAsync(Role.Designer, design, "Noch eine", conversationId: sent.ConversationId));
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer, SharePermission.Edit);
        var busy = await Assert.ThrowsAsync<BizException>(() => SendAsync(Role.Viewer, design, "Ich auch"));
        Assert.Contains("arbeitet gerade", busy.Message);
        var polled = await As(Role.Designer, biz => AiAgentLogic.StepsAsync(biz, sent.ConversationId, 0));
        Assert.Equal("Running", polled.Status);
        Assert.Equal(sent.RunId, polled.RunId);
        var availability = await As(Role.Designer, biz => AiAgentLogic.AvailabilityAsync(biz, design));
        Assert.Equal(sent.ConversationId, availability.RunningConversationId);

        Assert.True(await As(Role.Designer, biz => AiAgentLogic.CancelAsync(biz, sent.ConversationId)));
        var run = await WaitEndAsync(sent.ConversationId);
        Assert.Equal(AiRunStatus.Cancelled, run.Status);
        var end = (await StepsOfAsync(sent.ConversationId)).Last();
        Assert.Equal("cancelled", (string)Obj(end.DataJson)["state"]!);
        Assert.Equal("Abgebrochen.", end.Text);
        await WaitUntilAsync(() => Task.FromResult(!Runner.IsRunning(sent.ConversationId)), "the runner to let go");
        Assert.False(await As(Role.Designer, biz => AiAgentLogic.CancelAsync(biz, sent.ConversationId)));   // nothing runs: nothing to stop

        Seam.Reset();
        Seam.Script(AiScripted.Say("Fertig.", true));
        var again = await SendAsync(Role.Viewer, design, "Jetzt ich");
        Assert.Equal(AiRunStatus.Done, (await WaitEndAsync(again.ConversationId)).Status);
        // the conversation of the other person is theirs
        await Assert.ThrowsAsync<NotFoundException>(() => As(Role.Viewer, biz => AiAgentLogic.StepsAsync(biz, sent.ConversationId, 0)));
    }

    [Fact]
    public async Task At_most_so_many_runs_work_at_the_same_moment_and_the_others_wait()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync(s => s.AgentMaxConcurrent = 1);
        var one = await DesignAsync(Role.Designer);
        var two = await DesignAsync(Role.Stranger);
        var concurrent = 0;
        var most = 0;
        var gate = new TaskCompletionSource();
        Seam.Handler = async (request, ct) =>
        {
            var now = Interlocked.Increment(ref concurrent);
            most = Math.Max(most, now);
            try
            {
                await gate.Task.WaitAsync(ct);
            }
            finally
            {
                Interlocked.Decrement(ref concurrent);
            }

            return new AiResponse { Ok = true, Text = AiScripted.Say("Fertig.", true).Text, PromptTokens = 1, CompletionTokens = 1 };
        };
        var first = await SendAsync(Role.Designer, one, "Eins");
        var second = await SendAsync(Role.Stranger, two, "Zwei");
        await WaitUntilAsync(() => Task.FromResult(Seam.Requests.Count == 1), "the first call");
        await Task.Delay(300);
        Assert.Single(Seam.Requests);   // the second run waits for a slot
        Assert.Equal(1, Runner.Active);
        Assert.True(Runner.IsRunning(second.ConversationId));
        var waiting = await Db(db => db.AiConversation.AsNoTracking().FirstAsync(c => c.Id == second.ConversationId));
        Assert.Equal(AiConversationStatus.Running, waiting.Status);
        gate.SetResult();
        Assert.Equal(AiRunStatus.Done, (await WaitEndAsync(first.ConversationId)).Status);
        Assert.Equal(AiRunStatus.Done, (await WaitEndAsync(second.ConversationId)).Status);
        Assert.Equal(1, most);
        Assert.Equal(0, Runner.Active);
    }

    [Fact]
    public async Task A_run_whose_person_lost_the_right_to_edit_ends_with_an_error_and_writes_nothing()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var design = await DesignAsync(Role.Designer, DocumentOf(100, 100, "mm", Text("e1", 1, 1, 50, 10, "bleibt")));
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer, SharePermission.Edit);
        Seam.Script(
            new AiScripted(AiScripted.Say("Ich ändere.", false, Call("update_elements", """{"id": "e1", "set": {"text": "gehackt"}}""")).Text, Delay: TimeSpan.FromMilliseconds(500)),
            AiScripted.Say("Fertig.", true));
        var sent = await SendAsync(Role.Viewer, design, "Ändere den Text");
        await WaitUntilAsync(() => Task.FromResult(Seam.Requests.Count == 1), "the first call");
        // the owner takes the right away while the model thinks
        var shareId = await Db(db => db.Share.AsNoTracking().Where(x => x.ItemId == design && x.ItemKind == ItemKind.Design).Select(x => x.Id).FirstAsync());
        await As(Role.Designer, biz => ShareLogic.RemoveAsync(biz, shareId));
        var run = await WaitEndAsync(sent.ConversationId);
        Assert.Equal(AiRunStatus.Error, run.Status);
        Assert.Contains("Berechtigung", (await StepsOfAsync(sent.ConversationId)).Last(s => s.Kind == AiStepKind.Error).Text);
        Assert.Equal("bleibt", (string)ElementOf(await StoredDocAsync(design), "e1")["text"]!);
    }

    [Fact]
    public async Task A_run_that_was_interrupted_by_a_restart_becomes_an_error_with_a_line_that_says_so()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var design = await DesignAsync(Role.Designer);
        var userId = await UserAsync(Role.Designer);
        var (conversationId, runId) = await Db(async db =>
        {
            var conv = new AiConversation { SubjectId = design, UserId = userId, Title = "Alt", Runs = 1, Status = AiConversationStatus.Running };
            db.AiConversation.Add(conv);
            await db.SaveChangesAsync();
            var run = new AiRun { Action = AiAction.DesignAgent, Status = AiRunStatus.Running, ConversationId = conv.Id, Number = 1, SubjectType = nameof(Design), SubjectId = design, UserId = userId, StartDate = DateTime.UtcNow };
            run.Steps.Add(new AiRunStep { Number = 1, Kind = AiStepKind.User, Text = "Hallo", OccurredDate = DateTime.UtcNow });
            db.AiRun.Add(run);
            await db.SaveChangesAsync();
            return (conv.Id, run.Id);
        });
        // a run that began after the start is not touched
        Assert.Equal(0, await Runner.RecoverAsync(DateTime.UtcNow.AddMinutes(-5)));
        Assert.Equal(AiConversationStatus.Running, await Db(db => db.AiConversation.AsNoTracking().Where(c => c.Id == conversationId).Select(c => c.Status).FirstAsync()));
        Assert.True(await Runner.RecoverAsync(DateTime.UtcNow.AddMinutes(5)) >= 1);
        var run = await Db(db => db.AiRun.AsNoTracking().FirstAsync(r => r.Id == runId));
        Assert.Equal(AiRunStatus.Error, run.Status);
        Assert.Equal("Die Anwendung wurde neu gestartet.", run.Error);
        var steps = await StepsOfAsync(conversationId);
        Assert.Equal("User,End", Kinds(steps));
        Assert.Equal("error", (string)Obj(steps.Last().DataJson)["state"]!);
        Assert.Equal(AiConversationStatus.Idle, await Db(db => db.AiConversation.AsNoTracking().Where(c => c.Id == conversationId).Select(c => c.Status).FirstAsync()));
        // and the person can write again
        Seam.Script(AiScripted.Say("Fertig.", true));
        var again = await SendAsync(Role.Designer, design, "Weiter", conversationId: conversationId);
        Assert.Equal(AiRunStatus.Done, (await WaitEndAsync(again.ConversationId)).Status);

        // a conversation that nobody works on any more but that still says "running" does not block the design for ever
        var stale = await Db(async db =>
        {
            var conv = new AiConversation { SubjectId = design, UserId = userId, Title = "Verwaist", Runs = 1, Status = AiConversationStatus.Running };
            db.AiConversation.Add(conv);
            await db.SaveChangesAsync();
            await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE \"AiConversation\" SET \"UpdateDate\" = {DateTime.UtcNow.AddMinutes(-10)} WHERE \"Id\" = {conv.Id}");
            return conv.Id;
        });
        Seam.Script(AiScripted.Say("Fertig.", true));
        var free = await SendAsync(Role.Designer, design, "Trotzdem");
        Assert.Equal(AiRunStatus.Done, (await WaitEndAsync(free.ConversationId)).Status);
        Assert.Equal(AiConversationStatus.Idle, await Db(db => db.AiConversation.AsNoTracking().Where(c => c.Id == stale).Select(c => c.Status).FirstAsync()));
    }

    // ------------------------------------------------------------------------------------------------ the words while they are written

    [Fact]
    public async Task The_message_of_the_answer_is_readable_while_the_model_still_writes_it()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var design = await DesignAsync(Role.Designer);
        var gate = new TaskCompletionSource();
        var started = new TaskCompletionSource();
        Seam.Handler = async (request, ct) =>
        {
            request.OnDelta!("{\"message\": \"Ich lege");
            request.OnDelta!(" die \\\"Seite\\\" an");
            started.TrySetResult();
            await gate.Task.WaitAsync(ct);
            request.OnDelta!(" und male.\", \"actions\": [], \"done\": true}");
            return new AiResponse { Ok = true, Text = "{\"message\": \"Ich lege die \\\"Seite\\\" an und male.\", \"actions\": [], \"done\": true}", PromptTokens = 1, CompletionTokens = 1 };
        };
        var sent = await SendAsync(Role.Designer, design, "Los");
        await started.Task.WaitAsync(TimeSpan.FromSeconds(10));
        var page = await As(Role.Designer, biz => AiAgentLogic.StepsAsync(biz, sent.ConversationId, 0));
        Assert.Equal("Running", page.Status);
        Assert.Equal("Ich lege die \"Seite\" an", page.Partial);
        Assert.Equal(["user"], page.Steps.Select(s => s.Kind));   // the words are not a step yet
        gate.SetResult();
        await WaitEndAsync(sent.ConversationId);
        var done = await As(Role.Designer, biz => AiAgentLogic.StepsAsync(biz, sent.ConversationId, 0));
        Assert.Null(done.Partial);
        Assert.Equal("Ich lege die \"Seite\" an und male.", done.Steps.First(s => s.Kind == "assistant").Text);
    }

    [Fact]
    public async Task The_scripted_model_streams_the_answer_in_pieces_when_asked_to()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var design = await DesignAsync(Role.Designer);
        Seam.Respond((request, _) =>
        {
            Assert.NotNull(request.OnDelta);
            return AiScripted.Say("Fertig.", true) with { Stream = ["{\"message\": ", "\"Fer", "tig.\", \"actions\": [], \"done\": true}"] };
        });
        var sent = await SendAsync(Role.Designer, design, "Los");
        Assert.Equal(AiRunStatus.Done, (await WaitEndAsync(sent.ConversationId)).Status);
        Assert.Equal(1, Seam.Calls);
        Assert.Equal("Fertig.", (await StepsOfAsync(sent.ConversationId)).First(s => s.Kind == AiStepKind.Assistant).Text);
    }

    // ------------------------------------------------------------------------------------------------ look

    private static readonly byte[] Png = File.ReadAllBytes(Path.Combine(DesignThix.Tests.Core.RepoFiles.WwwRoot(), "img", "icon-192.png"));

    /// <summary>The editor of the person: polls like the browser and hands in a picture as soon as a request is there. Returns what it was asked for.</summary>
    private async Task<AiAgentLogic.RenderRequestInfo?> BeEditorAsync(Role who, long conversationId, byte[]? picture, bool fail = false, int seconds = 15)
    {
        var deadline = DateTime.UtcNow.AddSeconds(seconds);
        while (DateTime.UtcNow < deadline)
        {
            var page = await As(who, biz => AiAgentLogic.StepsAsync(biz, conversationId, 0));
            if (page.RenderRequest is { } request)
            {
                if (fail)
                {
                    Assert.True(await As(who, biz => AiAgentLogic.RenderFailedAsync(biz, request.RunId, request.Token)));
                }
                else
                {
                    Assert.True(await As(who, biz => AiAgentLogic.RenderUploadAsync(biz, request.RunId, request.Token, picture!)));
                }

                return request;
            }

            if (page.Status == "Idle")
            {
                return null;
            }

            await Task.Delay(30);
        }

        return null;
    }

    [Fact]
    public async Task Look_asks_the_open_editor_for_a_picture_and_the_model_gets_it_on_its_next_call_only()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var design = await DesignAsync(Role.Designer);
        Seam.Script(
            AiScripted.Say("Ich schaue.", false, Call("look")),
            AiScripted.Say("Noch einmal lesen.", false, Call("read_design")),
            AiScripted.Say("Sieht gut aus.", true));
        var sent = await SendAsync(Role.Designer, design, "Prüf es");
        var editor = BeEditorAsync(Role.Designer, sent.ConversationId, Png);
        await WaitEndAsync(sent.ConversationId);
        var request = await editor;
        Assert.NotNull(request);
        Assert.Equal("p1", request.PageId);
        Assert.Equal(1, request.PageNumber);
        Assert.Equal(1024, request.MaxWidth);
        Assert.Equal(await RevisionAsync(design), request.Revision);

        var requests = Seam.Requests.ToList();
        Assert.Equal(3, requests.Count);
        Assert.All(requests[0].Messages, m => Assert.Empty(m.Attachments));
        var picture = Assert.Single(requests[1].Messages[^1].Attachments);
        Assert.Equal("image", picture.Kind);
        Assert.Equal("image/png", picture.MediaType);
        Assert.Equal(Convert.ToBase64String(Png), picture.Data);
        Assert.All(requests[2].Messages, m => Assert.Empty(m.Attachments));   // only that one call

        var action = (await StepsOfAsync(sent.ConversationId)).First(s => s.Kind == AiStepKind.Action);
        Assert.Equal("Seite 1 angesehen", action.Text);
        var data = Obj(action.DataJson);
        var file = (string)data["picture"]!;
        Assert.StartsWith("look-1-1-", file);
        Assert.Equal(file, Path.GetFileName(file));
        // the picture of the step can be loaded by the person (and nobody else)
        var loaded = await As(Role.Designer, biz => AiAgentLogic.PictureAsync(biz, sent.ConversationId, file));
        Assert.NotNull(loaded);
        Assert.Equal("image/png", loaded.Value.ContentType);
        Assert.Equal(Png, loaded.Value.Bytes);
        await Assert.ThrowsAsync<NotFoundException>(() => As(Role.Stranger, biz => AiAgentLogic.PictureAsync(biz, sent.ConversationId, file)));
        Assert.Null(await As(Role.Designer, biz => AiAgentLogic.PictureAsync(biz, sent.ConversationId, "../../appsettings.json")));
        Assert.Null(await As(Role.Designer, biz => AiAgentLogic.PictureAsync(biz, sent.ConversationId, "gibt-es-nicht.png")));
    }

    [Fact]
    public async Task Without_an_open_editor_look_answers_that_there_is_no_picture_and_the_run_goes_on()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var design = await DesignAsync(Role.Designer);
        Seam.Script(AiScripted.Say("Ich schaue.", false, Call("look")), AiScripted.Say("Dann ohne Bild fertig.", true));
        var sent = await SendAsync(Role.Designer, design, "Prüf es");
        var run = await WaitEndAsync(sent.ConversationId);
        Assert.Equal(AiRunStatus.Done, run.Status);
        var action = (await StepsOfAsync(sent.ConversationId)).First(s => s.Kind == AiStepKind.Action);
        Assert.Equal("Kein Bild verfügbar", action.Text);
        Assert.True((bool)Obj(action.DataJson)["ok"]!);
        Assert.Contains("Kein Bild verfügbar", Seam.Requests.ToList()[1].Messages[^1].Content);
        Assert.All(Seam.Requests.ToList()[1].Messages, m => Assert.Empty(m.Attachments));
    }

    [Fact]
    public async Task An_editor_that_cannot_draw_the_page_and_a_limit_of_looks_are_told_to_the_model()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync(s => s.AgentMaxLooks = 1);
        var design = await DesignAsync(Role.Designer);
        Seam.Script(AiScripted.Say("Ich schaue.", false, Call("look")), AiScripted.Say("Noch mal.", false, Call("look")), AiScripted.Say("Fertig.", true));
        var sent = await SendAsync(Role.Designer, design, "Prüf es");
        var editor = BeEditorAsync(Role.Designer, sent.ConversationId, null, fail: true);
        await WaitEndAsync(sent.ConversationId);
        Assert.NotNull(await editor);
        var actions = (await StepsOfAsync(sent.ConversationId)).Where(s => s.Kind == AiStepKind.Action).ToList();
        Assert.Equal("Kein Bild verfügbar", actions[0].Text);
        Assert.Equal("Kein weiterer Blick erlaubt", actions[1].Text);
        Assert.False((bool)Obj(actions[1].DataJson)["ok"]!);
    }

    [Fact]
    public async Task Only_the_person_of_the_run_with_the_token_can_hand_in_a_picture_and_it_must_be_a_small_image()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var design = await DesignAsync(Role.Designer);
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer, SharePermission.Edit);
        Seam.Script(AiScripted.Say("Ich schaue.", false, Call("look")), AiScripted.Say("Fertig.", true));
        var sent = await SendAsync(Role.Designer, design, "Prüf es");
        AiAgentLogic.RenderRequestInfo? request = null;
        await WaitUntilAsync(async () =>
        {
            request = (await As(Role.Designer, biz => AiAgentLogic.StepsAsync(biz, sent.ConversationId, 0))).RenderRequest;
            return request is not null;
        }, "the render request");
        // somebody else with Edit on the design, an administrator, and a stranger: not the person of the run
        await Assert.ThrowsAsync<NotFoundException>(() => As(Role.Viewer, biz => AiAgentLogic.RenderUploadAsync(biz, request!.RunId, request.Token, Png)));
        await Assert.ThrowsAsync<NotFoundException>(() => As(Role.Admin, biz => AiAgentLogic.RenderUploadAsync(biz, request!.RunId, request.Token, Png)));
        await Assert.ThrowsAsync<NotFoundException>(() => As(Role.Stranger, biz => AiAgentLogic.RenderFailedAsync(biz, request!.RunId, request.Token)));
        // the person with a wrong token, no image, too much
        Assert.False(await As(Role.Designer, biz => AiAgentLogic.RenderUploadAsync(biz, request!.RunId, "nicht-der-token", Png)));
        await Assert.ThrowsAsync<BizException>(() => As(Role.Designer, biz => AiAgentLogic.RenderUploadAsync(biz, request!.RunId, request.Token, "kein Bild"u8.ToArray())));
        await Assert.ThrowsAsync<BizException>(() => As(Role.Designer, biz => AiAgentLogic.RenderUploadAsync(biz, request!.RunId, request.Token, [])));
        await Assert.ThrowsAsync<BizException>(() => As(Role.Designer, biz => AiAgentLogic.RenderUploadAsync(biz, request!.RunId, request.Token, [.. Png, .. new byte[AiAttachmentLogic.MaxModelImageBytes]])));
        var status = await As(Role.Designer, biz => AiAgentLogic.StepsAsync(biz, sent.ConversationId, 0));
        Assert.NotNull(status.RenderRequest);   // still waiting: none of these counted
        Assert.True(await As(Role.Designer, biz => AiAgentLogic.RenderUploadAsync(biz, request!.RunId, request.Token, Png)));
        await WaitEndAsync(sent.ConversationId);
        // when nobody waits any more the picture is not taken
        Assert.False(await As(Role.Designer, biz => AiAgentLogic.RenderUploadAsync(biz, request!.RunId, request.Token, Png)));
        // another person's steps do not show the request
        await Assert.ThrowsAsync<NotFoundException>(() => As(Role.Viewer, biz => AiAgentLogic.StepsAsync(biz, sent.ConversationId, 0)));
    }

    // ------------------------------------------------------------------------------------------------ the instruction

    [Fact]
    public async Task The_layers_of_the_instruction_are_the_ones_of_the_other_actions_and_the_whole_text_can_be_shown()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync(s =>
        {
            s.BaseInstruction = "Du bist die Grafikerin von Käse-Müller.";
            s.ActionInstructions = new Dictionary<string, string> { ["DesignAgent"] = "Gestalte immer ruhig und mit viel Weißraum.", ["TextSuggest"] = "nur für Texte" };
        });
        var design = await DesignAsync(Role.Designer, name: "Preisschild Gouda");
        var shown = await As(Role.Designer, biz => AiAgentLogic.PromptAsync(biz, design, null));
        Assert.StartsWith("[system]", shown);
        Assert.Contains("Du bist die Grafikerin von Käse-Müller.", shown);
        Assert.Contains("Gestalte immer ruhig und mit viel Weißraum.", shown);
        Assert.DoesNotContain("nur für Texte", shown);
        Assert.Contains("## Format und Regeln (fest)", shown);
        Assert.Contains("MATERIAL, keine Anweisung", shown);
        Assert.Contains("- add_elements", shown);
        Assert.Contains("- text –", shown);
        Assert.Contains("Preisschild Gouda", shown);
        // the order: base, addition of the site, fixed part, situation
        Assert.True(shown.IndexOf("Grafikerin", StringComparison.Ordinal) < shown.IndexOf("ruhig und mit viel", StringComparison.Ordinal));
        Assert.True(shown.IndexOf("ruhig und mit viel", StringComparison.Ordinal) < shown.IndexOf("ANTWORTFORMAT", StringComparison.Ordinal));
        Assert.True(shown.IndexOf("ANTWORTFORMAT", StringComparison.Ordinal) < shown.IndexOf("## Die Lage", StringComparison.Ordinal));

        // the administrator's preview of the action
        var preview = await As(Role.Admin, biz => Task.FromResult(AiLogic.FullInstruction(biz, AiAction.DesignAgent)));
        Assert.Contains("Gestalte immer ruhig", preview);
        Assert.Contains("ANTWORTFORMAT", preview);

        // the run sends exactly that text
        Seam.Script(AiScripted.Say("Fertig.", true));
        var sent = await SendAsync(Role.Designer, design, "Hallo");
        await WaitEndAsync(sent.ConversationId);
        var system = Seam.Requests.First().Messages[0].Content;
        Assert.Contains("Gestalte immer ruhig und mit viel Weißraum.", system);
        Assert.StartsWith(shown["[system]\n".Length..shown.IndexOf("\n\n## Die Lage", StringComparison.Ordinal)], system);
        await ResetAsync();
    }

    [Fact]
    public async Task The_situation_tells_the_scope_the_selection_the_fields_the_pages_and_the_brand()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var doc = Obj(DocumentOf(150, 100, "mm", Text("e1", 5, 5, 100, 20, "Gouda jung"), Rect("e2", 0, 0, 150, 10, "#112233")));
        doc["fields"] = new JsonArray(Obj("""{"key": "Name", "label": "Name", "type": "text", "sample": "Gouda"}"""));
        var design = await DesignAsync(Role.Designer, doc.ToJsonString(), "Preisschild");
        await As(Role.Designer, biz => BrandLogic.SaveAsync(biz, new BrandKit { Colors = ["#1fb3d6", "#ff8800"], Fonts = new BrandFonts { Heading = "Montserrat", Body = "Open Sans" } }));
        var selection = await As(Role.Designer, biz => AiAgentLogic.PromptAsync(biz, design, new AiScope("selection", "p1", ["e1", "gibt-es-nicht"], true)));
        Assert.Contains("150 × 100 mm", selection);
        Assert.Contains("Seite 1: id p1, 2 Elemente", selection);
        Assert.Contains("Name (text, Beispiel „Gouda“)", selection);
        Assert.Contains("Nur hier ändern", selection);
        Assert.Contains("e1 (Text „Gouda jung“, Seite 1)", selection);
        Assert.DoesNotContain("gibt-es-nicht", selection);
        Assert.Contains("#1fb3d6", selection);
        Assert.Contains("Überschrift Montserrat", selection);
        var page = await As(Role.Designer, biz => AiAgentLogic.PromptAsync(biz, design, new AiScope("page", "p1", [], false)));
        Assert.Contains("dort arbeitet die Person gerade", page);
        var whole = await As(Role.Designer, biz => AiAgentLogic.PromptAsync(biz, design, null));
        Assert.Contains("Bereich: das ganze Design.", whole);
        // a page that is not there makes it the whole design; a view-only person cannot ask for the text
        var unknown = await As(Role.Designer, biz => AiAgentLogic.PromptAsync(biz, design, new AiScope("page", "p9", [], true)));
        Assert.Contains("Bereich: das ganze Design.", unknown);
        await As(Role.Designer, biz => BrandLogic.SaveAsync(biz, new BrandKit()));
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer, SharePermission.View);
        await Assert.ThrowsAsync<ForbiddenException>(() => As(Role.Viewer, biz => AiAgentLogic.PromptAsync(biz, design, null)));
        await Assert.ThrowsAsync<NotFoundException>(() => As(Role.Stranger, biz => AiAgentLogic.PromptAsync(biz, design, null)));
    }

    [Fact]
    public async Task A_design_started_from_a_prompt_tells_the_model_to_choose_the_format_in_its_first_run_only()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        Seam.Script(AiScripted.Say("Ich wähle das Format.", false, Call("resize_design", """{"preset": "poster-a3-portrait"}""")), AiScripted.Say("Fertig.", true), AiScripted.Say("Noch fertig.", true));
        var started = await As(Role.Designer, biz => AiAgentLogic.StartNewAsync(biz, new AiAgentLogic.NewDesignInput("Ein Plakat für das Sommerfest", null, null, null, null, null, null, null, null)));
        Assert.StartsWith($"/Designs/{started.DesignId}/Designer?ai=", started.Url);
        await WaitEndAsync(started.Sent.ConversationId);
        Assert.Contains("kein Format gewählt", Seam.Requests.First().Messages[0].Content);
        var doc = await StoredDocAsync(started.DesignId);
        Assert.Equal(297, (double)doc["width"]!);
        Assert.Equal(420, (double)doc["height"]!);
        var second = await SendAsync(Role.Designer, started.DesignId, "Noch etwas", conversationId: started.Sent.ConversationId);
        await WaitEndAsync(second.ConversationId);
        Assert.DoesNotContain("kein Format gewählt", Seam.Requests.Last().Messages[0].Content);

        // with a chosen format the design has it from the start and nothing is said
        Seam.Reset();
        Seam.Script(AiScripted.Say("Fertig.", true));
        var chosen = await As(Role.Designer, biz => AiAgentLogic.StartNewAsync(biz, new AiAgentLogic.NewDesignInput("Eine Visitenkarte", "business-card", null, null, null, null, null, null, null)));
        await WaitEndAsync(chosen.Sent.ConversationId);
        Assert.DoesNotContain("kein Format gewählt", Seam.Requests.Last().Messages[0].Content);
        Assert.Equal(85, (double)(await StoredDocAsync(chosen.DesignId))["width"]!);
        // nothing to say: no design is made
        var designs = await Db(db => db.Design.CountAsync());
        await Assert.ThrowsAsync<BizException>(() => As(Role.Designer, biz => AiAgentLogic.StartNewAsync(biz, new AiAgentLogic.NewDesignInput("  ", "business-card", null, null, null, null, null, null, null))));
        Assert.Equal(designs, await Db(db => db.Design.CountAsync()));
    }

    // ------------------------------------------------------------------------------------------------ when the AI is off, and the run list

    [Fact]
    public async Task Nothing_is_stored_when_the_AI_is_off_or_not_set_up_and_the_administrator_is_told_where_to_fix_it()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync(s => s.Enabled = false);
        var design = await DesignAsync(Role.Designer);
        var conversations = await Db(db => db.AiConversation.CountAsync());
        var off = await Assert.ThrowsAsync<BizException>(() => SendAsync(Role.Designer, design, "Hallo"));
        Assert.Contains("ausgeschaltet", off.Message);
        var availability = await As(Role.Designer, biz => AiAgentLogic.AvailabilityAsync(biz, design));
        Assert.False(availability.Enabled);
        Assert.False(availability.ShowEntry);   // a member sees nothing
        Assert.Null(availability.Reason);

        await ResetAsync();   // on, but no handler, no profile, no relay
        var none = await Assert.ThrowsAsync<BizException>(() => SendAsync(Role.Designer, design, "Hallo"));
        Assert.Contains("nicht eingerichtet", none.Message);
        var member = await As(Role.Designer, biz => AiAgentLogic.AvailabilityAsync(biz, design));
        Assert.True(member.Enabled);
        Assert.False(member.Available);
        Assert.False(member.ShowEntry);
        Assert.Equal(conversations, await Db(db => db.AiConversation.CountAsync()));

        Seam.Script(AiScripted.Say("Fertig.", true));
        var ok = await As(Role.Designer, biz => AiAgentLogic.AvailabilityAsync(biz, design));
        Assert.True(ok.ShowEntry);
        Assert.True(ok.CanEdit);
        Assert.Equal(6, ok.MaxFiles);
        Assert.Equal(25L * 1024 * 1024, ok.MaxFileBytes);
        Assert.Equal(6, ok.MaxLooks);
        // a person who may only view gets no entry
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer, SharePermission.View);
        var viewer = await As(Role.Viewer, biz => AiAgentLogic.AvailabilityAsync(biz, design));
        Assert.False(viewer.CanEdit);
        Assert.False(viewer.ShowEntry);
        await Assert.ThrowsAsync<NotFoundException>(() => As(Role.Stranger, biz => AiAgentLogic.AvailabilityAsync(biz, design)));
    }

    [Fact]
    public async Task The_administrator_sees_the_entry_with_the_reason_when_the_AI_is_off_and_the_runs_in_the_list()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync(s => s.Enabled = false);
        // the administrator works in their own area too (the claim of the test role is Admin)
        var design = await DesignAsync(Role.Admin);
        var off = await As(Role.Admin, biz => AiAgentLogic.AvailabilityAsync(biz, design));
        Assert.True(off.ShowEntry);
        Assert.Contains("ausgeschaltet", off.Reason);
        Assert.Equal("/Admin/Ai", off.SettingsHref);
        await ResetAsync();
        var noProfile = await As(Role.Admin, biz => AiAgentLogic.AvailabilityAsync(biz, design));
        Assert.True(noProfile.ShowEntry);
        Assert.Equal("/Admin/Ai/Profiles", noProfile.SettingsHref);
        Assert.Contains("keine KI eingerichtet", noProfile.Reason);

        // a run in the run list of the administrator, with its steps and without a button to undo it there
        Seam.Script(AiScripted.Say("Ich lege an.", false, Call("add_elements", Title)), AiScripted.Say("Fertig.", true));
        var sent = await SendAsync(Role.Admin, design, "Titel");
        var run = await WaitEndAsync(sent.ConversationId);
        var details = await As(Role.Admin, biz => AiLogic.RunDetailsAsync(biz, run.Id));
        Assert.NotNull(details);
        Assert.Equal("User,Assistant,Action,Assistant,End", Kinds(details.Run.Steps.OrderBy(s => s.Number)));
        Assert.False(details.CanUndo);
        Assert.Contains("Designer", details.UndoBlockedBy);
        Assert.Contains(await As(Role.Admin, biz => Task.FromResult(AiLogic.Runs(biz).Where(r => r.Id == run.Id).ToList())), r => r.Action == AiAction.DesignAgent);
        await Assert.ThrowsAsync<BizException>(() => As(Role.Admin, biz => AiLogic.UndoAsync(biz, run.Id)));
        Assert.Equal("Design (Assistent)", DesignThix.UiKit.Labels.Of(AiAction.DesignAgent));
        // the panel of data lists does not show the runs of the assistant
        Assert.Empty(await As(Role.Admin, biz => AiLogic.RunsOfAsync(biz, nameof(Design), design)));
    }

    // ------------------------------------------------------------------------------------------------ a save of the person in between, delete

    [Fact]
    public async Task A_save_of_the_person_between_two_actions_is_never_overwritten()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var design = await DesignAsync(Role.Designer);
        var calls = 0;
        Seam.Respond((_, index) =>
        {
            calls++;
            if (index == 1)
            {
                // while the model thinks about its second step the person saves in the editor
                As(Role.Designer, async biz =>
                {
                    var current = await DesignLogic.LoadAsync(biz, design);
                    var doc = Obj(current!.DocumentJson);
                    AiDocOps.Elements((JsonObject)AiDocOps.Pages(doc)[0]!).Add(Text("hand1", 10, 150, 100, 10, "von Hand"));
                    await DesignLogic.SaveDocumentAsync(biz, design, current.Revision, doc.ToJsonString(), true);
                }).GetAwaiter().GetResult();
            }

            return index switch
            {
                0 => AiScripted.Say("Eins.", false, Call("add_elements", """{"elements": [{"type": "text", "x": 10, "y": 10, "w": 100, "h": 10, "text": "KI eins"}]}""")),
                1 => AiScripted.Say("Zwei.", false, Call("add_elements", """{"elements": [{"type": "text", "x": 10, "y": 30, "w": 100, "h": 10, "text": "KI zwei"}]}""")),
                _ => AiScripted.Say("Fertig.", true),
            };
        });
        var sent = await SendAsync(Role.Designer, design, "Zwei Texte");
        await WaitEndAsync(sent.ConversationId);
        Assert.Equal(["KI eins", "von Hand", "KI zwei"], Elements(await StoredDocAsync(design)).Select(e => e["text"]!.ToString()));
        _ = calls;
    }

    [Fact]
    public async Task A_deleted_conversation_is_gone_with_its_files_and_a_running_one_is_stopped()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var design = await DesignAsync(Role.Designer);
        Seam.Script(new AiScripted(AiScripted.Say("Langsam.", true).Text, Delay: TimeSpan.FromSeconds(60)));
        var sent = await SendAsync(Role.Designer, design, "Mach langsam", files: [new IncomingFile("bild.png", Png)]);
        var dir = Path.Combine(Factory.Services.GetRequiredService<DesignThix.Configuration.ConfigStore>().DataDir, "ai-files", sent.ConversationId.ToString());
        Assert.True(Directory.Exists(dir));
        await WaitUntilAsync(() => Task.FromResult(Runner.IsRunning(sent.ConversationId)), "the run");
        await Assert.ThrowsAsync<NotFoundException>(() => As(Role.Stranger, biz => AiAgentLogic.DeleteAsync(biz, sent.ConversationId)));
        await As(Role.Designer, biz => AiAgentLogic.DeleteAsync(biz, sent.ConversationId));
        await WaitUntilAsync(() => Task.FromResult(!Runner.IsRunning(sent.ConversationId)), "the run to stop");
        Assert.False(Directory.Exists(dir));
        Assert.Empty(await Db(db => db.AiAttachment.AsNoTracking().Where(a => a.ConversationId == sent.ConversationId).ToListAsync()));
        await Assert.ThrowsAsync<NotFoundException>(() => As(Role.Designer, biz => AiAgentLogic.StepsAsync(biz, sent.ConversationId, 0)));
        Assert.Empty(await As(Role.Designer, biz => AiAgentLogic.ConversationsAsync(biz, design)));
        // the run stays in the list of the administrator (what was asked of the AI is a record), the conversation does not
        Assert.Equal(1, await Db(db => db.AiRun.IgnoreQueryFilters().CountAsync(r => r.ConversationId == sent.ConversationId)));
        // the design is free again
        Seam.Reset();
        Seam.Script(AiScripted.Say("Fertig.", true));
        var next = await SendAsync(Role.Designer, design, "Neu");
        Assert.Equal(AiRunStatus.Done, (await WaitEndAsync(next.ConversationId)).Status);
    }

    // ------------------------------------------------------------------------------------------------ the history

    [Fact]
    public void The_history_keeps_the_newest_results_whole_cuts_older_ones_and_the_texts_of_earlier_runs()
    {
        var history = new List<HistoryMessage>
        {
            new("user", "Alte Nachricht mit Anhang: " + new string('a', 20_000), false, 1),
            new("assistant", "{\"message\": \"alt\"}", false, 1),
        };
        for (var i = 0; i < 7; i++)
        {
            history.Add(new HistoryMessage("user", "Ergebnisse der Aktionen:\n" + new string((char)('A' + i), 5000), true, 2));
            history.Add(new HistoryMessage("assistant", "{\"message\": \"" + i + "\"}", false, 2));
        }

        history.Add(new HistoryMessage("user", "Neue Nachricht: " + new string('n', 9000), false, 3));
        var messages = AiAgentLoop.Messages("SYSTEM", history, 3, 15, []);
        Assert.Equal("system", messages[0].Role);
        Assert.Equal("SYSTEM", messages[0].Content);
        Assert.Equal(history.Count + 1, messages.Count);
        Assert.Equal(6000 + " …[älterer Anhangstext gekürzt]".Length, messages[1].Content.Length);
        Assert.Equal(9000 + "Neue Nachricht: ".Length, messages[^1].Content.Length);   // the message of the current run stays whole
        var tools = messages.Where(m => m.Content.StartsWith("Ergebnisse der Aktionen:", StringComparison.Ordinal)).ToList();
        Assert.Equal(7, tools.Count);
        Assert.All(tools.Take(3), m =>
        {
            Assert.Equal(AiAgentLoop.OldResultChars + " …[älteres Ergebnis gekürzt – bei Bedarf neu lesen]".Length, m.Content.Length);
            Assert.EndsWith("bei Bedarf neu lesen]", m.Content);
        });
        Assert.All(tools.Skip(3), m => Assert.Equal("Ergebnisse der Aktionen:\n".Length + 5000, m.Content.Length));
    }

    [Fact]
    public void The_pictures_ride_on_the_message_of_their_run_and_the_looked_at_page_on_the_last_one()
    {
        var history = new List<HistoryMessage> { new("user", "Mit Bild", false, 1), new("assistant", "x", false, 1), new("user", "Ergebnisse", true, 1) };
        var picture = new ModelFile { Kind = "image", MediaType = "image/jpeg", Name = "a.jpg", Data = "AAAA" };
        var look = new ModelFile { Kind = "image", MediaType = "image/png", Name = "Seite 1", Data = "BBBB" };
        var messages = AiAgentLoop.Messages("S", history, 1, 0, [picture], [look]);
        Assert.Equal([picture], messages[1].Attachments);
        Assert.Empty(messages[2].Attachments);
        Assert.Equal([look], messages[3].Attachments);
        var plain = AiAgentLoop.Messages("S", history, 2, -1, []);
        Assert.All(plain, m => Assert.Empty(m.Attachments));
    }

    [Fact]
    public void A_history_that_is_too_long_loses_its_oldest_messages_but_never_the_message_of_the_run()
    {
        var history = new List<HistoryMessage>();
        for (var run = 1; run <= 6; run++)
        {
            history.Add(new HistoryMessage("user", $"Nachricht {run} " + new string('x', 5900), false, run));
            for (var i = 0; i < 12; i++)
            {
                history.Add(new HistoryMessage("assistant", new string('y', 5000), false, run));
                history.Add(new HistoryMessage("user", "Ergebnisse der Aktionen:\n" + new string('z', 2400), true, run));
            }
        }

        var messages = AiAgentLoop.Messages("S", history, 6, history.FindLastIndex(m => m.Run == 6 && !m.Tool && m.Role == "user"), []);
        Assert.True(messages.Sum(m => m.Content.Length) <= AiAgentLoop.MaxHistoryChars + 10);
        Assert.Contains(messages, m => m.Content.StartsWith("Nachricht 6 ", StringComparison.Ordinal));
        Assert.DoesNotContain(messages, m => m.Content.StartsWith("Nachricht 1 ", StringComparison.Ordinal));
        Assert.Equal(AiAgentLoop.ReadHistory(AiAgentLoop.WriteHistory(history)).Count, history.Count);   // the stored form reads back
        Assert.Empty(AiAgentLoop.ReadHistory("kein json"));
        Assert.True(AiAgentLoop.Transient("Anbieter-Fehler 503: x"));
        Assert.True(AiAgentLoop.Transient("Die Antwort der KI wurde unterbrochen."));
        Assert.False(AiAgentLoop.Transient("Der API-Schlüssel wurde abgelehnt (HTTP 401)."));
    }

    [Fact]
    public async Task The_loop_runs_from_the_logic_of_a_person_directly()
    {
        if (!Enabled)
        {
            return;
        }

        // AiAgentLoop.RunAsync is what the runner calls: a run that is not "Running" or a conversation that is gone is left alone
        await ResetAsync();
        await As(Role.Designer, biz => AiAgentLoop.RunAsync(biz, 987654321, null, CancellationToken.None));
        var design = await DesignAsync(Role.Designer);
        Seam.Script(AiScripted.Say("Fertig.", true));
        var sent = await SendAsync(Role.Designer, design, "Hallo");
        await WaitEndAsync(sent.ConversationId);
        await As(Role.Designer, biz => AiAgentLoop.RunAsync(biz, sent.ConversationId, null, CancellationToken.None));
        Assert.Equal(1, Seam.Calls);   // it did not run twice
        Assert.EndsWith("ai-files", await As(Role.Designer, biz => Task.FromResult(AiAttachmentLogic.Root(biz))));
    }
}
