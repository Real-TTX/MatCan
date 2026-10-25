using System.Text;
using System.Text.Json;
using DesignThix.Core.Documents;
using DesignThix.Core.Output;

namespace DesignThix.Tests.Core;

/// <summary>Document schema 2 (docs/PLAN-CANVA.md section 2): the upgrade from schema 1, pages, groups, the new element types and properties, the limits and hostile values.</summary>
public sealed class SchemaTwoValidatorTests
{
    private static DesignDocument Parse(string json) => DocumentValidator.Parse(json)!;

    private static DesignElement OnlyElement(string element) => Assert.Single(Parse("{\"schema\":2,\"pages\":[{\"elements\":[" + element + "]}]}").Pages[0].Elements);

    private static string Pages(string pages) => "{\"schema\":2,\"width\":100,\"height\":100,\"pages\":[" + pages + "]}";

    private static string Shapes(int count, string prefix = "n")
        => string.Join(",", Enumerable.Range(0, count).Select(i => $"{{\"id\":\"{prefix}{i}\",\"type\":\"shape\"}}"));

    // ------------------------------------------------------------------------------------------------ the upgrade 1 -> 2

    [Fact]
    public void A_schema_1_document_becomes_one_page()
    {
        var result = DocumentValidator.Validate("""
            {"schema":1,"unit":"mm","width":150,"height":100,"dpi":300,"locale":"de-DE",
             "background":{"color":"#FFF","asset":"paper","fit":"contain"},
             "fields":[{"key":"Name","type":"text","sample":"x"}],
             "elements":[{"id":"a","type":"text","text":"{{Name}}"},{"id":"b","type":"shape","shape":"line"}]}
            """);
        Assert.True(result.Ok);
        Assert.Empty(result.Warnings);
        var doc = result.Document!;
        Assert.Equal(2, doc.Schema);
        var page = Assert.Single(doc.Pages);
        Assert.Equal(("p1", ""), (page.Id, page.Name));
        Assert.Equal(new BackgroundDef("#fff", null, "paper", "contain"), page.Background);
        Assert.Equal(["a", "b"], page.Elements.Select(e => e.Id));
        Assert.Single(doc.Fields);

        // in the stored JSON the elements and the background live in the page, not at the top
        using var json = JsonDocument.Parse(result.Json!);
        Assert.Equal(2, json.RootElement.GetProperty("schema").GetInt32());
        Assert.False(json.RootElement.TryGetProperty("elements", out _));
        Assert.False(json.RootElement.TryGetProperty("background", out _));
        Assert.Equal(1, json.RootElement.GetProperty("pages").GetArrayLength());
    }

    [Fact]
    public void The_upgrade_is_idempotent_and_a_second_pass_changes_nothing()
    {
        var once = DocumentValidator.Validate(EngineAgreementData.DemoInput);
        var twice = DocumentValidator.Validate(once.Json);
        Assert.Equal(once.Json, twice.Json);
        Assert.Empty(twice.Warnings);
    }

    [Fact]
    public void A_document_without_a_schema_or_a_page_list_is_read_as_schema_1()
    {
        var doc = Parse("{\"elements\":[{\"type\":\"shape\"}],\"background\":{\"color\":\"#123456\"}}");
        Assert.Equal("#123456", doc.Pages[0].Background.Color);
        Assert.Single(doc.Pages[0].Elements);
    }

    [Fact]
    public void A_newer_schema_is_refused_in_german_and_nothing_is_stored()
    {
        foreach (var json in new[] { "{\"schema\":3}", "{\"schema\":7,\"pages\":[]}", "{\"schema\":99999999999}", "{\"schema\":3.5}" })
        {
            var result = DocumentValidator.Validate(json);
            Assert.False(result.Ok);
            Assert.Contains("neueren Version", result.Error);
            Assert.Null(result.Json);
        }

        // a schema that is no number is not a schema
        Assert.True(DocumentValidator.Validate("{\"schema\":\"7\"}").Ok);
        Assert.True(DocumentValidator.Validate("{\"schema\":-4}").Ok);
        Assert.Equal(2, Parse("{\"schema\":0}").Schema);
    }

    [Fact]
    public void The_lazy_upgrade_on_read_changes_only_what_is_old()
    {
        var current = DocumentValidator.Validate(EngineAgreementData.PagesInput).Json!;
        Assert.Same(current, DocumentValidator.Current(current));
        var upgraded = DocumentValidator.Current(EngineAgreementData.DemoInput);
        Assert.Equal(DocumentValidator.Validate(EngineAgreementData.DemoInput).Json, upgraded);
        Assert.Contains("\"pages\"", upgraded);
        Assert.Equal("not json", DocumentValidator.Current("not json"));
        Assert.Equal("{\"schema\":9}", DocumentValidator.Current("{\"schema\":9}"));
        Assert.Equal("", DocumentValidator.Current(""));
        Assert.Equal("", DocumentValidator.Current(null));
    }

    // ------------------------------------------------------------------------------------------------ pages

    [Fact]
    public void Pages_keep_their_order_names_and_backgrounds()
    {
        var doc = Parse(Pages("""
            {"id":"front","name":"Vorderseite","background":{"color":"#112233"},"elements":[{"id":"a","type":"shape"}]},
            {"id":"back","name":"Rückseite","background":{"color":null,"gradient":{"angle":90,"stops":[{"offset":0,"color":"#fff"},{"offset":1,"color":"#000"}]}},"elements":[{"id":"b","type":"shape"}]}
            """));
        Assert.Equal(["front", "back"], doc.Pages.Select(p => p.Id));
        Assert.Equal(["Vorderseite", "Rückseite"], doc.Pages.Select(p => p.Name));
        Assert.Equal("#112233", doc.Pages[0].Background.Color);
        Assert.Null(doc.Pages[1].Background.Color);
        Assert.Equal(new GradientDef(90, [new GradientStop(0, "#fff"), new GradientStop(1, "#000")]), doc.Pages[1].Background.Gradient);
        Assert.Equal("b", Assert.Single(doc.Pages[1].Elements).Id);
    }

    [Fact]
    public void Without_a_page_the_document_gets_an_empty_white_one()
    {
        foreach (var json in new[] { "{\"schema\":2,\"pages\":[]}", "{\"schema\":2}", "{}" })
        {
            var page = Assert.Single(Parse(json).Pages);
            Assert.Equal(("p1", "", "#ffffff"), (page.Id, page.Name, page.Background.Color));
            Assert.Empty(page.Elements);
        }
    }

    [Fact]
    public void More_than_50_pages_are_cut_with_a_warning()
    {
        var result = DocumentValidator.Validate(Pages(string.Join(",", Enumerable.Range(0, 60).Select(i => "{\"id\":\"p" + i + "\"}"))));
        Assert.Equal(50, result.Document!.Pages.Count);
        Assert.Contains(result.Warnings, w => w.Contains("50 Seiten"));
    }

    [Fact]
    public void Page_ids_are_made_unique_and_names_are_cut()
    {
        var doc = Parse(Pages("{\"id\":\"a\",\"name\":\"" + new string('n', 200) + "\"},{\"id\":\"a\"},{},5,\"x\",{\"id\":\"p3\"}"));
        Assert.Equal(6, doc.Pages.Count);
        Assert.Equal(6, doc.Pages.Select(p => p.Id).Distinct().Count());
        Assert.Equal(80, doc.Pages[0].Name.Length);
        Assert.Equal("a", doc.Pages[0].Id);
        Assert.Equal("p2", doc.Pages[1].Id);
    }

    [Fact]
    public void An_element_id_is_unique_across_all_pages_and_groups()
    {
        var doc = Parse(Pages("{\"elements\":[{\"id\":\"x\",\"type\":\"shape\"},{\"id\":\"g\",\"type\":\"group\",\"children\":[{\"id\":\"x\",\"type\":\"shape\"}]}]},{\"elements\":[{\"id\":\"x\",\"type\":\"shape\"},{\"id\":\"g\",\"type\":\"shape\"}]}"));
        var ids = doc.AllElements.Select(e => e.Id).ToList();
        Assert.Equal(ids.Count, ids.Distinct().Count());
        Assert.Equal(5, ids.Count);
    }

    // ------------------------------------------------------------------------------------------------ groups and limits

    [Fact]
    public void Groups_nest_three_deep_and_the_fourth_level_is_dropped_with_a_warning()
    {
        var result = DocumentValidator.Validate(Pages("""
            {"elements":[{"id":"g1","type":"group","children":[{"id":"t1","type":"text"},
              {"id":"g2","type":"group","children":[{"id":"g3","type":"group","children":[{"id":"ok","type":"shape"},{"id":"g4","type":"group","children":[{"id":"lost","type":"text"}]}]}]}]}]}
            """));
        var g1 = Assert.IsType<GroupElement>(result.Document!.Pages[0].Elements[0]);
        var g3 = Assert.IsType<GroupElement>(Assert.IsType<GroupElement>(g1.Children[1]).Children[0]);
        Assert.Equal(["ok"], g3.Children.Select(c => c.Id));
        Assert.DoesNotContain(result.Document.AllElements, e => e.Id is "g4" or "lost");
        Assert.Contains(result.Warnings, w => w.Contains("zu tief verschachtelte Gruppen"));
    }

    [Fact]
    public void Children_keep_their_page_coordinates_and_the_group_its_own_box()
    {
        var group = Assert.IsType<GroupElement>(OnlyElement("{\"type\":\"group\",\"x\":10,\"y\":20,\"w\":30,\"h\":40,\"rotation\":15,\"opacity\":0.5,\"flipX\":true,\"children\":[{\"type\":\"shape\",\"x\":12,\"y\":22,\"w\":5,\"h\":5}]}"));
        Assert.Equal((10d, 20d, 30d, 40d, 15d, 0.5, true), (group.X, group.Y, group.W, group.H, group.Rotation, group.Opacity, group.FlipX));
        var child = Assert.Single(group.Children);
        Assert.Equal((12d, 22d), (child.X, child.Y));
    }

    [Fact]
    public void A_group_with_something_else_as_children_is_an_empty_group()
    {
        Assert.Empty(Assert.IsType<GroupElement>(OnlyElement("{\"type\":\"group\",\"children\":\"nope\"}")).Children);
        Assert.Empty(Assert.IsType<GroupElement>(OnlyElement("{\"type\":\"group\"}")).Children);
        Assert.Equal(2, Assert.IsType<GroupElement>(OnlyElement("{\"type\":\"group\",\"children\":[5,null,{\"type\":\"text\"},\"x\",{\"type\":\"nope\"},{\"type\":\"shape\"}]}")).Children.Count);
    }

    [Fact]
    public void A_page_takes_500_elements_children_included()
    {
        var result = DocumentValidator.Validate(Pages("{\"elements\":[{\"type\":\"group\",\"children\":[" + Shapes(300, "c") + "]}," + Shapes(300, "s") + "]}"));
        Assert.Equal(500, result.Document!.AllElements.Count());
        Assert.Contains(result.Warnings, w => w.Contains("500 Elemente"));
    }

    [Fact]
    public void A_document_takes_2000_elements_over_all_pages()
    {
        var pages = string.Join(",", Enumerable.Range(0, 6).Select(p => "{\"elements\":[" + Shapes(400, "p" + p + "e") + "]}"));
        var result = DocumentValidator.Validate(Pages(pages));
        Assert.Equal(2000, result.Document!.AllElements.Count());
        Assert.Equal(400, result.Document.Pages[4].Elements.Count);
        Assert.Empty(result.Document.Pages[5].Elements);
        Assert.Contains(result.Warnings, w => w.Contains("2000 Elemente insgesamt"));
    }

    [Fact]
    public void Each_page_has_its_own_budget_of_500()
    {
        var result = DocumentValidator.Validate(Pages("{\"elements\":[" + Shapes(500, "a") + "]},{\"elements\":[" + Shapes(500, "b") + "]}"));
        Assert.Equal([500, 500], result.Document!.Pages.Select(p => p.Elements.Count));
        Assert.Empty(result.Warnings);
    }

    [Fact]
    public void A_huge_page_is_cut_without_harm()
    {
        var result = DocumentValidator.Validate(Pages("{\"elements\":[" + Shapes(20_000) + "]}"));
        Assert.True(result.Ok);
        Assert.Equal(500, result.Document!.Pages[0].Elements.Count);
    }

    [Fact]
    public void A_pile_of_nested_groups_is_refused_by_the_depth_of_the_json_not_by_a_stack_overflow()
    {
        var open = new StringBuilder();
        var close = new StringBuilder();
        for (var i = 0; i < 5000; i++)
        {
            open.Append("{\"type\":\"group\",\"children\":[");
            close.Append("]}");
        }

        var result = DocumentValidator.Validate(Pages("{\"elements\":[" + open + close + "]}"));
        Assert.False(result.Ok);
        Assert.Contains("verschachtelt", result.Error);
    }

    [Fact]
    public void The_limit_is_4_megabytes()
    {
        var text = "{\"schema\":2,\"pages\":[{\"elements\":[{\"type\":\"text\",\"text\":\"" + new string('x', 100) + "\"}]}],\"fields\":[],\"pad\":\"" + new string('p', DocumentValidator.MaxJsonBytes) + "\"}";
        var result = DocumentValidator.Validate(text);
        Assert.False(result.Ok);
        Assert.Contains("4 MB", result.Error);
    }

    // ------------------------------------------------------------------------------------------------ the new properties of every element

    [Fact]
    public void Every_element_has_flips_and_an_optional_shadow()
    {
        var shape = OnlyElement("{\"type\":\"shape\",\"flipX\":true,\"flipY\":1,\"shadow\":{\"color\":\"#ABC\",\"opacity\":3,\"blur\":999,\"x\":5000,\"y\":-5000}}");
        Assert.True(shape.FlipX);
        Assert.False(shape.FlipY);
        Assert.Equal(new ShadowDef("#abc", 1, 50, 1000, -1000), shape.Shadow);
        Assert.Null(OnlyElement("{\"type\":\"shape\",\"shadow\":null}").Shadow);
        Assert.Null(OnlyElement("{\"type\":\"shape\",\"shadow\":\"big\"}").Shadow);
        Assert.Equal(new ShadowDef("#000000", 0.5, 0, 0, 0), OnlyElement("{\"type\":\"shape\",\"shadow\":{}}").Shadow);
    }

    [Fact]
    public void The_blur_of_a_shadow_may_be_larger_in_pixel_documents()
    {
        var doc = Parse("{\"schema\":2,\"unit\":\"px\",\"pages\":[{\"elements\":[{\"type\":\"shape\",\"shadow\":{\"blur\":150}}]}]}");
        Assert.Equal(150, doc.Pages[0].Elements[0].Shadow!.Blur);
        Assert.Equal(200, Parse("{\"schema\":2,\"unit\":\"px\",\"pages\":[{\"elements\":[{\"type\":\"shape\",\"shadow\":{\"blur\":1500}}]}]}").Pages[0].Elements[0].Shadow!.Blur);
    }

    [Fact]
    public void Text_has_underline_strike_list_outline_background_and_curve()
    {
        var text = Assert.IsType<TextElement>(OnlyElement("""
            {"type":"text","underline":true,"strike":true,"list":"number","outline":{"color":"#FFF","width":2},"background":{"color":"#102030","radius":1.5,"padding":2},"curve":-40}
            """));
        Assert.True(text.Underline && text.Strike);
        Assert.Equal("number", text.List);
        Assert.Equal(new LineDef("#fff", 2), text.Outline);
        Assert.Equal(new TextBoxDef("#102030", 1.5, 2), text.Background);
        Assert.Equal(-40, text.Curve);
    }

    [Fact]
    public void Hostile_text_effects_are_clamped_or_replaced()
    {
        var text = Assert.IsType<TextElement>(OnlyElement("""
            {"type":"text","list":"roman","outline":{"width":1e9,"color":"red"},"background":{"color":"x","radius":-1,"padding":1e12},"curve":1e9,"underline":"yes","strike":1}
            """));
        Assert.Equal("none", text.List);
        Assert.Equal(new LineDef("#000000", 100), text.Outline);
        Assert.Equal(new TextBoxDef("#ffffff", 0, 1e6), text.Background);
        Assert.Equal(100, text.Curve);
        Assert.False(text.Underline);
        Assert.False(text.Strike);

        var plain = Assert.IsType<TextElement>(OnlyElement("{\"type\":\"text\",\"outline\":5,\"background\":\"red\"}"));
        Assert.Null(plain.Outline);
        Assert.Null(plain.Background);
    }

    [Fact]
    public void An_image_has_crop_mask_border_and_filters_and_may_be_a_frame()
    {
        var image = Assert.IsType<ImageElement>(OnlyElement("""
            {"type":"image","source":null,"mask":"heart","crop":{"x":0.1,"y":0.2,"w":0.5,"h":0.6},"border":{"color":"#abcdef","width":3},"filters":{"brightness":10,"contrast":-20,"saturation":30,"blur":4,"grayscale":true,"sepia":true}}
            """));
        Assert.Null(image.Source);
        Assert.Equal("heart", image.Mask);
        Assert.Equal(new CropDef(0.1, 0.2, 0.5, 0.6), image.Crop);
        Assert.Equal(new LineDef("#abcdef", 3), image.Border);
        Assert.Equal(new FiltersDef(10, -20, 30, 4, true, true), image.Filters);

        var plain = Assert.IsType<ImageElement>(OnlyElement("{\"type\":\"image\"}"));
        Assert.Equal(CropDef.Whole, plain.Crop);
        Assert.Equal("none", plain.Mask);
        Assert.Null(plain.Border);
        Assert.Equal(FiltersDef.None, plain.Filters);
    }

    [Fact]
    public void A_hostile_image_is_clamped_into_its_ranges()
    {
        var image = Assert.IsType<ImageElement>(OnlyElement("""
            {"type":"image","mask":"blob","crop":{"x":5,"y":-5,"w":0,"h":9},"border":{"color":"x","width":1e9},"filters":{"brightness":1e9,"blur":-5,"grayscale":"true"}}
            """));
        Assert.Equal("none", image.Mask);
        Assert.Equal(0.999, image.Crop.X);
        Assert.Equal(0, image.Crop.Y);
        Assert.InRange(image.Crop.W, 0.001, 0.0011);
        Assert.Equal(1, image.Crop.H);
        Assert.True(image.Crop.X + image.Crop.W <= 1.0000001);
        Assert.Equal(new LineDef("#000000", 100), image.Border);
        Assert.Equal(100, image.Filters.Brightness);
        Assert.Equal(0, image.Filters.Blur);
        Assert.False(image.Filters.Grayscale);

        var odd = Assert.IsType<ImageElement>(OnlyElement("{\"type\":\"image\",\"crop\":\"all\",\"border\":5,\"filters\":5}"));
        Assert.Equal((CropDef.Whole, FiltersDef.None), (odd.Crop, odd.Filters));
        Assert.Null(odd.Border);
    }

    [Fact]
    public void A_strip_has_a_mask_and_a_border()
    {
        var strip = Assert.IsType<ImageStripElement>(OnlyElement("{\"type\":\"imageStrip\",\"mask\":\"circle\",\"border\":{\"width\":2},\"items\":[{\"asset\":\"a\"}]}"));
        Assert.Equal(("circle", new LineDef("#000000", 2)), (strip.Mask, strip.Border));
    }

    [Fact]
    public void Shapes_have_kinds_points_inner_radius_gradients_and_caps()
    {
        var star = Assert.IsType<ShapeElement>(OnlyElement("""
            {"type":"shape","shape":"star","points":8,"innerRadius":0.4,"fill":{"type":"linear","angle":45,"stops":[{"offset":0,"color":"#F00"},{"offset":0.5,"color":"#0f0"},{"offset":1,"color":"#00F"}]},"startCap":"circle","endCap":"arrow"}
            """));
        Assert.Equal(("star", 8, 0.4), (star.Shape, star.Points, star.InnerRadius));
        Assert.Equal(new GradientDef(45, [new GradientStop(0, "#f00"), new GradientStop(0.5, "#0f0"), new GradientStop(1, "#00f")]), star.Fill!.Gradient);
        Assert.Null(star.Fill.Color);
        Assert.Equal(("circle", "arrow"), (star.StartCap, star.EndCap));

        foreach (var kind in new[] { "rect", "ellipse", "line", "triangle", "diamond", "pentagon", "hexagon", "star", "heart", "arrow", "speech" })
        {
            Assert.Equal(kind, Assert.IsType<ShapeElement>(OnlyElement("{\"type\":\"shape\",\"shape\":\"" + kind + "\"}")).Shape);
        }

        Assert.Equal("rect", Assert.IsType<ShapeElement>(OnlyElement("{\"type\":\"shape\",\"shape\":\"circle\"}")).Shape);
    }

    [Fact]
    public void Hostile_shape_values_are_replaced()
    {
        var shape = Assert.IsType<ShapeElement>(OnlyElement("{\"type\":\"shape\",\"shape\":\"star\",\"points\":99,\"innerRadius\":5,\"fill\":{\"stops\":[{\"color\":\"#fff\"}]},\"startCap\":\"x\"}"));
        Assert.Equal((12, 0.9, "none"), (shape.Points, shape.InnerRadius, shape.StartCap));
        Assert.Null(shape.Fill);
        Assert.Equal(FillDef.Of("#fff"), Assert.IsType<ShapeElement>(OnlyElement("{\"type\":\"shape\",\"fill\":\" #FFF \"}")).Fill);
        Assert.Null(Assert.IsType<ShapeElement>(OnlyElement("{\"type\":\"shape\",\"fill\":\"red\"}")).Fill);
        Assert.Null(Assert.IsType<ShapeElement>(OnlyElement("{\"type\":\"shape\",\"fill\":5}")).Fill);
    }

    // ------------------------------------------------------------------------------------------------ gradients

    [Fact]
    public void A_gradient_has_two_to_five_stops_and_a_bounded_angle()
    {
        string Gradient(string stops, string angle = "10") => "{\"type\":\"shape\",\"fill\":{\"angle\":" + angle + ",\"stops\":[" + stops + "]}}";
        string Stop(int i) => "{\"offset\":" + (i / 10.0).ToString(System.Globalization.CultureInfo.InvariantCulture) + ",\"color\":\"#00000" + i + "\"}";

        var six = Assert.IsType<ShapeElement>(OnlyElement(Gradient(string.Join(",", Enumerable.Range(0, 6).Select(Stop))))).Fill!.Gradient!;
        Assert.Equal(5, six.Stops.Count);
        Assert.Null(Assert.IsType<ShapeElement>(OnlyElement(Gradient(Stop(1)))).Fill);
        Assert.Null(Assert.IsType<ShapeElement>(OnlyElement(Gradient("{\"color\":\"nope\"},{\"color\":\"#fff\"},5,null"))).Fill);
        Assert.Equal(360, Assert.IsType<ShapeElement>(OnlyElement(Gradient(Stop(1) + "," + Stop(2), "9999"))).Fill!.Gradient!.Angle);
        Assert.Equal(2, Assert.IsType<ShapeElement>(OnlyElement(Gradient("{\"color\":\"#000\",\"offset\":-5}," + "{\"color\":\"#fff\",\"offset\":5}"))).Fill!.Gradient!.Stops.Count);
        var clamped = Assert.IsType<ShapeElement>(OnlyElement(Gradient("{\"color\":\"#000\",\"offset\":-5},{\"color\":\"#fff\",\"offset\":5}"))).Fill!.Gradient!;
        Assert.Equal([0d, 1d], clamped.Stops.Select(s => s.Offset));
    }

    [Fact]
    public void A_background_may_have_a_colour_a_gradient_and_a_picture()
    {
        var bg = Parse(Pages("{\"background\":{\"color\":\"#FfF\",\"gradient\":{\"stops\":[{\"color\":\"#000\"},{\"color\":\"#fff\",\"offset\":1}]},\"asset\":\" back \",\"fit\":\"fill\"}}")).Pages[0].Background;
        Assert.Equal(("#fff", "back", "fill"), (bg.Color, bg.Asset, bg.Fit));
        Assert.Equal(2, bg.Gradient!.Stops.Count);

        var odd = Parse(Pages("{\"background\":{\"color\":\"blue\",\"gradient\":\"x\",\"fit\":\"zoom\"}}")).Pages[0].Background;
        Assert.Equal(new BackgroundDef("#ffffff", null, null, "cover"), odd);
    }

    // ------------------------------------------------------------------------------------------------ icons, codes

    [Theory]
    [InlineData("heart", "heart")]
    [InlineData("shopping-cart", "shopping-cart")]
    [InlineData("a1", "a1")]
    [InlineData("Heart", "")]
    [InlineData(" heart", "")]
    [InlineData("heart\n", "")]
    [InlineData("../../etc/passwd", "")]
    [InlineData("a_b", "")]
    [InlineData("<svg onload=alert(1)>", "")]
    [InlineData("javascript:alert(1)", "")]
    [InlineData("herzä", "")]
    [InlineData("", "")]
    public void Icon_names_are_lucide_names_or_nothing(string name, string expected)
        => Assert.Equal(expected, Assert.IsType<IconElement>(OnlyElement("{\"type\":\"icon\",\"icon\":" + JsonSerializer.Serialize(name) + "}")).Icon);

    [Fact]
    public void An_icon_name_of_65_characters_is_no_icon()
    {
        Assert.Equal(new string('a', 64), Assert.IsType<IconElement>(OnlyElement("{\"type\":\"icon\",\"icon\":\"" + new string('a', 64) + "\"}")).Icon);
        Assert.Equal("", Assert.IsType<IconElement>(OnlyElement("{\"type\":\"icon\",\"icon\":\"" + new string('a', 65) + "\"}")).Icon);
        Assert.Equal("", Assert.IsType<IconElement>(OnlyElement("{\"type\":\"icon\",\"icon\":5}")).Icon);
    }

    [Fact]
    public void An_icon_has_colour_and_stroke_width_in_range()
    {
        var icon = Assert.IsType<IconElement>(OnlyElement("{\"type\":\"icon\",\"icon\":\"star\",\"color\":\"#E11D48\",\"strokeWidth\":99}"));
        Assert.Equal(("#e11d48", 4d), (icon.Color, icon.StrokeWidth));
        Assert.Equal(0.5, Assert.IsType<IconElement>(OnlyElement("{\"type\":\"icon\",\"strokeWidth\":0}")).StrokeWidth);
        Assert.Equal(2, Assert.IsType<IconElement>(OnlyElement("{\"type\":\"icon\"}")).StrokeWidth);
    }

    [Fact]
    public void A_qr_code_keeps_its_value_and_defaults()
    {
        var qr = Assert.IsType<QrElement>(OnlyElement("{\"type\":\"qr\",\"value\":\"https://example.org/{{Id}}\",\"color\":\"#102030\",\"background\":null,\"ecc\":\"H\",\"quiet\":false}"));
        Assert.Equal(("https://example.org/{{Id}}", "#102030", null, "H", false), (qr.Value, qr.Color, qr.Background, qr.Ecc, qr.Quiet));
        var plain = Assert.IsType<QrElement>(OnlyElement("{\"type\":\"qr\"}"));
        Assert.Equal(("", "#000000", "#ffffff", "M", true), (plain.Value, plain.Color, plain.Background, plain.Ecc, plain.Quiet));
    }

    [Fact]
    public void Hostile_codes_are_cut_and_replaced()
    {
        var qr = Assert.IsType<QrElement>(OnlyElement("{\"type\":\"qr\",\"value\":\"" + new string('x', 2000) + "\",\"ecc\":\"X\",\"background\":\"javascript:1\",\"quiet\":\"yes\"}"));
        Assert.Equal(1000, qr.Value.Length);
        Assert.Equal(("M", "#ffffff", true), (qr.Ecc, qr.Background, qr.Quiet));

        var barcode = Assert.IsType<BarcodeElement>(OnlyElement("{\"type\":\"barcode\",\"format\":\"upc\",\"value\":\"" + new string('1', 200) + "\",\"showText\":0,\"fontFamily\":\"\"}"));
        Assert.Equal(("ean13", 80, true, "sans-serif"), (barcode.Format, barcode.Value.Length, barcode.ShowText, barcode.FontFamily));
    }

    [Fact]
    public void A_barcode_keeps_its_format_and_options()
    {
        var barcode = Assert.IsType<BarcodeElement>(OnlyElement("{\"type\":\"barcode\",\"format\":\"code128\",\"value\":\"{{Ean}}\",\"color\":\"#111\",\"background\":null,\"showText\":false,\"fontFamily\":\"Roboto\"}"));
        Assert.Equal(("code128", "{{Ean}}", "#111", null, false, "Roboto"), (barcode.Format, barcode.Value, barcode.Color, barcode.Background, barcode.ShowText, barcode.FontFamily));
        foreach (var format in new[] { "ean13", "ean8", "code128" })
        {
            Assert.Equal(format, Assert.IsType<BarcodeElement>(OnlyElement("{\"type\":\"barcode\",\"format\":\"" + format + "\"}")).Format);
        }
    }

    // ------------------------------------------------------------------------------------------------ the stored form

    [Fact]
    public void The_stored_json_is_stable_when_read_again_and_carries_every_new_property()
    {
        var first = DocumentValidator.Validate(EngineAgreementData.PagesInput);
        Assert.True(first.Ok);
        var second = DocumentValidator.Validate(first.Json);
        Assert.Equal(first.Json, second.Json);
        Assert.Empty(second.Warnings);
        foreach (var name in new[] { "underline", "strike", "list", "outline", "curve", "flipX", "flipY", "shadow", "crop", "mask", "filters", "points", "innerRadius", "startCap", "endCap", "ecc", "quiet", "showText", "children", "gradient" })
        {
            Assert.Contains("\"" + name + "\"", first.Json);
        }
    }

    [Fact]
    public void Hostile_documents_never_leave_markup_or_unknown_properties_in_the_stored_json()
    {
        var result = DocumentValidator.Validate(EngineAgreementData.HostileTwoInput);
        Assert.True(result.Ok);
        Assert.DoesNotContain("extra", result.Json);
        Assert.DoesNotContain("passwd", result.Json);
        Assert.DoesNotContain("javascript", result.Json);
        var again = DocumentValidator.Validate(result.Json);
        Assert.Equal(result.Json, again.Json);
        foreach (var element in result.Document!.AllElements.OfType<IconElement>())
        {
            Assert.Matches("^[a-z0-9-]{0,64}$", element.Icon);
        }
    }

    [Fact]
    public void A_document_made_in_code_is_normalised_through_its_json()
    {
        var doc = DocumentValidator.Create(85, 55) with
        {
            Pages = [DocumentValidator.EmptyPage("a"), DocumentValidator.EmptyPage("a") with { Elements = [new IconElement { Id = "i", Icon = "BAD NAME", StrokeWidth = 50 }] }],
        };
        var normalised = DocumentValidator.Normalize(doc);
        Assert.Equal(2, normalised.Pages.Count);
        Assert.NotEqual(normalised.Pages[0].Id, normalised.Pages[1].Id);
        var icon = Assert.IsType<IconElement>(normalised.Pages[1].Elements[0]);
        Assert.Equal(("", 4d), (icon.Icon, icon.StrokeWidth));
    }
}

public sealed class SchemaTwoPlaceholderTests
{
    private static DesignDocument Document(string json) => DocumentValidator.Parse(json)!;

    private const string TwoPages = """
        {"schema":2,"fields":[{"key":"Name","type":"text"},{"key":"Url","type":"text"},{"key":"Ean","type":"text"},{"key":"Bild","type":"image","sample":"sample-pic"}],
         "pages":[
          {"id":"a","background":{"asset":"bg-front"},"elements":[
            {"id":"t","type":"text","text":"{{Name}}","fontFamily":"Montserrat","showIf":"Name"},
            {"id":"g","type":"group","children":[
              {"id":"gt","type":"text","text":"{{Extra}}","fontFamily":"Roboto Slab"},
              {"id":"gi","type":"image","source":{"asset":"logo"}},
              {"id":"g2","type":"group","children":[{"id":"deep","type":"imageStrip","items":[{"asset":"Seal"},{"field":"Bild"}]}]}]}]},
          {"id":"b","background":{"asset":"BG-FRONT"},"elements":[
            {"id":"q","type":"qr","value":"https://x.org/{{Url}}"},
            {"id":"b1","type":"barcode","value":"{{Ean}}","fontFamily":"Anton"},
            {"id":"i","type":"image","source":{"field":"Bild"}},
            {"id":"i2","type":"image","source":{"asset":"back-photo"}}]}
         ]}
        """;

    [Fact]
    public void Fields_are_found_on_every_page_in_groups_and_in_codes()
    {
        var usage = Placeholders.FieldsUsed(Document(TwoPages));
        Assert.Equal(["Name", "Extra", "Bild", "Url", "Ean"], usage.Select(u => u.Key));
        Assert.Equal(["showIf", "text"], usage.Single(u => u.Key == "Name").Uses.Select(u => u.Kind));
        Assert.False(usage.Single(u => u.Key == "Extra").Defined);
        Assert.Equal(["strip", "image"], usage.Single(u => u.Key == "Bild").Uses.Select(u => u.Kind));
        Assert.Equal(["q"], usage.Single(u => u.Key == "Url").Uses.Select(u => u.ElementId));
        Assert.Equal("qr", usage.Single(u => u.Key == "Url").Uses[0].Kind);
        Assert.Equal("barcode", usage.Single(u => u.Key == "Ean").Uses[0].Kind);
    }

    [Fact]
    public void Asset_keys_come_from_all_pages_backgrounds_groups_strips_and_samples()
    {
        var keys = Placeholders.AssetKeys(Document(TwoPages));
        Assert.Equal(["bg-front", "logo", "Seal", "back-photo", "sample-pic"], keys);
    }

    [Fact]
    public void Fonts_come_from_texts_in_groups_and_from_barcodes_on_all_pages()
    {
        Assert.Equal(["Montserrat", "Roboto Slab", "Anton"], Placeholders.FontFamilies(Document(TwoPages)));
    }

    [Fact]
    public void Asset_keys_are_rewritten_on_every_page_and_in_every_group()
    {
        var map = new Dictionary<string, string> { ["logo"] = "logo-2", ["seal"] = "seal-2", ["bg-front"] = "bg-2", ["back-photo"] = "photo-2" };
        var rewritten = DesignPackageFormat.RewriteAssetKeys(Document(TwoPages), map);
        Assert.Equal(["bg-2", "logo-2", "seal-2", "photo-2", "sample-pic"], Placeholders.AssetKeys(rewritten));
        Assert.Equal("bg-2", rewritten.Pages[1].Background.Asset);
    }

    [Fact]
    public void All_elements_lists_parents_before_their_children_across_pages()
    {
        Assert.Equal(["t", "g", "gt", "gi", "g2", "deep", "q", "b1", "i", "i2"], Document(TwoPages).AllElements.Select(e => e.Id));
    }
}

public sealed class SchemaTwoPackageTests
{
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3];

    private static string TwoPageDocument() => DocumentValidator.Validate(EngineAgreementData.PagesInput).Json!;

    [Fact]
    public void A_package_with_pages_survives_writing_and_reading()
    {
        var package = new DesignPackage("Visitenkarte", "Karten", null, TwoPageDocument(), [new PackageAsset("bg", "Hintergrund", "Hintergründe", "image/png", Png)], []);
        var read = DesignPackageFormat.Read(DesignPackageFormat.Write(package));
        Assert.True(read.Ok, read.Error);
        Assert.Equal(TwoPageDocument(), read.Package!.DocumentJson);
        Assert.Equal(2, DocumentValidator.Parse(read.Package.DocumentJson)!.Pages.Count);
        using var file = JsonDocument.Parse(DesignPackageFormat.Write(package));
        Assert.Equal(2, file.RootElement.GetProperty("version").GetInt32());
        Assert.Equal(2, file.RootElement.GetProperty("document").GetProperty("pages").GetArrayLength());
    }

    [Fact]
    public void An_old_package_of_version_1_with_a_schema_1_document_is_read_and_upgraded()
    {
        var old = """
            {"format":"designthix-design","version":1,"name":"Alt","category":null,"description":null,
             "document":{"schema":1,"unit":"mm","width":150,"height":100,"background":{"color":"#ffffff","asset":"paper","fit":"cover"},"fields":[],
               "elements":[{"id":"a","type":"text","text":"Hallo"},{"id":"b","type":"image","source":{"asset":"logo"}}]},
             "assets":[{"key":"logo","name":"Logo","category":"Logos","contentType":"image/png","base64":"AQID"}],"fonts":[]}
            """;
        var read = DesignPackageFormat.Read(Encoding.UTF8.GetBytes(old));
        Assert.True(read.Ok, read.Error);
        var doc = DocumentValidator.Parse(read.Package!.DocumentJson)!;
        Assert.Equal(2, doc.Schema);
        var page = Assert.Single(doc.Pages);
        Assert.Equal(["a", "b"], page.Elements.Select(e => e.Id));
        Assert.Equal("paper", page.Background.Asset);
        Assert.Equal(["paper", "logo"], Placeholders.AssetKeys(doc));
    }

    [Fact]
    public void A_package_that_is_newer_than_this_version_is_refused()
    {
        var text = """{"format":"designthix-design","version":3,"name":"x","document":{}}""";
        Assert.Contains("Version 3", DesignPackageFormat.Read(Encoding.UTF8.GetBytes(text)).Error);
    }

    [Fact]
    public void A_package_with_a_document_of_a_newer_schema_is_refused()
    {
        var text = """{"format":"designthix-design","version":2,"name":"x","document":{"schema":3,"pages":[]}}""";
        var read = DesignPackageFormat.Read(Encoding.UTF8.GetBytes(text));
        Assert.False(read.Ok);
        Assert.Contains("neueren Version", read.Error);
    }
}

public sealed class SchemaTwoOutputPlanTests
{
    [Fact]
    public void Every_label_makes_all_pages_in_order()
    {
        Assert.Equal(6, OutputPlan.Units(3, 2));
        Assert.Equal(3, OutputPlan.Units(3, 1));
        Assert.Equal(3, OutputPlan.Units(3, 0));
        Assert.Equal(0, OutputPlan.Units(0, 5));
        Assert.Equal(150, OutputPlan.Units(3, 50));
        Assert.Equal(150, OutputPlan.Units(3, 500));
        Assert.Equal([0, 1, 2, 3, 4, 5], new[] { (0, 0), (0, 1), (0, 2), (1, 0), (1, 1), (1, 2) }.Select(p => OutputPlan.UnitIndex(p.Item1, p.Item2, 3)));
    }

    [Fact]
    public void In_the_single_mode_each_page_is_a_sheet_of_paper_and_in_the_sheet_mode_a_cell()
    {
        // 5 labels of a design with 2 pages on a sheet of 2 x 4 cells, starting at the third cell: 10 pieces + 2 skipped = 12 cells = 2 sheets
        var units = OutputPlan.Units(5, 2);
        Assert.Equal(2, OutputPlan.Sheets(units, 3, 8));
        // piece 0 (label 1, page 1) is in cell 3 of the first sheet: column 0, row 1
        Assert.Equal((0, 0, 1), OutputPlan.CellOf(OutputPlan.UnitIndex(0, 0, 2), 3, 2, 4));
        // piece 1 (label 1, page 2) follows in the next cell
        Assert.Equal((0, 1, 1), OutputPlan.CellOf(OutputPlan.UnitIndex(0, 1, 2), 3, 2, 4));
        // the last piece (label 5, page 2) is piece 9: cell 12, the fourth of the second sheet
        Assert.Equal((1, 1, 1), OutputPlan.CellOf(OutputPlan.UnitIndex(4, 1, 2), 3, 2, 4));
        // single mode: one piece per sheet of paper, no start position
        Assert.Equal(10, OutputPlan.Sheets(units, 1, 1));
    }

    [Fact]
    public void The_most_pieces_one_output_draws_is_limited()
    {
        Assert.Equal(4000, OutputPlan.MaxUnits);
        Assert.True(OutputPlan.Units(OutputPlan.MaxLabels, 2) <= OutputPlan.MaxUnits);
        Assert.True(OutputPlan.Units(OutputPlan.MaxLabels, 3) > OutputPlan.MaxUnits);
    }
}

public sealed class DocumentResizeTests
{
    private static DesignDocument Card() => DocumentValidator.Parse("""
        {"schema":2,"unit":"mm","width":100,"height":50,"fields":[],
         "pages":[
          {"id":"a","elements":[
            {"id":"t","type":"text","x":10,"y":5,"w":40,"h":10,"fontSize":12,"minFontSize":6,"outline":{"color":"#000","width":1},"background":{"color":"#fff","radius":2,"padding":1},"shadow":{"color":"#000","opacity":0.5,"blur":2,"x":1,"y":1}},
            {"id":"i","type":"image","x":0,"y":0,"w":20,"h":20,"radius":2,"border":{"color":"#000","width":2}},
            {"id":"s","type":"shape","shape":"rect","x":50,"y":25,"w":10,"h":5,"strokeWidth":0.5,"radius":1},
            {"id":"g","type":"group","x":10,"y":10,"w":20,"h":10,"rotation":30,"children":[{"id":"gc","type":"shape","x":10,"y":10,"w":20,"h":10}]},
            {"id":"st","type":"imageStrip","x":1,"y":1,"w":30,"h":8,"gap":2},
            {"id":"ic","type":"icon","icon":"star","x":80,"y":10,"w":8,"h":8,"strokeWidth":2}]},
          {"id":"b","elements":[{"id":"t2","type":"text","x":4,"y":4,"w":10,"h":5,"fontSize":20}]}]}
        """)!;

    private static DesignElement Find(DesignDocument doc, string id) => doc.AllElements.Single(e => e.Id == id);

    [Fact]
    public void Scaling_enlarges_everything_by_the_factor_that_fits_and_centres()
    {
        // 100 x 50 mm -> 200 x 200 mm: the factor is min(2, 4) = 2, the content is 200 x 100 and sits in the middle (offset y = 50)
        var resized = DocumentResize.Resize(Card(), 200, 200, "mm", true);
        Assert.Equal((200d, 200d, "mm"), (resized.Width, resized.Height, resized.Unit));
        var t = Assert.IsType<TextElement>(Find(resized, "t"));
        Assert.Equal((20d, 60d, 80d, 20d), (t.X, t.Y, t.W, t.H));
        Assert.Equal((24d, 12d), (t.FontSize, t.MinFontSize));
        Assert.Equal(new LineDef("#000", 2), t.Outline);
        Assert.Equal(new TextBoxDef("#fff", 4, 2), t.Background);
        Assert.Equal(new ShadowDef("#000", 0.5, 4, 2, 2), t.Shadow);
        var image = Assert.IsType<ImageElement>(Find(resized, "i"));
        Assert.Equal((0d, 50d, 40d, 40d, 4d), (image.X, image.Y, image.W, image.H, image.Radius));
        Assert.Equal(new LineDef("#000", 4), image.Border);
        var shape = Assert.IsType<ShapeElement>(Find(resized, "s"));
        Assert.Equal((100d, 100d, 20d, 10d, 1d, 2d), (shape.X, shape.Y, shape.W, shape.H, shape.StrokeWidth, shape.Radius));
        Assert.Equal(4, Assert.IsType<ImageStripElement>(Find(resized, "st")).Gap);
        Assert.Equal(2, Assert.IsType<IconElement>(Find(resized, "ic")).StrokeWidth);
        Assert.Equal(40, Find(resized, "t2").FontSize());
    }

    [Fact]
    public void Groups_and_their_children_move_together()
    {
        var resized = DocumentResize.Resize(Card(), 200, 200, "mm", true);
        var group = Assert.IsType<GroupElement>(Find(resized, "g"));
        Assert.Equal((20d, 70d, 40d, 20d, 30d), (group.X, group.Y, group.W, group.H, group.Rotation));
        var child = Assert.Single(group.Children);
        Assert.Equal((20d, 70d, 40d, 20d), (child.X, child.Y, child.W, child.H));
    }

    [Fact]
    public void Shrinking_is_the_same_arithmetic()
    {
        var resized = DocumentResize.Resize(Card(), 50, 50, "mm", true);
        // factor min(0.5, 1) = 0.5, content 50 x 25, offset y = 12.5
        var t = Assert.IsType<TextElement>(Find(resized, "t"));
        Assert.Equal((5d, 15d, 20d, 5d, 6d), (t.X, t.Y, t.W, t.H, t.FontSize));
    }

    [Fact]
    public void Without_scaling_the_content_keeps_its_place_and_size()
    {
        var resized = DocumentResize.Resize(Card(), 200, 200, "mm", false);
        var t = Assert.IsType<TextElement>(Find(resized, "t"));
        Assert.Equal((10d, 5d, 40d, 10d, 12d), (t.X, t.Y, t.W, t.H, t.FontSize));
        Assert.Equal((200d, 200d), (resized.Width, resized.Height));
        Assert.Equal(Card().Pages.Count, resized.Pages.Count);
    }

    [Fact]
    public void Another_unit_converts_lengths_but_fonts_stay_the_same_size_in_points()
    {
        var withoutScale = DocumentResize.Resize(Card(), 400, 200, "px", false);
        Assert.Equal("px", withoutScale.Unit);
        var t = Assert.IsType<TextElement>(Find(withoutScale, "t"));
        Assert.Equal(10 * 96 / 25.4, t.X, 3);
        Assert.Equal(40 * 96 / 25.4, t.W, 3);
        Assert.Equal(12, t.FontSize);

        // scaled: 100 x 50 mm is 377.95 x 188.98 px; into 800 x 400 px that is a factor of 2.1167 (points follow the factor, not the unit)
        var scaled = DocumentResize.Resize(Card(), 800, 400, "px", true);
        var factor = 800 / (100 * 96 / 25.4);
        Assert.Equal(12 * factor, Assert.IsType<TextElement>(Find(scaled, "t")).FontSize, 3);
        Assert.Equal(10 * 96 / 25.4 * factor, Find(scaled, "t").X, 3);
    }

    [Fact]
    public void The_result_survives_the_validator_unchanged()
    {
        var resized = DocumentResize.Resize(Card(), 200, 200, "mm", true);
        var json = DocumentValidator.ToJson(resized);
        var result = DocumentValidator.Validate(json);
        Assert.Equal(json, result.Json);
        Assert.Empty(result.Warnings);
    }

    [Fact]
    public void Resizing_to_the_same_size_with_scaling_changes_nothing()
    {
        var card = Card();
        Assert.Equal(DocumentValidator.ToJson(card), DocumentValidator.ToJson(DocumentResize.Resize(card, 100, 50, "mm", true)));
    }
}

internal static class ResizeTestExtensions
{
    public static double FontSize(this DesignElement element) => ((TextElement)element).FontSize;
}

public sealed class FormatTileTests
{
    [Fact]
    public void The_tiles_of_the_start_page_are_the_ones_of_the_plan_in_order()
    {
        Assert.Equal(["Preisschild", "Etikett", "Regaletikett", "Visitenkarte", "Flyer A5", "Poster A3", "Karte A6", "Instagram-Beitrag", "Instagram-Story", "Präsentation"], FormatPresets.Tiles.Select(p => p.ShortName));
        var sizes = FormatPresets.Tiles.ToDictionary(p => p.ShortName, p => (p.Width, p.Height, p.Unit));
        Assert.Equal((150d, 100d, "mm"), sizes["Preisschild"]);
        Assert.Equal((100d, 70d, "mm"), sizes["Etikett"]);
        Assert.Equal((100d, 30d, "mm"), sizes["Regaletikett"]);
        Assert.Equal((85d, 55d, "mm"), sizes["Visitenkarte"]);
        Assert.Equal((148d, 210d, "mm"), sizes["Flyer A5"]);
        Assert.Equal((297d, 420d, "mm"), sizes["Poster A3"]);
        Assert.Equal((148d, 105d, "mm"), sizes["Karte A6"]);
        Assert.Equal((1080d, 1080d, "px"), sizes["Instagram-Beitrag"]);
        Assert.Equal((1080d, 1920d, "px"), sizes["Instagram-Story"]);
        Assert.Equal((1920d, 1080d, "px"), sizes["Präsentation"]);
    }

    [Fact]
    public void Every_preset_names_an_icon_that_exists()
    {
        // MatUi sprite names (wwwroot/ui/matui-icons.svg) and the app's own (img/dt-icons.svg, prefix dt:)
        var mat = ReadSymbols("ui", "matui-icons.svg", "mat-i-");
        var own = ReadSymbols("img", "dt-icons.svg", "dt-i-");
        Assert.All(FormatPresets.All, p =>
        {
            Assert.False(string.IsNullOrWhiteSpace(p.Icon));
            var known = p.Icon.StartsWith("dt:", StringComparison.Ordinal) ? own.Contains(p.Icon[3..]) : mat.Contains(p.Icon);
            Assert.True(known, $"{p.Key}: the icon {p.Icon} is not in the sprite");
        });
    }

    private static HashSet<string> ReadSymbols(string folder, string file, string prefix)
    {
        var text = File.ReadAllText(Path.Combine(RepoFiles.WwwRoot(), folder, file));
        return [.. System.Text.RegularExpressions.Regex.Matches(text, "id=\"" + prefix + "([a-z0-9-]+)\"").Select(m => m.Groups[1].Value)];
    }
}
