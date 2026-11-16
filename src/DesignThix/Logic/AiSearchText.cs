using System.Text;

namespace DesignThix.Logic;

/// <summary>
/// The words of a search for the tools of the design assistant (<c>search_templates</c>, <c>search_deko</c>): German text folded to plain letters (ä to a, ß to ss), split into words, the words that carry
/// no meaning left out, and how well a word of the question fits the words of a field: the same word, the same stem ("Karte" and "Karten"), a word that starts with the other ("dino" and "Dinosaurier"),
/// a word that contains the other ("Party" in "Kinderparty"). Pure functions; the same folding as <see cref="TemplateLogic.Fold"/>.
/// </summary>
public static class AiSearchText
{
    private static readonly HashSet<string> Stop = new(StringComparer.Ordinal)
    {
        "ein", "eine", "einen", "einem", "einer", "eines", "der", "die", "das", "den", "dem", "des", "und", "oder", "mit", "von", "vom", "fur", "fuer", "zum", "zur", "zu", "im", "in", "am", "an", "auf", "aus",
        "bei", "nach", "uber", "ueber", "bitte", "mach", "mache", "machen", "mir", "uns", "erstelle", "erstellen", "gestalte", "gestalten", "entwirf", "entwerfen", "ich", "wir", "du", "ihr", "mein", "meine", "meinen",
        "meiner", "unser", "unsere", "unseren", "wird", "werden", "wurde", "soll", "sollen", "kann", "kannst", "bis", "ab", "um", "es", "ist", "sind", "dass", "fur", "als", "auch", "noch", "nur", "sehr", "schon",
        "schones", "schoene", "schone", "tolle", "tolles", "toller", "neue", "neuen", "neues", "gern", "gerne", "design", "vorlage", "vorlagen",
    };

    /// <summary>Lower case, letters without accents, umlauts as their base letter, ß as ss.</summary>
    public static string Fold(string? text) => TemplateLogic.Fold(text);

    /// <summary>The words of a text as they are (folded, no words dropped): letters and digits, at least one character.</summary>
    public static string[] Words(string? text)
    {
        var folded = Fold(text);
        var words = new List<string>();
        var sb = new StringBuilder();
        foreach (var c in folded)
        {
            if (char.IsLetterOrDigit(c))
            {
                sb.Append(c);
            }
            else if (sb.Length > 0)
            {
                words.Add(sb.ToString());
                sb.Clear();
            }
        }

        if (sb.Length > 0)
        {
            words.Add(sb.ToString());
        }

        return [.. words];
    }

    /// <summary>The words of a question that mean something: the filler words ("mach mir eine ...") and single letters are left out, every word once.</summary>
    public static List<string> Tokens(string? text, int maxTokens = 12)
        => [.. Words(text).Where(w => w.Length >= 2 && !Stop.Contains(w)).Distinct(StringComparer.Ordinal).Take(maxTokens)];

    /// <summary>The word without a plural or case ending, for comparing "Karten" with "Karte" (never shorter than four letters).</summary>
    public static string Stem(string word)
    {
        foreach (var ending in new[] { "ern", "en", "er", "es", "e", "n", "s" })
        {
            if (word.Length - ending.Length >= 4 && word.EndsWith(ending, StringComparison.Ordinal))
            {
                return word[..^ending.Length];
            }
        }

        return word;
    }

    /// <summary>How well one word of the question fits the words of a field: 1 the same word, 0.9 the same stem, 0.8 starts with, 0.6 a compound that ends or starts with it, 0.5 contains, 0 not at all.</summary>
    public static double Quality(string token, IReadOnlyList<string> words)
    {
        var best = 0.0;
        var stem = Stem(token);
        foreach (var word in words)
        {
            if (word == token)
            {
                return 1;
            }

            if (best < 0.9 && stem.Length >= 4 && Stem(word) == stem)
            {
                best = 0.9;
            }

            if (best < 0.8 && token.Length >= 4 && word.Length >= 4 && (word.StartsWith(token, StringComparison.Ordinal) || token.StartsWith(word, StringComparison.Ordinal)))
            {
                best = 0.8;
            }

            // a German compound: "Rennauto" ends with "auto", "Kinderparty" with "party"
            if (best < 0.6 && token.Length >= 7 && word.Length >= 4 && (token.EndsWith(word, StringComparison.Ordinal) || token.StartsWith(word, StringComparison.Ordinal)))
            {
                best = 0.6;
            }

            if (best < 0.5 && ((token.Length >= 5 && word.Contains(token, StringComparison.Ordinal)) || (word.Length >= 5 && token.Contains(word, StringComparison.Ordinal))))
            {
                best = 0.5;
            }
        }

        return best;
    }
}
