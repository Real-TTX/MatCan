using System.Text.Json;
using DesignThix.Logic;
using DesignThix.Services;
using Microsoft.AspNetCore.Antiforgery;

namespace DesignThix.Endpoints;

/// <summary>
/// The endpoints of the bell (docs/PLAN-PLATFORM.md section 1.17): the person's own notifications (a list, paged), the count of the unread ones, mark one or all as read. A person only ever sees and changes
/// their own; every POST carries the antiforgery token (<see cref="LibraryEndpoints.Guard"/>). The text of a notification is built on the server from its data and goes to the page as plain text.
/// </summary>
public static class NotificationEndpoints
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    public static void MapNotificationEndpoints(this WebApplication app)
    {
        // ?skip= &take= (at most 100) &unread=true -> { total, unread, items: [{ id, kind, text, message, icon, url, created, ago, read, requestId, requestState }] }
        app.MapGet("/api/notifications", async (int? skip, int? take, bool? unread, Biz biz) =>
        {
            var page = await NotificationLogic.ListAsync(biz, skip ?? 0, take ?? 20, unread ?? false);
            var now = biz.Now;
            return Results.Json(new
            {
                total = page.Total,
                unread = page.Unread,
                items = page.Items.Select(n => new { id = n.Id, kind = n.Kind, text = n.Text, message = n.Message, icon = n.Icon, url = n.Url, created = n.Created, ago = Fmt.Ago(n.Created, now), read = n.IsRead, requestId = n.RequestId, requestState = n.RequestState }),
            }, Web);
        }).RequireAuthorization("SignedIn");

        // the cheap one the bell asks every minute -> { unread }
        app.MapGet("/api/notifications/count", async (Biz biz) => Results.Json(new { unread = await NotificationLogic.UnreadCountAsync(biz) }, Web)).RequireAuthorization("SignedIn");

        app.MapPost("/api/notifications/{id:long}/read", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => LibraryEndpoints.Guard(http, antiforgery, async () =>
        {
            await NotificationLogic.ReadAsync(biz, id);
            return Results.Json(new { unread = await NotificationLogic.UnreadCountAsync(biz) }, Web);
        })).RequireAuthorization("SignedIn");

        app.MapPost("/api/notifications/read-all", (HttpContext http, IAntiforgery antiforgery, Biz biz) => LibraryEndpoints.Guard(http, antiforgery, async () =>
        {
            var count = await NotificationLogic.ReadAllAsync(biz);
            return Results.Json(new { count, unread = 0 }, Web);
        })).RequireAuthorization("SignedIn");
    }
}
