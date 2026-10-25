#!/usr/bin/env node
/* Renders every page of every built-in template (src/DesignThix/Demo/templates/*.json and the Käsetheke demo) to PNG with the render engine in a real browser
   (Playwright + the installed Edge), so the templates can be LOOKED at. It needs no running app: a tiny local server hands out the engine, the bundled fonts,
   the built-in flags and seals and the icon library straight from src/DesignThix/wwwroot.

   node tools/templates-preview.js [--out <folder>] [--only slug,slug] [--rows] [--editor] [--width 1100]
     --out     where the PNG files go (default: <temp>/designthix-templates); file names  <slug>-p<page>[-r<row>].png
     --only    only these slugs (file names without .json; "kaesetheke" is the demo)
     --rows    also one image per sample row (the first page only), to see long names and empty values
     --editor  draw like the editor (dashed placeholders for empty image frames, unknown icons, invalid codes)
     --width   width of the images in pixels (default 1100)
     --sheet N one contact sheet per template with N columns instead of single images (<slug>-sheet.png)
   Every warning of the engine (missing asset, unknown icon, invalid code, unknown placeholder) is printed; the exit code is 1 when there is one.
   Playwright comes from tests/e2e/node_modules (cd tests/e2e && npm install). */
'use strict';
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const wwwroot = path.join(root, 'src', 'DesignThix', 'wwwroot');
const demoDir = path.join(root, 'src', 'DesignThix', 'Demo');
const { chromium } = require(path.join(root, 'tests', 'e2e', 'node_modules', 'playwright'));

const args = process.argv.slice(2);
const argValue = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const out = path.resolve(argValue('--out', path.join(os.tmpdir(), 'designthix-templates')));
const only = argValue('--only', '') ? argValue('--only', '').split(',') : null;
const withRows = args.includes('--rows');
const editor = args.includes('--editor');
const width = Number(argValue('--width', '1100'));
const sheetColumns = Number(argValue('--sheet', '0'));

/** The templates: the files of Demo/templates plus the demo of the Käsetheke. */
function loadTemplates() {
  const list = [];
  const demo = JSON.parse(fs.readFileSync(path.join(demoDir, 'kaesetheke.json'), 'utf8'));
  list.push({ slug: 'kaesetheke', name: demo.design.name, document: demo.document, sampleRows: demo.rows.slice(0, 4) });
  const dir = path.join(demoDir, 'templates');
  if (fs.existsSync(dir)) {
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
      const t = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      list.push({ slug: file.replace(/\.json$/, ''), name: t.name, document: t.document, sampleRows: t.sampleRows || [] });
    }
  }
  return list.filter(t => !only || only.includes(t.slug));
}

const builtin = JSON.parse(fs.readFileSync(path.join(wwwroot, 'builtin', 'builtin.json'), 'utf8'));
const builtinFile = new Map(builtin.map(a => [a.key.toLowerCase(), a.file]));
const fontList = JSON.parse(fs.readFileSync(path.join(wwwroot, 'fonts', 'fonts.json'), 'utf8'))
  .map(f => ({ family: f.family, weight: f.weight, style: f.style, url: '/fonts/' + f.file }));

const types = { '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf', '.html': 'text/html', '.webp': 'image/webp', '.jpg': 'image/jpeg' };

const page = `<!doctype html><meta charset="utf-8"><title>templates</title><body><script src="/js/dt-engine.js"></script>`;

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
  fs.mkdirSync(out, { recursive: true });
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
  for (const t of templates) {
    const result = await tab.evaluate(async ({ document_, rows, fonts, withRows_, editor_, width_ }) => {
      const engine = window.DtEngine;
      const icons_ = (await (await fetch('/lib/icons.json')).json()).icons;
      const doc = engine.normalize(document_);
      const warns = [];
      const blobToUrl = blob => new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(blob); });
      const shoot = async (page, values) => blobToUrl(await engine.rasterize(doc, values, {
        page, maxWidth: width_, fonts, mode: editor_ ? 'editor' : 'output',
        assetUrl: key => '/media/' + encodeURIComponent(key),
        icon: name => (icons_[name] ? icons_[name].b : null),
        onWarning: (m, id) => warns.push(m + (id ? ' [' + id + ']' : '')),
      }));
      const samples = engine.sampleValues(doc);
      const images = [];
      for (let p = 0; p < doc.pages.length; p++) images.push({ name: 'p' + (p + 1), data: await shoot(p, samples) });
      if (withRows_) {
        for (let r = 0; r < rows.length; r++) images.push({ name: 'p1-r' + (r + 1), data: await shoot(0, Object.assign({}, samples, rows[r])) });
      }
      return { images, warns: Array.from(new Set(warns)), pages: doc.pages.length, size: doc.width + ' x ' + doc.height + ' ' + doc.unit };
    }, { document_: t.document, rows: t.sampleRows, fonts: fontList, withRows_: withRows, editor_: editor, width_: width });
    if (sheetColumns > 0) {
      const sheet = await tab.evaluate(async ({ images, columns }) => {
        const loaded = await Promise.all(images.map(i => new Promise(resolve => { const im = new Image(); im.onload = () => resolve(im); im.src = i.data; })));
        const gap = 24;
        const cellW = Math.max(...loaded.map(i => i.width));
        const rowsCount = Math.ceil(loaded.length / columns);
        const rowH = [];
        for (let r = 0; r < rowsCount; r++) rowH.push(Math.max(...loaded.slice(r * columns, r * columns + columns).map(i => i.height)));
        const canvas = document.createElement('canvas');
        canvas.width = columns * cellW + (columns + 1) * gap;
        canvas.height = rowH.reduce((a, b) => a + b, 0) + (rowsCount + 1) * gap;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#8b94a0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        let y = gap;
        for (let r = 0; r < rowsCount; r++) {
          loaded.slice(r * columns, r * columns + columns).forEach((im, c) => ctx.drawImage(im, gap + c * (cellW + gap), y));
          y += rowH[r] + gap;
        }
        return canvas.toDataURL('image/png');
      }, { images: result.images, columns: sheetColumns });
      fs.writeFileSync(path.join(out, `${t.slug}-sheet.png`), Buffer.from(sheet.split(',')[1], 'base64'));
    } else for (const image of result.images) {
      const file = path.join(out, `${t.slug}-${image.name}.png`);
      fs.writeFileSync(file, Buffer.from(image.data.split(',')[1], 'base64'));
    }
    console.log(`${t.slug.padEnd(16)} ${result.size}, ${result.pages} page(s), ${result.images.length} image(s)`);
    for (const w of result.warns) { warnings++; console.log('   WARNING ' + w); }
  }
  console.log('Images in ' + out);
  await browser.close();
  server.close();
  process.exit(warnings ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
