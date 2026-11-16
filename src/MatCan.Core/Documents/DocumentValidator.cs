using System.Globalization;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Text.Unicode;

namespace MatCan.Core.Documents;

/// <summary>
/// Reads a design document (schema 2, docs/PLAN-CANVA.md section 2) from JSON that may be hostile or just old: a schema 1 document is upgraded (its background and elements
/// become the only page), unknown properties are dropped, numbers clamped, colours and enums replaced by defaults, duplicate ids and keys fixed, limits applied, and the result
/// written again in one canonical form. The rules are those of <c>DtEngine.normalize</c> in <c>wwwroot/js/dt-engine.js</c> (which is the reference: what the browser would draw is
/// what is stored); the server additionally enforces the size limits and refuses a schema newer than it knows.
/// </summary>
public static partial class DocumentValidator
{
    public const int CurrentSchema = 2;
    public const int MaxJsonBytes = 4 * 1024 * 1024;
    public const int MaxPages = 50;
    public const int MaxElementsPerPage = 500;
    public const int MaxElementsTotal = 2000;
    public const int MaxFields = 100;
    public const int MaxStripItems = 12;
    public const int MaxGroupDepth = 3;
    public const int MaxGradientStops = 5;
    private const int MaxJsonDepth = 32;
    private const int MaxWarnings = 20;

    private static readonly string[] FieldTypes = ["text", "multiline", "number", "price", "image"];
    private static readonly string[] ElementTypes = ["text", "image", "imageStrip", "shape", "icon", "qr", "barcode", "group"];
    private static readonly string[] Folds = ["none", "vertical", "horizontal"];
    private static readonly string[] Aligns = ["left", "center", "right"];
    private static readonly string[] Fits = ["cover", "contain", "fill"];
    private static readonly string[] Lists = ["none", "bullet", "number"];
    private static readonly string[] Masks = ["none", "rounded", "circle", "heart", "star", "hexagon", "triangle"];
    private static readonly string[] Shapes = ["rect", "ellipse", "line", "triangle", "diamond", "pentagon", "hexagon", "star", "heart", "arrow", "speech"];
    private static readonly string[] Caps = ["none", "arrow", "circle", "square"];
    private static readonly string[] EccLevels = ["L", "M", "Q", "H"];
    private static readonly string[] BarcodeFormats = ["ean13", "ean8", "code128"];

    [GeneratedRegex("^[A-Za-z][A-Za-z0-9_]{0,39}\\z", RegexOptions.CultureInvariant)]
    private static partial Regex KeyPattern();

    [GeneratedRegex("^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\z", RegexOptions.CultureInvariant)]
    private static partial Regex ColourPattern();

    [GeneratedRegex("^(?:[A-Za-z]{2,3}|[A-Za-z]{5,8})(?:-[A-Za-z0-9]{2,8})*\\z", RegexOptions.CultureInvariant)]
    private static partial Regex LocalePattern();

    [GeneratedRegex("^(?:[a-z0-9-]{1,64}:)?[a-z0-9-]{1,64}\\z", RegexOptions.CultureInvariant)]
    private static partial Regex IconNamePattern();

    /// <summary>An empty document of the given size with the defaults (one white page, 300 dpi).</summary>
    public static DesignDocument Create(double width, double height, string unit = "mm", string locale = "de-DE")
    {
        var kind = unit == "px" ? "px" : "mm";
        return new DesignDocument(CurrentSchema, kind, Math.Clamp(width, 0.1, 100000), Math.Clamp(height, 0.1, 100000), 300, ValidLocale(locale), [], [EmptyPage("p1")]);
    }

    /// <summary>A white page without elements.</summary>
    public static DesignPage EmptyPage(string id) => new(id, "", BackgroundDef.White, []);

    /// <summary>The document read leniently, or null when the text is not a usable document.</summary>
    public static DesignDocument? Parse(string? json) => Validate(json).Document;

    /// <summary>
    /// The JSON of a stored document as schema 2: a document that already is one is returned as it is (no work), an older one is upgraded (lazy upgrade on read, next to the one-time
    /// pass at start-up). Text that cannot be read is returned unchanged.
    /// </summary>
    public static string Current(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return json ?? "";
        }

        try
        {
            using var parsed = JsonDocument.Parse(json, new JsonDocumentOptions { MaxDepth = MaxJsonDepth });
            if (parsed.RootElement.ValueKind == JsonValueKind.Object && SchemaOf(parsed.RootElement) == CurrentSchema && parsed.RootElement.TryGetProperty("pages", out var pages) && pages.ValueKind == JsonValueKind.Array)
            {
                return json;
            }
        }
        catch (JsonException)
        {
            return json;
        }

        return Validate(json).Json ?? json;
    }

    /// <summary>Normalises a document that was built in code (idempotent): through its own JSON, so that exactly the rules of <see cref="Validate"/> apply.</summary>
    public static DesignDocument Normalize(DesignDocument? document)
        => document is null ? Create(100, 100) : Validate(ToJson(document)).Document ?? Create(100, 100);

    /// <summary>Checks and normalises the JSON of a document. See the class description.</summary>
    public static DocumentResult Validate(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return Failed("Das Design ist leer.");
        }

        if (Encoding.UTF8.GetByteCount(json) > MaxJsonBytes)
        {
            return Failed("Das Design ist größer als 4 MB.");
        }

        JsonDocument parsed;
        try
        {
            parsed = JsonDocument.Parse(json, new JsonDocumentOptions { MaxDepth = MaxJsonDepth });
        }
        catch (JsonException ex)
        {
            return Failed(ex.Message.Contains("depth", StringComparison.OrdinalIgnoreCase) ? "Das Design ist zu tief verschachtelt." : "Das Design ist kein gültiges JSON.");
        }

        using (parsed)
        {
            if (parsed.RootElement.ValueKind != JsonValueKind.Object)
            {
                return Failed("Das Design muss ein JSON-Objekt sein.");
            }

            var schema = SchemaOf(parsed.RootElement);
            if (schema > CurrentSchema)
            {
                return Failed($"Das Design stammt aus einer neueren Version von MatCan (Schema {schema}). Bitte aktualisiere MatCan.");
            }

            var notes = new Notes();
            var document = Read(parsed.RootElement, notes);
            return new DocumentResult(true, null, document, ToJson(document), notes.Messages());
        }
    }

    private static DocumentResult Failed(string message) => new(false, message, null, null, []);

    /// <summary>The schema a document declares (a number; 1 without one). Only a schema newer than this server knows is refused: the shape decides how a document is read (pages or not).</summary>
    private static int SchemaOf(JsonElement root)
    {
        if (root.TryGetProperty("schema", out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetDouble(out var n) && double.IsFinite(n))
        {
            return n >= int.MaxValue ? int.MaxValue : n <= 1 ? 1 : (int)Math.Floor(n);
        }

        return 1;
    }

    // ------------------------------------------------------------------------------------------------ reading

    /// <summary>What the reading of one document shares: the notes, the unit factor, the ids in use and how many elements may still come.</summary>
    private sealed class Context(Notes notes, bool isPx)
    {
        public Notes Notes { get; } = notes;

        public bool IsPx { get; } = isPx;

        public HashSet<string> UsedIds { get; } = new(StringComparer.Ordinal);

        public int PageLeft { get; set; } = MaxElementsPerPage;

        public int TotalLeft { get; set; } = MaxElementsTotal;
    }

    private static DesignDocument Read(JsonElement source, Notes notes)
    {
        var unit = Str(source, "unit", "mm", 10, null) == "px" ? "px" : "mm";
        var defaultSize = unit == "px" ? 800 : 100;
        var context = new Context(notes, unit == "px");

        var fields = new List<FieldDef>();
        var seenKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var rawFields = Items(source, "fields");
        foreach (var raw in rawFields)
        {
            var field = ReadField(raw, notes);
            if (field is null)
            {
                notes.Add(Notes.BadField);
                continue;
            }

            if (!seenKeys.Add(field.Key))
            {
                notes.Add(Notes.DuplicateField);
                continue;
            }

            fields.Add(field);
            if (fields.Count >= MaxFields)
            {
                break;
            }
        }

        if (fields.Count >= MaxFields && rawFields.Count > MaxFields)
        {
            notes.Truncated.Add($"Es wurden nur die ersten {MaxFields} Felder übernommen.");
        }

        // The upgrade from schema 1 (a document without a list of pages): the background and the elements of the document become the one page.
        var pages = new List<DesignPage>();
        var usedPageIds = new HashSet<string>(StringComparer.Ordinal);
        if (!(source.TryGetProperty("pages", out var pageList) && pageList.ValueKind == JsonValueKind.Array))
        {
            pages.Add(ReadPage(source, 0, true, usedPageIds, context));
        }
        else
        {
            var rawPages = Items(source, "pages");
            if (rawPages.Count > MaxPages)
            {
                notes.Truncated.Add($"Es wurden nur die ersten {MaxPages} Seiten übernommen.");
            }

            for (var i = 0; i < Math.Min(rawPages.Count, MaxPages); i++)
            {
                // something that is no object is a page without content (as the engine reads it)
                pages.Add(ReadPage(rawPages[i], i, false, usedPageIds, context));
            }

            if (pages.Count == 0)
            {
                pages.Add(EmptyPage("p1"));
            }
        }

        return new DesignDocument(
            CurrentSchema,
            unit,
            Num(source, "width", defaultSize, 0.1, 100000, notes),
            Num(source, "height", defaultSize, 0.1, 100000, notes),
            (int)Math.Floor(Num(source, "dpi", 300, 72, 1200, notes) + 0.5),
            ValidLocale(Str(source, "locale", "de-DE", 35, null)),
            fields,
            pages,
            OneOf(source, "fold", Folds, "none", notes));
    }

    private static DesignPage ReadPage(JsonElement raw, int index, bool upgraded, HashSet<string> usedPageIds, Context context)
    {
        var notes = context.Notes;
        string id;
        if (upgraded)
        {
            id = "p1";
        }
        else
        {
            id = TryString(raw, "id", out var rawId) && rawId.Length > 0 ? Slice(rawId, 24) : "";
            if (id.Length == 0 || usedPageIds.Contains(id))
            {
                if (id.Length > 0)
                {
                    notes.Add(Notes.DuplicateId);
                }

                var n = index + 1;
                while (usedPageIds.Contains("p" + n.ToString(CultureInfo.InvariantCulture)))
                {
                    n++;
                }

                id = "p" + n.ToString(CultureInfo.InvariantCulture);
            }
        }

        usedPageIds.Add(id);
        var background = Obj(raw, "background");
        context.PageLeft = MaxElementsPerPage;
        return new DesignPage(
            id,
            upgraded ? "" : Str(raw, "name", "", 80, notes),
            ReadBackground(background, notes),
            ReadElements(Items(raw, "elements"), 1, context));
    }

    private static BackgroundDef ReadBackground(JsonElement background, Notes notes)
        => new(
            Colour(background, "color", "#ffffff", true, notes),
            background.ValueKind == JsonValueKind.Object && background.TryGetProperty("gradient", out var gradient) ? ReadGradient(gradient, notes) : null,
            AssetKey(background, "asset"),
            OneOf(background, "fit", Fits, "cover", notes));

    private static FieldDef? ReadField(JsonElement raw, Notes notes)
    {
        if (raw.ValueKind != JsonValueKind.Object || !TryString(raw, "key", out var key) || !KeyPattern().IsMatch(key))
        {
            return null;
        }

        var type = OneOf(raw, "type", FieldTypes, "text", notes);
        int? decimals = null;
        if (raw.TryGetProperty("decimals", out var d))
        {
            decimals = DecimalsOf(d, notes);
        }

        if (type == "price" && decimals is null)
        {
            decimals = 2;
        }

        var label = Str(raw, "label", key, 80, notes);
        var category = TryString(raw, "category", out var c) && c.Length > 0 ? Slice(c, 80) : null;
        return new FieldDef(
            key,
            label.Length == 0 ? key : label,
            type,
            Str(raw, "sample", "", 2000, notes),
            type is "price" or "number" ? decimals : null,
            category,
            raw.TryGetProperty("required", out var required) && required.ValueKind == JsonValueKind.True);
    }

    /// <summary>Mirrors <c>Number(raw.decimals)</c> being finite in the engine: numbers and numeric text count, anything else means "not set".</summary>
    private static int? DecimalsOf(JsonElement value, Notes notes)
    {
        switch (value.ValueKind)
        {
            case JsonValueKind.Number when value.TryGetDouble(out var n) && double.IsFinite(n):
                return (int)Math.Floor(Clamp(n, 0, 4, notes) + 0.5);
            case JsonValueKind.String:
                var text = value.GetString() ?? "";
                if (text.Trim().Length == 0)
                {
                    return 2;
                }

                return double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed) && double.IsFinite(parsed)
                    ? (int)Math.Floor(Clamp(parsed, 0, 4, notes) + 0.5)
                    : null;
            case JsonValueKind.True or JsonValueKind.False:
                return 2;
            default:
                return null;
        }
    }

    private static SourceDef? ReadSource(JsonElement raw)
    {
        if (raw.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        if (TryString(raw, "asset", out var asset) && asset.Trim().Length > 0)
        {
            return new SourceDef(Slice(asset.Trim(), 200), null);
        }

        return TryString(raw, "field", out var field) && KeyPattern().IsMatch(field) ? new SourceDef(null, field) : null;
    }

    /// <summary>
    /// The elements of a page or a group, bottom first. Every element that is taken (a group and each of its children count one each) is paid from the budget of the
    /// page and of the document; what does not fit is dropped with a note.
    /// </summary>
    private static List<DesignElement> ReadElements(List<JsonElement> raws, int depth, Context context)
    {
        var elements = new List<DesignElement>();
        for (var i = 0; i < raws.Count; i++)
        {
            if (context.PageLeft <= 0 || context.TotalLeft <= 0)
            {
                if (context.PageLeft <= 0)
                {
                    context.Notes.Truncated.Add($"Es wurden nur die ersten {MaxElementsPerPage} Elemente einer Seite übernommen.");
                }
                else
                {
                    context.Notes.Truncated.Add($"Es wurden nur {MaxElementsTotal} Elemente insgesamt übernommen.");
                }

                break;
            }

            var raw = raws[i];
            if (depth > MaxGroupDepth && raw.ValueKind == JsonValueKind.Object && TryString(raw, "type", out var kind) && kind == "group")
            {
                context.Notes.Add(Notes.GroupTooDeep);
                continue;
            }

            var element = ReadElement(raw, i, depth, context);
            if (element is null)
            {
                context.Notes.Add(Notes.BadElement);
                continue;
            }

            elements.Add(element);
        }

        return elements;
    }

    private static DesignElement? ReadElement(JsonElement raw, int index, int depth, Context context)
    {
        if (raw.ValueKind != JsonValueKind.Object || !TryString(raw, "type", out var type) || !ElementTypes.Contains(type))
        {
            return null;
        }

        var notes = context.Notes;
        context.PageLeft--;
        context.TotalLeft--;

        var id = TryString(raw, "id", out var rawId) && rawId.Length > 0 ? Slice(rawId, 24) : "";
        if (id.Length == 0 || context.UsedIds.Contains(id))
        {
            if (id.Length > 0)
            {
                notes.Add(Notes.DuplicateId);
            }

            var n = index + 1;
            while (context.UsedIds.Contains("e" + n.ToString(CultureInfo.InvariantCulture)))
            {
                n++;
            }

            id = "e" + n.ToString(CultureInfo.InvariantCulture);
        }

        context.UsedIds.Add(id);

        var name = Str(raw, "name", "", 80, notes);
        var x = Num(raw, "x", 0, -1e6, 1e6, notes);
        var y = Num(raw, "y", 0, -1e6, 1e6, notes);
        var w = Num(raw, "w", 0, 0, 1e6, notes);
        var h = Num(raw, "h", 0, 0, 1e6, notes);
        var rotation = Num(raw, "rotation", 0, -360, 360, notes);
        var opacity = Num(raw, "opacity", 1, 0, 1, notes);
        var locked = IsTrue(raw, "locked");
        var hidden = IsTrue(raw, "hidden");
        var showIf = TryString(raw, "showIf", out var show) && KeyPattern().IsMatch(show) ? show : null;
        var flipX = IsTrue(raw, "flipX");
        var flipY = IsTrue(raw, "flipY");
        var shadow = ReadShadow(raw, context);

        switch (type)
        {
            case "text":
                var fontSize = Num(raw, "fontSize", 12, 1, 1000, notes);
                var family = Str(raw, "fontFamily", "sans-serif", 100, notes);
                return new TextElement
                {
                    Id = id, Name = name, X = x, Y = y, W = w, H = h, Rotation = rotation, Opacity = opacity, Locked = locked, Hidden = hidden, ShowIf = showIf, FlipX = flipX, FlipY = flipY, Shadow = shadow,
                    Text = Str(raw, "text", "", 5000, notes),
                    FontFamily = family.Length == 0 ? "sans-serif" : family,
                    FontSize = fontSize,
                    FontWeight = (int)Math.Floor(Num(raw, "fontWeight", 400, 100, 900, notes) + 0.5),
                    Italic = IsTrue(raw, "italic"),
                    Underline = IsTrue(raw, "underline"),
                    Strike = IsTrue(raw, "strike"),
                    List = OneOf(raw, "list", Lists, "none", notes),
                    Color = Colour(raw, "color", "#000000", false, notes) ?? "#000000",
                    Align = OneOf(raw, "align", Aligns, "left", notes),
                    Valign = OneOf(raw, "valign", ["top", "middle", "bottom"], "top", notes),
                    LineHeight = Num(raw, "lineHeight", 1.2, 0.5, 3, notes),
                    LetterSpacing = Num(raw, "letterSpacing", 0, -0.5, 2, notes),
                    Uppercase = IsTrue(raw, "uppercase"),
                    Wrap = !(raw.TryGetProperty("wrap", out var wrap) && wrap.ValueKind == JsonValueKind.False),
                    Fit = OneOf(raw, "fit", ["none", "shrink"], "none", notes),
                    MinFontSize = Math.Min(fontSize, Num(raw, "minFontSize", 4, 0.5, 1000, notes)),
                    Outline = ReadLine(raw, "outline", notes),
                    Background = ReadTextBox(raw, notes),
                    Curve = Num(raw, "curve", 0, -100, 100, notes),
                };

            case "image":
                return new ImageElement
                {
                    Id = id, Name = name, X = x, Y = y, W = w, H = h, Rotation = rotation, Opacity = opacity, Locked = locked, Hidden = hidden, ShowIf = showIf, FlipX = flipX, FlipY = flipY, Shadow = shadow,
                    Source = raw.TryGetProperty("source", out var source) ? ReadSource(source) : null,
                    Fit = OneOf(raw, "fit", Fits, "contain", notes),
                    Crop = ReadCrop(raw, notes),
                    Mask = OneOf(raw, "mask", Masks, "none", notes),
                    Radius = Num(raw, "radius", 0, 0, 1e6, notes),
                    Border = ReadLine(raw, "border", notes),
                    Filters = ReadFilters(raw, notes),
                };

            case "imageStrip":
                var items = new List<SourceDef?>();
                var rawItems = Items(raw, "items");
                if (rawItems.Count > MaxStripItems)
                {
                    notes.Add(Notes.StripTruncated);
                }

                foreach (var item in rawItems.Take(MaxStripItems))
                {
                    items.Add(ReadSource(item));
                }

                return new ImageStripElement
                {
                    Id = id, Name = name, X = x, Y = y, W = w, H = h, Rotation = rotation, Opacity = opacity, Locked = locked, Hidden = hidden, ShowIf = showIf, FlipX = flipX, FlipY = flipY, Shadow = shadow,
                    Items = items,
                    Gap = Num(raw, "gap", 0, 0, 1e6, notes),
                    Align = OneOf(raw, "align", Aligns, "left", notes),
                    Mask = OneOf(raw, "mask", Masks, "none", notes),
                    Border = ReadLine(raw, "border", notes),
                };

            case "icon":
                return new IconElement
                {
                    Id = id, Name = name, X = x, Y = y, W = w, H = h, Rotation = rotation, Opacity = opacity, Locked = locked, Hidden = hidden, ShowIf = showIf, FlipX = flipX, FlipY = flipY, Shadow = shadow,
                    Icon = ReadIconName(raw, notes),
                    Color = Colour(raw, "color", "#000000", false, notes) ?? "#000000",
                    StrokeWidth = Num(raw, "strokeWidth", 2, 0.5, 4, notes),
                };

            case "qr":
                return new QrElement
                {
                    Id = id, Name = name, X = x, Y = y, W = w, H = h, Rotation = rotation, Opacity = opacity, Locked = locked, Hidden = hidden, ShowIf = showIf, FlipX = flipX, FlipY = flipY, Shadow = shadow,
                    Value = Str(raw, "value", "", 1000, notes),
                    Color = Colour(raw, "color", "#000000", false, notes) ?? "#000000",
                    Background = Colour(raw, "background", "#ffffff", true, notes),
                    Ecc = OneOf(raw, "ecc", EccLevels, "M", notes),
                    Quiet = !(raw.TryGetProperty("quiet", out var quiet) && quiet.ValueKind == JsonValueKind.False),
                };

            case "barcode":
                var barcodeFamily = Str(raw, "fontFamily", "sans-serif", 100, notes);
                return new BarcodeElement
                {
                    Id = id, Name = name, X = x, Y = y, W = w, H = h, Rotation = rotation, Opacity = opacity, Locked = locked, Hidden = hidden, ShowIf = showIf, FlipX = flipX, FlipY = flipY, Shadow = shadow,
                    Format = OneOf(raw, "format", BarcodeFormats, "ean13", notes),
                    Value = Str(raw, "value", "", 80, notes),
                    Color = Colour(raw, "color", "#000000", false, notes) ?? "#000000",
                    Background = Colour(raw, "background", "#ffffff", true, notes),
                    ShowText = !(raw.TryGetProperty("showText", out var showText) && showText.ValueKind == JsonValueKind.False),
                    FontFamily = barcodeFamily.Length == 0 ? "sans-serif" : barcodeFamily,
                };

            case "group":
                return new GroupElement
                {
                    Id = id, Name = name, X = x, Y = y, W = w, H = h, Rotation = rotation, Opacity = opacity, Locked = locked, Hidden = hidden, ShowIf = showIf, FlipX = flipX, FlipY = flipY, Shadow = shadow,
                    Children = ReadElements(Items(raw, "children"), depth + 1, context),
                };

            default:
                var shape = OneOf(raw, "shape", Shapes, "rect", notes);
                return new ShapeElement
                {
                    Id = id, Name = name, X = x, Y = y, W = w, H = h, Rotation = rotation, Opacity = opacity, Locked = locked, Hidden = hidden, ShowIf = showIf, FlipX = flipX, FlipY = flipY, Shadow = shadow,
                    Shape = shape,
                    Points = (int)Math.Floor(Num(raw, "points", 5, 5, 12, notes) + 0.5),
                    InnerRadius = Num(raw, "innerRadius", 0.5, 0.2, 0.9, notes),
                    Fill = ReadFill(raw, "fill", notes),
                    Stroke = Colour(raw, "stroke", shape == "line" ? "#000000" : null, true, notes),
                    StrokeWidth = Num(raw, "strokeWidth", 1, 0, 1000, notes),
                    Dash = OneOf(raw, "dash", ["solid", "dashed", "dotted"], "solid", notes),
                    Radius = Num(raw, "radius", 0, 0, 1e6, notes),
                    StartCap = OneOf(raw, "startCap", Caps, "none", notes),
                    EndCap = OneOf(raw, "endCap", Caps, "none", notes),
                };
        }
    }

    // ------------------------------------------------------------------------------------------------ the parts of an element

    private static string ReadIconName(JsonElement raw, Notes notes)
    {
        if (!TryString(raw, "icon", out var text))
        {
            return "";
        }

        if (text.Length == 0)
        {
            return "";
        }

        // exactly as written: the names of Lucide are lower case; "prefix:name" is an icon of a catalogue (Iconify); anything else is no icon
        if (!IconNamePattern().IsMatch(text))
        {
            notes.Add(Notes.BadValue);
            return "";
        }

        return text;
    }

    private static ShadowDef? ReadShadow(JsonElement raw, Context context)
    {
        if (!raw.TryGetProperty("shadow", out var value) || value.ValueKind == JsonValueKind.Null)
        {
            return null;
        }

        var notes = context.Notes;
        if (value.ValueKind != JsonValueKind.Object)
        {
            notes.Add(Notes.BadValue);
            return null;
        }

        return new ShadowDef(
            Colour(value, "color", "#000000", false, notes) ?? "#000000",
            Num(value, "opacity", 0.5, 0, 1, notes),
            Num(value, "blur", 0, 0, context.IsPx ? 200 : 50, notes),
            Num(value, "x", 0, -1000, 1000, notes),
            Num(value, "y", 0, -1000, 1000, notes));
    }

    /// <summary>An outline or a border: <c>{ color, width }</c> in points, or null (also for anything that is not an object).</summary>
    private static LineDef? ReadLine(JsonElement raw, string name, Notes notes)
    {
        if (!raw.TryGetProperty(name, out var value) || value.ValueKind == JsonValueKind.Null)
        {
            return null;
        }

        if (value.ValueKind != JsonValueKind.Object)
        {
            notes.Add(Notes.BadValue);
            return null;
        }

        return new LineDef(Colour(value, "color", "#000000", false, notes) ?? "#000000", Num(value, "width", 1, 0, 100, notes));
    }

    private static TextBoxDef? ReadTextBox(JsonElement raw, Notes notes)
    {
        if (!raw.TryGetProperty("background", out var value) || value.ValueKind == JsonValueKind.Null)
        {
            return null;
        }

        if (value.ValueKind != JsonValueKind.Object)
        {
            notes.Add(Notes.BadValue);
            return null;
        }

        return new TextBoxDef(Colour(value, "color", "#ffffff", false, notes) ?? "#ffffff", Num(value, "radius", 0, 0, 1e6, notes), Num(value, "padding", 0, 0, 1e6, notes));
    }

    /// <summary>The visible part of an image: x and y 0..0.999, w and h 0.001..1 and never beyond the edge of the image. Missing = the whole image.</summary>
    private static CropDef ReadCrop(JsonElement raw, Notes notes)
    {
        var value = Obj(raw, "crop");
        if (value.ValueKind != JsonValueKind.Object)
        {
            if (raw.TryGetProperty("crop", out var present) && present.ValueKind != JsonValueKind.Null)
            {
                notes.Add(Notes.BadValue);
            }

            return CropDef.Whole;
        }

        var x = Num(value, "x", 0, 0, 0.999, notes);
        var y = Num(value, "y", 0, 0, 0.999, notes);
        var w = Math.Min(Num(value, "w", 1, 0.001, 1, notes), 1 - x);
        var h = Math.Min(Num(value, "h", 1, 0.001, 1, notes), 1 - y);
        return new CropDef(x, y, Fix(w), Fix(h));
    }

    private static FiltersDef ReadFilters(JsonElement raw, Notes notes)
    {
        var value = Obj(raw, "filters");
        if (value.ValueKind != JsonValueKind.Object)
        {
            if (raw.TryGetProperty("filters", out var present) && present.ValueKind != JsonValueKind.Null)
            {
                notes.Add(Notes.BadValue);
            }

            return FiltersDef.None;
        }

        return new FiltersDef(
            Num(value, "brightness", 0, -100, 100, notes),
            Num(value, "contrast", 0, -100, 100, notes),
            Num(value, "saturation", 0, -100, 100, notes),
            Num(value, "blur", 0, 0, 20, notes),
            IsTrue(value, "grayscale"),
            IsTrue(value, "sepia"));
    }

    /// <summary>A fill: a colour, a gradient or null. A value that is none of them gives null (no fill) and a note.</summary>
    private static FillDef? ReadFill(JsonElement parent, string name, Notes notes)
    {
        if (parent.ValueKind != JsonValueKind.Object || !parent.TryGetProperty(name, out var value) || value.ValueKind == JsonValueKind.Null)
        {
            return null;
        }

        if (value.ValueKind == JsonValueKind.Object)
        {
            var gradient = ReadGradient(value, notes);
            return gradient is null ? null : new FillDef(null, gradient);
        }

        if (value.ValueKind == JsonValueKind.String && value.GetString() is { } text && ColourPattern().IsMatch(text.Trim()))
        {
            return FillDef.Of(text.Trim().ToLowerInvariant());
        }

        notes.Add(Notes.BadColour);
        return null;
    }

    /// <summary>A linear gradient with 2 to 5 stops; anything else (another type, fewer than two usable stops) gives null.</summary>
    private static GradientDef? ReadGradient(JsonElement raw, Notes notes)
    {
        if (raw.ValueKind == JsonValueKind.Null || raw.ValueKind == JsonValueKind.Undefined)
        {
            return null;
        }

        if (raw.ValueKind != JsonValueKind.Object)
        {
            notes.Add(Notes.BadValue);
            return null;
        }

        var stops = new List<GradientStop>();
        var rawStops = Items(raw, "stops");
        foreach (var stop in rawStops)
        {
            if (stop.ValueKind != JsonValueKind.Object)
            {
                notes.Add(Notes.BadValue);
                continue;
            }

            var color = Colour(stop, "color", null, false, notes);
            if (color is null)
            {
                continue;
            }

            if (stops.Count >= MaxGradientStops)
            {
                notes.Add(Notes.StopsTruncated);
                break;
            }

            stops.Add(new GradientStop(Num(stop, "offset", 0, 0, 1, notes), color));
        }

        if (stops.Count < 2)
        {
            notes.Add(Notes.BadValue);
            return null;
        }

        return new GradientDef(Num(raw, "angle", 0, 0, 360, notes), stops);
    }

    // ------------------------------------------------------------------------------------------------ the helpers of the engine (num, str, oneOf, colour)

    private static JsonElement Obj(JsonElement parent, string name)
        => parent.ValueKind == JsonValueKind.Object && parent.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Object ? value : default;

    private static List<JsonElement> Items(JsonElement parent, string name)
        => parent.ValueKind == JsonValueKind.Object && parent.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Array ? [.. value.EnumerateArray()] : [];

    private static bool TryString(JsonElement parent, string name, out string value)
    {
        if (parent.ValueKind == JsonValueKind.Object && parent.TryGetProperty(name, out var element) && element.ValueKind == JsonValueKind.String)
        {
            value = element.GetString() ?? "";
            return true;
        }

        value = "";
        return false;
    }

    private static bool IsTrue(JsonElement parent, string name)
        => parent.ValueKind == JsonValueKind.Object && parent.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.True;

    private static string Slice(string text, int max) => text.Length > max ? text[..max] : text;

    private static double Clamp(double value, double min, double max, Notes? notes)
    {
        var clamped = Math.Clamp(value, min, max);
        if (clamped != value)
        {
            notes?.Add(Notes.Clamped);
        }

        return clamped;
    }

    /// <summary>A finite number clamped to the range; numbers as text count, everything else gives the fallback.</summary>
    private static double Num(JsonElement parent, string name, double fallback, double min, double max, Notes notes)
    {
        if (parent.ValueKind != JsonValueKind.Object || !parent.TryGetProperty(name, out var value))
        {
            return Fix(Math.Clamp(fallback, min, max));
        }

        double n;
        switch (value.ValueKind)
        {
            case JsonValueKind.Number when value.TryGetDouble(out n) && double.IsFinite(n):
                break;
            case JsonValueKind.String when double.TryParse(value.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out n) && double.IsFinite(n) && value.GetString()!.Trim().Length > 0:
                break;
            default:
                if (value.ValueKind != JsonValueKind.Null)
                {
                    notes.Add(Notes.BadValue);
                }

                return Fix(Math.Clamp(fallback, min, max));
        }

        return Fix(Clamp(n, min, max, notes));
    }

    private static double Fix(double value) => value == 0 ? 0 : value;

    private static string Str(JsonElement parent, string name, string fallback, int max, Notes? notes)
    {
        if (!TryString(parent, name, out var value))
        {
            if (notes is not null && parent.ValueKind == JsonValueKind.Object && parent.TryGetProperty(name, out var other) && other.ValueKind is not (JsonValueKind.Null or JsonValueKind.Undefined))
            {
                notes.Add(Notes.BadValue);
            }

            return fallback;
        }

        if (value.Length > max)
        {
            notes?.Add(Notes.Clamped);
            return value[..max];
        }

        return value;
    }

    private static string OneOf(JsonElement parent, string name, string[] allowed, string fallback, Notes notes)
    {
        if (!TryString(parent, name, out var value) || !allowed.Contains(value))
        {
            if (parent.ValueKind == JsonValueKind.Object && parent.TryGetProperty(name, out var present) && present.ValueKind != JsonValueKind.Null)
            {
                notes.Add(Notes.BadValue);
            }

            return fallback;
        }

        return value;
    }

    /// <summary>A colour as #rgb or #rrggbb in lower case. A JSON null stays null when allowed; a missing or invalid value gives the fallback.</summary>
    private static string? Colour(JsonElement parent, string name, string? fallback, bool allowNull, Notes notes)
    {
        if (parent.ValueKind != JsonValueKind.Object || !parent.TryGetProperty(name, out var value))
        {
            return fallback;
        }

        if (value.ValueKind == JsonValueKind.Null)
        {
            return allowNull ? null : fallback;
        }

        if (value.ValueKind == JsonValueKind.String && value.GetString() is { } text && ColourPattern().IsMatch(text.Trim()))
        {
            return text.Trim().ToLowerInvariant();
        }

        notes.Add(Notes.BadColour);
        return fallback;
    }

    private static string? AssetKey(JsonElement parent, string name)
        => TryString(parent, name, out var value) && value.Trim().Length > 0 ? Slice(value.Trim(), 200) : null;

    private static string ValidLocale(string? value)
        => !string.IsNullOrEmpty(value) && value.Length <= 35 && LocalePattern().IsMatch(value) ? value : "de-DE";

    // ------------------------------------------------------------------------------------------------ warnings

    private sealed class Notes
    {
        public const string BadField = "badField";
        public const string DuplicateField = "duplicateField";
        public const string BadElement = "badElement";
        public const string DuplicateId = "duplicateId";
        public const string BadValue = "badValue";
        public const string BadColour = "badColour";
        public const string Clamped = "clamped";
        public const string StripTruncated = "stripTruncated";
        public const string StopsTruncated = "stopsTruncated";
        public const string GroupTooDeep = "groupTooDeep";

        private static readonly (string Key, string Text)[] Texts =
        [
            (BadField, "Felder mit ungültigem Schlüssel wurden entfernt"),
            (DuplicateField, "doppelte Felder wurden entfernt"),
            (BadElement, "Elemente mit unbekanntem Typ wurden entfernt"),
                (GroupTooDeep, "zu tief verschachtelte Gruppen wurden entfernt"),
            (DuplicateId, "doppelte Kennungen wurden ersetzt"),
            (BadValue, "ungültige Werte wurden durch Standardwerte ersetzt"),
            (BadColour, "ungültige Farben wurden ersetzt"),
            (Clamped, "Werte außerhalb des erlaubten Bereichs wurden begrenzt"),
            (StripTruncated, "Bildleisten wurden auf 12 Bilder gekürzt"),
            (StopsTruncated, "Verläufe wurden auf 5 Farben gekürzt"),
        ];

        private readonly Dictionary<string, int> _counts = [];

        public TruncatedList Truncated { get; } = new();

        public void Add(string key) => _counts[key] = _counts.GetValueOrDefault(key) + 1;

        public IReadOnlyList<string> Messages()
        {
            var all = new List<string>(Truncated.Ordered);
            foreach (var (key, text) in Texts)
            {
                if (_counts.TryGetValue(key, out var count))
                {
                    all.Add($"{count}x: {text}.");
                }
            }

            return all.Count <= MaxWarnings ? all : [.. all.Take(MaxWarnings), $"... und {all.Count - MaxWarnings} weitere"];
        }
    }

    /// <summary>A list of messages in which every message stands once (a page that is cut says so once, however many elements it drops).</summary>
    private sealed class TruncatedList
    {
        private readonly HashSet<string> _seen = [];

        public List<string> Ordered { get; } = [];

        public void Add(string message)
        {
            if (_seen.Add(message))
            {
                Ordered.Add(message);
            }
        }
    }

    // ------------------------------------------------------------------------------------------------ writing

    private static readonly JavaScriptEncoder Encoder = JavaScriptEncoder.Create(UnicodeRanges.All);

    /// <summary>The compact JSON of a document, in the shape the engine produces (camelCase; nulls where the engine writes them).</summary>
    public static string ToJson(DesignDocument document)
    {
        using var stream = new MemoryStream();
        using (var w = new Utf8JsonWriter(stream, new JsonWriterOptions { Encoder = Encoder, Indented = false }))
        {
            w.WriteStartObject();
            w.WriteNumber("schema", CurrentSchema);
            w.WriteString("unit", document.Unit);
            w.WriteNumber("width", Fix(document.Width));
            w.WriteNumber("height", Fix(document.Height));
            w.WriteNumber("dpi", document.Dpi);
            w.WriteString("locale", document.Locale);
            if (document.Fold is "vertical" or "horizontal")
            {
                w.WriteString("fold", document.Fold);
            }

            w.WriteStartArray("fields");
            foreach (var f in document.Fields)
            {
                w.WriteStartObject();
                w.WriteString("key", f.Key);
                w.WriteString("label", f.Label);
                w.WriteString("type", f.Type);
                w.WriteString("sample", f.Sample);
                if (f.Decimals is { } d) { w.WriteNumber("decimals", d); } else { w.WriteNull("decimals"); }
                WriteNullable(w, "category", f.Category);
                w.WriteBoolean("required", f.Required);
                w.WriteEndObject();
            }

            w.WriteEndArray();
            w.WriteStartArray("pages");
            foreach (var page in document.Pages)
            {
                w.WriteStartObject();
                w.WriteString("id", page.Id);
                w.WriteString("name", page.Name);
                w.WritePropertyName("background");
                WriteBackground(w, page.Background);
                w.WriteStartArray("elements");
                foreach (var e in page.Elements)
                {
                    WriteElement(w, e);
                }

                w.WriteEndArray();
                w.WriteEndObject();
            }

            w.WriteEndArray();
            w.WriteEndObject();
        }

        return Encoding.UTF8.GetString(stream.ToArray());
    }

    private static void WriteNullable(Utf8JsonWriter w, string name, string? value)
    {
        if (value is null) { w.WriteNull(name); } else { w.WriteString(name, value); }
    }

    private static void WriteBackground(Utf8JsonWriter w, BackgroundDef background)
    {
        w.WriteStartObject();
        WriteNullable(w, "color", background.Color);
        w.WritePropertyName("gradient");
        WriteGradient(w, background.Gradient);
        WriteNullable(w, "asset", background.Asset);
        w.WriteString("fit", background.Fit);
        w.WriteEndObject();
    }

    private static void WriteGradient(Utf8JsonWriter w, GradientDef? gradient)
    {
        if (gradient is null)
        {
            w.WriteNullValue();
            return;
        }

        w.WriteStartObject();
        w.WriteString("type", "linear");
        w.WriteNumber("angle", Fix(gradient.Angle));
        w.WriteStartArray("stops");
        foreach (var stop in gradient.Stops)
        {
            w.WriteStartObject();
            w.WriteNumber("offset", Fix(stop.Offset));
            w.WriteString("color", stop.Color);
            w.WriteEndObject();
        }

        w.WriteEndArray();
        w.WriteEndObject();
    }

    private static void WriteFill(Utf8JsonWriter w, string name, FillDef? fill)
    {
        if (fill is null) { w.WriteNull(name); return; }
        if (fill.Gradient is not null)
        {
            w.WritePropertyName(name);
            WriteGradient(w, fill.Gradient);
            return;
        }

        WriteNullable(w, name, fill.Color);
    }

    private static void WriteLine(Utf8JsonWriter w, string name, LineDef? line)
    {
        if (line is null) { w.WriteNull(name); return; }
        w.WriteStartObject(name);
        w.WriteString("color", line.Color);
        w.WriteNumber("width", Fix(line.Width));
        w.WriteEndObject();
    }

    private static void WriteSource(Utf8JsonWriter w, string? name, SourceDef? source)
    {
        if (name is null)
        {
            if (source is null) { w.WriteNullValue(); return; }
            w.WriteStartObject();
        }
        else
        {
            if (source is null) { w.WriteNull(name); return; }
            w.WriteStartObject(name);
        }

        if (source.Asset is not null) { w.WriteString("asset", source.Asset); } else { w.WriteString("field", source.Field); }
        w.WriteEndObject();
    }

    private static void WriteElement(Utf8JsonWriter w, DesignElement e)
    {
        w.WriteStartObject();
        w.WriteString("id", e.Id);
        w.WriteString("type", e.Type);
        w.WriteString("name", e.Name);
        w.WriteNumber("x", Fix(e.X));
        w.WriteNumber("y", Fix(e.Y));
        w.WriteNumber("w", Fix(e.W));
        w.WriteNumber("h", Fix(e.H));
        w.WriteNumber("rotation", Fix(e.Rotation));
        w.WriteNumber("opacity", Fix(e.Opacity));
        w.WriteBoolean("locked", e.Locked);
        w.WriteBoolean("hidden", e.Hidden);
        WriteNullable(w, "showIf", e.ShowIf);
        w.WriteBoolean("flipX", e.FlipX);
        w.WriteBoolean("flipY", e.FlipY);
        if (e.Shadow is { } shadow)
        {
            w.WriteStartObject("shadow");
            w.WriteString("color", shadow.Color);
            w.WriteNumber("opacity", Fix(shadow.Opacity));
            w.WriteNumber("blur", Fix(shadow.Blur));
            w.WriteNumber("x", Fix(shadow.X));
            w.WriteNumber("y", Fix(shadow.Y));
            w.WriteEndObject();
        }
        else
        {
            w.WriteNull("shadow");
        }

        switch (e)
        {
            case TextElement t:
                w.WriteString("text", t.Text);
                w.WriteString("fontFamily", t.FontFamily);
                w.WriteNumber("fontSize", t.FontSize);
                w.WriteNumber("fontWeight", t.FontWeight);
                w.WriteBoolean("italic", t.Italic);
                w.WriteBoolean("underline", t.Underline);
                w.WriteBoolean("strike", t.Strike);
                w.WriteString("list", t.List);
                w.WriteString("color", t.Color);
                w.WriteString("align", t.Align);
                w.WriteString("valign", t.Valign);
                w.WriteNumber("lineHeight", t.LineHeight);
                w.WriteNumber("letterSpacing", Fix(t.LetterSpacing));
                w.WriteBoolean("uppercase", t.Uppercase);
                w.WriteBoolean("wrap", t.Wrap);
                w.WriteString("fit", t.Fit);
                w.WriteNumber("minFontSize", t.MinFontSize);
                WriteLine(w, "outline", t.Outline);
                if (t.Background is { } box)
                {
                    w.WriteStartObject("background");
                    w.WriteString("color", box.Color);
                    w.WriteNumber("radius", Fix(box.Radius));
                    w.WriteNumber("padding", Fix(box.Padding));
                    w.WriteEndObject();
                }
                else
                {
                    w.WriteNull("background");
                }

                w.WriteNumber("curve", Fix(t.Curve));
                break;
            case ImageElement i:
                WriteSource(w, "source", i.Source);
                w.WriteString("fit", i.Fit);
                w.WriteStartObject("crop");
                w.WriteNumber("x", Fix(i.Crop.X));
                w.WriteNumber("y", Fix(i.Crop.Y));
                w.WriteNumber("w", Fix(i.Crop.W));
                w.WriteNumber("h", Fix(i.Crop.H));
                w.WriteEndObject();
                w.WriteString("mask", i.Mask);
                w.WriteNumber("radius", Fix(i.Radius));
                WriteLine(w, "border", i.Border);
                w.WriteStartObject("filters");
                w.WriteNumber("brightness", Fix(i.Filters.Brightness));
                w.WriteNumber("contrast", Fix(i.Filters.Contrast));
                w.WriteNumber("saturation", Fix(i.Filters.Saturation));
                w.WriteNumber("blur", Fix(i.Filters.Blur));
                w.WriteBoolean("grayscale", i.Filters.Grayscale);
                w.WriteBoolean("sepia", i.Filters.Sepia);
                w.WriteEndObject();
                break;
            case ImageStripElement s:
                w.WriteStartArray("items");
                foreach (var item in s.Items)
                {
                    WriteSource(w, null, item);
                }

                w.WriteEndArray();
                w.WriteNumber("gap", Fix(s.Gap));
                w.WriteString("align", s.Align);
                w.WriteString("mask", s.Mask);
                WriteLine(w, "border", s.Border);
                break;
            case ShapeElement p:
                w.WriteString("shape", p.Shape);
                w.WriteNumber("points", p.Points);
                w.WriteNumber("innerRadius", Fix(p.InnerRadius));
                WriteFill(w, "fill", p.Fill);
                WriteNullable(w, "stroke", p.Stroke);
                w.WriteNumber("strokeWidth", Fix(p.StrokeWidth));
                w.WriteString("dash", p.Dash);
                w.WriteNumber("radius", Fix(p.Radius));
                w.WriteString("startCap", p.StartCap);
                w.WriteString("endCap", p.EndCap);
                break;
            case IconElement icon:
                w.WriteString("icon", icon.Icon);
                w.WriteString("color", icon.Color);
                w.WriteNumber("strokeWidth", Fix(icon.StrokeWidth));
                break;
            case QrElement qr:
                w.WriteString("value", qr.Value);
                w.WriteString("color", qr.Color);
                WriteNullable(w, "background", qr.Background);
                w.WriteString("ecc", qr.Ecc);
                w.WriteBoolean("quiet", qr.Quiet);
                break;
            case BarcodeElement barcode:
                w.WriteString("format", barcode.Format);
                w.WriteString("value", barcode.Value);
                w.WriteString("color", barcode.Color);
                WriteNullable(w, "background", barcode.Background);
                w.WriteBoolean("showText", barcode.ShowText);
                w.WriteString("fontFamily", barcode.FontFamily);
                break;
            case GroupElement group:
                w.WriteStartArray("children");
                foreach (var child in group.Children)
                {
                    WriteElement(w, child);
                }

                w.WriteEndArray();
                break;
        }

        w.WriteEndObject();
    }
}
