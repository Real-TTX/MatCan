/* Small helpers to write the built-in templates as compact code. Every helper returns a RAW element (only what differs from the defaults); tools/templates-build.js
   runs the whole document through the engine's normalize(), which fills in every default, so the written JSON files are already normalised.
   Units follow the document: mm for print designs, px for screen designs. Font sizes are in points (the engine converts), letter spacing in em.
   A helper that makes several elements (formLine, checkItem, tableGrid, dekoCorners ...) returns an ARRAY: page() and group() flatten nested arrays, so write
   page(bg, [ rect(...), formLine(...), tableGrid(...) ]) without spreading. The full guide is docs/PLAN-TEMPLATES.md ("How to write a template family"); the shape of a module:

     module.exports = {
       slug: 'geburtstag-klassisch', name: 'Geburtstagskarte – Klassisch', category: 'Karten', description: '...(more than 40 characters, German)...',
       family: 'geburtstagskarte', familyName: 'Geburtstagskarte', variant: 'Klassisch',        // every kind in >= 3 variants with the same family and familyName
       occasion: 'Geburtstag',                                                                       // one of meta.occasions
       tags: ['Geburtstag', 'Glückwunsch', 'Klappkarte', ...],                                       // 3 to 30 German search words
       formatKey: 'card-a6-portrait', fold: 'vertical',                                              // a key of FormatPresets; fold only for folded cards
       width: 210, height: 148, unit: 'mm',                                                          // the size of the format (a folded card: the OPEN sheet)
       fields: [field('Name', 'Name', 'text', 'Anna')],  sampleRows: [{ Name: 'Anna' }],             // only where a series makes sense
       pages: foldCard('vertical', [ ...outside ], [ ...inside ], '#fffaf0'),                       // or [ page(bg, [...], 'Vorderseite'), ... ]
     };

   Helpers:  text rect ellipse line shape icon frame image strip qr barcode group gradient shadow field page ean13           (the basics)
             deko dekoWindow dekoIn dekoCorners dekoRepeat           images of the Deko pack (builtin keys deko-*): proportions from the drawing's viewBox
             foldCard panels                                          folded cards: two named pages, the panels (halves) of the open sheet
             formLine formBox checkbox checkItem ruled tableGrid     forms for print and handwriting
             typo                                                     German typography: quote, nbsp, dash, euro, date
   Look at the result with  node tools/templates-preview.js --only <slug> --out <folder>  and at many with  node tools/templates-sheet.js --from 100 --to 199  (see the guide). */
'use strict';
const fs = require('fs');
const path = require('path');

const iconNames = new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'DesignThix', 'wwwroot', 'lib', 'icons.json'), 'utf8')).icons));
const builtinKeys = new Set(JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'DesignThix', 'wwwroot', 'builtin', 'builtin.json'), 'utf8')).map(a => a.key));
const builtinFiles = new Map(JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'DesignThix', 'wwwroot', 'builtin', 'builtin.json'), 'utf8')).map(a => [a.key, a.file]));
const fontFamilies = new Set(JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'DesignThix', 'wwwroot', 'fonts', 'fonts.json'), 'utf8')).map(f => f.family));

const round = n => Math.round(n * 1000) / 1000;
/** Nested arrays (the helpers that make several elements) become one flat list; null and false are dropped (`cond && rect(...)`). */
const flat = list => (Array.isArray(list) ? list.flat(Infinity) : [list]).filter(Boolean);

function box(type, name, x, y, w, h, o) {
  const e = { type, name, x: round(x), y: round(y), w: round(w), h: round(h) };
  if (o) {
    for (const key of ['rotation', 'opacity', 'locked', 'hidden', 'showIf', 'flipX', 'flipY', 'shadow']) {
      if (o[key] !== undefined) e[key] = o[key];
    }
  }
  return e;
}

/** text(name, x, y, w, h, text, { f: family, s: size pt, w: weight, i: italic, c: colour, a: align, v: valign, lh, ls, up: uppercase, wrap, fit, min, ... }) */
function text(name, x, y, w, h, value, o = {}) {
  if (o.f && !fontFamilies.has(o.f)) throw new Error('Unknown font family ' + o.f + ' in ' + name);
  const e = box('text', name, x, y, w, h, o);
  Object.assign(e, {
    text: value,
    fontFamily: o.f || 'Montserrat',
    fontSize: o.s || 10,
    fontWeight: o.w || 400,
    italic: !!o.i,
    color: o.c || '#111111',
    align: o.a || 'left',
    valign: o.v || 'middle',
    lineHeight: o.lh || 1.15,
    letterSpacing: o.ls || 0,
    uppercase: !!o.up,
    wrap: o.wrap === true,
    fit: o.fit || (o.wrap === true ? 'none' : 'shrink'),
    minFontSize: o.min || Math.max(4, Math.round((o.s || 10) * 0.45)),
  });
  for (const key of ['underline', 'strike', 'list', 'outline', 'background', 'curve']) if (o[key] !== undefined) e[key] = o[key];
  return e;
}

/** shape(kind, name, x, y, w, h, fill, { stroke, sw: stroke width pt, dash, radius, points, inner, ... }) */
function shape(kind, name, x, y, w, h, fill, o = {}) {
  const e = box('shape', name, x, y, w, h, o);
  Object.assign(e, { shape: kind, fill: fill === undefined ? null : fill });
  if (o.stroke) Object.assign(e, { stroke: o.stroke, strokeWidth: o.sw || 1 });
  if (o.dash) e.dash = o.dash;
  if (o.radius !== undefined) e.radius = o.radius;
  if (o.points !== undefined) e.points = o.points;
  if (o.inner !== undefined) e.innerRadius = o.inner;
  if (o.startCap) e.startCap = o.startCap;
  if (o.endCap) e.endCap = o.endCap;
  return e;
}

const rect = (name, x, y, w, h, fill, o) => shape('rect', name, x, y, w, h, fill, o);
const ellipse = (name, x, y, w, h, fill, o) => shape('ellipse', name, x, y, w, h, fill, o);
/** A line from (x1,y1) to (x2,y2); only horizontal and vertical lines are needed here. */
const line = (name, x1, y1, x2, y2, stroke, sw, o = {}) => shape('line', name, Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1), null, Object.assign({}, o, { stroke, sw }));

function icon(name, iconName, x, y, size, color, strokeWidth, o = {}) {
  if (!iconNames.has(iconName)) throw new Error('Unknown icon ' + iconName + ' in ' + name);
  const e = box('icon', name, x, y, size, size, o);
  Object.assign(e, { icon: iconName, color, strokeWidth: strokeWidth || 2 });
  return e;
}

/** An image without a source = a frame ("Bild hierher ziehen"). */
function frame(name, x, y, w, h, o = {}) {
  const e = box('image', name, x, y, w, h, o);
  Object.assign(e, { source: o.source || null, fit: o.fit || 'cover', mask: o.mask || 'none' });
  if (o.radius !== undefined) e.radius = o.radius;
  if (o.border) e.border = o.border;
  return e;
}

function image(name, asset, x, y, w, h, o = {}) {
  if (!builtinKeys.has(asset)) throw new Error('Unknown built-in medium ' + asset + ' in ' + name);
  return frame(name, x, y, w, h, Object.assign({ fit: 'contain' }, o, { source: { asset } }));
}

/** items: field names (string) or built-in keys with `asset:` prefix */
function strip(name, x, y, w, h, items, o = {}) {
  const e = box('imageStrip', name, x, y, w, h, o);
  Object.assign(e, { items: items.map(i => (i.startsWith('asset:') ? { asset: i.slice(6) } : { field: i })), gap: o.gap || 0, align: o.a || 'left' });
  if (o.mask) e.mask = o.mask;
  if (o.border) e.border = o.border;
  return e;
}

function qr(name, x, y, size, value, o = {}) {
  const e = box('qr', name, x, y, size, size, o);
  Object.assign(e, { value, color: o.c || '#000000', background: o.bg === undefined ? '#ffffff' : o.bg, ecc: o.ecc || 'M', quiet: o.quiet !== undefined ? o.quiet : true });
  return e;
}

function barcode(name, x, y, w, h, format, value, o = {}) {
  const e = box('barcode', name, x, y, w, h, o);
  Object.assign(e, { format, value, color: o.c || '#000000', background: o.bg === undefined ? '#ffffff' : o.bg, showText: o.showText !== false, fontFamily: o.f || 'Montserrat' });
  return e;
}

/** A group: the box is the union of the children (they use page coordinates). */
function group(name, childList, o = {}) {
  const children = flat(childList);
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const c of children) {
    x1 = Math.min(x1, c.x);
    y1 = Math.min(y1, c.y);
    x2 = Math.max(x2, c.x + c.w);
    y2 = Math.max(y2, c.y + c.h);
  }
  const e = box('group', name, x1, y1, x2 - x1, y2 - y1, o);
  e.children = children;
  return e;
}

const gradient = (angle, ...stops) => ({ type: 'linear', angle, stops: stops.map((color, i) => ({ offset: round(i / (stops.length - 1)), color })) });
const shadow = (color, opacity, blur, x, y) => ({ color, opacity, blur, x, y });

const field = (key, label, type, sample, extra = {}) => Object.assign({ key, label, type, sample, decimals: type === 'price' ? 2 : null, category: null, required: false }, extra);

/** page(background, elements, name): background is a colour, a gradient object or { asset } */
function page(background, elements, name = '') {
  const bg = typeof background === 'string' ? { color: background } : (background && background.type === 'linear' ? { color: null, gradient: background } : background);
  return { name, background: bg, elements: flat(elements) };
}

/** EAN-13 with its check digit from 12 digits */
function ean13(twelve) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(twelve[i]) * (i % 2 ? 3 : 1);
  return twelve + String((10 - (sum % 10)) % 10);
}

// ------------------------------------------------------------------------------------------------------------------------ Deko pack

const wwwroot = path.join(__dirname, '..', '..', 'src', 'DesignThix', 'wwwroot');
const aspectCache = new Map();

/** Width / height of a Deko drawing, read from the viewBox of its SVG file. Throws for a key that is no piece of the Deko pack (node tools/deko/list.js lists them). */
function dekoAspect(key) {
  if (!aspectCache.has(key)) {
    const file = builtinFiles.get(key);
    if (!file || !key.startsWith('deko-')) throw new Error('Unknown Deko key ' + key + ' (node tools/deko/list.js shows the pieces)');
    const svg = fs.readFileSync(path.join(wwwroot, 'builtin', file), 'utf8');
    const m = /viewBox="\s*[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)[ ,]+([\d.]+)\s*"/.exec(svg);
    if (!m) throw new Error('The Deko piece ' + key + ' has no viewBox');
    aspectCache.set(key, Number(m[1]) / Number(m[2]));
  }
  return aspectCache.get(key);
}

/** deko(name, key, x, y, w, h, o): a piece of the Deko pack as an image. Give w or h (or both, the drawing is then fitted inside, keeping its proportions): the missing one follows the drawing. o: opacity, rotation, flipX, flipY, shadow. */
function deko(name, key, x, y, w, h, o = {}) {
  if (!w && !h) throw new Error('deko ' + name + ': give a width or a height');
  const a = dekoAspect(key);
  const width = w || h * a;
  const height = h || w / a;
  return image(name, key, x, y, width, height, Object.assign({ fit: 'contain' }, o));
}

/**
 * dekoWindow(name, key, x, y, w, h, o): a w x h window onto a piece (a pattern, a field of confetti, stripes): the piece is scaled to COVER the box and cut by its crop, so
 * nothing sticks out of the page (an image that is larger than the page shows outside it in the editor). o.ax / o.ay (0..1, default 0.5) say which part of the piece is seen.
 */
function dekoWindow(name, key, x, y, w, h, o = {}) {
  const a = dekoAspect(key);
  const boxRatio = w / h;
  let cw = 1;
  let ch = 1;
  if (boxRatio >= a) ch = a / boxRatio; else cw = boxRatio / a;
  const ax = o.ax === undefined ? 0.5 : o.ax;
  const ay = o.ay === undefined ? 0.5 : o.ay;
  const rest = Object.assign({}, o);
  delete rest.ax;
  delete rest.ay;
  return Object.assign(image(name, key, x, y, w, h, Object.assign({ fit: 'cover' }, rest)), { crop: { x: round((1 - cw) * ax), y: round((1 - ch) * ay), w: round(cw), h: round(ch) } });
}

/** dekoIn(name, key, bx, by, bw, bh, o): the piece as large as it gets INSIDE the box, keeping its proportions. o.align left|center|right, o.valign top|middle|bottom (default centre). */
function dekoIn(name, key, bx, by, bw, bh, o = {}) {
  const a = dekoAspect(key);
  const w = bw / bh > a ? bh * a : bw;
  const h = w / a;
  const x = bx + (o.align === 'left' ? 0 : o.align === 'right' ? bw - w : (bw - w) / 2);
  const y = by + (o.valign === 'top' ? 0 : o.valign === 'bottom' ? bh - h : (bh - h) / 2);
  const rest = Object.assign({}, o);
  delete rest.align;
  delete rest.valign;
  return deko(name, key, x, y, w, h, rest);
}

/** dekoCorners(name, key, W, H, size, inset, o): a corner ornament (drawn for the TOP LEFT) in the corners of a W x H page, mirrored with flipX / flipY. size = its width; o.only = 'tl,br' picks corners (tl tr bl br). */
function dekoCorners(name, key, W, H, size, inset = 0, o = {}) {
  const h = size / dekoAspect(key);
  const only = (o.only || 'tl,tr,bl,br').split(',').map(v => v.trim());
  const rest = Object.assign({}, o);
  delete rest.only;
  const at = {
    tl: [inset, inset, {}], tr: [W - inset - size, inset, { flipX: true }],
    bl: [inset, H - inset - h, { flipY: true }], br: [W - inset - size, H - inset - h, { flipX: true, flipY: true }],
  };
  return only.map(c => deko(name + ' ' + c.toUpperCase(), key, at[c][0], at[c][1], size, h, Object.assign({}, rest, at[c][2])));
}

/** dekoRepeat(name, key, x, y, w, count, gap, o): `count` copies of a piece in a row (each w wide), for borders and bunting. */
function dekoRepeat(name, key, x, y, w, count, gap = 0, o = {}) {
  return Array.from({ length: count }, (_, i) => deko(name + ' ' + (i + 1), key, x + i * (w + gap), y, w, undefined, o));
}

// ------------------------------------------------------------------------------------------------------------------------ folded cards

const meta = require('./meta');

/**
 * foldCard(fold, outside, inside, bgOutside, bgInside): the two pages of a folded card with the standard names. The page is the OPEN sheet: with fold 'vertical' the left half is the back of the
 * card (outside) and the right half the front; with 'horizontal' the upper half is the back and the lower the front. The fold line is the middle of the sheet (guides in the editor only).
 * Elements on the upper half of a 'horizontal' card are read from the other side: turn them with turn180(elements, panel.cx, panel.cy).
 */
function foldCard(fold, outside, inside, bgOutside = '#ffffff', bgInside = bgOutside) {
  const names = meta.foldPageNames(fold);
  if (!names.length) throw new Error('foldCard needs fold vertical or horizontal');
  return [page(bgOutside, outside, names[0]), page(bgInside, inside, names[1])];
}

/**
 * panels(width, height, fold, margin): the panels of a sheet as boxes { x, y, w, h, cx, cy, left, top, right, bottom } shrunk by `margin` on every side (use 4 mm for the safe margin of a card).
 * fold none = one panel, vertical = [left, right], horizontal = [top, bottom].
 */
function panels(width, height, fold, margin = 0) {
  const boxes = fold === 'vertical' ? [[0, 0, width / 2, height], [width / 2, 0, width / 2, height]]
    : fold === 'horizontal' ? [[0, 0, width, height / 2], [0, height / 2, width, height / 2]] : [[0, 0, width, height]];
  return boxes.map(([x, y, w, h]) => ({
    x: x + margin, y: y + margin, w: w - 2 * margin, h: h - 2 * margin, cx: x + w / 2, cy: y + h / 2, left: x + margin, top: y + margin, right: x + w - margin, bottom: y + h - margin,
  }));
}

/** turn180(elements, cx, cy): the elements turned by 180 degrees around the point (the back of a top-fold card is read upside down). Groups are turned child by child. */
function turn180(elements, cx, cy) {
  const turn = e => {
    if (e.children) {
      const children = e.children.map(turn);
      return group(e.name, children, { rotation: e.rotation, opacity: e.opacity, locked: e.locked });
    }
    return Object.assign({}, e, { x: round(2 * cx - e.x - e.w), y: round(2 * cy - e.y - e.h), rotation: (((e.rotation || 0) + 180) % 360) });
  };
  return flat(elements).map(turn);
}

// ------------------------------------------------------------------------------------------------------------------------ forms

const MM_PT = 25.4 / 72;
/** The height in mm that one line of text of `pt` points needs. */
const lineMm = (pt, lh = 1.3) => pt * MM_PT * lh;

/**
 * formLine(name, x, y, w, label, o): a writing line with its label (default below the line, small). o: lines (several lines below each other, `gap` mm apart, default 8), color, sw, dash,
 * labelAbove, labelSize (pt, default 7), labelColor, f (label font), value (text printed ON the line, e.g. '{{Name}}'), valueSize (pt, default 11), valueFont, valueColor.
 * Returns an array (flat in page()). `.bottom` is the y below the label.
 */
function formLine(name, x, y, w, label, o = {}) {
  const n = o.lines || 1;
  const gap = o.gap || 8;
  const color = o.color || '#222222';
  const out = [];
  for (let i = 0; i < n; i++) out.push(line(n > 1 ? name + ' ' + (i + 1) : name, x, y + i * gap, x + w, y + i * gap, color, o.sw || 0.3, o.dash ? { dash: o.dash } : {}));
  const ls = o.labelSize || 7;
  const lh = lineMm(ls);
  if (o.value !== undefined) {
    const vs = o.valueSize || 11;
    out.push(text(name + ' Wert', x + 0.5, y - lineMm(vs) - 0.3, w - 1, lineMm(vs), o.value, { f: o.valueFont || 'Source Sans 3', s: vs, c: o.valueColor || '#111111', v: 'bottom', min: 6 }));
  }
  if (label) {
    const ly = o.labelAbove ? y - lh - 0.3 : y + (n - 1) * gap + 0.5;
    if (o.labelAbove && o.value !== undefined) throw new Error('formLine ' + name + ': labelAbove and value would overlap');
    out.push(text(name + ' Beschriftung', x, ly, w, lh, label, { f: o.f || 'Source Sans 3', s: ls, c: o.labelColor || '#555555', v: 'top', min: 5 }));
  }
  out.bottom = y + (n - 1) * gap + (label && !o.labelAbove ? lh + 0.5 : 0);
  return out;
}

/** formBox(name, x, y, w, h, label, o): an outlined box with a small label in its top left corner (to write into). o: color, sw, radius, fill, labelSize, labelColor, f, value ('{{Name}}' printed in the box below the label). */
function formBox(name, x, y, w, h, label, o = {}) {
  const ls = o.labelSize || 7;
  const out = [rect(name, x, y, w, h, o.fill === undefined ? null : o.fill, { stroke: o.color || '#222222', sw: o.sw || 0.3, radius: o.radius || 0 })];
  if (label) out.push(text(name + ' Beschriftung', x + 1.5, y + 0.8, w - 3, lineMm(ls), label, { f: o.f || 'Source Sans 3', s: ls, c: o.labelColor || '#555555', v: 'top', min: 5 }));
  if (o.value !== undefined) {
    const vs = o.valueSize || 11;
    out.push(text(name + ' Wert', x + 1.5, y + 0.8 + lineMm(ls) + 0.5, w - 3, Math.max(lineMm(vs), h - lineMm(ls) - 2), o.value, { f: o.valueFont || 'Source Sans 3', s: vs, c: o.valueColor || '#111111', v: 'top', wrap: true, fit: 'shrink', min: 6 }));
  }
  return out;
}

/** checkbox(name, x, y, size, o): an empty box to tick (o.checked draws a tick). o: color, sw, radius (default 0.6 mm), fill (default white). */
function checkbox(name, x, y, size = 4, o = {}) {
  const out = [rect(name, x, y, size, size, o.fill === undefined ? '#ffffff' : o.fill, { stroke: o.color || '#222222', sw: o.sw || 0.4, radius: o.radius === undefined ? 0.6 : o.radius })];
  if (o.checked) out.push(icon(name + ' Haken', 'check', x + size * 0.12, y + size * 0.12, size * 0.76, o.color || '#222222', 3));
  return out;
}

/** checkItem(name, x, y, w, label, o): a checkbox with its text to the right, vertically centred on the box. o: size (box, default 4 mm), s (pt, default 9), f, c, plus the options of checkbox. */
function checkItem(name, x, y, w, label, o = {}) {
  const size = o.size || 4;
  const out = checkbox(name, x, y, size, o);
  out.push(text(name + ' Text', x + size + 2.5, y - 0.6, w - size - 2.5, size + 1.2, label, { f: o.f || 'Source Sans 3', s: o.s || 9, c: o.c || '#111111', v: 'middle', min: 6 }));
  return out;
}

/** ruled(name, x, y, w, n, gap, o): n horizontal lines `gap` mm apart (lined paper, notes). o: color (default light grey), sw, dash. */
function ruled(name, x, y, w, n, gap, o = {}) {
  return Array.from({ length: n }, (_, i) => line(name + ' ' + (i + 1), x, y + i * gap, x + w, y + i * gap, o.color || '#b8b8b8', o.sw || 0.2, o.dash ? { dash: o.dash } : {}));
}

/**
 * tableGrid(name, x, y, w, h, o): a table built from lines and texts. o: cols (relative widths, default [1,1,1]), rows (number of body rows, default 5), header (array of texts), headerHeight (mm, default 8),
 * headerFill (default '#222222', null = no fill), headerColor, line (colour), sw (pt, default 0.5), outer (outer border pt, default the same), verticals (default true), zebra (fill for every second row),
 * cells (array of rows of texts, first body rows), align (per column: 'left' | 'center' | 'right'), s (pt, default 8), f, c, pad (mm, default 1.5), fixedRow (body row height in mm: the table is then as high as it needs, not h).
 * Returns an array; `.cell(r, c)` is the box { x, y, w, h } of body row r (0-based) and column c, `.cell(-1, c)` the header cell, `.xs` the column edges, `.ys` the row edges, `.bottom` the lower edge.
 */
function tableGrid(name, x, y, w, h, o = {}) {
  const rel = o.cols || [1, 1, 1];
  const sum = rel.reduce((a, b) => a + b, 0);
  const xs = [x];
  rel.forEach(r => xs.push(xs[xs.length - 1] + (w * r) / sum));
  const rows = o.rows || 5;
  const headH = o.header ? (o.headerHeight || 8) : 0;
  const rowH = o.fixedRow || (h - headH) / rows;
  const bottom = y + headH + rowH * rows;
  const ys = [];
  for (let i = 0; i <= rows; i++) ys.push(y + headH + i * rowH);
  const color = o.line || '#333333';
  const sw = o.sw || 0.5;
  const s = o.s || 8;
  const pad = o.pad === undefined ? 1.5 : o.pad;
  const f = o.f || 'Source Sans 3';
  const out = [];
  if (o.zebra) for (let i = 1; i < rows; i += 2) out.push(rect(name + ' Streifen ' + i, x, ys[i], w, rowH, o.zebra));
  if (o.header) {
    const fill = o.headerFill === undefined ? '#222222' : o.headerFill;
    if (fill) out.push(rect(name + ' Kopf', x, y, w, headH, fill));
    o.header.forEach((t, c) => out.push(text(name + ' Kopf ' + (c + 1), xs[c] + pad, y, xs[c + 1] - xs[c] - 2 * pad, headH, t, { f, s, w: 700, c: o.headerColor || (fill ? '#ffffff' : '#111111'), a: (o.align || [])[c] || 'left', v: 'middle', min: 5 })));
  }
  const top = y;
  if (o.header) out.push(line(name + ' Linie Kopf', x, y + headH, x + w, y + headH, color, sw));
  for (let i = 1; i < rows; i++) out.push(line(name + ' Zeile ' + i, x, ys[i], x + w, ys[i], color, sw));
  if (o.verticals !== false) for (let c = 1; c < xs.length - 1; c++) out.push(line(name + ' Spalte ' + c, xs[c], top, xs[c], bottom, color, sw));
  out.push(rect(name + ' Rahmen', x, top, w, bottom - top, null, { stroke: color, sw: o.outer || sw }));
  (o.cells || []).forEach((row, r) => row.forEach((t, c) => {
    if (t === '' || t === null || t === undefined || r >= rows || c >= rel.length) return;
    out.push(text(name + ' Zelle ' + (r + 1) + '.' + (c + 1), xs[c] + pad, ys[r], xs[c + 1] - xs[c] - 2 * pad, rowH, t, { f, s, c: o.c || '#111111', a: (o.align || [])[c] || 'left', v: 'middle', min: 5 }));
  }));
  out.cell = (r, c) => (r < 0 ? { x: xs[c], y, w: xs[c + 1] - xs[c], h: headH } : { x: xs[c], y: ys[r], w: xs[c + 1] - xs[c], h: rowH });
  out.xs = xs;
  out.ys = ys;
  out.bottom = bottom;
  return out;
}

// ------------------------------------------------------------------------------------------------------------------------ German typography

const NBSP = ' ';
const typo = {
  nbsp: NBSP,
  /** typo.quote('Alles Gute') gives „Alles Gute“ (German low-high quotes) */
  quote: t => '„' + t + '“',
  dash: '–',
  /** typo.euro(12.5) gives '12,50 €' (a non-breaking space before the sign; thousands with a dot) */
  euro: (n, decimals = 2) => n.toFixed(decimals).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') + NBSP + '€',
  /** typo.date(12, 'Juni', 2027) gives '12. Juni 2027' (a non-breaking space after the day and before the year) */
  date: (day, month, year) => day + '.' + NBSP + month + NBSP + year,
  /** typo.time('18:30') gives '18:30 Uhr' */
  time: t => t + NBSP + 'Uhr',
};

module.exports = {
  text, shape, rect, ellipse, line, icon, frame, image, strip, qr, barcode, group, gradient, shadow, field, page, ean13, iconNames, builtinKeys, fontFamilies,
  deko, dekoWindow, dekoIn, dekoCorners, dekoRepeat, dekoAspect, foldCard, panels, turn180, formLine, formBox, checkbox, checkItem, ruled, tableGrid, lineMm, typo, flat,
};
