using System.Text.Json;
using MatCan.Logic;

namespace MatCan.UiKit;

/// <summary>What the brand kit control (<c>_BrandKit.cshtml</c>, <c>js/brand.js</c>) needs: the kit of one area, the fonts it may use, whether the person may change it, and the state for the script.</summary>
public sealed record BrandPageView(BrandView Brand, IReadOnlyList<string> Families, bool CanEdit, string StateJson, long SpaceId, string BackHref, string ReadOnlyText)
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    /// <summary>The kit of an area the person is a member of (their personal area when <paramref name="spaceId"/> is null). <paramref name="canEdit"/> says whether the buttons are there; the logic checks again on save.</summary>
    public static async Task<BrandPageView> BuildAsync(Biz biz, long? spaceId, bool canEdit, string backHref, string readOnlyText)
    {
        var brand = await BrandLogic.GetAsync(biz, spaceId);
        var families = await BrandLogic.FamiliesAsync(biz, brand.SpaceId);
        var state = JsonSerializer.Serialize(new
        {
            colors = brand.Kit.Colors,
            fonts = new { heading = brand.Kit.Fonts.Heading, subheading = brand.Kit.Fonts.Subheading, body = brand.Kit.Fonts.Body },
            logos = brand.LogoAssets.Select(a => new { key = a.Key, name = a.Name, url = a.Url }),
            maxColors = BrandLogic.MaxColors,
            maxLogos = BrandLogic.MaxLogos,
        }, Web);
        return new BrandPageView(brand, families, canEdit, state, brand.SpaceId, backHref, readOnlyText);
    }
}
