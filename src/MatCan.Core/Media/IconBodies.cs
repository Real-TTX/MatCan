using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;

namespace MatCan.Core.Media;

/// <summary>One drawable shape of an icon: its tag and the attributes that survived the allowlist (geometry and presentation).</summary>
public sealed record IconShape(string Tag, IReadOnlyDictionary<string, string> Attrs);

/// <summary>An icon body that passed the allowlist: the flat shapes, the grid it was drawn on, and the canonical markup (what <c>dt-engine.js</c> parses again).</summary>
public sealed record IconBodyParsed(IReadOnlyList<IconShape> Shapes, int Width, int Height, string Markup);

/// <summary>
/// The C# twin of the icon allowlist of <c>dt-engine.js</c> (<c>parseIconBody</c>), for the bodies of icon sets that come from a catalogue (Iconify, docs/PLAN-CATALOGS.md section 5). A body is never kept
/// as it arrived: it is parsed as XML (no DTD, no entities, no resolver), walked, and written again as a flat list of path, circle, rect, line, polyline, polygon and ellipse with their geometry and a
/// small set of presentation attributes (fill, stroke and their details; colours become <c>currentColor</c> or <c>none</c>). Groups only pass their presentation down. Everything that would draw
/// something this allowlist cannot (script, style, foreignObject, use, image, text, masks, clip paths, filters, gradients, transforms, links) makes the whole icon refused, never half drawn. Animation
/// elements are dropped (the icon is drawn in its final state, which is the static one for Iconify's animated sets).
/// </summary>
public static partial class IconBodies
{
    private const string SvgNs = "http://www.w3.org/2000/svg";
    public const int MaxBodyChars = 60_000;
    public const int MaxShapes = 256;
    public const int MaxDepth = 8;
    public const int MaxPathChars = 20_000;
    public const int MaxDimension = 2048;

    private static readonly Dictionary<string, string[]> Geometry = new(StringComparer.Ordinal)
    {
        ["path"] = ["d"],
        ["circle"] = ["cx", "cy", "r"],
        ["rect"] = ["x", "y", "width", "height", "rx", "ry"],
        ["line"] = ["x1", "y1", "x2", "y2"],
        ["polyline"] = ["points"],
        ["polygon"] = ["points"],
        ["ellipse"] = ["cx", "cy", "rx", "ry"],
    };

    private static readonly Dictionary<string, string[]> Required = new(StringComparer.Ordinal)
    {
        ["path"] = ["d"],
        ["circle"] = ["r"],
        ["rect"] = ["width", "height"],
        ["line"] = ["x1", "y1", "x2", "y2"],
        ["polyline"] = ["points"],
        ["polygon"] = ["points"],
        ["ellipse"] = ["rx", "ry"],
    };

    /// <summary>Elements that are skipped (with everything inside): they draw nothing or animate.</summary>
    private static readonly HashSet<string> Ignored = new(StringComparer.Ordinal) { "animate", "animateTransform", "animateMotion", "set", "title", "desc", "metadata" };

    /// <summary>Attributes that make an icon unusable here: it would look different from what the provider shows.</summary>
    private static readonly HashSet<string> Refused = new(StringComparer.Ordinal) { "transform", "style", "clip-path", "mask", "filter", "href", "marker-start", "marker-mid", "marker-end" };

    [GeneratedRegex(@"^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?\z", RegexOptions.CultureInvariant)]
    private static partial Regex NumberPattern();

    [GeneratedRegex(@"^[0-9eE+\-.,\sMmLlHhVvCcSsQqTtAaZz]*\z", RegexOptions.CultureInvariant)]
    private static partial Regex PathPattern();

    [GeneratedRegex(@"^[0-9eE+\-.,\s]*\z", RegexOptions.CultureInvariant)]
    private static partial Regex PointsPattern();

    private sealed class Paint
    {
        public string Fill = "currentColor";
        public string Stroke = "none";
        public double StrokeWidth = 1;
        public string Cap = "butt";
        public string Join = "miter";
        public double MiterLimit = 4;
        public string FillRule = "nonzero";
        public double FillOpacity = 1;
        public double StrokeOpacity = 1;
        public double Opacity = 1;

        public Paint Clone() => (Paint)MemberwiseClone();
    }

    /// <summary>
    /// Checks and normalises the body of one icon. <paramref name="width"/> and <paramref name="height"/> are the grid the icon was drawn on (Iconify: 16 when the set says nothing). Returns null and says
    /// why in <paramref name="reason"/> when the icon is refused.
    /// </summary>
    public static IconBodyParsed? Parse(string? body, double width, double height, out string reason)
    {
        reason = "";
        if (string.IsNullOrWhiteSpace(body) || body.Length > MaxBodyChars)
        {
            reason = "Der Inhalt ist leer oder zu groß.";
            return null;
        }

        if (!(width >= 1 && width <= MaxDimension && height >= 1 && height <= MaxDimension))
        {
            reason = "Die Größe des Icons ist ungültig.";
            return null;
        }

        XDocument doc;
        try
        {
            var settings = new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersInDocument = MaxBodyChars + 200, IgnoreComments = true, IgnoreProcessingInstructions = true };
            using var reader = XmlReader.Create(new StringReader($"<svg xmlns=\"{SvgNs}\">{body}</svg>"), settings);
            doc = XDocument.Load(reader, LoadOptions.None);
        }
        catch (XmlException)
        {
            reason = "Der Inhalt ist kein gültiges SVG.";
            return null;
        }

        var shapes = new List<IconShape>();
        try
        {
            Walk(doc.Root!, new Paint(), 0, shapes);
        }
        catch (IconRefusedException ex)
        {
            reason = ex.Message;
            return null;
        }

        if (shapes.Count == 0)
        {
            reason = "Das Icon enthält nichts, was MatCan zeichnen kann.";
            return null;
        }

        var w = (int)Math.Round(width);
        var h = (int)Math.Round(height);
        return new IconBodyParsed(shapes, w, h, Markup(shapes));
    }

    private sealed class IconRefusedException(string message) : Exception(message);

    private static void Walk(XElement parent, Paint inherited, int depth, List<IconShape> shapes)
    {
        if (depth > MaxDepth)
        {
            throw new IconRefusedException("Das Icon ist zu tief verschachtelt.");
        }

        foreach (var child in parent.Elements())
        {
            var name = child.Name.LocalName;
            if (child.Name.NamespaceName != SvgNs)
            {
                throw new IconRefusedException($"Das Element „{Clip(name)}“ ist nicht erlaubt.");
            }

            if (Ignored.Contains(name))
            {
                continue;
            }

            var isGroup = name == "g";
            if (!isGroup && !Geometry.ContainsKey(name))
            {
                throw new IconRefusedException($"Das Element „{Clip(name)}“ kann MatCan nicht zeichnen.");
            }

            foreach (var attribute in child.Attributes())
            {
                var local = attribute.Name.LocalName;
                if (Refused.Contains(local) || local.StartsWith("on", StringComparison.OrdinalIgnoreCase))
                {
                    throw new IconRefusedException($"Das Attribut „{Clip(local)}“ kann MatCan nicht zeichnen.");
                }
            }

            var paint = inherited.Clone();
            Apply(child, paint);
            if (isGroup)
            {
                Walk(child, paint, depth + 1, shapes);
                continue;
            }

            if (child.HasElements)
            {
                // a shape may hold animation elements, nothing else
                foreach (var inner in child.Elements())
                {
                    if (!Ignored.Contains(inner.Name.LocalName))
                    {
                        throw new IconRefusedException($"Das Element „{Clip(inner.Name.LocalName)}“ kann MatCan nicht zeichnen.");
                    }
                }
            }

            var shape = Shape(name, child, paint);
            if (shape is not null)
            {
                if (shapes.Count >= MaxShapes)
                {
                    throw new IconRefusedException("Das Icon besteht aus zu vielen Teilen.");
                }

                shapes.Add(shape);
            }
        }
    }

    private static string Clip(string text) => text.Length > 40 ? text[..40] : text;

    private static string? Attr(XElement e, string name) => e.Attribute(name)?.Value;

    private static void Apply(XElement e, Paint p)
    {
        if (Attr(e, "fill") is { } fill)
        {
            p.Fill = PaintValue(fill);
        }

        if (Attr(e, "stroke") is { } stroke)
        {
            p.Stroke = PaintValue(stroke);
        }

        if (Attr(e, "stroke-width") is { } width)
        {
            p.StrokeWidth = Number(width, 0, 64, "stroke-width");
        }

        if (Attr(e, "stroke-linecap") is { } cap)
        {
            p.Cap = cap.Trim() is "round" or "square" ? cap.Trim() : "butt";
        }

        if (Attr(e, "stroke-linejoin") is { } join)
        {
            p.Join = join.Trim() is "round" or "bevel" ? join.Trim() : "miter";
        }

        if (Attr(e, "stroke-miterlimit") is { } limit)
        {
            p.MiterLimit = Number(limit, 1, 100, "stroke-miterlimit");
        }

        if (Attr(e, "fill-rule") is { } rule)
        {
            p.FillRule = rule.Trim() == "evenodd" ? "evenodd" : "nonzero";
        }

        if (Attr(e, "fill-opacity") is { } fo)
        {
            p.FillOpacity = Number(fo, 0, 1, "fill-opacity");
        }

        if (Attr(e, "stroke-opacity") is { } so)
        {
            p.StrokeOpacity = Number(so, 0, 1, "stroke-opacity");
        }

        if (Attr(e, "opacity") is { } o)
        {
            // opacity of groups multiplies down the tree
            p.Opacity *= Number(o, 0, 1, "opacity");
        }
    }

    /// <summary>A paint: <c>none</c>, or any colour (a monotone icon is drawn in the colour of the element, so every colour is <c>currentColor</c>); a reference to a gradient or pattern refuses the icon.</summary>
    private static string PaintValue(string value)
    {
        var v = value.Trim();
        if (v.Length == 0 || v.Length > 64 || v.Contains("url", StringComparison.OrdinalIgnoreCase) || v.Contains("var(", StringComparison.OrdinalIgnoreCase) || v.Contains('<') || v.Contains('&'))
        {
            throw new IconRefusedException("Das Icon nutzt Farbverläufe oder Muster, die MatCan nicht zeichnet.");
        }

        return v.Equals("none", StringComparison.OrdinalIgnoreCase) || v.Equals("transparent", StringComparison.OrdinalIgnoreCase) ? "none" : "currentColor";
    }

    private static double Number(string text, double min, double max, string what)
    {
        var t = text.Trim();
        if (!NumberPattern().IsMatch(t) || !double.TryParse(t, NumberStyles.Float, CultureInfo.InvariantCulture, out var n) || double.IsNaN(n) || double.IsInfinity(n))
        {
            throw new IconRefusedException($"Der Wert von {what} ist ungültig.");
        }

        // a value outside what any icon uses is not clamped: the icon is refused
        if (n < min || n > max)
        {
            throw new IconRefusedException($"Der Wert von {what} ist ungültig.");
        }

        return n;
    }

    private static IconShape? Shape(string tag, XElement e, Paint p)
    {
        var attrs = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var name in Geometry[tag])
        {
            if (Attr(e, name) is not { } value)
            {
                continue;
            }

            var v = value.Trim();
            var ok = name switch
            {
                "d" => v.Length <= MaxPathChars && PathPattern().IsMatch(v),
                "points" => v.Length <= MaxPathChars && PointsPattern().IsMatch(v),
                _ => NumberPattern().IsMatch(v) && double.TryParse(v, NumberStyles.Float, CultureInfo.InvariantCulture, out var n) && double.IsFinite(n) && Math.Abs(n) <= 1_000_000,
            };
            if (!ok)
            {
                throw new IconRefusedException($"Der Wert von {name} ist ungültig.");
            }

            attrs[name] = v;
        }

        if (Required[tag].Any(r => !attrs.ContainsKey(r)))
        {
            // a shape without its required geometry draws nothing
            return null;
        }

        var fill = p.Fill;
        var stroke = p.Stroke;
        if (tag is "line")
        {
            // a line has no inside
            fill = "none";
        }

        if (fill == "none" && stroke == "none")
        {
            return null;
        }

        attrs["fill"] = fill;
        attrs["stroke"] = stroke;
        if (stroke != "none")
        {
            attrs["stroke-width"] = Fmt(p.StrokeWidth);
            attrs["stroke-linecap"] = p.Cap;
            attrs["stroke-linejoin"] = p.Join;
            if (p.Join == "miter" && Math.Abs(p.MiterLimit - 4) > 1e-9)
            {
                attrs["stroke-miterlimit"] = Fmt(p.MiterLimit);
            }

            if (p.StrokeOpacity < 1)
            {
                attrs["stroke-opacity"] = Fmt(p.StrokeOpacity);
            }
        }

        if (fill != "none")
        {
            if (p.FillRule == "evenodd")
            {
                attrs["fill-rule"] = "evenodd";
            }

            if (p.FillOpacity < 1)
            {
                attrs["fill-opacity"] = Fmt(p.FillOpacity);
            }
        }

        if (p.Opacity < 1)
        {
            attrs["opacity"] = Fmt(p.Opacity);
        }

        return new IconShape(tag, attrs);
    }

    private static string Fmt(double n) => Math.Round(n, 4).ToString("0.####", CultureInfo.InvariantCulture);

    private static string Markup(IEnumerable<IconShape> shapes)
    {
        var sb = new StringBuilder();
        foreach (var shape in shapes)
        {
            var element = new XElement(shape.Tag);
            foreach (var (name, value) in shape.Attrs.OrderBy(a => a.Key, StringComparer.Ordinal))
            {
                element.SetAttributeValue(name, value);
            }

            sb.Append(element.ToString(SaveOptions.DisableFormatting));
        }

        return sb.ToString();
    }

    /// <summary>The same icon as an SVG file for a thumbnail in an <c>img</c> (currentColor becomes <paramref name="colour"/>): made from the checked shapes, never from the provider's text.</summary>
    public static string ToSvg(IconBodyParsed icon, string colour = "#1f2937")
    {
        var markup = icon.Markup.Replace("currentColor", colour, StringComparison.Ordinal);
        return $"<svg xmlns=\"{SvgNs}\" viewBox=\"0 0 {icon.Width} {icon.Height}\">{markup}</svg>";
    }
}
