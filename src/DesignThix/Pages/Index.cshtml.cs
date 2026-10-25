using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.UiKit;

namespace DesignThix.Pages;

/// <summary>
/// The start page (docs/PLAN-CANVA.md section 1.1, docs/PLAN-PLATFORM.md section 1.4): "Was möchtest du heute gestalten?", a search over everything the person may see, the format tiles, a row of
/// templates, what they used last ("Zuletzt verwendet": the file browser in the mode "recent"), and at the bottom the key figures.
/// </summary>
public sealed class IndexModel(Biz biz) : PageModelBase
{
    /// <summary>How many templates the row on the start page shows (the page "Vorlagen" has them all).</summary>
    public const int TemplatesShown = 8;

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

    /// <summary>The row "Zuletzt verwendet" (null while searching).</summary>
    public BrowserView? RecentView { get; private set; }

    /// <summary>The hits of a search among the person's own things (null when there was no search or nothing was found).</summary>
    public BrowserView? FoundView { get; private set; }

    public bool NothingFound { get; private set; }

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
            Manageable = await DesignLogic.ManageableAsync(biz, Search.Templates.Select(d => d.Id));
            var found = await ItemLogic.QueryAsync(biz, new ItemQuery { Q = Search.Text, Recursive = true, ExcludeTemplates = true, Take = 1 });
            if (found.Total > 0)
            {
                FoundView = await BrowserViews.ForSearchAsync(biz, Search.Text);
            }

            NothingFound = found.Total == 0 && Search.Templates.Count == 0;
        }
        else
        {
            RecentView = await BrowserViews.ForRecentAsync(biz);
            Templates = await DesignLogic.FeaturedTemplatesAsync(biz, TemplatesShown);
            Manageable = await DesignLogic.ManageableAsync(biz, Templates.Select(d => d.Id));
            RecentOutputs = await OutputLogic.RecentAsync(biz, 3);
        }

        if (biz.IsAdmin)
        {
            Facts = await SystemLogic.FactsAsync(biz);
        }
    }
}
