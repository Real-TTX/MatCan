using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using MatCan.Core.Documents;
using MatCan.Data;
using MatCan.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace MatCan.Services;

/// <summary>
/// Puts the built-in templates (docs/PLAN-CANVA.md section 5) into the database: the embedded files <c>Demo/templates/&lt;slug&gt;.json</c>, each
/// <c>{ name, category, description, document, sampleRows? }</c>, become designs marked as template. The slugs that were seeded are remembered as a JSON list in the setting
/// <see cref="Marker"/>: a template that is new in a later version is added to an existing database too, and a template a person deleted is never added again (its slug is in the list).
/// The Käsetheke template comes from the demo (<see cref="DemoSeeder"/>) and is not part of this list. Runs after <see cref="LibrarySeeder"/> and <see cref="DemoSeeder"/>.
/// The metadata of plan 6 (family, variant, occasion, tags, format, order: <see cref="TemplateInfo"/>) is owned by the files: every start writes it again to the system templates made from them
/// (found by <c>TemplateKey</c>, a template that was seeded before the key existed by its name), so a corrected tag or a new occasion reaches an existing database.
/// </summary>
public static class TemplateSeeder
{
    public const string Marker = "Templates.Seeded";

    /// <summary>The setting that remembers, per slug, the hash of the embedded file as last seeded or refreshed and the revision the design had then (see <see cref="RefreshAsync"/>).</summary>
    public const string FilesMarker = "Templates.Files";

    /// <summary>Tests only: replaces the text of an embedded file (to simulate a newer version of the app).</summary>
    public static Func<string, string?>? ReadOverride { get; set; }

    /// <summary>What is known of a built-in template since it was seeded: <c>H</c> = hash of its file, <c>R</c> = the revision of the design then (-1 = edited by a person: never refreshed).</summary>
    public sealed record FileState(string H, int R);

    private const string ResourcePrefix = "MatCan.Demo.templates.";

    /// <summary>What a template file says besides its document: the name, category and description of the design and the metadata of the gallery.</summary>
    public sealed record TemplateInfo(string Slug, string Name, string? Category, string? Description, string? Family, string? FamilyName, string? Variant, string? Occasion, string? Tags, string? Format, int Order);

    /// <summary>The metadata of the embedded template file (null when there is none or it cannot be read). Values that do not fit the rules (an occasion that is not in the list, a bad slug) are dropped.</summary>
    public static TemplateInfo? ReadInfo(string slug)
    {
        var text = Read(slug);
        if (text is null)
        {
            return null;
        }

        try
        {
            using var file = JsonDocument.Parse(text);
            return ReadInfo(slug, file.RootElement, root => root);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>Reads the info from a file root (the template files) or from its <c>design</c> object (the demo): <paramref name="select"/> picks the object that holds the properties.</summary>
    public static TemplateInfo? ReadInfo(string slug, JsonElement root, Func<JsonElement, JsonElement> select)
    {
        var o = select(root);
        string? Text(string name) => o.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
        var name = Text("name");
        if (string.IsNullOrWhiteSpace(name))
        {
            return null;
        }

        var family = Text("family");
        var tags = o.TryGetProperty("tags", out var list) && list.ValueKind == JsonValueKind.Array ? list.EnumerateArray().Where(t => t.ValueKind == JsonValueKind.String).Select(t => t.GetString()) : null;
        var order = o.TryGetProperty("number", out var n) && n.ValueKind == JsonValueKind.Number && n.TryGetInt32(out var number) ? number : 0;
        return new TemplateInfo(
            slug,
            name,
            Text("category"),
            Text("description"),
            TemplateMeta.IsSlug(family) ? family : null,
            Clip(Text("familyName"), 120),
            Clip(Text("variant"), 60),
            TemplateMeta.OccasionOf(Text("occasion")),
            TemplateMeta.JoinTags(tags),
            FormatPresets.Find(Text("formatKey"))?.Key,
            order);
    }

    private static string? Clip(string? text, int max)
    {
        var clean = text?.Trim();
        return string.IsNullOrEmpty(clean) ? null : clean.Length > max ? clean[..max] : clean;
    }

    /// <summary>Writes the metadata of a template file to a design (not its name, category, description or document: a person may have changed those).</summary>
    private static bool Apply(Design design, TemplateInfo info)
    {
        var changed = false;
        void Set<T>(T current, T wanted, Action<T> write)
        {
            if (!EqualityComparer<T>.Default.Equals(current, wanted))
            {
                write(wanted);
                changed = true;
            }
        }

        Set(design.TemplateKey, info.Slug, v => design.TemplateKey = v);
        Set(design.TemplateFamily, info.Family, v => design.TemplateFamily = v);
        Set(design.TemplateFamilyName, info.FamilyName, v => design.TemplateFamilyName = v);
        Set(design.TemplateVariant, info.Variant, v => design.TemplateVariant = v);
        Set(design.TemplateOccasion, info.Occasion, v => design.TemplateOccasion = v);
        Set(design.TemplateTags, info.Tags, v => design.TemplateTags = v);
        Set(design.TemplateFormat, info.Format, v => design.TemplateFormat = v);
        Set(design.TemplateOrder, info.Order, v => design.TemplateOrder = v);
        return changed;
    }

    private static string FileHash(string slug) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(Read(slug) ?? "")))[..24];

    private static async Task<Dictionary<string, FileState>> LoadStatesAsync(DtDbContext db, CancellationToken ct)
    {
        var value = await db.Setting.Where(s => s.Key == FilesMarker).Select(s => s.Value).FirstOrDefaultAsync(ct);
        try
        {
            return value is null ? [] : JsonSerializer.Deserialize<Dictionary<string, FileState>>(value) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private static async Task SaveStatesAsync(DtDbContext db, Dictionary<string, FileState> states, CancellationToken ct)
    {
        var value = JsonSerializer.Serialize(states);
        var setting = await db.Setting.FirstOrDefaultAsync(s => s.Key == FilesMarker, ct);
        if (setting is null)
        {
            db.Setting.Add(new Setting { Key = FilesMarker, Value = value });
        }
        else if (setting.Value != value)
        {
            setting.Value = value;
        }

        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Brings a newer version of a built-in template to a database that has it already. Cheap at start-up: the hash of every embedded file is compared with the one in the setting <see cref="FilesMarker"/>
    /// (no document is read from the database for a file that did not change). For a changed file the design is looked at: it is replaced (the document, a new revision with the note "Vorlage aktualisiert",
    /// the saved picture dropped) only when nobody changed it since it was seeded: its revision is still the one recorded then (a database from before this rule has no record: revision 1 counts).
    /// A template that was edited is marked (<c>R = -1</c>) and never touched again; one that was deleted is not found (soft delete) and stays deleted. Returns how many were replaced.
    /// </summary>
    public static async Task<int> RefreshAsync(DtDbContext db, IReadOnlyCollection<string> seeded, ILogger logger, CancellationToken ct = default)
    {
        var states = await LoadStatesAsync(db, ct);
        var pending = new List<(string Slug, string Hash)>();
        foreach (var slug in Slugs().Where(s => seeded.Contains(s, StringComparer.Ordinal)))
        {
            var hash = FileHash(slug);
            if (!states.TryGetValue(slug, out var state) || state.H != hash)
            {
                pending.Add((slug, hash));
            }
        }

        if (pending.Count == 0)
        {
            return 0;
        }

        var keys = pending.Select(p => p.Slug).ToList();
        var designs = await db.Design.Where(d => d.SpaceId == null && d.IsTemplate && d.TemplateKey != null && keys.Contains(d.TemplateKey)).ToListAsync(ct);
        var replaced = 0;
        foreach (var (slug, hash) in pending)
        {
            var design = designs.FirstOrDefault(d => d.TemplateKey == slug);
            if (design is null)
            {
                // deleted (or never seeded under this key): nothing to refresh, but remember the file so that the check is not repeated
                states[slug] = new FileState(hash, -1);
                continue;
            }

            var known = states.TryGetValue(slug, out var before);
            var untouched = known ? before!.R >= 0 && design.Revision == before.R : design.Revision == 1;
            if (!untouched)
            {
                states[slug] = new FileState(hash, -1);
                continue;
            }

            try
            {
                using var file = JsonDocument.Parse(Read(slug)!);
                var check = DocumentValidator.Validate(file.RootElement.GetProperty("document").GetRawText());
                if (!check.Ok || check.Document is null || check.Json is null)
                {
                    logger.LogWarning("The template {Slug} is not valid: {Error}", slug, check.Error);
                    continue;
                }

                var current = DocumentValidator.Validate(design.DocumentJson).Json;
                if (current != check.Json)
                {
                    design.DocumentJson = check.Json;
                    design.Revision++;
                    design.Width = check.Document.Width;
                    design.Height = check.Document.Height;
                    design.Unit = check.Document.Unit;
                    design.ThumbnailPng = null;
                    design.ThumbnailHash = null;
                    design.Revisions.Add(new DesignRevision { Revision = design.Revision, DocumentJson = check.Json, Note = "Vorlage aktualisiert" });
                    replaced++;
                }

                states[slug] = new FileState(hash, design.Revision);
            }
            catch (Exception ex) when (ex is JsonException or KeyNotFoundException or InvalidOperationException)
            {
                logger.LogWarning("The template {Slug} could not be refreshed: {Message}", slug, ex.Message);
            }
        }

        await db.SaveChangesAsync(ct);
        await SaveStatesAsync(db, states, ct);
        if (replaced > 0)
        {
            logger.LogInformation("{Count} built-in templates were updated to the version of the app.", replaced);
        }

        return replaced;
    }

    /// <summary>The slugs of the embedded templates, in file name order.</summary>
    public static IReadOnlyList<string> Slugs()
        => [.. Assembly.GetExecutingAssembly().GetManifestResourceNames()
            .Where(n => n.StartsWith(ResourcePrefix, StringComparison.Ordinal) && n.EndsWith(".json", StringComparison.Ordinal))
            .Select(n => n[ResourcePrefix.Length..^".json".Length])
            .Order(StringComparer.Ordinal)];

    /// <summary>The text of an embedded template file (null when there is none of that slug).</summary>
    public static string? Read(string slug)
    {
        if (ReadOverride is { } over)
        {
            return over(slug) ?? ReadResource(slug);
        }

        return ReadResource(slug);
    }

    private static string? ReadResource(string slug)
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(ResourcePrefix + slug + ".json");
        if (stream is null)
        {
            return null;
        }

        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }

    /// <summary>Adds the templates that were never seeded into this database. Returns how many were added.</summary>
    public static async Task<int> SeedAsync(IServiceProvider services, ILogger logger, CancellationToken ct = default)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DtDbContext>();
        return await SeedAsync(db, logger, ct);
    }

    public static async Task<int> SeedAsync(DtDbContext db, ILogger logger, CancellationToken ct = default)
    {
        var marker = await db.Setting.FirstOrDefaultAsync(s => s.Key == Marker, ct);
        var seeded = new List<string>();
        if (marker is not null)
        {
            try
            {
                seeded = JsonSerializer.Deserialize<List<string>>(marker.Value) ?? [];
            }
            catch (JsonException)
            {
                seeded = [];
            }
        }

        var fresh = Slugs().Where(s => !seeded.Contains(s, StringComparer.Ordinal)).ToList();
        if (fresh.Count == 0 && marker is not null)
        {
            await SyncMetadataAsync(db, ct);
            await RefreshAsync(db, seeded, logger, ct);
            return 0;
        }

        var clock = System.Diagnostics.Stopwatch.StartNew();
        var states = await LoadStatesAsync(db, ct);
        var added = 0;
        foreach (var slug in fresh)
        {
            var design = Create(slug, logger);
            if (design is not null)
            {
                db.Design.Add(design);
                states[slug] = new FileState(FileHash(slug), 1);
                added++;
            }

            // A file that cannot be read is remembered too: it would fail at every start, and the template is a nice-to-have.
            seeded.Add(slug);
        }

        var value = JsonSerializer.Serialize(seeded);
        if (marker is null)
        {
            db.Setting.Add(new Setting { Key = Marker, Value = value });
        }
        else
        {
            marker.Value = value;
        }

        await db.SaveChangesAsync(ct);
        await SaveStatesAsync(db, states, ct);
        await SyncMetadataAsync(db, ct);
        await RefreshAsync(db, seeded, logger, ct);
        if (added > 0)
        {
            logger.LogInformation("{Count} built-in templates were added in {Ms} ms.", added, clock.ElapsedMilliseconds);
        }

        return added;
    }

    /// <summary>
    /// Gives the system templates the metadata of their files (see the class description). The demo template is matched by its name (its key is <c>kaesetheke</c>). A design that is no system template
    /// (it belongs to an area) is never touched; one that is not found is skipped.
    /// </summary>
    public static async Task SyncMetadataAsync(DtDbContext db, CancellationToken ct = default)
    {
        var infos = Slugs().Select(ReadInfo).OfType<TemplateInfo>().ToList();
        if (DemoSeeder.Info() is { } demo)
        {
            infos.Add(demo);
        }

        var system = await db.Design.Where(d => d.SpaceId == null && d.IsTemplate).ToListAsync(ct);
        var changed = false;
        foreach (var info in infos)
        {
            var design = system.FirstOrDefault(d => d.TemplateKey == info.Slug) ?? system.FirstOrDefault(d => d.TemplateKey == null && d.Name == info.Name);
            if (design is not null && Apply(design, info))
            {
                changed = true;
            }
        }

        if (changed)
        {
            await db.SaveChangesAsync(ct);
        }
    }

    private static Design? Create(string slug, ILogger logger)
    {
        var text = Read(slug);
        if (text is null)
        {
            return null;
        }

        try
        {
            using var file = JsonDocument.Parse(text);
            var root = file.RootElement;
            var check = DocumentValidator.Validate(root.GetProperty("document").GetRawText());
            if (!check.Ok || check.Document is null || check.Json is null)
            {
                logger.LogWarning("The template {Slug} is not valid: {Error}", slug, check.Error);
                return null;
            }

            var design = new Design
            {
                Name = root.GetProperty("name").GetString() ?? slug,
                Category = root.TryGetProperty("category", out var category) ? category.GetString() : null,
                Description = root.TryGetProperty("description", out var description) ? description.GetString() : null,
                IsTemplate = true,
                DocumentJson = check.Json,
                Revision = 1,
                Width = check.Document.Width,
                Height = check.Document.Height,
                Unit = check.Document.Unit,
            };
            design.Revisions.Add(new DesignRevision { Revision = 1, DocumentJson = check.Json });
            if (ReadInfo(slug) is { } info)
            {
                Apply(design, info);
            }

            return design;
        }
        catch (Exception ex) when (ex is JsonException or KeyNotFoundException or InvalidOperationException)
        {
            logger.LogWarning("The template {Slug} could not be read: {Message}", slug, ex.Message);
            return null;
        }
    }
}
