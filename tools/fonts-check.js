// Checks the bundled fonts (src/MatCan/wwwroot/fonts/fonts.json): file kind, weight against the font, glyph coverage of the cmap for the German
// letters and typographic marks (and some Latin Extended), name table, licence text. Optionally renders a specimen sheet and measures the vertical
// metrics in the installed Edge.
//
//   node tools/fonts-check.js                       report per font; exit 1 when a font lacks ä ö ü Ä Ö Ü ß € or is broken
//   node tools/fonts-check.js --sheet out.png       also a specimen sheet (Playwright from tests/e2e/node_modules + Edge)
//   node tools/fonts-check.js --metrics out.json    also measure ascent, descent, digits and features per face in Edge
//   node tools/fonts-check.js --quiet               only problems
//
// The cmap of TTF/OTF is read directly; WOFF2 is unpacked here (brotli, the table directory with UIntBase128; the cmap is never transformed).
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.join(__dirname, '..', 'src', 'MatCan', 'wwwroot', 'fonts');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i < 0 ? null : (args[i + 1] || true); };
const quiet = args.includes('--quiet');

// ---------------------------------------------------------------- reading a font file
const WOFF2_TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];

/** Returns { kind, tables: { tag: Buffer } } for TTF, OTF, WOFF and WOFF2. */
function readTables(buf) {
  const magic = buf.toString('latin1', 0, 4);
  const tables = {};
  if (magic === 'wOF2') {
    const numTables = buf.readUInt16BE(12);
    const totalCompressed = buf.readUInt32BE(20);
    let p = 48;
    const entries = [];
    for (let i = 0; i < numTables; i++) {
      const flags = buf[p++];
      let tag = flags & 63;
      const version = flags >> 6;
      if (tag === 63) { tag = buf.toString('latin1', p, p + 4); p += 4; } else tag = WOFF2_TAGS[tag];
      const base128 = () => { let v = 0; for (let k = 0; k < 5; k++) { const b = buf[p++]; v = (v * 128) + (b & 127); if (!(b & 128)) return v; } throw new Error('bad UIntBase128'); };
      const orig = base128();
      const transformed = (tag === 'glyf' || tag === 'loca') ? version === 0 : version !== 0;
      const length = transformed ? base128() : orig;
      entries.push({ tag, orig, length, transformed });
    }
    const data = zlib.brotliDecompressSync(buf.subarray(p, p + totalCompressed));
    let off = 0;
    for (const e of entries) { if (!e.transformed) tables[e.tag] = data.subarray(off, off + e.length); off += e.length; }
    return { kind: 'woff2', tables, transformed: entries.filter(e => e.transformed).map(e => e.tag) };
  }
  if (magic === 'wOFF') {
    const n = buf.readUInt16BE(12);
    for (let i = 0; i < n; i++) {
      const r = 44 + i * 20;
      const tag = buf.toString('latin1', r, r + 4), off = buf.readUInt32BE(r + 4), comp = buf.readUInt32BE(r + 8), orig = buf.readUInt32BE(r + 12);
      const raw = buf.subarray(off, off + comp);
      tables[tag] = comp === orig ? raw : zlib.inflateSync(raw);
    }
    return { kind: 'woff', tables };
  }
  if (magic === 'OTTO' || buf.readUInt32BE(0) === 0x00010000 || magic === 'true') {
    const n = buf.readUInt16BE(4);
    for (let i = 0; i < n; i++) {
      const r = 12 + i * 16;
      tables[buf.toString('latin1', r, r + 4)] = buf.subarray(buf.readUInt32BE(r + 8), buf.readUInt32BE(r + 8) + buf.readUInt32BE(r + 12));
    }
    return { kind: magic === 'OTTO' ? 'otf' : 'ttf', tables };
  }
  throw new Error('not a font file (' + JSON.stringify(magic) + ')');
}

/** The set of code points of the best Unicode cmap subtable. */
function readCmap(cmap) {
  const n = cmap.readUInt16BE(2);
  let best = null;
  for (let i = 0; i < n; i++) {
    const platform = cmap.readUInt16BE(4 + i * 8), enc = cmap.readUInt16BE(6 + i * 8), off = cmap.readUInt32BE(8 + i * 8);
    const fmt = cmap.readUInt16BE(off);
    const rank = (platform === 3 && enc === 10 && fmt === 12) ? 4 : (platform === 0 && fmt === 12) ? 3 : (platform === 3 && enc === 1 && fmt === 4) ? 2 : (platform === 0 && fmt === 4) ? 1 : 0;
    if (rank > 0 && (!best || rank > best.rank)) best = { rank, off, fmt };
  }
  const set = new Set();
  if (!best) return set;
  const o = best.off;
  if (best.fmt === 4) {
    const segX2 = cmap.readUInt16BE(o + 6), seg = segX2 / 2;
    const endP = o + 14, startP = endP + segX2 + 2, deltaP = startP + segX2, rangeP = deltaP + segX2;
    for (let s = 0; s < seg; s++) {
      const end = cmap.readUInt16BE(endP + s * 2), start = cmap.readUInt16BE(startP + s * 2);
      if (start === 0xffff) continue;
      const delta = cmap.readInt16BE(deltaP + s * 2), ro = cmap.readUInt16BE(rangeP + s * 2);
      for (let c = start; c <= end; c++) {
        let g;
        if (ro === 0) g = (c + delta) & 0xffff;
        else { const gp = rangeP + s * 2 + ro + (c - start) * 2; if (gp + 2 > cmap.length) continue; g = cmap.readUInt16BE(gp); if (g) g = (g + delta) & 0xffff; }
        if (g) set.add(c);
      }
    }
  } else {
    const groups = cmap.readUInt32BE(o + 12);
    for (let g = 0; g < groups; g++) {
      const s = cmap.readUInt32BE(o + 16 + g * 12), e = cmap.readUInt32BE(o + 20 + g * 12), gid = cmap.readUInt32BE(o + 24 + g * 12);
      for (let c = s; c <= e; c++) if (gid + (c - s)) set.add(c);
    }
  }
  return set;
}

function readNames(name) {
  const out = {};
  if (!name) return out;
  const n = name.readUInt16BE(2), so = name.readUInt16BE(4);
  for (let i = 0; i < n; i++) {
    const r = 6 + i * 12, platform = name.readUInt16BE(r), id = name.readUInt16BE(r + 6), len = name.readUInt16BE(r + 8), off = name.readUInt16BE(r + 10);
    const raw = name.subarray(so + off, so + off + len);
    let text;
    if (platform === 3 || platform === 0) { const b = Buffer.from(raw); b.swap16(); text = b.toString('utf16le'); } else text = raw.toString('latin1');
    if (!out[id] || platform === 3) out[id] = text;
  }
  return out;
}

function readFvar(fvar) {
  if (!fvar) return null;
  const axisOff = fvar.readUInt16BE(4), count = fvar.readUInt16BE(8), size = fvar.readUInt16BE(10);
  const axes = {};
  for (let i = 0; i < count; i++) {
    const r = axisOff + i * size;
    axes[fvar.toString('latin1', r, r + 4)] = { min: fvar.readInt32BE(r + 4) / 65536, def: fvar.readInt32BE(r + 8) / 65536, max: fvar.readInt32BE(r + 12) / 65536 };
  }
  return axes;
}

function readFeatures(table) {
  if (!table) return [];
  const fl = table.readUInt16BE(6), n = table.readUInt16BE(fl), tags = new Set();
  for (let i = 0; i < n; i++) tags.add(table.toString('latin1', fl + 2 + i * 6, fl + 6 + i * 6));
  return [...tags];
}

function readMetrics(t) {
  const upm = t.head.readUInt16BE(18);
  const m = { upm, hheaAscent: t.hhea.readInt16BE(4), hheaDescent: t.hhea.readInt16BE(6), hheaGap: t.hhea.readInt16BE(8) };
  if (t['OS/2']) {
    const o = t['OS/2'];
    m.weightClass = o.readUInt16BE(4);
    m.typoAscent = o.readInt16BE(68); m.typoDescent = o.readInt16BE(70); m.typoGap = o.readInt16BE(72);
    m.winAscent = o.readUInt16BE(74); m.winDescent = o.readUInt16BE(76);
    m.useTypo = (o.readUInt16BE(62) & 128) !== 0;
  }
  return m;
}

// ---------------------------------------------------------------- what is checked
const cp = (s) => [...s].map(c => c.codePointAt(0));
const MUST = cp('äöüÄÖÜß€');
const TYPO = cp('„“”‚‘’–—…•');
const EXT = cp('éèñçłžšő');
const show = (c) => String.fromCodePoint(c) + ' U+' + c.toString(16).toUpperCase().padStart(4, '0');

const list = JSON.parse(fs.readFileSync(path.join(root, 'fonts.json'), 'utf8'));
const licenceFile = (family) => path.join(root, 'LICENSES', family.replace(/ /g, '-') + '.txt');
let failures = 0, findings = 0;
const faces = [];
const fail = (msg) => { failures++; console.log('  FAIL ' + msg); };

for (const f of list) {
  const file = path.join(root, f.file);
  const label = `${f.family} ${f.weight} ${f.style}`;
  const problems = [];
  const log = [];
  let info = null;
  try {
    const buf = fs.readFileSync(file);
    const font = readTables(buf);
    const t = font.tables;
    for (const need of ['cmap', 'head', 'hhea', 'name']) if (!t[need]) throw new Error('table ' + need + ' missing');
    const cmap = readCmap(t.cmap);
    const names = readNames(t.name);
    const axes = readFvar(t.fvar);
    const metrics = readMetrics(t);
    const feats = [...new Set([...readFeatures(t.GSUB), ...readFeatures(t.GPOS)])];
    const missing = (set) => set.filter(c => !cmap.has(c));
    const mustMiss = missing(MUST), typoMiss = missing(TYPO), extMiss = missing(EXT);
    if (mustMiss.length) problems.push('lacks ' + mustMiss.map(show).join(', '));
    // the weight of fonts.json against the font
    if (/^\d{3} \d{3}$/.test(f.weight)) {
      const [lo, hi] = f.weight.split(' ').map(Number);
      if (!axes || !axes.wght) problems.push('weight range given but the font has no wght axis');
      else if (axes.wght.min !== lo || Math.min(axes.wght.max, 900) !== hi) problems.push(`weight range ${f.weight} but wght axis is ${axes.wght.min} to ${axes.wght.max} (a weight has three digits: 900 is the cap)`);
    } else if (axes && axes.wght) problems.push('a variable font needs a weight range in fonts.json');
    else if (metrics.weightClass && Number(f.weight) !== metrics.weightClass) problems.push(`weight ${f.weight} but OS/2 usWeightClass is ${metrics.weightClass}`);
    const wantExt = { ttf: 'ttf', otf: 'otf', woff: 'woff', woff2: 'woff2' }[font.kind];
    if (path.extname(f.file).slice(1) !== wantExt) problems.push(`file name ends in ${path.extname(f.file)} but the file is ${font.kind}`);
    if (!names[0]) problems.push('name table has no copyright (id 0)');
    if (!fs.existsSync(licenceFile(f.family))) problems.push('no licence text ' + path.relative(root, licenceFile(f.family)));
    if (font.transformed && font.transformed.includes('cmap')) problems.push('cmap is transformed');
    info = { f, label, kind: font.kind, size: buf.length, names, axes, metrics, feats, mustMiss, typoMiss, extMiss, glyphs: cmap.size };
    faces.push(info);
    log.push(`${label.padEnd(30)} ${font.kind.padEnd(5)} ${String(buf.length).padStart(7)} B  ${cmap.size} chars` +
      (axes ? '  axes ' + Object.entries(axes).map(([k, v]) => `${k} ${v.min}-${v.max}`).join(', ') : ''));
    if (typoMiss.length) { findings++; log.push('    typographic marks missing: ' + typoMiss.map(show).join(', ')); }
    if (extMiss.length) { findings++; log.push('    Latin Extended missing: ' + extMiss.map(show).join(', ')); }
  } catch (e) {
    problems.push(String(e.message || e));
  }
  if (!quiet || problems.length) { for (const l of log) console.log(l); if (!log.length) console.log(label); }
  for (const p of problems) fail(`${label}: ${p}`);
}

// no two entries for one face, no file twice, no orphan font file
const seen = new Set();
for (const f of list) {
  const key = `${f.family}|${f.weight}|${f.style}`.toLowerCase();
  if (seen.has(key)) fail('duplicate face ' + key);
  seen.add(key);
}
const files = new Set(list.map(f => f.file));
if (files.size !== list.length) fail('a file is listed twice');
for (const name of fs.readdirSync(root)) if (/\.(ttf|otf|woff2?)$/i.test(name) && !files.has(name)) fail('font file not in fonts.json: ' + name);

console.log(`${list.length} faces, ${failures} problems, ${findings} findings (glyphs missing outside ä ö ü Ä Ö Ü ß €)`);
const newBytes = list.reduce((s, f) => s + fs.statSync(path.join(root, f.file)).size, 0);
console.log(`total size of all font files: ${(newBytes / 1024 / 1024).toFixed(2)} MB`);

// ---------------------------------------------------------------- Edge: specimen sheet and measurements
async function browserPart() {
  const sheet = opt('--sheet'), metricsOut = opt('--metrics');
  if (!sheet && !metricsOut) return;
  const { chromium } = require(path.join(__dirname, '..', 'tests', 'e2e', 'node_modules', 'playwright'));
  const browser = await chromium.launch({ channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
    const items = list.map((f, i) => {
      const buf = fs.readFileSync(path.join(root, f.file));
      const mime = { ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' }[path.extname(f.file).slice(1)];
      return { ...f, id: 'fc' + i, url: `data:${mime};base64,${buf.toString('base64')}` };
    });
    const css = items.map(i => `@font-face{font-family:'${i.id}';src:url('${i.url}');font-weight:${i.weight};font-style:${i.style};font-display:block}`).join('\n');
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>${css}
      body{margin:0;padding:16px 20px;background:#fff;color:#111;font:12px Arial,sans-serif;width:1460px}
      .row{display:flex;align-items:baseline;gap:14px;border-bottom:1px solid #ddd;padding:2px 0}
      .name{flex:0 0 190px;color:#666;font:11px Arial,sans-serif}
      .line{font-size:30px;line-height:1.25;white-space:nowrap}
    </style><body></body>`);
    const sample = 'Größe ändern – Käse, Äpfel & Öl für 12,50 € „zum Fest“';
    const rows = [];
    for (const i of items) {
      // a range is shown at 400 and 700 (moved into the range), a static face at its own weight
      const [lo, hi] = i.weight.split(' ').map(Number);
      const clamp = (w) => Math.min(Math.max(w, lo), hi ?? lo);
      const ws = hi === undefined ? [lo] : [...new Set([clamp(400), clamp(700)])];
      for (const w of ws) rows.push({ id: i.id, family: i.family, style: i.style, weight: w, kind: path.extname(i.file).slice(1) });
    }
    const res = await page.evaluate(async ({ rows, sample, doSheet, doMetrics }) => {
      await Promise.all(rows.map(r => document.fonts.load(`${r.style} ${r.weight} 30px "${r.id}"`, 'Äß€')));
      const bad = rows.filter(r => !document.fonts.check(`${r.style} ${r.weight} 30px "${r.id}"`, 'Äß€')).map(r => r.family + ' ' + r.weight);
      if (doSheet) {
        for (const r of rows) {
          const row = document.createElement('div'); row.className = 'row';
          const n = document.createElement('div'); n.className = 'name'; n.textContent = `${r.family} ${r.weight}${r.style === 'italic' ? ' italic' : ''} (${r.kind})`;
          const l = document.createElement('div'); l.className = 'line'; l.textContent = sample;
          l.style.setProperty('font-family', `"${r.id}", monospace`); l.style.setProperty('font-weight', String(r.weight)); l.style.setProperty('font-style', r.style);
          row.append(n, l); document.body.append(row);
        }
      }
      const metrics = [];
      if (doMetrics) {
        const c = document.createElement('canvas').getContext('2d');
        for (const r of rows) {
          c.font = `${r.style} ${r.weight} 100px "${r.id}"`;
          const box = (s) => { const m = c.measureText(s); return { a: m.actualBoundingBoxAscent / 100, d: m.actualBoundingBoxDescent / 100, w: m.width / 100 }; };
          const fm = c.measureText('H');
          const digits = [...'0123456789'].map(d => box(d));
          const one = box('1111111111'), zero = box('0000000000'), thin = box('iiiiiiiiii'), wide = box('WWWWWWWWWW');
          metrics.push({
            family: r.family, weight: r.weight, style: r.style,
            fontAscent: fm.fontBoundingBoxAscent / 100, fontDescent: fm.fontBoundingBoxDescent / 100,
            cap: box('H').a, xh: box('x').a, accentTop: box('ÄÖÜ').a, accentTopLower: box('äöü').a, ascender: box('bdfhkl').a,
            descender: box('gjpqy').d, punctDescent: box(',;').d, capDescent: box('Ç').d,
            digitTop: Math.max(...digits.map(d => d.a)), digitBottom: Math.max(...digits.map(d => d.d)), digitTopMin: Math.min(...digits.map(d => d.a)),
            tabular: Math.abs(one.w - zero.w) < 0.001, proportionalI: thin.w / wide.w,
          });
        }
      }
      return { bad, metrics };
    }, { rows, sample, doSheet: !!sheet, doMetrics: !!metricsOut });
    if (res.bad.length) fail('the browser could not load: ' + res.bad.join(', '));
    if (sheet) {
      await page.setViewportSize({ width: 1500, height: 900 });
      await page.screenshot({ path: sheet, fullPage: true });
      console.log('specimen sheet: ' + sheet);
    }
    if (metricsOut) {
      const byKey = new Map(faces.map(f => [`${f.f.family}|${f.f.weight}|${f.f.style}`, f]));
      const out = res.metrics.map(m => {
        const face = [...byKey.values()].find(f => f.f.family === m.family && f.f.style === m.style && (f.f.weight === String(m.weight) || (f.f.weight.includes(' ') && +f.f.weight.split(' ')[0] <= m.weight && +f.f.weight.split(' ')[1] >= m.weight)));
        return { ...m, features: face ? face.feats.filter(x => ['smcp', 'c2sc', 'tnum', 'onum', 'lnum', 'pnum', 'liga', 'case', 'ss01', 'swsh', 'salt', 'calt'].includes(x)) : [] };
      });
      fs.writeFileSync(metricsOut, JSON.stringify(out, null, 1));
      console.log('metrics: ' + metricsOut);
    }
  } finally {
    await browser.close();
  }
}

browserPart().then(() => process.exit(failures ? 1 : 0), (e) => { console.error(e); process.exit(1); });
