using System.Text.Json;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.Services;
using Microsoft.AspNetCore.Antiforgery;

namespace DesignThix.Endpoints;

/// <summary>
/// The endpoints of the sharing pages (docs/PLAN-PLATFORM.md sections 1.8 to 1.11): the <b>public payload</b> of a public link (<c>/api/s/{token}</c>, no sign-in, rate limited per address, never cached),
/// the access requests, and the presence beat of the editor. Thin: the rules are in <see cref="PublicShareLogic"/>, <see cref="AccessRequestLogic"/> and <see cref="PresenceLogic"/>. Every POST carries the
/// antiforgery token (<see cref="LibraryEndpoints.Guard"/>).
/// </summary>
public static class ShareEndpoints
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    public static void MapShareEndpoints(this WebApplication app)
    {
        // ---------------------------------------------------------------------------------------- the public payload

        // The link of a design: the design. The link of a folder: ?folder= (default the shared folder) -> the gallery. No sign-in; a dead link, a design outside the folder or an unknown token all answer 404.
        app.MapGet("/api/s/{token}", async (string token, long? folder, HttpContext http, Biz biz, PublicRateLimiter limiter) =>
        {
            if (!limiter.TryTake(biz.User.IpAddress, PublicShareLogic.RequestsPerMinute))
            {
                return TooMany(http);
            }

            Quiet(http);
            if (!Guid.TryParse(token, out var id))
            {
                limiter.Charge(biz.User.IpAddress, 4);
                return Gone();
            }

            var info = await PublicShareLogic.InfoAsync(biz, id);
            if (info is null)
            {
                limiter.Charge(biz.User.IpAddress, 4);
                return Gone();
            }

            if (info.Kind == ItemKind.Design)
            {
                var design = await PublicShareLogic.DesignAsync(biz, id, null);
                return design is null ? Gone() : Results.Json(DesignShape(design), Web);
            }

            var gallery = await PublicShareLogic.FolderAsync(biz, id, folder);
            if (gallery is null)
            {
                return Gone();
            }

            return Results.Json(new
            {
                kind = "folder",
                name = info.Name,
                allowDownload = gallery.AllowDownload,
                rootId = gallery.RootId,
                folderId = gallery.FolderId,
                folderName = gallery.Name,
                breadcrumb = gallery.Breadcrumb.Select(c => new { id = c.Id, name = c.Name }),
                items = gallery.Items.Select(i => new { kind = i.Kind, id = i.Id, name = i.Name, thumbUrl = i.ThumbUrl, count = i.Count }),
            }, Web);
        }).AllowAnonymous();

        // a design inside a shared folder
        app.MapGet("/api/s/{token}/d/{designId:long}", async (string token, long designId, HttpContext http, Biz biz, PublicRateLimiter limiter) =>
        {
            if (!limiter.TryTake(biz.User.IpAddress, PublicShareLogic.RequestsPerMinute))
            {
                return TooMany(http);
            }

            Quiet(http);
            var design = Guid.TryParse(token, out var id) ? await PublicShareLogic.DesignAsync(biz, id, designId) : null;
            if (design is null)
            {
                limiter.Charge(biz.User.IpAddress, 4);
                return Gone();
            }

            return Results.Json(DesignShape(design), Web);
        }).AllowAnonymous();

        // ---------------------------------------------------------------------------------------- access requests

        // ?kind=design&id=12 -> [{ id, userId, name, email, permission, message, created }]: the open requests (Manage)
        app.MapGet("/api/access-requests", async (string? kind, long id, Biz biz) =>
        {
            try
            {
                return Results.Json((await AccessRequestLogic.ListAsync(biz, Kind(kind), id)).Select(r => new
                {
                    id = r.Id,
                    userId = r.UserId,
                    name = r.Name,
                    email = r.Email,
                    permission = r.Permission == SharePermission.Edit ? "edit" : "view",
                    message = r.Message,
                    created = r.Created,
                }), Web);
            }
            catch (BizException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
            }
        }).RequireAuthorization("SignedIn");

        // { kind, id, permission: "view"|"edit", message? } -> { ok }
        app.MapPost("/api/access-requests", (HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<RequestBody>(http, antiforgery, async body =>
        {
            await AccessRequestLogic.CreateAsync(biz, Kind(body.Kind), body.Id, Permission(body.Permission), body.Message);
            return Results.Json(new { ok = true }, Web);
        })).RequireAuthorization("SignedIn");

        // { grant: true|false, permission?: "view"|"edit" }
        app.MapPost("/api/access-requests/{id:long}/decide", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<DecideBody>(http, antiforgery, async body =>
        {
            await AccessRequestLogic.DecideAsync(biz, id, body.Grant, body.Permission is null ? null : Permission(body.Permission));
            return Results.Json(new { ok = true }, Web);
        })).RequireAuthorization("SignedIn");

        // ---------------------------------------------------------------------------------------- presence

        // { leave?: true } -> { people: [{ userId, name, editing, you }] }
        app.MapPost("/api/designs/{id:long}/presence", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => LibraryEndpoints.Guard(http, antiforgery, async () =>
        {
            // the body is optional: a beat sends {} and a goodbye {"leave":true}
            PresenceBody? body = null;
            if (http.Request.HasJsonContentType())
            {
                try
                {
                    body = await http.Request.ReadFromJsonAsync<PresenceBody>(Web, http.RequestAborted);
                }
                catch (JsonException)
                {
                    body = null;
                }
            }

            var room = await PresenceLogic.BeatAsync(biz, id, body?.Leave ?? false);
            var me = biz.UserId;
            return Results.Json(new { people = room.Select(p => new { userId = p.UserId, name = p.Name, editing = p.Editing, you = p.UserId == me }) }, Web);
        })).RequireAuthorization("SignedIn");
    }

    // ------------------------------------------------------------------------------------------------ helpers

    private sealed record RequestBody(string? Kind, long Id, string? Permission, string? Message);

    private sealed record DecideBody(bool Grant, string? Permission);

    private sealed record PresenceBody(bool Leave);

    private static object DesignShape(PublicDesignPayload d)
    {
        using var document = JsonDocument.Parse(d.DocumentJson);
        return new
        {
            kind = "design",
            id = d.Id,
            name = d.Name,
            allowDownload = d.AllowDownload,
            folderId = d.FolderId,
            pages = d.Pages,
            document = document.RootElement.Clone(),
            fonts = d.Fonts.Select(f => new { family = f.Family, weight = f.Weight, style = f.Style, url = f.Url }),
            assets = d.Assets,
            warnings = d.Warnings,
        };
    }

    /// <summary>The answers of the public side are never cached and never indexed.</summary>
    private static void Quiet(HttpContext http)
    {
        http.Response.Headers.CacheControl = "no-store";
        http.Response.Headers["X-Robots-Tag"] = "noindex, nofollow";
    }

    private static IResult Gone() => Results.Json(new { error = "Dieser Link ist nicht mehr gültig." }, statusCode: StatusCodes.Status404NotFound);

    private static IResult TooMany(HttpContext http)
    {
        http.Response.Headers.RetryAfter = "60";
        return Results.Json(new { error = "Zu viele Anfragen. Bitte warte eine Minute." }, statusCode: StatusCodes.Status429TooManyRequests);
    }

    private static Task<IResult> Post<T>(HttpContext http, IAntiforgery antiforgery, Func<T, Task<IResult>> action) where T : class
        => LibraryEndpoints.Guard(http, antiforgery, async () =>
        {
            var body = await http.Request.ReadFromJsonAsync<T>(Web, http.RequestAborted);
            return body is null ? Results.Json(new { error = "Die Anfrage ist leer." }, statusCode: StatusCodes.Status400BadRequest) : await action(body);
        });

    private static ItemKind Kind(string? name) => name?.Trim().ToLowerInvariant() switch
    {
        "folder" => ItemKind.Folder,
        "design" => ItemKind.Design,
        "datalist" or "data-list" => ItemKind.DataList,
        "outputjob" or "output" => ItemKind.OutputJob,
        _ => throw new BizException("Diese Art von Element kenne ich nicht."),
    };

    private static SharePermission Permission(string? permission) => string.Equals(permission, "edit", StringComparison.OrdinalIgnoreCase) ? SharePermission.Edit : SharePermission.View;
}
