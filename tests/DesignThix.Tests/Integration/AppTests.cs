using System.Net;
using DesignThix.Catalogs;
using DesignThix.Services.Ai;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace DesignThix.Tests.Integration;

/// <summary>One host and one database for all integration tests: the factory sets process-wide environment variables, so two of them must not start side by side.</summary>
[CollectionDefinition("app")]
public sealed class AppCollection : ICollectionFixture<AppTests.AppFactory>;

/// <summary>
/// The real app against a real PostgreSQL. Runs when DESIGNTHIX_TEST_DB names a server ("Host=localhost;Port=3045;Username=designthix;Password=designthix"),
/// as the CI does; skipped otherwise. Every run uses a database of its own.
/// </summary>
[Collection("app")]
public sealed class AppTests
{
    private readonly AppFactory _factory;

    public AppTests(AppFactory factory) => _factory = factory;

    public sealed class AppFactory : WebApplicationFactory<Program>
    {
        public static string? Connection => Environment.GetEnvironmentVariable("DESIGNTHIX_TEST_DB");

        /// <summary>Registers the test seams: of the AI (tests set <see cref="AiTestSeam.Handler"/> to answer instead of a provider, see AiTests) and of the catalogues (<see cref="CatalogTestSeam"/>: no request ever leaves the process, see CatalogTests).</summary>
        protected override void ConfigureWebHost(IWebHostBuilder builder) => builder.ConfigureServices(services =>
        {
            services.AddSingleton<AiTestSeam>();
            services.AddSingleton<CatalogTestSeam>();
        });

        public AppFactory()
        {
            if (Connection is null)
            {
                return;
            }

            var csb = new NpgsqlConnectionStringBuilder(Connection);
            Environment.SetEnvironmentVariable("DESIGNTHIX__Database__Host", csb.Host);
            Environment.SetEnvironmentVariable("DESIGNTHIX__Database__Port", csb.Port.ToString());
            Environment.SetEnvironmentVariable("DESIGNTHIX__Database__Username", csb.Username);
            Environment.SetEnvironmentVariable("DESIGNTHIX__Database__Password", csb.Password);
            Environment.SetEnvironmentVariable("DESIGNTHIX__Database__Database", "designthix_it_" + Guid.NewGuid().ToString("N")[..8]);
            Environment.SetEnvironmentVariable("DESIGNTHIX_DATA", Path.Combine(Path.GetTempPath(), "designthix-it-" + Guid.NewGuid().ToString("N")));
            Environment.SetEnvironmentVariable("ASPNETCORE_URLS", "http://127.0.0.1:0");
            // the two example catalogues exist only with an address; the seam answers for it (nothing is ever asked on the network)
            Environment.SetEnvironmentVariable("DESIGNTHIX__Catalogs__example-browse__BaseUrl", "https://example-stock.test");
            Environment.SetEnvironmentVariable("DESIGNTHIX__Catalogs__example-search__BaseUrl", "https://example-stock.test");
        }
    }

    private HttpClient Client() => _factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

    [Fact]
    public async Task The_app_starts_and_asks_for_the_first_administrator()
    {
        if (AppFactory.Connection is null)
        {
            return;
        }

        var client = Client();
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health")).StatusCode);
        var start = await client.GetAsync("/");
        Assert.Equal(HttpStatusCode.Redirect, start.StatusCode);
        Assert.Equal("/Account/Setup", start.Headers.Location?.OriginalString);
    }

    [Fact]
    public async Task Crawlers_only_see_llms_txt()
    {
        if (AppFactory.Connection is null)
        {
            return;
        }

        var client = Client();
        var robots = await client.GetStringAsync("/robots.txt");
        Assert.Contains("Disallow: /", robots);
        Assert.Contains("Allow: /llms.txt", robots);
        var llms = await client.GetStringAsync("/llms.txt");
        Assert.StartsWith("# ", llms);
        Assert.Contains("Datenlisten", llms);
    }

    [Fact]
    public async Task Pages_send_a_strict_content_security_policy()
    {
        if (AppFactory.Connection is null)
        {
            return;
        }

        var response = await Client().GetAsync("/health");
        var policy = response.Headers.GetValues("Content-Security-Policy").Single();
        Assert.Contains("script-src 'self'", policy);
        Assert.Contains("font-src 'self' data:", policy);
        Assert.Contains("img-src 'self' data: blob:", policy);
        Assert.Contains("form-action 'self'", policy);
        Assert.DoesNotContain("google", policy);
    }

    [Theory]
    [InlineData("/health")]
    [InlineData("/robots.txt")]
    [InlineData("/llms.txt")]
    [InlineData("/Account/Setup")]
    [InlineData("/Account/Login")]
    [InlineData("/Account/Register")]
    [InlineData("/Account/Pending")]
    [InlineData("/Einladung/6f9619ff-8b86-d011-b42d-00c04fc964ff")]
    [InlineData("/Offline")]
    [InlineData("/sw.js")]
    [InlineData("/manifest.webmanifest")]
    [InlineData("/css/app.css")]
    [InlineData("/logo.svg")]
    [InlineData("/does-not-exist")]
    [InlineData("/media/flag-de")]
    [InlineData("/Outputs/1/Run")]
    public async Task Every_kind_of_answer_carries_the_security_headers(string path)
    {
        if (AppFactory.Connection is null)
        {
            return;
        }

        // Signed out, the pages answer with a redirect to the setup or the sign-in: the headers belong to those answers too.
        var response = await Client().GetAsync(path);
        var policy = response.Headers.GetValues("Content-Security-Policy").Single();
        Assert.Contains("script-src 'self'", policy);
        Assert.Contains("object-src 'none'", policy);
        Assert.DoesNotContain("unsafe-inline", policy.Split(';').Single(p => p.Trim().StartsWith("script-src", StringComparison.Ordinal)));
        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("SAMEORIGIN", response.Headers.GetValues("X-Frame-Options").Single());
    }

    [Theory]
    [InlineData("/api/designs/1")]
    [InlineData("/api/datalists")]
    [InlineData("/api/fonts")]
    [InlineData("/api/outputs/1/payload")]
    [InlineData("/media/flag-de")]
    [InlineData("/fonts.css")]
    [InlineData("/Designs")]
    [InlineData("/Admin/Users")]
    [InlineData("/Admin/Teams")]
    [InlineData("/Admin/Platform")]
    [InlineData("/Admin/Mail")]
    [InlineData("/Teams")]
    [InlineData("/Teams/Create")]
    [InlineData("/Account/Notifications")]
    [InlineData("/Account/Invitations")]
    [InlineData("/api/notifications")]
    [InlineData("/api/notifications/count")]
    [InlineData("/api/designs/1/comments")]
    [InlineData("/api/designs/1/comments/mentions?q=a")]
    [InlineData("/api/catalogs")]
    [InlineData("/api/catalogs/builtin/collections")]
    [InlineData("/api/catalogs/builtin/search?q=a")]
    [InlineData("/api/catalogs/thumb/abc")]
    [InlineData("/api/designs/1/credits")]
    [InlineData("/Admin/Catalogs")]
    [InlineData("/Admin/Catalogs/Edit?id=builtin")]
    public async Task Nothing_of_the_library_is_served_to_a_visitor_who_is_not_signed_in(string path)
    {
        if (AppFactory.Connection is null)
        {
            return;
        }

        // Before the setup everything leads to the setup assistant; the library itself is closed either way.
        var response = await Client().GetAsync(path);
        Assert.True(response.StatusCode is HttpStatusCode.Redirect or HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden, $"{path} answered {(int)response.StatusCode}");
    }

    [Theory]
    [InlineData("/api/theme")]
    [InlineData("/api/notifications/read-all")]
    [InlineData("/api/notifications/1/read")]
    [InlineData("/api/designs/1/comments")]
    [InlineData("/api/comments/1/edit")]
    [InlineData("/api/comments/1/resolve")]
    [InlineData("/api/comments/1/reopen")]
    [InlineData("/api/comments/1/delete")]
    [InlineData("/api/designs/1")]
    [InlineData("/api/designs/1/thumbnail")]
    [InlineData("/api/datalists/1/rows")]
    [InlineData("/api/outputs/adhoc")]
    [InlineData("/api/outputs/1/ran")]
    [InlineData("/api/ai/datalists/1/import")]
    [InlineData("/api/ai/runs/1/apply")]
    [InlineData("/api/catalogs/builtin/import")]
    public async Task A_post_without_a_signed_in_person_is_not_accepted(string path)
    {
        if (AppFactory.Connection is null)
        {
            return;
        }

        var response = await Client().PostAsync(path, new StringContent("{}", System.Text.Encoding.UTF8, "application/json"));
        Assert.True(response.StatusCode is HttpStatusCode.Redirect or HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden, $"{path} answered {(int)response.StatusCode}");
    }
}
