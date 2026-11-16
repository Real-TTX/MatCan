using System.Globalization;
using System.Text.Json;
using MatCan.Catalogs;
using MatCan.Core.Media;
using MatCan.Logic;
using Microsoft.AspNetCore.Antiforgery;

namespace MatCan.Endpoints;

/// <summary>
/// The catalogues (docs/PLAN-CATALOGS.md section 4): the list, the collections and the search, the thumbnail proxy, the import into the library and the credits of a design. All need a signed-in person
/// and the business layer checks again. The browser sends ids and words, never an address: what the server asks of a provider is built by the catalogue, and the thumbnail addresses it hands out are
/// signed tokens, so the page never learns an address of a provider and the proxy cannot be used for any other address.
/// </summary>
public static class CatalogEndpoints
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    public static void MapCatalogEndpoints(this WebApplication app)
    {
        app.MapGet("/api/catalogs", async (Biz biz) =>
            Results.Json((await CatalogLogic.ListAsync(biz)).Select(Shape), Web))
            .RequireAuthorization("SignedIn");

        app.MapGet("/api/catalogs/{id}/collections", (string id, HttpContext http, Biz biz) => Run(http, async () =>
            Results.Json((await CatalogLogic.CollectionsAsync(biz, id, http.RequestAborted)).Select(c => new { id = c.Id, name = c.Name, count = c.Count }), Web)))
            .RequireAuthorization("SignedIn");

        // q, collection, kind (photo|illustration|vector|icon|font), orientation (any|landscape|portrait|square), colour, page (from 1), perPage (at most 50)
        app.MapGet("/api/catalogs/{id}/search", (string id, string? q, string? collection, string? kind, string? orientation, string? colour, int? page, int? perPage, HttpContext http, Biz biz) => Run(http, async () =>
        {
            var query = new CatalogQuery
            {
                Text = q ?? "",
                Collection = collection ?? "",
                Kind = ParseKind(kind),
                Orientation = orientation ?? "any",
                Colour = (colour ?? "").Length > 20 ? "" : colour ?? "",
                Page = page ?? 1,
                PerPage = perPage ?? 30,
            };
            var result = await CatalogLogic.SearchAsync(biz, id, query, http.RequestAborted);
            return Results.Json(new
            {
                page = result.Page,
                perPage = result.PerPage,
                total = result.Total,
                hasMore = result.HasMore,
                message = result.Message,
                items = result.Items.Select(i => new
                {
                    id = i.Id,
                    kind = i.Kind.ToString().ToLowerInvariant(),
                    title = i.Title,
                    width = i.Width,
                    height = i.Height,
                    thumb = i.Thumb,
                    author = i.Author,
                    authorUrl = i.AuthorUrl,
                    sourceUrl = i.SourceUrl,
                    licence = i.Licence is { } l ? new { code = l.Code, name = l.Name, url = l.Url, attributionRequired = l.AttributionRequired } : null,
                    assetKey = i.AssetKey,
                    collection = i.Collection,
                    icon = i.Icon is { } ic ? new { body = ic.Body, width = ic.Width, height = ic.Height } : null,
                }),
            }, Web);
        })).RequireAuthorization("SignedIn");

        // The thumbnail proxy: the token (made by the catalogue, valid for a day) says which picture; nothing else of the request is used.
        app.MapGet("/api/catalogs/thumb/{token}", (string token, HttpContext http, Biz biz) => Run(http, async () =>
        {
            var svc = CatalogLogic.Svc(biz);
            var read = svc.Proxy.Read(token);
            if (read is null)
            {
                return Results.NotFound();
            }

            var row = (await CatalogLogic.ListAsync(biz)).FirstOrDefault(r => r.Id == read.Catalog);
            if (row is null)
            {
                return Results.NotFound();
            }

            byte[]? bytes;
            if (read.Url is { } url && Uri.TryCreate(url, UriKind.Absolute, out var uri) && row.External)
            {
                bytes = svc.Thumbs.TryGet(row.Id, uri.AbsoluteUri, biz.Now);
                if (bytes is null)
                {
                    // only a thumbnail that has to be fetched from the provider counts for the brake (a day on disk is free: browsing back and forth costs the provider nothing)
                    svc.Limiter.TakeThumb(biz.UserId);
                    var headers = row.Catalog.ThumbsNeedAuth ? await CatalogLogic.ThumbHeadersAsync(biz, row.Catalog, http.RequestAborted) : null;
                    bytes = (await svc.GetThumbAsync(row.Catalog, uri, headers, http.RequestAborted)).Bytes;
                    if (FileSniffer.Sniff(bytes) is { } kept && (kept.IsImage || (kept.IsFont && row.Catalog.Kinds.HasFlag(CatalogKinds.Font))))
                    {
                        svc.Thumbs.Put(row.Id, uri.AbsoluteUri, bytes);
                    }
                }
            }
            else if (read.ItemId is { } itemId && !row.External)
            {
                svc.Limiter.TakeThumb(biz.UserId);
                var ctx = new CatalogContext { Biz = biz, Catalog = row.Catalog, Services = svc, Settings = row.Setting, BaseUrl = "" };
                bytes = (await row.Catalog.FetchAsync(ctx, itemId, http.RequestAborted)).Bytes;
            }
            else
            {
                return Results.NotFound();
            }

            var sniffed = bytes is null ? null : FileSniffer.Sniff(bytes);
            // a picture, or (the catalogue of fonts) the file of a font the dialog draws its preview with: nothing else is ever served
            if (bytes is null || sniffed is not { } found || !(found.IsImage || (found.IsFont && row.Catalog.Kinds.HasFlag(CatalogKinds.Font))))
            {
                return Results.NotFound();
            }

            http.Response.Headers.CacheControl = "private, max-age=86400";
            if (found.Kind == FileKind.Svg)
            {
                // a picture from outside is cleaned like an upload, and an SVG opened as a page of its own may run and load nothing
                var clean = SvgSafe.Sanitize(bytes);
                if (!clean.Ok || clean.Bytes is null)
                {
                    return Results.NotFound();
                }

                http.Response.Headers.ContentSecurityPolicy = "default-src 'none'; style-src 'unsafe-inline'";
                return Results.File(clean.Bytes, "image/svg+xml");
            }

            return Results.File(bytes, found.ContentType);
        })).RequireAuthorization("SignedIn");

        // { itemId, spaceId?, folderId?, designId?, preferSpace? } -> { key, name, url, width, height, contentType, category, reused }
        app.MapPost("/api/catalogs/{id}/import", (string id, HttpContext http, IAntiforgery antiforgery, Biz biz) => LibraryEndpoints.Guard(http, antiforgery, () => Run(http, async () =>
        {
            var body = await http.Request.ReadFromJsonAsync<ImportBody>(Web, http.RequestAborted);
            if (body is null)
            {
                return Results.Json(new { error = "Die Anfrage braucht itemId." }, statusCode: StatusCodes.Status400BadRequest);
            }

            var result = await CatalogLogic.ImportItemAsync(biz, id, body.ItemId, body.SpaceId, body.FolderId, body.DesignId, body.PreferSpace, http.RequestAborted);
            if (result.Icon is { } icon)
            {
                return Results.Json(new { kind = "icon", name = icon.Name, body = icon.Body, width = icon.Width, height = icon.Height, reused = icon.Reused }, Web);
            }

            if (result.Font is { } font)
            {
                return Results.Json(new { kind = "font", family = font.Family, faces = font.Faces, spaceId = font.SpaceId, reused = font.Reused }, Web);
            }

            var a = result.Picture!.Asset;
            return Results.Json(new { kind = "picture", key = a.Key, name = a.Name, url = a.Url, width = a.Width, height = a.Height, contentType = a.ContentType, category = a.Category, spaceId = a.SpaceId, reused = result.Picture.Reused }, Web);
        }))).RequireAuthorization("SignedIn");

        // the bodies of the icons of catalogues a design names: GET /api/icons?names=mdi:home,tabler:star -> { "mdi:home": { body, width, height } } (what is not stored is left out)
        app.MapGet("/api/icons", async (string? names, Biz biz) =>
        {
            biz.RequireSignedIn();
            var wanted = (names ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Take(IconLogic.MaxNames);
            var found = await IconLogic.ResolveAsync(biz.Db, wanted);
            return Results.Json(found.ToDictionary(k => k.Key, k => new { body = k.Value.Body, width = k.Value.Width, height = k.Value.Height }), Web);
        }).RequireAuthorization("SignedIn");

        // { items: [{ key, name, catalog, catalogName, title, author, authorUrl, sourceUrl, licence: { code, name, url }, attribution }] }
        app.MapGet("/api/designs/{id:long}/credits", async (long id, Biz biz) =>
            Results.Json(new
            {
                items = (await CatalogLogic.CreditsAsync(biz, id)).Select(c => new
                {
                    key = c.Key, name = c.Name, catalog = c.Catalog, catalogName = c.CatalogName, catalogUrl = c.CatalogUrl, title = c.Title, author = c.Author, authorUrl = c.AuthorUrl, sourceUrl = c.SourceUrl,
                    licence = new { code = c.LicenceCode, name = c.LicenceName, url = c.LicenceUrl }, attribution = c.Attribution,
                }),
            }, Web))
            .RequireAuthorization("SignedIn");
    }

    private static object Shape(CatalogRow r) => new
    {
        id = r.Id,
        name = r.Catalog.Name,
        kinds = KindNames(r.Catalog.Kinds),
        caps = new
        {
            browse = r.Catalog.Caps.HasFlag(CatalogCaps.Browse),
            search = r.Catalog.Caps.HasFlag(CatalogCaps.Search),
            collections = r.Catalog.Caps.HasFlag(CatalogCaps.Collections),
            filters = r.Catalog.Caps.HasFlag(CatalogCaps.Filters),
            colour = r.Catalog.Caps.HasFlag(CatalogCaps.Colour),
            needsKey = r.Catalog.Caps.HasFlag(CatalogCaps.NeedsKey),
        },
        local = !r.External,
        external = r.External,
        hasPictures = r.HasPictures,
        provider = r.Catalog.Info.ProviderLink is { } link ? new { text = link.Text, url = link.Url } : null,
        licence = r.Catalog.Info.LicenceSummary,
        notice = r.Catalog.Info.Notice,
        description = r.Catalog.Info.Description,
        // the provider's rules ask for a line of links (author / provider) under every result
        linkedCredit = r.Catalog.Info.LinkedCredit,
        // the thumbnails come straight from the provider's image host (the browser loads them itself)
        hotlinked = r.Catalog.HotlinkHosts.Count > 0,
    };

    private static string[] KindNames(CatalogKinds kinds)
        => [.. Enum.GetValues<CatalogKinds>().Where(k => k != CatalogKinds.None && kinds.HasFlag(k)).Select(k => k.ToString().ToLowerInvariant())];

    private static CatalogKinds? ParseKind(string? kind)
        => Enum.TryParse<CatalogKinds>(kind, ignoreCase: true, out var parsed) && parsed != CatalogKinds.None && Enum.IsDefined(parsed) ? parsed : null;

    /// <summary>Turns what a catalogue says into an answer: a message with the status that fits (429 for a limit, 404, else 503 "not available"), never a stack trace.</summary>
    private static async Task<IResult> Run(HttpContext http, Func<Task<IResult>> action)
    {
        try
        {
            return await action();
        }
        catch (CatalogException ex)
        {
            if (ex.RetryAfterSeconds > 0)
            {
                http.Response.Headers.RetryAfter = ex.RetryAfterSeconds.ToString(CultureInfo.InvariantCulture);
            }

            var status = ex.Failure switch
            {
                CatalogFailure.Limit => StatusCodes.Status429TooManyRequests,
                CatalogFailure.NotFound => StatusCodes.Status404NotFound,
                _ => StatusCodes.Status503ServiceUnavailable,
            };
            return Results.Json(new { error = ex.Message, failure = ex.Failure.ToString().ToLowerInvariant() }, statusCode: status);
        }
        catch (BizException ex)
        {
            return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
        }
    }

    private sealed record ImportBody(string? ItemId, long? SpaceId, long? FolderId, long? DesignId, long? PreferSpace);
}
