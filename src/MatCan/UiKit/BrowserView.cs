using System.Text.Json;
using MatCan.Data.Entities;
using MatCan.Logic;

namespace MatCan.UiKit;

/// <summary>A step of the path above the browser. A step with <see cref="DropSpaceId"/> accepts what is dragged onto it (the area, or the folder when <see cref="DropFolderId"/> is set).</summary>
public sealed record BrowserCrumb(string Text, string? Url, long? DropSpaceId = null, long? DropFolderId = null);

/// <summary>
/// Everything the file browser control (<c>_Browser.cshtml</c>, <c>js/browser.js</c>) needs from the page that holds it: what it lists (the mode), where, the path above it, what the person may do
/// here, and the address of the folders. The script reads it from data attributes and asks <c>/api/items</c> for the items.
/// </summary>
public sealed record BrowserView
{
    /// <summary>"space" (an area or one of its folders; also a folder that was shared with the person), "shared", "starred", "trash", "recent" or "search".</summary>
    public string Mode { get; init; } = "space";

    /// <summary>The scope of <c>/api/items</c> (space, shared, starred, trash, recent).</summary>
    public string Scope { get; init; } = "space";

    public long? SpaceId { get; init; }

    public long? FolderId { get; init; }

    public string Title { get; init; } = "";

    public string? Sub { get; init; }

    public IReadOnlyList<BrowserCrumb> Crumbs { get; init; } = [];

    /// <summary>Whether the person may put things here (the "Neu" menu, dropping files): they may write in the area or the folder.</summary>
    public bool CanCreate { get; init; }

    /// <summary>Whether the person may share the folder that is open (the button in the header).</summary>
    public bool CanShare { get; init; }

    public string? FolderName { get; init; }

    /// <summary>Where the folders of the area open: "/Projekte" or "/Teams/{slug}/Projekte".</summary>
    public string BaseUrl { get; init; } = "/Projekte";

    /// <summary>The areas of the person with the address of their browser (JSON for the script: it opens a folder of any area at the right address).</summary>
    public string SpacesJson { get; init; } = "[]";

    public StorageUsage? Storage { get; init; }

    public string StorageName { get; init; } = "";

    public string EmptyIcon { get; init; } = "folder-open";

    public string EmptyTitle { get; init; } = "Hier ist noch nichts";

    public string EmptyText { get; init; } = "";

    public string? Hint { get; init; }

    /// <summary>Only these kinds, comma separated (the search of the start page).</summary>
    public string? Kinds { get; init; }

    public string? Q { get; init; }

    public int Take { get; init; } = 60;

    /// <summary>A bare list without the toolbar (the row of the start page).</summary>
    public bool Compact { get; init; }

    public bool Toolbar { get; init; } = true;

    public bool ExcludeTemplates { get; init; }

    public int TrashDays { get; init; } = 30;

    public string Id { get; init; } = "dt-browser";

    /// <summary>A team area: its tabs (Projekte, Mitglieder ...) are drawn under the header, and its colour and members next to the name.</summary>
    public LinkTabsModel? Tabs { get; init; }

    public string? TeamColor { get; init; }

    /// <summary>The name of the team (the badge shows its initials); the title may be the name of a folder inside it.</summary>
    public string TeamName { get; init; } = "";

    public IReadOnlyList<string> TeamMembers { get; init; } = [];
}

/// <summary>Builds the <see cref="BrowserView"/> of each page that holds a browser.</summary>
public static class BrowserViews
{
    public const string PersonalBase = "/Projekte";

    public static string TeamBase(string slug) => $"/Teams/{slug}/Projekte";

    private static string SpacesJson(IEnumerable<SpaceRow> spaces)
        => JsonSerializer.Serialize(spaces.Select(s => new { id = s.Id, kind = s.Kind == SpaceKind.Personal ? "personal" : "team", name = s.Kind == SpaceKind.Personal ? SpaceLogic.PersonalName : s.Name, @base = s.Kind == SpaceKind.Personal ? PersonalBase : TeamBase(s.Slug ?? "") }), new JsonSerializerOptions(JsonSerializerDefaults.Web));

    /// <summary>The base address of the browser of an area the person is a member of.</summary>
    public static string BaseOf(SpaceRow space) => space.Kind == SpaceKind.Personal ? PersonalBase : TeamBase(space.Slug ?? "");

    /// <summary>An area (top level or a folder inside it): the person is a member of it.</summary>
    public static async Task<BrowserView> ForSpaceAsync(Biz biz, SpaceRow space, long? folderId)
    {
        var spaces = await SpaceLogic.MySpacesAsync(biz);
        var baseUrl = BaseOf(space);
        var canWrite = space.MyRole is { } role && role != SpaceRole.Viewer;
        var crumbs = new List<BrowserCrumb>();
        string title = space.Kind == SpaceKind.Personal ? SpaceLogic.PersonalName : space.Name;
        string? folderName = null;
        var canShare = false;
        if (folderId is { } folder)
        {
            var place = await FolderLogic.PlaceAsync(biz, folder);
            canWrite = place.CanEdit;
            canShare = place.CanEdit;
            var chain = await FolderLogic.BreadcrumbAsync(biz, folder);
            crumbs.Add(new BrowserCrumb(space.Kind == SpaceKind.Personal ? SpaceLogic.PersonalName : space.Name, baseUrl, space.Id, null));
            foreach (var step in chain)
            {
                var last = step.Id == folder;
                crumbs.Add(new BrowserCrumb(step.Name, last ? null : $"{baseUrl}/Ordner/{step.Id}", space.Id, step.Id));
                if (last)
                {
                    folderName = step.Name;
                    title = step.Name;
                }
            }
        }
        else
        {
            crumbs.Add(new BrowserCrumb(title, null, space.Id, null));
        }

        var team = space.Kind == SpaceKind.Team;
        return new BrowserView
        {
            Mode = "space",
            Scope = "space",
            Tabs = team ? TeamTabs.For(space, TeamTabs.Projects) : null,
            TeamColor = team ? space.Color : null,
            TeamName = team ? space.Name : "",
            TeamMembers = team ? await SpaceLogic.MemberNamesAsync(biz, space.Id, 5) : [],
            Sub = team ? TeamTabs.Sub(space) : null,
            SpaceId = space.Id,
            FolderId = folderId,
            Title = title,
            Crumbs = crumbs,
            CanCreate = canWrite,
            CanShare = canShare,
            FolderName = folderName,
            BaseUrl = baseUrl,
            SpacesJson = SpacesJson(spaces),
            Storage = await StorageLogic.UsageAsync(biz, space.Id),
            StorageName = space.Kind == SpaceKind.Personal ? SpaceLogic.PersonalName : space.Name,
            EmptyIcon = "folder-open",
            EmptyTitle = folderId is null ? "Hier ist noch nichts" : "Dieser Ordner ist leer",
            EmptyText = canWrite ? "Lege mit „Neu“ ein Design, einen Ordner oder eine Datenliste an, oder ziehe Bilder aus dem Explorer hierher." : "In diesem Bereich darfst du nur ansehen.",
        };
    }

    /// <summary>A folder of an area the person is no member of: it was shared with them, and the path starts at the folder they were given.</summary>
    public static async Task<BrowserView> ForSharedFolderAsync(Biz biz, long folderId)
    {
        var spaces = await SpaceLogic.MySpacesAsync(biz);
        var place = await FolderLogic.PlaceAsync(biz, folderId);
        var chain = await FolderLogic.BreadcrumbAsync(biz, folderId);
        var crumbs = new List<BrowserCrumb> { new("Freigegeben", "/Freigegeben") };
        string title = "";
        foreach (var step in chain)
        {
            var last = step.Id == folderId;
            crumbs.Add(new BrowserCrumb(step.Name, last ? null : $"/Freigegeben/Ordner/{step.Id}", null, null));
            if (last)
            {
                title = step.Name;
            }
        }

        return new BrowserView
        {
            Mode = "shared",
            Scope = "space",
            FolderId = folderId,
            Title = title,
            Crumbs = crumbs,
            CanCreate = place.CanEdit,
            CanShare = place.CanEdit,
            FolderName = title,
            BaseUrl = "/Freigegeben",
            SpacesJson = SpacesJson(spaces),
            EmptyIcon = "folder-open",
            EmptyTitle = "Dieser Ordner ist leer",
            EmptyText = place.CanEdit ? "Du darfst hier etwas ablegen: Lege mit „Neu“ etwas an." : "Du darfst diesen Ordner nur ansehen.",
        };
    }

    public static async Task<BrowserView> ForSharedAsync(Biz biz) => new()
    {
        Mode = "shared",
        Scope = "shared",
        Title = "Freigegeben",
        Sub = "Alles, was andere mit dir geteilt haben: direkt, über ein Team oder über einen Link, den du geöffnet hast.",
        Crumbs = [new BrowserCrumb("Freigegeben", null)],
        BaseUrl = "/Freigegeben",
        SpacesJson = SpacesJson(await SpaceLogic.MySpacesAsync(biz)),
        EmptyIcon = "dt:share-2",
        EmptyTitle = "Noch nichts freigegeben",
        EmptyText = "Wenn jemand ein Design, einen Ordner oder eine Datenliste mit dir teilt, siehst du es hier.",
    };

    public static async Task<BrowserView> ForStarredAsync(Biz biz) => new()
    {
        Mode = "starred",
        Scope = "starred",
        Title = "Mit Stern",
        Sub = "Was du mit einem Stern markiert hast, ordentlich beieinander.",
        Crumbs = [new BrowserCrumb("Mit Stern", null)],
        SpacesJson = SpacesJson(await SpaceLogic.MySpacesAsync(biz)),
        EmptyIcon = "star",
        EmptyTitle = "Noch nichts mit Stern",
        EmptyText = "Markiere Designs, Ordner und Datenlisten über das Menü „⋯“ mit einem Stern, dann findest du sie hier schnell wieder.",
    };

    public static async Task<BrowserView> ForTrashAsync(Biz biz) => new()
    {
        Mode = "trash",
        Scope = "trash",
        Title = "Papierkorb",
        Crumbs = [new BrowserCrumb("Papierkorb", null)],
        SpacesJson = SpacesJson(await SpaceLogic.MySpacesAsync(biz)),
        EmptyIcon = "trash",
        EmptyTitle = "Der Papierkorb ist leer",
        EmptyText = "Was du löschst, liegt hier noch eine Weile und lässt sich zurückholen.",
        TrashDays = biz.Platform.TrashDays,
    };

    /// <summary>The row "Zuletzt verwendet" of the start page.</summary>
    public static async Task<BrowserView> ForRecentAsync(Biz biz) => new()
    {
        Id = "dt-recent",
        Mode = "recent",
        Scope = "recent",
        Title = "Zuletzt verwendet",
        SpacesJson = SpacesJson(await SpaceLogic.MySpacesAsync(biz)),
        Compact = true,
        Toolbar = false,
        Take = 12,
        Kinds = "design,datalist,outputjob",
        ExcludeTemplates = true,
        EmptyIcon = "layers",
        EmptyTitle = "Noch nichts verwendet",
        EmptyText = "Wähle oben ein Format oder eine Vorlage: Dein erstes Design ist in einem Klick angelegt. Was du öffnest oder änderst, steht danach hier.",
    };

    /// <summary>The hits of the search of the start page: everything the person may see (templates have their own section).</summary>
    public static async Task<BrowserView> ForSearchAsync(Biz biz, string q) => new()
    {
        Id = "dt-found",
        Mode = "search",
        Scope = "space",
        Title = "Gefunden",
        Q = q,
        SpacesJson = SpacesJson(await SpaceLogic.MySpacesAsync(biz)),
        Compact = true,
        Toolbar = false,
        Take = 48,
        ExcludeTemplates = true,
        EmptyIcon = "search-x",
        EmptyTitle = "Nichts gefunden",
        EmptyText = "Die Suche schaut in die Namen deiner Designs, Ordner, Datenlisten, Serienausgaben und Bilder.",
    };
}
