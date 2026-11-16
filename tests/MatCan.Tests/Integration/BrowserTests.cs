using MatCan.Data.Entities;
using MatCan.Logic;
using MatCan.Tests.Core;
using MatCan.UiKit;
using Microsoft.EntityFrameworkCore;

namespace MatCan.Tests.Integration;

/// <summary>
/// What the file browser (docs/PLAN-PLATFORM.md section 1.2 to 1.4, 1.19) needs from the business layer: the flags of each row, the trash that only lists what was deleted on its own, rename of every
/// kind, copies next to the original, folder previews, the visits behind "Zuletzt verwendet", the views of the pages and the filter "Bereich".
/// </summary>
[Collection("app")]
public sealed class BrowserTests(AppTests.AppFactory factory) : PlatformTestBase(factory)
{
    private static byte[] Png() => File.ReadAllBytes(Path.Combine(RepoFiles.WwwRoot(), "img", "icon-192.png"));

    private static Task<long> DesignIn(Biz biz, string name, long? folder = null, long? space = null)
        => DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign(name, null, "a4-portrait", null, null, null, null, space, folder)).ContinueWith(t => t.Result.Id);

    private static Task<ItemPage> Page(Biz biz, ItemQuery query) => ItemLogic.QueryAsync(biz, query);

    [Fact]
    public async Task Every_row_says_what_the_person_may_do_with_it()
    {
        if (!Enabled)
        {
            return;
        }

        var folder = await As(Role.Designer, biz => FolderLogic.CreateAsync(biz, null, null, "Geteilt"));
        var shared = await As(Role.Designer, biz => DesignIn(biz, "Nur ansehen", folder.Id));
        var editable = await As(Role.Designer, biz => DesignIn(biz, "Bearbeiten"));
        await ShareAsync(Role.Designer, ItemKind.Folder, folder.Id, Role.Viewer, SharePermission.View);
        await ShareAsync(Role.Designer, ItemKind.Design, editable, Role.Viewer, SharePermission.Edit);

        // the owner manages everything
        var own = await As(Role.Designer, biz => Page(biz, new ItemQuery { Take = 100 }));
        Assert.All(own.Items.Where(i => (i.Kind == ItemKind.Folder && i.Id == folder.Id) || (i.Kind == ItemKind.Design && i.Id == editable)), i => Assert.True(i.CanManage));

        // the viewer: the shared folder may be looked at, the design with a share to edit may be changed, nothing is theirs to manage
        var seen = await As(Role.Viewer, biz => Page(biz, new ItemQuery { Scope = ItemScope.Shared, Take = 100 }));
        var seenFolder = Assert.Single(seen.Items, i => i.Kind == ItemKind.Folder && i.Id == folder.Id);
        Assert.False(seenFolder.CanEdit);
        Assert.False(seenFolder.CanManage);
        var seenDesign = Assert.Single(seen.Items, i => i.Kind == ItemKind.Design && i.Id == editable);
        Assert.True(seenDesign.CanEdit);
        Assert.False(seenDesign.CanManage);

        // what lies in the shared folder is reached through it, as View
        var inside = await As(Role.Viewer, biz => Page(biz, new ItemQuery { FolderId = folder.Id }));
        var insideDesign = Assert.Single(inside.Items);
        Assert.Equal(shared, insideDesign.Id);
        Assert.False(insideDesign.CanEdit);
    }

    [Fact]
    public async Task The_trash_lists_what_was_deleted_on_its_own_and_a_folder_brings_its_content_back()
    {
        if (!Enabled)
        {
            return;
        }

        await As(Role.Designer, async biz =>
        {
            var parent = await FolderLogic.CreateAsync(biz, null, null, "Eltern");
            var child = await FolderLogic.CreateAsync(biz, null, parent.Id, "Kind");
            var inChild = await DesignIn(biz, "Tief", child.Id);
            var inParent = await DesignIn(biz, "Mitte", parent.Id);
            var alone = await DesignIn(biz, "Einzeln");
            await ItemLogic.TrashAsync(biz, [new ItemRef(ItemKind.Design, alone), new ItemRef(ItemKind.Folder, parent.Id)]);

            var trash = await Page(biz, new ItemQuery { Scope = ItemScope.Trash, Take = 100 });
            Assert.Equal(2, trash.Total);
            Assert.Contains(trash.Items, i => i.Kind == ItemKind.Folder && i.Id == parent.Id);
            Assert.Contains(trash.Items, i => i.Kind == ItemKind.Design && i.Id == alone);
            Assert.DoesNotContain(trash.Items, i => i.Id == child.Id || i.Id == inChild || i.Id == inParent);
            Assert.All(trash.Items, i => Assert.True(i.CanManage));

            await ItemLogic.RestoreAsync(biz, [new ItemRef(ItemKind.Folder, parent.Id)]);
            var back = await Page(biz, new ItemQuery { FolderId = parent.Id });
            Assert.Contains(back.Items, i => i.Id == child.Id && i.Kind == ItemKind.Folder);
            Assert.Contains(back.Items, i => i.Id == inParent && i.Kind == ItemKind.Design);
            Assert.Single((await Page(biz, new ItemQuery { FolderId = child.Id })).Items, i => i.Id == inChild);

            // emptying the trash goes through every page of it
            Assert.Equal(1, await ItemLogic.EmptyTrashAsync(biz, null));
            Assert.Equal(0, (await Page(biz, new ItemQuery { Scope = ItemScope.Trash })).Total);
        });
    }

    [Fact]
    public async Task A_stranger_does_not_see_the_trash_of_somebody_else_and_cannot_empty_it()
    {
        if (!Enabled)
        {
            return;
        }

        await As(Role.Designer, async biz =>
        {
            var id = await DesignIn(biz, "Weg");
            await ItemLogic.TrashAsync(biz, [new ItemRef(ItemKind.Design, id)]);
        });
        Assert.Equal(0, (await As(Role.Stranger, biz => Page(biz, new ItemQuery { Scope = ItemScope.Trash }))).Total);
        Assert.Equal(0, await As(Role.Stranger, biz => ItemLogic.EmptyTrashAsync(biz, null)));
        Assert.Equal(1, (await As(Role.Designer, biz => Page(biz, new ItemQuery { Scope = ItemScope.Trash }))).Items.Count(i => i.Name == "Weg"));
    }

    [Fact]
    public async Task Templates_can_be_left_out_of_a_search()
    {
        if (!Enabled)
        {
            return;
        }

        var token = "Zebra" + Guid.NewGuid().ToString("N")[..6];
        await As(Role.Designer, async biz =>
        {
            var plain = await DesignIn(biz, token + " Plakat");
            var template = await DesignIn(biz, token + " Vorlage");
            await DesignLogic.UpdatePropertiesAsync(biz, template, new DesignLogic.DesignInput(token + " Vorlage", "Test", null, true));
            var everything = await Page(biz, new ItemQuery { Q = token, Recursive = true });
            Assert.Equal(2, everything.Total);
            var onlyDesigns = await Page(biz, new ItemQuery { Q = token, Recursive = true, ExcludeTemplates = true });
            Assert.Equal(plain, Assert.Single(onlyDesigns.Items).Id);
        });
    }

    [Fact]
    public async Task Rename_works_for_every_kind_with_the_right_level()
    {
        if (!Enabled)
        {
            return;
        }

        var ids = await As(Role.Designer, async biz =>
        {
            var folder = await FolderLogic.CreateAsync(biz, null, null, "Alt");
            var design = await DesignIn(biz, "Alt");
            var list = (await DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput("Alt", null, false))).Id;
            var upload = await AssetLogic.UploadAsync(biz, "alt.png", Png(), null);
            Assert.NotNull(upload.Asset);
            return (folder: folder.Id, design, list, asset: upload.Asset!.Id);
        });
        await As(Role.Designer, async biz =>
        {
            Assert.Equal("Neu", await ItemLogic.RenameAsync(biz, ItemKind.Folder, ids.folder, "  Neu "));
            Assert.Equal("Neu", await ItemLogic.RenameAsync(biz, ItemKind.Design, ids.design, "Neu"));
            Assert.Equal("Neu", await ItemLogic.RenameAsync(biz, ItemKind.DataList, ids.list, "Neu"));
            Assert.Equal("Neu", await ItemLogic.RenameAsync(biz, ItemKind.Asset, ids.asset, "Neu"));
            await Assert.ThrowsAsync<BizException>(() => ItemLogic.RenameAsync(biz, ItemKind.DataList, ids.list, "  "));
            Assert.Equal(200, (await ItemLogic.RenameAsync(biz, ItemKind.Asset, ids.asset, new string('x', 400))).Length);
        });

        // somebody who may only look cannot rename; a stranger does not even find it
        await ShareAsync(Role.Designer, ItemKind.DataList, ids.list, Role.Viewer, SharePermission.View);
        await ShareAsync(Role.Designer, ItemKind.Folder, ids.folder, Role.Viewer, SharePermission.Edit);
        await As(Role.Viewer, async biz =>
        {
            await Assert.ThrowsAsync<ForbiddenException>(() => ItemLogic.RenameAsync(biz, ItemKind.DataList, ids.list, "Mein"));
            // a folder needs Manage, Edit is not enough
            await Assert.ThrowsAsync<ForbiddenException>(() => ItemLogic.RenameAsync(biz, ItemKind.Folder, ids.folder, "Mein"));
        });
        await As(Role.Stranger, async biz => await Assert.ThrowsAsync<NotFoundException>(() => ItemLogic.RenameAsync(biz, ItemKind.Design, ids.design, "Mein")));
    }

    [Fact]
    public async Task A_copy_lands_next_to_the_original_and_counts_as_used()
    {
        if (!Enabled)
        {
            return;
        }

        await As(Role.Designer, async biz =>
        {
            var folder = await FolderLogic.CreateAsync(biz, null, null, "Daheim");
            var design = await DesignIn(biz, "Original", folder.Id);
            var copies = await ItemLogic.DuplicateAsync(biz, [new ItemRef(ItemKind.Design, design), new ItemRef(ItemKind.Folder, folder.Id)]);
            // the copy of the design (1), the copy of the folder (1) with the two designs that lay in it by then (2)
            Assert.Equal(4, copies.Count);
            var inFolder = await Page(biz, new ItemQuery { FolderId = folder.Id });
            Assert.Contains(inFolder.Items, i => i.Name == "Original (Kopie)");
            var root = await Page(biz, new ItemQuery { SpaceId = await biz.PersonalSpaceIdAsync() });
            Assert.Contains(root.Items, i => i.Kind == ItemKind.Folder && i.Name == "Daheim (Kopie)");
            // the copy of the design is among the recent things
            var recent = await ItemLogic.RecentAsync(biz, 20);
            Assert.Contains(recent, i => i.Name == "Original (Kopie)");
        });
    }

    [Fact]
    public async Task A_copy_of_something_only_viewed_goes_to_the_personal_area()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await As(Role.Designer, biz => DesignIn(biz, "Fremd"));
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer);
        var copy = await As(Role.Viewer, async biz =>
        {
            var made = await ItemLogic.DuplicateAsync(biz, [new ItemRef(ItemKind.Design, design)]);
            return Assert.Single(made);
        });
        var place = await As(Role.Viewer, async biz => await DesignLogic.PlaceAsync(biz, copy.Id));
        Assert.True(place.CanManage);
        Assert.Equal(await As(Role.Viewer, biz => biz.PersonalSpaceIdAsync()), place.SpaceId);
    }

    [Fact]
    public async Task What_a_person_creates_or_opens_shows_up_in_zuletzt_verwendet()
    {
        if (!Enabled)
        {
            return;
        }

        await As(Role.Designer, async biz =>
        {
            Assert.Empty(await ItemLogic.RecentAsync(biz, 10));
            var design = await DesignIn(biz, "Neu gemacht");
            var list = (await DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput("Neue Liste", null, false))).Id;
            var recent = await ItemLogic.RecentAsync(biz, 10);
            Assert.Equal(["Neu gemacht", "Neue Liste"], recent.Select(r => r.Name).Order(StringComparer.Ordinal).ToArray());
            await ItemLogic.VisitAsync(biz, ItemKind.Design, design);
            Assert.Equal(design, (await ItemLogic.RecentAsync(biz, 10))[0].Id);
            Assert.Contains(recent, r => r.Id == list && r.Kind == ItemKind.DataList);
        });

        // somebody else has used nothing
        Assert.Empty(await As(Role.Stranger, biz => ItemLogic.RecentAsync(biz, 10)));
    }

    [Fact]
    public async Task A_folder_shows_pictures_of_what_lies_in_it()
    {
        if (!Enabled)
        {
            return;
        }

        await As(Role.Designer, async biz =>
        {
            var folder = await FolderLogic.CreateAsync(biz, null, null, "Bilder");
            var empty = await FolderLogic.CreateAsync(biz, null, null, "Leer");
            for (var i = 0; i < 5; i++)
            {
                var upload = await AssetLogic.UploadAsync(biz, $"pic{i}-{Guid.NewGuid():N}.png", Png(), null, null, folder.Id);
                Assert.NotNull(upload.Asset);
            }

            var page = await Page(biz, new ItemQuery { SpaceId = await biz.PersonalSpaceIdAsync(), Kinds = [ItemKind.Folder], Take = 100 });
            var row = Assert.Single(page.Items, r => r.Id == folder.Id);
            Assert.Equal(4, row.Previews.Count);
            Assert.All(row.Previews, p => Assert.StartsWith("/media/", p));
            Assert.Empty(Assert.Single(page.Items, r => r.Id == empty.Id).Previews);
        });
    }

    [Fact]
    public async Task The_views_of_the_pages_know_the_path_and_where_the_person_may_create()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Viewer));
        var (root, sub) = await As(Role.Designer, async biz =>
        {
            var a = await FolderLogic.CreateAsync(biz, team, null, "Wurzel");
            var b = await FolderLogic.CreateAsync(biz, null, a.Id, "Unter");
            return (a, b);
        });

        var teamRow = (await As(Role.Designer, biz => SpaceLogic.MyTeamsAsync(biz))).First(s => s.Id == team);
        var view = await As(Role.Designer, biz => BrowserViews.ForSpaceAsync(biz, teamRow, sub.Id));
        Assert.True(view.CanCreate);
        Assert.Equal("Unter", view.Title);
        Assert.Equal([teamRow.Name, "Wurzel", "Unter"], view.Crumbs.Select(c => c.Text).ToArray());
        Assert.Equal($"/Teams/{teamRow.Slug}/Projekte/Ordner/{root.Id}", view.Crumbs[1].Url);
        Assert.Equal(team, view.Crumbs[0].DropSpaceId);
        Assert.Equal(sub.Id, view.Crumbs[2].DropFolderId);
        Assert.NotNull(view.Storage);

        // a team viewer may look, not create
        var viewerRow = (await As(Role.Viewer, biz => SpaceLogic.MyTeamsAsync(biz))).First(s => s.Id == team);
        var viewerView = await As(Role.Viewer, biz => BrowserViews.ForSpaceAsync(biz, viewerRow, null));
        Assert.False(viewerView.CanCreate);
    }

    [Fact]
    public async Task A_shared_folder_starts_the_path_at_the_folder_that_was_given()
    {
        if (!Enabled)
        {
            return;
        }

        var (top, middle) = await As(Role.Designer, async biz =>
        {
            var a = await FolderLogic.CreateAsync(biz, null, null, "Oben");
            var b = await FolderLogic.CreateAsync(biz, null, a.Id, "Mitte");
            await FolderLogic.CreateAsync(biz, null, b.Id, "Unten");
            return (a, b);
        });
        await ShareAsync(Role.Designer, ItemKind.Folder, middle.Id, Role.Viewer, SharePermission.Edit);
        var view = await As(Role.Viewer, biz => BrowserViews.ForSharedFolderAsync(biz, middle.Id));
        Assert.Equal(["Freigegeben", "Mitte"], view.Crumbs.Select(c => c.Text).ToArray());
        Assert.True(view.CanCreate);
        Assert.DoesNotContain(view.Crumbs, c => c.Text == "Oben");
        Assert.NotEqual(top.Id, middle.Id);

        // the folder above was never given
        await As(Role.Viewer, async biz => await Assert.ThrowsAsync<NotFoundException>(() => BrowserViews.ForSharedFolderAsync(biz, top.Id)));
    }

    [Fact]
    public async Task The_area_filter_keeps_the_personal_area_a_team_or_what_lies_elsewhere()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await TeamAsync(Role.Designer);
        var shared = await As(Role.Stranger, async biz => (await DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput("Von Fremd", null, false))).Id);
        await ShareAsync(Role.Stranger, ItemKind.DataList, shared, Role.Designer);
        var names = await As(Role.Designer, async biz =>
        {
            await DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput("Meine Liste", null, false));
            await DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput("Team Liste", null, false), team, null);
            var filter = await AreaFilter.CreateAsync<DataListRow>(biz, l => l.SpaceId);
            Assert.Equal(["mine", $"team-{team}", "shared"], filter.Options.Select(o => o.Value).ToArray());
            async Task<string[]> Names(string value) => [.. (await filter.Apply(DataListLogic.Query(biz), value).Select(l => l.Name).ToListAsync()).Order(StringComparer.Ordinal)];
            return (mine: await Names("mine"), team: await Names($"team-{team}"), shared: await Names("shared"), nonsense: await Names("team-999999999"));
        });
        Assert.Equal(["Meine Liste"], names.mine);
        Assert.Equal(["Team Liste"], names.team);
        Assert.Equal(["Von Fremd"], names.shared);
        Assert.Empty(names.nonsense);
    }

    [Fact]
    public async Task A_new_data_list_goes_where_it_is_asked_and_not_where_the_person_may_not_write()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Viewer));
        await As(Role.Designer, async biz =>
        {
            var folder = await FolderLogic.CreateAsync(biz, team, null, "Listen");
            var list = await DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput("Hier", null, false), team, folder.Id);
            Assert.Equal((team, folder.Id), (list.SpaceId, list.FolderId));
        });
        await As(Role.Viewer, async biz => await Assert.ThrowsAsync<ForbiddenException>(() => DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput("Nein", null, false), team, null)));
    }

    [Fact]
    public async Task Moving_items_between_areas_and_back_keeps_the_rows_honest()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await TeamAsync(Role.Designer);
        await As(Role.Designer, async biz =>
        {
            var design = await DesignIn(biz, "Wandert");
            var folder = await FolderLogic.CreateAsync(biz, team, null, "Ziel");
            await ItemLogic.MoveAsync(biz, [new ItemRef(ItemKind.Design, design)], null, folder.Id);
            var inTeam = await Page(biz, new ItemQuery { SpaceId = team, FolderId = folder.Id });
            var row = Assert.Single(inTeam.Items);
            Assert.Equal(("Wandert", team, folder.Id), (row.Name, row.SpaceId, row.FolderId));
            Assert.Equal("Team", (row.SpaceName ?? "")[..4]);
            await ItemLogic.MoveAsync(biz, [new ItemRef(ItemKind.Design, design)], await biz.PersonalSpaceIdAsync(), null);
            Assert.Empty((await Page(biz, new ItemQuery { SpaceId = team, FolderId = folder.Id })).Items);
            Assert.Equal(SpaceLogic.PersonalName, Assert.Single((await Page(biz, new ItemQuery { SpaceId = await biz.PersonalSpaceIdAsync(), Kinds = [ItemKind.Design] })).Items, i => i.Id == design).SpaceName);
        });
    }
}
