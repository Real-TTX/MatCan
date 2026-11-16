using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using MatCan.Data;
using MatCan.Data.Entities;
using MatCan.Logic;
using MatCan.Services.Mail;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MatCan.Tests.Integration;

/// <summary>
/// Comments in the editor (docs/PLAN-PLATFORM.md section 1.18): who may write, reply, edit, resolve and delete, the pin, the limits, the text rules, the people one can mention and the notifications that follow.
/// The methods on a design (list, add, mention candidates) are also rows of the table in <see cref="PermissionTests"/>; the methods on a comment have their table here.
/// </summary>
[Collection("app")]
public sealed class CommentTests(AppTests.AppFactory factory) : PlatformTestBase(factory)
{
    private const string TwoPages = """{"schema":2,"unit":"mm","width":100,"height":80,"pages":[{"id":"p1","elements":[{"id":"t1","type":"text","x":5,"y":5,"w":40,"h":10,"text":"Hallo"},{"id":"g1","type":"group","x":0,"y":0,"w":10,"h":10,"children":[{"id":"inner","type":"shape","shape":"rect","x":1,"y":1,"w":5,"h":5}]}]},{"id":"p2","elements":[{"id":"t2","type":"text","x":5,"y":5,"w":40,"h":10,"text":"Zwei"}]}]}""";

    private const string OnlyPageTwo = """{"schema":2,"unit":"mm","width":100,"height":80,"pages":[{"id":"p2","elements":[]}]}""";

    private async Task<long> DesignAsync(Role who = Role.Designer, string name = "Kommentar-Plakat", bool twoPages = true)
    {
        var id = await As(who, async biz => (await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign(name, null, "a4-portrait", null, null, null, null, null, null))).Id);
        if (twoPages)
        {
            await SaveDocumentAsync(who, id, TwoPages);
        }

        return id;
    }

    private async Task SaveDocumentAsync(Role who, long design, string json)
    {
        var revision = await Db(db => db.Design.AsNoTracking().Where(d => d.Id == design).Select(d => d.Revision).SingleAsync());
        await As(who, biz => DesignLogic.SaveDocumentAsync(biz, design, revision, json));
    }

    private Task<CommentRow> WriteAsync(Role who, long design, string text, string? pageId = null, string? elementId = null, double? x = null, double? y = null, long? parent = null, params long[] mentions)
        => As(who, biz => CommentLogic.AddAsync(biz, design, new CommentInput(text, pageId, elementId, x, y, parent, mentions)));

    private Task<CommentList> ListAsync(Role who, long design) => As(who, biz => CommentLogic.ListAsync(biz, design));

    private Task<List<Notification>> NotificationsAsync(Role who, string? kind = null)
    {
        var uid = UserAsync(who);
        return Db(async db =>
        {
            var id = await uid;
            return await db.Notification.AsNoTracking().Where(n => n.UserId == id && (kind == null ? n.Kind != "share" : n.Kind == kind)).OrderBy(n => n.Id).ToListAsync();
        });
    }

    // ------------------------------------------------------------------------------------------------ the text

    [Theory]
    [InlineData(null, "")]
    [InlineData("   ", "")]
    [InlineData("  Hallo  ", "Hallo")]
    [InlineData("a\r\nb\rc", "a\nb\nc")]
    [InlineData("a\tb", "a b")]
    [InlineData("a\u0000b\u0007c", "abc")]
    [InlineData("rtl‮text⁦x⁩", "rtltextx")]
    [InlineData("zero​width‍﻿join⁠er", "zerowidthjoiner")]
    [InlineData("a\n\n\n\n\nb", "a\n\nb")]
    [InlineData("Ümläute und 😀 bleiben", "Ümläute und 😀 bleiben")]
    public void The_text_is_cleaned_before_it_is_stored(string? raw, string expected) => Assert.Equal(expected, CommentLogic.CleanText(raw));

    [Fact]
    public async Task Text_has_one_to_two_thousand_characters_and_too_long_is_refused_not_cut()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync();
        await Assert.ThrowsAsync<BizException>(() => WriteAsync(Role.Designer, design, "   "));
        await Assert.ThrowsAsync<BizException>(() => WriteAsync(Role.Designer, design, "​‮"));
        var limit = await WriteAsync(Role.Designer, design, new string('x', 2000));
        Assert.Equal(2000, limit.Text.Length);
        var tooLong = await Assert.ThrowsAsync<BizException>(() => WriteAsync(Role.Designer, design, new string('x', 2001)));
        Assert.Contains("2000", tooLong.Message);
        Assert.Single((await ListAsync(Role.Designer, design)).Threads);
        // the stored text is the cleaned one, and it is plain text: nothing is interpreted
        var tags = await WriteAsync(Role.Designer, design, "<b>fett</b> <script>alert(1)</script>‮");
        Assert.Equal("<b>fett</b> <script>alert(1)</script>", tags.Text);
    }

    // ------------------------------------------------------------------------------------------------ threads, replies, who may comment

    [Fact]
    public async Task A_person_who_may_only_view_can_comment_and_reply_and_a_stranger_gets_404_everywhere()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync();
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer, SharePermission.View);
        var root = await WriteAsync(Role.Designer, design, "Bitte den Titel größer machen.", "p1");
        var reply = await WriteAsync(Role.Viewer, design, "Gemacht? Sieht gut aus.", parent: root.Id);
        var own = await WriteAsync(Role.Viewer, design, "Eine Frage von mir.", "p2");
        Assert.Equal(root.Id, reply.ParentId);
        Assert.True(reply.Mine);

        var threads = (await ListAsync(Role.Viewer, design)).Threads;
        Assert.Equal(2, threads.Count);
        var first = threads.Single(t => t.Root.Id == root.Id);
        Assert.Equal(reply.Id, Assert.Single(first.Replies).Id);
        // what the viewer may do with each row: nothing with the owner's comment, everything with the own
        Assert.False(first.Root.CanEdit);
        Assert.False(first.Root.CanDelete);
        Assert.False(first.Root.CanResolve);
        Assert.True(first.Replies[0].CanEdit);
        Assert.True(first.Replies[0].CanDelete);
        Assert.False(first.Replies[0].CanResolve);
        var mine = threads.Single(t => t.Root.Id == own.Id);
        Assert.True(mine.Root.CanEdit && mine.Root.CanDelete && mine.Root.CanResolve);
        // the owner manages the design: may delete every row and resolve every thread
        var owner = (await ListAsync(Role.Designer, design)).Threads.Single(t => t.Root.Id == own.Id);
        Assert.False(owner.Root.CanEdit);
        Assert.True(owner.Root.CanDelete);
        Assert.True(owner.Root.CanResolve);
        Assert.Equal("Viewer", owner.Root.AuthorName);
        Assert.Equal("V", owner.Root.AuthorInitials);

        // a stranger: nothing is visible and nothing works, always 404
        await As(Role.Stranger, async biz =>
        {
            await Assert.ThrowsAsync<NotFoundException>(() => CommentLogic.ListAsync(biz, design));
            await Assert.ThrowsAsync<NotFoundException>(() => CommentLogic.AddAsync(biz, design, new CommentInput("Hallo", null, null, null, null, null, null)));
            await Assert.ThrowsAsync<NotFoundException>(() => CommentLogic.MentionCandidatesAsync(biz, design, "a"));
            await Assert.ThrowsAsync<NotFoundException>(() => CommentLogic.EditAsync(biz, root.Id, "x", null));
            await Assert.ThrowsAsync<NotFoundException>(() => CommentLogic.ResolveAsync(biz, root.Id));
            await Assert.ThrowsAsync<NotFoundException>(() => CommentLogic.ReopenAsync(biz, root.Id));
            await Assert.ThrowsAsync<NotFoundException>(() => CommentLogic.DeleteAsync(biz, root.Id));
        });
        // a comment that is not there looks the same
        await As(Role.Designer, async biz => await Assert.ThrowsAsync<NotFoundException>(() => CommentLogic.ResolveAsync(biz, 987_654_321)));
        // an administrator gets nothing from the role: it is somebody else's design
        await As(Role.Admin, async biz => await Assert.ThrowsAsync<NotFoundException>(() => CommentLogic.ListAsync(biz, design)));
    }

    [Fact]
    public async Task A_reply_goes_to_a_top_level_comment_of_the_same_design_only_and_carries_no_pin()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync();
        var other = await DesignAsync(name: "Anderes");
        var root = await WriteAsync(Role.Designer, design, "Oben", "p1", "t1", 10, 10);
        var reply = await WriteAsync(Role.Designer, design, "Antwort mit Pin?", "p2", "t2", 20, 20, parent: root.Id);
        Assert.Equal(root.Id, reply.ParentId);
        Assert.Null(reply.PageId);
        Assert.Null(reply.ElementId);
        Assert.Null(reply.X);
        Assert.Null(reply.Y);
        // no second level
        await Assert.ThrowsAsync<BizException>(() => WriteAsync(Role.Designer, design, "Antwort auf Antwort", parent: reply.Id));
        // a parent of another design, and one that is not there
        await Assert.ThrowsAsync<BizException>(() => WriteAsync(Role.Designer, other, "Falscher Faden", parent: root.Id));
        await Assert.ThrowsAsync<BizException>(() => WriteAsync(Role.Designer, design, "Gibt es nicht", parent: 987_654_321));
        // a deleted comment cannot be answered
        await As(Role.Designer, biz => CommentLogic.DeleteAsync(biz, root.Id));
        await Assert.ThrowsAsync<BizException>(() => WriteAsync(Role.Designer, design, "Zu spät", parent: root.Id));
        Assert.Empty((await ListAsync(Role.Designer, design)).Threads);
    }

    [Fact]
    public async Task A_design_in_the_trash_has_no_comments_for_anybody()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync();
        var root = await WriteAsync(Role.Designer, design, "Bleibt");
        await As(Role.Designer, biz => ItemLogic.TrashAsync(biz, [new ItemRef(ItemKind.Design, design)]));
        await As(Role.Designer, async biz =>
        {
            await Assert.ThrowsAsync<NotFoundException>(() => CommentLogic.ListAsync(biz, design));
            await Assert.ThrowsAsync<NotFoundException>(() => CommentLogic.AddAsync(biz, design, new CommentInput("Neu", null, null, null, null, null, null)));
            await Assert.ThrowsAsync<NotFoundException>(() => CommentLogic.ResolveAsync(biz, root.Id));
        });
        await As(Role.Designer, biz => ItemLogic.RestoreAsync(biz, [new ItemRef(ItemKind.Design, design)]));
        Assert.Single((await ListAsync(Role.Designer, design)).Threads);
    }

    [Fact]
    public async Task The_templates_of_the_platform_have_no_comments()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync();
        await Db(async db =>
        {
            var d = await db.Design.SingleAsync(x => x.Id == design);
            d.SpaceId = null;
            d.FolderId = null;
            await db.SaveChangesAsync();
        });
        var list = await ListAsync(Role.Stranger, design);
        Assert.False(list.CanComment);
        Assert.Empty(list.Threads);
        await Assert.ThrowsAsync<BizException>(() => WriteAsync(Role.Stranger, design, "Spam"));
    }

    // ------------------------------------------------------------------------------------------------ the pin

    [Fact]
    public async Task The_pin_must_fit_the_document_and_what_does_not_fit_is_dropped()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync();
        var onPage = await WriteAsync(Role.Designer, design, "Seite", "p1");
        Assert.Equal(("p1", null, null, null), (onPage.PageId, onPage.ElementId, onPage.X, onPage.Y));

        var pinned = await WriteAsync(Role.Designer, design, "Punkt", "p2", null, 12.3456, 40);
        Assert.Equal(("p2", 12.346, 40d), (pinned.PageId, pinned.X, pinned.Y));
        Assert.Null(pinned.ElementId);

        // on an element, also one inside a group
        var onElement = await WriteAsync(Role.Designer, design, "Element", "p1", "t1", 25, 10);
        Assert.Equal("t1", onElement.ElementId);
        var inGroup = await WriteAsync(Role.Designer, design, "Gruppenkind", "p1", "inner", 3, 3);
        Assert.Equal("inner", inGroup.ElementId);

        // an element of another page, an element that is not there: dropped, the pin stays
        var wrongPage = await WriteAsync(Role.Designer, design, "Falsche Seite", "p1", "t2", 5, 5);
        Assert.Null(wrongPage.ElementId);
        Assert.Equal(("p1", 5d, 5d), (wrongPage.PageId, wrongPage.X, wrongPage.Y));
        var nothing = await WriteAsync(Role.Designer, design, "Nichts", "p1", "nope", 5, 5);
        Assert.Null(nothing.ElementId);

        // a page that is not there: the whole pin goes, the comment stays on the design
        var noPage = await WriteAsync(Role.Designer, design, "Keine Seite", "p9", "t1", 5, 5);
        Assert.Equal((null, null, null, null), (noPage.PageId, noPage.ElementId, noPage.X, noPage.Y));
        var noPageAtAll = await WriteAsync(Role.Designer, design, "Ohne Seite", null, null, 5, 5);
        Assert.Null(noPageAtAll.X);

        // the point is clamped into the page (100 x 80), half a point is no point
        var clamped = await WriteAsync(Role.Designer, design, "Rand", "p1", null, -50, 5000);
        Assert.Equal((0d, 80d), (clamped.X, clamped.Y));
        var half = await WriteAsync(Role.Designer, design, "Halb", "p1", null, 5, null);
        Assert.Null(half.X);
        Assert.Null(half.Y);
        var notANumber = await WriteAsync(Role.Designer, design, "NaN", "p1", null, double.NaN, double.PositiveInfinity);
        Assert.Null(notANumber.X);
    }

    [Fact]
    public async Task A_comment_stays_when_its_element_or_its_page_is_deleted_later()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync();
        var onElement = await WriteAsync(Role.Designer, design, "Am Text", "p1", "t1", 25, 10);
        var onPageOne = await WriteAsync(Role.Designer, design, "Auf Seite 1", "p1");
        var onPageTwo = await WriteAsync(Role.Designer, design, "Auf Seite 2", "p2", "t2", 25, 10);
        // the document loses page 1 and with it t1
        await SaveDocumentAsync(Role.Designer, design, OnlyPageTwo);
        var threads = (await ListAsync(Role.Designer, design)).Threads;
        Assert.Equal(3, threads.Count);
        // the client finds out that the page / element is gone: the rows still say what they said
        Assert.Equal(("p1", "t1"), (threads.Single(t => t.Root.Id == onElement.Id).Root.PageId, threads.Single(t => t.Root.Id == onElement.Id).Root.ElementId));
        Assert.Equal("p1", threads.Single(t => t.Root.Id == onPageOne.Id).Root.PageId);
        Assert.Equal("p2", threads.Single(t => t.Root.Id == onPageTwo.Id).Root.PageId);
    }

    // ------------------------------------------------------------------------------------------------ limits

    [Fact]
    public async Task A_person_writes_thirty_comments_a_minute_and_a_design_holds_five_hundred()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(twoPages: false);
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer, SharePermission.View);
        for (var i = 0; i < CommentLogic.MaxPerMinute; i++)
        {
            await WriteAsync(Role.Viewer, design, "Nr. " + i);
        }

        var fast = await Assert.ThrowsAsync<BizException>(() => WriteAsync(Role.Viewer, design, "Zu schnell"));
        Assert.Contains("schnell", fast.Message);
        // deleting does not give the minute back, and another person is not held up
        await As(Role.Viewer, async biz => await CommentLogic.DeleteAsync(biz, (await CommentLogic.ListAsync(biz, design)).Threads[0].Root.Id));
        await Assert.ThrowsAsync<BizException>(() => WriteAsync(Role.Viewer, design, "Immer noch zu schnell"));
        await WriteAsync(Role.Designer, design, "Der Eigentümer darf");

        // 500 per design: fill up with old rows, then one more is refused until something is deleted
        var full = await DesignAsync(twoPages: false);
        var owner = await UserAsync(Role.Designer);
        await Db(async db =>
        {
            var old = DateTime.UtcNow.AddHours(-2);
            for (var i = 0; i < CommentLogic.MaxPerDesign; i++)
            {
                db.Comment.Add(new Comment { DesignId = full, Text = "alt " + i, CreateDate = old, CreateUserId = owner });
            }

            await db.SaveChangesAsync();
        });
        var refused = await Assert.ThrowsAsync<BizException>(() => WriteAsync(Role.Designer, full, "Eins zu viel"));
        Assert.Contains("500", refused.Message);
        await As(Role.Designer, async biz => await CommentLogic.DeleteAsync(biz, (await CommentLogic.ListAsync(biz, full)).Threads[0].Root.Id));
        await WriteAsync(Role.Designer, full, "Jetzt geht es wieder");
    }

    // ------------------------------------------------------------------------------------------------ edit, resolve, delete

    [Fact]
    public async Task Only_the_author_edits_and_the_comment_says_it_was_edited()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync();
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer, SharePermission.View);
        var root = await WriteAsync(Role.Viewer, design, "Erster Entwurf");
        Assert.Null(root.Edited);
        // nobody else, not even the owner of the design
        await As(Role.Designer, async biz => await Assert.ThrowsAsync<ForbiddenException>(() => CommentLogic.EditAsync(biz, root.Id, "Mitgeschrieben", null)));
        var edited = await As(Role.Viewer, biz => CommentLogic.EditAsync(biz, root.Id, "  Zweiter‮ Entwurf  ", null));
        Assert.Equal("Zweiter Entwurf", edited.Text);
        Assert.NotNull(edited.Edited);
        await As(Role.Viewer, async biz =>
        {
            await Assert.ThrowsAsync<BizException>(() => CommentLogic.EditAsync(biz, root.Id, "   ", null));
            await Assert.ThrowsAsync<BizException>(() => CommentLogic.EditAsync(biz, root.Id, new string('x', 2001), null));
        });
        Assert.Equal("Zweiter Entwurf", (await ListAsync(Role.Designer, design)).Threads.Single().Root.Text);
        // a resolve is no edit
        var other = await WriteAsync(Role.Viewer, design, "Anderer");
        var resolved = await As(Role.Designer, biz => CommentLogic.ResolveAsync(biz, other.Id));
        Assert.Null(resolved.Edited);
        // a person who lost the view right cannot edit any more
        await Db(async db => await db.Share.Where(s => s.ItemId == design).ExecuteDeleteAsync());
        await As(Role.Viewer, async biz => await Assert.ThrowsAsync<NotFoundException>(() => CommentLogic.EditAsync(biz, root.Id, "Noch einmal", null)));
    }

    [Fact]
    public async Task A_thread_is_resolved_by_its_author_or_by_somebody_who_may_edit_and_only_the_top_level_counts()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync();
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer, SharePermission.View);
        var stranger = await UserAsync(Role.Stranger);
        await As(Role.Designer, biz => ShareLogic.AddAsync(biz, ItemKind.Design, design, false, stranger, SharePermission.Edit));
        var viewersThread = await WriteAsync(Role.Viewer, design, "Frage des Betrachters");
        var ownersThread = await WriteAsync(Role.Designer, design, "Notiz des Eigentümers");
        var reply = await WriteAsync(Role.Designer, design, "Antwort", parent: viewersThread.Id);

        Assert.Equal(2, (await ListAsync(Role.Viewer, design)).Open);
        // the author of the thread resolves it, though they may only view
        var done = await As(Role.Viewer, biz => CommentLogic.ResolveAsync(biz, viewersThread.Id));
        Assert.NotNull(done.Resolved);
        Assert.Equal("Viewer", done.ResolvedByName);
        Assert.Equal(1, (await ListAsync(Role.Viewer, design)).Open);
        // ... and again: nothing changes
        var again = await As(Role.Viewer, biz => CommentLogic.ResolveAsync(biz, viewersThread.Id));
        Assert.True((again.Resolved!.Value - done.Resolved!.Value).Duration() < TimeSpan.FromMilliseconds(5));
        // somebody who only views cannot resolve another person's thread
        await As(Role.Viewer, async biz => await Assert.ThrowsAsync<ForbiddenException>(() => CommentLogic.ResolveAsync(biz, ownersThread.Id)));
        await As(Role.Viewer, async biz => await Assert.ThrowsAsync<ForbiddenException>(() => CommentLogic.ReopenAsync(biz, ownersThread.Id)));
        // somebody who may edit can resolve and reopen any
        await As(Role.Stranger, biz => CommentLogic.ResolveAsync(biz, ownersThread.Id));
        Assert.Equal(0, (await ListAsync(Role.Viewer, design)).Open);
        var reopened = await As(Role.Stranger, biz => CommentLogic.ReopenAsync(biz, viewersThread.Id));
        Assert.Null(reopened.Resolved);
        Assert.Null(reopened.ResolvedByName);
        Assert.Equal(1, (await ListAsync(Role.Viewer, design)).Open);
        // a reply is not a thread
        await As(Role.Designer, async biz => await Assert.ThrowsAsync<BizException>(() => CommentLogic.ResolveAsync(biz, reply.Id)));
        await As(Role.Designer, async biz => await Assert.ThrowsAsync<BizException>(() => CommentLogic.ReopenAsync(biz, reply.Id)));
    }

    [Fact]
    public async Task The_author_or_whoever_manages_the_design_deletes_and_the_replies_go_with_the_thread()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync();
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer, SharePermission.View);
        var stranger = await UserAsync(Role.Stranger);
        await As(Role.Designer, biz => ShareLogic.AddAsync(biz, ItemKind.Design, design, false, stranger, SharePermission.Edit));
        var root = await WriteAsync(Role.Designer, design, "Faden");
        var byViewer = await WriteAsync(Role.Viewer, design, "Antwort 1", parent: root.Id);
        var byEditor = await WriteAsync(Role.Stranger, design, "Antwort 2", parent: root.Id);

        // not another person's comment: not for a viewer, not for an editor (Edit is no Manage)
        await As(Role.Viewer, async biz => await Assert.ThrowsAsync<ForbiddenException>(() => CommentLogic.DeleteAsync(biz, root.Id)));
        await As(Role.Viewer, async biz => await Assert.ThrowsAsync<ForbiddenException>(() => CommentLogic.DeleteAsync(biz, byEditor.Id)));
        await As(Role.Stranger, async biz => await Assert.ThrowsAsync<ForbiddenException>(() => CommentLogic.DeleteAsync(biz, byViewer.Id)));
        // the own one: yes
        await As(Role.Viewer, biz => CommentLogic.DeleteAsync(biz, byViewer.Id));
        var thread = (await ListAsync(Role.Designer, design)).Threads.Single();
        Assert.Equal(byEditor.Id, Assert.Single(thread.Replies).Id);
        // the manager deletes somebody else's reply
        await As(Role.Designer, biz => CommentLogic.DeleteAsync(biz, byEditor.Id));
        Assert.Empty((await ListAsync(Role.Designer, design)).Threads.Single().Replies);
        // deleting the top-level comment takes the replies along (soft deleted, so they do not come back)
        var again = await WriteAsync(Role.Viewer, design, "Neue Antwort", parent: root.Id);
        await As(Role.Designer, biz => CommentLogic.DeleteAsync(biz, root.Id));
        Assert.Empty((await ListAsync(Role.Designer, design)).Threads);
        var states = await Db(db => db.Comment.IgnoreQueryFilters().Where(c => c.DesignId == design).Select(c => c.UpdateState).ToListAsync());
        Assert.All(states, s => Assert.Equal(UpdateState.Deleted, s));
        Assert.Equal(4, states.Count);
        await As(Role.Viewer, async biz => await Assert.ThrowsAsync<NotFoundException>(() => CommentLogic.EditAsync(biz, again.Id, "Weg", null)));
    }

    // ------------------------------------------------------------------------------------------------ mentions

    [Fact]
    public async Task Only_people_who_can_see_the_design_are_offered_to_mention_and_the_address_only_to_those_who_manage_it()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync();
        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Viewer), (Role.Admin, SpaceRole.Viewer));
        var viewer = await UserAsync(Role.Viewer);
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer, SharePermission.View);
        var anna = await UserAsync("Anna Berger");
        await UserAsync("Annabel Cohen");
        var zoe = await UserAsync("Zoe Anders");
        await UserAsync("Anton Draussen");
        await As(Role.Designer, biz => ShareLogic.AddAsync(biz, ItemKind.Design, design, false, anna, SharePermission.Edit));
        await As(Role.Designer, biz => ShareLogic.AddAsync(biz, ItemKind.Design, design, true, team, SharePermission.View));
        await As(Role.Designer, biz => ShareLogic.AddAsync(biz, ItemKind.Design, design, false, zoe, SharePermission.View));
        // a person with a share that was removed is no candidate, a person of the team of the share is
        await As(Role.Designer, async biz =>
        {
            var share = await biz.Db.Share.SingleAsync(s => s.ItemId == design && s.UserId == zoe);
            await ShareLogic.RemoveAsync(biz, share.Id);
        });

        var asOwner = await As(Role.Designer, biz => CommentLogic.MentionCandidatesAsync(biz, design, ""));
        var names = asOwner.Select(c => c.Name).ToList();
        Assert.Contains("Anna Berger", names);
        Assert.Contains("Viewer", names);
        Assert.Contains("Admin", names);                       // a member of the team the design was shared with
        Assert.DoesNotContain("Designer", names);              // not the asking person
        Assert.DoesNotContain("Anton Draussen", names);
        Assert.DoesNotContain("Annabel Cohen", names);
        Assert.DoesNotContain("Zoe Anders", names);
        Assert.DoesNotContain("Stranger", names);
        // the owner manages the design and sees the address
        Assert.All(asOwner, c => Assert.False(string.IsNullOrEmpty(c.Email)));

        // search: the start of the name or of a word in it
        var an = await As(Role.Designer, biz => CommentLogic.MentionCandidatesAsync(biz, design, "ann"));
        Assert.Equal(["Anna Berger"], an.Select(c => c.Name));
        Assert.Equal("AB", an[0].Initials);
        var word = await As(Role.Designer, biz => CommentLogic.MentionCandidatesAsync(biz, design, "ber"));
        Assert.Equal(["Anna Berger"], word.Select(c => c.Name));
        Assert.Empty(await As(Role.Designer, biz => CommentLogic.MentionCandidatesAsync(biz, design, "nna")));
        Assert.Empty(await As(Role.Designer, biz => CommentLogic.MentionCandidatesAsync(biz, design, "%")));

        // somebody who may only view sees names, no addresses, and cannot look for an address
        var asViewer = await As(Role.Viewer, biz => CommentLogic.MentionCandidatesAsync(biz, design, ""));
        Assert.Contains("Designer", asViewer.Select(c => c.Name));
        Assert.DoesNotContain("Viewer", asViewer.Select(c => c.Name));
        Assert.All(asViewer, c => Assert.Null(c.Email));
        var byMail = await As(Role.Designer, biz => CommentLogic.MentionCandidatesAsync(biz, design, "anna berger-"));
        Assert.Single(byMail);
        Assert.Empty(await As(Role.Viewer, biz => CommentLogic.MentionCandidatesAsync(biz, design, "anna berger-")));
    }

    [Fact]
    public async Task At_most_eight_candidates_and_people_of_a_folder_share_or_a_sign_in_link_count()
    {
        if (!Enabled)
        {
            return;
        }

        var folder = await As(Role.Designer, async biz => (await FolderLogic.CreateAsync(biz, null, null, "Kommentarordner")).Id);
        var design = await As(Role.Designer, async biz => (await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign("Im Ordner", null, "a4-portrait", null, null, null, null, null, folder))).Id);
        var viaFolder = await UserAsync("Ordner Person");
        var viaLink = await UserAsync("Link Person");
        var revoked = await UserAsync("Zurück Person");
        await As(Role.Designer, biz => ShareLogic.AddAsync(biz, ItemKind.Folder, folder, false, viaFolder, SharePermission.View));
        await As(Role.Designer, biz => ShareLogic.SetLinkAsync(biz, ItemKind.Design, design, LinkAudience.SignedIn, SharePermission.View, false, null));
        var token = await Db(db => db.ShareLink.Where(l => l.ItemId == design && l.RevokedDate == null).Select(l => l.Token).SingleAsync());
        await As(Role.Stranger, biz => ShareLogic.OpenAsync(biz, token));
        await AsUser(viaLink, biz => ShareLogic.OpenAsync(biz, token));
        await AsUser(revoked, biz => ShareLogic.OpenAsync(biz, token));
        await Db(async db => await db.LinkGrant.Where(g => g.UserId == revoked).ExecuteDeleteAsync());

        var names = (await As(Role.Designer, biz => CommentLogic.MentionCandidatesAsync(biz, design, ""))).Select(c => c.Name).ToList();
        Assert.Contains("Ordner Person", names);
        Assert.Contains("Link Person", names);
        Assert.Contains("Stranger", names);
        Assert.DoesNotContain("Zurück Person", names);

        for (var i = 0; i < 10; i++)
        {
            var id = await UserAsync("Viele Person " + i);
            await As(Role.Designer, biz => ShareLogic.AddAsync(biz, ItemKind.Design, design, false, id, SharePermission.View));
        }

        Assert.Equal(CommentLogic.MaxCandidates, (await As(Role.Designer, biz => CommentLogic.MentionCandidatesAsync(biz, design, ""))).Count);
    }

    [Fact]
    public async Task A_mention_counts_only_for_somebody_who_can_see_the_design_and_whose_name_is_in_the_text()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync();
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer, SharePermission.View);
        var viewer = await UserAsync(Role.Viewer);
        var stranger = await UserAsync(Role.Stranger);
        var designer = await UserAsync(Role.Designer);

        // the stranger's id is sent but dropped; so is the id of the author; so is a name that is not in the text
        var row = await WriteAsync(Role.Designer, design, "@Viewer und @Stranger und @Designer, schaut mal.", mentions: [viewer, stranger, designer, 987_654_321]);
        Assert.Equal([viewer], row.Mentions.Select(m => m.Id));
        Assert.Equal("Viewer", row.Mentions[0].Name);
        var silent = await WriteAsync(Role.Designer, design, "Hallo zusammen", mentions: [viewer]);
        Assert.Empty(silent.Mentions);
        var shouting = await WriteAsync(Role.Designer, design, "@VIEWER in Großbuchstaben", mentions: [viewer, viewer, viewer]);
        Assert.Single(shouting.Mentions);

        Assert.Single(await NotificationsAsync(Role.Viewer, NotificationKinds.Mention).ContinueWith(t => t.Result.Where(n => n.DataJson.Contains("schaut mal")).ToList()));
        Assert.Empty(await NotificationsAsync(Role.Stranger));
        Assert.Empty(await NotificationsAsync(Role.Designer));

        // the list gives the names to highlight
        var listed = (await ListAsync(Role.Viewer, design)).Threads.Single(t => t.Root.Id == row.Id).Root;
        Assert.Equal([viewer], listed.Mentions.Select(m => m.Id));
    }

    [Fact]
    public async Task Editing_notifies_only_the_people_who_are_mentioned_for_the_first_time()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync();
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer, SharePermission.View);
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Stranger, SharePermission.View);
        var viewer = await UserAsync(Role.Viewer);
        var stranger = await UserAsync(Role.Stranger);
        var root = await WriteAsync(Role.Designer, design, "Erst @Viewer", mentions: [viewer]);
        await As(Role.Designer, biz => CommentLogic.EditAsync(biz, root.Id, "Erst @Viewer und dann @Stranger", [viewer, stranger]));
        Assert.Single(await NotificationsAsync(Role.Viewer, NotificationKinds.Mention));
        Assert.Single(await NotificationsAsync(Role.Stranger, NotificationKinds.Mention));
        // taking the name out takes the mention out
        var edited = await As(Role.Designer, biz => CommentLogic.EditAsync(biz, root.Id, "Nur noch Text", [viewer, stranger]));
        Assert.Empty(edited.Mentions);
        Assert.Single(await NotificationsAsync(Role.Viewer, NotificationKinds.Mention));
    }

    // ------------------------------------------------------------------------------------------------ notifications

    [Fact]
    public async Task A_mention_notifies_with_the_excerpt_and_the_address_of_the_thread()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(name: "Sommerfest");
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer, SharePermission.View);
        var viewer = await UserAsync(Role.Viewer);
        var long_ = "@Viewer " + new string('a', 300);
        var row = await WriteAsync(Role.Designer, design, long_, mentions: [viewer]);
        var note = Assert.Single(await NotificationsAsync(Role.Viewer, NotificationKinds.Mention));
        Assert.Equal($"/Designs/{design}/Designer?comment={row.Id}", note.Url);
        var page = await As(Role.Viewer, biz => NotificationLogic.ListAsync(biz));
        var shown = Assert.Single(page.Items, i => i.Kind == NotificationKinds.Mention);
        Assert.Equal("Designer hat dich in „Sommerfest“ erwähnt.", shown.Text);
        Assert.NotNull(shown.Message);
        Assert.True(shown.Message!.Length <= CommentLogic.ExcerptLength);
        Assert.EndsWith("…", shown.Message);
        Assert.Equal("dt:message-circle", shown.Icon);
        // the author is not told about their own comment
        Assert.Empty(await NotificationsAsync(Role.Designer));
    }

    [Fact]
    public async Task A_reply_notifies_the_author_of_the_thread_and_the_people_who_answered_never_the_writer_and_nobody_twice()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync();
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer, SharePermission.View);
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Stranger, SharePermission.View);
        var viewer = await UserAsync(Role.Viewer);
        var root = await WriteAsync(Role.Designer, design, "Wie findet ihr das?");
        Assert.Empty(await NotificationsAsync(Role.Viewer));

        // a viewer answers: the author of the thread is told
        var first = await WriteAsync(Role.Viewer, design, "Gut!", parent: root.Id);
        var toAuthor = Assert.Single(await NotificationsAsync(Role.Designer, NotificationKinds.CommentReply));
        Assert.Equal($"/Designs/{design}/Designer?comment={root.Id}", toAuthor.Url);
        Assert.Empty(await NotificationsAsync(Role.Viewer));
        Assert.Empty(await NotificationsAsync(Role.Stranger));

        // a third person answers: the author and the first answerer are told, once each
        await WriteAsync(Role.Stranger, design, "Mir auch.", parent: root.Id);
        Assert.Equal(2, (await NotificationsAsync(Role.Designer, NotificationKinds.CommentReply)).Count);
        Assert.Single(await NotificationsAsync(Role.Viewer, NotificationKinds.CommentReply));
        Assert.Empty(await NotificationsAsync(Role.Stranger));

        // the author answers and mentions the viewer: the viewer gets the mention and NOT a second notice for the same comment, the stranger the reply
        await WriteAsync(Role.Designer, design, "Danke @Viewer!", parent: root.Id, mentions: [viewer]);
        var viewers = await NotificationsAsync(Role.Viewer);
        Assert.Equal(2, viewers.Count);
        Assert.Single(viewers, n => n.Kind == NotificationKinds.Mention);
        Assert.Single(viewers, n => n.Kind == NotificationKinds.CommentReply);
        Assert.Single(await NotificationsAsync(Role.Stranger, NotificationKinds.CommentReply));
        Assert.Equal(2, (await NotificationsAsync(Role.Designer, NotificationKinds.CommentReply)).Count);
    }

    [Fact]
    public async Task Nobody_without_access_is_notified_and_a_person_who_lost_access_gets_no_reply_notice()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync();
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer, SharePermission.View);
        var viewer = await UserAsync(Role.Viewer);
        var stranger = await UserAsync(Role.Stranger);
        var root = await WriteAsync(Role.Viewer, design, "Meine Frage");
        // the viewer leaves (the share is removed); the owner answers and tries to mention the stranger, who never had access
        await Db(async db => await db.Share.Where(s => s.ItemId == design).ExecuteDeleteAsync());
        await WriteAsync(Role.Designer, design, "@Stranger @Viewer", parent: root.Id, mentions: [stranger, viewer]);
        Assert.Empty(await NotificationsAsync(Role.Stranger));
        Assert.Empty(await NotificationsAsync(Role.Viewer));
        // a person who cannot sign in any more is not written to either
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer, SharePermission.View);
        await Db(async db => await db.User.Where(u => u.Id == viewer).ExecuteUpdateAsync(s => s.SetProperty(u => u.IsActive, false)));
        await WriteAsync(Role.Designer, design, "Noch eine Antwort", parent: root.Id);
        Assert.Empty(await NotificationsAsync(Role.Viewer));
    }

    [Fact]
    public async Task A_mention_and_a_reply_are_mailed_like_the_other_notifications_when_the_person_wants_it()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(name: "Per Mail");
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer, SharePermission.View);
        var viewer = await UserAsync(Role.Viewer);
        var queue = Factory.Services.GetRequiredService<MailQueue>();
        var composer = Factory.Services.GetRequiredService<MailComposer>();
        var seen = new List<MailJob>();
        void Handler(MailJob job) { lock (seen) { seen.Add(job); } }
        queue.Queued += Handler;
        CommentRow root;
        try
        {
            root = await WriteAsync(Role.Viewer, design, "Meine Frage");
            await WriteAsync(Role.Designer, design, "@Viewer das ist die Antwort", parent: root.Id, mentions: [viewer]);
            await WriteAsync(Role.Designer, design, "Und noch eine", parent: root.Id);
        }
        finally
        {
            queue.Queued -= Handler;
        }

        // the viewer got the mention (the reply of the same comment is not announced twice) and then the plain reply: two jobs, both for them
        var jobs = seen.OfType<MailJob.Notification>().ToList();
        Assert.Equal(2, jobs.Count);
        await using (await MailAsync(UsableMail()))
        {
            var first = await composer.ComposeAsync(jobs[0]);
            Assert.NotNull(first);
            Assert.Contains("Du wurdest erwähnt", first!.Subject);
            Assert.Contains("das ist die Antwort", first.Text);
            Assert.Contains($"/Designs/{design}/Designer?comment={root.Id}", first.Html);
            var second = await composer.ComposeAsync(jobs[1]);
            Assert.NotNull(second);
            Assert.Contains("Antwort auf deinen Kommentar", second!.Subject);

            // the profile: no mail for mentions and replies
            await As(Role.Viewer, biz => NotificationLogic.SaveMailSettingsAsync(biz, new NotifyMailSettings { Mentions = false }));
            Assert.Null(await composer.ComposeAsync(jobs[0]));
            Assert.Null(await composer.ComposeAsync(jobs[1]));
        }
    }

    // ------------------------------------------------------------------------------------------------ the methods on a comment, as a table

    private sealed record CommentMethod(string Name, Func<Biz, long, Task> Call, bool NeedsAuthor, bool NeedsEdit, bool NeedsManage);

    private static readonly CommentMethod[] CommentMethods =
    [
        new("CommentLogic.EditAsync", (biz, id) => CommentLogic.EditAsync(biz, id, "geändert", null), NeedsAuthor: true, NeedsEdit: false, NeedsManage: false),
        new("CommentLogic.ResolveAsync", (biz, id) => CommentLogic.ResolveAsync(biz, id), NeedsAuthor: false, NeedsEdit: true, NeedsManage: false),
        new("CommentLogic.ReopenAsync", (biz, id) => CommentLogic.ReopenAsync(biz, id), NeedsAuthor: false, NeedsEdit: true, NeedsManage: false),
        new("CommentLogic.DeleteAsync", (biz, id) => CommentLogic.DeleteAsync(biz, id), NeedsAuthor: false, NeedsEdit: false, NeedsManage: true),
    ];

    public static TheoryData<string> CommentMethodNames
    {
        get
        {
            var data = new TheoryData<string>();
            foreach (var method in CommentMethods)
            {
                data.Add(method.Name);
            }

            return data;
        }
    }

    private async Task<Exception?> TryAsync(Role who, Func<Biz, Task> call)
    {
        try
        {
            await As(who, call);
            return null;
        }
        catch (Exception ex) when (ex is NotFoundException or ForbiddenException)
        {
            return ex;
        }
    }

    [Theory]
    [MemberData(nameof(CommentMethodNames))]
    public async Task A_method_on_a_comment_asks_for_the_author_or_the_level_and_a_stranger_gets_404(string name)
    {
        if (!Enabled)
        {
            return;
        }

        var method = CommentMethods.Single(m => m.Name == name);
        var design = await DesignAsync();
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer, SharePermission.View);
        var editor = await UserAsync("Editor");
        await As(Role.Designer, biz => ShareLogic.AddAsync(biz, ItemKind.Design, design, false, editor, SharePermission.Edit));
        // every comment is written by the owner of the design (author and manager at once): the others are somebody else
        async Task<long> FreshAsync() => (await WriteAsync(Role.Designer, design, "Kommentar " + Guid.NewGuid().ToString("N")[..6])).Id;

        var forStranger = await FreshAsync();
        Assert.IsType<NotFoundException>(await TryAsync(Role.Stranger, biz => method.Call(biz, forStranger)));
        Assert.IsType<NotFoundException>(await TryAsync(Role.Stranger, biz => method.Call(biz, 987_654_321)));
        var forAdmin = await FreshAsync();
        Assert.IsType<NotFoundException>(await TryAsync(Role.Admin, biz => method.Call(biz, forAdmin)));

        // somebody who may only view: never (not the author, and may neither edit nor manage)
        var forViewer = await FreshAsync();
        Assert.IsType<ForbiddenException>(await TryAsync(Role.Viewer, biz => method.Call(biz, forViewer)));

        // somebody who may edit: resolve and reopen yes; the text of somebody else and delete no
        var forEditor = await FreshAsync();
        var editorRefused = await AsUserTryAsync(editor, biz => method.Call(biz, forEditor));
        if (method.NeedsEdit)
        {
            Assert.Null(editorRefused);
        }
        else
        {
            Assert.IsType<ForbiddenException>(editorRefused);
        }

        // the owner is the author and manages the design: let in
        var forOwner = await FreshAsync();
        Assert.Null(await TryAsync(Role.Designer, biz => method.Call(biz, forOwner)));
        Assert.True(method.NeedsAuthor || method.NeedsEdit || method.NeedsManage);
    }

    private async Task<Exception?> AsUserTryAsync(long userId, Func<Biz, Task> call)
    {
        try
        {
            await AsUser(userId, call);
            return null;
        }
        catch (Exception ex) when (ex is NotFoundException or ForbiddenException)
        {
            return ex;
        }
    }

    // ------------------------------------------------------------------------------------------------ over HTTP

    [Fact]
    public async Task The_endpoints_answer_as_the_logic_does_and_every_post_needs_the_token()
    {
        if (!Enabled)
        {
            return;
        }

        await using var admins = await RealAdminsAsync();
        var design = await DesignAsync(name: "Per HTTP");
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer, SharePermission.View);
        var viewerId = await UserAsync(Role.Viewer);
        var owner = await SignInAsync(await UserAsync(Role.Designer));
        var viewer = await SignInAsync(viewerId);
        var stranger = await SignInAsync(await UserAsync(Role.Stranger));

        // a stranger: 404 on read and write; the owner sees an empty list
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/api/designs/{design}/comments")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/api/designs/{design}/comments/mentions?q=a")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await ApiPostAsync(stranger, $"/api/designs/{design}/comments", new { text = "Hallo" })).StatusCode);
        var empty = await owner.GetFromJsonAsync<JsonElement>($"/api/designs/{design}/comments");
        Assert.Equal(0, empty.GetProperty("threads").GetArrayLength());
        Assert.True(empty.GetProperty("canComment").GetBoolean());

        // the token is needed
        var noToken = await owner.PostAsJsonAsync($"/api/designs/{design}/comments", new { text = "Ohne Token" });
        Assert.Equal(HttpStatusCode.BadRequest, noToken.StatusCode);

        // a viewer comments on a page with a pin and mentions the owner is not possible (the author), but a blank one is a message
        var blank = await ApiPostAsync(viewer, $"/api/designs/{design}/comments", new { text = "  " });
        Assert.Equal(HttpStatusCode.BadRequest, blank.StatusCode);
        Assert.Contains("error", await blank.Content.ReadAsStringAsync());
        var posted = await ApiPostAsync(viewer, $"/api/designs/{design}/comments", new { text = "Hallo <b>Welt</b>", pageId = "p1", x = 10.5, y = 20 });
        Assert.Equal(HttpStatusCode.OK, posted.StatusCode);
        var row = await posted.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Hallo <b>Welt</b>", row.GetProperty("text").GetString());
        Assert.Equal("p1", row.GetProperty("pageId").GetString());
        Assert.Equal(10.5, row.GetProperty("x").GetDouble());
        Assert.True(row.GetProperty("mine").GetBoolean());
        Assert.True(row.GetProperty("canResolve").GetBoolean());
        Assert.Equal("gerade eben", row.GetProperty("ago").GetString());
        var id = row.GetProperty("id").GetInt64();

        // the reply of the owner nests under it; the list shows threads with replies
        var reply = await ApiPostAsync(owner, $"/api/designs/{design}/comments", new { text = "Danke", parentId = id });
        Assert.Equal(HttpStatusCode.OK, reply.StatusCode);
        var list = await owner.GetFromJsonAsync<JsonElement>($"/api/designs/{design}/comments");
        Assert.Equal(1, list.GetProperty("open").GetInt32());
        var thread = list.GetProperty("threads")[0];
        Assert.Equal(id, thread.GetProperty("id").GetInt64());
        Assert.Equal(1, thread.GetProperty("replies").GetArrayLength());

        // others' comments: edit is refused (403), resolve by the author of the thread works, delete by the viewer of the owner's reply is 403
        var replyId = thread.GetProperty("replies")[0].GetProperty("id").GetInt64();
        Assert.Equal(HttpStatusCode.Forbidden, (await ApiPostAsync(owner, $"/api/comments/{id}/edit", new { text = "mitgeschrieben" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await ApiPostAsync(viewer, $"/api/comments/{id}/edit", new { text = "Hallo Welt, bearbeitet" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await ApiPostAsync(viewer, $"/api/comments/{replyId}/delete", new { })).StatusCode);
        var resolved = await ApiPostAsync(viewer, $"/api/comments/{id}/resolve", new { });
        Assert.Equal(HttpStatusCode.OK, resolved.StatusCode);
        Assert.NotEqual(JsonValueKind.Null, (await resolved.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("resolved").ValueKind);
        Assert.Equal(0, (await owner.GetFromJsonAsync<JsonElement>($"/api/designs/{design}/comments")).GetProperty("open").GetInt32());
        Assert.Equal(HttpStatusCode.OK, (await ApiPostAsync(owner, $"/api/comments/{id}/reopen", new { })).StatusCode);

        // the candidates
        var candidates = await owner.GetFromJsonAsync<JsonElement>($"/api/designs/{design}/comments/mentions?q=vie");
        Assert.Equal("Viewer", candidates[0].GetProperty("name").GetString());
        Assert.Equal(JsonValueKind.String, candidates[0].GetProperty("email").ValueKind);
        var asViewer = await viewer.GetFromJsonAsync<JsonElement>($"/api/designs/{design}/comments/mentions?q=des");
        Assert.Equal("Designer", asViewer[0].GetProperty("name").GetString());
        Assert.Equal(JsonValueKind.Null, asViewer[0].GetProperty("email").ValueKind);

        // the owner deletes the thread of somebody else
        Assert.Equal(HttpStatusCode.OK, (await ApiPostAsync(owner, $"/api/comments/{id}/delete", new { })).StatusCode);
        Assert.Equal(0, (await owner.GetFromJsonAsync<JsonElement>($"/api/designs/{design}/comments")).GetProperty("total").GetInt32());
        Assert.Equal(HttpStatusCode.NotFound, (await ApiPostAsync(owner, $"/api/comments/{id}/resolve", new { })).StatusCode);
    }
}
