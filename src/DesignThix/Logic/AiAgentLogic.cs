using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using DesignThix.Core.Documents;
using DesignThix.Core.Media;
using DesignThix.Data.Entities;
using DesignThix.Services.Ai;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Logic;

/// <summary>A limit of the AI is reached (budget, runs per day, calls per minute): the message says which; the request answers 429.</summary>
public sealed class AiLimitException(string message, string kind = "limit", string? href = null) : Exception(message)
{
    /// <summary>Which limit: <c>user-day</c>, <c>user-month</c>, <c>all-month</c>, <c>address-day</c> or <c>minute</c>.</summary>
    public string Kind { get; } = kind;

    /// <summary>Where an administrator changes the limits (null for everybody else).</summary>
    public string? Href { get; } = href;
}

/// <summary>The design was changed by somebody after the run that is to be undone: the undo asks again with <c>force</c> (HTTP 409 with <c>changedSince</c>).</summary>
public sealed class AiChangedSinceException(int currentRevision) : Exception("Seitdem wurde das Design geändert. Trotzdem zurücksetzen? Diese Änderungen gehen verloren.")
{
    public int CurrentRevision { get; } = currentRevision;
}

/// <summary>
/// The design assistant as the endpoints use it (docs/PLAN-AI-DESIGN.md 3.1, 3.5, 3.6, 3.8): send a message (with files and references), read the steps of a conversation as the run writes them, stop, undo
/// the newest run, delete a conversation, show the whole instruction, take in the picture the editor drew for <c>look</c>. The work itself is <see cref="AiAgentLoop"/>, run by
/// <see cref="AiAgentRunner"/>; this is the bookkeeping and the permissions around it. A conversation is private to its person (an administrator reads it); what the AI may do to the design is what the
/// person may do: Edit on the design, checked here and again by every tool.
/// </summary>
public static partial class AiAgentLogic
{
    public const int MaxMessageChars = 20_000;
    public const int MaxRefs = 6;
    public const int MaxConversationsListed = 50;
    public const int MaxStepsPerPoll = 400;

    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    // ================================================================================================ may the AI be used here

    /// <summary>Whether the panel of the design assistant is offered, and why not: a member sees it when they may edit the design and the AI works; an administrator also when it is off or has no profile (the panel then says why).</summary>
    public sealed record Availability(bool CanEdit, bool Enabled, bool Available, bool ShowEntry, string? Reason, string? SettingsHref, long? RunningConversationId, int MaxFiles, long MaxFileBytes, int MaxLooks, string? LimitsHref = null);

    public static async Task<Availability> AvailabilityAsync(Biz biz, long designId)
    {
        var level = await Access.LevelAsync(biz, ItemKind.Design, designId);
        if (level == AccessLevel.None)
        {
            throw new NotFoundException();
        }

        var settings = SettingLogic.Get<AiSettings>(biz, SettingStore.Ai);
        var available = settings.Enabled && await AiLogic.IsAvailableAsync(biz);
        var canEdit = level >= AccessLevel.Edit;
        string? reason = null;
        string? href = null;
        if (!settings.Enabled)
        {
            reason = biz.IsAdmin ? "Die KI ist ausgeschaltet (Verwaltung → KI → Allgemein)." : null;
            href = biz.IsAdmin ? "/Admin/Ai" : null;
        }
        else if (!available)
        {
            reason = biz.IsAdmin ? "Es ist noch keine KI eingerichtet. Lege unter Verwaltung → KI → Profile eine Verbindung an und mach sie aktiv." : null;
            href = biz.IsAdmin ? "/Admin/Ai/Profiles" : null;
        }

        var show = canEdit && (available || biz.IsAdmin);
        var running = await biz.Db.AiConversation.AsNoTracking().Where(c => c.SubjectType == nameof(Design) && c.SubjectId == designId && c.Status == AiConversationStatus.Running).Select(c => (long?)c.Id).FirstOrDefaultAsync();
        return new Availability(canEdit, settings.Enabled, available, show, reason, href, running, settings.AgentMaxFilesPerMessage, AiAttachmentLogic.MaxFileBytes, settings.AgentMaxLooks, AiLogic.LimitsHref(biz));
    }

    /// <summary>The checks before anything is stored: the AI is on and set up, no limit is reached (the budgets, the runs per address and day, the calls per address and minute).</summary>
    private static async Task PreflightAsync(Biz biz)
    {
        var settings = SettingLogic.Get<AiSettings>(biz, SettingStore.Ai);
        if (!settings.Enabled)
        {
            throw new BizException(biz.IsAdmin ? "Die KI ist ausgeschaltet (Verwaltung → KI → Allgemein)." : "Die KI ist ausgeschaltet.");
        }

        if (!await AiLogic.IsAvailableAsync(biz))
        {
            throw new BizException(biz.IsAdmin ? "Es ist noch keine KI eingerichtet. Lege unter Verwaltung → KI → Profile eine Verbindung an und mach sie aktiv." : "Die KI ist noch nicht eingerichtet. Bitte wende dich an einen Administrator.");
        }

        var now = biz.Now;
        if (await AiLogic.BudgetReasonAsync(biz.Db, settings, biz.UserId, now, default) is { } budget)
        {
            throw new AiLimitException(budget.Text, budget.Kind, AiLogic.LimitsHref(biz));
        }

        var limiter = biz.Service<AiRateLimiter>();
        var address = biz.User.IpAddress;
        if (await AiLogic.RunsPerDayReasonAsync(biz.Db, settings, address is null ? null : limiter.Hash(address), now, default) is { } perDay)
        {
            throw new AiLimitException(perDay.Text, perDay.Kind, AiLogic.LimitsHref(biz));
        }

        if (!limiter.WouldAllow(address, settings.PerMinutePerAddress))
        {
            throw new AiLimitException(AiLogic.RateReason, AiLogic.RateKind, AiLogic.LimitsHref(biz));
        }
    }

    // ================================================================================================ conversations

    private static async Task<AiConversation> OwnConversationAsync(Biz biz, long id, bool tracked = true)
    {
        biz.RequireSignedIn();
        var query = tracked ? biz.Db.AiConversation : biz.Db.AiConversation.AsNoTracking();
        var conv = await query.FirstOrDefaultAsync(c => c.Id == id && c.SubjectType == nameof(Design));
        await CheckOwnAsync(biz, conv?.UserId, conv?.SubjectId);
        return conv!;
    }

    /// <summary>
    /// The rule of every conversation endpoint: the person of the conversation (as long as they may still see the design) or an administrator; everybody else, and a conversation that is not there, gets 404.
    /// </summary>
    private static async Task CheckOwnAsync(Biz biz, long? userId, long? designId)
    {
        if (userId is null || designId is null || (userId != biz.UserId && !biz.IsAdmin))
        {
            throw new NotFoundException();
        }

        if (userId == biz.UserId && !biz.IsAdmin && await Access.LevelAsync(biz, ItemKind.Design, designId.Value) == AccessLevel.None)
        {
            throw new NotFoundException();
        }
    }

    /// <summary>What the poll needs of a conversation. Not the history (hundreds of KB): the poll of an open editor comes every second.</summary>
    private sealed record ConversationHead(long Id, long UserId, long SubjectId, AiConversationStatus Status, int Runs, int Tokens);

    private static async Task<ConversationHead> OwnHeadAsync(Biz biz, long id)
    {
        biz.RequireSignedIn();
        var head = await biz.Db.AiConversation.AsNoTracking().Where(c => c.Id == id && c.SubjectType == nameof(Design))
            .Select(c => new ConversationHead(c.Id, c.UserId, c.SubjectId, c.Status, c.Runs, c.Tokens)).FirstOrDefaultAsync();
        await CheckOwnAsync(biz, head?.UserId, head?.SubjectId);
        return head!;
    }

    public sealed record ConversationRow(long Id, string Title, string Status, int Runs, int Tokens, DateTime UpdateDate);

    /// <summary>The conversations of the person about this design, newest first (needs Edit: the panel is only there for people who may edit).</summary>
    public static async Task<List<ConversationRow>> ConversationsAsync(Biz biz, long designId)
    {
        await Access.RequireAsync(biz, ItemKind.Design, designId, AccessLevel.Edit);
        var me = biz.UserId;
        var rows = await biz.Db.AiConversation.AsNoTracking().Where(c => c.SubjectType == nameof(Design) && c.SubjectId == designId && c.UserId == me && c.Runs > 0).OrderByDescending(c => c.UpdateDate).ThenByDescending(c => c.Id).Take(MaxConversationsListed).ToListAsync();
        return [.. rows.Select(c => new ConversationRow(c.Id, c.Title, c.Status.ToString(), c.Runs, c.Tokens, c.UpdateDate))];
    }

    public sealed record RunInfo(long Id, int Number, string Status, string? Error, int Tokens, DateTime StartDate, DateTime? EndDate, bool Changed, bool Undone);

    /// <summary>Which run the undo button belongs to: the newest run of the design that changed something and is not undone. <paramref name="Run"/> is its number when it is a run of THIS conversation, else null with <paramref name="Other"/> set.</summary>
    public sealed record UndoInfo(int? Run, bool Other, long? RunId);

    public sealed record ConversationInfo(long Id, long DesignId, string Title, string Status, AiScope Scope, int Tokens, IReadOnlyList<RunInfo> Runs, UndoInfo? Undo);

    public static async Task<ConversationInfo> ConversationAsync(Biz biz, long id)
    {
        var conv = await OwnConversationAsync(biz, id, tracked: false);
        var runs = await biz.Db.AiRun.AsNoTracking().Where(r => r.ConversationId == id).OrderBy(r => r.Number).ToListAsync();
        var runIds = runs.Select(r => r.Id).ToList();
        var journal = await biz.Db.AiJournalEntry.AsNoTracking().Where(j => runIds.Contains(j.AiRunId) && j.EntityType == nameof(Design)).Select(j => new { j.AiRunId, j.RevertedDate }).ToListAsync();
        var info = runs.Select(r => new RunInfo(r.Id, r.Number, r.Status.ToString(), r.Error, r.TotalTokens, r.StartDate, r.EndDate, journal.Any(j => j.AiRunId == r.Id), journal.Any(j => j.AiRunId == r.Id && j.RevertedDate is not null))).ToList();
        return new ConversationInfo(conv.Id, conv.SubjectId, conv.Title, conv.Status.ToString(), AiScope.Parse(conv.ScopeJson), conv.Tokens, info, await UndoInfoAsync(biz, conv.Id, conv.SubjectId));
    }

    private static async Task<UndoInfo?> UndoInfoAsync(Biz biz, long conversationId, long designId)
    {
        // the poll of every open editor asks this once a second: ONE query, and only the three columns it needs (the journal entry holds whole documents)
        var db = biz.Db;
        var run = await (from j in db.AiJournalEntry.AsNoTracking()
                         join r in db.AiRun.AsNoTracking() on j.AiRunId equals r.Id
                         where j.EntityType == nameof(Design) && j.EntityId == designId && j.RevertedDate == null && r.Action == AiAction.DesignAgent
                         orderby j.Id descending
                         select new { r.Id, r.ConversationId, r.Number }).FirstOrDefaultAsync();
        return run is null ? null : run.ConversationId == conversationId ? new UndoInfo(run.Number, false, run.Id) : new UndoInfo(null, true, run.Id);
    }

    // ================================================================================================ sending

    /// <summary>What comes with a message: the words, where the AI may work, the conversation it continues (null = a new one), references and files.</summary>
    public sealed record SendInput(string? Text, AiScope? Scope, long? ConversationId, IReadOnlyList<IncomingRef>? Refs, IReadOnlyList<IncomingFile>? Files, bool AutoFormat = false, bool AutoName = false);

    public sealed record Sent(long ConversationId, long RunId, int RunNumber, IReadOnlyList<AttachedFile> Files);

    private static string Title(string text, string fallback)
    {
        var t = string.Join(' ', text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        if (t.Length == 0)
        {
            t = fallback;
        }

        return t.Length > 80 ? t[..77] + "…" : t;
    }

    /// <summary>
    /// Stores the message (and what came with it) and starts the run. Needs Edit on the design. Refused while a run of this conversation OR of this design is going (one run per design), and when a limit is
    /// reached (nothing is stored then). The files are taken in (<see cref="AiAttachmentLogic"/>), the message goes into the history, a <c>User</c> step is written, the conversation is "Running" and the runner starts.
    /// </summary>
    public static async Task<Sent> SendAsync(Biz biz, long designId, SendInput input)
    {
        await Access.RequireAsync(biz, ItemKind.Design, designId, AccessLevel.Edit);
        await PreflightAsync(biz);
        var settings = SettingLogic.Get<AiSettings>(biz, SettingStore.Ai);
        var text = (input.Text ?? "").Trim();
        if (text.Length > MaxMessageChars)
        {
            throw new BizException($"Die Nachricht ist zu lang (höchstens {MaxMessageChars:N0} Zeichen).".Replace(",", "."));
        }

        var files = input.Files ?? [];
        var refs = input.Refs ?? [];
        if (text.Length == 0 && files.Count == 0 && refs.Count == 0)
        {
            throw new BizException("Schreib, was die KI tun soll.");
        }

        var runner = biz.Service<AiAgentRunner>();
        var db = biz.Db;
        AiConversation conv;
        var created = false;
        if (input.ConversationId is { } cid)
        {
            conv = await db.AiConversation.FirstOrDefaultAsync(c => c.Id == cid && c.SubjectType == nameof(Design) && c.SubjectId == designId && c.UserId == biz.UserId) ?? throw new NotFoundException();
        }
        else
        {
            conv = new AiConversation { SubjectId = designId, UserId = biz.UserId, Title = Title(text, files.FirstOrDefault()?.Name ?? "Neue Unterhaltung") };
            db.AiConversation.Add(conv);
            await db.SaveChangesAsync();
            created = true;
        }

        try
        {
            await EnsureNotBusyAsync(biz, designId, runner);
            var scope = await CheckedScopeAsync(biz, designId, input.Scope ?? AiScope.Whole);
            var runNumber = conv.Runs + 1;
            var attached = files.Count == 0 && refs.Count == 0
                ? []
                : await AiAttachmentLogic.AcceptAsync(biz, conv.Id, runNumber, designId, files, [.. refs.Take(MaxRefs)], settings.AgentMaxFilesPerMessage);
            var usable = attached.Any(f => f.Refused is null);
            if (text.Length == 0 && !usable)
            {
                throw new BizException(attached.Count > 0 ? "Keine der Dateien ließ sich verwenden: " + string.Join(" ", attached.Where(f => f.Refused is not null).Select(f => $"{f.Name}: {f.Refused}").Take(3)) : "Schreib, was die KI tun soll.");
            }

            var modelText = AiAttachmentLogic.ModelText(text.Length > 0 ? text : "(Keine Nachricht, nur Anhänge: schau sie dir an und mach daraus, was naheliegt.)", attached);
            var history = AiAgentLoop.ReadHistory(conv.HistoryJson);
            history.Add(new HistoryMessage("user", modelText, false, runNumber));

            await using (var turn = await ItemLock.AcquireAsync(db, ItemKind.Design, designId))
            {
                // two messages at the same moment: the second sees the first as running
                await EnsureNotBusyAsync(biz, designId, runner);
                var address = biz.User.IpAddress;
                var limiter = biz.Service<AiRateLimiter>();
                var run = new AiRun
                {
                    Action = AiAction.DesignAgent,
                    Status = AiRunStatus.Running,
                    SubjectType = nameof(Design),
                    SubjectId = designId,
                    UserId = biz.UserId,
                    AddressHash = address is null ? null : limiter.Hash(address),
                    StartDate = biz.Now,
                    ConversationId = conv.Id,
                    Number = runNumber,
                    RequestJson = new JsonObject { ["conversationId"] = conv.Id, ["text"] = AiLogic.Limit(text, 2000) }.ToJsonString(),
                };
                run.Steps.Add(new AiRunStep
                {
                    Number = 1,
                    Kind = AiStepKind.User,
                    Text = text,
                    OccurredDate = biz.Now,
                    DataJson = AiDesignTools.Json(Merge(AiAttachmentLogic.Chips(attached), new JsonObject { ["scope"] = JsonNode.Parse(scope.ToJson()) })),
                });
                db.AiRun.Add(run);
                conv.Runs = runNumber;
                conv.Status = AiConversationStatus.Running;
                conv.ScopeJson = WithFlags(scope, input.AutoFormat && conv.Runs == 1, input.AutoName && conv.Runs == 1);
                conv.HistoryJson = AiAgentLoop.WriteHistory(history);
                if (conv.Title.Length == 0)
                {
                    conv.Title = Title(text, attached.FirstOrDefault()?.Name ?? "Neue Unterhaltung");
                }

                await db.SaveChangesAsync();
                await turn.CommitAsync();
                runner.Enqueue(conv.Id, address);
                await ItemLogic.VisitAsync(biz, ItemKind.Design, designId);
                return new Sent(conv.Id, run.Id, runNumber, attached);
            }
        }
        catch when (created)
        {
            // a conversation made for this message that did not get to start is not left behind (with what came with it)
            try
            {
                await db.AiAttachment.Where(a => a.ConversationId == conv.Id).ExecuteDeleteAsync();
                await db.AiConversation.Where(c => c.Id == conv.Id && c.Runs == 0).ExecuteDeleteAsync();
                AiAttachmentLogic.DeleteConversationFiles(AiAttachmentLogic.Root(biz), conv.Id);
            }
            catch (Exception)
            {
                // the start-up cleans up what is left; the reason of the failure is what the person needs to read
            }

            throw;
        }
    }

    private static string WithFlags(AiScope scope, bool autoFormat, bool autoName)
    {
        var o = (JsonObject)JsonNode.Parse(scope.ToJson())!;
        if (autoFormat)
        {
            o["autoFormat"] = true;
        }

        if (autoName)
        {
            o["autoName"] = true;
        }

        return o.ToJsonString();
    }

    /// <summary>A design that still carries the placeholder name of a new one ("Unbenannt – A4 Hochformat", "Unbenanntes Design").</summary>
    internal static bool IsPlaceholderName(string? name) => (name ?? "").TrimStart().StartsWith("Unbenannt", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// The name a design gets from the first message when the model did not name it: the title of the conversation (the words of the person, at most 80 characters) without the closing punctuation, cut
    /// at a word at about 60 characters. Null when nothing usable is left.
    /// </summary>
    internal static string? DesignNameFromTitle(string? title)
    {
        var t = string.Join(' ', (title ?? "").Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)).Trim();
        t = t.Trim('.', '!', '?', ',', ':', ';', '„', '“', '"', ' ', '…');
        if (t.Length > 60)
        {
            var cut = t.LastIndexOf(' ', 60);
            t = (cut >= 20 ? t[..cut] : t[..60]).TrimEnd('.', ',', ':', ';', ' ') + "…";
        }

        return t.Length < 3 || IsPlaceholderName(t) ? null : t;
    }

    /// <summary>
    /// A design made from a prompt must not stay "Unbenannt …": when the run changed it and the model did not name it, it is named after the first message (the title of the conversation). Never throws: a name is not
    /// worth a run's end.
    /// </summary>
    internal static async Task NameFromConversationAsync(Biz biz, long designId, string conversationTitle)
    {
        try
        {
            var current = await biz.Db.Design.AsNoTracking().Where(d => d.Id == designId).Select(d => d.Name).FirstOrDefaultAsync();
            if (!IsPlaceholderName(current) || DesignNameFromTitle(conversationTitle) is not { } name)
            {
                return;
            }

            await DesignLogic.RenameAsync(biz, designId, name);
        }
        catch (Exception ex) when (ex is not OutOfMemoryException)
        {
            // the name stays as it is
        }
    }

    private static JsonObject Merge(JsonObject a, JsonObject b)
    {
        foreach (var (key, value) in b)
        {
            a[key] = value?.DeepClone();
        }

        return a;
    }

    /// <summary>One run per design: a conversation of this design that is running (a stale one that no runner knows any more is ended first).</summary>
    private static async Task EnsureNotBusyAsync(Biz biz, long designId, AiAgentRunner runner)
    {
        var running = await biz.Db.AiConversation.AsNoTracking().Where(c => c.SubjectType == nameof(Design) && c.SubjectId == designId && c.Status == AiConversationStatus.Running).Select(c => new { c.Id, c.UpdateDate }).ToListAsync();
        foreach (var c in running)
        {
            if (!runner.IsRunning(c.Id) && biz.Now - c.UpdateDate > TimeSpan.FromMinutes(2))
            {
                await runner.RecoverAsync(biz.Now.AddSeconds(1));
                continue;
            }

            throw new BizException("Die KI arbeitet gerade an diesem Design. Warte, bis sie fertig ist, oder brich sie ab.");
        }
    }

    /// <summary>The scope as the design allows it: a page that is not there makes it the whole design, selected elements that are not there are dropped.</summary>
    private static async Task<AiScope> CheckedScopeAsync(Biz biz, long designId, AiScope scope)
    {
        var json = await biz.Db.Design.AsNoTracking().Where(d => d.Id == designId).Select(d => d.DocumentJson).FirstOrDefaultAsync() ?? throw new NotFoundException();
        var doc = AiDocOps.Parse(DocumentValidator.Current(json));
        var page = scope.PageId is { } p ? AiDocOps.FindPage(doc, p) : null;
        var ids = scope.ElementIds.Where(i => AiDocOps.Locate(doc, i) is not null).ToList();
        if (scope.Kind == "selection" && ids.Count > 0)
        {
            return new AiScope("selection", page is null ? AiDocOps.Id(AiDocOps.Locate(doc, ids[0])!.Page) : AiDocOps.Id(page), ids, scope.Locked);
        }

        if (scope.Kind == "page" && page is not null)
        {
            return new AiScope("page", AiDocOps.Id(page), [], scope.Locked);
        }

        // the whole design; the page the editor shows stays as a hint (never locked)
        return new AiScope("design", page is null ? null : AiDocOps.Id(page), [], false);
    }

    /// <summary>What "Mit KI entwerfen" gives: the prompt, a format ("custom" with a size, a key of the tiles, or none = the AI picks one), where the design goes, references and files.</summary>
    public sealed record NewDesignInput(string? Text, string? Preset, double? Width, double? Height, string? Unit, long? SpaceId, long? FolderId, IReadOnlyList<IncomingRef>? Refs, IReadOnlyList<IncomingFile>? Files);

    public sealed record Started(long DesignId, string Url, Sent Sent);

    /// <summary>Makes an empty design (in the area and folder asked for) and sends the first message of its first conversation: the editor then follows the run.</summary>
    public static async Task<Started> StartNewAsync(Biz biz, NewDesignInput input)
    {
        biz.RequireSignedIn();
        await PreflightAsync(biz);
        var text = (input.Text ?? "").Trim();
        if (text.Length == 0 && (input.Files?.Count ?? 0) == 0 && (input.Refs?.Count ?? 0) == 0)
        {
            throw new BizException("Schreib, was du gestalten möchtest.");
        }

        var preset = (input.Preset ?? "").Trim();
        var auto = preset.Length == 0 || preset.Equals("auto", StringComparison.OrdinalIgnoreCase);
        var design = await DesignLogic.CreateFromFormatAsync(biz, auto ? "a4-portrait" : preset, input.Width, input.Height, input.Unit, null, input.SpaceId, input.FolderId);
        try
        {
            var sent = await SendAsync(biz, design.Id, new SendInput(text, AiScope.Whole, null, input.Refs, input.Files, auto, true));
            return new Started(design.Id, $"/Designs/{design.Id}/Designer?ai={sent.ConversationId}", sent);
        }
        catch
        {
            await DesignLogic.DeleteAsync(biz, design.Id);
            throw;
        }
    }

    // ================================================================================================ the steps

    public sealed record StepRow(long Id, int Run, string Kind, string Text, DateTime At, JsonNode? Data);

    public sealed record RenderRequestInfo(long RunId, string Token, string PageId, int PageNumber, int Revision, int MaxWidth);

    public sealed record StepsPage(long DesignId, string Status, int Run, long? RunId, int Tokens, int? UndoRun, bool UndoOther, string? Partial, RenderRequestInfo? RenderRequest, IReadOnlyList<StepRow> Steps);

    /// <summary>
    /// What the editor polls: the steps after the last one it has (at most 400), whether the run still works, the words of the answer being written, a request for a picture of a page, and which run
    /// the undo button belongs to. Own conversations; an administrator reads any.
    /// </summary>
    public static async Task<StepsPage> StepsAsync(Biz biz, long conversationId, long after)
    {
        var conv = await OwnHeadAsync(biz, conversationId);
        var owner = conv.UserId == biz.UserId;
        var broker = biz.Service<AiRenderBroker>();
        if (owner)
        {
            broker.Touch(conv.Id);
        }

        var rows = await (from s in biz.Db.AiRunStep.AsNoTracking()
                          join r in biz.Db.AiRun.AsNoTracking() on s.AiRunId equals r.Id
                          where r.ConversationId == conversationId && s.Id > after && s.Kind != AiStepKind.Message
                          orderby s.Id
                          select new { s.Id, r.Number, s.Kind, s.Text, s.OccurredDate, s.DataJson }).Take(MaxStepsPerPoll).ToListAsync();
        var steps = rows.Select(s => new StepRow(s.Id, s.Number, s.Kind.ToString().ToLowerInvariant(), s.Text, s.OccurredDate, ParseData(s.DataJson))).ToList();
        var newest = await biz.Db.AiRun.AsNoTracking().Where(r => r.ConversationId == conversationId).OrderByDescending(r => r.Number).Select(r => new { r.Id, r.Number }).FirstOrDefaultAsync();
        var running = conv.Status == AiConversationStatus.Running;
        var partial = running && newest is not null ? biz.Service<AiPartialStore>().Get(newest.Id) : null;
        var request = owner && broker.PendingFor(conv.Id) is { } pending
            ? new RenderRequestInfo(pending.RunId, pending.Token, pending.PageId, pending.PageNumber, pending.Revision, 1024)
            : null;
        var undo = await UndoInfoAsync(biz, conv.Id, conv.SubjectId);
        return new StepsPage(conv.SubjectId, conv.Status.ToString(), conv.Runs, newest?.Id, conv.Tokens, undo?.Run, undo is { Other: true }, partial, request, steps);
    }

    private static JsonNode? ParseData(string json)
    {
        try
        {
            return JsonNode.Parse(json);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    // ================================================================================================ stop, undo, delete

    /// <summary>Stops the run of the conversation (the person, or an administrator). True when there was a run to stop.</summary>
    public static async Task<bool> CancelAsync(Biz biz, long conversationId)
    {
        var conv = await OwnConversationAsync(biz, conversationId, tracked: false);
        var runner = biz.Service<AiAgentRunner>();
        if (runner.Cancel(conv.Id))
        {
            return true;
        }

        if (conv.Status == AiConversationStatus.Running)
        {
            // no runner knows it any more (a lost run): it is ended here
            await AiAgentRunner.EndRunningAsync(biz.Db, conv.Id, "cancelled", "Abgebrochen.", biz.Now);
            return true;
        }

        return false;
    }

    public sealed record UndoResult(string Message, int Run, long RunId, int Revision);

    /// <summary>
    /// Takes back the newest run of the design that changed something and is not taken back yet (across the conversations of the design: runs of other people too, newest first): the OLD document becomes a
    /// new revision (one history entry "KI rückgängig"). Needs Edit. When somebody changed the design after that run, <see cref="AiChangedSinceException"/> asks first; <paramref name="force"/> goes ahead.
    /// </summary>
    public static async Task<UndoResult> UndoAsync(Biz biz, long conversationId, bool force)
    {
        var conv = await OwnConversationAsync(biz, conversationId);
        var designId = conv.SubjectId;
        await Access.RequireAsync(biz, ItemKind.Design, designId, AccessLevel.Edit);
        var runner = biz.Service<AiAgentRunner>();
        var working = await biz.Db.AiConversation.AsNoTracking().Where(c => c.SubjectType == nameof(Design) && c.SubjectId == designId && c.Status == AiConversationStatus.Running).Select(c => c.Id).ToListAsync();
        if (working.Any(runner.IsRunning))
        {
            throw new BizException("Erst abwarten oder abbrechen: die KI arbeitet noch.");
        }

        var entry = await biz.Db.AiJournalEntry.Where(j => j.EntityType == nameof(Design) && j.EntityId == designId && j.RevertedDate == null && biz.Db.AiRun.Any(r => r.Id == j.AiRunId && r.Action == AiAction.DesignAgent)).OrderByDescending(j => j.Id).FirstOrDefaultAsync()
            ?? throw new BizException("Es gibt nichts rückgängig zu machen.");
        var run = await biz.Db.AiRun.AsNoTracking().FirstAsync(r => r.Id == entry.AiRunId);
        var now = await biz.Db.Design.AsNoTracking().Where(d => d.Id == designId).Select(d => new { d.Revision, d.DocumentJson }).FirstOrDefaultAsync() ?? throw new NotFoundException();
        var current = now.Revision;

        // the design already is what it was before the run (the editor's own Strg+Z saved it, or a second tab undid it): nothing to write, the entry is only marked, and no question about "changed since"
        var alreadyBack = !string.IsNullOrEmpty(entry.OldValue) && EqualDocuments(entry.OldValue, now.DocumentJson);

        // "changed since": the design is not what the run left (a person saved something different after it). Compared by the document, not by the number of the revision: an undo of a later run
        // also makes a revision, and a save of the editor that changes nothing is no change
        if (!alreadyBack && !force && !SameDocument(entry.NewValue, now.DocumentJson, run.ResultJson, current))
        {
            throw new AiChangedSinceException(current);
        }

        var revision = current;
        if (!alreadyBack)
        {
            revision = (await DesignLogic.SaveDocumentAsync(biz, designId, current, entry.OldValue, false, "KI rückgängig")).Revision;
        }

        entry.RevertedDate = biz.Now;
        await biz.Db.SaveChangesAsync();
        await biz.Log.LogAsync("KI-Änderungen am Design rückgängig gemacht", nameof(Design), designId, $"Lauf {run.Number}");

        // the conversation of the run (and this one) is told, so the model does not build on what is gone
        var line = $"Die Änderungen von Lauf {run.Number} wurden rückgängig gemacht. Lies das Design neu (read_design), bevor du weiterarbeitest.";
        var targets = new HashSet<long> { conv.Id };
        if (run.ConversationId is { } other)
        {
            targets.Add(other);
        }

        foreach (var id in targets)
        {
            var target = await biz.Db.AiConversation.FirstOrDefaultAsync(c => c.Id == id);
            var newest = target is null ? null : await biz.Db.AiRun.Where(r => r.ConversationId == id).OrderByDescending(r => r.Number).FirstOrDefaultAsync();
            if (target is null || newest is null)
            {
                continue;
            }

            var history = AiAgentLoop.ReadHistory(target.HistoryJson);
            history.Add(new HistoryMessage("user", line, false, newest.Number));
            target.HistoryJson = AiAgentLoop.WriteHistory(history);
            var number = await biz.Db.AiRunStep.Where(s => s.AiRunId == newest.Id).Select(s => (int?)s.Number).MaxAsync() ?? 0;
            biz.Db.AiRunStep.Add(new AiRunStep
            {
                AiRunId = newest.Id,
                Number = number + 1,
                Kind = AiStepKind.Info,
                Text = $"Lauf {run.Number} rückgängig gemacht.",
                OccurredDate = biz.Now,
                DataJson = new JsonObject { ["undo"] = run.Number, ["runId"] = run.Id }.ToJsonString(),
            });
        }

        await biz.Db.SaveChangesAsync();
        return new UndoResult(alreadyBack ? $"Das Design sieht schon wieder so aus wie vor Lauf {run.Number}." : $"Die Änderungen von Lauf {run.Number} sind rückgängig gemacht.", run.Number, run.Id, revision);
    }

    private static bool EqualDocuments(string left, string right) => (DocumentValidator.Validate(left).Json ?? left) == (DocumentValidator.Validate(right).Json ?? right);

    private static bool SameDocument(string? left, string right, string resultJson, int currentRevision)
    {
        if (string.IsNullOrEmpty(left))
        {
            // an old entry without its end state: the revision the run left decides
            return RevisionAfter(resultJson) is not { } expected || expected == currentRevision;
        }

        return EqualDocuments(left, right);
    }

    private static int? RevisionAfter(string resultJson)
    {
        try
        {
            return JsonNode.Parse(resultJson) is JsonObject o && o["revisionAfter"] is JsonValue v && v.TryGetValue<int>(out var revision) ? revision : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>Deletes a conversation (softly): a running run is stopped, its files are removed. Own conversations; an administrator may delete any.</summary>
    public static async Task DeleteAsync(Biz biz, long conversationId)
    {
        var conv = await OwnConversationAsync(biz, conversationId);
        biz.Service<AiAgentRunner>().Cancel(conv.Id);
        biz.Db.AiConversation.Remove(conv);
        await biz.Db.SaveChangesAsync();
        AiAttachmentLogic.DeleteConversationFiles(AiAttachmentLogic.Root(biz), conv.Id);
        await biz.Db.AiAttachment.Where(a => a.ConversationId == conv.Id).ExecuteDeleteAsync();
        await biz.Log.LogAsync("KI-Unterhaltung gelöscht", nameof(AiConversation), conv.Id, conv.Title);
    }

    // ================================================================================================ the whole instruction, pictures

    /// <summary>"Vollständige Anweisung anzeigen": exactly what the model would get (the system text with the situation), without calling it.</summary>
    public static async Task<string> PromptAsync(Biz biz, long designId, AiScope? scope)
    {
        await Access.RequireAsync(biz, ItemKind.Design, designId, AccessLevel.Edit);
        var design = await LoadDesignAsync(biz, designId);
        var (system, situation) = await ComposeAsync(biz, design, await CheckedScopeAsync(biz, designId, scope ?? AiScope.Whole), null, false);
        return $"[system]\n{system}\n\n## Die Lage\n{situation}";
    }

    /// <summary>The picture the editor drew for <c>look</c>: only the person of the run, only while a request waits, only with its token; a JPEG or PNG of at most 3 MB. False when nothing waits for it.</summary>
    public static async Task<bool> RenderUploadAsync(Biz biz, long runId, string token, byte[] bytes)
    {
        biz.RequireSignedIn();
        var run = await biz.Db.AiRun.AsNoTracking().Where(r => r.Id == runId && r.Action == AiAction.DesignAgent).Select(r => new { r.UserId }).FirstOrDefaultAsync();
        if (run is null || run.UserId != biz.UserId)
        {
            throw new NotFoundException();
        }

        if (bytes.Length == 0 || bytes.Length > AiAttachmentLogic.MaxModelImageBytes || FileSniffer.Sniff(bytes).Kind is not (FileKind.Jpeg or FileKind.Png))
        {
            throw new BizException("Das Bild muss ein JPEG oder PNG von höchstens 3 MB sein.");
        }

        return biz.Service<AiRenderBroker>().TryComplete(runId, token ?? "", biz.UserId, bytes);
    }

    /// <summary>The editor cannot draw the page: the tool is told at once instead of waiting.</summary>
    public static async Task<bool> RenderFailedAsync(Biz biz, long runId, string token)
    {
        biz.RequireSignedIn();
        var run = await biz.Db.AiRun.AsNoTracking().Where(r => r.Id == runId && r.Action == AiAction.DesignAgent).Select(r => new { r.UserId }).FirstOrDefaultAsync();
        if (run is null || run.UserId != biz.UserId)
        {
            throw new NotFoundException();
        }

        return biz.Service<AiRenderBroker>().TryFail(runId, token ?? "", biz.UserId);
    }

    [GeneratedRegex(@"^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\z")]
    private static partial Regex FileNamePattern();

    /// <summary>A picture of a conversation (what <c>look</c> drew, the copy of an attachment): by its file name, for the person of the conversation or an administrator. Null when there is none.</summary>
    public static async Task<(byte[] Bytes, string ContentType)?> PictureAsync(Biz biz, long conversationId, string name)
    {
        var conv = await OwnConversationAsync(biz, conversationId, tracked: false);
        if (string.IsNullOrEmpty(name) || !FileNamePattern().IsMatch(name))
        {
            return null;
        }

        var root = Path.GetFullPath(AiAttachmentLogic.Root(biz));
        var path = Path.GetFullPath(Path.Combine(root, conv.Id.ToString(CultureInfo.InvariantCulture), name));
        if (!path.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.Ordinal) || !File.Exists(path))
        {
            return null;
        }

        var type = Path.GetExtension(name).ToLowerInvariant() switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".webp" => "image/webp",
            ".gif" => "image/gif",
            _ => null,
        };
        return type is null ? null : (await File.ReadAllBytesAsync(path), type);
    }

    // ================================================================================================ the instruction of a call

    internal sealed record AgentDesign(long Id, string Name, int Revision, string DocumentJson, long? SpaceId, long? FolderId);

    internal static async Task<AgentDesign> LoadDesignAsync(Biz biz, long designId)
    {
        var d = await biz.Db.Design.AsNoTracking().Where(x => x.Id == designId).Select(x => new { x.Id, x.Name, x.Revision, x.DocumentJson, x.SpaceId, x.FolderId }).FirstOrDefaultAsync() ?? throw new NotFoundException();
        return new AgentDesign(d.Id, d.Name, d.Revision, DocumentValidator.Current(d.DocumentJson), d.SpaceId, d.FolderId);
    }

    /// <summary>The text of one call: the layers of the instruction (operator, site, addition of the site for this action, the fixed part) and the situation.</summary>
    internal static async Task<(string System, string Situation)> ComposeAsync(Biz biz, AgentDesign design, AiScope scope, long? conversationId, bool autoFormat)
    {
        var situation = await SituationAsync(biz, design, scope, conversationId, autoFormat);
        var (system, _) = AiLogic.Compose(biz.Services, new AiLogic.Call(AiAction.DesignAgent, situation, null, nameof(Design), design.Id, biz.User.UserId, null));
        return (system, situation);
    }

    /// <summary>Where the work stands: the date, the design, its format, pages and fields, the scope, the selected elements, the brand of the area.</summary>
    private static async Task<string> SituationAsync(Biz biz, AgentDesign design, AiScope scope, long? conversationId, bool autoFormat)
    {
        var doc = AiDocOps.Parse(design.DocumentJson);
        var unit = AiDocOps.Unit(doc);
        var sb = new StringBuilder();
        sb.AppendLine($"Heute ist {Services.Fmt.Date(biz.Now)}.");
        sb.AppendLine($"Design: „{AiDesignTools.Clip(design.Name, 80)}“ (Revision {design.Revision}). Format: {Num(AiDocOps.Num(doc["width"]))} × {Num(AiDocOps.Num(doc["height"]))} {unit} bei {AiDocOps.Num(doc["dpi"]):0} dpi. Alle Längen sind in {unit}, Schriftgrößen in pt.");
        if (IsPlaceholderName(design.Name))
        {
            sb.AppendLine("Das Design heißt noch wie ein neues („Unbenannt …“). Gestaltest du es im Wesentlichen neu (ein neues Plakat, eine neue Karte), gib ihm gleich mit rename_design einen kurzen, passenden Namen (höchstens 60 Zeichen, ohne „Unbenannt“), zum Beispiel in deinem ersten Schritt.");
        }

        if (autoFormat)
        {
            sb.AppendLine("Die Person hat kein Format gewählt: das Design ist leer und steht auf A4 hoch. Wähle als Erstes mit resize_design (preset aus list_formats, oder Maße) ein Format, das zum Auftrag passt, und gestalte dann.");
        }

        var pages = AiDocOps.Pages(doc).OfType<JsonObject>().ToList();
        sb.AppendLine($"Seiten ({pages.Count}):");
        for (var i = 0; i < pages.Count; i++)
        {
            var name = AiDocOps.Str(pages[i]["name"]);
            sb.AppendLine($"- Seite {i + 1}: id {AiDocOps.Id(pages[i])}{(name.Length > 0 ? $", „{AiDesignTools.Clip(name, 40)}“" : "")}, {AiDocOps.CountNodes(AiDocOps.Elements(pages[i]))} Elemente");
        }

        var fields = AiDocOps.Fields(doc).OfType<JsonObject>().Take(40).ToList();
        sb.AppendLine(fields.Count == 0
            ? "Felder: keine."
            : "Felder (Platzhalter {{Schlüssel}}): " + string.Join("; ", fields.Select(f => $"{AiDocOps.Str(f["key"])} ({AiDocOps.Str(f["type"])}, Beispiel „{AiDesignTools.Clip(AiDocOps.Str(f["sample"]), 30)}“)")));

        sb.AppendLine(ScopeLine(doc, scope));
        if (scope.IsSelection)
        {
            var lines = scope.ElementIds.Select(id => AiDocOps.Locate(doc, id)).OfType<Located>().Take(30)
                .Select(l => $"{AiDocOps.Id(l.Element)} ({AiDesignTools.ElementKind(AiDocOps.Type(l.Element))} {AiDesignTools.ElementName(l.Element)}, Seite {AiDocOps.PageNumber(doc, l.Page)})");
            sb.AppendLine("Ausgewählte Elemente: " + string.Join("; ", lines) + ". „Das“, „dieses Element“ und „die Auswahl“ meinen sie.");
        }

        try
        {
            var kit = (await BrandAsync(biz, design.SpaceId)).Kit;
            var brand = new List<string>();
            if (kit.Colors.Count > 0)
            {
                brand.Add("Farben " + string.Join(", ", kit.Colors.Take(12)));
            }

            if (kit.Fonts.Heading is not null || kit.Fonts.Subheading is not null || kit.Fonts.Body is not null)
            {
                brand.Add($"Schriften: Überschrift {kit.Fonts.Heading ?? "–"}, Zwischenüberschrift {kit.Fonts.Subheading ?? "–"}, Fließtext {kit.Fonts.Body ?? "–"}");
            }

            if (kit.Logos.Count > 0)
            {
                brand.Add("Logos (Bildschlüssel) " + string.Join(", ", kit.Logos.Take(8)));
            }

            sb.AppendLine(brand.Count == 0 ? "Marke des Bereichs: leer." : "Marke des Bereichs: " + string.Join("; ", brand) + ".");
        }
        catch (Exception ex) when (ex is NotFoundException or ForbiddenException)
        {
            sb.AppendLine("Marke des Bereichs: nicht lesbar.");
        }

        if (conversationId is { } cid)
        {
            var attached = await biz.Db.AiAttachment.AsNoTracking().Where(a => a.ConversationId == cid && a.AssetKey != null && a.Refused == null).Select(a => new { a.AssetKey, a.Name }).Take(20).ToListAsync();
            if (attached.Count > 0)
            {
                sb.AppendLine("Bilder, die die Person in dieser Unterhaltung angehängt hat (Bildschlüssel): " + string.Join(", ", attached.Select(a => $"{a.AssetKey} ({AiDesignTools.Clip(a.Name, 30)})")) + ".");
            }
        }

        return sb.ToString().TrimEnd();
    }

    private static async Task<(BrandKit Kit, IReadOnlyList<AssetRow> Logos)> BrandAsync(Biz biz, long? spaceId)
    {
        try
        {
            var view = await BrandLogic.GetAsync(biz, spaceId);
            return (view.Kit, view.LogoAssets);
        }
        catch (NotFoundException) when (spaceId is not null)
        {
            var view = await BrandLogic.GetAsync(biz);
            return (view.Kit, view.LogoAssets);
        }
    }

    private static string Num(double value) => value.ToString("0.##", CultureInfo.InvariantCulture);

    private static string ScopeLine(JsonObject doc, AiScope scope)
    {
        var page = scope.PageId is { } p ? AiDocOps.FindPage(doc, p) : null;
        var where = scope.IsSelection
            ? "die ausgewählten Elemente"
            : scope.IsPage && page is not null ? $"Seite {AiDocOps.PageNumber(doc, page)} (id {AiDocOps.Id(page)})" : "das ganze Design";
        if (scope.Locked)
        {
            return $"Bereich: {where}. Die Person hat „Nur hier ändern“ eingeschaltet: du darfst NUR dort schreiben (Elemente ändern, löschen, anordnen; auf der Seite neue hinzufügen), alles andere schlägt fehl. Lesen darfst du alles.";
        }

        return scope.IsSelection || (scope.IsPage && page is not null)
            ? $"Bereich: {where}: dort arbeitet die Person gerade und meint es mit „hier“ und „diese Seite“; du darfst auch anderswo ändern, wenn der Auftrag es verlangt."
            : page is not null ? $"Bereich: das ganze Design. Der Editor zeigt gerade Seite {AiDocOps.PageNumber(doc, page)} (id {AiDocOps.Id(page)}); „diese Seite“ meint sie." : "Bereich: das ganze Design.";
    }
}
