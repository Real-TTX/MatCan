// Checks the designer in a real browser (installed Edge, headless): creates a design, draws with the pointer and the keyboard, saves, reloads, previews with a data
// list, provokes an edit conflict, works offline, opens the design as a viewer (read-only), builds the demo label of docs/PLAN.md section 1.2 and takes screenshots
// at 1280x800, 1024x768 (touch) and 390x844 into docs/images/ (designer-*.png). Zero console errors and zero CSP violations are part of the result.
//
//   cd tests/e2e && npm install
//   node designer-check.js [base url, default http://localhost:3043] [--out ../../docs/images]
//
// Accounts: tests/e2e/test-account.json ({ "designer": {email,password}, "viewer": {...}, "admin": {...} }) is used when it exists. On an empty database the setup
// assistant creates the administrator (admin@example.com), who creates a designer and a viewer through the admin pages; the file is written. An existing
// administrator with two-factor sign-in cannot be used: start with `./scripts/redeploy.ps1 -Clean` or put a designer account into test-account.json.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { demoDocument, demoRows } = require('./demo-label.js');

const args = process.argv.slice(2);
const base = (args.find(a => /^https?:/.test(a)) || 'http://localhost:3043').replace(/\/$/, '');
const outIndex = args.indexOf('--out');
const outDir = path.resolve(__dirname, outIndex >= 0 ? args[outIndex + 1] : '../../docs/images');
const accountFile = path.join(__dirname, 'test-account.json');
const PASSWORD = 'Passw0rd!Passw0rd';

const results = [];
const problems = [];
const dialogs = [];
let current = '';
const check = (name, ok, detail) => { results.push({ name: current + name, ok: !!ok, detail }); };
const near = (a, b, tolerance) => Math.abs(a - b) <= tolerance;

// ------------------------------------------------------------------------------------------------ helpers

function watch(page, label) {
  page.on('console', m => {
    // the check provokes a 409 (edit conflict) and a 403 (viewer) on purpose: the browser logs those failed requests as errors
    if (m.type() === 'error' && !/status of (403|409)/.test(m.text())) { problems.push(`[${label}] console error: ${m.text()}`); }
  });
  page.on('pageerror', e => problems.push(`[${label}] page error: ${e.message}`));
  page.on('dialog', d => { dialogs.push(d.type()); d.accept().catch(() => {}); });
}

async function newContext(browser, options) {
  const context = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 800 }, locale: 'de-DE' }, options || {}));
  await context.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', e => { console.error('CSP violation: ' + e.violatedDirective + ' ' + e.blockedURI); });
  });
  return context;
}

async function login(page, account) {
  await page.goto(base + '/Account/Login');
  await page.fill('#Input_Email', account.email);
  await page.fill('#Input_Password', account.password);
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit]')]);
  return !/\/Account\//.test(new URL(page.url()).pathname);
}

async function ensureAccounts(browser) {
  let accounts = fs.existsSync(accountFile) ? JSON.parse(fs.readFileSync(accountFile, 'utf8')) : {};
  const context = await newContext(browser);
  const page = await context.newPage();
  watch(page, 'accounts');
  if (accounts.designer && await login(page, accounts.designer) && accounts.viewer) { await context.close(); return accounts; }

  await page.goto(base + '/Account/Setup');
  if (/Setup/.test(page.url())) {
    accounts.admin = { email: 'admin@example.com', password: PASSWORD };
    await page.fill('#Input_DisplayName', 'Test Admin');
    await page.fill('#Input_Email', accounts.admin.email);
    await page.fill('#Input_Password', accounts.admin.password);
    await page.fill('#Input_PasswordRepeat', accounts.admin.password);
    await Promise.all([page.waitForNavigation(), page.click('button[type=submit]')]);
  } else if (!accounts.admin || !(await login(page, accounts.admin))) {
    throw new Error('Kein Konto: lege tests/e2e/test-account.json an oder starte mit ./scripts/redeploy.ps1 -Clean (leere Datenbank).');
  }
  const make = async (name, email, role) => {
    await page.goto(base + '/Admin/Users/Edit');
    await page.fill('#Input_DisplayName', name);
    await page.fill('#Input_Email', email);
    await page.selectOption('#Input_Role', { label: role });
    await page.fill('#Input_Password', PASSWORD);
    await Promise.all([page.waitForNavigation(), page.click('button[type=submit].mat-btn--primary')]);
    return { email, password: PASSWORD };
  };
  accounts.designer = accounts.designer || await make('E2E Gestalter', 'designer@example.com', 'Gestalter');
  accounts.viewer = accounts.viewer || await make('E2E Betrachter', 'viewer@example.com', 'Betrachter');
  fs.writeFileSync(accountFile, JSON.stringify(accounts, null, 2));
  await context.close();
  return accounts;
}

const idle = page => page.evaluate(() => window.DtDesigner.canvas.whenIdle());
const state = page => page.evaluate(() => {
  const app = window.DtDesigner.app;
  return { elements: JSON.parse(JSON.stringify(app.doc.elements)), fields: JSON.parse(JSON.stringify(app.doc.fields)), doc: JSON.parse(JSON.stringify(app.doc)), sel: app.sel.slice(), dirty: app.dirty, saveState: app.saveState, revision: app.baseRevision, zoom: app.zoom };
});
const elementOf = async (page, id) => (await state(page)).elements.find(e => e.id === id);

async function openDesigner(page, id) {
  await page.goto(`${base}/Designs/${id}/Designer`);
  await page.waitForSelector('#dt-ds:not(.is-loading)', { timeout: 20000 });
  await idle(page);
}

/** Screen geometry of the page and of one element: client coordinates of its centre and of its handles. */
async function geometry(page, id) {
  return page.evaluate(elementId => {
    const app = window.DtDesigner.app;
    const r = document.getElementById('dt-sheet').getBoundingClientRect();
    const k = app.scale();
    const e = app.element(elementId);
    return { k, left: r.left, top: r.top, cx: r.left + (e.x + e.w / 2) * k, cy: r.top + (e.y + e.h / 2) * k, x: e.x, y: e.y, w: e.w, h: e.h };
  }, id);
}

async function handleCentre(page, name) {
  return page.evaluate(n => {
    const c = document.querySelector(`[data-handle="${n}"]`);
    if (!c) { return null; }
    const r = c.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, name);
}

async function drag(page, from, to, options) {
  const o = options || {};
  if (o.hold) { for (const key of o.hold) { await page.keyboard.down(key); } }
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 6 });
  if (o.beforeUp) { await o.beforeUp(); }
  await page.mouse.up();
  if (o.hold) { for (const key of o.hold.slice().reverse()) { await page.keyboard.up(key); } }
  await idle(page);
}

const selectIds = async (page, ids) => { await page.evaluate(i => window.DtDesigner.app.select(i), ids); await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); };
const waitState = (page, wanted, timeout) => page.waitForFunction(w => window.DtDesigner.app.saveState === w, wanted, { timeout: timeout || 10000 });
const svgText = page => page.evaluate(() => Array.from(document.querySelectorAll('#dt-page svg text')).map(t => t.textContent).join('|'));

async function touchDrag(page, client, from, to) {
  const point = p => ({ x: p.x, y: p.y, id: 1 });
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(from)] });
  for (let i = 1; i <= 8; i++) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point({ x: from.x + (to.x - from.x) * i / 8, y: from.y + (to.y - from.y) * i / 8 })] });
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function shot(page, name) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, name);
  await page.screenshot({ path: file });
  console.log('screenshot ' + file);
  return file;
}

// ------------------------------------------------------------------------------------------------ the check

(async () => {
  let browser;
  try { browser = await chromium.launch({ channel: 'msedge' }); } catch (e) { browser = await chromium.launch(); }
  const accounts = await ensureAccounts(browser);
  const context = await newContext(browser);
  const page = await context.newPage();
  watch(page, 'designer');
  if (!await login(page, accounts.designer)) { throw new Error('Anmeldung des Gestalters fehlgeschlagen.'); }

  // ---------------------------------------------------------------------------------------- 1. a new design from the preset 150 x 100 mm
  current = 'create: ';
  await page.goto(base + '/Designs/Create');
  const name = 'Designer-Check ' + new Date().toISOString().slice(11, 19);
  await page.fill('#Input_Name', name);
  check('preset 150 x 100 is the default', (await page.inputValue('#Input_PresetKey')) === 'label-150x100');
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit].mat-btn--primary')]);
  check('lands in the designer', /\/Designs\/\d+\/Designer$/.test(page.url()), page.url());
  const designId = Number(page.url().match(/Designs\/(\d+)\//)[1]);
  await page.waitForSelector('#dt-ds:not(.is-loading)', { timeout: 20000 });
  await idle(page);
  let s = await state(page);
  check('empty page of 150 x 100 mm', s.doc.width === 150 && s.doc.height === 100 && s.doc.unit === 'mm' && s.elements.length === 0);
  check('state says saved', s.saveState === 'saved' && (await page.textContent('#dt-state-text')).trim() === 'Gespeichert');
  check('the page is drawn at the fitted zoom', (await page.evaluate(() => document.getElementById('dt-sheet').getBoundingClientRect().width)) > 300);

  // ---------------------------------------------------------------------------------------- 2. text with a placeholder, field Name
  current = 'text: ';
  await page.click('[data-add="text"]');
  await page.waitForSelector('.dt-textedit');
  await page.keyboard.type('{{Name}}');
  await page.keyboard.press('Control+Enter');
  await idle(page);
  s = await state(page);
  const text = s.elements.find(e => e.type === 'text');
  check('a text element with {{Name}}', !!text && text.text === '{{Name}}', text && text.text);
  check('the placeholder without a field is reported', await page.isVisible('#dt-warnbar') && (await page.textContent('#dt-warnbar')).includes('Name'));
  await page.click('#dt-tab-fields');
  check('badge on the Felder tab', await page.isVisible('#dt-fields-badge'));
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
  // inserting a placeholder into the selected text
  await page.click(`.dt-field:has(.dt-field__key:text-is("Preis")) .dt-field__insert`);
  await idle(page);
  s = await state(page);
  check('"In Text einfügen" appends {{Preis}}', s.elements.find(e => e.type === 'text').text === '{{Name}} {{Preis}}', s.elements.find(e => e.type === 'text').text);
  check('price formatted as 2,99', (await svgText(page)).includes('2,99'), await svgText(page));

  // ---------------------------------------------------------------------------------------- 3. image from Medien, bound to a field
  current = 'image: ';
  await page.click('#dt-tab-media');
  await page.waitForSelector('.dt-asset[data-key="flag-de"]');
  await page.click('.dt-asset[data-key="flag-de"]');
  await idle(page);
  s = await state(page);
  const image = s.elements.find(e => e.type === 'image');
  check('click adds an image element with the asset', !!image && image.source && image.source.asset === 'flag-de');
  check('sized by aspect ratio, at most 40 % of the page', image && near(image.w / image.h, 1.5, 0.05) && image.w <= 60.01 && image.h <= 40.01, image && `${image.w} x ${image.h}`);
  check('the new image is selected', s.sel.length === 1 && s.sel[0] === image.id);
  const imageId = image.id;
  // bind to a new image field through the properties panel
  await page.selectOption('.dt-source__kind', 'field');
  await page.click('button:has-text("Neues Bildfeld")');
  await idle(page);
  s = await state(page);
  const bound = s.elements.find(e => e.id === imageId);
  check('the image is bound to a field', bound.source && bound.source.field === 'Bild1', JSON.stringify(bound.source));
  await page.click('#dt-tab-fields');
  await page.fill('[aria-label="Beispielwert für Bild1"]', 'flag-de');
  await idle(page);
  check('the bound image is drawn from the sample value', (await page.evaluate(() => document.querySelectorAll('#dt-page svg image').length)) === 1);

  // ---------------------------------------------------------------------------------------- 4. move, resize, rotate by pointer
  current = 'pointer: ';
  let g = await geometry(page, imageId);
  await drag(page, { x: g.cx, y: g.cy }, { x: g.cx + 60, y: g.cy + 40 }, { hold: ['Alt'] });
  let e = await elementOf(page, imageId);
  check('move by 60 / 40 px', near(e.x - g.x, 60 / g.k, 0.05) && near(e.y - g.y, 40 / g.k, 0.05), `${(e.x - g.x).toFixed(2)} / ${(e.y - g.y).toFixed(2)} mm, expected ${(60 / g.k).toFixed(2)} / ${(40 / g.k).toFixed(2)}`);
  check('moving is one undo step', (await page.evaluate(() => window.DtDesigner.app.undoStack.length)) >= 1);
  g = await geometry(page, imageId);
  const se = await handleCentre(page, 'se');
  await drag(page, se, { x: se.x + 40, y: se.y + 20 }, { hold: ['Alt', 'Shift'] });
  e = await elementOf(page, imageId);
  check('Shift keeps the aspect ratio while resizing', near(e.w / e.h, g.w / g.h, 0.02) && e.w > g.w, `${g.w.toFixed(2)}x${g.h.toFixed(2)} -> ${e.w.toFixed(2)}x${e.h.toFixed(2)}`);
  const rot = await handleCentre(page, 'rot');
  await drag(page, rot, { x: rot.x + 70, y: rot.y + 30 }, { hold: ['Shift'] });
  e = await elementOf(page, imageId);
  check('rotating with Shift snaps to 15 degrees', e.rotation !== 0 && Math.abs(e.rotation / 15 - Math.round(e.rotation / 15)) < 1e-6, String(e.rotation));
  const rotated = e.rotation;

  // hit testing follows the rotation: a click on the rotated centre selects it, one at the old corner does not
  await page.keyboard.press('Escape');
  g = await geometry(page, imageId);
  await page.mouse.click(g.cx, g.cy);
  check('click selects the rotated element', (await state(page)).sel[0] === imageId);

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
  e = await elementOf(page, imageId);
  check('Ctrl+Y redoes it', e.rotation === rotated);
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+Shift+z');
  await idle(page);
  check('Ctrl+Shift+Z redoes as well', (await elementOf(page, imageId)).rotation === rotated);
  check('undo and redo buttons follow the stacks', !(await page.isDisabled('#dt-undo')) && (await page.isDisabled('#dt-redo')));
  await page.click('#dt-undo');
  await page.click('#dt-redo');
  check('the toolbar buttons undo and redo', (await elementOf(page, imageId)).rotation === rotated);

  // ---------------------------------------------------------------------------------------- 6. snapping and guides
  current = 'snap: ';
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
  g = await geometry(page, imageId);
  await drag(page, { x: g.cx, y: g.cy }, { x: g.cx + 3, y: g.cy + 2 }, { hold: ['Alt'] });
  check('Alt switches snapping off', !near((await elementOf(page, imageId)).x + (await elementOf(page, imageId)).w / 2, 75, 0.001));

  // ---------------------------------------------------------------------------------------- 7. multi selection, align
  current = 'align: ';
  await page.click('#dt-tab-elements');
  await page.click('[data-add="rect"]');
  await idle(page);
  s = await state(page);
  const rectId = s.elements.find(e2 => e2.type === 'shape').id;
  // move the rectangle away so the two differ, then marquee both from outside the page
  g = await geometry(page, rectId);
  await drag(page, { x: g.cx, y: g.cy }, { x: g.cx - 120, y: g.cy + 60 }, { hold: ['Alt'] });
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
  await page.click('button[aria-label="Links ausrichten"]');
  await idle(page);
  const boxes = (await state(page)).elements.filter(e2 => [rectId, imageId].includes(e2.id));
  check('align left puts both left edges on one line', near(boxes[0].x, boxes[1].x, 0.01), boxes.map(b => b.x).join(' / '));
  await page.click('button[aria-label="Vertikal zentrieren"]');
  await idle(page);
  const mid = (await state(page)).elements.filter(e2 => [rectId, imageId].includes(e2.id));
  check('align middle puts both centres on one line', near(mid[0].y + mid[0].h / 2, mid[1].y + mid[1].h / 2, 0.01));
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await idle(page);

  // ---------------------------------------------------------------------------------------- 8. properties of the text
  current = 'properties: ';
  await page.keyboard.press('Escape');
  await page.evaluate(([i, r]) => { const a = window.DtDesigner.app; a.setProps([i], { x: 5, y: 5 }, { merge: false }); a.setProps([r], { x: 100, y: 75 }, { merge: false }); }, [imageId, rectId]);
  await idle(page);
  await page.evaluate(id => window.DtDesigner.app.select([id]), text.id);
  await page.fill('.dt-colour__hex', '#ff0000');
  await idle(page);
  check('hex colour changes the text colour', (await elementOf(page, text.id)).color === '#ff0000');
  const family = await page.$eval('label:text-is("Schrift") + select', s2 => s2.value);
  await page.selectOption('label:text-is("Schrift") + select', 'Montserrat');
  await idle(page);
  e = await elementOf(page, text.id);
  check('font family picker sets the family', e.fontFamily === 'Montserrat', e.fontFamily + ' (was ' + family + ')');
  const optionFamilies = await page.$$eval('label:text-is("Schrift") + select option', o => o.map(x => x.className).filter(Boolean).length);
  check('every family option has its own font class', optionFamilies >= 10, String(optionFamilies));
  const weights = await page.$$eval('label:text-is("Stärke") + select option', o => o.map(x => x.value));
  check('weights are limited to the family (100..900 steps for variable fonts)', weights.length === 9 && weights[0] === '100' && weights[8] === '900', weights.join(','));
  await page.fill('label:text-is("Größe") + .dt-numwrap input', '30');
  await idle(page);
  check('size in pt', (await elementOf(page, text.id)).fontSize === 30);
  await page.fill('.dt-textarea', 'Hallo {{Name}} {{Preis}}');
  await page.waitForTimeout(400);
  await idle(page);
  check('the text area edits the text (debounced)', (await elementOf(page, text.id)).text === 'Hallo {{Name}} {{Preis}}');
  check('typing in the panel is one undo step', await page.evaluate(() => { const a = window.DtDesigner.app; return a.undoStack.length > 0; }));

  // ---------------------------------------------------------------------------------------- 9. layers
  current = 'layers: ';
  await page.click('#dt-tab-layers');
  check('three layers listed', (await page.$$('.dt-layer')).length === 3);
  const topTitle = await page.textContent('.dt-layer >> nth=0 >> .dt-layer__name');
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
  await page.click(`.dt-layer[data-id="${imageId}"] .dt-layer__toggle[aria-label^="Entsperren"]`);
  const orderBefore = (await state(page)).elements.map(e2 => e2.id);
  await page.focus(`.dt-layer[data-id="${imageId}"] .dt-layer__grip`);
  await page.keyboard.press('ArrowUp');
  await idle(page);
  const orderAfter = (await state(page)).elements.map(e2 => e2.id);
  check('arrow up on the grip brings the layer forward', orderAfter.indexOf(imageId) === orderBefore.indexOf(imageId) + 1 || orderBefore.indexOf(imageId) === orderBefore.length - 1, orderBefore + ' -> ' + orderAfter);
  // drag to reorder with the pointer: grip of the top layer to below the last one
  const grip = await page.$eval(`.dt-layer >> nth=0`, li => { const r = li.querySelector('.dt-layer__grip').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const lastRow = await page.$eval('.dt-layer >> nth=2', li => { const r = li.getBoundingClientRect(); return { x: r.left + 40, y: r.bottom - 2 }; });
  const topBefore = (await state(page)).elements.map(e2 => e2.id).reverse()[0];
  await drag(page, grip, lastRow);
  const bottomAfter = (await state(page)).elements[0].id;
  check('dragging a layer by its grip reorders', bottomAfter === topBefore, `${topBefore} -> bottom ${bottomAfter}`);
  void topTitle;

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
  check('Escape deselects', await (async () => { await page.keyboard.press('Escape'); return (await state(page)).sel.length === 0; })());
  const z0 = (await state(page)).zoom;
  await page.keyboard.press('+');
  const z1 = (await state(page)).zoom;
  await page.keyboard.press('-');
  await page.keyboard.press('-');
  const z2 = (await state(page)).zoom;
  check('+ and - zoom', z1 > z0 && z2 < z1, `${z0} ${z1} ${z2}`);
  await page.keyboard.press('Control+0');
  check('Ctrl+0 fits the page', near((await state(page)).zoom, z0, 0.01));
  const wheelAt = await page.evaluate(() => { const r = document.getElementById('dt-viewport').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(wheelAt.x, wheelAt.y);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -300);
  await page.keyboard.up('Control');
  check('Ctrl+wheel zooms', (await state(page)).zoom > z0 * 1.2, String((await state(page)).zoom));
  await page.selectOption('#dt-zoom', '2');
  check('the zoom list sets a zoom', near((await state(page)).zoom, 2, 0.001));
  await page.selectOption('#dt-zoom', 'fit');
  const panBefore = await page.evaluate(() => { const v = document.getElementById('dt-viewport'); return [v.scrollLeft, v.scrollTop]; });
  await page.selectOption('#dt-zoom', '4');
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
  check('Space + drag pans the view', scrollB[0] > scrollA[0] || scrollB[1] > scrollA[1], `${scrollA} -> ${scrollB} (was ${panBefore})`);
  await page.selectOption('#dt-zoom', 'fit');

  // ---------------------------------------------------------------------------------------- 11. inline text editing
  current = 'inline text: ';
  g = await geometry(page, text.id);
  await page.mouse.dblclick(g.cx, g.cy);
  await page.waitForSelector('.dt-textedit');
  const taFont = await page.$eval('.dt-textedit', t => getComputedStyle(t).fontFamily);
  check('double click opens the editor over the element in its font', /Montserrat/.test(taFont), taFont);
  await page.keyboard.press('Control+a');
  await page.keyboard.type('Neuer Text');
  await page.keyboard.press('Escape');
  check('Escape cancels', (await elementOf(page, text.id)).text === 'Hallo {{Name}} {{Preis}}' && !(await page.$('.dt-textedit')));
  await page.mouse.dblclick(g.cx, g.cy);
  await page.waitForSelector('.dt-textedit');
  await page.keyboard.press('Control+a');
  await page.keyboard.type('Neuer Text {{Name}} {{Preis}}');
  await page.mouse.click(sheet.l - 30, sheet.t - 30);
  await idle(page);
  check('clicking outside commits', (await elementOf(page, text.id)).text === 'Neuer Text {{Name}} {{Preis}}');

  // ---------------------------------------------------------------------------------------- 12. save, reload, persisted
  current = 'save: ';
  check('there are unsaved changes', (await state(page)).dirty && (await page.textContent('#dt-state-text')).trim() === 'Ungespeichert');
  const before = await state(page);
  await page.click('#dt-save');
  await waitState(page, 'saved');
  check('state turns to Gespeichert', (await page.textContent('#dt-state-text')).trim() === 'Gespeichert');
  const saved = await page.evaluate(async id => (await (await fetch('/api/designs/' + id)).json()), designId);
  check('the revision went up', saved.revision >= 2, String(saved.revision));
  // the thumbnail follows the save (rasterised in the browser, then posted): wait for it, then reload
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

  // ---------------------------------------------------------------------------------------- 13. preview with a data list
  current = 'preview: ';
  await page.goto(base + '/DataLists/Edit');
  await page.fill('#Input_Name', 'Designer-Check Liste');
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit].mat-btn--primary')]);
  const listId = Number(page.url().match(/DataLists\/Edit\/(\d+)/)[1]);
  await page.goto(`${base}/DataLists/Edit/${listId}?tab=columns`);
  await page.selectOption('form[action*="FromDesign"] select', String(designId));
  await Promise.all([page.waitForNavigation(), page.click('form[action*="FromDesign"] button[type=submit]')]);
  const rows = await page.evaluate(async id => {
    const grid = await (await fetch('/api/datalists/' + id + '/rows')).json();
    const token = document.querySelector('meta[name=dt-csrf]').content;
    const body = { revision: grid.revision, rows: [
      { id: null, values: { Name: 'Gouda', Preis: '3,49', Bild1: 'flag-nl' }, copies: 1, isActive: true },
      { id: null, values: { Name: 'Bergkäse', Preis: '4.25', Bild1: 'flag-xx' }, copies: 1, isActive: true },
      { id: null, values: { Name: 'Camembert', Preis: '2.19', Bild1: 'flag-fr' }, copies: 1, isActive: true },
    ] };
    const r = await fetch('/api/datalists/' + id + '/rows', { method: 'POST', headers: { 'Content-Type': 'application/json', RequestVerificationToken: token }, body: JSON.stringify(body) });
    return { status: r.status, columns: grid.columns.map(c => c.key) };
  }, listId);
  check('the list has the columns of the design and three rows', rows.status === 200 && rows.columns.includes('Name') && rows.columns.includes('Preis') && rows.columns.includes('Bild1'), JSON.stringify(rows));
  await openDesigner(page, designId);
  await page.selectOption('#dt-data', String(listId));
  await page.waitForFunction(() => /Zeile 1 von 3/.test(document.getElementById('dt-row-info').textContent));
  await idle(page);
  check('row 1 is shown (Gouda, 3,49)', (await svgText(page)).includes('Gouda') && (await svgText(page)).includes('3,49'), await svgText(page));
  await page.click('#dt-row-next');
  await idle(page);
  check('next row: Bergkäse', (await svgText(page)).includes('Bergkäse') && /Zeile 2 von 3/.test(await page.textContent('#dt-row-info')));
  check('an unknown image key is reported', await page.isVisible('#dt-warnbar') && (await page.textContent('#dt-warnbar')).includes('flag-xx'), await page.textContent('#dt-warnbar'));
  await page.click('#dt-row-prev');
  await page.click('#dt-row-prev');
  await idle(page);
  check('the arrows wrap around', /Zeile 3 von 3/.test(await page.textContent('#dt-row-info')) && (await svgText(page)).includes('Camembert'));
  await page.selectOption('#dt-data', '');
  await idle(page);
  check('back to the sample values', (await svgText(page)).includes('Holunderblüte'));

  // ---------------------------------------------------------------------------------------- 14. edit conflict (409)
  current = 'conflict: ';
  const other = await context.newPage();
  watch(other, 'second tab');
  await openDesigner(other, designId);
  await other.evaluate(() => { const a = window.DtDesigner.app; a.select([a.doc.elements[0].id]); a.nudge(10, 0); });
  await other.keyboard.press('Control+s');
  await waitState(other, 'saved');
  await page.evaluate(() => { const a = window.DtDesigner.app; a.select([a.doc.elements[0].id]); a.nudge(-10, 0); });
  const nudgedX = (await state(page)).elements[0].x;
  await page.keyboard.press('Control+s');
  await page.waitForSelector('dialog[open]');
  const dialogText = await page.textContent('dialog[open]');
  check('the stale save opens the conflict dialog', dialogText.includes('inzwischen geändert') && dialogText.includes('Als Kopie speichern') && dialogText.includes('Neu laden'));
  await Promise.all([page.waitForNavigation({ timeout: 15000 }), page.click('dialog[open] button:has-text("Als Kopie speichern")')]);
  const copyId = Number(page.url().match(/Designs\/(\d+)\//)[1]);
  await page.waitForSelector('#dt-ds:not(.is-loading)');
  await idle(page);
  check('"Als Kopie speichern" opens a new design with my version', copyId !== designId && near((await state(page)).elements[0].x, nudgedX, 0.001), `copy ${copyId}`);
  check('the copy has its own name', (await page.inputValue('#dt-name')).includes('(Kopie)'));
  // second conflict, answered with "Neu laden"
  await other.goto(`${base}/Designs/${copyId}/Designer`);
  await other.waitForSelector('#dt-ds:not(.is-loading)');
  await other.evaluate(() => { const a = window.DtDesigner.app; a.select([a.doc.elements[0].id]); a.nudge(7, 0); });
  await other.keyboard.press('Control+s');
  await waitState(other, 'saved');
  const theirX = (await state(other)).elements[0].x;
  await page.evaluate(() => { const a = window.DtDesigner.app; a.select([a.doc.elements[0].id]); a.nudge(-3, 0); });
  await page.keyboard.press('Control+s');
  await page.waitForSelector('dialog[open]');
  await Promise.all([page.waitForNavigation({ timeout: 15000 }), page.click('dialog[open] button:has-text("Neu laden")')]);
  await page.waitForSelector('#dt-ds:not(.is-loading)');
  await idle(page);
  check('"Neu laden" shows the version of the other person', near((await state(page)).elements[0].x, theirX, 0.001));
  check('and leaves no draft behind', await page.evaluate(id => localStorage.getItem('dt-draft-' + id) === null, copyId));
  await other.close();

  // ---------------------------------------------------------------------------------------- 15. draft and offline
  current = 'draft: ';
  await page.evaluate(() => { const a = window.DtDesigner.app; a.select([a.doc.elements[0].id]); a.nudge(4, 0); });
  const draftX = (await state(page)).elements[0].x;
  await page.waitForTimeout(1300);
  check('a draft is kept in localStorage', await page.evaluate(id => !!localStorage.getItem('dt-draft-' + id), copyId));
  await page.reload();
  check('leaving with unsaved changes asks first (beforeunload)', dialogs.includes('beforeunload'));
  await page.waitForSelector('dialog[open]');
  check('the draft is offered on open', (await page.textContent('dialog[open]')).includes('Ungespeicherte Änderungen'));
  await page.click('dialog[open] button:has-text("Wiederherstellen")');
  await page.waitForSelector('#dt-ds:not(.is-loading)');
  await idle(page);
  check('restoring brings the unsaved change back (state: ungespeichert)', near((await state(page)).elements[0].x, draftX, 0.001) && (await state(page)).dirty);
  current = 'offline: ';
  await context.setOffline(true);
  await page.click('#dt-save');
  await page.waitForFunction(() => window.DtDesigner.app.saveState === 'offline');
  check('Offline shows the waiting message', (await page.textContent('#dt-state-text')).includes('Offline – wird gespeichert, sobald die Verbindung da ist'));
  await context.setOffline(false);
  await waitState(page, 'saved', 15000);
  check('saves by itself when the connection is back', !(await state(page)).dirty);
  check('the draft is cleared after the save', await page.evaluate(id => localStorage.getItem('dt-draft-' + id) === null, copyId));

  // ---------------------------------------------------------------------------------------- 16. the viewer
  current = 'viewer: ';
  const viewerContext = await newContext(browser);
  const viewer = await viewerContext.newPage();
  watch(viewer, 'viewer');
  await login(viewer, accounts.viewer);
  await openDesigner(viewer, copyId);
  check('the designer opens read-only', await viewer.evaluate(() => document.getElementById('dt-ds').classList.contains('is-readonly')));
  check('no save button, name read-only', !(await viewer.$('#dt-save')) && (await viewer.getAttribute('#dt-name', 'readonly')) !== null);
  check('the state says Nur ansehen', (await viewer.textContent('#dt-state-text')).trim() === 'Nur ansehen');
  check('tools are disabled', await viewer.isDisabled('[data-add="text"]'));
  const vg = await geometry(viewer, (await state(viewer)).elements[0].id);
  const beforeV = JSON.stringify((await state(viewer)).elements);
  await drag(viewer, { x: vg.cx, y: vg.cy }, { x: vg.cx + 50, y: vg.cy + 50 });
  await viewer.keyboard.press('Delete');
  await viewer.keyboard.press('ArrowRight');
  check('dragging, Delete and arrows change nothing', JSON.stringify((await state(viewer)).elements) === beforeV);
  const enabled = await viewer.$$eval('.dt-props input:not([disabled]), .dt-props select:not([disabled]), .dt-props textarea:not([disabled]), .dt-props button:not([disabled])', list => list.map(x => x.tagName + '.' + x.className + ' ' + (x.getAttribute('aria-label') || x.textContent || '').slice(0, 30)));
  check('the properties of the selection are shown but disabled', (await viewer.$$('.dt-props .dt-num')).length > 0 && enabled.length === 0, enabled.join(' | '));
  const vSave = await viewer.evaluate(async id => { const r = await fetch('/api/designs/' + id, { method: 'POST', headers: { 'Content-Type': 'application/json', RequestVerificationToken: document.querySelector('meta[name=dt-csrf]').content }, body: JSON.stringify({ revision: 1, document: {} }) }); return r.status; }, copyId);
  check('the server refuses a save of a viewer (403)', vSave === 403, String(vSave));
  await viewer.selectOption('#dt-data', String(listId));
  await viewer.waitForFunction(() => /Zeile 1 von 3/.test(document.getElementById('dt-row-info').textContent));
  check('the data preview still works for a viewer', await viewer.isVisible('#dt-rowctl'));
  await viewerContext.close();

  // ---------------------------------------------------------------------------------------- 16b. every tool, media by drag and drop, the page properties
  current = 'tools: ';
  await page.goto(base + '/Designs/Create');
  await page.fill('#Input_Name', 'Designer-Check Werkzeuge');
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit].mat-btn--primary')]);
  await page.waitForSelector('#dt-ds:not(.is-loading)');
  await idle(page);
  const toolIds = {};
  for (const kind of ['text', 'heading', 'rect', 'ellipse', 'line', 'image', 'strip', 'placeholder']) {
    await page.click('#dt-tab-elements');
    await page.click('[data-add="' + kind + '"]');
    if (kind === 'text' || kind === 'heading') { await page.waitForSelector('.dt-textedit'); await page.keyboard.press('Escape'); }
    await idle(page);
    const st = await state(page);
    toolIds[kind] = st.sel[0];
  }
  s = await state(page);
  const byId = id => s.elements.find(e2 => e2.id === id);
  check('eight tools add eight elements', s.elements.length === 8, String(s.elements.length));
  check('heading is bigger and bold', byId(toolIds.heading).fontSize > byId(toolIds.text).fontSize && byId(toolIds.heading).fontWeight === 700);
  check('rectangle and ellipse are shapes with a fill', byId(toolIds.rect).shape === 'rect' && byId(toolIds.ellipse).shape === 'ellipse' && !!byId(toolIds.rect).fill);
  check('a line has no height', byId(toolIds.line).shape === 'line' && byId(toolIds.line).h === 0);
  check('an empty image element is bound to nothing', byId(toolIds.image).type === 'image' && byId(toolIds.image).source === null);
  check('an image strip has four empty slots', byId(toolIds.strip).items.length === 4 && byId(toolIds.strip).items.every(i => i === null));
  check('the placeholder text creates its field', /^\{\{Feld\d+\}\}$/.test(byId(toolIds.placeholder).text) && s.fields.some(f => '{{' + f.key + '}}' === byId(toolIds.placeholder).text));
  // arrange: move the tools apart so that the pointer work below hits them one by one
  await page.evaluate(ids => {
    const a = window.DtDesigner.app;
    const put = (id, x, y, w, h) => a.setProps([id], { x, y, w, h }, { merge: false });
    put(ids.text, 4, 4, 40, 8); put(ids.heading, 4, 14, 60, 12); put(ids.rect, 100, 4, 20, 14); put(ids.ellipse, 125, 4, 20, 14);
    put(ids.line, 70, 40, 40, 0); put(ids.image, 4, 40, 30, 30); put(ids.strip, 4, 78, 90, 16); put(ids.placeholder, 100, 78, 45, 10);
    a.select([]);
  }, toolIds);
  await idle(page);
  const sheet2 = await page.evaluate(() => { const r = document.getElementById('dt-sheet').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });

  // media: a tile dragged onto the empty page, onto an image, onto a strip slot; a click fills an empty image
  await page.click('#dt-tab-media');
  await page.waitForSelector('.dt-asset[data-key="flag-fr"]');
  const tileCentre = async key => { await page.locator('.dt-asset[data-key="' + key + '"]').scrollIntoViewIfNeeded(); return page.$eval('.dt-asset[data-key="' + key + '"]', t => { const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); };
  let gx = await geometry(page, toolIds.image);
  const emptySpot = { x: gx.left + 80 * gx.k, y: gx.top + 60 * gx.k };
  await drag(page, await tileCentre('flag-fr'), emptySpot);
  s = await state(page);
  const dropped = s.elements.find(e2 => e2.type === 'image' && e2.source && e2.source.asset === 'flag-fr');
  check('drag from Medien onto the page adds an image at the drop point', !!dropped && near(dropped.x + dropped.w / 2, 80, 0.5) && near(dropped.y + dropped.h / 2, 60, 0.5), dropped && (dropped.x + dropped.w / 2) + ' / ' + (dropped.y + dropped.h / 2));
  gx = await geometry(page, toolIds.image);
  await drag(page, await tileCentre('flag-it'), { x: gx.cx, y: gx.cy });
  check('drag onto an image replaces its source', (await elementOf(page, toolIds.image)).source && (await elementOf(page, toolIds.image)).source.asset === 'flag-it');
  const stripG = await geometry(page, toolIds.strip);
  const stripDrop = { x: stripG.left + 4 * stripG.k + 90 * stripG.k * 0.9, y: stripG.cy };
  const stripHit = await page.evaluate(p => { const e = window.DtDesigner.canvas.hitTest(window.DtDesigner.canvas.toDoc(p.x, p.y)); return e ? e.type + ':' + e.id : null; }, stripDrop);
  await drag(page, await tileCentre('icon-bio'), stripDrop);
  const stripItems = (await elementOf(page, toolIds.strip)).items;
  check('drag onto an image strip fills a slot', stripItems.some(i => i && i.asset === 'icon-bio') && stripItems.length === 4, JSON.stringify(stripItems) + ' hit ' + stripHit + ' strip ' + toolIds.strip);
  await page.evaluate(id => window.DtDesigner.app.setProps([id], { source: null }, { merge: false }), toolIds.image);
  await page.evaluate(id => window.DtDesigner.app.select([id]), toolIds.image);
  await page.click('.dt-asset[data-key="flag-be"]');
  await idle(page);
  check('a click on a tile fills the selected empty image', (await elementOf(page, toolIds.image)).source.asset === 'flag-be' && (await state(page)).elements.filter(e2 => e2.type === 'image').length === 2);
  await page.fill('.dt-media__tools input[type=search]', 'Deutsch');
  await page.waitForFunction(() => document.querySelectorAll('.dt-asset').length === 1, null, { timeout: 5000 });
  check('the media search narrows the list', (await page.$$('.dt-asset')).length === 1);
  await page.fill('.dt-media__tools input[type=search]', '');
  await page.selectOption('.dt-media__tools select', 'Siegel');
  await page.waitForFunction(() => { const t = Array.from(document.querySelectorAll('.dt-asset')); return t.length > 5 && t.every(x => /^icon-/.test(x.getAttribute('data-key'))); }, null, { timeout: 5000 });
  check('the media category filter works', (await page.$$('.dt-asset')).length > 5);
  await page.selectOption('.dt-media__tools select', '');

  // the strip in the properties: a slot bound to a medium, one more slot, one removed
  await page.evaluate(id => window.DtDesigner.app.select([id]), toolIds.strip);
  const slotCount = () => page.$$eval('.dt-slot', l => l.length);
  check('four slots listed', (await slotCount()) === 4);
  await page.click('button:has-text("Platz hinzufügen")');
  check('a slot can be added', (await slotCount()) === 5 && (await elementOf(page, toolIds.strip)).items.length === 5);
  await page.click('.dt-slot >> nth=4 >> button[aria-label^="Platz 5 entfernen"]');
  check('and removed', (await elementOf(page, toolIds.strip)).items.length === 4);
  await page.selectOption('.dt-slot >> nth=1 >> select.dt-source__kind', 'asset');
  await page.fill('.dt-slot >> nth=1 >> input.dt-source__value', 'flag-de');
  await page.keyboard.press('Tab');
  check('a slot can be bound to a medium by its key', ((await elementOf(page, toolIds.strip)).items[1] || {}).asset === 'flag-de');

  // the line: two end handles and the rotate handle; the end handle makes it slanted
  await selectIds(page, [toolIds.line]);
  const lineHandles = await page.$$eval('[data-handle]', h => h.map(x => x.getAttribute('data-handle')).sort().join(','));
  check('a line has two end handles and the rotate handle', lineHandles === 'nw,rot,se', lineHandles);
  const lse = await handleCentre(page, 'se');
  await drag(page, lse, { x: lse.x + 30, y: lse.y + 40 }, { hold: ['Alt'] });
  check('dragging the end handle changes the angle of the line', (await elementOf(page, toolIds.line)).h > 5);

  // two shapes resized together
  await selectIds(page, [toolIds.rect, toolIds.ellipse]);
  const before2 = [await elementOf(page, toolIds.rect), await elementOf(page, toolIds.ellipse)];
  const groupSe = await handleCentre(page, 'se');
  await drag(page, groupSe, { x: groupSe.x + 40, y: groupSe.y + 20 }, { hold: ['Alt'] });
  const after2 = [await elementOf(page, toolIds.rect), await elementOf(page, toolIds.ellipse)];
  check('a group handle scales every selected element', after2[0].w > before2[0].w && after2[1].w > before2[1].w && after2[1].x > before2[1].x);

  // hide: an element that is hidden is not drawn and cannot be hit
  const heading = await geometry(page, toolIds.heading);
  await page.evaluate(id => window.DtDesigner.app.toggleHidden([id]), toolIds.heading);
  await idle(page);
  check('a hidden element is not drawn', !(await page.$('#dt-page [data-el-id="' + toolIds.heading + '"]')));
  await page.evaluate(() => window.DtDesigner.app.select([]));
  await page.mouse.click(heading.cx, heading.cy);
  check('and cannot be selected', !(await state(page)).sel.includes(toolIds.heading));
  await page.evaluate(id => window.DtDesigner.app.toggleHidden([id]), toolIds.heading);

  // display condition
  await page.evaluate(id => window.DtDesigner.app.select([id]), toolIds.text);
  await page.selectOption('.dt-sec:has(h3:text-is("Anzeigebedingung")) select', { index: 1 });
  check('the display condition is a field', (await elementOf(page, toolIds.text)).showIf === (await state(page)).fields[0].key);

  // field editing: renaming a key renames the placeholders
  await page.evaluate(id => window.DtDesigner.app.select([id]), toolIds.placeholder);
  s = await state(page);
  const placeholderField = s.fields.find(f => '{{' + f.key + '}}' === s.elements.find(e2 => e2.id === toolIds.placeholder).text).key;
  await page.click('#dt-tab-fields');
  await page.click('button[aria-label="Feld ' + placeholderField + ' bearbeiten"]');
  await page.fill('.dt-fieldform input[aria-label="Schlüssel"]', 'Kaesesorte');
  await page.keyboard.press('Tab');
  await idle(page);
  s = await state(page);
  check('renaming a field key renames its placeholders', s.fields.some(f => f.key === 'Kaesesorte') && s.elements.find(e2 => e2.id === toolIds.placeholder).text === '{{Kaesesorte}}', s.elements.find(e2 => e2.id === toolIds.placeholder).text);
  await page.fill('.dt-fieldform input[aria-label="Schlüssel"]', 'Bad Key');
  await page.keyboard.press('Tab');
  check('an invalid key is refused with a message', await page.isVisible('.dt-field__error') && (await state(page)).fields.some(f => f.key === 'Kaesesorte'));

  // pasted text becomes a text element
  const countBefore = (await state(page)).elements.length;
  await page.mouse.click(sheet2.l - 30, sheet2.t - 30);
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData('text/plain', 'Eingefügter Text');
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await idle(page);
  check('pasting plain text adds a text element', (await state(page)).elements.length === countBefore + 1 && (await state(page)).elements.some(e2 => e2.text === 'Eingefügter Text'));

  // the page: preset, unit, background
  await page.mouse.click(sheet2.l - 30, sheet2.t - 30);
  await page.evaluate(() => window.DtDesigner.app.select([]));
  await page.selectOption('.dt-props select[aria-label="Format"]', 'a4-landscape');
  await idle(page);
  s = await state(page);
  check('a format preset sets the page size', s.doc.width === 297 && s.doc.height === 210 && s.doc.unit === 'mm');
  await page.fill('#dt-props .dt-colour__hex', '#ffeecc');
  await idle(page);
  check('the background colour', (await state(page)).doc.background.color === '#ffeecc');
  const xBefore = (await state(page)).elements[0].x;
  await page.selectOption('.dt-props label:text-is("Einheit") + select', 'px');
  await page.waitForSelector('dialog[open]');
  await page.click('dialog[open] button:has-text("Umrechnen")');
  await page.waitForFunction(() => window.DtDesigner.app.doc.unit === 'px');
  await idle(page);
  s = await state(page);
  check('changing the unit converts every length (mm to px)', s.doc.unit === 'px' && near(s.doc.width, 297 * 96 / 25.4, 0.1) && near(s.elements[0].x, xBefore * 96 / 25.4, 0.01), s.doc.width + ' ' + s.elements[0].x);
  await page.keyboard.press('Control+z');
  await idle(page);
  check('and one undo takes it back', (await state(page)).doc.unit === 'mm');

  // empty sources and empty strip slots are valid in the saved document
  await page.keyboard.press('Control+s');
  await waitState(page, 'saved');
  const toolsDesign = Number(page.url().match(/Designs\/(\d+)\//)[1]);
  await page.reload();
  await page.waitForSelector('#dt-ds:not(.is-loading)');
  await idle(page);
  s = await state(page);
  check('the tools design saves and reloads with its empty slots', s.elements.some(e2 => e2.type === 'imageStrip' && e2.items.length === 4 && e2.items[0] === null && e2.items[3] && e2.items[3].asset === 'icon-bio') && s.elements.some(e2 => e2.type === 'image' && e2.source && e2.source.asset === 'flag-be') && toolsDesign > 0);

  // ---------------------------------------------------------------------------------------- 17. the demo label (docs/PLAN.md 1.2)
  current = 'demo: ';
  await page.goto(base + '/Designs/Create');
  await page.fill('#Input_Name', 'Käsetheke – Preisschild (Check)');
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit].mat-btn--primary')]);
  const demoId = Number(page.url().match(/Designs\/(\d+)\//)[1]);
  const posted = await page.evaluate(async ({ id, doc }) => {
    const got = await (await fetch('/api/designs/' + id)).json();
    const r = await fetch('/api/designs/' + id, { method: 'POST', headers: { 'Content-Type': 'application/json', RequestVerificationToken: document.querySelector('meta[name=dt-csrf]').content }, body: JSON.stringify({ revision: got.revision, document: doc }) });
    return { status: r.status, body: await r.json() };
  }, { id: demoId, doc: demoDocument() });
  check('the server accepts the demo document', posted.status === 200 && posted.body.warnings.length === 0, JSON.stringify(posted.body.warnings || posted.body));
  // list "Käsetheke (Beispiel)" for the preview
  await page.goto(base + '/DataLists/Edit');
  await page.fill('#Input_Name', 'Käsetheke (Beispiel)');
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
  await openDesigner(page, demoId);
  await page.evaluate(() => { localStorage.removeItem('dt-preview-' + window.DtDesigner.app.id); });
  await page.waitForTimeout(600);
  check('the demo label is drawn: name, price, three seals in the strip', (await svgText(page)).includes('Holunderblüte') && (await svgText(page)).includes('2,99') && (await page.evaluate(() => document.querySelectorAll('#dt-page svg image').length)) === 4);
  await page.keyboard.press('Escape');
  await shot(page, 'designer-1280.png');
  const nameEl = (await state(page)).elements.find(e2 => e2.name === 'Name');
  await page.evaluate(id => window.DtDesigner.app.select([id]), nameEl.id);
  await idle(page);
  await shot(page, 'designer-1280-selection.png');
  await page.selectOption('#dt-data', String(demoList));
  await page.waitForFunction(() => /Zeile 1 von 4/.test(document.getElementById('dt-row-info').textContent));
  await page.click('#dt-row-next');
  await page.click('#dt-row-next');
  await idle(page);
  check('with the list: Bergkäse hides the empty seals', (await svgText(page)).includes('Bergkäse') && (await page.evaluate(() => document.querySelectorAll('#dt-page svg image').length)) === 3);
  await shot(page, 'designer-1280-data.png');
  await page.click('#dt-row-next');
  await idle(page);
  check('Camembert hides the rows without values', !(await svgText(page)).includes('GEREIFT'), await svgText(page));
  await page.selectOption('#dt-data', '');

  // ---------------------------------------------------------------------------------------- 18. tablet with touch (1024 x 768: the full designer)
  current = 'tablet: ';
  const tabletContext = await newContext(browser, { viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: false, deviceScaleFactor: 1 });
  const tablet = await tabletContext.newPage();
  watch(tablet, 'tablet');
  await login(tablet, accounts.designer);
  await openDesigner(tablet, demoId);
  check('the browser reports a coarse pointer', await tablet.evaluate(() => matchMedia('(pointer: coarse)').matches));
  check('1024 px shows both panels, no drawers', await tablet.isVisible('#dt-left') && await tablet.isVisible('#dt-right') && !(await tablet.isVisible('#dt-toggle-left')));
  check('the canvas is wide enough to work in', (await tablet.evaluate(() => document.getElementById('dt-viewport').getBoundingClientRect().width)) >= 480);
  await shot(tablet, 'designer-1024-touch.png');
  const tg = await geometry(tablet, nameEl.id);
  await tablet.touchscreen.tap(tg.cx, tg.cy);
  await idle(tablet);
  check('a tap selects the element', (await state(tablet)).sel.length === 1);
  const touchTargets = await tablet.$$eval('#dt-right button:not(.mat-seg__btn), #dt-right input:not([type=checkbox]), #dt-right select', els => els.filter(x => x.getBoundingClientRect().height > 0).map(x => Math.round(x.getBoundingClientRect().height)));
  check('touch targets in the properties are 44 px high (segmented buttons reach 44 px with their hit area, switches are labels)', touchTargets.filter(h => h < 44).length === 0, JSON.stringify(Array.from(new Set(touchTargets))));
  await shot(tablet, 'designer-1024-touch-selection.png');
  // a finger drags the selected element; two fingers pinch the page
  const cdp = await tabletContext.newCDPSession(tablet);
  const priceEl = (await state(tablet)).elements.find(e2 => e2.name === 'Euro');
  await tablet.evaluate(id => window.DtDesigner.app.select([id]), priceEl.id);
  const pg = await geometry(tablet, priceEl.id);
  await touchDrag(tablet, cdp, { x: pg.cx, y: pg.cy }, { x: pg.cx - 40, y: pg.cy + 30 });
  await idle(tablet);
  const moved = await elementOf(tablet, priceEl.id);
  check('a finger drags an element', moved.x < priceEl.x - 3, priceEl.x + ' -> ' + moved.x);
  const z = (await state(tablet)).zoom;
  const c0 = { x: 512, y: 380 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c0.x - 40, y: c0.y, id: 1 }, { x: c0.x + 40, y: c0.y, id: 2 }] });
  for (let i = 1; i <= 6; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c0.x - 40 - i * 12, y: c0.y, id: 1 }, { x: c0.x + 40 + i * 12, y: c0.y, id: 2 }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  check('two fingers pinch to zoom', (await state(tablet)).zoom > z * 1.4, z + ' -> ' + (await state(tablet)).zoom);
  await tabletContext.close();

  // a tablet in portrait (820 x 1180): the panels are drawers
  current = 'drawers: ';
  const drawerContext = await newContext(browser, { viewport: { width: 820, height: 1180 }, hasTouch: true, deviceScaleFactor: 1 });
  const drawers = await drawerContext.newPage();
  watch(drawers, 'drawers');
  await login(drawers, accounts.designer);
  await openDesigner(drawers, demoId);
  check('below 1024 px the panels are drawers', !(await drawers.isVisible('#dt-left')) && !(await drawers.isVisible('#dt-right')) && await drawers.isVisible('#dt-toggle-left'));
  await drawers.tap('#dt-toggle-left');
  await drawers.waitForTimeout(450);
  check('the library drawer opens', await drawers.isVisible('#dt-left') && await drawers.isVisible('#dt-scrim'));
  await shot(drawers, 'designer-820-drawer.png');
  await drawers.tap('#dt-scrim', { position: { x: 700, y: 600 } });
  await drawers.waitForTimeout(450);
  check('a tap beside the drawer closes it', !(await drawers.isVisible('#dt-left')));
  await drawers.tap('#dt-toggle-right');
  await drawers.waitForTimeout(450);
  check('the properties drawer opens', await drawers.isVisible('#dt-right'));
  await drawerContext.close();

  // ---------------------------------------------------------------------------------------- 19. phone (390 x 844)
  current = 'phone: ';
  const phoneContext = await newContext(browser, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const phone = await phoneContext.newPage();
  watch(phone, 'phone');
  await login(phone, accounts.designer);
  await openDesigner(phone, demoId);
  check('the hint for a larger screen is shown', (await phone.textContent('.dt-ds__phonehint')).includes('Zum Bearbeiten brauchst du einen größeren Bildschirm') && await phone.isVisible('.dt-ds__phonehint'));
  check('the hint links to the properties page', (await phone.getAttribute('.dt-ds__phonehint a', 'href')) === `/Designs/${demoId}`);
  check('panels and save are hidden', !(await phone.isVisible('#dt-left')) && !(await phone.isVisible('#dt-right')) && !(await phone.$('#dt-save') && await phone.isVisible('#dt-save')));
  check('no horizontal scroll', await phone.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  const pageBox = await phone.evaluate(() => { const r = document.getElementById('dt-sheet').getBoundingClientRect(); return { l: r.left, w: r.width, vw: innerWidth }; });
  check('the label fits the screen', pageBox.l >= 0 && pageBox.l + pageBox.w <= pageBox.vw + 1, JSON.stringify(pageBox));
  await phone.selectOption('#dt-data', String(demoList));
  await phone.waitForFunction(() => /Zeile 1 von 4/.test(document.getElementById('dt-row-info').textContent));
  await phone.tap('#dt-row-next');
  await idle(phone);
  check('the data preview works on a phone', (await svgText(phone)).includes('Alter Gouda'));
  const pe = await geometry(phone, nameEl.id);
  await phone.touchscreen.tap(pe.cx, pe.cy);
  check('nothing can be selected on a phone', (await state(phone)).sel.length === 0);
  await shot(phone, 'designer-390.png');
  await phoneContext.close();

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
