// Checks the mechanics of the editor in a real browser (installed Edge, headless): drawing with the pointer and the keyboard, snapping, undo, layers, the Daten panel (fields,
// preview with a data list), autosave, drafts and offline, the edit conflict, the viewer, the demo label of docs/PLAN.md section 1.2, a tablet with touch and a phone. The Canva-style
// features (rail, context menu, paste and drop, media browser, pages, groups, download) are in canva-check.js. Screenshots at 1440x900, 1024x768 and 390x844 go to the temp folder
// (designer-*.png; the screenshots of the README come from screens.js). Zero console errors and zero CSP violations are part of the result.
//
//   cd tests/e2e && npm install
//   node designer-check.js [base url, default http://localhost:3043] [--out <folder for the screenshots, default: the temp folder>]
//
// Accounts: tests/e2e/test-account.json ({ "designer": {email,password}, "viewer": {...}, "admin": {...} }) is used when it exists. On an empty database the setup assistant creates the
// administrator (admin@example.com), who creates a designer and a viewer through the admin pages; the file is written.
const fs = require('fs');
const path = require('path');
const lib = require('./lib.js');
const E = require('./editor-lib.js');
const { demoDocument, demoRows } = require('./demo-label.js');

const args = process.argv.slice(2);
const { base, problems, dialogs, watch, launch, newContext, login, ensureAccounts, postJson, shareWith, uploadImage, purgeImage } = lib(args, { ignore: /status of (403|409)|ERR_INTERNET_DISCONNECTED/ });
const outIndex = args.indexOf('--out');
const outDir = path.resolve(outIndex >= 0 ? args[outIndex + 1] : path.join(require('os').tmpdir(), 'matcan-designer-check'));

const results = [];
let current = '';
const check = (name, ok, detail) => { results.push({ name: current + name, ok: !!ok, detail }); };
const { idle, raf2, state, nodeOf, openDesigner, createDesign, geometry, handleCentre, drag, selectIds, waitState, svgText, near, openPanel, touchDrag } = E;

const snap = (page, on) => page.evaluate(v => { window.DtDesigner.app.snapping = v; }, on);
const elementOf = (page, id) => nodeOf(page, id);
async function shot(page, name) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, name);
  await page.screenshot({ path: file });
  console.log('screenshot ' + file);
  return file;
}
/** Puts the text into the inline editor of the selected text element and commits with Ctrl+Enter. */
async function typeInto(page, text) {
  await page.waitForSelector('.dt-textedit');
  await page.keyboard.press('Control+a');
  await page.keyboard.type(text);
  await page.keyboard.press('Control+Enter');
  await idle(page);
}

(async () => {
  const browser = await launch();
  const accounts = await ensureAccounts(browser);
  const context = await newContext(browser, { viewport: { width: 1440, height: 900 } });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  const page = await context.newPage();
  watch(page, 'designer');
  if (process.env.DT_DEBUG) { page.on('console', m => console.log('console:', m.type(), m.text().slice(0, 300))); }
  if (!await login(page, accounts.designer)) { throw new Error('Anmeldung des Gestalters fehlgeschlagen.'); }

  // ---------------------------------------------------------------------------------------- 1. a new design (one click), the page
  current = 'create: ';
  const made = await createDesign(page, postJson, { preset: 'label-150x100' });
  const designId = made.id;
  await openDesigner(page, base, designId);
  let s = await state(page);
  check('the designer opens a new 150 x 100 mm design with one empty page', s.doc.width === 150 && s.doc.height === 100 && s.doc.unit === 'mm' && s.elements.length === 0 && s.pages.length === 1);
  check('the state says saved', s.saveState === 'saved' && (await page.textContent('#dt-state-text')).trim() === 'Alle Änderungen gespeichert');
  check('the page is drawn at the fitted zoom', (await page.evaluate(() => document.getElementById('dt-sheet').getBoundingClientRect().width)) > 300);
  check('the toolbar shows the page', (await page.getAttribute('#dt-ctx', 'data-kind')) === 'page');

  // ---------------------------------------------------------------------------------------- 2. text with a placeholder, fields in the Daten panel
  current = 'text: ';
  await openPanel(page, 'text');
  await page.click('.dt-textadd__btn[data-add="body"]');
  await typeInto(page, '{{Name}}');
  s = await state(page);
  const text = s.elements.find(e => e.type === 'text');
  const textId = text.id;
  check('a text element with {{Name}}', !!text && text.text === '{{Name}}', text && text.text);
  check('the placeholder without a field is reported in the bar and on the rail', await page.isVisible('#dt-warnbar') && (await page.textContent('#dt-warnbar')).includes('Name') && await page.isVisible('.dt-rail__btn[data-panel="data"] .dt-rail__badge'));
  await page.click('#dt-warnbar button');
  await page.waitForFunction(() => window.DtDesigner.panels.current() === 'data');
  await page.click('.dt-fieldwarn button:has-text("Feld anlegen")');
  await idle(page);
  s = await state(page);
  check('field Name created from the warning', s.fields.some(f => f.key === 'Name'));
  await page.fill('[aria-label="Beispielwert für Name"]', 'Holunderblüte');
  await idle(page);
  check('the sample value is drawn', (await svgText(page)).includes('Holunderblüte'), await svgText(page));
  check('the warning is gone', !(await page.isVisible('#dt-warnbar')));
  await page.click('button:has-text("Neues Feld")');
  await page.fill('.dt-fieldform--new input[aria-label="Schlüssel"]', 'Preis');
  await page.selectOption('.dt-fieldform--new select[aria-label="Art"]', 'price');
  await page.fill('.dt-fieldform--new input[aria-label="Beispielwert"]', '2.99');
  await page.click('.dt-fieldform--new button:has-text("Feld anlegen")');
  s = await state(page);
  const priceField = s.fields.find(f => f.key === 'Preis');
  check('field Preis (price) created with 2 decimals', !!priceField && priceField.type === 'price' && priceField.decimals === 2);
  await selectIds(page, [textId]);
  await page.click('.dt-field:has(.dt-field__key:text-is("Preis")) .dt-field__insert');
  await idle(page);
  check('"In Text einfügen" appends {{Preis}}', (await nodeOf(page, textId)).text === '{{Name}} {{Preis}}');
  check('price formatted as 2,99', (await svgText(page)).includes('2,99'), await svgText(page));
  // a placeholder inserted while the text is edited goes in at the caret
  await page.dblclick('#dt-page svg text >> nth=0').catch(async () => { const g = await geometry(page, textId); await page.mouse.dblclick(g.cx, g.cy); });
  await page.waitForSelector('.dt-textedit');
  await page.keyboard.press('Control+a');
  await page.keyboard.type('Preis: ');
  await page.click('.dt-field:has(.dt-field__key:text-is("Preis")) .dt-field__insert');
  await page.keyboard.press('Control+Enter');
  await idle(page);
  check('while editing, the button inserts at the caret', (await nodeOf(page, textId)).text === 'Preis: {{Preis}}', (await nodeOf(page, textId)).text);
  await page.evaluate(id => window.DtDesigner.app.setProps([id], { text: '{{Name}} {{Preis}}' }, { merge: false }), textId);

  // ---------------------------------------------------------------------------------------- 3. an image from the library, bound to a field
  current = 'image: ';
  await openPanel(page, 'uploads');
  await page.click('button:has-text("Alle Medien")');
  await page.waitForSelector('dialog.dt-media[open]');
  await page.click('.dt-media__tab[data-tab="flags"]');
  await page.waitForSelector('.dt-media__tile[data-key="flag-de"]');
  await page.click('.dt-media__tile[data-key="flag-de"]');
  await page.waitForSelector('dialog.dt-media', { state: 'detached' });
  await idle(page);
  s = await state(page);
  const image = s.elements.find(e => e.type === 'image');
  check('a picture of the library becomes an image element with the asset', !!image && image.source && image.source.asset === 'flag-de');
  check('sized by aspect ratio, at most 40 % of the page', image && near(image.w / image.h, 1.5, 0.05) && image.w <= 60.01 && image.h <= 40.01, image && `${image.w} x ${image.h}`);
  check('the new image is selected', s.sel.length === 1 && s.sel[0] === image.id);
  const imageId = image.id;
  await rightClickNode(page, imageId);
  await page.locator('.dt-menu__item', { has: page.locator('.dt-menu__label', { hasText: /^Feld zuweisen/ }) }).click();
  await page.locator('.dt-menu[data-level="1"] .dt-menu__item', { has: page.locator('.dt-menu__label', { hasText: /^Neues Bildfeld/ }) }).click();
  await idle(page);
  const bound = await nodeOf(page, imageId);
  check('"Feld zuweisen" binds the image to a new image field', bound.source && bound.source.field === 'Bild1', JSON.stringify(bound.source));
  await openPanel(page, 'data');
  check('the field appears in the Daten panel with a thumbnail button for the sample', await page.isVisible('.dt-field:has(.dt-field__key:text-is("Bild1")) button:has-text("Beispielbild wählen")'));
  await page.click('.dt-field:has(.dt-field__key:text-is("Bild1")) button:has-text("Beispielbild wählen")');
  await page.waitForSelector('dialog.dt-media[open]');
  await page.click('.dt-media__tab[data-tab="flags"]');
  await page.waitForSelector('.dt-media__tile[data-key="flag-de"]');
  await page.click('.dt-media__tile[data-key="flag-de"]');
  await page.waitForSelector('dialog.dt-media', { state: 'detached' });
  await idle(page);
  check('the sample of a picture field is chosen in the media browser', (await state(page)).fields.find(f => f.key === 'Bild1').sample === 'flag-de');
  check('the bound image is drawn from the sample value', (await page.evaluate(() => document.querySelectorAll('#dt-page svg image').length)) === 1);

  // ---------------------------------------------------------------------------------------- 4. move, resize, rotate by pointer
  current = 'pointer: ';
  await snap(page, false);
  let g = await geometry(page, imageId);
  await drag(page, { x: g.cx, y: g.cy }, { x: g.cx + 60, y: g.cy + 40 });
  let e = await elementOf(page, imageId);
  check('move by 60 / 40 px', near(e.x - g.x, 60 / g.k, 0.05) && near(e.y - g.y, 40 / g.k, 0.05), `${(e.x - g.x).toFixed(2)} / ${(e.y - g.y).toFixed(2)} mm, expected ${(60 / g.k).toFixed(2)} / ${(40 / g.k).toFixed(2)}`);
  check('moving is one undo step', (await page.evaluate(() => window.DtDesigner.app.undoStack.length)) >= 1);
  g = await geometry(page, imageId);
  const se = await handleCentre(page, 'se');
  await drag(page, se, { x: se.x + 40, y: se.y + 20 }, { holdAfterDown: ['Shift'] });
  e = await elementOf(page, imageId);
  check('Shift keeps the aspect ratio while resizing', near(e.w / e.h, g.w / g.h, 0.02) && e.w > g.w, `${g.w.toFixed(2)}x${g.h.toFixed(2)} -> ${e.w.toFixed(2)}x${e.h.toFixed(2)}`);
  const rot = await handleCentre(page, 'rot');
  await drag(page, rot, { x: rot.x + 70, y: rot.y - 30 }, { holdAfterDown: ['Shift'] });
  e = await elementOf(page, imageId);
  check('rotating with Shift snaps to 15 degrees', e.rotation !== 0 && Math.abs(e.rotation / 15 - Math.round(e.rotation / 15)) < 1e-6, String(e.rotation));
  const rotated = e.rotation;
  await page.keyboard.press('Escape');
  g = await geometry(page, imageId);
  await page.mouse.click(g.cx, g.cy);
  check('click selects the rotated element (hit testing follows the rotation)', (await state(page)).sel[0] === imageId);

  // ---------------------------------------------------------------------------------------- 5. undo / redo
  current = 'history: ';
  const undoCount = await page.evaluate(() => window.DtDesigner.app.undoStack.length);
  await page.keyboard.press('Control+z');
  await idle(page);
  e = await elementOf(page, imageId);
  check('Ctrl+Z undoes the rotation (one step)', e.rotation === 0, String(e.rotation));
  check('the undo stack shrank by one', (await page.evaluate(() => window.DtDesigner.app.undoStack.length)) === undoCount - 1);
  await page.keyboard.press('Control+y');
  await idle(page);
  check('Ctrl+Y redoes it', (await elementOf(page, imageId)).rotation === rotated);
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+Shift+z');
  await idle(page);
  check('Ctrl+Shift+Z redoes as well', (await elementOf(page, imageId)).rotation === rotated);
  check('undo and redo buttons follow the stacks', !(await page.isDisabled('#dt-undo')) && (await page.isDisabled('#dt-redo')));
  await page.click('#dt-undo');
  await page.click('#dt-redo');
  check('the top bar buttons undo and redo', (await elementOf(page, imageId)).rotation === rotated);

  // ---------------------------------------------------------------------------------------- 6. snapping and guides
  current = 'snap: ';
  await snap(page, true);
  await page.evaluate(id => window.DtDesigner.app.setProps([id], { rotation: 0 }, { merge: false }), imageId);
  await idle(page);
  g = await geometry(page, imageId);
  const target = { x: g.left + 75 * g.k + 3, y: g.cy };       // 3 px right of the page centre line: snaps (threshold 6 px)
  let guideSeen = false;
  await drag(page, { x: g.cx, y: g.cy }, { x: target.x, y: target.y }, {
    beforeUp: async () => { await page.waitForTimeout(120); guideSeen = (await page.evaluate(() => document.querySelectorAll('.dt-ov-guide').length)) > 0; },
  });
  e = await elementOf(page, imageId);
  check('the centre snaps to the page centre', near(e.x + e.w / 2, 75, 0.01), String(e.x + e.w / 2));
  check('a guide is visible while dragging', guideSeen);
  await snap(page, false);
  g = await geometry(page, imageId);
  await drag(page, { x: g.cx, y: g.cy }, { x: g.cx + 3, y: g.cy + 2 });
  check('switching snapping off (the magnet) lets the element go where the pointer goes', !near((await elementOf(page, imageId)).x + (await elementOf(page, imageId)).w / 2, 75, 0.001));
  await page.click('#dt-snap');
  check('the magnet button is the switch', (await page.getAttribute('#dt-snap', 'aria-pressed')) === 'true');

  // ---------------------------------------------------------------------------------------- 7. multi selection, align (Position page)
  current = 'align: ';
  await openPanel(page, 'elements');
  await page.click('.dt-tile[data-add="rect"]');
  await idle(page);
  const rectId = (await state(page)).sel[0];
  await snap(page, false);
  g = await geometry(page, rectId);
  await drag(page, { x: g.cx, y: g.cy }, { x: g.cx - 120, y: g.cy + 60 });
  const sheet = await page.evaluate(() => { const r = document.getElementById('dt-sheet').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
  await page.keyboard.press('Escape');
  await drag(page, { x: sheet.l - 25, y: sheet.t - 25 }, { x: sheet.l + sheet.w + 25, y: sheet.t + sheet.h + 25 });
  s = await state(page);
  check('the marquee selects everything it touches', s.sel.length === s.elements.length && s.sel.length === 3, String(s.sel.length));
  await page.keyboard.press('Escape');
  await page.mouse.click((await geometry(page, rectId)).cx, (await geometry(page, rectId)).cy);
  await page.keyboard.down('Shift');
  const gi = await geometry(page, imageId);
  await page.mouse.click(gi.cx, gi.cy);
  await page.keyboard.up('Shift');
  s = await state(page);
  check('Shift+click adds to the selection', s.sel.length === 2, String(s.sel.length));
  await page.click('#dt-ctx button:has-text("Position")');
  await page.waitForFunction(() => document.getElementById('dt-panel-title').textContent.trim() === 'Position');
  await page.click('#dt-panel .mat-seg__btn:has-text("An Auswahl")');
  await page.click('#dt-panel [data-align="left"]');
  await idle(page);
  const boxes = (await state(page)).elements.filter(e2 => [rectId, imageId].includes(e2.id));
  check('align left puts both left edges on one line', near(boxes[0].x, boxes[1].x, 0.01), boxes.map(b => b.x).join(' / '));
  await page.click('#dt-panel [data-align="middle"]');
  await idle(page);
  const mid = (await state(page)).elements.filter(e2 => [rectId, imageId].includes(e2.id));
  check('align middle puts both centres on one line', near(mid[0].y + mid[0].h / 2, mid[1].y + mid[1].h / 2, 0.01));
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await idle(page);
  await page.click('#dt-panel-back');

  // ---------------------------------------------------------------------------------------- 8. properties of the text in the toolbar
  current = 'properties: ';
  await page.keyboard.press('Escape');
  await page.evaluate(([i, r, tx]) => { const a = window.DtDesigner.app; a.setProps([i], { x: 5, y: 5 }, { merge: false }); a.setProps([r], { x: 110, y: 75 }, { merge: false }); a.setProps([tx], { x: 40, y: 62 }, { merge: false }); }, [imageId, rectId, textId]);
  await idle(page);
  await selectIds(page, [textId]);
  await page.click('#dt-ctx button[aria-label="Textfarbe"]');
  await page.fill('.dt-colorpop .dt-colour__hex', '#ff0000');
  await idle(page);
  check('hex colour changes the text colour', (await elementOf(page, textId)).color === '#ff0000');
  await page.keyboard.press('Escape');
  await page.click('#dt-ctx .dt-tb--font');
  await page.fill('.dt-fontpop input[type=search]', 'Montserrat');
  await page.click('.dt-fontlist__item');
  await idle(page);
  e = await elementOf(page, textId);
  check('the font picker sets the family', e.fontFamily === 'Montserrat', e.fontFamily);
  const weightChips = await page.$$eval('.dt-fontpop__weights .dt-chipbtn', b => b.map(x => x.textContent));
  check('the weights offered are those of the family (9 steps for a variable font)', weightChips.length === 9 && weightChips[0] === 'Thin' && weightChips[8] === 'Black', weightChips.join(','));
  await page.click('.dt-fontpop__weights .dt-chipbtn:text-is("Light")');
  check('a weight chip sets the weight', (await elementOf(page, textId)).fontWeight === 300);
  await page.keyboard.press('Escape');
  await page.fill('#dt-ctx .dt-tb__size input', '30');
  await page.keyboard.press('Enter');
  await idle(page);
  check('size in pt', (await elementOf(page, textId)).fontSize === 30);
  await page.click('#dt-ctx button[aria-label="Abstand und Textfeld"]');
  await page.waitForSelector('.dt-popover');
  await page.selectOption('.dt-popover select[aria-label="Passend machen"]', 'shrink');
  check('"Passend machen" (shrink to fit) is in the spacing popover', (await elementOf(page, textId)).fit === 'shrink' && await page.isVisible('.dt-popover input[aria-label="Kleinste Größe"]'));
  await page.click('.dt-popover .mat-seg__btn[aria-label="Unten"]');
  check('and the vertical alignment', (await elementOf(page, textId)).valign === 'bottom');
  await page.keyboard.press('Escape');
  await page.evaluate(id => window.DtDesigner.app.setProps([id], { fit: 'none', valign: 'top' }, { merge: false }), textId);
  // typing makes the box grow
  await page.evaluate(id => window.DtDesigner.app.setProps([id], { fontSize: 14, w: 60, h: 8 }, { merge: false }), textId);
  const hBefore = (await elementOf(page, textId)).h;
  const gt = await geometry(page, textId);
  if (process.env.DT_DEBUG) { console.log('DEBUG text', JSON.stringify(await elementOf(page, textId)).slice(0, 300), JSON.stringify(gt.rect), JSON.stringify((await state(page)).sel)); await shot(page, 'debug-text.png'); }
  await page.mouse.dblclick(gt.cx, gt.cy);
  await typeInto(page, 'Zeile eins\nZeile zwei\nZeile drei\nZeile vier');
  check('a text box grows to the height its text needs', (await elementOf(page, textId)).h > hBefore * 2, `${hBefore} -> ${(await elementOf(page, textId)).h}`);

  // ---------------------------------------------------------------------------------------- 9. layers
  current = 'layers: ';
  await page.evaluate(id => window.DtDesigner.app.setProps([id], { text: '{{Name}} {{Preis}}', h: 10 }, { merge: false }), textId);
  await openPanel(page, 'layers');
  check('three layers listed', (await page.$$('.dt-layer')).length === 3);
  await page.dblclick(`.dt-layer[data-id="${imageId}"] .dt-layer__name`);
  await page.fill('.dt-layer__input', 'Flagge');
  await page.keyboard.press('Enter');
  await idle(page);
  check('rename by double click', (await elementOf(page, imageId)).name === 'Flagge');
  await page.click(`.dt-layer[data-id="${imageId}"] .dt-layer__toggle[aria-label^="Sperren"]`);
  check('lock toggle', (await elementOf(page, imageId)).locked === true);
  await page.keyboard.press('Escape');
  g = await geometry(page, imageId);
  await page.mouse.click(g.cx, g.cy);
  check('a locked element cannot be selected on the canvas', !(await state(page)).sel.includes(imageId));
  await page.click(`.dt-layer[data-id="${imageId}"]`);
  check('but through the layers panel', (await state(page)).sel.includes(imageId));
  check('a locked selection shows the lock in the toolbar', await page.isVisible('#dt-ctx button[aria-label="Entsperren"]'));
  await page.click(`.dt-layer[data-id="${imageId}"] .dt-layer__toggle[aria-label^="Entsperren"]`);
  await page.click(`.dt-layer[data-id="${imageId}"] .dt-layer__toggle[aria-label^="Ausblenden"]`);
  await idle(page);
  check('hiding a layer takes it off the page', (await elementOf(page, imageId)).hidden === true && !(await page.$('#dt-page [data-el-id="' + imageId + '"]')));
  await page.click(`.dt-layer[data-id="${imageId}"] .dt-layer__toggle[aria-label^="Einblenden"]`);
  const orderBefore = (await state(page)).elements.map(e2 => e2.id);
  await page.focus(`.dt-layer[data-id="${imageId}"] .dt-layer__grip`);
  await page.keyboard.press('ArrowUp');
  await idle(page);
  const orderAfter = (await state(page)).elements.map(e2 => e2.id);
  check('arrow up on the grip brings the layer forward', orderAfter.indexOf(imageId) === orderBefore.indexOf(imageId) + 1 || orderBefore.indexOf(imageId) === orderBefore.length - 1, orderBefore + ' -> ' + orderAfter);
  const grip = await page.$eval('.dt-layer >> nth=0', li => { const r = li.querySelector('.dt-layer__grip').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const lastRow = await page.$eval('.dt-layer >> nth=2', li => { const r = li.getBoundingClientRect(); return { x: r.left + 40, y: r.bottom - 2 }; });
  const topBefore = (await state(page)).elements.map(e2 => e2.id).reverse()[0];
  await drag(page, grip, lastRow);
  const bottomAfter = (await state(page)).elements[0].id;
  check('dragging a layer by its grip reorders', bottomAfter === topBefore, `${topBefore} -> bottom ${bottomAfter}`);

  // ---------------------------------------------------------------------------------------- 10. keyboard
  current = 'keyboard: ';
  await page.mouse.click(sheet.l - 30, sheet.t - 30);
  await page.keyboard.press('Control+a');
  check('Ctrl+A selects all', (await state(page)).sel.length === 3);
  await page.mouse.click(sheet.l - 30, sheet.t - 30);
  await page.evaluate(id => window.DtDesigner.app.select([id]), rectId);
  const rx = (await elementOf(page, rectId)).x;
  await page.keyboard.press('ArrowRight');
  check('arrow nudges by 0.5 mm', near((await elementOf(page, rectId)).x - rx, 0.5, 0.001));
  await page.keyboard.press('Shift+ArrowRight');
  check('Shift+arrow nudges by 5 mm', near((await elementOf(page, rectId)).x - rx, 5.5, 0.001));
  const count = (await state(page)).elements.length;
  await page.keyboard.press('Control+d');
  await idle(page);
  check('Ctrl+D duplicates', (await state(page)).elements.length === count + 1);
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  await idle(page);
  check('Ctrl+C / Ctrl+V pastes a copy', (await state(page)).elements.length === count + 2, String((await state(page)).elements.length));
  await page.keyboard.press('Delete');
  await page.keyboard.press('Control+z');
  await idle(page);
  check('Delete removes the selection, Ctrl+Z brings it back', (await state(page)).elements.length === count + 2);
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await idle(page);
  await page.keyboard.press('Escape');
  check('Escape deselects', (await state(page)).sel.length === 0);
  const z0 = (await state(page)).zoom;
  await page.keyboard.press('+');
  const z1 = (await state(page)).zoom;
  await page.keyboard.press('-');
  await page.keyboard.press('-');
  const z2 = (await state(page)).zoom;
  check('+ and - zoom', z1 > z0 && z2 < z1, `${z0} ${z1} ${z2}`);
  await page.keyboard.press('Control+0');
  check('Ctrl+0 fits the page', near((await state(page)).zoom, z0, 0.01));
  await page.keyboard.press('Control+1');
  check('Ctrl+1 is 100 %', near((await state(page)).zoom, 1, 0.001));
  await page.keyboard.press('Control+0');
  const wheelAt = await page.evaluate(() => { const r = document.getElementById('dt-viewport').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(wheelAt.x, wheelAt.y);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -300);
  await page.keyboard.up('Control');
  check('Ctrl+wheel zooms', (await state(page)).zoom > z0 * 1.2, String((await state(page)).zoom));
  await page.click('#dt-zoom-percent');
  await page.locator('.dt-menu__item', { has: page.locator('.dt-menu__label', { hasText: /^200 %$/ }) }).click();
  check('the percent menu sets a zoom', near((await state(page)).zoom, 2, 0.001));
  await page.$eval('#dt-zoom', r => { r.value = '50'; r.dispatchEvent(new Event('input', { bubbles: true })); });
  check('the zoom slider sets a zoom', near((await state(page)).zoom, 0.5, 0.001));
  await page.click('#dt-zoom-fit');
  check('Einpassen fits the page again', near((await state(page)).zoom, z0, 0.01));
  await page.click('#dt-zoom-percent');
  await page.locator('.dt-menu__item', { has: page.locator('.dt-menu__label', { hasText: /^400 %$/ }) }).click();
  await page.keyboard.down('Space');
  const vp = await page.evaluate(() => { const r = document.getElementById('dt-viewport').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const scrollA = await page.evaluate(() => { const v = document.getElementById('dt-viewport'); return [v.scrollLeft, v.scrollTop]; });
  await drag(page, vp, { x: vp.x - 80, y: vp.y - 50 });
  await page.keyboard.up('Space');
  const scrollB = await page.evaluate(() => { const v = document.getElementById('dt-viewport'); return [v.scrollLeft, v.scrollTop]; });
  await page.mouse.move(vp.x, vp.y);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(vp.x + 60, vp.y + 40, { steps: 5 });
  await page.mouse.up({ button: 'middle' });
  const scrollC = await page.evaluate(() => { const v = document.getElementById('dt-viewport'); return [v.scrollLeft, v.scrollTop]; });
  check('the middle mouse button pans the view', scrollC[0] < scrollB[0] || scrollC[1] < scrollB[1], `${scrollB} -> ${scrollC}`);
  check('Space + drag pans the view', scrollB[0] > scrollA[0] || scrollB[1] > scrollA[1], `${scrollA} -> ${scrollB}`);
  await page.click('#dt-zoom-fit');

  // ---------------------------------------------------------------------------------------- 11. inline text editing
  current = 'inline text: ';
  g = await geometry(page, textId);
  await page.mouse.dblclick(g.cx, g.cy);
  await page.waitForSelector('.dt-textedit');
  const taFont = await page.$eval('.dt-textedit', t => getComputedStyle(t).fontFamily);
  check('double click opens the editor over the element in its font', /Montserrat/.test(taFont), taFont);
  check('while editing the toolbar stays (text toolbar)', (await page.getAttribute('#dt-ctx', 'data-kind')) === 'text');
  await page.keyboard.press('Control+a');
  await page.keyboard.type('Neuer Text {{Name}} {{Preis}}');
  await page.keyboard.press('Control+b');
  await idle(page);
  check('Ctrl+B while typing toggles bold of the whole text', (await elementOf(page, textId)).fontWeight !== 300 && await page.isVisible('.dt-textedit'));
  await page.mouse.click(sheet.l - 30, sheet.t - 30);
  await idle(page);
  check('clicking outside commits', (await elementOf(page, textId)).text === 'Neuer Text {{Name}} {{Preis}}');
  await page.mouse.dblclick(g.cx, g.cy);
  await page.waitForSelector('.dt-textedit');
  await page.keyboard.press('Control+a');
  await page.keyboard.type('Zweiter Text');
  await page.keyboard.press('Escape');
  await idle(page);
  check('Escape ends the editing and keeps the text', (await elementOf(page, textId)).text === 'Zweiter Text' && !(await page.$('.dt-textedit')));
  await page.evaluate(id => window.DtDesigner.app.setProps([id], { text: 'Neuer Text {{Name}} {{Preis}}' }, { merge: false }), textId);

  // ---------------------------------------------------------------------------------------- 12. autosave, reload, persisted
  current = 'save: ';
  await waitState(page, 'saved', 15000);
  check('the changes were saved by themselves (no button)', !(await state(page)).dirty && !(await page.$('#dt-save')));
  check('the state says "Alle Änderungen gespeichert"', (await page.textContent('#dt-state-text')).trim() === 'Alle Änderungen gespeichert');
  const before = await state(page);
  const saved = await page.evaluate(async id => (await (await fetch('/api/designs/' + id)).json()), designId);
  check('the revision went up', saved.revision >= 2, String(saved.revision));
  check('the server holds the text', saved.document.pages[0].elements.some(e2 => e2.text === 'Neuer Text {{Name}} {{Preis}}'));
  let thumbStatus = 0;
  for (let i = 0; i < 24 && thumbStatus !== 200; i++) {
    thumbStatus = (await context.request.get(base + '/designs/' + designId + '/thumbnail.png')).status();
    if (thumbStatus !== 200) { await page.waitForTimeout(500); }
  }
  check('a thumbnail was posted after the save', thumbStatus === 200, String(thumbStatus));
  await page.reload();
  await page.waitForSelector('#dt-ds:not(.is-loading)');
  await idle(page);
  const after = await state(page);
  check('the document persisted after a reload', after.elements.length === before.elements.length && after.fields.length === before.fields.length && after.elements.some(e2 => e2.text === 'Neuer Text {{Name}} {{Preis}}'));
  check('the layer name persisted', after.elements.some(e2 => e2.name === 'Flagge'));

  // ---------------------------------------------------------------------------------------- 13. preview with a data list (Daten panel)
  current = 'preview: ';
  await page.goto(base + '/DataLists/Edit');
  await page.fill('#Input_Name', 'Designer-Check Liste');
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit].mat-btn--primary')]);
  const listId = Number(page.url().match(/DataLists\/Edit\/(\d+)/)[1]);
  await page.goto(`${base}/DataLists/Edit/${listId}?tab=columns`);
  await page.selectOption('form[action*="FromDesign"] select', String(designId));
  await Promise.all([page.waitForNavigation(), page.click('form[action*="FromDesign"] button[type=submit]')]);
  // an image that exists when the row is saved and is gone for good afterwards (a row may only name an image the person may use)
  const gone = await uploadImage(page, 'flag-xx');
  const rows = await page.evaluate(async ({ id, goneKey }) => {
    const grid = await (await fetch('/api/datalists/' + id + '/rows')).json();
    const token = document.querySelector('meta[name=dt-csrf]').content;
    const body = { revision: grid.revision, rows: [
      { id: null, values: { Name: 'Gouda', Preis: '3,49', Bild1: 'flag-nl' }, copies: 1, isActive: true },
      { id: null, values: { Name: 'Bergkäse', Preis: '4.25', Bild1: goneKey }, copies: 1, isActive: true },
      { id: null, values: { Name: 'Camembert', Preis: '2.19', Bild1: 'flag-fr' }, copies: 1, isActive: true },
    ] };
    const r = await fetch('/api/datalists/' + id + '/rows', { method: 'POST', headers: { 'Content-Type': 'application/json', RequestVerificationToken: token }, body: JSON.stringify(body) });
    return { status: r.status, columns: grid.columns.map(c => c.key) };
  }, { id: listId, goneKey: gone.key });
  await purgeImage(page, gone.id);
  check('the list has the columns of the design and three rows', rows.status === 200 && rows.columns.includes('Name') && rows.columns.includes('Preis') && rows.columns.includes('Bild1'), JSON.stringify(rows));
  await openDesigner(page, base, designId);
  await openPanel(page, 'data');
  check('the data selector is in the Daten panel, not in the top bar', await page.isVisible('#dt-panel select[aria-label="Daten für die Vorschau"]') && !(await page.$('#dt-data')));
  await page.selectOption('#dt-panel select[aria-label="Daten für die Vorschau"]', String(listId));
  await page.waitForFunction(() => /Zeile 1 von 3/.test(document.querySelector('#dt-panel .dt-rowinfo').textContent));
  await idle(page);
  check('row 1 is shown (Gouda, 3,49)', (await svgText(page)).includes('Gouda') && (await svgText(page)).includes('3,49'), await svgText(page));
  await page.click('#dt-panel button[aria-label="Nächste Zeile"]');
  await idle(page);
  check('next row: Bergkäse', (await svgText(page)).includes('Bergkäse') && /Zeile 2 von 3/.test(await page.textContent('#dt-panel .dt-rowinfo')));
  check('an unknown image key is reported', await page.isVisible('#dt-warnbar') && (await page.textContent('#dt-warnbar')).includes(gone.key), await page.textContent('#dt-warnbar'));
  await page.click('#dt-panel button[aria-label="Vorherige Zeile"]');
  await page.click('#dt-panel button[aria-label="Vorherige Zeile"]');
  await idle(page);
  check('the arrows wrap around', /Zeile 3 von 3/.test(await page.textContent('#dt-panel .dt-rowinfo')) && (await svgText(page)).includes('Camembert'));
  check('the link "Serienausgabe erstellen" is there', (await page.getAttribute('#dt-panel .dt-data__output', 'href')) === `/Outputs/Create?designId=${designId}`);
  await page.selectOption('#dt-panel select[aria-label="Daten für die Vorschau"]', '');
  await idle(page);
  check('back to the sample values', (await svgText(page)).includes('Holunderblüte'));
  // the display condition of the selected element
  await selectIds(page, [textId]);
  await page.selectOption('#dt-panel select[aria-label="Anzeigebedingung"]', 'Bild1');
  check('the display condition is a field', (await elementOf(page, textId)).showIf === 'Bild1');
  await page.selectOption('#dt-panel select[aria-label="Anzeigebedingung"]', '');
  // renaming a field key renames the placeholders
  await page.click('button[aria-label="Feld Name bearbeiten"]');
  await page.fill('.dt-fieldform input[aria-label="Schlüssel"]', 'Kaesesorte');
  await page.keyboard.press('Tab');
  await idle(page);
  s = await state(page);
  check('renaming a field key renames its placeholders', s.fields.some(f => f.key === 'Kaesesorte') && s.elements.some(e2 => e2.text === 'Neuer Text {{Kaesesorte}} {{Preis}}'), s.elements.map(e2 => e2.text).join('|'));
  await page.fill('.dt-fieldform input[aria-label="Schlüssel"]', 'Bad Key');
  await page.keyboard.press('Tab');
  check('an invalid key is refused with a message', await page.isVisible('.dt-field__error') && (await state(page)).fields.some(f => f.key === 'Kaesesorte'));
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');

  // ---------------------------------------------------------------------------------------- 14. draft and offline
  current = 'draft: ';
  await waitState(page, 'saved', 15000);   // a page that is left with unsaved changes sends them with the last request: the next page must not race it
  await openDesigner(page, base, designId);
  await page.evaluate(() => { const a = window.DtDesigner.app; a.select([a.elements()[0].id]); a.nudge(4, 0); });
  const draftX = (await state(page)).elements[0].x;
  await page.waitForTimeout(1100);
  check('a draft is kept in localStorage', await page.evaluate(id => !!localStorage.getItem('dt-draft-' + id), designId));
  if (process.env.DT_DEBUG) { await page.evaluate(() => window.DtDesigner.app.on('state', s => console.log('STATE ' + s + ' online=' + navigator.onLine + ' t=' + Math.round(performance.now())))); }
  await context.setOffline(true);
  await page.waitForFunction(() => window.DtDesigner.app.saveState === 'offline' || window.DtDesigner.app.saveState === 'error', null, { timeout: 15000 });
  check('offline: the state says it is saved later', (await page.textContent('#dt-state-text')).includes('Offline – wird später gespeichert'));
  await context.setOffline(false);
  await waitState(page, 'saved', 20000);
  check('it saves by itself when the connection is back', !(await state(page)).dirty && near((await state(page)).elements[0].x, draftX, 0.001));
  check('the draft is cleared after the save', await page.evaluate(id => localStorage.getItem('dt-draft-' + id) === null, designId));
  // a draft of an unfinished session is offered
  await page.evaluate(id => { localStorage.setItem('dt-draft-' + id, JSON.stringify({ revision: window.DtDesigner.app.baseRevision, document: Object.assign({}, window.DtDesigner.app.doc, { width: 160 }), time: Date.now() })); }, designId);
  await page.reload();
  await page.waitForSelector('dialog[open]');
  check('the draft is offered on open', (await page.textContent('dialog[open]')).includes('Ungespeicherte Änderungen'));
  await page.click('dialog[open] button:has-text("Wiederherstellen")');
  await page.waitForSelector('#dt-ds:not(.is-loading)');
  await idle(page);
  check('restoring brings the unsaved version back (state: unsaved, saved by itself afterwards)', (await state(page)).doc.width === 160 && (await state(page)).dirty);
  await waitState(page, 'saved', 15000);
  await page.evaluate(() => window.DtDesigner.app.edit(function (d) { d.width = 150; }, { reason: 'page' }));
  await waitState(page, 'saved', 15000);

  // ---------------------------------------------------------------------------------------- 15. edit conflict, "Neu laden"
  current = 'conflict: ';
  const other = await context.newPage();
  watch(other, 'second tab');
  await openDesigner(other, base, designId);
  await other.evaluate(() => { const a = window.DtDesigner.app; a.select([a.elements()[0].id]); a.nudge(7, 0); });
  await waitState(other, 'saved', 15000);
  const theirX = (await state(other)).elements[0].x;
  await page.evaluate(() => { const a = window.DtDesigner.app; a.select([a.elements()[0].id]); a.nudge(-3, 0); });
  await page.waitForSelector('dialog[open]', { timeout: 15000 });
  check('the stale autosave opens the conflict dialog', (await page.textContent('dialog[open]')).includes('inzwischen geändert'));
  await Promise.all([page.waitForNavigation({ timeout: 15000 }), page.click('dialog[open] button:has-text("Neu laden")')]);
  await page.waitForSelector('#dt-ds:not(.is-loading)');
  await idle(page);
  check('"Neu laden" shows the version of the other person', near((await state(page)).elements[0].x, theirX, 0.001));
  check('and leaves no draft behind', await page.evaluate(id => localStorage.getItem('dt-draft-' + id) === null, designId));
  await other.close();

  // ---------------------------------------------------------------------------------------- 16. the viewer
  current = 'viewer: ';
  // the viewer is a member who may look at what the designer shares with them: the design and the list of the preview
  await shareWith(page, 'design', designId, accounts.viewer.email, 'View');
  await shareWith(page, 'datalist', listId, accounts.viewer.email, 'View');
  const viewerContext = await newContext(browser);
  const viewer = await viewerContext.newPage();
  watch(viewer, 'viewer');
  await login(viewer, accounts.viewer);
  await openDesigner(viewer, base, designId);
  check('the editor opens read-only', await viewer.evaluate(() => document.getElementById('dt-ds').classList.contains('is-readonly')));
  check('the name is read-only; the state says Nur ansehen', (await viewer.getAttribute('#dt-name', 'readonly')) !== null && (await viewer.textContent('#dt-state-text')).trim() === 'Nur ansehen');
  check('the tools of the panels are disabled', await viewer.isDisabled('.dt-tile[data-add="rect"]'));
  const vg = await geometry(viewer, (await state(viewer)).elements[0].id);
  const beforeV = JSON.stringify((await state(viewer)).elements);
  await drag(viewer, { x: vg.cx, y: vg.cy }, { x: vg.cx + 50, y: vg.cy + 50 });
  await viewer.keyboard.press('Delete');
  await viewer.keyboard.press('ArrowRight');
  check('dragging, Delete and arrows change nothing', JSON.stringify((await state(viewer)).elements) === beforeV);
  await openPanel(viewer, 'data');
  await viewer.selectOption('#dt-panel select[aria-label="Daten für die Vorschau"]', String(listId));
  await viewer.waitForFunction(() => /Zeile 1 von 3/.test(document.querySelector('#dt-panel .dt-rowinfo').textContent));
  check('the data preview still works for a viewer', await viewer.isVisible('#dt-panel .dt-rowctl'));
  await viewerContext.close();

  // ---------------------------------------------------------------------------------------- 17. every tool, the page (size, unit, background)
  current = 'tools: ';
  const toolsId = (await createDesign(page, postJson, { preset: 'label-150x100' })).id;
  await openDesigner(page, base, toolsId);
  const toolIds = {};
  await openPanel(page, 'text');
  for (const kind of ['body', 'subheading', 'heading']) {
    await page.click(`.dt-textadd__btn[data-add="${kind}"]`);
    await page.waitForSelector('.dt-textedit');
    await page.keyboard.press('Escape');
    await idle(page);
    toolIds[kind] = (await state(page)).sel[0];
  }
  await openPanel(page, 'elements');
  for (const kind of ['rect', 'ellipse', 'line', 'frame', 'strip', 'qr', 'ean13']) {
    await page.click(`.dt-tile[data-add="${kind}"]`);
    await idle(page);
    toolIds[kind] = (await state(page)).sel[0];
  }
  s = await state(page);
  const byId = id => s.elements.find(e2 => e2.id === id);
  check('ten tools add ten elements', s.elements.length === 10, String(s.elements.length));
  check('heading is bigger than the subheading and the body, bold, and centred', byId(toolIds.heading).fontSize > byId(toolIds.subheading).fontSize && byId(toolIds.subheading).fontSize > byId(toolIds.body).fontSize && byId(toolIds.heading).fontWeight === 700 && byId(toolIds.heading).align === 'center');
  check('rectangle and ellipse are shapes with a fill', byId(toolIds.rect).shape === 'rect' && byId(toolIds.ellipse).shape === 'ellipse' && !!byId(toolIds.rect).fill);
  check('a line has no height', byId(toolIds.line).shape === 'line' && byId(toolIds.line).h === 0);
  check('a frame is an empty image element', byId(toolIds.frame).type === 'image' && byId(toolIds.frame).source === null);
  check('an image strip has four empty slots', byId(toolIds.strip).items.length === 4 && byId(toolIds.strip).items.every(i => i === null));
  check('a QR code and an EAN-13 barcode', byId(toolIds.qr).type === 'qr' && byId(toolIds.ean13).type === 'barcode' && byId(toolIds.ean13).format === 'ean13');
  await page.evaluate(ids => {
    const a = window.DtDesigner.app;
    const put = (id, x, y, w, h) => a.setProps([id], { x, y, w, h }, { merge: false });
    put(ids.body, 4, 4, 40, 8); put(ids.subheading, 4, 14, 60, 10); put(ids.heading, 4, 26, 60, 14); put(ids.rect, 100, 4, 20, 14); put(ids.ellipse, 125, 4, 20, 14);
    put(ids.line, 70, 40, 40, 0); put(ids.frame, 4, 44, 30, 30); put(ids.strip, 4, 78, 70, 16); put(ids.qr, 80, 50, 24, 24); put(ids.ean13, 110, 50, 36, 20);
    a.select([]);
  }, toolIds);
  await idle(page);
  // the QR code and the barcode are drawn and their editing is in the toolbar
  check('the QR code and the barcode are drawn by the engine', await page.evaluate(ids => ids.every(id => document.querySelectorAll('#dt-page g[data-el-id="' + id + '"] path, #dt-page g[data-el-id="' + id + '"] rect').length > 0), [toolIds.qr, toolIds.ean13]));
  await selectIds(page, [toolIds.qr]);
  check('the QR toolbar has a value field', (await page.getAttribute('#dt-ctx', 'data-kind')) === 'qr' && await page.isVisible('#dt-ctx input[aria-label="Inhalt des QR-Codes"]'));
  await page.fill('#dt-ctx input[aria-label="Inhalt des QR-Codes"]', 'https://example.org/{{Name}}');
  check('typing the value changes the code', (await nodeOf(page, toolIds.qr)).value === 'https://example.org/{{Name}}');
  await selectIds(page, [toolIds.ean13]);
  await page.fill('#dt-ctx input[aria-label="Wert des Barcodes"]', '123');
  await idle(page);
  check('an invalid barcode value is explained in the toolbar', await page.isVisible('#dt-ctx .dt-tb__status') && (await page.textContent('#dt-ctx .dt-tb__status')).length > 5, await page.textContent('#dt-ctx .dt-tb__status'));
  await page.fill('#dt-ctx input[aria-label="Wert des Barcodes"]', '4006381333931');
  check('a valid value clears it', !(await page.isVisible('#dt-ctx .dt-tb__status')));
  // lines: two end handles and the rotate handle; the end handle makes it slanted
  await selectIds(page, [toolIds.line]);
  const lineHandles = await page.$$eval('[data-handle]', h => h.map(x => x.getAttribute('data-handle')).sort().join(','));
  check('a line has two end handles and the rotate handle', lineHandles === 'nw,rot,se', lineHandles);
  await snap(page, false);
  const lse = await handleCentre(page, 'se');
  await drag(page, lse, { x: lse.x + 30, y: lse.y + 40 });
  check('dragging the end handle changes the angle of the line', (await elementOf(page, toolIds.line)).h > 5);
  // two shapes resized together
  await selectIds(page, [toolIds.rect, toolIds.ellipse]);
  const before2 = [await elementOf(page, toolIds.rect), await elementOf(page, toolIds.ellipse)];
  const groupSe = await handleCentre(page, 'se');
  await drag(page, groupSe, { x: groupSe.x + 40, y: groupSe.y + 20 });
  const after2 = [await elementOf(page, toolIds.rect), await elementOf(page, toolIds.ellipse)];
  check('a handle of a multi selection scales every selected element', after2[0].w > before2[0].w && after2[1].w > before2[1].w && after2[1].x > before2[1].x);
  // hide: an element that is hidden is not drawn and cannot be hit
  const heading = await geometry(page, toolIds.heading);
  await page.evaluate(id => window.DtDesigner.app.toggleHidden([id]), toolIds.heading);
  await idle(page);
  check('a hidden element is not drawn', !(await page.$('#dt-page [data-el-id="' + toolIds.heading + '"]')));
  await page.evaluate(() => window.DtDesigner.app.select([]));
  await page.mouse.click(heading.cx, heading.cy);
  check('and cannot be selected', !(await state(page)).sel.includes(toolIds.heading));
  await page.evaluate(id => window.DtDesigner.app.toggleHidden([id]), toolIds.heading);
  // the page: size and unit through "Größe ändern", the background colour
  await page.evaluate(() => window.DtDesigner.app.select([]));
  await raf2(page);
  await page.click('#dt-ctx button:has-text("Größe ändern")');
  await page.waitForSelector('dialog.dt-resizedlg[open]');
  await page.fill('dialog.dt-resizedlg .dt-grid3 input[aria-label="Breite"]', '800');
  await page.fill('dialog.dt-resizedlg .dt-grid3 input[aria-label="Höhe"]', '600');
  await page.selectOption('dialog.dt-resizedlg .dt-grid3 select', 'px');
  const xMm = (await elementOf(page, toolIds.rect)).x;
  await page.click('dialog.dt-resizedlg button[data-value="ok"]');
  await page.waitForSelector('dialog.dt-resizedlg', { state: 'detached' });
  await idle(page);
  s = await state(page);
  check('a custom size in px converts the page and scales the content', s.doc.unit === 'px' && s.doc.width === 800 && s.doc.height === 600 && s.elements.find(e2 => e2.id === toolIds.rect).x > xMm, `${s.doc.width}x${s.doc.height} ${s.doc.unit}`);
  await page.keyboard.press('Control+z');
  await idle(page);
  check('and one undo takes it back', (await state(page)).doc.unit === 'mm' && (await state(page)).doc.width === 150);
  await page.click('#dt-ctx button[aria-label="Hintergrundfarbe"]');
  await page.fill('.dt-colorpop .dt-colour__hex', '#ffeecc');
  await idle(page);
  check('the background colour', (await state(page)).pages[0].background.color === '#ffeecc');
  await page.keyboard.press('Escape');
  await waitState(page, 'saved', 15000);
  await page.reload();
  await page.waitForSelector('#dt-ds:not(.is-loading)');
  await idle(page);
  s = await state(page);
  check('the tools design saves and reloads with its empty slots, the code values and the frame', s.elements.some(e2 => e2.type === 'imageStrip' && e2.items.length === 4 && e2.items[0] === null) && s.elements.some(e2 => e2.type === 'qr' && e2.value.includes('example.org')) && s.elements.some(e2 => e2.type === 'image' && e2.source === null));

  // ---------------------------------------------------------------------------------------- 18. the demo label (docs/PLAN.md 1.2)
  current = 'demo: ';
  const demoId = (await createDesign(page, postJson, { preset: 'price-tag' })).id;
  const posted = await page.evaluate(async ({ id, doc }) => {
    const got = await (await fetch('/api/designs/' + id)).json();
    const r = await fetch('/api/designs/' + id, { method: 'POST', headers: { 'Content-Type': 'application/json', RequestVerificationToken: document.querySelector('meta[name=dt-csrf]').content }, body: JSON.stringify({ revision: got.revision, document: doc }) });
    return { status: r.status, body: await r.json() };
  }, { id: demoId, doc: demoDocument() });
  check('the server accepts the demo document', posted.status === 200 && posted.body.warnings.length === 0, JSON.stringify(posted.body.warnings || posted.body));
  await page.goto(base + '/DataLists/Edit');
  await page.fill('#Input_Name', 'Käsetheke (Beispiel, Check)');
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit].mat-btn--primary')]);
  const demoList = Number(page.url().match(/DataLists\/Edit\/(\d+)/)[1]);
  await page.goto(`${base}/DataLists/Edit/${demoList}?tab=columns`);
  await page.selectOption('form[action*="FromDesign"] select', String(demoId));
  await Promise.all([page.waitForNavigation(), page.click('form[action*="FromDesign"] button[type=submit]')]);
  await page.evaluate(async ({ id, rowsData }) => {
    const grid = await (await fetch('/api/datalists/' + id + '/rows')).json();
    const body = { revision: grid.revision, rows: rowsData.map(values => ({ id: null, values, copies: 1, isActive: true })) };
    await fetch('/api/datalists/' + id + '/rows', { method: 'POST', headers: { 'Content-Type': 'application/json', RequestVerificationToken: document.querySelector('meta[name=dt-csrf]').content }, body: JSON.stringify(body) });
  }, { id: demoList, rowsData: demoRows() });
  await openDesigner(page, base, demoId);
  await page.evaluate(() => { localStorage.removeItem('dt-preview-' + window.DtDesigner.app.id); });
  await page.waitForTimeout(600);
  check('the demo label is drawn: name, price, three seals in the strip', (await svgText(page)).includes('Holunderblüte') && (await svgText(page)).includes('2,99') && (await page.evaluate(() => document.querySelectorAll('#dt-page svg image').length)) === 4);
  await page.keyboard.press('Escape');
  await shot(page, 'designer-1440-demo.png');
  const nameEl = (await state(page)).elements.find(e2 => e2.name === 'Name');
  await page.evaluate(id => window.DtDesigner.app.select([id]), nameEl.id);
  await idle(page);
  await shot(page, 'designer-1440-demo-selection.png');
  await openPanel(page, 'data');
  await page.selectOption('#dt-panel select[aria-label="Daten für die Vorschau"]', String(demoList));
  await page.waitForFunction(() => /Zeile 1 von 4/.test(document.querySelector('#dt-panel .dt-rowinfo').textContent));
  await page.click('#dt-panel button[aria-label="Nächste Zeile"]');
  await page.click('#dt-panel button[aria-label="Nächste Zeile"]');
  await idle(page);
  check('with the list: Bergkäse hides the empty seals', (await svgText(page)).includes('Bergkäse') && (await page.evaluate(() => document.querySelectorAll('#dt-page svg image').length)) === 3);
  await shot(page, 'designer-1440-demo-data.png');
  await page.click('#dt-panel button[aria-label="Nächste Zeile"]');
  await idle(page);
  check('Camembert hides the rows without values', !(await svgText(page)).includes('GEREIFT'), await svgText(page));
  await page.selectOption('#dt-panel select[aria-label="Daten für die Vorschau"]', '');
  // the demo label survives engine, toolbar and save: a text of it is edited with the font list (the shrink-to-fit stays)
  await selectIds(page, [nameEl.id]);
  check('"Name" keeps shrink-to-fit and the bottom alignment', (await nodeOf(page, nameEl.id)).fit === 'shrink' && (await nodeOf(page, nameEl.id)).valign === 'bottom');
  await page.click('#dt-ctx .dt-tb--font');
  await page.waitForSelector('.dt-fontlist__item');
  check('the font list shows the family of the label selected', await page.isVisible('.dt-fontlist__item[aria-selected="true"]'));
  await page.keyboard.press('Escape');

  // ---------------------------------------------------------------------------------------- 19. tablet with touch (1024 x 768)
  current = 'tablet: ';
  const tabletContext = await newContext(browser, { viewport: { width: 1024, height: 768 }, hasTouch: true, deviceScaleFactor: 1 });
  const tablet = await tabletContext.newPage();
  watch(tablet, 'tablet');
  await login(tablet, accounts.designer);
  await openDesigner(tablet, base, demoId);
  check('the browser reports a coarse pointer', await tablet.evaluate(() => matchMedia('(pointer: coarse)').matches));
  check('1024 px shows rail, panel and canvas', await tablet.isVisible('#dt-rail') && await tablet.isVisible('#dt-panel'));
  check('the canvas is wide enough to work in', (await tablet.evaluate(() => document.getElementById('dt-viewport').getBoundingClientRect().width)) >= 480);
  await shot(tablet, 'designer-1024-touch.png');
  const tg = await geometry(tablet, nameEl.id);
  await tablet.touchscreen.tap(tg.cx, tg.cy);
  await idle(tablet);
  check('a tap selects the element', (await state(tablet)).sel.length === 1);
  await shot(tablet, 'designer-1024-touch-selection.png');
  const cdp = await tabletContext.newCDPSession(tablet);
  const priceEl = (await state(tablet)).elements.find(e2 => e2.name === 'Euro');
  await tablet.evaluate(id => window.DtDesigner.app.select([id]), priceEl.id);
  const pg = await geometry(tablet, priceEl.id);
  await snap(tablet, false);
  await touchDrag(cdp, { x: pg.cx, y: pg.cy }, { x: pg.cx - 40, y: pg.cy + 30 });
  await idle(tablet);
  const moved = await elementOf(tablet, priceEl.id);
  check('a finger drags an element', moved.x < priceEl.x - 3, priceEl.x + ' -> ' + moved.x);
  const z = (await state(tablet)).zoom;
  const c0 = { x: 700, y: 380 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c0.x - 40, y: c0.y, id: 1 }, { x: c0.x + 40, y: c0.y, id: 2 }] });
  for (let i = 1; i <= 6; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c0.x - 40 - i * 12, y: c0.y, id: 1 }, { x: c0.x + 40 + i * 12, y: c0.y, id: 2 }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  check('two fingers pinch to zoom', (await state(tablet)).zoom > z * 1.4, z + ' -> ' + (await state(tablet)).zoom);
  await tabletContext.close();

  // ---------------------------------------------------------------------------------------- 20. phone (390 x 844)
  current = 'phone: ';
  const phoneContext = await newContext(browser, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const phone = await phoneContext.newPage();
  watch(phone, 'phone');
  await login(phone, accounts.designer);
  await openDesigner(phone, base, demoId);
  check('no horizontal scroll', await phone.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  const pageBox = await phone.evaluate(() => { const r = document.getElementById('dt-sheet').getBoundingClientRect(); return { l: r.left, w: r.width, vw: innerWidth }; });
  check('the label fits the screen', pageBox.l >= 0 && pageBox.l + pageBox.w <= pageBox.vw + 1, JSON.stringify(pageBox));
  await phone.tap('.dt-tabbar__btn[data-panel="layers"]');
  await phone.tap('#dt-tabbar-more');
  await phone.locator('.dt-menu__item', { has: phone.locator('.dt-menu__label', { hasText: /^Daten \(Zusatz\)$/ }) }).tap();
  await phone.waitForFunction(() => window.DtDesigner.panels.current() === 'data');
  await phone.selectOption('#dt-panel select[aria-label="Daten für die Vorschau"]', String(demoList));
  await phone.waitForFunction(() => /Zeile 1 von 4/.test(document.querySelector('#dt-panel .dt-rowinfo').textContent));
  await phone.tap('#dt-panel button[aria-label="Nächste Zeile"]');
  await idle(phone);
  check('the data preview works on a phone', (await svgText(phone)).includes('Alter Gouda'));
  await shot(phone, 'designer-390-data.png');
  await phone.tap('#dt-panel-close');
  const pe = await geometry(phone, nameEl.id);
  await phone.touchscreen.tap(pe.cx, pe.cy);
  await idle(phone);
  check('an element can be selected on a phone', (await state(phone)).sel.length === 1 && (await phone.getAttribute('#dt-ctx', 'data-kind')) === 'text');
  await shot(phone, 'designer-390-selection.png');
  await phoneContext.close();

  // ---------------------------------------------------------------------------------------- done
  current = 'console: ';
  check('no console errors and no CSP violations', problems.length === 0, problems.slice(0, 6).join(' | '));
  check('leaving with unsaved changes never asked (autosave): no beforeunload dialog during the check', !dialogs.includes('beforeunload'), dialogs.join(','));
  await browser.close();

  let failed = 0;
  for (const r of results) {
    if (!r.ok) { failed++; }
    console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail ? ' – ' + r.detail : ''}`);
  }
  console.log(`\n${results.length - failed} of ${results.length} checks passed`);
  process.exit(failed ? 1 : 0);

  async function rightClickNode(p, id) {
    const geo = await geometry(p, id);
    await p.mouse.click(geo.cx, geo.cy, { button: 'right' });
    await p.waitForSelector('.dt-menu');
  }
})().catch(err => {
  console.error('The check stopped: ' + (err && err.stack || err));
  for (const r of results) { console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail ? ' – ' + r.detail : ''}`); }
  if (problems.length) { console.log('Problems: ' + problems.join('\n')); }
  process.exit(1);
});
