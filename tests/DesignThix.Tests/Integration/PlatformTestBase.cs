using System.Net;
using System.Text.RegularExpressions;
using DesignThix.Core.Security;
using DesignThix.Data;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.Services;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DesignThix.Tests.Integration;

/// <summary>The people the integration tests act as. Every test gets people of its own (the test class is made anew for every test), so tests do not see each other's things.</summary>
public enum Role
{
    /// <summary>A platform administrator: the claim is Admin, the row in the database is a plain member (so the setup of the app still finds no administrator).</summary>
    Admin,

    /// <summary>A member who works in their own area and in the team "Gemeinsam" (Owner).</summary>
    Designer,

    /// <summary>A member who has nothing of their own to look at until somebody shares it with them.</summary>
    Viewer,

    /// <summary>A member who has no connection to anybody else's things.</summary>
    Stranger,
}

/// <summary>
/// The base of the integration tests that act as people: it makes real accounts with a personal area (the access rules need them), and runs logic as one of them. Real PostgreSQL, see
/// <see cref="AppTests"/>; the tests return at once without <c>DESIGNTHIX_TEST_DB</c>.
/// </summary>
public abstract class PlatformTestBase(AppTests.AppFactory factory)
{
    protected AppTests.AppFactory Factory { get; } = factory;

    protected static bool Enabled => AppTests.AppFactory.Connection is not null;

    private readonly Dictionary<string, long> _users = [];

    /// <summary>Makes a member with a personal area; returns the id.</summary>
    public static async Task<long> NewUserAsync(AppTests.AppFactory factory, string label, UserRole role = UserRole.Member)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DtDbContext>();
        var user = new User { Email = $"{label.ToLowerInvariant()}-{Guid.NewGuid():N}@test.local", DisplayName = label, Role = role };
        db.User.Add(user);
        await db.SaveChangesAsync();
        await SpaceLogic.EnsurePersonalAsync(db, user);
        return user.Id;
    }

    /// <summary>A person of this test by label (made on first use).</summary>
    protected async Task<long> UserAsync(string label)
    {
        if (!_users.TryGetValue(label, out var id))
        {
            id = await NewUserAsync(Factory, label);
            _users[label] = id;
        }

        return id;
    }

    protected Task<long> UserAsync(Role role) => UserAsync(role.ToString());

    /// <summary>Runs the action as the person with this id.</summary>
    protected async Task<T> AsUser<T>(long userId, Func<Biz, Task<T>> action, UserRole role = UserRole.Member)
    {
        using var client = Factory.CreateClient();
        using var scope = Factory.Services.CreateScope();
        var current = scope.ServiceProvider.GetRequiredService<ICurrentUser>();
        using var acting = current.RunAs(userId, "Test " + userId, role);
        return await action(scope.ServiceProvider.GetRequiredService<Biz>());
    }

    protected Task AsUser(long userId, Func<Biz, Task> action, UserRole role = UserRole.Member) => AsUser(userId, async biz =>
    {
        await action(biz);
        return 0;
    }, role);

    /// <summary>Runs the action as one of the people of this test.</summary>
    protected async Task<T> As<T>(Role role, Func<Biz, Task<T>> action) => await AsUser(await UserAsync(role), action, role == Role.Admin ? UserRole.Admin : UserRole.Member);

    protected Task As(Role role, Func<Biz, Task> action) => As(role, async biz =>
    {
        await action(biz);
        return 0;
    });

    /// <summary>Shares an item of <paramref name="owner"/> with another person of the test.</summary>
    protected Task ShareAsync(Role owner, ItemKind kind, long id, Role with, SharePermission permission = SharePermission.View)
    {
        var target = UserAsync(with);
        return As(owner, async biz => await ShareLogic.AddAsync(biz, kind, id, false, await target, permission));
    }

    /// <summary>Makes a team (the person is its Owner) and adds the other people with a role; returns the id of the team.</summary>
    protected async Task<long> TeamAsync(Role owner, params (Role Who, SpaceRole Role)[] members)
    {
        var team = await As(owner, biz => SpaceLogic.CreateTeamAsync(biz, "Team " + Guid.NewGuid().ToString("N")[..6]));
        foreach (var (who, role) in members)
        {
            var id = await UserAsync(who);
            await As(owner, biz => SpaceLogic.AddMemberAsync(biz, team.Id, id, role));
        }

        return team.Id;
    }

    protected async Task<T> Db<T>(Func<DtDbContext, Task<T>> action)
    {
        using var scope = Factory.Services.CreateScope();
        return await action(scope.ServiceProvider.GetRequiredService<DtDbContext>());
    }

    protected Task Db(Func<DtDbContext, Task> action) => Db(async db =>
    {
        await action(db);
        return 0;
    });

    // ------------------------------------------------------------------------------------------------ platform settings, anonymous callers, HTTP (phase P4)

    protected const string TestPassword = "Passw0rd!Passw0rd";

    /// <summary>Runs the action as a visitor who is not signed in (the registration, the invitation page).</summary>
    protected async Task<T> AsAnonymous<T>(Func<Biz, Task<T>> action)
    {
        using var client = Factory.CreateClient();
        using var scope = Factory.Services.CreateScope();
        var current = scope.ServiceProvider.GetRequiredService<ICurrentUser>();
        using var acting = current.RunAs(null, null, UserRole.Member);
        return await action(scope.ServiceProvider.GetRequiredService<Biz>());
    }

    /// <summary>Sets the platform settings for the test and puts the old ones back afterwards (the host is shared).</summary>
    protected async Task<IAsyncDisposable> PlatformAsync(PlatformSettings settings)
    {
        var store = Factory.Services.GetRequiredService<SettingStore>();
        var old = store.Get<PlatformSettings>(SettingStore.Platform);
        await Db(db => store.SetAsync(db, SettingStore.Platform, settings));
        return new Restore(async () => await Db(db => store.SetAsync(db, SettingStore.Platform, old)));
    }

    /// <summary>Sets the mail settings (usable or not) for the test and puts the old ones back.</summary>
    protected async Task<IAsyncDisposable> MailAsync(MailSettings settings)
    {
        var store = Factory.Services.GetRequiredService<SettingStore>();
        var old = store.Get<MailSettings>(SettingStore.Mail);
        await Db(db => store.SetAsync(db, SettingStore.Mail, settings));
        return new Restore(async () => await Db(db => store.SetAsync(db, SettingStore.Mail, old)));
    }

    protected static MailSettings UsableMail() => new() { Enabled = true, Host = "smtp.test.local", FromAddress = "design@test.local" };

    private sealed class Restore(Func<Task> undo) : IAsyncDisposable
    {
        public async ValueTask DisposeAsync() => await undo();
    }

    /// <summary>Forgets the calls the rate limiter counted (the host is shared, and every test that registers or opens invitations shares the one address "unknown").</summary>
    protected void ResetLimiter() => Factory.Services.GetRequiredService<PublicRateLimiter>().Reset();

    /// <summary>Real administrator accounts (the claim of the other tests is only a claim): removed again when disposed, so the app asks for its first administrator again.</summary>
    protected sealed class RealAdmins(AppTests.AppFactory factory, IReadOnlyList<long> ids) : IAsyncDisposable
    {
        public IReadOnlyList<long> Ids => ids;

        public async ValueTask DisposeAsync()
        {
            using var scope = factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DtDbContext>();
            foreach (var id in ids)
            {
                await db.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM \"User\" WHERE \"Id\" = {id}");
            }

            factory.Services.GetRequiredService<SetupState>().Reset();
        }
    }

    protected async Task<RealAdmins> RealAdminsAsync(int count = 1)
    {
        var ids = new List<long>();
        for (var i = 0; i < count; i++)
        {
            ids.Add(await NewUserAsync(Factory, "Real Admin " + i, UserRole.Admin));
        }

        return new RealAdmins(Factory, ids);
    }

    /// <summary>A browser: signs the person in through the sign-in page and keeps the cookie.</summary>
    protected async Task<HttpClient> SignInAsync(long userId)
    {
        var email = await Db(async db =>
        {
            var user = await db.User.FirstAsync(u => u.Id == userId);
            user.PasswordHash = PasswordHasher.Hash(TestPassword);
            await db.SaveChangesAsync();
            return user.Email;
        });
        var client = Factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true });
        var page = await client.GetStringAsync("/Account/Login");
        var token = Regex.Match(page, "<input[^>]*name=\"__RequestVerificationToken\"[^>]*value=\"([^\"]+)\"").Groups[1].Value;
        var response = await client.PostAsync("/Account/Login", new FormUrlEncodedContent([new("Input.Email", email), new("Input.Password", TestPassword), new("__RequestVerificationToken", token)]));
        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        return client;
    }

    /// <summary>Posts JSON like the scripts of the app do: with the antiforgery token of a page of the signed-in client in the header.</summary>
    protected static async Task<HttpResponseMessage> ApiPostAsync(HttpClient client, string url, object body)
    {
        var page = await client.GetStringAsync("/");
        var csrf = Regex.Match(page, "<meta name=\"dt-csrf\" content=\"([^\"]+)\"").Groups[1].Value;
        using var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = System.Net.Http.Json.JsonContent.Create(body) };
        request.Headers.Add("RequestVerificationToken", csrf);
        return await client.SendAsync(request);
    }

    protected static string FormToken(string html) => Regex.Match(html, "<input[^>]*name=\"__RequestVerificationToken\"[^>]*value=\"([^\"]+)\"").Groups[1].Value;
}
