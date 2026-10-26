using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using DesignThix.Catalogs;
using DesignThix.Catalogs.Providers;
using DesignThix.Configuration;
using DesignThix.Core.Documents;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.Tests.Core;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DesignThix.Tests.Integration;

/// <summary>
/// Plan 5, C1 (docs/PLAN-CATALOGS.md): the framework of the catalogues. The logic tests run against the real app and PostgreSQL (see <see cref="AppTests"/>) and never touch the network: the
/// <see cref="CatalogTestSeam"/> answers for the example provider "example-stock.test". The tests of the guarded HTTP client, the proxy tokens, the licences and the paths of the server folders
/// need nothing but themselves and always run.
/// </summary>
[Collection("app")]
public sealed class CatalogTests(AppTests.AppFactory factory) : PlatformTestBase(factory)
{
    private const string Host = "example-stock.test";

    private static readonly byte[] Image = File.ReadAllBytes(Path.Combine(RepoFiles.WwwRoot(), "img", "icon-192.png"));

    private CatalogTestSeam Seam => Factory.Services.GetRequiredService<CatalogTestSeam>();

    private CatalogServices Svc => Factory.Services.GetRequiredService<CatalogServices>();

    private string DataDir => Factory.Services.GetRequiredService<ConfigStore>().DataDir;

    // ------------------------------------------------------------------------------------------------ the fake provider

    private sealed record Pic(string Id, string Title, string Collection, string Licence, string Thumb = "", string Author = "Anna Beispiel");

    private static readonly Pic[] Pics =
    [
        new("p1", "Berglandschaft", "nature", "CC-BY-4.0"),
        new("p2", "Waldweg", "nature", "CC0-1.0", Author: "Ben Beispiel"),
        new("p3", "Zitronen", "food", "CC0-1.0", Author: "Cem Beispiel"),
        new("nc1", "Nur privat", "nature", "CC-BY-NC-4.0"),
        new("nd1", "Unveränderlich", "food", "CC-BY-ND-4.0"),
        new("unk", "Ohne Lizenz", "food", "ALL-RIGHTS-RESERVED"),
        new("far", "Fremdes Vorschaubild", "nature", "CC0-1.0", Thumb: "https://evil.test/x.png"),
    ];

    private static string ItemJson(Pic p, bool withDownload)
    {
        var node = new JsonObject
        {
            ["id"] = p.Id,
            ["title"] = p.Title,
            ["width"] = 192,
            ["height"] = 192,
            ["thumb"] = p.Thumb.Length > 0 ? p.Thumb : $"https://{Host}/img/{p.Id}.png",
            ["author"] = p.Author,
            ["authorUrl"] = "https://example-stock.test/u/" + p.Id,
            ["url"] = "https://example-stock.test/photo/" + p.Id,
            ["licence"] = new JsonObject { ["code"] = p.Licence, ["name"] = p.Licence.Replace('-', ' '), ["url"] = "https://creativecommons.org/licenses/" },
        };
        if (withDownload)
        {
            node["download"] = $"https://{Host}/files/{p.Id}.png";
        }

        return node.ToJsonString();
    }

    private static HttpResponseMessage Json(string json) => new(HttpStatusCode.OK) { Content = new StringContent(json, Encoding.UTF8, "application/json") };

    private static HttpResponseMessage Png() => new(HttpStatusCode.OK) { Content = new ByteArrayContent(Image) { Headers = { ContentType = new MediaTypeHeaderValue("image/png") } } };

    /// <summary>What the example provider answers: collections, a search (with the query words, the collection and the paging), the item with its download address, and the pictures.</summary>
    private static Task<HttpResponseMessage> Provider(HttpRequestMessage request, CancellationToken ct)
    {
        var url = request.RequestUri!;
        var query = System.Web.HttpUtility.ParseQueryString(url.Query);
        if (url.Host != Host)
        {
            return Task.FromResult(Json("{}"));
        }

        var path = url.AbsolutePath;
        if (path == "/api/collections")
        {
            return Task.FromResult(Json("""{"collections":[{"id":"nature","name":"Natur","count":3},{"id":"food","name":"Essen","count":3}]}"""));
        }

        if (path == "/api/search")
        {
            var words = query["query"] ?? "";
            if (words == "limit")
            {
                return Task.FromResult(new HttpResponseMessage((HttpStatusCode)429) { Headers = { RetryAfter = new RetryConditionHeaderValue(TimeSpan.FromSeconds(120)) } });
            }

            if (words == "down")
            {
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.InternalServerError));
            }

            var found = Pics.Where(p => (words.Length == 0 || p.Title.Contains(words, StringComparison.OrdinalIgnoreCase)) && ((query["collection"] ?? "").Length == 0 || p.Collection == query["collection"])).ToList();
            var array = "[" + string.Join(",", found.Select(p => ItemJson(p, false))) + "]";
            return Task.FromResult(Json($$"""{"total":{{found.Count}},"page":1,"items":{{array}}}"""));
        }

        if (path.StartsWith("/api/items/", StringComparison.Ordinal))
        {
            var pic = Pics.FirstOrDefault(p => p.Id == path["/api/items/".Length..]);
            return Task.FromResult(pic is null ? new HttpResponseMessage(HttpStatusCode.NotFound) : Json(ItemJson(pic, true)));
        }

        return Task.FromResult(path.StartsWith("/img/", StringComparison.Ordinal) || path.StartsWith("/files/", StringComparison.Ordinal) ? Png() : new HttpResponseMessage(HttpStatusCode.NotFound));
    }

    /// <summary>Starts a test from a known state: no settings, no keys, an empty cache, a free brake, the seam answering as the example provider.</summary>
    private async Task ResetAsync()
    {
        Seam.Reset();
        Seam.Handler = Provider;
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

    private Task EnableAsync(string id, string? key = null, int perMinute = 0, int perHour = 0, IReadOnlyList<string>? folders = null)
        => As(Role.Admin, async biz =>
        {
            await CatalogLogic.SaveAsync(biz, id, new CatalogInput(true, 0, perMinute, perHour, true, [], folders ?? []));
            if (key is not null)
            {
                await CatalogLogic.SetKeyAsync(biz, id, key, false);
            }
        });

    private static CatalogQuery Words(string text = "", string collection = "") => new() { Text = text, Collection = collection };

    // ------------------------------------------------------------------------------------------------ the registry

    [Fact]
    public async Task The_registry_lists_the_local_catalogues_and_the_examples_only_with_an_address()
    {
        if (!Enabled)
        {
            return;
        }

        var ids = Svc.Registry.All.Select(c => c.Id).ToList();
        Assert.Equal(["builtin", "uploads", "folder", "example-browse", "example-search"], ids);
        Assert.Equal(ids.Count, ids.Distinct().Count());

        var plain = new ConfigStore(Path.Combine(Path.GetTempPath(), "designthix-registry-" + Guid.NewGuid().ToString("N")));
        plain.Current.Catalogs.Clear();
        Assert.Equal(["builtin", "uploads", "folder"], new CatalogRegistry(plain).All.Select(c => c.Id));
        await Task.CompletedTask;
    }

    [Fact]
    public async Task Only_the_catalogues_that_are_on_and_usable_are_offered()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        Assert.Equal(["builtin", "uploads"], (await As(Role.Designer, biz => CatalogLogic.ListAsync(biz))).Select(r => r.Id));

        await EnableAsync("example-browse");
        await EnableAsync("example-search");
        var listed = (await As(Role.Designer, biz => CatalogLogic.ListAsync(biz))).Select(r => r.Id).ToList();
        Assert.Contains("example-browse", listed);
        Assert.DoesNotContain("example-search", listed);   // it needs a key and has none

        await As(Role.Admin, biz => CatalogLogic.SetKeyAsync(biz, "example-search", "k", false));
        Assert.Contains("example-search", (await As(Role.Designer, biz => CatalogLogic.ListAsync(biz))).Select(r => r.Id));

        // switched off: the catalogue is a 404 for everybody, the same answer as for an id that does not exist
        await As(Role.Admin, biz => CatalogLogic.SaveAsync(biz, "example-browse", new CatalogInput(false, 0, 0, 0, true, [], [])));
        await Assert.ThrowsAsync<NotFoundException>(() => As(Role.Designer, biz => CatalogLogic.SearchAsync(biz, "example-browse", Words())));
        await Assert.ThrowsAsync<NotFoundException>(() => As(Role.Designer, biz => CatalogLogic.SearchAsync(biz, "does-not-exist", Words())));
    }

    [Fact]
    public async Task The_order_of_the_administrator_decides_the_tabs()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await As(Role.Admin, async biz =>
        {
            await CatalogLogic.SaveAsync(biz, "example-browse", new CatalogInput(true, -5, 0, 0, true, [], []));
            await CatalogLogic.SaveAsync(biz, "uploads", new CatalogInput(true, 3, 0, 0, true, [], []));
        });
        var order = (await As(Role.Designer, biz => CatalogLogic.ListAsync(biz))).Select(r => r.Id).ToList();
        Assert.Equal(["example-browse", "builtin", "uploads"], order);
    }

    // ------------------------------------------------------------------------------------------------ browse and search-only

    [Fact]
    public async Task A_browsable_catalogue_has_collections_and_a_first_page()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("example-browse");
        var collections = await As(Role.Designer, biz => CatalogLogic.CollectionsAsync(biz, "example-browse"));
        Assert.Equal(["nature", "food"], collections.Select(c => c.Id));
        var page = await As(Role.Designer, biz => CatalogLogic.SearchAsync(biz, "example-browse", Words()));
        // the licence filter and the host rule are in the catalogue: no NC, no ND, no unknown licence, no thumbnail from another host
        Assert.Equal(["p1", "p2", "p3"], page.Items.Select(i => i.Id));
        Assert.Equal(["p3"], (await As(Role.Designer, biz => CatalogLogic.SearchAsync(biz, "example-browse", Words(collection: "food")))).Items.Select(i => i.Id));
        Assert.Equal(["p2"], (await As(Role.Designer, biz => CatalogLogic.SearchAsync(biz, "example-browse", Words("wald")))).Items.Select(i => i.Id));
        Assert.All(page.Items, i => Assert.NotNull(i.Licence));
        Assert.Equal("Anna Beispiel", page.Items[0].Author);
    }

    [Fact]
    public async Task A_search_only_catalogue_lists_nothing_without_words_and_asks_the_provider_with_them()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("example-search", key: "geheim-1");
        var empty = await As(Role.Designer, biz => CatalogLogic.SearchAsync(biz, "example-search", Words()));
        Assert.Empty(empty.Items);
        Assert.Equal("Gib einen Suchbegriff ein.", empty.Message);
        Assert.Empty(Seam.Requests);   // not even a request

        var found = await As(Role.Designer, biz => CatalogLogic.SearchAsync(biz, "example-search", Words("zitron")));
        Assert.Equal(["p3"], found.Items.Select(i => i.Id));
        var request = Assert.Single(Seam.Requests, r => r.Url.AbsolutePath == "/api/search");
        Assert.Equal("geheim-1", request.Headers["Authorization"]);
        Assert.Empty(await As(Role.Designer, biz => CatalogLogic.CollectionsAsync(biz, "example-search")));
    }

    [Fact]
    public async Task Thumbnails_are_addresses_of_this_app_never_of_the_provider()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("example-browse");
        var page = await As(Role.Designer, biz => CatalogLogic.SearchAsync(biz, "example-browse", Words()));
        Assert.All(page.Items, i =>
        {
            Assert.StartsWith("/api/catalogs/thumb/", i.Thumb);
            Assert.DoesNotContain("example-stock", i.Thumb);
            Assert.DoesNotContain("png", i.Thumb);
        });
    }

    [Fact]
    public async Task Answers_are_cached_and_the_per_minute_and_hourly_brakes_hold()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("example-browse", perMinute: 4, perHour: 2);
        await As(Role.Designer, biz => CatalogLogic.SearchAsync(biz, "example-browse", Words("berg")));
        await As(Role.Designer, biz => CatalogLogic.SearchAsync(biz, "example-browse", Words("berg")));
        Assert.Single(Seam.Requests, r => r.Url.AbsolutePath == "/api/search");   // the second came from the cache

        // the budget of the key counts requests to the provider (cache misses): the second different search is the last one of the hour
        await As(Role.Designer, biz => CatalogLogic.SearchAsync(biz, "example-browse", Words("wald")));
        var over = await Assert.ThrowsAsync<CatalogException>(() => As(Role.Designer, biz => CatalogLogic.SearchAsync(biz, "example-browse", Words("zitron"))));
        Assert.Equal(CatalogFailure.Limit, over.Failure);
        Assert.Contains("genug Anfragen", over.Message);

        // the brake per person: three requests to the provider a minute (answers from the cache are free: browsing back and forth never runs into it)
        await ResetAsync();
        await EnableAsync("example-browse", perMinute: 3);
        foreach (var words in new[] { "berg", "wald", "zitron" })
        {
            await As(Role.Designer, biz => CatalogLogic.SearchAsync(biz, "example-browse", Words(words)));
        }

        for (var i = 0; i < 5; i++)
        {
            await As(Role.Designer, biz => CatalogLogic.SearchAsync(biz, "example-browse", Words("berg")));   // cached
        }

        var tooMany = await Assert.ThrowsAsync<CatalogException>(() => As(Role.Designer, biz => CatalogLogic.SearchAsync(biz, "example-browse", Words("honig"))));
        Assert.Equal(CatalogFailure.Limit, tooMany.Failure);
        Assert.Contains("viele Suchen", tooMany.Message);
        await As(Role.Stranger, biz => CatalogLogic.SearchAsync(biz, "example-browse", Words("berg")));   // somebody else still may (and the cache is shared)
    }

    [Fact]
    public async Task A_provider_that_is_down_or_over_its_limit_is_a_message_not_a_retry_loop()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("example-browse");
        var down = await Assert.ThrowsAsync<CatalogException>(() => As(Role.Designer, biz => CatalogLogic.SearchAsync(biz, "example-browse", Words("down"))));
        Assert.Equal(CatalogFailure.Unavailable, down.Failure);
        Assert.Contains("nicht erreichbar", down.Message);
        var limited = await Assert.ThrowsAsync<CatalogException>(() => As(Role.Designer, biz => CatalogLogic.SearchAsync(biz, "example-browse", Words("limit"))));
        Assert.Equal(CatalogFailure.Limit, limited.Failure);
        Assert.Equal(120, limited.RetryAfterSeconds);
        Assert.Equal(2, Seam.Requests.Count(r => r.Url.AbsolutePath == "/api/search"));   // one request each, no retries
    }

    [Fact]
    public async Task The_key_is_kept_in_the_secret_store_and_nowhere_else()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await As(Role.Admin, biz => CatalogLogic.SetKeyAsync(biz, "example-search", "sehr-geheim-4711", false));
        Assert.Equal("sehr-geheim-4711", await Svc.Secrets.LoadAsync("example-search"));
        Assert.True((await As(Role.Admin, biz => CatalogLogic.AdminGetAsync(biz, "example-search"))).HasKey);
        Assert.False(await Db(db => db.Setting.AnyAsync(s => s.Value.Contains("sehr-geheim"))));
        var file = Path.Combine(DataDir, "secrets", "catalogs", "example-search.key");
        Assert.True(File.Exists(file));
        Assert.DoesNotContain("sehr-geheim", await File.ReadAllTextAsync(file));

        // an empty input keeps the key, "remove" deletes it
        await As(Role.Admin, biz => CatalogLogic.SetKeyAsync(biz, "example-search", "", false));
        Assert.True(Svc.Secrets.Has("example-search"));
        await As(Role.Admin, biz => CatalogLogic.SetKeyAsync(biz, "example-search", null, true));
        Assert.False(Svc.Secrets.Has("example-search"));
        await Assert.ThrowsAsync<BizException>(() => As(Role.Admin, biz => CatalogLogic.SetKeyAsync(biz, "example-search", "zwei\nZeilen", false)));
    }

    [Fact]
    public async Task The_settings_are_checked_before_they_are_saved()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        Task Save(CatalogInput input, string id = "folder") => As(Role.Admin, biz => CatalogLogic.SaveAsync(biz, id, input));
        await Assert.ThrowsAsync<BizException>(() => Save(new CatalogInput(true, 0, -1, 0, true, [], [])));
        await Assert.ThrowsAsync<BizException>(() => Save(new CatalogInput(true, 0, 0, 1_000_000, true, [], [])));
        await Assert.ThrowsAsync<BizException>(() => Save(new CatalogInput(true, 0, 0, 0, true, [], ["../etc"])));
        await Assert.ThrowsAsync<BizException>(() => Save(new CatalogInput(true, 0, 0, 0, true, [], ["a/b"])));
        await Assert.ThrowsAsync<BizException>(() => Save(new CatalogInput(true, 0, 0, 0, true, ["CC-BY-NC-4.0"], []), "example-browse"));
        await Assert.ThrowsAsync<NotFoundException>(() => Save(new CatalogInput(true, 0, 0, 0, true, [], []), "pexels-gibt-es-noch-nicht"));
        await Save(new CatalogInput(true, 0, 0, 0, true, [], ["Bilder", "Bilder", "Archiv 2026"]));
        Assert.Equal(["Bilder", "Archiv 2026"], (await As(Role.Admin, biz => CatalogLogic.AdminGetAsync(biz, "folder"))).Setting.Folders);
    }

    // ------------------------------------------------------------------------------------------------ the import

    private async Task<AssetRow> ImportAsync(Role who, string id, string item, long? space = null, long? design = null)
        => (await As(who, biz => CatalogLogic.ImportAsync(biz, id, item, space, null, design))).Asset;

    [Fact]
    public async Task An_import_lands_in_the_library_with_its_source_and_is_reused_the_second_time()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("example-browse");
        var first = await As(Role.Designer, biz => CatalogLogic.ImportAsync(biz, "example-browse", "p1"));
        Assert.False(first.Reused);
        var asset = first.Asset;
        Assert.StartsWith("berglandschaft", asset.Key);   // keys are unique in the whole library: another test may have taken the plain one
        Assert.Equal("Katalog: Beispiel-Katalog", asset.Category);
        Assert.Equal("image/png", asset.ContentType);
        Assert.Equal(192, asset.Width);
        Assert.False(asset.IsBuiltIn);
        var mine = await As(Role.Designer, biz => biz.PersonalSpaceIdAsync());
        Assert.Equal(mine, asset.SpaceId);

        using var source = JsonDocument.Parse(asset.SourceJson!);
        var e = source.RootElement;
        Assert.Equal("example-browse", e.GetProperty("catalog").GetString());
        Assert.Equal("p1", e.GetProperty("itemId").GetString());
        Assert.Equal("Anna Beispiel", e.GetProperty("author").GetString());
        Assert.Equal("CC-BY-4.0", e.GetProperty("licence").GetProperty("code").GetString());
        Assert.Contains("Anna Beispiel", e.GetProperty("attribution").GetString());
        Assert.True(e.GetProperty("licence").GetProperty("attributionRequired").GetBoolean());

        var again = await As(Role.Designer, biz => CatalogLogic.ImportAsync(biz, "example-browse", "p1"));
        Assert.True(again.Reused);
        Assert.Equal(asset.Id, again.Asset.Id);
        Assert.Equal(1, await Db(db => db.Asset.CountAsync(a => a.SpaceId == mine && a.Category == "Katalog: Beispiel-Katalog")));
        Assert.Equal(1, Seam.Requests.Count(r => r.Url.AbsolutePath == "/files/p1.png"));   // the file was downloaded once

        // another person gets a copy of their own in their own area, under a free key
        var other = await ImportAsync(Role.Stranger, "example-browse", "p1");
        Assert.NotEqual(asset.Id, other.Id);
        Assert.NotEqual(asset.Key, other.Key);
        Assert.StartsWith("berglandschaft-", other.Key);
        // a trashed import comes back when the item is used again
        await As(Role.Designer, biz => ItemLogic.TrashAsync(biz, [new ItemRef(ItemKind.Asset, asset.Id)]));
        var back = await As(Role.Designer, biz => CatalogLogic.ImportAsync(biz, "example-browse", "p1"));
        Assert.True(back.Reused);
        Assert.Equal(asset.Id, back.Asset.Id);
        Assert.NotNull(await As(Role.Designer, biz => AssetLogic.GetAsync(biz, asset.Id)));
    }

    [Fact]
    public async Task What_a_licence_does_not_allow_cannot_be_imported_even_by_its_id()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("example-browse");
        foreach (var blocked in new[] { "nc1", "nd1", "unk" })
        {
            var refused = await Assert.ThrowsAsync<CatalogException>(() => As(Role.Designer, biz => CatalogLogic.ImportAsync(biz, "example-browse", blocked)));
            Assert.Equal(CatalogFailure.Refused, refused.Failure);
        }

        await Assert.ThrowsAsync<BizException>(() => As(Role.Designer, biz => CatalogLogic.ImportAsync(biz, "example-browse", "../../etc/passwd")));
        await Assert.ThrowsAsync<CatalogException>(() => As(Role.Designer, biz => CatalogLogic.ImportAsync(biz, "example-browse", "gibt-es-nicht")));
        Assert.DoesNotContain(Seam.Requests, r => r.Url.AbsolutePath.StartsWith("/files/", StringComparison.Ordinal));
    }

    [Fact]
    public async Task A_picture_that_is_no_picture_is_refused_by_its_bytes()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("example-browse");
        var inner = Seam.Handler!;
        Seam.Handler = (request, ct) => request.RequestUri!.AbsolutePath.StartsWith("/files/", StringComparison.Ordinal)
            ? Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("<html>das ist kein Bild</html>", Encoding.UTF8, "image/png") })
            : inner(request, ct);
        await Assert.ThrowsAsync<BizException>(() => As(Role.Designer, biz => CatalogLogic.ImportAsync(biz, "example-browse", "p2")));
        var designer = await UserAsync(Role.Designer);
        Assert.Equal(0, await Db(db => db.Asset.CountAsync(a => a.CreateUserId == designer && a.Category == "Katalog: Beispiel-Katalog")));
    }

    [Fact]
    public async Task An_import_needs_room_in_the_storage_of_the_area()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("example-browse");
        var space = await As(Role.Designer, biz => biz.PersonalSpaceIdAsync());
        await As(Role.Admin, biz => StorageLogic.SetQuotaAsync(biz, space, 1000));
        var full = await Assert.ThrowsAsync<BizException>(() => As(Role.Designer, biz => CatalogLogic.ImportAsync(biz, "example-browse", "p1")));
        Assert.Contains("Speicherplatz", full.Message);
        Assert.Equal(0, await Db(db => db.Asset.CountAsync(a => a.SpaceId == space)));
    }

    [Fact]
    public async Task An_import_goes_where_the_person_may_write()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("example-browse");
        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Viewer));
        var designerSpace = await As(Role.Designer, biz => biz.PersonalSpaceIdAsync());
        var viewerSpace = await As(Role.Viewer, biz => biz.PersonalSpaceIdAsync());

        // asked for an area: Edit is needed there (a viewer of the team gets a 403, a stranger a 404)
        await Assert.ThrowsAsync<ForbiddenException>(() => ImportAsync(Role.Viewer, "example-browse", "p1", team));
        await Assert.ThrowsAsync<NotFoundException>(() => ImportAsync(Role.Stranger, "example-browse", "p1", team));
        Assert.Equal(team, (await ImportAsync(Role.Designer, "example-browse", "p2", team)).SpaceId);
        Assert.Equal(0, await Db(db => db.Asset.CountAsync(a => a.SpaceId == team && a.Name == "Berglandschaft")));

        // from the editor of a design: the area of the design when the person may write there, else their own
        var design = (await As(Role.Designer, biz => DesignLogic.CreateFromFormatAsync(biz, "a4-portrait", null, null, null, "Im Team", team))).Id;
        Assert.Equal(team, (await ImportAsync(Role.Designer, "example-browse", "p3", null, design)).SpaceId);
        await Assert.ThrowsAsync<NotFoundException>(() => ImportAsync(Role.Stranger, "example-browse", "p3", null, design));
        var asViewer = await As(Role.Viewer, biz => CatalogLogic.ImportAsync(biz, "example-browse", "p3", null, null, design));
        Assert.Equal(viewerSpace, asViewer.Asset.SpaceId);
        Assert.NotEqual(designerSpace, asViewer.Asset.SpaceId);
    }

    // ------------------------------------------------------------------------------------------------ the credits

    private async Task<long> DesignWithImageAsync(Role who, string? key)
    {
        var id = (await As(who, biz => DesignLogic.CreateFromFormatAsync(biz, "a4-portrait", null, null, null, "Mit Bild " + Guid.NewGuid().ToString("N")[..6]))).Id;
        if (key is not null)
        {
            var doc = JsonNode.Parse(DocumentValidator.ToJson(DocumentValidator.Create(100, 100, "mm")))!;
            ((JsonArray)doc["pages"]![0]!["elements"]!).Add(JsonNode.Parse($$$"""{"id":"i1","type":"image","x":10,"y":10,"w":50,"h":50,"source":{"asset":"{{{key}}}"}}"""));
            await As(who, biz => DesignLogic.SaveDocumentAsync(biz, id, 1, doc.ToJsonString()));
        }

        return id;
    }

    [Fact]
    public async Task The_credits_of_a_design_name_the_external_sources_it_uses()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("example-browse");
        var cc = await ImportAsync(Role.Designer, "example-browse", "p1");
        var upload = (await As(Role.Designer, biz => AssetLogic.UploadAsync(biz, "eigen-" + Guid.NewGuid().ToString("N")[..6] + ".png", Image, null))).Asset!;
        var withCredit = await DesignWithImageAsync(Role.Designer, cc.Key);
        var without = await DesignWithImageAsync(Role.Designer, upload.Key);
        var empty = await DesignWithImageAsync(Role.Designer, null);

        var credits = await As(Role.Designer, biz => CatalogLogic.CreditsAsync(biz, withCredit));
        var line = Assert.Single(credits);
        Assert.Equal(cc.Key, line.Key);
        Assert.Equal("example-browse", line.Catalog);
        Assert.Equal("Beispiel-Katalog", line.CatalogName);
        Assert.Equal("Anna Beispiel", line.Author);
        Assert.Equal("CC-BY-4.0", line.LicenceCode);
        Assert.StartsWith("https://", line.SourceUrl);
        Assert.Contains("Berglandschaft", line.Attribution);
        Assert.Empty(await As(Role.Designer, biz => CatalogLogic.CreditsAsync(biz, without)));   // an own upload needs none
        Assert.Empty(await As(Role.Designer, biz => CatalogLogic.CreditsAsync(biz, empty)));
        await Assert.ThrowsAsync<NotFoundException>(() => As(Role.Stranger, biz => CatalogLogic.CreditsAsync(biz, withCredit)));

        // somebody who may only view the design sees the credits too; a copy of the picture keeps its source
        await ShareAsync(Role.Designer, ItemKind.Design, withCredit, Role.Viewer);
        Assert.Single(await As(Role.Viewer, biz => CatalogLogic.CreditsAsync(biz, withCredit)));
        var copy = await As(Role.Designer, biz => ItemLogic.DuplicateAsync(biz, [new ItemRef(ItemKind.Asset, cc.Id)]));
        var copied = await As(Role.Designer, biz => AssetLogic.GetAsync(biz, copy.Single().Id));
        Assert.Contains("\"copy\"", copied!.SourceJson);
        Assert.Equal(cc.Id, (await As(Role.Designer, biz => CatalogLogic.ImportAsync(biz, "example-browse", "p1"))).Asset.Id);   // the copy is not mistaken for the import

        // replacing the file of an imported image ends its credit
        await As(Role.Designer, biz => AssetLogic.ReplaceFileAsync(biz, cc.Id, Image));
        Assert.Empty(await As(Role.Designer, biz => CatalogLogic.CreditsAsync(biz, withCredit)));
    }

    [Fact]
    public async Task An_imported_image_that_moves_to_an_area_that_has_the_item_already_keeps_its_credit_and_clashes_with_nothing()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("example-browse");
        var team = await TeamAsync(Role.Designer);
        var mine = await ImportAsync(Role.Designer, "example-browse", "p3");
        var inTeam = await ImportAsync(Role.Designer, "example-browse", "p3", team);
        Assert.NotEqual(mine.Id, inTeam.Id);
        await As(Role.Designer, biz => ItemLogic.MoveAsync(biz, [new ItemRef(ItemKind.Asset, mine.Id)], team, null));
        var moved = (await As(Role.Designer, biz => AssetLogic.GetAsync(biz, mine.Id)))!;
        Assert.Equal(team, moved.SpaceId);
        Assert.Contains("\"copy\"", moved.SourceJson);   // the credit stays, it is no import any more
        Assert.Contains("Cem Beispiel", moved.SourceJson);
        var again = await As(Role.Designer, biz => CatalogLogic.ImportAsync(biz, "example-browse", "p3", team));
        Assert.True(again.Reused);
        Assert.Equal(inTeam.Id, again.Asset.Id);
    }

    [Fact]
    public async Task The_credit_of_a_picture_travels_with_the_exported_design()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await EnableAsync("example-browse");
        var cc = await ImportAsync(Role.Designer, "example-browse", "p1");
        var design = await DesignWithImageAsync(Role.Designer, cc.Key);
        var (bytes, _) = await As(Role.Designer, biz => DesignPackageLogic.ExportAsync(biz, design));
        using (var file = JsonDocument.Parse(bytes))
        {
            var source = file.RootElement.GetProperty("assets")[0].GetProperty("source");
            Assert.Equal("Anna Beispiel", source.GetProperty("author").GetString());
            Assert.Equal("CC-BY-4.0", source.GetProperty("licence").GetProperty("code").GetString());
        }

        // somebody else imports the file (another installation would do the same): the new design has the credit, and nothing was imported from a catalogue there
        var imported = await As(Role.Stranger, biz => DesignPackageLogic.ImportAsync(biz, bytes));
        var credits = await As(Role.Stranger, biz => CatalogLogic.CreditsAsync(biz, imported.Design.Id));
        var line = Assert.Single(credits);
        Assert.Equal("Anna Beispiel", line.Author);
        Assert.Equal("example-browse", line.Catalog);
        Assert.Contains("\"copy\"", (await As(Role.Stranger, biz => AssetLogic.GetByKeyAsync(biz, line.Key)))!.SourceJson);
    }

    [Fact]
    public void A_source_record_in_an_import_file_is_reduced_to_what_it_may_say()
    {
        var hostile = new JsonObject
        {
            ["catalog"] = "pexels",
            ["itemId"] = "a" + (char)7 + "b",
            ["title"] = "Titel" + (char)0x202E,
            ["author"] = "Anna",
            ["authorUrl"] = "javascript:alert(1)",
            ["sourceUrl"] = "https://example.org/p/1",
            ["evil"] = "<script>",
            ["licence"] = new JsonObject { ["code"] = "CC-BY-4.0", ["name"] = "CC BY 4.0", ["url"] = "data:text/html,x", ["attributionRequired"] = true, ["extra"] = 1 },
            ["attribution"] = "Foto von Anna",
            ["copy"] = false,
        }.ToJsonString();
        var clean = DesignPackageFormat.CleanSource(hostile);
        Assert.NotNull(clean);
        using var doc = JsonDocument.Parse(clean!);
        var e = doc.RootElement;
        Assert.Equal("ab", e.GetProperty("itemId").GetString());
        Assert.Equal("Titel", e.GetProperty("title").GetString());
        Assert.Equal("", e.GetProperty("authorUrl").GetString());
        Assert.Equal("https://example.org/p/1", e.GetProperty("sourceUrl").GetString());
        Assert.Equal("", e.GetProperty("licence").GetProperty("url").GetString());
        Assert.True(e.GetProperty("licence").GetProperty("attributionRequired").GetBoolean());
        Assert.False(e.TryGetProperty("evil", out _));
        Assert.True(e.GetProperty("copy").GetBoolean());   // it is no import of this installation, whatever the file says
        Assert.Null(DesignPackageFormat.CleanSource("""{"catalog":"Bad Id!"}"""));
        Assert.Null(DesignPackageFormat.CleanSource("[1,2]"));
        Assert.Null(DesignPackageFormat.CleanSource("not json"));
        Assert.Null(DesignPackageFormat.CleanSource(new string('x', 30_000)));
    }

    // ------------------------------------------------------------------------------------------------ the local catalogues

    [Fact]
    public async Task Mitgeliefert_lists_the_built_in_images_by_category()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var collections = await As(Role.Designer, biz => CatalogLogic.CollectionsAsync(biz, "builtin"));
        Assert.Contains(collections, c => c.Id == "Flaggen" && c.Count > 5);
        Assert.Contains(collections, c => c.Id == "Siegel");
        var found = await As(Role.Designer, biz => CatalogLogic.SearchAsync(biz, "builtin", Words("Deutsch")));
        var flag = Assert.Single(found.Items);
        Assert.Equal("flag-de", flag.AssetKey);
        Assert.StartsWith("/media/flag-de?v=", flag.Thumb);
        // the seals: the ones that come with the app (another test may have added a built-in image of its own, so not "all")
        var seals = (await As(Role.Designer, biz => CatalogLogic.SearchAsync(biz, "builtin", Words(collection: "Siegel")))).Items;
        Assert.True(seals.Count(i => i.AssetKey!.StartsWith("icon-", StringComparison.Ordinal)) > 3);
        Assert.DoesNotContain(seals, i => i.AssetKey!.StartsWith("flag-", StringComparison.Ordinal));
        // it is in the library already: nothing is copied
        var imported = await As(Role.Designer, biz => CatalogLogic.ImportAsync(biz, "builtin", "flag-de"));
        Assert.True(imported.Reused);
        Assert.Equal("flag-de", imported.Asset.Key);
        Assert.True(imported.Asset.IsBuiltIn);
    }

    [Fact]
    public async Task Uploads_shows_the_images_of_the_areas_of_the_person_and_nothing_else()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Viewer));
        string Name() => "kat-" + Guid.NewGuid().ToString("N")[..8] + ".png";
        var own = (await As(Role.Designer, biz => AssetLogic.UploadAsync(biz, Name(), Image, null))).Asset!;
        var inTeam = (await As(Role.Designer, biz => AssetLogic.UploadAsync(biz, Name(), Image, null, team))).Asset!;
        var strangers = (await As(Role.Stranger, biz => AssetLogic.UploadAsync(biz, Name(), Image, null))).Asset!;

        var seen = (await As(Role.Viewer, biz => CatalogLogic.SearchAsync(biz, "uploads", Words()))).Items.Select(i => i.AssetKey).ToList();
        Assert.Contains(inTeam.Key, seen);
        Assert.DoesNotContain(own.Key, seen);
        Assert.DoesNotContain(strangers.Key, seen);
        Assert.DoesNotContain(seen, k => k is not null && k.StartsWith("flag-", StringComparison.Ordinal));   // built-in images are Mitgeliefert

        var collections = await As(Role.Designer, biz => CatalogLogic.CollectionsAsync(biz, "uploads"));
        Assert.Contains(collections, c => c.Name == "Meine Uploads");
        Assert.Contains(collections, c => c.Id == team.ToString() && c.Count >= 1);
        var teamOnly = (await As(Role.Designer, biz => CatalogLogic.SearchAsync(biz, "uploads", Words(collection: team.ToString())))).Items;
        Assert.Contains(teamOnly, i => i.AssetKey == inTeam.Key);
        Assert.DoesNotContain(teamOnly, i => i.AssetKey == own.Key);

        // an image in a folder somebody shared with the person is under "Freigegeben"
        var folder = await As(Role.Designer, biz => FolderLogic.CreateAsync(biz, null, null, "Geteilt " + Guid.NewGuid().ToString("N")[..4]));
        var shared = (await As(Role.Designer, biz => AssetLogic.UploadAsync(biz, Name(), Image, null, null, folder.Id))).Asset!;
        await ShareAsync(Role.Designer, ItemKind.Folder, folder.Id, Role.Stranger);
        var sharedList = (await As(Role.Stranger, biz => CatalogLogic.SearchAsync(biz, "uploads", Words(collection: UploadsCatalog.SharedCollection)))).Items;
        Assert.Equal([shared.Key], sharedList.Select(i => i.AssetKey));
        Assert.Contains(await As(Role.Stranger, biz => CatalogLogic.CollectionsAsync(biz, "uploads")), c => c.Id == UploadsCatalog.SharedCollection);
    }

    // ------------------------------------------------------------------------------------------------ the folder catalogue

    private (string Name, string Dir) MakeFolder()
    {
        var name = "bilder" + Guid.NewGuid().ToString("N")[..6];
        var dir = Path.Combine(DataDir, "catalogs", name);
        Directory.CreateDirectory(Path.Combine(dir, "sub"));
        File.WriteAllBytes(Path.Combine(dir, "a.png"), Image);
        File.WriteAllText(Path.Combine(dir, "fake.png"), "kein Bild, nur Text");
        File.WriteAllBytes(Path.Combine(dir, "sub", "b.png"), Image);
        File.WriteAllText(Path.Combine(dir, "notiz.txt"), "text");
        return (name, dir);
    }

    [Fact]
    public async Task The_folder_catalogue_lists_what_the_bytes_call_a_picture()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var (name, _) = MakeFolder();
        await EnableAsync("folder", folders: [name]);
        var top = await As(Role.Designer, biz => CatalogLogic.SearchAsync(biz, "folder", Words()));
        Assert.Equal([name + "/a.png"], top.Items.Select(i => i.Id));   // fake.png and notiz.txt are not pictures
        Assert.Equal("a", top.Items[0].Title);
        Assert.Equal(192, top.Items[0].Width);
        Assert.StartsWith("/api/catalogs/thumb/", top.Items[0].Thumb);

        var collections = await As(Role.Designer, biz => CatalogLogic.CollectionsAsync(biz, "folder"));
        Assert.Equal([name, name + "/sub"], collections.Select(c => c.Id));
        Assert.Equal([name + "/sub/b.png"], (await As(Role.Designer, biz => CatalogLogic.SearchAsync(biz, "folder", Words(collection: name + "/sub")))).Items.Select(i => i.Id));
        Assert.Equal([name + "/sub/b.png"], (await As(Role.Designer, biz => CatalogLogic.SearchAsync(biz, "folder", Words("b")))).Items.Select(i => i.Id));
        Assert.Empty((await As(Role.Designer, biz => CatalogLogic.SearchAsync(biz, "folder", Words(collection: "../"))) ).Items);
    }

    [Fact]
    public async Task The_folder_catalogue_imports_a_file_once_it_is_used_and_reads_nothing_else()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var (name, dir) = MakeFolder();
        var hidden = "geheim" + Guid.NewGuid().ToString("N")[..6];
        Directory.CreateDirectory(Path.Combine(DataDir, "catalogs", hidden));
        File.WriteAllBytes(Path.Combine(DataDir, "catalogs", hidden, "x.png"), Image);
        File.WriteAllBytes(Path.Combine(DataDir, "ausserhalb.png"), Image);
        await EnableAsync("folder", folders: [name]);

        var imported = await As(Role.Designer, biz => CatalogLogic.ImportAsync(biz, "folder", name + "/sub/b.png"));
        Assert.Equal("b", imported.Asset.Name);
        Assert.Equal("Katalog: Ordner", imported.Asset.Category);
        Assert.True((await As(Role.Designer, biz => CatalogLogic.ImportAsync(biz, "folder", name + "/sub/b.png"))).Reused);

        var attacks = new[]
        {
            "../ausserhalb.png", name + "/../ausserhalb.png", name + "/../../ausserhalb.png", name + "/sub/../../" + hidden + "/x.png", "/etc/passwd", "C:\\Windows\\win.ini", "C:/Windows/win.ini",
            name + "\\a.png", name + "/a.png/..", name + "//a.png", name + "/./a.png", name + "/%2e%2e/ausserhalb.png", name + "/a.png\0.txt", hidden + "/x.png", "", " ", name, name + "/",
            name + "/fake.png", name + "/notiz.txt", name + "/gibt-es-nicht.png", Path.Combine(dir, "a.png"), "..", ".", "~/a.png", name + "/..\\ausserhalb.png",
        };
        foreach (var attack in attacks)
        {
            await Assert.ThrowsAsync<BizException>(() => As(Role.Designer, biz => CatalogLogic.ImportAsync(biz, "folder", attack)));
        }

        var importer = await UserAsync(Role.Designer);
        Assert.Equal(1, await Db(db => db.Asset.CountAsync(a => a.CreateUserId == importer && a.Category == "Katalog: Ordner" && a.Name == "b")));
    }

    [Fact]
    public async Task The_folder_catalogue_never_follows_a_link()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        var (name, dir) = MakeFolder();
        var outside = Path.Combine(DataDir, "linkziel-" + Guid.NewGuid().ToString("N")[..6]);
        Directory.CreateDirectory(outside);
        File.WriteAllBytes(Path.Combine(outside, "z.png"), Image);
        var linked = Path.Combine(dir, "verknuepft");
        try
        {
            Directory.CreateSymbolicLink(linked, outside);
            File.CreateSymbolicLink(Path.Combine(dir, "datei.png"), Path.Combine(outside, "z.png"));
        }
        catch (Exception ex) when (ex is UnauthorizedAccessException or IOException or PlatformNotSupportedException)
        {
            return;   // this machine does not let the test make links (Windows without the right): the rule is tested on the machines that do
        }

        await EnableAsync("folder", folders: [name]);
        var listed = (await As(Role.Designer, biz => CatalogLogic.SearchAsync(biz, "folder", Words("z")))).Items.Select(i => i.Id).ToList();
        Assert.Empty(listed);
        Assert.DoesNotContain(name + "/verknuepft", (await As(Role.Designer, biz => CatalogLogic.CollectionsAsync(biz, "folder"))).Select(c => c.Id));
        await Assert.ThrowsAsync<BizException>(() => As(Role.Designer, biz => CatalogLogic.ImportAsync(biz, "folder", name + "/verknuepft/z.png")));
        await Assert.ThrowsAsync<BizException>(() => As(Role.Designer, biz => CatalogLogic.ImportAsync(biz, "folder", name + "/datei.png")));
    }

    [Theory]
    [InlineData("bilder", true)]
    [InlineData("Archiv 2026", true)]
    [InlineData("Bäume_und-Wald.v2", true)]
    [InlineData("", false)]
    [InlineData(".", false)]
    [InlineData("..", false)]
    [InlineData("..bilder", false)]
    [InlineData(".versteckt", false)]
    [InlineData("a/b", false)]
    [InlineData("a\\b", false)]
    [InlineData("C:", false)]
    [InlineData("name.", false)]
    [InlineData("name ", false)]
    [InlineData("zu\nlang", false)]
    public void A_folder_name_is_a_plain_name(string name, bool expected) => Assert.Equal(expected, ServerFolders.IsFolderName(name));

    [Fact]
    public void A_path_below_a_folder_is_checked_name_by_name()
    {
        var root = Path.Combine(Path.GetTempPath(), "designthix-paths-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(root, "ordner", "sub"));
        File.WriteAllBytes(Path.Combine(root, "ordner", "sub", "x.png"), Image);
        var folders = new[] { "ordner" };
        Assert.Equal(Path.GetFullPath(Path.Combine(root, "ordner", "sub", "x.png")), ServerFolders.ResolvePath(root, folders, "ordner/sub/x.png"));
        Assert.Equal("ordner/sub/x.png", ServerFolders.RelativeOf(root, Path.Combine(root, "ordner", "sub", "x.png")));
        Assert.Null(ServerFolders.RelativeOf(root, Path.Combine(root, "..", "x.png")));
        foreach (var bad in new[] { "ordner/../x.png", "ordner/sub/../../../x.png", "andere/x.png", "/ordner/x.png", "ordner\\x.png", "ordner/./x.png", "ordner//x.png", "ordner/x.png ", "ordner/x.png.", "ordner/.hidden.png", "ordner/a:b.png", "ordner/a*.png" })
        {
            Assert.Null(ServerFolders.ResolvePath(root, folders, bad));
        }

        Assert.Null(ServerFolders.ResolvePath(root, [], "ordner/sub/x.png"));   // a folder that was not named is not read
        Assert.Null(ServerFolders.ResolveFolder(root, "gibt-es-nicht"));
        Assert.NotNull(ServerFolders.ResolveFolder(root, "ordner"));
        Directory.Delete(root, true);
    }

    // ------------------------------------------------------------------------------------------------ the thumbnail proxy over HTTP

    [Fact]
    public async Task The_proxy_serves_pictures_for_valid_tokens_and_for_nothing_else()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await using var admins = await RealAdminsAsync();
        await EnableAsync("example-browse");
        var designer = await UserAsync(Role.Designer);
        var client = await SignInAsync(designer);
        var page = await As(Role.Designer, biz => CatalogLogic.SearchAsync(biz, "example-browse", Words("berg")));
        var thumb = page.Items.Single().Thumb;

        var ok = await client.GetAsync(thumb);
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.Equal("image/png", ok.Content.Headers.ContentType?.MediaType);
        Assert.Contains("private", ok.Headers.CacheControl?.ToString());
        Assert.Equal(Image, await ok.Content.ReadAsByteArrayAsync());
        var before = Seam.Requests.Count;
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(thumb)).StatusCode);
        Assert.Equal(before, Seam.Requests.Count);   // the second time it came from the cache on disk

        // changed, shortened, extended, expired, foreign tokens
        var token = thumb["/api/catalogs/thumb/".Length..];
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/catalogs/thumb/" + token[..^2] + (token[^2] == 'A' ? "B" : "A") + token[^1])).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/catalogs/thumb/" + token[..^3])).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/catalogs/thumb/" + token + "AAAA")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/catalogs/thumb/nonsense")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/catalogs/thumb/" + Svc.Proxy.Issue("example-browse", $"https://{Host}/img/p1.png", null, DateTimeOffset.UtcNow.AddMinutes(-1)))).StatusCode);

        // a token for an address on a host the catalogue may not reach: the proxy refuses and asks nobody
        var foreign = Svc.Proxy.AddressFor("example-browse", url: "https://evil.test/geheim.png");
        var refused = await client.GetAsync(foreign);
        Assert.False(refused.IsSuccessStatusCode);
        Assert.DoesNotContain(Seam.Requests, r => r.Url.Host == "evil.test");

        // a token for a catalogue that is switched off or does not exist
        var other = Svc.Proxy.AddressFor("example-search", url: $"https://{Host}/img/p1.png");
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(other)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(Svc.Proxy.AddressFor("pexels", url: $"https://{Host}/img/p1.png"))).StatusCode);

        // somebody who is not signed in
        var anonymous = Factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        var denied = await anonymous.GetAsync(thumb);
        Assert.True(denied.StatusCode is HttpStatusCode.Redirect or HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task The_proxy_does_not_hand_out_what_is_not_a_picture()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await using var admins = await RealAdminsAsync();
        await EnableAsync("example-browse");
        var client = await SignInAsync(await UserAsync(Role.Designer));
        var inner = Seam.Handler!;
        Seam.Handler = (request, ct) => request.RequestUri!.AbsolutePath == "/img/text.png"
            ? Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("<script>alert(1)</script>", Encoding.UTF8, "image/png") })
            : request.RequestUri.AbsolutePath == "/img/evil.svg"
                ? Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"10\" height=\"10\"><script>alert(1)</script><rect width=\"10\" height=\"10\" onload=\"x()\"/></svg>", Encoding.UTF8, "image/svg+xml") })
                : inner(request, ct);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(Svc.Proxy.AddressFor("example-browse", url: $"https://{Host}/img/text.png"))).StatusCode);
        var svg = await client.GetAsync(Svc.Proxy.AddressFor("example-browse", url: $"https://{Host}/img/evil.svg"));
        Assert.Equal(HttpStatusCode.OK, svg.StatusCode);
        var text = await svg.Content.ReadAsStringAsync();
        Assert.DoesNotContain("script", text);
        Assert.DoesNotContain("onload", text);
        Assert.Contains("default-src 'none'", string.Join(";", svg.Headers.GetValues("Content-Security-Policy")));
    }

    [Fact]
    public async Task The_proxy_serves_a_picture_of_the_server_folder_by_its_item()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await using var admins = await RealAdminsAsync();
        var (name, _) = MakeFolder();
        await EnableAsync("folder", folders: [name]);
        var client = await SignInAsync(await UserAsync(Role.Designer));
        var thumb = (await As(Role.Designer, biz => CatalogLogic.SearchAsync(biz, "folder", Words()))).Items.Single().Thumb;
        var ok = await client.GetAsync(thumb);
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.Equal(Image, await ok.Content.ReadAsByteArrayAsync());
        // a token that names a text file, an escape, or a url for this local catalogue
        foreach (var item in new[] { name + "/fake.png", name + "/../../x.png", "/etc/passwd" })
        {
            Assert.False((await client.GetAsync(Svc.Proxy.AddressFor("folder", itemId: item))).IsSuccessStatusCode, item);
        }

        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(Svc.Proxy.AddressFor("folder", url: "https://example-stock.test/img/p1.png"))).StatusCode);
    }

    // ------------------------------------------------------------------------------------------------ the endpoints and the pages

    [Fact]
    public async Task The_endpoints_answer_a_signed_in_person_and_import_through_the_antiforgery_check()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await using var admins = await RealAdminsAsync();
        await EnableAsync("example-browse");
        var client = await SignInAsync(await UserAsync(Role.Designer));

        var list = JsonNode.Parse(await client.GetStringAsync("/api/catalogs"))!.AsArray();
        var example = list.Single(c => c!["id"]!.GetValue<string>() == "example-browse")!;
        Assert.Equal("Beispiel-Katalog", example["name"]!.GetValue<string>());
        Assert.True(example["caps"]!["browse"]!.GetValue<bool>());
        Assert.True(example["external"]!.GetValue<bool>());
        Assert.Equal("Bilder vom Beispielanbieter", example["provider"]!["text"]!.GetValue<string>());
        Assert.DoesNotContain(list, c => c!["id"]!.GetValue<string>() == "example-search");

        var search = JsonNode.Parse(await client.GetStringAsync("/api/catalogs/example-browse/search?q=berg"))!;
        Assert.Equal("p1", search["items"]![0]!["id"]!.GetValue<string>());
        Assert.Equal("CC-BY-4.0", search["items"]![0]!["licence"]!["code"]!.GetValue<string>());
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/catalogs/example-search/search?q=berg")).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await client.GetAsync("/api/catalogs/example-browse/search?q=limit")).StatusCode);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await client.GetAsync("/api/catalogs/example-browse/search?q=down")).StatusCode);

        var noToken = await client.PostAsync("/api/catalogs/example-browse/import", new StringContent("""{"itemId":"p2"}""", Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, noToken.StatusCode);
        var imported = await ApiPostAsync(client, "/api/catalogs/example-browse/import", new { itemId = "p2" });
        Assert.Equal(HttpStatusCode.OK, imported.StatusCode);
        var asset = JsonNode.Parse(await imported.Content.ReadAsStringAsync())!;
        var waldweg = asset["key"]!.GetValue<string>();
        Assert.StartsWith("waldweg", waldweg);
        Assert.StartsWith("/media/" + waldweg + "?v=", asset["url"]!.GetValue<string>());
        Assert.False(asset["reused"]!.GetValue<bool>());
        Assert.Equal(HttpStatusCode.NotFound, (await ApiPostAsync(client, "/api/catalogs/example-search/import", new { itemId = "p2" })).StatusCode);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await ApiPostAsync(client, "/api/catalogs/example-browse/import", new { itemId = "nc1" })).StatusCode);   // a licence that is not allowed

        var design = await DesignWithImageAsync(Role.Designer, waldweg);
        var credits = JsonNode.Parse(await client.GetStringAsync($"/api/designs/{design}/credits"))!;
        Assert.Equal("Ben Beispiel", credits["items"]![0]!["author"]!.GetValue<string>());
        var stranger = await SignInAsync(await UserAsync(Role.Stranger));
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/api/designs/{design}/credits")).StatusCode);
    }

    [Fact]
    public async Task The_admin_pages_are_for_administrators_and_never_show_a_key()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await using var admins = await RealAdminsAsync();
        var member = await SignInAsync(await UserAsync(Role.Designer));
        var denied = await member.GetAsync("/Admin/Catalogs");
        Assert.NotEqual(HttpStatusCode.OK, denied.StatusCode);

        var admin = await SignInAsync(admins.Ids[0]);
        var index = await admin.GetStringAsync("/Admin/Catalogs");
        Assert.Contains("Mitgeliefert", index);
        Assert.Contains("Beispiel-Katalog", index);

        var edit = await admin.GetStringAsync("/Admin/Catalogs/Edit?id=example-search");
        Assert.Contains("Schlüssel", edit);
        var post = await admin.PostAsync("/Admin/Catalogs/Edit?id=example-search", new FormUrlEncodedContent(
        [
            new("Id", "example-search"), new("Input.Enabled", "true"), new("Input.Order", "2"), new("Input.PerUserPerMinute", "7"), new("Input.PerHour", "50"), new("Input.SafeSearch", "true"),
            new("Input.Key", "page-key-8123"), new("__RequestVerificationToken", FormToken(edit)),
        ]));
        Assert.Equal(HttpStatusCode.Redirect, post.StatusCode);
        Assert.Equal("page-key-8123", await Svc.Secrets.LoadAsync("example-search"));
        var after = await admin.GetStringAsync("/Admin/Catalogs/Edit?id=example-search");
        Assert.DoesNotContain("page-key-8123", after);
        Assert.Contains("Ein Schlüssel ist gespeichert", System.Net.WebUtility.HtmlDecode(after));
        var row = await As(Role.Admin, biz => CatalogLogic.AdminGetAsync(biz, "example-search"));
        Assert.Equal((true, 2, 7, 50), (row.Enabled, row.Setting.Order, row.Setting.PerUserPerMinute, row.Setting.PerHour));
        Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync("/Admin/Catalogs/Edit?id=gibt-es-nicht")).StatusCode);
    }

    // ------------------------------------------------------------------------------------------------ the guarded HTTP client (needs no app)

    private static CatalogHttp HttpWith(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> handler, out CatalogTestSeam seam)
    {
        seam = new CatalogTestSeam { Handler = handler };
        return new CatalogHttp(seam);
    }

    private static Task<CatalogHttpResult> Get(CatalogHttp http, string url, string[]? hosts = null, bool allowHttp = false, IReadOnlyDictionary<string, string>? headers = null, long max = 1024 * 1024, double seconds = 5)
        => http.GetAsync(new Uri(url), hosts ?? ["a.test"], allowHttp, "Beispiel", headers, TimeSpan.FromSeconds(seconds), max, CancellationToken.None);

    private static HttpResponseMessage Redirect(string to, HttpStatusCode code = HttpStatusCode.Found) => new(code) { Headers = { Location = new Uri(to, UriKind.RelativeOrAbsolute) } };

    [Fact]
    public async Task The_client_only_talks_to_the_hosts_of_the_catalogue()
    {
        var http = HttpWith((_, _) => Task.FromResult(Json("{}")), out var seam);
        var other = await Assert.ThrowsAsync<CatalogException>(() => Get(http, "https://other.test/x"));
        Assert.Equal(CatalogFailure.Refused, other.Failure);
        Assert.Equal(CatalogFailure.Refused, (await Assert.ThrowsAsync<CatalogException>(() => Get(http, "http://a.test/x"))).Failure);   // no plain http unless the operator allowed it
        Assert.Equal(CatalogFailure.Refused, (await Assert.ThrowsAsync<CatalogException>(() => Get(http, "https://user:pass@a.test/x"))).Failure);
        Assert.Equal(CatalogFailure.Refused, (await Assert.ThrowsAsync<CatalogException>(() => Get(http, "ftp://a.test/x"))).Failure);
        Assert.Empty(seam.Requests);
        Assert.Equal(200, (await Get(http, "https://A.test/x")).Status);   // host names have no case
        Assert.Equal(200, (await Get(http, "http://a.test/x", allowHttp: true)).Status);
    }

    [Fact]
    public async Task A_redirect_to_another_host_is_refused_and_one_within_the_list_is_followed()
    {
        var http = HttpWith((request, _) => Task.FromResult(request.RequestUri!.AbsolutePath switch
        {
            "/to-evil" => Redirect("https://evil.test/steal"),
            "/to-b" => Redirect("https://b.test/arrived"),
            "/relative" => Redirect("/final"),
            "/loop" => Redirect("/loop"),
            "/final" or "/arrived" => Json("{\"ok\":true}"),
            _ => new HttpResponseMessage(HttpStatusCode.NotFound),
        }), out var seam);
        var evil = await Assert.ThrowsAsync<CatalogException>(() => Get(http, "https://a.test/to-evil"));
        Assert.Equal(CatalogFailure.Refused, evil.Failure);
        Assert.DoesNotContain(seam.Requests, r => r.Url.Host == "evil.test");
        Assert.Equal(200, (await Get(http, "https://a.test/relative")).Status);
        Assert.Equal(CatalogFailure.Refused, (await Assert.ThrowsAsync<CatalogException>(() => Get(http, "https://a.test/loop"))).Failure);   // at most three hops

        // the key goes to the host it was meant for and to no other, also when both hosts are allowed
        seam.Requests.Clear();
        var key = new Dictionary<string, string> { ["Authorization"] = "geheim" };
        await Get(http, "https://a.test/to-b", ["a.test", "b.test"], headers: key);
        Assert.Equal("geheim", seam.Requests[0].Headers["Authorization"]);
        Assert.Equal("b.test", seam.Requests[1].Url.Host);
        Assert.False(seam.Requests[1].Headers.ContainsKey("Authorization"));
    }

    [Fact]
    public async Task The_client_stops_what_is_too_big_what_is_too_slow_and_names_what_went_wrong()
    {
        var big = new byte[3000];
        var http = HttpWith((request, ct) => request.RequestUri!.AbsolutePath switch
        {
            "/declared" => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent(big) }),
            "/streamed" => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StreamContent(new ChunkedStream(5000)) }),
            "/limit" => Task.FromResult(new HttpResponseMessage((HttpStatusCode)429) { Headers = { RetryAfter = new RetryConditionHeaderValue(TimeSpan.FromSeconds(42)) } }),
            "/key" => Task.FromResult(new HttpResponseMessage(HttpStatusCode.Unauthorized)),
            "/forbidden" => Task.FromResult(new HttpResponseMessage(HttpStatusCode.Forbidden)),
            "/gone" => Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound)),
            "/error" => Task.FromResult(new HttpResponseMessage(HttpStatusCode.BadGateway)),
            "/broken" => throw new HttpRequestException("connection refused"),
            "/slow" => SlowAsync(ct),
            _ => Task.FromResult(Json("{}")),
        }, out _);
        async Task<HttpResponseMessage> SlowAsync(CancellationToken token)
        {
            await Task.Delay(TimeSpan.FromSeconds(10), token);
            return Json("{}");
        }

        async Task<CatalogException> Fails(string path, double seconds = 5) => await Assert.ThrowsAsync<CatalogException>(() => Get(http, "https://a.test" + path, max: 2048, seconds: seconds));
        Assert.Equal(CatalogFailure.TooLarge, (await Fails("/declared")).Failure);
        Assert.Equal(CatalogFailure.TooLarge, (await Fails("/streamed")).Failure);
        var limit = await Fails("/limit");
        Assert.Equal((CatalogFailure.Limit, 42), (limit.Failure, limit.RetryAfterSeconds));
        Assert.Equal(CatalogFailure.Key, (await Fails("/key")).Failure);
        Assert.Equal(CatalogFailure.Key, (await Fails("/forbidden")).Failure);
        Assert.Equal(CatalogFailure.NotFound, (await Fails("/gone")).Failure);
        Assert.Equal(CatalogFailure.Unavailable, (await Fails("/error")).Failure);
        Assert.Equal(CatalogFailure.Unavailable, (await Fails("/broken")).Failure);
        var slow = await Fails("/slow", 0.2);
        Assert.Equal(CatalogFailure.Unavailable, slow.Failure);
        Assert.Contains("antwortet nicht", slow.Message);
        Assert.Equal(200, (await Get(http, "https://a.test/fine", max: 2048)).Status);
    }

    /// <summary>A body without a length: <paramref name="size"/> bytes in chunks.</summary>
    private sealed class ChunkedStream(int size) : Stream
    {
        private int _left = size;

        public override bool CanRead => true;

        public override bool CanSeek => false;

        public override bool CanWrite => false;

        public override long Length => throw new NotSupportedException();

        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }

        public override void Flush()
        {
        }

        public override int Read(byte[] buffer, int offset, int count)
        {
            var n = Math.Min(Math.Min(count, 1000), _left);
            _left -= n;
            return n;
        }

        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();

        public override void SetLength(long value) => throw new NotSupportedException();

        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }

    // ------------------------------------------------------------------------------------------------ tokens and licences (need no app)

    [Fact]
    public void A_thumbnail_token_cannot_be_changed_or_used_after_it_expired()
    {
        var proxy = new CatalogProxy(new EphemeralDataProtectionProvider());
        var token = proxy.Issue("pexels", "https://images.pexels.com/a.jpg", null, DateTimeOffset.UtcNow.AddHours(1));
        var read = proxy.Read(token);
        Assert.Equal(new ThumbToken("pexels", "https://images.pexels.com/a.jpg", null), read);
        Assert.Equal("folder", proxy.Read(proxy.Issue("folder", null, "ordner/a.png", DateTimeOffset.UtcNow.AddHours(1)))?.Catalog);
        Assert.StartsWith("/api/catalogs/thumb/", proxy.AddressFor("pexels", url: "https://images.pexels.com/a.jpg"));
        Assert.DoesNotContain("pexels", token);   // the address is inside the token, encrypted

        var tampered = token[..^4] + (token[^4] == 'a' ? 'b' : 'a') + token[^3..];
        Assert.Null(proxy.Read(tampered));
        Assert.Null(proxy.Read(token[..^6]));
        Assert.Null(proxy.Read(token + "xx"));
        Assert.Null(proxy.Read(proxy.Issue("pexels", "https://images.pexels.com/a.jpg", null, DateTimeOffset.UtcNow.AddSeconds(-2))));
        Assert.Null(proxy.Read(null));
        Assert.Null(proxy.Read(""));
        Assert.Null(proxy.Read(new string('A', 5000)));
        Assert.Null(proxy.Read("kein-token"));
        // a token of another installation (another key ring) is no token here
        Assert.Null(new CatalogProxy(new EphemeralDataProtectionProvider()).Read(token));
    }

    [Theory]
    [InlineData("CC0-1.0", true)]
    [InlineData("cc0", true)]
    [InlineData("CC-BY-4.0", true)]
    [InlineData("CC BY 4.0", true)]
    [InlineData("CC-BY-SA-4.0", true)]
    [InlineData("MIT", true)]
    [InlineData("Apache-2.0", true)]
    [InlineData("ISC", true)]
    [InlineData("OFL-1.1", true)]
    [InlineData("pdm", true)]
    [InlineData("Pexels", true)]
    [InlineData("CC-BY-NC-4.0", false)]
    [InlineData("CC BY-NC-SA 2.0", false)]
    [InlineData("CC-BY-ND-4.0", false)]
    [InlineData("cc by nc nd", false)]
    [InlineData("CC-BY-NC", false)]
    [InlineData("Non-Commercial", false)]
    [InlineData("GPL-3.0", false)]
    [InlineData("ALL-RIGHTS-RESERVED", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void Only_licences_that_allow_commercial_use_and_changes_are_usable(string? code, bool expected) => Assert.Equal(expected, CatalogLicences.IsUsable(code));

    [Fact]
    public void Text_and_addresses_of_a_provider_are_cleaned_before_they_are_kept()
    {
        Assert.Equal("", CatalogLicences.SafeUrl("javascript:alert(1)"));
        Assert.Equal("", CatalogLicences.SafeUrl("data:text/html,x"));
        Assert.Equal("", CatalogLicences.SafeUrl("/relativ"));
        Assert.Equal("https://example.org/a", CatalogLicences.SafeUrl("https://example.org/a"));
        Assert.Equal("Anna Beispiel", CatalogLicences.Clean(" Anna\u202E Be\u200Bis\u0007piel ", 80));
        Assert.Equal(5, CatalogLicences.Clean("abcdefghij", 5).Length);
        Assert.True(CatalogLicences.NeedsAttribution("CC-BY-4.0"));
        Assert.False(CatalogLicences.NeedsAttribution("CC0-1.0"));
    }

    [Fact]
    public async Task A_cache_cleanup_removes_what_has_expired()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await Db(async db =>
        {
            db.CatalogCacheEntry.Add(new CatalogCacheEntry { Catalog = "example-browse", KeyHash = "alt" + Guid.NewGuid().ToString("N"), ResponseJson = "{}", ExpiresDate = DateTime.UtcNow.AddHours(-1) });
            db.CatalogCacheEntry.Add(new CatalogCacheEntry { Catalog = "example-browse", KeyHash = "neu" + Guid.NewGuid().ToString("N"), ResponseJson = "{}", ExpiresDate = DateTime.UtcNow.AddHours(1) });
            await db.SaveChangesAsync();
        });
        await Factory.Services.GetRequiredService<CatalogCacheCleaner>().RunOnceAsync();
        Assert.Equal(0, await Db(db => db.CatalogCacheEntry.CountAsync(e => e.KeyHash.StartsWith("alt"))));
        Assert.Equal(1, await Db(db => db.CatalogCacheEntry.CountAsync(e => e.KeyHash.StartsWith("neu"))));
    }
}
