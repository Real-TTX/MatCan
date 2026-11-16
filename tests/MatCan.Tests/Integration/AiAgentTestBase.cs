using System.Text.Json.Nodes;
using MatCan.Core.Documents;
using MatCan.Data;
using MatCan.Data.Entities;
using MatCan.Logic;
using MatCan.Services.Ai;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MatCan.Tests.Integration;

/// <summary>
/// What the tests of the design assistant share: a design of a person, a session for the tools (with the rows the journal needs), the settings of a test (everything on, no brake), the scripted fake model
/// (<see cref="AiTestSeam"/>) and a way to wait for a run to end. Real PostgreSQL, see <see cref="AppTests"/>.
/// </summary>
public abstract class AiAgentTestBase(AppTests.AppFactory factory) : PlatformTestBase(factory)
{
    protected AiTestSeam Seam => Factory.Services.GetRequiredService<AiTestSeam>();

    protected AiAgentRunner Runner => Factory.Services.GetRequiredService<AiAgentRunner>();

    /// <summary>The settings of a test: the AI on, no brake and no budget (a test that wants a limit sets one), the fake model empty, the pause between retries short.</summary>
    protected async Task ResetAsync(Action<AiSettings>? change = null)
    {
        Seam.Reset();
        AiAgentLoop.RetryPause = TimeSpan.FromMilliseconds(5);
        // the review before a run ends is off unless a test is about it (the designs of most tests are a title on an empty page, which the checks rightly find thin)
        var settings = new AiSettings { PerMinutePerAddress = 0, UserDailyTokens = 0, UserMonthlyTokens = 0, MonthlyTokens = 0, AddressDailyRuns = 0, AgentReview = false };
        change?.Invoke(settings);
        await As(Role.Admin, biz => SettingLogic.SaveAsync(biz, SettingStore.Ai, settings, "Test"));
    }

    protected static string Unique(string prefix) => prefix + Guid.NewGuid().ToString("N")[..8];

    protected static JsonObject Obj(string json) => (JsonObject)JsonNode.Parse(json)!;

    /// <summary>A design of the person in their own area: A4 portrait unless a document is given.</summary>
    protected async Task<long> DesignAsync(Role owner, string? documentJson = null, string? name = null)
    {
        var id = (await As(owner, biz => DesignLogic.CreateFromFormatAsync(biz, "a4-portrait", null, null, null, name ?? Unique("KI-Design ")))).Id;
        if (documentJson is not null)
        {
            await As(owner, async biz => await DesignLogic.SaveDocumentAsync(biz, id, 1, documentJson));
        }

        return id;
    }

    /// <summary>A document of a size with some elements written in short form: <c>Text("e1", x, y, w, h, "Text")</c>.</summary>
    protected static string DocumentOf(double width, double height, string unit, params object[] elements)
    {
        var doc = Obj(DocumentValidator.ToJson(DocumentValidator.Create(width, height, unit)));
        var page = (JsonArray)doc["pages"]!;
        var list = (JsonArray)page[0]!["elements"]!;
        foreach (var e in elements)
        {
            list.Add(e is JsonNode node ? node.DeepClone() : JsonNode.Parse((string)e));
        }

        return doc.ToJsonString();
    }

    protected static JsonObject Text(string id, double x, double y, double w, double h, string text, string color = "#000000", double size = 12, string family = "Open Sans")
        => Obj($$"""{"id": "{{id}}", "type": "text", "x": {{x}}, "y": {{y}}, "w": {{w}}, "h": {{h}}, "text": {{System.Text.Json.JsonSerializer.Serialize(text)}}, "color": "{{color}}", "fontSize": {{size}}, "fontFamily": "{{family}}"}""");

    protected static JsonObject Rect(string id, double x, double y, double w, double h, string fill)
        => Obj($$"""{"id": "{{id}}", "type": "shape", "shape": "rect", "x": {{x}}, "y": {{y}}, "w": {{w}}, "h": {{h}}, "fill": "{{fill}}"}""");

    /// <summary>What the tools of a run share, with the conversation and the run they write their journal to.</summary>
    protected async Task<AiToolSession> SessionAsync(Role who, long designId, AiScope? scope = null, int maxLooks = 6)
    {
        var userId = await UserAsync(who);
        return await Db(async db =>
        {
            var conversation = new AiConversation { SubjectId = designId, UserId = userId, Title = "Testgespräch", Runs = 1, Status = AiConversationStatus.Idle };
            db.AiConversation.Add(conversation);
            await db.SaveChangesAsync();
            var run = new AiRun { Action = AiAction.DesignAgent, SubjectType = nameof(Design), SubjectId = designId, UserId = userId, ConversationId = conversation.Id, Number = 1, StartDate = DateTime.UtcNow };
            db.AiRun.Add(run);
            await db.SaveChangesAsync();
            return new AiToolSession
            {
                ConversationId = conversation.Id,
                RunId = run.Id,
                RunNumber = 1,
                DesignId = designId,
                UserId = userId,
                Scope = scope ?? AiScope.Whole,
                Note = "KI: Testgespräch",
                MaxLooks = maxLooks,
                PictureFolder = Path.Combine(Path.GetTempPath(), "matcan-it-looks-" + Guid.NewGuid().ToString("N")),
            };
        });
    }

    protected Task<ToolOutcome> ToolAsync(Role who, AiToolSession session, string tool, string argsJson = "{}")
        => As(who, biz => AiDesignTools.RunAsync(biz, session, tool, Obj(argsJson)));

    protected async Task<JsonObject> StoredDocAsync(long designId)
    {
        var json = await Db(db => db.Design.AsNoTracking().Where(d => d.Id == designId).Select(d => d.DocumentJson).FirstAsync());
        return Obj(json);
    }

    protected async Task<int> RevisionAsync(long designId) => await Db(db => db.Design.AsNoTracking().Where(d => d.Id == designId).Select(d => d.Revision).FirstAsync());

    protected static IEnumerable<JsonObject> Elements(JsonObject doc, int page = 0) => AiDocOps.Walk(AiDocOps.Elements((JsonObject)AiDocOps.Pages(doc)[page]!));

    protected static JsonObject ElementOf(JsonObject doc, string id) => AiDocOps.Locate(doc, id)?.Element ?? throw new InvalidOperationException("no element " + id);

    // ------------------------------------------------------------------------------------------------ runs

    /// <summary>Sends a message as the person (text only unless more is given).</summary>
    protected Task<AiAgentLogic.Sent> SendAsync(Role who, long designId, string text, AiScope? scope = null, long? conversationId = null, IReadOnlyList<IncomingFile>? files = null, IReadOnlyList<IncomingRef>? refs = null)
        => As(who, biz => AiAgentLogic.SendAsync(biz, designId, new AiAgentLogic.SendInput(text, scope, conversationId, refs, files)));

    /// <summary>Waits until the conversation is idle again (the run ended) and returns the run.</summary>
    protected async Task<AiRun> WaitEndAsync(long conversationId, int seconds = 20)
    {
        var deadline = DateTime.UtcNow.AddSeconds(seconds);
        while (DateTime.UtcNow < deadline)
        {
            var idle = await Db(db => db.AiConversation.AsNoTracking().Where(c => c.Id == conversationId).Select(c => c.Status == AiConversationStatus.Idle).FirstAsync());
            if (idle)
            {
                return await Db(db => db.AiRun.AsNoTracking().Where(r => r.ConversationId == conversationId).OrderByDescending(r => r.Number).FirstAsync());
            }

            await Task.Delay(25);
        }

        throw new TimeoutException("The run did not end in " + seconds + " s.");
    }

    protected async Task WaitUntilAsync(Func<Task<bool>> condition, string what, int seconds = 20)
    {
        var deadline = DateTime.UtcNow.AddSeconds(seconds);
        while (DateTime.UtcNow < deadline)
        {
            if (await condition())
            {
                return;
            }

            await Task.Delay(25);
        }

        throw new TimeoutException("Waited in vain for: " + what);
    }

    protected Task<List<AiRunStep>> StepsOfAsync(long conversationId)
        => Db(db => (from s in db.AiRunStep.AsNoTracking() join r in db.AiRun.AsNoTracking() on s.AiRunId equals r.Id where r.ConversationId == conversationId orderby s.Id select s).ToListAsync());

    protected static string Kinds(IEnumerable<AiRunStep> steps) => string.Join(",", steps.Where(s => s.Kind != AiStepKind.Message).Select(s => s.Kind.ToString()));

    /// <summary>A tool call of the fake model as JSON text.</summary>
    protected static string Call(string tool, string args = "{}") => AiScripted.Tool(tool, args);
}
