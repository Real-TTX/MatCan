using System.Text.Json;
using DesignThix.Core.Documents;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.Services;
using DesignThix.Tests.Core;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace DesignThix.Tests.Integration;

/// <summary>
/// The built-in templates (<c>src/DesignThix/Demo/templates/*.json</c>, docs/PLAN-CANVA.md section 5): the files themselves (valid, already normalised, only what the app ships) and their seeding
/// (once per database, a template that is new in a later version is added, a deleted one stays deleted), plus the data logic of the start page (search, recent designs, featured
/// templates). The file tests need no database; the rest runs when DESIGNTHIX_TEST_DB names a server.
/// </summary>
[Collection("app")]
public sealed class TemplateTests(AppTests.AppFactory factory) : PlatformTestBase(factory)
{
    private static string Unique(string prefix) => prefix + Guid.NewGuid().ToString("N")[..8];

    // ------------------------------------------------------------------------------------------------ the files

    private static HashSet<string> BuiltInKeys() => JsonDocument.Parse(File.ReadAllText(Path.Combine(RepoFiles.WwwRoot(), "builtin", "builtin.json"))).RootElement.EnumerateArray()
        .Select(a => a.GetProperty("key").GetString()!).ToHashSet(StringComparer.OrdinalIgnoreCase);

    private static HashSet<string> FontFamilies() => JsonDocument.Parse(File.ReadAllText(Path.Combine(RepoFiles.WwwRoot(), "fonts", "fonts.json"))).RootElement.EnumerateArray()
        .Select(f => f.GetProperty("family").GetString()!).ToHashSet(StringComparer.OrdinalIgnoreCase);

    private static HashSet<string> IconNames() => [.. JsonDocument.Parse(File.ReadAllText(Path.Combine(RepoFiles.WwwRoot(), "lib", "icons.json"))).RootElement.GetProperty("icons").EnumerateObject().Select(p => p.Name)];

    /// <summary>Every element of the document, groups opened (raw JSON, so nothing the validator would drop can hide).</summary>
    private static IEnumerable<JsonElement> Elements(JsonElement document)
    {
        IEnumerable<JsonElement> Walk(JsonElement list)
        {
            foreach (var e in list.EnumerateArray())
            {
                yield return e;
                if (e.TryGetProperty("children", out var children))
                {
                    foreach (var child in Walk(children))
                    {
                        yield return child;
                    }
                }
            }
        }

        return document.GetProperty("pages").EnumerateArray().SelectMany(p => Walk(p.GetProperty("elements")));
    }

    /// <summary>The same JSON value: objects by their members, numbers by value (the validator may write 1 as 1.0).</summary>
    private static bool Same(JsonElement a, JsonElement b, string path, List<string> differences)
    {
        if (a.ValueKind != b.ValueKind && !(a.ValueKind is JsonValueKind.True or JsonValueKind.False && b.ValueKind is JsonValueKind.True or JsonValueKind.False))
        {
            differences.Add($"{path}: {a.ValueKind} vs {b.ValueKind}");
            return false;
        }

        switch (a.ValueKind)
        {
            case JsonValueKind.Object:
                var names = a.EnumerateObject().Select(p => p.Name).Union(b.EnumerateObject().Select(p => p.Name)).ToList();
                foreach (var name in names)
                {
                    if (!a.TryGetProperty(name, out var left) || !b.TryGetProperty(name, out var right))
                    {
                        differences.Add($"{path}.{name}: only on one side");
                        continue;
                    }

                    Same(left, right, path + "." + name, differences);
                }

                return differences.Count == 0;
            case JsonValueKind.Array:
                if (a.GetArrayLength() != b.GetArrayLength())
                {
                    differences.Add($"{path}: {a.GetArrayLength()} vs {b.GetArrayLength()} items");
                    return false;
                }

                for (var i = 0; i < a.GetArrayLength(); i++)
                {
                    Same(a[i], b[i], $"{path}[{i}]", differences);
                }

                return differences.Count == 0;
            case JsonValueKind.Number:
                if (Math.Abs(a.GetDouble() - b.GetDouble()) > 1e-9)
                {
                    differences.Add($"{path}: {a} vs {b}");
                }

                return differences.Count == 0;
            case JsonValueKind.String:
                if (a.GetString() != b.GetString())
                {
                    differences.Add($"{path}: \"{a.GetString()}\" vs \"{b.GetString()}\"");
                }

                return differences.Count == 0;
            default:
                if (a.GetRawText() != b.GetRawText())
                {
                    differences.Add($"{path}: {a.GetRawText()} vs {b.GetRawText()}");
                }

                return differences.Count == 0;
        }
    }

    public static TheoryData<string> TemplateSlugs
    {
        get
        {
            var data = new TheoryData<string>();
            foreach (var slug in TemplateSeeder.Slugs())
            {
                data.Add(slug);
            }

            return data;
        }
    }

    [Fact]
    public void There_are_at_least_the_nine_first_templates_next_to_the_demo_and_every_one_has_a_name_a_category_and_a_description()
    {
        var slugs = TemplateSeeder.Slugs();
        Assert.True(slugs.Count >= 9, "the plan names ten templates, the Käsetheke is the demo: " + string.Join(", ", slugs));
        // plan 6 adds many more: the nine of the first plans stay
        Assert.All(new[] { "flyer-wochenangebot", "glasetikett", "grusskarte", "instagram-sale", "instagram-story", "obst-gemuese", "poster-hoffest", "regaletikett", "visitenkarte-modern" }, slug => Assert.Contains(slug, slugs));

        var names = new List<string>();
        foreach (var slug in slugs)
        {
            using var file = JsonDocument.Parse(TemplateSeeder.Read(slug)!);
            var root = file.RootElement;
            var name = root.GetProperty("name").GetString();
            Assert.False(string.IsNullOrWhiteSpace(name), slug);
            Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("category").GetString()), slug);
            Assert.True(root.GetProperty("description").GetString()!.Length > 40, slug);
            names.Add(name!);
        }

        Assert.Equal(names.Count, names.Distinct(StringComparer.OrdinalIgnoreCase).Count());
    }

    [Theory]
    [MemberData(nameof(TemplateSlugs))]
    public void A_template_file_is_valid_and_already_normalised_so_the_validator_changes_nothing(string slug)
    {
        using var file = JsonDocument.Parse(TemplateSeeder.Read(slug)!);
        var document = file.RootElement.GetProperty("document");
        var result = DocumentValidator.Validate(document.GetRawText());
        Assert.True(result.Ok, result.Error);
        Assert.Empty(result.Warnings);
        Assert.Equal(2, result.Document!.Schema);

        using var normalised = JsonDocument.Parse(result.Json!);
        var differences = new List<string>();
        Same(document, normalised.RootElement, "document", differences);
        Assert.True(differences.Count == 0, slug + ": the file is not normalised: " + string.Join("; ", differences.Take(8)));
    }

    [Theory]
    [MemberData(nameof(TemplateSlugs))]
    public void A_template_uses_only_fonts_media_and_icons_the_app_ships_and_defines_every_field_it_uses(string slug)
    {
        using var file = JsonDocument.Parse(TemplateSeeder.Read(slug)!);
        var root = file.RootElement;
        var document = DocumentValidator.Parse(root.GetProperty("document").GetRawText())!;
        var builtin = BuiltInKeys();

        Assert.All(Placeholders.FontFamilies(document), family => Assert.Contains(family, FontFamilies()));
        Assert.All(Placeholders.AssetKeys(document), key => Assert.Contains(key, builtin));
        Assert.All(document.Fields.Where(f => f.Type == "image").Select(f => f.Sample).Where(s => s.Length > 0), key => Assert.Contains(key, builtin));

        var icons = IconNames();
        var iconsUsed = Elements(root.GetProperty("document")).Where(e => e.GetProperty("type").GetString() == "icon").Select(e => e.GetProperty("icon").GetString()!).ToList();
        Assert.All(iconsUsed, icon => Assert.Contains(icon, icons));

        Assert.All(Placeholders.FieldsUsed(document), use => Assert.True(use.Defined, $"{slug}: the field {use.Key} is used but not defined"));

        if (root.TryGetProperty("sampleRows", out var rows))
        {
            var fieldKeys = document.Fields.ToDictionary(f => f.Key, StringComparer.OrdinalIgnoreCase);
            foreach (var row in rows.EnumerateArray())
            {
                foreach (var cell in row.EnumerateObject())
                {
                    Assert.True(fieldKeys.TryGetValue(cell.Name, out var field), $"{slug}: sample row has the unknown field {cell.Name}");
                    if (field!.Type == "image" && cell.Value.GetString() is { Length: > 0 } image)
                    {
                        Assert.Contains(image, builtin);
                    }
                }
            }
        }
    }

    [Fact]
    public void The_templates_with_data_have_fields_with_samples_and_the_two_page_templates_have_two_pages()
    {
        DesignDocument Load(string slug)
        {
            using var file = JsonDocument.Parse(TemplateSeeder.Read(slug)!);
            return DocumentValidator.Parse(file.RootElement.GetProperty("document").GetRawText())!;
        }

        foreach (var slug in new[] { "obst-gemuese", "regaletikett", "glasetikett", "visitenkarte-modern" })
        {
            var document = Load(slug);
            Assert.True(document.Fields.Count >= 4, slug);
            Assert.All(document.Fields, f => Assert.False(string.IsNullOrEmpty(f.Sample) && f.Type != "text" && f.Type != "multiline" && f.Type != "image", slug + " " + f.Key));
        }

        Assert.Equal(2, Load("visitenkarte-modern").Pages.Count);
        Assert.Equal(2, Load("grusskarte").Pages.Count);
        Assert.Contains(Load("regaletikett").Pages[0].Elements, e => e is BarcodeElement { Format: "ean13" });
        Assert.Contains(Load("glasetikett").Pages[0].Elements, e => e is QrElement);
        Assert.Equal((1080d, 1080d, "px"), (Load("instagram-sale").Width, Load("instagram-sale").Height, Load("instagram-sale").Unit));
        Assert.Equal((1080d, 1920d, "px"), (Load("instagram-story").Width, Load("instagram-story").Height, Load("instagram-story").Unit));
        Assert.Equal((297d, 420d), (Load("poster-hoffest").Width, Load("poster-hoffest").Height));
        Assert.Equal((148d, 210d), (Load("flyer-wochenangebot").Width, Load("flyer-wochenangebot").Height));
    }

    // ------------------------------------------------------------------------------------------------ seeding

    [Fact]
    public async Task Templates_are_seeded_once_a_deleted_one_stays_deleted_and_one_that_is_new_in_a_later_version_is_added()
    {
        if (!Enabled)
        {
            return;
        }

        var slugs = TemplateSeeder.Slugs();
        var names = slugs.Select(s => { using var f = JsonDocument.Parse(TemplateSeeder.Read(s)!); return f.RootElement.GetProperty("name").GetString()!; }).ToList();

        async Task<int> Count(string name) => await As(Role.Viewer, biz => biz.Db.Design.CountAsync(d => d.IsTemplate && d.Name == name));
        async Task<List<string>> Marker()
        {
            using var scope = Factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<Data.DtDbContext>();
            var value = await db.Setting.Where(s => s.Key == TemplateSeeder.Marker).Select(s => s.Value).SingleAsync();
            return JsonSerializer.Deserialize<List<string>>(value)!;
        }

        // 1. The start of the app seeded every template once.
        foreach (var name in names)
        {
            Assert.Equal(1, await Count(name));
        }

        Assert.Equal(slugs.OrderBy(s => s), (await Marker()).OrderBy(s => s));
        await As(Role.Viewer, async biz =>
        {
            var templates = await DesignLogic.TemplatesAsync(biz);
            var found = templates.Single(t => t.Name == "Instagram-Beitrag – SALE −30 %");
            Assert.Equal(("Social Media", 1080d, 1080d, "px"), (found.Category, found.Width, found.Height, found.Unit));
        });

        // 2. Seeding again adds nothing.
        Assert.Equal(0, await TemplateSeeder.SeedAsync(Factory.Services, NullLogger.Instance));
        foreach (var name in names)
        {
            Assert.Equal(1, await Count(name));
        }

        // 3. A person deletes one: it does not come back.
        var deleted = "Grußkarte A6 quer (2 Seiten)";
        Assert.Contains(deleted, names);
        var id = await As(Role.Viewer, biz => biz.Db.Design.Where(d => d.IsTemplate && d.Name == deleted).Select(d => d.Id).SingleAsync());
        // a system template belongs to the platform: an administrator deletes it
        await As(Role.Admin, biz => DesignLogic.DeleteAsync(biz, id));
        Assert.Equal(0, await TemplateSeeder.SeedAsync(Factory.Services, NullLogger.Instance));
        Assert.Equal(0, await Count(deleted));

        // 4. A later version brings a template that this database never saw (its slug is not in the list yet): it is added, the others are left alone.
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<Data.DtDbContext>();
            var marker = await db.Setting.SingleAsync(s => s.Key == TemplateSeeder.Marker);
            marker.Value = JsonSerializer.Serialize((await Marker()).Where(s => s != "grusskarte"));
            await db.SaveChangesAsync();
        }

        Assert.Equal(1, await TemplateSeeder.SeedAsync(Factory.Services, NullLogger.Instance));
        Assert.Equal(1, await Count(deleted));
        foreach (var name in names)
        {
            Assert.Equal(1, await Count(name));
        }

        Assert.Equal(slugs.OrderBy(s => s), (await Marker()).OrderBy(s => s));
        Assert.Equal(0, await TemplateSeeder.SeedAsync(Factory.Services, NullLogger.Instance));
    }

    [Fact]
    public async Task A_newer_version_of_a_template_replaces_the_document_only_where_nobody_changed_it_and_a_deleted_one_stays_deleted()
    {
        if (!Enabled)
        {
            return;
        }

        const string untouched = "regaletikett";
        const string edited = "poster-hoffest";
        const string deleted = "flyer-wochenangebot";
        await TemplateSeeder.SeedAsync(Factory.Services, NullLogger.Instance);

        // the app ships a new version of the three files: the first text of the first page says something else
        string Changed(string slug)
        {
            var node = System.Text.Json.Nodes.JsonNode.Parse(TemplateSeeder.Read(slug)!)!;
            var elements = node["document"]!["pages"]![0]!["elements"]!.AsArray();
            var text = elements.First(e => e!["type"]!.GetValue<string>() == "text")!;
            text["text"] = "Neue Fassung " + slug;
            return node.ToJsonString();
        }

        async Task<Design?> Find(string slug)
        {
            using var scope = Factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<Data.DtDbContext>();
            return await db.Design.Include(d => d.Revisions).AsNoTracking().FirstOrDefaultAsync(d => d.SpaceId == null && d.IsTemplate && d.TemplateKey == slug);
        }

        var before = await Find(untouched);
        var beforeEdited = await Find(edited);
        var beforeDeleted = await Find(deleted);
        Assert.NotNull(before);
        Assert.NotNull(beforeEdited);
        Assert.NotNull(beforeDeleted);

        // a person saved the second one (its revision moved on), an administrator deleted the third
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<Data.DtDbContext>();
            var design = await db.Design.SingleAsync(d => d.Id == beforeEdited!.Id);
            design.Revision += 1;
            db.DesignRevision.Add(new DesignRevision { DesignId = design.Id, Revision = design.Revision, DocumentJson = design.DocumentJson });
            await db.SaveChangesAsync();
        }

        await As(Role.Admin, biz => DesignLogic.DeleteAsync(biz, beforeDeleted!.Id));

        try
        {
            var changed = new[] { untouched, edited, deleted }.ToDictionary(s => s, Changed);
            TemplateSeeder.ReadOverride = slug => changed.GetValueOrDefault(slug);
            Assert.Equal(0, await TemplateSeeder.SeedAsync(Factory.Services, NullLogger.Instance));

            var after = await Find(untouched);
            Assert.Contains("Neue Fassung " + untouched, after!.DocumentJson);
            Assert.Equal(before!.Revision + 1, after.Revision);
            Assert.Contains(after.Revisions, r => r.Revision == after.Revision && r.Note == "Vorlage aktualisiert");
            Assert.Equal(before.Name, after.Name);

            var afterEdited = await Find(edited);
            Assert.DoesNotContain("Neue Fassung", afterEdited!.DocumentJson);
            Assert.Equal(beforeEdited!.Revision + 1, afterEdited.Revision);
            Assert.Null(await Find(deleted));

            // again: nothing changes (the hashes are known), also not for the edited one
            Assert.Equal(0, await TemplateSeeder.SeedAsync(Factory.Services, NullLogger.Instance));
            Assert.Equal(after.Revision, (await Find(untouched))!.Revision);
            Assert.Equal(afterEdited.Revision, (await Find(edited))!.Revision);
            Assert.Null(await Find(deleted));
        }
        finally
        {
            TemplateSeeder.ReadOverride = null;
        }

        // the old files are back: the untouched one follows (a new revision), the edited one is still left alone
        await TemplateSeeder.SeedAsync(Factory.Services, NullLogger.Instance);
        var restored = await Find(untouched);
        Assert.DoesNotContain("Neue Fassung", restored!.DocumentJson);
        Assert.Equal(before.Revision + 2, restored.Revision);

        // put the deleted one back for the other tests: its slug leaves the list, so it is seeded again
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<Data.DtDbContext>();
            var seeded = await db.Setting.SingleAsync(s => s.Key == TemplateSeeder.Marker);
            seeded.Value = JsonSerializer.Serialize(JsonSerializer.Deserialize<List<string>>(seeded.Value)!.Where(s => s != deleted));
            await db.SaveChangesAsync();
        }

        Assert.Equal(1, await TemplateSeeder.SeedAsync(Factory.Services, NullLogger.Instance));
        Assert.NotNull(await Find(deleted));
    }

    [Fact]
    public async Task A_seeded_template_is_stored_as_the_validated_document_and_can_be_used_by_every_member()
    {
        if (!Enabled)
        {
            return;
        }

        var template = await As(Role.Viewer, biz => biz.Db.Design.AsNoTracking().SingleAsync(d => d.IsTemplate && d.Name == "Visitenkarte modern (2 Seiten)"));
        var stored = DocumentValidator.Parse(template.DocumentJson)!;
        Assert.Equal(2, stored.Pages.Count);
        Assert.Equal((85d, 55d, "mm"), (template.Width, template.Height, template.Unit));
        Assert.Equal(1, template.Revision);
        Assert.Equal("Karten", template.Category);

        var copy = await As(Role.Designer, biz => DesignLogic.UseTemplateAsync(biz, template.Id));
        Assert.False(copy.IsTemplate);
        Assert.Equal(2, DocumentValidator.Parse(copy.DocumentJson)!.Pages.Count);
        // every member uses it: the copy goes into their own area, the template stays what it is
        await As(Role.Viewer, async biz =>
        {
            var theirs = await DesignLogic.UseTemplateAsync(biz, template.Id);
            Assert.Equal(await biz.PersonalSpaceIdAsync(), theirs.SpaceId);
            await Assert.ThrowsAsync<ForbiddenException>(() => DesignLogic.RenameAsync(biz, template.Id, "Meine"));
        });
    }

    // ------------------------------------------------------------------------------------------------ the data of the start page

    [Fact]
    public async Task The_search_finds_designs_and_templates_by_name_category_and_description_and_takes_the_text_literally()
    {
        if (!Enabled)
        {
            return;
        }

        var unique = Unique("Suchwort");
        var design = await As(Role.Designer, async biz =>
        {
            var made = await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign($"Mein {unique} Schild", "Bunte Sachen", "a5-portrait", null, null, null, null));
            await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign("100% Prozent_Zeichen " + unique, null, "a5-portrait", null, null, null, null));
            return made;
        });

        await As(Role.Designer, async biz =>
        {
            var byName = await DesignLogic.SearchAsync(biz, unique.ToLowerInvariant());
            Assert.Equal(2, byName.Designs.Count);
            Assert.Empty(byName.Templates);
            Assert.Contains(byName.Designs, d => d.Id == design.Id);

            var byCategory = await DesignLogic.SearchAsync(biz, "bunte sachen");
            Assert.Contains(byCategory.Designs, d => d.Id == design.Id);

            var literal = await DesignLogic.SearchAsync(biz, "100% Prozent_Zeichen");
            Assert.Single(literal.Designs);
            Assert.Empty((await DesignLogic.SearchAsync(biz, "100%%Prozent")).Designs);
            Assert.Empty((await DesignLogic.SearchAsync(biz, "Prozent_Zeichen_")).Designs);

            // Templates: by name ("Flyer"), by category ("Social Media"), by a word of the description ("Preisaufkleber"); never among the designs.
            var flyer = await DesignLogic.SearchAsync(biz, "flyer");
            Assert.Contains(flyer.Templates, t => t.Name.StartsWith("Flyer A5", StringComparison.Ordinal));
            Assert.DoesNotContain(flyer.Designs, d => d.IsTemplate);
            var social = await DesignLogic.SearchAsync(biz, "Social Media");
            Assert.True(social.Templates.Count >= 2);
            Assert.All(social.Templates, t => Assert.True(t.IsTemplate));
            Assert.Contains((await DesignLogic.SearchAsync(biz, "Preisaufkleber")).Templates, t => t.Name.StartsWith("Instagram-Beitrag", StringComparison.Ordinal));

            // A blank search finds nothing (the start page then shows its normal content), a very long one is cut.
            Assert.True((await DesignLogic.SearchAsync(biz, "   ")).Empty);
            Assert.True((await DesignLogic.SearchAsync(biz, null)).Empty);
            Assert.True((await DesignLogic.SearchAsync(biz, new string('x', 5000))).Empty);
            Assert.True((await DesignLogic.SearchAsync(biz, unique, 1)).Designs.Count == 1);
        });
    }

    [Fact]
    public async Task Recent_designs_leave_out_templates_the_newest_first_and_featured_templates_show_the_variety()
    {
        if (!Enabled)
        {
            return;
        }

        var (first, second) = await As(Role.Designer, async biz =>
        {
            var a = await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign(Unique("Zuletzt A "), null, "a4-portrait", null, null, null, null));
            var b = await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign(Unique("Zuletzt B "), null, "a4-portrait", null, null, null, null));
            return (a, b);
        });

        await As(Role.Designer, async biz =>
        {
            var recent = await DesignLogic.RecentAsync(biz, 5);
            Assert.True(recent.Count > 0 && recent.Count <= 5);
            Assert.DoesNotContain(recent, d => d.IsTemplate);
            Assert.Equal(second.Id, recent[0].Id);
            Assert.True(recent.Select(d => d.Id).ToList().IndexOf(first.Id) > 0);

            var templates = await DesignLogic.TemplatesAsync(biz);
            var featured = await DesignLogic.FeaturedTemplatesAsync(biz, 6);
            Assert.Equal(Math.Min(6, templates.Count), featured.Count);
            Assert.Equal(featured.Count, featured.Select(t => t.Id).Distinct().Count());
            Assert.All(featured, t => Assert.True(t.IsTemplate));
            // plan 6: one template per family, the first of each occasion first
            var occasions = templates.Select(t => t.TemplateOccasion).Distinct().Count();
            Assert.True(featured.Select(t => t.TemplateOccasion).Distinct().Count() >= Math.Min(occasions, 6), "the row shows the variety of the occasions");
            Assert.Contains("Etiketten", await DesignLogic.TemplateCategoriesAsync(biz));
            Assert.Empty(await DesignLogic.FeaturedTemplatesAsync(biz, 0));
        });
    }

    [Fact]
    public async Task One_click_creation_and_the_actions_of_the_start_page_follow_the_roles()
    {
        if (!Enabled)
        {
            return;
        }

        var created = await As(Role.Designer, async biz =>
        {
            var design = await DesignLogic.CreateFromFormatAsync(biz, "business-card", null, null, null, null);
            Assert.Equal("Unbenannt – Visitenkarte", design.Name);
            Assert.Equal((85d, 55d, "mm"), (design.Width, design.Height, design.Unit));
            var story = await DesignLogic.CreateFromFormatAsync(biz, "instagram-story", null, null, null, null);
            Assert.Equal((1080d, 1920d, "px"), (story.Width, story.Height, story.Unit));
            var custom = await DesignLogic.CreateFromFormatAsync(biz, "custom", 120, 80, "mm", null);
            Assert.Equal("Unbenanntes Design", custom.Name);
            return design;
        });

        await ShareAsync(Role.Designer, ItemKind.Design, created.Id, Role.Viewer);
        await As(Role.Viewer, async biz =>
        {
            // everybody makes designs in their own area, and looking at one is enough to copy it; changing and deleting the original is not
            Assert.NotNull(await DesignLogic.CreateFromFormatAsync(biz, "business-card", null, null, null, null));
            var theirCopy = await DesignLogic.DuplicateAsync(biz, created.Id);
            Assert.Equal(await biz.PersonalSpaceIdAsync(), theirCopy.SpaceId);
            await Assert.ThrowsAsync<ForbiddenException>(() => DesignLogic.RenameAsync(biz, created.Id, "x"));
            await Assert.ThrowsAsync<ForbiddenException>(() => DesignLogic.DeleteAsync(biz, created.Id));
        });

        await As(Role.Designer, async biz =>
        {
            Assert.Equal("Neuer Name", await DesignLogic.RenameAsync(biz, created.Id, "Neuer Name"));
            var copy = await DesignLogic.DuplicateAsync(biz, created.Id);
            Assert.Equal("Neuer Name (Kopie)", copy.Name);
            await DesignLogic.DeleteAsync(biz, copy.Id);
            Assert.Null(await DesignLogic.GetAsync(biz, copy.Id));
        });
    }
}
