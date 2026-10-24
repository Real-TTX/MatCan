using System.Net;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.Services;
using Microsoft.Extensions.Caching.Memory;

namespace DesignThix.UiKit;

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

    public string Tagline { get; init; } = "Etiketten gestalten";

    /// <summary>"light" or "dark" when the user chose one; null follows the system.</summary>
    public string? Theme { get; init; }

    public string HomeHref { get; init; } = "/";

    /// <summary>The optional attributes of &lt;html&gt;, written only when they have a value (an empty data-theme would count as a choice).</summary>
    public string RootAttributes => Theme is "light" or "dark" ? $"data-theme=\"{WebUtility.HtmlEncode(Theme)}\"" : string.Empty;
}

/// <summary>Builds the shell for the person who is signed in: the settings menu only for administrators.</summary>
public sealed class ShellFactory(ICurrentUser user, IHttpContextAccessor accessor)
{
    public Task<ShellModel> BuildAsync()
    {
        var principal = accessor.HttpContext?.User;
        var theme = principal?.FindFirst(AppClaims.Theme)?.Value;

        var menus = new List<NavSet> { WorkMenu() };
        if (user.IsAdmin)
        {
            menus.Add(AdminMenu());
        }

        return Task.FromResult(new ShellModel
        {
            Menus = menus,
            UserName = user.Name ?? "Gast",
            UserRole = user.Role is { } role ? Labels.Of(role) : "",
            UserLine = principal?.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value ?? "",
            UserMenu = UserMenu(),
            Version = $"DesignThix {AppVersion.Current}",
            Theme = theme,
        });
    }

    /// <summary>The shell of a page without a menu (sign-in, setup).</summary>
    public static ShellModel Bare(string? theme = null) => new()
    {
        Menus = [new NavSet("none", "DesignThix", "home", [])],
        Version = $"DesignThix {AppVersion.Current}",
        Theme = theme,
    };

    /// <summary>
    /// The main menu of docs/PLAN.md section 1.4 as far as its pages exist: "Neues Design" (primary action, only for people who may change things),
    /// Start, and the groups Gestalten, Daten, Bibliothek and Ausgabe.
    /// </summary>
    private NavSet WorkMenu()
    {
        var start = new List<NavItem>();
        if (user.Role is UserRole.Admin or UserRole.Designer)
        {
            start.Add(new("Neues Design", "/Designs/Create", "plus", Primary: true));
        }

        start.Add(new("Start", "/", "dashboard"));
        return new NavSet("main", "Gestalten", "palette",
        [
            new(null, start),
            new("Gestalten",
            [
                new("Designs", "/Designs", "layers"),
                new("Vorlagen", "/Designs?filter=templates", "template"),
            ]),
            new("Daten",
            [
                new("Datenlisten", "/DataLists", "table"),
            ]),
            new("Bibliothek",
            [
                new("Medien", "/Assets", "image"),
                new("Schriften", "/Fonts", "type"),
            ]),
            new("Ausgabe",
            [
                new("Ausgaben", "/Outputs", "dt:printer"),
                new("Druckbögen", "/Sheets", "grid"),
            ]),
        ]);
    }

    private static NavSet AdminMenu() => new("admin", "Verwaltung", "settings",
    [
        new(null,
        [
            new("Benutzer", "/Admin/Users", "users"),
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

    private static List<UserMenuItem> UserMenu() =>
    [
        new("Profil", "/Account/Profile", "user"),
        new("Sicherheit", "/Account/Security", "shield"),
        new("Abmelden", "/Account/Logout", "logout", Danger: true, SeparatorBefore: true, Post: true),
    ];
}
