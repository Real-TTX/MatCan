using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using DesignThix.Core.Ai;

namespace DesignThix.Services.Ai;

/// <summary>
/// The go-between of the tool <c>look</c> and the editor (docs/PLAN-AI-DESIGN.md 3.4). The browser is the only renderer: a picture of a page can only come from the editor that follows the run. The tool registers a
/// request here (run, page, revision, a random token) and waits; the next poll of the editor carries it (<see cref="PendingFor"/>), the editor draws the page and posts the picture to
/// <c>POST /api/ai/runs/{id}/render/{token}</c>, which completes the request (<see cref="TryComplete"/>: only the person of the run, only with the token). In memory, one request per run, gone after a restart
/// (the run is gone too).
/// </summary>
public sealed class AiRenderBroker(TimeProvider clock)
{
    /// <summary>
    /// What the editor is asked to draw: a page of the design (<c>PageId</c>), or - with <c>TemplateIds</c> - ONE numbered picture of the first pages of these templates (the answer of <c>search_templates</c>).
    /// </summary>
    public sealed record Request(long RunId, long ConversationId, long UserId, string PageId, int PageNumber, int Revision, string Token, IReadOnlyList<long>? TemplateIds = null);

    private sealed class Entry(Request request)
    {
        public Request Request { get; } = request;

        public TaskCompletionSource<byte[]?> Result { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
    }

    private readonly ConcurrentDictionary<long, Entry> _byRun = new();
    private readonly ConcurrentDictionary<long, DateTime> _seen = new();

    /// <summary>The editor of this conversation is there: called by every poll of the steps.</summary>
    public void Touch(long conversationId)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        _seen[conversationId] = now;
        if (_seen.Count > 2000)
        {
            // an editor that has not polled for an hour is gone: the table does not grow with every conversation ever followed
            foreach (var (id, at) in _seen)
            {
                if (now - at > TimeSpan.FromHours(1))
                {
                    _seen.TryRemove(id, out _);
                }
            }
        }
    }

    /// <summary>Whether the editor of the conversation polled within this time (an editor that is closed cannot draw anything).</summary>
    public bool EditorConnected(long conversationId, TimeSpan within) => _seen.TryGetValue(conversationId, out var at) && clock.GetUtcNow().UtcDateTime - at <= within;

    /// <summary>Waits until the editor of the conversation has polled (it starts polling a moment after the message was sent); false when it did not within the time.</summary>
    public async Task<bool> WaitForEditorAsync(long conversationId, TimeSpan timeout, CancellationToken ct)
    {
        var until = DateTime.UtcNow + timeout;
        while (!EditorConnected(conversationId, TimeSpan.FromSeconds(12)))
        {
            if (DateTime.UtcNow >= until)
            {
                return false;
            }

            await Task.Delay(100, ct);
        }

        return true;
    }

    public static string NewToken() => Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(16));

    /// <summary>Registers the request and waits for the picture (null: the editor could not draw it, or nothing came within the time). The request is gone afterwards either way.</summary>
    public async Task<byte[]?> RequestAsync(Request request, TimeSpan timeout, CancellationToken ct)
    {
        var entry = new Entry(request);
        _byRun[request.RunId] = entry;
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(timeout);
            try
            {
                return await entry.Result.Task.WaitAsync(cts.Token);
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                return null;   // the time ran out
            }
        }
        finally
        {
            _byRun.TryRemove(new KeyValuePair<long, Entry>(request.RunId, entry));
        }
    }

    /// <summary>The request of this conversation that waits for its picture, if any (what the poll tells the editor).</summary>
    public Request? PendingFor(long conversationId) => _byRun.Values.Select(e => e.Request).FirstOrDefault(r => r.ConversationId == conversationId);

    /// <summary>Hands in the picture: true when a request of this run waits, the token is the one that was issued and the person is the person of the run.</summary>
    public bool TryComplete(long runId, string token, long userId, byte[] picture)
    {
        if (!Matches(runId, token, userId, out var entry))
        {
            return false;
        }

        return entry!.Result.TrySetResult(picture);
    }

    /// <summary>The editor says it cannot draw the page: the tool goes on without a picture.</summary>
    public bool TryFail(long runId, string token, long userId)
    {
        if (!Matches(runId, token, userId, out var entry))
        {
            return false;
        }

        return entry!.Result.TrySetResult(null);
    }

    private bool Matches(long runId, string token, long userId, out Entry? entry)
    {
        entry = null;
        if (!_byRun.TryGetValue(runId, out var found) || found.Request.UserId != userId)
        {
            return false;
        }

        var a = Encoding.UTF8.GetBytes(found.Request.Token);
        var b = Encoding.UTF8.GetBytes(token ?? "");
        if (!CryptographicOperations.FixedTimeEquals(a, b))
        {
            return false;
        }

        entry = found;
        return true;
    }

    /// <summary>Ends a request that nobody will answer (the run was cancelled).</summary>
    public void Forget(long runId)
    {
        if (_byRun.TryRemove(runId, out var entry))
        {
            entry.Result.TrySetResult(null);
        }
    }
}

/// <summary>
/// The words of the model while it writes them (docs/PLAN-AI-DESIGN.md 3.6): the provider's stream is appended here per run, the poll reads the <c>message</c> out of the growing JSON
/// (<see cref="PartialMessage"/>). Only in memory, never in the database: what counts is the finished answer, which the loop writes as a step.
/// </summary>
public sealed class AiPartialStore
{
    private sealed class Partial
    {
        public readonly StringBuilder Text = new();
        public readonly Lock Gate = new();
    }

    private readonly ConcurrentDictionary<long, Partial> _runs = new();

    /// <summary>A call starts: the run has an (empty) answer under way.</summary>
    public void Begin(long runId) => _runs[runId] = new Partial();

    public void Append(long runId, string piece)
    {
        if (_runs.TryGetValue(runId, out var partial))
        {
            lock (partial.Gate)
            {
                // an answer is never longer than a few ten thousand characters; a provider that runs on is cut off here
                if (partial.Text.Length < 400_000)
                {
                    partial.Text.Append(piece);
                }
            }
        }
    }

    /// <summary>The call is over (answered or failed): nothing is under way any more.</summary>
    public void End(long runId) => _runs.TryRemove(runId, out _);

    /// <summary>The message so far: "" while an answer is being written without a message yet, null when no call of the run is under way.</summary>
    public string? Get(long runId)
    {
        if (!_runs.TryGetValue(runId, out var partial))
        {
            return null;
        }

        string raw;
        lock (partial.Gate)
        {
            raw = partial.Text.ToString();
        }

        return PartialMessage.Of(raw) ?? "";
    }
}
