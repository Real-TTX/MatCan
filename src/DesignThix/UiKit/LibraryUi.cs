using System.Net;
using DesignThix.Logic;
using Microsoft.AspNetCore.Html;

namespace DesignThix.UiKit;

/// <summary>The small pieces of markup that the library pages share: thumbnails of media and designs, the specimen of a font.</summary>
public static class LibraryUi
{
    private static string E(string? text) => WebUtility.HtmlEncode(text ?? "");

    /// <summary>The picture of an asset at a small size (a table cell, a tile).</summary>
    public static IHtmlContent AssetThumb(AssetRow asset, string size = "sm")
        => new HtmlString($"<span class=\"dt-thumb dt-thumb--{size}\"><img src=\"{E(asset.Url)}\" alt=\"\" loading=\"lazy\" decoding=\"async\" /></span>");

    /// <summary>A name with a thumbnail before it, for a table cell.</summary>
    public static IHtmlContent AssetCell(AssetRow asset, string href)
        => new HtmlString($"<span class=\"dt-assetcell\">{AssetThumb(asset).ToHtml()}<span class=\"dt-assetcell__text\"><a href=\"{E(href)}\">{E(asset.Name)}</a><small class=\"mat-muted dt-sub mat-mono\">{E(asset.Key)}</small></span></span>");

    /// <summary>
    /// The picture of a design: the thumbnail the designer saved, or (without one) a box that the script draws with the render engine
    /// (<c>data-dt-preview</c> and the id of the design; see library.js).
    /// </summary>
    public static IHtmlContent DesignThumb(DesignRow design)
    {
        var url = design.ThumbnailUrl;
        return new HtmlString(url is null
            ? $"<span class=\"dt-designthumb\" data-dt-preview=\"{design.Id}\" data-dt-preview-url=\"/api/designs/{design.Id}\" aria-hidden=\"true\"></span>"
            : $"<span class=\"dt-designthumb\"><img src=\"{E(url)}\" alt=\"\" loading=\"lazy\" decoding=\"async\" /></span>");
    }

    /// <summary>The line that shows a font: the script sets the family, weight and style (data-dt-specimen) through the CSSOM.</summary>
    public static IHtmlContent Specimen(FontRow font, string text = "Käse für Genießer 0123 €")
        => new HtmlString($"<span class=\"dt-specimen\" data-dt-specimen data-family=\"{E(font.Family)}\" data-weight=\"{E(font.Weight)}\" data-style=\"{E(font.Style)}\">{E(text)}</span>");
}
