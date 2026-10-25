/* Small helpers to write the built-in templates as compact code. Every helper returns a RAW element (only what differs from the defaults); tools/templates-build.js
   runs the whole document through the engine's normalize(), which fills in every default, so the written JSON files are already normalised.
   Units follow the document: mm for print designs, px for screen designs. Font sizes are in points (the engine converts), letter spacing in em. */
'use strict';
const fs = require('fs');
const path = require('path');

const iconNames = new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'DesignThix', 'wwwroot', 'lib', 'icons.json'), 'utf8')).icons));
const builtinKeys = new Set(JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'DesignThix', 'wwwroot', 'builtin', 'builtin.json'), 'utf8')).map(a => a.key));
const fontFamilies = new Set(JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'DesignThix', 'wwwroot', 'fonts', 'fonts.json'), 'utf8')).map(f => f.family));

const round = n => Math.round(n * 1000) / 1000;

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
function group(name, children, o = {}) {
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
  return { name, background: bg, elements };
}

/** EAN-13 with its check digit from 12 digits */
function ean13(twelve) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(twelve[i]) * (i % 2 ? 3 : 1);
  return twelve + String((10 - (sum % 10)) % 10);
}

module.exports = { text, shape, rect, ellipse, line, icon, frame, image, strip, qr, barcode, group, gradient, shadow, field, page, ean13, iconNames, builtinKeys, fontFamilies };
