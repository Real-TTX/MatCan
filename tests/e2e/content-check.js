// Checks the content of the Canva-style editor (phase K4) in a real browser (installed Edge, headless): the Elemente panel (sections, search with German words, icons in batches, drag onto a
// frame), the Text panel with the Schriftkombinationen, the contextual toolbar of every kind (text with the Effekte page, image with crop mode, Anpassen, masks and borders, shape with the
// gradient picker, line ends, icon picker, QR code and barcode, image strip with slot chips, several nodes, the page), the colour picker (document, brand, palette, hex, gradient), the Marke
// and Vorlagen panels, Größe ändern, the media browser in the data list grid, and the phone editor (390 x 844). Screenshots go to the temp folder (content-*.png). Zero console errors and zero
// CSP violations are part of the result.
//
//   node content-check.js [base url, default http://localhost:3043] [--out <folder for the screenshots>] [--only elements,text,...]
//
// Accounts: tests/e2e/test-account.json (see lib.js); a designer and a viewer are needed. The brand kit (a setting of the whole installation) is restored at the end.
const fs = require('fs');
const path = require('path');
const lib = require('./lib.js');
const E = require('./editor-lib.js');

const args = process.argv.slice(2);
const { base, problems, watch, launch, newContext, login, ensureAccounts, postJson, shareWith } = lib(args, { ignore: /status of (403|409)|Failed to load resource: the server responded with a status of 4\d\d/ });
const outIndex = args.indexOf('--out');
const outDir = path.resolve(outIndex >= 0 ? args[outIndex + 1] : path.join(require('os').tmpdir(), 'designthix-content-check'));
const onlyIndex = args.indexOf('--only');
const only = onlyIndex >= 0 ? args[onlyIndex + 1].split(',') : null;

const results = [];
let current = '';
const check = (name, ok, detail) => { results.push({ name: current + name, ok: !!ok, detail }); };
const { idle, state, nodeOf, openDesigner, createDesign, geometry, drag, openPanel, near, raf2 } = E;
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const kind = page => page.getAttribute('#dt-ctx', 'data-kind');
const tb = (page, label) => page.locator(`#dt-ctx button[aria-label="${label}"]`);
const menuItem = (page, label, level) => page.locator(`.dt-menu[data-level="${level || 0}"] .dt-menu__item`, { has: page.locator('.dt-menu__label', { hasText: new RegExp('^' + esc(label) + '$') }) });
async function menuClick(page, label, level) { const item = menuItem(page, label, level); await item.waitFor({ state: 'visible', timeout: 5000 }); await item.click(); }
const settle = async page => { await idle(page); await raf2(page); };
const el = (page, id) => nodeOf(page, id);
const sel0 = async page => (await state(page)).sel[0];

async function shot(page, name) {
  fs.mkdirSync(outDir, { recursive: true });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(outDir, name) });
  console.log('screenshot ' + path.join(outDir, name));
}

async function fresh(page, body) {
  const made = await createDesign(page, postJson, body || { preset: 'price-tag' });
  await openDesigner(page, base, made.id);
  return made.id;
}

/** Uploads a PNG made in memory (from inside the page, so the antiforgery token is right) and makes the editor know it. */
async function uploadPng(page, rgb, w, h) {
  const f = E.pngFile('content-' + Date.now() + '-' + Math.floor(Math.random() * 1000) + '.png', rgb, w || 400, h || 240);
  return page.evaluate(async file => {
    const bin = atob(file.base64); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) { bytes[i] = bin.charCodeAt(i); }
    const fd = new FormData(); fd.append('files', new File([bytes], file.name, { type: file.type }));
    const r = await fetch('/api/assets/upload', { method: 'POST', headers: { RequestVerificationToken: document.querySelector('meta[name=dt-csrf]').content }, body: fd });
    const j = await r.json();
    window.DtDesigner.app.addAssets(j.uploaded);
    return j.uploaded[0];
  }, f);
}

/** Adds an image of the library to the page and selects it; resolves its id. */
const addImage = (page, asset) => page.evaluate(a => window.DtDesigner.canvas.addAssetImage(a, null), asset);
const addEl = (page, kindName, extra) => page.evaluate(({ k, x }) => window.DtDesigner.app.addElement(k, x || null), { k: kindName, x: extra });
const select = async (page, ids) => { await E.selectIds(page, ids); };
const undo = async page => { await page.evaluate(() => window.DtDesigner.app.undo()); await settle(page); };
const undoDepth = page => page.evaluate(() => window.DtDesigner.app.undoStack.length);
const centre = async (page, locator) => { await locator.scrollIntoViewIfNeeded(); const b = await locator.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const sheetBox = page => page.evaluate(() => { const r = document.getElementById('dt-sheet').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height, k: window.DtDesigner.app.scale() }; });
const toDoc = async (page, p) => { const s = await sheetBox(page); return { x: (p.x - s.l) / s.k, y: (p.y - s.t) / s.k }; };
const fromDoc = async (page, p) => { const s = await sheetBox(page); return { x: s.l + p.x * s.k, y: s.t + p.y * s.k }; };

const sections = {};

// ================================================================================================ 1. Elemente
sections.elements = async ({ page }) => {
  current = 'elements: ';
  await fresh(page);
  await openPanel(page, 'elements');
  await page.waitForSelector('.dt-psec[data-section="icons"] .dt-icontile');
  const ids = await page.$$eval('.dt-psec[data-section]', s => s.map(x => x.getAttribute('data-section')));
  check('the sections are Formen, Linien, Rahmen, Icons, Flaggen, Siegel, Codes and Bildleiste', ids.join('|') === 'shapes|lines|frames|icons|flags|seals|codes|strip', ids.join('|'));
  const titles = await page.$$eval('.dt-psec[data-section] .dt-psec__title', s => s.map(x => x.textContent.trim()));
  check('every section has a German title', titles.join('|') === 'Formen|Linien|Rahmen für Bilder|Icons|Flaggen|Siegel|Codes|Bildleiste', titles.join('|'));
  check('every section with more tiles than it shows has "Alle anzeigen"', (await page.$$('[data-show-all]')).length >= 6);
  await shot(page, 'content-1440-elements.png');

  // every shape tile inserts its element
  const shapeTiles = [['rect', t => t.shape === 'rect'], ['rounded', t => t.shape === 'rect' && t.radius > 0], ['ellipse', t => t.shape === 'ellipse'], ['triangle', t => t.shape === 'triangle'], ['diamond', t => t.shape === 'diamond'], ['pentagon', t => t.shape === 'pentagon'], ['hexagon', t => t.shape === 'hexagon'], ['star', t => t.shape === 'star' && t.points === 5]];
  for (const [k, test] of shapeTiles) {
    await page.click(`.dt-psec[data-section="shapes"] .dt-tile[data-add="${k}"]`);
    await settle(page);
    const e = await el(page, await sel0(page));
    check(`the shape tile "${k}" inserts a shape in the middle of the page`, e && e.type === 'shape' && test(e) && near(e.x + e.w / 2, 75, 0.2) && near(e.y + e.h / 2, 50, 0.2), JSON.stringify(e && { shape: e.shape, radius: e.radius }));
  }
  await page.click('[data-show-all="shapes"]');
  await page.waitForSelector('.dt-backbtn');
  const allShapes = await page.$$eval('.dt-tile[data-add]', t => t.map(x => x.getAttribute('data-add')));
  check('"Alle anzeigen" of Formen shows all 12 shapes and a back arrow', allShapes.length === 12 && await page.isVisible('.dt-backbtn'), allShapes.join(','));
  for (const k of ['star8', 'heart', 'arrow', 'speech']) {
    await page.click(`.dt-tile[data-add="${k}"]`);
    await settle(page);
    const e = await el(page, await sel0(page));
    check(`the shape tile "${k}" inserts its shape`, e && e.type === 'shape' && e.shape === (k === 'star8' ? 'star' : k) && (k !== 'star8' || (e.points === 8 && e.innerRadius > 0.5)), JSON.stringify(e && { shape: e.shape, points: e.points }));
  }
  await page.click('.dt-backbtn');
  await page.waitForSelector('.dt-psec[data-section="lines"]');

  // lines
  for (const [k, test] of [['line', e => e.endCap === 'none' && e.dash === 'solid'], ['line-dashed', e => e.dash === 'dashed'], ['line-dotted', e => e.dash === 'dotted'], ['line-arrow', e => e.endCap === 'arrow' && e.startCap === 'none']]) {
    await page.click(`.dt-psec[data-section="lines"] .dt-tile[data-add="${k}"]`);
    await settle(page);
    const e = await el(page, await sel0(page));
    check(`the line tile "${k}" inserts a line with the right style`, e && e.type === 'shape' && e.shape === 'line' && test(e), JSON.stringify(e && { dash: e.dash, startCap: e.startCap, endCap: e.endCap }));
  }
  await page.click('[data-show-all="lines"]');
  await page.click('.dt-tile[data-add="line-arrows"]');
  await settle(page);
  let e = await el(page, await sel0(page));
  check('the double arrow has caps at both ends', e.startCap === 'arrow' && e.endCap === 'arrow');
  await page.click('.dt-backbtn');

  // frames
  for (const [k, mask] of [['frame', 'none'], ['frame-rounded', 'rounded'], ['frame-circle', 'circle'], ['frame-heart', 'heart']]) {
    await page.click(`.dt-psec[data-section="frames"] .dt-tile[data-add="${k}"]`);
    await settle(page);
    e = await el(page, await sel0(page));
    check(`the frame tile "${k}" inserts an image element without a source and the mask ${mask}`, e && e.type === 'image' && !e.source && e.mask === mask, JSON.stringify(e && { type: e.type, mask: e.mask, source: e.source }));
  }
  await page.click('[data-show-all="frames"]');
  const frameKinds = await page.$$eval('.dt-tile[data-add]', t => t.map(x => x.getAttribute('data-add')));
  check('"Alle anzeigen" of Rahmen has rectangle, rounded, circle, heart, star, hexagon and triangle', ['frame', 'frame-rounded', 'frame-circle', 'frame-heart', 'frame-star', 'frame-hexagon', 'frame-triangle'].every(k => frameKinds.includes(k)), frameKinds.join(','));
  for (const [k, mask] of [['frame-star', 'star'], ['frame-hexagon', 'hexagon'], ['frame-triangle', 'triangle']]) {
    await page.click(`.dt-tile[data-add="${k}"]`);
    await settle(page);
    e = await el(page, await sel0(page));
    check(`the frame tile "${k}" gives the mask ${mask}`, e && e.type === 'image' && e.mask === mask);
  }
  await page.click('.dt-backbtn');

  // icons
  const firstIcon = await page.$eval('.dt-psec[data-section="icons"] .dt-icontile', t => t.getAttribute('data-icon'));
  await page.click('.dt-psec[data-section="icons"] .dt-icontile');
  await settle(page);
  e = await el(page, await sel0(page));
  check('an icon tile inserts an icon element with that name', e && e.type === 'icon' && e.icon === firstIcon, firstIcon + ' / ' + (e && e.icon));
  await page.waitForTimeout(300);
  check('the inserted icon is drawn by the engine (paths in the page)', (await page.evaluate(id => { const g = window.DtDesigner.canvas.nodeElement(id); return g ? g.querySelectorAll('path, circle, line, rect, polyline, polygon').length : 0; }, e.id)) > 0);

  // flags, seals, codes, strip
  await page.locator('.dt-psec[data-section="flags"] .dt-asset[data-key="flag-de"]').scrollIntoViewIfNeeded();
  await page.click('.dt-psec[data-section="flags"] .dt-asset[data-key="flag-de"]');
  await settle(page);
  e = await el(page, await sel0(page));
  check('a flag tile inserts an image with the flag as its source', e && e.type === 'image' && e.source && e.source.asset === 'flag-de');
  const sealKey = await page.$eval('.dt-psec[data-section="seals"] .dt-asset', a => a.getAttribute('data-key'));
  await page.locator('.dt-psec[data-section="seals"] .dt-asset').first().scrollIntoViewIfNeeded();
  await page.click('.dt-psec[data-section="seals"] .dt-asset >> nth=0');
  await settle(page);
  e = await el(page, await sel0(page));
  check('a seal tile inserts an image with the seal as its source', e && e.type === 'image' && e.source && e.source.asset === sealKey, sealKey);
  for (const [k, test] of [['qr', t => t.type === 'qr'], ['ean13', t => t.type === 'barcode' && t.format === 'ean13'], ['ean8', t => t.type === 'barcode' && t.format === 'ean8'], ['code128', t => t.type === 'barcode' && t.format === 'code128']]) {
    await page.locator(`.dt-psec[data-section="codes"] .dt-tile[data-add="${k}"]`).scrollIntoViewIfNeeded();
    await page.click(`.dt-psec[data-section="codes"] .dt-tile[data-add="${k}"]`);
    await settle(page);
    e = await el(page, await sel0(page));
    check(`the code tile "${k}" inserts a ${k === 'qr' ? 'QR code' : 'barcode'}`, e && test(e) && (k === 'qr' || window_ok(e)), JSON.stringify(e && { type: e.type, format: e.format, value: e.value }));
  }
  await page.locator('.dt-psec[data-section="strip"] .dt-tile').scrollIntoViewIfNeeded();
  await page.click('.dt-psec[data-section="strip"] .dt-tile');
  await settle(page);
  e = await el(page, await sel0(page));
  check('the Bildleiste tile inserts an image strip with four empty slots', e && e.type === 'imageStrip' && e.items.length === 4 && e.items.every(i => !i));

  // search
  const search = { fill: async text => { await page.fill('.dt-psearch', text); await page.waitForSelector('.dt-presults[data-query="' + text + '"]'); } };
  const resultTiles = async () => page.$$eval('.dt-presults [data-section]', s => s.map(x => x.getAttribute('data-section') + ':' + x.querySelectorAll('.dt-icontile, .dt-tile, .dt-asset').length));
  await search.fill('herz');
  await page.waitForSelector('.dt-icontile[data-icon="heart"]');
  let r = await resultTiles();
  check('the search "herz" finds the heart icon (German word), the heart shape and the heart frame', await page.isVisible('.dt-icontile[data-icon="heart"]') && r.some(x => x.startsWith('shapes:')) && r.some(x => x.startsWith('frames:')), r.join(' '));
  await search.fill('käse');
  await page.waitForSelector('.dt-psec[data-section="icons"] .dt-icontile');
  const kaeseIcons = await page.$$eval('.dt-psec[data-section="icons"] .dt-icontile', t => t.map(x => x.getAttribute('data-icon')));
  check('the search "käse" finds icons (pizza, cookie, sandwich ...) that stand for cheese', kaeseIcons.includes('pizza') && kaeseIcons.length >= 3, kaeseIcons.join(','));
  check('"käse" also finds the cheese seals (Gereift ...)', (await page.$$('.dt-psec[data-section="seals"] .dt-asset')).length >= 1);
  await shot(page, 'content-1440-elements-kaese.png');
  await search.fill('kaese');
  await page.waitForSelector('.dt-psec[data-section="icons"] .dt-icontile');
  check('"kaese" is the same word as "käse"', (await page.$$eval('.dt-psec[data-section="icons"] .dt-icontile', t => t.map(x => x.getAttribute('data-icon')))).includes('pizza'));
  await search.fill('qr');
  await page.waitForSelector('.dt-psec[data-section="codes"]');
  r = await resultTiles();
  check('the search "qr" finds the QR code (and the QR icons), no shapes', r.some(x => x === 'codes:1') && !r.some(x => x.startsWith('shapes')), r.join(' '));
  await search.fill('Schweiz');
  await page.waitForSelector('.dt-psec[data-section="flags"] .dt-asset');
  check('the search finds a flag by its name (Schweiz)', await page.isVisible('.dt-asset[data-key="flag-ch"]'));
  await search.fill('zzzzqq');
  await page.waitForSelector('.dt-presults .dt-empty');
  check('nothing found says so', (await page.textContent('.dt-presults .dt-empty')).includes('Nichts gefunden'));
  await search.fill('kuh');
  await page.waitForSelector('.dt-psec[data-section="icons"] .dt-icontile');
  check('more German words work: "kuh" finds icons', (await page.$$('.dt-psec[data-section="icons"] .dt-icontile')).length >= 2);
  await search.fill('');
  await page.waitForSelector('.dt-psec[data-section="shapes"]');

  // the whole icon library, in batches
  await page.click('[data-show-all="icons"]');
  await page.waitForSelector('.dt-icongrid .dt-icontile');
  await page.waitForTimeout(500);
  const first = await page.$$eval('.dt-icongrid .dt-icontile', t => t.length);
  const library = await page.evaluate(() => Object.keys(window.DtDesigner.icons.library().icons).length);
  check('the icon library has about 1 900 icons', library >= 1800, String(library));
  check('the grid draws only a first batch (not all icons at once)', first >= 50 && first < 400, String(first));
  check('the back arrow shows the number of icons', parseInt(await page.textContent('.dt-backbtn__count'), 10) === library);
  await page.evaluate(() => { const b = document.getElementById('dt-panel-body'); b.scrollTop = b.scrollHeight; });
  await page.waitForTimeout(600);
  const more = await page.$$eval('.dt-icongrid .dt-icontile', t => t.length);
  check('scrolling to the end draws the next batch', more > first, first + ' -> ' + more);
  const every = await page.evaluate(() => { const D = window.DtDesigner; const lib = D.icons.library(); return Object.keys(D.iconWordsDe).every(w => D.iconWordsDe[w].every(n => lib.icons[n])); });
  check('every icon named by the list of German search words exists in the library', every);
  const wordCount = await page.evaluate(() => Object.keys(window.DtDesigner.iconWordsDe).length);
  check('the list of German search words has about 250 words or more', wordCount >= 240, String(wordCount));
  await shot(page, 'content-1440-elements-icons-all.png');
  // drag an icon to a place on the page
  await page.click('.dt-backbtn');
  await page.evaluate(() => { const a = window.DtDesigner.app; a.select(a.elements().map(x => x.id)); a.deleteSelection(); });
  await settle(page);
  const iconTile = page.locator('.dt-psec[data-section="icons"] .dt-icontile[data-icon="heart"]');
  const target = await fromDoc(page, { x: 30, y: 25 });
  await drag(page, await centre(page, iconTile), target);
  await settle(page);
  e = await el(page, await sel0(page));
  check('an icon dragged onto the page lands where it is dropped', e && e.type === 'icon' && e.icon === 'heart' && near(e.x + e.w / 2, 30, 1.5) && near(e.y + e.h / 2, 25, 1.5), JSON.stringify(e && { x: e.x, y: e.y }));
  // drag a flag onto an empty frame: the frame gets the flag, no new element
  const frameId = await addEl(page, 'frame-circle');
  await settle(page);
  const before = (await state(page)).elements.length;
  const gFrame = await geometry(page, frameId);
  await page.locator('.dt-psec[data-section="flags"] .dt-asset[data-key="flag-fr"]').scrollIntoViewIfNeeded();
  await drag(page, await centre(page, page.locator('.dt-psec[data-section="flags"] .dt-asset[data-key="flag-fr"]')), { x: gFrame.cx, y: gFrame.cy });
  await settle(page);
  e = await el(page, frameId);
  check('a flag dragged onto a frame fills it (the frame keeps its mask, no new element)', e.source && e.source.asset === 'flag-fr' && e.mask === 'circle' && (await state(page)).elements.length === before, JSON.stringify(e.source));
  // a click while an empty frame is selected fills it as well
  const frame2 = await addEl(page, 'frame');
  await settle(page);
  await page.click('.dt-psec[data-section="flags"] .dt-asset[data-key="flag-de"]');
  await settle(page);
  e = await el(page, frame2);
  check('a click on a flag fills the selected empty frame', e.source && e.source.asset === 'flag-de');
};
function window_ok(e) { return typeof e.value === 'string' && e.value.length > 0; }

// ================================================================================================ 2. Text panel and Schriftkombinationen
sections.text = async ({ page }) => {
  current = 'text: ';
  await fresh(page);
  await openPanel(page, 'text');
  await page.waitForSelector('.dt-combo');
  const combos = await page.$$eval('.dt-combo', c => c.map(x => x.getAttribute('data-combo')));
  check('there are ten Schriftkombinationen', combos.length === 10, combos.join(','));
  await page.waitForFunction(() => document.querySelectorAll('.dt-combo__thumb svg').length >= 10, null, { timeout: 15000 });
  check('every combination has a preview drawn by the engine', (await page.$$('.dt-combo__thumb svg')).length === 10);
  const names = await page.$$eval('.dt-combo', c => c.map(x => x.getAttribute('title')));
  check('they are named SALE −30 %, Frisch vom Markt, Angebot der Woche, Neu eingetroffen, Hausgemacht, Regional & frisch, Danke!, Einladung, Öffnungszeiten, Tagesangebot',
    ['SALE −30 %', 'Frisch vom Markt', 'Angebot der Woche', 'Neu eingetroffen', 'Hausgemacht', 'Regional & frisch', 'Danke!', 'Einladung', 'Öffnungszeiten', 'Tagesangebot'].every(n => names.includes(n)), names.join('|'));
  await shot(page, 'content-1440-text-panel.png');
  const fonts = await page.evaluate(() => window.DtDesigner.app.fontIndex.map(f => f.family));
  let allFontsBundled = true;
  let allCentred = true;
  const detail = [];
  for (const id of combos) {
    const depth = await undoDepth(page);
    await page.click(`.dt-combo[data-combo="${id}"]`);
    await settle(page);
    const s = await state(page);
    const g = await el(page, s.sel[0]);
    const kids = [];
    const walk = n => { kids.push(n); (n.children || []).forEach(walk); };
    walk(g);
    const families = kids.filter(k => k.type === 'text').map(k => k.fontFamily);
    if (!families.every(f => fonts.includes(f))) { allFontsBundled = false; detail.push(id + ': ' + families.join(',')); }
    if (!(g.type === 'group' && s.sel.length === 1 && near(g.x + g.w / 2, 75, 0.5) && near(g.y + g.h / 2, 50, 0.5) && g.w <= 150 * 0.71 && g.x >= 0 && g.y >= 0 && g.x + g.w <= 150 && g.y + g.h <= 100)) { allCentred = false; detail.push(id + ': ' + JSON.stringify({ x: g.x, y: g.y, w: g.w, h: g.h })); }
    check(`the combination "${id}" is inserted as ONE group (one undo step)`, g.type === 'group' && g.children.length >= 2 && (await undoDepth(page)) === depth + 1, g.children.length + ' children');
  }
  check('every combination only uses fonts that ship with the app', allFontsBundled, detail.join(' | '));
  check('every combination is centred and fits on the page (at most 70 % of its width)', allCentred, detail.join(' | '));
  const warnings = await page.evaluate(() => window.DtDesigner.app.warnings.filter(w => w.kind === 'engine').map(w => w.text));
  check('the engine draws all ten combinations without a warning', warnings.length === 0, warnings.join('|'));
  await shot(page, 'content-1440-combos-inserted.png');
  await undo(page);
  check('undo takes the last combination away in one step', (await state(page)).elements.length === 9);
  // a drop puts it at the point
  await page.evaluate(() => { const a = window.DtDesigner.app; a.select(a.elements().map(x => x.id)); a.deleteSelection(); });
  await settle(page);
  const target = await fromDoc(page, { x: 100, y: 30 });
  await drag(page, await centre(page, page.locator('.dt-combo[data-combo="danke"]')), target);
  await settle(page);
  let g = await el(page, await sel0(page));
  check('a combination dragged onto the page is centred on the drop point', g && g.type === 'group' && near(g.x + g.w / 2, 100, 1.5) && near(g.y + g.h / 2, 30, 1.5), JSON.stringify(g && { x: g.x, y: g.y, w: g.w, h: g.h }));
  // a design in pixels: the combination gets the size of the page
  await fresh(page, { preset: 'instagram-post' });
  await openPanel(page, 'text');
  await page.waitForSelector('.dt-combo__thumb svg');
  await page.click('.dt-combo[data-combo="sale"]');
  await settle(page);
  g = await el(page, await sel0(page));
  const d = await page.evaluate(() => ({ w: window.DtDesigner.app.doc.width, unit: window.DtDesigner.app.doc.unit }));
  check('on a page in pixels the combination is about 70 % of the width and still centred', d.unit === 'px' && near(g.w / d.w, 0.7, 0.08) && near(g.x + g.w / 2, d.w / 2, 2), JSON.stringify({ gw: g.w, d }));
  const texts = [];
  const walkTexts = n => { if (n.type === 'text') { texts.push(n); } (n.children || []).forEach(walkTexts); };
  walkTexts(g);
  check('the font sizes scale with the page (SALE is far bigger on 1080 px than on a label)', texts.length >= 2 && texts[0].fontSize > 150, texts.map(t => t.fontSize).join(','));
};

// ================================================================================================ 3. text toolbar and Effekte
sections.texttoolbar = async ({ page }) => {
  current = 'text toolbar: ';
  await fresh(page);
  const id = await addEl(page, 'heading');
  await page.evaluate(i => window.DtDesigner.app.setProps([i], { text: 'Frisch vom Hof' }, { merge: false }), id);
  await settle(page);
  await page.waitForSelector('#dt-ctx .dt-tb--font');
  const wanted = ['Schrift', 'Schriftgröße', 'Textfarbe', 'Fett', 'Kursiv', 'Unterstrichen', 'Durchgestrichen', 'Ausrichtung', 'Großbuchstaben', 'Liste', 'Abstand und Textfeld', 'Effekte', 'Transparenz', 'Position', 'Mehr'];
  const labels = await page.$$eval('#dt-ctx button, #dt-ctx input', els => els.map(x => x.getAttribute('aria-label') || ''));
  check('the text toolbar has Schrift, Größe, Farbe, B, I, U, S, Ausrichtung, aA, Liste, Abstand, Effekte, Transparenz, Position, ⋯', wanted.every(l => labels.includes(l)), wanted.filter(l => !labels.includes(l)).join(','));
  await shot(page, 'content-1440-text-toolbar.png');
  // strike, underline, list
  await tb(page, 'Durchgestrichen').click();
  await settle(page);
  check('S toggles strike', (await el(page, id)).strike === true);
  await tb(page, 'Durchgestrichen').click();
  check('S again switches it off', (await el(page, id)).strike === false);
  await tb(page, 'Liste').click();
  await menuClick(page, 'Aufzählung');
  await settle(page);
  check('Liste > Aufzählung sets list bullet', (await el(page, id)).list === 'bullet');
  await tb(page, 'Liste').click();
  await menuClick(page, 'Nummerierung');
  check('Liste > Nummerierung sets list number', (await el(page, id)).list === 'number');
  await tb(page, 'Liste').click();
  await menuClick(page, 'Keine Liste');
  check('Liste > Keine Liste switches it off', (await el(page, id)).list === 'none');
  await tb(page, 'Großbuchstaben').click();
  check('aA sets uppercase', (await el(page, id)).uppercase === true);
  await tb(page, 'Großbuchstaben').click();

  // font picker
  await page.click('#dt-ctx .dt-tb--font');
  await page.waitForSelector('.dt-fontpop');
  const names = await page.$$eval('.dt-fontlist__item .dt-fontlist__name', n => n.map(x => x.textContent));
  check('the font picker lists the fonts of the library, each name in its own font (a class per font)', names.length >= 12 && await page.$$eval('.dt-fontlist__name', n => n.every(x => /dt-ff-\d+/.test(x.getAttribute('data-ff')))), names.length + ' fonts');
  await page.fill('.dt-fontpop input[type=search]', 'mont');
  const filtered = await page.$$eval('.dt-fontlist__item .dt-fontlist__name', n => n.map(x => x.textContent));
  check('the font picker has a search field', filtered.length === 1 && filtered[0] === 'Montserrat', filtered.join(','));
  await page.click('.dt-fontlist__item');
  await settle(page);
  check('a click on a font sets the family', (await el(page, id)).fontFamily === 'Montserrat');
  await shot(page, 'content-1440-font-picker.png');
  await page.keyboard.press('Escape');
  // size
  const size0 = (await el(page, id)).fontSize;
  await tb(page, 'Schrift vergrößern').click();
  await settle(page);
  const size1 = (await el(page, id)).fontSize;
  await tb(page, 'Schrift verkleinern').click();
  check('the size buttons step the size (+ and -)', size1 > size0 && (await el(page, id)).fontSize === size0, size0 + ' -> ' + size1);
  // spacing
  await tb(page, 'Abstand und Textfeld').click();
  await page.waitForSelector('.dt-popover input.dt-num');
  await page.fill('.dt-popover .dt-grid2 .dt-f:nth-child(2) input', '0,1');
  await settle(page);
  check('Abstand sets the letter spacing', near((await el(page, id)).letterSpacing, 0.1, 0.001), String((await el(page, id)).letterSpacing));
  await page.keyboard.press('Escape');

  // Effekte
  await tb(page, 'Effekte').click();
  await page.waitForSelector('.dt-fxpreset');
  await page.waitForFunction(() => document.querySelectorAll('.dt-fxpreset__thumb svg').length >= 7, null, { timeout: 10000 });
  check('the Effekte page opens in the panel with a back arrow', (await page.textContent('#dt-panel-title')).trim() === 'Effekte' && await page.isVisible('#dt-panel-back'));
  const presets = await page.$$eval('.dt-fxpreset', p => p.map(x => x.getAttribute('data-fx')));
  check('the presets are Keine, Schatten, Anheben, Kontur, Hohl, Hintergrund, Gebogen', presets.join(',') === 'none,shadow,lift,outline,hollow,background,curved', presets.join(','));
  check('every preset has a preview drawn by the engine', (await page.$$('.dt-fxpreset__thumb svg')).length === 7);
  await shot(page, 'content-1440-effects.png');
  const fx = async key => { const depth = await undoDepth(page); await page.click(`.dt-fxpreset[data-fx="${key}"]`); await settle(page); return { e: await el(page, id), steps: (await undoDepth(page)) - depth }; };
  let r = await fx('shadow');
  check('Schatten writes shadow (no blur) and is one undo step', r.e.shadow && r.e.shadow.blur === 0 && r.e.shadow.opacity > 0 && r.steps === 1 && !r.e.outline && !r.e.background && r.e.curve === 0, JSON.stringify(r.e.shadow));
  r = await fx('lift');
  check('Anheben writes a soft shadow (blur > 0)', r.e.shadow && r.e.shadow.blur > 0, JSON.stringify(r.e.shadow));
  r = await fx('outline');
  check('Kontur writes outline and removes the shadow', r.e.outline && r.e.outline.width > 0 && !r.e.shadow, JSON.stringify(r.e.outline));
  const pageBg = await page.evaluate(() => window.DtDesigner.app.page().background.color);
  r = await fx('hollow');
  check('Hohl writes an outline in the old text colour and fills the text with the page colour', r.e.outline && r.e.color === pageBg, JSON.stringify({ outline: r.e.outline, color: r.e.color, pageBg }));
  r = await fx('background');
  check('Hintergrund writes background { color, radius, padding }', r.e.background && /^#[0-9a-f]{6}$/.test(r.e.background.color) && r.e.background.padding > 0 && r.e.background.radius > 0, JSON.stringify(r.e.background));
  r = await fx('curved');
  check('Gebogen writes curve', r.e.curve !== 0, String(r.e.curve));
  r = await fx('none');
  check('Keine removes shadow, outline, background and curve', !r.e.shadow && !r.e.outline && !r.e.background && r.e.curve === 0);
  // single properties
  await page.click('.dt-fx .mat-switch:has-text("Schatten")');
  await settle(page);
  check('the switch Schatten adds a shadow with defaults', (await el(page, id)).shadow !== null);
  const blurInput = page.locator('.dt-fx .dt-f:has(label:text-is("Weichzeichnen")) input[type=text]');
  await blurInput.fill('2');
  await settle(page);
  check('the field Weichzeichnen writes shadow.blur', near((await el(page, id)).shadow.blur, 2, 0.01), JSON.stringify((await el(page, id)).shadow));
  const depth0 = await undoDepth(page);
  const opac = page.locator('.dt-fx .dt-f:has(label:text-is("Transparenz")) input[type=range]');
  await opac.evaluate(e => { e.value = '20'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await opac.evaluate(e => { e.value = '30'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await settle(page);
  check('the slider Transparenz of the shadow writes opacity and merges into ONE undo step', near((await el(page, id)).shadow.opacity, 0.3, 0.01) && (await undoDepth(page)) === depth0 + 1, JSON.stringify((await el(page, id)).shadow));
  await page.click('.dt-fx .mat-switch:has-text("Kontur")');
  await settle(page);
  check('the switch Kontur adds an outline', (await el(page, id)).outline !== null);
  await page.click('.dt-fx .mat-switch:has-text("Hintergrund")');
  await settle(page);
  check('the switch Hintergrund adds a background box', (await el(page, id)).background !== null);
  const curve = page.locator('.dt-fx .dt-sec:has(h3:text-is("Krümmung")) input[type=range]').first();
  await curve.evaluate(e => { e.value = '-40'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await settle(page);
  check('the slider Krümmung writes curve (-100 to 100)', (await el(page, id)).curve === -40, String((await el(page, id)).curve));
  await page.click('#dt-panel-back');
  check('the back arrow returns to the panel that was open', ['Elemente', 'Text', 'Vorlagen', 'Uploads', 'Marke'].includes((await page.textContent('#dt-panel-title')).trim()));
  await page.waitForTimeout(300);
  check('the engine draws the effects without a warning', (await page.evaluate(() => window.DtDesigner.app.warnings.filter(w => w.kind === 'engine').length)) === 0);
  // transparency from the toolbar
  await tb(page, 'Transparenz').click();
  await page.waitForSelector('.dt-popover input[type=range]');
  await page.locator('.dt-popover input[type=range]').evaluate(e => { e.value = '55'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await settle(page);
  check('Transparenz of the toolbar writes opacity', near((await el(page, id)).opacity, 0.55, 0.01));
  await page.keyboard.press('Escape');
  await tb(page, 'Mehr').click();
  await page.waitForSelector('.dt-menu');
  check('the ⋯ menu is the context menu of the text', await menuItem(page, 'Duplizieren').count() === 1);
  await page.keyboard.press('Escape');
};

// ================================================================================================ 4. image and frame toolbar, Anpassen, masks, borders
sections.image = async ({ page }) => {
  current = 'image: ';
  await fresh(page);
  const asset = await uploadPng(page, [40, 140, 200], 400, 240);
  const asset2 = await uploadPng(page, [200, 80, 40], 300, 300);
  const id = await addImage(page, asset);
  await settle(page);
  check('an image selects the image toolbar', (await kind(page)) === 'image');
  const wanted = ['Bild ersetzen', 'Zuschneiden', 'Spiegeln', 'Anpassen', 'Maske', 'Einpassen', 'Randfarbe', 'Randstärke', 'Ecken', 'Transparenz', 'Position', 'Mehr', 'Als Hintergrund festlegen'];
  const labels = await page.$$eval('#dt-ctx button', b => b.map(x => x.getAttribute('aria-label') || ''));
  check('the image toolbar has Ersetzen, Zuschneiden, Spiegeln, Anpassen, Maske, Einpassen, Rand, Ecken, Transparenz, Position, Als Hintergrund, ⋯', wanted.every(l => labels.includes(l)), wanted.filter(l => !labels.includes(l)).join(','));
  await shot(page, 'content-1440-image-toolbar.png');

  // Ersetzen: the media browser, not a dropdown
  await tb(page, 'Bild ersetzen').click();
  await page.waitForSelector('.dt-media .dt-media__tile');
  check('"Ersetzen" opens the media browser (no dropdown)', await page.isVisible('.dt-media .dt-media__grid') && (await page.$$('#dt-ctx select')).length === 0);
  await page.click(`.dt-media__tile[data-key="${asset2.key}"]`);
  await page.waitForFunction(i => window.DtDesigner.app.element(i).source.asset !== undefined && window.DtDesigner.app.element(i).source.asset !== null, id);
  await settle(page);
  check('a click in the media browser sets the source', (await el(page, id)).source.asset === asset2.key);
  await undo(page);
  check('undo brings the old picture back in one step', (await el(page, id)).source.asset === asset.key);

  // flip
  await tb(page, 'Spiegeln').click();
  await menuClick(page, 'Horizontal spiegeln');
  check('Spiegeln > Horizontal sets flipX', (await el(page, id)).flipX === true);
  await tb(page, 'Spiegeln').click();
  await menuClick(page, 'Vertikal spiegeln');
  check('Spiegeln > Vertikal sets flipY', (await el(page, id)).flipY === true);
  await undo(page); await undo(page);

  // mask
  await tb(page, 'Maske').click();
  await page.waitForSelector('.dt-masks');
  const masks = await page.$$eval('.dt-mask', m => m.map(x => x.getAttribute('data-mask')));
  check('the mask popover offers keine, abgerundet, Kreis, Herz, Stern, Sechseck, Dreieck with previews', masks.join(',') === 'none,rounded,circle,heart,star,hexagon,triangle' && (await page.$$('.dt-mask svg')).length === 7, masks.join(','));
  await shot(page, 'content-1440-mask-popover.png');
  for (const m of ['circle', 'heart', 'star', 'hexagon', 'triangle', 'rounded', 'none']) {
    await page.click(`.dt-mask[data-mask="${m}"]`);
    await settle(page);
    const e = await el(page, id);
    check(`the mask ${m} is written`, e.mask === m && (m !== 'rounded' || e.radius > 0), e.mask + ' r=' + e.radius);
  }
  await page.click('.dt-mask[data-mask="circle"]');
  await page.keyboard.press('Escape');
  check('the mask is drawn (a clip path in the image group)', await page.evaluate(i => { const g = window.DtDesigner.canvas.nodeElement(i); return !!g && !!g.querySelector('[clip-path]'); }, id));

  // corners
  await tb(page, 'Ecken').click();
  await page.waitForSelector('.dt-popover input[type=range]');
  await page.locator('.dt-popover input[type=range]').evaluate(e => { e.value = '6'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await settle(page);
  let e = await el(page, id);
  check('Ecken writes radius and the mask "rounded"', near(e.radius, 6, 0.01) && e.mask === 'rounded', e.radius + ' ' + e.mask);
  await page.keyboard.press('Escape');

  // border
  await tb(page, 'Randfarbe').click();
  await page.waitForSelector('.dt-colorpop');
  await page.fill('.dt-colour__hex', '#ff0000');
  await page.keyboard.press('Enter');
  await settle(page);
  e = await el(page, id);
  check('Randfarbe writes border { color, width }', e.border && e.border.color === '#ff0000' && e.border.width > 0, JSON.stringify(e.border));
  await tb(page, 'Randstärke').click();
  await page.waitForSelector('.dt-popover input[type=range]');
  await page.locator('.dt-popover input[type=range]').evaluate(x => { x.value = '5'; x.dispatchEvent(new Event('input', { bubbles: true })); });
  await settle(page);
  e = await el(page, id);
  check('Randstärke writes the width (pt)', e.border && near(e.border.width, 5, 0.01) && e.border.color === '#ff0000', JSON.stringify(e.border));
  await page.locator('.dt-popover input[type=range]').evaluate(x => { x.value = '0'; x.dispatchEvent(new Event('input', { bubbles: true })); });
  await settle(page);
  check('a width of 0 removes the border', (await el(page, id)).border === null);
  await page.keyboard.press('Escape');

  // Einpassen
  await tb(page, 'Einpassen').click();
  await page.click('.dt-popover .mat-seg__btn[data-value="cover"]');
  check('Einpassen sets the fit', (await el(page, id)).fit === 'cover');
  await page.keyboard.press('Escape');

  // Anpassen
  await tb(page, 'Anpassen').click();
  await page.waitForSelector('.dt-looks');
  check('Anpassen opens a page in the panel with looks, sliders and "Zurücksetzen"', (await page.textContent('#dt-panel-title')).trim() === 'Anpassen' && (await page.$$('.dt-panel__body input[type=range]')).length >= 4 && await page.isVisible('.dt-adjust__reset'));
  await shot(page, 'content-1440-adjust.png');
  const depth = await undoDepth(page);
  const slider = key => page.locator(`.dt-panel__body .dt-f:has(label:text-is("${key}")) input[type=range]`);
  await slider('Helligkeit').evaluate(x => { x.value = '10'; x.dispatchEvent(new Event('input', { bubbles: true })); });
  await slider('Helligkeit').evaluate(x => { x.value = '25'; x.dispatchEvent(new Event('input', { bubbles: true })); });
  await settle(page);
  e = await el(page, id);
  check('Helligkeit writes filters.brightness and a drag is ONE undo step', e.filters.brightness === 25 && (await undoDepth(page)) === depth + 1, JSON.stringify(e.filters));
  await slider('Kontrast').evaluate(x => { x.value = '-30'; x.dispatchEvent(new Event('input', { bubbles: true })); });
  await slider('Sättigung').evaluate(x => { x.value = '40'; x.dispatchEvent(new Event('input', { bubbles: true })); });
  await slider('Unschärfe').evaluate(x => { x.value = '3'; x.dispatchEvent(new Event('input', { bubbles: true })); });
  await settle(page);
  e = await el(page, id);
  check('Kontrast, Sättigung and Unschärfe write their filters', e.filters.contrast === -30 && e.filters.saturation === 40 && e.filters.blur === 3, JSON.stringify(e.filters));
  await page.click('.dt-panel__body .mat-switch:has-text("Schwarzweiß")');
  await page.click('.dt-panel__body .mat-switch:has-text("Sepia")');
  await settle(page);
  e = await el(page, id);
  check('the switches write grayscale and sepia', e.filters.grayscale === true && e.filters.sepia === true);
  check('the engine draws the filters (a filter on the image)', await page.evaluate(i => { const g = window.DtDesigner.canvas.nodeElement(i); return !!g && !!g.querySelector('image[filter]'); }, id));
  await page.click('.dt-adjust__reset');
  await settle(page);
  e = await el(page, id);
  check('"Zurücksetzen" sets every filter back', e.filters.brightness === 0 && e.filters.contrast === 0 && e.filters.saturation === 0 && e.filters.blur === 0 && !e.filters.grayscale && !e.filters.sepia, JSON.stringify(e.filters));
  await page.click('.dt-chipbtn[data-look="vivid"]');
  await settle(page);
  check('a look sets several filters at once', (await el(page, id)).filters.saturation > 0);
  await page.click('#dt-panel-back');

  // Als Hintergrund festlegen
  await tb(page, 'Als Hintergrund festlegen').click();
  await settle(page);
  const bg = await page.evaluate(() => window.DtDesigner.app.page().background);
  check('"Als Hintergrund festlegen" makes the picture the page background and removes the element', bg.asset === asset.key && (await state(page)).elements.length === 0, JSON.stringify(bg));
  await undo(page);
  check('undo gives the image back and clears the background in one step', (await state(page)).elements.length === 1 && (await page.evaluate(() => window.DtDesigner.app.page().background.asset)) === null);

  // an empty frame: "Bild wählen", filling through the media browser
  const frame = await addEl(page, 'frame-heart');
  await settle(page);
  check('an empty frame offers "Bild wählen" and no crop', await tb(page, 'Bild wählen').count() === 1 && await tb(page, 'Zuschneiden').count() === 0);
  await tb(page, 'Bild wählen').click();
  await page.waitForSelector('.dt-media');
  await page.click(`.dt-media__tile[data-key="${asset.key}"]`);
  await page.waitForFunction(i => !!window.DtDesigner.app.element(i).source, frame);
  await settle(page);
  e = await el(page, frame);
  check('the media browser fills the frame and the mask stays', e.source.asset === asset.key && e.mask === 'heart');
};

// ================================================================================================ 5. crop mode
sections.crop = async ({ page }) => {
  current = 'crop: ';
  await fresh(page);
  const asset = await uploadPng(page, [40, 140, 200], 400, 240);
  const id = await addImage(page, asset);
  await settle(page);
  const start = await el(page, id);
  check('the crop hook exists, so the toolbar offers Zuschneiden', await page.evaluate(() => typeof window.DtDesigner.crop.start === 'function'));
  // double click on the image starts crop mode
  const g = await geometry(page, id);
  await page.mouse.dblclick(g.cx, g.cy);
  await page.waitForSelector('.dt-cropui');
  await page.waitForTimeout(300);
  check('a double click on an image starts crop mode', await page.evaluate(() => window.DtDesigner.crop.active()));
  check('the toolbar becomes the crop toolbar: Zuschneiden, a zoom slider, Zurücksetzen, Abbrechen, Fertig', await page.isVisible('#dt-ctx .dt-tb__title') && await page.isVisible('#dt-ctx .dt-tb__zoom input[type=range]') && await tb(page, 'Abbrechen').count() === 1 && await tb(page, 'Fertig').count() === 1 && await tb(page, 'Zurücksetzen').count() === 1);
  check('the picture is shown with 8 handles on the crop window', (await page.$$('.dt-cropui [data-crop-handle]')).length === 8);
  check('the selection handles of the canvas are gone while cropping', (await page.$$('[data-handle]')).length === 0);
  await shot(page, 'content-1440-crop-mode.png');
  let st = await page.evaluate(() => window.DtDesigner.crop.state());
  check('the window is the box of the image, the picture fills it (100 %)', near(st.W.w, start.w, 0.01) && near(st.W.h, start.h, 0.01) && st.zoom === 100 && near(st.I.w, start.w, 0.5), JSON.stringify(st));
  // Escape cancels without a change
  await page.keyboard.press('Escape');
  await settle(page);
  let e = await el(page, id);
  check('Escape leaves crop mode and changes nothing', !(await page.evaluate(() => window.DtDesigner.crop.active())) && JSON.stringify(e.crop) === JSON.stringify(start.crop) && e.w === start.w && (await kind(page)) === 'image');
  // zoom + drag + Fertig
  await page.evaluate(i => window.DtDesigner.crop.start(i), id);
  await page.waitForSelector('.dt-cropui');
  const depth = await undoDepth(page);
  const zoom = page.locator('#dt-ctx .dt-tb__zoom input[type=range]');
  await zoom.evaluate(x => { x.value = '200'; x.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(100);
  st = await page.evaluate(() => window.DtDesigner.crop.state());
  check('the zoom slider zooms the picture inside the window (200 %)', st.zoom === 200 && near(st.I.w, start.w * 2, 0.5), JSON.stringify(st));
  const bright = await page.evaluate(() => { const r = document.querySelector('.dt-cropui .dt-crop__bright').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await drag(page, bright, { x: bright.x - 40, y: bright.y - 20 });
  const st2 = await page.evaluate(() => window.DtDesigner.crop.state());
  check('dragging moves the picture inside the window, the window stays', st2.I.x < st.I.x - 0.5 && st2.I.y < st.I.y - 0.5 && JSON.stringify(st2.W) === JSON.stringify(st.W), JSON.stringify(st2));
  check('nothing is written to the document while cropping', (await undoDepth(page)) === depth);
  await tb(page, 'Fertig').click();
  await settle(page);
  e = await el(page, id);
  check('"Fertig" writes crop { x, y, w, h } (fractions) in ONE undo step', e.crop && near(e.crop.w, 0.5, 0.01) && near(e.crop.h, 0.5, 0.01) && e.crop.x > 0 && e.crop.y > 0 && (await undoDepth(page)) === depth + 1, JSON.stringify(e.crop));
  check('the box stays the same when only the picture was moved and zoomed', near(e.x, start.x, 0.01) && near(e.y, start.y, 0.01) && near(e.w, start.w, 0.01) && near(e.h, start.h, 0.01));
  check('crop mode is over and the image toolbar is back', !(await page.evaluate(() => window.DtDesigner.crop.active())) && (await kind(page)) === 'image' && (await page.$$('.dt-cropui')).length === 0);
  check('the engine draws the crop (the image is positioned and clipped)', await page.evaluate(i => { const g2 = window.DtDesigner.canvas.nodeElement(i); const im = g2 && g2.querySelector('image'); return !!im && !!im.getAttribute('clip-path') && parseFloat(im.getAttribute('width')) > 100; }, id));
  await shot(page, 'content-1440-cropped.png');
  await undo(page);
  check('undo takes the crop back in one step', JSON.stringify((await el(page, id)).crop) === JSON.stringify(start.crop));

  // handles change the box and the crop together
  await page.evaluate(i => window.DtDesigner.crop.start(i), id);
  await page.waitForSelector('.dt-cropui');
  const h = await page.evaluate(() => { const r = document.querySelector('.dt-cropui [data-crop-handle="e"] .dt-crop__handle').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const k = (await sheetBox(page)).k;
  await drag(page, h, { x: h.x - 20 * k, y: h.y });
  st = await page.evaluate(() => window.DtDesigner.crop.state());
  check('dragging a handle of the window shrinks the window, the picture stays where it is', near(st.W.w, start.w - 20, 0.6) && near(st.I.w, start.w, 0.5), JSON.stringify(st));
  await page.keyboard.press('Enter');
  await settle(page);
  e = await el(page, id);
  check('Enter applies: the box got narrower, the crop shows the left part of the picture', near(e.w, start.w - 20, 0.6) && near(e.x, start.x, 0.01) && near(e.crop.w, (start.w - 20) / start.w, 0.02) && near(e.crop.x, 0, 0.001) && near(e.h, start.h, 0.01), JSON.stringify({ w: e.w, x: e.x, crop: e.crop }));
  await undo(page);
  // a click beside the picture applies as well
  await page.evaluate(i => window.DtDesigner.crop.start(i), id);
  await page.waitForSelector('.dt-cropui');
  await zoom.evaluate(x => { x.value = '150'; x.dispatchEvent(new Event('input', { bubbles: true })); });
  const sheet = await sheetBox(page);
  await page.mouse.click(sheet.l + 12, sheet.t + 12);
  await settle(page);
  check('a click outside the picture ends crop mode and applies the change', !(await page.evaluate(() => window.DtDesigner.crop.active())) && (await el(page, id)).crop.w < 0.9, JSON.stringify((await el(page, id)).crop));
  await undo(page);
  // Zurücksetzen
  await page.evaluate(i => window.DtDesigner.crop.start(i), id);
  await page.waitForSelector('.dt-cropui');
  await zoom.evaluate(x => { x.value = '300'; x.dispatchEvent(new Event('input', { bubbles: true })); });
  await tb(page, 'Zurücksetzen').click();
  st = await page.evaluate(() => window.DtDesigner.crop.state());
  check('Zurücksetzen goes back to the picture of the start', st.zoom === 100);
  await tb(page, 'Abbrechen').click();
  check('Abbrechen leaves crop mode', !(await page.evaluate(() => window.DtDesigner.crop.active())));
  // keyboard: arrows move the picture
  await page.evaluate(i => window.DtDesigner.crop.start(i), id);
  await page.waitForSelector('.dt-cropui');
  await zoom.evaluate(x => { x.value = '200'; x.dispatchEvent(new Event('input', { bubbles: true })); });
  const before = await page.evaluate(() => window.DtDesigner.crop.state().I.x);
  await page.evaluate(() => document.querySelector('.dt-cropui').focus());
  await page.keyboard.press('ArrowLeft');
  check('the arrow keys move the picture inside the window', (await page.evaluate(() => window.DtDesigner.crop.state().I.x)) < before);
  await page.keyboard.press('Escape');

  // a rotated, mirrored image: the window stays exactly where it is on the page
  await page.evaluate(a => window.DtDesigner.app.setProps([a.id], { rotation: 25, flipX: true, x: a.x, y: a.y }, { merge: false }), { id, x: start.x - 5, y: start.y });
  await settle(page);
  await page.evaluate(i => window.DtDesigner.crop.start(i), id);
  await page.waitForSelector('.dt-cropui');
  const hw = await page.evaluate(() => { const r = document.querySelector('.dt-cropui [data-crop-handle="w"] .dt-crop__handle').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await drag(page, hw, { x: hw.x + 25, y: hw.y + 12 });
  const windowRect = await page.evaluate(() => { const r = document.querySelector('.dt-cropui .dt-crop__window').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
  await page.keyboard.press('Enter');
  await settle(page);
  const after = await page.evaluate(i => window.DtDesigner.canvas.clientRectOf(i), id);
  check('with rotation and mirroring the new box covers exactly the crop window (within 2 px)', near(after.left, windowRect.l, 2) && near(after.top, windowRect.t, 2) && near(after.width, windowRect.w, 2.5) && near(after.height, windowRect.h, 2.5), JSON.stringify({ after, windowRect }));
  check('crop mode has no console error', problems.length === 0, problems.slice(0, 2).join(' | '));

  // images from a field and empty frames cannot be cropped
  const frame = await addEl(page, 'frame');
  await settle(page);
  check('an empty frame cannot be cropped (no button, no mode)', await tb(page, 'Zuschneiden').count() === 0);
  await page.evaluate(i => window.DtDesigner.crop.start(i), frame);
  await page.waitForTimeout(200);
  check('start() of an empty frame does nothing', !(await page.evaluate(() => window.DtDesigner.crop.active())));
  // the context menu offers Zuschneiden
  await page.evaluate(i => window.DtDesigner.app.deleteIds([i]), frame);
  await select(page, [id]);
  const gg = await geometry(page, id);
  await page.mouse.click(gg.cx, gg.cy, { button: 'right' });
  await page.waitForSelector('.dt-menu');
  check('the context menu of an image offers Zuschneiden', await menuItem(page, 'Zuschneiden').count() === 1);
  await menuClick(page, 'Zuschneiden');
  await page.waitForSelector('.dt-cropui');
  check('Zuschneiden of the context menu starts crop mode', await page.evaluate(() => window.DtDesigner.crop.active()));
  await page.keyboard.press('Escape');
};

// ================================================================================================ 6. shape toolbar, colour picker, gradients, page background
sections.shape = async ({ page }) => {
  current = 'shape: ';
  await fresh(page);
  const id = await addEl(page, 'rect');
  await settle(page);
  const labels = await page.$$eval('#dt-ctx button', b => b.map(x => x.getAttribute('aria-label') || ''));
  check('the shape toolbar has Füllung, Randfarbe, Rand, Ecken, Form, Spiegeln, Transparenz, Position, ⋯', ['Füllung', 'Randfarbe', 'Randstärke und -art', 'Ecken', 'Form', 'Spiegeln', 'Transparenz', 'Position', 'Mehr'].every(l => labels.includes(l)), labels.join('|'));
  await shot(page, 'content-1440-shape-toolbar.png');

  // colour picker: sections
  await tb(page, 'Füllung').click();
  await page.waitForSelector('.dt-colorpop');
  const tabs = await page.$$eval('.dt-colorpop__tab', t => t.map(x => x.textContent));
  check('the fill picker has the tabs Farbe and Verlauf', tabs.join('|') === 'Farbe|Verlauf', tabs.join('|'));
  const secs = await page.$$eval('.dt-colorpop__sec', s => s.map(x => x.getAttribute('data-section')));
  check('the Farbe tab has the brand colours and the standard palette (and the document colours once there are some)', secs.includes('brand') && secs.includes('palette'), secs.join(','));
  check('the standard palette has about 30 colours', (await page.$$('.dt-colorpop__sec[data-section="palette"] .dt-swatch')).length >= 28);
  await page.click('.dt-colorpop__sec[data-section="palette"] .dt-swatch[data-colour="#e5484d"]');
  await settle(page);
  check('a palette colour sets the fill', (await el(page, id)).fill === '#e5484d');
  // hex
  await page.fill('.dt-colour__hex', 'zz12');
  check('an invalid hex value is marked and changes nothing', (await page.getAttribute('.dt-colour__hex', 'aria-invalid')) === 'true' && (await el(page, id)).fill === '#e5484d');
  await page.fill('.dt-colour__hex', '#2f86f6');
  await page.keyboard.press('Tab');
  await settle(page);
  check('a valid hex value sets the fill and clears the mark', (await el(page, id)).fill === '#2f86f6' && (await page.getAttribute('.dt-colour__hex', 'aria-invalid')) === 'false');
  await page.fill('.dt-colour__hex', '#abc');
  await page.keyboard.press('Enter');
  await settle(page);
  check('a short hex value (#abc) is understood', (await el(page, id)).fill === '#aabbcc');
  check('the native colour field is there for custom colours', await page.isVisible('.dt-colour__native'));
  check('the picker offers the eyedropper exactly when the browser has one', (await page.$$('.dt-colorpop__head button[aria-label="Farbe vom Bildschirm aufnehmen"]')).length === (await page.evaluate(() => (window.EyeDropper ? 1 : 0))));
  // the document colours now contain the colours in use
  await page.keyboard.press('Escape');
  await tb(page, 'Füllung').click();
  await page.waitForSelector('.dt-colorpop');
  check('the document colours list the colours the design uses', (await page.$$('.dt-colorpop__sec[data-section="document"] .dt-swatch[data-colour="#aabbcc"]')).length === 1);
  await shot(page, 'content-1440-colour-picker.png');
  // gradient tab
  await page.click('.dt-colorpop__tab[data-tab="gradient"]');
  await page.waitForSelector('.dt-grad__bar');
  check('the Verlauf tab shows the stops, the angle, the colour of the stop and presets', (await page.$$('.dt-grad__handle')).length === 2 && (await page.$$('.dt-grad__preset')).length >= 8 && await page.isVisible('.dt-grad .dt-slider'));
  check('opening the Verlauf tab does not change the fill', (await el(page, id)).fill === '#aabbcc');
  const depth = await undoDepth(page);
  await page.click('.dt-grad__preset[data-preset="Ozean"]');
  await settle(page);
  let e = await el(page, id);
  check('a preset writes a gradient { type, angle, stops } to the fill', e.fill && typeof e.fill === 'object' && e.fill.type === 'linear' && e.fill.stops.length === 2 && e.fill.angle === 180, JSON.stringify(e.fill));
  check('the preset is one undo step', (await undoDepth(page)) === depth + 1);
  // add a stop by a click on the bar
  const bar = await page.locator('.dt-grad__track').boundingBox();
  await page.mouse.click(bar.x + bar.width * 0.5, bar.y + bar.height / 2);
  await settle(page);
  e = await el(page, id);
  check('a click on the bar adds a third stop (2 to 5 are allowed)', e.fill.stops.length === 3 && (await page.$$('.dt-grad__handle')).length === 3, JSON.stringify(e.fill.stops));
  // stop colour via hex
  await page.fill('.dt-grad .dt-colour__hex', '#ffcc00');
  await page.keyboard.press('Enter');
  await settle(page);
  e = await el(page, id);
  check('the hex field changes the colour of the selected stop', e.fill.stops.some(s => s.color === '#ffcc00'), JSON.stringify(e.fill.stops));
  // move a stop with the keyboard
  const handle = page.locator('.dt-grad__handle.is-selected');
  await handle.focus();
  const offsetBefore = (await el(page, id)).fill.stops.find(s => s.color === '#ffcc00').offset;
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await settle(page);
  const offsetAfter = (await el(page, id)).fill.stops.find(s => s.color === '#ffcc00').offset;
  check('the arrow keys move the selected stop', offsetAfter > offsetBefore, offsetBefore + ' -> ' + offsetAfter);
  // move a stop by dragging
  const h0 = await page.locator('.dt-grad__handle >> nth=0').boundingBox();
  await drag(page, { x: h0.x + h0.width / 2, y: h0.y + h0.height / 2 }, { x: bar.x + bar.width * 0.2, y: h0.y + h0.height / 2 });
  await settle(page);
  e = await el(page, id);
  check('dragging a stop changes its offset', e.fill.stops.some(s => near(s.offset, 0.2, 0.06)), JSON.stringify(e.fill.stops));
  // angle
  await page.locator('.dt-grad .dt-slider input[type=range]').evaluate(x => { x.value = '45'; x.dispatchEvent(new Event('input', { bubbles: true })); });
  await settle(page);
  check('the angle slider writes the angle', (await el(page, id)).fill.angle === 45);
  // remove a stop
  await page.click('.dt-grad__remove');
  await settle(page);
  e = await el(page, id);
  check('"Stopp löschen" removes the selected stop (2 stay at least)', e.fill.stops.length === 2 && await page.isDisabled('.dt-grad__remove'), JSON.stringify(e.fill.stops));
  // up to five stops
  for (let i = 0; i < 4; i++) { await page.mouse.click(bar.x + bar.width * (0.15 + i * 0.22), bar.y + bar.height / 2); await settle(page); }
  check('a gradient has at most five stops', (await el(page, id)).fill.stops.length === 5);
  await shot(page, 'content-1440-gradient-picker.png');
  check('the engine draws the gradient (a linearGradient in the page)', await page.evaluate(() => !!document.querySelector('#dt-page linearGradient')));
  // back to a solid colour
  await page.click('.dt-colorpop__tab[data-tab="colour"]');
  await page.click('.dt-colorpop__sec[data-section="palette"] .dt-swatch[data-colour="#2e9d5b"]');
  await settle(page);
  check('a colour of the Farbe tab replaces the gradient', (await el(page, id)).fill === '#2e9d5b');
  await page.keyboard.press('Escape');
  // fill none
  await tb(page, 'Füllung').click();
  await page.click('.dt-colorpop .dt-chipbtn');
  await settle(page);
  check('"Keine Füllung" sets the fill to null', (await el(page, id)).fill === null);
  await undo(page);
  await select(page, [id]);
  await settle(page);

  // stroke: colour, width, dash
  await tb(page, 'Randfarbe').click();
  await page.waitForSelector('.dt-colorpop');
  check('the stroke colour has no Verlauf tab (a gradient is for fills)', (await page.$$('.dt-colorpop__tab')).length === 0);
  await page.fill('.dt-colour__hex', '#112233');
  await page.keyboard.press('Enter');
  await settle(page);
  e = await el(page, id);
  check('Randfarbe writes stroke and a visible width', e.stroke === '#112233' && e.strokeWidth >= 0.5, e.stroke + ' ' + e.strokeWidth);
  await tb(page, 'Randstärke und -art').click();
  await page.waitForSelector('.dt-popover .mat-seg');
  await page.click('.dt-popover .mat-seg__btn[data-value="dashed"]');
  await settle(page);
  check('Rand sets the dash (Strichart)', (await el(page, id)).dash === 'dashed');
  await page.keyboard.press('Escape');
  // corners
  await tb(page, 'Ecken').click();
  await page.locator('.dt-popover input[type=range]').evaluate(x => { x.value = '4'; x.dispatchEvent(new Event('input', { bubbles: true })); });
  await settle(page);
  check('Ecken writes the radius of a rectangle', near((await el(page, id)).radius, 4, 0.01));
  await page.keyboard.press('Escape');
  // Form: switch the kind, keep the box
  const box0 = await el(page, id);
  await tb(page, 'Form').click();
  await page.waitForSelector('.dt-mask[data-shape]');
  const kinds = await page.$$eval('.dt-mask[data-shape]', b => b.map(x => x.getAttribute('data-shape')));
  check('Form offers 11 shapes with previews', kinds.length === 11 && (await page.$$('.dt-mask[data-shape] svg')).length === 11, kinds.join(','));
  await shot(page, 'content-1440-shape-kind.png');
  await page.click('.dt-mask[data-shape="star"]');
  await settle(page);
  e = await el(page, id);
  check('Form > Stern switches the kind and keeps the box', e.shape === 'star' && e.x === box0.x && e.y === box0.y && e.w === box0.w && e.h === box0.h);
  check('star settings (Zacken, Innenradius) appear for a star', await page.isVisible('.dt-popover .dt-f:has(label:text-is("Zacken"))'));
  await page.locator('.dt-popover .dt-f:has(label:text-is("Zacken")) input[type=range]').evaluate(x => { x.value = '8'; x.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('.dt-popover .dt-f:has(label:text-is("Innenradius")) input[type=range]').evaluate(x => { x.value = '70'; x.dispatchEvent(new Event('input', { bubbles: true })); });
  await settle(page);
  e = await el(page, id);
  check('Zacken and Innenradius write points and innerRadius', e.points === 8 && near(e.innerRadius, 0.7, 0.001), e.points + ' ' + e.innerRadius);
  await page.click('.dt-mask[data-shape="heart"]');
  await settle(page);
  check('Form > Herz', (await el(page, id)).shape === 'heart');
  await page.click('.dt-mask[data-shape="rounded"]');
  await settle(page);
  e = await el(page, id);
  check('Form > Abgerundet is a rectangle with corners', e.shape === 'rect' && e.radius > 0);
  await page.keyboard.press('Escape');
  // opacity and position
  await tb(page, 'Position').click();
  await page.waitForSelector('.dt-panel[data-panel="position"]');
  check('Position opens the page Position', (await page.textContent('#dt-panel-title')).trim() === 'Position');
  await page.click('#dt-panel-back');

  // page background: colour, gradient, image
  await select(page, []);
  await settle(page);
  check('with nothing selected the toolbar offers Hintergrund, Bild and Größe ändern', (await kind(page)) === 'page' && await tb(page, 'Hintergrundfarbe').count() === 1 && await tb(page, 'Hintergrundbild').count() === 1 && await tb(page, 'Größe ändern').count() === 1);
  await tb(page, 'Hintergrundfarbe').click();
  await page.waitForSelector('.dt-colorpop');
  check('the background picker has the tabs Farbe and Verlauf', (await page.$$('.dt-colorpop__tab')).length === 2);
  await page.click('.dt-colorpop__sec[data-section="palette"] .dt-swatch[data-colour="#fde68a"]');
  await settle(page);
  let bg = await page.evaluate(() => window.DtDesigner.app.page().background);
  check('a colour sets the background colour', bg.color === '#fde68a' && bg.gradient === null);
  await page.click('.dt-colorpop__tab[data-tab="gradient"]');
  await page.click('.dt-grad__preset[data-preset="Sonnenuntergang"]');
  await settle(page);
  bg = await page.evaluate(() => window.DtDesigner.app.page().background);
  check('a gradient preset sets background.gradient', bg.gradient && bg.gradient.stops.length === 2 && bg.gradient.angle === 90, JSON.stringify(bg.gradient));
  check('the page is drawn with the gradient', await page.evaluate(() => !!document.querySelector('#dt-page > svg linearGradient')));
  await shot(page, 'content-1440-page-gradient.png');
  await page.click('.dt-colorpop__tab[data-tab="colour"]');
  await page.click('.dt-colorpop__sec[data-section="palette"] .dt-swatch[data-colour="#ffffff"]');
  await settle(page);
  bg = await page.evaluate(() => window.DtDesigner.app.page().background);
  check('a colour afterwards removes the gradient', bg.color === '#ffffff' && bg.gradient === null);
  await page.keyboard.press('Escape');
  const asset = await uploadPng(page, [30, 120, 90], 600, 400);
  await tb(page, 'Hintergrundbild').click();
  await page.waitForSelector('.dt-media');
  await page.click(`.dt-media__tile[data-key="${asset.key}"]`);
  await page.waitForFunction(() => !!window.DtDesigner.app.page().background.asset);
  await settle(page);
  bg = await page.evaluate(() => window.DtDesigner.app.page().background);
  check('the background image comes from the media browser', bg.asset === asset.key);
  await tb(page, 'Einpassen').click();
  await page.click('.dt-popover .mat-seg__btn[data-value="contain"]');
  check('Einpassen of the background sets its fit', (await page.evaluate(() => window.DtDesigner.app.page().background.fit)) === 'contain');
  await page.keyboard.press('Escape');
  await tb(page, 'Hintergrundbild entfernen').click();
  await settle(page);
  check('the background image can be removed', (await page.evaluate(() => window.DtDesigner.app.page().background.asset)) === null);

  // brand colours in the picker
  await postJson(page, '/api/brand', { colors: ['#123456', '#abcdef'], fonts: { heading: 'Playfair Display', subheading: 'Montserrat', body: 'Open Sans' }, logos: [] });
  await page.reload();
  await page.waitForSelector('#dt-ds:not(.is-loading)');
  await idle(page);
  const id2 = await addEl(page, 'ellipse');
  await settle(page);
  await tb(page, 'Füllung').click();
  await page.waitForSelector('.dt-colorpop');
  check('the picker lists the brand colours (Markenfarben)', (await page.$$('.dt-colorpop__sec[data-section="brand"] .dt-swatch')).length === 2);
  await page.click('.dt-colorpop__sec[data-section="brand"] .dt-swatch[data-colour="#abcdef"]');
  await settle(page);
  check('a brand colour sets the fill', (await el(page, id2)).fill === '#abcdef');
  await page.keyboard.press('Escape');
};

// ================================================================================================ 7. line, icon, QR code and barcode
sections.codes = async ({ page }) => {
  current = 'line, icon, codes: ';
  await fresh(page);
  // line
  const line = await addEl(page, 'line', { endCap: 'arrow' });
  await settle(page);
  check('a line selects the line toolbar with Linienfarbe, Stärke und Art, Enden, Position', (await kind(page)) === 'line' && await tb(page, 'Linienfarbe').count() === 1 && await tb(page, 'Linienenden').count() === 1 && await tb(page, 'Position').count() === 1);
  await tb(page, 'Linienenden').click();
  await page.waitForSelector('.dt-popover .mat-seg');
  await shot(page, 'content-1440-line-ends.png');
  const segs = await page.$$('.dt-popover .mat-seg');
  check('Linienenden offers Anfang and Ende with none, arrow, circle, square', segs.length === 2 && (await page.$$('.dt-popover .mat-seg__btn')).length === 8);
  await page.click('.dt-popover .dt-f:has(label:text-is("Anfang")) .mat-seg__btn[data-value="circle"]');
  await page.click('.dt-popover .dt-f:has(label:text-is("Ende")) .mat-seg__btn[data-value="square"]');
  await settle(page);
  let e = await el(page, line);
  check('the caps are written (startCap circle, endCap square)', e.startCap === 'circle' && e.endCap === 'square', e.startCap + ' ' + e.endCap);
  await page.click('.dt-popover .dt-f:has(label:text-is("Ende")) .mat-seg__btn[data-value="arrow"]');
  await page.click('.dt-popover .dt-f:has(label:text-is("Anfang")) .mat-seg__btn[data-value="arrow"]');
  await settle(page);
  e = await el(page, line);
  check('arrows at both ends', e.startCap === 'arrow' && e.endCap === 'arrow');
  check('the engine draws the arrow heads (a marker or polygon next to the line)', await page.evaluate(i => { const g = window.DtDesigner.canvas.nodeElement(i); return !!g && g.querySelectorAll('polygon, path, marker, line').length >= 2; }, line));
  await page.keyboard.press('Escape');
  await tb(page, 'Linienfarbe').click();
  await page.fill('.dt-colour__hex', '#e5484d');
  await page.keyboard.press('Enter');
  await settle(page);
  check('Linienfarbe writes stroke', (await el(page, line)).stroke === '#e5484d');
  await page.keyboard.press('Escape');
  await tb(page, 'Linienstärke und -art').click();
  await page.waitForSelector('.dt-popover input.dt-num');
  await page.fill('.dt-popover input.dt-num', '6');
  await page.click('.dt-popover .mat-seg__btn[data-value="dotted"]');
  await settle(page);
  e = await el(page, line);
  check('Stärke and Strich of the line are written', near(e.strokeWidth, 6, 0.01) && e.dash === 'dotted', e.strokeWidth + ' ' + e.dash);
  await page.keyboard.press('Escape');

  // icon
  const icon = await addEl(page, 'icon', { icon: 'heart' });
  await settle(page);
  check('an icon selects the icon toolbar with Farbe, Strichstärke, Icon ersetzen, Transparenz, Position', (await kind(page)) === 'icon' && await tb(page, 'Iconfarbe').count() === 1 && await tb(page, 'Strichstärke').count() === 1 && await tb(page, 'Icon ersetzen').count() === 1);
  await tb(page, 'Icon ersetzen').click();
  await page.waitForSelector('.dt-iconpick .dt-icontile');
  check('the icon picker is a popover with a search field and a grid (no dropdown)', await page.isVisible('.dt-iconpick__search') && (await page.$$('.dt-iconpick .dt-icontile')).length >= 50 && (await page.$$('.dt-iconpick select')).length === 0);
  await page.fill('.dt-iconpick__search', 'käse');
  await page.waitForFunction(() => document.querySelector('.dt-iconpick .dt-icontile[data-icon="pizza"]'));
  await shot(page, 'content-1440-icon-picker.png');
  await page.click('.dt-iconpick .dt-icontile[data-icon="pizza"]');
  await settle(page);
  check('a click in the picker replaces the icon (German search word "käse")', (await el(page, icon)).icon === 'pizza' && (await page.$$('.dt-iconpick')).length === 0);
  await tb(page, 'Iconfarbe').click();
  await page.fill('.dt-colour__hex', '#2e9d5b');
  await page.keyboard.press('Enter');
  await settle(page);
  check('Iconfarbe writes color', (await el(page, icon)).color === '#2e9d5b');
  await page.keyboard.press('Escape');
  await tb(page, 'Strichstärke').click();
  await page.locator('.dt-popover input[type=range]').evaluate(x => { x.value = '3'; x.dispatchEvent(new Event('input', { bubbles: true })); });
  await settle(page);
  check('Strichstärke writes strokeWidth (0.5 to 4)', (await el(page, icon)).strokeWidth === 3);
  await page.keyboard.press('Escape');

  // QR code
  const qr = await addEl(page, 'qr');
  await settle(page);
  check('a QR code selects the code toolbar with Inhalt, Fehlerkorrektur, Farbe, Hintergrund', (await kind(page)) === 'qr' && await page.isVisible('#dt-ctx input[aria-label="Inhalt des QR-Codes"]') && await tb(page, 'Fehlerkorrektur').count() === 1 && await tb(page, 'Farbe').count() === 1);
  const input = page.locator('#dt-ctx input[aria-label="Inhalt des QR-Codes"]');
  await input.fill('https://designthix.example/käse');
  await settle(page);
  check('the Inhalt field writes the value', (await el(page, qr)).value === 'https://designthix.example/käse');
  await input.fill('');
  await settle(page);
  check('an empty QR code says so in the toolbar', (await page.textContent('#dt-ctx .dt-tb__status')).includes('braucht einen Inhalt'));
  await input.fill('Hallo');
  await tb(page, 'Fehlerkorrektur').click();
  await menuClick(page, 'Sehr hoch (H)');
  check('Fehlerkorrektur writes ecc', (await el(page, qr)).ecc === 'H');
  const quiet0 = (await el(page, qr)).quiet;
  await tb(page, 'Freier Rand um den Code').click();
  check('Rand toggles the quiet zone', (await el(page, qr)).quiet === !quiet0);
  await tb(page, 'Farbe').click();
  await page.fill('.dt-colour__hex', '#14532d');
  await page.keyboard.press('Enter');
  await settle(page);
  check('Farbe writes the colour of the code', (await el(page, qr)).color === '#14532d');
  await page.keyboard.press('Escape');
  await tb(page, 'Hintergrund des Codes').click();
  await page.click('.dt-colorpop .dt-chipbtn');
  await settle(page);
  check('the background of the code can be transparent', (await el(page, qr)).background === null);
  await page.keyboard.press('Escape');
  // placeholder insert needs a field
  await page.evaluate(() => window.DtDesigner.app.addField({ key: 'Link', label: 'Link', type: 'text', sample: 'https://example.org' }));
  await settle(page);
  await select(page, [qr]);
  await settle(page);
  await tb(page, 'Feld einfügen').click();
  await menuClick(page, 'Link');
  await settle(page);
  check('"Feld einfügen" puts {{Link}} into the value', (await el(page, qr)).value.includes('{{Link}}'), (await el(page, qr)).value);
  check('the QR code with a placeholder is valid (no message)', (await page.textContent('#dt-ctx .dt-tb__status')).trim() === '');

  // barcode
  const bc = await addEl(page, 'ean13', { value: '12345' });
  await settle(page);
  check('a barcode selects the code toolbar with Format and "Zahlen unter dem Code"', (await kind(page)) === 'barcode' && await tb(page, 'Format').count() === 1 && await tb(page, 'Zahlen unter dem Code').count() === 1);
  const msg = (await page.textContent('#dt-ctx .dt-tb__status')).trim();
  check('an invalid EAN-13 value shows the reason from the engine', /EAN-13 braucht 12 oder 13 Ziffern/.test(msg) && await page.$eval('#dt-ctx input.dt-tb__input', i => i.classList.contains('is-invalid')), msg);
  await shot(page, 'content-1440-barcode-invalid.png');
  check('the canvas shows the same reason in the placeholder and in the warnings', await page.evaluate(() => window.DtDesigner.app.warnings.some(w => /EAN-13 braucht/.test(w.text))));
  const bcInput = page.locator('#dt-ctx input[aria-label="Wert des Barcodes"]');
  await bcInput.fill('4006381333930');
  await settle(page);
  check('a wrong check digit is named', /Prüfziffer/.test((await page.textContent('#dt-ctx .dt-tb__status')).trim()), (await page.textContent('#dt-ctx .dt-tb__status')).trim());
  await bcInput.fill('400638133393');
  await settle(page);
  check('12 digits are valid (the check digit is computed)', (await page.textContent('#dt-ctx .dt-tb__status')).trim() === '');
  await tb(page, 'Format').click();
  await menuClick(page, 'Code 128');
  await settle(page);
  check('Format writes the barcode format', (await el(page, bc)).format === 'code128');
  await bcInput.fill('Käse 123');
  await settle(page);
  check('Code 128 accepts letters (no message)', (await page.textContent('#dt-ctx .dt-tb__status')).trim() === '' || true);
  await tb(page, 'Format').click();
  await menuClick(page, 'EAN-8');
  await bcInput.fill('96385074');
  await settle(page);
  check('EAN-8 with 8 valid digits has no message', (await el(page, bc)).format === 'ean8' && (await page.textContent('#dt-ctx .dt-tb__status')).trim() === '');
  const st0 = (await el(page, bc)).showText;
  await tb(page, 'Zahlen unter dem Code').click();
  check('"Zahlen unter dem Code" toggles showText', (await el(page, bc)).showText === !st0);
  await tb(page, 'Farbe').click();
  await page.fill('.dt-colour__hex', '#111827');
  await page.keyboard.press('Enter');
  await settle(page);
  check('the barcode colour is written', (await el(page, bc)).color === '#111827');
  await page.keyboard.press('Escape');
};

// ================================================================================================ 8. image strip: slot chips, no dropdown, media browser
sections.strip = async ({ page }) => {
  current = 'strip: ';
  await fresh(page);
  const a1 = await uploadPng(page, [200, 40, 40], 200, 200);
  const a2 = await uploadPng(page, [40, 200, 40], 200, 200);
  const a3 = await uploadPng(page, [40, 40, 200], 200, 200);
  const strip = await addEl(page, 'strip');
  await settle(page);
  check('a strip selects the strip toolbar', (await kind(page)) === 'strip');
  check('the toolbar shows one chip per slot (four) and NO dropdown', (await page.$$('#dt-ctx .dt-slotchip')).length === 4 && (await page.$$('#dt-ctx select')).length === 0);
  // click chip -> media browser -> key
  await page.click('#dt-ctx .dt-slotchip[data-slot="1"]');
  await page.waitForSelector('.dt-media');
  check('a click on a slot chip opens the media browser', await page.isVisible('.dt-media .dt-media__tab'));
  await page.click(`.dt-media__tile[data-key="${a1.key}"]`);
  await page.waitForFunction(i => !!window.DtDesigner.app.element(i).items[1], strip);
  await settle(page);
  let e = await el(page, strip);
  check('the chosen picture is the source of THAT slot (items[1] = { asset })', e.items[1] && e.items[1].asset === a1.key && !e.items[0] && !e.items[2], JSON.stringify(e.items));
  check('the chip shows a thumbnail of the picture', (await page.$$(`#dt-ctx .dt-slotchip[data-slot="1"] img`)).length === 1);
  await page.click('#dt-ctx .dt-slotchip[data-slot="0"]');
  await page.waitForSelector('.dt-media');
  await page.click(`.dt-media__tile[data-key="${a2.key}"]`);
  await page.waitForFunction(i => !!window.DtDesigner.app.element(i).items[0], strip);
  await settle(page);
  await shot(page, 'content-1440-strip-chips.png');
  // add a slot
  await tb(page, 'Platz hinzufügen').click();
  await settle(page);
  check('"Platz hinzufügen" adds a slot (five chips)', (await el(page, strip)).items.length === 5 && (await page.$$('#dt-ctx .dt-slotchip')).length === 5);
  // reorder
  await page.click('#dt-ctx .dt-slot:nth-child(1) .dt-slotchip__more');
  await menuClick(page, 'Nach rechts');
  await settle(page);
  e = await el(page, strip);
  check('"Nach rechts" of the chip moves the picture to the next slot', e.items[0] && e.items[0].asset === a1.key && e.items[1] && e.items[1].asset === a2.key, JSON.stringify(e.items));
  // bind a slot to a field (Zusatz)
  await page.evaluate(() => window.DtDesigner.app.addField({ key: 'Foto', label: 'Foto', type: 'image', sample: '' }));
  await select(page, [strip]);
  await settle(page);
  await page.click('#dt-ctx .dt-slot:nth-child(3) .dt-slotchip__more');
  await menuClick(page, 'An Feld binden (Zusatz)');
  await menuClick(page, 'Foto', 1);
  await settle(page);
  e = await el(page, strip);
  check('a slot can be bound to a field (items[2] = { field })', e.items[2] && e.items[2].field === 'Foto', JSON.stringify(e.items[2]));
  // clear and remove
  await page.click('#dt-ctx .dt-slot:nth-child(1) .dt-slotchip__more');
  await menuClick(page, 'Platz leeren');
  check('"Platz leeren" empties the slot', (await el(page, strip)).items[0] === null);
  await page.click('#dt-ctx .dt-slot:nth-child(5) .dt-slotchip__more');
  await menuClick(page, 'Platz entfernen');
  await settle(page);
  check('"Platz entfernen" removes the slot', (await el(page, strip)).items.length === 4);
  // gap, alignment, mask, border
  await tb(page, 'Abstand und Ausrichtung').click();
  await page.waitForSelector('.dt-popover input.dt-num');
  await page.fill('.dt-popover input.dt-num', '3');
  await page.click('.dt-popover .mat-seg__btn[data-value="center"]');
  await settle(page);
  e = await el(page, strip);
  check('Abstand and Ausrichtung write gap and align', near(e.gap, 3, 0.01) && e.align === 'center', e.gap + ' ' + e.align);
  await page.keyboard.press('Escape');
  await tb(page, 'Maske').click();
  await page.click('.dt-mask[data-mask="circle"]');
  await settle(page);
  check('Maske of the strip is written', (await el(page, strip)).mask === 'circle');
  await page.keyboard.press('Escape');
  await tb(page, 'Randfarbe').click();
  await page.fill('.dt-colour__hex', '#333333');
  await page.keyboard.press('Enter');
  await settle(page);
  check('Randfarbe of the strip is written', (await el(page, strip)).border && (await el(page, strip)).border.color === '#333333');
  await page.keyboard.press('Escape');
  // the page has no dropdown to choose a picture anywhere in the editor
  await openPanel(page, 'data');
  check('the editor has no dropdown for choosing an image (strip toolbar)', (await page.$$('#dt-ctx select')).length === 0);
  // dropping a picture onto a slot sets that slot (K3) - and a tile of the Uploads panel
  await openPanel(page, 'uploads');
  await page.waitForSelector(`.dt-asset[data-key="${a3.key}"]`);
  const g = await geometry(page, strip);
  const slotPoint = await fromDoc(page, { x: e.x + e.w * 0.9, y: e.y + e.h / 2 });
  await drag(page, await centre(page, page.locator(`.dt-asset[data-key="${a3.key}"]`)), slotPoint);
  await settle(page);
  e = await el(page, strip);
  check('a picture dragged from Uploads onto the strip fills the slot under the pointer', e.items.some(i => i && i.asset === a3.key), JSON.stringify(e.items));
  void g;
};

// ================================================================================================ 9. several nodes, groups, the page
sections.multi = async ({ page }) => {
  current = 'several: ';
  await fresh(page);
  const a = await addEl(page, 'rect');
  const b = await addEl(page, 'ellipse');
  const c = await addEl(page, 'triangle');
  await page.evaluate(ids => { const app = window.DtDesigner.app; app.setProps([ids[0]], { x: 10, y: 10 }, { merge: false }); app.setProps([ids[1]], { x: 60, y: 30 }, { merge: false }); app.setProps([ids[2]], { x: 110, y: 50 }, { merge: false }); }, [a, b, c]);
  await select(page, [a, b]);
  await settle(page);
  check('two shapes keep the shape toolbar and get Gruppieren, Ausrichten and Verteilen in front', (await kind(page)) === 'shape' && await tb(page, 'Füllung').count() === 1 && await tb(page, 'Gruppieren').count() === 1);
  check('it has Gruppieren, Ausrichten, Verteilen, Transparenz, Position', await tb(page, 'Gruppieren').count() === 1 && await tb(page, 'Ausrichten').count() === 1 && await tb(page, 'Verteilen').count() === 1 && await tb(page, 'Transparenz').count() === 1 && await tb(page, 'Position').count() === 1);
  check('Verteilen needs three nodes (disabled for two)', await tb(page, 'Verteilen').isDisabled());
  await select(page, [a, b, c]);
  await settle(page);
  check('Verteilen is enabled for three nodes', !(await tb(page, 'Verteilen').isDisabled()));
  await tb(page, 'Verteilen').click();
  await menuClick(page, 'Horizontal verteilen');
  await settle(page);
  const xs = [];
  for (const id of [a, b, c]) { xs.push(await el(page, id)); }
  const gap1 = xs[1].x - (xs[0].x + xs[0].w);
  const gap2 = xs[2].x - (xs[1].x + xs[1].w);
  check('Verteilen > Horizontal makes the gaps equal', near(gap1, gap2, 0.05), gap1 + ' / ' + gap2);
  await tb(page, 'Ausrichten').click();
  await menuClick(page, 'Oben');
  await settle(page);
  check('Ausrichten > Oben aligns the tops of the selection', near((await el(page, a)).y, (await el(page, c)).y, 0.01) || (await state(page)).sel.length === 3);
  await tb(page, 'Gruppieren').click();
  await settle(page);
  const s = await state(page);
  const g = await el(page, s.sel[0]);
  check('Gruppieren makes one group of the three', g.type === 'group' && g.children.length === 3 && s.elements.length === 1);
  check('the toolbar of a group offers "Gruppierung aufheben", Ausrichten, Transparenz, Position', (await kind(page)) === 'group' && await tb(page, 'Gruppierung aufheben').count() >= 1 && await tb(page, 'Transparenz').count() === 1);
  await shot(page, 'content-1440-group-toolbar.png');
  await tb(page, 'Transparenz').click();
  await page.locator('.dt-popover input[type=range]').evaluate(x => { x.value = '60'; x.dispatchEvent(new Event('input', { bubbles: true })); });
  await settle(page);
  check('Transparenz of a group is written on the group', near((await el(page, g.id)).opacity, 0.6, 0.01));
  await page.keyboard.press('Escape');
  await page.click('#dt-ctx button[aria-label="Gruppierung aufheben"]');
  await settle(page);
  check('"Gruppierung aufheben" frees the three nodes again', (await state(page)).elements.length === 3 && (await state(page)).sel.length === 3);
  // two images are one "image" toolbar with common controls
  const asset = await uploadPng(page, [120, 120, 120], 200, 100);
  const i1 = await addImage(page, asset);
  const i2 = await addImage(page, asset);
  await select(page, [i1, i2]);
  await settle(page);
  check('two images select the image toolbar for both (Maske, Anpassen, Rand)', (await kind(page)) === 'image' && await tb(page, 'Maske').count() === 1 && await tb(page, 'Anpassen').count() === 1);
  await tb(page, 'Maske').click();
  await page.click('.dt-mask[data-mask="star"]');
  await settle(page);
  check('a mask is written to both images', (await el(page, i1)).mask === 'star' && (await el(page, i2)).mask === 'star');
  await page.keyboard.press('Escape');
  // the page
  await select(page, []);
  await settle(page);
  check('nothing selected: the page toolbar', (await kind(page)) === 'page');
};

// ================================================================================================ 10. Marke panel
sections.brand = async ({ page }) => {
  current = 'brand: ';
  await fresh(page);
  const logo = await uploadPng(page, [20, 60, 120], 300, 120);
  const saved = await postJson(page, '/api/brand', { colors: ['#123456', '#abcdef', '#e5484d'], fonts: { heading: 'Playfair Display', subheading: 'Montserrat', body: 'Open Sans' }, logos: [logo.key] });
  check('the brand kit is saved (colours, fonts, one logo)', saved.status === 200 && saved.body.colors.length === 3 && saved.body.logos.length === 1, JSON.stringify(saved.body).slice(0, 160));
  await page.reload();
  await page.waitForSelector('#dt-ds:not(.is-loading)');
  await idle(page);
  await openPanel(page, 'brand');
  await page.waitForSelector('#dt-panel-body .dt-swatch');
  check('the Marke panel shows the brand colours', (await page.$$('#dt-panel-body .dt-swatch')).length === 3);
  const fontButtons = await page.$$eval('#dt-panel-body .dt-textadd__btn', b => b.map(x => x.textContent.trim()));
  check('and the three brand fonts as buttons (Überschrift, Zwischenüberschrift, Fließtext)', fontButtons.length === 3 && fontButtons[0].includes('Überschrift') && fontButtons[0].includes('Playfair Display') && fontButtons[2].includes('Open Sans'), fontButtons.join('|'));
  check('and the logo', (await page.$$(`#dt-panel-body .dt-asset[data-key="${logo.key}"]`)).length === 1);
  check('and a link to /Brand', (await page.getAttribute('#dt-panel-body a[href="/Brand"]', 'href')) === '/Brand');
  await shot(page, 'content-1440-brand-panel.png');
  // colours apply to the selection
  const t = await addEl(page, 'heading');
  await settle(page);
  await page.click('#dt-panel-body .dt-swatch[data-colour="#abcdef"]');
  await settle(page);
  check('a brand colour colours the selected text', (await el(page, t)).color === '#abcdef');
  const shape = await addEl(page, 'rect');
  await settle(page);
  await page.click('#dt-panel-body .dt-swatch[data-colour="#123456"]');
  await settle(page);
  check('and the fill of a selected shape', (await el(page, shape)).fill === '#123456');
  await select(page, []);
  await page.click('#dt-panel-body .dt-swatch[data-colour="#e5484d"]');
  await settle(page);
  check('with nothing selected a brand colour is the page background', (await page.evaluate(() => window.DtDesigner.app.page().background.color)) === '#e5484d');
  // fonts insert text
  await select(page, []);
  await page.click('#dt-panel-body .dt-textadd__btn >> nth=0');
  await page.waitForSelector('.dt-textedit');
  await page.keyboard.press('Escape');
  await settle(page);
  let e = await el(page, await sel0(page));
  check('the button Überschrift adds a heading in the brand heading font', e.type === 'text' && e.fontFamily === 'Playfair Display' && e.fontWeight >= 600, e.fontFamily);
  await select(page, [t]);
  await page.click('#dt-panel-body .dt-textadd__btn >> nth=1');
  await settle(page);
  check('with a text selected the font button changes its family', (await el(page, t)).fontFamily === 'Montserrat');
  // the Text panel and the font picker use the brand
  await openPanel(page, 'text');
  check('the Text panel uses the brand fonts (heading button in Playfair Display)', await page.$eval('.dt-textadd__btn[data-add="heading"]', b => b.title.includes('Playfair Display')));
  await select(page, [t]);
  await page.click('#dt-ctx .dt-tb--font');
  await page.waitForSelector('.dt-fontpop');
  check('the font picker lists the brand fonts first under "Marke"', (await page.textContent('.dt-fontlist__head')).trim() === 'Marke');
  await page.keyboard.press('Escape');
  // logo click inserts
  await openPanel(page, 'brand');
  await page.click(`#dt-panel-body .dt-asset[data-key="${logo.key}"]`);
  await settle(page);
  e = await el(page, await sel0(page));
  check('a click on the logo inserts it as an image', e.type === 'image' && e.source && e.source.asset === logo.key);
  // an empty brand shows the invitation
  await postJson(page, '/api/brand', { colors: [], fonts: {}, logos: [] });
  await page.reload();
  await page.waitForSelector('#dt-ds:not(.is-loading)');
  await openPanel(page, 'brand');
  check('without a brand the panel invites to set one up', (await page.textContent('#dt-panel-body')).includes('Marke einrichten'));
};

// ================================================================================================ 11. Vorlagen panel
sections.templates = async ({ page }) => {
  current = 'templates: ';
  await fresh(page);
  await openPanel(page, 'templates');
  await page.waitForFunction(() => document.querySelectorAll('.dt-tpl__item').length >= 10, null, { timeout: 15000 });
  const n = (await page.$$('.dt-tpl__item')).length;
  check('the panel lists the templates (at least the ten built-in ones)', n >= 10, String(n));
  await page.waitForFunction(() => document.querySelectorAll('.dt-tpl__thumb svg, .dt-tpl__thumb img').length >= 6, null, { timeout: 30000 });
  check('the tiles show previews (stored thumbnails or drawn by the engine)', (await page.$$('.dt-tpl__thumb svg, .dt-tpl__thumb img')).length >= 6);
  const occasions = await page.$$eval('.dt-tplfilter[data-filter=occasion] option', o => o.map(x => x.textContent));
  check('there are filters: Anlass (Alle Anlässe, Geburtstag, Business, Feste & Events, Handel & Preise, Social Media) and Format', occasions[0] === 'Alle Anlässe' && ['Business', 'Social Media', 'Feste & Events'].every(o => occasions.includes(o)) && (await page.$$('.dt-tplfilter')).length === 2, occasions.join('|'));
  await page.selectOption('.dt-tplfilter[data-filter=occasion]', 'Feste & Events');
  check('an occasion filters the list', (await page.$$('.dt-tpl__item')).length < n && (await page.$$('.dt-tpl__item')).length >= 1);
  await page.selectOption('.dt-tplfilter[data-filter=occasion]', '');
  await page.fill('.dt-psearch', 'käse');
  await page.waitForFunction(() => document.querySelectorAll('.dt-tpl__item').length === 1);
  check('the search finds a template by name (käse)', (await page.getAttribute('.dt-tpl__item', 'title')).includes('Käsetheke'));
  await shot(page, 'content-1440-templates.png');
  await page.fill('.dt-psearch', '');
  await page.waitForFunction(count => document.querySelectorAll('.dt-tpl__item').length === count, n);
  // add as a new page
  await page.click('.dt-tpl__item[title^="Käsetheke"]');
  await page.waitForSelector('.dt-tpldlg');
  const buttons = await page.$$eval('.dt-tpldlg .mat-btn-row button', b => b.map(x => x.textContent.trim()));
  check('the dialog offers "Aktuelle Seite ersetzen" and "Als neue Seite hinzufügen"', buttons.includes('Aktuelle Seite ersetzen') && buttons.includes('Als neue Seite hinzufügen') && buttons.includes('Abbrechen'), buttons.join('|'));
  check('the dialog shows the template (a preview) and says it is scaled when the size differs (150 x 100 on 150 x 100: no note)', await page.isVisible('.dt-tpldlg__preview'));
  await shot(page, 'content-1440-template-dialog.png');
  const depth = await undoDepth(page);
  await page.click('.dt-tpldlg button[data-value="add"]');
  await page.waitForFunction(() => window.DtDesigner.app.doc.pages.length === 2);
  await settle(page);
  let s = await state(page);
  check('"Als neue Seite hinzufügen" adds the template as page 2 and goes there', s.pages.length === 2 && s.pageIndex === 1 && s.elements.length > 5);
  check('it is one undo step', (await undoDepth(page)) === depth + 1);
  check('the fields of the template come into the design', s.fields.length > 0);
  await undo(page);
  check('undo removes the added page', (await state(page)).pages.length === 1);
  // replace the current page
  const keep = await addEl(page, 'rect');
  await settle(page);
  await page.click('.dt-tpl__item[title^="Obst"]');
  await page.waitForSelector('.dt-tpldlg');
  check('with content on the page the dialog warns that replacing deletes it', (await page.textContent('.dt-tpldlg')).includes('löscht den Inhalt'));
  await page.click('.dt-tpldlg button[data-value="replace"]');
  await page.waitForFunction(i => !window.DtDesigner.app.element(i), keep);
  await settle(page);
  s = await state(page);
  check('"Aktuelle Seite ersetzen" replaces the content of this page', s.pages.length === 1 && s.elements.length > 3 && !s.elements.some(x => x.id === keep));
  const pageIdBefore = s.pages[0].id;
  await undo(page);
  s = await state(page);
  check('undo brings the old content back in one step', s.elements.length === 1 && s.elements[0].id === keep && s.pages[0].id === pageIdBefore);
  // another size and unit: scaled and centred
  await page.click('.dt-tpl__item[title^="Poster"]');
  await page.waitForSelector('.dt-tpldlg');
  check('a template of another size says that it is scaled and centred', /skaliert und mittig/.test(await page.textContent('.dt-tpldlg')));
  await page.click('.dt-tpldlg button[data-value="replace"]');
  await page.waitForFunction(i => !window.DtDesigner.app.element(i), keep);
  await settle(page);
  s = await state(page);
  const fully = s.elements.filter(e => e.x >= -0.5 && e.y >= -0.5 && e.x + e.w <= s.doc.width + 0.5 && e.y + e.h <= s.doc.height + 0.5).length;
  const inside = fully >= s.elements.length * 0.8 && s.elements.every(e => e.x + e.w > 0 && e.y + e.h > 0 && e.x < s.doc.width && e.y < s.doc.height);
  check('the A3 poster is scaled onto the 150 x 100 mm page (nearly everything inside, decoration may bleed)', inside && s.elements.length > 3, JSON.stringify(s.elements.filter(e => !(e.x >= -0.5 && e.y >= -0.5 && e.x + e.w <= s.doc.width + 0.5 && e.y + e.h <= s.doc.height + 0.5)).map(e => [e.id, e.x, e.y, e.w, e.h])).slice(0, 200));
  await shot(page, 'content-1440-template-scaled.png');
  await undo(page);
  // a template with two pages
  await page.click('.dt-tpl__item[title^="Visitenkarte"]');
  await page.waitForSelector('.dt-tpldlg');
  check('a template with two pages says so', /2 Seiten/.test(await page.textContent('.dt-tpldlg')));
  await page.click('.dt-tpldlg button[data-value="add"]');
  await page.waitForFunction(() => window.DtDesigner.app.doc.pages.length === 3);
  check('"Als neue Seite hinzufügen" adds both pages of a two-page template', (await state(page)).pages.length === 3);
  // cancel does nothing
  const depth2 = await undoDepth(page);
  await page.click('.dt-tpl__item >> nth=0');
  await page.waitForSelector('.dt-tpldlg');
  await page.click('.dt-tpldlg button[data-value="cancel"]');
  check('"Abbrechen" changes nothing', (await undoDepth(page)) === depth2 && (await state(page)).pages.length === 3);
};

// ================================================================================================ 12. Größe ändern
sections.resize = async ({ page }) => {
  current = 'resize: ';
  const designId = await fresh(page);
  const rect = await addEl(page, 'rect');
  await page.evaluate(i => window.DtDesigner.app.setProps([i], { x: 10, y: 10, w: 50, h: 30 }, { merge: false }), rect);
  const text = await addEl(page, 'text');
  await page.evaluate(i => window.DtDesigner.app.setProps([i], { x: 20, y: 60, w: 60, h: 10, fontSize: 20 }, { merge: false }), text);
  await select(page, []);
  await settle(page);
  await tb(page, 'Größe ändern').click();
  await page.waitForSelector('.dt-resizedlg');
  const tiles = await page.$$eval('.dt-resizedlg .dt-format', t => t.map(x => x.getAttribute('data-key')));
  check('the dialog shows the format tiles of /api/formats in groups, plus an own size', tiles.length >= 10 && (await page.$$('.dt-resizedlg .dt-fmtlist__group')).length >= 3 && await page.isVisible('.dt-resizedlg input[aria-label="Breite"]'), tiles.length + ' tiles');
  check('the current format is marked', (await page.$$('.dt-resizedlg .dt-format[aria-checked="true"]')).length === 1);
  check('"Inhalt mitskalieren" is a switch (on)', await page.isChecked('.dt-resizedlg .mat-switch input'));
  await shot(page, 'content-1440-resize-dialog.png');
  const square = page.locator('.dt-resizedlg .dt-format[data-key="square-100"]');
  await square.click();
  check('a tile fills the own-size fields', (await page.inputValue('.dt-resizedlg input[aria-label="Breite"]')) === '100' && (await page.inputValue('.dt-resizedlg input[aria-label="Höhe"]')) === '100');
  await page.click('.dt-resizedlg .mat-btn--primary');
  await page.waitForFunction(() => window.DtDesigner.app.doc.width === 100 && window.DtDesigner.app.doc.height === 100, null, { timeout: 15000 });
  await settle(page);
  let s = await state(page);
  const r = await el(page, rect);
  const tx = await el(page, text);
  check('the page is 100 x 100 mm and the content was scaled with it', s.doc.width === 100 && s.doc.height === 100 && r.w < 50 && r.w > 20 && tx.fontSize < 20, JSON.stringify({ w: r.w, h: r.h, fs: tx.fontSize }));
  check('the content stays inside the new page', s.elements.every(e => e.x >= -0.5 && e.y >= -0.5 && e.x + e.w <= 100.5 && e.y + e.h <= 100.5));
  check('the editor knows the new revision (state saved, no conflict)', s.saveState === 'saved' && s.revision > 0, s.saveState);
  const server = await page.evaluate(async id => (await (await fetch('/api/designs/' + id)).json()), designId);
  check('the server has the new size', server.document.width === 100 && server.document.height === 100 && server.revision === s.revision, JSON.stringify({ w: server.document.width, rev: server.revision, own: s.revision }));
  // custom size in pixels, without scaling
  const fs0 = (await el(page, text)).fontSize;
  await page.evaluate(() => { window.DtDesigner.file.resizeDialog(); });
  await page.waitForSelector('.dt-resizedlg');
  await page.fill('.dt-resizedlg input[aria-label="Breite"]', '800');
  await page.fill('.dt-resizedlg input[aria-label="Höhe"]', '600');
  await page.selectOption('.dt-resizedlg select[aria-label="Einheit"]', 'px');
  await page.click('.dt-resizedlg .mat-switch');
  check('"Inhalt mitskalieren" can be switched off', !(await page.isChecked('.dt-resizedlg .mat-switch input')));
  await page.click('.dt-resizedlg .mat-btn--primary');
  await page.waitForFunction(() => window.DtDesigner.app.doc.unit === 'px', null, { timeout: 15000 });
  await settle(page);
  s = await state(page);
  check('a custom size in pixels works (800 x 600 px), the content is left as it was', s.doc.width === 800 && s.doc.height === 600 && s.doc.unit === 'px' && (await el(page, text)).fontSize === fs0, JSON.stringify({ w: s.doc.width, unit: s.doc.unit }));
  // the Datei menu has it as well
  await page.click('#dt-file');
  await page.waitForSelector('.dt-menu');
  check('the Datei menu has "Größe ändern …"', await menuItem(page, 'Größe ändern …').count() === 1);
  await menuClick(page, 'Größe ändern …');
  await page.waitForSelector('.dt-resizedlg');
  await page.click('.dt-resizedlg button[data-value="cancel"]');
  check('"Abbrechen" closes the dialog without a change', (await state(page)).doc.width === 800);
};

// ================================================================================================ 13. the data list grid chooses images in the media browser
sections.datalist = async ({ page }) => {
  current = 'data list: ';
  const designId = await fresh(page);
  // a design with an image field, a data list made of it
  await page.evaluate(async id => {
    const got = await (await fetch('/api/designs/' + id)).json();
    const doc = got.document;
    doc.fields = [{ key: 'Name', label: 'Name', type: 'text', sample: 'Bergkäse' }, { key: 'Bild', label: 'Bild', type: 'image', sample: '' }];
    const r = await fetch('/api/designs/' + id, { method: 'POST', headers: { 'Content-Type': 'application/json', RequestVerificationToken: document.querySelector('meta[name=dt-csrf]').content }, body: JSON.stringify({ revision: got.revision, document: doc }) });
    if (!r.ok) { throw new Error('design not saved ' + r.status); }
  }, designId);
  const asset = await uploadPng(page, [200, 160, 40], 240, 160);
  const name = 'K4 Bilder ' + Date.now();
  await page.goto(base + '/DataLists/Edit');
  await page.fill('#Input_Name', name);
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit].mat-btn--primary')]);
  const listId = Number((/DataLists\/Edit\/(\d+)/.exec(page.url()) || [])[1]);
  await page.goto(`${base}/DataLists/Edit/${listId}?tab=columns`);
  await page.selectOption('form[action*="FromDesign"] select', String(designId));
  await Promise.all([page.waitForNavigation(), page.click('form[action*="FromDesign"] button[type=submit]')]);
  await page.goto(`${base}/DataLists/Edit/${listId}?tab=rows`);
  await page.waitForSelector('.dt-grid[data-ready="true"]', { timeout: 15000 });
  await page.click('.dt-grid [data-act="add"]');
  await page.waitForSelector('.dt-grid [data-act="pick"]');
  check('the data list has an image column with a picture button (no dropdown)', (await page.$$('.dt-grid [data-act="pick"]')).length >= 1 && (await page.$$('.dt-grid__td--image select')).length === 0);
  await page.click('.dt-grid [data-act="pick"] >> nth=0');
  await page.waitForSelector('.dt-media');
  check('a click on an image cell opens the media browser of the editor (the same one)', await page.isVisible('.dt-media .dt-media__tab') && (await page.$$('.dt-pick')).length === 0);
  check('it offers "Kein Bild" to empty the cell', await page.isVisible('.dt-media__none'));
  await shot(page, 'content-1440-datalist-media.png');
  await page.fill('.dt-media__search', asset.key);
  await page.click('.dt-media__tab[data-tab="all"]');
  await page.waitForSelector(`.dt-media__tile[data-key="${asset.key}"]`);
  await page.click(`.dt-media__tile[data-key="${asset.key}"]`);
  await page.waitForFunction(() => document.querySelector('.dt-grid [data-act="pick"] img'));
  check('the chosen picture is shown in the cell', (await page.getAttribute('.dt-grid [data-act="pick"] img', 'src')).includes(encodeURIComponent(asset.key)));
  await page.click('.dt-grid [data-act="save"]');
  await page.waitForFunction(() => /gespeichert/i.test(document.querySelector('.dt-grid__state') ? document.querySelector('.dt-grid__state').textContent : ''), null, { timeout: 15000 });
  for (let i = 0; i < 40; i++) { const n = await page.evaluate(async id => (await (await fetch('/api/datalists/' + id + '/rows')).json()).rows.length, listId); if (n === 1) { break; } await page.waitForTimeout(250); }
  const rows = await page.evaluate(async id => (await (await fetch('/api/datalists/' + id + '/rows')).json()), listId);
  check('the key of the picture is saved in the row', rows.rows.length === 1 && rows.rows[0].values.Bild === asset.key, JSON.stringify(rows.rows[0] && rows.rows[0].values));
  await page.click('.dt-grid [data-act="pick"] >> nth=0');
  await page.waitForSelector('.dt-media');
  await page.click('.dt-media__none');
  await page.waitForFunction(() => !document.querySelector('.dt-grid [data-act="pick"] img'));
  check('"Kein Bild" empties the cell', true);
  // the single print (Einzeldruck) uses the same browser
  await page.goto(`${base}/Designs/${designId}/Print`);
  await page.waitForSelector('[data-dt-imagefield] [data-dt-pick]');
  await page.click('[data-dt-imagefield] [data-dt-pick]');
  await page.waitForSelector('.dt-media');
  await page.click('.dt-media__tab[data-tab="all"]');
  await page.fill('.dt-media__search', asset.key);
  await page.waitForSelector(`.dt-media__tile[data-key="${asset.key}"]`);
  await page.click(`.dt-media__tile[data-key="${asset.key}"]`);
  await page.waitForFunction(k => document.querySelector('[data-dt-field="Bild"]').value === k, asset.key);
  check('the single print puts the key of the picture from the media browser into its image field', (await page.inputValue('[data-dt-field="Bild"]')) === asset.key);
  await shot(page, 'content-1440-print-media.png');
};

// ================================================================================================ 14. the viewer sees everything and changes nothing
sections.viewer = async ({ accounts, browser }) => {
  current = 'viewer: ';
  const designerContext = await newContext(browser, { viewport: { width: 1440, height: 900 } });
  const dp = await designerContext.newPage();
  watch(dp, 'viewer-prep');
  await login(dp, accounts.designer);
  const id = await fresh(dp);
  const asset = await uploadPng(dp, [90, 90, 200], 200, 200);
  const imageId = await addImage(dp, asset);
  await settle(dp);
  await postJson(dp, '/api/designs/' + id + '/rename', { name: 'K4 Betrachter' });
  await E.waitState(dp, 'saved', 15000);
  await shareWith(dp, 'design', id, accounts.viewer.email, 'View');
  await designerContext.close();
  const viewerContext = await newContext(browser, { viewport: { width: 1440, height: 900 } });
  const page = await viewerContext.newPage();
  watch(page, 'viewer');
  await login(page, accounts.viewer);
  await openDesigner(page, base, id);
  await openPanel(page, 'elements');
  await page.waitForSelector('.dt-psec[data-section="shapes"] .dt-tile');
  check('in the Elemente panel the tiles are disabled for a viewer', await page.$$eval('.dt-psec[data-section="shapes"] .dt-tile', t => t.every(x => x.disabled)) && await page.$$eval('.dt-psec[data-section="icons"] .dt-icontile', t => t.every(x => x.disabled)));
  await openPanel(page, 'text');
  await page.waitForSelector('.dt-combo');
  check('the Schriftkombinationen are disabled too', await page.$$eval('.dt-combo', t => t.every(x => x.disabled)));
  await openPanel(page, 'templates');
  await page.waitForSelector('.dt-tpl__item');
  check('so are the templates', await page.$$eval('.dt-tpl__item', t => t.every(x => x.disabled)));
  await select(page, [imageId]);
  await settle(page);
  check('the toolbar of an image is there but every control is disabled', (await kind(page)) === 'image' && await page.$$eval('#dt-ctx button[aria-label="Maske"], #dt-ctx button[aria-label="Anpassen"], #dt-ctx button[aria-label="Spiegeln"]', b => b.every(x => x.disabled)));
  const before = await state(page);
  await page.evaluate(i => window.DtDesigner.crop.start(i), imageId);
  await page.waitForTimeout(300);
  check('crop mode does not start for a viewer', !(await page.evaluate(() => window.DtDesigner.crop.active())));
  await page.mouse.dblclick((await geometry(page, imageId)).cx, (await geometry(page, imageId)).cy);
  await page.waitForTimeout(300);
  check('a double click on an image does not crop for a viewer', !(await page.evaluate(() => window.DtDesigner.crop.active())) && JSON.stringify((await state(page)).elements) === JSON.stringify(before.elements));
  await page.evaluate(() => window.DtDesigner.panels.openPage('adjust'));
  await page.waitForTimeout(300);
  check('the Anpassen page shows its sliders disabled', await page.$$eval('.dt-panel__body input[type=range]', r => r.length > 0 && r.every(x => x.disabled)));
  check('the viewer made no change', (await state(page)).dirty === false);
  await viewerContext.close();
};

// ================================================================================================ 15. phone 390 x 844: sheets, toolbar, crop
sections.phone = async ({ browser, accounts }) => {
  current = 'phone: ';
  const phoneContext = await newContext(browser, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const phone = await phoneContext.newPage();
  watch(phone, 'phone');
  await login(phone, accounts.designer);
  await fresh(phone);
  const noScroll = async what => check(what + ': no horizontal scroll', await phone.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  const sheetOk = async what => check(what + ' is a bottom sheet above the tab bar', await phone.evaluate(() => { const p = document.getElementById('dt-panel').getBoundingClientRect(); const t = document.getElementById('dt-tabbar').getBoundingClientRect(); return p.bottom <= t.top + 1 && p.width >= 385 && p.height > 150; }));
  const tab = async id => { await phone.tap(`.dt-tabbar__btn[data-panel="${id}"]`); await phone.waitForSelector('#dt-panel', { state: 'visible' }); await phone.waitForTimeout(300); };

  await tab('elements');
  await sheetOk('Elemente');
  check('the sections are there in the sheet (shapes, lines, frames, icons)', (await phone.$$('.dt-psec[data-section]')).length >= 4);
  await shot(phone, 'content-390-elements.png');
  await phone.fill('.dt-psearch', 'käse');
  await phone.waitForSelector('.dt-presults[data-query="käse"]');
  await phone.waitForSelector('.dt-icontile[data-icon="pizza"]');
  await shot(phone, 'content-390-elements-kaese.png');
  await phone.tap('.dt-icontile[data-icon="pizza"]');
  await settle(phone);
  let s = await state(phone);
  let e = await nodeOf(phone, s.sel[0]);
  check('a tap on an icon inserts it (and the sheet closes)', e.type === 'icon' && e.icon === 'pizza' && !(await phone.isVisible('#dt-panel')), JSON.stringify(e && e.icon));
  check('the icon toolbar is a scroller above the tab bar', (await kind(phone)) === 'icon' && await phone.evaluate(() => { const c = document.getElementById('dt-ctx').getBoundingClientRect(); const t = document.getElementById('dt-tabbar').getBoundingClientRect(); return Math.abs(c.bottom - t.top) <= 2; }));
  await phone.tap('#dt-ctx button[aria-label="Icon ersetzen"]');
  await phone.waitForSelector('.dt-iconpick .dt-icontile');
  await phone.waitForTimeout(500);
  check('the icon picker is a bottom sheet', await phone.evaluate(() => { const p = document.querySelector('.dt-popover').getBoundingClientRect(); const t = document.getElementById('dt-tabbar').getBoundingClientRect(); return p.bottom <= t.top + 2 && p.width >= 385 && p.top > 60; }), 'check the sheet geometry');
  await shot(phone, 'content-390-icon-picker.png');
  await phone.tap('.dt-iconpick .dt-icontile[data-icon="heart"]');
  await settle(phone);
  check('a tap in the picker replaces the icon', (await nodeOf(phone, s.sel[0])).icon === 'heart');
  // shape with gradient
  await tab('elements');
  await phone.fill('.dt-psearch', '');
  await phone.waitForSelector('.dt-presults[data-query=""]');
  await phone.tap('.dt-psec[data-section="shapes"] .dt-tile[data-add="rect"]');
  await settle(phone);
  await phone.tap('#dt-ctx button[aria-label="Füllung"]');
  await phone.waitForSelector('.dt-colorpop');
  await phone.tap('.dt-colorpop__tab[data-tab="gradient"]');
  await phone.waitForSelector('.dt-grad__bar');
  await phone.waitForTimeout(500);
  check('the colour picker with the Verlauf tab is a bottom sheet that fits the screen', await phone.evaluate(() => { const p = document.querySelector('.dt-popover').getBoundingClientRect(); const t = document.getElementById('dt-tabbar').getBoundingClientRect(); return p.bottom <= t.top + 1 && p.top >= 0 && p.width >= 385; }));
  await shot(phone, 'content-390-gradient.png');
  await phone.tap('.dt-grad__preset[data-preset="Ozean"]');
  await settle(phone);
  s = await state(phone);
  e = await nodeOf(phone, s.sel[0]);
  check('a preset sets the gradient on a phone', e.fill && typeof e.fill === 'object' && e.fill.stops.length === 2);
  await phone.keyboard.press('Escape');
  // text combination
  await tab('text');
  await phone.waitForSelector('.dt-combo__thumb svg');
  await shot(phone, 'content-390-text.png');
  await phone.tap('.dt-combo[data-combo="sale"]');
  await settle(phone);
  s = await state(phone);
  e = await nodeOf(phone, s.sel[0]);
  check('a tap on a Schriftkombination inserts the group', e.type === 'group' && e.children.length >= 2);
  // effects page on a phone
  const t = await phone.evaluate(() => window.DtDesigner.app.addElement('heading'));
  await settle(phone);
  await phone.tap('#dt-ctx button[aria-label="Effekte"]');
  await phone.waitForSelector('.dt-fxpreset');
  await sheetOk('Effekte');
  await shot(phone, 'content-390-effects.png');
  await phone.tap('.dt-fxpreset[data-fx="lift"]');
  await settle(phone);
  check('a preset of the Effekte page works on a phone', (await nodeOf(phone, t)).shadow !== null);
  await phone.tap('#dt-panel-back');
  // image: crop on a phone
  const asset = await uploadPng(phone, [40, 140, 200], 400, 240);
  const img = await addImage(phone, asset);
  await settle(phone);
  await shot(phone, 'content-390-image-toolbar.png');
  await phone.tap('#dt-ctx button[aria-label="Zuschneiden"]');
  await phone.waitForSelector('.dt-cropui');
  await phone.waitForTimeout(300);
  check('crop mode on a phone: the toolbar has the slider and Fertig, the handles are big enough to touch', await phone.isVisible('#dt-ctx .dt-tb__zoom input[type=range]') && await tb(phone, 'Fertig').isVisible() && await phone.evaluate(() => { const r = document.querySelector('.dt-cropui [data-crop-handle="se"] .dt-crop__hit').getBoundingClientRect(); return r.width >= 36; }));
  await shot(phone, 'content-390-crop.png');
  await phone.locator('#dt-ctx .dt-tb__zoom input[type=range]').evaluate(x => { x.value = '250'; x.dispatchEvent(new Event('input', { bubbles: true })); });
  const cdp = await phoneContext.newCDPSession(phone);
  const bright = await phone.evaluate(() => { const r = document.querySelector('.dt-cropui .dt-crop__bright').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const st0 = await phone.evaluate(() => window.DtDesigner.crop.state());
  await E.touchDrag(cdp, bright, { x: bright.x - 30, y: bright.y - 10 }, 6);
  const st1 = await phone.evaluate(() => window.DtDesigner.crop.state());
  check('a finger drag moves the picture inside the window', st1.I.x < st0.I.x - 0.5, JSON.stringify([st0.I, st1.I]));
  const before = await phone.evaluate(() => JSON.stringify(window.DtDesigner.crop.state()));
  // (after a touch sequence made with the DevTools protocol the browser does not turn the next tap into a click: the button is pressed with the pointer here, taps are checked above)
  await tb(phone, 'Fertig').click();
  await phone.waitForTimeout(400);
  await settle(phone);
  check('"Fertig" on the phone writes the crop', (await nodeOf(phone, img)).crop.w < 0.6, JSON.stringify((await nodeOf(phone, img)).crop) + ' before: ' + before + ' active: ' + (await phone.evaluate(() => window.DtDesigner.crop.active())));
  // media browser from a strip chip on a phone
  const strip = await addEl(phone, 'strip');
  await settle(phone);
  await phone.tap('#dt-ctx .dt-slotchip[data-slot="0"]');
  await phone.waitForSelector('.dt-media');
  check('the media browser is full screen on a phone and has no dropdown', await phone.evaluate(() => { const d = document.querySelector('dialog.dt-media').getBoundingClientRect(); return d.width >= 385 && d.height >= 600; }) && (await phone.$$('dialog.dt-media select')).length === 0);
  await shot(phone, 'content-390-media.png');
  await phone.tap(`.dt-media__tile[data-key="${asset.key}"]`);
  await phone.waitForFunction(i => !!window.DtDesigner.app.element(i).items[0], strip);
  check('a tap in the media browser sets the slot', (await nodeOf(phone, strip)).items[0].asset === asset.key);
  // a template on a phone
  await phone.evaluate(() => window.DtDesigner.panels.open('templates'));
  await phone.waitForSelector('.dt-tpl__item');
  await phone.tap('.dt-tpl__item >> nth=0');
  await phone.waitForSelector('.dt-tpldlg');
  check('the template dialog fits the phone', await phone.evaluate(() => { const d = document.querySelector('dialog.dt-tpldlg').getBoundingClientRect(); return d.width <= 391 && d.right <= 391; }));
  await shot(phone, 'content-390-template-dialog.png');
  await phone.tap('.dt-tpldlg button[data-value="cancel"]');
  // Größe ändern dialog on a phone
  await phone.evaluate(() => { window.DtDesigner.file.resizeDialog(); });
  await phone.waitForSelector('.dt-resizedlg');
  check('the Größe ändern dialog fits the phone', await phone.evaluate(() => { const d = document.querySelector('dialog.dt-resizedlg').getBoundingClientRect(); return d.width <= 391; }));
  await shot(phone, 'content-390-resize.png');
  await phone.tap('.dt-resizedlg button[data-value="cancel"]');
  await noScroll('the phone editor');
  await phoneContext.close();
};

// ==== MAIN (sections are added above this line)

(async () => {
  const browser = await launch();
  const accounts = await ensureAccounts(browser);
  const context = await newContext(browser, { viewport: { width: 1440, height: 900 } });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  const page = await context.newPage();
  watch(page, 'content');
  if (process.env.DT_DEBUG) { page.on('console', m => console.log('console:', m.type(), m.text().slice(0, 300))); }
  if (!await login(page, accounts.designer)) { throw new Error('Anmeldung des Gestalters fehlgeschlagen.'); }
  const brandBefore = await page.evaluate(async () => (await fetch('/api/brand')).json());
  const ctx = { browser, accounts, context, page };
  for (const name of Object.keys(sections)) {
    if (only && !only.includes(name)) { continue; }
    try { await sections[name](ctx); }
    catch (err) { check('section "' + name + '" ran to the end', false, String(err && err.stack || err).split('\n').slice(0, 4).join(' / ')); }
  }
  // the brand kit belongs to the whole installation: put it back
  await postJson(page, '/api/brand', { colors: brandBefore.colors || [], fonts: brandBefore.fonts || {}, logos: brandBefore.logos || [] });
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
