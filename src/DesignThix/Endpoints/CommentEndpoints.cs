using System.Text.Json;
using DesignThix.Logic;
using DesignThix.Services;
using Microsoft.AspNetCore.Antiforgery;

namespace DesignThix.Endpoints;

/// <summary>
/// The endpoints of the comments of the editor (docs/PLAN-PLATFORM.md section 1.18): the threads of a design, a new comment or reply, edit, resolve, reopen, delete, and the people to mention. Thin: the
/// rules (View is enough to comment, who may resolve and delete, the limits, the mentions and notifications) are in <see cref="CommentLogic"/>. A person who may not see the design gets 404 from all of
/// them. Every POST carries the antiforgery token (<see cref="LibraryEndpoints.Guard"/>). Text goes to the page as plain text.
/// </summary>
public static class CommentEndpoints
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    private sealed record AddBody(string? Text, string? PageId, string? ElementId, double? X, double? Y, long? ParentId, long[]? Mentions);

    private sealed record EditBody(string? Text, long[]? Mentions);

    public static void MapCommentEndpoints(this WebApplication app)
    {
        // -> { canComment, open, total, threads: [{ ...comment, replies: [comment] }] }; a comment: { id, parentId, authorId, author, initials, mine, text, mentions: [{ id, name }], pageId, elementId, x, y,
        // created, ago, edited, resolved, resolvedBy, canEdit, canDelete, canResolve }
        app.MapGet("/api/designs/{id:long}/comments", async (long id, Biz biz) =>
        {
            var list = await CommentLogic.ListAsync(biz, id);
            var now = biz.Now;
            return Results.Json(new
            {
                canComment = list.CanComment,
                open = list.Open,
                total = list.Total,
                threads = list.Threads.Select(t => Shape(t.Root, now, t.Replies.Select(r => Shape(r, now, null)).ToList())),
            }, Web);
        }).RequireAuthorization("SignedIn");

        // ?q= -> [{ id, name, initials, email }] (at most 8; the e-mail only for people who manage the design)
        app.MapGet("/api/designs/{id:long}/comments/mentions", async (long id, string? q, Biz biz)
            => Results.Json((await CommentLogic.MentionCandidatesAsync(biz, id, q)).Select(c => new { id = c.Id, name = c.Name, initials = c.Initials, email = c.Email }), Web)).RequireAuthorization("SignedIn");

        // { text, pageId?, elementId?, x?, y?, parentId?, mentions?: [userId] } -> the comment
        app.MapPost("/api/designs/{id:long}/comments", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<AddBody>(http, antiforgery, async body =>
        {
            var row = await CommentLogic.AddAsync(biz, id, new CommentInput(body.Text, body.PageId, body.ElementId, body.X, body.Y, body.ParentId, body.Mentions));
            return Results.Json(Shape(row, biz.Now, null), Web);
        })).RequireAuthorization("SignedIn");

        // { text, mentions? } -> the comment
        app.MapPost("/api/comments/{id:long}/edit", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<EditBody>(http, antiforgery, async body =>
            Results.Json(Shape(await CommentLogic.EditAsync(biz, id, body.Text, body.Mentions), biz.Now, null), Web))).RequireAuthorization("SignedIn");

        app.MapPost("/api/comments/{id:long}/resolve", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => LibraryEndpoints.Guard(http, antiforgery, async () =>
            Results.Json(Shape(await CommentLogic.ResolveAsync(biz, id), biz.Now, null), Web))).RequireAuthorization("SignedIn");

        app.MapPost("/api/comments/{id:long}/reopen", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => LibraryEndpoints.Guard(http, antiforgery, async () =>
            Results.Json(Shape(await CommentLogic.ReopenAsync(biz, id), biz.Now, null), Web))).RequireAuthorization("SignedIn");

        app.MapPost("/api/comments/{id:long}/delete", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => LibraryEndpoints.Guard(http, antiforgery, async () =>
        {
            await CommentLogic.DeleteAsync(biz, id);
            return Results.Json(new { ok = true }, Web);
        })).RequireAuthorization("SignedIn");
    }

    private static Task<IResult> Post<T>(HttpContext http, IAntiforgery antiforgery, Func<T, Task<IResult>> action) where T : class
        => LibraryEndpoints.Guard(http, antiforgery, async () =>
        {
            var body = await http.Request.ReadFromJsonAsync<T>(Web, http.RequestAborted);
            return body is null ? Results.Json(new { error = "Die Anfrage ist leer." }, statusCode: StatusCodes.Status400BadRequest) : await action(body);
        });

    private static object Shape(CommentRow c, DateTime now, IReadOnlyList<object>? replies) => new
    {
        id = c.Id,
        parentId = c.ParentId,
        authorId = c.AuthorId,
        author = c.AuthorName,
        initials = c.AuthorInitials,
        mine = c.Mine,
        text = c.Text,
        mentions = c.Mentions.Select(m => new { id = m.Id, name = m.Name }),
        pageId = c.PageId,
        elementId = c.ElementId,
        x = c.X,
        y = c.Y,
        created = c.Created,
        ago = Fmt.Ago(c.Created, now),
        edited = c.Edited,
        resolved = c.Resolved,
        resolvedBy = c.ResolvedByName,
        canEdit = c.CanEdit,
        canDelete = c.CanDelete,
        canResolve = c.CanResolve,
        replies,
    };
}
