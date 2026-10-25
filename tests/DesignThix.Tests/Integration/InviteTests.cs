using System.Net;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.Services;
using DesignThix.Services.Mail;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DesignThix.Tests.Integration;

/// <summary>Invitations (docs/PLAN-PLATFORM.md section 1.14): who may invite, expiry, maximum uses, revoking, the address that must match, joining the team, the mails, and the page of the link.</summary>
[Collection("app")]
public sealed class InviteTests(AppTests.AppFactory factory) : PlatformTestBase(factory)
{
    private static string Mailbox(string prefix = "gast") => $"{prefix}-{Guid.NewGuid():N}@test.local";

    private async Task<Invitation> LinkAsync(Role by, long team, SpaceRole role = SpaceRole.Editor, int days = 7, int maxUses = 5)
        => (await As(by, biz => InviteLogic.CreateAsync(biz, team, role, null, true, days, maxUses))).Created.Single();

    private async Task<Invitation> MailInviteAsync(Role by, long team, string address, SpaceRole role = SpaceRole.Editor)
        => (await As(by, biz => InviteLogic.CreateAsync(biz, team, role, address, false, 7, 1))).Created.Single();

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
    public async Task Owner_and_admin_of_a_team_invite_the_others_do_not()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Admin), (Role.Stranger, SpaceRole.Editor));
        await MailInviteAsync(Role.Designer, team, Mailbox());
        await MailInviteAsync(Role.Viewer, team, Mailbox());
        await As(Role.Stranger, biz => Assert.ThrowsAsync<ForbiddenException>(() => InviteLogic.CreateAsync(biz, team, SpaceRole.Viewer, Mailbox(), false, 7, 1)));
        await As(Role.Stranger, biz => Assert.ThrowsAsync<ForbiddenException>(() => InviteLogic.ListAsync(biz, team)));
        await As(Role.Admin, biz => Assert.ThrowsAsync<NotFoundException>(() => InviteLogic.CreateAsync(biz, team, SpaceRole.Viewer, Mailbox(), false, 7, 1)));
        // only an Owner invites to Owner
        await As(Role.Viewer, biz => Assert.ThrowsAsync<ForbiddenException>(() => InviteLogic.CreateAsync(biz, team, SpaceRole.Owner, null, true, 7, 1)));
        await As(Role.Designer, biz => InviteLogic.CreateAsync(biz, team, SpaceRole.Owner, null, true, 7, 1));
        Assert.Equal(3, (await As(Role.Viewer, biz => InviteLogic.ListAsync(biz, team))).Count);
        // an invitation to a personal area makes no sense
        var personal = await As(Role.Designer, biz => biz.PersonalSpaceIdAsync());
        await As(Role.Designer, biz => Assert.ThrowsAsync<BizException>(() => InviteLogic.CreateAsync(biz, personal, SpaceRole.Viewer, null, true, 7, 1)));
    }

    [Fact]
    public async Task Addresses_are_read_from_a_text_checked_and_limited()
    {
        if (!Enabled)
        {
            return;
        }

        var (valid, invalid) = InviteLogic.ParseAddresses("Anna@Test.local, ben@test.local;\nanna@test.local  nicht-gut\r\ncarl@test.local");
        Assert.Equal(["anna@test.local", "ben@test.local", "carl@test.local"], valid);
        Assert.Equal(["nicht-gut"], invalid);

        var team = await TeamAsync(Role.Designer);
        await As(Role.Designer, async biz =>
        {
            var bad = await Assert.ThrowsAsync<BizException>(() => InviteLogic.CreateAsync(biz, team, SpaceRole.Editor, "gut@test.local, kaputt", false, 7, 1));
            Assert.Contains("kaputt", bad.Message);
            await Assert.ThrowsAsync<BizException>(() => InviteLogic.CreateAsync(biz, team, SpaceRole.Editor, "  ", false, 7, 1));
            var many = string.Join(",", Enumerable.Range(0, 21).Select(i => $"x{i}@test.local"));
            await Assert.ThrowsAsync<BizException>(() => InviteLogic.CreateAsync(biz, team, SpaceRole.Editor, many, false, 7, 1));
        });
        // somebody who is in the team already is left out and named
        var viewer = await UserAsync(Role.Viewer);
        await As(Role.Designer, biz => SpaceLogic.AddMemberAsync(biz, team, viewer, SpaceRole.Viewer));
        var viewerMail = await Db(db => db.User.Where(u => u.Id == viewer).Select(u => u.Email).SingleAsync());
        var result = await As(Role.Designer, biz => InviteLogic.CreateAsync(biz, team, SpaceRole.Editor, viewerMail + "," + Mailbox(), false, 7, 1));
        Assert.Single(result.Created);
        Assert.Contains("schon im Team", Assert.Single(result.Skipped));
    }

    [Fact]
    public async Task A_link_works_until_it_expires_is_used_up_or_is_taken_back()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await TeamAsync(Role.Designer);
        var link = await LinkAsync(Role.Designer, team, SpaceRole.Viewer, days: 1, maxUses: 2);
        Assert.Null(link.Email);
        Assert.Equal(SpaceRole.Viewer, link.Role);
        Assert.InRange((link.ExpiresDate - DateTime.UtcNow).TotalHours, 22, 25);

        var first = await UserAsync("erste");
        var second = await UserAsync("zweite");
        var third = await UserAsync("dritte");
        var accepted = await AsUser(first, biz => InviteLogic.AcceptAsync(biz, link.Token));
        Assert.False(accepted.AlreadyMember);
        Assert.Equal(team, accepted.SpaceId);
        Assert.Equal(SpaceRole.Viewer, await Db(db => db.SpaceMember.Where(m => m.SpaceId == team && m.UserId == first).Select(m => m.Role).SingleAsync()));

        // a person who is a member already stays as they are and does not use the link up
        var again = await AsUser(first, biz => InviteLogic.AcceptAsync(biz, link.Token));
        Assert.True(again.AlreadyMember);
        Assert.Equal(1, await Db(db => db.Invitation.Where(i => i.Id == link.Id).Select(i => i.Uses).SingleAsync()));

        await AsUser(second, biz => InviteLogic.AcceptAsync(biz, link.Token));
        var usedUp = await AsUser(third, biz => Assert.ThrowsAsync<BizException>(() => InviteLogic.AcceptAsync(biz, link.Token)));
        Assert.Contains("schon benutzt", usedUp.Message);
        Assert.False(await Db(db => db.SpaceMember.AnyAsync(m => m.SpaceId == team && m.UserId == third)));

        // expired
        var old = await LinkAsync(Role.Designer, team);
        await Db(db => db.Invitation.Where(i => i.Id == old.Id).ExecuteUpdateAsync(s => s.SetProperty(i => i.ExpiresDate, DateTime.UtcNow.AddMinutes(-1))));
        var expired = await AsUser(third, biz => Assert.ThrowsAsync<BizException>(() => InviteLogic.AcceptAsync(biz, old.Token)));
        Assert.Contains("abgelaufen", expired.Message);
        Assert.Equal(InviteStatus.Expired, (await AsAnonymous(biz => InviteLogic.PreviewAsync(biz, old.Token))).Status);

        // taken back
        var revoked = await LinkAsync(Role.Designer, team);
        await As(Role.Designer, biz => InviteLogic.RevokeAsync(biz, revoked.Id));
        var gone = await AsUser(third, biz => Assert.ThrowsAsync<BizException>(() => InviteLogic.AcceptAsync(biz, revoked.Token)));
        Assert.Contains("nicht mehr gültig", gone.Message);
        Assert.Equal(InviteStatus.Revoked, (await AsAnonymous(biz => InviteLogic.PreviewAsync(biz, revoked.Token))).Status);

        // an unknown token is "not found" and says the same words as a revoked one
        Assert.Equal(InviteStatus.NotFound, (await AsAnonymous(biz => InviteLogic.PreviewAsync(biz, Guid.NewGuid()))).Status);
        await AsUser(third, biz => Assert.ThrowsAsync<BizException>(() => InviteLogic.AcceptAsync(biz, Guid.NewGuid())));
    }

    [Fact]
    public async Task An_invitation_that_names_an_address_only_works_for_that_address()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await TeamAsync(Role.Designer);
        var wanted = await UserAsync("eingeladen");
        var email = await Db(db => db.User.Where(u => u.Id == wanted).Select(u => u.Email).SingleAsync());
        var invitation = await MailInviteAsync(Role.Designer, team, email.ToUpperInvariant());
        Assert.Equal(email, invitation.Email);

        var other = await UserAsync("jemand-anders");
        var wrong = await AsUser(other, biz => Assert.ThrowsAsync<BizException>(() => InviteLogic.AcceptAsync(biz, invitation.Token)));
        Assert.Contains(email, wrong.Message);
        Assert.False(await Db(db => db.SpaceMember.AnyAsync(m => m.SpaceId == team && m.UserId == other)));
        Assert.Equal(0, await Db(db => db.Invitation.Where(i => i.Id == invitation.Id).Select(i => i.Uses).SingleAsync()));

        await AsUser(wanted, biz => InviteLogic.AcceptAsync(biz, invitation.Token));
        Assert.True(await Db(db => db.SpaceMember.AnyAsync(m => m.SpaceId == team && m.UserId == wanted)));
        // used up: the one use is gone
        await AsUser(wanted, async biz => Assert.True((await InviteLogic.AcceptAsync(biz, invitation.Token)).AlreadyMember));
    }

    [Fact]
    public async Task A_newer_invitation_to_an_address_replaces_the_older_one_and_resend_renews_an_expired_one()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await TeamAsync(Role.Designer);
        var address = Mailbox();
        var first = await MailInviteAsync(Role.Designer, team, address);
        var second = await MailInviteAsync(Role.Designer, team, address);
        Assert.NotNull(await Db(db => db.Invitation.Where(i => i.Id == first.Id).Select(i => i.RevokedDate).SingleAsync()));
        var open = await As(Role.Designer, biz => InviteLogic.ListAsync(biz, team));
        Assert.Equal(second.Id, Assert.Single(open, o => o.Email == address).Id);

        await Db(db => db.Invitation.Where(i => i.Id == second.Id).ExecuteUpdateAsync(s => s.SetProperty(i => i.ExpiresDate, DateTime.UtcNow.AddDays(-2))));
        var jobs = await WithQueue(async seen =>
        {
            await As(Role.Designer, biz => InviteLogic.ResendAsync(biz, second.Id));
            return seen.ToList();
        });
        Assert.Equal(new MailJob.Invitation(second.Id), Assert.Single(jobs));
        Assert.True(await Db(db => db.Invitation.Where(i => i.Id == second.Id).Select(i => i.ExpiresDate).SingleAsync()) > DateTime.UtcNow.AddDays(6));

        // a link has nothing to send; a used up or revoked invitation is not sent again
        var link = await LinkAsync(Role.Designer, team);
        await As(Role.Designer, biz => Assert.ThrowsAsync<BizException>(() => InviteLogic.ResendAsync(biz, link.Id)));
        await As(Role.Designer, biz => InviteLogic.RevokeAsync(biz, second.Id));
        await As(Role.Designer, biz => Assert.ThrowsAsync<BizException>(() => InviteLogic.ResendAsync(biz, second.Id)));
        // somebody who may not manage the team's invitations cannot revoke
        var stranger = await UserAsync(Role.Stranger);
        await AsUser(stranger, biz => Assert.ThrowsAsync<NotFoundException>(() => InviteLogic.RevokeAsync(biz, link.Id)));
    }

    [Fact]
    public async Task Members_invite_to_the_platform_only_while_the_administrator_allows_it()
    {
        if (!Enabled)
        {
            return;
        }

        await using (await PlatformAsync(new PlatformSettings { MembersMayInvite = false }))
        {
            await As(Role.Designer, biz => Assert.ThrowsAsync<ForbiddenException>(() => InviteLogic.CreateAsync(biz, null, SpaceRole.Editor, Mailbox(), false, 7, 1)));
            var byAdmin = await As(Role.Admin, biz => InviteLogic.CreateAsync(biz, null, SpaceRole.Editor, null, true, 30, 3));
            Assert.Null(byAdmin.Created.Single().SpaceId);
        }

        await using (await PlatformAsync(new PlatformSettings { MembersMayInvite = true }))
        {
            var mine = (await As(Role.Designer, biz => InviteLogic.CreateAsync(biz, null, SpaceRole.Editor, Mailbox(), false, 7, 1))).Created.Single();
            // a member sees and revokes their own, not the ones of others; the administrator sees all
            Assert.Contains(await As(Role.Designer, biz => InviteLogic.ListPlatformAsync(biz)), i => i.Id == mine.Id);
            Assert.DoesNotContain(await As(Role.Viewer, biz => InviteLogic.ListPlatformAsync(biz)), i => i.Id == mine.Id);
            Assert.Contains(await As(Role.Admin, biz => InviteLogic.ListPlatformAsync(biz)), i => i.Id == mine.Id);
            await As(Role.Viewer, biz => Assert.ThrowsAsync<NotFoundException>(() => InviteLogic.RevokeAsync(biz, mine.Id)));
            await As(Role.Admin, biz => InviteLogic.RevokeAsync(biz, mine.Id));
        }
    }

    [Fact]
    public async Task The_invitation_by_address_is_queued_with_its_id_and_becomes_a_mail_only_with_mail_settings()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await TeamAsync(Role.Designer);
        var composer = Factory.Services.GetRequiredService<MailComposer>();
        var address = Mailbox("mail");
        var (invitation, jobs) = await WithQueue(async seen =>
        {
            var made = await MailInviteAsync(Role.Designer, team, address);
            await As(Role.Designer, biz => InviteLogic.CreateAsync(biz, team, SpaceRole.Viewer, null, true, 7, 3));
            return (made, seen.ToList());
        });
        // the job carries an id and nothing else; a link is no mail
        Assert.Equal(new MailJob.Invitation(invitation.Id), Assert.Single(jobs));

        // without usable mail settings the job is dropped quietly
        Assert.Null(await composer.ComposeAsync(jobs[0]));
        await using (await MailAsync(UsableMail()))
        {
            var mail = await composer.ComposeAsync(jobs[0]);
            Assert.NotNull(mail);
            Assert.Equal(address, mail!.To);
            Assert.Contains("Designer", mail.Subject);
            Assert.Contains($"/Einladung/{invitation.Token:D}", mail.Text);
            Assert.Contains($"/Einladung/{invitation.Token:D}", mail.Html);
            // a revoked invitation is no mail any more
            await As(Role.Designer, biz => InviteLogic.RevokeAsync(biz, invitation.Id));
            Assert.Null(await composer.ComposeAsync(jobs[0]));
        }

        await using (await MailAsync(new MailSettings { Enabled = false, Host = "x", FromAddress = "a@b.c" }))
        {
            Assert.Null(await composer.ComposeAsync(jobs[0]));
        }
    }

    [Fact]
    public async Task A_name_with_line_breaks_cannot_start_a_header_and_markup_in_a_name_is_encoded()
    {
        if (!Enabled)
        {
            return;
        }

        var evil = "Mallory\r\nBcc: opfer@test.local\r\nSubject: weg <script>alert(1)</script>";
        var team = await TeamAsync(Role.Designer);
        var owner = await UserAsync(Role.Designer);
        await Db(db => db.User.Where(u => u.Id == owner).ExecuteUpdateAsync(s => s.SetProperty(u => u.DisplayName, evil)));
        await Db(db => db.Space.Where(s => s.Id == team).ExecuteUpdateAsync(s => s.SetProperty(x => x.Name, "Team <b>fett</b> & \"mehr\"")));
        var invitation = await MailInviteAsync(Role.Designer, team, Mailbox("inj"));
        var composer = Factory.Services.GetRequiredService<MailComposer>();
        await using (await MailAsync(UsableMail()))
        {
            var mail = await composer.ComposeAsync(new MailJob.Invitation(invitation.Id));
            Assert.NotNull(mail);
            Assert.DoesNotContain('\r', mail!.Subject);
            Assert.DoesNotContain('\n', mail.Subject);
            Assert.DoesNotContain("<script>", mail.Html);
            Assert.DoesNotContain("<b>fett</b>", mail.Html);
            Assert.Contains("&lt;script&gt;", mail.Html);
            Assert.Contains("&lt;b&gt;fett&lt;/b&gt;", mail.Html);
        }

        // the pure functions: headers are one line, a link must be http(s)
        Assert.Equal("a b c", MailContent.Header("a\r\nb\u0000 c"));
        Assert.Equal(150, MailContent.Header(new string('x', 400)).Length);
        var built = MailContent.Build("x@test.local", "Hallo\nWelt", ["<i>Text</i>"], "javascript:alert(1)", "Klick");
        Assert.Equal("Hallo Welt", built.Subject);
        Assert.DoesNotContain("javascript:", built.Html);
        Assert.Contains("&lt;i&gt;Text&lt;/i&gt;", built.Html);
    }

    [Fact]
    public async Task The_page_of_the_link_offers_sign_in_or_registration_and_joins_only_by_a_button()
    {
        if (!Enabled)
        {
            return;
        }

        await using var admins = await RealAdminsAsync();
        ResetLimiter();
        var team = await TeamAsync(Role.Designer);
        var teamName = await Db(db => db.Space.Where(s => s.Id == team).Select(s => s.Name).SingleAsync());
        var link = await LinkAsync(Role.Designer, team);
        var anonymous = Factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        var page = await anonymous.GetAsync($"/Einladung/{link.Token:D}");
        Assert.Equal(HttpStatusCode.OK, page.StatusCode);
        var html = await page.Content.ReadAsStringAsync();
        Assert.Contains(System.Net.WebUtility.HtmlEncode(teamName), html);
        Assert.Contains($"/Account/Register?invitation={link.Token:D}", html);
        Assert.Contains($"/Account/Login?returnUrl=/Einladung/{link.Token:D}", html);
        Assert.DoesNotContain("data-accept-invitation", html);

        // a dead link: friendly page, status 404, no leak of the team
        await As(Role.Designer, biz => InviteLogic.RevokeAsync(biz, link.Id));
        var dead = await anonymous.GetAsync($"/Einladung/{link.Token:D}");
        Assert.Equal(HttpStatusCode.NotFound, dead.StatusCode);
        var deadHtml = await dead.Content.ReadAsStringAsync();
        Assert.Contains("Diese Einladung gilt nicht mehr", deadHtml);
        Assert.DoesNotContain(System.Net.WebUtility.HtmlEncode(teamName), deadHtml);

        // signed in: the button joins (a GET never does)
        var fresh = await LinkAsync(Role.Designer, team, SpaceRole.Editor);
        var person = await UserAsync("beitretender");
        var browser = await SignInAsync(person);
        var signedIn = await browser.GetStringAsync($"/Einladung/{fresh.Token:D}");
        Assert.Contains("data-accept-invitation", signedIn);
        Assert.False(await Db(db => db.SpaceMember.AnyAsync(m => m.SpaceId == team && m.UserId == person)));
        var posted = await browser.PostAsync($"/Einladung/{fresh.Token:D}", new FormUrlEncodedContent([new("__RequestVerificationToken", FormToken(signedIn))]));
        Assert.Equal(HttpStatusCode.Redirect, posted.StatusCode);
        Assert.StartsWith("/Teams/", posted.Headers.Location!.OriginalString);
        Assert.True(await Db(db => db.SpaceMember.AnyAsync(m => m.SpaceId == team && m.UserId == person)));
    }
}
