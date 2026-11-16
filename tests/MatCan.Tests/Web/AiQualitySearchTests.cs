using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using MatCan.Core.Documents;
using MatCan.Logic;
using MatCan.Tests.Core;

namespace MatCan.Tests.Web;

/// <summary>
/// The search of the design assistant over the templates and over the Deko pack, the words it works with, the metrics of the fonts and the guide (docs/PLAN-AI-DESIGN.md "Quality pass"). Pure functions over the
/// files of the repository: the real library of templates and the real pack, no database. A theme that the pack cannot illustrate is a hole the assistant fills with circles, so the test names the themes.
/// </summary>
public sealed class AiQualitySearchTests
{
    [Fact]
    public void Words_are_folded_and_the_filler_words_of_a_request_are_dropped()
    {
        Assert.Equal(["einladung", "dinosaurier", "geburtstag"], AiSearchText.Tokens("Mach mir eine Einladung für einen Dinosaurier-Geburtstag!"));
        Assert.Equal(["grusskarte", "oma"], AiSearchText.Tokens("Grußkarte für Oma"));
        Assert.Equal(["hochzeit", "wasser"], AiSearchText.Tokens("Hochzeit Wasser Hochzeit"));
        Assert.Empty(AiSearchText.Tokens("   "));
        Assert.Empty(AiSearchText.Tokens(null));
        Assert.True(AiSearchText.Tokens(string.Join(' ', Enumerable.Range(0, 200).Select(i => "wort" + i))).Count <= 12);
    }

    [Theory]
    [InlineData("dino", "dinosaurier", 0.8)]
    [InlineData("karten", "karte", 0.9)]
    [InlineData("party", "kinderparty", 0.5)]
    [InlineData("hochzeit", "hochzeit", 1.0)]
    [InlineData("dino", "disco", 0.0)]
    [InlineData("ab", "abend", 0.0)]
    public void A_word_fits_another_by_the_same_stem_a_start_or_containment(string token, string word, double expected)
        => Assert.Equal(expected, AiSearchText.Quality(token, [word]));

    [Fact]
    public void Every_bundled_font_has_metrics_and_a_mood_and_the_widths_are_plausible()
    {
        var fonts = JsonSerializer.Deserialize<List<JsonElement>>(File.ReadAllText(Path.Combine(RepoFiles.WwwRoot(), "fonts", "fonts.json")))!;
        foreach (var family in fonts.Select(f => f.GetProperty("family").GetString()!).Distinct())
        {
            Assert.True(AiFontMetrics.Knows(family), "no metrics for " + family);
            Assert.True(AiDesignGuide.Moods.ContainsKey(family), "no mood for " + family);
        }

        // ten letters of a plain sans serif are about five em wide, a condensed face is narrower
        Assert.InRange(AiFontMetrics.WidthEm("Open Sans", 400, "abcdefghij", false, 0), 4.5, 5.8);
        Assert.True(AiFontMetrics.WidthEm("Bebas Neue", 400, "ABCDEFGHIJ", true, 0) < AiFontMetrics.WidthEm("Montserrat", 400, "ABCDEFGHIJ", true, 0));
        Assert.True(AiFontMetrics.WidthEm("Open Sans", 700, "Hallo Welt", false, 0) > AiFontMetrics.WidthEm("Open Sans", 400, "Hallo Welt", false, 0));
        Assert.True(AiFontMetrics.WidthEm("Open Sans", 400, "abc", false, 0.1) > AiFontMetrics.WidthEm("Open Sans", 400, "abc", false, 0));
        Assert.True(AiFontMetrics.WidthEm("eine-hochgeladene-schrift", 400, "abc", false, 0) > 0);   // an unknown family has the numbers of a plain sans serif
    }

    [Fact]
    public void The_type_scale_follows_the_size_of_the_format()
    {
        var card = AiDesignGuide.TypeScale(85, 55, "mm");
        var a6 = AiDesignGuide.TypeScale(148, 105, "mm");
        var a4 = AiDesignGuide.TypeScale(210, 297, "mm");
        var poster = AiDesignGuide.TypeScale(297, 420, "mm");
        var post = AiDesignGuide.TypeScale(1080, 1080, "px");
        Assert.True(card.TitleMax < a6.TitleMax && a6.TitleMax < a4.TitleMax && a4.TitleMax < poster.TitleMax);
        foreach (var s in new[] { card, a6, a4, poster, post })
        {
            Assert.True(s.TitleMin < s.TitleMax && s.SubMin <= s.SubMax && s.BodyMin <= s.BodyMax, s.ToString());
            Assert.True(s.SubMax <= s.TitleMax);
        }

        Assert.Equal(7, card.Floor);
        Assert.Equal(15, post.Floor);
        var text = AiDesignGuide.FormatText(210, 148, "mm", "vertical");
        Assert.Contains("Sicherheitsrand für Text: 4 mm", text);
        Assert.Contains("Klappkarte", text);
        Assert.Contains("Sicherheitsrand für Text: 10 mm", AiDesignGuide.FormatText(210, 297, "mm", "none"));
        Assert.Contains("px", AiDesignGuide.FormatText(1080, 1080, "px", "none"));
    }

    // ------------------------------------------------------------------------------------------------ the templates

    private static List<DesignRow> Rows() => [.. TemplateFiles.All().Select(t => t.Row)];

    [Fact]
    public void The_owners_prompts_find_the_template_that_fits()
    {
        var all = Rows();
        var (dino, _) = AiTemplateSearch.Rank(all, "Einladung Kindergeburtstag Dinosaurier", null, null, 8);
        Assert.Equal("Kindergeburtstag – Dino", dino[0].Row.Name);
        Assert.Equal("gut", dino[0].Quality);

        // names, places and dates are no words of any template: the search ignores them
        var (named, _) = AiTemplateSearch.Rank(all, "Einladung für Alex wird 9 Dinosaurier-Party in Brackenheim", null, null, 5);
        Assert.Contains(named, h => h.Row.Name == "Kindergeburtstag – Dino");

        var (boho, _) = AiTemplateSearch.Rank(all, "Hochzeitseinladung im Boho-Stil", null, null, 8);
        Assert.All(boho.Take(4), h => Assert.Equal("Hochzeit", h.Row.TemplateOccasion));
        Assert.Contains(boho.Take(4), h => (h.Row.Name + h.Row.TemplateTags + h.Row.TemplateVariant).Contains("Boho", StringComparison.OrdinalIgnoreCase));

        var (card, _) = AiTemplateSearch.Rank(all, "Visitenkarte", null, null, 8);
        Assert.Equal("business-card", card[0].Row.TemplateFormat);

        var (insta, _) = AiTemplateSearch.Rank(all, "Instagram Post Café Angebot", null, null, 8);
        Assert.Equal("instagram-post", insta[0].Row.TemplateFormat);

        var (space, _) = AiTemplateSearch.Rank(all, "Einladung Weltall Geburtstag", null, null, 6);
        Assert.Contains(space, h => h.Row.Name.Contains("Weltall", StringComparison.OrdinalIgnoreCase));

        var (price, _) = AiTemplateSearch.Rank(all, "Preisschild Käse", null, null, 6);
        Assert.Contains(price.Take(3), h => h.Row.TemplateOccasion == "Handel & Preise");
    }

    [Fact]
    public void The_search_narrows_by_occasion_and_format_and_says_when_it_cannot()
    {
        var all = Rows();
        var (wedding, _) = AiTemplateSearch.Rank(all, "Einladung", "Hochzeit", null, 12);
        Assert.All(wedding, h => Assert.Equal("Hochzeit", h.Row.TemplateOccasion));
        var (folded, _) = AiTemplateSearch.Rank(all, "Einladung", null, "card-a6-portrait", 12);
        Assert.All(folded, h => Assert.Equal("card-a6-portrait", h.Row.TemplateFormat));
        var (words, _) = AiTemplateSearch.Rank(all, "Danke", null, "Klappkarte", 12);
        Assert.NotEmpty(words);
        Assert.All(words, h => Assert.Contains("Klapp", FormatPresets.Find(h.Row.TemplateFormat)!.Name + FormatPresets.Find(h.Row.TemplateFormat)!.Group, StringComparison.OrdinalIgnoreCase));

        var (wrongOccasion, note) = AiTemplateSearch.Rank(all, "Einladung", "Weltraumreise", null, 5);
        Assert.NotEmpty(wrongOccasion);
        Assert.Contains("Anlass", note);
        var (wrongFormat, formatNote) = AiTemplateSearch.Rank(all, "Einladung", null, "Zeppelin", 5);
        Assert.NotEmpty(wrongFormat);
        Assert.Contains("Format", formatNote);

        // nothing known: an empty list and a hint, no exception
        var (none, hint) = AiTemplateSearch.Rank(all, "qqqqzzzz xxyyxx", null, null, 5);
        Assert.Empty(none);
        Assert.False(string.IsNullOrEmpty(hint));
        var (plain, plainNote) = AiTemplateSearch.Rank(all, "", null, null, 5);
        Assert.Equal(5, plain.Count);
        Assert.Contains("Beispiele", plainNote);
    }

    [Fact]
    public void The_search_lists_a_few_variants_of_one_family_and_never_more_than_asked()
    {
        var all = Rows();
        var (hits, _) = AiTemplateSearch.Rank(all, "Geburtstag Kinder Einladung Karte", null, null, 12);
        Assert.InRange(hits.Count, 1, 12);
        Assert.All(hits.GroupBy(h => h.Row.TemplateFamily), g => Assert.InRange(g.Count(), 1, AiTemplateSearch.MaxPerFamily));
        Assert.Equal(3, AiTemplateSearch.Rank(all, "Einladung", null, null, 3).Hits.Count);
        Assert.True(AiTemplateSearch.Rank(all, "Einladung", null, null, 1000).Hits.Count <= AiTemplateSearch.MaxLimit);
        // a hostile question: a very long text, a regular expression, SQL, control characters, wildcards
        foreach (var q in new[] { new string('a', 5000), "(.*)+$[", "'; DROP TABLE \"Design\"; --", "\u0000\u0007 Einladung \n\r", "%_\\", string.Join(' ', Enumerable.Repeat("Einladung", 400)) })
        {
            var (result, _) = AiTemplateSearch.Rank(all, q, q, q, 8);
            Assert.True(result.Count <= 8);
        }
    }

    [Fact]
    public void A_template_is_described_in_words()
    {
        var dino = TemplateFiles.All().First(t => t.Row.Name == "Kindergeburtstag – Dino");
        var text = AiTemplateSearch.Layout(dino.Document);
        Assert.Contains("Hintergrund #", text);
        Assert.Contains("Texte:", text);
        Assert.Contains("Fredoka", text);
        Assert.Contains("pt)", text);
        Assert.Contains("Bilder/Deko:", text);
        Assert.Contains("Felder: Name, Alter", text);
        Assert.InRange(text.Length, 150, 1200);
        Assert.Equal("", AiTemplateSearch.Layout(new JsonObject { ["pages"] = new JsonArray() }));
    }

    // ------------------------------------------------------------------------------------------------ the Deko pack

    private static List<AiDekoSearch.Piece> Deko()
    {
        var root = Path.Combine(RepoFiles.WwwRoot(), "builtin");
        var all = JsonSerializer.Deserialize<List<JsonElement>>(File.ReadAllText(Path.Combine(root, "builtin.json")))!;
        var pieces = new List<AiDekoSearch.Piece>();
        foreach (var e in all.Where(e => e.GetProperty("category").GetString() == "Deko"))
        {
            var svg = File.ReadAllText(Path.Combine(root, e.GetProperty("file").GetString()!));
            var m = Regex.Match(svg[..Math.Min(300, svg.Length)], @"viewBox=""0 0 (\d+) (\d+)""");
            pieces.Add(new AiDekoSearch.Piece(e.GetProperty("key").GetString()!, e.GetProperty("name").GetString()!, string.Join(", ", e.GetProperty("tags").EnumerateArray().Select(x => x.GetString())), int.Parse(m.Groups[1].Value), int.Parse(m.Groups[2].Value)));
        }

        return pieces;
    }

    [Fact]
    public void The_deko_pack_is_found_by_theme_and_colour_variants_are_one_result()
    {
        var pieces = Deko();
        var (cars, _) = AiDekoSearch.Search(pieces, "Rennauto", null, null, 5);
        Assert.Contains(cars, d => d.Key == "deko-motive-rennwagen");
        var (crown, _) = AiDekoSearch.Search(pieces, "Krone", null, null, 8);
        Assert.Contains(crown.Take(4), d => d.Title.Contains("krone", StringComparison.OrdinalIgnoreCase));

        var (frames, _) = AiDekoSearch.Search(pieces, "Rahmen Doppellinie", "Rahmen", null, 10);
        Assert.All(frames, d => Assert.Equal("Rahmen", d.Group));
        var doubleLine = frames.First(d => d.Title.Contains("Doppellinie hoch", StringComparison.Ordinal));
        Assert.True(doubleLine.Colours.Count >= 3);
        Assert.Contains("gold", doubleLine.Colours.Keys);
        Assert.Equal(frames.Count, frames.Select(d => d.Group + d.Title).Distinct().Count());   // one result per drawing, not one per colour

        var (gold, _) = AiDekoSearch.Search(pieces, "Rahmen Doppellinie hoch", "Rahmen", "gold", 3);
        Assert.EndsWith("-gold", gold[0].Key);
        Assert.InRange(gold[0].Ratio, 0.6, 0.8);   // hoch: 1000 x 1414

        var (limited, _) = AiDekoSearch.Search(pieces, "", null, null, 7);
        Assert.Equal(7, limited.Count);
        Assert.True(AiDekoSearch.Search(pieces, "", null, null, 5000).Drawings.Count <= AiDekoSearch.MaxLimit);
        Assert.Contains("Motive", AiDekoSearch.Groups(pieces));

        var (nothing, note) = AiDekoSearch.Search(pieces, "xyzzyqq", null, null, 5);
        Assert.Empty(nothing);
        Assert.Contains("create_svg", note);
        var (badGroup, groupNote) = AiDekoSearch.Search(pieces, "Krone", "Gibtsnicht", null, 3);
        Assert.NotEmpty(badGroup);
        Assert.Contains("Gruppe", groupNote);
        foreach (var q in new[] { new string('x', 4000), "(.*)+$[", "'; --", "\u0000" })
        {
            Assert.True(AiDekoSearch.Search(pieces, q, q, q, 5).Drawings.Count <= 5);
        }
    }

    [Fact]
    public void The_pack_can_illustrate_the_themes_people_ask_for()
    {
        // a theme without a drawing in the pack is a hole: the assistant would draw circles instead
        var pieces = Deko();
        foreach (var (query, needle) in new[]
        {
            ("Dinosaurier", "dino"), ("Trampolin", "trampolin"), ("Rennwagen", "rennwagen"), ("Krone", "krone"), ("Schloss", "schloss"), ("Eule", "eule"), ("Pferd", "pferd"), ("Gitarre", "gitarre"), ("Ballons", "ballon"), ("Torte", "torte"),
        })
        {
            var (hits, _) = AiDekoSearch.Search(pieces, query, null, null, 6);
            Assert.True(hits.Take(4).Any(d => (d.Key + d.Title).Contains(needle, StringComparison.OrdinalIgnoreCase)), $"nothing for {query}: " + string.Join(", ", hits.Select(h => h.Key)));
        }
    }
}
