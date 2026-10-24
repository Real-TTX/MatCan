using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using DesignThix.Core.Data;
using DesignThix.Logic;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Endpoints;

/// <summary>
/// The endpoints of the library and of the designer: the bytes of media and fonts (immutable for the browser when asked with the hash), the style sheet of all fonts,
/// the pickers' lists, and the JSON of designs and data list rows. Everything needs a signed-in person; the business layer checks the role again, and every
/// POST carries the antiforgery token as the header <c>RequestVerificationToken</c>.
/// </summary>
public static partial class LibraryEndpoints
{
    private const string Immutable = "private, max-age=31536000, immutable";
    private const string Revalidate = "private, no-cache";
    private const int MaxDesignBody = 3 * 1024 * 1024;
    private const int MaxRowsBody = 40 * 1024 * 1024;

    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    public static void MapLibraryEndpoints(this WebApplication app)
    {
        // ---------------------------------------------------------------------------------------- media and fonts

        app.MapGet("/media/{key}", async (string key, HttpContext http, Biz biz) =>
        {
            var known = http.Request.Headers.IfNoneMatch.ToString().Trim().Trim('"');
            if (known.StartsWith("W/", StringComparison.Ordinal))
            {
                known = known[2..].Trim('"');
            }

            var content = await AssetLogic.ContentAsync(biz, key, known.Length == 0 ? null : known);
            if (content is null)
            {
                return Results.NotFound();
            }

            var headers = http.Response.Headers;
            headers.ETag = $"\"{content.ContentHash}\"";
            headers.CacheControl = http.Request.Query.ContainsKey("v") ? Immutable : Revalidate;
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
        }).RequireAuthorization("SignedIn");

        app.MapGet("/fonts/{name}", async (string name, HttpContext http, Biz biz) =>
        {
            var match = FontFileRegex().Match(name);
            if (!match.Success)
            {
                return Results.NotFound();
            }

            var content = await FontLogic.ContentAsync(biz, long.Parse(match.Groups[1].Value));
            if (content is not { } font || !font.Hash.StartsWith(match.Groups[2].Value, StringComparison.OrdinalIgnoreCase) || font.Format != match.Groups[3].Value)
            {
                return Results.NotFound();
            }

            http.Response.Headers.ETag = $"\"{font.Hash}\"";
            http.Response.Headers.CacheControl = Immutable;
            http.Response.Headers.XContentTypeOptions = "nosniff";
            return Results.File(font.Bytes, "font/" + (font.Format == "otf" ? "otf" : font.Format));
        }).RequireAuthorization("SignedIn");

        app.MapGet("/fonts.css", async (HttpContext http, Biz biz) =>
        {
            var css = FontLogic.FontFaceCss(await FontLogic.AllAsync(biz));
            var etag = $"\"{AssetLogic.Sha256Hex(Encoding.UTF8.GetBytes(css))[..24]}\"";
            http.Response.Headers.ETag = etag;
            http.Response.Headers.CacheControl = Revalidate;
            return http.Request.Headers.IfNoneMatch.ToString() == etag
                ? Results.StatusCode(StatusCodes.Status304NotModified)
                : Results.Text(css, "text/css; charset=utf-8");
        }).RequireAuthorization("SignedIn");

        app.MapGet("/api/fonts", async (Biz biz) =>
            Results.Json((await FontLogic.AllAsync(biz)).Select(f => new { id = f.Id, family = f.Family, weight = f.Weight, style = f.Style, format = f.Format, url = f.Url, license = f.License, isBuiltIn = f.IsBuiltIn }), Web))
            .RequireAuthorization("SignedIn");

        app.MapGet("/api/assets", async (string? q, string? category, int? take, Biz biz) =>
            Results.Json((await AssetLogic.SearchAsync(biz, q, category, take ?? 60)).Select(a => new { key = a.Key, name = a.Name, category = a.Category, tags = a.Tags, url = a.Url, width = a.Width, height = a.Height, contentType = a.ContentType }), Web))
            .RequireAuthorization("SignedIn");

        // ---------------------------------------------------------------------------------------- designs

        app.MapGet("/designs/{id:long}/thumbnail.png", async (long id, HttpContext http, Biz biz) =>
        {
            var thumb = await DesignLogic.ThumbnailAsync(biz, id);
            if (thumb is not { } t)
            {
                return Results.NotFound();
            }

            http.Response.Headers.ETag = $"\"{t.Hash}\"";
            http.Response.Headers.CacheControl = http.Request.Query.ContainsKey("v") ? Immutable : Revalidate;
            return http.Request.Headers.IfNoneMatch.ToString().Trim('"') == t.Hash ? Results.StatusCode(StatusCodes.Status304NotModified) : Results.File(t.Bytes, "image/png");
        }).RequireAuthorization("SignedIn");

        app.MapGet("/api/designs/{id:long}", async (long id, Biz biz) =>
        {
            var design = await DesignLogic.LoadAsync(biz, id);
            if (design is null)
            {
                return Results.NotFound();
            }

            using var document = JsonDocument.Parse(design.DocumentJson);
            return Results.Json(new { id = design.Id, name = design.Name, revision = design.Revision, document = document.RootElement.Clone(), canEdit = design.CanEdit }, Web);
        }).RequireAuthorization("SignedIn");

        app.MapPost("/api/designs/{id:long}", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Guard(http, antiforgery, async () =>
        {
            if (http.Request.ContentLength > MaxDesignBody)
            {
                return Results.Json(new { error = "Das Dokument ist zu groß (höchstens 2 MB)." }, statusCode: StatusCodes.Status413PayloadTooLarge);
            }

            var body = await http.Request.ReadFromJsonAsync<DesignBody>(Web, http.RequestAborted);
            if (body is null || body.Document.ValueKind != JsonValueKind.Object)
            {
                return Results.Json(new { error = "Die Anfrage braucht revision und document." }, statusCode: StatusCodes.Status400BadRequest);
            }

            var saved = await DesignLogic.SaveDocumentAsync(biz, id, body.Revision, body.Document.GetRawText());
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
                return Results.Json(new { error = "Das Dokument ist zu groß (höchstens 2 MB)." }, statusCode: StatusCodes.Status413PayloadTooLarge);
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
                return Results.Json(new
                {
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

    private sealed record DesignBody(int Revision, JsonElement Document);

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
    private static async Task<IResult> Guard(HttpContext http, IAntiforgery antiforgery, Func<Task<IResult>> action)
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
        catch (RevisionConflictException ex)
        {
            return Results.Json(new { error = ex.Message, revision = ex.CurrentRevision }, statusCode: StatusCodes.Status409Conflict);
        }
        catch (JsonException)
        {
            return Results.Json(new { error = "Die Anfrage ist kein gültiges JSON." }, statusCode: StatusCodes.Status400BadRequest);
        }
    }

    [GeneratedRegex(@"^(\d{1,18})-([0-9a-fA-F]{6,64})\.(ttf|otf|woff2?)$")]
    private static partial Regex FontFileRegex();
}
