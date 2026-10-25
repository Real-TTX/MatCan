// Checks the render engine (src/DesignThix/wwwroot/js/dt-engine.js) in a real browser (Edge via Playwright).
//   node tests/e2e/engine/engine-check.js
// Playwright comes from tests/e2e/node_modules (npm install there). The test fonts are the bundled ones (src/DesignThix/wwwroot/fonts), so the check runs on any machine.
// Env: DT_BROWSER = firefox | webkit to run in another engine (default Edge); DT_SCREENSHOT_DIR = where the screenshots and the PNG go (default: the system temp directory).
'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const playwright = require('playwright');
// DT_BROWSER=firefox|webkit runs the same checks in another engine (default: Edge).
const browserName = process.env.DT_BROWSER || 'chromium';

const repoRoot = path.resolve(__dirname, '../../..');
const outDir = process.env.DT_SCREENSHOT_DIR || path.join(os.tmpdir(), 'designthix-engine');
fs.mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------------------------------------------------------
// Test assets served by the test server
// ---------------------------------------------------------------------------------------------------------------

const FONT_DIR = path.resolve(__dirname, '../../../src/DesignThix/wwwroot/fonts');
const FONT_FILES = { 'script.ttf': 'KaushanScript-Regular.ttf', 'script-bold.ttf': 'KaushanScript-Regular.ttf', 'sans.ttf': 'Montserrat-Variable.ttf', 'sans-bold.ttf': 'Montserrat-Variable.ttf', 'impact.ttf': 'BebasNeue-Regular.ttf' };

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
  return makeRgbaPng(width, height, () => [r, g, b, 255]);
}

/** A PNG (RGBA) whose pixels come from `pixel(x, y) -> [r, g, b, a]`. */
function makeRgbaPng(width, height, pixel) {
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
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (1 + width * 4) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
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
  // A colourful 3:2 picture (sky gradient, sun, hills) for masks, crops and filters in the showcase.
  'photo-art': { type: 'image/png', body: makeRgbaPng(180, 120, (x, y) => {
    const sun = Math.hypot(x - 120, y - 38) < 16;
    if (sun) return [255, 214, 64, 255];
    const hill = 84 + 12 * Math.sin(x / 17) + 8 * Math.sin(x / 7 + 1);
    if (y > hill) return [34 + (y - hill), 140 - (y - hill) / 2, 70, 255];
    return [Math.round(70 + y * 1.2), Math.round(150 + y * 0.8), 235 - Math.round(y * 0.5), 255];
  }) },
};

// Lucide-style icon bodies (24 x 24 grid, stroke) that the tests hand to opts.icon.
const ICONS = {
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  'map-pin': '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  // hostile: only the path (d), circle (cx cy r) and rect (x y width height) may survive
  evil: '<script>alert(1)</script><path d="M2 2L20 20" onload="alert(1)" fill="red" style="stroke:red" class="x" href="javascript:alert(1)"/>' +
    '<foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject><use href="#a" x="1"/><image href="http://evil.example/x.png" width="5" height="5"/>' +
    '<g><path d="M1 1L3 3"/></g><circle cx="5" cy="5" r="2" onclick="x" href="javascript:1" fill="url(#x)"/><path d="javascript:alert(1)"/>' +
    '<rect x="1" y="2" width="3" height="4" onfocus="x" stroke="red"/><text x="1" y="1">no</text><a href="http://evil"><path d="M0 0L9 9"/></a>' +
    '<line x1="1" y1="2" x2="3" y2="4" style="x"/><polygon points="1,2 3,4 5,1" onmouseover="x"/>',
  broken: '<path d="M1 1" ',
  'evil-prefix': '<path d="M1 1L5 5" xlink:href="x"/>',
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

// ---------------------------------------------------------------------------------------------------------------
// QR decoder (undamaged symbols only: no error correction, but the Reed-Solomon codewords are verified), EAN and Code 128 readers
// ---------------------------------------------------------------------------------------------------------------

// Standard tables (ISO/IEC 18004): error correction codewords per block and number of blocks by version.
const QR_ECC_PER_BLOCK = {
  L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};
const QR_BLOCKS = {
  L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};

/** Divides by the generator of GF(256) (x^8 + x^4 + x^3 + x^2 + 1) with plain log tables of its own: the codewords of one block. */
function reedSolomonRemainder(data, degree) {
  const exp = new Array(512); const log = new Array(256);
  for (let i = 0, x = 1; i < 255; i++) { exp[i] = x; log[x] = i; x = (x << 1) ^ (x >= 128 ? 0x11d : 0); }
  for (let i = 255; i < 512; i++) exp[i] = exp[i - 255];
  const mul = (a, b) => (a === 0 || b === 0 ? 0 : exp[log[a] + log[b]]);
  let generator = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(generator.length + 1).fill(0);
    generator.forEach((c, j) => { next[j] ^= c; next[j + 1] ^= mul(c, exp[i]); });
    generator = next;
  }
  const message = data.concat(new Array(degree).fill(0));
  for (let i = 0; i < data.length; i++) {
    const coefficient = message[i];
    if (coefficient) for (let j = 1; j < generator.length; j++) message[i + j] ^= mul(generator[j], coefficient);
  }
  return message.slice(data.length);
}

/** Reads a QR matrix (array of rows of 0/1, no quiet zone): format info (both copies, BCH checked), version info, mask, data. */
function qrDecode(matrix) {
  const size = matrix.length;
  const version = (size - 17) / 4;
  if (!Number.isInteger(version) || version < 1 || version > 40) throw new Error('bad size ' + size);
  const get = (x, y) => (matrix[y][x] ? 1 : 0);
  const number = bits => bits.reduce((a, b, i) => a | (b << i), 0);
  const copy1 = [];
  for (let i = 0; i <= 5; i++) copy1[i] = get(8, i);
  copy1[6] = get(8, 7); copy1[7] = get(8, 8); copy1[8] = get(7, 8);
  for (let i = 9; i < 15; i++) copy1[i] = get(14 - i, 8);
  const copy2 = [];
  for (let i = 0; i < 8; i++) copy2[i] = get(size - 1 - i, 8);
  for (let i = 8; i < 15; i++) copy2[i] = get(8, size - 15 + i);
  if (number(copy1) !== number(copy2)) throw new Error('the two copies of the format information differ');
  const format = number(copy1) ^ 0x5412;
  let remainder = format;
  for (let i = 14; i >= 10; i--) if ((remainder >> i) & 1) remainder ^= 0x537 << (i - 10);
  if (remainder !== 0) throw new Error('format information fails its BCH check');
  const level = ['M', 'L', 'H', 'Q'][(format >> 13) & 3];
  const mask = (format >> 10) & 7;
  if (version >= 7) {
    const info = [];
    const info2 = [];
    for (let i = 0; i < 18; i++) { info[i] = get(size - 11 + (i % 3), Math.floor(i / 3)); info2[i] = get(Math.floor(i / 3), size - 11 + (i % 3)); }
    const value = number(info);
    let r = value;
    for (let i = 17; i >= 12; i--) if ((r >> i) & 1) r ^= 0x1f25 << (i - 12);
    if (number(info2) !== value || r !== 0 || (value >> 12) !== version) throw new Error('version information is wrong');
  }
  // function modules: finders with separators and format areas, timing, alignment, version blocks
  const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if ((x <= 8 && y <= 8) || (x >= size - 8 && y <= 8) || (x <= 8 && y >= size - 8) || x === 6 || y === 6) isFunction[y][x] = true;
    }
  }
  if (version >= 2) {
    const count = Math.floor(version / 7) + 2;
    const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
    const centres = [6];
    for (let k = 0; k < count - 1; k++) centres.push(size - 7 - k * step);
    centres.sort((a, b) => a - b);
    for (const cy of centres) {
      for (const cx of centres) {
        if ((cx === 6 && cy === 6) || (cx === 6 && cy === centres[count - 1]) || (cy === 6 && cx === centres[count - 1])) continue;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) isFunction[cy + dy][cx + dx] = true;
      }
    }
  }
  if (version >= 7) {
    for (let y = 0; y < 6; y++) for (let x = size - 11; x < size - 8; x++) { isFunction[y][x] = true; isFunction[x][y] = true; }
  }
  const unmasked = (x, y) => {
    const flips = [(x + y) % 2 === 0, y % 2 === 0, x % 3 === 0, (x + y) % 3 === 0, (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
      ((x * y) % 2) + ((x * y) % 3) === 0, (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0][mask];
    return get(x, y) ^ (flips ? 1 : 0);
  };
  const bits = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        if (!isFunction[y][x]) bits.push(unmasked(x, y));
      }
    }
  }
  const total = Math.floor(bits.length / 8);
  const codewords = [];
  for (let i = 0; i < total; i++) codewords.push(bits.slice(i * 8, i * 8 + 8).reduce((a, b) => (a << 1) | b, 0));
  const blockCount = QR_BLOCKS[level][version];
  const eccLength = QR_ECC_PER_BLOCK[level][version];
  const shortLength = Math.floor(total / blockCount);
  const shortBlocks = blockCount - (total % blockCount);
  const blocks = Array.from({ length: blockCount }, () => ({ data: [], ecc: [] }));
  const dataLength = i => shortLength - eccLength + (i >= shortBlocks ? 1 : 0);
  let index = 0;
  for (let i = 0; i <= shortLength - eccLength; i++) blocks.forEach((b, j) => { if (i < dataLength(j)) b.data.push(codewords[index++]); });
  for (let i = 0; i < eccLength; i++) blocks.forEach(b => b.ecc.push(codewords[index++]));
  const eccOk = blocks.every(b => reedSolomonRemainder(b.data, eccLength).join() === b.ecc.join());
  const data = blocks.flatMap(b => b.data);
  const stream = data.flatMap(byte => Array.from({ length: 8 }, (_, i) => (byte >> (7 - i)) & 1));
  const read = (from, count) => stream.slice(from, from + count).reduce((a, b) => (a << 1) | b, 0);
  const mode = read(0, 4);
  const countBits = version < 10 ? 8 : 16;
  const length = read(4, countBits);
  const bytes = Buffer.from(Array.from({ length }, (_, i) => read(4 + countBits + i * 8, 8)));
  return { version, level, mask, mode, text: bytes.toString('utf8'), eccOk, codewords: total };
}

/** The module matrix of a drawn QR code: the <path> (runs "M x y h n v1 h-n z" in module units) and its transform. */
function matrixFromQrPath(d, transform, box, quiet) {
  const scale = Number(/scale\(([\d.]+)\)/.exec(transform)[1]);
  const across = Math.round(Math.min(box.w, box.h) / scale);
  const size = across - 2 * quiet;
  const rows = Array.from({ length: size }, () => new Array(size).fill(0));
  for (const m of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-(\d+)z/g)) {
    const x = Number(m[1]) - quiet;
    const y = Number(m[2]) - quiet;
    if (m[3] !== m[4]) throw new Error('run lengths differ');
    for (let i = 0; i < Number(m[3]); i++) rows[y][x + i] = 1;
  }
  return rows;
}

/** Module sequence of a drawn barcode (runs "M x 0 h n v H h-n z"), starting at the first module after the quiet zone. */
function barsFromPath(d, quietLeft, total) {
  const bars = new Array(total).fill(0);
  const heights = new Set();
  for (const m of d.matchAll(/M(\d+) 0h(\d+)v([\d.]+)h-(\d+)z/g)) {
    heights.add(m[3]);
    for (let i = 0; i < Number(m[2]); i++) bars[Number(m[1]) - quietLeft + i] = 1;
  }
  return { bars, heights: Array.from(heights) };
}

const EAN_L_SPEC = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const EAN_G_SPEC = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const EAN_R_SPEC = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const EAN_PARITY_SPEC = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

/** Reads EAN-13 / EAN-8 from its module sequence with the tables of the standard; null when the structure is wrong. */
function eanDecode(bars) {
  const text = bars.join('');
  const half = text.length === 95 ? 6 : (text.length === 67 ? 4 : 0);
  if (!half || text.slice(0, 3) !== '101' || text.slice(3 + 7 * half, 8 + 7 * half) !== '01010' || text.slice(-3) !== '101') return null;
  let parity = '';
  let digits = '';
  for (let i = 0; i < half; i++) {
    const chunk = text.slice(3 + 7 * i, 10 + 7 * i);
    const l = EAN_L_SPEC.indexOf(chunk);
    const g = EAN_G_SPEC.indexOf(chunk);
    if (l >= 0) { parity += 'L'; digits += l; } else if (g >= 0) { parity += 'G'; digits += g; } else return null;
  }
  let right = '';
  for (let i = 0; i < half; i++) {
    const r = EAN_R_SPEC.indexOf(text.slice(8 + 7 * half + 7 * i, 15 + 7 * half + 7 * i));
    if (r < 0) return null;
    right += r;
  }
  if (half === 6) {
    const first = EAN_PARITY_SPEC.indexOf(parity);
    if (first < 0) return null;
    digits = first + digits;
  } else if (parity !== 'LLLL') return null;
  return digits + right;
}

// Code 128 patterns of the standard (bar/space widths), values 0..106, stop pattern last.
const CODE128_SPEC = ('212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 ' +
  '123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 ' +
  '131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 ' +
  '311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 ' +
  '142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 ' +
  '111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112').split(' ');

/** Reads Code 128 symbol values (start .. checksum) from a module sequence: run widths, 6 per symbol, then the stop. */
function code128Read(bars) {
  const widths = [];
  for (let i = 0; i < bars.length;) {
    let j = i;
    while (j < bars.length && bars[j] === bars[i]) j++;
    widths.push(j - i);
    i = j;
  }
  const values = [];
  for (let i = 0; i + 7 <= widths.length; i += 6) {
    if (widths.slice(i, i + 7).join('') === CODE128_SPEC[106]) return { values, stop: true };
    const value = CODE128_SPEC.indexOf(widths.slice(i, i + 6).join(''));
    if (value < 0 || value > 105) return { values, stop: false };
    values.push(value);
  }
  return { values, stop: false };
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
  // Chrome's XML error document (a body that is not well-formed) carries an inline style: with the app's CSP that is logged once per
  // parse. Only the section that feeds malformed icon bodies tolerates exactly that message.
  let tolerateParserErrorStyle = false;
  page.on('console', m => {
    if (m.type() !== 'error') return;
    if (tolerateParserErrorStyle && /Applying inline style violates/.test(m.text())) return;
    problems.push('console [' + step + ']: ' + m.text().slice(0, 140));
  });
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
    const testFonts = ${JSON.stringify(FONTS)};
    const ICON_BODIES = ${JSON.stringify(ICONS)};
    const iconFn = name => (Object.prototype.hasOwnProperty.call(ICON_BODIES, name) ? ICON_BODIES[name] : null);
    const iconFnAsync = name => new Promise(resolve => setTimeout(() => resolve(iconFn(name)), 5));
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
  const page0 = norm.n.pages[0];
  const t0 = page0.elements[0];
  check('normalize: defaults and clamps', norm.n.unit === 'mm' && norm.n.width === 100 && norm.n.height === 0.1 && norm.n.dpi === 1200 && norm.n.locale === 'de-DE' &&
    page0.background.color === '#ffffff' && page0.background.fit === 'cover', JSON.stringify(page0.background) + norm.n.width + norm.n.height);
  check('normalize: element values', t0.x === 0 && t0.w === 1e6 && t0.fontSize === 1000 && t0.color === '#000000' && t0.align === 'left' && t0.opacity === 1 && t0.rotation === 360 && t0.showIf === null, JSON.stringify(t0));
  check('normalize: fields deduplicated and validated, unknown elements dropped, ids unique, strip limited',
    norm.n.fields.length === 1 && norm.n.fields[0].decimals === 2 && page0.elements.length === 4 && new Set(page0.elements.map(e => e.id)).size === 4 && page0.elements[3].items.length === 12,
    norm.n.fields.length + ' fields, ' + page0.elements.length + ' elements');
  check('normalize is idempotent and tolerates null', norm.same && norm.empty.pages[0].elements.length === 0 && norm.empty.width === 100, '');
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

  // ===================================================================================================================
  // Schema 2 (phase K1): pages, groups, effects, shapes, icons, QR and barcodes
  // ===================================================================================================================
  const okAll = list => list.every(Boolean);
  const near = (a, b, tolerance) => Math.abs(a - b) <= (tolerance === undefined ? 0.02 : tolerance);

  step = 'section 13';
  // ---- 13. schema 2: upgrade 1 -> 2, normalisation, limits ----------------------------------------------------------------
  const hostile2 = {
    schema: 2, unit: 'mm', width: 100, height: 60,
    pages: [
      { id: 'p1', name: 'x'.repeat(200),
        background: { color: null, gradient: { type: 'radial', angle: 400, stops: [{ offset: -1, color: '#f00' }, { offset: 2, color: 'blue' }, { offset: 0.5, color: '#00ff00' }, { offset: 0.6, color: '#111' }, { offset: 0.7, color: '#222' }, { offset: 0.8, color: '#333' }, { offset: 0.9, color: '#444' }] }, asset: ' bg ', fit: 'weird', junk: 1 },
        elements: [
          { type: 'shape', id: 's1', shape: 'star', points: 99, innerRadius: 5, fill: { type: 'linear', angle: 10, stops: [{ offset: 0, color: '#fff' }] }, startCap: 'weird', endCap: 'arrow', flipX: 'yes', shadow: { color: 'red', opacity: 7, blur: 999, x: -5000, y: 3 } },
          { type: 'shape', id: 's2', shape: 'speech', fill: '#ABCDEF' },
          { type: 'image', id: 'i1', source: { asset: 'a' }, crop: { x: 2, y: -1, w: 5, h: 0 }, mask: 'blob', border: { color: 'x', width: 500 }, filters: { brightness: 500, contrast: -500, saturation: 'a', blur: 99, grayscale: 1, sepia: true } },
          { type: 'text', id: 't1', text: 'x', curve: 500, list: 'roman', outline: { color: 'red', width: -3 }, background: { color: '#123', radius: -1, padding: 1e9 }, underline: 1, strike: true },
          { type: 'icon', id: 'ic', icon: 'Bad Name!', color: 'nope', strokeWidth: 99 },
          { type: 'icon', id: 'ic2', icon: 'map-pin', strokeWidth: 0.1 },
          { type: 'qr', id: 'q', value: 'v'.repeat(2000), ecc: 'X', background: 'red', quiet: false },
          { type: 'barcode', id: 'b', format: 'upc', value: 'v'.repeat(200), fontFamily: 'a'.repeat(300) },
          { type: 'imageStrip', id: 'st', items: [{ asset: 'a' }], mask: 'circle', border: { width: 2 } },
          { type: 'group', id: 'g1', children: [{ type: 'text', id: 'c1' }, { type: 'group', id: 'g2', children: [{ type: 'shape', id: 'c2' }, { type: 'group', id: 'g3', children: [{ type: 'shape', id: 'c3' }, { type: 'group', id: 'g4', children: [{ type: 'shape', id: 'c4' }] }] }] }] },
        ] },
      { id: 'p1', name: 'duplicate page id', elements: [{ type: 'shape', id: 's1' }] },
    ],
  };
  const upg = await run(`
    const v1 = arg.v1; const before = JSON.stringify(v1);
    const n1 = DtEngine.normalize(v1);
    const n2 = DtEngine.normalize(n1);
    const n3 = DtEngine.normalize(JSON.parse(JSON.stringify(n1)));
    const h = arg.hostile; const hostileBefore = JSON.stringify(h);
    const hn = DtEngine.normalize(h);
    const hn2 = DtEngine.normalize(hn);
    const countAll = d => d.pages.reduce((n, p) => n + p.elements.length, 0);
    const manyPages = DtEngine.normalize({ pages: Array.from({ length: 60 }, (_, i) => ({ id: 'x' + i, elements: [] })) });
    const manyEl = DtEngine.normalize({ pages: [{ elements: Array.from({ length: 600 }, () => ({ type: 'shape' })) }] });
    const total = DtEngine.normalize({ pages: Array.from({ length: 5 }, () => ({ elements: Array.from({ length: 450 }, () => ({ type: 'shape' })) })) });
    const groupTotal = DtEngine.normalize({ pages: [{ elements: [{ type: 'group', children: Array.from({ length: 600 }, () => ({ type: 'shape' })) }] }] });
    const noPages = DtEngine.normalize({ pages: [] });
    return {
      n1, keys: Object.keys(n1), unchanged: before === JSON.stringify(v1), same2: JSON.stringify(n1) === JSON.stringify(n2), same3: JSON.stringify(n1) === JSON.stringify(n3),
      aliasEl: n1.elements === n1.pages[0].elements, aliasBg: n1.background === n1.pages[0].background, aliasKeys: Object.keys(n1).filter(k => k === 'elements' || k === 'background'),
      count1: DtEngine.pageCount(v1), count2: DtEngine.pageCount(h), countNull: DtEngine.pageCount(null),
      hn, hostileUnchanged: hostileBefore === JSON.stringify(h), hostileSame: JSON.stringify(hn) === JSON.stringify(hn2),
      pages: manyPages.pages.length, perPage: manyEl.pages[0].elements.length, total: countAll(total), groupTotal: groupTotal.pages[0].elements[0].children.length,
      noPages: noPages.pages.length, noPagesBg: noPages.pages[0].background,
    };
  `, { v1: doc, hostile: hostile2 });
  const up = upg.n1;
  const upName = up.pages[0].elements.find(e => e.id === 'name');
  const docName = doc.elements.find(e => e.id === 'name');
  check('upgrade 1 -> 2: one page "p1" with the old elements and background, schema 2, no top-level elements/background',
    up.schema === 2 && up.pages.length === 1 && up.pages[0].id === 'p1' && up.pages[0].name === '' && up.pages[0].elements.length === doc.elements.length &&
    JSON.stringify(up.pages[0].background) === JSON.stringify({ color: '#ffffff', gradient: null, asset: null, fit: 'cover' }) &&
    upg.keys.join() === 'schema,unit,width,height,dpi,locale,fields,pages', upg.keys.join());
  check('upgrade keeps every schema-1 property of an element and adds the new defaults',
    upName.x === docName.x && upName.text === docName.text && upName.fontSize === docName.fontSize && upName.fit === 'shrink' && upName.flipX === false && upName.shadow === null &&
    upName.underline === false && upName.list === 'none' && upName.outline === null && upName.background === null && upName.curve === 0, JSON.stringify(upName).slice(0, 200));
  check('upgrade is idempotent, equal for already-upgraded documents (also after JSON), never mutates', upg.same2 && upg.same3 && upg.unchanged && upg.hostileUnchanged && upg.hostileSame, '');
  check('legacy aliases elements / background point at page 0 and are not enumerable', upg.aliasEl && upg.aliasBg && upg.aliasKeys.length === 0, '');
  check('pageCount (schema 1 = 1, schema 2, null = 1)', upg.count1 === 1 && upg.count2 === 2 && upg.countNull === 1 && upg.noPages === 1, [upg.count1, upg.count2, upg.countNull].join());
  const hp = upg.hn.pages[0];
  const hel = id => hp.elements.find(e => e.id === id);
  check('hostile page: name cut, colour null kept, gradient 5 valid stops (offsets clamped, invalid colour dropped), asset trimmed, fit default',
    hp.name.length === 80 && hp.background.color === null && hp.background.gradient.type === 'linear' && hp.background.gradient.angle === 360 && hp.background.gradient.stops.length === 5 &&
    hp.background.gradient.stops[0].offset === 0 && hp.background.gradient.stops.every(s => /^#[0-9a-f]{3,6}$/.test(s.color)) && hp.background.asset === 'bg' && hp.background.fit === 'cover' && !('junk' in hp.background),
    JSON.stringify(hp.background).slice(0, 160));
  check('hostile shape: star points/innerRadius clamped, one-stop gradient -> null, unknown cap -> none, flip needs true, shadow clamped',
    hel('s1').points === 12 && hel('s1').innerRadius === 0.9 && hel('s1').fill === null && hel('s1').startCap === 'none' && hel('s1').endCap === 'arrow' && hel('s1').flipX === false &&
    JSON.stringify(hel('s1').shadow) === JSON.stringify({ color: '#000000', opacity: 1, blur: 50, x: -1000, y: 3 }) && hel('s2').fill === '#abcdef' && hel('s2').shape === 'speech', JSON.stringify(hel('s1').shadow));
  check('hostile image: crop clamped inside the image, unknown mask -> none, border/filters clamped',
    hel('i1').crop.x === 0.999 && hel('i1').crop.y === 0 && near(hel('i1').crop.w, 0.001, 1e-9) && hel('i1').crop.h === 0.001 && hel('i1').mask === 'none' && hel('i1').border.width === 100 && hel('i1').border.color === '#000000' &&
    JSON.stringify(hel('i1').filters) === JSON.stringify({ brightness: 100, contrast: -100, saturation: 0, blur: 20, grayscale: false, sepia: true }), JSON.stringify(hel('i1').crop));
  check('hostile text: curve/list/outline/background clamped',
    hel('t1').curve === 100 && hel('t1').list === 'none' && hel('t1').outline.width === 0 && hel('t1').outline.color === '#000000' && hel('t1').background.color === '#123' &&
    hel('t1').background.radius === 0 && hel('t1').background.padding === 1e6 && hel('t1').underline === false && hel('t1').strike === true, JSON.stringify(hel('t1').background));
  check('hostile icon / qr / barcode / strip values',
    hel('ic').icon === '' && hel('ic').color === '#000000' && hel('ic').strokeWidth === 4 && hel('ic2').icon === 'map-pin' && hel('ic2').strokeWidth === 0.5 &&
    hel('q').value.length === 1000 && hel('q').ecc === 'M' && hel('q').background === '#ffffff' && hel('q').quiet === false &&
    hel('b').format === 'ean13' && hel('b').value.length === 80 && hel('b').showText === true && hel('b').fontFamily.length === 100 && hel('b').background === '#ffffff' &&
    hel('st').mask === 'circle' && hel('st').border.width === 2, '');
  const g1 = hel('g1');
  const g2 = g1 && g1.children.find(c => c.id === 'g2');
  const g3 = g2 && g2.children.find(c => c.id === 'g3');
  check('groups: normalised recursively, nesting depth 3 (a fourth group level is dropped), children keep their ids',
    g1 && g1.type === 'group' && g1.children.map(c => c.id).join() === 'c1,g2' && g2.children.map(c => c.id).join() === 'c2,g3' && g3.children.map(c => c.id).join() === 'c3' && g3.children[0].type === 'shape', JSON.stringify(g3 && g3.children.map(c => c.id)));
  const allIds = [];
  const collect = list => list.forEach(e => { allIds.push(e.id); if (e.children) collect(e.children); });
  upg.hn.pages.forEach(p => collect(p.elements));
  check('page ids and element ids are unique across pages and groups (duplicates renamed)', upg.hn.pages[1].id === 'p2' && upg.hn.pages[1].elements[0].id !== 's1' && new Set(allIds).size === allIds.length, allIds.join());
  check('limits: 50 pages, 500 elements per page, 2000 in total, group children count', upg.pages === 50 && upg.perPage === 500 && upg.total === 2000 && upg.groupTotal === 499, [upg.pages, upg.perPage, upg.total, upg.groupTotal].join());
  check('a document without pages still has one empty page with the default background', upg.noPagesBg.color === '#ffffff' && upg.noPagesBg.gradient === null, '');

  step = 'section 14';
  // ---- 14. fieldsUsed / assetKeysUsed over pages, groups, qr and barcode -----------------------------------------------------
  const multiDoc = {
    schema: 2, unit: 'mm', width: 100, height: 60,
    fields: [{ key: 'A', type: 'text' }, { key: 'B', type: 'text' }, { key: 'C', type: 'text' }, { key: 'D', type: 'image' }, { key: 'E', type: 'image' }, { key: 'F', type: 'text' }],
    pages: [
      { id: 'p1', background: { asset: 'Bg-One' }, elements: [
        { type: 'group', id: 'g', children: [{ type: 'text', id: 'ta', text: 'Hallo {{A}} {{ZZ}}' }, { type: 'image', id: 'ia', source: { asset: 'Logo-X' } }] },
        { type: 'image', id: 'ib', source: { asset: 'logo-x' } }] },
      { id: 'p2', background: { asset: 'bg-two' }, elements: [
        { type: 'qr', id: 'qq', value: 'https://x/{{B}}' }, { type: 'barcode', id: 'bb', value: '{{C}}', format: 'code128' },
        { type: 'image', id: 'id', source: { field: 'D' } }, { type: 'imageStrip', id: 'is', items: [{ field: 'E' }, { asset: 'seal-a' }, null] },
        { type: 'shape', id: 'sh', showIf: 'F' }] },
    ],
  };
  const used = await run(`return { used: DtEngine.fieldsUsed(arg), assets: DtEngine.assetKeysUsed(arg), assets1: DtEngine.assetKeysUsed(${JSON.stringify(doc)}) };`, multiDoc);
  const use = key => used.used.find(u => u.key === key);
  check('fieldsUsed covers all pages, group children, qr.value and barcode.value',
    ['A', 'B', 'C', 'D', 'E', 'F', 'ZZ'].every(k => use(k)) && use('A').uses[0].kind === 'text' && use('B').uses[0].kind === 'qr' && use('C').uses[0].kind === 'barcode' && use('D').uses[0].kind === 'image' &&
    use('E').uses[0].kind === 'strip' && use('F').uses[0].kind === 'showIf' && use('ZZ').defined === false && use('A').uses[0].elementId === 'ta', used.used.map(u => u.key).join());
  check('assetKeysUsed: backgrounds, images, strip items, groups; unique case-insensitively', used.assets.join() === 'Bg-One,Logo-X,bg-two,seal-a' && used.assets1.length === 0, used.assets.join());

  step = 'section 15';
  // ---- 15. pages: opts.page for render / toStandaloneSvg / rasterize ------------------------------------------------------
  const pg = await run(`
    const d = { schema: 2, unit: 'mm', width: 50, height: 30, pages: [
      { id: 'a', background: { color: '#ff0000' }, elements: [{ type: 'shape', id: 'r1', shape: 'rect', x: 1, y: 1, w: 5, h: 5, fill: '#000000' }] },
      { id: 'b', background: { color: '#00ff00' }, elements: [{ type: 'shape', id: 'r2', shape: 'rect', x: 1, y: 1, w: 5, h: 5, fill: '#000000' }] },
      { id: 'c', background: { color: null }, elements: [] }] };
    const info = async page => { const svg = await DtEngine.render(d, {}, page === undefined ? {} : { page }); const bg = svg.querySelector('[data-dt-background]');
      return { ids: Array.from(svg.querySelectorAll('[data-el-id]')).map(g => g.getAttribute('data-el-id')).join(), bg: bg ? bg.getAttribute('fill') : null }; };
    const standalone = await DtEngine.toStandaloneSvg(d, {}, { page: 1 });
    return { none: await info(), p0: await info(0), p1: await info(1), p2: await info(2), p7: await info(7), neg: await info(-3), str: await info('1'), standalone: standalone.includes('#00ff00') && !standalone.includes('#ff0000') };
  `);
  check('render: page 0 by default, page 1 / 2 picked, out of range clamped', pg.none.ids === 'r1' && pg.p0.bg === '#ff0000' && pg.p1.ids === 'r2' && pg.p1.bg === '#00ff00' && pg.p2.ids === '' && pg.p2.bg === null &&
    pg.p7.bg === null && pg.neg.bg === '#ff0000' && pg.str.bg === '#00ff00', JSON.stringify([pg.none, pg.p1, pg.p2]));
  check('toStandaloneSvg draws the chosen page', pg.standalone, '');

  step = 'section 16';
  // ---- 16. groups: transform of the whole group, opacity, shadow, children in page coordinates --------------------------------
  const gr = await run(`
    const stage = document.getElementById('stage');
    const child = (id, x, y) => ({ type: 'shape', id, shape: 'rect', x, y, w: 8, h: 10, fill: '#336699' });
    const mk = props => ({ schema: 2, unit: 'mm', width: 60, height: 40, pages: [{ elements: [Object.assign({ type: 'group', id: 'grp', x: 10, y: 10, w: 20, h: 10, children: [child('c1', 10, 10), { type: 'text', id: 'c2', text: 'Hi', x: 20, y: 10, w: 10, h: 10, fontSize: 10 }] }, props)] }] });
    const mount = async doc => { const svg = await DtEngine.render(doc, {}, { fonts: testFonts }); stage.replaceChildren(svg); return svg; };
    const centre = (svg, el) => { const r = el.getBoundingClientRect(); const s = svg.getBoundingClientRect(); const k = 60 / s.width; return [((r.left + r.right) / 2 - s.left) * k, ((r.top + r.bottom) / 2 - s.top) * k]; };
    const rotated = await mount(mk({ rotation: 30, flipX: true, opacity: 0.5, shadow: { color: '#112233', opacity: 0.4, blur: 3, x: 1, y: 2 } }));
    const g = q(rotated, 'grp');
    const flipOnly = await mount(mk({ flipX: true }));
    const flipCentre = centre(flipOnly, q(flipOnly, 'c1').querySelector('rect'));
    const rot90 = await mount(mk({ rotation: 90 }));
    const rotCentre = centre(rot90, q(rot90, 'c1').querySelector('rect'));
    const flipY = await mount(mk({ flipY: true }));
    const filter = g.querySelector('filter'); const ds = filter.querySelector('feDropShadow');
    const hidden = await DtEngine.render(mk({ hidden: true }), {}, {});
    const plain = await DtEngine.render(mk({}), {}, {});
    return {
      transform: g.getAttribute('transform'), opacity: g.getAttribute('opacity'), filterAttr: g.getAttribute('filter'), filterId: filter.id, region: filter.getAttribute('filterUnits'),
      ds: ['dx', 'dy', 'stdDeviation', 'flood-color', 'flood-opacity'].map(a => ds.getAttribute(a)), childParent: q(rotated, 'c1').parentNode === g && q(rotated, 'c2').parentNode === g,
      childAttrs: [q(rotated, 'c1').getAttribute('transform'), q(rotated, 'c1').getAttribute('opacity')], types: [g.getAttribute('data-el-type'), q(rotated, 'c1').getAttribute('data-el-type')],
      flipCentre, rotCentre, flipYTransform: q(flipY, 'grp').getAttribute('transform'),
      hiddenIds: Array.from(hidden.querySelectorAll('[data-el-id]')).length, plainIds: Array.from(plain.querySelectorAll('[data-el-id]')).map(x => x.getAttribute('data-el-id')).join(),
      plainTransform: q(plain, 'grp').getAttribute('transform'),
    };
  `);
  check('group: rotation + flip around the centre of its box (30° about 20,15; mirror about 20,15), opacity and shadow on the group <g>',
    gr.transform === 'rotate(30 20 15) translate(20 15) scale(-1 1) translate(-20 -15)' && gr.opacity === '0.5' && gr.filterAttr === 'url(#' + gr.filterId + ')' && gr.region === 'userSpaceOnUse' &&
    gr.ds.join() === '1,2,1.5,#112233,0.4' && gr.flipYTransform === 'translate(20 15) scale(1 -1) translate(-20 -15)' && gr.plainTransform === null, gr.transform);
  check('group: data-el-id on the group and on its children; children are nested inside and carry no transform of their own',
    gr.childParent && gr.childAttrs[0] === null && gr.childAttrs[1] === null && gr.types.join() === 'group,shape' && gr.plainIds === 'grp,c1,c2', gr.plainIds);
  check('group: a mirrored group puts a child from the left half to the right half (child centre 14 -> 26)', near(gr.flipCentre[0], 26, 0.3) && near(gr.flipCentre[1], 15, 0.3), gr.flipCentre.join());
  check('group: rotated by 90° the child (centre 14,15) moves to 20,9 about the centre of the group box', near(gr.rotCentre[0], 20, 0.3) && near(gr.rotCentre[1], 9, 0.3), gr.rotCentre.join());
  check('group: hidden hides the children too', gr.hiddenIds === 0, String(gr.hiddenIds));

  step = 'section 17';
  // ---- 17. images: crop math, masks, border, filters, frames --------------------------------------------------------------
  const im = await run(`
    const stage = document.getElementById('stage');
    const opts = { assetUrl, mode: 'output' };
    const one = (props, mode) => DtEngine.render({ schema: 2, unit: 'mm', width: 100, height: 60, pages: [{ elements: [Object.assign({ type: 'image', id: 'i', x: 0, y: 0, w: 40, h: 40, source: { asset: 'photo-wide' }, fit: 'contain' }, props)] }] }, {}, Object.assign({}, opts, mode ? { mode } : {}));
    const read = svg => { const g = q(svg, 'i'); const image = g.querySelector('image'); const clip = g.querySelector('clipPath');
      return image ? { x: +image.getAttribute('x'), y: +image.getAttribute('y'), w: +image.getAttribute('width'), h: +image.getAttribute('height'), par: image.getAttribute('preserveAspectRatio'),
        clip: clip && clip.firstElementChild ? { tag: clip.firstElementChild.localName, x: +clip.firstElementChild.getAttribute('x'), y: +clip.firstElementChild.getAttribute('y'), w: +clip.firstElementChild.getAttribute('width'), h: +clip.firstElementChild.getAttribute('height') } : null,
        clipAttr: image.getAttribute('clip-path'), filterAttr: image.getAttribute('filter') } : null; };
    const square = read(await one({ crop: { x: 0.25, y: 0, w: 0.5, h: 1 } }));
    const wideContain = read(await one({ crop: { x: 0, y: 0, w: 1, h: 0.5 }, fit: 'contain' }));
    const wideCover = read(await one({ crop: { x: 0, y: 0, w: 1, h: 0.5 }, fit: 'cover' }));
    const fill = read(await one({ crop: { x: 0.1, y: 0.2, w: 0.5, h: 0.4 }, fit: 'fill' }));
    const whole = read(await one({ fit: 'cover' }));
    const masks = {};
    for (const mask of ['rounded', 'circle', 'heart', 'star', 'hexagon', 'triangle']) {
      const svg = await one({ fit: 'cover', mask, radius: 4, border: { color: '#ff0000', width: 2 } });
      const g = q(svg, 'i'); const clip = g.querySelector('clipPath'); const kids = Array.from(g.children).map(c => c.localName);
      const border = Array.from(g.children).filter(c => c.localName !== 'image' && c.localName !== 'clipPath').pop();
      masks[mask] = { clip: clip.firstElementChild.localName, rx: clip.firstElementChild.getAttribute('rx'), kids: kids.join(), border: border ? [border.localName, border.getAttribute('stroke'), border.getAttribute('fill'), border.getAttribute('stroke-width')] : null };
    }
    const legacy = read(await one({ fit: 'cover', radius: 3 }));
    const filtered = await one({ fit: 'cover', filters: { brightness: 20, contrast: -30, saturation: 50, blur: 10, grayscale: true, sepia: true } });
    const image = q(filtered, 'i').querySelector('image'); const filter = q(filtered, 'i').querySelector('filter');
    const fx = Array.from(filter.children).map(c => c.localName + ':' + Array.from(c.attributes).map(a => a.name + '=' + a.value).join(' ') + (c.children.length ? '[' + Array.from(c.children).map(f => f.localName + ':' + f.getAttribute('slope') + ',' + f.getAttribute('intercept')).join(';') + ']' : ''));
    const none = await one({ fit: 'cover', filters: { brightness: 0 } });
    const frameOut = await one({ source: null, mask: 'circle' });
    const frameEd = await one({ source: null, mask: 'circle' }, 'editor');
    const frameRect = await one({ source: null }, 'editor');
    const missingEd = await one({ source: { asset: 'nope' } }, 'editor');
    const ph = svg => { const p = svg.querySelector('[data-dt-placeholder]'); return p ? { text: p.querySelector('text') ? p.querySelector('text').textContent : null, shape: p.firstElementChild.localName, dash: p.firstElementChild.getAttribute('stroke-dasharray') } : null; };
    return { square, wideContain, wideCover, fill, whole, masks, legacy, filterAttr: image.getAttribute('filter'), filterId: filter.id, fx, filterRegion: filter.getAttribute('filterUnits'), noFilter: q(none, 'i').querySelectorAll('filter').length,
      frameOut: [q(frameOut, 'i').children.length, frameOut.querySelectorAll('[data-dt-placeholder]').length], frameEd: ph(frameEd), frameRect: ph(frameRect), missingEd: ph(missingEd) };
  `);
  // photo-wide is 60 x 30 (ratio 2). crop 0.5 x 1 of it = 1:1 -> fills the 40 x 40 box; the whole image is 80 x 40, shifted by -0.25 * 80
  check('crop math: a square part (x .25, w .5) of a 2:1 image in a 40 x 40 box -> image 80 x 40 at x -20, clipped to the box',
    near(im.square.x, -20) && near(im.square.y, 0) && near(im.square.w, 80) && near(im.square.h, 40) && im.square.par === 'none' && im.square.clip.tag === 'rect' && near(im.square.clip.w, 40) && near(im.square.clip.h, 40), JSON.stringify(im.square));
  check('crop math: top half of the image (4:1) contained in the box -> 40 x 10 part centred at y 15, whole image 40 x 20, clip = the part',
    near(im.wideContain.x, 0) && near(im.wideContain.y, 15) && near(im.wideContain.w, 40) && near(im.wideContain.h, 20) && near(im.wideContain.clip.y, 15) && near(im.wideContain.clip.h, 10) && near(im.wideContain.clip.w, 40), JSON.stringify(im.wideContain));
  check('crop math: the same part covering the box -> 160 x 40 part at x -60, whole image 160 x 80, clip = the box',
    near(im.wideCover.x, -60) && near(im.wideCover.w, 160) && near(im.wideCover.h, 80) && near(im.wideCover.y, 0) && near(im.wideCover.clip.x, 0) && near(im.wideCover.clip.w, 40) && near(im.wideCover.clip.h, 40), JSON.stringify(im.wideCover));
  check('crop math: fill stretches the part to the box (x .1 y .2 w .5 h .4 -> image 80 x 100 at -8, -20)',
    near(im.fill.w, 80) && near(im.fill.h, 100) && near(im.fill.x, -8) && near(im.fill.y, -20), JSON.stringify(im.fill));
  check('no crop = the old drawing (preserveAspectRatio slice, clip to the box)', im.whole.par === 'xMidYMid slice' && near(im.whole.w, 40) && im.whole.clip.tag === 'rect', JSON.stringify(im.whole));
  check('masks: rounded = rect with rx, circle = ellipse, heart/star/hexagon/triangle = path; border drawn without fill on top',
    im.masks.rounded.clip === 'rect' && im.masks.rounded.rx === '4' && im.masks.circle.clip === 'ellipse' && ['heart', 'star', 'hexagon', 'triangle'].every(k => im.masks[k].clip === 'path') &&
    Object.values(im.masks).every(m => m.border && m.border[1] === '#ff0000' && m.border[2] === 'none' && m.border[3] === '0.7056') && im.masks.rounded.border[0] === 'rect' && im.masks.circle.border[0] === 'ellipse' && im.masks.heart.border[0] === 'path',
    JSON.stringify(im.masks.heart));
  check('schema-1 radius still rounds the corners (mask none, radius 3)', im.legacy.clip.tag === 'rect', JSON.stringify(im.legacy.clip));
  check('filters: brightness+contrast (slope 1.2 x 0.7, intercept .15), saturate 1.5, grayscale, sepia matrix, blur sigma = 10 x 40 / 200; referenced from the image; none = no <filter>',
    im.filterAttr === 'url(#' + im.filterId + ')' && im.filterRegion === 'userSpaceOnUse' && im.fx.length === 5 && im.fx[0].startsWith('feComponentTransfer') && im.fx[0].includes('feFuncR:0.84,0.15') && im.fx[0].includes('feFuncB:0.84,0.15') &&
    im.fx[1].includes('type=saturate values=1.5') && im.fx[2].includes('type=saturate values=0') && im.fx[3].includes('type=matrix') && im.fx[3].includes('0.393 0.769 0.189') && im.fx[4].includes('stdDeviation=2') && im.noFilter === 0, im.fx.join(' | '));
  check('empty frame: nothing in the output; the editor draws the dashed placeholder "Bild hierher ziehen" in the shape of the mask',
    im.frameOut.join() === '0,0' && im.frameEd.text === 'Bild hierher ziehen' && im.frameEd.shape === 'ellipse' && im.frameEd.dash && im.frameRect.shape === 'rect' && im.frameRect.text === 'Bild hierher ziehen' && im.missingEd.text === 'nope', JSON.stringify([im.frameEd, im.frameRect, im.missingEd]));


  step = 'section 18';
  // ---- 18. text: underline, strike, list, outline, background box, curve ------------------------------------------------------
  const tf = await run(`
    const stage = document.getElementById('stage');
    const opts = { fonts: testFonts };
    const mk = (props, w, h) => ({ schema: 2, unit: 'mm', width: 150, height: 100, pages: [{ elements: [Object.assign({ type: 'text', id: 't', x: 10, y: 10, w: w || 100, h: h || 40, fontFamily: 'DtTest Sans', fontSize: 20, color: '#223344', text: 'Hallo Welt' }, props)] }] });
    const mount = async doc => { const svg = await DtEngine.render(doc, {}, opts); stage.replaceChildren(svg); return svg; };
    const rects = svg => Array.from(q(svg, 't').querySelectorAll('rect')).map(r => ({ x: +r.getAttribute('x'), y: +r.getAttribute('y'), w: +r.getAttribute('width'), h: +r.getAttribute('height'), fill: r.getAttribute('fill') }));
    const ul = await mount(mk({ underline: true, strike: true }));
    const tspan = q(ul, 't').querySelector('tspan');
    const base = parseFloat(tspan.getAttribute('y'));
    const ulRects = rects(ul);
    const textLength = tspan.getComputedTextLength();
    const underOnly = await mount(mk({ underline: true, align: 'center', text: 'Eins\\nZwei' }));
    const underCentre = rects(underOnly); const underSpans = Array.from(q(underOnly, 't').querySelectorAll('tspan')).map(s => s.getComputedTextLength());
    const bullets = await mount(mk({ list: 'bullet', text: 'Eins\\nZwei\\n\\nDrei' }, 100, 60));
    const bulletSpans = Array.from(q(bullets, 't').querySelectorAll('tspan')).map(s => +s.getAttribute('x'));
    const circles = Array.from(q(bullets, 't').querySelectorAll('circle')).map(c => +c.getAttribute('cx'));
    const numbers = await mount(mk({ list: 'number', text: 'Eins\\nZwei\\nDrei' }, 100, 60));
    const numTexts = Array.from(q(numbers, 't').querySelectorAll('text')).map(t => Array.from(t.querySelectorAll('tspan')).map(s => s.textContent).join('|'));
    const listWrap = await mount(mk({ list: 'bullet', text: 'Ein langer Text, der in der schmalen Box umbrechen muss, ohne die Einrückung zu verlieren.' }, 40, 80));
    const wrapSpans = Array.from(q(listWrap, 't').querySelectorAll('tspan'));
    const outline = await mount(mk({ outline: { color: '#ffffff', width: 2 } }));
    const ot = q(outline, 't').querySelector('text');
    const bg = await mount(mk({ background: { color: '#ffd166', radius: 2, padding: 3 }, align: 'center' }));
    const bgBox = q(bg, 't').firstElementChild; const bgText = q(bg, 't').querySelector('text'); const bb = bgText.getBBox();
    const plainSvg = await mount(mk({}));
    const plainKids = Array.from(q(plainSvg, 't').children).map(c => c.localName).join();
    return {
      base, ulRects, textLength, underCentre, underSpans, bulletSpans, circles, numTexts, wrapSpans: wrapSpans.map(s => +s.getAttribute('x')), wrapWidths: wrapSpans.map(s => s.getComputedTextLength()),
      outline: ['stroke', 'stroke-width', 'paint-order', 'stroke-linejoin', 'fill'].map(a => ot.getAttribute(a)), plainStroke: plainSvg.querySelector('text').getAttribute('stroke'),
      bg: { tag: bgBox.localName, fill: bgBox.getAttribute('fill'), rx: bgBox.getAttribute('rx'), x: +bgBox.getAttribute('x'), y: +bgBox.getAttribute('y'), w: +bgBox.getAttribute('width'), h: +bgBox.getAttribute('height'), marker: bgBox.getAttribute('data-dt-text-background'),
        text: { x: bb.x, y: bb.y, w: bb.width, h: bb.height } }, plainKids,
    };
  `);
  check('underline + strike: two lines drawn as rects in the text colour, as wide as the text, underline below and strike above the baseline',
    tf.ulRects.length === 2 && tf.ulRects.every(r => r.fill === '#223344' && near(r.w, tf.textLength, tf.textLength * 0.03) && r.h > 0) && tf.ulRects[0].y > tf.base && tf.ulRects[1].y < tf.base, JSON.stringify(tf.ulRects) + ' text ' + tf.textLength.toFixed(2));
  check('underline of centred lines follows each line (x = centre - width / 2)',
    tf.underCentre.length === 2 && near(tf.underCentre[0].x + tf.underCentre[0].w / 2, 60, 0.3) && near(tf.underCentre[1].x + tf.underCentre[1].w / 2, 60, 0.3) && near(tf.underCentre[0].w, tf.underSpans[0], tf.underSpans[0] * 0.03) && near(tf.underCentre[1].w, tf.underSpans[1], tf.underSpans[1] * 0.03), JSON.stringify(tf.underCentre));
  check('bullet list: one dot per paragraph (empty paragraph none), text indented, dots left of the text',
    tf.circles.length === 3 && tf.bulletSpans.length === 3 && tf.bulletSpans.every(x => near(x, tf.bulletSpans[0], 0.001)) && tf.bulletSpans[0] > 10 + 2 && tf.circles.every(c => c < tf.bulletSpans[0]), JSON.stringify([tf.circles, tf.bulletSpans]));
  check('numbered list: markers 1. 2. 3. in front of each paragraph', tf.numTexts.length === 2 && tf.numTexts[1] === '1.|2.|3.' && tf.numTexts[0] === 'Eins|Zwei|Drei', tf.numTexts.join(' / '));
  check('list: wrapping keeps the hanging indent (every line starts at the same x, narrower than the box)', tf.wrapSpans.length >= 3 && tf.wrapSpans.every(x => near(x, tf.wrapSpans[0], 0.001)) && tf.wrapWidths.every(w => tf.wrapSpans[0] - 10 + w <= 40.01), tf.wrapWidths.map(w => w.toFixed(1)).join());
  check('outline: stroke colour, paint-order stroke (outer half only: width x 2), round joins; no stroke without outline',
    tf.outline[0] === '#ffffff' && tf.outline[1] === '1.4111' && tf.outline[2] === 'stroke' && tf.outline[3] === 'round' && tf.outline[4] === '#223344' && tf.plainStroke === null, tf.outline.join());
  check('background box: rect behind the text (first child), colour, radius, around the text block with the padding',
    tf.bg.tag === 'rect' && tf.bg.fill === '#ffd166' && tf.bg.rx === '2' && tf.bg.marker === '1' && tf.bg.x <= tf.bg.text.x - 2.5 && tf.bg.x + tf.bg.w >= tf.bg.text.x + tf.bg.text.w + 2.5 && tf.bg.y < tf.bg.text.y && tf.bg.y + tf.bg.h > tf.bg.text.y + tf.bg.text.h,
    JSON.stringify(tf.bg));
  check('a plain text still has only a <text> (no extra nodes)', tf.plainKids === 'text', tf.plainKids);

  const cv = await run(`
    const stage = document.getElementById('stage');
    const opts = { fonts: testFonts };
    const spec = { fontFamily: 'DtTest Sans', fontSize: 20, text: 'Hofladen Sonnenschein' };
    const mk = props => ({ schema: 2, unit: 'mm', width: 150, height: 100, pages: [{ elements: [Object.assign({ type: 'text', id: 't', x: 10, y: 10, w: 100, h: 40, color: '#223344' }, spec, props)] }] });
    const mount = async doc => { const svg = await DtEngine.render(doc, {}, opts); stage.replaceChildren(svg); return svg; };
    const straight = await mount(mk({}));
    const baseline = parseFloat(q(straight, 't').querySelector('tspan').getAttribute('y'));
    const length = DtEngine.layoutText(Object.assign({ wrap: false, width: 100, height: 40, unit: 'mm' }, spec)).lines[0].width;
    const read = async curve => {
      const svg = await mount(mk({ curve }));
      const g = q(svg, 't'); const path = g.querySelector('defs path'); const tp = g.querySelector('textPath'); const text = g.querySelector('text');
      const d = path.getAttribute('d');
      const arcs = Array.from(d.matchAll(/A([\\d.]+) ([\\d.]+) 0 0 (\\d) ([-\\d.]+) ([-\\d.]+)/g));
      const start = /^M([-\\d.]+) ([-\\d.]+)/.exec(d);
      const bb = text.getBBox();
      return { d, r: +arcs[0][1], sweep: arcs[0][3], mid: [+arcs[0][4], +arcs[0][5]], end: [+arcs[1][4], +arcs[1][5]], start: [+start[1], +start[2]], href: tp.getAttribute('href'), pathId: path.id, offset: tp.getAttribute('startOffset'),
        anchor: text.getAttribute('text-anchor'), content: tp.textContent, tspans: g.querySelectorAll('tspan').length, bb: { x: bb.x, y: bb.y, w: bb.width, h: bb.height }, computed: tp.getComputedTextLength() };
    };
    const up = await read(40); const down = await read(-40); const full = await read(100); const tiny = await read(0.5);
    const multi = await mount(mk({ curve: 30, text: 'Zwei\\nZeilen' }));
    return { baseline, length, up, down, full, tiny, multiText: q(multi, 't').querySelector('textPath').textContent, zero: q(straight, 't').querySelectorAll('textPath').length };
  `);
  const phiOf = c => Math.abs(c) * 3.6 * Math.PI / 180;
  check('curve: text on a textPath of a circle arc (single line, centred, startOffset 50%), straight text for curve 0',
    cv.up.href === '#' + cv.up.pathId && cv.up.offset === '50%' && cv.up.anchor === 'middle' && cv.up.tspans === 0 && cv.up.content === 'Hofladen Sonnenschein' && cv.zero === 0 && cv.up.d.startsWith('M'), cv.up.d);
  check('curve: the radius follows the text length and the amount (R = L / angle; 100 = full circle R = L / 2π)',
    near(cv.up.r / (cv.length / phiOf(40)), 1, 0.005) && near(cv.down.r / (cv.length / phiOf(-40)), 1, 0.005) && near(cv.full.r / (cv.length / (2 * Math.PI)), 1, 0.005) && near(cv.tiny.r / (cv.length / phiOf(0.5)), 1, 0.005),
    [cv.up.r, cv.down.r, cv.full.r, cv.length].map(n => n.toFixed(2)).join());
  check('curve: positive = arc above (clockwise sweep, apex baseline at the straight baseline), negative = below (counter-clockwise)',
    cv.up.sweep === '1' && cv.down.sweep === '0' && near(cv.up.mid[0], 60, 0.01) && near(cv.up.mid[1], cv.baseline, 0.02) && cv.up.start[1] > cv.up.mid[1] && cv.down.start[1] < cv.down.mid[1] && near(cv.down.mid[0], 60, 0.01),
    JSON.stringify([cv.up.mid, cv.up.start, cv.down.mid, cv.down.start, cv.baseline]));
  check('curve: the drawn text is as long as the arc and centred on the box (DOM measured)', near(cv.up.computed, cv.length, cv.length * 0.03) && near(cv.up.bb.x + cv.up.bb.w / 2, 60, 1.5) && near(cv.full.computed, cv.length, cv.length * 0.03), cv.up.computed.toFixed(2) + ' vs ' + cv.length.toFixed(2));
  check('curve: a full circle closes (start = end point), line breaks become spaces', near(cv.full.start[0], cv.full.end[0], 0.01) && near(cv.full.start[1], cv.full.end[1], 0.01) && cv.multiText === 'Zwei Zeilen', JSON.stringify([cv.full.start, cv.full.end, cv.multiText]));

  step = 'section 19';
  // ---- 19. shapes, line caps, gradients, shadows, unique ids ---------------------------------------------------------------
  const shp = await run(`
    const stage = document.getElementById('stage');
    const bbox = {};
    for (const kind of ['rect', 'ellipse', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'heart', 'arrow', 'speech']) {
      const d = { schema: 2, unit: 'mm', width: 60, height: 40, pages: [{ elements: [{ type: 'shape', id: 's', shape: kind, x: 5, y: 7, w: 40, h: 22, fill: '#336699', stroke: null, points: 7, innerRadius: 0.4 }] }] };
      const svg = await DtEngine.render(d, {}, {}); stage.replaceChildren(svg);
      const node = q(svg, 's').firstElementChild; const b = node.getBBox();
      bbox[kind] = { tag: node.localName, x: b.x, y: b.y, w: b.width, h: b.height, fill: node.getAttribute('fill') };
    }
    const star5 = await DtEngine.render({ schema: 2, unit: 'mm', width: 60, height: 40, pages: [{ elements: [{ type: 'shape', id: 's', shape: 'star', x: 0, y: 0, w: 40, h: 40 }, { type: 'shape', id: 'u', shape: 'star', x: 0, y: 0, w: 40, h: 40, points: 8 }] }] }, {}, {});
    const count = id => (q(star5, id).firstElementChild.getAttribute('d').match(/L/g) || []).length + 1;
    const lines = await DtEngine.render({ schema: 2, unit: 'mm', width: 60, height: 40, pages: [{ elements: [
      { type: 'shape', id: 'l1', shape: 'line', x: 5, y: 5, w: 40, h: 0, stroke: '#112233', strokeWidth: 2, startCap: 'circle', endCap: 'arrow' },
      { type: 'shape', id: 'l2', shape: 'line', x: 5, y: 15, w: 30, h: 20, stroke: '#112233', strokeWidth: 2, startCap: 'square' },
      { type: 'shape', id: 'l3', shape: 'line', x: 5, y: 25, w: 40, h: 0, stroke: '#112233', strokeWidth: 2 }] }] }, {}, {});
    const info = id => { const g = q(lines, id); const l = g.querySelector('line'); return { x1: +l.getAttribute('x1'), x2: +l.getAttribute('x2'), paths: Array.from(g.querySelectorAll('path')).map(p => [p.getAttribute('d'), p.getAttribute('fill'), p.getAttribute('stroke')]) }; };
    const anyMarker = Array.from(lines.querySelectorAll('*')).some(e => e.localName === 'marker' || e.hasAttribute('marker-end') || e.hasAttribute('marker-start'));
    const grad = { type: 'linear', angle: 90, stops: [{ offset: 0, color: '#ff0000' }, { offset: 0.5, color: '#00ff00' }, { offset: 1, color: '#0000ff' }] };
    const gradDoc = angle => ({ schema: 2, unit: 'mm', width: 60, height: 40, pages: [{ background: { color: '#ffffff', gradient: Object.assign({}, grad, { angle }) }, elements: [{ type: 'shape', id: 's', shape: 'rect', x: 5, y: 5, w: 40, h: 20, fill: Object.assign({}, grad, { angle }) }] }] });
    const gradInfo = async angle => { const svg = await DtEngine.render(gradDoc(angle), {}, {}); const g = q(svg, 's'); const lg = g.querySelector('linearGradient');
      const bgRects = Array.from(svg.querySelectorAll('rect[data-dt-background]')).map(r => r.getAttribute('fill')); const bgGrad = svg.querySelector(':scope > linearGradient');
      return { fill: g.querySelector('rect').getAttribute('fill'), id: lg.id, units: lg.getAttribute('gradientUnits'), xy: ['x1', 'y1', 'x2', 'y2'].map(a => +lg.getAttribute(a)), stops: Array.from(lg.children).map(s => s.getAttribute('offset') + ':' + s.getAttribute('stop-color')).join(), bgRects, bgGradId: bgGrad ? bgGrad.id : null, bgXy: bgGrad ? ['x1', 'y1', 'x2', 'y2'].map(a => +bgGrad.getAttribute(a)) : null }; };
    const g90 = await gradInfo(90); const g180 = await gradInfo(180); const g0 = await gradInfo(0); const g45 = await gradInfo(45);
    return { bbox, star5: count('s'), star8: count('u'), l1: info('l1'), l2: info('l2'), l3: info('l3'), anyMarker, g90, g180, g0, g45 };
  `);
  const boxOk = b => near(b.x, 5) && near(b.y, 7) && near(b.w, 40) && near(b.h, 22);
  check('shapes: every kind fills its box exactly (bounding box = x 5, y 7, 40 x 22) as rect / ellipse / path',
    Object.entries(shp.bbox).every(([kind, b]) => boxOk(b) && b.fill === '#336699') && shp.bbox.rect.tag === 'rect' && shp.bbox.ellipse.tag === 'ellipse' && ['triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'heart', 'arrow', 'speech'].every(k => shp.bbox[k].tag === 'path'),
    Object.entries(shp.bbox).filter(([k, b]) => !boxOk(b)).map(([k, b]) => k + ':' + JSON.stringify(b)).join(' '));
  check('star: 5 points = 10 vertices by default, "points" sets the count (8 -> 16)', shp.star5 === 10 && shp.star8 === 16, shp.star5 + ' / ' + shp.star8);
  check('line caps are drawn as filled paths (no markers): arrow head at the end tip, dot at the start; the stroke stops at the arrow base; no caps = plain line',
    shp.l1.paths.length === 2 && shp.l1.paths.every(p => p[1] === '#112233' && p[2] === 'none') && shp.l1.paths.some(p => p[0].startsWith('M45 5L')) && shp.l1.x2 < 45 && near(shp.l1.x1, 5) && shp.l2.paths.length === 1 && shp.l3.paths.length === 0 && near(shp.l3.x2, 45) && !shp.anyMarker,
    JSON.stringify(shp.l1));
  check('gradient fill: url(#id) to a linearGradient in user space with the stops; CSS angles (90 = to the right, 180 = down, 0 = up)',
    /^url\(#.+\)$/.test(shp.g90.fill) && shp.g90.fill === 'url(#' + shp.g90.id + ')' && shp.g90.units === 'userSpaceOnUse' && shp.g90.stops === '0:#ff0000,0.5:#00ff00,1:#0000ff' &&
    near(shp.g90.xy[0], 5, 0.01) && near(shp.g90.xy[2], 45, 0.01) && near(shp.g90.xy[1], 15, 0.01) && near(shp.g90.xy[3], 15, 0.01) &&
    near(shp.g180.xy[1], 5, 0.01) && near(shp.g180.xy[3], 25, 0.01) && near(shp.g180.xy[0], 25, 0.01) && near(shp.g0.xy[1], 25, 0.01) && near(shp.g0.xy[3], 5, 0.01) &&
    shp.g45.xy[2] > shp.g45.xy[0] && shp.g45.xy[3] < shp.g45.xy[1], JSON.stringify([shp.g90.xy, shp.g180.xy, shp.g0.xy, shp.g45.xy]));
  check('page background: colour rect, then a gradient rect over the whole page (60 x 40, angle 90: x 0 -> 60)',
    shp.g90.bgRects.length === 2 && shp.g90.bgRects[0] === '#ffffff' && shp.g90.bgRects[1] === 'url(#' + shp.g90.bgGradId + ')' && near(shp.g90.bgXy[0], 0, 0.01) && near(shp.g90.bgXy[2], 60, 0.01), JSON.stringify([shp.g90.bgRects, shp.g90.bgXy]));

  const uid = await run(`
    const stage = document.getElementById('stage');
    const grad = { type: 'linear', angle: 30, stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }] };
    const d = { schema: 2, unit: 'mm', width: 100, height: 60, pages: [{ background: { gradient: grad }, elements: [
      { type: 'shape', id: 's', shape: 'heart', x: 5, y: 5, w: 20, h: 20, fill: grad, shadow: { color: '#000000', opacity: 0.3, blur: 2, x: 1, y: 1 } },
      { type: 'image', id: 'i', x: 30, y: 5, w: 20, h: 20, source: { asset: 'photo-art' }, fit: 'cover', mask: 'circle', border: { color: '#fff', width: 1 }, filters: { sepia: true, blur: 2 }, shadow: { color: '#000000', opacity: 0.3, blur: 2, x: 1, y: 1 } },
      { type: 'text', id: 't', x: 5, y: 30, w: 80, h: 20, text: 'Kurve', fontSize: 14, curve: 30, fontFamily: 'DtTest Sans' },
      { type: 'group', id: 'g', x: 5, y: 5, w: 40, h: 20, shadow: { color: '#000000', opacity: 0.3, blur: 2, x: 1, y: 1 }, children: [{ type: 'shape', id: 'gs', shape: 'star', x: 6, y: 6, w: 10, h: 10, fill: grad }] }] }] };
    const a = await DtEngine.render(d, {}, { assetUrl, fonts: testFonts });
    const b = await DtEngine.render(d, {}, { assetUrl, fonts: testFonts });
    const c = await DtEngine.render(d, {}, { assetUrl, fonts: testFonts, idPrefix: 'p 1' });
    stage.replaceChildren(a, b, c);
    const ids = svg => Array.from(svg.querySelectorAll('[id]')).map(e => e.id);
    const all = [a, b, c].flatMap(ids);
    const dangling = svg => { const known = new Set(ids(svg)); const refs = [];
      for (const e of svg.querySelectorAll('*')) for (const attr of ['fill', 'stroke', 'filter', 'clip-path', 'mask']) { const v = e.getAttribute(attr); const m = v && /^url\\(#(.+)\\)$/.exec(v); if (m) refs.push(m[1]); }
      for (const e of svg.querySelectorAll('textPath')) refs.push(e.getAttribute('href').slice(1));
      return { refs: refs.length, missing: refs.filter(r => !known.has(r)) }; };
    const kinds = new Set(ids(a).map(i => i.replace(/^dt\\d+-/, '').replace(/\\d+$/, '')));
    return { count: all.length, unique: new Set(all).size === all.length, perRender: ids(a).length, kinds: Array.from(kinds).sort().join(), prefixed: ids(c).every(i => i.startsWith('p_1-')), dangling: [a, b, c].map(dangling) };
  `);
  check('gradient, shadow, filter, clip and path ids are unique across renders on one page (default counter and idPrefix)', uid.unique && uid.perRender >= 8 && uid.prefixed && uid.kinds === 'c,f,g,p', uid.count + ' ids, kinds ' + uid.kinds);
  check('every url(#id) / textPath reference resolves inside its own svg', uid.dangling.every(x => x.refs >= 8 && x.missing.length === 0), JSON.stringify(uid.dangling));


  step = 'section 20';
  tolerateParserErrorStyle = true;
  // ---- 20. icons: opts.icon, strict allowlist, unknown icons --------------------------------------------------------------------
  const ic = await run(`
    const doc = items => ({ schema: 2, unit: 'mm', width: 100, height: 60, pages: [{ elements: items }] });
    const icon = (id, name, props) => Object.assign({ type: 'icon', id, icon: name, x: 5, y: 5, w: 20, h: 20, color: '#cc0000', strokeWidth: 1.5 }, props);
    const warnings = [];
    const render = (items, mode, iconFunction) => DtEngine.render(doc(items), {}, { icon: iconFunction, mode: mode || 'output', onWarning: (m, id) => warnings.push(m + '@' + id) });
    const describe = g => { const inner = g.firstElementChild; return inner ? { transform: inner.getAttribute('transform'), attrs: ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin'].map(a => inner.getAttribute(a)).join(),
      children: Array.from(inner.children).map(c => c.localName + '(' + Array.from(c.attributes).map(a => a.name).sort().join(',') + ')').join(' '), firstD: inner.firstElementChild && inner.firstElementChild.getAttribute('d') } : null; };
    const heart = describe(q(await render([icon('h', 'heart')], 'output', iconFn), 'h'));
    const later = describe(q(await render([icon('h', 'heart')], 'output', iconFnAsync), 'h'));
    const wide = describe(q(await render([icon('h', 'mail', { w: 30, h: 12 })], 'output', iconFn), 'h'));
    const tiny = describe(q(await render([icon('h', 'mail', { w: 0.9, h: 0.9 })], 'output', iconFn), 'h'));
    const evilSvg = await render([icon('e', 'evil')], 'output', iconFn);
    const eg = q(evilSvg, 'e');
    const evil = describe(eg); const evilText = new XMLSerializer().serializeToString(eg);
    const evilNames = Array.from(eg.querySelectorAll('*')).map(e => e.localName);
    warnings.length = 0;
    const gone = {};
    const prefixed = describe(q(await render([icon('p', 'evil-prefix')], 'output', iconFn), 'p'));
    for (const name of ['broken', 'no-such-icon']) {
      const out = await render([icon('u', name)], 'output', iconFn);
      const ed = await render([icon('u', name)], 'editor', iconFn);
      gone[name] = { out: q(out, 'u').children.length, ph: ed.querySelector('[data-dt-placeholder] text') ? ed.querySelector('[data-dt-placeholder] text').textContent : null };
    }
    const thrower = await render([icon('u', 'heart')], 'output', () => { throw new Error('boom'); });
    const noFn = await render([icon('u', 'heart')], 'editor', null);
    const badName = await render([icon('u', 'Bad Name!')], 'editor', iconFn);
    return { prefixed, heart, later, wide, tiny, evil, evilText, evilNames, gone, thrower: q(thrower, 'u').children.length, noFn: noFn.querySelector('[data-dt-placeholder] text').textContent, badName: badName.querySelector('[data-dt-placeholder] text').textContent, warnings };
  `);
  check('icon: 24 x 24 grid scaled into the box (20 mm -> 0.833333), stroke = colour, width as given, round caps and joins, fill none, body re-created',
    ic.heart.transform === 'translate(5 5) scale(0.833333)' && ic.heart.attrs === 'none,#cc0000,1.5,round,round' && ic.heart.children === 'path(d)' && ic.heart.firstD === ICONS.heart.match(/ d="([^"]+)"/)[1], JSON.stringify(ic.heart));
  check('icon: opts.icon may return a Promise; a wide box is contained and centred (30 x 12 -> scale 0.5, x 14)', JSON.stringify(ic.later) === JSON.stringify(ic.heart) && ic.wide.transform === 'translate(14 5) scale(0.5)' && ic.wide.children === 'rect(height,rx,width,x,y) path(d)', ic.wide.transform + ' ' + ic.wide.children);
  check('icon: tiny icons keep their scale precision (0.9 mm -> 0.0375)', ic.tiny.transform === 'translate(5 5) scale(0.0375)', ic.tiny.transform);
  check('icon allowlist: a hostile body keeps only path(d), circle(cx cy r), rect(x y width height), line, polygon(points)',
    ic.evil.children === 'path(d) circle(cx,cy,r) rect(height,width,x,y) line(x1,x2,y1,y2) polygon(points)' && ic.evil.firstD === 'M2 2L20 20' && ic.evilNames.join() === 'g,path,circle,rect,line,polygon', ic.evil.children + ' | ' + ic.evilNames.join());
  check('icon allowlist: no script, foreignObject, use, image, text, a, nested g, no on* / href / style / class / fill attributes, no javascript: or external URL in the output',
    !/script|foreignObject|<use|<image|<text|<a[ >]|onload|onclick|onfocus|onmouseover|href|style=|class=|javascript|evil|alert/i.test(ic.evilText.replace(/ data-el-id="e"/, '')), ic.evilText.slice(0, 300));
  check('unknown icons (not well-formed body, unknown name, throwing/missing opts.icon, invalid name): nothing in the output, placeholder with the name in the editor',
    Object.values(ic.gone).every(g => g.out === 0) && ic.gone.broken.ph === 'broken' && ic.gone['no-such-icon'].ph === 'no-such-icon' && ic.thrower === 0 && ic.noFn === 'heart' && ic.badName === 'Icon', JSON.stringify(ic.gone));
  check('unknown icons are reported through onWarning', ic.warnings.includes('Icon "broken" nicht gefunden@u') && ic.warnings.includes('Icon "no-such-icon" nicht gefunden@u'), ic.warnings.join(' | '));
  check('icon: attributes outside the allowlist (xlink:href with an undeclared prefix) are removed before parsing, the geometry survives', ic.prefixed && ic.prefixed.children === 'path(d)' && ic.prefixed.firstD === 'M1 1L5 5', JSON.stringify(ic.prefixed));

  await page.waitForTimeout(100);
  tolerateParserErrorStyle = false;
  step = 'section 21';
  // ---- 21. onWarning: unknown placeholders, missing assets, invalid codes ------------------------------------------------------
  const wn = await run(`
    const d = { schema: 2, unit: 'mm', width: 100, height: 60, fields: [{ key: 'Name', type: 'text', sample: 'Anna' }, { key: 'Foto', type: 'image', sample: 'gone' }, { key: 'Leer', type: 'image', sample: '' }], pages: [{ elements: [
      { type: 'text', id: 't', x: 0, y: 0, w: 50, h: 10, text: '{{Nope}} {{Name}} {{nope}}', fontFamily: 'DtTest Sans' },
      { type: 'image', id: 'i1', x: 0, y: 0, w: 5, h: 5, source: { asset: 'zzz' } }, { type: 'image', id: 'i2', x: 0, y: 0, w: 5, h: 5, source: { field: 'Foto' } }, { type: 'image', id: 'i3', x: 0, y: 0, w: 5, h: 5, source: { field: 'Leer' } },
      { type: 'imageStrip', id: 'st', x: 0, y: 0, w: 50, h: 5, items: [{ asset: 'strip-missing' }, { asset: 'photo-wide' }] },
      { type: 'icon', id: 'ic', icon: 'no-such-icon', x: 0, y: 0, w: 5, h: 5 },
      { type: 'qr', id: 'q1', x: 0, y: 0, w: 20, h: 20, value: '' }, { type: 'qr', id: 'q2', x: 0, y: 0, w: 20, h: 20, value: '{{Name}} {{Missing}}' },
      { type: 'barcode', id: 'b1', x: 0, y: 0, w: 40, h: 20, format: 'ean13', value: '123' }, { type: 'barcode', id: 'b2', x: 0, y: 0, w: 40, h: 20, format: 'ean13', value: '4006381333931' }] }] };
    const warnings = [];
    await DtEngine.render(d, null, { assetUrl, fonts: testFonts, icon: iconFn, onWarning: (m, id) => warnings.push(m + '@' + id) });
    const again = [];
    await DtEngine.render(d, null, { assetUrl, fonts: testFonts, onWarning: () => { throw new Error('a broken callback must not break the render'); } }).then(() => again.push('ok'), e => again.push('failed ' + e.message));
    return { warnings, again };
  `);
  const wanted = ['Unbekannter Platzhalter {{Nope}}@t', 'Unbekannter Platzhalter {{nope}}@t', 'Medium "zzz" nicht gefunden@i1', 'Medium "gone" nicht gefunden@i2', 'Medium "strip-missing" nicht gefunden@st',
    'Icon "no-such-icon" nicht gefunden@ic', 'QR-Code: Inhalt fehlt@q1', 'Unbekannter Platzhalter {{Missing}}@q2', 'EAN-13 braucht 12 oder 13 Ziffern@b1'];
  check('onWarning: unknown placeholders (text and qr), missing assets (image, field value, strip), unknown icon, invalid codes - each once with the element id',
    wanted.every(w => wn.warnings.includes(w)) && wn.warnings.length === wanted.length && wn.again[0] === 'ok', wn.warnings.join(' | '));

  step = 'section 22';
  // ---- 22. QR code: encoder checked by a decoder written in this test ---------------------------------------------------------
  const longUrl = 'https://example.com/produkt?id=' + 'abcdefghij0123456789'.repeat(14).slice(0, 269);
  const rng = (() => { let s = 12345; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s; }; })();
  const noise = n => Array.from({ length: n }, () => String.fromCharCode(33 + (rng() % 90))).join('');
  const qrCases = [
    { text: 'HELLO', ecc: 'M' }, { text: 'https://designthix.example/p/4711', ecc: 'Q' }, { text: 'Käse Größe 4,99 € – Ñandú ß', ecc: 'H' }, { text: 'Z'.repeat(120), ecc: 'L' },
    { text: '🧀 Käsetheke "Süd" & <Nord>', ecc: 'M' }, { text: longUrl, ecc: 'L' }, { text: longUrl, ecc: 'M' }, { text: longUrl, ecc: 'H' }, { text: noise(700), ecc: 'H' },
    { text: noise(1000), ecc: 'L' }, { text: 'a', ecc: 'L' }, { text: noise(1000), ecc: 'H' },
  ];
  check('test data: a 300-character URL', longUrl.length === 300, String(longUrl.length));
  const qrRun = await run(`
    const out = [];
    for (const c of arg.cases) {
      const d = { schema: 2, unit: 'mm', width: 80, height: 80, pages: [{ elements: [{ type: 'qr', id: 'q', x: 5, y: 5, w: 70, h: 60, value: c.text, ecc: c.ecc, color: '#102030', background: '#fefefe', quiet: true }] }] };
      const svg = await DtEngine.render(d, {}, {});
      const g = q(svg, 'q'); const path = g.querySelector('path');
      const noQuiet = await DtEngine.render(Object.assign({}, d, { pages: [{ elements: [Object.assign({}, d.pages[0].elements[0], { quiet: false, background: null })] }] }), {}, {});
      const p2 = q(noQuiet, 'q').querySelector('path');
      const info = DtEngine.qrEncode(c.text, c.ecc);
      out.push({ d: path.getAttribute('d'), transform: path.getAttribute('transform'), fill: path.getAttribute('fill'), kids: Array.from(g.children).map(x => x.localName + ':' + (x.getAttribute('fill') || '')).join(),
        d2: p2.getAttribute('d'), transform2: p2.getAttribute('transform'), kids2: Array.from(q(noQuiet, 'q').children).map(x => x.localName).join(), version: info.version, mask: info.mask, ecc: info.ecc, size: info.size });
    }
    const caps = [[1, 'L', 17], [1, 'M', 14], [1, 'Q', 11], [1, 'H', 7], [2, 'L', 32], [2, 'M', 26], [2, 'Q', 20], [2, 'H', 14], [5, 'L', 106], [5, 'M', 84], [5, 'Q', 60], [5, 'H', 44],
      [10, 'L', 271], [10, 'M', 213], [10, 'Q', 151], [10, 'H', 119], [20, 'L', 858], [20, 'M', 666], [20, 'Q', 482], [20, 'H', 382], [30, 'L', 1732], [30, 'M', 1370], [30, 'Q', 982], [30, 'H', 742],
      [40, 'L', 2953], [40, 'M', 2331], [40, 'Q', 1663], [40, 'H', 1273]];
    const capacity = caps.map(([v, level, n]) => { const fits = DtEngine.qrEncode('a'.repeat(n), level); const over = DtEngine.qrEncode('a'.repeat(n + 1), level);
      return { v, level, n, fitsVersion: fits.ok ? fits.version : -1, overVersion: over.ok ? over.version : (over.reason || 'fail') }; });
    const direct = [['L', 2953], ['M', 2331], ['Q', 1663], ['H', 1273]].map(([level, n]) => { const text = arg.noise.slice(0, n); const r = DtEngine.qrEncode(text, level); return { level, text, version: r.version, size: r.size, rows: r.modules.map(row => Array.from(row)) }; });
    const tooLong = DtEngine.qrEncode('€'.repeat(1000), 'H'); const empty = DtEngine.qrEncode('', 'M');
    const def = DtEngine.qrEncode('abc'); const lower = DtEngine.qrEncode('abc', 'x');
    const ed = await DtEngine.render({ schema: 2, unit: 'mm', width: 80, height: 80, pages: [{ elements: [{ type: 'qr', id: 'q', x: 5, y: 5, w: 70, h: 60, value: '€'.repeat(1000), ecc: 'H' }, { type: 'qr', id: 'q2', x: 5, y: 5, w: 70, h: 60, value: '' }] }] }, {}, { mode: 'editor' });
    const outp = await DtEngine.render({ schema: 2, unit: 'mm', width: 80, height: 80, pages: [{ elements: [{ type: 'qr', id: 'q', x: 5, y: 5, w: 70, h: 60, value: '€'.repeat(1000), ecc: 'H' }] }] }, {}, {});
    const withField = await DtEngine.render({ schema: 2, unit: 'mm', width: 80, height: 80, fields: [{ key: 'Url', type: 'text', sample: 'https://sample.example' }], pages: [{ elements: [{ type: 'qr', id: 'q', x: 0, y: 0, w: 40, h: 40, value: '{{Url}}/x' }] }] }, { Url: 'https://other.example' }, {});
    const withD = q(withField, 'q').querySelector('path').getAttribute('d');
    const plain = await DtEngine.render({ schema: 2, unit: 'mm', width: 80, height: 80, pages: [{ elements: [{ type: 'qr', id: 'q', x: 0, y: 0, w: 40, h: 40, value: 'https://other.example/x' }] }] }, {}, {});
    return { out, capacity, direct, tooLong: tooLong.ok === false && tooLong.reason, empty: empty.ok === false && empty.reason, defLevel: def.ecc, lowerLevel: lower.ecc,
      editorText: Array.from(ed.querySelectorAll('[data-dt-placeholder] text')).map(t => t.textContent), outputKids: q(outp, 'q').children.length, fieldSame: withD === q(plain, 'q').querySelector('path').getAttribute('d') };
  `, { cases: qrCases, noise: noise(2953) });
  const finderOk = m => {
    const size = m.length;
    const at = (x, y) => m[y][x];
    const finder = (ox, oy) => { for (let dy = 0; dy < 7; dy++) for (let dx = 0; dx < 7; dx++) { const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3)); if (at(ox + dx, oy + dy) !== (ring === 2 ? 0 : 1)) return false; } return true; };
    let timing = true;
    for (let i = 8; i < size - 8; i++) if (at(i, 6) !== (i % 2 === 0 ? 1 : 0) || at(6, i) !== (i % 2 === 0 ? 1 : 0)) timing = false;
    return finder(0, 0) && finder(size - 7, 0) && finder(0, size - 7) && timing && at(8, size - 8) === 1;
  };
  qrRun.out.forEach((o, i) => {
    const c = qrCases[i];
    const box = { w: 70, h: 60 };
    let decoded = null; let error = null; let decoded2 = null;
    try {
      const m = matrixFromQrPath(o.d, o.transform, box, 4);
      const m2 = matrixFromQrPath(o.d2, o.transform2, box, 0);
      decoded = Object.assign(qrDecode(m), { structure: finderOk(m), size: m.length });
      decoded2 = qrDecode(m2);
    } catch (e) { error = e.message; }
    check('QR round trip ' + (i + 1) + ': ' + c.text.length + ' chars, ecc ' + c.ecc + (c.text.length > 40 ? '' : ' "' + c.text + '"'),
      decoded && decoded.text === c.text && decoded.level === c.ecc && decoded.mode === 4 && decoded.eccOk && decoded.structure && decoded.version === o.version && decoded.mask === o.mask && decoded.size === o.size &&
      decoded2 && decoded2.text === c.text && o.fill === '#102030' && o.kids === 'rect:#fefefe,path:#102030' && o.kids2 === 'path',
      error || (decoded ? 'v' + decoded.version + ' mask ' + decoded.mask + ' ' + decoded.codewords + ' codewords' : ''));
  });
  qrRun.direct.forEach(c => {
    let decoded = null; let error = null;
    try { decoded = qrDecode(c.rows); } catch (e) { error = e.message; }
    check('QR round trip, version 40 at ecc ' + c.level + ' (' + c.text.length + ' bytes, Reed-Solomon codewords checked)', decoded && decoded.version === 40 && c.version === 40 && decoded.text === c.text && decoded.level === c.level && decoded.eccOk && decoded.mode === 4,
      error || (decoded ? 'v' + decoded.version + ' mask ' + decoded.mask : ''));
  });
  check('QR: byte capacities of the standard (versions 1, 2, 5, 10, 20, 30, 40 at L/M/Q/H): the data fits exactly, one more byte needs the next version',
    qrRun.capacity.every(c => c.fitsVersion === c.v && (c.v === 40 ? typeof c.overVersion === 'string' : c.overVersion === c.v + 1)), qrRun.capacity.filter(c => !(c.fitsVersion === c.v)).map(c => JSON.stringify(c)).join());
  check('QR: more than version 40 holds / empty value -> reason; default level M; wrong level -> M', qrRun.tooLong === 'QR-Code: Inhalt ist zu lang' && qrRun.empty === 'QR-Code: Inhalt fehlt' && qrRun.defLevel === 'M' && qrRun.lowerLevel === 'M', String(qrRun.tooLong));
  check('QR: invalid value = editor placeholder with the reason, nothing in the output', qrRun.editorText.join('|') === 'QR-Code: Inhalt ist zu lang|QR-Code: Inhalt fehlt' && qrRun.outputKids === 0, qrRun.editorText.join('|'));
  check('QR: {{Field}} in the value is replaced with the values of the render', qrRun.fieldSame, '');
  check('QR: the encoder uses several masks across the test inputs (penalty selection at work)', new Set(qrRun.out.map(o => o.mask)).size >= 3, Array.from(new Set(qrRun.out.map(o => o.mask))).join());


  step = 'section 23';
  // ---- 23. barcodes: EAN-13, EAN-8, Code 128 --------------------------------------------------------------------------------------
  const bcCases = [
    { id: 'a', format: 'ean13', value: '4006381333931', showText: true, expect: '4006381333931' },
    { id: 'b', format: 'ean13', value: '400638133393', showText: false, expect: '4006381333931' },
    { id: 'c', format: 'ean13', value: '5901234123457', showText: true, expect: '5901234123457' },
    { id: 'd', format: 'ean13', value: '4 0 1 2 3 4 5 6 7 8 9 0 1', showText: true, expect: '4012345678901' },
    { id: 'e', format: 'ean8', value: '96385074', showText: true, expect: '96385074' },
    { id: 'f', format: 'ean8', value: '9638507', showText: false, expect: '96385074' },
    { id: 'g', format: 'code128', value: 'PJJ123C', showText: true, expect: 'PJJ123C' },
    { id: 'h', format: 'code128', value: 'AB12345678CD', showText: false, expect: 'AB12345678CD' },
    { id: 'i', format: 'code128', value: '12345678', showText: true, expect: '12345678' },
    { id: 'j', format: 'code128', value: 'ab1234c  ~', showText: true, expect: 'ab1234c  ~' },
  ];
  const bc = await run(`
    const out = {};
    for (const c of arg.cases) {
      const w = c.format === 'code128' ? 100 : 60;
      const d = { schema: 2, unit: 'mm', width: 120, height: 60, pages: [{ elements: [{ type: 'barcode', id: 'b', format: c.format, value: c.value, x: 5, y: 5, w, h: 40, showText: c.showText, color: '#102030', background: '#fefefe', fontFamily: 'DtTest Sans' }] }] };
      const svg = await DtEngine.render(d, {}, { fonts: testFonts });
      const g = q(svg, 'b'); const path = g.querySelector('path');
      out[c.id] = { d: path.getAttribute('d'), transform: path.getAttribute('transform'), fill: path.getAttribute('fill'), kids: Array.from(g.children).map(x => x.localName).join(),
        texts: Array.from(g.querySelectorAll('text')).map(t => ({ x: (t.getAttribute('x') || '').split(' ').map(Number), content: t.textContent, size: +t.getAttribute('font-size'), family: t.getAttribute('font-family'), anchor: t.getAttribute('text-anchor') })),
        info: (i => ({ ok: i.ok, text: i.text, bars: i.bars.length, values: i.values || null, checksum: i.checksum === undefined ? null : i.checksum, guards: i.guards }))(DtEngine.barcodeInfo(c.format, c.value)) };
    }
    const bad = [['ean13', '4006381333932'], ['ean13', '123'], ['ean13', '40063813339ab'], ['ean13', ''], ['ean8', '1234'], ['ean8', '96385075'], ['code128', ''], ['code128', 'Käse'], ['code128', 'tab\\there']];
    const reasons = bad.map(([f, v]) => DtEngine.barcodeInfo(f, v));
    const warnings = [];
    const doc = items => ({ schema: 2, unit: 'mm', width: 120, height: 60, pages: [{ elements: items }] });
    const items = [{ type: 'barcode', id: 'x1', format: 'ean13', value: '4006381333932', x: 5, y: 5, w: 60, h: 30 }, { type: 'barcode', id: 'x2', format: 'code128', value: 'Käse', x: 5, y: 5, w: 60, h: 30 }, { type: 'barcode', id: 'x3', format: 'ean8', value: '1234', x: 5, y: 5, w: 60, h: 30, showText: false }];
    const outp = await DtEngine.render(doc(items), {}, { onWarning: (m, id) => warnings.push(m + '@' + id) });
    const ed = await DtEngine.render(doc(items), {}, { mode: 'editor' });
    const noBg = await DtEngine.render(doc([{ type: 'barcode', id: 'n', format: 'ean13', value: '400638133393', x: 5, y: 5, w: 60, h: 30, background: null }]), {}, {});
    return { out, reasons: reasons.map(r => r.ok ? 'ok' : r.reason), warnings, outputKids: items.map(i => q(outp, i.id).children.length), editor: items.map(i => { const p = q(ed, i.id).querySelector('[data-dt-placeholder] text'); return p && p.textContent; }), noBgKids: Array.from(q(noBg, 'n').children).map(x => x.localName).join() };
  `, { cases: bcCases });
  const quietOf = { ean13: 11, ean8: 7, code128: 10 };
  const code128Text = values => {
    let set = values[0] === 105 ? 'C' : 'B';
    let text = '';
    for (const v of values.slice(1)) {
      if (v === 99) set = 'C'; else if (v === 100) set = 'B'; else if (set === 'C') text += String(v).padStart(2, '0'); else text += String.fromCharCode(v + 32);
    }
    return text;
  };
  for (const c of bcCases) {
    const o = bc.out[c.id];
    const { bars, heights } = barsFromPath(o.d, quietOf[c.format], o.info.bars);
    let ok; let detail;
    if (c.format === 'code128') {
      const read = code128Read(bars);
      const expectedSum = (read.values[0] + read.values.slice(1, -1).reduce((s, v, i) => s + (i + 1) * v, 0)) % 103;
      ok = read.stop && read.values.slice(0, -1).join() === o.info.values.join() && read.values[read.values.length - 1] === o.info.checksum && expectedSum === o.info.checksum &&
        code128Text(read.values.slice(0, -1)) === c.expect && o.texts.length === (c.showText ? 1 : 0) && (!c.showText || o.texts[0].content === c.value) && heights.length === 1;
      detail = read.values.join() + ' stop ' + read.stop;
    } else {
      const digits = eanDecode(bars);
      ok = digits === c.expect && o.info.text === c.expect && heights.length === (c.showText ? 2 : 1) && o.texts.length === (c.showText ? (c.format === 'ean13' ? 3 : 2) : 0);
      if (ok && c.showText) {
        const half = c.format === 'ean13' ? 6 : 4;
        const [left, right] = o.texts;
        const xs = o.texts.flatMap(t => t.x);
        ok = left.content === (c.format === 'ean13' ? c.expect.slice(1, 7) : c.expect.slice(0, 4)) && right.content === c.expect.slice(-half) && left.x.length === half && right.x.length === half &&
          left.x.every((x, i) => i === 0 || x > left.x[i - 1]) && right.x[0] > left.x[half - 1] && (c.format !== 'ean13' || o.texts[2].content === c.expect[0] && o.texts[2].x[0] < left.x[0]) && xs.every(x => x > 5 && x < 65) && /DtTest Sans/.test(left.family) && left.anchor === 'middle';
      }
      detail = digits + ' heights ' + heights.join('/');
    }
    check('barcode ' + c.format + ' "' + c.value + '": drawn modules decode to ' + c.expect + (c.showText ? ' (text below)' : ''), ok && o.fill === '#102030' && o.kids.startsWith('rect,path') && o.info.ok, detail);
  }
  const binfo = id => bc.out[id].info;
  check('EAN check digits: 12 digits get the 13th (4006381333931), 7 digits the 8th (96385074); spaces are ignored',
    binfo('b').text === '4006381333931' && binfo('f').text === '96385074' && binfo('d').text === '4012345678901' && binfo('a').bars === 95 && binfo('e').bars === 67 &&
    JSON.stringify(binfo('a').guards) === '[[0,3],[45,50],[92,95]]' && JSON.stringify(binfo('e').guards) === '[[0,3],[31,36],[64,67]]', JSON.stringify(binfo('e').guards));
  check('Code 128: "PJJ123C" = start B + data, checksum 55; with start A (the Wikipedia example) the same data gives the documented checksum 54',
    binfo('g').values.join() === '104,48,42,42,17,18,19,35' && binfo('g').checksum === 55 &&
    (103 + binfo('g').values.slice(1).reduce((s, v, i) => s + (i + 1) * v, 0)) % 103 === 54, binfo('g').values.join() + ' / ' + binfo('g').checksum);
  check('Code 128 auto code set: runs of >= 4 digits use set C (start C / switch 99 and back 100), odd runs start with one digit in B, short runs stay in B',
    binfo('i').values.join() === '105,12,34,56,78' && binfo('h').values.join() === '104,33,34,99,12,34,56,78,100,35,36' && binfo('j').values.join() === '104,65,66,99,12,34,100,67,0,0,94' &&
    binfo('h').checksum === (104 + 33 + 2 * 34 + 3 * 99 + 4 * 12 + 5 * 34 + 6 * 56 + 7 * 78 + 8 * 100 + 9 * 35 + 10 * 36) % 103, binfo('h').values.join());
  const small = await run(`
    const v = s => { const i = DtEngine.barcodeInfo('code128', s); return i.ok ? i.values.join() : i.reason; };
    return { a: v('123'), b: v('1234'), c: v('12345'), d: v('A1234'), e: v('123456789'), f: v('0000') };
  `);
  check('Code 128: 123 -> B only; 1234 -> start C; 12345 -> B digit then C; A1234 -> B, C, ...; 123456789 -> B 1 then C 4 pairs',
    small.a === '104,17,18,19' && small.b === '105,12,34' && small.c === '104,17,99,23,45' && small.d === '104,33,99,12,34' && small.e === '104,17,99,23,45,67,89' && small.f === '105,0,0', JSON.stringify(small));
  const specSums = CODE128_SPEC.slice(0, 106).map(p => p.split('').reduce((s, c) => s + Number(c), 0));
  const specBars = CODE128_SPEC.slice(0, 106).map(p => Number(p[0]) + Number(p[2]) + Number(p[4]));
  check('Code 128 pattern table: 106 distinct symbols of 11 modules (even bar modules per symbol) + the 13-module stop, start A/B/C at 103/104/105',
    CODE128_SPEC.length === 107 && new Set(CODE128_SPEC).size === 107 && CODE128_SPEC[106].split('').reduce((a, c) => a + Number(c), 0) === 13 && specSums.every(s => s === 11) && specBars.every(s => s % 2 === 0) && CODE128_SPEC[0] === '212222' && CODE128_SPEC[103] === '211412' && CODE128_SPEC[104] === '211214' &&
    CODE128_SPEC[105] === '211232' && CODE128_SPEC[106] === '2331112', String(CODE128_SPEC.length));
  check('invalid barcodes give a short German reason',
    bc.reasons.join(' | ') === 'EAN-13: Prüfziffer stimmt nicht (richtig wäre 1) | EAN-13 braucht 12 oder 13 Ziffern | EAN-13 braucht 12 oder 13 Ziffern | EAN-13 braucht 12 oder 13 Ziffern | EAN-8 braucht 7 oder 8 Ziffern | EAN-8: Prüfziffer stimmt nicht (richtig wäre 4) | Code 128: kein Wert | Code 128: nur druckbare ASCII-Zeichen | Code 128: nur druckbare ASCII-Zeichen', bc.reasons.join(' | '));
  check('invalid barcode: nothing in the output, editor placeholder with the reason, warning through onWarning',
    bc.outputKids.join() === '0,0,0' && bc.editor.join('|') === 'EAN-13: Prüfziffer stimmt nicht (richtig wäre 1)|Code 128: nur druckbare ASCII-Zeichen|EAN-8 braucht 7 oder 8 Ziffern' &&
    bc.warnings.join('|') === 'EAN-13: Prüfziffer stimmt nicht (richtig wäre 1)@x1|Code 128: nur druckbare ASCII-Zeichen@x2|EAN-8 braucht 7 oder 8 Ziffern@x3', bc.warnings.join('|'));
  check('barcode without background: no rect, only the bars and the digits', bc.noBgKids === 'path,text,text,text', bc.noBgKids);

  step = 'section 24';
  // ---- 24. rasterize: pages, transparent PNG, JPEG ---------------------------------------------------------------------------------
  const rs = await run(`
    const d = { schema: 2, unit: 'px', width: 100, height: 60, dpi: 96, pages: [
      { background: { color: '#ffffff' }, elements: [{ type: 'shape', id: 'r', shape: 'rect', x: 40, y: 20, w: 30, h: 20, fill: '#ff0000' }] },
      { background: { color: '#00ff00' }, elements: [] },
      { background: { color: null }, elements: [{ type: 'shape', id: 'r', shape: 'rect', x: 40, y: 20, w: 30, h: 20, fill: '#0000ff' }] }] };
    const pixels = async blob => { const bmp = await createImageBitmap(blob); const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; const ctx = c.getContext('2d'); ctx.drawImage(bmp, 0, 0);
      const at = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data); return { w: bmp.width, h: bmp.height, corner: at(1, 1), centre: at(55, 30), type: blob.type, size: blob.size }; };
    const head = async blob => Array.from(new Uint8Array(await blob.slice(0, 24).arrayBuffer()));
    const png = await DtEngine.rasterize(d, {}, {});
    const transparent = await DtEngine.rasterize(d, {}, { background: false });
    const page1 = await DtEngine.rasterize(d, {}, { page: 1 });
    const noColour = await DtEngine.rasterize(d, {}, { page: 2 });
    const jpeg = await DtEngine.rasterize(d, {}, { format: 'jpeg' });
    const jpegTransparent = await DtEngine.rasterize(d, {}, { format: 'jpeg', page: 2 });
    const jpegScaled = await DtEngine.rasterize(d, {}, { format: 'jpeg', dpi: 192, quality: 0.5 });
    return { png: await pixels(png), transparent: await pixels(transparent), page1: await pixels(page1), noColour: await pixels(noColour), jpeg: await pixels(jpeg), jpegHead: await head(jpeg), jpegTransparent: await pixels(jpegTransparent),
      jpegScaled: await pixels(jpegScaled), scaledHead: await head(jpegScaled) };
  `);
  const near255 = (px, [r, g, b]) => Math.abs(px[0] - r) <= 6 && Math.abs(px[1] - g) <= 6 && Math.abs(px[2] - b) <= 6;
  check('rasterize PNG: the page background is drawn (white corner, red rectangle), image/png, 100 x 60 px at 96 dpi', rs.png.type === 'image/png' && rs.png.w === 100 && rs.png.h === 60 && rs.png.corner.join() === '255,255,255,255' && rs.png.centre.join() === '255,0,0,255', JSON.stringify(rs.png));
  check('rasterize PNG with background: false is transparent (alpha 0 in the corner) and keeps the elements', rs.transparent.type === 'image/png' && rs.transparent.corner[3] === 0 && rs.transparent.centre.join() === '255,0,0,255', JSON.stringify(rs.transparent));
  check('rasterize: opts.page picks the page; a page without colour is transparent in PNG', rs.page1.corner.join() === '0,255,0,255' && rs.noColour.corner[3] === 0 && rs.noColour.centre.join() === '0,0,255,255', JSON.stringify([rs.page1.corner, rs.noColour.corner]));
  check('rasterize JPEG: blob type image/jpeg, FF D8 header, colours kept; transparent areas are filled white', rs.jpeg.type === 'image/jpeg' && rs.jpegHead[0] === 0xff && rs.jpegHead[1] === 0xd8 && near255(rs.jpeg.corner, [255, 255, 255]) && near255(rs.jpeg.centre, [255, 0, 0]) &&
    near255(rs.jpegTransparent.corner, [255, 255, 255]) && rs.jpegTransparent.corner[3] === 255, JSON.stringify([rs.jpeg.corner, rs.jpeg.centre, rs.jpegTransparent.corner]));
  check('rasterize JPEG: size follows the dpi (192 dpi = 200 x 120 px) and the density is written into the JFIF header (units dpi)', rs.jpegScaled.w === 200 && rs.jpegScaled.h === 120 && rs.scaledHead[13] === 1 && rs.scaledHead[14] * 256 + rs.scaledHead[15] === 192 && rs.scaledHead[16] * 256 + rs.scaledHead[17] === 192,
    rs.scaledHead.join());


  step = 'section 25';
  // ---- 25. the schema-2 showcase: two pages, screenshots to look at --------------------------------------------------------------
  const shot2 = await context.newPage();
  await shot2.goto(base + '/tests/e2e/engine/engine.html');
  const shadow = { color: '#000000', opacity: 0.28, blur: 2.4, x: 0.8, y: 1.4 };
  const text2 = (id, props) => Object.assign({ type: 'text', id, name: id, x: 0, y: 0, w: 40, h: 8, fontFamily: 'DtTest Sans', fontSize: 12, color: '#1d3557' }, props);
  const showcase = {
    schema: 2, unit: 'mm', width: 160, height: 110, dpi: 300, locale: 'de-DE',
    fields: [
      { key: 'Url', label: 'Webadresse', type: 'text', sample: 'https://kaese-schneider.example/hofladen' },
      { key: 'Ean', label: 'EAN', type: 'text', sample: '400638133393' },
      { key: 'Name', label: 'Name', type: 'text', sample: 'Holunderblüte' },
      { key: 'Preis', label: 'Preis', type: 'price', sample: '2.99', decimals: 2 },
      { key: 'Foto', label: 'Foto', type: 'image', sample: 'photo-art' },
    ],
    pages: [
      { id: 'front', name: 'Vorderseite',
        background: { color: '#fff7e6', gradient: { type: 'linear', angle: 150, stops: [{ offset: 0, color: '#fff3d6' }, { offset: 0.55, color: '#ffd9a8' }, { offset: 1, color: '#f4a261' }] }, asset: null, fit: 'cover' },
        elements: [
          { type: 'shape', id: 'heart', name: 'Herz', shape: 'heart', x: 8, y: 8, w: 20, h: 18, rotation: -12, fill: '#e63946', stroke: null, shadow },
          { type: 'group', id: 'badge', name: 'Neu-Abzeichen', x: 116, y: 7, w: 38, h: 22, rotation: 7, shadow, opacity: 1, children: [
            { type: 'shape', id: 'badgeBg', shape: 'rect', x: 116, y: 7, w: 38, h: 22, radius: 4, fill: '#1d3557', stroke: null },
            text2('badgeText', { text: 'NEU', x: 128, y: 7, w: 26, h: 22, fontFamily: 'DtTest Impact', fontSize: 30, color: '#ffffff', align: 'center', valign: 'middle' }),
            { type: 'icon', id: 'badgeIcon', icon: 'star', x: 119, y: 11, w: 10, h: 10, color: '#ffd166', strokeWidth: 2 }] },
          text2('title', { text: 'Hofladen Sonnenschein', x: 20, y: 18, w: 120, h: 46, fontFamily: 'DtTest Script', fontSize: 28, color: '#1d3557', align: 'center', valign: 'top', curve: 42 }),
          { type: 'image', id: 'photo', name: 'Foto', source: { field: 'Foto' }, x: 8, y: 54, w: 42, h: 42, fit: 'cover', mask: 'circle', border: { color: '#ffffff', width: 4 },
            filters: { brightness: 8, contrast: 14, saturation: 25, blur: 0, grayscale: false, sepia: true }, shadow },
          { type: 'shape', id: 'star', name: 'Stern', shape: 'star', points: 5, innerRadius: 0.42, x: 58, y: 52, w: 24, h: 23, fill: { type: 'linear', angle: 160, stops: [{ offset: 0, color: '#ffe066' }, { offset: 1, color: '#f08c00' }] }, stroke: '#b5651d', strokeWidth: 1.2, shadow },
          { type: 'shape', id: 'arrow', name: 'Pfeil', shape: 'line', x: 82, y: 58, w: 30, h: 16, stroke: '#1d3557', strokeWidth: 3, startCap: 'circle', endCap: 'arrow' },
          { type: 'qr', id: 'qr', name: 'QR-Code', value: '{{Url}}', x: 118, y: 62, w: 34, h: 34, ecc: 'M', color: '#1d3557', background: '#ffffff', quiet: true, shadow },
          text2('scan', { text: 'Scan mich', x: 118, y: 96, w: 34, h: 6, fontSize: 9, align: 'center', color: '#1d3557', fontWeight: 700 }),
          { type: 'shape', id: 'speech', name: 'Sprechblase', shape: 'speech', x: 56, y: 82, w: 54, h: 24, fill: '#ffffff', stroke: '#1d3557', strokeWidth: 0.8, radius: 5, shadow },
          text2('speechText', { text: '{{Name}} – frisch vom Hof', x: 58, y: 84, w: 50, h: 14, fontSize: 10, align: 'center', valign: 'middle', color: '#1d3557' }),
        ] },
      { id: 'back', name: 'Rückseite',
        background: { color: '#fffaf0', gradient: null, asset: null, fit: 'cover' },
        elements: [
          { type: 'shape', id: 'band', shape: 'rect', x: 0, y: 0, w: 160, h: 26, fill: { type: 'linear', angle: 90, stops: [{ offset: 0, color: '#1d3557' }, { offset: 1, color: '#457b9d' }] }, stroke: null },
          text2('head', { text: 'Kontakt & Angebot', x: 8, y: 3, w: 110, h: 20, fontFamily: 'DtTest Sans', fontWeight: 700, fontSize: 24, color: '#ffffff', valign: 'middle', underline: true, outline: { color: '#1d3557', width: 0.6 } }),
          { type: 'icon', id: 'icPhone', icon: 'phone', x: 8, y: 34, w: 9, h: 9, color: '#e63946', strokeWidth: 1.75 },
          text2('tPhone', { text: 'Tel. 0711 123456', x: 20, y: 34, w: 70, h: 9, fontSize: 12, valign: 'middle' }),
          { type: 'icon', id: 'icMail', icon: 'mail', x: 8, y: 46, w: 9, h: 9, color: '#e63946', strokeWidth: 1.75 },
          text2('tMail', { text: 'hallo@kaese.example', x: 20, y: 46, w: 70, h: 9, fontSize: 12, valign: 'middle' }),
          { type: 'icon', id: 'icGlobe', icon: 'globe', x: 8, y: 58, w: 9, h: 9, color: '#e63946', strokeWidth: 1.75 },
          text2('tWeb', { text: 'www.kaese.example', x: 20, y: 58, w: 70, h: 9, fontSize: 12, valign: 'middle' }),
          { type: 'icon', id: 'icPin', icon: 'map-pin', x: 8, y: 70, w: 9, h: 9, color: '#e63946', strokeWidth: 1.75 },
          text2('tPin', { text: 'Hofweg 1, 74535 Mainhardt', x: 20, y: 70, w: 70, h: 9, fontSize: 12, valign: 'middle' }),
          text2('list', { text: 'Heumilch\nRohmilch\nBio-Qualität', x: 8, y: 84, w: 50, h: 22, fontSize: 11, list: 'bullet', lineHeight: 1.35 }),
          text2('numbers', { text: 'Käse wählen\nProbieren\nGenießen', x: 60, y: 84, w: 50, h: 22, fontSize: 11, list: 'number', lineHeight: 1.35 }),
          { type: 'barcode', id: 'ean', name: 'EAN-13', format: 'ean13', value: '{{Ean}}', x: 100, y: 32, w: 52, h: 28, color: '#1d1d1d', background: '#ffffff', showText: true, fontFamily: 'DtTest Sans' },
          { type: 'barcode', id: 'c128', name: 'Code 128', format: 'code128', value: 'HOF-2026-0815', x: 100, y: 64, w: 52, h: 18, color: '#1d1d1d', background: '#ffffff', showText: true, fontFamily: 'DtTest Sans' },
          text2('badge', { text: 'ANGEBOT', x: 118, y: 87, w: 34, h: 8, fontSize: 12, fontWeight: 700, color: '#ffffff', align: 'center', valign: 'middle', background: { color: '#e63946', radius: 2, padding: 2 } }),
          text2('old', { text: '3,99 €', x: 118, y: 97, w: 16, h: 8, fontSize: 11, align: 'right', color: '#6c757d', strike: true }),
          text2('price', { text: '{{Preis}} €', x: 135, y: 96, w: 20, h: 9, fontSize: 14, fontWeight: 700, color: '#e63946' }),
          { type: 'image', id: 'frame', name: 'Bildrahmen', source: null, x: 81, y: 30, w: 17, h: 17, fit: 'cover', mask: 'hexagon', border: { color: '#1d3557', width: 1 } },
          { type: 'shape', id: 'back-arrow', shape: 'arrow', x: 81, y: 52, w: 17, h: 8, fill: '#f4a261', stroke: '#b5651d', strokeWidth: 0.8, flipX: true },
        ] },
    ],
  };
  // A third page that is only there to be looked at: every shape, mask, filter, line cap and text effect in one place.
  const gallery = { id: 'gallery', name: 'Galerie', background: { color: '#f4f1ea', gradient: null, asset: null, fit: 'cover' }, elements: [] };
  const caption = (id, textValue, x, y, w) => text2(id, { text: textValue, x, y, w, h: 4, fontSize: 6, align: 'center', color: '#555555' });
  ['rect', 'ellipse', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'heart', 'arrow', 'speech'].forEach((kind, i) => {
    gallery.elements.push({ type: 'shape', id: 'sh-' + kind, shape: kind, x: 5 + i * 15.2, y: 6, w: 13, h: 13, radius: 2.5, fill: i % 2 ? { type: 'linear', angle: 135, stops: [{ offset: 0, color: '#2a9d8f' }, { offset: 1, color: '#264653' }] } : '#e9c46a', stroke: '#264653', strokeWidth: 0.7 });
    gallery.elements.push(caption('shl-' + kind, kind, 3.5 + i * 15.2, 20, 16));
  });
  ['rounded', 'circle', 'heart', 'star', 'hexagon', 'triangle'].forEach((mask, i) => {
    gallery.elements.push({ type: 'image', id: 'mk-' + mask, source: { asset: 'photo-art' }, x: 5 + i * 25.5, y: 27, w: 22, h: 22, fit: 'cover', mask, radius: 5, border: { color: '#ffffff', width: 2 }, shadow: { color: '#000000', opacity: 0.25, blur: 1.5, x: 0.5, y: 0.8 } });
    gallery.elements.push(caption('mkl-' + mask, 'Maske ' + mask, 3.5 + i * 25.5, 50, 25));
  });
  const filterSets = [['Original', {}], ['Graustufen', { grayscale: true }], ['Sepia', { sepia: true }], ['Hell +40', { brightness: 40 }], ['Kontrast +60', { contrast: 60 }], ['Weich 8', { blur: 8 }]];
  filterSets.forEach(([name, filters], i) => {
    gallery.elements.push({ type: 'image', id: 'ft-' + i, source: { asset: 'photo-art' }, x: 5 + i * 25.5, y: 57, w: 22, h: 15, fit: 'cover', filters });
    gallery.elements.push(caption('ftl-' + i, name, 3.5 + i * 25.5, 73, 25));
  });
  gallery.elements.push({ type: 'image', id: 'crop1', source: { asset: 'photo-art' }, x: 5, y: 80, w: 22, h: 22, fit: 'cover', crop: { x: 0.5, y: 0.1, w: 0.4, h: 0.4 }, border: { color: '#264653', width: 1 } });
  gallery.elements.push(caption('cropl', 'Ausschnitt (Sonne)', 3.5, 103, 25));
  [['none', 'none'], ['circle', 'arrow'], ['square', 'circle']].forEach(([start, end], i) => {
    gallery.elements.push({ type: 'shape', id: 'ln-' + i, shape: 'line', x: 32, y: 84 + i * 8, w: 34, h: i === 1 ? 4 : 0, stroke: '#264653', strokeWidth: 1.8, startCap: start, endCap: end, dash: i === 2 ? 'dashed' : 'solid' });
  });
  gallery.elements.push(text2('fxOutline', { text: 'Outline', x: 74, y: 78, w: 40, h: 12, fontFamily: 'DtTest Impact', fontSize: 28, color: '#e9c46a', outline: { color: '#264653', width: 1.4 }, align: 'left', valign: 'middle' }));
  gallery.elements.push(text2('fxSmile', { text: 'Lächeln & Kurven', x: 74, y: 88, w: 82, h: 16, fontSize: 12, fontWeight: 700, align: 'center', curve: -55, color: '#264653' }));
  gallery.elements.push(text2('fxFlip', { text: 'Gespiegelt', x: 118, y: 78, w: 36, h: 10, fontSize: 14, fontWeight: 700, color: '#e76f51', flipX: true, align: 'center', valign: 'middle', shadow: { color: '#000000', opacity: 0.3, blur: 1, x: 0.6, y: 0.6 } }));
  showcase.pages.push(gallery);
  const show = await shot2.evaluate(`(async () => {
    ${helper}
    const doc = ${JSON.stringify(showcase)};
    const out = { warnings: [] };
    const draw = async (name, page, mode) => {
      const svg = await DtEngine.render(doc, null, { page, mode, assetUrl, icon: iconFn, fonts: testFonts, onWarning: (m, id) => out.warnings.push(name + ': ' + m + '@' + id) });
      svg.setAttribute('width', '880'); svg.setAttribute('height', String(Math.round(880 * 110 / 160)));
      const holder = document.createElement('div'); holder.id = name; holder.setAttribute('data-shot', '1'); holder.appendChild(svg); document.body.appendChild(holder);
      return svg;
    };
    const p1 = await draw('page1', 0, 'output');
    const p2 = await draw('page2', 1, 'output');
    const p2e = await draw('page2-editor', 1, 'editor');
    const p3 = await draw('page3', 2, 'output');
    out.ids = [p1, p2, p2e, p3].map(s => Array.from(s.querySelectorAll('[data-el-id]')).length);
    out.count = DtEngine.pageCount(doc);
    out.editorPlaceholders = Array.from(p2e.querySelectorAll('[data-dt-placeholder] text')).map(t => t.textContent);
    out.outputPlaceholders = p2.querySelectorAll('[data-dt-placeholder]').length;
    const jpeg = await DtEngine.rasterize(doc, null, { page: 0, format: 'jpeg', quality: 0.9, dpi: 150, assetUrl, icon: iconFn, fonts: testFonts });
    const lowQuality = await DtEngine.rasterize(doc, null, { page: 0, format: 'jpeg', quality: 0.2, dpi: 150, assetUrl, icon: iconFn, fonts: testFonts });
    out.jpeg = [jpeg.type, jpeg.size, lowQuality.size];
    const bytes = new Uint8Array(await jpeg.arrayBuffer()); let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); out.jpegBase64 = btoa(s); out.density = [bytes[13], bytes[14] * 256 + bytes[15]];
    const png = await DtEngine.rasterize(doc, null, { page: 1, background: false, dpi: 150, assetUrl, icon: iconFn, fonts: testFonts });
    const b2 = new Uint8Array(await png.arrayBuffer()); let t = ''; for (let i = 0; i < b2.length; i += 0x8000) t += String.fromCharCode.apply(null, b2.subarray(i, i + 0x8000)); out.pngBase64 = btoa(t);
    document.body.setAttribute('data-ready', '1');
    return out;
  })()`);
  await shot2.setViewportSize({ width: 920, height: 640 });
  for (const name of ['page1', 'page2', 'page2-editor', 'page3']) {
    await shot2.evaluate(n => { for (const h of document.querySelectorAll('[data-shot]')) h.style.setProperty('display', h.id === n ? 'block' : 'none'); }, name).catch(() => {});
    await shot2.waitForTimeout(150);
    await shot2.screenshot({ path: path.join(outDir, 'showcase-' + name + '.png'), clip: { x: 0, y: 0, width: 900, height: 640 }, animations: 'allow', caret: 'initial' });
  }
  fs.writeFileSync(path.join(outDir, 'showcase-page1.jpg'), Buffer.from(show.jpegBase64, 'base64'));
  fs.writeFileSync(path.join(outDir, 'showcase-page2-transparent.png'), Buffer.from(show.pngBase64, 'base64'));
  await shot2.close();
  check('showcase: three pages (front, back, gallery), all elements drawn (group + 3 children counted), no warnings in the output',
    show.count === 3 && show.ids[0] === 13 && show.ids[1] === 19 && show.ids[3] === 52 && show.warnings.filter(w => !w.startsWith('page2-editor')).length === 0, JSON.stringify(show.ids) + ' ' + show.warnings.join(' | '));
  check('showcase: the empty frame shows its placeholder in the editor and is absent from the output', show.editorPlaceholders.join() === 'Bild hierher ziehen' && show.outputPlaceholders === 0, show.editorPlaceholders.join());
  check('showcase: JPEG of page 1 (150 dpi, density in the header, quality changes the size) and a transparent PNG of page 2', show.jpeg[0] === 'image/jpeg' && show.jpeg[2] < show.jpeg[1] && show.density.join() === '1,150', JSON.stringify(show.jpeg) + ' ' + show.density.join());

  step = 'section 26';
  // ---- 26. image strip masks, standalone SVG of the schema-2 pages ----------------------------------------------------------------
  const strip2 = await run(`
    const d = { schema: 2, unit: 'mm', width: 100, height: 40, pages: [{ elements: [{ type: 'imageStrip', id: 's', x: 5, y: 5, w: 90, h: 20, gap: 4, items: [{ asset: 'photo-wide' }, { asset: 'flag-de' }, { asset: 'nope' }], mask: 'circle', border: { color: '#ff0000', width: 1.5 } }] }] };
    const svg = await DtEngine.render(d, {}, { assetUrl });
    const g = q(svg, 's');
    return { images: g.querySelectorAll('image').length, clips: Array.from(g.querySelectorAll('clipPath')).map(c => c.firstElementChild.localName), borders: Array.from(g.querySelectorAll('ellipse')).filter(e => e.getAttribute('stroke') === '#ff0000').length, clipped: Array.from(g.querySelectorAll('image')).every(i => i.getAttribute('clip-path').startsWith('url(#')) };
  `);
  check('image strip: mask and border apply to every picture of the strip (2 pictures -> 2 elliptic clips, 2 red outlines)', strip2.images === 2 && strip2.clips.join() === 'ellipse,ellipse' && strip2.borders === 2 && strip2.clipped, JSON.stringify(strip2));
  const standaloneShowcase = await run(`
    const out = [];
    for (let page = 0; page < 3; page++) out.push(await DtEngine.toStandaloneSvg(arg, null, { page, assetUrl, icon: iconFn, fonts: testFonts }));
    return out;
  `, showcase);
  const blank2 = await context.newPage();
  const parsedShowcase = await blank2.evaluate(texts => texts.map(text => {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    return { error: !!doc.querySelector('parsererror'), textPaths: doc.querySelectorAll('textPath').length, shadows: doc.querySelectorAll('feDropShadow').length, gradients: doc.querySelectorAll('linearGradient').length, filters: doc.querySelectorAll('filter').length,
      hrefs: Array.from(doc.querySelectorAll('image')).map(i => (i.getAttribute('xlink:href') || i.getAttribute('href') || '').slice(0, 11)), scripts: doc.querySelectorAll('script, foreignObject').length };
  }), standaloneShowcase);
  await blank2.close();
  check('standalone SVG of the schema-2 pages: well-formed, curved text, shadows, gradients and filters present, images embedded as data URIs, no external URL',
    parsedShowcase.every(p => !p.error && p.scripts === 0 && p.hrefs.every(h => h.startsWith('data:image/'))) && parsedShowcase[0].textPaths === 1 && parsedShowcase[0].shadows >= 5 && parsedShowcase[0].gradients >= 2 && parsedShowcase[0].filters >= 5 && parsedShowcase[0].hrefs.length === 1 &&
    standaloneShowcase.every(text => !/https?:/i.test(text.replace(/xmlns(:\w+)?="[^"]*"/g, ''))), JSON.stringify(parsedShowcase[0]));

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
