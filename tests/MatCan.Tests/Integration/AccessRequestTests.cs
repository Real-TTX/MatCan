using MatCan.Data.Entities;
using MatCan.Logic;
using MatCan.Services;
using Microsoft.EntityFrameworkCore;

namespace MatCan.Tests.Integration;

/// <summary>"Zugriff anfordern" (docs/PLAN-PLATFORM.md section 1.9): who may ask, who sees and decides, what a grant does, and that the answer never tells whether an item exists.</summary>
[Collection("app")]
public sealed class AccessRequestTests(AppTests.AppFactory factory) : PlatformTestBase(factory)
{
    private async Task<long> DesignAsync(Role who, string name = "Anfrage", long? folder = null)
        => await As(who, async biz => (await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign(name, null, "a4-portrait", null, null, null, null, null, folder))).Id);

    [Fact]
    public async Task A_stranger_asks_the_owner_sees_the_request_and_grants_it()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(Role.Designer);
        var stranger = await UserAsync(Role.Stranger);
        Assert.Null(await As(Role.Stranger, biz => AccessRequestLogic.MineAsync(biz, ItemKind.Design, design)));
        await As(Role.Stranger, biz => AccessRequestLogic.CreateAsync(biz, ItemKind.Design, design, SharePermission.Edit, "  Bitte mit Edit.  "));
        Assert.Equal(SharePermission.Edit, await As(Role.Stranger, biz => AccessRequestLogic.MineAsync(biz, ItemKind.Design, design)));

        var open = await As(Role.Designer, biz => AccessRequestLogic.ListAsync(biz, ItemKind.Design, design));
        var request = Assert.Single(open);
        Assert.Equal(stranger, request.UserId);
        Assert.Equal("Bitte mit Edit.", request.Message);
        Assert.Equal(SharePermission.Edit, request.Permission);

        // a second request of the same person changes the open one, it does not double it
        await As(Role.Stranger, biz => AccessRequestLogic.CreateAsync(biz, ItemKind.Design, design, SharePermission.View, "Doch nur ansehen."));
        var changed = Assert.Single(await As(Role.Designer, biz => AccessRequestLogic.ListAsync(biz, ItemKind.Design, design)));
        Assert.Equal(SharePermission.View, changed.Permission);
        Assert.Equal("Doch nur ansehen.", changed.Message);

        await As(Role.Stranger, async biz => Assert.Equal(AccessLevel.None, await Access.LevelAsync(biz, ItemKind.Design, design)));
        await As(Role.Designer, biz => AccessRequestLogic.DecideAsync(biz, changed.Id, true));
        await As(Role.Stranger, async biz => Assert.Equal(AccessLevel.View, await Access.LevelAsync(biz, ItemKind.Design, design)));
        Assert.Empty(await As(Role.Designer, biz => AccessRequestLogic.ListAsync(biz, ItemKind.Design, design)));
        Assert.Null(await As(Role.Stranger, biz => AccessRequestLogic.MineAsync(biz, ItemKind.Design, design)));
        var stored = await Db(db => db.AccessRequest.AsNoTracking().SingleAsync(r => r.Id == changed.Id));
        Assert.Equal(AccessRequestState.Granted, stored.State);
        Assert.NotNull(stored.DecidedUserId);
        Assert.NotNull(stored.DecidedDate);

        // decided once, decided: a second decision is refused
        await As(Role.Designer, async biz => await Assert.ThrowsAsync<BizException>(() => AccessRequestLogic.DecideAsync(biz, changed.Id, false)));
        // who has access cannot ask for what they have
        await As(Role.Stranger, async biz => await Assert.ThrowsAsync<BizException>(() => AccessRequestLogic.CreateAsync(biz, ItemKind.Design, design, SharePermission.View, null)));
        // but a person with View may ask for Edit
        await As(Role.Stranger, biz => AccessRequestLogic.CreateAsync(biz, ItemKind.Design, design, SharePermission.Edit, null));
        var upgrade = Assert.Single(await As(Role.Designer, biz => AccessRequestLogic.ListAsync(biz, ItemKind.Design, design)));
        await As(Role.Designer, biz => AccessRequestLogic.DecideAsync(biz, upgrade.Id, true, SharePermission.Edit));
        await As(Role.Stranger, async biz => Assert.Equal(AccessLevel.Edit, await Access.LevelAsync(biz, ItemKind.Design, design)));
        // a grant never takes something away: a request for View of somebody who has Edit through a share keeps the Edit
        await Db(async db =>
        {
            db.AccessRequest.Add(new AccessRequest { ItemKind = ItemKind.Design, ItemId = design, UserId = stranger, Permission = SharePermission.View });
            await db.SaveChangesAsync();
        });
        var late = Assert.Single(await As(Role.Designer, biz => AccessRequestLogic.ListAsync(biz, ItemKind.Design, design)));
        await As(Role.Designer, biz => AccessRequestLogic.DecideAsync(biz, late.Id, true));
        await As(Role.Stranger, async biz => Assert.Equal(AccessLevel.Edit, await Access.LevelAsync(biz, ItemKind.Design, design)));
    }

    [Fact]
    public async Task A_declined_request_gives_nothing_and_can_be_asked_again()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(Role.Designer);
        await As(Role.Stranger, biz => AccessRequestLogic.CreateAsync(biz, ItemKind.Design, design, SharePermission.View, null));
        var request = Assert.Single(await As(Role.Designer, biz => AccessRequestLogic.ListAsync(biz, ItemKind.Design, design)));
        await As(Role.Designer, biz => AccessRequestLogic.DecideAsync(biz, request.Id, false));
        await As(Role.Stranger, async biz => Assert.Equal(AccessLevel.None, await Access.LevelAsync(biz, ItemKind.Design, design)));
        Assert.Equal(AccessRequestState.Declined, (await Db(db => db.AccessRequest.AsNoTracking().SingleAsync(r => r.Id == request.Id))).State);
        // the person may ask again: a new request
        await As(Role.Stranger, biz => AccessRequestLogic.CreateAsync(biz, ItemKind.Design, design, SharePermission.View, "Noch einmal."));
        Assert.Single(await As(Role.Designer, biz => AccessRequestLogic.ListAsync(biz, ItemKind.Design, design)));
        Assert.Equal(2, await Db(db => db.AccessRequest.CountAsync(r => r.ItemId == design && r.ItemKind == ItemKind.Design)));
    }

    [Fact]
    public async Task Only_people_who_manage_the_item_see_and_decide_requests()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(Role.Designer);
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer, SharePermission.Edit);
        await As(Role.Stranger, biz => AccessRequestLogic.CreateAsync(biz, ItemKind.Design, design, SharePermission.View, null));
        var request = Assert.Single(await As(Role.Designer, biz => AccessRequestLogic.ListAsync(biz, ItemKind.Design, design)));

        // Edit is not enough (Forbidden: they see the item); a stranger does not even see it (Not found)
        await As(Role.Viewer, async biz =>
        {
            await Assert.ThrowsAsync<ForbiddenException>(() => AccessRequestLogic.ListAsync(biz, ItemKind.Design, design));
            await Assert.ThrowsAsync<ForbiddenException>(() => AccessRequestLogic.DecideAsync(biz, request.Id, true));
        });
        var third = await UserAsync("third");
        await AsUser(third, async biz =>
        {
            await Assert.ThrowsAsync<NotFoundException>(() => AccessRequestLogic.ListAsync(biz, ItemKind.Design, design));
            await Assert.ThrowsAsync<NotFoundException>(() => AccessRequestLogic.DecideAsync(biz, request.Id, true));
        });
        // a platform administrator gets nothing from the role
        await As(Role.Admin, async biz => await Assert.ThrowsAsync<NotFoundException>(() => AccessRequestLogic.ListAsync(biz, ItemKind.Design, design)));
        Assert.Single(await As(Role.Designer, biz => AccessRequestLogic.ListAsync(biz, ItemKind.Design, design)));
        // a team that owns the item: its Editors manage it and decide
        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Editor));
        var teamDesign = await As(Role.Designer, async biz => (await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign("Im Team", null, "a4-portrait", null, null, null, null, team))).Id);
        await As(Role.Stranger, biz => AccessRequestLogic.CreateAsync(biz, ItemKind.Design, teamDesign, SharePermission.View, null));
        var teamRequest = Assert.Single(await As(Role.Viewer, biz => AccessRequestLogic.ListAsync(biz, ItemKind.Design, teamDesign)));
        await As(Role.Viewer, biz => AccessRequestLogic.DecideAsync(biz, teamRequest.Id, true));
        await As(Role.Stranger, async biz => Assert.Equal(AccessLevel.View, await Access.LevelAsync(biz, ItemKind.Design, teamDesign)));
    }

    [Fact]
    public async Task Asking_about_something_that_is_not_there_answers_like_any_other_request_and_writes_nothing()
    {
        if (!Enabled)
        {
            return;
        }

        var before = await Db(db => db.AccessRequest.CountAsync());
        await As(Role.Stranger, async biz =>
        {
            await AccessRequestLogic.CreateAsync(biz, ItemKind.Design, 987654321, SharePermission.View, "?");
            await AccessRequestLogic.CreateAsync(biz, ItemKind.Folder, 987654321, SharePermission.Edit, "?");
            Assert.Null(await AccessRequestLogic.MineAsync(biz, ItemKind.Design, 987654321));
        });
        Assert.Equal(before, await Db(db => db.AccessRequest.CountAsync()));
        // the item in the trash counts as not there
        var design = await DesignAsync(Role.Designer);
        await As(Role.Designer, biz => ItemLogic.TrashAsync(biz, [new ItemRef(ItemKind.Design, design)]));
        await As(Role.Stranger, biz => AccessRequestLogic.CreateAsync(biz, ItemKind.Design, design, SharePermission.View, null));
        Assert.Equal(before, await Db(db => db.AccessRequest.CountAsync()));
        // images are not shared one by one
        await As(Role.Stranger, async biz => await Assert.ThrowsAsync<BizException>(() => AccessRequestLogic.CreateAsync(biz, ItemKind.Asset, 1, SharePermission.View, null)));
    }

    [Fact]
    public async Task The_message_is_cleaned_and_cut_and_a_person_cannot_pile_up_requests()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(Role.Designer);
        await As(Role.Stranger, biz => AccessRequestLogic.CreateAsync(biz, ItemKind.Design, design, SharePermission.View, "A\u0000B\u0007C" + new string('x', 600)));
        var stored = Assert.Single(await As(Role.Designer, biz => AccessRequestLogic.ListAsync(biz, ItemKind.Design, design)));
        Assert.Equal(AccessRequestLogic.MaxMessage, stored.Message!.Length);
        Assert.StartsWith("ABC", stored.Message);
        // an empty message is none
        await As(Role.Stranger, biz => AccessRequestLogic.CreateAsync(biz, ItemKind.Design, design, SharePermission.View, "   "));
        Assert.Null(Assert.Single(await As(Role.Designer, biz => AccessRequestLogic.ListAsync(biz, ItemKind.Design, design))).Message);

        // 50 open requests are the most a person has
        var person = await UserAsync("Fleißig");
        await Db(async db =>
        {
            for (var i = 0; i < AccessRequestLogic.MaxOpenPerPerson; i++)
            {
                db.AccessRequest.Add(new AccessRequest { ItemKind = ItemKind.Design, ItemId = 900000 + i, UserId = person, Permission = SharePermission.View });
            }

            await db.SaveChangesAsync();
        });
        var another = await DesignAsync(Role.Designer, "Noch eins");
        await AsUser(person, async biz => await Assert.ThrowsAsync<BizException>(() => AccessRequestLogic.CreateAsync(biz, ItemKind.Design, another, SharePermission.View, null)));
    }

    [Fact]
    public async Task The_dialog_gets_the_number_of_people_who_opened_the_link_and_whether_it_has_expired()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(Role.Designer);
        var link = await As(Role.Designer, biz => ShareLogic.SetLinkAsync(biz, ItemKind.Design, design, LinkAudience.SignedIn, SharePermission.View, false, DateTime.UtcNow.AddDays(2)));
        await As(Role.Stranger, biz => ShareLogic.OpenAsync(biz, link.Token));
        await As(Role.Viewer, biz => ShareLogic.OpenAsync(biz, link.Token));
        var info = await As(Role.Designer, biz => ShareLogic.InfoAsync(biz, ItemKind.Design, design));
        Assert.Equal(2, info.Link!.GrantCount);
        Assert.False(info.Link.Expired);
        await Db(db => db.ShareLink.Where(l => l.Id == link.Id).ExecuteUpdateAsync(s => s.SetProperty(l => l.ExpiresDate, DateTime.UtcNow.AddMinutes(-5))));
        var later = await As(Role.Designer, biz => ShareLogic.InfoAsync(biz, ItemKind.Design, design));
        Assert.True(later.Link!.Expired);
        // an expired link grants nothing: the people who opened it are out
        await As(Role.Stranger, async biz => Assert.Equal(AccessLevel.None, await Access.LevelAsync(biz, ItemKind.Design, design)));
    }

    // ------------------------------------------------------------------------------------------------ presence

    [Fact]
    public void Presence_is_in_memory_times_out_after_thirty_seconds_and_forgets_who_left()
    {
        var clock = new ManualClock(new DateTimeOffset(2026, 10, 25, 12, 0, 0, TimeSpan.Zero));
        var tracker = new PresenceTracker(clock);
        Assert.Empty(tracker.Current(1));

        var first = tracker.Beat(1, 10, "Anna", editing: true);
        Assert.Equal([new PresenceEntry(10, "Anna", true)], first);
        clock.Advance(TimeSpan.FromSeconds(15));
        var both = tracker.Beat(1, 11, "Ben", editing: false);
        Assert.Equal(["Anna", "Ben"], both.Select(p => p.Name));
        Assert.Equal([10L], both.Where(p => p.Editing).Select(p => p.UserId));

        // Anna beat 25 s ago, Ben 10 s ago: both there; five seconds later Anna is gone
        clock.Advance(TimeSpan.FromSeconds(10));
        Assert.Equal(2, tracker.Current(1).Count);
        clock.Advance(TimeSpan.FromSeconds(6));
        Assert.Equal(["Ben"], tracker.Current(1).Select(p => p.Name));
        // another design is another room
        tracker.Beat(2, 10, "Anna", true);
        Assert.Equal(["Ben"], tracker.Current(1).Select(p => p.Name));
        Assert.Single(tracker.Current(2));
        // leaving removes at once, a beat brings the person back, the pruning drops empty rooms
        tracker.Leave(1, 11);
        Assert.Empty(tracker.Current(1));
        tracker.Beat(1, 11, "Ben", false);
        Assert.Single(tracker.Current(1));
        clock.Advance(TimeSpan.FromMinutes(5));
        tracker.Prune();
        Assert.Empty(tracker.Current(1));
        Assert.Empty(tracker.Current(2));
        // leaving a room nobody is in is nothing
        tracker.Leave(99, 1);
    }

    [Fact]
    public async Task The_beat_needs_view_on_the_design_and_tells_editors_from_viewers()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(Role.Designer);
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer, SharePermission.View);
        await As(Role.Stranger, async biz => await Assert.ThrowsAsync<NotFoundException>(() => PresenceLogic.BeatAsync(biz, design)));
        var owner = await As(Role.Designer, biz => PresenceLogic.BeatAsync(biz, design));
        Assert.Single(owner);
        Assert.True(owner[0].Editing);
        var viewer = await As(Role.Viewer, biz => PresenceLogic.BeatAsync(biz, design));
        Assert.Equal(2, viewer.Count);
        Assert.Contains(viewer, p => p.Editing);
        Assert.Contains(viewer, p => !p.Editing);
        var left = await As(Role.Viewer, biz => PresenceLogic.BeatAsync(biz, design, leave: true));
        Assert.Single(left);
        // a design in the trash is gone for the beat, too
        await As(Role.Designer, biz => ItemLogic.TrashAsync(biz, [new ItemRef(ItemKind.Design, design)]));
        await As(Role.Designer, async biz => await Assert.ThrowsAsync<NotFoundException>(() => PresenceLogic.BeatAsync(biz, design)));
    }
}
