using DesignThix.Core.Documents;
using DesignThix.Data;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.Services;
using DesignThix.Tests.Core;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace DesignThix.Tests.Integration;

/// <summary>
/// The library, the data lists and the designs against a real PostgreSQL (see <see cref="AppTests"/>): seeding, the rules of the roles, uploads, revisions.
/// Runs when DESIGNTHIX_TEST_DB names a server; returns at once otherwise.
/// </summary>
[Collection("app")]
public sealed class LibraryTests(AppTests.AppFactory factory) : PlatformTestBase(factory)
{
    private static byte[] Png() => File.ReadAllBytes(Path.Combine(RepoFiles.WwwRoot(), "img", "icon-192.png"));

    private static string Unique(string prefix) => prefix + Guid.NewGuid().ToString("N")[..8];

    // ------------------------------------------------------------------------------------------------ seeding

    [Fact]
    public async Task The_built_in_library_is_seeded_once_and_a_deleted_built_in_stays_deleted()
    {
        if (!Enabled)
        {
            return;
        }

        var (assets, fonts, sheets) = await As(Role.Viewer, async biz => (await biz.Db.Asset.CountAsync(a => a.IsBuiltIn), await biz.Db.Font.CountAsync(f => f.IsBuiltIn), await biz.Db.SheetLayout.CountAsync(s => s.IsBuiltIn)));
        Assert.True(assets >= 36);
        Assert.True(fonts >= 17);
        Assert.Equal(6, sheets);

        await LibrarySeeder.SeedAsync(Factory.Services, RepoFiles.WwwRoot(), NullLogger.Instance);
        var again = await As(Role.Viewer, async biz => await biz.Db.Asset.CountAsync(a => a.IsBuiltIn));
        Assert.Equal(assets, again);

        // An administrator deletes a flag and renames a seal (what the platform owns is theirs to manage): neither comes back at the next start.
        await As(Role.Admin, async biz =>
        {
            var flag = await AssetLogic.GetByKeyAsync(biz, "flag-fi") ?? throw new InvalidOperationException("flag-fi is not seeded");
            await AssetLogic.DeleteAsync(biz, flag.Id);
            var seal = await AssetLogic.GetByKeyAsync(biz, "icon-bio") ?? throw new InvalidOperationException("icon-bio is not seeded");
            await AssetLogic.UpdateAsync(biz, seal.Id, new AssetLogic.AssetInput("mein-bio", seal.Name, seal.Category, seal.Tags));
        });
        await LibrarySeeder.SeedAsync(Factory.Services, RepoFiles.WwwRoot(), NullLogger.Instance);
        await As(Role.Viewer, async biz =>
        {
            Assert.Null(await AssetLogic.GetByKeyAsync(biz, "flag-fi"));
            Assert.Null(await AssetLogic.GetByKeyAsync(biz, "icon-bio"));
            Assert.NotNull(await AssetLogic.GetByKeyAsync(biz, "mein-bio"));
            Assert.Equal(assets - 1, await biz.Db.Asset.CountAsync(a => a.IsBuiltIn));
        });
    }

    // ------------------------------------------------------------------------------------------------ roles

    [Fact]
    public async Task A_member_who_may_only_view_reads_but_changes_nothing_of_what_was_shared_with_them()
    {
        if (!Enabled)
        {
            return;
        }

        var (design, list) = await As(Role.Designer, async biz =>
        {
            var d = await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign("Teilen", null, "a4-portrait", null, null, null, null));
            var l = await DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput("Teilen", null, false));
            return (d.Id, l.Id);
        });
        await ShareAsync(Role.Designer, ItemKind.Design, design, Role.Viewer);
        await ShareAsync(Role.Designer, ItemKind.DataList, list, Role.Viewer);
        var builtIn = await Db(db => db.Asset.Where(a => a.IsBuiltIn).Select(a => a.Id).FirstAsync());
        await As(Role.Viewer, async biz =>
        {
            Assert.NotEmpty(await AssetLogic.SearchAsync(biz, "deutsch", null, 10));
            Assert.NotEmpty(await FontLogic.AllAsync(biz));
            Assert.NotNull(await DesignLogic.GetAsync(biz, design));
            Assert.False((await DataListLogic.GridAsync(biz, list)).CanEdit);
            await Assert.ThrowsAsync<ForbiddenException>(() => AssetLogic.DeleteAsync(biz, builtIn));
            await Assert.ThrowsAsync<ForbiddenException>(() => DataListLogic.SaveRowsAsync(biz, list, 1, []));
            await Assert.ThrowsAsync<ForbiddenException>(() => DataListLogic.ImportAsync(biz, list, new DataListLogic.ImportRequest("a", true, [], false)));
            await Assert.ThrowsAsync<ForbiddenException>(() => DesignLogic.SaveDocumentAsync(biz, design, 1, "{}"));
            await Assert.ThrowsAsync<ForbiddenException>(() => DesignLogic.SaveThumbnailAsync(biz, design, Png()));
            await Assert.ThrowsAsync<ForbiddenException>(() => DesignLogic.RenameAsync(biz, design, "x"));
            await Assert.ThrowsAsync<ForbiddenException>(() => DesignLogic.DeleteAsync(biz, design));
            // what is not shared with them is not even there
            await Assert.ThrowsAsync<NotFoundException>(() => DesignLogic.RenameAsync(biz, long.MaxValue, "x"));
            // their own area is theirs to fill
            Assert.NotNull((await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign("Meins", null, "a4-portrait", null, null, null, null))).Name);
        });
    }

    // ------------------------------------------------------------------------------------------------ media

    [Fact]
    public async Task Uploads_get_a_key_from_the_file_name_and_a_suffix_when_it_is_taken()
    {
        if (!Enabled)
        {
            return;
        }

        var name = Unique("kaese");
        await As(Role.Designer, async biz =>
        {
            var first = await AssetLogic.UploadAsync(biz, name + ".png", Png(), "Logos");
            var second = await AssetLogic.UploadAsync(biz, name + ".png", Png(), "Logos");
            Assert.Equal(name, first.Asset!.Key);
            Assert.Equal(name + "-2", second.Asset!.Key);
            Assert.Equal(192, first.Asset.Width);
            Assert.Equal("image/png", first.Asset.ContentType);
            Assert.Equal("Logos", first.Asset.Category);

            var content = await AssetLogic.ContentAsync(biz, name.ToUpperInvariant(), null);
            Assert.NotNull(content?.Bytes);
            Assert.Equal(first.Asset.ContentHash, content!.ContentHash);
            Assert.Null((await AssetLogic.ContentAsync(biz, name, content.ContentHash))!.Bytes);

            // A deleted upload waits in the trash and holds its key; once it is purged the key is free again.
            await AssetLogic.DeleteAsync(biz, first.Asset.Id);
            Assert.Null(await AssetLogic.ContentAsync(biz, name, null));
            var held = await AssetLogic.UploadAsync(biz, name + ".png", Png(), "Logos");
            Assert.Equal(name + "-3", held.Asset!.Key);
            await ItemLogic.PurgeAsync(biz, [new ItemRef(ItemKind.Asset, first.Asset.Id)]);
            var third = await AssetLogic.UploadAsync(biz, name + ".png", Png(), "Logos");
            Assert.Equal(name, third.Asset!.Key);

            await Assert.ThrowsAsync<BizException>(() => AssetLogic.UpdateAsync(biz, third.Asset.Id, new AssetLogic.AssetInput(name + "-2", "x", "Logos", null)));
        });
    }

    [Fact]
    public async Task Uploads_with_the_same_name_at_the_same_moment_all_get_a_key_of_their_own()
    {
        if (!Enabled)
        {
            return;
        }

        var name = Unique("zugleich");
        var keys = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ => As(Role.Designer, async biz =>
            (await AssetLogic.UploadAsync(biz, name + ".png", Png(), null)).Asset?.Key)));
        Assert.All(keys, key => Assert.NotNull(key));
        Assert.Equal(6, keys.Distinct().Count());
    }

    [Theory]
    [InlineData("..\\..\\etc\\passwd.png")]
    [InlineData("../../Fotos/Käse & Brot <b>.png")]
    [InlineData("   .png")]
    [InlineData("a‮gnp.exe.png")]
    public async Task Odd_file_names_give_a_plain_key_and_nothing_of_the_path(string fileName)
    {
        if (!Enabled)
        {
            return;
        }

        await As(Role.Designer, async biz =>
        {
            var result = await AssetLogic.UploadAsync(biz, fileName, Png(), "../../x");
            var key = result.Asset!.Key;
            Assert.Matches("^[a-z0-9][a-z0-9_-]{0,63}$", key);
            Assert.Equal(AssetLogic.UploadsCategory, result.Asset.Category);
        });
    }

    [Fact]
    public async Task A_hostile_svg_is_cleaned_before_it_is_stored_and_garbage_is_refused()
    {
        if (!Enabled)
        {
            return;
        }

        var hostile = System.Text.Encoding.UTF8.GetBytes("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\"><script>alert(1)</script><rect width=\"20\" height=\"20\" onclick=\"x()\"/></svg>");
        await As(Role.Designer, async biz =>
        {
            var result = await AssetLogic.UploadAsync(biz, Unique("boese") + ".svg", hostile, null);
            Assert.NotNull(result.Asset);
            Assert.NotEmpty(result.Cleaned);
            var stored = await AssetLogic.ContentAsync(biz, result.Asset!.Key, null);
            var text = System.Text.Encoding.UTF8.GetString(stored!.Bytes!);
            Assert.DoesNotContain("script", text);
            Assert.DoesNotContain("onclick", text);
            Assert.Equal("svg", stored.Extension);

            var garbage = await AssetLogic.UploadAsync(biz, "kein-bild.png", System.Text.Encoding.UTF8.GetBytes("nope"), null);
            Assert.Null(garbage.Asset);
            Assert.NotNull(garbage.Error);
        });
    }

    [Fact]
    public async Task The_usage_of_a_key_is_found_in_designs_and_data_rows()
    {
        if (!Enabled)
        {
            return;
        }

        await As(Role.Designer, async biz =>
        {
            var key = (await AssetLogic.UploadAsync(biz, Unique("usage-") + ".png", Png(), null)).Asset!.Key;
            var design = await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign("Nutzt " + key, null, "label-150x100", null, null, null, null));
            var base_ = DocumentValidator.Create(150, 100);
            var document = base_ with { Pages = [base_.Pages[0] with { Background = new BackgroundDef("#ffffff", null, key, "cover") }] };
            await DesignLogic.SaveDocumentAsync(biz, design.Id, 1, DocumentValidator.ToJson(document));

            var list = await DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput("Nutzt " + key, null, false));
            await DataListLogic.SaveColumnsAsync(biz, list.Id, [new DesignThix.Core.Data.ColumnDef("Land", "Land", "image", null, null)]);
            await DataListLogic.SaveRowsAsync(biz, list.Id, 2, [new GridRow(null, new Dictionary<string, string> { ["Land"] = key }, 1, true)]);

            var usage = await AssetLogic.UsageAsync(biz, key);
            Assert.Contains(usage.Designs, d => d.Id == design.Id);
            Assert.Contains(usage.DataLists, l => l.Id == list.Id);
            Assert.Empty((await AssetLogic.UsageAsync(biz, key + "x")).Designs);
        });
    }

    // ------------------------------------------------------------------------------------------------ data lists

    [Fact]
    public async Task The_grid_saves_the_whole_set_against_a_revision()
    {
        if (!Enabled)
        {
            return;
        }

        await As(Role.Designer, async biz =>
        {
            var list = await DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput(Unique("Liste "), null, false));
            await DataListLogic.SaveColumnsAsync(biz, list.Id, [new("Name", "Name", "text", null, null), new("Preis", "Preis", "price", 2, null)]);
            var grid = await DataListLogic.GridAsync(biz, list.Id);
            Assert.Equal(2, grid.Revision);
            Assert.True(grid.CanEdit);

            var (revision, ids) = await DataListLogic.SaveRowsAsync(biz, list.Id, grid.Revision, [
                new GridRow(null, new Dictionary<string, string> { ["Name"] = "Gouda", ["Preis"] = "2,99", ["Unbekannt"] = "weg" }, 1, true),
                new GridRow(null, new Dictionary<string, string> { ["name"] = "Edamer" }, 5000, false),
            ]);
            Assert.Equal(3, revision);
            Assert.Equal(2, ids.Count);

            var loaded = await DataListLogic.GridAsync(biz, list.Id);
            Assert.Equal(["Gouda", "Edamer"], loaded.Rows.Select(r => r.Values["Name"]));
            Assert.DoesNotContain("Unbekannt", loaded.Rows[0].Values.Keys);
            Assert.Equal(999, loaded.Rows[1].Copies);
            Assert.False(loaded.Rows[1].IsActive);

            // A stale revision is a conflict and changes nothing; a row that is left out is deleted; the order is the order sent.
            var conflict = await Assert.ThrowsAsync<RevisionConflictException>(() => DataListLogic.SaveRowsAsync(biz, list.Id, 2, []));
            Assert.Equal(3, conflict.CurrentRevision);
            var (next, nextIds) = await DataListLogic.SaveRowsAsync(biz, list.Id, 3, [new GridRow(ids[1], new Dictionary<string, string> { ["Name"] = "Edamer" }, 1, true), new GridRow(ids[0], new Dictionary<string, string> { ["Name"] = "Gouda" }, 1, true)]);
            Assert.Equal(4, next);
            Assert.Equal([ids[1], ids[0]], nextIds);
            Assert.Equal(["Edamer", "Gouda"], (await DataListLogic.GridAsync(biz, list.Id)).Rows.Select(r => r.Values["Name"]));
        });
    }

    [Fact]
    public async Task A_csv_is_exported_and_read_in_again_with_a_mapping()
    {
        if (!Enabled)
        {
            return;
        }

        await As(Role.Designer, async biz =>
        {
            var list = await DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput(Unique("Csv "), null, false));
            var csv = "Name;Preis in €;Gereift\r\n\"Gouda; jung\";2,99;\"4\r\nWochen\"\r\nBergkäse;4;\r\n";
            var preview = await DataListLogic.PreviewImportAsync(biz, list.Id, csv, true);
            Assert.Equal(';', preview.Delimiter);
            Assert.Equal(2, preview.RowCount);
            Assert.Equal(["@new", "@new", "@new"], preview.SuggestedMapping);

            var imported = await DataListLogic.ImportAsync(biz, list.Id, new DataListLogic.ImportRequest(csv, true, preview.SuggestedMapping, false));
            Assert.Equal(2, imported);
            var grid = await DataListLogic.GridAsync(biz, list.Id);
            Assert.Equal(["Name", "Preisin", "Gereift"], grid.Columns.Select(c => c.Key));
            Assert.Equal("Gouda; jung", grid.Rows[0].Values["Name"]);
            Assert.Equal("4\r\nWochen", grid.Rows[0].Values["Gereift"]);
            Assert.Equal("price", grid.Columns[1].Type);

            var (bytes, fileName) = await DataListLogic.ExportCsvAsync(biz, list.Id);
            Assert.EndsWith(".csv", fileName);
            Assert.Equal([0xEF, 0xBB, 0xBF], bytes[..3]);
            var exported = TextDecoder.Decode(bytes);
            Assert.StartsWith($"Name;{grid.Columns[1].Key};Gereift;_Kopien;_Aktiv\r\n", exported);

            // Importing the export again with "replace" gives the same rows (the helper columns come back as copies and active).
            var again = await DataListLogic.PreviewImportAsync(biz, list.Id, exported, true);
            Assert.Equal(["Name", grid.Columns[1].Key, "Gereift", "@copies", "@active"], again.SuggestedMapping);
            await DataListLogic.ImportAsync(biz, list.Id, new DataListLogic.ImportRequest(exported, true, again.SuggestedMapping, true));
            var after = await DataListLogic.GridAsync(biz, list.Id);
            Assert.Equal(grid.Rows.Select(r => r.Values["Name"]), after.Rows.Select(r => r.Values["Name"]));
            Assert.Equal("4\r\nWochen", after.Rows[0].Values["Gereift"]);
        });
    }

    // ------------------------------------------------------------------------------------------------ designs

    [Fact]
    public async Task A_design_is_saved_normalised_against_a_revision_and_the_history_keeps_thirty()
    {
        if (!Enabled)
        {
            return;
        }

        await As(Role.Designer, async biz =>
        {
            var design = await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign(Unique("Etikett "), "Käse", "label-150x100", null, null, null, null));
            Assert.Equal(150, design.Width);
            Assert.Equal("mm", design.Unit);

            var dirty = """{"schema":1,"width":150,"height":100,"bogus":true,"fields":[{"key":"Name","type":"text","sample":"Gouda"}],"elements":[{"id":"a","type":"text","text":"{{Name}}","fontSize":99999,"color":"nope","extra":1}]}""";
            var saved = await DesignLogic.SaveDocumentAsync(biz, design.Id, 1, dirty);
            Assert.Equal(2, saved.Revision);
            Assert.DoesNotContain("bogus", saved.DocumentJson);
            Assert.DoesNotContain("extra", saved.DocumentJson);
            var document = DocumentValidator.Parse(saved.DocumentJson)!;
            Assert.Equal(1000, ((TextElement)document.Pages[0].Elements[0]).FontSize);
            Assert.Equal("#000000", ((TextElement)document.Pages[0].Elements[0]).Color);

            var conflict = await Assert.ThrowsAsync<RevisionConflictException>(() => DesignLogic.SaveDocumentAsync(biz, design.Id, 1, dirty));
            Assert.Equal(2, conflict.CurrentRevision);
            await Assert.ThrowsAsync<BizException>(() => DesignLogic.SaveDocumentAsync(biz, design.Id, 2, "not json"));

            var revision = saved.Revision;
            for (var i = 0; i < 34; i++)
            {
                revision = (await DesignLogic.SaveDocumentAsync(biz, design.Id, revision, saved.DocumentJson)).Revision;
            }

            var history = await DesignLogic.RevisionsAsync(biz, design.Id);
            Assert.Equal(DesignLogic.KeptRevisions, history.Count);
            Assert.Equal(revision, history[0].Revision);

            // Restoring an old state makes it the newest revision.
            var oldest = history[^1].Revision;
            var restored = await DesignLogic.RestoreAsync(biz, design.Id, oldest);
            Assert.Equal(revision + 1, restored.Revision);
            await Assert.ThrowsAsync<BizException>(() => DesignLogic.RestoreAsync(biz, design.Id, 1));
        });
    }

    [Fact]
    public async Task Autosaves_of_one_person_share_one_history_entry_and_an_explicit_save_starts_a_new_one()
    {
        if (!Enabled)
        {
            return;
        }

        await As(Role.Designer, async biz =>
        {
            var design = await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign(Unique("Autosave "), "Käse", "label-150x100", null, null, null, null));
            var json = """{"schema":2,"width":150,"height":100,"pages":[{"id":"p1","elements":[]}]}""";
            var revision = 1;
            for (var i = 0; i < 5; i++)
            {
                revision = (await DesignLogic.SaveDocumentAsync(biz, design.Id, revision, json, autosave: true)).Revision;
            }

            Assert.Equal(6, revision);
            var history = await DesignLogic.RevisionsAsync(biz, design.Id);
            Assert.Single(history);                              // all five autosaves refreshed the one entry that was there
            Assert.Equal(6, history[0].Revision);

            // a save the person asked for is a new entry, and the autosaves after it share the next one
            revision = (await DesignLogic.SaveDocumentAsync(biz, design.Id, revision, json)).Revision;
            revision = (await DesignLogic.SaveDocumentAsync(biz, design.Id, revision, json, autosave: true)).Revision;
            revision = (await DesignLogic.SaveDocumentAsync(biz, design.Id, revision, json, autosave: true)).Revision;
            history = await DesignLogic.RevisionsAsync(biz, design.Id);
            Assert.Equal([9, 6], history.Select(h => h.Revision).ToArray());
        });
    }

    [Fact]
    public async Task The_designer_renames_a_design_and_saves_its_own_version_as_a_copy_after_a_conflict()
    {
        if (!Enabled)
        {
            return;
        }

        await As(Role.Designer, async biz =>
        {
            var design = await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign(Unique("Umbenennen "), "Käse", "label-150x100", null, null, null, null));
            Assert.Equal("Neuer Name", await DesignLogic.RenameAsync(biz, design.Id, "  Neuer Name  "));
            Assert.Equal("Neuer Name", (await DesignLogic.GetAsync(biz, design.Id))!.Name);
            Assert.Equal(1, (await DesignLogic.GetAsync(biz, design.Id))!.Revision);
            await Assert.ThrowsAsync<BizException>(() => DesignLogic.RenameAsync(biz, design.Id, "   "));
            await Assert.ThrowsAsync<NotFoundException>(() => DesignLogic.RenameAsync(biz, long.MaxValue, "x"));

            // somebody saved meanwhile: the document of this person becomes a new design (own history, revision 1), the original stays as it is
            await DesignLogic.SaveDocumentAsync(biz, design.Id, 1, """{"schema":1,"width":150,"height":100,"elements":[]}""");
            var mine = """{"schema":1,"width":150,"height":100,"fields":[{"key":"Name","type":"text","sample":"Mein"}],"elements":[{"id":"a","type":"text","text":"{{Name}}","bogus":1}]}""";
            var copy = await DesignLogic.CopyWithDocumentAsync(biz, design.Id, mine);
            Assert.NotEqual(design.Id, copy.Id);
            Assert.Equal("Neuer Name (Kopie)", copy.Name);
            Assert.Equal(1, copy.Revision);
            Assert.False(copy.IsTemplate);
            var copied = (await DesignLogic.DocumentAsync(biz, copy.Id));
            Assert.Equal("Name", copied.Fields.Single().Key);
            Assert.Single(copied.Pages[0].Elements);
            Assert.Empty((await DesignLogic.DocumentAsync(biz, design.Id)).Pages[0].Elements);
            await Assert.ThrowsAsync<BizException>(() => DesignLogic.CopyWithDocumentAsync(biz, design.Id, "not json"));
            await Assert.ThrowsAsync<NotFoundException>(() => DesignLogic.CopyWithDocumentAsync(biz, long.MaxValue, mine));
        });
    }

    [Fact]
    public async Task A_thumbnail_must_be_a_png_and_a_design_from_a_template_copies_its_document()
    {
        if (!Enabled)
        {
            return;
        }

        await As(Role.Designer, async biz =>
        {
            var template = await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign(Unique("Vorlage "), null, null, 85, 55, "mm", null));
            await DesignLogic.UpdatePropertiesAsync(biz, template.Id, new DesignLogic.DesignInput(template.Name, "Karten", "Eine Vorlage", true));
            var doc = """{"schema":1,"unit":"mm","width":85,"height":55,"fields":[{"key":"Name","type":"text","sample":"Anna"}],"elements":[]}""";
            await DesignLogic.SaveDocumentAsync(biz, template.Id, 1, doc);

            await DesignLogic.SaveThumbnailAsync(biz, template.Id, Png());
            Assert.NotNull((await DesignLogic.ThumbnailAsync(biz, template.Id))?.Bytes);
            Assert.Contains("thumbnail.png?v=", (await DesignLogic.GetAsync(biz, template.Id))!.ThumbnailUrl);
            await Assert.ThrowsAsync<BizException>(() => DesignLogic.SaveThumbnailAsync(biz, template.Id, System.Text.Encoding.UTF8.GetBytes("not a png")));
            await Assert.ThrowsAsync<BizException>(() => DesignLogic.SaveThumbnailAsync(biz, template.Id, new byte[DesignLogic.MaxThumbnailBytes + 1]));

            var copy = await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign("Aus Vorlage", null, null, null, null, null, template.Id));
            Assert.Equal(85, copy.Width);
            Assert.Equal("Karten", copy.Category);
            Assert.False(copy.IsTemplate);
            Assert.Equal("Name", (await DesignLogic.DocumentAsync(biz, copy.Id)).Fields.Single().Key);
            Assert.Contains(await DesignLogic.ChoicesAsync(biz, true), c => c.Id == template.Id);
            Assert.DoesNotContain(await DesignLogic.ChoicesAsync(biz, true), c => c.Id == copy.Id);

            var duplicate = await DesignLogic.DuplicateAsync(biz, template.Id);
            Assert.EndsWith("(Kopie)", duplicate.Name);
            Assert.False(duplicate.IsTemplate);

            await DesignLogic.DeleteAsync(biz, copy.Id);
            Assert.Null(await DesignLogic.GetAsync(biz, copy.Id));
        });
    }

    [Fact]
    public async Task A_custom_size_is_checked_and_a_sheet_layout_is_saved()
    {
        if (!Enabled)
        {
            return;
        }

        await As(Role.Designer, async biz =>
        {
            await Assert.ThrowsAsync<BizException>(() => DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign("x", null, "custom", 1, 100, "mm", null)));
            await Assert.ThrowsAsync<BizException>(() => DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign("", null, "a4-portrait", null, null, null, null)));
            var px = await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign(Unique("Post "), null, "instagram-post", null, null, null, null));
            Assert.Equal("px", px.Unit);
            Assert.Equal(1080, px.Width);

            var sheet = await SheetLogic.SaveAsync(biz, null, new SheetLogic.SheetInput(Unique("Bogen "), 210, 297, 10, 10, 2, 2, 90, 130, 5, 5, true));
            Assert.True((await SheetLogic.GetAsync(biz, sheet.Id))!.CropMarks);
            await Assert.ThrowsAsync<BizException>(() => SheetLogic.SaveAsync(biz, sheet.Id, new SheetLogic.SheetInput("zu breit", 210, 297, 10, 10, 3, 2, 90, 130, 5, 5, true)));
            await SheetLogic.DeleteAsync(biz, sheet.Id);
            Assert.Null(await SheetLogic.GetAsync(biz, sheet.Id));
        });
    }
}
