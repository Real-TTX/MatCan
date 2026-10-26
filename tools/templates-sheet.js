#!/usr/bin/env node
/* Contact sheets of the built-in templates (plan 6): every page of every template of a range as a small picture with its name under it, on one PNG (or a few, when the range is large),
   so a batch of 20 to 60 templates can be judged at a glance. Needs no running app (like templates-preview.js: a local server hands out the engine, fonts, built-in media and icons).
   The templates are read from src/DesignThix/Demo/templates/*.json: run  node tools/templates-build.js  first. The number is the NN of the module file tools/templates/NN-<slug>.js.

   node tools/templates-sheet.js [--from 100] [--to 199] [--only slug,slug] [--family slug] [--out <folder or file.png>] [--thumb 300] [--width 2400] [--per-sheet 40] [--rows]
     --from/--to  the range of numbers (default: all)
     --only       slugs (comma separated);  --family: every variant of one family
     --out        a folder (default <temp>/designthix-sheets) or a .png file name (several sheets become name-1.png, name-2.png ...)
     --thumb      the longer side of a page picture in pixels (default 300);  --width: width of a sheet (default 2400);  --per-sheet: templates per PNG (default 40)
     --rows       also draw the sample rows of a template that has some (first page only), to see long names
   The label under a template: number, slug, "family / variant", size. A dashed line marks the fold of a folded card (this sheet only, never in the file). Warnings of the engine are printed
   and make the exit code 1. Playwright comes from tests/e2e/node_modules.                                                                                                       */
'use strict';
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const wwwroot = path.join(root, 'src', 'DesignThix', 'wwwroot');
const templatesDir = path.join(root, 'src', 'DesignThix', 'Demo', 'templates');
const { chromium } = require(path.join(root, 'tests', 'e2e', 'node_modules', 'playwright'));

const args = process.argv.slice(2);
const argValue = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const from = Number(argValue('--from', '0'));
const to = Number(argValue('--to', '99999'));
const only = argValue('--only', '') ? argValue('--only', '').split(',') : null;
const familyOnly = argValue('--family', '');
const thumb = Number(argValue('--thumb', '300'));
const sheetWidth = Number(argValue('--width', '2400'));
const perSheet = Number(argValue('--per-sheet', '40'));
const withRows = args.includes('--rows');
const outArg = path.resolve(argValue('--out', path.join(os.tmpdir(), 'designthix-sheets')));
const outIsFile = /\.png$/i.test(outArg);
const outDir = outIsFile ? path.dirname(outArg) : outArg;
const outBase = outIsFile ? path.basename(outArg, '.png') : 'sheet';

function loadTemplates() {
  const numbers = new Map();
  const dir = path.join(__dirname, 'templates');
  for (const file of fs.readdirSync(dir).filter(f => /^\d+-.*\.js$/.test(f))) {
    const number = Number(/^(\d+)-/.exec(file)[1]);
    try { numbers.set(require(path.join(dir, file)).slug, number); } catch (e) { console.log(`${file}: ${e.message}`); }
  }
  const list = [];
  for (const file of fs.readdirSync(templatesDir).filter(f => f.endsWith('.json')).sort()) {
    const slug = file.replace(/\.json$/, '');
    const t = JSON.parse(fs.readFileSync(path.join(templatesDir, file), 'utf8'));
    list.push({ slug, number: numbers.get(slug) || t.number || 0, name: t.name, family: t.family || '', variant: t.variant || '', document: t.document, sampleRows: t.sampleRows || [] });
  }
  return list
    .filter(t => t.number >= from && t.number <= to && (!only || only.includes(t.slug)) && (!familyOnly || t.family === familyOnly))
    .sort((a, b) => a.number - b.number || a.slug.localeCompare(b.slug));
}

const builtin = JSON.parse(fs.readFileSync(path.join(wwwroot, 'builtin', 'builtin.json'), 'utf8'));
const builtinFile = new Map(builtin.map(a => [a.key.toLowerCase(), a.file]));
const fontList = JSON.parse(fs.readFileSync(path.join(wwwroot, 'fonts', 'fonts.json'), 'utf8'))
  .map(f => ({ family: f.family, weight: f.weight, style: f.style, url: '/fonts/' + f.file }));
const types = { '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.woff': 'font/woff', '.otf': 'font/otf', '.html': 'text/html', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
const page = '<!doctype html><meta charset="utf-8"><title>sheet</title><body><script src="/js/dt-engine.js"></script>';

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const send = (status, body, type) => { res.writeHead(status, { 'Content-Type': type || 'text/plain', 'Cache-Control': 'no-store' }); res.end(body); };
  const sendFile = file => fs.existsSync(file) && fs.statSync(file).isFile() ? send(200, fs.readFileSync(file), types[path.extname(file)] || 'application/octet-stream') : send(404, 'not found');
  if (url.pathname === '/') return send(200, page, 'text/html');
  if (url.pathname.startsWith('/js/') || url.pathname.startsWith('/lib/') || url.pathname.startsWith('/fonts/')) return sendFile(path.join(wwwroot, path.normalize(url.pathname).replace(/^([\\/])+/, '')));
  if (url.pathname.startsWith('/media/')) {
    const file = builtinFile.get(decodeURIComponent(url.pathname.slice(7)).toLowerCase());
    return file ? sendFile(path.join(wwwroot, 'builtin', file)) : send(404, 'no such medium');
  }
  return send(404, 'not found');
});

(async () => {
  const templates = loadTemplates();
  if (!templates.length) { console.log('No template in this range (run node tools/templates-build.js first).'); process.exit(0); }
  fs.mkdirSync(outDir, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try { browser = await chromium.launch({ channel: 'msedge' }); } catch (e) { browser = await chromium.launch(); }
  const context = await browser.newContext({ locale: 'de-DE', viewport: { width: 1200, height: 900 } });
  const tab = await context.newPage();
  tab.on('pageerror', e => console.log('page error: ' + e.message));
  await tab.goto(base + '/');
  await tab.waitForFunction(() => !!window.DtEngine);

  let warnings = 0;
  const written = [];
  for (let start = 0, sheetNo = 1; start < templates.length; start += perSheet, sheetNo++) {
    const batch = templates.slice(start, start + perSheet);
    const result = await tab.evaluate(async ({ batch_, fonts, thumb_, width_, rows_ }) => {
      const engine = window.DtEngine;
      const icons_ = (await (await fetch('/lib/icons.json')).json()).icons;
      const warns = [];
      const load = src => new Promise(resolve => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => resolve(null); im.src = src; });
      const toUrl = blob => new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(blob); });
      const cards = [];
      for (const t of batch_) {
        const doc = engine.normalize(t.document);
        const samples = engine.sampleValues(doc);
        const images = [];
        const side = doc.width >= doc.height ? thumb_ : thumb_ * doc.width / doc.height;
        const shoot = async (p, values) => load(await toUrl(await engine.rasterize(doc, values, {
          page: p, maxWidth: Math.round(side * 1.5), fonts, mode: 'output', assetUrl: key => '/media/' + encodeURIComponent(key), icon: name => (icons_[name] ? icons_[name].b : null),
          onWarning: (m, id) => warns.push(t.slug + ': ' + m + (id ? ' [' + id + ']' : '')),
        })));
        for (let p = 0; p < doc.pages.length; p++) images.push({ im: await shoot(p, samples), label: doc.pages[p].name || '' });
        if (rows_) for (let r = 0; r < Math.min(2, t.sampleRows.length); r++) images.push({ im: await shoot(0, Object.assign({}, samples, t.sampleRows[r])), label: 'Zeile ' + (r + 1) });
        cards.push({ t, doc, images });
      }
      // layout: cards flow left to right; every page is scaled to fit in thumb x thumb
      const gap = 28;
      const labelH = 58;
      const scaled = cards.map(c => {
        const pages = c.images.map(i => { const k = Math.min(thumb_ / c.doc.width, thumb_ / c.doc.height) * (c.doc.width >= c.doc.height ? 1 : 1); const w = Math.round(c.doc.width * k); const h = Math.round(c.doc.height * k); return Object.assign({ w, h }, i); });
        return { c, pages, w: pages.reduce((n, p) => n + p.w, 0) + (pages.length - 1) * 10, h: Math.max(...pages.map(p => p.h)) };
      });
      const lines = [];
      let line = { items: [], w: gap, h: 0 };
      scaled.forEach(s => {
        const need = Math.max(s.w, 230) + gap;
        if (line.items.length && line.w + need > width_) { lines.push(line); line = { items: [], w: gap, h: 0 }; }
        line.items.push(s);
        line.w += need;
        line.h = Math.max(line.h, s.h);
      });
      lines.push(line);
      const height = lines.reduce((n, l) => n + l.h + labelH + gap, gap);
      const canvas = document.createElement('canvas');
      canvas.width = width_;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#7d8793';
      ctx.fillRect(0, 0, width_, height);
      const fit = (t, w) => { let r = t; while (r.length > 4 && ctx.measureText(r).width > w) r = r.slice(0, -2); return r === t ? t : r.trimEnd() + '…'; };
      let y = gap;
      for (const l of lines) {
        let x = gap;
        for (const s of l.items) {
          let px = x;
          for (const p of s.pages) {
            if (p.im) ctx.drawImage(p.im, px, y + (l.h - p.h) / 2, p.w, p.h);
            if (s.c.doc.fold && s.c.doc.fold !== 'none' && p.im) {
              ctx.save();
              ctx.strokeStyle = 'rgba(30,30,30,.55)';
              ctx.setLineDash([5, 4]);
              ctx.beginPath();
              const top = y + (l.h - p.h) / 2;
              if (s.c.doc.fold === 'vertical') { ctx.moveTo(px + p.w / 2, top); ctx.lineTo(px + p.w / 2, top + p.h); } else { ctx.moveTo(px, top + p.h / 2); ctx.lineTo(px + p.w, top + p.h / 2); }
              ctx.stroke();
              ctx.restore();
            }
            px += p.w + 10;
          }
          const ly = y + l.h + 8;
          ctx.fillStyle = '#ffffff';
          ctx.font = '600 15px sans-serif';
          const label = s.c.t.number + '  ' + s.c.t.slug;
          ctx.fillText(fit(label, Math.max(s.w, 230)), x, ly + 14);
          ctx.font = '13px sans-serif';
          ctx.fillStyle = '#e8ecf0';
          const second = (s.c.t.family ? s.c.t.family + ' / ' + s.c.t.variant : s.c.t.name) + '  ·  ' + Math.round(s.c.doc.width * 10) / 10 + ' x ' + Math.round(s.c.doc.height * 10) / 10 + ' ' + s.c.doc.unit + (s.c.doc.fold && s.c.doc.fold !== 'none' ? ' · Falz' : '');
          ctx.fillText(fit(second, Math.max(s.w, 230)), x, ly + 32);
          x += Math.max(s.w, 230) + gap;
        }
        y += l.h + labelH + gap;
      }
      return { png: canvas.toDataURL('image/png'), warns: Array.from(new Set(warns)) };
    }, { batch_: batch.map(t => ({ slug: t.slug, number: t.number, name: t.name, family: t.family, variant: t.variant, document: t.document, sampleRows: t.sampleRows })), fonts: fontList, thumb_: thumb, width_: sheetWidth, rows_: withRows });
    const many = templates.length > perSheet;
    const file = path.join(outDir, many ? `${outBase}-${sheetNo}.png` : `${outBase}.png`);
    fs.writeFileSync(file, Buffer.from(result.png.split(',')[1], 'base64'));
    written.push(file);
    console.log(`${file}  (${batch.length} templates: ${batch[0].number} to ${batch[batch.length - 1].number})`);
    for (const w of result.warns) { warnings++; console.log('   WARNING ' + w); }
  }
  await browser.close();
  server.close();
  process.exit(warnings ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
