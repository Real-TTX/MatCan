using System.Globalization;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Text.Unicode;

namespace DesignThix.Core.Documents;

/// <summary>
/// Reads a design document from JSON that may be hostile or just old: unknown properties are dropped, numbers clamped, colours and enums replaced by defaults, duplicate
/// ids and keys fixed, limits applied, and the result written again in one canonical form. The rules are those of <c>DtEngine.normalize</c> in
/// <c>wwwroot/js/dt-engine.js</c> (which is the reference: what the browser would draw is what is stored); the server additionally enforces the size limits.
/// </summary>
public static partial class DocumentValidator
{
    public const int MaxJsonBytes = 2 * 1024 * 1024;
    public const int MaxElements = 500;
    public const int MaxFields = 100;
    public const int MaxStripItems = 12;
    private const int MaxJsonDepth = 32;
    private const int MaxWarnings = 20;

    private static readonly string[] FieldTypes = ["text", "multiline", "number", "price", "image"];
    private static readonly string[] ElementTypes = ["text", "image", "imageStrip", "shape"];
    private static readonly string[] Aligns = ["left", "center", "right"];
    private static readonly string[] Fits = ["cover", "contain", "fill"];

    [GeneratedRegex("^[A-Za-z][A-Za-z0-9_]{0,39}$", RegexOptions.CultureInvariant)]
    private static partial Regex KeyPattern();

    [GeneratedRegex("^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$", RegexOptions.CultureInvariant)]
    private static partial Regex ColourPattern();

    [GeneratedRegex("^(?:[A-Za-z]{2,3}|[A-Za-z]{5,8})(?:-[A-Za-z0-9]{2,8})*$", RegexOptions.CultureInvariant)]
    private static partial Regex LocalePattern();

    /// <summary>An empty document of the given size with the defaults (white page, 300 dpi).</summary>
    public static DesignDocument Create(double width, double height, string unit = "mm", string locale = "de-DE")
    {
        var kind = unit == "px" ? "px" : "mm";
        return new DesignDocument(1, kind, Math.Clamp(width, 0.1, 100000), Math.Clamp(height, 0.1, 100000), 300, ValidLocale(locale), new BackgroundDef("#ffffff", null, "cover"), [], []);
    }

    /// <summary>The document read leniently, or null when the text is not a usable document.</summary>
    public static DesignDocument? Parse(string? json) => Validate(json).Document;

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
            return Failed("Das Design ist größer als 2 MB.");
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

            var notes = new Notes();
            var document = Read(parsed.RootElement, notes);
            return new DocumentResult(true, null, document, ToJson(document), notes.Messages());
        }
    }

    private static DocumentResult Failed(string message) => new(false, message, null, null, []);

    // ------------------------------------------------------------------------------------------------ reading

    private static DesignDocument Read(JsonElement source, Notes notes)
    {
        var unit = Str(source, "unit", "mm", 10, null) == "px" ? "px" : "mm";
        var defaultSize = unit == "px" ? 800 : 100;
        var background = Obj(source, "background");

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

        var rawElements = Items(source, "elements");
        if (rawElements.Count > MaxElements)
        {
            notes.Truncated.Add($"Es wurden nur die ersten {MaxElements} Elemente übernommen.");
        }

        var usedIds = new HashSet<string>(StringComparer.Ordinal);
        var elements = new List<DesignElement>();
        for (var i = 0; i < Math.Min(rawElements.Count, MaxElements); i++)
        {
            var element = ReadElement(rawElements[i], usedIds, i, notes);
            if (element is null)
            {
                notes.Add(Notes.BadElement);
                continue;
            }

            elements.Add(element);
        }

        return new DesignDocument(
            1,
            unit,
            Num(source, "width", defaultSize, 0.1, 100000, notes),
            Num(source, "height", defaultSize, 0.1, 100000, notes),
            (int)Math.Floor(Num(source, "dpi", 300, 72, 1200, notes) + 0.5),
            ValidLocale(Str(source, "locale", "de-DE", 35, null)),
            new BackgroundDef(
                Colour(background, "color", "#ffffff", false, notes) ?? "#ffffff",
                AssetKey(background, "asset"),
                OneOf(background, "fit", Fits, "cover", notes)),
            fields,
            elements);
    }

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

    private static DesignElement? ReadElement(JsonElement raw, HashSet<string> usedIds, int index, Notes notes)
    {
        if (raw.ValueKind != JsonValueKind.Object || !TryString(raw, "type", out var type) || !ElementTypes.Contains(type))
        {
            return null;
        }

        var id = TryString(raw, "id", out var rawId) && rawId.Length > 0 ? Slice(rawId, 24) : "";
        if (id.Length == 0 || usedIds.Contains(id))
        {
            if (id.Length > 0)
            {
                notes.Add(Notes.DuplicateId);
            }

            var n = index + 1;
            while (usedIds.Contains("e" + n.ToString(CultureInfo.InvariantCulture)))
            {
                n++;
            }

            id = "e" + n.ToString(CultureInfo.InvariantCulture);
        }

        usedIds.Add(id);

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

        switch (type)
        {
            case "text":
                var fontSize = Num(raw, "fontSize", 12, 1, 1000, notes);
                var family = Str(raw, "fontFamily", "sans-serif", 100, notes);
                return new TextElement
                {
                    Id = id, Name = name, X = x, Y = y, W = w, H = h, Rotation = rotation, Opacity = opacity, Locked = locked, Hidden = hidden, ShowIf = showIf,
                    Text = Str(raw, "text", "", 5000, notes),
                    FontFamily = family.Length == 0 ? "sans-serif" : family,
                    FontSize = fontSize,
                    FontWeight = (int)Math.Floor(Num(raw, "fontWeight", 400, 100, 900, notes) + 0.5),
                    Italic = IsTrue(raw, "italic"),
                    Color = Colour(raw, "color", "#000000", false, notes) ?? "#000000",
                    Align = OneOf(raw, "align", Aligns, "left", notes),
                    Valign = OneOf(raw, "valign", ["top", "middle", "bottom"], "top", notes),
                    LineHeight = Num(raw, "lineHeight", 1.2, 0.5, 3, notes),
                    LetterSpacing = Num(raw, "letterSpacing", 0, -0.5, 2, notes),
                    Uppercase = IsTrue(raw, "uppercase"),
                    Wrap = !(raw.TryGetProperty("wrap", out var wrap) && wrap.ValueKind == JsonValueKind.False),
                    Fit = OneOf(raw, "fit", ["none", "shrink"], "none", notes),
                    MinFontSize = Math.Min(fontSize, Num(raw, "minFontSize", 4, 0.5, 1000, notes)),
                };

            case "image":
                return new ImageElement
                {
                    Id = id, Name = name, X = x, Y = y, W = w, H = h, Rotation = rotation, Opacity = opacity, Locked = locked, Hidden = hidden, ShowIf = showIf,
                    Source = raw.TryGetProperty("source", out var source) ? ReadSource(source) : null,
                    Fit = OneOf(raw, "fit", Fits, "contain", notes),
                    Radius = Num(raw, "radius", 0, 0, 1e6, notes),
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
                    Id = id, Name = name, X = x, Y = y, W = w, H = h, Rotation = rotation, Opacity = opacity, Locked = locked, Hidden = hidden, ShowIf = showIf,
                    Items = items,
                    Gap = Num(raw, "gap", 0, 0, 1e6, notes),
                    Align = OneOf(raw, "align", Aligns, "left", notes),
                };

            default:
                var shape = OneOf(raw, "shape", ["rect", "ellipse", "line"], "rect", notes);
                return new ShapeElement
                {
                    Id = id, Name = name, X = x, Y = y, W = w, H = h, Rotation = rotation, Opacity = opacity, Locked = locked, Hidden = hidden, ShowIf = showIf,
                    Shape = shape,
                    Fill = Colour(raw, "fill", null, true, notes),
                    Stroke = Colour(raw, "stroke", shape == "line" ? "#000000" : null, true, notes),
                    StrokeWidth = Num(raw, "strokeWidth", 1, 0, 1000, notes),
                    Dash = OneOf(raw, "dash", ["solid", "dashed", "dotted"], "solid", notes),
                    Radius = Num(raw, "radius", 0, 0, 1e6, notes),
                };
        }
    }

    // ------------------------------------------------------------------------------------------------ the helpers of the engine (num, str, oneOf, colour)

    private static JsonElement Obj(JsonElement parent, string name)
        => parent.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Object ? value : default;

    private static List<JsonElement> Items(JsonElement parent, string name)
        => parent.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Array ? [.. value.EnumerateArray()] : [];

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

        private static readonly (string Key, string Text)[] Texts =
        [
            (BadField, "Felder mit ungültigem Schlüssel wurden entfernt"),
            (DuplicateField, "doppelte Felder wurden entfernt"),
            (BadElement, "Elemente mit unbekanntem Typ wurden entfernt"),
            (DuplicateId, "doppelte Element-Kennungen wurden ersetzt"),
            (BadValue, "ungültige Werte wurden durch Standardwerte ersetzt"),
            (BadColour, "ungültige Farben wurden ersetzt"),
            (Clamped, "Werte außerhalb des erlaubten Bereichs wurden begrenzt"),
            (StripTruncated, "Bildleisten wurden auf 12 Bilder gekürzt"),
        ];

        private readonly Dictionary<string, int> _counts = [];

        public List<string> Truncated { get; } = [];

        public void Add(string key) => _counts[key] = _counts.GetValueOrDefault(key) + 1;

        public IReadOnlyList<string> Messages()
        {
            var all = new List<string>(Truncated);
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

    // ------------------------------------------------------------------------------------------------ writing

    private static readonly JavaScriptEncoder Encoder = JavaScriptEncoder.Create(UnicodeRanges.All);

    /// <summary>The compact JSON of a document, in the shape the engine produces (camelCase; nulls where the engine writes them).</summary>
    public static string ToJson(DesignDocument document)
    {
        using var stream = new MemoryStream();
        using (var w = new Utf8JsonWriter(stream, new JsonWriterOptions { Encoder = Encoder, Indented = false }))
        {
            w.WriteStartObject();
            w.WriteNumber("schema", 1);
            w.WriteString("unit", document.Unit);
            w.WriteNumber("width", Fix(document.Width));
            w.WriteNumber("height", Fix(document.Height));
            w.WriteNumber("dpi", document.Dpi);
            w.WriteString("locale", document.Locale);
            w.WriteStartObject("background");
            w.WriteString("color", document.Background.Color);
            WriteNullable(w, "asset", document.Background.Asset);
            w.WriteString("fit", document.Background.Fit);
            w.WriteEndObject();
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
            w.WriteStartArray("elements");
            foreach (var e in document.Elements)
            {
                WriteElement(w, e);
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
        switch (e)
        {
            case TextElement t:
                w.WriteString("text", t.Text);
                w.WriteString("fontFamily", t.FontFamily);
                w.WriteNumber("fontSize", t.FontSize);
                w.WriteNumber("fontWeight", t.FontWeight);
                w.WriteBoolean("italic", t.Italic);
                w.WriteString("color", t.Color);
                w.WriteString("align", t.Align);
                w.WriteString("valign", t.Valign);
                w.WriteNumber("lineHeight", t.LineHeight);
                w.WriteNumber("letterSpacing", Fix(t.LetterSpacing));
                w.WriteBoolean("uppercase", t.Uppercase);
                w.WriteBoolean("wrap", t.Wrap);
                w.WriteString("fit", t.Fit);
                w.WriteNumber("minFontSize", t.MinFontSize);
                break;
            case ImageElement i:
                WriteSource(w, "source", i.Source);
                w.WriteString("fit", i.Fit);
                w.WriteNumber("radius", Fix(i.Radius));
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
                break;
            case ShapeElement p:
                w.WriteString("shape", p.Shape);
                WriteNullable(w, "fill", p.Fill);
                WriteNullable(w, "stroke", p.Stroke);
                w.WriteNumber("strokeWidth", Fix(p.StrokeWidth));
                w.WriteString("dash", p.Dash);
                w.WriteNumber("radius", Fix(p.Radius));
                break;
        }

        w.WriteEndObject();
    }
}
