using MatCan.Logic;
using MatCan.UiKit;

namespace MatCan.Pages.Admin;

/// <summary>The facts of the installation.</summary>
public sealed class SystemModel(Biz biz) : PageModelBase
{
    public SystemLogic.Facts Facts { get; private set; } = null!;

    public string DataDir => biz.Config.DataDir;

    public async Task OnGetAsync()
    {
        Head("System", "Version, Datenbank und Datenvolume.", ("Verwaltung", null), ("System", null));
        Facts = await SystemLogic.FactsAsync(biz);
    }

    public string Version => AppVersion.Current;
}
