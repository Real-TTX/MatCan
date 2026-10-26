using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace DesignThix.Core.Ai;

/// <summary>One tool call the model asked for: the name and its arguments (always an object).</summary>
public sealed record AgentAction(string Tool, JsonObject Args);

/// <summary>What the model answered in the protocol of the design assistant: a message, up to eight actions, and whether it is done. <see cref="Canonical"/> is the answer written again in the one shape.</summary>
public sealed record AgentAnswer(string Message, IReadOnlyList<AgentAction> Actions, bool Done, string Canonical);

/// <summary>
/// The protocol of the design assistant: the model answers every call with ONE JSON object <c>{ "message": "...", "actions": [ { "tool": "...", "args": { ... } } ], "done": false }</c>
/// (not a provider's own tool calling, so it works with every model of every provider). Read leniently: a fence or a sentence around the object, <c>name</c> / <c>action</c> for the tool,
/// <c>arguments</c> / <c>input</c> / <c>params</c> for the arguments, the arguments as a string that holds an object, <c>done</c> as text. What is not this object at all is <c>null</c>.
/// </summary>
public static class AgentProtocol
{
    public const int MaxActionsPerReply = 8;

    private static readonly JsonSerializerOptions Canon = new() { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    public static AgentAnswer? Parse(string? text)
    {
        foreach (var candidate in LenientJson.Objects(text))
        {
            if (!(candidate.TryGetProperty("message", out _) || candidate.TryGetProperty("actions", out _) || candidate.TryGetProperty("done", out _)))
            {
                continue;
            }

            JsonObject? obj;
            try
            {
                obj = JsonNode.Parse(candidate.GetRawText()) as JsonObject;
            }
            catch (JsonException)
            {
                continue;
            }

            if (obj is null)
            {
                continue;
            }

            var message = Str(obj["message"]).Trim();
            var actions = new List<AgentAction>();
            var rawActions = obj["actions"];
            if (rawActions is JsonObject single)
            {
                rawActions = new JsonArray(single.DeepClone());
            }

            if (rawActions is JsonArray array)
            {
                foreach (var node in array)
                {
                    if (node is not JsonObject o)
                    {
                        continue;
                    }

                    var tool = Str(o["tool"] ?? o["name"] ?? o["action"]).Trim();
                    if (tool.Length == 0)
                    {
                        continue;
                    }

                    var args = (o["args"] ?? o["arguments"] ?? o["input"] ?? o["params"]) switch
                    {
                        JsonObject x => (JsonObject)x.DeepClone(),
                        JsonValue v when v.TryGetValue<string>(out var s) && TryObject(s) is { } parsed => parsed,
                        _ => new JsonObject(),
                    };
                    actions.Add(new AgentAction(tool, args));
                }
            }

            var done = obj["done"] is JsonValue dv && ((dv.TryGetValue<bool>(out var b) && b) || (dv.TryGetValue<string>(out var ds) && ds.Trim().ToLowerInvariant() is "true" or "ja" or "yes"));
            var canonical = new JsonObject
            {
                ["message"] = message,
                ["actions"] = new JsonArray(actions.Select(a => (JsonNode)new JsonObject { ["tool"] = a.Tool, ["args"] = a.Args.DeepClone() }).ToArray()),
                ["done"] = done,
            }.ToJsonString(Canon);
            return new AgentAnswer(message, actions, done, canonical);
        }

        return null;
    }

    /// <summary>The message ends in a question to the person: with nothing left to do that means "waiting for you", not "stuck".</summary>
    public static bool AsksUser(string? message) => (message ?? "").TrimEnd().TrimEnd(')', '*', '_', '"', '“', '”').EndsWith('?');

    private static string Str(JsonNode? node) => node switch
    {
        null => "",
        JsonValue v when v.TryGetValue<string>(out var s) => s,
        _ => node.ToJsonString(Canon),
    };

    private static JsonObject? TryObject(string text)
    {
        try
        {
            return JsonNode.Parse(text) as JsonObject;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
