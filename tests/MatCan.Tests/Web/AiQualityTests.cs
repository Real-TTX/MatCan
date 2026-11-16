using System.Text.Json;
using System.Text.Json.Nodes;
using MatCan.Core.Documents;
using MatCan.Logic;
using MatCan.Tests.Core;
using Xunit.Abstractions;

namespace MatCan.Tests.Web;

/// <summary>The templates of the library as files (no database): rows for the search, documents for the lint.</summary>
internal static class TemplateFiles
{
    public sealed record Template(DesignRow Row, string Slug, JsonObject Document);

    private static List<Template>? _all;

    public static List<Template> All()
    {
        if (_all is not null)
        {
            return _all;
        }

        var dir = Path.Combine(Path.GetDirectoryName(Path.GetDirectoryName(RepoFiles.WwwRoot()))!, "MatCan", "Demo", "templates");
        var list = new List<Template>();
        var id = 1000L;
        foreach (var file in Directory.GetFiles(dir, "*.json").OrderBy(f => f, StringComparer.Ordinal))
        {
            var t = (JsonObject)JsonNode.Parse(File.ReadAllText(file))!;
            var doc = (JsonObject)t["document"]!;
            var row = new DesignRow
            {
                Id = ++id,
                Name = (string)t["name"]!,
                Category = (string?)t["category"],
                Description = (string?)t["description"],
                IsTemplate = true,
                Width = (double)doc["width"]!,
                Height = (double)doc["height"]!,
                Unit = (string?)doc["unit"] ?? "mm",
                TemplateFamily = (string?)t["family"],
                TemplateFamilyName = (string?)t["familyName"],
                TemplateVariant = (string?)t["variant"],
                TemplateOccasion = (string?)t["occasion"],
                TemplateTags = string.Join(", ", ((JsonArray?)t["tags"] ?? []).Select(x => (string)x!)),
                TemplateFormat = (string?)t["formatKey"],
                TemplateOrder = (int?)t["number"] ?? 0,
            };
            list.Add(new Template(row, Path.GetFileNameWithoutExtension(file), doc));
        }

        return _all = list;
    }
}

/// <summary>
/// The quality pass of the design assistant (docs/PLAN-AI-DESIGN.md): the search over the templates and the Deko pack, the font metrics, and the lint (over the whole library of templates: a professional template must
/// stay quiet, and every rule must catch what it is made for). Pure functions over files of the repository: no database.
/// </summary>
public sealed class AiQualityTests(ITestOutputHelper output)
{
    [Fact]
    public void Calibration_the_lint_over_every_template()
    {
        var report = Environment.GetEnvironmentVariable("AI_LINT_REPORT");
        if (string.IsNullOrEmpty(report))
        {
            return;
        }

        var lines = new List<string>();
        var counts = new Dictionary<string, int>();
        var templatesWithSerious = 0;
        foreach (var t in TemplateFiles.All())
        {
            var v = DocumentValidator.Validate(t.Document.ToJsonString());
            Assert.True(v.Ok, t.Slug);
            var findings = AiDesignLint.Check(v.Document!);
            var serious = findings.Where(f => f.Serious).ToList();
            if (serious.Count > 0)
            {
                templatesWithSerious++;
            }

            foreach (var f in findings)
            {
                counts[f.Code + (f.Serious ? "!" : "")] = counts.GetValueOrDefault(f.Code + (f.Serious ? "!" : "")) + 1;
                lines.Add($"{t.Slug}\t{f.Code}{(f.Serious ? "!" : "")}\t{f.Text}");
            }
        }

        lines.Insert(0, $"templates {TemplateFiles.All().Count}, with serious findings {templatesWithSerious}; " + string.Join(", ", counts.OrderByDescending(c => c.Value).Select(c => $"{c.Key}={c.Value}")));
        File.WriteAllLines(report, lines);
        output.WriteLine(lines[0]);
    }
}
