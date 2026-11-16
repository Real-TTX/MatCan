using System.Text;
using System.Text.Json;
using MatCan.Core.Documents;
using MatCan.Core.Output;
using MatCan.Data;
using MatCan.Data.Entities;
using MatCan.Logic;
using MatCan.Services;
using MatCan.Tests.Core;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace MatCan.Tests.Integration;

/// <summary>
/// The design tool around the editor (phase K2) against a real PostgreSQL (see <see cref="AppTests"/>): uploads and their hostile files, the category Uploads, the start-up fixes,
/// one-click designs, templates, resizing, the brand kit and outputs of designs with several pages. Runs when MATCAN_TEST_DB names a server; returns at once otherwise.
/// </summary>
[Collection("app")]
public sealed class StudioIntegrationTests(AppTests.AppFactory factory) : PlatformTestBase(factory)
{
    private static string Unique(string prefix) => prefix + Guid.NewGuid().ToString("N")[..8];

    private static byte[] Png() => File.ReadAllBytes(Path.Combine(RepoFiles.WwwRoot(), "img", "icon-192.png"));

    private static byte[] OtherPng() => [.. Png(), 0];

    // ------------------------------------------------------------------------------------------------ uploads

    [Fact]
    public async Task An_upload_goes_to_Uploads_with_a_key_from_its_name_and_a_taken_key_gets_a_suffix()
    {
        if (!Enabled)
        {
            return;
        }

        var name = Unique("Mein Käse ");
        var key = AssetLogic.KeyFromFileName(name + ".png");
        await As(Role.Designer, async biz =>
        {
            var first = await AssetLogic.UploadAsync(biz, name + ".png", Png(), null);
            Assert.Null(first.Error);
            Assert.Equal(key, first.Asset!.Key);
            Assert.Equal("Uploads", first.Asset.Category);
            var second = await AssetLogic.UploadAsync(biz, name + ".png", OtherPng(), "");
            Assert.Equal(key + "-2", second.Asset!.Key);
            Assert.Equal("image/png", second.Asset.ContentType);
            Assert.True(second.Asset.Width > 0 && second.Asset.Height > 0);
            Assert.Equal(AssetLogic.Url(second.Asset.Key, second.Asset.ContentHash), second.Asset.Url);
        });
    }

    [Theory]
    [InlineData("Logos", "Logos")]
    [InlineData("logos", "Logos")]
    [InlineData("  Fotos ", "Fotos")]
    [InlineData("Meine Bilder", "Meine Bilder")]
    [InlineData("<script>alert(1)</script>", "Uploads")]
    [InlineData("javascript:1", "Uploads")]
    [InlineData("", "Uploads")]
    [InlineData(null, "Uploads")]
    public async Task The_category_of_an_upload_is_a_known_or_a_plain_name_else_Uploads(string? asked, string expected)
    {
        if (!Enabled)
        {
            return;
        }

        var result = await As(Role.Designer, biz => AssetLogic.UploadAsync(biz, Unique("kat-") + ".png", Png(), asked));
        Assert.Equal(expected, result.Asset!.Category);
    }

    [Fact]
    public async Task A_pasted_image_without_a_name_is_called_after_the_moment()
    {
        if (!Enabled)
        {
            return;
        }

        var keys = await As(Role.Designer, async biz =>
        {
            var list = new List<string>();
            foreach (var fileName in new[] { "", "image.png", "blob", "IMAGE.PNG" })
            {
                list.Add((await AssetLogic.UploadAsync(biz, fileName, Png(), null)).Asset!.Key);
            }

            return list;
        });
        Assert.All(keys, key => Assert.Matches(@"^bild-\d{8}-\d{6}(-\d+)?$", key));
        Assert.Equal(4, keys.Distinct().Count());
        Assert.StartsWith("bild-" + Fmt.Local(DateTime.UtcNow).ToString("yyyyMMdd"), keys[0]);
    }

    [Fact]
    public async Task Hostile_files_are_refused_in_german_and_nothing_is_stored()
    {
        if (!Enabled)
        {
            return;
        }

        var html = Encoding.UTF8.GetBytes("<html><script>alert(1)</script></html>");
        var exe = new byte[] { 0x4D, 0x5A, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0 };
        var bomb = Encoding.UTF8.GetBytes("<?xml version=\"1.0\"?><!DOCTYPE svg [<!ENTITY a \"aaaa\"><!ENTITY b \"&a;&a;&a;&a;\">]><svg xmlns=\"http://www.w3.org/2000/svg\"><text>&b;</text></svg>");
        var hugePng = Png().Concat(new byte[11 * 1024 * 1024]).ToArray();

        await As(Role.Designer, async biz =>
        {
            var before = await biz.Db.Asset.CountAsync();
            foreach (var (name, bytes) in new (string, byte[])[] { ("a.png", html), ("b.png", exe), ("c.png", Array.Empty<byte>()), ("d.svg", html), ("e.svg", bomb), ("f.png", hugePng) })
            {
                var result = await AssetLogic.UploadAsync(biz, name, bytes, null);
                Assert.Null(result.Asset);
                Assert.False(string.IsNullOrWhiteSpace(result.Error), name);
            }

            Assert.Equal(before, await biz.Db.Asset.CountAsync());
        });
    }

    [Fact]
    public async Task A_svg_is_stored_cleaned_and_the_person_is_told()
    {
        if (!Enabled)
        {
            return;
        }

        var svg = Encoding.UTF8.GetBytes("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"10\" height=\"10\" onload=\"alert(1)\"><script>alert(1)</script><rect width=\"10\" height=\"10\" fill=\"red\"/></svg>");
        var (result, content) = await As(Role.Designer, async biz =>
        {
            var r = await AssetLogic.UploadAsync(biz, Unique("sauber-") + ".svg", svg, null);
            return (r, await AssetLogic.ContentAsync(biz, r.Asset!.Key, null));
        });
        Assert.NotEmpty(result.Cleaned);
        var stored = Encoding.UTF8.GetString(content!.Bytes!);
        Assert.DoesNotContain("script", stored);
        Assert.DoesNotContain("onload", stored);
        Assert.Contains("rect", stored);
        Assert.Equal("svg", content.Extension);
    }

    [Fact]
    public async Task Everybody_uploads_into_their_own_area_and_only_those_who_may_write_into_a_team()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Viewer));
        await As(Role.Viewer, async biz =>
        {
            // a team viewer may look, not write into the team; their own area is theirs
            await Assert.ThrowsAsync<ForbiddenException>(() => AssetLogic.UploadAsync(biz, "x.png", Png(), null, team));
            await Assert.ThrowsAsync<ForbiddenException>(() => FontLogic.UploadAsync(biz, "x.ttf", [0, 1, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8], null, team));
            Assert.NotNull((await AssetLogic.UploadAsync(biz, Unique("mein-") + ".png", Png(), null)).Asset);
        });
        await As(Role.Stranger, biz => Assert.ThrowsAsync<NotFoundException>(() => AssetLogic.UploadAsync(biz, "x.png", Png(), null, team)));
        await As(Role.Designer, async biz => Assert.NotNull((await AssetLogic.UploadAsync(biz, Unique("team-") + ".png", Png(), null, team)).Asset));
    }

    [Fact]
    public async Task A_font_upload_reports_a_file_that_is_no_font_and_a_file_that_is_there()
    {
        if (!Enabled)
        {
            return;
        }

        await As(Role.Designer, async biz =>
        {
            var notAFont = await FontLogic.UploadAsync(biz, "x.ttf", Encoding.UTF8.GetBytes("<html>nope</html>"), null);
            Assert.Null(notAFont.Font);
            Assert.Contains("Schriftdatei", notAFont.Error);
            var tooBig = await FontLogic.UploadAsync(biz, "big.ttf", new byte[(int)FontLogic.MaxFontBytes + 1], null);
            Assert.Contains("zu groß", tooBig.Error);
        });
    }

    [Fact]
    public async Task The_search_can_ask_for_Uploads_newest_first()
    {
        if (!Enabled)
        {
            return;
        }

        var (older, newer) = await As(Role.Designer, async biz =>
        {
            var a = await AssetLogic.UploadAsync(biz, Unique("zzz-alt-") + ".png", Png(), null);
            await Task.Delay(20);
            var b = await AssetLogic.UploadAsync(biz, Unique("aaa-neu-") + ".png", OtherPng(), null);
            return (a.Asset!.Key, b.Asset!.Key);
        });

        await As(Role.Designer, async biz =>
        {
            var byNew = (await AssetLogic.SearchAsync(biz, null, "uploads", 500, "new")).Select(a => a.Key).ToList();
            Assert.True(byNew.IndexOf(newer) >= 0 && byNew.IndexOf(older) >= 0);
            Assert.True(byNew.IndexOf(newer) < byNew.IndexOf(older));
            var byName = (await AssetLogic.SearchAsync(biz, null, "UPLOADS", 500)).Select(a => a.Key).ToList();
            Assert.True(byName.IndexOf(newer) < byName.IndexOf(older));
            Assert.DoesNotContain("flag-de", byNew);
            Assert.All(await AssetLogic.SearchAsync(biz, null, "uploads", 50, "new"), a => Assert.Equal("Uploads", a.Category));
        });
    }

    // ------------------------------------------------------------------------------------------------ the fixes at start-up

    private static readonly string SchemaOneDocument = """
        {"schema":1,"unit":"mm","width":150,"height":100,"dpi":300,"locale":"de-DE","background":{"color":"#ffffff","asset":"flag-de","fit":"cover"},
         "fields":[{"key":"Name","label":"Name","type":"text","sample":"x"}],"elements":[{"id":"a","type":"text","text":"{{Name}}"}]}
        """;

    [Fact]
    public async Task The_start_up_pass_upgrades_old_documents_once_and_leaves_the_rest_alone()
    {
        if (!Enabled)
        {
            return;
        }

        var (id, corrupt) = await As(Role.Designer, async biz =>
        {
            var design = await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign(Unique("Alt "), null, "label-150x100", null, null, null, null));
            await DesignLogic.SaveDocumentAsync(biz, design.Id, 1, "{\"width\":150,\"height\":100,\"elements\":[{\"type\":\"shape\"}]}");
            await biz.Db.Design.Where(d => d.Id == design.Id).ExecuteUpdateAsync(s => s.SetProperty(d => d.DocumentJson, SchemaOneDocument));
            await biz.Db.DesignRevision.Where(r => r.DesignId == design.Id).ExecuteUpdateAsync(s => s.SetProperty(r => r.DocumentJson, SchemaOneDocument));
            var broken = await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign(Unique("Kaputt "), null, "label-150x100", null, null, null, null));
            await biz.Db.Design.Where(d => d.Id == broken.Id).ExecuteUpdateAsync(s => s.SetProperty(d => d.DocumentJson, "{\"schema\":9}"));
            return (design.Id, broken.Id);
        });

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DtDbContext>();
        var stamp = await db.Design.AsNoTracking().Where(d => d.Id == id).Select(d => new { d.UpdateDate, d.Revision }).FirstAsync();
        var (designs, revisions) = await StartupFixes.UpgradeDocumentsAsync(db, NullLogger.Instance);
        Assert.True(designs >= 1);
        Assert.True(revisions >= 2);

        var upgraded = await db.Design.AsNoTracking().Where(d => d.Id == id).Select(d => new { d.DocumentJson, d.UpdateDate, d.Revision }).FirstAsync();
        var doc = DocumentValidator.Parse(upgraded.DocumentJson)!;
        Assert.Equal(2, doc.Schema);
        using (var json = JsonDocument.Parse(upgraded.DocumentJson))
        {
            Assert.Equal(2, json.RootElement.GetProperty("schema").GetInt32());
            Assert.False(json.RootElement.TryGetProperty("elements", out _));
        }

        Assert.Equal("flag-de", doc.Pages[0].Background.Asset);
        Assert.Equal("a", Assert.Single(doc.Pages[0].Elements).Id);
        Assert.Equal((stamp.UpdateDate, stamp.Revision), (upgraded.UpdateDate, upgraded.Revision));
        Assert.All(await db.DesignRevision.AsNoTracking().Where(r => r.DesignId == id).Select(r => r.DocumentJson).ToListAsync(), text => Assert.Contains("\"pages\"", text));

        // a document that cannot be read is left as it is (and does not stop the pass); a second pass has nothing left to do for the others
        using (var untouched = JsonDocument.Parse(await db.Design.AsNoTracking().Where(d => d.Id == corrupt).Select(d => d.DocumentJson).FirstAsync()))
        {
            Assert.Equal(9, untouched.RootElement.GetProperty("schema").GetInt32());
        }

        var again = await StartupFixes.UpgradeDocumentsAsync(db, NullLogger.Instance);
        Assert.Equal((0, 0), again);
    }

    [Fact]
    public async Task Earlier_uploads_move_to_Uploads_once_and_built_in_images_keep_their_category()
    {
        if (!Enabled)
        {
            return;
        }

        var key = await As(Role.Designer, async biz =>
        {
            var upload = await AssetLogic.UploadAsync(biz, Unique("alt-") + ".png", Png(), "Sonstiges");
            Assert.Equal("Sonstiges", upload.Asset!.Category);
            await biz.Db.Setting.Where(s => s.Key == StartupFixes.UploadsMarker).ExecuteDeleteAsync();
            return upload.Asset.Key;
        });

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<DtDbContext>();
            Assert.True(await StartupFixes.RenameUploadsCategoryAsync(db, NullLogger.Instance) >= 1);
            Assert.Equal(0, await StartupFixes.RenameUploadsCategoryAsync(db, NullLogger.Instance));
        }

        await As(Role.Designer, async biz =>
        {
            Assert.Equal("Uploads", (await AssetLogic.GetByKeyAsync(biz, key))!.Category);
            Assert.Equal("Flaggen", (await AssetLogic.GetByKeyAsync(biz, "flag-de"))!.Category);
            Assert.Equal("Siegel", (await AssetLogic.GetByKeyAsync(biz, "icon-bio"))!.Category);
        });

        // a person who chooses "Sonstiges" afterwards keeps it
        var later = await As(Role.Designer, biz => AssetLogic.UploadAsync(biz, Unique("spaeter-") + ".png", Png(), "Sonstiges"));
        using (var scope = Factory.Services.CreateScope())
        {
            await StartupFixes.RenameUploadsCategoryAsync(scope.ServiceProvider.GetRequiredService<DtDbContext>(), NullLogger.Instance);
        }

        Assert.Equal("Sonstiges", (await As(Role.Designer, biz => AssetLogic.GetByKeyAsync(biz, later.Asset!.Key)))!.Category);
    }

    // ------------------------------------------------------------------------------------------------ designs: tiles, templates, resize

    [Fact]
    public async Task A_tile_makes_a_design_of_its_size_with_one_empty_page()
    {
        if (!Enabled)
        {
            return;
        }

        await As(Role.Designer, async biz =>
        {
            var card = await DesignLogic.CreateFromFormatAsync(biz, "business-card", null, null, null, null);
            Assert.Equal("Unbenannt – Visitenkarte", card.Name);
            Assert.Equal((85d, 55d, "mm", 1), (card.Width, card.Height, card.Unit, card.Revision));
            var doc = DocumentValidator.Parse(card.DocumentJson)!;
            Assert.Equal(2, doc.Schema);
            var page = Assert.Single(doc.Pages);
            Assert.Empty(page.Elements);
            Assert.Equal("#ffffff", page.Background.Color);

            var story = await DesignLogic.CreateFromFormatAsync(biz, "instagram-story", null, null, null, "Meine Story");
            Assert.Equal(("Meine Story", 1080d, 1920d, "px"), (story.Name, story.Width, story.Height, story.Unit));

            var custom = await DesignLogic.CreateFromFormatAsync(biz, "custom", 120, 80.5, "mm", null);
            Assert.Equal(("Unbenanntes Design", 120d, 80.5), (custom.Name, custom.Width, custom.Height));
            var noPreset = await DesignLogic.CreateFromFormatAsync(biz, null, 800, 600, "px", null);
            Assert.Equal(("px", 800d), (noPreset.Unit, noPreset.Width));
        });
    }

    [Fact]
    public async Task A_tile_or_size_that_does_not_exist_is_refused()
    {
        if (!Enabled)
        {
            return;
        }

        await As(Role.Designer, async biz =>
        {
            Assert.Equal("Input.PresetKey", (await Assert.ThrowsAsync<BizException>(() => DesignLogic.CreateFromFormatAsync(biz, "nope", null, null, null, null))).Field);
            Assert.Equal("Input.Width", (await Assert.ThrowsAsync<BizException>(() => DesignLogic.CreateFromFormatAsync(biz, "custom", 1, 50, "mm", null))).Field);
            Assert.Equal("Input.Height", (await Assert.ThrowsAsync<BizException>(() => DesignLogic.CreateFromFormatAsync(biz, "custom", 50, 99999, "mm", null))).Field);
            await Assert.ThrowsAsync<BizException>(() => DesignLogic.CreateFromFormatAsync(biz, null, null, null, null, null));
            await Assert.ThrowsAsync<BizException>(() => DesignLogic.CreateFromFormatAsync(biz, "custom", 10, 10, "px", null));
        });
        // everybody may make a design in their own area; a team viewer may not write into the team, a stranger does not even know it
        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Viewer));
        await As(Role.Viewer, async biz =>
        {
            Assert.NotNull(await DesignLogic.CreateFromFormatAsync(biz, "a4-portrait", null, null, null, null));
            await Assert.ThrowsAsync<ForbiddenException>(() => DesignLogic.CreateFromFormatAsync(biz, "a4-portrait", null, null, null, null, team));
        });
        await As(Role.Stranger, biz => Assert.ThrowsAsync<NotFoundException>(() => DesignLogic.CreateFromFormatAsync(biz, "a4-portrait", null, null, null, null, team)));
    }

    [Fact]
    public async Task Using_a_template_makes_a_copy_and_leaves_the_template_alone()
    {
        if (!Enabled)
        {
            return;
        }

        var name = Unique("Vorlage ");
        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Viewer));
        var (template, copy, templateRevision) = await As(Role.Designer, async biz =>
        {
            var source = await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign(name, "Etiketten", "label-100x70", null, null, null, null, team));
            await DesignLogic.SaveDocumentAsync(biz, source.Id, 1, "{\"schema\":2,\"width\":100,\"height\":70,\"pages\":[{\"id\":\"a\",\"elements\":[{\"id\":\"t\",\"type\":\"text\",\"text\":\"Hallo\"}]},{\"id\":\"b\"}]}");
            await DesignLogic.UpdatePropertiesAsync(biz, source.Id, new DesignLogic.DesignInput(name, "Etiketten", "Beschreibung", true));
            await DesignLogic.SaveThumbnailAsync(biz, source.Id, Png());
            var made = await DesignLogic.UseTemplateAsync(biz, source.Id);
            return (source.Id, made, (await DesignLogic.GetAsync(biz, source.Id))!.Revision);
        });

        Assert.NotEqual(template, copy.Id);
        Assert.Equal((name, "Etiketten", "Beschreibung", false, 1), (copy.Name, copy.Category, copy.Description, copy.IsTemplate, copy.Revision));
        Assert.NotNull(copy.ThumbnailHash);
        Assert.Equal(2, DocumentValidator.Parse(copy.DocumentJson)!.Pages.Count);

        await As(Role.Viewer, async biz =>
        {
            var templates = await DesignLogic.TemplatesAsync(biz);
            Assert.Contains(templates, t => t.Id == template);
            Assert.DoesNotContain(templates, t => t.Id == copy.Id);
            Assert.All(templates, t => Assert.True(t.IsTemplate));
            var row = templates.Single(t => t.Id == template);
            Assert.Equal((100d, 70d, "mm"), (row.Width, row.Height, row.Unit));
            Assert.NotNull(row.ThumbnailUrl);
            Assert.Equal(templateRevision, (await DesignLogic.GetAsync(biz, template))!.Revision);
            // a team viewer uses it too: the copy is theirs, in their own area
            var theirs = await DesignLogic.UseTemplateAsync(biz, template);
            Assert.False(theirs.IsTemplate);
            Assert.Equal(await biz.PersonalSpaceIdAsync(), theirs.SpaceId);
        });
        await As(Role.Stranger, async biz => Assert.DoesNotContain(await DesignLogic.TemplatesAsync(biz), t => t.Id == template));

        await As(Role.Designer, async biz =>
        {
            await Assert.ThrowsAsync<BizException>(() => DesignLogic.UseTemplateAsync(biz, copy.Id));
            await Assert.ThrowsAsync<NotFoundException>(() => DesignLogic.UseTemplateAsync(biz, long.MaxValue));
        });
    }

    [Fact]
    public async Task Resizing_scales_every_page_saves_a_revision_and_keeps_the_history()
    {
        if (!Enabled)
        {
            return;
        }

        await As(Role.Designer, async biz =>
        {
            var design = await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign(Unique("Größe "), null, null, 100, 50, "mm", null));
            await DesignLogic.SaveDocumentAsync(biz, design.Id, 1, "{\"schema\":2,\"width\":100,\"height\":50,\"pages\":[{\"id\":\"a\",\"elements\":[{\"id\":\"t\",\"type\":\"text\",\"x\":10,\"y\":5,\"w\":40,\"h\":10,\"fontSize\":12}]},{\"id\":\"b\",\"elements\":[{\"id\":\"u\",\"type\":\"shape\",\"x\":0,\"y\":0,\"w\":100,\"h\":50}]}]}");

            var saved = await DesignLogic.ResizeAsync(biz, design.Id, 200, 200, "mm", true);
            Assert.Equal(3, saved.Revision);
            var doc = DocumentValidator.Parse(saved.DocumentJson)!;
            Assert.Equal((200d, 200d, "mm"), (doc.Width, doc.Height, doc.Unit));
            var text = Assert.IsType<TextElement>(doc.Pages[0].Elements[0]);
            Assert.Equal((20d, 60d, 80d, 20d, 24d), (text.X, text.Y, text.W, text.H, text.FontSize));
            var shape = doc.Pages[1].Elements[0];
            Assert.Equal((0d, 50d, 200d, 100d), (shape.X, shape.Y, shape.W, shape.H));

            var row = (await DesignLogic.GetAsync(biz, design.Id))!;
            Assert.Equal((200d, 200d, 3), (row.Width, row.Height, row.Revision));
            Assert.Equal([3, 2, 1], (await DesignLogic.RevisionsAsync(biz, design.Id)).Select(r => r.Revision));

            var kept = await DesignLogic.ResizeAsync(biz, design.Id, 300, 200, "mm", false);
            var keptDoc = DocumentValidator.Parse(kept.DocumentJson)!;
            Assert.Equal(4, kept.Revision);
            Assert.Equal((20d, 60d, 24d), (keptDoc.Pages[0].Elements[0].X, keptDoc.Pages[0].Elements[0].Y, ((TextElement)keptDoc.Pages[0].Elements[0]).FontSize));

            var px = await DesignLogic.ResizeAsync(biz, design.Id, 1080, 1080, "px", true);
            Assert.Equal("px", DocumentValidator.Parse(px.DocumentJson)!.Unit);
            Assert.Equal("px", (await DesignLogic.GetAsync(biz, design.Id))!.Unit);
        });
    }

    [Fact]
    public async Task Resizing_refuses_sizes_out_of_range_missing_designs_and_viewers()
    {
        if (!Enabled)
        {
            return;
        }

        var id = await As(Role.Designer, async biz =>
        {
            var design = await DesignLogic.CreateFromFormatAsync(biz, "a4-portrait", null, null, null, null);
            Assert.Equal("Input.Width", (await Assert.ThrowsAsync<BizException>(() => DesignLogic.ResizeAsync(biz, design.Id, 1, 100, "mm", true))).Field);
            Assert.Equal("Input.Height", (await Assert.ThrowsAsync<BizException>(() => DesignLogic.ResizeAsync(biz, design.Id, 100, 5001, "mm", true))).Field);
            Assert.Equal("Input.Width", (await Assert.ThrowsAsync<BizException>(() => DesignLogic.ResizeAsync(biz, design.Id, double.NaN, 100, "mm", true))).Field);
            Assert.Equal("Input.Width", (await Assert.ThrowsAsync<BizException>(() => DesignLogic.ResizeAsync(biz, design.Id, 15, 100, "px", true))).Field);
            await Assert.ThrowsAsync<NotFoundException>(() => DesignLogic.ResizeAsync(biz, long.MaxValue, 100, 100, "mm", true));
            return design.Id;
        });
        await ShareAsync(Role.Designer, ItemKind.Design, id, Role.Viewer);
        await As(Role.Viewer, biz => Assert.ThrowsAsync<ForbiddenException>(() => DesignLogic.ResizeAsync(biz, id, 100, 100, "mm", true)));
    }

    // ------------------------------------------------------------------------------------------------ the brand kit

    [Fact]
    public async Task The_brand_kit_is_saved_cleaned_and_read_by_everybody()
    {
        if (!Enabled)
        {
            return;
        }

        var team = await TeamAsync(Role.Designer, (Role.Viewer, SpaceRole.Viewer));
        var logo = await As(Role.Designer, async biz => (await AssetLogic.UploadAsync(biz, Unique("marke-") + ".png", Png(), "Logos", team)).Asset!.Key);
        var families = await As(Role.Viewer, biz => BrandLogic.FamiliesAsync(biz, team));
        Assert.Contains("Montserrat", families);

        await As(Role.Designer, async biz =>
        {
            var view = await BrandLogic.SaveAsync(biz, new BrandKit
            {
                Colors = ["#1FB3D6", "#abc", "#ABC", "#102030", "#1fb3d6"],
                Fonts = new BrandFonts { Heading = "montserrat", Subheading = "", Body = "Roboto Slab" },
                Logos = [logo.ToUpperInvariant(), logo],
            }, team);
            Assert.Equal(["#1fb3d6", "#aabbcc", "#102030"], view.Kit.Colors);
            Assert.Equal(("Montserrat", null, "Roboto Slab"), (view.Kit.Fonts.Heading, view.Kit.Fonts.Subheading, view.Kit.Fonts.Body));
            Assert.Equal([logo], view.Kit.Logos);
            Assert.Equal(logo, Assert.Single(view.LogoAssets).Key);
        });

        await As(Role.Viewer, async biz =>
        {
            var view = await BrandLogic.GetAsync(biz, team);
            Assert.Equal(["#1fb3d6", "#aabbcc", "#102030"], view.Kit.Colors);
            Assert.Equal("Montserrat", view.Kit.Fonts.Heading);
            Assert.Equal(logo, view.Kit.Logos.Single());
            Assert.StartsWith("/media/" + logo + "?v=", view.LogoAssets.Single().Url);
            await Assert.ThrowsAsync<ForbiddenException>(() => BrandLogic.SaveAsync(biz, new BrandKit(), team));
        });
    }

    [Fact]
    public async Task A_brand_kit_with_bad_colours_unknown_fonts_missing_logos_or_too_much_is_refused_as_a_whole()
    {
        if (!Enabled)
        {
            return;
        }

        await As(Role.Designer, async biz =>
        {
            await BrandLogic.SaveAsync(biz, new BrandKit { Colors = ["#112233"] });
            var tooManyColours = Enumerable.Range(0, 41).Select(i => "#" + i.ToString("x6")).ToList();
            var tooManyLogos = Enumerable.Range(0, 21).Select(i => "flag-de-" + i).ToList();

            Assert.Equal("Colors", (await Assert.ThrowsAsync<BizException>(() => BrandLogic.SaveAsync(biz, new BrandKit { Colors = ["#112233", "red"] }))).Field);
            Assert.Equal("Colors", (await Assert.ThrowsAsync<BizException>(() => BrandLogic.SaveAsync(biz, new BrandKit { Colors = ["url(javascript:1)"] }))).Field);
            Assert.Equal("Colors", (await Assert.ThrowsAsync<BizException>(() => BrandLogic.SaveAsync(biz, new BrandKit { Colors = ["#12345"] }))).Field);
            Assert.Equal("Colors", (await Assert.ThrowsAsync<BizException>(() => BrandLogic.SaveAsync(biz, new BrandKit { Colors = tooManyColours }))).Field);
            Assert.Equal("Fonts", (await Assert.ThrowsAsync<BizException>(() => BrandLogic.SaveAsync(biz, new BrandKit { Fonts = new BrandFonts { Body = "Es gibt mich nicht" } }))).Field);
            Assert.Equal("Logos", (await Assert.ThrowsAsync<BizException>(() => BrandLogic.SaveAsync(biz, new BrandKit { Logos = ["es gibt mich nicht!"] }))).Field);
            Assert.Equal("Logos", (await Assert.ThrowsAsync<BizException>(() => BrandLogic.SaveAsync(biz, new BrandKit { Logos = ["kein-solches-medium"] }))).Field);
            Assert.Equal("Logos", (await Assert.ThrowsAsync<BizException>(() => BrandLogic.SaveAsync(biz, new BrandKit { Logos = tooManyLogos }))).Field);

            // nothing of the refused requests was saved
            Assert.Equal(["#112233"], (await BrandLogic.GetAsync(biz)).Kit.Colors);
            Assert.Null((await BrandLogic.GetAsync(biz)).Kit.Fonts.Body);

            var forty = Enumerable.Range(0, 40).Select(i => "#" + (i + 1).ToString("x6")).ToList();
            Assert.Equal(40, (await BrandLogic.SaveAsync(biz, new BrandKit { Colors = forty })).Kit.Colors.Count);
        });
    }

    [Fact]
    public async Task A_deleted_logo_or_font_drops_out_of_the_brand_kit_when_it_is_read()
    {
        if (!Enabled)
        {
            return;
        }

        var (logoId, logo) = await As(Role.Designer, async biz =>
        {
            var upload = (await AssetLogic.UploadAsync(biz, Unique("weg-") + ".png", Png(), "Logos")).Asset!;
            await BrandLogic.SaveAsync(biz, new BrandKit { Logos = [upload.Key] });
            return (upload.Id, upload.Key);
        });
        await As(Role.Designer, async biz =>
        {
            Assert.Contains(logo, (await BrandLogic.GetAsync(biz)).Kit.Logos);
            await AssetLogic.DeleteAsync(biz, logoId);
            Assert.DoesNotContain(logo, (await BrandLogic.GetAsync(biz)).Kit.Logos);
            await BrandLogic.SaveAsync(biz, new BrandKit());
            Assert.Empty((await BrandLogic.GetAsync(biz)).Kit.Logos);
        });
    }

    // ------------------------------------------------------------------------------------------------ outputs with several pages

    private const string TwoPageDocument = """
        {"schema":2,"unit":"mm","width":85,"height":55,"dpi":300,
         "fields":[{"key":"Name","label":"Name","type":"text","sample":"Anna"},{"key":"Url","label":"Url","type":"text","sample":"https://example.org"}],
         "pages":[
           {"id":"front","elements":[{"id":"t","type":"text","text":"{{Name}}","fontFamily":"Montserrat"}]},
           {"id":"back","background":{"asset":"flag-nl"},"elements":[
             {"id":"g","type":"group","children":[{"id":"i","type":"image","source":{"asset":"icon-bio"}},{"id":"q","type":"qr","value":"{{Url}}"}]},
             {"id":"b","type":"barcode","value":"4006381333931","fontFamily":"Oswald"}]}]}
        """;

    [Fact]
    public async Task The_payload_of_a_design_with_pages_carries_all_pages_and_what_they_need()
    {
        if (!Enabled)
        {
            return;
        }

        await As(Role.Designer, async biz =>
        {
            var design = await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign(Unique("Zweiseitig "), null, "business-card", null, null, null, null));
            await DesignLogic.SaveDocumentAsync(biz, design.Id, 1, TwoPageDocument);
            var job = await OutputLogic.SaveAsync(biz, null, new OutputLogic.OutputInput(Unique("Karten "), design.Id, null, OutputRowSelection.All, [], 3, OutputMode.Single, null, false, OutputScale.Fit, 1, OutputFormat.Print, null, null));

            var payload = await OutputLogic.PayloadAsync(biz, job.Id);
            Assert.Equal((3L, 2, 6L), (payload.LabelCount, payload.Pages, payload.UnitCount));
            Assert.Equal(2, DocumentValidator.Parse(payload.DocumentJson)!.Pages.Count);
            // the pictures and fonts of the second page and of the group
            Assert.Contains("flag-nl", payload.Assets.Keys);
            Assert.Contains("icon-bio", payload.Assets.Keys);
            Assert.Contains(payload.Fonts, f => f.Family == "Oswald");
            Assert.Contains(payload.Fonts, f => f.Family == "Montserrat");
            Assert.Empty(payload.Warnings);

            var adhoc = await OutputLogic.AdhocPayloadAsync(biz, new AdhocRequest(design.Id, new Dictionary<string, string> { ["Name"] = "Hand" }, 2, "single", null, false, null, 1, "print", null, null));
            Assert.Equal((2L, 2, 4L), (adhoc.LabelCount, adhoc.Pages, adhoc.UnitCount));
        });
    }

    [Fact]
    public async Task A_design_that_is_still_stored_as_schema_1_is_read_as_schema_2_by_the_payload()
    {
        if (!Enabled)
        {
            return;
        }

        await As(Role.Designer, async biz =>
        {
            var design = await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign(Unique("Alt "), null, "label-150x100", null, null, null, null));
            await biz.Db.Design.Where(d => d.Id == design.Id).ExecuteUpdateAsync(s => s.SetProperty(d => d.DocumentJson, SchemaOneDocument));
            using (var loaded = JsonDocument.Parse((await DesignLogic.LoadAsync(biz, design.Id))!.DocumentJson))
            {
                Assert.Equal(2, loaded.RootElement.GetProperty("schema").GetInt32());
            }

            var payload = await OutputLogic.AdhocPayloadAsync(biz, new AdhocRequest(design.Id, null, 1, "single", null, false, null, 1, "print", null, null));
            using var json = JsonDocument.Parse(payload.DocumentJson);
            Assert.Equal(2, json.RootElement.GetProperty("schema").GetInt32());
            Assert.Equal(1, json.RootElement.GetProperty("pages").GetArrayLength());
            Assert.Equal((1, 1L), (payload.Pages, payload.UnitCount));
            Assert.Contains("flag-de", payload.Assets.Keys);
        });
    }

    [Fact]
    public async Task An_output_may_not_draw_more_pieces_than_the_limit()
    {
        if (!Enabled)
        {
            return;
        }

        var pages = string.Join(",", Enumerable.Range(0, 50).Select(i => "{\"id\":\"s" + i + "\"}"));
        await As(Role.Designer, async biz =>
        {
            var design = await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign(Unique("Fünfzig "), null, "a4-portrait", null, null, null, null));
            await DesignLogic.SaveDocumentAsync(biz, design.Id, 1, "{\"schema\":2,\"width\":210,\"height\":297,\"pages\":[" + pages + "]}");

            OutputLogic.OutputInput Job(int copies) => new(Unique("Viele "), design.Id, null, OutputRowSelection.All, [], copies, OutputMode.Single, null, false, OutputScale.Fit, 1, OutputFormat.Print, null, null);
            var refused = await Assert.ThrowsAsync<BizException>(() => OutputLogic.SaveAsync(biz, null, Job(100)));
            Assert.Contains("50 Seiten", refused.Message);
            Assert.Equal("Input.Copies", refused.Field);

            var ok = await OutputLogic.SaveAsync(biz, null, Job(80));
            Assert.Equal(4000L, (await OutputLogic.PayloadAsync(biz, ok.Id)).UnitCount);
            await biz.Db.OutputJob.Where(j => j.Id == ok.Id).ExecuteUpdateAsync(s => s.SetProperty(j => j.Copies, 81));
            await Assert.ThrowsAsync<BizException>(() => OutputLogic.PayloadAsync(biz, ok.Id));
        });
    }

    [Fact]
    public async Task Export_and_import_carry_the_media_of_every_page_and_group()
    {
        if (!Enabled)
        {
            return;
        }

        var key = Unique("seite2-");
        var (bytes, design) = await As(Role.Designer, async biz =>
        {
            await AssetLogic.UploadAsync(biz, key + ".png", Png(), null);
            var created = await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign(Unique("Paket "), null, "business-card", null, null, null, null));
            await DesignLogic.SaveDocumentAsync(biz, created.Id, 1, "{\"schema\":2,\"width\":85,\"height\":55,\"pages\":[{\"id\":\"a\"},{\"id\":\"b\",\"elements\":[{\"id\":\"g\",\"type\":\"group\",\"children\":[{\"id\":\"i\",\"type\":\"image\",\"source\":{\"asset\":\"" + key + "\"}}]}]}]}");
            return ((await DesignPackageLogic.ExportAsync(biz, created.Id)).Bytes, created);
        });

        var read = DesignPackageFormat.Read(bytes);
        Assert.True(read.Ok, read.Error);
        Assert.Equal([key], read.Package!.Assets.Select(a => a.Key));
        Assert.Equal(2, DocumentValidator.Parse(read.Package.DocumentJson)!.Pages.Count);

        // another picture under the same key: the import puts the new one under key-2 and the group on page 2 points to it
        await As(Role.Designer, async biz =>
        {
            var existing = await AssetLogic.GetByKeyAsync(biz, key);
            await AssetLogic.ReplaceFileAsync(biz, existing!.Id, OtherPng());
            var result = await DesignPackageLogic.ImportAsync(biz, bytes);
            Assert.Equal([(key, key + "-2")], result.AssetsRenamed);
            var imported = DocumentValidator.Parse(result.Design.DocumentJson)!;
            Assert.Equal(2, imported.Pages.Count);
            Assert.Equal(key + "-2", Assert.Single(Placeholders.AssetKeys(imported)));
            Assert.NotEqual(design.Id, result.Design.Id);
        });
    }
}
