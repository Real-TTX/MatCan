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

/// <summary>
/// Nobody gets at somebody else's image by guessing its key (docs/PLAN-PLATFORM.md section 3): a key that is new in a design or a data list must be one the person may use, the address of an image only
/// carries its hash to people who may see it, <c>/media</c>, the thumbnails and the fonts serve with the hash (a capability, signed in or not) or to people who may see the thing, and
/// <c>/api/assets/resolve</c> only answers for what the item uses. The HTTP tests sign in through the real login page.
/// </summary>
[Collection("app")]
public sealed class KeyGuessingTests(AppTests.AppFactory factory) : PlatformTestBase(factory)
{
    private const string Password = "Passw0rd!Passw0rd";

    private static byte[] Png() => File.ReadAllBytes(Path.Combine(RepoFiles.WwwRoot(), "img", "icon-192.png"));

    private static string Unique(string prefix) => prefix + Guid.NewGuid().ToString("N")[..8];

    private static string DocumentWith(string asset) => DocumentValidator.ToJson(DocumentValidator.Create(100, 100) with
    {
        Pages = [DocumentValidator.Create(100, 100).Pages[0] with { Background = new BackgroundDef("#ffffff", null, asset, "cover") }],
    });

    private async Task<(long DesignId, string Key, string Hash)> DesignWithPrivateImageAsync(Role owner)
        => await As(owner, async biz =>
        {
            var upload = await AssetLogic.UploadAsync(biz, Unique("privat-") + ".png", Png(), null);
            var design = await DesignLogic.CreateFromFormatAsync(biz, "a4-portrait", null, null, null, "Mit Bild");
            await DesignLogic.SaveDocumentAsync(biz, design.Id, 1, DocumentWith(upload.Asset!.Key));
            return (design.Id, upload.Asset.Key, upload.Asset.ContentHash);
        });

    // ------------------------------------------------------------------------------------------------ saving

    [Fact]
    public async Task A_design_cannot_use_an_image_of_somebody_else_that_is_guessed_by_its_key()
    {
        if (!Enabled)
        {
            return;
        }

        var (_, key, _) = await DesignWithPrivateImageAsync(Role.Designer);
        await As(Role.Stranger, async biz =>
        {
            var mine = await DesignLogic.CreateFromFormatAsync(biz, "a4-portrait", null, null, null, "Meins");
            var refused = await Assert.ThrowsAsync<BizException>(() => DesignLogic.SaveDocumentAsync(biz, mine.Id, 1, DocumentWith(key)));
            Assert.Contains(key, refused.Message);
            Assert.Contains("nicht verfügbar", refused.Message);
            // a key that does not exist at all is refused the same way (nothing tells the two apart)
            var nobody = await Assert.ThrowsAsync<BizException>(() => DesignLogic.SaveDocumentAsync(biz, mine.Id, 1, DocumentWith("gibt-es-nicht-" + Guid.NewGuid().ToString("N")[..6])));
            Assert.Contains("nicht verfügbar", nobody.Message);
            // what is built in is for everybody
            await DesignLogic.SaveDocumentAsync(biz, mine.Id, 1, DocumentWith("flag-de"));
            // the copy after a conflict follows the same rule
            await Assert.ThrowsAsync<BizException>(() => DesignLogic.CopyWithDocumentAsync(biz, mine.Id, DocumentWith(key)));
        });
    }

    [Fact]
    public async Task An_image_that_an_item_the_person_may_view_uses_may_be_used_by_them_too()
    {
        if (!Enabled)
        {
            return;
        }

        var (design, key, _) = await DesignWithPrivateImageAsync(Role.Designer);
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer);
        await As(Role.Viewer, async biz =>
        {
            // pasting an element of a design that was shared with them: the image is theirs to see, so it may be in their own design
            var mine = await DesignLogic.CreateFromFormatAsync(biz, "a4-portrait", null, null, null, "Eingefügt");
            await DesignLogic.SaveDocumentAsync(biz, mine.Id, 1, DocumentWith(key));
            var refs = await AssetRefs.StoredAsync(biz.Db, ItemKind.Design, mine.Id);
            Assert.Contains(key, refs);
        });
        // when the share ends, a new design of the stranger still cannot take it
        await As(Role.Stranger, async biz =>
        {
            var mine = await DesignLogic.CreateFromFormatAsync(biz, "a4-portrait", null, null, null, "Meins");
            await Assert.ThrowsAsync<BizException>(() => DesignLogic.SaveDocumentAsync(biz, mine.Id, 1, DocumentWith(key)));
        });
    }

    [Fact]
    public async Task A_data_list_cannot_name_an_image_of_somebody_else_either()
    {
        if (!Enabled)
        {
            return;
        }

        var (_, key, _) = await DesignWithPrivateImageAsync(Role.Designer);
        await As(Role.Stranger, async biz =>
        {
            var list = await DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput("Bilder", null, false));
            await DataListLogic.SaveColumnsAsync(biz, list.Id, [new("Land", "Land", "image", null, null)]);
            var revision = (await DataListLogic.GetAsync(biz, list.Id))!.Revision;
            await Assert.ThrowsAsync<BizException>(() => DataListLogic.SaveRowsAsync(biz, list.Id, revision, [new GridRow(null, new Dictionary<string, string> { ["Land"] = key }, 1, true)]));
            await Assert.ThrowsAsync<BizException>(() => DataListLogic.ImportAsync(biz, list.Id, new DataListLogic.ImportRequest("Land\r\n" + key, true, ["Land"], false)));
            Assert.Equal(0, await DataListLogic.RowCountAsync(biz, list.Id));
            await DataListLogic.SaveRowsAsync(biz, list.Id, revision, [new GridRow(null, new Dictionary<string, string> { ["Land"] = "flag-de" }, 1, true)]);
        });
    }

    // ------------------------------------------------------------------------------------------------ resolving

    [Fact]
    public async Task Resolving_only_answers_for_what_the_item_uses_and_only_to_people_who_may_view_it()
    {
        if (!Enabled)
        {
            return;
        }

        var (design, key, hash) = await DesignWithPrivateImageAsync(Role.Designer);
        var other = await As(Role.Designer, async biz => (await AssetLogic.UploadAsync(biz, Unique("anderes-") + ".png", Png(), null)).Asset!.Key);

        await As(Role.Stranger, biz => Assert.ThrowsAsync<NotFoundException>(() => AssetRefs.ResolveAsync(biz, ItemKind.Design, design, [key])));
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer);
        await As(Role.Viewer, async biz =>
        {
            var resolved = await AssetRefs.ResolveAsync(biz, ItemKind.Design, design, [key, other, "flag-de", "FLAG-NL"]);
            Assert.Equal(new[] { key, "flag-de", "flag-nl" }.Order(StringComparer.Ordinal), resolved.Keys.Order(StringComparer.Ordinal));
            Assert.DoesNotContain(other, resolved.Keys);
            Assert.StartsWith($"/media/{key}?v={hash[..12]}", resolved[key].Url);
            // without the share the owner's other image stays hidden, with it only what the design uses is opened up
            Assert.Null(await AssetLogic.GetByKeyAsync(biz, key));
        });
    }

    // ------------------------------------------------------------------------------------------------ the capability: media, thumbnails and fonts (logic)

    [Fact]
    public async Task The_content_of_an_image_needs_the_hash_unless_the_person_may_see_it()
    {
        if (!Enabled)
        {
            return;
        }

        var (_, key, hash) = await DesignWithPrivateImageAsync(Role.Designer);
        await As(Role.Designer, async biz => Assert.NotNull((await AssetLogic.ContentAsync(biz, key, null))?.Bytes));
        await As(Role.Stranger, async biz =>
        {
            Assert.Null(await AssetLogic.ContentAsync(biz, key, null));
            Assert.Null(await AssetLogic.ContentAsync(biz, key, null, "0123456789ab"));
            Assert.Null(await AssetLogic.ContentAsync(biz, key, null, hash[..11]));
            Assert.NotNull((await AssetLogic.ContentAsync(biz, key, null, hash[..12]))?.Bytes);
        });
        // without a sign-in only the hash helps
        using var scope = Factory.Services.CreateScope();
        var anonymous = scope.ServiceProvider.GetRequiredService<Biz>();
        Assert.Null(await AssetLogic.ContentAsync(anonymous, key, null));
        Assert.NotNull(await AssetLogic.ContentAsync(anonymous, key, null, hash));
    }

    // ------------------------------------------------------------------------------------------------ HTTP

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

    /// <summary>The app sends everybody to the setup assistant while there is no administrator: an HTTP test makes one for its duration (and takes it away, the other tests ask for the first one).</summary>
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

    [Fact]
    public async Task Media_is_served_with_its_hash_to_anybody_and_without_it_only_to_people_who_may_see_it()
    {
        if (!Enabled)
        {
            return;
        }

        await using var gate = await WithAdministratorAsync();
        var (_, key, hash) = await DesignWithPrivateImageAsync(Role.Designer);
        var owner = await SignInAsync(Role.Designer);
        var stranger = await SignInAsync(Role.Stranger);
        var anonymous = Factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        var v = hash[..12];

        Assert.Equal(HttpStatusCode.OK, (await owner.GetAsync($"/media/{key}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/media/{key}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/media/{key}?v=000000000000")).StatusCode);
        var granted = await stranger.GetAsync($"/media/{key}?v={v}");
        Assert.Equal(HttpStatusCode.OK, granted.StatusCode);
        Assert.Contains("private", granted.Headers.CacheControl!.ToString());
        Assert.Equal("nosniff", granted.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync($"/media/{key}?v={v}")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync($"/media/{key}")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync($"/media/{key}?v=000000000000")).StatusCode);

        // what is built in is public knowledge: with the hash it may even be cached by everybody
        var flag = await Db(db => db.Asset.Where(a => a.Key == "flag-de").Select(a => a.ContentHash).FirstAsync());
        var builtIn = await anonymous.GetAsync($"/media/flag-de?v={flag[..12]}");
        Assert.Equal(HttpStatusCode.OK, builtIn.StatusCode);
        Assert.Contains("public", builtIn.Headers.CacheControl!.ToString());
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/media/flag-de")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await stranger.GetAsync("/media/flag-de")).StatusCode);
    }

    [Fact]
    public async Task Thumbnails_follow_the_same_rule_as_media()
    {
        if (!Enabled)
        {
            return;
        }

        await using var gate = await WithAdministratorAsync();
        var (design, _, _) = await DesignWithPrivateImageAsync(Role.Designer);
        await As(Role.Designer, biz => DesignLogic.SaveThumbnailAsync(biz, design, Png()));
        var hash = await Db(db => db.Design.Where(d => d.Id == design).Select(d => d.ThumbnailHash!).FirstAsync());
        var owner = await SignInAsync(Role.Designer);
        var stranger = await SignInAsync(Role.Stranger);
        var anonymous = Factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        Assert.Equal(HttpStatusCode.OK, (await owner.GetAsync($"/designs/{design}/thumbnail.png")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/designs/{design}/thumbnail.png")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/designs/{design}/thumbnail.png?v=000000000000")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await stranger.GetAsync($"/designs/{design}/thumbnail.png?v={hash[..12]}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync($"/designs/{design}/thumbnail.png?v={hash[..12]}")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync($"/designs/{design}/thumbnail.png")).StatusCode);
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Stranger);
        Assert.Equal(HttpStatusCode.OK, (await stranger.GetAsync($"/designs/{design}/thumbnail.png")).StatusCode);
    }

    [Fact]
    public async Task A_font_of_a_team_is_served_by_its_hash_and_listed_only_to_those_who_may_use_it()
    {
        if (!Enabled)
        {
            return;
        }

        await using var gate = await WithAdministratorAsync();
        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Viewer));
        var design = await As(Role.Designer, async biz => (await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign("Im Team", null, "a4-portrait", null, null, null, null, team))).Id);
        var font = await As(Role.Designer, async biz => (await FontLogic.UploadAsync(biz, "Teamschrift.ttf", [0, 1, 0, 0, 77, 2, 3, 4, 5, 6, 7, 8], null, team)).Font!);
        var anonymous = Factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        var address = FontLogic.Url(font.Id, font.ContentHash, font.Format);

        Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync(address)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"/fonts/{font.Id}-0000000000ab.ttf")).StatusCode);

        var stranger = await SignInAsync(Role.Stranger);
        var teamMember = await SignInAsync(Role.Viewer);
        var listOf = async (HttpClient client, string url) => (await client.GetFromJsonAsync<JsonElement>(url)).EnumerateArray().Select(f => f.GetProperty("family").GetString()).ToList();
        Assert.DoesNotContain(font.Family, await listOf(stranger, "/api/fonts"));
        Assert.Contains(font.Family, await listOf(teamMember, "/api/fonts"));
        // somebody the design was shared with gets the fonts of the design's area through the design
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Stranger);
        Assert.Contains(font.Family, await listOf(stranger, $"/api/fonts?design={design}"));
        Assert.Contains(font.Family, await stranger.GetStringAsync($"/fonts.css?design={design}"));
        Assert.DoesNotContain(font.Family, await stranger.GetStringAsync("/fonts.css"));
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/api/fonts?design={design + 99999}")).StatusCode);
    }

    [Fact]
    public async Task The_api_answers_404_for_what_is_not_visible_and_403_for_what_may_only_be_looked_at()
    {
        if (!Enabled)
        {
            return;
        }

        await using var gate = await WithAdministratorAsync();
        var (design, key, _) = await DesignWithPrivateImageAsync(Role.Designer);
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer);
        var stranger = await SignInAsync(Role.Stranger);
        var viewer = await SignInAsync(Role.Viewer);

        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/api/designs/{design}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/api/assets/resolve?context=design:{design}&keys={key}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await PostJsonAsync(stranger, $"/api/designs/{design}", new { revision = 1, document = new { } })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/api/share/design/{design}")).StatusCode);

        var loaded = await viewer.GetFromJsonAsync<JsonElement>($"/api/designs/{design}");
        Assert.False(loaded.GetProperty("canEdit").GetBoolean());
        Assert.Equal(HttpStatusCode.Forbidden, (await PostJsonAsync(viewer, $"/api/designs/{design}", new { revision = 1, document = new { } })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await PostJsonAsync(viewer, $"/api/designs/{design}/delete", new { })).StatusCode);
        var resolved = await viewer.GetFromJsonAsync<JsonElement>($"/api/assets/resolve?context=design:{design}&keys={key}");
        Assert.Contains("?v=", resolved.GetProperty(key).GetProperty("url").GetString());

        // the browser's list only shows what the person may see
        var items = await stranger.GetFromJsonAsync<JsonElement>("/api/items?recursive=true&q=Mit%20Bild");
        Assert.Equal(0, items.GetProperty("total").GetInt32());
        var seen = await viewer.GetFromJsonAsync<JsonElement>("/api/items?scope=shared");
        Assert.Contains(seen.GetProperty("items").EnumerateArray(), i => i.GetProperty("id").GetInt64() == design);
    }
}
