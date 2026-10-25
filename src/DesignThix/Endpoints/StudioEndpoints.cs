using System.Text.Json;
using DesignThix.Core.Documents;
using DesignThix.Logic;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.Features;

namespace DesignThix.Endpoints;

/// <summary>
/// The endpoints of the design tool around the editor (docs/PLAN-CANVA.md section 3): format tiles, templates, one-click creation, resizing, upload of images and fonts
/// (several files, paste), and the brand kit. Thin: the rules are in the business layer (<see cref="AssetLogic"/>, <see cref="FontLogic"/>, <see cref="DesignLogic"/>,
/// <see cref="BrandLogic"/>), which checks the role again; every POST carries the antiforgery token (<see cref="LibraryEndpoints.Guard"/>).
/// </summary>
public static class StudioEndpoints
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    /// <summary>The body of an upload request (all files together): below the limit of the form reader, which is 128 MB.</summary>
    private const long MaxUploadBody = 120L * 1024 * 1024;

    public static void MapStudioEndpoints(this WebApplication app)
    {
        // ---------------------------------------------------------------------------------------- formats and templates

        // [{ key, name, title, group, width, height, unit, icon, tile, custom }]: the tiles of the start page first (in order, the last one is "Eigene Größe", custom = true, no size), then the rest.
        app.MapGet("/api/formats", () =>
        {
            var tiles = FormatPresets.Tiles.Select(p => Shape(p, true));
            var custom = new { key = FormatPresets.CustomKey, name = "Eigene Größe", title = "Eigene Größe", group = "Eigene", width = (double?)null, height = (double?)null, unit = "mm", icon = "dt:scaling", tile = true, custom = true };
            var rest = FormatPresets.All.Where(p => !FormatPresets.IsTile(p.Key)).Select(p => Shape(p, false));
            return Results.Json(tiles.Cast<object>().Append(custom).Concat(rest), Web);
        }).RequireAuthorization("SignedIn");

        // [{ id, name, category, description, width, height, unit, size, thumbnailUrl }]: the designs marked as Vorlage.
        app.MapGet("/api/templates", async (Biz biz) =>
            Results.Json((await DesignLogic.TemplatesAsync(biz)).Select(t => new { id = t.Id, name = t.Name, category = t.Category, description = t.Description, width = t.Width, height = t.Height, unit = t.Unit, size = t.Size, thumbnailUrl = t.ThumbnailUrl }), Web))
            .RequireAuthorization("SignedIn");

        // ---------------------------------------------------------------------------------------- designs

        // { preset?: "business-card" | "custom", width?, height?, unit?: "mm"|"px", name? } -> { id, url }
        app.MapPost("/api/designs", (HttpContext http, IAntiforgery antiforgery, Biz biz) => LibraryEndpoints.Guard(http, antiforgery, async () =>
        {
            var body = await http.Request.ReadFromJsonAsync<CreateBody>(Web, http.RequestAborted) ?? new CreateBody(null, null, null, null, null);
            var design = await DesignLogic.CreateFromFormatAsync(biz, body.Preset, body.Width, body.Height, body.Unit, body.Name);
            return Results.Json(new { id = design.Id, url = DesignerUrl(design.Id) }, Web);
        })).RequireAuthorization("SignedIn");

        // -> { id, url }: a copy of the template as a new design
        app.MapPost("/api/designs/{id:long}/use-template", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => LibraryEndpoints.Guard(http, antiforgery, async () =>
        {
            var design = await DesignLogic.UseTemplateAsync(biz, id);
            return Results.Json(new { id = design.Id, url = DesignerUrl(design.Id) }, Web);
        })).RequireAuthorization("SignedIn");

        // -> { id, name, url }: a copy of the design (the name gets " (Kopie)"), for "Duplizieren" on the start page
        app.MapPost("/api/designs/{id:long}/duplicate", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => LibraryEndpoints.Guard(http, antiforgery, async () =>
        {
            var copy = await DesignLogic.DuplicateAsync(biz, id);
            return Results.Json(new { id = copy.Id, name = copy.Name, url = DesignerUrl(copy.Id) }, Web);
        })).RequireAuthorization("SignedIn");

        // -> { id }: deletes the design (it can no longer be opened; outputs that use it say so), for "Löschen" on the start page
        app.MapPost("/api/designs/{id:long}/delete", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => LibraryEndpoints.Guard(http, antiforgery, async () =>
        {
            await DesignLogic.DeleteAsync(biz, id);
            return Results.Json(new { id }, Web);
        })).RequireAuthorization("SignedIn");

        // { width, height, unit, scale } -> { revision, document, warnings }
        app.MapPost("/api/designs/{id:long}/resize", (long id, HttpContext http, IAntiforgery antiforgery, Biz biz) => LibraryEndpoints.Guard(http, antiforgery, async () =>
        {
            var body = await http.Request.ReadFromJsonAsync<ResizeBody>(Web, http.RequestAborted);
            if (body is null)
            {
                return Results.Json(new { error = "Die Anfrage braucht width, height, unit und scale." }, statusCode: StatusCodes.Status400BadRequest);
            }

            var saved = await DesignLogic.ResizeAsync(biz, id, body.Width, body.Height, body.Unit, body.Scale);
            using var document = JsonDocument.Parse(saved.DocumentJson);
            return Results.Json(new { revision = saved.Revision, document = document.RootElement.Clone(), warnings = saved.Warnings }, Web);
        })).RequireAuthorization("SignedIn");

        // ---------------------------------------------------------------------------------------- uploads

        // multipart/form-data: files (several), category? -> { uploaded: [{ key, name, url, width, height, contentType, fileName, cleaned }], errors: [{ fileName, error }] }
        app.MapPost("/api/assets/upload", (HttpContext http, IAntiforgery antiforgery, Biz biz) => LibraryEndpoints.Guard(http, antiforgery, async () =>
        {
            AssetLogic.RequireUploader(biz);
            var read = await ReadFilesAsync(http, AssetLogic.MaxUploadFileBytes, AssetLogic.MaxUploadFiles);
            if (read.Failure is not null)
            {
                return read.Failure;
            }

            var category = http.Request.Form["category"].ToString();
            var uploaded = new List<object>();
            var errors = new List<UploadError>();
            foreach (var file in read.Files)
            {
                if (file.Error is not null)
                {
                    errors.Add(new UploadError(file.Name, file.Error));
                    continue;
                }

                var result = await AssetLogic.UploadAsync(biz, file.Name, file.Bytes!, category);
                if (result.Asset is not { } asset)
                {
                    errors.Add(new UploadError(file.Name, result.Error));
                    continue;
                }

                uploaded.Add(new { key = asset.Key, name = asset.Name, url = asset.Url, width = asset.Width, height = asset.Height, contentType = asset.ContentType, fileName = file.Name, cleaned = result.Cleaned });
            }

            return Answer(uploaded, errors);
        })).RequireAuthorization("SignedIn");

        // multipart/form-data: files (several) -> { uploaded: [{ id, family, weight, style, format, url, license, isBuiltIn, fileName }], errors: [{ fileName, error }] }
        app.MapPost("/api/fonts/upload", (HttpContext http, IAntiforgery antiforgery, Biz biz) => LibraryEndpoints.Guard(http, antiforgery, async () =>
        {
            AssetLogic.RequireUploader(biz);
            var read = await ReadFilesAsync(http, FontLogic.MaxFontBytes, AssetLogic.MaxUploadFiles);
            if (read.Failure is not null)
            {
                return read.Failure;
            }

            var uploaded = new List<object>();
            var errors = new List<UploadError>();
            foreach (var file in read.Files)
            {
                if (file.Error is not null)
                {
                    errors.Add(new UploadError(file.Name, file.Error));
                    continue;
                }

                var result = await FontLogic.UploadAsync(biz, file.Name, file.Bytes!, http.Request.Form["license"].ToString());
                if (result.Font is not { } font)
                {
                    errors.Add(new UploadError(file.Name, result.Error));
                    continue;
                }

                uploaded.Add(new { id = font.Id, family = font.Family, weight = font.Weight, style = font.Style, format = font.Format, url = font.Url, license = font.License, isBuiltIn = font.IsBuiltIn, fileName = file.Name });
            }

            return Answer(uploaded, errors);
        })).RequireAuthorization("SignedIn");

        // ---------------------------------------------------------------------------------------- brand kit

        // { colors: ["#1fb3d6"], fonts: { heading, subheading, body }, logos: ["key"], logoAssets: [{ key, name, url, width, height, contentType }] }
        app.MapGet("/api/brand", async (Biz biz) => Results.Json(Shape(await BrandLogic.GetAsync(biz)), Web)).RequireAuthorization("SignedIn");

        app.MapPost("/api/brand", (HttpContext http, IAntiforgery antiforgery, Biz biz) => LibraryEndpoints.Guard(http, antiforgery, async () =>
        {
            var body = await http.Request.ReadFromJsonAsync<BrandKit>(Web, http.RequestAborted);
            if (body is null)
            {
                return Results.Json(new { error = "Die Anfrage braucht colors, fonts und logos." }, statusCode: StatusCodes.Status400BadRequest);
            }

            return Results.Json(Shape(await BrandLogic.SaveAsync(biz, body)), Web);
        })).RequireAuthorization("SignedIn");
    }

    // ------------------------------------------------------------------------------------------------ shapes

    private static object Shape(FormatPreset p, bool tile)
        => new { key = p.Key, name = p.Name, title = p.ShortName, group = p.Group, width = (double?)p.Width, height = (double?)p.Height, unit = p.Unit, icon = p.Icon, tile, custom = false };

    private static object Shape(BrandView view) => new
    {
        colors = view.Kit.Colors,
        fonts = new { heading = view.Kit.Fonts.Heading, subheading = view.Kit.Fonts.Subheading, body = view.Kit.Fonts.Body },
        logos = view.Kit.Logos,
        logoAssets = view.LogoAssets.Select(a => new { key = a.Key, name = a.Name, url = a.Url, width = a.Width, height = a.Height, contentType = a.ContentType }),
    };

    private static string DesignerUrl(long id) => $"/Designs/{id}/Designer";

    private static IResult Answer(List<object> uploaded, List<UploadError> errors)
        => uploaded.Count > 0
            ? Results.Json(new { uploaded, errors }, Web)
            : Results.Json(new { uploaded, errors, error = errors.Count > 0 ? errors[0].Error : "Es wurde keine Datei gesendet." }, Web, statusCode: StatusCodes.Status400BadRequest);

    // ------------------------------------------------------------------------------------------------ reading the files of a request

    private sealed record UploadError(string FileName, string? Error);

    private sealed record UploadedFile(string Name, byte[]? Bytes, string? Error);

    private sealed record UploadRead(IReadOnlyList<UploadedFile> Files, IResult? Failure);

    /// <summary>
    /// The files of a multipart request, each read into memory unless it is too large (that file is reported, the others still go through). More than <paramref name="maxFiles"/>
    /// files, no files, or a body that is too large end the request with a message.
    /// </summary>
    private static async Task<UploadRead> ReadFilesAsync(HttpContext http, long maxFileBytes, int maxFiles)
    {
        if (!http.Request.HasFormContentType)
        {
            return new UploadRead([], Results.Json(new { error = "Die Anfrage braucht Dateien (multipart/form-data)." }, statusCode: StatusCodes.Status400BadRequest));
        }

        var limit = http.Features.Get<IHttpMaxRequestBodySizeFeature>();
        if (limit is { IsReadOnly: false })
        {
            limit.MaxRequestBodySize = MaxUploadBody;
        }

        IFormCollection form;
        try
        {
            form = await http.Request.ReadFormAsync(http.RequestAborted);
        }
        catch (Exception ex) when (ex is InvalidDataException or BadHttpRequestException or IOException)
        {
            return new UploadRead([], Results.Json(new { error = "Die Dateien sind zusammen zu groß oder die Anfrage ist beschädigt." }, statusCode: StatusCodes.Status413PayloadTooLarge));
        }

        var files = form.Files;
        if (files.Count == 0)
        {
            return new UploadRead([], Results.Json(new { error = "Es wurde keine Datei gesendet." }, statusCode: StatusCodes.Status400BadRequest));
        }

        if (files.Count > maxFiles)
        {
            return new UploadRead([], Results.Json(new { error = $"Es sind höchstens {maxFiles} Dateien auf einmal erlaubt." }, statusCode: StatusCodes.Status400BadRequest));
        }

        var list = new List<UploadedFile>();
        foreach (var file in files)
        {
            var name = Path.GetFileName(file.FileName ?? "");
            if (file.Length > maxFileBytes)
            {
                list.Add(new UploadedFile(name, null, $"Die Datei ist zu groß (höchstens {Services.Fmt.FileSize(maxFileBytes)})."));
                continue;
            }

            await using var stream = file.OpenReadStream();
            using var buffer = new MemoryStream();
            await stream.CopyToAsync(buffer, http.RequestAborted);
            list.Add(new UploadedFile(name, buffer.ToArray(), null));
        }

        return new UploadRead(list, null);
    }

    private sealed record CreateBody(string? Preset, double? Width, double? Height, string? Unit, string? Name);

    private sealed record ResizeBody(double Width, double Height, string? Unit, bool Scale);
}
