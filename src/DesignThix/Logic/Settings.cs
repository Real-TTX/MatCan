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
    public int PerMinutePerAddress { get; set; } = 6;

    public int MaxTokens { get; set; } = 16_000;

    public int TimeoutSeconds { get; set; } = 280;
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
