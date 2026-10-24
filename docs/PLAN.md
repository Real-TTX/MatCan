# DesignThix – build plan

DesignThix is an **offline Canva**: designs (labels, cards, signs, posters) are drawn in a WYSIWYG designer and filled from **data lists** through
**placeholders**, so one design prints many labels (mail merge). Reference result: `Image-2026-10-24-150234.png` (a cheese counter price label,
moved to `docs/images/demo-label.png` in phase A).

This file is the contract between the phases. Every phase reads it first, follows it, and changes it only where the phase owner (the planner) says so.

---

## 0. Ground rules (all phases)

- **Template repository: `../MatTicket`.** It is the newest app of the family with the same stack (ASP.NET Core 10 Razor Pages, EF Core 10, PostgreSQL 17,
  MatUi, PWA, AI layer, Docker, GitHub Actions). Port its infrastructure; never invent a second way of doing something it already does.
- **Design: `../MatDesign`.** Read `../MatDesign/CLAUDE.md` and `../MatDesign/docs/ADOPTING.md` before building UI. MatUi is copied into
  `src/DesignThix/wwwroot/ui` and never edited there. Check a pattern against the rulebook (MatDesign `RuleBook.cs`) before inventing one.
  The designer itself is a special UI (allowed by the owner's guideline) but uses MatUi tokens, controls, icons and the flat look.
- **Language:** UI text is **German**, the user is addressed with **"du"**. Code, identifiers, comments and docs except `README.md` are English.
- **C# rules:** Razor Pages; Microsoft C# coding guidelines; human-readable names; no needless nesting (early returns); **business layer = static classes**
  in `src/DesignThix/Logic` taking `Biz` as first argument; **no database queries in models (entities) or UI (pages)**; **every logic method checks the
  permission itself** (`biz.RequireDesigner()` etc.), even if the page already did.
- **Database:** tables and columns PascalCase, no exceptions; `Id` bigint primary key; every table has `CreateDate`, `CreateUserId`, `UpdateDate`,
  `UpdateUserId` (filled by `DtDbContext`); soft delete with `UpdateState` (0 deleted, 1 created, 2 updated) where it makes sense; a key that acts
  as a secret is a separate `Token` (uuid) column. Enums stored as text, `*Json` properties are `jsonb`.
- **UI rules (owner):** CRUD = list page + create/edit page (delete on the edit page). Every list has a toolbar above it (search, filter, sort),
  pagination directly below the table, list actions below, left-aligned, positive → negative, delete actions with extra space. Buttons in one row:
  Save, Back, ‹space›, Delete. Icons where they help. One code base per control (UiKit partials: table, toolbar, pager, tabs, form fields); several
  controls of the same kind on one page must work (ids derived from a prefix). Hide form parts that do not apply (`data-show-if`). Pages with several areas
  use **tabs**. Space between tiles/cards. **The About page is reached through the version number at the bottom left of the menu.**
- **No inline styles, no inline scripts, no event-handler attributes** (CSP `style-src 'self'; script-src 'self'`). Values that are data are set by
  script through the CSSOM (`el.style.setProperty`, `sheet.insertRule`) or as SVG attributes. CSS classes of the app start with `dt-`.
- **Never use `innerHTML` with user data** (names, document JSON, data list values). Build DOM with `createElement`/`createElementNS`, `textContent`,
  `setAttribute`.
- **Ports:** web **3043**, pgAdmin **3044**, Postgres (local stack only) **3045**. Local stack subnet `10.253.43.0/24`.
- **Names:** solution `DesignThix.slnx`; projects `src/DesignThix` (web, namespace `DesignThix`), `src/DesignThix.Core` (no web types, namespace
  `DesignThix.Core`), `tests/DesignThix.Tests`, browser checks `tests/e2e`. Db context `DtDbContext`. Env vars `DESIGNTHIX_PORT`, `DESIGNTHIX_DATA`,
  `DESIGNTHIX_TEST_DB`. Image `ghcr.io/real-ttx/designthix`. `data-app="designthix"`.
- **Accent (light blue, slightly green):** in `wwwroot/css/app.css`:
  `[data-app="designthix"] { --mat-app-accent: #1fb3d6; --mat-app-on-accent: #04212b; --mat-app-accent-text: #0a7590; }`
  (dark text on the accent 6.7:1, links 5.3:1 on white – white on the accent would only be 2.5:1, so on-accent is dark).
- **Logo:** gradient from turquoise (`#18d4c0`) to blue (`#2f86f6`). Logos are identity: the gradient is allowed there, nowhere else in the UI.
- **Git:** do **not** commit in the phases; the planner commits after reviewing each phase, under the owner's name only (no co-author trailer, no
  "generated with" line, no other names in branches).
- **Done means verified:** `dotnet build DesignThix.slnx` with 0 errors and no new warnings, `dotnet test` green, the local stack rebuilt with
  `./scripts/redeploy.ps1` and the changed pages opened in a real browser (Playwright with the installed Edge, see the `screenshots` skill; look at a
  screenshot, at 1280 px and at 390 px). Report what was verified and what was not.

---

## 1. Product

### 1.1 Concepts

| Concept (German UI) | Entity | What it is |
|---|---|---|
| Design | `Design` | A page of a fixed size with elements (text, images, image strip, shapes). Its document is JSON (§2). Can be marked as **Vorlage** (template) and is then offered in "Neues Design". |
| Felder / Platzhalter | inside the document | The fields a design uses: `{{Name}}` in a text, or an image bound to a field. Each has key, label, type and a sample value. |
| Datenliste | `DataList`, `DataRow` | A table of values (columns by key) – e.g. "Käsetheke Herbst" with one row per cheese. Columns can be taken from a design. CSV import/export, paste from Excel, AI import. |
| Medien | `Asset` | Uploaded images (PNG, JPEG, WebP, GIF, SVG) with a unique **key** (`flag-de`, `bio`, `logo-kaeseschneider`) and a category (Flaggen, Siegel, Icons, Logos, Fotos, Hintergründe, Sonstiges). A data list cell of an image field holds an asset key. Built-in flags and icons are seeded. |
| Schriften | `Font` | Font files (TTF, OTF, WOFF, WOFF2), served by the app. Built-in OFL fonts are seeded; more can be uploaded. Nothing is loaded from the internet. |
| Druckbogen | `SheetLayout` | How labels sit on a sheet of paper (A4 with 2×4 labels, margins, gaps, crop marks). |
| Ausgabe | `OutputJob` | A saved batch run: design + data list (+ selected rows, copies) + mode (one label per page or on a sheet) + format (print/PDF or PNG-ZIP). "Ausführen" renders it. |

### 1.2 The demo (must be reproducible in the app)

The reference label is the built-in template **"Käsetheke – Preisschild"** (150 × 100 mm) with the data list **"Käsetheke (Beispiel)"**:
- top left an **image strip**: slot 1 = field `Land` (country flag), slots 2–4 = fields `Icon1`..`Icon3` (seals: Schwangerschaft geeignet, g.t.S.,
  Bio …). Empty slots collapse; the others move left.
- top right a logo made of text elements ("Der" script, "KÄSE" orange + "SCHNEIDER" navy condensed, "KÄSE FÜR GENIESSER" spaced sans) – or field `Logo`.
- `Ort` (script, centred), `Name` (big script, centred, **shrinks to fit**), `Region` (script, centred).
- label/value rows: "GEREIFT:" `Gereift`, "FETT i. TR.:" `Fett`, "MILCH-ART:" `Milchart` (sans labels, handwritten values, dotted lines under the values;
  a row is hidden when its value is empty).
- price `Preis` (huge script, field type price → "2,99"), "€", `Einheit` ("/ 100 g").
- a thin border.
We do not ship third-party trademarks (Bioland, the EU g.t.S. seal): the demo uses our own generic seals; the user uploads the real ones.

### 1.3 Roles

`Admin` (everything incl. users, AI, settings), `Designer` ("Gestalter": designs, media, fonts, data lists, sheets, outputs), `Viewer` ("Betrachter":
sees designs and data lists, runs outputs, cannot change anything). The first user (setup assistant) is an Admin. Checks: `Biz.RequireAdmin()`,
`Biz.RequireDesigner()` (Admin or Designer), `Biz.RequireSignedIn()`.

### 1.4 Menu (final state; each phase adds its items)

Main menu "Gestalten" (`NavSet` id `main`):
- **Neues Design** (primary action, SHELL-19) → `/Designs/Create`
- Start `/` (recent designs, recent outputs, counts, quick actions)
- Group *Gestalten*: Designs `/Designs`, Vorlagen `/Designs?filter=templates`
- Group *Daten*: Datenlisten `/DataLists`
- Group *Bibliothek*: Medien `/Assets`, Schriften `/Fonts`
- Group *Ausgabe*: Ausgaben `/Outputs`, Druckbögen `/Sheets`

Menu "Verwaltung" (`NavSet` id `admin`, Admin only): Benutzer, KI (Einstellungen, Profile, Läufe), Aktivitäten, System.
User menu (foot): Profil, Sicherheit, Abmelden. Version at the bottom left → `/About`.

---

## 2. The design document (contract between server and engine)

Stored in `Design.DocumentJson` (jsonb). The server parses it into C# records (`DesignThix.Core.Documents`), validates, **normalises (unknown
properties dropped, values clamped) and re-serialises** before saving. The browser renders it with `wwwroot/js/dt-engine.js`.

```jsonc
{
  "schema": 1,
  "unit": "mm",              // "mm" | "px" – the unit of every coordinate and length below (font sizes are always pt)
  "width": 150, "height": 100,
  "dpi": 300,                // raster export resolution (72..1200)
  "locale": "de-DE",         // number formatting of number/price fields
  "background": { "color": "#ffffff", "asset": null, "fit": "cover" },   // asset = asset key or null; fit cover|contain|fill
  "fields": [
    { "key": "Name", "label": "Name", "type": "text", "sample": "Holunderblüte" },
    { "key": "Preis", "label": "Preis", "type": "price", "sample": "2.99", "decimals": 2 },
    { "key": "Land", "label": "Herkunftsland", "type": "image", "sample": "flag-de", "category": "Flaggen" }
  ],
  "elements": [ /* drawn in order: first = bottom */ ]
}
```

Field: `key` matches `^[A-Za-z][A-Za-z0-9_]{0,39}$` and is unique case-insensitively; `label` ≤ 80; `type` ∈ `text | multiline | number | price | image`;
`sample` ≤ 2000; `decimals` 0..4 (number/price; null = as typed for number); `category` (image: suggested asset category in pickers); `required` bool.

Common element properties: `id` (string ≤ 24, unique), `type`, `name` (≤ 80, shown in the layers panel), `x`, `y`, `w`, `h` (unit, `w`,`h` ≥ 0),
`rotation` (deg, −360..360, around the centre), `opacity` (0..1), `locked` (bool), `hidden` (bool, editor visibility AND output), `showIf`
(field key or null: drawn only when that field's value is not empty).

| type | properties |
|---|---|
| `text` | `text` (≤ 5000, may contain `{{Key}}` tokens and `\n`), `fontFamily`, `fontSize` (pt, 1..1000), `fontWeight` (100..900), `italic`, `color` (#rrggbb), `align` left\|center\|right, `valign` top\|middle\|bottom, `lineHeight` (0.5..3, default 1.2), `letterSpacing` (em, −0.5..2), `uppercase`, `wrap` (bool, default true), `fit` none\|shrink (shrink: largest size ≤ fontSize that fits the box, not below `minFontSize`, default 4 pt) |
| `image` | `source` = `{ "asset": "flag-de" }` or `{ "field": "Land" }`, `fit` contain\|cover\|fill, `radius` (unit) |
| `imageStrip` | `items`: list (≤ 12) of `{ "asset": … }` / `{ "field": … }`; `gap` (unit), `align` left\|center\|right. Each image is `h` high and as wide as its aspect ratio; empty items are skipped; if the row is wider than `w` everything scales down uniformly. |
| `shape` | `shape` rect\|ellipse\|line, `fill` (#rrggbb or null), `stroke` (#rrggbb or null), `strokeWidth` (pt), `dash` solid\|dashed\|dotted, `radius` (unit, rect). A line goes from (x, y) to (x+w, y+h). |

Placeholders: `{{Key}}` (whitespace inside the braces allowed, key matched case-insensitively to fields and to data list columns). Value formatting
by field type: `price` → number with `decimals` (default 2) in `locale` ("2,99"); `number` → `decimals` if set; `text`/`multiline` as is; values
of a data list are strings (a price may be typed "2,99" or "2.99"). An unknown key renders empty; the editor shows a warning list.
Image resolution: the value is an asset key; matching is case-insensitive; an unknown key renders nothing (editor: dashed placeholder with the field label).

Limits: ≤ 500 elements, ≤ 100 fields, JSON ≤ 2 MB. The C# side owns these limits; the engine tolerates anything (defaults for missing values).

---

## 3. Architecture

```
src/DesignThix.Core          no web types, unit tested
  Documents/                 DesignDocument records, DocumentValidator (parse, normalise, limits), Placeholders (extract keys, render text), FormatPresets
  Data/                      Csv (read with delimiter detection ; , tab, quotes, BOM; write), ValueFormat (price/number parsing+formatting, same rules as the engine)
  Media/                     FileSniffer (PNG/JPEG/GIF/WebP/SVG/TTF/OTF/WOFF/WOFF2 by magic bytes, image dimensions from headers), SvgSafe (allowlist sanitiser, DTD prohibited)
  Ai/                        ChatCompletionsClient, ChatGptAccount, LenientJson, AiTypes, AiPresets (ported from MatTicket)
  Security/                  PasswordHasher, Totp (ported)
  Text/                      TextTools, Slug
src/DesignThix
  Configuration/ Data/ (DtDbContext, entities, migrations) Logic/ (static business classes + Biz) Services/ UiKit/ Controls/ Pages/ wwwroot/
  wwwroot/js/app.js          shell glue, offline banner, small page behaviours
  wwwroot/js/dt-engine.js    THE renderer (document + values → SVG / PNG / ZIP); used by designer, previews, thumbnails, print and export
  wwwroot/js/designer.js     the editor
  wwwroot/js/output.js       print and PNG export pages
  wwwroot/js/datalist.js     the row grid of a data list
  wwwroot/builtin/           flags/, icons/ (SVG) + builtin.json (seeded as assets)
  wwwroot/fonts/             bundled OFL fonts + LICENSES/ + fonts.json (seeded as fonts)
  wwwroot/ui/                MatUi (copied, never edited)
```

Server endpoints (besides Razor Pages): `/health`, `/robots.txt`, `/llms.txt`, `/manifest.webmanifest`, `/sw.js`, `/api/theme`,
`GET /media/{key}` (asset bytes; `ETag` = content hash, `Cache-Control: private, max-age=31536000, immutable` when requested with `?v=<hash>`;
SVG served with `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'` and `nosniff`), `GET /fonts/{id}-{hash}.{ext}`,
`GET /fonts.css` (all @font-face rules, versioned), `GET /api/fonts` (family, weight range, style, url), `GET /api/assets?q=&category=` (picker),
`GET/POST /api/designs/{id}` (load / save with revision), `POST /api/designs/{id}/thumbnail`, `GET /api/datalists/{id}/rows` …
All POSTs carry the antiforgery token (`RequestVerificationToken` header).

Rendering strategy: **the browser is the only renderer** (one engine, identical on screen and in print). PDF = the print page with exact `@page`
sizes and the browser's "Als PDF speichern" (vector, fonts embedded by the browser). PNG = SVG with embedded fonts/images rasterised on a canvas
at the document DPI, many files zipped client-side (store-only ZIP writer in the engine, no dependency).

Offline (PWA): app shell, MatUi, fonts, engine, built-in media cached by the service worker; pages network-first with cached fallback
(read-only offline); the designer keeps an **unsaved draft in localStorage** per design and revision, saves when the connection is back, and
detects conflicts through `Design.Revision` (HTTP 409 → dialog: keep mine as copy / load theirs).

---

## 4. Phases

### Round 1 (parallel)

**A – Foundation** (owns everything except the files of B, C, D)
- Scaffold from MatTicket: `Directory.Build.props` (DesignThixMajor 0, Minor 1; channels release/nightly/local), `global.json`, `dotnet-tools.json`,
  `.editorconfig`, `.gitattributes`, `.gitignore`, `.dockerignore`, `DesignThix.slnx`, `Dockerfile` (ASP.NET Core base image, port 3043, `/data`
  volume, healthcheck), `docker-compose.yml` (release, `:latest`, stack `designthix`), `docker-compose.dev.yml` (`:nightly`, stack `designthix-dev`,
  pgAdmin 3044), `docker-compose.local.yml` (build, stack `designthix-local`, pgAdmin 3044, Postgres 3045, subnet 10.253.43.0/24); no `${…}`
  variables, no `.env`; services `web`, `db`, `pgadmin`, volumes `web-data`, `db-data`, `pgadmin-data`. `.github/workflows/build.yml` (build, test
  against Postgres, multi-arch image, tags per channel). `scripts/redeploy.ps1|.sh`, `scripts/sync-matui.ps1`, `scripts/check-matui.ps1`.
- MatUi: run `scripts/sync-matui.ps1` against `http://localhost:8060/ui/matui.zip` (MatDesign dev container) with the MatDesign HEAD commit; if that
  fails, copy `../MatTicket/src/MatTicket/wwwroot/ui` (without `mt-icons.svg`) and copy its `matui-synced.txt`.
- Port from MatTicket and rename (`MatTicket`→`DesignThix`, `MtDbContext`→`DtDbContext`, `mt-`→`dt-`, `matticket`→`designthix`): configuration,
  data protection, `AuditedEntity`/`UpdateState`, users + sessions + setup assistant + login + logout + 2FA (TOTP) + profile + security, activity log,
  System settings page, UiKit (Shell, Nav, Lists, ListBuilder, Labels, Ui, IconSprite, Controls) and its partials, `_Layout`, `_Bare`, `_Head`,
  `_Menu`, `_Toolbar`, `_Pager`, `_Table`, `_LinkTabs`, About, Offline, Error, robots.txt, llms.txt (describe DesignThix), health check, theme API,
  PWA (manifest, `sw.js`, offline banner in `app.js`), CSP (add `font-src 'self' data:` and keep `img-src 'self' data: blob:`).
  **AI layer**: port it generically (Core/Ai, `AiSecretStore`, rate limiter, ChatGPT device-code login, `AiProfileLogic`, `AiInstructions`, runs + steps +
  journal entities, Admin/Ai pages) with only the **Test** action; DesignThix actions come in phase G. Drop everything ticket-specific: tickets,
  forms, portal, CRM, sync, Entra, mail, categories, departments, teams, questions, maps.
- Roles `Admin`, `Designer`, `Viewer` (German labels Administrator, Gestalter, Betrachter); `Biz.RequireAdmin/RequireDesigner/RequireSignedIn`.
- Logo files are made by B; reference them by these names: `wwwroot/logo.svg` (mark + word mark), `wwwroot/logo-mark.svg`, `wwwroot/favicon.svg`,
  `wwwroot/img/favicon-32.png`, `img/apple-touch-icon.png`, `img/icon-192.png`, `img/icon-512.png`, `img/icon-maskable-192.png`,
  `img/icon-maskable-512.png`, `img/og-image.png`. If they do not exist yet, the build must still work.
- `Index` (Start) as a simple dashboard shell; menu with only the items that exist.
- Move `Image-2026-10-24-150234.png` to `docs/images/demo-label.png` (git mv is not needed: the repo has no commit yet).
- `CLAUDE.md` for this repo (like MatTicket's: commands, layout, rules of the domain, gotchas, git) and a first German `README.md`.
- Initial EF migration. Stack runs; setup assistant creates the admin; login, profile, 2FA, users admin, AI admin pages work.

**B – Logo and icons** (owns only: `src/DesignThix/wwwroot/logo.svg`, `logo-mark.svg`, `logo-wordmark.svg`, `favicon.svg`, `img/*`, `tools/icons.js`,
`tests/e2e/package.json` + `package-lock.json`, `docs/LOGO.md`)
- A mark that says "design + placeholders": e.g. a label/price tag with a punched hole whose face carries curly braces `{ }` or a layered sheet;
  gradient turquoise `#18d4c0` → blue `#2f86f6`. Levels of detail: full logo (mark + word mark "DesignThix"), mark alone, favicon (16/32 px:
  silhouette, no thin detail), maskable icon (mark on a full-bleed gradient or white background inside the safe zone 80 %), apple-touch-icon (no
  transparency), og-image 1200×630. Word mark as outlined paths or a system font stack that renders the same everywhere (prefer paths).
- `tools/icons.js` renders the PNGs from the SVGs with Playwright (installed Edge, like `../MatTicket/tools/icons.js`).
- Look at every result at its real size (screenshots) and at 16 px before keeping it. `docs/LOGO.md` explains the levels and colours.

**C – Built-in content** (owns only `src/DesignThix/wwwroot/builtin/**`, `src/DesignThix/wwwroot/fonts/**`, `tools/builtin.js` if needed)
- Fonts (SIL OFL, from `github.com/google/fonts`, TTF; variable fonts allowed): Montserrat, Bebas Neue, Oswald, Kaushan Script, Caveat,
  Playfair Display, Lora, Open Sans, Roboto Slab, Pacifico, Permanent Marker, Source Sans 3 (latin + latin-ext glyphs must include äöüß€).
  Each family's `OFL.txt` in `fonts/LICENSES/<Family>.txt`. `fonts/fonts.json`: `[{ "family", "file", "weight": "400" | "100 900", "style":
  "normal"|"italic", "license": "OFL-1.1", "source": url }]`.
- Flags (public domain designs, own clean SVGs, 3:2 unless the flag needs another ratio; viewBox exact, no external refs): de, at, ch, fr, it, nl,
  be, lu, es, pt, gb, ie, dk, se, no, fi, pl, cz, hu, gr, eu, us. Keys `flag-<iso>`; names German ("Deutschland").
- Generic icons/seals (own drawings, one consistent style: round badge, line icon, 2 colours max; no trademarks): vegetarisch, vegan, bio
  (generic leaf, NOT the EU logo), laktosefrei, glutenfrei, regional, rohmilch, heumilch, schwangerschaft (pregnant silhouette with a check, like
  the demo), neu, angebot, handgemacht, gereift, ohne-gentechnik-generic (named "Gentechnikfrei"). Keys `icon-<name>`.
- `builtin/builtin.json`: `[{ "key", "name", "category": "Flaggen"|"Siegel"|"Icons", "file", "tags": [..] }]`.
- Every SVG must pass a strict allowlist (no script, no foreignObject, no `on*`, no external href, no `<style>` with `@import`) – the same rules
  as `SvgSafe` in phase E. Make a contact sheet (HTML in the scratchpad, screenshot) and look at all of them before keeping them.

**D – Render engine** (owns only `src/DesignThix/wwwroot/js/dt-engine.js` and `tests/e2e/engine/**`)
- Plain JS, no dependency, no build step, `'use strict'`, exposes `window.DtEngine`:
  `normalize(doc)`, `fieldsUsed(doc)`, `formatValue(field, raw, locale)`, `resolveText(text, fields, values, locale)`,
  `render(doc, values, opts) → Promise<SVGSVGElement>`, `renderInto(container, doc, values, opts)`,
  `toStandaloneSvg(doc, values, opts) → Promise<string>` (fonts and images embedded as data URIs),
  `rasterize(doc, values, { dpi, scale }) → Promise<Blob>` (PNG), `zip([{ name, blob }]) → Promise<Blob>` (store-only ZIP with CRC32),
  `layoutText(...)` (exported for tests), `ptToUnit`, `unitToPx`.
- `opts`: `assetUrl(key) → url|null`, `fonts: [{ family, weight, style, url }]` (for loading and embedding), `mode: 'editor'|'output'`
  (editor draws dashed placeholders for empty image fields and keeps `data-el-id` on each element group), `missing: 'empty'|'token'`.
- Text: wait for `document.fonts.load(...)` of every used face; measure with a canvas 2D context in the same font; wrap words (break long
  words), honour `\n`, `letterSpacing`, `uppercase`; lines as `<tspan>` with explicit `x`/`y`; baseline from `fontBoundingBoxAscent/Descent`;
  `align`/`valign` inside the box; `fit: shrink` = binary search for the largest size (step 0.25 pt) that fits width and height. Rotation around the centre.
- Images: `<image>` with `preserveAspectRatio` (contain = meet, cover = slice + clipPath, fill = none), `radius` via clipPath; natural size of each
  image loaded once and cached (image strip needs aspect ratios).
- Shapes: rect/ellipse/line; dashed = `3w,2w`, dotted = `0,2w` with round caps (w = stroke width in units).
- Only DOM APIs (`createElementNS`, `setAttribute`, `textContent`): no `innerHTML` with document data. Unique ids per render (clipPaths) via a prefix,
  so several renders on one page never collide.
- Tests: `tests/e2e/engine/engine.html` + `engine-check.js` (Playwright, Edge) loading the engine and asserting: placeholder substitution, price
  formatting (de-DE), shrink-to-fit result smaller than the box, image strip collapses empty slots, standalone SVG contains no external URL, PNG has
  the expected pixel size at 300 dpi, ZIP opens (check the local file headers / central directory with a small parser in the test). Uses system
  fonts plus one TTF from `../MatTicket` or a font found on the system, not the phase C fonts (they may not exist yet).

### Round 2

**E – Library, data and design records** (after A and C)
- Entities + migration: `Asset` (Key unique among not-deleted, Name, Category, Tags, ContentType, Extension, Width, Height, Bytes `bytea`,
  ContentHash, SizeBytes, IsBuiltIn, UpdateState), `Font` (Family, Weight (text "400" or "100 900"), Style, Format, Bytes, ContentHash, IsBuiltIn,
  License, UpdateState), `DataList` (Name, Description, ColumnsJson, ContainsPersonalData, UpdateState), `DataRow` (DataListId, Position,
  ValuesJson, Copies 1..999, IsActive), `Design` (Name, Category, Description, IsTemplate, DocumentJson, Revision, ThumbnailPng `bytea`,
  ThumbnailHash, UpdateState), `DesignRevision` (DesignId, Revision, DocumentJson; keep the newest 30), `SheetLayout` (Name, PaperWidth, PaperHeight,
  MarginTop, MarginLeft, Columns, Rows, CellWidth, CellHeight, GapX, GapY, CropMarks, IsBuiltIn, UpdateState), `OutputJob` (Name, DesignId,
  DataListId?, RowSelection (`all` | `active` | `selected`), SelectedRowIdsJson, Copies, Mode (`single`|`sheet`), SheetLayoutId?, Format
  (`print`|`png`), Dpi, CropMarks, LastRunDate, LastRunUserId, UpdateState).
- Core: `FileSniffer`, `SvgSafe` (XmlReader with DtdProcessing.Prohibit; allowlist of SVG elements/attributes; `href` only `#id` or `data:image/(png|jpeg|gif|webp)`;
  no `<script>`, `<foreignObject>`, `on*`, `style` containing `url(` to anything but `#`, `@import`, `javascript:`; output re-serialised), `Csv`,
  `ValueFormat`, `DesignDocument` + `DocumentValidator` + `Placeholders`, `FormatPresets` (A4/A5/A6 portrait+landscape, DIN lang, business card
  85×55, label 150×100, 100×70, 70×50, 58×40, shelf strip 100×30, square 100×100, Instagram 1080×1080 px, story 1080×1920 px, poster A3, custom).
  Unit tests for all of them (hostile SVG corpus!).
- Seeding at start-up (idempotent, by key/file): built-in assets from `wwwroot/builtin/builtin.json`, fonts from `wwwroot/fonts/fonts.json`, sheet
  layouts (A4 2×4 99.1×67.7, A4 3×8 70×37, A4 2×2 A6 148.5×105 landscape, A4 1×1, A4 2×5 105×57 business cards, A4 3×7 70×42.3).
- Endpoints `/media/{key}`, `/fonts/...`, `/fonts.css`, `/api/fonts`, `/api/assets`.
- Pages (CRUD, owner's UI rules): **Medien** (gallery list with thumbnail tiles + table view, toolbar search/filter category/sort; upload page with
  `mat-upload` multi-file; edit page: preview, key, name, category, tags, replace file, delete; built-ins can be edited and deleted (soft)).
  **Schriften** (list with a specimen line rendered in the font, upload, edit, delete). **Datenlisten** (list; edit page with tabs *Allgemein*,
  *Spalten* (key, label, type; "Spalten aus Design übernehmen"), *Zeilen* (grid editor `datalist.js`: inputs per cell, image cells as an asset
  picker with thumbnails, add/duplicate/delete/move rows, copies, active; saves as one POST with a revision check), *Import/Export* (CSV upload
  with preview and column mapping, paste from Excel, CSV export with `;` and UTF-8 BOM)). **Druckbögen** (list; edit with a live SVG preview of the
  sheet). **Designs** list (gallery of thumbnails, filter: all / templates / category, sort: changed, name) + **Create** (name, format preset or custom
  size and unit, or "aus Vorlage" picker; creates the record and opens the designer) + **Eigenschaften** edit page with tabs *Allgemein*
  (name, category with suggestions, description, Vorlage switch), *Felder* (read-only list of fields + where they are used), *Verlauf* (revisions,
  restore), buttons Speichern, Im Designer öffnen, Duplizieren, Zurück, ‹space›, Löschen. Designer itself is phase F (link may 404 until then).
- Dashboard: recent designs (thumbnails), counts, quick actions.

### Round 3

**F – Designer** (after D and E)
- Page `/Designs/{id}/Designer` with layout `_Designer` (MatUi shell header kept minimal: back, name, undo/redo, zoom, preview data, save state,
  Ausgabe button; no page scroll). Left panel tabs: *Elemente* (Text, Überschrift, Rechteck, Ellipse, Linie, Bild, Bildleiste), *Medien* (asset
  browser with search + category, click or drag to add), *Felder* (add/edit fields, insert `{{Key}}` into the selected text, sample values, bind
  the selected image/strip slot), *Ebenen* (order by drag, lock, hide, rename). Right panel: properties of the selection (position/size/rotation in
  the document unit, font family picker with live preview, size, weight, italic, colour (+ brand colours from settings), alignment, line height,
  letter spacing, uppercase, fit, showIf; image source asset/field and fit; strip items; shape fill/stroke/dash/radius); nothing selected → document
  (format preset, size, unit, DPI, background colour/asset, locale).
- Canvas: engine render (`mode: 'editor'`) in a scaled SVG; overlay for selection, 8 resize handles + rotate handle, marquee multi-select,
  shift-click, move/resize/rotate with pointer events (mouse, pen, touch), snapping to page edges/centre and other elements' edges/centres with
  visible guides (Alt disables), arrow keys nudge (Shift = 10×), Del, Ctrl+Z/Y, Ctrl+C/V/D, Ctrl+A, Ctrl+S, Ctrl+G not needed. Align/distribute for
  multi-selection. Zoom: fit, 25–800 %, Ctrl+wheel, pinch; pan with space+drag / middle mouse / two fingers. Double-click a text → inline text edit
  (textarea overlay). Undo stack of document snapshots (100).
- Preview with data: choose a data list and step through its rows (◀ ▶), or edit field sample values; warnings for unknown placeholders and
  unknown asset keys.
- Save: `POST /api/designs/{id}` with `{ revision, document }` → server validates + normalises, bumps `Revision`, writes `DesignRevision`; 409 on a
  stale revision (dialog: als Kopie speichern / neu laden). After save the editor rasterises a thumbnail (max 480 px wide) and posts it. Autosave of the
  unsaved draft to localStorage (restore offer on open), "unsaved" indicator, `beforeunload` guard. Offline: saving waits and retries on `online`.
- Icons for tools: from the MatUi sprite where it has them, else from MatDesign's icon library (`../MatDesign/src/MatUi/wwwroot/iconlib/` or
  `tools/iconlib/lucide.json`) into the app sprite `wwwroot/img/dt-icons.svg` (`dt-i-*`).
- Viewer role: designer opens read-only (no save, panels disabled).
- Check at 1280 px and on a tablet (1024×768 touch); on a phone (390 px) the designer shows the preview and a hint that editing needs a larger screen.

### Round 4

**H – Output** (after F)
- **Ausgaben** CRUD (list + edit with tabs *Allgemein* (name, design, data list), *Auswahl* (all/active/selected rows with a selectable table,
  copies), *Layout* (mode single/sheet, sheet layout, crop marks, scale), *Format* (print/PDF or PNG-ZIP, DPI)); buttons Speichern, Ausführen,
  Zurück, ‹space›, Löschen.
- Run page `/Outputs/{id}/Run` (layout `_Print`): renders every label with the engine; `@page` size set through the CSSOM; single mode: one page per
  label of the design size; sheet mode: labels placed in mm on sheets, crop marks optional, a label larger than the cell is scaled to fit (warning);
  a progress bar while rendering, then "Drucken / Als PDF speichern" (`window.print()`); PNG mode renders each label with `rasterize` and offers
  one ZIP (`<design>-<n>-<Name>.png`). Records `LastRunDate`.
- **Einzeldruck** on the design: a form with the design's fields (image fields as asset pickers) → print or PNG without saving a job.
- Design export/import (`.dtx.json`: document + used assets and fonts base64) on the design page.

### Round 5

**G – AI actions** (after H)
- Actions: `DataImport` (free text or a pasted table → new rows of a data list; values only for known columns; image columns only accept existing
  asset keys (allowlist; otherwise empty + warning); journal: added rows → undo deletes them), `DataFill` (fill one column for the selected rows
  from an instruction; journal: old values → undo restores), `TextSuggest` (designer: up to 5 alternatives for the selected text element; nothing
  changes until the user picks one), `Test`.
- Data lists with `ContainsPersonalData` are refused unless the admin switch "Personenbezogene Daten an die KI senden" is on.
- Everything else as the owner's AI guideline and MatTicket: layered instructions with "Vollständige Anweisung anzeigen", run log with steps and a
  final status (Weitermachen where it makes sense), at most two nudges, limits per user/day/month and per-address brake (daily hashed address),
  tokens counted or estimated chars/4, generous limits (16 000 tokens, 280 s), parameter fallbacks, retries with backoff, empty answer = error.
  Privacy note on the AI settings page (EU provider recommended, third-country transfer for US/China providers).

### Round 6

**I – Demo, quality, docs** (after G)
- Built-in template "Käsetheke – Preisschild" + data list "Käsetheke (Beispiel)" (6 cheeses incl. Holunderblüte from the reference) seeded on an
  empty database (only once; deleting them is respected). Compare a screenshot of the rendered demo with `docs/images/demo-label.png`.
- Squash the migrations into one `Initial` (nothing is deployed yet).
- Tests: Core unit tests complete; integration tests against Postgres (`DESIGNTHIX_TEST_DB`) for the logic incl. permission checks per role;
  `tests/e2e`: `pwa-check.js`, `designer-check.js` (create design, add text with a placeholder, save, reload, preview with data), `output-check.js`
  (sheet print page renders N labels; PNG ZIP has N files), `engine-check.js`.
- `README.md` (German, screenshots in `docs/images` via `tests/e2e/screens.js`), `CLAUDE.md` up to date, `docs/PLAN.md` marked done.
- Final review pass (bugs, security: SVG, uploads, permissions, CSP, antiforgery), PWA on iOS/Android emulation (safe areas, status bar colour).
