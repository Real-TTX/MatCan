using MatCan.Data.Entities;
using MatCan.Logic;
using Microsoft.EntityFrameworkCore;

namespace MatCan.Tests.Integration;

/// <summary>The administration of accounts (docs/PLAN-PLATFORM.md section 1.16): the state of an account, the role, deleting with a transfer of the content, the storage limits and the rules of the platform.</summary>
[Collection("app")]
public sealed class AccountAdminTests(AppTests.AppFactory factory) : PlatformTestBase(factory)
{
    private Task<T> AsAdmin<T>(long id, Func<Biz, Task<T>> action) => AsUser(id, action, UserRole.Admin);

    private Task AsAdmin(long id, Func<Biz, Task> action) => AsUser(id, action, UserRole.Admin);

    private async Task<(long Design, long List, long Folder)> ContentOfAsync(long person)
        => await AsUser(person, async biz =>
        {
            var folder = (await FolderLogic.CreateAsync(biz, null, null, "Mein Ordner")).Id;
            var design = (await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign("Mein Design", null, "a4-portrait", null, null, null, null, null, folder))).Id;
            var loose = (await DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput("Meine Liste", null, false))).Id;
            return (design, loose, folder);
        });

    [Fact]
    public async Task The_state_of_an_account_changes_through_the_administrator_and_the_last_administrator_stays()
    {
        if (!Enabled)
        {
            return;
        }

        await using var admins = await RealAdminsAsync(2);
        var (first, second) = (admins.Ids[0], admins.Ids[1]);
        var member = await UserAsync("mitglied");

        await AsAdmin(first, biz => UserLogic.SetActiveAsync(biz, member, false));
        Assert.False(await Db(db => db.User.Where(u => u.Id == member).Select(u => u.IsActive).SingleAsync()));
        await AsAdmin(first, biz => UserLogic.SetActiveAsync(biz, member, true));
        await AsAdmin(first, biz => UserLogic.SetRoleAsync(biz, member, UserRole.Admin));
        Assert.Equal(UserRole.Admin, await Db(db => db.User.Where(u => u.Id == member).Select(u => u.Role).SingleAsync()));
        await AsAdmin(first, biz => UserLogic.SetRoleAsync(biz, member, UserRole.Member));

        // you cannot take the rights or the access from yourself
        await AsAdmin(first, biz => Assert.ThrowsAsync<BizException>(() => UserLogic.SetActiveAsync(biz, first, false)));
        await AsAdmin(first, biz => Assert.ThrowsAsync<BizException>(() => UserLogic.SetRoleAsync(biz, first, UserRole.Member)));
        // the last active administrator is never switched off or made a member
        await AsAdmin(first, biz => UserLogic.SetActiveAsync(biz, second, false));
        var lastOne = await AsAdmin(second, biz => Assert.ThrowsAsync<BizException>(() => UserLogic.SetRoleAsync(biz, first, UserRole.Member)));
        Assert.Contains("einzige aktive Administrator", lastOne.Message);
        await AsAdmin(first, biz => UserLogic.SetActiveAsync(biz, second, true));

        // approval: a pending account is approved (and active), a declined one can be approved later
        var pending = await UserAsync("wartend");
        await Db(db => db.User.Where(u => u.Id == pending).ExecuteUpdateAsync(s => s.SetProperty(u => u.ApprovalState, ApprovalState.Pending)));
        // other tests leave accounts that wait: count against what is there
        var before = await Db(db => db.User.CountAsync(u => u.ApprovalState == ApprovalState.Pending)) - 1;
        Assert.Equal(before + 1, await AsAdmin(first, biz => UserLogic.PendingCountAsync(biz)));
        await AsAdmin(first, biz => UserLogic.SetApprovalAsync(biz, pending, false));
        Assert.Equal(ApprovalState.Declined, await Db(db => db.User.Where(u => u.Id == pending).Select(u => u.ApprovalState).SingleAsync()));
        await AsAdmin(first, biz => UserLogic.SetApprovalAsync(biz, pending, true));
        Assert.Equal(ApprovalState.Approved, await Db(db => db.User.Where(u => u.Id == pending).Select(u => u.ApprovalState).SingleAsync()));
        Assert.Equal(before, await AsAdmin(first, biz => UserLogic.PendingCountAsync(biz)));
    }

    [Fact]
    public async Task Deleting_an_account_can_hand_its_content_to_a_person_in_a_folder_of_its_own()
    {
        if (!Enabled)
        {
            return;
        }

        await using var admins = await RealAdminsAsync();
        var leaver = await UserAsync("geht");
        var heir = await UserAsync("erbt");
        var colleague = await UserAsync("kollege");
        var (design, list, folder) = await ContentOfAsync(leaver);
        // what the leaver shared with a colleague stays reachable for them through the new place; what was shared WITH the leaver ends
        await AsUser(colleague, async biz =>
        {
            var theirs = (await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign("Vom Kollegen", null, "a4-portrait", null, null, null, null, null))).Id;
            await ShareLogic.AddAsync(biz, ItemKind.Design, theirs, false, leaver, SharePermission.View);
        });
        var team = (await AsUser(leaver, biz => SpaceLogic.CreateTeamAsync(biz, "Team vom Gehenden " + Guid.NewGuid().ToString("N")[..4]))).Id;
        await AsUser(leaver, biz => SpaceLogic.AddMemberAsync(biz, team, colleague, SpaceRole.Admin));

        await AsAdmin(admins.Ids[0], biz => UserLogic.DeleteAsync(biz, leaver, new UserLogic.TransferTarget(heir, null)));

        var heirSpace = await AsUser(heir, biz => biz.PersonalSpaceIdAsync());
        var wrapper = await Db(db => db.Folder.SingleAsync(f => f.SpaceId == heirSpace && f.Name == "Übernommen von geht"));
        Assert.Null(wrapper.ParentId);
        Assert.Equal($"/{wrapper.Id}/", wrapper.Path);
        var movedFolder = await Db(db => db.Folder.SingleAsync(f => f.Id == folder));
        Assert.Equal((heirSpace, wrapper.Id), (movedFolder.SpaceId, movedFolder.ParentId));
        Assert.StartsWith(wrapper.Path, movedFolder.Path);
        var movedDesign = await Db(db => db.Design.SingleAsync(d => d.Id == design));
        Assert.Equal((heirSpace, folder), (movedDesign.SpaceId, movedDesign.FolderId));
        var movedList = await Db(db => db.DataList.SingleAsync(d => d.Id == list));
        Assert.Equal((heirSpace, wrapper.Id), (movedList.SpaceId, movedList.FolderId));
        // the heir works with it (and is told)
        await AsUser(heir, async biz =>
        {
            Assert.NotNull(await DesignLogic.GetAsync(biz, design));
            Assert.Equal(AccessLevel.Manage, await Access.LevelAsync(biz, ItemKind.Design, design));
        });
        Assert.Contains(await Db(db => db.Notification.Where(n => n.UserId == heir).Select(n => n.Kind).ToListAsync()), k => k == NotificationKinds.ContentTransferred);

        // the account is gone, with its memberships and the shares made with it
        Assert.False(await Db(db => db.User.AnyAsync(u => u.Id == leaver)));
        Assert.False(await Db(db => db.SpaceMember.AnyAsync(m => m.UserId == leaver)));
        Assert.False(await Db(db => db.Share.AnyAsync(s => s.UserId == leaver)));
        // the team the leaver owned alone, with a team Admin: that Admin is the Owner now
        Assert.Equal(SpaceRole.Owner, await Db(db => db.SpaceMember.Where(m => m.SpaceId == team && m.UserId == colleague).Select(m => m.Role).SingleAsync()));
        Assert.Contains(await Db(db => db.Notification.Where(n => n.UserId == colleague).Select(n => n.Kind).ToListAsync()), k => k == NotificationKinds.TeamRole);
    }

    [Fact]
    public async Task Deleting_an_account_can_hand_its_content_to_a_team_and_without_a_target_it_goes_to_the_trash()
    {
        if (!Enabled)
        {
            return;
        }

        await using var admins = await RealAdminsAsync();
        var leaver = await UserAsync("geht-ins-team");
        var teamOwner = await UserAsync("teamchef");
        var teamMember = await UserAsync("teammitglied");
        var team = (await AsUser(teamOwner, biz => SpaceLogic.CreateTeamAsync(biz, "Erbteam " + Guid.NewGuid().ToString("N")[..4]))).Id;
        await AsUser(teamOwner, biz => SpaceLogic.AddMemberAsync(biz, team, teamMember, SpaceRole.Editor));
        var (design, _, _) = await ContentOfAsync(leaver);

        // a target that does not exist stops the deletion before anything changes
        await AsAdmin(admins.Ids[0], biz => Assert.ThrowsAsync<BizException>(() => UserLogic.DeleteAsync(biz, leaver, new UserLogic.TransferTarget(null, 987_654_321))));
        await AsAdmin(admins.Ids[0], biz => Assert.ThrowsAsync<BizException>(() => UserLogic.DeleteAsync(biz, leaver, new UserLogic.TransferTarget(leaver, null))));
        Assert.True(await Db(db => db.User.AnyAsync(u => u.Id == leaver)));
        // the personal area of the person is no team
        var personal = await AsUser(teamOwner, biz => biz.PersonalSpaceIdAsync());
        await AsAdmin(admins.Ids[0], biz => Assert.ThrowsAsync<BizException>(() => UserLogic.DeleteAsync(biz, leaver, new UserLogic.TransferTarget(null, personal))));

        await AsAdmin(admins.Ids[0], biz => UserLogic.DeleteAsync(biz, leaver, new UserLogic.TransferTarget(null, team)));
        Assert.Equal(team, await Db(db => db.Design.Where(d => d.Id == design).Select(d => d.SpaceId!.Value).SingleAsync()));
        await AsUser(teamMember, async biz => Assert.NotNull(await DesignLogic.GetAsync(biz, design)));
        Assert.Contains(await Db(db => db.Notification.Where(n => n.UserId == teamMember).Select(n => n.Kind).ToListAsync()), k => k == NotificationKinds.ContentTransferred);

        // without a target: the trash
        var second = await UserAsync("geht-in-den-papierkorb");
        var (design2, _, _) = await ContentOfAsync(second);
        await AsAdmin(admins.Ids[0], biz => UserLogic.DeleteAsync(biz, second));
        Assert.True(await Db(db => db.Design.AnyAsync(d => d.Id == design2 && d.TrashedDate != null)));
    }

    [Fact]
    public async Task A_sole_owner_with_no_admin_in_the_team_blocks_the_deletion_with_a_message_and_nothing_changes()
    {
        if (!Enabled)
        {
            return;
        }

        await using var admins = await RealAdminsAsync();
        var owner = await UserAsync("alleiniger-inhaber");
        var editor = await UserAsync("nur-bearbeiter");
        var team = (await AsUser(owner, biz => SpaceLogic.CreateTeamAsync(biz, "Blockiert " + Guid.NewGuid().ToString("N")[..4]))).Id;
        await AsUser(owner, biz => SpaceLogic.AddMemberAsync(biz, team, editor, SpaceRole.Editor));
        var (design, _, _) = await ContentOfAsync(owner);
        var blocked = await AsAdmin(admins.Ids[0], biz => Assert.ThrowsAsync<BizException>(() => UserLogic.DeleteAsync(biz, owner, new UserLogic.TransferTarget(editor, null))));
        Assert.Contains("einzige Inhaber", blocked.Message);
        Assert.Contains("keinen Admin", blocked.Message);
        Assert.True(await Db(db => db.User.AnyAsync(u => u.Id == owner)));
        Assert.Equal(await AsUser(owner, biz => biz.PersonalSpaceIdAsync()), await Db(db => db.Design.Where(d => d.Id == design).Select(d => d.SpaceId!.Value).SingleAsync()));
        Assert.True(await Db(db => db.SpaceMember.AnyAsync(m => m.SpaceId == team && m.UserId == owner && m.Role == SpaceRole.Owner)));
        // a team the person was alone in goes with them
        var solo = (await AsUser(editor, biz => SpaceLogic.CreateTeamAsync(biz, "Allein " + Guid.NewGuid().ToString("N")[..4]))).Id;
        await AsAdmin(admins.Ids[0], biz => UserLogic.DeleteAsync(biz, editor));
        Assert.False(await Db(db => db.Space.AnyAsync(s => s.Id == solo)));
    }

    [Fact]
    public async Task The_default_storage_comes_from_the_platform_settings_and_the_administrator_sets_a_limit_per_person_and_team()
    {
        if (!Enabled)
        {
            return;
        }

        await using var admins = await RealAdminsAsync();
        var person = await UserAsync("speicher");
        var team = await TeamAsync(Role.Designer);
        var space = await AsUser(person, biz => biz.PersonalSpaceIdAsync());
        const long Mb = 1024L * 1024;
        await using (await PlatformAsync(new PlatformSettings { PersonalQuotaMb = 7, TeamQuotaMb = 11 }))
        {
            Assert.Equal(7 * Mb, (await AsUser(person, biz => StorageLogic.UsageAsync(biz, space))).QuotaBytes);
            Assert.Equal(11 * Mb, (await As(Role.Designer, biz => StorageLogic.UsageAsync(biz, team))).QuotaBytes);
            Assert.Equal(7 * Mb, (await AsAdmin(admins.Ids[0], biz => UserLogic.PersonalStorageAsync(biz, person)))!.QuotaBytes);

            // a limit of its own beats the default; empty goes back to it
            await AsAdmin(admins.Ids[0], biz => UserLogic.SetPersonalQuotaAsync(biz, person, 3));
            Assert.Equal(3 * Mb, (await AsUser(person, biz => StorageLogic.UsageAsync(biz, space))).QuotaBytes);
            await AsAdmin(admins.Ids[0], biz => StorageLogic.SetQuotaAsync(biz, team, 5 * Mb));
            Assert.Equal(5 * Mb, (await As(Role.Designer, biz => StorageLogic.UsageAsync(biz, team))).QuotaBytes);
            // an upload over the limit is refused with the sizes in the message
            var tooBig = await AsUser(person, biz => Assert.ThrowsAsync<BizException>(() => StorageLogic.RequireRoomAsync(biz, space, 4 * Mb)));
            Assert.Contains("reicht nicht", tooBig.Message);
            await AsUser(person, biz => StorageLogic.RequireRoomAsync(biz, space, 2 * Mb));
            await AsAdmin(admins.Ids[0], biz => UserLogic.SetPersonalQuotaAsync(biz, person, null));
            Assert.Equal(7 * Mb, (await AsUser(person, biz => StorageLogic.UsageAsync(biz, space))).QuotaBytes);
            await AsAdmin(admins.Ids[0], biz => Assert.ThrowsAsync<BizException>(() => StorageLogic.SetQuotaAsync(biz, team, -1)));
        }
    }

    [Fact]
    public async Task The_platform_settings_are_saved_by_the_administrator_and_change_what_the_platform_allows()
    {
        if (!Enabled)
        {
            return;
        }

        var old = await As(Role.Admin, biz => Task.FromResult(biz.Platform));
        try
        {
            await As(Role.Designer, biz => Assert.ThrowsAsync<ForbiddenException>(() => SettingLogic.SaveAsync(biz, SettingStore.Platform, new PlatformSettings(), "x")));
            await As(Role.Admin, biz => SettingLogic.SaveAsync(biz, SettingStore.Platform, new PlatformSettings
            {
                Registration = "approval",
                AllowedDomains = ["firma.example"],
                MembersMayInvite = false,
                MembersMayCreateTeams = false,
                PublicLinks = false,
                PersonalQuotaMb = 100,
                TeamQuotaMb = 200,
                TrashDays = 5,
            }, "Plattform-Einstellungen geändert"));
            var now = await As(Role.Designer, biz => Task.FromResult(biz.Platform));
            Assert.Equal(("approval", false, false, false, 100, 200, 5), (now.Registration, now.MembersMayInvite, now.MembersMayCreateTeams, now.PublicLinks, now.PersonalQuotaMb, now.TeamQuotaMb, now.TrashDays));
            Assert.Equal(["firma.example"], now.AllowedDomains);
            // what the settings switch off is switched off for members, not for the administrator
            await As(Role.Designer, biz => Assert.ThrowsAsync<ForbiddenException>(() => SpaceLogic.CreateTeamAsync(biz, "Nein")));
            await As(Role.Designer, biz => Assert.ThrowsAsync<ForbiddenException>(() => InviteLogic.CreateAsync(biz, null, SpaceRole.Editor, null, true, 7, 1)));
            await As(Role.Admin, biz => InviteLogic.CreateAsync(biz, null, SpaceRole.Editor, null, true, 7, 1));
            Assert.True(await As(Role.Admin, biz => Task.FromResult(SpaceLogic.MayCreateTeam(biz))));
            Assert.False(await As(Role.Designer, biz => Task.FromResult(SpaceLogic.MayCreateTeam(biz))));
        }
        finally
        {
            await As(Role.Admin, biz => SettingLogic.SaveAsync(biz, SettingStore.Platform, old, "Test zurückgesetzt"));
        }
    }
}
