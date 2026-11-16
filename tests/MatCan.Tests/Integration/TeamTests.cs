using System.Net;
using MatCan.Data.Entities;
using MatCan.Logic;
using MatCan.Services;
using Microsoft.EntityFrameworkCore;

namespace MatCan.Tests.Integration;

/// <summary>Teams (docs/PLAN-PLATFORM.md section 1.12 to 1.13): the roles and their limits, "at least one Owner", leaving, handing over, deleting, templates and the administrator's view of the teams.</summary>
[Collection("app")]
public sealed class TeamTests(AppTests.AppFactory factory) : PlatformTestBase(factory)
{
    private static string Unique(string prefix) => prefix + " " + Guid.NewGuid().ToString("N")[..6];

    private async Task<long> DesignInAsync(Role who, long team, string name)
        => await As(who, async biz => (await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign(name, null, "a4-portrait", null, null, null, null, team))).Id);

    [Fact]
    public async Task The_overview_gives_every_team_with_its_first_members_its_role_and_its_storage()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Viewer), (Role.Stranger, SpaceRole.Editor));
        var tiles = await As(Role.Viewer, biz => SpaceLogic.MyTeamTilesAsync(biz));
        var tile = Assert.Single(tiles);
        Assert.Equal(team, tile.Team.Id);
        Assert.Equal(SpaceRole.Viewer, tile.Team.MyRole);
        Assert.Equal(3, tile.Team.MemberCount);
        // by role (owner, editor, viewer), then by when they came
        Assert.Equal(["Designer", "Stranger", "Viewer"], tile.MemberNames.Take(3).ToArray());
        Assert.Equal(10240L * 1024 * 1024, tile.Storage.QuotaBytes);
        Assert.Equal(0, tile.Storage.UsedBytes);
        // a person without a team has no tiles
        Assert.Empty(await As(Role.Admin, biz => SpaceLogic.MyTeamTilesAsync(biz)));
    }

    [Fact]
    public async Task Roles_change_only_as_far_as_the_role_of_the_person_who_changes_them_reaches()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Admin), (Role.Stranger, SpaceRole.Editor));
        var designer = await UserAsync(Role.Designer);
        var viewer = await UserAsync(Role.Viewer);
        var stranger = await UserAsync(Role.Stranger);
        // an Admin of the team may change an Editor, but neither make Owners nor touch the Owner
        await As(Role.Viewer, async biz =>
        {
            await SpaceLogic.ChangeRoleAsync(biz, team, stranger, SpaceRole.Viewer);
            await Assert.ThrowsAsync<ForbiddenException>(() => SpaceLogic.ChangeRoleAsync(biz, team, stranger, SpaceRole.Owner));
            await Assert.ThrowsAsync<ForbiddenException>(() => SpaceLogic.ChangeRoleAsync(biz, team, designer, SpaceRole.Viewer));
            await Assert.ThrowsAsync<ForbiddenException>(() => SpaceLogic.RemoveMemberAsync(biz, team, designer));
        });
        // an Editor and a Viewer of the team may change nothing
        await As(Role.Stranger, async biz =>
        {
            await Assert.ThrowsAsync<ForbiddenException>(() => SpaceLogic.ChangeRoleAsync(biz, team, viewer, SpaceRole.Viewer));
            await Assert.ThrowsAsync<ForbiddenException>(() => SpaceLogic.RemoveMemberAsync(biz, team, viewer));
        });
        // the Owner makes a second Owner; now the first may step down
        await As(Role.Designer, async biz =>
        {
            await SpaceLogic.ChangeRoleAsync(biz, team, viewer, SpaceRole.Owner);
            await SpaceLogic.ChangeRoleAsync(biz, team, designer, SpaceRole.Editor);
        });
        Assert.Equal(SpaceRole.Editor, await Db(db => db.SpaceMember.Where(m => m.SpaceId == team && m.UserId == designer).Select(m => m.Role).SingleAsync()));
    }

    [Fact]
    public async Task A_team_always_keeps_one_owner_the_last_cannot_be_demoted_removed_or_leave()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Admin));
        var designer = await UserAsync(Role.Designer);
        await As(Role.Designer, async biz =>
        {
            var demote = await Assert.ThrowsAsync<BizException>(() => SpaceLogic.ChangeRoleAsync(biz, team, designer, SpaceRole.Admin));
            Assert.Contains("mindestens einen Inhaber", demote.Message);
            var leave = await Assert.ThrowsAsync<BizException>(() => SpaceLogic.LeaveAsync(biz, team));
            Assert.Contains("letzte Inhaber", leave.Message);
            Assert.True(await SpaceLogic.IsLastOwnerAsync(biz, team, designer));
        });
        // an Admin cannot remove the Owner either
        await As(Role.Viewer, biz => Assert.ThrowsAsync<ForbiddenException>(() => SpaceLogic.RemoveMemberAsync(biz, team, designer)));

        // hand the ownership over: the person is Admin now and may leave; the new Owner is not "the last" with others around
        var viewer = await UserAsync(Role.Viewer);
        await As(Role.Designer, biz => SpaceLogic.TransferOwnershipAsync(biz, team, viewer));
        Assert.Equal(SpaceRole.Admin, await Db(db => db.SpaceMember.Where(m => m.SpaceId == team && m.UserId == designer).Select(m => m.Role).SingleAsync()));
        Assert.Equal(SpaceRole.Owner, await Db(db => db.SpaceMember.Where(m => m.SpaceId == team && m.UserId == viewer).Select(m => m.Role).SingleAsync()));
        await As(Role.Designer, biz => SpaceLogic.LeaveAsync(biz, team));
        await As(Role.Designer, biz => Assert.ThrowsAsync<NotFoundException>(() => SpaceLogic.GetAsync(biz, team)));
        // somebody who is not a member cannot be made the owner
        await As(Role.Viewer, biz => Assert.ThrowsAsync<BizException>(() => SpaceLogic.TransferOwnershipAsync(biz, team, designer)));
    }

    [Fact]
    public async Task Only_the_owner_deletes_a_team_with_its_name_typed_and_the_content_goes_to_the_trash()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Admin), (Role.Stranger, SpaceRole.Editor));
        var name = await Db(db => db.Space.Where(s => s.Id == team).Select(s => s.Name).SingleAsync());
        var design = await DesignInAsync(Role.Designer, team, "Im Team");
        await As(Role.Designer, biz => InviteLogic.CreateAsync(biz, team, SpaceRole.Viewer, "neu@test.local", false, 7, 1));

        await As(Role.Viewer, biz => Assert.ThrowsAsync<ForbiddenException>(() => SpaceLogic.DeleteTeamAsync(biz, team, name)));
        await As(Role.Stranger, biz => Assert.ThrowsAsync<ForbiddenException>(() => SpaceLogic.DeleteTeamAsync(biz, team, name)));
        await As(Role.Designer, async biz =>
        {
            var wrong = await Assert.ThrowsAsync<BizException>(() => SpaceLogic.DeleteTeamAsync(biz, team, name.ToLowerInvariant() + "x"));
            Assert.Contains("Namen", wrong.Message);
            await SpaceLogic.DeleteTeamAsync(biz, team, "  " + name + "  ");
        });

        Assert.False(await Db(db => db.SpaceMember.AnyAsync(m => m.SpaceId == team)));
        Assert.False(await Db(db => db.Invitation.AnyAsync(i => i.SpaceId == team)));
        Assert.True(await Db(db => db.Design.AnyAsync(d => d.Id == design && d.TrashedDate != null)));
        await As(Role.Stranger, async biz => Assert.Null(await DesignLogic.GetAsync(biz, design)));
        // the address is free again
        Assert.NotNull(await As(Role.Designer, biz => SpaceLogic.CreateTeamAsync(biz, name)));
    }

    [Fact]
    public async Task No_team_takes_the_address_of_the_page_that_makes_a_team()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await As(Role.Designer, biz => SpaceLogic.CreateTeamAsync(biz, "Create"));
        Assert.NotEqual("create", team.Slug);
        Assert.StartsWith("create", team.Slug);
    }

    [Fact]
    public async Task Team_templates_are_the_designs_of_the_team_that_its_members_may_use()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Viewer), (Role.Stranger, SpaceRole.Editor));
        var design = await DesignInAsync(Role.Designer, team, "Vorlage im Team");
        await DesignInAsync(Role.Designer, team, "Nur ein Design");

        // the people who may offer a design are the ones who see the candidates
        await As(Role.Viewer, biz => Assert.ThrowsAsync<ForbiddenException>(() => DesignLogic.TemplateCandidatesAsync(biz, team)));
        var candidates = await As(Role.Designer, biz => DesignLogic.TemplateCandidatesAsync(biz, team));
        Assert.Equal(2, candidates.Count);

        // a viewer of the team may not change the flag, an editor may (Manage in the team)
        await As(Role.Viewer, biz => Assert.ThrowsAsync<ForbiddenException>(() => DesignLogic.SetTemplateAsync(biz, design, true)));
        await As(Role.Stranger, biz => DesignLogic.SetTemplateAsync(biz, design, true));
        var templates = await As(Role.Viewer, biz => SpaceLogic.TeamTemplates(biz, team).ToListAsync());
        Assert.Equal(["Vorlage im Team"], templates.Select(t => t.Name).ToArray());
        Assert.Single(await As(Role.Designer, biz => DesignLogic.TemplateCandidatesAsync(biz, team)));

        // every member may use it: the copy is theirs and is no template
        var copy = await As(Role.Viewer, biz => DesignLogic.UseTemplateAsync(biz, design));
        Assert.False(copy.IsTemplate);
        Assert.NotEqual(team, copy.SpaceId);

        // somebody outside the team does not see its templates, not even in the gallery
        Assert.Empty(await As(Role.Admin, biz => SpaceLogic.TeamTemplates(biz, team).ToListAsync()));
        await As(Role.Admin, async biz => Assert.DoesNotContain(await DesignLogic.TemplateQuery(biz).Select(d => d.Id).ToListAsync(), id => id == design));

        await As(Role.Designer, biz => DesignLogic.SetTemplateAsync(biz, design, false));
        Assert.Empty(await As(Role.Viewer, biz => SpaceLogic.TeamTemplates(biz, team).ToListAsync()));
    }

    [Fact]
    public async Task The_administrator_sees_every_team_with_its_members_and_storage_and_joins_one_for_support()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Editor));
        var rows = await As(Role.Admin, biz => SpaceLogic.AdminTeams(biz).ToListAsync());
        var row = rows.Single(t => t.Id == team);
        Assert.Equal(2, row.MemberCount);
        await As(Role.Designer, biz => Assert.ThrowsAsync<ForbiddenException>(() => SpaceLogic.AdminTeamAsync(biz, team)));
        await Assert.ThrowsAsync<ForbiddenException>(() => As(Role.Designer, biz => Task.FromResult(SpaceLogic.AdminTeams(biz))));

        var details = await As(Role.Admin, biz => SpaceLogic.AdminTeamAsync(biz, team));
        Assert.False(details!.IAmMember);
        Assert.Equal(["Designer", "Viewer"], details.Members.Select(m => m.DisplayName).OrderBy(n => n).ToArray());

        // no access to the content, only the way in through the member list
        var design = await DesignInAsync(Role.Designer, team, "Nicht für Administratoren");
        await As(Role.Admin, async biz => Assert.Null(await DesignLogic.GetAsync(biz, design)));
        await As(Role.Admin, biz => SpaceLogic.JoinAsSupportAsync(biz, team));
        var admin = await UserAsync(Role.Admin);
        Assert.Equal(SpaceRole.Admin, await Db(db => db.SpaceMember.Where(m => m.SpaceId == team && m.UserId == admin).Select(m => m.Role).SingleAsync()));
        Assert.True(await Db(db => db.ActivityLog.AnyAsync(l => l.Action == "Administrator ist einem Team beigetreten" && l.EntityId == team)));
        Assert.NotNull(await As(Role.Admin, biz => DesignLogic.GetAsync(biz, design)));
        // a second time says so; the team hears about it as it hears about every new member
        await As(Role.Admin, biz => Assert.ThrowsAsync<BizException>(() => SpaceLogic.JoinAsSupportAsync(biz, team)));
        await As(Role.Admin, biz => Assert.ThrowsAsync<NotFoundException>(() => SpaceLogic.JoinAsSupportAsync(biz, 987_654_321)));
    }

    [Fact]
    public async Task The_pages_of_a_team_are_for_its_members_the_settings_for_owner_and_admin()
    {
        if (!Enabled)
        {
            return;
        }

        await using var gate = await RealAdminsAsync();
        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Viewer), (Role.Stranger, SpaceRole.Editor));
        var slug = await Db(db => db.Space.Where(s => s.Id == team).Select(s => s.Slug!).SingleAsync());
        var owner = await SignInAsync(await UserAsync(Role.Designer));
        var viewer = await SignInAsync(await UserAsync(Role.Viewer));
        var editor = await SignInAsync(await UserAsync(Role.Stranger));
        var outsider = await SignInAsync(await UserAsync("outsider"));

        // the team's own address leads to its file browser
        var start = await owner.GetAsync($"/Teams/{slug}");
        Assert.Equal(HttpStatusCode.Redirect, start.StatusCode);
        Assert.Equal($"/Teams/{slug}/Projekte", start.Headers.Location!.OriginalString);

        var overview = await owner.GetStringAsync("/Teams");
        Assert.Contains($"data-team=\"{slug}\"", overview);
        Assert.Contains("Team erstellen", overview);

        foreach (var tab in new[] { "Projekte", "Mitglieder", "Marke", "Vorlagen" })
        {
            foreach (var (who, name) in new[] { (owner, "owner"), (viewer, "viewer"), (editor, "editor") })
            {
                var response = await who.GetAsync($"/Teams/{slug}/{tab}");
                Assert.True(response.StatusCode == HttpStatusCode.OK, $"{name}: /Teams/{slug}/{tab} answered {(int)response.StatusCode}: {(await response.Content.ReadAsStringAsync())[..Math.Min(1500, (await response.Content.ReadAsStringAsync()).Length)]}");
            }

            Assert.Equal(HttpStatusCode.NotFound, (await outsider.GetAsync($"/Teams/{slug}/{tab}")).StatusCode);
        }

        // the settings: Owner and Admin only
        Assert.Equal(HttpStatusCode.OK, (await owner.GetAsync($"/Teams/{slug}/Einstellungen")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await editor.GetAsync($"/Teams/{slug}/Einstellungen")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await viewer.GetAsync($"/Teams/{slug}/Einstellungen")).StatusCode);

        // the member list: the invite button and the open invitations only for Owner and Admin
        var ownerList = await owner.GetStringAsync($"/Teams/{slug}/Mitglieder");
        Assert.Contains("data-dialog-open=\"dt-invite\"", ownerList);
        var viewerList = await viewer.GetStringAsync($"/Teams/{slug}/Mitglieder");
        Assert.DoesNotContain("dt-invite", viewerList);
        Assert.DoesNotContain("data-autosubmit", viewerList);
        // the viewer of the team sees the browser without "Neu"
        var projects = await viewer.GetStringAsync($"/Teams/{slug}/Projekte");
        Assert.Contains("data-can-create=\"false\"", projects);
        Assert.Contains("Mitglieder", projects);
    }

    [Fact]
    public async Task The_api_changes_hands_over_and_deletes_a_team_with_the_same_rules_as_the_pages()
    {
        if (!Enabled)
        {
            return;
        }

        await using var gate = await RealAdminsAsync();
        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Admin), (Role.Stranger, SpaceRole.Editor));
        var name = await Db(db => db.Space.Where(s => s.Id == team).Select(s => s.Name).SingleAsync());
        var designer = await UserAsync(Role.Designer);
        var viewer = await UserAsync(Role.Viewer);
        var owner = await SignInAsync(designer);
        var admin = await SignInAsync(viewer);
        var editor = await SignInAsync(await UserAsync(Role.Stranger));

        // the settings: Owner and Admin
        Assert.Equal(HttpStatusCode.Forbidden, (await ApiPostAsync(editor, $"/api/spaces/{team}", new { name = "Anders" })).StatusCode);
        var renamed = await ApiPostAsync(admin, $"/api/spaces/{team}", new { name = name + " neu", description = "Beschreibung", color = "#336699" });
        Assert.Equal(HttpStatusCode.OK, renamed.StatusCode);
        Assert.Equal((name + " neu", "#336699"), await Db(db => db.Space.Where(s => s.Id == team).Select(s => new { s.Name, s.Color }).SingleAsync().ContinueWith(t => (t.Result.Name, t.Result.Color))));

        // handing over and deleting: Owner only; the name must be typed
        Assert.Equal(HttpStatusCode.Forbidden, (await ApiPostAsync(admin, $"/api/spaces/{team}/delete", new { name = name + " neu" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await ApiPostAsync(admin, $"/api/spaces/{team}/transfer", new { userId = viewer })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await ApiPostAsync(owner, $"/api/spaces/{team}/transfer", new { userId = viewer })).StatusCode);
        // the former owner is Admin now: no longer allowed to delete
        Assert.Equal(HttpStatusCode.Forbidden, (await ApiPostAsync(owner, $"/api/spaces/{team}/delete", new { name = name + " neu" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await ApiPostAsync(admin, $"/api/spaces/{team}/delete", new { name = "falsch" })).StatusCode);
        Assert.True(await Db(db => db.Space.AnyAsync(s => s.Id == team)));
        Assert.Equal(HttpStatusCode.OK, (await ApiPostAsync(admin, $"/api/spaces/{team}/delete", new { name = name + " neu" })).StatusCode);
        Assert.False(await Db(db => db.Space.AnyAsync(s => s.Id == team)));
    }

    [Fact]
    public async Task A_folder_page_without_access_leads_to_the_page_to_ask_and_never_says_whether_the_folder_exists()
    {
        if (!Enabled)
        {
            return;
        }

        await using var gate = await RealAdminsAsync();
        var folder = await As(Role.Designer, async biz => (await FolderLogic.CreateAsync(biz, null, null, "Privat")).Id);
        var owner = await SignInAsync(await UserAsync(Role.Designer));
        var stranger = await SignInAsync(await UserAsync(Role.Stranger));
        Assert.Equal(HttpStatusCode.OK, (await owner.GetAsync($"/Projekte/Ordner/{folder}")).StatusCode);
        foreach (var path in new[] { $"/Projekte/Ordner/{folder}", $"/Freigegeben/Ordner/{folder}", "/Projekte/Ordner/987654321", "/Freigegeben/Ordner/987654321" })
        {
            var response = await stranger.GetAsync(path);
            Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
            Assert.StartsWith("/Zugriff/folder/", response.Headers.Location!.OriginalString);
        }

        // the page that is offered says the same for an id that is not there as for one that is
        var real = await (await stranger.GetAsync($"/Zugriff/folder/{folder}")).Content.ReadAsStringAsync();
        var missing = await (await stranger.GetAsync("/Zugriff/folder/987654321")).Content.ReadAsStringAsync();
        Assert.Contains("Zugriff", real);
        Assert.DoesNotContain("Privat", real);
        Assert.Equal(real.Contains("Zugriff anfordern"), missing.Contains("Zugriff anfordern"));
    }
}
