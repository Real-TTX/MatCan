namespace DesignThix.Core.Documents;

/// <summary>
/// The arithmetic of "Größe ändern": a new page size (and perhaps a new unit) for a document, with the content either scaled to the new page or left where it is.
/// Lengths are in the unit of the document (mm or px at 96 dpi); font sizes, outlines and borders of text and images are in points and so follow the scale but not
/// the unit.
/// </summary>
public static class DocumentResize
{
    private const double PxPerMm = 96 / 25.4;

    /// <summary>The factor that turns a length of <paramref name="from"/> into one of <paramref name="to"/> (both mm or px).</summary>
    public static double UnitFactor(string from, string to)
        => from == to ? 1 : from == "mm" ? PxPerMm : 1 / PxPerMm;

    /// <summary>
    /// The document on a page of <paramref name="width"/> x <paramref name="height"/> in <paramref name="unit"/>.
    /// With <paramref name="scale"/> everything of every page (positions, sizes, font sizes, stroke widths, radii, shadows) is multiplied by one factor, the largest that fits the
    /// content into the new page without distortion, and centred. Without it the content keeps its place (top left) and its physical size: only a change of the unit converts the numbers.
    /// The result is not validated; run it through <see cref="DocumentValidator.Normalize"/>.
    /// </summary>
    public static DesignDocument Resize(DesignDocument document, double width, double height, string unit, bool scale)
    {
        var targetUnit = unit == "px" ? "px" : "mm";
        var unitFactor = UnitFactor(document.Unit, targetUnit);
        double factor = 1;
        double length = unitFactor;
        double offsetX = 0;
        double offsetY = 0;
        if (scale && document.Width > 0 && document.Height > 0)
        {
            factor = Math.Min(width / (document.Width * unitFactor), height / (document.Height * unitFactor));
            length = unitFactor * factor;
            offsetX = (width - (document.Width * length)) / 2;
            offsetY = (height - (document.Height * length)) / 2;
        }

        var map = new Mapper(length, factor, offsetX, offsetY);
        var pages = document.Pages.Select(page => page with { Elements = [.. page.Elements.Select(map.Element)] }).ToList();
        return document with { Unit = targetUnit, Width = width, Height = height, Pages = pages };
    }

    private sealed class Mapper(double length, double points, double offsetX, double offsetY)
    {
        private static double R(double value) => Math.Round(value, 4);

        public DesignElement Element(DesignElement element)
        {
            var scaled = element with
            {
                X = R((element.X * length) + offsetX),
                Y = R((element.Y * length) + offsetY),
                W = R(element.W * length),
                H = R(element.H * length),
                Shadow = element.Shadow is { } shadow ? shadow with { Blur = R(shadow.Blur * length), X = R(shadow.X * length), Y = R(shadow.Y * length) } : null,
            };
            return scaled switch
            {
                TextElement t => t with
                {
                    FontSize = R(t.FontSize * points),
                    MinFontSize = R(t.MinFontSize * points),
                    Outline = t.Outline is { } o ? o with { Width = R(o.Width * points) } : null,
                    Background = t.Background is { } b ? b with { Radius = R(b.Radius * length), Padding = R(b.Padding * length) } : null,
                },
                ImageElement i => i with { Radius = R(i.Radius * length), Border = i.Border is { } b ? b with { Width = R(b.Width * points) } : null },
                ImageStripElement s => s with { Gap = R(s.Gap * length), Border = s.Border is { } b ? b with { Width = R(b.Width * points) } : null },
                ShapeElement p => p with { StrokeWidth = R(p.StrokeWidth * length), Radius = R(p.Radius * length) },
                GroupElement g => g with { Children = [.. g.Children.Select(Element)] },
                _ => scaled,
            };
        }
    }
}
