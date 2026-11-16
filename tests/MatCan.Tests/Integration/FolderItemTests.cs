using MatCan.Data;
using MatCan.Data.Entities;
using MatCan.Logic;
using MatCan.Services;
using MatCan.Tests.Core;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MatCan.Tests.Integration;

/// <summary>Folders (paths, depth, moves, cycles), the browser's query, copying, the trash with its cascades, the purger and the quota (docs/PLAN-PLATFORM.md sections 1.1 to 1.5).</summary>
[Collection("app")]
public sealed class FolderItemTests(AppTests.AppFactory factory) : PlatformTestBase(factory)
{
    private static byte[] Png() => File.ReadAllBytes(Path.Combine(RepoFiles.WwwRoot(), "img", "icon-192.png"));

    private static string Unique(string prefix) => prefix + Guid.NewGuid().ToString("N")[..8];

    private static Task<FolderRow> Folder(Biz biz, string name, long? parent = null, long? space = null) => FolderLogic.CreateAsync(biz, space, parent, name);

    private static async Task<long> DesignIn(Biz biz, string name, long? folder = null, long? space = null)
        => (await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign(name, null, "a4-portrait", null, null, null, null, space, folder))).Id;

    // ------------------------------------------------------------------------------------------------ folders

    [Fact]
    public async Task A_folder_knows_its_path_and_the_tree_is_at_most_eight_levels_deep()
    {
        if (!Enabled)
        {
            return;
        }

        await As(Role.Designer, async biz =>
        {
            var root = await Folder(biz, "  Wurzel  ");
            Assert.Equal("Wurzel", root.Name);
            Assert.Equal($"/{root.Id}/", root.Path);
            Assert.Equal(1, root.Depth);
            var child = await Folder(biz, "Kind", root.Id);
            Assert.Equal($"/{root.Id}/{child.Id}/", child.Path);
            Assert.Equal((root.SpaceId, root.Id), (child.SpaceId, child.ParentId));

            var deepest = child;
            for (var level = 3; level <= FolderLogic.MaxDepth; level++)
            {
                deepest = await Folder(biz, "Ebene " + level, deepest.Id);
            }

            Assert.Equal(FolderLogic.MaxDepth, deepest.Depth);
            await Assert.ThrowsAsync<BizException>(() => Folder(biz, "zu tief", deepest.Id));
            await Assert.ThrowsAsync<BizException>(() => Folder(biz, "   "));
            await Assert.ThrowsAsync<BizException>(() => FolderLogic.CreateAsync(biz, null, null, "Farbe", "rot"));
            Assert.Equal(120, (await Folder(biz, new string('x', 300))).Name.Length);
        });
    }

    [Fact]
    public async Task Moving_a_folder_rewrites_the_paths_below_it_and_never_makes_a_cycle()
    {
        if (!Enabled)
        {
            return;
        }

        await As(Role.Designer, async biz =>
        {
            var a = await Folder(biz, "A");
            var b = await Folder(biz, "B");
            var a1 = await Folder(biz, "A1", a.Id);
            var a2 = await Folder(biz, "A2", a1.Id);
            var design = await DesignIn(biz, "In A2", a2.Id);

            var moved = await FolderLogic.MoveAsync(biz, a.Id, null, b.Id);
            Assert.Equal($"/{b.Id}/{a.Id}/", moved.Path);
            Assert.Equal(b.Id, moved.ParentId);
            var below = await biz.Db.Folder.AsNoTracking().Where(f => f.Id == a1.Id || f.Id == a2.Id).OrderBy(f => f.Path).ToListAsync();
            Assert.Equal([$"/{b.Id}/{a.Id}/{a1.Id}/", $"/{b.Id}/{a.Id}/{a1.Id}/{a2.Id}/"], below.Select(f => f.Path));
            Assert.Equal(a2.Id, (await biz.Db.Design.AsNoTracking().FirstAsync(d => d.Id == design)).FolderId);

            // not into itself, not below itself
            await Assert.ThrowsAsync<BizException>(() => FolderLogic.MoveAsync(biz, b.Id, null, b.Id));
            await Assert.ThrowsAsync<BizException>(() => FolderLogic.MoveAsync(biz, b.Id, null, a2.Id));
            await Assert.ThrowsAsync<BizException>(() => FolderLogic.MoveAsync(biz, a.Id, null, a2.Id));

            // back to the top; the sub tree follows
            var top = await FolderLogic.MoveAsync(biz, a.Id, null, null);
            Assert.Equal($"/{a.Id}/", top.Path);
            Assert.Equal($"/{a.Id}/{a1.Id}/{a2.Id}/", (await biz.Db.Folder.AsNoTracking().FirstAsync(f => f.Id == a2.Id)).Path);
        });
    }

    [Fact]
    public async Task A_move_may_not_make_the_tree_deeper_than_eight_levels()
    {
        if (!Enabled)
        {
            return;
        }

        await As(Role.Designer, async biz =>
        {
            var chain = await Folder(biz, "L1");
            for (var level = 2; level <= 6; level++)
            {
                chain = await Folder(biz, "L" + level, chain.Id);
            }

            var moving = await Folder(biz, "M1");
            var moving2 = await Folder(biz, "M2", moving.Id);
            var moving3 = await Folder(biz, "M3", moving2.Id);
            // a tree of three levels below a folder of six is nine: refused; below a folder of five it is eight
            await Assert.ThrowsAsync<BizException>(() => FolderLogic.MoveAsync(biz, moving.Id, null, chain.Id));
            var five = await biz.Db.Folder.AsNoTracking().FirstAsync(f => f.Id == chain.ParentId);
            var ok = await FolderLogic.MoveAsync(biz, moving.Id, null, five.Id);
            Assert.Equal(6, ok.Depth);
            Assert.Equal(8, (await biz.Db.Folder.AsNoTracking().FirstAsync(f => f.Id == moving3.Id)).Path.Split('/', StringSplitOptions.RemoveEmptyEntries).Length);
        });
    }

    [Fact]
    public async Task Moving_to_a_team_takes_the_content_and_needs_the_right_to_write_there()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Viewer));
        var (folder, design, asset) = await As(Role.Designer, async biz =>
        {
            var f = await Folder(biz, "Wandert");
            var d = await DesignIn(biz, "Mit", f.Id);
            var a = (await AssetLogic.UploadAsync(biz, Unique("wandert-") + ".png", Png(), null, null, f.Id)).Asset!.Id;
            return (f.Id, d, a);
        });
        await As(Role.Designer, async biz =>
        {
            var moved = await FolderLogic.MoveAsync(biz, folder, team, null);
            Assert.Equal(team, moved.SpaceId);
            Assert.Equal(team, (await biz.Db.Design.AsNoTracking().FirstAsync(d => d.Id == design)).SpaceId);
            Assert.Equal(team, (await biz.Db.Asset.AsNoTracking().FirstAsync(a => a.Id == asset)).SpaceId);
        });
        // a team viewer manages nothing there; a stranger does not know the team
        await As(Role.Viewer, async biz =>
        {
            var mine = await Folder(biz, "Meiner");
            await Assert.ThrowsAsync<ForbiddenException>(() => FolderLogic.MoveAsync(biz, mine.Id, team, null));
            await Assert.ThrowsAsync<ForbiddenException>(() => FolderLogic.MoveAsync(biz, folder, null, null));
        });
        await As(Role.Stranger, async biz =>
        {
            var mine = await Folder(biz, "Fremder");
            await Assert.ThrowsAsync<NotFoundException>(() => FolderLogic.MoveAsync(biz, mine.Id, team, null));
        });
    }

    [Fact]
    public async Task The_breadcrumb_of_a_shared_folder_starts_at_the_shared_folder_and_the_tree_lists_the_areas_to_write_in()
    {
        if (!Enabled)
        {
            return;
        }

        var (top, middle, deep) = await As(Role.Designer, async biz =>
        {
            var a = await Folder(biz, "Oben");
            var b = await Folder(biz, "Mitte", a.Id);
            var c = await Folder(biz, "Unten", b.Id);
            return (a.Id, b.Id, c.Id);
        });
        await ShareAsync(Role.Designer, ItemKind.Folder, middle, Role.Viewer);
        await As(Role.Designer, async biz => Assert.Equal(["Oben", "Mitte", "Unten"], (await FolderLogic.BreadcrumbAsync(biz, deep)).Select(f => f.Name)));
        await As(Role.Viewer, async biz =>
        {
            Assert.Equal(["Mitte", "Unten"], (await FolderLogic.BreadcrumbAsync(biz, deep)).Select(f => f.Name));
            await Assert.ThrowsAsync<NotFoundException>(() => FolderLogic.BreadcrumbAsync(biz, top));
        });

        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Viewer));
        await As(Role.Designer, biz => FolderLogic.CreateAsync(biz, team, null, "Teamordner"));
        await As(Role.Designer, async biz =>
        {
            var tree = await FolderLogic.TreeAsync(biz);
            Assert.Equal(SpaceLogic.PersonalName, tree[0].Name);
            Assert.Contains(tree, t => t.SpaceId == team && t.Folders.Any(f => f.Name == "Teamordner"));
            Assert.Contains(tree[0].Folders, f => f.Id == deep);
        });
        // a team viewer may not write there, so the team is not offered
        await As(Role.Viewer, async biz => Assert.DoesNotContain(await FolderLogic.TreeAsync(biz), t => t.SpaceId == team));
    }

    // ------------------------------------------------------------------------------------------------ the browser

    [Fact]
    public async Task The_browser_query_filters_sorts_pages_and_shows_what_the_person_may_see()
    {
        if (!Enabled)
        {
            return;
        }

        var tag = Unique("Q");
        var (folder, space) = await As(Role.Designer, async biz =>
        {
            var f = await Folder(biz, tag + " Ordner");
            await DesignIn(biz, tag + " Banane");
            await DesignIn(biz, tag + " Apfel");
            await DesignIn(biz, tag + " Im Ordner", f.Id);
            await DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput(tag + " Liste", null, false));
            await AssetLogic.UploadAsync(biz, tag.ToLowerInvariant() + "-bild.png", Png(), null);
            return (f.Id, await biz.PersonalSpaceIdAsync());
        });

        await As(Role.Designer, async biz =>
        {
            // the top of the area: the folder first, then the rest by name
            var top = await ItemLogic.QueryAsync(biz, new ItemQuery { SpaceId = space, Q = tag, Sort = "name", Desc = false });
            Assert.Equal([ItemKind.Folder, ItemKind.Design, ItemKind.Design, ItemKind.Asset, ItemKind.DataList], top.Items.Select(i => i.Kind));
            Assert.Equal([tag + " Apfel", tag + " Banane"], top.Items.Where(i => i.Kind == ItemKind.Design).Select(i => i.Name));
            Assert.Equal(5, top.Total);
            Assert.All(top.Items, i => Assert.Equal(SpaceLogic.PersonalName, i.SpaceName));

            var inside = await ItemLogic.QueryAsync(biz, new ItemQuery { FolderId = folder });
            Assert.Equal([tag + " Im Ordner"], inside.Items.Select(i => i.Name));
            Assert.Equal(6, (await ItemLogic.QueryAsync(biz, new ItemQuery { SpaceId = space, Q = tag, Recursive = true })).Total);

            var onlyDesigns = await ItemLogic.QueryAsync(biz, new ItemQuery { SpaceId = space, Q = tag, Recursive = true, Kinds = [ItemKind.Design] });
            Assert.Equal(3, onlyDesigns.Total);
            var paged = await ItemLogic.QueryAsync(biz, new ItemQuery { SpaceId = space, Q = tag, Recursive = true, Kinds = [ItemKind.Design], Sort = "name", Desc = false, Skip = 1, Take = 1 });
            Assert.Equal(3, paged.Total);
            Assert.Equal([tag + " Banane"], paged.Items.Select(i => i.Name));
            Assert.Empty((await ItemLogic.QueryAsync(biz, new ItemQuery { SpaceId = space, Q = "gibt es sicher nicht " + tag })).Items);
        });

        // stars and "zuletzt verwendet"
        var first = await As(Role.Designer, async biz => (await ItemLogic.QueryAsync(biz, new ItemQuery { SpaceId = space, Q = tag + " Apfel" })).Items.Single());
        await As(Role.Designer, async biz =>
        {
            await ItemLogic.StarAsync(biz, ItemKind.Design, first.Id, true);
            await ItemLogic.StarAsync(biz, ItemKind.Design, first.Id, true);
            var starred = await ItemLogic.QueryAsync(biz, new ItemQuery { Scope = ItemScope.Starred });
            Assert.Equal([first.Id], starred.Items.Select(i => i.Id));
            Assert.True(starred.Items[0].Starred);
            await ItemLogic.VisitAsync(biz, ItemKind.Design, first.Id);
            Assert.Equal(first.Id, (await ItemLogic.RecentAsync(biz, 5))[0].Id);
            await ItemLogic.StarAsync(biz, ItemKind.Design, first.Id, false);
            Assert.Empty((await ItemLogic.QueryAsync(biz, new ItemQuery { Scope = ItemScope.Starred })).Items);
        });
        // somebody who may not see it cannot star it
        await As(Role.Stranger, biz => Assert.ThrowsAsync<NotFoundException>(() => ItemLogic.StarAsync(biz, ItemKind.Design, first.Id, true)));
        await As(Role.Stranger, async biz => Assert.Empty((await ItemLogic.QueryAsync(biz, new ItemQuery { SpaceId = space, Q = tag })).Items));
    }

    [Fact]
    public async Task What_was_shared_shows_up_under_Shared_with_the_folder_not_its_content()
    {
        if (!Enabled)
        {
            return;
        }

        var (folder, inFolder, single) = await As(Role.Designer, async biz =>
        {
            var f = await Folder(biz, "Geteilt");
            return (f.Id, await DesignIn(biz, "Drin", f.Id), await DesignIn(biz, "Einzeln"));
        });
        await ShareAsync(Role.Designer, ItemKind.Folder, folder, Role.Viewer);
        await ShareAsync(Role.Designer, ItemKind.Design, single, Role.Viewer);
        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Viewer));
        var inTeam = await As(Role.Designer, biz => DesignIn(biz, "Im Team", null, team));
        await As(Role.Viewer, async biz =>
        {
            var shared = (await ItemLogic.QueryAsync(biz, new ItemQuery { Scope = ItemScope.Shared })).Items.Select(i => (i.Kind, i.Id)).ToList();
            Assert.Contains((ItemKind.Folder, folder), shared);
            Assert.Contains((ItemKind.Design, single), shared);
            Assert.DoesNotContain((ItemKind.Design, inFolder), shared);   // it is reached through the folder
            Assert.DoesNotContain((ItemKind.Design, inTeam), shared);     // it is theirs through the membership
            Assert.Equal([inFolder], (await ItemLogic.QueryAsync(biz, new ItemQuery { FolderId = folder })).Items.Select(i => i.Id));
        });
    }

    // ------------------------------------------------------------------------------------------------ copy

    [Fact]
    public async Task Copying_makes_new_items_next_to_the_original_or_where_asked_and_copies_a_folder_with_its_content()
    {
        if (!Enabled)
        {
            return;
        }

        var (folder, design, list) = await As(Role.Designer, async biz =>
        {
            var f = await Folder(biz, "Quelle");
            var d = await DesignIn(biz, "Vorlage", f.Id);
            var l = (await DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput("Liste", null, false), null, f.Id)).Id;
            return (f.Id, d, l);
        });
        await As(Role.Designer, async biz =>
        {
            var copies = await ItemLogic.CopyAsync(biz, [new ItemRef(ItemKind.Folder, folder)], null, null);
            Assert.Equal(3, copies.Count);
            var newFolder = copies.Single(c => c.Kind == ItemKind.Folder).Id;
            Assert.NotEqual(folder, newFolder);
            Assert.Equal("Quelle (Kopie)", (await FolderLogic.GetAsync(biz, newFolder))!.Name);
            var inside = await ItemLogic.QueryAsync(biz, new ItemQuery { FolderId = newFolder });
            Assert.Equal(["Vorlage", "Liste"], inside.Items.Select(i => i.Name).OrderByDescending(n => n));
            Assert.DoesNotContain(inside.Items, i => i.Id == design || i.Id == list);
        });

        // a person with view rights copies into their own area
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer);
        await As(Role.Viewer, async biz =>
        {
            var copy = await ItemLogic.CopyAsync(biz, [new ItemRef(ItemKind.Design, design)], null, null);
            var made = await biz.Db.Design.AsNoTracking().FirstAsync(d => d.Id == copy.Single().Id);
            Assert.Equal(await biz.PersonalSpaceIdAsync(), made.SpaceId);
            Assert.Equal("Vorlage (Kopie)", made.Name);
        });
        await As(Role.Stranger, biz => Assert.ThrowsAsync<NotFoundException>(() => ItemLogic.CopyAsync(biz, [new ItemRef(ItemKind.Design, design)], null, null)));
    }

    // ------------------------------------------------------------------------------------------------ trash

    [Fact]
    public async Task Trashing_a_folder_takes_its_content_along_and_restoring_it_brings_that_content_back_only()
    {
        if (!Enabled)
        {
            return;
        }

        var (outer, inner, a, b, earlier, bytesAsset) = await As(Role.Designer, async biz =>
        {
            var o = await Folder(biz, "Außen");
            var i = await Folder(biz, "Innen", o.Id);
            var x = await DesignIn(biz, "X", o.Id);
            var y = await DesignIn(biz, "Y", i.Id);
            var z = await DesignIn(biz, "Schon weg", i.Id);
            await ItemLogic.TrashAsync(biz, [new ItemRef(ItemKind.Design, z)]);   // in the trash before the folder
            var asset = (await AssetLogic.UploadAsync(biz, Unique("im-ordner-") + ".png", Png(), null, null, i.Id)).Asset!.Id;
            return (o.Id, i.Id, x, y, z, asset);
        });

        await As(Role.Designer, async biz =>
        {
            await ItemLogic.TrashAsync(biz, [new ItemRef(ItemKind.Folder, outer)]);
            Assert.Null(await FolderLogic.GetAsync(biz, outer));
            Assert.Null(await FolderLogic.GetAsync(biz, inner));
            Assert.Null(await DesignLogic.GetAsync(biz, a));
            Assert.Null(await DesignLogic.GetAsync(biz, b));
            var inTrash = (await ItemLogic.QueryAsync(biz, new ItemQuery { Scope = ItemScope.Trash })).Items.Select(i => (i.Kind, i.Id)).ToList();
            Assert.Contains((ItemKind.Folder, outer), inTrash);
            Assert.Contains((ItemKind.Design, earlier), inTrash);
            Assert.Equal(outer, (await biz.Db.Design.AsNoTracking().FirstAsync(d => d.Id == a)).TrashedWithFolderId);
            Assert.Equal(outer, (await biz.Db.Folder.AsNoTracking().FirstAsync(f => f.Id == inner)).TrashedWithFolderId);
            Assert.Null((await biz.Db.Design.AsNoTracking().FirstAsync(d => d.Id == earlier)).TrashedWithFolderId);
            Assert.Null((await biz.Db.Folder.AsNoTracking().FirstAsync(f => f.Id == outer)).TrashedWithFolderId);

            await ItemLogic.RestoreAsync(biz, [new ItemRef(ItemKind.Folder, outer)]);
            Assert.NotNull(await FolderLogic.GetAsync(biz, inner));
            Assert.NotNull(await DesignLogic.GetAsync(biz, a));
            Assert.NotNull(await DesignLogic.GetAsync(biz, b));
            Assert.Null(await DesignLogic.GetAsync(biz, earlier));   // it was in the trash on its own
            Assert.True((await biz.Db.Asset.AsNoTracking().FirstAsync(x => x.Id == bytesAsset)).TrashedDate is null);
        });
    }

    [Fact]
    public async Task An_item_whose_folder_is_in_the_trash_is_restored_to_the_top_of_its_area()
    {
        if (!Enabled)
        {
            return;
        }

        var (folder, design) = await As(Role.Designer, async biz =>
        {
            var f = await Folder(biz, "Wird gelöscht");
            var d = await DesignIn(biz, "Einzeln gelöscht", f.Id);
            await ItemLogic.TrashAsync(biz, [new ItemRef(ItemKind.Design, d)]);
            await ItemLogic.TrashAsync(biz, [new ItemRef(ItemKind.Folder, f.Id)]);
            return (f.Id, d);
        });
        await As(Role.Designer, async biz =>
        {
            await ItemLogic.RestoreAsync(biz, [new ItemRef(ItemKind.Design, design)]);
            var restored = await biz.Db.Design.AsNoTracking().FirstAsync(d => d.Id == design);
            Assert.Null(restored.FolderId);
            Assert.Null(restored.TrashedDate);
            Assert.Null(await FolderLogic.GetAsync(biz, folder));
        });
    }

    [Fact]
    public async Task Deleting_for_good_removes_the_content_the_shares_and_the_bytes_and_frees_the_storage()
    {
        if (!Enabled)
        {
            return;
        }

        var (folder, design, asset, list) = await As(Role.Designer, async biz =>
        {
            var f = await Folder(biz, "Endgültig");
            var d = await DesignIn(biz, "Weg", f.Id);
            var a = (await AssetLogic.UploadAsync(biz, Unique("endgueltig-") + ".png", Png(), null, null, f.Id)).Asset!;
            var l = (await DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput("Weg", null, false), null, f.Id)).Id;
            await ItemLogic.StarAsync(biz, ItemKind.Design, d, true);
            return (f.Id, d, a.Id, l);
        });
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer);
        var personal = await As(Role.Designer, biz => biz.PersonalSpaceIdAsync());
        Assert.True(await Db(db => StorageLogic.UsedBytesAsync(db, personal)) > 0);

        await As(Role.Designer, async biz =>
        {
            await Assert.ThrowsAsync<NotFoundException>(() => ItemLogic.PurgeAsync(biz, [new ItemRef(ItemKind.Folder, folder)]));   // only what is in the trash
            await ItemLogic.TrashAsync(biz, [new ItemRef(ItemKind.Folder, folder)]);
            await ItemLogic.PurgeAsync(biz, [new ItemRef(ItemKind.Folder, folder)]);
            Assert.Empty(await Access.VisibleTrashed<Design>(biz).Where(d => d.Id == design).ToListAsync());
            Assert.DoesNotContain((await ItemLogic.QueryAsync(biz, new ItemQuery { Scope = ItemScope.Trash })).Items, i => i.Id == design || i.Id == folder);
        });
        Assert.False(await Db(db => db.Design.AnyAsync(d => d.Id == design)));
        Assert.False(await Db(db => db.Asset.AnyAsync(a => a.Id == asset)));
        Assert.False(await Db(db => db.Share.AnyAsync(s => s.ItemKind == ItemKind.Design && s.ItemId == design)));
        Assert.False(await Db(db => db.Star.AnyAsync(s => s.ItemKind == ItemKind.Design && s.ItemId == design)));
        Assert.False(await Db(db => db.DataList.AnyAsync(l => l.Id == list)));
        var (bytes, used) = await Db(async db => (await db.Asset.IgnoreQueryFilters().Where(a => a.Id == asset).Select(a => a.Bytes.Length).FirstAsync(), await StorageLogic.UsedBytesAsync(db, personal)));
        Assert.Equal(0, bytes);
        Assert.Equal(0, used);
    }

    [Fact]
    public async Task The_purger_removes_what_has_been_in_the_trash_for_too_long_and_nothing_else()
    {
        if (!Enabled)
        {
            return;
        }

        var (old, recent, kept) = await As(Role.Designer, async biz =>
        {
            var o = await DesignIn(biz, "Alt im Papierkorb");
            var r = await DesignIn(biz, "Neu im Papierkorb");
            var k = await DesignIn(biz, "Bleibt");
            await ItemLogic.TrashAsync(biz, [new ItemRef(ItemKind.Design, o), new ItemRef(ItemKind.Design, r)]);
            return (o, r, k);
        });
        await Db(db => db.Design.Where(d => d.Id == old).ExecuteUpdateAsync(s => s.SetProperty(d => d.TrashedDate, DateTime.UtcNow.AddDays(-31))));
        var purger = Factory.Services.GetRequiredService<TrashPurger>();
        Assert.True(await purger.RunOnceAsync() >= 1);
        Assert.False(await Db(db => db.Design.AnyAsync(d => d.Id == old)));
        Assert.True(await Db(db => db.Design.AnyAsync(d => d.Id == recent)));
        Assert.True(await Db(db => db.Design.AnyAsync(d => d.Id == kept)));
        await As(Role.Designer, async biz => Assert.Single((await ItemLogic.QueryAsync(biz, new ItemQuery { Scope = ItemScope.Trash })).Items, i => i.Id == recent));
        // a second round finds nothing more of it
        Assert.Equal(0, await Db(db => db.Design.IgnoreQueryFilters().CountAsync(d => d.Id == old && d.UpdateState != UpdateState.Deleted)));
    }

    // ------------------------------------------------------------------------------------------------ quota

    [Fact]
    public async Task An_upload_font_or_import_over_the_storage_of_the_area_is_refused()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await TeamAsync(Role.Designer);
        var admin = Role.Admin;
        var png = Png();
        await As(admin, biz => StorageLogic.SetQuotaAsync(biz, team, png.Length * 2L + 5));
        await As(Role.Designer, async biz =>
        {
            Assert.NotNull((await AssetLogic.UploadAsync(biz, Unique("eins-") + ".png", png, null, team)).Asset);
            var usage = await StorageLogic.UsageAsync(biz, team);
            Assert.Equal(((long)png.Length, png.Length * 2L + 5), (usage.UsedBytes, usage.QuotaBytes));
            Assert.NotNull((await AssetLogic.UploadAsync(biz, Unique("zwei-") + ".png", [.. png, 0], null, team)).Asset);

            var full = await AssetLogic.UploadAsync(biz, Unique("drei-") + ".png", [.. png, 0, 0], null, team);
            Assert.Null(full.Asset);
            Assert.Contains("Speicherplatz", full.Error);
            var font = await FontLogic.UploadAsync(biz, "Gross.ttf", [0, 1, 0, 0, 5, 2, 3, 4, 5, 6, 7, 8], null, team);
            Assert.Null(font.Font);
            Assert.Contains("Speicherplatz", font.Error);

        });

        // the limit of the platform: the default of a team, and one set for an area wins
        await As(admin, biz => StorageLogic.SetQuotaAsync(biz, team, null));
        await As(Role.Designer, async biz =>
        {
            var usage = await StorageLogic.UsageAsync(biz, team);
            Assert.Equal(10240L * 1024 * 1024, usage.QuotaBytes);
            Assert.True(usage.Fraction < 0.01);
            var personal = await StorageLogic.UsageAsync(biz, await biz.PersonalSpaceIdAsync());
            Assert.Equal(2048L * 1024 * 1024, personal.QuotaBytes);
        });
        await As(Role.Designer, biz => Assert.ThrowsAsync<ForbiddenException>(() => StorageLogic.SetQuotaAsync(biz, team, 1)));
    }
}
