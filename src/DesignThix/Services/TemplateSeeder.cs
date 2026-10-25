using System.Reflection;
using System.Text.Json;
using DesignThix.Core.Documents;
using DesignThix.Data;
using DesignThix.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Services;

/// <summary>
/// Puts the built-in templates (docs/PLAN-CANVA.md section 5) into the database: the embedded files <c>Demo/templates/&lt;slug&gt;.json</c>, each
/// <c>{ name, category, description, document, sampleRows? }</c>, become designs marked as template. The slugs that were seeded are remembered as a JSON list in the setting
/// <see cref="Marker"/>: a template that is new in a later version is added to an existing database too, and a template a person deleted is never added again (its slug is in the list).
/// The Käsetheke template comes from the demo (<see cref="DemoSeeder"/>) and is not part of this list. Runs after <see cref="LibrarySeeder"/> and <see cref="DemoSeeder"/>.
/// </summary>
public static class TemplateSeeder
{
    public const string Marker = "Templates.Seeded";

    private const string ResourcePrefix = "DesignThix.Demo.templates.";

    /// <summary>The slugs of the embedded templates, in file name order.</summary>
    public static IReadOnlyList<string> Slugs()
        => [.. Assembly.GetExecutingAssembly().GetManifestResourceNames()
            .Where(n => n.StartsWith(ResourcePrefix, StringComparison.Ordinal) && n.EndsWith(".json", StringComparison.Ordinal))
            .Select(n => n[ResourcePrefix.Length..^".json".Length])
            .Order(StringComparer.Ordinal)];

    /// <summary>The text of an embedded template file (null when there is none of that slug).</summary>
    public static string? Read(string slug)
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
            return 0;
        }

        var added = 0;
        foreach (var slug in fresh)
        {
            var design = Create(slug, logger);
            if (design is not null)
            {
                db.Design.Add(design);
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
        if (added > 0)
        {
            logger.LogInformation("{Count} built-in templates were added.", added);
        }

        return added;
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
            return design;
        }
        catch (Exception ex) when (ex is JsonException or KeyNotFoundException or InvalidOperationException)
        {
            logger.LogWarning("The template {Slug} could not be read: {Message}", slug, ex.Message);
            return null;
        }
    }
}
