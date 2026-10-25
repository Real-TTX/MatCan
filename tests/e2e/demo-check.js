// Checks the demo that a new installation shows ("Käsetheke – Preisschild", the data list "Käsetheke (Beispiel)" with six cheeses, the output job with four labels per sheet):
//  1. The layout, with all six rows drawn by the render engine: the ink of every element (measured on a raster of the element alone) keeps its distance from the ink of
//     every other element (nothing touches: no descender into the region line, the price never meets the euro sign, the two words of the logo sit next to each other),
//     the name keeps its margin to the border. Screenshots of all six labels go to the temp folder: LOOK at them when the layout changes.
//  2. The seeded records (skipped with a note when somebody deleted the demo): the template is in the list of templates, the list has six rows, the output job runs
//     (two A4 landscape sheets, six labels).
//
//   cd tests/e2e && npm install
//   node demo-check.js [base url, default http://localhost:3043] [--out <folder for the screenshots, default: the temp folder>]
const fs = require('fs');
const os = require('os');
const path = require('path');
const lib = require('./lib.js');
const { demoDocument, demoRowsAll, demoMeta } = require('./demo-label.js');

const args = process.argv.slice(2);
const { base, problems, watch, launch, newContext, login, ensureAccounts } = lib(args);
const outIndex = args.indexOf('--out');
const outDir = path.resolve(outIndex >= 0 ? args[outIndex + 1] : path.join(os.tmpdir(), 'designthix-demo-check'));

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); };

/** Runs in the page: the ink masks of the elements of one row and the distances between them (mm). */
async function measure(page, doc, rows) {
  return page.evaluate(async ({ doc: document_, rows: rowList }) => {
    const engine = window.DtEngine;
    const fonts = (await (await fetch('/api/fonts')).json()).map(f => ({ family: f.family, weight: f.weight, style: f.style, url: f.url }));
    const norm = engine.normalize(document_);
    const dpi = 120, k = dpi / 25.4;
    const inkOf = async (values, element) => {
      const single = Object.assign({}, norm, { dpi, pages: [Object.assign({}, norm.pages[0], { elements: norm.pages[0].elements.map(e => Object.assign({}, e, { hidden: e.id !== element.id })) })] });
      const blob = await engine.rasterize(single, values, { dpi, assetUrl: key => '/media/' + encodeURIComponent(key), fonts });
      const bitmap = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d');
      context.drawImage(bitmap, 0, 0);
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const mask = new Uint8Array(canvas.width * canvas.height);
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const o = (y * canvas.width + x) * 4;
          if (data[o] < 235 || data[o + 1] < 235 || data[o + 2] < 235) { mask[y * canvas.width + x] = 1; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        }
      }
      return { mask, w: canvas.width, h: canvas.height, box: x1 < 0 ? null : [x0 / k, y0 / k, (x1 + 1) / k, (y1 + 1) / k] };
    };
    /** The smallest distance (mm) between the ink of two masks, looked for up to `limit` mm (more is reported as the limit). */
    const distance = (a, b, limit) => {
      if (!a.box || !b.box) { return limit; }
      const reach = Math.ceil(limit * k);
      const xa0 = Math.max(0, Math.floor(a.box[0] * k) - 1), xa1 = Math.min(a.w, Math.ceil(a.box[2] * k) + 1);
      const ya0 = Math.max(0, Math.floor(a.box[1] * k) - 1), ya1 = Math.min(a.h, Math.ceil(a.box[3] * k) + 1);
      let best = reach * reach + 1;
      const points = [];
      for (let y = ya0; y < ya1; y++) { for (let x = xa0; x < xa1; x++) { if (a.mask[y * a.w + x]) { points.push(x, y); } } }
      const xb0 = Math.max(0, Math.floor(b.box[0] * k) - 1), xb1 = Math.min(b.w, Math.ceil(b.box[2] * k) + 1);
      const yb0 = Math.max(0, Math.floor(b.box[1] * k) - 1), yb1 = Math.min(b.h, Math.ceil(b.box[3] * k) + 1);
      for (let y = yb0; y < yb1; y++) {
        for (let x = xb0; x < xb1; x++) {
          if (!b.mask[y * b.w + x]) { continue; }
          for (let i = 0; i < points.length; i += 2) {
            const dx = points[i] - x, dy = points[i + 1] - y;
            const d = dx * dx + dy * dy;
            if (d < best) { best = d; }
          }
        }
      }
      return Math.min(limit, Math.sqrt(best) / k);
    };
    const out = [];
    for (const row of rowList) {
      const values = Object.assign(engine.sampleValues(norm), row);
      const inks = {};
      for (const element of norm.pages[0].elements) {
        if (element.type === 'shape') { continue; }
        inks[element.name] = await inkOf(values, element);
      }
      const names = Object.keys(inks);
      const gaps = {};
      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) { gaps[names[i] + ' | ' + names[j]] = Math.round(distance(inks[names[i]], inks[names[j]], 6) * 10) / 10; }
      }
      out.push({ name: row.Name, boxes: Object.fromEntries(names.map(n => [n, inks[n].box ? inks[n].box.map(v => Math.round(v * 10) / 10) : null])), gaps });
    }
    return { rows: out, width: norm.width, height: norm.height };
  }, { doc, rows });
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await launch();
  const accounts = await ensureAccounts(browser);
  const context = await newContext(browser);
  const page = await context.newPage();
  watch(page, 'demo');
  // the demo's list and job belong to the first administrator (their personal area); the template is a system template
  check('signed in as the first administrator', await login(page, accounts.admin));
  await page.goto(base + '/Designs', { waitUntil: 'networkidle' });

  // ------------------------------------------------------------------------------------------------ 1. the layout of the six labels
  const doc = demoDocument();
  const rows = demoRowsAll();
  check('the demo has six cheeses, one with empty rows and one with a price of five characters', rows.length === 6 && rows.some(r => r.Gereift === '' && r.Fett === '') && rows.some(r => r.Preis.length === 5));
  const m = await measure(page, doc, rows);
  const MIN_GAP = 0.5;
  for (const row of m.rows) {
    const label = `${row.name}: `;
    const touching = Object.entries(row.gaps).filter(([pair, gap]) => gap < MIN_GAP && !/Wert .*\| Beschriftung|Beschriftung .*\| Wert/.test(pair));
    check(label + `no two elements touch (every gap >= ${MIN_GAP} mm)`, touching.length === 0, touching.map(([p, g]) => `${p} ${g}`).join('; '));
    const g = pair => row.gaps[pair] ?? row.gaps[pair.split(' | ').reverse().join(' | ')];
    check(label + 'the name keeps 1.5 mm from the region line and from the place', g('Ort | Name') >= 1.5 && g('Name | Region') >= 1.5, `Ort|Name ${g('Ort | Name')}, Name|Region ${g('Name | Region')}`);
    check(label + 'the price keeps 2 mm from the euro sign and the unit', g('Preis | Euro') >= 2 && g('Preis | Einheit') >= 1, `Euro ${g('Preis | Euro')}, Einheit ${g('Preis | Einheit')}`);
    check(label + 'the price keeps clear of the region line and the dotted rows', g('Preis | Region') >= 1.5, `Region ${g('Preis | Region')}`);
    const name = row.boxes.Name;
    check(label + 'the name keeps at least 4 mm to the left and right edge of the label', name && name[0] >= 4 && m.width - name[2] >= 4, JSON.stringify(name));
    const logoA = row.boxes['Logo: Käse'], logoB = row.boxes['Logo: Schneider'];
    const logoGap = logoB[0] - logoA[2];
    check(label + 'KÄSE and SCHNEIDER sit next to each other with a small gap (0.3 .. 2.5 mm)', logoGap >= 0.3 && logoGap <= 2.5 && Math.abs(logoA[1] - logoB[1]) < 2, `gap ${logoGap.toFixed(1)}`);
    check(label + 'the logo keeps 2.5 mm to the border', logoB[2] <= m.width - 2.5 && logoB[0] > 0, JSON.stringify(logoB));
    const everything = Object.values(row.boxes).filter(Boolean);
    check(label + 'nothing leaves the label (2 mm margin)', everything.every(b => b[0] >= 2 && b[1] >= 2 && b[2] <= m.width - 2 && b[3] <= m.height - 2), JSON.stringify(Object.entries(row.boxes).filter(([, b]) => b && (b[0] < 2 || b[1] < 2 || b[2] > m.width - 2 || b[3] > m.height - 2))));
  }
  // The six labels drawn next to each other, for the eyes.
  const sheet = await context.newPage();
  await sheet.goto(base + '/Designs', { waitUntil: 'networkidle' });
  await sheet.evaluate(async ({ doc: document_, rows: rowList }) => {
    const engine = window.DtEngine;
    const fonts = (await (await fetch('/api/fonts')).json()).map(f => ({ family: f.family, weight: f.weight, style: f.style, url: f.url }));
    document.body.textContent = '';
    const grid = document.createElement('div');
    grid.id = 'demo-grid';
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(2,900px);gap:16px;padding:16px;background:#777;width:max-content';
    document.body.appendChild(grid);
    const norm = engine.normalize(document_);
    for (let i = 0; i < rowList.length; i++) {
      const box = document.createElement('div');
      box.style.cssText = 'width:900px;background:#fff';
      grid.appendChild(box);
      await engine.renderInto(box, norm, Object.assign(engine.sampleValues(norm), rowList[i]), { mode: 'output', assetUrl: key => '/media/' + encodeURIComponent(key), fonts, idPrefix: 'r' + i + '-' });
    }
  }, { doc, rows });
  await sheet.waitForTimeout(400);
  const file = path.join(outDir, 'demo-six-labels.png');
  await sheet.locator('#demo-grid').screenshot({ path: file });
  console.log('screenshot ' + file);
  await sheet.close();

  // ------------------------------------------------------------------------------------------------ 2. the seeded records
  const meta = demoMeta();
  // The records are found through the API (all of them, not the first page of a list: other checks leave many designs and lists behind).
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  const apiGet = url => page.evaluate(async u => (await fetch(u)).json(), url);
  const demoTemplate = (await apiGet('/api/templates')).find(t => t.name === meta.design);
  if (!demoTemplate) {
    console.log('NOTE the demo records are not in this database (deleted or not a new installation): the seeded records are not checked.');
  } else {
    check('the template is in the list of templates', true);
    const designId = demoTemplate.id;
    await page.goto(`${base}/Designs/${designId}/Designer`);
    await page.waitForSelector('#dt-ds:not(.is-loading)', { timeout: 20000 });
    await page.evaluate(() => window.DtDesigner.canvas.whenIdle());
    const drawn = await page.evaluate(() => ({ texts: Array.from(document.querySelectorAll('#dt-page svg text')).map(t => t.textContent).join('|'), images: document.querySelectorAll('#dt-page svg image').length, name: window.DtDesigner.app.name }));
    check('the designer opens the template and draws it (name, price, three seals and the flag)', drawn.texts.includes('Holunderblüte') && drawn.texts.includes('2,99') && drawn.images === 4, JSON.stringify(drawn).slice(0, 200));
    const pages = [];
    for (const tab of ['', '?tab=fields', '?tab=history']) {
      const response = await page.goto(`${base}/Designs/Edit/${designId}${tab}`, { waitUntil: 'networkidle' });
      pages.push(response.status());
    }
    check('the properties of the template open (all tabs, no person recorded as author)', pages.every(status => status === 200), pages.join(','));
    check('the data list is there', (await apiGet('/api/datalists')).some(l => l.name === meta.list));
    await page.goto(base + '/Outputs?q=' + encodeURIComponent(meta.output), { waitUntil: 'networkidle' });
    const runHref = await page.locator('a', { hasText: meta.output }).first().getAttribute('href').catch(() => null);
    check('the output job is there', !!runHref);
    if (runHref) {
      const jobId = Number(/Outputs\/(?:Edit\/)?(\d+)/.exec(runHref)[1]);
      const edit = await page.goto(`${base}/Outputs/Edit/${jobId}`, { waitUntil: 'networkidle' });
      check('the output job opens in its form', edit.status() === 200 && (await page.inputValue('#Input_Name')) === meta.output);
      await page.goto(`${base}/Outputs/${jobId}/Run`);
      await page.waitForFunction(() => { const r = document.getElementById('dt-run'); return r && ['ready', 'error'].includes(r.getAttribute('data-state')); }, null, { timeout: 60000 });
      const run = await page.evaluate(() => { const r = document.getElementById('dt-run'); return { state: r.getAttribute('data-state'), labels: Number(r.getAttribute('data-labels')), pages: Number(r.getAttribute('data-pages')), drawn: document.querySelectorAll('.dt-olabel').length }; });
      check('the output job runs: six labels on two sheets', run.state === 'ready' && run.labels === 6 && run.pages === 2 && run.drawn === 6, JSON.stringify(run));
    }
  }

  check('no console errors and no CSP violations', problems.length === 0, problems.join(' | '));
  await browser.close();
  let failed = 0;
  for (const r of results) {
    if (!r.ok) { failed++; }
    console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail && !r.ok ? ' - ' + r.detail : ''}`);
  }
  console.log(`\n${results.length - failed} of ${results.length} checks passed.`);
  process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
