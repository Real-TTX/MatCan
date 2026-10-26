#!/usr/bin/env node
/* Quality lint of the built-in templates (plan 6, T5): measures every page of every template in a real browser (Playwright + Edge, like templates-preview.js: no app needed,
   a tiny local server hands out the engine, fonts, built-in media and icons) and reports what a person would find wrong at the physical size.

   node tools/templates-lint.js [--from N --to M] [--only slug,slug] [--family slug] [--warnings] [--json file]

   Rules (an ERROR makes the exit code 1, a WARNING is only printed with --warnings):
     size       the font size the engine really uses (after shrink to fit, with the sample values AND with every sample row) is at least 7 pt at the physical size,
                8 pt in the occasion "Formulare & Planer" (handwriting forms), in screen documents (px) at least 15 pt (20 px); error. A line that was shrunk by a LONG sample row is a warning.
     margin     the ink of a text (measured on a raster of the text alone) keeps the safe margin to the page edge: 4 mm for everything smaller than A4, 10 mm for A4 and larger
                (a screen document: 3.5 % of the shorter side); error when it is closer than the margin minus 0.5 mm, also with the sample rows. A folded card: the margin counts inside
                the panel (half of the open sheet) the text belongs to.
     fold       a text on a folded card crosses the fold line (a crease through letters); error.
     overflow   a text does not fit its box even at its smallest size (it would be cut or run out of the box); error.
     overlap    the ink of two texts overlaps (a pair with the same text, a drop shadow made of a copy, is left out); error.
     engine     any warning of the engine (missing medium, unknown icon, invalid code, unknown placeholder or font); error.
     bleed      a shape, line or picture that is not a full-page background sticks out of the page by more than 3 mm: it shows outside the page in the editor; warning
                (a decoration that is meant to bleed is clipped by every output, but the editor shows it).
   Playwright comes from tests/e2e/node_modules.                                                                                                                           */
'use strict';
const fs = require('fs');
const http = require('http');
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
const showWarnings = args.includes('--warnings');
const jsonOut = argValue('--json', '');

function loadTemplates() {
  const list = [];
  for (const file of fs.readdirSync(templatesDir).filter(f => f.endsWith('.json')).sort()) {
    const slug = file.replace(/\.json$/, '');
    const t = JSON.parse(fs.readFileSync(path.join(templatesDir, file), 'utf8'));
    list.push({ slug, number: t.number || 0, name: t.name, family: t.family || '', occasion: t.occasion || '', formatKey: t.formatKey || '', document: t.document, sampleRows: t.sampleRows || [] });
  }
  return list
    .filter(t => t.number >= from && t.number <= to && (!only || only.includes(t.slug)) && (!familyOnly || t.family === familyOnly))
    .sort((a, b) => a.number - b.number || a.slug.localeCompare(b.slug));
}

const builtin = JSON.parse(fs.readFileSync(path.join(wwwroot, 'builtin', 'builtin.json'), 'utf8'));
const builtinFile = new Map(builtin.map(a => [a.key.toLowerCase(), a.file]));
const fontList = JSON.parse(fs.readFileSync(path.join(wwwroot, 'fonts', 'fonts.json'), 'utf8')).map(f => ({ family: f.family, weight: f.weight, style: f.style, url: '/fonts/' + f.file }));
const types = { '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.woff': 'font/woff', '.otf': 'font/otf', '.html': 'text/html' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const send = (status, body, type) => { res.writeHead(status, { 'Content-Type': type || 'text/plain', 'Cache-Control': 'no-store' }); res.end(body); };
  const sendFile = file => fs.existsSync(file) && fs.statSync(file).isFile() ? send(200, fs.readFileSync(file), types[path.extname(file)] || 'application/octet-stream') : send(404, 'not found');
  if (url.pathname === '/') return send(200, '<!doctype html><meta charset="utf-8"><body><script src="/js/dt-engine.js"></script>', 'text/html');
  if (url.pathname.startsWith('/js/') || url.pathname.startsWith('/lib/') || url.pathname.startsWith('/fonts/')) return sendFile(path.join(wwwroot, path.normalize(url.pathname).replace(/^([\\/])+/, '')));
  if (url.pathname.startsWith('/media/')) {
    const file = builtinFile.get(decodeURIComponent(url.pathname.slice(7)).toLowerCase());
    return file ? sendFile(path.join(wwwroot, 'builtin', file)) : send(404, 'no such medium');
  }
  return send(404, 'not found');
});

/** Runs in the page: the findings of one template. */
async function lintTemplate({ t, fonts }) {
  const engine = window.DtEngine;
  const icons = (window.__icons || (window.__icons = (await (await fetch('/lib/icons.json')).json()).icons));
  const doc = engine.normalize(t.document);
  const unitMm = doc.unit === 'mm';
  const findings = [];
  const add = (sev, rule, msg) => findings.push({ sev, rule, msg });
  const samples = engine.sampleValues(doc);
  const px = unitMm ? Math.min(6, 1800 / Math.max(doc.width, doc.height)) : Math.min(1, 1800 / Math.max(doc.width, doc.height));   // raster pixels per document unit: below about 4 px per mm the advances of small type are rounded and the ink is up to 15 % too wide
  const area = doc.width * doc.height;
  const fold = doc.fold || 'none';
  const forms = t.occasion === 'Formulare & Planer';
  const minPt = unitMm ? (forms ? 8 : 7) : 15;
  const bigPage = unitMm && area >= 56000;                       // A4 and larger (A4 = 62 370 mm2); a folded card is judged by its panel
  const warnings = [];
  const opts = (pageIndex, extra) => Object.assign({
    page: pageIndex, fonts, mode: 'output', assetUrl: key => '/media/' + encodeURIComponent(key), icon: name => (icons[name] ? icons[name].b : null),
    onWarning: (m, id) => warnings.push(m + (id ? ' [' + id + ']' : '')),
  }, extra || {});

  const flatten = (list, chain, out) => {
    for (const e of list) {
      if (e.type === 'group') flatten(e.children || [], chain.concat([e]), out);
      else out.push({ e, chain });
    }
    return out;
  };
  const hideAllBut = (elements, keepId) => elements.map(e => {
    if (e.type === 'group') {
      const children = hideAllBut(e.children || [], keepId);
      const keep = children.some(c => !c.hidden);
      return Object.assign({}, e, { children, hidden: !keep });
    }
    return Object.assign({}, e, { hidden: e.id !== keepId });
  });
  const inkOf = async (pageIndex, element, values) => {
    const single = Object.assign({}, doc, { pages: doc.pages.map((p, i) => i === pageIndex ? Object.assign({}, p, { background: { color: null, gradient: null, asset: null, fit: 'cover' }, elements: hideAllBut(p.elements, element.id) }) : p) });
    const blob = await engine.rasterize(single, values, opts(pageIndex, { maxWidth: Math.round(doc.width * px), background: false }));
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const mask = new Uint8Array(canvas.width * canvas.height);
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        if (data[(y * canvas.width + x) * 4 + 3] > 40) { mask[y * canvas.width + x] = 1; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
    }
    const k = canvas.width / doc.width;
    return { mask, w: canvas.width, h: canvas.height, box: x1 < 0 ? null : [x0 / k, y0 / k, (x1 + 1) / k, (y1 + 1) / k] };
  };

  const panelsOf = () => {
    if (fold === 'vertical') return [{ x: 0, y: 0, w: doc.width / 2, h: doc.height }, { x: doc.width / 2, y: 0, w: doc.width / 2, h: doc.height }];
    if (fold === 'horizontal') return [{ x: 0, y: 0, w: doc.width, h: doc.height / 2 }, { x: 0, y: doc.height / 2, w: doc.width, h: doc.height / 2 }];
    return [{ x: 0, y: 0, w: doc.width, h: doc.height }];
  };
  const panels = panelsOf();
  const marginFor = panel => {
    if (!unitMm) return 0.035 * Math.min(doc.width, doc.height);
    if (t.formatKey === 'tearoff-a4') return 5;                          // the strips run to the edge of the sheet: 5 mm is what a home printer keeps free
    return panel.w * panel.h >= 56000 ? 10 : 4;
  };
  const resolveOf = (e, values) => {
    const resolved = engine.resolveText(e.text, doc.fields, values, doc.locale, 'empty');
    return e.uppercase ? resolved.toLocaleUpperCase(doc.locale) : resolved;
  };
  const layoutOf = (e, text) => {
    if (e.curve) return engine.layoutText({ text: text.replace(/\s*[\r\n]+\s*/g, ' '), fontFamily: e.fontFamily, fontSize: e.fontSize, fontWeight: e.fontWeight, italic: e.italic, letterSpacing: e.letterSpacing, lineHeight: e.lineHeight, wrap: false, fit: e.fit, minFontSize: e.minFontSize, width: e.w, height: e.h, unit: doc.unit });
    return engine.layoutText({ text, fontFamily: e.fontFamily, fontSize: e.fontSize, fontWeight: e.fontWeight, italic: e.italic, letterSpacing: e.letterSpacing, lineHeight: e.lineHeight, wrap: e.wrap, fit: e.fit, minFontSize: e.minFontSize, width: e.w, height: e.h, unit: doc.unit, indent: e.list === 'bullet' ? 1.1 : (e.list === 'number' ? 1.7 : 0) });
  };
  const fmt = n => Math.round(n * 10) / 10;
  const seen = new Set();
  const once = (key, sev, rule, msg) => { if (seen.has(key)) return; seen.add(key); add(sev, rule, msg); };

  // fonts are loaded by the first render
  await engine.rasterize(doc, samples, opts(0, { maxWidth: 40 }));

  const rowsValues = [{ label: 'Beispiel', values: samples, rowIndex: -1 }].concat(t.sampleRows.map((r, i) => ({ label: 'Zeile ' + (i + 1), values: Object.assign({}, samples, r), rowIndex: i })));

  for (let pi = 0; pi < doc.pages.length; pi++) {
    const pageName = doc.pages.length > 1 ? ' (Seite ' + (pi + 1) + ')' : '';
    const texts = flatten(doc.pages[pi].elements, [], []).filter(x => x.e.type === 'text' && !x.e.hidden);

    // sizes and fit, with the samples and with every sample row
    for (const rv of rowsValues) {
      for (const { e } of texts) {
        if (e.showIf && engine.resolveText('{{' + e.showIf + '}}', doc.fields, rv.values, doc.locale, 'empty').trim() === '') continue;
        const text = resolveOf(e, rv.values);
        if (text.trim() === '') continue;
        const layout = layoutOf(e, text);
        const where = `"${e.name}"${pageName}` + (rv.rowIndex >= 0 ? ' mit ' + rv.label : '');
        if (layout.fontSizePt < minPt - 0.01) {
          const designed = e.fontSize < minPt - 0.01;
          once('size:' + e.id + (designed ? '' : ':' + rv.rowIndex), rv.rowIndex >= 0 && !designed ? 'warning' : 'error', 'size',
            `${where}: ${fmt(layout.fontSizePt)} pt (soll ${fmt(e.fontSize)} pt, Minimum ${minPt} pt)`);
        }
        if (!layout.fits && rv.rowIndex < 0) once('fit:' + e.id, 'error', 'overflow', `${where}: passt auch klein nicht in sein Feld (${fmt(e.w)} x ${fmt(e.h)} ${doc.unit}, ${layout.lines.length} Zeilen bei ${fmt(layout.fontSizePt)} pt, braucht ${fmt(layout.width)} x ${fmt(layout.height)}, valign ${e.valign})`);
        else if (!layout.fits) once('fitrow:' + e.id, 'warning', 'overflow', `${where}: passt nicht in sein Feld`);
      }
    }

    // ink: margin, fold, overlap
    for (const rv of rowsValues) {
      const inks = [];
      const rowTexts = texts.filter(({ e }) => rv.rowIndex < 0 || /\{\{/.test(e.text));
      for (const { e } of rowTexts) {
        if (e.showIf && engine.resolveText('{{' + e.showIf + '}}', doc.fields, rv.values, doc.locale, 'empty').trim() === '') continue;
        const text = resolveOf(e, rv.values);
        if (text.trim() === '') continue;
        const ink = await inkOf(pi, e, rv.values);
        if (!ink.box) continue;
        // a value that does not fit its box at the smallest size (a stress row of the sample data) is told as an overflow warning; what follows from it is a warning too
        inks.push({ e, ink, text, stress: rv.rowIndex >= 0 && !layoutOf(e, text).fits });
      }
      for (const { e, ink, stress } of inks) {
        const [bx0, by0, bx1, by1] = ink.box;
        const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
        const panel = panels.find(p => cx >= p.x && cx <= p.x + p.w && cy >= p.y && cy <= p.y + p.h) || panels[0];
        const margin = marginFor(panel);
        const where = `"${e.name}"${pageName}` + (rv.rowIndex >= 0 ? ' mit ' + rv.label : '');
        const left = bx0 - panel.x, right = panel.x + panel.w - bx1, top = by0 - panel.y, bottom = panel.y + panel.h - by1;
        const worst = Math.min(left, right, top, bottom);
        // an edge of a panel that lies on the fold: the margin is measured to the fold too
        if (worst < margin - 0.5) {
          const side = worst === left ? 'links' : worst === right ? 'rechts' : worst === top ? 'oben' : 'unten';
          once('margin:' + e.id + (rv.rowIndex >= 0 ? ':row' : ''), stress ? 'warning' : 'error', 'margin', `${where}: nur ${fmt(worst)} ${doc.unit} ${side} bis zum Rand (${fold !== 'none' ? 'Feld' : 'Seite'}), gefordert ${fmt(margin)}`);
        }
        if (fold === 'vertical' && bx0 < doc.width / 2 - 0.3 && bx1 > doc.width / 2 + 0.3) once('fold:' + e.id, 'error', 'fold', `${where}: liegt über dem Falz`);
        if (fold === 'horizontal' && by0 < doc.height / 2 - 0.3 && by1 > doc.height / 2 + 0.3) once('fold:' + e.id, 'error', 'fold', `${where}: liegt über dem Falz`);
      }
      for (let i = 0; i < inks.length; i++) {
        for (let j = i + 1; j < inks.length; j++) {
          const a = inks[i], b = inks[j];
          if (a.text === b.text) continue;
          if (a.ink.box[2] <= b.ink.box[0] || b.ink.box[2] <= a.ink.box[0] || a.ink.box[3] <= b.ink.box[1] || b.ink.box[3] <= a.ink.box[1]) continue;
          let hit = 0;
          const m = a.ink.mask, n = b.ink.mask;
          for (let k = 0; k < m.length; k++) if (m[k] && n[k]) hit++;
          if (hit >= Math.max(4, px * px * 0.3)) once('ov:' + a.e.id + ':' + b.e.id, a.stress || b.stress ? 'warning' : 'error', 'overlap', `"${a.e.name}" und "${b.e.name}"${pageName}${rv.rowIndex >= 0 ? ' mit ' + rv.label : ''}: die Schrift überlappt (${fmt(hit / (px * px))} ${doc.unit}2)`);
        }
      }
    }

    // bleed: shapes and pictures that stick out of the page
    const all = flatten(doc.pages[pi].elements, [], []).filter(x => x.e.type !== 'text' && !x.e.hidden);
    for (const { e, chain } of all) {
      if (chain.some(g => g.rotation)) continue;
      const rad = (e.rotation || 0) * Math.PI / 180;
      const hw = (Math.abs(e.w * Math.cos(rad)) + Math.abs(e.h * Math.sin(rad))) / 2;
      const hh = (Math.abs(e.w * Math.sin(rad)) + Math.abs(e.h * Math.cos(rad))) / 2;
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
      const over = Math.max(0 - (cx - hw), (cx + hw) - doc.width, 0 - (cy - hh), (cy + hh) - doc.height);
      const slack = unitMm ? 3 : 12;
      if (over > slack) {
        // a full-page background (covers the page) is no decoration that sticks out
        const covers = e.x <= 0.5 && e.y <= 0.5 && e.x + e.w >= doc.width - 0.5 && e.y + e.h >= doc.height - 0.5;
        if (!covers) once('bleed:' + e.id, 'warning', 'bleed', `"${e.name}"${pageName}: ragt ${fmt(over)} ${doc.unit} über die Seite hinaus`);
      }
    }

    // the engine's own warnings for the whole page (with the sample values and the first rows)
    for (const rv of rowsValues.slice(0, 2)) await engine.rasterize(doc, rv.values, opts(pi, { maxWidth: 60 }));
  }
  for (const w of new Set(warnings)) add('error', 'engine', w);
  return findings;
}

(async () => {
  const templates = loadTemplates();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try { browser = await chromium.launch({ channel: 'msedge' }); } catch (e) { browser = await chromium.launch(); }
  const context = await browser.newContext({ locale: 'de-DE', viewport: { width: 1200, height: 900 } });
  const tab = await context.newPage();
  tab.on('pageerror', e => console.log('page error: ' + e.message));
  await tab.goto(base + '/');
  await tab.waitForFunction(() => !!window.DtEngine);
  const totals = {};
  const report = {};
  let errors = 0, warnings = 0;
  const begin = Date.now();
  for (const t of templates) {
    let findings;
    try { findings = await tab.evaluate(lintTemplate, { t: { slug: t.slug, occasion: t.occasion, formatKey: t.formatKey, document: t.document, sampleRows: t.sampleRows }, fonts: fontList }); }
    catch (e) { findings = [{ sev: 'error', rule: 'lint', msg: 'Messung fehlgeschlagen: ' + e.message.split('\n')[0] }]; }
    report[t.slug] = findings;
    const shown = findings.filter(f => f.sev === 'error' || showWarnings);
    for (const f of findings) { totals[f.sev + ' ' + f.rule] = (totals[f.sev + ' ' + f.rule] || 0) + 1; if (f.sev === 'error') errors++; else warnings++; }
    if (shown.length) {
      console.log(`${t.number} ${t.slug}`);
      for (const f of shown) console.log(`   ${f.sev === 'error' ? 'ERROR' : 'warn '} ${f.rule.padEnd(8)} ${f.msg}`);
    }
  }
  console.log(`\n${templates.length} templates, ${errors} errors, ${warnings} warnings (${Math.round((Date.now() - begin) / 1000)} s)`);
  for (const k of Object.keys(totals).sort()) console.log('  ' + k.padEnd(18) + totals[k]);
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(report, null, 1));
  await browser.close();
  server.close();
  process.exit(errors ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
