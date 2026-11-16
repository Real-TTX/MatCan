using System.Globalization;
using System.Text.Json.Nodes;
using MatCan.Core.Documents;

namespace MatCan.Logic;

/// <summary>
/// The search of the design assistant over the templates (<c>search_templates</c>): ranks the templates of the library by a question in German ("Einladung Dinosaurier Kindergeburtstag"), by occasion and by format, and
/// describes what each one looks like in words (background, texts with size and font, pictures and decoration), so the model can choose the one that fits and then change its texts instead of drawing from nothing.
/// Pure functions over the template rows and documents; the tool (<see cref="AiDesignTools"/>) adds the picture of the best ones. Words that appear in few templates count more than words that appear in
/// many ("Dino" more than "Einladung"); words no template knows (names, places) are left out of the judgement.
/// </summary>
public static class AiTemplateSearch
{
    public const int MaxLimit = 12;
    public const int MaxPerFamily = 3;

    /// <summary>One ranked template: the row, its score, and how good the match is for the model ("gut", "mittel", "schwach").</summary>
    public sealed record Hit(DesignRow Row, double Score, string Quality);

    private sealed record Entry(DesignRow Row, string[] Name, string[] Family, string[] Variant, string[] Tags, string[] Occasion, string[] Category, string[] Description, string[] Format);

    private static Entry Prepare(DesignRow row)
    {
        var preset = row.TemplateFormat is { Length: > 0 } key ? FormatPresets.Find(key) : null;
        return new Entry(
            row,
            AiSearchText.Words(row.Name),
            AiSearchText.Words(row.TemplateFamilyName),
            AiSearchText.Words(row.TemplateVariant),
            AiSearchText.Words((row.TemplateTags ?? "").Replace(',', ' ')),
            AiSearchText.Words(row.TemplateOccasion),
            AiSearchText.Words(row.Category),
            AiSearchText.Words(row.Description),
            AiSearchText.Words(preset is null ? "" : preset.Name + " " + preset.ShortName + " " + preset.Group));
    }

    /// <summary>The weights of the fields: a hit in the name or a tag says most, one in the description least.</summary>
    private const double WName = 3.0, WFamily = 3.0, WVariant = 2.5, WTags = 2.5, WOccasion = 1.5, WCategory = 1.5, WDescription = 1.0, WFormat = 2.0;

    private static double Field(Entry e, string token)
    {
        var scores = new[]
        {
            AiSearchText.Quality(token, e.Name) * WName,
            AiSearchText.Quality(token, e.Family) * WFamily,
            AiSearchText.Quality(token, e.Variant) * WVariant,
            AiSearchText.Quality(token, e.Tags) * WTags,
            AiSearchText.Quality(token, e.Occasion) * WOccasion,
            AiSearchText.Quality(token, e.Category) * WCategory,
            AiSearchText.Quality(token, e.Description) * WDescription,
            AiSearchText.Quality(token, e.Format) * WFormat,
        };
        var best = scores.Max();
        // the other fields that match add a little: a word in the name AND in the tags is a better hit than one in the tags alone
        return best + (0.25 * (scores.Sum() - best));
    }

    /// <summary>
    /// The templates that fit the question, best first. <paramref name="occasion"/> (one of the occasions of the library) and <paramref name="format"/> (a key of the formats, or words like "Klappkarte") narrow the
    /// search when something is left, else they are ignored (the second item of the answer says so). At most <see cref="MaxPerFamily"/> variants of one family, at most <paramref name="limit"/> in all.
    /// </summary>
    public static (List<Hit> Hits, string? Note) Rank(IReadOnlyList<DesignRow> templates, string? query, string? occasion, string? format, int limit)
    {
        limit = Math.Clamp(limit, 1, MaxLimit);
        var entries = templates.Select(Prepare).ToList();
        string? note = null;

        var occasionName = TemplateMeta.OccasionOf(occasion)
            ?? (string.IsNullOrWhiteSpace(occasion) ? null : TemplateMeta.Occasions.FirstOrDefault(o => AiSearchText.Fold(o).Contains(AiSearchText.Fold(occasion.Trim()), StringComparison.Ordinal)));
        if (occasionName is not null)
        {
            var narrowed = entries.Where(e => string.Equals(e.Row.TemplateOccasion, occasionName, StringComparison.OrdinalIgnoreCase)).ToList();
            if (narrowed.Count > 0)
            {
                entries = narrowed;
            }
        }
        else if (!string.IsNullOrWhiteSpace(occasion))
        {
            note = $"Den Anlass „{occasion.Trim()}“ gibt es nicht; es gibt: {string.Join(", ", TemplateMeta.Occasions)}. Er wurde ignoriert.";
        }

        if (!string.IsNullOrWhiteSpace(format))
        {
            var key = FormatPresets.Find(format.Trim())?.Key;
            var formatTokens = AiSearchText.Tokens(format);
            var narrowed = key is not null
                ? entries.Where(e => string.Equals(e.Row.TemplateFormat, key, StringComparison.OrdinalIgnoreCase)).ToList()
                : formatTokens.Count > 0 ? entries.Where(e => formatTokens.All(t => AiSearchText.Quality(t, e.Format) >= 0.8 || AiSearchText.Quality(t, e.Name) >= 0.8)).ToList() : [];
            if (narrowed.Count > 0)
            {
                entries = narrowed;
            }
            else
            {
                note = (note is null ? "" : note + " ") + $"Das Format „{format.Trim()}“ passt zu keiner Vorlage dieser Auswahl und wurde ignoriert (list_formats zeigt die Formate).";
            }
        }

        var tokens = AiSearchText.Tokens(query);
        if (tokens.Count == 0)
        {
            // no words: the order of the library (by occasion and number), the first of each family
            var plain = entries.OrderBy(e => e.Row.TemplateOrder).ThenBy(e => e.Row.Id).Select(e => new Hit(e.Row, 0, "ohne Suchwörter")).ToList();
            return (CapFamilies(plain, limit), note ?? "Ohne Suchwörter: das sind Beispiele aus der Bibliothek.");
        }

        // how rare is a word: it counts more when few templates know it, and not at all when none does (a name or a place)
        var df = tokens.ToDictionary(t => t, t => entries.Count(e => Field(e, t) >= 1.0));
        var weights = tokens.Where(t => df[t] > 0).ToDictionary(t => t, t => Math.Log(1 + (entries.Count / (1.0 + df[t]))));
        if (weights.Count == 0)
        {
            return ([], (note is null ? "" : note + " ") + "Keine Vorlage kennt diese Wörter. Versuche allgemeinere Wörter (Anlass und Art: „Einladung Kindergeburtstag“).");
        }

        var maxTotal = weights.Sum(w => w.Value * (WName + WTags));
        var scored = new List<Hit>();
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

            // a template that fits every word beats one that fits a single rare word
            var coverage = (double)matched / weights.Count;
            var score = total * (0.4 + (0.6 * coverage));
            var ratio = score / maxTotal;
            scored.Add(new Hit(e.Row, score, ratio >= 0.5 ? "gut" : ratio >= 0.25 ? "mittel" : "schwach"));
        }

        var ranked = scored.OrderByDescending(h => h.Score).ThenBy(h => h.Row.TemplateOrder).ThenBy(h => h.Row.Id).ToList();
        return (CapFamilies(ranked, limit), note);
    }

    private static List<Hit> CapFamilies(List<Hit> ranked, int limit)
    {
        var perFamily = new Dictionary<string, int>(StringComparer.Ordinal);
        var result = new List<Hit>();
        foreach (var hit in ranked)
        {
            var family = string.IsNullOrEmpty(hit.Row.TemplateFamily) ? "t" + hit.Row.Id.ToString(CultureInfo.InvariantCulture) : hit.Row.TemplateFamily!;
            perFamily.TryGetValue(family, out var count);
            if (count >= MaxPerFamily)
            {
                continue;
            }

            perFamily[family] = count + 1;
            result.Add(hit);
            if (result.Count >= limit)
            {
                break;
            }
        }

        return result;
    }

    // ------------------------------------------------------------------------------------------------ what a template looks like, in words

    private static string Colour(JsonNode? background)
    {
        if (background is not JsonObject b)
        {
            return "weiß";
        }

        if (b["gradient"] is JsonObject g && g["stops"] is JsonArray stops && stops.Count > 0)
        {
            return "Verlauf " + string.Join("→", stops.OfType<JsonObject>().Select(s => AiDocOps.Str(s["color"])));
        }

        return AiDocOps.Str(b["color"]) is { Length: > 0 } c ? c : "weiß";
    }

    private static string Clip(string text, int max) => text.Length <= max ? text : text[..max].TrimEnd() + "…";

    /// <summary>
    /// A short description of page <paramref name="pageIndex"/> of a template document: the background, the texts from the biggest to the smallest with font and size, pictures and decoration (keys), symbols,
    /// the number of shapes, the fields. It is what the model reads when it cannot see the picture; about 500 characters.
    /// </summary>
    public static string Layout(JsonObject doc, int pageIndex = 0)
    {
        var pages = AiDocOps.Pages(doc);
        if (pages.Count == 0 || pages[Math.Clamp(pageIndex, 0, pages.Count - 1)] is not JsonObject page)
        {
            return "";
        }

        var elements = AiDocOps.Walk(AiDocOps.Elements(page)).Where(e => !AiDocOps.Flag(e["hidden"])).ToList();
        var parts = new List<string> { $"Hintergrund {Colour(page["background"])}" };
        var texts = elements.Where(e => AiDocOps.Type(e) == "text" && AiDocOps.Str(e["text"]).Trim().Length > 0)
            .OrderByDescending(e => AiDocOps.Num(e["fontSize"])).ThenBy(e => AiDocOps.Num(e["y"])).Take(7).ToList();
        if (texts.Count > 0)
        {
            parts.Add("Texte: " + string.Join("; ", texts.Select(e => $"„{Clip(AiDocOps.Str(e["text"]).Replace('\n', ' ').Trim(), 34)}“ ({AiDocOps.Str(e["fontFamily"])} {AiDocOps.Num(e["fontSize"]).ToString("0.#", CultureInfo.InvariantCulture)} pt)")));
        }

        var images = elements.Where(e => AiDocOps.Type(e) == "image").Select(e => e["source"] is JsonObject s ? (AiDocOps.Str(s["asset"]) is { Length: > 0 } a ? a : "{{" + AiDocOps.Str(s["field"]) + "}}") : "(leerer Bildrahmen)")
            .Distinct(StringComparer.Ordinal).Take(8).ToList();
        if (images.Count > 0)
        {
            parts.Add("Bilder/Deko: " + string.Join(", ", images));
        }

        var icons = elements.Where(e => AiDocOps.Type(e) == "icon").Select(e => AiDocOps.Str(e["icon"])).Distinct(StringComparer.Ordinal).Take(5).ToList();
        if (icons.Count > 0)
        {
            parts.Add("Symbole: " + string.Join(", ", icons));
        }

        var shapes = elements.Count(e => AiDocOps.Type(e) == "shape");
        if (shapes > 0)
        {
            parts.Add($"{shapes} Formen");
        }

        var qr = elements.Count(e => AiDocOps.Type(e) is "qr" or "barcode");
        if (qr > 0)
        {
            parts.Add("QR-/Strichcode");
        }

        var fields = AiDocOps.Fields(doc).OfType<JsonObject>().Select(f => AiDocOps.Str(f["key"])).Where(k => k.Length > 0).Take(8).ToList();
        if (fields.Count > 0)
        {
            parts.Add("Felder: " + string.Join(", ", fields));
        }

        return string.Join(". ", parts) + ".";
    }
}
