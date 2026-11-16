using System.Globalization;
using System.Text;
using MatCan.Catalogs;
using MatCan.Configuration;
using MatCan.Core.Ai;
using MatCan.Data;
using MatCan.Data.Entities;
using MatCan.Endpoints;
using MatCan.Logic;
using MatCan.Services;
using MatCan.Services.Ai;
using MatCan.Services.Auth;
using MatCan.Services.Mail;
using MatCan.UiKit;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Localization;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;

// The image checks itself (HEALTHCHECK in the Dockerfile): it needs no curl.
if (args.Contains("--healthcheck"))
{
    return await HealthCheck.RunAsync();
}

var dataDir = Environment.GetEnvironmentVariable("MATCAN_DATA") is { Length: > 0 } fromEnv
    ? fromEnv
    : Path.Combine(Directory.GetCurrentDirectory(), "data");
Directory.CreateDirectory(dataDir);
var config = new ConfigStore(dataDir);
Fmt.Configure(config.Current.Server.TimeZone);

var builder = WebApplication.CreateBuilder(args);

// Port 3043; ASPNETCORE_URLS still wins (tests, a reverse proxy on the same machine).
if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable("ASPNETCORE_URLS")))
{
    builder.WebHost.UseUrls($"http://+:{Environment.GetEnvironmentVariable("MATCAN_PORT") ?? "3043"}");
}

builder.Services.AddSingleton(config);
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddHttpContextAccessor();
builder.Services.AddMemoryCache();

// Sessions live in the database; the keys that protect the cookie and the secrets live in the data volume, so a restart keeps everybody signed in.
builder.Services.AddDataProtection()
    .SetApplicationName("MatCan")
    .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(dataDir, "keys")));

builder.Services.AddDbContextFactory<DtDbContext>(options => options
    .UseNpgsql(config.ConnectionString())
    .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.CoreEventId.PossibleIncorrectRequiredNavigationWithQueryFilterInteractionWarning)));
builder.Services.AddScoped(sp => sp.GetRequiredService<IDbContextFactory<DtDbContext>>().CreateDbContext());

builder.Services.AddSingleton<ICurrentUser, CurrentUser>();
builder.Services.AddSingleton<IconSprite>();
builder.Services.AddSingleton<SecretProtector>();
builder.Services.AddSingleton<SessionCache>();
builder.Services.AddSingleton<TwoFactorTicket>();
builder.Services.AddSingleton<ActivityLogger>();
builder.Services.AddSingleton<SetupState>();
builder.Services.AddSingleton<SettingStore>();
builder.Services.AddSingleton<AiSecretStore>();
builder.Services.AddSingleton<AiRateLimiter>();
builder.Services.AddSingleton<AiRenderBroker>();
builder.Services.AddSingleton<AiPartialStore>();
builder.Services.AddSingleton<AiAgentRunner>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<AiAgentRunner>());
builder.Services.AddSingleton<TrashPurger>();
builder.Services.AddSingleton<PresenceTracker>();
builder.Services.AddSingleton<MatCan.Catalogs.CatalogRegistry>();
builder.Services.AddSingleton<MatCan.Catalogs.CatalogHttp>();
builder.Services.AddSingleton<MatCan.Catalogs.CatalogProxy>();
builder.Services.AddSingleton<MatCan.Catalogs.CatalogLimiter>();
builder.Services.AddSingleton<MatCan.Catalogs.CatalogSecretStore>();
builder.Services.AddSingleton<MatCan.Catalogs.CatalogThumbCache>();
builder.Services.AddSingleton<MatCan.Catalogs.CatalogServices>();
builder.Services.AddSingleton<MatCan.Catalogs.CatalogCacheCleaner>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<MatCan.Catalogs.CatalogCacheCleaner>());
builder.Services.AddSingleton<PublicRateLimiter>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<TrashPurger>());
builder.Services.AddSingleton<MailQueue>();
builder.Services.AddSingleton<MailComposer>();
builder.Services.AddSingleton<MailSender>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<MailSender>());
builder.Services.AddSingleton<ChatGptLoginStates>();
builder.Services.AddScoped<SessionCookieEvents>();
builder.Services.AddScoped<SignInService>();
builder.Services.AddScoped<TwoFactorService>();
builder.Services.AddScoped<PublicUrl>();
builder.Services.AddScoped<Biz>();
builder.Services.AddScoped<ShellFactory>();

// The AI: generous timeouts (a reasoning model thinks first), no cookies, the app names itself (OpenAI's edge refuses a library default).
builder.Services.AddHttpClient("ai", c =>
{
    c.Timeout = TimeSpan.FromSeconds(280);
    c.DefaultRequestHeaders.UserAgent.ParseAdd(AiProfileLogic.UserAgent);
}).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { UseCookies = false });

builder.Services.AddAntiforgery(o => o.HeaderName = "RequestVerificationToken");

builder.Services.AddAuthentication(SignInService.CookieScheme)
    .AddCookie(SignInService.CookieScheme, options =>
    {
        options.Cookie.Name = ".MatCan";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = config.Current.Server.ForceSecureCookie ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;
        options.LoginPath = "/Account/Login";
        options.AccessDeniedPath = "/Account/AccessDenied";
        options.SlidingExpiration = false;
        options.EventsType = typeof(SessionCookieEvents);
    });

builder.Services.AddAuthorizationBuilder()
    // Everything needs a signed-in person unless a page says otherwise: a new page is closed by default. What a person may do with a design, a list or an upload is decided by the business layer
    // (Logic/Access: area, shares, links), not by a role; the only role of the pages is the administrator.
    .SetFallbackPolicy(new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder(SignInService.CookieScheme).RequireAuthenticatedUser().Build())
    .AddPolicy("Admin", p => p.AddAuthenticationSchemes(SignInService.CookieScheme).RequireRole(nameof(UserRole.Admin)))
    .AddPolicy("SignedIn", p => p.AddAuthenticationSchemes(SignInService.CookieScheme).RequireAuthenticatedUser());

builder.Services.AddRazorPages(options =>
{
    options.Conventions.AuthorizeFolder("/Admin", "Admin");
    options.Conventions.AuthorizeFolder("/Account", "SignedIn");
    options.Conventions.AllowAnonymousToPage("/Account/Login");
    options.Conventions.AllowAnonymousToPage("/Account/TwoFactor");
    options.Conventions.AllowAnonymousToPage("/Account/Setup");
    options.Conventions.AllowAnonymousToPage("/Account/Register");
    options.Conventions.AllowAnonymousToPage("/Account/Pending");
    options.Conventions.AllowAnonymousToPage("/Account/Invite");
    options.Conventions.AllowAnonymousToPage("/Account/AccessDenied");
    options.Conventions.AllowAnonymousToPage("/Offline");
    options.Conventions.AllowAnonymousToPage("/Share/View");
})
.AddMvcOptions(options => options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true);

// Numbers in forms and in the query string are always written the invariant way ("12.5"); the pages show them German with Fmt.
builder.Services.Configure<RequestLocalizationOptions>(options =>
{
    options.DefaultRequestCulture = new RequestCulture(CultureInfo.InvariantCulture);
    options.SupportedCultures = [CultureInfo.InvariantCulture];
    options.SupportedUICultures = [CultureInfo.InvariantCulture];
});

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

var app = builder.Build();
var logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Startup");

await DatabaseInitializer.InitializeAsync(app.Services, config, logger);
var settings = app.Services.GetRequiredService<SettingStore>();
await settings.LoadAsync();
await LibrarySeeder.SeedAsync(app.Services, app.Environment.WebRootPath, logger);
await DemoSeeder.SeedAsync(app.Services, logger);
await TemplateSeeder.SeedAsync(app.Services, logger);
await StartupFixes.RunAsync(app.Services, logger);

app.UseForwardedHeaders();
app.UseRequestLocalization();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
}

app.UseStatusCodePagesWithReExecute("/Error", "?code={0}");

// A rule of the business layer that says "not for you" ends the request with 403 (a thing the person may not even see with 404), whatever the page did or did not check.
app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (ForbiddenException) when (!context.Response.HasStarted)
    {
        context.Response.Clear();
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
    }
    catch (NotFoundException) when (!context.Response.HasStarted)
    {
        // a thing that is missing or that the person may not see looks the same: 404
        context.Response.Clear();
        context.Response.StatusCode = StatusCodes.Status404NotFound;
    }
});

app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;
    headers["X-Content-Type-Options"] = "nosniff";
    // The app is private: nothing of it is indexed (robots.txt and llms.txt are the two files that are meant to be read by crawlers).
    if (context.Request.Path.Value is not ("/robots.txt" or "/llms.txt"))
    {
        headers["X-Robots-Tag"] = "noindex, nofollow";
    }

    headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    headers["X-Frame-Options"] = "SAMEORIGIN";
    headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    // Nothing is loaded from another site: no external fonts, images, frames or scripts. Images may also be data: and blob: URLs (the designer draws
    // with them), fonts data: URLs (the standalone SVG of a design carries its fonts).
    var policy =
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; " +
        "frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'";
    headers["Content-Security-Policy"] = policy;
    // The one exception (Unsplash must be hotlinked): while such a catalogue is on, the editor pages of a signed-in person may load images from its image host, see CatalogCsp.
    CatalogCsp.WhenStarting(context, policy);
    await next();
});

// The web app manifest has its own type; the service worker must never be cached by the browser, or an update would wait for days.
var contentTypes = new FileExtensionContentTypeProvider();
contentTypes.Mappings[".webmanifest"] = "application/manifest+json";
contentTypes.Mappings[".ttf"] = "font/ttf";
contentTypes.Mappings[".otf"] = "font/otf";
contentTypes.Mappings[".woff"] = "font/woff";
contentTypes.Mappings[".woff2"] = "font/woff2";
app.UseStaticFiles(new StaticFileOptions
{
    ContentTypeProvider = contentTypes,
    OnPrepareResponse = ctx =>
    {
        if (ctx.File.Name is "sw.js" or "manifest.webmanifest")
        {
            ctx.Context.Response.Headers.CacheControl = "no-cache";
        }
    },
});
app.UseAuthentication();

// Links in mails (no request at hand) use the address an administrator reached the app by: the Host header of a visitor is never trusted for that.
app.Use(async (context, next) =>
{
    if (context.User.Identity?.IsAuthenticated == true && context.User.IsInRole(nameof(UserRole.Admin)))
    {
        PublicUrl.RememberAdmin(context);
    }

    await next();
});

// While there is no administrator the only page is the one that makes the first one.
app.Use(async (context, next) =>
{
    var path = context.Request.Path;
    if (!path.StartsWithSegments("/Account/Setup") && !path.StartsWithSegments("/health") && !path.StartsWithSegments("/css")
        && !path.StartsWithSegments("/js") && !path.StartsWithSegments("/ui") && !path.StartsWithSegments("/img") && !path.StartsWithSegments("/fonts") && !path.StartsWithSegments("/builtin") && !path.StartsWithSegments("/Offline")
        && !path.Value!.EndsWith(".svg", StringComparison.OrdinalIgnoreCase) && !path.Value.EndsWith(".webmanifest", StringComparison.OrdinalIgnoreCase)
        && path.Value is not ("/sw.js" or "/robots.txt" or "/llms.txt")
        && !await context.RequestServices.GetRequiredService<SetupState>().HasAdminAsync(context.RequestServices))
    {
        context.Response.Redirect("/Account/Setup");
        return;
    }

    await next();
});

app.UseAuthorization();

app.MapGet("/health", async (DtDbContext db) =>
{
    await db.Database.CanConnectAsync();
    return Results.Text("ok");
}).AllowAnonymous();

app.MapPost("/api/theme", (HttpContext http, IAntiforgery antiforgery, Biz biz, SignInService signIn) => LibraryEndpoints.Guard(http, antiforgery, async () =>
{
    var theme = http.Request.Form["theme"].ToString();
    if (theme is not ("system" or "light" or "dark"))
    {
        return Results.BadRequest();
    }

    await UserLogic.SetThemeAsync(biz, theme);
    await signIn.RefreshAsync(http, await UserLogic.MeAsync(biz));
    return Results.NoContent();
})).RequireAuthorization("SignedIn");

// ------------------------------------------------------------------------------------------------ crawlers and language models

// The work of the team is not public: crawlers may only read llms.txt.
app.MapGet("/robots.txt", () =>
{
    var sb = new StringBuilder();
    sb.AppendLine("User-agent: *");
    sb.AppendLine("Allow: /llms.txt");
    sb.AppendLine("Disallow: /");
    return Results.Text(sb.ToString(), "text/plain; charset=utf-8");
}).AllowAnonymous();

// llms.txt (https://llmstxt.org/): what this site is, in Markdown, for language models.
app.MapGet("/llms.txt", (HttpContext http, ConfigStore cfg, SettingStore store) =>
{
    var site = store.Get<SiteSettings>(SettingStore.Site);
    var root = PublicUrl.Base(cfg, http);
    var sb = new StringBuilder();
    sb.AppendLine($"# {(string.IsNullOrWhiteSpace(site.ServiceName) ? "MatCan" : site.ServiceName)}{(string.IsNullOrWhiteSpace(site.Company) ? "" : " – " + site.Company)}");
    sb.AppendLine();
    sb.AppendLine("> MatCan ist ein Offline-Canva: ein Designer für Etiketten, Karten, Flyer, Poster und Beiträge für soziale Medien mit fertigen Vorlagen. Zusätzlich füllt es ein Design über Platzhalter ({{Name}}) aus Datenlisten: ein Design druckt so viele Etiketten, wie die Datenliste Zeilen hat (Serienbrief-Prinzip).");
    sb.AppendLine();
    sb.AppendLine("Die Anwendung ist nicht öffentlich: Designs, Datenlisten, Medien und Einstellungen sind nur für angemeldete Benutzer sichtbar. Auf dieser Website werden keine personenbezogenen Daten veröffentlicht.");
    sb.AppendLine();
    sb.AppendLine("## Was MatCan kann");
    sb.AppendLine();
    sb.AppendLine("- Designer und Vorlagen: Text, Bilder, Formen, Symbole, QR- und Strichcodes auf mehreren Seiten in mm oder px, dazu fertige Vorlagen (Preisschilder, Visitenkarten, Flyer, Poster, Instagram-Beiträge); Schrift verkleinert sich bei Bedarf, bis sie passt.");
    sb.AppendLine("- Zusatz, Serien mit Daten: Platzhalter und Datenlisten (Felder wie Name, Preis oder Herkunftsland; CSV-Import und -Export, Einfügen aus Excel, KI-Import).");
    sb.AppendLine("- Medien und Schriften: eigene Bilder (PNG, JPEG, WebP, GIF, SVG) und Schriften; mitgeliefert sind Flaggen, Siegel und freie Schriften. Nichts wird aus dem Internet geladen.");
    sb.AppendLine("- Herunterladen und Serienausgaben: Druck oder PDF (ein Etikett pro Seite oder mehrere Etiketten auf einem Druckbogen mit Schnittmarken) und PNG-ZIP.");
    sb.AppendLine("- Läuft als installierbare App (PWA) und lässt sich auch ohne Verbindung lesen.");
    sb.AppendLine();
    sb.AppendLine("## Verweise");
    sb.AppendLine();
    sb.AppendLine($"- [Anmeldung]({root}/Account/Login): Zugang für die Benutzer der Installation");
    if (!string.IsNullOrWhiteSpace(site.PrivacyUrl) || !string.IsNullOrWhiteSpace(site.ImprintUrl))
    {
        sb.AppendLine();
        sb.AppendLine("## Optional");
        sb.AppendLine();
        if (!string.IsNullOrWhiteSpace(site.PrivacyUrl))
        {
            sb.AppendLine($"- [Datenschutz]({site.PrivacyUrl})");
        }

        if (!string.IsNullOrWhiteSpace(site.ImprintUrl))
        {
            sb.AppendLine($"- [Impressum]({site.ImprintUrl})");
        }
    }

    return Results.Text(sb.ToString(), "text/markdown; charset=utf-8");
}).AllowAnonymous();

// ------------------------------------------------------------------------------------------------ the AI (JSON for the pages)

app.MapGet("/api/admin/ai/instruction", (AiAction action, Biz biz) => Results.Ok(new { text = AiLogic.FullInstruction(biz, action) })).RequireAuthorization("Admin");

app.MapGet("/api/admin/ai/models", async (long? id, AiProvider provider, string? baseUrl, HttpContext http, Biz biz) =>
{
    // The key typed into the page comes as a header (never in the address of a request).
    var key = http.Request.Headers["X-Ai-Key"].ToString();
    var (models, error) = await AiProfileLogic.LoadModelsAsync(biz, id, provider, baseUrl, key);
    return Results.Ok(new { error, models = models?.Select(m => new { id = m.Id, name = m.Name, free = m.Free }) });
}).RequireAuthorization("Admin");

app.MapGet("/api/admin/ai/profiles/{id:long}/chatgpt", async (long id, Biz biz) =>
{
    var status = await AiProfileLogic.ChatGptStatusAsync(biz, id);
    return Results.Ok(ChatGptAccount.StatusJson(status));
}).RequireAuthorization("Admin");

app.MapLibraryEndpoints();
app.MapStudioEndpoints();
app.MapPlatformEndpoints();
app.MapShareEndpoints();
app.MapNotificationEndpoints();
app.MapCommentEndpoints();
app.MapOutputEndpoints();
app.MapAiEndpoints();
app.MapAiAgentEndpoints();
app.MapCatalogEndpoints();

app.MapRazorPages();

await app.RunAsync();
return 0;

/// <summary>Whether the first administrator exists: the question is asked on every request until the answer is yes, then never again.</summary>
public sealed class SetupState
{
    private volatile bool _done;

    public async Task<bool> HasAdminAsync(IServiceProvider services)
    {
        if (_done)
        {
            return true;
        }

        _done = await UserLogic.HasAdminAsync(services.GetRequiredService<DtDbContext>());
        return _done;
    }

    public void MarkDone() => _done = true;

    /// <summary>Asks again on the next request (the tests that make an administrator for a while).</summary>
    internal void Reset() => _done = false;
}

/// <summary>The command <c>dotnet MatCan.dll --healthcheck</c>: asks the running site; exit code 0 means healthy.</summary>
public static class HealthCheck
{
    public static async Task<int> RunAsync()
    {
        var port = Environment.GetEnvironmentVariable("MATCAN_PORT") ?? "3043";
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
            using var response = await client.GetAsync($"http://localhost:{port}/health");
            return response.IsSuccessStatusCode ? 0 : 1;
        }
        catch (HttpRequestException)
        {
            return 1;
        }
        catch (TaskCanceledException)
        {
            return 1;
        }
    }
}

/// <summary>Makes the entry point visible to the tests (<c>WebApplicationFactory&lt;Program&gt;</c>).</summary>
public partial class Program;
