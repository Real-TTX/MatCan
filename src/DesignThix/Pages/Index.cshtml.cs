using DesignThix.Data.Entities;
using DesignThix.Logic;

namespace DesignThix.Pages;

/// <summary>
/// The start page (docs/PLAN-CANVA.md section 1.1): "Was möchtest du heute gestalten?", a search over designs and templates, the format tiles, a row of templates, the designs
/// worked on last, and at the bottom the key figures. A viewer sees no tiles and read-only actions.
/// </summary>
public sealed class IndexModel(Biz biz) : PageModelBase
{
    /// <summary>How many templates the row on the start page shows (the page "Vorlagen" has them all).</summary>
    public const int TemplatesShown = 8;

    /// <summary>How many recent designs the grid shows.</summary>
    public const int RecentShown = 12;

    [Microsoft.AspNetCore.Mvc.BindProperty(SupportsGet = true)]
    public string? Q { get; set; }

    public string Greeting { get; private set; } = "";

    public bool IsAdmin => biz.IsAdmin;

    /// <summary>Everybody who is signed in makes designs (in their own area), so the tiles and buttons that make one are always there.</summary>
    public bool CanEdit => true;

    public UserRole Role => biz.User.Role ?? UserRole.Member;

    /// <summary>The designs shown that the person manages (the tile offers duplicate, rename and delete only for these).</summary>
    public IReadOnlySet<long> Manageable { get; private set; } = new HashSet<long>();

    public SystemLogic.Facts? Facts { get; private set; }

    public DesignLogic.Counts Counts { get; private set; } = new(0, 0, 0, 0, 0);

    public IReadOnlyList<DesignRow> Recent { get; private set; } = [];

    public IReadOnlyList<DesignRow> Templates { get; private set; } = [];

    /// <summary>The result of a search (null when there was no search).</summary>
    public DesignLogic.SearchResult? Search { get; private set; }

    public int OutputCount { get; private set; }

    public IReadOnlyList<OutputRow> RecentOutputs { get; private set; } = [];

    public async Task OnGetAsync()
    {
        Head("Start", null, ("Start", null));
        ViewData["OwnHead"] = true;
        Greeting = biz.User.Name ?? "";
        Counts = await DesignLogic.CountsAsync(biz);
        OutputCount = await OutputLogic.CountAsync(biz);
        if (!string.IsNullOrWhiteSpace(Q))
        {
            Search = await DesignLogic.SearchAsync(biz, Q);
            Manageable = await DesignLogic.ManageableAsync(biz, Search.Designs.Concat(Search.Templates).Select(d => d.Id));
        }
        else
        {
            Recent = await DesignLogic.RecentAsync(biz, RecentShown);
            Templates = await DesignLogic.FeaturedTemplatesAsync(biz, TemplatesShown);
            Manageable = await DesignLogic.ManageableAsync(biz, Recent.Concat(Templates).Select(d => d.Id));
            RecentOutputs = await OutputLogic.RecentAsync(biz, 3);
        }

        if (biz.IsAdmin)
        {
            Facts = await SystemLogic.FactsAsync(biz);
        }
    }
}
