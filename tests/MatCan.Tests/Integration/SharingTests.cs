using MatCan.Data.Entities;
using MatCan.Logic;
using MatCan.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MatCan.Tests.Integration;

/// <summary>The rules of sharing (docs/PLAN-PLATFORM.md sections 1.6 and 3): who may share what with whom, the links of the kinds that may have them, the list of who has access, the search.</summary>
[Collection("app")]
public sealed class SharingTests(AppTests.AppFactory factory) : PlatformTestBase(factory)
{
    private async Task<long> DesignAsync(Role who, string name = "Geteilt", long? folder = null)
        => await As(who, async biz => (await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign(name, null, "a4-portrait", null, null, null, null, null, folder))).Id);

    private Task ShareDesignAsync(Role who, long id, Role with, SharePermission permission) => ShareAsync(who, ItemKind.Design, id, with, permission);

    // ------------------------------------------------------------------------------------------------ who may share what

    [Fact]
    public async Task Manage_shares_with_view_or_edit_edit_shares_but_no_links_and_view_cannot_share()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(Role.Designer);
        await ShareDesignAsync(Role.Designer, design, Role.Viewer, SharePermission.View);
        await ShareDesignAsync(Role.Designer, design, Role.Stranger, SharePermission.Edit);
        var third = await UserAsync("third");
        var viewer = await UserAsync(Role.Viewer);

        await As(Role.Viewer, async biz =>
        {
            await Assert.ThrowsAsync<ForbiddenException>(() => ShareLogic.AddAsync(biz, ItemKind.Design, design, false, third, SharePermission.View));
            await Assert.ThrowsAsync<ForbiddenException>(() => ShareLogic.SetLinkAsync(biz, ItemKind.Design, design, LinkAudience.SignedIn, SharePermission.View, false, null));
            var info = await ShareLogic.InfoAsync(biz, ItemKind.Design, design);
            Assert.False(info.CanShare);
            Assert.False(info.CanLink);
            Assert.Null(info.Link);
        });

        long shareOfEditor = 0;
        await As(Role.Stranger, async biz =>
        {
            // edit rights: share with people up to Edit, but no links
            shareOfEditor = (await ShareLogic.AddAsync(biz, ItemKind.Design, design, false, third, SharePermission.Edit)).Id;
            await Assert.ThrowsAsync<ForbiddenException>(() => ShareLogic.SetLinkAsync(biz, ItemKind.Design, design, LinkAudience.SignedIn, SharePermission.View, false, null));
            await Assert.ThrowsAsync<ForbiddenException>(() => ShareLogic.RevokeLinkAsync(biz, ItemKind.Design, design));
            var info = await ShareLogic.InfoAsync(biz, ItemKind.Design, design);
            Assert.True(info.CanShare);
            Assert.False(info.CanLink);
            // they change and remove only what they made themselves
            var theirs = info.Entries.Single(e => e.UserId == third);
            var others = info.Entries.Single(e => e.UserId == viewer);
            Assert.True(theirs.CanChange);
            Assert.False(others.CanChange);
            await Assert.ThrowsAsync<ForbiddenException>(() => ShareLogic.ChangeAsync(biz, others.ShareId!.Value, SharePermission.Edit));
            await Assert.ThrowsAsync<ForbiddenException>(() => ShareLogic.RemoveAsync(biz, others.ShareId!.Value));
            await ShareLogic.ChangeAsync(biz, shareOfEditor, SharePermission.View);
        });
        await As(Role.Designer, async biz =>
        {
            var info = await ShareLogic.InfoAsync(biz, ItemKind.Design, design);
            Assert.All(info.Entries.Where(e => e.ShareId is not null), e => Assert.True(e.CanChange));
            Assert.Equal("view", info.Entries.Single(e => e.UserId == third).Permission);
            await ShareLogic.RemoveAsync(biz, shareOfEditor);
            Assert.DoesNotContain((await ShareLogic.InfoAsync(biz, ItemKind.Design, design)).Entries, e => e.UserId == third);
            await ShareLogic.AddAsync(biz, ItemKind.Design, design, false, viewer, SharePermission.Edit);   // a share that is there is changed, not doubled
            Assert.Single((await ShareLogic.InfoAsync(biz, ItemKind.Design, design)).Entries, e => e.UserId == viewer && e.ShareId != null);
        });
        await As(Role.Viewer, async biz => Assert.Equal(AccessLevel.Edit, await Access.LevelAsync(biz, ItemKind.Design, design)));
    }

    [Fact]
    public async Task Only_people_with_an_active_approved_account_and_teams_of_the_sharer_can_be_shared_with()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(Role.Designer);
        var self = await UserAsync(Role.Designer);
        var pending = await UserAsync("pending");
        var inactive = await UserAsync("inactive");
        await Db(db => db.User.Where(u => u.Id == pending).ExecuteUpdateAsync(s => s.SetProperty(u => u.ApprovalState, ApprovalState.Pending)));
        await Db(db => db.User.Where(u => u.Id == inactive).ExecuteUpdateAsync(s => s.SetProperty(u => u.IsActive, false)));
        var foreignTeam = await TeamAsync(Role.Stranger);
        await As(Role.Designer, async biz =>
        {
            await Assert.ThrowsAsync<BizException>(() => ShareLogic.AddAsync(biz, ItemKind.Design, design, false, self, SharePermission.View));
            await Assert.ThrowsAsync<BizException>(() => ShareLogic.AddAsync(biz, ItemKind.Design, design, false, pending, SharePermission.View));
            await Assert.ThrowsAsync<BizException>(() => ShareLogic.AddAsync(biz, ItemKind.Design, design, false, inactive, SharePermission.View));
            await Assert.ThrowsAsync<BizException>(() => ShareLogic.AddAsync(biz, ItemKind.Design, design, false, 987654321, SharePermission.View));
            await Assert.ThrowsAsync<BizException>(() => ShareLogic.AddAsync(biz, ItemKind.Design, design, true, foreignTeam, SharePermission.View));
            var personalSpace = await biz.PersonalSpaceIdAsync();
            await Assert.ThrowsAsync<BizException>(() => ShareLogic.AddAsync(biz, ItemKind.Design, design, true, personalSpace, SharePermission.View));
            // images are not shared on their own
            var image = (await AssetLogic.UploadAsync(biz, "teilen-" + Guid.NewGuid().ToString("N")[..6] + ".png", File.ReadAllBytes(Path.Combine(MatCan.Tests.Core.RepoFiles.WwwRoot(), "img", "icon-192.png")), null)).Asset!;
            await Assert.ThrowsAsync<BizException>(() => ShareLogic.AddAsync(biz, ItemKind.Asset, image.Id, false, 1, SharePermission.View));
        });
    }

    // ------------------------------------------------------------------------------------------------ links

    [Fact]
    public async Task A_public_link_is_for_designs_and_folders_only_and_only_while_the_administrator_allows_it()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(Role.Designer);
        var (list, job, folder) = await As(Role.Designer, async biz => (
            (await DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput("Liste", null, false))).Id,
            (await OutputLogic.SaveAsync(biz, null, new OutputLogic.OutputInput("Lauf", design, null, OutputRowSelection.All, [], 1, OutputMode.Single, null, false, OutputScale.Fit, 1, OutputFormat.Print, null, null))).Id,
            (await FolderLogic.CreateAsync(biz, null, null, "Ordner")).Id));
        try
        {
            await As(Role.Designer, async biz =>
            {
                var publicLink = await ShareLogic.SetLinkAsync(biz, ItemKind.Design, design, LinkAudience.Public, SharePermission.Edit, true, DateTime.UtcNow.AddDays(3));
                Assert.Equal((LinkAudience.Public, SharePermission.View, true), (publicLink.Audience, publicLink.Permission, publicLink.AllowDownload));   // a public link only looks
                Assert.NotEqual(Guid.Empty, (await ShareLogic.SetLinkAsync(biz, ItemKind.Folder, folder, LinkAudience.Public, SharePermission.View, false, null)).Token);
                await Assert.ThrowsAsync<BizException>(() => ShareLogic.SetLinkAsync(biz, ItemKind.DataList, list, LinkAudience.Public, SharePermission.View, false, null));
                await Assert.ThrowsAsync<BizException>(() => ShareLogic.SetLinkAsync(biz, ItemKind.OutputJob, job, LinkAudience.Public, SharePermission.View, false, null));
                // the others may have a link that needs a sign-in
                Assert.NotEqual(Guid.Empty, (await ShareLogic.SetLinkAsync(biz, ItemKind.DataList, list, LinkAudience.SignedIn, SharePermission.View, false, null)).Token);
                await Assert.ThrowsAsync<BizException>(() => ShareLogic.SetLinkAsync(biz, ItemKind.Design, design, LinkAudience.SignedIn, SharePermission.View, false, DateTime.UtcNow.AddDays(-1)));
            });

            await As(Role.Admin, biz => SettingLogic.SaveAsync(biz, SettingStore.Platform, new PlatformSettings { PublicLinks = false }, "Test"));
            await As(Role.Designer, async biz =>
            {
                var again = await Assert.ThrowsAsync<BizException>(() => ShareLogic.SetLinkAsync(biz, ItemKind.Folder, folder, LinkAudience.Public, SharePermission.View, false, null));
                Assert.Contains("ausgeschaltet", again.Message);
                var info = await ShareLogic.InfoAsync(biz, ItemKind.Design, design);
                Assert.False(info.PublicLinksAllowed);
                Assert.False(info.PublicLinkPossible);
                // a link that needs a sign-in still works
                await ShareLogic.SetLinkAsync(biz, ItemKind.Design, design, LinkAudience.SignedIn, SharePermission.View, false, null);
            });
        }
        finally
        {
            await As(Role.Admin, biz => SettingLogic.SaveAsync(biz, SettingStore.Platform, new PlatformSettings(), "Test"));
        }
    }

    [Fact]
    public async Task A_link_with_a_sign_in_grants_the_permission_until_it_is_reset_revoked_or_expired()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(Role.Designer);
        var link = await As(Role.Designer, biz => ShareLogic.SetLinkAsync(biz, ItemKind.Design, design, LinkAudience.SignedIn, SharePermission.Edit, false, null));
        await As(Role.Viewer, async biz => Assert.Equal(AccessLevel.None, await Access.LevelAsync(biz, ItemKind.Design, design)));

        // opening grants; the link is the secret, so the answer for a made-up token is "not valid"
        await As(Role.Viewer, async biz =>
        {
            Assert.Null(await ShareLogic.OpenAsync(biz, Guid.NewGuid()));
            var target = await ShareLogic.OpenAsync(biz, link.Token);
            Assert.Equal((ItemKind.Design, design, SharePermission.Edit), (target!.Kind, target.ItemId, target.Permission));
            Assert.Equal(AccessLevel.Edit, await Access.LevelAsync(biz, ItemKind.Design, design));
            await ShareLogic.OpenAsync(biz, link.Token);   // again: still one grant
            var found = (await ItemLogic.QueryAsync(biz, new ItemQuery { Scope = ItemScope.Shared })).Items;
            Assert.Contains(found, i => i.Id == design);
        });
        Assert.Equal(1, await Db(db => db.LinkGrant.CountAsync(g => g.ShareLinkId == link.Id)));

        // without a sign-in the link says what it points to, as long as it lives
        await Db(async db => Assert.Equal(design, (await ShareLogic.ResolveAsync(db, link.Token, DateTime.UtcNow))!.ItemId));

        // the person gives the access up
        await As(Role.Viewer, async biz =>
        {
            await ShareLogic.RemoveLinkGrantAsync(biz, ItemKind.Design, design);
            Assert.Equal(AccessLevel.None, await Access.LevelAsync(biz, ItemKind.Design, design));
            await ShareLogic.OpenAsync(biz, link.Token);
            Assert.Equal(AccessLevel.Edit, await Access.LevelAsync(biz, ItemKind.Design, design));
        });

        // a reset makes the old link dead (and its grants), the new one has its own token and the same settings
        var fresh = await As(Role.Designer, biz => ShareLogic.ResetLinkAsync(biz, ItemKind.Design, design));
        Assert.NotEqual(link.Token, fresh.Token);
        Assert.Equal((LinkAudience.SignedIn, SharePermission.Edit), (fresh.Audience, fresh.Permission));
        await As(Role.Viewer, async biz =>
        {
            Assert.Equal(AccessLevel.None, await Access.LevelAsync(biz, ItemKind.Design, design));
            Assert.Null(await ShareLogic.OpenAsync(biz, link.Token));
            Assert.NotNull(await ShareLogic.OpenAsync(biz, fresh.Token));
            Assert.Equal(AccessLevel.Edit, await Access.LevelAsync(biz, ItemKind.Design, design));
        });
        await Db(async db => Assert.Null(await ShareLogic.ResolveAsync(db, link.Token, DateTime.UtcNow)));

        // it can be changed (a person who has opened it keeps their grant, with the new permission)
        await As(Role.Designer, biz => ShareLogic.SetLinkAsync(biz, ItemKind.Design, design, LinkAudience.SignedIn, SharePermission.View, false, null));
        await As(Role.Viewer, async biz => Assert.Equal(AccessLevel.View, await Access.LevelAsync(biz, ItemKind.Design, design)));

        // expired, then revoked
        await Db(db => db.ShareLink.Where(l => l.Id == fresh.Id).ExecuteUpdateAsync(s => s.SetProperty(l => l.ExpiresDate, DateTime.UtcNow.AddMinutes(-1))));
        await As(Role.Viewer, async biz =>
        {
            Assert.Equal(AccessLevel.None, await Access.LevelAsync(biz, ItemKind.Design, design));
            Assert.Null(await ShareLogic.OpenAsync(biz, fresh.Token));
        });
        await As(Role.Designer, async biz =>
        {
            var again = await ShareLogic.SetLinkAsync(biz, ItemKind.Design, design, LinkAudience.SignedIn, SharePermission.View, false, null);
            Assert.Equal(fresh.Id, again.Id);   // one link per item: it is changed, and the date is gone
            await ShareLogic.RevokeLinkAsync(biz, ItemKind.Design, design);
            Assert.Null((await ShareLogic.InfoAsync(biz, ItemKind.Design, design)).Link);
            await Assert.ThrowsAsync<BizException>(() => ShareLogic.ResetLinkAsync(biz, ItemKind.Design, design));
        });
    }

    [Fact]
    public async Task A_link_of_a_folder_reaches_everything_in_it_and_a_link_to_a_trashed_item_is_dead()
    {
        if (!Enabled)
        {
            return;
        }

        var folder = await As(Role.Designer, async biz => (await FolderLogic.CreateAsync(biz, null, null, "Linkordner")).Id);
        var inside = await DesignAsync(Role.Designer, "Drin", folder);
        var link = await As(Role.Designer, biz => ShareLogic.SetLinkAsync(biz, ItemKind.Folder, folder, LinkAudience.SignedIn, SharePermission.View, false, null));
        await As(Role.Viewer, async biz =>
        {
            await ShareLogic.OpenAsync(biz, link.Token);
            Assert.Equal(AccessLevel.View, await Access.LevelAsync(biz, ItemKind.Design, inside));
        });
        await As(Role.Designer, biz => ItemLogic.TrashAsync(biz, [new ItemRef(ItemKind.Folder, folder)]));
        await As(Role.Viewer, async biz =>
        {
            Assert.Equal(AccessLevel.None, await Access.LevelAsync(biz, ItemKind.Design, inside));
            Assert.Null(await ShareLogic.OpenAsync(biz, link.Token));
        });
    }

    // ------------------------------------------------------------------------------------------------ who has access, and the search

    [Fact]
    public async Task The_list_of_who_has_access_names_the_owner_the_team_the_shares_and_what_comes_from_a_folder()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Viewer));
        var (folder, design) = await As(Role.Designer, async biz =>
        {
            var f = (await FolderLogic.CreateAsync(biz, team, null, "Ordner im Team")).Id;
            return (f, (await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign("Im Ordner", null, "a4-portrait", null, null, null, null, null, f))).Id);
        });
        var stranger = await UserAsync(Role.Stranger);
        await As(Role.Designer, biz => ShareLogic.AddAsync(biz, ItemKind.Folder, folder, false, stranger, SharePermission.Edit));
        var third = await UserAsync("dritter");
        await As(Role.Designer, biz => ShareLogic.AddAsync(biz, ItemKind.Design, design, false, third, SharePermission.View));
        await As(Role.Designer, async biz =>
        {
            await ShareLogic.SetLinkAsync(biz, ItemKind.Design, design, LinkAudience.SignedIn, SharePermission.View, false, null);
            var info = await ShareLogic.InfoAsync(biz, ItemKind.Design, design);
            Assert.Equal("Im Ordner", info.Name);
            Assert.Equal(AccessLevel.Manage, info.MyLevel);
            Assert.Equal(SpaceKind.Team, info.SpaceKind);
            Assert.NotNull(info.Link);
            Assert.Equal(2, info.Entries.Count(e => e.Kind == "member"));
            var viaFolder = info.Entries.Single(e => e.UserId == stranger);
            Assert.True(viaFolder.Inherited);
            Assert.Equal((folder, "Ordner im Team", "edit", false), (viaFolder.ViaFolderId, viaFolder.ViaFolderName, viaFolder.Permission, viaFolder.CanChange));
            Assert.False(info.Entries.Single(e => e.UserId == third).Inherited);
            Assert.Equal("view", info.Entries.Single(e => e.Kind == "member" && e.Role == SpaceRole.Viewer).Permission);
            Assert.Equal("manage", info.Entries.Single(e => e.Kind == "member" && e.Role == SpaceRole.Owner).Permission);
        });
        // a viewer of the team sees the list but not the link
        await As(Role.Viewer, async biz =>
        {
            var info = await ShareLogic.InfoAsync(biz, ItemKind.Design, design);
            Assert.Null(info.Link);
            Assert.NotEmpty(info.Entries);
        });
        await As(Role.Stranger, async biz => Assert.Equal(AccessLevel.Edit, (await ShareLogic.InfoAsync(biz, ItemKind.Design, design)).MyLevel));
    }

    [Fact]
    public async Task The_search_needs_two_characters_shows_at_most_eight_active_approved_people_and_the_teams_of_the_person()
    {
        if (!Enabled)
        {
            return;
        }

        var tag = "suche" + Guid.NewGuid().ToString("N")[..6];
        var ids = new List<long>();
        for (var i = 0; i < 11; i++)
        {
            ids.Add(await UserAsync($"{tag}-{i:00}"));
        }

        await Db(db => db.User.Where(u => u.Id == ids[0]).ExecuteUpdateAsync(s => s.SetProperty(u => u.IsActive, false)));
        await Db(db => db.User.Where(u => u.Id == ids[1]).ExecuteUpdateAsync(s => s.SetProperty(u => u.ApprovalState, ApprovalState.Pending)));
        var team = await As(Role.Designer, biz => SpaceLogic.CreateTeamAsync(biz, "Gruppe " + tag));
        await As(Role.Designer, async biz =>
        {
            Assert.Empty(await ShareLogic.SearchAsync(biz, null));
            Assert.Empty(await ShareLogic.SearchAsync(biz, "s"));
            Assert.Empty(await ShareLogic.SearchAsync(biz, " " + tag[..1] + " "));
            var found = await ShareLogic.SearchAsync(biz, tag);
            Assert.Equal(8, found.Count);
            Assert.Equal("team", found[0].Type);
            Assert.Equal(team.Id, found[0].Id);
            Assert.All(found.Skip(1), r => Assert.Equal("user", r.Type));
            Assert.DoesNotContain(found, r => r.Id == ids[0] || r.Id == ids[1]);
            var byMail = await ShareLogic.SearchAsync(biz, $"{tag}-05");
            Assert.Equal(ids[5], Assert.Single(byMail, r => r.Type == "user").Id);
            Assert.Contains("@test.local", byMail.Single(r => r.Type == "user").Email);
            Assert.DoesNotContain(await ShareLogic.SearchAsync(biz, "Designer"), r => r.Id == biz.UserId);   // the person themselves is left out
            // a % is no wildcard
            Assert.Empty(await ShareLogic.SearchAsync(biz, tag + "%%"));
        });
        // somebody else's team does not turn up
        await As(Role.Stranger, async biz => Assert.DoesNotContain(await ShareLogic.SearchAsync(biz, "Gruppe " + tag), r => r.Type == "team"));
    }
}
