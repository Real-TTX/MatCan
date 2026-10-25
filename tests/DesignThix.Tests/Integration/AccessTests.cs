using DesignThix.Core.Documents;
using DesignThix.Data;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.Services;
using DesignThix.Tests.Core;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DesignThix.Tests.Integration;

/// <summary>
/// The access matrix of the platform (docs/PLAN-PLATFORM.md section 3 and 5, phase P1): for every kind of item (design, data list, output job, folder, image) and every way to get at it (owner, team Owner,
/// Admin, Editor and Viewer, a share with a person or a team, a folder share three levels up, a signed-in link, a revoked or expired link, a public link, a stranger, a platform administrator, the trash) the
/// level that results, whether the SQL filter <see cref="Access.Visible{T}"/> agrees, and what the business layer lets that person do: a method that reads, one that changes and one that manages. A missing
/// or invisible item is a 404 (<see cref="NotFoundException"/>), a visible one with too low a level a 403 (<see cref="ForbiddenException"/>). Runs when DESIGNTHIX_TEST_DB names a server.
/// </summary>
[Collection("app")]
public sealed class AccessTests(AppTests.AppFactory factory) : PlatformTestBase(factory)
{
    /// <summary>The ways to get at an item.</summary>
    public enum Way
    {
        Owner,
        TeamOwner,
        TeamAdmin,
        TeamEditor,
        TeamViewer,
        ShareView,
        ShareEdit,
        TeamShareView,
        TeamShareEdit,
        FolderShareView,
        FolderShareEdit,
        LinkView,
        LinkEdit,
        RevokedLink,
        ExpiredLink,
        PublicLinkOnly,
        Stranger,
        PlatformAdmin,
        Trashed,
    }

    private static readonly Dictionary<Way, AccessLevel> Expected = new()
    {
        [Way.Owner] = AccessLevel.Manage,
        [Way.TeamOwner] = AccessLevel.Manage,
        [Way.TeamAdmin] = AccessLevel.Manage,
        [Way.TeamEditor] = AccessLevel.Manage,
        [Way.TeamViewer] = AccessLevel.View,
        [Way.ShareView] = AccessLevel.View,
        [Way.ShareEdit] = AccessLevel.Edit,
        [Way.TeamShareView] = AccessLevel.View,
        [Way.TeamShareEdit] = AccessLevel.Edit,
        [Way.FolderShareView] = AccessLevel.View,
        [Way.FolderShareEdit] = AccessLevel.Edit,
        [Way.LinkView] = AccessLevel.View,
        [Way.LinkEdit] = AccessLevel.Edit,
        [Way.RevokedLink] = AccessLevel.None,
        [Way.ExpiredLink] = AccessLevel.None,
        [Way.PublicLinkOnly] = AccessLevel.None,
        [Way.Stranger] = AccessLevel.None,
        [Way.PlatformAdmin] = AccessLevel.None,
        [Way.Trashed] = AccessLevel.None,
    };

    /// <summary>The ways that make sense for a kind: an image is never shared on its own, a public link is for designs and folders.</summary>
    private static bool Applies(Way way, ItemKind kind) => kind switch
    {
        ItemKind.Asset => way is not (Way.ShareView or Way.ShareEdit or Way.TeamShareView or Way.TeamShareEdit or Way.LinkView or Way.LinkEdit or Way.RevokedLink or Way.ExpiredLink or Way.PublicLinkOnly),
        ItemKind.DataList or ItemKind.OutputJob => way != Way.PublicLinkOnly,
        _ => true,
    };

    public static TheoryData<Way, ItemKind> Cases
    {
        get
        {
            var data = new TheoryData<Way, ItemKind>();
            foreach (var kind in new[] { ItemKind.Design, ItemKind.DataList, ItemKind.OutputJob, ItemKind.Folder, ItemKind.Asset })
            {
                foreach (var way in Enum.GetValues<Way>().Where(w => Applies(w, kind)))
                {
                    data.Add(way, kind);
                }
            }

            return data;
        }
    }

    private sealed record Fixture(long OwnerId, long PersonId, UserRole PersonRole, long ItemId);

    private static byte[] Png() => File.ReadAllBytes(Path.Combine(RepoFiles.WwwRoot(), "img", "icon-192.png"));

    /// <summary>Makes an item of the kind in a place and returns its id.</summary>
    private async Task<long> MakeAsync(long ownerId, ItemKind kind, long? space, long? folder)
    {
        var name = kind + " " + Guid.NewGuid().ToString("N")[..6];
        return await AsUser(ownerId, async biz =>
        {
            switch (kind)
            {
                case ItemKind.Design:
                    return (await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign(name, null, "a4-portrait", null, null, null, null, space, folder))).Id;
                case ItemKind.DataList:
                    return (await DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput(name, null, false), space, folder)).Id;
                case ItemKind.OutputJob:
                    var design = await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign(name, null, "a4-portrait", null, null, null, null, space, folder));
                    return (await OutputLogic.SaveAsync(biz, null, JobInput(name, design.Id), space, folder)).Id;
                case ItemKind.Folder:
                    return (await FolderLogic.CreateAsync(biz, space, folder, name)).Id;
                default:
                    var result = await AssetLogic.UploadAsync(biz, name.Replace(' ', '-') + ".png", Png(), null, space, folder);
                    return result.Asset!.Id;
            }
        });
    }

    private static OutputLogic.OutputInput JobInput(string name, long designId)
        => new(name, designId, null, OutputRowSelection.All, [], 1, OutputMode.Single, null, false, OutputScale.Fit, 1, OutputFormat.Print, null, null);

    /// <summary>Builds the situation of a way: who the person is, and the item they try to get at.</summary>
    private async Task<Fixture> BuildAsync(Way way, ItemKind kind)
    {
        var owner = await UserAsync("owner");
        var person = await UserAsync("person");
        var role = UserRole.Member;
        long item;
        var spaceRole = way switch { Way.TeamOwner => SpaceRole.Owner, Way.TeamAdmin => SpaceRole.Admin, Way.TeamEditor => SpaceRole.Editor, Way.TeamViewer => SpaceRole.Viewer, _ => (SpaceRole?)null };
        if (spaceRole is { } sr)
        {
            // the team is the owner's; the person is a member with the role
            var team = await AsUser(owner, biz => SpaceLogic.CreateTeamAsync(biz, "Team " + Guid.NewGuid().ToString("N")[..6]));
            await AsUser(owner, biz => SpaceLogic.AddMemberAsync(biz, team.Id, person, sr));

            item = await MakeAsync(owner, kind, team.Id, null);
            return new Fixture(owner, person, role, item);
        }

        switch (way)
        {
            case Way.Owner:
                item = await MakeAsync(owner, kind, null, null);
                return new Fixture(owner, owner, role, item);
            case Way.ShareView:
            case Way.ShareEdit:
                item = await MakeAsync(owner, kind, null, null);
                await AsUser(owner, biz => ShareLogic.AddAsync(biz, kind, item, false, person, way == Way.ShareEdit ? SharePermission.Edit : SharePermission.View));
                return new Fixture(owner, person, role, item);
            case Way.TeamShareView:
            case Way.TeamShareEdit:
                // the person is a Viewer of a team; the item of the owner is shared with the team: the share counts, not the role
                var shared = await AsUser(owner, biz => SpaceLogic.CreateTeamAsync(biz, "Team " + Guid.NewGuid().ToString("N")[..6]));
                await AsUser(owner, biz => SpaceLogic.AddMemberAsync(biz, shared.Id, person, SpaceRole.Viewer));
                item = await MakeAsync(owner, kind, null, null);
                await AsUser(owner, biz => ShareLogic.AddAsync(biz, kind, item, true, shared.Id, way == Way.TeamShareEdit ? SharePermission.Edit : SharePermission.View));
                return new Fixture(owner, person, role, item);
            case Way.FolderShareView:
            case Way.FolderShareEdit:
                // three levels down: /f1/f2/f3/item; f1 is shared (for a folder the item is f3)
                var f1 = await MakeAsync(owner, ItemKind.Folder, null, null);
                var f2 = await MakeAsync(owner, ItemKind.Folder, null, f1);
                var f3 = await MakeAsync(owner, ItemKind.Folder, null, f2);
                await AsUser(owner, biz => ShareLogic.AddAsync(biz, ItemKind.Folder, f1, false, person, way == Way.FolderShareEdit ? SharePermission.Edit : SharePermission.View));
                item = kind == ItemKind.Folder ? f3 : await MakeAsync(owner, kind, null, f3);
                return new Fixture(owner, person, role, item);
            case Way.LinkView:
            case Way.LinkEdit:
            case Way.RevokedLink:
            case Way.ExpiredLink:
                item = await MakeAsync(owner, kind, null, null);
                var permission = way == Way.LinkEdit ? SharePermission.Edit : SharePermission.View;
                var link = await AsUser(owner, biz => ShareLogic.SetLinkAsync(biz, kind, item, LinkAudience.SignedIn, permission, false, null));
                await AsUser(person, biz => ShareLogic.OpenAsync(biz, link.Token));
                if (way == Way.RevokedLink)
                {
                    await AsUser(owner, biz => ShareLogic.RevokeLinkAsync(biz, kind, item));
                }

                if (way == Way.ExpiredLink)
                {
                    await Db(db => db.ShareLink.Where(l => l.Id == link.Id).ExecuteUpdateAsync(s => s.SetProperty(l => l.ExpiresDate, DateTime.UtcNow.AddMinutes(-5))));
                }

                return new Fixture(owner, person, role, item);
            case Way.PublicLinkOnly:
                item = await MakeAsync(owner, kind, null, null);
                var publicLink = await AsUser(owner, biz => ShareLogic.SetLinkAsync(biz, kind, item, LinkAudience.Public, SharePermission.View, true, null));
                await AsUser(person, async biz => Assert.Equal(AccessLevel.None, await Access.LevelAsync(biz, kind, item)));
                Assert.NotEqual(Guid.Empty, publicLink.Token);
                return new Fixture(owner, person, role, item);
            case Way.PlatformAdmin:
                item = await MakeAsync(owner, kind, null, null);
                return new Fixture(owner, person, UserRole.Admin, item);
            case Way.Trashed:
                item = await MakeAsync(owner, kind, null, null);
                await AsUser(owner, biz => ItemLogic.TrashAsync(biz, [new ItemRef(kind, item)]));
                return new Fixture(owner, owner, role, item);
            default:
                item = await MakeAsync(owner, kind, null, null);
                return new Fixture(owner, person, role, item);
        }
    }

    // ------------------------------------------------------------------------------------------------ the level and the SQL filter

    private static async Task<List<long>> VisibleIdsAsync(Biz biz, ItemKind kind, AccessLevel min, long id) => kind switch
    {
        ItemKind.Design => await Access.Visible<Design>(biz, min).Where(x => x.Id == id).Select(x => x.Id).ToListAsync(),
        ItemKind.DataList => await Access.Visible<DataList>(biz, min).Where(x => x.Id == id).Select(x => x.Id).ToListAsync(),
        ItemKind.OutputJob => await Access.Visible<OutputJob>(biz, min).Where(x => x.Id == id).Select(x => x.Id).ToListAsync(),
        ItemKind.Folder => await Access.Visible<Folder>(biz, min).Where(x => x.Id == id).Select(x => x.Id).ToListAsync(),
        _ => await Access.Visible<Asset>(biz, min).Where(x => x.Id == id).Select(x => x.Id).ToListAsync(),
    };

    [Theory]
    [MemberData(nameof(Cases))]
    public async Task The_level_and_the_visible_lists_follow_the_way_to_the_item(Way way, ItemKind kind)
    {
        if (!Enabled)
        {
            return;
        }

        var f = await BuildAsync(way, kind);
        var expected = Expected[way];
        await AsUser(f.PersonId, async biz =>
        {
            Assert.Equal(expected, await Access.LevelAsync(biz, kind, f.ItemId));
            foreach (var min in new[] { AccessLevel.View, AccessLevel.Edit, AccessLevel.Manage })
            {
                var listed = (await VisibleIdsAsync(biz, kind, min, f.ItemId)).Count == 1;
                Assert.True(listed == expected >= min, $"{way}/{kind}: Visible(min {min}) {(listed ? "has" : "lacks")} the item, the level is {expected}");
            }
        }, f.PersonRole);
    }

    // ------------------------------------------------------------------------------------------------ what the business layer lets the person do

    private static Func<Biz, Task>? Read(ItemKind kind, long id) => kind switch
    {
        ItemKind.Design => async biz => await DesignLogic.DocumentAsync(biz, id),
        ItemKind.DataList => async biz => await DataListLogic.GridAsync(biz, id),
        ItemKind.OutputJob => async biz => await OutputLogic.MarkRanAsync(biz, id),
        ItemKind.Folder => async biz => await FolderLogic.BreadcrumbAsync(biz, id),
        _ => async biz => await ItemLogic.StarAsync(biz, ItemKind.Asset, id, true),
    };

    private static Func<Biz, Task>? Write(ItemKind kind, long id) => kind switch
    {
        ItemKind.Design => async biz => await DesignLogic.RenameAsync(biz, id, "geändert"),
        ItemKind.DataList => async biz => await DataListLogic.SaveGeneralAsync(biz, id, new DataListLogic.ListInput("geändert", null, false)),
        ItemKind.OutputJob => async biz => await OutputLogic.SaveAsync(biz, id, JobInput("geändert", 0)),
        ItemKind.Folder => async biz => await FolderLogic.CreateAsync(biz, null, id, "unter"),
        _ => null,
    };

    private static Func<Biz, Task> Manage(ItemKind kind, long id) => kind switch
    {
        ItemKind.Design => async biz => await DesignLogic.DeleteAsync(biz, id),
        ItemKind.DataList => async biz => await DataListLogic.DeleteAsync(biz, id),
        ItemKind.OutputJob => async biz => await OutputLogic.DeleteAsync(biz, id),
        ItemKind.Folder => async biz => await FolderLogic.RenameAsync(biz, id, "umbenannt"),
        _ => async biz => await AssetLogic.UpdateAsync(biz, id, new AssetLogic.AssetInput("neu-" + Guid.NewGuid().ToString("N")[..6], "umbenannt", "Sonstiges", null)),
    };

    /// <summary>Passes unless the call is refused for lack of access (a message about the input, like a design that is missing for the job, is not a refusal).</summary>
    private static async Task<Exception?> RunAsync(Func<Biz, Task> call, Biz biz)
    {
        try
        {
            await call(biz);
            return null;
        }
        catch (Exception ex) when (ex is not (NotFoundException or ForbiddenException))
        {
            return null;
        }
        catch (Exception ex)
        {
            return ex;
        }
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public async Task Methods_that_read_change_and_manage_are_refused_by_the_level(Way way, ItemKind kind)
    {
        if (!Enabled)
        {
            return;
        }

        var f = await BuildAsync(way, kind);
        var level = Expected[way];
        await AsUser(f.PersonId, async biz =>
        {
            void Check(string what, AccessLevel needed, Exception? refused)
            {
                if (level == AccessLevel.None)
                {
                    Assert.True(refused is NotFoundException, $"{way}/{kind}: {what} should be a 404 for somebody who may not see the item, was {refused?.GetType().Name ?? "allowed"}");
                }
                else if (level >= needed)
                {
                    Assert.True(refused is null, $"{way}/{kind}: {what} should be allowed at level {level}, was {refused?.GetType().Name}: {refused?.Message}");
                }
                else
                {
                    Assert.True(refused is ForbiddenException, $"{way}/{kind}: {what} should be a 403 at level {level}, was {refused?.GetType().Name ?? "allowed"}");
                }
            }

            Check("read", AccessLevel.View, await RunAsync(Read(kind, f.ItemId)!, biz));
            if (Write(kind, f.ItemId) is { } write)
            {
                Check("change", AccessLevel.Edit, await RunAsync(write, biz));
            }

            Check("manage", AccessLevel.Manage, await RunAsync(Manage(kind, f.ItemId), biz));
        }, f.PersonRole);
    }

    // ------------------------------------------------------------------------------------------------ a few things the matrix cannot say

    [Fact]
    public async Task What_the_platform_owns_is_for_everybody_to_view_and_for_administrators_to_manage()
    {
        if (!Enabled)
        {
            return;
        }

        // a built-in image and a system template (the demo): no area
        var (flag, template) = await Db(async db => (
            await db.Asset.Where(a => a.IsBuiltIn).Select(a => a.Id).FirstAsync(),
            await db.Design.Where(d => d.IsTemplate && d.SpaceId == null).Select(d => d.Id).FirstAsync()));
        await As(Role.Stranger, async biz =>
        {
            Assert.Equal(AccessLevel.View, await Access.LevelAsync(biz, ItemKind.Asset, flag));
            Assert.Equal(AccessLevel.View, await Access.LevelAsync(biz, ItemKind.Design, template));
            await Assert.ThrowsAsync<ForbiddenException>(() => DesignLogic.RenameAsync(biz, template, "mein"));
            await Assert.ThrowsAsync<ForbiddenException>(() => AssetLogic.DeleteAsync(biz, flag));
        });
        await As(Role.Admin, async biz =>
        {
            Assert.Equal(AccessLevel.Manage, await Access.LevelAsync(biz, ItemKind.Asset, flag));
            Assert.Equal(AccessLevel.Manage, await Access.LevelAsync(biz, ItemKind.Design, template));
        });
    }

    [Fact]
    public async Task A_platform_administrator_gets_nothing_of_the_content_of_others_from_the_role()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await As(Role.Designer, async biz => (await DesignLogic.CreateFromFormatAsync(biz, "a4-portrait", null, null, null, "Privat")).Id);
        await As(Role.Admin, async biz =>
        {
            Assert.Empty(await Access.Visible<Design>(biz).Where(d => d.Id == design).ToListAsync());
            Assert.Null(await DesignLogic.GetAsync(biz, design));
            Assert.Null(await DesignLogic.LoadAsync(biz, design));
            await Assert.ThrowsAsync<NotFoundException>(() => DesignLogic.DocumentAsync(biz, design));
            var found = await ItemLogic.QueryAsync(biz, new ItemQuery { Q = "Privat", Recursive = true });
            Assert.Empty(found.Items);
        });
    }

    [Fact]
    public async Task A_trashed_item_is_seen_in_the_trash_by_the_people_who_manage_it_and_by_nobody_else()
    {
        if (!Enabled)
        {
            return;
        }

        var id = await As(Role.Designer, async biz => (await DesignLogic.CreateFromFormatAsync(biz, "a4-portrait", null, null, null, "Weg damit")).Id);
        await ShareAsync(Role.Designer, ItemKind.Design, id, Role.Viewer);
        await As(Role.Designer, biz => DesignLogic.DeleteAsync(biz, id));
        await As(Role.Designer, async biz =>
        {
            Assert.Null(await DesignLogic.GetAsync(biz, id));
            Assert.Single(await Access.VisibleTrashed<Design>(biz).Where(d => d.Id == id).ToListAsync());
            Assert.Single((await ItemLogic.QueryAsync(biz, new ItemQuery { Scope = ItemScope.Trash })).Items, r => r.Id == id);
        });
        await As(Role.Viewer, async biz =>
        {
            Assert.Null(await DesignLogic.GetAsync(biz, id));
            Assert.Empty(await Access.VisibleTrashed<Design>(biz).Where(d => d.Id == id).ToListAsync());
            await Assert.ThrowsAsync<NotFoundException>(() => DesignLogic.DocumentAsync(biz, id));
        });
    }

    [Fact]
    public async Task Sharing_with_a_team_counts_for_every_role_of_the_team()
    {
        if (!Enabled)
        {
            return;
        }

        // a team Viewer who gets an Edit share through the team may change the design: any team role counts as the team
        var design = await As(Role.Designer, async biz => (await DesignLogic.CreateFromFormatAsync(biz, "a4-portrait", null, null, null, "Für das Team")).Id);
        var team = await TeamAsync(Role.Stranger, (Role.Viewer, SpaceRole.Viewer), (Role.Designer, SpaceRole.Editor));
        await As(Role.Designer, biz => ShareLogic.AddAsync(biz, ItemKind.Design, design, true, team, SharePermission.Edit));
        await As(Role.Viewer, async biz =>
        {
            Assert.Equal(AccessLevel.Edit, await Access.LevelAsync(biz, ItemKind.Design, design));
            await DesignLogic.RenameAsync(biz, design, "vom Betrachter");
        });
    }

    [Fact]
    public async Task Fonts_sheet_layouts_and_the_brand_follow_the_membership_of_the_area()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Viewer));
        var layout = await As(Role.Designer, async biz => (await SheetLogic.SaveAsync(biz, null, new SheetLogic.SheetInput("Teambogen", 210, 297, 0, 0, 1, 1, 100, 100, 0, 0, false), team)).Id);
        await As(Role.Viewer, async biz =>
        {
            Assert.Contains(await SheetLogic.Query(biz).ToListAsync(), s => s.Id == layout);
            await Assert.ThrowsAsync<ForbiddenException>(() => SheetLogic.DeleteAsync(biz, layout));
            await Assert.ThrowsAsync<ForbiddenException>(() => BrandLogic.SaveAsync(biz, new BrandKit { Colors = ["#ff0000"] }, team));
            Assert.Empty((await BrandLogic.GetAsync(biz, team)).Kit.Colors);
        });
        await As(Role.Stranger, async biz =>
        {
            Assert.DoesNotContain(await SheetLogic.Query(biz).ToListAsync(), s => s.Id == layout);
            await Assert.ThrowsAsync<NotFoundException>(() => SheetLogic.DeleteAsync(biz, layout));
            await Assert.ThrowsAsync<NotFoundException>(() => BrandLogic.GetAsync(biz, team));
        });
        await As(Role.Designer, async biz =>
        {
            var saved = await BrandLogic.SaveAsync(biz, new BrandKit { Colors = ["#ff0000"] }, team);
            Assert.Equal(["#ff0000"], saved.Kit.Colors);
            await SheetLogic.DeleteAsync(biz, layout);
        });
        // the personal brand kit is the person's own, and a built-in sheet layout may only be changed by an administrator
        var builtIn = await Db(db => db.SheetLayout.Where(s => s.IsBuiltIn).Select(s => s.Id).FirstAsync());
        await As(Role.Designer, async biz =>
        {
            await BrandLogic.SaveAsync(biz, new BrandKit { Colors = ["#00ff00"] });
            Assert.Equal(["#00ff00"], (await BrandLogic.GetAsync(biz)).Kit.Colors);
            Assert.Contains(await SheetLogic.Query(biz).ToListAsync(), s => s.Id == builtIn);
            await Assert.ThrowsAsync<ForbiddenException>(() => SheetLogic.DeleteAsync(biz, builtIn));
        });
    }
}
