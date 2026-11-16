using MatCan.Data.Entities;
using MatCan.Logic;
using MatCan.Services;
using Microsoft.EntityFrameworkCore;

namespace MatCan.Tests.Integration;

/// <summary>The areas of the platform: the personal area every account has and the teams with their members and roles (docs/PLAN-PLATFORM.md section 1.12 and 1.13).</summary>
[Collection("app")]
public sealed class SpaceTests(AppTests.AppFactory factory) : PlatformTestBase(factory)
{
    [Fact]
    public async Task Every_account_has_a_personal_area_of_its_own_with_nobody_but_the_owner()
    {
        if (!Enabled)
        {
            return;
        }

        var spaces = await As(Role.Designer, biz => SpaceLogic.MySpacesAsync(biz));
        var personal = Assert.Single(spaces);
        Assert.Equal((SpaceKind.Personal, SpaceLogic.PersonalName, SpaceRole.Owner, 1), (personal.Kind, personal.Name, personal.MyRole, personal.MemberCount));
        var other = await UserAsync(Role.Viewer);
        await As(Role.Designer, async biz =>
        {
            await Assert.ThrowsAsync<BizException>(() => SpaceLogic.AddMemberAsync(biz, personal.Id, other, SpaceRole.Viewer));
            await Assert.ThrowsAsync<BizException>(() => SpaceLogic.DeleteTeamAsync(biz, personal.Id, SpaceLogic.PersonalName));
        });
        await As(Role.Viewer, async biz =>
        {
            Assert.Equal(await biz.PersonalSpaceIdAsync(), (await SpaceLogic.MySpacesAsync(biz)).Single().Id);
            await Assert.ThrowsAsync<NotFoundException>(() => SpaceLogic.GetAsync(biz, personal.Id));
        });
        // an account made by an administrator gets one too
        var created = await As(Role.Admin, biz => UserLogic.SaveAsync(biz, null, new UserLogic.UserInput("Neu", $"neu-{Guid.NewGuid():N}@test.local", null, UserRole.Member, true, "ein-gutes-Passwort")));
        Assert.NotNull(created.PersonalSpaceId);
        Assert.Equal(SpaceRole.Owner, await Db(db => db.SpaceMember.Where(m => m.SpaceId == created.PersonalSpaceId && m.UserId == created.Id).Select(m => (SpaceRole?)m.Role).FirstOrDefaultAsync()));
    }

    [Fact]
    public async Task A_team_has_a_slug_that_is_unique_and_an_owner_who_made_it()
    {
        if (!Enabled)
        {
            return;
        }

        var name = "Mein Team " + Guid.NewGuid().ToString("N")[..6];
        var first = await As(Role.Designer, biz => SpaceLogic.CreateTeamAsync(biz, name, "  Beschreibung  ", "#112233"));
        var second = await As(Role.Viewer, biz => SpaceLogic.CreateTeamAsync(biz, name));
        Assert.StartsWith("mein-team-", first.Slug);
        Assert.Equal(first.Slug + "-2", second.Slug);
        Assert.Equal(("Beschreibung", "#112233"), (first.Description, first.Color));
        await As(Role.Designer, async biz =>
        {
            var mine = Assert.Single(await SpaceLogic.MyTeamsAsync(biz));
            Assert.Equal((first.Id, SpaceRole.Owner), (mine.Id, mine.MyRole));
            Assert.Equal(first.Id, (await SpaceLogic.GetBySlugAsync(biz, first.Slug!))!.Id);
            Assert.Null(await SpaceLogic.GetBySlugAsync(biz, second.Slug!));
            await Assert.ThrowsAsync<BizException>(() => SpaceLogic.CreateTeamAsync(biz, "   "));
            // a new name makes a new slug that is free
            var renamed = await SpaceLogic.UpdateTeamAsync(biz, first.Id, "Anderer Name " + Guid.NewGuid().ToString("N")[..4], null, null);
            Assert.StartsWith("anderer-name-", renamed.Slug);
            Assert.Equal("#112233", renamed.Color);
        });
    }

    [Fact]
    public async Task The_administrator_may_switch_off_that_members_make_teams()
    {
        if (!Enabled)
        {
            return;
        }

        try
        {
            await As(Role.Admin, biz => SettingLogic.SaveAsync(biz, SettingStore.Platform, new PlatformSettings { MembersMayCreateTeams = false }, "Test"));
            await As(Role.Designer, biz => Assert.ThrowsAsync<ForbiddenException>(() => SpaceLogic.CreateTeamAsync(biz, "Verboten")));
            await As(Role.Admin, async biz => Assert.NotNull(await SpaceLogic.CreateTeamAsync(biz, "Vom Admin " + Guid.NewGuid().ToString("N")[..4])));
        }
        finally
        {
            await As(Role.Admin, biz => SettingLogic.SaveAsync(biz, SettingStore.Platform, new PlatformSettings(), "Test"));
        }
    }

    [Fact]
    public async Task Roles_members_and_the_last_owner_follow_the_rules_of_the_team()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Admin), (Role.Stranger, SpaceRole.Editor));
        var owner = await UserAsync(Role.Designer);
        var admin = await UserAsync(Role.Viewer);
        var editor = await UserAsync(Role.Stranger);
        var newcomer = await UserAsync("newcomer");
        var another = await UserAsync("noch einer");

        await As(Role.Viewer, async biz =>
        {
            // an admin of the team adds and removes members, but does not make owners, and does not touch the owner
            await SpaceLogic.AddMemberAsync(biz, team, newcomer, SpaceRole.Viewer);
            await Assert.ThrowsAsync<BizException>(() => SpaceLogic.AddMemberAsync(biz, team, newcomer, SpaceRole.Editor));   // there already
            await Assert.ThrowsAsync<ForbiddenException>(() => SpaceLogic.ChangeRoleAsync(biz, team, newcomer, SpaceRole.Owner));
            await Assert.ThrowsAsync<ForbiddenException>(() => SpaceLogic.ChangeRoleAsync(biz, team, owner, SpaceRole.Viewer));
            await Assert.ThrowsAsync<ForbiddenException>(() => SpaceLogic.RemoveMemberAsync(biz, team, owner));
            await Assert.ThrowsAsync<ForbiddenException>(() => SpaceLogic.AddMemberAsync(biz, team, another, SpaceRole.Owner));
            await SpaceLogic.ChangeRoleAsync(biz, team, newcomer, SpaceRole.Editor);
            await SpaceLogic.RemoveMemberAsync(biz, team, newcomer);
            await Assert.ThrowsAsync<BizException>(() => SpaceLogic.RemoveMemberAsync(biz, team, newcomer));
            await Assert.ThrowsAsync<ForbiddenException>(() => SpaceLogic.TransferOwnershipAsync(biz, team, editor));
        });
        await As(Role.Stranger, async biz =>
        {
            await Assert.ThrowsAsync<ForbiddenException>(() => SpaceLogic.AddMemberAsync(biz, team, newcomer, SpaceRole.Viewer));
            Assert.Equal(3, (await SpaceLogic.MembersAsync(biz, team)).Count);
        });
        await As(Role.Designer, async biz =>
        {
            // the last owner can neither be demoted nor leave nor be removed
            await Assert.ThrowsAsync<BizException>(() => SpaceLogic.ChangeRoleAsync(biz, team, owner, SpaceRole.Admin));
            await Assert.ThrowsAsync<BizException>(() => SpaceLogic.LeaveAsync(biz, team));
            await Assert.ThrowsAsync<BizException>(() => SpaceLogic.RemoveMemberAsync(biz, team, owner));
            await Assert.ThrowsAsync<BizException>(() => SpaceLogic.TransferOwnershipAsync(biz, team, owner));
            await Assert.ThrowsAsync<BizException>(() => SpaceLogic.TransferOwnershipAsync(biz, team, newcomer));   // not a member

            // two owners: one may leave
            await SpaceLogic.ChangeRoleAsync(biz, team, admin, SpaceRole.Owner);
            await SpaceLogic.LeaveAsync(biz, team);
        });
        await As(Role.Viewer, async biz =>
        {
            Assert.Equal(SpaceRole.Owner, (await SpaceLogic.MembersAsync(biz, team)).Single(m => m.UserId == admin).Role);
            await SpaceLogic.TransferOwnershipAsync(biz, team, editor);
            var members = await SpaceLogic.MembersAsync(biz, team);
            Assert.Equal(SpaceRole.Owner, members.Single(m => m.UserId == editor).Role);
            Assert.Equal(SpaceRole.Admin, members.Single(m => m.UserId == admin).Role);
        });
        // somebody who left no longer sees the team
        await As(Role.Designer, async biz =>
        {
            Assert.Empty(await SpaceLogic.MyTeamsAsync(biz));
            await Assert.ThrowsAsync<NotFoundException>(() => SpaceLogic.MembersAsync(biz, team));
        });
    }

    [Fact]
    public async Task Only_active_approved_accounts_join_a_team_and_an_administrator_may_join_for_support()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await TeamAsync(Role.Designer);
        var inactive = await UserAsync("inaktiv");
        await Db(db => db.User.Where(u => u.Id == inactive).ExecuteUpdateAsync(s => s.SetProperty(u => u.IsActive, false)));
        await As(Role.Designer, biz => Assert.ThrowsAsync<BizException>(() => SpaceLogic.AddMemberAsync(biz, team, inactive, SpaceRole.Editor)));
        var admin = await UserAsync(Role.Admin);
        // an administrator looks at nothing of a team they are not in ...
        await As(Role.Admin, async biz =>
        {
            await Assert.ThrowsAsync<NotFoundException>(() => SpaceLogic.MembersAsync(biz, team));
            Assert.Null(await SpaceLogic.GetBySlugAsync(biz, "gibt-es-nicht"));
            // ... until they add themselves (logged)
            await SpaceLogic.AddMemberAsync(biz, team, admin, SpaceRole.Admin);
            Assert.Equal(2, (await SpaceLogic.MembersAsync(biz, team)).Count);
        });
        Assert.True(await Db(db => db.ActivityLog.AnyAsync(l => l.Action == "Administrator ist einem Team beigetreten" && l.EntityId == team)));
    }

    [Fact]
    public async Task Deleting_a_team_needs_its_name_sends_the_content_to_the_trash_and_ends_the_memberships()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Editor));
        var design = await As(Role.Designer, async biz => (await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign("Im Team", null, "a4-portrait", null, null, null, null, team))).Id);
        var teamName = await As(Role.Designer, async biz => (await SpaceLogic.GetAsync(biz, team)).Name);
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Stranger);   // a person share survives only as long as the item
        await As(Role.Viewer, biz => Assert.ThrowsAsync<ForbiddenException>(() => SpaceLogic.DeleteTeamAsync(biz, team, teamName)));
        await As(Role.Designer, async biz =>
        {
            var wrong = await Assert.ThrowsAsync<BizException>(() => SpaceLogic.DeleteTeamAsync(biz, team, "nicht der Name"));
            Assert.Equal("Confirm", wrong.Field);
            await SpaceLogic.DeleteTeamAsync(biz, team, teamName);
            Assert.Empty(await SpaceLogic.MyTeamsAsync(biz));
            Assert.Null(await DesignLogic.GetAsync(biz, design));
        });
        await As(Role.Viewer, async biz => Assert.Null(await DesignLogic.GetAsync(biz, design)));
        Assert.True(await Db(db => db.Design.AnyAsync(d => d.Id == design && d.TrashedDate != null)));
        Assert.False(await Db(db => db.SpaceMember.AnyAsync(m => m.SpaceId == team)));
        // the name is free again, and the purger takes the content when the days are over
        Assert.NotNull(await As(Role.Designer, biz => SpaceLogic.CreateTeamAsync(biz, teamName)));
        await Db(db => db.Design.Where(d => d.Id == design).ExecuteUpdateAsync(s => s.SetProperty(d => d.TrashedDate, DateTime.UtcNow.AddDays(-40))));
        await Db(db => ItemLogic.PurgeOlderAsync(db, DateTime.UtcNow.AddDays(-30)));
        Assert.False(await Db(db => db.Design.AnyAsync(d => d.Id == design)));
    }

    [Fact]
    public async Task Deleting_an_account_hands_over_nothing_silently_a_sole_team_owner_must_pass_the_team_on_first()
    {
        if (!Enabled)
        {
            return;
        }

        var victim = await UserAsync("opfer");
        var designer = await UserAsync(Role.Designer);
        var team = (await AsUser(victim, biz => SpaceLogic.CreateTeamAsync(biz, "Team von " + Guid.NewGuid().ToString("N")[..4]))).Id;
        await AsUser(victim, biz => SpaceLogic.AddMemberAsync(biz, team, designer, SpaceRole.Editor));
        var own = await AsUser(victim, async biz => (await DesignLogic.CreateFromFormatAsync(biz, "a4-portrait", null, null, null, "Privates")).Id);
        var admin = Role.Admin;
        var refused = await Assert.ThrowsAsync<BizException>(() => As(admin, biz => UserLogic.DeleteAsync(biz, victim)));
        Assert.Contains("Inhaber", refused.Message);

        await AsUser(victim, biz => SpaceLogic.TransferOwnershipAsync(biz, team, designer));
        await As(admin, biz => UserLogic.DeleteAsync(biz, victim));
        // the personal content goes to the trash of the platform and then away; the team is still there for the others
        Assert.True(await Db(db => db.Design.AnyAsync(d => d.Id == own && d.TrashedDate != null)));
        await As(Role.Designer, async biz => Assert.Contains(await SpaceLogic.MyTeamsAsync(biz), t => t.Id == team));
        Assert.False(await Db(db => db.SpaceMember.AnyAsync(m => m.UserId == victim)));
    }
}
