using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;

namespace MatCan.Services;

/// <summary>One person who has a design open.</summary>
public sealed record PresenceEntry(long UserId, string Name, bool Editing);

/// <summary>
/// Who has which design open right now (docs/PLAN-PLATFORM.md section 1.11): in memory only, a singleton. The editor beats every 15 seconds while its tab is visible; a person whose last beat is
/// older than <see cref="Timeout"/> is gone. Nothing is stored: a restart of the app simply starts with an empty room, and the revision check of the save still guards the document.
/// </summary>
public sealed class PresenceTracker(TimeProvider clock)
{
    public static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);

    private sealed record Seen(string Name, bool Editing, DateTime At);

    private readonly ConcurrentDictionary<long, ConcurrentDictionary<long, Seen>> _rooms = new();
    private long _lastPrune;

    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    /// <summary>Notes that the person has the design open (and whether they may edit it) and returns everybody who has it open, the person included.</summary>
    public List<PresenceEntry> Beat(long designId, long userId, string name, bool editing)
    {
        PruneSometimes();
        var room = _rooms.GetOrAdd(designId, _ => new ConcurrentDictionary<long, Seen>());
        room[userId] = new Seen(name, editing, Now);
        return Current(designId);
    }

    /// <summary>The person closed the design.</summary>
    public void Leave(long designId, long userId)
    {
        if (_rooms.TryGetValue(designId, out var room))
        {
            room.TryRemove(userId, out _);
        }
    }

    /// <summary>Everybody whose last beat is not older than the timeout, editors first.</summary>
    public List<PresenceEntry> Current(long designId)
    {
        if (!_rooms.TryGetValue(designId, out var room))
        {
            return [];
        }

        var limit = Now - Timeout;
        return [.. room.Where(p => p.Value.At >= limit).OrderByDescending(p => p.Value.Editing).ThenBy(p => p.Value.Name, StringComparer.CurrentCultureIgnoreCase).ThenBy(p => p.Key)
            .Select(p => new PresenceEntry(p.Key, p.Value.Name, p.Value.Editing))];
    }

    /// <summary>Drops the people who are gone and the rooms that are empty (also called now and then by the beats).</summary>
    public void Prune()
    {
        var limit = Now - Timeout;
        foreach (var (designId, room) in _rooms)
        {
            foreach (var (userId, seen) in room)
            {
                if (seen.At < limit)
                {
                    room.TryRemove(userId, out _);
                }
            }

            if (room.IsEmpty)
            {
                _rooms.TryRemove(designId, out _);
            }
        }
    }

    private void PruneSometimes()
    {
        var ticks = Now.Ticks;
        var last = Interlocked.Read(ref _lastPrune);
        if (ticks - last > TimeSpan.FromSeconds(60).Ticks && Interlocked.CompareExchange(ref _lastPrune, ticks, last) == last)
        {
            Prune();
        }
    }
}

/// <summary>
/// The brake of the public endpoints: at most N requests per minute from one address. The address is only kept as a hash with a secret that changes every day, so the table says nothing about
/// who looked at what. A request that asked for something that is not there can be made to cost more (<c>cost</c>), which slows down anybody who tries tokens.
/// </summary>
public sealed class PublicRateLimiter(TimeProvider clock)
{
    private readonly ConcurrentDictionary<string, Queue<DateTime>> _calls = new();
    private byte[] _salt = RandomNumberGenerator.GetBytes(32);
    private DateOnly _day;
    private readonly Lock _gate = new();

    /// <summary>Takes <paramref name="cost"/> calls for the address; false when it has used up its minute (nothing is taken then).</summary>
    public bool TryTake(string? address, int perMinute, int cost = 1)
    {
        if (perMinute <= 0)
        {
            return true;
        }

        var now = clock.GetUtcNow().UtcDateTime;
        var queue = _calls.GetOrAdd(Key(address ?? "unknown", now), _ => new Queue<DateTime>());
        lock (queue)
        {
            while (queue.Count > 0 && queue.Peek() < now.AddMinutes(-1))
            {
                queue.Dequeue();
            }

            if (queue.Count + cost > perMinute)
            {
                return false;
            }

            for (var i = 0; i < Math.Max(1, cost); i++)
            {
                queue.Enqueue(now);
            }

            return true;
        }
    }

    /// <summary>Whether the address has used up its minute (what it has used stays as it is: a look, nothing is taken). Used before work that should not be done for a caller who keeps missing.</summary>
    public bool IsOver(string? address, int perMinute)
    {
        if (perMinute <= 0)
        {
            return false;
        }

        var now = clock.GetUtcNow().UtcDateTime;
        var queue = _calls.GetOrAdd(Key(address ?? "unknown", now), _ => new Queue<DateTime>());
        lock (queue)
        {
            while (queue.Count > 0 && queue.Peek() < now.AddMinutes(-1))
            {
                queue.Dequeue();
            }

            return queue.Count >= perMinute;
        }
    }

    /// <summary>Forgets everything (the tests that use up the brake of the shared host).</summary>
    public void Reset() => _calls.Clear();

    /// <summary>Adds to what an address has used (a request that turned out to be a miss).</summary>
    public void Charge(string? address, int cost)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var queue = _calls.GetOrAdd(Key(address ?? "unknown", now), _ => new Queue<DateTime>());
        lock (queue)
        {
            for (var i = 0; i < cost; i++)
            {
                queue.Enqueue(now);
            }
        }
    }

    private string Key(string address, DateTime now)
    {
        lock (_gate)
        {
            var today = DateOnly.FromDateTime(now);
            if (today != _day)
            {
                _salt = RandomNumberGenerator.GetBytes(32);
                _day = today;
                _calls.Clear();
            }

            return Convert.ToHexString(HMACSHA256.HashData(_salt, Encoding.UTF8.GetBytes(address)))[..24];
        }
    }
}
