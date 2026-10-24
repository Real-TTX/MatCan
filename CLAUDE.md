# DesignThix: notes for working in this repository

An **offline Canva**: designs (labels, cards, signs, posters) are drawn in a WYSIWYG designer and filled from **data lists** through placeholders
(`{{Name}}`), so one design prints many labels (mail merge). ASP.NET Core 10 Razor Pages, EF Core 10 on PostgreSQL 17, one container (port **3043**)
plus a database. User-facing text is **German** ("du"); code, comments and docs (except the README) are English. The infrastructure (setup, sign-in, TOTP,
sessions, list controls, shell, AI layer, PWA, Docker, CI) was ported from `../MatTicket`; the look is MatDesign (`../MatDesign`, MatUi copied into
`src/DesignThix/wwwroot/ui`, version in `scripts/matui-synced.txt`, never edited there). Before changing UI read MatDesign's `CLAUDE.md` and
`docs/ADOPTING.md`. **`docs/PLAN.md` is the build plan and the contract between the phases** (product, document format, architecture, phases A..I); read it
first and change it only when the owner says so.

## Commands

```bash
dotnet build DesignThix.slnx                  # build before a redeploy: a compile error otherwise shows up as "docker compose failed"
dotnet test DesignThix.slnx                   # + DESIGNTHIX_TEST_DB="Host=localhost;Port=3045;Username=designthix;Password=designthix" for the integration tests
./scripts/redeploy.sh  (or .ps1)              # rebuild the image and start the local stack: web 3043, pgAdmin 3044, Postgres 3045; --clean / -Clean empties the volumes
dotnet tool restore                           # once (dotnet-ef)
dotnet ef migrations add <Name> -p src/DesignThix -s src/DesignThix -o Data/Migrations
./scripts/sync-matui.ps1 ; ./scripts/check-matui.ps1   # MatUi from MatDesign (the container of MatDesign on port 8060 serves /ui/matui.zip)
NODE_PATH=tests/e2e/node_modules node tools/icons.js    # PNG icons from the SVGs (phase B)
```

Local stack: `docker-compose.local.yml` (project `designthix-local`, fixed subnet `10.253.43.0/24` because Docker on a PC with many stacks runs out of address
pools). `docker-compose.dev.yml` (`:nightly`, `designthix-dev`) and `docker-compose.yml` (`:latest`, `designthix`) pull from `ghcr.io/real-ttx/designthix`.
No `${...}` variables and no `.env` in any compose file. Environment variables of the app: `DESIGNTHIX_PORT`, `DESIGNTHIX_DATA`, `DESIGNTHIX_TEST_DB`,
`DESIGNTHIX__Database__Host` (and `Port`, `Database`, `Username`, `Password`).

## Layout

- `src/DesignThix.Core` (no web types, unit tested): `Ai/` (`ChatCompletionsClient`, `ChatGptAccount` (device code), `LenientJson`, `AiPresets`), `Security/`
  (`PasswordHasher`, `Totp`), `Text/` (`Slug`, `Pii`), `Media/` (`FileSniffer` by magic bytes, `SvgSafe` allowlist sanitiser, `FontInfo` name table of TTF/OTF/WOFF),
  `Data/` (`Csv` read/write, `ValueFormat` = the number rules of the engine, `ColumnDefs`), `Documents/` (`DesignDocument` records, `DocumentValidator` parse + normalise,
  `Placeholders`, `FormatPresets`).
- `src/DesignThix/Logic`: **the business layer, static classes** taking `Biz` (db, current user, clock, services) as first argument and checking permissions
  themselves (`RequireAdmin` / `RequireDesigner` / `RequireSignedIn`). `ForbiddenException` becomes 403 (middleware), `BizException` is a message at the field.
  Pages never query the database; list pages pass the `IQueryable` the logic returns to `UiKit/ListBuilder`.
- `src/DesignThix/Services`: infrastructure (auth, sessions, 2FA, AI secret store + rate limiter, activity log, database initializer, formatting, `LibrarySeeder` (built-in
  media, fonts and sheet layouts at start-up), `TextDecoder` (UTF-8 or cp1252 CSV files)).
- `src/DesignThix/Endpoints/LibraryEndpoints.cs`: `/media/{key}`, `/fonts/{id}-{hash}.{ext}`, `/fonts.css`, `/api/fonts`, `/api/assets`, `/api/designs/{id}` (GET/POST),
  `/api/designs/{id}/thumbnail`, `/api/designs/{id}/rename`, `/api/designs/{id}/copy` (the document of the designer as a new design: the answer to an edit conflict), `/designs/{id}/thumbnail.png`,
  `/api/datalists` (name + columns, for the designer's data selector), `/api/datalists/{id}/rows` (GET/POST). Everything needs a signed-in person; every POST checks the antiforgery header.
- `src/DesignThix/Endpoints/OutputEndpoints.cs`: `GET /api/outputs/{id}/payload` (what the run page renders: document, labels with copies, sheet, fonts, media addresses, warnings), `POST /api/outputs/adhoc` (the same for a
  single print, from typed values), `POST /api/outputs/{id}/ran` (notes who ran a job and when; does not touch the audit columns). Signed in is enough (a viewer runs outputs); the logic checks again.
- `src/DesignThix/Endpoints/AiEndpoints.cs`: `/api/ai/datalists/{id}/import|fill` (+ `/prompt`), `/api/ai/datalists/{id}/runs`, `/api/ai/designs/{id}/suggest` (+ `/prompt`), `/api/ai/runs/{id}/proposal|apply|discard|undo` (see "AI actions").
- `src/DesignThix/UiKit` (shell, nav, lists, labels, `Ui` helpers, icon sprite) and `Controls` (tag helpers `<dt-card>`, `<dt-input>`, `<dt-tabs>` ...):
  **one code base per control**; several controls of one kind on a page must work (ids come from a prefix).
- `src/DesignThix/Pages`: `Assets` (gallery + table, upload, edit with tabs), `Fonts`, `DataLists` (edit with tabs Allgemein / Spalten / Zeilen / Import/Export), `Sheets`
  (live SVG preview), `Designs` (gallery, create, properties with Felder and Verlauf, Einzeldruck `Print`, `Import`), `Outputs` (list, create/edit with four tabs, the run pages `Run` and `RunAdhoc`), the Start dashboard, `Account` (setup, login, 2FA, profile, security),
  `Admin` (Users, Ai: settings, profiles, runs; Activity, System), `About`
  (reached through the version at the bottom of the menu), `Offline`, `Error`, `Shared` (layouts and partials: `_Layout`, `_Bare`, `_Head`, `_Menu`,
  `_Toolbar`, `_Table`, `_Pager`, `_LinkTabs`, `_ListPage`, menu switcher, `_Print` = layout of the run page, `_Designer`).
- `wwwroot`: `css/app.css` (the few `dt-` styles), `css/datalist.css` and `css/designs.css` (linked by the pages that need them), `js/app.js` (shell glue, offline banner,
  service worker registration), `js/admin.js` (AI profile page), `js/ai.js` + `css/ai.css` (the AI dialogs of the data list and the designer), `js/library.js` (font specimens, sheet preview, column editor), `js/datalist.js` (the row grid),
  `js/designs.js` (thumbnails drawn with the engine), `js/output.js` + `css/output.css` (the run page: print/PDF and PNG-ZIP, see "Output"), `js/outputs.js` (the forms of outputs and of the single print), `js/designer*.js` + `css/designer.css` (the designer, see below), `js/dt-engine.js` (the renderer, `DtEngine`), `sw.js` (the `dt-library` cache: hashed font/media/thumbnail addresses cache first,
  `/fonts.css`, `/api/fonts`, unhashed media and the payload of an output network first), `manifest.webmanifest`, `builtin/` (flags and seals + `builtin.json`), `fonts/` (OFL fonts + `fonts.json` + `LICENSES/`),
  `ui/` (MatUi), logos and `img/` (`img/dt-icons.svg`: the tool icons of the designer, symbols `dt-i-*`, generated by `node tools/dt-icons.js` from MatDesign's Lucide library; the licence note stays in the file).
- `tests/DesignThix.Tests` (xunit): Core tests, logic tests, integration tests against PostgreSQL (`DESIGNTHIX_TEST_DB`; without it they return at once).
  `tests/e2e`: browser checks with Playwright and the installed Edge (not run by `dotnet test`).

## Rules of the domain

- Roles: **Admin** (everything, incl. users, AI, settings), **Designer** ("Gestalter": designs, media, fonts, data lists, sheets, outputs), **Viewer**
  ("Betrachter": looks, runs outputs, changes nothing). The first user (setup assistant) is an Admin. Page policies `Admin`, `Designer`, `SignedIn` in `Program.cs`;
  every logic method checks again.
- Database: tables and columns PascalCase, `Id` bigint, `CreateDate/CreateUserId/UpdateDate/UpdateUserId` filled by `DtDbContext`, `UpdateState` soft delete
  (0 deleted, 1 created, 2 updated), enums as text, `*Json` properties are `jsonb`, a key that acts as a secret is a separate `Token` (uuid).
- UI: CRUD = list page + create/edit page (delete on the edit page); every list has a toolbar above it, the pager directly below the table, list actions below;
  buttons in one row: Save, Back, space, Delete; pages with several areas use tabs; hide what does not apply (`data-show-if`).
- **No inline styles, no inline scripts, no event-handler attributes** (CSP `style-src 'self'; script-src 'self'`; images may be `data:`/`blob:`, fonts `data:`).
  Data values go to the DOM through the CSSOM (`el.style.setProperty`) or SVG attributes. **Never `innerHTML` with user data.** CSS classes of the app start with `dt-`.
- AI: one JSON object per answer (`LenientJson`), required field per action, at most two nudges then `Stuck`; limits before the call; tokens estimated (chars/4) when
  missing; changes go into `AiJournalEntry` and can be undone newest first. Secrets only in `{data}/secrets/ai` (`AiSecretStore`), never in the database or a page.
  Actions: **Test**, **DataImport**, **DataFill**, **TextSuggest** (phase G, see "AI actions" below).
- Library: an **asset key** is lower case (`^[a-z0-9][a-z0-9_-]{0,63}$`), unique among the records that are not deleted, and is what designs (`{ "asset": "flag-de" }`) and image cells of
  data lists hold; matching is case-insensitive. Uploads are sniffed by their bytes (never the name); an SVG goes through `SvgSafe` (cleaned: script, foreignObject, `on*`, external or
  `javascript:` references, unsafe `style`; refused: DTD/entities, > 2 MB, nesting > 100) and is stored in its cleaned form; `/media` adds a CSP (`default-src 'none'`) and `nosniff`.
  Built-ins (`builtin.json`, `fonts.json`, six sheet layouts) are seeded by `LibrarySeeder` and remembered by `BuiltInKey` (also when renamed or deleted softly), so a deleted built-in
  stays deleted. A soft delete lets go of the bytes. Fonts: `/fonts.css` has one `@font-face` per font (`font-display: block`, weight range for variable fonts); font and media addresses
  carry a hash and are immutable. The `fonts.css` link is only in the head of signed-in pages.
- Revisions: `Design.Revision` and `DataList.Revision` are concurrency tokens. A save carries the revision it started from; a stale one is a `RevisionConflictException` (HTTP 409 with the
  current `revision`). `POST /api/designs/{id}` validates and normalises the document with `DocumentValidator` (the engine's `normalize` is the reference; a test compares them), bumps
  the revision and writes a `DesignRevision` (the newest 30 stay). The data list grid saves ALL rows in one POST in their order (rows left out are deleted, `Position` = index).
  CSV export writes `;`, UTF-8 BOM, the column keys as header plus `_Kopien` and `_Aktiv` (no key can start with an underscore); the import maps each CSV column to a column, `@new`, `@copies`, `@active` or nothing.
- Accent (light blue, slightly green) `#1fb3d6`, dark text on it (`--mat-app-on-accent`), links `#0a7590`; the turquoise-to-blue gradient is only for logos.

## The designer (phase F)

`/Designs/{id}/Designer` (`Pages/Designs/Designer.cshtml`, layout `_Designer`: no menu, no page scroll) is only a frame; the scripts do the rest. Files in `wwwroot/js`, loaded in this order after `dt-engine.js`:
- `designer.core.js`: helpers (`D.el/svg` DOM builders, `D.icon`, geometry with rotation, API requests), font index, and **`D.createApp`: the state and every command** (`app.doc` = the normalised document, selection,
  undo/redo, `edit`/`tx`, add/delete/duplicate/paste/nudge/order/align/distribute/lock/hide/rename, fields, `computeValues` for the preview row, asset lookup). Panels and canvas only call these.
- `designer.canvas.js`: the engine drawing (`renderInto`, `mode: 'editor'`, an `idPrefix` per render, one render in flight plus one queued), the overlay `<svg>` (selection, 8 handles, rotate handle, marquee, guides, size badge),
  pointer gestures (move, resize, rotate, marquee, pan, pinch), hit testing, snapping, zoom, inline text editing (a `<textarea>` positioned through the CSSOM), dropping media. `D.canvas.whenIdle()` is for the browser checks.
- `designer.props.js` (right panel), `designer.panels.js` (left panel: Elemente, Medien, Felder, Ebenen), `designer.js` (boot, top bar, zoom bar, keyboard + clipboard events, save/draft/offline, data preview, drawers, phone).

How it behaves (keep these when changing it):
- **Changes**: `app.edit(mutator, {merge, render, structure})` is one undo step (a `merge` key coalesces typing and nudging for about a second). A gesture uses `app.tx().apply(...)`: the first change pushes ONE undo step. The document is changed
  live during a drag, but the engine is not run: a move only gives the element's `<g>` a transform (`render: 'none'`), a rotation sets its `rotate()`, a resize re-renders once per frame (`'soon'`); on release the engine draws again.
  Events: `doc {reason, render, structure}`, `selection`, `history`, `preview`, `state`, `zoom`, `warnings`. `structure: true` rebuilds the layers and the properties, otherwise the controls only refresh (an input with focus is never overwritten).
- **Coordinates**: the document unit everywhere; the overlay is in CSS pixels of the sheet (`app.scale()` = px per unit at the current zoom). The sheet and the engine's `<svg>` are sized by CSS (`width: 100%`): zoom changes the size of the box, not the drawing (vector, crisp).
- **Hit testing** uses the geometry (rotation undone), topmost first, skips hidden, locked and not drawn elements (an element the engine did not draw has no `<g data-el-id>`); an unfilled rectangle or ellipse only reacts on its outline.
- **Snapping**: page edges and centre, edges and centres of the other elements, threshold 6 screen px (10 on touch), Alt switches it off, guides are drawn in the overlay.
- **Touch**: `touch-action: none` on the canvas; one finger on an element drags it, on the page it pans, two fingers pinch and pan; a second tap on a text opens the editor. Media tiles are dragged with pointer events (capture on pointer down: a quick flick still ends on the tile).
- **Preview values**: `app.computeValues()` = the samples, over them the row of the chosen data list; a field that is a column of the list takes the cell (empty = empty), a field without a column keeps its sample.
- **Saving**: `POST /api/designs/{id}` with the revision it started from (`app.baseRevision`); 409 opens a dialog (Als Kopie speichern: `/copy`, then the new design opens; Neu laden). After a save the thumbnail is rasterised (`maxWidth: 480`, sample values) and posted.
  The draft is in `localStorage` `dt-draft-<id>` ({revision, document, time}, written 0.9 s after a change, removed after a save and on sign-out); the chosen preview list/row in `dt-preview-<id>`. Offline: the state says so, the save waits for `online`.
- **Roles / sizes**: a viewer (`canEdit=false`) gets the same page with everything disabled (`.is-readonly`); below 768 px the designer is a preview (`app.readOnly`, engine `mode: 'output'`, hint to the properties page);
  below 1024 px the panels are drawers (`#dt-toggle-left/right`); from 1024 px all three columns.
- **Icons**: `D.icon(name)` takes `mat-i-*` from the toolkit sprite when it has the name, else `dt-i-*`; in Razor `Ui.Icon(...)` (toolkit) and `Ui.ToolIcon(...)` (app sprite).
- **Fonts**: the family select lists the `/api/fonts` families, each `<option>` in its own font through a class (`D.fontClass`, a rule inserted into an adopted style sheet: no inline style); the weights offered are the ones of the family (variable: steps of 100).
- Browser check: `node tests/e2e/designer-check.js [base url]` (about 150 checks incl. screenshots to `docs/images/designer-*.png`; accounts in `tests/e2e/test-account.json`, git-ignored, created on an empty database by the setup assistant).
  `tests/e2e/demo-label.js` is the demo label of PLAN 1.2 as a document (and its data rows).

## Output (phase H)

The browser is the only renderer, so the server never draws a label: it hands the browser a **payload** and the browser renders it with `DtEngine` (the same code as the designer).
- **Entity / logic**: `OutputJob` (columns added by migration `Output`: `Scale` fit|none, `StartPosition` 1-based first cell of the first sheet, `FileNamePattern`; `CropMarks`, `Dpi`, `RowSelection`,
  `SelectedRowIdsJson`, `Copies`, `Mode`, `Format`, `LastRunDate/UserId` existed). `OutputLogic` (static): `Query` (left joins: a deleted design/list/user is null, not a vanished row), `SaveAsync` (checks everything and
  drops what does not apply: no list = samples and selection All, PNG = single and no sheet fields, label count <= `OutputPlan.MaxLabels` 2000), `PayloadAsync`, `AdhocPayloadAsync`, `MarkRanAsync` (`ExecuteUpdate`, so a run is no
  change of the job), `LabelCountsAsync`. Designers write; every signed-in person reads, runs and uses the single print. The sums (rows to labels, sheets, cell of a label, fit scale) are `Core/Output/OutputPlan`; `output.js`
  and `outputs.js` repeat them for the live count and the placement (the tests keep both honest).
- **Payload** (`OutputLogic.OutputPayload`): the document, `labels` = `[{ rowId, copies, values }]` (copies = copies of the row x copies of the job, expanded by the script; values = the samples of the design with the cells of the
  list over them, for the fields the design uses), `sheet`, `fonts` (the faces of the families the texts use), `assets` (lower-case key to `/media/key?v=hash`, only keys the design and the rows use), `warnings` (missing media,
  fonts, columns, an empty selection). The page never trusts a key: an unknown one draws nothing and is listed.
- **Run page** (`Pages/Outputs/Run` for `/Outputs/{id}/Run`, `RunAdhoc` for `/Outputs/Run?design=&adhoc=token`, layout `_Print`, `js/output.js`): `data-state` (loading, rendering, ready, error), `data-labels`, `data-pages` for the checks.
  Print mode puts every label in mm on a page (`.dt-opage`; sizes and places are custom properties set with `style.setProperty`, which the CSP allows) and inserts the paper size as an `@page` rule into `output.css` through the
  CSSOM (`insertRule`; a `<style>` element would be blocked). Single: one page per label at the design size; sheet: cell by cell from the start position, a design larger than the cell is shrunk (`fit`) or left (`none`) and a warning
  says so, crop marks are one SVG path per sheet below the labels. Entries (rows) are drawn three at a time, copies are clones with new clip-path ids, results are put on the page **in label order**, the loop yields to the browser
  (message channel, a paint now and then). PNG mode: `rasterize` per row, `zip`, an object URL on `<a download>`, names from the pattern (`{Design}`, `{Nr}` padded to the width of the total, `{Kopie}`, field keys; characters a file
  system dislikes become `-`, trailing `-_. ` are cut). The run is noted after `window.print()` returned / `afterprint` / a click on the download.
- **Einzeldruck** (`/Designs/{id}/Print`, `outputs.js`): the form is made of the fields (image fields: key + the picker of the data list grid, `DtDataListGrid.pickMedia`), a live preview, copies, mode/sheet/start/crop/scale, DPI for PNG.
  "Drucken" / "PNG" keep the request in `sessionStorage` (`dt-adhoc-<token>`) and open `/Outputs/Run?design=&adhoc=token`, which posts it to `/api/outputs/adhoc`. Nothing is saved.
- **Export / import** (`Core/Documents/DesignPackage.cs` = `DesignPackageFormat` read/write/rewrite keys, `Logic/DesignPackageLogic`): `.dtx.json` = `{ format: "designthix-design", version: 1, name, category, description, document,
  assets: [{ key, name, category, contentType, base64 }], fonts: [{ family, weight, style, format, base64 }] }`, only the media the document uses and the fonts of those families that are not built in. Import (designers, <= 50 MB)
  checks like an upload (`DocumentValidator`, `AssetLogic.Prepare` = `FileSniffer` + `SvgSafe`, font sniffing) and refuses the whole file when one part is bad. A key that exists with the same content (hash of the cleaned or of the
  raw bytes) is reused, a key with other content comes in as `key-2`, `key-3` ... and the document is rewritten; a font is reused when the file is there, a face that exists with other content is not added (warning).
- Browser check: `node tests/e2e/output-check.js [base url] [--out folder]` (about 110 checks, screenshots to the temp folder, never into `docs/images`); shared helpers in `tests/e2e/lib.js` (also used by `designer-check.js`).

## AI actions (phase G)

The AI layer of phase A (`AiLogic.RunAsync`, one JSON object per answer, limits before the call, nudges, steps, journal) now has the DesignThix actions. **The boundary is in code**: the model proposes, `Core/Ai/AiOutputs.cs`
checks (pure functions, unit tested with hostile answers), the run stores the CHECKED proposal, the person applies it, the journal takes it back.
- **Files**: `Core/Ai/AiOutputs.cs` (`AiText.Clean/ForColumn`, `ImageAllowlist`, `DataImportCheck`, `DataFillCheck`, `TextSuggestCheck`), `Logic/AiLogic.cs` (run, limits, transport, undo, runs of a subject, "Weitermachen"),
  `Logic/AiDataLogic.cs` (import + fill: prepare, propose, proposal, apply, discard, revert), `Logic/AiTextLogic.cs` (text suggestions), `Logic/AiInstructions.cs` (the layers and the fixed part per action),
  `Endpoints/AiEndpoints.cs` (thin; policy `SignedIn`, the logic refuses a viewer with 403, antiforgery on every POST), `wwwroot/js/ai.js` + `css/ai.css` (all dialogs; model text only through `textContent`),
  `datalist.js` (the two grid buttons), `designer.props.js` (`aiSuggestButton`), `Services/Ai/AiTestSeam.cs`.
- **Instruction layers** (`AiInstructions.SystemText`): operator (config file) + operator addition per action, base instruction of the site (empty = built-in), **addition of the site per action** (`AiSettings.ActionInstructions`, edited on
  the settings page), the person's instruction for this step, the FIXED part (answer format, rules; nobody edits it), then the situation as the user message. `AiLogic.Compose/Show` build the text once: the run sends it and the
  endpoints `.../import/prompt`, `.../fill/prompt`, `.../suggest/prompt` return exactly it without calling the model ("Vollständige Anweisung anzeigen" in the dialogs); the run's first Message step stores it.
- **Flow of the data actions**: `ProposeImportAsync` / `ProposeFillAsync` -> `RunAsync` -> check -> `run.ResultJson` = the checked proposal (`kind` import|fill, columns, rows or values with old/new, warnings, notes, for fill the list `revision`),
  `run.Status = Waiting` (or Done when nothing is left) -> `GET /api/ai/runs/{id}/proposal` (own run, admin: any) -> `POST /api/ai/runs/{id}/apply` with only `include` (import: indexes of the proposed rows, fill: row ids) ->
  rows written from the STORED proposal, journal `AiJournalEntry(DataRow, id, "Zeile" | column key, old, new)`, list revision + 1, run Done. A fill is refused with `RevisionConflictException` (409) when the list changed since the proposal;
  an import only appends (capacity checked). `discard` ends a waiting proposal as Cancelled. The page never sends values to be written.
- **What the model sees** (decided by the code): import = columns (key, label, type), for every image column the allowed media (category of the column, else all; at most 300 keys + names), the pasted text (<= 60 000 chars) and the hint;
  fill = the target column, the rows of the SELECTION (<= 200, saved rows only) with only the context columns the person ticked (default: the text columns) and the current value; suggest = the text, the box size, field keys/labels/samples
  (<= 100, keys validated). A list with `ContainsPersonalData` is refused (`Call.Refusal`: the run is Cancelled with the reason, the model is not called, no data is written to the steps) unless `AiSettings.SendPersonalData`.
- **Validation rules** (`AiText`): a value is cleaned (script/`javascript:`/event handler/iframe/svg/style refused with a reason, other HTML tags stripped with a note, control + bidi + zero-width characters removed, line breaks only in
  multiline), length refused (not cut) above 500 (text), 2000 (multiline), 40 (number/price), 80 (image); number/price parse with `ValueFormat` (price written with its decimals), |n| <= 1e12; image only from the allowlist (written as the key is
  spelled); unknown keys dropped and named (a label is accepted as a key); <= 500 rows; fill: row ids must be among the selected ones, once each, empty answers change nothing; suggestions: <= 5, exactly the placeholders of the original
  (as a set, case-insensitive), no duplicates, not the original.
- **Roles**: Designer+ for every action (viewer: no buttons, endpoints 403, logic `RequireDesigner`). Admin: settings, profiles, the run list/details (`/Admin/Ai/Runs`, with subject links), `Weitermachen`. A **designer sees their own runs**
  of a data list in the panel "Letzte KI-Läufe" (Import/Export tab: "Vorschlag ansehen", "Rückgängig"); an administrator sees all. Undo: own runs (admin: any), newest first (`NewerRunAsync`), a value changed by hand since is left alone and said so.
- **Limits** (`RunAsync`, before the call): per minute per address, per user per day (`UserDailyTokens`) and month (`UserMonthlyTokens`), all users per month, runs per address per day (daily hash). Tokens come from the provider or are
  estimated (chars / 4, `TokensEstimated`). `AiRun.RequestJson` keeps the request so `Weitermachen` (admin, details page) can run it again as a new run; a proposal of another person is opened through its link `...?aiRun=<id>` (own runs only).
- **Test seam**: `AiTestSeam` (singleton, registered only by `AppTests.AppFactory`): `Handler = (AiRequest, ct) => Task<AiResponse>` replaces the transport (profile/relay/network); `Requests` records what was sent. Tests reset it
  (`ResetAsync` in `Integration/AiTests.cs`: no brake, no budget) and set `AiSettings` through `SettingLogic.SaveAsync`. Production never registers it.
- **Browser check**: `node tests/e2e/ai-check.js [base] [--fake-host 127.0.0.1] [--fake-port 3066] [--out folder]` starts a fake OpenAI-compatible server (`/v1/models`, `/v1/chat/completions`, answers depend on the task named in the
  fixed part of the instruction) and configures it as a profile through the admin UI; the Docker app reaches it at `http://host.docker.internal:3066/v1` (verified); with `dotnet run` on 3053 pass `--fake-host 127.0.0.1`.
  It raises the address limits in the settings first (the check makes many calls) and restores them, and deletes its profile at the end.

## Gotchas

- AI: a model answer is read leniently (`LenientJson`: fences, chatter, trailing commas), so `GetRawText()` of the element is NOT valid JSON: store `JsonSerializer.Serialize(element)` (jsonb refuses trailing commas). The prompt text uses
  `AppendLine`, i.e. CRLF when the app runs on Windows (`dotnet run`), LF in the container: a fake model must normalise before matching. Browsers: a `mat-table` becomes cards below 720 px, so the preview tables of `ai.js` use their own
  `dt-ai-table` (scrolls sideways inside its frame). A toast cannot hold buttons: `DtAi.undoToast` appends one to the last `.mat-toast` (call it AFTER closing a dialog, toasts move into an open dialog).

- EF Core: a list that projects to a record with a positional constructor cannot be sorted afterwards (`LINQ expression ... could not be translated`): the row types (`AssetRow`, `FontRow`,
  `DesignRow`, `DataListRow`) are records with `init` properties, filled with an object initialiser. A search inside a `jsonb` column needs `FromSqlInterpolated(... "Col"::text ILIKE {pattern})`;
  the global soft-delete filter still applies to it.
- Razor: `asp-route-id="@Model.Id"` with a null id renders an empty route value, the link cannot be built and the form gets `action=""` (the post then reaches no handler and the page
  just renders again). On pages with an optional id leave `asp-route-id` out: the ambient route value is used. A page whose tabs post to different handlers calls `ModelState.Clear()` in
  the handlers that do not post `Input` (else the summary shows errors of another tab). A `<dt-buttons delete-url="@(cond ? null : ...)">` with null shows no delete button.
- Browser checks: a switch (`dt-switch`) is clicked through its `.mat-switch` label (the track covers the checkbox). The local database holds an administrator with two-factor sign-in
  (`gerd@example.com` the designer and `bea@example.com` the viewer have none: use them; their rights equal the administrator's for the library).
- A `perl -pi` that inserts German quotes must read its script as UTF-8 (`use utf8`), else the text is stored double encoded; shell heredocs with German text failed half way here:
  use the editor tools for source files.

- Designer: a `<select>` option cannot carry a font through an inline style, so each option gets a class (`dt-ff-N`) from `D.fontClass`. Playwright: after `app.select([...])` wait two frames before reading the overlay (it is drawn in `requestAnimationFrame`), and use
  `D.canvas.whenIdle()` after every change before reading the drawing. Browser logs a 409/403 of a deliberate request as a console error: the check filters exactly those.
- Designer: `pointerdown` on a dragged tile must `setPointerCapture` at once; capturing only after the first move loses a fast drag. A text edit must keep the focus when a panel button inserts a placeholder (`data-keep-edit` + `pointerdown`/`mousedown` preventDefault).
- Razor: a variable named `section` clashes with the directive; collection initialisers inside tag-helper attributes do not compile (use a variable).
- `@page` route templates: braces are doubled (`{{0,59}}`) but brackets are not. A literal `{{Name}}` in Razor text is fine.
- Forms with an explicit `action` need `asp-antiforgery="true"`; edit forms that post to other handlers need `asp-page-handler=""` on the form.
- MatUi caps `svg` at `max-width: 100%`. The icon names for `Ui.Icon(...)` must exist in `ui/matui-icons.svg` (a name that is not there draws nothing; `printer` is NOT one of them: it is `Ui.ToolIcon("printer")`, and a menu item takes `dt:printer`, see `Ui.NavIcon`); the app's own
  icons are `dt-i-*` in `img/dt-icons.svg` (`Ui.ToolIcon(...)`; `IconSprite` merges the file into the inline sprite, so its first `>` must be the one of the `<svg>` tag: the licence comment goes after it).
- The service worker precaches the logo files one by one, so a missing file does not stop the installation.
- The embedded browser of the Claude app cannot register service workers; test the PWA with Playwright and Edge.
- The MatDesign dev container on port 8060 may serve an older MatUi than the copy here; compare `wwwroot/ui/matui.manifest.json` before syncing.
- Output: Playwright's `page.pdf()` prints with the **print** media unless `page.emulateMedia({ media: 'screen' })` was called before (then the PDF is made with the screen CSS and has extra pages): reset with `media: null`.
  A PDF of the browser has plain objects, so a check counts `/Type /Page` and reads the `/MediaBox` (points; 1 mm = 72 / 25.4).
- Output: `@page` must be inserted through `CSSStyleSheet.insertRule` into a style sheet that came from a file (`css/output.css`); the CSP forbids a `<style>` element. A label is placed with `--dt-x/--dt-y/--dt-w/--dt-h`
  custom properties set by script. Labels are put into the DOM in label order, not in the order the engine finishes (the first `.dt-olabel` is label 1).
- Output: a field hidden by `data-show-if` has its inputs disabled and posts nothing, so the server gets the defaults (no `Dpi` = the design's, no `SheetLayoutId`); the logic ignores sheet fields for PNG anyway. A radio group inside a hidden
  dependent still has its checked value for the script, so the script reads `Input.Format` before it trusts `Input.Mode`.
- Fast browser checks without Docker: stop nothing, run `dotnet run --project src/DesignThix --no-launch-profile` with `DESIGNTHIX_PORT=3053`, `DESIGNTHIX_DATA=<temp folder>` and the `DESIGNTHIX__Database__*` variables of the local stack
  (Postgres on 3045); static files come from `wwwroot` of the source, so a script change needs no rebuild (a page change does: stop the app first, the build cannot overwrite a running `DesignThix.exe`).

## Git

Branches: `main` (release), `dev` (nightly). Commit and push **under the owner's name only**: never a `Co-Authored-By` trailer, never a "Generated with" line, no other
names in branches. Versions: release `<major>.<minor>.<build>-<date>`, dev `nightly-<build>-<date>`, local `local-<date>` (`Directory.Build.props`, set by the action).
