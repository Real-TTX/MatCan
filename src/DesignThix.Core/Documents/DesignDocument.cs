namespace DesignThix.Core.Documents;

/// <summary>A field of a design: a value that a data list fills in. <see cref="Type"/> is text, multiline, number, price or image.</summary>
public sealed record FieldDef(string Key, string Label, string Type, string Sample, int? Decimals, string? Category, bool Required);

/// <summary>The background of the page: a colour (#rrggbb or #rgb) and optionally the key of an asset drawn over it.</summary>
public sealed record BackgroundDef(string Color, string? Asset, string Fit);

/// <summary>Where an image comes from: the key of an asset, or a field whose value is an asset key. Exactly one of the two is set.</summary>
public sealed record SourceDef(string? Asset, string? Field);

/// <summary>What every element has; <see cref="Type"/> is the discriminator of the JSON (<c>text</c>, <c>image</c>, <c>imageStrip</c>, <c>shape</c>).</summary>
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
}

public sealed record ImageElement : DesignElement
{
    public override string Type => "image";

    public SourceDef? Source { get; init; }

    public string Fit { get; init; } = "contain";

    public double Radius { get; init; }
}

public sealed record ImageStripElement : DesignElement
{
    public override string Type => "imageStrip";

    /// <summary>Up to 12 slots; a slot without a usable source is null and collapses when drawn.</summary>
    public IReadOnlyList<SourceDef?> Items { get; init; } = [];

    public double Gap { get; init; }

    public string Align { get; init; } = "left";
}

public sealed record ShapeElement : DesignElement
{
    public override string Type => "shape";

    public string Shape { get; init; } = "rect";

    public string? Fill { get; init; }

    public string? Stroke { get; init; }

    public double StrokeWidth { get; init; } = 1;

    public string Dash { get; init; } = "solid";

    public double Radius { get; init; }
}

/// <summary>A design as the application stores it (docs/PLAN.md section 2). Build it through <see cref="DocumentValidator"/>, which clamps and fixes everything.</summary>
public sealed record DesignDocument(
    int Schema,
    string Unit,
    double Width,
    double Height,
    int Dpi,
    string Locale,
    BackgroundDef Background,
    IReadOnlyList<FieldDef> Fields,
    IReadOnlyList<DesignElement> Elements);

/// <summary>The outcome of checking a document: either an error (in German) or the normalised document and its JSON, plus warnings about what was fixed.</summary>
public sealed record DocumentResult(bool Ok, string? Error, DesignDocument? Document, string? Json, IReadOnlyList<string> Warnings);
