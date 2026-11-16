using System.Text;
using System.Text.Json;
using MatCan.Core.Data;
using MatCan.Core.Documents;

namespace MatCan.Tests.Core;

public sealed class DocumentValidatorTests
{
    private static string Elements(int count)
        => "{\"elements\":[" + string.Join(",", Enumerable.Range(0, count).Select(i => $"{{\"id\":\"n{i}\",\"type\":\"shape\"}}")) + "]}";

    [Fact]
    public void An_empty_text_or_garbage_is_refused_in_german()
    {
        foreach (var bad in new[] { null, "", "   ", "not json", "[1,2]", "42", "\"x\"", "{\"a\":" })
        {
            var result = DocumentValidator.Validate(bad);
            Assert.False(result.Ok);
            Assert.False(string.IsNullOrEmpty(result.Error));
            Assert.Null(result.Json);
        }
    }

    [Fact]
    public void An_empty_object_gives_the_defaults()
    {
        var result = DocumentValidator.Validate("{}");
        Assert.True(result.Ok);
        var doc = result.Document!;
        Assert.Equal(("mm", 100d, 100d, 300), (doc.Unit, doc.Width, doc.Height, doc.Dpi));
        Assert.Equal("de-DE", doc.Locale);
        Assert.Equal("#ffffff", doc.Pages[0].Background.Color);
        Assert.Empty(doc.Pages[0].Elements);
        Assert.Empty(result.Warnings);
    }

    [Fact]
    public void Pixel_documents_default_to_800()
    {
        var doc = DocumentValidator.Parse("{\"unit\":\"px\"}")!;
        Assert.Equal((800d, 800d), (doc.Width, doc.Height));
    }

    [Fact]
    public void More_than_500_elements_are_cut_with_a_warning()
    {
        var result = DocumentValidator.Validate(Elements(501));
        Assert.True(result.Ok);
        Assert.Equal(500, result.Document!.Pages[0].Elements.Count);
        Assert.Contains(result.Warnings, w => w.Contains("500 Elemente"));
    }

    [Fact]
    public void Exactly_500_elements_are_fine()
    {
        var result = DocumentValidator.Validate(Elements(500));
        Assert.Equal(500, result.Document!.Pages[0].Elements.Count);
        Assert.Empty(result.Warnings);
    }

    [Fact]
    public void More_than_100_fields_are_cut_with_a_warning()
    {
        var fields = string.Join(",", Enumerable.Range(0, 101).Select(i => $"{{\"key\":\"F{i}\"}}"));
        var result = DocumentValidator.Validate("{\"fields\":[" + fields + "]}");
        Assert.Equal(100, result.Document!.Fields.Count);
        Assert.Contains(result.Warnings, w => w.Contains("100 Felder"));
    }

    [Fact]
    public void A_document_over_4_megabytes_is_refused()
    {
        var big = "{\"elements\":[{\"type\":\"text\",\"text\":\"" + new string('x', DocumentValidator.MaxJsonBytes) + "\"}]}";
        var result = DocumentValidator.Validate(big);
        Assert.False(result.Ok);
        Assert.Contains("4 MB", result.Error);
    }

    [Fact]
    public void Multi_byte_characters_count_as_bytes()
    {
        // 1.5 million euro signs are 4.5 MB in UTF-8 but only 1.5 million characters.
        var text = "{\"background\":{\"asset\":\"" + new string((char)0x20AC, 1_500_000) + "\"}}";
        Assert.False(DocumentValidator.Validate(text).Ok);
    }

    [Fact]
    public void A_depth_bomb_is_refused_without_a_stack_overflow()
    {
        var bomb = new StringBuilder();
        for (var i = 0; i < 100_000; i++)
        {
            bomb.Append('[');
        }

        var result = DocumentValidator.Validate("{\"elements\":" + bomb + "}");
        Assert.False(result.Ok);
        Assert.Contains("verschachtelt", result.Error);
    }

    [Fact]
    public void Unknown_properties_are_dropped_from_the_stored_json()
    {
        var json = "{\"evil\":1,\"background\":{\"color\":\"#fff\",\"x\":2},\"fields\":[{\"key\":\"A\",\"secret\":\"s\"}],\"elements\":[{\"type\":\"text\",\"text\":\"t\",\"onclick\":\"alert(1)\",\"extra\":{}}]}";
        var result = DocumentValidator.Validate(json);
        Assert.DoesNotContain("evil", result.Json);
        Assert.DoesNotContain("secret", result.Json);
        Assert.DoesNotContain("onclick", result.Json);
        Assert.DoesNotContain("extra", result.Json);
        Assert.DoesNotContain("\"x\":2", result.Json);
    }

    [Fact]
    public void Numbers_are_clamped()
    {
        var json = "{\"width\":-5,\"height\":1e9,\"dpi\":5000,\"elements\":[{\"type\":\"text\",\"fontSize\":5000,\"opacity\":7,\"rotation\":999,\"lineHeight\":0,\"letterSpacing\":-9,\"fontWeight\":1,\"x\":-1e9,\"w\":-4}]}";
        var result = DocumentValidator.Validate(json);
        var doc = result.Document!;
        var text = Assert.IsType<TextElement>(doc.Pages[0].Elements[0]);
        Assert.Equal(0.1, doc.Width);
        Assert.Equal(100000, doc.Height);
        Assert.Equal(1200, doc.Dpi);
        Assert.Equal(1000, text.FontSize);
        Assert.Equal(1, text.Opacity);
        Assert.Equal(360, text.Rotation);
        Assert.Equal(0.5, text.LineHeight);
        Assert.Equal(-0.5, text.LetterSpacing);
        Assert.Equal(100, text.FontWeight);
        Assert.Equal(-1e6, text.X);
        Assert.Equal(0, text.W);
        Assert.NotEmpty(result.Warnings);
    }

    [Fact]
    public void Numbers_given_as_text_are_accepted_and_others_use_the_default()
    {
        var doc = DocumentValidator.Parse("{\"width\":\"150\",\"height\":\"abc\",\"elements\":[{\"type\":\"shape\",\"x\":true,\"y\":\" 3.5 \"}]}")!;
        Assert.Equal(150, doc.Width);
        Assert.Equal(100, doc.Height);
        Assert.Equal((0d, 3.5), (doc.Pages[0].Elements[0].X, doc.Pages[0].Elements[0].Y));
    }

    [Theory]
    [InlineData("red")]
    [InlineData("#12")]
    [InlineData("#12345")]
    [InlineData("#gggggg")]
    [InlineData("rgb(0,0,0)")]
    [InlineData("url(javascript:1)")]
    public void Invalid_colours_are_replaced(string colour)
    {
        var doc = DocumentValidator.Parse("{\"background\":{\"color\":\"" + colour + "\"},\"elements\":[{\"type\":\"text\",\"color\":\"" + colour + "\"},{\"type\":\"shape\",\"shape\":\"line\",\"stroke\":\"" + colour + "\",\"fill\":\"" + colour + "\"}]}")!;
        Assert.Equal("#ffffff", doc.Pages[0].Background.Color);
        Assert.Equal("#000000", ((TextElement)doc.Pages[0].Elements[0]).Color);
        var line = (ShapeElement)doc.Pages[0].Elements[1];
        Assert.Equal("#000000", line.Stroke);
        Assert.Null(line.Fill);
    }

    [Fact]
    public void Colours_are_lower_cased_and_the_short_form_is_kept()
    {
        var doc = DocumentValidator.Parse("{\"background\":{\"color\":\" #ABC \"},\"elements\":[{\"type\":\"text\",\"color\":\"#AABBCC\"}]}")!;
        Assert.Equal("#abc", doc.Pages[0].Background.Color);
        Assert.Equal("#aabbcc", ((TextElement)doc.Pages[0].Elements[0]).Color);
    }

    [Fact]
    public void An_explicit_null_stroke_stays_null_even_for_a_line()
    {
        var doc = DocumentValidator.Parse("{\"elements\":[{\"type\":\"shape\",\"shape\":\"line\",\"stroke\":null},{\"type\":\"shape\",\"shape\":\"line\"}]}")!;
        Assert.Null(((ShapeElement)doc.Pages[0].Elements[0]).Stroke);
        Assert.Equal("#000000", ((ShapeElement)doc.Pages[0].Elements[1]).Stroke);
    }

    [Fact]
    public void Duplicate_element_ids_are_renamed_and_missing_ones_made_up()
    {
        var result = DocumentValidator.Validate("{\"elements\":[{\"id\":\"a\",\"type\":\"shape\"},{\"id\":\"a\",\"type\":\"shape\"},{\"type\":\"shape\"},{\"id\":\"e3\",\"type\":\"shape\"}]}");
        var ids = result.Document!.Pages[0].Elements.Select(e => e.Id).ToList();
        Assert.Equal(4, ids.Distinct().Count());
        Assert.Equal("a", ids[0]);
        Assert.Equal("e2", ids[1]);
        Assert.Equal("e3", ids[2]);
        Assert.NotEmpty(result.Warnings);
    }

    [Fact]
    public void Long_ids_are_cut_to_24_characters()
    {
        var doc = DocumentValidator.Parse("{\"elements\":[{\"id\":\"" + new string('i', 60) + "\",\"type\":\"shape\"}]}")!;
        Assert.Equal(24, doc.Pages[0].Elements[0].Id.Length);
    }

    [Fact]
    public void Duplicate_field_keys_are_dropped_without_regard_to_case()
    {
        var result = DocumentValidator.Validate("{\"fields\":[{\"key\":\"Name\",\"label\":\"first\"},{\"key\":\"NAME\",\"label\":\"second\"},{\"key\":\"name\"}]}");
        var field = Assert.Single(result.Document!.Fields);
        Assert.Equal("first", field.Label);
        Assert.Contains(result.Warnings, w => w.Contains("doppelte Felder"));
    }

    [Theory]
    [InlineData("1abc")]
    [InlineData("a-b")]
    [InlineData("")]
    [InlineData("Ünder")]
    [InlineData("a b")]
    [InlineData("{{x}}")]
    public void Fields_with_bad_keys_are_dropped(string key)
    {
        var doc = DocumentValidator.Parse("{\"fields\":[{\"key\":\"" + key + "\"},{\"key\":\"Good\"}]}")!;
        Assert.Equal(["Good"], doc.Fields.Select(f => f.Key));
    }

    [Fact]
    public void A_key_longer_than_40_characters_is_dropped_and_40_is_fine()
    {
        var doc = DocumentValidator.Parse("{\"fields\":[{\"key\":\"" + new string('k', 41) + "\"},{\"key\":\"" + new string('k', 40) + "\"}]}")!;
        Assert.Single(doc.Fields);
    }

    [Fact]
    public void Unknown_element_types_and_non_objects_are_dropped()
    {
        var result = DocumentValidator.Validate("{\"elements\":[{\"type\":\"script\"},5,null,\"x\",{\"type\":\"text\"},{\"type\":\"TEXT\"}]}");
        Assert.IsType<TextElement>(Assert.Single(result.Document!.Pages[0].Elements));
        Assert.Contains(result.Warnings, w => w.Contains("unbekanntem Typ"));
    }

    [Fact]
    public void Field_types_and_decimals_follow_the_engine()
    {
        var doc = DocumentValidator.Parse("{\"fields\":[{\"key\":\"A\",\"type\":\"price\"},{\"key\":\"B\",\"type\":\"number\"},{\"key\":\"C\",\"type\":\"number\",\"decimals\":9},{\"key\":\"D\",\"type\":\"text\",\"decimals\":2},{\"key\":\"E\",\"type\":\"nonsense\"},{\"key\":\"F\",\"type\":\"price\",\"decimals\":\"3\"}]}")!;
        Assert.Equal(2, doc.Fields[0].Decimals);
        Assert.Null(doc.Fields[1].Decimals);
        Assert.Equal(4, doc.Fields[2].Decimals);
        Assert.Null(doc.Fields[3].Decimals);
        Assert.Equal("text", doc.Fields[4].Type);
        Assert.Equal(3, doc.Fields[5].Decimals);
    }

    [Fact]
    public void An_image_strip_keeps_12_slots_and_empty_ones_as_null()
    {
        var items = string.Join(",", Enumerable.Range(0, 13).Select(i => i == 3 ? "{\"asset\":\"\"}" : $"{{\"asset\":\"a{i}\"}}"));
        var result = DocumentValidator.Validate("{\"elements\":[{\"type\":\"imageStrip\",\"items\":[" + items + "]}]}");
        var strip = Assert.IsType<ImageStripElement>(result.Document!.Pages[0].Elements[0]);
        Assert.Equal(12, strip.Items.Count);
        Assert.Null(strip.Items[3]);
        Assert.Contains(result.Warnings, w => w.Contains("12 Bilder"));
    }

    [Fact]
    public void A_source_with_asset_and_field_prefers_the_asset()
    {
        var doc = DocumentValidator.Parse("{\"elements\":[{\"type\":\"image\",\"source\":{\"asset\":\" flag-de \",\"field\":\"Land\"}},{\"type\":\"image\",\"source\":{\"field\":\"9x\"}}]}")!;
        Assert.Equal(new SourceDef("flag-de", null), ((ImageElement)doc.Pages[0].Elements[0]).Source);
        Assert.Null(((ImageElement)doc.Pages[0].Elements[1]).Source);
    }

    [Fact]
    public void Text_and_names_are_cut_to_their_limits()
    {
        var doc = DocumentValidator.Parse("{\"fields\":[{\"key\":\"A\",\"label\":\"" + new string('l', 200) + "\",\"sample\":\"" + new string('s', 3000) + "\"}],\"elements\":[{\"type\":\"text\",\"name\":\"" + new string('n', 200) + "\",\"text\":\"" + new string('t', 6000) + "\"}]}")!;
        Assert.Equal(80, doc.Fields[0].Label.Length);
        Assert.Equal(2000, doc.Fields[0].Sample.Length);
        Assert.Equal(80, doc.Pages[0].Elements[0].Name.Length);
        Assert.Equal(5000, ((TextElement)doc.Pages[0].Elements[0]).Text.Length);
    }

    [Fact]
    public void The_locale_must_look_like_a_language_tag()
    {
        Assert.Equal("fr-FR", DocumentValidator.Parse("{\"locale\":\"fr-FR\"}")!.Locale);
        Assert.Equal("de-DE", DocumentValidator.Parse("{\"locale\":\"fr_FR\"}")!.Locale);
        Assert.Equal("de-DE", DocumentValidator.Parse("{\"locale\":\"<script>\"}")!.Locale);
        Assert.Equal("de-DE", DocumentValidator.Parse("{\"locale\":\"\"}")!.Locale);
    }

    [Fact]
    public void Validation_is_idempotent()
    {
        var first = DocumentValidator.Validate(EngineAgreementData.HostileOneInput);
        var second = DocumentValidator.Validate(first.Json);
        Assert.Equal(first.Json, second.Json);
        Assert.Empty(second.Warnings);
    }

    [Fact]
    public void Normalize_of_a_document_built_in_code_is_idempotent()
    {
        var created = DocumentValidator.Create(150, 100);

        Assert.Equal(DocumentValidator.ToJson(created), DocumentValidator.ToJson(DocumentValidator.Normalize(created)));
        Assert.NotNull(DocumentValidator.Normalize(null));
    }

    [Fact]
    public void Create_makes_an_empty_document()
    {
        var doc = DocumentValidator.Create(85, 55);
        Assert.Equal(("mm", 85d, 55d, 300, 2), (doc.Unit, doc.Width, doc.Height, doc.Dpi, doc.Schema));
        Assert.Equal("p1", Assert.Single(doc.Pages).Id);
        Assert.Equal("px", DocumentValidator.Create(10, 10, "px").Unit);
        Assert.Equal("mm", DocumentValidator.Create(10, 10, "cm").Unit);
    }

    [Fact]
    public void A_demo_like_document_survives_a_round_trip()
    {
        var result = DocumentValidator.Validate(EngineAgreementData.DemoInput);
        Assert.True(result.Ok);
        Assert.Empty(result.Warnings);
        var doc = result.Document!;
        Assert.Equal(4, doc.Fields.Count);
        Assert.Equal(4, doc.Pages[0].Elements.Count);
        var strip = Assert.IsType<ImageStripElement>(doc.Pages[0].Elements[0]);
        Assert.Equal(3, strip.Items.Count);
        var name = Assert.IsType<TextElement>(doc.Pages[0].Elements[1]);
        Assert.Equal("shrink", name.Fit);
        Assert.Equal("#1b2a49", name.Color);
        Assert.Equal("Preis", doc.Pages[0].Elements[2].ShowIf);
        Assert.Equal("Holunderblüte", doc.Fields[0].Sample);
        Assert.Contains("Holunderblüte", result.Json);
        var again = DocumentValidator.Parse(result.Json)!;
        Assert.Equal(doc.Fields, again.Fields);
        Assert.Equal(doc.Pages[0].Elements.Count, again.Pages[0].Elements.Count);
    }

    [Fact]
    public void Hostile_values_with_script_stay_plain_text()
    {
        var json = "{\"elements\":[{\"type\":\"text\",\"text\":\"</script><img src=x onerror=alert(1)>\"}]}";
        var result = DocumentValidator.Validate(json);
        // The stored text is data; it is never put into markup. The JSON encoder escapes the markup characters anyway.
        Assert.DoesNotContain("<", result.Json);
        Assert.Equal("</script><img src=x onerror=alert(1)>", ((TextElement)result.Document!.Pages[0].Elements[0]).Text);
    }

    [Fact]
    public void Negative_zero_is_written_as_zero()
    {
        var result = DocumentValidator.Validate("{\"elements\":[{\"type\":\"shape\",\"x\":-0.0,\"rotation\":-0}]}");
        Assert.DoesNotContain("-0", result.Json);
    }

    // The engine is the reference: documents and the output of DtEngine.normalize are in EngineAgreementData (generated by a node script).
    public static IEnumerable<object[]> AgreementDocuments => EngineAgreementData.DocumentNames.Select(n => new object[] { n });

    [Theory]
    [MemberData(nameof(AgreementDocuments))]
    public void Validator_agrees_with_the_engine(string name)
    {
        var input = (string)typeof(EngineAgreementData).GetField(name + "Input")!.GetRawConstantValue()!;
        var engine = (string)typeof(EngineAgreementData).GetField(name + "Engine")!.GetRawConstantValue()!;
        var result = DocumentValidator.Validate(input);
        Assert.True(result.Ok);
        using var expected = JsonDocument.Parse(engine);
        using var actual = JsonDocument.Parse(result.Json!);
        var difference = Compare(expected.RootElement, actual.RootElement, "$");
        Assert.True(difference is null, difference);
    }

    private static string? Compare(JsonElement expected, JsonElement actual, string path)
    {
        if (expected.ValueKind != actual.ValueKind && !(IsBool(expected) && IsBool(actual) && expected.ValueKind == actual.ValueKind))
        {
            return $"{path}: engine {expected.ValueKind} {expected.GetRawText()}, C# {actual.ValueKind} {actual.GetRawText()}";
        }

        switch (expected.ValueKind)
        {
            case JsonValueKind.Object:
                var expectedNames = expected.EnumerateObject().Select(p => p.Name).OrderBy(n => n, StringComparer.Ordinal).ToList();
                var actualNames = actual.EnumerateObject().Select(p => p.Name).OrderBy(n => n, StringComparer.Ordinal).ToList();
                if (!expectedNames.SequenceEqual(actualNames))
                {
                    return $"{path}: engine has [{string.Join(",", expectedNames)}], C# has [{string.Join(",", actualNames)}]";
                }

                foreach (var name in expectedNames)
                {
                    var difference = Compare(expected.GetProperty(name), actual.GetProperty(name), path + "." + name);
                    if (difference is not null)
                    {
                        return difference;
                    }
                }

                return null;
            case JsonValueKind.Array:
                if (expected.GetArrayLength() != actual.GetArrayLength())
                {
                    return $"{path}: engine {expected.GetArrayLength()} items, C# {actual.GetArrayLength()}";
                }

                for (var i = 0; i < expected.GetArrayLength(); i++)
                {
                    var difference = Compare(expected[i], actual[i], $"{path}[{i}]");
                    if (difference is not null)
                    {
                        return difference;
                    }
                }

                return null;
            case JsonValueKind.Number:
                return Math.Abs(expected.GetDouble() - actual.GetDouble()) <= 1e-9 ? null : $"{path}: engine {expected.GetRawText()}, C# {actual.GetRawText()}";
            case JsonValueKind.String:
                return expected.GetString() == actual.GetString() ? null : $"{path}: engine \"{expected.GetString()}\", C# \"{actual.GetString()}\"";
            default:
                return null;
        }
    }

    private static bool IsBool(JsonElement e) => e.ValueKind is JsonValueKind.True or JsonValueKind.False;
}

public sealed class PlaceholderTests
{
    private static readonly IReadOnlyList<FieldDef> Fields =
    [
        new("Name", "Name", "text", "", null, null, false),
        new("Preis", "Preis", "price", "", 2, null, false),
        new("Menge", "Menge", "number", "", 1, null, false),
    ];

    private static IReadOnlyDictionary<string, string?> Values(params (string Key, string? Value)[] pairs)
        => pairs.ToDictionary(p => p.Key, p => p.Value);

    [Fact]
    public void Keys_are_found_with_whitespace_and_without_regard_to_case()
    {
        Assert.Equal(["Name", "Preis"], Placeholders.Keys("{{Name}} und {{ name }} kostet {{  Preis\t}} Euro"));
        Assert.Empty(Placeholders.Keys("{Name} {{1x}} {{a-b}} {{}} {{ }}"));
        Assert.Empty(Placeholders.Keys(null));
    }

    [Fact]
    public void Render_replaces_tokens_and_formats_by_field_type()
    {
        var text = Placeholders.Render("{{Name}}: {{ preis }} €", Fields, Values(("name", "Gouda"), ("PREIS", "2.5")));
        Assert.Equal("Gouda: 2,50 €", text);
    }

    [Fact]
    public void An_unknown_key_or_a_missing_value_renders_empty()
    {
        Assert.Equal("a--b", Placeholders.Render("a-{{Unbekannt}}-b", Fields, Values()));
        Assert.Equal("[]", Placeholders.Render("[{{Name}}]", Fields, Values(("Name", null))));
        Assert.Equal("[]", Placeholders.Render("[{{Unbekannt}}]", Fields, Values(("Unbekannt", null))));
    }

    [Fact]
    public void Missing_tokens_can_be_kept_without_their_whitespace()
    {
        Assert.Equal("{{Name}} {{Foo}}", Placeholders.Render("{{ Name }} {{Foo}}", Fields, Values(), "de-DE", true));
    }

    [Fact]
    public void A_key_without_a_field_uses_the_value_as_it_is()
    {
        Assert.Equal("1.5", Placeholders.Render("{{Zahl}}", [], Values(("Zahl", "1.5"))));
    }

    [Fact]
    public void The_locale_decides_the_separators()
    {
        Assert.Equal("1,234.5", Placeholders.Render("{{Menge}}", Fields, Values(("Menge", "1234,5")), "en-US"));
    }

    private static DesignDocument Document(params DesignElement[] elements)
        => DocumentValidator.Create(100, 100) with { Fields = [new FieldDef("Land", "Land", "image", "flag-de", null, null, false), new FieldDef("Bild", "Bild", "image", " ", null, null, false), new FieldDef("Name", "Name", "text", "x", null, null, false)], Pages = [DocumentValidator.EmptyPage("p1") with { Elements = elements }] };

    [Fact]
    public void FieldsUsed_reports_text_image_strip_and_showIf_uses_like_the_engine()
    {
        var document = Document(
            new TextElement { Id = "t1", Name = "Titel", Text = "{{name}} {{Name}} {{Preis}}", ShowIf = "Land" },
            new ImageElement { Id = "i1", Source = new SourceDef(null, "Land") },
            new ImageStripElement { Id = "s1", Items = [new SourceDef(null, "Land"), null, new SourceDef("flag-de", null), new SourceDef(null, "Icon1")] });

        var usage = Placeholders.FieldsUsed(document);

        Assert.Equal(["Land", "Name", "Preis", "Icon1"], usage.Select(u => u.Key));
        var land = usage[0];
        Assert.True(land.Defined);
        Assert.Equal("Land", land.Field!.Key);
        Assert.Equal(["showIf", "image", "strip"], land.Uses.Select(u => u.Kind));
        Assert.Equal(["t1", "i1", "s1"], land.Uses.Select(u => u.ElementId));
        var name = usage[1];
        Assert.Single(name.Uses);
        Assert.False(usage[2].Defined);
        Assert.Null(usage[2].Field);
        Assert.False(usage[3].Defined);
    }

    [Fact]
    public void FieldsUsed_matches_the_engine_on_the_demo()
    {
        var usage = Placeholders.FieldsUsed(DocumentValidator.Parse(EngineAgreementData.DemoInput)!);
        Assert.Equal(["Land", "Icon1", "Name", "Preis"], usage.Select(u => u.Key));
        Assert.Equal(["showIf", "text"], usage[3].Uses.Select(u => u.Kind));
        Assert.All(usage, u => Assert.True(u.Defined));
    }

    [Fact]
    public void AssetKeys_lists_background_images_strips_and_image_samples_once()
    {
        var document = Document(
            new ImageElement { Id = "i1", Source = new SourceDef("Logo", null) },
            new ImageElement { Id = "i2", Source = new SourceDef(null, "Land") },
            new ImageStripElement { Id = "s1", Items = [new SourceDef("logo", null), null, new SourceDef("icon-bio", null)] });
        document = document with { Pages = [document.Pages[0] with { Background = new BackgroundDef("#ffffff", null, "bg-paper", "cover") }] };

        Assert.Equal(["bg-paper", "Logo", "icon-bio", "flag-de"], Placeholders.AssetKeys(document));
    }
}

public sealed class FormatPresetTests
{
    [Fact]
    public void Every_preset_has_a_unique_key_and_a_positive_size()
    {
        Assert.Equal(FormatPresets.All.Count, FormatPresets.All.Select(p => p.Key).Distinct(StringComparer.OrdinalIgnoreCase).Count());
        Assert.All(FormatPresets.All, p =>
        {
            Assert.True(p.Width > 0 && p.Height > 0);
            Assert.Contains(p.Unit, FormatPresets.Units);
            Assert.False(string.IsNullOrWhiteSpace(p.Name));
        });
    }

    [Fact]
    public void The_wanted_formats_exist()
    {
        Assert.Equal((210d, 297d), (FormatPresets.Find("a4-portrait")!.Width, FormatPresets.Find("a4-portrait")!.Height));
        Assert.Equal((297d, 210d), (FormatPresets.Find("a4-landscape")!.Width, FormatPresets.Find("A4-LANDSCAPE")!.Height));
        Assert.Equal((85d, 55d), (FormatPresets.Find("business-card")!.Width, FormatPresets.Find("business-card")!.Height));
        Assert.Equal("px", FormatPresets.Find("instagram-post")!.Unit);
        Assert.Equal(1920, FormatPresets.Find("instagram-story")!.Height);
        Assert.Equal((150d, 100d), (FormatPresets.Find("label-150x100")!.Width, FormatPresets.Find("label-150x100")!.Height));
        Assert.Null(FormatPresets.Find("nope"));
        Assert.Null(FormatPresets.Find(null));
        Assert.Contains(FormatPresets.All, p => p.Group == "Plakate");
    }

    [Fact]
    public void A_preset_makes_a_valid_document()
    {
        foreach (var p in FormatPresets.All)
        {
            var doc = DocumentValidator.Create(p.Width, p.Height, p.Unit);
            Assert.Equal((p.Width, p.Height, p.Unit), (doc.Width, doc.Height, doc.Unit));
            var started = FormatPresets.NewDocument(p);
            Assert.Equal((p.Width, p.Height, p.Unit, p.Fold), (started.Width, started.Height, started.Unit, started.Fold));
            Assert.Equal(DocumentValidator.ToJson(started), DocumentValidator.ToJson(DocumentValidator.Parse(DocumentValidator.ToJson(started))!));
        }
    }

    [Fact]
    public void The_formats_of_plan_6_exist_and_a_folded_card_is_the_open_sheet_with_two_named_pages()
    {
        string[] wanted =
        [
            "card-a6-portrait", "card-a6-landscape", "card-square-145", "card-dl-portrait", "table-card", "postcard-a6-landscape", "postcard-a6-portrait", "letterhead-a4", "certificate-a4", "voucher-dl",
            "menu-dl", "table-number", "tearoff-a4", "name-badge", "bookmark", "label-round-60", "facebook-cover", "poster-a2-portrait",
        ];
        Assert.All(wanted, key => Assert.NotNull(FormatPresets.Find(key)));
        Assert.Equal(("vertical", 210d, 148d), (FormatPresets.Find("card-a6-portrait")!.Fold, FormatPresets.Find("card-a6-portrait")!.Width, FormatPresets.Find("card-a6-portrait")!.Height));
        Assert.Equal(("horizontal", 148d, 210d), (FormatPresets.Find("card-a6-landscape")!.Fold, FormatPresets.Find("card-a6-landscape")!.Width, FormatPresets.Find("card-a6-landscape")!.Height));
        Assert.Equal((290d, 145d), (FormatPresets.Find("card-square-145")!.Width, FormatPresets.Find("card-square-145")!.Height));
        Assert.Equal((99d, 210d), (FormatPresets.Find("menu-dl")!.Width, FormatPresets.Find("menu-dl")!.Height));

        foreach (var p in FormatPresets.All.Where(p => p.Fold != "none"))
        {
            var doc = FormatPresets.NewDocument(p);
            Assert.Equal(2, doc.Pages.Count);
            Assert.Equal(FormatPresets.FoldPageNames(p.Fold), doc.Pages.Select(page => page.Name));
            Assert.False(string.IsNullOrEmpty(p.Note), p.Key + " says the folded size");
            Assert.Equal(2, new HashSet<string>(doc.Pages.Select(page => page.Id)).Count);
        }

        var postcard = FormatPresets.NewDocument(FormatPresets.Find("postcard-a6-landscape")!);
        Assert.Equal(["Vorderseite", "Rückseite"], postcard.Pages.Select(page => page.Name));
        Assert.Equal("none", postcard.Fold);
        Assert.Single(FormatPresets.NewDocument(FormatPresets.Find("a4-portrait")!).Pages);
        Assert.True(FormatPresets.All.Select(p => p.Group).Distinct().Count() >= 6);
        Assert.Equal(FormatPresets.All.Count(p => !FormatPresets.IsTile(p.Key)), FormatPresets.All.Where(p => !FormatPresets.IsTile(p.Key)).Select(p => p.Key).Distinct().Count());
        // the tiles of the start page stay few
        Assert.Equal(10, FormatPresets.Tiles.Count);
    }

    [Fact]
    public void The_fold_is_written_only_when_it_is_set_and_everything_else_is_none()
    {
        string Json(string fold) => "{\"schema\":2,\"unit\":\"mm\",\"width\":210,\"height\":148,\"fold\":" + fold + ",\"pages\":[{\"id\":\"a\"}]}";
        Assert.Equal("vertical", DocumentValidator.Parse(Json("\"vertical\""))!.Fold);
        Assert.Equal("horizontal", DocumentValidator.Parse(Json("\"horizontal\""))!.Fold);
        foreach (var bad in new[] { "\"none\"", "\"diagonal\"", "\"Vertical\"", "5", "null", "true", "{}" })
        {
            var result = DocumentValidator.Validate(Json(bad));
            Assert.Equal("none", result.Document!.Fold);
            Assert.DoesNotContain("\"fold\"", result.Json);
        }

        var folded = DocumentValidator.Validate(Json("\"vertical\"")).Json!;
        Assert.Contains("\"fold\":\"vertical\"", folded);
        Assert.Contains("\"locale\":\"de-DE\",\"fold\":\"vertical\",\"fields\"", folded);
        Assert.Equal(folded, DocumentValidator.Validate(folded).Json);
        // resizing keeps the fold, a document without one stays without
        var resized = DocumentResize.Resize(DocumentValidator.Parse(folded)!, 420, 296, "mm", true);
        Assert.Equal("vertical", resized.Fold);
        Assert.DoesNotContain("\"fold\"", DocumentValidator.ToJson(DocumentValidator.Create(10, 10)));
    }
}

public sealed class ColumnDefTests
{
    [Fact]
    public void Columns_are_read_leniently()
    {
        var json = "[{\"key\":\"Name\",\"label\":\"\",\"type\":\"weird\"},{\"key\":\"NAME\"},{\"key\":\"1x\"},{\"key\":\"Preis\",\"type\":\"price\"},{\"key\":\"Land\",\"type\":\"image\",\"category\":\"Flaggen\"},{\"key\":\"N\",\"type\":\"number\",\"decimals\":9},{\"key\":\"T\",\"type\":\"text\",\"decimals\":2,\"category\":\"x\"},5,null]";
        var columns = ColumnDefs.Parse(json);
        Assert.Equal(["Name", "Preis", "Land", "N", "T"], columns.Select(c => c.Key));
        Assert.Equal(new ColumnDef("Name", "Name", "text", null, null), columns[0]);
        Assert.Equal(2, columns[1].Decimals);
        Assert.Equal("Flaggen", columns[2].Category);
        Assert.Equal(4, columns[3].Decimals);
        Assert.Equal(new ColumnDef("T", "T", "text", null, null), columns[4]);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("nonsense")]
    [InlineData("{}")]
    [InlineData("\"text\"")]
    public void Garbage_gives_no_columns(string? json) => Assert.Empty(ColumnDefs.Parse(json));

    [Fact]
    public void At_most_100_columns_are_read()
    {
        var json = "[" + string.Join(",", Enumerable.Range(0, 130).Select(i => $"{{\"key\":\"C{i}\"}}")) + "]";
        Assert.Equal(100, ColumnDefs.Parse(json).Count);
    }

    [Fact]
    public void Columns_round_trip_through_json()
    {
        var columns = new[] { new ColumnDef("Name", "Käse", "text", null, null), new ColumnDef("Preis", "Preis", "price", 2, null), new ColumnDef("Land", "Land", "image", null, "Flaggen") };
        var json = ColumnDefs.ToJson(columns);
        Assert.Contains("\"key\":\"Name\"", json);
        Assert.Contains("\"decimals\":null", json);
        Assert.Equal(columns, ColumnDefs.Parse(json));
    }

    [Fact]
    public void Check_names_what_is_wrong_in_german()
    {
        Assert.Null(ColumnDefs.Check([new ColumnDef("A", "A", "text", null, null), new ColumnDef("B", "B", "price", 2, null)]));
        Assert.Contains("doppelt", ColumnDefs.Check([new ColumnDef("A", "A", "text", null, null), new ColumnDef("a", "a", "text", null, null)]));
        Assert.Contains("Spalte 2", ColumnDefs.Check([new ColumnDef("A", "A", "text", null, null), new ColumnDef("1x", "1x", "text", null, null)]));
        Assert.Contains("Typ", ColumnDefs.Check([new ColumnDef("A", "A", "nonsense", null, null)]));
        Assert.NotNull(ColumnDefs.Check(Enumerable.Range(0, 101).Select(i => new ColumnDef("C" + i, "C", "text", null, null))));
    }

    [Theory]
    [InlineData("Name", true)]
    [InlineData("a", true)]
    [InlineData("A_1", true)]
    [InlineData("1A", false)]
    [InlineData("_A", false)]
    [InlineData("A-B", false)]
    [InlineData("Ä", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void Keys_follow_the_pattern(string? key, bool valid) => Assert.Equal(valid, ColumnDefs.IsValidKey(key));

    [Fact]
    public void Columns_can_be_made_from_the_fields_of_a_design()
    {
        var doc = DocumentValidator.Parse(EngineAgreementData.DemoInput)!;
        var columns = ColumnDefs.FromFields(doc.Fields);
        Assert.Equal(["Name", "Preis", "Land", "Icon1"], columns.Select(c => c.Key));
        Assert.Equal(("price", 2), (columns[1].Type, columns[1].Decimals));
        Assert.Equal("Flaggen", columns[2].Category);
        Assert.Equal("Herkunftsland", columns[2].Label);
    }
}
