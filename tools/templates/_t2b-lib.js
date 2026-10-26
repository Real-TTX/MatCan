/* Helpers of batch T2b (Kinder und Feste, numbers 200 to 299). The leading underscore keeps this file out of templates-build.js (it builds only NNN-<slug>.js modules).
   The families live in tools/templates/_t2b-<family>.js (each exports { templates: [ ... ] }), the numbered modules 2NN-<slug>.js are one-line stubs that pick one template.  */
'use strict';
const D = require('./dsl');
const { shape, ellipse, rect, text, icon, group } = D;

/** A small seeded random generator, so the decoration is the same at every build. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Marks every element that is not a text as locked (decoration the person should not move by accident). */
const decor = list => D.flat(list).map(e => (e.type === 'text' ? e : Object.assign({}, e, { locked: true })));

/**
 * scatter(name, seed, box, o): small pieces of confetti inside box [x, y, w, h], never inside the `avoid` boxes (plus `pad` mm) and not on top of each other.
 * o: n, colors, size [min, max] (mm), kinds (dot ring star spark tri bar diamond heart), avoid [[x, y, w, h]], pad (default 2), opacity, gap (extra distance, default 0.8).
 */
function scatter(name, seed, box, o = {}) {
  const rand = rng(seed);
  const colors = o.colors || ['#ff5d73', '#ffc947', '#2ec4b6', '#4d8cff', '#9b6bff'];
  const kinds = o.kinds || ['dot', 'dot', 'ring', 'star', 'tri', 'bar', 'spark'];
  const [smin, smax] = o.size || [2, 4.5];
  const avoid = o.avoid || [];
  const pad = o.pad === undefined ? 2 : o.pad;
  const placed = [];
  const out = [];
  let tries = 0;
  while (out.length < (o.n || 20) && tries < 4000) {
    tries++;
    const d = smin + rand() * (smax - smin);
    const x = box[0] + rand() * (box[2] - d);
    const y = box[1] + rand() * (box[3] - d);
    const cx = x + d / 2;
    const cy = y + d / 2;
    const r = d * (o.kinds && o.kinds.includes('bar') ? 0.95 : 0.75);
    if (avoid.some(a => cx + r > a[0] - pad && cx - r < a[0] + a[2] + pad && cy + r > a[1] - pad && cy - r < a[1] + a[3] + pad)) continue;
    if (placed.some(p => Math.hypot(p.cx - cx, p.cy - cy) < p.r + r + (o.gap === undefined ? 0.8 : o.gap))) continue;
    placed.push({ cx, cy, r });
    const color = colors[Math.floor(rand() * colors.length)];
    const kind = kinds[Math.floor(rand() * kinds.length)];
    const rot = Math.round(rand() * 340);
    const nm = name + ' ' + (out.length + 1);
    const op = o.opacity === undefined ? {} : { opacity: o.opacity };
    if (kind === 'dot') out.push(ellipse(nm, x, y, d, d, color, op));
    else if (kind === 'ring') out.push(ellipse(nm, x, y, d, d, null, Object.assign({ stroke: color, sw: Math.max(0.8, d * 0.28) }, op)));
    else if (kind === 'star') out.push(shape('star', nm, x, y, d, d, color, Object.assign({ points: 5, inner: 0.45, rotation: rot }, op)));
    else if (kind === 'spark') out.push(shape('star', nm, x, y, d, d, color, Object.assign({ points: 4, inner: 0.28, rotation: rot }, op)));
    else if (kind === 'tri') out.push(shape('triangle', nm, x, y, d, d * 0.9, color, Object.assign({ rotation: rot }, op)));
    else if (kind === 'diamond') out.push(shape('diamond', nm, x, y, d * 0.8, d, color, Object.assign({ rotation: rot }, op)));
    else if (kind === 'heart') out.push(shape('heart', nm, x, y, d, d * 0.92, color, Object.assign({ rotation: rot % 40 - 20 }, op)));
    else out.push(rect(nm, x + d * 0.1, y + d * 0.35, d * 1.5, d * 0.38, color, Object.assign({ rotation: rot, radius: d * 0.15 }, op)));
  }
  return decor(out);
}

/** A flat cloud made of circles on a flat base. */
function cloud(name, x, y, w, color, o = {}) {
  const h = w * 0.46;
  return decor([
    ellipse(name + ' links', x + w * 0.08, y + h * 0.42, w * 0.34, w * 0.34, color, o),
    ellipse(name + ' oben', x + w * 0.26, y, w * 0.46, w * 0.46, color, o),
    ellipse(name + ' rechts', x + w * 0.56, y + h * 0.36, w * 0.36, w * 0.36, color, o),
    rect(name + ' Boden', x + w * 0.08, y + h * 0.6, w * 0.84, w * 0.2, color, Object.assign({ radius: w * 0.1 }, o)),
  ]);
}

/** A centred line that follows a field: the text, one size, the usual defaults of a card. */
const line1 = (name, x, y, w, h, value, o = {}) => text(name, x, y, w, h, value, Object.assign({ a: 'center' }, o));

/** A row: a round icon chip and a text to its right (details of an invitation). chip = background colour of the chip (null for none). */
function infoRow(name, x, y, w, iconName, label, o = {}) {
  const chip = o.chip === undefined ? '#ffffff' : o.chip;
  const d = o.d || 8;
  const out = [];
  if (chip) out.push(ellipse(name + ' Chip', x, y, d, d, chip, { locked: true }));
  out.push(icon(name + ' Symbol', iconName, x + d * 0.22, y + d * 0.22, d * 0.56, o.ic || '#222222', o.sw || 2, { locked: true }));
  out.push(text(name, x + d + 2.5, y - 0.5, w - d - 2.5, d + 1, label, { f: o.f || 'Nunito', s: o.s || 9.5, w: o.w || 600, c: o.c || '#222222', v: 'middle', a: 'left', wrap: true, fit: 'shrink', lh: 1.15, min: 6.5 }));
  return out;
}

/** A jack-o'-lantern from ellipses and triangles (w wide, 0.84 w high). */
function pumpkin(name, x, y, w, o = {}) {
  const h = w * 0.84;
  const body = o.color || '#ff8a1f';
  const dark = o.dark || '#d9670b';
  const face = o.face || '#2a1238';
  const teeth = [0, 1, 2, 3].map(i => shape('triangle', name + ' Zahn ' + (i + 1), x + w * (0.3 + i * 0.1), y + h * (i % 2 ? 0.68 : 0.62), w * 0.1, h * 0.1, face, { flipY: i % 2 === 0 }));
  return decor([
    ellipse(name + ' links', x, y + h * 0.1, w * 0.52, h * 0.9, dark),
    ellipse(name + ' rechts', x + w * 0.48, y + h * 0.1, w * 0.52, h * 0.9, dark),
    ellipse(name + ' Mitte', x + w * 0.2, y, w * 0.6, h, body),
    rect(name + ' Stiel', x + w * 0.44, y - h * 0.14, w * 0.12, h * 0.22, '#3f7d3a', { radius: w * 0.03, rotation: 12 }),
    shape('triangle', name + ' Auge links', x + w * 0.25, y + h * 0.3, w * 0.15, h * 0.17, face, { rotation: -8 }),
    shape('triangle', name + ' Auge rechts', x + w * 0.6, y + h * 0.3, w * 0.15, h * 0.17, face, { rotation: 8 }),
    shape('triangle', name + ' Nase', x + w * 0.46, y + h * 0.5, w * 0.08, h * 0.09, face),
    rect(name + ' Mund', x + w * 0.28, y + h * 0.66, w * 0.44, h * 0.1, face, { radius: h * 0.03 }),
    ...teeth.slice(0, 0),
  ]);
}

/** A bat in flight from ellipses and triangles (w wide). */
function bat(name, x, y, w, color = '#1b1030', o = {}) {
  return decor([
    shape('triangle', name + ' Flügel links', x, y + w * 0.05, w * 0.42, w * 0.34, color, Object.assign({ rotation: -78 }, o)),
    shape('triangle', name + ' Flügel rechts', x + w * 0.58, y + w * 0.05, w * 0.42, w * 0.34, color, Object.assign({ rotation: 78 }, o)),
    ellipse(name + ' Körper', x + w * 0.4, y + w * 0.06, w * 0.2, w * 0.3, color, o),
    shape('triangle', name + ' Ohr links', x + w * 0.4, y, w * 0.08, w * 0.1, color, o),
    shape('triangle', name + ' Ohr rechts', x + w * 0.52, y, w * 0.08, w * 0.1, color, o),
  ]);
}

/** A friendly ghost (w wide, 1.15 w high). */
function ghost(name, x, y, w, o = {}) {
  const c = o.color || '#ffffff';
  const eye = o.eye || '#2a1238';
  return decor([
    ellipse(name + ' Kopf', x, y, w, w * 0.9, c, o.shadow ? { shadow: o.shadow } : {}),
    rect(name + ' Körper', x, y + w * 0.45, w, w * 0.5, c),
    ...[0, 1, 2].map(i => ellipse(name + ' Zipfel ' + (i + 1), x + (w / 3) * i, y + w * 0.82, w / 3, w * 0.33, c)),
    ellipse(name + ' Auge links', x + w * 0.27, y + w * 0.3, w * 0.12, w * 0.17, eye), ellipse(name + ' Auge rechts', x + w * 0.61, y + w * 0.3, w * 0.12, w * 0.17, eye),
    ellipse(name + ' Mund', x + w * 0.42, y + w * 0.56, w * 0.16, w * 0.14, eye),
  ]);
}

/** A gingham (picnic cloth) band from semi-transparent stripes: squares of s mm. */
function gingham(name, x, y, w, h, s, color, bg = '#ffffff') {
  const out = [rect(name + ' Grund', x, y, w, h, bg)];
  for (let i = 0; i * s < w; i += 2) out.push(rect(name + ' Spalte ' + i, x + i * s, y, Math.min(s, w - i * s), h, color, { opacity: 0.45 }));
  for (let j = 0; j * s < h; j += 2) out.push(rect(name + ' Zeile ' + j, x, y + j * s, w, Math.min(s, h - j * s), color, { opacity: 0.45 }));
  return decor(out);
}

/** A list of tags without duplicates (compared without regard to case). */
const dedupe = list => list.filter((t, i) => list.findIndex(u => u.toLowerCase() === t.toLowerCase()) === i);

module.exports = { dedupe, rng, decor, scatter, cloud, line1, infoRow, pumpkin, bat, ghost, gingham };
