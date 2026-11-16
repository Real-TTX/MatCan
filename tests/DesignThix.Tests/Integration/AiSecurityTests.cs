using System.IO.Compression;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.Services.Ai;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DesignThix.Tests.Integration;

/// <summary>
/// The final pass of plan 4 (docs/PLAN-AI-DESIGN.md, "Security review (A3)"): the name of a design made from a prompt, "Rückgängig" after the editor's own Strg+Z, the defaults and the wording of the limits,
/// and a test for every fix of the review: files of a conversation, the picture of <c>look</c> (one use), hostile PDF, Word and Excel files, a run whose person is gone, the poll, antiforgery on every POST of the AI.
/// </summary>
[Collection("app")]
public sealed class AiSecurityTests(AppTests.AppFactory factory) : AiAgentTestBase(factory)
{
    private const string Write = """{"elements": [{"type": "text", "x": 10, "y": 10, "w": 100, "h": 10, "text": "Hallo"}]}""";

    private const string LongPrompt = "Ein Plakat für das Sommerfest im Hofladen am Samstag, 12. Juli ab 14 Uhr mit Musik und gutem Essen für alle";

    private Task<AiAgentLogic.Started> StartAsync(Role who, string prompt, string? preset = null)
        => As(who, biz => AiAgentLogic.StartNewAsync(biz, new AiAgentLogic.NewDesignInput(prompt, preset, null, null, null, null, null, null, null)));

    private Task<string> NameOfAsync(long design) => Db(db => db.Design.AsNoTracking().Where(d => d.Id == design).Select(d => d.Name).FirstAsync());

    // ================================================================================================ the name of a design made from a prompt

    [Fact]
    public async Task A_design_made_from_a_prompt_is_named_after_the_first_message_when_the_model_did_not_name_it()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        Seam.Script(AiScripted.Say("Ich lege los.", false, Call("add_elements", Write)), AiScripted.Say("Fertig.", true));
        var started = await StartAsync(Role.Designer, LongPrompt, "poster-a3-portrait");
        Assert.StartsWith("Unbenannt", await NameOfAsync(started.DesignId));   // while the run starts
        await WaitEndAsync(started.Sent.ConversationId);
        var name = await NameOfAsync(started.DesignId);
        Assert.StartsWith("Ein Plakat für das Sommerfest", name);
        Assert.DoesNotContain("Unbenannt", name);
        Assert.True(name.Length <= 61, name);
    }

    [Fact]
    public async Task A_name_the_model_gave_stays_and_a_run_that_changed_nothing_leaves_the_placeholder_name()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        Seam.Script(
            AiScripted.Say("Ich benenne es.", false, Call("rename_design", """{"name": "Hoffest – Einladung"}"""), Call("add_elements", Write)),
            AiScripted.Say("Fertig.", true));
        var named = await StartAsync(Role.Designer, LongPrompt, "poster-a3-portrait");
        await WaitEndAsync(named.Sent.ConversationId);
        Assert.Equal("Hoffest – Einladung", await NameOfAsync(named.DesignId));

        // the model only reads: nothing was made, the name stays a placeholder
        Seam.Reset();
        Seam.Script(AiScripted.Say("Ich schaue.", false, Call("read_design")), AiScripted.Say("Gibt es noch nichts zu tun.", true));
        var read = await StartAsync(Role.Designer, "Nur ein Blick", "poster-a3-portrait");
        await WaitEndAsync(read.Sent.ConversationId);
        Assert.StartsWith("Unbenannt", await NameOfAsync(read.DesignId));
    }

    [Fact]
    public async Task A_design_the_person_opened_themselves_is_never_renamed_by_the_server_and_the_model_is_asked_to_name_a_placeholder()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var design = await As(Role.Designer, biz => DesignLogic.CreateFromFormatAsync(biz, "a4-portrait", null, null, null, null));
        Assert.StartsWith("Unbenannt", design.Name);
        Seam.Script(AiScripted.Say("Ich schreibe.", false, Call("add_elements", Write)), AiScripted.Say("Fertig.", true));
        var sent = await SendAsync(Role.Designer, design.Id, "Schreib Hallo auf die Seite");
        await WaitEndAsync(sent.ConversationId);
        Assert.Equal(design.Name, await NameOfAsync(design.Id));   // only a design made from a prompt gets the safety net
        // but the model is told about the placeholder (and the rule is in the fixed part)
        Assert.Contains("heißt noch wie ein neues", Seam.Requests.First().Messages[0].Content);
        Assert.Contains("rename_design", Seam.Requests.First().Messages[0].Content);

        // a named design says nothing about it
        await As(Role.Designer, biz => DesignLogic.RenameAsync(biz, design.Id, "Mein Plakat"));
        Seam.Reset();
        Seam.Script(AiScripted.Say("Fertig.", true));
        var second = await SendAsync(Role.Designer, design.Id, "Noch etwas", conversationId: sent.ConversationId);
        await WaitEndAsync(second.ConversationId);
        Assert.DoesNotContain("heißt noch wie ein neues", Seam.Requests.First().Messages[0].Content);
    }

    [Theory]
    [InlineData("Ein Plakat für das Sommerfest.", "Ein Plakat für das Sommerfest")]
    [InlineData("  „Hoffest“!!  ", "Hoffest")]
    [InlineData("Unbenannt – A4", null)]
    [InlineData("ab", null)]
    [InlineData("", null)]
    public void The_name_from_a_title_is_short_clean_and_never_a_placeholder(string title, string? expected)
        => Assert.Equal(expected, AiAgentLogic.DesignNameFromTitle(title));

    [Fact]
    public void A_long_title_is_cut_at_a_word()
    {
        var name = AiAgentLogic.DesignNameFromTitle("Mach daraus bitte ein Plakat für das große Sommerfest im Hofladen am Samstag im Juli")!;
        Assert.True(name.Length <= 61, name);
        Assert.EndsWith("…", name);
        Assert.StartsWith("Mach daraus bitte ein Plakat", name);
    }

    // ================================================================================================ undo after the editor's own Strg+Z

    [Fact]
    public async Task When_the_design_already_is_what_it_was_before_the_run_the_undo_only_marks_the_run_without_a_question()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync(s => s.AgentMaxLooks = 0);   // the test polls like an editor but draws nothing
        var start = DocumentOf(210, 297, "mm", Text("e1", 10, 10, 100, 10, "Vorher"));
        var design = await DesignAsync(Role.Designer, start);
        Seam.Script(AiScripted.Say("Ich ändere.", false, Call("update_elements", """{"id": "e1", "set": {"text": "KI-Text"}}""")), AiScripted.Say("Fertig.", true));
        var sent = await SendAsync(Role.Designer, design, "Ändere den Text");
        await WaitEndAsync(sent.ConversationId);
        Assert.Equal("KI-Text", Elements(await StoredDocAsync(design)).First()["text"]!.ToString());
        var before = Obj((await Db(db => db.DesignRevision.AsNoTracking().Where(r => r.DesignId == design).OrderBy(r => r.Revision).Select(r => r.DocumentJson).ToListAsync())).First(j => j.Contains("Vorher"))).ToJsonString();

        // the editor's Strg+Z: the old document is saved again as an ordinary autosave
        await As(Role.Designer, async biz =>
        {
            var current = await DesignLogic.LoadAsync(biz, design);
            await DesignLogic.SaveDocumentAsync(biz, design, current!.Revision, before, true);
        });
        var revision = await RevisionAsync(design);
        var revisions = await Db(db => db.DesignRevision.CountAsync(r => r.DesignId == design));

        // no "changed since" question, no new revision: the run is only marked as taken back
        var done = await As(Role.Designer, biz => AiAgentLogic.UndoAsync(biz, sent.ConversationId, false));
        Assert.Equal(revision, done.Revision);
        Assert.Contains("schon wieder so aus wie vor Lauf 1", done.Message);
        Assert.Equal("Vorher", Elements(await StoredDocAsync(design)).First()["text"]!.ToString());
        Assert.Equal(revisions, await Db(db => db.DesignRevision.CountAsync(r => r.DesignId == design)));
        Assert.NotNull((await Db(db => db.AiJournalEntry.AsNoTracking().FirstAsync(j => j.AiRunId == sent.RunId))).RevertedDate);
        Assert.Null((await As(Role.Designer, biz => AiAgentLogic.ConversationAsync(biz, sent.ConversationId))).Undo);
        Assert.Null((await As(Role.Designer, biz => AiAgentLogic.StepsAsync(biz, sent.ConversationId, 0))).UndoRun);
        // the model is told, as after any undo
        var steps = await As(Role.Designer, biz => AiAgentLogic.StepsAsync(biz, sent.ConversationId, 0));
        Assert.Equal("info", steps.Steps.Last().Kind);

        // a design that really changed since still asks
        Seam.Reset();
        Seam.Script(AiScripted.Say("Noch einmal.", false, Call("update_elements", """{"id": "e1", "set": {"text": "KI-Text 2"}}""")), AiScripted.Say("Fertig.", true));
        var again = await SendAsync(Role.Designer, design, "Noch einmal", conversationId: sent.ConversationId);
        await WaitEndAsync(again.ConversationId);
        await As(Role.Designer, async biz =>
        {
            var current = await DesignLogic.LoadAsync(biz, design);
            var doc = Obj(current!.DocumentJson);
            doc["pages"]![0]!["elements"]!.AsArray().Add(Text("hand", 10, 100, 100, 10, "von Hand"));
            await DesignLogic.SaveDocumentAsync(biz, design, current.Revision, doc.ToJsonString(), true);
        });
        await Assert.ThrowsAsync<AiChangedSinceException>(() => As(Role.Designer, biz => AiAgentLogic.UndoAsync(biz, sent.ConversationId, false)));
    }

    // ================================================================================================ budgets and limits

    [Fact]
    public void The_defaults_of_the_limits_fit_a_working_day_with_the_assistant()
    {
        var s = new AiSettings();
        Assert.Equal(3_000_000, s.UserDailyTokens);        // about 30 runs of 100 000 tokens (a new design with the search of templates, looks and the review)
        Assert.Equal(40_000_000, s.UserMonthlyTokens);
        Assert.Equal(200_000_000, s.MonthlyTokens);
        Assert.True(s.MonthlyTokens > s.UserMonthlyTokens);   // the cap of all people is not lower than what one person may use
        Assert.Equal(200, s.AddressDailyRuns);
        Assert.Equal(60, s.PerMinutePerAddress);
        Assert.True(s.UserDailyTokens >= 20 * 100_000);
    }

    [Fact]
    public async Task What_an_administrator_saved_stays_and_the_limit_text_names_the_limit()
    {
        if (!Enabled)
        {
            return;
        }

        await using var admins = await RealAdminsAsync();
        await ResetAsync(s => s.UserDailyTokens = 20);
        Assert.Equal(20, await As(Role.Admin, biz => Task.FromResult(SettingLogic.Get<AiSettings>(biz, SettingStore.Ai).UserDailyTokens)));   // what was saved is what counts
        var adminId = admins.Ids[0];
        var memberDesign = await DesignAsync(Role.Designer);
        var adminDesign = (await AsUser(adminId, biz => DesignLogic.CreateFromFormatAsync(biz, "a4-portrait", null, null, null, null), UserRole.Admin)).Id;
        Seam.Script(AiScripted.Say("Ich lese.", false, Call("read_design")), AiScripted.Say("Ich lese noch einmal.", false, Call("read_design")), AiScripted.Say("Fertig.", true));

        // the run uses its tokens; the next message is refused BEFORE anything is stored, and says which limit it is
        var first = await SendAsync(Role.Designer, memberDesign, "Erster Auftrag");
        var run = await WaitEndAsync(first.ConversationId);
        Assert.Equal(AiRunStatus.LimitReached, run.Status);   // the per-call check stopped it: 15 tokens per call, 20 allowed
        var endStep = (await StepsOfAsync(first.ConversationId)).Last(s => s.Kind == AiStepKind.End);
        var end = JsonDocument.Parse(endStep.DataJson).RootElement;
        Assert.Equal("limit", end.GetProperty("state").GetString());
        Assert.Equal("user-day", end.GetProperty("limit").GetString());
        Assert.Equal(JsonValueKind.Null, end.GetProperty("href").ValueKind);   // a member gets no link to the settings
        Assert.Contains("Tagesbudget", endStep.Text);
        Assert.Contains("20 Tokens pro Tag", endStep.Text);

        var refusedMember = await Assert.ThrowsAsync<AiLimitException>(() => SendAsync(Role.Designer, memberDesign, "Zweiter Auftrag"));
        Assert.Equal("user-day", refusedMember.Kind);
        Assert.Null(refusedMember.Href);
        Assert.Contains("Tagesbudget", refusedMember.Message);

        // an administrator is told where to change it: first they use the budget, then the refusal carries the way
        Seam.Reset();
        Seam.Script(AiScripted.Say("Ich lese.", false, Call("read_design")), AiScripted.Say("Ich lese noch einmal.", false, Call("read_design")), AiScripted.Say("Fertig.", true));
        Task<AiAgentLogic.Sent> AdminSends(string text) => AsUser(adminId, biz => AiAgentLogic.SendAsync(biz, adminDesign, new AiAgentLogic.SendInput(text, null, null, null, null)), UserRole.Admin);
        var adminRun = await AdminSends("Auftrag des Administrators");
        await WaitEndAsync(adminRun.ConversationId);
        var adminEnd = JsonDocument.Parse((await StepsOfAsync(adminRun.ConversationId)).Last(s => s.Kind == AiStepKind.End).DataJson).RootElement;
        Assert.Equal("/Admin/Ai?tab=limits", adminEnd.GetProperty("href").GetString());
        var refusedAdmin = await Assert.ThrowsAsync<AiLimitException>(() => AdminSends("Noch einer"));
        Assert.Equal("/Admin/Ai?tab=limits", refusedAdmin.Href);

        // and the way is in the answer of the panel for an administrator only
        Assert.Equal("/Admin/Ai?tab=limits", (await AsUser(adminId, biz => AiAgentLogic.AvailabilityAsync(biz, adminDesign), UserRole.Admin)).LimitsHref);
        Assert.Null((await As(Role.Designer, biz => AiAgentLogic.AvailabilityAsync(biz, memberDesign))).LimitsHref);
    }

    [Fact]
    public async Task The_limit_over_http_is_a_429_with_the_kind_and_the_way_for_an_administrator_only()
    {
        if (!Enabled)
        {
            return;
        }

        await using var admins = await RealAdminsAsync();
        await ResetAsync(s => s.UserDailyTokens = 1);
        var adminId = admins.Ids[0];
        var design = (await AsUser(adminId, biz => DesignLogic.CreateFromFormatAsync(biz, "a4-portrait", null, null, null, null), UserRole.Admin)).Id;
        var admin = await SignInAsync(adminId);
        Seam.Script(AiScripted.Say("Fertig.", true));
        var firstForm = new MultipartFormDataContent { { new StringContent("Erster"), "text" } };
        var first = await Post(admin, $"/api/ai/designs/{design}/messages", firstForm);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        await WaitEndAsync((await first.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("conversationId").GetInt64());

        var refused = await Post(admin, $"/api/ai/designs/{design}/messages", new MultipartFormDataContent { { new StringContent("Zweiter"), "text" } });
        Assert.Equal(HttpStatusCode.TooManyRequests, refused.StatusCode);
        var body = await refused.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("limit", body.GetProperty("code").GetString());
        Assert.Equal("user-day", body.GetProperty("limit").GetString());
        Assert.Equal("/Admin/Ai?tab=limits", body.GetProperty("href").GetString());

        // the page of the limits opens on the tab of the limits
        var page = await admin.GetStringAsync("/Admin/Ai?tab=limits");
        Assert.Matches("id=\"ai-tabs-tab-limits\"[^>]*aria-selected=\"true\"", page);
        await ResetAsync();
    }

    private static async Task<HttpResponseMessage> Post(HttpClient client, string url, HttpContent? content)
    {
        var csrf = System.Text.RegularExpressions.Regex.Match(await client.GetStringAsync("/"), "<meta name=\"dt-csrf\" content=\"([^\"]+)\"").Groups[1].Value;
        using var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = content };
        request.Headers.Add("RequestVerificationToken", csrf);
        return await client.SendAsync(request);
    }

    // ================================================================================================ the conversation belongs to its person

    [Fact]
    public async Task Every_conversation_method_is_for_its_person_or_an_administrator_and_a_stranger_finds_nothing()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var design = await DesignAsync(Role.Designer);
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer, SharePermission.Edit);
        Seam.Script(AiScripted.Say("Ich schreibe.", false, Call("add_elements", Write)), AiScripted.Say("Fertig.", true));
        var sent = await SendAsync(Role.Designer, design, "Mein Auftrag");
        await WaitEndAsync(sent.ConversationId);
        var id = sent.ConversationId;

        // somebody with Edit on the same design still has no part in MY conversation
        foreach (var who in new[] { Role.Viewer, Role.Stranger })
        {
            await Assert.ThrowsAsync<NotFoundException>(() => As(who, biz => AiAgentLogic.StepsAsync(biz, id, 0)));
            await Assert.ThrowsAsync<NotFoundException>(() => As(who, biz => AiAgentLogic.ConversationAsync(biz, id)));
            await Assert.ThrowsAsync<NotFoundException>(() => As(who, biz => AiAgentLogic.CancelAsync(biz, id)));
            await Assert.ThrowsAsync<NotFoundException>(() => As(who, biz => AiAgentLogic.UndoAsync(biz, id, true)));
            await Assert.ThrowsAsync<NotFoundException>(() => As(who, biz => AiAgentLogic.DeleteAsync(biz, id)));
            await Assert.ThrowsAsync<NotFoundException>(() => As(who, biz => AiAgentLogic.PictureAsync(biz, id, "x.png")));
            // and cannot continue it either
            await Assert.ThrowsAsync<NotFoundException>(() => SendAsync(who, design, "Ich schreibe in fremde Unterhaltung", conversationId: id));
        }

        // an unknown id looks the same
        await Assert.ThrowsAsync<NotFoundException>(() => As(Role.Designer, biz => AiAgentLogic.StepsAsync(biz, id + 1_000_000, 0)));
        // an administrator reads it (the run list), but is no editor of the design: no undo
        Assert.NotEmpty((await As(Role.Admin, biz => AiAgentLogic.StepsAsync(biz, id, 0))).Steps);
        await Assert.ThrowsAsync<NotFoundException>(() => As(Role.Admin, biz => AiAgentLogic.UndoAsync(biz, id, true)));
        // the poll names the design: an editor does not follow a conversation of another design
        Assert.Equal(design, (await As(Role.Designer, biz => AiAgentLogic.StepsAsync(biz, id, 0))).DesignId);
        // the conversation of somebody who may no longer see the design is gone for them too
        Seam.Reset();
        Seam.Script(AiScripted.Say("Fertig.", true));
        var his = await SendAsync(Role.Viewer, design, "Mein eigener Auftrag");
        await WaitEndAsync(his.ConversationId);
        Assert.NotEmpty((await As(Role.Viewer, biz => AiAgentLogic.StepsAsync(biz, his.ConversationId, 0))).Steps);
        var shareId = await Db(db => db.Share.AsNoTracking().Where(x => x.ItemId == design && x.ItemKind == ItemKind.Design).Select(x => x.Id).FirstAsync());
        await As(Role.Designer, biz => ShareLogic.RemoveAsync(biz, shareId));
        await Assert.ThrowsAsync<NotFoundException>(() => As(Role.Viewer, biz => AiAgentLogic.StepsAsync(biz, his.ConversationId, 0)));
    }

    [Fact]
    public async Task The_files_of_a_conversation_are_only_its_own_pictures_by_a_plain_name()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var design = await DesignAsync(Role.Designer);
        Seam.Script(AiScripted.Say("Fertig.", true), AiScripted.Say("Fertig.", true));
        var one = await SendAsync(Role.Designer, design, "Erste Unterhaltung");
        await WaitEndAsync(one.ConversationId);
        Seam.Reset();
        Seam.Script(AiScripted.Say("Fertig.", true));
        var two = await SendAsync(Role.Designer, design, "Zweite Unterhaltung");
        await WaitEndAsync(two.ConversationId);

        var root = await As(Role.Designer, biz => Task.FromResult(AiAttachmentLogic.Root(biz)));
        var png = File.ReadAllBytes(Path.Combine(DesignThix.Tests.Core.RepoFiles.WwwRoot(), "img", "icon-192.png"));
        Directory.CreateDirectory(Path.Combine(root, one.ConversationId.ToString()));
        Directory.CreateDirectory(Path.Combine(root, two.ConversationId.ToString()));
        await File.WriteAllBytesAsync(Path.Combine(root, one.ConversationId.ToString(), "bild-eins.png"), png);
        await File.WriteAllTextAsync(Path.Combine(root, one.ConversationId.ToString(), "geheim.txt"), "kein Bild");
        await File.WriteAllTextAsync(Path.Combine(root, "geheim.png"), "ausserhalb");

        var own = await As(Role.Designer, biz => AiAgentLogic.PictureAsync(biz, one.ConversationId, "bild-eins.png"));
        Assert.NotNull(own);
        Assert.Equal("image/png", own!.Value.ContentType);
        // the same name asked through the other conversation of the same person: nothing
        Assert.Null(await As(Role.Designer, biz => AiAgentLogic.PictureAsync(biz, two.ConversationId, "bild-eins.png")));
        // a path never gets through: separators, dots, the folder above, another conversation's folder, a name that is no picture
        foreach (var name in new[]
        {
            "../bild-eins.png", "..\\bild-eins.png", $"../{one.ConversationId}/bild-eins.png", $"{one.ConversationId}/bild-eins.png", "../geheim.png", "..", ".", ".hidden.png",
            "geheim.txt", "bild-eins.png/", "bild-eins.png\0", "%2e%2e%2fgeheim.png", "C:\\Windows\\win.ini", "/etc/passwd", new string('a', 400) + ".png", "",
        })
        {
            Assert.Null(await As(Role.Designer, biz => AiAgentLogic.PictureAsync(biz, two.ConversationId, name)));
            Assert.Null(await As(Role.Designer, biz => AiAgentLogic.PictureAsync(biz, one.ConversationId, name)));
        }
    }

    // ================================================================================================ the picture for look: one use, the person of the run, a picture

    [Fact]
    public async Task The_picture_for_look_can_be_handed_in_once_and_only_as_a_picture_by_the_person_of_the_run()
    {
        if (!Enabled)
        {
            return;
        }

        var broker = new AiRenderBroker(TimeProvider.System);
        var request = new AiRenderBroker.Request(7, 70, 1, "p1", 1, 3, AiRenderBroker.NewToken());
        var waiting = Task.Run(() => broker.RequestAsync(request, TimeSpan.FromSeconds(10), default));
        await WaitUntilAsync(() => Task.FromResult(broker.PendingFor(70) is not null), "the request");
        var jpeg = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3 };

        Assert.False(broker.TryComplete(8, request.Token, 1, jpeg));                 // another run
        Assert.False(broker.TryComplete(7, request.Token, 2, jpeg));                 // another person
        Assert.False(broker.TryComplete(7, "", 1, jpeg));                            // no token
        Assert.False(broker.TryComplete(7, request.Token[..^1], 1, jpeg));           // a token that is almost right
        Assert.False(broker.TryComplete(7, request.Token.ToUpperInvariant() + "x", 1, jpeg));
        Assert.True(waiting.IsCompleted is false);                                   // none of them ended the wait
        Assert.True(broker.TryComplete(7, request.Token, 1, jpeg));
        Assert.Equal(jpeg, await waiting);
        // a second use of the same token (a replay) finds nothing, also when the request is gone
        Assert.False(broker.TryComplete(7, request.Token, 1, [0xFF, 0xD8, 0xFF, 9]));
        Assert.False(broker.TryFail(7, request.Token, 1));
        Assert.Null(broker.PendingFor(70));
    }

    [Fact]
    public async Task A_picture_handed_in_for_look_is_checked_by_its_bytes_not_by_what_the_browser_says()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var design = await DesignAsync(Role.Designer);
        // the first call takes a moment: the "editor" polls meanwhile, so `look` finds one that is there
        Seam.Script(new AiScripted(AiScripted.Say("Ich lese.", false, Call("read_design")).Text, Delay: TimeSpan.FromMilliseconds(700)), AiScripted.Say("Ich schaue.", false, Call("look")), AiScripted.Say("Fertig.", true));
        var sent = await SendAsync(Role.Designer, design, "Prüf es");
        await As(Role.Designer, biz => AiAgentLogic.StepsAsync(biz, sent.ConversationId, 0));
        var broker = Factory.Services.GetRequiredService<AiRenderBroker>();
        AiRenderBroker.Request? asked = null;
        await WaitUntilAsync(() =>
        {
            asked = broker.PendingFor(sent.ConversationId);
            return Task.FromResult(asked is not null);
        }, "a render request", 20);
        var gif = "GIF89a"u8.ToArray().Concat(new byte[200]).ToArray();
        var html = "<html><script>alert(1)</script></html>"u8.ToArray();
        var zeros = new byte[500];
        foreach (var bad in new[] { gif, html, zeros, Array.Empty<byte>() })
        {
            await Assert.ThrowsAsync<BizException>(() => As(Role.Designer, biz => AiAgentLogic.RenderUploadAsync(biz, asked!.RunId, asked.Token, bad)));
        }

        Assert.NotNull(broker.PendingFor(sent.ConversationId));   // the refused tries did not use the request up
        var png = File.ReadAllBytes(Path.Combine(DesignThix.Tests.Core.RepoFiles.WwwRoot(), "img", "icon-192.png"));
        Assert.True(await As(Role.Designer, biz => AiAgentLogic.RenderUploadAsync(biz, asked!.RunId, asked.Token, png)));
        Assert.False(await As(Role.Designer, biz => AiAgentLogic.RenderUploadAsync(biz, asked!.RunId, asked.Token, png)));
        await WaitEndAsync(sent.ConversationId);
    }

    // ================================================================================================ hostile files

    private static byte[] Zlib(long zeros)
    {
        using var output = new MemoryStream();
        using (var z = new ZLibStream(output, CompressionLevel.Fastest, true))
        {
            var block = new byte[1024 * 1024];
            for (long done = 0; done < zeros; done += block.Length)
            {
                z.Write(block);
            }
        }

        return output.ToArray();
    }

    private static byte[] Pdf(string dictionary, byte[] stream)
    {
        using var ms = new MemoryStream();
        ms.Write("%PDF-1.4\n"u8);
        ms.Write(Encoding.Latin1.GetBytes($"1 0 obj\n<< {dictionary} /Length {stream.Length} >>\nstream\n"));
        ms.Write(stream);
        ms.Write("\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"u8);
        return ms.ToArray();
    }

    [Fact]
    public void A_pdf_whose_streams_unpack_to_gigabytes_is_refused_before_the_library_reads_it()
    {
        // 200 MB of zeros in one stream: a few hundred KB in the file
        var bomb = Pdf("/Filter /FlateDecode", Zlib(200L * 1024 * 1024));
        Assert.True(bomb.Length < 5_000_000, "the bomb is small: " + bomb.Length);
        var refused = Assert.Throws<BizException>(() => AiAttachmentLogic.RejectPdfBomb(bomb, default));
        Assert.Contains("stark gepackte", refused.Message);

        // many streams that are each fine but together too much
        using var many = new MemoryStream();
        many.Write("%PDF-1.4\n"u8);
        var piece = Zlib(40L * 1024 * 1024);
        for (var i = 0; i < 8; i++)
        {
            many.Write(Encoding.Latin1.GetBytes($"{i + 1} 0 obj\n<< /Filter /FlateDecode /Length {piece.Length} >>\nstream\n"));
            many.Write(piece);
            many.Write("\nendstream\nendobj\n"u8);
        }

        Assert.Throws<BizException>(() => AiAttachmentLogic.RejectPdfBomb(many.ToArray(), default));

        // an ordinary page content, a stream that is not zlib data, and a picture (the text reading never unpacks pictures) go through
        var text = Zlib(0).Length > 0 ? Encoding.ASCII.GetBytes("BT /F1 12 Tf (Hallo) Tj ET") : [];
        using var ok = new MemoryStream();
        using (var z = new ZLibStream(ok, CompressionLevel.Optimal, true))
        {
            z.Write(text);
        }

        AiAttachmentLogic.RejectPdfBomb(Pdf("/Filter /FlateDecode", ok.ToArray()), default);
        AiAttachmentLogic.RejectPdfBomb(Pdf("/Filter /FlateDecode", [0x78, 0x9C, 1, 2, 3, 4, 5, 6]), default);
        AiAttachmentLogic.RejectPdfBomb(Pdf("/Type /XObject /Subtype /Image /Filter /FlateDecode", Zlib(200L * 1024 * 1024)), default);
        AiAttachmentLogic.RejectPdfBomb("%PDF-1.4 nichts weiter"u8.ToArray(), default);
    }

    [Fact]
    public void A_pdf_with_a_flood_of_streams_is_refused_and_the_scan_can_be_cancelled()
    {
        using var flood = new MemoryStream();
        flood.Write("%PDF-1.4\n"u8);
        var tiny = new byte[] { 0x78, 0x9C, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01 };   // an empty zlib stream
        for (var i = 0; i < 25_000; i++)
        {
            flood.Write("<< /Filter /FlateDecode >>\nstream\n"u8);
            flood.Write(tiny);
            flood.Write("\nendstream\n"u8);
        }

        Assert.Throws<BizException>(() => AiAttachmentLogic.RejectPdfBomb(flood.ToArray(), default));
        using var cancelled = new CancellationTokenSource();
        cancelled.Cancel();
        Assert.Throws<OperationCanceledException>(() => AiAttachmentLogic.RejectPdfBomb(flood.ToArray(), cancelled.Token));
    }

    [Fact]
    public async Task Hostile_pdf_word_and_excel_files_come_back_as_chips_with_a_reason_and_the_run_goes_on()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync(s => s.AgentMaxFilesPerMessage = 8);
        // a word file whose document is 40 MB unpacked (a tree of that in memory is the danger)
        byte[] bigXml;
        using (var stream = new MemoryStream())
        {
            using (var zip = new ZipArchive(stream, ZipArchiveMode.Create, true))
            {
                await using var writer = zip.CreateEntry("word/document.xml", CompressionLevel.Fastest).Open();
                var block = new byte[1024 * 1024];
                for (var i = 0; i < 40; i++)
                {
                    await writer.WriteAsync(block);
                }
            }

            bigXml = stream.ToArray();
        }

        // an excel file with a sheet of the same size
        byte[] bigSheet;
        using (var stream = new MemoryStream())
        {
            using (var zip = new ZipArchive(stream, ZipArchiveMode.Create, true))
            {
                await using (var workbook = zip.CreateEntry("xl/workbook.xml").Open())
                {
                    await workbook.WriteAsync("<workbook/>"u8.ToArray());
                }

                await using var writer = zip.CreateEntry("xl/worksheets/sheet1.xml", CompressionLevel.Fastest).Open();
                var block = new byte[1024 * 1024];
                for (var i = 0; i < 35; i++)
                {
                    await writer.WriteAsync(block);
                }
            }

            bigSheet = stream.ToArray();
        }

        // thousands of entries
        byte[] crowd;
        using (var stream = new MemoryStream())
        {
            using (var zip = new ZipArchive(stream, ZipArchiveMode.Create, true))
            {
                for (var i = 0; i < 3100; i++)
                {
                    await using var writer = zip.CreateEntry($"part{i}.txt").Open();
                    await writer.WriteAsync("x"u8.ToArray());
                }
            }

            crowd = stream.ToArray();
        }

        var design = await DesignAsync(Role.Designer);
        Seam.Script(AiScripted.Say("Fertig.", true));
        var sent = await SendAsync(Role.Designer, design, "Hostile Dateien", files: [
            new IncomingFile("bombe.pdf", Pdf("/Filter /FlateDecode", Zlib(200L * 1024 * 1024))),
            new IncomingFile("gross.docx", bigXml),
            new IncomingFile("tabelle.xlsx", bigSheet),
            new IncomingFile("viele.docx", crowd),
            new IncomingFile("notiz.txt", Encoding.UTF8.GetBytes("Das geht.")),
        ]);
        await WaitEndAsync(sent.ConversationId);
        Assert.Contains("stark gepackte", sent.Files[0].Refused);
        Assert.Contains("entpackt", sent.Files[1].Refused);
        Assert.Contains("entpackt", sent.Files[2].Refused);
        Assert.Contains("entpackt", sent.Files[3].Refused);
        Assert.Null(sent.Files[4].Refused);
        Assert.Equal(AiRunStatus.Done, (await Db(db => db.AiRun.AsNoTracking().FirstAsync(r => r.Id == sent.RunId))).Status);
    }

    // ================================================================================================ a run stops with its person

    [Fact]
    public async Task A_run_whose_person_is_deactivated_while_it_works_stops_at_the_next_call_and_writes_nothing_more()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var design = await DesignAsync(Role.Designer, DocumentOf(210, 297, "mm", Text("e1", 10, 10, 100, 10, "Vorher")));
        Seam.Script(
            new AiScripted(AiScripted.Say("Ich lese.", false, Call("read_design")).Text, Delay: TimeSpan.FromMilliseconds(600)),
            AiScripted.Say("Ich ändere.", false, Call("update_elements", """{"id": "e1", "set": {"text": "Nachher"}}""")),
            AiScripted.Say("Fertig.", true));
        var sent = await SendAsync(Role.Designer, design, "Ändere den Text");
        await WaitUntilAsync(() => Task.FromResult(Seam.Calls >= 1), "the first call");
        var userId = await UserAsync(Role.Designer);
        await Db(async db =>
        {
            var user = await db.User.FirstAsync(u => u.Id == userId);
            user.IsActive = false;
            await db.SaveChangesAsync();
        });
        var run = await WaitEndAsync(sent.ConversationId);
        Assert.Equal(AiRunStatus.Error, run.Status);
        Assert.Equal(1, Seam.Calls);   // no second call was paid for
        Assert.Equal("Vorher", Elements(await StoredDocAsync(design)).First()["text"]!.ToString());
        var steps = await StepsOfAsync(sent.ConversationId);
        Assert.Contains(steps, s => s.Kind == AiStepKind.Error && s.Text.Contains("nicht weiter"));
        Assert.Equal("error", JsonDocument.Parse(steps.Last().DataJson).RootElement.GetProperty("state").GetString());
        await Db(async db =>
        {
            var user = await db.User.FirstAsync(u => u.Id == userId);
            user.IsActive = true;
            await db.SaveChangesAsync();
        });
    }

    // ================================================================================================ the poll, antiforgery on every POST

    [Fact]
    public async Task The_poll_is_cheap_the_journal_has_an_index_for_it_and_the_steps_do_not_carry_the_history()
    {
        if (!Enabled)
        {
            return;
        }

        var indexes = await Db(db => db.Database.SqlQueryRaw<string>("select indexname as \"Value\" from pg_indexes where tablename in ('AiJournalEntry', 'AiRun', 'AiRunStep', 'AiConversation')").ToListAsync());
        Assert.Contains("IX_AiJournalEntry_EntityType_EntityId", indexes);   // "the newest change of this design", asked once a second by every open editor
        Assert.Contains("IX_AiRun_ConversationId", indexes);
        Assert.Contains("IX_AiRunStep_AiRunId_Number", indexes);

        await ResetAsync();
        var design = await DesignAsync(Role.Designer);
        Seam.Script(AiScripted.Say("Fertig.", true));
        var sent = await SendAsync(Role.Designer, design, "Ein Auftrag");
        await WaitEndAsync(sent.ConversationId);
        // a history of a megabyte does not slow the poll: it is not read (the answer is the same and quick)
        var conversationId = sent.ConversationId;
        await Db(db => db.Database.ExecuteSqlInterpolatedAsync($"UPDATE \"AiConversation\" SET \"HistoryJson\" = ('[{{\"role\":\"user\",\"content\":\"' || repeat('x', 1000000) || '\",\"tool\":false,\"run\":1}}]')::jsonb WHERE \"Id\" = {conversationId}"));
        var watch = System.Diagnostics.Stopwatch.StartNew();
        for (var i = 0; i < 20; i++)
        {
            var page = await As(Role.Designer, biz => AiAgentLogic.StepsAsync(biz, sent.ConversationId, 1_000_000));
            Assert.Empty(page.Steps);
        }

        Assert.True(watch.ElapsedMilliseconds < 5000, $"20 polls took {watch.ElapsedMilliseconds} ms");
    }

    [Fact]
    public async Task Every_post_of_the_AI_needs_the_token_of_the_page()
    {
        if (!Enabled)
        {
            return;
        }

        await using var admins = await RealAdminsAsync();
        var admin = await SignInAsync(admins.Ids[0]);
        var posts = Factory.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()
            .Where(e => e.RoutePattern.RawText is { } raw && raw.StartsWith("/api/ai/", StringComparison.Ordinal)
                && e.Metadata.GetMetadata<Microsoft.AspNetCore.Routing.HttpMethodMetadata>() is { } m && m.HttpMethods.Contains("POST"))
            .Select(e => e.RoutePattern.RawText!).Distinct().ToList();
        Assert.True(posts.Count >= 14, "the POST endpoints of the AI: " + string.Join(", ", posts));
        foreach (var pattern in posts)
        {
            var url = System.Text.RegularExpressions.Regex.Replace(pattern, @"\{(\w+)(:[^}]*)?\}", m => m.Groups[2].Value.Contains("long") ? "1" : "x");
            var response = await admin.PostAsync(url, null);
            Assert.True(response.StatusCode == HttpStatusCode.BadRequest, $"{pattern} without the token: {(int)response.StatusCode}");
        }
    }
}
