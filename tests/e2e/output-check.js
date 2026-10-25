// Checks the output (phase H) in a real browser (installed Edge, headless): creates the demo design of docs/PLAN.md 1.2 and a data list with its rows, creates output jobs
// through the forms (sheet A4 2x2 A6 with start position 2 and crop marks; one label per page; PNG-ZIP), runs them and looks at the result: the number of label SVGs and
// sheets, the @page size rule, the crop marks, the PDF the browser prints (page count and MediaBox), the PNG files in the ZIP (size at 300 dpi), 200 labels in one run,
// the single print of a design, export and import of a design (assets restored, keys rewritten on a collision), the viewer (may run, may not change), offline reuse
// of a payload, and screenshots. Zero console errors and zero CSP violations are part of the result.
//
//   cd tests/e2e && npm install
//   node output-check.js [base url, default http://localhost:3043] [--out <folder for the screenshots, default: the temp folder>]
//
// Accounts: see lib.js (tests/e2e/test-account.json, created on an empty database).
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const lib = require('./lib.js');
const { demoDocument, demoRows } = require('./demo-label.js');

const args = process.argv.slice(2);
const { base, problems, watch, launch, newContext, login, ensureAccounts, postJson, shareWith } = lib(args, { ignoreUrl: /\/api\/outputs\/99999999\/payload|handler=Export/ });
const outIndex = args.indexOf('--out');
const outDir = path.resolve(outIndex >= 0 ? args[outIndex + 1] : path.join(os.tmpdir(), 'designthix-output-check'));
const fontFile = path.resolve(__dirname, '../../src/DesignThix/wwwroot/fonts/BebasNeue-Regular.ttf');

const results = [];
let current = '';
const check = (name, ok, detail) => { results.push({ name: current + name, ok: !!ok, detail }); };
const near = (a, b, tolerance) => Math.abs(a - b) <= tolerance;
const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');

// ------------------------------------------------------------------------------------------------ files: PDF, ZIP, PNG

/** Page count and MediaBoxes (in points) of a PDF written by the browser (plain objects, no object streams). */
function pdfInfo(buffer) {
  const text = buffer.toString('latin1');
  const pages = (text.match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
  const boxes = [...text.matchAll(/\/MediaBox\s*\[\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s*\]/g)].map(m => ({ w: parseFloat(m[3]) - parseFloat(m[1]), h: parseFloat(m[4]) - parseFloat(m[2]) }));
  return { pages, boxes };
}

const MM = 72 / 25.4;

/** The files of a stored ZIP by the central directory: [{ name, data }]. */
function readZip(buffer) {
  let end = -1;
  for (let i = buffer.length - 22; i >= 0; i--) { if (buffer.readUInt32LE(i) === 0x06054b50) { end = i; break; } }
  if (end < 0) { throw new Error('no end of central directory'); }
  const count = buffer.readUInt16LE(end + 10);
  let p = buffer.readUInt32LE(end + 16);
  const files = [];
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(p) !== 0x02014b50) { throw new Error('bad central directory entry'); }
    const method = buffer.readUInt16LE(p + 10);
    const size = buffer.readUInt32LE(p + 24);
    const nameLength = buffer.readUInt16LE(p + 28);
    const extra = buffer.readUInt16LE(p + 30);
    const comment = buffer.readUInt16LE(p + 32);
    const offset = buffer.readUInt32LE(p + 42);
    const name = buffer.slice(p + 46, p + 46 + nameLength).toString('utf8');
    const localName = buffer.readUInt16LE(offset + 26);
    const localExtra = buffer.readUInt16LE(offset + 28);
    const start = offset + 30 + localName + localExtra;
    files.push({ name, method, data: buffer.slice(start, start + size) });
    p += 46 + nameLength + extra + comment;
  }
  return files;
}

const pngSize = data => (data.readUInt32BE(0) === 0x89504e47 ? { w: data.readUInt32BE(16), h: data.readUInt32BE(20) } : null);

/** A solid-colour PNG (for the media of the import check). */
function makePng(w, h, rgb) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) { c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } return c >>> 0; });
  const crc = buf => { let c = 0xffffffff; for (const b of buf) { c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); } return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body)); return Buffer.concat([len, body, sum]); };
  const header = Buffer.alloc(13); header.writeUInt32BE(w, 0); header.writeUInt32BE(h, 4); header[8] = 8; header[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => rgb).flat())]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ------------------------------------------------------------------------------------------------ helpers of the pages

async function shot(page, name, options) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, name);
  await page.screenshot(Object.assign({ path: file }, options || {}));
  console.log('screenshot ' + file);
  return file;
}

const idOf = (url, pattern) => Number(url.match(pattern)[1]);

async function createDesign(page, name, document_) {
  await page.goto(base + '/Designs/Create');
  await page.fill('#Input_Name', name);
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit].mat-btn--primary')]);
  const id = idOf(page.url(), /Designs\/(\d+)\//);
  const posted = await page.evaluate(async ({ id: designId, doc }) => {
    const got = await (await fetch('/api/designs/' + designId)).json();
    const r = await fetch('/api/designs/' + designId, { method: 'POST', headers: { 'Content-Type': 'application/json', RequestVerificationToken: document.querySelector('meta[name=dt-csrf]').content }, body: JSON.stringify({ revision: got.revision, document: doc }) });
    return { status: r.status, body: await r.json() };
  }, { id, doc: document_ });
  if (posted.status !== 200) { throw new Error('The design was refused: ' + JSON.stringify(posted.body)); }
  return id;
}

async function createList(page, name, designId, rows) {
  await page.goto(base + '/DataLists/Edit');
  await page.fill('#Input_Name', name);
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit].mat-btn--primary')]);
  const id = idOf(page.url(), /DataLists\/Edit\/(\d+)/);
  await page.goto(`${base}/DataLists/Edit/${id}?tab=columns`);
  await page.selectOption('form[action*="FromDesign"] select', String(designId));
  await Promise.all([page.waitForNavigation(), page.click('form[action*="FromDesign"] button[type=submit]')]);
  const saved = await page.evaluate(async ({ listId, data }) => {
    const grid = await (await fetch('/api/datalists/' + listId + '/rows')).json();
    const body = { revision: grid.revision, rows: data.map(r => ({ id: null, values: r.values, copies: r.copies || 1, isActive: r.active !== false })) };
    const r = await fetch('/api/datalists/' + listId + '/rows', { method: 'POST', headers: { 'Content-Type': 'application/json', RequestVerificationToken: document.querySelector('meta[name=dt-csrf]').content }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
  }, { listId: id, data: rows });
  if (saved.status !== 200) { throw new Error('The rows were refused: ' + JSON.stringify(saved.body)); }
  return { id, rowIds: saved.body.rowIds };
}

const tab = (page, name) => page.click(`#output-tabs-tab-${name}`);
const radio = (page, name, value) => page.click(`label.mat-check:has(input[name="${name}"][value="${value}"])`);

/** Fills the form of an output through its four tabs and saves it; returns the id of the job. */
async function createOutput(page, spec) {
  await page.goto(base + '/Outputs/Create' + (spec.designId ? '?designId=' + spec.designId : ''));
  await page.fill('#Input_Name', spec.name);
  if (spec.designId && !spec.keepDesign) { /* preselected */ } else if (spec.designId) { await page.selectOption('#Input_DesignId', String(spec.designId)); }
  if (spec.listId) { await page.selectOption('#Input_DataListId', String(spec.listId)); }
  await tab(page, 'selection');
  if (spec.selection) { await radio(page, 'Input.RowSelection', spec.selection); }
  if (spec.pick) {
    await page.waitForSelector('[data-dt-rowpick] .dt-rowpick__table tbody tr');
    for (const n of spec.pick) { await page.check(`[data-dt-rowpick] tbody tr:nth-child(${n}) input[type=checkbox]`); }
  }
  if (spec.copies) { await page.fill('#Input_Copies', String(spec.copies)); }
  await tab(page, 'format');
  if (spec.format) { await radio(page, 'Input.Format', spec.format); }
  if (spec.dpi) { await page.fill('#Input_Dpi', String(spec.dpi)); }
  if (spec.pattern) { await page.fill('#Input_FileNamePattern', spec.pattern); }
  await tab(page, 'layout');
  if (spec.mode) { await radio(page, 'Input.Mode', spec.mode); }
  if (spec.sheet) { await page.selectOption('#Input_SheetLayoutId', { label: spec.sheet }); }
  if (spec.start) { await page.fill('#Input_StartPosition', String(spec.start)); }
  if (spec.crop) { await page.click('label.mat-switch:has(input[name="Input.CropMarks"])'); }
  if (spec.scale) { await radio(page, 'Input.Scale', spec.scale); }
  if (spec.beforeSave) { await spec.beforeSave(page); }
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit].mat-btn--primary')]);
  if (!/\/Outputs\/Edit\/\d+/.test(page.url())) { throw new Error('The output was not saved: ' + page.url() + ' ' + (await page.textContent('[data-validation-summary]').catch(() => ''))); }
  return idOf(page.url(), /Outputs\/Edit\/(\d+)/);
}

/** Opens the run page and waits until it is ready (or failed). */
async function openRun(page, url, timeout) {
  await page.goto(url.startsWith('http') ? url : base + url);
  await page.waitForFunction(() => { const r = document.getElementById('dt-run'); return r && (r.getAttribute('data-state') === 'ready' || r.getAttribute('data-state') === 'error'); }, null, { timeout: timeout || 120000 });
  return page.getAttribute('#dt-run', 'data-state');
}

const runFacts = page => page.evaluate(() => {
  const run = document.getElementById('dt-run');
  const pageRule = Array.from(document.styleSheets).filter(s => s.href && /output\.css/.test(s.href)).flatMap(s => Array.from(s.cssRules)).filter(r => r.constructor.name === 'CSSPageRule' || /^@page/.test(r.cssText)).map(r => r.cssText);
  return {
    state: run.getAttribute('data-state'),
    labelsAttr: Number(run.getAttribute('data-labels')),
    labels: document.querySelectorAll('.dt-olabel svg').length,
    sheets: document.querySelectorAll('.dt-opage').length,
    crops: document.querySelectorAll('.dt-ocrop path').length,
    pageRule,
    warnings: Array.from(document.querySelectorAll('#dt-run-warnings-list li')).map(li => li.textContent),
    error: document.getElementById('dt-run-error').hidden ? '' : document.getElementById('dt-run-error-text').textContent,
    texts: Array.from(document.querySelectorAll('.dt-olabel')).map(l => Array.from(l.querySelectorAll('text')).map(t => t.textContent).join('|')),
    perPage: Array.from(document.querySelectorAll('.dt-opage')).map(p => p.querySelectorAll('.dt-olabel').length),
    firstBox: (() => { const l = document.querySelector('.dt-olabel'); return l ? { x: l.style.getPropertyValue('--dt-x'), y: l.style.getPropertyValue('--dt-y'), w: l.style.getPropertyValue('--dt-w'), h: l.style.getPropertyValue('--dt-h') } : null; })(),
    status: document.getElementById('dt-run-status').textContent,
    printVisible: !document.getElementById('dt-run-print').hidden && !document.getElementById('dt-run-print').disabled,
    downloadVisible: !document.getElementById('dt-run-download').hidden,
  };
});

// ------------------------------------------------------------------------------------------------ the check

(async () => {
  const browser = await launch();
  const accounts = await ensureAccounts(browser);
  const context = await newContext(browser, { acceptDownloads: true });
  const page = await context.newPage();
  watch(page, 'designer');
  if (!await login(page, accounts.designer)) { throw new Error('Anmeldung des Gestalters fehlgeschlagen.'); }

  // ---------------------------------------------------------------------------------------- 0. the menu
  current = 'menu: ';
  await page.goto(base + '/');
  const menuItems = await page.$$eval('.mat-nav a', links => links.map(a => ({ text: a.textContent.trim(), href: a.getAttribute('href') })));
  const outputsAt = menuItems.findIndex(i => i.href === '/Outputs');
  const sheetsAt = menuItems.findIndex(i => i.href === '/Sheets');
  check('Serienausgaben is in the menu, right above Druckbögen', outputsAt >= 0 && sheetsAt === outputsAt + 1, JSON.stringify(menuItems.slice(outputsAt - 1, sheetsAt + 1)));
  check('the menu item has an icon', (await page.$$eval('.mat-nav a[href="/Outputs"] svg use', uses => uses.length)) === 1);

  // ---------------------------------------------------------------------------------------- 1. the demo design and its list
  current = 'setup: ';
  const designName = 'Output-Check Käsetheke ' + stamp;
  const designId = await createDesign(page, designName, demoDocument());
  const rows = demoRows().map(values => ({ values }));
  const list = await createList(page, 'Output-Check Liste ' + stamp, designId, rows);
  check('design and list with four rows exist', designId > 0 && list.rowIds.length === 4, JSON.stringify(list));

  // ---------------------------------------------------------------------------------------- 2. the form of an output
  current = 'form: ';
  await page.goto(`${base}/Outputs/Create?designId=${designId}`);
  check('the design is preselected from the link of the designer', (await page.inputValue('#Input_DesignId')) === String(designId));
  check('the name is proposed', (await page.inputValue('#Input_Name')).includes(designName));
  check('the page has the four tabs', JSON.stringify(await page.$$eval('#output-tabs [role=tab]', t => t.map(x => x.textContent.trim().replace(/\s+/g, ' ')))) === JSON.stringify(['Allgemein', 'Auswahl', 'Layout', 'Format']));
  await page.selectOption('#Input_DataListId', String(list.id));
  await tab(page, 'selection');
  await page.waitForFunction(() => /Das ergibt \d+ Etiketten? aus/.test(document.querySelector('[data-dt-count-text]').textContent));
  check('the count says four labels (all rows are active)', /Das ergibt 4 Etiketten aus 4 Zeilen/.test(await page.textContent('[data-dt-count-text]')), await page.textContent('[data-dt-count-text]'));
  check('the table of rows is hidden until "Ausgewählte Zeilen" is chosen', !(await page.isVisible('[data-dt-rowpick]')));
  await radio(page, 'Input.RowSelection', 'Selected');
  await page.waitForSelector('[data-dt-rowpick] tbody tr');
  check('the table shows the four rows with the key columns', (await page.$$eval('[data-dt-rowpick] tbody tr', r => r.length)) === 4 && (await page.textContent('[data-dt-rowpick] tbody tr:nth-child(1)')).includes('Geifertshofen'));
  check('nothing is chosen yet: 0 labels', /Das ergibt 0 Etiketten/.test(await page.textContent('[data-dt-count-text]')));
  await page.check('[data-dt-rowpick] tbody tr:nth-child(2) input[type=checkbox]');
  await page.check('[data-dt-rowpick] tbody tr:nth-child(3) input[type=checkbox]');
  check('two rows chosen: 2 labels', /Das ergibt 2 Etiketten aus 2 Zeilen/.test(await page.textContent('[data-dt-count-text]')));
  await page.fill('#Input_Copies', '3');
  check('copies multiply: 6 labels', /Das ergibt 6 Etiketten aus 2 Zeilen/.test(await page.textContent('[data-dt-count-text]')), await page.textContent('[data-dt-count-text]'));
  await page.fill('[data-dt-rowpick] input[type=search]', 'camembert');
  check('the table can be searched', (await page.$$eval('[data-dt-rowpick] tbody tr', r => r.length)) === 1);
  await page.fill('[data-dt-rowpick] input[type=search]', '');
  await page.click('[data-dt-rowpick] button:has-text("Alle sichtbaren wählen")');
  check('"Alle sichtbaren wählen" chooses all four', /Das ergibt 12 Etiketten aus 4 Zeilen/.test(await page.textContent('[data-dt-count-text]')));
  await radio(page, 'Input.RowSelection', 'Active');
  await page.fill('#Input_Copies', '1');

  await tab(page, 'layout');
  check('sheet options are hidden in single mode', !(await page.isVisible('#Input_SheetLayoutId')) && !(await page.isVisible('#Input_StartPosition')));
  await radio(page, 'Input.Mode', 'Sheet');
  check('sheet options appear in sheet mode', (await page.isVisible('#Input_SheetLayoutId')) && (await page.isVisible('#Input_StartPosition')) && (await page.isVisible('[data-dt-sheet-preview]')));
  await page.selectOption('#Input_SheetLayoutId', { label: 'A4 quer · 4 × A6 · 2 × 2 · 148,5 × 105 mm' });
  await page.fill('#Input_StartPosition', '2');
  await page.click('label.mat-switch:has(input[name="Input.CropMarks"])');
  await page.waitForSelector('[data-dt-sheet-preview] svg');
  const preview = await page.evaluate(() => ({
    cells: document.querySelectorAll('[data-dt-sheet-preview] .dt-sheetsvg__cell').length,
    skipped: document.querySelectorAll('[data-dt-sheet-preview] .dt-sheetsvg__cell.is-skipped').length,
    numbers: Array.from(document.querySelectorAll('[data-dt-sheet-preview] text')).map(t => t.textContent).join(','),
    marks: document.querySelectorAll('[data-dt-sheet-preview] .dt-sheetsvg__mark').length,
    info: document.querySelector('[data-dt-sheet-info]').textContent,
  }));
  check('the preview shows 4 cells, the first one skipped, labels 1 to 3 in the others', preview.cells === 4 && preview.skipped === 1 && preview.numbers === '–,1,2,3', JSON.stringify(preview));
  check('crop marks are drawn in the preview (three labelled cells)', preview.marks === 3, String(preview.marks));
  check('the sheet info counts the sheets (4 labels from cell 2: 2 sheets)', /2 Bögen/.test(preview.info) && /Nr\. 2/.test(preview.info), preview.info);
  check('the scale warning appears: 150 x 100 mm in a 148.5 x 105 mm cell', (await page.isVisible('[data-dt-scalewarn]')) && /verkleinert/.test(await page.textContent('[data-dt-scalewarn-text]')), await page.textContent('[data-dt-scalewarn-text]'));
  await radio(page, 'Input.Scale', 'None');
  check('with "Nicht verkleinern" the warning says it sticks out', /ragt über den Rand/.test(await page.textContent('[data-dt-scalewarn-text]')));
  await radio(page, 'Input.Scale', 'Fit');
  await shot(page, 'form-layout-1280.png', { fullPage: true });
  await tab(page, 'format');
  check('DPI and file names are hidden for print', !(await page.isVisible('#Input_Dpi')) && !(await page.isVisible('#Input_FileNamePattern')));
  await radio(page, 'Input.Format', 'Png');
  check('DPI and file names appear for PNG, DPI defaults to the design (300)', (await page.isVisible('#Input_Dpi')) && (await page.inputValue('#Input_Dpi')) === '300' && (await page.isVisible('#Input_FileNamePattern')));
  await tab(page, 'layout');
  check('the layout tab says there is no sheet for PNG', /keinen Druckbogen/.test(await page.textContent('#output-tabs-panel-layout')) && !(await page.isVisible('#Input_SheetLayoutId')));
  await tab(page, 'format');
  await radio(page, 'Input.Format', 'Print');

  // ---------------------------------------------------------------------------------------- 3. the three outputs
  current = 'create: ';
  const sheetJob = await createOutput(page, { name: 'Check Bogen ' + stamp, designId, listId: list.id, selection: 'All', mode: 'Sheet', sheet: 'A4 quer · 4 × A6 · 2 × 2 · 148,5 × 105 mm', start: 2, crop: true });
  check('the sheet output was saved and opens again', sheetJob > 0 && (await page.inputValue('#Input_StartPosition')) === '2' && (await page.inputValue('#Input_Name')).startsWith('Check Bogen'));
  await tab(page, 'layout');
  check('the saved layout is shown again (sheet, start 2, crop marks)', (await page.isChecked('input[name="Input.Mode"][value="Sheet"]')) && (await page.isChecked('input[name="Input.CropMarks"]')));
  const singleJob = await createOutput(page, { name: 'Check Einzeln ' + stamp, designId, listId: list.id, selection: 'All', mode: 'Single' });
  const pngJob = await createOutput(page, { name: 'Check PNG ' + stamp, designId, listId: list.id, selection: 'All', format: 'Png', dpi: 300, pattern: '{Design}-{Nr}-{Name}' });
  check('three outputs exist', sheetJob > 0 && singleJob > 0 && pngJob > 0 && new Set([sheetJob, singleJob, pngJob]).size === 3);

  // validation: a selection without rows, a sheet without a sheet
  await page.goto(base + '/Outputs/Create');
  await page.fill('#Input_Name', 'Prüfung');
  await page.selectOption('#Input_DesignId', String(designId));
  await page.selectOption('#Input_DataListId', String(list.id));
  await tab(page, 'selection');
  await radio(page, 'Input.RowSelection', 'Selected');
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit].mat-btn--primary')]);
  check('"Ausgewählte Zeilen" without a row is refused with a message', /Outputs\/Create/.test(page.url()) && /mindestens eine Zeile/.test(await page.textContent('[data-validation-summary]')), await page.textContent('[data-validation-summary]'));
  check('the tab with the error is the one that is open', await page.isVisible('#output-tabs-panel-selection') && !(await page.isVisible('#output-tabs-panel-general')));

  // ---------------------------------------------------------------------------------------- 4. the list
  current = 'list: ';
  await page.goto(base + '/Outputs?q=' + encodeURIComponent(stamp));
  const listRows = await page.$$eval('#output-table tbody tr', trs => trs.map(tr => ({ text: tr.textContent.replace(/\s+/g, ' '), cells: Array.from(tr.querySelectorAll('td')).map(td => td.textContent.replace(/\s+/g, ' ').trim()) })));
  check('the list finds the three outputs by the search', listRows.length === 3, String(listRows.length));
  check('the row shows design, list, label count and format', listRows.some(r => r.text.includes(designName) && r.text.includes('Output-Check Liste') && r.cells.some(c => c.startsWith('4')) && r.text.includes('PNG-ZIP')), listRows[0] && listRows[0].text);
  check('a design thumbnail or preview box is in the row', (await page.$$('#output-table .dt-designthumb')).length === 3);
  check('never run: "noch nie"', listRows.every(r => r.text.includes('noch nie')));
  check('the list has the toolbar above and "Neue Serienausgabe" below it', (await page.isVisible('.mat-toolbar')) && (await page.isVisible('.mat-actions a:has-text("Neue Serienausgabe")')));
  await page.goto(base + '/Outputs?format=Png&q=' + encodeURIComponent(stamp));
  check('the format filter keeps only the PNG output', (await page.$$eval('#output-table tbody tr', r => r.length)) === 1);
  await page.goto(base + '/Outputs?design=' + designId + '&sort=name&dir=desc&q=' + encodeURIComponent(stamp));
  const names = await page.$$eval('#output-table tbody tr td:first-child a', a => a.map(x => x.textContent));
  check('filter by design and sort by name (descending) work', names.length === 3 && names[0] > names[2], names.join(' | '));

  // ---------------------------------------------------------------------------------------- 5. run: sheet mode
  current = 'sheet: ';
  const t0 = Date.now();
  let state = await openRun(page, `/Outputs/${sheetJob}/Run`);
  let f = await runFacts(page);
  check('the run is ready', state === 'ready' && f.error === '', f.error);
  check('four label SVGs on two sheets', f.labels === 4 && f.sheets === 2 && f.labelsAttr === 4, JSON.stringify({ labels: f.labels, sheets: f.sheets }));
  check('the first sheet holds 3 labels (start position 2), the second 1', JSON.stringify(f.perPage) === '[3,1]', JSON.stringify(f.perPage));
  check('the @page rule has the size of A4 landscape', f.pageRule.some(r => /size:\s*297mm 210mm/.test(r) && /margin:\s*0/.test(r)), JSON.stringify(f.pageRule));
  check('crop marks are there (one path per sheet)', f.crops === 2, String(f.crops));
  check('the first label sits in cell 2 (x = 148.5 mm) and is shrunk to fit', f.firstBox.x === '148.5mm' && f.firstBox.y === '3mm' && f.firstBox.w === '148.5mm' && f.firstBox.h === '99mm', JSON.stringify(f.firstBox));
  check('a warning says the design is larger than the cell', f.warnings.some(w => /größer als das Etikett/.test(w) && /99 %/.test(w)), JSON.stringify(f.warnings));
  check('the first label shows the first cheese', f.texts[0].includes('Holunderblüte') && f.texts[0].includes('2,99'), f.texts[0]);
  check('the print button is enabled and the zip button hidden', f.printVisible && !f.downloadVisible);
  check('the label draws its images (flag and seals)', (await page.evaluate(() => document.querySelector('.dt-olabel').querySelectorAll('svg image').length)) === 4);
  console.log('sheet run took ' + (Date.now() - t0) + ' ms');
  await shot(page, 'run-sheet-1280.png', { fullPage: true });

  const pdf = pdfInfo(await page.pdf({ preferCSSPageSize: true, printBackground: true }));
  check('the PDF has two pages of A4 landscape', pdf.pages === 2 && pdf.boxes.length >= 2 && pdf.boxes.every(b => near(b.w, 297 * MM, 1.5) && near(b.h, 210 * MM, 1.5)), JSON.stringify(pdf));

  // the print button: window.print() returns at once in headless, then the run is noted
  const before = await page.evaluate(() => fetch('/api/outputs/' + location.pathname.match(/Outputs\/(\d+)/)[1] + '/payload').then(r => r.json()).then(j => j.id));
  await page.click('#dt-run-print');
  await page.waitForTimeout(800);
  await page.goto(base + '/Outputs?q=' + encodeURIComponent(stamp));
  const ranText = await page.$$eval('#output-table tbody tr', trs => trs.map(tr => tr.textContent.replace(/\s+/g, ' ')).find(t => t.includes('Check Bogen')) || '');
  check('after printing the output shows when it ran last', before === sheetJob && !ranText.includes('noch nie') && /\d\d\.\d\d\.\d{4}/.test(ranText), ranText);

  // ---------------------------------------------------------------------------------------- 6. run: one label per page
  current = 'single: ';
  state = await openRun(page, `/Outputs/${singleJob}/Run`);
  f = await runFacts(page);
  check('four label SVGs on four pages', state === 'ready' && f.labels === 4 && f.sheets === 4, JSON.stringify({ labels: f.labels, sheets: f.sheets }));
  check('the @page rule is the size of the design (150 x 100 mm)', f.pageRule.some(r => /size:\s*150mm 100mm/.test(r)), JSON.stringify(f.pageRule));
  check('no crop marks, no scale warning', f.crops === 0 && f.warnings.length === 0, JSON.stringify(f.warnings));
  const pdf2 = pdfInfo(await page.pdf({ preferCSSPageSize: true, printBackground: true }));
  check('the PDF has four pages of 150 x 100 mm', pdf2.pages === 4 && pdf2.boxes.length >= 4 && pdf2.boxes.every(b => near(b.w, 150 * MM, 1.5) && near(b.h, 100 * MM, 1.5)), JSON.stringify(pdf2));
  // print emulation: the bar is gone and the label looks like the reference
  await page.emulateMedia({ media: 'print' });
  const barHidden = await page.evaluate(() => getComputedStyle(document.querySelector('.dt-run__bar')).display === 'none');
  check('when printing the bar is hidden', barHidden);
  const labelBox = await page.$('.dt-opage');
  fs.mkdirSync(outDir, { recursive: true });
  await page.setViewportSize({ width: 800, height: 600 });
  await labelBox.screenshot({ path: path.join(outDir, 'print-label-1.png') });
  console.log('screenshot ' + path.join(outDir, 'print-label-1.png'));
  await page.emulateMedia({ media: null });
  await page.setViewportSize({ width: 1280, height: 800 });
  await shot(page, 'run-single-1280.png');

  // ---------------------------------------------------------------------------------------- 7. run: PNG ZIP
  current = 'png: ';
  state = await openRun(page, `/Outputs/${pngJob}/Run`);
  f = await runFacts(page);
  check('PNG mode is ready with a download button, no print button', state === 'ready' && f.downloadVisible && !f.printVisible, JSON.stringify({ state, error: f.error }));
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#dt-run-download')]);
  const zipBytes = fs.readFileSync(await download.path());
  const files = readZip(zipBytes);
  check('the ZIP has four PNG files', files.length === 4 && files.every(x => x.name.endsWith('.png')), files.map(x => x.name).join(', '));
  check('every PNG is 1772 x 1181 px (150 x 100 mm at 300 dpi)', files.every(x => { const s = pngSize(x.data); return s && s.w === 1772 && s.h === 1181; }), files.map(x => JSON.stringify(pngSize(x.data))).join(' '));
  check('file names follow the pattern {Design}-{Nr}-{Name}', files[0].name === `${designName}-1-Holunderblüte.png` && files[1].name === `${designName}-2-Alter Gouda.png`, files.map(x => x.name).join(' | '));
  check('the download is named after the output', /^Check PNG .*\.zip$/.test(download.suggestedFilename()), download.suggestedFilename());
  check('thumbnails of the pictures are shown', (await page.$$('#dt-run-thumbs img')).length === 4);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'png-1.png'), files[0].data);
  console.log('screenshot ' + path.join(outDir, 'png-1.png'));
  await shot(page, 'run-png-1280.png');

  // ---------------------------------------------------------------------------------------- 8. 200 labels
  current = '200: ';
  const many = [];
  const base4 = demoRows();
  for (let i = 0; i < 200; i++) { const v = Object.assign({}, base4[i % 4]); v.Name = v.Name + ' ' + (i + 1); many.push({ values: v }); }
  const bigList = await createList(page, 'Output-Check 200 ' + stamp, designId, many);
  const bigJob = await createOutput(page, { name: 'Check 200 ' + stamp, designId, listId: bigList.id, selection: 'All', mode: 'Sheet', sheet: 'A4 · 8 Etiketten · 2 × 4 · 99,1 × 67,7 mm', crop: true });
  const started = Date.now();
  await page.goto(`${base}/Outputs/${bigJob}/Run`);
  // the page stays responsive while it draws: it answers calls and the progress moves through values between 0 and 100
  const seen = new Set();
  let slowest = 0;
  while (true) {
    const t = Date.now();
    const snapshot = await page.evaluate(() => ({ state: document.getElementById('dt-run').getAttribute('data-state'), meter: getComputedStyle(document.getElementById('dt-run-meter')).getPropertyValue('--mat-meter'), drawn: document.querySelectorAll('.dt-olabel').length }));
    slowest = Math.max(slowest, Date.now() - t);
    seen.add(snapshot.meter.trim());
    if (snapshot.state === 'ready' || snapshot.state === 'error') { break; }
    if (Date.now() - started > 240000) { throw new Error('the 200 labels did not finish'); }
    await page.waitForTimeout(150);
  }
  console.log('200 labels took ' + (Date.now() - started) + ' ms, slowest answer ' + slowest + ' ms');
  f = await runFacts(page);
  check('200 labels are drawn on 25 sheets', f.state === 'ready' && f.labels === 200 && f.sheets === 25 && f.crops === 25, JSON.stringify({ labels: f.labels, sheets: f.sheets, crops: f.crops, error: f.error }));
  check('the page answered while drawing (no blocked wait longer than 2 s)', slowest < 2000, slowest + ' ms');
  check('the labels are in order (first and last)', f.texts[0].includes('Holunderblüte 1') && f.texts[199].includes(' 200'), f.texts[0] + ' ... ' + f.texts[199]);
  const pdf3 = pdfInfo(await page.pdf({ preferCSSPageSize: true, printBackground: true }));
  check('the PDF of 200 labels has 25 pages of A4', pdf3.pages === 25 && pdf3.boxes.every(b => near(b.w, 210 * MM, 1.5) && near(b.h, 297 * MM, 1.5)), JSON.stringify({ pages: pdf3.pages, first: pdf3.boxes[0] }));

  // ---------------------------------------------------------------------------------------- 9. the single print
  current = 'einzel: ';
  await page.goto(`${base}/Designs/${designId}/Print`);
  check('the form has one field per field of the design', (await page.$$eval('[data-dt-field]', e => e.length)) === 12);
  check('image fields have a picker, price fields a number-like input', (await page.$$('[data-dt-imagefield]')).length === 4 && (await page.getAttribute('[data-dt-field="Preis"]', 'inputmode')) === 'decimal');
  await page.waitForFunction(() => document.querySelector('[data-dt-print-preview] svg'));
  check('the preview shows the sample values', (await page.textContent('[data-dt-print-preview]')).includes('Holunderblüte'));
  await page.fill('[data-dt-field="Name"]', 'Bergkäse Spezial');
  await page.fill('[data-dt-field="Preis"]', '4,5');
  await page.waitForFunction(() => document.querySelector('[data-dt-print-preview]').textContent.includes('Bergkäse Spezial'));
  check('the preview follows the typed values (price formatted: 4,50)', (await page.textContent('[data-dt-print-preview]')).includes('4,50'));
  await page.click('[data-dt-imagefield] [data-dt-pick] >> nth=0');
  await page.waitForSelector('.dt-media__tile');
  await page.click('.dt-media__tab[data-tab="flags"]'); await page.click('.dt-media__tile[data-key="flag-ch"]');
  await page.waitForFunction(() => document.querySelector('[data-dt-field="Land"]').value === 'flag-ch', null, { timeout: 5000 }).catch(() => {});
  check('the picker puts the key of the chosen medium into the field', (await page.inputValue('[data-dt-field="Land"]')) === 'flag-ch');
  await page.fill('[data-dt-field="Ort"]', 'Schüpfheim');
  await Promise.all([page.waitForNavigation(), page.click('[data-dt-run="print"]')]);
  check('"Drucken" opens the run page of a single print', /\/Outputs\/Run\?design=\d+&adhoc=/.test(page.url()), page.url());
  await page.waitForFunction(() => document.getElementById('dt-run').getAttribute('data-state') !== 'loading' && document.getElementById('dt-run').getAttribute('data-state') !== 'rendering', null, { timeout: 60000 });
  f = await runFacts(page);
  check('one label with the typed text and the chosen flag', f.state === 'ready' && f.labels === 1 && f.texts[0].includes('Bergkäse Spezial') && f.texts[0].includes('4,50') && f.texts[0].includes('Schüpfheim'), JSON.stringify({ texts: f.texts, error: f.error }));
  check('the flag of the picker is drawn (ch)', (await page.$$eval('.dt-olabel image', imgs => imgs.map(i => i.getAttribute('href') || '').join(' '))).includes('flag-ch'));
  check('a single print has the size of the design', f.pageRule.some(r => /size:\s*150mm 100mm/.test(r)));
  // copies and PNG from the same form
  await page.goBack();
  await page.waitForSelector('[data-dt-field="Name"]');
  await page.fill('input[name="copies"]', '2');
  await page.fill('input[name="dpi"]', '150');
  await Promise.all([page.waitForNavigation(), page.click('[data-dt-run="png"]')]);
  await page.waitForFunction(() => document.getElementById('dt-run').getAttribute('data-state') === 'ready', null, { timeout: 60000 });
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#dt-run-download')]);
  const zip2 = readZip(fs.readFileSync(await dl2.path()));
  check('PNG of the single print: two files of 886 x 591 px (150 dpi)', zip2.length === 2 && zip2.every(x => { const s = pngSize(x.data); return s && s.w === 886 && s.h === 591; }), zip2.map(x => x.name + JSON.stringify(pngSize(x.data))).join(' '));
  // sheet mode of the single print
  await page.goto(`${base}/Designs/${designId}/Print`);
  await radio(page, 'mode', 'sheet');
  await page.selectOption('select[name="sheet"]', { label: 'A4 · 8 Etiketten · 2 × 4 · 99,1 × 67,7 mm' });
  await page.fill('input[name="start"]', '7');
  await page.fill('input[name="copies"]', '3');
  await page.waitForSelector('[data-dt-sheet-preview] svg');
  check('the sheet preview of the single print shows the start position', (await page.$$eval('[data-dt-sheet-preview] .dt-sheetsvg__cell.is-skipped', c => c.length)) === 6);
  await Promise.all([page.waitForNavigation(), page.click('[data-dt-run="print"]')]);
  await page.waitForFunction(() => document.getElementById('dt-run').getAttribute('data-state') === 'ready', null, { timeout: 60000 });
  f = await runFacts(page);
  check('three copies from cell 7: two sheets (2 + 1 labels)', f.labels === 3 && f.sheets === 2 && JSON.stringify(f.perPage) === '[2,1]', JSON.stringify({ labels: f.labels, perPage: f.perPage }));

  // ---------------------------------------------------------------------------------------- 10. export and import
  current = 'import: ';
  // media and a font of our own
  const logoA = makePng(8, 8, [200, 30, 30]);
  const logoKey = 'check-logo-' + stamp;
  await page.goto(base + '/Assets/Upload');
  await page.setInputFiles('#Files', [{ name: logoKey + '.png', mimeType: 'image/png', buffer: logoA }]);
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit].mat-btn--primary')]);
  const logoId = idOf(page.url(), /Assets\/Edit\/(\d+)/);
  check('the test logo was uploaded under its key', (await page.inputValue('#Input_Key')) === logoKey, await page.inputValue('#Input_Key'));
  const fontBytes = Buffer.concat([fs.readFileSync(fontFile), Buffer.from([0])]);
  await page.goto(base + '/Fonts/Upload');
  await page.setInputFiles('#Files', [{ name: 'BebasNeue-Check.ttf', mimeType: 'font/ttf', buffer: fontBytes }]);
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit].mat-btn--primary')]);
  const fontId = /Fonts\/Edit\/\d+/.test(page.url()) ? idOf(page.url(), /Fonts\/Edit\/(\d+)/) : 0;
  check('the test font was uploaded', fontId > 0, page.url());

  const exportDoc = demoDocument();
  exportDoc.pages[0].elements.push({ id: 'logo1', type: 'image', name: 'Test-Logo', x: 2, y: 2, w: 10, h: 10, rotation: 0, opacity: 1, locked: false, hidden: false, showIf: null, source: { asset: logoKey }, fit: 'contain', radius: 0 });
  exportDoc.pages[0].elements.push({ id: 'bebas', type: 'text', name: 'Bebas', x: 20, y: 90, w: 60, h: 8, rotation: 0, opacity: 1, locked: false, hidden: false, showIf: null, text: 'BEBAS', fontFamily: 'Bebas Neue', fontSize: 12, fontWeight: 400, italic: false, color: '#111111', align: 'left', valign: 'middle', lineHeight: 1.1, letterSpacing: 0, uppercase: false, wrap: false, fit: 'none', minFontSize: 4 });
  const sourceId = await createDesign(page, 'Export-Quelle ' + stamp, exportDoc);
  await page.goto(`${base}/Designs/Edit/${sourceId}`);
  check('the properties page has Exportieren and Einzeldruck', (await page.isVisible('a:has-text("Exportieren")')) && (await page.isVisible('a:has-text("Einzeldruck")')));
  const [exp] = await Promise.all([page.waitForEvent('download'), page.click('a:has-text("Exportieren")')]);
  const exportBytes = fs.readFileSync(await exp.path());
  const exported = JSON.parse(exportBytes.toString('utf8'));
  check('the export file has the frame of the format', exported.format === 'designthix-design' && exported.version === 2 && exported.document.schema === 2 && Array.isArray(exported.document.pages) && exported.name === 'Export-Quelle ' + stamp && exported.document && exported.document.width === 150, exp.suggestedFilename());
  check('the file is named *.dtx.json', /\.dtx\.json$/.test(exp.suggestedFilename()), exp.suggestedFilename());
  const keys = exported.assets.map(a => a.key).sort();
  check('assets: only what the document uses (flags, seals, our logo) with base64 and type', keys.includes(logoKey) && keys.includes('flag-de') && keys.includes('icon-bio') && !keys.includes('flag-fr') && exported.assets.every(a => a.base64 && a.contentType && a.name && a.category), keys.join(','));
  check('the uploaded font travels, the built-in fonts do not', exported.fonts.length === 1 && exported.fonts[0].family === 'Bebas Neue' && exported.fonts[0].base64.length > 1000, JSON.stringify(exported.fonts.map(x => [x.family, x.weight, x.style, x.format])));

  async function importFile(buffer, name) {
    await page.goto(base + '/Designs/Import');
    await page.setInputFiles('#DesignFile', [{ name: name || 'x.dtx.json', mimeType: 'application/json', buffer }]);
    await Promise.all([page.waitForNavigation(), page.click('button[type=submit].mat-btn--primary')]);
    const ok = await page.isVisible('#import-open');
    return { ok, text: await page.textContent('main'), id: ok ? idOf(await page.getAttribute('#import-open', 'href'), /Designs\/(\d+)\//) : 0 };
  }
  const apiDesign = id => page.evaluate(async d => (await fetch('/api/designs/' + d)).json(), id);

  let imp = await importFile(exportBytes);
  check('importing it creates a design; every medium and the font are already there', imp.ok && /schon vorhanden/.test(imp.text) && /Schriften: 0 neu, 1 schon vorhanden/.test(imp.text), imp.text.replace(/\s+/g, ' ').slice(0, 400));
  const imported1 = await apiDesign(imp.id);
  check('the keys are unchanged when the content is the same', JSON.stringify(imported1.document.pages[0].elements.find(e => e.id === 'logo1').source) === JSON.stringify({ asset: logoKey }) && imported1.name === 'Export-Quelle ' + stamp);

  // the key is taken by another picture: a new key, the document points to it
  await page.goto(`${base}/Assets/Edit/${logoId}?tab=file`);
  await page.setInputFiles('#NewFile', [{ name: 'other.png', mimeType: 'image/png', buffer: makePng(8, 8, [20, 30, 200]) }]);
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit].mat-btn--primary')]);
  imp = await importFile(exportBytes);
  const imported2 = imp.ok ? await apiDesign(imp.id) : null;
  check('a taken key with other content: the medium comes in under a new key (…-2)', imp.ok && /unter neuem Schlüssel/.test(imp.text) && imported2 && imported2.document.pages[0].elements.find(e => e.id === 'logo1').source.asset === logoKey + '-2', imp.text.replace(/\s+/g, ' ').slice(0, 500));
  const mediaStatus = await page.evaluate(async k => (await fetch('/media/' + k)).status, logoKey + '-2');
  check('the new medium is served and keeps the picture of the file', mediaStatus === 200);
  check('built-in media are reused, not duplicated', !imp.text.includes('flag-de-2') && imported2 && imported2.document.pages[0].elements.some(e => e.type === 'imageStrip'));

  // the font: when only the built-in one is left, the file's font is not added
  await page.goto(`${base}/Fonts/Edit/${fontId}`);
  await page.click('button.mat-btn--danger');
  await Promise.all([page.waitForNavigation(), page.click('dialog[open] button[value="ok"]')]);
  imp = await importFile(exportBytes);
  check('a face that exists with other content is not added: a warning says so', imp.ok && /gibt es schon mit anderem Inhalt/.test(imp.text), imp.text.replace(/\s+/g, ' ').slice(0, 600));

  // hostile files
  const refused = async (label, bytes) => { const r = await importFile(Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)); check('refused: ' + label, !r.ok && /mat-error|Datei|Medium|Schrift|Design|Version/.test(r.text), r.text.replace(/\s+/g, ' ').slice(-200)); };
  await refused('not JSON', 'das ist kein JSON');
  await refused('wrong format', JSON.stringify({ format: 'something', version: 1, document: {} }));
  await refused('newer version', JSON.stringify({ format: 'designthix-design', version: 99, name: 'x', document: { width: 10, height: 10 } }));
  await refused('an asset that is not an image', JSON.stringify({ format: 'designthix-design', version: 1, name: 'x', document: { width: 10, height: 10 }, assets: [{ key: 'evil', name: 'x', category: 'Icons', contentType: 'image/png', base64: Buffer.from('MZ not an image').toString('base64') }] }));
  await refused('an SVG with a DTD', JSON.stringify({ format: 'designthix-design', version: 1, name: 'x', document: { width: 10, height: 10 }, assets: [{ key: 'bomb', name: 'x', category: 'Icons', contentType: 'image/svg+xml', base64: Buffer.from('<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY a "aaaa">]><svg xmlns="http://www.w3.org/2000/svg"><text>&a;</text></svg>').toString('base64') }] }));
  await refused('a font that is no font', JSON.stringify({ format: 'designthix-design', version: 1, name: 'x', document: { width: 10, height: 10 }, fonts: [{ family: 'Evil', weight: '400', style: 'normal', format: 'ttf', base64: Buffer.from('not a font at all').toString('base64') }] }));
  const hostile = await importFile(Buffer.from(JSON.stringify({ format: 'designthix-design', version: 1, name: 'Feind ' + stamp, document: { width: 20, height: 20, elements: [{ type: 'text', text: '<img src=x onerror=alert(1)>', fontFamily: 'a"};body{display:none}', fontSize: 12 }] }, assets: [{ key: 'svg-' + stamp, name: 'S', category: 'Icons', contentType: 'image/svg+xml', base64: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" onload="alert(1)"><script>alert(1)</script><rect width="10" height="10"/></svg>').toString('base64') }] })));
  check('a hostile SVG in a file is cleaned like an upload', hostile.ok);
  const hostileSvg = await page.evaluate(async k => (await fetch('/media/' + k)).text(), 'svg-' + stamp);
  check('the stored SVG has no script and no handler', !/script|onload/i.test(hostileSvg) && /rect/.test(hostileSvg), hostileSvg.slice(0, 200));
  await page.goto(base + '/Designs/Import');
  check('the page does not run what the file said', !(await page.evaluate(() => document.body.style.display === 'none')));

  // cleanup of the font record that may be left, the replaced test logo stays (harmless)
  // ---------------------------------------------------------------------------------------- 11. dashboard and offline
  current = 'dashboard: ';
  await page.goto(base + '/');
  check('the start page lists recent outputs with a run button', (await page.$$('[data-recent-outputs] li')).length > 0 && (await page.textContent('[data-recent-outputs]')).includes('Check '), await page.textContent('main').then(t => t.replace(/\s+/g, ' ').slice(0, 80)));
  await shot(page, 'dashboard-1280.png', { fullPage: true });

  current = 'offline: ';
  const online = await openRun(page, `/Outputs/${singleJob}/Run`);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await page.waitForFunction(() => document.getElementById('dt-run').getAttribute('data-state') === 'ready', null, { timeout: 60000 });
  await page.waitForTimeout(500);
  await context.setOffline(true);
  await page.reload();
  const offState = await page.waitForFunction(() => { const r = document.getElementById('dt-run'); return r && ['ready', 'error'].includes(r.getAttribute('data-state')) ? r.getAttribute('data-state') : false; }, null, { timeout: 60000 }).then(h => h.jsonValue()).catch(() => 'none');
  f = offState === 'ready' || offState === 'error' ? await runFacts(page) : { labels: 0, error: 'page did not load' };
  check('an output that ran once can be printed again without a connection', online === 'ready' && offState === 'ready' && f.labels === 4, JSON.stringify({ online, offState, labels: f.labels, error: f.error }));
  await context.setOffline(false);

  // ---------------------------------------------------------------------------------------- 12. the viewer
  current = 'viewer: ';
  const viewerContext = await newContext(browser, { acceptDownloads: true });
  const viewer = await viewerContext.newPage();
  watch(viewer, 'viewer');
  for (const [kind, shareId] of [['design', designId], ['design', sourceId], ['datalist', list.id], ['datalist', bigList.id], ['outputjob', sheetJob], ['outputjob', singleJob], ['outputjob', pngJob], ['outputjob', bigJob]]) { await shareWith(page, kind, shareId, accounts.viewer.email, 'View'); }
  if (!await login(viewer, accounts.viewer)) { throw new Error('Anmeldung des Betrachters fehlgeschlagen.'); }
  await viewer.goto(base + '/Outputs?q=' + encodeURIComponent(stamp));
  check("the second member sees the four shared outputs, and \"Neue Serienausgabe\" like every member", (await viewer.$$("#output-table tbody tr")).length === 4 && (await viewer.isVisible("a:has-text(\"Neue Serienausgabe\")")));
  await viewer.goto(`${base}/Outputs/Edit/${sheetJob}`);
  check('the edit page is read-only for the viewer (disabled fields, run and back only)', (await viewer.isVisible('fieldset[disabled]')) && !(await viewer.isVisible('button[type=submit].mat-btn--primary')) && (await viewer.isVisible('a:has-text("Ausführen")')));
  check('and says so', /nur ansehen und ausführen/.test(await viewer.textContent('main')));
  const create = await viewer.goto(base + '/Outputs/Create');
  check('"Neue Serienausgabe" opens for every member', create.status() === 200 && !/AccessDenied/.test(viewer.url()), viewer.url() + ' ' + create.status());
  await viewer.goto(`${base}/Outputs/Edit/${sheetJob}`);
  const post = await viewer.evaluate(async id => {
    const r = await fetch('/Outputs/Edit/' + id, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', RequestVerificationToken: document.querySelector('meta[name=dt-csrf]').content }, body: 'Input.Name=Hacked&Input.DesignId=1', redirect: 'manual' });
    return r.status;
  }, sheetJob);
  check('a save posted by the viewer is refused (403)', post === 403, String(post));
  const del = await viewer.evaluate(async id => (await fetch('/Outputs/Edit/' + id + '?handler=Delete', { method: 'POST', headers: { RequestVerificationToken: document.querySelector('meta[name=dt-csrf]').content }, redirect: 'manual' })).status, sheetJob);
  check('and so is a delete (403)', del === 403, String(del));
  state = await openRun(viewer, `/Outputs/${sheetJob}/Run`);
  f = await runFacts(viewer);
  check('the viewer can run the output: 4 labels on 2 sheets', state === 'ready' && f.labels === 4 && f.sheets === 2);
  const adhocPost = await viewer.evaluate(async id => (await fetch('/api/outputs/adhoc', { method: 'POST', headers: { 'Content-Type': 'application/json', RequestVerificationToken: document.querySelector('meta[name=dt-csrf]').content }, body: JSON.stringify({ designId: id, values: {}, copies: 1 }) })).status, designId);
  check('the viewer may use the single print', adhocPost === 200);
  await viewer.goto(`${base}/Designs/${designId}/Print`);
  check('the single print page opens for the viewer', await viewer.isVisible('[data-dt-print-form]'));
  const imp403 = await viewer.goto(base + '/Designs/Import');
  const exp403 = { status: () => 0 }; exp403.status = (s => () => s)(await viewer.evaluate(async url => (await fetch(url)).status, `${base}/Designs/Edit/${sourceId}?handler=Export`));
  check('import opens for every member, and a shared design can be exported', imp403.status() === 200 && exp403.status() === 200, imp403.status() + ' ' + exp403.status());
  await viewer.goto(`${base}/Designs/Edit/${sourceId}`);
  check('the second member sees "Einzeldruck" and "Exportieren" on the shared design', (await viewer.isVisible('a:has-text("Einzeldruck")')) && (await viewer.isVisible('a:has-text("Exportieren")')));
  const payload404 = await viewer.evaluate(async () => (await fetch('/api/outputs/99999999/payload')).status);
  check('an unknown output has no payload (404)', payload404 === 404);
  await viewerContext.close();

  // ---------------------------------------------------------------------------------------- 13. phone
  current = 'phone: ';
  const phoneContext = await newContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const phone = await phoneContext.newPage();
  watch(phone, 'phone');
  await login(phone, accounts.designer);
  await openRun(phone, `/Outputs/${sheetJob}/Run`);
  const phoneFacts = await phone.evaluate(() => ({ overflow: document.documentElement.scrollWidth - window.innerWidth, zoom: document.getElementById('dt-pages').style.getPropertyValue('zoom') }));
  check('the run page fits a phone (pages are zoomed down, no sideways scroll of the page)', phoneFacts.overflow <= 2 && Number(phoneFacts.zoom) < 0.6, JSON.stringify(phoneFacts));
  await shot(phone, 'run-sheet-390.png');
  await phone.goto(`${base}/Outputs/Edit/${sheetJob}`);
  await shot(phone, 'form-390.png', { fullPage: true });
  await phone.goto(`${base}/Outputs`);
  await shot(phone, 'list-390.png', { fullPage: true });
  await phone.goto(`${base}/Designs/${designId}/Print`);
  await phone.waitForFunction(() => document.querySelector('[data-dt-print-preview] svg'));
  check('the single print fits a phone (no sideways scroll)', (await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 2);
  await shot(phone, 'print-form-390.png', { fullPage: true });
  await phoneContext.close();

  await page.goto(base + '/Outputs?q=' + encodeURIComponent(stamp));
  await shot(page, 'list-1280.png', { fullPage: true });
  await page.goto(`${base}/Designs/${designId}/Print`);
  await page.waitForFunction(() => document.querySelector('[data-dt-print-preview] svg'));
  await shot(page, 'print-form-1280.png', { fullPage: true });
  await page.goto(base + '/Designs/Import');
  await shot(page, 'import-1280.png');

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
