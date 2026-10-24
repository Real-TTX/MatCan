using DesignThix.Data.Entities;
using DesignThix.Logic;

namespace DesignThix.Pages;

/// <summary>The start page: a first dashboard. Recent designs, outputs and counts follow with the pages they link to.</summary>
public sealed class IndexModel(Biz biz) : PageModelBase
{
    public string Greeting { get; private set; } = "";

    public bool IsAdmin => biz.IsAdmin;

    public UserRole Role => biz.User.Role ?? UserRole.Viewer;

    public SystemLogic.Facts? Facts { get; private set; }

    public async Task OnGetAsync()
    {
        Head("Start", $"Guten Tag, {biz.User.Name}.", ("Start", null));
        Greeting = biz.User.Name ?? "";
        if (biz.IsAdmin)
        {
            Facts = await SystemLogic.FactsAsync(biz);
        }
    }
}
