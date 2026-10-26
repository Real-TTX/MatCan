'use strict';
const { dsl, pt, ADDRESS, PHONE } = require('./_t3a-lib');
const { text, rect, ellipse, shape, icon, deko, group, page, shadow, typo } = dsl;

const FAMILY = { family: 'flyer-wochenangebot', familyName: 'Flyer Wochenangebot', occasion: 'Handel & Preise', category: 'Flyer', formatKey: 'a5-portrait', width: 148, height: 210 };

// ---- Preisliste: yellow, black, red; one product per row with a big price tag
const YEL = '#ffd60a';
const BLK = '#141414';
const RED = '#e63946';
const listRow = (n, y, name, sub, price) => group('Angebot ' + n, [
  rect(`Zeile ${n}`, 10, y, 128, 22, '#ffffff', { radius: 3 }),
  rect(`Zeile ${n} Streifen`, 10, y, 3.5, 22, RED, { radius: 1.5 }),
  text(`Produkt ${n}`, 17, y + 2.5, 76, 10, name, { f: 'Oswald', s: 18, w: 600, c: BLK, v: 'bottom', min: 10 }),
  text(`Menge ${n}`, 17, y + 12.5, 76, 6, sub, { f: 'Source Sans 3', s: 8.5, c: '#5b5b5b', v: 'top', min: 6 }),
  rect(`Preisschild ${n}`, 96, y + 3.5, 38, 15, RED, { radius: 2.5 }),
  text(`Preis ${n}`, 97, y + 3.5, 36, 15, price, { f: 'Anton', s: 23, c: '#ffffff', a: 'center', lh: 1.15, min: 12 }),
]);

const preisliste = {
  ...FAMILY,
  slug: 'flyer-wochenangebot-preisliste',
  name: 'Flyer A5 – Wochenangebot Preisliste',
  variant: 'Preisliste',
  description: 'Knalliger A5-Flyer für Wochenangebote: schwarzer Kopf mit riesiger Schlagzeile und Rabattstern, fünf Produktzeilen mit rotem Preisschild und eine Fußzeile mit Adresse und Öffnungszeiten.',
  tags: ['Flyer', 'Angebot', 'Wochenangebot', 'Preisliste', 'Rabatt', 'Sonderangebot', 'Supermarkt', 'Laden', 'Preis'],
  pages: [page(YEL, [
    rect('Kopf', 0, 0, 148, 62, BLK, { locked: true }),
    text('Etikett', 12, 10, 50, 6, 'Nur diese Woche', { f: 'Source Sans 3', s: 8, w: 700, c: '#ffffff', up: true, ls: 0.16, background: { color: RED, radius: 1.5, padding: 2 }, fit: 'none' }),
    text('Schlagzeile', 12, 19, 124, 31, 'ANGEBOTE', { f: 'Anton', s: 68, c: YEL, ls: 0.01, lh: 1.15, min: 40, a: 'left' }),
    text('Gültigkeit', 12, 50, 100, 6, 'Gültig von Mo, 1. bis Sa, 6. November', { f: 'Source Sans 3', s: 10, w: 600, c: '#ffffff', min: 7 }),
    group('Rabattstern', [
      shape('star', 'Stern', 108, 6, 34, 34, RED, { points: 18, inner: 0.88 }),
      text('Stern bis zu', 109, 13.5, 32, 5, 'bis zu', { f: 'Source Sans 3', s: 8, w: 700, c: '#ffffff', a: 'center', up: true, ls: 0.1, min: 5 }),
      text('Stern Prozent', 109, 18, 32, 12, '–30 %', { f: 'Anton', s: 28, c: '#ffffff', a: 'center', lh: 1.1, min: 14 }),
    ], { rotation: 9 }),
    listRow(1, 68, 'Frische Erdbeeren', '500 g Schale, aus der Region', typo.euro(2.99)),
    listRow(2, 93, 'Bauernbrot', '750 g, im Steinofen gebacken', typo.euro(3.5)),
    listRow(3, 118, 'Ziegenfrischkäse', '150 g, vom Hof nebenan', typo.euro(2.29)),
    listRow(4, 143, 'Eier aus Freilandhaltung', '10 Stück, Größe M', typo.euro(3.19)),
    listRow(5, 168, 'Naturtrüber Apfelsaft', '1 Liter, Streuobstwiese', typo.euro(1.89)),
    rect('Fußzeile', 0, 194, 148, 16, BLK, { locked: true }),
    text('Name', 12, 196, 124, 6, 'Hofladen Wiesengrund', { f: 'Oswald', s: 12, w: 600, c: YEL, up: true, ls: 0.06, min: 8 }),
    text('Kontakt', 12, 202.5, 124, 5, `${ADDRESS}  ·  Mo${typo.dash}Sa 8${typo.dash}18 Uhr`, { f: 'Source Sans 3', s: 8, c: '#ffffff', min: 6 }),
  ])],
};

// ---- Handgemacht: kraft paper, hand lettering, round products with price stickers
const PAPER = '#f4e8d0';
const BROWN = '#4a3524';
const TERRA = '#c8553d';
const product = (n, x, y, iconName, name, sub, price, tilt) => group('Produkt ' + n, [
  ellipse(`Teller ${n}`, x + 12, y, 42, 42, '#e8d6b0'),
  ellipse(`Teller ${n} Ring`, x + 14, y + 2, 38, 38, null, { stroke: BROWN, sw: 0.5, dash: 'dashed', opacity: 0.55 }),
  icon(`Symbol ${n}`, iconName, x + 22.5, y + 10.5, 21, BROWN, 1.4),
  ellipse(`Aufkleber ${n}`, x + 40, y - 3, 25, 25, TERRA, { rotation: tilt }),
  text(`Preis ${n}`, x + 41, y + 4, 23, 11, price, { f: 'Patrick Hand', s: 15, c: '#ffffff', a: 'center', min: 8, rotation: tilt }),
  text(`Name ${n}`, x, y + 44, 66, 7, name, { f: 'Patrick Hand', s: 16, c: BROWN, a: 'center', min: 9 }),
  text(`Zusatz ${n}`, x, y + 51.5, 66, 5, sub, { f: 'Source Sans 3', s: 8.5, i: true, c: '#7a6450', a: 'center', min: 6 }),
]);

const handgemacht = {
  ...FAMILY,
  slug: 'flyer-wochenangebot-handgemacht',
  name: 'Flyer A5 – Wochenangebot Handgemacht',
  variant: 'Handgemacht',
  description: 'A5-Flyer im Kraftpapier-Look für Hofladen, Bäckerei oder Markt: Handschrift-Überschrift, vier runde Produkte mit Preisaufklebern, Weizenähren und eine schlichte Fußzeile.',
  tags: ['Flyer', 'Angebot', 'Wochenangebot', 'Hofladen', 'Bäckerei', 'Markt', 'Regional', 'Handgemacht', 'Rustikal', 'Preis'],
  pages: [page(PAPER, [
    deko('Weizen links', 'deko-blumen-weizenaehren-gold', 6, 8, 22, undefined, { locked: true, rotation: -6 }),
    deko('Weizen rechts', 'deko-blumen-weizenaehren-gold', 120, 8, 22, undefined, { locked: true, flipX: true, rotation: 6 }),
    text('Überschrift', 24, 10, 100, 26, 'Frisch vom Hof', { f: 'Amatic SC', w: 700, s: 58, c: BROWN, a: 'center', lh: 1, min: 30 }),
    text('Unterzeile', 24, 36, 100, 7, 'Unsere Angebote dieser Woche', { f: 'Patrick Hand', s: 14, c: TERRA, a: 'center', min: 9 }),
    deko('Trenner', 'deko-trenner-blattreihe-salbei', 29, 46, 90, undefined, { locked: true }),
    product(1, 6, 62, 'apple', 'Äpfel „Elstar“', '1 kg Netz', typo.euro(2.49), -10),
    product(2, 76, 62, 'wheat', 'Dinkelbrot', '750 g, frisch gebacken', typo.euro(3.5), 9),
    product(3, 6, 126, 'egg', 'Freiland-Eier', '10 Stück, Größe M', typo.euro(3.19), 8),
    product(4, 76, 126, 'milk', 'Frische Milch', '1 Liter, Glasflasche', typo.euro(1.39), -9),
    text('Gültig', 12, 188, 124, 5, `Gültig von Montag, 1. bis Samstag, 6. November`, { f: 'Patrick Hand', s: 11, c: BROWN, a: 'center', min: 7 }),
    rect('Linie', 12, 195, 124, 0.4, BROWN, { opacity: 0.4 }),
    text('Hof', 12, 197, 124, 5, 'Hofladen Wiesengrund', { f: 'Patrick Hand', s: 13, c: BROWN, a: 'center', min: 8 }),
    text('Kontakt', 12, 203, 124, 4, `${ADDRESS}  ·  ${PHONE}`, { f: 'Source Sans 3', s: 7.5, c: '#7a6450', a: 'center', min: 6 }),
  ])],
};

module.exports = { variants: [preisliste, handgemacht] };
