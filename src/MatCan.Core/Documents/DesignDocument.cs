namespace MatCan.Core.Documents;

/// <summary>A field of a design: a value that a data list fills in. <see cref="Type"/> is text, multiline, number, price or image.</summary>
public sealed record FieldDef(string Key, string Label, string Type, string Sample, int? Decimals, string? Category, bool Required);

/// <summary>One colour stop of a gradient: where (0..1) and which colour (#rrggbb or #rgb).</summary>
public sealed record GradientStop(double Offset, string Color);

/// <summary>A linear gradient: the angle in degrees (0..360) and 2 to 5 stops.</summary>
public sealed record GradientDef(double Angle, IReadOnlyList<GradientStop> Stops)
{
    /// <summary>Two gradients are equal when angle and stops (in order) are.</summary>
    public bool Equals(GradientDef? other) => other is not null && Angle == other.Angle && Stops.SequenceEqual(other.Stops);

    public override int GetHashCode() => HashCode.Combine(Angle, Stops.Count);
}

/// <summary>A fill: a colour or a gradient (never both). A fill that is null on the element means "no fill".</summary>
public sealed record FillDef(string? Color, GradientDef? Gradient)
{
    public static FillDef Of(string color) => new(color, null);
}

/// <summary>The background of a page: a colour and/or a gradient, optionally the key of an asset drawn over them with <see cref="Fit"/>.</summary>
public sealed record BackgroundDef(string? Color, GradientDef? Gradient, string? Asset, string Fit)
{
    public static BackgroundDef White => new("#ffffff", null, null, "cover");
}

/// <summary>Where an image comes from: the key of an asset, or a field whose value is an asset key. Exactly one of the two is set.</summary>
public sealed record SourceDef(string? Asset, string? Field);

/// <summary>A drop shadow. <see cref="Blur"/>, <see cref="X"/> and <see cref="Y"/> are in the unit of the document.</summary>
public sealed record ShadowDef(string Color, double Opacity, double Blur, double X, double Y);

/// <summary>An outline or border: colour and width in points.</summary>
public sealed record LineDef(string Color, double Width);

/// <summary>The box behind a text block: colour, corner radius and padding (the unit of the document).</summary>
public sealed record TextBoxDef(string Color, double Radius, double Padding);

/// <summary>The visible part of an image as fractions (0..1) of its natural size. The default is the whole image.</summary>
public sealed record CropDef(double X, double Y, double W, double H)
{
    public static CropDef Whole => new(0, 0, 1, 1);
}

/// <summary>Colour adjustments of an image: brightness, contrast and saturation from -100 to 100, blur 0..20, grayscale and sepia switches.</summary>
public sealed record FiltersDef(double Brightness, double Contrast, double Saturation, double Blur, bool Grayscale, bool Sepia)
{
    public static FiltersDef None => new(0, 0, 0, 0, false, false);
}

/// <summary>
/// What every element has; <see cref="Type"/> is the discriminator of the JSON (<c>text</c>, <c>image</c>, <c>imageStrip</c>, <c>shape</c>, <c>icon</c>, <c>qr</c>,
/// <c>barcode</c>, <c>group</c>).
/// </summary>
public abstract record DesignElement
{
    public abstract string Type { get; }

    public string Id { get; init; } = "";

    public string Name { get; init; } = "";

    public double X { get; init; }

    public double Y { get; init; }

    public double W { get; init; }

    public double H { get; init; }

    public double Rotation { get; init; }

    public double Opacity { get; init; } = 1;

    public bool Locked { get; init; }

    public bool Hidden { get; init; }

    /// <summary>The element is drawn only when this field has a value.</summary>
    public string? ShowIf { get; init; }

    public bool FlipX { get; init; }

    public bool FlipY { get; init; }

    public ShadowDef? Shadow { get; init; }
}

public sealed record TextElement : DesignElement
{
    public override string Type => "text";

    public string Text { get; init; } = "";

    public string FontFamily { get; init; } = "sans-serif";

    /// <summary>In points, whatever the unit of the document.</summary>
    public double FontSize { get; init; } = 12;

    public int FontWeight { get; init; } = 400;

    public bool Italic { get; init; }

    public bool Underline { get; init; }

    public bool Strike { get; init; }

    /// <summary><c>none</c>, <c>bullet</c> or <c>number</c>.</summary>
    public string List { get; init; } = "none";

    public string Color { get; init; } = "#000000";

    public string Align { get; init; } = "left";

    public string Valign { get; init; } = "top";

    public double LineHeight { get; init; } = 1.2;

    public double LetterSpacing { get; init; }

    public bool Uppercase { get; init; }

    public bool Wrap { get; init; } = true;

    /// <summary><c>none</c> or <c>shrink</c> (the largest size that fits the box, not below <see cref="MinFontSize"/>).</summary>
    public string Fit { get; init; } = "none";

    public double MinFontSize { get; init; } = 4;

    public LineDef? Outline { get; init; }

    public TextBoxDef? Background { get; init; }

    /// <summary>-100..100: 0 is straight, anything else sets the text on a circular arc (one line, no wrap); 100 is a full circle.</summary>
    public double Curve { get; init; }
}

public sealed record ImageElement : DesignElement
{
    public override string Type => "image";

    /// <summary>The picture; null makes the element a frame (an empty slot).</summary>
    public SourceDef? Source { get; init; }

    public string Fit { get; init; } = "contain";

    public CropDef Crop { get; init; } = CropDef.Whole;

    /// <summary><c>none</c>, <c>rounded</c> (uses <see cref="Radius"/>), <c>circle</c>, <c>heart</c>, <c>star</c>, <c>hexagon</c> or <c>triangle</c>.</summary>
    public string Mask { get; init; } = "none";

    public double Radius { get; init; }

    public LineDef? Border { get; init; }

    public FiltersDef Filters { get; init; } = FiltersDef.None;
}

public sealed record ImageStripElement : DesignElement
{
    public override string Type => "imageStrip";

    /// <summary>Up to 12 slots; a slot without a usable source is null and collapses when drawn.</summary>
    public IReadOnlyList<SourceDef?> Items { get; init; } = [];

    public double Gap { get; init; }

    public string Align { get; init; } = "left";

    public string Mask { get; init; } = "none";

    public LineDef? Border { get; init; }
}

public sealed record ShapeElement : DesignElement
{
    public override string Type => "shape";

    public string Shape { get; init; } = "rect";

    /// <summary>Star: number of points 5..12.</summary>
    public int Points { get; init; } = 5;

    /// <summary>Star: inner radius as a fraction of the outer one (0.2..0.9).</summary>
    public double InnerRadius { get; init; } = 0.5;

    public FillDef? Fill { get; init; }

    public string? Stroke { get; init; }

    public double StrokeWidth { get; init; } = 1;

    public string Dash { get; init; } = "solid";

    public double Radius { get; init; }

    /// <summary>Line ends: <c>none</c>, <c>arrow</c>, <c>circle</c> or <c>square</c>.</summary>
    public string StartCap { get; init; } = "none";

    public string EndCap { get; init; } = "none";
}

/// <summary>A Lucide icon by name; the engine gets its body from <c>opts.icon(name)</c>. An empty or unknown name draws a placeholder in the editor, nothing in the output.</summary>
public sealed record IconElement : DesignElement
{
    public override string Type => "icon";

    public string Icon { get; init; } = "";

    public string Color { get; init; } = "#000000";

    /// <summary>In the 24-unit grid of the icon: 0.5..4.</summary>
    public double StrokeWidth { get; init; } = 2;
}

public sealed record QrElement : DesignElement
{
    public override string Type => "qr";

    /// <summary>The content (at most 1000 characters); may contain <c>{{Key}}</c> placeholders.</summary>
    public string Value { get; init; } = "";

    public string Color { get; init; } = "#000000";

    public string? Background { get; init; } = "#ffffff";

    /// <summary>Error correction: L, M, Q or H.</summary>
    public string Ecc { get; init; } = "M";

    /// <summary>A quiet zone of four modules around the code.</summary>
    public bool Quiet { get; init; } = true;
}

public sealed record BarcodeElement : DesignElement
{
    public override string Type => "barcode";

    /// <summary><c>ean13</c>, <c>ean8</c> or <c>code128</c>.</summary>
    public string Format { get; init; } = "ean13";

    /// <summary>The content (at most 80 characters); may contain placeholders. EAN: digits (the check digit is worked out when 12/7 digits are given).</summary>
    public string Value { get; init; } = "";

    public string Color { get; init; } = "#000000";

    public string? Background { get; init; } = "#ffffff";

    public bool ShowText { get; init; } = true;

    public string FontFamily { get; init; } = "sans-serif";
}

/// <summary>
/// A group: its <see cref="Children"/> use page coordinates, the box of the group (<c>x, y, w, h</c>) is the union of theirs; rotation, opacity, flips and shadow of the
/// group apply to the whole around the centre of that box. Groups nest at most three deep.
/// </summary>
public sealed record GroupElement : DesignElement
{
    public override string Type => "group";

    public IReadOnlyList<DesignElement> Children { get; init; } = [];
}

/// <summary>One page of a design: a name (optional), its background and its elements, bottom first.</summary>
public sealed record DesignPage(string Id, string Name, BackgroundDef Background, IReadOnlyList<DesignElement> Elements);

/// <summary>
/// A design as the application stores it (docs/PLAN-CANVA.md section 2). Build it through <see cref="DocumentValidator"/>, which clamps and fixes everything.
/// <see cref="Fold"/> is <c>none</c>, <c>vertical</c> or <c>horizontal</c>: a folded card has its fold line in the middle of every page (plan 6: the editor draws guides, nothing else ever shows it); only written when set.
/// </summary>
public sealed record DesignDocument(
    int Schema,
    string Unit,
    double Width,
    double Height,
    int Dpi,
    string Locale,
    IReadOnlyList<FieldDef> Fields,
    IReadOnlyList<DesignPage> Pages,
    string Fold = "none")
{
    /// <summary>Every element of every page, groups included, with their children (depth first, parents before children).</summary>
    public IEnumerable<DesignElement> AllElements => Pages.SelectMany(p => p.Elements).SelectMany(Flatten);

    /// <summary>The element and all its children, depth first (parents before children).</summary>
    public static IEnumerable<DesignElement> Flatten(DesignElement element)
    {
        yield return element;
        if (element is GroupElement group)
        {
            foreach (var child in group.Children.SelectMany(Flatten))
            {
                yield return child;
            }
        }
    }
}

/// <summary>The outcome of checking a document: either an error (in German) or the normalised document and its JSON, plus warnings about what was fixed.</summary>
public sealed record DocumentResult(bool Ok, string? Error, DesignDocument? Document, string? Json, IReadOnlyList<string> Warnings);
