# The editor (Designs/Designer): architecture

The editor is the Canva-style heart of DesignThix (`docs/PLAN-CANVA.md` §1 items 4 to 19). `Pages/Designs/Designer.cshtml` is only the frame (top bar, rail, panel,
toolbar, canvas, page strip, tab bar); the scripts in `wwwroot/js/designer*.js` build everything else with DOM APIs (no `innerHTML`, no inline style: data goes in through
`textContent`, attributes and the CSSOM). The document is the normalised schema 2 document of `DtEngine` (pages, groups); the engine draws it, nothing else does.
Styles: `wwwroot/css/designer.css` (+ `dt-media.css` for the media browser), MatUi tokens only, flat (borders; only menus, popovers and dialogs have the MatUi shadow).

## Layout

```
.dt-top      back | Datei ▾ | undo redo | save state | name (click to rename) | Serie | Herunterladen | Drucken
.dt-rail     Vorlagen Elemente Text Uploads Marke Ebenen Daten (Zusatz)        .dt-panel (≈ 340 px, collapsible; context pages with a back arrow)
.dt-ds__center  .dt-ctx (contextual toolbar) / canvas (#dt-viewport > #dt-sheet > #dt-page + #dt-overlay) / .dt-bottom (page strip, zoom)
.dt-tabbar   phones only: Elemente Text Uploads Ebenen Mehr
```

>= 1024 px everything is side by side. 768 to 1023 px the panel is an overlay drawer next to the rail (closes on a tap on the canvas, after adding something) and the toolbar scrolls
sideways. < 768 px a phone editor: the rail is the tab bar at the bottom, the panel a bottom sheet, popovers bottom sheets, the toolbar a scroller above the tab bar, handles have
a 44 px hit area. A viewer (`canEdit=false`) gets the same page with `is-readonly`: everything visible, nothing editable; Herunterladen and Drucken work.

## Modules (load order, see the end of `Designer.cshtml`)

| File | What it is |
|---|---|
| `designer.core.js` | `window.DtDesigner` (`D`): DOM builders (`D.el`, `D.svg`, `D.icon`), geometry (rotation, **frames of groups**), fonts, icon library loader, document helpers (`D.walk`, `D.fixGroups`, `D.cloneNodes`, `D.idMaker`), and **`D.createApp`**: the state and every command (see below). |
| `designer.canvas.js` | Drawing (`renderInto`, `mode: 'editor'`), the overlay (hover, selection, 8 handles, rotate handle below, marquee, guides, distance markers, size/angle tooltip), pointer gestures (move, resize, rotate, marquee, pan, pinch, long press), hit testing, snapping (edges, centres, equal spacing), zoom, inline text editing, drop targets. `D.canvas.*`. |
| `designer.menu.js` | `D.menu.open(items, {x,y} \| {anchor})` (context menus, Datei, ⋯: `mat-menu` classes, submenus, shortcuts at the right, disabled with a reason, keyboard), `D.popover.open(anchor, build)`, `D.dialog.show(opts)` (MatUi dialogs from DOM APIs). |
| `designer.ui.js` | Form blocks that return handles `{ el, set(v) }`: `D.ui.number/select/segmented/switchBox/slider/field/section/iconButton/textButton`. |
| `designer.colors.js` | The colour popover `D.colors.open` with an extension point `D.colors.sections` (document colours, brand colours, palette; K4 adds gradients). |
| `designer.commands.js` | `D.cmd.*` (copy, cut, paste, group, order, replaceImage, setAsBackground, bindField …) and the menus: `D.contextItems(node)`, `D.pageMenuItems()`, `D.pageThumbItems(i)`. |
| `designer.toolbar.js` | The contextual toolbar (kinds: page, text, image, strip, shape, line, icon, qr, barcode, group, multi). `D.toolbar.register/extend`. |
| `designer.panels.js` | The rail and panel framework `D.panels.register(def)`, plus the panels Elemente, Text, Vorlagen, Marke. |
| `designer.panel-uploads.js`, `-layers.js`, `-data.js`, `-position.js` | Uploads, Ebenen (tree), Daten (Zusatz) (+ `D.data`, the preview state), Position (context page). |
| `designer.pages.js` | The bottom bar: page strip (thumbnails drawn by the engine, drag to reorder, menu) and the zoom controls. |
| `designer.io.js` | `D.dnd.attach` (tiles to the canvas), uploads of images and fonts, **paste** and **drop** of files. |
| `designer.save.js` | Autosave, revision check (409 dialog), local draft, offline, keepalive on `pagehide`, thumbnail. `D.save`. |
| `designer.file.js` | Datei menu, Größe ändern, Neues Design, Herunterladen (PNG/JPG/SVG/ZIP, PDF → print view), Drucken. `D.file`. |
| `designer.shortcuts.js` | Keyboard, clipboard events (copy/cut), the Tastenkürzel dialog. |
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
sources (`setSource`), `computeValues`, assets (`assetUrl`, `addAssets`).

**Events** (`app.on(name, fn)`): `doc {reason, render, structure}`, `selection`, `history`, `page`, `pages`, `preview`, `state`, `fonts`, `assets`, `brand`, `datalists`, `zoom`,
`readonly`, `editing`, `warnings`, `rendered`, `dirty`, `uploaded`, `panel`, plus `contextmenu {x, y, node}`, `node:dblclick {node}` (an image: hook for the crop UI) and `format 'b'|'i'|'u'`.

### Coordinates, groups

All geometry is in document units. A **group** holds its children in *page coordinates* (the frame before its own rotation); the group's `x,y,w,h` is the union of the children
(kept by `D.fixGroups`), its rotation/flip apply around the centre of that box. Moving a group translates its descendants (`D.translate`), resizing scales them (`D.setBox`).
Pointer work on a node inside groups converts the pointer into its frame (`D.toFrame(chain, p)`), the overlay draws back to the page (`D.toWorld(chain, p)`).
A click selects the top-level node (the whole group); a double click or a click while the selection is inside a group selects the child; Ctrl+click selects deep.

During a drag the document is changed live but the engine does not run: the node's `<g>` gets a transform (move, rotate), a resize renders once per frame; on release the engine draws.

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
* **The crop UI** (K4): define `D.crop = { start(id) }`; the toolbar and the context menu then offer "Zuschneiden" and a double click on an image calls it.

## Server contracts used

`GET/POST /api/designs/{id}` (`{ revision, document, autosave }`; 409 → dialog; autosaves of one person within 10 minutes share one history entry, Ctrl+S makes a new one),
`/rename`, `/copy`, `/thumbnail`, `/resize`; `POST /api/designs` (one-click create); `GET /api/formats`, `/api/templates`, `/api/brand`, `/api/fonts`, `/api/assets?q&category&sort&take`,
`POST /api/assets/upload`, `POST /api/fonts/upload`, `GET /api/datalists`, `/api/datalists/{id}/rows`, `/lib/icons.json`. Every POST carries `RequestVerificationToken`.

## Checks

`tests/e2e/designer-check.js` (mechanics: pointer, keyboard, snapping, undo, layers, fields, preview data, autosave/draft/offline, conflict, viewer, demo label, tablet, phone) and
`tests/e2e/canva-check.js` (rail and panels, toolbar, context menu, paste/drop, media browser, pages, groups, interaction, autosave, 409, Herunterladen, viewer, tablet, drawer, phone).
Shared helpers: `tests/e2e/editor-lib.js` (state, gestures, PNG files in memory, synthetic paste/drop events, downloads, touch).
