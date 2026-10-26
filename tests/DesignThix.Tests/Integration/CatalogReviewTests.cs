using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json.Nodes;
using DesignThix.Catalogs;
using DesignThix.Core.Media;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DesignThix.Tests.Integration;

/// <summary>
/// The security review of plan 5 (docs/PLAN-CATALOGS.md, "Security review (C3)"): what was found is fixed and each fix has a test here. SSRF (the hosts of every catalogue, IP literals, a name that points
/// into the network), proxy tokens, the licence filter against crafted ids (the other tests of the plan have them per catalogue), quotas, what is served from the library when a provider is gone, and the
/// answers of the icons endpoint.
/// </summary>
[Collection("app")]
public sealed class CatalogReviewTests(AppTests.AppFactory factory) : PlatformTestBase(factory)
{
    private CatalogServices Svc => Factory.Services.GetRequiredService<CatalogServices>();

    private CatalogTestSeam CatalogSeam => Factory.Services.GetRequiredService<CatalogTestSeam>();

    // ------------------------------------------------------------------------------------------------ private addresses

    [Theory]
    [InlineData("127.0.0.1", true)]
    [InlineData("127.1.2.3", true)]
    [InlineData("10.0.0.1", true)]
    [InlineData("10.255.255.255", true)]
    [InlineData("172.16.0.1", true)]
    [InlineData("172.31.255.255", true)]
    [InlineData("172.15.0.1", false)]
    [InlineData("172.32.0.1", false)]
    [InlineData("192.168.1.1", true)]
    [InlineData("192.169.1.1", false)]
    [InlineData("169.254.169.254", true)]      // the metadata service of the clouds
    [InlineData("169.253.1.1", false)]
    [InlineData("100.64.0.1", true)]           // shared address space (carrier grade NAT)
    [InlineData("100.127.255.255", true)]
    [InlineData("100.128.0.1", false)]
    [InlineData("0.0.0.0", true)]
    [InlineData("0.1.2.3", true)]
    [InlineData("198.18.0.1", true)]
    [InlineData("224.0.0.1", true)]
    [InlineData("255.255.255.255", true)]
    [InlineData("::1", true)]
    [InlineData("::", true)]
    [InlineData("fe80::1", true)]
    [InlineData("fc00::1", true)]
    [InlineData("fd12:3456::1", true)]
    [InlineData("ff02::1", true)]
    [InlineData("::ffff:127.0.0.1", true)]     // an IPv4 address in an IPv6 coat
    [InlineData("::ffff:10.0.0.5", true)]
    [InlineData("::ffff:8.8.8.8", false)]
    [InlineData("8.8.8.8", false)]
    [InlineData("1.1.1.1", false)]
    [InlineData("104.18.0.1", false)]
    [InlineData("2606:4700:4700::1111", false)]
    public void Private_and_local_addresses_are_recognised(string address, bool expected) => Assert.Equal(expected, CatalogHttp.IsPrivateAddress(IPAddress.Parse(address)));

    private sealed class LocalServer : IDisposable
    {
        private readonly TcpListener _listener = new(IPAddress.Loopback, 0);

        public int Accepted;

        public int Port => ((IPEndPoint)_listener.LocalEndpoint).Port;

        public LocalServer()
        {
            _listener.Start();
            _ = Task.Run(async () =>
            {
                try
                {
                    while (true)
                    {
                        using var client = await _listener.AcceptTcpClientAsync();
                        Interlocked.Increment(ref Accepted);
                        var stream = client.GetStream();
                        var buffer = new byte[4096];
                        _ = await stream.ReadAsync(buffer);
                        const string body = "{}";
                        await stream.WriteAsync(Encoding.ASCII.GetBytes($"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {body.Length}\r\nConnection: close\r\n\r\n{body}"));
                    }
                }
                catch (Exception ex) when (ex is ObjectDisposedException or SocketException or IOException or InvalidOperationException)
                {
                }
            });
        }

        public void Dispose() => _listener.Stop();
    }

    [Fact]
    public async Task A_name_that_points_into_the_network_is_never_connected_to_for_a_host_the_catalogue_brings_itself()
    {
        using var server = new LocalServer();
        using var http = new CatalogHttp();
        var url = new Uri($"http://127.0.0.1:{server.Port}/x");
        TimeSpan timeout = TimeSpan.FromSeconds(5);

        // a host of the built-in list: the address is private, so there is no connection at all
        var refused = await Assert.ThrowsAsync<CatalogException>(() => http.GetAsync(url, ["127.0.0.1"], true, "Beispiel", null, timeout, 4096, default, ["127.0.0.1"]));
        Assert.Equal(CatalogFailure.Unavailable, refused.Failure);
        Assert.Equal(0, Volatile.Read(ref server.Accepted));
        var byName = await Assert.ThrowsAsync<CatalogException>(() => http.GetAsync(new Uri($"http://localhost:{server.Port}/x"), ["localhost"], true, "Beispiel", null, timeout, 4096, default, ["localhost"]));
        Assert.Equal(CatalogFailure.Unavailable, byName.Failure);
        Assert.Equal(0, Volatile.Read(ref server.Accepted));

        // without a list every host is guarded unless the operator allowed plain http (a fake provider on this machine)
        await Assert.ThrowsAsync<CatalogException>(() => http.GetAsync(new Uri($"https://127.0.0.1:{server.Port}/x"), ["127.0.0.1"], false, "Beispiel", null, timeout, 4096, default));
        Assert.Equal(0, Volatile.Read(ref server.Accepted));

        // the host the operator typed (not in the catalogue's own list) is trusted: that is how an Iconify server of the company or the fake providers of the checks work
        var allowed = await http.GetAsync(url, ["127.0.0.1"], true, "Beispiel", null, timeout, 4096, default, ["api.iconify.design"]);
        Assert.Equal(200, allowed.Status);
        Assert.Equal(1, Volatile.Read(ref server.Accepted));
        Assert.Equal(200, (await http.GetAsync(url, ["127.0.0.1"], true, "Beispiel", null, timeout, 4096, default)).Status);
    }

    // ------------------------------------------------------------------------------------------------ SSRF: the hosts of every catalogue

    public static IEnumerable<object[]> ForeignAddresses =>
    [
        ["https://evil.test/x"],
        ["https://127.0.0.1/x"],
        ["https://[::1]/x"],
        ["https://169.254.169.254/latest/meta-data/"],
        ["https://10.0.0.1/x"],
        ["https://192.168.0.1/x"],
        ["https://localhost/x"],
        ["http://example.invalid/x"],
        ["ftp://example.invalid/x"],
        ["file:///etc/passwd"],
        ["https://user:pass@example.invalid/x"],
        ["https://example.invalid.evil.test/x"],
        ["https://evil.test/https://example.invalid/x"],
        ["https://example.invalid@evil.test/x"],
        ["https://2130706433/x"],
        ["https://0x7f000001/x"],
    ];

    [Theory]
    [MemberData(nameof(ForeignAddresses))]
    public void Every_catalogue_refuses_every_address_that_is_not_one_of_its_hosts(string address)
    {
        var uri = new Uri(address.Replace("example.invalid", "api.example-provider.test"), UriKind.Absolute);
        foreach (var catalog in Svc.Registry.All.Where(c => c.Caps.HasFlag(CatalogCaps.External)))
        {
            // the plain list of the catalogue (nothing the operator typed)
            var exception = Assert.Throws<CatalogException>(() => CatalogHttp.Check(uri, catalog.AllowedHosts, allowHttp: false, catalog.Name));
            Assert.Equal(CatalogFailure.Refused, exception.Failure);
        }
    }

    [Fact]
    public void The_hosts_of_every_catalogue_are_plain_names_on_https_and_nothing_else_gets_in()
    {
        foreach (var catalog in Svc.Registry.All.Where(c => c.Caps.HasFlag(CatalogCaps.External) && c.DefaultBaseUrl is not null))
        {
            Assert.StartsWith("https://", catalog.DefaultBaseUrl);
            var baseHost = new Uri(catalog.DefaultBaseUrl!).Host;
            Assert.Contains(baseHost, catalog.AllowedHosts);
            Assert.All(catalog.AllowedHosts, host =>
            {
                Assert.False(IPAddress.TryParse(host, out _), $"{catalog.Id}: {host} is an IP address");
                Assert.DoesNotContain("*", host);
                Assert.DoesNotContain("/", host);
                Assert.DoesNotContain(":", host);
                Assert.Equal(host.ToLowerInvariant(), host);
                // each of them accepts its own address over https and refuses the same name over plain http
                CatalogHttp.Check(new Uri($"https://{host}/x"), catalog.AllowedHosts, false, catalog.Name);
                Assert.Throws<CatalogException>(() => CatalogHttp.Check(new Uri($"http://{host}/x"), catalog.AllowedHosts, false, catalog.Name));
            });
        }
    }

    [Fact]
    public async Task The_address_of_a_provider_cannot_be_set_from_a_page_and_the_administration_page_does_not_post_one()
    {
        if (!Enabled)
        {
            return;
        }

        await using var admins = await RealAdminsAsync();
        var admin = await SignInAsync(admins.Ids[0]);
        var page = await admin.GetStringAsync("/Admin/Catalogs/Edit?id=iconify");
        Assert.DoesNotContain("BaseUrl\"", page.Replace("DESIGNTHIX__Catalogs__iconify__BaseUrl", ""), StringComparison.Ordinal);   // no input for it
        Assert.DoesNotContain("name=\"Input.BaseUrl\"", page, StringComparison.Ordinal);
        var settings = typeof(CatalogSetting).GetProperties().Select(p => p.Name);
        Assert.DoesNotContain(settings, n => n.Contains("Url", StringComparison.OrdinalIgnoreCase) || n.Contains("Host", StringComparison.OrdinalIgnoreCase));
    }

    // ------------------------------------------------------------------------------------------------ the proxy token for a font

    [Fact]
    public async Task A_changed_shortened_expired_or_foreign_token_never_serves_a_font_or_reaches_another_address()
    {
        if (!Enabled)
        {
            return;
        }

        CatalogSeam.Reset();
        CatalogSeam.Handler = (r, _) => Task.FromResult(r.RequestUri!.Host == "cdn.jsdelivr.net"
            ? new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent([.. "wOF2"u8.ToArray(), .. new byte[100]]) }
            : new HttpResponseMessage(HttpStatusCode.NotFound));
        await As(Role.Admin, async biz =>
        {
            await SettingLogic.SaveAsync(biz, SettingStore.Catalogs, new CatalogsSettings(), "Test");
            await CatalogLogic.SaveAsync(biz, "googlefonts", new CatalogInput(true, 0, 1000, 0, true, [], []));
        });
        await using var admins = await RealAdminsAsync();
        var client = await SignInAsync(await UserAsync(Role.Designer));
        var good = Svc.Proxy.Issue("googlefonts", "https://cdn.jsdelivr.net/fontsource/fonts/lobster@latest/latin-400-normal.woff2", null, DateTimeOffset.UtcNow.AddHours(1));
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/catalogs/thumb/" + good)).StatusCode);

        var flipped = good[..^3] + (good[^3] == 'A' ? 'B' : 'A') + good[^2..];
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/catalogs/thumb/" + flipped)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/catalogs/thumb/" + good[..^8])).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/catalogs/thumb/" + good + good)).StatusCode);
        var expired = Svc.Proxy.Issue("googlefonts", "https://cdn.jsdelivr.net/fontsource/fonts/lobster@latest/latin-400-normal.woff2", null, DateTimeOffset.UtcNow.AddSeconds(-5));
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/catalogs/thumb/" + expired)).StatusCode);

        // a token for another catalogue's host, or for a catalogue that is off, is turned away
        var foreign = Svc.Proxy.Issue("googlefonts", "https://evil.test/f.woff2", null, DateTimeOffset.UtcNow.AddHours(1));
        Assert.NotEqual(HttpStatusCode.OK, (await client.GetAsync("/api/catalogs/thumb/" + foreign)).StatusCode);
        Assert.DoesNotContain(CatalogSeam.Requests, r => r.Url.Host == "evil.test");
        var off = Svc.Proxy.Issue("iconify", "https://api.iconify.design/collections", null, DateTimeOffset.UtcNow.AddHours(1));
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/catalogs/thumb/" + off)).StatusCode);
        // a token for the file of an item of the server folder cannot be turned into a font of a provider
        var item = Svc.Proxy.Issue("googlefonts", null, "../../etc/passwd", DateTimeOffset.UtcNow.AddHours(1));
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/catalogs/thumb/" + item)).StatusCode);

        using var anonymous = Factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        Assert.NotEqual(HttpStatusCode.OK, (await anonymous.GetAsync("/api/catalogs/thumb/" + good)).StatusCode);
    }

    // ------------------------------------------------------------------------------------------------ what is stored does not depend on the provider

    [Fact]
    public async Task A_stored_icon_draws_when_the_catalogue_is_switched_off_and_the_provider_is_gone()
    {
        if (!Enabled)
        {
            return;
        }

        await Db(async db =>
        {
            await db.IconBody.Where(i => i.Prefix == "revtest").ExecuteDeleteAsync();
            db.IconBody.Add(new IconBody { Prefix = "revtest", Name = "home", Body = "<path fill=\"currentColor\" stroke=\"none\" d=\"M0 0h4v4z\"/>", Width = 16, Height = 16, LicenceCode = "MIT", SourceJson = "{}" });
            await db.SaveChangesAsync();
        });
        CatalogSeam.Reset();
        CatalogSeam.Handler = (_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.InternalServerError));
        await As(Role.Admin, async biz =>
        {
            await SettingLogic.SaveAsync(biz, SettingStore.Catalogs, new CatalogsSettings(), "Test");
            await CatalogLogic.ClearCacheAsync(biz);
        });
        await using var admins = await RealAdminsAsync();
        var client = await SignInAsync(await UserAsync(Role.Designer));
        var found = JsonNode.Parse(await client.GetStringAsync("/api/icons?names=revtest:home"))!.AsObject();
        Assert.Equal(16, (int)found["revtest:home"]!["width"]!);
        Assert.Empty(CatalogSeam.Requests);   // nobody asked a provider
        await Db(db => db.IconBody.Where(i => i.Prefix == "revtest").ExecuteDeleteAsync());
    }

    [Theory]
    [InlineData("mdi:home';drop table \"IconBody\";--")]
    [InlineData("mdi:home%00")]
    [InlineData("mdi:ho%25me")]
    [InlineData("*")]
    [InlineData("%")]
    [InlineData("mdi:%")]
    [InlineData("..%2f..%2fetc%2fpasswd")]
    public async Task The_icons_endpoint_takes_names_in_the_one_form_and_nothing_else(string names)
    {
        if (!Enabled)
        {
            return;
        }

        await using var admins = await RealAdminsAsync();
        var client = await SignInAsync(await UserAsync(Role.Designer));
        var response = await client.GetAsync("/api/icons?names=" + names);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty(JsonNode.Parse(await response.Content.ReadAsStringAsync())!.AsObject());
        _ = await Db(db => db.IconBody.CountAsync());   // the table is still there
    }

    // ------------------------------------------------------------------------------------------------ quotas

    [Fact]
    public async Task A_font_does_not_come_into_an_area_without_room_and_nothing_is_left_behind()
    {
        if (!Enabled)
        {
            return;
        }

        CatalogSeam.Reset();
        CatalogSeam.Handler = (r, _) => Task.FromResult(r.RequestUri!.Host switch
        {
            "api.fontsource.org" => new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("""[{"id":"lobster","family":"Lobster Review","subsets":["latin"],"weights":[400],"styles":["normal"],"category":"display","license":"OFL-1.1","type":"google"}]""", Encoding.UTF8, "application/json") },
            "cdn.jsdelivr.net" => new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent([.. "wOF2"u8.ToArray(), .. new byte[5000]]) },
            _ => new HttpResponseMessage(HttpStatusCode.NotFound),
        });
        await As(Role.Admin, async biz =>
        {
            await SettingLogic.SaveAsync(biz, SettingStore.Catalogs, new CatalogsSettings(), "Test");
            await CatalogLogic.ClearCacheAsync(biz);
            await CatalogLogic.SaveAsync(biz, "googlefonts", new CatalogInput(true, 0, 1000, 0, true, [], []));
        });
        var space = await As(Role.Designer, biz => biz.PersonalSpaceIdAsync());
        await As(Role.Admin, biz => StorageLogic.SetQuotaAsync(biz, space, 1000));
        var full = await Assert.ThrowsAsync<BizException>(() => As(Role.Designer, biz => CatalogLogic.ImportItemAsync(biz, "googlefonts", "lobster")));
        Assert.Contains("Speicherplatz", full.Message);
        Assert.Equal(0, await Db(db => db.Font.CountAsync(f => f.Family == "Lobster Review")));
        await As(Role.Admin, biz => StorageLogic.SetQuotaAsync(biz, space, null));
        Assert.False((await As(Role.Designer, biz => CatalogLogic.ImportItemAsync(biz, "googlefonts", "lobster"))).Font!.Reused);
        await Db(db => db.Font.Where(f => f.Family == "Lobster Review").ExecuteDeleteAsync());
    }

    [Fact]
    public async Task The_brake_of_the_person_counts_for_icons_and_fonts_and_a_stored_icon_is_free()
    {
        if (!Enabled)
        {
            return;
        }

        CatalogSeam.Reset();
        CatalogSeam.Handler = (r, _) => Task.FromResult(r.RequestUri!.AbsolutePath switch
        {
            "/collections" => new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("""{"mdi":{"name":"Material","total":5,"author":{"name":"P"},"license":{"title":"Apache 2.0","spdx":"Apache-2.0"},"palette":false}}""", Encoding.UTF8, "application/json") },
            "/mdi.json" => new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("""{"prefix":"mdi","width":24,"height":24,"icons":{"a":{"body":"<path fill=\"currentColor\" d=\"M0 0h4v4z\"/>"},"b":{"body":"<path fill=\"currentColor\" d=\"M0 0h5v5z\"/>"},"c":{"body":"<path fill=\"currentColor\" d=\"M0 0h6v6z\"/>"}}}""", Encoding.UTF8, "application/json") },
            _ => new HttpResponseMessage(HttpStatusCode.NotFound),
        });
        Svc.Limiter.Reset();
        await Db(db => db.IconBody.Where(i => i.Prefix == "mdi").ExecuteDeleteAsync());
        await As(Role.Admin, async biz =>
        {
            await SettingLogic.SaveAsync(biz, SettingStore.Catalogs, new CatalogsSettings(), "Test");
            await CatalogLogic.ClearCacheAsync(biz);
            await CatalogLogic.SaveAsync(biz, "iconify", new CatalogInput(true, 0, 3, 0, true, [], [], ["mdi"]));
        });
        Assert.False((await As(Role.Designer, biz => CatalogLogic.ImportItemAsync(biz, "iconify", "mdi:a"))).Icon!.Reused);   // collections + body + the import itself: three requests of this minute
        var limited = await Assert.ThrowsAsync<CatalogException>(() => As(Role.Designer, biz => CatalogLogic.ImportItemAsync(biz, "iconify", "mdi:b")));
        Assert.Equal(CatalogFailure.Limit, limited.Failure);
        // an icon that is stored costs nothing, however often it is asked for
        for (var i = 0; i < 6; i++)
        {
            Assert.True((await As(Role.Designer, biz => CatalogLogic.ImportItemAsync(biz, "iconify", "mdi:a"))).Icon!.Reused);
        }

        await Db(db => db.IconBody.Where(i => i.Prefix == "mdi").ExecuteDeleteAsync());
        Svc.Limiter.Reset();
    }

    // ------------------------------------------------------------------------------------------------ the sanitiser meets a hostile provider

    [Fact]
    public async Task A_provider_that_sends_hostile_bodies_gets_nothing_stored_and_nothing_served()
    {
        if (!Enabled)
        {
            return;
        }

        var bodies = new Dictionary<string, string>
        {
            ["script"] = """<path fill="currentColor" d="M0 0h4v4z"/><script>alert(1)</script>""",
            ["foreign"] = """<foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml" onclick="x()">x</div></foreignObject>""",
            ["href"] = """<a href="javascript:alert(1)"><path fill="currentColor" d="M0 0h4v4z"/></a>""",
            ["use"] = """<use href="https://evil.test/x.svg#a"/>""",
            ["style"] = """<path style="fill:url(https://evil.test/x)" d="M0 0h4v4z"/>""",
            ["event"] = """<path onload="alert(1)" fill="currentColor" d="M0 0h4v4z"/>""",
            ["image"] = """<image href="https://evil.test/track.png" width="5" height="5"/>""",
            ["entity"] = """<!DOCTYPE x [<!ENTITY a "b">]><path d="M0 0h4v4z"/>&a;""",
            ["huge"] = "<path fill=\"currentColor\" d=\"M0 0h4v4z\"/>" + new string(' ', 70_000),
        };
        var icons = new JsonObject();
        foreach (var (name, body) in bodies)
        {
            icons[name] = new JsonObject { ["body"] = body };
        }

        var evilJson = new JsonObject { ["prefix"] = "evilset", ["width"] = 24, ["height"] = 24, ["icons"] = icons }.ToJsonString();
        CatalogSeam.Reset();
        CatalogSeam.Handler = (r, _) => Task.FromResult(r.RequestUri!.AbsolutePath switch
        {
            "/collections" => new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("""{"evilset":{"name":"Böse","total":9,"author":{"name":"X"},"license":{"title":"MIT","spdx":"MIT"},"palette":false}}""", Encoding.UTF8, "application/json") },
            "/evilset.json" => new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(evilJson, Encoding.UTF8, "application/json") },
            "/search" => new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(new JsonObject { ["icons"] = new JsonArray([.. bodies.Keys.Select(k => (JsonNode)JsonValue.Create("evilset:" + k)!)]), ["total"] = 9, ["limit"] = 32, ["start"] = 0 }.ToJsonString(), Encoding.UTF8, "application/json") },
            _ => new HttpResponseMessage(HttpStatusCode.NotFound),
        });
        Svc.Limiter.Reset();
        await As(Role.Admin, async biz =>
        {
            await SettingLogic.SaveAsync(biz, SettingStore.Catalogs, new CatalogsSettings(), "Test");
            await CatalogLogic.ClearCacheAsync(biz);
            await CatalogLogic.SaveAsync(biz, "iconify", new CatalogInput(true, 0, 1000, 0, true, [], [], ["evilset"]));
        });
        var page = await As(Role.Designer, biz => CatalogLogic.SearchAsync(biz, "iconify", new CatalogQuery { Text = "x" }));
        Assert.Empty(page.Items);
        foreach (var name in bodies.Keys)
        {
            await Assert.ThrowsAsync<BizException>(() => As(Role.Designer, biz => CatalogLogic.ImportItemAsync(biz, "iconify", "evilset:" + name)));
        }

        Assert.Empty(await Db(db => db.IconBody.Where(i => i.Prefix == "evilset").ToListAsync()));
    }
}
