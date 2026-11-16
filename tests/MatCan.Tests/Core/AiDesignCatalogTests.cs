using System.Text.Json;
using System.Text.Json.Nodes;
using MatCan.Core.Documents;
using MatCan.Logic;

namespace MatCan.Tests.Core;

/// <summary>
/// The catalogue of schema 2 that the design assistant is told (<c>Logic/AiDesignCatalog.cs</c>) against the one that decides what is stored (<c>DocumentValidator</c>): for every element type the same
/// properties, for every number the same limits (at the limit nothing is changed, past it the validator clamps), for every word the same choices, for every text the same length. If the validator learns a
/// property or changes a range, this fails until the catalogue says the same.
/// </summary>
public sealed class AiDesignCatalogTests
{
    private static string DocOf(string unit, JsonObject element)
        => new JsonObject
        {
            ["schema"] = 2,
            ["unit"] = unit,
            ["width"] = 200,
            ["height"] = 200,
            ["dpi"] = 300,
            ["locale"] = "de-DE",
            ["fields"] = new JsonArray(),
            ["pages"] = new JsonArray(new JsonObject { ["id"] = "p1", ["name"] = "", ["background"] = new JsonObject { ["color"] = "#ffffff" }, ["elements"] = new JsonArray(element) }),
        }.ToJsonString();

    private static JsonObject ElementOf(string type, params (string Name, JsonNode? Value)[] props)
    {
        var element = new JsonObject { ["id"] = "e1", ["type"] = type, ["x"] = 1, ["y"] = 1, ["w"] = 10, ["h"] = 10 };
        if (type == "group")
        {
            element["children"] = new JsonArray(new JsonObject { ["id"] = "e2", ["type"] = "shape", ["x"] = 1, ["y"] = 1, ["w"] = 10, ["h"] = 10 });
        }

        foreach (var (name, value) in props)
        {
            element[name] = value;
        }

        return element;
    }

    private static (JsonObject Element, IReadOnlyList<string> Warnings) Validate(string unit, JsonObject element)
    {
        var result = DocumentValidator.Validate(DocOf(unit, element));
        Assert.True(result.Ok, result.Error);
        var doc = JsonNode.Parse(result.Json!)!;
        return ((JsonObject)doc["pages"]![0]!["elements"]![0]!, result.Warnings);
    }

    private static bool Clamped(IReadOnlyList<string> warnings) => warnings.Any(w => w.Contains("außerhalb des erlaubten Bereichs", StringComparison.Ordinal));

    [Fact]
    public void Every_type_has_the_same_properties_as_the_validator_writes()
    {
        foreach (var type in AiDesignCatalog.Types)
        {
            var (element, _) = Validate("mm", ElementOf(type.Type));
            var written = element.Select(p => p.Key).Where(k => k is not ("id" or "type")).Order(StringComparer.Ordinal).ToList();
            var described = type.Props.Select(p => p.Name).Order(StringComparer.Ordinal).ToList();
            Assert.True(written.SequenceEqual(described), $"{type.Type}: the validator writes [{string.Join(", ", written)}], the catalogue describes [{string.Join(", ", described)}]");
        }

        Assert.Equal(["text", "image", "imageStrip", "shape", "icon", "qr", "barcode", "group"], AiDesignCatalog.Types.Select(t => t.Type));
    }

    private static IEnumerable<(CatalogType Type, CatalogProp Prop, string? Parent)> Props()
    {
        foreach (var type in AiDesignCatalog.Types)
        {
            foreach (var prop in type.Props)
            {
                yield return (type, prop, null);
                if (prop.Sub is not null)
                {
                    foreach (var sub in prop.Sub)
                    {
                        yield return (type, sub, prop.Name);
                    }
                }
            }
        }
    }

    private static JsonObject WithValue(CatalogType type, CatalogProp prop, string? parent, JsonNode value, params (string, JsonNode?)[] extra)
    {
        var props = extra.ToList();
        props.Add(parent is null ? (prop.Name, value) : (parent, new JsonObject { [prop.Name] = value }));
        return ElementOf(type.Type, [.. props]);
    }

    private static JsonNode? Read(JsonObject element, string? parent, string name) => parent is null ? element[name] : element[parent]?[name];

    [Fact]
    public void Numbers_are_kept_at_their_limits_and_clamped_by_the_validator_past_them_with_the_same_result()
    {
        var checkedProps = 0;
        foreach (var (type, prop, parent) in Props().Where(p => p.Prop.Kind is CatalogKind.Number or CatalogKind.Int))
        {
            var where = $"{type.Type}.{(parent is null ? "" : parent + ".")}{prop.Name}";
            (string, JsonNode?)[] Extra() => where == "text.minFontSize" ? [("fontSize", 1000)] : [];
            foreach (var edge in new[] { prop.Min, prop.Max })
            {
                var (element, warnings) = Validate("mm", WithValue(type, prop, parent, edge, Extra()));
                Assert.True(Math.Abs(AiDocOps.Num(Read(element, parent, prop.Name)) - edge) < 1e-9, $"{where} at {edge}: the validator kept {Read(element, parent, prop.Name)}");
                Assert.False(Clamped(warnings), $"{where} at its limit {edge} was clamped");
                var coerced = AiDesignCatalog.Coerce(prop with { Name = prop.Name }, JsonValue.Create(edge));
                Assert.Null(coerced.Warning);
            }

            if (prop.Max < 1e5)
            {
                var over = prop.Max + 1;
                var (high, warnings) = Validate("mm", WithValue(type, prop, parent, over, Extra()));
                Assert.True(Clamped(warnings), $"{where}: {over} was not clamped");
                Assert.True(Math.Abs(AiDocOps.Num(Read(high, parent, prop.Name)) - prop.Max) < 1e-9, $"{where}: the validator clamped to {Read(high, parent, prop.Name)}");
                var coerced = AiDesignCatalog.Coerce(prop, JsonValue.Create(over));
                Assert.NotNull(coerced.Warning);
                Assert.Equal(prop.Max, AiDocOps.Num(coerced.Value));
            }

            if (prop.Min > -1e5)
            {
                var under = prop.Min - 1;
                var (low, warnings) = Validate("mm", WithValue(type, prop, parent, under, Extra()));
                Assert.True(Clamped(warnings), $"{where}: {under} was not clamped");
                Assert.True(Math.Abs(AiDocOps.Num(Read(low, parent, prop.Name)) - prop.Min) < 1e-9, $"{where}: the validator clamped to {Read(low, parent, prop.Name)}");
                Assert.Equal(prop.Min, AiDocOps.Num(AiDesignCatalog.Coerce(prop, JsonValue.Create(under)).Value));
            }

            checkedProps++;
        }

        Assert.True(checkedProps > 40, "only " + checkedProps + " numbers were compared");
    }

    [Fact]
    public void The_shadow_blur_has_another_limit_in_a_px_design()
    {
        var shadow = AiDesignCatalog.Common.Single(p => p.Name == "shadow").Sub!.Single(p => p.Name == "blur");
        Assert.Equal(50, shadow.Max);
        Assert.Equal(200, shadow.MaxPx);
        var (mm, mmWarnings) = Validate("mm", ElementOf("shape", ("shadow", new JsonObject { ["blur"] = 100 })));
        Assert.True(Clamped(mmWarnings));
        Assert.Equal(50, AiDocOps.Num(mm["shadow"]!["blur"]));
        var (px, pxWarnings) = Validate("px", ElementOf("shape", ("shadow", new JsonObject { ["blur"] = 100 })));
        Assert.False(Clamped(pxWarnings));
        Assert.Equal(100, AiDocOps.Num(px["shadow"]!["blur"]));
        Assert.Equal(100, AiDocOps.Num(AiDesignCatalog.Coerce(shadow, JsonValue.Create(100), "px").Value));
        Assert.Equal(50, AiDocOps.Num(AiDesignCatalog.Coerce(shadow, JsonValue.Create(100), "mm").Value));
    }

    [Fact]
    public void Words_are_the_validators_words()
    {
        foreach (var (type, prop, parent) in Props().Where(p => p.Prop.Kind == CatalogKind.Enum))
        {
            var where = $"{type.Type}.{prop.Name}";
            foreach (var value in prop.Values!)
            {
                var (element, warnings) = Validate("mm", WithValue(type, prop, parent, value));
                Assert.Equal(value, Read(element, parent, prop.Name)!.GetValue<string>());
                Assert.False(warnings.Any(w => w.Contains("ungültige Werte", StringComparison.Ordinal)), $"{where} = {value} was refused");
                Assert.Equal(value, AiDesignCatalog.Coerce(prop, JsonValue.Create(value.ToUpperInvariant())).Value!.GetValue<string>());
            }

            var (_, refused) = Validate("mm", WithValue(type, prop, parent, "gibt-es-nicht"));
            Assert.True(refused.Any(w => w.Contains("ungültige Werte", StringComparison.Ordinal)), $"{where}: a word that does not exist was taken");
            Assert.True(AiDesignCatalog.Coerce(prop, JsonValue.Create("gibt-es-nicht")).Drop);
        }
    }

    [Fact]
    public void Colours_and_switches_and_texts_follow_the_validator()
    {
        foreach (var (type, prop, parent) in Props().Where(p => p.Prop.Kind == CatalogKind.Color))
        {
            var (element, warnings) = Validate("mm", WithValue(type, prop, parent, "#ABCDEF"));
            Assert.Equal("#abcdef", Read(element, parent, prop.Name)!.GetValue<string>());
            Assert.DoesNotContain(warnings, w => w.Contains("Farben", StringComparison.Ordinal));
            Assert.Equal("#abcdef", AiDesignCatalog.Coerce(prop, JsonValue.Create("#ABCDEF")).Value!.GetValue<string>());
            Assert.Equal("#abc", AiDesignCatalog.Coerce(prop, JsonValue.Create("#abc")).Value!.GetValue<string>());
            var (_, bad) = Validate("mm", WithValue(type, prop, parent, "rot"));
            Assert.True(bad.Any(w => w.Contains("Farben", StringComparison.Ordinal)), $"{type.Type}.{prop.Name}: 'rot' was taken as a colour");
            Assert.True(AiDesignCatalog.Coerce(prop, JsonValue.Create("rot")).Drop);
        }

        foreach (var (type, prop, parent) in Props().Where(p => p.Prop.Kind == CatalogKind.Bool))
        {
            var (element, _) = Validate("mm", WithValue(type, prop, parent, true));
            Assert.True(Read(element, parent, prop.Name)!.GetValue<bool>(), $"{type.Type}.{prop.Name}");
            var (off, _) = Validate("mm", WithValue(type, prop, parent, false));
            Assert.False(Read(off, parent, prop.Name)!.GetValue<bool>());
            Assert.True(AiDesignCatalog.Coerce(prop, JsonValue.Create("false")).Value!.GetValue<bool>() == false);
        }

        foreach (var (type, prop, parent) in Props().Where(p => p.Prop is { Kind: CatalogKind.Text, MaxLength: > 0 } && p.Parent is null && p.Prop.Name is not ("asset" or "fontFamily")))
        {
            var full = new string('a', prop.MaxLength);
            var (kept, keptWarnings) = Validate("mm", WithValue(type, prop, parent, full));
            Assert.Equal(prop.MaxLength, Read(kept, parent, prop.Name)!.GetValue<string>().Length);
            Assert.False(Clamped(keptWarnings), $"{type.Type}.{prop.Name} at its length was clamped");
            var (cut, cutWarnings) = Validate("mm", WithValue(type, prop, parent, full + "b"));
            Assert.Equal(prop.MaxLength, Read(cut, parent, prop.Name)!.GetValue<string>().Length);
            Assert.True(Clamped(cutWarnings));
            Assert.Equal(prop.MaxLength, AiDesignCatalog.Coerce(prop, JsonValue.Create(full + "b")).Value!.GetValue<string>().Length);
        }
    }

    [Fact]
    public void Gradients_sources_icons_and_the_feature_limits_agree()
    {
        // a fill: colour, gradient with 2 to 5 stops, null
        var five = new JsonObject { ["type"] = "linear", ["angle"] = 90, ["stops"] = new JsonArray(Enumerable.Range(0, 5).Select(i => (JsonNode)new JsonObject { ["offset"] = i / 4.0, ["color"] = "#112233" }).ToArray()) };
        var (shape, warnings) = Validate("mm", ElementOf("shape", ("fill", five.DeepClone())));
        Assert.Equal(5, shape["fill"]!["stops"]!.AsArray().Count);
        Assert.Empty(warnings);
        var fillProp = AiDesignCatalog.Types.Single(t => t.Type == "shape").Find("fill")!;
        Assert.Equal(5, AiDesignCatalog.Coerce(fillProp, five.DeepClone()).Value!["stops"]!.AsArray().Count);
        var six = (JsonObject)five.DeepClone();
        six["stops"]!.AsArray().Add(new JsonObject { ["offset"] = 1, ["color"] = "#445566" });
        Assert.Equal(5, Validate("mm", ElementOf("shape", ("fill", six.DeepClone()))).Element["fill"]!["stops"]!.AsArray().Count);
        Assert.Equal(5, AiDesignCatalog.Coerce(fillProp, six.DeepClone()).Value!["stops"]!.AsArray().Count);
        Assert.Null(Validate("mm", ElementOf("shape", ("fill", new JsonObject { ["stops"] = new JsonArray(new JsonObject { ["color"] = "#112233" }) }))).Element["fill"]);
        Assert.True(AiDesignCatalog.Coerce(fillProp, new JsonObject { ["stops"] = new JsonArray(new JsonObject { ["color"] = "#112233" }) }).Drop);

        // sources
        var imageProp = AiDesignCatalog.Types.Single(t => t.Type == "image").Find("source")!;
        Assert.Equal("flag-de", Validate("mm", ElementOf("image", ("source", new JsonObject { ["asset"] = "flag-de" }))).Element["source"]!["asset"]!.GetValue<string>());
        Assert.Equal("Preis", Validate("mm", ElementOf("image", ("source", new JsonObject { ["field"] = "Preis" }))).Element["source"]!["field"]!.GetValue<string>());
        Assert.Null(Validate("mm", ElementOf("image", ("source", new JsonObject { ["field"] = "1 kaputt" }))).Element["source"]);
        Assert.Equal("flag-de", AiDesignCatalog.Coerce(imageProp, "Flag-DE")!.Value!["asset"]!.GetValue<string>());
        Assert.Equal("Preis", AiDesignCatalog.Coerce(imageProp, "{{Preis}}").Value!["field"]!.GetValue<string>());
        Assert.True(AiDesignCatalog.Coerce(imageProp, new JsonObject { ["field"] = "1 kaputt" }).Drop);

        // strips: 12 places
        var items = new JsonArray(Enumerable.Range(0, 14).Select(i => (JsonNode)new JsonObject { ["asset"] = "a" + i }).ToArray());
        Assert.Equal(12, Validate("mm", ElementOf("imageStrip", ("items", items.DeepClone()))).Element["items"]!.AsArray().Count);
        Assert.Equal(12, AiDesignCatalog.Coerce(AiDesignCatalog.Types.Single(t => t.Type == "imageStrip").Find("items")!, items.DeepClone()).Value!.AsArray().Count);

        // icons: lower case with dashes
        var iconProp = AiDesignCatalog.Types.Single(t => t.Type == "icon").Find("icon")!;
        Assert.Equal("arrow-right", Validate("mm", ElementOf("icon", ("icon", "arrow-right"))).Element["icon"]!.GetValue<string>());
        Assert.Equal("", Validate("mm", ElementOf("icon", ("icon", "Arrow Right"))).Element["icon"]!.GetValue<string>());
        Assert.False(AiDesignCatalog.Coerce(iconProp, "arrow-right").Drop);
        Assert.True(AiDesignCatalog.Coerce(iconProp, "Arrow Right").Drop);

        // the limits of the document that the prompt tells
        Assert.Equal(500, DocumentValidator.MaxElementsPerPage);
        Assert.Equal(2000, DocumentValidator.MaxElementsTotal);
        Assert.Equal(50, DocumentValidator.MaxPages);
        Assert.Equal(3, DocumentValidator.MaxGroupDepth);
        var prompt = AiDesignCatalog.PromptText();
        Assert.Contains("höchstens 500 Elemente je Seite, 2000 im Design, 50 Seiten, Gruppen höchstens drei Ebenen", prompt);
    }

    [Fact]
    public void The_background_and_the_fields_follow_the_validator_too()
    {
        foreach (var fit in AiDesignCatalog.Background.Single(p => p.Name == "fit").Values!)
        {
            var doc = JsonNode.Parse(DocOf("mm", ElementOf("shape")))!;
            doc["pages"]![0]!["background"] = new JsonObject { ["color"] = "#112233", ["fit"] = fit };
            var result = DocumentValidator.Validate(doc.ToJsonString());
            Assert.Equal(fit, JsonNode.Parse(result.Json!)!["pages"]![0]!["background"]!["fit"]!.GetValue<string>());
        }

        foreach (var type in AiDesignCatalog.FieldProps.Single(p => p.Name == "type").Values!)
        {
            var doc = JsonNode.Parse(DocOf("mm", ElementOf("shape")))!;
            doc["fields"] = new JsonArray(new JsonObject { ["key"] = "Preis", ["type"] = type });
            var field = JsonNode.Parse(DocumentValidator.Validate(doc.ToJsonString()).Json!)!["fields"]![0]!;
            Assert.Equal(type, field["type"]!.GetValue<string>());
        }

        Assert.True(AiDesignCatalog.IsKey("A_1"));
        Assert.False(AiDesignCatalog.IsKey("1A"));
        Assert.False(AiDesignCatalog.IsKey(new string('a', 41)));
        Assert.True(AiDesignCatalog.IsKey(new string('a', 40)));
        var doc2 = JsonNode.Parse(DocOf("mm", ElementOf("shape")))!;
        doc2["fields"] = new JsonArray(new JsonObject { ["key"] = new string('a', 41) }, new JsonObject { ["key"] = new string('b', 40) });
        Assert.Single(JsonNode.Parse(DocumentValidator.Validate(doc2.ToJsonString()).Json!)!["fields"]!.AsArray());
    }

    [Fact]
    public void The_prompt_names_every_type_and_property()
    {
        var text = AiDesignCatalog.PromptText();
        foreach (var type in AiDesignCatalog.Types)
        {
            Assert.Contains("- " + type.Type + " –", text);
            foreach (var prop in type.Props.Skip(AiDesignCatalog.Common.Count))
            {
                Assert.Contains(prop.Name + ":", text);
            }
        }

        foreach (var prop in AiDesignCatalog.Common)
        {
            Assert.Contains(prop.Name, text);
        }

        Assert.Contains("pt", text);
    }
}
