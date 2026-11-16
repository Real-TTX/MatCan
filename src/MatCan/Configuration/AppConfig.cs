using System.Text.Json.Serialization;

namespace MatCan.Configuration;

/// <summary>
/// The configuration of the installation (JSON, <c>{data}/config/app.json</c>): how it is deployed and what the operator presets. What the
/// administrator changes in the app (AI, site) lives in the database (<see cref="Data.Entities.Setting"/>).
/// The sections <see cref="Database"/> and <see cref="Server"/> can be overridden by environment variables (<c>MATCAN__Database__Host</c>);
/// the compose files need none of them, the defaults match the stack.
/// </summary>
public sealed class AppConfig
{
    public DatabaseConfig Database { get; set; } = new();

    public ServerConfig Server { get; set; } = new();

    public SecurityConfig Security { get; set; } = new();

    public OperatorAiConfig Ai { get; set; } = new();

    /// <summary>What the operator presets per catalogue (docs/PLAN-CATALOGS.md section 4): a changed address of the provider, for tests and for a company that runs its own server. Only the file and the environment can set it, never the administration page (a page that names addresses would be a way to make the server ask for any address).</summary>
    public Dictionary<string, CatalogOperatorConfig> Catalogs { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

public sealed class DatabaseConfig
{
    public string Host { get; set; } = "db";

    public int Port { get; set; } = 5432;

    public string Database { get; set; } = "matcan";

    public string Username { get; set; } = "matcan";

    public string Password { get; set; } = "matcan";
}

public sealed class ServerConfig
{
    /// <summary>The address people use, for robots.txt and llms.txt ("https://design.example.de"). Empty: taken from the request.</summary>
    public string PublicUrl { get; set; } = "";

    /// <summary>"Europe/Berlin": the time zone of the installation, for dates and schedules.</summary>
    public string TimeZone { get; set; } = "Europe/Berlin";

    /// <summary>The cookie is marked secure when the site is reached over HTTPS (also behind a reverse proxy that says so).</summary>
    public bool ForceSecureCookie { get; set; }
}

public sealed class SecurityConfig
{
    public int SessionDays { get; set; } = 14;

    [JsonIgnore]
    public int MaxFailedLogins => 5;
}

/// <summary>
/// What the operator of the installation presets for the AI (the outermost layer of the instructions), and an optional relay that is used
/// when the administrator has set up no connection of their own. The app works fully without a relay.
/// </summary>
public sealed class OperatorAiConfig
{
    /// <summary>The operator's instruction, put before everything else.</summary>
    public string OperatorInstruction { get; set; } = "";

    /// <summary>An addition of the operator per action ("Test", later "DataImport", "DataFill", "TextSuggest").</summary>
    public Dictionary<string, string> ActionInstructions { get; set; } = [];

    /// <summary>An OpenAI-compatible endpoint of the operator (e.g. a cloud); empty: no relay.</summary>
    public string RelayUrl { get; set; } = "";

    public string RelayKey { get; set; } = "";

    public string RelayModel { get; set; } = "";
}

/// <summary>The operator's settings of one catalogue (<c>MATCAN__Catalogs__&lt;id&gt;__BaseUrl</c>).</summary>
public sealed class CatalogOperatorConfig
{
    /// <summary>The address of the provider's API instead of the built-in one (for example <c>http://127.0.0.1:3073</c> for the fake providers of the browser checks). Empty = the built-in address.</summary>
    public string BaseUrl { get; set; } = "";
}
