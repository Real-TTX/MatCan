using System.Text.Json;
using DesignThix.Core.Data;
using DesignThix.Core.Documents;
using DesignThix.Data.Entities;
using DesignThix.Logic;
using DesignThix.Services;
using DesignThix.Tests.Core;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace DesignThix.Tests.Integration;

/// <summary>The file of the demo (<c>src/DesignThix/Demo/kaesetheke.json</c>): valid on its own, and seeded once into a new database.</summary>
[Collection("app")]
public sealed class DemoTests(AppTests.AppFactory factory)
{
    private static string DemoFile()
    {
        var wwwroot = RepoFiles.WwwRoot();
        return Path.Combine(Path.GetDirectoryName(wwwroot)!, "Demo", "kaesetheke.json");
    }

    private static JsonElement Root(out JsonDocument keep)
    {
        keep = JsonDocument.Parse(File.ReadAllText(DemoFile()));
        return keep.RootElement;
    }

    [Fact]
    public void The_demo_document_is_valid_without_a_single_correction_and_the_rows_fit_its_fields()
    {
        var root = Root(out var keep);
        using (keep)
        {
            var result = DocumentValidator.Validate(root.GetProperty("document").GetRawText());
            Assert.True(result.Ok, result.Error);
            Assert.Empty(result.Warnings);
            var document = result.Document!;
            Assert.Equal((150d, 100d, "mm"), (document.Width, document.Height, document.Unit));

            var keys = document.Fields.Select(f => f.Key).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var rows = root.GetProperty("rows").EnumerateArray().ToList();
            Assert.Equal(6, rows.Count);
            foreach (var row in rows)
            {
                Assert.All(row.EnumerateObject(), p => Assert.Contains(p.Name, keys));
            }

            Assert.Contains(rows, r => r.GetProperty("Gereift").GetString() == "" && r.GetProperty("Fett").GetString() == "");
            Assert.Contains(rows, r => r.GetProperty("Name").GetString() == "Holunderblüte" && r.GetProperty("Ort").GetString() == "Geifertshofen");
        }
    }

    [Fact]
    public void Every_picture_of_the_demo_is_a_built_in_medium_and_every_font_a_built_in_font()
    {
        var root = Root(out var keep);
        using (keep)
        {
            var builtin = JsonDocument.Parse(File.ReadAllText(Path.Combine(RepoFiles.WwwRoot(), "builtin", "builtin.json"))).RootElement.EnumerateArray()
                .Select(a => a.GetProperty("key").GetString()!).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var fonts = JsonDocument.Parse(File.ReadAllText(Path.Combine(RepoFiles.WwwRoot(), "fonts", "fonts.json"))).RootElement.EnumerateArray()
                .Select(f => f.GetProperty("family").GetString()!).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var document = DocumentValidator.Parse(root.GetProperty("document").GetRawText())!;

            var used = Placeholders.AssetKeys(document).Concat(document.Fields.Where(f => f.Type == "image").Select(f => f.Sample))
                .Concat(root.GetProperty("rows").EnumerateArray().SelectMany(r => r.EnumerateObject()).Where(p => p.Name is "Land" or "Icon1" or "Icon2" or "Icon3").Select(p => p.Value.GetString()!))
                .Where(k => k.Length > 0);
            Assert.All(used, key => Assert.Contains(key, builtin));
            Assert.All(Placeholders.FontFamilies(document), family => Assert.Contains(family, fonts));
        }
    }

    [Fact]
    public void The_name_keeps_its_margin_to_the_border_and_the_price_sits_left_of_the_euro_sign()
    {
        var root = Root(out var keep);
        using (keep)
        {
            var document = DocumentValidator.Parse(root.GetProperty("document").GetRawText())!;
            T Find<T>(string name) where T : DesignElement => document.Elements.OfType<T>().Single(e => e.Name == name);
            var name = Find<TextElement>("Name");
            Assert.True(name.X >= 4 && document.Width - (name.X + name.W) >= 4, "the name box needs 4 mm on both sides");
            Assert.Equal("bottom", name.Valign);
            var price = Find<TextElement>("Preis");
            var euro = Find<TextElement>("Euro");
            var unit = Find<TextElement>("Einheit");
            Assert.Equal("right", price.Align);
            Assert.True(price.X + price.W < euro.X, "the price box ends before the euro sign");
            Assert.True(price.X + price.W < unit.X, "the price box ends before the unit");
            var region = Find<TextElement>("Region");
            Assert.True(region.Y > name.Y + name.H, "the region sits below the name box, out of reach of its descenders");
            var logoLeft = Find<TextElement>("Logo: Käse");
            var logoRight = Find<TextElement>("Logo: Schneider");
            Assert.Equal("right", logoLeft.Align);
            Assert.Equal("left", logoRight.Align);
            Assert.True(logoLeft.X + logoLeft.W < logoRight.X + 0.5, "the two words of the logo meet at one place");
        }
    }

    [Fact]
    public async Task A_new_database_gets_the_demo_once_and_a_deleted_demo_stays_deleted()
    {
        if (AppTests.AppFactory.Connection is null)
        {
            return;
        }

        using var client = factory.CreateClient();
        async Task<T> As<T>(UserRole role, Func<Biz, Task<T>> action)
        {
            using var scope = factory.Services.CreateScope();
            using var acting = scope.ServiceProvider.GetRequiredService<ICurrentUser>().RunAs(1, "Test", role);
            return await action(scope.ServiceProvider.GetRequiredService<Biz>());
        }

        var (design, list, rows, job, sheetKey) = await As(UserRole.Viewer, async biz =>
        {
            var d = await biz.Db.Design.SingleAsync(x => x.Name == "Käsetheke – Preisschild");
            var l = await biz.Db.DataList.Include(x => x.Rows).SingleAsync(x => x.Name == "Käsetheke (Beispiel)");
            var j = await biz.Db.OutputJob.Include(x => x.SheetLayout).SingleAsync(x => x.Name == "Käsetheke – A4 mit 4 Etiketten");
            return (d, l, l.Rows.Count, j, j.SheetLayout?.BuiltInKey);
        });
        Assert.True(design.IsTemplate);
        Assert.Equal("Etiketten", design.Category);
        Assert.Equal((150d, 100d, "mm"), (design.Width, design.Height, design.Unit));
        Assert.Equal(6, rows);
        Assert.Contains(ColumnDefs.Parse(list.ColumnsJson), c => c.Key == "Preis" && c.Type == "price");
        Assert.Equal((OutputMode.Sheet, OutputScale.Fit, "a4-2x2-a6"), (job.Mode, job.Scale, sheetKey));
        Assert.Equal(design.Id, job.DesignId);
        Assert.Equal(list.Id, job.DataListId);

        // The next start adds nothing, and what a person deleted does not come back.
        await DemoSeeder.SeedAsync(factory.Services, NullLogger.Instance);
        await As(UserRole.Designer, async biz => { await OutputLogic.DeleteAsync(biz, job.Id); return 0; });
        await As(UserRole.Designer, async biz => { await DataListLogic.DeleteAsync(biz, list.Id); return 0; });
        await As(UserRole.Designer, async biz => { await DesignLogic.DeleteAsync(biz, design.Id); return 0; });
        await DemoSeeder.SeedAsync(factory.Services, NullLogger.Instance);
        var (designs, lists, jobs, marker) = await As(UserRole.Viewer, async biz => (
            await biz.Db.Design.CountAsync(x => x.Name == "Käsetheke – Preisschild"),
            await biz.Db.DataList.CountAsync(x => x.Name == "Käsetheke (Beispiel)"),
            await biz.Db.OutputJob.CountAsync(x => x.Name == "Käsetheke – A4 mit 4 Etiketten"),
            await biz.Db.Setting.CountAsync(s => s.Key == DemoSeeder.Marker)));
        Assert.Equal((0, 0, 0, 1), (designs, lists, jobs, marker));
    }
}
