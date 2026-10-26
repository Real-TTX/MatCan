'use strict';
/* Family: Ehejubiläum (Silber-, Gold-, Rubinhochzeit ...). Variants: Gold (Klappkarte), Silber (A6), Rubin (A5 quer, mit Fotorahmen). Fields: Namen, Jahre, Art. */
const D = require('./dsl');
const { decor, scatter, infoRow } = require('./_t2b-lib');
const { text, rect, ellipse, shape, icon, deko, dekoIn, page, gradient, field, line, frame, foldCard, panels } = D;

const fields = [field('Namen', 'Namen', 'text', 'Helga & Peter'), field('Jahre', 'Jahre', 'text', '50'), field('Art', 'Art des Jubiläums', 'text', 'Goldene Hochzeit')];
const sampleRows = [
  { Namen: 'Helga & Peter', Jahre: '50', Art: 'Goldene Hochzeit' },
  { Namen: 'Maria-Luise und Hans-Joachim', Jahre: '25', Art: 'Silberhochzeit' },
  { Namen: 'Eva & Jo', Jahre: '40', Art: 'Rubinhochzeit' },
];
const base = { category: 'Einladungen', family: 'ehejubilaeum', familyName: 'Ehejubiläum – Einladung', occasion: 'Feste & Events', unit: 'mm', fields, sampleRows };
const tags = (...more) => require('./_t2b-lib').dedupe(['Hochzeitstag', 'Ehejubiläum', 'Goldene Hochzeit', 'Silberhochzeit', 'Rubinhochzeit', 'Jubiläum', 'Einladung', 'Paar', 'Jahre', ...more]);
const DATE = 'Samstag, 11. September 2027';
const TIME = 'ab 14 Uhr';
const PLACE = 'Gasthof Zur Linde, Musterstadt';
const RSVP = 'Um Antwort bitten wir bis 28. August: 0170 1234567';

const rings = (x, y, d, color, sw) => [ellipse('Ring 1', x, y, d, d, null, { stroke: color, sw }), ellipse('Ring 2', x + d * 0.62, y, d, d, null, { stroke: color, sw })];

// ------------------------------------------------------------------------------------------------------------------------ Gold
const gold = (() => {
  const IVORY = '#fcf8ee'; const GOLD = '#b8893a'; const INK = '#463d33';
  const [inL, inR] = panels(210, 148, 'vertical', 4);
  return Object.assign({}, base, {
    slug: 'ehejubilaeum-gold',
    name: 'Ehejubiläum – Gold',
    description: 'Klappkarte A6 hoch (2 Seiten) zur Goldenen Hochzeit oder jedem Ehejubiläum: zwei ineinander verschlungene Ringe, Doppelrahmen und Schreibschrift in Gold. Namen, Jahre und Art sind Felder.',
    variant: 'Gold',
    tags: tags('Gold', 'Klassisch', 'Ringe', 'Klappkarte', 'Festlich', 'Schreibschrift'),
    formatKey: 'card-a6-portrait', width: 210, height: 148, fold: 'vertical',
    pages: foldCard('vertical', [
      decor([deko('Zweig', 'deko-blumen-lorbeerzweig-gold', 22, 54, 61), deko('Trenner', 'deko-trenner-schnoerkel-gold', 30, 80, 45)]),
      text('Rückseite', 8, 90, 89, 14, 'Mit herzlichen Grüßen\nMusterweg 5 · 12345 Musterstadt', { f: 'Cormorant Garamond', s: 9, w: 600, c: INK, a: 'center', wrap: true, v: 'top', lh: 1.4, min: 7 }),
      decor([dekoIn('Rahmen', 'deko-rahmen-doppellinie-hoch-gold', 109, 5, 97, 138), ...rings(143, 22, 22, GOLD, 1.8).map((r, i) => r)]),
      text('Art', 111, 52, 88, 28, '{{Art}}', { f: 'Great Vibes', s: 38, c: GOLD, a: 'center', min: 16 }),
      text('Namen', 119, 84, 68, 10, '{{Namen}}', { f: 'Cinzel', s: 14, w: 400, c: INK, a: 'center', ls: 0.08, min: 7 }),
      decor([deko('Trenner vorn', 'deko-trenner-raute-gold', 135, 101, 45)]),
      text('Jahre', 113, 108, 80, 9, '{{Jahre}} gemeinsame Jahre', { f: 'Cormorant Garamond', s: 14, w: 600, i: true, c: INK, a: 'center', min: 8 }),
    ], [
      decor([deko('Ecke', 'deko-ecken-schnoerkel-gold', 6, 6, 22), deko('Ecke 2', 'deko-ecken-schnoerkel-gold', 182, 120, 22, undefined, { flipX: true, flipY: true })]),
      text('Gruß', inL.x + 6, 24, inL.w - 12, 34, 'Nach {{Jahre}} gemeinsamen Jahren\nmöchten wir mit euch\nauf unsere Ehe anstoßen\nund dankbar zurückblicken.', { f: 'Cormorant Garamond', s: 12.5, w: 600, i: true, c: INK, a: 'center', wrap: true, v: 'top', lh: 1.4, min: 8 }),
      text('Namen innen', inL.x + 4, 70, inL.w - 8, 14, '{{Namen}}', { f: 'Great Vibes', s: 26, c: GOLD, a: 'center', min: 11 }),
      decor([deko('Trenner innen', 'deko-trenner-schnoerkel-gold', 28, 92, 50)]),
      text('Zusage', inL.x + 6, 102, inL.w - 12, 16, RSVP, { f: 'Cormorant Garamond', s: 9.5, w: 600, c: INK, a: 'center', wrap: true, v: 'top', lh: 1.35, min: 7 }),
      text('Wann', inR.x + 4, 34, inR.w - 8, 6, 'WIR FEIERN AM', { f: 'Cinzel', s: 8.5, w: 400, c: GOLD, a: 'center', ls: 0.12, min: 6 }),
      text('Datum', inR.x + 4, 46, inR.w - 8, 10, DATE, { f: 'Cormorant Garamond', s: 17, w: 700, c: INK, a: 'center', min: 9 }),
      text('Zeit', inR.x + 4, 58, inR.w - 8, 8, TIME, { f: 'Cormorant Garamond', s: 15, w: 600, c: INK, a: 'center', min: 8 }),
      text('Ort', inR.x + 4, 70, inR.w - 8, 8, PLACE, { f: 'Cormorant Garamond', s: 13, w: 600, i: true, c: INK, a: 'center', min: 8 }),
      decor([deko('Trenner rechts', 'deko-trenner-punkte-gold', 130, 90, 45)]),
      text('Hinweis', inR.x + 8, 98, inR.w - 16, 16, 'Auf einen schönen Tag mit Familie und Freunden.', { f: 'Cormorant Garamond', s: 12, w: 600, c: INK, a: 'center', wrap: true, v: 'top', lh: 1.35, min: 8 }),
    ], IVORY),
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ Silber
const silber = (() => {
  const SILVER = '#8e99a8'; const NAVY = '#243247';
  return Object.assign({}, base, {
    slug: 'ehejubilaeum-silber',
    name: 'Ehejubiläum – Silber',
    description: 'Schlichte Einladung zum Hochzeitstag (A6 hoch) in kühlem Silber und Nachtblau mit Ringen, feinem Rahmen und klarer Schrift. Namen, Jahre und Art (zum Beispiel Silberhochzeit) sind Felder.',
    variant: 'Silber',
    tags: tags('Silber', 'Modern', 'Minimal', 'Ringe', 'Navy', 'Schlicht'),
    formatKey: 'a6-portrait', width: 105, height: 148,
    pages: [page(gradient(170, '#f7f9fb', '#dde3ea'), [
      decor([
        rect('Rahmen', 6, 6, 93, 136, null, { stroke: SILVER, sw: 0.6 }),
        rect('Rahmen innen', 8.5, 8.5, 88, 131, null, { stroke: SILVER, sw: 0.3 }),
        ...rings(37, 17, 20, SILVER, 1.6),
        line('Linie', 38, 100, 67, 100, SILVER, 0.5),
      ]),
      text('Kopf', 12, 46, 81, 7, 'WIR FEIERN UNSERE', { f: 'Josefin Sans', s: 8.5, w: 600, c: SILVER, a: 'center', ls: 0.3, min: 6 }),
      text('Art', 10, 54, 85, 18, '{{Art}}', { f: 'Cormorant Garamond', s: 29, w: 600, c: NAVY, a: 'center', min: 12 }),
      text('Namen', 10, 74, 85, 12, '{{Namen}}', { f: 'Cormorant Garamond', s: 17, w: 500, i: true, c: NAVY, a: 'center', min: 9 }),
      text('Jahre', 10, 87, 85, 8, '{{Jahre}} Jahre gemeinsam', { f: 'Josefin Sans', s: 9, w: 600, c: SILVER, a: 'center', ls: 0.1, min: 6 }),
      text('Datum', 10, 104, 85, 8, DATE, { f: 'Raleway', s: 10.5, w: 700, c: NAVY, a: 'center', min: 7 }),
      text('Zeit', 10, 112, 85, 7, TIME + ' · ' + PLACE, { f: 'Raleway', s: 9, w: 500, c: NAVY, a: 'center', min: 6.5 }),
      text('Zusage', 14, 124, 77, 10, RSVP, { f: 'Raleway', s: 7.5, w: 500, c: SILVER, a: 'center', wrap: true, v: 'top', lh: 1.4, min: 6 }),
    ])],
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ Rubin
const rubin = (() => {
  const WINE = '#8e1f3a'; const ROSE = '#f3d4d9'; const CREAM = '#fff8f4'; const INK = '#3a2530'; const GOLD = '#c4985a';
  return Object.assign({}, base, {
    slug: 'ehejubilaeum-rubin',
    name: 'Ehejubiläum – Rubin',
    description: 'Warme Einladung zum Ehejubiläum (A5 quer) in Weinrot und Rosé mit rundem Fotorahmen, Jahreszahl-Plakette und Herzen. Namen, Jahre und Art sind Felder.',
    variant: 'Rubin',
    tags: tags('Rubin', 'Weinrot', 'Foto', 'Herzen', 'Rosé', 'Fotorahmen', 'Persönlich'),
    formatKey: 'a5-landscape', width: 210, height: 148,
    pages: [page(CREAM, [
      decor([
        rect('Fläche', 0, 0, 80, 148, ROSE),
        deko('Herzen', 'deko-herzen-streuung-rose', -6, 80, 90, undefined, { opacity: 0.8 }),
        ellipse('Foto Grund', 9, 21, 62, 62, '#e7b7c0'),
        icon('Foto Symbol', 'heart', 29, 41, 22, '#ffffff', 1.5),
      ]),
      frame('Foto', 9, 21, 62, 62, { mask: 'circle', border: { color: '#ffffff', width: 1.6 } }),
      decor([
        ellipse('Plakette', 48, 74, 26, 26, WINE), ellipse('Plakette Ring', 49.5, 75.5, 23, 23, null, { stroke: GOLD, sw: 0.8 }),
      ]),
      text('Jahre', 48, 79, 26, 13, '{{Jahre}}', { f: 'Playfair Display', s: 20, w: 700, c: '#ffffff', a: 'center', min: 9 }),
      text('Jahre Wort', 48, 91, 26, 6, 'JAHRE', { f: 'Montserrat', s: 5.5, w: 700, c: GOLD, a: 'center', ls: 0.2, min: 4.5 }),
      text('Kopf', 92, 16, 106, 7, 'WIR LADEN EIN ZUR', { f: 'Montserrat', s: 8, w: 700, c: WINE, a: 'left', ls: 0.25, min: 6 }),
      text('Art', 92, 24, 108, 20, '{{Art}}', { f: 'Playfair Display', s: 28, w: 700, c: INK, a: 'left', min: 12 }),
      text('Namen', 92, 45, 108, 14, '{{Namen}}', { f: 'Playfair Display', s: 19, w: 400, i: true, c: WINE, a: 'left', min: 9 }),
      line('Linie', 92, 64, 198, 64, GOLD, 0.5),
      ...infoRow('Datum', 92, 72, 106, 'calendar-days', DATE, { chip: WINE, ic: '#ffffff', c: INK, f: 'Montserrat', s: 10, w: 600 }),
      ...infoRow('Zeit', 92, 83, 106, 'clock', TIME, { chip: WINE, ic: '#ffffff', c: INK, f: 'Montserrat', s: 10, w: 600 }),
      ...infoRow('Ort', 92, 94, 106, 'map-pin', PLACE, { chip: WINE, ic: '#ffffff', c: INK, f: 'Montserrat', s: 10, w: 600 }),
      text('Zusage', 92, 114, 106, 14, RSVP, { f: 'Montserrat', s: 8, w: 500, c: WINE, a: 'left', wrap: true, v: 'top', lh: 1.4, min: 6 }),
    ])],
  });
})();

module.exports = { templates: [gold, silber, rubin] };
