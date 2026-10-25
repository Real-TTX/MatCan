using System.Text.Json;
using DesignThix.Logic;

namespace DesignThix.Pages.Brand;

/// <summary>The brand kit (Marke): the colours, the three fonts and the logos that the designs of the team share. Everybody reads it, designers and administrators change it.</summary>
public sealed class IndexModel(Biz biz) : PageModelBase
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    public BrandView Brand { get; private set; } = null!;

    public IReadOnlyList<string> Families { get; private set; } = [];

    public bool CanEdit => biz.IsDesigner;

    /// <summary>The state the script starts from (attribute <c>data-brand</c>): colours, fonts, logos with their addresses.</summary>
    public string StateJson { get; private set; } = "{}";

    public async Task OnGetAsync()
    {
        Head("Marke", "Farben, Schriften und Logos deiner Marke: Sie stehen im Designer bereit, damit jedes Design gleich aussieht.", ("Bibliothek", null), ("Marke", null));
        Brand = await BrandLogic.GetAsync(biz);
        Families = await BrandLogic.FamiliesAsync(biz);
        StateJson = JsonSerializer.Serialize(new
        {
            colors = Brand.Kit.Colors,
            fonts = new { heading = Brand.Kit.Fonts.Heading, subheading = Brand.Kit.Fonts.Subheading, body = Brand.Kit.Fonts.Body },
            logos = Brand.LogoAssets.Select(a => new { key = a.Key, name = a.Name, url = a.Url }),
            maxColors = BrandLogic.MaxColors,
            maxLogos = BrandLogic.MaxLogos,
        }, Web);
    }
}
