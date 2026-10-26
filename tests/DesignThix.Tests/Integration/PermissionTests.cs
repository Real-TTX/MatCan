using DesignThix.Catalogs;
using DesignThix.Core.Documents;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.Services;
using DesignThix.Tests.Core;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DesignThix.Tests.Integration;

/// <summary>
/// The rule "every logic method checks the access itself", as tables on top of the access rules of <see cref="Access"/> (the matrix of <see cref="AccessTests"/> says what a level means; this says that
/// EVERY method of the business layer that reads, writes or manages asks for it). Three tables:
/// <list type="bullet">
/// <item>methods that work on one item, each with the level it needs: a stranger gets a 404, somebody who may only view a 403 when the method needs more, the one with the right level is not refused;</item>
/// <item>methods that make something in an area, or change the area itself, each with the team role it needs;</item>
/// <item>methods only a platform administrator may call (a member is refused, the administrator is not), and what nobody who is not signed in may call.</item>
/// </list>
/// A method that is not refused may still fail with a message about the made-up input (a design that does not exist for a job, a stale revision): only <see cref="ForbiddenException"/> and
/// <see cref="NotFoundException"/> are the point. Runs when DESIGNTHIX_TEST_DB names a server.
/// </summary>
[Collection("app")]
public sealed class PermissionTests(AppTests.AppFactory factory) : PlatformTestBase(factory)
{
    private const long Nobody = 987_654_321;

    private static readonly byte[] Bytes = [1, 2, 3];

    private static byte[] Png() => File.ReadAllBytes(Path.Combine(RepoFiles.WwwRoot(), "img", "icon-192.png"));

    private static byte[] FakeFont(byte marker) => [0, 1, 0, 0, marker, 2, 3, 4, 5, 6, 7, 8];

    private static readonly string EmptyDocument = DocumentValidator.ToJson(DocumentValidator.Create(100, 100));

    private static OutputLogic.OutputInput JobInput(long designId)
        => new("x", designId, null, OutputRowSelection.All, [], 1, OutputMode.Single, null, false, OutputScale.Fit, 1, OutputFormat.Print, null, null);

    // ------------------------------------------------------------------------------------------------ methods on one item

    private sealed record ItemMethod(string Name, ItemKind Kind, AccessLevel Needs, Func<Biz, long, long, Task> Call);

    /// <summary>The methods that work on one item. The second id is another person (to share with).</summary>
    private static readonly ItemMethod[] ItemMethods =
    [
        // designs
        new("DesignLogic.DocumentAsync", ItemKind.Design, AccessLevel.View, (biz, id, _) => DesignLogic.DocumentAsync(biz, id)),
        new("DesignLogic.RevisionsAsync", ItemKind.Design, AccessLevel.View, (biz, id, _) => DesignLogic.RevisionsAsync(biz, id)),
        new("DesignLogic.DuplicateAsync", ItemKind.Design, AccessLevel.View, (biz, id, _) => DesignLogic.DuplicateAsync(biz, id)),
        new("DesignLogic.CopyWithDocumentAsync", ItemKind.Design, AccessLevel.View, (biz, id, _) => DesignLogic.CopyWithDocumentAsync(biz, id, EmptyDocument)),
        new("DesignLogic.PlaceAsync", ItemKind.Design, AccessLevel.View, (biz, id, _) => DesignLogic.PlaceAsync(biz, id)),
        new("DesignLogic.ThumbnailHashAsync", ItemKind.Design, AccessLevel.View, (biz, id, _) => DesignLogic.ThumbnailHashAsync(biz, id)),
        new("DesignPackageLogic.ExportAsync", ItemKind.Design, AccessLevel.View, (biz, id, _) => DesignPackageLogic.ExportAsync(biz, id)),
        new("OutputLogic.AdhocPayloadAsync", ItemKind.Design, AccessLevel.View, (biz, id, _) => OutputLogic.AdhocPayloadAsync(biz, new AdhocRequest(id, null, 1, null, null, false, null, 1, null, null, null))),
        new("AssetRefs.ResolveAsync(design)", ItemKind.Design, AccessLevel.View, (biz, id, _) => AssetRefs.ResolveAsync(biz, ItemKind.Design, id, ["flag-de"])),
        new("CatalogLogic.CreditsAsync", ItemKind.Design, AccessLevel.View, (biz, id, _) => CatalogLogic.CreditsAsync(biz, id)),
        new("ShareLogic.InfoAsync(design)", ItemKind.Design, AccessLevel.View, (biz, id, _) => ShareLogic.InfoAsync(biz, ItemKind.Design, id)),
        new("PresenceLogic.BeatAsync", ItemKind.Design, AccessLevel.View, (biz, id, _) => PresenceLogic.BeatAsync(biz, id)),
        new("CommentLogic.ListAsync", ItemKind.Design, AccessLevel.View, (biz, id, _) => CommentLogic.ListAsync(biz, id)),
        new("CommentLogic.AddAsync", ItemKind.Design, AccessLevel.View, (biz, id, _) => CommentLogic.AddAsync(biz, id, new CommentInput("Hallo", null, null, null, null, null, null))),
        new("CommentLogic.MentionCandidatesAsync", ItemKind.Design, AccessLevel.View, (biz, id, _) => CommentLogic.MentionCandidatesAsync(biz, id, "a")),
        new("AccessRequestLogic.ListAsync", ItemKind.Design, AccessLevel.Manage, (biz, id, _) => AccessRequestLogic.ListAsync(biz, ItemKind.Design, id)),
        new("ItemLogic.StarAsync(design)", ItemKind.Design, AccessLevel.View, (biz, id, _) => ItemLogic.StarAsync(biz, ItemKind.Design, id, true)),
        new("DesignLogic.SaveDocumentAsync", ItemKind.Design, AccessLevel.Edit, (biz, id, _) => DesignLogic.SaveDocumentAsync(biz, id, 1, EmptyDocument)),
        new("DesignLogic.RenameAsync", ItemKind.Design, AccessLevel.Edit, (biz, id, _) => DesignLogic.RenameAsync(biz, id, "x")),
        new("DesignLogic.UpdatePropertiesAsync", ItemKind.Design, AccessLevel.Edit, (biz, id, _) => DesignLogic.UpdatePropertiesAsync(biz, id, new DesignLogic.DesignInput("x", null, null, false))),
        new("DesignLogic.SaveThumbnailAsync", ItemKind.Design, AccessLevel.Edit, (biz, id, _) => DesignLogic.SaveThumbnailAsync(biz, id, Png())),
        new("DesignLogic.RestoreAsync", ItemKind.Design, AccessLevel.Edit, (biz, id, _) => DesignLogic.RestoreAsync(biz, id, 1)),
        new("DesignLogic.ResizeAsync", ItemKind.Design, AccessLevel.Edit, (biz, id, _) => DesignLogic.ResizeAsync(biz, id, 100, 100, "mm", true)),
        new("AiTextLogic.PromptAsync", ItemKind.Design, AccessLevel.Edit, (biz, id, _) => AiTextLogic.PromptAsync(biz, id, new AiTextLogic.SuggestInput("x", null, null, null, null, null, null))),
        new("AiLogic.RunsOfAsync(design)", ItemKind.Design, AccessLevel.Edit, (biz, id, _) => AiLogic.RunsOfAsync(biz, nameof(Design), id)),

        // the design assistant (plan 4): reading needs View, everything that writes or asks the AI needs Edit
        new("AiAgentLogic.AvailabilityAsync", ItemKind.Design, AccessLevel.View, (biz, id, _) => AiAgentLogic.AvailabilityAsync(biz, id)),
        new("AiAgentLogic.SendAsync", ItemKind.Design, AccessLevel.Edit, (biz, id, _) => AiAgentLogic.SendAsync(biz, id, new AiAgentLogic.SendInput("", null, null, null, null))),
        new("AiAgentLogic.ConversationsAsync", ItemKind.Design, AccessLevel.Edit, (biz, id, _) => AiAgentLogic.ConversationsAsync(biz, id)),
        new("AiAgentLogic.PromptAsync", ItemKind.Design, AccessLevel.Edit, (biz, id, _) => AiAgentLogic.PromptAsync(biz, id, null)),
        new("AiAttachmentLogic.AcceptAsync", ItemKind.Design, AccessLevel.Edit, (biz, id, _) => AiAttachmentLogic.AcceptAsync(biz, 1, 1, id, [], [], 6)),
        new("AiDesignTools.RunAsync(read)", ItemKind.Design, AccessLevel.View, (biz, id, _) => AiDesignTools.RunAsync(biz, new AiToolSession { DesignId = id }, "read_design", new System.Text.Json.Nodes.JsonObject())),
        new("AiDesignTools.RunAsync(write)", ItemKind.Design, AccessLevel.Edit, (biz, id, _) => AiDesignTools.RunAsync(biz, new AiToolSession { DesignId = id }, "rename_design", new System.Text.Json.Nodes.JsonObject { ["name"] = "KI-Name" })),
        new("DesignLogic.SetTemplateAsync", ItemKind.Design, AccessLevel.Manage, (biz, id, _) => DesignLogic.SetTemplateAsync(biz, id, true)),
        new("ShareLogic.AddAsync(design)", ItemKind.Design, AccessLevel.Edit, (biz, id, other) => ShareLogic.AddAsync(biz, ItemKind.Design, id, false, other, SharePermission.View)),
        new("DesignLogic.DeleteAsync", ItemKind.Design, AccessLevel.Manage, (biz, id, _) => DesignLogic.DeleteAsync(biz, id)),
        new("DesignLogic.UpdatePropertiesAsync(template)", ItemKind.Design, AccessLevel.Manage, (biz, id, _) => DesignLogic.UpdatePropertiesAsync(biz, id, new DesignLogic.DesignInput("x", null, null, true))),
        new("ShareLogic.SetLinkAsync(design)", ItemKind.Design, AccessLevel.Manage, (biz, id, _) => ShareLogic.SetLinkAsync(biz, ItemKind.Design, id, LinkAudience.SignedIn, SharePermission.View, false, null)),
        new("ShareLogic.RevokeLinkAsync(design)", ItemKind.Design, AccessLevel.Manage, (biz, id, _) => ShareLogic.RevokeLinkAsync(biz, ItemKind.Design, id)),
        new("ShareLogic.ResetLinkAsync(design)", ItemKind.Design, AccessLevel.Manage, (biz, id, _) => ShareLogic.ResetLinkAsync(biz, ItemKind.Design, id)),
        new("ItemLogic.TrashAsync(design)", ItemKind.Design, AccessLevel.Manage, (biz, id, _) => ItemLogic.TrashAsync(biz, [new ItemRef(ItemKind.Design, id)])),
        new("ItemLogic.MoveAsync(design)", ItemKind.Design, AccessLevel.Manage, (biz, id, _) => ItemLogic.MoveAsync(biz, [new ItemRef(ItemKind.Design, id)], null, null)),
        new("ItemLogic.CopyAsync(design)", ItemKind.Design, AccessLevel.View, (biz, id, _) => ItemLogic.CopyAsync(biz, [new ItemRef(ItemKind.Design, id)], null, null)),

        // data lists
        new("DataListLogic.GridAsync", ItemKind.DataList, AccessLevel.View, (biz, id, _) => DataListLogic.GridAsync(biz, id)),
        new("DataListLogic.ExportCsvAsync", ItemKind.DataList, AccessLevel.View, (biz, id, _) => DataListLogic.ExportCsvAsync(biz, id)),
        new("DataListLogic.RowCountAsync", ItemKind.DataList, AccessLevel.View, (biz, id, _) => DataListLogic.RowCountAsync(biz, id)),
        new("DataListLogic.DuplicateAsync", ItemKind.DataList, AccessLevel.View, (biz, id, _) => DataListLogic.DuplicateAsync(biz, id)),
        new("DataListLogic.PlaceAsync", ItemKind.DataList, AccessLevel.View, (biz, id, _) => DataListLogic.PlaceAsync(biz, id)),
        new("AssetRefs.ResolveAsync(datalist)", ItemKind.DataList, AccessLevel.View, (biz, id, _) => AssetRefs.ResolveAsync(biz, ItemKind.DataList, id, ["flag-de"])),
        new("DataListLogic.SaveGeneralAsync(change)", ItemKind.DataList, AccessLevel.Edit, (biz, id, _) => DataListLogic.SaveGeneralAsync(biz, id, new DataListLogic.ListInput("x", null, false))),
        new("DataListLogic.SaveColumnsAsync", ItemKind.DataList, AccessLevel.Edit, (biz, id, _) => DataListLogic.SaveColumnsAsync(biz, id, [])),
        new("DataListLogic.AddColumnsFromDesignAsync", ItemKind.DataList, AccessLevel.Edit, (biz, id, _) => DataListLogic.AddColumnsFromDesignAsync(biz, id, Nobody)),
        new("DataListLogic.SaveRowsAsync", ItemKind.DataList, AccessLevel.Edit, (biz, id, _) => DataListLogic.SaveRowsAsync(biz, id, 1, [])),
        new("DataListLogic.PreviewImportAsync", ItemKind.DataList, AccessLevel.Edit, (biz, id, _) => DataListLogic.PreviewImportAsync(biz, id, "a", true)),
        new("DataListLogic.ImportAsync", ItemKind.DataList, AccessLevel.Edit, (biz, id, _) => DataListLogic.ImportAsync(biz, id, new DataListLogic.ImportRequest("a", true, [], false))),
        new("AiDataLogic.ImportPromptAsync", ItemKind.DataList, AccessLevel.Edit, (biz, id, _) => AiDataLogic.ImportPromptAsync(biz, id, new AiDataLogic.ImportInput("a", null))),
        new("AiDataLogic.FillPromptAsync", ItemKind.DataList, AccessLevel.Edit, (biz, id, _) => AiDataLogic.FillPromptAsync(biz, id, new AiDataLogic.FillInput([1], "A", null, "x"))),
        new("AiLogic.RunsOfAsync(datalist)", ItemKind.DataList, AccessLevel.Edit, (biz, id, _) => AiLogic.RunsOfAsync(biz, nameof(DataList), id)),
        new("DataListLogic.DeleteAsync", ItemKind.DataList, AccessLevel.Manage, (biz, id, _) => DataListLogic.DeleteAsync(biz, id)),

        // output jobs
        new("OutputLogic.MarkRanAsync", ItemKind.OutputJob, AccessLevel.View, (biz, id, _) => OutputLogic.MarkRanAsync(biz, id)),
        new("OutputLogic.PayloadAsync", ItemKind.OutputJob, AccessLevel.View, (biz, id, _) => OutputLogic.PayloadAsync(biz, id)),
        new("OutputLogic.PlaceAsync", ItemKind.OutputJob, AccessLevel.View, (biz, id, _) => OutputLogic.PlaceAsync(biz, id)),
        new("OutputLogic.SaveAsync(change)", ItemKind.OutputJob, AccessLevel.Edit, (biz, id, _) => OutputLogic.SaveAsync(biz, id, JobInput(Nobody))),
        new("OutputLogic.DeleteAsync", ItemKind.OutputJob, AccessLevel.Manage, (biz, id, _) => OutputLogic.DeleteAsync(biz, id)),

        // images
        new("ItemLogic.StarAsync(asset)", ItemKind.Asset, AccessLevel.View, (biz, id, _) => ItemLogic.StarAsync(biz, ItemKind.Asset, id, true)),
        new("AssetLogic.UpdateAsync", ItemKind.Asset, AccessLevel.Manage, (biz, id, _) => AssetLogic.UpdateAsync(biz, id, new AssetLogic.AssetInput("neu-" + Guid.NewGuid().ToString("N")[..6], "x", "Sonstiges", null))),
        new("AssetLogic.ReplaceFileAsync", ItemKind.Asset, AccessLevel.Manage, (biz, id, _) => AssetLogic.ReplaceFileAsync(biz, id, Png())),
        new("AssetLogic.DeleteAsync", ItemKind.Asset, AccessLevel.Manage, (biz, id, _) => AssetLogic.DeleteAsync(biz, id)),

        // folders
        new("FolderLogic.BreadcrumbAsync", ItemKind.Folder, AccessLevel.View, (biz, id, _) => FolderLogic.BreadcrumbAsync(biz, id)),
        new("FolderLogic.PlaceAsync", ItemKind.Folder, AccessLevel.View, (biz, id, _) => FolderLogic.PlaceAsync(biz, id)),
        new("FolderLogic.CreateAsync(inside)", ItemKind.Folder, AccessLevel.Edit, (biz, id, _) => FolderLogic.CreateAsync(biz, null, id, "unter")),
        new("ShareLogic.AddAsync(folder)", ItemKind.Folder, AccessLevel.Edit, (biz, id, other) => ShareLogic.AddAsync(biz, ItemKind.Folder, id, false, other, SharePermission.View)),
        new("FolderLogic.RenameAsync", ItemKind.Folder, AccessLevel.Manage, (biz, id, _) => FolderLogic.RenameAsync(biz, id, "x")),
        new("FolderLogic.UpdateAsync", ItemKind.Folder, AccessLevel.Manage, (biz, id, _) => FolderLogic.UpdateAsync(biz, id, "x", null)),
        new("FolderLogic.MoveAsync", ItemKind.Folder, AccessLevel.Manage, (biz, id, _) => FolderLogic.MoveAsync(biz, id, null, null)),
        new("ShareLogic.SetLinkAsync(folder)", ItemKind.Folder, AccessLevel.Manage, (biz, id, _) => ShareLogic.SetLinkAsync(biz, ItemKind.Folder, id, LinkAudience.Public, SharePermission.View, true, null)),
        new("ItemLogic.TrashAsync(folder)", ItemKind.Folder, AccessLevel.Manage, (biz, id, _) => ItemLogic.TrashAsync(biz, [new ItemRef(ItemKind.Folder, id)])),

        // what the file browser adds (P2): rename of every kind, copies next to the original
        new("ItemLogic.RenameAsync(design)", ItemKind.Design, AccessLevel.Edit, (biz, id, _) => ItemLogic.RenameAsync(biz, ItemKind.Design, id, "x")),
        new("ItemLogic.RenameAsync(datalist)", ItemKind.DataList, AccessLevel.Edit, (biz, id, _) => ItemLogic.RenameAsync(biz, ItemKind.DataList, id, "x")),
        new("ItemLogic.RenameAsync(outputjob)", ItemKind.OutputJob, AccessLevel.Edit, (biz, id, _) => ItemLogic.RenameAsync(biz, ItemKind.OutputJob, id, "x")),
        new("ItemLogic.RenameAsync(asset)", ItemKind.Asset, AccessLevel.Edit, (biz, id, _) => ItemLogic.RenameAsync(biz, ItemKind.Asset, id, "x")),
        new("ItemLogic.RenameAsync(folder)", ItemKind.Folder, AccessLevel.Manage, (biz, id, _) => ItemLogic.RenameAsync(biz, ItemKind.Folder, id, "x")),
        new("ItemLogic.DuplicateAsync(design)", ItemKind.Design, AccessLevel.View, (biz, id, _) => ItemLogic.DuplicateAsync(biz, [new ItemRef(ItemKind.Design, id)])),
        new("ItemLogic.DuplicateAsync(folder)", ItemKind.Folder, AccessLevel.View, (biz, id, _) => ItemLogic.DuplicateAsync(biz, [new ItemRef(ItemKind.Folder, id)])),
    ];

    public static TheoryData<string> ItemMethodNames
    {
        get
        {
            var data = new TheoryData<string>();
            foreach (var method in ItemMethods)
            {
                data.Add(method.Name);
            }

            return data;
        }
    }

    private async Task<long> MakeItemAsync(long owner, ItemKind kind)
    {
        var name = kind + " " + Guid.NewGuid().ToString("N")[..6];
        return await AsUser(owner, async biz => kind switch
        {
            ItemKind.Design => (await DesignLogic.CreateFromFormatAsync(biz, "a4-portrait", null, null, null, name)).Id,
            ItemKind.DataList => (await DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput(name, null, false))).Id,
            ItemKind.OutputJob => (await OutputLogic.SaveAsync(biz, null, JobInput((await DesignLogic.CreateFromFormatAsync(biz, "a4-portrait", null, null, null, name)).Id))).Id,
            ItemKind.Folder => (await FolderLogic.CreateAsync(biz, null, null, name)).Id,
            _ => (await AssetLogic.UploadAsync(biz, name.Replace(' ', '-') + ".png", Png(), null)).Asset!.Id,
        });
    }

    /// <summary>Runs the call as a person; null when it was not refused for lack of access (a message about the made-up input does not count).</summary>
    private async Task<Exception?> TryAsync(long person, Func<Biz, Task> call)
    {
        try
        {
            await AsUser(person, call);
            return null;
        }
        catch (Exception ex) when (ex is NotFoundException or ForbiddenException)
        {
            return ex;
        }
        catch (Exception)
        {
            return null;
        }
    }

    [Theory]
    [MemberData(nameof(ItemMethodNames))]
    public async Task A_method_on_an_item_asks_for_its_level(string name)
    {
        if (!Enabled)
        {
            return;
        }

        var method = ItemMethods.Single(m => m.Name == name);
        var owner = await UserAsync("owner");
        var editor = await UserAsync("editor");
        var viewer = await UserAsync("viewer");
        var stranger = await UserAsync("stranger");
        var other = await UserAsync("other");
        var id = await MakeItemAsync(owner, method.Kind);
        if (method.Kind != ItemKind.Asset)
        {
            await AsUser(owner, biz => ShareLogic.AddAsync(biz, method.Kind, id, false, editor, SharePermission.Edit));
            await AsUser(owner, biz => ShareLogic.AddAsync(biz, method.Kind, id, false, viewer, SharePermission.View));
        }

        var stranger404 = await TryAsync(stranger, biz => method.Call(biz, id, other));
        Assert.True(stranger404 is NotFoundException, $"{name}: a stranger should get a 404, got {stranger404?.GetType().Name ?? "no refusal"}");

        if (method.Kind != ItemKind.Asset)
        {
            var asViewer = await TryAsync(viewer, biz => method.Call(biz, id, other));
            Assert.True((method.Needs == AccessLevel.View) == asViewer is null, $"{name}: somebody who may only view {(method.Needs == AccessLevel.View ? "is let in" : "is refused with a 403")}, got {asViewer?.GetType().Name ?? "no refusal"}");
            if (method.Needs > AccessLevel.View)
            {
                Assert.IsType<ForbiddenException>(asViewer);
            }

            var asEditor = await TryAsync(editor, biz => method.Call(biz, id, other));
            Assert.True((method.Needs <= AccessLevel.Edit) == asEditor is null, $"{name}: somebody who may edit {(method.Needs <= AccessLevel.Edit ? "is let in" : "is refused with a 403")}, got {asEditor?.GetType().Name ?? "no refusal"}");
            if (method.Needs > AccessLevel.Edit)
            {
                Assert.IsType<ForbiddenException>(asEditor);
            }
        }

        var asOwner = await TryAsync(owner, biz => method.Call(biz, id, other));
        Assert.True(asOwner is null, $"{name}: the owner is refused: {asOwner?.Message}");
    }

    // ------------------------------------------------------------------------------------------------ methods that make something in an area or change the area

    private sealed record AreaMethod(string Name, SpaceRole Needs, Func<Biz, long, long, Task> Call);

    /// <summary>Methods on an area (a team). The second id is another person.</summary>
    private static readonly AreaMethod[] AreaMethods =
    [
        new("DesignLogic.CreateAsync(in area)", SpaceRole.Editor, (biz, team, _) => DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign("x", null, "a4-portrait", null, null, null, null, team))),
        new("DesignLogic.CreateFromFormatAsync(in area)", SpaceRole.Editor, (biz, team, _) => DesignLogic.CreateFromFormatAsync(biz, "a4-portrait", null, null, null, "x", team)),
        new("DataListLogic.SaveGeneralAsync(in area)", SpaceRole.Editor, (biz, team, _) => DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput("x", null, false), team)),
        new("OutputLogic.SaveAsync(in area)", SpaceRole.Editor, (biz, team, _) => OutputLogic.SaveAsync(biz, null, JobInput(Nobody), team)),
        new("AssetLogic.UploadAsync(in area)", SpaceRole.Editor, async (biz, team, _) => await AssetLogic.UploadAsync(biz, "x.png", Png(), null, team)),
        new("FontLogic.UploadAsync(in area)", SpaceRole.Editor, async (biz, team, _) => await FontLogic.UploadAsync(biz, "x.ttf", FakeFont((byte)Random.Shared.Next(1, 250)), null, team)),
        new("SheetLogic.SaveAsync(in area)", SpaceRole.Editor, (biz, team, _) => SheetLogic.SaveAsync(biz, null, new SheetLogic.SheetInput("Bogen", 210, 297, 0, 0, 1, 1, 100, 100, 0, 0, false), team)),
        new("CatalogLogic.ImportAsync(in area)", SpaceRole.Editor, (biz, team, _) => CatalogLogic.ImportAsync(biz, "builtin", "kein-bild", team)),
        new("FolderLogic.CreateAsync(in area)", SpaceRole.Editor, (biz, team, _) => FolderLogic.CreateAsync(biz, team, null, "x")),
        new("DesignPackageLogic.ImportAsync(in area)", SpaceRole.Editor, (biz, team, _) => DesignPackageLogic.ImportAsync(biz, Bytes, team)),
        new("ItemLogic.MoveAsync(into area)", SpaceRole.Editor, (biz, team, _) => ItemLogic.MoveAsync(biz, [], team, null)),
        new("ItemLogic.CopyAsync(into area)", SpaceRole.Editor, (biz, team, _) => ItemLogic.CopyAsync(biz, [], team, null)),
        new("BrandLogic.GetAsync", SpaceRole.Viewer, (biz, team, _) => BrandLogic.GetAsync(biz, team)),
        new("SpaceLogic.MemberNamesAsync", SpaceRole.Viewer, (biz, team, _) => SpaceLogic.MemberNamesAsync(biz, team, 5)),
        new("DesignLogic.TemplateCandidatesAsync", SpaceRole.Editor, (biz, team, _) => DesignLogic.TemplateCandidatesAsync(biz, team)),
        new("InviteLogic.ListAsync", SpaceRole.Admin, (biz, team, _) => InviteLogic.ListAsync(biz, team)),
        new("InviteLogic.CreateAsync(team)", SpaceRole.Admin, (biz, team, _) => InviteLogic.CreateAsync(biz, team, SpaceRole.Viewer, null, true, 7, 1)),
        new("SpaceLogic.MembersAsync", SpaceRole.Viewer, (biz, team, _) => SpaceLogic.MembersAsync(biz, team)),
        new("SpaceLogic.GetAsync", SpaceRole.Viewer, (biz, team, _) => SpaceLogic.GetAsync(biz, team)),
        new("StorageLogic.UsageAsync", SpaceRole.Viewer, (biz, team, _) => StorageLogic.UsageAsync(biz, team)),
        new("BrandLogic.SaveAsync", SpaceRole.Admin, (biz, team, _) => BrandLogic.SaveAsync(biz, new BrandKit { Colors = ["no colour"] }, team)),
        new("SpaceLogic.UpdateTeamAsync", SpaceRole.Admin, (biz, team, _) => SpaceLogic.UpdateTeamAsync(biz, team, "Neuer Name", null, null)),
        new("SpaceLogic.AddMemberAsync", SpaceRole.Admin, (biz, team, other) => SpaceLogic.AddMemberAsync(biz, team, other, SpaceRole.Viewer)),
        new("SpaceLogic.RemoveMemberAsync", SpaceRole.Admin, (biz, team, other) => SpaceLogic.RemoveMemberAsync(biz, team, other)),
        new("SpaceLogic.ChangeRoleAsync", SpaceRole.Admin, (biz, team, other) => SpaceLogic.ChangeRoleAsync(biz, team, other, SpaceRole.Viewer)),
        new("SpaceLogic.TransferOwnershipAsync", SpaceRole.Owner, (biz, team, other) => SpaceLogic.TransferOwnershipAsync(biz, team, other)),
        new("SpaceLogic.DeleteTeamAsync", SpaceRole.Owner, (biz, team, _) => SpaceLogic.DeleteTeamAsync(biz, team, "falsch")),
    ];

    public static TheoryData<string> AreaMethodNames
    {
        get
        {
            var data = new TheoryData<string>();
            foreach (var method in AreaMethods)
            {
                data.Add(method.Name);
            }

            return data;
        }
    }

    [Theory]
    [MemberData(nameof(AreaMethodNames))]
    public async Task A_method_on_an_area_asks_for_the_role_in_it(string name)
    {
        if (!Enabled)
        {
            return;
        }

        var method = AreaMethods.Single(m => m.Name == name);
        var owner = await UserAsync("owner");
        var admin = await UserAsync("admin-of-team");
        var editor = await UserAsync("editor");
        var viewer = await UserAsync("viewer");
        var stranger = await UserAsync("stranger");
        var other = await UserAsync("other");
        var team = (await AsUser(owner, biz => SpaceLogic.CreateTeamAsync(biz, "Team " + Guid.NewGuid().ToString("N")[..6]))).Id;
        await AsUser(owner, biz => SpaceLogic.AddMemberAsync(biz, team, admin, SpaceRole.Admin));
        await AsUser(owner, biz => SpaceLogic.AddMemberAsync(biz, team, editor, SpaceRole.Editor));
        await AsUser(owner, biz => SpaceLogic.AddMemberAsync(biz, team, viewer, SpaceRole.Viewer));

        var asStranger = await TryAsync(stranger, biz => method.Call(biz, team, other));
        Assert.True(asStranger is NotFoundException, $"{name}: somebody who is no member should get a 404, got {asStranger?.GetType().Name ?? "no refusal"}");
        foreach (var (who, role, label) in new[] { (viewer, SpaceRole.Viewer, "viewer"), (editor, SpaceRole.Editor, "editor"), (admin, SpaceRole.Admin, "admin") })
        {
            var refused = await TryAsync(who, biz => method.Call(biz, team, other));
            if (Access.AtLeast(role, method.Needs))
            {
                Assert.True(refused is null, $"{name}: a team {label} should be let in: {refused?.Message}");
            }
            else
            {
                Assert.True(refused is ForbiddenException, $"{name}: a team {label} should get a 403, got {refused?.GetType().Name ?? "no refusal"}");
            }
        }

        var asOwner = await TryAsync(owner, biz => method.Call(biz, team, other));
        Assert.True(asOwner is null, $"{name}: the owner of the team is refused: {asOwner?.Message}");
    }

    // ------------------------------------------------------------------------------------------------ methods only administrators may call, and what needs a sign-in

    private static readonly AiProfileLogic.ProfileInput ProfileInput = new("", AiProvider.OpenAiCompatible, null, "", "", null, false, null);

    private static readonly UserLogic.UserInput UserInput = new("", "", null, UserRole.Member, true, null);

    private static Func<Biz, Task> Wrap(Action<Biz> call) => biz =>
    {
        call(biz);
        return Task.CompletedTask;
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
        ["StorageLogic.SetQuotaAsync"] = biz => StorageLogic.SetQuotaAsync(biz, Nobody, 1),
        ["UserLogic.SetApprovalAsync"] = biz => UserLogic.SetApprovalAsync(biz, Nobody, true),
        ["UserLogic.SetActiveAsync"] = biz => UserLogic.SetActiveAsync(biz, Nobody, true),
        ["UserLogic.SetRoleAsync"] = biz => UserLogic.SetRoleAsync(biz, Nobody, UserRole.Member),
        ["UserLogic.PendingCountAsync"] = biz => UserLogic.PendingCountAsync(biz),
        ["UserLogic.TransferPeopleAsync"] = biz => UserLogic.TransferPeopleAsync(biz, Nobody),
        ["UserLogic.PersonalStorageAsync"] = biz => UserLogic.PersonalStorageAsync(biz, Nobody),
        ["UserLogic.SetPersonalQuotaAsync"] = biz => UserLogic.SetPersonalQuotaAsync(biz, Nobody, 1),
        ["SpaceLogic.AdminTeams"] = Wrap(biz => SpaceLogic.AdminTeams(biz)),
        ["SpaceLogic.AdminTeamAsync"] = biz => SpaceLogic.AdminTeamAsync(biz, Nobody),
        ["SpaceLogic.JoinAsSupportAsync"] = biz => SpaceLogic.JoinAsSupportAsync(biz, Nobody),
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
        ["AiProfileLogic.LoadModelsAsync"] = biz => AiProfileLogic.LoadModelsAsync(biz, null, AiProvider.OpenAiCompatible, null, null),
        ["AiLogic.FullInstruction"] = Wrap(biz => AiLogic.FullInstruction(biz, AiAction.Test)),
        ["AiLogic.Runs"] = Wrap(biz => AiLogic.Runs(biz)),
        ["AiLogic.RunDetailsAsync"] = biz => AiLogic.RunDetailsAsync(biz, Nobody),
        ["AiLogic.ContinueAsync"] = biz => AiLogic.ContinueAsync(biz, Nobody, null),
        ["AiLogic.UsageAsync"] = biz => AiLogic.UsageAsync(biz),
        ["CatalogLogic.AdminListAsync"] = biz => CatalogLogic.AdminListAsync(biz),
        ["CatalogLogic.AdminGetAsync"] = biz => CatalogLogic.AdminGetAsync(biz, "builtin"),
        ["CatalogLogic.SaveAsync"] = biz => CatalogLogic.SaveAsync(biz, "builtin", new CatalogInput(true, 0, 0, 0, true, [], [])),
        ["CatalogLogic.SetKeyAsync"] = biz => CatalogLogic.SetKeyAsync(biz, "builtin", null, false),
        ["CatalogLogic.TestAsync"] = biz => CatalogLogic.TestAsync(biz, "builtin"),
        ["CatalogLogic.ClearCacheAsync"] = biz => CatalogLogic.ClearCacheAsync(biz),
    };

    public static TheoryData<string> AdminMethods
    {
        get
        {
            var data = new TheoryData<string>();
            foreach (var name in Admin.Keys)
            {
                data.Add(name);
            }

            return data;
        }
    }

    /// <summary>Methods that would really call the model for an administrator (and count against the limits the AI tests measure): only the refusals are tried.</summary>
    private static readonly HashSet<string> RefusalsOnly = ["AiLogic.TestAsync", "AiProfileLogic.LoadModelsAsync"];

    [Theory]
    [MemberData(nameof(AdminMethods))]
    public async Task An_administrator_method_refuses_members_and_lets_administrators_in(string name)
    {
        if (!Enabled)
        {
            return;
        }

        var call = Admin[name];
        var member = await UserAsync("member");
        Assert.True(await TryAsync(member, call) is ForbiddenException, $"{name} did not refuse a member");
        if (!RefusalsOnly.Contains(name))
        {
            var administrator = await UserAsync("administrator");
            Exception? refused = null;
            try
            {
                await AsUser(administrator, call, UserRole.Admin);
            }
            catch (ForbiddenException ex)
            {
                refused = ex;
            }
            catch (Exception)
            {
                // a message about the made-up id is fine
            }

            Assert.True(refused is null, $"{name} refused an administrator: {refused?.Message}");
        }
    }

    [Theory]
    [MemberData(nameof(ItemMethodNames))]
    public async Task Nothing_works_without_a_sign_in(string name)
    {
        if (!Enabled)
        {
            return;
        }

        var method = ItemMethods.Single(m => m.Name == name);
        using var client = Factory.CreateClient();
        using var scope = Factory.Services.CreateScope();
        using var acting = scope.ServiceProvider.GetRequiredService<ICurrentUser>().RunAs(null, null, UserRole.Member);
        var biz = scope.ServiceProvider.GetRequiredService<Biz>();
        var refused = await Assert.ThrowsAnyAsync<Exception>(() => method.Call(biz, Nobody, Nobody));
        Assert.IsType<ForbiddenException>(refused);
    }

    // ------------------------------------------------------------------------------------------------ the conversations of the design assistant

    private sealed record ConversationMethod(string Name, Func<Biz, long, long, Task> Call, AccessLevel Needs, bool AdminMayOpen);

    /// <summary>
    /// What belongs to a conversation or to its run (the design assistant): only its person, whatever the design allows; an administrator may read, stop and delete (what they read is the run list they see anyway) but
    /// takes back nothing without a right to the design. Undo needs Edit on the design on top.
    /// </summary>
    private static readonly ConversationMethod[] ConversationMethods =
    [
        new("AiAgentLogic.StepsAsync", (biz, conversation, _) => AiAgentLogic.StepsAsync(biz, conversation, 0), AccessLevel.View, true),
        new("AiAgentLogic.ConversationAsync", (biz, conversation, _) => AiAgentLogic.ConversationAsync(biz, conversation), AccessLevel.View, true),
        new("AiAgentLogic.PictureAsync", (biz, conversation, _) => AiAgentLogic.PictureAsync(biz, conversation, "x.png"), AccessLevel.View, true),
        new("AiAgentLogic.CancelAsync", (biz, conversation, _) => AiAgentLogic.CancelAsync(biz, conversation), AccessLevel.View, true),
        new("AiAgentLogic.DeleteAsync", (biz, conversation, _) => AiAgentLogic.DeleteAsync(biz, conversation), AccessLevel.View, true),
        new("AiAgentLogic.UndoAsync", (biz, conversation, _) => AiAgentLogic.UndoAsync(biz, conversation, false), AccessLevel.Edit, false),
        new("AiAttachmentLogic.ModelImagesAsync", (biz, conversation, _) => AiAttachmentLogic.ModelImagesAsync(biz, conversation, 1), AccessLevel.View, false),
        new("AiAgentLoop.RunAsync", (biz, conversation, _) => AiAgentLoop.RunAsync(biz, conversation, null, CancellationToken.None), AccessLevel.View, false),
        new("AiAgentLogic.RenderUploadAsync", (biz, _, run) => AiAgentLogic.RenderUploadAsync(biz, run, "token", Png()), AccessLevel.View, false),
        new("AiAgentLogic.RenderFailedAsync", (biz, _, run) => AiAgentLogic.RenderFailedAsync(biz, run, "token"), AccessLevel.View, false),
    ];

    public static TheoryData<string> ConversationMethodNames
    {
        get
        {
            var data = new TheoryData<string>();
            foreach (var method in ConversationMethods)
            {
                data.Add(method.Name);
            }

            return data;
        }
    }

    [Theory]
    [MemberData(nameof(ConversationMethodNames))]
    public async Task A_method_on_a_conversation_belongs_to_its_person(string name)
    {
        if (!Enabled)
        {
            return;
        }

        var method = ConversationMethods.Single(m => m.Name == name);
        var owner = await UserAsync("owner");        // owns the design
        var author = await UserAsync("author");      // wrote the conversation, has Edit through a share
        var stranger = await UserAsync("stranger");
        var administrator = await UserAsync("administrator");
        var design = await MakeItemAsync(owner, ItemKind.Design);
        await AsUser(owner, biz => ShareLogic.AddAsync(biz, ItemKind.Design, design, false, author, SharePermission.Edit));
        async Task<(long Conversation, long Run)> MakeConversationAsync() => await Db(async db =>
        {
            var c = new AiConversation { SubjectId = design, UserId = author, Title = "Gespräch", Runs = 1 };
            db.AiConversation.Add(c);
            await db.SaveChangesAsync();
            var r = new AiRun { Action = AiAction.DesignAgent, SubjectType = nameof(Design), SubjectId = design, UserId = author, ConversationId = c.Id, Number = 1, StartDate = DateTime.UtcNow, Status = AiRunStatus.Done };
            db.AiRun.Add(r);
            await db.SaveChangesAsync();
            return (c.Id, r.Id);
        });
        var (conversation, run) = await MakeConversationAsync();
        var (conversation2, run2) = await MakeConversationAsync();
        var (conversation3, run3) = await MakeConversationAsync();

        // the owner of the design, a stranger and (without a right to the design) an administrator: not their conversation
        Assert.IsType<NotFoundException>(await TryAsync(owner, biz => method.Call(biz, conversation, run)));
        Assert.IsType<NotFoundException>(await TryAsync(stranger, biz => method.Call(biz, conversation, run)));
        Exception? asAdmin = null;
        try
        {
            await AsUser(administrator, biz => method.Call(biz, conversation3, run3), UserRole.Admin);
        }
        catch (Exception ex) when (ex is NotFoundException or ForbiddenException)
        {
            asAdmin = ex;
        }
        catch (Exception)
        {
            // a message about the made-up input is fine
        }

        Assert.True(method.AdminMayOpen == (asAdmin is null), name + ": the administrator " + (method.AdminMayOpen ? "may open it" : "must not") + ", got " + (asAdmin?.GetType().Name ?? "no refusal"));

        // the person: let in with Edit; with the share taken down to View only what needs Edit is refused (403)
        Assert.True(await TryAsync(author, biz => method.Call(biz, conversation, run)) is null, name + ": the person is refused");
        var share = await Db(db => db.Share.AsNoTracking().Where(s => s.ItemId == design && s.ItemKind == ItemKind.Design).Select(s => s.Id).FirstAsync());
        await AsUser(owner, biz => ShareLogic.ChangeAsync(biz, share, SharePermission.View));
        var asViewer = await TryAsync(author, biz => method.Call(biz, conversation2, run2));
        if (method.Needs == AccessLevel.Edit)
        {
            Assert.IsType<ForbiddenException>(asViewer);
        }
        else
        {
            Assert.Null(asViewer);
        }
    }

    [Theory]
    [MemberData(nameof(ConversationMethodNames))]
    public async Task Nothing_of_a_conversation_works_without_a_sign_in(string name)
    {
        if (!Enabled)
        {
            return;
        }

        var method = ConversationMethods.Single(m => m.Name == name);
        using var client = Factory.CreateClient();
        using var scope = Factory.Services.CreateScope();
        using var acting = scope.ServiceProvider.GetRequiredService<ICurrentUser>().RunAs(null, null, UserRole.Member);
        var biz = scope.ServiceProvider.GetRequiredService<Biz>();
        var refused = await Assert.ThrowsAnyAsync<Exception>(() => method.Call(biz, Nobody, Nobody));
        Assert.IsType<ForbiddenException>(refused);
    }

    [Fact]
    public async Task Everything_a_signed_in_member_may_do_without_an_item_is_open_to_every_member()
    {
        if (!Enabled)
        {
            return;
        }

        Dictionary<string, Func<Biz, Task>> reading = new()
        {
            ["DesignLogic.CountAsync"] = biz => DesignLogic.CountAsync(biz),
            ["AssetLogic.SearchAsync"] = biz => AssetLogic.SearchAsync(biz, null, "uploads", 5, "new"),
            ["CatalogLogic.ListAsync"] = biz => CatalogLogic.ListAsync(biz),
            ["CatalogLogic.CollectionsAsync"] = biz => CatalogLogic.CollectionsAsync(biz, "uploads"),
            ["CatalogLogic.SearchAsync"] = biz => CatalogLogic.SearchAsync(biz, "builtin", new CatalogQuery { Text = "de" }),
            ["DesignLogic.TemplatesAsync"] = biz => DesignLogic.TemplatesAsync(biz),
            ["DesignLogic.FeaturedTemplatesAsync"] = biz => DesignLogic.FeaturedTemplatesAsync(biz, 4),
            ["DesignLogic.TemplateCategoriesAsync"] = biz => DesignLogic.TemplateCategoriesAsync(biz),
            ["DesignLogic.RecentAsync"] = biz => DesignLogic.RecentAsync(biz, 4),
            ["DesignLogic.SearchAsync"] = biz => DesignLogic.SearchAsync(biz, "x"),
            ["BrandLogic.GetAsync"] = biz => BrandLogic.GetAsync(biz),
            ["BrandLogic.FamiliesAsync"] = biz => BrandLogic.FamiliesAsync(biz),
            ["FontLogic.AllAsync"] = biz => FontLogic.AllAsync(biz),
            ["SheetLogic.ChoicesAsync"] = biz => SheetLogic.ChoicesAsync(biz),
            ["DataListLogic.ChoicesAsync"] = biz => DataListLogic.ChoicesAsync(biz),
            ["ItemLogic.QueryAsync"] = biz => ItemLogic.QueryAsync(biz, new ItemQuery()),
            ["ItemLogic.RecentAsync"] = biz => ItemLogic.RecentAsync(biz, 5),
            ["FolderLogic.TreeAsync"] = biz => FolderLogic.TreeAsync(biz),
            ["SpaceLogic.MySpacesAsync"] = biz => SpaceLogic.MySpacesAsync(biz),
            ["ShareLogic.SearchAsync"] = biz => ShareLogic.SearchAsync(biz, "ab"),
            ["AccessRequestLogic.CreateAsync"] = biz => AccessRequestLogic.CreateAsync(biz, ItemKind.Design, Nobody, SharePermission.View, null),
            ["AccessRequestLogic.MineAsync"] = biz => AccessRequestLogic.MineAsync(biz, ItemKind.Design, Nobody),
            ["DesignLogic.CreateFromFormatAsync"] = biz => DesignLogic.CreateFromFormatAsync(biz, "a4-portrait", null, null, null, "mein"),
            ["SpaceLogic.CreateTeamAsync"] = biz => SpaceLogic.CreateTeamAsync(biz, "Team " + Guid.NewGuid().ToString("N")[..6]),
            ["SpaceLogic.MyTeamTilesAsync"] = biz => SpaceLogic.MyTeamTilesAsync(biz),
            ["NotificationLogic.ListAsync"] = biz => NotificationLogic.ListAsync(biz),
            ["NotificationLogic.UnreadCountAsync"] = biz => NotificationLogic.UnreadCountAsync(biz),
            ["NotificationLogic.ReadAsync"] = biz => NotificationLogic.ReadAsync(biz, Nobody),
            ["NotificationLogic.OpenAsync"] = biz => NotificationLogic.OpenAsync(biz, Nobody),
            ["NotificationLogic.ReadAllAsync"] = biz => NotificationLogic.ReadAllAsync(biz),
            ["NotificationLogic.MailSettingsAsync"] = biz => NotificationLogic.MailSettingsAsync(biz),
            ["NotificationLogic.SaveMailSettingsAsync"] = biz => NotificationLogic.SaveMailSettingsAsync(biz, new NotifyMailSettings()),
            ["InviteLogic.ListPlatformAsync"] = biz => InviteLogic.ListPlatformAsync(biz),
            ["InviteLogic.AcceptAsync"] = biz => InviteLogic.AcceptAsync(biz, Guid.NewGuid()),
            ["InviteLogic.CreateAsync(platform)"] = biz => InviteLogic.CreateAsync(biz, null, SpaceRole.Editor, null, true, 7, 1),
            ["AiAgentLogic.StartNewAsync"] = biz => AiAgentLogic.StartNewAsync(biz, new AiAgentLogic.NewDesignInput("", null, null, null, null, null, null, null, null)),
        };
        var member = await UserAsync("member");
        foreach (var (name, call) in reading)
        {
            var refused = await TryAsync(member, call);
            Assert.True(refused is null, $"{name} refused a member: {refused?.Message}");
        }
    }
}
