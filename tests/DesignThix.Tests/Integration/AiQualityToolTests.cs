using System.Text.Json.Nodes;
using DesignThix.Core.Ai;
using ModelFile = DesignThix.Core.Ai.AiAttachment;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.Services.Ai;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Tests.Integration;

/// <summary>
/// The quality pass of the design assistant (docs/PLAN-AI-DESIGN.md "Quality pass") against a real PostgreSQL: the tools <c>search_templates</c> and <c>search_deko</c>, <c>apply_template</c> with
/// <c>whole</c>, the leftover sample texts, and the review of the loop (it sends the model back when it has not looked at its result or the checks still find real problems, at most twice), the picture of the
/// current page at the start of an edit run and the numbered sheet of templates. The templates of these tests are their own (the built-in ones may be changed by other tests of the run).
/// </summary>
[Collection("app")]
public sealed class AiQualityToolTests(AppTests.AppFactory factory) : AiAgentTestBase(factory)
{
    private static readonly byte[] Png = File.ReadAllBytes(Path.Combine(DesignThix.Tests.Core.RepoFiles.WwwRoot(), "img", "icon-192.png"));

    /// <summary>A template of the test: a design that is marked as template with the metadata of the library.</summary>
    private async Task<long> TemplateAsync(Role owner, string name, string family, string variant, string tags, string format, string occasion, string document)
    {
        var id = await DesignAsync(owner, document, name);
        await Db(async db => await db.Design.Where(d => d.Id == id).ExecuteUpdateAsync(u => u
            .SetProperty(d => d.IsTemplate, true).SetProperty(d => d.TemplateFamily, family).SetProperty(d => d.TemplateFamilyName, family).SetProperty(d => d.TemplateVariant, variant)
            .SetProperty(d => d.TemplateTags, tags).SetProperty(d => d.TemplateFormat, format).SetProperty(d => d.TemplateOccasion, occasion).SetProperty(d => d.Description, "Eine Testvorlage für die Suche der KI.")));
        return id;
    }

    // ------------------------------------------------------------------------------------------------ the searches

    [Fact]
    public async Task Search_templates_ranks_describes_and_says_when_there_is_no_picture()
    {
        if (!Enabled)
        {
            return;
        }

        var word = "Zzyzx" + Guid.NewGuid().ToString("N")[..6];
        var doc = DocumentOf(148, 105, "mm", Text("t1", 10, 10, 100, 20, "Hallo {{Name}}", size: 24, family: "Fredoka"), Text("t2", 10, 50, 100, 10, "Samstag, 12. Juni 2027", size: 12));
        var hit = await TemplateAsync(Role.Designer, $"Einladung {word} Dino", word.ToLowerInvariant() + "-dino", "Dino", $"Einladung, {word}, Dinosaurier, Kinder", "a6-landscape", "Kinder & Familie", doc);
        var other = await TemplateAsync(Role.Designer, $"Flyer {word} Markt", word.ToLowerInvariant() + "-markt", "Markt", "Flyer, Markt", "a5-portrait", "Verein & Schule", doc);
        var design = await DesignAsync(Role.Designer);
        var s = await SessionAsync(Role.Designer, design);

        var found = await ToolAsync(Role.Designer, s, "search_templates", $$"""{"query": "Einladung {{word}} Dinosaurier"}""");
        Assert.True(found.Ok, found.Result!.ToJsonString());
        var list = ((JsonArray)found.Result!["templates"]!).OfType<JsonObject>().ToList();
        Assert.Equal(hit, (long)list[0]["id"]!);
        Assert.Equal(1, (int)list[0]["nr"]!);
        Assert.Equal("gut", (string)list[0]["match"]!);
        Assert.Contains("Fredoka", (string)list[0]["layout"]!);
        Assert.Contains("A6 Querformat", (string)list[0]["format"]!);
        Assert.Contains("Kein Bild verfügbar", (string)found.Result!["bild"]!);   // no editor polled
        Assert.Contains("apply_template", (string)found.Result!["weiter"]!);
        Assert.Empty(s.PicturesForNextCall);

        // narrowed by the format, shown again by id (up to eight), a foreign or unknown id is left out
        var byFormat = await ToolAsync(Role.Designer, s, "search_templates", $$"""{"query": "{{word}}", "format": "a5-portrait"}""");
        Assert.Equal(other, (long)((JsonArray)byFormat.Result!["templates"]!)[0]!["id"]!);
        var byIds = await ToolAsync(Role.Designer, s, "search_templates", $$"""{"ids": [{{other}}, {{hit}}, 999999999, -5]}""");
        Assert.Equal([other, hit], ((JsonArray)byIds.Result!["templates"]!).OfType<JsonObject>().Select(t => (long)t["id"]!));
        Assert.Contains("ids", (string)byIds.Result!["hinweis"]!);

        var none = await ToolAsync(Role.Designer, s, "search_templates", """{"query": "qqzzqq xxyyxx"}""");
        Assert.True(none.Ok);
        Assert.Empty((JsonArray)none.Result!["templates"]!);
        Assert.NotEmpty(none.Warnings);
        foreach (var hostile in new[] { new string('ä', 4000), "'; DROP TABLE \"Design\"; --", "%_\\" })
        {
            Assert.True((await ToolAsync(Role.Designer, s, "search_templates", new JsonObject { ["query"] = hostile, ["occasion"] = hostile, ["format"] = hostile }.ToJsonString())).Ok);
        }

        // a stranger's design cannot be used: the tool needs the design of the session
        var stranger = await SessionAsync(Role.Stranger, design);
        await Assert.ThrowsAsync<NotFoundException>(() => ToolAsync(Role.Stranger, stranger, "search_templates", "{}"));
    }

    [Fact]
    public async Task Search_templates_asks_the_open_editor_for_one_numbered_sheet_and_the_model_gets_it_on_its_next_call()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync(s => s.AgentReview = true);
        var word = "Zzyzx" + Guid.NewGuid().ToString("N")[..6];
        var hit = await TemplateAsync(Role.Designer, $"Einladung {word}", word.ToLowerInvariant(), "Eins", $"Einladung, {word}", "a6-landscape", "Kinder & Familie", DocumentOf(148, 105, "mm", Text("t1", 10, 10, 100, 20, "Hallo", size: 24)));
        var design = await DesignAsync(Role.Designer);
        Seam.Script(
            AiScripted.Say("Ich suche eine Vorlage.", false, Call("search_templates", $$"""{"query": "{{word}}"}""")),
            AiScripted.Say("Gesehen.", true));
        var sent = await SendAsync(Role.Designer, design, "Mach eine Einladung " + word);
        AiAgentLogic.RenderRequestInfo? request = null;
        await WaitUntilAsync(async () =>
        {
            var page = await As(Role.Designer, biz => AiAgentLogic.StepsAsync(biz, sent.ConversationId, 0));
            request = page.RenderRequest;
            if (request is not null)
            {
                Assert.True(await As(Role.Designer, biz => AiAgentLogic.RenderUploadAsync(biz, request.RunId, request.Token, Png)));
                return true;
            }

            return false;
        }, "the request for the sheet");
        await WaitEndAsync(sent.ConversationId);
        Assert.Equal([hit], request!.Templates);
        Assert.Equal("", request.PageId);
        var requests = Seam.Requests.ToList();
        var picture = Assert.Single(requests[1].Messages[^1].Attachments);
        Assert.Equal("Übersicht der Vorlagen", picture.Name);
        Assert.Contains("nummeriert", requests[1].Messages[^1].Content);   // the note that says what the picture is and what to do
        Assert.Contains("apply_template", requests[1].Messages[^1].Content);
    }

    [Fact]
    public async Task Search_deko_finds_illustrations_with_proportions_and_colour_variants()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(Role.Designer);
        var s = await SessionAsync(Role.Designer, design);
        var dino = await ToolAsync(Role.Designer, s, "search_deko", """{"q": "Dinosaurier"}""");
        Assert.True(dino.Ok, dino.Result!.ToJsonString());
        var keys = ((JsonArray)dino.Result!["deko"]!).OfType<JsonObject>().Select(d => (string)d["key"]!).ToList();
        Assert.Contains("deko-motive-dinosaurier", keys);
        var first = ((JsonArray)dino.Result!["deko"]!).OfType<JsonObject>().First();
        Assert.True((double)first["verhaeltnis"]! > 0);
        Assert.Contains("verhaeltnis", (string)dino.Result!["einsetzen"]!);

        var frames = await ToolAsync(Role.Designer, s, "search_deko", """{"q": "Rahmen Doppellinie hoch", "group": "Rahmen", "colour": "gold", "limit": 3}""");
        var frame = ((JsonArray)frames.Result!["deko"]!).OfType<JsonObject>().First();
        Assert.EndsWith("-gold", (string)frame["key"]!);
        Assert.NotNull(frame["farben"]);

        var nothing = await ToolAsync(Role.Designer, s, "search_deko", """{"q": "xyzzyqq"}""");
        Assert.True(nothing.Ok);
        Assert.NotEmpty(nothing.Warnings);
        Assert.NotNull(nothing.Result!["gruppen"]);
        Assert.True((await ToolAsync(Role.Designer, s, "search_deko", new JsonObject { ["q"] = new string('x', 5000), ["group"] = "'; --", ["limit"] = 100000 }.ToJsonString())).Ok);

        // the key of a hit can be placed (built-in images are usable by everybody)
        var placed = await ToolAsync(Role.Designer, s, "add_elements", """{"elements": [{"type": "image", "x": 10, "y": 10, "w": 100, "h": 80, "source": {"asset": "deko-motive-dinosaurier"}}]}""");
        Assert.True(placed.Ok, placed.Result!.ToJsonString());
    }

    // ------------------------------------------------------------------------------------------------ apply_template whole

    private static string ChangeText(string id, string text) => new JsonObject { ["changes"] = new JsonArray(new JsonObject { ["id"] = id, ["set"] = new JsonObject { ["text"] = text } }) }.ToJsonString();

    private const string TemplateDocument = """
        {"schema": 2, "unit": "mm", "width": 148, "height": 105, "dpi": 300, "locale": "de-DE", "fold": "none",
         "fields": [{"key": "Name", "label": "Name", "type": "text", "sample": "Mia"}],
         "pages": [{"id": "p1", "name": "", "background": {"color": "#fbf1cf"}, "elements": [
           {"id": "a1", "type": "shape", "shape": "rect", "name": "Band", "x": 0, "y": 80, "w": 148, "h": 25, "fill": "#2f8f46", "locked": true},
           {"id": "a2", "type": "text", "name": "Titel", "x": 10, "y": 10, "w": 128, "h": 20, "text": "{{Name}} wird 7!", "fontFamily": "Fredoka", "fontSize": 30},
           {"id": "a3", "type": "text", "name": "Zeit", "x": 10, "y": 40, "w": 128, "h": 10, "text": "Samstag, 12. Juni 2027 · 15 Uhr", "fontFamily": "Nunito", "fontSize": 12},
           {"id": "a4", "type": "text", "name": "Gruß", "x": 10, "y": 60, "w": 128, "h": 10, "text": "Komm mit auf Expedition!", "fontFamily": "Nunito", "fontSize": 12},
           {"id": "a5", "type": "text", "name": "Wann", "x": 10, "y": 72, "w": 40, "h": 6, "text": "WANN", "fontFamily": "Nunito", "fontSize": 8}]}]}
        """;

    [Fact]
    public async Task A_whole_template_replaces_the_design_with_its_format_pages_and_fields_and_remembers_its_sample_texts()
    {
        if (!Enabled)
        {
            return;
        }

        var template = await TemplateAsync(Role.Designer, "Ganz Test " + Unique("t"), "ganz-test", "Eins", "Test, Einladung", "a6-landscape", "Kinder & Familie", TemplateDocument);
        var design = await DesignAsync(Role.Designer, DocumentOf(210, 297, "mm", Text("x1", 10, 10, 100, 20, "Das alte Design")));
        var s = await SessionAsync(Role.Designer, design);
        var applied = await ToolAsync(Role.Designer, s, "apply_template", $$"""{"templateId": {{template}}, "whole": true}""");
        Assert.True(applied.Ok, applied.Result!.ToJsonString());
        var doc = await StoredDocAsync(design);
        Assert.Equal(148, AiDocOps.Num(doc["width"]));
        Assert.Equal(105, AiDocOps.Num(doc["height"]));
        Assert.Single(AiDocOps.Pages(doc));
        Assert.Null(AiDocOps.Locate(doc, "x1"));
        Assert.Equal(["Name"], ((JsonArray)doc["fields"]!).OfType<JsonObject>().Select(f => (string)f["key"]!));
        Assert.Equal(AiDocOps.AllIds(doc).Count, AiDocOps.AllElements(doc).Count());
        Assert.All(AiDocOps.AllElements(doc), e => Assert.False(AiDocOps.Flag(e["locked"])));   // the model may move the decoration too
        Assert.Contains(applied.Warnings, w => w.Contains("ersetzt"));

        // the answer is the layout with the ids, so the model can replace the texts at once
        var page = (JsonObject)((JsonArray)applied.Result!["pages"]!)[0]!;
        var texts = ((JsonArray)page["elements"]!).OfType<JsonObject>().Where(e => (string)e["type"]! == "text").ToList();
        Assert.Equal(4, texts.Count);
        Assert.Contains(texts, t => ((string)t["text"]!).Contains("Samstag") && ((string)t["font"]!).Contains("Nunito 12 pt"));
        Assert.Equal("none", (string)((JsonObject)applied.Result!["format"]!)["fold"]!);
        Assert.Contains("Beispieltext", (string)applied.Result!["weiter"]!);

        // only the personal part of the sample is remembered: a date yes, a greeting and a label no
        Assert.Equal(1, s.TemplateTexts.Count(t => t.Value.Contains("Juni")));
        Assert.DoesNotContain(s.TemplateTexts.Values, t => t.StartsWith("Komm", StringComparison.Ordinal) || t == "WANN");
        var left = await As(Role.Designer, biz => AiAgentLogic.ReviewFindingsAsync(biz, s));
        Assert.Contains(left, f => f.Contains("Beispieltext") && f.Contains("12. Juni"));

        // after the text is replaced the finding is gone; the person's own words make the same text no leftover
        var zeit = AiDocOps.AllElements(doc).First(e => AiDocOps.Str(e["name"]) == "Zeit");
        var changed = await ToolAsync(Role.Designer, s, "update_elements", ChangeText(AiDocOps.Id(zeit), "Sonntag, 13. Juni 2027 · 14 Uhr"));
        Assert.True(changed.Ok, changed.Result!.ToJsonString());
        Assert.DoesNotContain(await As(Role.Designer, biz => AiAgentLogic.ReviewFindingsAsync(biz, s)), f => f.Contains("Beispieltext"));
        s.RequestText = "Einladung für Samstag, 12. Juni 2027, 15 Uhr";
        var again = await ToolAsync(Role.Designer, s, "update_elements", ChangeText(AiDocOps.Id(zeit), "Samstag, 12. Juni 2027 · 15 Uhr"));
        Assert.True(again.Ok);
        Assert.DoesNotContain(await As(Role.Designer, biz => AiAgentLogic.ReviewFindingsAsync(biz, s)), f => f.Contains("Beispieltext"));
    }

    [Fact]
    public async Task A_whole_template_is_refused_for_locked_elements_and_a_locked_scope_and_is_one_undo_step()
    {
        if (!Enabled)
        {
            return;
        }

        var template = await TemplateAsync(Role.Designer, "Ganz Test " + Unique("t"), "ganz-test-2", "Eins", "Test", "a6-landscape", "Kinder & Familie", TemplateDocument);
        var locked = await DesignAsync(Role.Designer, DocumentOf(100, 100, "mm", Obj("""{"id": "k1", "type": "text", "x": 5, "y": 5, "w": 80, "h": 10, "text": "Gesperrt", "locked": true}""")));
        var s = await SessionAsync(Role.Designer, locked);
        var refused = await ToolAsync(Role.Designer, s, "apply_template", $$"""{"templateId": {{template}}, "whole": true}""");
        Assert.False(refused.Ok);
        Assert.Contains("gesperrt", refused.Result!.ToJsonString());
        Assert.Equal(100, AiDocOps.Num((await StoredDocAsync(locked))["width"]));

        var design = await DesignAsync(Role.Designer, DocumentOf(100, 100, "mm", Text("x1", 10, 10, 50, 10, "alt")));
        var scoped = await SessionAsync(Role.Designer, design, new AiScope("page", "p1", [], true));
        var outside = await ToolAsync(Role.Designer, scoped, "apply_template", $$"""{"templateId": {{template}}, "whole": true}""");
        Assert.False(outside.Ok);
        Assert.Contains("Bereich", outside.Result!.ToJsonString());

        var free = await SessionAsync(Role.Designer, design);
        Assert.True((await ToolAsync(Role.Designer, free, "apply_template", $$"""{"templateId": {{template}}, "whole": true}""")).Ok);
        var entry = await Db(db => db.AiJournalEntry.AsNoTracking().FirstAsync(j => j.AiRunId == free.RunId));
        Assert.Contains("alt", entry.OldValue);   // the run can be taken back: the old document is in the journal
        Assert.DoesNotContain("alt", entry.NewValue);
    }

    // ------------------------------------------------------------------------------------------------ the review in the loop

    /// <summary>The editor of the person: polls like the browser, answers every request for a picture, and returns the requests it answered. Ends when the run is over.</summary>
    private async Task<List<AiAgentLogic.RenderRequestInfo>> EditorUntilEndAsync(Role who, long conversationId, int seconds = 20)
    {
        var answered = new List<AiAgentLogic.RenderRequestInfo>();
        var deadline = DateTime.UtcNow.AddSeconds(seconds);
        while (DateTime.UtcNow < deadline)
        {
            var page = await As(who, biz => AiAgentLogic.StepsAsync(biz, conversationId, 0));
            if (page.RenderRequest is { } request && answered.All(r => r.Token != request.Token))
            {
                Assert.True(await As(who, biz => AiAgentLogic.RenderUploadAsync(biz, request.RunId, request.Token, Png)));
                answered.Add(request);
            }

            if (page.Status == "Idle")
            {
                break;
            }

            await Task.Delay(20);
        }

        return answered;
    }

    /// <summary>A page that is full enough for the lint to be quiet: five lines of text in the lower three quarters, the top left free for a title.</summary>
    private static string FilledPage(string? extra = null) => DocumentOf(210, 297, "mm",
        Text("f1", 20, 80, 170, 20, "Samstag, 12. Juni 2027", size: 28), Text("f2", 20, 115, 170, 16, "Ab 15 Uhr im Vereinsheim", size: 20), Text("f3", 20, 150, 170, 14, "Kaffee, Kuchen und Musik", size: 18),
        Text("f4", 20, 185, 170, 14, "Für Groß und Klein", size: 18), Text("f5", 20, 225, 170, 12, "Rückmeldung unter 07131 123456", size: 14), Text("f6", 20, 262, 170, 10, "Der Verein freut sich auf euch", size: 14),
        Rect("f7", 150, 80, 40, 150, "#e8f1ff"), extra is null ? Rect("f8", 0, 0, 1, 1, "#ffffff") : Obj(extra));

    private const string Title = """{"elements": [{"type": "text", "x": 20, "y": 20, "w": 170, "h": 30, "text": "Sommerfest", "fontSize": 40, "name": "Titel"}]}""";

    [Fact]
    public async Task A_model_that_is_done_without_having_looked_is_sent_back_once_to_look()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync(s => s.AgentReview = true);
        var design = await DesignAsync(Role.Designer, FilledPage());
        Seam.Script(
            AiScripted.Say("Ich lege den Titel an.", false, Call("add_elements", Title)),
            AiScripted.Say("Fertig.", true),
            AiScripted.Say("Dann sehe ich es mir an.", false, Call("look")),
            AiScripted.Say("Gut so, fertig.", true));
        var sent = await SendAsync(Role.Designer, design, "Mach einen Titel");
        var editor = await EditorUntilEndAsync(Role.Designer, sent.ConversationId);
        var run = await WaitEndAsync(sent.ConversationId);
        Assert.Equal(AiRunStatus.Done, run.Status);
        Assert.Equal(2, editor.Count);   // the picture of the page at the start (the design has content) and the one look
        var requests = Seam.Requests.ToList();
        Assert.Equal(4, requests.Count);
        var review = requests[2].Messages[^1].Content;
        Assert.StartsWith("Prüfung vor dem Abschluss (1/2)", review);
        Assert.Contains("look", review);
        var steps = await StepsOfAsync(sent.ConversationId);
        Assert.Contains(steps, s => s.Kind == AiStepKind.Info && s.Text.StartsWith("Prüfung vor dem Abschluss", StringComparison.Ordinal));
        // the picture that look made rides on the call after it, with the checklist as the note
        Assert.Single(requests[3].Messages[^1].Attachments);
        Assert.Contains("PRÜFLISTE", requests[3].Messages[^1].Content);
    }

    [Fact]
    public async Task The_review_can_be_switched_off_and_does_not_ask_for_a_look_when_no_editor_is_open()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();   // the review is off in the settings of a test
        var design = await DesignAsync(Role.Designer, FilledPage());
        Seam.Script(AiScripted.Say("Ich lege den Titel an.", false, Call("add_elements", Title)), AiScripted.Say("Fertig.", true));
        var sent = await SendAsync(Role.Designer, design, "Mach einen Titel");
        var editor = EditorUntilEndAsync(Role.Designer, sent.ConversationId);
        await WaitEndAsync(sent.ConversationId);
        await editor;
        Assert.Equal(2, Seam.Requests.Count);

        // on: but nobody is looking at the editor, so there is nothing to look with; the lint finds nothing: the run ends at once
        await ResetAsync(s => s.AgentReview = true);
        var design2 = await DesignAsync(Role.Designer, FilledPage());
        Seam.Script(AiScripted.Say("Ich lege den Titel an.", false, Call("add_elements", Title)), AiScripted.Say("Fertig.", true));
        var sent2 = await SendAsync(Role.Designer, design2, "Mach einen Titel");
        await WaitEndAsync(sent2.ConversationId);
        Assert.True(Seam.Requests.Count == 2, string.Join("\n---\n", Seam.Requests.Skip(2).Select(r => r.Messages[^1].Content)));
    }

    [Fact]
    public async Task The_review_hands_back_what_the_checks_find_but_at_most_twice_and_not_what_was_there_before()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync(s => s.AgentReview = true);
        const string dummy = """{"elements": [{"type": "text", "x": 20, "y": 20, "w": 170, "h": 30, "text": "Musterstadt 12", "fontSize": 30, "name": "Ort"}]}""";
        var design = await DesignAsync(Role.Designer, FilledPage());
        Seam.Script(
            AiScripted.Say("Ich lege den Ort an.", false, Call("add_elements", dummy)),
            AiScripted.Say("Fertig.", true),
            AiScripted.Say("Ist ein Fehlalarm, fertig.", true),
            AiScripted.Say("Immer noch fertig.", true));
        var sent = await SendAsync(Role.Designer, design, "Schreib den Ort");
        var run = await WaitEndAsync(sent.ConversationId);
        Assert.Equal(AiRunStatus.Done, run.Status);
        var requests = Seam.Requests.ToList();
        Assert.Equal(4, requests.Count);   // the first call, and two rounds of review: then it ends
        Assert.Contains("Musterstadt", requests[2].Messages[^1].Content);
        Assert.StartsWith("Prüfung vor dem Abschluss (2/2)", requests[3].Messages[^1].Content);
        Assert.Equal(2, (await StepsOfAsync(sent.ConversationId)).Count(s => s.Kind == AiStepKind.Info && s.Text.StartsWith("Prüfung vor dem Abschluss", StringComparison.Ordinal)));

        // a problem that was in the design before the run is not held against the model
        await ResetAsync(s => s.AgentReview = true);
        var before = await DesignAsync(Role.Designer, FilledPage("{\"id\": \"m1\", \"type\": \"text\", \"name\": \"Ort\", \"x\": 20, \"y\": 50, \"w\": 170, \"h\": 25, \"text\": \"Musterstadt 99\", \"fontSize\": 30, \"fontFamily\": \"Open Sans\"}"));
        Seam.Script(AiScripted.Say("Ich lege einen Titel an.", false, Call("add_elements", Title)), AiScripted.Say("Fertig.", true));
        var sent2 = await SendAsync(Role.Designer, before, "Mach einen Titel");
        await WaitEndAsync(sent2.ConversationId);
        Assert.Equal(2, Seam.Requests.Count);
    }

    [Fact]
    public async Task An_edit_run_starts_with_the_picture_of_the_page_as_it_is()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync(s => s.AgentReview = true);
        var design = await DesignAsync(Role.Designer, DocumentOf(210, 297, "mm", Text("e1", 20, 20, 170, 30, "Sommerfest", size: 40)));
        Seam.Script(AiScripted.Say("Gesehen, nichts zu tun.", true));
        var sent = await SendAsync(Role.Designer, design, "Mach den Titel größer");
        var editor = await EditorUntilEndAsync(Role.Designer, sent.ConversationId);
        await WaitEndAsync(sent.ConversationId);
        Assert.Single(editor);
        var first = Seam.Requests.ToList()[0];
        var picture = Assert.Single(first.Messages[^1].Attachments);
        Assert.StartsWith("Aktueller Stand", picture.Name);
        Assert.Contains("bevor du etwas änderst", first.Messages[^1].Content);
        var action = (await StepsOfAsync(sent.ConversationId)).First(s => s.Kind == AiStepKind.Action);
        Assert.StartsWith("Seite 1 angesehen", action.Text);

        // an empty design has nothing to show, and a run with no editor goes on without
        await ResetAsync(s => s.AgentReview = true);
        var empty = await DesignAsync(Role.Designer);
        Seam.Script(AiScripted.Say("Fertig.", true));
        var sent2 = await SendAsync(Role.Designer, empty, "Mach etwas");
        await WaitEndAsync(sent2.ConversationId);
        Assert.All(Seam.Requests.ToList()[0].Messages, m => Assert.Empty(m.Attachments));
    }

    [Fact]
    public void The_picture_notes_say_what_a_picture_is_for()
    {
        List<ModelFile> One(string name) => [new() { Kind = "image", MediaType = "image/png", Name = name, Data = "AAAA" }];
        Assert.Contains("nummeriert", AiAgentLoop.PictureNote(One("Übersicht der Vorlagen")));
        Assert.Contains("bevor du etwas änderst", AiAgentLoop.PictureNote(One("Aktueller Stand: Seite 1")));
        Assert.Contains("PRÜFLISTE", AiAgentLoop.PictureNote(One("Seite 1 (Revision 3)")));
        var messages = AiAgentLoop.Messages("S", [new HistoryMessage("user", "Hallo", false, 1)], 1, 0, [], One("Seite 1 (Revision 3)"));
        Assert.Contains("PRÜFLISTE", messages[^1].Content);
        Assert.Single(messages[^1].Attachments);
    }

    [Fact]
    public void The_instruction_has_the_workflow_the_playbook_the_fonts_and_the_checklist()
    {
        var text = AiInstructions.Fixed(AiAction.DesignAgent);
        foreach (var part in new[] { "ARBEITSWEISE", "search_templates", "whole: true", "INHALT JE ART", "GESTALTUNGSREGELN", "SCHRIFTEN", "PRÜFLISTE", "search_deko", "Great Vibes", "Cormorant Garamond", "[Datum]" })
        {
            Assert.Contains(part, text);
        }

        Assert.Contains(AiDesignTools.Catalog, c => c.Name == "search_templates" && !c.Writes);
        Assert.Contains(AiDesignTools.Catalog, c => c.Name == "search_deko" && !c.Writes);
        Assert.InRange(text.Length, 20_000, 70_000);
    }
}
