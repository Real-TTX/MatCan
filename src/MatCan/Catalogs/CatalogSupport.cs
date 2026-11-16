using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using MatCan.Configuration;
using Microsoft.AspNetCore.DataProtection;

namespace MatCan.Catalogs;

/// <summary>
/// The brakes of the catalogues (docs/PLAN-CATALOGS.md section 4): how many searches one person makes per minute, and the budget per hour of the key of a provider. In memory (a restart forgets
/// them, which is fine for a brake). A limit that is used up is a message in German, never a retry loop around a provider's limit.
/// </summary>
public sealed class CatalogLimiter(TimeProvider clock)
{
    private readonly ConcurrentDictionary<string, Queue<DateTime>> _calls = new();

    /// <summary>Takes one search of this person; throws <see cref="CatalogException"/> (Limit) when they used up their minute.</summary>
    public void TakePerson(long userId, ICatalog catalog, int perMinute)
    {
        if (perMinute > 0 && !TryTake($"u:{userId}:{catalog.Id}", perMinute, TimeSpan.FromMinutes(1)))
        {
            throw new CatalogException("Du hast gerade viele Suchen gemacht. Warte einen Moment und versuch es dann noch einmal.", CatalogFailure.Limit, 30);
        }
    }

    /// <summary>
    /// Takes one request of the key of the catalogue (all people together); throws when the hour's budget (or the provider's limit per minute for the key, <paramref name="perMinute"/>) is used up.
    /// </summary>
    public void TakeBudget(ICatalog catalog, int perHour, int perMinute = 0)
    {
        if (perMinute > 0 && !TryTake($"m:{catalog.Id}", perMinute, TimeSpan.FromMinutes(1)))
        {
            throw new CatalogException($"{catalog.Name} bremst gerade: Es waren zu viele Anfragen in einer Minute. Versuch es in einer Minute wieder.", CatalogFailure.Limit, 60);
        }

        if (perHour > 0 && !TryTake($"h:{catalog.Id}", perHour, TimeSpan.FromHours(1)))
        {
            throw new CatalogException($"{catalog.Name} hat für diese Stunde genug Anfragen bekommen. Versuch es in ein paar Minuten wieder.", CatalogFailure.Limit, 300);
        }
    }

    private readonly ConcurrentDictionary<string, DateTime> _blocked = new();
    private readonly ConcurrentDictionary<string, CatalogRate> _rates = new();

    /// <summary>
    /// The provider said "not now" (429 with Retry-After, or an answer that says nothing is left): until then no request goes to it, so a limit is never hammered. Throws a German message with the
    /// time that is left.
    /// </summary>
    public void CheckBlock(ICatalog catalog)
    {
        if (_blocked.TryGetValue(catalog.Id, out var until))
        {
            var left = (int)Math.Ceiling((until - clock.GetUtcNow().UtcDateTime).TotalSeconds);
            if (left > 0)
            {
                throw new CatalogException($"{catalog.Name} bremst gerade. Versuch es in {CatalogHttp.WaitText(left)} wieder.", CatalogFailure.Limit, left);
            }

            _blocked.TryRemove(catalog.Id, out _);
        }
    }

    /// <summary>No request to this catalogue for <paramref name="seconds"/> (at most an hour).</summary>
    public void Block(ICatalog catalog, int seconds)
        => _blocked[catalog.Id] = clock.GetUtcNow().UtcDateTime.AddSeconds(Math.Clamp(seconds, 1, 3600));

    /// <summary>Ends the pause (the administrator's "Testen" asks the provider once, whatever it said before).</summary>
    public void Unblock(ICatalog catalog) => _blocked.TryRemove(catalog.Id, out _);

    /// <summary>Remembers what the provider reported about its limits (shown on the administration page); an answer that says nothing is left closes the door for a moment.</summary>
    public void Note(ICatalog catalog, CatalogRate? rate)
    {
        if (rate is null)
        {
            return;
        }

        _rates[catalog.Id] = rate;
        if (rate.Remaining == 0)
        {
            Block(catalog, Math.Clamp(rate.ResetSeconds ?? 30, 5, 60));
        }
    }

    /// <summary>The last limits the provider reported, or null.</summary>
    public CatalogRate? RateOf(string catalogId) => _rates.TryGetValue(catalogId, out var rate) ? rate : null;

    /// <summary>The brake of the thumbnail proxy: a page of results asks for dozens at once, so the number is generous (600 a minute per person), but it is no way to pull the internet through the server.</summary>
    public void TakeThumb(long userId)
    {
        if (!TryTake($"t:{userId}", 600, TimeSpan.FromMinutes(1)))
        {
            throw new CatalogException("Zu viele Vorschaubilder auf einmal. Warte einen Moment.", CatalogFailure.Limit, 30);
        }
    }

    private bool TryTake(string key, int limit, TimeSpan window)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var queue = _calls.GetOrAdd(key, _ => new Queue<DateTime>());
        lock (queue)
        {
            while (queue.Count > 0 && queue.Peek() < now - window)
            {
                queue.Dequeue();
            }

            if (queue.Count >= limit)
            {
                return false;
            }

            queue.Enqueue(now);
            return true;
        }
    }

    /// <summary>Forgets what was counted (the tests that measure the brake).</summary>
    public void Reset()
    {
        _calls.Clear();
        _blocked.Clear();
        _rates.Clear();
    }
}

/// <summary>
/// The keys of the providers: one encrypted file each in <c>{data}/secrets/catalogs</c>, protected with the key ring of the app, like the keys of the AI (docs/PLAN-CATALOGS.md section 3). Never in the
/// database, never sent to a browser: the pages only ever learn whether a key exists.
/// </summary>
public sealed partial class CatalogSecretStore
{
    private readonly string _dir;
    private readonly IDataProtector _protector;
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _locks = new();

    public CatalogSecretStore(ConfigStore config, IDataProtectionProvider provider)
    {
        _dir = Path.Combine(config.DataDir, "secrets", "catalogs");
        Directory.CreateDirectory(_dir);
        _protector = provider.CreateProtector("MatCan.CatalogSecrets.v1");
    }

    [GeneratedRegex("^[a-z0-9][a-z0-9-]{0,39}$")]
    private static partial Regex IdPattern();

    private string PathOf(string id)
        => IdPattern().IsMatch(id) ? Path.Combine(_dir, id + ".key") : throw new ArgumentException("Not a catalogue id.", nameof(id));

    public bool Has(string id) => File.Exists(PathOf(id));

    public async Task<string?> LoadAsync(string id, CancellationToken ct = default)
    {
        var path = PathOf(id);
        if (!File.Exists(path))
        {
            return null;
        }

        try
        {
            return _protector.Unprotect(await File.ReadAllTextAsync(path, ct));
        }
        catch (CryptographicException)
        {
            // The key ring was lost or replaced: the key is unreadable and has to be entered again.
            return null;
        }
    }

    /// <summary>Saves the key; an empty value removes it.</summary>
    public async Task SaveAsync(string id, string? value, CancellationToken ct = default)
    {
        var path = PathOf(id);
        var gate = _locks.GetOrAdd(path, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(ct);
        try
        {
            if (string.IsNullOrEmpty(value))
            {
                File.Delete(path);
                return;
            }

            var temp = path + ".tmp";
            await File.WriteAllTextAsync(temp, _protector.Protect(value), new UTF8Encoding(false), ct);
            File.Move(temp, path, overwrite: true);
        }
        finally
        {
            gate.Release();
        }
    }
}

/// <summary>What a thumbnail address of this app stands for: a picture at a provider's address, or an item the catalogue reads itself (a file of the server folder).</summary>
public sealed record ThumbToken(string Catalog, string? Url, string? ItemId);

/// <summary>
/// The thumbnail proxy's addresses (docs/PLAN-CATALOGS.md section 4): <c>/api/catalogs/thumb/&lt;token&gt;</c>. The token is the catalogue, the address and an expiry, encrypted and signed with the key ring
/// of the app (an authenticated, time-limited protector), so a page never shows a provider's address, nobody can make a token for another address and the endpoint is no open proxy. A tampered or
/// expired token is simply not valid.
/// </summary>
public sealed class CatalogProxy(IDataProtectionProvider provider)
{
    /// <summary>How long a thumbnail address works (the page that holds it is old after that).</summary>
    public static readonly TimeSpan Lifetime = TimeSpan.FromHours(24);

    private readonly ITimeLimitedDataProtector _protector = provider.CreateProtector("MatCan.CatalogThumbs.v1").ToTimeLimitedDataProtector();

    public string AddressFor(string catalog, string? url = null, string? itemId = null) => "/api/catalogs/thumb/" + Issue(catalog, url, itemId, DateTimeOffset.UtcNow + Lifetime);

    public string Issue(string catalog, string? url, string? itemId, DateTimeOffset expires)
        => _protector.Protect(JsonSerializer.Serialize(new ThumbToken(catalog, url, itemId)), expires);

    /// <summary>The meaning of a token, or null when it was changed, has expired or never was one of ours.</summary>
    public ThumbToken? Read(string? token)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > 2000)
        {
            return null;
        }

        try
        {
            var read = JsonSerializer.Deserialize<ThumbToken>(_protector.Unprotect(token));
            return read is { Catalog.Length: > 0 } && (read.Url is not null || read.ItemId is not null) ? read : null;
        }
        catch (Exception ex) when (ex is CryptographicException or JsonException or FormatException)
        {
            return null;
        }
    }
}

/// <summary>The thumbnails of external catalogues on disk (<c>{data}/catalog-cache</c>): a day, at most 500 MB, the oldest go first (<see cref="CatalogCacheCleaner"/>).</summary>
public sealed class CatalogThumbCache(ConfigStore config)
{
    public static readonly TimeSpan MaxAge = TimeSpan.FromHours(24);

    public const long MaxBytes = 500L * 1024 * 1024;

    public string Root { get; } = Path.Combine(config.DataDir, "catalog-cache");

    private string PathOf(string catalog, string url)
    {
        var hash = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(catalog + "\n" + url)));
        return Path.Combine(Root, hash[..2], hash);
    }

    public byte[]? TryGet(string catalog, string url, DateTime now)
    {
        var path = PathOf(catalog, url);
        try
        {
            var info = new FileInfo(path);
            if (!info.Exists || now - info.LastWriteTimeUtc > MaxAge)
            {
                return null;
            }

            return File.ReadAllBytes(path);
        }
        catch (IOException)
        {
            return null;
        }
    }

    public void Put(string catalog, string url, byte[] bytes)
    {
        try
        {
            var path = PathOf(catalog, url);
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            var temp = path + "." + Guid.NewGuid().ToString("N")[..6] + ".tmp";
            File.WriteAllBytes(temp, bytes);
            File.Move(temp, path, overwrite: true);
        }
        catch (IOException)
        {
            // the cache is an optimisation: a full or locked disk must not break a thumbnail
        }
    }

    public void Clear()
    {
        try
        {
            if (Directory.Exists(Root))
            {
                Directory.Delete(Root, recursive: true);
            }
        }
        catch (IOException)
        {
        }
    }

    /// <summary>Removes what is too old, then the oldest files until the rest fits; returns how many files went.</summary>
    public int Cleanup(DateTime now)
    {
        if (!Directory.Exists(Root))
        {
            return 0;
        }

        var removed = 0;
        var files = new DirectoryInfo(Root).EnumerateFiles("*", SearchOption.AllDirectories).OrderBy(f => f.LastWriteTimeUtc).ToList();
        var total = files.Sum(f => f.Length);
        foreach (var file in files)
        {
            if (now - file.LastWriteTimeUtc <= MaxAge && total <= MaxBytes)
            {
                break;
            }

            try
            {
                total -= file.Length;
                file.Delete();
                removed++;
            }
            catch (IOException)
            {
            }
        }

        return removed;
    }
}

/// <summary>Once an hour: the expired answers of the providers out of the database and the thumbnails on disk down to a day and 500 MB.</summary>
public sealed class CatalogCacheCleaner(IServiceScopeFactory scopes, CatalogThumbCache thumbs, TimeProvider clock, ILogger<CatalogCacheCleaner> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // the first run a minute after the start: the start itself is busy enough
        if (!await Wait(TimeSpan.FromMinutes(1), stoppingToken))
        {
            return;
        }

        do
        {
            try
            {
                await RunOnceAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "The cleanup of the catalogue cache failed.");
            }
        }
        while (await Wait(TimeSpan.FromHours(1), stoppingToken));
    }

    public async Task RunOnceAsync(CancellationToken ct = default)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Data.DtDbContext>();
        await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.ExecuteDeleteAsync(db.CatalogCacheEntry.Where(e => e.ExpiresDate < now), ct);
        thumbs.Cleanup(now);
    }

    private static async Task<bool> Wait(TimeSpan span, CancellationToken ct)
    {
        try
        {
            await Task.Delay(span, ct);
            return true;
        }
        catch (OperationCanceledException)
        {
            return false;
        }
    }
}
