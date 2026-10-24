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
  `/api/designs/{id}/thumbnail`, `/designs/{id}/thumbnail.png`, `/api/datalists/{id}/rows` (GET/POST). Everything needs a signed-in person; every POST checks the antiforgery header.
- `src/DesignThix/UiKit` (shell, nav, lists, labels, `Ui` helpers, icon sprite) and `Controls` (tag helpers `<dt-card>`, `<dt-input>`, `<dt-tabs>` ...):
  **one code base per control**; several controls of one kind on a page must work (ids come from a prefix).
- `src/DesignThix/Pages`: `Assets` (gallery + table, upload, edit with tabs), `Fonts`, `DataLists` (edit with tabs Allgemein / Spalten / Zeilen / Import/Export), `Sheets`
  (live SVG preview), `Designs` (gallery, create, properties with Felder and Verlauf), the Start dashboard, `Account` (setup, login, 2FA, profile, security),
  `Admin` (Users, Ai: settings, profiles, runs; Activity, System), `About`
  (reached through the version at the bottom of the menu), `Offline`, `Error`, `Shared` (layouts and partials: `_Layout`, `_Bare`, `_Head`, `_Menu`,
  `_Toolbar`, `_Table`, `_Pager`, `_LinkTabs`, `_ListPage`, menu switcher).
- `wwwroot`: `css/app.css` (the few `dt-` styles), `css/datalist.css` and `css/designs.css` (linked by the pages that need them), `js/app.js` (shell glue, offline banner,
  service worker registration), `js/admin.js` (AI profile page), `js/library.js` (font specimens, sheet preview, column editor), `js/datalist.js` (the row grid),
  `js/designs.js` (thumbnails drawn with the engine), `js/dt-engine.js` (the renderer, `DtEngine`), `sw.js` (the `dt-library` cache: hashed font/media/thumbnail addresses cache first,
  `/fonts.css`, `/api/fonts` and unhashed media network first), `manifest.webmanifest`, `builtin/` (flags and seals + `builtin.json`), `fonts/` (OFL fonts + `fonts.json` + `LICENSES/`),
  `ui/` (MatUi), logos and `img/`.
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
  Only the **Test** action exists so far; the DesignThix actions (data import, data fill, text suggestion) come in phase G.
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

## Gotchas

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

- Razor: a variable named `section` clashes with the directive; collection initialisers inside tag-helper attributes do not compile (use a variable).
- `@page` route templates: braces are doubled (`{{0,59}}`) but brackets are not. A literal `{{Name}}` in Razor text is fine.
- Forms with an explicit `action` need `asp-antiforgery="true"`; edit forms that post to other handlers need `asp-page-handler=""` on the form.
- MatUi caps `svg` at `max-width: 100%`. The icon names for `Ui.Icon(...)` must exist in `ui/matui-icons.svg` (or in the app sprite `img/dt-icons.svg`, which the
  designer phase adds; `IconSprite` merges it when present): check a new name there, an unknown one draws nothing.
- The service worker precaches the logo files one by one, so a missing file does not stop the installation.
- The embedded browser of the Claude app cannot register service workers; test the PWA with Playwright and Edge.
- The MatDesign dev container on port 8060 may serve an older MatUi than the copy here; compare `wwwroot/ui/matui.manifest.json` before syncing.

## Git

Branches: `main` (release), `dev` (nightly). Commit and push **under the owner's name only**: never a `Co-Authored-By` trailer, never a "Generated with" line, no other
names in branches. Versions: release `<major>.<minor>.<build>-<date>`, dev `nightly-<build>-<date>`, local `local-<date>` (`Directory.Build.props`, set by the action).
