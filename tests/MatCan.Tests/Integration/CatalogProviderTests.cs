using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using MatCan.Catalogs;
using MatCan.Catalogs.Providers;
using MatCan.Configuration;
using MatCan.Core.Documents;
using MatCan.Data.Entities;
using MatCan.Logic;
using MatCan.Tests.Core;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MatCan.Tests.Integration;

/// <summary>
/// Plan 5, C2 (docs/PLAN-CATALOGS.md): the three catalogues on the internet, Pexels, Pixabay and Openverse, against fakes that answer in the shapes of the providers' documentation (checked against the
/// real answers of the documentation and, for Openverse, the public API on 2026-10-26). No test ever talks to a provider: the <see cref="CatalogTestSeam"/> answers for the real host names.
/// </summary>
[Collection("app")]
public sealed class CatalogProviderTests(AppTests.AppFactory factory) : PlatformTestBase(factory)
{
    private const string PexelsKey = "pexels-geheim-4711";

    private const string PixabayKey = "pixabay-geheim-4712";

    private static readonly byte[] Image = File.ReadAllBytes(Path.Combine(RepoFiles.WwwRoot(), "img", "icon-192.png"));

    private CatalogTestSeam Seam => Factory.Services.GetRequiredService<CatalogTestSeam>();

    private CatalogServices Svc => Factory.Services.GetRequiredService<CatalogServices>();

    /// <summary>Lets a test answer a request itself; null = the normal fake provider answers.</summary>
    private Func<HttpRequestMessage, HttpResponseMessage?>? _hook;

    // ------------------------------------------------------------------------------------------------ the fake providers

    private static HttpResponseMessage Json(JsonNode node) => new(HttpStatusCode.OK) { Content = new StringContent(node.ToJsonString(), Encoding.UTF8, "application/json") };

    private static HttpResponseMessage Png() => new(HttpStatusCode.OK) { Content = new ByteArrayContent(Image) { Headers = { ContentType = new MediaTypeHeaderValue("image/png") } } };

    private static HttpResponseMessage Status(HttpStatusCode code) => new(code);

    private static HttpResponseMessage Limited(int seconds, params (string Name, string Value)[] headers)
    {
        var response = new HttpResponseMessage((HttpStatusCode)429) { Headers = { RetryAfter = new RetryConditionHeaderValue(TimeSpan.FromSeconds(seconds)) } };
        foreach (var (name, value) in headers)
        {
            response.Headers.TryAddWithoutValidation(name, value);
        }

        return response;
    }

    private static string Query(HttpRequestMessage request, string name) => System.Web.HttpUtility.ParseQueryString(request.RequestUri!.Query)[name] ?? "";

    private static string Key(HttpRequestMessage request) => request.Headers.TryGetValues("Authorization", out var values) ? values.First() : "";

    private Task<HttpResponseMessage> Dispatch(HttpRequestMessage request, CancellationToken ct)
    {
        var answer = _hook?.Invoke(request);
        if (answer is not null)
        {
            return Task.FromResult(answer);
        }

        var url = request.RequestUri!;
        var response = url.Host switch
        {
            "api.pexels.com" => Pexels(request),
            "images.pexels.com" => Png(),
            "pixabay.com" => Pixabay(request),
            "cdn.pixabay.com" => Png(),
            "api.openverse.org" => Openverse(request),
            _ => Status(HttpStatusCode.NotFound),
        };
        return Task.FromResult(response);
    }

    // ---- Pexels: https://www.pexels.com/api/documentation/

    private static JsonObject PexelsPhoto(long id, string? alt, string photographer, string handle)
    {
        string Src(string query) => $"https://images.pexels.com/photos/{id}/pexels-photo-{id}.jpeg{query}";
        var photo = new JsonObject
        {
            ["id"] = id,
            ["width"] = 3024,
            ["height"] = 3024,
            ["url"] = $"https://www.pexels.com/photo/foto-{id}/",
            ["photographer"] = photographer,
            ["photographer_url"] = $"https://www.pexels.com/@{handle}",
            ["photographer_id"] = 680589,
            ["avg_color"] = "#978E82",
            ["src"] = new JsonObject
            {
                ["original"] = Src(""),
                ["large2x"] = Src("?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"),
                ["large"] = Src("?auto=compress&cs=tinysrgb&h=650&w=940"),
                ["medium"] = Src("?auto=compress&cs=tinysrgb&h=350"),
                ["small"] = Src("?auto=compress&cs=tinysrgb&h=130"),
                ["portrait"] = Src("?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800"),
                ["landscape"] = Src("?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"),
                ["tiny"] = Src("?auto=compress&cs=tinysrgb&dpr=1&fit=crop&h=200&w=280"),
            },
            ["liked"] = false,
        };
        if (alt is not null)
        {
            photo["alt"] = alt;
        }

        return photo;
    }

    private static readonly JsonObject[] PexelsPhotos =
    [
        PexelsPhoto(1001, "Brown Rocks During Golden Hour", "Joey Farina", "joey"),
        PexelsPhoto(1002, "Käseplatte auf Holz", "Ben Beispiel", "ben"),
        PexelsPhoto(1003, null, "Cem Probe", "cem"),
    ];

    private HttpResponseMessage Pexels(HttpRequestMessage request)
    {
        if (Key(request) != PexelsKey)
        {
            return Status(HttpStatusCode.Unauthorized);
        }

        var path = request.RequestUri!.AbsolutePath;
        var rate = new[] { ("X-Ratelimit-Limit", "20000"), ("X-Ratelimit-Remaining", "19876"), ("X-Ratelimit-Reset", DateTimeOffset.UtcNow.AddDays(9).ToUnixTimeSeconds().ToString()) };
        HttpResponseMessage Ok(JsonNode node)
        {
            var response = Json(node);
            foreach (var (name, value) in rate)
            {
                response.Headers.TryAddWithoutValidation(name, value);
            }

            return response;
        }

        JsonNode Photos(IEnumerable<JsonObject> list, string array = "photos")
        {
            var page = int.Parse(Query(request, "page").Length == 0 ? "1" : Query(request, "page"));
            var node = new JsonObject { [array] = new JsonArray([.. list.Select(p => (JsonNode?)JsonNode.Parse(p.ToJsonString()))]), ["page"] = page, ["per_page"] = 15, ["total_results"] = 3000 };
            node["next_page"] = $"https://api.pexels.com{path}?page={page + 1}&per_page=15";
            return node;
        }

        if (path == "/v1/curated")
        {
            return Ok(Photos(PexelsPhotos));
        }

        if (path == "/v1/search")
        {
            var words = Query(request, "query");
            if (words == "limit")
            {
                return Limited(120);
            }

            if (words == "down")
            {
                return Status(HttpStatusCode.InternalServerError);
            }

            if (words == "leer")
            {
                return Ok(new JsonObject { ["photos"] = new JsonArray(), ["page"] = 1, ["per_page"] = 15, ["total_results"] = 0 });
            }

            return Ok(Photos(PexelsPhotos.Where(p => words.Length == 0 || (p["alt"]?.GetValue<string>() ?? "").Contains(words, StringComparison.OrdinalIgnoreCase))));
        }

        if (path == "/v1/collections/featured")
        {
            return Ok(new JsonObject
            {
                ["collections"] = new JsonArray(
                    new JsonObject { ["id"] = "9mp14cx", ["title"] = "Cool Cats", ["description"] = null, ["private"] = false, ["media_count"] = 6, ["photos_count"] = 5, ["videos_count"] = 1 },
                    new JsonObject { ["id"] = "leer123", ["title"] = "Nichts drin", ["description"] = null, ["private"] = false, ["media_count"] = 0, ["photos_count"] = 0, ["videos_count"] = 0 },
                    new JsonObject { ["id"] = "geheim1", ["title"] = "Privat", ["description"] = null, ["private"] = true, ["media_count"] = 3, ["photos_count"] = 3, ["videos_count"] = 0 }),
                ["page"] = 1,
                ["per_page"] = 24,
                ["total_results"] = 3,
            });
        }

        if (path.StartsWith("/v1/collections/", StringComparison.Ordinal))
        {
            var media = new JsonArray();
            foreach (var p in PexelsPhotos.Take(2))
            {
                var node = JsonNode.Parse(p.ToJsonString())!.AsObject();
                node["type"] = "Photo";
                media.Add(node);
            }

            media.Add(new JsonObject { ["type"] = "Video", ["id"] = 9999, ["width"] = 1920, ["height"] = 1080, ["url"] = "https://www.pexels.com/video/x-9999/" });
            return Ok(new JsonObject { ["id"] = path["/v1/collections/".Length..], ["media"] = media, ["page"] = 1, ["per_page"] = 15, ["total_results"] = 3 });
        }

        if (path.StartsWith("/v1/photos/", StringComparison.Ordinal))
        {
            var id = path["/v1/photos/".Length..];
            var photo = PexelsPhotos.FirstOrDefault(p => p["id"]!.ToString() == id);
            return photo is null ? Status(HttpStatusCode.NotFound) : Ok(JsonNode.Parse(photo.ToJsonString())!);
        }

        return Status(HttpStatusCode.NotFound);
    }

    // ---- Pixabay: https://pixabay.com/api/docs/

    private static JsonObject PixabayHit(long id, string tags, string user, long userId, string type = "photo", bool fullHd = false)
    {
        var hit = new JsonObject
        {
            ["id"] = id,
            ["pageURL"] = $"https://pixabay.com/photos/bild-{id}/",
            ["type"] = type,
            ["tags"] = tags,
            ["previewURL"] = $"https://cdn.pixabay.com/photo/2013/10/15/09/12/bild-{id}_150.jpg",
            ["previewWidth"] = 150,
            ["previewHeight"] = 84,
            ["webformatURL"] = $"https://pixabay.com/get/g{id}_640.jpg",
            ["webformatWidth"] = 640,
            ["webformatHeight"] = 360,
            ["largeImageURL"] = $"https://pixabay.com/get/g{id}_1280.jpg",
            ["imageWidth"] = 4000,
            ["imageHeight"] = 2250,
            ["imageSize"] = 4731420,
            ["views"] = 7671,
            ["downloads"] = 6439,
            ["likes"] = 5,
            ["comments"] = 2,
            ["user_id"] = userId,
            ["user"] = user,
            ["userImageURL"] = "https://cdn.pixabay.com/user/2013/11/05/02-10-23-764_250x250.jpg",
        };
        if (fullHd)
        {
            hit["fullHDURL"] = $"https://pixabay.com/get/g{id}_1920.jpg";
        }

        return hit;
    }

    private static readonly JsonObject[] PixabayHits =
    [
        PixabayHit(195893, "blossom, bloom, flower", "Josch13", 48777),
        PixabayHit(73424, "kaese, käse, theke", "Anna & Co", 12),
        PixabayHit(500, "vektor, rahmen", "Vera", 99, "vector graphic"),
    ];

    private HttpResponseMessage Pixabay(HttpRequestMessage request)
    {
        var url = request.RequestUri!;
        if (url.AbsolutePath.StartsWith("/get/", StringComparison.Ordinal))
        {
            // the address of an image: a redirect to the CDN, once, as the real "get" addresses do
            return new HttpResponseMessage(HttpStatusCode.Found) { Headers = { Location = new Uri("https://cdn.pixabay.com/photo/2013/10/15/09/12/bild.jpg") } };
        }

        if (url.AbsolutePath != "/api/")
        {
            return Status(HttpStatusCode.NotFound);
        }

        if (Query(request, "key") != PixabayKey)
        {
            return new HttpResponseMessage(HttpStatusCode.BadRequest) { Content = new StringContent("[ERROR 400] Invalid or missing API key") };
        }

        var response = (HttpResponseMessage r) =>
        {
            r.Headers.TryAddWithoutValidation("X-RateLimit-Limit", "100");
            r.Headers.TryAddWithoutValidation("X-RateLimit-Remaining", "98");
            r.Headers.TryAddWithoutValidation("X-RateLimit-Reset", "42");
            return r;
        };
        var q = Query(request, "q");
        if (q == "limit")
        {
            return Limited(0, ("X-RateLimit-Reset", "55"));
        }

        if (q == "down")
        {
            return Status(HttpStatusCode.InternalServerError);
        }

        var id = Query(request, "id");
        IEnumerable<JsonObject> list = id.Length > 0 ? PixabayHits.Select(h => id == "195893" ? PixabayHit(195893, "blossom, bloom, flower", "Josch13", 48777, fullHd: true) : h).Where(h => h["id"]!.ToString() == id) : PixabayHits;
        if (q.Length > 0)
        {
            list = list.Where(h => h["tags"]!.GetValue<string>().Contains(q, StringComparison.OrdinalIgnoreCase));
        }

        var hits = list.ToList();
        return response(Json(new JsonObject { ["total"] = hits.Count * 100, ["totalHits"] = 500, ["hits"] = new JsonArray([.. hits.Select(h => (JsonNode?)JsonNode.Parse(h.ToJsonString()))]) }));
    }

    // ---- Openverse: https://api.openverse.org/v1/ (the answer of the real API, shortened)

    private const string OvBy = "f9e91269-933d-48bb-b437-5405732ffb9d";

    private const string OvSa = "d906b530-e1d3-4907-ad7e-2590fe266ca4";

    private const string OvCc0 = "11111111-1111-4111-8111-111111111111";

    private const string OvPdm = "22222222-2222-4222-8222-222222222222";

    private const string OvNc = "33333333-3333-4333-8333-333333333333";

    private const string OvNd = "44444444-4444-4444-8444-444444444444";

    private const string OvNcSa = "55555555-5555-4555-8555-555555555555";

    private const string OvOdd = "66666666-6666-4666-8666-666666666666";

    private static JsonObject OvResult(string id, string title, string creator, string license, string version, string source = "flickr")
        => new()
        {
            ["id"] = id,
            ["title"] = title,
            ["indexed_on"] = "2020-04-25T22:56:33.120466Z",
            ["foreign_landing_url"] = $"https://www.flickr.com/photos/32426344@N00/{id[..6]}",
            ["url"] = $"https://live.staticflickr.com/2691/{id[..6]}_b.jpg",
            ["creator"] = creator,
            ["creator_url"] = "https://www.flickr.com/photos/32426344@N00",
            ["license"] = license,
            ["license_version"] = version,
            ["license_url"] = $"https://creativecommons.org/licenses/{license}/{version}/",
            ["provider"] = source,
            ["source"] = source,
            ["category"] = "photograph",
            ["filesize"] = null,
            ["filetype"] = null,
            ["tags"] = new JsonArray(new JsonObject { ["name"] = "cheese", ["accuracy"] = null, ["unstable__provider"] = source }),
            ["attribution"] = $"\"{title}\" by {creator} is licensed under CC {license.ToUpperInvariant()} {version}.",
            ["fields_matched"] = new JsonArray("description", "title", "tags.name"),
            ["mature"] = false,
            ["height"] = 683,
            ["width"] = 1024,
            ["thumbnail"] = $"https://api.openverse.org/v1/images/{id}/thumb/",
            ["detail_url"] = $"https://api.openverse.org/v1/images/{id}/",
            ["related_url"] = $"https://api.openverse.org/v1/images/{id}/related/",
            ["unstable__sensitivity"] = new JsonArray(),
        };

    private static readonly JsonObject[] OvAll =
    [
        OvResult(OvBy, "cheeses", "_gee_", "by", "2.0"),
        OvResult(OvSa, "Cheese stall, Borough Market", "EEPaul", "by-sa", "4.0", "wikimedia"),
        OvResult(OvCc0, "Käse gemeinfrei", "Cem", "cc0", "1.0"),
        OvResult(OvPdm, "Old cheese", "Queensland State Archives", "pdm", "1.0"),
        OvResult(OvNc, "Nur privat", "Nina", "by-nc", "4.0"),
        OvResult(OvNd, "Unveränderbar", "Nils", "by-nd", "2.0"),
        OvResult(OvNcSa, "Nicht kommerziell teilen", "Nora", "by-nc-sa", "3.0"),
        OvResult(OvOdd, "Seltsame Lizenz", "Odd", "sampling+", "1.0"),
    ];

    private HttpResponseMessage Openverse(HttpRequestMessage request)
    {
        var url = request.RequestUri!;
        var path = url.AbsolutePath;
        if (path == "/v1/auth_tokens/token/")
        {
            var form = request.Content!.ReadAsStringAsync().Result;
            return form.Contains("client_id=cid") && form.Contains("client_secret=sec") && form.Contains("grant_type=client_credentials")
                ? Json(new JsonObject { ["access_token"] = "tok-abc", ["scope"] = "read", ["expires_in"] = 36000, ["token_type"] = "Bearer" })
                : Status(HttpStatusCode.Unauthorized);
        }

        HttpResponseMessage Limits(HttpResponseMessage r)
        {
            r.Headers.TryAddWithoutValidation("x-ratelimit-limit-anon_burst", "20/min");
            r.Headers.TryAddWithoutValidation("x-ratelimit-available-anon_burst", "19");
            r.Headers.TryAddWithoutValidation("x-ratelimit-limit-anon_sustained", "200/day");
            r.Headers.TryAddWithoutValidation("x-ratelimit-available-anon_sustained", "199");
            return r;
        }

        if (path == "/v1/images/")
        {
            var size = int.TryParse(Query(request, "page_size"), out var s) ? s : 20;
            var page = int.TryParse(Query(request, "page"), out var p) ? p : 1;
            if (size > 20)
            {
                return new HttpResponseMessage(HttpStatusCode.BadRequest) { Content = new StringContent("""{"detail":"page_size may not exceed 20 for anonymous requests"}""") };
            }

            if (size * page > 240)
            {
                return new HttpResponseMessage(HttpStatusCode.BadRequest) { Content = new StringContent("""{"detail":"pagination depth may not exceed 240 for anonymous requests"}""") };
            }

            var words = Query(request, "q");
            if (words == "limit")
            {
                return Limited(90);
            }

            if (words == "down")
            {
                return Status(HttpStatusCode.BadGateway);
            }

            // Openverse filters by licence itself; the word "leck" simulates a provider that lets everything through
            var allowed = Query(request, "license").Split(',', StringSplitOptions.RemoveEmptyEntries);
            var results = OvAll.Where(r => words == "leck" || (r["license"]!.GetValue<string>() is "by" or "by-sa" or "cc0" or "pdm" && (allowed.Length == 0 || allowed.Contains(r["license"]!.GetValue<string>())))).ToList();
            return Limits(Json(new JsonObject
            {
                ["result_count"] = 240,
                ["page_count"] = 12,
                ["page_size"] = size,
                ["page"] = page,
                ["results"] = new JsonArray([.. results.Select(r => (JsonNode?)JsonNode.Parse(r.ToJsonString()))]),
            }));
        }

        if (path.EndsWith("/thumb/", StringComparison.Ordinal))
        {
            return Limits(Png());
        }

        if (path.StartsWith("/v1/images/", StringComparison.Ordinal))
        {
            var id = path["/v1/images/".Length..].TrimEnd('/');
            var found = OvAll.FirstOrDefault(r => r["id"]!.GetValue<string>() == id);
            return found is null ? Status(HttpStatusCode.NotFound) : Limits(Json(JsonNode.Parse(found.ToJsonString())!));
        }

        return Status(HttpStatusCode.NotFound);
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

    private Task EnableAsync(string id, string? key = null, int perMinute = 1000, int perHour = 0, bool safe = true, IReadOnlyList<string>? licences = null)
        => As(Role.Admin, async biz =>
        {
            await CatalogLogic.SaveAsync(biz, id, new CatalogInput(true, 0, perMinute, perHour, safe, licences ?? [], []));
            if (key is not null)
            {
                await CatalogLogic.SetKeyAsync(biz, id, key, false);
            }
        });

    private Task<CatalogPage> SearchAsync(string catalog, string text = "", string collection = "", string orientation = "any", string colour = "", int page = 1, int perPage = 30, CatalogKinds? kind = null)
        => As(Role.Designer, biz => CatalogLogic.SearchAsync(biz, catalog, new CatalogQuery { Text = text, Collection = collection, Orientation = orientation, Colour = colour, Page = page, PerPage = perPage, Kind = kind }));

    private Task<CatalogImportResult> ImportAsync(string catalog, string itemId, Role who = Role.Designer)
        => As(who, biz => CatalogLogic.ImportAsync(biz, catalog, itemId));

    private List<SeenRequest> Seen(string host) { lock (Seam.Requests) { return [.. Seam.Requests.Where(r => r.Url.Host == host)]; } }

    private static async Task<CatalogException> FailsAsync(Func<Task> action) => await Assert.ThrowsAsync<CatalogException>(action);

    // ------------------------------------------------------------------------------------------------ the registry and the administration

    [Fact]
    public async Task The_three_providers_are_in_the_registry_off_by_default_and_need_what_they_need()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var ids = Svc.Registry.All.Select(c => c.Id).ToList();
        Assert.Contains("pexels", ids);
        Assert.Contains("pixabay", ids);
        Assert.Contains("openverse", ids);
        foreach (var id in new[] { "pexels", "pixabay", "openverse" })
        {
            var catalog = Svc.Registry.Find(id)!;
            Assert.False(catalog.EnabledByDefault);
            Assert.True(catalog.Caps.HasFlag(CatalogCaps.External));
            Assert.StartsWith("https://", catalog.DefaultBaseUrl);
            Assert.All(catalog.AllowedHosts, h => Assert.DoesNotContain("/", h));
            Assert.NotNull(catalog.Info.ProviderLink);
            Assert.NotEmpty(catalog.Info.Rules!);
            Assert.False(string.IsNullOrWhiteSpace(catalog.Info.Notice));
        }

        // Pexels and Pixabay need a key, Openverse works without one (and says so); only Pexels and Pixabay can browse
        Assert.True(Svc.Registry.Find("pexels")!.Caps.HasFlag(CatalogCaps.NeedsKey | CatalogCaps.Browse));
        Assert.True(Svc.Registry.Find("pixabay")!.Caps.HasFlag(CatalogCaps.NeedsKey | CatalogCaps.Browse));
        Assert.False(Svc.Registry.Find("openverse")!.Caps.HasFlag(CatalogCaps.NeedsKey));
        Assert.False(Svc.Registry.Find("openverse")!.Caps.HasFlag(CatalogCaps.Browse));

        Assert.DoesNotContain(await As(Role.Designer, biz => CatalogLogic.ListAsync(biz)), r => r.Catalog.Caps.HasFlag(CatalogCaps.External) && r.Id is "pexels" or "pixabay" or "openverse");
        await EnableAsync("pexels");
        await EnableAsync("pixabay");
        await EnableAsync("openverse");
        var listed = (await As(Role.Designer, biz => CatalogLogic.ListAsync(biz))).Select(r => r.Id).ToList();
        Assert.DoesNotContain("pexels", listed);    // switched on, but no key
        Assert.DoesNotContain("pixabay", listed);
        Assert.Contains("openverse", listed);       // no key needed
        await As(Role.Admin, biz => CatalogLogic.SetKeyAsync(biz, "pexels", PexelsKey, false));
        Assert.Contains("pexels", (await As(Role.Designer, biz => CatalogLogic.ListAsync(biz))).Select(r => r.Id));
    }

    [Fact]
    public async Task The_administration_shows_the_rules_the_key_help_and_where_the_provider_said_how_much_is_left()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await using var admins = await RealAdminsAsync();
        var admin = await SignInAsync(admins.Ids[0]);
        var index = await admin.GetStringAsync("/Admin/Catalogs");
        foreach (var name in new[] { "Pexels", "Pixabay", "Openverse" })
        {
            Assert.Contains(name, index);
        }

        var pexels = System.Net.WebUtility.HtmlDecode(await admin.GetStringAsync("/Admin/Catalogs/Edit?id=pexels"));
        Assert.Contains("Regeln und Grenzen des Anbieters", pexels);
        Assert.Contains("200 Anfragen pro Stunde", pexels);
        Assert.Contains("https://www.pexels.com/api/", pexels);
        Assert.Contains("Fotos von Pexels", pexels);
        Assert.DoesNotContain("Safe Search", pexels);          // Pexels has no safe search: the switch is not offered
        Assert.DoesNotContain("Erlaubte Lizenzen", pexels);

        var pixabay = System.Net.WebUtility.HtmlDecode(await admin.GetStringAsync("/Admin/Catalogs/Edit?id=pixabay"));
        Assert.Contains("24 Stunden zwischengespeichert", pixabay);
        Assert.Contains("Safe Search", pixabay);

        var openverse = System.Net.WebUtility.HtmlDecode(await admin.GetStringAsync("/Admin/Catalogs/Edit?id=openverse"));
        Assert.Contains("Zugangsdaten (optional)", openverse);
        Assert.Contains("Client-ID:Client-Secret", openverse);
        Assert.Contains("Erlaubte Lizenzen", openverse);

        // what the provider reports about its limits is shown once it has reported it
        await EnableAsync("pexels", PexelsKey);
        Assert.Contains("19876", System.Net.WebUtility.HtmlDecode(await SearchAndThenAdminPageAsync(admin)));
    }

    private async Task<string> SearchAndThenAdminPageAsync(HttpClient admin)
    {
        await SearchAsync("pexels");
        return await admin.GetStringAsync("/Admin/Catalogs/Edit?id=pexels");
    }

    // ------------------------------------------------------------------------------------------------ Pexels

    [Fact]
    public async Task Pexels_lists_the_curated_photos_the_featured_collections_and_reads_each_photo_with_care()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("pexels", PexelsKey);
        var collections = await As(Role.Designer, biz => CatalogLogic.CollectionsAsync(biz, "pexels"));
        Assert.Equal(["curated", "9mp14cx"], collections.Select(c => c.Id));    // the empty and the private collection are not offered
        Assert.Equal("Kuratiert", collections[0].Name);
        Assert.Equal(5, collections[1].Count);

        Seam.Requests.Clear();
        var page = await SearchAsync("pexels");
        Assert.Equal(["1001", "1002", "1003"], page.Items.Select(i => i.Id));
        Assert.True(page.HasMore);
        var first = page.Items[0];
        Assert.Equal("Brown Rocks During Golden Hour", first.Title);
        Assert.Equal("Joey Farina", first.Author);
        Assert.Equal("https://www.pexels.com/@joey", first.AuthorUrl);
        Assert.Equal("https://www.pexels.com/photo/foto-1001/", first.SourceUrl);
        Assert.Equal(("Pexels", false), (first.Licence!.Code, first.Licence.AttributionRequired));
        Assert.Equal("Foto von Cem Probe", page.Items[2].Title);   // no alt text: a title from the photographer

        // a page never shows an address of the provider: the thumbnails are tokens of this app
        Assert.All(page.Items, i => Assert.StartsWith("/api/catalogs/thumb/", i.Thumb));
        var request = Assert.Single(Seen("api.pexels.com"));
        Assert.Equal("/v1/curated", request.Url.AbsolutePath);
        Assert.Equal(PexelsKey, request.Headers["Authorization"]);
        Assert.DoesNotContain(PexelsKey, request.Url.ToString());   // the key is a header, never part of an address
    }

    [Fact]
    public async Task Pexels_search_passes_words_format_and_colour_and_a_collection_comes_without_its_videos()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("pexels", PexelsKey);
        var found = await SearchAsync("pexels", "rocks", orientation: "landscape", colour: "turquoise", page: 2, perPage: 80);
        Assert.Equal(["1001"], found.Items.Select(i => i.Id));
        var search = Assert.Single(Seen("api.pexels.com"));
        Assert.Equal("/v1/search", search.Url.AbsolutePath);
        var query = System.Web.HttpUtility.ParseQueryString(search.Url.Query);
        Assert.Equal("rocks", query["query"]);
        Assert.Equal("landscape", query["orientation"]);
        Assert.Equal("turquoise", query["color"]);
        Assert.Equal("de-DE", query["locale"]);
        Assert.Equal("2", query["page"]);
        Assert.Equal("50", query["per_page"]);    // never more than the 50 of every catalogue (Pexels would allow 80)

        // a colour or format that the filter does not know never reaches the provider
        Seam.Requests.Clear();
        await SearchAsync("pexels", "rocks", orientation: "diagonal", colour: "red&evil=1");
        var plain = System.Web.HttpUtility.ParseQueryString(Assert.Single(Seen("api.pexels.com")).Url.Query);
        Assert.Null(plain["orientation"]);
        Assert.Null(plain["color"]);
        Assert.Null(plain["evil"]);

        var inCollection = await SearchAsync("pexels", collection: "9mp14cx");
        Assert.Equal(["1001", "1002"], inCollection.Items.Select(i => i.Id));   // the video of the collection is left out
        Assert.Contains(Seen("api.pexels.com"), r => r.Url.AbsolutePath == "/v1/collections/9mp14cx" && r.Url.Query.Contains("type=photos"));
        Assert.Empty((await SearchAsync("pexels", collection: "../v1/search")).Items);   // a collection id is checked, not pasted into an address
    }

    [Fact]
    public async Task A_pexels_import_downloads_the_large_file_into_the_library_with_author_licence_and_credit()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("pexels", PexelsKey);
        var imported = await ImportAsync("pexels", "1002");
        Assert.False(imported.Reused);
        Assert.StartsWith("kaeseplatte-auf-holz", imported.Asset.Key);
        Assert.Equal("Katalog: Pexels", imported.Asset.Category);

        var cdn = Assert.Single(Seen("images.pexels.com"));
        Assert.Contains("dpr=2", cdn.Url.Query);   // large2x
        Assert.False(cdn.Headers.ContainsKey("Authorization"));   // the key goes to the API only

        var row = await Db(db => db.Asset.AsNoTracking().Where(a => a.Id == imported.Asset.Id).Select(a => a.SourceJson).SingleAsync());
        using var source = JsonDocument.Parse(row!);
        var e = source.RootElement;
        Assert.Equal("pexels", e.GetProperty("catalog").GetString());
        Assert.Equal("1002", e.GetProperty("itemId").GetString());
        Assert.Equal("Ben Beispiel", e.GetProperty("author").GetString());
        Assert.Equal("https://www.pexels.com/@ben", e.GetProperty("authorUrl").GetString());
        Assert.Equal("https://www.pexels.com/photo/foto-1002/", e.GetProperty("sourceUrl").GetString());
        Assert.Equal("Pexels", e.GetProperty("licence").GetProperty("code").GetString());
        Assert.Equal("https://www.pexels.com/license/", e.GetProperty("licence").GetProperty("url").GetString());
        Assert.Equal("Foto von Ben Beispiel auf Pexels", e.GetProperty("attribution").GetString());

        // the same photo again is the same image
        Assert.Equal(imported.Asset.Id, (await ImportAsync("pexels", "1002")).Asset.Id);
        Assert.Single(Seen("images.pexels.com"));
    }

    [Theory]
    [InlineData("../v1/search")]
    [InlineData("1001/../../v1/collections/featured")]
    [InlineData("1001?x=1")]
    [InlineData("1001#a")]
    [InlineData("https://evil.test/x.jpg")]
    [InlineData("1001%2f..")]
    [InlineData("-1")]
    [InlineData("12345678901234567890")]
    [InlineData("1 001")]
    public async Task An_item_id_that_tries_to_change_the_address_asks_nobody_and_imports_nothing(string crafted)
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("pexels", PexelsKey);
        await EnableAsync("pixabay", PixabayKey);
        await EnableAsync("openverse");
        foreach (var catalog in new[] { "pexels", "pixabay", "openverse" })
        {
            await Assert.ThrowsAsync<BizException>(() => ImportAsync(catalog, crafted));
        }

        Assert.Empty(Seam.Requests);
    }

    [Fact]
    public async Task A_picture_that_is_not_one_a_redirect_elsewhere_and_a_huge_file_are_refused_at_the_import()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("pexels", PexelsKey);
        var before = await Db(db => db.Asset.CountAsync(a => a.SourceJson != null));

        // the "image" is a web page
        _hook = r => r.RequestUri!.Host == "images.pexels.com" ? new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("<html><script>alert(1)</script></html>", Encoding.UTF8, "image/jpeg") } : null;
        await Assert.ThrowsAsync<BizException>(() => ImportAsync("pexels", "1001"));

        // the CDN sends the download to another host: refused, and nothing is asked there
        _hook = r => r.RequestUri!.Host == "images.pexels.com" ? new HttpResponseMessage(HttpStatusCode.Found) { Headers = { Location = new Uri("https://evil.test/steal.jpg") } } : null;
        var moved = await FailsAsync(() => ImportAsync("pexels", "1001"));
        Assert.Equal(CatalogFailure.Refused, moved.Failure);
        Assert.DoesNotContain(Seam.Requests, r => r.Url.Host == "evil.test");

        // a file that says it is larger than the cap is not read at all
        _hook = r => r.RequestUri!.Host == "images.pexels.com" ? new HttpResponseMessage(HttpStatusCode.OK) { Content = new StreamContent(Stream.Null) { Headers = { ContentLength = CatalogHttp.MaxDownloadBytes + 1, ContentType = new MediaTypeHeaderValue("image/jpeg") } } } : null;
        var huge = await FailsAsync(() => ImportAsync("pexels", "1001"));
        Assert.Equal(CatalogFailure.TooLarge, huge.Failure);

        Assert.Equal(before, await Db(db => db.Asset.CountAsync(a => a.SourceJson != null)));
    }

    [Fact]
    public async Task A_provider_that_is_down_or_does_not_answer_is_a_german_message_and_never_a_server_error()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await using var admins = await RealAdminsAsync();
        await EnableAsync("pexels", PexelsKey);
        await EnableAsync("pixabay", PixabayKey);
        await EnableAsync("openverse");
        var client = await SignInAsync(await UserAsync(Role.Designer));

        foreach (var (catalog, words) in new[] { ("pexels", "down"), ("pixabay", "down"), ("openverse", "down") })
        {
            var response = await client.GetAsync($"/api/catalogs/{catalog}/search?q={words}");
            Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
            var error = JsonNode.Parse(await response.Content.ReadAsStringAsync())!["error"]!.GetValue<string>();
            Assert.Contains("nicht erreichbar", error);
            Assert.DoesNotContain(PexelsKey, error);
            Assert.DoesNotContain(PixabayKey, error);
        }

        // no connection at all and a provider that is too slow
        _hook = _ => throw new HttpRequestException("No connection could be made because the target machine actively refused it. (api.pexels.com:443) key=" + PexelsKey);
        var refused = await FailsAsync(() => SearchAsync("pexels", "x"));
        Assert.Equal(CatalogFailure.Unavailable, refused.Failure);
        Assert.DoesNotContain(PexelsKey, refused.Message);
        _hook = _ => throw new TaskCanceledException("timeout");
        var slow = await FailsAsync(() => SearchAsync("pexels", "y"));
        Assert.Contains("nicht rechtzeitig", slow.Message);

        // the test of the administration page says it too
        _hook = r => r.RequestUri!.Host == "api.pexels.com" ? Status(HttpStatusCode.InternalServerError) : null;
        Assert.Contains("nicht erreichbar", await As(Role.Admin, biz => CatalogLogic.TestAsync(biz, "pexels")));
    }

    [Fact]
    public async Task A_429_with_Retry_After_is_waited_out_and_nothing_is_asked_meanwhile()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await using var admins = await RealAdminsAsync();
        await EnableAsync("pexels", PexelsKey);
        var limited = await FailsAsync(() => SearchAsync("pexels", "limit"));
        Assert.Equal((CatalogFailure.Limit, 120), (limited.Failure, limited.RetryAfterSeconds));
        Assert.Contains("bremst gerade", limited.Message);
        Assert.Contains("2 Minuten", limited.Message);
        Assert.Single(Seen("api.pexels.com"));

        // the next requests of anybody, searches, thumbnails and imports, are turned away without asking Pexels
        var again = await FailsAsync(() => SearchAsync("pexels", "rocks"));
        Assert.Equal(CatalogFailure.Limit, again.Failure);
        Assert.InRange(again.RetryAfterSeconds, 100, 120);
        Assert.Contains("bremst gerade", again.Message);
        Assert.Equal(CatalogFailure.Limit, (await FailsAsync(() => ImportAsync("pexels", "1001"))).Failure);
        Assert.Single(Seen("api.pexels.com"));
        Assert.Empty(Seen("images.pexels.com"));

        // over the endpoint it is a 429 with Retry-After
        var client = await SignInAsync(await UserAsync(Role.Designer));
        var response = await client.GetAsync("/api/catalogs/pexels/search?q=rocks");
        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        Assert.NotNull(response.Headers.RetryAfter);

        // the "Testen" of the administrator asks once more whatever was said before (and a provider that is fine ends the pause)
        Assert.Contains("Verbindung steht", await As(Role.Admin, biz => CatalogLogic.TestAsync(biz, "pexels")));
        Assert.Single((await SearchAsync("pexels", "rocks")).Items);
        Assert.Equal(3, Seen("api.pexels.com").Count);   // the search that hit the limit, the test, the search that works again
    }

    [Fact]
    public async Task What_the_provider_reports_about_its_limits_is_remembered_and_an_empty_window_closes_the_door()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("pexels", PexelsKey);
        await SearchAsync("pexels");
        var rate = Svc.Limiter.RateOf("pexels")!;
        Assert.Equal((20000, 19876), (rate.Limit, rate.Remaining));
        Assert.InRange(rate.ResetSeconds!.Value, 8 * 86400, 10 * 86400);   // a Unix time as Pexels sends it, as seconds from now

        // nothing left in the window: no request until it is over
        _hook = r => r.RequestUri!.Host == "api.pexels.com" ? WithRate(Json(new JsonObject { ["photos"] = new JsonArray(), ["total_results"] = 0 }), "X-Ratelimit-Remaining", "0", "X-Ratelimit-Reset", "20") : null;
        await SearchAsync("pexels", "a");
        _hook = null;
        var blocked = await FailsAsync(() => SearchAsync("pexels", "b"));
        Assert.Equal(CatalogFailure.Limit, blocked.Failure);
        Assert.Equal(2, Seen("api.pexels.com").Count);
    }

    private static HttpResponseMessage WithRate(HttpResponseMessage response, params string[] pairs)
    {
        for (var i = 0; i < pairs.Length; i += 2)
        {
            response.Headers.TryAddWithoutValidation(pairs[i], pairs[i + 1]);
        }

        return response;
    }

    [Fact]
    public async Task The_key_is_refused_with_a_message_that_does_not_contain_it()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("pexels", "falscher-schluessel-999");
        var wrong = await FailsAsync(() => SearchAsync("pexels"));
        Assert.Equal(CatalogFailure.Key, wrong.Failure);
        Assert.DoesNotContain("falscher-schluessel-999", wrong.Message);

        await EnableAsync("pixabay", "falscher-schluessel-998");
        var pixabay = await FailsAsync(() => SearchAsync("pixabay", "x"));
        Assert.Equal(CatalogFailure.Refused, pixabay.Failure);   // Pixabay answers 400 for a key it does not know
        Assert.DoesNotContain("falscher-schluessel-998", pixabay.Message);
        Assert.Contains("prüfe ihn", pixabay.Message);
    }

    // ------------------------------------------------------------------------------------------------ Pixabay

    [Fact]
    public async Task Pixabay_asks_in_german_with_the_settings_and_reads_the_hits()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("pixabay", PixabayKey);
        var collections = await As(Role.Designer, biz => CatalogLogic.CollectionsAsync(biz, "pixabay"));
        Assert.Equal("empfehlung", collections[0].Id);
        Assert.Contains(collections, c => c.Id == "food" && c.Name == "Essen");
        Assert.Empty(Seam.Requests);   // the categories are known: no request

        var page = await SearchAsync("pixabay", orientation: "landscape", colour: "violet", collection: "nature", perPage: 10);
        Assert.Equal(["195893", "73424", "500"], page.Items.Select(i => i.Id));
        Assert.True(page.HasMore);   // page 1 of 10 results of 500 reachable
        var request = Assert.Single(Seen("pixabay.com"));
        Assert.Equal("/api/", request.Url.AbsolutePath);
        var query = System.Web.HttpUtility.ParseQueryString(request.Url.Query);
        Assert.Equal(PixabayKey, query["key"]);
        Assert.Equal("de", query["lang"]);
        Assert.Equal("horizontal", query["orientation"]);
        Assert.Equal("lilac", query["colors"]);      // Pixabay calls violet "lilac"
        Assert.Equal("nature", query["category"]);
        Assert.Equal("true", query["safesearch"]);
        Assert.Equal("all", query["image_type"]);
        Assert.Equal("10", query["per_page"]);
        Assert.Null(query["q"]);                     // the first page of a category has no words

        var item = page.Items[1];
        Assert.Equal("Kaese, käse, theke", item.Title);
        Assert.Equal("Anna & Co", item.Author);
        Assert.Equal("https://pixabay.com/users/Anna%20%26%20Co-12/", item.AuthorUrl);
        Assert.Equal("https://pixabay.com/photos/bild-73424/", item.SourceUrl);
        Assert.Equal(CatalogKinds.Vector, page.Items[2].Kind);
        Assert.StartsWith("/api/catalogs/thumb/", item.Thumb);
        Assert.DoesNotContain("pixabay.com", item.Thumb);

        // safe search off, the kind chosen, the editor's choice
        Seam.Requests.Clear();
        await EnableAsync("pixabay", safe: false);
        await SearchAsync("pixabay", "wald", collection: "empfehlung", kind: CatalogKinds.Illustration);
        var other = System.Web.HttpUtility.ParseQueryString(Assert.Single(Seen("pixabay.com")).Url.Query);
        Assert.Null(other["safesearch"]);
        Assert.Equal("illustration", other["image_type"]);
        Assert.Equal("true", other["editors_choice"]);
        Assert.Equal("wald", other["q"]);
        Assert.Empty((await SearchAsync("pixabay", collection: "nature&key=x")).Items);   // a category is one of the known ones
    }

    [Fact]
    public async Task Pixabay_answers_are_cached_for_24_hours_and_the_key_is_not_in_the_cache()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("pixabay", PixabayKey);
        await SearchAsync("pixabay", "blossom");
        await SearchAsync("pixabay", "blossom");
        await SearchAsync("pixabay", "blossom");
        Assert.Single(Seen("pixabay.com"));   // asked once, the rest from the cache

        var entries = await Db(db => db.CatalogCacheEntry.AsNoTracking().Where(e => e.Catalog == "pixabay").ToListAsync());
        var entry = Assert.Single(entries);
        Assert.InRange((entry.ExpiresDate - DateTime.UtcNow).TotalHours, 23.5, 24.1);
        Assert.DoesNotContain(PixabayKey, entry.ResponseJson);
        Assert.DoesNotContain(PixabayKey, entry.KeyHash);
    }

    [Fact]
    public async Task A_pixabay_import_downloads_the_file_follows_the_cdn_redirect_and_takes_full_hd_when_the_key_may()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("pixabay", PixabayKey);
        var plain = await ImportAsync("pixabay", "73424");
        Assert.StartsWith("kaese-kaese-theke", plain.Asset.Key);
        Assert.Equal("Katalog: Pixabay", plain.Asset.Category);
        Assert.Contains(Seen("pixabay.com"), r => r.Url.AbsolutePath == "/get/g73424_1280.jpg");   // largeImageURL
        Assert.Contains(Seen("cdn.pixabay.com"), r => r.Url.AbsolutePath.EndsWith("bild.jpg", StringComparison.Ordinal));

        var fullHd = await ImportAsync("pixabay", "195893");
        Assert.Contains(Seen("pixabay.com"), r => r.Url.AbsolutePath == "/get/g195893_1920.jpg");   // fullHDURL, only there with full API access

        var source = await Db(db => db.Asset.AsNoTracking().Where(a => a.Id == plain.Asset.Id).Select(a => a.SourceJson).SingleAsync());
        using var doc = JsonDocument.Parse(source!);
        Assert.Equal("Anna & Co", doc.RootElement.GetProperty("author").GetString());
        Assert.Equal("Pixabay Content License", doc.RootElement.GetProperty("licence").GetProperty("name").GetString());
        Assert.Equal("Bild von Anna & Co auf Pixabay", doc.RootElement.GetProperty("attribution").GetString());
        Assert.NotEqual(plain.Asset.Id, fullHd.Asset.Id);

        // the image downloads carry no key
        Assert.All(Seen("pixabay.com").Where(r => r.Url.AbsolutePath.StartsWith("/get/", StringComparison.Ordinal)), r => Assert.DoesNotContain("key=", r.Url.Query));
    }

    [Fact]
    public async Task Pixabay_leaves_out_a_hit_without_a_preview_on_its_own_hosts_and_a_page_link_to_somewhere_else()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("pixabay", PixabayKey);
        var bad = PixabayHit(777, "böse", "Mallory", 1);
        bad["webformatURL"] = "https://evil.test/x_640.jpg";
        bad["previewURL"] = "https://evil.test/x_150.jpg";
        var sneaky = PixabayHit(778, "link", "Mallory", 2);
        sneaky["pageURL"] = "https://evil.test/photos/778";
        sneaky["id"] = 778;
        _hook = r => r.RequestUri!.Host == "pixabay.com" && r.RequestUri.AbsolutePath == "/api/"
            ? Json(new JsonObject { ["total"] = 2, ["totalHits"] = 2, ["hits"] = new JsonArray(bad, sneaky) })
            : null;
        var page = await SearchAsync("pixabay", "x");
        var only = Assert.Single(page.Items);
        Assert.Equal("778", only.Id);
        Assert.Equal("", only.SourceUrl);   // not a link of Pixabay: no link
        Assert.False(page.HasMore);
    }

    [Fact]
    public async Task The_key_of_pixabay_never_leaves_to_another_host_and_is_not_in_a_flash_a_page_or_an_error()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await using var admins = await RealAdminsAsync();
        await EnableAsync("pixabay", PixabayKey);
        await SearchAsync("pixabay", "blossom");
        await ImportAsync("pixabay", "73424");
        // the key sits in the address of the API of pixabay.com and nowhere else: not in an image address, not in a request to the CDN
        Assert.All(Seam.Requests.Where(r => !(r.Url.Host == "pixabay.com" && r.Url.AbsolutePath == "/api/")), r => Assert.DoesNotContain(PixabayKey, r.Url.ToString()));
        Assert.All(Seam.Requests, r => Assert.DoesNotContain(PixabayKey, string.Join(" ", r.Headers.Values)));

        var admin = await SignInAsync(admins.Ids[0]);
        Assert.DoesNotContain(PixabayKey, await admin.GetStringAsync("/Admin/Catalogs"));
        Assert.DoesNotContain(PixabayKey, await admin.GetStringAsync("/Admin/Catalogs/Edit?id=pixabay"));
        var member = await SignInAsync(await UserAsync(Role.Designer));
        var list = await member.GetStringAsync("/api/catalogs");
        Assert.DoesNotContain(PixabayKey, list);
        var search = await member.GetStringAsync("/api/catalogs/pixabay/search?q=blossom");
        Assert.DoesNotContain(PixabayKey, search);
        var rows = await As(Role.Admin, biz => CatalogLogic.AdminListAsync(biz));
        Assert.DoesNotContain(PixabayKey, JsonSerializer.Serialize(rows.Select(x => new { x.Id, x.HasKey, x.Setting })));
        Assert.Equal(PixabayKey, await Svc.Secrets.LoadAsync("pixabay"));
        Assert.DoesNotContain(PixabayKey, await File.ReadAllTextAsync(Path.Combine(Factory.Services.GetRequiredService<ConfigStore>().DataDir, "secrets", "catalogs", "pixabay.key")));
    }

    [Fact]
    public async Task The_per_minute_limit_of_the_pixabay_key_is_kept_below_the_providers()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("pixabay", PixabayKey, perMinute: 1000);
        for (var i = 0; i < 90; i++)
        {
            await SearchAsync("pixabay", "wort" + i);
        }

        var over = await FailsAsync(() => SearchAsync("pixabay", "wort-zu-viel"));
        Assert.Equal(CatalogFailure.Limit, over.Failure);
        Assert.Equal(90, Seen("pixabay.com").Count);
        // a search that is in the cache costs nothing
        await SearchAsync("pixabay", "wort0");
        Assert.Equal(90, Seen("pixabay.com").Count);
    }

    [Fact]
    public async Task A_429_of_pixabay_without_a_retry_after_uses_the_reset_header()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("pixabay", PixabayKey);
        var limited = await FailsAsync(() => SearchAsync("pixabay", "limit"));
        Assert.Equal(CatalogFailure.Limit, limited.Failure);
        Assert.Equal(55, limited.RetryAfterSeconds);   // "Retry-After: 0" says nothing, the end of the window does

        // without any Retry-After and without the rate headers: a minute
        Svc.Limiter.Reset();
        _hook = r => r.RequestUri!.Host == "pixabay.com" ? new HttpResponseMessage((HttpStatusCode)429) { Content = new StringContent("API rate limit exceeded") } : null;
        Assert.Equal(60, (await FailsAsync(() => SearchAsync("pixabay", "x"))).RetryAfterSeconds);
    }

    // ------------------------------------------------------------------------------------------------ Openverse

    [Fact]
    public async Task Openverse_asks_for_licences_that_allow_commercial_use_and_changes_and_pages_of_at_most_20()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("openverse");
        var empty = await SearchAsync("openverse");
        Assert.Equal("Gib einen Suchbegriff ein.", empty.Message);
        Assert.Empty(Seam.Requests);

        var page = await SearchAsync("openverse", "cheese", orientation: "portrait", perPage: 50, kind: CatalogKinds.Photo);
        var request = Assert.Single(Seen("api.openverse.org"));
        Assert.Equal("/v1/images/", request.Url.AbsolutePath);
        var query = System.Web.HttpUtility.ParseQueryString(request.Url.Query);
        Assert.Equal("commercial,modification", query["license_type"]);
        Assert.Equal("20", query["page_size"]);      // anonymous requests may not ask for more
        Assert.Equal("tall", query["aspect_ratio"]);
        Assert.Equal("photograph", query["category"]);
        Assert.Equal("cheese", query["q"]);
        Assert.Null(query["mature"]);                // safe search is on: sensitive results stay out (the default of Openverse)
        Assert.False(request.Headers.ContainsKey("Authorization"));

        Assert.Equal([OvBy, OvSa, OvCc0, OvPdm], page.Items.Select(i => i.Id));
        var by = page.Items[0];
        Assert.Equal(("cheeses", "_gee_"), (by.Title, by.Author));
        Assert.Equal("https://www.flickr.com/photos/32426344@N00", by.AuthorUrl);
        Assert.Equal(("CC-BY-2.0", "CC BY 2.0", true), (by.Licence!.Code, by.Licence.Name, by.Licence.AttributionRequired));
        Assert.Equal("https://creativecommons.org/licenses/by/2.0/", by.Licence.Url);
        Assert.Equal(("CC-BY-SA-4.0", "CC BY SA 4.0"), (page.Items[1].Licence!.Code, page.Items[1].Licence!.Name));
        Assert.Equal(("CC0-1.0", false), (page.Items[2].Licence!.Code, page.Items[2].Licence!.AttributionRequired));
        Assert.Equal(("PDM-1.0", "Public Domain Mark 1.0"), (page.Items[3].Licence!.Code, page.Items[3].Licence!.Name));
        // the thumbnail is made by Openverse on its own host: the page gets a token of this app, the only host is api.openverse.org
        Assert.All(page.Items, i => Assert.StartsWith("/api/catalogs/thumb/", i.Thumb));
        Assert.DoesNotContain(page.Items, i => i.Thumb.Contains("flickr"));

        // paging: the first 240 results of a query, 12 pages of 20
        Assert.True(page.HasMore);
        var last = await SearchAsync("openverse", "cheese", page: 12, perPage: 20);
        Assert.False(last.HasMore);
        var beyond = await SearchAsync("openverse", "cheese", page: 13, perPage: 20);
        Assert.Empty(beyond.Items);
        Assert.Equal(2, Seen("api.openverse.org").Count);   // page 13 was not even asked for
    }

    [Fact]
    public async Task An_nc_or_nd_item_never_appears_even_when_the_provider_lets_it_through_and_cannot_be_imported_by_its_id()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("openverse");
        // the word "leck": the fake provider ignores its own licence filter and sends everything
        var leaked = await SearchAsync("openverse", "leck");
        Assert.Equal([OvBy, OvSa, OvCc0, OvPdm], leaked.Items.Select(i => i.Id));
        Assert.All(leaked.Items, i => Assert.DoesNotContain("NC", i.Licence!.Code));
        Assert.All(leaked.Items, i => Assert.DoesNotContain("ND", i.Licence!.Code));

        // the ids of the forbidden ones are known to somebody who crafts a request: the import checks the licence again, before a single byte is downloaded
        Seam.Requests.Clear();
        var before = await Db(db => db.Asset.CountAsync(a => a.Category == "Katalog: Openverse"));
        foreach (var forbidden in new[] { OvNc, OvNd, OvNcSa, OvOdd })
        {
            var refused = await FailsAsync(() => ImportAsync("openverse", forbidden));
            Assert.Equal(CatalogFailure.Refused, refused.Failure);
            Assert.Contains("Lizenz", refused.Message);
        }

        Assert.DoesNotContain(Seen("api.openverse.org"), r => r.Url.AbsolutePath.EndsWith("/thumb/", StringComparison.Ordinal));
        Assert.Equal(before, await Db(db => db.Asset.CountAsync(a => a.Category == "Katalog: Openverse")));
    }

    [Fact]
    public async Task The_administrator_can_narrow_the_openverse_licences_and_the_provider_is_told()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("openverse", licences: ["CC0", "PDM"]);
        var page = await SearchAsync("openverse", "leck");
        Assert.Equal([OvCc0, OvPdm], page.Items.Select(i => i.Id));   // the provider "leaked" CC BY too, our own check keeps it out
        var query = System.Web.HttpUtility.ParseQueryString(Assert.Single(Seen("api.openverse.org")).Url.Query);
        Assert.Equal("cc0,pdm", query["license"]);

        // a licence that would allow NC or ND cannot be chosen at all
        await Assert.ThrowsAsync<BizException>(() => EnableAsync("openverse", licences: ["CC-BY-NC"]));
        await Assert.ThrowsAsync<BizException>(() => EnableAsync("openverse", licences: ["CC-BY-ND-4.0"]));
        // and the licence of an item is judged by its code: BY must not match BY-SA
        Assert.True(OpenverseCatalog.Allowed("CC-BY-2.0", ["CC-BY"]));
        Assert.False(OpenverseCatalog.Allowed("CC-BY-SA-4.0", ["CC-BY"]));
        Assert.True(OpenverseCatalog.Allowed("CC-BY-SA-4.0", ["CC-BY-SA"]));
        Assert.False(OpenverseCatalog.Allowed("CC-BY-NC-4.0", ["CC-BY", "CC-BY-NC"]));
        Assert.False(OpenverseCatalog.Allowed("CC-BY-ND-2.0", []));
        Assert.Equal("CC-BY-2.0", OpenverseCatalog.LicenceCode("by", "2.0"));
        Assert.Equal("CC0-1.0", OpenverseCatalog.LicenceCode("cc0", ""));
        Assert.Null(OpenverseCatalog.LicenceCode("by; drop", "2.0"));
    }

    [Fact]
    public async Task An_openverse_import_goes_through_openverse_only_and_stores_who_made_it_and_under_which_licence()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("openverse");
        var imported = await ImportAsync("openverse", OvBy);
        Assert.StartsWith("cheeses", imported.Asset.Key);
        Assert.Equal("Katalog: Openverse", imported.Asset.Category);
        // no request left Openverse's own host: the file comes from /thumb/?full_size=true, never from Flickr
        Assert.All(Seam.Requests, r => Assert.Equal("api.openverse.org", r.Url.Host));
        Assert.Contains(Seen("api.openverse.org"), r => r.Url.AbsolutePath == $"/v1/images/{OvBy}/thumb/" && r.Url.Query.Contains("full_size=true"));

        var source = await Db(db => db.Asset.AsNoTracking().Where(a => a.Id == imported.Asset.Id).Select(a => a.SourceJson).SingleAsync());
        using var doc = JsonDocument.Parse(source!);
        var e = doc.RootElement;
        Assert.Equal("_gee_", e.GetProperty("author").GetString());
        Assert.Equal("https://www.flickr.com/photos/32426344@N00", e.GetProperty("authorUrl").GetString());
        Assert.Equal("https://www.flickr.com/photos/32426344@N00/" + OvBy[..6], e.GetProperty("sourceUrl").GetString());
        Assert.Equal("CC-BY-2.0", e.GetProperty("licence").GetProperty("code").GetString());
        Assert.True(e.GetProperty("licence").GetProperty("attributionRequired").GetBoolean());
        Assert.Equal("https://creativecommons.org/licenses/by/2.0/", e.GetProperty("licence").GetProperty("url").GetString());
        Assert.Equal("„cheeses“ von _gee_ (CC BY 2.0), Quelle: flickr über Openverse", e.GetProperty("attribution").GetString());

        // CC0 needs no credit line of its own, but the source is kept all the same
        var cc0 = await ImportAsync("openverse", OvCc0);
        var credits = await As(Role.Designer, biz => CatalogLogic.CreditsOfKeysAsync(biz, [imported.Asset.Key, cc0.Asset.Key]));
        Assert.Equal(2, credits.Count);
        Assert.Equal(["CC-BY-2.0", "CC0-1.0"], credits.OrderBy(c => c.Key == cc0.Asset.Key).Select(c => c.LicenceCode));
    }

    [Fact]
    public async Task Openverse_credentials_make_a_token_once_and_send_it_with_the_searches_and_the_thumbnails()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("openverse", key: "cid:sec");
        // a page of results asks for twenty thumbnails at once, and every one of them needs the token: it is made once
        var openverse = Svc.Registry.Find("openverse")!;
        await Task.WhenAll(Enumerable.Range(0, 12).Select(_ => As(Role.Designer, biz => CatalogLogic.ThumbHeadersAsync(biz, openverse, default))));
        await SearchAsync("openverse", "cheese");
        await SearchAsync("openverse", "kaese");
        var token = Seen("api.openverse.org").Where(r => r.Method == "POST").ToList();
        Assert.Single(token);   // the token is kept
        Assert.Equal("/v1/auth_tokens/token/", token[0].Url.AbsolutePath);
        Assert.All(Seen("api.openverse.org").Where(r => r.Url.AbsolutePath == "/v1/images/"), r => Assert.Equal("Bearer tok-abc", r.Headers["Authorization"]));
        // the secret is in the body of the POST, never in an address
        Assert.All(Seam.Requests, r => Assert.DoesNotContain("sec", r.Url.Query));

        var headers = await As(Role.Designer, biz => CatalogLogic.ThumbHeadersAsync(biz, Svc.Registry.Find("openverse")!, default));
        Assert.Equal("Bearer tok-abc", headers!["Authorization"]);
        await Svc.Secrets.SaveAsync("openverse", null);
        Assert.Null(await As(Role.Designer, biz => CatalogLogic.ThumbHeadersAsync(biz, Svc.Registry.Find("openverse")!, default)));
    }

    [Fact]
    public async Task Wrong_openverse_credentials_are_a_message_for_the_administrator_and_not_a_silent_fall_back()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("openverse", key: "nur-ein-wort");
        var format = await FailsAsync(() => SearchAsync("openverse", "x"));
        Assert.Equal(CatalogFailure.Key, format.Failure);
        Assert.Contains("Client-ID:Client-Secret", format.Message);
        Assert.Empty(Seam.Requests);

        await EnableAsync("openverse", key: "cid:falsch");
        var wrong = await FailsAsync(() => SearchAsync("openverse", "x"));
        Assert.Equal(CatalogFailure.Key, wrong.Failure);
        Assert.DoesNotContain("falsch", wrong.Message);
        Assert.DoesNotContain(Seen("api.openverse.org"), r => r.Url.AbsolutePath == "/v1/images/");
    }

    [Fact]
    public async Task Openverse_limits_429_and_the_headers_of_the_anonymous_scopes_are_honoured()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("openverse");
        await SearchAsync("openverse", "cheese");
        var rate = Svc.Limiter.RateOf("openverse")!;
        Assert.Equal(19, rate.Remaining);   // the smallest of the available counters
        Assert.Equal(200, rate.Limit);      // "200/day" reads as 200

        var limited = await FailsAsync(() => SearchAsync("openverse", "limit"));
        Assert.Equal((CatalogFailure.Limit, 90), (limited.Failure, limited.RetryAfterSeconds));
        Assert.Contains("einer Minute", limited.Message);
        Assert.Equal(CatalogFailure.Limit, (await FailsAsync(() => ImportAsync("openverse", OvBy))).Failure);
        Assert.Equal(2, Seen("api.openverse.org").Count);
    }

    [Fact]
    public async Task The_thumbnails_of_all_three_go_through_the_proxy_and_nothing_else_does()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await using var admins = await RealAdminsAsync();
        await EnableAsync("pexels", PexelsKey);
        await EnableAsync("pixabay", PixabayKey);
        await EnableAsync("openverse", key: "cid:sec");
        var client = await SignInAsync(await UserAsync(Role.Designer));
        foreach (var (catalog, words, host) in new[] { ("pexels", "rocks", "images.pexels.com"), ("pixabay", "blossom", "pixabay.com"), ("openverse", "cheese", "api.openverse.org") })
        {
            var page = JsonNode.Parse(await client.GetStringAsync($"/api/catalogs/{catalog}/search?q={words}"))!;
            var thumb = page["items"]![0]!["thumb"]!.GetValue<string>();
            Assert.StartsWith("/api/catalogs/thumb/", thumb);
            var image = await client.GetAsync(thumb);
            Assert.Equal(HttpStatusCode.OK, image.StatusCode);
            Assert.Equal("image/png", image.Content.Headers.ContentType!.MediaType);
            Assert.Contains(Seen(host), r => r.Url.AbsolutePath != "/api/" && r.Url.AbsolutePath != "/v1/images/" && !r.Url.AbsolutePath.StartsWith("/v1/auth", StringComparison.Ordinal));
        }

        // the thumbnail of Openverse carries the token of the credentials
        Assert.All(Seen("api.openverse.org").Where(r => r.Url.AbsolutePath.EndsWith("/thumb/", StringComparison.Ordinal)), r => Assert.Equal("Bearer tok-abc", r.Headers["Authorization"]));
        // a signed-out visitor gets nothing
        using var anonymous = Factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        Assert.NotEqual(HttpStatusCode.OK, (await anonymous.GetAsync("/api/catalogs/pexels/search?q=x")).StatusCode);
    }

    // ------------------------------------------------------------------------------------------------ the client (needs no app)

    [Theory]
    [InlineData(1, "einer Minute")]
    [InlineData(60, "einer Minute")]
    [InlineData(90, "einer Minute")]
    [InlineData(120, "2 Minuten")]
    [InlineData(300, "5 Minuten")]
    [InlineData(3600, "60 Minuten")]
    [InlineData(7200, "2 Stunden")]
    public void The_pause_is_told_in_words(int seconds, string expected) => Assert.Equal(expected, CatalogHttp.WaitText(seconds));

    [Fact]
    public async Task A_form_is_posted_to_the_catalogue_s_host_only_and_never_followed_to_another_place()
    {
        var seam = new CatalogTestSeam
        {
            Handler = (request, _) => Task.FromResult(request.RequestUri!.AbsolutePath == "/token"
                ? new HttpResponseMessage(HttpStatusCode.Found) { Headers = { Location = new Uri("https://evil.test/collect") } }
                : Json(new JsonObject { ["ok"] = true })),
        };
        var http = new CatalogHttp(seam);
        var form = new Dictionary<string, string> { ["client_secret"] = "geheim" };
        var moved = await Assert.ThrowsAsync<CatalogException>(() => http.PostFormAsync(new Uri("https://a.test/token"), ["a.test"], false, "Beispiel", form, TimeSpan.FromSeconds(5), 4096, default));
        Assert.Equal(CatalogFailure.Refused, moved.Failure);
        Assert.DoesNotContain(seam.Requests, r => r.Url.Host == "evil.test");
        Assert.Equal("POST", seam.Requests[0].Method);
        var other = await Assert.ThrowsAsync<CatalogException>(() => http.PostFormAsync(new Uri("https://b.test/token"), ["a.test"], false, "Beispiel", form, TimeSpan.FromSeconds(5), 4096, default));
        Assert.Equal(CatalogFailure.Refused, other.Failure);
        Assert.Single(seam.Requests);
        Assert.Equal(200, (await http.PostFormAsync(new Uri("https://a.test/ok"), ["a.test"], false, "Beispiel", form, TimeSpan.FromSeconds(5), 4096, default)).Status);
    }

    [Fact]
    public async Task A_retry_after_date_a_zero_and_the_rate_headers_are_read()
    {
        var future = DateTimeOffset.UtcNow.AddSeconds(300);
        var seam = new CatalogTestSeam
        {
            Handler = (request, _) => Task.FromResult(request.RequestUri!.AbsolutePath switch
            {
                "/date" => new HttpResponseMessage((HttpStatusCode)429) { Headers = { RetryAfter = new RetryConditionHeaderValue(future) } },
                "/huge" => new HttpResponseMessage((HttpStatusCode)429) { Headers = { RetryAfter = new RetryConditionHeaderValue(TimeSpan.FromDays(3)) } },
                _ => WithRate(Json(new JsonObject()), "X-RateLimit-Limit", "100", "X-RateLimit-Remaining", "7", "X-RateLimit-Reset", "42", "x-ratelimit-available-anon_burst", "3/min"),
            }),
        };
        var http = new CatalogHttp(seam);
        Task<CatalogHttpResult> Get(string path) => http.GetAsync(new Uri("https://a.test" + path), ["a.test"], false, "Beispiel", null, TimeSpan.FromSeconds(5), 4096, default);
        var date = await Assert.ThrowsAsync<CatalogException>(() => Get("/date"));
        Assert.InRange(date.RetryAfterSeconds, 290, 301);
        Assert.Equal(3600, (await Assert.ThrowsAsync<CatalogException>(() => Get("/huge"))).RetryAfterSeconds);   // never more than an hour
        var rate = (await Get("/ok")).Rate!;
        Assert.Equal((100, 3, 42), (rate.Limit, rate.Remaining, rate.ResetSeconds));   // the smallest of the counters left
    }

    // ------------------------------------------------------------------------------------------------ the credits in the public view

    [Fact]
    public async Task The_public_view_lists_the_catalogue_images_of_the_design_and_only_those()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await using var admins = await RealAdminsAsync();
        await EnableAsync("pexels", PexelsKey);
        await EnableAsync("openverse");
        var pexels = await ImportAsync("pexels", "1001");
        var ccBy = await ImportAsync("openverse", OvBy);
        var own = await As(Role.Designer, async biz => (await AssetLogic.UploadAsync(biz, "eigen-" + Guid.NewGuid().ToString("N")[..6] + ".png", Image, null)).Asset!);

        var design = await As(Role.Designer, async biz =>
        {
            var created = await DesignLogic.CreateFromFormatAsync(biz, "a4-portrait", null, null, null, "Mit Nachweisen " + Guid.NewGuid().ToString("N")[..6]);
            var doc = JsonNode.Parse(DocumentValidator.ToJson(DocumentValidator.Create(100, 100, "mm")))!;
            var elements = (JsonArray)doc["pages"]![0]!["elements"]!;
            var n = 0;
            foreach (var key in new[] { pexels.Asset.Key, ccBy.Asset.Key, own.Key })
            {
                n++;
                var top = n * 15;
                elements.Add(JsonNode.Parse($$$"""{"id":"i{{{n}}}","type":"image","x":10,"y":{{{top}}},"w":10,"h":10,"source":{"asset":"{{{key}}}"}}"""));
            }

            await DesignLogic.SaveDocumentAsync(biz, created.Id, 1, doc.ToJsonString());
            return created.Id;
        });
        var link = await As(Role.Designer, biz => ShareLogic.SetLinkAsync(biz, ItemKind.Design, design, LinkAudience.Public, SharePermission.View, false, null));

        using var anonymous = Factory.CreateClient();
        var payload = JsonNode.Parse(await anonymous.GetStringAsync("/api/s/" + link.Token))!;
        var credits = payload["credits"]!.AsArray();
        Assert.Equal(2, credits.Count);   // the own upload needs none
        var pex = credits.Single(c => c!["catalogName"]!.GetValue<string>() == "Pexels")!;
        Assert.Equal("Joey Farina", pex["author"]!.GetValue<string>());
        Assert.Equal("https://www.pexels.com/photo/foto-1001/", pex["sourceUrl"]!.GetValue<string>());
        Assert.Equal("Foto von Joey Farina auf Pexels", pex["attribution"]!.GetValue<string>());
        var ov = credits.Single(c => c!["catalogName"]!.GetValue<string>() == "Openverse")!;
        Assert.Equal("CC BY 2.0", ov["licence"]!["name"]!.GetValue<string>());
        Assert.Equal("https://creativecommons.org/licenses/by/2.0/", ov["licence"]!["url"]!.GetValue<string>());
        // nothing that tells where the asset is stored or how it is keyed beyond what the page needs
        Assert.DoesNotContain(PexelsKey, payload.ToJsonString());
        Assert.DoesNotContain("SourceJson", payload.ToJsonString());

        // a design without catalogue images has an empty list
        var plain = await As(Role.Designer, biz => DesignLogic.CreateFromFormatAsync(biz, "a4-portrait", null, null, null, "Ohne " + Guid.NewGuid().ToString("N")[..6]));
        var plainLink = await As(Role.Designer, biz => ShareLogic.SetLinkAsync(biz, ItemKind.Design, plain.Id, LinkAudience.Public, SharePermission.View, false, null));
        Assert.Empty(JsonNode.Parse(await anonymous.GetStringAsync("/api/s/" + plainLink.Token))!["credits"]!.AsArray());
    }
}
