using MatCan.Core.Media;
using MatCan.Logic;
using MatCan.Tests.Core;

namespace MatCan.Tests.Web;

public sealed class AssetKeyTests
{
    [Theory]
    [InlineData("Käse Logo Test.png", "kaese-logo-test")]
    [InlineData("flag_de.SVG", "flag-de")]
    [InlineData("  ..png", "bild")]
    [InlineData("Bio (2).jpg", "bio-2")]
    public void A_file_name_makes_a_key(string fileName, string expected) => Assert.Equal(expected, AssetLogic.KeyFromFileName(fileName));

    [Theory]
    [InlineData("flag-de", "flag-de")]
    [InlineData("  Flag-DE ", "flag-de")]
    [InlineData("a_b-9", "a_b-9")]
    public void A_typed_key_is_made_lower_case(string typed, string expected) => Assert.Equal(expected, AssetLogic.NormalizeKey(typed));

    [Theory]
    [InlineData("")]
    [InlineData("-start")]
    [InlineData("with space")]
    [InlineData("ümlaut")]
    [InlineData("slash/key")]
    public void A_bad_key_is_refused(string typed) => Assert.Null(AssetLogic.NormalizeKey(typed));

    [Fact]
    public void A_key_is_at_most_64_characters_long()
    {
        Assert.NotNull(AssetLogic.NormalizeKey(new string('a', 64)));
        Assert.Null(AssetLogic.NormalizeKey(new string('a', 65)));
    }

    [Fact]
    public void The_url_of_an_asset_carries_a_short_hash_so_that_the_browser_may_keep_it_forever()
        => Assert.Equal("/media/flag-de?v=0123456789ab", AssetLogic.Url("flag-de", "0123456789abcdef"));

    [Fact]
    public void Tags_are_trimmed_and_listed_once()
        => Assert.Equal("Logo, käse", AssetLogic.CleanTags(" Logo, käse ,, logo ;Käse"));

    [Theory]
    [InlineData("element script", "Element „script“ entfernt")]
    [InlineData("attribute onload", "Attribut „onload“ entfernt")]
    [InlineData("attribute style (unsafe value)", "Attribut „style“ mit unsicherem Wert entfernt")]
    [InlineData("href http://evil.example/x.png", "Verweis „http://evil.example/x.png“ entfernt")]
    [InlineData("element image without a safe reference", "Element „image“ ohne sicheren Verweis entfernt")]
    public void What_the_sanitiser_removed_is_told_in_german(string removed, string expected) => Assert.Equal(expected, AssetLogic.DescribeRemoved(removed));

    [Fact]
    public void A_picture_is_checked_by_its_bytes_not_by_its_name()
    {
        var notAnImage = System.Text.Encoding.UTF8.GetBytes("das ist kein Bild");
        var error = Assert.Throws<BizException>(() => AssetLogic.Prepare(notAnImage));
        Assert.Contains("kein Bild", error.Message);
        Assert.Throws<BizException>(() => AssetLogic.Prepare([]));
    }

    [Fact]
    public void A_hostile_svg_is_cleaned_and_a_dtd_refused()
    {
        var hostile = System.Text.Encoding.UTF8.GetBytes("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"10\" height=\"10\" onload=\"x()\"><script>x()</script><rect width=\"10\" height=\"10\"/></svg>");
        var prepared = AssetLogic.Prepare(hostile);
        Assert.Equal("image/svg+xml", prepared.ContentType);
        Assert.DoesNotContain("script", System.Text.Encoding.UTF8.GetString(prepared.Bytes));
        Assert.NotEmpty(prepared.Cleaned);
        Assert.All(prepared.Cleaned, c => Assert.EndsWith("entfernt", c));

        var bomb = System.Text.Encoding.UTF8.GetBytes("<?xml version=\"1.0\"?><!DOCTYPE svg [<!ENTITY a \"aaaa\">]><svg xmlns=\"http://www.w3.org/2000/svg\"><text>&a;</text></svg>");
        Assert.Throws<BizException>(() => AssetLogic.Prepare(bomb));
    }
}

public sealed class FontTests
{
    [Theory]
    [InlineData("Roboto-Bold.ttf", "Roboto", "700", "normal")]
    [InlineData("Roboto-BoldItalic.ttf", "Roboto", "700", "italic")]
    [InlineData("OpenSans-Variable.ttf", "Open Sans", "100 900", "normal")]
    [InlineData("Montserrat-Italic-Variable.ttf", "Montserrat", "100 900", "italic")]
    [InlineData("PlayfairDisplay-Regular.otf", "Playfair Display", "400", "normal")]
    public void The_file_name_tells_family_weight_and_style(string file, string family, string weight, string style)
        => Assert.Equal((family, weight, style), FontLogic.GuessFromFileName(file));

    [Theory]
    [InlineData("400", true)]
    [InlineData("100 900", true)]
    [InlineData("450", false)]
    [InlineData("bold", false)]
    [InlineData("", false)]
    public void A_weight_is_a_hundred_or_a_range(string weight, bool valid) => Assert.Equal(valid, FontLogic.IsValidWeight(weight));

    [Fact]
    public void A_family_name_cannot_break_out_of_the_style_sheet()
    {
        var family = FontLogic.CssName("Evil'}; body{display:none} /*\\");
        Assert.DoesNotContain("'", family);
        Assert.DoesNotContain("}", family);
        Assert.DoesNotContain("{", family);
        Assert.DoesNotContain("\\", family);
    }

    [Fact]
    public void The_style_sheet_declares_every_font_with_display_block_and_the_weight_range()
    {
        var fonts = new[]
        {
            new FontRow { Id = 3, Family = "Montserrat", Weight = "100 900", Style = "normal", Format = "ttf", ContentHash = "0123456789abcdef", License = "OFL-1.1" },
            new FontRow { Id = 4, Family = "Pacifico", Weight = "400", Style = "italic", Format = "woff2", ContentHash = "fedcba9876543210", License = "OFL-1.1" },
        };
        var css = FontLogic.FontFaceCss(fonts);
        Assert.Contains("@font-face{font-family:'Montserrat';src:url('/fonts/3-0123456789ab.ttf') format('truetype');font-weight:100 900;font-style:normal;font-display:block}", css);
        Assert.Contains("format('woff2');font-weight:400;font-style:italic;font-display:block}", css);
    }

    [Fact]
    public void The_built_in_fonts_are_read_by_their_name_tables()
    {
        var root = RepoFiles.WwwRoot();
        var montserrat = FontInfo.Read(File.ReadAllBytes(Path.Combine(root, "fonts", "Montserrat-Variable.ttf")));
        Assert.NotNull(montserrat);
        Assert.Equal("Montserrat", montserrat.Family);
        Assert.True(montserrat.IsVariable);
        Assert.False(montserrat.Italic);

        var italic = FontInfo.Read(File.ReadAllBytes(Path.Combine(root, "fonts", "Montserrat-Italic-Variable.ttf")));
        Assert.True(italic!.Italic);

        var bebas = FontInfo.Read(File.ReadAllBytes(Path.Combine(root, "fonts", "BebasNeue-Regular.ttf")));
        Assert.Equal("Bebas Neue", bebas!.Family);
        Assert.False(bebas.IsVariable);
        Assert.Equal(400, bebas.Weight);
    }

    [Fact]
    public void Garbage_gives_no_font_info_and_no_exception()
    {
        Assert.Null(FontInfo.Read([]));
        Assert.Null(FontInfo.Read(System.Text.Encoding.ASCII.GetBytes("this is not a font at all")));
        Assert.Null(FontInfo.Read([0, 1, 0, 0, 0xff, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
    }
}

public sealed class SheetTests
{
    private static SheetLogic.SheetInput Input(int columns = 2, int rows = 4, double cellW = 99.1, double cellH = 67.7, double gapX = 2.5, double left = 4.65, double top = 13.1)
        => new("A4 2x4", 210, 297, top, left, columns, rows, cellW, cellH, gapX, 0, false);

    [Fact]
    public void A_sheet_of_the_stationery_shop_fits()
        => Assert.Null(SheetLogic.Check(Input()).Message);

    [Fact]
    public void Labels_that_are_too_wide_for_the_paper_are_refused()
        => Assert.Contains("breit", SheetLogic.Check(Input(columns: 3)).Message);

    [Fact]
    public void Labels_that_are_too_high_for_the_paper_are_refused()
        => Assert.Contains("hoch", SheetLogic.Check(Input(rows: 5)).Message);

    [Theory]
    [InlineData(0, 1)]
    [InlineData(1, 0)]
    [InlineData(51, 1)]
    public void The_grid_has_between_one_and_fifty_labels_each_way(int columns, int rows)
        => Assert.NotNull(SheetLogic.Check(Input(columns, rows, 10, 10, 0, 0, 0)).Message);

    [Fact]
    public void The_used_area_is_margin_labels_and_gaps()
    {
        var (width, height) = SheetLogic.UsedArea(Input());
        Assert.Equal(4.65 + 2 * 99.1 + 2.5, width, 6);
        Assert.Equal(13.1 + 4 * 67.7, height, 6);
    }
}

public sealed class DataListHelperTests
{
    [Theory]
    [InlineData("Name", "Name")]
    [InlineData("Fett i. Tr.", "FettiTr")]
    [InlineData("Käse-Art", "KaeseArt")]
    [InlineData("1. Preis", "Spalte1Preis")]
    [InlineData("€", "Spalte")]
    public void A_header_makes_a_placeholder_key(string header, string key)
    {
        var made = DataListLogic.KeyFromHeader(header);
        Assert.Equal(key, made);
        Assert.True(MatCan.Core.Data.ColumnDefs.IsValidKey(made));
    }

    [Fact]
    public void A_long_header_is_cut_to_forty_characters()
        => Assert.Equal(40, DataListLogic.KeyFromHeader(new string('a', 100)).Length);
}

public sealed class DesignRowTests
{
    [Fact]
    public void The_size_is_written_without_needless_decimals()
    {
        Assert.Equal("150 × 100 mm", new DesignRow { Width = 150, Height = 100, Unit = "mm" }.Size);
        Assert.Equal("99,1 × 67,7 mm", new DesignRow { Width = 99.1, Height = 67.7, Unit = "mm" }.Size);
        Assert.Equal("1.080 × 1.920 px", new DesignRow { Width = 1080, Height = 1920, Unit = "px" }.Size);
    }

    [Fact]
    public void The_thumbnail_address_is_versioned_by_its_hash()
    {
        Assert.Null(new DesignRow { Id = 5 }.ThumbnailUrl);
        Assert.Equal("/designs/5/thumbnail.png?v=0123456789ab", new DesignRow { Id = 5, ThumbnailHash = "0123456789abcdef" }.ThumbnailUrl);
    }
}
