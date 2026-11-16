using System.Diagnostics;
using System.Text.Json;
using MatCan.Logic;

namespace MatCan.Tests.Core;

/// <summary>
/// The icon search of the server (<c>Logic/IconSearch.cs</c>) must find what the editor finds (<c>D.iconSearch</c> in <c>designer.icons-de.js</c>): the same icons for the same words in the same order. The
/// fixture <c>Fixtures/icon-search.json</c> is what the JavaScript answered (made by <c>tools/icon-search-fixture.js</c>); a second test runs that script again where node is installed, so the fixture cannot go stale.
/// </summary>
public sealed class IconSearchTests
{
    private static string Repo() => Directory.GetParent(RepoFiles.WwwRoot())!.Parent!.Parent!.FullName;

    private static JsonElement Fixture()
    {
        var text = File.ReadAllText(Path.Combine(Repo(), "tests", "MatCan.Tests", "Fixtures", "icon-search.json"));
        return JsonDocument.Parse(text).RootElement.Clone();
    }

    [Fact]
    public void Every_query_of_the_fixture_gives_the_same_icons_in_the_same_order_as_the_editor()
    {
        var library = IconSearch.Load(RepoFiles.WwwRoot());
        var fixture = Fixture();
        Assert.Equal(fixture.GetProperty("total").GetInt32(), library.Names.Count);
        var checkedQueries = 0;
        foreach (var query in fixture.GetProperty("queries").EnumerateObject())
        {
            var expected = query.Value.GetProperty("first").EnumerateArray().Select(e => e.GetString()!).ToList();
            var found = IconSearch.Search(library, query.Name);
            Assert.True(query.Value.GetProperty("total").GetInt32() == found.Count, $"\"{query.Name}\": the editor found {query.Value.GetProperty("total").GetInt32()} icons, the server {found.Count}");
            Assert.True(expected.SequenceEqual(found.Take(expected.Count)), $"\"{query.Name}\": the order differs: editor {string.Join(",", expected.Take(8))} / server {string.Join(",", found.Take(8))}");
            checkedQueries++;
        }

        Assert.True(checkedQueries >= 80);
    }

    [Fact]
    public void German_words_find_the_nearest_icons_and_umlauts_do_not_matter()
    {
        var library = IconSearch.Load(RepoFiles.WwwRoot());
        Assert.Contains("pizza", IconSearch.Search(library, "käse"));
        Assert.Equal(IconSearch.Search(library, "käse"), IconSearch.Search(library, "kaese"));
        Assert.Equal(IconSearch.Search(library, "käse"), IconSearch.Search(library, "KASE"));
        Assert.Contains("heart", IconSearch.Search(library, "herz").Take(3));
        Assert.Empty(IconSearch.Search(library, "zzzzqq"));
        Assert.Equal(library.Names.Count, IconSearch.Search(library, "  ").Count);
        Assert.True(library.Exists("star"));
        Assert.False(library.Exists("kein-icon"));
        Assert.False(library.Exists(null));
    }

    [Theory]
    [InlineData("Käse", "kase")]
    [InlineData("STRASSE", "strasse")]
    [InlineData("Straße", "strasse")]
    [InlineData("Crème Brûlée", "creme brulee")]
    [InlineData("", "")]
    public void Fold_is_lower_case_without_diacritics(string text, string expected) => Assert.Equal(expected, IconSearch.Fold(text));

    [Fact]
    public async Task The_fixture_is_what_the_javascript_of_the_editor_answers_now()
    {
        var script = Path.Combine(Repo(), "tools", "icon-search-fixture.js");
        string output;
        try
        {
            using var process = Process.Start(new ProcessStartInfo("node", $"\"{script}\" --stdout") { RedirectStandardOutput = true, RedirectStandardError = true, StandardOutputEncoding = System.Text.Encoding.UTF8, UseShellExecute = false, CreateNoWindow = true })!;
            output = await process.StandardOutput.ReadToEndAsync();
            await process.WaitForExitAsync();
            if (process.ExitCode != 0)
            {
                return;
            }
        }
        catch (System.ComponentModel.Win32Exception)
        {
            return;   // node is not installed here: the fixture is checked where it is
        }

        using var now = JsonDocument.Parse(output);
        var stored = Fixture();
        Assert.True(JsonSerializer.Serialize(now.RootElement.GetProperty("queries")) == JsonSerializer.Serialize(stored.GetProperty("queries")),
            "Fixtures/icon-search.json is out of date: run node tools/icon-search-fixture.js and commit the result.");
    }
}
