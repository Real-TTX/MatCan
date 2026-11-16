using System.Globalization;
using System.Text.RegularExpressions;
using MatCan.Core.Documents;

namespace MatCan.Logic;

/// <summary>One thing the lint found: a code (for tests and for the final check), the sentence for the model (German, with the id of the element) and whether it makes the result bad enough that the model must fix it before it says it is done.</summary>
public sealed partial record LintFinding(string Code, string Text, bool Serious)
{
    [GeneratedRegex(@"\((?![^)]*\be\d+\b)[^)]*\)")]
    private static partial Regex Parenthesis();

    [GeneratedRegex(@"\d+([.,]\d+)?(?= ?(%|mm|px|pt|Zeile))")]
    private static partial Regex Measure();

    /// <summary>What identifies the finding when the numbers in its sentence change (a percentage, a size, the box of an empty area): the code and the sentence without them. The review compares by this, so a problem that was there before the run is the same problem after it.</summary>
    public string Key => Code + "|" + Measure().Replace(Parenthesis().Replace(Text, ""), "#");
}

/// <summary>
/// What the design assistant is told after every write, besides what the validator fixed: what a person sees at a glance and a model does not (it cannot see unless it uses <c>look</c>). The checks work on the
/// estimated ink of the texts (<see cref="AiTextMetrics"/>), not only on boxes: an element outside the page or cut off by more than a fifth, text that overlaps text, a picture, a symbol, a line or a frame
/// (or is covered by a shape), text that runs out of its box, too close to the edge or across the fold of a card, text that is too small for the physical size, too little contrast (solid colours only), a big
/// empty area of the page, a weak hierarchy, an image frame without an image, texts that are still the example text of a template or an obvious dummy ("Musterstadt"), a placeholder without a field or a field nobody
/// uses, more than three font families. Pure functions over the typed document; a finding is a sentence in German with the id of the element. The thresholds were chosen by running the checks over the whole library
/// of templates (a professional template must stay quiet; see <c>AiDesignLintTests</c>).
/// </summary>
public static partial class AiDesignLint
{
    public const double MinContrast = 3;
    public const int MaxFamilies = 3;

    /// <summary>The smallest readable text at the physical size: 7 pt on paper, 15 pt on a screen (the rule of the template lint).</summary>
    public static double MinFontPt(DesignDocument d) => d.Unit == "px" ? 15 : 7;

    /// <summary>The safe margin of a page or a panel of a folded card: 4 mm below A4, 10 mm from A4 up, 3.5 % of the shorter side on a screen.</summary>
    public static double SafeMargin(DesignDocument d, double panelWidth, double panelHeight)
        => d.Unit == "px" ? 0.035 * Math.Min(d.Width, d.Height) : panelWidth * panelHeight >= 56000 ? 10 : 4;

    /// <summary>The warnings for the pages with these ids (null = every page) and for the document as a whole, as sentences.</summary>
    public static List<string> Run(DesignDocument document, IReadOnlyCollection<string>? pageIds = null)
        => [.. Check(document, pageIds).Select(f => f.Text)];

    /// <summary>
    /// The findings for the pages with these ids (null = every page) and for the document as a whole. With <paramref name="templateTexts"/> (element id to the text a template brought) the final check also says
    /// which of those texts are still unchanged.
    /// </summary>
    public static List<LintFinding> Check(DesignDocument document, IReadOnlyCollection<string>? pageIds = null, IReadOnlyDictionary<string, string>? templateTexts = null)
    {
        var findings = new List<LintFinding>();
        for (var index = 0; index < document.Pages.Count; index++)
        {
            var page = document.Pages[index];
            if (pageIds is not null && !pageIds.Contains(page.Id))
            {
                continue;
            }

            LintPage(document, page, index + 1, templateTexts, findings);
        }

        LintFields(document, findings);
        LintFamilies(document, findings);
        return findings;
    }

    private static string Label(DesignElement e)
    {
        var name = e.Name.Trim();
        if (name.Length > 0)
        {
            return $"„{Clip(name, 30)}“ ({e.Id})";
        }

        return e is TextElement t && t.Text.Trim().Length > 0 ? $"„{Clip(t.Text.Replace('\n', ' ').Trim(), 30)}“ ({e.Id})" : $"{e.Type} {e.Id}";
    }

    private static string Clip(string text, int max) => text.Length <= max ? text : text[..max] + "…";

    private static string N(double value) => value.ToString("0.#", CultureInfo.InvariantCulture);

    /// <summary>The axis-aligned box around the rotated element.</summary>
    private static Box BoxOf(DesignElement e) => new Box(e.X, e.Y, e.W, e.H).Rotated(e.Rotation, e.X + (e.W / 2), e.Y + (e.H / 2));

    /// <summary>The elements of a page in drawing order (bottom first), the children of a group in the place of the group.</summary>
    private static List<DesignElement> Flat(IEnumerable<DesignElement> list)
    {
        var result = new List<DesignElement>();
        foreach (var e in list)
        {
            if (e is GroupElement g)
            {
                result.AddRange(Flat(g.Children));
            }
            else
            {
                result.Add(e);
            }
        }

        return result;
    }

    // dummy texts a model (or a template) leaves behind
    [GeneratedRegex(@"\b(Musterstadt|Mustermann|Musterfrau|Musterstraße|Musterstrasse|Lorem ipsum|Beispieltext|Beispielstadt|Ihre Firma|Dein Text hier|Text hier|Name hier|XXX+|TODO)\b", RegexOptions.IgnoreCase)]
    private static partial Regex DummyText();

    private static void LintPage(DesignDocument document, DesignPage page, int number, IReadOnlyDictionary<string, string>? templateTexts, List<LintFinding> findings)
    {
        var flat = Flat(page.Elements);
        var pageBox = new Box(0, 0, document.Width, document.Height);
        var minPt = MinFontPt(document);
        foreach (var e in flat)
        {
            if (e.Hidden)
            {
                continue;
            }

            // outside the page
            var box = BoxOf(e);
            if (box.Area > 0)
            {
                var covers = box.X <= 0 && box.Y <= 0 && box.Right >= pageBox.Right && box.Bottom >= pageBox.Bottom;
                var inside = box.Overlap(pageBox) / box.Area;
                if (!covers && inside <= 0)
                {
                    findings.Add(new("outside", $"{Label(e)} liegt ganz außerhalb von Seite {number}.", true));
                }
                else if (!covers && inside < 0.8)
                {
                    var cutSerious = e is TextElement or IconElement or QrElement or BarcodeElement;   // a picture or a shape that bleeds off the page is a normal way to draw a background
                    findings.Add(new("cut", $"{Label(e)} ragt zu {Math.Round((1 - inside) * 100):0} % aus Seite {number} heraus.", cutSerious));
                }
            }

            switch (e)
            {
                case TextElement text when text.FontSize < minPt && text.Text.Trim().Length > 0:
                    findings.Add(new("small", $"{Label(e)}: {N(text.FontSize)} pt sind zu klein; lesbar ist ab {minPt:0} pt.", true));
                    break;
                case ImageElement { Source: null }:
                    findings.Add(new("frame", $"Der Bildrahmen {Label(e)} hat kein Bild: setze eine source oder lösche ihn.", false));
                    break;
            }
        }

        var texts = flat.Where(t => t is TextElement { Hidden: false, W: > 0, H: > 0 } te && te.Text.Trim().Length > 0).Cast<TextElement>().ToList();
        var inks = texts.ToDictionary(t => t, t => AiTextMetrics.Measure(t, document.Unit, document.Fields));

        // text that runs out of its box
        foreach (var text in texts)
        {
            var ink = inks[text];
            if (ink.Overflows && text.Fit != "shrink" && findings.Count(f => f.Code == "overflow") < 4)
            {
                findings.Add(new("overflow", $"{Label(text)} läuft über seinen Kasten hinaus (geschätzt {ink.Lines} Zeile{(ink.Lines == 1 ? "" : "n")} bei {N(text.FontSize)} pt): mach den Kasten größer, kürze den Text oder setze fit auf \"shrink\".", true));
            }
        }

        LintPlacement(document, page, number, texts, inks, findings);
        LintOverlaps(document, page, number, flat, texts, inks, findings);
        LintEmptiness(document, page, number, flat, inks, findings);
        LintHierarchy(document, page, number, texts, inks, findings);

        // texts that are dummies or the sample of a template that was never replaced
        var dummy = 0;
        foreach (var text in texts)
        {
            if (DummyText().Match(text.Text) is { Success: true } hit && dummy++ < 4)
            {
                findings.Add(new("dummy", $"{Label(text)} enthält einen Platzhalter-Text („{hit.Value}“): ersetze ihn durch eine echte Angabe oder lösche ihn.", true));
            }
            else if (templateTexts is not null && templateTexts.TryGetValue(text.Id, out var original) && string.Equals(original.Trim(), text.Text.Trim(), StringComparison.Ordinal) && findings.Count(f => f.Code == "sample") < 6)
            {
                findings.Add(new("sample", $"{Label(text)} ist noch der Beispieltext der Vorlage („{Clip(original.Replace('\n', ' '), 40)}“): ersetze ihn durch den Inhalt der Person oder lösche ihn, wenn er nicht gebraucht wird.", true));
            }
        }

        // contrast of a text against what is behind it
        foreach (var text in texts)
        {
            var behind = BackgroundBehind(page, flat, text, inks[text].Ink);
            if (behind is null)
            {
                continue;
            }

            var ratio = Contrast(text.Color, behind);
            if (ratio is { } r && r < MinContrast)
            {
                findings.Add(new("contrast", $"{Label(text)}: Kontrast zum Hintergrund nur {r.ToString("0.0", CultureInfo.InvariantCulture)}:1 (mindestens {MinContrast:0}:1), die Schrift ist schlecht lesbar.", r < 2.0));
            }
        }
    }

    // ------------------------------------------------------------------------------------------------ margin, fold

    private static void LintPlacement(DesignDocument document, DesignPage page, int number, List<TextElement> texts, Dictionary<TextElement, TextInk> inks, List<LintFinding> findings)
    {
        var panels = Panels(document);
        var margins = 0;
        foreach (var text in texts)
        {
            var ink = inks[text].Ink;
            if (ink.W <= 0 || ink.H <= 0 || text.Curve != 0)
            {
                continue;
            }

            var panel = panels.FirstOrDefault(p => ink.CentreX >= p.X && ink.CentreX <= p.Right && ink.CentreY >= p.Y && ink.CentreY <= p.Bottom);
            if (panel.W <= 0)
            {
                panel = panels[0];
            }

            var margin = SafeMargin(document, panel.W, panel.H);
            var worst = Math.Min(Math.Min(ink.X - panel.X, panel.Right - ink.Right), Math.Min(ink.Y - panel.Y, panel.Bottom - ink.Bottom));
            // beyond the page is reported as "outside"; here: inside, but too close (a tolerance for the estimate of the width)
            if (worst < margin - 1.0 && worst > -ink.W && margins++ < 3 && !(ink.Right < 0 || ink.X > document.Width || ink.Bottom < 0 || ink.Y > document.Height))
            {
                findings.Add(new("margin", $"{Label(text)}: nur {N(Math.Max(0, worst))} {document.Unit} Abstand zum Rand{(panels.Count > 1 ? " (dieser Hälfte der Karte)" : "")}; halte mindestens {N(margin)} {document.Unit} ein, sonst wird der Text beim Schneiden oder Drucken abgeschnitten.", true));
            }

            if (document.Fold == "vertical" && ink.X < (document.Width / 2) - 0.5 && ink.Right > (document.Width / 2) + 0.5)
            {
                findings.Add(new("fold", $"{Label(text)} liegt über dem Falz der Karte (die Mitte bei x = {N(document.Width / 2)}): setze den Text in eine Hälfte.", true));
            }

            if (document.Fold == "horizontal" && ink.Y < (document.Height / 2) - 0.5 && ink.Bottom > (document.Height / 2) + 0.5)
            {
                findings.Add(new("fold", $"{Label(text)} liegt über dem Falz der Karte (die Mitte bei y = {N(document.Height / 2)}): setze den Text in eine Hälfte.", true));
            }
        }
    }

    private static List<Box> Panels(DesignDocument d) => d.Fold switch
    {
        "vertical" => [new Box(0, 0, d.Width / 2, d.Height), new Box(d.Width / 2, 0, d.Width / 2, d.Height)],
        "horizontal" => [new Box(0, 0, d.Width, d.Height / 2), new Box(0, d.Height / 2, d.Width, d.Height / 2)],
        _ => [new Box(0, 0, d.Width, d.Height)],
    };

    // ------------------------------------------------------------------------------------------------ overlaps

    /// <summary>Whether the element is a background or a frame: it covers most of the page, or it is a frame/pattern of the Deko pack (its middle is empty, it is meant to be behind everything).</summary>
    private static bool IsBackdrop(DesignDocument document, DesignElement e)
    {
        var box = BoxOf(e);
        var page = document.Width * document.Height;
        if (page > 0 && box.Area >= 0.6 * page)
        {
            return true;
        }

        return e is ImageElement { Source.Asset: { } key } && (key.StartsWith("deko-rahmen", StringComparison.OrdinalIgnoreCase) || key.StartsWith("deko-muster", StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>The groups of the Deko pack that are drawn to be seen next to text, never under it (a wreath, a frame, a banner or a plaque are different: text belongs inside them; confetti and stars are a backdrop).</summary>
    private static readonly string[] Ornaments = ["deko-ornamente-", "deko-trenner-", "deko-ecken-"];

    private static void LintOverlaps(DesignDocument document, DesignPage page, int number, List<DesignElement> flat, List<TextElement> texts, Dictionary<TextElement, TextInk> inks, List<LintFinding> findings)
    {
        var reported = 0;

        // text on text
        for (var i = 0; i < texts.Count && reported < 4; i++)
        {
            for (var j = i + 1; j < texts.Count && reported < 4; j++)
            {
                var a = inks[texts[i]].Ink;
                var b = inks[texts[j]].Ink;
                var common = a.Overlap(b);
                if (common <= 0 || a.Area <= 0 || b.Area <= 0)
                {
                    continue;
                }

                // a copy of the same text a little aside is a drop shadow made by hand
                if (string.Equals(texts[i].Text, texts[j].Text, StringComparison.Ordinal) && Math.Abs(a.X - b.X) < document.Width * 0.02 && Math.Abs(a.Y - b.Y) < document.Height * 0.02)
                {
                    continue;
                }

                if (common / Math.Min(a.Area, b.Area) > 0.1)
                {
                    findings.Add(new("textoverlap", $"Die Textfelder {Label(texts[i])} und {Label(texts[j])} überlappen sich auf Seite {number}.", true));
                    reported++;
                }
            }
        }

        // text and what lies over or under it
        for (var i = 0; i < flat.Count && reported < 8; i++)
        {
            var e = flat[i];
            if (e.Hidden || e.Opacity < 0.5 || e is TextElement || IsBackdrop(document, e) || e.W <= 0 && e.H <= 0)
            {
                continue;
            }

            var box = BoxOf(e);
            foreach (var text in texts)
            {
                var ink = inks[text].Ink;
                if (ink.Area <= 0)
                {
                    continue;
                }

                var textIndex = flat.IndexOf(text);
                var above = i > textIndex;
                switch (e)
                {
                    case ImageElement or ImageStripElement or IconElement or QrElement or BarcodeElement:
                    {
                        // a picture drawn OVER a text hides it; a picture under a text that only reaches into it (neither apart nor a plaque or wreath the text sits on) is a layout accident
                        if (e is ImageElement { Source.Asset: { } textureKey } && textureKey.StartsWith("deko-motive-verschleiss", StringComparison.OrdinalIgnoreCase))
                        {
                            break;   // a worn-paper texture is laid over everything on purpose
                        }

                        var share = box.Overlap(ink) / ink.Area;
                        // an ornament, a divider or a corner of the Deko pack carries no text, whatever the order: any overlap is a defect
                        var ornament = e is ImageElement { Source.Asset: { } ornamentKey } && Ornaments.Any(o => ornamentKey.StartsWith(o, StringComparison.OrdinalIgnoreCase)) && share > 0.08;
                        if (ornament || (above && share > 0.12) || (!above && share is > 0.15 and < 0.75))
                        {
                            var what = e switch { ImageElement => "Das Bild", IconElement => "Das Symbol", ImageStripElement => "Die Bildleiste", _ => "Der Code" };
                            findings.Add(new("textcover", $"{what} {Label(e)} {(above ? "liegt über" : "ragt unter")} dem Text {Label(text)} (Überdeckung {Math.Round(share * 100):0} %): schiebe es weg oder mach Platz; Bilder und Deko dürfen Text nicht teilweise überdecken.", above || ornament));
                            reported++;
                        }

                        break;
                    }

                    case ShapeElement { Shape: "line" } line:
                        if (LineCrosses(line, ink) && reported < 8)
                        {
                            findings.Add(new("linecross", $"Die Linie {Label(e)} schneidet den Text {Label(text)}.", above));
                            reported++;
                        }

                        break;
                    case ShapeElement shape when shape.Fill is null && shape.Stroke is not null:
                        if (OutlineCrosses(shape, ink, document.Unit))
                        {
                            findings.Add(new("outlinecross", $"Der Rahmen/Kreis {Label(e)} läuft durch den Text {Label(text)}: der Text muss ganz innen oder ganz außen liegen.", true));
                            reported++;
                        }

                        break;
                    case ShapeElement { Shape: "rect" or "ellipse", Fill.Color: { } plateColour } plate when !above && text.Background is null && plate.Opacity >= 0.9:
                    {
                        // a text that lies only partly on a plate (a disc, a band): the part on the plate is read on another colour than the rest
                        var share = Share(box, plate.Shape == "ellipse", ink);
                        if (share is > 0.25 and < 0.85 && !IsBackdrop(document, plate))
                        {
                            var ratio = Contrast(text.Color, plateColour);
                            var poor = ratio is { } r && r < MinContrast;
                            findings.Add(new("textedge", $"Der Text {Label(text)} liegt nur zum Teil auf {Label(plate)}{(poor ? ", und dort ist er schlecht lesbar" : "")}: setze ihn ganz darauf oder ganz daneben.", ratio is < 2.0));
                            reported++;
                        }

                        break;
                    }

                    case ShapeElement shape when above && shape.Fill is not null:
                    {
                        var share = box.Overlap(ink) / ink.Area;
                        if (share > 0.25 && !(text.Background is not null))
                        {
                            findings.Add(new("shapecover", $"Die Fläche {Label(e)} liegt über dem Text {Label(text)} und verdeckt ihn: ordne sie mit arrange unter den Text.", true));
                            reported++;
                        }

                        break;
                    }
                }
            }
        }
    }

    private static bool LineCrosses(ShapeElement line, Box ink)
    {
        // the line runs from the top left to the bottom right of its box (flips switch the diagonal), turned around the centre
        var cx = line.X + (line.W / 2);
        var cy = line.Y + (line.H / 2);
        double x1 = line.FlipX ? line.X + line.W : line.X, y1 = line.FlipY ? line.Y + line.H : line.Y;
        double x2 = line.FlipX ? line.X : line.X + line.W, y2 = line.FlipY ? line.Y : line.Y + line.H;
        if (line.Rotation != 0)
        {
            var r = line.Rotation * Math.PI / 180;
            (double X, double Y) Turn(double x, double y) => (cx + ((x - cx) * Math.Cos(r)) - ((y - cy) * Math.Sin(r)), cy + ((x - cx) * Math.Sin(r)) + ((y - cy) * Math.Cos(r)));
            (x1, y1) = Turn(x1, y1);
            (x2, y2) = Turn(x2, y2);
        }

        // sample the segment: a point inside the (slightly shrunk) ink box means the line goes through the text
        var shrunk = new Box(ink.X + (ink.W * 0.04), ink.Y + (ink.H * 0.15), ink.W * 0.92, ink.H * 0.7);
        for (var k = 0; k <= 60; k++)
        {
            var t = k / 60.0;
            var x = x1 + ((x2 - x1) * t);
            var y = y1 + ((y2 - y1) * t);
            if (x >= shrunk.X && x <= shrunk.Right && y >= shrunk.Y && y <= shrunk.Bottom)
            {
                return true;
            }
        }

        return false;
    }

    /// <summary>An unfilled ellipse or rectangle (a ring, a frame) whose line goes through the ink of a text: some corners of the ink are inside, some outside.</summary>
    private static bool OutlineCrosses(ShapeElement shape, Box ink, string unit)
    {
        var box = BoxOf(shape);
        if (box.W <= 0 || box.H <= 0 || box.Overlap(ink) <= 0)
        {
            return false;
        }

        bool Inside(double x, double y)
        {
            if (shape.Shape == "ellipse")
            {
                var dx = (x - box.CentreX) / (box.W / 2);
                var dy = (y - box.CentreY) / (box.H / 2);
                return (dx * dx) + (dy * dy) <= 1;
            }

            return x >= box.X && x <= box.Right && y >= box.Y && y <= box.Bottom;
        }

        var points = new List<(double X, double Y)>();
        for (var i = 0; i <= 4; i++)
        {
            var fx = ink.X + (ink.W * i / 4.0);
            var fy = ink.Y + (ink.H * i / 4.0);
            points.Add((fx, ink.Y));
            points.Add((fx, ink.Bottom));
            points.Add((ink.X, fy));
            points.Add((ink.Right, fy));
        }

        var inside = points.Count(p => Inside(p.X, p.Y));
        return inside > 0 && inside < points.Count;
    }

    // ------------------------------------------------------------------------------------------------ emptiness

    private const int Grid = 40;

    /// <summary>
    /// The largest empty rectangle of the page: the page is a grid, a cell counts as used when a text (its ink) or a picture, symbol or shape (not a backdrop) covers a quarter of it. A big empty area is a design
    /// that has not used its page. Pages of a folded card are left alone: a card may keep a half empty for the handwriting.
    /// </summary>
    private static void LintEmptiness(DesignDocument document, DesignPage page, int number, List<DesignElement> flat, Dictionary<TextElement, TextInk> inks, List<LintFinding> findings)
    {
        if (document.Fold != "none" || document.Width <= 0 || document.Height <= 0)
        {
            return;
        }

        var content = new List<Box>();
        foreach (var e in flat.Where(e => !e.Hidden && e.Opacity >= 0.25))
        {
            switch (e)
            {
                case TextElement t when inks.TryGetValue(t, out var ink):
                    content.Add(ink.Ink.Inflate(Math.Min(document.Width, document.Height) * 0.012));
                    break;
                case TextElement:
                    break;
                default:
                    if (!IsBackdrop(document, e) && e.W > 0 && e.H > 0 && !(e is ShapeElement { Shape: "line" } && (e.W < 1 || e.H < 1) && Math.Max(e.W, e.H) < Math.Min(document.Width, document.Height) * 0.2))
                    {
                        content.Add(BoxOf(e));
                    }

                    break;
            }
        }

        if (content.Count == 0)
        {
            findings.Add(new("empty", $"Seite {number} ist leer.", true));
            return;
        }

        var cw = document.Width / Grid;
        var ch = document.Height / Grid;
        var used = new bool[Grid, Grid];
        var usedCount = 0;
        for (var gx = 0; gx < Grid; gx++)
        {
            for (var gy = 0; gy < Grid; gy++)
            {
                var cell = new Box(gx * cw, gy * ch, cw, ch);
                if (content.Any(c => c.Overlap(cell) >= 0.25 * cell.Area))
                {
                    used[gx, gy] = true;
                    usedCount++;
                }
            }
        }

        // the largest empty rectangle by the histogram method
        var heights = new int[Grid];
        var best = (Area: 0, X: 0, Y: 0, W: 0, H: 0);
        for (var gy = 0; gy < Grid; gy++)
        {
            for (var gx = 0; gx < Grid; gx++)
            {
                heights[gx] = used[gx, gy] ? 0 : heights[gx] + 1;
            }

            for (var left = 0; left < Grid; left++)
            {
                var minH = int.MaxValue;
                for (var right = left; right < Grid && heights[right] > 0; right++)
                {
                    minH = Math.Min(minH, heights[right]);
                    var area = (right - left + 1) * minH;
                    if (area > best.Area)
                    {
                        best = (area, left, gy - minH + 1, right - left + 1, minH);
                    }
                }
            }
        }

        var share = best.Area / (double)(Grid * Grid);
        var covered = usedCount / (double)(Grid * Grid);
        if (share >= 0.3)
        {
            var emptySerious = share >= 0.45 && !FormLike(flat);
            var where = best.Y + (best.H / 2.0) < Grid * 0.4 ? "oben" : best.Y + (best.H / 2.0) > Grid * 0.6 ? "unten" : "in der Mitte";
            if (best.W < Grid * 0.5)
            {
                where += best.X + (best.W / 2.0) < Grid * 0.5 ? " links" : " rechts";
            }

            findings.Add(new("emptyarea", $"Auf Seite {number} bleibt {where} eine große Fläche leer (etwa {Math.Round(share * 100):0} % der Seite, x {N(best.X * cw)}–{N((best.X + best.W) * cw)}, y {N(best.Y * ch)}–{N((best.Y + best.H) * ch)} {document.Unit}): nutze sie (größere Schrift, ein Motiv aus search_deko, Abstände gleichmäßig verteilen).", emptySerious));
        }
        else if (covered < 0.2)
        {
            findings.Add(new("sparse", $"Seite {number} wirkt leer (nur {Math.Round(covered * 100):0} % der Fläche sind benutzt): füge Inhalt hinzu oder mach die Elemente größer.", covered < 0.1));
        }
    }

    // ------------------------------------------------------------------------------------------------ hierarchy

    /// <summary>A page that is mostly lines (a form, a planner, ruled paper): its empty space is the point.</summary>
    private static bool FormLike(List<DesignElement> flat) => flat.Count(e => e is ShapeElement { Shape: "line" } or ShapeElement { Shape: "rect", Fill: null }) >= 8;

    private static void LintHierarchy(DesignDocument document, DesignPage page, int number, List<TextElement> texts, Dictionary<TextElement, TextInk> inks, List<LintFinding> findings)
    {
        var sized = texts.Where(t => t.Text.Trim().Length >= 3).Select(t => inks[t].SizePt).OrderBy(s => s).ToList();
        if (sized.Count < 4)
        {
            return;
        }

        var median = sized[sized.Count / 2];
        var largest = sized[^1];
        if (largest < median * 1.5)
        {
            findings.Add(new("hierarchy", $"Auf Seite {number} gibt es keine klare Rangfolge: die größte Schrift ({N(largest)} pt) ist kaum größer als die übliche ({N(median)} pt). Eine Überschrift sollte mindestens doppelt so groß sein wie der Fließtext.", false));
        }
    }

    // ------------------------------------------------------------------------------------------------ colours

    /// <summary>The solid colour a text is drawn on: its own box, else the topmost solid shape below it that covers its centre, else the colour of the page; null when it is a gradient or a picture (unknown).</summary>
    private static string? BackgroundBehind(DesignPage page, List<DesignElement> flat, TextElement text, Box ink)
    {
        if (text.Background is { } box)
        {
            return box.Color;
        }

        var self = flat.IndexOf(text);
        for (var i = self - 1; i >= 0; i--)
        {
            var e = flat[i];
            if (e.Hidden || e.Opacity < 0.9)
            {
                continue;
            }

            var b = BoxOf(e);
            switch (e)
            {
                case ShapeElement { Shape: "ellipse" or "rect" } shape when shape.Fill is not null:
                    // only a shape that lies behind most of the ink counts (a small dot under the middle of a line says nothing)
                    if (Share(b, shape.Shape == "ellipse", ink) >= 0.55)
                    {
                        return shape.Fill.Color;   // null for a gradient: unknown
                    }

                    continue;
                case ShapeElement { Shape: not "line" and not "ellipse" and not "rect" } other when other.Fill is not null:
                    // a star, a speech bubble, a ribbon: its box says too little, so what is behind the ink is unknown when it is there at all
                    if (Share(b, false, ink) >= 0.4)
                    {
                        return null;
                    }

                    continue;
                case ImageElement or ImageStripElement:
                    if (Share(b, false, ink) >= 0.5)
                    {
                        return null;
                    }

                    continue;
            }
        }

        var background = page.Background;
        return background is { Gradient: null, Asset: null, Color: { } color } ? color : null;
    }

    /// <summary>The part of the ink box (a 5 x 3 grid of points) that lies inside the box or the ellipse in it.</summary>
    private static double Share(Box shape, bool ellipse, Box ink)
    {
        if (ink.W <= 0 || ink.H <= 0 || shape.W <= 0 || shape.H <= 0)
        {
            return 0;
        }

        var inside = 0;
        for (var gx = 0; gx < 5; gx++)
        {
            for (var gy = 0; gy < 3; gy++)
            {
                var x = ink.X + (ink.W * (gx + 0.5) / 5);
                var y = ink.Y + (ink.H * (gy + 0.5) / 3);
                if (ellipse)
                {
                    var dx = (x - shape.CentreX) / (shape.W / 2);
                    var dy = (y - shape.CentreY) / (shape.H / 2);
                    inside += (dx * dx) + (dy * dy) <= 1 ? 1 : 0;
                }
                else
                {
                    inside += x >= shape.X && x <= shape.Right && y >= shape.Y && y <= shape.Bottom ? 1 : 0;
                }
            }
        }

        return inside / 15.0;
    }

    private static double? Luminance(string colour)
    {
        var c = colour.TrimStart('#');
        if (c.Length == 3)
        {
            c = string.Concat(c.Select(ch => new string(ch, 2)));
        }

        if (c.Length != 6 || !int.TryParse(c, NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var rgb))
        {
            return null;
        }

        static double Channel(int v)
        {
            var s = v / 255.0;
            return s <= 0.03928 ? s / 12.92 : Math.Pow((s + 0.055) / 1.055, 2.4);
        }

        return (0.2126 * Channel((rgb >> 16) & 255)) + (0.7152 * Channel((rgb >> 8) & 255)) + (0.0722 * Channel(rgb & 255));
    }

    /// <summary>The contrast ratio of two colours (WCAG, 1 to 21); null when one is no colour.</summary>
    public static double? Contrast(string a, string b)
    {
        if (Luminance(a) is not { } la || Luminance(b) is not { } lb)
        {
            return null;
        }

        var hi = Math.Max(la, lb);
        var lo = Math.Min(la, lb);
        return (hi + 0.05) / (lo + 0.05);
    }

    // ------------------------------------------------------------------------------------------------ fields, fonts

    private static void LintFields(DesignDocument document, List<LintFinding> findings)
    {
        foreach (var usage in Placeholders.FieldsUsed(document))
        {
            if (!usage.Defined)
            {
                var use = usage.Uses[0];
                findings.Add(new("nofield", $"Der Platzhalter {{{{{usage.Key}}}}} (Element {use.ElementId}) hat kein Feld: lege es mit set_fields an.", false));
            }
        }

        var used = Placeholders.FieldsUsed(document).Select(u => u.Key).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var field in document.Fields.Where(f => !used.Contains(f.Key)).Take(5))
        {
            findings.Add(new("unusedfield", $"Das Feld „{field.Key}“ wird in keinem Element verwendet.", false));
        }
    }

    private static void LintFamilies(DesignDocument document, List<LintFinding> findings)
    {
        var families = document.AllElements.OfType<TextElement>().Where(t => t.Text.Trim().Length > 0).Select(t => t.FontFamily).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        if (families.Count > MaxFamilies)
        {
            findings.Add(new("families", $"Das Design nutzt {families.Count} Schriftfamilien ({string.Join(", ", families.Take(6))}): nimm höchstens {MaxFamilies}.", false));
        }
    }
}
