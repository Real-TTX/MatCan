using MatCan.Core.Documents;
using MatCan.Core.Media;

namespace MatCan.Tests.Core;

/// <summary>
/// The allowlist for the bodies of icons of catalogues (Iconify, docs/PLAN-CATALOGS.md section 5): real bodies in the shapes the API answers with (verified against api.iconify.design on 2026-10-26),
/// and hostile ones that must never be stored or drawn.
/// </summary>
public sealed class IconBodiesTests
{
    private static IconBodyParsed Ok(string body, double w = 24, double h = 24)
    {
        var parsed = IconBodies.Parse(body, w, h, out var reason);
        Assert.True(parsed is not null, "refused: " + reason);
        return parsed!;
    }

    private static string Refused(string body)
    {
        var parsed = IconBodies.Parse(body, 24, 24, out var reason);
        Assert.Null(parsed);
        Assert.False(string.IsNullOrEmpty(reason));
        return reason;
    }

    [Fact]
    public void A_filled_path_of_Material_Design_Icons_becomes_one_filled_shape()
    {
        var icon = Ok("""<path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3L2 12h3v8z"/>""");
        var shape = Assert.Single(icon.Shapes);
        Assert.Equal("path", shape.Tag);
        Assert.Equal("currentColor", shape.Attrs["fill"]);
        Assert.Equal("none", shape.Attrs["stroke"]);
        Assert.Equal((24, 24), (icon.Width, icon.Height));
        Assert.Contains("fill=\"currentColor\"", icon.Markup);
        Assert.DoesNotContain("stroke-width", icon.Markup);   // nothing is stroked: no stroke details
    }

    [Fact]
    public void A_group_of_Tabler_passes_its_stroke_down_to_every_path()
    {
        var icon = Ok("""<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M5 12H3l9-9l9 9h-2M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/><path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6"/></g>""");
        Assert.Equal(2, icon.Shapes.Count);
        Assert.All(icon.Shapes, s =>
        {
            Assert.Equal("none", s.Attrs["fill"]);
            Assert.Equal("currentColor", s.Attrs["stroke"]);
            Assert.Equal("2", s.Attrs["stroke-width"]);
            Assert.Equal("round", s.Attrs["stroke-linecap"]);
            Assert.Equal("round", s.Attrs["stroke-linejoin"]);
        });
    }

    [Fact]
    public void The_attributes_of_a_path_itself_work_like_the_ones_of_a_group_Heroicons()
    {
        var icon = Ok("""<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m2.25 12l8.955-8.955a1.124 1.124 0 0 1 1.59 0L21.75 12"/>""");
        Assert.Equal("1.5", icon.Shapes[0].Attrs["stroke-width"]);
        Assert.Equal("none", icon.Shapes[0].Attrs["fill"]);
    }

    [Fact]
    public void A_wide_grid_is_kept_Font_Awesome_576_by_512()
    {
        var icon = Ok("""<path fill="currentColor" d="M575.8 255.5c0 18-15 32.1-32 32.1h-32l.7 160.2"/>""", 576, 512);
        Assert.Equal((576, 512), (icon.Width, icon.Height));
        Assert.Contains("viewBox=\"0 0 576 512\"", IconBodies.ToSvg(icon));
    }

    [Fact]
    public void An_animated_icon_is_drawn_in_its_final_state_and_its_dash_is_left_out()
    {
        var icon = Ok("""<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path stroke-dasharray="18" d="M4.5 21.5h15"><animate fill="freeze" attributeName="stroke-dashoffset" dur="0.3s" values="18;0"/></path></g>""");
        var shape = Assert.Single(icon.Shapes);
        Assert.DoesNotContain("dash", icon.Markup);
        Assert.DoesNotContain("animate", icon.Markup);
        Assert.Equal("M4.5 21.5h15", shape.Attrs["d"]);
    }

    [Theory]
    [InlineData("#000", "currentColor")]
    [InlineData("#112233", "currentColor")]
    [InlineData("red", "currentColor")]
    [InlineData("rgb(0,0,0)", "currentColor")]
    [InlineData("none", "none")]
    [InlineData("transparent", "none")]
    [InlineData("currentColor", "currentColor")]
    public void Every_colour_of_a_monochrome_icon_is_the_colour_of_the_element(string fill, string expected)
    {
        var icon = Ok($"<path fill=\"{fill}\" stroke=\"{(expected == "none" ? "currentColor" : "none")}\" d=\"M0 0h4v4z\"/>");
        Assert.Equal(expected, icon.Shapes[0].Attrs["fill"]);
    }

    [Fact]
    public void Opacity_multiplies_down_the_groups_and_the_rest_is_inherited()
    {
        var icon = Ok("""<g opacity=".5"><g opacity=".5" fill-opacity=".4"><path d="M0 0h4v4z"/></g></g>""");
        Assert.Equal("0.25", icon.Shapes[0].Attrs["opacity"]);
        Assert.Equal("0.4", icon.Shapes[0].Attrs["fill-opacity"]);
    }

    [Fact]
    public void A_line_has_no_inside_and_a_shape_that_draws_nothing_is_left_out()
    {
        var icon = Ok("""<line x1="1" y1="1" x2="9" y2="9" stroke="currentColor"/><path fill="none" d="M0 0h4v4z"/>""");
        var line = Assert.Single(icon.Shapes);
        Assert.Equal("none", line.Attrs["fill"]);
    }

    [Fact]
    public void Parsing_the_markup_again_gives_the_same_markup()
    {
        var first = Ok("""<g fill="none" stroke="#000" stroke-width="1.5"><path d="M5 12H3l9-9"/><circle cx="12" cy="12" r="3"/><rect x="2" y="2" width="4" height="4" rx="1"/></g><polygon fill="currentColor" fill-rule="evenodd" points="1,1 2,2 3,1"/>""");
        var second = Ok(first.Markup);
        Assert.Equal(first.Markup, second.Markup);
    }

    // ------------------------------------------------------------------------------------------------ hostile bodies

    public static IEnumerable<object[]> Hostile =>
    [
        ["""<path d="M0 0h4v4z"/><script>alert(1)</script>"""],
        ["""<path d="M0 0h4v4z"/><foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>"""],
        ["""<use href="#a"/>"""],
        ["""<use xlink:href="http://evil.test/x.svg#a" xmlns:xlink="http://www.w3.org/1999/xlink"/>"""],
        ["""<image href="https://evil.test/x.png" width="10" height="10"/>"""],
        ["""<text x="1" y="1">Hallo</text>"""],
        ["""<style>path{fill:red}</style><path d="M0 0h4v4z"/>"""],
        ["""<path style="fill:red" d="M0 0h4v4z"/>"""],
        ["""<defs><linearGradient id="g"><stop offset="0" stop-color="#000"/></linearGradient></defs><path fill="url(#g)" d="M0 0h4v4z"/>"""],
        ["""<path fill="url(#g)" d="M0 0h4v4z"/>"""],
        ["""<path stroke="url( https://evil.test/p )" d="M0 0h4v4z"/>"""],
        ["""<mask id="m"><path d="M0 0h4v4z"/></mask><path mask="url(#m)" d="M0 0h8v8z"/>"""],
        ["""<path clip-path="url(#c)" d="M0 0h4v4z"/>"""],
        ["""<path filter="url(#f)" d="M0 0h4v4z"/>"""],
        ["""<path transform="rotate(45)" d="M0 0h4v4z"/>"""],
        ["""<g transform="translate(2 2)"><path d="M0 0h4v4z"/></g>"""],
        ["""<path onclick="alert(1)" d="M0 0h4v4z"/>"""],
        ["""<path onload="alert(1)" d="M0 0h4v4z"/>"""],
        ["""<svg><path d="M0 0h4v4z"/></svg>"""],
        ["""<a href="javascript:alert(1)"><path d="M0 0h4v4z"/></a>"""],
        ["""<path d="M0 0h4v4z"/>&xxe;"""],
        ["""<!DOCTYPE x [<!ENTITY a "b">]><path d="M0 0h4v4z"/>"""],
        ["""<path d="M0 0 L javascript:alert(1)"/>"""],
        ["""<path d="M0 0h4v4z" fill="red" marker-start="url(#m)"/>"""],
        ["""<path d="M0 0h4v4z"><script>alert(1)</script></path>"""],
        ["""<path d="M0 0h4v4z"></g>"""],
        ["""<path d="M0 0h4v4z"/><path"""],
        ["""<circle cx="a" cy="1" r="2"/>"""],
        ["""<rect x="1" y="1" width="1e999999" height="5"/>"""],
        ["""<path stroke-width="-1" stroke="currentColor" d="M0 0h4v4z"/>"""],
        ["""<path stroke-width="abc" stroke="currentColor" d="M0 0h4v4z"/>"""],
        ["""<animate attributeName="x"/>"""],
        ["""<title>Nur ein Titel</title>"""],
        [""],
        ["   "],
    ];

    [Theory]
    [MemberData(nameof(Hostile))]
    public void A_hostile_or_unsupported_body_is_refused_whole(string body) => Refused(body);

    [Fact]
    public void A_body_that_is_too_big_has_too_many_parts_or_nests_too_deep_is_refused()
    {
        Refused("<path d=\"M0 0h4v4z\"/>" + new string(' ', IconBodies.MaxBodyChars));
        Refused(string.Concat(Enumerable.Repeat("<path d=\"M0 0h4v4z\"/>", IconBodies.MaxShapes + 1)));
        Refused(string.Concat(Enumerable.Repeat("<g>", IconBodies.MaxDepth + 2)) + "<path d=\"M0 0h4v4z\"/>" + string.Concat(Enumerable.Repeat("</g>", IconBodies.MaxDepth + 2)));
        Refused("<path d=\"M" + new string('1', IconBodies.MaxPathChars + 1) + "\"/>");
    }

    [Theory]
    [InlineData(0, 24)]
    [InlineData(24, 0)]
    [InlineData(-5, 24)]
    [InlineData(5000, 24)]
    [InlineData(double.NaN, 24)]
    [InlineData(24, double.PositiveInfinity)]
    public void A_grid_that_makes_no_sense_is_refused(double w, double h)
    {
        Assert.Null(IconBodies.Parse("<path d=\"M0 0h4v4z\"/>", w, h, out var reason));
        Assert.NotEmpty(reason);
    }

    [Fact]
    public void Only_checked_shapes_ever_reach_the_markup_and_the_thumbnail_svg_has_no_active_content()
    {
        var icon = Ok("""<g data-evil="1" class="a" id="b"><path d="M0 0h4v4z" id="p" class="c" data-x="1" fill="currentColor"/></g>""");
        var svg = IconBodies.ToSvg(icon);
        Assert.DoesNotContain("evil", svg);
        Assert.DoesNotContain("class", svg);
        Assert.DoesNotContain("<script", svg);
        Assert.StartsWith("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\">", svg);
        Assert.DoesNotContain("currentColor", svg);   // an img cannot inherit a colour: the thumbnail has one
    }

    // ------------------------------------------------------------------------------------------------ the name in a document

    [Theory]
    [InlineData("mdi:home", "mdi:home")]
    [InlineData("fa7-solid:house-chimney", "fa7-solid:house-chimney")]
    [InlineData("heart", "heart")]
    [InlineData("MDI:home", "")]
    [InlineData("mdi:Home", "")]
    [InlineData("mdi:", "")]
    [InlineData(":home", "")]
    [InlineData("a:b:c", "")]
    [InlineData("mdi/home", "")]
    [InlineData("mdi:home ", "")]
    [InlineData("../x:y", "")]
    public void The_name_of_an_icon_may_have_a_set_in_front(string name, string expected)
    {
        var json = $$"""{"schema":2,"unit":"mm","width":50,"height":50,"pages":[{"id":"p","elements":[{"id":"a","type":"icon","icon":"{{name}}"}]}]}""";
        var element = DocumentValidator.Validate(json).Document!.Pages[0].Elements[0];
        Assert.Equal(expected, ((IconElement)element).Icon);
    }
}
