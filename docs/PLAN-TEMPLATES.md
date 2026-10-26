# DesignThix plan 6: Vorlagen für alles (a large template library with variants, decorations, fonts and forms)

Plan 6 follows plan 5 (`docs/PLAN-CATALOGS.md`). Where it differs from the earlier plans, this one wins. The owner's words: *"Mach danach auch deutlich mehr Vorlagen für
alles Mögliche: Karten, Grußkarten, Hochzeitskarten, Hochzeitseinladung, Kindergeburtstag-Einladung, Flyer für alles Mögliche usw. Auch verschiedene Versionen immer.
Formulare? Wäre auch eine Option!"*

Today (2026-10-26): 10 templates (`src/DesignThix/Demo/templates`) + the demo, 12 bundled fonts (Montserrat, Bebas Neue, Oswald, Kaushan Script, Caveat, Playfair Display,
Lora, Open Sans, Roboto Slab, Pacifico, Permanent Marker, Source Sans 3), built-in media only Flaggen (22) and Siegel (14). Templates are written in `tools/templates/NN-<slug>.js`
with the DSL of `tools/templates/dsl.js`, built by `node tools/templates-build.js`, looked at with `node tools/templates-preview.js` (see CLAUDE.md "Start, navigation, templates").

## Status

**Plan 6 is done: T1 to T5** (332 templates in 109 families + the demo, see "T5 status" at the end). T1 (the foundation) delivered the following; where it differs from this plan:

- **Metadata** as columns on `Design` (migration `TemplateMeta`: `TemplateKey` (the slug of the file), `TemplateFamily`, `TemplateFamilyName`, `TemplateVariant`, `TemplateOccasion`, `TemplateTags`, `TemplateFormat`, `TemplateOrder`), not a `MetaJson`: the gallery filters and sorts on them.
  The files own the metadata: `TemplateSeeder.SyncMetadataAsync` writes it again at every start to the system templates (found by key, a template that was seeded before the key existed by its name), so a corrected tag reaches an existing database. `number` = the NN of the module file (order of the family and of the gallery).
  `TemplateMeta` (Core) has the fixed list of occasions and the tag rules; `tools/templates/meta.js` reads `TemplateMeta.cs` and `FormatPresets.cs`, so `templates-build.js` refuses a template whose occasion, format key, size or fold does not fit the app.
- **Gallery** `/Templates`: the page is a shell, `js/templates.js` loads `GET /api/templates/gallery?occasion=&format=&q=&skip=&take=` (`TemplateLogic`: families; the filter lists are counted with the OTHER filter applied, so a click never ends on an empty page; the search looks at name, family, variant, occasion, tags and description, umlauts folded, every word must match).
  One tile per family ("3 Varianten", dots: hover, focus or click shows a variant). "Ansehen" = `js/template-preview.js` (all pages drawn through `designs.js`, variant switch also with the arrow keys, "Vorlage verwenden" on the shown variant; the tiles of the start page open it too through `data-preview-template`). Paging by IntersectionObserver + "Mehr laden"; the address keeps the state (`?occasion=&format=&q=`). `GET /api/templates` (the editor's panel) and `GET /api/templates/{id}/family` carry the metadata.
  The editor's panel Vorlagen groups by family and has the compact filters Anlass and Format (also "Passend zur Seite"); the start page row shows one template per family (the first of each occasion first).
- **Formats**: 18 new presets in `FormatPresets` (Klappkarten, Postkarten, Tischkarte, Tischnummer, Menükarte, Gutschein, Urkunde, Briefpapier, Aushang mit Abreißstreifen, Namensschild, Lesezeichen, Etikett rund, Facebook-Titelbild, Plakat A2); the ten tiles stay, the create dialog has the closed list "Mehr Formate" (`_FormatList`).
- **Fold**: the optional document property `fold` (`vertical` | `horizontal`) is **written only when set** (a missing property means none: no stored document, fixture or earlier agreement document changes), the same in `DtEngine.normalize` and `DocumentValidator` (seven agreement documents). The page is the OPEN sheet. The editor draws the guides (`js/designer.fold.js`: the layer `#dt-fold` in the sheet next to the comment pins, percentages of the sheet; the toolbar of the page has "Falz" and the switch "Hilfslinien zeigen"); nothing else draws them (output, PNG, PDF, thumbnails, public view).
- **Deko pack**: 331 own SVGs from 149 drawings in 11 groups (`wwwroot/builtin/deko`, 1.6 MB, generators in `tools/deko/`), the tab **Deko** of the media browser (chips per group). **Fonts**: 21 families added (53 faces in all; WOFF2 subsets or unmodified TTF, all SIL OFL 1.1; `tools/fonts-check.js` checks the glyphs and draws a specimen sheet). The font list of the editor and the specimens of `/Fonts` set a line in its font only when it is in view (7 files instead of 28 when the popover opens).
- **Tools and tests**: the `dsl.js` helpers (deko, forms, fold, typography; section 7), `templates-build.js` with the checks and `--from/--to`, `templates-sheet.js` (contact sheets), `TemplateMetaFileTests` (the metadata rules for every file) and `TemplateGalleryTests`, `tests/e2e/templates-check.js` (70 checks). The rule "every family has at least 3 variants and there are at least 180 templates" is enforced by default since T5 (`EnforceByDefault = true` in `TemplateMetaFileTests`).
- Deviations: the nine templates of the first plans are one variant each (their families get the other variants in T2 to T4, or stay single: the Käsetheke is the demo and exempt); the format of a folded card is the size of the OPEN sheet (`card-a6-portrait` = 210 x 148 mm, fold vertical).

Phases T2 to T5 below (all done); the guide for T2 to T4 is section 7 (still the guide for a new template; CLAUDE.md says how the files are organised now).

---

## 1. Goal

- **At least 180 templates** in about 60 kinds, **every kind in at least 3 variants** (different style, not just another colour: e.g. klassisch / modern / verspielt or
  elegant / natürlich / minimal), grouped as one **template family** so the gallery can show "3 Varianten" and switch between them.
- Everything works **offline and without photos**: decorations come from an own pack of SVG ornaments (section 3), illustrations from icons and shapes, photo areas are frames
  with a tinted shape behind (the rule of K5). Plan 5's catalogue photos are NOT used in built-in templates (they would need the network and carry licences).
- Every template is readable and printable at its physical size, uses only bundled fonts, built-in media keys and existing icons, and has sensible German sample texts
  ("Anna & Jonas", "Samstag, 12. Juni 2027", "Mia wird 6!"). Texts that a person typically changes per copy are **fields** (`{{Name}}`, `{{Datum}}`, `{{Tisch}}`), so the same
  template also works with "Serien (Zusatz)" (place cards from a guest list, certificates from a participant list).

## 2. Template metadata, gallery, formats (T1)

- The template file gets `family` (slug of the family), `variant` (German label: "Klassisch", "Modern", "Verspielt" …), `occasion` (one of a fixed list: Geburtstag, Hochzeit,
  Kinder & Familie, Feiertage, Feste & Events, Trauer, Business, Gastronomie, Verein & Schule, Handel & Preise, Social Media, Formulare & Planer), `tags` (German search words),
  `formatKey`. `TemplateSeeder` stores them (columns or a `MetaJson` on the design; a template keeps `IsTemplate`); the search covers tags.
- **Gallery** (`/Templates`, start page row, editor panel Vorlagen): navigation by occasion (chips or a side list) and by format, the search, family grouping (one tile per family
  with "3 Varianten" and small variant dots; the preview dialog "Vorlage ansehen" shows all pages and switches variants; "Vorlage verwenden" on the chosen variant), paging
  (`IntersectionObserver` + "Mehr laden"; thumbnails stay lazy, three at a time). The editor's Vorlagen panel gets the same filters in compact form.
- **New format presets** (`FormatPresets`, the tiles of the create dialog get a "Mehr Formate" list instead of more tiles): Klappkarte A6 (hoch/quer, 2 pages: außen,
  innen), Klappkarte quadratisch 14,5 cm, Postkarte A6, DIN-lang-Karte und Flyer (99 x 210 mm), Flyer A5/A4, Plakat A3/A2, Visitenkarte 85 x 55, Tischkarte (gefaltet, 2 pages),
  Tischnummer A6, Menükarte DIN lang, Urkunde A4 quer, Gutschein DIN lang, Briefpapier A4, Namensschild 90 x 55, Lesezeichen 50 x 150, Instagram Post/Story, Facebook-Titelbild,
  Etikett rund 60 mm, Aushang A4 mit Abreißstreifen.
- **Folded cards**: the document gets an optional `fold` (`none|vertical|horizontal`), the same in `DtEngine.normalize` and `DocumentValidator` (compared by the existing test);
  the editor draws a dashed fold line and a safe margin as non-printing guides; output, PNG and the public view ignore it. A folded card has 2 pages (outside = back + front,
  inside), and the page names say so ("Außen (Rückseite | Vorderseite)", "Innen").

## 3. Decorations and fonts (T1)

- **Deko pack** (`src/DesignThix/wwwroot/builtin/deko/*.svg` + entries in `builtin.json`, category **"Deko"** with sub-groups in the name: Rahmen, Ornamente, Blumen & Blätter,
  Konfetti & Ballons, Herzen, Bänder & Siegel, Trenner, Ecken, Muster, Sterne, Formen): **at least 120 own SVGs**, generated by scripts in `tools/deko/` (procedural:
  flourishes from Bézier curves, wreaths from leaf shapes, confetti fields, balloon bunches, laurel, corner ornaments, dotted and wavy dividers, frames with corners,
  seamless patterns). Own work, so no licence question; a `LICENSE` note in the folder ("Teil von DesignThix"). Each SVG passes `SvgSafe` unchanged, has an exact `viewBox`,
  and fixed colours: the image element cannot recolour an SVG, so the most used pieces come in **colour variants** (gold, rosé, salbei, navy, schwarz, weiß);
  the pack stays under 3 MB. The built-in seeding (`LibrarySeeder`, `BuiltInKey`) adds them to existing databases once.
- **More fonts** (OFL, bundled in `wwwroot/fonts` + `fonts.json` + `LICENSES/`, latin + latin-ext WOFF2, regular/bold/italic where the family has them): script for weddings
  (Great Vibes, Parisienne, Allura, Dancing Script), elegant serif (Cormorant Garamond, Libre Baskerville, Cinzel), playful for children (Fredoka, Baloo 2, Patrick Hand,
  Gochi Hand), display (Abril Fatface, Anton, Righteous, Amatic SC), clean sans (Inter, Nunito, Josefin Sans, Raleway, Poppins), mono for forms (IBM Plex Mono). About 20 families,
  each checked for German characters (ä ö ü ß „ " – €). The font specimens page and the editor's font select must stay fast (lazy specimens).

## 4. The templates (T2 to T4, three agents in parallel, disjoint number ranges and kinds)

Each kind below in **3 variants** (some in 4); "(2 S.)" = two pages. Sizes from section 2.

- **T2 Karten und Feste (numbers 100–299)**: Grußkarte Geburtstag (Klappkarte, 2 S.), Geburtstag rund (30/40/50/60), Danke, Glückwunsch allgemein, Gute Besserung, Weihnachten
  (Karte + Postkarte), Ostern, Neujahr, Muttertag/Vatertag, Beileid (ruhig, respektvoll), Hochzeit: Save the Date, Einladung (Klappkarte 2 S. + flache Karte), Antwortkarte,
  Programm/Ablauf, Menükarte, Tischkarte (Feld `{{Name}}`), Tischnummer, Danksagung, Willkommensschild (Plakat); Kinder: Kindergeburtstag-Einladung (Pirat, Einhorn,
  Dino, Weltall, Fußball …: the variants ARE the themes), Einschulung, Taufe, Kommunion/Konfirmation, Babyparty, Geburtsanzeige; Feste: Party-Einladung, Jubiläum, Abschluss/
  Abitur, Halloween, Silvester, Sommerfest, Grillfest, Weihnachtsfeier.
- **T3 Flyer, Plakate, Business, Social (numbers 300–499)**: Flyer für Veranstaltung, Vereinsfest, Flohmarkt, Konzert, Kurs (Yoga, Sprache, Musik), Restaurant-Angebot,
  Lieferdienst, Handwerker, Reinigung, Nachhilfe, Babysitter-Aushang mit Abreißzetteln, Wohnung gesucht, Tier entlaufen, Eröffnung, Sale, Spendenaufruf, Tag der offenen Tür;
  Plakate (Event, Kino-Stil, Typo, Minimal); Visitenkarten (4 Stile), Briefpapier, Gutschein (Feld `{{Code}}`, `{{Betrag}}`), Urkunde/Zertifikat (Felder Name, Datum),
  Speisekarte (DIN lang + A4), Preisschilder/Etiketten (Marmelade, Gewürz, Seife, Kerze, Honig), Namensschild (Felder), Lesezeichen, Instagram Post (Zitat, Angebot,
  Ankündigung, Gewinnspiel) und Story, Facebook-Titelbild.
- **T4 Formulare und Planer (numbers 500–599)**: Anmeldeformular (Verein, Kurs), Bestellschein, Stundenzettel, Urlaubsantrag, Übergabeprotokoll, Feedbackbogen, Teilnehmerliste,
  Quittung, Inventarliste, Checkliste, To-do-Liste, Wochenplaner, Monatsplaner (Feld `{{Monat}}`), Stundenplan, Essensplan, Einkaufsliste, Packliste, Haushaltsbuch-Seite,
  Lesetagebuch, Gewohnheits-Tracker. Forms are for print and handwriting: lines, boxes, check boxes (shapes), tables built from lines and texts in a clean grid
  (helpers `formLine`, `checkbox`, `tableGrid` in `dsl.js`), the person's details as fields where a series makes sense (Name, Datum, Kurs). Black and one accent colour,
  economical on toner, margins ≥ 10 mm.

Rules for every template (in addition to CLAUDE.md K5): an own idea per variant (layout, typography, decoration), not three recolours; hierarchy that reads at arm's length;
no text smaller than 7 pt at the physical size (forms: 8 pt for printed labels); the bleed-free safe margin of 4 mm (cards) / 10 mm (A4); German typography (typographic quotes,
en dash, non-breaking spaces in dates and amounts, € after the amount); decorations from the Deko pack or icons, never touching texts; each template LOOKED at with
`templates-preview.js` (also `--rows` for those with fields) and fixed until it looks professionally designed. A contact sheet per batch (`tools/templates-sheet.js`, new:
all thumbnails of a range on one PNG with names) for the planner's review.

## 5. Phases (Sonnet agents; the planner reviews and commits after each)

- **T1 Grundlage**: metadata + seeder + search, gallery with occasions, formats, families/variants and preview dialog, the editor's Vorlagen panel, new format presets and
  "Mehr Formate", `fold` + guides, the Deko pack (generators + 120 SVGs + seeding), the fonts, `dsl.js` helpers (forms, fold, deko), `templates-sheet.js`; existing 10 templates
  get metadata (they become the first variant of their families); tests (`TemplateTests` extended: metadata valid, every family has ≥ 3 variants once T2–T4 are in, deko keys
  exist, fonts render German characters), `templates-check.js` extended (gallery filters, family switch, preview dialog).
- **T2, T3, T4 in parallel**: the templates of section 4; each agent owns its number range and its kinds, runs `templates-build.js` for its own files only (or the full build
  at the end, coordinated: the build is deterministic, a test compares), looks at every template, delivers its contact sheets.
- **T5 Schlussrunde**: the planner reviews all contact sheets and sends fixes; `templates-check.js` (every page of every template draws without an engine warning, no text
  overlaps measured by ink like `demo-check.js` for a sample), the checks twice on a fresh database, README section "Vorlagen" with new screenshots of the gallery,
  CLAUDE.md, this plan's status.

## 6. Out of scope

Fillable PDF forms (AcroForm fields), photos in built-in templates, templates in other languages, a template marketplace, user-submitted public templates (team templates exist
since P4).

---

## 7. How to write a template family (guide for T2 to T4)

**Own your range.** T2 numbers 100 to 299, T3 300 to 499, T4 500 to 599: a module is `tools/templates/<NNN>-<slug>.js` (the number sorts the family and the gallery; three digits are fine, the older files have two). Never edit another range, `dsl.js`, `meta.js`, `templates-build.js` or the tests: ask the planner.

### The module

```js
'use strict';
const { text, rect, ellipse, line, icon, frame, image, group, page, gradient, shadow, field,
        deko, dekoIn, dekoCorners, dekoRepeat, foldCard, panels, turn180, typo } = require('./dsl');

module.exports = {
  slug: 'geburtstag-klassisch',                 // file name of the JSON; unique
  name: 'Geburtstagskarte – Klassisch',          // the name of the design a person gets
  category: 'Karten',                            // Karten, Einladungen, Flyer, Poster, Etiketten, Social Media, Business, Formulare ...
  description: 'Klappkarte A6 hoch mit Goldrahmen ...',   // German, more than 40 characters, says what it is and what to change
  family: 'geburtstagskarte', familyName: 'Geburtstagskarte', variant: 'Klassisch',   // the SAME family and familyName in every variant of the kind
  occasion: 'Geburtstag',                        // one of: Geburtstag | Hochzeit | Kinder & Familie | Feiertage | Feste & Events | Trauer | Business | Gastronomie | Verein & Schule | Handel & Preise | Social Media | Formulare & Planer
  tags: ['Geburtstag', 'Glückwunsch', 'Karte', 'Klappkarte', ...],   // 3 to 30 German search words (the gallery and the search of the start page look at them)
  formatKey: 'card-a6-portrait', fold: 'vertical',   // a key from the list below; fold only for folded cards; width/height = the size of the format
  width: 210, height: 148,                       // (unit: 'px' for screen formats)
  fields: [field('Name', 'Name', 'text', 'Anna')],     // where a series makes sense; sampleRows: [{ Name: 'Anna' }, ...] for the check with --rows
  pages: foldCard('vertical', [ /* outside */ ], [ /* inside */ ], '#fffaf0'),
};
```
`node tools/templates-build.js --from 100 --to 199` writes `src/DesignThix/Demo/templates/<slug>.json` (normalised through the engine, so the file is what the validator writes) and refuses a module with a problem, naming it. The nine families of the first plans show every kind of element; `tools/templates/dsl.js` has the helpers and a header comment with the whole list.

### Look at what you made (every time)

```bash
node tools/templates-build.js --from 100 --to 199
node tools/templates-sheet.js --from 100 --to 199 --out <folder>/batch-100.png     # contact sheet: all pages of a range with names (several PNGs when large; --thumb 300, --per-sheet 40)
node tools/templates-sheet.js --family geburtstagskarte --thumb 520                 # the variants of one family next to each other
node tools/templates-preview.js --only geburtstag-klassisch --out <folder> --rows --editor   # full size per page, with the sample rows, as the editor draws it
```
Open the PNGs with the Read tool and fix what you see: overlapping or touching texts, too small type, empty-looking areas, decorations that touch text, an uneven rhythm, a font that falls back (a missing family is an error). The engine prints every warning (missing medium, unknown icon, invalid code, unknown placeholder). Then `dotnet test --filter TemplateMetaFile` (metadata, deko keys, fonts, icons, normalised files) and, with the app running, `node tests/e2e/templates-check.js <base>` (every page of every template draws without a warning).

### Formats (`formatKey`, the size must match)

Print flat: `a4-portrait` 210x297, `a4-landscape` 297x210, `a5-portrait` 148x210, `a5-landscape` 210x148, `a6-portrait` 105x148, `a6-landscape` 148x105, `din-lang-portrait` 99x210, `din-lang-landscape` 210x99, `business-card` 85x55, `name-badge` 90x55, `bookmark` 50x150, `square-100`, `price-tag` 150x100, `label-150x100`, `label-100x70`, `label-70x50`, `label-58x40`, `label-round-60` 60x60, `shelf-strip` 100x30, `postcard-a6-landscape` 148x105 and `postcard-a6-portrait` 105x148 (two pages: Vorderseite, Rückseite), `letterhead-a4`, `certificate-a4` 297x210, `voucher-dl` 210x99, `menu-dl` 99x210, `table-number` 105x148, `tearoff-a4` 210x297, `poster-a3-portrait` 297x420, `poster-a3-landscape` 420x297, `poster-a2-portrait` 420x594.
Folded (the page is the OPEN sheet, two pages named by `foldCard`): `card-a6-portrait` 210x148 vertical (folded 105 x 148), `card-a6-landscape` 148x210 horizontal (folded 148 x 105), `card-square-145` 290x145 vertical, `card-dl-portrait` 198x210 vertical, `table-card` 90x100 horizontal (tent card, folded 90 x 50).
Screen (`unit: 'px'`): `instagram-post` 1080x1080, `instagram-story` 1080x1920, `facebook-cover` 1640x624, `presentation` 1920x1080. A format that is missing: ask the planner (it is one line in `FormatPresets.cs`), do not invent a size.

### Folded cards

- `fold: 'vertical'`: the left half of the sheet is the back of the card, the right half the front (outside page); the fold line is `width / 2`. `fold: 'horizontal'`: the upper half is the back, the lower half the front; the fold line is `height / 2`. The inside page is the whole sheet (left and right, or top and bottom, read as one spread).
- **The back panel of a horizontal fold is read upside down** (the card is folded behind): put its elements through `turn180(elements, panel.cx, panel.cy)`. A vertical fold needs nothing like it.
- `panels(width, height, fold, margin)` gives the halves as boxes (`x, y, w, h, cx, cy, left, top, right, bottom`); use margin 4 (mm) for the safe margin, and keep every text inside the panel it belongs to: nothing may cross the fold line (a text over the fold is cut by the crease), only decorations (a frame, a band) may.
- The editor draws the fold line and the 4 mm margin of each half as guides, so what you see in `--editor` previews is not what is printed.

### Decorations: the Deko pack (`deko-*` keys, `node tools/deko/list.js [--group Rahmen]` lists them with size and ratio)

Image elements with fixed colours (no recolouring): pick the colour variant that fits (`-gold`, `-rose`, `-salbei`, `-navy`, `-schwarz`, `-weiss`, `-bunt`, `-pastell`, `-bordeaux`, `-boho`). `deko(name, key, x, y, w, h?)` (the missing side follows the drawing), `dekoIn(name, key, boxX, boxY, boxW, boxH, { align, valign })` (as large as it gets inside a box), `dekoCorners(name, key, W, H, size, inset, { only: 'tl,br' })` (one corner drawing mirrored into the corners), `dekoRepeat` (a row of the same piece). Groups (about 20 to 45 pieces each):
- **Rahmen** (full-page frames: `hoch` 1000x1414, `quer` 1414x1000, `quadrat`, `lang` 1000x2121; Doppellinie, Schnörkel, Ranke, Blüten, Deco, Klammern, Bogen, Zierrand, Punkte, Konfetti, Perlenring, Oval, Briefmarke): `dekoIn` into the page box minus the safe margin; the centre is transparent.
- **Ornamente** (Schnörkel breit, Schwung, Fleuron, Mandala, Fächer, Paisley, Strahlenkranz, Rosette), **Trenner** (1200x120: Punkte, Welle, Raute, Schnörkel, Blattreihe, Herz, Sterne, Girlande, Blütenranke, Deco, Perlen, Zickzack, Konfetti), **Ecken** (400x400 top left: Schnörkel, Ranke, Deco, Blüten, Lorbeer, Eukalyptus, Klammer, Konfetti, Sterne).
- **Blumen & Blätter** (Lorbeerkranz/-zweig/-bogen, Eukalyptus, Olive, Farn, Palme, Tanne, Margerite, Pfingstrose, Anemone, Rose, Kirschblüten, Weizen, Lavendel, Schleierkraut, Herbstlaub, Blumenwiese, Blumenkranz), **Herzen**, **Sterne** (Stern, Funkeln, Himmel, Kranz, Strahlen, Sternschnuppe, Girlande, Schneeflocken), **Formen** (Blobs, Bögen, Pinselring und Pinselstriche, Wolken, Mond, Sonne, Regenbogen, Wellen-, Bogen- und Zackenränder, Berge, Aquarellfleck).
- **Konfetti & Ballons** (Streuung bunt/pastell/gold, Regen, Luftschlangen, Ballons drei/fünf/einzeln, Ballonbogen, Partyhut, Wimpelkette, Geschenk, Torte), **Bänder & Siegel** (Schleife, Banderole, Fahne, Band, Rosette, Siegel, Wachssiegel, Medaille, Anhänger, Stempel, Washi, Eckband, Starburst), **Muster** (1000x1000 fields: Punkte, Streifen, Wellen, Schuppen, Sterne, Blümchen, Herzchen, Karo, Zickzack, Deco, Blätter, Konfettipunkte, Wolken, Regenbogen; put a tinted rectangle behind or use at low `opacity`).
Never let a decoration touch a text (look at the sheet), and do not use a piece at a size where its thin lines fall below 0.3 mm. Photos do not exist: use `frame()` with a tinted shape behind it.

### Fonts by mood (bundled; the family name is the `f:` of `text()`)

- **Script** (large sizes only, line height 1.3 to 1.4, never body text or capitals): Great Vibes (formal wedding script, 28 pt and up), Parisienne (flowing, old-style digits), Allura (airy and thin, swashes), Dancing Script (lively, 400 to 700, for birthdays), Kaushan Script, Pacifico (very tall: ink 1.5 em), Caveat (handwriting, 400 to 700, good for personal texts), Permanent Marker.
- **Serif**: Cormorant Garamond (refined, high contrast, 300 to 700 + italic; use 500 or more under 12 pt; old-style digits), Libre Baskerville (wide, sturdy book serif: about 10 % more box width, line height 1.3), Playfair Display, Lora, Roboto Slab, Cinzel (Roman capitals for titles and certificates; lower case renders as small capitals and ß as SS), Abril Fatface (fat display serif for large headings only).
- **Sans**: Inter (neutral, forms and small print), Nunito (soft and friendly, tabular digits), Josefin Sans (geometric, vintage; sits high in its box), Raleway (elegant, old-style digits), Poppins (round, modern social posts; line height 1.2 or more), Montserrat, Open Sans, Source Sans 3 (tabular digits, the forms default), Oswald, Bebas Neue and Anton (condensed, capitals, posters and sale headlines; Anton needs line height 1.15), Righteous (retro display).
- **Playful**: Fredoka (round, chunky bold, children), Baloo 2 (round, tall line box), Patrick Hand (neat handwriting, price tags and captions), Gochi Hand (scrappy comic hand, kids' parties), Amatic SC (thin hand-drawn capitals, rustic and café), Kaushan Script.
- **Mono** (forms, numbers, codes): IBM Plex Mono.
Pair one display or script font with one calm sans or serif; a template with more than three families is a ransom note. `node tools/fonts-check.js --sheet <png>` draws every face; ä ö ü ß € „ “ – exist in every family.

### Forms (T4) and series

`formLine(name, x, y, w, label, { value: '{{Name}}', lines: 3, gap: 8 })`, `formBox`, `checkbox`/`checkItem`, `ruled` (lined paper), `tableGrid(name, x, y, w, h, { cols: [3, 1, 1], rows: 12, header: [...], zebra: '#f4f4f4', cells: [[...]] })` (the returned array has `.cell(r, c)`, `.bottom`). Black and one accent colour, margins at least 10 mm, text at least 8 pt on forms. Where a series makes sense (place cards, certificates, name badges, vouchers, timesheets) make the person's details **fields** with a German label and a sample, and add `sampleRows` (three or four with long and short values: the check with `--rows` shows them).

### German typography

`typo.quote('Alles Gute')` gives „Alles Gute“, `typo.date(12, 'Juni', 2027)` and `typo.time('18:30')` keep dates and times together with a non-breaking space, `typo.euro(12.5)` gives 12,50 € with the sign after the amount, `typo.dash` is the en dash for ranges ("10–12 Uhr"). Use real quotes, no straight `"`, no `...` (use `…`), and write the sample texts as a person would ("Anna & Jonas", "Samstag, 12. Juni 2027", "Mia wird 6!").

### The quality bar

- An own idea per variant: layout, typography and decoration differ (klassisch / modern / verspielt, or the theme for children's cards); three recolours of one layout are rejected. Family and `variant` say what the difference is ("Klassisch", "Modern", "Verspielt", "Pirat", "Einhorn").
- A hierarchy that reads at arm's length (one clear main line, one supporting line, details smaller); text at least 7 pt (forms 8 pt) at the physical size; safe margin 4 mm (cards, tickets, labels) or 10 mm (A4 and larger) for every text and for what must not be cut; a text box at least as high as its font size (the engine shrinks to fit, so a box that is too small shrinks the text; keep `min` sensible).
- Measure, do not guess: after a change look at the sheet. A long name ("Maximiliane Schneider-Hohenstein") and an empty value must still look right (`--rows`).
- Only bundled fonts, built-in media keys, existing Lucide icons (the build checks), no photos, no `px` in a `mm` document.
- Names of elements in German ("Titel", "Datum", "Rahmen"): they show up in the layers panel of the editor. Lock decoration that a person should not move by accident (`locked: true`), leave texts and fields unlocked.
- Delivery per batch: the built JSON files, the contact sheets of the range (one PNG per 40 templates), the list of what you could not make good.

---

## T5 status (final pass)

- **Library**: 332 template files in 109 families (every family 3 or 4 variants) plus the Käsetheke demo; by occasion (templates / families): Feste & Events 45/15, Handel & Preise 42/14 (+ the demo), Verein & Schule 36/12, Kinder & Familie 34/10, Business 34/11, Formulare & Planer 33/11, Hochzeit 30/10, Social Media 27/9, Feiertage 27/9, Gastronomie 12/4, Geburtstag 9/3, Trauer 3/1. 37 formats, 26 folded cards. 335 Deko files from 151 drawings, 33 font families. The test rule "every family >= 3 variants, >= 180 templates" is on by default.
- **Quality lint** (`tools/templates-lint.js`, new; opt-in `run-all.js --only lint`): measures every page at its physical size in the browser with the real engine (the ink of each text on a raster of at least 4 px/mm: below that Chromium rounds the advances of small type up to 15 % too wide). Rules: size >= 7 pt (forms 8 pt, screen documents 15 pt), margin 4 mm / 10 mm from A4 (area >= 56 000 mm2) / 5 mm on tear-off sheets / 3.5 % for px, measured inside the PANEL of a folded card, no text across the fold, no text that overflows its box at the minimum size, no overlapping ink of two texts, no engine warning; warnings (not failures): sample-row stress values that do not fit, and decorations that stick out of the page (141, clipped by every output). First run: 143 errors in 75 templates (69 sizes of 5.5 to 6.5 pt, 53 margins, 14 overflows, 7 overlaps), all fixed in the family files (sizes raised to 7 pt, boxes enlarged or moved by 1 to 4 mm, tear-off texts narrowed); the engine warnings the batch agents had seen (an icon, a content overflow) did not occur any more. Last run: 0 errors.
- **Looked at and changed**: Weihnachtskarte Tannengrün (dark green front with gold branch and gold and red baubles; new Deko pieces `tannenzweig` in `tanne`/`gold`/`weiss`), Konfirmation Typo (two lines KONFIR-/MATION at 74 pt), Weltall (stars no longer behind the rocket; text moved down), Silvester Prosit (confetti only at the top and bottom edge), Weihnachtsfeier Winternacht (sky only at the top), Plakat Typo Hohl (four rows that get lighter up to the yellow row, no row under the card), Flyer Warnstreifen (new Deko pattern `muster/warnstreifen`, shown through the new `dekoWindow` helper so nothing sticks out of the page), Honig Blumenwiese (band behind the foot line). Dates: every sample text uses 2027, the weekday matches the date (a codemod moved day numbers to the nearest date with that weekday: `Samstag, 12. Juni 2027`).
- **Gallery at scale** (110 families, measured at 1440, 900 and 390 px on a fresh database): the shell is ready after about 0.1 s, the first thumbnails after 0.2 s; thumbnails are drawn lazily (only those in view); scrolling through all five pages takes 2.5 s and nothing fails; 10 000 DOM nodes at the end. Seeding 332 templates takes 1.0 s on a fresh database and 1.1 s for 323 into a database that has the 9 old ones (one `SaveChanges`; logged).
- **Refresh of built-in templates** (new, asked for by the owner during T5): see CLAUDE.md, `TemplateSeeder.RefreshAsync`: a changed file replaces the document of a template nobody edited (new revision "Vorlage aktualisiert"); an edited one is left alone, a deleted one stays deleted; cheap at start-up (a hash per file).
- **Tests and checks**: `templates-check.js` and `content-check.js` (section templates), `home-check.js`, `screens.js` were adapted to the large library (names of families, five hits for "supermarkt", cells per family); `screens.js` makes two new shots (`templates-hochzeit`, `template-preview`), the media browser shot shows the tab Deko, and `catalogs-icons.png` shows a set of real icons after the save finished.
- **Deviations / open**: Chromium draws small text up to 4 % wider than `layoutText` measures (hinting of the SVG text at screen sizes); a wrapped paragraph of 8 pt can therefore end a little beyond its box on screen, the lint measures the ink, so it keeps the margins; an engine fix (`text-rendering: geometricPrecision` did not change it in a probe) is left to the owner. 141 decorations still bleed over the page edge (circles, blobs, wimpel chains): clipped by print, PNG, PDF and thumbnails, visible beside the sheet in the editor.

## 8. Second round (V1 to V6, 2026-10-26)

The owner's words: *"Ich möchte noch viel mehr verschiedene Vorlagen. Rennfahrer-Geburtstag, Prinzessinnen, Harry Potter, Pferde, Hochzeit für Junge, Alte, Metal-Heads, Gamer, Grußkarten, Danksagungen und alle möglichen. Einladungskarten und etliche Flyer für jede mögliche Veranstaltung!"*
Goal: about **300 more templates** (total about 630), same rules as section 7 (families with at least 3 real variants, the lint of T5 must pass, look at every template).

- **Motive** (new Deko group "Motive"): themed illustrations a theme needs (racing car, chequered flag, helmet, crown, castle, wand, owl, broom, witch hat, cauldron, horse, horseshoe, electric guitar, skull with roses, lightning, game controller, pixel heart, joystick, knight helmet, shield, dragon, fairy wings, mermaid tail, police car, excavator, tractor, farm animals, lion, palm, tent, campfire …). Each batch draws what it needs in its own file `tools/deko/m-<batch>.js` (the build merges all `m-*.js` into the group; slugs unique: prefix nothing, but check `node tools/deko/list.js --group Motive` first and reuse what exists). Own drawings in the style of the pack (flat, clean, few colours, colour variants where it helps).
- **No protected names or marks**: no "Harry Potter", "Hogwarts", house names, lightning-scar character, "Pokémon", "Minecraft", "Mario", band or brand names, logos or look-alike fonts. Use generic themes: "Zauberschule", "Magische Einladung", "Gamer", "Rock & Metal".
- **V1 Kindergeburtstag II (600–679)**: one family per theme with 3 variants (formats or styles): Rennfahrer, Prinzessin, Zauberschule, Pferde/Reiterhof, Ritter & Burg, Feen, Superhelden, Polizei, Baustelle, Bauernhof, Dschungel/Safari, Meerjungfrau, Ninja, Gamer, Detektiv, Zirkus, Camping, Eisenbahn, Ballett/Tanzen, Pyjama-Party.
- **V2 Hochzeit II (680–749)**: new style lines added as variants to the existing wedding families (save the date, invitation flat and folded, table card, menu, thank-you; at least three kinds per style): Jung & Modern (Pop), Boho, Rustikal/Scheune, Vintage, Rock & Metal, Gamer/Nerd, Strand, Winter, Standesamt schlicht, Elegant Schwarz, Mittelalter, Tropisch; plus anniversary/vow renewal for older couples (large, easy-to-read type: Goldene/Silberne Hochzeit, Eheversprechen erneuern).
- **V3 Grußkarten & Danksagungen II (750–829)**: Hochzeitstag, Ruhestand, Abschied Kollege, Neues Zuhause, Führerschein, Bestandene Prüfung, Valentinstag, Geburt, Freundschaft, Entschuldigung, Einfach so, Danke Lehrkraft/Erzieherin, Danke Pflege/Helfer, Trauer-Danksagung, Geburtstag lustig, Geburtstag für Männer, Geburtstag 18/70/80/90, Danke für Geschenke, Gute Reise, Glückwunsch Hauskauf/Job.
- **V4 Einladungen für Erwachsene und Mottopartys (830–909)**: Metal/Rock-Geburtstag, Gamer-Party, 80er/90er, Casino, Krimidinner, Cocktail, Weinprobe, Spieleabend, Junggesellenabschied, Housewarming, Ruhestandsfeier, Klassentreffen, Brunch, Familienfeier, Oktoberfest, Fasching/Karneval, Gartenparty, Runder Geburtstag Party, Firmenfeier, Grill & Chill, Filmabend, Pyjama-/Mädelsabend.
- **V5 Flyer für Veranstaltungen II (910–999)**: Lauf/Sportfest, Turnier, Workshop, Vortrag, Lesung, Ausstellung/Vernissage, Theater, Kinderfest, Laternenumzug, Weihnachtsmarkt, Osterbasar, Kirmes/Stadtfest, Weinfest, Oktoberfest, Party/Club-Nacht, Quiz-Abend, Karaoke, Blutspende, Erste-Hilfe-Kurs, Gemeindefest/Gottesdienst, Schulfest, Kita-Fest, Messe/Markt, Online-Seminar, Tanzkurs, Fitnesskurs, Kochkurs, Repair-Café, Kleidertausch, Benefizkonzert, Mitgliederversammlung, Nachbarschaftsfest.
- **V6 final pass**: Deko rebuild and check, full template build, lint of all templates, tests, the checks once on a fresh database, README numbers and a screenshot, CLAUDE.md, this status.
