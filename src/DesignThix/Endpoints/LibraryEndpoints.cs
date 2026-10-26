using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using DesignThix.Core.Data;
using DesignThix.Logic;
using DesignThix.Services;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Endpoints;

/// <summary>
/// The endpoints of the library and of the designer: the bytes of media, fonts and thumbnails, the style sheet of the fonts, the pickers' lists, and the JSON of designs and data list rows.
/// Media, fonts and thumbnails are <b>capabilities</b>: their address carries a hash (<c>?v=</c>, in the name of a font) that only the APIs hand out after they checked the access, and an address with the hash
/// is served without a sign-in (the public pages need that), so these routes allow anonymous callers; without the hash a signed-in person gets what they may see and nothing else. Everything else needs a
/// signed-in person, and the business layer checks the access again. Every POST carries the antiforgery token as the header <c>RequestVerificationToken</c>.
/// </summary>
public static partial class LibraryEndpoints
{
    private const string Immutable = "private, max-age=31536000, immutable";
    private const string ImmutablePublic = "public, max-age=31536000, immutable";
    private const string Revalidate = "private, no-cache";
    private const int MaxDesignBody = 5 * 1024 * 1024;
    private const int MaxRowsBody = 40 * 1024 * 1024;

    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    public static void MapLibraryEndpoints(this WebApplication app)
    {
        // ---------------------------------------------------------------------------------------- media and fonts

        app.MapGet("/media/{key}", async (string key, HttpContext http, Biz biz, PublicRateLimiter limiter) =>
        {
            if (Probing(biz, limiter))
            {
                return TooMany(http);
            }

            var known = http.Request.Headers.IfNoneMatch.ToString().Trim().Trim('"');
            if (known.StartsWith("W/", StringComparison.Ordinal))
            {
                known = known[2..].Trim('"');
            }

            var content = await AssetLogic.ContentAsync(biz, key, known.Length == 0 ? null : known, http.Request.Query["v"].ToString());
            if (content is null)
            {
                Missed(biz, limiter);
                return biz.User.UserId is null ? Results.StatusCode(StatusCodes.Status401Unauthorized) : Results.NotFound();
            }

            var headers = http.Response.Headers;
            headers.ETag = $"\"{content.ContentHash}\"";
            headers.CacheControl = http.Request.Query.ContainsKey("v") ? (content.IsBuiltIn ? ImmutablePublic : Immutable) : Revalidate;
            if (content.Bytes is null)
            {
                return Results.StatusCode(StatusCodes.Status304NotModified);
            }

            // An SVG that is opened as a page of its own may run nothing and load nothing: the sanitiser is the first line, this the second.
            if (content.Extension == "svg")
            {
                headers.ContentSecurityPolicy = "default-src 'none'; style-src 'unsafe-inline'";
            }

            headers.XContentTypeOptions = "nosniff";
            var download = http.Request.Query.ContainsKey("download") ? $"{key}.{content.Extension}" : null;
            return Results.File(content.Bytes, content.ContentType, download);
        }).AllowAnonymous();

        app.MapGet("/fonts/{name}", async (string name, HttpContext http, Biz biz, PublicRateLimiter limiter) =>
        {
            if (Probing(biz, limiter))
            {
                return TooMany(http);
            }

            var match = FontFileRegex().Match(name);
            if (!match.Success)
            {
                Missed(biz, limiter);
                return Results.NotFound();
            }

            var content = await FontLogic.ContentAsync(biz, long.Parse(match.Groups[1].Value), match.Groups[2].Value);
            if (content is not { } font || font.Format != match.Groups[3].Value)
            {
                Missed(biz, limiter);
                return Results.NotFound();
            }

            http.Response.Headers.ETag = $"\"{font.Hash}\"";
            http.Response.Headers.CacheControl = Immutable;
            http.Response.Headers.XContentTypeOptions = "nosniff";
            return Results.File(font.Bytes, "font/" + (font.Format == "otf" ? "otf" : font.Format));
        }).AllowAnonymous();

        // ?design={id}: also the fonts of that design's area (the person must be allowed to view it)
        app.MapGet("/fonts.css", async (long? design, HttpContext http, Biz biz) =>
        {
            var css = FontLogic.FontFaceCss(await FontLogic.AllAsync(biz, design));
            var etag = $"\"{AssetLogic.Sha256Hex(Encoding.UTF8.GetBytes(css))[..24]}\"";
            http.Response.Headers.ETag = etag;
            http.Response.Headers.CacheControl = Revalidate;
            return http.Request.Headers.IfNoneMatch.ToString() == etag
                ? Results.StatusCode(StatusCodes.Status304NotModified)
                : Results.Text(css, "text/css; charset=utf-8");
        }).RequireAuthorization("SignedIn");

        app.MapGet("/api/fonts", async (long? design, Biz biz) =>
            Results.Json((await FontLogic.AllAsync(biz, design)).Select(f => new { id = f.Id, family = f.Family, weight = f.Weight, style = f.Style, format = f.Format, url = f.Url, license = f.License, isBuiltIn = f.IsBuiltIn, spaceId = f.SpaceId }), Web))
            .RequireAuthorization("SignedIn");

        // q, category ("uploads" finds the category Uploads, case does not matter), sort ("new" = newest first, else by name), take (at most 500)
        // space = the images of one area only
        app.MapGet("/api/assets", async (string? q, string? category, string? sort, int? take, long? space, Biz biz) =>
            Results.Json((await AssetLogic.SearchAsync(biz, q, category, take ?? 60, sort, space)).Select(a => new { key = a.Key, spaceId = a.SpaceId, isBuiltIn = a.IsBuiltIn, name = a.Name, category = a.Category, tags = a.Tags, url = a.Url, width = a.Width, height = a.Height, contentType = a.ContentType }), Web))
            .RequireAuthorization("SignedIn");

        // context = "design:{id}" | "datalist:{id}" | "output:{id}" (the item the images belong to; the person must be allowed to view it), keys = comma separated asset keys.
        // -> { "key": { key, url, hash, name, width, height, contentType } }: the address with its hash for the keys the item uses or the person may see; other keys are left out.
        app.MapGet("/api/assets/resolve", async (string? context, string? keys, Biz biz) =>
        {
            var parts = (context ?? "").Split(':', 2);
            var kind = parts.Length == 2 ? parts[0].ToLowerInvariant() switch
            {
                "design" => (Data.Entities.ItemKind?)Data.Entities.ItemKind.Design,
                "datalist" => Data.Entities.ItemKind.DataList,
                "output" => Data.Entities.ItemKind.OutputJob,
                _ => null,
            } : null;
            if (kind is null || !long.TryParse(parts[1], out var id))
            {
                return Results.Json(new { error = "context ist design:{id}, datalist:{id} oder output:{id}." }, statusCode: StatusCodes.Status400BadRequest);
            }

            var wanted = (keys ?? "").Split([',', ' ', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Take(500).ToList();
            var resolved = await AssetRefs.ResolveAsync(biz, kind.Value, id, wanted);
            return Results.Json(resolved.ToDictionary(p => p.Key, p => new { key = p.Value.Key, url = p.Value.Url, hash = p.Value.Hash, name = p.Value.Name, width = p.Value.Width, height = p.Value.Height, contentType = p.Value.ContentType }), Web);
        }).RequireAuthorization("SignedIn");

        // ---------------------------------------------------------------------------------------- designs

        app.MapGet("/designs/{id:long}/thumbnail.png", async (long id, HttpContext http, Biz biz, PublicRateLimiter limiter) =>
        {
            if (Probing(biz, limiter))
            {
                return TooMany(http);
            }

            var thumb = await DesignLogic.ThumbnailAsync(biz, id, http.Request.Query["v"].ToString());
            if (thumb is not { } t)
            {
                Missed(biz, limiter);
                return biz.User.UserId is null ? Results.StatusCode(StatusCodes.Status401Unauthorized) : Results.NotFound();
            }

            http.Response.Headers.ETag = $"\"{t.Hash}\"";
            http.Response.Headers.CacheControl = http.Request.Query.ContainsKey("v") ? Immutable : Revalidate;
            return http.Request.Headers.IfNoneMatch.ToString().Trim('"') == t.Hash ? Results.StatusCode(StatusCodes.Status304NotModified) : Results.File(t.Bytes, "image/png");
        }).AllowAnonymous();

        app.MapGet("/api/designs/{id:long}", async (long id, Biz biz) =>
        {
            var design = await DesignLogic.LoadAsync(biz, id);
            if (design is null)
            {
                return Results.NotFound();
            }

            using var document = JsonDocument.Parse(design.DocumentJson);
            return Results.Json(new { id = design.Id, name = design.Name, revision = design.Revision, document = document.RootElement.Clone(), canEdit = design.CanEdit, canManage = design.CanManage, spaceId = design.SpaceId, folderId = design.FolderId }, Web);
        }).RequireAuthorization("SignedIn");

        app.MapPost("/api/designs/{id:long}", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Guard(http, antiforgery, async () =>
        {
            if (http.Request.ContentLength > MaxDesignBody)
            {
                return Results.Json(new { error = "Das Dokument ist zu groß (höchstens 4 MB)." }, statusCode: StatusCodes.Status413PayloadTooLarge);
            }

            var body = await http.Request.ReadFromJsonAsync<DesignBody>(Web, http.RequestAborted);
            if (body is null || body.Document.ValueKind != JsonValueKind.Object)
            {
                return Results.Json(new { error = "Die Anfrage braucht revision und document." }, statusCode: StatusCodes.Status400BadRequest);
            }

            var saved = await DesignLogic.SaveDocumentAsync(biz, id, body.Revision, body.Document.GetRawText(), body.Autosave);
            using var document = JsonDocument.Parse(saved.DocumentJson);
            return Results.Json(new { revision = saved.Revision, document = document.RootElement.Clone(), warnings = saved.Warnings }, Web);
        })).RequireAuthorization("SignedIn");

        app.MapPost("/api/designs/{id:long}/rename", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Guard(http, antiforgery, async () =>
        {
            var body = await http.Request.ReadFromJsonAsync<RenameBody>(Web, http.RequestAborted);
            var name = await DesignLogic.RenameAsync(biz, id, body?.Name);
            return Results.Json(new { name }, Web);
        })).RequireAuthorization("SignedIn");

        // "Als Kopie speichern" after an edit conflict: the document the designer holds becomes a new design.
        app.MapPost("/api/designs/{id:long}/copy", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Guard(http, antiforgery, async () =>
        {
            if (http.Request.ContentLength > MaxDesignBody)
            {
                return Results.Json(new { error = "Das Dokument ist zu groß (höchstens 4 MB)." }, statusCode: StatusCodes.Status413PayloadTooLarge);
            }

            var body = await http.Request.ReadFromJsonAsync<CopyBody>(Web, http.RequestAborted);
            if (body is null || body.Document.ValueKind != JsonValueKind.Object)
            {
                return Results.Json(new { error = "Die Anfrage braucht document." }, statusCode: StatusCodes.Status400BadRequest);
            }

            var copy = await DesignLogic.CopyWithDocumentAsync(biz, id, body.Document.GetRawText());
            return Results.Json(new { id = copy.Id, name = copy.Name, revision = copy.Revision }, Web);
        })).RequireAuthorization("SignedIn");

        app.MapPost("/api/designs/{id:long}/thumbnail", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Guard(http, antiforgery, async () =>
        {
            if (http.Request.ContentLength > DesignLogic.MaxThumbnailBytes)
            {
                return Results.Json(new { error = "Das Vorschaubild ist größer als 2 MB." }, statusCode: StatusCodes.Status413PayloadTooLarge);
            }

            using var buffer = new MemoryStream();
            await http.Request.Body.CopyToAsync(buffer, http.RequestAborted);
            await DesignLogic.SaveThumbnailAsync(biz, id, buffer.ToArray());
            return Results.Json(new { hash = await DesignLogic.ThumbnailHashAsync(biz, id) }, Web);
        })).RequireAuthorization("SignedIn");

        // ---------------------------------------------------------------------------------------- data lists (the grid)

        // The lists a design can be previewed with (the designer's data selector): name and columns only, no rows.
        app.MapGet("/api/datalists", async (Biz biz) =>
            Results.Json((await DataListLogic.Query(biz).OrderBy(l => l.Name).ToListAsync()).Select(l => new
            {
                id = l.Id,
                name = l.Name,
                rowCount = l.RowCount,
                columns = ColumnDefs.Parse(l.ColumnsJson).Select(c => new { key = c.Key, label = c.Label, type = c.Type, decimals = c.Decimals, category = c.Category }),
            }), Web))
            .RequireAuthorization("SignedIn");

        app.MapGet("/api/datalists/{id:long}/rows", async (long id, Biz biz) =>
        {
            try
            {
                var grid = await DataListLogic.GridAsync(biz, id);
                // the addresses (with their hashes) of the images in the cells of the image columns: the person may view the list, so they may load what it uses
                var imageColumns = grid.Columns.Where(c => c.Type == "image").Select(c => c.Key).ToList();
                var cellKeys = grid.Rows.SelectMany(r => imageColumns.Select(c => r.Values.TryGetValue(c, out var v) ? v : "")).Where(v => !string.IsNullOrWhiteSpace(v)).Select(v => v.Trim().ToLowerInvariant()).Distinct().ToList();
                var assets = cellKeys.Count == 0 ? [] : await AssetRefs.ResolveAsync(biz, Data.Entities.ItemKind.DataList, id, cellKeys);
                return Results.Json(new
                {
                    assets = assets.ToDictionary(p => p.Key, p => p.Value.Url),
                    id = grid.Id,
                    name = grid.Name,
                    revision = grid.Revision,
                    canEdit = grid.CanEdit,
                    columns = grid.Columns.Select(c => new { key = c.Key, label = c.Label, type = c.Type, decimals = c.Decimals, category = c.Category }),
                    rows = grid.Rows.Select(r => new { id = r.Id, values = r.Values, copies = r.Copies, isActive = r.IsActive }),
                }, Web);
            }
            catch (BizException)
            {
                return Results.NotFound();
            }
        }).RequireAuthorization("SignedIn");

        app.MapPost("/api/datalists/{id:long}/rows", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Guard(http, antiforgery, async () =>
        {
            if (http.Request.ContentLength > MaxRowsBody)
            {
                return Results.Json(new { error = "Die Liste ist zu groß." }, statusCode: StatusCodes.Status413PayloadTooLarge);
            }

            var body = await http.Request.ReadFromJsonAsync<RowsBody>(Web, http.RequestAborted);
            if (body?.Rows is null)
            {
                return Results.Json(new { error = "Die Anfrage braucht revision und rows." }, statusCode: StatusCodes.Status400BadRequest);
            }

            var rows = body.Rows.Select(r => new GridRow(r.Id, (r.Values ?? []).ToDictionary(v => v.Key, v => TextOf(v.Value), StringComparer.Ordinal), r.Copies, r.IsActive)).ToList();
            var (revision, rowIds) = await DataListLogic.SaveRowsAsync(biz, id, body.Revision, rows);
            return Results.Json(new { revision, rowIds }, Web);
        })).RequireAuthorization("SignedIn");
    }

    /// <summary>What an address that is not signed in may miss per minute on the routes that serve by capability (the hash in the address) before it is turned away: a miss costs <see cref="MissCost"/>.</summary>
    internal const int ProbesPerMinute = 120;

    private const int MissCost = 4;

    /// <summary>A caller who is not signed in and has missed too often lately (guessing hashes) is turned away before any work is done. People who are signed in are never counted.</summary>
    private static bool Probing(Biz biz, PublicRateLimiter limiter) => biz.User.UserId is null && limiter.IsOver("probe:" + biz.User.IpAddress, ProbesPerMinute);

    /// <summary>A request of a caller who is not signed in found nothing: it costs.</summary>
    private static void Missed(Biz biz, PublicRateLimiter limiter)
    {
        if (biz.User.UserId is null)
        {
            limiter.Charge("probe:" + biz.User.IpAddress, MissCost);
        }
    }

    private static IResult TooMany(HttpContext http)
    {
        http.Response.Headers.RetryAfter = "60";
        return Results.StatusCode(StatusCodes.Status429TooManyRequests);
    }

    private sealed record DesignBody(int Revision, JsonElement Document, bool Autosave = false);

    private sealed record CopyBody(JsonElement Document);

    private sealed record RenameBody(string? Name);

    private sealed record RowBody(long? Id, Dictionary<string, JsonElement>? Values, int Copies = 1, bool IsActive = true);

    private sealed record RowsBody(int Revision, List<RowBody>? Rows);

    private static string TextOf(JsonElement value) => value.ValueKind switch
    {
        JsonValueKind.String => value.GetString() ?? "",
        JsonValueKind.Number or JsonValueKind.True or JsonValueKind.False => value.GetRawText(),
        _ => "",
    };

    /// <summary>Checks the antiforgery token and turns the rules of the business layer into answers: 400 with a message, 409 with the current revision.</summary>
    internal static async Task<IResult> Guard(HttpContext http, IAntiforgery antiforgery, Func<Task<IResult>> action)
    {
        try
        {
            await antiforgery.ValidateRequestAsync(http);
        }
        catch (AntiforgeryValidationException)
        {
            return Results.Json(new { error = "Die Sitzung ist abgelaufen. Bitte lade die Seite neu." }, statusCode: StatusCodes.Status400BadRequest);
        }

        try
        {
            return await action();
        }
        catch (BizException ex)
        {
            return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status400BadRequest);
        }
        catch (ForbiddenException ex)
        {
            return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
        }
        catch (NotFoundException ex)
        {
            return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status404NotFound);
        }
        catch (RevisionConflictException ex)
        {
            return Results.Json(new { error = ex.Message, revision = ex.CurrentRevision }, statusCode: StatusCodes.Status409Conflict);
        }
        catch (JsonException)
        {
            return Results.Json(new { error = "Die Anfrage ist kein gültiges JSON." }, statusCode: StatusCodes.Status400BadRequest);
        }
    }

    [GeneratedRegex(@"^(\d{1,18})-([0-9a-fA-F]{12,64})\.(ttf|otf|woff2?)$")]
    private static partial Regex FontFileRegex();
}
