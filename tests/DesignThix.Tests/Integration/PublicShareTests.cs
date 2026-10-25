using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using DesignThix.Core.Documents;
using DesignThix.Core.Security;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.Services;
using DesignThix.Tests.Core;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DesignThix.Tests.Integration;

/// <summary>A clock the test moves by hand.</summary>
public sealed class ManualClock(DateTimeOffset start) : TimeProvider
{
    private DateTimeOffset _now = start;

    public override DateTimeOffset GetUtcNow() => _now;

    public void Advance(TimeSpan by) => _now += by;
}

/// <summary>What a public link shows to somebody who is not signed in (docs/PLAN-PLATFORM.md section 1.8) and the pages around it.</summary>
[Collection("app")]
public sealed class PublicShareTests(AppTests.AppFactory factory) : PlatformTestBase(factory)
{
    private const string Password = "Passw0rd!Passw0rd";

    private static string Unique(string prefix) => prefix + Guid.NewGuid().ToString("N")[..8];

    private static byte[] Png() => File.ReadAllBytes(Path.Combine(RepoFiles.WwwRoot(), "img", "icon-192.png"));

    private static string DocumentOf(string title, string? asset = null, string? family = null)
    {
        var document = DocumentValidator.Create(150, 100) with
        {
            Fields = [new FieldDef("Name", "Name", "text", "Beispiel-Käse", null, null, false)],
        };
        var page = document.Pages[0] with
        {
            Background = asset is null ? BackgroundDef.White : new BackgroundDef("#ffffff", null, asset, "cover"),
            Elements = [new TextElement { Id = "t1", X = 5, Y = 5, W = 100, H = 20, Text = title + " {{Name}}", FontFamily = family ?? "Open Sans" }],
        };
        return DocumentValidator.ToJson(document with { Pages = [page] });
    }

    private async Task<long> DesignAsync(Role who, string name, string? asset = null, long? folder = null, string? family = null)
        => await As(who, async biz =>
        {
            var design = await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign(name, null, "a4-portrait", null, null, null, null, null, folder));
            await DesignLogic.SaveDocumentAsync(biz, design.Id, 1, DocumentOf(name, asset, family));
            return design.Id;
        });

    private Task<ShareLink> PublicLinkAsync(Role who, ItemKind kind, long id, bool download = false)
        => As(who, biz => ShareLogic.SetLinkAsync(biz, kind, id, LinkAudience.Public, SharePermission.View, download, null));

    /// <summary>Runs the public logic as nobody: no sign-in.</summary>
    private async Task<T> Anonymously<T>(Func<Biz, Task<T>> action)
    {
        using var scope = Factory.Services.CreateScope();
        return await action(scope.ServiceProvider.GetRequiredService<Biz>());
    }

    // ------------------------------------------------------------------------------------------------ the payload of a design

    [Fact]
    public async Task A_public_design_shows_its_own_sample_values_and_never_the_rows_of_a_data_list()
    {
        if (!Enabled)
        {
            return;
        }

        var secret = Unique("Geheimer-Wert-");
        var design = await DesignAsync(Role.Designer, "Plakat");
        await As(Role.Designer, async biz =>
        {
            var list = await DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput(Unique("Liste "), null, false));
            await DataListLogic.SaveColumnsAsync(biz, list.Id, [new("Name", "Name", "text", null, null)]);
            var revision = (await DataListLogic.GridAsync(biz, list.Id)).Revision;
            await DataListLogic.SaveRowsAsync(biz, list.Id, revision, [new GridRow(null, new Dictionary<string, string> { ["Name"] = secret }, 1, true)]);
        });
        var link = await PublicLinkAsync(Role.Designer, ItemKind.Design, design, download: true);

        var payload = await Anonymously(biz => PublicShareLogic.DesignAsync(biz, link.Token, null));
        Assert.NotNull(payload);
        Assert.Equal("Plakat", payload.Name);
        Assert.True(payload.AllowDownload);
        Assert.Equal(1, payload.Pages);
        Assert.Contains("Beispiel-Käse", payload.DocumentJson);
        Assert.DoesNotContain(secret, JsonSerializer.Serialize(payload));
        // the design's own font is offered, nothing else
        Assert.Contains(payload.Fonts, f => f.Family == "Open Sans");
        Assert.All(payload.Fonts, f => Assert.Equal("Open Sans", f.Family));
    }

    [Fact]
    public async Task Only_the_images_of_the_design_that_are_the_designs_to_use_come_with_an_address()
    {
        if (!Enabled)
        {
            return;
        }

        var own = await As(Role.Designer, async biz => (await AssetLogic.UploadAsync(biz, Unique("eigen-") + ".png", Png(), null)).Asset!);
        var foreign = await As(Role.Stranger, async biz => (await AssetLogic.UploadAsync(biz, Unique("fremd-") + ".png", Png(), null)).Asset!);
        var design = await DesignAsync(Role.Designer, "Mit Bild", own.Key);
        var link = await PublicLinkAsync(Role.Designer, ItemKind.Design, design);

        var payload = await Anonymously(biz => PublicShareLogic.DesignAsync(biz, link.Token, null));
        Assert.NotNull(payload);
        Assert.True(payload.Assets.ContainsKey(own.Key));
        Assert.Contains("?v=" + own.ContentHash[..12], payload.Assets[own.Key]);

        // a key that somebody else's area owns, forced into the document behind the back of the save rule, gets no address
        await Db(async db =>
        {
            var json = DocumentOf("Mit Bild", foreign.Key);
            await db.Design.Where(d => d.Id == design).ExecuteUpdateAsync(s => s.SetProperty(d => d.DocumentJson, json));
        });
        var forced = await Anonymously(biz => PublicShareLogic.DesignAsync(biz, link.Token, null));
        Assert.NotNull(forced);
        Assert.DoesNotContain(foreign.Key, forced.Assets.Keys);
        Assert.Contains(forced.Warnings, w => w.Contains(foreign.Key));
        // and one nobody has at all is only a warning
        var built = await Anonymously(biz => biz.Db.Asset.Where(a => a.SpaceId == null).Select(a => a.Key).FirstAsync());
        await Db(async db =>
        {
            var json = DocumentOf("Mit Bild", built);
            await db.Design.Where(d => d.Id == design).ExecuteUpdateAsync(s => s.SetProperty(d => d.DocumentJson, json));
        });
        var builtIn = await Anonymously(biz => PublicShareLogic.DesignAsync(biz, link.Token, null));
        Assert.True(builtIn!.Assets.ContainsKey(built));
    }

    [Fact]
    public async Task The_fonts_of_the_area_come_with_the_design_but_not_the_fonts_of_other_areas()
    {
        if (!Enabled)
        {
            return;
        }

        var teamFont = await As(Role.Designer, async biz => (await FontLogic.UploadAsync(biz, Unique("Teamschrift") + ".ttf", [0, 1, 0, 0, 77, 2, 3, 4, 5, 6, 7, 8], null)).Font!);
        var other = await As(Role.Stranger, async biz => (await FontLogic.UploadAsync(biz, Unique("Fremdschrift") + ".ttf", [0, 1, 0, 0, 77, 2, 3, 4, 5, 6, 7, 9], null)).Font!);
        var design = await DesignAsync(Role.Designer, "Mit Schrift", family: teamFont.Family);
        var link = await PublicLinkAsync(Role.Designer, ItemKind.Design, design);
        var payload = await Anonymously(biz => PublicShareLogic.DesignAsync(biz, link.Token, null));
        Assert.Contains(payload!.Fonts, f => f.Family == teamFont.Family);
        Assert.DoesNotContain(payload.Fonts, f => f.Family == other.Family);

        // the design of the stranger would name the other family, but the font is not that design's area's: nothing of it is handed out for a design of somebody else
        var foreignUse = await DesignAsync(Role.Designer, "Fremde Schrift", family: other.Family);
        var foreignLink = await PublicLinkAsync(Role.Designer, ItemKind.Design, foreignUse);
        var none = await Anonymously(biz => PublicShareLogic.DesignAsync(biz, foreignLink.Token, null));
        Assert.DoesNotContain(none!.Fonts, f => f.Family == other.Family);
    }

    // ------------------------------------------------------------------------------------------------ links that are dead

    [Fact]
    public async Task A_link_that_is_reset_revoked_expired_switched_off_or_of_the_wrong_kind_shows_nothing()
    {
        if (!Enabled)
        {
            return;
        }

        var design = await DesignAsync(Role.Designer, "Tot");
        var first = await PublicLinkAsync(Role.Designer, ItemKind.Design, design);
        Assert.NotNull(await Anonymously(biz => PublicShareLogic.InfoAsync(biz, first.Token)));

        // reset: the old token is dead, the new one lives
        var second = await As(Role.Designer, biz => ShareLogic.ResetLinkAsync(biz, ItemKind.Design, design));
        Assert.Null(await Anonymously(biz => PublicShareLogic.InfoAsync(biz, first.Token)));
        Assert.Null(await Anonymously(biz => PublicShareLogic.DesignAsync(biz, first.Token, null)));
        Assert.NotNull(await Anonymously(biz => PublicShareLogic.DesignAsync(biz, second.Token, null)));

        // expired
        await Db(db => db.ShareLink.Where(l => l.Id == second.Id).ExecuteUpdateAsync(s => s.SetProperty(l => l.ExpiresDate, DateTime.UtcNow.AddMinutes(-1))));
        Assert.Null(await Anonymously(biz => PublicShareLogic.DesignAsync(biz, second.Token, null)));
        await Db(db => db.ShareLink.Where(l => l.Id == second.Id).ExecuteUpdateAsync(s => s.SetProperty(l => l.ExpiresDate, DateTime.UtcNow.AddDays(1))));
        Assert.NotNull(await Anonymously(biz => PublicShareLogic.DesignAsync(biz, second.Token, null)));

        // the administrator switches public links off: the link counts as dead, and comes back when they are on again
        try
        {
            await As(Role.Admin, biz => SettingLogic.SaveAsync(biz, SettingStore.Platform, new PlatformSettings { PublicLinks = false }, "Test"));
            Assert.Null(await Anonymously(biz => PublicShareLogic.DesignAsync(biz, second.Token, null)));
        }
        finally
        {
            await As(Role.Admin, biz => SettingLogic.SaveAsync(biz, SettingStore.Platform, new PlatformSettings(), "Test"));
        }

        Assert.NotNull(await Anonymously(biz => PublicShareLogic.DesignAsync(biz, second.Token, null)));

        // the design in the trash
        await As(Role.Designer, biz => ItemLogic.TrashAsync(biz, [new ItemRef(ItemKind.Design, design)]));
        Assert.Null(await Anonymously(biz => PublicShareLogic.DesignAsync(biz, second.Token, null)));
        await As(Role.Designer, biz => ItemLogic.RestoreAsync(biz, [new ItemRef(ItemKind.Design, design)]));
        Assert.NotNull(await Anonymously(biz => PublicShareLogic.DesignAsync(biz, second.Token, null)));

        // revoked
        await As(Role.Designer, biz => ShareLogic.RevokeLinkAsync(biz, ItemKind.Design, design));
        Assert.Null(await Anonymously(biz => PublicShareLogic.DesignAsync(biz, second.Token, null)));

        // a link for signed-in people is nothing for the public; neither is a link to a data list
        var signedIn = await As(Role.Designer, biz => ShareLogic.SetLinkAsync(biz, ItemKind.Design, design, LinkAudience.SignedIn, SharePermission.View, false, null));
        Assert.Null(await Anonymously(biz => PublicShareLogic.InfoAsync(biz, signedIn.Token)));
        var list = await As(Role.Designer, async biz => (await DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput(Unique("Liste "), null, false))).Id);
        var listLink = await As(Role.Designer, biz => ShareLogic.SetLinkAsync(biz, ItemKind.DataList, list, LinkAudience.SignedIn, SharePermission.View, false, null));
        Assert.Null(await Anonymously(biz => PublicShareLogic.InfoAsync(biz, listLink.Token)));
        Assert.Null(await Anonymously(biz => PublicShareLogic.InfoAsync(biz, Guid.NewGuid())));
    }

    // ------------------------------------------------------------------------------------------------ a shared folder

    [Fact]
    public async Task A_shared_folder_shows_its_subtree_and_a_design_outside_or_in_the_trash_is_out_of_reach()
    {
        if (!Enabled)
        {
            return;
        }

        var root = await As(Role.Designer, async biz => await FolderLogic.CreateAsync(biz, null, null, "Galerie"));
        var sub = await As(Role.Designer, async biz => await FolderLogic.CreateAsync(biz, null, root.Id, "Unten"));
        var elsewhere = await As(Role.Designer, async biz => await FolderLogic.CreateAsync(biz, null, null, "Anderswo"));
        var one = await DesignAsync(Role.Designer, "Eins", folder: root.Id);
        var deep = await DesignAsync(Role.Designer, "Tief", folder: sub.Id);
        var outside = await DesignAsync(Role.Designer, "Draußen");
        var other = await DesignAsync(Role.Designer, "Anderes", folder: elsewhere.Id);
        var link = await PublicLinkAsync(Role.Designer, ItemKind.Folder, root.Id, download: true);

        var gallery = await Anonymously(biz => PublicShareLogic.FolderAsync(biz, link.Token, null));
        Assert.NotNull(gallery);
        Assert.Equal("Galerie", gallery.Name);
        Assert.Equal(["Galerie"], gallery.Breadcrumb.Select(c => c.Name));
        Assert.Contains(gallery.Items, i => i is { Kind: "design", Name: "Eins" });
        Assert.Contains(gallery.Items, i => i is { Kind: "folder", Name: "Unten", Count: 1 });
        Assert.DoesNotContain(gallery.Items, i => i.Name is "Tief" or "Draußen" or "Anderes");

        var below = await Anonymously(biz => PublicShareLogic.FolderAsync(biz, link.Token, sub.Id));
        Assert.Equal(["Galerie", "Unten"], below!.Breadcrumb.Select(c => c.Name));
        Assert.Contains(below.Items, i => i.Name == "Tief");
        Assert.Null(await Anonymously(biz => PublicShareLogic.FolderAsync(biz, link.Token, elsewhere.Id)));

        // designs: inside the subtree yes, anywhere else no (also through the link of a folder, also for ids that do not exist)
        Assert.NotNull(await Anonymously(biz => PublicShareLogic.DesignAsync(biz, link.Token, one)));
        Assert.NotNull(await Anonymously(biz => PublicShareLogic.DesignAsync(biz, link.Token, deep)));
        Assert.Null(await Anonymously(biz => PublicShareLogic.DesignAsync(biz, link.Token, outside)));
        Assert.Null(await Anonymously(biz => PublicShareLogic.DesignAsync(biz, link.Token, other)));
        Assert.Null(await Anonymously(biz => PublicShareLogic.DesignAsync(biz, link.Token, 987654321)));
        Assert.Null(await Anonymously(biz => PublicShareLogic.DesignAsync(biz, link.Token, null)));

        // the link of a design opens that design only
        var designLink = await PublicLinkAsync(Role.Designer, ItemKind.Design, outside);
        Assert.NotNull(await Anonymously(biz => PublicShareLogic.DesignAsync(biz, designLink.Token, outside)));
        Assert.Null(await Anonymously(biz => PublicShareLogic.DesignAsync(biz, designLink.Token, one)));
        Assert.Null(await Anonymously(biz => PublicShareLogic.FolderAsync(biz, designLink.Token, null)));

        // moved out of the folder, in the trash, or the folder in the trash
        await As(Role.Designer, biz => ItemLogic.MoveAsync(biz, [new ItemRef(ItemKind.Design, one)], null, null));
        Assert.Null(await Anonymously(biz => PublicShareLogic.DesignAsync(biz, link.Token, one)));
        await As(Role.Designer, biz => ItemLogic.TrashAsync(biz, [new ItemRef(ItemKind.Design, deep)]));
        Assert.Null(await Anonymously(biz => PublicShareLogic.DesignAsync(biz, link.Token, deep)));
        await As(Role.Designer, biz => ItemLogic.RestoreAsync(biz, [new ItemRef(ItemKind.Design, deep)]));
        Assert.NotNull(await Anonymously(biz => PublicShareLogic.DesignAsync(biz, link.Token, deep)));
        await As(Role.Designer, biz => ItemLogic.TrashAsync(biz, [new ItemRef(ItemKind.Folder, sub.Id)]));
        Assert.Null(await Anonymously(biz => PublicShareLogic.DesignAsync(biz, link.Token, deep)));
        Assert.Null(await Anonymously(biz => PublicShareLogic.FolderAsync(biz, link.Token, sub.Id)));
        await As(Role.Designer, biz => ItemLogic.TrashAsync(biz, [new ItemRef(ItemKind.Folder, root.Id)]));
        Assert.Null(await Anonymously(biz => PublicShareLogic.FolderAsync(biz, link.Token, null)));
    }

    // ------------------------------------------------------------------------------------------------ the brake

    [Fact]
    public void The_rate_limit_is_per_address_per_minute_and_a_miss_costs_more()
    {
        var clock = new ManualClock(new DateTimeOffset(2026, 10, 25, 12, 0, 0, TimeSpan.Zero));
        var limiter = new PublicRateLimiter(clock);
        for (var i = 0; i < 10; i++)
        {
            Assert.True(limiter.TryTake("1.2.3.4", 10));
        }

        Assert.False(limiter.TryTake("1.2.3.4", 10));
        Assert.True(limiter.TryTake("5.6.7.8", 10));
        clock.Advance(TimeSpan.FromSeconds(61));
        Assert.True(limiter.TryTake("1.2.3.4", 10));

        limiter.Charge("9.9.9.9", 8);
        Assert.True(limiter.TryTake("9.9.9.9", 10));
        Assert.True(limiter.TryTake("9.9.9.9", 10));
        Assert.False(limiter.TryTake("9.9.9.9", 10));
        Assert.True(limiter.TryTake("anywhere", 0));
        // a call that costs more than is left is refused and takes nothing
        Assert.False(limiter.TryTake("5.6.7.8", 10, 20));
        Assert.True(limiter.TryTake("5.6.7.8", 10, 8));
    }

    // ------------------------------------------------------------------------------------------------ HTTP: anonymous endpoints and pages

    private sealed class Gate(AppTests.AppFactory factory, long adminId) : IAsyncDisposable
    {
        public async ValueTask DisposeAsync()
        {
            using var scope = factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<Data.DtDbContext>();
            await db.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM \"User\" WHERE \"Id\" = {adminId}");
            factory.Services.GetRequiredService<SetupState>().Reset();
        }
    }

    /// <summary>The app sends everybody to the setup assistant while there is no administrator: an HTTP test makes one for its duration.</summary>
    private async Task<Gate> WithAdministratorAsync()
    {
        var id = await Db(async db =>
        {
            var admin = new User { Email = $"gate-{Guid.NewGuid():N}@test.local", DisplayName = "Gate", Role = UserRole.Admin, PasswordHash = PasswordHasher.Hash(Password) };
            db.User.Add(admin);
            await db.SaveChangesAsync();
            return admin.Id;
        });
        return new Gate(Factory, id);
    }

    private async Task<HttpClient> SignInAsync(Role role)
    {
        var id = await UserAsync(role);
        var email = await Db(async db =>
        {
            var user = await db.User.FirstAsync(u => u.Id == id);
            user.PasswordHash = PasswordHasher.Hash(Password);
            await db.SaveChangesAsync();
            return user.Email;
        });
        var client = Factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true });
        var page = await client.GetStringAsync("/Account/Login");
        var token = Regex.Match(page, "<input[^>]*name=\"__RequestVerificationToken\"[^>]*value=\"([^\"]+)\"").Groups[1].Value;
        var response = await client.PostAsync("/Account/Login", new FormUrlEncodedContent([new("Input.Email", email), new("Input.Password", Password), new("__RequestVerificationToken", token)]));
        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        return client;
    }

    private static async Task<HttpResponseMessage> PostJsonAsync(HttpClient client, string url, object body)
    {
        var page = await client.GetStringAsync("/");
        var csrf = Regex.Match(page, "<meta name=\"dt-csrf\" content=\"([^\"]+)\"").Groups[1].Value;
        using var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = JsonContent.Create(body) };
        request.Headers.Add("RequestVerificationToken", csrf);
        return await client.SendAsync(request);
    }

    private HttpClient Anonymous() => Factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

    [Fact]
    public async Task The_public_endpoints_need_no_sign_in_are_never_cached_and_answer_404_for_a_dead_link()
    {
        if (!Enabled)
        {
            return;
        }

        await using var gate = await WithAdministratorAsync();
        var design = await DesignAsync(Role.Designer, "Offen");
        var link = await PublicLinkAsync(Role.Designer, ItemKind.Design, design, download: true);
        var anonymous = Anonymous();

        var ok = await anonymous.GetAsync($"/api/s/{link.Token}");
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.Contains("no-store", ok.Headers.CacheControl!.ToString());
        Assert.Contains("noindex", ok.Headers.GetValues("X-Robots-Tag").Single());
        using var json = JsonDocument.Parse(await ok.Content.ReadAsStringAsync());
        var names = json.RootElement.EnumerateObject().Select(p => p.Name).Order().ToList();
        Assert.Equal(["allowDownload", "assets", "document", "folderId", "fonts", "id", "kind", "name", "pages", "warnings"], names);

        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"/api/s/{Guid.NewGuid()}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync("/api/s/not-a-guid")).StatusCode);
        // the link of a design opens that design (also by the folder-style address) and no other
        var other = await DesignAsync(Role.Designer, "Anderes");
        Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync($"/api/s/{link.Token}/d/{design}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"/api/s/{link.Token}/d/{other}")).StatusCode);

        // the page: noindex, no sign-in; a dead link says so with 404
        var page = await anonymous.GetAsync($"/s/{link.Token}");
        Assert.Equal(HttpStatusCode.OK, page.StatusCode);
        var html = await page.Content.ReadAsStringAsync();
        Assert.Contains("noindex", html);
        Assert.Contains("dt-pv", html);
        Assert.Contains("noindex", page.Headers.GetValues("X-Robots-Tag").Single());
        var dead = await anonymous.GetAsync($"/s/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, dead.StatusCode);
        Assert.Contains("Dieser Link ist nicht mehr gültig", await dead.Content.ReadAsStringAsync());

        // a link for signed-in people sends an anonymous visitor to the sign-in, with the way back
        var signedIn = await As(Role.Designer, async biz => await ShareLogic.SetLinkAsync(biz, ItemKind.Design, design, LinkAudience.SignedIn, SharePermission.View, false, null));
        var redirect = await anonymous.GetAsync($"/s/{signedIn.Token}");
        Assert.Equal(HttpStatusCode.Redirect, redirect.StatusCode);
        Assert.StartsWith("/Account/Login", redirect.Headers.Location!.OriginalString);
        Assert.Contains(Uri.EscapeDataString($"/s/{signedIn.Token}"), redirect.Headers.Location.OriginalString);
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"/api/s/{signedIn.Token}")).StatusCode);
    }

    [Fact]
    public async Task The_public_endpoints_are_rate_limited_per_address()
    {
        if (!Enabled)
        {
            return;
        }

        await using var gate = await WithAdministratorAsync();
        var design = await DesignAsync(Role.Designer, "Gebremst");
        var link = await PublicLinkAsync(Role.Designer, ItemKind.Design, design);
        var anonymous = Anonymous();
        // make this test's own limiter: the address of the test host is "unknown" or 127.0.0.1, a fresh table for the singleton
        var limiter = Factory.Services.GetRequiredService<PublicRateLimiter>();
        HttpStatusCode last = HttpStatusCode.OK;
        for (var i = 0; i < PublicShareLogic.RequestsPerMinute + 5; i++)
        {
            last = (await anonymous.GetAsync($"/api/s/{link.Token}")).StatusCode;
            if (last == HttpStatusCode.TooManyRequests)
            {
                break;
            }
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, last);
        var again = await anonymous.GetAsync($"/api/s/{link.Token}");
        Assert.Equal(HttpStatusCode.TooManyRequests, again.StatusCode);
        Assert.Equal("60", again.Headers.GetValues("Retry-After").Single());
        // the table is shared with the other tests: empty it again
        limiter.Reset();
    }

    [Fact]
    public async Task A_person_without_access_is_sent_to_the_request_page_that_does_not_name_the_item()
    {
        if (!Enabled)
        {
            return;
        }

        await using var gate = await WithAdministratorAsync();
        var title = Unique("Streng-geheim-");
        var design = await DesignAsync(Role.Designer, title);
        var stranger = await SignInAsync(Role.Stranger);

        var redirect = await stranger.GetAsync($"/Designs/{design}/Designer");
        Assert.Equal(HttpStatusCode.Redirect, redirect.StatusCode);
        Assert.Equal($"/Zugriff/design/{design}", redirect.Headers.Location!.OriginalString);
        var page = await (await stranger.GetAsync($"/Zugriff/design/{design}")).Content.ReadAsStringAsync();
        Assert.Contains("Zugriff", page);
        Assert.DoesNotContain(title, page);
        // an id that is not there looks the same
        var missing = await stranger.GetAsync("/Zugriff/design/987654321");
        Assert.Equal(HttpStatusCode.OK, missing.StatusCode);
        Assert.DoesNotContain("Streng-geheim", await missing.Content.ReadAsStringAsync());

        // the owner is simply let in
        var owner = await SignInAsync(Role.Designer);
        var open = await owner.GetAsync($"/Zugriff/design/{design}");
        Assert.Equal(HttpStatusCode.Redirect, open.StatusCode);
        Assert.Equal($"/Designs/{design}/Designer", open.Headers.Location!.OriginalString);

        // the request through the API: an unknown kind is a message, a request is stored
        var bad = await PostJsonAsync(stranger, "/api/access-requests", new { kind = "nonsense", id = design, permission = "view" });
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
        var sent = await PostJsonAsync(stranger, "/api/access-requests", new { kind = "design", id = design, permission = "edit", message = "Bitte." });
        Assert.Equal(HttpStatusCode.OK, sent.StatusCode);
        var list = await owner.GetFromJsonAsync<JsonElement>($"/api/access-requests?kind=design&id={design}");
        Assert.Equal(1, list.GetArrayLength());
        Assert.Equal("edit", list[0].GetProperty("permission").GetString());
        // the stranger cannot read the list of requests of the item
        Assert.True((await stranger.GetAsync($"/api/access-requests?kind=design&id={design}")).StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task The_presence_endpoint_lists_the_people_with_the_design_open_and_refuses_strangers()
    {
        if (!Enabled)
        {
            return;
        }

        await using var gate = await WithAdministratorAsync();
        var design = await DesignAsync(Role.Designer, "Zu zweit");
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer, SharePermission.View);
        var owner = await SignInAsync(Role.Designer);
        var viewer = await SignInAsync(Role.Viewer);
        var stranger = await SignInAsync(Role.Stranger);

        var first = await (await PostJsonAsync(owner, $"/api/designs/{design}/presence", new { })).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, first.GetProperty("people").GetArrayLength());
        var second = await (await PostJsonAsync(viewer, $"/api/designs/{design}/presence", new { })).Content.ReadFromJsonAsync<JsonElement>();
        var people = second.GetProperty("people").EnumerateArray().ToList();
        Assert.Equal(2, people.Count);
        Assert.Contains(people, p => p.GetProperty("you").GetBoolean() && !p.GetProperty("editing").GetBoolean());
        Assert.Contains(people, p => !p.GetProperty("you").GetBoolean() && p.GetProperty("editing").GetBoolean());
        Assert.Equal(HttpStatusCode.NotFound, (await PostJsonAsync(stranger, $"/api/designs/{design}/presence", new { })).StatusCode);

        var left = await (await PostJsonAsync(viewer, $"/api/designs/{design}/presence", new { leave = true })).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, left.GetProperty("people").GetArrayLength());
    }
}
