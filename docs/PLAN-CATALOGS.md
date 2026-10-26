# DesignThix plan 5: Kataloge (media sources as modules)

Plan 5 follows plan 4 (`docs/PLAN-AI-DESIGN.md`). Where it differs from the earlier plans, this one wins. The owner's words: *"Kann man irgendwie Google Image Search,
sonstige StockPhoto Suchen einbinden? Also diverse Quellen? Sollte modular sein, dass wir in Zukunft noch andere hinzufügen können. Evtl. als Art Kataloge einbauen.
Mitgeliefert, Unsplash, Awesomefont, Whatever-Catalogue … Es gibt Kataloge, die man nicht auflisten kann, sondern nur durchsuchen."*

Agreed with the owner (2026-10-25): **Google image search is out** (the Custom Search JSON API is closed to new customers and ends on 2027-01-01; its results are mostly
copyrighted). First set: Mitgeliefert, Uploads (own + teams), a server folder, Pexels, Pixabay, Openverse, Iconify (with Font Awesome Free), Google Fonts. **Unsplash later**
(its rules demand hotlinked image URLs and a download ping, which clashes with the offline copy and the strict CSP).

## Status

**C1 is built** (the framework, Mitgeliefert, Uploads, Ordner, the administration, the catalogue-driven media browser, the panel Fotos, the Bildnachweise; the "C1 status" at the end of this file lists where it differs from the plan). **C2 is built** (Pexels, Pixabay and Openverse with their rules, the pause on a provider's 429, the colour filter, the Bildnachweise in the public view; the "C2 status" at the end lists what was verified about each provider and where it differs from the plan). C3 (Iconify, Google Fonts, the KI tools, the final pass) is not started.

---

## 1. Principles

1. **A catalogue is a module**: one C# class implementing `ICatalog`, registered in ONE list (`Catalogs/CatalogRegistry.cs`). Adding a source = one class + one line + its
   tests. No catalogue-specific code outside its class (UI, admin page, proxy, import and attribution are generic).
2. **Browsable or search-only**: a catalogue declares its capabilities. Browsable ones show collections/categories and a first page without a query; search-only ones show a
   search field, suggestion chips and the empty state "Gib einen Suchbegriff ein".
3. **Used = copied**: what goes into a design is imported into the library of the design's area (an `Asset`, a `Font`, or an icon body) with source, author and licence.
   Designs stay offline-printable, the public view and output never fetch from a third party, a vanished provider breaks nothing.
4. **The server talks to providers, never the browser**: search and thumbnails go through the app (`/api/catalogs/...`), so the CSP stays `img-src 'self' data: blob:`,
   the keys stay on the server and the people's addresses are not sent to third parties.
5. **Off by default**: external catalogues are switched on by an administrator (`/Admin/Catalogs`) with their key; without internet they say "Nicht erreichbar" and the rest works.
6. **Licences in code**: each catalogue states which licences it lets through and what attribution they need; items with NC (non-commercial) or ND (no derivatives) licences
   are never offered (designs change pictures and may be used commercially).

## 2. The interface (`src/DesignThix/Catalogs/`)

```csharp
public interface ICatalog
{
    string Id { get; }                       // "builtin", "uploads", "folder", "pexels", "pixabay", "openverse", "iconify", "googlefonts"
    string Name { get; }                     // German display name
    CatalogKind Kinds { get; }               // [Flags] Photo, Illustration, Vector, Icon, Font
    CatalogCaps Caps { get; }                // [Flags] Browse, Search, Collections, Filters, NeedsKey, External
    CatalogInfo Info { get; }                // homepage, key help URL, required provider link text ("Fotos von Pexels"), licence summary, default limits
    Task<IReadOnlyList<CatalogCollection>> CollectionsAsync(CatalogContext ctx, CancellationToken ct);
    Task<CatalogPage> SearchAsync(CatalogContext ctx, CatalogQuery query, CancellationToken ct);   // query.Text empty + Browse = the first page / a collection
    Task<CatalogFetch> FetchAsync(CatalogContext ctx, string itemId, CancellationToken ct);         // bytes or font files or icon body + metadata, for the import
}
```

- `CatalogQuery`: `Text`, `Collection`, `Kind`, `Orientation` (any|landscape|portrait|square), `Colour` (where supported), `Page`, `PerPage` (≤ 50), `Locale` ("de").
- `CatalogItem`: `Id` (catalogue-local), `Kind`, `Title`, `Width`, `Height`, `Thumb` (a signed proxy token, never a provider URL in the page), `Author`, `AuthorUrl`,
  `SourceUrl`, `Licence` (`{ code, name, url, attributionRequired }`), for local catalogues `AssetKey`/`FontFamily`/`IconName` (already in the library: no import).
- `CatalogContext`: the `Biz` of the person, the settings and key of the catalogue, an `HttpClient` from `CatalogHttp` (see 4), the cache.
- Local catalogues implement the same interface: **Mitgeliefert** (built-in media by category = collections Flaggen, Siegel, Logos; Lucide icons; bundled fonts),
  **Uploads** (one collection per area the person may see: Meine Uploads, each team, Freigegeben; through `Access.Visible`), **Ordner auf dem Server** (`{data}/catalogs/<name>/`,
  sub-folders = collections, read-only, sniffed like an upload; an administrator names the folders; the Docker compose files get a commented example volume).

## 3. Data

- `Asset.SourceJson` (jsonb, null for own uploads): `{ catalog, itemId, title, author, authorUrl, sourceUrl, licence: { code, name, url }, attribution, importedDate }`;
  unique index on (`SpaceId`, catalog, itemId) among live assets (an item imported twice into one area is reused). Same for `Font.SourceJson`.
- `IconBody` (new): `Prefix`, `Name`, `BodyJson` (the parsed allowlisted `{ tag, attrs }` tree, never raw SVG), `Width`, `Height`, `Licence`, `SourceJson`; unique (Prefix, Name).
  Icons are platform-wide (one copy, they are tiny and licensed for everybody).
- `CatalogCacheEntry` (new): `Catalog`, `KeyHash`, `ResponseJson`, `ExpiresDate`. Search answers are cached 24 h (Pixabay requires it; the others profit); thumbnails are
  cached on disk under `{data}/catalog-cache/` (24 h, at most 500 MB, oldest first out; a background cleanup).
- Settings `Catalogs`: per catalogue `Enabled`, `Order`, `PerUserPerMinute`, `PerHour` (budget of the key), `SafeSearch`, `AllowedLicences` (Openverse, Iconify),
  `Folders` (folder catalogue). Keys in a secret store like the AI's (`{data}/secrets/catalogs/<id>`; generalise `AiSecretStore` into a `SecretFileStore` if that is clean).

## 4. Server

- **Endpoints** (`Endpoints/CatalogEndpoints.cs`, signed in): `GET /api/catalogs` (the enabled ones the person may use, with caps, kinds, provider link text),
  `GET /api/catalogs/{id}/collections`, `GET /api/catalogs/{id}/search?q&collection&kind&orientation&colour&page`, `GET /api/catalogs/thumb/{token}` (the proxy: the token is
  an HMAC (`SecretProtector`) over catalogue + provider URL + expiry, so it is no open proxy), `POST /api/catalogs/{id}/import` (`{ itemId, spaceId?, folderId? }` -> the asset key /
  font family / icon name; antiforgery; `AssetLogic.RequireUploader` + quota + `Access` on the target; default target = the design's area when called from the editor with
  `designId`), `GET /api/designs/{id}/credits` (the "Bildnachweise": every external source the design uses, with the attribution text).
- **`CatalogHttp`**: one named `HttpClient` per catalogue, the allowed hosts of the catalogue (requests and redirects to other hosts are refused), 10 s timeout for searches,
  60 s for downloads, at most 25 MB per download, a `User-Agent` "DesignThix/<version>", no cookies. Never a URL from the browser: the browser sends item ids, the catalogue
  builds the URL itself (SSRF).
- **Limits**: per person per minute (default 30 searches), the budget per hour of the key (Pexels 200/h, Pixabay 100/min); exceeded = a German message
  ("Pexels hat für diese Stunde genug Anfragen bekommen. Versuch es in ein paar Minuten wieder."), never a retry loop around a provider's limit.
- **Import**: through the upload path (`FileSniffer`, `SvgSafe`, key from the title through `Slug`, retry on a taken key), `SourceJson` filled, category "Katalog: <Name>".
  A font import: the regular, bold, italic and bold-italic files (WOFF2 or TTF), through the font checks of `FontLogic`.
- **The catalogues of the first set** (each verified against the provider's CURRENT documentation while building; numbers below are from 2026-10):
  - **Pexels** (key; search-only + "Kuratiert" as a browsable collection): attribution "Foto von <Name> auf Pexels" with links; the tab shows a visible link to Pexels
    (their rule); 200 requests per hour by default.
  - **Pixabay** (key; search + browse with categories; photo/illustration/vector): result URLs may only be used for temporary display, so the import downloads
    `largeImageURL` to the server (their rule: download to your server, no permanent hotlinking); requests cached 24 h; 100 per minute; `lang=de`; `safesearch` from the settings;
    "Bilder von Pixabay" shown with the results.
  - **Openverse** (no key needed, optional client credentials for higher limits; search-only): `license_type=commercial,modification` always; licence + attribution text
    stored; the CC licence of each item shown on the tile and in the asset details.
  - **Iconify** (no key; browsable: icon sets as collections, and search): only sets whose licence is in `AllowedLicences` (default MIT, Apache-2.0, ISC, CC0-1.0, CC-BY-4.0,
    OFL-1.1); **Font Awesome Free** = the sets `fa6-solid`, `fa6-regular`, `fa6-brands` (CC BY 4.0: attribution in the credits); the import stores the icon body (see 5).
    The address of the Iconify API is a setting (default `https://api.iconify.design`; a company may run its own Iconify server).
  - **Google Fonts** (the families of `fonts.google.com` through the Google Fonts Developer API with a key, or a key-free mirror such as Fontsource if it is reliable;
    browsable by category serif/sans/display/handwriting/mono and searchable): OFL/Apache only; the import adds the family to the area's fonts.
- **Fake providers for the tests**: `tests/e2e/fake-catalogs.js` (Pexels-, Pixabay-, Openverse-, Iconify-, Google-Fonts-shaped answers with local pictures) and the same in
  the integration tests through a `CatalogTestSeam` (like `AiTestSeam`). The base URLs can be overridden ONLY through the configuration file / environment
  (`DESIGNTHIX__Catalogs__<id>__BaseUrl`), never through the admin page (SSRF).

## 5. Icons from catalogues (a small schema change)

The `icon` element's name may be `prefix:name` (`^[a-z0-9-]{1,64}(:[a-z0-9-]{1,64})?$`); a name without a prefix is Lucide as today. `DtEngine.normalize` and
`DocumentValidator` change identically (the test that compares them covers it). The engine's `opts.icon(name)` already asks the app: the editor, designs.js, the run page,
the public view and the templates preview get bodies of prefixed icons from `GET /api/icons?names=a:b,c:d` (from `IconBody`; built-in Lucide stays in `lib/icons.json`),
and the output payload and the public payload include the bodies of the prefixed icons a document uses. Colour and stroke work as for Lucide (a filled icon set uses `fill`
= the icon colour). An imported icon body goes through the same allowlist parser as Lucide (`parseIconBody` / its C# twin), never raw SVG.

## 6. Browser

- **The media browser** (`dt-media.js`, `DtMedia.pick`) becomes catalogue-driven: the tabs are the catalogues (`/api/catalogs`) with their collections as chips or a side list;
  "Alle" stays for the local ones. A search-only catalogue shows the search field, chips with suggestions ("Natur", "Essen", "Büro", "Hintergrund", "Textur", "Menschen") and
  "Gib einen Suchbegriff ein"; a browsable one shows its first page. Tiles: the thumbnail, on hover/focus author and licence; external results carry a small source badge.
  Picking an external item imports it (a spinner on the tile, then the callback with the new key) - every place that uses `DtMedia.pick` gets catalogues for free.
  The provider link (Pexels, Pixabay) is shown with their results. Paging: "Mehr laden" + IntersectionObserver.
- **Editor**: a new rail entry **"Fotos"** (after Uploads): the photo catalogues (Pexels, Pixabay, Openverse, the folder catalogue) with one search field over the chosen catalogue,
  orientation filter, tiles that drag onto the canvas (`D.dnd.attach` + `D.canvas.dropAsset` after the import; a drop onto a frame or image replaces its source as today) or
  insert on click. The **Elemente** panel's icon section gets a set switch (Lucide built in + Iconify sets the admin allows, e.g. Font Awesome, Material, Tabler, Phosphor);
  search covers the chosen set. The **font select** gets "Weitere Schriften …" (a dialog over Google Fonts: preview text, category, search, "Hinzufügen").
- **Bildnachweise**: Datei menu "Bildnachweise" (a dialog: one line per external source with author, licence and link, "Text kopieren"); asset edit page: a "Quelle" block;
  the public view: a "Bildnachweise" link in its footer when the design uses external sources (attribution of CC-BY material must travel with the design).
- **`/Admin/Catalogs`**: a list (name, kind, on/off, key status, "Testen" = one search), the edit page (key, limits, safe search, allowed licences, order; the folder catalogue:
  folder names), the provider's licence summary in German, and "Cache leeren".

## 7. Phases (Sonnet agents; the planner reviews and commits after each)

- **C1 Framework and local catalogues**: `ICatalog` + registry, `CatalogHttp`, cache, proxy, import, settings + secret store, `/Admin/Catalogs`, the local catalogues
  (Mitgeliefert, Uploads, Ordner), `Asset/Font.SourceJson`, credits endpoint + dialog, the catalogue-driven `DtMedia` and the editor panel "Fotos" (works with the local ones),
  `CatalogTestSeam` + `fake-catalogs.js`, tests (`Integration/CatalogTests`: registry, caps, browse vs search-only, proxy token tamper/expiry, allowed hosts, import reuse,
  quota, `Access` on the target, folder catalogue path traversal; `PermissionTests` rows), `tests/e2e/catalogs-check.js`.
- **C2 External pictures**: Pexels, Pixabay, Openverse with their rules (attribution, caching, limits, licence filter), the provider links, Bildnachweise in the public view,
  tests against the fakes (also: a provider that is down, 429, a huge file, a redirect to another host, an NC licence that must not appear).
- **C3 Icons and fonts + AI + final pass**: Iconify (sets, licence filter, `IconBody`, schema change of section 5 in engine and validator, `/api/icons`, payloads), Google Fonts,
  the KI-Design tools `search_catalog` / `import_from_catalog` (plan 4's agent can then place stock photos and catalogue icons; the model sees thumbnails through `look`),
  the browser checks twice on a fresh database, the security review (SSRF, proxy tokens, keys never in a page or log, licence filter, quotas), README section "Kataloge" with a
  screenshot (fake providers), CLAUDE.md, this plan's status.

## 8. Out of scope

Unsplash (later, needs hotlinking + download ping: an exception to the CSP for `images.unsplash.com` and a different import rule), Google image search, paid stock
(Shutterstock, Adobe Stock: licences per download), video and audio, AI image generation, uploading to a catalogue.

---

## C1 status (built)

C1 is built: the framework (`ICatalog`, `CatalogRegistry`, `CatalogHttp`, the cache, the thumbnail proxy, the limiter, the key store, the licence rules), the three local catalogues (Mitgeliefert, Uploads, Ordner), the import with its source record, the credits, the administration (`/Admin/Catalogs`), the catalogue-driven media browser, the editor panel Fotos and the dialog Bildnachweise, the test seam and the fake provider. CLAUDE.md has the section "Kataloge (plan 5)" with the files, the endpoints, the rules and the gotchas; `docs/EDITOR.md` "Catalogues in the editor" has the scripts.

**Where C1 differs from the plan** (decisions the planner can overrule):
- **Names**: the flags are `CatalogKinds` and `CatalogCaps` (`Logic.CatalogKind` already is the design catalogue of the AI). `CatalogContext` offers `Thumb`, `GetTextAsync` (cache + budget of the key) and `DownloadAsync` so a catalogue never touches the HTTP client or the cache itself; `ICatalog` has `EnabledByDefault`, `DefaultBaseUrl`, `AllowedHosts` and `IsAvailable` besides the members of the plan.
- **The proxy token** is the time-limited data protector of ASP.NET (encrypted and authenticated with the key ring: catalogue + provider address or item id + expiry, 24 h) instead of an HMAC over a readable address: the page learns nothing of the address, a changed, shortened, extended, expired or foreign token is simply invalid. `SecretProtector` is a thin layer over the same data protection, so the guarantee is the plan's.
- **The key store** is `CatalogSecretStore` (`{data}/secrets/catalogs/<id>.key`, protected with the key ring), not a generalised `AiSecretStore`: the AI store is built around profile tokens and ChatGPT sign-ins, and a copy of 40 lines was cleaner than a base class. Same rules: never in the database, never in a page.
- **The tabs of the media browser**: the five library tabs (Uploads, Flaggen, Siegel, Logos, Alle) stay exactly as they were (`/api/assets`: `options.tab`, `options.category`, canva-check, content-check and every caller depend on them), the catalogues with pictures are appended as tabs. Mitgeliefert and Uploads exist as catalogues (API, tests, the Fotos logic) but have no tab of their own, because those five tabs already show them; "Alle" stays for the local ones.
- **Fotos is hidden** unless at least one usable catalogue with pictures other than Mitgeliefert and Uploads exists (and the person may edit): with only the two local catalogues the panel Uploads and the media browser say everything a "Fotos" panel would, so the rail does not grow a second Uploads. A switched-on Ordner or any external catalogue shows it.
- **Mitgeliefert** lists the built-in flags and seals (the built-in assets, by category). Lucide icons and the bundled fonts keep their places (panel Elemente, font select); their items join this catalogue with the icon sets and the font dialog of C3. There are no built-in logos, so no collection of that name.
- **Example catalogues** (`example-browse`, `example-search`; `Providers/ExampleCatalog.cs`) were added: the reference for the shape of an external catalogue and the fixture of the integration tests and `tests/e2e/fake-catalogs.js` (C1 has no real external catalogue to test the framework with). They exist only when the operator names an address (`DESIGNTHIX__Catalogs__<id>__BaseUrl`, also in `app.json`), so a production installation never shows them. C2 adds the real ones next to them; they can stay as the reference.
- **The folder catalogue** (a) lists only what the first bytes call a picture, (b) never follows a symbolic link or junction, (c) counts no items per collection (a count would have to read every file), (d) has the item id = the relative path, so a changed file under the same path is not imported again, (e) takes the folder names from the administrator (letters, digits, space, `._-`), nothing else; the compose files carry a commented read-only volume.
- **Credits travel**: an image copied in the file browser keeps its source (`"copy": true`; the unique index `IX_Asset_Source` and the reuse look at imports only), moving an imported image to another area marks it as a copy too, replacing its file drops the source, and the export file of a design (`.dtx.json`, format version stays 2, an additive field `source` per image, cleaned on reading by `DesignPackageFormat.CleanSource`) carries it, so the attribution of CC-BY material reaches the next installation. The credits list only the sources of EXTERNAL catalogues (or of catalogues this installation does not know).
- **Not built, as planned for later**: fonts and icons through `ImportAsync` (`CatalogFetch.FontFiles` and `Font.SourceJson` with its index exist; `ImportAsync` says "Dieser Eintrag ist kein Bild" for anything but a picture; `CatalogImportResult` gets a font and an icon variant in C3), `IconBody`, the icon set switch, "Weitere Schriften ...", the credits in the public view (C2), the KI tools (C3), the README section and screenshot (C3).

**Checked**: `Integration/CatalogTests` (79 tests: registry, defaults and order, browse vs search-only, thumbnails as tokens, cache and both brakes, a provider that is down or over its limit, the key store, settings validation, import (source record, reuse, trash, forbidden licences even by id, content by bytes, quota, access on the target), credits and how they travel, Mitgeliefert, Uploads (own, team, shared), the folder catalogue with a table of 25 path attacks and links, the proxy over HTTP (tampered, shortened, expired, foreign catalogue, foreign host, text file, SVG, signed out), the endpoints and the admin pages, the guarded client (hosts, redirects, size, time, status codes), tokens, licences, the cache cleanup), rows in `PermissionTests` and `AppTests`; `tests/e2e/catalogs-check.js` twice on a fresh database.

**Open points for C2 and C3**: a real catalogue is one class in `Catalogs/Providers/`, one line in `CatalogRegistry`, its host list in `AllowedHosts`, its limits in `Info`; use `ctx.GetTextAsync` for every search (cache and budget are in it), `ctx.Thumb` for every thumbnail, `CatalogLicences` for every item, and the example catalogue as the model. C2 must also decide how the public view shows the credits (a link in its footer, plan section 6). The default of an external catalogue is OFF; `EnabledByDefault` is only true for Mitgeliefert and Uploads. A provider that needs its pictures hotlinked (Unsplash) does not fit and stays out of scope.

---

## C2 status (built)

C2 is built: **Pexels**, **Pixabay** and **Openverse** (`Catalogs/Providers/PexelsCatalog.cs`, `PixabayCatalog.cs`, `OpenverseCatalog.cs`, shared reading helpers in `ProviderSupport.cs`; one line each in `CatalogRegistry`, all off by default, keys in `CatalogSecretStore`), the pause and rate-limit handling of every provider request, the colour filter, the provider notices and rules, the administration pages with rules and key help, and the **Bildnachweise in the public view**. CLAUDE.md "Kataloge (plan 5)" has the files and the rules that hold; `docs/EDITOR.md` "Catalogues in the editor" the scripts.

### What was verified (all on 2026-10-26; where the documentation and the plan differ, the documentation won)

**Pexels** (<https://www.pexels.com/api/documentation/>, <https://www.pexels.com/license/>, the help article <https://help.pexels.com/hc/de-de/articles/900005880463>)
- Base `https://api.pexels.com/v1/`, the key in the header `Authorization: <key>`. `GET /v1/search` (`query`, `orientation` landscape|portrait|square, `size`, `color` = 12 names or a hex code, `locale` de-DE ..., `page`, `per_page` <= 80), `GET /v1/curated`, `GET /v1/photos/:id`, `GET /v1/collections/featured`, `GET /v1/collections/:id?type=photos`. A photo: `id`, `width`, `height`, `url`, `photographer`, `photographer_url`, `alt`, `src` {original, large2x, large, medium, small, portrait, landscape, tiny} (host `images.pexels.com`); lists have `total_results` and `next_page` only when there is one.
- Limits: 200 requests an hour and 20 000 a month by default; the headers `X-Ratelimit-Limit/-Remaining/-Reset` (monthly, the reset is a Unix time) come with 2xx answers only. A higher limit is granted on request. Abuse and working around the limit end the key.
- Rules: a prominent link to Pexels with the results ("Photos provided by Pexels"), credit the photographer when possible ("Photo by John Doe on Pexels", linked), do not copy Pexels' core functions. Terms of service (help article): no standalone sale or distribution, no compiling to build a competing service, no collecting at scale to train ML/AI without permission. Licence: free to use and change, credit "not necessary but always appreciated"; not allowed: unaltered resale, identifiable people in a bad light, implied endorsement, redistribution on other stock sites, use as part of a trademark. The documentation says nothing about caching or hotlinking; the python-pexels FAQ suggests 24 hours.
- **New API keys are paused**: <https://www.pexels.com/api/> says "New API key issuance is currently paused and cannot be requested." (2026-10-26). An existing key works. The owner needs a key from before the pause or must wait. The catalogue is built and tested against the documented shape only.
- Decisions: first page without words = `/v1/curated`; collections = "Kuratiert" and the featured collections (not private, not empty); a search covers all photos (the API cannot search inside a collection); the colour filter passes only the 12 names; the import takes `src.large2x` (about 1 900 px wide: the original can be 25 MB and the library takes 12 MB per file); brakes: 20 searches a person a minute, 200 an hour for the key.

**Pixabay** (<https://pixabay.com/api/docs/>; the licence summary <https://pixabay.com/service/license-summary/> as the search engine shows it, the page itself refuses scripts)
- `GET https://pixabay.com/api/` with `key` in the QUERY (required), `q` (<= 100 characters), `lang` (de ...), `id`, `image_type` all|photo|illustration|vector, `orientation` all|horizontal|vertical, `category` (20 values), `min_width`, `min_height`, `colors` (grayscale, transparent, red, orange, yellow, green, turquoise, blue, lilac, pink, white, gray, black, brown), `editors_choice`, `safesearch`, `order`, `page`, `per_page` 3-200. Answer: `total`, `totalHits` (at most 500 per query), `hits` with `id`, `pageURL`, `type`, `tags`, `previewURL` (150 px), `webformatURL` (640 px, "URL valid for 24 hours"), `largeImageURL` (1 280 px), `imageWidth/Height`, `user`, `user_id`, `userImageURL`; `fullHDURL`, `imageURL`, `vectorURL` only for accounts approved for full API access. The author's page is `https://pixabay.com/users/{name}-{id}/`.
- Limits: 100 requests per 60 seconds per KEY (not per address), headers `X-RateLimit-Limit/-Remaining/-Reset` (seconds to the end of the window); 429 "API rate limit exceeded" (the live answer to a plain request carried `Retry-After: 0`). **Requests must be cached for 24 hours**, no systematic mass downloads. **Hotlinking**: the returned image URLs "may be used for temporarily displaying search results. However, permanent hotlinking ... is not allowed. ... download them to your server first".
- Rules: show where the images come from whenever results are shown. Licence (Content License): free use, no credit required, change allowed; not allowed: selling or distributing content standalone (unchanged), commercial use of recognisable trademarks or logos, immoral or illegal use especially with recognisable people, misleading use, use as part of a trademark.
- Decisions: the key is in every address, so no address of the API is ever logged, shown or put into a message (`CatalogHttp` names the host only), the cache row holds a hash of the address and the answer, never the key; every answer is cached 24 hours; thumbnails are `webformatURL` through the proxy (kept a day on disk: temporary display), the import downloads `fullHDURL` when the key has it, else `largeImageURL`; the brake of the key is 90 a minute; `lang=de`; `safesearch` from the setting; categories are built in with German names, "Empfehlung" = `editors_choice`; "quadratisch" has no Pixabay equivalent (no filter); Pixabay has no titles: the tags are the title; a 400 (what Pixabay answers for an unknown key) is "prüfe den Schlüssel", not "nicht erreichbar".

**Openverse** (<https://api.openverse.org/v1/> and its OpenAPI schema, <https://docs.openverse.org/terms_of_service.html>, and a few real anonymous requests to the public API)
- `GET /v1/images/` with `q` (<= 200), `license` (by, by-nc, by-nc-nd, by-nc-sa, by-nd, by-sa, cc0, nc-sampling+, pdm, sampling+), `license_type` (all, all-cc, **commercial, modification**), `category` (photograph, illustration, digitized_artwork), `aspect_ratio` (tall, wide, square), `size`, `mature`, `filter_dead`, `page`, `page_size`. Verified live: `license_type=commercial,modification` combines as an intersection (adding `license=by-nd,by-nc` found nothing); the results carry `id` (uuid), `title`, `creator`, `creator_url`, `foreign_landing_url`, `license`, `license_version`, `license_url`, `attribution`, `source`, `category`, `width`, `height`, `thumbnail` (= `https://api.openverse.org/v1/images/{id}/thumb/`), `mature`. `GET /v1/images/{id}/thumb/?full_size=true` serves the original through Openverse. Details: `GET /v1/images/{id}/`.
- Anonymous limits (read from the live headers and answers): `x-ratelimit-limit-anon_burst: 20/min`, `anon_sustained: 200/day`, `anon_thumbnail: 1000/day`; `page_size` over 20 and a depth over 240 results are a 400 ("may not exceed ... for anonymous requests"). Registered applications ("slightly higher limits"): `POST /v1/auth_tokens/register/` (name, description, e-mail; the e-mail must be confirmed), then `POST /v1/auth_tokens/token/` (form-encoded `grant_type=client_credentials`, `client_id`, `client_secret`) gives a bearer token. A 429 follows the usual rules.
- Terms: scraping is forbidden; a product built on the API must clearly say it was made with Openverse and that Openverse does not endorse or certify it; works must be attributed properly; Openverse does not verify the licences of its sources.
- Decisions: search only (as planned); `license_type=commercial,modification` in every request AND every item checked again in code (a leaking provider cannot bring an NC or ND picture on screen, and an id of one is refused at the import before a byte is downloaded); default licences CC0, PDM, CC BY, CC BY-SA, narrowed by the administrator's list (the codes are matched by their normalised beginning followed by a version, so "CC-BY" never matches "CC-BY-SA"); pages of 20 and 240 results (the plan's 50 per page does not exist at Openverse); **the only host is `api.openverse.org`**: the pictures of Openverse live on thousands of hosts (Flickr, Wikimedia ...), so neither the thumbnail nor the import ever goes to the host of a result, both go through `/v1/images/{id}/thumb/` (the import with `full_size=true`); the credentials are one field "Client-ID:Client-Secret" (optional; the token is kept in memory and asked for once, with the bearer sent to the thumbnails too); the notice says Openverse does not endorse DesignThix; brakes: 10 searches a person a minute, 40 an hour for all, 18 a minute for the key (the anonymous 200 a day is only enforced by Openverse's own 429 and our pause).

### What else C2 changed

- **The pause**: any provider that answers 429 (or reports nothing left) is left alone until the time it named is over (`Retry-After` seconds or date, else the end of the rate window, else a minute, at most an hour); the person reads "Pexels bremst gerade. Versuch es in 2 Minuten wieder." (`CatalogLimiter.CheckBlock`); searches, imports, thumbnails and token requests all go through `CatalogServices.RequestAsync`. The administration page shows the last rates the provider reported ("noch 18888 von 20000"), and "Testen" ends the pause by asking once. In memory only: a restart forgets it.
- **`CatalogInfo`** has `Notice` (the sentence under the results), `Rules` (the list on the administration page), `KeyLabel`, `KeyHint`, `HasSafeSearch`, `HasLicenceChoice` and `KeyPerMinute`; `ICatalog` has `ThumbsNeedAuth` / `ThumbHeadersAsync` (default methods); `CatalogContext.PostFormAsync` (a POST that is never redirected); `CatalogCaps.Colour`.
- **The colour filter**: a select in the media browser and in the panel Fotos for Pexels and Pixabay; in the panel the format select and the colour select stand side by side.
- **The thumbnail brake** (600 a minute and person) now counts only thumbnails that have to be fetched from the provider; one that is on disk (a day) is free. Every search page issues new tokens, so counting the hits made scrolling back and forth run into the brake.
- **Bildnachweise in the public view**: `credits` in `/api/s/{token}` (only external catalogue images the payload delivers), a footer link and a dialog; not in downloads, the PDF or the print view (the plan asks for the footer only).
- **Registry**: the three providers are listed (off) in `/Admin/Catalogs` next to the example catalogues, which stay as the reference and the fixture.

### Deviations from the plan (the planner can overrule)

- Openverse pages are 20 (anonymous limit), not 30 to 50; Pexels is "search + Kuratiert" and browsable (curated is the first page and a collection); Pixabay's kind filter (photo / illustration / vector) is not in the UI yet (the API call and `CatalogQuery.Kind` have it, a tile does not say which kind it is); Pixabay "quadratisch" is not offered by the provider and is ignored.
- Openverse's `AllowedLicences` uses the codes of `CatalogLicences` (CC0, PDM, CC-BY, CC-BY-SA), not the plan's Iconify-style list.
- The import takes `large2x` (Pexels, about 1 900 px) and `largeImageURL` (Pixabay, 1 280 px; `fullHDURL` with full access), not the original; a setting for the size can follow.
- No real request to Pexels or Pixabay was possible (no keys); their shapes come from the documentation and are tested against fakes. Openverse was checked with a handful of anonymous requests (search, details, thumbnail, schema).

### Checked

`Integration/CatalogProviderTests` (44 tests), `CatalogTests` (79, two changed for the new pause and the new registry), `tests/e2e/catalogs-check.js` (160 checks: the example catalogues of C1, then the three providers through `fake-providers.js`: administration with rules and key help, media browser tabs with collections, colour and format filters, notices and links, imports, a 429 that is waited out, a provider that is down, Openverse without NC and ND and with credentials, the panel Fotos, the credits in the editor and in the public view (1440, 390), every provider on a tablet and a phone); the whole of `run-all.js` twice on a fresh database.

### Open points for C3 and for the owner

- **Keys**: Pexels (<https://www.pexels.com/api/>, new keys are paused today), Pixabay (<https://pixabay.com/api/docs/>, free with an account; the key is shown on that page after signing in; ask Pixabay for full API access for 1 920 px files), Openverse (optional: register an application, confirm the e-mail address, enter "Client-ID:Client-Secret"). Nothing was tried against the real Pexels and Pixabay: the first real search should be done by hand on a test installation ("Testen" on the page of the catalogue).
- Openverse's anonymous limit of 200 requests a day is small for a team; credentials are the way. Its thumbnails (1 000 a day) come from `api.openverse.org`; the disk cache keeps them a day.
- C3: the KI tools `search_catalog` / `import_from_catalog` can use these catalogues as they are (`CatalogLogic.SearchAsync` / `ImportAsync`); Pexels asks that its API is not used to collect photos at scale for ML/AI, so the tools must import single chosen images only (they do through `ImportAsync`). The Pixabay kind filter and an import size setting are small additions.
