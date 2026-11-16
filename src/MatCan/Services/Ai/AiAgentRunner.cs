using System.Collections.Concurrent;
using System.Threading.Channels;
using MatCan.Data;
using MatCan.Data.Entities;
using MatCan.Logic;
using Microsoft.EntityFrameworkCore;

namespace MatCan.Services.Ai;

/// <summary>
/// Runs the design assistant in the background (docs/PLAN-AI-DESIGN.md 3.1): a run takes minutes (a model call alone can), far longer than a request should wait, so the endpoint only stores the message and
/// starts the run, and the editor reads the steps as they are written. One run per conversation (and per design) at a time, at most <see cref="AiSettings.AgentMaxConcurrent"/> runs at once (the others
/// wait), each stoppable. A run works as the person who sent the message: a scope with an <see cref="ICurrentUser"/> of that person, their role read fresh, so every tool goes through the same logic and the same
/// access checks as a request would.
/// <para>A restart interrupts whatever was running. On start every run that is still "Running" from before it becomes an error with a line saying so, and its conversation is idle again; the folders of
/// <c>{data}/ai-files</c> without a live conversation are removed.</para>
/// </summary>
public sealed class AiAgentRunner(IServiceScopeFactory scopes, SettingStore settings, TimeProvider clock, ILogger<AiAgentRunner> logger) : BackgroundService
{
    private readonly Channel<(long ConversationId, string? Address)> _queue = Channel.CreateUnbounded<(long, string?)>();
    private readonly ConcurrentDictionary<long, CancellationTokenSource> _running = new();
    private readonly ConcurrentDictionary<Task, byte> _tasks = new();
    private readonly object _gate = new();
    private readonly Queue<TaskCompletionSource> _waiters = new();
    private int _active;
    private readonly DateTime _started = clock.GetUtcNow().UtcDateTime;

    /// <summary>Starts the run of the conversation (its newest run, which must be "Running"). The address is only kept in memory, for the brake per address.</summary>
    public void Enqueue(long conversationId, string? address)
    {
        _running.GetOrAdd(conversationId, _ => new CancellationTokenSource());
        _queue.Writer.TryWrite((conversationId, address));
    }

    /// <summary>Stops the run of the conversation: true when there was one.</summary>
    public bool Cancel(long conversationId)
    {
        if (!_running.TryGetValue(conversationId, out var cts))
        {
            return false;
        }

        cts.Cancel();
        return true;
    }

    /// <summary>Whether a run of the conversation is waiting for a slot or working.</summary>
    public bool IsRunning(long conversationId) => _running.ContainsKey(conversationId);

    /// <summary>How many runs work right now.</summary>
    public int Active
    {
        get
        {
            lock (_gate)
            {
                return _active;
            }
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        try
        {
            await RecoverAsync(_started, stop);
            CleanFiles();
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // a database that is not there yet must not stop the runner
            logger.LogDebug(ex, "Design assistant: could not recover interrupted runs");
        }

        try
        {
            await foreach (var (id, address) in _queue.Reader.ReadAllAsync(stop))
            {
                var task = RunOneAsync(id, address, stop);
                _tasks[task] = 0;
                _ = task.ContinueWith(t => _tasks.TryRemove(t, out _), TaskScheduler.Default);
            }
        }
        catch (OperationCanceledException)
        {
            // the app is stopping
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        foreach (var cts in _running.Values)
        {
            cts.Cancel();
        }

        await base.StopAsync(cancellationToken);
        try
        {
            await Task.WhenAll(_tasks.Keys).WaitAsync(TimeSpan.FromSeconds(5), CancellationToken.None);
        }
        catch (Exception)
        {
            // runs that do not end in time are cut off with the process
        }
    }

    // ------------------------------------------------------------------------------------------------ one run

    private async Task AcquireAsync(CancellationToken ct)
    {
        while (true)
        {
            TaskCompletionSource wait;
            lock (_gate)
            {
                var max = Math.Max(1, settings.Get<AiSettings>(SettingStore.Ai).AgentMaxConcurrent);
                if (_active < max)
                {
                    _active++;
                    return;
                }

                wait = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
                _waiters.Enqueue(wait);
            }

            using (ct.Register(() => wait.TrySetCanceled(ct)))
            {
                await wait.Task;
            }
        }
    }

    private void Release()
    {
        lock (_gate)
        {
            _active--;
            while (_waiters.Count > 0)
            {
                if (_waiters.Dequeue().TrySetResult())
                {
                    break;
                }
            }
        }
    }

    private async Task RunOneAsync(long conversationId, string? address, CancellationToken stop)
    {
        var cts = _running.GetOrAdd(conversationId, _ => new CancellationTokenSource());
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(stop, cts.Token);
        try
        {
            await AcquireAsync(linked.Token);
            try
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DtDbContext>();
                var conv = await db.AiConversation.AsNoTracking().FirstOrDefaultAsync(c => c.Id == conversationId, CancellationToken.None);
                var user = conv is null ? null : await db.User.AsNoTracking().FirstOrDefaultAsync(u => u.Id == conv.UserId, CancellationToken.None);
                if (conv is null || user is null)
                {
                    return;
                }

                var current = scope.ServiceProvider.GetRequiredService<ICurrentUser>();
                using var acting = current.RunAs(user.Id, user.DisplayName, user.Role);
                var biz = scope.ServiceProvider.GetRequiredService<Biz>();
                if (!user.IsActive || user.ApprovalState != ApprovalState.Approved)
                {
                    await EndRunningAsync(db, conversationId, "error", "Dein Konto ist nicht aktiv: die KI arbeitet nicht.", clock.GetUtcNow().UtcDateTime);
                    return;
                }

                await AiAgentLoop.RunAsync(biz, conversationId, address, linked.Token);
            }
            finally
            {
                Release();
            }
        }
        catch (OperationCanceledException)
        {
            // stopped while it waited for a slot: the run did not start, so it is ended here
            await EndAsync(conversationId, "cancelled", "Abgebrochen.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Design assistant run of conversation {Id} failed", conversationId);
            await EndAsync(conversationId, "error", "Ein interner Fehler hat den Auftrag beendet.");
        }
        finally
        {
            _running.TryRemove(conversationId, out _);
        }
    }

    /// <summary>Ends a run that never got to start (or whose loop failed outside of its own handling): the run, an end step, the conversation idle.</summary>
    private async Task EndAsync(long conversationId, string state, string text)
    {
        try
        {
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DtDbContext>();
            await EndRunningAsync(db, conversationId, state, text, clock.GetUtcNow().UtcDateTime);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not end the run of conversation {Id}", conversationId);
        }
    }

    internal static async Task<bool> EndRunningAsync(DtDbContext db, long conversationId, string state, string text, DateTime now)
    {
        var conv = await db.AiConversation.FirstOrDefaultAsync(c => c.Id == conversationId);
        if (conv is null || conv.Status != AiConversationStatus.Running)
        {
            return false;
        }

        conv.Status = AiConversationStatus.Idle;
        var run = await db.AiRun.FirstOrDefaultAsync(r => r.ConversationId == conversationId && r.Number == conv.Runs);
        if (run is not null && run.Status == AiRunStatus.Running)
        {
            run.Status = state == "cancelled" ? AiRunStatus.Cancelled : AiRunStatus.Error;
            run.Error = text;
            run.EndDate = now;
            var number = await db.AiRunStep.Where(s => s.AiRunId == run.Id).Select(s => (int?)s.Number).MaxAsync() ?? 0;
            db.AiRunStep.Add(new AiRunStep { AiRunId = run.Id, Number = number + 1, Kind = AiStepKind.End, Text = text, OccurredDate = now, DataJson = new System.Text.Json.Nodes.JsonObject { ["state"] = state }.ToJsonString() });
        }

        await db.SaveChangesAsync();
        return true;
    }

    // ------------------------------------------------------------------------------------------------ restart

    /// <summary>
    /// Runs that are still "Running" and were last touched before <paramref name="before"/> (the start of this process, by default) were interrupted by a restart: each becomes an error with the line "Die
    /// Anwendung wurde neu gestartet." and its conversation is idle again. Returns how many.
    /// </summary>
    public async Task<int> RecoverAsync(DateTime? before = null, CancellationToken ct = default)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DtDbContext>();
        var cutoff = before ?? _started;
        var ids = await db.AiConversation.Where(c => c.Status == AiConversationStatus.Running && c.UpdateDate < cutoff).Select(c => c.Id).ToListAsync(ct);
        var count = 0;
        foreach (var id in ids.Where(i => !IsRunning(i)))
        {
            if (await EndRunningAsync(db, id, "error", "Die Anwendung wurde neu gestartet.", clock.GetUtcNow().UtcDateTime))
            {
                count++;
            }
        }

        return count;
    }

    /// <summary>Removes the folders of <c>{data}/ai-files</c> that belong to no live conversation.</summary>
    private void CleanFiles()
    {
        using var scope = scopes.CreateScope();
        var config = scope.ServiceProvider.GetRequiredService<Configuration.ConfigStore>();
        var db = scope.ServiceProvider.GetRequiredService<DtDbContext>();
        var root = Path.Combine(config.DataDir, "ai-files");
        if (!Directory.Exists(root))
        {
            return;
        }

        var live = db.AiConversation.AsNoTracking().Select(c => c.Id).ToHashSet();
        foreach (var dir in Directory.GetDirectories(root))
        {
            if (!long.TryParse(Path.GetFileName(dir), out var id) || !live.Contains(id))
            {
                try
                {
                    Directory.Delete(dir, true);
                }
                catch (IOException)
                {
                    // the next start tries again
                }
            }
        }
    }
}
