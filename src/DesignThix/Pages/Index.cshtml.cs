using DesignThix.Data.Entities;
using DesignThix.Logic;

namespace DesignThix.Pages;

/// <summary>The start page: counts, the designs worked on last, quick actions. Recent outputs follow with their phase.</summary>
public sealed class IndexModel(Biz biz) : PageModelBase
{
    public string Greeting { get; private set; } = "";

    public bool IsAdmin => biz.IsAdmin;

    public bool CanEdit => biz.IsDesigner;

    public UserRole Role => biz.User.Role ?? UserRole.Viewer;

    public SystemLogic.Facts? Facts { get; private set; }

    public DesignLogic.Counts Counts { get; private set; } = new(0, 0, 0, 0, 0);

    public IReadOnlyList<DesignRow> Recent { get; private set; } = [];

    public async Task OnGetAsync()
    {
        Head("Start", $"Guten Tag, {biz.User.Name}.", ("Start", null));
        Greeting = biz.User.Name ?? "";
        Counts = await DesignLogic.CountsAsync(biz);
        Recent = await DesignLogic.RecentAsync(biz, 6);
        if (biz.IsAdmin)
        {
            Facts = await SystemLogic.FactsAsync(biz);
        }
    }
}
