using DesignThix.Data.Entities;
using DesignThix.Logic;

namespace DesignThix.UiKit;

/// <summary>What the header of a team page needs: the team, the tab that is open, the first members (names for the avatars) and the storage.</summary>
public sealed record TeamHeaderModel(SpaceRow Team, string Active, IReadOnlyList<string> MemberNames, StorageUsage? Storage, bool ShowHeading = true);

/// <summary>The tabs of a team page (docs/PLAN-PLATFORM.md section 1.12): Projekte, Mitglieder, Marke, Vorlagen and, for Owner and Admin, Einstellungen. Every tab is a page of its own.</summary>
public static class TeamTabs
{
    public const string Projects = "projekte";
    public const string Members = "mitglieder";
    public const string Brand = "marke";
    public const string Templates = "vorlagen";
    public const string Settings = "einstellungen";

    public static LinkTabsModel For(SpaceRow team, string active)
    {
        var baseUrl = $"/Teams/{team.Slug}";
        var tabs = new List<LinkTab>
        {
            new(Projects, "Projekte", $"{baseUrl}/Projekte", "folder"),
            new(Members, "Mitglieder", $"{baseUrl}/Mitglieder", "users", team.MemberCount),
            new(Brand, "Marke", $"{baseUrl}/Marke", "palette"),
            new(Templates, "Vorlagen", $"{baseUrl}/Vorlagen", "template"),
        };
        if (team.MyRole is SpaceRole.Owner or SpaceRole.Admin)
        {
            tabs.Add(new LinkTab(Settings, "Einstellungen", $"{baseUrl}/Einstellungen", "settings"));
        }

        return new LinkTabsModel("Team " + team.Name, tabs, active);
    }

    /// <summary>The line under the name of a team: members and the role of the person.</summary>
    public static string Sub(SpaceRow team)
        => $"{Ui.Plural(team.MemberCount, "Mitglied", "Mitglieder")}{(team.MyRole is { } role ? " · Deine Rolle: " + Labels.Of(role) : "")}";
}
