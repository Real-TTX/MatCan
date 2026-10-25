# DesignThix – plan 2: a real Canva

The owner after the first version (2026-10-25): *"Das ist noch gar nicht so wie Canva. Was ist mit Elementen? Context-Menü mit Rechtsklick.
Bei der Bildleiste habe ich keinen guten Image-Browser, nur ein Dropdown. Copy-Paste von Bildern, Drop von Bildern aus dem File-Explorer …
Leg die Software mehr auf Design / Canva aus. Die Serienerstellung mit Daten ist eher ein ZUSATZ."*

So DesignThix becomes **first a design tool like Canva** (open, design, download – fast, direct, playful) and **second** a tool that can fill a
design from data (placeholders, data lists, batch output). Everything of plan 1 (`docs/PLAN.md`) stays valid unless this file says otherwise:
ground rules §0 (MatUi, German "du", static Biz logic with permission checks, no inline styles/scripts, no innerHTML with user data, CRUD rules,
no commits by the phases, verification in a real browser), the stack, the ports.

---

## 1. What "like Canva" means here (acceptance list)

**Start and navigation**
1. The start page asks *"Was möchtest du heute gestalten?"*: a search field (designs + templates), a row of **format tiles** that create a design
   with **one click** and open the editor (Preisschild 150×100, Etikett 100×70, Regaletikett 100×30, Visitenkarte 85×55, Flyer A5, Poster A3,
   Karte A6, Instagram-Beitrag 1080×1080 px, Instagram-Story 1080×1920 px, Präsentation 1920×1080 px, *Eigene Größe*), a row **"Vorlagen"**
   and a grid **"Zuletzt bearbeitet"** (thumbnails; hover actions Öffnen, Duplizieren, Umbenennen, Löschen). The key figures move to the bottom, small.
2. Menu: primary action **"Design erstellen"** (opens a dialog with the same format tiles + custom size; FORM-like page as fallback), Start,
   Designs, Vorlagen, Uploads (the media page, renamed), **Marke** (brand kit), Schriften; then a group **"Serien (Zusatz)"**: Datenlisten,
   Serienausgaben (the former Ausgaben), Druckbögen; then the admin menu as before.
3. **Vorlagen** page: gallery by category with search; "Vorlage verwenden" creates a copy and opens the editor. **10 built-in templates**
   (§5) seeded once like the demo.

**Editor layout** (replaces the three-column layout of phase F)
4. Top bar: back (to Start), **Datei** menu (Neues Design, Kopie erstellen, Größe ändern, Exportieren (.dtx.json), Eigenschaften, Verlauf),
   undo/redo, **autosave state** ("Wird gespeichert …" / "Alle Änderungen gespeichert" / "Offline – wird später gespeichert"), the design
   name (click to rename) in the middle; right: **"Serie"** (secondary, only a link into the data features) and the primary **"Herunterladen"**
   (dropdown dialog: PNG, JPG, SVG, PDF/Drucken; pages all/current/choice; size ×1–×4 or DPI; transparent background for PNG; several pages
   → one ZIP) and **"Drucken"**.
5. Left: a vertical **icon rail** (Vorlagen, Elemente, Text, Uploads, Marke, Ebenen, Daten) that opens a **wide panel** (≈ 340 px, collapsible).
   Context pages such as *Position*, *Effekte*, *Anpassen*, *Farbe* also open in this panel (like Canva), with a back arrow.
6. Above the canvas a **contextual toolbar** whose buttons depend on the selection (§2.3). There is **no permanent right properties panel**
   any more; numbers (X, Y, B, H, Drehung) live in the *Position* panel.
7. Below the canvas a **bottom bar**: page strip with thumbnails (add, duplicate, delete, reorder by drag, context menu), zoom slider with
   percent, "Einpassen", page grid view toggle optional.

**Elements and content**
8. *Elemente* panel with one search field over everything and sections with "Alle anzeigen": **Formen** (Rechteck, abgerundet, Kreis, Dreieck,
   Raute, Fünfeck, Sechseck, Stern 5/8, Herz, Pfeil, Sprechblase), **Linien** (durchgezogen, gestrichelt, gepunktet, mit Pfeil(en)), **Rahmen**
   (image frames: rectangle, rounded, circle, heart, star, hexagon – an image element with a mask and an empty slot "Bild hierher ziehen"),
   **Icons** (≈ 1 900 Lucide icons, searchable with English tags and German synonyms for the common ones, recolourable, stroke width),
   **Flaggen**, **Siegel**, **Codes** (QR-Code, EAN-13, EAN-8, Code 128), **Bildleiste**.
9. *Text* panel: "Überschrift hinzufügen", "Zwischenüberschrift hinzufügen", "Fließtext hinzufügen" (using the brand fonts if set) and
   **Schriftkombinationen** (≈ 10 ready text groups, e.g. "SALE −30 %" in Bebas + Montserrat, "Frisch vom Markt" script + sans).
10. *Uploads* panel: big "Dateien hochladen" button, drop zone, grid of the user's uploads (newest first); click inserts, drag inserts at the
    drop point, drag onto an image/frame replaces it.
11. **Paste and drop everywhere**: Ctrl+V with an image in the clipboard (screenshot, image copied in a browser or Explorer) uploads it and inserts
    it; plain text becomes a text element; copied DesignThix elements paste as elements (also into another design); files dropped from the file
    explorer onto the canvas are uploaded and inserted at the drop point (several: cascaded), onto an image/frame/strip slot they replace its
    source; font files dropped are uploaded as fonts and applied to the selected text. Progress and errors as toasts (German).
12. **One media browser** (`wwwroot/js/dt-media.js`, a MatUi dialog/panel): tabs Uploads / Flaggen / Siegel / Logos / Alle, search, category,
    thumbnails (contain on a checkerboard), upload button, drop zone, paste; returns an asset key. Used **everywhere** an image is chosen:
    image "Ersetzen", every **Bildleiste slot** (slot chips with thumbnails, never a dropdown), background image, Marke logos, data list image
    cells, Einzeldruck image fields, field sample values.
13. *Marke* panel and page: brand colours (palette), brand fonts (Überschrift, Zwischenüberschrift, Fließtext), logos (assets of category
    Logos). Stored in the settings (one JSON), edited by Designers, read by everybody.
14. *Ebenen* panel: a tree (groups with children), drag to reorder, lock, hide, rename.
15. *Daten* panel (marked "Zusatz"): fields (key, label, type, sample), insert `{{Feld}}`, bind image/strip/QR/barcode to a field, choose a
    data list and step through its rows (preview), link "Serienausgabe erstellen". The data selector is **not** in the top bar any more.

**Interaction**
16. **Context menu** on right-click (and long-press on touch) built with MatUi menu classes, keyboard navigable, Escape closes, submenus:
    - on elements: Kopieren, Einfügen, Duplizieren, Löschen · Stil kopieren, Stil einfügen · Ebene ▸ (Nach vorne, Ganz nach vorne, Nach hinten,
      Ganz nach hinten) · An Seite ausrichten ▸ (links, zentriert, rechts, oben, Mitte, unten) · Gruppieren / Gruppierung aufheben · Sperren /
      Entsperren · Ausblenden · for images: Bild ersetzen, Zuschneiden, Spiegeln ▸, Als Hintergrund festlegen · Feld zuweisen ▸ (Zusatz);
    - on the empty page: Einfügen, Alles auswählen, Hintergrundfarbe …, Hintergrundbild entfernen, Seite hinzufügen, Seite duplizieren, Seite löschen;
    - on a page thumbnail: Seite duplizieren, Seite löschen, Nach links/rechts.
17. **Hover outline** on elements, selection with handles and a rotate handle (below the element like Canva), **live size/angle tooltip**
    while resizing/rotating ("120 × 40 mm", "15°"), smart guides incl. **equal spacing markers**, Shift = keep axis while moving, **Alt+drag =
    duplicate**, double-click text = edit, double-click image = **crop mode** (drag the image inside the frame, handles on the frame, Enter/
    Escape), double-click group = select the child under the pointer, Ctrl+click = deep select.
18. Shortcuts: T Text, R Rechteck, C Kreis, L Linie; Ctrl+B/I/U; Ctrl+G / Ctrl+Shift+G; Ctrl+Alt+C / Ctrl+Alt+V (style); Ctrl+] / Ctrl+[ and
    Ctrl+Shift+] / Ctrl+Shift+[ (order); Ctrl+D; Ctrl+C/X/V; Ctrl+A; Del; arrows (Shift ×10); Ctrl+Z / Ctrl+Y; Ctrl+S (save now); Ctrl+0
    fit, Ctrl+1 100 %, Ctrl+wheel/pinch zoom; Space/middle mouse/two fingers pan; Escape. A "Tastenkürzel" dialog (?).
19. **Autosave** (debounced 1.5 s after a change, on `visibilitychange`/`pagehide`), with the revision check of phase F (conflict dialog kept),
    local draft and offline queue kept. No Save button (Ctrl+S still saves at once).
20. **Colour picker** popover: document colours, brand colours, default palette (≈ 30), custom (native picker + hex), **eyedropper** where the
    browser has `EyeDropper`, and **gradients** (linear, angle, 2–5 stops) for page background and shape fills.
21. **Herunterladen** works without any data list (the design with its sample values); **Größe ändern** changes the format and optionally
    scales the content.

---

## 2. Document schema 2 (the contract; replaces §2 of PLAN.md)

```jsonc
{
  "schema": 2,
  "unit": "mm" | "px", "width": 150, "height": 100, "dpi": 300, "locale": "de-DE",
  "fields": [ /* unchanged from schema 1 */ ],
  "pages": [                                   // 1..50
    { "id": "p1", "name": "",                   // name ≤ 80
      "background": { "color": "#ffffff" | null, "gradient": Gradient | null, "asset": "key" | null, "fit": "cover"|"contain"|"fill" },
      "elements": [ /* bottom first */ ] }
  ]
}
```

**Upgrade 1 → 2** (engine `normalize` and C# `DocumentValidator`, identical): `pages = [{ id: "p1", name: "", background: doc.background,
elements: doc.elements }]`, everything else kept. Documents in the database are upgraded lazily on read and by a one-time start-up pass
(designs and design revisions). `schema` > 2 is refused by the server and rendered best-effort by the engine.

**Gradient**: `{ "type": "linear", "angle": 0..360, "stops": [ { "offset": 0..1, "color": "#rrggbb" }, … 2..5 ] }`. A *Fill* is `"#rrggbb"`, a
Gradient or `null`.

**Common element properties** (all types): `id`, `type`, `name`, `x`, `y`, `w`, `h`, `rotation`, `opacity`, `locked`, `hidden`, `showIf`
(as schema 1) plus `flipX`, `flipY` (bool), `shadow`: `{ "color", "opacity" 0..1, "blur" (unit, 0..50 mm / px equivalent), "x", "y" (unit) } | null`.

| type | properties (new in **bold**) |
|---|---|
| `text` | as schema 1 plus **`underline`**, **`strike`** (bool), **`list`** none\|bullet\|number, **`outline`** `{ color, width (pt) } \| null`, **`background`** `{ color, radius (unit), padding (unit) } \| null` (a box behind the text block), **`curve`** −100..100 (0 = straight; ≠ 0 → one line on a circular arc, no wrap; 100 = full circle). `color` may stay hex only. |
| `image` | `source`, `fit`, plus **`crop`** `{ x, y, w, h }` (fractions 0..1 of the natural image; the visible part, drawn with `fit` into the box; default the whole image), **`mask`** none\|rounded\|circle\|heart\|star\|hexagon\|triangle (replaces `radius`, which stays for `rounded`), **`border`** `{ color, width (pt) } \| null`, **`filters`** `{ brightness, contrast, saturation: −100..100, blur: 0..20, grayscale: bool, sepia: bool }`. An image without a source is a **frame** (placeholder "Bild hierher ziehen" in the editor, nothing in output). |
| `imageStrip` | as schema 1 (`items`, `gap`, `align`) plus **`mask`** and **`border`** per strip. |
| `shape` | **`shape`** rect\|ellipse\|line\|triangle\|diamond\|pentagon\|hexagon\|star\|heart\|arrow\|speech, **`points`** 5..12 (star), **`innerRadius`** 0.2..0.9 (star), `fill` = Fill, `stroke`, `strokeWidth`, `dash`, `radius` (rect corner), line: **`startCap`/`endCap`** none\|arrow\|circle\|square. |
| **`icon`** | `icon` (Lucide name, `^[a-z0-9-]{1,64}$`), `color`, `strokeWidth` 0.5..4 (in the icon's 24-unit grid). The engine gets the body from `opts.icon(name)` (the app serves `wwwroot/lib/icons.json`); unknown name → editor placeholder, nothing in output. |
| **`qr`** | `value` (≤ 1000, may contain `{{Key}}`), `color`, `background` (hex or null), `ecc` L\|M\|Q\|H, `quiet` bool (4-module margin). |
| **`barcode`** | `format` ean13\|ean8\|code128, `value` (≤ 80, placeholders allowed; EAN: digits, check digit computed when 12/7 digits are given, verified when 13/8), `color`, `background`, `showText` bool, `fontFamily`. Invalid value → editor placeholder with the reason, nothing in output + warning. |
| **`group`** | `children`: elements (depth ≤ 3). Children use **page coordinates**; the group's `x,y,w,h` is the union box of its children (kept by the editor); the group's `rotation`, `opacity`, `flipX/Y` and `shadow` apply to the whole group around the centre of its box. |

Limits: ≤ 50 pages, ≤ 500 elements per page and ≤ 2 000 in total (children count), ≤ 100 fields, JSON ≤ 4 MB. Placeholder extraction, asset
key extraction, the package format (.dtx.json), the output plan and the data features cover pages, groups, `qr.value` and `barcode.value`.
**Batch output with several pages**: every record produces all pages in order (single mode: one sheet per page; sheet mode: every page is one
label cell).

---

## 3. Server additions

- `POST /api/assets/upload` (multipart, several files, Designer; the same validation as the upload page: FileSniffer, SvgSafe, size limits;
  key from the file name, collisions get a suffix; category "Uploads" unless given) → `[{ key, name, url, width, height, contentType }]`;
  a pasted image without a name gets `bild-<yyyyMMdd-HHmmss>`. `POST /api/fonts/upload` likewise → the font record. Rename the media
  category for user files to **Uploads** (built-ins keep Flaggen, Siegel); the media page is titled **"Uploads & Medien"**.
- `GET /api/assets` gains `sort=new` and `category=uploads`.
- Icon library: `tools/iconlib.js` builds `wwwroot/lib/icons.json` from `../MatDesign/tools/iconlib/lucide.json` (`{ name: { body, tags,
  categories } }` + `categories` with German titles + a German synonym list for ~200 common icons, e.g. herz→heart, stern→star,
  einkaufswagen→shopping-cart, blatt→leaf, käse→…); licence `wwwroot/lib/LICENSE-lucide.txt`; cached by the service worker. Bodies are
  Lucide's (stroke paths); the engine inserts them only after parsing them into elements with an allowlist (path, circle, rect, line, polyline,
  polygon, ellipse; attributes d, cx, cy, r, rx, ry, x, y, width, height, x1, y1, x2, y2, points) – never as HTML.
- Brand kit: one settings JSON `Brand` `{ colors: ["#…"] ≤ 40, fonts: { heading, subheading, body } (family names that exist), logos: [asset
  keys] ≤ 20 }`; `GET /api/brand` (signed-in), `POST /api/brand` (Designer, antiforgery); page `/Brand` ("Marke") with three cards.
- Templates: `GET /api/templates` → designs with `IsTemplate` (id, name, category, width, height, unit, thumbnail url);
  `POST /api/designs/{id}/use-template` → new design (copy) id. `POST /api/designs` (create from format preset or custom size, returns id) for the
  one-click tiles. `POST /api/designs/{id}/resize` (new size/unit, `scale` bool).
- Format presets gain the start-page tiles of §1.1 (with an icon name each).
- The service worker caches `lib/icons.json`.

---

## 4. Phases (Sonnet agents; the planner reviews and commits after each)

**K1 – Engine 2** (owns `wwwroot/js/dt-engine.js`, `tests/e2e/engine/**`). Schema 2 as §2 incl. upgrade from 1, pages (`opts.page`, default 0;
`pageCount(doc)`), groups, all new element types and properties, gradients (unique ids), shadows (SVG filter `feDropShadow`, unique ids),
filters (`feColorMatrix`/`feComponentTransfer`/`feGaussianBlur`), crop (nested svg/viewBox or clipPath + transform), masks (clipPath shapes),
flip, text underline/strike (lines drawn), outline (`paint-order: stroke` as attribute + stroke), background box, lists, **curved text**
(`textPath` on a circle arc, single line), shapes (star/polygon/heart/arrow/speech geometry), line caps (markers or drawn), **QR encoder**
(own implementation, byte mode UTF-8, versions 1–40 auto, ECC L/M/Q/H, mask selection by penalty) and **EAN-13/EAN-8/Code 128** (auto
code set B/C) drawn as rects; `opts.icon(name)` for icon bodies, parsed with the allowlist above; editor-mode placeholders for empty frames,
unknown icons and invalid codes. `toStandaloneSvg`/`rasterize` per page (+ `format: 'png'|'jpeg'`, `quality`, `background: false` for
transparent PNG). Keep the API backwards compatible. Tests: extend `engine-check.js` (QR decodes: verify against known reference matrices
for a few inputs, e.g. compare with test vectors you generate by hand from the spec or check structural patterns + format info + data
round-trip with a small decoder written in the test; EAN check digits; Code 128 checksum; group rotation; crop; curve; gradients; shadow ids
unique; upgrade 1→2 idempotent).

**K2 – Server 2** (owns everything server-side and `tools/iconlib.js`, `wwwroot/lib/**`; not the designer JS/CSS, not the engine).
`DocumentValidator`/`DesignDocument`/`Placeholders`/`DesignPackage`/`OutputPlan` for schema 2 with the upgrade, start-up upgrade pass,
the endpoints of §3, brand kit (settings + `/Brand` page + API), media category "Uploads" + page title, icon library build + licence, format
presets for the tiles, output for multi-page documents (payload carries all pages; `output.js` renders every page per record – coordinate
with the engine API `opts.page`, which K1 adds; if K1 is not finished, write against the API in this plan). Unit + integration tests; keep
the parity tests with the engine (`DocumentValidator` ↔ `DtEngine.normalize`, `ValueFormat` ↔ `formatValue`) – they run in K3 at the latest.

**K3 – Editor shell** (after K1 and K2; owns `Pages/Designs/Designer*`, `_Designer`, `wwwroot/js/designer*.js`, `wwwroot/css/designer.css`,
new `wwwroot/js/dt-media.js` + css, `tests/e2e/designer-check.js`, new `tests/e2e/canva-check.js`). First: run the parity tests and fix what
K1/K2 left inconsistent. Then the editor layout of §1 items 4–7, 14–19: rail + panels, contextual toolbar framework, context menu, pages
(strip, add/duplicate/delete/reorder, page context menu), groups (group/ungroup, enter group, layer tree), hover outlines, tooltips,
equal-spacing guides, Alt+drag duplicate, shortcuts + "Tastenkürzel" dialog, autosave, Datei menu, Herunterladen/Drucken dialogs, the
**media browser** and **paste/drop/upload** (§1 items 10–12) incl. the Uploads panel, the *Daten* panel (fields, preview rows – the former
data selector), the *Position* panel. The old right properties panel is removed; its controls move into the toolbar and the context panels.

**K4 – Editor content** (after K3; same file ownership as K3 plus `wwwroot/js/datalist.js` and the Einzeldruck page for the media browser).
*Elemente* panel (shapes, lines, frames, icons with search + German synonyms, flags, seals, codes, strip), *Text* panel incl. Schriftkombinationen,
contextual toolbars per type (§1 item 6 and the list below), text effects panel (shadow, outline, background, curve, underline/strike, list),
image crop mode, Anpassen (filters), masks/frames, border, flip, "Als Hintergrund", strip slot chips with the media browser, shape fill with
gradients, line caps, icon colour/stroke, QR/barcode editing (value with placeholder insert, format, colours, validation message), colour
picker with document/brand/palette/eyedropper/gradient, *Marke* panel, *Vorlagen* panel (apply: replace page / add as page), Größe ändern.
The data list grid and Einzeldruck use the media browser instead of their pickers.
Contextual toolbar content:
- text: Schrift (search, preview in the font), Größe − n +, Farbe, B, I, U, S, Ausrichtung, aA, Liste, Abstand (popover: Zeichen, Zeilen),
  Effekte, Transparenz, Position, ⋯
- image/frame: Ersetzen, Zuschneiden, Spiegeln, Anpassen, Maske, Rand, Ecken, Transparenz, Position, ⋯
- shape: Füllung (incl. Verlauf), Rahmen (Farbe, Stärke, Strich), Ecken, Form, Transparenz, Position, ⋯
- line: Farbe, Stärke, Strich, Linienenden, Position
- icon: Farbe, Strichstärke, Transparenz, Position · qr/barcode: Inhalt, Format, Farben, Position · strip: Plätze, Abstand, Ausrichtung
- several/group: Gruppieren/aufheben, Ausrichten, Verteilen, Transparenz, Position
- nothing: Hintergrund (Farbe/Verlauf/Bild), Größe ändern

**K5 – Start, navigation, templates** (parallel to K4; owns `Pages/Index*`, `Pages/Templates/**`, `Pages/Brand/**` if K2 left it as a stub,
`UiKit/Shell.cs`/menu, the template seeding, `README.md`, `CLAUDE.md`, `docs/PLAN.md` status, `tests/e2e/screens.js`, `tests/e2e/home-check.js`).
§1 items 1–3; the **10 built-in templates** (§5) as JSON documents in `src/DesignThix/Demo/templates/*.json`, seeded once (same mechanism as
the demo, deleting respected), rendered and **looked at** one by one (screenshots) – they must look professional; only bundled fonts, our
flags/seals, Lucide icons, shapes and gradients (no stock photos; frames stay empty "Bild hierher ziehen" where a photo belongs).
Menu restructure, "Serien (Zusatz)" group, renamed pages/titles/breadcrumbs, Start page, Vorlagen page, "Design erstellen" dialog.

**K6 – Final pass** (planner + one agent): all browser checks (`run-all.js` incl. the new ones) on a clean stack, README/CLAUDE.md current,
screenshots for the README, review (security of uploads/paste, icon parsing, CSP, permissions).

---

## 5. Built-in templates (K5)

1. Käsetheke – Preisschild 150×100 (exists; upgrade to schema 2, keep)
2. Obst & Gemüse – Preisschild 100×70 (big price, Herkunft flag, "Klasse I", bio seal slot, chalkboard look: dark green background)
3. Regaletikett 100×30 (name, price per unit, **EAN-13** from a field)
4. Glasetikett rund-eckig 70×50 (Marmelade/Honig: frame with mask circle for a photo, script name, **QR-Code** to a URL field)
5. Visitenkarte modern 85×55, **2 Seiten** (front: name, role, logo frame; back: contact with icons phone/mail/globe/map-pin)
6. Flyer A5 "Wochenangebot" (headline, 3 offer boxes with prices, footer with address and icons)
7. Poster A3 "Hoffest" / event (big type, date badge, gradient background, icons)
8. Instagram-Beitrag 1080×1080 "SALE −30 %" (bold type, shapes, gradient)
9. Instagram-Story 1080×1920 "Neu im Laden" (frame for a photo, text, sticker shapes)
10. Grußkarte A6 quer, **2 Seiten** ("Alles Gute" with shapes/icons; inside text)

Each template defines its fields where data makes sense (2, 3, 4, 5) and ships with sample values so it looks complete without data.
