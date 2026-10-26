using System.Text.Json;
using DesignThix.Data.Entities;
using DesignThix.Services;
using DesignThix.Services.Mail;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Logic;

/// <summary>The kinds of notification (the <c>Kind</c> column). The text is built from <c>DataJson</c> when it is shown, never stored.</summary>
public static class NotificationKinds
{
    public const string Share = "share";
    public const string AccessRequest = "access-request";
    public const string AccessGranted = "access-granted";
    public const string AccessDeclined = "access-declined";
    public const string InviteAccepted = "invite-accepted";
    public const string TeamAdded = "team-added";
    public const string TeamRole = "team-role";
    public const string TeamRemoved = "team-removed";

    /// <summary>The content of a deleted account was handed to this person or team (the administrator chose the target).</summary>
    public const string ContentTransferred = "content-transferred";

    /// <summary>To the administrators: somebody registered and waits for approval.</summary>
    public const string RegistrationPending = "registration-pending";

    /// <summary>Somebody wrote <c>@Name</c> in a comment (written by the comments of phase P5).</summary>
    public const string Mention = "mention";

    /// <summary>Somebody answered a comment of the person (P5).</summary>
    public const string CommentReply = "comment-reply";
}

/// <summary>The profile setting "E-Mail bei ...": which groups of notifications also arrive by mail (when the administrator set up the mail server). Kept as JSON in <see cref="User.NotifyMailJson"/>.</summary>
public sealed class NotifyMailSettings
{
    public bool Shares { get; set; } = true;

    public bool Requests { get; set; } = true;

    public bool Mentions { get; set; } = true;

    public bool Invitations { get; set; } = true;

    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    public static NotifyMailSettings Parse(string? json)
    {
        try
        {
            return string.IsNullOrWhiteSpace(json) ? new NotifyMailSettings() : JsonSerializer.Deserialize<NotifyMailSettings>(json, Web) ?? new NotifyMailSettings();
        }
        catch (JsonException)
        {
            return new NotifyMailSettings();
        }
    }

    public string ToJson() => JsonSerializer.Serialize(this, Web);

    /// <summary>The group a kind of notification belongs to, or null when that kind never goes out by mail.</summary>
    public static string? GroupOf(string kind) => kind switch
    {
        NotificationKinds.Share or NotificationKinds.AccessGranted => "shares",
        NotificationKinds.AccessRequest => "requests",
        NotificationKinds.Mention or NotificationKinds.CommentReply => "mentions",
        NotificationKinds.InviteAccepted or NotificationKinds.TeamAdded => "invitations",
        _ => null,
    };

    /// <summary>Whether the person wants a mail for this kind (false for kinds that are never mailed).</summary>
    public bool Wants(string kind) => GroupOf(kind) switch
    {
        "shares" => Shares,
        "requests" => Requests,
        "mentions" => Mentions,
        "invitations" => Invitations,
        _ => false,
    };
}

/// <summary>A notification as the bell and the page show it. <see cref="Text"/> is German plain text (the script writes it with textContent).</summary>
public sealed record NotificationView(long Id, string Kind, string Text, string? Message, string Icon, string? Url, DateTime Created, bool IsRead, long? RequestId, string? RequestState);

public sealed record NotificationPage(IReadOnlyList<NotificationView> Items, int Total, int Unread);

/// <summary>
/// Notifications (docs/PLAN-PLATFORM.md section 1.17): rows of <see cref="Notification"/> that other logic writes with <see cref="NotifyAsync"/> (a share, an access request, a team change ...) and
/// the person reads, marks as read and opens. The newest 500 per person are kept. What a notification says is built from <c>DataJson</c> (ids and names, never HTML) each time it is shown.
/// A person sees only their own. Where the person set it, a mail follows (<see cref="MailQueue"/>).
/// </summary>
public static class NotificationLogic
{
    public const int KeepPerPerson = 500;

    /// <summary>
    /// The brake against being pinged to death: one person writes at most this many notifications of ONE kind to ONE person within <see cref="ThrottleMinutes"/> minutes. Every further one is merged into the newest
    /// of those (its <c>repeats</c> count goes up, "und N weitere" is shown) and is neither a new unread row nor a mail.
    /// </summary>
    public const int PerActorPerWindow = 10;

    public const int ThrottleMinutes = 10;

    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    /// <summary>An address a notification may lead to: one of this app (starts with a single slash; not <c>//host</c>, not <c>/\host</c>, no control characters). Everything else is dropped.</summary>
    public static string? SafeUrl(string? url)
        => !string.IsNullOrEmpty(url) && url[0] == '/' && (url.Length == 1 || (url[1] != '/' && url[1] != '\\')) && !url.Any(char.IsControl) ? url : null;

    // ------------------------------------------------------------------------------------------------ writing (called by the logic that did the thing)

    /// <summary>
    /// Writes a notification for each of the people (never for the person who acts), trims the old ones and queues the mail. <paramref name="data"/> is serialized to <c>DataJson</c>. This is an internal
    /// helper: the caller has already checked that the action was allowed. A failure here never breaks the action (the notification is a courtesy).
    /// </summary>
    internal static async Task NotifyAsync(Biz biz, IEnumerable<long> userIds, string kind, object data, string? url)
    {
        try
        {
            var actor = biz.User.UserId;
            var receivers = userIds.Where(id => id != actor).Distinct().ToList();
            if (receivers.Count == 0)
            {
                return;
            }

            var db = biz.Db;
            // only people who can still sign in
            var active = await db.User.AsNoTracking().Where(u => receivers.Contains(u.Id) && u.IsActive && u.ApprovalState == ApprovalState.Approved).Select(u => u.Id).ToListAsync();
            var json = JsonSerializer.Serialize(data, Web);
            // somebody who is told too often by the same person gets the rest merged into the newest notice (no new row, no mail)
            var told = new List<long>();
            foreach (var id in active)
            {
                if (actor is { } by && await MergeIfTooManyAsync(db, id, by, kind, biz.Now))
                {
                    continue;
                }

                told.Add(id);
            }

            var rows = told.Select(id => new Notification { UserId = id, Kind = kind, DataJson = json, Url = SafeUrl(url) }).ToList();
            db.Notification.AddRange(rows);
            await db.SaveChangesAsync();
            foreach (var id in told)
            {
                await TrimAsync(db, id);
            }

            if (NotifyMailSettings.GroupOf(kind) is not null)
            {
                var queue = biz.Service<MailQueue>();
                foreach (var row in rows)
                {
                    queue.NotificationWritten(row.Id);
                }
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            biz.Service<ILoggerFactory>().CreateLogger("Notifications").LogWarning(ex, "A notification of kind {Kind} could not be written.", kind);
        }
    }

    /// <summary>
    /// When <paramref name="actor"/> has already written <see cref="PerActorPerWindow"/> notifications of this kind to this person within the window, counts this one in the newest of them and returns true
    /// (the caller writes nothing). The author of a row is its <c>CreateUserId</c>, which the context fills with the person who acts.
    /// </summary>
    private static async Task<bool> MergeIfTooManyAsync(Data.DtDbContext db, long recipient, long actor, string kind, DateTime now)
    {
        var since = now.AddMinutes(-ThrottleMinutes);
        var recent = db.Notification.Where(n => n.UserId == recipient && n.CreateUserId == actor && n.Kind == kind && n.CreateDate > since);
        if (await recent.CountAsync() < PerActorPerWindow)
        {
            return false;
        }

        var newest = await recent.OrderByDescending(n => n.Id).FirstAsync();
        var data = System.Text.Json.Nodes.JsonNode.Parse(newest.DataJson) as System.Text.Json.Nodes.JsonObject ?? new System.Text.Json.Nodes.JsonObject();
        var repeats = data["repeats"] is { } r && r.GetValueKind() == JsonValueKind.Number ? r.GetValue<int>() : 0;
        data["repeats"] = Math.Min(repeats + 1, 9999);
        newest.DataJson = data.ToJsonString(Web);
        // one row stays the notice of "more": a person who read it is told again that there is more, but is never given more rows than that
        newest.ReadDate = null;
        await db.SaveChangesAsync();
        return true;
    }

    private static async Task TrimAsync(Data.DtDbContext db, long userId)
    {
        var count = await db.Notification.CountAsync(n => n.UserId == userId);
        if (count <= KeepPerPerson + 20)
        {
            return;
        }

        var cutoff = await db.Notification.Where(n => n.UserId == userId).OrderByDescending(n => n.Id).Skip(KeepPerPerson).Select(n => (long?)n.Id).FirstOrDefaultAsync();
        if (cutoff is { } id)
        {
            await db.Notification.Where(n => n.UserId == userId && n.Id <= id).ExecuteDeleteAsync();
        }
    }

    /// <summary>The display name of the person who acts, for the text of a notification.</summary>
    internal static async Task<string> ActorNameAsync(Biz biz)
    {
        var uid = biz.User.UserId;
        return uid is null ? "Jemand" : await biz.Db.User.AsNoTracking().Where(u => u.Id == uid).Select(u => u.DisplayName).FirstOrDefaultAsync() ?? "Jemand";
    }

    /// <summary>The address that opens an item: the editor of a design, the page of a list or job, the folder.</summary>
    public static string ItemUrl(ItemKind kind, long id) => kind switch
    {
        ItemKind.Design => $"/Designs/{id}/Designer",
        ItemKind.DataList => $"/DataLists/Edit/{id}",
        ItemKind.OutputJob => $"/Outputs/Edit/{id}",
        ItemKind.Asset => $"/Assets/Edit/{id}",
        _ => $"/Freigegeben/Ordner/{id}",
    };

    /// <summary>The address that opens a design in the editor with the thread of a comment open (mentions and replies lead here).</summary>
    public static string CommentUrl(long designId, long commentId) => $"/Designs/{designId}/Designer?comment={commentId}";

    /// <summary>The name of an item for a text ("Sommerfest Plakat"); a quiet fallback when it is gone.</summary>
    internal static async Task<string> ItemNameAsync(Data.DtDbContext db, ItemKind kind, long id)
    {
        var name = kind switch
        {
            ItemKind.Design => await db.Design.AsNoTracking().Where(x => x.Id == id).Select(x => x.Name).FirstOrDefaultAsync(),
            ItemKind.DataList => await db.DataList.AsNoTracking().Where(x => x.Id == id).Select(x => x.Name).FirstOrDefaultAsync(),
            ItemKind.OutputJob => await db.OutputJob.AsNoTracking().Where(x => x.Id == id).Select(x => x.Name).FirstOrDefaultAsync(),
            ItemKind.Asset => await db.Asset.AsNoTracking().Where(x => x.Id == id).Select(x => x.Name).FirstOrDefaultAsync(),
            _ => await db.Folder.AsNoTracking().Where(x => x.Id == id).Select(x => x.Name).FirstOrDefaultAsync(),
        };
        return name ?? "ein Element";
    }

    /// <summary>The people of a team except the ones named (the receivers of a share with the team).</summary>
    internal static async Task<List<long>> TeamMemberIdsAsync(Data.DtDbContext db, long spaceId)
        => await db.SpaceMember.AsNoTracking().Where(m => m.SpaceId == spaceId).Select(m => m.UserId).ToListAsync();

    /// <summary>The people who manage an item (the ones an access request goes to): members of its area with Manage rights, and the people it was shared with who may change it ... only Manage counts.</summary>
    internal static async Task<List<long>> ManagersOfAsync(Data.DtDbContext db, ItemKind kind, long id)
    {
        var (spaceId, _) = await Access.RawPlaceAsync(db, kind, id);
        if (spaceId is not { } space)
        {
            return await db.User.AsNoTracking().Where(u => u.Role == UserRole.Admin && u.IsActive).Select(u => u.Id).ToListAsync();
        }

        var members = await db.SpaceMember.AsNoTracking().Where(m => m.SpaceId == space && m.Role != SpaceRole.Viewer).Select(m => m.UserId).ToListAsync();
        return members;
    }

    // ------------------------------------------------------------------------------------------------ reading (own notifications only)

    private sealed record Row(long Id, string Kind, string DataJson, string? Url, DateTime CreateDate, DateTime? ReadDate);

    /// <summary>The newest notifications of the person (<paramref name="unreadOnly"/>: only the unread ones), paged, with the count of the unread ones.</summary>
    public static async Task<NotificationPage> ListAsync(Biz biz, int skip = 0, int take = 20, bool unreadOnly = false)
    {
        biz.RequireSignedIn();
        var uid = biz.UserId;
        var query = biz.Db.Notification.AsNoTracking().Where(n => n.UserId == uid);
        var unread = await query.CountAsync(n => n.ReadDate == null);
        if (unreadOnly)
        {
            query = query.Where(n => n.ReadDate == null);
        }

        var total = await query.CountAsync();
        var rows = await query.OrderByDescending(n => n.CreateDate).ThenByDescending(n => n.Id).Skip(Math.Max(0, skip)).Take(Math.Clamp(take, 1, 100))
            .Select(n => new Row(n.Id, n.Kind, n.DataJson, n.Url, n.CreateDate, n.ReadDate)).ToListAsync();
        var requestIds = rows.Where(r => r.Kind == NotificationKinds.AccessRequest).Select(r => Data(r.DataJson).Long("requestId")).OfType<long>().ToList();
        // an access request is only offered for a decision while the person can decide it (they manage the item); the state tells the script which buttons to show
        var states = requestIds.Count == 0 ? [] : await biz.Db.AccessRequest.AsNoTracking().Where(r => requestIds.Contains(r.Id)).ToDictionaryAsync(r => r.Id, r => r.State);
        var items = new List<NotificationView>();
        foreach (var r in rows)
        {
            var data = Data(r.DataJson);
            long? requestId = r.Kind == NotificationKinds.AccessRequest ? data.Long("requestId") : null;
            string? state = requestId is { } rid && states.TryGetValue(rid, out var s) ? s.ToString().ToLowerInvariant() : null;
            var (text, message, icon) = Describe(r.Kind, data);
            items.Add(new NotificationView(r.Id, r.Kind, text, message, icon, SafeUrl(r.Url), r.CreateDate, r.ReadDate is not null, requestId, state));
        }

        return new NotificationPage(items, total, unread);
    }

    /// <summary>Marks one of the person's notifications as read and returns the address it opens (null for somebody else's id or a notification without one).</summary>
    public static async Task<string?> OpenAsync(Biz biz, long id)
    {
        biz.RequireSignedIn();
        var uid = biz.UserId;
        var url = await biz.Db.Notification.AsNoTracking().Where(n => n.Id == id && n.UserId == uid).Select(n => n.Url).FirstOrDefaultAsync();
        await ReadAsync(biz, id);
        return SafeUrl(url);
    }

    public static async Task<int> UnreadCountAsync(Biz biz)
    {
        biz.RequireSignedIn();
        var uid = biz.UserId;
        return await biz.Db.Notification.CountAsync(n => n.UserId == uid && n.ReadDate == null);
    }

    /// <summary>Marks one of the person's notifications as read (another person's id changes nothing and says nothing).</summary>
    public static async Task ReadAsync(Biz biz, long id)
    {
        biz.RequireSignedIn();
        var uid = biz.UserId;
        var now = biz.Now;
        await biz.Db.Notification.Where(n => n.Id == id && n.UserId == uid && n.ReadDate == null).ExecuteUpdateAsync(s => s.SetProperty(n => n.ReadDate, now));
    }

    /// <summary>Marks all notifications of the person as read; returns how many changed.</summary>
    public static async Task<int> ReadAllAsync(Biz biz)
    {
        biz.RequireSignedIn();
        var uid = biz.UserId;
        var now = biz.Now;
        return await biz.Db.Notification.Where(n => n.UserId == uid && n.ReadDate == null).ExecuteUpdateAsync(s => s.SetProperty(n => n.ReadDate, now));
    }

    // ------------------------------------------------------------------------------------------------ the profile setting

    public static async Task<NotifyMailSettings> MailSettingsAsync(Biz biz)
    {
        biz.RequireSignedIn();
        var uid = biz.UserId;
        return NotifyMailSettings.Parse(await biz.Db.User.AsNoTracking().Where(u => u.Id == uid).Select(u => u.NotifyMailJson).FirstOrDefaultAsync());
    }

    public static async Task SaveMailSettingsAsync(Biz biz, NotifyMailSettings settings)
    {
        biz.RequireSignedIn();
        var json = settings.ToJson();
        var uid = biz.UserId;
        await biz.Db.User.Where(u => u.Id == uid).ExecuteUpdateAsync(s => s.SetProperty(u => u.NotifyMailJson, json));
    }

    // ------------------------------------------------------------------------------------------------ the words

    /// <summary>The fields of a notification's <c>DataJson</c> with safe reading.</summary>
    public readonly struct Fields(JsonElement root)
    {
        public string Str(string name, string fallback = "")
            => root.ValueKind == JsonValueKind.Object && root.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? fallback : fallback;

        public long? Long(string name)
            => root.ValueKind == JsonValueKind.Object && root.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt64(out var n) ? n : null;
    }

    private static Fields Data(string json)
    {
        try
        {
            return new Fields(JsonDocument.Parse(json).RootElement.Clone());
        }
        catch (JsonException)
        {
            return new Fields(default);
        }
    }

    private static string PermissionWords(string permission) => permission.Equals("Edit", StringComparison.OrdinalIgnoreCase) ? "bearbeiten" : "ansehen";

    private static string Quote(string name) => $"„{name}“";

    /// <summary>The German sentence of a notification, the optional message of the person who wrote it, and the icon.</summary>
    public static (string Text, string? Message, string Icon) Describe(string kind, string dataJson) => Describe(kind, Data(dataJson));

    private static (string Text, string? Message, string Icon) Describe(string kind, Fields d)
    {
        var by = d.Str("by", "Jemand");
        var item = Quote(d.Str("itemName", "ein Element"));
        var team = Quote(d.Str("teamName", "ein Team"));
        var message = d.Str("message");
        var note = message.Length == 0 ? null : message;
        var more = d.Long("repeats") is { } repeats and > 0 ? $" (und {Services.Fmt.Integer(repeats)} weitere)" : "";
        var (sentence, noteOut, icon) = Sentence(kind, d, by, item, team, note);
        return (more.Length == 0 ? sentence : sentence.TrimEnd('.') + more + ".", noteOut, icon);
    }

    private static (string Text, string? Message, string Icon) Sentence(string kind, Fields d, string by, string item, string team, string? note)
    {
        return kind switch
        {
            NotificationKinds.Share => (d.Str("viaTeam").Length > 0
                ? $"{by} hat {item} mit dem Team {Quote(d.Str("viaTeam"))} geteilt (Kann {(d.Str("permission") == "Edit" ? "bearbeiten" : "ansehen")})."
                : $"{by} hat {item} mit dir geteilt (Kann {(d.Str("permission") == "Edit" ? "bearbeiten" : "ansehen")}).", note, "dt:share-2"),
            NotificationKinds.AccessRequest => ($"{by} möchte {item} {PermissionWords(d.Str("permission"))}.", note, "lock"),
            NotificationKinds.AccessGranted => ($"{by} hat dir Zugriff auf {item} gegeben (Kann {(d.Str("permission") == "Edit" ? "bearbeiten" : "ansehen")}).", null, "check"),
            NotificationKinds.AccessDeclined => ($"{by} hat deine Anfrage für {item} abgelehnt.", null, "x"),
            NotificationKinds.InviteAccepted => (d.Str("teamName").Length > 0 ? $"{by} hat deine Einladung ins Team {team} angenommen." : $"{by} hat deine Einladung zu DesignThix angenommen.", null, "dt:user-plus"),
            NotificationKinds.TeamAdded => ($"{by} hat dich zum Team {team} hinzugefügt (Rolle: {d.Str("role", "Mitglied")}).", null, "users"),
            NotificationKinds.TeamRole => ($"Deine Rolle im Team {team} ist jetzt {d.Str("role", "Mitglied")}.", null, "users"),
            NotificationKinds.TeamRemoved => ($"Du bist nicht mehr im Team {team}.", null, "users"),
            NotificationKinds.ContentTransferred => ($"Die Inhalte von {d.Str("from", "einer gelöschten Person")} wurden übernommen: Du findest sie im Ordner „Übernommen von {d.Str("from", "einer gelöschten Person")}“.", null, "folder"),
            NotificationKinds.RegistrationPending => ($"{by} hat sich registriert und wartet auf Freigabe.", null, "users"),
            NotificationKinds.Mention => ($"{by} hat dich in {item} erwähnt.", note, "dt:message-circle"),
            NotificationKinds.CommentReply => ($"{by} hat auf deinen Kommentar in {item} geantwortet.", note, "dt:message-circle"),
            _ => ("Es gibt etwas Neues.", null, "bell"),
        };
    }
}
