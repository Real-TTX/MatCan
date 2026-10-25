using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.Services;
using Microsoft.Extensions.DependencyInjection;

namespace DesignThix.Tests.Integration;

/// <summary>
/// The rule "every logic method checks the permission itself", for every method of the business layer that writes (or reads what only administrators may read),
/// as a table: a viewer is refused by every designer method, a designer is refused by every administrator method, the allowed role is not refused (it may fail
/// with a message about the made-up id, which is fine: only <see cref="ForbiddenException"/> is the point). Runs when DESIGNTHIX_TEST_DB names a server.
/// </summary>
[Collection("app")]
public sealed class PermissionTests(AppTests.AppFactory factory)
{
    private const long Nobody = 987_654_321;

    private static bool Enabled => AppTests.AppFactory.Connection is not null;

    private static readonly byte[] Bytes = [1, 2, 3];

    private static readonly DesignLogic.NewDesign NewDesign = new("x", null, "a4-portrait", null, null, null, null);

    private static readonly OutputLogic.OutputInput OutputInput = new("x", Nobody, null, OutputRowSelection.All, [], 1, OutputMode.Single, null, false, OutputScale.Fit, 1, OutputFormat.Print, null, null);

    private static readonly AiProfileLogic.ProfileInput ProfileInput = new("", AiProvider.OpenAiCompatible, null, "", "", null, false, null);

    private static readonly UserLogic.UserInput UserInput = new("", "", null, UserRole.Viewer, true, null);

    private static Func<Biz, Task> Wrap(Action<Biz> call) => biz =>
    {
        call(biz);
        return Task.CompletedTask;
    };

    private static readonly Dictionary<string, Func<Biz, Task>> Designer = new()
    {
        ["AssetLogic.UploadAsync"] = biz => AssetLogic.UploadAsync(biz, "x.png", Bytes, null),
        ["AssetLogic.UpdateAsync"] = biz => AssetLogic.UpdateAsync(biz, Nobody, new AssetLogic.AssetInput("x", "x", "Sonstiges", null)),
        ["AssetLogic.ReplaceFileAsync"] = biz => AssetLogic.ReplaceFileAsync(biz, Nobody, Bytes),
        ["AssetLogic.DeleteAsync"] = biz => AssetLogic.DeleteAsync(biz, Nobody),
        ["FontLogic.UploadAsync"] = biz => FontLogic.UploadAsync(biz, "x.ttf", Bytes, null),
        ["FontLogic.UpdateAsync"] = biz => FontLogic.UpdateAsync(biz, Nobody, new FontLogic.FontInput("x", "400", "normal", null)),
        ["FontLogic.DeleteAsync"] = biz => FontLogic.DeleteAsync(biz, Nobody),
        ["SheetLogic.SaveAsync"] = biz => SheetLogic.SaveAsync(biz, null, new SheetLogic.SheetInput("", 210, 297, 0, 0, 1, 1, 100, 100, 0, 0, false)),
        ["SheetLogic.DeleteAsync"] = biz => SheetLogic.DeleteAsync(biz, Nobody),
        ["DataListLogic.SaveGeneralAsync"] = biz => DataListLogic.SaveGeneralAsync(biz, Nobody, new DataListLogic.ListInput("x", null, false)),
        ["DataListLogic.DeleteAsync"] = biz => DataListLogic.DeleteAsync(biz, Nobody),
        ["DataListLogic.DuplicateAsync"] = biz => DataListLogic.DuplicateAsync(biz, Nobody),
        ["DataListLogic.SaveColumnsAsync"] = biz => DataListLogic.SaveColumnsAsync(biz, Nobody, []),
        ["DataListLogic.AddColumnsFromDesignAsync"] = biz => DataListLogic.AddColumnsFromDesignAsync(biz, Nobody, Nobody),
        ["DataListLogic.SaveRowsAsync"] = biz => DataListLogic.SaveRowsAsync(biz, Nobody, 1, []),
        ["DataListLogic.PreviewImportAsync"] = biz => DataListLogic.PreviewImportAsync(biz, Nobody, "a", true),
        ["DataListLogic.ImportAsync"] = biz => DataListLogic.ImportAsync(biz, Nobody, new DataListLogic.ImportRequest("a", true, [], false)),
        ["DesignLogic.CreateAsync"] = biz => DesignLogic.CreateAsync(biz, NewDesign with { Name = "" }),
        ["DesignLogic.UpdatePropertiesAsync"] = biz => DesignLogic.UpdatePropertiesAsync(biz, Nobody, new DesignLogic.DesignInput("x", null, null, false)),
        ["DesignLogic.DuplicateAsync"] = biz => DesignLogic.DuplicateAsync(biz, Nobody),
        ["DesignLogic.RenameAsync"] = biz => DesignLogic.RenameAsync(biz, Nobody, "x"),
        ["DesignLogic.CopyWithDocumentAsync"] = biz => DesignLogic.CopyWithDocumentAsync(biz, Nobody, "{}"),
        ["DesignLogic.DeleteAsync"] = biz => DesignLogic.DeleteAsync(biz, Nobody),
        ["DesignLogic.SaveDocumentAsync"] = biz => DesignLogic.SaveDocumentAsync(biz, Nobody, 1, "{}"),
        ["DesignLogic.RestoreAsync"] = biz => DesignLogic.RestoreAsync(biz, Nobody, 1),
        ["DesignLogic.SaveThumbnailAsync"] = biz => DesignLogic.SaveThumbnailAsync(biz, Nobody, Bytes),
        ["DesignLogic.CreateFromFormatAsync"] = biz => DesignLogic.CreateFromFormatAsync(biz, "no-such-format", null, null, null, null),
        ["DesignLogic.UseTemplateAsync"] = biz => DesignLogic.UseTemplateAsync(biz, Nobody),
        ["DesignLogic.ResizeAsync"] = biz => DesignLogic.ResizeAsync(biz, Nobody, 100, 100, "mm", true),
        ["AssetLogic.RequireUploader"] = Wrap(biz => AssetLogic.RequireUploader(biz)),
        ["BrandLogic.SaveAsync"] = biz => BrandLogic.SaveAsync(biz, new BrandKit { Colors = ["no colour"] }),
        ["DesignPackageLogic.ExportAsync"] = biz => DesignPackageLogic.ExportAsync(biz, Nobody),
        ["DesignPackageLogic.ImportAsync"] = biz => DesignPackageLogic.ImportAsync(biz, Bytes),
        ["OutputLogic.SaveAsync"] = biz => OutputLogic.SaveAsync(biz, null, OutputInput with { Name = "" }),
        ["OutputLogic.DeleteAsync"] = biz => OutputLogic.DeleteAsync(biz, Nobody),
        ["AiDataLogic.ImportPromptAsync"] = biz => AiDataLogic.ImportPromptAsync(biz, Nobody, new AiDataLogic.ImportInput("a", null)),
        ["AiDataLogic.ProposeImportAsync"] = biz => AiDataLogic.ProposeImportAsync(biz, Nobody, new AiDataLogic.ImportInput("a", null)),
        ["AiDataLogic.FillPromptAsync"] = biz => AiDataLogic.FillPromptAsync(biz, Nobody, new AiDataLogic.FillInput([1], "A", null, "x")),
        ["AiDataLogic.ProposeFillAsync"] = biz => AiDataLogic.ProposeFillAsync(biz, Nobody, new AiDataLogic.FillInput([1], "A", null, "x")),
        ["AiDataLogic.ProposalAsync"] = biz => AiDataLogic.ProposalAsync(biz, Nobody),
        ["AiDataLogic.ApplyAsync"] = biz => AiDataLogic.ApplyAsync(biz, Nobody, null),
        ["AiDataLogic.DiscardAsync"] = biz => AiDataLogic.DiscardAsync(biz, Nobody),
        ["AiTextLogic.PromptAsync"] = biz => AiTextLogic.PromptAsync(biz, Nobody, new AiTextLogic.SuggestInput("x", null, null, null, null, null, null)),
        ["AiTextLogic.SuggestAsync"] = biz => AiTextLogic.SuggestAsync(biz, Nobody, new AiTextLogic.SuggestInput("x", null, null, null, null, null, null)),
        ["AiLogic.UndoAsync"] = biz => AiLogic.UndoAsync(biz, Nobody),
        ["AiLogic.RunsOfAsync"] = biz => AiLogic.RunsOfAsync(biz, nameof(DataList), Nobody),
    };

    private static readonly Dictionary<string, Func<Biz, Task>> Admin = new()
    {
        ["UserLogic.Query"] = Wrap(biz => UserLogic.Query(biz)),
        ["UserLogic.DetailsAsync"] = biz => UserLogic.DetailsAsync(biz, Nobody),
        ["UserLogic.SaveAsync"] = biz => UserLogic.SaveAsync(biz, Nobody, UserInput),
        ["UserLogic.DeleteAsync"] = biz => UserLogic.DeleteAsync(biz, Nobody),
        ["UserLogic.UnlockAsync"] = biz => UserLogic.UnlockAsync(biz, Nobody),
        ["UserLogic.ResetTotpAsync"] = biz => UserLogic.ResetTotpAsync(biz, Nobody),
        ["UserLogic.EndSessionsAsync"] = biz => UserLogic.EndSessionsAsync(biz, Nobody, null),
        ["SettingLogic.SaveAsync"] = biz => SettingLogic.SaveAsync(biz, "Site", new SiteSettings(), "Test"),
        ["SystemLogic.FactsAsync"] = biz => SystemLogic.FactsAsync(biz),
        ["SystemLogic.Activity"] = Wrap(biz => SystemLogic.Activity(biz)),
        ["AiProfileLogic.ListAsync"] = biz => AiProfileLogic.ListAsync(biz),
        ["AiProfileLogic.GetAsync"] = biz => AiProfileLogic.GetAsync(biz, Nobody),
        ["AiProfileLogic.SaveAsync"] = biz => AiProfileLogic.SaveAsync(biz, null, ProfileInput),
        ["AiProfileLogic.ActivateAsync"] = biz => AiProfileLogic.ActivateAsync(biz, Nobody),
        ["AiProfileLogic.DuplicateAsync"] = biz => AiProfileLogic.DuplicateAsync(biz, Nobody),
        ["AiProfileLogic.DeleteAsync"] = biz => AiProfileLogic.DeleteAsync(biz, Nobody),
        ["AiProfileLogic.StartChatGptLoginAsync"] = biz => AiProfileLogic.StartChatGptLoginAsync(biz, Nobody),
        ["AiProfileLogic.ChatGptStatusAsync"] = biz => AiProfileLogic.ChatGptStatusAsync(biz, Nobody),
        ["AiProfileLogic.ChatGptLogoutAsync"] = biz => AiProfileLogic.ChatGptLogoutAsync(biz, Nobody),
        ["AiProfileLogic.MoveChatGptLoginAsync"] = biz => AiProfileLogic.MoveChatGptLoginAsync(biz, Nobody, Nobody),
        ["AiLogic.TestAsync"] = biz => AiLogic.TestAsync(biz, null),
        ["AiLogic.FullInstruction"] = Wrap(biz => AiLogic.FullInstruction(biz, AiAction.Test)),
        ["AiLogic.Runs"] = Wrap(biz => AiLogic.Runs(biz)),
        ["AiLogic.RunDetailsAsync"] = biz => AiLogic.RunDetailsAsync(biz, Nobody),
        ["AiLogic.ContinueAsync"] = biz => AiLogic.ContinueAsync(biz, Nobody, null),
        ["AiLogic.UsageAsync"] = biz => AiLogic.UsageAsync(biz),
    };

    /// <summary>Methods that administrators and designers may call (a viewer is refused).</summary>
    public static TheoryData<string> DesignerMethods { get; } = Names(Designer);

    /// <summary>Methods that only administrators may call (designers and viewers are refused).</summary>
    public static TheoryData<string> AdminMethods { get; } = Names(Admin);

    private static TheoryData<string> Names(IReadOnlyDictionary<string, Func<Biz, Task>> table)
    {
        var data = new TheoryData<string>();
        foreach (var name in table.Keys)
        {
            data.Add(name);
        }

        return data;
    }

    /// <summary>Methods that would really call the model for an administrator (and count against the limits the AI tests measure): only the refusals are tried.</summary>
    private static readonly HashSet<string> RefusalsOnly = ["AiLogic.TestAsync"];

    private async Task<Exception?> Try(UserRole role, Func<Biz, Task> call)
    {
        using var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope();
        using var acting = scope.ServiceProvider.GetRequiredService<ICurrentUser>().RunAs(Nobody, "Test", role);
        try
        {
            await call(scope.ServiceProvider.GetRequiredService<Biz>());
            return null;
        }
        catch (Exception ex)
        {
            return ex;
        }
    }

    private static void AssertNotRefused(string name, UserRole role, Exception? error)
        => Assert.False(error is ForbiddenException, $"{name} refused a {role}: {error?.Message}");

    private static void AssertRefused(string name, UserRole role, Exception? error)
        => Assert.True(error is ForbiddenException, $"{name} did not refuse a {role}: {error?.GetType().Name} {error?.Message}");

    [Theory]
    [MemberData(nameof(DesignerMethods))]
    public async Task A_designer_method_refuses_a_viewer_and_lets_designers_and_administrators_in(string name)
    {
        if (!Enabled)
        {
            return;
        }

        var call = Designer[name];
        AssertRefused(name, UserRole.Viewer, await Try(UserRole.Viewer, call));
        AssertNotRefused(name, UserRole.Designer, await Try(UserRole.Designer, call));
        AssertNotRefused(name, UserRole.Admin, await Try(UserRole.Admin, call));
    }

    [Theory]
    [MemberData(nameof(AdminMethods))]
    public async Task An_administrator_method_refuses_designers_and_viewers(string name)
    {
        if (!Enabled)
        {
            return;
        }

        var call = Admin[name];
        AssertRefused(name, UserRole.Viewer, await Try(UserRole.Viewer, call));
        AssertRefused(name, UserRole.Designer, await Try(UserRole.Designer, call));
        if (!RefusalsOnly.Contains(name))
        {
            AssertNotRefused(name, UserRole.Admin, await Try(UserRole.Admin, call));
        }
    }

    [Fact]
    public async Task Everything_that_a_person_who_is_signed_in_may_do_is_open_to_viewers()
    {
        if (!Enabled)
        {
            return;
        }

        Dictionary<string, Func<Biz, Task>> reading = new()
        {
            ["DesignLogic.LoadAsync"] = biz => DesignLogic.LoadAsync(biz, Nobody),
            ["DesignLogic.CountAsync"] = biz => DesignLogic.CountAsync(biz),
            ["DataListLogic.GridAsync"] = biz => DataListLogic.GridAsync(biz, Nobody),
            ["DataListLogic.ExportCsvAsync"] = biz => DataListLogic.ExportCsvAsync(biz, Nobody),
            ["AssetLogic.SearchAsync"] = biz => AssetLogic.SearchAsync(biz, null, "uploads", 5, "new"),
            ["DesignLogic.TemplatesAsync"] = biz => DesignLogic.TemplatesAsync(biz),
            ["BrandLogic.GetAsync"] = biz => BrandLogic.GetAsync(biz),
            ["BrandLogic.FamiliesAsync"] = biz => BrandLogic.FamiliesAsync(biz),
            ["FontLogic.AllAsync"] = biz => FontLogic.AllAsync(biz),
            ["OutputLogic.PayloadAsync"] = biz => OutputLogic.PayloadAsync(biz, Nobody),
            ["OutputLogic.MarkRanAsync"] = biz => OutputLogic.MarkRanAsync(biz, Nobody),
        };
        foreach (var (name, call) in reading)
        {
            AssertNotRefused(name, UserRole.Viewer, await Try(UserRole.Viewer, call));
        }
    }
}
