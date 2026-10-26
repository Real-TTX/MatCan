using System.Buffers.Binary;
using System.Text;
using System.Text.Json;
using System.Xml.Linq;
using DesignThix.Core.Media;

namespace DesignThix.Tests.Core;

internal static class RepoFiles
{
    /// <summary>The folder <c>src/DesignThix/wwwroot</c>, found by walking up from the test binaries. Fails loudly when the repository layout is not there.</summary>
    public static string WwwRoot([System.Runtime.CompilerServices.CallerFilePath] string sourceFile = "")
    {
        // from the test binaries, and from this source file (its path is known at build time: a build with the artifacts in another folder still finds the repository)
        foreach (var start in new[] { AppContext.BaseDirectory, Path.GetDirectoryName(sourceFile) ?? "" })
        {
            var dir = start.Length == 0 ? null : new DirectoryInfo(start);
            while (dir is not null)
            {
                var candidate = Path.Combine(dir.FullName, "src", "DesignThix", "wwwroot", "builtin", "builtin.json");
                if (File.Exists(candidate))
                {
                    return Path.GetDirectoryName(Path.GetDirectoryName(candidate))!;
                }

                dir = dir.Parent;
            }
        }

        throw new DirectoryNotFoundException("src/DesignThix/wwwroot/builtin/builtin.json was not found above " + AppContext.BaseDirectory);
    }
}

public sealed class FileSnifferTests
{
    private static byte[] Png(uint width, uint height)
    {
        var bytes = new List<byte> { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, (byte)'I', (byte)'H', (byte)'D', (byte)'R' };
        var size = new byte[8];
        BinaryPrimitives.WriteUInt32BigEndian(size, width);
        BinaryPrimitives.WriteUInt32BigEndian(size.AsSpan(4), height);
        bytes.AddRange(size);
        bytes.AddRange(new byte[] { 8, 6, 0, 0, 0 });
        return [.. bytes];
    }

    [Fact]
    public void A_png_has_its_size()
    {
        var result = FileSniffer.Sniff(Png(640, 480));
        Assert.Equal((FileKind.Png, "image/png", "png", 640, 480), (result.Kind, result.ContentType, result.Extension, result.Width, result.Height));
        Assert.True(result.IsImage && result.IsRaster && !result.IsFont);
    }

    [Fact]
    public void A_png_with_a_broken_header_is_unknown()
    {
        var broken = Png(1, 1);
        broken[12] = (byte)'X';
        Assert.Equal(FileKind.Unknown, FileSniffer.Sniff(broken).Kind);
        Assert.Equal(FileKind.Unknown, FileSniffer.Sniff(Png(1, 1).AsSpan(0, 20)).Kind);
    }

    [Fact]
    public void A_jpeg_has_its_size_from_the_first_frame_header()
    {
        // SOI, an APP0 segment of 16 bytes, then SOF0 (height 300, width 200).
        var jpeg = new List<byte> { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, (byte)'J', (byte)'F', (byte)'I', (byte)'F', 0, 1, 1, 0, 0, 1, 0, 1, 0, 0 };
        jpeg.AddRange(new byte[] { 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x01, 0x2C, 0x00, 0xC8, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1 });
        var result = FileSniffer.Sniff([.. jpeg]);
        Assert.Equal((FileKind.Jpeg, "image/jpeg", "jpg", 200, 300), (result.Kind, result.ContentType, result.Extension, result.Width, result.Height));
    }

    [Fact]
    public void A_progressive_jpeg_is_found_too_and_a_jpeg_without_frame_has_no_size()
    {
        var progressive = new byte[] { 0xFF, 0xD8, 0xFF, 0xC2, 0x00, 0x0B, 0x08, 0x00, 0x20, 0x00, 0x40, 0x01, 1, 0x11, 0 };
        var result = FileSniffer.Sniff(progressive);
        Assert.Equal((64, 32), (result.Width, result.Height));
        var bare = FileSniffer.Sniff(new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 });
        Assert.Equal(FileKind.Jpeg, bare.Kind);
        Assert.Null(bare.Width);
    }

    [Fact]
    public void A_gif_has_its_size()
    {
        var gif = Encoding.ASCII.GetBytes("GIF89a").Concat(new byte[] { 0x10, 0x00, 0x20, 0x00, 0, 0, 0 }).ToArray();
        var result = FileSniffer.Sniff(gif);
        Assert.Equal((FileKind.Gif, "gif", 16, 32), (result.Kind, result.Extension, result.Width, result.Height));
        Assert.Equal(FileKind.Gif, FileSniffer.Sniff(Encoding.ASCII.GetBytes("GIF87a").Concat(new byte[] { 1, 0, 1, 0 }).ToArray()).Kind);
    }

    [Fact]
    public void A_webp_has_its_size_in_all_three_forms()
    {
        static byte[] Riff(string chunk, byte[] payload)
        {
            var bytes = new List<byte>();
            bytes.AddRange("RIFF"u8.ToArray());
            bytes.AddRange(BitConverter.GetBytes(4 + 8 + payload.Length));
            bytes.AddRange("WEBP"u8.ToArray());
            bytes.AddRange(Encoding.ASCII.GetBytes(chunk));
            bytes.AddRange(BitConverter.GetBytes(payload.Length));
            bytes.AddRange(payload);
            return [.. bytes];
        }

        var lossy = FileSniffer.Sniff(Riff("VP8 ", [0, 0, 0, 0x9D, 0x01, 0x2A, 0x40, 0x01, 0xF0, 0x00, 0, 0]));
        Assert.Equal((FileKind.WebP, "image/webp", "webp", 320, 240), (lossy.Kind, lossy.ContentType, lossy.Extension, lossy.Width, lossy.Height));

        // VP8L: signature, then (width - 1) in 14 bits and (height - 1) in 14 bits.
        var bits = (uint)(99 | (49 << 14));
        var lossless = FileSniffer.Sniff(Riff("VP8L", [0x2F, .. BitConverter.GetBytes(bits), 0, 0, 0, 0]));
        Assert.Equal((100, 50), (lossless.Width, lossless.Height));

        // VP8X: flags (4), then canvas width - 1 and height - 1 in 24 bits each.
        var extended = FileSniffer.Sniff(Riff("VP8X", [0, 0, 0, 0, 0x7F, 0x02, 0x00, 0xDF, 0x01, 0x00]));
        Assert.Equal((640, 480), (extended.Width, extended.Height));
    }

    [Theory]
    [InlineData("<svg xmlns=\"http://www.w3.org/2000/svg\"/>")]
    [InlineData("  \n\t<svg viewBox=\"0 0 1 1\"></svg>")]
    [InlineData("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg xmlns=\"http://www.w3.org/2000/svg\"/>")]
    [InlineData("<?xml version=\"1.0\"?><!-- made by hand --><svg/>")]
    [InlineData("<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd\"><svg/>")]
    [InlineData("<!DOCTYPE svg [ <!ENTITY a \"b\"> ]><svg/>")]
    public void Svg_variants_are_recognised(string text)
    {
        var result = FileSniffer.Sniff(Encoding.UTF8.GetBytes(text));
        Assert.Equal((FileKind.Svg, "image/svg+xml", "svg"), (result.Kind, result.ContentType, result.Extension));
        Assert.True(result.IsImage && !result.IsRaster);
    }

    [Fact]
    public void Svg_with_a_utf8_bom_is_recognised_but_utf16_is_not()
    {
        Assert.Equal(FileKind.Svg, FileSniffer.Sniff([.. new byte[] { 0xEF, 0xBB, 0xBF }, .. "<svg/>"u8.ToArray()]).Kind);
        Assert.Equal(FileKind.Unknown, FileSniffer.Sniff(Encoding.Unicode.GetBytes("<svg xmlns=\"http://www.w3.org/2000/svg\"/>")).Kind);
        Assert.Equal(FileKind.Unknown, FileSniffer.Sniff([.. new byte[] { 0xFF, 0xFE }, .. Encoding.Unicode.GetBytes("<svg/>")]).Kind);
    }

    [Theory]
    [InlineData("<html><body>hello</body></html>")]
    [InlineData("<svgfoo/>")]
    [InlineData("just some text")]
    [InlineData("<?xml version=\"1.0\"?><note/>")]
    [InlineData("<!-- never ends <svg/>")]
    [InlineData("")]
    public void Other_text_is_unknown(string text)
    {
        var result = FileSniffer.Sniff(Encoding.UTF8.GetBytes(text));
        Assert.Equal(FileKind.Unknown, result.Kind);
        Assert.Equal("application/octet-stream", result.ContentType);
        Assert.False(result.IsImage || result.IsFont);
    }

    [Fact]
    public void An_svg_that_starts_after_4_kilobytes_of_comments_is_not_recognised()
    {
        var text = "<!--" + new string('x', 5000) + "--><svg/>";
        Assert.Equal(FileKind.Unknown, FileSniffer.Sniff(Encoding.UTF8.GetBytes(text)).Kind);
    }

    [Theory]
    [InlineData(new byte[] { 0x00, 0x01, 0x00, 0x00, 0x00, 0x10 }, FileKind.Ttf, "font/ttf", "ttf")]
    [InlineData(new byte[] { (byte)'t', (byte)'r', (byte)'u', (byte)'e', 0, 0 }, FileKind.Ttf, "font/ttf", "ttf")]
    [InlineData(new byte[] { (byte)'O', (byte)'T', (byte)'T', (byte)'O', 0, 0 }, FileKind.Otf, "font/otf", "otf")]
    [InlineData(new byte[] { (byte)'w', (byte)'O', (byte)'F', (byte)'F', 0, 1 }, FileKind.Woff, "font/woff", "woff")]
    [InlineData(new byte[] { (byte)'w', (byte)'O', (byte)'F', (byte)'2', 0, 1 }, FileKind.Woff2, "font/woff2", "woff2")]
    public void Fonts_are_recognised_by_their_magic(byte[] bytes, FileKind kind, string contentType, string extension)
    {
        var result = FileSniffer.Sniff(bytes);
        Assert.Equal((kind, contentType, extension), (result.Kind, result.ContentType, result.Extension));
        Assert.True(result.IsFont && !result.IsImage);
        Assert.Null(result.Width);
    }

    [Theory]
    [InlineData(new byte[0])]
    [InlineData(new byte[] { 0x89 })]
    [InlineData(new byte[] { 0x89, 0x50, 0x4E })]
    [InlineData(new byte[] { 0xFF, 0xD8 })]
    [InlineData(new byte[] { (byte)'G', (byte)'I', (byte)'F', (byte)'8' })]
    [InlineData(new byte[] { 0, 0, 0, 0, 0, 0, 0, 0 })]
    [InlineData(new byte[] { 0x50, 0x4B, 0x03, 0x04 })]
    [InlineData(new byte[] { 0x25, 0x50, 0x44, 0x46 })]
    public void Truncated_or_foreign_data_is_unknown(byte[] bytes) => Assert.Equal(FileKind.Unknown, FileSniffer.Sniff(bytes).Kind);

    [Fact]
    public void Random_bytes_never_throw()
    {
        var random = new Random(7);
        for (var i = 0; i < 2000; i++)
        {
            var bytes = new byte[random.Next(0, 80)];
            random.NextBytes(bytes);
            if (i % 3 == 0 && bytes.Length > 4)
            {
                // Start like a real format so that the parsers go deeper.
                new byte[] { 0xFF, 0xD8, 0xFF, 0xC0 }.CopyTo(bytes, 0);
            }
            else if (i % 3 == 1 && bytes.Length > 16)
            {
                "RIFF\0\0\0\0WEBPVP8X"u8.ToArray().CopyTo(bytes, 0);
            }

            FileSniffer.Sniff(bytes);
        }
    }

    [Fact]
    public void A_real_png_is_found_with_its_size()
    {
        var bytes = File.ReadAllBytes(Path.Combine(RepoFiles.WwwRoot(), "img", "icon-192.png"));
        var result = FileSniffer.Sniff(bytes);
        Assert.Equal((FileKind.Png, 192, 192), (result.Kind, result.Width, result.Height));
    }

    [Fact]
    public void Every_bundled_font_is_a_ttf_or_a_woff2()
    {
        var folder = Path.Combine(RepoFiles.WwwRoot(), "fonts");
        using var json = JsonDocument.Parse(File.ReadAllText(Path.Combine(folder, "fonts.json")));
        var files = json.RootElement.EnumerateArray().Select(f => f.GetProperty("file").GetString()!).ToList();
        Assert.NotEmpty(files);
        foreach (var file in files)
        {
            Assert.Contains(FileSniffer.Sniff(File.ReadAllBytes(Path.Combine(folder, file))).Kind, new[] { FileKind.Ttf, FileKind.Woff2 });
        }
    }

    [Fact]
    public void Every_bundled_svg_is_an_svg()
    {
        var folder = Path.Combine(RepoFiles.WwwRoot(), "builtin");
        foreach (var file in Directory.EnumerateFiles(folder, "*.svg", SearchOption.AllDirectories))
        {
            Assert.Equal(FileKind.Svg, FileSniffer.Sniff(File.ReadAllBytes(file)).Kind);
        }
    }
}

public sealed class SvgSafeTests
{
    private const string Header = "<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" viewBox=\"0 0 100 50\" width=\"100\" height=\"50\">";

    private static SvgSafe.Result Run(string svg) => SvgSafe.Sanitize(Encoding.UTF8.GetBytes(svg));

    private static string Output(SvgSafe.Result result)
    {
        Assert.True(result.Ok, result.Error);
        return Encoding.UTF8.GetString(result.Bytes!);
    }

    private static string Clean(string body) => Output(Run(Header + body + "</svg>"));

    private static void AssertRefused(SvgSafe.Result result)
    {
        Assert.False(result.Ok);
        Assert.False(string.IsNullOrWhiteSpace(result.Error));
        Assert.Null(result.Bytes);
    }

    // ------------------------------------------------------------------------------------------------ the good files

    [Fact]
    public void Every_bundled_svg_passes_unchanged_in_meaning()
    {
        var folder = Path.Combine(RepoFiles.WwwRoot(), "builtin");
        var files = Directory.EnumerateFiles(folder, "*.svg", SearchOption.AllDirectories).ToList();
        Assert.True(files.Count >= 36, $"only {files.Count} svg files found in {folder}");

        string[] drawing = ["path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "g", "clipPath", "defs", "title"];
        foreach (var file in files)
        {
            var original = File.ReadAllBytes(file);
            var result = SvgSafe.Sanitize(original);
            Assert.True(result.Ok, $"{file}: {result.Error}");
            Assert.Empty(result.Removed);

            var before = XDocument.Parse(Encoding.UTF8.GetString(original)).Descendants().ToList();
            var after = XDocument.Parse(Encoding.UTF8.GetString(result.Bytes!)).Descendants().ToList();
            Assert.Equal(before.Count, after.Count);
            foreach (var name in drawing)
            {
                Assert.Equal(before.Count(e => e.Name.LocalName == name), after.Count(e => e.Name.LocalName == name));
            }

            // Every attribute survives with its value (the output is a re-serialisation, not a rewrite).
            for (var i = 0; i < before.Count; i++)
            {
                var expected = before[i].Attributes().Where(a => !a.IsNamespaceDeclaration).ToDictionary(a => a.Name.LocalName, a => a.Value);
                var actual = after[i].Attributes().Where(a => !a.IsNamespaceDeclaration).ToDictionary(a => a.Name.LocalName, a => a.Value);
                Assert.Equal(expected, actual);
            }

            Assert.NotNull(result.Width);
            Assert.NotNull(result.Height);
        }
    }

    [Fact]
    public void The_output_is_utf8_without_bom_and_without_xml_declaration()
    {
        var result = Run("\uFEFF<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" + Header + "<title>Käse</title></svg>");
        Assert.True(result.Ok);
        Assert.NotEqual(0xEF, result.Bytes![0]);
        var text = Encoding.UTF8.GetString(result.Bytes);
        Assert.StartsWith("<svg", text);
        Assert.Contains("Käse", text);
    }

    [Theory]
    [InlineData("width=\"200\" height=\"100\"", 200, 100)]
    [InlineData("width=\"2in\" height=\"1in\"", 192, 96)]
    [InlineData("width=\"10mm\" height=\"5mm\"", 38, 19)]
    [InlineData("width=\"72pt\" height=\"36pt\"", 96, 48)]
    [InlineData("width=\"100%\" height=\"100%\" viewBox=\"0 0 30 20\"", 30, 20)]
    [InlineData("viewBox=\"0 0 640.4 480\"", 640, 480)]
    [InlineData("viewBox=\"0,0,16,9\"", 16, 9)]
    [InlineData("width=\"50\" viewBox=\"0 0 10 20\"", 50, 20)]
    public void The_size_comes_from_width_and_height_or_the_view_box(string attributes, int width, int height)
    {
        var result = Run("<svg xmlns=\"http://www.w3.org/2000/svg\" " + attributes + "/>");
        Assert.True(result.Ok);
        Assert.Equal((width, height), (result.Width, result.Height));
    }

    [Fact]
    public void Without_a_size_the_size_is_unknown()
    {
        var result = Run("<svg xmlns=\"http://www.w3.org/2000/svg\"/>");
        Assert.True(result.Ok);
        Assert.Null(result.Width);
    }

    [Fact]
    public void Gradients_clip_paths_masks_filters_and_internal_references_are_kept()
    {
        var output = Clean(
            "<defs><linearGradient id=\"g\" x1=\"0\" x2=\"1\" gradientUnits=\"objectBoundingBox\"><stop offset=\"0\" stop-color=\"#f00\"/><stop offset=\"1\" stop-color=\"#00f\"/></linearGradient>" +
            "<clipPath id=\"c\"><rect width=\"10\" height=\"10\"/></clipPath><mask id=\"m\"><rect width=\"5\" height=\"5\" fill=\"#fff\"/></mask>" +
            "<filter id=\"f\"><feGaussianBlur stdDeviation=\"2\"/></filter><path id=\"p\" d=\"M0 0L10 10\"/></defs>" +
            "<rect width=\"50\" height=\"50\" fill=\"url(#g)\" clip-path=\"url(#c)\" mask=\"url(#m)\" filter=\"url(#f)\"/>" +
            "<use href=\"#p\"/><use xlink:href=\"#p\" x=\"5\"/><text font-family=\"Montserrat, sans-serif\" font-size=\"12\"><textPath href=\"#p\">Hallo</textPath></text>");
        foreach (var kept in new[] { "linearGradient", "clipPath", "mask", "feGaussianBlur", "url(#g)", "url(#c)", "url(#m)", "url(#f)", "<use href=\"#p\"", "xlink:href=\"#p\"", "textPath", "Hallo", "Montserrat" })
        {
            Assert.Contains(kept, output);
        }
    }

    [Fact]
    public void An_embedded_bitmap_is_kept_but_not_an_embedded_svg()
    {
        var png = "data:image/png;base64,iVBORw0KGgo=";
        var output = Clean("<image width=\"10\" height=\"10\" href=\"" + png + "\"/>");
        Assert.Contains(png, output);
        Assert.DoesNotContain("data:image/svg", Clean("<image href=\"data:image/svg+xml;base64,PHN2Zy8+\"/>"));
    }

    [Fact]
    public void Harmless_styles_are_kept()
    {
        var output = Clean("<style>.a { fill: #f00; stroke: url(#g); } /* note */</style><rect class=\"a\" style=\"fill:#00f;opacity:.5\" width=\"1\" height=\"1\"/>");
        Assert.Contains("<style>", output);
        Assert.Contains("fill:#00f;opacity:.5", output);
    }

    [Fact]
    public void Comments_processing_instructions_and_cdata_are_turned_into_plain_content()
    {
        var output = Clean("<!-- hidden --><?php echo 1 ?><style><![CDATA[ .a { fill: red } ]]></style><text>a &lt; b <![CDATA[<c>]]></text>");
        Assert.DoesNotContain("hidden", output);
        Assert.DoesNotContain("php", output);
        Assert.DoesNotContain("CDATA", output);
        Assert.Contains("a &lt; b &lt;c&gt;", output);
        Assert.Contains(".a { fill: red }", output);
    }

    [Fact]
    public void A_plain_public_doctype_is_dropped_and_reported()
    {
        var result = Run("<?xml version=\"1.0\"?><!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd\">" + Header + "<rect width=\"1\" height=\"1\"/></svg>");
        Assert.True(result.Ok);
        Assert.Contains("DOCTYPE declaration", result.Removed);
        Assert.DoesNotContain("DOCTYPE", Encoding.UTF8.GetString(result.Bytes!));
    }

    // ------------------------------------------------------------------------------------------------ the hostile corpus

    [Fact]
    public void Script_elements_are_removed_with_their_content()
    {
        var result = Run(Header + "<script>alert(1)</script><script type=\"text/javascript\"><![CDATA[alert(2)]]></script><rect width=\"1\" height=\"1\"/></svg>");
        var output = Output(result);
        Assert.DoesNotContain("script", output, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("alert", output);
        Assert.Contains("element script", result.Removed);
        Assert.Contains("<rect", output);
    }

    [Fact]
    public void A_script_in_another_namespace_prefix_is_removed()
    {
        var output = Output(Run("<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:s=\"http://www.w3.org/2000/svg\"><s:script>alert(1)</s:script></svg>"));
        Assert.DoesNotContain("alert", output);
    }

    [Fact]
    public void A_script_in_the_xhtml_namespace_is_removed()
    {
        var output = Clean("<script xmlns=\"http://www.w3.org/1999/xhtml\">alert(1)</script>");
        Assert.DoesNotContain("alert", output);
    }

    [Fact]
    public void ForeignObject_is_removed_with_its_html()
    {
        var result = Run(Header + "<foreignObject width=\"10\" height=\"10\"><body xmlns=\"http://www.w3.org/1999/xhtml\"><iframe src=\"http://evil/\"/><script>alert(1)</script></body></foreignObject></svg>");
        var output = Output(result);
        Assert.DoesNotContain("foreignObject", output);
        Assert.DoesNotContain("iframe", output);
        Assert.DoesNotContain("evil", output);
        Assert.Contains("element foreignObject", result.Removed);
    }

    [Theory]
    [InlineData("onload=\"alert(1)\"")]
    [InlineData("onclick=\"alert(1)\"")]
    [InlineData("onmouseover=\"alert(1)\"")]
    [InlineData("ONERROR=\"alert(1)\"")]
    [InlineData("onfocusin=\"alert(1)\"")]
    [InlineData("onbegin=\"alert(1)\"")]
    public void Event_handler_attributes_are_removed(string attribute)
    {
        var result = Run(Header + "<rect width=\"1\" height=\"1\" " + attribute + "/></svg>");
        var output = Output(result);
        Assert.DoesNotContain("alert", output);
        Assert.DoesNotContain(attribute.Split('=')[0], output, StringComparison.OrdinalIgnoreCase);
        Assert.Contains(result.Removed, r => r.StartsWith("attribute on", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void An_event_handler_on_the_root_is_removed()
    {
        var result = Run("<svg xmlns=\"http://www.w3.org/2000/svg\" onload=\"alert(1)\"/>");
        Assert.DoesNotContain("onload", Output(result));
    }

    [Theory]
    [InlineData("javascript:alert(1)")]
    [InlineData("JaVaScRiPt:alert(1)")]
    [InlineData(" javascript:alert(1)")]
    [InlineData("&#x6A;avascript:alert(1)")]
    [InlineData("http://evil.example/x.svg")]
    [InlineData("https://evil.example/x.png")]
    [InlineData("//evil.example/x.png")]
    [InlineData("file:///etc/passwd")]
    [InlineData("ftp://evil/x")]
    [InlineData("other.svg#a")]
    [InlineData("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==")]
    [InlineData("data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+")]
    [InlineData("data:application/javascript,alert(1)")]
    [InlineData("data:image/png,notbase64")]
    [InlineData("")]
    public void An_href_that_leaves_the_file_is_removed_from_an_image(string target)
    {
        var result = Run(Header + "<image width=\"5\" height=\"5\" href=\"" + target + "\"/><image width=\"5\" height=\"5\" xlink:href=\"" + target + "\"/></svg>");
        var output = Output(result);
        Assert.DoesNotContain("evil", output);
        Assert.DoesNotContain("javascript", output, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("passwd", output);
        Assert.DoesNotContain("data:", output);
        Assert.DoesNotContain("href", output);
        Assert.NotEmpty(result.Removed);
    }

    [Fact]
    public void Anchors_are_removed_even_with_a_local_target()
    {
        var output = Clean("<a href=\"javascript:alert(1)\"><rect width=\"1\" height=\"1\"/></a><a xlink:href=\"http://evil/\"><text>x</text></a><a href=\"#p\"><rect width=\"2\" height=\"2\"/></a>");
        Assert.DoesNotContain("<a", output);
        Assert.DoesNotContain("evil", output);
        Assert.DoesNotContain("javascript", output);
    }

    [Theory]
    [InlineData("http://x/y.svg#a")]
    [InlineData("other.svg#a")]
    [InlineData("file:///etc/passwd#a")]
    [InlineData("data:image/svg+xml;base64,PHN2Zy8+")]
    [InlineData("javascript:alert(1)")]
    [InlineData("")]
    public void A_use_that_points_outside_is_removed(string target)
    {
        var result = Run(Header + "<use href=\"" + target + "\"/><use xlink:href=\"" + target + "\"/></svg>");
        var output = Output(result);
        Assert.DoesNotContain("<use", output);

    }

    [Fact]
    public void A_use_without_a_reference_is_removed()
    {
        Assert.DoesNotContain("<use", Clean("<use x=\"1\" y=\"2\"/>"));
    }

    [Fact]
    public void Too_many_use_elements_are_refused()
    {
        var uses = string.Concat(Enumerable.Repeat("<use href=\"#a\"/>", 201));
        AssertRefused(Run(Header + "<g id=\"a\"/>" + uses + "</svg>"));
        Assert.True(Run(Header + "<g id=\"a\"/>" + string.Concat(Enumerable.Repeat("<use href=\"#a\"/>", 200)) + "</svg>").Ok);
    }

    [Fact]
    public void Animation_elements_are_removed()
    {
        var result = Run(Header + "<a id=\"l\" href=\"#x\"><text>t</text></a>" +
            "<animate attributeName=\"href\" values=\"javascript:alert(1)\" dur=\"1s\"/>" +
            "<set attributeName=\"href\" to=\"javascript:alert(1)\"/>" +
            "<animateTransform attributeName=\"transform\" type=\"rotate\" from=\"0\" to=\"360\" dur=\"1s\"/>" +
            "<animateMotion path=\"M0 0\" dur=\"1s\"/>" +
            "<rect width=\"1\" height=\"1\"><animate attributeName=\"xlink:href\" to=\"http://evil/\"/><set attributeName=\"onload\" to=\"alert(1)\"/></rect></svg>");
        var output = Output(result);
        foreach (var gone in new[] { "animate", "<set", "alert", "evil", "javascript" })
        {
            Assert.DoesNotContain(gone, output);
        }

        Assert.Contains("<rect", output);
    }

    [Theory]
    [InlineData("<style>@import url(http://evil.example/x.css);</style>")]
    [InlineData("<style>@import 'x.css';</style>")]
    [InlineData("<style>rect { fill: url(http://evil.example/p.svg#a) }</style>")]
    [InlineData("<style>rect { fill: URL( \"https://evil.example/p\" ) }</style>")]
    [InlineData("<style>rect { background: url(data:image/png;base64,AAAA) }</style>")]
    [InlineData("<style>rect { behavior: url(#default#VML) ; x: expression(alert(1)) }</style>")]
    [InlineData("<style>rect { -moz-binding: url(#x) }</style>")]
    [InlineData("<style>rect { width: expression(alert(1)) }</style>")]
    [InlineData("<style>rect { fill: \\75rl(http://evil/) }</style>")]
    [InlineData("<style>@font-face { font-family: x; src: url(http://evil/f.woff) }</style>")]
    [InlineData("<style>rect { content: 'javascript:alert(1)' }</style>")]
    [InlineData("<style>/* hidden */ @import /* x */ url(//evil/x.css);</style>")]
    public void A_style_element_with_unsafe_css_is_removed(string style)
    {
        var result = Run(Header + style + "<rect width=\"1\" height=\"1\"/></svg>");
        var output = Output(result);
        Assert.DoesNotContain("<style", output);
        Assert.DoesNotContain("evil", output);
        Assert.Contains("<rect", output);
        Assert.Contains(result.Removed, r => r.StartsWith("element style"));
    }

    [Theory]
    [InlineData("fill:url(http://evil.example/x)")]
    [InlineData("fill: url('https://evil.example/x')")]
    [InlineData("background-image:url(//evil/x.png)")]
    [InlineData("fill:url(data:image/png;base64,AAA)")]
    [InlineData("width:expression(alert(1))")]
    [InlineData("behavior:url(x.htc)")]
    [InlineData("fill:red;background:javascript:alert(1)")]
    public void A_style_attribute_with_unsafe_css_is_removed(string css)
    {
        var result = Run(Header + "<rect width=\"1\" height=\"1\" style=\"" + css + "\"/></svg>");
        var output = Output(result);
        Assert.DoesNotContain("style=", output);
        Assert.DoesNotContain("evil", output);
        Assert.Contains("<rect", output);
    }

    [Theory]
    [InlineData("fill", "url(http://evil/x)")]
    [InlineData("stroke", "url(https://evil/x#a)")]
    [InlineData("filter", "url(http://evil/f.svg#f)")]
    [InlineData("clip-path", "url(other.svg#c)")]
    [InlineData("mask", "url(//evil/m)")]
    [InlineData("fill", "javascript:alert(1)")]
    public void A_presentation_attribute_that_loads_something_is_removed(string name, string value)
    {
        var output = Output(Run(Header + "<rect width=\"1\" height=\"1\" " + name + "=\"" + value + "\"/></svg>"));
        Assert.DoesNotContain(name + "=", output.Replace("stroke-", ""));
        Assert.DoesNotContain("evil", output);
    }

    [Fact]
    public void Unknown_attributes_and_other_namespaces_are_removed_and_reported()
    {
        var result = Run("<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:inkscape=\"http://www.inkscape.org/namespaces/inkscape\" xmlns:x=\"urn:x\">" +
            "<rect width=\"1\" height=\"1\" inkscape:label=\"a\" data-x=\"1\" formaction=\"x\" x:y=\"z\"/><x:thing/><metadata>m</metadata><image/></svg>");
        var output = Output(result);
        foreach (var gone in new[] { "inkscape", "data-x", "formaction", "x:y", "thing", "metadata" })
        {
            Assert.DoesNotContain(gone, output);
        }

        Assert.Contains("attribute data-x", result.Removed);
        Assert.Contains("element metadata", result.Removed);
    }

    [Fact]
    public void A_foreign_root_namespace_or_a_missing_one_is_refused()
    {
        AssertRefused(Run("<svg xmlns=\"http://www.w3.org/1999/xhtml\"/>"));
        AssertRefused(Run("<svg><rect/></svg>"));
        AssertRefused(Run("<svg xmlns=\"urn:other\"/>"));
    }

    [Fact]
    public void A_root_that_is_not_svg_is_refused()
    {
        AssertRefused(Run("<html xmlns=\"http://www.w3.org/1999/xhtml\"><body/></html>"));
        AssertRefused(Run("<rect xmlns=\"http://www.w3.org/2000/svg\"/>"));
    }

    [Theory]
    [InlineData("not xml at all")]
    [InlineData("<svg xmlns=\"http://www.w3.org/2000/svg\"><rect></svg>")]
    [InlineData("<svg xmlns=\"http://www.w3.org/2000/svg\">")]
    [InlineData("")]
    [InlineData("{\"svg\":1}")]
    [InlineData("<svg xmlns=\"http://www.w3.org/2000/svg\"/><svg xmlns=\"http://www.w3.org/2000/svg\"/>")]
    public void Malformed_input_is_refused(string text) => AssertRefused(Run(text));

    [Fact]
    public void The_billion_laughs_is_refused()
    {
        const string bomb = """
            <?xml version="1.0"?>
            <!DOCTYPE svg [
              <!ENTITY a "aaaaaaaaaa">
              <!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">
              <!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;">
              <!ENTITY d "&c;&c;&c;&c;&c;&c;&c;&c;&c;&c;">
              <!ENTITY e "&d;&d;&d;&d;&d;&d;&d;&d;&d;&d;">
              <!ENTITY f "&e;&e;&e;&e;&e;&e;&e;&e;&e;&e;">
            ]>
            <svg xmlns="http://www.w3.org/2000/svg"><text>&f;</text></svg>
            """;
        var result = Run(bomb);
        AssertRefused(result);
        Assert.Contains("DOCTYPE", result.Error);
    }

    [Fact]
    public void An_external_entity_is_refused()
    {
        var xxe = "<?xml version=\"1.0\"?><!DOCTYPE svg [<!ENTITY x SYSTEM \"file:///etc/passwd\">]><svg xmlns=\"http://www.w3.org/2000/svg\"><text>&x;</text></svg>";
        var result = Run(xxe);
        AssertRefused(result);
        var windows = "<?xml version=\"1.0\"?><!DOCTYPE svg [<!ENTITY x SYSTEM \"file:///C:/Windows/win.ini\">]><svg xmlns=\"http://www.w3.org/2000/svg\"><text>&x;</text></svg>";
        AssertRefused(Run(windows));
    }

    [Fact]
    public void A_doctype_with_an_external_subset_that_is_not_the_plain_kind_is_refused()
    {
        AssertRefused(Run("<!DOCTYPE svg SYSTEM \"http://evil/x.dtd\" [<!ENTITY a \"b\">]><svg xmlns=\"http://www.w3.org/2000/svg\"/>"));
        AssertRefused(Run("<!DOCTYPE svg [<!ENTITY % p SYSTEM \"http://evil/p.dtd\"> %p;]><svg xmlns=\"http://www.w3.org/2000/svg\"/>"));
        AssertRefused(Run("<!DOCTYPE foo SYSTEM \"x.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\"/>"));
    }

    [Fact]
    public void A_file_over_2_megabytes_is_refused()
    {
        var big = Header + "<text>" + new string('x', SvgSafe.MaxBytes) + "</text></svg>";
        var result = Run(big);
        AssertRefused(result);
        Assert.Contains("2 MB", result.Error);
    }

    [Fact]
    public void Utf16_is_refused_and_a_utf8_bom_is_fine()
    {
        var text = Header + "<rect width=\"1\" height=\"1\"/></svg>";
        AssertRefused(SvgSafe.Sanitize(Encoding.Unicode.GetBytes(text)));
        AssertRefused(SvgSafe.Sanitize([.. Encoding.Unicode.GetPreamble(), .. Encoding.Unicode.GetBytes(text)]));
        AssertRefused(SvgSafe.Sanitize(Encoding.BigEndianUnicode.GetBytes("\uFEFF" + text)));
        Assert.True(SvgSafe.Sanitize([.. new UTF8Encoding(true).GetPreamble(), .. Encoding.UTF8.GetBytes(text)]).Ok);
    }

    [Fact]
    public void Deeply_nested_files_are_refused_without_a_stack_overflow()
    {
        var deep = Header + string.Concat(Enumerable.Repeat("<g>", 5000)) + string.Concat(Enumerable.Repeat("</g>", 5000)) + "</svg>";
        var result = Run(deep);
        AssertRefused(result);
        Assert.Contains("verschachtelt", result.Error);

        var fine = Header + string.Concat(Enumerable.Repeat("<g>", 90)) + string.Concat(Enumerable.Repeat("</g>", 90)) + "</svg>";
        Assert.True(Run(fine).Ok);
    }

    [Fact]
    public void Too_many_elements_are_refused()
    {
        var many = Header + string.Concat(Enumerable.Repeat("<g/>", 50_001)) + "</svg>";
        AssertRefused(Run(many));
    }

    [Fact]
    public void Nothing_that_looks_like_script_survives_anywhere_in_a_mixed_attack()
    {
        var attack = Header +
            "<script>alert(1)</script>" +
            "<rect width=\"1\" height=\"1\" onclick=\"alert(2)\" fill=\"url(http://evil/a)\" style=\"fill:url(http://evil/b)\"/>" +
            "<a href=\"javascript:alert(3)\"><text>x</text></a>" +
            "<image href=\"http://evil/c.png\"/><use href=\"http://evil/d.svg#e\"/>" +
            "<style>@import url(http://evil/f.css);</style>" +
            "<foreignObject><div xmlns=\"http://www.w3.org/1999/xhtml\" onmouseover=\"alert(4)\">x</div></foreignObject>" +
            "<set attributeName=\"href\" to=\"javascript:alert(5)\"/>" +
            "</svg>";
        var output = Output(Run(attack)).ToLowerInvariant();
        foreach (var needle in new[] { "script", "alert", "evil", "javascript", "onclick", "onmouseover", "@import", "http://", "foreignobject", "<a", "<image", "<set" })
        {
            Assert.DoesNotContain(needle, output.Replace("http://www.w3.org", ""));
        }
    }

    [Fact]
    public void The_result_can_be_sanitised_again_without_change()
    {
        var first = Run(Header + "<defs><linearGradient id=\"g\"><stop offset=\"0\"/></linearGradient></defs><rect width=\"1\" height=\"1\" fill=\"url(#g)\"/><text xml:space=\"preserve\">a  b</text></svg>");
        var second = SvgSafe.Sanitize(first.Bytes);
        Assert.True(second.Ok);
        Assert.Empty(second.Removed);
        Assert.Equal(Encoding.UTF8.GetString(first.Bytes!), Encoding.UTF8.GetString(second.Bytes!));
    }
}
