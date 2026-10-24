using DesignThix.Core.Ai;

namespace DesignThix.Services.Ai;

/// <summary>
/// The test seam of the AI: when a <see cref="AiTestSeam"/> is registered (only the integration tests do) and has a <see cref="Handler"/>, every call of the AI goes to
/// the handler instead of the active profile, the relay or the network. Production never registers it, so the real transport is the only one there. The handler gets
/// the request exactly as the provider would (messages, JSON mode) and answers like <see cref="ChatCompletionsClient"/> does (<c>Ok=false</c> with a reason, never an exception).
/// </summary>
public sealed class AiTestSeam
{
    public Func<AiRequest, CancellationToken, Task<AiResponse>>? Handler { get; set; }

    /// <summary>The requests the handler got, newest last (for tests that check what was sent).</summary>
    public List<AiRequest> Requests { get; } = [];
}
