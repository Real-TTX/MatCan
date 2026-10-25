using DesignThix.Core.Documents;
using DesignThix.Core.Output;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.Services;
using DesignThix.Tests.Core;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DesignThix.Tests.Integration;

/// <summary>
/// Outputs, the payload of the run page, and export/import of designs against a real PostgreSQL (see <see cref="AppTests"/>): the rules of the roles, the checks of a save,
/// the labels of a payload (copies, selection, values), the media and fonts it carries, and what an import does with keys that are taken.
/// Runs when DESIGNTHIX_TEST_DB names a server; returns at once otherwise.
/// </summary>
[Collection("app")]
public sealed class OutputIntegrationTests(AppTests.AppFactory factory)
{
    private static bool Enabled => AppTests.AppFactory.Connection is not null;

    private async Task<T> As<T>(UserRole role, Func<Biz, Task<T>> action)
    {
        using var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope();
        var user = scope.ServiceProvider.GetRequiredService<ICurrentUser>();
        using var acting = user.RunAs(1, "Test", role);
        return await action(scope.ServiceProvider.GetRequiredService<Biz>());
    }

    private Task As(UserRole role, Func<Biz, Task> action) => As(role, async biz =>
    {
        await action(biz);
        return 0;
    });

    private static string Unique(string prefix) => prefix + Guid.NewGuid().ToString("N")[..8];

    private static byte[] Png() => File.ReadAllBytes(Path.Combine(RepoFiles.WwwRoot(), "img", "icon-192.png"));

    private static byte[] OtherPng() => [.. Png(), 0];

    /// <summary>Something that passes for a font (the signature of TrueType): the file sniffer looks at the first bytes only. The marker makes files differ.</summary>
    private static byte[] FakeFont(byte marker) => [0, 1, 0, 0, marker, 2, 3, 4, 5, 6, 7, 8];

    private const string DocumentText = """
        {"unit":"mm","width":150,"height":100,"dpi":300,
         "fields":[{"key":"Name","label":"Name","type":"text","sample":"Muster"},{"key":"Land","label":"Land","type":"image","sample":"flag-de"},{"key":"Preis","label":"Preis","type":"price","sample":"1.5"},{"key":"Nur","label":"Nur im Design","type":"text","sample":"Beispiel"}],
         "elements":[
           {"id":"t","type":"text","text":"{{Name}} {{Preis}}","fontFamily":"Montserrat","fontSize":12},
           {"id":"s","type":"imageStrip","items":[{"field":"Land"},{"asset":"icon-bio"}]}
         ]}
        """;

    /// <summary>A design with the document above and a list "Name, Preis, Land" with the given rows (name, copies, active, land).</summary>
    private static async Task<(Design Design, DataList List, List<long> RowIds)> SetUpAsync(Biz biz, params (string Name, int Copies, bool Active, string Land)[] rows)
    {
        var design = await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign(Unique("Ausgabe "), null, "label-150x100", null, null, null, null));
        await DesignLogic.SaveDocumentAsync(biz, design.Id, 1, DocumentText);
        var list = await DataListLogic.SaveGeneralAsync(biz, null, new DataListLogic.ListInput(Unique("Liste "), null, false));
        await DataListLogic.SaveColumnsAsync(biz, list.Id, [new("Name", "Name", "text", null, null), new("preis", "Preis", "price", 2, null), new("Land", "Land", "image", null, null)]);
        var (_, ids) = await DataListLogic.SaveRowsAsync(biz, list.Id, 2, [.. rows.Select(r => new GridRow(null, new Dictionary<string, string> { ["Name"] = r.Name, ["preis"] = "2,5", ["Land"] = r.Land }, r.Copies, r.Active))]);
        return (design, list, ids);
    }

    private static OutputLogic.OutputInput Input(Design design, DataList? list, string name = "Test", OutputRowSelection selection = OutputRowSelection.All, IReadOnlyList<long>? selected = null, int copies = 1,
        OutputMode mode = OutputMode.Single, long? sheet = null, int start = 1, OutputFormat format = OutputFormat.Print, int? dpi = null, string? pattern = null)
        => new(name, design.Id, list?.Id, selection, selected ?? [], copies, mode, sheet, true, OutputScale.Fit, start, format, dpi, pattern);

    private static async Task<long> SheetIdAsync(Biz biz, string builtInKey) => (await biz.Db.SheetLayout.AsNoTracking().FirstAsync(s => s.BuiltInKey == builtInKey)).Id;

    // ------------------------------------------------------------------------------------------------ roles

    [Fact]
    public async Task A_viewer_runs_and_reads_but_changes_nothing()
    {
        if (!Enabled)
        {
            return;
        }

        var (design, job) = await As(UserRole.Designer, async biz =>
        {
            var set = await SetUpAsync(biz, ("Gouda", 1, true, "flag-nl"));
            return (set.Design, await OutputLogic.SaveAsync(biz, null, Input(set.Design, set.List)));
        });

        await As(UserRole.Viewer, async biz =>
        {
            Assert.Contains(await OutputLogic.Query(biz).ToListAsync(), o => o.Id == job.Id);
            Assert.NotNull(await OutputLogic.GetAsync(biz, job.Id));
            var payload = await OutputLogic.PayloadAsync(biz, job.Id);
            Assert.Equal(1, payload.LabelCount);
            await OutputLogic.MarkRanAsync(biz, job.Id);
            var adhoc = await OutputLogic.AdhocPayloadAsync(biz, new AdhocRequest(design.Id, new Dictionary<string, string> { ["Name"] = "Hand" }, 2, "single", null, false, null, 1, "print", null, null));
            Assert.Equal(2, adhoc.LabelCount);

            await Assert.ThrowsAsync<ForbiddenException>(() => OutputLogic.SaveAsync(biz, null, Input(design, null)));
            await Assert.ThrowsAsync<ForbiddenException>(() => OutputLogic.SaveAsync(biz, job.Id, Input(design, null)));
            await Assert.ThrowsAsync<ForbiddenException>(() => OutputLogic.DeleteAsync(biz, job.Id));
            await Assert.ThrowsAsync<ForbiddenException>(() => DesignPackageLogic.ExportAsync(biz, design.Id));
            await Assert.ThrowsAsync<ForbiddenException>(() => DesignPackageLogic.ImportAsync(biz, [1, 2, 3]));
        });
    }

    [Fact]
    public async Task Nobody_without_a_session_reads_a_payload()
    {
        if (!Enabled)
        {
            return;
        }

        using var scope = factory.Services.CreateScope();
        var biz = scope.ServiceProvider.GetRequiredService<Biz>();
        await Assert.ThrowsAsync<ForbiddenException>(() => OutputLogic.PayloadAsync(biz, 1));
        await Assert.ThrowsAsync<ForbiddenException>(() => OutputLogic.AdhocPayloadAsync(biz, new AdhocRequest(1, null, 1, null, null, false, null, 1, null, null, null)));
        await Assert.ThrowsAsync<ForbiddenException>(() => OutputLogic.MarkRanAsync(biz, 1));
    }

    // ------------------------------------------------------------------------------------------------ saving

    [Fact]
    public async Task A_save_checks_name_design_selection_copies_sheet_and_resolution()
    {
        if (!Enabled)
        {
            return;
        }

        await As(UserRole.Designer, async biz =>
        {
            var (design, list, ids) = await SetUpAsync(biz, ("A", 1, true, ""), ("B", 1, true, ""));
            var a4 = await SheetIdAsync(biz, "a4-2x4");

            Assert.Equal("Input.Name", (await Assert.ThrowsAsync<BizException>(() => OutputLogic.SaveAsync(biz, null, Input(design, list, name: "  ")))).Field);
            Assert.Equal("Input.DesignId", (await Assert.ThrowsAsync<BizException>(() => OutputLogic.SaveAsync(biz, null, Input(design, list) with { DesignId = 0 }))).Field);
            Assert.Equal("Input.SelectedRowIds", (await Assert.ThrowsAsync<BizException>(() => OutputLogic.SaveAsync(biz, null, Input(design, list, selection: OutputRowSelection.Selected, selected: [999999])))).Field);
            Assert.Equal("Input.Copies", (await Assert.ThrowsAsync<BizException>(() => OutputLogic.SaveAsync(biz, null, Input(design, list, copies: 0)))).Field);
            Assert.Equal("Input.Copies", (await Assert.ThrowsAsync<BizException>(() => OutputLogic.SaveAsync(biz, null, Input(design, list, copies: 1000)))).Field);
            Assert.Equal("Input.DataListId", (await Assert.ThrowsAsync<BizException>(() => OutputLogic.SaveAsync(biz, null, Input(design, list) with { DataListId = 999999 }))).Field);
            Assert.Equal("Input.SheetLayoutId", (await Assert.ThrowsAsync<BizException>(() => OutputLogic.SaveAsync(biz, null, Input(design, list, mode: OutputMode.Sheet)))).Field);
            Assert.Equal("Input.StartPosition", (await Assert.ThrowsAsync<BizException>(() => OutputLogic.SaveAsync(biz, null, Input(design, list, mode: OutputMode.Sheet, sheet: a4, start: 9)))).Field);
            Assert.Equal("Input.StartPosition", (await Assert.ThrowsAsync<BizException>(() => OutputLogic.SaveAsync(biz, null, Input(design, list, mode: OutputMode.Sheet, sheet: a4, start: 0)))).Field);
            Assert.Equal("Input.Dpi", (await Assert.ThrowsAsync<BizException>(() => OutputLogic.SaveAsync(biz, null, Input(design, list, format: OutputFormat.Png, dpi: 601)))).Field);
            Assert.Equal("Input.Dpi", (await Assert.ThrowsAsync<BizException>(() => OutputLogic.SaveAsync(biz, null, Input(design, list, format: OutputFormat.Png, dpi: 71)))).Field);
            Assert.Equal("Input.FileNamePattern", (await Assert.ThrowsAsync<BizException>(() => OutputLogic.SaveAsync(biz, null, Input(design, list, pattern: new string('x', 201))))).Field);
        });
    }

    [Fact]
    public async Task A_job_keeps_what_applies_and_drops_what_does_not()
    {
        if (!Enabled)
        {
            return;
        }

        await As(UserRole.Designer, async biz =>
        {
            var (design, list, ids) = await SetUpAsync(biz, ("A", 2, true, ""), ("B", 1, false, ""), ("C", 1, true, ""));
            var a4 = await SheetIdAsync(biz, "a4-2x4");

            var sheet = await OutputLogic.SaveAsync(biz, null, Input(design, list, name: "  Bogen  ", selection: OutputRowSelection.Selected, selected: [ids[0], ids[2], ids[0], 424242], copies: 2, mode: OutputMode.Sheet, sheet: a4, start: 3));
            Assert.Equal("Bogen", sheet.Name);
            Assert.Equal([ids[0], ids[2]], OutputLogic.SelectedIds(sheet.SelectedRowIdsJson));
            Assert.Equal((OutputMode.Sheet, a4, 3, true, 300), (sheet.Mode, sheet.SheetLayoutId, sheet.StartPosition, sheet.CropMarks, sheet.Dpi));
            Assert.Equal(OutputLogic.DefaultFileNamePattern, sheet.FileNamePattern);

            // PNG has no sheet; a job without a list prints the samples and has nothing to select; the resolution is the design's when none is given.
            var png = await OutputLogic.SaveAsync(biz, null, Input(design, null, selection: OutputRowSelection.Selected, selected: [1], mode: OutputMode.Sheet, sheet: a4, start: 3, format: OutputFormat.Png, pattern: "{Name}"));
            Assert.Equal((OutputMode.Single, (long?)null, 1, false, 300, OutputRowSelection.All, "[]", "{Name}"), (png.Mode, png.SheetLayoutId, png.StartPosition, png.CropMarks, png.Dpi, png.RowSelection, png.SelectedRowIdsJson, png.FileNamePattern));
            Assert.Null(png.DataListId);

            var changed = await OutputLogic.SaveAsync(biz, sheet.Id, Input(design, list, name: "Bogen 2", selection: OutputRowSelection.Active));
            Assert.Equal(sheet.Id, changed.Id);
            Assert.Equal((OutputRowSelection.Active, "[]", OutputMode.Single, (long?)null), (changed.RowSelection, changed.SelectedRowIdsJson, changed.Mode, changed.SheetLayoutId));
            await Assert.ThrowsAsync<BizException>(() => OutputLogic.SaveAsync(biz, 424242, Input(design, list)));

            await OutputLogic.DeleteAsync(biz, png.Id);
            Assert.Null(await OutputLogic.GetAsync(biz, png.Id));
            await Assert.ThrowsAsync<BizException>(() => OutputLogic.DeleteAsync(biz, png.Id));
            await Assert.ThrowsAsync<BizException>(() => OutputLogic.PayloadAsync(biz, png.Id));
        });
    }

    [Fact]
    public async Task The_label_counts_of_the_list_follow_the_rows_as_they_are_now()
    {
        if (!Enabled)
        {
            return;
        }

        await As(UserRole.Designer, async biz =>
        {
            var (design, list, ids) = await SetUpAsync(biz, ("A", 2, true, ""), ("B", 3, false, ""), ("C", 1, true, ""));
            var all = await OutputLogic.SaveAsync(biz, null, Input(design, list, selection: OutputRowSelection.All, copies: 2));
            var active = await OutputLogic.SaveAsync(biz, null, Input(design, list, selection: OutputRowSelection.Active));
            var chosen = await OutputLogic.SaveAsync(biz, null, Input(design, list, selection: OutputRowSelection.Selected, selected: [ids[1]]));
            var samples = await OutputLogic.SaveAsync(biz, null, Input(design, null, copies: 5));
            var rows = await OutputLogic.Query(biz).Where(o => new[] { all.Id, active.Id, chosen.Id, samples.Id }.Contains(o.Id)).ToListAsync();
            var counts = await OutputLogic.LabelCountsAsync(biz, rows);
            Assert.Equal(new OutputLogic.LabelCount(12, 3), counts[all.Id]);
            Assert.Equal(new OutputLogic.LabelCount(3, 2), counts[active.Id]);
            Assert.Equal(new OutputLogic.LabelCount(3, 1), counts[chosen.Id]);
            Assert.Equal(new OutputLogic.LabelCount(5, null), counts[samples.Id]);
            Assert.All(rows, r => Assert.Equal(design.Name, r.DesignName));
        });
    }

    // ------------------------------------------------------------------------------------------------ the payload

    [Fact]
    public async Task The_payload_has_the_labels_in_order_with_their_copies_and_the_values_of_the_list_over_the_samples()
    {
        if (!Enabled)
        {
            return;
        }

        await As(UserRole.Designer, async biz =>
        {
            var (design, list, ids) = await SetUpAsync(biz, ("Gouda", 2, true, "FLAG-NL"), ("Edamer", 1, false, "flag-nl"), ("Brie", 1, true, "flag-fr"));
            var job = await OutputLogic.SaveAsync(biz, null, Input(design, list, selection: OutputRowSelection.Active, copies: 3, mode: OutputMode.Sheet, sheet: await SheetIdAsync(biz, "a4-2x2-a6"), start: 2));
            var payload = await OutputLogic.PayloadAsync(biz, job.Id);

            Assert.Equal((job.Id, "sheet", "print", 9L, 2, "fit"), (payload.Id, payload.Mode, payload.Format, payload.LabelCount, payload.StartPosition, payload.Scale));
            Assert.Equal([ids[0], ids[2]], payload.Labels.Select(l => l.RowId!.Value));
            Assert.Equal([6, 3], payload.Labels.Select(l => l.Copies));
            Assert.Equal(("Gouda", "2,5", "FLAG-NL", "Beispiel"), (payload.Labels[0].Values["Name"], payload.Labels[0].Values["Preis"], payload.Labels[0].Values["Land"], payload.Labels[0].Values["Nur"]));
            Assert.Equal(("A4 quer · 4 × A6 · 2 × 2 · 148,5 × 105 mm", 2, 2, 148.5), (payload.Sheet!.Name, payload.Sheet.Columns, payload.Sheet.Rows, payload.Sheet.CellWidth));

            // media: the keys of the document and the ones in the rows (lower case), with the address that carries the hash
            Assert.Equal(["flag-de", "flag-fr", "flag-nl", "icon-bio"], payload.Assets.Keys.Order());
            Assert.All(payload.Assets.Values, url => Assert.Matches(@"^/media/[a-z0-9-]+\?v=[0-9a-f]{12}$", url));
            Assert.Equal(AssetLogic.Url("flag-nl", (await AssetLogic.GetByKeyAsync(biz, "flag-nl"))!.ContentHash), payload.Assets["flag-nl"]);
            // fonts: only the faces of the families the design uses
            Assert.NotEmpty(payload.Fonts);
            Assert.All(payload.Fonts, f => Assert.Equal("Montserrat", f.Family));
            // the field "Nur" has no column in the list: it keeps its sample, and the payload says so
            Assert.Equal("Beispiel", payload.Labels[1].Values["Nur"]);
            Assert.Equal(["Die Datenliste hat keine Spalte für „Nur“: dort steht der Beispielwert des Designs."], payload.Warnings);
        });
    }

    [Fact]
    public async Task The_payload_warns_about_missing_media_fonts_columns_and_an_empty_selection()
    {
        if (!Enabled)
        {
            return;
        }

        await As(UserRole.Designer, async biz =>
        {
            var (design, list, ids) = await SetUpAsync(biz, ("A", 1, true, "gibt-es-nicht"));
            var document = DocumentText.Replace("Montserrat", "Gibt Es Nicht Sans");
            await DesignLogic.SaveDocumentAsync(biz, design.Id, 2, document);
            var job = await OutputLogic.SaveAsync(biz, null, Input(design, list, selection: OutputRowSelection.Active));
            var payload = await OutputLogic.PayloadAsync(biz, job.Id);
            Assert.Contains(payload.Warnings, w => w.Contains("gibt-es-nicht") && w.StartsWith("Medien fehlen"));
            Assert.Contains(payload.Warnings, w => w.Contains("Gibt Es Nicht Sans"));
            Assert.Contains(payload.Warnings, w => w.Contains("Nur"));
            Assert.DoesNotContain("gibt-es-nicht", payload.Assets.Keys);
            Assert.Empty(payload.Fonts);

            // Rows that are switched off after the job was saved leave nothing to print: a warning, not an error.
            var rows = await DataListLogic.GridAsync(biz, list.Id);
            await DataListLogic.SaveRowsAsync(biz, list.Id, rows.Revision, [new GridRow(rows.Rows[0].Id, rows.Rows[0].Values, 1, false)]);
            var empty = await OutputLogic.PayloadAsync(biz, job.Id);
            Assert.Equal(0, empty.LabelCount);
            Assert.Contains(empty.Warnings, w => w.Contains("keine Zeile"));
        });
    }

    [Fact]
    public async Task A_payload_of_too_many_labels_is_refused_and_the_limit_is_the_one_of_the_plan()
    {
        if (!Enabled)
        {
            return;
        }

        await As(UserRole.Designer, async biz =>
        {
            var (design, list, _) = await SetUpAsync(biz, ("A", 999, true, ""), ("B", 999, true, ""), ("C", 999, true, ""));
            var error = await Assert.ThrowsAsync<BizException>(() => OutputLogic.SaveAsync(biz, null, Input(design, list)));
            Assert.Contains("höchstens 2.000", error.Message);
            var adhoc = await OutputLogic.AdhocPayloadAsync(biz, new AdhocRequest(design.Id, null, 999, "single", null, false, null, 1, "print", null, null));
            Assert.Equal(999, adhoc.LabelCount);
            Assert.Equal(2000, OutputPlan.MaxLabels);
        });
    }

    [Fact]
    public async Task A_single_print_keeps_only_the_fields_of_the_design_and_cuts_long_values()
    {
        if (!Enabled)
        {
            return;
        }

        await As(UserRole.Designer, async biz =>
        {
            var (design, _, _) = await SetUpAsync(biz, ("A", 1, true, ""));
            var values = new Dictionary<string, string> { ["name"] = new string('x', 5000), ["Preis"] = "4,5", ["Fremd"] = "nein", ["Land"] = "flag-ch" };
            var payload = await OutputLogic.AdhocPayloadAsync(biz, new AdhocRequest(design.Id, values, 0, "sheet", await SheetIdAsync(biz, "a4-2x4"), true, "none", 5, "print", 99, " {Name} "));
            Assert.Null(payload.Id);
            var label = Assert.Single(payload.Labels);
            Assert.Equal(1, label.Copies);
            Assert.Equal(2000, label.Values["Name"].Length);
            Assert.Equal(("4,5", "Beispiel", "flag-ch"), (label.Values["Preis"], label.Values["Nur"], label.Values["Land"]));
            Assert.DoesNotContain("Fremd", label.Values.Keys);
            Assert.Equal(("sheet", true, "none", 5, "{Name}", 99), (payload.Mode, payload.CropMarks, payload.Scale, payload.StartPosition, payload.FileNamePattern, payload.Dpi));
            Assert.Contains("flag-ch", payload.Assets.Keys);

            // PNG never has a sheet
            var png = await OutputLogic.AdhocPayloadAsync(biz, new AdhocRequest(design.Id, null, 1, "sheet", await SheetIdAsync(biz, "a4-2x4"), true, null, 1, "png", 700, null));
            Assert.Equal(("single", "png", 600, false, null), (png.Mode, png.Format, png.Dpi, png.CropMarks, png.Sheet));
            await Assert.ThrowsAsync<BizException>(() => OutputLogic.AdhocPayloadAsync(biz, new AdhocRequest(424242, null, 1, null, null, false, null, 1, null, null, null)));
            await Assert.ThrowsAsync<BizException>(() => OutputLogic.AdhocPayloadAsync(biz, new AdhocRequest(design.Id, null, 1, "sheet", 424242, false, null, 1, null, null, null)));
        });
    }

    [Fact]
    public async Task Running_a_job_notes_who_and_when_without_counting_as_a_change()
    {
        if (!Enabled)
        {
            return;
        }

        var (job, changedAt) = await As(UserRole.Designer, async biz =>
        {
            var (design, list, _) = await SetUpAsync(biz, ("A", 1, true, ""));
            var saved = await OutputLogic.SaveAsync(biz, null, Input(design, list));
            Assert.Null(saved.LastRunDate);
            return (saved.Id, saved.UpdateDate);
        });

        await As(UserRole.Viewer, biz => OutputLogic.MarkRanAsync(biz, job));
        await As(UserRole.Viewer, async biz =>
        {
            var row = await OutputLogic.Query(biz).FirstAsync(o => o.Id == job);
            Assert.NotNull(row.LastRunDate);
            Assert.True(Math.Abs((row.UpdateDate - changedAt).TotalMilliseconds) < 1, "a run is no change of the job");
            Assert.Equal(1, (await OutputLogic.GetAsync(biz, job))!.LastRunUserId);
            await Assert.ThrowsAsync<BizException>(() => OutputLogic.MarkRanAsync(biz, 424242));
        });
    }

    // ------------------------------------------------------------------------------------------------ export and import

    private static async Task<(Design Design, string LogoKey)> DesignWithMediaAsync(Biz biz, string logoKey, byte[] logo)
    {
        var upload = await AssetLogic.UploadAsync(biz, logoKey + ".png", logo, "Logos");
        Assert.Equal(logoKey, upload.Asset!.Key);
        var design = await DesignLogic.CreateAsync(biz, new DesignLogic.NewDesign(Unique("Export "), "Test", "label-150x100", null, null, null, null));
        var document = $$$"""
            {"unit":"mm","width":150,"height":100,"dpi":300,"background":{"color":"#ffffff","asset":"{{{logoKey}}}","fit":"cover"},
             "fields":[{"key":"Land","label":"Land","type":"image","sample":"{{{logoKey}}}"}],
             "elements":[
               {"id":"a","type":"image","source":{"asset":"{{{logoKey}}}"}},
               {"id":"b","type":"imageStrip","items":[{"asset":"flag-de"},{"field":"Land"},{"asset":"{{{logoKey}}}"}]},
               {"id":"c","type":"text","text":"x","fontFamily":"Montserrat"}
             ]}
            """;
        await DesignLogic.SaveDocumentAsync(biz, design.Id, 1, document);
        return (design, logoKey);
    }

    [Fact]
    public async Task An_export_carries_the_media_it_uses_and_no_built_in_font()
    {
        if (!Enabled)
        {
            return;
        }

        await As(UserRole.Designer, async biz =>
        {
            var (design, key) = await DesignWithMediaAsync(biz, Unique("logo-"), Png());
            var (bytes, name) = await DesignPackageLogic.ExportAsync(biz, design.Id);
            Assert.EndsWith(".dtx.json", name);
            var package = DesignPackageFormat.Read(bytes).Package!;
            Assert.Equal(design.Name, package.Name);
            Assert.Equal("Test", package.Category);
            Assert.Equal(["flag-de", key], package.Assets.Select(a => a.Key).Order());
            Assert.All(package.Assets, a => Assert.NotEmpty(a.Bytes));
            Assert.Empty(package.Fonts);

            // a font of our own that a text uses is packed with its faces
            var fontless = await FontLogic.UploadAsync(biz, "Eigene-Schrift.ttf", FakeFont(10), null);
            Assert.NotNull(fontless.Font);
            var custom = DocumentText.Replace("Montserrat", fontless.Font!.Family);
            await DesignLogic.SaveDocumentAsync(biz, design.Id, 2, custom);
            var withFont = DesignPackageFormat.Read((await DesignPackageLogic.ExportAsync(biz, design.Id)).Bytes).Package!;
            Assert.Equal(fontless.Font.Family, Assert.Single(withFont.Fonts).Family);
            await Assert.ThrowsAsync<BizException>(() => DesignPackageLogic.ExportAsync(biz, 424242));
        });
    }

    [Fact]
    public async Task An_import_reuses_media_with_the_same_content_and_renames_the_ones_that_clash()
    {
        if (!Enabled)
        {
            return;
        }

        await As(UserRole.Designer, async biz =>
        {
            var (design, key) = await DesignWithMediaAsync(biz, Unique("logo-"), Png());
            var (bytes, _) = await DesignPackageLogic.ExportAsync(biz, design.Id);

            // everything is there already: nothing is added, the keys stay
            var same = await DesignPackageLogic.ImportAsync(biz, bytes);
            Assert.Equal((0, 2, 0), (same.AssetsAdded, same.AssetsReused, same.AssetsRenamed.Count));
            Assert.Equal(design.Name, same.Design.Name);
            Assert.False(same.Design.IsTemplate);
            Assert.Equal(1, same.Design.Revision);
            Assert.Equal(DocumentValidator.ToJson(DocumentValidator.Parse((await biz.Db.Design.AsNoTracking().FirstAsync(d => d.Id == design.Id)).DocumentJson)!), same.Design.DocumentJson);

            // the key is taken by another picture: it comes in as key-2 and the document points to it, everywhere
            var logo = await AssetLogic.GetByKeyAsync(biz, key);
            await AssetLogic.ReplaceFileAsync(biz, logo!.Id, OtherPng());
            var clash = await DesignPackageLogic.ImportAsync(biz, bytes);
            Assert.Equal((1, 1), (clash.AssetsAdded, clash.AssetsReused));
            Assert.Equal([(key, key + "-2")], clash.AssetsRenamed);
            var imported = DocumentValidator.Parse(clash.Design.DocumentJson)!;
            Assert.Equal(key + "-2", imported.Pages[0].Background.Asset);
            Assert.Equal(key + "-2", imported.Fields.Single().Sample);
            Assert.Equal(key + "-2", ((ImageElement)imported.Pages[0].Elements[0]).Source!.Asset);
            var strip = (ImageStripElement)imported.Pages[0].Elements[1];
            Assert.Equal(("flag-de", "Land", key + "-2"), (strip.Items[0]!.Asset, strip.Items[1]!.Field, strip.Items[2]!.Asset));
            var added = await AssetLogic.GetByKeyAsync(biz, key + "-2");
            Assert.Equal(AssetLogic.Sha256Hex(Png()), added!.ContentHash);
            Assert.Equal("Logos", added.Category);

            // and once more: the old key still clashes with the changed picture, the first free key is key-3
            var again = await DesignPackageLogic.ImportAsync(biz, bytes);
            Assert.Equal((1, 1), (again.AssetsAdded, again.AssetsReused));
            Assert.Equal([(key, key + "-3")], again.AssetsRenamed);
        });
    }

    [Fact]
    public async Task An_import_checks_files_like_an_upload_and_changes_nothing_when_one_is_bad()
    {
        if (!Enabled)
        {
            return;
        }

        await As(UserRole.Designer, async biz =>
        {
            var designsBefore = await biz.Db.Design.CountAsync();
            var assetsBefore = await biz.Db.Asset.CountAsync();
            string Package(string assets, string fonts = "")
                => $$"""{"format":"designthix-design","version":1,"name":"Fremd","document":{"width":10,"height":10},"assets":[{{assets}}],"fonts":[{{fonts}}]}""";
            string B64(string text) => Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(text));
            var good = $$"""{"key":"{{Unique("ok-")}}","name":"Gut","category":"Icons","contentType":"image/png","base64":"{{Convert.ToBase64String(Png())}}"}""";

            async Task<string> Refused(string json) => (await Assert.ThrowsAsync<BizException>(() => DesignPackageLogic.ImportAsync(biz, System.Text.Encoding.UTF8.GetBytes(json)))).Message;
            Assert.Contains("kein Bild", await Refused(Package(good + $$""",{"key":"bad","name":"x","category":"Icons","contentType":"image/png","base64":"{{B64("not an image")}}"}""")));
            Assert.Contains("abgelehnt", await Refused(Package($$"""{"key":"bomb","name":"x","category":"Icons","contentType":"image/svg+xml","base64":"{{B64("<?xml version=\"1.0\"?><!DOCTYPE svg [<!ENTITY a \"aaaa\">]><svg xmlns=\"http://www.w3.org/2000/svg\"><text>&a;</text></svg>")}}"}""")));
            Assert.Contains("Schriftdatei", await Refused(Package(good, $$"""{"family":"Boese","weight":"400","style":"normal","format":"ttf","base64":"{{B64("this is not a font")}}"}""")));
            Assert.Contains("Design-Datei", await Refused("[]"));
            Assert.Contains("zu groß", (await Assert.ThrowsAsync<BizException>(() => DesignPackageLogic.ImportAsync(biz, new byte[(int)DesignPackageFormat.MaxFileBytes + 1]))).Message);

            // nothing was saved by the refused files
            Assert.Equal(designsBefore, await biz.Db.Design.CountAsync());
            Assert.Equal(assetsBefore, await biz.Db.Asset.CountAsync());

            // a hostile SVG that can be cleaned is cleaned, like an upload
            var svg = B64("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"10\" height=\"10\" onload=\"x()\"><script>x()</script><rect width=\"10\" height=\"10\"/></svg>");
            var key = Unique("svg-");
            var result = await DesignPackageLogic.ImportAsync(biz, System.Text.Encoding.UTF8.GetBytes(Package($$"""{"key":"{{key}}","name":"S","category":"Icons","contentType":"image/svg+xml","base64":"{{svg}}"}""")));
            var stored = await AssetLogic.ContentAsync(biz, key, null);
            Assert.DoesNotContain("script", System.Text.Encoding.UTF8.GetString(stored!.Bytes!));
            Assert.Equal(1, result.AssetsAdded);
        });
    }

    [Fact]
    public async Task An_import_adds_a_font_once_reuses_the_same_file_and_does_not_replace_a_face_with_other_content()
    {
        if (!Enabled)
        {
            return;
        }

        await As(UserRole.Designer, async biz =>
        {
            var family = Unique("Importfont ");
            var document = DocumentText.Replace("Montserrat", family);
            string B64(byte[] bytes) => Convert.ToBase64String(bytes);
            string Package(byte marker) => $$"""{"format":"designthix-design","version":1,"name":"Mit Schrift","document":{{document}},"assets":[],"fonts":[{"family":"{{family}}","weight":"400","style":"normal","format":"ttf","base64":"{{B64(FakeFont(marker))}}"}]}""";

            var first = await DesignPackageLogic.ImportAsync(biz, System.Text.Encoding.UTF8.GetBytes(Package(21)));
            Assert.Equal((1, 0), (first.FontsAdded, first.FontsReused));
            var font = await biz.Db.Font.AsNoTracking().SingleAsync(f => f.Family == family);
            Assert.Equal(("400", "normal", "ttf", false), (font.Weight, font.Style, font.Format, font.IsBuiltIn));
            Assert.DoesNotContain(first.Warnings, w => w.Contains(family));

            var second = await DesignPackageLogic.ImportAsync(biz, System.Text.Encoding.UTF8.GetBytes(Package(21)));
            Assert.Equal((0, 1), (second.FontsAdded, second.FontsReused));

            var other = await DesignPackageLogic.ImportAsync(biz, System.Text.Encoding.UTF8.GetBytes(Package(22)));
            Assert.Equal((0, 0), (other.FontsAdded, other.FontsReused));
            Assert.Contains(other.Warnings, w => w.Contains(family) && w.Contains("anderem Inhalt"));
            Assert.Equal(1, await biz.Db.Font.CountAsync(f => f.Family == family));

            // a family nobody has: the design comes in with a warning
            var lost = await DesignPackageLogic.ImportAsync(biz, System.Text.Encoding.UTF8.GetBytes($$"""{"format":"designthix-design","version":1,"name":"Ohne","document":{{document.Replace(family, "Niemand Hat Sie")}},"assets":[]}"""));
            Assert.Contains(lost.Warnings, w => w.Contains("Niemand Hat Sie"));
        });
    }
}
