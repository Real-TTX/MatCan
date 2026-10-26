using System.Text.Json;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using Microsoft.AspNetCore.Antiforgery;

namespace DesignThix.Endpoints;

/// <summary>
/// The endpoints of the platform (docs/PLAN-PLATFORM.md section 4): the browser's query and actions on items (<c>/api/items</c>), folders, sharing, and the areas and their members. Thin: the
/// rules and the access checks are in <see cref="ItemLogic"/>, <see cref="FolderLogic"/>, <see cref="ShareLogic"/> and <see cref="SpaceLogic"/>; every POST carries the antiforgery token
/// (<see cref="LibraryEndpoints.Guard"/>). A thing the person may not see is a 404, one they see but may not change a 403.
/// </summary>
public static class PlatformEndpoints
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    public static void MapPlatformEndpoints(this WebApplication app)
    {
        // ---------------------------------------------------------------------------------------- items

        // ?scope=space|shared|recent|starred|trash &space= &folder= &recursive= &kinds=folder,design,datalist,outputjob,asset &q= &sort=updated|name|created &desc= &foldersFirst= &templates=false &skip= &take=
        // -> { total, items: [{ kind, id, name, folderId, spaceId, spaceName, owner, updated, created, thumbUrl, detail, starred, opened, color, key, isTemplate, trashed, canEdit, canManage, previews }] }
        app.MapGet("/api/items", async (string? scope, long? space, long? folder, bool? recursive, string? kinds, string? q, string? sort, bool? desc, bool? foldersFirst, bool? templates, int? skip, int? take, Biz biz) =>
        {
            var query = new ItemQuery
            {
                Scope = Enum.TryParse<ItemScope>(scope, true, out var s) ? s : ItemScope.Space,
                SpaceId = space,
                FolderId = folder,
                Recursive = recursive ?? false,
                Kinds = ParseKinds(kinds),
                Q = q,
                Sort = sort ?? "updated",
                Desc = desc ?? true,
                FoldersFirst = foldersFirst ?? true,
                ExcludeTemplates = templates == false,
                Skip = skip ?? 0,
                Take = take ?? 60,
            };
            var page = await ItemLogic.QueryAsync(biz, query);
            return Results.Json(new { total = page.Total, items = page.Items.Select(Shape) }, Web);
        }).RequireAuthorization("SignedIn");

        // { items: [{ kind, id }], spaceId?, folderId? } -> { count }
        app.MapPost("/api/items/move", (HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<ItemsBody>(http, antiforgery, async body =>
            Results.Json(new { count = await ItemLogic.MoveAsync(biz, Refs(body), body.SpaceId, body.FolderId) }, Web))).RequireAuthorization("SignedIn");

        // { items: [{ kind, id }] } -> { items: [{ kind, id }] }: copies next to the originals ("Kopie erstellen")
        app.MapPost("/api/items/duplicate", (HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<ItemsBody>(http, antiforgery, async body =>
            Results.Json(new { items = (await ItemLogic.DuplicateAsync(biz, Refs(body))).Select(r => new { kind = KindName(r.Kind), id = r.Id }) }, Web))).RequireAuthorization("SignedIn");

        // { kind, id, name } -> { name }
        app.MapPost("/api/items/rename", (HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<RenameBody>(http, antiforgery, async body =>
            Results.Json(new { name = await ItemLogic.RenameAsync(biz, Kind(body.Kind), body.Id, body.Name) }, Web))).RequireAuthorization("SignedIn");

        // { name, spaceId?, folderId? } -> { id, url }: an empty data list in an area or folder (the "Neu" menu of the browser)
        app.MapPost("/api/items/new-datalist", (HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<NewListBody>(http, antiforgery, async body =>
        {
            var list = await DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput(body.Name ?? "", null, false), body.SpaceId, body.FolderId);
            return Results.Json(new { id = list.Id, url = $"/DataLists/Edit/{list.Id}" }, Web);
        })).RequireAuthorization("SignedIn");

        // -> { items: [{ kind, id }] }: the copies
        app.MapPost("/api/items/copy", (HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<ItemsBody>(http, antiforgery, async body =>
            Results.Json(new { items = (await ItemLogic.CopyAsync(biz, Refs(body), body.SpaceId, body.FolderId)).Select(r => new { kind = KindName(r.Kind), id = r.Id }) }, Web))).RequireAuthorization("SignedIn");

        app.MapPost("/api/items/trash", (HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<ItemsBody>(http, antiforgery, async body =>
        {
            await ItemLogic.TrashAsync(biz, Refs(body));
            return Results.Json(new { ok = true }, Web);
        })).RequireAuthorization("SignedIn");

        app.MapPost("/api/items/restore", (HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<ItemsBody>(http, antiforgery, async body =>
        {
            await ItemLogic.RestoreAsync(biz, Refs(body));
            return Results.Json(new { ok = true }, Web);
        })).RequireAuthorization("SignedIn");

        app.MapPost("/api/items/purge", (HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<ItemsBody>(http, antiforgery, async body =>
        {
            await ItemLogic.PurgeAsync(biz, Refs(body));
            return Results.Json(new { ok = true }, Web);
        })).RequireAuthorization("SignedIn");

        // { spaceId? } -> { count }: everything in the trash of that area (or of every area) for good
        app.MapPost("/api/items/empty-trash", (HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<ItemsBody>(http, antiforgery, async body =>
            Results.Json(new { count = await ItemLogic.EmptyTrashAsync(biz, body.SpaceId) }, Web))).RequireAuthorization("SignedIn");

        // { kind, id, on }
        app.MapPost("/api/items/star", (HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<StarBody>(http, antiforgery, async body =>
        {
            await ItemLogic.StarAsync(biz, Kind(body.Kind), body.Id, body.On ?? true);
            return Results.Json(new { ok = true }, Web);
        })).RequireAuthorization("SignedIn");

        // ---------------------------------------------------------------------------------------- folders

        // { spaceId?, parentId?, name, color? } -> the folder
        app.MapPost("/api/folders", (HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<FolderBody>(http, antiforgery, async body =>
            Results.Json(ShapeFolder(await FolderLogic.CreateAsync(biz, body.SpaceId, body.ParentId, body.Name, body.Color)), Web))).RequireAuthorization("SignedIn");

        app.MapGet("/api/folders/tree", async (Biz biz) => Results.Json((await FolderLogic.TreeAsync(biz)).Select(t => new
        {
            spaceId = t.SpaceId,
            kind = t.Kind.ToString().ToLowerInvariant(),
            name = t.Name,
            color = t.Color,
            folders = t.Folders.Select(ShapeFolder),
        }), Web)).RequireAuthorization("SignedIn");

        // -> { folder, breadcrumb: [folder], canEdit, canManage }
        app.MapGet("/api/folders/{id:long}", async (long id, Biz biz) =>
        {
            var place = await FolderLogic.PlaceAsync(biz, id);
            var folder = await FolderLogic.GetAsync(biz, id) ?? throw new NotFoundException();
            var crumbs = await FolderLogic.BreadcrumbAsync(biz, id);
            return Results.Json(new { folder = ShapeFolder(folder), breadcrumb = crumbs.Select(ShapeFolder), canEdit = place.CanEdit, canManage = place.CanManage }, Web);
        }).RequireAuthorization("SignedIn");

        // { name, color? }
        app.MapPost("/api/folders/{id:long}", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<FolderBody>(http, antiforgery, async body =>
            Results.Json(ShapeFolder(await FolderLogic.UpdateAsync(biz, id, body.Name, body.Color)), Web))).RequireAuthorization("SignedIn");

        app.MapPost("/api/folders/{id:long}/rename", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<FolderBody>(http, antiforgery, async body =>
            Results.Json(ShapeFolder(await FolderLogic.RenameAsync(biz, id, body.Name)), Web))).RequireAuthorization("SignedIn");

        // { spaceId?, parentId? }
        app.MapPost("/api/folders/{id:long}/move", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<FolderBody>(http, antiforgery, async body =>
            Results.Json(ShapeFolder(await FolderLogic.MoveAsync(biz, id, body.SpaceId, body.ParentId)), Web))).RequireAuthorization("SignedIn");

        // ---------------------------------------------------------------------------------------- sharing

        // ?q= (at least two characters) -> [{ type: "user"|"team", id, name, email, color }]
        // The search lists people by name and address, so it is the way to read the member list of the platform a few at a time (open registration lets anybody in): a brake per person.
        app.MapGet("/api/share/search", async (string? q, Biz biz, Services.PublicRateLimiter limiter) =>
        {
            if (!limiter.TryTake("share-search:" + biz.User.UserId, ShareLogic.SearchesPerMinute))
            {
                return Results.Json(new { error = "Zu viele Suchanfragen. Bitte warte einen Moment." }, statusCode: StatusCodes.Status429TooManyRequests);
            }

            return Results.Json((await ShareLogic.SearchAsync(biz, q)).Select(r => new { type = r.Type, id = r.Id, name = r.Name, email = r.Email, color = r.Color }), Web);
        }).RequireAuthorization("SignedIn");

        // a signed-in person opens a link: { token } -> { kind, id, name, audience, permission } or 404 when the link is dead
        app.MapPost("/api/share/open", (HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<TokenBody>(http, antiforgery, async body =>
        {
            var target = Guid.TryParse(body.Token, out var token) ? await ShareLogic.OpenAsync(biz, token) : null;
            return target is null
                ? Results.Json(new { error = "Dieser Link ist nicht mehr gültig." }, statusCode: StatusCodes.Status404NotFound)
                : Results.Json(new { kind = KindName(target.Kind), id = target.ItemId, name = target.Name, audience = target.Audience.ToString(), permission = target.Permission.ToString() }, Web);
        })).RequireAuthorization("SignedIn");

        // -> who has access, the link (people who manage the item only) and what the person may do
        app.MapGet("/api/share/{kind}/{id:long}", async (string kind, long id, Biz biz) =>
        {
            var info = await ShareLogic.InfoAsync(biz, Kind(kind), id);
            return Results.Json(new
            {
                kind = KindName(info.Kind),
                id = info.Id,
                name = info.Name,
                myLevel = info.MyLevel.ToString().ToLowerInvariant(),
                spaceId = info.SpaceId,
                spaceName = info.SpaceName,
                spaceKind = info.SpaceKind?.ToString().ToLowerInvariant(),
                canShare = info.CanShare,
                canLink = info.CanLink,
                publicLinksAllowed = info.PublicLinksAllowed,
                publicLinkPossible = info.PublicLinkPossible,
                link = info.Link is null ? null : new { id = info.Link.Id, token = info.Link.Token, audience = info.Link.Audience.ToString(), permission = info.Link.Permission.ToString(), allowDownload = info.Link.AllowDownload, expires = info.Link.ExpiresDate, grantCount = info.Link.GrantCount, expired = info.Link.Expired },
                entries = info.Entries.Select(e => new
                {
                    kind = e.Kind,
                    shareId = e.ShareId,
                    userId = e.UserId,
                    spaceId = e.SpaceId,
                    name = e.Name,
                    email = e.Email,
                    color = e.Color,
                    role = e.Role?.ToString(),
                    permission = e.Permission,
                    inherited = e.Inherited,
                    viaFolderId = e.ViaFolderId,
                    viaFolderName = e.ViaFolderName,
                    canChange = e.CanChange,
                }),
            }, Web);
        }).RequireAuthorization("SignedIn");

        // { userId? | teamId?, permission: "View"|"Edit" } -> { shareId }
        app.MapPost("/api/share/{kind}/{id:long}", (string kind, long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<ShareBody>(http, antiforgery, async body =>
        {
            var share = await ShareLogic.AddAsync(biz, Kind(kind), id, body.TeamId is not null, body.TeamId ?? body.UserId ?? throw new BizException("Wähle eine Person oder ein Team."), Permission(body.Permission), body.Message);
            return Results.Json(new { shareId = share.Id }, Web);
        })).RequireAuthorization("SignedIn");

        // { shareId, permission }
        app.MapPost("/api/share/{kind}/{id:long}/change", (string kind, long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<ShareBody>(http, antiforgery, async body =>
        {
            await ShareLogic.ChangeAsync(biz, body.ShareId ?? throw new BizException("Welche Freigabe?"), Permission(body.Permission));
            return Results.Json(new { ok = true }, Web);
        })).RequireAuthorization("SignedIn");

        // { shareId }
        app.MapPost("/api/share/{kind}/{id:long}/remove", (string kind, long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<ShareBody>(http, antiforgery, async body =>
        {
            await ShareLogic.RemoveAsync(biz, body.ShareId ?? throw new BizException("Welche Freigabe?"));
            return Results.Json(new { ok = true }, Web);
        })).RequireAuthorization("SignedIn");

        // the person gives up what was shared with them (a share to them, or the access through a link)
        app.MapPost("/api/share/{kind}/{id:long}/leave", (string kind, long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => LibraryEndpoints.Guard(http, antiforgery, async () =>
        {
            await ShareLogic.LeaveShareAsync(biz, Kind(kind), id);
            return Results.Json(new { ok = true }, Web);
        })).RequireAuthorization("SignedIn");

        // { audience: "SignedIn"|"Public", permission: "View"|"Edit", allowDownload?, expires? } -> { token }: makes the link or changes it
        app.MapPost("/api/share/{kind}/{id:long}/link", (string kind, long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<LinkBody>(http, antiforgery, async body =>
        {
            var link = await ShareLogic.SetLinkAsync(biz, Kind(kind), id, Enum.TryParse<LinkAudience>(body.Audience, true, out var audience) ? audience : LinkAudience.SignedIn, Permission(body.Permission), body.AllowDownload ?? false, body.Expires);
            return Results.Json(new { token = link.Token, audience = link.Audience.ToString(), permission = link.Permission.ToString() }, Web);
        })).RequireAuthorization("SignedIn");

        app.MapPost("/api/share/{kind}/{id:long}/link/reset", (string kind, long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => LibraryEndpoints.Guard(http, antiforgery, async () =>
        {
            var link = await ShareLogic.ResetLinkAsync(biz, Kind(kind), id);
            return Results.Json(new { token = link.Token }, Web);
        })).RequireAuthorization("SignedIn");

        app.MapPost("/api/share/{kind}/{id:long}/link/revoke", (string kind, long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => LibraryEndpoints.Guard(http, antiforgery, async () =>
        {
            await ShareLogic.RevokeLinkAsync(biz, Kind(kind), id);
            return Results.Json(new { ok = true }, Web);
        })).RequireAuthorization("SignedIn");

        // ---------------------------------------------------------------------------------------- areas

        // -> [{ id, kind, name, slug, description, color, myRole, memberCount, quotaBytes, usedBytes, storageQuota }]: the personal area and the teams of the person
        app.MapGet("/api/spaces", async (Biz biz) =>
        {
            var spaces = await SpaceLogic.MySpacesAsync(biz);
            var list = new List<object>();
            foreach (var s in spaces)
            {
                var usage = await StorageLogic.UsageAsync(biz, s.Id);
                list.Add(new
                {
                    id = s.Id,
                    kind = s.Kind.ToString().ToLowerInvariant(),
                    name = s.Kind == SpaceKind.Personal ? SpaceLogic.PersonalName : s.Name,
                    slug = s.Slug,
                    description = s.Description,
                    color = s.Color,
                    myRole = s.MyRole?.ToString(),
                    memberCount = s.MemberCount,
                    usedBytes = usage.UsedBytes,
                    quotaBytes = usage.QuotaBytes,
                });
            }

            return Results.Json(list, Web);
        }).RequireAuthorization("SignedIn");

        // { name, description?, color? } -> { id, slug }
        app.MapPost("/api/spaces", (HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<SpaceBody>(http, antiforgery, async body =>
        {
            var team = await SpaceLogic.CreateTeamAsync(biz, body.Name, body.Description, body.Color);
            return Results.Json(new { id = team.Id, slug = team.Slug }, Web);
        })).RequireAuthorization("SignedIn");

        app.MapGet("/api/spaces/{id:long}/members", async (long id, Biz biz) => Results.Json((await SpaceLogic.MembersAsync(biz, id)).Select(m => new { userId = m.UserId, name = m.DisplayName, email = m.Email, role = m.Role.ToString(), since = m.Since }), Web))
            .RequireAuthorization("SignedIn");

        // { userId, role: "Owner"|"Admin"|"Editor"|"Viewer" }
        app.MapPost("/api/spaces/{id:long}/members", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<MemberBody>(http, antiforgery, async body =>
        {
            await SpaceLogic.AddMemberAsync(biz, id, body.UserId, Role(body.Role));
            return Results.Json(new { ok = true }, Web);
        })).RequireAuthorization("SignedIn");

        app.MapPost("/api/spaces/{id:long}/members/role", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<MemberBody>(http, antiforgery, async body =>
        {
            await SpaceLogic.ChangeRoleAsync(biz, id, body.UserId, Role(body.Role));
            return Results.Json(new { ok = true }, Web);
        })).RequireAuthorization("SignedIn");

        app.MapPost("/api/spaces/{id:long}/members/remove", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<MemberBody>(http, antiforgery, async body =>
        {
            await SpaceLogic.RemoveMemberAsync(biz, id, body.UserId);
            return Results.Json(new { ok = true }, Web);
        })).RequireAuthorization("SignedIn");

        // { name, description?, color? } -> { id, slug }: name, colour and description of a team (Owner and Admin)
        app.MapPost("/api/spaces/{id:long}", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<SpaceBody>(http, antiforgery, async body =>
        {
            var team = await SpaceLogic.UpdateTeamAsync(biz, id, body.Name, body.Description, body.Color);
            return Results.Json(new { id = team.Id, slug = team.Slug }, Web);
        })).RequireAuthorization("SignedIn");

        // { name }: deletes a team (the Owner; the body must carry the team's name exactly, as the page makes the person type it): the content goes to the trash
        app.MapPost("/api/spaces/{id:long}/delete", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<DeleteSpaceBody>(http, antiforgery, async body =>
        {
            await SpaceLogic.DeleteTeamAsync(biz, id, body.Name);
            return Results.Json(new { ok = true }, Web);
        })).RequireAuthorization("SignedIn");

        // { userId }: the Owner hands the ownership to another member (and becomes Admin)
        app.MapPost("/api/spaces/{id:long}/transfer", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<MemberBody>(http, antiforgery, async body =>
        {
            await SpaceLogic.TransferOwnershipAsync(biz, id, body.UserId);
            return Results.Json(new { ok = true }, Web);
        })).RequireAuthorization("SignedIn");

        app.MapPost("/api/spaces/{id:long}/leave", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => LibraryEndpoints.Guard(http, antiforgery, async () =>
        {
            await SpaceLogic.LeaveAsync(biz, id);
            return Results.Json(new { ok = true }, Web);
        })).RequireAuthorization("SignedIn");
    }

    // ------------------------------------------------------------------------------------------------ bodies and shapes

    private sealed record ItemRefBody(string? Kind, long Id);

    private sealed record ItemsBody(List<ItemRefBody>? Items, long? SpaceId, long? FolderId);

    private sealed record StarBody(string? Kind, long Id, bool? On);

    private sealed record RenameBody(string? Kind, long Id, string? Name);

    private sealed record NewListBody(string? Name, long? SpaceId, long? FolderId);

    private sealed record FolderBody(long? SpaceId, long? ParentId, string? Name, string? Color);

    private sealed record ShareBody(long? UserId, long? TeamId, long? ShareId, string? Permission, string? Message = null);

    private sealed record LinkBody(string? Audience, string? Permission, bool? AllowDownload, DateTime? Expires);

    private sealed record TokenBody(string? Token);

    private sealed record SpaceBody(string? Name, string? Description, string? Color);

    private sealed record MemberBody(long UserId, string? Role);

    private sealed record DeleteSpaceBody(string? Name);

    private static Task<IResult> Post<T>(HttpContext http, IAntiforgery antiforgery, Func<T, Task<IResult>> action) where T : class
        => LibraryEndpoints.Guard(http, antiforgery, async () =>
        {
            var body = await http.Request.ReadFromJsonAsync<T>(Web, http.RequestAborted);
            return body is null ? Results.Json(new { error = "Die Anfrage ist leer." }, statusCode: StatusCodes.Status400BadRequest) : await action(body);
        });

    private static IEnumerable<ItemRef> Refs(ItemsBody body) => (body.Items ?? []).Select(i => new ItemRef(Kind(i.Kind), i.Id));

    /// <summary>The name of a kind in addresses and JSON: folder, design, datalist, outputjob, asset.</summary>
    public static string KindName(ItemKind kind) => kind.ToString().ToLowerInvariant();

    private static ItemKind Kind(string? name) => name?.Trim().ToLowerInvariant() switch
    {
        "folder" => ItemKind.Folder,
        "design" => ItemKind.Design,
        "datalist" or "data-list" => ItemKind.DataList,
        "outputjob" or "output" => ItemKind.OutputJob,
        "asset" => ItemKind.Asset,
        _ => throw new BizException("Diese Art von Element kenne ich nicht."),
    };

    private static List<ItemKind>? ParseKinds(string? kinds)
        => string.IsNullOrWhiteSpace(kinds) ? null : [.. kinds.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Select(Kind)];

    private static SharePermission Permission(string? permission) => string.Equals(permission, "edit", StringComparison.OrdinalIgnoreCase) ? SharePermission.Edit : SharePermission.View;

    private static SpaceRole Role(string? role) => Enum.TryParse<SpaceRole>(role, true, out var parsed) ? parsed : SpaceRole.Viewer;

    private static object Shape(ItemRow r) => new
    {
        kind = KindName(r.Kind),
        id = r.Id,
        name = r.Name,
        folderId = r.FolderId,
        spaceId = r.SpaceId,
        spaceName = r.SpaceName,
        owner = r.Owner,
        updated = r.UpdateDate,
        created = r.CreateDate,
        thumbUrl = r.ThumbUrl,
        detail = r.Detail,
        starred = r.Starred,
        opened = r.Opened,
        color = r.Color,
        key = r.Kind == ItemKind.Asset ? r.Key : null,
        isTemplate = r.IsTemplate,
        trashed = r.TrashedDate,
        canEdit = r.CanEdit,
        canManage = r.CanManage,
        previews = r.Previews,
    };

    private static object ShapeFolder(FolderRow f) => new { id = f.Id, spaceId = f.SpaceId, parentId = f.ParentId, name = f.Name, color = f.Color, path = f.Path, depth = f.Depth, updated = f.UpdateDate };
}
