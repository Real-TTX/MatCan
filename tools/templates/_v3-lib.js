/* Helpers of batch V3 (greeting cards II, numbers 750 to 829). The underscore keeps tools/templates-build.js from reading it as a module.
   `make(meta, cfg)` turns a short description of one card into a template; five layouts:
     frame   folded A6 (card-a6-portrait), framed front with the motif above the title, the inside: big pale motif left, text right
     block   folded A6, colour block with a disc around the motif and a bold title; the inside has a colour half
     square  folded square card (card-square-145), playful: big tilted motif, handwriting
     post    postcard A6 landscape (front: colour panel with the motif, title right; back: message, stamp, address lines)
     postp   postcard A6 portrait (front: disc with the motif above the title; back: message, stamp, address lines)
   cfg: { layout, variant, slug, desc, tags, bg, bg2, accent, soft, motif, motif2, frame, pat,
          t: [style of title line 1, 2, 3], k: kicker style, b: body style, h: heading style, g: signature style,
          title: [lines], kicker, foot, head, body, sign }                 style = { f, s (pt), w, c, up, ls, i } */
'use strict';
const d = require('./dsl');
const { text, rect, ellipse, line, page, foldCard, panels, dekoIn, dekoWindow } = d;

const MM = 25.4 / 72;
const lhH = (s, lh = 1.2, n = 1) => Math.round((s * MM * lh * n + 1.2) * 10) / 10;

/** One-line (or n-line, with \n) text, box height from the size. st: { f, s, w, c, up, ls, i, a, lh } */
function T(name, x, y, w, str, st, o = {}) {
  const lh = st.lh || 1.2;
  const n = String(str).split('\n').length;
  return text(name, x, y, w, o.h || lhH(st.s, lh, n), str, Object.assign({ f: st.f, s: st.s, w: st.w, c: st.c, up: st.up, ls: st.ls, i: st.i, a: st.a || o.a || 'center', lh, min: Math.max(6, Math.round(st.s * 0.55)) }, o.extra || {}));
}

/** Title lines stacked; styles[i] for line i (the last one repeats), size factor sc. Returns { els, bottom }. */
function stack(cx, y, w, lines, styles, sc = 1, gap = 0, prefix = 'Titel') {
  const els = [];
  let yy = y;
  lines.forEach((ln, i) => {
    const st = Object.assign({}, styles[Math.min(i, styles.length - 1)]);
    st.s = Math.round(st.s * sc * 10) / 10;
    const h = lhH(st.s, st.lh || 1.2);
    els.push(T(`${prefix} ${i + 1}`, cx - w / 2, yy, w, ln, st, { h }));
    yy += h - 1.2 + gap + 0.6;
  });
  return { els, bottom: yy };
}

const dk = (name, key, x, y, w, h, o = {}) => dekoIn(name, key, x, y, w, h, Object.assign({ locked: true }, o));

/** The picture of the front: the motif, or (cfg.big) a large number / word in the font bigf. */
function hero(c, x, y, w, h, o = {}) {
  if (!c.big) return dk('Motiv', c.motif, x, y, w, h, o);
  const s = Math.round((h / MM) * (c.bigk || 0.95));
  return text('Zahl', x, y, w, h, c.big, { f: c.bigf || 'Anton', s, w: c.bigw || 400, c: c.bigc || c.accent, a: 'center', v: 'middle', lh: 1, min: 20 });
}

// ------------------------------------------------------------------------------------------------------------------ frame
function frame(c) {
  const [BL, FR] = panels(210, 148, 'vertical', 4);
  const out = [];
  if (c.frame) out.push(dk('Rahmen', c.frame, 107, 2, 101, 144));
  out.push(hero(c, FR.cx - 31, 17, 62, 50));
  if (c.kicker) out.push(T('Anlass', FR.cx - 38, 69, 76, c.kicker, c.k));
  const st = stack(FR.cx, c.ty || 78, 78, c.title, c.t, 1);
  out.push(...st.els);
  if (c.foot) out.push(T('Zeile', FR.cx - 38, 124, 76, c.foot, c.k));
  const back = [dk('Motiv klein', c.motif2 || c.motif, BL.cx - 9, 100, 18, 18), line('Linie', BL.cx - 14, 96, BL.cx + 14, 96, c.accent, 0.3, { locked: true })];
  const inside = [
    dk('Motiv groß', c.motif2 || c.motif, 12, 22, 82, 104, { opacity: 0.2 }),
    T('Anrede', 113, 24, 88, c.head, c.h, { a: 'left' }),
    text('Text', 113, 40, 88, 60, c.body, { f: c.b.f, s: c.b.s, w: c.b.w, c: c.b.c, wrap: true, v: 'top', lh: c.b.lh || 1.55, min: 8 }),
    T('Gruß', 113, 110, 88, c.sign, Object.assign({}, c.g, { a: 'right' })),
  ];
  return { fold: 'vertical', formatKey: 'card-a6-portrait', width: 210, height: 148, pages: foldCard('vertical', [...out, ...back], inside, c.bg, c.bg2 || c.bg) };
}

// ------------------------------------------------------------------------------------------------------------------ block
function block(c) {
  const [BL, FR] = panels(210, 148, 'vertical', 4);
  const out = [
    rect('Linie', 112, 3, 91, 142, null, { stroke: c.soft, sw: 0.5, locked: true }),
    ellipse('Scheibe', FR.cx - 33, 14, 66, 66, c.soft, { locked: true }),
    hero(c, FR.cx - 25, 22, 50, 50),
  ];
  if (c.kicker) out.push(T('Anlass', FR.cx - 40, 87, 80, c.kicker, c.k));
  const st = stack(FR.cx, c.ty || 95, 84, c.title, c.t, 0.9, 0.6);
  out.push(...st.els);
  if (c.foot) out.push(T('Zeile', FR.cx - 40, 128, 80, c.foot, c.k));
  const back = [ellipse('Scheibe klein', BL.cx - 13, BL.cy - 13, 26, 26, c.soft, { locked: true }), dk('Motiv klein', c.motif2 || c.motif, BL.cx - 9, BL.cy - 9, 18, 18)];
  const inside = [
    rect('Fläche', 0, 0, 105, 148, c.accent, { locked: true }),
    ellipse('Scheibe groß', 52.5 - 36, 38, 72, 72, c.soft, { locked: true }),
    dk('Motiv groß', c.motif2 || c.motif, 52.5 - 29, 45, 58, 58),
    T('Anrede', 113, 24, 88, c.head, c.h, { a: 'left' }),
    text('Text', 113, 40, 88, 60, c.body, { f: c.b.f, s: c.b.s, w: c.b.w, c: c.b.c, wrap: true, v: 'top', lh: c.b.lh || 1.55, min: 8 }),
    T('Gruß', 113, 110, 88, c.sign, Object.assign({}, c.g, { a: 'right' })),
  ];
  return { fold: 'vertical', formatKey: 'card-a6-portrait', width: 210, height: 148, pages: foldCard('vertical', [...out, ...back], inside, c.accent, c.bg2 || '#ffffff') };
}

// ------------------------------------------------------------------------------------------------------------------ square
function square(c) {
  const [BL, FR] = panels(290, 145, 'vertical', 4);
  const out = [];
  if (c.pat) out.push(dekoWindow('Muster', c.pat, 145, 0, 145, 145, { opacity: c.patOp || 0.2, locked: true }));
  if (c.pat) out.push(rect('Textfläche', FR.x + 6, 71, FR.w - 12, 66, c.soft, { opacity: 0.8, radius: 5, locked: true }));
  out.push(hero(c, FR.cx - 40, 6, 80, 58, { rotation: c.tilt === undefined ? -5 : c.tilt }));
  if (c.kicker) out.push(T('Anlass', FR.x + 4, 72, FR.w - 8, c.kicker, c.k));
  const st = stack(FR.cx, c.ty || 80, FR.w - 8, c.title, c.t, 1.1);
  out.push(...st.els);
  if (c.foot) out.push(T('Zeile', FR.x + 4, 128, FR.w - 8, c.foot, c.k));
  const back = [dk('Motiv klein', c.motif2 || c.motif, BL.cx - 11, BL.cy - 11, 22, 22)];
  const inside = [
    dk('Motiv groß', c.motif2 || c.motif, 14, 14, 117, 117),
    T('Anrede', 152, 20, 130, c.head, c.h, { a: 'left' }),
    text('Text', 152, 36, 130, 66, c.body, { f: c.b.f, s: c.b.s, w: c.b.w, c: c.b.c, wrap: true, v: 'top', lh: c.b.lh || 1.5, min: 8 }),
    T('Gruß', 152, 108, 130, c.sign, Object.assign({}, c.g, { a: 'right' })),
  ];
  return { fold: 'vertical', formatKey: 'card-square-145', width: 290, height: 145, pages: foldCard('vertical', [...out, ...back], inside, c.bg, c.bg2 || c.bg) };
}

// ------------------------------------------------------------------------------------------------------------------ post (landscape)
function backLandscape(c) {
  return page('#ffffff', [
    T('Anrede', 8, 10, 70, c.head, Object.assign({}, c.h, { s: Math.min(c.h.s, 17) }), { a: 'left' }),
    text('Text', 8, 24, 70, 56, c.pbody || c.body, { f: c.b.f, s: Math.min(c.b.s, 9), w: c.b.w, c: c.b.c, wrap: true, v: 'top', lh: 1.5, min: 7 }),
    T('Gruß', 8, 84, 70, c.sign, Object.assign({}, c.g, { s: Math.min(c.g.s, 15), a: 'right' })),
    line('Mittellinie', 84, 10, 84, 95, '#d8d8d8', 0.3, { locked: true }),
    rect('Briefmarke', 112, 10, 28, 34, null, { stroke: c.accent, sw: 0.5, dash: 'dashed', locked: true }),
    dk('Marke Motiv', c.motif2 || c.motif, 117, 17, 18, 20, { opacity: 0.35 }),
    line('Adresse 1', 92, 62, 140, 62, '#c9c9c9', 0.3, { locked: true }),
    line('Adresse 2', 92, 72, 140, 72, '#c9c9c9', 0.3, { locked: true }),
    line('Adresse 3', 92, 82, 140, 82, '#c9c9c9', 0.3, { locked: true }),
  ], 'Rückseite');
}
function post(c) {
  const front = page(c.bg, [
    rect('Fläche', 0, 0, 62, 105, c.accent, { locked: true }),
    ellipse('Scheibe', 6, 22, 50, 50, c.soft, { locked: true }),
    hero(c, 9, 25, 44, 44),
    ...(c.kicker ? [T('Anlass', 68, 17, 76, c.kicker, c.k, { a: 'left' })] : []),
    ...stack(106, c.ty || 28, 76, c.title, c.t.map(s => Object.assign({}, s, { a: 'left' })), 1.1, 0, 'Titel').els.map(e => Object.assign(e, { x: 68, w: 76 })),
    ...(c.foot ? [T('Zeile', 68, 88, 76, c.foot, c.k, { a: 'left' })] : []),
  ], 'Vorderseite');
  return { formatKey: 'postcard-a6-landscape', width: 148, height: 105, pages: [front, backLandscape(c)] };
}

// ------------------------------------------------------------------------------------------------------------------ postp (portrait)
function postp(c) {
  const front = page(c.bg, [
    ellipse('Scheibe', 52.5 - 34, 12, 68, 68, c.soft, { locked: true }),
    hero(c, 52.5 - 27, 19, 54, 54),
    ...(c.kicker ? [T('Anlass', 10, 88, 85, c.kicker, c.k)] : []),
    ...stack(52.5, c.ty || 96, 88, c.title, c.t, 0.85).els,
    ...(c.foot ? [T('Zeile', 10, 134, 85, c.foot, c.k)] : []),
  ], 'Vorderseite');
  const back = page('#ffffff', [
    T('Anrede', 10, 10, 85, c.head, Object.assign({}, c.h, { s: Math.min(c.h.s, 17) }), { a: 'left' }),
    text('Text', 10, 25, 85, 48, c.pbody || c.body, { f: c.b.f, s: Math.min(c.b.s, 9), w: c.b.w, c: c.b.c, wrap: true, v: 'top', lh: 1.5, min: 7 }),
    T('Gruß', 10, 76, 85, c.sign, Object.assign({}, c.g, { s: Math.min(c.g.s, 15), a: 'right' })),
    line('Trennlinie', 10, 92, 95, 92, '#d8d8d8', 0.3, { locked: true }),
    rect('Briefmarke', 68, 98, 27, 34, null, { stroke: c.accent, sw: 0.5, dash: 'dashed', locked: true }),
    dk('Marke Motiv', c.motif2 || c.motif, 72, 105, 19, 20, { opacity: 0.35 }),
    line('Adresse 1', 10, 112, 58, 112, '#c9c9c9', 0.3, { locked: true }),
    line('Adresse 2', 10, 122, 58, 122, '#c9c9c9', 0.3, { locked: true }),
    line('Adresse 3', 10, 132, 58, 132, '#c9c9c9', 0.3, { locked: true }),
  ], 'Rückseite');
  return { formatKey: 'postcard-a6-portrait', width: 105, height: 148, pages: [front, back] };
}

const LAYOUTS = { frame, block, square, post, postp };

/** meta: { family, familyName, occasion, category?, tags: [...] }; cfg as above. */
function make(meta, cfg0) {
  const cfg = Object.assign({}, cfg0.pre || {}, cfg0);
  const lay = LAYOUTS[cfg.layout](cfg);
  const o = Object.assign({ category: 'Karten', unit: 'mm' }, meta, lay, {
    slug: cfg.slug,
    name: `${meta.familyName} – ${cfg.variant}`,
    variant: cfg.variant,
    description: cfg.desc,
    tags: [...new Set([...(meta.tags || []), ...(cfg.tags || [])])].slice(0, 30),
  });
  return o;
}

/** Fonts and colours that are often used together. */
const S = (f, s, c, extra = {}) => Object.assign({ f, s, c }, extra);
const pre = {
  elegant: (ink = '#6b5326', accent = '#a9822f', script = 'Great Vibes', body = '#3f3a30') => ({
    k: S('Raleway', 8, accent, { w: 600, up: true, ls: 0.25 }), t: [S(script, 32, accent, { lh: 1.25 }), S(script, 26, ink, { lh: 1.25 })],
    h: S(script, 24, accent), b: S('Cormorant Garamond', 13.5, body, { w: 500, lh: 1.5 }), g: S(script, 22, accent) }),
  modern: (ink = '#1f2f5c', accent = '#a9822f', f = 'Poppins') => ({
    k: S(f, 8, accent, { w: 600, up: true, ls: 0.2 }), t: [S(f, 28, ink, { w: 700, lh: 1.15 }), S(f, 13, ink, { w: 500, lh: 1.3 })],
    h: S('Caveat', 22, ink, { w: 700 }), b: S(f, 10.5, '#333a44', { w: 400 }), g: S('Caveat', 20, ink, { w: 700 }) }),
  fun: (ink = '#d63e4c', body = '#3d3d3d') => ({
    k: S('Nunito', 8, ink, { w: 800, up: true, ls: 0.15 }), t: [S('Caveat', 38, ink, { w: 700, lh: 1.05 }), S('Caveat', 38, ink, { w: 700, lh: 1.05 })],
    h: S('Caveat', 24, ink, { w: 700 }), b: S('Nunito', 11.5, body, { w: 500, lh: 1.5 }), g: S('Caveat', 24, ink, { w: 700 }) }),
  bold: (ink = '#ffffff', accent = '#ffffff', f = 'Montserrat', textInk = '#222222') => ({
    k: S(f, 8, accent, { w: 700, up: true, ls: 0.2 }), t: [S(f, 27, ink, { w: 800, up: true, lh: 1.1, ls: 0.02 }), S(f, 27, ink, { w: 800, up: true, lh: 1.1, ls: 0.02 })],
    h: S(f, 16, textInk, { w: 800 }), b: S('Nunito', 10.5, '#333333', { w: 500, lh: 1.5 }), g: S('Caveat', 22, textInk, { w: 700 }) }),
};

module.exports = { make, T, S, stack, dk, lhH, pre };
