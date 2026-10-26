#!/usr/bin/env node
'use strict';
/* Builds the Deko pack: src/DesignThix/wwwroot/builtin/deko/*.svg, its LICENSE.txt and the entries (category "Deko") of builtin/builtin.json.

   node tools/deko/build.js          writes everything (deterministic: running it twice gives the same bytes)
   node tools/deko/list.js           lists what exists;   node tools/deko/sheet.js   draws contact sheets (to LOOK at the result)

   HOW TO ADD A PIECE
   1. Open the file of the group (tools/deko/g-<group>.js) and add an object to its `pieces` list:
        { slug: 'goldene-ranke', name: 'Goldene Ranke', w: 1000, h: 1414, palettes: MONO6, tags: ['Ranke', 'Hochzeit'],
          draw(c) { ... return '<path .../>...'; } }
      slug   lower case, a-z 0-9 and "-"; the key becomes  deko-<group>-<slug>[-<colour>]  (at most 64 characters)
      name   the part after "Group · " (the group comes from the file); the colour is added as " (Gold)" when there is more than one variant
      w, h   the size of the viewBox (and of width/height: the aspect ratio is exact); a frame, a corner or a divider is drawn at its own ratio
      palettes  (ids of lib.PALETTES; tools/deko/palettes.js says which of them are really built)  ids of lib.PALETTES: gold rose salbei navy schwarz weiss bordeaux (one colour with tones) or bunt pastell herbst boho (several colours)
      tags   German search words (colour and group words are added by themselves)
      draw(c)  c.p = the palette (c.p.ink = the main paint, c.p.tones[0..2] dark to light, c.p.colors = list of colours to choose from),
               c.r = seeded random generator (seeded by the slug only: all colours of one piece have the SAME drawing), c.w / c.h, c.defs = array for <defs>.
               Return the SVG body as a string, built with lib.path / lib.circle / lib.g (they write the exact form SvgSafe writes: no whitespace,
               a self-closing element is written "<tag a="b" />"). No text, no style element, no filters, no external references.
   2. Run node tools/deko/build.js, then node tools/deko/sheet.js --group <Group> and look at the PNG; repeat until it looks like a designer drew it.
   3. dotnet test --filter DekoPack checks every file (SvgSafe leaves it unchanged, exact viewBox, keys, size of the folder).
   The generator owns every builtin.json entry of the category "Deko" (it re-reads the file, replaces those and keeps all others); tools/builtin.js keeps them too. */
const fs = require('fs');
const path = require('path');
const lib = require('./lib');
const PLAN = require('./palettes');

const wwwroot = path.join(__dirname, '..', '..', 'src', 'DesignThix', 'wwwroot');
const outDir = path.join(wwwroot, 'builtin', 'deko');
const listFile = path.join(wwwroot, 'builtin', 'builtin.json');

const GROUPS = ['rahmen', 'ornamente', 'blumen', 'konfetti', 'herzen', 'baender', 'trenner', 'ecken', 'muster', 'sterne', 'formen'];

// The group "Motive" (themed illustrations: racing car, crown, horse, guitar ...) is made of every file m-<batch>.js (each exports { pieces }),
// so several people can add motifs at the same time without touching one file; slugs must be unique across those files.
function loadMotive() {
  const files = fs.readdirSync(__dirname).filter((f) => /^m-[a-z0-9-]+\.js$/.test(f)).sort();
  if (!files.length) return null;
  const pieces = files.flatMap((f) => require(path.join(__dirname, f)).pieces || []);
  return { id: 'motive', name: 'Motive', slug: 'motive', tags: ['Motiv', 'Illustration'], pieces };
}

function loadGroups() {
  const groups = GROUPS.map((id) => {
    const file = path.join(__dirname, `g-${id}.js`);
    if (!fs.existsSync(file)) return null;
    return { id, ...require(file) };
  }).filter(Boolean);
  const motive = loadMotive();
  if (motive) groups.push(motive);
  return groups;
}

function render(group, piece, pal) {
  const defs = [];
  const c = { p: pal, r: lib.rng(`${group.id}/${piece.slug}`), w: piece.w, h: piece.h, defs, group, piece };
  lib.tracker.start();
  let body = piece.draw(c);
  const box = lib.tracker.stop();
  let w = piece.w, h = piece.h;
  if (piece.fit) {
    // fitted to the content: the viewBox is the bounding box plus the margin, the drawing is moved into it
    const pad = piece.fit === true ? 24 : piece.fit;
    w = Math.ceil(box.x1 - box.x0 + 2 * pad);
    h = Math.ceil(box.y1 - box.y0 + 2 * pad);
    body = lib.g({ transform: `translate(${lib.n(pad - box.x0, 1)} ${lib.n(pad - box.y0, 1)})` }, body);
  }
  piece.finalW = w; piece.finalH = h;
  if (!piece.fit && !piece.bleed && box && isFinite(box.x0) && (box.x0 < -1 || box.y0 < -1 || box.x1 > w + 1 || box.y1 > h + 1)) {
    const key = `${group.id}/${piece.slug}`;
    if (!render.warned.has(key)) { render.warned.add(key); console.log(`warning: ${key} draws outside its viewBox (${Math.round(box.x0)},${Math.round(box.y0)} to ${Math.round(box.x1)},${Math.round(box.y1)} in ${w} x ${h})`); }
  }
  if (pal.gradient && (body.includes('url(#g)') || defs.some((d) => d.includes('url(#g)')))) defs.unshift(lib.goldDefs(w, h));
  return lib.svgDoc(w, h, defs.join(''), body);
}

render.warned = new Set();

function main() {
  const groups = loadGroups();
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(outDir)) if (f.endsWith('.svg')) fs.unlinkSync(path.join(outDir, f));

  const entries = [];
  const seen = new Set();
  let files = 0, bytes = 0, largest = 0, drawings = 0;
  for (const group of groups) {
    for (const piece of group.pieces) {
      const wanted = PLAN[`${group.id}/${piece.slug}`] || piece.palettes;
      if (wanted.length === 0) continue;
      drawings++;
      const palettes = wanted.map((id) => lib.PALETTES[id]);
      palettes.forEach((pal) => { if (!pal) throw new Error(`unknown palette in ${group.id}/${piece.slug}`); });
      for (const pal of palettes) {
        const suffix = palettes.length > 1 || pal.mono;
        const key = `deko-${group.slug}-${piece.slug}${suffix ? '-' + pal.slug : ''}`;
        if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(key)) throw new Error('bad key ' + key);
        if (seen.has(key)) throw new Error('duplicate key ' + key);
        seen.add(key);
        const svg = render(group, piece, pal);
        const file = `${key.replace(/^deko-/, '')}.svg`;
        fs.writeFileSync(path.join(outDir, file), svg, 'utf8');
        const size = Buffer.byteLength(svg);
        files++; bytes += size; largest = Math.max(largest, size);
        const tags = [...new Set([...(piece.tags || []), ...(group.tags || []), ...(pal.tags || []), group.name])];
        entries.push({ key, name: `${group.name} · ${piece.name}${suffix ? ` (${pal.label})` : ''}`, category: 'Deko', file: `deko/${file}`, tags });
      }
    }
  }

  fs.writeFileSync(path.join(outDir, 'LICENSE.txt'),
    'Part of DesignThix, created by the DesignThix authors for use in DesignThix designs; the same licence as the app.\n' +
    'The drawings are generated by tools/deko/*.js (own work, no third-party artwork, no fonts, no text).\n', 'utf8');

  const existing = fs.existsSync(listFile) ? JSON.parse(fs.readFileSync(listFile, 'utf8')) : [];
  const merged = [...existing.filter((e) => e.category !== 'Deko'), ...entries];
  fs.writeFileSync(listFile, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  console.log(`${files} files from ${drawings} drawings, ${(bytes / 1024).toFixed(0)} KB (largest ${(largest / 1024).toFixed(0)} KB)`);
}

main();
