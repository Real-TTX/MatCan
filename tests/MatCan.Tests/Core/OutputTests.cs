using System.Text;
using System.Text.Json;
using MatCan.Core.Documents;
using MatCan.Core.Output;

namespace MatCan.Tests.Core;

public sealed class OutputPlanTests
{
    private static readonly PlanRow[] Rows = [new(1, 1, true), new(2, 3, true), new(3, 2, false), new(4, 1, true)];

    [Fact]
    public void Every_chosen_row_gives_its_copies_times_the_copies_of_the_job()
    {
        Assert.Equal(5, OutputPlan.LabelCount(Rows, OutputPlan.SelectActive, null, 1));
        Assert.Equal(7, OutputPlan.LabelCount(Rows, OutputPlan.SelectAll, null, 1));
        Assert.Equal(14, OutputPlan.LabelCount(Rows, OutputPlan.SelectAll, null, 2));
        Assert.Equal(10, OutputPlan.LabelCount(Rows, OutputPlan.SelectSelected, new HashSet<long> { 2, 3 }, 2));
        Assert.Equal(0, OutputPlan.LabelCount(Rows, OutputPlan.SelectSelected, null, 5));
    }

    [Fact]
    public void The_selection_keeps_the_order_of_the_list()
    {
        var chosen = OutputPlan.Select(Rows, OutputPlan.SelectSelected, new HashSet<long> { 4, 1 });
        Assert.Equal([1L, 4L], chosen.Select(r => r.Id));
    }

    [Fact]
    public void Silly_copies_are_clamped_and_never_overflow()
    {
        var many = Enumerable.Range(1, 5000).Select(i => new PlanRow(i, int.MaxValue, true)).ToList();
        Assert.Equal(5000L * OutputPlan.MaxCopies * OutputPlan.MaxCopies, OutputPlan.LabelCount(many, OutputPlan.SelectAll, null, int.MaxValue));
        Assert.Equal(3, OutputPlan.LabelCount([new PlanRow(1, -4, true)], OutputPlan.SelectAll, null, 3));
    }

    [Theory]
    [InlineData(0, 1, 4, 0)]
    [InlineData(4, 1, 4, 1)]
    [InlineData(5, 1, 4, 2)]
    [InlineData(4, 2, 4, 2)]
    [InlineData(3, 2, 4, 1)]
    [InlineData(1, 4, 4, 1)]
    [InlineData(2, 4, 4, 2)]
    [InlineData(9, 99, 4, 3)]
    public void The_sheets_a_start_position_needs(long labels, int start, int perSheet, int expected)
        => Assert.Equal(expected, OutputPlan.Sheets(labels, start, perSheet));

    [Fact]
    public void A_start_position_skips_the_first_cells_of_the_first_sheet()
    {
        // 2 columns, 2 rows, start at cell 2: the labels fill cell 2, 3, 4 of sheet 1, then cell 1 of sheet 2.
        Assert.Equal((0, 1, 0), OutputPlan.CellOf(0, 2, 2, 2));
        Assert.Equal((0, 0, 1), OutputPlan.CellOf(1, 2, 2, 2));
        Assert.Equal((0, 1, 1), OutputPlan.CellOf(2, 2, 2, 2));
        Assert.Equal((1, 0, 0), OutputPlan.CellOf(3, 2, 2, 2));
        Assert.Equal((0, 0, 0), OutputPlan.CellOf(0, 1, 2, 2));
    }

    [Theory]
    [InlineData(150, 100, 148.5, 105, 0.99)]
    [InlineData(150, 100, 300, 200, 1)]
    [InlineData(200, 100, 100, 100, 0.5)]
    [InlineData(0, 0, 100, 100, 1)]
    public void A_design_is_shrunk_to_fit_a_cell_but_never_enlarged(double dw, double dh, double cw, double ch, double expected)
        => Assert.Equal(expected, OutputPlan.FitScale(dw, dh, cw, ch), 3);
}

public sealed class DesignPackageTests
{
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3];

    private static string DocumentJson()
        => DocumentValidator.ToJson(DocumentValidator.Parse("""
            {"unit":"mm","width":150,"height":100,
             "background":{"color":"#ffffff","asset":"Back-Ground","fit":"cover"},
             "fields":[{"key":"Land","label":"Land","type":"image","sample":"FLAG-DE"},{"key":"Name","label":"Name","type":"text","sample":"Gouda"}],
             "elements":[
               {"id":"a","type":"text","text":"{{Name}}","fontFamily":"Montserrat","fontSize":20},
               {"id":"b","type":"text","text":"x","fontFamily":"My Font"},
               {"id":"c","type":"text","text":"y","fontFamily":"montserrat"},
               {"id":"d","type":"image","source":{"asset":"logo"}},
               {"id":"e","type":"image","source":{"field":"Land"}},
               {"id":"f","type":"imageStrip","items":[{"asset":"Flag-De"},{"field":"Land"},null,{"asset":"seal"}]}
             ]}
            """)!);

    private static DesignPackage Package(IReadOnlyList<PackageAsset>? assets = null, IReadOnlyList<PackageFont>? fonts = null)
        => new("Käse – Preisschild", "Käsetheke", "Beschreibung mit „Umlauten“", DocumentJson(), assets ?? [new PackageAsset("logo", "Logo", "Logos", "image/png", Png)], fonts ?? []);

    [Fact]
    public void A_package_survives_writing_and_reading()
    {
        var bytes = DesignPackageFormat.Write(Package(fonts: [new PackageFont("My Font", "400", "italic", "ttf", [1, 2, 3, 4])]));
        var result = DesignPackageFormat.Read(bytes);
        Assert.True(result.Ok, result.Error);
        var package = result.Package!;
        Assert.Equal("Käse – Preisschild", package.Name);
        Assert.Equal("Käsetheke", package.Category);
        Assert.Equal("Beschreibung mit „Umlauten“", package.Description);
        Assert.Equal(Png, package.Assets.Single().Bytes);
        Assert.Equal("logo", package.Assets.Single().Key);
        Assert.Equal(("My Font", "400", "italic", "ttf"), (package.Fonts[0].Family, package.Fonts[0].Weight, package.Fonts[0].Style, package.Fonts[0].Format));
        Assert.Equal(new byte[] { 1, 2, 3, 4 }, package.Fonts[0].Bytes);
        Assert.Equal(DocumentJson(), package.DocumentJson);
    }

    [Fact]
    public void The_file_has_the_documented_frame()
    {
        using var json = JsonDocument.Parse(DesignPackageFormat.Write(Package()));
        var root = json.RootElement;
        Assert.Equal("matcan-design", root.GetProperty("format").GetString());
        Assert.Equal(2, root.GetProperty("version").GetInt32());
        Assert.Equal(JsonValueKind.Object, root.GetProperty("document").ValueKind);
        var asset = root.GetProperty("assets")[0];
        Assert.Equal(["base64", "category", "contentType", "key", "name"], asset.EnumerateObject().Select(p => p.Name).Order());
        Assert.Equal(Convert.ToBase64String(Png), asset.GetProperty("base64").GetString());
        Assert.Equal(JsonValueKind.Array, root.GetProperty("fonts").ValueKind);
    }

    private static string Frame(string rest = "", string format = "matcan-design", string version = "1")
        => $$"""{"format":"{{format}}","version":{{version}},"name":"x","document":{"width":10,"height":10}{{rest}}}""";

    [Theory]
    [InlineData("")]
    [InlineData("not json")]
    [InlineData("[1]")]
    [InlineData("{}")]
    [InlineData("{\"format\":\"other\",\"version\":1,\"document\":{}}")]
    [InlineData("{\"format\":\"matcan-design\",\"document\":{}}")]
    [InlineData("{\"format\":\"matcan-design\",\"version\":1}")]
    [InlineData("{\"format\":\"matcan-design\",\"version\":1,\"document\":[]}")]
    public void Anything_that_is_not_a_design_file_is_refused_with_a_message(string text)
    {
        var result = DesignPackageFormat.Read(Encoding.UTF8.GetBytes(text));
        Assert.False(result.Ok);
        Assert.False(string.IsNullOrWhiteSpace(result.Error));
        Assert.Null(result.Package);
    }

    [Fact]
    public void A_newer_version_is_refused_and_a_byte_order_mark_is_fine()
    {
        Assert.Contains("Version 3", DesignPackageFormat.Read(Encoding.UTF8.GetBytes(Frame(version: "3"))).Error);
        Assert.True(DesignPackageFormat.Read(Encoding.UTF8.GetBytes(Frame(version: "2"))).Ok);
        var withBom = new byte[] { 0xEF, 0xBB, 0xBF }.Concat(Encoding.UTF8.GetBytes(Frame())).ToArray();
        Assert.True(DesignPackageFormat.Read(withBom).Ok);
    }

    [Fact]
    public void A_file_exported_under_the_old_name_DesignThix_is_still_read()
    {
        Assert.True(DesignPackageFormat.Read(Encoding.UTF8.GetBytes(Frame(format: "designthix-design"))).Ok);
        Assert.True(DesignPackageFormat.Read(Encoding.UTF8.GetBytes(Frame(format: "designthix-design", version: "2"))).Ok);
    }

    [Fact]
    public void The_document_is_normalised_by_the_validator()
    {
        var result = DesignPackageFormat.Read(Encoding.UTF8.GetBytes(Frame().Replace("\"width\":10", "\"width\":999999999,\"evil\":{\"x\":1}")));
        Assert.True(result.Ok);
        Assert.DoesNotContain("evil", result.Package!.DocumentJson);
        Assert.Equal(100000, DocumentValidator.Parse(result.Package.DocumentJson)!.Width);
    }

    [Theory]
    [InlineData("""{"key":"Bad Key","base64":"AQID"}""")]
    [InlineData("""{"key":"","base64":"AQID"}""")]
    [InlineData("""{"base64":"AQID"}""")]
    [InlineData("""{"key":"ok","base64":"!!!not base64!!!"}""")]
    [InlineData("""{"key":"ok"}""")]
    [InlineData("""{"key":"ok","base64":""}""")]
    public void A_damaged_asset_entry_refuses_the_file(string entry)
    {
        var result = DesignPackageFormat.Read(Encoding.UTF8.GetBytes(Frame($",\"assets\":[{entry}]")));
        Assert.False(result.Ok);
        Assert.NotNull(result.Error);
    }

    [Fact]
    public void The_same_key_twice_a_flood_of_assets_and_wrong_lists_are_refused()
    {
        Assert.False(DesignPackageFormat.Read(Encoding.UTF8.GetBytes(Frame(",\"assets\":[{\"key\":\"a\",\"base64\":\"AQID\"},{\"key\":\"A\",\"base64\":\"AQID\"}]"))).Ok);
        var many = string.Join(",", Enumerable.Range(0, DesignPackageFormat.MaxAssets + 1).Select(i => $"{{\"key\":\"k{i}\",\"base64\":\"AQID\"}}"));
        Assert.False(DesignPackageFormat.Read(Encoding.UTF8.GetBytes(Frame($",\"assets\":[{many}]"))).Ok);
        Assert.False(DesignPackageFormat.Read(Encoding.UTF8.GetBytes(Frame(",\"assets\":{}"))).Ok);
        Assert.False(DesignPackageFormat.Read(Encoding.UTF8.GetBytes(Frame(",\"fonts\":\"x\""))).Ok);
    }

    [Theory]
    [InlineData("""{"family":"F","weight":"bold","base64":"AQID"}""")]
    [InlineData("""{"weight":"400","base64":"AQID"}""")]
    [InlineData("""{"family":"F","weight":"400"}""")]
    public void A_damaged_font_entry_refuses_the_file(string entry)
        => Assert.False(DesignPackageFormat.Read(Encoding.UTF8.GetBytes(Frame($",\"fonts\":[{entry}]"))).Ok);

    [Fact]
    public void A_font_entry_is_cleaned_and_a_variable_weight_range_is_fine()
    {
        var result = DesignPackageFormat.Read(Encoding.UTF8.GetBytes(Frame(""","fonts":[{"family":"Ev\"il{};Font","weight":"100 900","style":"oblique","format":"TTF","base64":"AQID"}]""")));
        Assert.True(result.Ok, result.Error);
        var font = result.Package!.Fonts.Single();
        Assert.Equal("Ev il Font", font.Family);
        Assert.Equal(("100 900", "normal", "ttf"), (font.Weight, font.Style, font.Format));
    }

    [Fact]
    public void A_file_over_fifty_megabytes_is_refused_before_it_is_parsed()
    {
        var result = DesignPackageFormat.Read(new byte[(int)DesignPackageFormat.MaxFileBytes + 1]);
        Assert.False(result.Ok);
        Assert.Contains("50 MB", result.Error);
    }

    [Fact]
    public void Asset_keys_are_rewritten_everywhere_without_regard_to_case()
    {
        var doc = DocumentValidator.Parse(DocumentJson())!;
        var rewritten = DesignPackageFormat.RewriteAssetKeys(doc, new Dictionary<string, string> { ["logo"] = "logo-2", ["flag-de"] = "flag-de-2", ["back-ground"] = "bg-2" });
        Assert.Equal("bg-2", rewritten.Pages[0].Background.Asset);
        Assert.Equal("flag-de-2", rewritten.Fields.Single(f => f.Key == "Land").Sample);
        Assert.Equal("Gouda", rewritten.Fields.Single(f => f.Key == "Name").Sample);
        Assert.Equal("logo-2", ((ImageElement)rewritten.Pages[0].Elements.Single(e => e.Id == "d")).Source!.Asset);
        Assert.Equal("Land", ((ImageElement)rewritten.Pages[0].Elements.Single(e => e.Id == "e")).Source!.Field);
        var strip = (ImageStripElement)rewritten.Pages[0].Elements.Single(e => e.Id == "f");
        Assert.Equal("flag-de-2", strip.Items[0]!.Asset);
        Assert.Equal("Land", strip.Items[1]!.Field);
        Assert.Null(strip.Items[2]);
        Assert.Equal("seal", strip.Items[3]!.Asset);
        Assert.Equal(["bg-2", "logo-2", "flag-de-2", "seal"], Placeholders.AssetKeys(DocumentValidator.Normalize(rewritten)));
    }

    [Fact]
    public void An_empty_map_changes_nothing()
    {
        var doc = DocumentValidator.Parse(DocumentJson())!;
        Assert.Same(doc, DesignPackageFormat.RewriteAssetKeys(doc, new Dictionary<string, string>()));
    }

    [Fact]
    public void The_fonts_a_document_uses_are_listed_once_without_generic_families()
        => Assert.Equal(["Montserrat", "My Font"], Placeholders.FontFamilies(DocumentValidator.Parse(DocumentJson())!));

    [Theory]
    [InlineData("Käsetheke – Preisschild", "Käsetheke - Preisschild.dtx.json")]
    [InlineData("a/b\\c:d*e?", "a-b-c-d-e.dtx.json")]
    [InlineData("  ...  ", "design.dtx.json")]
    public void The_file_name_comes_from_the_name_of_the_design(string name, string expected)
        => Assert.Equal(expected, DesignPackageFormat.FileName(name));
}
