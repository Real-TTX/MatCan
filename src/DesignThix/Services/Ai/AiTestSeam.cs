using DesignThix.Core.Ai;

namespace DesignThix.Services.Ai;

/// <summary>One scripted answer of the fake model of the design assistant (see <see cref="AiTestSeam.Script"/>).</summary>
/// <param name="Text">What the model writes: the JSON object of the protocol, or anything else (to test the re-asks).</param>
/// <param name="Stream">The pieces the text arrives in when the caller asked for a stream; null = the text in pieces of eight characters.</param>
/// <param name="Delay">How long the "model" thinks (the call can be cancelled meanwhile).</param>
/// <param name="Error">Not an answer but a failure of the provider (Ok = false with this reason).</param>
public sealed record AiScripted(string? Text = null, int PromptTokens = 10, int CompletionTokens = 5, string? Note = null, string? Error = null, TimeSpan? Delay = null, string[]? Stream = null)
{
    /// <summary>An answer in the protocol: a message, tool calls (objects <c>{ tool, args }</c> written as JSON text) and the end flag.</summary>
    public static AiScripted Say(string message, bool done = true, params string[] actions)
        => new($"{{\"message\": {System.Text.Json.JsonSerializer.Serialize(message)}, \"actions\": [{string.Join(", ", actions)}], \"done\": {(done ? "true" : "false")}}}");

    /// <summary>A tool call as JSON text for <see cref="Say"/>: <c>Tool("read_design")</c>, <c>Tool("delete_elements", "{\"ids\": [\"e1\"]}")</c>.</summary>
    public static string Tool(string tool, string args = "{}") => $"{{\"tool\": \"{tool}\", \"args\": {args}}}";
}

/// <summary>
/// The test seam of the AI: when a <see cref="AiTestSeam"/> is registered (only the integration tests do) and has a <see cref="Handler"/>, every call of the AI goes to
/// the handler instead of the active profile, the relay or the network. Production never registers it, so the real transport is the only one there. The handler gets
/// the request exactly as the provider would (messages, JSON mode, pictures) and answers like <see cref="ChatCompletionsClient"/> does (<c>Ok=false</c> with a reason, never an exception).
/// <para>
/// For the design assistant there is a scripted mode: <see cref="Script"/> queues answers (one per call of the loop; an empty queue answers "done"), <see cref="Respond"/> answers by a function of the
/// request and the number of the call. Both write the answer to <see cref="AiRequest.OnDelta"/> piece by piece when the caller streams, and wait for a <see cref="AiScripted.Delay"/> so a run can be stopped.
/// </para>
/// </summary>
public sealed class AiTestSeam
{
    public Func<AiRequest, CancellationToken, Task<AiResponse>>? Handler { get; set; }

    /// <summary>The requests the handler got, newest last (for tests that check what was sent): copies, so what a later call changes does not show here. Pictures are in the attachments of the messages.</summary>
    public List<AiRequest> Requests { get; } = [];

    /// <summary>Remembers a request as it is now.</summary>
    public void Record(AiRequest request)
    {
        var copy = new AiRequest
        {
            Json = request.Json,
            MaxTokens = request.MaxTokens,
            OnDelta = request.OnDelta,
            Messages = [.. request.Messages.Select(m => new AiMessage { Role = m.Role, Content = m.Content, Attachments = [.. m.Attachments] })],
        };
        lock (Requests)
        {
            Requests.Add(copy);
        }
    }

    // ------------------------------------------------------------------------------------------------ the scripted agent

    private readonly Queue<AiScripted> _script = new();
    private Func<AiRequest, int, AiScripted>? _responder;
    private int _calls;

    /// <summary>How many calls the scripted mode answered since the last reset.</summary>
    public int Calls => Volatile.Read(ref _calls);

    /// <summary>The answer when nothing is scripted any more: the model says it is done.</summary>
    public AiScripted Fallback { get; set; } = AiScripted.Say("Fertig.");

    /// <summary>Queues the answers of the next calls (one each) and makes the scripted mode the handler.</summary>
    public void Script(params AiScripted[] answers)
    {
        lock (_script)
        {
            _responder = null;
            foreach (var a in answers)
            {
                _script.Enqueue(a);
            }
        }

        Handler = Scripted;
    }

    /// <summary>Answers every call with what the function says (it gets the request and the number of the call, from 0) and makes the scripted mode the handler.</summary>
    public void Respond(Func<AiRequest, int, AiScripted> responder)
    {
        lock (_script)
        {
            _script.Clear();
            _responder = responder;
        }

        Handler = Scripted;
    }

    /// <summary>Clears everything: no handler, no script, no recorded request.</summary>
    public void Reset()
    {
        Handler = null;
        lock (_script)
        {
            _script.Clear();
            _responder = null;
        }

        Volatile.Write(ref _calls, 0);
        lock (Requests)
        {
            Requests.Clear();
        }

        Fallback = AiScripted.Say("Fertig.");
    }

    private async Task<AiResponse> Scripted(AiRequest request, CancellationToken ct)
    {
        var index = Interlocked.Increment(ref _calls) - 1;
        AiScripted answer;
        lock (_script)
        {
            answer = _responder is { } responder ? responder(request, index) : _script.Count > 0 ? _script.Dequeue() : Fallback;
        }

        if (answer.Delay is { } delay)
        {
            await Task.Delay(delay, ct);
        }

        if (answer.Error is not null)
        {
            return new AiResponse { Ok = false, Error = answer.Error, PromptTokens = answer.PromptTokens, CompletionTokens = answer.CompletionTokens };
        }

        var text = answer.Text ?? "";
        if (request.OnDelta is { } onDelta)
        {
            var pieces = answer.Stream ?? Chunks(text, 8);
            foreach (var piece in pieces)
            {
                ct.ThrowIfCancellationRequested();
                onDelta(piece);
                await Task.Delay(1, ct);
            }
        }

        return new AiResponse { Ok = true, Text = text, PromptTokens = answer.PromptTokens, CompletionTokens = answer.CompletionTokens, Note = answer.Note, Model = "test-model" };
    }

    private static string[] Chunks(string text, int size)
    {
        var list = new List<string>();
        for (var i = 0; i < text.Length; i += size)
        {
            list.Add(text.Substring(i, Math.Min(size, text.Length - i)));
        }

        return [.. list];
    }
}
