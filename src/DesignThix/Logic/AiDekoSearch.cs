using System.Globalization;

namespace DesignThix.Logic;

/// <summary>
/// The search of the design assistant over the Deko pack (<c>search_deko</c>): the illustrations, frames, ornaments, dividers, patterns and motifs that come with the application (category "Deko" of the built-in
/// media, several hundred drawings, most of them in a few colours). It ranks them by a question in German ("Dinosaurier", "Rennauto", "Krone", "Rahmen Hochzeit gold"), folds the colour variants of one drawing into one
/// result (one key per colour) and says how wide the drawing is next to its height, so the model can place it without distorting it. Pure functions over the rows of the library.
/// </summary>
public static class AiDekoSearch
{
    public const int MaxLimit = 20;

    /// <summary>What the library knows of one piece of the pack.</summary>
    public sealed record Piece(string Key, string Name, string Tags, int? Width, int? Height);

    /// <summary>One drawing: its group, its title, the key of the variant to use (the wanted colour when there is one), the keys per colour, the proportions.</summary>
    public sealed record Drawing(string Group, string Title, string Key, IReadOnlyDictionary<string, string> Colours, int Width, int Height, double Score, string Quality)
    {
        public double Ratio => Height == 0 ? 1 : Math.Round((double)Width / Height, 2);
    }

    private sealed record Entry(string Group, string Title, string Stem, string Colour, string Key, int Width, int Height, string[] TitleWords, string[] GroupWords, string[] TagWords, string[] KeyWords);

    /// <summary>"Motive · Rennwagen" or "Rahmen · Doppellinie hoch (Gold)" into group, title and colour.</summary>
    public static (string Group, string Title, string Colour) Split(string name)
    {
        var parts = name.Split(" · ", 2);
        var group = parts.Length == 2 ? parts[0].Trim() : "";
        var rest = parts.Length == 2 ? parts[1].Trim() : name.Trim();
        var colour = "";
        if (rest.EndsWith(')') && rest.LastIndexOf('(') is var open and > 0)
        {
            colour = rest[(open + 1)..^1].Trim();
            rest = rest[..open].Trim();
        }

        return (group, rest, colour);
    }

    private static Entry? Prepare(Piece piece)
    {
        if (piece.Width is not > 0 || piece.Height is not > 0)
        {
            return null;
        }

        var (group, title, colour) = Split(piece.Name);
        var colourSlug = AiSearchText.Fold(colour).Replace(' ', '-');
        var stem = colourSlug.Length > 0 && piece.Key.EndsWith("-" + colourSlug, StringComparison.OrdinalIgnoreCase) ? piece.Key[..^(colourSlug.Length + 1)] : piece.Key;
        return new Entry(group, title, stem.ToLowerInvariant(), colourSlug, piece.Key, piece.Width.Value, piece.Height.Value,
            AiSearchText.Words(title), AiSearchText.Words(group), AiSearchText.Words(piece.Tags.Replace(',', ' ')), AiSearchText.Words(stem.Replace("deko-", "").Replace('-', ' ')));
    }

    private const double WTitle = 3.0, WGroup = 1.5, WTags = 2.5, WKey = 1.5;

    private static double Field(Entry e, string token)
    {
        var scores = new[]
        {
            AiSearchText.Quality(token, e.TitleWords) * WTitle,
            AiSearchText.Quality(token, e.GroupWords) * WGroup,
            AiSearchText.Quality(token, e.TagWords) * WTags,
            AiSearchText.Quality(token, e.KeyWords) * WKey,
        };
        var best = scores.Max();
        return best + (0.25 * (scores.Sum() - best));
    }

    /// <summary>The names of the groups of the pack in the order of the media browser.</summary>
    public static IReadOnlyList<string> Groups(IEnumerable<Piece> pieces)
        => [.. pieces.Select(p => Split(p.Name).Group).Where(g => g.Length > 0).Distinct(StringComparer.Ordinal).OrderBy(g => g, StringComparer.CurrentCultureIgnoreCase)];

    /// <summary>
    /// The drawings that fit the question, best first. <paramref name="group"/> narrows to one group ("Motive", "Rahmen"), <paramref name="colour"/> picks that colour where a drawing has it. A drawing that
    /// comes in several colours is ONE result with a key per colour. Without any word the first drawings of the group (or of the pack) are listed.
    /// </summary>
    public static (List<Drawing> Drawings, string? Note) Search(IEnumerable<Piece> pieces, string? query, string? group, string? colour, int limit)
    {
        limit = Math.Clamp(limit, 1, MaxLimit);
        var entries = pieces.Select(Prepare).OfType<Entry>().ToList();
        string? note = null;
        if (!string.IsNullOrWhiteSpace(group))
        {
            var wanted = AiSearchText.Fold(group.Trim());
            var narrowed = entries.Where(e => AiSearchText.Fold(e.Group) == wanted || AiSearchText.Fold(e.Group).StartsWith(wanted, StringComparison.Ordinal)).ToList();
            if (narrowed.Count > 0)
            {
                entries = narrowed;
            }
            else
            {
                note = $"Die Gruppe „{group.Trim()}“ gibt es nicht; es gibt: {string.Join(", ", entries.Select(e => e.Group).Distinct(StringComparer.Ordinal).Order(StringComparer.CurrentCultureIgnoreCase))}.";
            }
        }

        var wantedColour = AiSearchText.Fold(colour).Replace(' ', '-');
        var tokens = AiSearchText.Tokens(query);
        var scored = new List<(Entry Entry, double Score, string Quality)>();
        if (tokens.Count == 0)
        {
            scored.AddRange(entries.Select(e => (e, 0.0, "ohne Suchwörter")));
        }
        else
        {
            var df = tokens.ToDictionary(t => t, t => entries.Count(e => Field(e, t) >= 1.0));
            var weights = tokens.Where(t => df[t] > 0).ToDictionary(t => t, t => Math.Log(1 + (entries.Count / (1.0 + df[t]))));
            if (weights.Count == 0)
            {
                return ([], (note is null ? "" : note + " ") + "Nichts gefunden. Versuche ein verwandtes oder allgemeineres Wort (Thema, Tier, Gegenstand), ein Symbol (search_icons) oder zeichne es mit create_svg.");
            }

            var maxTotal = weights.Sum(w => w.Value * (WTitle + WTags));
            foreach (var e in entries)
            {
                var total = 0.0;
                var matched = 0;
                foreach (var (token, weight) in weights)
                {
                    var s = Field(e, token);
                    if (s >= 1.0)
                    {
                        matched++;
                        total += weight * s;
                    }
                }

                if (matched == 0)
                {
                    continue;
                }

                var score = total * (0.4 + (0.6 * matched / weights.Count));
                var ratio = score / maxTotal;
                scored.Add((e, score, ratio >= 0.5 ? "gut" : ratio >= 0.25 ? "mittel" : "schwach"));
            }
        }

        var drawings = new List<Drawing>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var (entry, score, quality) in scored.OrderByDescending(s => s.Score).ThenBy(s => s.Entry.Group, StringComparer.Ordinal).ThenBy(s => s.Entry.Title, StringComparer.Ordinal))
        {
            var id = entry.Group + "|" + entry.Stem;
            if (!seen.Add(id))
            {
                continue;
            }

            var variants = entries.Where(e => e.Group == entry.Group && e.Stem == entry.Stem).OrderBy(e => e.Colour, StringComparer.Ordinal).ToList();
            var chosen = wantedColour.Length > 0 ? variants.FirstOrDefault(v => v.Colour == wantedColour) ?? entry : entry;
            var colours = variants.Where(v => v.Colour.Length > 0).ToDictionary(v => v.Colour, v => v.Key, StringComparer.Ordinal);
            drawings.Add(new Drawing(entry.Group, entry.Title, chosen.Key, colours, chosen.Width, chosen.Height, score, quality));
            if (drawings.Count >= limit)
            {
                break;
            }
        }

        return (drawings, note);
    }

    public static string RatioText(Drawing d) => d.Ratio.ToString("0.##", CultureInfo.InvariantCulture);
}
