using System.Text.Json;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using Microsoft.AspNetCore.Antiforgery;

namespace DesignThix.Endpoints;

/// <summary>
/// The endpoints of the AI actions (data import, data fill, text suggestion) and of their proposals. Thin: they read the request, call the static logic (which checks the
/// role, the limits and the answer of the model) and shape the JSON. Signed in is enough for the policy; the logic lets designers and administrators only (a viewer gets 403); every POST carries the
/// antiforgery token. The answers never contain a secret; a proposal is what the CODE accepted, not what the model said.
/// </summary>
public static class AiEndpoints
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);
    private const int MaxBody = 400_000;

    public static void MapAiEndpoints(this WebApplication app)
    {
        // ---- data import ----
        app.MapPost("/api/ai/datalists/{id:long}/import", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<ImportBody>(http, antiforgery, async body =>
            Result(await AiDataLogic.ProposeImportAsync(biz, id, new AiDataLogic.ImportInput(body.Text, body.Hint), http.RequestAborted)))).RequireAuthorization("SignedIn");

        app.MapPost("/api/ai/datalists/{id:long}/import/prompt", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<ImportBody>(http, antiforgery, async body =>
            Results.Json(new { text = await AiDataLogic.ImportPromptAsync(biz, id, new AiDataLogic.ImportInput(body.Text, body.Hint)) }, Web))).RequireAuthorization("SignedIn");

        // ---- data fill ----
        app.MapPost("/api/ai/datalists/{id:long}/fill", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<FillBody>(http, antiforgery, async body =>
            Result(await AiDataLogic.ProposeFillAsync(biz, id, new AiDataLogic.FillInput(body.RowIds, body.Column, body.Context, body.Instruction), http.RequestAborted)))).RequireAuthorization("SignedIn");

        app.MapPost("/api/ai/datalists/{id:long}/fill/prompt", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<FillBody>(http, antiforgery, async body =>
            Results.Json(new { text = await AiDataLogic.FillPromptAsync(biz, id, new AiDataLogic.FillInput(body.RowIds, body.Column, body.Context, body.Instruction)) }, Web))).RequireAuthorization("SignedIn");

        // ---- the runs on a data list (the panel of the page) ----
        app.MapGet("/api/ai/datalists/{id:long}/runs", async (long id, Biz biz) =>
        {
            var lines = await AiLogic.RunsOfAsync(biz, nameof(DataList), id);
            return Results.Json(lines.Select(l => new
            {
                id = l.Id,
                action = l.Action.ToString(),
                actionLabel = UiKit.Labels.Of(l.Action),
                status = l.Status.ToString(),
                statusLabel = UiKit.Labels.Of(l.Status),
                date = l.StartDate,
                who = l.Who,
                tokens = l.Tokens,
                estimated = l.Estimated,
                changes = l.Changes,
                open = l.Open,
                error = l.Error,
                canUndo = l.Open > 0,
                canOpen = l.Status == AiRunStatus.Waiting,
            }), Web);
        }).RequireAuthorization("SignedIn");

        // ---- text suggestion ----
        app.MapPost("/api/ai/designs/{id:long}/suggest", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<SuggestBody>(http, antiforgery, async body =>
            Result(await AiTextLogic.SuggestAsync(biz, id, body.ToInput(), http.RequestAborted)))).RequireAuthorization("SignedIn");

        app.MapPost("/api/ai/designs/{id:long}/suggest/prompt", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<SuggestBody>(http, antiforgery, async body =>
            Results.Json(new { text = await AiTextLogic.PromptAsync(biz, id, body.ToInput()) }, Web))).RequireAuthorization("SignedIn");

        // ---- proposals and what they changed ----
        app.MapGet("/api/ai/runs/{id:long}/proposal", async (long id, Biz biz) =>
        {
            try
            {
                var (status, action, json) = await AiDataLogic.ProposalAsync(biz, id);
                using var document = JsonDocument.Parse(json);
                return Results.Json(new { runId = id, status = status.ToString(), action = action.ToString(), proposal = document.RootElement.Clone() }, Web);
            }
            catch (BizException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status404NotFound);
            }
        }).RequireAuthorization("SignedIn");

        app.MapPost("/api/ai/runs/{id:long}/apply", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => Post<ApplyBody>(http, antiforgery, async body =>
        {
            var applied = await AiDataLogic.ApplyAsync(biz, id, body.Include);
            return Results.Json(new { ok = true, runId = id, count = applied.Count, message = applied.Message, listId = applied.ListId }, Web);
        })).RequireAuthorization("SignedIn");

        app.MapPost("/api/ai/runs/{id:long}/discard", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => LibraryEndpoints.Guard(http, antiforgery, async () =>
        {
            await AiDataLogic.DiscardAsync(biz, id);
            return Results.Json(new { ok = true }, Web);
        })).RequireAuthorization("SignedIn");

        app.MapPost("/api/ai/runs/{id:long}/undo", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => LibraryEndpoints.Guard(http, antiforgery, async () =>
        {
            var message = await AiLogic.UndoAsync(biz, id);
            return Results.Json(new { ok = true, message }, Web);
        })).RequireAuthorization("SignedIn");
    }

    private sealed record ImportBody(string? Text, string? Hint);

    private sealed record FillBody(List<long>? RowIds, string? Column, List<string>? Context, string? Instruction);

    private sealed record ApplyBody(List<long>? Include);

    private sealed record FieldBody(string? Key, string? Label, string? Type, string? Sample);

    private sealed record SuggestBody(string? Text, string? Instruction, string? ElementName, double? Width, double? Height, string? Unit, List<FieldBody>? Fields)
    {
        public AiTextLogic.SuggestInput ToInput()
            => new(Text, Instruction, ElementName, Width, Height, Unit, Fields?.Select(f => new AiTextLogic.FieldInfo(f.Key, f.Label, f.Type, f.Sample)).ToList());
    }

    /// <summary>Checks the antiforgery token, reads the JSON body (limited) and runs the action; the rules of the business layer become 400, a stale proposal 409.</summary>
    private static Task<IResult> Post<T>(HttpContext http, IAntiforgery antiforgery, Func<T, Task<IResult>> action) where T : class
        => LibraryEndpoints.Guard(http, antiforgery, async () =>
        {
            if (http.Request.ContentLength > MaxBody)
            {
                return Results.Json(new { error = "Die Eingaben sind zu groß." }, statusCode: StatusCodes.Status413PayloadTooLarge);
            }

            var body = await http.Request.ReadFromJsonAsync<T>(Web, http.RequestAborted);
            return body is null ? Results.Json(new { error = "Die Anfrage ist leer." }, statusCode: StatusCodes.Status400BadRequest) : await action(body);
        });

    /// <summary>An answer of an action: the proposal the code accepted, or why there is none (422, with the run so the page can link to it).</summary>
    private static IResult Result(AiActionResult r)
    {
        if (!r.Ok)
        {
            return Results.Json(new { ok = false, runId = r.RunId, status = r.Status.ToString(), error = r.Error, code = r.Code, settingsHref = r.SettingsHref, tokens = r.Tokens, estimated = r.TokensEstimated },
                Web, statusCode: StatusCodes.Status422UnprocessableEntity);
        }

        using var document = JsonDocument.Parse(r.Json ?? "{}");
        return Results.Json(new { ok = true, runId = r.RunId, status = r.Status.ToString(), tokens = r.Tokens, estimated = r.TokensEstimated, proposal = document.RootElement.Clone() }, Web);
    }
}
