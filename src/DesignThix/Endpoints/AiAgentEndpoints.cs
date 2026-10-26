using System.Text.Json;
using System.Text.Json.Nodes;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.Features;

namespace DesignThix.Endpoints;

/// <summary>
/// The endpoints of the design assistant (docs/PLAN-AI-DESIGN.md 3.1, 3.4, 3.6). Thin: they read the request, call <see cref="AiAgentLogic"/> (which checks Edit on the design and that a conversation belongs to
/// the person) and shape the JSON. Signed in is enough for the policy; every POST carries the antiforgery token (<see cref="LibraryEndpoints.Guard"/>). A message is <c>multipart/form-data</c>.
/// <list type="bullet">
/// <item><c>GET /api/ai/designs/{id}/agent</c>: is the panel offered, and why not.</item>
/// <item><c>POST /api/ai/designs/{id}/messages</c>: <c>text</c>, <c>scope</c> (JSON), <c>conversationId?</c>, <c>refs</c> (JSON), <c>files</c> (repeated), <c>model-{i}</c> (the copy for the model of file i).</item>
/// <item><c>POST /api/ai/designs/new</c>: the same plus <c>preset</c>, <c>width</c>, <c>height</c>, <c>unit</c>, <c>spaceId</c>, <c>folderId</c>: makes the design first.</item>
/// <item><c>GET /api/ai/designs/{id}/conversations</c>, <c>GET /api/ai/conversations/{id}</c>, <c>GET .../steps?after=</c>, <c>POST .../cancel</c>, <c>POST .../undo</c>, <c>POST .../delete</c>, <c>GET .../files/{name}</c>.</item>
/// <item><c>GET /api/ai/designs/{id}/agent/prompt</c>: the whole instruction without calling the model.</item>
/// <item><c>POST /api/ai/runs/{id}/render/{token}</c>: the picture of a page for <c>look</c> (the body is the JPEG or PNG; or <c>.../failed</c>).</item>
/// </list>
/// </summary>
public static class AiAgentEndpoints
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    /// <summary>All files of a message together: at most 60 MB of files and some room for the copies for the model and the fields.</summary>
    private const long MaxBody = 80L * 1024 * 1024;

    private const int ReadFilesUpTo = 20;

    public static void MapAiAgentEndpoints(this WebApplication app)
    {
        app.MapGet("/api/ai/designs/{id:long}/agent", async (long id, Biz biz) => Results.Json(await AiAgentLogic.AvailabilityAsync(biz, id), Web)).RequireAuthorization("SignedIn");

        app.MapPost("/api/ai/designs/{id:long}/messages", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Run(http, antiforgery, async () =>
        {
            var form = await ReadFormAsync(http);
            if (form is null)
            {
                return Results.Json(new { error = "Die Anfrage braucht Formulardaten (multipart/form-data)." }, statusCode: StatusCodes.Status400BadRequest);
            }

            var sent = await AiAgentLogic.SendAsync(biz, id, new AiAgentLogic.SendInput(
                form["text"].ToString(),
                AiScope.Parse(form["scope"].ToString()),
                long.TryParse(form["conversationId"].ToString(), out var cid) ? cid : null,
                ReadRefs(form["refs"].ToString()),
                await ReadFilesAsync(form, biz)));
            return Results.Json(Shape(sent), Web);
        })).RequireAuthorization("SignedIn");

        app.MapPost("/api/ai/designs/new", (HttpContext http, IAntiforgery antiforgery, Biz biz) => Run(http, antiforgery, async () =>
        {
            var form = await ReadFormAsync(http);
            if (form is null)
            {
                return Results.Json(new { error = "Die Anfrage braucht Formulardaten (multipart/form-data)." }, statusCode: StatusCodes.Status400BadRequest);
            }

            var started = await AiAgentLogic.StartNewAsync(biz, new AiAgentLogic.NewDesignInput(
                form["text"].ToString(),
                form["preset"].ToString(),
                Number(form["width"].ToString()),
                Number(form["height"].ToString()),
                form["unit"].ToString(),
                long.TryParse(form["spaceId"].ToString(), out var space) ? space : null,
                long.TryParse(form["folderId"].ToString(), out var folder) ? folder : null,
                ReadRefs(form["refs"].ToString()),
                await ReadFilesAsync(form, biz)));
            var shaped = Shape(started.Sent);
            return Results.Json(new { id = started.DesignId, url = started.Url, conversationId = shaped.ConversationId, runId = shaped.RunId, run = shaped.Run, files = shaped.Files }, Web);
        })).RequireAuthorization("SignedIn");

        app.MapGet("/api/ai/designs/{id:long}/conversations", async (long id, Biz biz) =>
            Results.Json((await AiAgentLogic.ConversationsAsync(biz, id)).Select(c => new { id = c.Id, title = c.Title, status = c.Status, runs = c.Runs, tokens = c.Tokens, updated = c.UpdateDate }), Web)).RequireAuthorization("SignedIn");

        app.MapGet("/api/ai/conversations/{id:long}", async (long id, Biz biz) =>
        {
            var c = await AiAgentLogic.ConversationAsync(biz, id);
            return Results.Json(new
            {
                id = c.Id,
                designId = c.DesignId,
                title = c.Title,
                status = c.Status,
                scope = JsonNode.Parse(c.Scope.ToJson()),
                tokens = c.Tokens,
                runs = c.Runs.Select(r => new { id = r.Id, number = r.Number, status = r.Status, error = r.Error, tokens = r.Tokens, start = r.StartDate, end = r.EndDate, changed = r.Changed, undone = r.Undone }),
                undoRun = c.Undo?.Run,
                undoOther = c.Undo?.Other ?? false,
            }, Web);
        }).RequireAuthorization("SignedIn");

        app.MapGet("/api/ai/conversations/{id:long}/steps", async (long id, long? after, Biz biz) =>
        {
            var page = await AiAgentLogic.StepsAsync(biz, id, after ?? 0);
            return Results.Json(new
            {
                status = page.Status,
                run = page.Run,
                runId = page.RunId,
                tokens = page.Tokens,
                undoRun = page.UndoRun,
                undoOther = page.UndoOther,
                partial = page.Partial,
                renderRequest = page.RenderRequest is { } r ? new { runId = r.RunId, token = r.Token, page = r.PageId, pageNumber = r.PageNumber, revision = r.Revision, maxWidth = r.MaxWidth } : null,
                steps = page.Steps.Select(s => new { id = s.Id, run = s.Run, kind = s.Kind, text = s.Text, at = s.At, data = s.Data }),
            }, Web);
        }).RequireAuthorization("SignedIn");

        app.MapPost("/api/ai/conversations/{id:long}/cancel", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Run(http, antiforgery, async () =>
            Results.Json(new { ok = true, stopped = await AiAgentLogic.CancelAsync(biz, id) }, Web))).RequireAuthorization("SignedIn");

        app.MapPost("/api/ai/conversations/{id:long}/undo", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Run(http, antiforgery, async () =>
        {
            var force = false;
            if (http.Request.HasJsonContentType())
            {
                var body = await http.Request.ReadFromJsonAsync<UndoBody>(Web, http.RequestAborted);
                force = body?.Force == true;
            }

            var done = await AiAgentLogic.UndoAsync(biz, id, force);
            return Results.Json(new { ok = true, message = done.Message, run = done.Run, runId = done.RunId, revision = done.Revision }, Web);
        })).RequireAuthorization("SignedIn");

        app.MapPost("/api/ai/conversations/{id:long}/delete", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Run(http, antiforgery, async () =>
        {
            await AiAgentLogic.DeleteAsync(biz, id);
            return Results.Json(new { ok = true }, Web);
        })).RequireAuthorization("SignedIn");

        app.MapGet("/api/ai/conversations/{id:long}/files/{name}", async (long id, string name, HttpContext http, Biz biz) =>
        {
            var picture = await AiAgentLogic.PictureAsync(biz, id, name);
            if (picture is null)
            {
                return Results.NotFound();
            }

            http.Response.Headers.CacheControl = "private, max-age=3600";
            return Results.File(picture.Value.Bytes, picture.Value.ContentType);
        }).RequireAuthorization("SignedIn");

        app.MapGet("/api/ai/designs/{id:long}/agent/prompt", async (long id, string? scope, Biz biz) =>
            Results.Json(new { text = await AiAgentLogic.PromptAsync(biz, id, string.IsNullOrWhiteSpace(scope) ? null : AiScope.Parse(scope)) }, Web)).RequireAuthorization("SignedIn");

        app.MapPost("/api/ai/runs/{id:long}/render/{token}", (long id, string token, HttpContext http, IAntiforgery antiforgery, Biz biz) => Run(http, antiforgery, async () =>
        {
            var limit = http.Features.Get<IHttpMaxRequestBodySizeFeature>();
            if (limit is { IsReadOnly: false })
            {
                limit.MaxRequestBodySize = 4 * 1024 * 1024;
            }

            byte[] bytes;
            try
            {
                bytes = await ReadBodyAsync(http, AiAttachmentLogic.MaxModelImageBytes);
            }
            catch (InvalidDataException)
            {
                return Results.Json(new { error = "Das Bild ist größer als 3 MB." }, statusCode: StatusCodes.Status413PayloadTooLarge);
            }

            var taken = await AiAgentLogic.RenderUploadAsync(biz, id, token, bytes);
            return taken ? Results.Json(new { ok = true }, Web) : Results.Json(new { error = "Dafür wartet niemand auf ein Bild." }, statusCode: StatusCodes.Status404NotFound);
        })).RequireAuthorization("SignedIn");

        app.MapPost("/api/ai/runs/{id:long}/render/{token}/failed", (long id, string token, HttpContext http, IAntiforgery antiforgery, Biz biz) => Run(http, antiforgery, async () =>
            await AiAgentLogic.RenderFailedAsync(biz, id, token) ? Results.Json(new { ok = true }, Web) : Results.Json(new { error = "Dafür wartet niemand auf ein Bild." }, statusCode: StatusCodes.Status404NotFound))).RequireAuthorization("SignedIn");
    }

    private sealed record UndoBody(bool Force);

    /// <summary>The guard of the other endpoints, plus the two answers of this one: a limit of the AI (429) and an undo that asks first (409).</summary>
    private static Task<IResult> Run(HttpContext http, IAntiforgery antiforgery, Func<Task<IResult>> action)
        => LibraryEndpoints.Guard(http, antiforgery, async () =>
        {
            try
            {
                return await action();
            }
            catch (AiLimitException ex)
            {
                return Results.Json(new { error = ex.Message, code = "limit" }, statusCode: StatusCodes.Status429TooManyRequests);
            }
            catch (AiChangedSinceException ex)
            {
                return Results.Json(new { error = ex.Message, changedSince = true, revision = ex.CurrentRevision }, statusCode: StatusCodes.Status409Conflict);
            }
        });

    private sealed record Chip(string Name, string Kind, string? AssetKey, string? Refused, string? RefKind, long? RefId);

    private sealed record SentJson(long ConversationId, long RunId, int Run, IEnumerable<Chip> Files);

    private static SentJson Shape(AiAgentLogic.Sent sent)
        => new(sent.ConversationId, sent.RunId, sent.RunNumber, sent.Files.Select(f => new Chip(f.Name, f.RefKind is not null ? "reference" : f.Kind, f.AssetKey, f.Refused, f.RefKind, f.RefId)));

    private static double? Number(string text) => double.TryParse(text, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var n) ? n : null;

    private static async Task<IFormCollection?> ReadFormAsync(HttpContext http)
    {
        if (!http.Request.HasFormContentType)
        {
            return null;
        }

        var limit = http.Features.Get<IHttpMaxRequestBodySizeFeature>();
        if (limit is { IsReadOnly: false })
        {
            limit.MaxRequestBodySize = MaxBody;
        }

        try
        {
            return await http.Request.ReadFormAsync(http.RequestAborted);
        }
        catch (Exception ex) when (ex is InvalidDataException or BadHttpRequestException or IOException)
        {
            throw new BizException("Die Dateien sind zusammen zu groß oder die Anfrage ist beschädigt (höchstens 60 MB Dateien je Nachricht).");
        }
    }

    private static List<IncomingRef> ReadRefs(string json)
    {
        var refs = new List<IncomingRef>();
        if (string.IsNullOrWhiteSpace(json))
        {
            return refs;
        }

        try
        {
            if (JsonNode.Parse(json) is JsonArray array)
            {
                foreach (var node in array.Take(AiAgentLogic.MaxRefs))
                {
                    if (node is JsonObject o && AiDocOps.Str(o["kind"]) is { Length: > 0 } kind && o["id"] is JsonValue id && long.TryParse(id.ToString().Trim('"'), out var number))
                    {
                        refs.Add(new IncomingRef(kind, number));
                    }
                }
            }
        }
        catch (JsonException)
        {
            // a broken list is no references
        }

        return refs;
    }

    /// <summary>The files of the form in their order, each with the copy for the model the browser drew (<c>model-{i}</c>). A file that is too large or past the limit is not read (the logic refuses it with a reason).</summary>
    private static async Task<List<IncomingFile>> ReadFilesAsync(IFormCollection form, Biz biz)
    {
        var settings = SettingLogic.Get<AiSettings>(biz, SettingStore.Ai);
        var limit = Math.Clamp(settings.AgentMaxFilesPerMessage, 1, ReadFilesUpTo);
        var result = new List<IncomingFile>();
        var files = form.Files.Where(f => f.Name == "files").ToList();
        for (var i = 0; i < files.Count && i < ReadFilesUpTo; i++)
        {
            var file = files[i];
            if (i >= limit || file.Length > AiAttachmentLogic.MaxFileBytes)
            {
                result.Add(new IncomingFile(file.FileName, [], null, file.Length));
                continue;
            }

            await using var stream = file.OpenReadStream();
            using var buffer = new MemoryStream();
            await stream.CopyToAsync(buffer);
            byte[]? copy = null;
            if (form.Files.GetFile($"model-{i}") is { Length: > 0 and <= AiAttachmentLogic.MaxModelImageBytes } model)
            {
                await using var modelStream = model.OpenReadStream();
                using var modelBuffer = new MemoryStream();
                await modelStream.CopyToAsync(modelBuffer);
                copy = modelBuffer.ToArray();
            }

            result.Add(new IncomingFile(file.FileName, buffer.ToArray(), copy));
        }

        return result;
    }

    /// <summary>The body of the request as bytes: a plain body (the image), or the first file of a form. Longer than the limit is <see cref="InvalidDataException"/>.</summary>
    private static async Task<byte[]> ReadBodyAsync(HttpContext http, int max)
    {
        Stream source;
        if (http.Request.HasFormContentType)
        {
            var form = await http.Request.ReadFormAsync(http.RequestAborted);
            var file = form.Files.FirstOrDefault() ?? throw new BizException("Das Bild fehlt.");
            if (file.Length > max)
            {
                throw new InvalidDataException();
            }

            source = file.OpenReadStream();
        }
        else
        {
            if (http.Request.ContentLength > max)
            {
                throw new InvalidDataException();
            }

            source = http.Request.Body;
        }

        await using (source)
        {
            using var buffer = new MemoryStream();
            var chunk = new byte[16 * 1024];
            int read;
            while ((read = await source.ReadAsync(chunk, http.RequestAborted)) > 0)
            {
                buffer.Write(chunk, 0, read);
                if (buffer.Length > max)
                {
                    throw new InvalidDataException();
                }
            }

            return buffer.ToArray();
        }
    }
}
