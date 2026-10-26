using System.Reflection;
using DesignThix.Logic;
using DesignThix.Tests.Core;

namespace DesignThix.Tests.Web;

/// <summary>
/// The rule "a new method of the business layer goes into a test" as a test: every public static method of <c>DesignThix.Logic</c> that takes a <see cref="Biz"/> must be named as <c>Class.Method</c> in at least
/// one other test file (the tables of <c>PermissionTests</c>, the matrix of <c>AccessTests</c>, <c>SecurityReviewTests</c> and the tests of every feature). A method that is not named there is either missing
/// from the tables of what is refused to whom, or belongs in <see cref="Exempt"/> with the reason - a decision somebody makes on purpose, not a method that was forgotten. Needs no database.
/// </summary>
public sealed class LogicCoverageTests
{
    /// <summary>Methods that are no rule of their own: helpers that other methods call after their own check, reads that only describe what the caller may already see, and the methods of a person's own account.</summary>
    private static readonly Dictionary<string, string> Exempt = new()
    {
        // the building blocks of Access itself are what AccessTests and PermissionTests measure through every method that uses them
        ["Access.MemberSpaces"] = "building block: the spaces of the person",
        ["Access.PlaceAsync"] = "building block of the pages (covered through FolderLogic.PlaceAsync and the others)",
        ["Access.RequireSpaceRole"] = "building block: the area tables of PermissionTests call it through every method",
        ["Access.RoleInAsync"] = "building block",
        ["Access.CopyTargetAsync"] = "building block of the copy methods (PermissionTests: CopyAsync, DuplicateAsync)",
        ["Access.PlacementAsync"] = "building block of the create and move methods (area table of PermissionTests)",
        ["Access.RequireAsync"] = "THE check: every row of PermissionTests measures it",
        ["Access.SharedWithMe"] = "building block of the browser query (BrowserTests)",
        ["Access.VisibleInSpaces"] = "building block of the lists of fonts and sheets",
        ["Access.WritableSpaceAsync"] = "building block of the create methods (area table of PermissionTests)",
        ["Access.WritableSpaces"] = "building block of the dialogs",
        ["AssetRefs.RequireUsableAsync"] = "building block of the save rule (KeyGuessingTests save through it)",
        ["AssetRefs.UnavailableAsync"] = "building block of the save rule",
        ["AssetRefs.UsableAsync"] = "building block of the resolve rule",
        ["AssetLogic.Query"] = "a query over Access.Visible: what the person sees",
        ["AssetLogic.UsedCategoriesAsync"] = "a list over what the person sees",
        ["AiLogic.ReasonFor"] = "text of a refusal",
        ["AiLogic.SettingsLinkFor"] = "text of a refusal",
        ["AiLogic.SubjectsAsync"] = "a list over what the person may edit",
        ["AiProfileLogic.HasKey"] = "reads the settings of the administrator",
        ["DataListLogic.CountAsync"] = "a count over what the person sees",
        ["DesignLogic.CategoriesAsync"] = "a list over what the person sees",
        ["DesignLogic.CountsAsync"] = "a count over what the person sees",
        ["DesignLogic.ManageableAsync"] = "a list over what the person manages",
        ["DesignLogic.Query"] = "a query over Access.Visible",
        ["DesignLogic.Templates"] = "a query over what the person sees",
        ["FontLogic.CanManageAsync"] = "asks Access; the methods that change a font ask again",
        ["FontLogic.Query"] = "a query over Access.VisibleInSpaces",
        ["OutputLogic.CountAsync"] = "a count over what the person sees",
        ["OutputLogic.RecentAsync"] = "a list over what the person sees",
        ["SettingLogic.Get"] = "reads a setting",
        ["SettingLogic.KeepOrProtect"] = "keeps a secret protected",
        ["SettingLogic.SaveAsync"] = "administrator table of PermissionTests (SettingLogic.SaveAsync is named there)",
        ["SheetLogic.CanManageAsync"] = "asks Access; the methods that change a sheet ask again",
        ["SpaceLogic.WritableAsync"] = "the areas the person may write in",
        // a person's own account: they act on themselves
        ["UserLogic.ChangeOwnPasswordAsync"] = "own account",
        ["UserLogic.CreateFirstAdminAsync"] = "only while there is no administrator",
        ["UserLogic.EndMySessionAsync"] = "own account",
        ["UserLogic.MeAsync"] = "own account",
        ["UserLogic.MySessionsAsync"] = "own account",
        ["UserLogic.SaveProfileAsync"] = "own account",
        ["UserLogic.SetThemeAsync"] = "own account",
    };

    private static string TestsFolder()
    {
        var www = RepoFiles.WwwRoot();   // <repo>/src/DesignThix/wwwroot
        var repo = Directory.GetParent(www)!.Parent!.Parent!.FullName;
        return Path.Combine(repo, "tests", "DesignThix.Tests");
    }

    private static IEnumerable<(string Key, MethodInfo Method)> LogicMethods()
        => typeof(Biz).Assembly.GetTypes()
            .Where(t => t.Namespace == "DesignThix.Logic" && t.IsPublic && t.IsAbstract && t.IsSealed)
            .SelectMany(t => t.GetMethods(BindingFlags.Public | BindingFlags.Static | BindingFlags.DeclaredOnly)
                .Where(m => m.GetParameters() is { Length: > 0 } p && p[0].ParameterType == typeof(Biz))
                .Select(m => (t.Name + "." + m.Name, m)))
            .DistinctBy(x => x.Item1);

    [Fact]
    public void Every_method_of_the_business_layer_is_named_in_a_test_or_exempt_on_purpose()
    {
        var folder = TestsFolder();
        var sources = Directory.GetFiles(folder, "*.cs", SearchOption.AllDirectories)
            .Where(f => !f.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}") && !f.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}") && Path.GetFileName(f) != "LogicCoverageTests.cs")
            .Select(File.ReadAllText).ToList();
        var all = string.Join("\n", sources);
        var missing = LogicMethods().Select(x => x.Key).Where(k => !Exempt.ContainsKey(k) && !System.Text.RegularExpressions.Regex.IsMatch(all, System.Text.RegularExpressions.Regex.Escape(k) + @"\b")).Order().ToList();
        Assert.True(missing.Count == 0, "These methods of the business layer are in no test (add them to PermissionTests or a test of their own, or exempt them with a reason): " + string.Join(", ", missing));
    }

    [Fact]
    public void The_exemptions_name_methods_that_exist_and_are_not_tested_after_all()
    {
        var names = LogicMethods().Select(x => x.Key).ToHashSet();
        var gone = Exempt.Keys.Where(k => !names.Contains(k)).Order().ToList();
        Assert.True(gone.Count == 0, "Exempt methods that do not exist any more: " + string.Join(", ", gone));
    }
}
