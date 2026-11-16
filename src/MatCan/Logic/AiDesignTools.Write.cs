using System.Globalization;
using System.Text;
using System.Text.Json.Nodes;
using MatCan.Core.Documents;
using MatCan.Core.Media;
using MatCan.Data.Entities;
using MatCan.Services.Ai;
using Microsoft.EntityFrameworkCore;

namespace MatCan.Logic;

public static partial class AiDesignTools
{
    private const int MaxElementsPerCall = 200;
    private const int MaxIdsPerCall = 200;
    public const int MaxSvgChars = 200_000;

    /// <summary>What a patch on the document did, for the outcome: the summary line, what the model gets back, warnings, the pages to lint, the ids to flash.</summary>
    private sealed record PatchResult(string Summary, JsonNode? Result, List<string> Warnings, IReadOnlyCollection<string> Pages, List<string> ElementIds, string? PageId, List<string>? Created = null);

    // ------------------------------------------------------------------------------------------------ the one way to write

    /// <summary>
    /// Reads the design again (a person may have saved meanwhile), applies the patch to it, runs the WHOLE document through the validator (a refusal is a reason for the model, what the validator would silently
    /// drop is refused too), lints it and saves it with the revision it read: a save of somebody else in between makes the tool read and patch again (three tries). The writes of one run share one history entry; the
    /// first write opens the journal entry of the run (the document before), every write brings its end state up to date.
    /// </summary>
    private static async Task<ToolOutcome> WriteAsync(Biz biz, AiToolSession s, Func<JsonObject, Task<PatchResult>> patch)
    {
        for (var attempt = 0; ; attempt++)
        {
            var head = await HeadAsync(biz, s.DesignId);
            var doc = AiDocOps.Parse(head.DocumentJson);
            var result = await patch(doc);
            AiDocOps.FixGroups(doc);
            CheckLimits(doc);
            var text = doc.ToJsonString();
            var validated = DocumentValidator.Validate(text);
            if (!validated.Ok || validated.Document is null || validated.Json is null)
            {
                throw new ToolError("Das Dokument wäre ungültig", validated.Error ?? "Das Dokument wäre ungültig.");
            }

            var expected = AiDocOps.AllElements(doc).Count();
            var got = validated.Document.AllElements.Count();
            if (got != expected)
            {
                throw new ToolError("Das Dokument wäre ungültig", $"Das Ergebnis hätte {expected - got} Element(e) verloren (unbekannter Typ, zu tief verschachtelte Gruppe oder zu viele Elemente). Nichts wurde geschrieben.");
            }

            var warnings = new List<string>(result.Warnings);
            warnings.AddRange(validated.Warnings.Where(w => !w.Contains("doppelte Kennungen", StringComparison.Ordinal)));
            foreach (var line in AiDesignLint.Run(validated.Document, result.Pages).Take(12))
            {
                if (s.LintSeen.Add(line))
                {
                    warnings.Add(line);
                }
            }

            // the stored text is what PostgreSQL keeps of the JSON (its own order of keys): compared in the form the validator writes
            if (validated.Json == (DocumentValidator.Validate(head.DocumentJson).Json ?? head.DocumentJson))
            {
                return new ToolOutcome(true, "Keine Änderung nötig", AddNote(result.Result, "Das Design ist schon so; nichts wurde gespeichert."), warnings, result.PageId, result.ElementIds, false, head.Revision);
            }

            DesignSaved saved;
            try
            {
                saved = await DesignLogic.SaveDocumentAsync(biz, s.DesignId, head.Revision, validated.Json, false, s.Note, s.Wrote ? s.RevisionAfter : null);
            }
            catch (RevisionConflictException) when (attempt < 3)
            {
                continue;
            }
            catch (BizException ex) when (ex.Message.StartsWith("Das Bild", StringComparison.Ordinal))
            {
                throw new ToolError("Bild nicht verfügbar", ex.Message + " Nutze nur Schlüssel aus list_media (oder ein Bild, das du mit create_svg gemacht hast).");
            }

            foreach (var id in result.Created ?? [])
            {
                s.CreatedIds.Add(id);
            }

            await JournalAsync(biz, s, head, validated.Json, saved.Revision);
            return new ToolOutcome(true, result.Summary, result.Result, warnings, result.PageId, result.ElementIds, true, saved.Revision);
        }
    }

    private static JsonNode? AddNote(JsonNode? result, string note)
    {
        if (result is JsonObject o)
        {
            o["note"] = note;
            return o;
        }

        return new JsonObject { ["note"] = note };
    }

    private static void CheckLimits(JsonObject doc)
    {
        var pages = AiDocOps.Pages(doc);
        if (pages.Count > DocumentValidator.MaxPages)
        {
            throw new ToolError("Zu viele Seiten", $"Ein Design hat höchstens {DocumentValidator.MaxPages} Seiten.");
        }

        var total = 0;
        foreach (var page in pages.OfType<JsonObject>())
        {
            var count = AiDocOps.CountNodes(AiDocOps.Elements(page));
            total += count;
            if (count > DocumentValidator.MaxElementsPerPage)
            {
                throw new ToolError("Zu viele Elemente", $"Eine Seite hat höchstens {DocumentValidator.MaxElementsPerPage} Elemente (ein Element in einer Gruppe zählt mit); Seite {AiDocOps.PageNumber(doc, page)} hätte {count}. Nichts wurde geschrieben.");
            }

            if (AiDocOps.Elements(page).OfType<JsonObject>().Any(e => AiDocOps.GroupDepth(e) > DocumentValidator.MaxGroupDepth))
            {
                throw new ToolError("Gruppen zu tief", $"Gruppen lassen sich nur bis zu {DocumentValidator.MaxGroupDepth} Ebenen tief schachteln.");
            }
        }

        if (total > DocumentValidator.MaxElementsTotal)
        {
            throw new ToolError("Zu viele Elemente", $"Ein Design hat höchstens {DocumentValidator.MaxElementsTotal} Elemente.");
        }
    }

    /// <summary>Keeps the journal of the run: ONE entry for the design (the document before the first write, the end state after the last) and the revisions in the result of the run.</summary>
    private static async Task JournalAsync(Biz biz, AiToolSession s, DesignHead before, string after, int revision)
    {
        if (!s.Wrote)
        {
            s.Wrote = true;
            s.RevisionBefore = before.Revision;
            var entry = new AiJournalEntry { AiRunId = s.RunId, EntityType = nameof(Design), EntityId = s.DesignId, Field = "Dokument", OldValue = before.DocumentJson, NewValue = after };
            biz.Db.AiJournalEntry.Add(entry);
            await biz.Db.SaveChangesAsync();
            s.JournalId = entry.Id;
        }
        else
        {
            var id = s.JournalId;
            await biz.Db.AiJournalEntry.Where(j => j.Id == id).ExecuteUpdateAsync(u => u.SetProperty(j => j.NewValue, after));
        }

        s.RevisionAfter = revision;
        var result = new JsonObject { ["design"] = s.DesignId, ["revisionBefore"] = s.RevisionBefore, ["revisionAfter"] = revision }.ToJsonString();
        await biz.Db.AiRun.Where(r => r.Id == s.RunId).ExecuteUpdateAsync(u => u.SetProperty(r => r.ResultJson, result));
    }

    // ------------------------------------------------------------------------------------------------ the scope

    private static string ScopeText(AiToolSession s) => s.Scope.IsPage ? $"nur Seite {s.Scope.PageId}" : s.Scope.IsSelection ? $"nur die gewählten Elemente ({string.Join(", ", s.Scope.ElementIds.Take(8))})" : "ganzes Design";

    private static ToolError Outside(AiToolSession s, string what)
        => new("Außerhalb des Bereichs", $"{what} liegt außerhalb des Bereichs, den die Person freigegeben hat ({ScopeText(s)}, „Nur hier ändern“). Du darfst dort nur lesen. Arbeite nur innerhalb des Bereichs.");

    /// <summary>The ids a selection scope allows: the selected elements with everything inside them, and what this run made.</summary>
    private static HashSet<string> AllowedIds(JsonObject doc, AiToolSession s)
    {
        var allowed = new HashSet<string>(s.CreatedIds, StringComparer.Ordinal);
        foreach (var id in s.Scope.ElementIds)
        {
            if (AiDocOps.Locate(doc, id) is { } l)
            {
                foreach (var node in AiDocOps.Walk(new JsonArray(l.Element.DeepClone())))
                {
                    allowed.Add(AiDocOps.Id(node));
                }
            }
        }

        return allowed;
    }

    /// <summary>A write to this element: allowed in the scope, and not locked by the person.</summary>
    private static void RequireElement(AiToolSession s, JsonObject doc, Located located, bool ignoreLock = false)
    {
        var e = located.Element;
        if (s.Scope.Locked)
        {
            var ok = s.Scope.IsPage
                ? string.Equals(AiDocOps.Id(located.Page), s.Scope.PageId, StringComparison.OrdinalIgnoreCase)
                : !s.Scope.IsSelection || AllowedIds(doc, s).Contains(AiDocOps.Id(e)) || located.Chain.Any(g => AllowedIds(doc, s).Contains(AiDocOps.Id(g)));
            if (!ok)
            {
                throw Outside(s, $"Das Element {ElementName(e)} ({AiDocOps.Id(e)}, {PageLabel(doc, located.Page)})");
            }
        }

        if (!ignoreLock && (AiDocOps.Flag(e["locked"]) || located.Chain.Any(g => AiDocOps.Flag(g["locked"]))))
        {
            throw new ToolError("Element ist gesperrt", $"Das Element {ElementName(e)} ({AiDocOps.Id(e)}) hat die Person gesperrt (locked): sie will es nicht geändert haben. Lass es, oder frage nach, bevor du es mit {{\"locked\": false}} entsperrst.");
        }
    }

    /// <summary>New elements on a page: the page must be in the scope (a selection scope: the page of a selected element).</summary>
    private static void RequireAddTo(AiToolSession s, JsonObject doc, JsonObject page)
    {
        if (!s.Scope.Locked)
        {
            return;
        }

        var ok = s.Scope.IsPage
            ? string.Equals(AiDocOps.Id(page), s.Scope.PageId, StringComparison.OrdinalIgnoreCase)
            : !s.Scope.IsSelection || s.Scope.ElementIds.Any(id => AiDocOps.Locate(doc, id) is { } l && l.Page == page) || AiDocOps.Walk(AiDocOps.Elements(page)).Any(e => s.CreatedIds.Contains(AiDocOps.Id(e)));
        if (!ok)
        {
            throw Outside(s, $"{PageLabel(doc, page)}");
        }
    }

    /// <summary>A change of a whole page (its background, all its elements): only a page scope, and only its page.</summary>
    private static void RequirePageLevel(AiToolSession s, JsonObject doc, JsonObject page)
    {
        if (s.Scope.Locked && !(s.Scope.IsPage && string.Equals(AiDocOps.Id(page), s.Scope.PageId, StringComparison.OrdinalIgnoreCase)))
        {
            throw Outside(s, PageLabel(doc, page));
        }
    }

    /// <summary>A change that concerns the whole design (pages, format, name): not in a locked scope.</summary>
    private static void RequireDesignLevel(AiToolSession s, string what)
    {
        if (s.Scope.Locked)
        {
            throw Outside(s, what);
        }
    }

    // ------------------------------------------------------------------------------------------------ building and changing elements

    private sealed class Build(AiToolSession session, JsonObject doc, Func<string> nextId, HashSet<string> families, string defaultFamily, IconLibrary icons, HashSet<string> catalogIcons)
    {
        public AiToolSession Session { get; } = session;

        public JsonObject Doc { get; } = doc;

        public Func<string> NextId { get; } = nextId;

        public HashSet<string> Families { get; } = families;

        public string DefaultFamily { get; } = defaultFamily;

        public IconLibrary Icons { get; } = icons;

        /// <summary>The icons of catalogues (<c>prefix:name</c>) this installation has stored: only those can be used (import_from_catalog stores one).</summary>
        public HashSet<string> CatalogIcons { get; } = catalogIcons;

        public string Unit => AiDocOps.Unit(Doc);

        public List<string> Warnings { get; } = [];

        public List<string> Created { get; } = [];
    }

    private static readonly string[] GenericFamilies = ["sans-serif", "serif", "monospace", "cursive", "fantasy"];

    private static async Task<Build> NewBuildAsync(Biz biz, AiToolSession s, JsonObject doc, DesignHead head)
    {
        var fonts = await FontLogic.AllAsync(biz, s.DesignId);
        var families = fonts.Select(f => f.Family).Concat(GenericFamilies).ToHashSet(StringComparer.OrdinalIgnoreCase);
        string[] preferred = ["Open Sans", "Source Sans 3", "Montserrat", "Roboto Slab"];
        var fallback = preferred.FirstOrDefault(p => fonts.Any(f => string.Equals(f.Family, p, StringComparison.OrdinalIgnoreCase))) ?? fonts.Select(f => f.Family).FirstOrDefault() ?? "sans-serif";
        var (kit, _) = await BrandAsync(biz, head.SpaceId);
        var body = kit.Fonts.Body is { } b && families.Contains(b) ? b : fallback;
        var icons = IconSearch.Load(biz.Service<IWebHostEnvironment>().WebRootPath);
        var catalogIcons = (await biz.Db.IconBody.AsNoTracking().Select(i => i.Prefix + ":" + i.Name).ToListAsync()).ToHashSet(StringComparer.Ordinal);
        return new Build(s, doc, AiDocOps.IdMaker(doc), families, body, icons, catalogIcons);
    }

    private static readonly Dictionary<string, string> Aliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["width"] = "w",
        ["height"] = "h",
        ["left"] = "x",
        ["top"] = "y",
        ["font"] = "fontFamily",
        ["size"] = "fontSize",
    };

    private static string FamilyOf(Build c, string requested, string where)
    {
        var found = c.Families.FirstOrDefault(f => string.Equals(f, requested.Trim(), StringComparison.OrdinalIgnoreCase));
        if (found is not null)
        {
            return found;
        }

        c.Warnings.Add($"{where}: die Schrift „{Clip(requested, 40)}“ gibt es hier nicht; eingesetzt wurde „{c.DefaultFamily}“. Die vorhandenen Familien zeigt list_fonts.");
        return c.DefaultFamily;
    }

    /// <summary>One property of an element read for its type: the checked value (and whether to set it at all).</summary>
    private static bool ReadProperty(Build c, CatalogType type, string name, JsonNode? raw, string where, out JsonNode? value)
    {
        value = null;
        var key = Aliases.TryGetValue(name, out var alias) ? alias : name;
        if (key is "id" or "type")
        {
            return false;
        }

        var prop = type.Find(key);
        if (prop is null)
        {
            c.Warnings.Add($"{where}: „{Clip(name, 30)}“ gibt es bei {type.Type} nicht (ignoriert).");
            return false;
        }

        if (prop.Kind == CatalogKind.Children)
        {
            c.Warnings.Add($"{where}: die Kinder einer Gruppe setzt du mit add_elements (group), group und ungroup (ignoriert).");
            return false;
        }

        var coerced = AiDesignCatalog.Coerce(prop, raw, c.Unit);
        if (coerced.Warning is not null)
        {
            c.Warnings.Add($"{where}: {coerced.Warning}");
        }

        if (coerced.Drop)
        {
            return false;
        }

        value = coerced.Value;
        if ((key is "fontFamily") && value is JsonValue fv && fv.TryGetValue<string>(out var family))
        {
            value = FamilyOf(c, family, where);
        }
        else if (key == "icon" && value is JsonValue civ && civ.TryGetValue<string>(out var catalogIcon) && catalogIcon.Contains(':', StringComparison.Ordinal))
        {
            // an icon of a catalogue: it has to be in the library of this installation (import_from_catalog puts it there)
            if (!c.CatalogIcons.Contains(catalogIcon))
            {
                throw new ToolError("Symbol ist nicht in der Bibliothek", $"{where}: das Symbol „{catalogIcon}“ ist nicht in der Bibliothek. Hole es zuerst mit import_from_catalog (catalog: \"iconify\", itemId: \"{catalogIcon}\").");
            }
        }
        else if (key == "icon" && value is JsonValue iv && iv.TryGetValue<string>(out var icon) && !c.Icons.Exists(icon))
        {
            var similar = IconSearch.Search(c.Icons, icon.Replace('-', ' ')).Take(5).ToList();
            throw new ToolError("Symbol gibt es nicht", $"{where}: das Symbol „{icon}“ gibt es nicht." + (similar.Count > 0 ? $" Ähnliche: {string.Join(", ", similar)}." : " Suche mit search_icons."));
        }

        return true;
    }

    private static double PtToUnit(double pt, string unit) => unit == "px" ? pt * 96 / 72 : pt * 25.4 / 72;

    /// <summary>Builds one new element from what the model wrote: checked per property, with a new id; a group builds its children too.</summary>
    private static JsonObject BuildElement(Build c, JsonObject spec, int depth, string where)
    {
        var typeName = AiDocOps.Str(spec["type"]).Trim();
        var type = AiDesignCatalog.Types.FirstOrDefault(t => string.Equals(t.Type, typeName, StringComparison.OrdinalIgnoreCase))
            ?? throw new ToolError("type fehlt oder unbekannt", $"{where}: type \"{Clip(typeName, 30)}\" gibt es nicht. Erlaubt: {string.Join(", ", AiDesignCatalog.Types.Select(t => t.Type))}.");
        if (type.Type == "group" && depth > DocumentValidator.MaxGroupDepth)
        {
            throw new ToolError("Gruppen zu tief", $"{where}: Gruppen lassen sich nur bis zu {DocumentValidator.MaxGroupDepth} Ebenen tief schachteln.");
        }

        var element = new JsonObject { ["id"] = c.NextId(), ["type"] = type.Type };
        c.Created.Add(AiDocOps.Id(element));
        var given = new HashSet<string>(StringComparer.Ordinal);
        foreach (var (name, raw) in spec)
        {
            if (name is "id" or "type")
            {
                continue;
            }

            var key = Aliases.TryGetValue(name, out var alias) ? alias : name;
            if (type.Type == "group" && key == "children")
            {
                continue;
            }

            if (ReadProperty(c, type, name, raw, where, out var value))
            {
                element[key] = value;
                given.Add(key);
            }
        }

        if (type.Type == "group")
        {
            var children = new JsonArray();
            foreach (var (child, index) in (spec["children"] as JsonArray ?? []).Select((n, i) => (n, i)))
            {
                if (child is not JsonObject childSpec)
                {
                    throw new ToolError("Kind ungültig", $"{where}.children[{index}] muss ein Objekt sein.");
                }

                children.Add(BuildElement(c, childSpec, depth + 1, $"{where}.children[{index}]"));
            }

            if (children.Count == 0)
            {
                throw new ToolError("Gruppe ohne Kinder", $"{where}: eine Gruppe braucht children.");
            }

            element["children"] = children;
            var box = AiDocOps.Union(children.OfType<JsonObject>().Select(AiDocOps.Aabb));
            element["x"] = AiDocOps.Number(box.X);
            element["y"] = AiDocOps.Number(box.Y);
            element["w"] = AiDocOps.Number(box.W);
            element["h"] = AiDocOps.Number(box.H);
            return element;
        }

        if (!given.Contains("x") || !given.Contains("y"))
        {
            throw new ToolError("Position fehlt", $"{where}: x und y fehlen (Zahlen in {c.Unit}, Ursprung links oben).");
        }

        var isLine = type.Type == "shape" && AiDocOps.Str(element["shape"]) == "line";
        if (!given.Contains("w") && !isLine)
        {
            throw new ToolError("Größe fehlt", $"{where}: w fehlt (Breite in {c.Unit}).");
        }

        if (!given.Contains("h") && !isLine)
        {
            if (type.Type == "text")
            {
                var lines = Math.Max(1, AiDocOps.Str(element["text"]).Split('\n').Length);
                var size = element["fontSize"] is null ? 12 : AiDocOps.Num(element["fontSize"]);
                var lineHeight = element["lineHeight"] is null ? 1.2 : AiDocOps.Num(element["lineHeight"]);
                element["h"] = AiDocOps.Number(PtToUnit(size, c.Unit) * lineHeight * lines * 1.1);
                c.Warnings.Add($"{where}: h fehlte; die Höhe wurde für {lines} Zeile(n) geschätzt.");
            }
            else
            {
                throw new ToolError("Größe fehlt", $"{where}: h fehlt (Höhe in {c.Unit}).");
            }
        }

        if (isLine)
        {
            element["w"] ??= AiDocOps.Number(0);
            element["h"] ??= AiDocOps.Number(0);
        }

        if (type.Type == "text" && !given.Contains("fontFamily"))
        {
            element["fontFamily"] = c.DefaultFamily;
        }

        if (type.Type == "barcode" && !given.Contains("fontFamily"))
        {
            element["fontFamily"] = c.DefaultFamily;
        }

        if (type.Type == "icon" && !given.Contains("icon"))
        {
            throw new ToolError("Symbol fehlt", $"{where}: icon fehlt (Name aus search_icons).");
        }

        return element;
    }

    private static string DescribeChange(IReadOnlyCollection<string> properties)
    {
        string Group(string p) => p switch
        {
            "text" => "Text",
            "fontFamily" => "Schrift",
            "fontSize" or "minFontSize" or "fit" => "Größe",
            "fontWeight" or "italic" or "underline" or "strike" or "uppercase" => "Stil",
            "color" or "fill" or "background" or "gradient" => "Farbe",
            "x" or "y" => "Position",
            "w" or "h" => "Maße",
            "rotation" => "Drehung",
            "opacity" => "Deckkraft",
            "stroke" or "strokeWidth" or "dash" or "border" or "outline" => "Linie",
            "shadow" => "Schatten",
            "source" or "crop" or "filters" or "mask" or "items" => "Bild",
            "align" or "valign" or "lineHeight" or "letterSpacing" or "list" or "wrap" => "Satz",
            "icon" => "Symbol",
            "value" => "Inhalt",
            "locked" => "Sperre",
            "hidden" => "Sichtbarkeit",
            "name" => "Name",
            _ => p,
        };

        return string.Join(", ", properties.Select(Group).Distinct().Take(4));
    }

    // ------------------------------------------------------------------------------------------------ add_elements

    private static async Task<ToolOutcome> AddElementsAsync(Biz biz, AiToolSession s, JsonObject args)
    {
        var list = args["elements"] as JsonArray ?? (args["element"] is JsonObject single ? new JsonArray(single.DeepClone()) : null);
        if (list is null || list.Count == 0)
        {
            throw new ToolError("elements fehlen", "Gib elements an: eine Liste von Elementen (jedes mit type, x, y, w, h und seinen Eigenschaften).");
        }

        if (list.Count > MaxElementsPerCall)
        {
            throw new ToolError("Zu viele Elemente auf einmal", $"Füge höchstens {MaxElementsPerCall} Elemente in einem Aufruf hinzu.");
        }

        var head = await HeadAsync(biz, s.DesignId);
        return await WriteAsync(biz, s, async doc =>
        {
            var page = PageOf(doc, s, args);
            RequireAddTo(s, doc, page);
            var c = await NewBuildAsync(biz, s, doc, head);
            JsonArray target = AiDocOps.Elements(page);
            var intoGroup = ArgText(args, "group", "parent");
            if (!string.IsNullOrWhiteSpace(intoGroup))
            {
                var g = AiDocOps.Locate(doc, intoGroup) ?? throw new ToolError("Gruppe gibt es nicht", $"Die Gruppe {Clip(intoGroup, 20)} gibt es nicht.");
                if (AiDocOps.Type(g.Element) != "group" || g.Page != page)
                {
                    throw new ToolError("Gruppe passt nicht", $"{Clip(intoGroup, 20)} ist keine Gruppe auf dieser Seite.");
                }

                RequireElement(s, doc, g);
                target = (JsonArray)g.Element["children"]!;
            }

            var baseDepth = intoGroup is null ? 1 : AiDocOps.Locate(doc, intoGroup)!.Chain.Count + 2;
            var built = new List<JsonObject>();
            for (var i = 0; i < list.Count; i++)
            {
                if (list[i] is not JsonObject spec)
                {
                    throw new ToolError("Element ungültig", $"elements[{i}] muss ein Objekt sein.");
                }

                built.Add(BuildElement(c, spec, baseDepth, $"elements[{i}]"));
            }

            var after = ArgText(args, "after", "position");
            var at = target.Count;
            if (string.Equals(after, "start", StringComparison.OrdinalIgnoreCase) || string.Equals(after, "bottom", StringComparison.OrdinalIgnoreCase))
            {
                at = 0;
            }
            else if (!string.IsNullOrWhiteSpace(after) && !string.Equals(after, "end", StringComparison.OrdinalIgnoreCase) && !string.Equals(after, "top", StringComparison.OrdinalIgnoreCase))
            {
                var index = target.Select((n, i) => (n, i)).FirstOrDefault(x => x.n is JsonObject o && AiDocOps.Id(o) == after);
                if (index.n is null)
                {
                    throw new ToolError("after gibt es nicht", $"Das Element {Clip(after, 20)} liegt nicht in dieser Ebene der Seite.");
                }

                at = index.i + 1;
            }

            foreach (var e in built)
            {
                target.Insert(at++, e);
            }

            var pageId = AiDocOps.Id(page);
            var added = new JsonArray(built.Select(e => (JsonNode)new JsonObject { ["id"] = AiDocOps.Id(e), ["type"] = AiDocOps.Type(e), ["name"] = AiDocOps.Str(e["name"]) }).ToArray());
            var summary = built.Count == 1
                ? $"{ElementKind(AiDocOps.Type(built[0]))} {ElementName(built[0])} hinzugefügt – {PageLabel(doc, page)}"
                : $"{built.Count} Elemente hinzugefügt – {PageLabel(doc, page)}";
            return new PatchResult(summary, new JsonObject { ["page"] = pageId, ["added"] = added }, c.Warnings, [pageId], [.. built.Select(AiDocOps.Id)], pageId, c.Created);
        });
    }

    // ------------------------------------------------------------------------------------------------ update_elements

    private static List<(string Id, JsonObject Set)> ParseChanges(JsonObject args)
    {
        var changes = new List<(string, JsonObject)>();
        void Add(JsonNode? node)
        {
            if (node is not JsonObject o)
            {
                return;
            }

            var id = AiDocOps.Str(o["id"]).Trim();
            JsonObject? set = o["set"] as JsonObject ?? o["props"] as JsonObject ?? o["properties"] as JsonObject;
            if (set is null)
            {
                set = new JsonObject();
                foreach (var (key, value) in o)
                {
                    if (key is not ("id" or "set"))
                    {
                        set[key] = value?.DeepClone();
                    }
                }
            }
            else
            {
                set = (JsonObject)set.DeepClone();
            }

            if (id.Length > 0)
            {
                changes.Add((id, set));
            }
        }

        var list = args["changes"] ?? args["updates"] ?? args["elements"] ?? args["items"];
        if (list is JsonArray array)
        {
            foreach (var n in array)
            {
                Add(n);
            }
        }
        else if (list is JsonObject one)
        {
            Add(one);
        }
        else
        {
            Add(args);
        }

        return changes;
    }

    private static async Task<ToolOutcome> UpdateElementsAsync(Biz biz, AiToolSession s, JsonObject args)
    {
        var changes = ParseChanges(args);
        if (changes.Count == 0)
        {
            throw new ToolError("changes fehlen", "Gib changes an: [{\"id\": \"e1\", \"set\": {\"fontSize\": 24}}].");
        }

        if (changes.Count > MaxElementsPerCall)
        {
            throw new ToolError("Zu viele Änderungen auf einmal", $"Ändere höchstens {MaxElementsPerCall} Elemente in einem Aufruf.");
        }

        var head = await HeadAsync(biz, s.DesignId);
        return await WriteAsync(biz, s, async doc =>
        {
            var c = await NewBuildAsync(biz, s, doc, head);
            var missing = changes.Where(x => AiDocOps.Locate(doc, x.Id) is null).Select(x => x.Id).Distinct().ToList();
            if (missing.Count > 0)
            {
                throw new ToolError("Elemente nicht gefunden", $"Diese ids gibt es im Design nicht: {string.Join(", ", missing.Take(10))}. Hol die ids mit read_design (nichts wurde geändert).");
            }

            var pages = new List<string>();
            var ids = new List<string>();
            var touched = new List<(JsonObject Element, List<string> Properties)>();
            foreach (var (id, set) in changes)
            {
                var located = AiDocOps.Locate(doc, id)!;
                var e = located.Element;
                var onlyLock = set.Count > 0 && set.All(p => p.Key == "locked");
                RequireElement(s, doc, located, ignoreLock: onlyLock);
                var type = AiDesignCatalog.Find(AiDocOps.Type(e))!;
                var where = $"{ElementKind(type.Type)} {id}";
                var changed = new List<string>();
                var newBox = AiDocOps.BoxOf(e);
                var boxChanged = false;
                foreach (var (name, raw) in set)
                {
                    var key = Aliases.TryGetValue(name, out var alias) ? alias : name;
                    if (type.Type == "group" && key is "x" or "y" or "w" or "h")
                    {
                        if (AiDesignCatalog.TryNumber(raw, out var number))
                        {
                            newBox = key switch { "x" => newBox with { X = number }, "y" => newBox with { Y = number }, "w" => newBox with { W = Math.Max(0, number) }, _ => newBox with { H = Math.Max(0, number) } };
                            boxChanged = true;
                            changed.Add(key);
                        }
                        else
                        {
                            c.Warnings.Add($"{where}: „{key}“ muss eine Zahl sein (ignoriert).");
                        }

                        continue;
                    }

                    if (ReadProperty(c, type, name, raw, where, out var value))
                    {
                        e[key] = value;
                        changed.Add(key);
                    }
                }

                if (boxChanged)
                {
                    AiDocOps.SetBox(e, newBox);
                }

                if (changed.Count > 0)
                {
                    touched.Add((e, changed));
                    ids.Add(id);
                    pages.Add(AiDocOps.Id(located.Page));
                }
            }

            if (touched.Count == 0)
            {
                throw new ToolError("Nichts zu ändern", "Keine der genannten Eigenschaften war gültig, es wurde nichts geändert. " + string.Join(" ", c.Warnings.Take(4)));
            }

            var distinctPages = pages.Distinct().ToList();
            var pageNames = distinctPages.Select(p => PageLabel(doc, AiDocOps.FindPage(doc, p)!)).ToList();
            var summary = touched.Count == 1
                ? $"{ElementKind(AiDocOps.Type(touched[0].Element))} {ElementName(touched[0].Element)} geändert ({DescribeChange(touched[0].Properties)}) – {string.Join(", ", pageNames)}"
                : $"{touched.Count} Elemente geändert – {string.Join(", ", pageNames)}";
            var result = new JsonObject { ["changed"] = new JsonArray(touched.Select(t => (JsonNode)new JsonObject { ["id"] = AiDocOps.Id(t.Element), ["properties"] = new JsonArray(t.Properties.Select(p => (JsonNode)JsonValue.Create(p)!).ToArray()) }).ToArray()) };
            return new PatchResult(summary, result, c.Warnings, distinctPages, ids, distinctPages.Count == 1 ? distinctPages[0] : null);
        });
    }

    // ------------------------------------------------------------------------------------------------ delete, arrange, group, ungroup

    private static async Task<ToolOutcome> DeleteElementsAsync(Biz biz, AiToolSession s, JsonObject args)
    {
        var ids = ArgList(args, "ids", "id", "elements").Distinct(StringComparer.Ordinal).ToList();
        if (ids.Count == 0)
        {
            throw new ToolError("ids fehlen", "Nenne die ids der Elemente (ids: [\"e1\", ...]).");
        }

        if (ids.Count > MaxIdsPerCall)
        {
            throw new ToolError("Zu viele ids", $"Lösche höchstens {MaxIdsPerCall} Elemente in einem Aufruf.");
        }

        return await WriteAsync(biz, s, doc =>
        {
            var missing = ids.Where(id => AiDocOps.Locate(doc, id) is null).ToList();
            if (missing.Count > 0)
            {
                throw new ToolError("Elemente nicht gefunden", $"Diese ids gibt es im Design nicht: {string.Join(", ", missing.Take(10))} (nichts wurde gelöscht).");
            }

            var located = ids.Select(id => AiDocOps.Locate(doc, id)!).ToList();
            foreach (var l in located)
            {
                RequireElement(s, doc, l);
                if (l.Element["children"] is JsonArray kids && AiDocOps.Walk(kids).Any(k => AiDocOps.Flag(k["locked"])))
                {
                    throw new ToolError("Element ist gesperrt", $"In der Gruppe {ElementName(l.Element)} liegt ein Element, das die Person gesperrt hat.");
                }
            }

            var pages = located.Select(l => AiDocOps.Id(l.Page)).Distinct().ToList();
            var names = located.Select(l => ElementName(l.Element)).ToList();
            foreach (var id in ids)
            {
                if (AiDocOps.Locate(doc, id) is { } now)
                {
                    now.List.RemoveAt(now.Index);   // a child of a group that went before is already gone with it
                }
            }

            var summary = ids.Count == 1
                ? $"{ElementKind(AiDocOps.Type(located[0].Element))} {names[0]} gelöscht – {PageLabel(doc, located[0].Page)}"
                : $"{ids.Count} Elemente gelöscht – {string.Join(", ", pages.Select(p => PageLabel(doc, AiDocOps.FindPage(doc, p)!)))}";
            return Task.FromResult(new PatchResult(summary, new JsonObject { ["deleted"] = new JsonArray(ids.Select(i => (JsonNode)JsonValue.Create(i)!).ToArray()) }, [], pages, [], pages.Count == 1 ? pages[0] : null));
        });
    }

    private static async Task<ToolOutcome> ArrangeAsync(Biz biz, AiToolSession s, JsonObject args)
    {
        var id = (ArgText(args, "id", "element") ?? "").Trim();
        var to = (ArgText(args, "to", "position", "mode") ?? "").Trim().ToLowerInvariant();
        if (id.Length == 0 || to.Length == 0)
        {
            throw new ToolError("id und to fehlen", "Gib id und to an: front, back, forward, backward oder index (mit index).");
        }

        var wantedIndex = ArgInt(args, "index");
        return await WriteAsync(biz, s, doc =>
        {
            var l = AiDocOps.Locate(doc, id) ?? throw new ToolError("Element nicht gefunden", $"Das Element {Clip(id, 20)} gibt es nicht.");
            RequireElement(s, doc, l);
            var last = l.List.Count - 1;
            var target = to switch
            {
                "front" or "top" => last,
                "back" or "bottom" => 0,
                "forward" => Math.Min(last, l.Index + 1),
                "backward" => Math.Max(0, l.Index - 1),
                "index" when wantedIndex is { } i => Math.Clamp(i, 0, last),
                "index" => throw new ToolError("index fehlt", "Bei to \"index\" brauchst du index (0 = ganz unten)."),
                _ => throw new ToolError("to unbekannt", "to ist front, back, forward, backward oder index."),
            };
            var node = l.List[l.Index];
            l.List.RemoveAt(l.Index);
            l.List.Insert(target, node);
            var pageId = AiDocOps.Id(l.Page);
            var label = to is "front" or "top" ? "nach vorn" : to is "back" or "bottom" ? "nach hinten" : "in der Ebene verschoben";
            return Task.FromResult(new PatchResult($"{ElementKind(AiDocOps.Type(l.Element))} {ElementName(l.Element)} {label} – {PageLabel(doc, l.Page)}", new JsonObject { ["id"] = id, ["index"] = target }, [], [pageId], [id], pageId));
        });
    }

    private static async Task<ToolOutcome> GroupAsync(Biz biz, AiToolSession s, JsonObject args)
    {
        var ids = ArgList(args, "ids", "elements").Distinct(StringComparer.Ordinal).ToList();
        if (ids.Count < 2)
        {
            throw new ToolError("Zu wenige ids", "Zum Gruppieren brauchst du mindestens zwei ids (ids: [\"e1\", \"e2\"]).");
        }

        var name = ArgText(args, "name");
        var head = await HeadAsync(biz, s.DesignId);
        return await WriteAsync(biz, s, doc =>
        {
            var located = ids.Select(id => AiDocOps.Locate(doc, id) ?? throw new ToolError("Element nicht gefunden", $"Das Element {Clip(id, 20)} gibt es nicht.")).ToList();
            foreach (var l in located)
            {
                RequireElement(s, doc, l);
            }

            var first = located[0];
            if (located.Any(l => l.List != first.List))
            {
                throw new ToolError("Nicht in derselben Ebene", "Nur Elemente derselben Ebene (gleiche Seite, gleiche Gruppe) lassen sich gruppieren.");
            }

            var depth = located.Select(l => AiDocOps.GroupDepth(l.Element)).Max() + first.Chain.Count + 1;
            if (depth > DocumentValidator.MaxGroupDepth)
            {
                throw new ToolError("Gruppen zu tief", $"Gruppen lassen sich nur bis zu {DocumentValidator.MaxGroupDepth} Ebenen tief schachteln.");
            }

            var nodes = first.List.OfType<JsonObject>().Where(n => ids.Contains(AiDocOps.Id(n))).ToList();
            var topIndex = first.List.IndexOf(nodes[^1]);
            foreach (var n in nodes)
            {
                first.List.Remove(n);
            }

            var groupId = AiDocOps.IdMaker(doc)();
            var group = new JsonObject
            {
                ["id"] = groupId,
                ["type"] = "group",
                ["name"] = Clip(name ?? "", 80),
                ["children"] = new JsonArray(nodes.Select(n => (JsonNode)n).ToArray()),
            };
            var box = AiDocOps.Union(nodes.Select(AiDocOps.Aabb));
            group["x"] = AiDocOps.Number(box.X);
            group["y"] = AiDocOps.Number(box.Y);
            group["w"] = AiDocOps.Number(box.W);
            group["h"] = AiDocOps.Number(box.H);
            first.List.Insert(Math.Min(topIndex - nodes.Count + 1, first.List.Count), group);
            var pageId = AiDocOps.Id(first.Page);
            return Task.FromResult(new PatchResult($"{nodes.Count} Elemente gruppiert – {PageLabel(doc, first.Page)}", new JsonObject { ["group"] = groupId, ["children"] = new JsonArray(nodes.Select(n => (JsonNode)JsonValue.Create(AiDocOps.Id(n))!).ToArray()) }, [], [pageId], [groupId], pageId, [groupId]));
        });
    }

    private static async Task<ToolOutcome> UngroupAsync(Biz biz, AiToolSession s, JsonObject args)
    {
        var id = (ArgText(args, "id", "group") ?? "").Trim();
        if (id.Length == 0)
        {
            throw new ToolError("id fehlt", "Nenne die id der Gruppe (id).");
        }

        return await WriteAsync(biz, s, doc =>
        {
            var l = AiDocOps.Locate(doc, id) ?? throw new ToolError("Element nicht gefunden", $"Das Element {Clip(id, 20)} gibt es nicht.");
            if (AiDocOps.Type(l.Element) != "group")
            {
                throw new ToolError("Keine Gruppe", $"{Clip(id, 20)} ist keine Gruppe.");
            }

            RequireElement(s, doc, l);
            var children = (l.Element["children"] as JsonArray ?? []).OfType<JsonObject>().ToList();
            foreach (var child in children)
            {
                AiDocOps.Bake(l.Element, child);
            }

            l.List.RemoveAt(l.Index);
            var at = l.Index;
            foreach (var child in children)
            {
                (child.Parent as JsonArray)?.Remove(child);
                l.List.Insert(at++, child);
            }

            var pageId = AiDocOps.Id(l.Page);
            return Task.FromResult(new PatchResult($"Gruppe aufgelöst ({children.Count} Elemente) – {PageLabel(doc, l.Page)}", new JsonObject { ["ids"] = new JsonArray(children.Select(n => (JsonNode)JsonValue.Create(AiDocOps.Id(n))!).ToArray()) }, [], [pageId], [.. children.Select(AiDocOps.Id)], pageId));
        });
    }

    // ------------------------------------------------------------------------------------------------ pages

    private static JsonObject ReadBackground(Build c, JsonNode? raw, string where)
    {
        if (raw is not JsonObject spec)
        {
            throw new ToolError("background ungültig", $"{where}: background muss ein Objekt sein, z. B. {{\"color\": \"#ffffff\"}} oder {{\"gradient\": {{\"angle\": 90, \"stops\": [...]}}}}.");
        }

        var result = new JsonObject();
        foreach (var (name, value) in spec)
        {
            var prop = AiDesignCatalog.Background.FirstOrDefault(p => p.Name == name);
            if (prop is null)
            {
                c.Warnings.Add($"{where}: „{Clip(name, 30)}“ gibt es beim Hintergrund nicht (ignoriert).");
                continue;
            }

            var coerced = AiDesignCatalog.Coerce(prop, value, c.Unit);
            if (coerced.Warning is not null)
            {
                c.Warnings.Add($"{where}: {coerced.Warning}");
            }

            if (!coerced.Drop)
            {
                result[name] = coerced.Value;
            }
        }

        return result;
    }

    private static void ApplyBackground(JsonObject page, JsonObject patch)
    {
        var current = page["background"] as JsonObject ?? new JsonObject();
        foreach (var (key, value) in patch)
        {
            current[key] = value?.DeepClone();
        }

        page["background"] = current;
    }

    private static async Task<ToolOutcome> SetPageAsync(Biz biz, AiToolSession s, JsonObject args)
    {
        var head = await HeadAsync(biz, s.DesignId);
        var hasElements = args["elements"] is not null;
        if (!hasElements && args["background"] is null && args["name"] is null)
        {
            throw new ToolError("Nichts zu setzen", "Gib background, elements oder name an.");
        }

        return await WriteAsync(biz, s, async doc =>
        {
            var page = PageOf(doc, s, args);
            RequirePageLevel(s, doc, page);
            var c = await NewBuildAsync(biz, s, doc, head);
            var pageId = AiDocOps.Id(page);
            var parts = new List<string>();
            if (args["background"] is { } background)
            {
                ApplyBackground(page, ReadBackground(c, background, "background"));
                parts.Add("Hintergrund");
            }

            if (args["name"] is not null)
            {
                page["name"] = Clip(ArgText(args, "name") ?? "", 80);
                parts.Add("Name");
            }

            var created = new List<string>();
            var ids = new List<string>();
            if (hasElements)
            {
                if (args["elements"] is not JsonArray list)
                {
                    throw new ToolError("elements ungültig", "elements muss eine Liste von Elementen sein.");
                }

                if (list.Count > DocumentValidator.MaxElementsPerPage)
                {
                    throw new ToolError("Zu viele Elemente", $"Eine Seite hat höchstens {DocumentValidator.MaxElementsPerPage} Elemente.");
                }

                var existing = AiDocOps.Walk(AiDocOps.Elements(page)).ToList();
                var lockedOnes = existing.Where(e => AiDocOps.Flag(e["locked"])).Select(AiDocOps.Id).ToList();
                if (lockedOnes.Count > 0)
                {
                    throw new ToolError("Gesperrte Elemente auf der Seite", $"Auf dieser Seite hat die Person Elemente gesperrt ({string.Join(", ", lockedOnes.Take(8))}): ersetze die Seite nicht als Ganzes, ändere einzelne Elemente.");
                }

                // the new elements take fresh ids (the old ones of this page are gone with it)
                var elements = new JsonArray();
                for (var i = 0; i < list.Count; i++)
                {
                    if (list[i] is not JsonObject spec)
                    {
                        throw new ToolError("Element ungültig", $"elements[{i}] muss ein Objekt sein.");
                    }

                    elements.Add(BuildElement(c, spec, 1, $"elements[{i}]"));
                }

                page["elements"] = elements;
                created.AddRange(c.Created);
                ids.AddRange(elements.OfType<JsonObject>().Select(AiDocOps.Id));
                parts.Add($"{AiDocOps.CountNodes(elements)} Elemente");
            }

            var result = new JsonObject { ["page"] = pageId };
            if (hasElements)
            {
                result["elements"] = new JsonArray(AiDocOps.Elements(page).OfType<JsonObject>().Select(e => (JsonNode)new JsonObject { ["id"] = AiDocOps.Id(e), ["type"] = AiDocOps.Type(e), ["name"] = AiDocOps.Str(e["name"]) }).ToArray());
            }

            return new PatchResult($"{PageLabel(doc, page)} gesetzt ({string.Join(", ", parts)})", result, c.Warnings, [pageId], ids, pageId, created);
        });
    }

    private static async Task<ToolOutcome> AddPageAsync(Biz biz, AiToolSession s, JsonObject args)
    {
        var head = await HeadAsync(biz, s.DesignId);
        return await WriteAsync(biz, s, async doc =>
        {
            RequireDesignLevel(s, "Eine neue Seite");
            var pages = AiDocOps.Pages(doc);
            if (pages.Count >= DocumentValidator.MaxPages)
            {
                throw new ToolError("Zu viele Seiten", $"Ein Design hat höchstens {DocumentValidator.MaxPages} Seiten.");
            }

            var c = await NewBuildAsync(biz, s, doc, head);
            var newId = AiDocOps.NewPageId(doc);
            JsonObject page;
            var created = new List<string>();
            var copyOf = ArgText(args, "copyOf", "copy");
            if (!string.IsNullOrWhiteSpace(copyOf))
            {
                var source = AiDocOps.FindPage(doc, copyOf) ?? throw new ToolError("Seite gibt es nicht", $"Die Seite {Clip(copyOf, 20)} gibt es nicht. Es gibt: {PageList(doc)}.");
                page = (JsonObject)source.DeepClone();
                page["id"] = newId;
                foreach (var e in AiDocOps.Walk(AiDocOps.Elements(page)))
                {
                    var fresh = c.NextId();
                    e["id"] = fresh;
                    created.Add(fresh);
                }
            }
            else
            {
                page = new JsonObject
                {
                    ["id"] = newId,
                    ["name"] = "",
                    ["background"] = new JsonObject { ["color"] = "#ffffff", ["gradient"] = null, ["asset"] = null, ["fit"] = "cover" },
                    ["elements"] = new JsonArray(),
                };
            }

            if (ArgText(args, "name") is { } name)
            {
                page["name"] = Clip(name, 80);
            }

            if (args["background"] is { } background)
            {
                ApplyBackground(page, ReadBackground(c, background, "background"));
            }

            var afterKey = ArgText(args, "after");
            var at = pages.Count;
            if (!string.IsNullOrWhiteSpace(afterKey))
            {
                var after = AiDocOps.FindPage(doc, afterKey) ?? throw new ToolError("Seite gibt es nicht", $"Die Seite {Clip(afterKey, 20)} gibt es nicht. Es gibt: {PageList(doc)}.");
                at = pages.IndexOf(after) + 1;
            }

            pages.Insert(at, page);
            var number = at + 1;
            return new PatchResult($"Seite {number} hinzugefügt", new JsonObject { ["page"] = newId, ["number"] = number }, c.Warnings, [newId], [.. created.Take(50)], newId, created);
        });
    }

    private static async Task<ToolOutcome> DeletePageAsync(Biz biz, AiToolSession s, JsonObject args)
        => await WriteAsync(biz, s, doc =>
        {
            RequireDesignLevel(s, "Eine Seite zu löschen");
            var page = PageOf(doc, s, args);
            var pages = AiDocOps.Pages(doc);
            if (pages.Count <= 1)
            {
                throw new ToolError("Letzte Seite", "Die einzige Seite eines Designs lässt sich nicht löschen. Ersetze ihren Inhalt mit set_page.");
            }

            if (AiDocOps.Walk(AiDocOps.Elements(page)).Any(e => AiDocOps.Flag(e["locked"])))
            {
                throw new ToolError("Gesperrte Elemente", "Auf dieser Seite hat die Person Elemente gesperrt: die Seite bleibt.");
            }

            var number = AiDocOps.PageNumber(doc, page);
            pages.Remove(page);
            var next = (JsonObject)pages[Math.Min(number - 1, pages.Count - 1)]!;
            return Task.FromResult(new PatchResult($"Seite {number} gelöscht", new JsonObject { ["deleted"] = AiDocOps.Id(page) }, [], [], [], AiDocOps.Id(next)));
        });

    private static async Task<ToolOutcome> MovePageAsync(Biz biz, AiToolSession s, JsonObject args)
    {
        var to = ArgInt(args, "to", "position", "index") ?? throw new ToolError("to fehlt", "Gib to an: die neue Nummer der Seite (ab 1).");
        return await WriteAsync(biz, s, doc =>
        {
            RequireDesignLevel(s, "Eine Seite zu verschieben");
            var page = PageOf(doc, s, args);
            var pages = AiDocOps.Pages(doc);
            var target = Math.Clamp(to, 1, pages.Count);
            pages.Remove(page);
            pages.Insert(target - 1, page);
            return Task.FromResult(new PatchResult($"Seite an Position {target} verschoben", new JsonObject { ["page"] = AiDocOps.Id(page), ["number"] = target }, [], [], [], AiDocOps.Id(page)));
        });
    }

    private static async Task<ToolOutcome> RenamePageAsync(Biz biz, AiToolSession s, JsonObject args)
    {
        var name = ArgText(args, "name", "title") ?? throw new ToolError("name fehlt", "Gib name an.");
        return await WriteAsync(biz, s, doc =>
        {
            var page = PageOf(doc, s, args);
            RequirePageLevel(s, doc, page);
            page["name"] = Clip(name.Trim(), 80);
            return Task.FromResult(new PatchResult($"{PageLabel(doc, page)} heißt jetzt „{Clip(name.Trim(), 40)}“", new JsonObject { ["page"] = AiDocOps.Id(page) }, [], [], [], AiDocOps.Id(page)));
        });
    }

    // ------------------------------------------------------------------------------------------------ format, fields, template

    private static async Task<ToolOutcome> ResizeDesignAsync(Biz biz, AiToolSession s, JsonObject args)
    {
        var preset = FormatPresets.Find(ArgText(args, "preset", "format"));
        var scale = ArgBool(args, "scale") ?? true;
        double width, height;
        string unit;
        if (preset is not null)
        {
            (width, height, unit) = (preset.Width, preset.Height, preset.Unit);
        }
        else
        {
            if (!AiDesignCatalog.TryNumber(args["width"] ?? args["w"], out width) || !AiDesignCatalog.TryNumber(args["height"] ?? args["h"], out height))
            {
                var wanted = ArgText(args, "preset", "format");
                throw new ToolError("Format fehlt", wanted is { Length: > 0 } ? $"Das Format \"{Clip(wanted, 30)}\" kennt MatCan nicht (list_formats zeigt die Formate). Oder gib width und height an." : "Gib preset (aus list_formats) oder width und height an.");
            }

            unit = ArgText(args, "unit") == "px" ? "px" : "mm";
        }

        var (min, max) = DesignLogic.SizeLimits(unit);
        if (width < min || width > max || height < min || height > max)
        {
            throw new ToolError("Maße außerhalb der Grenzen", $"Breite und Höhe liegen zwischen {min} und {max} {unit}.");
        }

        return await WriteAsync(biz, s, doc =>
        {
            RequireDesignLevel(s, "Das Format zu ändern");
            var typed = DocumentValidator.Parse(doc.ToJsonString()) ?? throw new BizException("Das Design ist beschädigt.");
            var resized = DocumentValidator.Normalize(DocumentResize.Resize(typed, width, height, unit, scale));
            var replaced = AiDocOps.Parse(DocumentValidator.ToJson(resized));
            foreach (var key in replaced.Select(p => p.Key).ToList())
            {
                doc[key] = replaced[key]?.DeepClone();
            }

            var label = preset is not null ? preset.Name : $"{AiDocOps.Round(width, 1)} × {AiDocOps.Round(height, 1)} {unit}";
            return Task.FromResult(new PatchResult($"Format geändert: {label}", new JsonObject { ["width"] = width, ["height"] = height, ["unit"] = unit, ["scaled"] = scale }, [], [.. AiDocOps.Pages(doc).OfType<JsonObject>().Select(AiDocOps.Id)], [], null));
        });
    }

    private static async Task<ToolOutcome> SetFieldsAsync(Biz biz, AiToolSession s, JsonObject args)
    {
        var specs = args["fields"] as JsonArray ?? (args["field"] is JsonObject one ? new JsonArray(one.DeepClone()) : new JsonArray());
        var remove = ArgList(args, "remove", "delete");
        if (specs.Count == 0 && remove.Count == 0)
        {
            throw new ToolError("fields fehlen", "Gib fields an (key, label, type, sample) oder remove.");
        }

        return await WriteAsync(biz, s, doc =>
        {
            var fields = doc["fields"] as JsonArray ?? (JsonArray)(doc["fields"] = new JsonArray());
            var warnings = new List<string>();
            var added = new List<string>();
            var changed = new List<string>();
            if (s.Scope.Locked && remove.Count > 0)
            {
                throw Outside(s, "Felder zu entfernen");
            }

            foreach (var raw in specs)
            {
                if (raw is not JsonObject spec)
                {
                    throw new ToolError("Feld ungültig", "Jedes Feld in fields muss ein Objekt sein.");
                }

                var key = AiDocOps.Str(spec["key"]).Trim();
                if (!AiDesignCatalog.IsKey(key))
                {
                    throw new ToolError("Feldschlüssel ungültig", $"„{Clip(key, 40)}“ ist kein Feldschlüssel: ein Buchstabe, dann Buchstaben, Ziffern und _ (höchstens 40 Zeichen).");
                }

                var existing = fields.OfType<JsonObject>().FirstOrDefault(f => string.Equals(AiDocOps.Str(f["key"]), key, StringComparison.OrdinalIgnoreCase));
                var target = existing ?? new JsonObject { ["key"] = key, ["label"] = key, ["type"] = "text", ["sample"] = "", ["decimals"] = null, ["category"] = null, ["required"] = false };
                foreach (var (name, value) in spec)
                {
                    if (name == "key")
                    {
                        continue;
                    }

                    var prop = AiDesignCatalog.FieldProps.FirstOrDefault(p => p.Name == name);
                    if (prop is null)
                    {
                        warnings.Add($"Feld {key}: „{Clip(name, 30)}“ gibt es bei Feldern nicht (ignoriert).");
                        continue;
                    }

                    var coerced = AiDesignCatalog.Coerce(prop, value);
                    if (coerced.Warning is not null)
                    {
                        warnings.Add($"Feld {key}: {coerced.Warning}");
                    }

                    if (!coerced.Drop)
                    {
                        target[name] = coerced.Value;
                    }
                }

                if (existing is null)
                {
                    if (fields.Count >= DocumentValidator.MaxFields)
                    {
                        throw new ToolError("Zu viele Felder", $"Ein Design hat höchstens {DocumentValidator.MaxFields} Felder.");
                    }

                    fields.Add(target);
                    added.Add(key);
                }
                else
                {
                    changed.Add(key);
                }
            }

            if (remove.Count > 0)
            {
                var typed = DocumentValidator.Parse(doc.ToJsonString()) ?? throw new BizException("Das Design ist beschädigt.");
                var usage = Placeholders.FieldsUsed(typed);
                foreach (var key in remove)
                {
                    var index = fields.Select((n, i) => (n, i)).FirstOrDefault(x => x.n is JsonObject f && string.Equals(AiDocOps.Str(f["key"]), key, StringComparison.OrdinalIgnoreCase));
                    if (index.n is null)
                    {
                        warnings.Add($"Das Feld {Clip(key, 40)} gibt es nicht.");
                        continue;
                    }

                    if (usage.FirstOrDefault(u => string.Equals(u.Key, key, StringComparison.OrdinalIgnoreCase)) is { Uses.Count: > 0 } used)
                    {
                        throw new ToolError("Feld wird verwendet", $"Das Feld {key} wird noch verwendet ({string.Join(", ", used.Uses.Take(6).Select(u => u.ElementId))}). Entferne zuerst den Platzhalter oder das Element.");
                    }

                    fields.RemoveAt(index.i);
                }
            }

            var parts = new List<string>();
            if (added.Count > 0)
            {
                parts.Add($"{added.Count} angelegt");
            }

            if (changed.Count > 0)
            {
                parts.Add($"{changed.Count} geändert");
            }

            if (remove.Count > 0)
            {
                parts.Add($"{remove.Count} entfernt");
            }

            return Task.FromResult(new PatchResult($"Felder: {string.Join(", ", parts)}", new JsonObject { ["added"] = new JsonArray(added.Select(a => (JsonNode)JsonValue.Create(a)!).ToArray()), ["changed"] = new JsonArray(changed.Select(a => (JsonNode)JsonValue.Create(a)!).ToArray()) }, warnings, [], [], null));
        });
    }

    private static async Task<ToolOutcome> ApplyTemplateAsync(Biz biz, AiToolSession s, JsonObject args)
    {
        var templateId = ArgInt(args, "templateId", "template", "id") ?? throw new ToolError("templateId fehlt", "Gib templateId an (aus search_templates oder list_templates).");
        var template = await DesignLogic.Templates(biz).AsNoTracking().Where(d => d.Id == templateId).Select(d => new { d.Name, d.DocumentJson }).FirstOrDefaultAsync()
            ?? throw new ToolError("Vorlage gibt es nicht", $"Die Vorlage {templateId} gibt es nicht oder sie ist für dich nicht nutzbar. Suche mit search_templates.");
        var source = DocumentValidator.Parse(template.DocumentJson) ?? throw new ToolError("Vorlage beschädigt", "Die Vorlage lässt sich nicht lesen.");
        if (ArgBool(args, "whole") == true)
        {
            return await ApplyWholeTemplateAsync(biz, s, template.Name, source);
        }

        var number = ArgInt(args, "templatePage", "templateSeite") ?? 1;
        if (number < 1 || number > source.Pages.Count)
        {
            throw new ToolError("Seite der Vorlage gibt es nicht", $"Die Vorlage „{template.Name}“ hat {source.Pages.Count} Seite(n); templatePage ist 1 bis {source.Pages.Count}.");
        }

        return await WriteAsync(biz, s, doc =>
        {
            var replaceKey = ArgText(args, "page", "pageId");
            var pages = AiDocOps.Pages(doc);
            JsonObject? replace = null;
            if (!string.IsNullOrWhiteSpace(replaceKey))
            {
                replace = AiDocOps.FindPage(doc, replaceKey) ?? throw new ToolError("Seite gibt es nicht", $"Die Seite {Clip(replaceKey, 20)} gibt es nicht. Es gibt: {PageList(doc)}.");
                RequirePageLevel(s, doc, replace);
                if (AiDocOps.Walk(AiDocOps.Elements(replace)).Any(e => AiDocOps.Flag(e["locked"])))
                {
                    throw new ToolError("Gesperrte Elemente auf der Seite", "Auf dieser Seite hat die Person Elemente gesperrt: die Seite bleibt.");
                }
            }
            else
            {
                RequireDesignLevel(s, "Eine neue Seite");
                if (pages.Count >= DocumentValidator.MaxPages)
                {
                    throw new ToolError("Zu viele Seiten", $"Ein Design hat höchstens {DocumentValidator.MaxPages} Seiten.");
                }
            }

            var designUnit = AiDocOps.Unit(doc);
            var resized = DocumentResize.Resize(source with { Pages = [source.Pages[number - 1]] }, AiDocOps.Num(doc["width"]), AiDocOps.Num(doc["height"]), designUnit, true);
            var templateDoc = AiDocOps.Parse(DocumentValidator.ToJson(DocumentValidator.Normalize(resized)));
            var copy = (JsonObject)AiDocOps.Pages(templateDoc)[0]!.DeepClone();
            var nextId = AiDocOps.IdMaker(doc);
            var created = new List<string>();
            foreach (var e in AiDocOps.Walk(AiDocOps.Elements(copy)))
            {
                var fresh = nextId();
                e["id"] = fresh;
                e["locked"] = false;
                created.Add(fresh);
            }

            // the fields the page uses come along
            var warnings = new List<string>();
            var fields = doc["fields"] as JsonArray ?? (JsonArray)(doc["fields"] = new JsonArray());
            var singlePage = DocumentValidator.Parse(templateDoc.ToJsonString())!;
            var addedFields = new List<string>();
            foreach (var usage in Placeholders.FieldsUsed(singlePage))
            {
                var existing = fields.OfType<JsonObject>().FirstOrDefault(f => string.Equals(AiDocOps.Str(f["key"]), usage.Key, StringComparison.OrdinalIgnoreCase));
                if (existing is not null)
                {
                    if (usage.Field is { } wanted && !string.Equals(AiDocOps.Str(existing["type"]), wanted.Type, StringComparison.Ordinal))
                    {
                        warnings.Add($"Das Feld {usage.Key} gibt es schon als {AiDocOps.Str(existing["type"])}; die Vorlage meint {wanted.Type}.");
                    }

                    continue;
                }

                if (usage.Field is { } field && fields.Count < DocumentValidator.MaxFields)
                {
                    fields.Add(JsonNode.Parse(System.Text.Json.JsonSerializer.Serialize(new { key = field.Key, label = field.Label, type = field.Type, sample = field.Sample, decimals = field.Decimals, category = field.Category, required = field.Required })));
                    addedFields.Add(field.Key);
                }
            }

            string pageId;
            if (replace is not null)
            {
                copy["id"] = AiDocOps.Id(replace);
                pages[pages.IndexOf(replace)] = copy;
                pageId = AiDocOps.Id(replace);
            }
            else
            {
                pageId = AiDocOps.NewPageId(doc);
                copy["id"] = pageId;
                pages.Add(copy);
            }

            RememberTemplateTexts(s, copy);
            var label = $"Seite aus Vorlage „{Clip(template.Name, 40)}“ {(replace is null ? "hinzugefügt" : "eingesetzt")}";
            var result = new JsonObject { ["page"] = pageId, ["fieldsAdded"] = new JsonArray(addedFields.Select(a => (JsonNode)JsonValue.Create(a)!).ToArray()), ["elements"] = AiDocOps.CountNodes(AiDocOps.Elements(copy)), ["aufbau"] = TemplateListing(copy), ["weiter"] = TemplateNext };
            return Task.FromResult(new PatchResult(label, result, warnings, [pageId], [.. created.Take(60)], pageId, created));
        });
    }

    private const string TemplateNext = "Das ist der Aufbau mit den ids. Ersetze jetzt jeden Beispieltext durch den Inhalt der Person (update_elements; Länge und Schrift passen), lösche, was nicht gebraucht wird (delete_elements), ergänze fehlende Angaben (add_elements) und tausche Motive gegen passende (search_deko). Das Layout und die Dekoration der Vorlage bleiben.";

    /// <summary>
    /// The design becomes the template: its size, unit, fold, ALL pages and its fields replace what the design had (the right start for a new design: the template's format is the format of the design).
    /// Refused when the person locked something. The elements get new ids and are unlocked; the sample texts are remembered so the final check can say which ones were never replaced.
    /// </summary>
    private static async Task<ToolOutcome> ApplyWholeTemplateAsync(Biz biz, AiToolSession s, string templateName, DesignDocument source)
    {
        return await WriteAsync(biz, s, doc =>
        {
            RequireDesignLevel(s, "Das ganze Design durch eine Vorlage zu ersetzen");
            if (AiDocOps.AllElements(doc).Any(e => AiDocOps.Flag(e["locked"])))
            {
                throw new ToolError("Gesperrte Elemente im Design", "Die Person hat Elemente gesperrt (locked): das Design wird nicht ersetzt. Übernimm stattdessen eine Seite der Vorlage (ohne whole).");
            }

            var had = AiDocOps.AllElements(doc).Count();
            var templateDoc = AiDocOps.Parse(DocumentValidator.ToJson(DocumentValidator.Normalize(source)));
            doc["width"] = templateDoc["width"]!.DeepClone();
            doc["height"] = templateDoc["height"]!.DeepClone();
            doc["unit"] = templateDoc["unit"]!.DeepClone();
            if (templateDoc["dpi"] is { } dpi)
            {
                doc["dpi"] = dpi.DeepClone();
            }

            if (templateDoc["fold"] is { } fold)
            {
                doc["fold"] = fold.DeepClone();
            }
            else
            {
                doc.Remove("fold");
            }

            doc["fields"] = templateDoc["fields"]?.DeepClone() ?? new JsonArray();
            var pages = new JsonArray();
            var created = new List<string>();
            var n = 0;
            foreach (var page in AiDocOps.Pages(templateDoc).OfType<JsonObject>())
            {
                var copy = (JsonObject)page.DeepClone();
                n++;
                copy["id"] = "p" + n;
                pages.Add(copy);
            }

            // new ids that are unique over all pages
            var nextId = AiDocOps.IdMaker(new JsonObject { ["pages"] = pages.DeepClone() });
            foreach (var page in pages.OfType<JsonObject>())
            {
                foreach (var e in AiDocOps.Walk(AiDocOps.Elements(page)))
                {
                    var fresh = nextId();
                    e["id"] = fresh;
                    e["locked"] = false;
                    created.Add(fresh);
                }

                RememberTemplateTexts(s, page);
            }

            doc["pages"] = pages;
            var warnings = new List<string>();
            if (had > 0)
            {
                warnings.Add($"Das bisherige Design ({had} Elemente) wurde durch die Vorlage ersetzt; „Rückgängig“ bringt es zurück.");
            }

            var listing = new JsonArray();
            var number = 0;
            foreach (var page in pages.OfType<JsonObject>())
            {
                number++;
                var entry = TemplateListing(page);
                entry["id"] = AiDocOps.Id(page);
                entry["number"] = number;
                entry["name"] = AiDocOps.Str(page["name"]);
                listing.Add(entry);
            }

            var result = new JsonObject
            {
                ["format"] = new JsonObject { ["width"] = AiDocOps.Num(doc["width"]), ["height"] = AiDocOps.Num(doc["height"]), ["unit"] = AiDocOps.Unit(doc), ["fold"] = AiDocOps.Str(doc["fold"]) is { Length: > 0 } f ? f : "none" },
                ["fields"] = new JsonArray(AiDocOps.Fields(doc).OfType<JsonObject>().Select(f => (JsonNode)new JsonObject { ["key"] = AiDocOps.Str(f["key"]), ["label"] = AiDocOps.Str(f["label"]), ["sample"] = AiDocOps.Str(f["sample"]) }).ToArray()),
                ["pages"] = listing,
                ["weiter"] = TemplateNext,
            };
            var firstPage = AiDocOps.Id((JsonObject)pages[0]!);
            return Task.FromResult(new PatchResult($"Vorlage „{Clip(templateName, 40)}“ übernommen ({pages.Count} Seite{(pages.Count == 1 ? "" : "n")})", result, warnings, [.. pages.OfType<JsonObject>().Select(AiDocOps.Id)], [.. created.Take(60)], firstPage, created));
        });
    }

    private static readonly string[] SlotWords = ["name", "namen", "datum", "uhrzeit", "zeit", "ort", "adresse", "strasse", "telefon", "tel", "preis", "kontakt", "mail", "email", "alter", "veranstalter", "absender", "web", "betrag", "termin", "treffpunkt", "eintritt", "ansprechpartner"];

    /// <summary>
    /// The sample texts of a page that came from a template and are the personal part of it (element id to text): a text with a digit or an address, or in an element named like a slot for personal data
    /// (Name, Datum, Ort, Adresse, Uhrzeit ...). The final check says which of them are still unchanged when the model is done. A general label like "Einladung" is not remembered: it may stay.
    /// </summary>
    private static void RememberTemplateTexts(AiToolSession s, JsonObject page)
    {
        foreach (var e in AiDocOps.Walk(AiDocOps.Elements(page)).Where(e => AiDocOps.Type(e) == "text"))
        {
            var text = AiDocOps.Str(e["text"]).Trim();
            if (text.Length == 0 || text.Contains("{{", StringComparison.Ordinal))
            {
                continue;
            }

            // a number alone ("80") may be the very number of the person; a label in capitals ("WANN") is no data
            if (text.All(c => char.IsDigit(c) || char.IsWhiteSpace(c) || c is '.' or ',' or '%' or '€') || (text.Length <= 24 && text == text.ToUpperInvariant() && !text.Any(char.IsDigit)))
            {
                continue;
            }

            var nameWords = AiSearchText.Words(AiDocOps.Str(e["name"]));
            if (text.Any(char.IsDigit) || text.Contains('@') || nameWords.Any(w => SlotWords.Contains(w)))
            {
                s.TemplateTexts[AiDocOps.Id(e)] = text;
            }
        }
    }

    /// <summary>What a page of a template consists of, for the model: every element with its id, in drawing order, as short as it can be (texts with font and size, pictures with their key, the rest by type and colour).</summary>
    private static JsonObject TemplateListing(JsonObject page)
    {
        var items = new JsonArray();
        foreach (var e in AiDocOps.Walk(AiDocOps.Elements(page)))
        {
            var type = AiDocOps.Type(e);
            if (type == "group")
            {
                continue;
            }

            var line = new JsonObject { ["id"] = AiDocOps.Id(e), ["type"] = type };
            if (AiDocOps.Str(e["name"]) is { Length: > 0 } name)
            {
                line["name"] = name;
            }

            line["box"] = $"{R1(AiDocOps.Num(e["x"]))},{R1(AiDocOps.Num(e["y"]))},{R1(AiDocOps.Num(e["w"]))},{R1(AiDocOps.Num(e["h"]))}";
            switch (type)
            {
                case "text":
                    line["text"] = Clip(AiDocOps.Str(e["text"]), 120);
                    line["font"] = $"{AiDocOps.Str(e["fontFamily"])} {AiDocOps.Num(e["fontSize"]).ToString("0.#", CultureInfo.InvariantCulture)} pt{(AiDocOps.Num(e["fontWeight"]) >= 600 ? " fett" : "")}";
                    line["color"] = AiDocOps.Str(e["color"]);
                    break;
                case "image":
                    line["source"] = e["source"] is JsonObject src ? (AiDocOps.Str(src["asset"]) is { Length: > 0 } asset ? asset : "{{" + AiDocOps.Str(src["field"]) + "}}") : "(leerer Rahmen)";
                    break;
                case "icon":
                    line["icon"] = AiDocOps.Str(e["icon"]);
                    line["color"] = AiDocOps.Str(e["color"]);
                    break;
                case "shape":
                    line["shape"] = AiDocOps.Str(e["shape"]);
                    line["fill"] = e["fill"] is JsonObject fill ? (fill["gradient"] is not null ? "Verlauf" : AiDocOps.Str(fill["color"])) : null;
                    if (AiDocOps.Str(e["stroke"]) is { Length: > 0 } stroke)
                    {
                        line["stroke"] = stroke;
                    }

                    break;
            }

            items.Add(line);
        }

        return new JsonObject { ["background"] = page["background"]?.DeepClone(), ["elements"] = items };
    }

    // ------------------------------------------------------------------------------------------------ create_svg, rename_design

    private static async Task<ToolOutcome> CreateSvgAsync(Biz biz, AiToolSession s, JsonObject args)
    {
        var name = (ArgText(args, "name", "title") ?? "grafik").Trim();
        var svg = ArgText(args, "svg", "code") ?? throw new ToolError("svg fehlt", "Gib svg an: den vollständigen Code, <svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 200 60\">…</svg>.");
        if (svg.Length > MaxSvgChars)
        {
            throw new ToolError("SVG zu groß", $"Das SVG ist größer als {MaxSvgChars / 1000} KB: zeichne einfacher.");
        }

        var bytes = Encoding.UTF8.GetBytes(svg);
        var clean = SvgSafe.Sanitize(bytes);
        if (!clean.Ok)
        {
            throw new ToolError("SVG nicht sicher", clean.Error ?? "Das SVG ist nicht in Ordnung.");
        }

        RequireDesignLevel(s, "Eine neue Grafik");
        var (space, folder) = await AiAttachmentLogic.PlacementAsync(biz, s.DesignId);

        var result = await AssetLogic.UploadAsync(biz, name + ".svg", bytes, "KI-Grafik", space, folder);
        if (result.Asset is not { } asset)
        {
            throw new ToolError("Grafik nicht gespeichert", result.Error ?? "Die Grafik ließ sich nicht speichern.");
        }

        s.AttachmentAssets.Add(asset.Id);
        var warnings = result.Cleaned.Count > 0 ? new List<string> { "Entfernt wurde: " + string.Join(", ", result.Cleaned.Take(5)) + "." } : [];
        if (asset.Width is null)
        {
            warnings.Add("Das SVG hat keine Größe (viewBox oder width/height): setze die Größe des Elements selbst.");
        }

        var info = new JsonObject { ["key"] = asset.Key, ["name"] = asset.Name, ["width"] = asset.Width, ["height"] = asset.Height, ["use"] = $"{{\"type\": \"image\", ..., \"source\": {{\"asset\": \"{asset.Key}\"}}}}" };
        return Ok($"Grafik „{Clip(asset.Name, 40)}“ gezeichnet ({asset.Key})", info, warnings);
    }

    private static async Task<ToolOutcome> RenameDesignAsync(Biz biz, AiToolSession s, JsonObject args)
    {
        var name = (ArgText(args, "name", "title") ?? "").Trim();
        if (name.Length == 0)
        {
            throw new ToolError("name fehlt", "Gib name an.");
        }

        RequireDesignLevel(s, "Das Design umzubenennen");
        var clean = await DesignLogic.RenameAsync(biz, s.DesignId, name);
        return new ToolOutcome(true, $"Design heißt jetzt „{Clip(clean, 40)}“", new JsonObject { ["name"] = clean }, [], null, null, true);
    }

    // ------------------------------------------------------------------------------------------------ look

    private static async Task<ToolOutcome> LookAsync(Biz biz, AiToolSession s, JsonObject args, CancellationToken ct)
    {
        var head = await HeadAsync(biz, s.DesignId);
        var doc = AiDocOps.Parse(head.DocumentJson);
        var page = PageOf(doc, s, args);
        var pageId = AiDocOps.Id(page);
        var label = PageLabel(doc, page);
        if (s.Looks >= s.MaxLooks)
        {
            return new ToolOutcome(false, "Kein weiterer Blick erlaubt", new JsonObject { ["error"] = $"Du hast dir in diesem Auftrag schon {s.Looks} Mal etwas angesehen: mehr sind nicht erlaubt. Arbeite mit dem weiter, was du weißt." }, [], pageId);
        }

        var broker = biz.Service<AiRenderBroker>();
        if (!broker.EditorConnected(s.ConversationId, TimeSpan.FromSeconds(12)))
        {
            return new ToolOutcome(true, "Kein Bild verfügbar", new JsonObject { ["available"] = false, ["reason"] = "Kein Bild verfügbar: der Editor ist nicht geöffnet. Arbeite ohne Bild weiter." }, [], pageId);
        }

        s.Looks++;
        var request = new AiRenderBroker.Request(s.RunId, s.ConversationId, s.UserId, pageId, AiDocOps.PageNumber(doc, page), head.Revision, AiRenderBroker.NewToken());
        var bytes = await broker.RequestAsync(request, s.LookTimeout, ct);
        if (bytes is null || bytes.Length == 0)
        {
            return new ToolOutcome(true, "Kein Bild verfügbar", new JsonObject { ["available"] = false, ["reason"] = "Kein Bild verfügbar: der Editor hat keins geliefert. Arbeite ohne Bild weiter." }, [], pageId);
        }

        var sniffed = FileSniffer.Sniff(bytes);
        if (sniffed.Kind is not (FileKind.Jpeg or FileKind.Png))
        {
            return new ToolOutcome(true, "Kein Bild verfügbar", new JsonObject { ["available"] = false, ["reason"] = "Kein Bild verfügbar: das gelieferte Bild war unbrauchbar." }, [], pageId);
        }

        string? file = null;
        if (s.PictureFolder is { } folder)
        {
            Directory.CreateDirectory(folder);
            file = $"look-{s.RunNumber}-{s.Looks}-{Guid.NewGuid():N}.{sniffed.Extension}";
            await File.WriteAllBytesAsync(Path.Combine(folder, file), bytes, ct);
        }

        s.PicturesForNextCall.Add(new Core.Ai.AiAttachment { Kind = "image", MediaType = sniffed.ContentType, Name = s.PictureName is { } named ? $"{named}: {label}" : $"{label} (Revision {head.Revision})", Data = Convert.ToBase64String(bytes) });
        s.PictureName = null;
        return new ToolOutcome(true, $"{label} angesehen", new JsonObject { ["available"] = true, ["note"] = $"Das Bild von {label} bekommst du mit der nächsten Nachricht." }, [], pageId, null, false, head.Revision, file);
    }
}
