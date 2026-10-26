'use strict';
const { gold: G, salbei: S, minimal: M, C, L } = require('./_t2a-wedding');
const { text, rect, ellipse, line, icon, page, ctext, divider, dk, dekoIn, tpl, diamond } = L;

const META = { family: 'hochzeit-save-the-date', familyName: 'Hochzeit: Save the Date', occasion: 'Hochzeit' };

// ---------------------------------------------------------------------------------------------------------------------------- Klassisch Gold
const gold = tpl(Object.assign({}, META, {
  slug: 'save-the-date-klassisch-gold', variant: G.variant,
  name: 'Save the Date – Klassisch Gold',
  description: 'Save-the-Date-Postkarte A6 hoch in Elfenbein und Gold: Doppelrahmen, Namen in Schreibschrift, Datum in Antiqua. Die Rückseite kündigt die Hochzeit an und nennt den Ort. Passt zur Einladung im selben Stil.',
  tags: ['Hochzeit', 'Save the Date', 'Termin', 'Ankündigung', 'Gold', 'klassisch', 'elegant', 'Postkarte', 'Heirat', 'Brautpaar'],
  formatKey: 'postcard-a6-portrait', width: 105, height: 148,
  pages: [
    page(G.bg, [
      dekoIn('Rahmen', G.frameHoch, 4, 4, 97, 140, { locked: true }),
      ctext('Save the Date', 52.5, 22, 80, 8, 'SAVE THE DATE', { f: G.caps, s: 10, w: 500, c: G.accent, ls: 0.3, min: 6 }),
      divider('Trenner oben', 52.5, 34, 40, G.line),
      ctext('Name 1', 52.5, 39, 84, 22, C.a, { f: G.script, s: 46, c: G.ink, min: 24 }),
      ctext('Und', 52.5, 58, 20, 9, '&', { f: G.serif, s: 22, i: true, c: G.accent, min: 10 }),
      ctext('Name 2', 52.5, 65, 84, 22, C.b, { f: G.script, s: 46, c: G.ink, min: 24 }),
      divider('Trenner unten', 52.5, 94, 40, G.line),
      ctext('Wochentag', 52.5, 100, 80, 7, C.weekday.toUpperCase(), { f: G.caps, s: 9, w: 500, c: G.accent, ls: 0.3, min: 6 }),
      ctext('Datum', 52.5, 108, 90, 12, C.dateShort, { f: G.serif, s: 25, w: 600, c: G.ink, min: 12 }),
      ctext('Hinweis', 52.5, 124, 80, 8, 'Einladung folgt', { f: G.serif, s: 12, i: true, c: G.accent, min: 7 }),
    ], 'Vorderseite'),
    page(G.bg, [
      dk('Schwung', G.schwung, 27, 14, 51),
      ctext('Titel', 52.5, 38, 86, 18, 'Wir heiraten!', { f: G.script, s: 34, c: G.ink, min: 18 }),
      ctext('Text', 52.5, 62, 70, 42, 'Bitte merkt euch den Tag vor. Wir feiern mit euch unsere Hochzeit und freuen uns riesig auf euch.', { f: G.serif, s: 12.5, w: 500, c: G.ink, wrap: true, v: 'top', lh: 1.45, min: 8 }),
      divider('Trenner', 52.5, 110, 30, G.line),
      ctext('Ort', 52.5, 114, 80, 8, C.place + ' · ' + C.city, { f: G.caps, s: 8, w: 500, c: G.accent, ls: 0.18, min: 5 }),
    ], 'Rückseite'),
  ],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Botanisch Salbei
const salbei = tpl(Object.assign({}, META, {
  slug: 'save-the-date-botanisch-salbei', variant: S.variant,
  name: 'Save the Date – Botanisch Salbei',
  description: 'Save-the-Date-Postkarte A6 quer: Eukalyptuskranz in Salbeigrün um Namen und Datum, leichte Schreibschrift, auf der Rückseite Eukalyptusecken und eine herzliche Vorankündigung. Passt zur Einladung im selben Stil.',
  tags: ['Hochzeit', 'Save the Date', 'Termin', 'Eukalyptus', 'Salbei', 'botanisch', 'Boho', 'Postkarte', 'Heirat', 'Brautpaar'],
  formatKey: 'postcard-a6-landscape', width: 148, height: 105,
  pages: [
    page(S.bg, [
      dk('Kranz', S.wreath, 28, 8, 92),
      ctext('Save the Date', 74, 27, 60, 6, 'SAVE THE DATE', { f: S.caps, s: 7, w: 600, c: S.accent, ls: 0.34, min: 7 }),
      ctext('Namen', 74, 34, 60, 17, C.couple, { f: S.script, s: 29, c: S.ink, min: 14 }),
      line('Strich', 64, 55, 84, 55, S.line, 0.3, { locked: true }),
      ctext('Datum', 74, 56.5, 60, 9, C.dateShort, { f: S.serif, s: 15, w: 600, c: S.ink, min: 8 }),
      ctext('Ort', 74, 66, 60, 6, C.place.toUpperCase(), { f: S.caps, s: 7, w: 400, c: S.accent, ls: 0.24, min: 7 }),
    ], 'Vorderseite'),
    page(S.bg, [
      dk('Ecke oben', S.corner, 2, 2, 46),
      dk('Ecke unten', S.corner, 100, 57, 46, undefined, { flipX: true, flipY: true }),
      ctext('Titel', 74, 26, 96, 16, 'Wir heiraten', { f: S.script, s: 30, c: S.ink, min: 16 }),
      ctext('Text', 74, 45, 84, 30, 'Haltet euch den Tag frei: Am ' + C.dateShort + ' feiern wir mit euch. Die Einladung folgt in Kürze.', { f: S.serif, s: 12, w: 500, c: S.ink, wrap: true, v: 'top', lh: 1.45, min: 8 }),
      ctext('Namen', 74, 80, 80, 7, 'ANNA & JONAS', { f: S.caps, s: 7.5, w: 600, c: S.accent, ls: 0.3, min: 5 }),
    ], 'Rückseite'),
  ],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Modern Minimal
const minimal = tpl(Object.assign({}, META, {
  slug: 'save-the-date-modern-minimal', variant: M.variant,
  name: 'Save the Date – Modern Minimal',
  description: 'Quadratische Save-the-Date-Karte (100 mm): das Datum als große, schlanke Ziffern, dünne Linien und viel Weiß; die Rückseite in warmem Sand. Reduziert und modern, passt zur Einladung im selben Stil.',
  tags: ['Hochzeit', 'Save the Date', 'Termin', 'minimalistisch', 'modern', 'quadratisch', 'Typografie', 'schlicht', 'Heirat', 'Brautpaar'],
  formatKey: 'square-100', width: 100, height: 100,
  pages: [
    page(M.bg, [
      text('Tag', 12, 10, 40, 26, '12', { f: M.caps, s: 62, w: 200, c: M.ink, lh: 1, min: 30 }),
      text('Monat', 12, 33, 40, 26, '06', { f: M.caps, s: 62, w: 200, c: M.ink, lh: 1, min: 30 }),
      text('Jahr', 12, 56, 40, 26, '27', { f: M.caps, s: 62, w: 200, c: M.accent, lh: 1, min: 30 }),
      line('Linie', 58, 14, 58, 86, M.ink, 0.25, { locked: true }),
      text('Save the Date', 64, 14, 30, 14, 'SAVE\nTHE\nDATE', { f: M.caps, s: 8, w: 600, c: M.ink, ls: 0.3, wrap: true, lh: 1.5, v: 'top', min: 5 }),
      text('Namen', 64, 62, 32, 14, 'ANNA\n&\nJONAS', { f: M.caps, s: 8, w: 300, c: M.ink, ls: 0.3, wrap: true, lh: 1.5, v: 'top', min: 5 }),
      text('Ort', 64, 80, 32, 6, C.city.toUpperCase(), { f: M.caps, s: 7, w: 400, c: M.accent, ls: 0.24, min: 7 }),
    ], 'Vorderseite'),
    page(M.soft, [
      ctext('Titel', 50, 24, 76, 18, 'Wir heiraten.', { f: M.serif, s: 26, i: true, w: 400, c: M.ink, min: 14 }),
      line('Linie', 44, 47, 56, 47, M.accent, 0.5, { locked: true }),
      ctext('Text', 50, 52, 66, 24, 'Bitte merkt euch den ' + C.dateShort + ' vor. Die Einladung folgt.', { f: M.sans, s: 8.5, w: 400, c: M.ink, wrap: true, v: 'top', lh: 1.7, min: 6 }),
      ctext('Ort', 50, 82, 70, 6, C.place.toUpperCase() + ' · ' + C.city.toUpperCase(), { f: M.caps, s: 7, w: 600, c: M.ink, ls: 0.24, min: 7 }),
    ], 'Rückseite'),
  ],
}));

module.exports = { gold, salbei, minimal };
