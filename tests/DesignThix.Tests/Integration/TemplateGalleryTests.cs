using System.Net;
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
/// The metadata of the templates and the gallery of plan 6 (docs/PLAN-TEMPLATES.md section 2), without a database: the rules every template file has to keep (so T2 to T4 cannot ship a template the
/// gallery cannot place), the families, the pure filter and paging logic of <see cref="TemplateLogic"/>, the metadata reader of the seeder.
/// </summary>
public sealed class TemplateMetaFileTests
{
    /// <summary>
    /// Plan 6 wants every kind of template in at least three variants. The 10 templates of the first plans are one variant each, so this is only enforced when the library is complete: set the environment
    /// variable DESIGNTHIX_REQUIRE_VARIANTS=1 (T5, the final pass, made it the default: <see cref="EnforceByDefault"/>).
    /// </summary>
    private const bool EnforceByDefault = true;

    public static TheoryData<string> Slugs
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

    private static JsonElement Load(string slug, out JsonDocument owner)
    {
        owner = JsonDocument.Parse(TemplateSeeder.Read(slug)!);
        return owner.RootElement;
    }

    private static HashSet<string> BuiltInKeys(string? category = null)
        => JsonDocument.Parse(File.ReadAllText(Path.Combine(RepoFiles.WwwRoot(), "builtin", "builtin.json"))).RootElement.EnumerateArray()
            .Where(a => category is null || a.GetProperty("category").GetString() == category)
            .Select(a => a.GetProperty("key").GetString()!).ToHashSet(StringComparer.OrdinalIgnoreCase);

    [Theory]
    [MemberData(nameof(Slugs))]
    public void A_template_file_carries_valid_metadata_for_the_gallery(string slug)
    {
        var root = Load(slug, out var owner);
        using (owner)
        {
            string Text(string name) => root.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString()! : "";

            Assert.True(TemplateMeta.IsSlug(Text("family")), slug + ": family is a slug");
            Assert.False(string.IsNullOrWhiteSpace(Text("familyName")), slug + ": familyName");
            Assert.False(string.IsNullOrWhiteSpace(Text("variant")), slug + ": variant");
            Assert.NotNull(TemplateMeta.OccasionOf(Text("occasion")));
            Assert.Equal(Text("occasion"), TemplateMeta.OccasionOf(Text("occasion")));
            var tags = root.GetProperty("tags").EnumerateArray().Select(t => t.GetString()!).ToList();
            Assert.InRange(tags.Count, 3, TemplateMeta.MaxTags);
            Assert.All(tags, t => Assert.True(t.Length is > 0 and <= TemplateMeta.MaxTagLength && !t.Contains(',') && t == t.Trim(), slug + ": tag " + t));
            Assert.Equal(tags.Count, tags.Distinct(StringComparer.OrdinalIgnoreCase).Count());
            Assert.True(root.GetProperty("number").GetInt32() > 0);

            // the format: a key of the presets, and the size of the open sheet is the size of the document
            var preset = FormatPresets.Find(Text("formatKey"));
            Assert.NotNull(preset);
            var document = DocumentValidator.Parse(root.GetProperty("document").GetRawText())!;
            Assert.Equal((preset!.Width, preset.Height, preset.Unit), (document.Width, document.Height, document.Unit));
            Assert.Equal(preset.Fold, document.Fold);
            if (document.Fold != "none")
            {
                Assert.Equal(2, document.Pages.Count);
                Assert.Equal(FormatPresets.FoldPageNames(document.Fold), document.Pages.Select(p => p.Name));
            }

            // what the seeder will write for the file is what the file says
            var info = TemplateSeeder.ReadInfo(slug)!;
            Assert.Equal((Text("family"), Text("familyName"), Text("variant"), Text("occasion"), Text("formatKey")), (info.Family, info.FamilyName, info.Variant, info.Occasion, info.Format));
            Assert.Equal(TemplateMeta.JoinTags(tags), info.Tags);
            Assert.Equal(root.GetProperty("number").GetInt32(), info.Order);

            // decorations come from the Deko pack: the keys exist and are of that category
            var deko = BuiltInKeys("Deko");
            Assert.All(Placeholders.AssetKeys(document).Where(k => k.StartsWith("deko-", StringComparison.OrdinalIgnoreCase)), key => Assert.Contains(key, deko));
        }
    }

    [Fact]
    public void The_variants_of_a_family_agree_on_name_and_occasion_and_differ_in_their_style_and_number()
    {
        var infos = TemplateSeeder.Slugs().Select(s => TemplateSeeder.ReadInfo(s)!).ToList();
        Assert.Equal(infos.Count, infos.Select(i => i.Slug).Distinct().Count());
        Assert.Equal(infos.Count, infos.Select(i => i.Name).Distinct(StringComparer.OrdinalIgnoreCase).Count());
        Assert.Equal(infos.Count, infos.Select(i => i.Order).Distinct().Count());
        foreach (var family in infos.GroupBy(i => i.Family))
        {
            Assert.Single(family.Select(i => i.FamilyName).Distinct());
            Assert.Single(family.Select(i => i.Occasion).Distinct());
            Assert.Equal(family.Count(), family.Select(i => i.Variant).Distinct(StringComparer.OrdinalIgnoreCase).Count());
        }
    }

    [Fact]
    public void Every_family_has_at_least_three_variants_once_the_library_is_complete()
    {
        if (!EnforceByDefault && Environment.GetEnvironmentVariable("DESIGNTHIX_REQUIRE_VARIANTS") != "1")
        {
            return;
        }

        var infos = TemplateSeeder.Slugs().Select(s => TemplateSeeder.ReadInfo(s)!).ToList();
        var thin = infos.GroupBy(i => i.Family).Where(g => g.Count() < 3).Select(g => g.Key + " (" + g.Count() + ")").ToList();
        Assert.True(thin.Count == 0, "families with fewer than three variants: " + string.Join(", ", thin));
        Assert.True(infos.Count >= 180, "plan 6 wants at least 180 templates, there are " + infos.Count);
    }

    [Fact]
    public void The_seeder_drops_what_does_not_fit_the_rules_and_cleans_the_tags()
    {
        using var file = JsonDocument.Parse("""
            { "name": "X", "category": "Karten", "description": "d", "family": "Bad Slug", "familyName": "  Familie  ", "variant": "", "occasion": "Unsinn",
              "tags": ["Eins", "zwei, drei", " eins ", 5, "", "Vier"], "formatKey": "gibt-es-nicht", "number": 7 }
            """);
        var info = TemplateSeeder.ReadInfo("x", file.RootElement, r => r)!;
        Assert.Null(info.Family);
        Assert.Equal("Familie", info.FamilyName);
        Assert.Null(info.Variant);
        Assert.Null(info.Occasion);
        Assert.Null(info.Format);
        Assert.Equal("Eins, zwei drei, Vier", info.Tags);
        Assert.Equal(7, info.Order);
        Assert.Equal(["a", "b"], TemplateMeta.CleanTags(["a", "A", null, "b"]));
        Assert.Equal(TemplateMeta.MaxTags, TemplateMeta.CleanTags(Enumerable.Range(0, 100).Select(i => "t" + i)).Count);
        Assert.Equal(["a", "b c"], TemplateMeta.SplitTags("a, b c"));
        Assert.Empty(TemplateMeta.SplitTags(null));
        Assert.Equal(12, TemplateMeta.Occasions.Count);
        Assert.Equal("Kinder & Familie", TemplateMeta.OccasionOf(" kinder & familie "));
        Assert.Null(TemplateMeta.OccasionOf("Kinder"));
    }

    // ------------------------------------------------------------------------------------------------ the logic of the gallery (pure)

    private static DesignRow Row(long id, string name, string? family, string? familyName, string? variant, string? occasion, string? format, int order, string? tags = null, string? description = null)
        => new() { Id = id, Name = name, IsTemplate = true, Category = "Karten", Description = description ?? "Eine Vorlage", TemplateFamily = family, TemplateFamilyName = familyName, TemplateVariant = variant, TemplateOccasion = occasion, TemplateFormat = format, TemplateOrder = order, TemplateTags = tags, Width = 100, Height = 100 };

    private static List<TemplateFamilyRow> Sample() =>
        TemplateLogic.Group(
        [
            Row(1, "Geburtstag modern", "geburtstag", "Geburtstagskarte", "Modern", "Geburtstag", "card-a6-portrait", 120, "Glückwunsch, Torte"),
            Row(2, "Geburtstag klassisch", "geburtstag", "Geburtstagskarte", "Klassisch", "Geburtstag", "card-a6-portrait", 110, "Glückwunsch, Kerzen"),
            Row(3, "Geburtstag verspielt", "geburtstag", "Geburtstagskarte", "Verspielt", "Geburtstag", "postcard-a6-landscape", 130, "Konfetti"),
            Row(4, "Hochzeit Einladung elegant", "hochzeit-einladung", "Hochzeitseinladung", "Elegant", "Hochzeit", "card-a6-portrait", 140, "Trauung, Heirat"),
            Row(5, "Mein eigenes Teamdesign", null, null, null, null, null, 0, null, "Intern"),
            Row(6, "Grußkarte Weihnachten", "weihnachten", "Weihnachtskarte", "Schlicht", "Feiertage", "a6-landscape", 150, "Advent, Nikolaus"),
            Row(7, "Speisekarte", "speisekarte", "Speisekarte", "Modern", "Gastronomie", "menu-dl", 160, "Restaurant"),
        ]);

    [Fact]
    public void Templates_become_families_ordered_by_occasion_with_their_variants_in_the_order_of_the_files()
    {
        var families = Sample();
        Assert.Equal(["geburtstag", "hochzeit-einladung", "weihnachten", "speisekarte", "t5"], families.Select(f => f.Key));
        var birthday = families[0];
        Assert.Equal("Geburtstagskarte", birthday.Name);
        Assert.Equal(["Klassisch", "Modern", "Verspielt"], birthday.Variants.Select(v => v.TemplateVariant));
        Assert.All(birthday.Variants, v => Assert.Equal(3, v.Variants));
        Assert.Equal(2, birthday.First.Id);
        // a template without a family is a family of one, named like itself, and comes last
        Assert.Equal(("Mein eigenes Teamdesign", 1), (families[^1].Name, families[^1].Variants.Count));
    }

    [Fact]
    public void The_gallery_filters_by_occasion_and_format_searches_tags_and_folds_umlauts_and_pages()
    {
        var all = Sample();

        var everything = TemplateLogic.Gallery(all, new TemplateFilter(), 0, 24);
        Assert.Equal(5, everything.Total);
        Assert.Equal(7, everything.Templates);
        Assert.Equal(["Geburtstag", "Hochzeit", "Feiertage", "Gastronomie", "Weitere"], everything.Occasions.Select(o => o.Name));
        Assert.Equal(TemplateLogic.NoOccasion, everything.Occasions[^1].Key);

        Assert.Equal(["geburtstag"], TemplateLogic.Gallery(all, new TemplateFilter("geburtstag"), 0, 24).Families.Select(f => f.Key));
        Assert.Equal(["t5"], TemplateLogic.Gallery(all, new TemplateFilter(TemplateLogic.NoOccasion), 0, 24).Families.Select(f => f.Key));
        Assert.Equal(5, TemplateLogic.Gallery(all, new TemplateFilter("Unsinn"), 0, 24).Total);

        // a format matches when ONE variant has it; the lists are counted with the other filter applied
        var folded = TemplateLogic.Gallery(all, new TemplateFilter(Format: "card-a6-portrait"), 0, 24);
        Assert.Equal(["geburtstag", "hochzeit-einladung"], folded.Families.Select(f => f.Key));
        Assert.Equal(2, folded.Formats.First(f => f.Key == "card-a6-portrait").Count);
        Assert.Equal(["Geburtstag", "Hochzeit"], folded.Occasions.Select(o => o.Name));
        Assert.Contains(everything.Formats, f => f.Key == "postcard-a6-landscape" && f.Count == 1);
        Assert.Equal("Klappkarten und Postkarten", everything.Formats.First(f => f.Key == "card-a6-portrait").Group);

        // the search: tags, descriptions, the occasion, umlauts folded, every word must match
        Assert.Equal(["geburtstag"], TemplateLogic.Gallery(all, new TemplateFilter(Query: "kerzen"), 0, 24).Families.Select(f => f.Key));
        Assert.Equal(["weihnachten"], TemplateLogic.Gallery(all, new TemplateFilter(Query: "GRUSSKARTE weihnacht"), 0, 24).Families.Select(f => f.Key));
        Assert.Equal(["hochzeit-einladung"], TemplateLogic.Gallery(all, new TemplateFilter(Query: "heirat"), 0, 24).Families.Select(f => f.Key));
        Assert.Equal(["t5"], TemplateLogic.Gallery(all, new TemplateFilter(Query: "intern"), 0, 24).Families.Select(f => f.Key));
        Assert.Equal(0, TemplateLogic.Gallery(all, new TemplateFilter(Query: "kerzen heirat"), 0, 24).Total);
        Assert.Equal(["Weihnachtskarte"], TemplateLogic.Gallery(all, new TemplateFilter(Query: "Gruß"), 0, 24).Families.Select(f => f.Name));
        Assert.Equal(1, TemplateLogic.Gallery(all, new TemplateFilter(Query: new string('x', 500)), 0, 24).Total + 1);

        // paging: skip and take count families
        var first = TemplateLogic.Gallery(all, new TemplateFilter(), 0, 2);
        var second = TemplateLogic.Gallery(all, new TemplateFilter(), 2, 2);
        Assert.Equal((5, 5), (first.Total, second.Total));
        Assert.Equal(["geburtstag", "hochzeit-einladung"], first.Families.Select(f => f.Key));
        Assert.Equal(["weihnachten", "speisekarte"], second.Families.Select(f => f.Key));
        Assert.Empty(TemplateLogic.Gallery(all, new TemplateFilter(), 99, 24).Families);
        Assert.Equal(5, TemplateLogic.Gallery(all, new TemplateFilter(), -3, 100000).Families.Count);

        Assert.Equal("grusskarte", TemplateLogic.Fold("Grußkarte"));
        Assert.Equal("aouss", TemplateLogic.Fold("ÄÖÜß"));
        Assert.Equal("", TemplateLogic.Fold(null));
    }
}

/// <summary>The metadata in the database and the endpoints of the gallery (needs DESIGNTHIX_TEST_DB).</summary>
[Collection("app")]
public sealed class TemplateGalleryTests(AppTests.AppFactory factory) : PlatformTestBase(factory)
{
    [Fact]
    public async Task The_seeded_templates_carry_their_metadata_and_the_start_of_the_app_repairs_what_a_later_version_corrects()
    {
        if (!Enabled)
        {
            return;
        }

        var slugs = TemplateSeeder.Slugs();
        var rows = await As(Role.Viewer, biz => biz.Db.Design.AsNoTracking().Where(d => d.IsTemplate && d.SpaceId == null && d.TemplateKey != null).ToListAsync());
        Assert.All(slugs, slug => Assert.Contains(rows, r => r.TemplateKey == slug));
        var regal = rows.Single(r => r.TemplateKey == "regaletikett");
        Assert.Equal(("regaletikett", "Regaletikett", "Mit Strichcode", "Handel & Preise", "shelf-strip"), (regal.TemplateFamily, regal.TemplateFamilyName, regal.TemplateVariant, regal.TemplateOccasion, regal.TemplateFormat));
        Assert.Contains("Strichcode", regal.TemplateTags);
        Assert.True(regal.TemplateOrder > 0);
        // the demo template has its metadata too (matched by its name)
        Assert.Contains(rows, r => r.TemplateKey == "kaesetheke" && r.TemplateOccasion == "Handel & Preise");

        // a database from before plan 6 (no key, no metadata): found by the name, repaired once
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<Data.DtDbContext>();
            var row = await db.Design.SingleAsync(d => d.TemplateKey == "regaletikett");
            row.TemplateKey = null;
            row.TemplateTags = null;
            row.TemplateOccasion = null;
            row.TemplateFamily = null;
            await db.SaveChangesAsync();
        }

        Assert.Equal(0, await TemplateSeeder.SeedAsync(Factory.Services, NullLogger.Instance));
        var repaired = await As(Role.Viewer, biz => biz.Db.Design.AsNoTracking().SingleAsync(d => d.TemplateKey == "regaletikett"));
        Assert.Equal(("regaletikett", "Handel & Preise"), (repaired.TemplateFamily, repaired.TemplateOccasion));
        Assert.Contains("Strichcode", repaired.TemplateTags);

        // a design of a person's area is never touched, whatever it is called
        var own = await As(Role.Designer, biz => DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign("Regaletikett mit EAN", null, "a4-portrait", null, null, null, null)));
        using (var scope = Factory.Services.CreateScope())
        {
            await TemplateSeeder.SyncMetadataAsync(scope.ServiceProvider.GetRequiredService<Data.DtDbContext>());
        }

        var untouched = await As(Role.Designer, biz => biz.Db.Design.AsNoTracking().SingleAsync(d => d.Id == own.Id));
        Assert.Null(untouched.TemplateKey);
        Assert.Null(untouched.TemplateOccasion);
    }

    [Fact]
    public async Task The_gallery_and_the_search_work_on_the_real_templates_and_a_copy_is_no_template_and_carries_no_metadata()
    {
        if (!Enabled)
        {
            return;
        }

        await As(Role.Viewer, async biz =>
        {
            var all = await TemplateLogic.GalleryAsync(biz, new TemplateFilter(), 0, 100);
            Assert.True(all.Total >= 9);
            Assert.Equal(all.Templates, (await DesignLogic.TemplatesAsync(biz)).Count);
            Assert.Contains(all.Occasions, o => o.Name == "Handel & Preise" && o.Count >= 4);
            var prices = await TemplateLogic.GalleryAsync(biz, new TemplateFilter("Handel & Preise"), 0, 100);
            Assert.All(prices.Families, f => Assert.Equal("Handel & Preise", f.Occasion));

            var byTag = await TemplateLogic.GalleryAsync(biz, new TemplateFilter(Query: "supermarkt"), 0, 24);
            Assert.Contains(byTag.Families, f => f.Variants.Any(v => v.Name.StartsWith("Regaletikett", StringComparison.Ordinal)));
            // the search of the start page looks at the tags too ("Supermarkt" is a tag, not in the description)
            Assert.Contains((await DesignLogic.SearchAsync(biz, "Supermarkt")).Templates, t => t.Name.StartsWith("Regaletikett", StringComparison.Ordinal));
            Assert.Contains((await DesignLogic.SearchAsync(biz, "Handel & Preise")).Templates, t => t.TemplateOccasion == "Handel & Preise");

            var families = await TemplateLogic.FamiliesAsync(biz);
            Assert.Equal(all.Templates, families.Sum(f => f.Variants.Count));
            var ofTemplate = await TemplateLogic.FamilyOfAsync(biz, families[0].Variants[0].Id);
            Assert.Equal(families[0].Key, ofTemplate!.Key);
            Assert.Null(await TemplateLogic.FamilyOfAsync(biz, long.MaxValue));
            Assert.Equal((await TemplateLogic.FeaturedAsync(biz, 3)).Select(t => t.Id), (await DesignLogic.FeaturedTemplatesAsync(biz, 3)).Select(t => t.Id));
            var featured = await DesignLogic.FeaturedTemplatesAsync(biz, 6);
            Assert.Equal(featured.Count, featured.Select(t => t.TemplateFamily ?? t.Id.ToString()).Distinct().Count());
            Assert.True(featured.Select(t => t.TemplateOccasion).Distinct().Count() >= 4, "the row shows the variety of the occasions");

            var template = all.Families.SelectMany(f => f.Variants).First();
            var copy = await DesignLogic.UseTemplateAsync(biz, template.Id);
            Assert.False(copy.IsTemplate);
            Assert.Null(copy.TemplateFamily);
            Assert.Null(copy.TemplateKey);
            Assert.Null(copy.TemplateTags);
            Assert.Equal(0, copy.TemplateOrder);
        });
    }

    [Fact]
    public async Task The_endpoints_give_the_gallery_the_family_of_a_template_and_the_formats_with_their_fold()
    {
        if (!Enabled)
        {
            return;
        }

        await using var admins = await RealAdminsAsync();
        var client = await SignInAsync(await UserAsync(Role.Viewer));

        using (var gallery = JsonDocument.Parse(await client.GetStringAsync("/api/templates/gallery?occasion=" + Uri.EscapeDataString("Handel & Preise") + "&take=2")))
        {
            var root = gallery.RootElement;
            Assert.True(root.GetProperty("total").GetInt32() >= 4);
            Assert.Equal(2, root.GetProperty("families").GetArrayLength());
            var family = root.GetProperty("families")[0];
            Assert.Equal("Handel & Preise", family.GetProperty("occasion").GetString());
            var variant = family.GetProperty("variants")[0];
            Assert.True(variant.GetProperty("id").GetInt64() > 0);
            Assert.False(variant.GetProperty("canEdit").GetBoolean());
            Assert.True(variant.GetProperty("tags").GetArrayLength() >= 3);
            Assert.Contains(root.GetProperty("occasions").EnumerateArray(), o => o.GetProperty("name").GetString() == "Handel & Preise");
            Assert.True(root.GetProperty("formats").GetArrayLength() >= 3);

            using var family2 = JsonDocument.Parse(await client.GetStringAsync("/api/templates/" + variant.GetProperty("id").GetInt64() + "/family"));
            Assert.Equal(family.GetProperty("key").GetString(), family2.RootElement.GetProperty("key").GetString());
        }

        using (var templates = JsonDocument.Parse(await client.GetStringAsync("/api/templates")))
        {
            var first = templates.RootElement.EnumerateArray().First(t => t.GetProperty("name").GetString()!.StartsWith("Regaletikett", StringComparison.Ordinal));
            Assert.Equal("Handel & Preise", first.GetProperty("occasion").GetString());
            Assert.Equal("shelf-strip", first.GetProperty("format").GetString());
            Assert.Equal("Regaletikett", first.GetProperty("familyName").GetString());
        }

        using (var formats = JsonDocument.Parse(await client.GetStringAsync("/api/formats")))
        {
            var card = formats.RootElement.EnumerateArray().First(f => f.GetProperty("key").GetString() == "card-a6-portrait");
            Assert.Equal(("vertical", 210d, 148d), (card.GetProperty("fold").GetString(), card.GetProperty("width").GetDouble(), card.GetProperty("height").GetDouble()));
            Assert.Contains("gefaltet", card.GetProperty("note").GetString());
            Assert.False(card.GetProperty("tile").GetBoolean());
        }

        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/templates/999999999/family")).StatusCode);
        var anonymous = Factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        Assert.NotEqual(HttpStatusCode.OK, (await anonymous.GetAsync("/api/templates/gallery")).StatusCode);

        // one click creates a folded card with its two named pages and the fold, and the document the editor loads says so
        var created = await ApiPostAsync(client, "/api/designs", new { preset = "card-a6-portrait" });
        Assert.Equal(HttpStatusCode.OK, created.StatusCode);
        using var made = JsonDocument.Parse(await created.Content.ReadAsStringAsync());
        var id = made.RootElement.GetProperty("id").GetInt64();
        using var loaded = JsonDocument.Parse(await client.GetStringAsync("/api/designs/" + id));
        var document = loaded.RootElement.GetProperty("document");
        Assert.Equal("vertical", document.GetProperty("fold").GetString());
        Assert.Equal(["Außen (Rückseite | Vorderseite)", "Innen"], document.GetProperty("pages").EnumerateArray().Select(p => p.GetProperty("name").GetString()));
        Assert.Equal((210d, 148d), (document.GetProperty("width").GetDouble(), document.GetProperty("height").GetDouble()));
    }
}
