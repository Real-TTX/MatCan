using System.Net;
using System.Text;
using System.Text.Json;
using DesignThix.Core.Ai;

namespace DesignThix.Tests.Core;

/// <summary>The message of an answer that is still being written (docs/PLAN-AI-DESIGN.md 3.6): the words the person sees grow while the JSON is not valid yet.</summary>
public sealed class PartialMessageTests
{
    [Theory]
    [InlineData("", null)]
    [InlineData("Ich schaue", null)]
    [InlineData("{", null)]
    [InlineData("{\"mes", null)]
    [InlineData("{\"message\"", null)]
    [InlineData("{\"message\":", null)]
    [InlineData("{\"message\": \"", "")]
    [InlineData("{\"message\": \"Ich lege", "Ich lege")]
    [InlineData("{\"message\": \"Ich lege die Seite an\", \"actions\": [", "Ich lege die Seite an")]
    [InlineData("```json\n{\"message\":\"Hallo\"", "Hallo")]
    [InlineData("Gern: {\"message\":\"Hallo", "Hallo")]
    [InlineData("{\"actions\": [], \"message\": \"Danach\"}", "Danach")]
    public void The_message_so_far_is_read_from_the_growing_text(string raw, string? expected) => Assert.Equal(expected, PartialMessage.Of(raw));

    [Fact]
    public void Escapes_are_understood_and_an_escape_that_is_cut_off_waits_for_its_rest()
    {
        Assert.Equal("Zeile 1\nZeile 2", PartialMessage.Of("{\"message\": \"Zeile 1\\nZeile 2"));
        Assert.Equal("Sie sagte \"ja\" und \\", PartialMessage.Of("{\"message\": \"Sie sagte \\\"ja\\\" und \\\\"));
        Assert.Equal("Kaese", PartialMessage.Of("{\"message\": \"Kaese\\"));
        Assert.Equal("Käse", PartialMessage.Of("{\"message\": \"K\\u00e4se"));
        Assert.Equal("K", PartialMessage.Of("{\"message\": \"K\\u00e"));
        Assert.Equal("a/b", PartialMessage.Of("{\"message\": \"a\\/b"));
    }

    [Fact]
    public void A_key_called_message_deeper_in_the_answer_is_not_the_message()
    {
        Assert.Null(PartialMessage.Of("{\"actions\": [{\"tool\": \"x\", \"args\": {\"message\": \"nicht das\"}}], \"done\": false}"));
        Assert.Equal("echt", PartialMessage.Of("{\"actions\": [{\"args\": {\"message\": \"nicht das\"}}], \"message\": \"echt"));
    }

    [Fact]
    public void A_value_that_is_the_word_message_is_no_key()
    {
        Assert.Null(PartialMessage.Of("{\"kind\": \"message\", \"done\": true}"));
    }

    [Fact]
    public void The_message_grows_piece_by_piece_and_never_shrinks()
    {
        var full = "{\"message\": \"Ich ändere die \\\"Überschrift\\\" jetzt.\", \"actions\": [{\"tool\": \"read_design\", \"args\": {}}], \"done\": false}";
        var last = "";
        for (var i = 1; i <= full.Length; i++)
        {
            var now = PartialMessage.Of(full[..i]) ?? "";
            Assert.True(now.StartsWith(last, StringComparison.Ordinal) || last.EndsWith('\\'), $"shrank at {i}: '{last}' -> '{now}'");
            last = now;
        }

        Assert.Equal("Ich ändere die \"Überschrift\" jetzt.", last);
    }
}

/// <summary>The answer of the model in the protocol of the design assistant: read leniently (docs/PLAN-AI-DESIGN.md 3.1).</summary>
public sealed class AgentProtocolTests
{
    [Fact]
    public void A_clean_answer_is_read_as_it_is()
    {
        var answer = AgentProtocol.Parse("""{"message": "Ich lese.", "actions": [{"tool": "read_design", "args": {"page": "p1"}}], "done": false}""");
        Assert.NotNull(answer);
        Assert.Equal("Ich lese.", answer.Message);
        Assert.False(answer.Done);
        var action = Assert.Single(answer.Actions);
        Assert.Equal("read_design", action.Tool);
        Assert.Equal("p1", action.Args["page"]!.GetValue<string>());
    }

    [Fact]
    public void A_fence_a_sentence_and_other_names_do_not_matter()
    {
        var answer = AgentProtocol.Parse("Gern, hier ist mein Plan {nur ein Wort in Klammern}:\n```json\n{\"message\": \"ok\", \"actions\": [{\"name\": \"list_fonts\", \"arguments\": {}}, {\"action\": \"read_brand\", \"input\": {\"x\": 1}}], \"done\": \"true\"}\n```");
        Assert.NotNull(answer);
        Assert.True(answer.Done);
        Assert.Equal(["list_fonts", "read_brand"], answer.Actions.Select(a => a.Tool));
        Assert.Equal(1, answer.Actions[1].Args["x"]!.GetValue<int>());
    }

    [Fact]
    public void Arguments_as_a_string_that_holds_an_object_are_read_and_junk_becomes_no_arguments()
    {
        var answer = AgentProtocol.Parse("""{"message": "", "actions": [{"tool": "a", "args": "{\"ids\": [\"e1\"]}"}, {"tool": "b", "args": "kein json"}, {"tool": "c"}, 5, {"args": {}}], "done": false}""");
        Assert.NotNull(answer);
        Assert.Equal(3, answer.Actions.Count);
        Assert.Equal("e1", answer.Actions[0].Args["ids"]![0]!.GetValue<string>());
        Assert.Empty(answer.Actions[1].Args);
        Assert.Empty(answer.Actions[2].Args);
    }

    [Fact]
    public void A_single_action_object_counts_and_done_is_false_unless_it_says_so()
    {
        var answer = AgentProtocol.Parse("""{"actions": {"tool": "look", "args": {}}}""");
        Assert.NotNull(answer);
        Assert.Single(answer.Actions);
        Assert.False(answer.Done);
        Assert.Equal("", answer.Message);
    }

    [Theory]
    [InlineData("")]
    [InlineData("Ich schaue mir das an.")]
    [InlineData("{\"foo\": 1}")]
    [InlineData("[1, 2]")]
    [InlineData("{\"message\": ")]
    public void Anything_else_is_not_the_protocol(string text) => Assert.Null(AgentProtocol.Parse(text));

    [Fact]
    public void The_canonical_form_is_valid_json_with_the_three_fields()
    {
        var answer = AgentProtocol.Parse("{\"message\": \"Käse „Gouda“\", \"actions\": [{\"tool\": \"x\", \"args\": {\"a\": \"ü\"}}], \"done\": true}")!;
        using var doc = JsonDocument.Parse(answer.Canonical);
        Assert.Equal("Käse „Gouda“", doc.RootElement.GetProperty("message").GetString());
        Assert.True(doc.RootElement.GetProperty("done").GetBoolean());
        Assert.Equal("x", doc.RootElement.GetProperty("actions")[0].GetProperty("tool").GetString());
        Assert.Contains("Käse", answer.Canonical);
    }

    [Theory]
    [InlineData("Soll ich weitermachen?", true)]
    [InlineData("Soll ich **weitermachen?**", true)]
    [InlineData("Soll ich weitermachen? (kurze Frage)", false)]
    [InlineData("Erledigt.", false)]
    [InlineData("", false)]
    public void A_message_that_ends_in_a_question_waits_for_the_person(string message, bool asks) => Assert.Equal(asks, AgentProtocol.AsksUser(message));
}

/// <summary>The stream of a provider (server-sent events) and the fall back when it cannot stream.</summary>
public sealed class ChatCompletionsStreamTests
{
    private sealed class Handler(params Func<HttpRequestMessage, HttpResponseMessage>[] answers) : HttpMessageHandler
    {
        private int _next;

        public List<string> Bodies { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Bodies.Add(request.Content is null ? "" : await request.Content.ReadAsStringAsync(cancellationToken));
            return answers[Math.Min(_next++, answers.Length - 1)](request);
        }
    }

    private static HttpResponseMessage Sse(params string[] lines) => new(HttpStatusCode.OK) { Content = new StringContent(string.Join("\n\n", lines) + "\n\n", Encoding.UTF8, "text/event-stream") };

    private static string Chunk(string? content, string? finish = null, string? usage = null)
    {
        var delta = content is null ? "{}" : JsonSerializer.Serialize(new { content });
        return $"data: {{\"choices\":[{{\"delta\":{delta},\"finish_reason\":{(finish is null ? "null" : JsonSerializer.Serialize(finish))}}}]{(usage is null ? "" : ",\"usage\":" + usage)}}}";
    }

    private static AiRequest Ask(List<string> pieces) => new() { Messages = [AiMessage.System("Regeln"), AiMessage.User("Frage")], Json = true, OnDelta = pieces.Add };

    [Fact]
    public async Task The_pieces_arrive_in_order_and_the_answer_is_the_whole_text_with_the_tokens()
    {
        var handler = new Handler(_ => Sse(Chunk("Hal"), Chunk("lo "), Chunk("Welt"), Chunk(null, "stop"), "data: {\"choices\":[],\"usage\":{\"prompt_tokens\":11,\"completion_tokens\":3}}", "data: [DONE]"));
        var pieces = new List<string>();
        var response = await ChatCompletionsClient.CompleteAsync(new HttpClient(handler), "https://example.invalid/v1", "k", "m", Ask(pieces), 1000);
        Assert.True(response.Ok);
        Assert.Equal("Hallo Welt", response.Text);
        Assert.Equal(["Hal", "lo ", "Welt"], pieces);
        Assert.Equal((11, 3), (response.PromptTokens, response.CompletionTokens));
        using var sent = JsonDocument.Parse(handler.Bodies[0]);
        Assert.True(sent.RootElement.GetProperty("stream").GetBoolean());
        Assert.True(sent.RootElement.GetProperty("stream_options").GetProperty("include_usage").GetBoolean());
    }

    [Fact]
    public async Task Without_a_callback_the_call_is_not_a_stream()
    {
        var handler = new Handler(_ => new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{\"choices\":[{\"message\":{\"content\":\"ok\"},\"finish_reason\":\"stop\"}]}", Encoding.UTF8, "application/json") });
        var response = await ChatCompletionsClient.CompleteAsync(new HttpClient(handler), "", "k", "m", new AiRequest { Messages = [AiMessage.User("x")] }, 1000);
        Assert.True(response.Ok);
        Assert.DoesNotContain("\"stream\"", handler.Bodies[0]);
    }

    [Fact]
    public async Task A_provider_that_ignores_stream_and_answers_with_one_document_is_still_read()
    {
        var handler = new Handler(_ => new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{\"choices\":[{\"message\":{\"content\":\"Ganz\"},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":1,\"completion_tokens\":2}}", Encoding.UTF8, "application/json") });
        var pieces = new List<string>();
        var response = await ChatCompletionsClient.CompleteAsync(new HttpClient(handler), "", "k", "m", Ask(pieces), 1000);
        Assert.True(response.Ok);
        Assert.Equal("Ganz", response.Text);
        Assert.Empty(pieces);
    }

    [Fact]
    public async Task A_provider_that_refuses_stream_is_asked_again_without_it()
    {
        var handler = new Handler(
            _ => new HttpResponseMessage(HttpStatusCode.BadRequest) { Content = new StringContent("{\"error\":{\"message\":\"stream is not supported for this model\"}}", Encoding.UTF8, "application/json") },
            _ => new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{\"choices\":[{\"message\":{\"content\":\"ok\"},\"finish_reason\":\"stop\"}]}", Encoding.UTF8, "application/json") });
        var response = await ChatCompletionsClient.CompleteAsync(new HttpClient(handler), "", "k", "m", Ask([]), 1000);
        Assert.True(response.Ok);
        Assert.Equal(2, handler.Bodies.Count);
        Assert.Contains("\"stream\":true", handler.Bodies[0]);
        Assert.DoesNotContain("\"stream\"", handler.Bodies[1]);
    }

    [Fact]
    public async Task A_stream_that_breaks_off_is_a_failure_and_never_half_an_answer()
    {
        var handler = new Handler(_ => Sse(Chunk("{\"message\": \"Ich"), Chunk(" lege")));
        var pieces = new List<string>();
        var response = await ChatCompletionsClient.CompleteAsync(new HttpClient(handler), "", "k", "m", Ask(pieces), 1000);
        Assert.False(response.Ok);
        Assert.Contains("unterbrochen", response.Error);
        Assert.Equal(2, pieces.Count);
    }

    [Fact]
    public async Task An_error_in_the_stream_is_the_reason_of_the_failure()
    {
        var handler = new Handler(_ => Sse(Chunk("Hal"), "data: {\"error\":{\"message\":\"Overloaded\"}}"));
        var response = await ChatCompletionsClient.CompleteAsync(new HttpClient(handler), "", "k", "m", Ask([]), 1000);
        Assert.False(response.Ok);
        Assert.Contains("Overloaded", response.Error);
    }

    [Fact]
    public async Task A_stream_that_ends_at_the_length_limit_without_text_says_so_and_a_cut_text_carries_a_note()
    {
        var empty = await ChatCompletionsClient.CompleteAsync(new HttpClient(new Handler(_ => Sse(Chunk(null, "length"), "data: [DONE]"))), "", "k", "m", Ask([]), 1000);
        Assert.False(empty.Ok);
        Assert.Contains("Längenlimit", empty.Error);
        var cut = await ChatCompletionsClient.CompleteAsync(new HttpClient(new Handler(_ => Sse(Chunk("abc"), Chunk(null, "length"), "data: [DONE]"))), "", "k", "m", Ask([]), 1000);
        Assert.True(cut.Ok);
        Assert.Contains("abgeschnitten", cut.Note);
    }

    [Fact]
    public async Task A_listener_that_throws_does_not_break_the_call()
    {
        var handler = new Handler(_ => Sse(Chunk("a"), Chunk("b"), Chunk(null, "stop"), "data: [DONE]"));
        var request = new AiRequest { Messages = [AiMessage.User("x")], OnDelta = _ => throw new InvalidOperationException("boom") };
        var response = await ChatCompletionsClient.CompleteAsync(new HttpClient(handler), "", "k", "m", request, 1000);
        Assert.True(response.Ok);
        Assert.Equal("ab", response.Text);
    }
}

/// <summary>The ChatGPT account hands the pieces of its event stream to the callback, too.</summary>
public sealed class ChatGptStreamTests
{
    private sealed class MemoryStore(string json) : IChatGptTokenStore
    {
        public Task<string?> LoadAsync(CancellationToken ct) => Task.FromResult<string?>(json);

        public Task SaveAsync(string? value, CancellationToken ct) => Task.CompletedTask;
    }

    private sealed class Handler(string body) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(body, Encoding.UTF8, "text/event-stream") });
    }

    [Fact]
    public async Task The_text_deltas_reach_the_callback_and_the_answer_is_complete()
    {
        var sse = string.Join("\n\n",
            "data: {\"type\":\"response.output_text.delta\",\"delta\":\"{\\\"message\\\": \\\"Hal\"}",
            "data: {\"type\":\"response.output_text.delta\",\"delta\":\"lo\\\"}\"}",
            "data: {\"type\":\"response.completed\",\"response\":{\"usage\":{\"input_tokens\":7,\"output_tokens\":4}}}") + "\n\n";
        var token = "{\"AccessToken\":\"a\",\"RefreshToken\":\"r\",\"AccountId\":\"x\",\"ExpiresAt\":\"2999-01-01T00:00:00Z\"}";
        var account = new ChatGptAccount(new MemoryStore(token), () => new HttpClient(new Handler(sse)), ChatGptEndpoints.Default, new ChatGptLoginState(), "Test/1", "test");
        var pieces = new List<string>();
        var response = await account.CompleteAsync("m", [AiMessage.User("x")], CancellationToken.None, pieces.Add);
        Assert.True(response.Ok);
        Assert.Equal("{\"message\": \"Hallo\"}", response.Text);
        Assert.Equal(2, pieces.Count);
        Assert.Equal("Hal", PartialMessage.Of(string.Concat(pieces.Take(1))));
        Assert.Equal((7, 4), (response.PromptTokens, response.CompletionTokens));
    }
}
