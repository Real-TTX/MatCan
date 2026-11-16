#!/usr/bin/env node
'use strict';
/* Lists the Deko pack for the template authors: keys by group with the viewBox size and aspect; the colour variants of one drawing are on one line.
   node tools/deko/list.js [--group Rahmen] */
const fs = require('fs');
const path = require('path');

const wwwroot = path.join(__dirname, '..', '..', 'src', 'MatCan', 'wwwroot');
const args = process.argv.slice(2);
const only = args.includes('--group') ? args[args.indexOf('--group') + 1].toLowerCase() : null;
const entries = JSON.parse(fs.readFileSync(path.join(wwwroot, 'builtin', 'builtin.json'), 'utf8')).filter((e) => e.category === 'Deko');
const COLOURS = ['gold', 'rose', 'salbei', 'navy', 'schwarz', 'weiss', 'bordeaux', 'bunt', 'pastell', 'herbst', 'boho'];

const drawings = new Map();
for (const e of entries) {
  const [group, rest] = e.name.split(' · ');
  if (only && group.toLowerCase() !== only) continue;
  const svg = fs.readFileSync(path.join(wwwroot, 'builtin', e.file), 'utf8');
  const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  const w = Number(m[1]), h = Number(m[2]);
  const hasColour = /\([^)]+\)$/.test(rest);
  const tail = e.key.slice(e.key.lastIndexOf('-') + 1);
  const colour = hasColour && COLOURS.includes(tail) ? tail : '';
  const stem = colour ? e.key.slice(0, e.key.length - colour.length - 1) : e.key;
  const id = group + '|' + stem;
  if (!drawings.has(id)) drawings.set(id, { group, stem, w, h, colours: [] });
  drawings.get(id).colours.push(colour);
}
let lastGroup = '', total = 0, distinct = 0;
for (const d of drawings.values()) {
  if (d.group !== lastGroup) { console.log(`\n${d.group}`); lastGroup = d.group; }
  const colours = d.colours.filter(Boolean);
  console.log(`  ${d.stem}${colours.length ? '-{' + colours.join(',') + '}' : ''}   ${d.w}x${d.h}  (${(d.w / d.h).toFixed(2)})`);
  total += d.colours.length; distinct++;
}
console.log(`\n${total} entries, ${distinct} drawings`);
