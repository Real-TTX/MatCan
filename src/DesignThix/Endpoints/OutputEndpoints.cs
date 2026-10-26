using System.Text.Json;
using DesignThix.Logic;
using Microsoft.AspNetCore.Antiforgery;

namespace DesignThix.Endpoints;

/// <summary>
/// The endpoints of the run page: the payload of a job (document, labels, sheet, fonts, media addresses), the payload of a single print, and the note that a job was
/// run. Everything needs a signed-in person (a viewer may run jobs); the business layer checks again, every POST carries the antiforgery token.
/// </summary>
public static class OutputEndpoints
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);
    private const int MaxAdhocBody = 2 * 1024 * 1024;

    public static void MapOutputEndpoints(this WebApplication app)
    {
        app.MapGet("/api/outputs/{id:long}/payload", async (long id, HttpContext http, Biz biz) =>
        {
            try
            {
                var payload = await OutputLogic.PayloadAsync(biz, id);
                http.Response.Headers.CacheControl = "private, no-cache";
                return Results.Json(Shape(payload), Web);
            }
            catch (BizException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status404NotFound);
            }
        }).RequireAuthorization("SignedIn");

        app.MapPost("/api/outputs/{id:long}/ran", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => LibraryEndpoints.Guard(http, antiforgery, async () =>
        {
            await OutputLogic.MarkRanAsync(biz, id);
            return Results.Json(new { ok = true }, Web);
        })).RequireAuthorization("SignedIn");

        app.MapPost("/api/outputs/adhoc", (HttpContext http, IAntiforgery antiforgery, Biz biz) => LibraryEndpoints.Guard(http, antiforgery, async () =>
        {
            if (http.Request.ContentLength > MaxAdhocBody)
            {
                return Results.Json(new { error = "Die Eingaben sind zu groß." }, statusCode: StatusCodes.Status413PayloadTooLarge);
            }

            var request = await http.Request.ReadFromJsonAsync<AdhocRequest>(Web, http.RequestAborted);
            if (request is null)
            {
                return Results.Json(new { error = "Die Anfrage braucht designId und values." }, statusCode: StatusCodes.Status400BadRequest);
            }

            return Results.Json(Shape(await OutputLogic.AdhocPayloadAsync(biz, request)), Web);
        })).RequireAuthorization("SignedIn");
    }

    /// <summary>The payload as the run page reads it: the document as an object, not as text.</summary>
    private static object Shape(OutputPayload p)
    {
        using var document = JsonDocument.Parse(p.DocumentJson);
        return new
        {
            id = p.Id,
            name = p.Name,
            designName = p.DesignName,
            mode = p.Mode,
            format = p.Format,
            dpi = p.Dpi,
            cropMarks = p.CropMarks,
            scale = p.Scale,
            startPosition = p.StartPosition,
            fileNamePattern = p.FileNamePattern,
            document = document.RootElement.Clone(),
            sheet = p.Sheet,
            labels = p.Labels.Select(l => new { rowId = l.RowId, copies = l.Copies, values = l.Values }),
            labelCount = p.LabelCount,
            pages = p.Pages,
            unitCount = p.UnitCount,
            fonts = p.Fonts,
            assets = p.Assets,
            // the bodies of the icons of catalogues the design uses (the run page has no /api/icons to ask: it may be a print of somebody who only runs jobs)
            icons = p.Icons ?? new Dictionary<string, IconView>(),
            warnings = p.Warnings,
        };
    }
}
