'use strict';
const { gold: G, salbei: S, minimal: M, C, L } = require('./_t2a-wedding');
const { text, rect, ellipse, line, icon, page, ctext, divider, dk, dekoIn, tpl, diamond, ticks } = L;

const META = { family: 'hochzeit-einladung-flach', familyName: 'Hochzeit: Einladung (flache Karte)', occasion: 'Hochzeit' };

const INTRO = 'Wir heiraten und möchten diesen besonderen Tag gemeinsam mit euch feiern. Es wäre uns eine große Freude, euch an unserer Seite zu wissen.';

/** A line of the info page: an icon, a heading and a text. */
const infoRow = (n, x, y, w, ic, head, body, st, o = {}) => [
  icon('Symbol ' + n, ic, x, y + 0.5, o.iconSize || 7, st.accent, 1.5),
  text('Überschrift ' + n, x + (o.indent || 11), y, w - (o.indent || 11), 6, head, { f: st.caps, s: o.hs || 7.5, w: 600, c: st.accent, ls: 0.24, min: 7 }),
  text('Text ' + n, x + (o.indent || 11), y + 6.5, w - (o.indent || 11), o.bh || 12, body, { f: st.sans, s: o.bs || 10.5, w: 500, c: st.ink, wrap: true, v: 'top', lh: 1.4, min: 6 }),
];

// ---------------------------------------------------------------------------------------------------------------------------- Klassisch Gold: A5 hoch
const gold = tpl(Object.assign({}, META, {
  slug: 'hochzeit-einladung-flach-klassisch-gold', variant: G.variant,
  name: 'Hochzeitseinladung flach – Klassisch Gold',
  description: 'Klassische Hochzeitseinladung als flache Karte A5 hoch in Elfenbein und Gold: Doppelrahmen, Namen in Schreibschrift, Termin und Ort; die Rückseite mit Anfahrt, Dresscode und Rückmeldung.',
  tags: ['Hochzeit', 'Einladung', 'Hochzeitseinladung', 'Einladungskarte', 'A5', 'Gold', 'klassisch', 'elegant', 'Heirat', 'Brautpaar'],
  formatKey: 'a5-portrait', width: 148, height: 210,
  pages: [
    page(G.bg, [
      dekoIn('Rahmen', G.frameHoch, 5, 5, 138, 200, { locked: true }),
      dk('Funkeln', G.funkeln, 68, 24, 12),
      ctext('Einladung', 74, 46, 110, 7, 'WIR HEIRATEN', { f: G.caps, s: 11, w: 500, c: G.accent, ls: 0.34, min: 6 }),
      ctext('Name 1', 74, 60, 120, 28, C.a, { f: G.script, s: 56, c: G.ink, min: 28 }),
      ctext('Und', 74, 84, 20, 10, '&', { f: G.serif, s: 24, i: true, c: G.accent, min: 10 }),
      ctext('Name 2', 74, 93, 120, 28, C.b, { f: G.script, s: 56, c: G.ink, min: 28 }),
      divider('Trenner', 74, 128, 50, G.line),
      ctext('Text', 74, 134, 92, 22, 'und laden euch herzlich ein, diesen Tag mit uns zu feiern.', { f: G.serif, s: 13.5, i: true, w: 500, c: G.ink, wrap: true, v: 'top', lh: 1.4, min: 8 }),
      ctext('Datum', 74, 160, 100, 10, C.date, { f: G.serif, s: 19, w: 600, c: G.ink, min: 9 }),
      ctext('Ort', 74, 172, 100, 7, (C.place + ' · ' + C.city).toUpperCase(), { f: G.caps, s: 8.5, w: 500, c: G.accent, ls: 0.22, min: 5 }),
      ctext('Zeit', 74, 181, 100, 8, 'Trauung um ' + C.time, { f: G.serif, s: 12, i: true, c: G.ink, min: 7 }),
    ], 'Vorderseite'),
    page(G.bg, [
      dk('Ecke oben', G.corner, 8, 8, 28),
      dk('Ecke unten', G.corner, 112, 174, 28, undefined, { flipX: true, flipY: true }),
      ctext('Titel', 74, 22, 110, 14, 'Gut zu wissen', { f: G.script, s: 28, c: G.accent, min: 14 }),
      ...infoRow(1, 24, 48, 100, 'map-pin', 'ANFAHRT', 'Gut Birkenhof, Birkenallee 4\n12345 Musterstadt. Parkplätze\nsind ausgeschildert.', G, { bh: 18 }),
      ...infoRow(2, 24, 84, 100, 'shirt', 'DRESSCODE', 'Festlich, gern in sommerlichen Farben', G),
      ...infoRow(3, 24, 108, 100, 'bed-double', 'ÜBERNACHTUNG', 'Zimmer sind im Gasthof Linde\nreserviert (Stichwort „Hochzeit“).', G, { bh: 14 }),
      ...infoRow(4, 24, 138, 100, 'mail-check', 'RÜCKMELDUNG', 'Bitte bis zum 1. Mai 2027 an\nanna.jonas@example.org', G, { bh: 14 }),
      line('Trenner', 40, 168, 108, 168, G.line, 0.3, { locked: true }),
      ctext('Gruß', 74, 172, 90, 14, 'Wir freuen uns auf euch', { f: G.script, s: 22, c: G.ink, min: 12 }),
    ], 'Rückseite'),
  ],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Botanisch Salbei: DIN lang hoch
const salbei = tpl(Object.assign({}, META, {
  slug: 'hochzeit-einladung-flach-botanisch-salbei', variant: S.variant,
  name: 'Hochzeitseinladung flach – Botanisch Salbei',
  description: 'Schmale Hochzeitseinladung im Format DIN lang hoch: Bogenrahmen mit Eukalyptus um die Namen, darunter Termin und Ort; die Rückseite mit Anfahrt, Dresscode und Rückmeldung in Salbeigrün.',
  tags: ['Hochzeit', 'Einladung', 'Hochzeitseinladung', 'Einladungskarte', 'DIN lang', 'Eukalyptus', 'Salbei', 'Bogen', 'botanisch', 'Boho'],
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  pages: [
    page(S.bg, [
      dekoIn('Bogen', S.arch, 6, 8, 87, 126, { locked: true }),
      ctext('Einladung', 49.5, 40, 60, 6, 'WIR HEIRATEN', { f: S.caps, s: 7, w: 600, c: S.accent, ls: 0.34, min: 4 }),
      ctext('Name 1', 49.5, 52, 70, 18, C.a, { f: S.script, s: 38, c: S.ink, min: 18 }),
      ctext('Und', 49.5, 71, 20, 8, '&', { f: S.serif, s: 16, i: true, c: S.accent, min: 8 }),
      ctext('Name 2', 49.5, 77, 70, 18, C.b, { f: S.script, s: 38, c: S.ink, min: 18 }),
      ctext('Datum', 49.5, 144, 84, 9, C.weekday + ', ' + C.dateShort, { f: S.serif, s: 15, w: 600, c: S.ink, min: 8 }),
      ctext('Zeit', 49.5, 154, 84, 8, 'Trauung um ' + C.time, { f: S.serif, s: 12, i: true, c: S.ink, min: 7 }),
      dk('Trenner', S.divider, 24, 166, 51),
      ctext('Ort', 49.5, 176, 84, 7, C.place.toUpperCase(), { f: S.caps, s: 8, w: 600, c: S.accent, ls: 0.28, min: 5 }),
      ctext('Adresse', 49.5, 184, 84, 8, 'Birkenallee 4 · 12345 ' + C.city, { f: S.serif, s: 11, w: 500, c: S.ink, min: 7 }),
    ], 'Vorderseite'),
    page(S.bg, [
      dk('Zweig oben', S.stem, 4, 4, 9),
      dk('Zweig unten', S.stem, 86, 160, 9, undefined, { flipY: true }),
      ctext('Titel', 49.5, 20, 80, 14, 'Gut zu wissen', { f: S.script, s: 26, c: S.ink, min: 12 }),
      ...infoRow(1, 14, 46, 74, 'map-pin', 'ANFAHRT', 'Gut Birkenhof, Birkenallee 4,\n12345 Musterstadt. Parkplätze sind ausgeschildert.', S, { bh: 20, hs: 7, bs: 10 }),
      ...infoRow(2, 14, 84, 74, 'shirt', 'DRESSCODE', 'Festlich, gern in sommerlichen Farben.', S, { hs: 7, bs: 10, bh: 14 }),
      ...infoRow(3, 14, 112, 74, 'bed-double', 'ÜBERNACHTUNG', 'Zimmer im Gasthof Linde, Stichwort „Hochzeit“.', S, { hs: 7, bs: 10, bh: 14 }),
      ...infoRow(4, 14, 140, 74, 'mail-check', 'RÜCKMELDUNG', 'Bitte bis zum 1. Mai 2027\nanna.jonas@example.org', S, { hs: 7, bs: 10, bh: 14 }),
      ctext('Gruß', 49.5, 174, 80, 14, 'Wir freuen uns auf euch', { f: S.script, s: 20, c: S.ink, min: 10 }),
    ], 'Rückseite'),
  ],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Modern Minimal: A5 quer
const minimal = tpl(Object.assign({}, META, {
  slug: 'hochzeit-einladung-flach-modern-minimal', variant: M.variant,
  name: 'Hochzeitseinladung flach – Modern Minimal',
  description: 'Moderne Hochzeitseinladung im Format A5 quer: links die Namen groß in Kursivschrift, rechts Termin, Ort und Antwort in klaren Zeilen mit dünnen Linien; die Rückseite mit Anfahrt und Hinweisen.',
  tags: ['Hochzeit', 'Einladung', 'Hochzeitseinladung', 'Einladungskarte', 'A5', 'minimalistisch', 'modern', 'Typografie', 'schlicht', 'Heirat'],
  formatKey: 'a5-landscape', width: 210, height: 148,
  pages: [
    page(M.bg, [
      rect('Block', 0, 0, 92, 148, M.soft, { locked: true }),
      text('Name 1', 12, 28, 76, 30, C.a, { f: M.serif, s: 54, i: true, w: 400, c: M.ink, lh: 1, min: 26 }),
      text('Und', 12, 57, 76, 12, '&', { f: M.serif, s: 28, i: true, c: M.accent, lh: 1, min: 12 }),
      text('Name 2', 12, 68, 76, 30, C.b, { f: M.serif, s: 54, i: true, w: 400, c: M.ink, lh: 1, min: 26 }),
      text('Wir heiraten', 12, 118, 76, 7, 'WIR HEIRATEN', { f: M.caps, s: 8, w: 600, c: M.ink, ls: 0.4, min: 5 }),
      text('Einladung', 108, 24, 90, 18, 'Wir laden euch ein, mit uns zu feiern.', { f: M.sans, s: 11, w: 400, c: M.ink, wrap: true, v: 'top', lh: 1.6, min: 7 }),
      line('Linie 1', 108, 50, 198, 50, M.soft, 0.4, { locked: true }),
      text('Wann Label', 108, 55, 30, 6, 'WANN', { f: M.caps, s: 7, w: 600, c: M.accent, ls: 0.34, min: 4 }),
      text('Wann', 108, 62, 92, 12, C.date + '\nTrauung um ' + C.time, { f: M.sans, s: 10.5, w: 400, c: M.ink, wrap: true, lh: 1.5, v: 'top', min: 6 }),
      line('Linie 2', 108, 84, 198, 84, M.soft, 0.4, { locked: true }),
      text('Wo Label', 108, 89, 30, 6, 'WO', { f: M.caps, s: 7, w: 600, c: M.accent, ls: 0.34, min: 4 }),
      text('Wo', 108, 96, 92, 12, C.place + '\nBirkenallee 4 · 12345 ' + C.city, { f: M.sans, s: 10.5, w: 400, c: M.ink, wrap: true, lh: 1.5, v: 'top', min: 6 }),
      line('Linie 3', 108, 118, 198, 118, M.soft, 0.4, { locked: true }),
      text('Antwort Label', 108, 123, 40, 6, 'ANTWORT', { f: M.caps, s: 7, w: 600, c: M.accent, ls: 0.34, min: 4 }),
      text('Antwort', 108, 130, 92, 7, 'bis zum 1. Mai 2027 an anna.jonas@example.org', { f: M.sans, s: 9, w: 400, c: M.ink, min: 6 }),
    ], 'Vorderseite'),
    page(M.bg, [
      text('Titel', 14, 18, 100, 16, 'Gut zu wissen.', { f: M.serif, s: 28, i: true, w: 400, c: M.ink, min: 14 }),
      line('Linie', 14, 38, 26, 38, M.accent, 0.6, { locked: true }),
      ...infoRow(1, 14, 50, 88, 'map-pin', 'ANFAHRT', 'Gut Birkenhof, Birkenallee 4\n12345 Musterstadt\nParkplätze sind ausgeschildert.', M, { bh: 20, hs: 7 }),
      ...infoRow(2, 14, 88, 88, 'shirt', 'DRESSCODE', 'Festlich, gern in sommerlichen Farben.', M, { bh: 14, hs: 7 }),
      ...infoRow(3, 112, 50, 84, 'bed-double', 'ÜBERNACHTUNG', 'Zimmer im Gasthof Linde,\nStichwort „Hochzeit“.', M, { bh: 14, hs: 7 }),
      ...infoRow(4, 112, 88, 84, 'mail-check', 'RÜCKMELDUNG', 'Bitte bis zum 1. Mai 2027\nanna.jonas@example.org', M, { bh: 14, hs: 7 }),
      line('Fußlinie', 14, 124, 196, 124, M.soft, 0.4, { locked: true }),
      text('Gruß', 14, 128, 120, 8, 'Wir freuen uns auf euch – Anna & Jonas', { f: M.caps, s: 7.5, w: 400, c: M.ink, ls: 0.24, min: 5 }),
    ], 'Rückseite'),
  ],
}));

module.exports = { gold, salbei, minimal };
