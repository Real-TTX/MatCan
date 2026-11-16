using System.Net;
using MatCan.Data.Entities;
using MatCan.Logic;
using MatCan.Services.Auth;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MatCan.Tests.Integration;

/// <summary>Self-registration (docs/PLAN-PLATFORM.md section 1.15): the three modes, the allowed domains, the account that waits, registration through an invitation, the brakes, and that nothing tells whether an address exists.</summary>
[Collection("app")]
public sealed class RegistrationTests(AppTests.AppFactory factory) : PlatformTestBase(factory)
{
    private const string Strong = "ein-gutes-Passwort-1";

    private static string Mailbox(string prefix = "neu") => $"{prefix}-{Guid.NewGuid():N}@test.local";

    private Task<RegisterResult> RegisterAsync(string email, string? name = "Neue Person", string password = Strong, string? repeat = null, Guid? invitation = null)
    {
        ResetLimiter();
        return AsAnonymous(biz => RegistrationLogic.RegisterAsync(biz, new RegisterInput(name, email, password, repeat ?? password, invitation)));
    }

    private async Task<SignInOutcome> SignInOutcomeAsync(string email, string password)
    {
        using var scope = Factory.Services.CreateScope();
        return (await scope.ServiceProvider.GetRequiredService<SignInService>().CheckPasswordAsync(email, password)).Outcome;
    }

    private Task<User?> FindAsync(string email) => Db(db => db.User.AsNoTracking().FirstOrDefaultAsync(u => u.Email == email));

    [Fact]
    public async Task While_registration_is_off_only_an_invitation_lets_somebody_in()
    {
        if (!Enabled)
        {
            return;
        }

        await using (await PlatformAsync(new PlatformSettings { Registration = "off" }))
        {
            var email = Mailbox();
            var refused = await Assert.ThrowsAsync<BizException>(() => RegisterAsync(email));
            Assert.Contains("ausgeschaltet", refused.Message);
            Assert.Null(await FindAsync(email));
            Assert.False(await AsAnonymous(biz => Task.FromResult(RegistrationLogic.IsOpen(biz))));

            // with an invitation it works: approved at once, a personal area, a member of the team with the invited role
            var team = await TeamAsync(Role.Designer);
            var invitation = (await As(Role.Designer, biz => InviteLogic.CreateAsync(biz, team, SpaceRole.Viewer, null, true, 7, 3))).Created.Single();
            var result = await RegisterAsync(email, invitation: invitation.Token);
            Assert.Equal(RegisterOutcome.Done, result.Outcome);
            Assert.NotNull(result.SignInUser);
            Assert.Equal(team, result.Invitation!.SpaceId);
            var user = (await FindAsync(email))!;
            Assert.Equal((ApprovalState.Approved, UserRole.Member), (user.ApprovalState, user.Role));
            Assert.NotNull(user.PersonalSpaceId);
            Assert.Equal(SpaceRole.Viewer, await Db(db => db.SpaceMember.Where(m => m.SpaceId == team && m.UserId == user.Id).Select(m => m.Role).SingleAsync()));
            Assert.Equal(1, await Db(db => db.Invitation.Where(i => i.Id == invitation.Id).Select(i => i.Uses).SingleAsync()));
            Assert.Equal(SignInOutcome.Success, await SignInOutcomeAsync(email, Strong));

            // a revoked or used up link registers nobody
            await As(Role.Designer, biz => InviteLogic.RevokeAsync(biz, invitation.Id));
            var dead = await Assert.ThrowsAsync<BizException>(() => RegisterAsync(Mailbox(), invitation: invitation.Token));
            Assert.Contains("nicht mehr gültig", dead.Message);
        }
    }

    [Fact]
    public async Task An_invitation_with_an_address_registers_only_that_address_and_ignores_the_domain_list()
    {
        if (!Enabled)
        {
            return;
        }

        await using (await PlatformAsync(new PlatformSettings { Registration = "approval", AllowedDomains = ["firma.example"] }))
        {
            var team = await TeamAsync(Role.Designer);
            var email = Mailbox("laden");
            var invitation = (await As(Role.Designer, biz => InviteLogic.CreateAsync(biz, team, SpaceRole.Editor, email, false, 7, 1))).Created.Single();
            var wrong = await Assert.ThrowsAsync<BizException>(() => RegisterAsync(Mailbox("falsch"), invitation: invitation.Token));
            Assert.Contains(email, wrong.Message);
            // not on the domain list and not waiting for approval: the invitation is the permission
            var result = await RegisterAsync(email, invitation: invitation.Token);
            Assert.Equal(RegisterOutcome.Done, result.Outcome);
            Assert.Equal(ApprovalState.Approved, (await FindAsync(email))!.ApprovalState);

            // the address of an invitation that exists: "not possible", without saying why
            var existing = await UserAsync("hat-konto");
            var existingMail = await Db(db => db.User.Where(u => u.Id == existing).Select(u => u.Email).SingleAsync());
            var named = (await As(Role.Designer, biz => InviteLogic.CreateAsync(biz, team, SpaceRole.Editor, existingMail, false, 7, 1))).Created.Single();
            var notPossible = await Assert.ThrowsAsync<BizException>(() => RegisterAsync(existingMail, invitation: named.Token));
            Assert.Equal(RegistrationLogic.NotPossible, notPossible.Message);
            Assert.DoesNotContain("Konto gibt es", notPossible.Message);
        }
    }

    [Fact]
    public async Task Open_registration_makes_an_account_that_can_sign_in_with_the_policy_of_the_setup_assistant()
    {
        if (!Enabled)
        {
            return;
        }

        await using (await PlatformAsync(new PlatformSettings { Registration = "open" }))
        {
            Assert.True(await AsAnonymous(biz => Task.FromResult(RegistrationLogic.IsOpen(biz))));
            var weak = await Assert.ThrowsAsync<BizException>(() => RegisterAsync(Mailbox(), password: "kurz"));
            Assert.Equal("Input.Password", weak.Field);
            var mismatch = await Assert.ThrowsAsync<BizException>(() => RegisterAsync(Mailbox(), password: Strong, repeat: Strong + "x"));
            Assert.Equal("Input.PasswordRepeat", mismatch.Field);
            var noEmail = await Assert.ThrowsAsync<BizException>(() => RegisterAsync("keine-adresse"));
            Assert.Equal("Input.Email", noEmail.Field);
            var noName = await Assert.ThrowsAsync<BizException>(() => RegisterAsync(Mailbox(), name: "   "));
            Assert.Equal("Input.DisplayName", noName.Field);

            var email = Mailbox();
            var result = await RegisterAsync(email, "  Anna Neu  ");
            Assert.Equal(RegisterOutcome.Done, result.Outcome);
            Assert.Null(result.SignInUser);
            var user = (await FindAsync(email.ToUpperInvariant().ToLowerInvariant()))!;
            Assert.Equal("Anna Neu", user.DisplayName);
            Assert.Equal(ApprovalState.Approved, user.ApprovalState);
            Assert.Equal(SignInOutcome.Success, await SignInOutcomeAsync(email, Strong));
            // the new person has an area of their own and nothing else
            var spaces = await AsUser(user.Id, biz => SpaceLogic.MySpacesAsync(biz));
            Assert.Equal(SpaceKind.Personal, Assert.Single(spaces).Kind);
        }
    }

    [Fact]
    public async Task With_approval_the_account_waits_signs_in_to_the_waiting_page_and_works_after_the_administrator_says_yes()
    {
        if (!Enabled)
        {
            return;
        }

        await using var admins = await RealAdminsAsync();
        await using (await PlatformAsync(new PlatformSettings { Registration = "approval" }))
        {
            var email = Mailbox("wartet");
            var result = await RegisterAsync(email);
            Assert.Equal(RegisterOutcome.Pending, result.Outcome);
            var user = (await FindAsync(email))!;
            Assert.Equal(ApprovalState.Pending, user.ApprovalState);
            Assert.Equal(SignInOutcome.NotApproved, await SignInOutcomeAsync(email, Strong));
            Assert.Equal(SignInOutcome.Invalid, await SignInOutcomeAsync(email, "falsches-Passwort-1"));

            // the administrators hear about it
            var notified = await Db(db => db.Notification.Where(n => n.Kind == NotificationKinds.RegistrationPending && admins.Ids.Contains(n.UserId)).CountAsync());
            Assert.Equal(admins.Ids.Count, notified);
            Assert.True(await AsUser(admins.Ids[0], biz => UserLogic.PendingCountAsync(biz), UserRole.Admin) >= 1);

            // the login page answers with the page that says so
            var browser = Factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true });
            var page = await browser.GetStringAsync("/Account/Login");
            var post = await browser.PostAsync("/Account/Login", new FormUrlEncodedContent([new("Input.Email", email), new("Input.Password", Strong), new("__RequestVerificationToken", FormToken(page))]));
            Assert.Equal(HttpStatusCode.Redirect, post.StatusCode);
            Assert.Equal("/Account/Pending", post.Headers.Location!.OriginalString);
            var pending = await browser.GetAsync("/Account/Pending");
            Assert.Equal(HttpStatusCode.OK, pending.StatusCode);
            Assert.Contains("Dein Konto wartet auf Freigabe", await pending.Content.ReadAsStringAsync());

            await AsUser(admins.Ids[0], biz => UserLogic.SetApprovalAsync(biz, user.Id, true), UserRole.Admin);
            Assert.Equal(SignInOutcome.Success, await SignInOutcomeAsync(email, Strong));

            // a declined account stays out
            var other = Mailbox("abgelehnt");
            await RegisterAsync(other);
            var declined = (await FindAsync(other))!;
            await AsUser(admins.Ids[0], biz => UserLogic.SetApprovalAsync(biz, declined.Id, false), UserRole.Admin);
            Assert.Equal(SignInOutcome.NotApproved, await SignInOutcomeAsync(other, Strong));
            Assert.Equal(ApprovalState.Declined, (await FindAsync(other))!.ApprovalState);
        }
    }

    [Fact]
    public async Task Only_addresses_of_the_allowed_domains_register_without_an_invitation()
    {
        if (!Enabled)
        {
            return;
        }

        await using (await PlatformAsync(new PlatformSettings { Registration = "open", AllowedDomains = ["firma.example", "@Zweite.Example"] }))
        {
            Assert.Equal(["firma.example", "zweite.example"], await AsAnonymous(biz => Task.FromResult(RegistrationLogic.AllowedDomains(biz))));
            var refused = await Assert.ThrowsAsync<BizException>(() => RegisterAsync(Mailbox()));
            Assert.Equal("Input.Email", refused.Field);
            Assert.Contains("firma.example", refused.Message);
            var one = $"anna-{Guid.NewGuid():N}@Firma.Example";
            var two = $"ben-{Guid.NewGuid():N}@zweite.example";
            Assert.Equal(RegisterOutcome.Done, (await RegisterAsync(one)).Outcome);
            Assert.Equal(RegisterOutcome.Done, (await RegisterAsync(two)).Outcome);
            Assert.NotNull(await FindAsync(one.ToLowerInvariant()));
            // a domain that only ends alike is not the domain
            await Assert.ThrowsAsync<BizException>(() => RegisterAsync($"x-{Guid.NewGuid():N}@evilfirma.example"));
            await Assert.ThrowsAsync<BizException>(() => RegisterAsync($"x-{Guid.NewGuid():N}@firma.example.evil.test"));
        }
    }

    [Fact]
    public async Task A_registration_with_an_address_that_exists_ends_exactly_like_a_new_one_and_changes_nothing()
    {
        if (!Enabled)
        {
            return;
        }

        foreach (var mode in new[] { "open", "approval" })
        {
            await using (await PlatformAsync(new PlatformSettings { Registration = mode }))
            {
                var email = Mailbox("bekannt");
                var first = await RegisterAsync(email, "Erste Person");
                var second = await RegisterAsync(email, "Zweite Person", password: "ein-anderes-Passwort-2");
                // the same outcome, the same absence of a session: the answer does not tell
                Assert.Equal(first.Outcome, second.Outcome);
                Assert.Equal(first.SignInUser is null, second.SignInUser is null);
                Assert.Equal(1, await Db(db => db.User.CountAsync(u => u.Email == email)));
                var user = (await FindAsync(email))!;
                Assert.Equal("Erste Person", user.DisplayName);
                Assert.Equal(mode == "approval" ? SignInOutcome.NotApproved : SignInOutcome.Success, await SignInOutcomeAsync(email, Strong));
                // the second password did not replace the first
                Assert.Equal(SignInOutcome.Invalid, await SignInOutcomeAsync(email, "ein-anderes-Passwort-2"));
            }
        }
    }

    [Fact]
    public async Task Registering_is_limited_per_client_and_per_address()
    {
        if (!Enabled)
        {
            return;
        }

        await using (await PlatformAsync(new PlatformSettings { Registration = "open" }))
        {
            ResetLimiter();
            var email = Mailbox("brake");
            for (var i = 0; i < RegistrationLogic.PerEmailPerMinute; i++)
            {
                // a bad password costs a try as well
                await Assert.ThrowsAsync<BizException>(() => AsAnonymous(biz => RegistrationLogic.RegisterAsync(biz, new RegisterInput("Brake", email, "kurz", "kurz", null))));
            }

            var limited = await Assert.ThrowsAsync<BizException>(() => AsAnonymous(biz => RegistrationLogic.RegisterAsync(biz, new RegisterInput("Brake", email, Strong, Strong, null))));
            Assert.Contains("Zu viele Versuche", limited.Message);
            Assert.Null(await FindAsync(email));

            // a different address of the same client still has tries left, until the client's own limit is used up
            ResetLimiter();
            for (var i = 0; i < RegistrationLogic.PerClientPerMinute; i++)
            {
                await Assert.ThrowsAsync<BizException>(() => AsAnonymous(biz => RegistrationLogic.RegisterAsync(biz, new RegisterInput("Brake", Mailbox("c"), "kurz", "kurz", null))));
            }

            var clientLimited = await Assert.ThrowsAsync<BizException>(() => AsAnonymous(biz => RegistrationLogic.RegisterAsync(biz, new RegisterInput("Brake", Mailbox("c"), Strong, Strong, null))));
            Assert.Contains("Zu viele Versuche", clientLimited.Message);
            ResetLimiter();
        }
    }

    [Fact]
    public async Task The_register_page_exists_only_while_registration_is_on_and_the_login_page_links_to_it_then()
    {
        if (!Enabled)
        {
            return;
        }

        await using var admins = await RealAdminsAsync();
        var anonymous = Factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        await using (await PlatformAsync(new PlatformSettings { Registration = "off" }))
        {
            var off = await anonymous.GetAsync("/Account/Register");
            Assert.Equal(HttpStatusCode.Redirect, off.StatusCode);
            Assert.Equal("/Account/Login", off.Headers.Location!.OriginalString);
            Assert.DoesNotContain("data-register-link", await anonymous.GetStringAsync("/Account/Login"));
        }

        await using (await PlatformAsync(new PlatformSettings { Registration = "approval", AllowedDomains = ["firma.example"] }))
        {
            var html = await anonymous.GetStringAsync("/Account/Register");
            Assert.Contains("Konto erstellen", html);
            Assert.Contains("gibt die Administration dein Konto frei", html);
            Assert.Contains("firma.example", html);
            Assert.Contains("data-register-link", await anonymous.GetStringAsync("/Account/Login"));
            // the anonymous pages carry the security headers
            var response = await anonymous.GetAsync("/Account/Pending");
            Assert.Contains("script-src 'self'", response.Headers.GetValues("Content-Security-Policy").Single());
        }
    }
}
