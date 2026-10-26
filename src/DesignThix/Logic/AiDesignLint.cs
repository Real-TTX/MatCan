using System.Globalization;
using DesignThix.Core.Documents;

namespace DesignThix.Logic;

/// <summary>
/// What the design assistant is told after every write, besides what the validator fixed: things a person would see at a glance and a model does not (it cannot see unless it uses <c>look</c>). Checks: an element
/// outside the page or cut off by more than a fifth, text boxes that overlap, text smaller than 6 pt, text that has too little contrast to its background (solid colours only), an image frame without an
/// image, a placeholder without a field or a field nobody uses, more than three font families. Pure functions over the typed document; a warning is a sentence in German with the id of the element.
/// </summary>
public static class AiDesignLint
{
    public const double MinFontPt = 6;
    public const double MinContrast = 3;
    public const int MaxFamilies = 3;

    /// <summary>The warnings for the pages with these ids (null = every page) and for the document as a whole.</summary>
    public static List<string> Run(DesignDocument document, IReadOnlyCollection<string>? pageIds = null)
    {
        var warnings = new List<string>();
        for (var index = 0; index < document.Pages.Count; index++)
        {
            var page = document.Pages[index];
            if (pageIds is not null && !pageIds.Contains(page.Id))
            {
                continue;
            }

            LintPage(document, page, index + 1, warnings);
        }

        LintFields(document, warnings);
        LintFamilies(document, warnings);
        return warnings;
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

    private readonly record struct Rect(double X, double Y, double W, double H)
    {
        public double Area => W * H;

        public double Right => X + W;

        public double Bottom => Y + H;
    }

    /// <summary>The axis-aligned box around the rotated element.</summary>
    private static Rect BoxOf(DesignElement e)
    {
        if (e.Rotation == 0)
        {
            return new Rect(e.X, e.Y, e.W, e.H);
        }

        var cx = e.X + (e.W / 2);
        var cy = e.Y + (e.H / 2);
        var r = e.Rotation * Math.PI / 180;
        var cos = Math.Cos(r);
        var sin = Math.Sin(r);
        double x1 = double.PositiveInfinity, y1 = double.PositiveInfinity, x2 = double.NegativeInfinity, y2 = double.NegativeInfinity;
        foreach (var (px, py) in new[] { (-e.W / 2, -e.H / 2), (e.W / 2, -e.H / 2), (e.W / 2, e.H / 2), (-e.W / 2, e.H / 2) })
        {
            var x = cx + (px * cos) - (py * sin);
            var y = cy + (px * sin) + (py * cos);
            x1 = Math.Min(x1, x);
            y1 = Math.Min(y1, y);
            x2 = Math.Max(x2, x);
            y2 = Math.Max(y2, y);
        }

        return new Rect(x1, y1, x2 - x1, y2 - y1);
    }

    private static double Overlap(Rect a, Rect b)
    {
        var w = Math.Min(a.Right, b.Right) - Math.Max(a.X, b.X);
        var h = Math.Min(a.Bottom, b.Bottom) - Math.Max(a.Y, b.Y);
        return w > 0 && h > 0 ? w * h : 0;
    }

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

    private static void LintPage(DesignDocument document, DesignPage page, int number, List<string> warnings)
    {
        var flat = Flat(page.Elements);
        var pageBox = new Rect(0, 0, document.Width, document.Height);
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
                var inside = Overlap(box, pageBox) / box.Area;
                if (!covers && inside <= 0)
                {
                    warnings.Add($"{Label(e)} liegt ganz außerhalb von Seite {number}.");
                }
                else if (!covers && inside < 0.8)
                {
                    warnings.Add($"{Label(e)} ragt zu {Math.Round((1 - inside) * 100):0} % aus Seite {number} heraus.");
                }
            }

            switch (e)
            {
                case TextElement text when text.FontSize < MinFontPt && text.Text.Trim().Length > 0:
                    warnings.Add($"{Label(e)}: {text.FontSize.ToString("0.#", CultureInfo.InvariantCulture)} pt sind zu klein; lesbar ist ab {MinFontPt:0} pt.");
                    break;
                case ImageElement { Source: null }:
                    warnings.Add($"Der Bildrahmen {Label(e)} hat kein Bild: setze eine source oder lösche ihn.");
                    break;
            }
        }

        // overlapping text boxes
        var texts = flat.OfType<TextElement>().Where(t => !t.Hidden && t.Text.Trim().Length > 0 && t.W > 0 && t.H > 0).ToList();
        var overlaps = 0;
        for (var i = 0; i < texts.Count && overlaps < 5; i++)
        {
            for (var j = i + 1; j < texts.Count && overlaps < 5; j++)
            {
                var a = BoxOf(texts[i]);
                var b = BoxOf(texts[j]);
                var common = Overlap(a, b);
                if (common > 0 && common / Math.Min(a.Area, b.Area) > 0.25)
                {
                    warnings.Add($"Die Textfelder {Label(texts[i])} und {Label(texts[j])} überlappen sich auf Seite {number}.");
                    overlaps++;
                }
            }
        }

        // contrast of a text against what is behind it
        foreach (var text in texts)
        {
            var behind = BackgroundBehind(document, page, flat, text);
            if (behind is null)
            {
                continue;
            }

            var ratio = Contrast(text.Color, behind);
            if (ratio is { } r && r < MinContrast)
            {
                warnings.Add($"{Label(text)}: Kontrast zum Hintergrund nur {r.ToString("0.0", CultureInfo.InvariantCulture)}:1 (mindestens {MinContrast:0}:1), die Schrift ist schlecht lesbar.");
            }
        }
    }

    /// <summary>The solid colour a text is drawn on: its own box, else the topmost solid shape below it that covers its centre, else the colour of the page; null when it is a gradient or a picture (unknown).</summary>
    private static string? BackgroundBehind(DesignDocument document, DesignPage page, List<DesignElement> flat, TextElement text)
    {
        if (text.Background is { } box)
        {
            return box.Color;
        }

        var self = flat.IndexOf(text);
        var centre = (X: text.X + (text.W / 2), Y: text.Y + (text.H / 2));
        for (var i = self - 1; i >= 0; i--)
        {
            var e = flat[i];
            if (e.Hidden || e.Opacity < 0.9)
            {
                continue;
            }

            var b = BoxOf(e);
            if (centre.X < b.X || centre.X > b.Right || centre.Y < b.Y || centre.Y > b.Bottom)
            {
                continue;
            }

            switch (e)
            {
                case ShapeElement { Shape: not "line" } shape when shape.Fill is not null:
                    return shape.Fill.Color;   // null for a gradient: unknown
                case ImageElement:
                case ImageStripElement:
                    return null;
            }
        }

        var background = page.Background;
        return background is { Gradient: null, Asset: null, Color: { } color } ? color : null;
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

    private static void LintFields(DesignDocument document, List<string> warnings)
    {
        foreach (var usage in Placeholders.FieldsUsed(document))
        {
            if (!usage.Defined)
            {
                var use = usage.Uses[0];
                warnings.Add($"Der Platzhalter {{{{{usage.Key}}}}} (Element {use.ElementId}) hat kein Feld: lege es mit set_fields an.");
            }
        }

        var used = Placeholders.FieldsUsed(document).Select(u => u.Key).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var field in document.Fields.Where(f => !used.Contains(f.Key)).Take(5))
        {
            warnings.Add($"Das Feld „{field.Key}“ wird in keinem Element verwendet.");
        }
    }

    private static void LintFamilies(DesignDocument document, List<string> warnings)
    {
        var families = document.AllElements.OfType<TextElement>().Where(t => t.Text.Trim().Length > 0).Select(t => t.FontFamily).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        if (families.Count > MaxFamilies)
        {
            warnings.Add($"Das Design nutzt {families.Count} Schriftfamilien ({string.Join(", ", families.Take(6))}): nimm höchstens {MaxFamilies}.");
        }
    }
}
