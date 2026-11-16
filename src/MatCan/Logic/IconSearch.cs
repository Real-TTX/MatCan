using System.Collections.Concurrent;
using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace MatCan.Logic;

/// <summary>
/// The Lucide icons as the server knows them for the design assistant: the names in the order of <c>wwwroot/lib/icons.json</c>, their English search words, and the German word list of the editor
/// (<c>wwwroot/js/designer.icons-de.js</c>, read from that file: the editor and the server share ONE list). Built once per web root and kept.
/// </summary>
public sealed class IconLibrary
{
    internal IconLibrary(List<string> names, Dictionary<string, string> folded, List<(string Key, HashSet<string> Icons)> words)
    {
        Names = names;
        Folded = folded;
        Words = words;
        NameSet = [.. names];
    }

    public IReadOnlyList<string> Names { get; }

    public HashSet<string> NameSet { get; }

    /// <summary>For every icon: its name with spaces for dashes and its English words, folded (what the search looks in).</summary>
    internal Dictionary<string, string> Folded { get; }

    /// <summary>The German words, folded, with the icons each one points to.</summary>
    internal List<(string Key, HashSet<string> Icons)> Words { get; }

    public bool Exists(string? name) => name is not null && NameSet.Contains(name);
}

/// <summary>
/// The icon search of the editor (<c>D.iconSearch</c>) in C#, so the assistant finds the same icons for the same word as the person does in the panel Elemente: umlauts folded ("käse", "kaese" and "kase" are one
/// word), several words must all match, an icon the German list names for the word comes first, then names that start with the word, then the rest in the order of the library. The test
/// <c>IconSearchTests</c> compares it with the JavaScript for a list of queries.
/// </summary>
public static partial class IconSearch
{
    private static readonly ConcurrentDictionary<string, IconLibrary> Cache = new(StringComparer.Ordinal);

    [GeneratedRegex(@"'([^']+)'\s*:\s*\[([^\]]*)\]")]
    private static partial Regex WordEntry();

    [GeneratedRegex(@"'([^']+)'")]
    private static partial Regex Quoted();

    /// <summary>The library of a web root (the folder with <c>lib/icons.json</c> and <c>js/designer.icons-de.js</c>); an empty library when the files are missing.</summary>
    public static IconLibrary Load(string webRoot) => Cache.GetOrAdd(Path.GetFullPath(webRoot), Read);

    private static IconLibrary Read(string root)
    {
        var names = new List<string>();
        var folded = new Dictionary<string, string>(StringComparer.Ordinal);
        var path = Path.Combine(root, "lib", "icons.json");
        if (File.Exists(path))
        {
            using var stream = File.OpenRead(path);
            using var doc = JsonDocument.Parse(stream);
            if (doc.RootElement.TryGetProperty("icons", out var icons) && icons.ValueKind == JsonValueKind.Object)
            {
                foreach (var icon in icons.EnumerateObject())
                {
                    names.Add(icon.Name);
                    var tags = icon.Value.TryGetProperty("t", out var t) && t.ValueKind == JsonValueKind.Array
                        ? string.Join(' ', t.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => x.GetString()))
                        : "";
                    folded[icon.Name] = Fold(icon.Name.Replace('-', ' ') + " " + tags);
                }
            }
        }

        var order = new List<string>();
        var values = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
        var wordsFile = Path.Combine(root, "js", "designer.icons-de.js");
        if (File.Exists(wordsFile))
        {
            var text = File.ReadAllText(wordsFile);
            var start = text.IndexOf("D.iconWordsDe = {", StringComparison.Ordinal);
            var end = start < 0 ? -1 : text.IndexOf("\n  };", start, StringComparison.Ordinal);
            if (start >= 0 && end > start)
            {
                foreach (Match entry in WordEntry().Matches(text[start..end]))
                {
                    var key = Fold(entry.Groups[1].Value);
                    var set = Quoted().Matches(entry.Groups[2].Value).Select(m => m.Groups[1].Value).ToHashSet(StringComparer.Ordinal);
                    // a key written twice: the later list wins, the place stays (as in a JavaScript object)
                    if (!values.ContainsKey(key))
                    {
                        order.Add(key);
                    }

                    values[key] = set;
                }
            }
        }

        return new IconLibrary(names, folded, [.. order.Select(k => (k, values[k]))]);
    }

    /// <summary>Lower case, no diacritics, ß = ss: "Käse" and "kase" are the same word (<c>D.fold</c>).</summary>
    public static string Fold(string? text)
    {
        var lower = (text ?? "").ToLowerInvariant();
        string decomposed;
        try
        {
            decomposed = lower.Normalize(NormalizationForm.FormD);
        }
        catch (Exception ex) when (ex is PlatformNotSupportedException or ArgumentException)
        {
            decomposed = lower;   // no normalisation on this system: the umlauts are mapped by hand below
        }

        var sb = new StringBuilder(decomposed.Length);
        foreach (var c in decomposed)
        {
            var category = CharUnicodeInfo.GetUnicodeCategory(c);
            if (category is UnicodeCategory.NonSpacingMark or UnicodeCategory.SpacingCombiningMark or UnicodeCategory.EnclosingMark)
            {
                continue;
            }

            sb.Append(c switch
            {
                'ä' => 'a',
                'ö' => 'o',
                'ü' => 'u',
                _ => c,
            });
        }

        return sb.ToString().Replace("ß", "ss", StringComparison.Ordinal);
    }

    /// <summary>The ways to write a typed word: folded, and with ae/oe/ue read as umlauts ("kaese" = "kase").</summary>
    private static string[] Variants(string term)
    {
        var t = Fold(term);
        var u = t.Replace("ae", "a", StringComparison.Ordinal).Replace("oe", "o", StringComparison.Ordinal).Replace("ue", "u", StringComparison.Ordinal);
        return u == t ? [t] : [t, u];
    }

    /// <summary>The icon names that match <paramref name="query"/>, best first (the whole library in its own order for an empty query).</summary>
    public static IReadOnlyList<string> Search(IconLibrary library, string? query)
    {
        var terms = Fold(query).Split([' ', '\t'], StringSplitOptions.RemoveEmptyEntries).Select(Variants).ToList();
        if (terms.Count == 0)
        {
            return library.Names;
        }

        var scored = new List<(string Name, double Score, int Index)>();
        for (var index = 0; index < library.Names.Count; index++)
        {
            var name = library.Names[index];
            var f = library.Folded[name];
            double score = 0;
            foreach (var variants in terms)
            {
                double s = 0;
                foreach (var t in variants)
                {
                    if (f.Contains(t, StringComparison.Ordinal))
                    {
                        s = Math.Max(s, name.StartsWith(t, StringComparison.Ordinal) ? 3 : f.Contains(" " + t, StringComparison.Ordinal) ? 2 : 1);
                    }

                    if (library.Words.Any(w => w.Key.StartsWith(t, StringComparison.Ordinal) && w.Icons.Contains(name)))
                    {
                        s = Math.Max(s, 2.5);
                    }
                }

                if (s == 0)
                {
                    score = 0;
                    break;
                }

                score += s;
            }

            if (score != 0)
            {
                scored.Add((name, score, index));
            }
        }

        return [.. scored.OrderByDescending(x => x.Score).ThenBy(x => x.Index).Select(x => x.Name)];
    }
}
