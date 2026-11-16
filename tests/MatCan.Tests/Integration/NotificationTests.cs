using MatCan.Data.Entities;
using MatCan.Logic;
using MatCan.Services.Mail;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MatCan.Tests.Integration;

/// <summary>Notifications (docs/PLAN-PLATFORM.md section 1.17): written at every hook, seen only by the receiver, read one by one or all at once, kept to 500 per person, words built from the data, and the mails that follow.</summary>
[Collection("app")]
public sealed class NotificationTests(AppTests.AppFactory factory) : PlatformTestBase(factory)
{
    private async Task<long> DesignAsync(Role who, string name = "Plakat")
        => await As(who, async biz => (await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign(name, null, "a4-portrait", null, null, null, null, null))).Id);

    private Task<NotificationPage> MineAsync(Role who, int take = 50, bool unreadOnly = false) => As(who, biz => NotificationLogic.ListAsync(biz, 0, take, unreadOnly));

    private async Task<T> WithQueue<T>(Func<List<MailJob>, Task<T>> action)
    {
        var queue = Factory.Services.GetRequiredService<MailQueue>();
        var seen = new List<MailJob>();
        void Handler(MailJob job) { lock (seen) { seen.Add(job); } }
        queue.Queued += Handler;
        try
        {
            return await action(seen);
        }
        finally
        {
            queue.Queued -= Handler;
        }
    }

    [Fact]
    public async Task A_share_with_a_person_notifies_that_person_with_the_message_and_nobody_else()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(Role.Designer, "Sommerfest");
        var viewer = await UserAsync(Role.Viewer);
        await As(Role.Designer, biz => ShareLogic.AddAsync(biz, ItemKind.Design, design, false, viewer, SharePermission.Edit, "Schau mal drauf."));

        var page = await MineAsync(Role.Viewer);
        var n = Assert.Single(page.Items);
        Assert.Equal(NotificationKinds.Share, n.Kind);
        Assert.Equal("Designer hat „Sommerfest“ mit dir geteilt (Kann bearbeiten).", n.Text);
        Assert.Equal("Schau mal drauf.", n.Message);
        Assert.Equal($"/Designs/{design}/Designer", n.Url);
        Assert.False(n.IsRead);
        Assert.Equal(1, page.Unread);
        // nobody else got one: not the sharer, not a stranger, not the administrator
        Assert.Empty((await MineAsync(Role.Designer)).Items);
        Assert.Empty((await MineAsync(Role.Stranger)).Items);
        Assert.Empty((await MineAsync(Role.Admin)).Items);

        // a change of the permission tells again, the same permission twice does not
        await As(Role.Designer, biz => ShareLogic.AddAsync(biz, ItemKind.Design, design, false, viewer, SharePermission.Edit));
        Assert.Single((await MineAsync(Role.Viewer)).Items);
        await As(Role.Designer, biz => ShareLogic.AddAsync(biz, ItemKind.Design, design, false, viewer, SharePermission.View));
        var after = await MineAsync(Role.Viewer);
        Assert.Equal(2, after.Items.Count);
        Assert.Contains("Kann ansehen", after.Items[0].Text);
    }

    [Fact]
    public async Task A_share_with_a_team_notifies_every_member_except_the_one_who_shared()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Viewer), (Role.Stranger, SpaceRole.Editor));
        var teamName = await Db(db => db.Space.Where(s => s.Id == team).Select(s => s.Name).SingleAsync());
        var design = await DesignAsync(Role.Designer, "Fürs Team");
        await As(Role.Designer, biz => ShareLogic.AddAsync(biz, ItemKind.Design, design, true, team, SharePermission.View));
        foreach (var who in new[] { Role.Viewer, Role.Stranger })
        {
            var n = Assert.Single((await MineAsync(who)).Items, i => i.Kind == NotificationKinds.Share);
            Assert.Contains($"mit dem Team „{teamName}“ geteilt", n.Text);
        }

        Assert.DoesNotContain((await MineAsync(Role.Designer)).Items, i => i.Kind == NotificationKinds.Share);
    }

    [Fact]
    public async Task An_access_request_goes_to_the_managers_and_the_decision_to_the_requester()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Viewer), (Role.Admin, SpaceRole.Editor));
        var design = await As(Role.Designer, async biz => (await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign("Anfrage", null, "a4-portrait", null, null, null, null, team))).Id);
        await As(Role.Stranger, biz => AccessRequestLogic.CreateAsync(biz, ItemKind.Design, design, SharePermission.Edit, "Darf ich?"));

        // the people who manage the item (owner and editor of the team) hear about it; the team's viewer does not
        var managers = new[] { Role.Designer, Role.Admin };
        foreach (var who in managers)
        {
            var n = Assert.Single((await MineAsync(who)).Items, i => i.Kind == NotificationKinds.AccessRequest);
            Assert.Equal("Stranger möchte „Anfrage“ bearbeiten.", n.Text);
            Assert.Equal("Darf ich?", n.Message);
            Assert.NotNull(n.RequestId);
            Assert.Equal("open", n.RequestState);
        }

        Assert.DoesNotContain((await MineAsync(Role.Viewer)).Items, i => i.Kind == NotificationKinds.AccessRequest);
        // asking again changes the open request, it does not notify twice
        await As(Role.Stranger, biz => AccessRequestLogic.CreateAsync(biz, ItemKind.Design, design, SharePermission.View, "Doch nur ansehen."));
        Assert.Single((await MineAsync(Role.Designer)).Items, i => i.Kind == NotificationKinds.AccessRequest);

        var requestId = (await MineAsync(Role.Designer)).Items.Single(i => i.Kind == NotificationKinds.AccessRequest).RequestId!.Value;
        await As(Role.Designer, biz => AccessRequestLogic.DecideAsync(biz, requestId, true));
        var granted = (await MineAsync(Role.Stranger)).Items;
        var answer = Assert.Single(granted);
        Assert.Equal(NotificationKinds.AccessGranted, answer.Kind);
        Assert.Contains("hat dir Zugriff auf „Anfrage“ gegeben", answer.Text);
        // the grant is not announced a second time as a share
        Assert.DoesNotContain(granted, i => i.Kind == NotificationKinds.Share);
        // the managers' notification now shows the request as decided
        Assert.Equal("granted", (await MineAsync(Role.Designer)).Items.Single(i => i.Kind == NotificationKinds.AccessRequest).RequestState);

        // a declined request
        var other = await As(Role.Designer, async biz => (await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign("Nein", null, "a4-portrait", null, null, null, null, team))).Id);
        await As(Role.Stranger, biz => AccessRequestLogic.CreateAsync(biz, ItemKind.Design, other, SharePermission.View, null));
        var second = (await As(Role.Designer, biz => AccessRequestLogic.ListAsync(biz, ItemKind.Design, other))).Single();
        await As(Role.Designer, biz => AccessRequestLogic.DecideAsync(biz, second.Id, false));
        Assert.Contains((await MineAsync(Role.Stranger)).Items, i => i.Kind == NotificationKinds.AccessDeclined && i.Text.Contains("abgelehnt") && i.Url is null);
    }

    [Fact]
    public async Task Changes_in_a_team_notify_the_person_and_an_accepted_invitation_notifies_the_inviter()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await TeamAsync(Role.Designer);
        var teamName = await Db(db => db.Space.Where(s => s.Id == team).Select(s => s.Name).SingleAsync());
        var viewer = await UserAsync(Role.Viewer);
        await As(Role.Designer, biz => SpaceLogic.AddMemberAsync(biz, team, viewer, SpaceRole.Viewer));
        await As(Role.Designer, biz => SpaceLogic.ChangeRoleAsync(biz, team, viewer, SpaceRole.Editor));
        await As(Role.Designer, biz => SpaceLogic.RemoveMemberAsync(biz, team, viewer));
        var texts = (await MineAsync(Role.Viewer)).Items.OrderBy(i => i.Id).Select(i => (i.Kind, i.Text)).ToList();
        Assert.Equal(
            [
                (NotificationKinds.TeamAdded, $"Designer hat dich zum Team „{teamName}“ hinzugefügt (Rolle: Betrachter)."),
                (NotificationKinds.TeamRole, $"Deine Rolle im Team „{teamName}“ ist jetzt Bearbeiter."),
                (NotificationKinds.TeamRemoved, $"Du bist nicht mehr im Team „{teamName}“."),
            ], texts);

        // handing over the ownership tells the new owner
        var stranger = await UserAsync(Role.Stranger);
        await As(Role.Designer, biz => SpaceLogic.AddMemberAsync(biz, team, stranger, SpaceRole.Admin));
        await As(Role.Designer, biz => SpaceLogic.TransferOwnershipAsync(biz, team, stranger));
        Assert.Contains((await MineAsync(Role.Stranger)).Items, i => i.Kind == NotificationKinds.TeamRole && i.Text.Contains("Inhaber"));

        // an invitation that is accepted tells whoever made it
        var invitation = (await As(Role.Stranger, biz => InviteLogic.CreateAsync(biz, team, SpaceRole.Editor, null, true, 7, 1))).Created.Single();
        await As(Role.Viewer, biz => InviteLogic.AcceptAsync(biz, invitation.Token));
        var accepted = Assert.Single((await MineAsync(Role.Stranger)).Items, i => i.Kind == NotificationKinds.InviteAccepted);
        Assert.Equal($"Viewer hat deine Einladung ins Team „{teamName}“ angenommen.", accepted.Text);
    }

    [Fact]
    public async Task A_person_reads_one_or_all_and_never_touches_the_notifications_of_another()
    {
        if (!Enabled)
        {
            return;
        }

        var viewer = await UserAsync(Role.Viewer);
        var stranger = await UserAsync(Role.Stranger);
        var design = await DesignAsync(Role.Designer, "Gelesen");
        var second = await DesignAsync(Role.Designer, "Zweites");
        foreach (var id in new[] { design, second })
        {
            await As(Role.Designer, async biz =>
            {
                await ShareLogic.AddAsync(biz, ItemKind.Design, id, false, viewer, SharePermission.View);
                await ShareLogic.AddAsync(biz, ItemKind.Design, id, false, stranger, SharePermission.View);
            });
        }

        var mine = await MineAsync(Role.Viewer);
        Assert.Equal((2, 2), (mine.Total, mine.Unread));
        Assert.Equal(2, await As(Role.Viewer, biz => NotificationLogic.UnreadCountAsync(biz)));
        var first = mine.Items[0];
        // somebody else's id changes nothing and gives nothing away
        await As(Role.Stranger, async biz =>
        {
            await NotificationLogic.ReadAsync(biz, first.Id);
            Assert.Null(await NotificationLogic.OpenAsync(biz, first.Id));
        });
        Assert.Equal(2, await As(Role.Viewer, biz => NotificationLogic.UnreadCountAsync(biz)));

        Assert.Equal(first.Url, await As(Role.Viewer, biz => NotificationLogic.OpenAsync(biz, first.Id)));
        Assert.Equal(1, await As(Role.Viewer, biz => NotificationLogic.UnreadCountAsync(biz)));
        Assert.Single((await MineAsync(Role.Viewer, unreadOnly: true)).Items);
        // the stranger's own are untouched by all of it
        Assert.Equal(2, (await MineAsync(Role.Stranger)).Unread);

        Assert.Equal(1, await As(Role.Viewer, biz => NotificationLogic.ReadAllAsync(biz)));
        Assert.Equal(0, await As(Role.Viewer, biz => NotificationLogic.UnreadCountAsync(biz)));
        Assert.Equal(2, (await MineAsync(Role.Viewer)).Total);
        Assert.Equal(2, (await MineAsync(Role.Stranger)).Unread);
        // paging
        Assert.Single((await As(Role.Viewer, biz => NotificationLogic.ListAsync(biz, 1, 1))).Items);
        // nothing without a sign-in
        await AsAnonymous(biz => Assert.ThrowsAsync<ForbiddenException>(() => NotificationLogic.ListAsync(biz)));
    }

    [Fact]
    public async Task The_newest_five_hundred_are_kept_and_the_words_come_from_the_data_never_as_markup()
    {
        if (!Enabled)
        {
            return;
        }

        var viewer = await UserAsync(Role.Viewer);
        await Db(async db =>
        {
            var old = DateTime.UtcNow.AddDays(-5);
            db.Notification.AddRange(Enumerable.Range(0, 560).Select(i => new Notification { UserId = viewer, Kind = NotificationKinds.Share, DataJson = "{\"by\":\"Alt\",\"itemName\":\"x\"}", CreateDate = old.AddSeconds(i) }));
            await db.SaveChangesAsync();
        });
        var evil = await DesignAsync(Role.Designer, "<img src=x onerror=alert(1)> & \"Plakat\"");
        await As(Role.Designer, biz => ShareLogic.AddAsync(biz, ItemKind.Design, evil, false, viewer, SharePermission.View, "<script>alert(1)</script>"));
        Assert.Equal(NotificationLogic.KeepPerPerson, await Db(db => db.Notification.CountAsync(n => n.UserId == viewer)));
        var newest = (await MineAsync(Role.Viewer, 1)).Items.Single();
        // plain text with the characters as typed: the page writes it with textContent, the mail encodes it
        Assert.Contains("<img src=x onerror=alert(1)> & \"Plakat\"", newest.Text);
        Assert.Equal("<script>alert(1)</script>", newest.Message);
        var stored = await Db(db => db.Notification.Where(n => n.UserId == viewer).OrderByDescending(n => n.Id).Select(n => n.DataJson).FirstAsync());
        Assert.StartsWith("{", stored);
        Assert.DoesNotContain("Designer hat", stored);

        // unknown kinds and broken data say something harmless
        Assert.Equal("Es gibt etwas Neues.", NotificationLogic.Describe("kommt-noch", "{}").Text);
        Assert.Contains("Jemand hat „ein Element“ mit dir geteilt", NotificationLogic.Describe(NotificationKinds.Share, "kaputt{").Text);
    }

    [Fact]
    public async Task A_mail_is_queued_with_the_id_of_the_notification_and_follows_the_profile_of_the_receiver()
    {
        if (!Enabled)
        {
            return;
        }

        var composer = Factory.Services.GetRequiredService<MailComposer>();
        var viewer = await UserAsync(Role.Viewer);
        var viewerMail = await Db(db => db.User.Where(u => u.Id == viewer).Select(u => u.Email).SingleAsync());
        var design = await DesignAsync(Role.Designer, "Per Mail");

        var jobs = await WithQueue(async seen =>
        {
            await As(Role.Designer, biz => ShareLogic.AddAsync(biz, ItemKind.Design, design, false, viewer, SharePermission.View, "Mit Gruß"));
            return seen.ToList();
        });
        var job = Assert.IsType<MailJob.Notification>(Assert.Single(jobs));
        var row = await Db(db => db.Notification.SingleAsync(n => n.Id == job.NotificationId));
        Assert.Equal(viewer, row.UserId);

        // dropped without usable settings
        Assert.Null(await composer.ComposeAsync(job));
        await using (await MailAsync(UsableMail()))
        {
            var mail = await composer.ComposeAsync(job);
            Assert.NotNull(mail);
            Assert.Equal(viewerMail, mail!.To);
            Assert.Contains("Designer hat „Per Mail“ mit dir geteilt", mail.Subject);
            Assert.Contains("Mit Gruß", mail.Text);
            Assert.Contains($"/Designs/{design}/Designer", mail.Html);

            // the profile: no mail for shares
            await As(Role.Viewer, biz => NotificationLogic.SaveMailSettingsAsync(biz, new NotifyMailSettings { Shares = false }));
            Assert.Null(await composer.ComposeAsync(job));
            await As(Role.Viewer, async biz => Assert.False((await NotificationLogic.MailSettingsAsync(biz)).Shares));
            await As(Role.Viewer, biz => NotificationLogic.SaveMailSettingsAsync(biz, new NotifyMailSettings()));
            Assert.NotNull(await composer.ComposeAsync(job));

            // a notification that is gone is no mail
            await Db(db => db.Notification.Where(n => n.Id == job.NotificationId).ExecuteDeleteAsync());
            Assert.Null(await composer.ComposeAsync(job));
        }

        // team changes (role, removal) are notifications only: no job at all
        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Viewer));
        var more = await WithQueue(async seen =>
        {
            await As(Role.Designer, biz => SpaceLogic.ChangeRoleAsync(biz, team, viewer, SpaceRole.Editor));
            await As(Role.Designer, biz => SpaceLogic.RemoveMemberAsync(biz, team, viewer));
            return seen.ToList();
        });
        Assert.Empty(more);
    }

    [Fact]
    public async Task The_mail_settings_of_a_profile_are_kept_as_json_and_each_kind_belongs_to_one_group()
    {
        if (!Enabled)
        {
            return;
        }

        Assert.Equal("shares", NotifyMailSettings.GroupOf(NotificationKinds.Share));
        Assert.Equal("shares", NotifyMailSettings.GroupOf(NotificationKinds.AccessGranted));
        Assert.Equal("requests", NotifyMailSettings.GroupOf(NotificationKinds.AccessRequest));
        Assert.Equal("mentions", NotifyMailSettings.GroupOf(NotificationKinds.Mention));
        Assert.Equal("invitations", NotifyMailSettings.GroupOf(NotificationKinds.TeamAdded));
        Assert.Null(NotifyMailSettings.GroupOf(NotificationKinds.TeamRemoved));
        var all = NotifyMailSettings.Parse("kaputt");
        Assert.True(all.Shares && all.Requests && all.Mentions && all.Invitations);
        var some = NotifyMailSettings.Parse(new NotifyMailSettings { Requests = false, Mentions = false }.ToJson());
        Assert.True(some.Wants(NotificationKinds.Share));
        Assert.False(some.Wants(NotificationKinds.AccessRequest));
        Assert.False(some.Wants(NotificationKinds.Mention));
        Assert.False(some.Wants(NotificationKinds.TeamRemoved));
        Assert.True((await As(Role.Designer, biz => NotificationLogic.MailSettingsAsync(biz))).Shares);
    }
}
