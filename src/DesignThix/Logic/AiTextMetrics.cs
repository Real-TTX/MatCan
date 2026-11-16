using DesignThix.Core.Documents;

namespace DesignThix.Logic;

/// <summary>An axis-aligned box in the units of the document.</summary>
public readonly record struct Box(double X, double Y, double W, double H)
{
    public double Area => W * H;

    public double Right => X + W;

    public double Bottom => Y + H;

    public double CentreX => X + (W / 2);

    public double CentreY => Y + (H / 2);

    /// <summary>The area both boxes have in common (0 when they only touch or are apart).</summary>
    public double Overlap(Box other)
    {
        var w = Math.Min(Right, other.Right) - Math.Max(X, other.X);
        var h = Math.Min(Bottom, other.Bottom) - Math.Max(Y, other.Y);
        return w > 0 && h > 0 ? w * h : 0;
    }

    public Box Inflate(double d) => new(X - d, Y - d, W + (2 * d), H + (2 * d));

    /// <summary>The axis-aligned box around this box turned by <paramref name="degrees"/> around the point.</summary>
    public Box Rotated(double degrees, double cx, double cy)
    {
        if (degrees == 0)
        {
            return this;
        }

        var r = degrees * Math.PI / 180;
        var cos = Math.Cos(r);
        var sin = Math.Sin(r);
        double x1 = double.PositiveInfinity, y1 = double.PositiveInfinity, x2 = double.NegativeInfinity, y2 = double.NegativeInfinity;
        foreach (var (px, py) in new[] { (X - cx, Y - cy), (Right - cx, Y - cy), (Right - cx, Bottom - cy), (X - cx, Bottom - cy) })
        {
            var x = cx + (px * cos) - (py * sin);
            var y = cy + (px * sin) + (py * cos);
            x1 = Math.Min(x1, x);
            y1 = Math.Min(y1, y);
            x2 = Math.Max(x2, x);
            y2 = Math.Max(y2, y);
        }

        return new Box(x1, y1, x2 - x1, y2 - y1);
    }
}

/// <summary>What a text really takes: the box its ink fills, how many lines it has, the size the engine will draw it at, and whether it runs out of its box.</summary>
public sealed record TextInk(Box Ink, int Lines, double SizePt, bool Overflows, bool Shrunk);

/// <summary>
/// Estimates the ink of a text element the way the render engine lays it out (<c>layoutText</c> of <c>dt-engine.js</c>): words are wrapped greedily at the width of the box, a line is as wide as its words are
/// (<see cref="AiFontMetrics"/>), the block is as high as its lines times the line height, and with "shrink" the size goes down until it fits. The result is aligned inside the box like the engine does it. The widths
/// are an estimate (about 10 %), so everything built on it keeps a tolerance.
/// </summary>
public static class AiTextMetrics
{
    public static double PtToUnit(double pt, string unit) => unit == "px" ? pt * 96 / 72 : pt * 25.4 / 72;

    public static double UnitToPt(double value, string unit) => unit == "px" ? value * 72 / 96 : value * 72 / 25.4;

    /// <summary>The text as it is drawn: the placeholders replaced by the sample of their field (or the key when there is none), the upper case switch applied.</summary>
    public static string Resolve(TextElement t, IReadOnlyList<FieldDef> fields)
    {
        var text = t.Text;
        if (text.Contains("{{", StringComparison.Ordinal))
        {
            var samples = fields.ToDictionary(f => f.Key, f => (string?)f.Sample, StringComparer.OrdinalIgnoreCase);
            text = Placeholders.Render(text, fields, samples, "de-DE", true);
        }

        return t.Uppercase ? text.ToUpperInvariant() : text;
    }

    private static List<double> LineWidths(string text, TextElement t, double availableEm)
    {
        var widths = new List<double>();
        foreach (var paragraph in text.Split('\n'))
        {
            var words = paragraph.Split(' ', StringSplitOptions.None);
            var space = AiFontMetrics.WidthEm(t.FontFamily, t.FontWeight, " ", false, t.LetterSpacing);
            var current = 0.0;
            var any = false;
            foreach (var word in words)
            {
                var w = AiFontMetrics.WidthEm(t.FontFamily, t.FontWeight, word, t.Uppercase, t.LetterSpacing);
                if (any && current + space + w > availableEm)
                {
                    widths.Add(current);
                    current = w;
                }
                else
                {
                    current = any ? current + space + w : w;
                }

                any = true;
            }

            widths.Add(current);
        }

        return widths;
    }

    /// <summary>The ink of a text element. A curved text (one line on an arc) and a text without a box are taken as their box.</summary>
    public static TextInk Measure(TextElement t, string unit, IReadOnlyList<FieldDef> fields)
    {
        var text = Resolve(t, fields);
        var lh = Math.Clamp(t.LineHeight, 0.5, 3);
        var box = new Box(t.X, t.Y, t.W, t.H);
        if (t.Curve != 0 || t.W <= 0 || t.H <= 0)
        {
            return new TextInk(box.Rotated(t.Rotation, box.CentreX, box.CentreY), 1, t.FontSize, false, false);
        }

        var pt = Math.Max(0.1, t.FontSize);
        var minPt = Math.Min(pt, Math.Max(0.1, t.MinFontSize));
        List<double> lines;
        double size;
        bool Fits(List<double> l, double s) => l.Max() * s <= t.W + 0.001 && (!t.Wrap || l.Count * lh * s <= t.H + 0.001);
        var shrunk = false;
        for (; ; )
        {
            size = PtToUnit(pt, unit);
            lines = LineWidths(text, t, t.Wrap ? t.W / size : double.PositiveInfinity);
            if (t.Fit != "shrink" || Fits(lines, size) || pt <= minPt + 0.001)
            {
                break;
            }

            shrunk = true;
            pt = Math.Max(minPt, pt - Math.Max(0.25, pt * 0.03));
        }

        var widest = lines.Max() * size;
        var blockH = lines.Count * lh * size;
        // the ink of a line is about 0.8 of the font size high, centred in the line box
        var inkH = (size * 0.8) + ((lines.Count - 1) * lh * size);
        var inkW = Math.Min(widest, Math.Max(widest, 0));
        var overflows = widest > t.W + (0.02 * t.W) + 0.5 || (t.Wrap && blockH > t.H + (0.02 * t.H) + 0.5 * size);
        var x = t.Align switch { "center" => t.X + ((t.W - inkW) / 2), "right" => t.X + t.W - inkW, _ => t.X };
        var blockTop = t.Valign switch { "middle" => t.Y + ((t.H - blockH) / 2), "bottom" => t.Y + t.H - blockH, _ => t.Y };
        var y = blockTop + (((lh * size) - (size * 0.8)) / 2);
        var ink = new Box(x, y, inkW, inkH);
        return new TextInk(ink.Rotated(t.Rotation, box.CentreX, box.CentreY), lines.Count, pt, overflows, shrunk);
    }
}
