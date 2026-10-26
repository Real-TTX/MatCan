# The editor (Designs/Designer): architecture

The editor is the Canva-style heart of DesignThix (`docs/PLAN-CANVA.md` §1 items 4 to 19). `Pages/Designs/Designer.cshtml` is only the frame (top bar, rail, panel,
toolbar, canvas, page strip, tab bar); the scripts in `wwwroot/js/designer*.js` build everything else with DOM APIs (no `innerHTML`, no inline style: data goes in through
`textContent`, attributes and the CSSOM). The document is the normalised schema 2 document of `DtEngine` (pages, groups); the engine draws it, nothing else does.
Styles: `wwwroot/css/designer.css` (+ `dt-media.css` for the media browser), MatUi tokens only, flat (borders; only menus, popovers and dialogs have the MatUi shadow).

## Layout

```
.dt-top      back | Datei ▾ | undo redo | save state | name (click to rename) | people (avatars, presence) | Serie | Herunterladen | Drucken | Teilen (or "Kopie erstellen" when read-only)
.dt-rail     Vorlagen KI Elemente Text Uploads Marke Ebenen Kommentare Daten (Zusatz)        .dt-panel (≈ 340 px, collapsible; context pages with a back arrow)
.dt-ds__center  .dt-ctx (contextual toolbar) / canvas (#dt-viewport > #dt-sheet > #dt-page + #dt-overlay) / .dt-bottom (page strip, zoom)
.dt-tabbar   phones only: Elemente Text Uploads Ebenen Mehr (KI-Assistent, Vorlagen, Marke, Kommentare ...)
```

>= 1024 px everything is side by side. 768 to 1023 px the panel is an overlay drawer next to the rail (closes on a tap on the canvas, after adding something) and the toolbar scrolls
sideways. < 768 px a phone editor: the rail is the tab bar at the bottom, the panel a bottom sheet, popovers bottom sheets, the toolbar a scroller above the tab bar, handles have
a 44 px hit area. A person with View only (`canEdit=false`) gets the same page with `is-readonly`: everything visible, nothing editable, "Nur ansehen" in the top bar and "Kopie erstellen" instead of "Teilen"; Herunterladen and Drucken work.

## Modules (load order, see the end of `Designer.cshtml`)

| File | What it is |
|---|---|
| `designer.core.js` | `window.DtDesigner` (`D`): DOM builders (`D.el`, `D.svg`, `D.icon`), geometry (rotation, **frames of groups**), fonts, icon library loader, document helpers (`D.walk`, `D.fixGroups`, `D.cloneNodes`, `D.idMaker`), and **`D.createApp`**: the state and every command (see below). |
| `designer.canvas.js` | Drawing (`renderInto`, `mode: 'editor'`), the overlay (hover, selection, 8 handles, rotate handle below, marquee, guides, distance markers, size/angle tooltip), pointer gestures (move, resize, rotate, marquee, pan, pinch, long press), hit testing, snapping (edges, centres, equal spacing), zoom, inline text editing, drop targets. `D.canvas.*`. |
| `designer.menu.js` | `D.menu.open(items, {x,y} \| {anchor})` (context menus, Datei, ⋯: `mat-menu` classes, submenus, shortcuts at the right, disabled with a reason, keyboard), `D.popover.open(anchor, build)`, `D.dialog.show(opts)` (MatUi dialogs from DOM APIs). |
| `designer.ui.js` | Form blocks that return handles `{ el, set(v) }`: `D.ui.number/select/segmented/switchBox/slider/field/section/iconButton/textButton`. |
| `designer.colors.js` | The colour popover `D.colors.open(anchor, { title, get(), onChange(value, final), allowNone, noneLabel, allowGradient })`: tabs **Farbe** (sections `D.colors.sections`: Dokumentfarben, Markenfarben, Standardfarben; native picker, hex field with validation (`aria-invalid`), pipette where `window.EyeDropper` exists) and, with `allowGradient`, the tabs of `D.colors.tabs`. A value is `'#rrggbb'`, `null` (none) or a gradient. |
| `designer.gradient.js` | The **Verlauf** tab (`D.colors.tabs`): bar with draggable stops (click adds, Entf removes, arrows move, 2 to 5 stops), angle (CSS: 0 = to top), colour and position of the stop, ten presets; `D.gradient.css(angle, stops)`. |
| `designer.commands.js` | `D.cmd.*` (copy, cut, paste, group, order, replaceImage, setAsBackground, crop, bindField …) and the menus: `D.contextItems(node)`, `D.pageMenuItems()`, `D.pageThumbItems(i)`. |
| `designer.toolbar-parts.js` | The bigger controls of the toolbar as functions of the toolbar context (`D.tbp.mask/corners/borderColour/borderWidth/flip/shapeKind/lineEnds/list/effects/adjust/iconReplace`) and the small outlines `D.glyph(kind)` (shapes and masks). |
| `designer.crop.js` | Crop mode `D.crop = { start(id), active(), finish(apply), state(), zoomTo(f) }` (see "Crop mode" below). |
| `designer.toolbar.js` | The contextual toolbar (kinds: page, text, image, strip, shape, line, icon, qr, barcode, group, multi). `D.toolbar.register/extend/setOverride`. Several nodes of one kind keep the toolbar of the kind and get Gruppieren, Ausrichten, Verteilen in front. When the controls do not fit the toolbar adds `is-compact` (words next to icons go; `dt-tb--keeptext` buttons keep theirs). |
| `designer.panels.js` | The rail and panel framework `D.panels.register(def)`, `D.addByKind(kind)`, `D.tilePreview`, and the panel Marke. |
| `designer.icons-de.js` | `D.iconWordsDe` (about 360 German search words → icon names, because Lucide has no cheese or cow), `D.fold` (umlauts and ß folded), `D.iconSearch(library, query)`. |
| `designer.panel-elements.js` | The panel **Elemente** (sections, "Alle anzeigen", one search field over everything), `D.iconSvg(name)`, `D.iconGrid(options)` (icons in batches of 60 through an IntersectionObserver) and `D.iconPicker.open(anchor, { current, onPick })`. |
| `designer.panel-text.js` | The panel **Text**: three add buttons (brand fonts) and the ten **Schriftkombinationen** (`D.textCombos = { list, insert(app, combo, at), build }`). |
| `designer.panel-templates.js` | The panel **Vorlagen** (previews drawn by the engine, category chips, search, the dialog "Aktuelle Seite ersetzen" / "Als neue Seite hinzufügen"); `D.templates = { list(), apply(t, mode), dialog(t) }`. |
| `designer.panel-uploads.js`, `-layers.js`, `-data.js`, `-position.js` | Uploads, Ebenen (tree), Daten (Zusatz) (+ `D.data`, the preview state), Position (context page). |
| `designer.panel-comments.js` (+ `css/designer-comments.css`) | `D.comments` (P5): the rail entry **Kommentare** (badge = open threads), the panel (filter, "Nur diese Seite", threads with replies, composer with `@` mentions) and the **pins** on the canvas: buttons in the layer `#dt-pins` inside `#dt-sheet` (outside `#dt-page`, so never in a download, print or thumbnail). See "Comments" below. |
| `designer.ai.js` (+ `css/designer-ai.css`, `ai-attach.js`) | `D.ai` (plan 4, A2): the rail entry **KI** (first after Vorlagen; hidden until `GET /api/ai/designs/{id}/agent` says `showEntry`), its panel, the live canvas, the lock while a run works, the pictures for `look`. See "The design assistant" below. |
| `designer.effects.js` | The context pages **Effekte** (text: presets and the properties shadow, outline, background, curve) and **Anpassen** (image: looks and filters); both have `reselect: true`, so they follow the selection. |
| `designer.pages.js` | The bottom bar: page strip (thumbnails drawn by the engine, drag to reorder, menu) and the zoom controls. |
| `designer.io.js` | `D.dnd.attach` (tiles to the canvas), uploads of images and fonts, **paste** and **drop** of files. |
| `designer.save.js` | Autosave, revision check (409 dialog), local draft, offline, keepalive on `pagehide`, thumbnail. `D.save`. |
| `designer.file.js` | Datei menu, Größe ändern, Neues Design, Herunterladen (PNG/JPG/SVG/ZIP, PDF → print view), Drucken. `D.file`. |
| `share.js` (+ `css/share.css`) | Not an editor module: the Teilen dialog `window.DtShare.open({ kind, id, name })` that the whole app uses (loaded before `designer.share.js`). |
| `designer.share.js` | `D.share` (P3): the top bar's **Teilen** button (`DtShare.open`) or **Kopie erstellen** for read-only people (`DtMove.pick`, else a plain area select, `POST /api/items/copy`), the avatars of the people with access (max 4 + "+N") and **presence**: `POST /api/designs/{id}/presence` every 15 s while visible, `{ leave: true }` on `pagehide`; a dot on the avatar of everybody who has the design open, the toast "Anna bearbeitet dieses Design gerade.". `D.share.beat()` for the checks. |
| `designer.shortcuts.js` | Keyboard, clipboard events (copy/cut), the Tastenkürzel dialog. **K** opens the composer of the comments (C adds a circle). |
| `designer.js` | Boot: loads design, fonts, assets, brand, formats; starts the modules in order; top bar; phone tab bar. |
| `dt-media.js` + `css/dt-media.css` | The media browser `window.DtMedia.pick(options, callback(key, asset))`, standalone (also used by `/Brand`). |

## State and commands (`D.createApp`, `D.app`)

`app.doc` is the document (`app.doc.pages[i].elements`), `app.pageIndex` the current page, `app.sel` the ids of the selection (one list: siblings of one parent), `app.editing`
the inline text editor, `app.preview` the data row of the preview, `app.brand`, `app.fonts`/`app.fontIndex`, `app.assets`. A node is found with `app.locate(id)` →
`{ el, list, index, chain }` (`chain` = the groups around it, outermost first), `app.element(id)` for any page.

Changing the document always goes through **`app.edit(mutator, opts)`** (one undo step; `merge: key` coalesces typing/nudging, `render: 'now'|'soon'|'none'`, `structure: true` when
elements, pages or fields were added/removed/moved) or **`app.tx()`** for a gesture (the first `apply` pushes one undo step, later ones only draw). After every change the boxes of
groups are fixed (`D.fixGroups`). Commands: `addElement`, `addNodes`, `setProps`, `setNodeBox`, `deleteIds`, `duplicateSelection`, `copySelection`/`paste`, `copyStyle`/`pasteStyle`,
`nudge`, `order`, `moveNode(id, parentId, index)` (layers, also into/out of groups), `group`/`ungroup`, `align`, `distribute`, `toggleLock`/`toggleHidden`, `rename`, `flip`,
pages (`addPage`, `duplicatePage`, `deletePage`, `movePage`, `renamePage`, `setPage`, `setBackground`), fields (`addField`, `updateField`, `deleteField`, `insertPlaceholder`),
sources (`setSource`), `computeValues`, assets (`assetUrl`, `addAssets`), and for the design assistant **`replaceDocument(doc, { undoable, before, revision })`** (replaces the document by one the server wrote: keeps the page and the selection where they still exist, emits `doc {reason: 'history'}` so the panels and the page strip redraw as after an undo; `undoable: false` = no undo step, a string (the tag `'ai'`) = ONE undo step that leads back to `before`; `revision` = the revision the save module goes on from, nothing is unsaved), **`setBusy(on)`** (`app.editable()` is false while the AI works: the same gate as the read-only editor) and `dropHistory(tag)`.

**Events** (`app.on(name, fn)`): `doc {reason, render, structure}`, `selection`, `history`, `page`, `pages`, `preview`, `state`, `fonts`, `assets`, `brand`, `datalists`, `zoom`,
`readonly`, `editing`, `warnings`, `rendered`, `dirty`, `uploaded`, `panel`, plus `contextmenu {x, y, node}`, `node:dblclick {node}` (an image: hook for the crop UI) and `format 'b'|'i'|'u'`.

### Coordinates, groups

All geometry is in document units. A **group** holds its children in *page coordinates* (the frame before its own rotation); the group's `x,y,w,h` is the union of the children
(kept by `D.fixGroups`), its rotation/flip apply around the centre of that box. Moving a group translates its descendants (`D.translate`), resizing scales them (`D.setBox`).
Pointer work on a node inside groups converts the pointer into its frame (`D.toFrame(chain, p)`), the overlay draws back to the page (`D.toWorld(chain, p)`).
A click selects the top-level node (the whole group); a double click or a click while the selection is inside a group selects the child; Ctrl+click selects deep.

During a drag the document is changed live but the engine does not run: the node's `<g>` gets a transform (move, rotate), a resize renders once per frame; on release the engine draws.

## Crop mode (`designer.crop.js`)

`D.crop.start(id)` (double click on an image, the toolbar button, the context menu) works for an image whose source is an asset of the library (not a field, not an empty frame). It draws a layer `.dt-cropui`
(an SVG with the transforms of the element and of its groups) over the sheet, hides the engine's node and replaces the toolbar (`D.toolbar.setOverride`): slider 100 to 600 %, Zurücksetzen, Abbrechen, Fertig.
Geometry is kept in the content frame of the element (origin = top left of its box, no rotation or flip): `I` = the whole natural picture, `W` = the window. At the start the crop region is placed into the box with
`fit` exactly like the engine does and `W` = box ∩ that region. Dragging inside moves `I` (clamped so that it covers `W`), the 8 handles move the edges of `W` (clamped into `I`), the slider scales `I` around the centre of `W`.
Nothing is written before the end. **Fertig / Enter / a click beside the picture** write ONE undo step: the box becomes `W` (the centre is moved through the rotation and the flip of the element, so the window stays exactly where it was on
the page) and `crop = { x: (W.x - I.x) / I.w, y, w: W.w / I.w, h }`. **Escape / Abbrechen** throw the changes away. `D.crop.state()` gives `{ id, I, W, zoom }` (the browser checks use it); `D.canvas.setModal` keeps the canvas from starting gestures.

## The pages Effekte and Anpassen

Opened by the toolbar (`D.panels.openPage('effects' | 'adjust')`, back arrow). **Effekte** (text): presets Keine, Schatten, Anheben, Kontur, Hohl, Hintergrund, Gebogen (previews drawn by the engine; each preset first resets shadow, outline, background and curve,
then writes its own; *Hohl* = outline in the old text colour and the text filled with the page colour, because `color` is hex only) and below them the single properties (`shadow`, `outline`, `background`, `curve`). **Anpassen** (image): looks
and the sliders of `filters` (brightness, contrast, saturation, blur, grayscale, sepia), "Zurücksetzen". Both follow the selection (`reselect`) and undo.

## Comments (`designer.panel-comments.js`)

Registered like any rail panel (`id: 'comments'`, `order: 65`, `badge()` = the open threads; `D.panels.refreshBadges()` redraws the badge after a refresh of the list). `D.comments.init(app, config)` is called by `designer.js` after the panels and the page strip; the panel can be built BEFORE that (a panel that was open at the last visit is built by `D.panels.init`), so `build` takes `app` from its api.
The module keeps all state (threads, filter, drafts of the composer, of the reply boxes and of an edit, the pin of the comment being written) itself, so the panel can be rebuilt at any time (`D.panels.open` always rebuilds) and the list can be redrawn after every refresh without losing what somebody typed, or the focus.

* **Server**: `GET /api/designs/{id}/comments` (threads, `open`, `total`, `canComment`; every row has `canEdit/canDelete/canResolve`), `GET .../comments/mentions?q=`, `POST .../comments` (`{ text, pageId?, elementId?, x?, y?, parentId?, mentions? }`), `POST /api/comments/{id}/edit|resolve|reopen|delete`. A viewer (read-only editor) may comment, reply, edit and delete the own, resolve the own thread. The list is fetched at start, every 30 s while the tab is visible, on `visibilitychange` and after an own write.
* **Pins**: `drawPins()` (one rAF; on `doc`, `page`, `pages`, `zoom`, `rendered`, `readonly`) keeps one `button.dt-pin` per visible pin in `#dt-pins` (keyed by thread, reused) and sets `--dt-pin-x/-y` in screen px (`document unit x app.scale()`). A pin with an element follows `D.toWorld(chain, centre)` of the element as long as it exists on the page, else the stored point. Only the pins of the current page; resolved ones only for the filters Erledigt/Alle; the pin being written is the dashed `is-draft`. A pin stops `pointerdown` (the canvas would start a gesture under it) and opens its thread (`openThread(id)`: panel, filter that shows it, page, selects the element, scrolls the pin into view, marks card and pin `is-active`).
* **Setting a pin**: `startPlacing()` uses `D.canvas.setModal({ onDown })` (crosshair through `.is-commenting`, the banner `.dt-cm-hint`; Esc cancels). The panel is opened one tick after the pin was placed, because `designer.js` closes a drawer or sheet on `pointerdown` of the canvas.
* **Entries**: the key **K** (`designer.shortcuts.js`), the context menu "Kommentieren" (`D.contextItems`; the empty page: "Kommentar hier schreiben" with the clicked point, `D.pageMenuItems(point)`), the phone's Mehr menu. `D.comments.compose({ elementId } | { point })` opens the composer; without options a single selected element is used. `?comment=<id>` opens the panel on that thread.
* **Mentions** (`attachMentions(textarea, wrap, { picked, onChange })`): `@` and the start of a name asks `/comments/mentions?q=` (150 ms debounce, the people who can see the design), arrows/Enter/Tab/Esc; the text gets `@Name `, the object `picked` (id -> name) is what the request sends as `mentions` (only those whose `@Name` is still in the text). The server checks all of it again.
* **Rules for changes**: text only through `textContent` (a mention is highlighted by splitting the text and building `span.dt-cm-mention` nodes); no `innerHTML`, no style attributes (pin places are custom properties); a new write path must refresh through `load()`.

## How to extend

* **A toolbar control** for a kind: `D.toolbar.extend('text', function (ctx, controls) { controls.splice(3, 0, ctx.button({ icon, label, pressed: function () {…}, onClick: function () {…} })); })`.
  `ctx` has `ids`, `els`, `first()`, `kind`, `disabled` (viewer or all locked) and the helpers `ctx.button`, `ctx.popoverButton({ build(el, api) })`, `ctx.colourButton`, `ctx.refresh(fn)`
  (runs on every change while the selection stays the same; the toolbar is only rebuilt when its signature changes). A whole new kind: `D.toolbar.register(kind, build)`.
* **A panel**: `D.panels.register({ id, title, label, icon, order, build: function (host, api) {…} })`; `api.on(event, fn)` is unsubscribed when the panel is hidden, `api.rebuild()`.
  A **context page** (Position, later Effekte/Anpassen/Farbe): `page: true`, opened with `D.panels.openPage(id)` (back arrow), `needsSelection: true` returns when nothing is selected.
  Tiles that can be dragged onto the canvas: `D.dnd.attach(tile, { ghost, onClick, onDrop(x, y) })`.
* **A context-menu entry**: add to `D.contextItems` (`{ label, icon, shortcut, run, disabled: true | 'reason', danger, checked, submenu, hidden }`).
* **A shortcut**: `designer.shortcuts.js` (and the list `D.shortcuts.list` for the dialog).
* **A colour section** (gradients, eyedropper): push `{ id, title, order, build(host, ctx) }` to `D.colors.sections`.
* **A colour tab** (like Verlauf): push `{ id, title, build(host, ctx) }` to `D.colors.tabs`; it is shown for pickers opened with `allowGradient`. `ctx.value()` / `ctx.set(value, final)` as for sections.
* **A colour field in a panel**: `D.ui.colour({ label, get, apply(value, final), allowNone, allowGradient })` (a button with a swatch that opens the picker).
* **The toolbar replaced for a mode** (crop mode): `D.toolbar.setOverride(function (ctx) { return [controls]; })` until `setOverride(null)`; `D.canvas.setModal({ onDown(ev), hideOverlay: true })` keeps the canvas from starting gestures and from drawing the selection.

## Server contracts used

`GET/POST /api/designs/{id}` (`{ revision, document, autosave }`; 409 → dialog; autosaves of one person within 10 minutes share one history entry, Ctrl+S makes a new one),
`/rename`, `/copy`, `/thumbnail`, `/resize`; `POST /api/designs` (one-click create); `GET /api/formats`, `/api/templates`, `/api/brand`, `/api/fonts`, `/api/assets?q&category&sort&take`,
`POST /api/assets/upload`, `POST /api/fonts/upload`, `GET /api/datalists`, `/api/datalists/{id}/rows`, `/lib/icons.json`; sharing (P3): `GET /api/share/design/{id}` (the people with access), `POST /api/designs/{id}/presence`, `POST /api/items/copy`; comments (P5): see "Comments". Every POST carries `RequestVerificationToken`.

## Checks

`tests/e2e/designer-check.js` (mechanics: pointer, keyboard, snapping, undo, layers, fields, preview data, autosave/draft/offline, conflict, viewer, demo label, tablet, phone),
`tests/e2e/canva-check.js` (rail and panels, toolbar, context menu, paste/drop, media browser, pages, groups, interaction, autosave, 409, Herunterladen, viewer, tablet, drawer, phone) and
`tests/e2e/content-check.js` (K4: Elemente sections and search, icons in batches, Schriftkombinationen, the toolbar of every kind, Effekte, Anpassen, masks, crop mode incl. rotation, colour picker and gradients, Marke, Vorlagen,
Größe ändern, media browser in the data list grid and the single print, viewer, phone; `--only elements,text,...` runs sections).
`tests/e2e/comments-check.js` (P5: panel, pins, replies, resolve, mentions and notifications, the read-only editor, pins not in a download, the deep link, phone).
Shared helpers: `tests/e2e/editor-lib.js` (state, gestures, PNG files in memory, synthetic paste/drop events, downloads, touch).
