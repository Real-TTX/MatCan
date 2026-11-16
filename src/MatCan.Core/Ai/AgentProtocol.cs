using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace MatCan.Core.Ai;

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

    /// <summary>
    /// Why an answer is not the protocol, in one German sentence for the re-ask (a model that is only told "wrong format" repeats its mistake: a missing closing brace in a long list of changes, a sentence
    /// instead of the object). Names the place of the first syntax error with a few characters around it, the number of braces that do not close, or that the object has none of the three fields.
    /// </summary>
    public static string Diagnose(string? text)
    {
        var t = text ?? "";
        var start = t.IndexOf('{');
        if (start < 0)
        {
            return "Die Antwort enthielt gar kein JSON-Objekt, nur Text.";
        }

        // braces outside of strings
        int depth = 0, maxDepth = 0;
        var inString = false;
        for (var i = start; i < t.Length; i++)
        {
            var c = t[i];
            if (inString)
            {
                if (c == '\\')
                {
                    i++;
                }
                else if (c == '"')
                {
                    inString = false;
                }

                continue;
            }

            if (c == '"')
            {
                inString = true;
            }
            else if (c == '{')
            {
                depth++;
                maxDepth = Math.Max(maxDepth, depth);
            }
            else if (c == '}')
            {
                depth--;
            }
        }

        var end = t.LastIndexOf('}');
        var slice = end > start ? t[start..(end + 1)] : t[start..];
        try
        {
            using var doc = JsonDocument.Parse(slice, new JsonDocumentOptions { AllowTrailingCommas = true, CommentHandling = JsonCommentHandling.Skip, MaxDepth = 32 });
            return doc.RootElement.ValueKind == JsonValueKind.Object
                ? "Das JSON ist gültig, hat aber keines der Felder \"message\", \"actions\" oder \"done\"."
                : "Die Antwort ist kein JSON-Objekt.";
        }
        catch (JsonException e)
        {
            var offset = (int)Math.Min(e.BytePositionInLine ?? 0, int.MaxValue);
            var line = (int)(e.LineNumber ?? 0);
            // the character offset of the error in the slice: lines are short in a model's answer, so count by lines
            var position = 0;
            for (var l = 0; l < line && position < slice.Length; l++)
            {
                var nl = slice.IndexOf('\n', position);
                position = nl < 0 ? slice.Length : nl + 1;
            }

            position = Math.Clamp(position + offset, 0, slice.Length);
            var from = Math.Max(0, position - 40);
            var snippet = slice[from..Math.Min(slice.Length, position + 20)].Replace('\n', ' ').Replace('\r', ' ');
            var balance = depth > 0 ? $" Es fehlen {depth} schließende geschweifte Klammer(n) \"}}\"." : depth < 0 ? $" Es gibt {-depth} schließende Klammer(n) zu viel." : "";
            return $"Das JSON ist ungültig (Fehler bei Zeichen {position}, ungefähr hier: …{snippet}…).{balance}";
        }
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
