using System.Net;
using MatCan.Data.Entities;
using MatCan.Logic;
using MatCan.Services;
using Microsoft.Extensions.Caching.Memory;

namespace MatCan.UiKit;

/// <summary>An entry of the user's context menu. A <see cref="Post"/> item changes something (sign out): a button of a small form, not a link.</summary>
public sealed record UserMenuItem(string Title, string Href, string Icon, bool Danger = false, bool SeparatorBefore = false, bool Post = false);

/// <summary>Everything the layout needs to draw the shell around a page: the menus, the user, the version.</summary>
public sealed class ShellModel
{
    public IReadOnlyList<NavSet> Menus { get; init; } = [];

    public bool HasSwitcher => Menus.Count > 1;

    public NavSet CurrentMenu(string? active) => Menus.FirstOrDefault(m => m.Contains(active)) ?? Menus[0];

    public string UserName { get; init; } = "";

    public string UserRole { get; init; } = "";

    public string UserLine { get; init; } = "";

    public IReadOnlyList<UserMenuItem> UserMenu { get; init; } = [];

    public string Version { get; init; } = "";

    public string Tagline { get; init; } = "Gestalten, drucken, teilen";

    /// <summary>Whether the person may start designs (designers and administrators): the menu offers "Design erstellen" and every page carries the dialog of it.</summary>
    public bool CanCreate { get; init; }

    /// <summary>Whether the AI design assistant is on and set up for this person: the start page and the dialog "Design erstellen" offer "Mit KI entwerfen" only then.</summary>
    public bool AiDesign { get; init; }

    /// <summary>The areas the person is a member of: their personal area first, then their teams (the menu lists the teams; the dialog "Design erstellen" offers the ones they may write in).</summary>
    public IReadOnlyList<SpaceRow> Spaces { get; init; } = [];

    public IReadOnlyList<SpaceRow> Teams => [.. Spaces.Where(s => s.Kind == SpaceKind.Team)];

    /// <summary>Where a new design may go ("Speichern in"): the personal area and the teams where the person is Owner, Admin or Editor.</summary>
    public IReadOnlyList<SpaceRow> WritableSpaces => [.. Spaces.Where(s => s.MyRole is { } role && role != SpaceRole.Viewer)];

    /// <summary>"light" or "dark" when the user chose one; null follows the system.</summary>
    public string? Theme { get; init; }

    public string HomeHref { get; init; } = "/";

    /// <summary>The optional attributes of &lt;html&gt;, written only when they have a value (an empty data-theme would count as a choice).</summary>
    public string RootAttributes => Theme is "light" or "dark" ? $"data-theme=\"{WebUtility.HtmlEncode(Theme)}\"" : string.Empty;
}

/// <summary>Builds the shell for the person who is signed in: the settings menu only for administrators.</summary>
public sealed class ShellFactory(ICurrentUser user, IHttpContextAccessor accessor, Biz biz)
{
    public async Task<ShellModel> BuildAsync()
    {
        var principal = accessor.HttpContext?.User;
        var theme = principal?.FindFirst(AppClaims.Theme)?.Value;
        IReadOnlyList<SpaceRow> spaces = user.UserId is not null ? await SpaceLogic.MySpacesAsync(biz) : [];

        var menus = new List<NavSet> { WorkMenu(spaces, user.UserId is not null && SpaceLogic.MayCreateTeam(biz)) };
        if (user.IsAdmin)
        {
            menus.Add(AdminMenu(await UserLogic.PendingCountAsync(biz)));
        }

        return new ShellModel
        {
            Menus = menus,
            Spaces = spaces,
            UserName = user.Name ?? "Gast",
            UserRole = user.Role is { } role ? Labels.Of(role) : "",
            UserLine = principal?.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value ?? "",
            UserMenu = UserMenu(user.UserId is not null && (user.IsAdmin || biz.Platform.MembersMayInvite)),
            CanCreate = user.UserId is not null,
            AiDesign = user.UserId is not null && await AiLogic.IsAvailableAsync(biz),
            Version = $"MatCan {AppVersion.Current}",
            Theme = theme,
        };
    }

    /// <summary>The shell of a page without a menu (sign-in, setup).</summary>
    public static ShellModel Bare(string? theme = null) => new()
    {
        Menus = [new NavSet("none", "MatCan", "home", [])],
        Version = $"MatCan {AppVersion.Current}",
        Theme = theme,
    };

    /// <summary>
    /// The main menu (docs/PLAN-PLATFORM.md section 1.19): "Design erstellen" (primary action; it opens the dialog with the format tiles, the link goes to the page of the same name), Start,
    /// Projekte, Freigegeben, Mit Stern; the group Teams (one entry per team of the person, then "Alle Teams"); Gestalten (Vorlagen, Designs); Bibliothek; the group "Serien (Zusatz)" with the
    /// features that fill a design from data; and at the end the Papierkorb.
    /// </summary>
    private static NavSet WorkMenu(IReadOnlyList<SpaceRow> spaces, bool mayCreateTeam)
    {
        var start = new List<NavItem>
        {
            // every member makes designs (in their own area or a team's)
            new("Design erstellen", "/Designs/Create", "plus", Primary: true),
            new("Start", "/", "dashboard"),
            new("Projekte", "/Projekte", "folder"),
            new("Freigegeben", "/Freigegeben", "dt:share-2"),
            new("Mit Stern", "/Mit-Stern", "star"),
        };
        var teams = spaces.Where(s => s.Kind == SpaceKind.Team && !string.IsNullOrEmpty(s.Slug)).Select(s => new NavItem(s.Name, $"/Teams/{s.Slug}/Projekte", "users")).ToList();
        if (mayCreateTeam)
        {
            teams.Add(new NavItem("Team erstellen", "/Teams/Create", "plus"));
        }

        teams.Add(new NavItem("Alle Teams", "/Teams", "dt:users-round"));
        return new NavSet("main", "Gestalten", "palette",
        [
            new(null, start),
            new("Teams", teams),
            new("Gestalten",
            [
                new("Vorlagen", "/Templates", "template"),
                new("Designs", "/Designs", "layers"),
            ]),
            new("Bibliothek",
            [
                new("Uploads & Medien", "/Assets", "image"),
                new("Marke", "/Brand", "palette"),
                new("Schriften", "/Fonts", "type"),
            ]),
            new("Serien (Zusatz)",
            [
                new("Datenlisten", "/DataLists", "table"),
                new("Serienausgaben", "/Outputs", "dt:printer"),
                new("Druckbögen", "/Sheets", "dt:tags"),
            ]),
            new("Aufräumen",
            [
                new("Papierkorb", "/Papierkorb", "trash"),
            ]),
        ]);
    }

    private static NavSet AdminMenu(int pendingAccounts) => new("admin", "Verwaltung", "settings",
    [
        new(null,
        [
            new("Benutzer", "/Admin/Users", "users", pendingAccounts > 0 ? NavBadge.Count(pendingAccounts, "warn", "warten auf Freigabe") : null),
            new("Teams", "/Admin/Teams", "dt:users-round"),
        ]),
        new("Einstellungen",
        [
            new("Plattform", "/Admin/Platform", "sliders"),
            new("E-Mail", "/Admin/Mail", "mail"),
            new("Kataloge", "/Admin/Catalogs", "dt:images"),
        ]),
        new("KI",
        [
            new("Einstellungen", "/Admin/Ai", "sliders"),
            new("Profile", "/Admin/Ai/Profiles", "plug"),
            new("Läufe", "/Admin/Ai/Runs", "activity"),
        ]),
        new("System",
        [
            new("Aktivitäten", "/Admin/Activity", "clock"),
            new("System", "/Admin/System", "server"),
        ]),
    ]);

    private static List<UserMenuItem> UserMenu(bool mayInvite)
    {
        var items = new List<UserMenuItem>
        {
            new("Profil", "/Account/Profile", "user"),
            new("Benachrichtigungen", "/Account/Notifications", "bell"),
        };
        if (mayInvite)
        {
            items.Add(new UserMenuItem("Einladungen", "/Account/Invitations", "mail"));
        }

        items.Add(new UserMenuItem("Sicherheit", "/Account/Security", "shield"));
        items.Add(new UserMenuItem("Abmelden", "/Account/Logout", "logout", Danger: true, SeparatorBefore: true, Post: true));
        return items;
    }
}
