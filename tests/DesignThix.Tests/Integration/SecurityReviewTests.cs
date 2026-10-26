using System.Net;
using System.Text.Json;
using DesignThix.Configuration;
using DesignThix.Core.Documents;
using DesignThix.Data;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.Services;
using DesignThix.Services.Mail;
using DesignThix.Tests.Core;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DesignThix.Tests.Integration;

/// <summary>
/// The tests that came out of the security review of phase P6 (docs/PLAN-PLATFORM.md, "Security review (P6)"): the race of two saves of one design, every id-taking method that was not in the
/// tables of <see cref="PermissionTests"/> yet (a stranger gets 404, somebody who may only look 403), the brake against being pinged to death, links that must never lead off the site or to the
/// address a visitor wrote into a header, and the brakes on the routes that anybody may call. Runs when DESIGNTHIX_TEST_DB names a server (the checks of pure functions always run).
/// </summary>
[Collection("app")]
public sealed class SecurityReviewTests(AppTests.AppFactory factory) : PlatformTestBase(factory)
{
    private static string DocumentWith(string asset) => DocumentValidator.ToJson(DocumentValidator.Create(100, 100) with
    {
        Pages = [DocumentValidator.Create(100, 100).Pages[0] with { Background = new BackgroundDef("#ffffff", null, asset, "cover") }],
    });

    private static byte[] Png() => File.ReadAllBytes(Path.Combine(RepoFiles.WwwRoot(), "img", "icon-192.png"));

    private static byte[] FakeFont(byte marker) => [0, 1, 0, 0, marker, 2, 3, 4, 5, 6, 7, 8];

    private async Task<long> DesignOfAsync(long owner, string name = "Plakat", long? team = null)
        => await AsUser(owner, async biz => (await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign(name, null, "a4-portrait", null, null, null, null, team))).Id);

    private HttpClient Anonymous() => Factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

    private async Task<HttpClient> SignInRoleAsync(Role role) => await SignInAsync(await UserAsync(role));

    private async Task<T> Refused<T>(long person, Func<Biz, Task> call) where T : Exception
    {
        try
        {
            await AsUser(person, call);
        }
        catch (T ex)
        {
            return ex;
        }

        throw new Xunit.Sdk.XunitException($"expected {typeof(T).Name}, but nothing was refused");
    }

    // ------------------------------------------------------------------------------------------------ two saves at the same moment

    /// <summary>Runs <paramref name="count"/> saves of one design that all start from the same revision, as fast as possible.</summary>
    private async Task<List<Exception?>> ConcurrentSavesAsync(long owner, long design, int revision, int count, Func<int, bool> autosave)
    {
        using var gate = new ManualResetEventSlim(false);
        var tasks = Enumerable.Range(0, count).Select(i => Task.Run(async () =>
        {
            try
            {
                gate.Wait();
                await AsUser(owner, biz => DesignLogic.SaveDocumentAsync(biz, design, revision, DocumentWith("flag-de"), autosave(i)));
                return (Exception?)null;
            }
            catch (Exception ex)
            {
                return ex;
            }
        })).ToList();
        gate.Set();
        return [.. await Task.WhenAll(tasks)];
    }

    [Fact]
    public async Task Two_saves_of_a_design_at_the_same_moment_give_one_winner_and_a_clean_conflict_for_the_rest()
    {
        if (!Enabled)
        {
            return;
        }

        var owner = await UserAsync("owner");
        var design = (await AsUser(owner, biz => DesignLogic.CreateFromFormatAsync(biz, "a4-portrait", null, null, null, "Rennen"))).Id;
        var revision = 1;
        // several rounds: the first one inserts the image reference, the later ones change the history entry
        for (var round = 0; round < 4; round++)
        {
            var results = await ConcurrentSavesAsync(owner, design, revision, 8, i => i % 2 == 0);
            var failed = results.Where(r => r is not null).ToList();
            Assert.True(failed.All(f => f is RevisionConflictException), "Round " + round + ": every loser must get a revision conflict, got: " + string.Join(" | ", failed.Select(f => f!.GetType().Name + ": " + f.Message)));
            Assert.Equal(1, results.Count(r => r is null));
            revision++;
            var stored = await Db(db => db.Design.AsNoTracking().Where(d => d.Id == design).Select(d => d.Revision).FirstAsync());
            Assert.Equal(revision, stored);
        }

        // the history and the image reference are intact: one reference, one entry per revision
        Assert.Equal(1, await Db(db => db.ItemAssetRef.CountAsync(r => r.ItemKind == ItemKind.Design && r.ItemId == design)));
        var entries = await Db(db => db.DesignRevision.Where(r => r.DesignId == design).Select(r => r.Revision).ToListAsync());
        Assert.Equal(entries.Count, entries.Distinct().Count());
    }

    [Fact]
    public async Task Two_saves_of_the_rows_of_a_data_list_at_the_same_moment_give_one_winner_and_a_clean_conflict_for_the_rest()
    {
        if (!Enabled)
        {
            return;
        }

        var owner = await UserAsync("owner");
        var list = await AsUser(owner, biz => DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput("Rennen", null, false)));
        await AsUser(owner, biz => DataListLogic.SaveColumnsAsync(biz, list.Id, [new("Bild", "Bild", "image", null, null)]));
        var revision = await Db(db => db.DataList.AsNoTracking().Where(l => l.Id == list.Id).Select(l => l.Revision).FirstAsync());
        using var gate = new ManualResetEventSlim(false);
        var tasks = Enumerable.Range(0, 8).Select(_ => Task.Run(async () =>
        {
            try
            {
                gate.Wait();
                await AsUser(owner, biz => DataListLogic.SaveRowsAsync(biz, list.Id, revision, [new GridRow(null, new Dictionary<string, string> { ["Bild"] = "flag-de" }, 1, true)]));
                return (Exception?)null;
            }
            catch (Exception ex)
            {
                return ex;
            }
        })).ToList();
        gate.Set();
        var results = await Task.WhenAll(tasks);
        var failed = results.Where(r => r is not null).ToList();
        Assert.True(failed.All(f => f is RevisionConflictException), "every loser must get a revision conflict, got: " + string.Join(" | ", failed.Select(f => f!.GetType().Name + ": " + f.Message)));
        Assert.Equal(1, results.Count(r => r is null));
    }

    // ------------------------------------------------------------------------------------------------ ids of other people's things

    [Fact]
    public async Task A_share_is_changed_or_removed_only_by_somebody_who_may_see_and_edit_its_item()
    {
        if (!Enabled)
        {
            return;
        }

        var owner = await UserAsync("owner");
        var editor = await UserAsync("editor");
        var viewer = await UserAsync("viewer");
        var stranger = await UserAsync("stranger");
        var target = await UserAsync("target");
        var other = await UserAsync("other");
        var design = await DesignOfAsync(owner);
        await AsUser(owner, biz => ShareLogic.AddAsync(biz, ItemKind.Design, design, false, editor, SharePermission.Edit));
        await AsUser(owner, biz => ShareLogic.AddAsync(biz, ItemKind.Design, design, false, viewer, SharePermission.View));
        var byOwner = (await AsUser(owner, biz => ShareLogic.AddAsync(biz, ItemKind.Design, design, false, target, SharePermission.View))).Id;
        var byEditor = (await AsUser(editor, biz => ShareLogic.AddAsync(biz, ItemKind.Design, design, false, other, SharePermission.View))).Id;

        // the id of a share of a thing the person cannot see is a 404 for every method, a share of a thing they only see is a 403
        await Refused<NotFoundException>(stranger, biz => ShareLogic.ChangeAsync(biz, byOwner, SharePermission.Edit));
        await Refused<NotFoundException>(stranger, biz => ShareLogic.RemoveAsync(biz, byOwner));
        await Refused<ForbiddenException>(viewer, biz => ShareLogic.ChangeAsync(biz, byOwner, SharePermission.Edit));
        await Refused<ForbiddenException>(viewer, biz => ShareLogic.RemoveAsync(biz, byOwner));
        // somebody with Edit changes only what they shared themselves
        await Refused<ForbiddenException>(editor, biz => ShareLogic.ChangeAsync(biz, byOwner, SharePermission.Edit));
        await Refused<ForbiddenException>(editor, biz => ShareLogic.RemoveAsync(biz, byOwner));
        await AsUser(editor, biz => ShareLogic.ChangeAsync(biz, byEditor, SharePermission.Edit));
        await AsUser(editor, biz => ShareLogic.RemoveAsync(biz, byEditor));
        // an id that is not there looks like the others
        await Refused<NotFoundException>(owner, biz => ShareLogic.RemoveAsync(biz, 987_654_321));
        Assert.True(await Db(db => db.Share.AnyAsync(s => s.Id == byOwner)));

        // leaving only ever touches the shares made WITH the person
        await AsUser(stranger, biz => ShareLogic.LeaveShareAsync(biz, ItemKind.Design, design));
        Assert.True(await Db(db => db.Share.AnyAsync(s => s.Id == byOwner)));
        await AsUser(target, biz => ShareLogic.LeaveShareAsync(biz, ItemKind.Design, design));
        Assert.False(await Db(db => db.Share.AnyAsync(s => s.Id == byOwner)));
    }

    [Fact]
    public async Task The_comments_of_a_design_nobody_may_see_are_404_and_those_of_others_cannot_be_changed()
    {
        if (!Enabled)
        {
            return;
        }

        var owner = await UserAsync("owner");
        var viewer = await UserAsync("viewer");
        var stranger = await UserAsync("stranger");
        var design = await DesignOfAsync(owner);
        await AsUser(owner, biz => ShareLogic.AddAsync(biz, ItemKind.Design, design, false, viewer, SharePermission.View));
        var comment = (await AsUser(owner, biz => CommentLogic.AddAsync(biz, design, new CommentInput("Erster", null, null, null, null, null, null)))).Id;

        await Refused<NotFoundException>(stranger, biz => CommentLogic.EditAsync(biz, comment, "Ha", null));
        await Refused<NotFoundException>(stranger, biz => CommentLogic.ResolveAsync(biz, comment));
        await Refused<NotFoundException>(stranger, biz => CommentLogic.ReopenAsync(biz, comment));
        await Refused<NotFoundException>(stranger, biz => CommentLogic.DeleteAsync(biz, comment));
        await Refused<NotFoundException>(stranger, biz => CommentLogic.ListAsync(biz, design));
        await Refused<NotFoundException>(stranger, biz => CommentLogic.AddAsync(biz, design, new CommentInput("Ich auch", null, null, null, null, null, null)));
        await Refused<NotFoundException>(stranger, biz => CommentLogic.MentionCandidatesAsync(biz, design, "a"));
        // somebody who may look writes their own, and neither edits, resolves nor deletes the owner's
        await Refused<ForbiddenException>(viewer, biz => CommentLogic.EditAsync(biz, comment, "Ha", null));
        await Refused<ForbiddenException>(viewer, biz => CommentLogic.ResolveAsync(biz, comment));
        await Refused<ForbiddenException>(viewer, biz => CommentLogic.DeleteAsync(biz, comment));
        Assert.Equal(1, await Db(db => db.Comment.CountAsync(c => c.DesignId == design)));
        // an id that is not there looks like the others
        await Refused<NotFoundException>(owner, biz => CommentLogic.DeleteAsync(biz, 987_654_321));
    }

    [Fact]
    public async Task An_access_request_is_decided_only_by_the_people_who_manage_the_item()
    {
        if (!Enabled)
        {
            return;
        }

        var owner = await UserAsync("owner");
        var viewer = await UserAsync("viewer");
        var asker = await UserAsync("asker");
        var stranger = await UserAsync("stranger");
        var design = await DesignOfAsync(owner);
        await AsUser(owner, biz => ShareLogic.AddAsync(biz, ItemKind.Design, design, false, viewer, SharePermission.View));
        await AsUser(asker, biz => AccessRequestLogic.CreateAsync(biz, ItemKind.Design, design, SharePermission.View, "Bitte"));
        var request = await Db(db => db.AccessRequest.Where(r => r.ItemId == design && r.UserId == asker).Select(r => r.Id).SingleAsync());

        await Refused<NotFoundException>(stranger, biz => AccessRequestLogic.DecideAsync(biz, request, true));
        await Refused<NotFoundException>(asker, biz => AccessRequestLogic.DecideAsync(biz, request, true));
        await Refused<ForbiddenException>(viewer, biz => AccessRequestLogic.DecideAsync(biz, request, true));
        await Refused<NotFoundException>(stranger, biz => AccessRequestLogic.ListAsync(biz, ItemKind.Design, design));
        Assert.Equal(AccessRequestState.Open, await Db(db => db.AccessRequest.Where(r => r.Id == request).Select(r => r.State).SingleAsync()));
        await AsUser(owner, biz => AccessRequestLogic.DecideAsync(biz, request, true));
        Assert.Equal(AccessRequestState.Granted, await Db(db => db.AccessRequest.Where(r => r.Id == request).Select(r => r.State).SingleAsync()));
    }

    [Fact]
    public async Task The_invitations_of_a_team_are_revoked_and_sent_again_only_by_its_owner_and_admins()
    {
        if (!Enabled)
        {
            return;
        }

        var teamA = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Editor));
        var teamB = await TeamAsync(Role.Stranger);
        var link = (await As(Role.Designer, biz => InviteLogic.CreateAsync(biz, teamA, SpaceRole.Viewer, null, true, 7, 3))).Created.Single();
        var byAddress = (await As(Role.Designer, biz => InviteLogic.CreateAsync(biz, teamA, SpaceRole.Viewer, $"gast-{Guid.NewGuid():N}@test.local", false, 7, 1))).Created.Single();

        // the owner of ANOTHER team knows the id and gets a 404 for every method, a plain editor of the team a 403
        foreach (var id in new[] { link.Id, byAddress.Id })
        {
            await As(Role.Stranger, biz => Assert.ThrowsAsync<NotFoundException>(() => InviteLogic.RevokeAsync(biz, id)));
            await As(Role.Viewer, biz => Assert.ThrowsAsync<ForbiddenException>(() => InviteLogic.RevokeAsync(biz, id)));
        }

        await As(Role.Stranger, biz => Assert.ThrowsAsync<NotFoundException>(() => InviteLogic.ResendAsync(biz, byAddress.Id)));
        await As(Role.Viewer, biz => Assert.ThrowsAsync<ForbiddenException>(() => InviteLogic.ResendAsync(biz, byAddress.Id)));
        await As(Role.Stranger, biz => Assert.ThrowsAsync<NotFoundException>(() => InviteLogic.ListAsync(biz, teamA)));
        await As(Role.Viewer, biz => Assert.ThrowsAsync<ForbiddenException>(() => InviteLogic.ListAsync(biz, teamA)));
        Assert.Equal(2, await Db(db => db.Invitation.CountAsync(i => i.SpaceId == teamA && i.RevokedDate == null)));
        Assert.Equal(0, await Db(db => db.Invitation.CountAsync(i => i.SpaceId == teamB)));
        // the preview of a link names the team and nothing about the people in it
        var preview = await AsAnonymous(biz => InviteLogic.PreviewAsync(biz, link.Token));
        Assert.Equal(InviteStatus.Valid, preview.Status);
    }

    [Fact]
    public async Task The_last_use_of_an_invitation_link_goes_to_one_person_when_several_accept_at_once()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await TeamAsync(Role.Designer);
        var link = (await As(Role.Designer, biz => InviteLogic.CreateAsync(biz, team, SpaceRole.Viewer, null, true, 7, 1))).Created.Single();
        var people = new List<long>();
        for (var i = 0; i < 6; i++)
        {
            people.Add(await UserAsync("gast" + i));
        }

        using var gate = new ManualResetEventSlim(false);
        var tasks = people.Select(person => Task.Run(async () =>
        {
            try
            {
                gate.Wait();
                await AsUser(person, biz => InviteLogic.AcceptAsync(biz, link.Token));
                return (Exception?)null;
            }
            catch (Exception ex)
            {
                return ex;
            }
        })).ToList();
        gate.Set();
        var results = await Task.WhenAll(tasks);
        Assert.All(results.Where(r => r is not null), r => Assert.IsType<BizException>(r));
        Assert.Equal(1, results.Count(r => r is null));
        Assert.Equal(2, await Db(db => db.SpaceMember.CountAsync(m => m.SpaceId == team)));
        Assert.Equal(1, await Db(db => db.Invitation.Where(i => i.Id == link.Id).Select(i => i.Uses).SingleAsync()));
    }

    [Fact]
    public async Task A_name_with_line_breaks_cannot_start_a_header_of_a_notification_mail()
    {
        if (!Enabled)
        {
            return;
        }

        var sender = await UserAsync("sender");
        var receiver = await UserAsync("receiver");
        await Db(db => db.User.Where(u => u.Id == sender).ExecuteUpdateAsync(s => s.SetProperty(u => u.DisplayName, "Eve\r\nBcc: spy@evil.example")));
        var design = await DesignOfAsync(sender, "Plan\r\nSubject: Fake <b>fett</b>");
        var queue = Factory.Services.GetRequiredService<MailQueue>();
        var jobs = new List<MailJob>();
        void Handler(MailJob job) { lock (jobs) { jobs.Add(job); } }
        queue.Queued += Handler;
        try
        {
            await AsUser(sender, biz => ShareLogic.AddAsync(biz, ItemKind.Design, design, false, receiver, SharePermission.View, "Hallo\r\nBcc: spy@evil.example\r\n<script>alert(1)</script>"));
        }
        finally
        {
            queue.Queued -= Handler;
        }

        await using (await MailAsync(UsableMail()))
        {
            var mail = await Factory.Services.GetRequiredService<MailComposer>().ComposeAsync(jobs.OfType<MailJob.Notification>().Single());
            Assert.NotNull(mail);
            Assert.DoesNotContain('\r', mail!.Subject);
            Assert.DoesNotContain('\n', mail.Subject);
            Assert.DoesNotContain("<script>", mail.Html);
            Assert.DoesNotContain("<b>fett</b>", mail.Html);
            Assert.Contains("&lt;script&gt;", mail.Html);
            // the address of the receiver is the only recipient, whatever the names say
            Assert.DoesNotContain("evil.example", mail.To);
        }
    }

    [Fact]
    public async Task A_notification_of_somebody_else_cannot_be_read_or_opened()
    {
        if (!Enabled)
        {
            return;
        }

        var owner = await UserAsync("owner");
        var viewer = await UserAsync("viewer");
        var stranger = await UserAsync("stranger");
        var design = await DesignOfAsync(owner);
        await AsUser(owner, biz => ShareLogic.AddAsync(biz, ItemKind.Design, design, false, viewer, SharePermission.View));
        var note = await Db(db => db.Notification.Where(n => n.UserId == viewer).Select(n => n.Id).SingleAsync());

        await AsUser(stranger, biz => NotificationLogic.ReadAsync(biz, note));
        Assert.Null(await AsUser(stranger, biz => NotificationLogic.OpenAsync(biz, note)));
        Assert.Null(await Db(db => db.Notification.Where(n => n.Id == note).Select(n => n.ReadDate).SingleAsync()));
        Assert.Empty((await AsUser(stranger, biz => NotificationLogic.ListAsync(biz))).Items);
        await AsUser(stranger, biz => NotificationLogic.ReadAllAsync(biz));
        Assert.Null(await Db(db => db.Notification.Where(n => n.Id == note).Select(n => n.ReadDate).SingleAsync()));
        // the person it is for opens it and gets the address
        Assert.Equal($"/Designs/{design}/Designer", await AsUser(viewer, biz => NotificationLogic.OpenAsync(biz, note)));
        Assert.NotNull(await Db(db => db.Notification.Where(n => n.Id == note).Select(n => n.ReadDate).SingleAsync()));
    }

    [Fact]
    public async Task The_trash_of_somebody_else_cannot_be_restored_or_emptied()
    {
        if (!Enabled)
        {
            return;
        }

        var owner = await UserAsync("owner");
        var viewer = await UserAsync("viewer");
        var stranger = await UserAsync("stranger");
        var design = await DesignOfAsync(owner);
        await AsUser(owner, biz => ShareLogic.AddAsync(biz, ItemKind.Design, design, false, viewer, SharePermission.Edit));
        await AsUser(owner, biz => ItemLogic.TrashAsync(biz, [new ItemRef(ItemKind.Design, design)]));

        foreach (var person in new[] { stranger, viewer })
        {
            await Refused<NotFoundException>(person, biz => ItemLogic.RestoreAsync(biz, [new ItemRef(ItemKind.Design, design)]));
            await Refused<NotFoundException>(person, biz => ItemLogic.PurgeAsync(biz, [new ItemRef(ItemKind.Design, design)]));
            await AsUser(person, biz => ItemLogic.EmptyTrashAsync(biz, null));
        }

        Assert.True(await Db(db => db.Design.IgnoreQueryFilters().AnyAsync(d => d.Id == design && d.TrashedDate != null && d.UpdateState != UpdateState.Deleted)));
        await AsUser(owner, biz => ItemLogic.RestoreAsync(biz, [new ItemRef(ItemKind.Design, design)]));
        Assert.True(await Db(db => db.Design.AnyAsync(d => d.Id == design && d.TrashedDate == null)));
    }

    [Fact]
    public async Task Fonts_sheets_and_images_of_a_team_are_invisible_to_strangers_and_read_only_for_a_team_viewer()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Viewer));
        var owner = await UserAsync(Role.Designer);
        var viewer = await UserAsync(Role.Viewer);
        var stranger = await UserAsync(Role.Stranger);
        var font = (await AsUser(owner, biz => FontLogic.UploadAsync(biz, "Teamschrift.ttf", FakeFont(91), null, team))).Font!;
        var sheet = await AsUser(owner, biz => SheetLogic.SaveAsync(biz, null, new SheetLogic.SheetInput("Teambogen", 210, 297, 0, 0, 1, 1, 100, 100, 0, 0, false), team));
        var asset = (await AsUser(owner, biz => AssetLogic.UploadAsync(biz, "teambild-" + Guid.NewGuid().ToString("N")[..6] + ".png", Png(), null, team))).Asset!;

        Assert.Null(await AsUser(stranger, biz => FontLogic.GetAsync(biz, font.Id)));
        Assert.Null(await AsUser(stranger, biz => SheetLogic.GetAsync(biz, sheet.Id)));
        Assert.Null(await AsUser(stranger, biz => AssetLogic.GetAsync(biz, asset.Id)));
        Assert.Null(await AsUser(stranger, biz => AssetLogic.GetByKeyAsync(biz, asset.Key)));
        await Refused<NotFoundException>(stranger, biz => FontLogic.UpdateAsync(biz, font.Id, new FontLogic.FontInput("X", "400", "normal", null)));
        await Refused<NotFoundException>(stranger, biz => FontLogic.DeleteAsync(biz, font.Id));
        await Refused<NotFoundException>(stranger, biz => SheetLogic.DeleteAsync(biz, sheet.Id));
        // somebody who may only look at the team sees them and changes nothing
        Assert.NotNull(await AsUser(viewer, biz => FontLogic.GetAsync(biz, font.Id)));
        Assert.NotNull(await AsUser(viewer, biz => AssetLogic.GetAsync(biz, asset.Id)));
        await Refused<ForbiddenException>(viewer, biz => FontLogic.UpdateAsync(biz, font.Id, new FontLogic.FontInput("X", "400", "normal", null)));
        await Refused<ForbiddenException>(viewer, biz => FontLogic.DeleteAsync(biz, font.Id));
        await Refused<ForbiddenException>(viewer, biz => SheetLogic.DeleteAsync(biz, sheet.Id));
        await Refused<ForbiddenException>(viewer, biz => AssetLogic.DeleteAsync(biz, asset.Id));
    }

    [Fact]
    public async Task The_previews_of_a_folder_hold_only_what_the_person_may_see()
    {
        if (!Enabled)
        {
            return;
        }

        var owner = await UserAsync("owner");
        var stranger = await UserAsync("stranger");
        var folder = (await AsUser(owner, biz => FolderLogic.CreateAsync(biz, null, null, "Privat"))).Id;
        await AsUser(owner, async biz =>
        {
            var design = await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign("Im Ordner", null, "a4-portrait", null, null, null, null, null));
            await DesignLogic.SaveThumbnailAsync(biz, design.Id, Png());
            await ItemLogic.MoveAsync(biz, [new ItemRef(ItemKind.Design, design.Id)], null, folder);
        });

        Assert.Single((await AsUser(owner, biz => FolderLogic.PreviewsAsync(biz, [folder])))[folder]);
        Assert.Empty((await AsUser(stranger, biz => FolderLogic.PreviewsAsync(biz, [folder])))[folder]);
    }

    [Fact]
    public async Task An_administrator_may_join_a_team_for_support_but_not_as_its_owner()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await TeamAsync(Role.Designer);
        var administrator = await UserAsync(Role.Admin);
        var refused = await Assert.ThrowsAsync<ForbiddenException>(() => As(Role.Admin, biz => SpaceLogic.AddMemberAsync(biz, team, administrator, SpaceRole.Owner)));
        Assert.Contains("nicht als Inhaber", refused.Message);
        Assert.False(await Db(db => db.SpaceMember.AnyAsync(m => m.SpaceId == team && m.UserId == administrator)));
        await As(Role.Admin, biz => SpaceLogic.JoinAsSupportAsync(biz, team));
        Assert.Equal(SpaceRole.Admin, await Db(db => db.SpaceMember.Where(m => m.SpaceId == team && m.UserId == administrator).Select(m => m.Role).SingleAsync()));
        // and a member of the platform who is no administrator cannot add somebody else's account to a team they do not belong to
        var stranger = await UserAsync(Role.Stranger);
        await As(Role.Stranger, biz => Assert.ThrowsAsync<NotFoundException>(() => SpaceLogic.AddMemberAsync(biz, team, stranger, SpaceRole.Viewer)));
    }

    [Fact]
    public async Task A_person_who_is_declined_after_they_were_approved_is_signed_out_at_once()
    {
        if (!Enabled)
        {
            return;
        }

        await using var admins = await RealAdminsAsync();
        var member = await UserAsync("member");
        var browser = await SignInAsync(member);
        Assert.Equal(HttpStatusCode.OK, (await browser.GetAsync("/Projekte")).StatusCode);

        await As(Role.Admin, biz => UserLogic.SetApprovalAsync(biz, member, false));
        var after = await browser.GetAsync("/Projekte");
        Assert.Equal(HttpStatusCode.Redirect, after.StatusCode);
        Assert.Contains("/Account/Login", after.Headers.Location?.OriginalString);
        // an administrator account is deactivated, never declined
        var administrator = admins.Ids[0];
        await As(Role.Admin, biz => Assert.ThrowsAsync<BizException>(() => UserLogic.SetApprovalAsync(biz, administrator, false)));
    }

    // ------------------------------------------------------------------------------------------------ the capability routes and the brakes

    [Fact]
    public async Task A_font_address_needs_the_full_twelve_characters_of_the_hash()
    {
        if (!Enabled)
        {
            return;
        }

        await using var admins = await RealAdminsAsync();
        ResetLimiter();
        var team = await TeamAsync(Role.Designer);
        var font = (await As(Role.Designer, biz => FontLogic.UploadAsync(biz, "Geheim.ttf", FakeFont(92), null, team))).Font!;
        var anonymous = Anonymous();
        Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync(FontLogic.Url(font.Id, font.ContentHash, font.Format))).StatusCode);
        // six, eight or eleven correct characters are no key (24 bits could be guessed)
        foreach (var length in new[] { 6, 8, 11 })
        {
            Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"/fonts/{font.Id}-{font.ContentHash[..length]}.{font.Format}")).StatusCode);
        }

        Assert.Null(await AsAnonymous(biz => FontLogic.ContentAsync(biz, font.Id, font.ContentHash[..11])));
        ResetLimiter();
    }

    [Fact]
    public async Task An_address_that_keeps_guessing_capabilities_is_turned_away_but_a_signed_in_person_is_not_counted()
    {
        if (!Enabled)
        {
            return;
        }

        await using var admins = await RealAdminsAsync();
        ResetLimiter();
        try
        {
            var anonymous = Anonymous();
            var statuses = new List<HttpStatusCode>();
            for (var i = 0; i < 60; i++)
            {
                statuses.Add((await anonymous.GetAsync($"/media/gibt-es-nicht-{i}?v=000000000000")).StatusCode);
            }

            Assert.Equal(HttpStatusCode.Unauthorized, statuses[0]);
            Assert.Contains(HttpStatusCode.TooManyRequests, statuses);
            // once it is turned away every one of the three routes says so, before any work is done
            var turned = await anonymous.GetAsync("/designs/1/thumbnail.png?v=000000000000");
            Assert.Equal(HttpStatusCode.TooManyRequests, turned.StatusCode);
            Assert.True(turned.Headers.Contains("Retry-After"));
            Assert.Equal(HttpStatusCode.TooManyRequests, (await anonymous.GetAsync("/fonts/1-000000000000.ttf")).StatusCode);
            // the images that exist are not counted: a person who is signed in still gets their answers
            var browser = await SignInRoleAsync(Role.Designer);
            Assert.Equal(HttpStatusCode.NotFound, (await browser.GetAsync("/media/gibt-es-nicht?v=000000000000")).StatusCode);
        }
        finally
        {
            ResetLimiter();
        }
    }

    [Fact]
    public async Task The_page_of_a_link_has_the_same_brake_as_its_api()
    {
        if (!Enabled)
        {
            return;
        }

        await using var admins = await RealAdminsAsync();
        ResetLimiter();
        try
        {
            var anonymous = Anonymous();
            var statuses = new List<HttpStatusCode>();
            for (var i = 0; i < 70; i++)
            {
                statuses.Add((await anonymous.GetAsync($"/s/{Guid.NewGuid()}")).StatusCode);
            }

            Assert.Equal(HttpStatusCode.NotFound, statuses[0]);
            Assert.Contains(HttpStatusCode.TooManyRequests, statuses);
        }
        finally
        {
            ResetLimiter();
        }
    }

    [Fact]
    public async Task The_search_for_people_to_share_with_has_a_brake_per_person()
    {
        if (!Enabled)
        {
            return;
        }

        await using var admins = await RealAdminsAsync();
        ResetLimiter();
        try
        {
            var browser = await SignInRoleAsync(Role.Designer);
            HttpStatusCode last = default;
            for (var i = 0; i < ShareLogic.SearchesPerMinute + 5; i++)
            {
                last = (await browser.GetAsync("/api/share/search?q=zz")).StatusCode;
            }

            Assert.Equal(HttpStatusCode.TooManyRequests, last);
            // somebody else is not affected
            var other = await SignInRoleAsync(Role.Stranger);
            Assert.Equal(HttpStatusCode.OK, (await other.GetAsync("/api/share/search?q=zz")).StatusCode);
        }
        finally
        {
            ResetLimiter();
        }
    }

    [Fact]
    public async Task Every_page_that_anybody_may_open_has_the_security_headers_and_is_not_indexed()
    {
        if (!Enabled)
        {
            return;
        }

        await using var admins = await RealAdminsAsync();
        ResetLimiter();
        var anonymous = Anonymous();
        var dead = Guid.NewGuid();
        foreach (var path in new[] { "/Account/Login", "/Account/Register", "/Account/Pending", $"/Einladung/{dead}", $"/s/{dead}", $"/api/s/{dead}", $"/api/s/{dead}/d/1", "/Offline", "/health" })
        {
            var response = await anonymous.GetAsync(path);
            Assert.True(response.Headers.Contains("X-Content-Type-Options"), path + ": nosniff");
            Assert.Contains("default-src 'self'", string.Join(";", response.Headers.GetValues("Content-Security-Policy")));
            Assert.Contains("script-src 'self'", string.Join(";", response.Headers.GetValues("Content-Security-Policy")));
            Assert.Contains("noindex", string.Join(",", response.Headers.GetValues("X-Robots-Tag")));
            Assert.Equal("strict-origin-when-cross-origin", response.Headers.GetValues("Referrer-Policy").Single());
        }

        // what carries a secret in its address is never kept
        foreach (var path in new[] { $"/Einladung/{dead}", $"/s/{dead}", $"/api/s/{dead}" })
        {
            var response = await anonymous.GetAsync(path);
            Assert.Contains("no-store", string.Join(",", response.Headers.GetValues("Cache-Control")));
        }

        // the two files that are meant for crawlers are the only ones without the tag
        Assert.False((await anonymous.GetAsync("/robots.txt")).Headers.Contains("X-Robots-Tag"));
        Assert.False((await anonymous.GetAsync("/llms.txt")).Headers.Contains("X-Robots-Tag"));
        ResetLimiter();
    }

    // ------------------------------------------------------------------------------------------------ addresses of links

    [Fact]
    public void A_notification_leads_only_to_an_address_of_this_app()
    {
        Assert.Equal("/Designs/3/Designer", NotificationLogic.SafeUrl("/Designs/3/Designer"));
        Assert.Equal("/Designs/3/Designer?comment=7", NotificationLogic.SafeUrl("/Designs/3/Designer?comment=7"));
        Assert.Equal("/", NotificationLogic.SafeUrl("/"));
        foreach (var hostile in new[] { "//evil.example/x", "/\\evil.example", "https://evil.example/", "http://evil.example", "javascript:alert(1)", "data:text/html,x", "evil.example", "", " /x", "/x\r\nSet-Cookie: a=b", "/x\0" })
        {
            Assert.Null(NotificationLogic.SafeUrl(hostile));
        }

        Assert.Null(NotificationLogic.SafeUrl(null));
    }

    [Fact]
    public async Task A_notification_with_an_address_of_another_site_never_redirects_there()
    {
        if (!Enabled)
        {
            return;
        }

        await using var admins = await RealAdminsAsync();
        var member = await UserAsync("member");
        var ids = new List<long>();
        foreach (var url in new[] { "//evil.example/x", "https://evil.example/", "/\\evil.example", "javascript:alert(1)" })
        {
            ids.Add(await Db(async db =>
            {
                var row = new Notification { UserId = member, Kind = NotificationKinds.Share, DataJson = "{}", Url = url };
                db.Notification.Add(row);
                await db.SaveChangesAsync();
                return row.Id;
            }));
        }

        var browser = await SignInAsync(member);
        foreach (var id in ids)
        {
            var response = await browser.GetAsync($"/Account/Notifications?handler=Open&id={id}");
            Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
            var location = response.Headers.Location?.OriginalString ?? "";
            Assert.DoesNotContain("evil", location);
            Assert.StartsWith("/Account/Notifications", location);
        }

        // the list the bell reads carries no such address either
        var page = await AsUser(member, biz => NotificationLogic.ListAsync(biz));
        Assert.All(page.Items, n => Assert.Null(n.Url));
        // a mail does not link to it
        var jobs = ids.Select(id => new MailJob.Notification(id)).ToList();
        await using (await MailAsync(UsableMail()))
        {
            var composer = Factory.Services.GetRequiredService<MailComposer>();
            foreach (var job in jobs)
            {
                var mail = await composer.ComposeAsync(job);
                Assert.True(mail is null || !mail.Html.Contains("evil.example") && !mail.Text.Contains("evil.example"));
            }
        }
    }

    [Fact]
    public void The_address_for_links_in_mails_is_a_plain_web_address()
    {
        Assert.Equal("https://design.firma.de", PublicUrl.Normalize("https://design.firma.de/"));
        Assert.Equal("http://localhost:3043", PublicUrl.Normalize(" http://localhost:3043 "));
        Assert.Equal("https://firma.de/design", PublicUrl.Normalize("https://firma.de/design/"));
        foreach (var bad in new[] { "", "   ", "design.firma.de", "javascript:alert(1)", "ftp://firma.de", "https://user:pass@firma.de", "https://firma.de/?a=b", "https://firma.de/#x", "//firma.de" })
        {
            Assert.Null(PublicUrl.Normalize(bad));
        }
    }

    [Fact]
    public async Task The_host_header_of_a_visitor_never_ends_up_in_a_link_of_a_mail()
    {
        if (!Enabled)
        {
            return;
        }

        await using var admins = await RealAdminsAsync();
        var config = Factory.Services.GetRequiredService<ConfigStore>();
        var team = await TeamAsync(Role.Designer);
        var made = (await As(Role.Designer, biz => InviteLogic.CreateAsync(biz, team, SpaceRole.Viewer, $"gast-{Guid.NewGuid():N}@test.local", false, 7, 1))).Created.Single();

        // a stranger calls the app with a Host header of their own, signed in or not
        var anonymous = Anonymous();
        anonymous.DefaultRequestHeaders.Host = "evil.example";
        await anonymous.GetAsync("/health");
        await anonymous.GetAsync("/Account/Login");
        await anonymous.GetAsync("/");
        var member = await SignInRoleAsync(Role.Designer);
        member.DefaultRequestHeaders.Host = "evil.example";
        await member.GetAsync("/Projekte");
        Assert.DoesNotContain("evil.example", PublicUrl.ForMail(config, null));

        var composer = Factory.Services.GetRequiredService<MailComposer>();
        await using (await MailAsync(UsableMail()))
        {
            var mail = await composer.ComposeAsync(new MailJob.Invitation(made.Id));
            Assert.NotNull(mail);
            Assert.DoesNotContain("evil.example", mail!.Text + mail.Html);
            Assert.Contains($"/Einladung/{made.Token:D}", mail.Text);
        }

        // the administrator's own address is the one that counts, and the address chosen in the mail settings wins over it
        var administrator = await SignInAsync(admins.Ids[0]);
        administrator.DefaultRequestHeaders.Host = "design.test.local";
        await administrator.GetAsync("/Projekte");
        Assert.Equal("http://design.test.local", PublicUrl.ForMail(config, null));
        var chosen = UsableMail();
        chosen.PublicBase = "https://design.firma.de";
        await using (await MailAsync(chosen))
        {
            var mail = await composer.ComposeAsync(new MailJob.Invitation(made.Id));
            Assert.Contains($"https://design.firma.de/Einladung/{made.Token:D}", mail!.Text);
            Assert.DoesNotContain("design.test.local", mail.Text + mail.Html);
        }
    }

    // ------------------------------------------------------------------------------------------------ being pinged to death

    private async Task<long> SharedDesignAsync(long owner, params long[] with)
    {
        var design = await DesignOfAsync(owner, "Sommerfest");
        foreach (var person in with)
        {
            await AsUser(owner, biz => ShareLogic.AddAsync(biz, ItemKind.Design, design, false, person, SharePermission.View));
        }

        return design;
    }

    private Task<int> CountAsync(long recipient, string kind, long? actor = null)
        => Db(db => db.Notification.CountAsync(n => n.UserId == recipient && n.Kind == kind && (actor == null || n.CreateUserId == actor)));

    private async Task MentionAsync(long who, long design, string name, long target, int times)
    {
        for (var i = 0; i < times; i++)
        {
            await AsUser(who, biz => CommentLogic.AddAsync(biz, design, new CommentInput($"Hallo @{name} {i}", null, null, null, null, null, [target])));
        }
    }

    [Fact]
    public async Task Mentions_of_one_person_by_another_are_merged_after_ten_in_ten_minutes_and_send_no_more_mails()
    {
        if (!Enabled)
        {
            return;
        }

        var spammer = await UserAsync("spammer");
        var victim = await UserAsync("Zielperson");
        var bystander = await UserAsync("bystander");
        var design = await SharedDesignAsync(spammer, victim, bystander);
        var queue = Factory.Services.GetRequiredService<MailQueue>();
        var jobs = new List<MailJob>();
        void Handler(MailJob job) { lock (jobs) { jobs.Add(job); } }
        queue.Queued += Handler;
        try
        {
            await MentionAsync(spammer, design, "Zielperson", victim, 15);
        }
        finally
        {
            queue.Queued -= Handler;
        }

        Assert.Equal(NotificationLogic.PerActorPerWindow, await CountAsync(victim, NotificationKinds.Mention));
        var newest = await Db(db => db.Notification.Where(n => n.UserId == victim && n.Kind == NotificationKinds.Mention).OrderByDescending(n => n.Id).Select(n => n.DataJson).FirstAsync());
        Assert.Equal(5, JsonDocument.Parse(newest).RootElement.GetProperty("repeats").GetInt32());
        var (text, _, _) = NotificationLogic.Describe(NotificationKinds.Mention, newest);
        Assert.Contains("(und 5 weitere)", text);
        Assert.EndsWith("weitere).", text);
        // one mail per notification that was written, none for the merged ones
        lock (jobs)
        {
            Assert.Equal(NotificationLogic.PerActorPerWindow, jobs.OfType<MailJob.Notification>().Count());
        }

        // the badge counts what is written: ten unread
        Assert.Equal(NotificationLogic.PerActorPerWindow + 1, (await AsUser(victim, biz => NotificationLogic.UnreadCountAsync(biz))));
    }

    [Fact]
    public async Task The_brake_is_per_person_who_writes_and_per_kind_and_ends_after_the_window()
    {
        if (!Enabled)
        {
            return;
        }

        var spammer = await UserAsync("spammer");
        var friend = await UserAsync("friend");
        var victim = await UserAsync("Zielperson");
        var design = await SharedDesignAsync(spammer, victim, friend);
        await MentionAsync(spammer, design, "Zielperson", victim, 12);
        Assert.Equal(NotificationLogic.PerActorPerWindow, await CountAsync(victim, NotificationKinds.Mention));

        // somebody else may still ping the same person, and so may the spammer with another kind of notification (a share is no mention)
        await MentionAsync(friend, design, "Zielperson", victim, 2);
        Assert.Equal(NotificationLogic.PerActorPerWindow + 2, await CountAsync(victim, NotificationKinds.Mention));
        Assert.Equal(2, await CountAsync(victim, NotificationKinds.Mention, friend));
        Assert.Equal(1, await CountAsync(victim, NotificationKinds.Share, spammer));

        // a person who read the merged notice is told once more that there is more: the same row turns unread, no new row is made
        await AsUser(victim, biz => NotificationLogic.ReadAllAsync(biz));
        Assert.Equal(0, await AsUser(victim, biz => NotificationLogic.UnreadCountAsync(biz)));
        var rowsBefore = await Db(db => db.Notification.CountAsync(n => n.UserId == victim));
        await MentionAsync(spammer, design, "Zielperson", victim, 1);
        Assert.Equal(1, await AsUser(victim, biz => NotificationLogic.UnreadCountAsync(biz)));
        Assert.Equal(rowsBefore, await Db(db => db.Notification.CountAsync(n => n.UserId == victim)));

        // after ten minutes the window is empty again: the next one is a row of its own
        await Db(db => db.Database.ExecuteSqlInterpolatedAsync($"UPDATE \"Notification\" SET \"CreateDate\" = \"CreateDate\" - interval '11 minutes' WHERE \"UserId\" = {victim}"));
        await MentionAsync(spammer, design, "Zielperson", victim, 1);
        Assert.Equal(NotificationLogic.PerActorPerWindow + 3, await CountAsync(victim, NotificationKinds.Mention));
    }

    [Fact]
    public async Task Sharing_and_unsharing_again_and_again_does_not_fill_the_bell_of_the_receiver()
    {
        if (!Enabled)
        {
            return;
        }

        var owner = await UserAsync("owner");
        var victim = await UserAsync("victim");
        var design = await DesignOfAsync(owner);
        for (var i = 0; i < 15; i++)
        {
            var share = await AsUser(owner, biz => ShareLogic.AddAsync(biz, ItemKind.Design, design, false, victim, SharePermission.View));
            await AsUser(owner, biz => ShareLogic.RemoveAsync(biz, share.Id));
        }

        Assert.Equal(NotificationLogic.PerActorPerWindow, await CountAsync(victim, NotificationKinds.Share));
        var newest = await Db(db => db.Notification.Where(n => n.UserId == victim).OrderByDescending(n => n.Id).Select(n => n.DataJson).FirstAsync());
        Assert.Equal(5, JsonDocument.Parse(newest).RootElement.GetProperty("repeats").GetInt32());
        // a notification without a person who acts (the system writes it) is never throttled
        var system = await Db(db => db.Notification.CountAsync(n => n.UserId == victim && n.CreateUserId == null));
        Assert.Equal(0, system);
    }
}
