using System.Text.Json;
using DesignThix.Catalogs;
using DesignThix.Catalogs.Providers;
using DesignThix.Core.Text;
using DesignThix.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace DesignThix.Logic;

/// <summary>A catalogue as the media browser and the editor see it.</summary>
public sealed record CatalogRow(ICatalog Catalog, CatalogSetting Setting)
{
    public string Id => Catalog.Id;

    /// <summary>Local catalogues (Mitgeliefert, Uploads, Ordner) read what is on this server; the others ask a provider on the internet.</summary>
    public bool External => Catalog.Caps.HasFlag(CatalogCaps.External);

    /// <summary>Whether the catalogue has pictures a design could use (not only icons or fonts).</summary>
    public bool HasPictures => (Catalog.Kinds & (CatalogKinds.Photo | CatalogKinds.Illustration | CatalogKinds.Vector)) != 0;
}

/// <summary>A catalogue as the administration sees it.</summary>
public sealed record CatalogAdminRow(ICatalog Catalog, CatalogSetting Setting, bool Enabled, bool HasKey, bool Usable)
{
    public string Id => Catalog.Id;
}

/// <summary>What the administrator may change of one catalogue.</summary>
public sealed record CatalogInput(bool Enabled, int Order, int PerUserPerMinute, int PerHour, bool SafeSearch, IReadOnlyList<string> AllowedLicences, IReadOnlyList<string> Folders);

/// <summary>The image an import made (or found): what the media browser hands to its callback.</summary>
public sealed record CatalogImportResult(AssetRow Asset, bool Reused);

/// <summary>One line of the "Bildnachweise" of a design.</summary>
public sealed record CreditRow(string Key, string Name, string Catalog, string CatalogName, string Title, string Author, string AuthorUrl, string SourceUrl, string LicenceCode, string LicenceName, string LicenceUrl, string Attribution);

/// <summary>
/// The catalogues (docs/PLAN-CATALOGS.md): what a person may use, the search, the import into the library of an area and the credits of a design; for administrators the settings, the keys, the test and
/// the cache. A catalogue is found by its id in the <see cref="CatalogRegistry"/>; nothing in here knows a catalogue by name. Every method checks the person itself.
/// </summary>
public static class CatalogLogic
{
    /// <summary>The category of an image that came from a catalogue.</summary>
    public const string CategoryPrefix = "Katalog: ";

    private static readonly JsonSerializerOptions Camel = new(JsonSerializerDefaults.Web);

    public static CatalogServices Svc(Biz biz) => biz.Service<CatalogServices>();

    public static CatalogSetting SettingOf(Biz biz, ICatalog catalog)
        => biz.Service<SettingStore>().Get<CatalogsSettings>(SettingStore.Catalogs).Items.TryGetValue(catalog.Id, out var s) ? s : new CatalogSetting();

    public static bool IsEnabled(ICatalog catalog, CatalogSetting setting) => setting.Enabled ?? catalog.EnabledByDefault;

    private static async Task<CatalogContext> ContextAsync(Biz biz, ICatalog catalog, CancellationToken ct)
    {
        var svc = Svc(biz);
        return new CatalogContext
        {
            Biz = biz,
            Catalog = catalog,
            Services = svc,
            Settings = SettingOf(biz, catalog),
            Key = catalog.Caps.HasFlag(CatalogCaps.NeedsKey) || svc.Secrets.Has(catalog.Id) ? await svc.Secrets.LoadAsync(catalog.Id, ct) : null,
            BaseUrl = svc.BaseUrl(catalog) ?? "",
        };
    }

    /// <summary>The headers a catalogue wants for its thumbnails (Openverse: the token), for the proxy.</summary>
    public static async Task<IReadOnlyDictionary<string, string>?> ThumbHeadersAsync(Biz biz, ICatalog catalog, CancellationToken ct)
        => await catalog.ThumbHeadersAsync(await ContextAsync(biz, catalog, ct), ct);

    // ------------------------------------------------------------------------------------------------ for people

    /// <summary>The catalogues a signed-in person may use: switched on, and with a key where one is needed. In the order the administrator gave.</summary>
    public static async Task<List<CatalogRow>> ListAsync(Biz biz)
    {
        biz.RequireSignedIn();
        var svc = Svc(biz);
        var list = new List<CatalogRow>();
        foreach (var catalog in svc.Registry.All)
        {
            var setting = SettingOf(biz, catalog);
            if (IsEnabled(catalog, setting) && (!catalog.Caps.HasFlag(CatalogCaps.NeedsKey) || svc.Secrets.Has(catalog.Id)))
            {
                list.Add(new CatalogRow(catalog, setting));
            }
        }

        var position = svc.Registry.All.Select((c, i) => (c.Id, i)).ToDictionary(p => p.Id, p => p.i);
        return await Task.FromResult(list.OrderBy(r => r.Setting.Order).ThenBy(r => position[r.Id]).ToList());
    }

    /// <summary>The catalogue by id when the person may use it; a catalogue that does not exist or is switched off is a 404 (the same answer).</summary>
    public static async Task<ICatalog> RequireUsableAsync(Biz biz, string? id)
    {
        biz.RequireSignedIn();
        return (await ListAsync(biz)).FirstOrDefault(r => r.Id == id)?.Catalog ?? throw new NotFoundException();
    }

    public static async Task<IReadOnlyList<CatalogCollection>> CollectionsAsync(Biz biz, string? id, CancellationToken ct = default)
    {
        var catalog = await RequireUsableAsync(biz, id);
        if (!catalog.Caps.HasFlag(CatalogCaps.Collections))
        {
            return [];
        }

        var ctx = await ContextAsync(biz, catalog, ct);
        return await catalog.CollectionsAsync(ctx, ct);
    }

    /// <summary>A search or the first page of a browsable catalogue. The text is cut to 100 characters; a search-only catalogue with no text says so instead of listing.</summary>
    public static async Task<CatalogPage> SearchAsync(Biz biz, string? id, CatalogQuery query, CancellationToken ct = default)
    {
        var catalog = await RequireUsableAsync(biz, id);
        var ctx = await ContextAsync(biz, catalog, ct);
        // control characters out (a NUL in a text parameter is an error of the database), the words cut to 100 characters
        var clean = query with
        {
            Text = CatalogLicences.Clean(query.Text, 100),
            Collection = CatalogLicences.Clean(query.Collection, 200),
            Page = Math.Clamp(query.Page, 1, CatalogQuery.MaxPage),
            PerPage = Math.Clamp(query.PerPage, 1, CatalogQuery.MaxPerPage),
            Orientation = query.Orientation is "landscape" or "portrait" or "square" ? query.Orientation : "any",
            Locale = "de",
        };
        if (clean.Text.Length == 0 && clean.Collection.Length == 0 && !catalog.Caps.HasFlag(CatalogCaps.Browse))
        {
            return CatalogPage.Empty("Gib einen Suchbegriff ein.");
        }

        return await catalog.SearchAsync(ctx, clean, ct);
    }

    // ------------------------------------------------------------------------------------------------ the import

    private sealed record Existing(long Id, DateTime? TrashedDate);

    private static async Task<Existing?> FindImportedAsync(Biz biz, long space, string catalogId, string itemId)
        => await biz.Db.Asset.FromSqlInterpolated($"""SELECT * FROM "Asset" WHERE "SpaceId" = {space} AND "SourceJson" IS NOT NULL AND ("SourceJson"->>'copy') IS NULL AND "SourceJson"->>'catalog' = {catalogId} AND "SourceJson"->>'itemId' = {itemId}""")
            .AsNoTracking().Select(a => new Existing(a.Id, a.TrashedDate)).FirstOrDefaultAsync();

    /// <summary>
    /// Where an import goes: the area or folder that was asked for (the person needs Edit there); else the area of the design that is open or the area the page prefers, when the person may write
    /// there; else their personal area.
    /// </summary>
    private static async Task<(long Space, long? Folder)> TargetAsync(Biz biz, long? spaceId, long? folderId, long? designId, long? preferSpace)
    {
        if (spaceId is not null || folderId is not null)
        {
            return await Access.PlacementAsync(biz, spaceId, folderId);
        }

        long? soft = preferSpace;
        if (designId is { } design)
        {
            soft = (await Access.PlaceAsync(biz, ItemKind.Design, design)).SpaceId;
        }

        if (soft is { } space && await Access.RoleInAsync(biz, space) is { } role && role != SpaceRole.Viewer)
        {
            return (space, null);
        }

        return (await biz.PersonalSpaceIdAsync(), null);
    }

    /// <summary>
    /// Takes an item of a catalogue into the library (docs/PLAN-CATALOGS.md section 4): checked like an upload (<see cref="FileSniffer"/>, <see cref="SvgSafe"/>), counted against the storage of the area,
    /// recorded with its source, author and licence. An item that was imported into the same area before is reused, so using a picture twice never makes two copies. An item a local catalogue already
    /// shows from the library (Mitgeliefert, Uploads) is not copied: its own image is the answer.
    /// </summary>
    public static async Task<CatalogImportResult> ImportAsync(Biz biz, string? catalogId, string? itemId, long? spaceId = null, long? folderId = null, long? designId = null, long? preferSpace = null, CancellationToken ct = default)
    {
        var catalog = await RequireUsableAsync(biz, catalogId);
        var item = (itemId ?? "").Trim();
        if (item.Length is 0 or > 500 || item.Any(char.IsControl))
        {
            throw new BizException("Das Bild gibt es nicht (mehr).");
        }

        var (space, folder) = await TargetAsync(biz, spaceId, folderId, designId, preferSpace);
        var ctx = await ContextAsync(biz, catalog, ct);
        var svc = Svc(biz);
        if (await FindImportedAsync(biz, space, catalog.Id, item) is { } known)
        {
            return await ReuseAsync(biz, known, folder);
        }

        svc.Limiter.TakePerson(biz.UserId, catalog, CatalogServices.EffectivePerMinute(catalog, ctx.Settings));
        var fetched = await catalog.FetchAsync(ctx, item, ct);
        if (fetched.Item.AssetKey is { } own)
        {
            // a picture that is in the library already: nothing is copied
            return new CatalogImportResult(await AssetLogic.GetByKeyAsync(biz, own) ?? throw new BizException("Das Bild gibt es nicht (mehr)."), true);
        }

        if (fetched.Bytes is null)
        {
            throw new BizException("Dieser Eintrag ist kein Bild.");
        }

        var prepared = AssetLogic.Prepare(fetched.Bytes);
        await StorageLogic.RequireRoomAsync(biz, space, prepared.Bytes.LongLength);

        var title = CatalogLicences.Clean(string.IsNullOrWhiteSpace(fetched.Item.Title) ? Path.GetFileNameWithoutExtension(fetched.FileName) : fetched.Item.Title, 200);
        if (title.Length == 0)
        {
            title = "Bild";
        }

        var wish = Slug.From(title, AssetLogic.MaxKeyLength - 6);
        if (wish.Length == 0)
        {
            wish = Slug.From(catalog.Id, 20).Length > 0 ? Slug.From(catalog.Id, 20) : "bild";
        }

        var attribution = CatalogLicences.Attribution(fetched.Item, catalog.Name, fetched.Attribution);
        var source = JsonSerializer.Serialize(new
        {
            catalog = catalog.Id,
            itemId = item,
            title,
            author = fetched.Item.Author ?? "",
            authorUrl = fetched.Item.AuthorUrl ?? "",
            sourceUrl = fetched.Item.SourceUrl ?? "",
            licence = fetched.Item.Licence is { } l ? new { code = l.Code, name = l.Name, url = l.Url ?? "", attributionRequired = l.AttributionRequired } : null,
            attribution,
            importedDate = biz.Now.ToString("o", System.Globalization.CultureInfo.InvariantCulture),
        }, Camel);

        Asset asset;
        for (var attempt = 1; ; attempt++)
        {
            asset = new Asset
            {
                Key = await AssetLogic.FreeKeyAsync(biz.Db, wish),
                Name = title,
                Category = CategoryPrefix + catalog.Name,
                Tags = AssetLogic.CleanTags(fetched.Item.Author),
                ContentType = prepared.ContentType,
                Extension = prepared.Extension,
                Width = prepared.Width,
                Height = prepared.Height,
                Bytes = prepared.Bytes,
                ContentHash = prepared.Hash,
                SizeBytes = prepared.Bytes.LongLength,
                SpaceId = space,
                FolderId = folder,
                SourceJson = source,
            };
            biz.Db.Asset.Add(asset);
            try
            {
                await biz.Db.SaveChangesAsync(ct);
                break;
            }
            catch (DbUpdateException) when (attempt < 10)
            {
                // the key was taken at the same moment, or somebody imported the same item at the same moment: ask again
                biz.Db.Entry(asset).State = EntityState.Detached;
                if (await FindImportedAsync(biz, space, catalog.Id, item) is { } raced)
                {
                    return await ReuseAsync(biz, raced, folder);
                }
            }
        }

        await biz.Log.LogAsync("Katalogbild übernommen", nameof(Asset), asset.Id, $"{asset.Key} ({catalog.Name})");
        return new CatalogImportResult((await AssetLogic.GetAsync(biz, asset.Id))!, false);
    }

    private static async Task<CatalogImportResult> ReuseAsync(Biz biz, Existing known, long? folder)
    {
        if (known.TrashedDate is not null)
        {
            // it went to the trash after it was imported; using it again brings it back (the unique source of the area would not allow a second copy)
            var asset = await biz.Db.Asset.FirstAsync(a => a.Id == known.Id);
            asset.TrashedDate = null;
            asset.TrashedWithFolderId = null;
            asset.FolderId = folder;
            await biz.Db.SaveChangesAsync();
        }

        return new CatalogImportResult((await AssetLogic.GetAsync(biz, known.Id)) ?? throw new BizException("Das Bild gibt es nicht (mehr)."), true);
    }

    /// <summary>
    /// The source of a copy of an imported image (a copy in the file browser, a move into another area as a copy): the same record, marked <c>copy</c>, so the credits travel with the picture but the
    /// copy is not mistaken for the import of the item (the unique index and the reuse look at imports only).
    /// </summary>
    public static string? AsCopy(string? sourceJson)
    {
        if (string.IsNullOrEmpty(sourceJson))
        {
            return null;
        }

        try
        {
            var node = System.Text.Json.Nodes.JsonNode.Parse(sourceJson) as System.Text.Json.Nodes.JsonObject;
            if (node is null)
            {
                return null;
            }

            node["copy"] = true;
            return node.ToJsonString();
        }
        catch (JsonException)
        {
            return null;
        }
    }

    // ------------------------------------------------------------------------------------------------ the credits

    /// <summary>
    /// The "Bildnachweise" of a design: every image it uses that came from an external catalogue, with author, licence and links (the person needs View on the design). Own uploads and the
    /// catalogues of this server (Mitgeliefert, Ordner) need no credit and are not listed.
    /// </summary>
    public static async Task<List<CreditRow>> CreditsAsync(Biz biz, long designId)
    {
        await Access.RequireAsync(biz, ItemKind.Design, designId, AccessLevel.View);
        var keys = await biz.Db.ItemAssetRef.AsNoTracking().Where(r => r.ItemKind == ItemKind.Design && r.ItemId == designId).Select(r => r.AssetKey).ToListAsync();
        return await CreditsOfKeysAsync(biz, keys);
    }

    /// <summary>
    /// The credit lines for these library keys: the ones whose image came from an external catalogue. No permission check of its own: the caller has decided that these keys may be shown (the design
    /// the person may see, or the images a public link delivers). Each item of a catalogue is listed once.
    /// </summary>
    public static async Task<List<CreditRow>> CreditsOfKeysAsync(Biz biz, IReadOnlyCollection<string> keys)
    {
        if (keys.Count == 0)
        {
            return [];
        }

        var assets = await biz.Db.Asset.AsNoTracking().Where(a => keys.Contains(a.Key) && a.SourceJson != null).Select(a => new { a.Key, a.Name, a.SourceJson }).ToListAsync();
        var registry = Svc(biz).Registry;
        var rows = new List<CreditRow>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var a in assets.OrderBy(a => a.Name, StringComparer.CurrentCultureIgnoreCase))
        {
            if (SourceOf(registry, a.Key, a.Name, a.SourceJson) is { } credit && (registry.Find(credit.Catalog) is not { } catalog || catalog.Caps.HasFlag(CatalogCaps.External)) && seen.Add(credit.Catalog + "|" + ItemOf(a.SourceJson)))
            {
                rows.Add(credit);
            }
        }

        return rows;
    }

    /// <summary>The source record of an image (its <c>SourceJson</c>) as a credit line; null for an own upload or a damaged record.</summary>
    public static CreditRow? SourceOf(CatalogRegistry registry, string key, string name, string? sourceJson)
    {
        if (string.IsNullOrEmpty(sourceJson))
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(sourceJson);
            var e = doc.RootElement;
            var catalogId = Str(e, "catalog");
            var licence = e.TryGetProperty("licence", out var l) && l.ValueKind == JsonValueKind.Object ? l : default;
            return new CreditRow(key, name, catalogId, registry.Find(catalogId)?.Name ?? catalogId, Str(e, "title"), Str(e, "author"), CatalogLicences.SafeUrl(Str(e, "authorUrl")), CatalogLicences.SafeUrl(Str(e, "sourceUrl")),
                Str(licence, "code"), Str(licence, "name"), CatalogLicences.SafeUrl(Str(licence, "url")), Str(e, "attribution"));
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string ItemOf(string? sourceJson)
    {
        try
        {
            using var doc = JsonDocument.Parse(sourceJson ?? "{}");
            return Str(doc.RootElement, "itemId");
        }
        catch (JsonException)
        {
            return "";
        }
    }

    private static string Str(JsonElement e, string name) => e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";

    // ------------------------------------------------------------------------------------------------ administration

    public static async Task<List<CatalogAdminRow>> AdminListAsync(Biz biz)
    {
        biz.RequireAdmin();
        var svc = Svc(biz);
        var rows = new List<CatalogAdminRow>();
        foreach (var catalog in svc.Registry.All)
        {
            var setting = SettingOf(biz, catalog);
            var enabled = IsEnabled(catalog, setting);
            var hasKey = svc.Secrets.Has(catalog.Id);
            rows.Add(new CatalogAdminRow(catalog, setting, enabled, hasKey, enabled && (!catalog.Caps.HasFlag(CatalogCaps.NeedsKey) || hasKey)));
        }

        return await Task.FromResult(rows.OrderBy(r => r.Setting.Order).ToList());
    }

    public static async Task<CatalogAdminRow> AdminGetAsync(Biz biz, string? id)
        => (await AdminListAsync(biz)).FirstOrDefault(r => r.Id == id) ?? throw new NotFoundException();

    /// <summary>Saves the settings of one catalogue. The key is separate (<see cref="SetKeyAsync"/>).</summary>
    public static async Task SaveAsync(Biz biz, string? id, CatalogInput input)
    {
        var row = await AdminGetAsync(biz, id);
        if (input.PerUserPerMinute is < 0 or > 1000)
        {
            throw new BizException("Die Suchen pro Person und Minute müssen zwischen 0 und 1000 liegen (0 = Standard).", "Input.PerUserPerMinute");
        }

        if (input.PerHour is < 0 or > 100_000)
        {
            throw new BizException("Die Anfragen pro Stunde müssen zwischen 0 und 100 000 liegen (0 = Standard).", "Input.PerHour");
        }

        if (input.Order is < -1000 or > 1000)
        {
            throw new BizException("Die Reihenfolge ist eine Zahl zwischen -1000 und 1000.", "Input.Order");
        }

        var folders = new List<string>();
        foreach (var name in input.Folders.Select(f => f.Trim()).Where(f => f.Length > 0))
        {
            if (!ServerFolders.IsFolderName(name))
            {
                throw new BizException($"„{name}“ ist kein Ordnername. Erlaubt sind Buchstaben, Ziffern, Leerzeichen, Punkt, Bindestrich und Unterstrich (kein Pfad).", "Input.Folders");
            }

            if (!folders.Contains(name, StringComparer.Ordinal))
            {
                folders.Add(name);
            }
        }

        if (folders.Count > 20)
        {
            throw new BizException("Es sind höchstens 20 Ordner möglich.", "Input.Folders");
        }

        var licences = new List<string>();
        foreach (var code in input.AllowedLicences.Select(c => c.Trim()).Where(c => c.Length > 0))
        {
            if (code.Length > 40 || !CatalogLicences.IsUsable(code))
            {
                throw new BizException($"„{code}“ ist keine Lizenz, die DesignThix zulässt (Bilder in Designs dürfen kommerziell genutzt und verändert werden, also nie NC oder ND).", "Input.AllowedLicences");
            }

            if (!licences.Contains(code, StringComparer.OrdinalIgnoreCase))
            {
                licences.Add(code);
            }
        }

        var store = biz.Service<SettingStore>();
        var all = store.Get<CatalogsSettings>(SettingStore.Catalogs);
        all.Items[row.Id] = new CatalogSetting
        {
            Enabled = input.Enabled,
            Order = input.Order,
            PerUserPerMinute = input.PerUserPerMinute,
            PerHour = input.PerHour,
            SafeSearch = input.SafeSearch,
            AllowedLicences = licences,
            Folders = row.Catalog is FolderCatalog ? folders : row.Setting.Folders,
        };
        await SettingLogic.SaveAsync(biz, SettingStore.Catalogs, all, "Katalog-Einstellungen geändert");
        await biz.Log.LogAsync("Katalog eingestellt", "Catalog", null, $"{row.Id}: {(input.Enabled ? "an" : "aus")}");
    }

    /// <summary>Saves or removes the key of a provider; an empty value keeps the key, <paramref name="remove"/> deletes it. The key is never shown again.</summary>
    public static async Task SetKeyAsync(Biz biz, string? id, string? key, bool remove)
    {
        var row = await AdminGetAsync(biz, id);
        var svc = Svc(biz);
        if (remove)
        {
            await svc.Secrets.SaveAsync(row.Id, null);
            await biz.Log.LogAsync("Katalog-Schlüssel entfernt", "Catalog", null, row.Id);
            return;
        }

        var clean = (key ?? "").Trim();
        if (clean.Length == 0)
        {
            return;
        }

        if (clean.Length > 500 || clean.Any(char.IsControl))
        {
            throw new BizException("Der Schlüssel sieht nicht richtig aus.", "Input.Key");
        }

        await svc.Secrets.SaveAsync(row.Id, clean);
        await biz.Log.LogAsync("Katalog-Schlüssel gespeichert", "Catalog", null, row.Id);
    }

    /// <summary>One search against the catalogue, as the administrator would make it: the answer in a sentence (or the reason it did not work).</summary>
    public static async Task<string> TestAsync(Biz biz, string? id, CancellationToken ct = default)
    {
        var row = await AdminGetAsync(biz, id);
        var catalog = row.Catalog;
        if (!row.Enabled)
        {
            return $"{catalog.Name} ist ausgeschaltet.";
        }

        if (catalog.Caps.HasFlag(CatalogCaps.NeedsKey) && !row.HasKey)
        {
            return $"{catalog.Name} braucht einen Schlüssel.";
        }

        try
        {
            // one request, whatever the provider said before: if it still says "not now" the pause starts again
            Svc(biz).Limiter.Unblock(catalog);
            var ctx = await ContextAsync(biz, catalog, ct);
            var page = await catalog.SearchAsync(ctx, new CatalogQuery { Text = catalog.Caps.HasFlag(CatalogCaps.Browse) ? "" : "natur", PerPage = 10 }, ct);
            return page.Items.Count == 0
                ? $"{catalog.Name} antwortet, hat aber nichts gefunden."
                : $"Verbindung steht: {catalog.Name} hat {(page.Total is { } total ? total + " Treffer" : page.Items.Count + " Treffer auf der ersten Seite")}.";
        }
        catch (CatalogException ex)
        {
            return ex.Message;
        }
    }

    /// <summary>Empties the cache of the answers and of the thumbnails (the next searches ask the providers again).</summary>
    public static async Task ClearCacheAsync(Biz biz)
    {
        biz.RequireAdmin();
        await biz.Db.CatalogCacheEntry.ExecuteDeleteAsync();
        Svc(biz).Thumbs.Clear();
        await biz.Log.LogAsync("Katalog-Cache geleert", "Catalog", null, null);
    }
}
