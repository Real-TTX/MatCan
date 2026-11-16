using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using DesignThix.Catalogs;
using DesignThix.Catalogs.Providers;
using DesignThix.Core.Documents;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.Tests.Core;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DesignThix.Tests.Integration;

/// <summary>
/// Plan 5, Unsplash (docs/PLAN-CATALOGS.md "Unsplash status"): the one catalogue whose rules demand hotlinked pictures, a download message and linked credits. Against a fake that answers in the shapes of
/// the documentation (https://unsplash.com/documentation, verified 2026-11-01); no test talks to Unsplash: the <see cref="CatalogTestSeam"/> answers for the real host names.
/// </summary>
[Collection("app")]
public sealed class CatalogUnsplashTests(AppTests.AppFactory factory) : PlatformTestBase(factory)
{
    private const string Key = "unsplash-geheim-4713";

    private const string Rocks = "LBI7cgq3pbM";

    private const string Cheese = "Pd3xKq9aZtW";

    private const string Plus = "Q7mTz4VbN1c";

    private const string FarHost = "FarHost12345";

    private const string HttpOnly = "HttpOnly1234";

    private const string Hidden = "NoHost1234567";

    private static readonly byte[] Image = File.ReadAllBytes(Path.Combine(RepoFiles.WwwRoot(), "img", "icon-192.png"));

    private CatalogTestSeam Seam => Factory.Services.GetRequiredService<CatalogTestSeam>();

    private CatalogServices Svc => Factory.Services.GetRequiredService<CatalogServices>();

    /// <summary>Lets a test answer a request itself; null = the normal fake answers.</summary>
    private Func<HttpRequestMessage, HttpResponseMessage?>? _hook;

    // ------------------------------------------------------------------------------------------------ the fake Unsplash

    private static HttpResponseMessage Json(JsonNode node, int remaining = 47)
    {
        var response = new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(node.ToJsonString(), Encoding.UTF8, "application/json") };
        response.Headers.TryAddWithoutValidation("X-Ratelimit-Limit", "50");
        response.Headers.TryAddWithoutValidation("X-Ratelimit-Remaining", remaining.ToString());
        return response;
    }

    private static HttpResponseMessage Png() => new(HttpStatusCode.OK) { Content = new ByteArrayContent(Image) { Headers = { ContentType = new MediaTypeHeaderValue("image/png") } } };

    private static string Query(HttpRequestMessage request, string name) => System.Web.HttpUtility.ParseQueryString(request.RequestUri!.Query)[name] ?? "";

    private static string Authorization(HttpRequestMessage request) => request.Headers.TryGetValues("Authorization", out var values) ? values.First() : "";

    private static JsonObject UsPhoto(string id, string? alt, string name, string username, string? description = null, bool premium = false, string host = "images.unsplash.com", string scheme = "https")
    {
        string Img(string extra) => $"{scheme}://{host}/photo-{id}?ixid=M3wxfake{id}&ixlib=rb-4.1.0{extra}";
        return new JsonObject
        {
            ["id"] = id,
            ["slug"] = "foto-" + id,
            ["created_at"] = "2024-05-14T08:21:11Z",
            ["width"] = 5245,
            ["height"] = 3497,
            ["color"] = "#8c7a66",
            ["blur_hash"] = "LGF5]+Yk^6#M@-5c,1J5@[or[Q6.",
            ["description"] = description,
            ["alt_description"] = alt,
            ["premium"] = premium,
            ["urls"] = new JsonObject
            {
                ["raw"] = Img(""),
                ["full"] = Img("&q=85&fm=jpg&crop=entropy&cs=srgb"),
                ["regular"] = Img("&q=80&fm=jpg&w=1080&fit=max"),
                ["small"] = Img("&q=80&fm=jpg&w=400&fit=max"),
                ["thumb"] = Img("&q=80&fm=jpg&w=200&fit=max"),
            },
            ["links"] = new JsonObject
            {
                ["self"] = "https://api.unsplash.com/photos/" + id,
                ["html"] = "https://unsplash.com/photos/" + id,
                ["download"] = $"https://unsplash.com/photos/{id}/download?ixid=M3wxfake{id}",
                ["download_location"] = $"https://api.unsplash.com/photos/{id}/download?ixid=M3wxfake{id}",
            },
            ["user"] = new JsonObject
            {
                ["id"] = "u" + username,
                ["username"] = username,
                ["name"] = name,
                ["links"] = new JsonObject { ["self"] = "https://api.unsplash.com/users/" + username, ["html"] = "https://unsplash.com/@" + username },
            },
        };
    }

    private static readonly Dictionary<string, JsonObject> Photos = new()
    {
        [Rocks] = UsPhoto(Rocks, "brown rocks during golden hour", "Joey Farina", "joeyfarina"),
        [Cheese] = UsPhoto(Cheese, null, "Ben Beispiel", "ben_b", "Käseplatte auf Holz"),
        [Plus] = UsPhoto(Plus, "paid photo", "Pia Plus", "piaplus", premium: true),
        [FarHost] = UsPhoto(FarHost, "far away", "Frida Fremd", "frida", host: "evil.test"),
        [HttpOnly] = UsPhoto(HttpOnly, "plain http", "Hans Http", "hans", host: "images.unsplash.com", scheme: "http"),
    };

    private static JsonNode Copy(JsonObject o) => JsonNode.Parse(o.ToJsonString())!;

    private HttpResponseMessage Unsplash(HttpRequestMessage request)
    {
        if (Authorization(request) != "Client-ID " + Key)
        {
            return new HttpResponseMessage(HttpStatusCode.Unauthorized) { Content = new StringContent("""{"errors":["OAuth error: The access token is invalid"]}""") };
        }

        var path = request.RequestUri!.AbsolutePath;
        if (path == "/search/photos")
        {
            var words = Query(request, "query");
            if (words == "limit")
            {
                var limited = new HttpResponseMessage(HttpStatusCode.Forbidden) { Content = new StringContent("Rate Limit Exceeded") };
                limited.Headers.TryAddWithoutValidation("X-Ratelimit-Limit", "50");
                limited.Headers.TryAddWithoutValidation("X-Ratelimit-Remaining", "0");
                return limited;
            }

            if (words == "forbidden")
            {
                return new HttpResponseMessage(HttpStatusCode.Forbidden) { Content = new StringContent("""{"errors":["Missing permissions to perform request"]}""") };
            }

            if (words == "down")
            {
                return new HttpResponseMessage(HttpStatusCode.InternalServerError);
            }

            var found = Photos.Values.Where(p => words.Length == 0 || (p["alt_description"]?.GetValue<string>() ?? "").Contains(words, StringComparison.OrdinalIgnoreCase) || (p["description"]?.GetValue<string>() ?? "").Contains(words, StringComparison.OrdinalIgnoreCase)).ToList();
            return Json(new JsonObject { ["total"] = 10000, ["total_pages"] = 334, ["results"] = new JsonArray([.. found.Select(p => (JsonNode?)Copy(p))]) });
        }

        if (path == "/photos")
        {
            return Json(new JsonArray([.. Photos.Values.Select(p => (JsonNode?)Copy(p))]));
        }

        if (path == "/topics")
        {
            return Json(new JsonArray(
                new JsonObject { ["id"] = "a", ["slug"] = "nature", ["title"] = "Nature", ["total_photos"] = 14000, ["status"] = "open" },
                new JsonObject { ["id"] = "b", ["slug"] = "food-drink", ["title"] = "Food & Drink", ["total_photos"] = 5000, ["status"] = "open" },
                new JsonObject { ["id"] = "c", ["slug"] = "old-topic", ["title"] = "Beendet", ["total_photos"] = 4, ["status"] = "closed" },
                new JsonObject { ["id"] = "d", ["slug"] = "../photos", ["title"] = "Falscher Name", ["total_photos"] = 4, ["status"] = "open" }));
        }

        if (path.StartsWith("/topics/", StringComparison.Ordinal) && path.EndsWith("/photos", StringComparison.Ordinal))
        {
            return Json(new JsonArray([.. Photos.Values.Take(2).Select(p => (JsonNode?)Copy(p))]));
        }

        if (path.EndsWith("/download", StringComparison.Ordinal))
        {
            var id = path["/photos/".Length..^"/download".Length];
            return Photos.ContainsKey(id) ? Json(new JsonObject { ["url"] = $"https://images.unsplash.com/photo-{id}?dl=x" }) : new HttpResponseMessage(HttpStatusCode.NotFound);
        }

        if (path.StartsWith("/photos/", StringComparison.Ordinal))
        {
            var id = path["/photos/".Length..];
            return Photos.TryGetValue(id, out var photo) ? Json(Copy(photo)) : new HttpResponseMessage(HttpStatusCode.NotFound);
        }

        return new HttpResponseMessage(HttpStatusCode.NotFound);
    }

    private Task<HttpResponseMessage> Dispatch(HttpRequestMessage request, CancellationToken ct)
    {
        var answer = _hook?.Invoke(request);
        if (answer is not null)
        {
            return Task.FromResult(answer);
        }

        var response = request.RequestUri!.Host switch
        {
            "api.unsplash.com" => Unsplash(request),
            "images.unsplash.com" => Png(),
            "unsplash-fake.test" => request.RequestUri.AbsolutePath.StartsWith("/photo-", StringComparison.Ordinal) ? Png() : Unsplash(request),
            _ => new HttpResponseMessage(HttpStatusCode.NotFound),
        };
        return Task.FromResult(response);
    }

    // ------------------------------------------------------------------------------------------------ helpers

    private async Task ResetAsync()
    {
        Seam.Reset();
        _hook = null;
        Seam.Handler = Dispatch;
        Svc.Limiter.Reset();
        foreach (var catalog in Svc.Registry.All)
        {
            await Svc.Secrets.SaveAsync(catalog.Id, null);
        }

        await As(Role.Admin, async biz =>
        {
            await SettingLogic.SaveAsync(biz, SettingStore.Catalogs, new CatalogsSettings(), "Test");
            await CatalogLogic.ClearCacheAsync(biz);
        });
    }

    private Task EnableAsync(string? key = Key, int perMinute = 1000, int perHour = 1000, bool safe = true)
        => As(Role.Admin, async biz =>
        {
            await CatalogLogic.SaveAsync(biz, "unsplash", new CatalogInput(true, 0, perMinute, perHour, safe, [], []));
            if (key is not null)
            {
                await CatalogLogic.SetKeyAsync(biz, "unsplash", key, false);
            }
        });

    private Task DisableAsync()
        => As(Role.Admin, biz => CatalogLogic.SaveAsync(biz, "unsplash", new CatalogInput(false, 0, 1000, 1000, true, [], [])));

    private Task<CatalogPage> SearchAsync(string text = "", string collection = "", string orientation = "any", string colour = "", int page = 1, int perPage = 30)
        => As(Role.Designer, biz => CatalogLogic.SearchAsync(biz, "unsplash", new CatalogQuery { Text = text, Collection = collection, Orientation = orientation, Colour = colour, Page = page, PerPage = perPage }));

    private Task<CatalogImportResult> ImportAsync(string itemId, Role who = Role.Designer) => As(who, biz => CatalogLogic.ImportAsync(biz, "unsplash", itemId));

    private List<SeenRequest> Seen(string host) { lock (Seam.Requests) { return [.. Seam.Requests.Where(r => r.Url.Host == host)]; } }

    private List<SeenRequest> Pings() { lock (Seam.Requests) { return [.. Seam.Requests.Where(r => r.Url.AbsolutePath.EndsWith("/download", StringComparison.Ordinal))]; } }

    private static async Task<CatalogException> FailsAsync(Func<Task> action) => await Assert.ThrowsAsync<CatalogException>(action);

    private static string CspOf(HttpResponseMessage response) => string.Join(" ", response.Headers.TryGetValues("Content-Security-Policy", out var values) ? values : []);

    private async Task<(HttpClient Client, long DesignId)> SignedInWithADesignAsync()
    {
        var designer = await UserAsync(Role.Designer);
        var client = await SignInAsync(designer);
        var design = await As(Role.Designer, biz => DesignLogic.CreateFromFormatAsync(biz, "a4-portrait", null, null, null, "Csp " + Guid.NewGuid().ToString("N")[..6]));
        return (client, design.Id);
    }

    // ------------------------------------------------------------------------------------------------ the registry and the administration

    [Fact]
    public async Task Unsplash_is_in_the_registry_off_by_default_needs_a_key_and_names_its_image_host_for_hotlinking()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var catalog = Svc.Registry.Find("unsplash")!;
        Assert.False(catalog.EnabledByDefault);
        Assert.True(catalog.Caps.HasFlag(CatalogCaps.External | CatalogCaps.NeedsKey | CatalogCaps.Browse | CatalogCaps.Collections | CatalogCaps.Colour | CatalogCaps.Filters));
        Assert.Equal("https://api.unsplash.com", catalog.DefaultBaseUrl);
        Assert.Equal(["api.unsplash.com", "images.unsplash.com"], catalog.AllowedHosts);
        Assert.Equal(["images.unsplash.com"], catalog.HotlinkHosts);
        Assert.True(catalog.Info.LinkedCredit);
        Assert.NotEmpty(catalog.Info.Rules!);
        // the other catalogues keep their thumbnails behind the proxy: no hosts to hotlink
        Assert.All(Svc.Registry.All.Where(c => c.Id != "unsplash"), c => Assert.Empty(c.HotlinkHosts));

        Assert.DoesNotContain("unsplash", (await As(Role.Designer, biz => CatalogLogic.ListAsync(biz))).Select(r => r.Id));
        await EnableAsync(key: null);
        Assert.DoesNotContain("unsplash", (await As(Role.Designer, biz => CatalogLogic.ListAsync(biz))).Select(r => r.Id));   // on, but no key
        await As(Role.Admin, biz => CatalogLogic.SetKeyAsync(biz, "unsplash", Key, false));
        Assert.Contains("unsplash", (await As(Role.Designer, biz => CatalogLogic.ListAsync(biz))).Select(r => r.Id));
    }

    [Fact]
    public async Task The_administration_page_says_what_unsplash_requires_and_what_the_browser_will_do()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await using var admins = await RealAdminsAsync();
        var admin = await SignInAsync(admins.Ids[0]);
        var page = System.Net.WebUtility.HtmlDecode(await admin.GetStringAsync("/Admin/Catalogs/Edit?id=unsplash"));
        Assert.Contains("Wenn Unsplash eingeschaltet ist, lädt dein Browser die Vorschaubilder direkt von Unsplash. Unsplash sieht dabei deine IP-Adresse", page);
        Assert.Contains("images.unsplash.com", page);
        Assert.Contains("Access Key", page);
        Assert.Contains("https://unsplash.com/oauth/applications", page);
        Assert.Contains("50 Anfragen pro Stunde", page);
        Assert.Contains("Production", page);
        Assert.Contains("utm_source=DesignThix&utm_medium=referral", page);
        Assert.Contains("download_location", page);
        Assert.Contains("Safe Search", page);                          // content_filter
        Assert.DoesNotContain("Erlaubte Lizenzen", page);               // one licence only
        Assert.Contains("Datenschutz: Vorschaubilder direkt vom Anbieter", page);

        // another provider has no such card
        var pexels = await admin.GetStringAsync("/Admin/Catalogs/Edit?id=pexels");
        Assert.DoesNotContain("Datenschutz: Vorschaubilder direkt vom Anbieter", pexels);
        // the overview names the one exception
        Assert.Contains("Unsplash", System.Net.WebUtility.HtmlDecode(await admin.GetStringAsync("/Admin/Catalogs")));
    }

    // ------------------------------------------------------------------------------------------------ search: hotlinked thumbnails and attribution

    [Fact]
    public async Task A_search_sends_the_documented_request_with_the_key_in_the_header_and_never_downloads_or_pings()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync();
        var page = await SearchAsync("rocks", orientation: "square", colour: "turquoise", page: 2, perPage: 50);
        Assert.Equal([Rocks], page.Items.Select(i => i.Id));
        Assert.True(page.HasMore);
        Assert.Equal(10000, page.Total);

        var request = Assert.Single(Seen("api.unsplash.com"));
        Assert.Equal("/search/photos", request.Url.AbsolutePath);
        Assert.Equal("Client-ID " + Key, request.Headers["Authorization"]);
        Assert.Equal("v1", request.Headers["Accept-Version"]);
        var query = System.Web.HttpUtility.ParseQueryString(request.Url.Query);
        Assert.Equal("rocks", query["query"]);
        Assert.Equal("2", query["page"]);
        Assert.Equal("30", query["per_page"]);             // at most 30 at Unsplash
        Assert.Equal("squarish", query["orientation"]);   // our "square"
        Assert.Equal("teal", query["color"]);              // our "turquoise"
        Assert.Equal("high", query["content_filter"]);     // safe search is on
        Assert.Equal("relevant", query["order_by"]);
        Assert.DoesNotContain(Key, request.Url.ToString());   // the key is a header, never part of an address

        // a search is no download: nobody is told, nothing is fetched from the image host
        Assert.Empty(Pings());
        Assert.Empty(Seen("images.unsplash.com"));

        // safe search off, a colour or format the provider does not know never reaches it
        Seam.Requests.Clear();
        await EnableAsync(safe: false);
        await SearchAsync("rocks", orientation: "diagonal", colour: "red&evil=1");
        var plain = System.Web.HttpUtility.ParseQueryString(Assert.Single(Seen("api.unsplash.com")).Url.Query);
        Assert.Equal("low", plain["content_filter"]);
        Assert.Null(plain["orientation"]);
        Assert.Null(plain["color"]);
        Assert.Null(plain["evil"]);
    }

    private static string Query(Uri url, string name) => System.Web.HttpUtility.ParseQueryString(url.Query)[name] ?? "";

    [Fact]
    public async Task The_thumbnails_are_the_addresses_of_the_api_themselves_hotlinked_with_their_ixid_and_the_credit_has_utm_links()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync();
        var page = await SearchAsync();
        // the Unsplash+ photo, the one on another host and the one with a plain http address are not offered
        Assert.Equal([Rocks, Cheese], page.Items.Select(i => i.Id));
        var first = page.Items[0];
        Assert.Equal("https://images.unsplash.com/photo-LBI7cgq3pbM?ixid=M3wxfakeLBI7cgq3pbM&ixlib=rb-4.1.0&q=80&fm=jpg&w=400&fit=max", first.Thumb);   // not a token of the proxy: the browser loads it
        Assert.DoesNotContain("/api/catalogs/thumb/", first.Thumb);
        Assert.Contains("ixid=", first.Thumb);
        Assert.Equal("Brown rocks during golden hour", first.Title);
        Assert.Equal("Joey Farina", first.Author);
        Assert.Equal("https://unsplash.com/@joeyfarina?utm_source=DesignThix&utm_medium=referral", first.AuthorUrl);
        Assert.Equal("https://unsplash.com/photos/LBI7cgq3pbM?utm_source=DesignThix&utm_medium=referral", first.SourceUrl);
        Assert.Equal(("Unsplash", true), (first.Licence!.Code, first.Licence.AttributionRequired));
        Assert.Equal("https://unsplash.com/license", first.Licence.Url);
        Assert.Equal((5245, 3497), (first.Width, first.Height));
        Assert.Equal("Käseplatte auf Holz", page.Items[1].Title);   // no short description: the photographer's own words
        Assert.Equal("https://unsplash.com/@ben_b?utm_source=DesignThix&utm_medium=referral", page.Items[1].AuthorUrl);

        // nothing was fetched from the image host by the server for a thumbnail (the browser does)
        Assert.Empty(Seen("images.unsplash.com"));
    }

    [Theory]
    [InlineData("https://unsplash.com/@x?foo=bar#a", "https://unsplash.com/@x?utm_source=DesignThix&utm_medium=referral")]
    [InlineData("https://unsplash.com/", "https://unsplash.com/?utm_source=DesignThix&utm_medium=referral")]
    [InlineData("https://www.unsplash.com/photos/abc", "https://www.unsplash.com/photos/abc?utm_source=DesignThix&utm_medium=referral")]
    [InlineData("https://evil.test/@x", "")]
    [InlineData("https://unsplash.com.evil.test/@x", "")]
    [InlineData("http://unsplash.com/@x", "")]
    [InlineData("javascript:alert(1)", "")]
    [InlineData("", "")]
    public void Links_to_unsplash_carry_the_utm_parameters_and_only_unsplash_gets_one(string given, string expected)
        => Assert.Equal(expected, UnsplashCatalog.Link(given));

    [Fact]
    public async Task A_picture_address_on_another_host_with_plain_http_or_with_credentials_is_never_a_thumbnail()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync();
        var bad = new[] { "https://evil.test/a.jpg", "http://images.unsplash.com/a.jpg", "https://user:pw@images.unsplash.com/a.jpg", "https://images.unsplash.com.evil.test/a.jpg", "https://api.unsplash.com/photos/x", "ftp://images.unsplash.com/a.jpg", "/api/catalogs/thumb/x", "javascript:alert(1)", "https://images.unsplash.com/a.jpg?x=" + new string('a', 700) };
        _hook = r =>
        {
            if (r.RequestUri!.AbsolutePath != "/photos")
            {
                return null;
            }

            var list = new JsonArray();
            var n = 0;
            foreach (var url in bad)
            {
                var photo = UsPhoto("Bad" + (++n).ToString().PadLeft(8, '0'), "bad", "Bad", "bad");
                var urls = photo["urls"]!.AsObject();
                foreach (var name in new[] { "raw", "full", "regular", "small", "thumb" })
                {
                    urls[name] = url;
                }

                list.Add(photo);
            }

            list.Add(UsPhoto("Fine1234567", "fine", "Fine", "fine"));
            return Json(list);
        };
        var page = await SearchAsync();
        Assert.Equal(["Fine1234567"], page.Items.Select(i => i.Id));
    }

    [Fact]
    public async Task The_first_page_is_the_editorial_feed_the_collections_are_the_open_topics_and_a_topic_is_browsed_with_its_orientation()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync();
        var collections = await As(Role.Designer, biz => CatalogLogic.CollectionsAsync(biz, "unsplash"));
        Assert.Equal(["nature", "food-drink"], collections.Select(c => c.Id));   // the closed topic and the topic with an odd slug are not offered; "Alle" is the editorial feed
        Assert.Equal("Nature", collections[0].Name);
        Assert.Equal(14000, collections[0].Count);

        Seam.Requests.Clear();
        var first = await SearchAsync();
        Assert.Equal([Rocks, Cheese], first.Items.Select(i => i.Id));
        var feed = Assert.Single(Seen("api.unsplash.com"));
        Assert.Equal("/photos", feed.Url.AbsolutePath);
        Assert.Equal("latest", Query(feed.Url, "order_by"));
        Assert.False(first.HasMore);   // three photos of ten are listed (two are left out), but the raw page was not full: nothing more

        Seam.Requests.Clear();
        var topic = await SearchAsync(collection: "nature", orientation: "portrait");
        Assert.Equal(2, topic.Items.Count);
        var topicRequest = Assert.Single(Seen("api.unsplash.com"));
        Assert.Equal("/topics/nature/photos", topicRequest.Url.AbsolutePath);
        Assert.Equal("portrait", Query(topicRequest.Url, "orientation"));

        // an odd collection id is checked, not pasted into an address
        Seam.Requests.Clear();
        Assert.Empty((await SearchAsync(collection: "../v1/search")).Items);
        Assert.Empty((await SearchAsync(collection: "nature/../../photos/x")).Items);
        Assert.Empty(Seam.Requests);

        // the editorial feed has no format filter: it is applied to the page (all test photos are landscape)
        Assert.Empty((await SearchAsync(orientation: "portrait")).Items);
        Assert.Equal(2, (await SearchAsync(orientation: "landscape")).Items.Count);
    }

    [Fact]
    public async Task Answers_are_cached_for_an_hour_not_a_day_and_the_cache_never_holds_the_key()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync();
        await SearchAsync("rocks");
        await SearchAsync("rocks");
        Assert.Single(Seen("api.unsplash.com"));   // the second one comes from the cache

        var rows = await Db(db => db.CatalogCacheEntry.AsNoTracking().Where(e => e.Catalog == "unsplash").ToListAsync());
        var row = Assert.Single(rows);
        Assert.InRange((row.ExpiresDate - DateTime.UtcNow).TotalMinutes, 55, 61);
        Assert.DoesNotContain(Key, row.ResponseJson);
        Assert.DoesNotContain(Key, row.KeyHash);
    }

    // ------------------------------------------------------------------------------------------------ the import and the download message

    [Fact]
    public async Task Choosing_a_photo_tells_unsplash_with_the_key_and_the_ixid_and_copies_the_file_into_the_library_with_author_licence_and_links()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync();
        var imported = await ImportAsync(Cheese);
        Assert.False(imported.Reused);
        Assert.StartsWith("kaeseplatte-auf-holz", imported.Asset.Key);
        Assert.Equal("Katalog: Unsplash", imported.Asset.Category);

        // 1. the details of the photo, 2. the download message (download_location with its ixid, the key in the header), 3. the file from the image host (no key)
        var api = Seen("api.unsplash.com");
        Assert.Equal(["/photos/" + Cheese, $"/photos/{Cheese}/download"], api.Select(r => r.Url.AbsolutePath));
        var ping = Assert.Single(Pings());
        Assert.Equal("Client-ID " + Key, ping.Headers["Authorization"]);
        Assert.Equal("M3wxfake" + Cheese, Query(ping.Url, "ixid"));
        Assert.Equal("https", ping.Url.Scheme);
        var file = Assert.Single(Seen("images.unsplash.com"));
        Assert.False(file.Headers.ContainsKey("Authorization"));   // the key goes to the API only
        Assert.Equal("M3wxfake" + Cheese, Query(file.Url, "ixid"));      // the ixid stays on every address
        Assert.Equal("2400", Query(file.Url, "w"));
        Assert.Equal("max", Query(file.Url, "fit"));
        Assert.Equal("jpg", Query(file.Url, "fm"));
        Assert.Equal("85", Query(file.Url, "q"));

        var row = await Db(db => db.Asset.AsNoTracking().Where(a => a.Id == imported.Asset.Id).Select(a => a.SourceJson).SingleAsync());
        using var source = JsonDocument.Parse(row!);
        var e = source.RootElement;
        Assert.Equal("unsplash", e.GetProperty("catalog").GetString());
        Assert.Equal(Cheese, e.GetProperty("itemId").GetString());
        Assert.Equal("Ben Beispiel", e.GetProperty("author").GetString());
        Assert.Equal("https://unsplash.com/@ben_b?utm_source=DesignThix&utm_medium=referral", e.GetProperty("authorUrl").GetString());
        Assert.Equal($"https://unsplash.com/photos/{Cheese}?utm_source=DesignThix&utm_medium=referral", e.GetProperty("sourceUrl").GetString());
        Assert.Equal("Unsplash", e.GetProperty("licence").GetProperty("code").GetString());
        Assert.Equal("https://unsplash.com/license", e.GetProperty("licence").GetProperty("url").GetString());
        Assert.True(e.GetProperty("licence").GetProperty("attributionRequired").GetBoolean());
        Assert.Equal("Foto von Ben Beispiel auf Unsplash", e.GetProperty("attribution").GetString());
        Assert.DoesNotContain(Key, row);
    }

    [Fact]
    public async Task The_assistant_s_import_goes_the_same_way_so_it_pings_too()
    {
        if (!Enabled)
        {
            return;
        }

        // the tool import_from_catalog calls CatalogLogic.ImportItemAsync (read in AiDesignTools.Stock.cs): the ping lives below it
        await ResetAsync();
        await EnableAsync();
        var imported = await As(Role.Designer, biz => CatalogLogic.ImportItemAsync(biz, "unsplash", Rocks));
        Assert.Equal("picture", imported.Kind);
        Assert.Single(Pings());
        Assert.Single(Seen("images.unsplash.com"));
    }

    [Fact]
    public async Task Using_the_same_photo_again_is_told_again_but_downloads_nothing_a_second_time()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync();
        var first = await ImportAsync(Rocks);
        var again = await ImportAsync(Rocks);
        Assert.True(again.Reused);
        Assert.Equal(first.Asset.Id, again.Asset.Id);
        Assert.Equal(2, Pings().Count);                         // every use is a download for Unsplash
        Assert.Single(Seen("images.unsplash.com"));             // the copy is in the library
        Assert.All(Pings(), p => Assert.Equal("M3wxfake" + Rocks, Query(p.Url, "ixid")));

        // a pause of the provider never stops the use of an image that is in the library
        Svc.Limiter.Block(Svc.Registry.Find("unsplash")!, 120);
        Assert.True((await ImportAsync(Rocks)).Reused);
        Assert.Equal(2, Pings().Count);
    }

    [Fact]
    public async Task A_failing_download_message_never_fails_the_import_and_a_file_that_cannot_be_fetched_leaves_no_image()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync();
        var before = await Db(db => db.Asset.CountAsync(a => a.SourceJson != null));
        _hook = r => r.RequestUri!.AbsolutePath.EndsWith("/download", StringComparison.Ordinal) ? new HttpResponseMessage(HttpStatusCode.InternalServerError) : null;
        var imported = await ImportAsync(Rocks);
        Assert.False(imported.Reused);
        Assert.Single(Pings());   // it was tried once, never retried

        // a limit at the message is swallowed too
        _hook = r => r.RequestUri!.AbsolutePath.EndsWith("/download", StringComparison.Ordinal) ? new HttpResponseMessage(HttpStatusCode.Forbidden) { Content = new StringContent("Rate Limit Exceeded") } : null;
        Assert.False((await ImportAsync(Cheese)).Reused);
        Assert.Equal(before + 2, await Db(db => db.Asset.CountAsync(a => a.SourceJson != null)));

        // the limit at the message paused the API (not the image host); the pause is over
        Assert.Equal(CatalogFailure.Limit, (await FailsAsync(() => SearchAsync("rocks"))).Failure);
        Svc.Limiter.Reset();

        // the file itself is what the person needs: without it nothing is imported
        Seam.Requests.Clear();
        await As(Role.Admin, biz => CatalogLogic.ClearCacheAsync(biz));
        await Db(db => db.Database.ExecuteSqlAsync($"""DELETE FROM "Asset" WHERE "SourceJson"->>'catalog' = 'unsplash'"""));
        var gone = await Db(db => db.Asset.CountAsync(a => a.SourceJson != null));
        _hook = r => r.RequestUri!.Host == "images.unsplash.com" ? new HttpResponseMessage(HttpStatusCode.InternalServerError) : null;
        Assert.Equal(CatalogFailure.Unavailable, (await FailsAsync(() => ImportAsync(Rocks))).Failure);
        Assert.Equal(gone, await Db(db => db.Asset.CountAsync(a => a.SourceJson != null)));
    }

    [Fact]
    public async Task The_address_of_the_message_is_built_from_the_api_address_and_the_id_and_only_plain_query_pairs_are_kept()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync();
        string? given = null;
        _hook = r =>
        {
            if (r.RequestUri!.AbsolutePath != "/photos/" + Rocks)
            {
                return null;
            }

            var photo = (JsonObject)Copy(Photos[Rocks]);
            photo["links"]!["download_location"] = given;
            return Json(photo);
        };

        // what the answer says, and the ixid that must reach Unsplash (null = none): the first round downloads, the others reuse the image and are only told
        var rounds = new (string? Given, string? Ixid)[]
        {
            ($"https://evil.test/photos/{Rocks}/download?ixid=abc123", "abc123"),            // another host: ignored, the API address of the catalogue is used
            ($"https://api.unsplash.com/photos/{Rocks}/download?ixid=M3w_x-9.Q~z", "M3w_x-9.Q~z"),   // plain pairs stay
            ("https://api.unsplash.com/photos/OtherPhoto1/download?ixid=zzz", null),      // another photo's endpoint: the query is not trusted
            ($"https://api.unsplash.com/photos/{Rocks}/download?ixid=<script>", null),     // not plain
            ($"https://api.unsplash.com/photos/{Rocks}/download?ixid={new string('a', 700)}", null),   // too long
            ("javascript:alert(1)", null),
            ("", null),
            (null, null),
        };
        foreach (var (answer, ixid) in rounds)
        {
            Seam.Requests.Clear();
            await As(Role.Admin, biz => CatalogLogic.ClearCacheAsync(biz));   // the details are read again
            given = answer;
            await ImportAsync(Rocks);
            var ping = Assert.Single(Pings());
            Assert.Equal("api.unsplash.com", ping.Url.Host);
            Assert.Equal("https", ping.Url.Scheme);
            Assert.Equal($"/photos/{Rocks}/download", ping.Url.AbsolutePath);
            Assert.Equal(ixid, ping.Url.Query.Length == 0 ? null : Query(ping.Url, "ixid"));
            Assert.Equal("Client-ID " + Key, ping.Headers["Authorization"]);
            Assert.DoesNotContain(Seam.Requests, r => r.Url.Host == "evil.test");
        }
    }

    [Theory]
    [InlineData("../photos")]
    [InlineData("LBI7cgq3pbM/../../topics")]
    [InlineData("LBI7cgq3pbM?x=1")]
    [InlineData("LBI7cgq3pbM#a")]
    [InlineData("https://evil.test/x.jpg")]
    [InlineData("LBI7cgq3pbM%2f..")]
    [InlineData("abc")]
    [InlineData("a b c d e f")]
    [InlineData("LBI7cgq3pbM/download")]
    public async Task An_item_id_that_tries_to_change_the_address_asks_nobody_and_imports_nothing(string crafted)
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync();
        await Assert.ThrowsAsync<BizException>(() => ImportAsync(crafted));
        Assert.Empty(Seam.Requests);
    }

    [Fact]
    public async Task A_paid_photo_or_one_whose_file_is_not_a_picture_cannot_be_imported()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync();
        // an Unsplash+ photo asked for by its id: refused before anything is downloaded
        await FailsAsync(() => ImportAsync(Plus));
        Assert.Empty(Seen("images.unsplash.com"));
        Assert.Empty(Pings());

        // the "picture" is a web page
        _hook = r => r.RequestUri!.Host == "images.unsplash.com" ? new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("<html><script>alert(1)</script></html>", Encoding.UTF8, "image/jpeg") } : null;
        await Assert.ThrowsAsync<BizException>(() => ImportAsync(Rocks));

        // the image host sends the file somewhere else
        _hook = r => r.RequestUri!.Host == "images.unsplash.com" ? new HttpResponseMessage(HttpStatusCode.Found) { Headers = { Location = new Uri("https://evil.test/steal.jpg") } } : null;
        Assert.Equal(CatalogFailure.Refused, (await FailsAsync(() => ImportAsync(Rocks))).Failure);
        Assert.DoesNotContain(Seam.Requests, r => r.Url.Host == "evil.test");
    }

    // ------------------------------------------------------------------------------------------------ limits, pauses, the key

    [Fact]
    public async Task A_403_that_says_rate_limit_exceeded_is_a_pause_and_no_other_403_is()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync();
        var limited = await FailsAsync(() => SearchAsync("limit"));
        Assert.Equal(CatalogFailure.Limit, limited.Failure);
        Assert.InRange(limited.RetryAfterSeconds, 60, 3600);
        Assert.Contains("bremst gerade", limited.Message);
        Assert.DoesNotContain(Key, limited.Message);
        Assert.Single(Seen("api.unsplash.com"));

        // everybody is turned away without asking again, searches and imports (a reuse has no pause to wait for: it is local)
        Assert.Equal(CatalogFailure.Limit, (await FailsAsync(() => SearchAsync("rocks"))).Failure);
        Assert.Equal(CatalogFailure.Limit, (await FailsAsync(() => ImportAsync(Rocks))).Failure);
        Assert.Single(Seen("api.unsplash.com"));
        Assert.Empty(Seen("images.unsplash.com"));

        // over the endpoint: 429 with Retry-After
        await using var admins = await RealAdminsAsync();
        var client = await SignInAsync(await UserAsync(Role.Designer));
        var response = await client.GetAsync("/api/catalogs/unsplash/search?q=rocks");
        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        Assert.NotNull(response.Headers.RetryAfter);

        // a 403 that is a refusal (missing permissions) is the key, not a pause
        Svc.Limiter.Reset();
        var refused = await FailsAsync(() => SearchAsync("forbidden"));
        Assert.Equal(CatalogFailure.Key, refused.Failure);
        Assert.DoesNotContain(Key, refused.Message);
        Svc.Limiter.Reset();
        Assert.Single((await SearchAsync("rocks")).Items);   // and nothing is paused
    }

    [Fact]
    public async Task The_wrong_key_is_a_message_for_the_administrator_and_is_never_shown()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("falscher-schluessel-997");
        var wrong = await FailsAsync(() => SearchAsync("rocks"));
        Assert.Equal(CatalogFailure.Key, wrong.Failure);
        Assert.DoesNotContain("falscher-schluessel-997", wrong.Message);
        Assert.Contains("Schlüssel", wrong.Message);
    }

    [Fact]
    public async Task The_message_and_the_details_count_for_the_hourly_budget_of_the_key_and_an_empty_budget_is_a_german_message()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync(perHour: 3);
        await SearchAsync("rocks");            // 1
        await ImportAsync(Rocks);              // 2 (details) + 3 (the message)
        Assert.Equal(3, Seen("api.unsplash.com").Count);
        var spent = await FailsAsync(() => SearchAsync("kaese"));
        Assert.Equal(CatalogFailure.Limit, spent.Failure);
        Assert.Contains("genug Anfragen", spent.Message);
        Assert.Equal(3, Seen("api.unsplash.com").Count);
        Assert.Single(Seen("images.unsplash.com"));   // image files are not API requests: they do not count
    }

    [Fact]
    public async Task What_unsplash_reports_about_its_limit_is_remembered_and_shown_to_the_administrator()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync();
        await SearchAsync("rocks");
        var rate = Svc.Limiter.RateOf("unsplash")!;
        Assert.Equal((50, 47), (rate.Limit, rate.Remaining));
        await using var admins = await RealAdminsAsync();
        var admin = await SignInAsync(admins.Ids[0]);
        Assert.Contains("noch 47 von 50", System.Net.WebUtility.HtmlDecode(await admin.GetStringAsync("/Admin/Catalogs/Edit?id=unsplash")));
    }

    [Fact]
    public async Task A_provider_that_is_down_is_a_german_message_and_never_a_server_error()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await using var admins = await RealAdminsAsync();
        await EnableAsync();
        var client = await SignInAsync(await UserAsync(Role.Designer));
        var response = await client.GetAsync("/api/catalogs/unsplash/search?q=down");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        var error = JsonNode.Parse(await response.Content.ReadAsStringAsync())!["error"]!.GetValue<string>();
        Assert.Contains("nicht erreichbar", error);
        Assert.DoesNotContain(Key, error);

        _hook = _ => throw new HttpRequestException("No connection could be made (api.unsplash.com:443) Authorization: Client-ID " + Key);
        var refused = await FailsAsync(() => SearchAsync("x"));
        Assert.DoesNotContain(Key, refused.Message);
    }

    [Fact]
    public async Task The_key_is_in_no_page_no_answer_and_no_flash_of_the_app()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await using var admins = await RealAdminsAsync();
        await EnableAsync();
        var admin = await SignInAsync(admins.Ids[0]);
        var member = await SignInAsync(await UserAsync(Role.Designer));
        var search = await member.GetStringAsync("/api/catalogs/unsplash/search?q=rocks");
        var list = await member.GetStringAsync("/api/catalogs");
        var editPage = await admin.GetStringAsync("/Admin/Catalogs/Edit?id=unsplash");
        var overview = await admin.GetStringAsync("/Admin/Catalogs");
        foreach (var text in new[] { search, list, editPage, overview })
        {
            Assert.DoesNotContain(Key, text);
        }

        // the test of the administration page names the result, not the key
        var result = await As(Role.Admin, biz => CatalogLogic.TestAsync(biz, "unsplash"));
        Assert.StartsWith("Verbindung steht", result);
        Assert.DoesNotContain(Key, result);
        Assert.Contains("\"hotlinked\":true", list);
        Assert.Contains("\"linkedCredit\":true", list);

        // what the app writes down about an import and about the settings holds no key either
        await ImportAsync(Rocks);
        var activity = await Db(db => db.ActivityLog.AsNoTracking().Select(l => l.Action + " " + l.Summary + " " + l.EntityType).ToListAsync());
        Assert.Contains(activity, a => a.Contains("Katalog", StringComparison.Ordinal));
        Assert.DoesNotContain(activity, a => a.Contains(Key, StringComparison.Ordinal));
        var settings = await Db(db => db.Setting.AsNoTracking().Select(x => x.Value).ToListAsync());
        Assert.DoesNotContain(settings, v => v.Contains(Key, StringComparison.Ordinal));
        var assets = await Db(db => db.Asset.AsNoTracking().Where(a => a.SourceJson != null).Select(a => a.SourceJson!).ToListAsync());
        Assert.DoesNotContain(assets, v => v.Contains(Key, StringComparison.Ordinal));
    }

    // ------------------------------------------------------------------------------------------------ the network rules are unchanged

    [Fact]
    public async Task The_hosts_of_unsplash_are_plain_names_and_no_other_catalogue_may_reach_them()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var unsplash = Svc.Registry.Find("unsplash")!;
        Assert.All(unsplash.AllowedHosts, h => Assert.Matches("^[a-z0-9.-]+$", h));
        foreach (var other in Svc.Registry.All.Where(c => c.Id is "pexels" or "pixabay" or "openverse" or "iconify" or "googlefonts"))
        {
            Assert.Throws<CatalogException>(() => CatalogHttp.Check(new Uri("https://images.unsplash.com/photo-1"), Svc.AllowedHosts(other), false, other.Name));
        }

        // and Unsplash itself reaches only its two hosts, https only
        CatalogHttp.Check(new Uri("https://images.unsplash.com/photo-1"), Svc.AllowedHosts(unsplash), false, unsplash.Name);
        foreach (var bad in new[] { "http://images.unsplash.com/a", "https://images.pexels.com/a", "https://unsplash.com/a", "https://localhost/a", "https://127.0.0.1/a", "https://images.unsplash.com@evil.test/a", "https://u:p@images.unsplash.com/a" })
        {
            Assert.Throws<CatalogException>(() => CatalogHttp.Check(new Uri(bad), Svc.AllowedHosts(unsplash), false, unsplash.Name));
        }
    }

    [Fact]
    public async Task The_operator_s_address_makes_a_test_installation_possible_and_its_host_is_the_only_extra_one()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var unsplash = Svc.Registry.Find("unsplash")!;
        Assert.Equal(["images.unsplash.com"], Svc.HotlinkHosts(unsplash));
        Seam.BaseUrls["unsplash"] = "http://unsplash-fake.test:3084";
        Assert.Equal(["images.unsplash.com", "unsplash-fake.test"], Svc.HotlinkHosts(unsplash));
        Assert.True(Svc.AllowsHttp(unsplash));
        await EnableAsync();
        // the fake serves its pictures from its own host over plain http; a plain http address of the REAL host is still no thumbnail
        _hook = r =>
        {
            if (r.RequestUri!.Host != "unsplash-fake.test" || r.RequestUri.AbsolutePath != "/photos")
            {
                return null;
            }

            return Json(new JsonArray(
                UsPhoto("FakeHost1234", "from the fake", "Fia Fake", "fia", host: "unsplash-fake.test:3084", scheme: "http"),
                UsPhoto("RealHttp1234", "real host over http", "Rea Real", "rea", host: "images.unsplash.com", scheme: "http"),
                UsPhoto("RealHttps123", "real host", "Rea Real", "rea")));
        };
        var page = await SearchAsync();
        Assert.Equal(["FakeHost1234", "RealHttps123"], page.Items.Select(i => i.Id));
        Assert.Equal("http://unsplash-fake.test:3084/photo-FakeHost1234?ixid=M3wxfakeFakeHost1234&ixlib=rb-4.1.0&q=80&fm=jpg&w=400&fit=max", page.Items[0].Thumb);
        Assert.StartsWith("https://images.unsplash.com/", page.Items[1].Thumb);
        Assert.Contains("http://unsplash-fake.test:3084", Svc.HotlinkOrigins());
        Assert.Contains("https://images.unsplash.com", Svc.HotlinkOrigins());
    }

    // ------------------------------------------------------------------------------------------------ the content security policy

    private const string Plain = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'";

    [Fact]
    public async Task The_content_security_policy_is_unchanged_while_unsplash_is_off_or_has_no_key()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await using var admins = await RealAdminsAsync();
        var (client, design) = await SignedInWithADesignAsync();
        foreach (var url in new[] { $"/Designs/{design}/Designer", $"/Designs/{design}/Print", "/Brand", "/", "/Designs", "/Account/Login" })
        {
            var response = await client.GetAsync(url);
            Assert.Equal(Plain, CspOf(response));
        }

        await EnableAsync(key: null);   // on, but without a key: not offered, so not allowed
        Assert.Equal(Plain, CspOf(await client.GetAsync($"/Designs/{design}/Designer")));
        Assert.Empty(Svc.HotlinkOrigins());

        // on and keyed, then off again: back to the plain policy at once
        await EnableAsync();
        Assert.Contains("https://images.unsplash.com", CspOf(await client.GetAsync($"/Designs/{design}/Designer")));
        await DisableAsync();
        Assert.Equal(Plain, CspOf(await client.GetAsync($"/Designs/{design}/Designer")));
    }

    [Fact]
    public async Task While_unsplash_is_on_only_the_image_source_of_the_editor_pages_of_a_signed_in_person_gains_its_host()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await using var admins = await RealAdminsAsync();
        await EnableAsync();
        var (client, design) = await SignedInWithADesignAsync();
        var widened = Plain.Replace("img-src 'self' data: blob:", "img-src 'self' data: blob: https://images.unsplash.com", StringComparison.Ordinal);
        var list = await As(Role.Designer, async biz => (await DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput("Csp-Liste " + Guid.NewGuid().ToString("N")[..6], null, false))).Id);
        foreach (var url in new[] { $"/Designs/{design}/Designer", $"/Designs/{design}/Print", "/Brand", $"/DataLists/Edit/{list}" })
        {
            var response = await client.GetAsync(url);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(widened, CspOf(response));   // nothing else of the policy changes
        }

        // every other page, a script, an API answer, the sign-in, the pages of the file browser stay as they were
        foreach (var url in new[] { "/", "/Designs", "/Projekte", "/Templates", "/Assets", "/Account/Profile", "/api/catalogs", "/js/dt-media.js", "/Admin/Catalogs" })
        {
            Assert.Equal(Plain, CspOf(await client.GetAsync(url)));
        }

        using var anonymous = Factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        foreach (var url in new[] { "/Account/Login", $"/Designs/{design}/Designer", "/Brand" })
        {
            Assert.Equal(Plain, CspOf(await anonymous.GetAsync(url)));   // nobody who is signed out
        }

        // the public view never gets it, whoever looks at it
        var link = await As(Role.Designer, biz => ShareLogic.SetLinkAsync(biz, ItemKind.Design, design, LinkAudience.Public, SharePermission.View, false, null));
        Assert.Equal(Plain, CspOf(await anonymous.GetAsync("/s/" + link.Token)));
        Assert.Equal(Plain, CspOf(await client.GetAsync("/s/" + link.Token)));
        Assert.Equal(Plain, CspOf(await anonymous.GetAsync("/api/s/" + link.Token)));
    }

    [Theory]
    [InlineData("/Designs/12/Designer", true)]
    [InlineData("/designs/12/designer", true)]
    [InlineData("/Designs/12/Designer/", true)]
    [InlineData("/Designs/12/Print", true)]
    [InlineData("/Brand", true)]
    [InlineData("/Teams/mein-team/Marke", true)]
    [InlineData("/DataLists/Edit/5", true)]
    [InlineData("/DataLists/Edit", true)]
    [InlineData("/s/abc", false)]
    [InlineData("/api/s/abc", false)]
    [InlineData("/Designs", false)]
    [InlineData("/Designs/12", false)]
    [InlineData("/Designs/12/Designer/x", false)]
    [InlineData("/Designs/abc/Designer", false)]
    [InlineData("/Teams/mein-team/Projekte", false)]
    [InlineData("/Account/Login", false)]
    [InlineData("/Einladung/abc", false)]
    [InlineData("/", false)]
    [InlineData("/media/x", false)]
    public void The_pages_that_show_the_media_browser_are_a_closed_list(string path, bool expected)
        => Assert.Equal(expected, CatalogCsp.NeedsHotlinks(new PathString(path)));

    [Fact]
    public void The_policy_is_only_widened_in_the_one_directive_and_an_empty_list_changes_nothing()
    {
        Assert.Equal(Plain, CatalogCsp.WithOrigins(Plain, []));
        var widened = CatalogCsp.WithOrigins(Plain, ["https://images.unsplash.com", "http://127.0.0.1:3084"]);
        Assert.Contains("img-src 'self' data: blob: https://images.unsplash.com http://127.0.0.1:3084;", widened);
        Assert.Equal(Plain, widened.Replace(" https://images.unsplash.com http://127.0.0.1:3084", "", StringComparison.Ordinal));
    }

    [Fact]
    public async Task A_response_that_has_its_own_policy_keeps_it()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await using var admins = await RealAdminsAsync();
        await EnableAsync();
        var (client, _) = await SignedInWithADesignAsync();
        // the thumbnails of the proxy and the library files send their own policy: never widened (and they are no pages of the list anyway)
        var asset = await As(Role.Designer, async biz => (await AssetLogic.UploadAsync(biz, "eigen-" + Guid.NewGuid().ToString("N")[..6] + ".png", Image, null)).Asset!);
        var response = await client.GetAsync("/media/" + asset.Key);
        Assert.DoesNotContain("images.unsplash.com", CspOf(response));
    }

    // ------------------------------------------------------------------------------------------------ credits

    [Fact]
    public async Task The_credits_of_the_editor_and_of_the_public_view_name_the_photographer_and_unsplash_with_links()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await using var admins = await RealAdminsAsync();
        await EnableAsync();
        var photo = await ImportAsync(Rocks);
        var design = await As(Role.Designer, async biz =>
        {
            var created = await DesignLogic.CreateFromFormatAsync(biz, "a4-portrait", null, null, null, "Mit Unsplash " + Guid.NewGuid().ToString("N")[..6]);
            var doc = JsonNode.Parse(DocumentValidator.ToJson(DocumentValidator.Create(100, 100, "mm")))!;
            ((JsonArray)doc["pages"]![0]!["elements"]!).Add(JsonNode.Parse($$$"""{"id":"i1","type":"image","x":10,"y":10,"w":40,"h":30,"source":{"asset":"{{{photo.Asset.Key}}}"}}"""));
            await DesignLogic.SaveDocumentAsync(biz, created.Id, 1, doc.ToJsonString());
            return created.Id;
        });

        var credits = await As(Role.Designer, biz => CatalogLogic.CreditsAsync(biz, design));
        var credit = Assert.Single(credits);
        Assert.Equal("Unsplash", credit.CatalogName);
        Assert.Equal("Joey Farina", credit.Author);
        Assert.Equal("https://unsplash.com/@joeyfarina?utm_source=DesignThix&utm_medium=referral", credit.AuthorUrl);
        Assert.Equal("https://unsplash.com/?utm_source=DesignThix&utm_medium=referral", credit.CatalogUrl);
        Assert.Equal($"https://unsplash.com/photos/{Rocks}?utm_source=DesignThix&utm_medium=referral", credit.SourceUrl);
        Assert.Equal("Foto von Joey Farina auf Unsplash", credit.Attribution);
        Assert.Equal("Unsplash-Lizenz", credit.LicenceName);

        var client = await SignInAsync(await UserAsync(Role.Designer));
        var api = JsonNode.Parse(await client.GetStringAsync($"/api/designs/{design}/credits"))!["items"]!.AsArray();
        Assert.Equal("https://unsplash.com/?utm_source=DesignThix&utm_medium=referral", api[0]!["catalogUrl"]!.GetValue<string>());

        var link = await As(Role.Designer, biz => ShareLogic.SetLinkAsync(biz, ItemKind.Design, design, LinkAudience.Public, SharePermission.View, false, null));
        using var anonymous = Factory.CreateClient();
        var payload = JsonNode.Parse(await anonymous.GetStringAsync("/api/s/" + link.Token))!;
        var pub = Assert.Single(payload["credits"]!.AsArray())!;
        Assert.Equal("https://unsplash.com/?utm_source=DesignThix&utm_medium=referral", pub["catalogUrl"]!.GetValue<string>());
        Assert.Equal("Joey Farina", pub["author"]!.GetValue<string>());
        Assert.DoesNotContain(Key, payload.ToJsonString());
    }
}
