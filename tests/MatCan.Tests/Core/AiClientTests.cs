using System.Net;
using System.Text;
using System.Text.Json;
using MatCan.Core.Ai;

namespace MatCan.Tests.Core;

/// <summary>An HTTP handler that answers from a queue and remembers what was sent (no network in the tests).</summary>
internal sealed class StubHandler(params (HttpStatusCode Status, string Body)[] answers) : HttpMessageHandler
{
    private readonly Queue<(HttpStatusCode Status, string Body)> _answers = new(answers);

    public List<string> Bodies { get; } = [];

    public List<string> Authorization { get; } = [];

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Bodies.Add(request.Content is null ? "" : await request.Content.ReadAsStringAsync(cancellationToken));
        Authorization.Add(request.Headers.Authorization?.ToString() ?? "");
        var (status, body) = _answers.Count > 1 ? _answers.Dequeue() : _answers.Peek();
        return new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
    }
}

public sealed class ChatCompletionsCallTests
{
    private static AiRequest Ask(bool json = false) => new() { Messages = [AiMessage.System("Regeln"), AiMessage.User("Frage")], Json = json };

    private static string Answer(string text, string finish = "stop") => JsonSerializer.Serialize(new
    {
        choices = new[] { new { message = new { role = "assistant", content = text }, finish_reason = finish } },
        usage = new { prompt_tokens = 12, completion_tokens = 5 },
    });

    [Fact]
    public async Task A_good_answer_carries_the_text_the_tokens_and_the_key_in_the_header()
    {
        var handler = new StubHandler((HttpStatusCode.OK, Answer("Hallo")));
        var response = await ChatCompletionsClient.CompleteAsync(new HttpClient(handler), "https://example.invalid/v1/", "geheim", "m1", Ask(), 1000);
        Assert.True(response.Ok);
        Assert.Equal("Hallo", response.Text);
        Assert.Equal((12, 5), (response.PromptTokens, response.CompletionTokens));
        Assert.Equal("Bearer geheim", handler.Authorization[0]);
        using var sent = JsonDocument.Parse(handler.Bodies[0]);
        Assert.Equal("m1", sent.RootElement.GetProperty("model").GetString());
        Assert.Equal(2, sent.RootElement.GetProperty("messages").GetArrayLength());
    }

    [Fact]
    public async Task An_empty_answer_is_an_error_and_never_a_success()
    {
        var handler = new StubHandler((HttpStatusCode.OK, Answer("  ")));
        var response = await ChatCompletionsClient.CompleteAsync(new HttpClient(handler), "", "k", "m", Ask(), 1000);
        Assert.False(response.Ok);
        Assert.Contains("leere Antwort", response.Error);
    }

    [Fact]
    public async Task An_empty_answer_at_the_length_limit_says_so()
    {
        var handler = new StubHandler((HttpStatusCode.OK, Answer("", "length")));
        var response = await ChatCompletionsClient.CompleteAsync(new HttpClient(handler), "", "k", "m", Ask(), 1000);
        Assert.False(response.Ok);
        Assert.Contains("Längenlimit", response.Error);
    }

    [Fact]
    public async Task A_refused_key_is_told_plainly()
    {
        var handler = new StubHandler((HttpStatusCode.Unauthorized, "{\"error\":{\"message\":\"bad key\"}}"));
        var response = await ChatCompletionsClient.CompleteAsync(new HttpClient(handler), "", "k", "m", Ask(), 1000);
        Assert.False(response.Ok);
        Assert.Contains("401", response.Error);
        Assert.Single(handler.Bodies);
    }

    [Fact]
    public async Task A_provider_that_wants_another_name_for_the_length_cap_gets_it_once()
    {
        var handler = new StubHandler((HttpStatusCode.BadRequest, "{\"error\":{\"message\":\"Unsupported parameter: max_tokens. Use max_completion_tokens.\"}}"), (HttpStatusCode.OK, Answer("ok")));
        var response = await ChatCompletionsClient.CompleteAsync(new HttpClient(handler), "", "k", "m", Ask(), 1000);
        Assert.True(response.Ok);
        Assert.Contains("\"max_tokens\"", handler.Bodies[0]);
        Assert.Contains("\"max_completion_tokens\"", handler.Bodies[1]);
        Assert.DoesNotContain("\"max_tokens\"", handler.Bodies[1]);
    }

    [Fact]
    public async Task A_model_without_temperature_is_asked_again_without_it()
    {
        var handler = new StubHandler((HttpStatusCode.BadRequest, "{\"error\":{\"message\":\"temperature is not supported\"}}"), (HttpStatusCode.OK, Answer("ok")));
        var response = await ChatCompletionsClient.CompleteAsync(new HttpClient(handler), "", "k", "m", Ask(), 1000);
        Assert.True(response.Ok);
        Assert.Contains("temperature", handler.Bodies[0]);
        Assert.DoesNotContain("temperature", handler.Bodies[1]);
    }

    [Fact]
    public async Task An_empty_request_is_refused_without_a_call()
    {
        var handler = new StubHandler((HttpStatusCode.OK, Answer("x")));
        var response = await ChatCompletionsClient.CompleteAsync(new HttpClient(handler), "", "k", "m", new AiRequest(), 1000);
        Assert.False(response.Ok);
        Assert.Empty(handler.Bodies);
    }

    [Fact]
    public async Task The_model_list_marks_the_free_ones_only_when_the_provider_says_so()
    {
        var body = "{\"data\":[{\"id\":\"a/b:free\",\"name\":\"B\"},{\"id\":\"c\",\"name\":\"C\",\"pricing\":{\"prompt\":\"0\",\"completion\":\"0\"}},{\"id\":\"d\"}]}";
        var (models, error) = await ChatCompletionsClient.ListModelsAsync(new HttpClient(new StubHandler((HttpStatusCode.OK, body))), "https://example.invalid/v1", "k");
        Assert.Null(error);
        Assert.NotNull(models);
        Assert.True(models.Single(m => m.Id == "a/b:free").Free);
        Assert.True(models.Single(m => m.Id == "c").Free);
        Assert.False(models.Single(m => m.Id == "d").Free);
    }
}

public sealed class ChatGptRequestTests
{
    [Fact]
    public void System_messages_become_the_instructions_and_the_rest_input_items()
    {
        var body = ChatGptAccount.BuildBody("gpt-x", [AiMessage.System("Regel 1"), AiMessage.System("Regel 2"), AiMessage.User("Frage"), AiMessage.Assistant("Antwort"), AiMessage.User("Nochmal")]);
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;
        Assert.Equal("gpt-x", root.GetProperty("model").GetString());
        Assert.Equal("Regel 1\n\nRegel 2", root.GetProperty("instructions").GetString());
        Assert.False(root.GetProperty("store").GetBoolean());
        Assert.True(root.GetProperty("stream").GetBoolean());
        var input = root.GetProperty("input");
        Assert.Equal(3, input.GetArrayLength());
        Assert.Equal("input_text", input[0].GetProperty("content")[0].GetProperty("type").GetString());
        Assert.Equal("output_text", input[1].GetProperty("content")[0].GetProperty("type").GetString());
        Assert.Equal("assistant", input[1].GetProperty("role").GetString());
    }

    [Fact]
    public void A_call_with_only_a_system_message_makes_it_the_task_and_gets_a_neutral_instruction()
    {
        using var doc = JsonDocument.Parse(ChatGptAccount.BuildBody("m", [AiMessage.System("Mach etwas")]));
        Assert.Equal("You are a helpful assistant.", doc.RootElement.GetProperty("instructions").GetString());
        Assert.Equal("Mach etwas", doc.RootElement.GetProperty("input")[0].GetProperty("content")[0].GetProperty("text").GetString());
    }

    [Fact]
    public void Pictures_and_files_ride_along_as_data_urls()
    {
        var message = AiMessage.User("Siehe Anhang");
        message.Attachments.Add(new AiAttachment { Kind = "image", MediaType = "image/png", Name = "a.png", Data = "AAAA" });
        message.Attachments.Add(new AiAttachment { Kind = "file", MediaType = "application/pdf", Name = "a.pdf", Data = "BBBB" });
        using var doc = JsonDocument.Parse(ChatGptAccount.BuildBody("m", [message]));
        var content = doc.RootElement.GetProperty("input")[0].GetProperty("content");
        Assert.Equal("input_image", content[1].GetProperty("type").GetString());
        Assert.Equal("data:image/png;base64,AAAA", content[1].GetProperty("image_url").GetString());
        Assert.Equal("input_file", content[2].GetProperty("type").GetString());
        Assert.Equal("a.pdf", content[2].GetProperty("filename").GetString());
    }

    [Theory]
    [InlineData("{\"error\":\"invalid_grant\"}", "invalid_grant")]
    [InlineData("{\"error\":{\"code\":\"token_expired\",\"message\":\"x\"}}", "token_expired")]
    [InlineData("{\"error\":{\"type\":\"invalid_request\"}}", "invalid_request")]
    [InlineData("{\"code\":\"abc\"}", "abc")]
    [InlineData("nicht json", null)]
    public void The_error_code_is_found_in_the_shapes_openai_uses(string body, string? code) => Assert.Equal(code, ChatGptAccount.ErrorCode(body));

    [Fact]
    public void The_error_text_prefers_the_detail_and_is_cut_at_300_characters()
    {
        Assert.Equal("kaputt", ChatGptAccount.ErrorText("{\"detail\":\"kaputt\"}"));
        Assert.Equal("Nachricht", ChatGptAccount.ErrorText("{\"error\":{\"message\":\"Nachricht\"}}"));
        Assert.Equal("Beschreibung", ChatGptAccount.ErrorText("{\"error\":\"x\",\"error_description\":\"Beschreibung\"}"));
        Assert.Equal(300, ChatGptAccount.ErrorText(new string('a', 500)).Length);
    }

    [Fact]
    public void The_default_endpoints_are_the_ones_of_openai() => Assert.StartsWith("https://", ChatGptEndpoints.Default.Issuer);
}
