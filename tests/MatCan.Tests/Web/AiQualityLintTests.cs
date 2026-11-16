using System.Text.Json;
using MatCan.Core.Documents;
using MatCan.Logic;

namespace MatCan.Tests.Web;

/// <summary>
/// The lint of the design assistant (<see cref="AiDesignLint"/>) and the estimate of the ink of a text (<see cref="AiTextMetrics"/>): every rule gets a document that it must catch and a document that it must leave
/// alone (hostile in the sense that the boxes say one thing and the ink another), and the library of templates must stay quiet most of the time (the lint is a heuristic with false alarms; it must not drown the
/// assistant in them). Pure functions: no database.
/// </summary>
public sealed class AiQualityLintTests
{
    private const string Centre = ", \"align\": \"center\"";

    private static string N(double v) => v.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture);

    private static DesignDocument Doc(double w, double h, string unit, string fold, params string[] elements)
    {
        var foldPart = fold == "none" ? "" : "\"fold\": \"" + fold + "\", ";
        var json = "{\"schema\": 2, \"unit\": \"" + unit + "\", \"width\": " + N(w) + ", \"height\": " + N(h) + ", \"dpi\": 300, \"locale\": \"de-DE\", " + foldPart
            + "\"fields\": [], \"pages\": [{\"id\": \"p1\", \"name\": \"\", \"background\": {\"color\": \"#ffffff\"}, \"elements\": [" + string.Join(",", elements) + "]}]}";
        var result = DocumentValidator.Validate(json);
        Assert.True(result.Ok, result.Error);
        return result.Document!;
    }

    private static string Box(string id, string type, double x, double y, double w, double h)
        => "\"id\": \"" + id + "\", \"type\": \"" + type + "\", \"name\": \"" + id + "\", \"x\": " + N(x) + ", \"y\": " + N(y) + ", \"w\": " + N(w) + ", \"h\": " + N(h);

    private static string T(string id, double x, double y, double w, double h, string text, double size = 12, string extra = "")
        => "{" + Box(id, "text", x, y, w, h) + ", \"text\": " + JsonSerializer.Serialize(text) + ", \"fontFamily\": \"Open Sans\", \"fontSize\": " + N(size) + ", \"color\": \"#111111\"" + extra + "}";

    private static string Img(string id, double x, double y, double w, double h, string key = "deko-motive-pokal")
        => "{" + Box(id, "image", x, y, w, h) + ", \"source\": {\"asset\": \"" + key + "\"}}";

    private static string Shape(string id, string shape, double x, double y, double w, double h, string extra)
        => "{" + Box(id, "shape", x, y, w, h) + ", \"shape\": \"" + shape + "\"" + extra + "}";

    private static List<LintFinding> Lint(DesignDocument d, IReadOnlyDictionary<string, string>? samples = null) => AiDesignLint.Check(d, null, samples);

    [Fact]
    public void The_ink_of_a_text_is_what_counts_not_its_box()
    {
        // two boxes that overlap, but the words are short and far apart inside them: no overlap
        var apart = Doc(210, 297, "mm", "none", T("a", 20, 100, 170, 30, "Links", 14), T("b", 20, 110, 170, 30, "Rechts", 14, ", \"align\": \"right\""));
        Assert.DoesNotContain(Lint(apart), f => f.Code == "textoverlap");
        // the same place: overlap
        var same = Doc(210, 297, "mm", "none", T("a", 20, 100, 100, 30, "Samstag", 20), T("b", 25, 104, 100, 30, "Sonntag", 20));
        Assert.Contains(Lint(same), f => f.Code == "textoverlap" && f.Serious && f.Text.Contains("überlappen"));
        // a copy of the same text a little aside is a shadow made by hand
        var shadow = Doc(210, 297, "mm", "none", T("a", 20, 100, 150, 30, "Schatten", 30), T("b", 20.6, 100.6, 150, 30, "Schatten", 30));
        Assert.DoesNotContain(Lint(shadow), f => f.Code == "textoverlap");
    }

    [Fact]
    public void A_picture_over_a_text_a_ring_through_it_and_a_line_across_it_are_found()
    {
        var over = Doc(210, 297, "mm", "none", T("t", 30, 100, 150, 20, "Dinosaurier-Party", 30), Img("p", 40, 95, 60, 40));
        Assert.Contains(Lint(over), f => f.Code == "textcover" && f.Serious && f.Text.Contains("liegt über"));
        // the picture under the text and reaching only a little into it: a layout accident, but not serious; a text that sits wholly on a plaque is fine
        var under = Doc(210, 297, "mm", "none", Img("p", 40, 95, 60, 40), T("t", 30, 100, 150, 20, "Dinosaurier-Party", 30));
        Assert.Contains(Lint(under), f => f.Code == "textcover" && !f.Serious);
        var plaque = Doc(210, 297, "mm", "none", Img("p", 20, 90, 170, 60, "deko-motive-holzschild"), T("t", 40, 110, 130, 20, "Willkommen", 24, Centre));
        Assert.DoesNotContain(Lint(plaque), f => f.Code == "textcover");
        // an ornament or a divider carries no text, even when the text lies wholly inside its box; a worn-paper texture over everything is meant
        var onOrnament = Doc(210, 297, "mm", "none", Img("o", 40, 100, 130, 40, "deko-ornamente-schnoerkel-breit-gold"), T("t", 60, 108, 90, 20, "TSV Nordheim", 20, Centre));
        Assert.Contains(Lint(onOrnament), f => f.Code == "textcover" && f.Serious);
        var texture = Doc(210, 297, "mm", "none", T("t", 60, 108, 90, 20, "TSV Nordheim", 20, Centre), Img("o", 0, 0, 210, 150, "deko-motive-verschleiss-schwarz"));
        Assert.DoesNotContain(Lint(texture), f => f.Code == "textcover");

        var ring = Doc(210, 297, "mm", "none", Shape("r", "ellipse", 75, 100, 60, 90, ", \"stroke\": \"#888888\", \"strokeWidth\": 2"), T("t", 30, 140, 150, 20, "Lena & Max", 36, Centre));
        Assert.Contains(Lint(ring), f => f.Code == "outlinecross" && f.Serious);
        var inside = Doc(210, 297, "mm", "none", Shape("r", "ellipse", 20, 80, 170, 170, ", \"stroke\": \"#888888\", \"strokeWidth\": 2"), T("t", 60, 150, 90, 20, "Lena & Max", 24, Centre));
        Assert.DoesNotContain(Lint(inside), f => f.Code == "outlinecross");

        var line = Doc(210, 297, "mm", "none", T("t", 30, 140, 150, 20, "Mittendurch", 30), Shape("l", "line", 20, 120, 170, 70, ", \"stroke\": \"#444444\""));
        Assert.Contains(Lint(line), f => f.Code == "linecross" && f.Serious);
        var rule = Doc(210, 297, "mm", "none", T("t", 30, 140, 150, 20, "Unterstrichen", 30), Shape("l", "line", 30, 158, 150, 0.01, ", \"stroke\": \"#444444\""));
        Assert.DoesNotContain(Lint(rule), f => f.Code == "linecross");

        // a filled shape drawn over a text hides it; the same shape under the text is a plate
        var cover = Doc(210, 297, "mm", "none", T("t", 30, 140, 150, 20, "Verdeckt", 30), Shape("s", "rect", 20, 130, 170, 40, ", \"fill\": \"#ffcc00\""));
        Assert.Contains(Lint(cover), f => f.Code == "shapecover" && f.Serious);
        var plate = Doc(210, 297, "mm", "none", Shape("s", "rect", 20, 130, 170, 40, ", \"fill\": \"#ffcc00\""), T("t", 30, 140, 150, 20, "Auf der Platte", 30));
        Assert.DoesNotContain(Lint(plate), f => f.Code == "shapecover");
    }

    [Fact]
    public void A_text_that_runs_out_of_its_box_or_the_page_margin_or_over_the_fold_is_found()
    {
        var overflow = Doc(105, 148, "mm", "none", T("t", 10, 10, 40, 8, "Das ist ein ziemlich langer Satz der nicht passt", 14));
        Assert.Contains(Lint(overflow), f => f.Code == "overflow" && f.Serious);
        var shrink = Doc(105, 148, "mm", "none", T("t", 10, 10, 40, 8, "Das ist ein ziemlich langer Satz der nicht passt", 14, ", \"fit\": \"shrink\""));
        Assert.DoesNotContain(Lint(shrink), f => f.Code == "overflow");

        var edge = Doc(105, 148, "mm", "none", T("t", 1, 10, 60, 10, "Am Rand", 14));
        Assert.Contains(Lint(edge), f => f.Code == "margin" && f.Serious && f.Text.Contains("4 mm"));
        var fine = Doc(105, 148, "mm", "none", T("t", 6, 10, 60, 10, "Mit Abstand", 14));
        Assert.DoesNotContain(Lint(fine), f => f.Code == "margin");
        var a4 = Doc(210, 297, "mm", "none", T("t", 6, 10, 100, 10, "A4 braucht zehn", 14));
        Assert.Contains(Lint(a4), f => f.Code == "margin" && f.Text.Contains("10 mm"));
        var screen = Doc(1080, 1080, "px", "none", T("t", 10, 10, 600, 60, "Bildschirm", 30));
        Assert.Contains(Lint(screen), f => f.Code == "margin");

        var card = Doc(210, 148, "mm", "vertical", T("t", 60, 50, 90, 20, "Über dem Falz", 20, Centre));
        Assert.Contains(Lint(card), f => f.Code == "fold" && f.Serious);
        var half = Doc(210, 148, "mm", "vertical", T("t", 115, 50, 80, 20, "Rechts davon", 20));
        Assert.DoesNotContain(Lint(half), f => f.Code == "fold");
    }

    [Fact]
    public void Text_that_is_too_small_for_the_physical_size_is_found()
    {
        Assert.Contains(Lint(Doc(105, 148, "mm", "none", T("t", 10, 10, 80, 10, "Winzig", 5))), f => f.Code == "small" && f.Serious && f.Text.Contains("zu klein"));
        Assert.DoesNotContain(Lint(Doc(105, 148, "mm", "none", T("t", 10, 10, 80, 10, "Gerade so", 7.5))), f => f.Code == "small");
        // a screen needs 15 pt
        Assert.Contains(Lint(Doc(1080, 1080, "px", "none", T("t", 60, 60, 900, 100, "Klein am Bildschirm", 12))), f => f.Code == "small");
    }

    [Fact]
    public void A_big_empty_area_an_empty_page_and_a_flat_hierarchy_are_found()
    {
        var onlyTitle = Doc(210, 297, "mm", "none", T("t", 20, 20, 170, 30, "Nur eine Zeile", 40));
        Assert.Contains(Lint(onlyTitle), f => f.Code == "emptyarea" && f.Serious && f.Text.Contains("leer"));
        var filled = Doc(210, 297, "mm", "none",
            T("a", 20, 20, 170, 30, "Sommerfest", 60, Centre), Img("p", 40, 70, 130, 100),
            T("b", 20, 185, 170, 15, "Samstag, 12. Juni 2027", 28, Centre), T("c", 20, 205, 170, 12, "Ab 15 Uhr im Vereinsheim", 20, Centre),
            T("d", 20, 230, 170, 12, "Kaffee, Kuchen und Musik", 18, Centre), T("e", 20, 265, 170, 10, "Rückmeldung unter 07131 123456", 14, Centre));
        Assert.DoesNotContain(Lint(filled), f => f.Code is "emptyarea" or "sparse" or "empty");

        Assert.Contains(Lint(Doc(210, 297, "mm", "none")), f => f.Code == "empty");
        // a folded card may keep a half empty for the handwriting
        Assert.DoesNotContain(Lint(Doc(210, 148, "mm", "vertical", T("a", 115, 50, 80, 20, "Innen rechts", 20))), f => f.Code is "emptyarea" or "sparse");

        var flat = Doc(210, 297, "mm", "none", T("a", 20, 20, 170, 10, "Eins", 14), T("b", 20, 60, 170, 10, "Zwei", 14), T("c", 20, 100, 170, 10, "Drei", 15), T("d", 20, 140, 170, 10, "Vier", 14));
        Assert.Contains(Lint(flat), f => f.Code == "hierarchy" && !f.Serious);
    }

    [Fact]
    public void Dummy_texts_and_the_sample_texts_of_a_template_are_found()
    {
        var dummy = Doc(210, 297, "mm", "none", T("a", 20, 20, 170, 30, "Musterstadt, Musterstraße 5", 20));
        Assert.Contains(Lint(dummy), f => f.Code == "dummy" && f.Serious);
        var real = Doc(210, 297, "mm", "none", T("a", 20, 20, 170, 30, "Heilbronn, Marktplatz 4", 20));
        Assert.DoesNotContain(Lint(real), f => f.Code == "dummy");

        var samples = new Dictionary<string, string> { ["a"] = "Samstag, 12. Juni 2027" };
        var untouched = Doc(210, 297, "mm", "none", T("a", 20, 20, 170, 30, "Samstag, 12. Juni 2027", 20));
        Assert.Contains(Lint(untouched, samples), f => f.Code == "sample" && f.Serious && f.Text.Contains("Beispieltext"));
        var changed = Doc(210, 297, "mm", "none", T("a", 20, 20, 170, 30, "Sonntag, 13. Juni 2027", 20));
        Assert.DoesNotContain(Lint(changed, samples), f => f.Code == "sample");
        Assert.DoesNotContain(Lint(untouched), f => f.Code == "sample");   // only when the run knows what the template brought
    }

    [Fact]
    public void A_background_that_bleeds_off_the_page_is_not_serious_but_a_text_that_does_is()
    {
        var bleed = Doc(210, 297, "mm", "none", Shape("s", "ellipse", -60, -60, 150, 150, ", \"fill\": \"#ffcc00\""), T("t", 100, 100, 90, 20, "Text", 20));
        var cut = Lint(bleed).Where(f => f.Code == "cut").ToList();
        Assert.NotEmpty(cut);
        Assert.All(cut, f => Assert.False(f.Serious));
        var textCut = Doc(210, 297, "mm", "none", T("t", 150, 100, 150, 20, "Text läuft raus", 20));
        Assert.Contains(Lint(textCut), f => f.Code == "cut" && f.Serious);
    }

    [Fact]
    public void The_text_metrics_wrap_shrink_align_and_turn_like_the_engine()
    {
        var doc = Doc(210, 297, "mm", "none", T("a", 20, 20, 60, 40, "Ein Text der über mehrere Zeilen umbrochen werden muss weil er breit ist", 14));
        var text = (TextElement)doc.Pages[0].Elements[0];
        var ink = AiTextMetrics.Measure(text, "mm", doc.Fields);
        Assert.True(ink.Lines >= 3);
        Assert.True(ink.Ink.W <= 60.01 && ink.Ink.X >= 20);
        Assert.False(ink.Shrunk);
        var shrink = AiTextMetrics.Measure(text with { Fit = "shrink", H = 10 }, "mm", doc.Fields);
        Assert.True(shrink.Shrunk && shrink.SizePt < 14);
        var centred = AiTextMetrics.Measure(text with { Text = "Kurz", Align = "center", Valign = "middle" }, "mm", doc.Fields);
        Assert.InRange(centred.Ink.CentreX, 49, 51);
        Assert.InRange(centred.Ink.CentreY, 38, 42);
        var turned = AiTextMetrics.Measure(text with { Text = "Gedreht", Rotation = 90, W = 80, H = 10 }, "mm", doc.Fields);
        Assert.True(turned.Ink.H > turned.Ink.W);
        // placeholders count with the sample of their field
        var withField = DocumentValidator.Validate("""{"schema": 2, "unit": "mm", "width": 100, "height": 100, "dpi": 300, "locale": "de-DE", "fields": [{"key": "Name", "label": "Name", "type": "text", "sample": "Maximiliane Schneider-Hohenstein"}], "pages": [{"id": "p1", "name": "", "background": {"color": "#ffffff"}, "elements": [{"id": "e1", "type": "text", "x": 5, "y": 5, "w": 90, "h": 10, "text": "{{Name}}", "fontFamily": "Open Sans", "fontSize": 20}]}]}""").Document!;
        var longName = AiTextMetrics.Measure((TextElement)withField.Pages[0].Elements[0], "mm", withField.Fields);
        Assert.True(longName.Ink.W > 60);
    }

    [Fact]
    public void A_professional_template_stays_quiet_most_of_the_time()
    {
        var all = TemplateFiles.All();
        var noisy = 0;
        foreach (var t in all)
        {
            var v = DocumentValidator.Validate(t.Document.ToJsonString());
            Assert.True(v.Ok, t.Slug);
            // the sample texts of a template ("Musterstadt") are no findings of the library, they are what the assistant has to replace
            if (AiDesignLint.Check(v.Document!).Any(f => f.Serious && f.Code != "dummy"))
            {
                noisy++;
            }
        }

        // the lint is a heuristic with false alarms (a deliberate bleed, a plaque behind text); the library must not drown in them
        Assert.True(noisy <= all.Count * 0.2, $"{noisy} of {all.Count} templates have serious findings");
    }
}
