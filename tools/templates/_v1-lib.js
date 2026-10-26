/* Batch V1 (Kindergeburtstag II, numbers 600 to 679): the engines. One THEME (tools/templates/_v1-themes.js: colours, fonts, texts, the motifs of the Deko group "Motive")
   is laid out by three different ENGINES per family: the A6 invitation (poster), the folded card (A6 hoch, four panels) and a third format that differs per theme (Instagram post,
   narrow DIN-lang card or A6 landscape). The numbered modules 6NN-<slug>.js are one-line stubs (_v1-stubs.js); the leading underscore keeps this file out of the build. */
'use strict';
const D = require('./dsl');
const { text, rect, ellipse, deko, dekoIn, dekoWindow, page, gradient, field, foldCard, panels, dekoAspect } = D;
const { decor, scatter, cloud, infoRow, dedupe } = require('./_t2b-lib');
const { THEMES, ORDER } = require('./_v1-themes');

const DATE = 'Samstag, 12. Juni 2027 · 15 Uhr';
const PLACE = 'Musterweg 5 · 12345 Musterstadt';
const RSVP = 'Zusage bis 5. Juni: 0170 1234567';
const KEY = s => (s.startsWith('deko-') ? s : 'deko-motive-' + s);
const TITLE = '{{Name}} wird {{Alter}}!';

const bgOf = (c) => (Array.isArray(c) ? gradient(c[0], c[1], c[2]) : c);

/** The motifs of a set in a box: main motif large, the others around it. Three arrangements: stack (a wide main motif on top, two below), flank (very wide box), cluster (the default). */
function cluster(set, x, y, w, h, o = {}) {
  const main = KEY(set.main);
  const sides = (set.sides || []).map(KEY);
  const ar = dekoAspect(main);
  const out = [];
  if (!sides.length) return decor([dekoIn('Motiv', main, x, y, w, h)]);
  if (w / h > 1.6) {
    out.push(dekoIn('Hauptmotiv', main, x + w * 0.26, y, w * 0.48, h));
    out.push(dekoIn('Motiv links', sides[0], x, y + h * 0.1, w * 0.25, h * 0.9, { align: 'right', valign: 'bottom' }));
    if (sides[1]) out.push(dekoIn('Motiv rechts', sides[1], x + w * 0.75, y + h * 0.1, w * 0.25, h * 0.9, { align: 'left', valign: 'bottom' }));
  } else if (ar > 1.3) {
    out.push(dekoIn('Hauptmotiv', main, x, y, w, h * 0.56, { valign: 'bottom' }));
    out.push(dekoIn('Motiv links', sides[0], x, y + h * 0.6, w * 0.48, h * 0.4, { align: 'right', valign: 'top' }));
    if (sides[1]) out.push(dekoIn('Motiv rechts', sides[1], x + w * 0.52, y + h * 0.6, w * 0.48, h * 0.4, { align: 'left', valign: 'top' }));
  } else {
    out.push(dekoIn('Hauptmotiv', main, x + w * 0.14, y, w * 0.72, h));
    out.push(dekoIn('Motiv links', sides[0], x, y + h * 0.5, w * 0.36, h * 0.5, { align: 'left', valign: 'bottom' }));
    if (sides[1]) out.push(dekoIn('Motiv rechts', sides[1], x + w * 0.64, y + h * 0.5, w * 0.36, h * 0.5, { align: 'right', valign: 'bottom' }));
  }
  return decor(out);
}

/** Background elements of a theme: clouds, ground, skyline, strips, scattered confetti. u = units per mm (1 for mm documents, about 10.3 for the 1080 px post). */
function scene(t, W, H, o = {}) {
  const u = o.u || 1;
  const out = [];
  const avoid = (o.avoid || []).slice();
  const sh = (t.stripH || 8) * u;
  if (t.clouds && o.clouds !== false) {
    out.push(...cloud('Wolke 1', W * 0.04, H * 0.05, W * 0.26, '#ffffff', { opacity: 0.85 }), ...cloud('Wolke 2', W * 0.72, H * 0.1, W * 0.22, '#ffffff', { opacity: 0.8 }));
  }
  if (t.ground) {
    const gh = (o.groundH === undefined ? 0.1 : o.groundH) * H;
    out.push(rect('Boden', 0, H - gh, W, gh, t.ground), ellipse('Hügel links', -W * 0.1, H - gh - gh * 0.35, W * 0.6, gh * 1.2, t.ground), ellipse('Hügel rechts', W * 0.45, H - gh - gh * 0.25, W * 0.7, gh * 1.1, t.ground2 || t.ground));
  }
  if (t.skyline) out.push(dekoWindow('Stadt', KEY(t.skyline), 0, H - (o.skylineH || 24 * u), W, o.skylineH || 24 * u, { ay: 1, opacity: t.skylineOpacity || 1 }));
  if (t.strip && o.strips !== false) {
    if (!t.stripBottomOnly) out.push(dekoWindow('Streifen oben', KEY(t.strip), 0, 0, W, sh));
    out.push(dekoWindow('Streifen unten', KEY(t.strip), 0, H - sh, W, sh));
  }
  if (t.strip && o.strips !== false) avoid.push([0, 0, W, sh + 1], [0, H - sh - 1, W, sh + 1]);
  if (t.skyline) avoid.push([0, H - (o.skylineH || 24 * u) - 1, W, (o.skylineH || 24 * u) + 1]);
  if (o.confetti !== false && t.confetti) {
    out.push(...scatter('Deko', t.seed + (o.seedAdd || 0), [0, 0, W, H], { n: Math.round((o.n || 16) * (o.nScale || 1)), colors: t.confetti, kinds: t.kinds || ['dot', 'star', 'spark', 'ring'], size: [2.2 * u, 4.2 * u], avoid, pad: 1.5 * u, opacity: t.confettiOp }));
  }
  return out;
}

const rows = (t, x, y, w, step, size, o = {}) => [
  ...infoRow('Datum', x, y, w, 'calendar-days', t.date || DATE, Object.assign({ chip: t.chip, ic: t.chipIc, c: t.text, f: 'Nunito', s: size, w: 700, d: o.d || 8 }, o)),
  ...infoRow('Ort', x, y + step, w, 'map-pin', PLACE, Object.assign({ chip: t.chip, ic: t.chipIc, c: t.text, f: 'Nunito', s: size, w: 700, d: o.d || 8 }, o)),
  ...infoRow('Zusage', x, y + step * 2, w, 'phone', RSVP, Object.assign({ chip: t.chip, ic: t.chipIc, c: t.text, f: 'Nunito', s: size, w: 700, d: o.d || 8 }, o)),
];

const titleOpts = (t, s0, o = {}) => { const s = Math.round(s0 * (t.ts || 1)); return Object.assign({ f: t.titleFont, w: t.titleW || 700, s, c: t.ink, a: 'center', min: Math.round(s * 0.5), up: !!t.up, lh: t.titleLh || 1.15 }, o); };
const kickOpts = (t, s0, o = {}) => { const s = Math.round(s0 * (t.ks || 1)); return Object.assign({ f: t.kickFont, s, c: t.accent, a: 'center', min: Math.round(s * 0.6), w: t.kickW || 400 }, o); };

// ------------------------------------------------------------------------------------------------------------------------ engine 1: the A6 invitation
function poster(t, set) {
  const W = 105, H = 148;
  const avoid = [[12, 8, 81, 58], [4, 64, 97, 80]];
  const pill = [12, 134, 81, 9];
  return {
    formatKey: 'a6-portrait', width: W, height: H, unit: 'mm', variant: 'Einladung A6', kind: 'Einladung A6 hoch',
    pages: [page(bgOf(t.bg), [
      decor(scene(t, W, H, { avoid, groundH: t.ground ? 0.07 : 0, skylineH: 16 })),
      decor([ellipse('Bühne', 8, 8, 89, 56, t.plate || '#ffffff', { opacity: t.plateOpacity === undefined ? 0.5 : t.plateOpacity })]),
      cluster(set, 12, 9, 81, 54),
      text('Aufhänger', 8, 65, 89, 8.5, t.kick, kickOpts(t, 19)),
      text('Titel', 5, 73.5, 95, 15, TITLE, titleOpts(t, 31)),
      text('Einladung', 9, 90, 87, 11, t.invite, { f: 'Patrick Hand', s: 12.5, c: t.text, a: 'center', wrap: true, v: 'top', lh: 1.15, min: 9 }),
      ...rows(t, 13, 103.5, 82, 10, 9.5),
      decor([rect('Hinweis Band', pill[0], pill[1], pill[2], pill[3], t.pill, { radius: 4.5 })]),
      text('Hinweis', pill[0] + 2, pill[1], pill[2] - 4, pill[3], t.bring, { f: 'Fredoka', s: 10.5, w: 600, c: t.pillText, a: 'center', min: 7 }),
    ])],
  };
}

// ------------------------------------------------------------------------------------------------------------------------ engine 2: the folded card
function folded(t, set, set2) {
  const W = 210, H = 148;
  const [back, front] = panels(W, H, 'vertical', 4);
  const s2 = set2 || set;
  const outside = [
    decor(scene(t, W, H, { avoid: [[back.x, 20, back.w, 100], [front.x, 8, front.w, 132]], n: 20, groundH: t.ground ? 0.1 : 0, skylineH: 18, strips: !!t.strip, clouds: true })),
    decor([ellipse('Bühne', front.x + 2, 10, front.w - 4, 62, t.plate || '#ffffff', { opacity: t.plateOpacity === undefined ? 0.5 : t.plateOpacity })]),
    cluster(set, front.x + 6, 12, front.w - 12, 58),
    text('Aufhänger', front.x, 74, front.w, 9, t.kick, kickOpts(t, 20)),
    text('Titel', front.x + 2, 84, front.w - 4, 17, TITLE, titleOpts(t, 31)),
    text('Untertitel', front.x + 2, 103, front.w - 4, 8, 'Einladung zum Kindergeburtstag', { f: 'Patrick Hand', s: 13, c: t.text, a: 'center', min: 9 }),
    decor([dekoIn('Rückseite Motiv', KEY(s2.main), back.x + 18, 34, back.w - 36, 54)]),
    text('Rückseite Gruß', back.x, 92, back.w, 11, 'Wir freuen uns auf dich!', kickOpts(t, 20)),
    text('Rückseite Hinweis', back.x + 4, 106, back.w - 8, 8, t.bring, { f: 'Fredoka', s: 10.5, w: 500, c: t.text, a: 'center', min: 7 }),
  ];
  const left = [4, 4, 97, 140];
  const inside = [
    decor(scene(t, W, H, { avoid: [[4, 8, 97, 132], [109, 8, 97, 132]], n: 14, groundH: 0, clouds: false, strips: false, confetti: true, seedAdd: 3 })),
    text('Gruß', left[0], 11, left[2], 9, t.kick, kickOpts(t, 21)),
    text('Einladungstext', left[0] + 3, 22, left[2] - 6, 30, t.invite, titleOpts(t, 19, { w: t.titleW || 600, wrap: true, v: 'top', lh: 1.2, min: 12 })),
    decor([ellipse('Bühne', 10, 56, 85, 78, t.plate || '#ffffff', { opacity: t.plateOpacity === undefined ? 0.5 : t.plateOpacity })]),
    cluster(s2, 12, 60, 81, 70),
    text('Titel innen', front.x + 2, 11, front.w - 4, 15, TITLE, titleOpts(t, 26)),
    ...rows(t, front.x + 4, 38, front.w - 6, 15, 10.5, { d: 10 }),
    decor([rect('Hinweis Band', front.x + 4, 90, front.w - 8, 12, t.pill, { radius: 6 })]),
    text('Hinweis', front.x + 6, 90, front.w - 12, 12, t.bring, { f: 'Fredoka', s: 11, w: 600, c: t.pillText, a: 'center', min: 7 }),
    cluster({ main: set.sides ? set.sides[0] : set.main }, front.x + 18, 106, front.w - 36, 34),
  ];
  return {
    formatKey: 'card-a6-portrait', fold: 'vertical', width: W, height: H, unit: 'mm', variant: 'Klappkarte', kind: 'Klappkarte A6 hoch',
    pages: foldCard('vertical', outside, inside, bgOf(t.bg), bgOf(t.paper || t.bg)),
  };
}

// ------------------------------------------------------------------------------------------------------------------------ engine 3a: Instagram post (1080 px)
function square(t, set) {
  const W = 1080, H = 1080, u = 10.3;
  return {
    formatKey: 'instagram-post', width: W, height: H, unit: 'px', variant: 'Instagram-Post', kind: 'Instagram-Post',
    pages: [page(bgOf(t.bg2 || t.bg), [
      decor(scene(t, W, H, { u, avoid: [[40, 40, 560, 600], [600, 80, 440, 520], [40, 640, 1000, 400]], n: 22, groundH: t.ground ? 0.08 : 0, skylineH: 150, clouds: false })),
      decor([ellipse('Bühne', 580, 70, 470, 470, t.plate || '#ffffff', { opacity: t.plateOpacity === undefined ? 0.55 : t.plateOpacity })]),
      cluster(set, 590, 110, 450, 400),
      text('Aufhänger', 70, 70, 520, 70, t.kick, kickOpts(t, 38, { a: 'left' })),
      text('Name', 66, 140, 520, 180, '{{Name}}', titleOpts(t, 100, { a: 'left', min: 40 })),
      text('Alter', 66, 330, 520, 120, 'wird {{Alter}}!', titleOpts(t, 72, { a: 'left', min: 40, c: t.accent2 || t.accent })),
      text('Einladung', 70, 470, 520, 100, t.invite, { f: 'Patrick Hand', s: 25, c: t.text, a: 'left', wrap: true, v: 'top', lh: 1.15, min: 18 }),
      ...rows(t, 70, 610, 940, 92, 24, { d: 70, sw: 2.2 }),
      decor([rect('Hinweis Band', 70, 915, 940, 90, t.pill, { radius: 45 })]),
      text('Hinweis', 100, 915, 880, 90, t.bring, { f: 'Fredoka', s: 28, w: 600, c: t.pillText, a: 'center', min: 18 }),
    ])],
  };
}

// ------------------------------------------------------------------------------------------------------------------------ engine 3b: narrow DIN lang card
function tall(t, set) {
  const W = 99, H = 210;
  return {
    formatKey: 'din-lang-portrait', width: W, height: H, unit: 'mm', variant: 'DIN lang', kind: 'Karte DIN lang hoch',
    pages: [page(bgOf(t.bg2 || t.bg), [
      decor(scene(t, W, H, { avoid: [[6, 12, 87, 92], [4, 92, 91, 106]], n: 22, groundH: t.ground ? 0.07 : 0, skylineH: 26, strips: true })),
      decor([ellipse('Bühne', 6, 14, 87, 80, t.plate || '#ffffff', { opacity: t.plateOpacity === undefined ? 0.5 : t.plateOpacity })]),
      cluster(set, 10, 16, 79, 76),
      text('Aufhänger', 6, 97, 87, 9, t.kick, kickOpts(t, 20)),
      text('Titel', 5.5, 107, 88, 16, TITLE, titleOpts(t, 28)),
      text('Einladung', 8, 125, 83, 14, t.invite, { f: 'Patrick Hand', s: 13, c: t.text, a: 'center', wrap: true, v: 'top', lh: 1.15, min: 9 }),
      ...rows(t, 11, 146, 78, 11, 9.5),
      decor([rect('Hinweis Band', 10, 182, 79, 9, t.pill, { radius: 4.5 })]),
      text('Hinweis', 12, 182, 75, 9, t.bring, { f: 'Fredoka', s: 10, w: 600, c: t.pillText, a: 'center', min: 7 }),
    ])],
  };
}

// ------------------------------------------------------------------------------------------------------------------------ engine 3c: A6 landscape
function wide(t, set) {
  const W = 148, H = 105;
  const main = set.mainWide ? Object.assign({}, set, { main: set.mainWide }) : set;
  return {
    formatKey: 'a6-landscape', width: W, height: H, unit: 'mm', variant: 'Querformat', kind: 'Einladung A6 quer',
    pages: [page(bgOf(t.bg2 || t.bg), [
      decor(scene(t, W, H, { avoid: [[6, 8, 62, 88], [68, 6, 76, 94]], n: 16, groundH: t.ground ? 0.1 : 0, skylineH: 16, clouds: true })),
      decor([ellipse('Bühne', 4, 10, 66, 84, t.plate || '#ffffff', { opacity: t.plateOpacity === undefined ? 0.5 : t.plateOpacity })]),
      cluster(main, 7, 16, 60, 72),
      text('Aufhänger', 72, 8, 70, 8, t.kick, kickOpts(t, 17, { a: 'left' })),
      text('Titel', 71, 16.5, 73, 16, TITLE, titleOpts(t, 25, { a: 'left' })),
      text('Einladung', 72, 34, 70, 11, t.invite, { f: 'Patrick Hand', s: 11, c: t.text, a: 'left', wrap: true, v: 'top', lh: 1.15, min: 8 }),
      ...rows(t, 72, 49, 70, 10, 8.5, { d: 7.5 }),
      decor([rect('Hinweis Band', 72, 82, 70, 9, t.pill, { radius: 4.5 })]),
      text('Hinweis', 74, 82, 66, 9, t.bring, { f: 'Fredoka', s: 9.5, w: 600, c: t.pillText, a: 'center', min: 7 }),
    ])],
  };
}

const THIRD = { square, tall, wide };

/** The template of a theme (index 0 = A6 invitation, 1 = folded card, 2 = the theme's third format). */
function make(id, index) {
  const t = THEMES[id];
  if (!t) throw new Error('unknown theme ' + id);
  const sets = t.sets;
  const built = index === 0 ? poster(t, sets[0]) : index === 1 ? folded(t, sets[1], sets[0]) : THIRD[t.third](t, sets[2] || sets[0]);
  const slugPart = { 'Einladung A6': 'einladung', Klappkarte: 'klappkarte', 'Instagram-Post': 'instagram', 'DIN lang': 'din-lang', Querformat: 'querformat' }[built.variant];
  const fields = [field('Name', 'Name', 'text', t.sample.Name), field('Alter', 'Alter', 'text', t.sample.Alter)];
  const sampleRows = t.rows.map(([Name, Alter]) => ({ Name, Alter }));
  const tags = dedupe(['Kindergeburtstag', 'Einladung', 'Geburtstag', 'Kinder', 'Party', 'Einladungskarte', 'Geburtstagseinladung', 'Kinderparty', ...t.tags, built.variant, ...(built.fold ? ['Klappkarte', 'Falzkarte'] : [])]);
  const out = {
    slug: `kindergeburtstag-${id}-${slugPart}`,
    name: `Kindergeburtstag ${t.name} – ${built.variant}`,
    category: 'Einladungen', family: `kindergeburtstag-${id}`, familyName: `Kindergeburtstag ${t.name}`, variant: built.variant, occasion: 'Kinder & Familie',
    description: `Einladung zum Kindergeburtstag mit dem Thema ${t.name} als ${built.kind}: ${t.about} Name und Alter sind Felder (auch für eine Serie), Datum, Ort und Zusage trägst du direkt ein.`,
    tags, formatKey: built.formatKey, width: built.width, height: built.height, unit: built.unit, fields, sampleRows, pages: built.pages,
  };
  if (built.fold) out.fold = built.fold;
  return out;
}

module.exports = { make, ORDER, THEMES, DATE, PLACE, RSVP };
