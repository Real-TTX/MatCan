using System.Text.Json.Nodes;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.Services.Ai;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Tests.Integration;

/// <summary>
/// "Rückgängig" of the design assistant (docs/PLAN-AI-DESIGN.md 3.8): only the newest run of the design that changed something, newest first across the conversations of the design (runs of other people too),
/// the OLD document as a new revision with one history entry, a question first when somebody changed the design since, and the model told in the conversation.
/// </summary>
[Collection("app")]
public sealed class AiUndoTests(AppTests.AppFactory factory) : AiAgentTestBase(factory)
{
    private static string Write(string id, string text, double y)
        => Call("add_elements", $$"""{"elements": [{"type": "text", "x": 10, "y": {{y}}, "w": 100, "h": 10, "text": "{{text}}", "name": "{{id}}"}]}""");

    private async Task<AiAgentLogic.Sent> RunAsync(Role who, long design, string text, long? conversation = null, params string[] writes)
    {
        Seam.Reset();
        Seam.Script([.. writes.Select(w => AiScripted.Say("Ich schreibe.", false, w)), AiScripted.Say("Fertig.", true)]);
        var sent = await SendAsync(who, design, text, conversationId: conversation);
        await WaitEndAsync(sent.ConversationId);
        return sent;
    }

    private async Task<string> TextsAsync(long design) => string.Join("|", Elements(await StoredDocAsync(design)).Select(e => e["text"]!.ToString()));

    [Fact]
    public async Task The_whole_run_is_taken_back_as_a_new_revision_with_its_own_history_entry_and_the_model_is_told()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync(s => s.AgentMaxLooks = 0);   // the test polls like an editor but draws nothing
        var design = await DesignAsync(Role.Designer, DocumentOf(210, 297, "mm", Text("e1", 10, 10, 100, 10, "Vorher")));
        var sent = await RunAsync(Role.Designer, design, "Zwei Änderungen", null, Call("update_elements", """{"id": "e1", "set": {"text": "Nachher"}}"""), Write("a", "Neu", 40));
        Assert.Equal("Nachher|Neu", await TextsAsync(design));
        var revisionAfter = await RevisionAsync(design);

        var done = await As(Role.Designer, biz => AiAgentLogic.UndoAsync(biz, sent.ConversationId, false));
        Assert.Equal(1, done.Run);
        Assert.Equal(sent.RunId, done.RunId);
        Assert.Equal(revisionAfter + 1, done.Revision);
        Assert.Contains("Lauf 1", done.Message);
        Assert.Equal("Vorher", await TextsAsync(design));   // the document before the FIRST write, not after the first one
        Assert.Equal(revisionAfter + 1, await RevisionAsync(design));
        var history = await Db(db => db.DesignRevision.AsNoTracking().Where(r => r.DesignId == design).OrderByDescending(r => r.Revision).ToListAsync());
        Assert.Equal("KI rückgängig", history[0].Note);
        Assert.Equal("KI: Zwei Änderungen", history[1].Note);   // the two writes of the run share ONE entry
        Assert.Equal(1, history.Count(h => h.Note == "KI: Zwei Änderungen"));
        var entry = await Db(db => db.AiJournalEntry.AsNoTracking().FirstAsync(j => j.AiRunId == sent.RunId));
        Assert.NotNull(entry.RevertedDate);

        // nothing more to take back; the conversation says what happened, to the person and to the model
        await Assert.ThrowsAsync<BizException>(() => As(Role.Designer, biz => AiAgentLogic.UndoAsync(biz, sent.ConversationId, false)));
        var steps = await As(Role.Designer, biz => AiAgentLogic.StepsAsync(biz, sent.ConversationId, 0));
        Assert.Null(steps.UndoRun);
        var info = steps.Steps.Last();
        Assert.Equal("info", info.Kind);
        Assert.Equal("Lauf 1 rückgängig gemacht.", info.Text);
        Assert.Equal(1, (int)info.Data!["undo"]!);
        var runInfo = (await As(Role.Designer, biz => AiAgentLogic.ConversationAsync(biz, sent.ConversationId))).Runs.Single();
        Assert.True(runInfo.Undone);
        Seam.Reset();
        Seam.Script(AiScripted.Say("Fertig.", true));
        var next = await SendAsync(Role.Designer, design, "Und weiter", conversationId: sent.ConversationId);
        await WaitEndAsync(next.ConversationId);
        Assert.Contains(Seam.Requests.First().Messages, m => m.Role == "user" && m.Content.Contains("Die Änderungen von Lauf 1 wurden rückgängig gemacht"));
    }

    [Fact]
    public async Task A_run_that_only_read_has_nothing_to_undo_and_a_second_run_is_taken_back_before_the_first()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var design = await DesignAsync(Role.Designer, DocumentOf(210, 297, "mm", Text("e1", 10, 10, 100, 10, "Start")));
        var read = await RunAsync(Role.Designer, design, "Nur lesen", null, Call("read_design"));
        await Assert.ThrowsAsync<BizException>(() => As(Role.Designer, biz => AiAgentLogic.UndoAsync(biz, read.ConversationId, false)));
        Assert.Null((await As(Role.Designer, biz => AiAgentLogic.ConversationAsync(biz, read.ConversationId))).Undo);

        var first = await RunAsync(Role.Designer, design, "Erster Lauf", read.ConversationId, Write("a", "Eins", 40));
        var second = await RunAsync(Role.Designer, design, "Zweiter Lauf", read.ConversationId, Write("b", "Zwei", 60));
        Assert.Equal("Start|Eins|Zwei", await TextsAsync(design));
        var info = await As(Role.Designer, biz => AiAgentLogic.ConversationAsync(biz, read.ConversationId));
        Assert.Equal(3, info.Undo!.Run);   // the third run of the conversation made the newest change
        Assert.Equal(second.RunId, info.Undo.RunId);

        var undone = await As(Role.Designer, biz => AiAgentLogic.UndoAsync(biz, read.ConversationId, false));
        Assert.Equal(3, undone.Run);
        Assert.Equal("Start|Eins", await TextsAsync(design));
        Assert.Equal(2, (await As(Role.Designer, biz => AiAgentLogic.ConversationAsync(biz, read.ConversationId))).Undo!.Run);
        var again = await As(Role.Designer, biz => AiAgentLogic.UndoAsync(biz, read.ConversationId, false));
        Assert.Equal(2, again.Run);
        Assert.Equal("Start", await TextsAsync(design));
        Assert.NotEqual(first.RunId, second.RunId);
    }

    [Fact]
    public async Task When_somebody_changed_the_design_since_the_undo_asks_first_and_force_goes_ahead()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var design = await DesignAsync(Role.Designer, DocumentOf(210, 297, "mm", Text("e1", 10, 10, 100, 10, "Vorher")));
        var sent = await RunAsync(Role.Designer, design, "Ändere", null, Call("update_elements", """{"id": "e1", "set": {"text": "KI-Text"}}"""));
        await As(Role.Designer, async biz =>
        {
            var current = await DesignLogic.LoadAsync(biz, design);
            var doc = Obj(current!.DocumentJson);
            AiDocOps.Elements((JsonObject)AiDocOps.Pages(doc)[0]!).Add(Text("hand", 10, 100, 100, 10, "von Hand"));
            await DesignLogic.SaveDocumentAsync(biz, design, current.Revision, doc.ToJsonString(), true);
        });
        var revision = await RevisionAsync(design);
        var asked = await Assert.ThrowsAsync<AiChangedSinceException>(() => As(Role.Designer, biz => AiAgentLogic.UndoAsync(biz, sent.ConversationId, false)));
        Assert.Equal(revision, asked.CurrentRevision);
        Assert.Contains("Trotzdem zurücksetzen", asked.Message);
        Assert.Equal("KI-Text|von Hand", await TextsAsync(design));   // nothing happened
        Assert.NotNull((await As(Role.Designer, biz => AiAgentLogic.ConversationAsync(biz, sent.ConversationId))).Undo);

        var forced = await As(Role.Designer, biz => AiAgentLogic.UndoAsync(biz, sent.ConversationId, true));
        Assert.Equal(revision + 1, forced.Revision);
        Assert.Equal("Vorher", await TextsAsync(design));   // the change by hand is gone, as warned
    }

    [Fact]
    public async Task The_newest_run_of_the_design_is_taken_back_first_whoever_made_it_and_the_other_conversation_is_told()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var design = await DesignAsync(Role.Designer, DocumentOf(210, 297, "mm", Text("e1", 10, 10, 100, 10, "Start")));
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer, SharePermission.Edit);
        var mine = await RunAsync(Role.Designer, design, "Meine Änderung", null, Write("a", "Von mir", 40));
        var theirs = await RunAsync(Role.Viewer, design, "Seine Änderung", null, Write("b", "Von ihm", 60));
        Assert.Equal("Start|Von mir|Von ihm", await TextsAsync(design));

        // for me the newest change is not mine: the panel can say so
        var page = await As(Role.Designer, biz => AiAgentLogic.StepsAsync(biz, mine.ConversationId, 0));
        Assert.Null(page.UndoRun);
        Assert.True(page.UndoOther);
        var mineInfo = await As(Role.Designer, biz => AiAgentLogic.ConversationAsync(biz, mine.ConversationId));
        Assert.Null(mineInfo.Undo!.Run);
        Assert.True(mineInfo.Undo.Other);
        var hisPage = await As(Role.Viewer, biz => AiAgentLogic.StepsAsync(biz, theirs.ConversationId, 0));
        Assert.Equal(1, hisPage.UndoRun);

        // taking back through MY conversation takes back HIS run (the newest), and it says so in his conversation
        var done = await As(Role.Designer, biz => AiAgentLogic.UndoAsync(biz, mine.ConversationId, false));
        Assert.Equal(theirs.RunId, done.RunId);
        Assert.Equal("Start|Von mir", await TextsAsync(design));
        var theirSteps = await As(Role.Viewer, biz => AiAgentLogic.StepsAsync(biz, theirs.ConversationId, 0));
        Assert.Equal("info", theirSteps.Steps.Last().Kind);
        Assert.Null(theirSteps.UndoRun);
        // now mine is the newest
        Assert.Equal(1, (await As(Role.Designer, biz => AiAgentLogic.StepsAsync(biz, mine.ConversationId, 0))).UndoRun);
        var second = await As(Role.Viewer, biz => AiAgentLogic.UndoAsync(biz, theirs.ConversationId, false));
        Assert.Equal(mine.RunId, second.RunId);
        Assert.Equal("Start", await TextsAsync(design));
    }

    [Fact]
    public async Task Undo_needs_edit_and_a_conversation_of_your_own_and_waits_for_a_running_run()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var design = await DesignAsync(Role.Designer, DocumentOf(210, 297, "mm", Text("e1", 10, 10, 100, 10, "Start")));
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer, SharePermission.Edit);
        var sent = await RunAsync(Role.Viewer, design, "Ändere", null, Write("a", "Neu", 40));
        // his Edit is taken down to View: his conversation is still his, but he may not take back anything
        var shareId = await Db(db => db.Share.AsNoTracking().Where(x => x.ItemId == design && x.ItemKind == ItemKind.Design).Select(x => x.Id).FirstAsync());
        await As(Role.Designer, biz => ShareLogic.ChangeAsync(biz, shareId, SharePermission.View));
        await Assert.ThrowsAsync<ForbiddenException>(() => As(Role.Viewer, biz => AiAgentLogic.UndoAsync(biz, sent.ConversationId, false)));
        Assert.True((await As(Role.Viewer, biz => AiAgentLogic.StepsAsync(biz, sent.ConversationId, 0))).Steps.Count > 0);   // reading his own conversation is fine
        // a stranger and an administrator without a right to the design find nothing; the owner of the design has no part in the conversation
        await Assert.ThrowsAsync<NotFoundException>(() => As(Role.Stranger, biz => AiAgentLogic.UndoAsync(biz, sent.ConversationId, false)));
        await Assert.ThrowsAsync<NotFoundException>(() => As(Role.Admin, biz => AiAgentLogic.UndoAsync(biz, sent.ConversationId, false)));
        await Assert.ThrowsAsync<NotFoundException>(() => As(Role.Designer, biz => AiAgentLogic.UndoAsync(biz, sent.ConversationId, false)));
        Assert.Equal("Start|Neu", await TextsAsync(design));
        await As(Role.Designer, biz => ShareLogic.ChangeAsync(biz, shareId, SharePermission.Edit));

        // while a run works nothing is taken back
        Seam.Reset();
        Seam.Script(new AiScripted(AiScripted.Say("Langsam.", true).Text, Delay: TimeSpan.FromSeconds(60)));
        var slow = await SendAsync(Role.Designer, design, "Langsam");
        await WaitUntilAsync(() => Task.FromResult(Runner.IsRunning(slow.ConversationId) && Seam.Requests.Count == 1), "the call");
        var busy = await Assert.ThrowsAsync<BizException>(() => As(Role.Viewer, biz => AiAgentLogic.UndoAsync(biz, sent.ConversationId, false)));
        Assert.Contains("arbeitet noch", busy.Message);
        await As(Role.Designer, biz => AiAgentLogic.CancelAsync(biz, slow.ConversationId));
        await WaitEndAsync(slow.ConversationId);
        var undone = await As(Role.Viewer, biz => AiAgentLogic.UndoAsync(biz, sent.ConversationId, false));
        Assert.Equal("Start", await TextsAsync(design));
        Assert.Equal(sent.RunId, undone.RunId);
    }
}
