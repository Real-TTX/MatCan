using System.Text;
using System.Text.Json;
using DesignThix.Core.Ai;
using DesignThix.Core.Data;

namespace DesignThix.Tests.Core;

/// <summary>
/// The boundary around what a model writes: hostile answers (unknown keys, scripts, wrong row ids, changed placeholders, absurd lengths, no JSON, JSON in a code fence, nothing at all)
/// must never get through to the data. The checks are pure functions, so every rule is tested here without a database or a server.
/// </summary>
public sealed class AiTextCleanTests
{
    [Theory]
    [InlineData("<script>alert(1)</script>")]
    [InlineData("Gouda <SCRIPT src=x></SCRIPT>")]
    [InlineData("<img src=x onerror=alert(1)>")]
    [InlineData("<a href=\"javascript:alert(1)\">x</a>")]
    [InlineData("<iframe src=\"https://evil.example\"></iframe>")]
    [InlineData("<svg onload=alert(1)>")]
    [InlineData("see javascript:alert(1)")]
    [InlineData("data:text/html;base64,PHNjcmlwdD4=")]
    [InlineData("<style>@import url(x)</style>")]
    public void Scripts_are_refused_with_a_reason(string raw)
    {
        var cleaned = AiText.Clean(raw, 500, false);
        Assert.True(cleaned.Refused);
        Assert.Contains("Skript", cleaned.Warning);
    }

    [Fact]
    public void Harmless_tags_are_stripped_and_said_so()
    {
        var cleaned = AiText.Clean("<b>Gouda</b> <br/>jung <!-- Kommentar -->", 500, false);
        Assert.Equal("Gouda jung", cleaned.Value);
        Assert.Contains("HTML", cleaned.Warning);
    }

    [Fact]
    public void Plain_text_with_angle_brackets_stays()
        => Assert.Equal("5 < 10 und 7 > 3 (Preis ab 2,99 €)", AiText.Clean("5 < 10 und 7 > 3 (Preis ab 2,99 €)", 500, false).Value);

    [Fact]
    public void Control_and_bidi_characters_are_removed()
    {
        var evil = "Ka" + (char)0 + "ese" + (char)0x202E + "﻿" + (char)0x200B + (char)7;
        Assert.Equal("Kaese", AiText.Clean(evil, 500, false).Value);
    }

    [Fact]
    public void Line_breaks_become_spaces_in_one_line_text_and_stay_in_multiline()
    {
        Assert.Equal("a b c", AiText.Clean("a\r\nb\nc", 500, false).Value);
        Assert.Equal("a\nb\nc", AiText.Clean("a\r\nb\nc", 500, true).Value);
    }

    [Fact]
    public void An_absurd_length_is_refused_not_cut()
    {
        var cleaned = AiText.Clean(new string('x', 501), 500, false);
        Assert.True(cleaned.Refused);
        Assert.Contains("zu lang", cleaned.Warning);
        Assert.False(AiText.Clean(new string('x', 500), 500, false).Refused);
    }

    [Fact]
    public void Nothing_is_an_empty_value()
    {
        Assert.Equal(string.Empty, AiText.Clean(null, 10, false).Value);
        Assert.Equal(string.Empty, AiText.Clean("   ", 10, false).Value);
    }
}

public sealed class AiColumnValueTests
{
    private static JsonElement Json(string text) => JsonDocument.Parse(text).RootElement.Clone();

    private static readonly ColumnDef Price = new("Preis", "Preis", "price", 2, null);
    private static readonly ColumnDef Number = new("Menge", "Menge", "number", null, null);
    private static readonly ColumnDef Text = new("Name", "Name", "text", null, null);
    private static readonly ColumnDef Image = new("Land", "Land", "image", null, "Flaggen");

    [Theory]
    [InlineData("\"2,99 €\"", "2,99")]
    [InlineData("\"2.5\"", "2,50")]
    [InlineData("3", "3,00")]
    [InlineData("\"1.234,5\"", "1.234,50")]
    public void A_price_is_parsed_like_the_grid_and_written_with_its_decimals(string json, string expected)
        => Assert.Equal(expected, AiText.ForColumn(Price, Json(json), null).Value);

    [Theory]
    [InlineData("\"abc\"")]
    [InlineData("\"1e999\"")]
    [InlineData("\"99999999999999999\"")]
    [InlineData("\"2,99 und 3,50\"")]
    public void A_price_that_is_no_number_is_refused(string json)
        => Assert.True(AiText.ForColumn(Price, Json(json), null).Refused);

    [Fact]
    public void A_number_without_decimals_keeps_what_was_written()
        => Assert.Equal("12,5", AiText.ForColumn(Number, Json("\"12,5\""), null).Value);

    [Theory]
    [InlineData("[\"a\"]")]
    [InlineData("{\"x\": 1}")]
    public void A_list_or_an_object_is_no_value(string json)
        => Assert.True(AiText.ForColumn(Text, Json(json), null).Refused);

    [Fact]
    public void Booleans_and_null_are_text_and_nothing()
    {
        Assert.Equal("true", AiText.ForColumn(Text, Json("true"), null).Value);
        Assert.Equal(string.Empty, AiText.ForColumn(Text, Json("null"), null).Value);
    }

    [Fact]
    public void An_image_cell_takes_only_keys_of_the_allowlist_written_as_the_key_is_spelled()
    {
        var allowed = new ImageAllowlist(["flag-de", "flag-at"]);
        Assert.Equal("flag-de", AiText.ForColumn(Image, Json("\"FLAG-DE\""), allowed).Value);
        Assert.Equal("flag-at", AiText.ForColumn(Image, Json("\" flag-at \""), allowed).Value);
        var unknown = AiText.ForColumn(Image, Json("\"flag-xx\""), allowed);
        Assert.True(unknown.Refused);
        Assert.Contains("erlaubten Medien", unknown.Warning);
        Assert.True(AiText.ForColumn(Image, Json("\"../../etc/passwd\""), allowed).Refused);
        Assert.True(AiText.ForColumn(Image, Json("\"flag-de\""), null).Refused);
        Assert.True(AiText.ForColumn(Image, Json("\"flag-de\""), ImageAllowlist.Empty).Refused);
    }

    [Fact]
    public void The_limit_depends_on_the_column()
    {
        Assert.True(AiText.ForColumn(Text, Json("\"" + new string('a', 501) + "\""), null).Refused);
        Assert.False(AiText.ForColumn(new ColumnDef("B", "B", "multiline", null, null), Json("\"" + new string('a', 1500) + "\""), null).Refused);
    }
}

public sealed class DataImportCheckTests
{
    private static readonly IReadOnlyList<ColumnDef> Columns =
    [
        new("Name", "Käsename", "text", null, null),
        new("Preis", "Preis", "price", 2, null),
        new("Land", "Herkunftsland", "image", null, "Flaggen"),
    ];

    private static ImageAllowlist Flags(ColumnDef _) => new(["flag-de", "flag-nl"]);

    private static ImportProposal Check(string answer) => DataImportCheck.Check(LenientJson.FirstObject(answer), Columns, Flags);

    [Fact]
    public void Good_rows_come_through_cleaned()
    {
        var p = Check("{\"rows\": [{\"Name\": \"Gouda\", \"Preis\": \"2,5 €\", \"Land\": \"flag-nl\"}, {\"name\": \"Edamer\", \"preis\": 3}], \"notes\": \"Zwei Käse.\"}");
        Assert.Equal(2, p.Rows.Count);
        Assert.Equal("Gouda", p.Rows[0].Values["Name"]);
        Assert.Equal("2,50", p.Rows[0].Values["Preis"]);
        Assert.Equal("flag-nl", p.Rows[0].Values["Land"]);
        Assert.Equal("3,00", p.Rows[1].Values["Preis"]);
        Assert.Equal("Zwei Käse.", p.Notes);
        Assert.Empty(p.Warnings);
    }

    [Fact]
    public void A_json_object_in_a_code_fence_with_chatter_is_read()
    {
        var p = Check("Gern! Hier ist das Ergebnis:\n```json\n{\"rows\": [{\"Name\": \"Brie\",}],}\n```\nViel Erfolg.");
        Assert.Single(p.Rows);
        Assert.Equal("Brie", p.Rows[0].Values["Name"]);
    }

    [Fact]
    public void Unknown_keys_are_dropped_and_named_known_labels_are_accepted()
    {
        var p = Check("{\"rows\": [{\"Name\": \"Brie\", \"Passwort\": \"geheim\", \"isAdmin\": true, \"Herkunftsland\": \"flag-de\"}]}");
        Assert.Equal(["Name", "Land"], p.Rows[0].Values.Keys.OrderBy(k => k == "Name" ? 0 : 1));
        Assert.DoesNotContain("Passwort", p.Rows[0].Values.Keys);
        Assert.Contains(p.Warnings, w => w.Contains("Unbekannte Spalten") && w.Contains("Passwort") && w.Contains("isAdmin"));
    }

    [Fact]
    public void A_hostile_cell_is_emptied_with_a_warning_the_row_stays()
    {
        var p = Check("{\"rows\": [{\"Name\": \"<script>alert(1)</script>\", \"Preis\": \"2,99\"}, {\"Name\": \"<b>Fett</b>\"}]}");
        Assert.Equal(2, p.Rows.Count);
        Assert.False(p.Rows[0].Values.ContainsKey("Name"));
        Assert.Contains("Skript", p.Rows[0].Warnings["Name"]);
        Assert.Equal("2,99", p.Rows[0].Values["Preis"]);
        Assert.Equal("Fett", p.Rows[1].Values["Name"]);
        Assert.Contains("HTML", p.Rows[1].Warnings["Name"]);
    }

    [Fact]
    public void An_image_that_is_not_in_the_allowlist_is_empty_with_a_warning()
    {
        var p = Check("{\"rows\": [{\"Name\": \"Brie\", \"Land\": \"flag-fr\"}]}");
        Assert.False(p.Rows[0].Values.ContainsKey("Land"));
        Assert.Contains("flag-fr", p.Rows[0].Warnings["Land"]);
    }

    [Fact]
    public void A_price_that_is_no_number_is_emptied_with_a_warning()
    {
        var p = Check("{\"rows\": [{\"Name\": \"Brie\", \"Preis\": \"auf Anfrage\"}]}");
        Assert.False(p.Rows[0].Values.ContainsKey("Preis"));
        Assert.Contains("keine brauchbare Zahl", p.Rows[0].Warnings["Preis"]);
    }

    [Fact]
    public void More_than_500_rows_are_cut()
    {
        var rows = string.Join(",", Enumerable.Range(1, 650).Select(i => $"{{\"Name\": \"K{i}\"}}"));
        var p = Check("{\"rows\": [" + rows + "]}");
        Assert.Equal(DataImportCheck.MaxRows, p.Rows.Count);
        Assert.Contains(p.Warnings, w => w.Contains("500"));
    }

    [Fact]
    public void Entries_that_are_no_rows_or_have_no_values_are_skipped()
    {
        var p = Check("{\"rows\": [\"Gouda\", 5, null, {}, {\"Name\": \"\"}, {\"Unbekannt\": \"x\"}, {\"Name\": \"Ok\"}]}");
        Assert.Single(p.Rows);
        Assert.Equal("Ok", p.Rows[0].Values["Name"]);
        Assert.True(p.Warnings.Count >= 5);
    }

    [Theory]
    [InlineData("")]
    [InlineData("Ich schaue mir das an und melde mich gleich.")]
    [InlineData("{\"rows\": \"viele\"}")]
    [InlineData("{\"zeilen\": []}")]
    [InlineData("[{\"Name\": \"Gouda\"}]")]
    public void No_usable_answer_gives_no_rows_and_a_reason(string answer)
    {
        var p = Check(answer);
        Assert.Empty(p.Rows);
        Assert.NotEmpty(p.Warnings);
    }

    [Fact]
    public void A_hostile_note_is_dropped_and_a_long_value_is_refused()
    {
        var p = Check("{\"rows\": [{\"Name\": \"" + new string('x', 600) + "\"}, {\"Name\": \"Ok\"}], \"notes\": \"<script>x</script>\"}");
        Assert.Single(p.Rows);
        Assert.Equal("Ok", p.Rows[0].Values["Name"]);
        Assert.Null(p.Notes);
        Assert.Contains(p.Warnings, w => w.Contains("zu lang"));
    }
}

public sealed class DataFillCheckTests
{
    private static readonly ColumnDef Target = new("Region", "Region", "text", null, null);

    private static readonly IReadOnlyDictionary<long, string> Current = new Dictionary<long, string> { [10] = "", [11] = "alt", [12] = "gleich" };

    private static FillProposal Check(string answer, ColumnDef? target = null, ImageAllowlist? images = null)
        => DataFillCheck.Check(LenientJson.FirstObject(answer), target ?? Target, Current, images ?? ImageAllowlist.Empty);

    [Fact]
    public void Good_values_come_through_with_old_and_new()
    {
        var p = Check("{\"values\": [{\"row\": 10, \"value\": \"Niederlande\"}, {\"row\": \"11\", \"value\": \"Bayern\"}, {\"row\": 12, \"value\": \"gleich\"}]}");
        Assert.Equal(2, p.Values.Count);
        Assert.Equal(new ProposedValue(10, "", "Niederlande", null), p.Values[0]);
        Assert.Equal("alt", p.Values[1].Old);
        Assert.Equal(1, p.Unchanged);
        Assert.Equal(0, p.Missing);
    }

    [Fact]
    public void Rows_that_were_not_selected_are_ignored()
    {
        var p = Check("{\"values\": [{\"row\": 999, \"value\": \"x\"}, {\"row\": 1, \"value\": \"y\"}, {\"row\": 10, \"value\": \"ok\"}]}");
        Assert.Single(p.Values);
        Assert.Equal(10, p.Values[0].RowId);
        Assert.Contains(p.Warnings, w => w.Contains("nicht ausgewählt") && w.Contains("999"));
        Assert.Equal(2, p.Missing);
    }

    [Fact]
    public void A_row_answered_twice_counts_once_and_a_missing_row_is_counted()
    {
        var p = Check("{\"values\": [{\"row\": 10, \"value\": \"a\"}, {\"row\": 10, \"value\": \"b\"}]}");
        Assert.Single(p.Values);
        Assert.Equal("a", p.Values[0].New);
        Assert.Equal(2, p.Missing);
        Assert.Contains(p.Warnings, w => w.Contains("mehrfach"));
    }

    [Fact]
    public void Empty_hostile_and_too_long_values_change_nothing()
    {
        var p = Check("{\"values\": [{\"row\": 10, \"value\": \"\"}, {\"row\": 11, \"value\": \"<script>x</script>\"}, {\"row\": 12, \"value\": \"" + new string('y', 600) + "\"}]}");
        Assert.Empty(p.Values);
        Assert.Equal(3, p.Warnings.Count);
    }

    [Fact]
    public void Entries_without_a_row_number_or_a_value_are_skipped()
    {
        var p = Check("{\"values\": [\"x\", {\"value\": \"y\"}, {\"row\": 10}, {\"row\": \"abc\", \"value\": \"z\"}]}");
        Assert.Empty(p.Values);
        Assert.True(p.Warnings.Count >= 4);
    }

    [Fact]
    public void An_image_target_takes_only_allowed_keys()
    {
        var image = new ColumnDef("Land", "Land", "image", null, "Flaggen");
        var p = Check("{\"values\": [{\"row\": 10, \"value\": \"flag-de\"}, {\"row\": 11, \"value\": \"flag-zz\"}]}", image, new ImageAllowlist(["flag-de"]));
        Assert.Single(p.Values);
        Assert.Equal("flag-de", p.Values[0].New);
        Assert.Contains(p.Warnings, w => w.Contains("flag-zz"));
    }

    [Theory]
    [InlineData("")]
    [InlineData("Ich überlege noch.")]
    [InlineData("{\"values\": {\"10\": \"x\"}}")]
    public void No_usable_answer_changes_nothing(string answer)
    {
        var p = Check(answer);
        Assert.Empty(p.Values);
        Assert.NotEmpty(p.Warnings);
    }
}

public sealed class TextSuggestCheckTests
{
    private static TextSuggestions Check(string answer, string original) => TextSuggestCheck.Check(LenientJson.FirstObject(answer), original);

    [Fact]
    public void A_suggestion_must_keep_exactly_the_placeholders()
    {
        var original = "Heute: {{Name}} für {{ Preis }} €";
        var s = Check("{\"suggestions\": [\"Unser {{Name}} nur {{Preis}} €\", \"{{Name}} ohne Preis\", \"{{Name}} {{Preis}} {{Extra}}\", \"Ohne alles\", \"Nur {{preis}} und {{NAME}}\"]}", original);
        Assert.Equal(["Unser {{Name}} nur {{Preis}} €", "Nur {{preis}} und {{NAME}}"], s.Items);
        Assert.Equal(3, s.Warnings.Count);
        Assert.All(s.Warnings, w => Assert.Contains("Platzhalter", w));
    }

    [Fact]
    public void An_original_without_placeholders_rejects_suggestions_with_some()
    {
        var s = Check("{\"suggestions\": [\"Schön {{Name}}\", \"Frisch vom Markt\"]}", "Frisch");
        Assert.Equal(["Frisch vom Markt"], s.Items);
    }

    [Fact]
    public void At_most_five_and_no_duplicates_or_the_original()
    {
        var s = Check("{\"suggestions\": [\"Original\", \"A\", \"A\", \"B\", \"C\", \"D\", \"E\", \"F\", \"G\"]}", "Original");
        Assert.Equal(["A", "B", "C", "D", "E"], s.Items);
        Assert.Contains(s.Warnings, w => w.Contains("höchstens 5"));
    }

    [Fact]
    public void Scripts_and_absurd_lengths_are_dropped()
    {
        var s = Check("{\"suggestions\": [\"<script>x</script>\", \"" + new string('a', 5001) + "\", \"<i>Fein</i>\", \"Gut\"]}", "Alt");
        Assert.Equal(["Fein", "Gut"], s.Items);
        Assert.Equal(2, s.Warnings.Count);
    }

    [Fact]
    public void Objects_with_text_and_odd_shapes_are_handled()
    {
        var s = Check("{\"suggestions\": [{\"text\": \"Aus Objekt\"}, [\"x\"], 42, null, \"\"]}", "Alt");
        Assert.Contains("Aus Objekt", s.Items);
        Assert.Contains("42", s.Items);
        Assert.Equal(2, s.Items.Count);
        Assert.Single(s.Warnings);
    }

    [Fact]
    public void Line_breaks_stay_in_a_suggestion()
        => Assert.Equal(["Zeile 1\nZeile 2"], Check("{\"suggestions\": [\"Zeile 1\\nZeile 2\"]}", "Alt").Items);

    [Theory]
    [InlineData("")]
    [InlineData("Hier sind meine Ideen: kürzer, frischer, besser.")]
    [InlineData("{\"suggestions\": \"viele\"}")]
    [InlineData("{\"vorschlaege\": [\"A\"]}")]
    public void No_usable_answer_gives_no_suggestions_and_a_reason(string answer)
    {
        var s = Check(answer, "Alt");
        Assert.Empty(s.Items);
        Assert.NotEmpty(s.Warnings);
    }

    [Fact]
    public void Json_in_a_code_fence_is_read()
        => Assert.Equal(["Neu"], Check("```json\n{\"suggestions\": [\"Neu\"]}\n```", "Alt").Items);
}
