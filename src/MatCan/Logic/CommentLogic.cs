using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using MatCan.Core.Documents;
using MatCan.Data;
using MatCan.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace MatCan.Logic;

/// <summary>A person somebody may mention (<c>@Name</c>). The e-mail address is only given to people who manage the design.</summary>
public sealed record MentionCandidate(long Id, string Name, string Initials, string? Email);

/// <summary>The name of a mentioned person, for the highlight in the text.</summary>
public sealed record MentionedPerson(long Id, string Name);

/// <summary>
/// One comment or reply as the panel shows it. <see cref="AuthorName"/> is "Gelöschter Benutzer" when the account is gone. <see cref="PageId"/> / <see cref="ElementId"/> / <see cref="X"/> / <see cref="Y"/> are the pin
/// (document units); only a top-level comment has them. <see cref="CanEdit"/>: the author; <see cref="CanDelete"/>: the author or whoever manages the design; <see cref="CanResolve"/>: a top-level comment, for its
/// author or whoever may edit the design.
/// </summary>
public sealed record CommentRow(long Id, long? ParentId, long? AuthorId, string AuthorName, string AuthorInitials, bool Mine, string Text, IReadOnlyList<MentionedPerson> Mentions,
    string? PageId, string? ElementId, double? X, double? Y, DateTime Created, DateTime? Edited, DateTime? Resolved, long? ResolvedById, string? ResolvedByName,
    bool CanEdit, bool CanDelete, bool CanResolve);

/// <summary>A top-level comment with its replies (oldest first).</summary>
public sealed record CommentThread(CommentRow Root, IReadOnlyList<CommentRow> Replies);

/// <summary>The comments of a design: <see cref="Open"/> = threads that are not resolved (the badge of the rail), <see cref="CanComment"/> = false for the platform's own templates.</summary>
public sealed record CommentList(IReadOnlyList<CommentThread> Threads, int Open, int Total, bool CanComment);

/// <summary>What a person sends to write a comment. <c>Mentions</c> = ids of the people the text names with <c>@Name</c>.</summary>
public sealed record CommentInput(string? Text, string? PageId, string? ElementId, double? X, double? Y, long? ParentId, IReadOnlyList<long>? Mentions);

/// <summary>
/// Comments on a design (docs/PLAN-PLATFORM.md section 1.18). <b>Viewing the design is enough to comment</b> (and to reply, edit one's own, resolve one's own thread); resolving somebody else's thread needs
/// Edit, deleting somebody else's comment needs Manage. A person who may not see the design gets 404 from every method, so ids cannot be probed. Rules: plain text, 1 to 2000 characters (control, bidi and
/// zero-width characters are removed, too long is refused, not cut); a reply belongs to a top-level comment of the same design (one level only) and has no pin; a page or element that is not in the current
/// document is dropped; at most 500 comments per design and 30 per person per minute. A mention is a name in the text (<c>@Anna Muster</c>) plus the id the client sends: the id counts only when the person
/// can see the design and the text really contains the name, so nobody is pinged without a visible sign. Notifications: a mention (<see cref="NotificationKinds.Mention"/>), and a reply goes to the author of the
/// thread and to the people who answered in it (<see cref="NotificationKinds.CommentReply"/>); never to the author of the comment, never to a person who cannot see the design, and nobody twice. The platform's own
/// templates (no area) have no comments.
/// </summary>
public static partial class CommentLogic
{
    public const int MaxLength = 2000;
    public const int MaxPerDesign = 500;
    public const int MaxPerMinute = 30;
    public const int MaxMentions = 20;
    public const int MaxCandidates = 8;
    public const int ExcerptLength = 140;

    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    // ------------------------------------------------------------------------------------------------ text

    /// <summary>The text as it is stored: line breaks as \n, tabs as spaces, no control, bidi or zero-width characters, trimmed, no more than one empty line in a row.</summary>
    public static string CleanText(string? raw)
    {
        if (string.IsNullOrEmpty(raw))
        {
            return "";
        }

        var sb = new StringBuilder(raw.Length);
        for (var i = 0; i < raw.Length; i++)
        {
            var c = raw[i];
            if (c == '\r')
            {
                if (i + 1 >= raw.Length || raw[i + 1] != '\n')
                {
                    sb.Append('\n');
                }

                continue;
            }

            if (c == '\n')
            {
                sb.Append('\n');
            }
            else if (c == '\t')
            {
                sb.Append(' ');
            }
            else if (!char.IsControl(c) && !Invisible(c))
            {
                sb.Append(c);
            }
        }

        return Blank().Replace(sb.ToString(), "\n\n").Trim();
    }

    private static bool Invisible(char c)
        => c is >= '​' and <= '‏' or >= '‪' and <= '‮' or >= '⁠' and <= '⁤' or >= '⁦' and <= '⁩' or '﻿' or '᠎' or '؜';

    [GeneratedRegex("\n{3,}")]
    private static partial Regex Blank();

    private static string Excerpt(string text)
    {
        var flat = text.Replace('\n', ' ');
        return flat.Length <= ExcerptLength ? flat : flat[..(ExcerptLength - 1)].TrimEnd() + "…";
    }

    // ------------------------------------------------------------------------------------------------ who can see the design (for mentions and notifications)

    /// <summary>The ids of the people who can see the design: members of its area, people it was shared with (itself or a folder above, directly or through a team) and people who opened a live sign-in link. A public link gives nobody anything here.</summary>
    internal static async Task<HashSet<long>> AudienceAsync(DtDbContext db, long designId, DateTime now)
    {
        var (spaceId, _) = await Access.RawPlaceAsync(db, ItemKind.Design, designId);
        var chain = await ShareLogic.FolderChainAsync(db, ItemKind.Design, designId);
        var ids = new HashSet<long>();
        if (spaceId is { } space)
        {
            ids.UnionWith(await db.SpaceMember.AsNoTracking().Where(m => m.SpaceId == space).Select(m => m.UserId).ToListAsync());
        }

        var shares = await db.Share.AsNoTracking()
            .Where(s => (s.ItemKind == ItemKind.Design && s.ItemId == designId) || (s.ItemKind == ItemKind.Folder && chain.Contains(s.ItemId)))
            .Select(s => new { s.UserId, s.SpaceId }).ToListAsync();
        ids.UnionWith(shares.Where(s => s.UserId is not null).Select(s => s.UserId!.Value));
        var teams = shares.Where(s => s.SpaceId is not null).Select(s => s.SpaceId!.Value).Distinct().ToList();
        if (teams.Count > 0)
        {
            ids.UnionWith(await db.SpaceMember.AsNoTracking().Where(m => teams.Contains(m.SpaceId)).Select(m => m.UserId).ToListAsync());
        }

        ids.UnionWith(await (from g in db.LinkGrant.AsNoTracking()
                             join l in db.ShareLink.AsNoTracking() on g.ShareLinkId equals l.Id
                             where l.Audience == LinkAudience.SignedIn && l.RevokedDate == null && (l.ExpiresDate == null || l.ExpiresDate > now)
                                && ((l.ItemKind == ItemKind.Design && l.ItemId == designId) || (l.ItemKind == ItemKind.Folder && chain.Contains(l.ItemId)))
                             select g.UserId).ToListAsync());
        return ids;
    }

    /// <summary>Of the ids the client sent: those that are people who can see the design (not the author), whose name stands in the text as <c>@Name</c>.</summary>
    private static async Task<List<MentionedPerson>> ValidMentionsAsync(Biz biz, long designId, string text, IReadOnlyList<long>? sent, long author)
    {
        if (sent is null || sent.Count == 0)
        {
            return [];
        }

        var wanted = sent.Where(id => id != author).Distinct().Take(MaxMentions).ToList();
        if (wanted.Count == 0)
        {
            return [];
        }

        var audience = await AudienceAsync(biz.Db, designId, biz.Now);
        wanted = wanted.Where(audience.Contains).ToList();
        if (wanted.Count == 0)
        {
            return [];
        }

        var people = await biz.Db.User.AsNoTracking().Where(u => wanted.Contains(u.Id) && u.IsActive && u.ApprovalState == ApprovalState.Approved).Select(u => new MentionedPerson(u.Id, u.DisplayName)).ToListAsync();
        return people.Where(p => p.Name.Length > 0 && text.Contains("@" + p.Name, StringComparison.OrdinalIgnoreCase)).ToList();
    }

    private static List<long> ReadMentions(string? json)
    {
        try
        {
            return string.IsNullOrWhiteSpace(json) ? [] : JsonSerializer.Deserialize<List<long>>(json, Web) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    /// <summary>People to mention, found by the start of the name (or, for somebody who manages the design, of the e-mail address); an empty text lists the first ones. The asking person is left out.</summary>
    public static async Task<List<MentionCandidate>> MentionCandidatesAsync(Biz biz, long designId, string? q)
    {
        var level = await Access.RequireAsync(biz, ItemKind.Design, designId, AccessLevel.View);
        var uid = biz.UserId;
        var audience = await AudienceAsync(biz.Db, designId, biz.Now);
        audience.Remove(uid);
        if (audience.Count == 0)
        {
            return [];
        }

        var ids = audience.ToList();
        var text = (q ?? "").Trim();
        text = text[..Math.Min(text.Length, 60)];
        var query = biz.Db.User.AsNoTracking().Where(u => ids.Contains(u.Id) && u.IsActive && u.ApprovalState == ApprovalState.Approved);
        if (text.Length > 0)
        {
            var starts = Services.Like.Contains(text)[1..]; // "text%": the start of the name or of one of its words
            var word = "% " + starts;
            query = level >= AccessLevel.Manage
                ? query.Where(u => EF.Functions.ILike(u.DisplayName, starts, "\\") || EF.Functions.ILike(u.DisplayName, word, "\\") || EF.Functions.ILike(u.Email, starts, "\\"))
                : query.Where(u => EF.Functions.ILike(u.DisplayName, starts, "\\") || EF.Functions.ILike(u.DisplayName, word, "\\"));
        }

        var rows = await query.OrderBy(u => u.DisplayName).ThenBy(u => u.Id).Take(MaxCandidates).Select(u => new { u.Id, u.DisplayName, u.Email }).ToListAsync();
        return rows.Select(u => new MentionCandidate(u.Id, u.DisplayName, Services.Fmt.Initials(u.DisplayName), level >= AccessLevel.Manage ? u.Email : null)).ToList();
    }

    // ------------------------------------------------------------------------------------------------ reading

    private static async Task<bool> CommentableAsync(DtDbContext db, long designId)
        => await db.Design.AsNoTracking().Where(d => d.Id == designId).Select(d => d.SpaceId != null).FirstOrDefaultAsync();

    private static async Task<Dictionary<long, string>> NamesAsync(DtDbContext db, IEnumerable<long> ids)
    {
        var wanted = ids.Distinct().ToList();
        return wanted.Count == 0 ? [] : await db.User.AsNoTracking().Where(u => wanted.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.DisplayName);
    }

    private static CommentRow ToRow(Comment c, IReadOnlyDictionary<long, string> names, long me, AccessLevel level, long? threadAuthor)
    {
        var name = c.CreateUserId is { } a && names.TryGetValue(a, out var n) ? n : "Gelöschter Benutzer";
        var mentions = ReadMentions(c.MentionsJson).Where(names.ContainsKey).Select(id => new MentionedPerson(id, names[id])).ToList();
        var resolvedBy = c.ResolvedUserId is { } r && names.TryGetValue(r, out var rn) ? rn : null;
        var mine = c.CreateUserId == me;
        var top = c.ParentId is null;
        return new CommentRow(c.Id, c.ParentId, c.CreateUserId, name, Services.Fmt.Initials(name), mine, c.Text, mentions, c.PageId, c.ElementId, c.X, c.Y,
            c.CreateDate, c.EditedDate, c.ResolvedDate, c.ResolvedUserId, resolvedBy, mine, mine || level >= AccessLevel.Manage, top && ((threadAuthor ?? c.CreateUserId) == me || level >= AccessLevel.Edit));
    }

    /// <summary>The comments of a design as threads (oldest first). Needs View. The platform's own templates have none.</summary>
    public static async Task<CommentList> ListAsync(Biz biz, long designId)
    {
        var level = await Access.RequireAsync(biz, ItemKind.Design, designId, AccessLevel.View);
        var db = biz.Db;
        if (!await CommentableAsync(db, designId))
        {
            return new CommentList([], 0, 0, false);
        }

        var all = await db.Comment.AsNoTracking().Where(c => c.DesignId == designId).OrderBy(c => c.CreateDate).ThenBy(c => c.Id).ToListAsync();
        var ids = all.Select(c => c.CreateUserId).Concat(all.Select(c => c.ResolvedUserId)).OfType<long>().Concat(all.SelectMany(c => ReadMentions(c.MentionsJson)));
        var names = await NamesAsync(db, ids);
        var me = biz.UserId;
        var roots = all.Where(c => c.ParentId is null).ToList();
        var replies = all.Where(c => c.ParentId is not null).ToLookup(c => c.ParentId!.Value);
        var threads = roots.Select(r => new CommentThread(ToRow(r, names, me, level, r.CreateUserId), replies[r.Id].Select(x => ToRow(x, names, me, level, r.CreateUserId)).ToList())).ToList();
        return new CommentList(threads, roots.Count(r => r.ResolvedDate is null), all.Count, true);
    }

    // ------------------------------------------------------------------------------------------------ writing

    /// <summary>The comment, not deleted, and the person's level on its design (404 when they may not see the design).</summary>
    private static async Task<(Comment Comment, AccessLevel Level)> RequireCommentAsync(Biz biz, long commentId)
    {
        biz.RequireSignedIn();
        var comment = await biz.Db.Comment.FirstOrDefaultAsync(c => c.Id == commentId) ?? throw new NotFoundException();
        var level = await Access.RequireAsync(biz, ItemKind.Design, comment.DesignId, AccessLevel.View);
        return (comment, level);
    }

    private static async Task<CommentRow> RowOfAsync(Biz biz, Comment comment, AccessLevel level)
    {
        var ids = new List<long>(ReadMentions(comment.MentionsJson));
        if (comment.CreateUserId is { } a) { ids.Add(a); }
        if (comment.ResolvedUserId is { } r) { ids.Add(r); }
        long? threadAuthor = comment.CreateUserId;
        if (comment.ParentId is { } parent)
        {
            threadAuthor = await biz.Db.Comment.AsNoTracking().Where(c => c.Id == parent).Select(c => c.CreateUserId).FirstOrDefaultAsync();
        }

        return ToRow(comment, await NamesAsync(biz.Db, ids), biz.UserId, level, threadAuthor);
    }

    /// <summary>
    /// Writes a comment (<see cref="CommentInput.ParentId"/> set: a reply). Needs View. The pin: <c>PageId</c> must be a page of the current document, <c>ElementId</c> an element on it, <c>X</c>/<c>Y</c> a point on
    /// the page (clamped); what does not fit is dropped (a comment without a page is a comment on the design). Returns the row.
    /// </summary>
    public static async Task<CommentRow> AddAsync(Biz biz, long designId, CommentInput input)
    {
        var level = await Access.RequireAsync(biz, ItemKind.Design, designId, AccessLevel.View);
        var db = biz.Db;
        var uid = biz.UserId;
        var design = await db.Design.AsNoTracking().Where(d => d.Id == designId).Select(d => new { d.Name, d.SpaceId, d.DocumentJson }).FirstOrDefaultAsync() ?? throw new NotFoundException();
        if (design.SpaceId is null)
        {
            throw new BizException("Die Vorlagen von MatCan lassen sich nicht kommentieren. Kopiere die Vorlage und kommentiere die Kopie.");
        }

        var text = CleanText(input.Text);
        if (text.Length == 0)
        {
            throw new BizException("Schreib zuerst etwas.", "Text");
        }

        if (text.Length > MaxLength)
        {
            throw new BizException($"Ein Kommentar darf höchstens {MaxLength} Zeichen lang sein (es sind {text.Length}).", "Text");
        }

        var now = biz.Now;
        if (await db.Comment.IgnoreQueryFilters().CountAsync(c => c.CreateUserId == uid && c.CreateDate > now.AddMinutes(-1)) >= MaxPerMinute)
        {
            throw new BizException("Du schreibst sehr schnell. Warte einen Moment, dann geht es weiter.");
        }

        if (await db.Comment.CountAsync(c => c.DesignId == designId) >= MaxPerDesign)
        {
            throw new BizException($"Zu diesem Design gibt es schon {MaxPerDesign} Kommentare. Lösche alte, bevor du neue schreibst.");
        }

        Comment? parent = null;
        if (input.ParentId is { } parentId)
        {
            parent = await db.Comment.FirstOrDefaultAsync(c => c.Id == parentId && c.DesignId == designId) ?? throw new BizException("Der Kommentar, auf den du antwortest, gibt es nicht mehr.");
            if (parent.ParentId is not null)
            {
                throw new BizException("Antworten gibt es nur auf Kommentare, nicht auf Antworten.");
            }
        }

        var comment = new Comment { DesignId = designId, ParentId = parent?.Id, Text = text };
        if (parent is null)
        {
            Pin(comment, DocumentValidator.Parse(design.DocumentJson), input);
        }

        var mentions = await ValidMentionsAsync(biz, designId, text, input.Mentions, uid);
        comment.MentionsJson = JsonSerializer.Serialize(mentions.Select(m => m.Id), Web);
        db.Comment.Add(comment);
        await db.SaveChangesAsync();
        await biz.Log.LogAsync(parent is null ? "Kommentar geschrieben" : "Auf Kommentar geantwortet", "Design", designId, design.Name);

        await NotifyAsync(biz, designId, design.Name, comment, parent, mentions.Select(m => m.Id).ToList(), []);
        return await RowOfAsync(biz, comment, level);
    }

    /// <summary>Fills the pin of a new top-level comment from what the client sent, as far as it fits the document.</summary>
    private static void Pin(Comment comment, DesignDocument? doc, CommentInput input)
    {
        var page = doc?.Pages.FirstOrDefault(p => p.Id == input.PageId);
        if (doc is null || page is null)
        {
            return;
        }

        comment.PageId = page.Id;
        if (!string.IsNullOrEmpty(input.ElementId) && page.Elements.SelectMany(DesignDocument.Flatten).Any(e => e.Id == input.ElementId))
        {
            comment.ElementId = input.ElementId;
        }

        if (input.X is { } x && input.Y is { } y && double.IsFinite(x) && double.IsFinite(y))
        {
            comment.X = Math.Round(Math.Clamp(x, 0, doc.Width), 3);
            comment.Y = Math.Round(Math.Clamp(y, 0, doc.Height), 3);
        }
    }

    /// <summary>Changes the text of the person's own comment (any time); the people who are mentioned now and were not before hear about it. Needs View.</summary>
    public static async Task<CommentRow> EditAsync(Biz biz, long commentId, string? newText, IReadOnlyList<long>? mentions)
    {
        var (comment, level) = await RequireCommentAsync(biz, commentId);
        var uid = biz.UserId;
        if (comment.CreateUserId != uid)
        {
            throw new ForbiddenException("Du kannst nur deine eigenen Kommentare ändern.");
        }

        var text = CleanText(newText);
        if (text.Length == 0)
        {
            throw new BizException("Ein Kommentar darf nicht leer sein. Lösche ihn stattdessen.", "Text");
        }

        if (text.Length > MaxLength)
        {
            throw new BizException($"Ein Kommentar darf höchstens {MaxLength} Zeichen lang sein (es sind {text.Length}).", "Text");
        }

        var before = ReadMentions(comment.MentionsJson);
        var valid = await ValidMentionsAsync(biz, comment.DesignId, text, mentions, uid);
        comment.Text = text;
        comment.MentionsJson = JsonSerializer.Serialize(valid.Select(m => m.Id), Web);
        comment.EditedDate = biz.Now;
        await biz.Db.SaveChangesAsync();
        var fresh = valid.Select(m => m.Id).Where(id => !before.Contains(id)).ToList();
        if (fresh.Count > 0)
        {
            var name = await NotificationLogic.ItemNameAsync(biz.Db, ItemKind.Design, comment.DesignId);
            await NotifyAsync(biz, comment.DesignId, name, comment, null, fresh, [], replyNotice: false);
        }

        return await RowOfAsync(biz, comment, level);
    }

    /// <summary>Marks a thread as done. Top-level comments only; the author of the thread or anybody who may edit the design. Doing it again changes nothing.</summary>
    public static async Task<CommentRow> ResolveAsync(Biz biz, long commentId) => await SetResolvedAsync(biz, commentId, true);

    /// <summary>Opens a resolved thread again (same rules as <see cref="ResolveAsync"/>).</summary>
    public static async Task<CommentRow> ReopenAsync(Biz biz, long commentId) => await SetResolvedAsync(biz, commentId, false);

    private static async Task<CommentRow> SetResolvedAsync(Biz biz, long commentId, bool resolved)
    {
        var (comment, level) = await RequireCommentAsync(biz, commentId);
        var uid = biz.UserId;
        if (comment.ParentId is not null)
        {
            throw new BizException("Erledigen kann man nur den ganzen Kommentar, nicht eine Antwort.");
        }

        if (comment.CreateUserId != uid && level < AccessLevel.Edit)
        {
            throw new ForbiddenException("Das darf nur, wer den Kommentar geschrieben hat oder das Design bearbeiten darf.");
        }

        if ((comment.ResolvedDate is not null) != resolved)
        {
            comment.ResolvedDate = resolved ? biz.Now : null;
            comment.ResolvedUserId = resolved ? uid : null;
            await biz.Db.SaveChangesAsync();
        }

        return await RowOfAsync(biz, comment, level);
    }

    /// <summary>Deletes a comment (a soft delete; the replies of a top-level comment go with it). The author, or whoever manages the design.</summary>
    public static async Task DeleteAsync(Biz biz, long commentId)
    {
        var (comment, level) = await RequireCommentAsync(biz, commentId);
        if (comment.CreateUserId != biz.UserId && level < AccessLevel.Manage)
        {
            throw new ForbiddenException("Du kannst nur deine eigenen Kommentare löschen (oder, wenn du das Design verwaltest, jeden).");
        }

        var db = biz.Db;
        var removing = new List<Comment> { comment };
        if (comment.ParentId is null)
        {
            removing.AddRange(await db.Comment.Where(c => c.ParentId == comment.Id).ToListAsync());
        }

        db.Comment.RemoveRange(removing);
        await db.SaveChangesAsync();
        await biz.Log.LogAsync("Kommentar gelöscht", "Design", comment.DesignId);
    }

    // ------------------------------------------------------------------------------------------------ notifications

    /// <summary>
    /// The mention goes to each mentioned person; a reply to the author of the thread and the people who answered in it (not the person who writes, nobody twice, nobody who was mentioned in this comment,
    /// nobody who cannot see the design). A failure of the notification never fails the comment (<see cref="NotificationLogic.NotifyAsync"/> swallows it).
    /// </summary>
    private static async Task NotifyAsync(Biz biz, long designId, string designName, Comment comment, Comment? parent, IReadOnlyCollection<long> mentioned, IReadOnlyCollection<long> skip, bool replyNotice = true)
    {
        try
        {
            var uid = biz.UserId;
            var audience = await AudienceAsync(biz.Db, designId, biz.Now);
            var by = await NotificationLogic.ActorNameAsync(biz);
            var url = NotificationLogic.CommentUrl(designId, parent?.Id ?? comment.Id);
            var data = new { by, byId = uid, itemKind = "Design", itemId = designId, itemName = designName, commentId = comment.Id, message = Excerpt(comment.Text) };
            var told = mentioned.Where(id => id != uid && audience.Contains(id)).Distinct().ToList();
            if (told.Count > 0)
            {
                await NotificationLogic.NotifyAsync(biz, told, NotificationKinds.Mention, data, url);
            }

            if (parent is not null && replyNotice)
            {
                var participants = await biz.Db.Comment.AsNoTracking().Where(c => c.ParentId == parent.Id).Select(c => c.CreateUserId).ToListAsync();
                participants.Add(parent.CreateUserId);
                var receivers = participants.OfType<long>().Where(id => id != uid && audience.Contains(id) && !told.Contains(id) && !skip.Contains(id)).Distinct().ToList();
                if (receivers.Count > 0)
                {
                    await NotificationLogic.NotifyAsync(biz, receivers, NotificationKinds.CommentReply, data, url);
                }
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            biz.Service<ILoggerFactory>().CreateLogger("Comments").LogWarning(ex, "The notifications of comment {Id} could not be written.", comment.Id);
        }
    }
}
