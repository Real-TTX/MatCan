using System.Globalization;
using System.Text.Json.Nodes;
using DesignThix.Core.Documents;
using DesignThix.Core.Media;
using DesignThix.Data.Entities;
using DesignThix.Services.Ai;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Logic;

/// <summary>
/// The tools of the assistant that look into the library of the application (docs/PLAN-AI-DESIGN.md "Quality pass"): <c>search_templates</c> ranks the several hundred templates and describes each one in words
/// (and, with the editor open, shows the best ones as ONE numbered picture), <c>search_deko</c> finds the illustrations, frames and ornaments of the Deko pack. Both only read, both go through the same
/// access rules as a person (the templates the person may use, the built-in media). Their point is that a new design starts from a real template and real illustrations instead of from circles and triangles.
/// </summary>
public static partial class AiDesignTools
{
    /// <summary>How many contact sheets of templates one run may ask the editor for.</summary>
    public const int MaxTemplateSheets = 6;

    private const int SheetSize = 8;

    /// <summary>Numbers from an argument: an array of numbers or of texts, or one value (a model writes ids both ways).</summary>
    private static List<long> ArgLongs(JsonObject args, params string[] names)
    {
        var result = new List<long>();
        foreach (var name in names)
        {
            var nodes = args[name] is JsonArray array ? array.ToList() : args[name] is null ? [] : new List<JsonNode?> { args[name] };
            foreach (var node in nodes)
            {
                if (AiDesignCatalog.TryNumber(node, out var d) && d is >= long.MinValue and <= long.MaxValue)
                {
                    result.Add((long)d);
                }
                else if (long.TryParse(AiDocOps.Str(node), NumberStyles.Integer, CultureInfo.InvariantCulture, out var n))
                {
                    result.Add(n);
                }
            }
        }

        return result;
    }

    private static async Task<ToolOutcome> SearchTemplatesAsync(Biz biz, AiToolSession s, JsonObject args, CancellationToken ct)
    {
        var all = await DesignLogic.TemplateQuery(biz).ToListAsync(ct);
        var wantedIds = ArgLongs(args, "ids", "id").Where(n => n > 0).Distinct().Take(SheetSize).ToList();
        List<AiTemplateSearch.Hit> hits;
        string? note = null;
        if (wantedIds.Count > 0)
        {
            var byId = all.ToDictionary(r => r.Id);
            hits = [.. wantedIds.Where(byId.ContainsKey).Select(id => new AiTemplateSearch.Hit(byId[id], 0, "gewählt"))];
            if (hits.Count < wantedIds.Count)
            {
                note = "Einige ids gibt es nicht oder sie sind für dich nicht nutzbar.";
            }
        }
        else
        {
            var limit = Math.Clamp(ArgInt(args, "limit") ?? 8, 1, AiTemplateSearch.MaxLimit);
            (hits, note) = AiTemplateSearch.Rank(all, ArgText(args, "query", "q", "search", "suche"), ArgText(args, "occasion", "anlass"), ArgText(args, "format"), limit);
        }

        if (hits.Count == 0)
        {
            return Ok("Keine Vorlage gefunden", new JsonObject { ["templates"] = new JsonArray(), ["hinweis"] = note ?? "Keine Vorlage passt. Versuche andere Wörter oder gestalte frei (dann mit search_deko für Illustrationen)." }, ["Keine Vorlage gefunden."]);
        }

        var hitIds = hits.Select(h => h.Row.Id).ToList();
        var documents = await DesignLogic.Templates(biz).AsNoTracking().Where(d => hitIds.Contains(d.Id)).Select(d => new { d.Id, d.DocumentJson }).ToDictionaryAsync(d => d.Id, d => d.DocumentJson, ct);
        var list = new JsonArray();
        var number = 0;
        foreach (var hit in hits)
        {
            number++;
            var row = hit.Row;
            var preset = row.TemplateFormat is { Length: > 0 } key ? FormatPresets.Find(key) : null;
            var entry = new JsonObject
            {
                ["nr"] = number,
                ["id"] = row.Id,
                ["name"] = row.Name,
                ["family"] = row.TemplateFamilyName ?? row.Name,
                ["variant"] = row.TemplateVariant,
                ["occasion"] = row.TemplateOccasion,
                ["match"] = hit.Quality,
                ["format"] = preset is null ? row.Size : $"{preset.Name} ({row.Size}{(preset.Fold != "none" ? ", Klappkarte: Seite 1 außen, Seite 2 innen" : "")})",
                ["description"] = Clip(row.Description, 220),
                ["tags"] = Clip(row.TemplateTags, 140),
            };
            if (documents.TryGetValue(row.Id, out var json) && DocumentValidator.Current(json) is { } current)
            {
                var doc = AiDocOps.Parse(current);
                entry["pages"] = AiDocOps.Pages(doc).Count;
                entry["layout"] = AiTemplateSearch.Layout(doc);
            }

            list.Add(entry);
        }

        var result = new JsonObject { ["templates"] = list };
        var warnings = new List<string>();
        if (note is not null)
        {
            result["hinweis"] = note;
        }

        // the picture: all hits on one numbered sheet, drawn by the editor
        var picture = false;
        string? pictureFile = null;
        if (s.TemplateSheets < MaxTemplateSheets && s.MaxLooks > 0)
        {
            var broker = biz.Service<AiRenderBroker>();
            if (broker.EditorConnected(s.ConversationId, TimeSpan.FromSeconds(12)))
            {
                s.TemplateSheets++;
                var request = new AiRenderBroker.Request(s.RunId, s.ConversationId, s.UserId, "", 1, 0, AiRenderBroker.NewToken(), [.. hits.Select(h => h.Row.Id)]);
                var bytes = await broker.RequestAsync(request, TimeSpan.FromSeconds(40), ct);
                if (bytes is { Length: > 0 } && FileSniffer.Sniff(bytes).Kind is FileKind.Jpeg or FileKind.Png)
                {
                    var sniffed = FileSniffer.Sniff(bytes);
                    s.PicturesForNextCall.Add(new Core.Ai.AiAttachment { Kind = "image", MediaType = sniffed.ContentType, Name = "Übersicht der Vorlagen", Data = Convert.ToBase64String(bytes) });
                    picture = true;
                    if (s.PictureFolder is { } folder)
                    {
                        Directory.CreateDirectory(folder);
                        pictureFile = $"sheet-{s.RunNumber}-{s.TemplateSheets}-{Guid.NewGuid():N}.{sniffed.Extension}";
                        await File.WriteAllBytesAsync(Path.Combine(folder, pictureFile), bytes, ct);
                    }
                }
            }
        }

        result["bild"] = picture
            ? $"Mit der nächsten Nachricht bekommst du ein Bild: die ersten Seiten der {hits.Count} Treffer, nummeriert wie „nr“. Sieh es dir an und wähle nach dem Aussehen, nicht nur nach dem Namen."
            : "Kein Bild verfügbar (der Editor ist nicht geöffnet): wähle nach der Beschreibung des Aufbaus.";
        result["weiter"] = "Passt eine Vorlage: apply_template {\"templateId\": id, \"whole\": true} übernimmt sie mit Format, Seiten und Feldern (bei einem leeren Design), danach passt du die Texte an. Passt keine: gestalte selbst, mit Illustrationen aus search_deko.";
        var summary = $"{hits.Count} Vorlagen{(string.IsNullOrWhiteSpace(ArgText(args, "query", "q")) ? "" : $" für „{Clip(ArgText(args, "query", "q"), 40)}“")}";
        return new ToolOutcome(true, summary, result, warnings, Picture: pictureFile);
    }

    private static async Task<ToolOutcome> SearchDekoAsync(Biz biz, JsonObject args, CancellationToken ct)
    {
        var pieces = await Access.Visible<Asset>(biz).AsNoTracking().Where(a => a.IsBuiltIn && a.Category == "Deko").Select(a => new { a.Key, a.Name, a.Tags, a.Width, a.Height }).ToListAsync(ct);
        var library = pieces.Select(p => new AiDekoSearch.Piece(p.Key, p.Name, p.Tags, p.Width, p.Height)).ToList();
        var query = ArgText(args, "q", "query", "search", "suche");
        var group = ArgText(args, "group", "gruppe");
        var colour = ArgText(args, "colour", "color", "farbe");
        var limit = Math.Clamp(ArgInt(args, "limit") ?? 10, 1, AiDekoSearch.MaxLimit);
        var (drawings, note) = AiDekoSearch.Search(library, query, group, colour, limit);
        var list = new JsonArray();
        foreach (var d in drawings)
        {
            var entry = new JsonObject
            {
                ["key"] = d.Key,
                ["gruppe"] = d.Group,
                ["name"] = d.Title,
                ["verhaeltnis"] = d.Ratio,
                ["passend"] = d.Quality,
            };
            if (d.Colours.Count > 1)
            {
                entry["farben"] = new JsonObject(d.Colours.Select(c => new KeyValuePair<string, JsonNode?>(c.Key, c.Value)));
            }

            list.Add(entry);
        }

        var result = new JsonObject { ["deko"] = list, ["einsetzen"] = "{\"type\": \"image\", \"source\": {\"asset\": \"<key>\"}, \"fit\": \"contain\", \"w\": …, \"h\": …} mit h = w ÷ verhaeltnis (sonst wird das Bild verzerrt oder hat Leerraum). Die Farben der Bilder sind fest: nimm die Farbvariante, die zum Design passt." };
        if (note is not null)
        {
            result["hinweis"] = note;
        }

        if (string.IsNullOrWhiteSpace(query) || drawings.Count == 0)
        {
            result["gruppen"] = new JsonArray([.. AiDekoSearch.Groups(library).Select(g => (JsonNode)JsonValue.Create(g)!)]);
        }

        var warnings = new List<string>();
        if (drawings.Count == 0)
        {
            warnings.Add("Kein Bild gefunden: versuche ein verwandtes Wort, ein Symbol (search_icons) oder zeichne die Illustration selbst mit create_svg.");
        }
        else if (!string.IsNullOrWhiteSpace(query) && drawings[0].Quality == "schwach")
        {
            warnings.Add("Nur schwache Treffer: das gesuchte Motiv gibt es nicht genau. Nimm das nächstliegende, versuche ein verwandtes Wort, oder zeichne es mit create_svg.");
        }

        return Ok($"{drawings.Count} Deko-Bilder{(string.IsNullOrWhiteSpace(query) ? "" : $" für „{Clip(query, 40)}“")}", result, warnings);
    }
}
