'use strict';
const { gold: G, salbei: S, minimal: M, C, L } = require('./_t2a-wedding');
const { text, rect, ellipse, line, icon, page, ctext, divider, dk, dekoIn, tpl, diamond } = L;

const META = { family: 'hochzeit-willkommensschild', familyName: 'Hochzeit: Willkommensschild', occasion: 'Hochzeit', formatKey: 'poster-a3-portrait', width: 297, height: 420 };

// ---------------------------------------------------------------------------------------------------------------------------- Klassisch Gold
const gold = tpl(Object.assign({}, META, {
  slug: 'hochzeit-willkommensschild-klassisch-gold', variant: G.variant,
  name: 'Hochzeit Willkommensschild – Klassisch Gold',
  description: 'Willkommensplakat A3 für den Eingang der Hochzeitsfeier: Doppelrahmen in Gold, „Willkommen“ in großer Schreibschrift, die Namen des Brautpaars und das Datum. Zum Ausdrucken, Rahmen oder Aufstellen am Eingang.',
  tags: ['Hochzeit', 'Willkommensschild', 'Willkommen', 'Plakat', 'Poster', 'A3', 'Gold', 'klassisch', 'Eingang', 'Empfang'],
  pages: [page(G.bg, [
    dekoIn('Rahmen', G.frameHoch, 12, 12, 273, 396, { locked: true }),
    dk('Funkeln', G.funkeln, 138, 40, 22),
    ctext('Herzlich', 148.5, 80, 200, 20, 'HERZLICH', { f: G.caps, s: 30, w: 500, c: G.accent, ls: 0.4, min: 14 }),
    ctext('Willkommen', 148.5, 100, 270, 70, 'Willkommen', { f: G.script, s: 108, c: G.ink, lh: 1, min: 50 }),
    divider('Trenner oben', 148.5, 190, 120, G.line, { gap: 10, size: 4 }),
    ctext('zur Hochzeit', 148.5, 200, 200, 16, 'zur Hochzeit von', { f: G.serif, s: 34, i: true, w: 500, c: G.ink, min: 16 }),
    ctext('Name 1', 148.5, 216, 240, 46, C.a, { f: G.script, s: 84, c: G.ink, lh: 1, min: 40 }),
    ctext('Und', 148.5, 254, 40, 20, '&', { f: G.serif, s: 52, i: true, c: G.accent, min: 20 }),
    ctext('Name 2', 148.5, 266, 240, 46, C.b, { f: G.script, s: 84, c: G.ink, lh: 1, min: 40 }),
    divider('Trenner unten', 148.5, 324, 120, G.line, { gap: 10, size: 4 }),
    ctext('Datum', 148.5, 332, 220, 14, C.date, { f: G.serif, s: 30, w: 600, c: G.ink, min: 14 }),
    ctext('Ort', 148.5, 348, 220, 10, (C.place + ' · ' + C.city).toUpperCase(), { f: G.caps, s: 17, w: 500, c: G.accent, ls: 0.26, min: 9 }),
    ctext('Schön', 148.5, 368, 200, 12, 'Schön, dass ihr bei uns seid', { f: G.serif, s: 20, i: true, w: 500, c: G.ink, min: 10 }),
  ], 'Willkommensschild')],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Botanisch Salbei
const salbei = tpl(Object.assign({}, META, {
  slug: 'hochzeit-willkommensschild-botanisch-salbei', variant: S.variant,
  name: 'Hochzeit Willkommensschild – Botanisch Salbei',
  description: 'Willkommensplakat A3 für den Eingang der Hochzeitsfeier: ein riesiger Eukalyptuskranz in Salbeigrün um „Willkommen“, darunter die Namen des Brautpaars und das Datum. Zum Ausdrucken, Rahmen oder Aufstellen am Eingang.',
  tags: ['Hochzeit', 'Willkommensschild', 'Willkommen', 'Plakat', 'Poster', 'A3', 'Eukalyptus', 'Salbei', 'botanisch', 'Eingang'],
  pages: [page(S.bg, [
    dk('Kranz', S.wreath, 22, 28, 253),
    ctext('Herzlich', 148.5, 92, 140, 10, 'HERZLICH', { f: S.caps, s: 17, w: 600, c: S.accent, ls: 0.46, min: 8 }),
    ctext('Willkommen', 148.5, 104, 190, 52, 'Willkommen', { f: S.script, s: 80, c: S.ink, lh: 1, min: 36 }),
    line('Strich', 128, 164, 169, 164, S.line, 0.4, { locked: true }),
    ctext('zur Hochzeit', 148.5, 170, 150, 12, 'zur Hochzeit von', { f: S.serif, s: 24, i: true, w: 500, c: S.ink, min: 12 }),
    ctext('Namen', 148.5, 186, 150, 20, C.couple.toUpperCase(), { f: S.caps, s: 20, w: 300, c: S.ink, ls: 0.2, min: 10 }),
    ctext('Datum', 148.5, 322, 220, 14, C.date, { f: S.serif, s: 30, w: 600, c: S.ink, min: 14 }),
    dk('Trenner', S.divider, 98.5, 343, 100),
    ctext('Ort', 148.5, 358, 220, 10, C.place.toUpperCase() + ' · ' + C.city.toUpperCase(), { f: S.caps, s: 15, w: 600, c: S.accent, ls: 0.3, min: 8 }),
    ctext('Schön', 148.5, 376, 220, 14, 'Schön, dass ihr bei uns seid', { f: S.script, s: 40, c: S.ink, min: 18 }),
  ], 'Willkommensschild')],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Modern Minimal
const minimal = tpl(Object.assign({}, META, {
  slug: 'hochzeit-willkommensschild-modern-minimal', variant: M.variant,
  name: 'Hochzeit Willkommensschild – Modern Minimal',
  description: 'Willkommensplakat A3 für den Eingang der Hochzeitsfeier: „Willkommen.“ in riesiger Kursivschrift, linksbündig, mit einem sandfarbenen Block für Namen, Datum und Ort. Zum Ausdrucken, Rahmen oder Aufstellen am Eingang.',
  tags: ['Hochzeit', 'Willkommensschild', 'Willkommen', 'Plakat', 'Poster', 'A3', 'minimalistisch', 'modern', 'Typografie', 'Eingang'],
  pages: [page(M.bg, [
    rect('Block', 0, 262, 297, 158, M.soft, { locked: true }),
    text('Herzlich', 24, 36, 200, 12, 'HERZLICH', { f: M.caps, s: 22, w: 600, c: M.accent, ls: 0.5, min: 10 }),
    text('Will', 20, 54, 270, 90, 'Will-', { f: M.serif, s: 150, i: true, w: 400, c: M.ink, lh: 1, min: 60 }),
    text('kommen', 20, 134, 270, 90, 'kommen.', { f: M.serif, s: 150, i: true, w: 400, c: M.ink, lh: 1, min: 60 }),
    line('Linie', 24, 252, 54, 252, M.accent, 1, { locked: true }),
    text('Zur Hochzeit', 24, 280, 120, 8, 'ZUR HOCHZEIT VON', { f: M.caps, s: 14, w: 400, c: M.ink, ls: 0.4, min: 8 }),
    text('Namen', 24, 292, 260, 40, C.couple, { f: M.serif, s: 64, i: true, w: 400, c: M.ink, lh: 1, min: 30 }),
    text('Datum', 24, 344, 260, 10, C.date.toUpperCase(), { f: M.caps, s: 18, w: 600, c: M.ink, ls: 0.3, min: 9 }),
    text('Ort', 24, 358, 260, 9, C.place.toUpperCase() + ' · ' + C.city.toUpperCase(), { f: M.caps, s: 14, w: 400, c: M.accent, ls: 0.3, min: 8 }),
    text('Schön', 24, 384, 260, 9, 'Schön, dass ihr dabei seid.', { f: M.serif, s: 24, i: true, w: 400, c: M.ink, min: 12 }),
  ], 'Willkommensschild')],
}));

module.exports = { gold, salbei, minimal };
