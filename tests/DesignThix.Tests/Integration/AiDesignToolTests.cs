using System.Text.Json.Nodes;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Tests.Integration;

/// <summary>
/// The tools of the design assistant (docs/PLAN-AI-DESIGN.md 3.3) against a real PostgreSQL: every tool with good arguments and with hostile ones (ids of another design, ids out of the scope, unknown fonts,
/// icons and keys, an invalid schema, 501 elements, an SVG with a script), the lint, the scope lock, the journal and the one history entry of a run. A refusal never writes anything.
/// </summary>
[Collection("app")]
public sealed class AiDesignToolTests(AppTests.AppFactory factory) : AiAgentTestBase(factory)
{
    // ------------------------------------------------------------------------------------------------ reading

    [Fact]
    public async Task Reading_the_design_gives_format_fields_pages_and_a_compact_tree()
    {
        if (!Enabled)
        {
            return;
        }

        var doc = DocumentOf(210, 297, "mm", Text("e1", 10, 10, 100, 20, new string('x', 300), size: 24), Rect("e2", 0, 0, 210, 40, "#112233"));
        var design = await DesignAsync(Role.Designer, doc);
        var s = await SessionAsync(Role.Designer, design);
        var read = await ToolAsync(Role.Designer, s, "read_design");
        Assert.True(read.Ok);
        var result = (JsonObject)read.Result!;
        Assert.Equal(210, (double)result["format"]!["width"]!);
        Assert.Equal("mm", (string)result["format"]!["unit"]!);
        var page = (JsonObject)result["pages"]![0]!;
        Assert.Equal("p1", (string)page["id"]!);
        Assert.Equal(2, (int)page["elementCount"]!);
        var text = (JsonObject)page["elements"]![0]!;
        Assert.Equal("e1", (string)text["id"]!);
        Assert.Equal(201, ((string)text["text"]!).Length);   // 200 characters and the ellipsis
        Assert.Equal(24, (double)text["fontSize"]!);
        Assert.Equal("#112233", (string)page["elements"]![1]!["fill"]!);
        Assert.Contains("gelesen", read.Summary);
        Assert.False(read.Changed);

        var one = await ToolAsync(Role.Designer, s, "read_design", """{"page": 1}""");
        Assert.True(one.Ok);
        Assert.Equal("p1", one.PageId);
        var wrong = await ToolAsync(Role.Designer, s, "read_design", """{"page": "p9"}""");
        Assert.False(wrong.Ok);
        Assert.Contains("p1", (string)wrong.Result!["error"]!);
    }

    [Fact]
    public async Task A_page_that_is_too_big_for_the_answer_is_only_counted_and_the_model_is_told_how_to_read_it()
    {
        if (!Enabled)
        {
            return;
        }

        var many = Enumerable.Range(1, 450).Select(i => (object)Text("t" + i, 1, 1, 50, 5, "Zeile " + i + " " + new string('y', 150))).ToArray();
        var design = await DesignAsync(Role.Designer, DocumentOf(1000, 1000, "mm", many));
        var s = await SessionAsync(Role.Designer, design);
        var read = await ToolAsync(Role.Designer, s, "read_design");
        Assert.True(read.Ok);
        var page = (JsonObject)read.Result!["pages"]![0]!;
        Assert.Equal(450, (int)page["elementCount"]!);
        Assert.Empty((JsonArray)page["elements"]!);
        Assert.Contains("read_design", (string)page["note"]!);
    }

    [Fact]
    public async Task The_ids_of_another_design_do_not_exist_for_the_tools()
    {
        if (!Enabled)
        {
            return;
        }

        var mine = await DesignAsync(Role.Designer, DocumentOf(100, 100, "mm", Text("e1", 1, 1, 50, 10, "mein")));
        var other = await DesignAsync(Role.Designer, DocumentOf(100, 100, "mm", Text("e1", 1, 1, 50, 10, "fremd"), Text("e77", 1, 20, 50, 10, "geheim")));
        var s = await SessionAsync(Role.Designer, mine);
        var read = await ToolAsync(Role.Designer, s, "read_elements", """{"ids": ["e77"]}""");
        Assert.False(read.Ok);
        var update = await ToolAsync(Role.Designer, s, "update_elements", """{"changes": [{"id": "e77", "set": {"text": "gehackt"}}]}""");
        Assert.False(update.Ok);
        var delete = await ToolAsync(Role.Designer, s, "delete_elements", """{"ids": ["e77"]}""");
        Assert.False(delete.Ok);
        Assert.Equal("fremd", (string)ElementOf(await StoredDocAsync(other), "e1")["text"]!);
        Assert.Equal("geheim", (string)ElementOf(await StoredDocAsync(other), "e77")["text"]!);
        // an element id given with the page of another design changes nothing there either
        var read2 = await ToolAsync(Role.Designer, s, "read_elements", """{"ids": ["e1", "e77"]}""");
        Assert.True(read2.Ok);
        Assert.Single((JsonArray)read2.Result!["elements"]!);
        Assert.Equal("mein", (string)read2.Result!["elements"]![0]!["text"]!);
        Assert.NotEmpty(read2.Warnings);
    }

    [Fact]
    public async Task The_other_reading_tools_answer_what_the_model_may_use()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(Role.Designer);
        var s = await SessionAsync(Role.Designer, design);

        var fonts = await ToolAsync(Role.Designer, s, "list_fonts");
        Assert.True(fonts.Ok);
        Assert.Contains(((JsonArray)fonts.Result!["families"]!).OfType<JsonObject>(), f => (string)f["family"]! == "Open Sans");
        Assert.Contains("sans-serif", ((JsonArray)fonts.Result!["generic"]!).Select(g => (string)g!));

        var media = await ToolAsync(Role.Designer, s, "list_media", """{"q": "deutschland"}""");
        Assert.True(media.Ok);
        Assert.Contains(((JsonArray)media.Result!["media"]!).OfType<JsonObject>(), m => (string)m["key"]! == "flag-de");
        var none = await ToolAsync(Role.Designer, s, "list_media", """{"q": "gibt-es-garantiert-nicht-xyz"}""");
        Assert.True(none.Ok);
        Assert.NotEmpty(none.Warnings);

        var icons = await ToolAsync(Role.Designer, s, "search_icons", """{"q": "käse", "limit": 3}""");
        Assert.Equal(3, ((JsonArray)icons.Result!["icons"]!).Count);
        Assert.Contains("pizza", ((JsonArray)icons.Result!["icons"]!).Select(i => (string)i!));
        var noIcon = await ToolAsync(Role.Designer, s, "search_icons", """{"q": "zzzzqq"}""");
        Assert.True(noIcon.Ok);
        Assert.NotEmpty(noIcon.Warnings);

        var brand = await ToolAsync(Role.Designer, s, "read_brand");
        Assert.True(brand.Ok);
        Assert.NotNull(brand.Result!["colors"]);

        var templates = await ToolAsync(Role.Designer, s, "list_templates");
        Assert.True(templates.Ok);
        Assert.NotEmpty((JsonArray)templates.Result!["templates"]!);
        Assert.NotNull(templates.Result!["templates"]![0]!["size"]);

        var formats = await ToolAsync(Role.Designer, s, "list_formats");
        Assert.Contains(((JsonArray)formats.Result!["formats"]!).OfType<JsonObject>(), f => (string)f["preset"]! == "business-card");

        var list = await ToolAsync(Role.Designer, s, "read_datalist");
        Assert.False(list.Ok);   // nothing was attached
        var unknown = await ToolAsync(Role.Designer, s, "gibt_es_nicht");
        Assert.False(unknown.Ok);
        Assert.Contains("read_design", (string)unknown.Result!["error"]!);
    }

    [Fact]
    public async Task A_data_list_is_read_only_when_the_person_attached_it_and_may_see_it_and_it_holds_no_personal_data()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var design = await DesignAsync(Role.Designer);
        var plain = await As(Role.Designer, async biz =>
        {
            var list = await DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput(Unique("Liste "), null, false));
            await DataListLogic.SaveColumnsAsync(biz, list.Id, [new("Name", "Name", "text", null, null), new("Preis", "Preis", "price", 2, null)]);
            var revision = (await DataListLogic.GridAsync(biz, list.Id)).Revision;
            await DataListLogic.SaveRowsAsync(biz, list.Id, revision, Enumerable.Range(1, 30).Select(i => new GridRow(null, new Dictionary<string, string> { ["Name"] = "Käse " + i, ["Preis"] = "2" }, 1, true)).ToList());
            return list.Id;
        });
        var personal = await As(Role.Designer, async biz => (await DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput(Unique("Kunden "), null, true))).Id);
        var secret = await As(Role.Stranger, async biz => (await DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput(Unique("Fremd "), null, false))).Id);

        var s = await SessionAsync(Role.Designer, design);
        s.ReferencedLists.Add(plain);
        var read = await ToolAsync(Role.Designer, s, "read_datalist");
        Assert.True(read.Ok);
        Assert.Equal(30, (int)read.Result!["rowCount"]!);
        Assert.Equal(20, ((JsonArray)read.Result!["rows"]!).Count);
        Assert.Equal("Name", (string)read.Result!["columns"]![0]!["key"]!);

        // a list nobody attached is not read, whatever its id
        var notAttached = await ToolAsync(Role.Designer, s, "read_datalist", $$"""{"id": {{secret}}}""");
        Assert.False(notAttached.Ok);
        // one that is attached but belongs to somebody else: 404 for the tool (the run would end)
        s.ReferencedLists.Add(secret);
        await Assert.ThrowsAsync<NotFoundException>(() => ToolAsync(Role.Designer, s, "read_datalist", $$"""{"id": {{secret}}}"""));
        // personal data: refused unless the administrator allowed it
        s.ReferencedLists.Add(personal);
        var refused = await ToolAsync(Role.Designer, s, "read_datalist", $$"""{"id": {{personal}}}""");
        Assert.False(refused.Ok);
        Assert.Contains("personenbezogene", (string)refused.Result!["error"]!);
        await ResetAsync(x => x.SendPersonalData = true);
        var allowed = await ToolAsync(Role.Designer, s, "read_datalist", $$"""{"id": {{personal}}}""");
        Assert.True(allowed.Ok);
        await ResetAsync();
    }

    // ------------------------------------------------------------------------------------------------ add_elements

    [Fact]
    public async Task Elements_are_added_with_server_ids_the_summary_and_one_journal_entry()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(Role.Designer);
        var s = await SessionAsync(Role.Designer, design);
        var revision = await RevisionAsync(design);
        var added = await ToolAsync(Role.Designer, s, "add_elements", """
            {"elements": [
              {"type": "text", "x": 20, "y": 20, "w": 170, "h": 30, "text": "Sommerfest", "fontSize": 40, "fontWeight": 700, "color": "#1fb3d6", "name": "Titel"},
              {"type": "shape", "shape": "rect", "x": 20, "y": 60, "w": 170, "h": 4, "fill": "#ff8800"},
              {"type": "icon", "icon": "star", "x": 20, "y": 80, "w": 20, "h": 20, "color": "#ff8800"}
            ]}
            """);
        Assert.True(added.Ok, added.Result!.ToJsonString());
        Assert.True(added.Changed);
        Assert.Equal(revision + 1, added.Revision);
        Assert.Equal("3 Elemente hinzugefügt – Seite 1", added.Summary);
        var ids = ((JsonArray)added.Result!["added"]!).Select(a => (string)a!["id"]!).ToList();
        Assert.Equal(3, ids.Distinct().Count());
        Assert.Equal(ids, added.ElementIds);
        var doc = await StoredDocAsync(design);
        Assert.Equal("Sommerfest", (string)ElementOf(doc, ids[0])["text"]!);
        Assert.Equal("Titel", (string)ElementOf(doc, ids[0])["name"]!);
        Assert.Equal("star", (string)ElementOf(doc, ids[2])["icon"]!);
        // the font family the model did not name is the default of the library, not "sans-serif"
        Assert.NotEqual("sans-serif", (string)ElementOf(doc, ids[0])["fontFamily"]!);

        // a single element reads as a sentence
        var one = await ToolAsync(Role.Designer, s, "add_elements", """{"elements": [{"type": "qr", "x": 150, "y": 220, "w": 40, "h": 40, "value": "https://example.org"}]}""");
        Assert.Contains("QR-Code", one.Summary);

        // the journal: ONE entry with the document before the first write and the end state after the last
        var journal = await Db(db => db.AiJournalEntry.AsNoTracking().Where(j => j.AiRunId == s.RunId).ToListAsync());
        var entry = Assert.Single(journal);
        Assert.Equal("Dokument", entry.Field);
        Assert.Equal(design, entry.EntityId);
        Assert.Empty(AiDocOps.Walk(AiDocOps.Elements((JsonObject)AiDocOps.Pages(Obj(entry.OldValue!))[0]!)));
        Assert.Equal(4, AiDocOps.Walk(AiDocOps.Elements((JsonObject)AiDocOps.Pages(Obj(entry.NewValue!))[0]!)).Count());
        var run = await Db(db => db.AiRun.AsNoTracking().FirstAsync(r => r.Id == s.RunId));
        var info = Obj(run.ResultJson);
        Assert.Equal(revision, (int)info["revisionBefore"]!);
        Assert.Equal(revision + 2, (int)info["revisionAfter"]!);

        // and ONE history entry for the whole run
        var history = await Db(db => db.DesignRevision.AsNoTracking().Where(r => r.DesignId == design).OrderBy(r => r.Revision).ToListAsync());
        var mine = history.Where(h => h.Note == "KI: Testgespräch").ToList();
        Assert.Single(mine);
        Assert.Equal(revision + 2, mine[0].Revision);
    }

    [Fact]
    public async Task A_save_of_the_person_in_between_starts_a_new_history_entry_and_is_never_overwritten()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(Role.Designer);
        var s = await SessionAsync(Role.Designer, design);
        await ToolAsync(Role.Designer, s, "add_elements", """{"elements": [{"type": "text", "x": 10, "y": 10, "w": 100, "h": 10, "text": "KI eins"}]}""");
        // the person works in the editor meanwhile
        await As(Role.Designer, async biz =>
        {
            var current = await DesignLogic.LoadAsync(biz, design);
            var doc = Obj(current!.DocumentJson);
            AiDocOps.Elements((JsonObject)AiDocOps.Pages(doc)[0]!).Add(Text("mine1", 10, 100, 100, 10, "von Hand"));
            await DesignLogic.SaveDocumentAsync(biz, design, current.Revision, doc.ToJsonString(), true);
        });
        await ToolAsync(Role.Designer, s, "add_elements", """{"elements": [{"type": "text", "x": 10, "y": 200, "w": 100, "h": 10, "text": "KI zwei"}]}""");
        var doc2 = await StoredDocAsync(design);
        Assert.Equal(["KI eins", "von Hand", "KI zwei"], Elements(doc2).Select(e => (string)e["text"]!));
        var history = await Db(db => db.DesignRevision.AsNoTracking().Where(r => r.DesignId == design).ToListAsync());
        Assert.Equal(2, history.Count(h => h.Note == "KI: Testgespräch"));
    }

    [Fact]
    public async Task Hostile_and_wrong_elements_are_refused_with_a_reason_and_nothing_is_written()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(Role.Designer, DocumentOf(210, 297, "mm", Text("e1", 10, 10, 100, 10, "bleibt")));
        var s = await SessionAsync(Role.Designer, design);
        var revision = await RevisionAsync(design);

        async Task Refused(string args, string expect)
        {
            var outcome = await ToolAsync(Role.Designer, s, "add_elements", args);
            Assert.False(outcome.Ok, args);
            Assert.True(((string)outcome.Result!["error"]!).Contains(expect, StringComparison.Ordinal), $"{args} -> {outcome.Result!["error"]}");
            Assert.Equal(revision, await RevisionAsync(design));
        }

        await Refused("{}", "elements");
        await Refused("""{"elements": []}""", "elements");
        await Refused("""{"elements": [{"type": "raumschiff", "x": 1, "y": 1, "w": 1, "h": 1}]}""", "raumschiff");
        await Refused("""{"elements": [{"x": 1, "y": 1, "w": 1, "h": 1}]}""", "type");
        await Refused("""{"elements": [{"type": "text", "w": 10, "h": 10}]}""", "x und y");
        await Refused("""{"elements": [{"type": "shape", "x": 1, "y": 1, "h": 5}]}""", "w fehlt");
        await Refused("""{"elements": ["text"]}""", "Objekt");
        await Refused("""{"elements": [{"type": "icon", "icon": "gibt-es-nicht-xyz", "x": 1, "y": 1, "w": 10, "h": 10}]}""", "Symbol");
        await Refused("""{"elements": [{"type": "icon", "x": 1, "y": 1, "w": 10, "h": 10}]}""", "icon fehlt");
        await Refused("""{"elements": [{"type": "image", "x": 1, "y": 1, "w": 10, "h": 10, "source": {"asset": "gibt-es-nicht-xyz"}}]}""", "list_media");
        await Refused("""{"elements": [{"type": "group", "x": 1, "y": 1, "w": 10, "h": 10}]}""", "children");
        await Refused("""{"page": "p77", "elements": [{"type": "text", "x": 1, "y": 1, "w": 10, "h": 10}]}""", "p77");
        await Refused("""{"after": "e999", "elements": [{"type": "text", "x": 1, "y": 1, "w": 10, "h": 10}]}""", "e999");
        await Refused("""{"group": "e1", "elements": [{"type": "text", "x": 1, "y": 1, "w": 10, "h": 10}]}""", "Gruppe");
        var tooDeep = """{"type": "group", "children": [{"type": "group", "children": [{"type": "group", "children": [{"type": "group", "children": [{"type": "shape", "x": 1, "y": 1, "w": 5, "h": 5}]}]}]}]}""";
        await Refused($$"""{"elements": [{{tooDeep}}]}""", "tief");
        var many = string.Join(",", Enumerable.Range(0, 201).Select(_ => """{"type": "shape", "x": 1, "y": 1, "w": 5, "h": 5}"""));
        await Refused($$"""{"elements": [{{many}}]}""", "höchstens 200");
        Assert.Single(Elements(await StoredDocAsync(design)));
    }

    [Fact]
    public async Task More_than_500_elements_on_a_page_are_refused_before_anything_is_written()
    {
        if (!Enabled)
        {
            return;
        }

        var filler = Enumerable.Range(1, 400).Select(i => (object)Rect("r" + i, 1, 1, 5, 5, "#000000")).ToArray();
        var design = await DesignAsync(Role.Designer, DocumentOf(210, 297, "mm", filler));
        var s = await SessionAsync(Role.Designer, design);
        var revision = await RevisionAsync(design);
        var hundred = string.Join(",", Enumerable.Range(0, 100).Select(_ => """{"type": "shape", "x": 1, "y": 1, "w": 5, "h": 5}"""));
        var fits = await ToolAsync(Role.Designer, s, "add_elements", $$"""{"elements": [{{hundred}}]}""");
        Assert.True(fits.Ok);   // exactly 500
        var more = await ToolAsync(Role.Designer, s, "add_elements", """{"elements": [{"type": "shape", "x": 1, "y": 1, "w": 5, "h": 5}]}""");
        Assert.False(more.Ok);
        Assert.Contains("500", (string)more.Result!["error"]!);
        Assert.Equal(revision + 1, await RevisionAsync(design));
        Assert.Equal(500, Elements(await StoredDocAsync(design)).Count());
    }

    [Fact]
    public async Task Wrong_properties_are_dropped_with_a_warning_numbers_clamped_and_unknown_fonts_replaced()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(Role.Designer);
        var s = await SessionAsync(Role.Designer, design);
        var outcome = await ToolAsync(Role.Designer, s, "add_elements", """
            {"elements": [{"type": "text", "x": 10, "y": 10, "w": 150, "h": 20, "text": "Hallo", "fontFamily": "Comic Sans Fantasy", "fontSize": 5000, "color": "rot",
              "align": "diagonal", "zauber": true, "width": 120, "opacity": "0.5", "bold": true}]}
            """);
        Assert.True(outcome.Ok, outcome.Result!.ToJsonString());
        var joined = string.Join(" | ", outcome.Warnings);
        Assert.Contains("Comic Sans Fantasy", joined);
        Assert.Contains("list_fonts", joined);
        Assert.Contains("fontSize", joined);
        Assert.Contains("keine Farbe", joined);
        Assert.Contains("align", joined);
        Assert.Contains("zauber", joined);
        Assert.Contains("bold", joined);
        var e = ElementOf(await StoredDocAsync(design), (string)outcome.Result!["added"]![0]!["id"]!);
        Assert.Equal(1000, (double)e["fontSize"]!);
        Assert.Equal("#000000", (string)e["color"]!);
        Assert.Equal("left", (string)e["align"]!);
        Assert.Equal(120, (double)e["w"]!);   // "width" is an alias of w
        Assert.Equal(0.5, (double)e["opacity"]!);   // a number as text is read
        Assert.NotEqual("Comic Sans Fantasy", (string)e["fontFamily"]!);
    }

    [Fact]
    public async Task A_group_can_be_built_and_things_can_be_inserted_at_a_place_or_into_a_group()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(Role.Designer, DocumentOf(210, 297, "mm", Text("a", 10, 10, 50, 10, "a"), Text("b", 10, 30, 50, 10, "b"), Text("c", 10, 50, 50, 10, "c")));
        var s = await SessionAsync(Role.Designer, design);
        var inserted = await ToolAsync(Role.Designer, s, "add_elements", """{"after": "a", "elements": [{"type": "text", "x": 10, "y": 20, "w": 50, "h": 10, "text": "nach a"}]}""");
        Assert.True(inserted.Ok);
        var start = await ToolAsync(Role.Designer, s, "add_elements", """{"after": "start", "elements": [{"type": "text", "x": 10, "y": 1, "w": 50, "h": 5, "text": "ganz unten"}]}""");
        Assert.True(start.Ok);
        Assert.Equal(["ganz unten", "a", "nach a", "b", "c"], Elements(await StoredDocAsync(design)).Select(e => (string)e["text"]!));

        var grouped = await ToolAsync(Role.Designer, s, "add_elements", """
            {"elements": [{"type": "group", "name": "Karte", "children": [
               {"type": "shape", "shape": "rect", "x": 100, "y": 100, "w": 50, "h": 30, "fill": "#eeeeee"},
               {"type": "text", "x": 105, "y": 105, "w": 40, "h": 10, "text": "in der Gruppe"}]}]}
            """);
        Assert.True(grouped.Ok, grouped.Result!.ToJsonString());
        var groupId = (string)grouped.Result!["added"]![0]!["id"]!;
        var group = ElementOf(await StoredDocAsync(design), groupId);
        Assert.Equal(100, (double)group["x"]!);
        Assert.Equal(50, (double)group["w"]!);
        Assert.Equal(2, ((JsonArray)group["children"]!).Count);
        var into = await ToolAsync(Role.Designer, s, "add_elements", $$"""{"group": "{{groupId}}", "elements": [{"type": "icon", "icon": "heart", "x": 140, "y": 120, "w": 20, "h": 20}]}""");
        Assert.True(into.Ok);
        var after = ElementOf(await StoredDocAsync(design), groupId);
        Assert.Equal(3, ((JsonArray)after["children"]!).Count);
        Assert.Equal(160, (double)after["x"]! + (double)after["w"]!);   // the box grew with the new child
    }

    // ------------------------------------------------------------------------------------------------ update_elements

    [Fact]
    public async Task Properties_are_replaced_the_others_stay_and_null_clears_what_the_schema_allows()
    {
        if (!Enabled)
        {
            return;
        }

        var shadowed = Obj("""{"id": "e2", "type": "shape", "shape": "rect", "x": 0, "y": 0, "w": 50, "h": 50, "fill": "#112233", "shadow": {"color": "#000000", "opacity": 0.5, "blur": 4, "x": 1, "y": 1}}""");
        var design = await DesignAsync(Role.Designer, DocumentOf(210, 297, "mm", Text("e1", 10, 10, 100, 20, "Alt", size: 12), shadowed));
        var s = await SessionAsync(Role.Designer, design);
        var outcome = await ToolAsync(Role.Designer, s, "update_elements", """
            {"changes": [{"id": "e1", "set": {"text": "Sommerfest", "fontSize": 30, "color": "#1fb3d6"}}, {"id": "e2", "set": {"shadow": null, "fill": {"angle": 90, "stops": [{"offset": 0, "color": "#ff0000"}, {"offset": 1, "color": "#0000ff"}]}}}]}
            """);
        Assert.True(outcome.Ok, outcome.Result!.ToJsonString());
        Assert.Equal("2 Elemente geändert – Seite 1", outcome.Summary);
        var doc = await StoredDocAsync(design);
        var e1 = ElementOf(doc, "e1");
        Assert.Equal("Sommerfest", (string)e1["text"]!);
        Assert.Equal(30, (double)e1["fontSize"]!);
        Assert.Equal("Open Sans", (string)e1["fontFamily"]!);   // not named: stays
        Assert.Equal(100, (double)e1["w"]!);
        var e2 = ElementOf(doc, "e2");
        Assert.Null(e2["shadow"]);
        Assert.Equal("linear", (string)e2["fill"]!["type"]!);
        Assert.Equal(["e1", "e2"], outcome.ElementIds);

        // a single element reads as a sentence with what changed
        var single = await ToolAsync(Role.Designer, s, "update_elements", """{"id": "e1", "set": {"text": "Sommer", "fontFamily": "Montserrat"}}""");
        Assert.Equal("Text „Sommer“ geändert (Text, Schrift) – Seite 1", single.Summary);
        // the same value again changes nothing: nothing is saved
        var revision = await RevisionAsync(design);
        var same = await ToolAsync(Role.Designer, s, "update_elements", """{"id": "e1", "set": {"text": "Sommer"}}""");
        Assert.True(same.Ok);
        Assert.False(same.Changed);
        Assert.Equal(revision, await RevisionAsync(design));
    }

    [Fact]
    public async Task An_update_with_a_wrong_id_is_refused_as_a_whole_and_wrong_properties_are_reported()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(Role.Designer, DocumentOf(210, 297, "mm", Text("e1", 10, 10, 100, 20, "Alt")));
        var s = await SessionAsync(Role.Designer, design);
        var revision = await RevisionAsync(design);
        var wrongId = await ToolAsync(Role.Designer, s, "update_elements", """{"changes": [{"id": "e1", "set": {"text": "Neu"}}, {"id": "nope", "set": {"text": "x"}}]}""");
        Assert.False(wrongId.Ok);
        Assert.Contains("nope", (string)wrongId.Result!["error"]!);
        Assert.Equal("Alt", (string)ElementOf(await StoredDocAsync(design), "e1")["text"]!);
        Assert.Equal(revision, await RevisionAsync(design));

        var nothing = await ToolAsync(Role.Designer, s, "update_elements", """{"id": "e1", "set": {"gibtsnicht": 1, "color": "grün"}}""");
        Assert.False(nothing.Ok);
        Assert.Contains("Nichts zu ändern", nothing.Summary);
        var typeChange = await ToolAsync(Role.Designer, s, "update_elements", """{"id": "e1", "set": {"type": "image", "id": "x9", "fontSize": 14}}""");
        Assert.True(typeChange.Ok);   // type and id are ignored, the rest is applied
        var e = ElementOf(await StoredDocAsync(design), "e1");
        Assert.Equal("text", (string)e["type"]!);
        Assert.Equal(14, (double)e["fontSize"]!);
        var empty = await ToolAsync(Role.Designer, s, "update_elements", "{}");
        Assert.False(empty.Ok);
        var notNull = await ToolAsync(Role.Designer, s, "update_elements", """{"id": "e1", "set": {"fontSize": null}}""");
        Assert.False(notNull.Ok);   // fontSize cannot be cleared
        var unknownFont = await ToolAsync(Role.Designer, s, "update_elements", """{"id": "e1", "set": {"fontFamily": "Wingdings 9"}}""");
        Assert.True(unknownFont.Ok);
        Assert.Contains(unknownFont.Warnings, w => w.Contains("Wingdings 9"));
        Assert.NotEqual("Wingdings 9", (string)ElementOf(await StoredDocAsync(design), "e1")["fontFamily"]!);
        var badIcon = await ToolAsync(Role.Designer, s, "add_elements", """{"elements": [{"type": "icon", "icon": "star", "x": 1, "y": 1, "w": 5, "h": 5}]}""");
        var iconId = (string)badIcon.Result!["added"]![0]!["id"]!;
        var unknownIcon = await ToolAsync(Role.Designer, s, "update_elements", $$$"""{"id": "{{{iconId}}}", "set": {"icon": "nicht-vorhanden-abc"}}""");
        Assert.False(unknownIcon.Ok);
        Assert.Equal("star", (string)ElementOf(await StoredDocAsync(design), iconId)["icon"]!);
        var unknownAsset = await ToolAsync(Role.Designer, s, "add_elements", """{"elements": [{"type": "image", "x": 1, "y": 1, "w": 5, "h": 5}]}""");
        var imageId = (string)unknownAsset.Result!["added"]![0]!["id"]!;
        var wrongKey = await ToolAsync(Role.Designer, s, "update_elements", $$$"""{"id": "{{{imageId}}}", "set": {"source": {"asset": "gibt-es-nicht-xyz"} } }""");
        Assert.False(wrongKey.Ok);
        Assert.Contains("list_media", (string)wrongKey.Result!["error"]!);
        var rightKey = await ToolAsync(Role.Designer, s, "update_elements", $$$"""{"id": "{{{imageId}}}", "set": {"source": "flag-de", "fit": "cover"}}""");
        Assert.True(rightKey.Ok);
        Assert.Equal("flag-de", (string)ElementOf(await StoredDocAsync(design), imageId)["source"]!["asset"]!);
    }

    [Fact]
    public async Task A_group_moves_and_scales_its_children_and_a_locked_element_is_left_alone()
    {
        if (!Enabled)
        {
            return;
        }

        var group = Obj("""{"id": "g1", "type": "group", "x": 10, "y": 10, "w": 40, "h": 20, "children": [{"id": "k1", "type": "shape", "shape": "rect", "x": 10, "y": 10, "w": 20, "h": 20, "fill": "#111111"}, {"id": "k2", "type": "shape", "shape": "rect", "x": 30, "y": 10, "w": 20, "h": 20, "fill": "#222222"}]}""");
        var locked = Obj("""{"id": "l1", "type": "text", "x": 0, "y": 100, "w": 50, "h": 10, "text": "Logo", "locked": true}""");
        var design = await DesignAsync(Role.Designer, DocumentOf(210, 297, "mm", group, locked));
        var s = await SessionAsync(Role.Designer, design);
        var moved = await ToolAsync(Role.Designer, s, "update_elements", """{"id": "g1", "set": {"x": 110, "y": 60}}""");
        Assert.True(moved.Ok, moved.Result!.ToJsonString());
        var doc = await StoredDocAsync(design);
        Assert.Equal(110, (double)ElementOf(doc, "k1")["x"]!);
        Assert.Equal(60, (double)ElementOf(doc, "k1")["y"]!);
        Assert.Equal(130, (double)ElementOf(doc, "k2")["x"]!);
        var scaled = await ToolAsync(Role.Designer, s, "update_elements", """{"id": "g1", "set": {"w": 80}}""");
        Assert.True(scaled.Ok);
        doc = await StoredDocAsync(design);
        Assert.Equal(80, (double)ElementOf(doc, "g1")["w"]!);
        Assert.Equal(40, (double)ElementOf(doc, "k1")["w"]!);

        var refused = await ToolAsync(Role.Designer, s, "update_elements", """{"id": "l1", "set": {"text": "Anders"}}""");
        Assert.False(refused.Ok);
        Assert.Contains("gesperrt", (string)refused.Result!["error"]!);
        var deleteRefused = await ToolAsync(Role.Designer, s, "delete_elements", """{"ids": ["l1"]}""");
        Assert.False(deleteRefused.Ok);
        var unlocked = await ToolAsync(Role.Designer, s, "update_elements", """{"id": "l1", "set": {"locked": false}}""");
        Assert.True(unlocked.Ok);
        var changed = await ToolAsync(Role.Designer, s, "update_elements", """{"id": "l1", "set": {"text": "Anders"}}""");
        Assert.True(changed.Ok);
    }

    // ------------------------------------------------------------------------------------------------ delete, arrange, group, ungroup

    [Fact]
    public async Task Delete_arrange_group_and_ungroup_work_and_refuse_what_does_not_fit()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(Role.Designer, DocumentOf(210, 297, "mm", Text("a", 10, 10, 50, 10, "a"), Text("b", 10, 30, 50, 10, "b"), Text("c", 10, 50, 50, 10, "c"), Text("d", 10, 70, 50, 10, "d")));
        var s = await SessionAsync(Role.Designer, design);
        string Order(JsonObject doc) => string.Join("", Elements(doc).Select(e => AiDocOps.Id(e)));

        Assert.True((await ToolAsync(Role.Designer, s, "arrange", """{"id": "a", "to": "front"}""")).Ok);
        Assert.Equal("bcda", Order(await StoredDocAsync(design)));
        Assert.True((await ToolAsync(Role.Designer, s, "arrange", """{"id": "d", "to": "backward"}""")).Ok);
        Assert.Equal("bdca".Replace("c", "c"), Order(await StoredDocAsync(design)).Length == 4 ? "bdca" : "");
        Assert.True((await ToolAsync(Role.Designer, s, "arrange", """{"id": "c", "to": "index", "index": 0}""")).Ok);
        Assert.StartsWith("c", Order(await StoredDocAsync(design)));
        Assert.True((await ToolAsync(Role.Designer, s, "arrange", """{"id": "c", "to": "back"}""")).Ok);
        var badArrange = await ToolAsync(Role.Designer, s, "arrange", """{"id": "c", "to": "sideways"}""");
        Assert.False(badArrange.Ok);
        Assert.False((await ToolAsync(Role.Designer, s, "arrange", """{"id": "zzz", "to": "front"}""")).Ok);
        Assert.False((await ToolAsync(Role.Designer, s, "arrange", """{"id": "c", "to": "index"}""")).Ok);

        var grouped = await ToolAsync(Role.Designer, s, "group", """{"ids": ["a", "b"], "name": "Paar"}""");
        Assert.True(grouped.Ok, grouped.Result!.ToJsonString());
        var groupId = (string)grouped.Result!["group"]!;
        var doc = await StoredDocAsync(design);
        Assert.Equal("Paar", (string)ElementOf(doc, groupId)["name"]!);
        Assert.Equal(2, ((JsonArray)ElementOf(doc, groupId)["children"]!).Count);
        Assert.False((await ToolAsync(Role.Designer, s, "group", """{"ids": ["a"]}""")).Ok);
        Assert.False((await ToolAsync(Role.Designer, s, "group", $$"""{"ids": ["c", "a"]}""")).Ok);   // a is inside the group now: not the same level

        // rotate the group, then dissolve it: the children keep their place on the page
        var before = AiDocOps.Aabb(ElementOf(doc, "a"));
        await ToolAsync(Role.Designer, s, "update_elements", $$$"""{"id": "{{{groupId}}}", "set": {"rotation": 90}}""");
        var ungrouped = await ToolAsync(Role.Designer, s, "ungroup", $$"""{"id": "{{groupId}}"}""");
        Assert.True(ungrouped.Ok, ungrouped.Result!.ToJsonString());
        doc = await StoredDocAsync(design);
        Assert.Null(AiDocOps.Locate(doc, groupId));
        Assert.Equal(90, (double)ElementOf(doc, "a")["rotation"]!);
        Assert.False((await ToolAsync(Role.Designer, s, "ungroup", """{"id": "c"}""")).Ok);

        var deleted = await ToolAsync(Role.Designer, s, "delete_elements", """{"ids": ["a", "b"]}""");
        Assert.True(deleted.Ok);
        Assert.Equal("2 Elemente gelöscht – Seite 1", deleted.Summary);
        Assert.DoesNotContain("a", Order(await StoredDocAsync(design)));
        var revision = await RevisionAsync(design);
        var missing = await ToolAsync(Role.Designer, s, "delete_elements", """{"ids": ["c", "nope"]}""");
        Assert.False(missing.Ok);
        Assert.Equal(revision, await RevisionAsync(design));
        Assert.False((await ToolAsync(Role.Designer, s, "delete_elements", "{}")).Ok);
        _ = before;
    }

    [Fact]
    public async Task Deleting_a_group_deletes_its_children_and_the_tool_can_name_a_child_twice_without_harm()
    {
        if (!Enabled)
        {
            return;
        }

        var group = Obj("""{"id": "g1", "type": "group", "x": 10, "y": 10, "w": 40, "h": 20, "children": [{"id": "k1", "type": "shape", "shape": "rect", "x": 10, "y": 10, "w": 20, "h": 20, "fill": "#111111"}]}""");
        var design = await DesignAsync(Role.Designer, DocumentOf(210, 297, "mm", group, Text("t", 1, 1, 5, 5, "bleibt")));
        var s = await SessionAsync(Role.Designer, design);
        var outcome = await ToolAsync(Role.Designer, s, "delete_elements", """{"ids": ["g1", "k1", "g1"]}""");
        Assert.True(outcome.Ok, outcome.Result!.ToJsonString());
        Assert.Equal(["t"], Elements(await StoredDocAsync(design)).Select(AiDocOps.Id));
        var last = await ToolAsync(Role.Designer, s, "update_elements", """{"id": "t", "set": {"text": "noch da"}}""");
        Assert.True(last.Ok);
    }

    // ------------------------------------------------------------------------------------------------ pages

    [Fact]
    public async Task Pages_are_set_added_copied_moved_renamed_and_deleted()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(Role.Designer, DocumentOf(210, 297, "mm", Text("e1", 10, 10, 100, 20, "Seite eins")));
        var s = await SessionAsync(Role.Designer, design);

        var set = await ToolAsync(Role.Designer, s, "set_page", """
            {"page": "p1", "name": "Titel", "background": {"color": "#0b3d5c"}, "elements": [
              {"type": "text", "x": 20, "y": 30, "w": 170, "h": 30, "text": "Sommerfest", "color": "#ffffff", "fontSize": 40},
              {"type": "icon", "icon": "sun", "x": 90, "y": 100, "w": 30, "h": 30, "color": "#ffcc00"}]}
            """);
        Assert.True(set.Ok, set.Result!.ToJsonString());
        var doc = await StoredDocAsync(design);
        Assert.Equal("Titel", (string)AiDocOps.Pages(doc)[0]!["name"]!);
        Assert.Equal("#0b3d5c", (string)AiDocOps.Pages(doc)[0]!["background"]!["color"]!);
        Assert.Equal(2, Elements(doc).Count());
        Assert.Null(AiDocOps.Locate(doc, "e1"));   // all elements of the page were replaced
        Assert.DoesNotContain(set.Warnings, w => w.Contains("Kontrast"));

        var added = await ToolAsync(Role.Designer, s, "add_page", """{"name": "Programm", "background": {"color": "#f4f4f4"}}""");
        Assert.True(added.Ok);
        var page2 = (string)added.Result!["page"]!;
        Assert.Equal(2, (int)added.Result!["number"]!);
        var copy = await ToolAsync(Role.Designer, s, "add_page", """{"copyOf": "p1", "after": "p1"}""");
        Assert.True(copy.Ok);
        doc = await StoredDocAsync(design);
        Assert.Equal(3, AiDocOps.Pages(doc).Count);
        var copied = (JsonObject)AiDocOps.Pages(doc)[1]!;
        Assert.Equal((string)copy.Result!["page"]!, AiDocOps.Id(copied));
        Assert.Equal("Titel", (string)copied["name"]!);
        var allIds = AiDocOps.AllIds(doc);
        Assert.Equal(allIds.Count, AiDocOps.AllElements(doc).Count());   // ids are unique over the document

        Assert.True((await ToolAsync(Role.Designer, s, "move_page", $$"""{"page": "{{page2}}", "to": 1}""")).Ok);
        Assert.Equal(page2, AiDocOps.Id((JsonObject)AiDocOps.Pages(await StoredDocAsync(design))[0]!));
        Assert.True((await ToolAsync(Role.Designer, s, "rename_page", """{"page": 1, "name": "Neu"}""")).Ok);
        Assert.Equal("Neu", (string)AiDocOps.Pages(await StoredDocAsync(design))[0]!["name"]!);
        Assert.False((await ToolAsync(Role.Designer, s, "move_page", """{"page": "p1"}""")).Ok);
        Assert.False((await ToolAsync(Role.Designer, s, "rename_page", """{"page": "p1"}""")).Ok);
        Assert.False((await ToolAsync(Role.Designer, s, "add_page", """{"copyOf": "p99"}""")).Ok);

        Assert.True((await ToolAsync(Role.Designer, s, "delete_page", $$"""{"page": "{{page2}}"}""")).Ok);
        Assert.True((await ToolAsync(Role.Designer, s, "delete_page", $$"""{"page": "{{copy.Result!["page"]}}"}""")).Ok);
        var last = await ToolAsync(Role.Designer, s, "delete_page", """{"page": "p1"}""");
        Assert.False(last.Ok);
        Assert.Contains("einzige", (string)last.Result!["error"]!);
        // more than one page and no page named: the model has to say which
        await ToolAsync(Role.Designer, s, "add_page");
        var which = await ToolAsync(Role.Designer, s, "add_elements", """{"elements": [{"type": "text", "x": 1, "y": 1, "w": 10, "h": 5, "text": "wohin?"}]}""");
        Assert.False(which.Ok);
        Assert.Contains("page", (string)which.Result!["error"]!);
    }

    [Fact]
    public async Task A_design_has_at_most_50_pages_and_a_page_with_locked_elements_is_not_replaced()
    {
        if (!Enabled)
        {
            return;
        }

        var many = new JsonObject
        {
            ["schema"] = 2, ["unit"] = "mm", ["width"] = 100, ["height"] = 100, ["dpi"] = 300, ["locale"] = "de-DE", ["fields"] = new JsonArray(),
            ["pages"] = new JsonArray(Enumerable.Range(1, 50).Select(i => (JsonNode)Obj($$"""{"id": "p{{i}}", "name": "", "background": {"color": "#ffffff"}, "elements": []}""")).ToArray()),
        };
        var full = await DesignAsync(Role.Designer, many.ToJsonString());
        var s = await SessionAsync(Role.Designer, full);
        var tooMany = await ToolAsync(Role.Designer, s, "add_page");
        Assert.False(tooMany.Ok);
        Assert.Contains("50", (string)tooMany.Result!["error"]!);

        var lockedDoc = DocumentOf(100, 100, "mm", Obj("""{"id": "l1", "type": "shape", "shape": "rect", "x": 0, "y": 0, "w": 10, "h": 10, "locked": true, "fill": "#000000"}"""));
        var design = await DesignAsync(Role.Designer, lockedDoc);
        var s2 = await SessionAsync(Role.Designer, design);
        var refused = await ToolAsync(Role.Designer, s2, "set_page", """{"page": "p1", "elements": []}""");
        Assert.False(refused.Ok);
        Assert.Contains("gesperrt", (string)refused.Result!["error"]!.ToString());
        var background = await ToolAsync(Role.Designer, s2, "set_page", """{"page": "p1", "background": {"color": "#112233", "fit": "kreisrund"}}""");
        Assert.True(background.Ok);
        Assert.Contains(background.Warnings, w => w.Contains("fit"));
        Assert.False((await ToolAsync(Role.Designer, s2, "set_page", """{"page": "p1"}""")).Ok);
        Assert.False((await ToolAsync(Role.Designer, s2, "set_page", """{"page": "p1", "background": 5}""")).Ok);
    }

    // ------------------------------------------------------------------------------------------------ format, fields, template, svg, name

    [Fact]
    public async Task The_format_changes_by_preset_or_size_with_the_content_scaled()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(Role.Designer, DocumentOf(100, 100, "mm", Text("e1", 10, 10, 50, 10, "Hallo", size: 10)));
        var s = await SessionAsync(Role.Designer, design);
        var resized = await ToolAsync(Role.Designer, s, "resize_design", """{"preset": "a4-portrait"}""");
        Assert.True(resized.Ok, resized.Result!.ToJsonString());
        var doc = await StoredDocAsync(design);
        Assert.Equal(210, (double)doc["width"]!);
        Assert.Equal(297, (double)doc["height"]!);
        Assert.True((double)ElementOf(doc, "e1")["fontSize"]! > 10);   // scaled with the page
        var px = await ToolAsync(Role.Designer, s, "resize_design", """{"width": 1080, "height": 1080, "unit": "px", "scale": false}""");
        Assert.True(px.Ok);
        doc = await StoredDocAsync(design);
        Assert.Equal("px", (string)doc["unit"]!);
        Assert.Equal(1080, (double)doc["width"]!);
        Assert.False((await ToolAsync(Role.Designer, s, "resize_design", """{"preset": "kosmos"}""")).Ok);
        Assert.False((await ToolAsync(Role.Designer, s, "resize_design", """{"width": 1, "height": 99999, "unit": "mm"}""")).Ok);
        Assert.False((await ToolAsync(Role.Designer, s, "resize_design", "{}")).Ok);
        Assert.False((await ToolAsync(Role.Designer, s, "resize_design", """{"width": "breit", "height": 5}""")).Ok);
    }

    [Fact]
    public async Task Fields_are_made_changed_and_removed_only_when_nothing_uses_them()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(Role.Designer, DocumentOf(210, 297, "mm", Text("e1", 10, 10, 100, 20, "{{Name}} kostet {{Preis}}")));
        var s = await SessionAsync(Role.Designer, design);
        var set = await ToolAsync(Role.Designer, s, "set_fields", """{"fields": [{"key": "Name", "label": "Käsesorte", "sample": "Gouda"}, {"key": "Preis", "type": "price", "sample": "2,5"}]}""");
        Assert.True(set.Ok, set.Result!.ToJsonString());
        Assert.DoesNotContain(set.Warnings, w => w.Contains("kein Feld"));
        var fields = (JsonArray)(await StoredDocAsync(design))["fields"]!;
        Assert.Equal(2, fields.Count);
        Assert.Equal("price", (string)fields[1]!["type"]!);
        Assert.Equal(2, (int)fields[1]!["decimals"]!);   // a price has two decimals unless said otherwise

        var change = await ToolAsync(Role.Designer, s, "set_fields", """{"fields": [{"key": "name", "sample": "Brie"}]}""");
        Assert.True(change.Ok);
        fields = (JsonArray)(await StoredDocAsync(design))["fields"]!;
        Assert.Equal(2, fields.Count);   // the key is found without regard to case
        Assert.Equal("Brie", (string)fields[0]!["sample"]!);
        Assert.Equal("Name", (string)fields[0]!["key"]!);

        var used = await ToolAsync(Role.Designer, s, "set_fields", """{"remove": ["Preis"]}""");
        Assert.False(used.Ok);
        Assert.Contains("verwendet", (string)used.Result!["error"]!);
        var extra = await ToolAsync(Role.Designer, s, "set_fields", """{"fields": [{"key": "Herkunft"}]}""");
        Assert.True(extra.Ok);
        Assert.Contains(extra.Warnings, w => w.Contains("Herkunft") && w.Contains("keinem Element"));   // the lint: nobody uses it
        Assert.True((await ToolAsync(Role.Designer, s, "set_fields", """{"remove": ["Herkunft"]}""")).Ok);

        Assert.False((await ToolAsync(Role.Designer, s, "set_fields", """{"fields": [{"key": "1 kaputt"}]}""")).Ok);
        Assert.False((await ToolAsync(Role.Designer, s, "set_fields", """{"fields": ["Name"]}""")).Ok);
        Assert.False((await ToolAsync(Role.Designer, s, "set_fields", "{}")).Ok);
        var weird = await ToolAsync(Role.Designer, s, "set_fields", """{"fields": [{"key": "Typ", "type": "hologramm", "label": 7}]}""");
        Assert.True(weird.Ok);
        Assert.Contains(weird.Warnings, w => w.Contains("hologramm"));
        var tooMany = string.Join(",", Enumerable.Range(1, 100).Select(i => $$"""{"key": "F{{i}}"}"""));
        Assert.False((await ToolAsync(Role.Designer, s, "set_fields", $$"""{"fields": [{{tooMany}}]}""")).Ok);
    }

    [Fact]
    public async Task A_page_of_a_template_is_copied_scaled_with_new_ids_and_its_fields()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(Role.Designer, DocumentOf(100, 100, "mm", Text("e1", 5, 5, 50, 10, "bleibt")));
        var s = await SessionAsync(Role.Designer, design);
        // a template of its own (the built-in ones use built-in images, which other tests of the run may have changed)
        var source = await DesignAsync(Role.Designer, DocumentOf(200, 300, "mm", Text("t1", 10, 10, 100, 20, "{{Name}}"), Text("t2", 10, 50, 150, 20, "Untertitel")), "Vorlage Käse test");
        await Db(async db => await db.Design.Where(d => d.Id == source).ExecuteUpdateAsync(u => u.SetProperty(d => d.IsTemplate, true)));
        var templates = await ToolAsync(Role.Designer, s, "list_templates", """{"q": "Vorlage Käse test"}""");
        var template = ((JsonArray)templates.Result!["templates"]!).OfType<JsonObject>().First(t => (long)t["id"]! == source);
        var templateId = (long)template["id"]!;
        var applied = await ToolAsync(Role.Designer, s, "apply_template", $$"""{"templateId": {{templateId}}}""");
        Assert.True(applied.Ok, applied.Result!.ToJsonString());
        var doc = await StoredDocAsync(design);
        Assert.Equal(2, AiDocOps.Pages(doc).Count);
        var page = (JsonObject)AiDocOps.Pages(doc)[1]!;
        Assert.Equal((string)applied.Result!["page"]!, AiDocOps.Id(page));
        var ids = AiDocOps.AllIds(doc);
        Assert.Equal(ids.Count, AiDocOps.AllElements(doc).Count());
        Assert.All(AiDocOps.Walk(AiDocOps.Elements(page)), e => Assert.True(AiDocOps.Num(e["x"]) + AiDocOps.Num(e["w"]) <= 100.5, "the template page is scaled to the design"));
        var fieldsAdded = (JsonArray)applied.Result!["fieldsAdded"]!;
        Assert.Equal(((JsonArray)doc["fields"]!).Count, fieldsAdded.Count);
        Assert.Equal("bleibt", (string)ElementOf(doc, "e1")["text"]!);

        var replaced = await ToolAsync(Role.Designer, s, "apply_template", $$"""{"templateId": {{templateId}}, "page": "p1"}""");
        Assert.True(replaced.Ok);
        doc = await StoredDocAsync(design);
        Assert.Equal(2, AiDocOps.Pages(doc).Count);
        Assert.Null(AiDocOps.Locate(doc, "e1"));

        Assert.False((await ToolAsync(Role.Designer, s, "apply_template", """{"templateId": 987654321}""")).Ok);
        Assert.False((await ToolAsync(Role.Designer, s, "apply_template", $$"""{"templateId": {{templateId}}, "templatePage": 99}""")).Ok);
        Assert.False((await ToolAsync(Role.Designer, s, "apply_template", "{}")).Ok);
        // a design that is no template cannot be applied, not even one of the person
        var plain = await DesignAsync(Role.Designer, DocumentOf(100, 100, "mm", Text("x1", 1, 1, 10, 5, "kein Vorlage")));
        Assert.False((await ToolAsync(Role.Designer, s, "apply_template", $$"""{"templateId": {{plain}}}""")).Ok);
    }

    [Fact]
    public async Task A_drawn_svg_goes_into_the_library_cleaned_and_a_hostile_one_is_refused()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(Role.Designer);
        var s = await SessionAsync(Role.Designer, design);
        var svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><script>alert(1)</script><rect width="100" height="40" fill="#1fb3d6" onclick="x()"/><a href="https://böse.example"><circle cx="20" cy="20" r="10"/></a></svg>""";
        var made = await ToolAsync(Role.Designer, s, "create_svg", JsonNode.Parse(System.Text.Json.JsonSerializer.Serialize(new { name = "Logo Käse", svg }))!.ToJsonString());
        Assert.True(made.Ok, made.Result!.ToJsonString());
        var key = (string)made.Result!["key"]!;
        Assert.Equal(100, (int)made.Result!["width"]!);
        Assert.NotEmpty(made.Warnings);   // what was taken out
        var asset = await Db(db => db.Asset.AsNoTracking().FirstAsync(a => a.Key == key));
        var stored = System.Text.Encoding.UTF8.GetString(asset.Bytes);
        Assert.DoesNotContain("script", stored);
        Assert.DoesNotContain("onclick", stored);
        Assert.DoesNotContain("böse", stored);
        Assert.Equal("KI-Grafik", asset.Category);
        var userId = await UserAsync(Role.Designer);
        Assert.NotNull(asset.SpaceId);
        // the key can be used at once, and it is among the media of the conversation
        var use = await ToolAsync(Role.Designer, s, "add_elements", $$$"""{"elements": [{"type": "image", "x": 10, "y": 10, "w": 100, "h": 40, "source": {"asset": "{{{key}}}"}}]}""");
        Assert.True(use.Ok, use.Result!.ToJsonString());
        var media = await ToolAsync(Role.Designer, s, "list_media", $$"""{"q": "{{key}}"}""");
        Assert.Contains(((JsonArray)media.Result!["media"]!).OfType<JsonObject>(), m => (string)m["key"]! == key);
        _ = userId;

        Assert.False((await ToolAsync(Role.Designer, s, "create_svg", """{"name": "x", "svg": "<html><body>keine Grafik</body></html>"}""")).Ok);
        Assert.False((await ToolAsync(Role.Designer, s, "create_svg", """{"name": "x", "svg": "<!DOCTYPE svg [<!ENTITY a \"b\">]><svg xmlns=\"http://www.w3.org/2000/svg\"><text>&a;</text></svg>"}""")).Ok);
        Assert.False((await ToolAsync(Role.Designer, s, "create_svg", """{"name": "x"}""")).Ok);
        var huge = new string('a', AiDesignTools.MaxSvgChars + 1);
        Assert.False((await ToolAsync(Role.Designer, s, "create_svg", $$"""{"name": "x", "svg": "<svg xmlns='http://www.w3.org/2000/svg'><!-- {{huge}} --></svg>"}""")).Ok);
    }

    [Fact]
    public async Task The_design_can_be_renamed()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(Role.Designer);
        var s = await SessionAsync(Role.Designer, design);
        var renamed = await ToolAsync(Role.Designer, s, "rename_design", """{"name": "  Sommerfest 2027  "}""");
        Assert.True(renamed.Ok);
        Assert.Equal("Sommerfest 2027", await Db(db => db.Design.AsNoTracking().Where(d => d.Id == design).Select(d => d.Name).FirstAsync()));
        Assert.False((await ToolAsync(Role.Designer, s, "rename_design", """{"name": "   "}""")).Ok);
        Assert.False((await ToolAsync(Role.Designer, s, "rename_design")).Ok);
    }

    // ------------------------------------------------------------------------------------------------ the scope

    [Fact]
    public async Task With_a_page_scope_and_the_lock_a_write_outside_the_page_fails_with_a_reason()
    {
        if (!Enabled)
        {
            return;
        }

        var two = new JsonObject
        {
            ["schema"] = 2, ["unit"] = "mm", ["width"] = 100, ["height"] = 100, ["dpi"] = 300, ["locale"] = "de-DE", ["fields"] = new JsonArray(),
            ["pages"] = new JsonArray(
                Obj("""{"id": "p1", "name": "", "background": {"color": "#ffffff"}, "elements": [{"id": "e1", "type": "text", "x": 1, "y": 1, "w": 50, "h": 10, "text": "eins"}]}"""),
                Obj("""{"id": "p2", "name": "", "background": {"color": "#ffffff"}, "elements": [{"id": "e2", "type": "text", "x": 1, "y": 1, "w": 50, "h": 10, "text": "zwei"}]}""")),
        };
        var design = await DesignAsync(Role.Designer, two.ToJsonString());
        var s = await SessionAsync(Role.Designer, design, new AiScope("page", "p2", [], true));
        var revision = await RevisionAsync(design);

        async Task Outside(string tool, string args)
        {
            var outcome = await ToolAsync(Role.Designer, s, tool, args);
            Assert.False(outcome.Ok, tool + " " + args);
            Assert.Contains("Bereich", (string)outcome.Result!["error"]!);
            Assert.Equal(revision, await RevisionAsync(design));
        }

        await Outside("update_elements", """{"id": "e1", "set": {"text": "gehackt"}}""");
        await Outside("delete_elements", """{"ids": ["e1"]}""");
        await Outside("add_elements", """{"page": "p1", "elements": [{"type": "text", "x": 1, "y": 20, "w": 10, "h": 5, "text": "x"}]}""");
        await Outside("set_page", """{"page": "p1", "elements": []}""");
        await Outside("add_page", "{}");
        await Outside("delete_page", """{"page": "p2"}""");
        await Outside("move_page", """{"page": "p2", "to": 1}""");
        await Outside("resize_design", """{"preset": "a4-portrait"}""");
        await Outside("rename_design", """{"name": "x"}""");
        await Outside("apply_template", """{"templateId": 1}""");
        await Outside("create_svg", """{"name": "x", "svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>"}""");

        // reading is open, and the page of the scope is the default page
        Assert.True((await ToolAsync(Role.Designer, s, "read_design", """{"page": "p1"}""")).Ok);
        Assert.True((await ToolAsync(Role.Designer, s, "update_elements", """{"id": "e2", "set": {"text": "ok"}}""")).Ok);
        var added = await ToolAsync(Role.Designer, s, "add_elements", """{"elements": [{"type": "text", "x": 1, "y": 20, "w": 10, "h": 5, "text": "hier"}]}""");
        Assert.True(added.Ok);
        Assert.Equal("p2", added.PageId);
        Assert.True((await ToolAsync(Role.Designer, s, "set_page", """{"elements": [{"type": "text", "x": 1, "y": 1, "w": 50, "h": 10, "text": "neu"}]}""")).Ok);
        // new fields do not touch any element: allowed, removing one is not
        Assert.True((await ToolAsync(Role.Designer, s, "set_fields", """{"fields": [{"key": "Neu"}]}""")).Ok);
        await Outside2(s, """{"remove": ["Neu"]}""");
        // without the lock the same scope is only what the person looks at
        var open = await SessionAsync(Role.Designer, design, new AiScope("page", "p2", [], false));
        Assert.True((await ToolAsync(Role.Designer, open, "update_elements", """{"id": "e1", "set": {"text": "darf"}}""")).Ok);
    }

    private async Task Outside2(AiToolSession s, string args)
    {
        var outcome = await ToolAsync(Role.Designer, s, "set_fields", args);
        Assert.False(outcome.Ok);
        Assert.Contains("Bereich", (string)outcome.Result!["error"]!);
    }

    [Fact]
    public async Task With_a_selection_scope_and_the_lock_only_the_selected_elements_and_what_the_run_made_may_change()
    {
        if (!Enabled)
        {
            return;
        }

        var group = Obj("""{"id": "g1", "type": "group", "x": 10, "y": 60, "w": 40, "h": 20, "children": [{"id": "k1", "type": "shape", "shape": "rect", "x": 10, "y": 60, "w": 40, "h": 20, "fill": "#111111"}]}""");
        var design = await DesignAsync(Role.Designer, DocumentOf(100, 100, "mm", Text("e1", 1, 1, 50, 10, "gewählt"), Text("e2", 1, 20, 50, 10, "nicht gewählt"), group));
        var s = await SessionAsync(Role.Designer, design, new AiScope("selection", "p1", ["e1", "g1"], true));
        Assert.True((await ToolAsync(Role.Designer, s, "update_elements", """{"id": "e1", "set": {"text": "geändert"}}""")).Ok);
        var other = await ToolAsync(Role.Designer, s, "update_elements", """{"id": "e2", "set": {"text": "gehackt"}}""");
        Assert.False(other.Ok);
        Assert.Contains("e2", (string)other.Result!["error"]!);
        // a child of a selected group counts as selected
        Assert.True((await ToolAsync(Role.Designer, s, "update_elements", """{"id": "k1", "set": {"fill": "#222222"}}""")).Ok);
        Assert.False((await ToolAsync(Role.Designer, s, "delete_elements", """{"ids": ["e2"]}""")).Ok);
        Assert.False((await ToolAsync(Role.Designer, s, "set_page", """{"page": "p1", "elements": []}""")).Ok);
        // new elements on the page of the selection are fine, and what the run made may be changed again
        var added = await ToolAsync(Role.Designer, s, "add_elements", """{"elements": [{"type": "shape", "x": 1, "y": 40, "w": 50, "h": 2, "fill": "#000000"}]}""");
        Assert.True(added.Ok);
        var newId = (string)added.Result!["added"]![0]!["id"]!;
        Assert.True((await ToolAsync(Role.Designer, s, "update_elements", $$$"""{"id": "{{{newId}}}", "set": {"fill": "#ff0000"}}""")).Ok);
        Assert.Equal("nicht gewählt", (string)ElementOf(await StoredDocAsync(design), "e2")["text"]!);
    }

    [Fact]
    public async Task Somebody_who_may_only_view_cannot_write_and_a_stranger_does_not_find_the_design()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(Role.Designer, DocumentOf(100, 100, "mm", Text("e1", 1, 1, 50, 10, "Text")));
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer, SharePermission.View);
        var asViewer = await SessionAsync(Role.Viewer, design);
        Assert.True((await ToolAsync(Role.Viewer, asViewer, "read_design")).Ok);
        await Assert.ThrowsAsync<ForbiddenException>(() => ToolAsync(Role.Viewer, asViewer, "update_elements", """{"id": "e1", "set": {"text": "x"}}"""));
        await Assert.ThrowsAsync<ForbiddenException>(() => ToolAsync(Role.Viewer, asViewer, "add_page"));
        var asStranger = await SessionAsync(Role.Stranger, design);
        await Assert.ThrowsAsync<NotFoundException>(() => ToolAsync(Role.Stranger, asStranger, "read_design"));
        await Assert.ThrowsAsync<NotFoundException>(() => ToolAsync(Role.Stranger, asStranger, "delete_elements", """{"ids": ["e1"]}"""));
        Assert.Equal("Text", (string)ElementOf(await StoredDocAsync(design), "e1")["text"]!);
    }

    // ------------------------------------------------------------------------------------------------ the lint

    [Fact]
    public async Task What_a_person_would_see_at_a_glance_comes_back_as_warnings_once()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(Role.Designer, DocumentOf(100, 100, "mm", Rect("bg", 0, 0, 100, 100, "#ffffff")));
        var s = await SessionAsync(Role.Designer, design);
        var outcome = await ToolAsync(Role.Designer, s, "add_elements", """
            {"elements": [
              {"type": "text", "x": 80, "y": 10, "w": 60, "h": 10, "text": "Rechts raus", "name": "Raus"},
              {"type": "text", "x": 10, "y": 30, "w": 50, "h": 10, "text": "Oben", "name": "Eins"},
              {"type": "text", "x": 15, "y": 32, "w": 50, "h": 10, "text": "Drüber", "name": "Zwei"},
              {"type": "text", "x": 10, "y": 50, "w": 50, "h": 10, "text": "Winzig", "fontSize": 4, "name": "Klein"},
              {"type": "text", "x": 10, "y": 70, "w": 50, "h": 10, "text": "Blass", "color": "#eeeeee", "name": "Blass"},
              {"type": "image", "x": 60, "y": 60, "w": 30, "h": 30, "name": "Foto"},
              {"type": "text", "x": 10, "y": 90, "w": 50, "h": 5, "text": "{{Ding}}", "name": "Platzhalter"},
              {"type": "shape", "shape": "rect", "x": 200, "y": 200, "w": 10, "h": 10, "name": "Weit weg"}
            ]}
            """);
        Assert.True(outcome.Ok, outcome.Result!.ToJsonString());
        var text = string.Join("\n", outcome.Warnings);
        Assert.Contains("„Raus“", text);
        Assert.Contains("heraus", text);
        Assert.Contains("ganz außerhalb", text);
        Assert.Contains("überlappen", text);
        Assert.Contains("zu klein", text);
        Assert.Contains("Kontrast", text);
        Assert.Contains("Bildrahmen", text);
        Assert.Contains("hat kein Feld", text);
        // told once: the same thing again is not said again
        var again = await ToolAsync(Role.Designer, s, "update_elements", """{"id": "bg", "set": {"opacity": 0.99}}""");
        Assert.True(again.Ok);
        Assert.DoesNotContain(again.Warnings, w => w.Contains("zu klein"));
        // contrast is judged against the shape below the text, not only the page
        var dark = await ToolAsync(Role.Designer, s, "add_elements", """
            {"elements": [{"type": "shape", "shape": "rect", "x": 0, "y": 0, "w": 100, "h": 20, "fill": "#101010", "name": "Balken"},
                          {"type": "text", "x": 5, "y": 5, "w": 50, "h": 10, "text": "Hell auf dunkel", "color": "#ffffff", "name": "Weiß"}]}
            """);
        Assert.DoesNotContain(dark.Warnings, w => w.Contains("Weiß") && w.Contains("Kontrast"));
        var families = await ToolAsync(Role.Designer, s, "add_elements", """
            {"elements": [{"type": "text", "x": 5, "y": 90, "w": 20, "h": 5, "text": "a", "fontFamily": "Montserrat"}, {"type": "text", "x": 25, "y": 90, "w": 20, "h": 5, "text": "b", "fontFamily": "Lora"},
                          {"type": "text", "x": 45, "y": 90, "w": 20, "h": 5, "text": "c", "fontFamily": "Oswald"}, {"type": "text", "x": 65, "y": 90, "w": 20, "h": 5, "text": "d", "fontFamily": "Caveat"}]}
            """);
        Assert.Contains(families.Warnings, w => w.Contains("Schriftfamilien"));
    }

    [Fact]
    public void The_contrast_is_the_wcag_ratio()
    {
        Assert.Equal(21, AiDesignLint.Contrast("#000000", "#ffffff")!.Value, 3);
        Assert.Equal(1, AiDesignLint.Contrast("#777", "#777777")!.Value, 3);
        Assert.True(AiDesignLint.Contrast("#1fb3d6", "#ffffff")!.Value < 3);
        Assert.Null(AiDesignLint.Contrast("rot", "#ffffff"));
    }
}
