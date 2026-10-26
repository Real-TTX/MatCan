using System.Collections.Concurrent;
using System.Text.Json;
using DesignThix.Data;
using DesignThix.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Logic;

/// <summary>The AI as the administrator set it up: on or off, the base instruction of the site, personal data, the limits.</summary>
public sealed class AiSettings
{
    public bool Enabled { get; set; } = true;

    /// <summary>The base instruction of the site; empty means the built-in text.</summary>
    public string BaseInstruction { get; set; } = "";

    /// <summary>Personal data (names, addresses and phone numbers in data lists) may go to the model. Off: lists that contain personal data are refused.</summary>
    public bool SendPersonalData { get; set; }

    /// <summary>The additions of the site per action (the key is the name of <c>AiAction</c>): the layer between the base instruction and the fixed part. Empty = none.</summary>
    public Dictionary<string, string> ActionInstructions { get; set; } = [];

    public int UserDailyTokens { get; set; } = 200_000;

    /// <summary>How many tokens one person may use per month (0 = no limit).</summary>
    public int UserMonthlyTokens { get; set; } = 2_000_000;

    public int MonthlyTokens { get; set; } = 5_000_000;

    /// <summary>How many runs one address (by the daily hash of the address) may start per day.</summary>
    public int AddressDailyRuns { get; set; } = 60;

    /// <summary>How many calls one address may start per minute.</summary>
    /// <summary>How many calls one address may start per minute. A run of the design assistant makes one call per step, so the default leaves room for several runs.</summary>
    public int PerMinutePerAddress { get; set; } = 30;

    public int MaxTokens { get; set; } = 16_000;

    public int TimeoutSeconds { get; set; } = 280;

    // ---- the design assistant (docs/PLAN-AI-DESIGN.md 3.7) ----

    /// <summary>How many calls of the model one run (one message) may make before it stops with "Limit erreicht" and a button to go on.</summary>
    public int AgentMaxCallsPerRun { get; set; } = 40;

    /// <summary>The length cap of one answer of the design assistant (a reasoning model thinks inside it).</summary>
    public int AgentMaxTokens { get; set; } = 12_000;

    /// <summary>How many runs of the design assistant work at the same moment (the others wait).</summary>
    public int AgentMaxConcurrent { get; set; } = 3;

    /// <summary>How many times one run may look at a page (<c>look</c>).</summary>
    public int AgentMaxLooks { get; set; } = 6;

    /// <summary>How many files one message may bring.</summary>
    public int AgentMaxFilesPerMessage { get; set; } = 6;
}

/// <summary>
/// The rules of the platform that the administrator sets (docs/PLAN-PLATFORM.md section 2): who may register, whether members invite and make teams, public links, the storage of an area,
/// how long the trash keeps things. The JSON names are camel case (<c>registration</c>, <c>publicLinks</c> ...).
/// </summary>
public sealed class PlatformSettings
{
    /// <summary>"off" (only invitations), "open" or "approval" (an administrator approves the account).</summary>
    public string Registration { get; set; } = "off";

    /// <summary>E-mail domains that may register (empty = any).</summary>
    public List<string> AllowedDomains { get; set; } = [];

    public bool MembersMayInvite { get; set; } = true;

    public bool MembersMayCreateTeams { get; set; } = true;

    public bool PublicLinks { get; set; } = true;

    public int PersonalQuotaMb { get; set; } = 2048;

    public int TeamQuotaMb { get; set; } = 10240;

    public int TrashDays { get; set; } = 30;
}

/// <summary>Mail over SMTP (invitations, shares, access requests, mentions). Without a host nothing is sent (and nothing breaks). The password is kept through the <c>SecretProtector</c>.</summary>
public sealed class MailSettings
{
    public bool Enabled { get; set; }

    public string Host { get; set; } = "";

    public int Port { get; set; } = 587;

    /// <summary>"starttls", "ssl" or "none".</summary>
    public string Security { get; set; } = "starttls";

    public string UserName { get; set; } = "";

    public string PasswordProtected { get; set; } = "";

    public string FromAddress { get; set; } = "";

    public string FromName { get; set; } = "DesignThix";

    /// <summary>The address links in mails start with (<c>https://design.example.de</c>). Chosen by the administrator, never taken from a request of a visitor; empty = the address the administrator was last seen at.</summary>
    public string PublicBase { get; set; } = "";

    public bool IsUsable => Enabled && Host.Length > 0 && FromAddress.Contains('@');
}

/// <summary>What the app says about itself and who runs it (llms.txt, the footer).</summary>
public sealed class SiteSettings
{
    public string ServiceName { get; set; } = "DesignThix";

    public string Company { get; set; } = "";

    public string PrivacyUrl { get; set; } = "";

    public string ImprintUrl { get; set; } = "";
}

/// <summary>
/// The settings of <see cref="Setting"/>, kept in memory (the AI worker reads them outside of a request) and written
/// through. One instance for the application.
/// </summary>
public sealed class SettingStore(IServiceScopeFactory scopes)
{
    public const string Ai = "Ai";
    public const string Site = "Site";
    public const string Brand = "Brand";
    public const string Platform = "Platform";
    public const string Mail = "Mail";
    public const string VisitorSalt = "Ai.VisitorSalt";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly ConcurrentDictionary<string, string> _values = new(StringComparer.Ordinal);

    private volatile bool _loaded;

    /// <summary>Raised after a value changed.</summary>
    public event Action<string>? Changed;

    public async Task LoadAsync(CancellationToken ct = default)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DtDbContext>();
        var all = await db.Setting.AsNoTracking().ToListAsync(ct);
        _values.Clear();
        foreach (var s in all)
        {
            _values[s.Key] = s.Value;
        }

        _loaded = true;
    }

    public T Get<T>(string key) where T : new()
    {
        if (!_loaded)
        {
            LoadAsync().GetAwaiter().GetResult();
        }

        if (!_values.TryGetValue(key, out var raw) || string.IsNullOrWhiteSpace(raw))
        {
            return new T();
        }

        try
        {
            return JsonSerializer.Deserialize<T>(raw, Json) ?? new T();
        }
        catch (JsonException)
        {
            return new T();
        }
    }

    public string? GetText(string key) => _values.TryGetValue(key, out var v) ? v : null;

    public Task SetAsync<T>(DtDbContext db, string key, T value, CancellationToken ct = default)
        => SetTextAsync(db, key, JsonSerializer.Serialize(value, Json), ct);

    public async Task SetTextAsync(DtDbContext db, string key, string value, CancellationToken ct = default)
    {
        var row = await db.Setting.FirstOrDefaultAsync(s => s.Key == key, ct);
        if (row is null)
        {
            db.Setting.Add(new Setting { Key = key, Value = value });
        }
        else
        {
            row.Value = value;
        }

        await db.SaveChangesAsync(ct);
        _values[key] = value;
        Changed?.Invoke(key);
    }
}

/// <summary>Reading and changing the settings: reading is open to the code, changing only to administrators.</summary>
public static class SettingLogic
{
    public static T Get<T>(Biz biz, string key) where T : new() => biz.Service<SettingStore>().Get<T>(key);

    public static async Task SaveAsync<T>(Biz biz, string key, T value, string logText)
    {
        biz.RequireAdmin();
        await biz.Service<SettingStore>().SetAsync(biz.Db, key, value);
        await biz.Log.LogAsync(logText, "Setting", null, key);
    }

    /// <summary>A new secret replaces the old one; an empty input keeps it (the page never shows the old one).</summary>
    public static string KeepOrProtect(Biz biz, string? input, string current)
        => string.IsNullOrEmpty(input) ? current : biz.Secrets.Protect(input.Trim());
}
