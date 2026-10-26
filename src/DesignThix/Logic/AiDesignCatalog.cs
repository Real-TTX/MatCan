using System.Globalization;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace DesignThix.Logic;

/// <summary>What a property of an element is: the way a value is read, checked and told to the model.</summary>
public enum CatalogKind
{
    Number,
    Int,
    Bool,
    Text,
    Enum,
    Color,
    Fill,
    Source,
    SourceList,
    Object,
    IconName,
    Key,
    Children,
}

/// <summary>One property of an element (or of an object inside it). The ranges are the ones <c>DocumentValidator</c> enforces: <c>AiDesignCatalogTests</c> proves it for every property.</summary>
public sealed record CatalogProp(string Name, CatalogKind Kind, string Doc, double Min = 0, double Max = 0, double MaxPx = 0, string[]? Values = null, bool Nullable = false, int MaxLength = 0, CatalogProp[]? Sub = null, string? Unit = null);

/// <summary>An element type with all its properties (the common ones included).</summary>
public sealed record CatalogType(string Type, string Doc, IReadOnlyList<CatalogProp> Props)
{
    public CatalogProp? Find(string name) => Props.FirstOrDefault(p => string.Equals(p.Name, name, StringComparison.Ordinal));
}

/// <summary>The outcome of reading one value for a property: the checked value, a warning when something was changed or dropped, or an error when the value is no use at all.</summary>
public sealed record Coerced(JsonNode? Value, bool Drop, string? Warning);

/// <summary>
/// ONE description of document schema 2 in C# (docs/PLAN-CANVA.md section 2): every element type, every property, its range and unit. It is where the prompt of the design assistant gets its catalogue
/// from (<see cref="PromptText"/>) and what the tools read a value with (<see cref="Coerce"/>: a number is clamped to its range with a warning, a word must be one of the allowed ones, a colour must be #rgb or
/// #rrggbb). <c>DocumentValidator</c> stays the authority over what is stored; a test compares the two property by property, so the catalogue cannot drift.
/// </summary>
public static partial class AiDesignCatalog
{
    [GeneratedRegex("^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")]
    private static partial Regex ColourPattern();

    [GeneratedRegex("^[A-Za-z][A-Za-z0-9_]{0,39}$")]
    private static partial Regex KeyPattern();

    [GeneratedRegex("^(?:[a-z0-9-]{1,64}:)?[a-z0-9-]{1,64}$")]
    private static partial Regex IconPattern();

    public static bool IsColour(string? text) => text is not null && ColourPattern().IsMatch(text.Trim());

    public static bool IsKey(string? text) => text is not null && KeyPattern().IsMatch(text);

    public static bool IsIconName(string? text) => text is not null && IconPattern().IsMatch(text);

    private static readonly string[] Aligns = ["left", "center", "right"];
    private static readonly string[] Fits = ["cover", "contain", "fill"];
    private static readonly string[] Masks = ["none", "rounded", "circle", "heart", "star", "hexagon", "triangle"];
    private static readonly string[] Shapes = ["rect", "ellipse", "line", "triangle", "diamond", "pentagon", "hexagon", "star", "heart", "arrow", "speech"];
    private static readonly string[] Caps = ["none", "arrow", "circle", "square"];

    private static CatalogProp Num(string name, double min, double max, string doc, string? unit = null, bool nullable = false, double maxPx = 0)
        => new(name, CatalogKind.Number, doc, min, max, maxPx, null, nullable, 0, null, unit);

    private static CatalogProp Int(string name, int min, int max, string doc) => new(name, CatalogKind.Int, doc, min, max);

    private static CatalogProp Bool(string name, string doc) => new(name, CatalogKind.Bool, doc);

    private static CatalogProp Str(string name, int max, string doc, bool nullable = false) => new(name, CatalogKind.Text, doc, MaxLength: max, Nullable: nullable);

    private static CatalogProp Pick(string name, string[] values, string doc) => new(name, CatalogKind.Enum, doc, Values: values);

    private static CatalogProp Colour(string name, string doc, bool nullable = false) => new(name, CatalogKind.Color, doc, Nullable: nullable);

    private static CatalogProp Obj(string name, string doc, params CatalogProp[] sub) => new(name, CatalogKind.Object, doc, Nullable: true, Sub: sub);

    private static readonly CatalogProp[] LineParts = [Colour("color", "#rrggbb"), Num("width", 0, 100, "Breite", "pt")];

    /// <summary>The properties of every element: position and size are in the unit of the document (mm or px).</summary>
    public static readonly IReadOnlyList<CatalogProp> Common =
    [
        Str("name", 80, "Name in der Ebenenliste"),
        Num("x", -1e6, 1e6, "linke Kante", "Einheit"),
        Num("y", -1e6, 1e6, "obere Kante", "Einheit"),
        Num("w", 0, 1e6, "Breite", "Einheit"),
        Num("h", 0, 1e6, "Höhe", "Einheit"),
        Num("rotation", -360, 360, "Drehung um die Mitte in Grad"),
        Num("opacity", 0, 1, "Deckkraft"),
        Bool("locked", "gesperrt (die Person kann es nicht anfassen)"),
        Bool("hidden", "ausgeblendet"),
        new("showIf", CatalogKind.Key, "wird nur gezeichnet, wenn dieses Feld einen Wert hat (Feldschlüssel)", Nullable: true),
        Bool("flipX", "horizontal gespiegelt"),
        Bool("flipY", "vertikal gespiegelt"),
        Obj("shadow", "Schatten", Colour("color", "#rrggbb"), Num("opacity", 0, 1, "Deckkraft"), Num("blur", 0, 50, "Unschärfe", "Einheit", maxPx: 200), Num("x", -1000, 1000, "Versatz", "Einheit"), Num("y", -1000, 1000, "Versatz", "Einheit")),
    ];

    private static readonly CatalogType[] AllTypes =
    [
        new("text", "Text (Überschrift, Absatz, Platzhalter {{Feld}})",
        [
            Str("text", 5000, "der Text; {{Feld}} fügt den Wert eines Feldes ein; \\n ist ein Zeilenumbruch"),
            Str("fontFamily", 100, "Schriftfamilie (nur aus list_fonts)"),
            Num("fontSize", 1, 1000, "Schriftgröße", "pt, immer, auch in einem px-Design"),
            Int("fontWeight", 100, 900, "Gewicht, 400 normal, 700 fett"),
            Bool("italic", "kursiv"),
            Bool("underline", "unterstrichen"),
            Bool("strike", "durchgestrichen"),
            Pick("list", ["none", "bullet", "number"], "Liste"),
            Colour("color", "Textfarbe"),
            Pick("align", Aligns, "waagerecht"),
            Pick("valign", ["top", "middle", "bottom"], "senkrecht im Kasten"),
            Num("lineHeight", 0.5, 3, "Zeilenhöhe als Vielfaches der Schrift"),
            Num("letterSpacing", -0.5, 2, "Buchstabenabstand", "em"),
            Bool("uppercase", "GROSSBUCHSTABEN"),
            Bool("wrap", "bricht um (false: eine Zeile)"),
            Pick("fit", ["none", "shrink"], "shrink: die Schrift wird kleiner, bis der Text in den Kasten passt"),
            Num("minFontSize", 0.5, 1000, "kleinste Größe bei fit shrink", "pt"),
            Obj("outline", "Kontur der Buchstaben", [.. LineParts]),
            Obj("background", "Kasten hinter dem Text", Colour("color", "#rrggbb"), Num("radius", 0, 1e6, "Eckenradius", "Einheit"), Num("padding", 0, 1e6, "Innenabstand", "Einheit")),
            Num("curve", -100, 100, "0 gerade, sonst Text auf einem Kreisbogen (eine Zeile); 100 ein ganzer Kreis"),
        ]),
        new("image", "Bild aus der Bibliothek (oder ein leerer Bildrahmen)",
        [
            new("source", CatalogKind.Source, "{\"asset\": \"schluessel\"} oder {\"field\": \"Feldschluessel\"}; null = leerer Rahmen", Nullable: true),
            Pick("fit", Fits, "wie das Bild in den Kasten passt"),
            Obj("crop", "sichtbarer Ausschnitt in Bruchteilen des Bildes", Num("x", 0, 0.999, "links"), Num("y", 0, 0.999, "oben"), Num("w", 0.001, 1, "Breite"), Num("h", 0.001, 1, "Höhe")),
            Pick("mask", Masks, "Form des Ausschnitts"),
            Num("radius", 0, 1e6, "Eckenradius bei mask rounded", "Einheit"),
            Obj("border", "Rahmen", [.. LineParts]),
            Obj("filters", "Anpassungen", Num("brightness", -100, 100, "Helligkeit"), Num("contrast", -100, 100, "Kontrast"), Num("saturation", -100, 100, "Sättigung"), Num("blur", 0, 20, "Weichzeichnen"), Bool("grayscale", "Graustufen"), Bool("sepia", "Sepia")),
        ]),
        new("imageStrip", "Bildleiste: bis zu 12 Bilder nebeneinander",
        [
            new("items", CatalogKind.SourceList, "Liste von Bildquellen wie bei image.source (null = leerer Platz), höchstens 12"),
            Num("gap", 0, 1e6, "Abstand zwischen den Bildern", "Einheit"),
            Pick("align", Aligns, "Ausrichtung der Bilder"),
            Pick("mask", Masks, "Form der Bilder"),
            Obj("border", "Rahmen", [.. LineParts]),
        ]),
        new("shape", "Form oder Linie",
        [
            Pick("shape", Shapes, "Art der Form"),
            Int("points", 5, 12, "Zacken bei star"),
            Num("innerRadius", 0.2, 0.9, "Innenradius bei star als Anteil des Außenradius"),
            new("fill", CatalogKind.Fill, "Füllung: #rrggbb, ein Verlauf oder null (keine)", Nullable: true),
            Colour("stroke", "Linienfarbe; null = keine Linie", nullable: true),
            Num("strokeWidth", 0, 1000, "Linienstärke", "Einheit"),
            Pick("dash", ["solid", "dashed", "dotted"], "Linienart"),
            Num("radius", 0, 1e6, "Eckenradius bei rect", "Einheit"),
            Pick("startCap", Caps, "Linienende am Anfang (nur line)"),
            Pick("endCap", Caps, "Linienende am Ende (nur line)"),
        ]),
        new("icon", "Symbol (Lucide-Icon)",
        [
            new("icon", CatalogKind.IconName, "Name aus search_icons (z. B. star, heart, phone)"),
            Colour("color", "Farbe"),
            Num("strokeWidth", 0.5, 4, "Linienstärke im 24er-Raster des Symbols"),
        ]),
        new("qr", "QR-Code",
        [
            Str("value", 1000, "Inhalt, z. B. eine Adresse; {{Feld}} erlaubt"),
            Colour("color", "Farbe der Module"),
            Colour("background", "Hintergrund; null = durchsichtig", nullable: true),
            Pick("ecc", ["L", "M", "Q", "H"], "Fehlerkorrektur"),
            Bool("quiet", "Ruhezone von vier Modulen"),
        ]),
        new("barcode", "Strichcode",
        [
            Pick("format", ["ean13", "ean8", "code128"], "Art"),
            Str("value", 80, "Inhalt; EAN nur Ziffern (12 oder 7 Ziffern: die Prüfziffer wird ergänzt); {{Feld}} erlaubt"),
            Colour("color", "Farbe der Striche"),
            Colour("background", "Hintergrund; null = durchsichtig", nullable: true),
            Bool("showText", "Ziffern darunter zeigen"),
            Str("fontFamily", 100, "Schrift der Ziffern"),
        ]),
        new("group", "Gruppe: ihre Kinder liegen in Seitenkoordinaten, ihr Kasten ist die Hülle der Kinder",
        [
            new("children", CatalogKind.Children, "die Elemente der Gruppe (höchstens drei Ebenen tief)"),
        ]),
    ];

    /// <summary>Every element type with all its properties (the common ones first), in the order of the schema.</summary>
    public static readonly IReadOnlyList<CatalogType> Types = [.. AllTypes.Select(t => t with { Props = [.. Common, .. t.Props] })];

    /// <summary>The properties of the background of a page.</summary>
    public static readonly IReadOnlyList<CatalogProp> Background =
    [
        Colour("color", "#rrggbb oder null (dann zählt der Verlauf oder das Bild)", nullable: true),
        new("gradient", CatalogKind.Fill, "Verlauf oder null", Nullable: true),
        new("asset", CatalogKind.Text, "Schlüssel eines Bildes aus der Bibliothek oder null", MaxLength: 200, Nullable: true),
        Pick("fit", Fits, "wie das Hintergrundbild passt"),
    ];

    /// <summary>The properties of a field of the design.</summary>
    public static readonly IReadOnlyList<CatalogProp> FieldProps =
    [
        new("key", CatalogKind.Key, "Schlüssel: Buchstabe, dann Buchstaben, Ziffern, _ (höchstens 40)"),
        Str("label", 80, "Beschriftung"),
        Pick("type", ["text", "multiline", "number", "price", "image"], "Art"),
        Str("sample", 2000, "Beispielwert, den das Design zeigt"),
        Int("decimals", 0, 4, "Nachkommastellen bei number und price"),
        Str("category", 80, "Gruppe für die Anzeige", nullable: true),
        Bool("required", "muss in jeder Zeile einer Datenliste stehen"),
    ];

    public static CatalogType? Find(string? type) => Types.FirstOrDefault(t => string.Equals(t.Type, type, StringComparison.Ordinal));

    // ------------------------------------------------------------------------------------------------ reading a value

    /// <summary>Reads <paramref name="value"/> for the property: the checked value (colours lower case, numbers clamped, words canonical) or a drop with the reason. Never throws.</summary>
    public static Coerced Coerce(CatalogProp prop, JsonNode? value, string unit = "mm")
    {
        if (value is null)
        {
            return prop.Nullable ? new Coerced(null, false, null) : new Coerced(null, true, $"„{prop.Name}“ darf nicht null sein (ignoriert).");
        }

        switch (prop.Kind)
        {
            case CatalogKind.Number:
            case CatalogKind.Int:
                {
                    if (!TryNumber(value, out var n))
                    {
                        return new Coerced(null, true, $"„{prop.Name}“ muss eine Zahl sein (ignoriert).");
                    }

                    var max = unit == "px" && prop.MaxPx > 0 ? prop.MaxPx : prop.Max;
                    var rounded = prop.Kind == CatalogKind.Int ? Math.Floor(n + 0.5) : n;
                    var clamped = Math.Clamp(rounded, prop.Min, max);
                    var warning = clamped != rounded
                        ? $"„{prop.Name}“: {Fmt(n)} liegt außerhalb von {Fmt(prop.Min)} bis {Fmt(max)}, begrenzt auf {Fmt(clamped)}."
                        : null;
                    return prop.Kind == CatalogKind.Int ? new Coerced(JsonValue.Create((long)clamped), false, warning) : new Coerced(JsonValue.Create(clamped), false, warning);
                }

            case CatalogKind.Bool:
                if (value is JsonValue b && b.TryGetValue<bool>(out var flag))
                {
                    return new Coerced(JsonValue.Create(flag), false, null);
                }

                if (value is JsonValue bs && bs.TryGetValue<string>(out var text) && text.Trim().ToLowerInvariant() is "true" or "false")
                {
                    return new Coerced(JsonValue.Create(text.Trim().Equals("true", StringComparison.OrdinalIgnoreCase)), false, null);
                }

                return new Coerced(null, true, $"„{prop.Name}“ muss true oder false sein (ignoriert).");

            case CatalogKind.Text:
                {
                    if (value is not JsonValue sv || !sv.TryGetValue<string>(out var s))
                    {
                        return new Coerced(null, true, $"„{prop.Name}“ muss ein Text sein (ignoriert).");
                    }

                    if (prop.MaxLength > 0 && s.Length > prop.MaxLength)
                    {
                        return new Coerced(JsonValue.Create(s[..prop.MaxLength]), false, $"„{prop.Name}“ wurde auf {prop.MaxLength} Zeichen gekürzt.");
                    }

                    return new Coerced(JsonValue.Create(s), false, null);
                }

            case CatalogKind.Enum:
                {
                    var s = value is JsonValue ev && ev.TryGetValue<string>(out var t) ? t.Trim() : null;
                    var found = s is null ? null : prop.Values!.FirstOrDefault(v => string.Equals(v, s, StringComparison.OrdinalIgnoreCase));
                    return found is null
                        ? new Coerced(null, true, $"„{prop.Name}“: „{Clip(value.ToJsonString(), 40)}“ gibt es nicht; erlaubt: {string.Join(", ", prop.Values!)} (ignoriert).")
                        : new Coerced(JsonValue.Create(found), false, null);
                }

            case CatalogKind.Color:
                {
                    var s = value is JsonValue cv && cv.TryGetValue<string>(out var t) ? t.Trim() : null;
                    return IsColour(s)
                        ? new Coerced(JsonValue.Create(s!.ToLowerInvariant()), false, null)
                        : new Coerced(null, true, $"„{prop.Name}“: „{Clip(value.ToJsonString(), 30)}“ ist keine Farbe; erlaubt ist #rgb oder #rrggbb (ignoriert).");
                }

            case CatalogKind.Key:
                {
                    var s = value is JsonValue kv && kv.TryGetValue<string>(out var t) ? t.Trim() : null;
                    return IsKey(s)
                        ? new Coerced(JsonValue.Create(s), false, null)
                        : new Coerced(null, true, $"„{prop.Name}“: „{Clip(value.ToJsonString(), 40)}“ ist kein Feldschlüssel (Buchstabe, dann Buchstaben, Ziffern, _; höchstens 40) (ignoriert).");
                }

            case CatalogKind.IconName:
                {
                    var s = value is JsonValue iv && iv.TryGetValue<string>(out var t) ? t.Trim() : null;
                    return IsIconName(s)
                        ? new Coerced(JsonValue.Create(s), false, null)
                        : new Coerced(null, true, $"„{prop.Name}“: „{Clip(value.ToJsonString(), 40)}“ ist kein Symbolname (kleine Buchstaben, Ziffern, Bindestrich) (ignoriert).");
                }

            case CatalogKind.Fill:
                if (value is JsonValue fv && fv.TryGetValue<string>(out var fc))
                {
                    return IsColour(fc) ? new Coerced(JsonValue.Create(fc.Trim().ToLowerInvariant()), false, null) : new Coerced(null, true, $"„{prop.Name}“: „{Clip(fc, 30)}“ ist keine Farbe (ignoriert).");
                }

                return CoerceGradient(prop.Name, value);

            case CatalogKind.Source:
                return CoerceSource(prop.Name, value);

            case CatalogKind.SourceList:
                {
                    if (value is not JsonArray array)
                    {
                        return new Coerced(null, true, $"„{prop.Name}“ muss eine Liste sein (ignoriert).");
                    }

                    var items = new JsonArray();
                    var notes = new List<string>();
                    foreach (var item in array.Take(12))
                    {
                        if (item is null)
                        {
                            items.Add(null);
                            continue;
                        }

                        var one = CoerceSource(prop.Name, item);
                        items.Add(one.Drop ? null : one.Value);
                        if (one.Warning is not null)
                        {
                            notes.Add(one.Warning);
                        }
                    }

                    if (array.Count > 12)
                    {
                        notes.Add($"„{prop.Name}“ hat höchstens 12 Plätze; der Rest wurde weggelassen.");
                    }

                    return new Coerced(items, false, notes.Count == 0 ? null : string.Join(" ", notes.Distinct()));
                }

            case CatalogKind.Object:
                {
                    if (value is not JsonObject obj)
                    {
                        return new Coerced(null, true, $"„{prop.Name}“ muss ein Objekt sein (ignoriert).");
                    }

                    var result = new JsonObject();
                    var notes = new List<string>();
                    foreach (var (key, v) in obj)
                    {
                        var sub = prop.Sub!.FirstOrDefault(s => s.Name == key);
                        if (sub is null)
                        {
                            notes.Add($"„{prop.Name}.{key}“ gibt es nicht (ignoriert).");
                            continue;
                        }

                        var one = Coerce(sub with { Name = $"{prop.Name}.{key}", Nullable = false }, v, unit);
                        if (!one.Drop)
                        {
                            result[key] = one.Value;
                        }

                        if (one.Warning is not null)
                        {
                            notes.Add(one.Warning);
                        }
                    }

                    return new Coerced(result, false, notes.Count == 0 ? null : string.Join(" ", notes));
                }

            case CatalogKind.Children:
                return new Coerced(null, true, $"„{prop.Name}“ wird nicht gesetzt: nimm group, ungroup und add_elements mit group (ignoriert).");
            default:
                return new Coerced(null, true, $"„{prop.Name}“ wird nicht unterstützt (ignoriert).");
        }
    }

    /// <summary>A source of an image: <c>{ asset }</c> or <c>{ field }</c> (a string is a key of the library, text like {{Feld}} a field); anything else is dropped.</summary>
    private static Coerced CoerceSource(string name, JsonNode value)
    {
        if (value is JsonValue sv && sv.TryGetValue<string>(out var text))
        {
            text = text.Trim();
            var braces = Regex.Match(text, @"^\{\{\s*([A-Za-z][A-Za-z0-9_]{0,39})\s*\}\}$");
            if (braces.Success)
            {
                return new Coerced(new JsonObject { ["field"] = braces.Groups[1].Value }, false, null);
            }

            return text.Length is > 0 and <= 200 ? new Coerced(new JsonObject { ["asset"] = text.ToLowerInvariant() }, false, null) : new Coerced(null, true, $"„{name}“: der Bildschlüssel ist leer oder zu lang (ignoriert).");
        }

        if (value is JsonObject o)
        {
            if (o["asset"] is JsonValue a && a.TryGetValue<string>(out var asset) && asset.Trim().Length is > 0 and <= 200)
            {
                return new Coerced(new JsonObject { ["asset"] = asset.Trim().ToLowerInvariant() }, false, null);
            }

            if (o["field"] is JsonValue f && f.TryGetValue<string>(out var field) && IsKey(field.Trim()))
            {
                return new Coerced(new JsonObject { ["field"] = field.Trim() }, false, null);
            }
        }

        return new Coerced(null, true, $"„{name}“ braucht {{\"asset\": \"schluessel\"}} oder {{\"field\": \"Feld\"}} (ignoriert).");
    }

    /// <summary>A linear gradient <c>{ angle 0..360, stops: [{ offset 0..1, color }] }</c> with 2 to 5 stops.</summary>
    public static Coerced CoerceGradient(string name, JsonNode? value)
    {
        if (value is not JsonObject o || o["stops"] is not JsonArray stops)
        {
            return new Coerced(null, true, $"„{name}“ muss eine Farbe, null oder ein Verlauf {{\"angle\": 90, \"stops\": [{{\"offset\": 0, \"color\": \"#rrggbb\"}}, ...]}} sein (ignoriert).");
        }

        var list = new JsonArray();
        var notes = new List<string>();
        foreach (var stop in stops)
        {
            if (stop is JsonObject so && so["color"] is JsonValue cv && cv.TryGetValue<string>(out var c) && IsColour(c))
            {
                var offset = so["offset"] is { } ov && TryNumber(ov, out var off) ? Math.Clamp(off, 0, 1) : (list.Count == 0 ? 0 : 1);
                list.Add(new JsonObject { ["offset"] = offset, ["color"] = c.Trim().ToLowerInvariant() });
            }
            else
            {
                notes.Add($"„{name}“: ein Farbpunkt ohne gültige Farbe wurde weggelassen.");
            }
        }

        if (list.Count > 5)
        {
            while (list.Count > 5)
            {
                list.RemoveAt(list.Count - 1);
            }

            notes.Add($"„{name}“: ein Verlauf hat höchstens 5 Farbpunkte.");
        }

        if (list.Count < 2)
        {
            return new Coerced(null, true, $"„{name}“: ein Verlauf braucht mindestens zwei Farbpunkte mit gültiger Farbe (ignoriert).");
        }

        var angle = o["angle"] is { } av && TryNumber(av, out var deg) ? Math.Clamp(deg, 0, 360) : 0;
        return new Coerced(new JsonObject { ["type"] = "linear", ["angle"] = angle, ["stops"] = list }, false, notes.Count == 0 ? null : string.Join(" ", notes));
    }

    /// <summary>A number from a JSON number or a text that holds one (a model sends both).</summary>
    public static bool TryNumber(JsonNode? node, out double value)
    {
        value = 0;
        if (node is not JsonValue v)
        {
            return false;
        }

        if (v.TryGetValue<double>(out var d))
        {
            value = d;
            return double.IsFinite(d);
        }

        if (v.TryGetValue<string>(out var s) && s.Trim().Length > 0 && double.TryParse(s.Trim().Replace(',', '.'), NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed) && double.IsFinite(parsed))
        {
            value = parsed;
            return true;
        }

        if (v.TryGetValue<long>(out var l))
        {
            value = l;
            return true;
        }

        if (v.TryGetValue<int>(out var i))
        {
            value = i;
            return true;
        }

        if (v.TryGetValue<decimal>(out var m))
        {
            value = (double)m;
            return true;
        }

        return false;
    }

    private static string Fmt(double value) => value.ToString("0.####", CultureInfo.InvariantCulture);

    private static string Clip(string text, int max) => text.Length <= max ? text : text[..max] + "…";

    // ------------------------------------------------------------------------------------------------ the text of the prompt

    private static string Describe(CatalogProp p)
    {
        var range = p.Kind switch
        {
            CatalogKind.Number or CatalogKind.Int => $"{Fmt(p.Min)} bis {Fmt(p.Max)}{(p.MaxPx > 0 ? $" (px: bis {Fmt(p.MaxPx)})" : "")}{(p.Unit is null ? "" : " " + p.Unit)}",
            CatalogKind.Bool => "true|false",
            CatalogKind.Enum => string.Join("|", p.Values!),
            CatalogKind.Color => "#rrggbb",
            CatalogKind.Text => p.MaxLength > 0 ? $"Text, höchstens {p.MaxLength} Zeichen" : "Text",
            CatalogKind.Key => "Feldschlüssel",
            CatalogKind.Fill => "#rrggbb | Verlauf | null",
            CatalogKind.Source => "{asset}|{field}|null",
            CatalogKind.SourceList => "Liste von Quellen",
            CatalogKind.Object => "{" + string.Join(", ", p.Sub!.Select(s => s.Name + " " + Describe(s))) + "}",
            CatalogKind.IconName => "Symbolname",
            _ => "",
        };
        var nullable = p.Nullable && p.Kind is not (CatalogKind.Source or CatalogKind.Fill) ? "|null" : "";
        return $"{range}{nullable}";
    }

    /// <summary>The catalogue of the prompt: for every element type its properties with range and unit, then the page background and the fields.</summary>
    public static string PromptText()
    {
        var sb = new StringBuilder();
        sb.AppendLine("Gemeinsam für jedes Element: x, y, w, h in der Einheit des Designs (mm oder px; Ursprung links oben), rotation in Grad, opacity 0 bis 1, name, locked, hidden, showIf, flipX, flipY, shadow.");
        sb.AppendLine("Schriftgrößen (fontSize, minFontSize) und Konturstärken (outline, border) sind IMMER in pt, auch in einem px-Design (1 pt = 1,333 px). letterSpacing in em.");
        sb.AppendLine();
        foreach (var type in Types)
        {
            sb.Append("- ").Append(type.Type).Append(" – ").AppendLine(type.Doc);
            var own = type.Props.Skip(Common.Count);
            sb.Append("    ").AppendLine(string.Join("; ", own.Select(p => $"{p.Name}: {Describe(p)}" + (p.Doc.Length > 0 && p.Kind is not (CatalogKind.Number or CatalogKind.Int or CatalogKind.Bool or CatalogKind.Enum or CatalogKind.Color) ? $" ({p.Doc})" : ""))));
            var hints = type.Props.Skip(Common.Count).Where(p => p.Kind is CatalogKind.Number or CatalogKind.Int or CatalogKind.Enum && p.Doc.Length > 0).Select(p => $"{p.Name} = {p.Doc}");
            var hint = string.Join("; ", hints);
            if (hint.Length > 0)
            {
                sb.Append("    Bedeutung: ").AppendLine(hint);
            }
        }

        sb.AppendLine();
        sb.Append("- Hintergrund einer Seite (page.background): ").AppendLine(string.Join("; ", Background.Select(p => $"{p.Name}: {Describe(p)}")));
        sb.Append("- Feld des Designs (fields): ").AppendLine(string.Join("; ", FieldProps.Select(p => $"{p.Name}: {Describe(p)}")));
        sb.AppendLine("- Verlauf: {\"angle\": 0 bis 360, \"stops\": [{\"offset\": 0 bis 1, \"color\": \"#rrggbb\"}, ...]} mit 2 bis 5 Punkten (für fill einer Form und den Seitenhintergrund).");
        sb.AppendLine("- Grenzen: höchstens 500 Elemente je Seite, 2000 im Design, 50 Seiten, Gruppen höchstens drei Ebenen tief.");
        return sb.ToString().TrimEnd();
    }
}
