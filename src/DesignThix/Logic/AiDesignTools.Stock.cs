using System.Text.Json.Nodes;
using DesignThix.Catalogs;

namespace DesignThix.Logic;

/// <summary>
/// The tools of the assistant that reach the catalogues (docs/PLAN-CATALOGS.md section 7, C3): <c>search_catalog</c> finds stock photos, icons and fonts, <c>import_from_catalog</c> takes ONE chosen item into
/// the library of the design's area. The model never sees a picture before it is placed (it looks at the page with <c>look</c> afterwards), it asks nothing but the words of a search and the id of one
/// item (the catalogue builds every address), and it works through the same business layer as a person: the catalogues the administrator switched on, the quotas of the person and of the key, the
/// licence rules, the storage of the area. A catalogue that is off does not exist for it. A run may search a dozen times and import a handful of single items: no bulk collecting (Pexels forbids using
/// its API to collect photos at scale for AI).
/// </summary>
public static partial class AiDesignTools
{
    /// <summary>How many catalogue searches and imports one run may make.</summary>
    public const int MaxCatalogSearches = 12;

    public const int MaxCatalogImports = 8;

    /// <summary>
    /// The catalogues the tools never reach: the two local ones (the library is <c>list_media</c>) and Unsplash, whose API guidelines ask for photos a person chooses ("non-automated" use);
    /// a person still takes Unsplash photos through the media browser and the panel Fotos, and the model may use them once they are in the library.
    /// </summary>
    private static readonly string[] NotForTools = ["builtin", "uploads", "unsplash"];

    private static async Task<ToolOutcome> SearchCatalogAsync(Biz biz, AiToolSession s, JsonObject args, CancellationToken ct)
    {
        var usable = (await CatalogLogic.ListAsync(biz)).Where(r => !NotForTools.Contains(r.Id)).ToList();
        if (usable.Count == 0)
        {
            throw new ToolError("Kein Katalog eingeschaltet", "Es ist kein Katalog für Fotos, Symbole oder Schriften eingeschaltet. Nimm Bilder aus list_media, Symbole aus search_icons oder zeichne mit create_svg.");
        }

        var id = (ArgText(args, "catalog", "katalog") ?? "").Trim().ToLowerInvariant();
        if (id.Length == 0)
        {
            // which catalogues there are, so the model can choose one
            var list = new JsonArray();
            foreach (var row in usable)
            {
                var collections = row.Catalog.Caps.HasFlag(CatalogCaps.Collections) ? await CatalogLogic.CollectionsAsync(biz, row.Id, ct) : [];
                list.Add(new JsonObject
                {
                    ["catalog"] = row.Id,
                    ["name"] = row.Catalog.Name,
                    ["kinds"] = new JsonArray([.. Enum.GetValues<CatalogKinds>().Where(k => k != CatalogKinds.None && row.Catalog.Kinds.HasFlag(k)).Select(k => (JsonNode)JsonValue.Create(k.ToString().ToLowerInvariant())!)]),
                    ["browse"] = row.Catalog.Caps.HasFlag(CatalogCaps.Browse),
                    ["collections"] = new JsonArray([.. collections.Take(30).Select(c => (JsonNode)new JsonObject { ["id"] = c.Id, ["name"] = c.Name })]),
                });
            }

            return Ok($"{list.Count} Kataloge", new JsonObject { ["catalogs"] = list, ["hint"] = "Suche mit search_catalog {\"catalog\": \"…\", \"q\": \"…\"}; Fotos: orientation landscape|portrait|square." });
        }

        var chosen = usable.FirstOrDefault(r => r.Id == id) ?? throw new ToolError($"Katalog „{Clip(id, 20)}“ gibt es nicht", $"Den Katalog \"{Clip(id, 20)}\" gibt es nicht oder er ist aus. Es gibt: {string.Join(", ", usable.Select(r => r.Id))}.");
        if (s.CatalogSearches >= MaxCatalogSearches)
        {
            throw new ToolError("Genug gesucht", $"In einem Auftrag sind höchstens {MaxCatalogSearches} Katalogsuchen möglich. Nimm, was du gefunden hast.");
        }

        var text = (ArgText(args, "q", "query", "search", "suche") ?? "").Trim();
        var collection = (ArgText(args, "collection", "sammlung") ?? "").Trim();
        if (text.Length == 0 && collection.Length == 0 && !chosen.Catalog.Caps.HasFlag(CatalogCaps.Browse))
        {
            throw new ToolError("q fehlt", $"{chosen.Catalog.Name} wird nur durchsucht: gib q an (Suchwörter, am besten englisch).");
        }

        var limit = Math.Clamp(ArgInt(args, "limit") ?? 10, 1, 12);
        s.CatalogSearches++;
        CatalogPage page;
        try
        {
            page = await CatalogLogic.SearchAsync(biz, id, new CatalogQuery
            {
                Text = text,
                Collection = collection,
                Orientation = (ArgText(args, "orientation", "format") ?? "any").Trim().ToLowerInvariant(),
                Colour = (ArgText(args, "colour", "color", "farbe") ?? "").Trim().ToLowerInvariant(),
                Page = Math.Clamp(ArgInt(args, "page") ?? 1, 1, 5),
                PerPage = Math.Max(limit, 1),
            }, ct);
        }
        catch (CatalogException e)
        {
            throw new ToolError(Clip(e.Message, 100), e.Message);
        }

        var items = new JsonArray();
        foreach (var item in page.Items.Take(limit))
        {
            var o = new JsonObject { ["itemId"] = item.Id, ["title"] = Clip(item.Title, 80), ["kind"] = item.Kind.ToString().ToLowerInvariant() };
            if (item.Width is { } w && item.Height is { } h)
            {
                o["width"] = w;
                o["height"] = h;
            }

            if (!string.IsNullOrEmpty(item.Author))
            {
                o["author"] = Clip(item.Author, 60);
            }

            if (item.Licence is { } licence)
            {
                o["licence"] = licence.Name;
            }

            if (item.IconName is { } icon)
            {
                o["icon"] = icon;
            }

            if (item.FontFamily is { } family)
            {
                o["family"] = family;
            }

            if (item.AssetKey is { } key)
            {
                o["key"] = key;
            }

            items.Add(o);
        }

        var result = new JsonObject { ["catalog"] = id, ["items"] = items, ["hasMore"] = page.HasMore };
        if (page.Message is { Length: > 0 } message)
        {
            result["message"] = message;
        }

        var warnings = items.Count == 0 ? new List<string> { "Nichts gefunden: andere Wörter versuchen (Fotos am besten englisch, ein Wort bis drei)." } : [];
        result["next"] = "Übernimm EINEN gewählten Treffer mit import_from_catalog {\"catalog\": \"" + id + "\", \"itemId\": \"…\"}; danach steht er in der Bibliothek.";
        return Ok($"{items.Count} Treffer in {chosen.Catalog.Name}", result, warnings);
    }

    private static async Task<ToolOutcome> ImportFromCatalogAsync(Biz biz, AiToolSession s, JsonObject args, CancellationToken ct)
    {
        var id = (ArgText(args, "catalog", "katalog") ?? "").Trim().ToLowerInvariant();
        if (id.Length == 0)
        {
            throw new ToolError("catalog fehlt", "Nenne den Katalog (catalog) und den Treffer (itemId) aus search_catalog.");
        }

        if (args["itemId"] is JsonArray || args["items"] is JsonArray)
        {
            throw new ToolError("Nur ein Eintrag", "Übernimm jeweils EINEN Treffer (itemId als Text). Mehrere nacheinander, wenn du wirklich mehrere brauchst.");
        }

        var item = (ArgText(args, "itemId", "item", "id") ?? "").Trim();
        if (item.Length == 0)
        {
            throw new ToolError("itemId fehlt", "Nenne den Treffer (itemId) aus search_catalog.");
        }

        if (s.CatalogImports >= MaxCatalogImports)
        {
            throw new ToolError("Genug übernommen", $"In einem Auftrag sind höchstens {MaxCatalogImports} Katalog-Übernahmen möglich. Benutze, was schon in der Bibliothek ist.");
        }

        // the catalogue must be one the person may use (a catalogue that is off, a local one or Unsplash does not exist here)
        var usable = (await CatalogLogic.ListAsync(biz)).Where(r => !NotForTools.Contains(r.Id)).FirstOrDefault(r => r.Id == id)
            ?? throw new ToolError($"Katalog „{Clip(id, 20)}“ gibt es nicht", $"Den Katalog \"{Clip(id, 20)}\" gibt es nicht oder er ist aus. Frage ihn mit search_catalog ohne Angaben ab.");
        RequireDesignLevel(s, "Ein Katalogeintrag");
        var (space, folder) = await AiAttachmentLogic.PlacementAsync(biz, s.DesignId);
        CatalogLogic.CatalogImported imported;
        try
        {
            imported = await CatalogLogic.ImportItemAsync(biz, usable.Id, item, space, folder, s.DesignId, null, ct);
        }
        catch (CatalogException e)
        {
            throw new ToolError(Clip(e.Message, 100), e.Message);
        }

        s.CatalogImports++;
        if (imported.Icon is { } icon)
        {
            return Ok($"Symbol „{icon.Name}“ übernommen", new JsonObject
            {
                ["icon"] = icon.Name,
                ["reused"] = icon.Reused,
                ["use"] = $"{{\"type\": \"icon\", \"icon\": \"{icon.Name}\", \"x\": …, \"y\": …, \"w\": 20, \"h\": 20, \"color\": \"#…\"}}",
            });
        }

        if (imported.Font is { } font)
        {
            return Ok($"Schrift „{font.Family}“ übernommen", new JsonObject
            {
                ["family"] = font.Family,
                ["faces"] = new JsonArray([.. font.Faces.Select(f => (JsonNode)JsonValue.Create(f)!)]),
                ["reused"] = font.Reused,
                ["use"] = $"\"fontFamily\": \"{font.Family}\" (Gewichte: list_fonts)",
            });
        }

        var asset = imported.Picture!.Asset;
        s.AttachmentAssets.Add(asset.Id);
        var info = new JsonObject
        {
            ["key"] = asset.Key,
            ["name"] = asset.Name,
            ["width"] = asset.Width,
            ["height"] = asset.Height,
            ["reused"] = imported.Picture.Reused,
            ["use"] = $"{{\"type\": \"image\", ..., \"source\": {{\"asset\": \"{asset.Key}\"}}}}",
        };
        return Ok($"Bild „{Clip(asset.Name, 40)}“ übernommen ({asset.Key})", info, ["Die Urheberangabe steht automatisch in den Bildnachweisen des Designs. Schau die Seite danach mit look an."]);
    }
}
