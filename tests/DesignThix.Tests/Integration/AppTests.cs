using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;
using Npgsql;

namespace DesignThix.Tests.Integration;

/// <summary>
/// The real app against a real PostgreSQL. Runs when DESIGNTHIX_TEST_DB names a server ("Host=localhost;Port=3045;Username=designthix;Password=designthix"),
/// as the CI does; skipped otherwise. Every run uses a database of its own.
/// </summary>
public sealed class AppTests : IClassFixture<AppTests.AppFactory>
{
    private readonly AppFactory _factory;

    public AppTests(AppFactory factory) => _factory = factory;

    public sealed class AppFactory : WebApplicationFactory<Program>
    {
        public static string? Connection => Environment.GetEnvironmentVariable("DESIGNTHIX_TEST_DB");

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
}
