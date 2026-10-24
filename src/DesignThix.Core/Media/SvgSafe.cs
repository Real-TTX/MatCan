using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;

namespace DesignThix.Core.Media;

/// <summary>
/// The sanitiser for uploaded SVG files. An SVG is a program in disguise (script, event handlers, external references, style rules that load things), and the
/// application serves it to other people, so nothing is passed through as it came. The file is parsed (a DOCTYPE is refused outright: no entities, no external
/// subset), and a NEW document is built from an allowlist of elements and attributes. Everything else is removed and named in <see cref="Result.Removed"/>.
/// What it keeps: shapes, text, gradients, patterns, clip paths, masks, harmless filters, internal references (<c>#id</c>), embedded bitmaps
/// (<c>data:image/png|jpeg|gif|webp;base64</c>) and CSS that loads nothing. What it never keeps: script, foreignObject, animation, links, event handlers,
/// <c>href</c> to anything outside the file, <c>url(...)</c> to anything but <c>#id</c>, <c>@import</c>, <c>javascript:</c>, <c>data:</c> URLs that are not bitmaps.
/// The caller serves the result with a strict Content-Security-Policy as a second line.
/// </summary>
public static partial class SvgSafe
{
    public const int MaxBytes = 2 * 1024 * 1024;

    /// <summary>How deep elements may nest, and how many of them a file may have; a <c>use</c> bomb is limited by the number of <c>use</c> elements.</summary>
    private const int MaxDepth = 100;
    private const int MaxElements = 50_000;
    private const int MaxUseElements = 200;
    private const int MaxRemovedListed = 50;

    public sealed record Result(bool Ok, byte[]? Bytes, string? Error, int? Width, int? Height, IReadOnlyList<string> Removed);

    private static readonly XNamespace Svg = "http://www.w3.org/2000/svg";
    private static readonly XNamespace XLink = "http://www.w3.org/1999/xlink";

    private static readonly HashSet<string> Elements = new(StringComparer.Ordinal)
    {
        "svg", "g", "defs", "symbol", "use", "title", "desc", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "tspan", "textPath",
        "image", "clipPath", "mask", "linearGradient", "radialGradient", "stop", "pattern", "marker", "filter", "style",
        "feGaussianBlur", "feOffset", "feColorMatrix", "feBlend", "feComposite", "feFlood", "feMerge", "feMergeNode", "feMorphology", "feDropShadow", "feTurbulence",
        "feComponentTransfer", "feFuncR", "feFuncG", "feFuncB", "feFuncA",
    };

    private static readonly HashSet<string> Attributes = new(StringComparer.Ordinal)
    {
        // identity and structure
        "id", "class", "style", "version", "lang", "role", "aria-label", "aria-hidden", "aria-labelledby", "aria-describedby",
        // geometry
        "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "fx", "fy", "fr", "width", "height", "d", "points", "transform", "viewBox", "preserveAspectRatio", "pathLength",
        // painting
        "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset", "stroke-opacity",
        "opacity", "clip-path", "clip-rule", "mask", "filter", "color", "display", "visibility", "overflow", "marker-start", "marker-mid", "marker-end", "vector-effect",
        "shape-rendering", "text-rendering", "image-rendering", "color-rendering", "color-interpolation", "color-interpolation-filters", "paint-order", "mix-blend-mode", "isolation",
        // text
        "font-family", "font-size", "font-size-adjust", "font-style", "font-variant", "font-weight", "font-stretch", "letter-spacing", "word-spacing", "text-anchor", "text-decoration",
        "dominant-baseline", "alignment-baseline", "baseline-shift", "writing-mode", "direction", "unicode-bidi", "textLength", "lengthAdjust", "dx", "dy", "rotate", "startOffset", "method", "spacing",
        // gradients, patterns, clipping, masks, markers
        "offset", "stop-color", "stop-opacity", "gradientUnits", "gradientTransform", "spreadMethod", "patternUnits", "patternContentUnits", "patternTransform", "clipPathUnits",
        "maskUnits", "maskContentUnits", "markerWidth", "markerHeight", "markerUnits", "refX", "refY", "orient",
        // filters
        "filterUnits", "primitiveUnits", "in", "in2", "result", "stdDeviation", "values", "type", "mode", "operator", "k1", "k2", "k3", "k4", "flood-color", "flood-opacity", "radius",
        "scale", "baseFrequency", "numOctaves", "seed", "stitchTiles", "tableValues", "slope", "intercept", "amplitude", "exponent",
    };

    /// <summary>The elements that may carry a reference (<c>href</c>) to something inside the file.</summary>
    private static readonly HashSet<string> LinkingElements = new(StringComparer.Ordinal) { "use", "image", "linearGradient", "radialGradient", "pattern", "textPath", "filter" };

    [GeneratedRegex(@"^data:image/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=\s]*$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex SafeImageData();

    [GeneratedRegex(@"^#[^\s#()'""]+$", RegexOptions.CultureInvariant)]
    private static partial Regex LocalReference();

    [GeneratedRegex(@"url\(\s*(?<q>['""]?)\s*(?<target>[^)]*)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex UrlFunction();

    [GeneratedRegex(@"/\*.*?\*/", RegexOptions.Singleline | RegexOptions.CultureInvariant)]
    private static partial Regex CssComment();

    [GeneratedRegex(@"<!DOCTYPE\s+svg\s+(?:PUBLIC\s+""[^""\[\]>]*""\s+""[^""\[\]>]*""|SYSTEM\s+""[^""\[\]>]*"")\s*>", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex PlainDoctype();

    [GeneratedRegex(@"^\s*([0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?)\s*(px|pt|pc|mm|cm|in)?\s*$", RegexOptions.CultureInvariant)]
    private static partial Regex Length();

    /// <summary>Checks and cleans an SVG file. The result is either refused (<see cref="Result.Ok"/> false, with a message in German) or a clean file.</summary>
    public static Result Sanitize(ReadOnlySpan<byte> svg)
    {
        if (svg.Length == 0)
        {
            return Refuse("Die Datei ist leer.");
        }

        if (svg.Length > MaxBytes)
        {
            return Refuse("Die SVG-Datei ist größer als 2 MB.");
        }

        if (IsUtf16(svg))
        {
            return Refuse("Die SVG-Datei muss als UTF-8 gespeichert sein (UTF-16 wird nicht angenommen).");
        }

        var text = new UTF8Encoding(false, false).GetString(svg);
        if (text.Length > 0 && text[0] == '﻿')
        {
            text = text[1..];
        }

        var removed = new List<string>();

        // A DOCTYPE of the harmless kind (a public identifier, no internal subset) is dropped; any other is refused by the reader.
        if (PlainDoctype().IsMatch(text))
        {
            text = PlainDoctype().Replace(text, string.Empty, 1);
            removed.Add("DOCTYPE declaration");
        }

        XDocument document;
        try
        {
            var depthError = CheckDepth(text);
            if (depthError is not null)
            {
                return Refuse(depthError);
            }

            using var reader = XmlReader.Create(new StringReader(text), ReaderSettings());
            document = XDocument.Load(reader, LoadOptions.PreserveWhitespace);
        }
        catch (XmlException ex)
        {
            var reason = ex.Message.Contains("DTD", StringComparison.OrdinalIgnoreCase) || ex.Message.Contains("DOCTYPE", StringComparison.OrdinalIgnoreCase)
                ? "Die SVG-Datei enthält eine DOCTYPE- oder Entity-Deklaration. Das wird aus Sicherheitsgründen nicht angenommen."
                : "Das ist keine gültige SVG-Datei (kein wohlgeformtes XML).";
            return Refuse(reason);
        }

        var source = document.Root;
        if (source is null || source.Name.LocalName != "svg")
        {
            return Refuse("Das ist keine SVG-Datei: das Wurzelelement ist nicht <svg>.");
        }

        if (source.Name.Namespace != Svg)
        {
            return Refuse("Das ist keine SVG-Datei: dem <svg>-Element fehlt xmlns=\"http://www.w3.org/2000/svg\".");
        }

        var context = new Context(removed);
        var root = CleanElement(source, context, 1);
        if (context.Error is not null)
        {
            return Refuse(context.Error);
        }

        if (root is null)
        {
            return Refuse("Das ist keine SVG-Datei.");
        }

        if (context.UsesXLink)
        {
            root.SetAttributeValue(XNamespace.Xmlns + "xlink", XLink.NamespaceName);
        }

        var output = new XDocument(root);
        using var stream = new MemoryStream();
        using (var writer = XmlWriter.Create(stream, new XmlWriterSettings { Encoding = new UTF8Encoding(false), OmitXmlDeclaration = true, Indent = false, CloseOutput = false }))
        {
            output.Save(writer);
        }

        var (width, height) = Size(root);
        return new Result(true, stream.ToArray(), null, width, height, Listed(removed));
    }

    private static Result Refuse(string message) => new(false, null, message, null, null, []);

    private static IReadOnlyList<string> Listed(List<string> removed)
    {
        var distinct = removed.Distinct().ToList();
        if (distinct.Count <= MaxRemovedListed)
        {
            return distinct;
        }

        return [.. distinct.Take(MaxRemovedListed), $"... and {distinct.Count - MaxRemovedListed} more"];
    }

    private static bool IsUtf16(ReadOnlySpan<byte> b)
        => b.Length >= 2 && ((b[0] == 0xFF && b[1] == 0xFE) || (b[0] == 0xFE && b[1] == 0xFF) || b.IndexOf((byte)0) is >= 0 and < 64);

    private static XmlReaderSettings ReaderSettings() => new()
    {
        DtdProcessing = DtdProcessing.Prohibit,
        XmlResolver = null,
        MaxCharactersFromEntities = 1024,
        MaxCharactersInDocument = MaxBytes,
        IgnoreComments = true,
        IgnoreProcessingInstructions = true,
        CloseInput = true,
    };

    /// <summary>Reads the file once without building anything and refuses a file that nests deeper than <see cref="MaxDepth"/> or has too many elements.</summary>
    private static string? CheckDepth(string text)
    {
        using var reader = XmlReader.Create(new StringReader(text), ReaderSettings());
        var count = 0;
        while (reader.Read())
        {
            if (reader.NodeType != XmlNodeType.Element)
            {
                continue;
            }

            if (reader.Depth >= MaxDepth)
            {
                return "Die SVG-Datei ist zu tief verschachtelt.";
            }

            if (++count > MaxElements)
            {
                return "Die SVG-Datei hat zu viele Elemente.";
            }
        }

        return null;
    }

    private sealed class Context(List<string> removed)
    {
        public List<string> Removed { get; } = removed;

        public bool UsesXLink { get; set; }

        public int UseCount { get; set; }

        public string? Error { get; set; }
    }

    private static XElement? CleanElement(XElement source, Context context, int depth)
    {
        var name = source.Name.LocalName;
        if (source.Name.Namespace != Svg || !Elements.Contains(name))
        {
            context.Removed.Add("element " + Describe(source.Name));
            return null;
        }

        if (name == "use" && ++context.UseCount > MaxUseElements)
        {
            context.Error = "Die SVG-Datei enthält zu viele <use>-Elemente.";
            return null;
        }

        var clean = new XElement(Svg + name);
        foreach (var attribute in source.Attributes())
        {
            CleanAttribute(name, attribute, clean, context);
        }

        if (name is "use" or "image" && clean.Attribute("href") is null && clean.Attribute(XLink + "href") is null)
        {
            context.Removed.Add($"element {name} without a safe reference");
            return null;
        }

        if (name == "style")
        {
            var css = string.Concat(source.Nodes().OfType<XText>().Select(t => t.Value));
            if (!IsSafeCss(css))
            {
                context.Removed.Add("element style (unsafe rules)");
                return null;
            }

            clean.Add(new XText(css));
            return clean;
        }

        foreach (var node in source.Nodes())
        {
            switch (node)
            {
                case XElement child:
                    var cleanChild = CleanElement(child, context, depth + 1);
                    if (context.Error is not null)
                    {
                        return null;
                    }

                    if (cleanChild is not null)
                    {
                        clean.Add(cleanChild);
                    }

                    break;
                case XText text:
                    // CDATA becomes plain text; the writer escapes it.
                    clean.Add(new XText(text.Value));
                    break;
            }
        }

        return clean;
    }

    private static void CleanAttribute(string element, XAttribute attribute, XElement target, Context context)
    {
        var name = attribute.Name;
        if (attribute.IsNamespaceDeclaration)
        {
            // The namespaces are written again by the writer; xlink is added to the root when it is used.
            return;
        }

        var value = attribute.Value;
        var isHref = (name.Namespace == XNamespace.None && name.LocalName == "href") || name == XLink + "href";
        if (isHref)
        {
            CleanReference(element, name, value, target, context);
            return;
        }

        if (name == XNamespace.Xml + "space" || name == XNamespace.Xml + "lang")
        {
            if (name.LocalName == "space" && value is "preserve" or "default")
            {
                target.SetAttributeValue(name, value);
            }
            else if (name.LocalName == "lang" && value.Length <= 35)
            {
                target.SetAttributeValue(name, value);
            }

            return;
        }

        if (name.Namespace != XNamespace.None)
        {
            context.Removed.Add("attribute " + Describe(name));
            return;
        }

        var local = name.LocalName;
        if (local.StartsWith("on", StringComparison.OrdinalIgnoreCase) || !Attributes.Contains(local))
        {
            context.Removed.Add("attribute " + local);
            return;
        }

        var safe = local == "style" ? IsSafeCss(value) : IsSafeValue(value);
        if (!safe)
        {
            context.Removed.Add($"attribute {local} (unsafe value)");
            return;
        }

        target.SetAttributeValue(name, value);
    }

    private static void CleanReference(string element, XName name, string value, XElement target, Context context)
    {
        var trimmed = value.Trim();
        var allowed = LinkingElements.Contains(element)
            && (LocalReference().IsMatch(trimmed) || (element == "image" && SafeImageData().IsMatch(trimmed)));
        if (!allowed)
        {
            var shown = trimmed.Length > 40 ? trimmed[..40] + "..." : trimmed;
            context.Removed.Add($"href {shown}");
            return;
        }

        if (name.Namespace == XLink)
        {
            context.UsesXLink = true;
        }

        target.SetAttributeValue(name, trimmed);
    }

    /// <summary>A plain attribute value (a paint, a filter, a clip path): no script, no dangerous data URL, no <c>url()</c> that leaves the file.</summary>
    private static bool IsSafeValue(string value) => IsSafeCss(value);

    /// <summary>CSS text (a <c>style</c> element or attribute, or a value that may hold a <c>url()</c>) that loads nothing and runs nothing.</summary>
    internal static bool IsSafeCss(string css)
    {
        var text = CssComment().Replace(css, " ").ToLowerInvariant();
        if (text.Contains('\\') || text.Contains("javascript:", StringComparison.Ordinal) || text.Contains("vbscript:", StringComparison.Ordinal)
            || text.Contains("@import", StringComparison.Ordinal) || text.Contains("@font-face", StringComparison.Ordinal) || text.Contains("@namespace", StringComparison.Ordinal)
            || text.Contains("expression(", StringComparison.Ordinal) || text.Contains("behavior", StringComparison.Ordinal) || text.Contains("-moz-binding", StringComparison.Ordinal)
            || text.Contains("data:text", StringComparison.Ordinal) || text.Contains("data:application", StringComparison.Ordinal) || text.Contains("data:image/svg", StringComparison.Ordinal)
            || text.Contains("<script", StringComparison.Ordinal))
        {
            return false;
        }

        foreach (Match match in UrlFunction().Matches(text))
        {
            if (!match.Groups["target"].Value.TrimStart().StartsWith('#'))
            {
                return false;
            }
        }

        return true;
    }

    private static string Describe(XName name) => name.Namespace == XNamespace.None || name.Namespace == Svg ? name.LocalName : $"{name.NamespaceName}:{name.LocalName}";

    private static (int? Width, int? Height) Size(XElement root)
    {
        var box = ViewBox(root.Attribute("viewBox")?.Value);
        var width = Pixels(root.Attribute("width")?.Value) ?? box?.Width;
        var height = Pixels(root.Attribute("height")?.Value) ?? box?.Height;
        return (ToPixelCount(width), ToPixelCount(height));
    }

    private static int? ToPixelCount(double? value) => value is { } v && v >= 0.5 && v <= 1_000_000 ? (int)Math.Round(v) : null;

    private static double? Pixels(string? text)
    {
        if (text is null)
        {
            return null;
        }

        var match = Length().Match(text);
        if (!match.Success || !double.TryParse(match.Groups[1].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var number))
        {
            return null;
        }

        return match.Groups[2].Value switch
        {
            "pt" => number * 96 / 72,
            "pc" => number * 16,
            "mm" => number * 96 / 25.4,
            "cm" => number * 96 / 2.54,
            "in" => number * 96,
            _ => number,
        };
    }

    private static (double Width, double Height)? ViewBox(string? text)
    {
        if (text is null)
        {
            return null;
        }

        var parts = text.Split([' ', ',', '\t', '\r', '\n'], StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 4
            || !double.TryParse(parts[2], NumberStyles.Float, CultureInfo.InvariantCulture, out var width)
            || !double.TryParse(parts[3], NumberStyles.Float, CultureInfo.InvariantCulture, out var height))
        {
            return null;
        }

        return (width, height);
    }
}
