'use strict';
/* Family: Konfirmation (Einladung). Variants: Typo (DIN lang, schwarz-weiß mit Grün), Olive (Klappkarte, Marine und Gold), Farbblock (A5 quer). The name is a field. */
const D = require('./dsl');
const { decor, scatter } = require('./_t2b-lib');
const { text, rect, ellipse, shape, icon, deko, dekoIn, page, gradient, field, line, foldCard, panels } = D;

const fields = [field('Name', 'Name', 'text', 'Lea')];
const sampleRows = [{ Name: 'Lea' }, { Name: 'Maximilian-Johannes' }, { Name: 'Jo' }];
const base = { category: 'Einladungen', family: 'konfirmation-einladung', familyName: 'Konfirmation – Einladung', occasion: 'Kinder & Familie', unit: 'mm', fields, sampleRows };
const tags = (...more) => require('./_t2b-lib').dedupe(['Konfirmation', 'Einladung', 'Kirche', 'Jugend', 'Glaube', 'Familie', 'Feier', ...more]);
const DATE = 'Sonntag, 9. Mai 2027';
const CHURCH = 'Evangelische Kirche Musterstadt';
const FEIER = 'Anschließend feiern wir im Gemeindehaus.';
const RSVP = 'Rückmeldung bis 25. April: 0170 1234567';

// ------------------------------------------------------------------------------------------------------------------------ Typo
const typo = (() => {
  const GREEN = '#2f6b5a'; const INK = '#151515'; const PAPER = '#f7f5f0';
  return Object.assign({}, base, {
    slug: 'konfirmation-typo',
    name: 'Konfirmation – Typo',
    description: 'Moderne Einladung zur Konfirmation (DIN lang hoch): große Buchstaben in Schwarz auf Papierweiß mit grünem Akzent und schlichtem Kreuz. Name als Feld.',
    variant: 'Typo',
    tags: tags('Modern', 'Typografie', 'Schwarz-Weiß', 'Minimal', 'Jugendlich', 'Grün'),
    formatKey: 'din-lang-portrait', width: 99, height: 210,
    pages: [page(PAPER, [
      decor([
        rect('Balken', 10, 14, 79, 2, GREEN),
        rect('Kreuz senkrecht', 46.5, 157, 5, 27, INK), rect('Kreuz waagerecht', 38.5, 163, 21, 5, INK),
        line('Linie', 10, 124, 89, 124, INK, 0.5),
      ]),
      text('Jahr', 10, 20, 79, 7, '2027', { f: 'Oswald', s: 12, w: 500, c: GREEN, a: 'left', ls: 0.3, min: 7 }),
      text('Konfirmation', 8, 30, 85, 56, 'KONFIR-\nMATION', { f: 'Anton', s: 74, c: INK, a: 'left', wrap: true, lh: 0.98, v: 'top', min: 50 }),
      text('Name', 10, 94, 79, 14, '{{Name}}', { f: 'Oswald', s: 26, w: 500, c: GREEN, a: 'left', up: true, ls: 0.08, min: 12 }),
      text('Einladung', 10, 109, 79, 12, 'wird gesegnet und lädt\nzum Fest ein.', { f: 'Inter', s: 9.5, w: 500, c: INK, a: 'left', wrap: true, v: 'top', lh: 1.4, min: 7 }),
      text('Datum', 10, 128, 79, 9, DATE, { f: 'Inter', s: 11, w: 700, c: INK, a: 'left', min: 7 }),
      text('Ort', 10, 137, 79, 12, 'um 10 Uhr\n' + CHURCH, { f: 'Inter', s: 9, w: 500, c: INK, a: 'left', wrap: true, v: 'top', lh: 1.4, min: 6.5 }),
      text('Feier', 10, 189, 79, 8, FEIER, { f: 'Inter', s: 8, w: 500, c: INK, a: 'left', wrap: true, v: 'top', lh: 1.4, min: 6 }),
      text('Zusage', 10, 197, 79, 6, RSVP, { f: 'Inter', s: 7.5, w: 600, c: GREEN, a: 'left', min: 6 }),
    ])],
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ Olive
const olive = (() => {
  const NAVY = '#233a5e'; const GOLD = '#c7a15a'; const CREAM = '#fbf7ee';
  const [back, front] = panels(210, 148, 'vertical', 4);
  return Object.assign({}, base, {
    slug: 'konfirmation-olive',
    name: 'Konfirmation – Olive',
    description: 'Klappkarte A6 hoch (2 Seiten) zur Konfirmation: Marineblau mit goldenem Olivenzweig als Zeichen des Friedens, innen Creme mit Serifenschrift. Name als Feld.',
    variant: 'Olive',
    tags: tags('Olivenzweig', 'Marine', 'Gold', 'Klappkarte', 'Elegant', 'Klassisch', 'Frieden'),
    formatKey: 'card-a6-portrait', width: 210, height: 148, fold: 'vertical',
    pages: foldCard('vertical', [
      decor([rect('Blau', 0, 0, 210, 148, NAVY), deko('Zweig hinten', 'deko-blumen-olivenzweig-gold', 24, 54, 57), rect('Fläche vorn', 109, 8, 92, 132, null, { stroke: GOLD, sw: 0.6 })]),
      text('Rückseite', 8, 90, 89, 14, 'Familie Mustermann\nMusterweg 5 · 12345 Musterstadt', { f: 'Cormorant Garamond', s: 9, w: 600, c: '#e9dcc0', a: 'center', wrap: true, v: 'top', lh: 1.4, min: 7 }),
      decor([deko('Zweig', 'deko-blumen-olivenzweig-gold', 124, 24, 62), icon('Kreuz', 'cross', 151, 50, 8, GOLD, 1.5)]),
      text('Konfirmation', 111, 62, 88, 10, 'KONFIRMATION', { f: 'Cinzel', s: 15, w: 400, c: '#ffffff', a: 'center', ls: 0.14, min: 8 }),
      text('Name', 112, 76, 86, 20, '{{Name}}', { f: 'Cormorant Garamond', s: 34, w: 500, i: true, c: GOLD, a: 'center', min: 14 }),
      text('Jahr', 112, 100, 86, 8, '9. Mai 2027', { f: 'Cormorant Garamond', s: 13, w: 600, c: '#ffffff', a: 'center', ls: 0.1, min: 8 }),
    ], [
      decor([deko('Zweig innen', 'deko-blumen-olivenzweig-gold', 10, 120, 45)]),
      text('Titel', 12, 24, 81, 8, 'EINLADUNG ZUR KONFIRMATION', { f: 'Cinzel', s: 8.5, w: 400, c: GOLD, a: 'center', ls: 0.1, min: 6 }),
      text('Name innen', 12, 36, 81, 20, '{{Name}}', { f: 'Cormorant Garamond', s: 38, w: 500, i: true, c: NAVY, a: 'center', min: 14 }),
      text('Text', 16, 62, 73, 34, 'Mit Gottes Segen und unter dem Zuspruch der Gemeinde bekräftigt {{Name}} das Ja zur Taufe. Wir freuen uns, wenn du dabei bist.', { f: 'Cormorant Garamond', s: 11.5, w: 600, c: NAVY, a: 'center', wrap: true, v: 'top', lh: 1.4, min: 8 }),
      text('Zusage', 16, 108, 73, 10, RSVP, { f: 'Cormorant Garamond', s: 9, w: 600, c: GOLD, a: 'center', wrap: true, v: 'top', lh: 1.3, min: 6.5 }),
      text('Wann', 119, 30, 77, 6, 'DER GOTTESDIENST', { f: 'Cinzel', s: 8, w: 400, c: GOLD, a: 'center', ls: 0.14, min: 6 }),
      text('Datum', 119, 40, 77, 9, DATE, { f: 'Cormorant Garamond', s: 17, w: 700, c: NAVY, a: 'center', min: 9 }),
      text('Zeit', 119, 51, 77, 8, 'um 10 Uhr', { f: 'Cormorant Garamond', s: 14, w: 600, c: NAVY, a: 'center', min: 8 }),
      text('Kirche', 119, 62, 77, 8, CHURCH, { f: 'Cormorant Garamond', s: 12.5, w: 600, i: true, c: NAVY, a: 'center', min: 8 }),
      decor([deko('Trenner', 'deko-trenner-raute-gold', 134, 82, 47)]),
      text('Feier', 125, 94, 65, 16, FEIER, { f: 'Cormorant Garamond', s: 12.5, w: 600, c: NAVY, a: 'center', wrap: true, v: 'top', lh: 1.35, min: 8 }),
    ], NAVY, CREAM),
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ Farbblock
const farbblock = (() => {
  const MUST = '#e9b44c'; const PLUM = '#3a2a4d'; const CREAM = '#fff9ee'; const CORAL = '#e8674e';
  return Object.assign({}, base, {
    slug: 'konfirmation-farbblock',
    name: 'Konfirmation – Farbblock',
    description: 'Junge Einladung zur Konfirmation (A5 quer) mit Senfgelb-Block, Pflaume und Koralle, großem Kreuz-Symbol und dem Satz „Dein Weg. Dein Glaube. Dein Tag.“. Name als Feld.',
    variant: 'Farbblock',
    tags: tags('Farbblock', 'Modern', 'Jugendlich', 'Senf', 'Pflaume', 'Spruch'),
    formatKey: 'a5-landscape', width: 210, height: 148,
    pages: [page(CREAM, [
      decor([
        rect('Block', 0, 0, 78, 148, MUST),
        ellipse('Kreis', 14, 36, 50, 50, PLUM),
        icon('Kreuz', 'cross', 29, 49, 20, MUST, 1.7),
        ellipse('Kreis klein', 54, 104, 18, 18, CORAL),
        shape('triangle', 'Dreieck', 10, 108, 16, 14, '#ffffff', { rotation: 12 }),
        ellipse('Ring', 6, 14, 14, 14, null, { stroke: PLUM, sw: 1.6 }),
        line('Linie', 96, 48, 196, 48, PLUM, 0.6),
      ]),
      text('Jahr', 96, 14, 100, 8, 'KONFIRMATION 2027', { f: 'Oswald', s: 12, w: 500, c: CORAL, a: 'left', ls: 0.3, min: 7 }),
      text('Satz', 96, 24, 108, 22, 'Dein Weg. Dein Glaube.\nDein Tag.', { f: 'Poppins', s: 16, w: 700, c: PLUM, a: 'left', wrap: true, lh: 1.2, v: 'top', min: 9 }),
      text('Name', 96, 52, 108, 16, '{{Name}}', { f: 'Poppins', s: 30, w: 700, c: PLUM, a: 'left', min: 12 }),
      text('Einladung', 96, 70, 108, 6, 'wird konfirmiert. Feier mit uns!', { f: 'Poppins', s: 10, w: 500, c: PLUM, a: 'left', min: 7 }),
      text('Datum', 96, 84, 108, 8, DATE + ' · 10 Uhr', { f: 'Poppins', s: 11.5, w: 600, c: PLUM, a: 'left', min: 7 }),
      text('Kirche', 96, 92.5, 108, 7, CHURCH, { f: 'Poppins', s: 10, w: 400, c: PLUM, a: 'left', min: 7 }),
      text('Feier', 96, 104, 108, 7, FEIER, { f: 'Poppins', s: 10, w: 400, c: PLUM, a: 'left', min: 7 }),
      text('Zusage', 96, 118, 108, 7, RSVP, { f: 'Poppins', s: 9, w: 600, c: CORAL, a: 'left', min: 6.5 }),
    ])],
  });
})();

module.exports = { templates: [typo, olive, farbblock] };
