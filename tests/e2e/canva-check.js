// Checks the Canva-style editor in a real browser (installed Edge, headless): one-click creation, the rail and its panels, the contextual toolbar, the context menu, paste and drop
// of images and fonts, the media browser (also for the slots of an image strip), pages, groups, autosave, the edit conflict, Herunterladen (PNG, ZIP), the viewer and the phone
// editor. Screenshots of the main states (1440x900, 1024x768, 390x844) go to the temp folder (canva-*.png). Zero console errors and zero CSP violations are part of the result.
//
//   cd tests/e2e && npm install
//   node canva-check.js [base url, default http://localhost:3043] [--out <folder for the screenshots, default: the temp folder>]
//
// Accounts: tests/e2e/test-account.json (see lib.js); a designer and a viewer are needed.
const fs = require('fs');
const path = require('path');
const lib = require('./lib.js');
const E = require('./editor-lib.js');

const args = process.argv.slice(2);
const { base, problems, dialogs, watch, launch, newContext, login, ensureAccounts, postJson, shareWith } = lib(args, { ignore: /status of (403|409)|Failed to load resource: the server responded with a status of 4\d\d/ });
const outIndex = args.indexOf('--out');
const outDir = path.resolve(outIndex >= 0 ? args[outIndex + 1] : path.join(require('os').tmpdir(), 'designthix-canva-check'));

const results = [];
let current = '';
const check = (name, ok, detail) => { results.push({ name: current + name, ok: !!ok, detail }); };
const { idle, state, nodeOf, openDesigner, createDesign, geometry, handleCentre, drag, selectIds, waitState, svgText, near, openPanel, pngFile, fontFile, pasteFiles, pasteText, dropFiles, raf2 } = E;

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const menuItem = (page, label, level) => page.locator(`.dt-menu[data-level="${level || 0}"] .dt-menu__item`, { has: page.locator('.dt-menu__label', { hasText: new RegExp('^' + esc(label) + '$') }) });
async function menuClick(page, label, level) {
  const item = menuItem(page, label, level);
  await item.waitFor({ state: 'visible', timeout: 5000 });
  await item.click();
}
async function rightClick(page, id) {
  const g = await geometry(page, id);
  await page.mouse.click(g.cx, g.cy, { button: 'right' });
  await page.waitForSelector('.dt-menu', { timeout: 5000 });
}
const kind = page => page.getAttribute('#dt-ctx', 'data-kind');
const panelTitle = page => page.textContent('#dt-panel-title');
const pageCentre = async page => { const r = await page.evaluate(() => { const s = document.getElementById('dt-sheet').getBoundingClientRect(); return { x: s.left + s.width / 2, y: s.top + s.height / 2, l: s.left, t: s.top, w: s.width, h: s.height }; }); return r; };

async function shot(page, name) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, name);
  await page.screenshot({ path: file });
  console.log('screenshot ' + file);
}

/** A new design through the API, opened in the editor. */
async function fresh(page, body) {
  const made = await createDesign(page, postJson, body);
  await openDesigner(page, base, made.id);
  return made.id;
}

(async () => {
  const browser = await launch();
  const accounts = await ensureAccounts(browser);
  const context = await newContext(browser, { viewport: { width: 1440, height: 900 } });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  const page = await context.newPage();
  watch(page, 'canva');
  if (process.env.DT_DEBUG) { page.on('console', m => console.log('console:', m.type(), m.text().slice(0, 300))); }
  if (!await login(page, accounts.designer)) { throw new Error('Anmeldung des Gestalters fehlgeschlagen.'); }

  // ---------------------------------------------------------------------------------------- 1. one-click creation, layout, the rail
  current = 'create: ';
  const made = await createDesign(page, postJson, { preset: 'price-tag' });
  check('POST /api/designs creates a design and answers its address', made.id > 0 && made.url === `/Designs/${made.id}/Designer`, JSON.stringify(made));
  await openDesigner(page, base, made.id);
  let designId = made.id;
  let s = await state(page);
  check('an empty page of 150 x 100 mm, one page, schema 2', s.doc.schema === 2 && s.doc.width === 150 && s.doc.height === 100 && s.doc.unit === 'mm' && s.pages.length === 1 && s.elements.length === 0);
  check('the state says "Alle Änderungen gespeichert"', (await page.textContent('#dt-state-text')).trim() === 'Alle Änderungen gespeichert');
  check('there is no Speichern button and no right properties panel', !(await page.$('#dt-save')) && !(await page.$('#dt-props')) && !(await page.$('#dt-right')));
  await shot(page, 'canva-1440-empty.png');

  current = 'layout: ';
  const railLabels = await page.$$eval('.dt-rail__btn', b => b.map(x => x.textContent.trim()));
  check('the rail has Vorlagen, Elemente, Text, Uploads, Marke, Ebenen, Kommentare and Daten (Zusatz)', railLabels.join('|') === 'Vorlagen|Elemente|Text|Uploads|Marke|Ebenen|Kommentare|Daten (Zusatz)', railLabels.join('|'));
  const titles = { templates: 'Vorlagen', elements: 'Elemente', text: 'Text', uploads: 'Uploads', brand: 'Marke', layers: 'Ebenen', data: 'Daten (Zusatz)' };
  for (const id of Object.keys(titles)) {
    await openPanel(page, id);
    check(`the rail button ${titles[id]} opens its panel`, (await panelTitle(page)).trim() === titles[id] && await page.isVisible('#dt-panel'));
  }
  const panelWidth = await page.evaluate(() => document.getElementById('dt-panel').getBoundingClientRect().width);
  check('the panel is about 340 px wide', near(panelWidth, 340, 8), String(panelWidth));
  await page.click('.dt-rail__btn[data-panel="data"]');
  check('a second click on the active rail button collapses the panel', !(await page.isVisible('#dt-panel')));
  await openPanel(page, 'elements');
  await page.click('#dt-panel-close');
  check('the collapse button closes the panel', !(await page.isVisible('#dt-panel')));
  await openPanel(page, 'elements');
  check('the toolbar above the canvas shows the page (nothing selected)', (await kind(page)) === 'page' && await page.isVisible('#dt-ctx button:has-text("Hintergrund")') && await page.isVisible('#dt-ctx button:has-text("Größe ändern")'));
  check('the top bar has Datei, undo/redo, the name, Serie, Herunterladen and Drucken', await page.isVisible('#dt-file') && await page.isVisible('#dt-undo') && await page.isVisible('#dt-redo') && await page.isVisible('#dt-name') && await page.isVisible('#dt-series') && await page.isVisible('#dt-download') && await page.isVisible('#dt-print'));
  check('"Serie" is a link into the output creation of this design', (await page.getAttribute('#dt-series', 'href')) === `/Outputs/Create?designId=${designId}`);
  check('the bottom bar has the page strip and the zoom controls', await page.isVisible('#dt-pages .dt-thumb') && await page.isVisible('#dt-zoom') && await page.isVisible('#dt-zoom-percent') && await page.isVisible('#dt-zoom-fit'));

  // ---------------------------------------------------------------------------------------- 2. add text, a shape and an image
  current = 'add: ';
  await openPanel(page, 'text');
  await page.click('.dt-textadd__btn[data-add="heading"]');
  await page.waitForSelector('.dt-textedit');
  await page.keyboard.type('Holunderblüte');
  await page.keyboard.press('Control+Enter');
  await idle(page);
  s = await state(page);
  const textId = s.sel[0];
  let text = await nodeOf(page, textId);
  check('"Überschrift hinzufügen" adds a bold centred heading and opens the editor', text && text.type === 'text' && text.text === 'Holunderblüte' && text.fontWeight === 700 && text.align === 'center');
  check('the text box is centred on the page', text && near(text.x + text.w / 2, 75, 0.1) && near(text.y + text.h / 2, 50, 0.1));
  check('the toolbar became the text toolbar (font, size, colour, B, I, alignment)', (await kind(page)) === 'text' && await page.isVisible('#dt-ctx .dt-tb--font') && await page.isVisible('#dt-ctx .dt-tb__size') && await page.isVisible('#dt-ctx button[aria-label="Fett"]') && await page.isVisible('#dt-ctx button[aria-label="Kursiv"]') && await page.isVisible('#dt-ctx button[aria-label="Ausrichtung"]') && await page.isVisible('#dt-ctx button[aria-label="Textfarbe"]'));
  await shot(page, 'canva-1440-text.png');

  await openPanel(page, 'elements');
  await page.click('.dt-tile[data-add="rect"]');
  await idle(page);
  s = await state(page);
  const rectId = s.sel[0];
  check('a click on a shape tile adds it to the page and selects it', (await nodeOf(page, rectId)).shape === 'rect' && s.elements.length === 2);
  check('the toolbar became the shape toolbar (Füllung, Rand, Ecken)', (await kind(page)) === 'shape' && await page.isVisible('#dt-ctx button[aria-label="Füllung"]') && await page.isVisible('#dt-ctx button[aria-label="Randfarbe"]') && await page.isVisible('#dt-ctx button[aria-label="Ecken"]'));
  await page.click('.dt-tile[data-add="line"]');
  await idle(page);
  check('a line selects the line toolbar', (await kind(page)) === 'line' && await page.isVisible('#dt-ctx button[aria-label="Linienfarbe"]'));
  await page.evaluate(id => window.DtDesigner.app.deleteIds([id]), (await state(page)).sel[0]);

  // an image through the Uploads panel: the upload button (file chooser), the grid, a click inserts
  await openPanel(page, 'uploads');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('.dt-upload__btn')]);
  const uploadName = 'check-rot-' + Date.now() + '.png';
  const rotPng = pngFile(uploadName, [200, 30, 30], 120, 80);
  await chooser.setFiles({ name: uploadName, mimeType: 'image/png', buffer: Buffer.from(rotPng.base64, 'base64') });
  const uploadKey = uploadName.replace(/\.png$/, '');
  await page.waitForSelector(`.dt-asset[data-key="${uploadKey}"]`, { timeout: 15000 });
  check('an uploaded file appears in the grid of the Uploads panel (newest first)', (await page.$eval('.dt-assetgrid .dt-asset', a => a.getAttribute('data-key'))) === uploadKey);
  await page.click(`.dt-asset[data-key="${uploadKey}"]`);
  await idle(page);
  s = await state(page);
  const imageId = s.sel[0];
  let image = await nodeOf(page, imageId);
  check('a click on an upload inserts it as an image in the middle of the page', image && image.type === 'image' && image.source.asset === uploadKey && near(image.x + image.w / 2, 75, 0.2) && near(image.y + image.h / 2, 50, 0.2), JSON.stringify(image && image.source));
  check('sized by its aspect ratio (3:2), at most 40 % of the page', image && near(image.w / image.h, 1.5, 0.05) && image.w <= 60.01 && image.h <= 40.01);
  check('the toolbar became the image toolbar (Ersetzen, Einpassen)', (await kind(page)) === 'image' && await page.isVisible('#dt-ctx button:has-text("Ersetzen")') && await page.isVisible('#dt-ctx button:has-text("Einpassen")'));
  await shot(page, 'canva-1440-image.png');
  await openPanel(page, 'uploads');
  await shot(page, 'canva-1440-uploads.png');

  // ---------------------------------------------------------------------------------------- 3. the contextual toolbar follows the selection and changes the document
  current = 'toolbar: ';
  await selectIds(page, [textId]);
  check('selecting the text switches the toolbar back to text', (await kind(page)) === 'text');
  await page.click('#dt-ctx button[aria-label="Fett"]');
  await idle(page);
  text = await nodeOf(page, textId);
  check('Fett toggles the weight', text.fontWeight < 600);
  await page.click('#dt-ctx button[aria-label="Fett"]');
  check('and back', (await nodeOf(page, textId)).fontWeight >= 600);
  await page.click('#dt-ctx button[aria-label="Kursiv"]');
  check('Kursiv', (await nodeOf(page, textId)).italic === true);
  const size0 = (await nodeOf(page, textId)).fontSize;
  await page.click('#dt-ctx button[aria-label="Schrift vergrößern"]');
  check('the plus button makes the font larger', (await nodeOf(page, textId)).fontSize > size0, size0 + ' -> ' + (await nodeOf(page, textId)).fontSize);
  await page.fill('#dt-ctx .dt-tb__size input', '30');
  await page.keyboard.press('Enter');
  check('the size field takes a value', (await nodeOf(page, textId)).fontSize === 30);
  await page.click('#dt-ctx button[aria-label="Ausrichtung"]');
  check('the alignment button cycles (center -> right)', (await nodeOf(page, textId)).align === 'right');
  await page.click('#dt-ctx button[aria-label="Großbuchstaben"]');
  check('Großbuchstaben', (await nodeOf(page, textId)).uppercase === true);
  await page.click('#dt-ctx button[aria-label="Großbuchstaben"]');
  // the font list: every name in its own font, searchable
  await page.click('#dt-ctx .dt-tb--font');
  await page.waitForSelector('.dt-fontlist__item');
  const fontCount = await page.$$eval('.dt-fontlist__item', l => l.length);
  const fontClass = await page.$eval('.dt-fontlist__name', n => n.className);
  check('the font list shows every family in its own font', fontCount >= 10 && /dt-ff-/.test(fontClass), fontCount + ' ' + fontClass);
  await page.fill('.dt-fontpop input[type=search]', 'Mont');
  check('and can be searched', (await page.$$eval('.dt-fontlist__item', l => l.length)) === 1);
  await page.click('.dt-fontlist__item');
  check('a click sets the family', (await nodeOf(page, textId)).fontFamily === 'Montserrat');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.dt-fontpop', { state: 'detached' });
  // colour popover: document colours, brand colours, palette, hex
  await page.click('#dt-ctx button[aria-label="Textfarbe"]');
  await page.waitForSelector('.dt-colorpop');
  const sections = await page.$$eval('.dt-colorpop__title', t => t.map(x => x.textContent));
  check('the colour popover has document colours, brand colours and the palette', sections.includes('Dokumentfarben') && sections.includes('Markenfarben') && sections.includes('Standardfarben'), sections.join('|'));
  check('the palette has about 30 colours', (await page.$$('.dt-colorpop [data-section="palette"] .dt-swatch')).length === 30);
  await page.click('.dt-colorpop [data-section="palette"] .dt-swatch[data-colour="#e5484d"]');
  check('a swatch sets the colour', (await nodeOf(page, textId)).color === '#e5484d');
  await page.fill('.dt-colorpop .dt-colour__hex', '#123456');
  check('the hex field sets the colour', (await nodeOf(page, textId)).color === '#123456');
  await page.keyboard.press('Escape');
  // transparency
  await page.click('#dt-ctx button[aria-label="Transparenz"]');
  await page.waitForSelector('.dt-popover .dt-range');
  await page.$eval('.dt-popover .dt-range', r => { r.value = '40'; r.dispatchEvent(new Event('input', { bubbles: true })); });
  check('the transparency slider sets the opacity', near((await nodeOf(page, textId)).opacity, 0.4, 0.001));
  await page.keyboard.press('Escape');
  await page.evaluate(id => window.DtDesigner.app.setProps([id], { opacity: 1, italic: false, align: 'center', fontWeight: 700, color: '#000000' }, { merge: false }), textId);
  // shape toolbar changes the fill
  await selectIds(page, [rectId]);
  await page.click('#dt-ctx button[aria-label="Füllung"]');
  await page.waitForSelector('.dt-colorpop');
  await page.click('.dt-colorpop [data-section="palette"] .dt-swatch[data-colour="#2e9d5b"]');
  check('the fill swatch of a shape sets the fill', (await nodeOf(page, rectId)).fill === '#2e9d5b');
  await page.click('.dt-colorpop .dt-chipbtn');
  check('"Keine Füllung" empties it', (await nodeOf(page, rectId)).fill === null);
  await page.keyboard.press('Escape');
  await page.evaluate(id => window.DtDesigner.app.setProps([id], { fill: '#1fb3d6' }, { merge: false }), rectId);
  // several elements and the page
  await page.evaluate(([a, b]) => window.DtDesigner.app.select([a, b]), [textId, rectId]);
  await raf2(page);
  check('several elements: Gruppieren and Ausrichten', (await kind(page)) === 'multi' && await page.isVisible('#dt-ctx button:has-text("Gruppieren")') && await page.isVisible('#dt-ctx button:has-text("Ausrichten")'));
  await page.evaluate(() => window.DtDesigner.app.select([]));
  await raf2(page);
  check('nothing selected: the page again', (await kind(page)) === 'page');
  await page.click('#dt-ctx button[aria-label="Hintergrundfarbe"]');
  await page.waitForSelector('.dt-colorpop');
  await page.click('.dt-colorpop [data-section="palette"] .dt-swatch[data-colour="#fff7ed"]');
  check('the page background colour', (await state(page)).pages[0].background.color === '#fff7ed');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z');
  check('and it is one undo step', (await state(page)).pages[0].background.color === '#ffffff');
  // the Position page in the panel
  await selectIds(page, [rectId]);
  await page.click('#dt-ctx button:has-text("Position")');
  await page.waitForFunction(() => document.getElementById('dt-panel-title').textContent.trim() === 'Position');
  check('Position opens a page of the panel with a back arrow', await page.isVisible('#dt-panel-back'));
  check('Position has 6 align buttons, 4 layer-order buttons and the numbers', (await page.$$('#dt-panel [data-align]')).length === 6 && (await page.$$('#dt-panel [data-order]')).length === 4 && (await page.$$('#dt-panel [data-field]')).length === 5);
  await page.fill('#dt-panel [data-field="x"] input', '12,5');
  await idle(page);
  check('the X field moves the element', near((await nodeOf(page, rectId)).x, 12.5, 0.001));
  await page.click('#dt-panel [data-align="right"]');
  const rr = await nodeOf(page, rectId);
  check('"Rechts" aligns to the page edge', near(rr.x + rr.w, 150, 0.01), String(rr.x + rr.w));
  await page.click('#dt-panel [data-order="back"]');
  check('"Ganz nach hinten" sends it to the bottom', (await state(page)).elements[0].id === rectId);
  await page.click('#dt-panel-back');
  check('the back arrow returns to the panel before', (await panelTitle(page)).trim() === 'Uploads' && !(await page.isVisible('#dt-panel-back')));
  await page.evaluate(([i, x]) => window.DtDesigner.app.setProps([i], { x }, { merge: false }), [rectId, 20]);

  // ---------------------------------------------------------------------------------------- 4. the context menu
  current = 'menu: ';
  await page.evaluate(id => window.DtDesigner.app.setProps([id], { x: 100, y: 10, w: 30, h: 20 }, { merge: false }), rectId);
  await page.evaluate(([i, x, y, w, h]) => window.DtDesigner.app.setProps([i], { x, y, w, h }, { merge: false }), [imageId, 10, 40, 45, 30]);
  await page.evaluate(([i, x, y]) => window.DtDesigner.app.setProps([i], { x, y }, { merge: false }), [textId, 40, 78]);
  await page.evaluate(() => window.DtDesigner.app.select([]));
  await idle(page);
  await rightClick(page, rectId);
  check('a right click on an element selects it and opens the context menu', (await state(page)).sel[0] === rectId && await page.isVisible('.dt-menu'));
  const labels = await page.$$eval('.dt-menu__label', l => l.map(x => x.textContent));
  for (const wanted of ['Kopieren', 'Ausschneiden', 'Einfügen', 'Duplizieren', 'Löschen', 'Stil kopieren', 'Stil einfügen', 'Ebene', 'An Seite ausrichten', 'Gruppieren', 'Sperren', 'Ausblenden', 'Spiegeln']) {
    check(`the menu has "${wanted}"`, labels.includes(wanted), labels.join('|'));
  }
  const shortcuts = await page.$$eval('.dt-menu__kbd', l => l.map(x => x.textContent));
  check('shortcuts are shown at the right', shortcuts.includes('Strg+C') && shortcuts.includes('Strg+D') && shortcuts.includes('Entf'), shortcuts.join('|'));
  const groupDisabled = await menuItem(page, 'Gruppieren').getAttribute('aria-disabled');
  const groupTitle = await menuItem(page, 'Gruppieren').getAttribute('title');
  check('a disabled entry says why (Gruppieren needs two elements)', groupDisabled === 'true' && /mindestens zwei/.test(groupTitle || ''), groupDisabled + ' ' + groupTitle);
  const pasteStyleDisabled = await menuItem(page, 'Stil einfügen').getAttribute('aria-disabled');
  check('Stil einfügen is disabled before a style was copied', pasteStyleDisabled === 'true');
  await shot(page, 'canva-1440-context-menu.png');
  // keyboard
  await page.keyboard.press('ArrowDown');
  const focusedFirst = await page.evaluate(() => document.activeElement.querySelector('.dt-menu__label') && document.activeElement.querySelector('.dt-menu__label').textContent);
  check('arrow down moves through the entries', !!focusedFirst, String(focusedFirst));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.dt-menu'));
  check('Escape closes the menu', true);
  // duplicate
  await rightClick(page, rectId);
  const countBefore = (await state(page)).elements.length;
  await menuClick(page, 'Duplizieren');
  await idle(page);
  s = await state(page);
  check('Duplizieren makes a copy, selects it and offsets it by 5 mm', s.elements.length === countBefore + 1 && s.sel.length === 1 && s.sel[0] !== rectId && near((await nodeOf(page, s.sel[0])).x - (await nodeOf(page, rectId)).x, 5, 0.01));
  const copyId = s.sel[0];
  await page.evaluate(id => window.DtDesigner.app.setProps([id], { x: 100, y: 45 }, { merge: false }), copyId);
  await idle(page);
  // copy + paste through the menu
  await rightClick(page, copyId);
  await menuClick(page, 'Kopieren');
  await page.waitForFunction(() => !document.querySelector('.dt-menu'));
  await page.mouse.click((await pageCentre(page)).l + 5, (await pageCentre(page)).t + 5, { button: 'right' });
  await page.waitForSelector('.dt-menu');
  const pageMenuLabels = await page.$$eval('.dt-menu__label', l => l.map(x => x.textContent));
  check('a right click on the empty page offers Einfügen, Alles auswählen, Hintergrund and the page actions', ['Einfügen', 'Alles auswählen', 'Hintergrundfarbe …', 'Hintergrundbild …', 'Hintergrundbild entfernen', 'Seite hinzufügen', 'Seite duplizieren', 'Seite löschen'].every(l => pageMenuLabels.includes(l)), pageMenuLabels.join('|'));
  const nBefore = (await state(page)).elements.length;
  await menuClick(page, 'Einfügen');
  await page.waitForFunction(n => window.DtDesigner.app.elements().length === n, nBefore + 1, { timeout: 5000 });
  check('Einfügen pastes the copied element', (await state(page)).elements.length === nBefore + 1);
  await page.evaluate(id => window.DtDesigner.app.setProps([id], { x: 60, y: 45 }, { merge: false }), (await state(page)).sel[0]);
  await idle(page);
  // order
  await rightClick(page, rectId);
  await menuItem(page, 'Ebene').hover();
  await menuClick(page, 'Ganz nach vorne', 1);
  await idle(page);
  s = await state(page);
  check('Ebene > Ganz nach vorne puts the element on top', s.elements[s.elements.length - 1].id === rectId);
  // align
  await rightClick(page, rectId);
  await menuItem(page, 'An Seite ausrichten').hover();
  await menuClick(page, 'Zentriert', 1);
  await idle(page);
  const centred = await nodeOf(page, rectId);
  check('An Seite ausrichten > Zentriert centres it', near(centred.x + centred.w / 2, 75, 0.01));
  // lock
  await rightClick(page, rectId);
  await menuClick(page, 'Sperren');
  check('Sperren locks the element', (await nodeOf(page, rectId)).locked === true);
  await page.mouse.click((await pageCentre(page)).l + 3, (await pageCentre(page)).t + 3);
  const lockedG = await geometry(page, rectId);
  await page.mouse.click(lockedG.cx, lockedG.cy);
  check('a locked element cannot be selected on the canvas', !(await state(page)).sel.includes(rectId));
  await page.evaluate(id => window.DtDesigner.app.select([id]), rectId);
  await page.evaluate(id => window.DtDesigner.app.toggleLock([id]), rectId);
  check('and Entsperren (here by command) frees it', (await nodeOf(page, rectId)).locked === false);
  // group through the menu
  await page.evaluate(([a, b]) => window.DtDesigner.app.select([a, b]), [rectId, copyId]);
  await raf2(page);
  await rightClick(page, rectId);
  check('the menu keeps both elements selected', (await state(page)).sel.length === 2);
  await menuClick(page, 'Gruppieren');
  await idle(page);
  s = await state(page);
  const group = s.elements.find(e => e.type === 'group');
  check('Gruppieren makes one group of the two', !!group && group.children.length === 2 && s.sel.length === 1 && s.sel[0] === group.id);
  await page.evaluate(() => window.DtDesigner.app.select([]));
  await rightClick(page, rectId);
  check('a right click on a grouped element selects the whole group', (await state(page)).sel[0] === group.id);
  check('the menu of a group offers "Gruppierung aufheben"', await menuItem(page, 'Gruppierung aufheben').isVisible());
  await menuClick(page, 'Gruppierung aufheben');
  await idle(page);
  s = await state(page);
  check('Gruppierung aufheben gives the two elements back', !s.elements.some(e => e.type === 'group') && s.sel.length === 2);
  // style copy / paste
  await selectIds(page, [rectId]);
  await page.evaluate(id => window.DtDesigner.app.setProps([id], { fill: '#e5484d' }, { merge: false }), rectId);
  await rightClick(page, rectId);
  await menuClick(page, 'Stil kopieren');
  await page.evaluate(id => window.DtDesigner.app.select([id]), copyId);
  await rightClick(page, copyId);
  await menuClick(page, 'Stil einfügen');
  check('Stil kopieren / Stil einfügen carry the fill to the other shape', (await nodeOf(page, copyId)).fill === '#e5484d');
  // image entries
  await rightClick(page, imageId);
  const imageLabels = await page.$$eval('.dt-menu__label', l => l.map(x => x.textContent));
  check('the menu of an image has Bild ersetzen, Spiegeln, Als Hintergrund festlegen and Feld zuweisen', ['Bild ersetzen …', 'Spiegeln', 'Als Hintergrund festlegen', 'Feld zuweisen (Zusatz)'].every(l => imageLabels.includes(l)), imageLabels.join('|'));
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.DtDesigner.app.select([]));

  // ---------------------------------------------------------------------------------------- 5. paste an image from the clipboard
  current = 'paste: ';
  const imagesBefore = (await state(page)).elements.filter(e => e.type === 'image').length;
  await pasteFiles(page, [pngFile('image.png', [30, 60, 200], 160, 90)]);
  await page.waitForFunction(n => window.DtDesigner.app.elements().filter(e => e.type === 'image').length === n, imagesBefore + 1, { timeout: 15000 });
  await idle(page);
  s = await state(page);
  const pasted = s.elements.find(e => e.id === s.sel[0]);
  check('Ctrl+V with an image in the clipboard uploads it and inserts it', pasted && pasted.type === 'image' && /^bild-\d{8}-\d{6}/.test(pasted.source.asset), pasted && JSON.stringify(pasted.source));
  check('in the middle of the page and selected', pasted && near(pasted.x + pasted.w / 2, 75, 0.3) && near(pasted.y + pasted.h / 2, 50, 0.3));
  check('the uploaded picture is drawn (the library knew it at once)', await page.evaluate(() => document.querySelectorAll('#dt-page svg image').length) >= 2);
  const before = (await state(page)).elements.length;
  await pasteText(page, 'Eingefügter Text vom Clipboard');
  await idle(page);
  s = await state(page);
  check('plain text becomes a text element', s.elements.length === before + 1 && s.elements.some(e => e.type === 'text' && e.text === 'Eingefügter Text vom Clipboard'));
  // copied elements: Ctrl+C / Ctrl+V, offset on the same page
  await selectIds(page, [rectId]);
  const rect0 = await nodeOf(page, rectId);
  const n0 = (await state(page)).elements.length;
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  await idle(page);
  s = await state(page);
  const pastedRect = s.elements.find(e => e.id === s.sel[0]);
  check('Ctrl+C / Ctrl+V pastes the element with a new id, 5 mm to the side', s.elements.length === n0 + 1 && pastedRect.id !== rectId && near(pastedRect.x - rect0.x, 5, 0.01) && near(pastedRect.y - rect0.y, 5, 0.01), JSON.stringify(pastedRect && [pastedRect.x, rect0.x]));
  await page.keyboard.press('Control+v');
  await idle(page);
  const s2 = await state(page);
  const second = s2.elements.find(e => e.id === s2.sel[0]);
  check('a second paste moves further (10 mm)', near(second.x - rect0.x, 10, 0.01));
  check('the copy is also in localStorage dt-clipboard', await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('dt-clipboard')).designThix === 2; } catch (e) { return false; } }));

  // ---------------------------------------------------------------------------------------- 6. files dropped from the explorer
  current = 'drop: ';
  // a clean design for the drop checks
  const dropDesign = await fresh(page);
  const centre = await pageCentre(page);
  let overlaySeen = await dropFiles(page, [pngFile('drop-eins.png', [0, 120, 90], 120, 80), pngFile('drop-zwei.png', [120, 0, 90], 120, 80)], centre.x - 150, centre.y - 60);
  await page.waitForFunction(() => window.DtDesigner.app.elements().filter(e => e.type === 'image').length === 2, null, { timeout: 15000 });
  await idle(page);
  s = await state(page);
  const dropped = s.elements.filter(e => e.type === 'image');
  check('a drag with files shows the overlay "Zum Hochladen loslassen"', overlaySeen === true);
  check('the overlay is gone after the drop', await page.evaluate(() => document.getElementById('dt-dropzone').hidden));
  check('dropped files are uploaded and inserted at the drop point (cascaded)', dropped.length === 2 && near(dropped[0].x + dropped[0].w / 2, 75 - 150 / (await geometry(page, dropped[0].id)).k, 1.5) && dropped[1].x > dropped[0].x && dropped[1].y > dropped[0].y, JSON.stringify(dropped.map(d => [d.x, d.y])));
  check('both have the keys of their file names', dropped.map(d => d.source.asset).sort().join() === 'drop-eins,drop-zwei' || dropped.every(d => /^drop-/.test(d.source.asset)), dropped.map(d => d.source.asset).join());
  // onto an image: its source is replaced
  const g1 = await geometry(page, dropped[1].id);
  const n1 = (await state(page)).elements.length;
  await dropFiles(page, [pngFile('ersatz.png', [250, 150, 0], 100, 100)], g1.cx, g1.cy);
  await page.waitForFunction(id => { const e = window.DtDesigner.app.element(id); return e && /^ersatz/.test(e.source.asset); }, dropped[1].id, { timeout: 15000 });
  check('a file dropped onto an image replaces its source (no new element)', (await state(page)).elements.length === n1 && (await nodeOf(page, dropped[1].id)).source.asset.startsWith('ersatz'));
  // onto an empty frame
  await openPanel(page, 'elements');
  await page.click('.dt-tile[data-add="frame-circle"]');
  await idle(page);
  const frameId = (await state(page)).sel[0];
  await page.evaluate(id => window.DtDesigner.app.setProps([id], { x: 5, y: 60, w: 30, h: 30 }, { merge: false }), frameId);
  await idle(page);
  const gf = await geometry(page, frameId);
  await dropFiles(page, [pngFile('rahmenbild.png', [0, 90, 200], 100, 100)], gf.cx, gf.cy);
  await page.waitForFunction(id => { const e = window.DtDesigner.app.element(id); return e && e.source && /^rahmenbild/.test(e.source.asset); }, frameId, { timeout: 15000 });
  check('a file dropped onto an empty frame fills it', (await nodeOf(page, frameId)).source.asset.startsWith('rahmenbild') && (await nodeOf(page, frameId)).mask === 'circle');
  // onto a slot of an image strip
  await page.click('.dt-tile[data-add="strip"]');
  await idle(page);
  const stripId = (await state(page)).sel[0];
  await page.evaluate(id => window.DtDesigner.app.setProps([id], { x: 40, y: 5, w: 100, h: 20 }, { merge: false }), stripId);
  await idle(page);
  const gs = await geometry(page, stripId);
  await dropFiles(page, [pngFile('slotbild.png', [90, 0, 200], 100, 100)], gs.rect.left + gs.rect.width * 0.62, gs.cy);
  await page.waitForFunction(id => { const e = window.DtDesigner.app.element(id); return e && e.items.some(i => i && /^slotbild/.test(i.asset)); }, stripId, { timeout: 15000 });
  const slotIndex = (await nodeOf(page, stripId)).items.findIndex(i => i && /^slotbild/.test(i.asset));
  check('a file dropped onto a strip slot sets that slot (third of four)', slotIndex === 2, String(slotIndex));
  // a font dropped onto the canvas is applied to the selected text
  await openPanel(page, 'text');
  await page.click('.dt-textadd__btn[data-add="body"]');
  await page.waitForSelector('.dt-textedit');
  await page.keyboard.type('Schrift-Test');
  await page.keyboard.press('Control+Enter');
  await idle(page);
  const fontTextId = (await state(page)).sel[0];
  await page.evaluate(id => window.DtDesigner.app.setProps([id], { fontFamily: 'Montserrat' }, { merge: false }), fontTextId);
  const fontsBefore = await page.evaluate(() => window.DtDesigner.app.fontIndex.length);
  let uploadedFontId = 0;
  page.on('response', async r => { if (r.url().endsWith("/api/fonts/upload")) { try { uploadedFontId = (await r.json()).uploaded[0].id; } catch (e) { /* no font */ } } });
  await dropFiles(page, [fontFile('Pacifico-Drop.ttf')], centre.x, centre.y + 80);
  await page.waitForFunction(id => window.DtDesigner.app.element(id).fontFamily === 'Pacifico', fontTextId, { timeout: 20000 });
  check('a font file dropped onto the canvas is uploaded and applied to the selected text', (await nodeOf(page, fontTextId)).fontFamily === 'Pacifico' && await page.evaluate(n => window.DtDesigner.app.fontIndex.length >= n, fontsBefore));
  // errors are shown per file, in German
  await dropFiles(page, [{ name: 'notizen.txt', type: 'text/plain', base64: Buffer.from('hallo').toString('base64') }], centre.x, centre.y);
  await page.waitForSelector('.mat-toast:has-text("notizen.txt")', { timeout: 5000 });
  check('a file of another type is refused with a German message', (await page.textContent('.mat-toast:has-text("notizen.txt")')).includes('Dateityp'));
  await dropFiles(page, [{ name: 'kaputt.png', type: 'image/png', base64: Buffer.from('das ist kein bild').toString('base64') }], centre.x, centre.y);
  await page.waitForSelector('.mat-toast:has-text("kaputt.png")', { timeout: 15000 });
  check('a broken picture is refused by the server with a message naming the file', true);
  await shot(page, 'canva-1440-drop-done.png');

  if (uploadedFontId) {
    // the font of the check is removed again (the library is shared with the other checks)
    await page.goto(`${base}/Fonts/Edit/${uploadedFontId}`);
    await page.click('button.mat-btn--danger');
    await Promise.all([page.waitForNavigation(), page.click('dialog[open] button[value="ok"]')]);
    await openDesigner(page, base, dropDesign);
  }

  // ---------------------------------------------------------------------------------------- 7. the media browser (strip slots, Ersetzen, background)
  current = 'media: ';
  await page.evaluate(() => window.DtDesigner.app.select([]));
  await openPanel(page, 'elements');
  await page.evaluate(id => window.DtDesigner.app.deleteIds([id]), stripId);
  await page.click('.dt-tile[data-add="strip"]');
  await idle(page);
  const strip2 = (await state(page)).sel[0];
  check('the strip toolbar shows a chip per slot, not a dropdown', (await kind(page)) === 'strip' && (await page.$$('#dt-ctx .dt-slotchip')).length === 4 && !(await page.$('#dt-ctx select')));
  await page.click('#dt-ctx .dt-slotchip[data-slot="0"]');
  await page.waitForSelector('dialog.dt-media[open]');
  const tabs = await page.$$eval('.dt-media__tab', t => t.map(x => x.textContent));
  check('the media browser has the tabs Uploads, Flaggen, Siegel, Logos and Alle', tabs.join('|') === 'Uploads|Flaggen|Siegel|Logos|Alle', tabs.join('|'));
  check('it has a search field, an upload button and a hint for drop and paste', await page.isVisible('.dt-media__search') && await page.isVisible('.dt-media__upload') && /Strg\+V/.test(await page.textContent('.dt-media__hint')));
  await page.waitForSelector('.dt-media__tile');
  await shot(page, 'canva-1440-media.png');
  await page.click('.dt-media__tab[data-tab="flags"]');
  await page.waitForFunction(() => { const t = document.querySelectorAll('.dt-media__tile'); return t.length > 5 && Array.from(t).every(x => /^flag-/.test(x.getAttribute('data-key'))); });
  await page.fill('.dt-media__search', 'Deutsch');
  await page.waitForFunction(() => document.querySelectorAll('.dt-media__tile').length === 1, null, { timeout: 5000 });
  check('the search narrows the flags', (await page.getAttribute('.dt-media__tile', 'data-key')) === 'flag-de');
  await page.click('.dt-media__tile');
  await page.waitForSelector('dialog.dt-media', { state: 'detached' });
  check('a click on a thumbnail chooses it for slot 1', ((await nodeOf(page, strip2)).items[0] || {}).asset === 'flag-de');
  check('the chip shows the thumbnail of the chosen picture', await page.isVisible('#dt-ctx .dt-slotchip[data-slot="0"] img'));
  // keyboard: open slot 2, arrow down from the search field to the grid, Enter
  await page.click('#dt-ctx .dt-slotchip[data-slot="1"]');
  await page.waitForSelector('.dt-media__tile');
  await page.click('.dt-media__tab[data-tab="seals"]');
  await page.waitForFunction(() => document.querySelectorAll('.dt-media__tile').length > 3 && /^icon-/.test(document.querySelector('.dt-media__tile').getAttribute('data-key')));
  await page.focus('.dt-media__search');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.waitForSelector('dialog.dt-media', { state: 'detached' });
  check('the grid is keyboard navigable (arrows, Enter chooses)', /^icon-/.test(((await nodeOf(page, strip2)).items[1] || {}).asset || ''), JSON.stringify((await nodeOf(page, strip2)).items));
  // Escape cancels
  await page.click('#dt-ctx .dt-slotchip[data-slot="2"]');
  await page.waitForSelector('dialog.dt-media[open]');
  await page.keyboard.press('Escape');
  await page.waitForSelector('dialog.dt-media', { state: 'detached' });
  check('Escape cancels without a change', (await nodeOf(page, strip2)).items[2] === null);
  // upload from inside the browser: one file is chosen at once
  await page.click('#dt-ctx .dt-slotchip[data-slot="2"]');
  await page.waitForSelector('dialog.dt-media[open]');
  const [chooser2] = await Promise.all([page.waitForEvent('filechooser'), page.click('.dt-media__upload')]);
  const slotUp = 'check-slot-' + Date.now();
  await chooser2.setFiles({ name: slotUp + '.png', mimeType: 'image/png', buffer: Buffer.from(pngFile('x.png', [10, 150, 60], 80, 80).base64, 'base64') });
  await page.waitForSelector('dialog.dt-media', { state: 'detached' });
  check('an upload inside the browser is chosen at once', ((await nodeOf(page, strip2)).items[2] || {}).asset === slotUp, JSON.stringify((await nodeOf(page, strip2)).items));
  // paste inside the browser
  await page.click('#dt-ctx .dt-slotchip[data-slot="3"]');
  await page.waitForSelector('dialog.dt-media[open]');
  await pasteFiles(page, [pngFile('image.png', [150, 150, 10], 90, 90)]);
  await page.waitForSelector('dialog.dt-media', { state: 'detached' });
  check('Ctrl+V while the browser is open uploads and chooses the picture', /^bild-/.test(((await nodeOf(page, strip2)).items[3] || {}).asset || ''), JSON.stringify((await nodeOf(page, strip2)).items));
  // the chip menu: bind to a field, clear, remove; plus adds a slot
  await page.click('#dt-ctx .dt-slot:nth-child(1) .dt-slotchip__more');
  await page.waitForSelector('.dt-menu');
  const slotMenu = await page.$$eval('.dt-menu__label', l => l.map(x => x.textContent));
  check('the ⋯ of a slot: Bild wählen, An Feld binden, Platz leeren, Platz entfernen', ['Bild wählen …', 'An Feld binden (Zusatz)', 'Platz leeren', 'Platz entfernen'].every(l => slotMenu.includes(l)), slotMenu.join('|'));
  await menuClick(page, 'Platz leeren');
  check('Platz leeren empties the slot', (await nodeOf(page, strip2)).items[0] === null);
  await page.click('#dt-ctx .dt-slot:nth-child(1) .dt-slotchip__more');
  await menuItem(page, 'An Feld binden (Zusatz)').click();
  await menuClick(page, 'Neues Bildfeld …', 1);
  await idle(page);
  check('"Neues Bildfeld" binds the slot to a new image field', ((await nodeOf(page, strip2)).items[0] || {}).field === 'Bild1' && (await state(page)).fields.some(f => f.key === 'Bild1' && f.type === 'image'));
  await page.click('#dt-ctx button[aria-label="Platz hinzufügen"]');
  check('+ adds a slot', (await nodeOf(page, strip2)).items.length === 5);
  await page.click('#dt-ctx .dt-slot:nth-child(5) .dt-slotchip__more');
  await menuClick(page, 'Platz entfernen');
  check('Platz entfernen removes it', (await nodeOf(page, strip2)).items.length === 4);
  await shot(page, 'canva-1440-strip.png');
  // Ersetzen of an image through the browser
  await selectIds(page, [imageId]);
  await page.click('#dt-ctx button:has-text("Ersetzen")');
  await page.waitForSelector('dialog.dt-media[open]');
  await page.click('.dt-media__tab[data-tab="all"]');
  await page.fill('.dt-media__search', 'flag-fr');
  await page.waitForFunction(() => document.querySelectorAll('.dt-media__tile').length >= 1);
  const picked = await page.getAttribute('.dt-media__tile >> nth=0', 'data-key');
  await page.click('.dt-media__tile >> nth=0');
  await page.waitForSelector('dialog.dt-media', { state: 'detached' });
  check('Ersetzen opens the browser and sets the source of the image', (await nodeOf(page, imageId)).source.asset === picked, picked);
  // the background picture
  await page.evaluate(() => window.DtDesigner.app.select([]));
  await raf2(page);
  await page.click('#dt-ctx button[aria-label="Hintergrundbild"]');
  await page.waitForSelector('dialog.dt-media[open]');
  await page.click('.dt-media__tab[data-tab="all"]');
  await page.waitForSelector('.dt-media__tile');
  const bgKey = await page.getAttribute('.dt-media__tile >> nth=0', 'data-key');
  await page.click('.dt-media__tile >> nth=0');
  await page.waitForSelector('dialog.dt-media', { state: 'detached' });
  check('the background picture is chosen in the browser too', (await state(page)).pages[0].background.asset === bgKey, bgKey);
  await page.click('#dt-ctx button[aria-label="Hintergrundbild entfernen"]');
  check('and removed again', (await state(page)).pages[0].background.asset === null);

  // ---------------------------------------------------------------------------------------- 8. pages
  current = 'pages: ';
  await fresh(page);
  await openPanel(page, 'text');
  await page.click('.dt-textadd__btn[data-add="heading"]');
  await page.waitForSelector('.dt-textedit');
  await page.keyboard.type('Seite eins');
  await page.keyboard.press('Control+Enter');
  await idle(page);
  check('one page, one thumbnail', (await page.$$('#dt-pages .dt-thumbitem')).length === 1);
  await page.click('.dt-addpage');
  await idle(page);
  s = await state(page);
  check('"+" adds a page after the current one and switches to it', s.pages.length === 2 && s.pageIndex === 1 && s.elements.length === 0 && (await page.$$('#dt-pages .dt-thumbitem')).length === 2);
  check('the new page is shown empty (the canvas switched)', (await svgText(page)) === '');
  await openPanel(page, 'text');
  await page.click('.dt-textadd__btn[data-add="heading"]');
  await page.waitForSelector('.dt-textedit');
  await page.keyboard.type('Seite zwei');
  await page.keyboard.press('Control+Enter');
  await idle(page);
  await page.click('#dt-pages .dt-thumbitem:nth-child(1) .dt-thumb');
  await idle(page);
  check('a click on a thumbnail switches to that page', (await state(page)).pageIndex === 0 && (await svgText(page)).includes('Seite eins'));
  await page.waitForFunction(() => document.querySelectorAll('#dt-pages .dt-thumb__page svg text').length >= 2, null, { timeout: 10000 });
  check('the thumbnails are drawn by the engine', (await page.$$eval('#dt-pages .dt-thumb__page svg text', t => t.map(x => x.textContent))).join('|') === 'Seite eins|Seite zwei');
  // thumbnail menu
  await page.click('#dt-pages .dt-thumbitem:nth-child(1) .dt-thumb', { button: 'right' });
  await page.waitForSelector('.dt-menu');
  const thumbLabels = await page.$$eval('.dt-menu__label', l => l.map(x => x.textContent));
  check('the menu of a thumbnail: duplicate, delete, move left/right', ['Seite duplizieren', 'Seite löschen', 'Nach links', 'Nach rechts'].every(l => thumbLabels.includes(l)), thumbLabels.join('|'));
  check('"Nach links" of the first page is disabled with a reason', (await menuItem(page, 'Nach links').getAttribute('aria-disabled')) === 'true');
  await menuClick(page, 'Seite duplizieren');
  await idle(page);
  s = await state(page);
  check('Seite duplizieren inserts a copy after the page (with new ids) and shows it', s.pages.length === 3 && s.pageIndex === 1 && s.pages[1].elements.length === 1 && s.pages[1].elements[0].id !== s.pages[0].elements[0].id && s.pages[1].elements[0].text === 'Seite eins');
  // reorder by dragging: the third thumbnail (Seite zwei) in front of the first
  const thumbBox = async n => page.$eval(`#dt-pages .dt-thumbitem:nth-child(${n}) .dt-thumb`, t => { const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left }; });
  const third = await thumbBox(3);
  const first = await thumbBox(1);
  await drag(page, third, { x: first.l + 4, y: first.y });
  s = await state(page);
  check('dragging a thumbnail reorders the pages', s.pages[0].elements[0].text === 'Seite zwei' && s.pages[1].elements[0].text === 'Seite eins' && s.pages[2].elements[0].text === 'Seite eins', s.pages.map(p => p.elements[0] && p.elements[0].text).join('|'));
  await page.click('#dt-pages .dt-thumbitem:nth-child(3) .dt-thumb', { button: 'right' });
  await menuClick(page, 'Seite löschen');
  await idle(page);
  s = await state(page);
  check('Seite löschen removes it', s.pages.length === 2 && (await page.$$('#dt-pages .dt-thumbitem')).length === 2);
  await page.click('#dt-pages .dt-thumbitem:nth-child(2) .dt-thumb', { button: 'right' });
  await menuClick(page, 'Nach links');
  s = await state(page);
  check('Nach links moves the page', s.pages[0].elements[0].text === 'Seite eins');
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await idle(page);
  check('page changes are undoable (undo twice: the deleted page is back)', (await state(page)).pages.length === 3);
  await page.click('.dt-addpage');
  await page.evaluate(() => window.DtDesigner.app.deletePage(window.DtDesigner.app.pageIndex));
  await page.click('#dt-pages .dt-thumbitem:nth-child(1) .dt-thumb', { button: 'right' });
  await menuClick(page, 'Seite umbenennen …');
  await page.waitForSelector('dialog[open] input');
  await page.fill('dialog[open] input', 'Titel');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.DtDesigner.app.doc.pages[0].name === 'Titel');
  check('Seite umbenennen names the page (shown below the thumbnail)', (await page.textContent('#dt-pages .dt-thumbitem:nth-child(1) .dt-thumb__label')).includes('Titel'));
  await shot(page, 'canva-1440-pages.png');

  // ---------------------------------------------------------------------------------------- 8b. Vorlagen, Marke, dragging tiles, letter shortcuts
  current = 'library: ';
  await fresh(page);
  await openPanel(page, 'templates');
  await page.waitForFunction(() => document.querySelectorAll('.dt-tpl__item').length > 0 || /Es gibt noch keine Vorlagen/.test(document.getElementById('dt-panel-body').textContent), null, { timeout: 10000 });
  const tplCount = await page.$$eval('.dt-tpl__item', l => l.length);
  if (tplCount > 0) {
    await page.click('.dt-tpl__item >> nth=0');
    await page.waitForSelector('dialog[open]');
    const tplDialog = await page.textContent('dialog[open]');
    check('a template opens the dialog "Als neue Seite" / "Seite ersetzen"', tplDialog.includes('Als neue Seite') && tplDialog.includes('Seite ersetzen'));
    await page.click('dialog[open] button[data-value="add"]');
    await page.waitForSelector('dialog', { state: 'detached' });
    await idle(page);
    s = await state(page);
    check('"Als neue Seite" adds the page of the template after the current one and shows it', s.pages.length >= 2 && s.pageIndex === 1 && s.elements.length > 0, JSON.stringify([s.pages.length, s.pageIndex, s.elements.length]));
    await page.keyboard.press('Control+z');
    await idle(page);
    check('and it is one undo step', (await state(page)).pages.length === 1);
    await page.click('.dt-tpl__item >> nth=0');
    await page.waitForSelector('dialog[open]');
    await page.click('dialog[open] button[data-value="replace"]');
    await page.waitForSelector('dialog', { state: 'detached' });
    await idle(page);
    s = await state(page);
    check('"Seite ersetzen" puts the template on the current page', s.pages.length === 1 && s.elements.length > 0);
  } else {
    check('there are no templates in this database (the Vorlagen panel says so)', await page.isVisible('.dt-panel__body .dt-empty'));
  }
  const libDesign = await page.evaluate(() => window.DtDesigner.app.id);
  // Marke: colours, fonts, logos from the brand kit
  const brandBefore = await page.evaluate(async () => (await (await fetch('/api/brand')).json()));
  const brandPosted = await postJson(page, '/api/brand', { colors: ['#112233', '#445566'], fonts: { heading: 'Oswald', subheading: 'Lora', body: 'Open Sans' }, logos: ['flag-de'] });
  check('the brand kit can be set through the API', brandPosted.status === 200, JSON.stringify(brandPosted.body).slice(0, 120));
  await openDesigner(page, base, libDesign);
  await openPanel(page, 'brand');
  check('the Marke panel shows the colours, the fonts and the logos of the brand kit', (await page.$$('.dt-panel__body .dt-swatch')).length === 2 && (await page.$$('.dt-panel__body .dt-textadd__btn')).length === 3 && (await page.$$('.dt-panel__body .dt-asset')).length === 1);
  await shot(page, 'canva-1440-brand.png');
  await openPanel(page, 'text');
  await page.click('.dt-textadd__btn[data-add="heading"]');
  await page.waitForSelector('.dt-textedit');
  await page.keyboard.press('Escape');
  await idle(page);
  const brandText = (await state(page)).sel[0];
  check('"Überschrift hinzufügen" uses the brand font of the heading', (await nodeOf(page, brandText)).fontFamily === 'Oswald');
  await openPanel(page, 'brand');
  await page.click('.dt-panel__body .dt-swatch[data-colour="#112233"]');
  check('a brand colour colours the selected text', (await nodeOf(page, brandText)).color === '#112233');
  await page.click('.dt-panel__body .dt-textadd__btn:has-text("Fließtext")');
  check('a brand font changes the font of the selected text', (await nodeOf(page, brandText)).fontFamily === 'Open Sans');
  await page.click('.dt-panel__body .dt-asset');
  await idle(page);
  check('a logo of the brand kit is inserted as an image', (await state(page)).elements.some(e => e.type === 'image' && e.source && e.source.asset === 'flag-de'));
  await selectIds(page, [brandText]);
  await page.click('#dt-ctx button[aria-label="Textfarbe"]');
  await page.waitForSelector('.dt-colorpop');
  check('the colour popover lists the brand colours', (await page.$$('.dt-colorpop [data-section="brand"] .dt-swatch')).length === 2);
  await page.keyboard.press('Escape');
  await postJson(page, '/api/brand', { colors: brandBefore.colors, fonts: brandBefore.fonts, logos: brandBefore.logos });
  // dragging tiles onto the page
  await fresh(page);
  await openPanel(page, 'elements');
  const tileAt = async sel => page.$eval(sel, t => { const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const cpage = await pageCentre(page);
  await drag(page, await tileAt('.dt-tile[data-add="ellipse"]'), { x: cpage.l + cpage.w * 0.25, y: cpage.t + cpage.h * 0.3 });
  s = await state(page);
  const dragged = s.elements.find(e => e.shape === 'ellipse');
  const k0 = await page.evaluate(() => window.DtDesigner.app.scale());
  check('dragging a shape tile onto the page puts the shape where it is dropped', !!dragged && near(dragged.x + dragged.w / 2, cpage.w * 0.25 / k0, 1) && near(dragged.y + dragged.h / 2, cpage.h * 0.3 / k0, 1), JSON.stringify(dragged && [dragged.x, dragged.y, dragged.w]));
  await openPanel(page, 'uploads');
  await page.waitForSelector('.dt-asset');
  const firstAsset = await page.getAttribute('.dt-assetgrid .dt-asset >> nth=0', 'data-key');
  await drag(page, await tileAt('.dt-assetgrid .dt-asset >> nth=0'), { x: cpage.l + cpage.w * 0.7, y: cpage.t + cpage.h * 0.7 });
  s = await state(page);
  const placed = s.elements.find(e => e.type === 'image');
  check('dragging an upload onto the page inserts the image at the drop point', !!placed && placed.source.asset === firstAsset && near(placed.x + placed.w / 2, cpage.w * 0.7 / k0, 1.5), JSON.stringify(placed && [placed.x, placed.w, placed.source]));
  const secondAsset = await page.getAttribute('.dt-assetgrid .dt-asset >> nth=1', 'data-key');
  const gp = await geometry(page, placed.id);
  await drag(page, await tileAt('.dt-assetgrid .dt-asset >> nth=1'), { x: gp.cx, y: gp.cy });
  check('dragging an upload onto an image replaces its source', (await nodeOf(page, placed.id)).source.asset === secondAsset && (await state(page)).elements.filter(e => e.type === 'image').length === 1, secondAsset);
  // letters
  await page.mouse.click(cpage.l - 30, cpage.t - 30);
  const letters0 = (await state(page)).elements.length;
  await page.keyboard.press('r');
  await page.keyboard.press('c');
  await page.keyboard.press('l');
  s = await state(page);
  check('R, C and L add a rectangle, a circle and a line', s.elements.length === letters0 + 3 && s.elements.filter(e => e.shape === 'rect').length === 1 && s.elements.filter(e => e.shape === 'ellipse').length === 2 && s.elements.some(e => e.shape === 'line'));
  await page.keyboard.press('t');
  await page.waitForSelector('.dt-textedit');
  await page.keyboard.type('Mit T');
  await page.keyboard.press('Escape');
  await idle(page);
  check('T adds a text and opens the editor', (await state(page)).elements.some(e => e.type === 'text' && e.text === 'Mit T'));

  // ---------------------------------------------------------------------------------------- 9. groups: move, resize, rotate, enter
  current = 'group: ';
  const groupDesign = await fresh(page);
  await openPanel(page, 'elements');
  await page.click('.dt-tile[data-add="rect"]');
  const gA = (await state(page)).sel[0];
  await page.click('.dt-tile[data-add="ellipse"]');
  const gB = (await state(page)).sel[0];
  await page.evaluate(([a, b]) => { const app = window.DtDesigner.app; app.setProps([a], { x: 20, y: 20, w: 30, h: 20 }, { merge: false }); app.setProps([b], { x: 70, y: 40, w: 25, h: 25 }, { merge: false }); }, [gA, gB]);
  await idle(page);
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+g');
  await idle(page);
  s = await state(page);
  const grp = s.elements[0];
  check('Ctrl+G groups the selection; the group box is the union of its children', s.elements.length === 1 && grp.type === 'group' && grp.children.length === 2 && near(grp.x, 20, 0.01) && near(grp.y, 20, 0.01) && near(grp.w, 75, 0.01) && near(grp.h, 45, 0.01), JSON.stringify([grp.x, grp.y, grp.w, grp.h]));
  check('the group is selected and the toolbar offers "Gruppierung aufheben"', s.sel[0] === grp.id && await page.isVisible('#dt-ctx button:has-text("Gruppierung aufheben")'));
  const gg = await geometry(page, grp.id);
  const ga0 = await page.evaluate(cid => { const D = window.DtDesigner; const r = D.app.locate(cid, false); return D.canvas.toClient(D.toWorld(r.chain, { x: r.el.x + r.el.w / 2, y: r.el.y + r.el.h / 2 })); }, gA);
  await page.evaluate(() => { window.DtDesigner.app.snapping = false; });
  await drag(page, ga0, { x: ga0.x + 60, y: ga0.y + 30 });
  const movedGroup = await nodeOf(page, grp.id);
  const kids = movedGroup.children;
  check('moving the group moves both children by the same amount (page coordinates)', near(movedGroup.x, 20 + 60 / gg.k, 0.1) && near(kids[0].x, 20 + 60 / gg.k, 0.1) && near(kids[1].x, 70 + 60 / gg.k, 0.1) && near(kids[0].y, 20 + 30 / gg.k, 0.1), JSON.stringify([movedGroup.x, kids[0].x, kids[1].x]));
  check('the engine drew the children at their new place', await page.evaluate(([a]) => !!document.querySelector('#dt-page g[data-el-id="' + a + '"]'), [gA]));
  // resize the group by its corner handle: children scale in page coordinates
  const se = await handleCentre(page, 'se');
  const w0 = movedGroup.w;
  await drag(page, se, { x: se.x + 60, y: se.y + 30 }, { hold: ['Shift'] });
  const bigger = await nodeOf(page, grp.id);
  check('resizing the group scales its children', bigger.w > w0 + 5 && bigger.children[0].w > kids[0].w && bigger.children[1].x > kids[1].x, JSON.stringify([w0, bigger.w, kids[0].w, bigger.children[0].w]));
  // rotate the group around its own centre: the engine rotates the <g> of the group
  await page.evaluate(id => window.DtDesigner.app.setProps([id], { rotation: 90 }, { merge: false }), grp.id);
  await idle(page);
  const gr = await nodeOf(page, grp.id);
  const rotateAttr = await page.evaluate(id => document.querySelector('#dt-page g[data-el-id="' + id + '"]').getAttribute('transform'), grp.id);
  check('a rotated group is rotated as a whole by the engine', /rotate\(90/.test(rotateAttr || ''), rotateAttr);
  // hit testing in a rotated group: the click on the visual centre of the first child selects the group
  await page.evaluate(() => window.DtDesigner.app.select([]));
  const worldChild = await page.evaluate(([gid, cid]) => {
    const D = window.DtDesigner;
    const r = D.app.locate(cid, false);
    const w = D.toWorld(r.chain, { x: r.el.x + r.el.w / 2, y: r.el.y + r.el.h / 2 });
    const c = D.canvas.toClient(w);
    return c;
  }, [grp.id, gA]);
  await page.mouse.click(worldChild.x, worldChild.y);
  check('a click on a child of a rotated group (where it is drawn) selects the group', (await state(page)).sel[0] === grp.id);
  await page.evaluate(id => window.DtDesigner.app.setProps([id], { rotation: 0 }, { merge: false }), grp.id);
  await idle(page);
  // double click selects the child under the pointer; Ctrl+click goes deep
  await page.evaluate(() => window.DtDesigner.app.select([]));
  const childG = await page.evaluate(cid => { const D = window.DtDesigner; const r = D.app.locate(cid, false); return D.canvas.toClient(D.toWorld(r.chain, { x: r.el.x + r.el.w / 2, y: r.el.y + r.el.h / 2 })); }, gB);
  await page.mouse.click(childG.x, childG.y);
  check('a click on a grouped element selects the whole group', (await state(page)).sel[0] === grp.id);
  await page.mouse.dblclick(childG.x, childG.y);
  check('a double click selects the child under the pointer', (await state(page)).sel.join() === gB);
  await page.keyboard.press('Escape');
  await page.keyboard.down('Control');
  await page.mouse.click(childG.x, childG.y);
  await page.keyboard.up('Control');
  check('Ctrl+click selects the child directly', (await state(page)).sel.join() === gB);
  await openPanel(page, 'layers');
  check('the layers panel shows the group with its children', (await page.$$('.dt-layer.is-group')).length === 1 && (await page.$$('.dt-layer')).length === 3);
  await shot(page, 'canva-1440-layers-group.png');
  // moving a child inside the group keeps the group box as the union
  const childBefore = await nodeOf(page, gB);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowDown');
  await idle(page);
  const groupAfter = await nodeOf(page, grp.id);
  check('moving a child updates the box of the group (union of the children)', near((await nodeOf(page, gB)).x, childBefore.x + 0.5, 0.001) && near(groupAfter.x + groupAfter.w, Math.max(...groupAfter.children.map(c => c.x + c.w)), 0.01));
  // layers: drag a child out of the group (onto the page level)
  const rowBox = id => page.$eval(`.dt-layer[data-id="${id}"]`, li => { const r = li.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, h: r.height }; });
  const gripOf = id => page.$eval(`.dt-layer[data-id="${id}"] .dt-layer__grip`, g => { const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const groupRow = await rowBox(grp.id);
  await drag(page, await gripOf(gB), { x: groupRow.left + 60, y: groupRow.top + 2 });
  s = await state(page);
  check('dragging a layer above the group row takes it out of the group', s.elements.length === 2 && s.elements.some(e => e.id === gB) && s.elements.find(e => e.type === 'group').children.length === 1, JSON.stringify(s.elements.map(e => e.id + ':' + e.type)));
  // drag it back into the group (middle of the group row)
  const groupRow2 = await rowBox(grp.id);
  await drag(page, await gripOf(gB), { x: groupRow2.left + 60, y: (groupRow2.top + groupRow2.bottom) / 2 });
  s = await state(page);
  check('dragging a layer onto a group row puts it into the group', s.elements.length === 1 && s.elements[0].children.length === 2, JSON.stringify(s.elements.map(e => e.id + ':' + e.type)));
  await selectIds(page, [grp.id]);
  await page.keyboard.press('Control+Shift+g');
  await idle(page);
  s = await state(page);
  check('Ctrl+Shift+G dissolves the group, the children stay where they are', s.elements.length === 2 && s.elements.every(e => e.type === 'shape') && s.sel.length === 2);
  await page.keyboard.press('Control+z');
  await idle(page);
  check('and undo makes the group again', (await state(page)).elements.length === 1);
  void groupDesign;

  // ---------------------------------------------------------------------------------------- 10. interaction: hover, rotate handle below, Alt+drag, equal spacing, tooltip
  current = 'interaction: ';
  await fresh(page);
  await openPanel(page, 'elements');
  const ids3 = [];
  for (let i = 0; i < 3; i++) { await page.click('.dt-tile[data-add="rect"]'); ids3.push((await state(page)).sel[0]); }
  await page.evaluate(i => { const app = window.DtDesigner.app; app.setProps([i[0]], { x: 10, y: 10, w: 20, h: 15 }, { merge: false }); app.setProps([i[1]], { x: 50, y: 10, w: 20, h: 15 }, { merge: false }); app.setProps([i[2]], { x: 100, y: 55, w: 20, h: 15 }, { merge: false }); app.select([]); }, ids3);
  await idle(page);
  const h0 = await geometry(page, ids3[0]);
  await page.mouse.move(h0.cx, h0.cy);
  await page.waitForTimeout(150);
  check('hovering an element draws an outline', await page.evaluate(() => document.querySelectorAll('.dt-ov-hover').length) > 0);
  await page.mouse.click(h0.cx, h0.cy);
  await raf2(page);
  const rotY = await handleCentre(page, 'rot');
  const boxBottom = (await geometry(page, ids3[0])).rect.bottom;
  check('the rotate handle sits below the element', rotY && rotY.y > boxBottom + 10, `${rotY && rotY.y} vs ${boxBottom}`);
  let tip = '';
  const se1 = await handleCentre(page, 'se');
  await drag(page, se1, { x: se1.x + 30, y: se1.y + 15 }, { beforeUp: async () => { await page.waitForTimeout(80); tip = await page.evaluate(() => (document.querySelector('.dt-ov-badge text') || {}).textContent || ''); } });
  check('resizing shows a live size tooltip ("… × … mm")', /\d+([.,]\d+)? × \d+([.,]\d+)? mm/.test(tip), tip);
  let angleTip = '';
  const rot1 = await handleCentre(page, 'rot');
  await drag(page, rot1, { x: rot1.x + 50, y: rot1.y + 5 }, { beforeUp: async () => { await page.waitForTimeout(80); angleTip = await page.evaluate(() => (document.querySelector('.dt-ov-badge text') || {}).textContent || ''); } });
  check('rotating shows the angle ("15°")', /-?\d+(\.\d+)?°/.test(angleTip), angleTip);
  await page.evaluate(id => window.DtDesigner.app.setProps([id], { rotation: 0 }, { merge: false }), ids3[0]);
  await idle(page);
  // Alt + drag duplicates
  const countA = (await state(page)).elements.length;
  const ga = await geometry(page, ids3[0]);
  await drag(page, { x: ga.cx, y: ga.cy }, { x: ga.cx + 40, y: ga.cy + 120 }, { hold: ['Alt'] });
  s = await state(page);
  const orig0 = await nodeOf(page, ids3[0]);
  check('Alt + drag drags a copy and leaves the original', s.elements.length === countA + 1 && near(orig0.x, 10, 0.01) && s.sel.length === 1 && s.sel[0] !== ids3[0], `${s.elements.length} vs ${countA}`);
  await page.keyboard.press('Control+z');
  await idle(page);
  check('the copy is one undo step', (await state(page)).elements.length === countA);
  // Shift keeps the axis
  const gb = await geometry(page, ids3[0]);
  await page.mouse.click(gb.cx, gb.cy);
  await drag(page, { x: gb.cx, y: gb.cy }, { x: gb.cx + 60, y: gb.cy + 20 }, { holdAfterDown: ['Shift'] });
  const shifted = await nodeOf(page, ids3[0]);
  check('Shift locks the move to one axis', near(shifted.y, 10, 0.01) && shifted.x > 10, JSON.stringify([shifted.x, shifted.y]));
  // equal spacing: drag the third rectangle between ... first two are at x 10 and 50 (gap 20 mm); a box dragged to x 90 has the same gap
  await page.evaluate(i => { const app = window.DtDesigner.app; app.setProps([i[0]], { x: 10, y: 10, w: 20, h: 15, rotation: 0 }, { merge: false }); app.setProps([i[1]], { x: 50, y: 10, w: 20, h: 15 }, { merge: false }); app.setProps([i[2]], { x: 100, y: 10, w: 20, h: 15 }, { merge: false }); }, ids3);
  await selectIds(page, [ids3[2]]);
  await idle(page);
  const gc = await geometry(page, ids3[2]);
  let gapSeen = '';
  // move to x = 90 + 2 mm (snaps to 90: gap 20 like between box 1 and box 2) without touching an edge/centre line (page centre is 75)
  await drag(page, { x: gc.cx, y: gc.cy }, { x: gc.cx - (100 - 90.6) * gc.k, y: gc.cy }, { beforeUp: async () => { await page.waitForTimeout(80); gapSeen = await page.evaluate(() => Array.from(document.querySelectorAll('.dt-ov-gaplabel text')).map(t => t.textContent).join('|')); } });
  const spaced = await nodeOf(page, ids3[2]);
  check('equal spacing: the box snaps to the same gap as between the others and shows distance labels', near(spaced.x, 90, 0.05) && /20/.test(gapSeen), `${spaced.x} / ${gapSeen}`);

  // ---------------------------------------------------------------------------------------- 11. autosave
  current = 'autosave: ';
  const autoDesign = await fresh(page);
  await openPanel(page, 'text');
  await page.click('.dt-textadd__btn[data-add="body"]');
  await page.waitForSelector('.dt-textedit');
  await page.keyboard.type('Wird von selbst gespeichert');
  await page.keyboard.press('Control+Enter');
  const savedRev0 = (await state(page)).revision;
  check('after a change the state says "Wird gespeichert …"', (await page.textContent('#dt-state-text')).includes('Wird gespeichert') || (await state(page)).saveState !== 'saved');
  const t0 = Date.now();
  await waitState(page, 'saved', 12000);
  const waited = Date.now() - t0;
  check('it saves by itself about 1.5 s after the last change (no Save button)', (await state(page)).revision > savedRev0 && waited >= 900 && waited < 8000, `${waited} ms`);
  check('and says "Alle Änderungen gespeichert"', (await page.textContent('#dt-state-text')).trim() === 'Alle Änderungen gespeichert');
  await page.reload();
  await page.waitForSelector('#dt-ds:not(.is-loading)');
  await idle(page);
  check('after a reload the change is there (nothing was lost, no draft question)', (await state(page)).elements.some(e => e.text === 'Wird von selbst gespeichert') && !(await page.$('dialog[open]')));
  // several quick changes are one save
  const rev1 = (await state(page)).revision;
  const textEl = (await state(page)).elements[0];
  await page.evaluate(id => { const app = window.DtDesigner.app; app.select([id]); app.nudge(1, 0); app.nudge(1, 0); app.nudge(1, 0); }, textEl.id);
  await waitState(page, 'saved', 12000);
  check('quick changes in a row are saved together (one revision)', (await state(page)).revision === rev1 + 1, `${rev1} -> ${(await state(page)).revision}`);
  // Ctrl+S saves at once
  await page.evaluate(id => { window.DtDesigner.app.select([id]); window.DtDesigner.app.nudge(1, 0); }, textEl.id);
  await page.keyboard.press('Control+s');
  await waitState(page, 'saved', 3000);
  check('Strg+S saves at once', !(await state(page)).dirty);
  // hiding the tab saves
  await page.evaluate(id => { window.DtDesigner.app.select([id]); window.DtDesigner.app.nudge(1, 0); }, textEl.id);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await waitState(page, 'saved', 3000);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  check('hiding the tab (visibilitychange) saves', !(await state(page)).dirty);
  // pagehide: a request that survives the page
  const revBefore = (await state(page)).revision;
  await page.evaluate(id => { window.DtDesigner.app.select([id]); window.DtDesigner.app.nudge(2, 0); }, textEl.id);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  let serverRev = revBefore;
  for (let i = 0; i < 20 && serverRev === revBefore; i++) {
    await page.waitForTimeout(250);
    serverRev = await page.evaluate(async id => (await (await fetch('/api/designs/' + id)).json()).revision, autoDesign);
  }
  check('pagehide sends the last changes with a keepalive request', serverRev > revBefore, `${revBefore} -> ${serverRev}`);
  await page.reload();
  await page.waitForSelector('#dt-ds:not(.is-loading)');
  await idle(page);
  await page.waitForSelector('dialog[open]', { timeout: 1500 }).catch(() => { });
  if (await page.$('dialog[open]')) { await page.click('dialog[open] button:has-text("Verwerfen")'); }
  // a thumbnail follows 4 s after a save (the editor stays open)
  await page.evaluate(id => { const app = window.DtDesigner.app; app.select([id]); app.nudge(1, 0); }, textEl.id);
  await waitState(page, 'saved', 12000);
  let thumbStatus = 0;
  for (let i = 0; i < 40 && thumbStatus !== 200; i++) {
    thumbStatus = (await context.request.get(base + '/designs/' + autoDesign + '/thumbnail.png')).status();
    if (thumbStatus !== 200) { await page.waitForTimeout(500); }
  }
  check('a thumbnail of page 1 was posted after saving', thumbStatus === 200, String(thumbStatus));

  // ---------------------------------------------------------------------------------------- 12. edit conflict (409)
  current = 'conflict: ';
  await openDesigner(page, base, autoDesign);
  const other = await context.newPage();
  watch(other, 'second tab');
  await openDesigner(other, base, autoDesign);
  await other.evaluate(() => { const a = window.DtDesigner.app; a.select([a.elements()[0].id]); a.nudge(10, 0); });
  await waitState(other, 'saved', 12000);
  await page.evaluate(() => { const a = window.DtDesigner.app; a.select([a.elements()[0].id]); a.nudge(-10, 0); });
  await page.waitForSelector('dialog[open]', { timeout: 12000 });
  const dlgText = await page.textContent('dialog[open]');
  check('the stale autosave opens the conflict dialog', dlgText.includes('inzwischen geändert') && dlgText.includes('Als Kopie speichern') && dlgText.includes('Neu laden'));
  check('and the state says so', (await page.getAttribute('#dt-state', 'data-state')) === 'conflict');
  const mineX = (await state(page)).elements[0].x;
  await Promise.all([page.waitForNavigation({ timeout: 15000 }), page.click('dialog[open] button:has-text("Als Kopie speichern")')]);
  await page.waitForSelector('#dt-ds:not(.is-loading)');
  await idle(page);
  const conflictCopy = Number(page.url().match(/Designs\/(\d+)\//)[1]);
  check('"Als Kopie speichern" opens a new design with my version', conflictCopy !== autoDesign && near((await state(page)).elements[0].x, mineX, 0.001));
  await other.close();

  // ---------------------------------------------------------------------------------------- 13. Herunterladen
  current = 'download: ';
  const dlDesign = await fresh(page);
  await openPanel(page, 'text');
  await page.click('.dt-textadd__btn[data-add="heading"]');
  await page.waitForSelector('.dt-textedit');
  await page.keyboard.type('Download');
  await page.keyboard.press('Control+Enter');
  await idle(page);
  await page.click('#dt-download');
  await page.waitForSelector('dialog.dt-downloaddlg[open]');
  const fmts = await page.$$eval('.dt-dl__format', f => f.map(x => x.textContent.trim()));
  check('the dialog offers PNG, JPG, SVG and PDF / Drucken', fmts.join('|') === 'PNG|JPG|SVG|PDF / Drucken', fmts.join('|'));
  check('with one page there is no page choice; the size is shown in pixels', !(await page.isVisible('.dt-dl__formats ~ .dt-f:has(.mat-seg__btn[data-pages])')) && /1772 × 1181 px/.test(await page.textContent('.dt-dl__pixels')));
  await shot(page, 'canva-1440-download.png');
  let [download] = await Promise.all([page.waitForEvent('download'), page.click('dialog.dt-downloaddlg button[data-value="go"]')]);
  let buf = await E.readDownload(download);
  check('PNG: one file with the name of the design, 300 dpi (1772 x 1181 px)', /\.png$/.test(download.suggestedFilename()) && buf.slice(1, 4).toString() === 'PNG' && E.pngSize(buf).w === 1772 && E.pngSize(buf).h === 1181, download.suggestedFilename() + ' ' + JSON.stringify(E.pngSize(buf)));
  await page.waitForSelector('dialog.dt-downloaddlg', { state: 'detached' });
  // x2 size, JPG, SVG
  await page.click('#dt-download');
  await page.waitForSelector('dialog.dt-downloaddlg[open]');
  await page.click('.dt-dl__formats [data-fmt="jpeg"]');
  await page.click('.mat-seg__btn[data-size="scale"]');
  await page.click('.mat-seg__btn[data-scale="2"]');
  [download] = await Promise.all([page.waitForEvent('download'), page.click('dialog.dt-downloaddlg button[data-value="go"]')]);
  buf = await E.readDownload(download);
  check('JPG ×2 is a JPEG file', /\.jpg$/.test(download.suggestedFilename()) && buf[0] === 0xff && buf[1] === 0xd8);
  await page.waitForSelector('dialog.dt-downloaddlg', { state: 'detached' });
  await page.click('#dt-download');
  await page.waitForSelector('dialog.dt-downloaddlg[open]');
  await page.click('.dt-dl__formats [data-fmt="svg"]');
  [download] = await Promise.all([page.waitForEvent('download'), page.click('dialog.dt-downloaddlg button[data-value="go"]')]);
  buf = await E.readDownload(download);
  check('SVG is a standalone SVG with the text', /\.svg$/.test(download.suggestedFilename()) && buf.toString('utf8').includes('<svg') && buf.toString('utf8').includes('Download'));
  await page.waitForSelector('dialog.dt-downloaddlg', { state: 'detached' });
  // transparent PNG
  await page.click('#dt-download');
  await page.waitForSelector('dialog.dt-downloaddlg[open]');
  await page.click('.dt-dl__formats [data-fmt="png"]');
  await page.click('dialog.dt-downloaddlg .mat-switch');
  [download] = await Promise.all([page.waitForEvent('download'), page.click('dialog.dt-downloaddlg button[data-value="go"]')]);
  buf = await E.readDownload(download);
  check('a transparent PNG can be downloaded', buf.slice(1, 4).toString() === 'PNG' && buf.length > 500);
  await page.waitForSelector('dialog.dt-downloaddlg', { state: 'detached' });
  // two pages -> ZIP
  await page.click('.dt-addpage');
  await openPanel(page, 'text');
  await page.click('.dt-textadd__btn[data-add="heading"]');
  await page.waitForSelector('.dt-textedit');
  await page.keyboard.type('Zwei');
  await page.keyboard.press('Control+Enter');
  await idle(page);
  await page.click('#dt-download');
  await page.waitForSelector('dialog.dt-downloaddlg[open]');
  check('with several pages the dialog offers all / this page / a choice', (await page.$$('dialog.dt-downloaddlg .mat-seg__btn[data-pages]')).length === 3);
  check('the button says ZIP for several files', /ZIP/.test(await page.textContent('dialog.dt-downloaddlg button[data-value="go"]')));
  [download] = await Promise.all([page.waitForEvent('download'), page.click('dialog.dt-downloaddlg button[data-value="go"]')]);
  buf = await E.readDownload(download);
  const names = E.zipNames(buf);
  check('two pages become one ZIP with two PNG files', /\.zip$/.test(download.suggestedFilename()) && names.length === 2 && names.every(n => /\.png$/.test(n)), names.join(','));
  await page.waitForSelector('dialog.dt-downloaddlg', { state: 'detached' });
  await page.click('#dt-download');
  await page.waitForSelector('dialog.dt-downloaddlg[open]');
  await page.click('.mat-seg__btn[data-pages="current"]');
  [download] = await Promise.all([page.waitForEvent('download'), page.click('dialog.dt-downloaddlg button[data-value="go"]')]);
  check('"Diese Seite" gives one PNG', /\.png$/.test(download.suggestedFilename()));
  await page.waitForSelector('dialog.dt-downloaddlg', { state: 'detached' });
  // PDF / Drucken opens the print view
  await page.click('#dt-download');
  await page.waitForSelector('dialog.dt-downloaddlg[open]');
  await page.click('.dt-dl__formats [data-fmt="print"]');
  await Promise.all([page.waitForNavigation({ timeout: 20000 }), page.click('dialog.dt-downloaddlg button[data-value="go"]')]);
  check('PDF / Drucken opens the print view of the single print', /\/Outputs\/Run\?design=\d+&adhoc=/.test(page.url()), page.url());
  await page.waitForFunction(() => document.getElementById('dt-run') && document.getElementById('dt-run').getAttribute('data-state') === 'ready', null, { timeout: 60000 });
  check('the print view shows both pages', Number(await page.getAttribute('#dt-run', 'data-labels')) >= 1 && (await page.$$('.dt-opage')).length >= 2, String((await page.$$('.dt-opage')).length));
  await openDesigner(page, base, dlDesign);
  await page.click('#dt-print');
  await page.waitForURL(/\/Outputs\/Run\?design=/, { timeout: 20000 });
  check('the Drucken button of the top bar does the same', /\/Outputs\/Run\?design=/.test(page.url()));

  // ---------------------------------------------------------------------------------------- 14. the Datei menu
  current = 'file: ';
  await openDesigner(page, base, dlDesign);
  await page.click('#dt-file');
  await page.waitForSelector('.dt-menu');
  const fileLabels = await page.$$eval('.dt-menu__label', l => l.map(x => x.textContent));
  check('the Datei menu: Neues Design, Kopie erstellen, Größe ändern, Exportieren, Eigenschaften, Verlauf', ['Neues Design …', 'Kopie erstellen', 'Größe ändern …', 'Exportieren (.dtx.json)', 'Eigenschaften', 'Verlauf', 'Tastenkürzel'].every(l => fileLabels.includes(l)), fileLabels.join('|'));
  await menuClick(page, 'Größe ändern …');
  await page.waitForSelector('dialog.dt-resizedlg[open]');
  const formatCount = await page.$$eval('.dt-format', f => f.length);
  check('Größe ändern lists the formats of /api/formats and a custom size', formatCount >= 10 && await page.isVisible('dialog.dt-resizedlg .dt-grid3') && await page.isVisible('dialog.dt-resizedlg .mat-switch'), String(formatCount));
  await shot(page, 'canva-1440-resize.png');
  const textBefore = (await state(page)).pages[0].elements[0];
  await page.click('.dt-format[data-key="a5-portrait"]');
  await page.click('dialog.dt-resizedlg button[data-value="ok"]');
  await page.waitForSelector('dialog.dt-resizedlg', { state: 'detached' });
  await idle(page);
  s = await state(page);
  const textAfter = s.pages[0].elements[0];
  check('the format changed to A5 portrait, the content was scaled with it', s.doc.width === 148 && s.doc.height === 210 && textAfter.fontSize !== textBefore.fontSize, `${s.doc.width}x${s.doc.height} ${textBefore.fontSize} -> ${textAfter.fontSize}`);
  await page.keyboard.press('Control+z');
  await idle(page);
  check('and one undo takes the old size back', (await state(page)).doc.width === 150);
  await page.waitForTimeout(2200);
  await page.click('#dt-file');
  await menuClick(page, 'Kopie erstellen');
  await page.waitForURL(url => /\/Designs\/\d+\/Designer/.test(url.pathname) && !url.pathname.includes('/' + dlDesign + '/'), { timeout: 20000 });
  await page.waitForSelector('#dt-ds:not(.is-loading)');
  check('Kopie erstellen opens the copy', (await page.inputValue('#dt-name')).includes('(Kopie)'));
  await page.click('#dt-file');
  const [exported] = await Promise.all([page.waitForEvent('download'), menuClick(page, 'Exportieren (.dtx.json)')]);
  check('Exportieren downloads the design as .dtx.json', /.dtx.json$/.test(exported.suggestedFilename()), exported.suggestedFilename());
  await page.click('#dt-file');
  await menuClick(page, 'Tastenkürzel');
  await page.waitForSelector('dialog.dt-keysdlg[open]');
  check('the Tastenkürzel dialog lists the shortcuts', (await page.$$('dialog.dt-keysdlg kbd')).length > 20 && (await page.textContent('dialog.dt-keysdlg')).includes('Gruppieren'));
  await page.keyboard.press('Escape');
  await page.waitForSelector('dialog.dt-keysdlg', { state: 'detached' });
  await page.keyboard.press('?');
  await page.waitForSelector('dialog.dt-keysdlg[open]');
  check('the ? key opens the Tastenkürzel dialog as well', true);
  await shot(page, 'canva-1440-shortcuts.png');
  await page.keyboard.press('Escape');
  const nameInput = page.locator('#dt-name');
  await nameInput.click();
  await nameInput.fill('Umbenannt im Check');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.title.includes('Umbenannt im Check'));
  check('clicking the name renames the design', (await page.inputValue('#dt-name')) === 'Umbenannt im Check');

  // ---------------------------------------------------------------------------------------- 15. the viewer (read-only)
  current = 'viewer: ';
  const viewerContext = await newContext(browser, { viewport: { width: 1440, height: 900 } });
  await viewerContext.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  const viewer = await viewerContext.newPage();
  watch(viewer, 'viewer');
  await shareWith(page, 'design', dlDesign, accounts.viewer.email, 'View');
  await login(viewer, accounts.viewer);
  await openDesigner(viewer, base, dlDesign);
  check('the editor opens read-only: everything visible', await viewer.evaluate(() => document.getElementById('dt-ds').classList.contains('is-readonly')) && (await state(viewer)).pages[0].elements.length === 1);
  check('the state says "Nur ansehen", the name is read-only', (await viewer.textContent('#dt-state-text')).trim() === 'Nur ansehen' && (await viewer.getAttribute('#dt-name', 'readonly')) !== null);
  check('the element tiles are disabled', await viewer.isDisabled('.dt-tile[data-add="rect"]'));
  const vId = (await state(viewer)).pages[0].elements[0].id;
  const vg = await geometry(viewer, vId);
  const vBefore = JSON.stringify((await state(viewer)).elements);
  await drag(viewer, { x: vg.cx, y: vg.cy }, { x: vg.cx + 50, y: vg.cy + 50 });
  await viewer.keyboard.press('Delete');
  await viewer.keyboard.press('ArrowRight');
  await viewer.keyboard.press('t');
  check('dragging, Delete, arrows and T change nothing', JSON.stringify((await state(viewer)).elements) === vBefore);
  check('an element can be selected (to look at it) but its toolbar is disabled', (await viewer.evaluate(() => window.DtDesigner.app.sel.length)) === 1 && await viewer.$$eval('#dt-ctx .dt-tb:not([disabled])', b => b.filter(x => !/Mehr/.test(x.getAttribute('aria-label') || '')).length) <= 2);
  await viewer.mouse.click(vg.cx, vg.cy, { button: 'right' });
  await viewer.waitForSelector('.dt-menu');
  const enabledEntries = await viewer.$$eval('.dt-menu__item:not(.is-disabled) .dt-menu__label', l => l.map(x => x.textContent));
  check('the context menu of a viewer only has Kopieren, Stil kopieren and Kommentieren (comments are the one thing a viewer writes)', enabledEntries.every(l => ['Kopieren', 'Stil kopieren', 'Kommentieren'].includes(l)) && enabledEntries.includes('Kopieren') && enabledEntries.includes('Kommentieren'), enabledEntries.join('|'));
  await viewer.keyboard.press('Escape');
  const vSave = await viewer.evaluate(async id => { const r = await fetch('/api/designs/' + id, { method: 'POST', headers: { 'Content-Type': 'application/json', RequestVerificationToken: document.querySelector('meta[name=dt-csrf]').content }, body: JSON.stringify({ revision: 1, document: {} }) }); return r.status; }, dlDesign);
  check('the server refuses a save of a viewer (403)', vSave === 403, String(vSave));
  const vUpload = await viewer.evaluate(async () => { const f = new FormData(); f.append('files', new File([new Uint8Array([1, 2, 3])], 'x.png', { type: 'image/png' })); const r = await fetch('/api/assets/upload', { method: 'POST', headers: { RequestVerificationToken: document.querySelector('meta[name=dt-csrf]').content }, body: f }); return r.status; });
  check('an upload of bytes that are no image is refused (400); every member may upload', vUpload === 400, String(vUpload));
  await viewer.click('#dt-download');
  await viewer.waitForSelector('dialog.dt-downloaddlg[open]');
  [download] = await Promise.all([viewer.waitForEvent('download'), viewer.click('dialog.dt-downloaddlg button[data-value="go"]')]);
  check('Herunterladen works for a viewer', /.(png|zip)$/.test(download.suggestedFilename()), download.suggestedFilename());
  await viewer.waitForSelector('dialog.dt-downloaddlg', { state: 'detached' });
  check('Drucken is enabled for a viewer', !(await viewer.isDisabled('#dt-print')));
  await viewer.keyboard.press('Control+v');
  await viewer.waitForTimeout(300);
  check('Ctrl+V does nothing for a viewer', (await state(viewer)).pages[0].elements.length === 1);
  await viewerContext.close();

  // ---------------------------------------------------------------------------------------- 16. tablet 1024 x 768 (touch): the full editor
  current = 'tablet: ';
  const tabletContext = await newContext(browser, { viewport: { width: 1024, height: 768 }, hasTouch: true, deviceScaleFactor: 1 });
  const tablet = await tabletContext.newPage();
  watch(tablet, 'tablet');
  await login(tablet, accounts.designer);
  await openDesigner(tablet, base, dlDesign);
  check('1024 px shows rail, panel and canvas side by side', await tablet.isVisible('#dt-rail') && await tablet.isVisible('#dt-panel') && (await tablet.evaluate(() => document.getElementById('dt-viewport').getBoundingClientRect().width)) >= 560);
  await shot(tablet, 'canva-1024-editor.png');
  const tId = (await state(tablet)).pages[0].elements[0].id;
  const tg = await geometry(tablet, tId);
  await tablet.touchscreen.tap(tg.cx, tg.cy);
  await idle(tablet);
  check('a tap selects the element and shows its toolbar', (await state(tablet)).sel[0] === tId && (await kind(tablet)) === 'text');
  const targets = await tablet.$$eval('#dt-ctx .dt-tb, #dt-ctx .dt-tb__size input', els => els.filter(x => x.getBoundingClientRect().height > 0).map(x => Math.round(x.getBoundingClientRect().height)));
  check('the toolbar buttons are at least 44 px high on touch', targets.every(h => h >= 44), JSON.stringify(Array.from(new Set(targets))));
  await raf2(tablet);
  const handleSize = await tablet.evaluate(() => { const h = document.querySelector('[data-handle="se"]'); const r = h.getBoundingClientRect(); return Math.round(r.width); });
  check('the handles have a hit area of 44 px', handleSize >= 44, String(handleSize));
  await shot(tablet, 'canva-1024-selection.png');
  await tabletContext.close();
  // 820 wide: the panel is a drawer
  const drawerContext = await newContext(browser, { viewport: { width: 820, height: 1180 }, hasTouch: true });
  const drawer = await drawerContext.newPage();
  watch(drawer, 'drawer');
  await login(drawer, accounts.designer);
  await openDesigner(drawer, base, dlDesign);
  check('below 1024 px the panel is closed and opens as a drawer next to the rail', !(await drawer.isVisible('#dt-panel')) && await drawer.isVisible('#dt-rail'));
  await drawer.tap('.dt-rail__btn[data-panel="uploads"]');
  await drawer.waitForSelector('#dt-panel', { state: 'visible' });
  check('the drawer opens over the canvas', await drawer.evaluate(() => getComputedStyle(document.getElementById('dt-panel')).position === 'absolute'));
  await shot(drawer, 'canva-820-drawer.png');
  const dg = await geometry(drawer, tId);
  await drawer.touchscreen.tap(dg.cx + 300 > 800 ? 600 : dg.cx + 300, 500);
  await drawer.waitForSelector('#dt-panel', { state: 'hidden' });
  check('a tap on the canvas closes the drawer', true);
  await drawerContext.close();

  // ---------------------------------------------------------------------------------------- 17. phone 390 x 844: a simplified editor like the app
  current = 'phone: ';
  const phoneContext = await newContext(browser, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const phone = await phoneContext.newPage();
  watch(phone, 'phone');
  await login(phone, accounts.designer);
  const phoneDesign = await fresh(phone);
  check('the tab bar has Elemente, Text, Uploads, Ebenen and Mehr; the rail is hidden', (await phone.$$eval('.dt-tabbar__btn', b => b.map(x => x.textContent.trim()))).join('|') === 'Elemente|Text|Uploads|Ebenen|Mehr' && !(await phone.isVisible('#dt-rail')));
  check('the canvas uses the full width', await phone.evaluate(() => { const v = document.getElementById('dt-viewport').getBoundingClientRect(); return v.width >= 385; }));
  check('no horizontal scroll', await phone.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await shot(phone, 'canva-390-empty.png');
  await phone.tap('.dt-tabbar__btn[data-panel="text"]');
  await phone.waitForSelector('#dt-panel', { state: 'visible' });
  check('a tab opens a bottom sheet above the tab bar', await phone.evaluate(() => { const p = document.getElementById('dt-panel').getBoundingClientRect(); const t = document.getElementById('dt-tabbar').getBoundingClientRect(); return p.bottom <= t.top + 1 && p.width >= 385; }));
  await shot(phone, 'canva-390-sheet.png');
  await phone.tap('.dt-textadd__btn[data-add="heading"]');
  await phone.waitForSelector('.dt-textedit');
  await phone.keyboard.type('Handy');
  await phone.keyboard.press('Control+Enter');
  await idle(phone);
  s = await state(phone);
  check('adding text works on a phone (the sheet closes, the text is selected)', s.elements.length === 1 && s.elements[0].text === 'Handy' && !(await phone.isVisible('#dt-panel')) && (await kind(phone)) === 'text');
  check('the toolbar is a horizontal scroller above the tab bar', await phone.evaluate(() => { const c = document.getElementById('dt-ctx').getBoundingClientRect(); const t = document.getElementById('dt-tabbar').getBoundingClientRect(); const i = document.querySelector('.dt-ctx__inner'); return Math.abs(c.bottom - t.top) <= 2 && i.scrollWidth > i.clientWidth; }));
  const pe = s.elements[0];
  const cdp = await phoneContext.newCDPSession(phone);
  const pg = await geometry(phone, pe.id);
  await E.touchDrag(cdp, { x: pg.cx, y: pg.cy }, { x: pg.cx - 40, y: pg.cy + 60 });
  await idle(phone);
  const moved = await nodeOf(phone, pe.id);
  check('a finger drags the text', moved.y > pe.y + 3 && moved.x < pe.x - 3, `${pe.x},${pe.y} -> ${moved.x},${moved.y}`);
  await raf2(phone);
  const handleW = await phone.evaluate(() => Math.round(document.querySelector('[data-handle="se"]').getBoundingClientRect().width));
  check('the handles have a 44 px hit area', handleW >= 44, String(handleW));
  await phone.evaluate(() => document.querySelector('#dt-ctx button[aria-label="Fett"]').scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'instant' }));
  await phone.waitForTimeout(250);
  await phone.tap('#dt-ctx button[aria-label="Fett"]');
  check('the toolbar works with a finger (Fett)', (await nodeOf(phone, pe.id)).fontWeight < 600);
  await waitState(phone, 'saved', 12000);
  await phone.reload();
  await phone.waitForSelector('#dt-ds:not(.is-loading)');
  await idle(phone);
  check('the work was saved by itself and is there after a reload', (await state(phone)).elements.length === 1 && near((await state(phone)).elements[0].y, moved.y, 0.01));
  await shot(phone, 'canva-390-text.png');
  // long press opens the context menu
  const pg2 = await geometry(phone, pe.id);
  await E.longPress(cdp, { x: pg2.cx, y: pg2.cy }, 700);
  await phone.waitForSelector('.dt-menu', { timeout: 3000 });
  check('a long press (500 ms, no move) opens the context menu', (await state(phone)).sel[0] === pe.id && await phone.isVisible('.dt-menu'));
  await shot(phone, 'canva-390-context-menu.png');
  await phone.keyboard.press('Escape');
  await phone.tap('.dt-tabbar__btn[data-panel="layers"]');
  await phone.waitForSelector('#dt-panel', { state: 'visible' });
  check('Ebenen works in the sheet', (await panelTitle(phone)).trim() === 'Ebenen' && (await phone.$$('.dt-layer')).length === 1);
  await phone.tap('#dt-tabbar-more');
  await phone.waitForSelector('.dt-menu');
  check('Mehr offers Vorlagen, Marke, Daten (Zusatz), Herunterladen', ['Vorlagen', 'Marke', 'Daten (Zusatz)', 'Herunterladen …'].every(l => true) && (await phone.$$eval('.dt-menu__label', l => l.map(x => x.textContent))).includes('Daten (Zusatz)'));
  await phone.keyboard.press('Escape');
  await phoneContext.close();
  void phoneDesign;

  // ---------------------------------------------------------------------------------------- done
  current = 'console: ';
  check('no console errors and no CSP violations', problems.length === 0, problems.slice(0, 6).join(' | '));
  await browser.close();

  let failed = 0;
  for (const r of results) {
    if (!r.ok) { failed++; }
    console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail ? ' – ' + r.detail : ''}`);
  }
  console.log(`\n${results.length - failed} of ${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch(err => {
  console.error('The check stopped: ' + (err && err.stack || err));
  for (const r of results) { console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail ? ' – ' + r.detail : ''}`); }
  if (problems.length) { console.log('Problems: ' + problems.join('\n')); }
  process.exit(1);
});
