using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using DesignThix.Core.Documents;
using DesignThix.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Logic;

/// <summary>
/// What one tool call did: for the person a ONE-line <see cref="Summary"/> (the card in the chat), for the model the <see cref="Result"/> and the <see cref="Warnings"/> (what was dropped and why, what the
/// lint saw - so it can do better in its next step). <see cref="PageId"/> and <see cref="ElementIds"/> say what the editor should show and flash, <see cref="Revision"/> is the revision the design has after a
/// write, <see cref="Picture"/> the file of a picture the model got.
/// </summary>
public sealed record ToolOutcome(bool Ok, string Summary, JsonNode? Result, List<string> Warnings, string? PageId = null, IReadOnlyList<string>? ElementIds = null, bool Changed = false, int? Revision = null, string? Picture = null);

/// <summary>Where the person let the AI work: the whole design, one page or a selection; with <see cref="Locked"/> ("Nur hier ändern") a write outside fails with a reason the model reads. Reading is always allowed.</summary>
public sealed record AiScope(string Kind, string? PageId, IReadOnlyList<string> ElementIds, bool Locked)
{
    public static AiScope Whole { get; } = new("design", null, [], false);

    public bool IsPage => Kind == "page" && PageId is not null;

    public bool IsSelection => Kind == "selection" && ElementIds.Count > 0;

    /// <summary>Reads <c>{ kind, pageId?, elementIds?, locked }</c>; anything that does not fit is the whole design.</summary>
    public static AiScope Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return Whole;
        }

        try
        {
            if (JsonNode.Parse(json) is not JsonObject o)
            {
                return Whole;
            }

            var kind = AiDocOps.Str(o["kind"]).ToLowerInvariant() is "page" or "selection" ? AiDocOps.Str(o["kind"]).ToLowerInvariant() : "design";
            var page = AiDocOps.Str(o["pageId"]) is { Length: > 0 } p && p.Length <= 24 ? p : null;
            var ids = (o["elementIds"] as JsonArray ?? []).Select(AiDocOps.Str).Where(i => i.Length is > 0 and <= 24).Distinct(StringComparer.Ordinal).Take(200).ToList();
            if (kind == "selection" && ids.Count == 0)
            {
                kind = page is null ? "design" : "page";
            }

            if (kind == "page" && page is null)
            {
                kind = "design";
            }

            return new AiScope(kind, page, ids, AiDocOps.Flag(o["locked"]) && kind != "design");
        }
        catch (JsonException)
        {
            return Whole;
        }
    }

    public string ToJson() => new JsonObject
    {
        ["kind"] = Kind,
        ["pageId"] = PageId,
        ["elementIds"] = new JsonArray(ElementIds.Select(i => (JsonNode)JsonValue.Create(i)!).ToArray()),
        ["locked"] = Locked,
    }.ToJsonString();
}

/// <summary>What the tools of one run share: the conversation and the design they are bound to, the scope, and the bookkeeping of what the run wrote (for the journal and the undo).</summary>
public sealed class AiToolSession
{
    public long ConversationId { get; init; }

    public long RunId { get; init; }

    public int RunNumber { get; init; }

    /// <summary>The ONE design the tools can touch: an id of another design or element does not exist for them.</summary>
    public long DesignId { get; init; }

    public long UserId { get; init; }

    public AiScope Scope { get; set; } = AiScope.Whole;

    /// <summary>The note of the history entry the run writes ("KI: <title>").</summary>
    public string Note { get; set; } = "KI";

    public int MaxLooks { get; set; } = 6;

    public int Looks { get; set; }

    /// <summary>The design was changed (in a way that shows) since the model last looked at it: the review sends it back to look before it may end.</summary>
    public bool UnseenChanges { get; set; }

    /// <summary>What the person wrote in this run (and attached as text): a sample text of a template that the person's own words contain is no leftover.</summary>
    public string RequestText { get; set; } = "";

    /// <summary>How often the review sent the model back in this run.</summary>
    public int ReviewRounds { get; set; }

    /// <summary>How long <c>look</c> waits for the picture of the editor (the picture of the start of a run waits less: nobody should wait long before the work begins).</summary>
    public TimeSpan LookTimeout { get; set; } = TimeSpan.FromSeconds(30);

    /// <summary>The name of the next picture of <c>look</c> (the start of a run names it "Aktueller Stand …" so the model knows what it is); used once.</summary>
    public string? PictureName { get; set; }

    /// <summary>How many contact sheets of templates (<c>search_templates</c>) this run asked the editor for.</summary>
    public int TemplateSheets { get; set; }

    /// <summary>The sample texts that came with a template (element id to text): what the final check compares with, to say which ones were never replaced.</summary>
    public Dictionary<string, string> TemplateTexts { get; } = new(StringComparer.Ordinal);

    /// <summary>Elements this run made: they may be changed again even when the scope is a selection.</summary>
    public HashSet<string> CreatedIds { get; } = new(StringComparer.Ordinal);

    /// <summary>The lint warnings already told in this run (told once).</summary>
    public HashSet<string> LintSeen { get; } = new(StringComparer.Ordinal);

    /// <summary>The data lists the person referenced in this conversation: <c>read_datalist</c> reads only these.</summary>
    public HashSet<long> ReferencedLists { get; } = [];

    /// <summary>The ids of library images that came with the messages of this conversation (listed by <c>list_media</c>).</summary>
    public HashSet<long> AttachmentAssets { get; } = [];

    /// <summary>Searches and imports of catalogues in this run (the tools allow only a few: no collecting).</summary>
    public int CatalogSearches { get; set; }

    public int CatalogImports { get; set; }

    /// <summary>The first write of the run happened: the journal has its entry.</summary>
    public bool Wrote { get; set; }

    public int RevisionBefore { get; set; }

    public int RevisionAfter { get; set; }

    public long? JournalId { get; set; }

    /// <summary>Pictures the model gets on its NEXT call only (what <c>look</c> drew).</summary>
    public List<Core.Ai.AiAttachment> PicturesForNextCall { get; } = [];

    /// <summary>Where the pictures of <c>look</c> are kept (a folder under <c>{data}/ai-files</c>); null in a test that has none.</summary>
    public string? PictureFolder { get; set; }
}

/// <summary>A tool refuses with a reason the model reads (nothing was written).</summary>
public sealed class ToolError(string summary, string message) : Exception(message)
{
    public string Summary { get; } = summary;
}

/// <summary>
/// The tools of the design assistant (docs/PLAN-AI-DESIGN.md 3.3): what the model can read and write of ONE design. Every write is a patch on the stored document, checked by <c>DocumentValidator</c> as a whole,
/// linted and saved through <see cref="DesignLogic"/> (so revisions, the lock of saves and the rule for images of others apply), and journalled once per run. A tool runs in a scope of its own: whatever it
/// tracked in the database is gone when it ends, so a tool that fails half-way can never leave a half-change for the next save of the run. The tools reach nothing but the design of the session (no network,
/// no shares, no other items, no deleting of the design).
/// </summary>
public static partial class AiDesignTools
{
    /// <summary>The tools as the prompt describes them: name, arguments, what it does, whether it writes. In the order a sensible run uses them.</summary>
    public static readonly IReadOnlyList<(string Name, string Args, string What, bool Writes)> Catalog =
    [
        ("read_design", "{\"page\"?: id oder Nummer}", "Das Design kompakt: Format, Felder und je Seite Hintergrund und Elementbaum (id, type, name, x, y, w, h, Text bis 200 Zeichen, Schrift, Farben, gesperrt/ausgeblendet). Ohne page alle Seiten.", false),
        ("read_elements", "{\"ids\": [\"e1\", ...]}", "Alle Eigenschaften der genannten Elemente (höchstens 30).", false),
        ("list_fonts", "{}", "Die Schriftfamilien, die dieses Design nutzen darf, mit den Gewichten. Nur diese Familien verwenden.", false),
        ("list_media", "{\"q\"?: \"text\", \"category\"?: \"Logos\", \"limit\"?: 30}", "Bilder der Bibliothek, die dieses Design nutzen darf (eingebaute, die des Bereichs, angehängte): Schlüssel, Name, Kategorie, Pixelgröße. Bilder NUR von hier.", false),
        ("search_icons", "{\"q\": \"käse\", \"limit\"?: 20}", "Sucht Symbole (Lucide) nach englischen und deutschen Wörtern; gibt Namen für ein icon-Element.", false),
        ("search_catalog", "{\"catalog\"?: \"pexels\", \"q\"?: \"cheese\", \"collection\"?, \"orientation\"?: \"landscape\", \"limit\"?: 10}", "Sucht in den Katalogen, die die Administration eingeschaltet hat: Fotos (Pexels, Pixabay, Openverse), Symbolsätze (iconify) und Schriften (googlefonts). Ohne catalog: welche Kataloge es gibt. Treffer mit itemId, Titel, Größe, Urheber, Lizenz. Fotos am besten mit englischen Wörtern suchen. Höchstens 12 Suchen je Auftrag.", false),
        ("import_from_catalog", "{\"catalog\": \"pexels\", \"itemId\": \"1001\"}", "Übernimmt EINEN gewählten Treffer in die Bibliothek: ein Foto (gibt den Schlüssel für image.source.asset), ein Symbol (gibt den Namen prefix:name für icon) oder eine Schrift (gibt die Familie für fontFamily). Die Urheberangabe steht danach in den Bildnachweisen. Höchstens 8 je Auftrag; nur Treffer, die du wirklich einsetzt.", true),
        ("read_brand", "{}", "Die Marke des Bereichs: Farben, Schriften für Überschrift, Zwischenüberschrift und Fließtext, Logos.", false),
        ("search_templates", "{\"query\"?: \"Einladung Dinosaurier Kindergeburtstag\", \"occasion\"?: \"Kinder & Familie\", \"format\"?: \"card-a6-portrait\", \"ids\"?: [123, 456], \"limit\"?: 8}", "Sucht in den Ã¼ber 600 Vorlagen (Familien mit Varianten, AnlÃ¤sse, Formate) die passenden: nr, id, Name, Anlass, Format, Beschreibung und der Aufbau in Worten (Texte mit Schrift und GrÃ¶Ãe, Bilder, Deko). Bei geÃ¶ffnetem Editor bekommst du mit der nÃ¤chsten Nachricht EIN Bild mit den ersten Seiten der Treffer, nummeriert wie nr. Mit ids zeigst du bestimmte Vorlagen noch einmal. FÃ¼r ein neues Design oder eine groÃe Umgestaltung IMMER als Erstes benutzen.", false),
        ("search_deko", "{\"q\": \"Dinosaurier\", \"group\"?: \"Motive\", \"colour\"?: \"gold\", \"limit\"?: 10}", "Sucht in den Deko-Bildern der Bibliothek (hunderte gezeichnete Illustrationen: Motive wie Rennwagen, Krone, Schloss, Eule, Pferd, Gitarre, Ballons, Torte, Zelt ..., dazu Rahmen, Ornamente, Trenner, Muster, Ecken, BlÃ¤tter, Konfetti): key, Gruppe, Name, verhaeltnis (Breite Ã· HÃ¶he), Farbvarianten. FÃ¼r jede Illustration ZUERST hier suchen; Formen sind nur fÃ¼r FlÃ¤chen und Linien.", false),
        ("list_templates", "{\"q\"?: \"text\", \"category\"?: \"Etiketten\"}", "Vorlagen, die die Person nutzen darf: id, Name, Kategorie, Beschreibung, Größe (höchstens 30).", false),
        ("list_formats", "{}", "Die Formate (preset) für resize_design: Schlüssel, Name, Größe.", false),
        ("read_datalist", "{\"id\"?: Nummer}", "Spalten und die ersten 20 Zeilen der Datenliste, die die Person als Referenz angehängt hat.", false),
        ("look", "{\"page\"?: id oder Nummer}", "Schaut sich eine Seite an: du bekommst ihr Bild im nächsten Schritt (nur wenn der Editor offen ist; höchstens wenige Male je Auftrag).", false),
        ("add_elements", "{\"page\"?, \"elements\": [{\"type\": \"text\", \"x\": 10, \"y\": 10, \"w\": 100, \"h\": 20, \"text\": \"…\", ...}], \"after\"?: id | \"start\" | \"end\", \"group\"?: id}", "Fügt Elemente hinzu (Schema unten, ohne id; der Server vergibt sie und nennt sie dir). Standard: oben auf die Seite; group = in diese Gruppe. Ein Element vom Typ group darf children haben.", true),
        ("update_elements", "{\"changes\": [{\"id\": \"e1\", \"set\": {\"fontSize\": 24, \"color\": \"#1fb3d6\"}}]}", "Ändert Eigenschaften: genannte ersetzen den alten Wert, nicht genannte bleiben; null löscht, wo das Schema null erlaubt (z. B. shadow, outline). Bei einer Gruppe verschieben/skalieren x, y, w, h die Kinder mit.", true),
        ("delete_elements", "{\"ids\": [\"e1\", ...]}", "Löscht Elemente (eine Gruppe mit ihren Kindern).", true),
        ("arrange", "{\"id\": \"e1\", \"to\": \"front\" | \"back\" | \"forward\" | \"backward\" | \"index\", \"index\"?: 0}", "Ändert die Ebene: front = ganz oben, back = ganz unten, index 0 = ganz unten.", true),
        ("group", "{\"ids\": [\"e1\", \"e2\"], \"name\"?: \"…\"}", "Fasst Elemente derselben Ebene zu einer Gruppe zusammen.", true),
        ("ungroup", "{\"id\": \"e9\"}", "Löst eine Gruppe auf; Drehung, Spiegelung und Deckkraft der Gruppe gehen in die Kinder.", true),
        ("set_page", "{\"page\", \"background\"?: {...}, \"elements\"?: [...], \"name\"?: \"…\"}", "Setzt den Hintergrund und/oder ersetzt ALLE Elemente der Seite auf einmal (zum Entwerfen einer Seite). Ohne elements bleiben die Elemente.", true),
        ("add_page", "{\"after\"?: page, \"copyOf\"?: page, \"name\"?: \"…\", \"background\"?: {...}}", "Neue leere Seite (oder Kopie einer Seite mit neuen ids), standardmäßig am Ende; gibt die id der Seite.", true),
        ("delete_page", "{\"page\"}", "Löscht eine Seite (nie die einzige).", true),
        ("move_page", "{\"page\", \"to\": Nummer ab 1}", "Verschiebt eine Seite an eine Stelle.", true),
        ("rename_page", "{\"page\", \"name\": \"…\"}", "Benennt eine Seite.", true),
        ("resize_design", "{\"preset\"?: \"business-card\" | \"width\"?, \"height\"?, \"unit\"?: \"mm\"|\"px\", \"scale\"?: true}", "Ändert das Format aller Seiten (Schlüssel aus list_formats oder Maße); scale: der Inhalt wächst oder schrumpft mit (Standard true).", true),
        ("set_fields", "{\"fields\": [{\"key\": \"Name\", \"label\"?, \"type\"?: \"text\", \"sample\"?: \"…\", \"decimals\"?}], \"remove\"?: [\"Key\"]}", "Legt Felder für Platzhalter {{Key}} an oder ändert sie (mit Beispielwert). Ein Feld, das noch verwendet wird, lässt sich nicht entfernen.", true),
        ("apply_template", "{\"templateId\": Nummer, \"whole\"?: true, \"templatePage\"?: 1, \"page\"?: page}", "Übernimmt eine Vorlage (id aus search_templates). Mit whole: true wird das ganze Design zur Vorlage: Format, alle Seiten und Felder (für ein neues oder leeres Design; ein vorhandenes Design wird ersetzt). Ohne whole kopiert es EINE Seite der Vorlage (templatePage) ins Design, auf das Format skaliert: ohne page als neue Seite am Ende, mit page ersetzt sie den Inhalt dieser Seite. Die Elemente bekommen neue ids; das Ergebnis nennt den Aufbau mit allen ids, damit du die Texte gleich ersetzen kannst.", true),
        ("create_svg", "{\"name\": \"logo\", \"svg\": \"<svg xmlns=\\\"http://www.w3.org/2000/svg\\\" viewBox=\\\"0 0 200 60\\\">…</svg>\"}", "Zeichnet eine Grafik als SVG (höchstens 200 KB, nur Zeichenelemente; Skripte und fremde Verweise werden entfernt) und legt sie in die Bibliothek; gibt den Schlüssel für image.source.", true),
        ("rename_design", "{\"name\": \"…\"}", "Gibt dem Design einen Namen.", true),
    ];

    private static readonly HashSet<string> WriteTools = [.. Catalog.Where(c => c.Writes).Select(c => c.Name)];

    public static bool IsWrite(string? tool) => tool is not null && WriteTools.Contains(tool);

    /// <summary>The text of the tool list for the prompt.</summary>
    public static string CatalogText()
        => string.Join('\n', Catalog.Select(c => $"- {c.Name} {c.Args}{(c.Writes ? " [ändert]" : "")} – {c.What}"));

    // ------------------------------------------------------------------------------------------------ run

    /// <summary>
    /// Runs one tool of the model. The person must still be allowed to see (reads) or edit (writes) the design: a person who lost that gets a <see cref="NotFoundException"/> or
    /// <see cref="ForbiddenException"/> out of here and the run ends. Everything else that goes wrong is a failed outcome with a reason for the model.
    /// </summary>
    public static async Task<ToolOutcome> RunAsync(Biz biz, AiToolSession session, string tool, JsonObject args, CancellationToken ct = default)
    {
        var name = (tool ?? "").Trim();
        var def = Catalog.FirstOrDefault(c => string.Equals(c.Name, name, StringComparison.OrdinalIgnoreCase));
        if (def.Name is null)
        {
            return Fail($"Unbekanntes Werkzeug „{Clip(name, 40)}“", $"Es gibt kein Werkzeug \"{Clip(name, 40)}\". Verfügbar: {string.Join(", ", Catalog.Select(c => c.Name))}.");
        }

        using var scope = biz.Services.CreateScope();
        var inner = scope.ServiceProvider.GetRequiredService<Biz>();
        try
        {
            await Access.RequireAsync(inner, ItemKind.Design, session.DesignId, def.Writes ? AccessLevel.Edit : AccessLevel.View);
            return def.Name switch
            {
                "read_design" => await ReadDesignAsync(inner, session, args),
                "read_elements" => await ReadElementsAsync(inner, session, args),
                "list_fonts" => await ListFontsAsync(inner, session),
                "list_media" => await ListMediaAsync(inner, session, args),
                "search_icons" => SearchIcons(inner, args),
                "search_catalog" => await SearchCatalogAsync(inner, session, args, ct),
                "import_from_catalog" => await ImportFromCatalogAsync(inner, session, args, ct),
                "read_brand" => await ReadBrandAsync(inner, session),
                "search_templates" => await SearchTemplatesAsync(inner, session, args, ct),
                "search_deko" => await SearchDekoAsync(inner, args, ct),
                "list_templates" => await ListTemplatesAsync(inner, args),
                "list_formats" => ListFormats(),
                "read_datalist" => await ReadDataListAsync(inner, session, args),
                "look" => await LookAsync(inner, session, args, ct),
                "add_elements" => await AddElementsAsync(inner, session, args),
                "update_elements" => await UpdateElementsAsync(inner, session, args),
                "delete_elements" => await DeleteElementsAsync(inner, session, args),
                "arrange" => await ArrangeAsync(inner, session, args),
                "group" => await GroupAsync(inner, session, args),
                "ungroup" => await UngroupAsync(inner, session, args),
                "set_page" => await SetPageAsync(inner, session, args),
                "add_page" => await AddPageAsync(inner, session, args),
                "delete_page" => await DeletePageAsync(inner, session, args),
                "move_page" => await MovePageAsync(inner, session, args),
                "rename_page" => await RenamePageAsync(inner, session, args),
                "resize_design" => await ResizeDesignAsync(inner, session, args),
                "set_fields" => await SetFieldsAsync(inner, session, args),
                "apply_template" => await ApplyTemplateAsync(inner, session, args),
                "create_svg" => await CreateSvgAsync(inner, session, args),
                "rename_design" => await RenameDesignAsync(inner, session, args),
                _ => Fail("Unbekanntes Werkzeug", "Unbekanntes Werkzeug."),
            };
        }
        catch (ToolError e)
        {
            return Fail(e.Summary, e.Message);
        }
        catch (BizException e)
        {
            return Fail(Clip(e.Message, 120), e.Message);
        }
        catch (RevisionConflictException)
        {
            return Fail("Das Design wurde gleichzeitig geändert", "Jemand hat das Design gleichzeitig gespeichert. Lies es mit read_design neu und versuche es noch einmal.");
        }
        catch (Exception e) when (e is DbUpdateException or InvalidOperationException or JsonException or FormatException or ArgumentException or InvalidCastException)
        {
            return Fail($"„{def.Name}“ fehlgeschlagen", "Fehler beim Ausführen: " + e.Message);
        }
    }

    private static ToolOutcome Fail(string summary, string reason) => new(false, summary, new JsonObject { ["error"] = reason }, []);

    private static ToolOutcome Ok(string summary, JsonNode? result, List<string>? warnings = null, string? pageId = null, IReadOnlyList<string>? elementIds = null)
        => new(true, summary, result, warnings ?? [], pageId, elementIds);

    private static readonly System.Text.Json.JsonSerializerOptions Relaxed = new() { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    /// <summary>JSON for the model: umlauts and quotation marks as they are (the default writes them as ä and costs the model more to read).</summary>
    public static string Json(JsonNode node) => node.ToJsonString(Relaxed);

    internal static string Clip(string? text, int max) => (text ?? "").Length <= max ? text ?? "" : text![..max] + "…";

    // ------------------------------------------------------------------------------------------------ arguments

    /// <summary>The first of these argument names that is present, as text (numbers count).</summary>
    private static string? ArgText(JsonObject args, params string[] names)
    {
        foreach (var name in names)
        {
            if (args[name] is JsonValue v)
            {
                if (v.TryGetValue<string>(out var s))
                {
                    return s;
                }

                if (v.TryGetValue<double>(out var d))
                {
                    return d.ToString(CultureInfo.InvariantCulture);
                }
            }
        }

        return null;
    }

    private static int? ArgInt(JsonObject args, params string[] names)
        => AiDesignCatalog.TryNumber(names.Select(n => args[n]).FirstOrDefault(n => n is not null), out var d) ? (int)Math.Clamp(Math.Floor(d + 0.5), int.MinValue, int.MaxValue) : null;

    private static bool? ArgBool(JsonObject args, string name)
        => args[name] is JsonValue v && v.TryGetValue<bool>(out var b) ? b : args[name] is JsonValue s && s.TryGetValue<string>(out var t) && t.Trim().ToLowerInvariant() is "true" or "false" ? t.Trim().ToLowerInvariant() == "true" : null;

    /// <summary>A list of texts: an array of strings or numbers, or a single value, or text separated by commas.</summary>
    private static List<string> ArgList(JsonObject args, params string[] names)
    {
        foreach (var name in names)
        {
            var node = args[name];
            if (node is JsonArray array)
            {
                return [.. array.Select(AiDocOps.Str).Where(s => s.Length > 0)];
            }

            if (node is JsonValue v && v.TryGetValue<string>(out var text))
            {
                return [.. text.Split([',', ' ', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)];
            }
        }

        return [];
    }

    // ------------------------------------------------------------------------------------------------ reading the design

    private sealed record DesignHead(int Revision, string DocumentJson, string Name, long? SpaceId, long? FolderId);

    private static async Task<DesignHead> HeadAsync(Biz biz, long id)
    {
        var row = await biz.Db.Design.AsNoTracking().Where(d => d.Id == id).Select(d => new { d.Revision, d.DocumentJson, d.Name, d.SpaceId, d.FolderId }).FirstOrDefaultAsync() ?? throw new NotFoundException();
        return new DesignHead(row.Revision, DocumentValidator.Current(row.DocumentJson), row.Name, row.SpaceId, row.FolderId);
    }

    private static string PageLabel(JsonObject doc, JsonObject page) => $"Seite {AiDocOps.PageNumber(doc, page)}";

    /// <summary>The page the call is about: the argument, else the page of the scope, else the only page; otherwise the model has to say.</summary>
    private static JsonObject PageOf(JsonObject doc, AiToolSession s, JsonObject args, string[]? names = null)
    {
        var key = ArgText(args, names ?? ["page", "pageId", "seite"]);
        if (string.IsNullOrWhiteSpace(key))
        {
            if (s.Scope.PageId is { } scoped && AiDocOps.FindPage(doc, scoped) is { } scopedPage && (s.Scope.IsPage || AiDocOps.Pages(doc).Count > 1))
            {
                return scopedPage;
            }

            if (AiDocOps.Pages(doc).Count == 1)
            {
                return (JsonObject)AiDocOps.Pages(doc)[0]!;
            }

            throw new ToolError("page fehlt", $"Nenne die Seite (page). Es gibt: {PageList(doc)}.");
        }

        return AiDocOps.FindPage(doc, key) ?? throw new ToolError($"Seite „{Clip(key, 20)}“ gibt es nicht", $"Die Seite \"{Clip(key, 20)}\" gibt es nicht. Es gibt: {PageList(doc)}.");
    }

    private static string PageList(JsonObject doc)
        => string.Join(", ", AiDocOps.Pages(doc).OfType<JsonObject>().Select((p, i) => $"{AiDocOps.Id(p)} (Seite {i + 1}{(AiDocOps.Str(p["name"]) is { Length: > 0 } n ? ", „" + Clip(n, 30) + "“" : "")})"));

    internal static string ElementKind(string type) => type switch
    {
        "text" => "Text",
        "image" => "Bild",
        "imageStrip" => "Bildleiste",
        "shape" => "Form",
        "icon" => "Symbol",
        "qr" => "QR-Code",
        "barcode" => "Strichcode",
        "group" => "Gruppe",
        _ => "Element",
    };

    /// <summary>A short name of an element for a sentence: its name, else the start of its text.</summary>
    internal static string ElementName(JsonObject e)
    {
        var name = AiDocOps.Str(e["name"]).Trim();
        if (name.Length > 0)
        {
            return $"„{Clip(name, 30)}“";
        }

        return AiDocOps.Type(e) == "text" && AiDocOps.Str(e["text"]).Replace('\n', ' ').Trim() is { Length: > 0 } text ? $"„{Clip(text, 30)}“" : AiDocOps.Id(e);
    }

    private static double R1(double value) => Math.Round(value, 1, MidpointRounding.AwayFromZero);

    /// <summary>One element for the model: the properties that matter, without the defaults, children inside a group.</summary>
    public static JsonObject Compact(JsonObject e)
    {
        var type = AiDocOps.Type(e);
        var o = new JsonObject { ["id"] = AiDocOps.Id(e), ["type"] = type };
        if (AiDocOps.Str(e["name"]) is { Length: > 0 } name)
        {
            o["name"] = name;
        }

        o["x"] = R1(AiDocOps.Num(e["x"]));
        o["y"] = R1(AiDocOps.Num(e["y"]));
        o["w"] = R1(AiDocOps.Num(e["w"]));
        o["h"] = R1(AiDocOps.Num(e["h"]));
        if (AiDocOps.Num(e["rotation"]) != 0)
        {
            o["rotation"] = AiDocOps.Num(e["rotation"]);
        }

        if (e["opacity"] is not null && AiDocOps.Num(e["opacity"]) != 1)
        {
            o["opacity"] = AiDocOps.Num(e["opacity"]);
        }

        if (AiDocOps.Flag(e["locked"]))
        {
            o["locked"] = true;
        }

        if (AiDocOps.Flag(e["hidden"]))
        {
            o["hidden"] = true;
        }

        if (AiDocOps.Str(e["showIf"]) is { Length: > 0 } show)
        {
            o["showIf"] = show;
        }

        switch (type)
        {
            case "text":
                o["text"] = Clip(AiDocOps.Str(e["text"]), 200);
                o["fontFamily"] = AiDocOps.Str(e["fontFamily"]);
                o["fontSize"] = AiDocOps.Num(e["fontSize"]);
                if (AiDocOps.Num(e["fontWeight"]) != 400)
                {
                    o["fontWeight"] = AiDocOps.Num(e["fontWeight"]);
                }

                o["color"] = AiDocOps.Str(e["color"]);
                if (AiDocOps.Str(e["align"]) is { Length: > 0 } align && align != "left")
                {
                    o["align"] = align;
                }

                if (AiDocOps.Str(e["fit"]) == "shrink")
                {
                    o["fit"] = "shrink";
                }

                break;
            case "image":
                o["source"] = e["source"]?.DeepClone();
                o["fit"] = AiDocOps.Str(e["fit"]);
                if (AiDocOps.Str(e["mask"]) is { Length: > 0 } mask && mask != "none")
                {
                    o["mask"] = mask;
                }

                break;
            case "imageStrip":
                o["items"] = e["items"]?.DeepClone();
                break;
            case "shape":
                o["shape"] = AiDocOps.Str(e["shape"]);
                o["fill"] = e["fill"] is JsonObject ? "Verlauf" : e["fill"]?.DeepClone();
                if (AiDocOps.Str(e["stroke"]) is { Length: > 0 } stroke)
                {
                    o["stroke"] = stroke;
                    o["strokeWidth"] = AiDocOps.Num(e["strokeWidth"]);
                }

                break;
            case "icon":
                o["icon"] = AiDocOps.Str(e["icon"]);
                o["color"] = AiDocOps.Str(e["color"]);
                break;
            case "qr":
            case "barcode":
                o["value"] = Clip(AiDocOps.Str(e["value"]), 100);
                if (type == "barcode")
                {
                    o["format"] = AiDocOps.Str(e["format"]);
                }

                break;
            case "group":
                o["children"] = new JsonArray((e["children"] as JsonArray ?? []).OfType<JsonObject>().Select(c => (JsonNode)Compact(c)).ToArray());
                break;
        }

        return o;
    }

    /// <summary>The design for the model (and for a reference): format, fields, and per page the background and the element tree. <paramref name="maxChars"/> keeps it small: a page that does not fit is only counted.</summary>
    public static JsonObject DescribeDocument(JsonObject doc, string name, string? pageKey, int maxChars)
    {
        var result = new JsonObject
        {
            ["name"] = name,
            ["format"] = new JsonObject { ["width"] = AiDocOps.Num(doc["width"]), ["height"] = AiDocOps.Num(doc["height"]), ["unit"] = AiDocOps.Unit(doc), ["dpi"] = AiDocOps.Num(doc["dpi"]) },
            ["fields"] = new JsonArray(AiDocOps.Fields(doc).OfType<JsonObject>().Select(f => (JsonNode)new JsonObject
            {
                ["key"] = AiDocOps.Str(f["key"]), ["label"] = AiDocOps.Str(f["label"]), ["type"] = AiDocOps.Str(f["type"]), ["sample"] = Clip(AiDocOps.Str(f["sample"]), 80),
            }).ToArray()),
        };
        var pages = new JsonArray();
        var budget = maxChars;
        var number = 0;
        foreach (var page in AiDocOps.Pages(doc).OfType<JsonObject>())
        {
            number++;
            if (pageKey is not null && AiDocOps.FindPage(doc, pageKey) != page)
            {
                continue;
            }

            var elements = new JsonArray(AiDocOps.Elements(page).OfType<JsonObject>().Select(e => (JsonNode)Compact(e)).ToArray());
            var entry = new JsonObject
            {
                ["id"] = AiDocOps.Id(page),
                ["number"] = number,
                ["name"] = AiDocOps.Str(page["name"]),
                ["background"] = page["background"]?.DeepClone(),
                ["elementCount"] = AiDocOps.CountNodes(AiDocOps.Elements(page)),
            };
            var size = elements.ToJsonString().Length;
            if (size <= budget)
            {
                entry["elements"] = elements;
                budget -= size;
            }
            else
            {
                entry["elements"] = new JsonArray();
                entry["note"] = "Die Elemente passen nicht mehr in diese Antwort: lies die Seite einzeln mit read_design {\"page\": \"" + AiDocOps.Id(page) + "\"} oder die Elemente mit read_elements.";
            }

            pages.Add(entry);
        }

        result["pages"] = pages;
        return result;
    }

    private static async Task<ToolOutcome> ReadDesignAsync(Biz biz, AiToolSession s, JsonObject args)
    {
        var head = await HeadAsync(biz, s.DesignId);
        var doc = AiDocOps.Parse(head.DocumentJson);
        var key = ArgText(args, "page", "pageId", "seite");
        if (!string.IsNullOrWhiteSpace(key) && AiDocOps.FindPage(doc, key) is null)
        {
            throw new ToolError($"Seite „{Clip(key, 20)}“ gibt es nicht", $"Die Seite \"{Clip(key, 20)}\" gibt es nicht. Es gibt: {PageList(doc)}.");
        }

        var result = DescribeDocument(doc, head.Name, string.IsNullOrWhiteSpace(key) ? null : key, 60_000);
        result["revision"] = head.Revision;
        var page = string.IsNullOrWhiteSpace(key) ? null : AiDocOps.FindPage(doc, key);
        return Ok(page is null ? "Design gelesen" : $"{PageLabel(doc, page)} gelesen", result, null, page is null ? null : AiDocOps.Id(page));
    }

    private static async Task<ToolOutcome> ReadElementsAsync(Biz biz, AiToolSession s, JsonObject args)
    {
        var ids = ArgList(args, "ids", "id", "elements");
        if (ids.Count == 0)
        {
            throw new ToolError("ids fehlen", "Nenne die ids der Elemente (ids: [\"e1\", ...]).");
        }

        var doc = AiDocOps.Parse((await HeadAsync(biz, s.DesignId)).DocumentJson);
        var found = new JsonArray();
        var missing = new List<string>();
        foreach (var id in ids.Take(30))
        {
            if (AiDocOps.Locate(doc, id) is { } l)
            {
                found.Add(l.Element.DeepClone());
            }
            else
            {
                missing.Add(id);
            }
        }

        var warnings = missing.Count > 0 ? new List<string> { $"Diese ids gibt es nicht: {string.Join(", ", missing)}." } : [];
        if (ids.Count > 30)
        {
            warnings.Add("Nur die ersten 30 ids wurden gelesen.");
        }

        return found.Count == 0
            ? Fail("Elemente nicht gefunden", $"Diese ids gibt es im Design nicht: {string.Join(", ", missing)}. Hol sie mit read_design.")
            : Ok($"{found.Count} {(found.Count == 1 ? "Element" : "Elemente")} gelesen", new JsonObject { ["elements"] = found }, warnings, null, [.. found.OfType<JsonObject>().Select(AiDocOps.Id)]);
    }

    // ------------------------------------------------------------------------------------------------ fonts, media, icons, brand, templates, formats

    private static async Task<ToolOutcome> ListFontsAsync(Biz biz, AiToolSession s)
    {
        var fonts = await FontLogic.AllAsync(biz, s.DesignId);
        var families = fonts.GroupBy(f => f.Family, StringComparer.OrdinalIgnoreCase).OrderBy(g => g.Key, StringComparer.OrdinalIgnoreCase).Select(g => (JsonNode)new JsonObject
        {
            ["family"] = g.Key,
            ["weights"] = new JsonArray(g.Where(f => f.Style == "normal").Select(f => f.Weight).Distinct().Select(w => (JsonNode)JsonValue.Create(w)!).ToArray()),
            ["italic"] = g.Any(f => f.Style == "italic"),
            ["builtIn"] = g.All(f => f.IsBuiltIn),
            ["stimmung"] = AiDesignGuide.Moods.TryGetValue(g.Key, out var mood) ? $"{mood.Kind}: {mood.Use}" : null,
        }).ToArray();
        return Ok($"{families.Length} Schriftfamilien", new JsonObject { ["families"] = new JsonArray(families), ["generic"] = new JsonArray("sans-serif", "serif", "monospace") });
    }

    private static async Task<ToolOutcome> ListMediaAsync(Biz biz, AiToolSession s, JsonObject args)
    {
        var head = await HeadAsync(biz, s.DesignId);
        var q = ArgText(args, "q", "search", "query");
        var category = ArgText(args, "category", "kategorie");
        var limit = Math.Clamp(ArgInt(args, "limit") ?? 30, 1, 50);
        var attachments = s.AttachmentAssets.ToList();
        var space = head.SpaceId;
        var query = AssetLogic.Query(biz).Where(a => a.SpaceId == null || a.SpaceId == space || attachments.Contains(a.Id));
        if (!string.IsNullOrWhiteSpace(category))
        {
            var c = category.Trim().ToLowerInvariant();
            query = query.Where(a => a.Category.ToLower() == c);
        }

        if (!string.IsNullOrWhiteSpace(q))
        {
            var like = Services.Like.Contains(q.Trim());
            query = query.Where(a => EF.Functions.ILike(a.Name, like, "\\") || EF.Functions.ILike(a.Key, like, "\\") || EF.Functions.ILike(a.Tags, like, "\\") || EF.Functions.ILike(a.Category, like, "\\"));
        }

        var rows = await query.OrderBy(a => a.Name).ThenBy(a => a.Key).Take(limit).ToListAsync();
        var list = rows.Select(a => (JsonNode)new JsonObject
        {
            ["key"] = a.Key, ["name"] = a.Name, ["category"] = a.Category, ["width"] = a.Width, ["height"] = a.Height, ["attached"] = attachments.Contains(a.Id),
        }).ToArray();
        return Ok($"{list.Length} Bilder in der Bibliothek", new JsonObject { ["media"] = new JsonArray(list) }, list.Length == 0 ? ["Nichts gefunden. Ohne passendes Bild: ein Symbol (search_icons), eine Form oder create_svg."] : null);
    }

    private static ToolOutcome SearchIcons(Biz biz, JsonObject args)
    {
        var q = ArgText(args, "q", "query", "search") ?? "";
        var limit = Math.Clamp(ArgInt(args, "limit") ?? 20, 1, 40);
        var library = IconSearch.Load(biz.Service<IWebHostEnvironment>().WebRootPath);
        var found = IconSearch.Search(library, q);
        var top = found.Take(limit).ToList();
        var result = new JsonObject { ["icons"] = new JsonArray(top.Select(n => (JsonNode)JsonValue.Create(n)!).ToArray()), ["total"] = found.Count };
        return Ok($"{(top.Count == 0 ? "Keine" : top.Count.ToString(CultureInfo.InvariantCulture))} Symbole für „{Clip(q, 30)}“", result, top.Count == 0 ? ["Nichts gefunden: versuche ein anderes, einfacheres Wort (deutsch oder englisch)."] : null);
    }

    private static async Task<(BrandKit Kit, IReadOnlyList<AssetRow> Logos)> BrandAsync(Biz biz, long? spaceId)
    {
        try
        {
            var view = await BrandLogic.GetAsync(biz, spaceId);
            return (view.Kit, view.LogoAssets);
        }
        catch (NotFoundException) when (spaceId is not null)
        {
            var view = await BrandLogic.GetAsync(biz);
            return (view.Kit, view.LogoAssets);
        }
    }

    private static async Task<ToolOutcome> ReadBrandAsync(Biz biz, AiToolSession s)
    {
        var head = await HeadAsync(biz, s.DesignId);
        var (kit, logos) = await BrandAsync(biz, head.SpaceId);
        var result = new JsonObject
        {
            ["colors"] = new JsonArray(kit.Colors.Select(c => (JsonNode)JsonValue.Create(c)!).ToArray()),
            ["fonts"] = new JsonObject { ["heading"] = kit.Fonts.Heading, ["subheading"] = kit.Fonts.Subheading, ["body"] = kit.Fonts.Body },
            ["logos"] = new JsonArray(logos.Select(l => (JsonNode)new JsonObject { ["key"] = l.Key, ["name"] = l.Name, ["width"] = l.Width, ["height"] = l.Height }).ToArray()),
        };
        var empty = kit.Colors.Count == 0 && kit.Fonts.Heading is null && kit.Fonts.Body is null && logos.Count == 0;
        return Ok(empty ? "Marke gelesen (leer)" : "Marke gelesen", result, empty ? ["Die Marke ist leer: wähle Farben und Schriften selbst, passend zum Auftrag."] : null);
    }

    private static async Task<ToolOutcome> ListTemplatesAsync(Biz biz, JsonObject args)
    {
        var q = ArgText(args, "q", "query", "search");
        var category = ArgText(args, "category", "kategorie");
        var query = DesignLogic.TemplateQuery(biz);
        if (!string.IsNullOrWhiteSpace(category))
        {
            var c = category.Trim().ToLowerInvariant();
            query = query.Where(d => d.Category != null && d.Category.ToLower() == c);
        }

        if (!string.IsNullOrWhiteSpace(q))
        {
            var like = Services.Like.Contains(q.Trim());
            query = query.Where(d => EF.Functions.ILike(d.Name, like, "\\") || (d.Category != null && EF.Functions.ILike(d.Category, like, "\\")) || (d.Description != null && EF.Functions.ILike(d.Description, like, "\\")));
        }

        var rows = await query.OrderBy(d => d.Category).ThenBy(d => d.Name).ThenBy(d => d.Id).Take(30).ToListAsync();
        var list = rows.Select(t => (JsonNode)new JsonObject { ["id"] = t.Id, ["name"] = t.Name, ["category"] = t.Category, ["description"] = Clip(t.Description, 160), ["size"] = t.Size }).ToArray();
        return Ok($"{list.Length} Vorlagen", new JsonObject { ["templates"] = new JsonArray(list) }, list.Length == 0 ? ["Keine Vorlage gefunden."] : null);
    }

    private static ToolOutcome ListFormats()
    {
        var list = FormatPresets.All.Select(p => (JsonNode)new JsonObject { ["preset"] = p.Key, ["name"] = p.Name, ["width"] = p.Width, ["height"] = p.Height, ["unit"] = p.Unit }).ToArray();
        return Ok($"{list.Length} Formate", new JsonObject { ["formats"] = new JsonArray(list) });
    }

    private static async Task<ToolOutcome> ReadDataListAsync(Biz biz, AiToolSession s, JsonObject args)
    {
        var wanted = ArgText(args, "id", "listId") is { } text && long.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id) ? id : (long?)null;
        if (s.ReferencedLists.Count == 0)
        {
            throw new ToolError("Keine Datenliste angehängt", "Die Person hat keine Datenliste als Referenz angehängt.");
        }

        var listId = wanted ?? s.ReferencedLists.Last();
        if (!s.ReferencedLists.Contains(listId))
        {
            throw new ToolError("Datenliste nicht angehängt", $"Die Datenliste {listId} hat die Person nicht angehängt. Angehängt: {string.Join(", ", s.ReferencedLists)}.");
        }

        var list = await biz.Db.DataList.AsNoTracking().FirstOrDefaultAsync(l => l.Id == listId) ?? throw new NotFoundException();
        await Access.RequireAsync(biz, ItemKind.DataList, listId, AccessLevel.View);
        if (AiDataLogic.BlockedReason(biz, list) is { } reason)
        {
            throw new ToolError("Datenliste nicht lesbar", reason);
        }

        var grid = await DataListLogic.GridAsync(biz, listId);
        return Ok($"Datenliste „{Clip(grid.Name, 40)}“ gelesen", DescribeList(grid), null);
    }

    /// <summary>The columns and the first 20 rows of a data list for the model.</summary>
    public static JsonObject DescribeList(GridData grid)
        => new()
        {
            ["id"] = grid.Id,
            ["name"] = grid.Name,
            ["rowCount"] = grid.Rows.Count,
            ["columns"] = new JsonArray(grid.Columns.Select(c => (JsonNode)new JsonObject { ["key"] = c.Key, ["label"] = c.Label, ["type"] = c.Type }).ToArray()),
            ["rows"] = new JsonArray(grid.Rows.Take(20).Select(r => (JsonNode)new JsonObject(r.Values.Select(v => new KeyValuePair<string, JsonNode?>(v.Key, Clip(v.Value, 200))))).ToArray()),
        };
}
