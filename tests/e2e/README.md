# Browser checks (tests/e2e)

Real-browser checks with [Playwright](https://playwright.dev) and the installed **Microsoft Edge** (headless; falls back to Playwright's Chromium).
They are not part of `dotnet test`. A stack must be running (`./scripts/redeploy.ps1 -Clean` gives a clean one on <http://localhost:3043>; for a clean run without wiping the local stack see "A clean run" below).

```bash
cd tests/e2e
npm install            # once
node run-all.js [base url]          # all checks one after the other, one summary line each; exit code 0 = all green
```

`run-all.js http://localhost:3043 --only pwa,designer` runs a selection (`engine`, `pwa`, `demo`, `home`, `templates`, `designer`, `canva`, `content`, `output`, `ai`; the order of the full run), `--quiet` prints only failures, `--fake-host h` / `--fake-port p` go to the AI check. A full run takes about ten minutes.

| Check | Run with | What it checks |
|---|---|---|
| `engine/engine-check.js` | `node engine/engine-check.js` | The render engine (`dt-engine.js`) on its own test page, no app needed: placeholders, price format, shrink to fit, image strip, standalone SVG, PNG size at 300 dpi, ZIP writer. Uses the bundled fonts. |
| `pwa-check.js` | `node pwa-check.js [base]` | Manifest and icons, service worker, iOS meta tags, theme colour light/dark = background of the app, `viewport-fit=cover` and safe areas, 16 px fields on touch screens (no zoom on focus, pinch zoom stays), offline (copy of a page, banner, offline page), clean return without stale content, signing out empties the kept pages. |
| `designer-check.js` | `node designer-check.js [base] [--out folder]` | The mechanics of the editor: pointer and keyboard, snapping, undo, layers, fields and the preview with a data list, autosave, drafts and offline, the edit conflict, viewer (read-only), the demo label, tablet and phone. |
| `canva-check.js` | `node canva-check.js [base] [--out folder]` | The Canva-style editor: one-click create, rail and panels, the contextual toolbar, the context menu (also long press), paste and drop of images and fonts, the media browser (also for strip slots), pages, groups, autosave, 409, Herunterladen (PNG, ZIP), viewer, tablet, drawer and phone. Helpers in `editor-lib.js`. |
| `content-check.js` | `node content-check.js [base] [--out folder] [--only elements,text,...]` | The editor content: the panel Elemente (sections, search, icons in batches, German words), Schriftkombinationen, the toolbar of every kind, Effekte and Anpassen, masks, crop mode (also rotated), the colour picker with gradients and pipette, Marke, Vorlagen, Größe ändern, the media browser in the data list grid and the single print, viewer, phone. |
| `output-check.js` | `node output-check.js [base] [--out folder]` | Output jobs: print pages and sheets (PDF page sizes), crop marks, start position, PNG-ZIP, single print, design export/import, 200 labels. |
| `ai-check.js` | `node ai-check.js [base] [--fake-host h] [--fake-port 3066]` | The AI actions against a fake OpenAI-compatible server (`fake-ai.js`) that the script starts: import, fill, text suggestions, undo, limits, errors. With the app in Docker the fake server is reached at `host.docker.internal`; with `dotnet run` pass `--fake-host 127.0.0.1`. |
| `demo-check.js` | `node demo-check.js [base]` | The demo of a new installation: the six labels drawn by the engine, ink of every element measured (nothing touches, the name keeps its margin, the price keeps clear of the euro sign, the logo words sit next to each other) and the seeded records (template, list, output job runs). |
| `home-check.js` | `node home-check.js [base] [--out folder]` | The start page and the navigation: heading, search, the eleven format tiles (one click creates the design of that size and opens the designer, "Eigene Größe"), the dialog "Design erstellen", the menu with the group "Serien (Zusatz)", titles and breadcrumbs, the row of templates, search over designs and templates, rename/duplicate/delete of a recent design, the viewer (no tiles, disabled buttons, API 403), the phone. Deletes what it creates. |
| `templates-check.js` | `node templates-check.js [base] [--out folder]` | The gallery "Vorlagen": the ten templates grouped by category, thumbnails drawn lazily, search and category filter, "Vorlage verwenden" (a copy), "Bearbeiten", and that every page of every template draws without an engine warning (medium, icon, font, code). |
| `screens.js` | `node screens.js [base] [--out ../../docs/images] [--no-ai]` | Takes the screenshots of the README (start, templates, the editor with its panels, context menu, media browser, download dialog, text effects, phone, and the Serien pages). **Run it on a clean database, before the other checks**: they leave test data behind, and the screenshots show the demo and the templates only. It deletes the copy of a template that it makes. |

A clean run (without `redeploy -Clean`, which wipes the local stack's database)

1. Back up `test-account.json` (the checks write it for the database they ran on), or better point `DT_ACCOUNT_FILE` at a file in the temp folder (`lib.js` and `screens.js` use it instead; needed when two runs go side by side).
2. Start the app from source on port 3053 against a NEW database of the local Postgres (it creates the database itself): `DESIGNTHIX_PORT=3053 DESIGNTHIX_DATA=<temp folder> DESIGNTHIX__Database__Host=localhost DESIGNTHIX__Database__Port=3045 DESIGNTHIX__Database__Database=designthix_k6_x DESIGNTHIX__Database__Username=designthix DESIGNTHIX__Database__Password=designthix dotnet run --project src/DesignThix --no-launch-profile --artifacts-path <temp folder>`.
3. `node screens.js http://localhost:3053`, then `node run-all.js http://localhost:3053 --fake-host 127.0.0.1` - twice: the checks clean up after themselves or use names of their own, so a second run on the same database is green too.
4. Stop the app, `DROP DATABASE designthix_k6_x WITH (FORCE)` (through `docker exec designthix-local-db-1 psql -U designthix -d postgres`), restore `test-account.json`.

Notes

- **Accounts.** The checks need an administrator, a designer and a viewer. On an empty database the setup assistant makes `admin@example.com`, who makes
  `designer@example.com` and `viewer@example.com`; the three are written to `test-account.json` (git-ignored; it holds the accounts of ONE database, a check on an empty database replaces it). With an existing database put the accounts into that file
  (an administrator with two-factor sign-in cannot be used).
- **One source for the demo.** `demo-label.js` reads `src/DesignThix/Demo/kaesetheke.json`, the same file the app embeds and seeds into an empty database.
- **Console errors and CSP violations** (a `securitypolicyviolation` listener is installed in every page) are part of each result.
- **Screenshots** of the checks go to the temp folder, never to `docs/images` (only `screens.js` writes there).
- `lib.js` has the helpers all checks share (browser, sign-in, accounts, console watcher).
