'use strict';
const { gold: G, salbei: S, minimal: M, C, L } = require('./_t2a-wedding');
const { text, rect, ellipse, line, icon, page, ctext, divider, dk, dekoIn, tpl, diamond, foldCard, panels, frame, frameLine } = L;

const META = { family: 'hochzeit-danksagung', familyName: 'Hochzeit: Danksagung', occasion: 'Hochzeit' };

const THANKS = 'Ihr habt unseren Hochzeitstag zu dem schönsten Tag unseres Lebens gemacht. Für eure Glückwünsche, Geschenke und die vielen schönen Stunden danken wir euch von ganzem Herzen.';

// ---------------------------------------------------------------------------------------------------------------------------- Klassisch Gold: Klappkarte
const [GBL, GFR] = panels(210, 148, 'vertical', 4);
const gold = tpl(Object.assign({}, META, {
  slug: 'hochzeit-danksagung-klassisch-gold', variant: G.variant,
  name: 'Hochzeit Danksagung – Klassisch Gold',
  description: 'Danksagungskarte nach der Hochzeit als Klappkarte A6 hoch in Elfenbein und Gold: „Danke“ in Schreibschrift im Zierrahmen, innen links ein Foto vom Hochzeitstag, rechts der Dank an die Gäste.',
  tags: ['Hochzeit', 'Danksagung', 'Danke', 'Dankeskarte', 'Klappkarte', 'Gold', 'klassisch', 'Foto', 'Gäste', 'Heirat'],
  formatKey: 'card-a6-portrait', fold: 'vertical', width: 210, height: 148,
  pages: foldCard('vertical', [
    dk('Seal', G.seal, GBL.cx - 9, 62, 18),
    dekoIn('Rahmen', G.frameHoch, 109, 5, 97, 138, { locked: true }),
    dk('Funkeln', G.funkeln, GFR.cx - 6, 26, 12),
    ctext('Danke', GFR.cx, 44, 86, 36, 'Danke', { f: G.script, s: 62, c: G.ink, lh: 1, min: 28 }),
    divider('Trenner', GFR.cx, 88, 36, G.line),
    ctext('Namen', GFR.cx, 94, 84, 10, C.couple, { f: G.serif, s: 18, w: 600, i: true, c: G.accent, min: 9 }),
    ctext('Datum', GFR.cx, 107, 80, 6, C.dateNum, { f: G.caps, s: 7.5, w: 500, c: G.accent, ls: 0.3, min: 5 }),
  ], [
    rect('Passepartout', 14, 16, 78, 108, G.paper2, { locked: true }),
    frame('Foto', 19, 21, 68, 98, { radius: 1 }),
    frameLine('Fotorahmen', 17, 19, 72, 102, G.line, 0.3),
    ctext('Titel', 157.5, 24, 76, 16, 'Von Herzen', { f: G.script, s: 30, c: G.accent, min: 14 }),
    ctext('Text', 157.5, 44, 76, 56, THANKS, { f: G.serif, s: 12.5, w: 500, c: G.ink, wrap: true, v: 'top', lh: 1.45, min: 8 }),
    ctext('Gruß', 157.5, 108, 76, 12, 'Anna & Jonas', { f: G.script, s: 26, c: G.ink, min: 12 }),
  ], G.bg),
}));

// ---------------------------------------------------------------------------------------------------------------------------- Botanisch Salbei: Postkarte
const salbei = tpl(Object.assign({}, META, {
  slug: 'hochzeit-danksagung-botanisch-salbei', variant: S.variant,
  name: 'Hochzeit Danksagung – Botanisch Salbei',
  description: 'Danksagungskarte nach der Hochzeit als Postkarte A6 quer: ein rundes Foto vom Hochzeitstag im Eukalyptusrahmen, „Danke“ in leichter Schreibschrift; die Rückseite mit dem Dank an die Gäste.',
  tags: ['Hochzeit', 'Danksagung', 'Danke', 'Dankeskarte', 'Postkarte', 'Eukalyptus', 'Salbei', 'botanisch', 'Foto', 'Gäste'],
  formatKey: 'postcard-a6-landscape', width: 148, height: 105,
  pages: [
    page(S.bg, [
      ellipse('Foto Grund', 9, 9, 87, 87, S.soft, { locked: true }),
      frame('Foto', 12, 12, 81, 81, { mask: 'circle' }),
      dk('Kranz', S.wreath, 3, 3, 99),
      ctext('Danke', 123, 28, 46, 24, 'Danke', { f: S.script, s: 44, c: S.ink, min: 20 }),
      line('Strich', 113, 55, 133, 55, S.line, 0.3, { locked: true }),
      ctext('Namen', 123, 59, 46, 7, 'Anna & Jonas', { f: S.serif, s: 12.5, i: true, w: 600, c: S.accent, min: 7 }),
    ], 'Vorderseite'),
    page(S.bg, [
      dk('Ecke oben', S.corner, 2, 2, 38),
      dk('Ecke unten', S.corner, 108, 65, 38, undefined, { flipX: true, flipY: true }),
      ctext('Titel', 74, 20, 100, 14, 'Von Herzen', { f: S.script, s: 28, c: S.ink, min: 14 }),
      ctext('Text', 74, 36, 96, 40, THANKS, { f: S.serif, s: 11.5, w: 500, c: S.ink, wrap: true, v: 'top', lh: 1.45, min: 8 }),
      ctext('Gruß', 74, 82, 90, 8, 'Eure Anna & Jonas', { f: S.script, s: 20, c: S.accent, min: 10 }),
    ], 'Rückseite'),
  ],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Modern Minimal: DIN lang quer
const minimal = tpl(Object.assign({}, META, {
  slug: 'hochzeit-danksagung-modern-minimal', variant: M.variant,
  name: 'Hochzeit Danksagung – Modern Minimal',
  description: 'Danksagungskarte nach der Hochzeit im Format DIN lang quer: „Danke.“ in großer Kursivschrift neben einem Foto vom Hochzeitstag, die Rückseite mit dem Dank an die Gäste in klaren Spalten.',
  tags: ['Hochzeit', 'Danksagung', 'Danke', 'Dankeskarte', 'DIN lang', 'minimalistisch', 'modern', 'Foto', 'schlicht', 'Gäste'],
  formatKey: 'din-lang-landscape', width: 210, height: 99,
  pages: [
    page(M.bg, [
      rect('Foto Grund', 120, 0, 90, 99, M.soft, { locked: true }),
      frame('Foto', 120, 0, 90, 99, {}),
      text('Danke', 12, 14, 104, 52, 'Danke.', { f: M.serif, s: 74, i: true, w: 400, c: M.ink, lh: 1, min: 30 }),
      line('Linie', 14, 74, 26, 74, M.accent, 0.6, { locked: true }),
      text('Namen', 14, 79, 100, 6, 'ANNA & JONAS · 12.06.2027', { f: M.caps, s: 7, w: 600, c: M.ink, ls: 0.3, min: 5 }),
    ], 'Vorderseite'),
    page(M.bg, [
      text('Titel', 14, 14, 80, 12, 'Von Herzen.', { f: M.serif, s: 24, i: true, w: 400, c: M.ink, min: 12 }),
      line('Linie', 14, 32, 26, 32, M.accent, 0.6, { locked: true }),
      text('Text', 14, 40, 110, 36, THANKS, { f: M.sans, s: 9.5, w: 400, c: M.ink, wrap: true, v: 'top', lh: 1.7, min: 6.5 }),
      text('Gruß', 14, 84, 100, 6, 'ANNA & JONAS', { f: M.caps, s: 8, w: 600, c: M.accent, ls: 0.34, min: 5 }),
      rect('Sandfläche', 150, 0, 60, 99, M.soft, { locked: true }),
      text('Zitat', 156, 30, 48, 40, 'Ein Tag, den wir\nnie vergessen.', { f: M.serif, s: 14, i: true, w: 400, c: M.ink, wrap: true, lh: 1.25, v: 'top', min: 8 }),
    ], 'Rückseite'),
  ],
}));

module.exports = { gold, salbei, minimal };
