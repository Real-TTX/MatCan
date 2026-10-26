using DesignThix.Logic;
using Microsoft.AspNetCore.Mvc;

namespace DesignThix.Pages.Templates;

/// <summary>
/// The gallery of templates (docs/PLAN-TEMPLATES.md section 2): one tile per family of variants, navigation by occasion and format, search over names, tags and descriptions. The page is the shell
/// (heading, fields, containers); <c>js/templates.js</c> loads the tiles from <c>/api/templates/gallery</c> and pages them. The query string (<c>q</c>, <c>occasion</c>, <c>format</c>) is only
/// handed to the script, which keeps it up to date. "Vorlage verwenden" copies a template, "Vorlage ansehen" opens the preview with all pages and the variants.
/// </summary>
public sealed class IndexModel : PageModelBase
{
    [BindProperty(SupportsGet = true)]
    public string? Q { get; set; }

    [BindProperty(SupportsGet = true)]
    public string? Occasion { get; set; }

    [BindProperty(SupportsGet = true)]
    public string? Format { get; set; }

    public void OnGet()
    {
        Head("Vorlagen", "Fertige Entwürfe zum Anpassen: Du bekommst eine Kopie, die Vorlage bleibt, wie sie ist.", ("Gestalten", null), ("Vorlagen", null));
        ViewData["ActiveHref"] = "/Templates";
        Q = Q is { Length: > 100 } ? Q[..100] : Q;
    }
}
