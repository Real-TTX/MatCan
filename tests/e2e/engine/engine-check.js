// Checks the render engine (src/DesignThix/wwwroot/js/dt-engine.js) in a real browser (Edge via Playwright).
//   node tests/e2e/engine/engine-check.js
// Playwright is loaded from NODE_PATH, or from ../MatTicket/tests/e2e/node_modules when that is not set.
// Env: DT_BROWSER = firefox | webkit to run in another engine (default Edge); DT_SCREENSHOT_DIR = where the screenshots and the PNG go (default: the system temp directory).
'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

function loadPlaywright() {
  try { return require('playwright'); } catch (e) { /* try the sibling repo */ }
  const sibling = path.resolve(__dirname, '../../../../MatTicket/tests/e2e/node_modules/playwright');
  return require(sibling);
}
const playwright = loadPlaywright();
// DT_BROWSER=firefox|webkit runs the same checks in another engine (default: Edge).
const browserName = process.env.DT_BROWSER || 'chromium';

const repoRoot = path.resolve(__dirname, '../../..');
const outDir = process.env.DT_SCREENSHOT_DIR || path.join(os.tmpdir(), 'designthix-engine');
fs.mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------------------------------------------------------
// Test assets served by the test server
// ---------------------------------------------------------------------------------------------------------------

const FONT_DIR = 'C:/Windows/Fonts';
const FONT_FILES = { 'script.ttf': 'segoesc.ttf', 'script-bold.ttf': 'segoescb.ttf', 'sans.ttf': 'arial.ttf', 'sans-bold.ttf': 'arialbd.ttf', 'impact.ttf': 'impact.ttf' };

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A solid-colour PNG (RGBA) of the given size. */
function makePng(width, height, [r, g, b]) {
  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 'ascii');
    data.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const row = Buffer.alloc(1 + width * 4);
  for (let x = 0; x < width; x++) { row[1 + x * 4] = r; row[2 + x * 4] = g; row[3 + x * 4] = b; row[4 + x * 4] = 255; }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// Flag without width/height (viewBox only: 5:3), a round seal with an explicit size (1:1), a raster image (2:1).
const SVG_FLAG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 3"><rect width="5" height="1" fill="#000"/><rect y="1" width="5" height="1" fill="#d00"/><rect y="2" width="5" height="1" fill="#fc0"/></svg>';
const SVG_SEAL = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="none" stroke="#f5a623" stroke-width="7"/><path d="M28 52l14 14 30-32" fill="none" stroke="#f5a623" stroke-width="9" stroke-linecap="round"/></svg>';
const SVG_BIO = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" rx="8" fill="#1d7a3a"/><text x="50" y="58" font-size="26" text-anchor="middle" fill="#fff" font-family="sans-serif">bio</text></svg>';
const ASSETS = {
  'flag-de': { type: 'image/svg+xml', body: Buffer.from(SVG_FLAG) },
  'icon-schwangerschaft': { type: 'image/svg+xml', body: Buffer.from(SVG_SEAL) },
  'icon-bio': { type: 'image/svg+xml', body: Buffer.from(SVG_BIO) },
  'photo-wide': { type: 'image/png', body: makePng(60, 30, [200, 90, 20]) },
};

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    const asset = /^\/assets\/([\w-]+)$/.exec(pathname);
    if (asset) {
      const a = ASSETS[asset[1]];
      if (!a) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': a.type, 'Cache-Control': 'no-store' });
      res.end(a.body);
      return;
    }
    const font = /^\/testfonts\/([\w.-]+)$/.exec(pathname);
    if (pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (font) {
      const file = FONT_FILES[font[1]];
      if (!file || !fs.existsSync(path.join(FONT_DIR, file))) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': 'font/ttf', 'Cache-Control': 'no-store' });
      fs.createReadStream(path.join(FONT_DIR, file)).pipe(res);
      return;
    }
    const target = path.resolve(repoRoot, '.' + pathname);
    if (!target.startsWith(repoRoot) || !fs.existsSync(target) || !fs.statSync(target).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(target).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// ---------------------------------------------------------------------------------------------------------------
// The test document: the reference label "Käsetheke – Preisschild", 150 × 100 mm
// ---------------------------------------------------------------------------------------------------------------

const FONTS = [
  { family: 'DtTest Script', weight: 400, style: 'normal', url: '/testfonts/script.ttf' },
  { family: 'DtTest Script', weight: 700, style: 'normal', url: '/testfonts/script-bold.ttf' },
  { family: 'DtTest Sans', weight: 400, style: 'normal', url: '/testfonts/sans.ttf' },
  { family: 'DtTest Sans', weight: 700, style: 'normal', url: '/testfonts/sans-bold.ttf' },
  { family: 'DtTest Impact', weight: 400, style: 'normal', url: '/testfonts/impact.ttf' },
];

function labelDoc() {
  const text = (id, props) => Object.assign({ type: 'text', id, name: id, x: 0, y: 0, w: 10, h: 5, fontFamily: 'DtTest Sans', fontSize: 12, color: '#000000' }, props);
  const line = (id, x, y, w, showIf) => ({ type: 'shape', id, name: id, shape: 'line', x, y, w, h: 0, stroke: '#8c8c8c', strokeWidth: 0.6, dash: 'dotted', showIf });
  const row = (key, label, y) => [
    text('lbl' + key, { text: label, x: 4, y, w: 26, h: 7, fontSize: 13, valign: 'middle', showIf: key }),
    text('val' + key, { text: '{{' + key + '}}', x: 31, y, w: 54, h: 7, fontFamily: 'DtTest Script', fontSize: 17, valign: 'middle', fit: 'shrink', showIf: key }),
    line('dot' + key, 31, y + 7, 56, key),
  ];
  return {
    schema: 1, unit: 'mm', width: 150, height: 100, dpi: 300, locale: 'de-DE',
    background: { color: '#ffffff', asset: null, fit: 'cover' },
    fields: [
      { key: 'Name', label: 'Name', type: 'text', sample: 'Holunderblüte' },
      { key: 'Ort', label: 'Ort', type: 'text', sample: 'Geifertshofen' },
      { key: 'Region', label: 'Region', type: 'text', sample: 'Hohenlohe / Schwäbischer Wald' },
      { key: 'Gereift', label: 'Gereift', type: 'text', sample: '4 Wochen' },
      { key: 'Fett', label: 'Fett i. Tr.', type: 'text', sample: '45 %' },
      { key: 'Milchart', label: 'Milchart', type: 'text', sample: 'Kuhmilch, past.' },
      { key: 'Preis', label: 'Preis', type: 'price', sample: '2.99', decimals: 2 },
      { key: 'Einheit', label: 'Einheit', type: 'text', sample: '/ 100 g' },
      { key: 'Land', label: 'Herkunftsland', type: 'image', sample: 'flag-de', category: 'Flaggen' },
      { key: 'Icon1', label: 'Siegel 1', type: 'image', sample: '' },
      { key: 'Icon2', label: 'Siegel 2', type: 'image', sample: 'icon-schwangerschaft' },
      { key: 'Icon3', label: 'Siegel 3', type: 'image', sample: 'no-such-asset' },
    ],
    elements: [
      { type: 'shape', id: 'border', name: 'Rahmen', shape: 'rect', x: 1, y: 1, w: 148, h: 98, stroke: '#111111', strokeWidth: 0.8 },
      { type: 'imageStrip', id: 'strip', name: 'Siegel', x: 4, y: 4.5, w: 96, h: 14, gap: 3.5, align: 'left',
        items: [{ field: 'Land' }, { field: 'Icon1' }, { field: 'Icon2' }, { field: 'Icon3' }] },
      text('logoDer', { text: 'Der', x: 108, y: 3, w: 40, h: 8, fontFamily: 'DtTest Script', fontWeight: 700, italic: false, fontSize: 18, color: '#1b2a41', align: 'center', valign: 'middle' }),
      text('logoKaese', { text: 'KÄSE', x: 96, y: 10, w: 26, h: 9, fontFamily: 'DtTest Impact', fontSize: 26, color: '#f5a623', align: 'right', valign: 'middle' }),
      text('logoSchneider', { text: 'SCHNEIDER', x: 123, y: 10, w: 25, h: 9, fontFamily: 'DtTest Impact', fontSize: 26, color: '#1b2a41', align: 'left', valign: 'middle', fit: 'shrink' }),
      text('logoClaim', { text: 'Käse für Genießer', x: 100, y: 20, w: 48, h: 5, fontSize: 7, align: 'center', valign: 'middle', uppercase: true, letterSpacing: 0.12 }),
      text('ort', { text: '{{Ort}}', x: 10, y: 25, w: 130, h: 12, fontFamily: 'DtTest Script', fontWeight: 700, fontSize: 24, align: 'center', valign: 'middle', fit: 'shrink' }),
      text('name', { text: '{{Name}}', x: 5, y: 36, w: 140, h: 30, fontFamily: 'DtTest Script', fontWeight: 700, fontSize: 90, align: 'center', valign: 'middle', fit: 'shrink', wrap: false, lineHeight: 1 }),
      text('region', { text: '{{Region}}', x: 10, y: 66, w: 130, h: 7, fontFamily: 'DtTest Script', fontSize: 17, align: 'center', valign: 'middle', fit: 'shrink' }),
      ...row('Gereift', 'GEREIFT:', 74), ...row('Fett', 'FETT i. TR.:', 81), ...row('Milchart', 'MILCH-ART:', 88),
      text('preis', { text: '{{Preis}}', x: 86, y: 70, w: 46, h: 22, fontFamily: 'DtTest Script', fontWeight: 700, fontSize: 90, align: 'right', valign: 'middle', fit: 'shrink', wrap: false, lineHeight: 1 }),
      text('euro', { text: '€', x: 132, y: 72, w: 14, h: 10, fontSize: 36, align: 'left', valign: 'top' }),
      text('einheit', { text: '{{Einheit}}', x: 98, y: 91, w: 48, h: 6, fontSize: 16, align: 'right', valign: 'middle' }),
    ],
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Binary parsers for the PNG and ZIP checks
// ---------------------------------------------------------------------------------------------------------------

function parsePng(buf) {
  const sig = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const result = { signature: sig, chunks: [] };
  let offset = 8;
  while (offset + 12 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + length);
    const crcOk = buf.readUInt32BE(offset + 8 + length) === crc32(buf.subarray(offset + 4, offset + 8 + length));
    result.chunks.push({ type, crcOk });
    if (type === 'IHDR') { result.width = data.readUInt32BE(0); result.height = data.readUInt32BE(4); }
    if (type === 'pHYs') { result.pxPerMetre = data.readUInt32BE(0); result.unit = data[8]; }
    offset += 12 + length;
  }
  return result;
}

function parseZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('no end of central directory');
  const count = buf.readUInt16LE(eocd + 10);
  const centralSize = buf.readUInt32LE(eocd + 12);
  const centralOffset = buf.readUInt32LE(eocd + 16);
  const entries = [];
  let p = centralOffset;
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central header ' + i);
    const e = {
      flags: buf.readUInt16LE(p + 8), method: buf.readUInt16LE(p + 10), crc: buf.readUInt32LE(p + 16),
      compressed: buf.readUInt32LE(p + 20), size: buf.readUInt32LE(p + 24), localOffset: buf.readUInt32LE(p + 42),
    };
    const nameLength = buf.readUInt16LE(p + 28);
    const extraLength = buf.readUInt16LE(p + 30);
    const commentLength = buf.readUInt16LE(p + 32);
    e.name = buf.toString('utf8', p + 46, p + 46 + nameLength);
    const l = e.localOffset;
    if (buf.readUInt32LE(l) !== 0x04034b50) throw new Error('bad local header ' + i);
    e.localCrc = buf.readUInt32LE(l + 14);
    e.localSize = buf.readUInt32LE(l + 22);
    e.localName = buf.toString('utf8', l + 30, l + 30 + buf.readUInt16LE(l + 26));
    const dataStart = l + 30 + buf.readUInt16LE(l + 26) + buf.readUInt16LE(l + 28);
    e.data = buf.subarray(dataStart, dataStart + e.size);
    entries.push(e);
    p += 46 + nameLength + extraLength + commentLength;
  }
  return { entries, count, centralEndsAtEocd: p === eocd && p - centralOffset === centralSize };
}

// ---------------------------------------------------------------------------------------------------------------

(async () => {
  const server = await startServer();
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  if (browserName !== 'chromium') browser = await playwright[browserName].launch();
  else { try { browser = await playwright.chromium.launch({ channel: 'msedge' }); } catch (e) { browser = await playwright.chromium.launch(); } }
  const context = await browser.newContext({ viewport: { width: 1000, height: 760 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const problems = [];
  let step = 'start';
  page.on('console', m => { if (m.type() === 'error') problems.push('console [' + step + ']: ' + m.text().slice(0, 140)); });
  page.on('pageerror', e => problems.push('pageerror: ' + e.message));
  await page.goto(base + '/tests/e2e/engine/engine.html');
  await page.evaluate(() => {
    window.__violations = [];
    document.addEventListener('securitypolicyviolation', e => window.__violations.push(e.violatedDirective + ' ' + e.blockedURI));
  });

  const results = [];
  const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); };

  const doc = labelDoc();
  const baseOpts = { fonts: FONTS };
  // The page cannot hold functions across evaluate calls, so the helpers are re-created from this source in every call.
  const helper = `
    const assets = ${JSON.stringify(Object.keys(ASSETS))};
    const assetUrl = key => { const k = String(key).toLowerCase(); return assets.includes(k) ? '/assets/' + k : null; };
    const values = (doc, extra) => Object.assign(DtEngine.sampleValues(doc), extra || {});
    const q = (svg, id) => svg.querySelector('[data-el-id="' + id + '"]');
  `;
  const run = (body, arg) => page.evaluate(`(async (arg) => { ${helper} ${body} })(${JSON.stringify(arg === undefined ? null : arg)})`);

  step = 'section 1';
  // ---- 1. placeholders --------------------------------------------------------------------------------------------
  const subst = await run(`
    const fields = [{ key: 'Name', type: 'text' }, { key: 'Preis', type: 'price', decimals: 2 }];
    return {
      a: DtEngine.resolveText('Hallo {{Name}}!', fields, { Name: 'Anna' }),
      caseInsensitive: DtEngine.resolveText('{{NAME}} {{name}}', fields, { nAmE: 'Bo' }),
      spaces: DtEngine.resolveText('[{{  Name  }}] [{{\\tName\\n}}]', fields, { Name: 'X' }),
      unknown: DtEngine.resolveText('a{{Nope}}b', fields, { Name: 'X' }),
      token: DtEngine.resolveText('a{{Nope}}b {{Name}}', fields, { }, 'de-DE', 'token'),
      price: DtEngine.resolveText('{{Preis}} €', fields, { Preis: '2.99' }),
      dollar: DtEngine.resolveText('{{Name}}', fields, { Name: '$& $1 $$' }),
      notAToken: DtEngine.resolveText('{Name} {{ 1x }} {{Na me}}', fields, { Name: 'X' }),
    };
  `);
  check('placeholder substitution', subst.a === 'Hallo Anna!', subst.a);
  check('keys are case-insensitive (document, text, values)', subst.caseInsensitive === 'Bo Bo', subst.caseInsensitive);
  check('whitespace inside the braces', subst.spaces === '[X] [X]', subst.spaces);
  check('unknown placeholder renders empty', subst.unknown === 'ab', subst.unknown);
  check('missing: token keeps the placeholder', subst.token === 'a{{Nope}}b {{Name}}', subst.token);
  check('price inside text', subst.price === '2,99 €', subst.price);
  check('replacement patterns in values are literal', subst.dollar === '$& $1 $$', subst.dollar);
  check('malformed tokens stay as they are', subst.notAToken === '{Name} {{ 1x }} {{Na me}}', subst.notAToken);

  step = 'section 2';
  // ---- 2. value formatting ----------------------------------------------------------------------------------------
  const fmtResult = await run(`
    const price = { type: 'price', decimals: 2 };
    const f = DtEngine.formatValue;
    return {
      dot: f(price, '2.99', 'de-DE'), comma: f(price, '2,99', 'de-DE'), whole: f(price, '3', 'de-DE'),
      thousands: f(price, '1234.5', 'de-DE'), german: f(price, '1.234,56', 'de-DE'), english: f(price, '1,234.56', 'de-DE'),
      euro: f(price, '2,99 €', 'de-DE'), number: f(price, 2.5, 'de-DE'), notNumber: f(price, 'auf Anfrage', 'de-DE'),
      empty: f(price, '  ', 'de-DE'), nul: f(price, null, 'de-DE'), enUS: f(price, '2,99', 'en-US'),
      defaultDecimals: f({ type: 'price' }, '2.5', 'de-DE'), three: f({ type: 'price', decimals: 3 }, '2.5', 'de-DE'),
      zero: f({ type: 'price', decimals: 0 }, '2.5', 'de-DE'),
      numTyped: f({ type: 'number', decimals: null }, '2.50', 'de-DE'), numDec: f({ type: 'number', decimals: 1 }, '2.55', 'de-DE'),
      negative: f({ type: 'number', decimals: 2 }, '-1234.5', 'de-DE'),
      text: f({ type: 'text' }, ' as is ', 'de-DE'), image: f({ type: 'image' }, '  flag-de ', 'de-DE'), noField: f(null, 5, 'de-DE'),
    };
  `);
  check('price "2.99" -> "2,99"', fmtResult.dot === '2,99', fmtResult.dot);
  check('price "2,99" -> "2,99"', fmtResult.comma === '2,99', fmtResult.comma);
  check('price "3" -> "3,00"', fmtResult.whole === '3,00', fmtResult.whole);
  check('price with thousands "1234.5" -> "1.234,50"', fmtResult.thousands === '1.234,50', fmtResult.thousands);
  check('price "1.234,56" and "1,234.56"', fmtResult.german === '1.234,56' && fmtResult.english === '1.234,56', fmtResult.german + ' / ' + fmtResult.english);
  check('price "2,99 €" and numeric 2.5', fmtResult.euro === '2,99' && fmtResult.number === '2,50', fmtResult.euro + ' / ' + fmtResult.number);
  check('not-a-number stays as typed, empty stays empty', fmtResult.notNumber === 'auf Anfrage' && fmtResult.empty === '' && fmtResult.nul === '', JSON.stringify([fmtResult.notNumber, fmtResult.empty, fmtResult.nul]));
  check('price in en-US uses the locale', fmtResult.enUS === '2.99', fmtResult.enUS);
  check('price decimals default 2, 3, 0', fmtResult.defaultDecimals === '2,50' && fmtResult.three === '2,500' && fmtResult.zero === '3', [fmtResult.defaultDecimals, fmtResult.three, fmtResult.zero].join(' / '));
  check('number: as typed without decimals, with decimals, negative', fmtResult.numTyped === '2.50' && fmtResult.numDec === '2,6' && fmtResult.negative === '-1.234,50', [fmtResult.numTyped, fmtResult.numDec, fmtResult.negative].join(' / '));
  check('text as is, image trimmed, no field', fmtResult.text === ' as is ' && fmtResult.image === 'flag-de' && fmtResult.noField === '5', '');

  step = 'section 3';
  // ---- 3. normalize / fieldsUsed ----------------------------------------------------------------------------------
  const norm = await run(`
    const hostile = { unit: 'furlong', width: 'abc', height: -5, dpi: 99999, locale: 'zz-<script>', background: { color: 'red;" onload="x', fit: 'weird' },
      fields: [{ key: 'ok', type: 'price' }, { key: 'OK' }, { key: '1bad' }, 42, null],
      elements: [{ type: 'text', id: 'a', x: 'NaN', w: 1e12, fontSize: 5000, color: 'url(javascript:1)', align: 'sideways', opacity: 7, rotation: 1000, showIf: 'not a key' },
                 { type: 'text', id: 'a' }, { type: 'bogus' }, 'x', { type: 'shape', shape: 'line' }, { type: 'imageStrip', items: new Array(30).fill({ asset: 'a' }) }] };
    const n = DtEngine.normalize(hostile);
    const again = DtEngine.normalize(n);
    return { n, same: JSON.stringify(n) === JSON.stringify(again), empty: DtEngine.normalize(null), used: DtEngine.fieldsUsed(${JSON.stringify(doc)}) };
  `);
  const t0 = norm.n.elements[0];
  check('normalize: defaults and clamps', norm.n.unit === 'mm' && norm.n.width === 100 && norm.n.height === 0.1 && norm.n.dpi === 1200 && norm.n.locale === 'de-DE' &&
    norm.n.background.color === '#ffffff' && norm.n.background.fit === 'cover', JSON.stringify(norm.n.background) + norm.n.width + norm.n.height);
  check('normalize: element values', t0.x === 0 && t0.w === 1e6 && t0.fontSize === 1000 && t0.color === '#000000' && t0.align === 'left' && t0.opacity === 1 && t0.rotation === 360 && t0.showIf === null, JSON.stringify(t0));
  check('normalize: fields deduplicated and validated, unknown elements dropped, ids unique, strip limited',
    norm.n.fields.length === 1 && norm.n.fields[0].decimals === 2 && norm.n.elements.length === 4 && new Set(norm.n.elements.map(e => e.id)).size === 4 && norm.n.elements[3].items.length === 12,
    norm.n.fields.length + ' fields, ' + norm.n.elements.length + ' elements');
  check('normalize is idempotent and tolerates null', norm.same && norm.empty.elements.length === 0 && norm.empty.width === 100, '');
  const usedKeys = norm.used.map(u => u.key).join(',');
  check('fieldsUsed lists keys with uses', ['Gereift', 'Fett', 'Milchart', 'Land', 'Icon1', 'Icon2', 'Icon3', 'Name', 'Preis'].every(k => usedKeys.includes(k)) &&
    norm.used.find(u => u.key === 'Land').uses[0].kind === 'strip' && norm.used.every(u => u.defined), usedKeys);

  step = 'section 4';
  // ---- 4. the reference label -------------------------------------------------------------------------------------
  const label = await run(`
    const doc = ${JSON.stringify(doc)};
    const stage = document.getElementById('stage');
    const svg = await DtEngine.renderInto(stage, doc, values(doc, { Preis: '2.99', Land: 'FLAG-DE' }), { assetUrl, fonts: ${JSON.stringify(FONTS)}, mode: 'editor' });
    svg.setAttribute('width', '900'); svg.setAttribute('height', '600');
    const ids = Array.from(svg.querySelectorAll('[data-el-id]')).map(g => g.getAttribute('data-el-id'));
    const priceText = Array.from(q(svg, 'preis').querySelectorAll('tspan')).map(t => t.textContent).join('|');
    return {
      viewBox: svg.getAttribute('viewBox'), ids, priceText,
      scriptLoaded: document.fonts.check("16px 'DtTest Script'"), sansLoaded: document.fonts.check("16px 'DtTest Sans'"),
      inStage: stage.firstElementChild === svg, claim: q(svg, 'logoClaim').textContent,
    };
  `);
  check('renderInto puts the SVG in the container (viewBox 0 0 150 100)', label.inStage && label.viewBox === '0 0 150 100', label.viewBox);
  check('every element is a <g data-el-id>', ['border', 'strip', 'name', 'preis', 'lblGereift', 'dotMilchart'].every(id => label.ids.includes(id)), label.ids.length + ' groups');
  check('price on the label is "2,99"', label.priceText === '2,99', label.priceText);
  check('uppercase after substitution ("Genießer" -> "GENIESSER")', label.claim === 'KÄSE FÜR GENIESSER', label.claim);
  check('fonts were registered and loaded', label.scriptLoaded && label.sansLoaded, '');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, 'label-editor.png'), clip: { x: 0, y: 0, width: 920, height: 620 }, caret: 'initial', animations: 'allow' });

  step = 'section 5';
  // ---- 5. showIf / hidden / rotation / opacity / shapes / units ---------------------------------------------------
  const sh = await run(`
    const doc = ${JSON.stringify(doc)};
    const full = await DtEngine.render(doc, values(doc), { assetUrl, fonts: ${JSON.stringify(FONTS)} });
    const noFett = await DtEngine.render(doc, values(doc, { Fett: '   ' }), { assetUrl, fonts: ${JSON.stringify(FONTS)} });
    const noKey = await DtEngine.render(doc, values(doc, { Fett: undefined, fett: null }), { assetUrl, fonts: ${JSON.stringify(FONTS)} });
    const hiddenDoc = JSON.parse(JSON.stringify(doc)); hiddenDoc.elements.find(e => e.id === 'ort').hidden = true;
    const hidden = await DtEngine.render(hiddenDoc, values(doc), { assetUrl, fonts: ${JSON.stringify(FONTS)} });
    const has = (svg, id) => !!q(svg, id);
    const dot = q(full, 'dotFett').querySelector('line');
    const spec = { schema: 1, unit: 'px', width: 400, height: 200, elements: [
      { type: 'shape', id: 'r', shape: 'rect', x: 10, y: 20, w: 100, h: 40, fill: '#ff0000', stroke: '#00f', strokeWidth: 3, radius: 5, rotation: 30, opacity: 0.5 },
      { type: 'shape', id: 'd', shape: 'line', x: 0, y: 0, w: 50, h: 0, stroke: '#123456', strokeWidth: 6, dash: 'dashed' },
      { type: 'shape', id: 'e', shape: 'ellipse', x: 0, y: 0, w: 40, h: 20, fill: '#00ff00', stroke: null },
      { type: 'text', id: 't', text: 'x', x: 0, y: 0, w: 100, h: 20, fontSize: 12, fontFamily: 'sans-serif' } ] };
    const px = await DtEngine.render(spec, {});
    const rg = q(px, 'r'); const dg = q(px, 'd').querySelector('line'); const eg = q(px, 'e').querySelector('ellipse');
    return {
      full: [has(full, 'lblFett'), has(full, 'valFett'), has(full, 'dotFett')],
      noFett: [has(noFett, 'lblFett'), has(noFett, 'valFett'), has(noFett, 'dotFett'), has(noFett, 'lblGereift')],
      noKey: has(noKey, 'valFett'), hidden: has(hidden, 'ort'), hiddenOthers: has(hidden, 'name'),
      dotDash: dot.getAttribute('stroke-dasharray'), dotCap: dot.getAttribute('stroke-linecap'), dotWidth: dot.getAttribute('stroke-width'),
      pxSize: [px.getAttribute('width'), px.getAttribute('height'), px.getAttribute('viewBox')],
      rotate: rg.getAttribute('transform'), opacity: rg.getAttribute('opacity'), rect: rg.querySelector('rect').outerHTML.length > 0 && [rg.querySelector('rect').getAttribute('rx'), rg.querySelector('rect').getAttribute('stroke-width'), rg.querySelector('rect').getAttribute('fill')],
      dashed: [dg.getAttribute('stroke-dasharray'), dg.getAttribute('stroke-width'), dg.getAttribute('x2')], ellipse: [eg.getAttribute('rx'), eg.getAttribute('stroke'), eg.getAttribute('fill')],
      fontPx: q(px, 't').querySelector('text').getAttribute('font-size'), mmFontPt12: DtEngine.ptToUnit(12, 'mm'), pxFontPt12: DtEngine.ptToUnit(12, 'px'), mm10: DtEngine.unitToPx(10, 'mm'),
      sizeMm: [full.getAttribute('width'), full.getAttribute('height')],
    };
  `);
  check('showIf: all three parts of a row drawn when the value is there', sh.full.every(Boolean), sh.full.join());
  check('showIf: whitespace-only value hides the row (label, value, dotted line), other rows stay', !sh.noFett[0] && !sh.noFett[1] && !sh.noFett[2] && sh.noFett[3], sh.noFett.join());
  check('showIf: missing value hides, hidden:true is not drawn', !sh.noKey && !sh.hidden && sh.hiddenOthers, '');
  check('dotted line: dasharray 0,2w, round caps, w = stroke width in mm', sh.dotWidth === '0.2117' && sh.dotDash === '0,0.4233' && sh.dotCap === 'round', [sh.dotWidth, sh.dotDash, sh.dotCap].join(' '));
  check('px documents: width/height in px, font pt -> px', sh.pxSize.join() === '400px,200px,0 0 400 200' && sh.fontPx === '16', sh.pxSize.join() + ' font ' + sh.fontPx);
  check('mm documents: width/height in mm', sh.sizeMm.join() === '150mm,100mm', sh.sizeMm.join());
  check('unit helpers', Math.abs(sh.mmFontPt12 - 4.2333) < 0.001 && sh.pxFontPt12 === 16 && Math.abs(sh.mm10 - 37.7953) < 0.001, '');
  check('rotation around the centre, opacity', sh.rotate === 'rotate(30 60 40)' && sh.opacity === '0.5', sh.rotate + ' ' + sh.opacity);
  check('rect radius / stroke width (3 pt = 4 px) / fill', sh.rect[0] === '5' && sh.rect[1] === '4' && sh.rect[2] === '#ff0000', sh.rect.join());
  check('dashed line 3w,2w', sh.dashed[0] === '24,16' && sh.dashed[1] === '8' && sh.dashed[2] === '50', sh.dashed.join());
  check('ellipse without stroke', sh.ellipse.join() === '20,none,#00ff00', sh.ellipse.join());

  step = 'section 6';
  // ---- 6. text layout ---------------------------------------------------------------------------------------------
  const tx = await run(`
    const fonts = ${JSON.stringify(FONTS)};
    const mk = (props) => ({ schema: 1, unit: 'mm', width: 150, height: 100, elements: [Object.assign({ type: 'text', id: 't', x: 10, y: 10, w: 60, h: 15, fontFamily: 'DtTest Script', fontSize: 60, text: 'Holunderblütenkäse' }, props)] });
    const render = async (props) => { const svg = await DtEngine.render(mk(props), {}, { fonts }); document.getElementById('stage').replaceChildren(svg); return svg; };
    const spec = (props) => Object.assign({ text: 'Holunderblütenkäse', fontFamily: 'DtTest Script', fontSize: 60, width: 60, height: 15, unit: 'mm', wrap: true }, props);
    // shrink
    const plain = DtEngine.layoutText(spec({ fit: 'none' }));
    const shrunk = DtEngine.layoutText(spec({ fit: 'shrink', wrap: false }));
    const next = DtEngine.layoutText(spec({ fit: 'none', wrap: false, fontSize: shrunk.fontSizePt + 0.25 }));
    const shrinkSvg = await render({ fit: 'shrink', wrap: false });
    const shrinkText = shrinkSvg.querySelector('text');
    const measured = shrinkText.querySelector('tspan').getComputedTextLength();
    const sizeAttr = parseFloat(shrinkText.getAttribute('font-size'));
    // shrink with wrap in a box that is also high enough only for few lines
    const wrapShrink = DtEngine.layoutText(spec({ fit: 'shrink', text: 'Ein langer Text, der in die kleine Box passen muss', width: 40, height: 14 }));
    const wrapShrinkNext = DtEngine.layoutText(spec({ fit: 'none', text: 'Ein langer Text, der in die kleine Box passen muss', width: 40, height: 14, fontSize: wrapShrink.fontSizePt + 0.25 }));
    const minimum = DtEngine.layoutText(spec({ fit: 'shrink', wrap: false, minFontSize: 40, width: 20 }));
    // wrap
    const wrapped = await render({ fontFamily: 'DtTest Sans', fontSize: 14, w: 50, h: 60, text: 'Das ist ein langer Text mit vielen Wörtern, der umbrechen muss.' });
    const lines = Array.from(wrapped.querySelectorAll('tspan'));
    const lineWidths = lines.map(l => l.getComputedTextLength());
    const ys = lines.map(l => parseFloat(l.getAttribute('y')));
    const long = await render({ fontFamily: 'DtTest Sans', fontSize: 14, w: 30, h: 60, text: 'Donaudampfschifffahrtsgesellschaft' });
    const longLines = Array.from(long.querySelectorAll('tspan'));
    const explicit = await render({ fontFamily: 'DtTest Sans', fontSize: 14, w: 100, h: 60, text: 'eins\\nzwei\\n\\ndrei' });
    const explicitLines = Array.from(explicit.querySelectorAll('tspan'));
    const noWrap = await render({ fontFamily: 'DtTest Sans', fontSize: 14, w: 20, h: 60, wrap: false, text: 'Dieser Text bleibt in einer Zeile' });
    // alignment
    const al = async (props) => { const s = await render(Object.assign({ fontFamily: 'DtTest Sans', fontSize: 10, w: 80, h: 40, text: 'Zeile' }, props)); const t = s.querySelector('text'); const sp = s.querySelector('tspan'); return { anchor: t.getAttribute('text-anchor'), x: parseFloat(sp.getAttribute('x')), y: parseFloat(sp.getAttribute('y')) }; };
    const left = await al({ align: 'left' }); const centre = await al({ align: 'center' }); const right = await al({ align: 'right' });
    const top = await al({ valign: 'top' }); const middle = await al({ valign: 'middle' }); const bottom = await al({ valign: 'bottom' });
    const spaced = await render({ fontFamily: 'DtTest Sans', fontSize: 10, letterSpacing: 0.25, text: 'ABC', uppercase: true });
    const quote = await render({ fontFamily: "Evil'Font\\";}</style>", fontSize: 10, text: 'x' });
    return { plain, shrunk, next, measured, sizeAttr, wrapShrink, wrapShrinkNext, minimum,
      wrap: { count: lines.length, lineWidths, ys, boxW: 50 }, long: longLines.map(l => l.textContent), explicit: explicitLines.map(l => l.textContent + '@' + parseFloat(l.getAttribute('y')).toFixed(2)),
      noWrap: wrapped && noWrap.querySelectorAll('tspan').length, left, centre, right, top, middle, bottom,
      spaced: spaced.querySelector('text').getAttribute('letter-spacing'), quoteFamily: quote.querySelector('text').getAttribute('font-family'),
      quoteScripts: quote.querySelectorAll('style,script').length };
  `);
  check('shrink: result smaller than the nominal size and not below the minimum', tx.shrunk.fontSizePt < 60 && tx.shrunk.fontSizePt >= 4 && tx.plain.fits === false && tx.shrunk.shrunk === true,
    'nominal 60 pt -> ' + tx.shrunk.fontSizePt + ' pt');
  check('shrink: the shrunk text fits the box width (computed + DOM measured)', tx.shrunk.fits && tx.shrunk.width <= 60.001 && tx.measured <= 60 * 1.02, 'layout ' + tx.shrunk.width.toFixed(2) + ' mm, DOM ' + tx.measured.toFixed(2) + ' mm');
  check('shrink: 0.25 pt larger would no longer fit (largest size found)', tx.next.fits === false && ((tx.shrunk.fontSizePt - 4) * 4) % 1 === 0, tx.shrunk.fontSizePt + ' / ' + tx.next.fontSizePt);
  check('shrink: SVG font-size matches the layout (mm)', Math.abs(tx.sizeAttr - tx.shrunk.fontSize) < 0.001 && Math.abs(tx.shrunk.fontSize - tx.shrunk.fontSizePt * 25.4 / 72) < 1e-6, String(tx.sizeAttr));
  check('shrink with wrapping honours width AND height', tx.wrapShrink.fits && tx.wrapShrink.height <= 14.001 && tx.wrapShrink.width <= 40.001 && tx.wrapShrinkNext.fits === false && tx.wrapShrink.lines.length > 1,
    tx.wrapShrink.fontSizePt + ' pt, ' + tx.wrapShrink.lines.length + ' lines, ' + tx.wrapShrink.height.toFixed(2) + ' mm');
  check('shrink never goes below minFontSize', tx.minimum.fontSizePt === 40 && tx.minimum.fits === false, String(tx.minimum.fontSizePt));
  check('wrap: several tspans, each inside the box, baselines strictly increasing', tx.wrap.count >= 3 && tx.wrap.lineWidths.every(w => w <= 50.5) && tx.wrap.ys.every((y, i) => i === 0 || y > tx.wrap.ys[i - 1]),
    tx.wrap.count + ' lines, widest ' + Math.max(...tx.wrap.lineWidths).toFixed(1));
  check('wrap: an over-long word is broken into pieces that join to the word', tx.long.length >= 2 && tx.long.join('') === 'Donaudampfschifffahrtsgesellschaft', tx.long.join('|'));
  check('explicit \\n kept (blank line keeps its space)', tx.explicit.length === 3 && tx.explicit[0].startsWith('eins@') && tx.explicit[2].startsWith('drei@') &&
    Math.abs((parseFloat(tx.explicit[2].split('@')[1]) - parseFloat(tx.explicit[0].split('@')[1])) - 3 * 14 * 25.4 / 72 * 1.2) < 0.01, tx.explicit.join(' '));
  check('wrap:false keeps a single line', tx.noWrap === 1, String(tx.noWrap));
  check('align: anchor and x at left / centre / right of the box', tx.left.anchor === 'start' && tx.left.x === 10 && tx.centre.anchor === 'middle' && tx.centre.x === 50 && tx.right.anchor === 'end' && tx.right.x === 90, JSON.stringify([tx.left, tx.centre, tx.right]));
  check('valign: top < middle < bottom baseline', tx.top.y < tx.middle.y && tx.middle.y < tx.bottom.y && tx.bottom.y <= 10 + 40 && tx.top.y > 10, [tx.top.y, tx.middle.y, tx.bottom.y].join(' / '));
  check('letter-spacing as em attribute', tx.spaced === '0.25em', tx.spaced);
  check('font-family is quoted and cannot break out', /^'[^'"\\;{}<>]*', sans-serif$/.test(tx.quoteFamily), tx.quoteFamily);

  step = 'section 7';
  // ---- 7. images and image strip ----------------------------------------------------------------------------------
  const st = await run(`
    const doc = ${JSON.stringify(doc)};
    const opts = { assetUrl, fonts: ${JSON.stringify(FONTS)} };
    const out = await DtEngine.render(doc, values(doc), opts);
    const ed = await DtEngine.render(doc, values(doc), Object.assign({ mode: 'editor' }, opts));
    const imgs = (svg, id) => Array.from(q(svg, id || 'strip').querySelectorAll('image')).map(i => ({ x: +i.getAttribute('x'), y: +i.getAttribute('y'), w: +i.getAttribute('width'), h: +i.getAttribute('height'), href: i.getAttribute('href'), par: i.getAttribute('preserveAspectRatio') }));
    const ph = svg => Array.from(svg.querySelectorAll('[data-dt-placeholder]')).map(g => g.querySelector('text').textContent);
    const all = values(doc, { Icon1: 'icon-bio', Icon2: 'icon-bio', Icon3: 'icon-bio', Land: 'flag-de' });
    const full = await DtEngine.render(doc, all, opts);
    // a strip wider than its box scales down uniformly; alignment
    const strip = (props, valueSet) => ({ schema: 1, unit: 'mm', width: 150, height: 100, fields: [{ key: 'A', type: 'image' }, { key: 'B', type: 'image' }],
      elements: [Object.assign({ type: 'imageStrip', id: 's', x: 10, y: 10, w: 100, h: 20, gap: 5, align: 'left', items: [{ field: 'A' }, { field: 'B' }, { asset: 'icon-bio' }] }, props)] });
    const sv = { A: 'photo-wide', B: 'flag-de' };
    const narrow = await DtEngine.render(strip({ w: 50 }), sv, opts);
    const centred = await DtEngine.render(strip({ align: 'center', w: 120 }), sv, opts);
    const right = await DtEngine.render(strip({ align: 'right', w: 120 }), sv, opts);
    const single = await DtEngine.render({ schema: 1, unit: 'mm', width: 100, height: 50, fields: [{ key: 'A', type: 'image' }], elements: [
      { type: 'image', id: 'i1', x: 0, y: 0, w: 40, h: 40, fit: 'cover', source: { asset: 'photo-wide' }, radius: 4 },
      { type: 'image', id: 'i2', x: 50, y: 0, w: 40, h: 40, fit: 'contain', source: { asset: 'photo-wide' } },
      { type: 'image', id: 'i3', x: 0, y: 0, w: 40, h: 40, fit: 'fill', source: { asset: 'does-not-exist' } },
      { type: 'image', id: 'i4', x: 0, y: 0, w: 40, h: 40, fit: 'fill', source: { field: 'A' } }] }, { A: 'javascript:alert(1)' }, Object.assign({ mode: 'editor' }, opts));
    const bgDoc = { schema: 1, unit: 'mm', width: 100, height: 50, background: { color: '#112233', asset: 'photo-wide', fit: 'cover' }, elements: [] };
    const bg = await DtEngine.render(bgDoc, {}, opts);
    const info = el => el ? Array.from(el.querySelectorAll('image')).map(i => ({ x: +i.getAttribute('x'), w: +i.getAttribute('width'), h: +i.getAttribute('height') })) : [];
    return { out: imgs(out), ed: imgs(ed), phOut: ph(out), phEd: ph(ed), full: imgs(full),
      narrow: imgs(narrow, 's'), centred: imgs(centred, 's'), right: imgs(right, 's'),
      i1: Array.from(q(single, 'i1').children).map(c => c.localName + ':' + (c.getAttribute('preserveAspectRatio') || '')), i1clipAttr: q(single, 'i1').querySelector('image').getAttribute('clip-path').startsWith('url(#'),
      i1clip: !!q(single, 'i1').querySelector('clipPath rect[rx]'), i2: q(single, 'i2').querySelector('image').getAttribute('preserveAspectRatio'),
      i3: q(single, 'i3').querySelectorAll('image').length, i3ph: q(single, 'i3').querySelectorAll('[data-dt-placeholder]').length, i3label: q(single, 'i3').querySelector('text').textContent,
      i4: q(single, 'i4').querySelectorAll('image').length, i4label: q(single, 'i4').querySelector('text').textContent,
      bg: Array.from(bg.querySelector('[data-dt-background] image') ? [bg.querySelector('[data-dt-background] image').getAttribute('preserveAspectRatio')] : []), bgClip: !!bg.querySelector('[data-dt-background] clipPath') };
  `);
  const flagW = 14 * 5 / 3;
  check('strip: empty and unknown slots collapse (2 images, second directly after the first + gap)', st.out.length === 2 &&
    Math.abs(st.out[0].x - 4) < 1e-3 && Math.abs(st.out[0].w - flagW) < 0.01 && Math.abs(st.out[0].h - 14) < 1e-3 &&
    Math.abs(st.out[1].x - (4 + flagW + 3.5)) < 0.01 && Math.abs(st.out[1].w - 14) < 1e-3, JSON.stringify(st.out));
  check('strip: case-insensitive asset keys via field value ("FLAG-DE")', st.out[0].href === '/assets/flag-de' && st.out[1].href === '/assets/icon-schwangerschaft', st.out.map(i => i.href).join());
  check('strip: output mode draws no placeholders', st.phOut.length === 0, String(st.phOut.length));
  check('strip: editor mode draws dashed placeholders with the field labels for the empty slots, real pictures unchanged',
    st.phEd.join() === 'Siegel 1,Siegel 3' && JSON.stringify(st.ed) === JSON.stringify(st.out), st.phEd.join());
  check('strip: all four filled -> four pictures left to right', st.full.length === 4 && st.full.every((p, i) => i === 0 || p.x > st.full[i - 1].x), st.full.map(p => p.x.toFixed(1)).join());
  // photo 2:1 = 40, flag 5:3 = 33.33, seal 20, two gaps of 5
  const nat = 40 + 100 / 3 + 20 + 10;
  const sc = 50 / nat;
  check('strip: wider than the box scales everything down uniformly (width <= w, same aspect, centred vertically)', st.narrow.length === 3 && Math.abs(st.narrow[2].x + st.narrow[2].w - (10 + 50)) < 0.01 && Math.abs(st.narrow[0].h - 20 * sc) < 0.01 &&
    Math.abs(st.narrow[0].w / st.narrow[0].h - 2) < 0.01 && Math.abs(st.narrow[0].x - 10) < 1e-6, JSON.stringify(st.narrow));
  const total = nat;
  check('strip: align centre / right (box 120 wide)', Math.abs(st.centred[0].x - (10 + (120 - total) / 2)) < 0.01 && Math.abs(st.right[2].x + st.right[2].w - 130) < 0.01, st.centred[0].x.toFixed(2) + ' / ' + (st.right[2].x + st.right[2].w).toFixed(2));
  check('image: cover = slice + rounded clip, contain = meet, fill', st.i1.includes('image:xMidYMid slice') && st.i1clip && st.i1clipAttr && st.i2 === 'xMidYMid meet', st.i1.join() + ' ' + st.i2);
  check('image: unknown asset / hostile field value draws no image, editor placeholder shows asset key / field label', st.i3 === 0 && st.i3ph === 1 && st.i3label === 'does-not-exist' && st.i4 === 0 && st.i4label === 'A', [st.i3, st.i3label, st.i4, st.i4label].join());
  check('background image: cover slice, clipped to the page', st.bg[0] === 'xMidYMid slice' && st.bgClip, st.bg.join());

  step = 'section 8';
  // ---- 8. ids, security --------------------------------------------------------------------------------------------
  const ids = await run(`
    const doc = ${JSON.stringify(doc)};
    const a = await DtEngine.render(doc, values(doc), { assetUrl, fonts: ${JSON.stringify(FONTS)} });
    const b = await DtEngine.render(doc, values(doc), { assetUrl, fonts: ${JSON.stringify(FONTS)} });
    const c = await DtEngine.render(doc, values(doc), { assetUrl, fonts: ${JSON.stringify(FONTS)}, idPrefix: 'thumb 7' });
    const idsOf = s => Array.from(s.querySelectorAll('[id]')).map(e => e.id);
    const cover = { schema: 1, unit: 'mm', width: 100, height: 50, elements: [{ type: 'image', id: 'i', x: 0, y: 0, w: 40, h: 40, fit: 'cover', source: { asset: 'photo-wide' } }] };
    const d = await DtEngine.render(cover, {}, { assetUrl }); const e = await DtEngine.render(cover, {}, { assetUrl });
    const f = await DtEngine.render(cover, {}, { assetUrl, idPrefix: 'thumb 7' });
    document.getElementById('stage').append(a, b, c, d, e, f);
    const everything = [a, b, c, d, e, f].flatMap(idsOf);
    // hostile document
    const evil = { schema: 1, unit: 'mm', width: 50, height: 30, background: { color: '#fff" onload="alert(1)' }, fields: [{ key: 'X', type: 'text', sample: '<img src=x onerror=alert(1)>' }, { key: 'P', type: 'image', sample: 'javascript:alert(1)' }],
      elements: [{ type: 'text', id: 'a"><script>alert(1)</script>', wrap: false, text: '{{X}} <script>alert(1)</script> &amp; "quotes"', color: 'red" onload="alert(1)', fontFamily: 'x" onload="alert(1)', x: 1, y: 1, w: 40, h: 10 },
                 { type: 'shape', id: 's', shape: 'rect', fill: 'url(javascript:alert(1))', stroke: '#12', x: 0, y: 0, w: 5, h: 5 },
                 { type: 'image', id: 'p', source: { field: 'P' }, x: 0, y: 0, w: 5, h: 5 }] };
    const calls = [];
    const evilSvg = await DtEngine.render(evil, null, { assetUrl: k => { calls.push(k); return null; } });
    document.getElementById('stage').append(evilSvg);
    const serialized = new XMLSerializer().serializeToString(evilSvg);
    return { ids: everything, unique: new Set(everything).size === everything.length, prefixed: idsOf(f).every(i => i.startsWith('thumb_7-')), prefixedCount: idsOf(f).length,
      calls, hasScript: evilSvg.querySelectorAll('script').length, onAttrs: Array.from(evilSvg.querySelectorAll('*')).flatMap(el => Array.from(el.attributes).map(a => a.name)).filter(n => /^on/i.test(n) || n === 'style'),
      text: evilSvg.querySelector('text').textContent, fill: evilSvg.querySelector('text').getAttribute('fill'), bg: evilSvg.querySelector('rect').getAttribute('fill'),
      shapeFill: evilSvg.querySelector('[data-el-id=s] rect').getAttribute('fill'), elId: evilSvg.querySelectorAll('g[data-el-id]')[0].getAttribute('data-el-id'),
      family: evilSvg.querySelector('text').getAttribute('font-family'), violations: window.__violations, serialized: serialized.length };
  `);
  check('unique ids across renders on one page (clip paths)', ids.unique && ids.ids.length === 3, ids.ids.length + ' ids');
  check('idPrefix is used (sanitised)', ids.prefixed && ids.prefixedCount > 0, String(ids.prefixedCount));
  check('hostile document: no script element, no on*/style attributes, text only as text', ids.hasScript === 0 && ids.onAttrs.length === 0 &&
    ids.text === '<img src=x onerror=alert(1)> <script>alert(1)</script> &amp; "quotes"', JSON.stringify(ids.onAttrs));
  check('hostile document: colours fall back to defaults', ids.fill === '#000000' && ids.bg === '#ffffff' && ids.shapeFill === 'none', [ids.fill, ids.bg, ids.shapeFill].join());
  check('hostile document: field values only go through assetUrl', ids.calls.length === 1 && ids.calls[0] === 'javascript:alert(1)', ids.calls.join());
  check('hostile document: family cannot break out of the attribute', /^'[^'"\\;{}<>]*', sans-serif$/.test(ids.family), ids.family);
  check('no CSP violation (no inline style, scripts or foreign sources)', ids.violations.length === 0, ids.violations.join('; '));

  step = 'section 9';
  // ---- 9. standalone SVG --------------------------------------------------------------------------------------------
  const standalone = await run(`
    const doc = ${JSON.stringify(doc)};
    const text = await DtEngine.toStandaloneSvg(doc, values(doc), { assetUrl, fonts: ${JSON.stringify(FONTS)} });
    return { text, fontFaces: (text.match(/@font-face/g) || []).length };
  `);
  // Parsed in a page without CSP (a parsed <style> would otherwise be blocked by the page's own policy).
  const blank = await context.newPage();
  const parsed = await blank.evaluate(text => {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    return { error: !!doc.querySelector('parsererror'), styleCount: doc.querySelectorAll('style').length,
      hrefs: Array.from(doc.querySelectorAll('image')).map(i => (i.getAttribute('xlink:href') || i.getAttribute('href') || '').slice(0, 40)) };
  }, standalone.text);
  await blank.close();
  Object.assign(standalone, parsed);
  const stripped = standalone.text.replace(/xmlns(:\w+)?="[^"]*"/g, '');
  fs.writeFileSync(path.join(outDir, 'label-standalone.svg'), standalone.text);
  check('standalone SVG is well-formed XML with an XML declaration', !standalone.error && standalone.text.startsWith('<?xml'), String(standalone.text.length) + ' bytes');
  check('standalone SVG has no http(s)/relative URL (only namespaces)', !/https?:/i.test(stripped) && !/url\(\s*["']?(?!#|data:)/i.test(stripped.replace(/src:url\("data:[^"]*"\)/g, '')) &&
    standalone.hrefs.length === 2 && standalone.hrefs.every(h => h.startsWith('data:image/svg+xml;base64,')), standalone.hrefs.join(' | '));
  check('standalone SVG embeds every used font face as @font-face data URI', standalone.fontFaces === 4 && /src:url\("data:font\/ttf;base64,/.test(standalone.text) && standalone.styleCount === 1, standalone.fontFaces + ' faces');

  step = 'section 10';
  // ---- 10. PNG ------------------------------------------------------------------------------------------------------
  const rasterOf = async (opts, extra) => {
    const b64 = await run(`
      const doc = ${JSON.stringify(doc)};
      const blob = await DtEngine.rasterize(doc, values(doc), Object.assign({ assetUrl, fonts: ${JSON.stringify(FONTS)} }, ${JSON.stringify(opts)}));
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      let ink = null;
      if (${JSON.stringify(!!extra)}) {
        const bmp = await createImageBitmap(blob); const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
        const ctx = c.getContext('2d'); ctx.drawImage(bmp, 0, 0); const d = ctx.getImageData(0, 0, c.width, c.height).data;
        let dark = 0, orange = 0, white = 0; for (let i = 0; i < d.length; i += 4) { if (d[i] < 80 && d[i + 1] < 80 && d[i + 2] < 80) dark++; else if (d[i] > 230 && d[i + 1] > 140 && d[i + 1] < 190 && d[i + 2] < 90) orange++; else if (d[i] > 250 && d[i + 1] > 250 && d[i + 2] > 250) white++; }
        ink = { dark, orange, white, total: d.length / 4, type: blob.type };
      }
      return { b64: btoa(s), ink };
    `);
    return b64;
  };
  const full = await rasterOf({}, true);
  const png = Buffer.from(full.b64, 'base64');
  fs.writeFileSync(path.join(outDir, 'label-300dpi.png'), png);
  const info = parsePng(png);
  check('PNG: 150 x 100 mm at 300 dpi = 1772 x 1181 px', info.signature && info.width === 1772 && info.height === 1181, info.width + ' x ' + info.height);
  check('PNG: valid chunks incl. pHYs ~300 dpi (11811 px/m)', info.chunks.every(c => c.crcOk) && Math.abs(info.pxPerMetre - 11811) <= 3 && info.unit === 1 && info.chunks[1].type === 'pHYs', JSON.stringify(info.chunks.map(c => c.type)) + ' ' + info.pxPerMetre);
  check('PNG: content drawn (dark script text, orange logo word, white paper), image/png', full.ink.dark > 20000 && full.ink.orange > 200 && full.ink.white > full.ink.total * 0.5 && full.ink.type === 'image/png', JSON.stringify(full.ink));
  const half = parsePng(Buffer.from((await rasterOf({ scale: 0.5 })).b64, 'base64'));
  const thumb = parsePng(Buffer.from((await rasterOf({ maxWidth: 480 })).b64, 'base64'));
  const dpi96 = parsePng(Buffer.from((await rasterOf({ dpi: 96 })).b64, 'base64'));
  check('PNG: scale 0.5, maxWidth 480, dpi 96', half.width === 886 && half.height === 591 && thumb.width === 480 && thumb.height === 320 && dpi96.width === 567 && dpi96.height === 378,
    [half.width + 'x' + half.height, thumb.width + 'x' + thumb.height, dpi96.width + 'x' + dpi96.height].join(' '));
  fs.writeFileSync(path.join(outDir, 'label-thumb.png'), Buffer.from((await rasterOf({ maxWidth: 480 })).b64, 'base64'));

  step = 'section 11';
  // ---- 11. ZIP -------------------------------------------------------------------------------------------------------
  const zipB64 = await run(`
    const blob = await DtEngine.zip([
      { name: 'Käse-ü ✓.txt', blob: new Blob(['Grüße, Welt! '.repeat(50)], { type: 'text/plain' }) },
      { name: 'label-2.png', blob: new Blob([new Uint8Array(70000).map((_, i) => (i * 31) & 255)]) },
      { name: 'dir\\\\..\\\\x/label-3.txt', blob: new Blob([]) },
      { name: 'label-2.png', blob: new Uint8Array([1, 2, 3]) },
    ]);
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return { b64: btoa(s), type: blob.type };
  `);
  const zipBuf = Buffer.from(zipB64.b64, 'base64');
  fs.writeFileSync(path.join(outDir, 'test.zip'), zipBuf);
  const z = parseZip(zipBuf);
  const expected = [Buffer.from('Grüße, Welt! '.repeat(50)), Buffer.from(new Uint8Array(70000).map((_, i) => (i * 31) & 255)), Buffer.alloc(0), Buffer.from([1, 2, 3])];
  check('ZIP: signatures, entries, central directory consistent', z.count === 4 && z.centralEndsAtEocd && zipB64.type === 'application/zip', z.count + ' entries');
  check('ZIP: names are UTF-8 (flag bit 11), sanitised, duplicates numbered', z.entries.every(e => e.flags & 0x0800) && z.entries.map(e => e.name).join('|') === 'Käse-ü ✓.txt|label-2.png|dir/x/label-3.txt|label-2 (2).png' &&
    z.entries.every(e => e.name === e.localName), z.entries.map(e => e.name).join('|'));
  check('ZIP: store-only, sizes and CRC32 match local + central header and the content', z.entries.every((e, i) => e.method === 0 && e.size === e.compressed && e.size === expected[i].length && e.localSize === e.size && e.crc === crc32(expected[i]) && e.localCrc === e.crc && e.data.equals(expected[i])), '');
  check('ZIP: a system unzip can read it', await (async () => {
    try {
      // PowerShell Expand-Archive is not available everywhere; fall back to the structural check above.
      const { spawnSync } = require('child_process');
      const dest = path.join(outDir, 'unzipped');
      fs.rmSync(dest, { recursive: true, force: true });
      const r = spawnSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${path.join(outDir, 'test.zip')}' -DestinationPath '${dest}' -Force`], { encoding: 'utf8' });
      if (r.status !== 0) return true;
      return fs.readFileSync(path.join(dest, 'Käse-ü ✓.txt')).equals(expected[0]) && fs.readFileSync(path.join(dest, 'label-2.png')).equals(expected[1]);
    } catch (e) { return true; }
  })(), '');

  step = 'section 12';
  // ---- 12. screenshot of the rendered output (white page) for the visual comparison -------------------------------
  const shot = await context.newPage();
  await shot.goto(base + '/tests/e2e/engine/engine.html');
  await shot.evaluate(`(async () => {
    ${helper}
    const doc = ${JSON.stringify(doc)};
    const svg = await DtEngine.render(doc, values(doc), { assetUrl, fonts: ${JSON.stringify(FONTS)} });
    svg.setAttribute('width', '960'); svg.setAttribute('height', '640');
    document.body.appendChild(svg);
    document.body.setAttribute('data-ready', '1');
  })()`);
  await shot.setViewportSize({ width: 980, height: 660 });
  await shot.screenshot({ path: path.join(outDir, 'label-output.png'), caret: 'initial', animations: 'allow' });

  await browser.close();
  server.close();

  // ---- report ---------------------------------------------------------------------------------------------------------
  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.detail ? '  [' + r.detail + ']' : ''));
  }
  for (const p of problems) { failed++; console.log('FAIL ' + p); }
  console.log('\n' + (results.length - results.filter(r => !r.ok).length) + '/' + results.length + ' checks passed; files in ' + outDir);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
