#!/usr/bin/env node
'use strict';
/* Contact sheets of the Deko pack, to LOOK at the drawings (Playwright + the installed Edge, no app needed).
   node tools/deko/sheet.js [--group Rahmen] [--key text] [--out <folder>] [--cols 6] [--cell 260] [--cellh 260] [--split] [--first] [--name file]
     --group  only this group (name as in builtin.json: Rahmen, Ornamente, "Blumen & Blätter" ...);  --key  only keys that contain the text
     --cell   size of one cell in pixels (use --cell 800 --cols 1 to check detail);  --split  one PNG per group (and a dark sheet for the white pieces)
   White pieces are shown on a dark navy ground, everything else on a grey-beige ground. */
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const wwwroot = path.join(root, 'src', 'DesignThix', 'wwwroot');
const { chromium } = require(path.join(root, 'tests', 'e2e', 'node_modules', 'playwright'));
const args = process.argv.slice(2);
const val = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const out = path.resolve(val('--out', path.join(os.tmpdir(), 'deko-sheets')));
const group = val('--group', null);
const keyPart = val('--key', null);
const cols = Number(val('--cols', 6));
const cell = Number(val('--cell', 260));
const cellH = Number(val('--cellh', cell));
const split = args.includes('--split');
const fileName = val('--name', null);

let entries = JSON.parse(fs.readFileSync(path.join(wwwroot, 'builtin', 'builtin.json'), 'utf8')).filter((e) => e.category === 'Deko');
if (group) entries = entries.filter((e) => e.name.split(' · ')[0].toLowerCase() === group.toLowerCase());
if (args.includes('--first')) { const seen = new Set(); entries = entries.filter((e) => { const stem = e.key.replace(/-(gold|rose|salbei|navy|schwarz|weiss|bordeaux|bunt|pastell|herbst|boho)$/, ''); if (seen.has(stem)) return false; seen.add(stem); return true; }); }
if (keyPart) entries = entries.filter((e) => e.key.includes(keyPart));

function page(list) {
  const cells = list.map((e) => {
    const dark = /-weiss$/.test(e.key);
    const url = 'file:///' + path.join(wwwroot, 'builtin', e.file).replace(/\\/g, '/');
    return `<div class="c ${dark ? 'd' : ''}"><div class="i"><img src="${url}"></div><div class="l">${e.key.replace('deko-', '')}</div></div>`;
  }).join('');
  return `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#d9d3c7;font:11px Segoe UI,sans-serif;color:#333}
.g{display:grid;grid-template-columns:repeat(${cols},${cell}px);gap:10px;padding:10px;width:max-content}
.c{background:#ece6da;border-radius:4px;padding:6px}.c.d{background:#16213f;color:#ccd}
.i{width:${cell - 12}px;height:${cellH - 12}px;display:flex;align-items:center;justify-content:center}
.i img{max-width:100%;max-height:100%;display:block}.l{height:14px;overflow:hidden;white-space:nowrap;text-align:center}
</style><body><div class="g">${cells}</div>`;
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  let browser;
  try { browser = await chromium.launch({ channel: 'msedge' }); } catch (e) { browser = await chromium.launch(); }
  const tab = await browser.newPage({ viewport: { width: cols * (cell + 10) + 20, height: 800 } });
  const shoot = async (list, name) => {
    if (!list.length) return;
    const file = path.join(out, name + '.html');
    fs.writeFileSync(file, page(list));
    await tab.goto('file:///' + file.replace(/\\/g, '/'));
    await tab.waitForLoadState('load');
    await tab.waitForTimeout(150);
    await tab.screenshot({ path: path.join(out, name + '.png'), fullPage: true });
    fs.unlinkSync(file);
    console.log(path.join(out, name + '.png'), list.length);
  };
  const slugOf = (s) => s.toLowerCase().replace(/ & /g, '-').replace(/ä/g, 'ae').replace(/[^a-z0-9-]/g, '');
  if (split) {
    const names = [...new Set(entries.map((e) => e.name.split(' · ')[0]))];
    for (const n of names) {
      const list = entries.filter((e) => e.name.split(' · ')[0] === n);
      await shoot(list.filter((e) => !/-weiss$/.test(e.key)), slugOf(n) + '-light');
      await shoot(list.filter((e) => /-weiss$/.test(e.key)), slugOf(n) + '-dark');
    }
  } else {
    await shoot(entries, fileName || (group ? slugOf(group) : 'all'));
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(2); });
