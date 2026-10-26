using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.Services.Ai;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DesignThix.Tests.Integration;

/// <summary>
/// The design assistant over HTTP like the editor uses it (the form of a message, the poll, stop, undo with its 409, delete, the picture of <c>look</c>), with the rules of every API of the app: signed in, the
/// token of the page on every POST, a 403 for somebody who may only view, a 404 for a stranger, a 429 at a limit. And the real transport: a fake provider on a port of this machine that answers like an
/// OpenAI-compatible server (also as a stream), for the "Testen" of a profile and for a whole run.
/// </summary>
[Collection("app")]
public sealed class AiAgentEndpointTests(AppTests.AppFactory factory) : AiAgentTestBase(factory)
{
    private static readonly byte[] Png = File.ReadAllBytes(Path.Combine(DesignThix.Tests.Core.RepoFiles.WwwRoot(), "img", "icon-192.png"));

    private static async Task<string> TokenAsync(HttpClient client)
        => Regex.Match(await client.GetStringAsync("/"), "<meta name=\"dt-csrf\" content=\"([^\"]+)\"").Groups[1].Value;

    /// <summary>A POST with the token of the page in the header (a form, or JSON, or nothing).</summary>
    private static async Task<HttpResponseMessage> PostAsync(HttpClient client, string url, HttpContent? content = null, bool token = true)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = content };
        if (token)
        {
            request.Headers.Add("RequestVerificationToken", await TokenAsync(client));
        }

        return await client.SendAsync(request);
    }

    private static MultipartFormDataContent Message(string text, string? scope = null, long? conversation = null, string? refs = null, params (string Name, string FileName, byte[] Bytes)[] files)
    {
        var form = new MultipartFormDataContent { { new StringContent(text), "text" } };
        if (scope is not null)
        {
            form.Add(new StringContent(scope), "scope");
        }

        if (conversation is not null)
        {
            form.Add(new StringContent(conversation.Value.ToString()), "conversationId");
        }

        if (refs is not null)
        {
            form.Add(new StringContent(refs), "refs");
        }

        foreach (var (name, fileName, bytes) in files)
        {
            var part = new ByteArrayContent(bytes);
            part.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
            form.Add(part, name, fileName);
        }

        return form;
    }

    private static async Task<JsonElement> JsonOf(HttpResponseMessage response) => (await response.Content.ReadFromJsonAsync<JsonElement>()).Clone();

    private static async Task<JsonElement> PollAsync(HttpClient client, long conversation, Func<JsonElement, bool> until, int seconds = 20)
    {
        var deadline = DateTime.UtcNow.AddSeconds(seconds);
        JsonElement last = default;
        while (DateTime.UtcNow < deadline)
        {
            last = await client.GetFromJsonAsync<JsonElement>($"/api/ai/conversations/{conversation}/steps?after=0");
            if (until(last))
            {
                return last;
            }

            await Task.Delay(40);
        }

        throw new TimeoutException("The poll did not get there: " + last);
    }

    [Fact]
    public async Task A_message_goes_in_as_a_form_the_run_is_polled_and_the_whole_cycle_works_over_http()
    {
        if (!Enabled)
        {
            return;
        }

        await using var admins = await RealAdminsAsync();
        await ResetAsync();
        var design = await DesignAsync(Role.Designer, DocumentOf(210, 297, "mm", Text("e1", 10, 10, 100, 10, "Vorher")));
        var client = await SignInAsync(await UserAsync(Role.Designer));

        var status = await client.GetFromJsonAsync<JsonElement>($"/api/ai/designs/{design}/agent");
        Assert.False(status.GetProperty("showEntry").GetBoolean());   // no handler, no profile: not available
        Seam.Script(
            AiScripted.Say("Ich ändere den Text.", false, Call("update_elements", """{"id": "e1", "set": {"text": "Nachher"}}""")),
            AiScripted.Say("Fertig.", true));
        status = await client.GetFromJsonAsync<JsonElement>($"/api/ai/designs/{design}/agent");
        Assert.True(status.GetProperty("showEntry").GetBoolean());
        Assert.True(status.GetProperty("canEdit").GetBoolean());
        Assert.Equal(6, status.GetProperty("maxFiles").GetInt32());

        var posted = await PostAsync(client, $"/api/ai/designs/{design}/messages",
            Message("Ändere den Text", """{"kind": "page", "pageId": "p1", "locked": false}""", null, """[{"kind": "design", "id": 987654321}]""", ("files", "notiz.txt", Encoding.UTF8.GetBytes("Käse für alle")), ("model-1", "x.jpg", [0xFF, 0xD8, 0xFF, 0xE0, 0, 0])));
        Assert.Equal(HttpStatusCode.OK, posted.StatusCode);
        var sent = await JsonOf(posted);
        var conversation = sent.GetProperty("conversationId").GetInt64();
        Assert.Equal(1, sent.GetProperty("run").GetInt32());
        Assert.Equal(2, sent.GetProperty("files").GetArrayLength());
        Assert.Equal("text", sent.GetProperty("files")[0].GetProperty("kind").GetString());
        Assert.Equal("reference", sent.GetProperty("files")[1].GetProperty("kind").GetString());
        Assert.NotEqual(JsonValueKind.Null, sent.GetProperty("files")[1].GetProperty("refused").ValueKind);

        // while it works the design cannot be written by a second message
        var polled = await PollAsync(client, conversation, p => p.GetProperty("status").GetString() == "Idle");
        Assert.Equal("Idle", polled.GetProperty("status").GetString());
        Assert.Equal(1, polled.GetProperty("undoRun").GetInt32());
        var kinds = polled.GetProperty("steps").EnumerateArray().Select(s => s.GetProperty("kind").GetString()).ToList();
        Assert.Equal(["user", "assistant", "action", "assistant", "end"], kinds);
        var user = polled.GetProperty("steps")[0];
        Assert.Equal("Ändere den Text", user.GetProperty("text").GetString());
        Assert.Equal("page", user.GetProperty("data").GetProperty("scope").GetProperty("kind").GetString());
        Assert.Equal("notiz.txt", user.GetProperty("data").GetProperty("files")[0].GetProperty("name").GetString());
        var action = polled.GetProperty("steps")[2];
        Assert.Equal("update_elements", action.GetProperty("data").GetProperty("tool").GetString());
        Assert.True(action.GetProperty("data").GetProperty("changed").GetBoolean());
        Assert.Equal("p1", action.GetProperty("data").GetProperty("pageId").GetString());
        var lastId = polled.GetProperty("steps")[3].GetProperty("id").GetInt64();
        var after = await client.GetFromJsonAsync<JsonElement>($"/api/ai/conversations/{conversation}/steps?after={lastId}");
        Assert.Equal(1, after.GetProperty("steps").GetArrayLength());

        var info = await client.GetFromJsonAsync<JsonElement>($"/api/ai/conversations/{conversation}");
        Assert.Equal(design, info.GetProperty("designId").GetInt64());
        Assert.Equal("page", info.GetProperty("scope").GetProperty("kind").GetString());
        Assert.Equal(1, info.GetProperty("runs").GetArrayLength());
        var list = await client.GetFromJsonAsync<JsonElement>($"/api/ai/designs/{design}/conversations");
        Assert.Equal(conversation, list[0].GetProperty("id").GetInt64());
        var prompt = await client.GetFromJsonAsync<JsonElement>($"/api/ai/designs/{design}/agent/prompt?scope=" + Uri.EscapeDataString("""{"kind": "page", "pageId": "p1", "locked": true}"""));
        Assert.Contains("Nur hier ändern", prompt.GetProperty("text").GetString());

        // stop: nothing runs
        var stopped = await JsonOf(await PostAsync(client, $"/api/ai/conversations/{conversation}/cancel"));
        Assert.False(stopped.GetProperty("stopped").GetBoolean());

        // somebody saves in the editor: the undo asks (409 with changedSince), force goes ahead
        await As(Role.Designer, async biz =>
        {
            var current = await DesignLogic.LoadAsync(biz, design);
            var doc = Obj(current!.DocumentJson);
            AiDocOps.Elements((JsonObject)AiDocOps.Pages(doc)[0]!).Add(Text("hand", 10, 100, 100, 10, "von Hand"));
            await DesignLogic.SaveDocumentAsync(biz, design, current.Revision, doc.ToJsonString(), true);
        });
        var asked = await PostAsync(client, $"/api/ai/conversations/{conversation}/undo");
        Assert.Equal(HttpStatusCode.Conflict, asked.StatusCode);
        var askedJson = await JsonOf(asked);
        Assert.True(askedJson.GetProperty("changedSince").GetBoolean());
        Assert.Contains("Trotzdem", askedJson.GetProperty("error").GetString());
        var forced = await PostAsync(client, $"/api/ai/conversations/{conversation}/undo", JsonContent.Create(new { force = true }));
        Assert.Equal(HttpStatusCode.OK, forced.StatusCode);
        var undone = await JsonOf(forced);
        Assert.Equal(1, undone.GetProperty("run").GetInt32());
        Assert.Equal("Vorher", (await StoredDocAsync(design))["pages"]![0]!["elements"]![0]!["text"]!.ToString());
        var nothing = await PostAsync(client, $"/api/ai/conversations/{conversation}/undo");
        Assert.Equal(HttpStatusCode.BadRequest, nothing.StatusCode);
        Assert.Contains("nichts rückgängig", (await JsonOf(nothing)).GetProperty("error").GetString());

        // delete
        Assert.Equal(HttpStatusCode.OK, (await PostAsync(client, $"/api/ai/conversations/{conversation}/delete")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/ai/conversations/{conversation}/steps")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/ai/conversations/{conversation}")).StatusCode);
    }

    [Fact]
    public async Task The_rules_of_the_app_apply_the_token_the_sign_in_the_level_and_the_limits()
    {
        if (!Enabled)
        {
            return;
        }

        await using var admins = await RealAdminsAsync();
        await ResetAsync();
        var design = await DesignAsync(Role.Designer);
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer, SharePermission.View);
        Seam.Script(AiScripted.Say("Fertig.", true), AiScripted.Say("Fertig.", true), AiScripted.Say("Fertig.", true));
        var owner = await SignInAsync(await UserAsync(Role.Designer));
        var viewer = await SignInAsync(await UserAsync(Role.Viewer));
        var stranger = await SignInAsync(await UserAsync(Role.Stranger));
        var nobody = Factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        // not signed in
        Assert.NotEqual(HttpStatusCode.OK, (await nobody.GetAsync($"/api/ai/designs/{design}/agent")).StatusCode);
        Assert.NotEqual(HttpStatusCode.OK, (await nobody.PostAsync($"/api/ai/designs/{design}/messages", Message("x"))).StatusCode);
        // the token of the page is needed, without it nothing is stored
        var conversations = await Db(db => db.AiConversation.CountAsync());
        var noToken = await PostAsync(owner, $"/api/ai/designs/{design}/messages", Message("Ohne Token"), token: false);
        Assert.Equal(HttpStatusCode.BadRequest, noToken.StatusCode);
        Assert.Equal(conversations, await Db(db => db.AiConversation.CountAsync()));
        Assert.Equal(HttpStatusCode.BadRequest, (await PostAsync(owner, "/api/ai/conversations/1/cancel", null, token: false)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await PostAsync(owner, "/api/ai/runs/1/render/abc", null, token: false)).StatusCode);
        // not a form
        Assert.Equal(HttpStatusCode.BadRequest, (await PostAsync(owner, $"/api/ai/designs/{design}/messages", JsonContent.Create(new { text = "Json" }))).StatusCode);
        // a message without anything
        var empty = await PostAsync(owner, $"/api/ai/designs/{design}/messages", Message("  "));
        Assert.Equal(HttpStatusCode.BadRequest, empty.StatusCode);
        Assert.Contains("Schreib", (await JsonOf(empty)).GetProperty("error").GetString());

        // levels: a viewer may look at the state of the entry but not write; a stranger finds nothing
        Assert.Equal(HttpStatusCode.OK, (await viewer.GetAsync($"/api/ai/designs/{design}/agent")).StatusCode);
        Assert.False((await viewer.GetFromJsonAsync<JsonElement>($"/api/ai/designs/{design}/agent")).GetProperty("showEntry").GetBoolean());
        Assert.Equal(HttpStatusCode.Forbidden, (await PostAsync(viewer, $"/api/ai/designs/{design}/messages", Message("Hallo"))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await viewer.GetAsync($"/api/ai/designs/{design}/conversations")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await viewer.GetAsync($"/api/ai/designs/{design}/agent/prompt")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await PostAsync(stranger, $"/api/ai/designs/{design}/messages", Message("Hallo"))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/api/ai/designs/{design}/agent")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/api/ai/designs/{design}/agent/prompt")).StatusCode);
        Assert.Equal(conversations, await Db(db => db.AiConversation.CountAsync()));

        // the conversation of one person is not visible to another, whatever the id
        var sent = await JsonOf(await PostAsync(owner, $"/api/ai/designs/{design}/messages", Message("Hallo")));
        var conversation = sent.GetProperty("conversationId").GetInt64();
        await PollAsync(owner, conversation, p => p.GetProperty("status").GetString() == "Idle");
        foreach (var path in new[] { $"/api/ai/conversations/{conversation}", $"/api/ai/conversations/{conversation}/steps", $"/api/ai/conversations/{conversation}/files/x.png" })
        {
            Assert.Equal(HttpStatusCode.NotFound, (await viewer.GetAsync(path)).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync(path)).StatusCode);
        }

        foreach (var path in new[] { $"/api/ai/conversations/{conversation}/cancel", $"/api/ai/conversations/{conversation}/undo", $"/api/ai/conversations/{conversation}/delete" })
        {
            Assert.Equal(HttpStatusCode.NotFound, (await PostAsync(stranger, path)).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await PostAsync(viewer, path)).StatusCode);
        }

        // a limit is a 429 with the reason; nothing is stored
        await ResetAsync(s => s.UserDailyTokens = 1);
        Seam.Script(AiScripted.Say("Fertig.", true));
        var before = await Db(db => db.AiConversation.CountAsync());
        var limited = await PostAsync(owner, $"/api/ai/designs/{design}/messages", Message("Noch einmal"));
        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
        var limitedJson = await JsonOf(limited);
        Assert.Equal("limit", limitedJson.GetProperty("code").GetString());
        Assert.Contains("Tagesbudget", limitedJson.GetProperty("error").GetString());
        Assert.Equal(before, await Db(db => db.AiConversation.CountAsync()));
        await ResetAsync();

        // somebody else's run is busy: a message is refused with a reason (400)
        Seam.Script(new AiScripted(AiScripted.Say("Langsam.", true).Text, Delay: TimeSpan.FromSeconds(60)));
        var slow = await JsonOf(await PostAsync(owner, $"/api/ai/designs/{design}/messages", Message("Langsam")));
        var busy = await PostAsync(owner, $"/api/ai/designs/{design}/messages", Message("Gleich noch eine", null, slow.GetProperty("conversationId").GetInt64()));
        Assert.Equal(HttpStatusCode.BadRequest, busy.StatusCode);
        Assert.Contains("arbeitet gerade", (await JsonOf(busy)).GetProperty("error").GetString());
        Assert.True((await JsonOf(await PostAsync(owner, $"/api/ai/conversations/{slow.GetProperty("conversationId").GetInt64()}/cancel"))).GetProperty("stopped").GetBoolean());
        await WaitEndAsync(slow.GetProperty("conversationId").GetInt64());
    }

    [Fact]
    public async Task A_new_design_is_made_from_a_prompt_in_one_request_and_the_editor_can_follow_it()
    {
        if (!Enabled)
        {
            return;
        }

        await using var admins = await RealAdminsAsync();
        await ResetAsync();
        Seam.Script(AiScripted.Say("Ich wähle das Format.", false, Call("resize_design", """{"preset": "instagram-post"}""")), AiScripted.Say("Fertig.", true));
        var client = await SignInAsync(await UserAsync(Role.Designer));
        var form = new MultipartFormDataContent { { new StringContent("Ein Post für das Sommerfest"), "text" }, { new StringContent("auto"), "preset" } };
        var response = await PostAsync(client, "/api/ai/designs/new", form);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var started = await JsonOf(response);
        var design = started.GetProperty("id").GetInt64();
        var conversation = started.GetProperty("conversationId").GetInt64();
        Assert.Equal($"/Designs/{design}/Designer?ai={conversation}", started.GetProperty("url").GetString());
        await PollAsync(client, conversation, p => p.GetProperty("status").GetString() == "Idle");
        var doc = await StoredDocAsync(design);
        Assert.Equal(1080, (double)doc["width"]!);
        Assert.Equal("px", (string)doc["unit"]!);
        // with a chosen format and in a team
        var team = await TeamAsync(Role.Designer);
        Seam.Reset();
        Seam.Script(AiScripted.Say("Fertig.", true));
        var chosen = await PostAsync(client, "/api/ai/designs/new", new MultipartFormDataContent { { new StringContent("Karte"), "text" }, { new StringContent("business-card"), "preset" }, { new StringContent(team.ToString()), "spaceId" } });
        var chosenJson = await JsonOf(chosen);
        Assert.Equal(team, await Db(db => db.Design.AsNoTracking().Where(d => d.Id == chosenJson.GetProperty("id").GetInt64()).Select(d => d.SpaceId).FirstAsync()));
        await WaitEndAsync(chosenJson.GetProperty("conversationId").GetInt64());
        // nothing to say: no design
        var designs = await Db(db => db.Design.CountAsync());
        var none = await PostAsync(client, "/api/ai/designs/new", new MultipartFormDataContent { { new StringContent(""), "text" } });
        Assert.Equal(HttpStatusCode.BadRequest, none.StatusCode);
        Assert.Equal(designs, await Db(db => db.Design.CountAsync()));
        // a team where the person may only view: the design is not made and nothing is left behind
        var viewerTeam = await TeamAsync(Role.Stranger, (Role.Designer, SpaceRole.Viewer));
        var refused = await PostAsync(client, "/api/ai/designs/new", new MultipartFormDataContent { { new StringContent("Hallo"), "text" }, { new StringContent(viewerTeam.ToString()), "spaceId" } });
        Assert.Equal(HttpStatusCode.Forbidden, refused.StatusCode);
        Assert.Equal(designs + 0, await Db(db => db.Design.CountAsync()));
    }

    [Fact]
    public async Task The_picture_for_look_is_handed_in_over_http_by_the_person_of_the_run_only()
    {
        if (!Enabled)
        {
            return;
        }

        await using var admins = await RealAdminsAsync();
        await ResetAsync();
        var design = await DesignAsync(Role.Designer);
        var owner = await SignInAsync(await UserAsync(Role.Designer));
        var stranger = await SignInAsync(await UserAsync(Role.Stranger));
        Seam.Script(AiScripted.Say("Ich schaue.", false, Call("look")), AiScripted.Say("Fertig.", true));
        var sent = await JsonOf(await PostAsync(owner, $"/api/ai/designs/{design}/messages", Message("Prüf es")));
        var conversation = sent.GetProperty("conversationId").GetInt64();
        var asked = await PollAsync(owner, conversation, p => p.GetProperty("renderRequest").ValueKind == JsonValueKind.Object);
        var request = asked.GetProperty("renderRequest");
        var runId = request.GetProperty("runId").GetInt64();
        var token = request.GetProperty("token").GetString();
        Assert.Equal("p1", request.GetProperty("page").GetString());
        Assert.Equal(1024, request.GetProperty("maxWidth").GetInt32());

        ByteArrayContent Image(byte[] bytes, string type = "image/png")
        {
            var content = new ByteArrayContent(bytes);
            content.Headers.ContentType = new MediaTypeHeaderValue(type);
            return content;
        }

        Assert.Equal(HttpStatusCode.NotFound, (await PostAsync(stranger, $"/api/ai/runs/{runId}/render/{token}", Image(Png))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await PostAsync(owner, $"/api/ai/runs/{runId}/render/falscher-token", Image(Png))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await PostAsync(owner, $"/api/ai/runs/{runId}/render/{token}", Image("kein Bild"u8.ToArray(), "text/plain"))).StatusCode);
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, (await PostAsync(owner, $"/api/ai/runs/{runId}/render/{token}", Image(new byte[AiAttachmentLogic.MaxModelImageBytes + 1000]))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await PostAsync(owner, $"/api/ai/runs/{runId}/render/{token}", Image(Png))).StatusCode);
        var done = await PollAsync(owner, conversation, p => p.GetProperty("status").GetString() == "Idle");
        var look = done.GetProperty("steps").EnumerateArray().First(s => s.GetProperty("kind").GetString() == "action");
        var picture = look.GetProperty("data").GetProperty("picture").GetString();
        Assert.NotNull(picture);
        Assert.Equal(Png.Length, (await owner.GetByteArrayAsync($"/api/ai/conversations/{conversation}/files/{picture}")).Length);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/api/ai/conversations/{conversation}/files/{picture}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.GetAsync($"/api/ai/conversations/{conversation}/files/..%2F..%2Fappsettings.json")).StatusCode);
        // after the run nobody waits: the late picture is refused
        Assert.Equal(HttpStatusCode.NotFound, (await PostAsync(owner, $"/api/ai/runs/{runId}/render/{token}", Image(Png))).StatusCode);

        // the editor that cannot draw the page says so; the form variant of the body works too
        Seam.Reset();
        Seam.Script(AiScripted.Say("Ich schaue.", false, Call("look")), AiScripted.Say("Fertig.", true));
        var again = await JsonOf(await PostAsync(owner, $"/api/ai/designs/{design}/messages", Message("Nochmal", null, conversation)));
        var second = await PollAsync(owner, conversation, p => p.GetProperty("renderRequest").ValueKind == JsonValueKind.Object && p.GetProperty("run").GetInt32() == 2);
        var secondRequest = second.GetProperty("renderRequest");
        Assert.Equal(HttpStatusCode.OK, (await PostAsync(owner, $"/api/ai/runs/{secondRequest.GetProperty("runId").GetInt64()}/render/{secondRequest.GetProperty("token").GetString()}/failed")).StatusCode);
        await WaitEndAsync(again.GetProperty("conversationId").GetInt64());
        var steps = await StepsOfAsync(conversation);
        Assert.Contains(steps, s => s.Kind == AiStepKind.Action && s.Text == "Kein Bild verfügbar");
    }

    // ------------------------------------------------------------------------------------------------ the real transport

    /// <summary>A fake provider on a port of this machine: it answers like an OpenAI-compatible server, as one document or as a stream.</summary>
    private sealed class FakeProvider : IAsyncDisposable
    {
        private WebApplication? _app;

        public string BaseUrl { get; private set; } = "";

        public List<JsonObject> Bodies { get; } = [];

        public List<string> Keys { get; } = [];

        /// <summary>The text for the n-th call (from 0) and the pieces it is streamed in with a pause after the first.</summary>
        public Func<int, JsonObject, (string Text, string[]? Pieces)> Answer { get; set; } = (_, _) => ("{\"ok\": true, \"message\": \"Hallo vom Fake\"}", null);

        public bool RefuseStream { get; set; }

        public static async Task<FakeProvider> StartAsync()
        {
            var fake = new FakeProvider();
            var builder = WebApplication.CreateSlimBuilder();
            builder.Logging.ClearProviders();
            var app = builder.Build();
            app.Urls.Add("http://127.0.0.1:0");
            app.MapPost("/v1/chat/completions", async (HttpContext http) =>
            {
                var body = (JsonObject)JsonNode.Parse(await new StreamReader(http.Request.Body).ReadToEndAsync())!;
                int index;
                lock (fake.Bodies)
                {
                    index = fake.Bodies.Count;
                    fake.Bodies.Add(body);
                    fake.Keys.Add(http.Request.Headers.Authorization.ToString());
                }

                var wantsStream = body["stream"] is JsonValue v && v.TryGetValue<bool>(out var b) && b;
                if (wantsStream && fake.RefuseStream)
                {
                    http.Response.StatusCode = 400;
                    await http.Response.WriteAsJsonAsync(new { error = new { message = "stream is not supported by this model" } });
                    return;
                }

                var (text, pieces) = fake.Answer(index, body);
                if (!wantsStream)
                {
                    await http.Response.WriteAsJsonAsync(new { choices = new[] { new { message = new { role = "assistant", content = text }, finish_reason = "stop" } }, usage = new { prompt_tokens = 20, completion_tokens = 10 } });
                    return;
                }

                http.Response.ContentType = "text/event-stream";
                var parts = pieces ?? [text];
                for (var i = 0; i < parts.Length; i++)
                {
                    await http.Response.WriteAsync("data: " + JsonSerializer.Serialize(new { choices = new[] { new { delta = new { content = parts[i] }, finish_reason = (string?)null } } }) + "\n\n");
                    await http.Response.Body.FlushAsync();
                    if (i == 0 && parts.Length > 1)
                    {
                        await Task.Delay(700);
                    }
                }

                await http.Response.WriteAsync("data: " + JsonSerializer.Serialize(new { choices = new[] { new { delta = new { }, finish_reason = "stop" } } }) + "\n\n");
                await http.Response.WriteAsync("data: " + JsonSerializer.Serialize(new { choices = Array.Empty<object>(), usage = new { prompt_tokens = 20, completion_tokens = 10 } }) + "\n\n");
                await http.Response.WriteAsync("data: [DONE]\n\n");
            });
            await app.StartAsync();
            fake._app = app;
            fake.BaseUrl = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.First() + "/v1";
            return fake;
        }

        public async ValueTask DisposeAsync()
        {
            if (_app is not null)
            {
                await _app.StopAsync();
                await _app.DisposeAsync();
            }
        }
    }

    private async Task<long> ProfileAsync(string name, string baseUrl, string? key, bool activate)
    {
        var profile = await As(Role.Admin, biz => AiProfileLogic.SaveAsync(biz, null, new AiProfileLogic.ProfileInput(name, AiProvider.OpenAiCompatible, "custom", baseUrl, "fake-" + name, key, false, null)));
        if (activate)
        {
            await As(Role.Admin, biz => AiProfileLogic.ActivateAsync(biz, profile.Id));
        }

        return profile.Id;
    }

    [Fact]
    public async Task Testing_a_profile_tests_that_profile_through_its_own_connection_active_or_not()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await using var a = await FakeProvider.StartAsync();
        await using var b = await FakeProvider.StartAsync();
        a.Answer = (_, _) => ("{\"ok\": true, \"message\": \"Hallo von A\"}", null);
        b.Answer = (_, _) => ("{\"ok\": true, \"message\": \"Hallo von B\"}", null);
        var idA = await ProfileAsync(Unique("Profil-A "), a.BaseUrl, "schluessel-a", true);
        var idB = await ProfileAsync(Unique("Profil-B "), b.BaseUrl, "schluessel-b", false);
        var idC = await ProfileAsync(Unique("Profil-C "), b.BaseUrl, null, false);
        try
        {
            var active = await As(Role.Admin, biz => AiLogic.TestAsync(biz, null));
            Assert.Contains("Hallo von A", active);
            Assert.Single(a.Bodies);
            Assert.Empty(b.Bodies);
            Assert.Equal("Bearer schluessel-a", a.Keys[0]);

            var other = await As(Role.Admin, biz => AiLogic.TestAsync(biz, null, idB));
            Assert.StartsWith("Verbindung steht", other);
            Assert.Contains("Hallo von B", other);
            Assert.Single(a.Bodies);   // the active profile was not asked
            Assert.Single(b.Bodies);
            Assert.Equal("Bearer schluessel-b", b.Keys[0]);
            Assert.Equal("fake-" + (await As(Role.Admin, biz => AiProfileLogic.GetAsync(biz, idB)))!.Name, (string)b.Bodies[0]["model"]!);

            // a profile without its key is not tested through another one
            var incomplete = await As(Role.Admin, biz => AiLogic.TestAsync(biz, null, idC));
            Assert.StartsWith("Fehlgeschlagen", incomplete);
            Assert.Contains("nicht fertig eingerichtet", incomplete);
            Assert.Single(b.Bodies);
            await Assert.ThrowsAsync<BizException>(() => As(Role.Admin, biz => AiLogic.TestAsync(biz, null, 987654321)));
            await Assert.ThrowsAsync<ForbiddenException>(() => As(Role.Designer, biz => AiLogic.TestAsync(biz, null, idB)));
            // the run of the test is in the list with the profile that answered
            var runs = await Db(db => db.AiRun.AsNoTracking().Where(r => r.Action == AiAction.Test).OrderByDescending(r => r.Id).Take(3).ToListAsync());
            Assert.Contains(runs, r => r.ProfileName.StartsWith("Profil-B"));
        }
        finally
        {
            foreach (var id in new[] { idA, idB, idC })
            {
                await As(Role.Admin, biz => AiProfileLogic.DeleteAsync(biz, id));
            }
        }
    }

    [Fact]
    public async Task A_whole_run_works_over_a_real_connection_with_a_stream_and_without_when_the_provider_refuses_it()
    {
        if (!Enabled)
        {
            return;
        }

        await ResetAsync();
        await using var fake = await FakeProvider.StartAsync();
        var read = "{\"message\": \"Ich lese das Design und schaue, was da ist.\", \"actions\": [{\"tool\": \"read_design\", \"args\": {}}], \"done\": false}";
        var done = "{\"message\": \"Alles gelesen.\", \"actions\": [], \"done\": true}";
        fake.Answer = (index, _) => index == 0 ? (read, ["{\"message\": \"Ich lese das Design ", "und schaue, was da ist.\", \"actions\": [{\"tool\": \"read_design\", \"args\": {}}], \"done\": false}"]) : (done, null);
        var id = await ProfileAsync(Unique("Streamprofil "), fake.BaseUrl, "schluessel", true);
        try
        {
            var design = await DesignAsync(Role.Designer);
            var sent = await SendAsync(Role.Designer, design, "Lies das Design");
            // the words are there while the model is still writing
            string? seen = null;
            await WaitUntilAsync(async () =>
            {
                seen = (await As(Role.Designer, biz => AiAgentLogic.StepsAsync(biz, sent.ConversationId, 0))).Partial;
                return !string.IsNullOrEmpty(seen);
            }, "the first words");
            Assert.Equal("Ich lese das Design ", seen);
            var run = await WaitEndAsync(sent.ConversationId);
            Assert.Equal(AiRunStatus.Done, run.Status);
            Assert.Equal(2, fake.Bodies.Count);
            Assert.True((bool)fake.Bodies[0]["stream"]!);
            Assert.Equal("json_object", (string)fake.Bodies[0]["response_format"]!["type"]!);
            Assert.Equal("Bearer schluessel", fake.Keys[0]);
            Assert.Equal(60, run.TotalTokens);   // two calls of 20 + 10
            Assert.Equal("Ich lese das Design und schaue, was da ist.", (await StepsOfAsync(sent.ConversationId)).First(s => s.Kind == AiStepKind.Assistant).Text);
            Assert.Equal($"Streamprofil", run.ProfileName[..12]);

            // a provider that cannot stream: asked again without it, the run is the same
            fake.RefuseStream = true;
            var before = fake.Bodies.Count;
            var next = await SendAsync(Role.Designer, design, "Und nochmal", conversationId: sent.ConversationId);
            Assert.Equal(AiRunStatus.Done, (await WaitEndAsync(next.ConversationId)).Status);
            Assert.Contains(fake.Bodies.Skip(before), b => b["stream"] is null);
        }
        finally
        {
            await As(Role.Admin, biz => AiProfileLogic.DeleteAsync(biz, id));
        }
    }

    [Fact]
    public async Task The_start_page_and_the_dialog_offer_the_prompt_only_when_the_AI_is_on_and_set_up()
    {
        if (!Enabled)
        {
            return;
        }

        await using var admins = await RealAdminsAsync();
        await ResetAsync();
        var client = await SignInAsync(await UserAsync(Role.Designer));

        // no handler and no profile: no prompt on the start page, none in the dialog, no script for it
        var without = await client.GetStringAsync("/");
        Assert.DoesNotContain("data-ai-create", without);
        Assert.DoesNotContain("create-ai.js", without);

        Seam.Script(AiScripted.Say("Fertig.", true));
        var with = await client.GetStringAsync("/");
        Assert.Equal(2, Regex.Matches(with, "data-ai-create").Count);   // the card under the heading and the one in the dialog "Design erstellen"
        Assert.Contains("dt-aip--hero", with);
        Assert.Contains("dt-aip--dialog", with);
        Assert.Contains("create-ai.js", with);
        Assert.Contains("ai-attach.js", with);
        Assert.Contains("id=\"dt-create-ai-text\"", with);
        Assert.Contains("id=\"start-ai-text\"", with);

        // every other page carries the one of the dialog only
        var projects = await client.GetStringAsync("/Projekte");
        Assert.Single(Regex.Matches(projects, "data-ai-create"));
    }
}
