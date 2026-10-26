'use strict';
const { dsl, pt, ADDRESS, PHONE, WEB, infoRow } = require('./_t3a-lib');
const { text, rect, ellipse, shape, icon, frame, deko, dekoIn, group, page, typo, qr, line, gradient, shadow } = dsl;

const FAMILY = { family: 'flyer-mittagstisch', familyName: 'Flyer Mittagstisch', occasion: 'Gastronomie', category: 'Flyer' };

// ---- Tafel: A5, chalkboard with hand lettering and a thin chalk frame
const BOARD = '#22302a';
const CHALK = '#f4f1e6';
const CHALK2 = '#ffd98a';
const dish = (n, y, name, sub, price) => [
  text(`Gericht ${n}`, 20, y, 92, 9, name, { f: 'Patrick Hand', s: 17, c: CHALK, a: 'left', min: 10 }),
  text(`Gericht ${n} Zusatz`, 20, y + 8.5, 92, 6, sub, { f: 'Source Sans 3', i: true, s: 9, c: '#b9c4bb', a: 'left', min: 6 }),
  text(`Preis ${n}`, 112, y, 16, 9, price, { f: 'Patrick Hand', s: 17, c: CHALK2, a: 'right', min: 10 }),
  line(`Punkte ${n}`, 20, y + 16, 128, y + 16, '#5d7165', 0.3, { dash: 'dotted' }),
];
const tafel = {
  ...FAMILY,
  slug: 'flyer-mittagstisch-tafel',
  name: 'Flyer A5 – Mittagstisch Tafel',
  variant: 'Tafel',
  formatKey: 'a5-portrait', width: 148, height: 210,
  description: 'A5-Flyer für Mittagstisch oder Tagesgericht im Kreidetafel-Look: dunkelgrüner Grund, Schrift in Handschrift, Kreiderahmen, vier Gerichte mit Preisen und Zeiten.',
  tags: ['Flyer', 'Mittagstisch', 'Tagesgericht', 'Restaurant', 'Gastronomie', 'Tafel', 'Kreide', 'Speisekarte', 'Cafe', 'Mittagsmenü'],
  pages: [page(BOARD, [
    dekoIn('Kreiderahmen', 'deko-rahmen-doppellinie-hoch-weiss', 6, 6, 136, 198, { locked: true, opacity: 0.55 }),
    text('Überschrift', 16, 16, 116, 22, 'Mittagstisch', { f: 'Amatic SC', w: 700, s: 62, c: CHALK, a: 'center', min: 30 }),
    text('Zeiten', 16, 38, 116, 8, `Montag bis Freitag, 11:30${typo.dash}14:30 Uhr`, { f: 'Patrick Hand', s: 13, c: CHALK2, a: 'center', min: 8 }),
    deko('Trenner', 'deko-trenner-welle-gold', 34, 49, 80, undefined, { locked: true, opacity: 0.8 }),
    dish(1, 64, 'Kürbissuppe', 'mit Kernöl und Brot', typo.euro(5.9)),
    dish(2, 86, 'Schnitzel Wiener Art', 'Kartoffelsalat, Zitrone', typo.euro(10.9)),
    dish(3, 108, 'Spinatlasagne', 'mit Blattsalat, vegetarisch', typo.euro(9.5)),
    dish(4, 130, 'Linsen-Curry', 'Basmatireis, vegan', typo.euro(8.9)),
    text('Zusatz', 20, 150, 108, 8, 'Dazu: Getränk und kleiner Nachtisch', { f: 'Patrick Hand', s: 13, c: CHALK, a: 'center', min: 8 }),
    text('Zusatz Preis', 20, 158, 108, 8, `nur ${typo.euro(2.5)}`, { f: 'Patrick Hand', s: 15, c: CHALK2, a: 'center', min: 8 }),
    text('Wirt', 16, 174, 116, 8, 'Gasthaus Zur Linde', { f: 'Amatic SC', w: 700, s: 26, c: CHALK, a: 'center', min: 12, ls: 0.06 }),
    text('Adresse', 16, 183, 116, 6, `${ADDRESS}  ·  ${PHONE}`, { f: 'Source Sans 3', s: 8.5, c: '#b9c4bb', a: 'center', min: 6 }),
  ])],
};

// ---- Wochenkarte: DIN lang, modern, day chips
const TOMATO = '#e4452f';
const INK = '#1e1e24';
const day = (n, y, d, name, price) => [
  rect(`Tag ${n}`, 9, y, 17, 17, TOMATO, { radius: 3 }),
  text(`Tag ${n} Text`, 9, y, 17, 17, d, { f: 'Poppins', w: 700, s: 11, c: '#ffffff', a: 'center', min: 7 }),
  text(`Gericht ${n}`, 30, y, 48, 17, name, { f: 'Poppins', w: 600, s: 9.5, c: INK, a: 'left', v: 'middle', wrap: true, lh: 1.25, min: 6 }),
  text(`Preis ${n}`, 74, y, 16, 17, price, { f: 'Poppins', w: 600, s: 9.5, c: TOMATO, a: 'right', v: 'middle', min: 6 }),
];
const wochenkarte = {
  ...FAMILY,
  slug: 'flyer-mittagstisch-wochenkarte',
  name: 'Flyer DIN lang – Mittagstisch Wochenkarte',
  variant: 'Wochenkarte',
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  description: 'Praktischer DIN-lang-Flyer mit der Wochenkarte: roter Kopf mit Teller-Symbol, fünf Zeilen Montag bis Freitag mit Gericht und Preis, Hinweis auf Lieferung und Öffnungszeiten.',
  tags: ['Flyer', 'DIN lang', 'Mittagstisch', 'Wochenkarte', 'Wochenplan', 'Kantine', 'Imbiss', 'Gastronomie', 'Tagesangebot'],
  pages: [page('#ffffff', [
    rect('Kopf', 0, 0, 99, 52, TOMATO, { locked: true }),
    ellipse('Teller', 62, 8, 42, 42, '#ffffff', { opacity: 0.14, locked: true }),
    icon('Besteck', 'utensils-crossed', 70, 16, 20, '#ffffff', 1.5, { locked: true }),
    text('Etikett', 9, 12, 40, 5, 'Diese Woche', { f: 'Poppins', w: 600, s: 8, c: '#ffffff', up: true, ls: 0.16, min: 6 }),
    text('Titel', 9, 18, 60, 22, 'Mittags-\ntisch', { f: 'Poppins', w: 700, s: 24, c: '#ffffff', a: 'left', v: 'top', wrap: true, lh: 1.1, min: 14 }),
    text('Zeiten', 9, 41, 80, 6, `11:30${typo.dash}14:00 Uhr`, { f: 'Poppins', w: 500, s: 9.5, c: '#ffe3dc', a: 'left', min: 7 }),
    day(1, 62, 'Mo', 'Gemüsecurry mit Reis', typo.euro(8.5)),
    day(2, 84, 'Di', 'Spaghetti Bolognese', typo.euro(8.9)),
    day(3, 106, 'Mi', 'Hähnchenbrust, Ofengemüse', typo.euro(9.5)),
    day(4, 128, 'Do', 'Käsespätzle mit Röstzwiebeln', typo.euro(8.9)),
    day(5, 150, 'Fr', 'Backfisch, Kartoffelsalat', typo.euro(9.9)),
    line('Linie', 9, 176, 90, 176, '#e6e6ea', 0.4),
    text('Hinweis', 9, 179, 81, 8, 'Alle Gerichte auch zum Mitnehmen.\nLieferung ab 3 Portionen frei Haus.', { f: 'Poppins', s: 7.5, c: '#5b5b66', a: 'left', v: 'top', wrap: true, lh: 1.45, min: 6 }),
    text('Name', 9, 193, 81, 6, 'Bistro Am Markt', { f: 'Poppins', w: 700, s: 10, c: INK, a: 'left', min: 7 }),
    text('Kontakt', 9, 199, 81, 5, `${ADDRESS.split(',')[0]}  ·  ${PHONE}`, { f: 'Poppins', s: 7.5, c: '#5b5b66', a: 'left', min: 6 }),
  ])],
};

// ---- Trattoria: A5 landscape, tricolour band, script title and olive branch
const CREAM = '#fbf3e2';
const ITGREEN = '#2f7d4f';
const ITRED = '#c8362b';
const line2 = (n, x, y, name, price) => [
  text(`Pizza ${n}`, x, y, 62, 6, name, { f: 'Lora', w: 600, s: 11, c: '#2b2b2b', a: 'left', min: 7 }),
  text(`Pizza ${n} Preis`, x + 58, y, 20, 6, price, { f: 'Lora', w: 700, s: 11, c: ITRED, a: 'right', min: 7 }),
  line(`Pizza ${n} Linie`, x, y + 7.4, x + 78, y + 7.4, '#d9cdb4', 0.3, { dash: 'dotted' }),
];
const trattoria = {
  ...FAMILY,
  slug: 'flyer-mittagstisch-trattoria',
  name: 'Flyer A5 quer – Mittagstisch Trattoria',
  variant: 'Trattoria',
  formatKey: 'a5-landscape', width: 210, height: 148,
  description: 'Querformatiger A5-Flyer für Pizzeria oder Trattoria: Trikolore-Band, Schreibschrift-Titel mit Olivenzweig, zwei Spalten mit Pizza und Pasta zum Mittagspreis und Öffnungszeiten.',
  tags: ['Flyer', 'Querformat', 'Mittagstisch', 'Pizzeria', 'Trattoria', 'Pizza', 'Pasta', 'Italienisch', 'Restaurant', 'Mittagskarte'],
  pages: [page(CREAM, [
    rect('Band Grün', 0, 0, 70, 8, ITGREEN, { locked: true }),
    rect('Band Weiß', 70, 0, 70, 8, '#ffffff', { locked: true }),
    rect('Band Rot', 140, 0, 70, 8, ITRED, { locked: true }),
    text('Titel', 14, 16, 120, 28, 'Pizza & Pasta', { f: 'Parisienne', s: 52, c: ITRED, a: 'left', lh: 1.3, min: 28 }),
    text('Untertitel', 16, 47, 120, 8, 'MITTAGSKARTE  ·  MONTAG BIS FREITAG  ·  12 BIS 15 UHR', { f: 'Lora', w: 600, s: 8.5, c: ITGREEN, ls: 0.1, a: 'left', min: 6 }),
    deko('Olivenzweig', 'deko-blumen-olivenzweig-salbei', 142, 14, 56, undefined, { locked: true, rotation: 4 }),
    text('Spalte 1', 14, 58, 60, 6, 'PIZZA', { f: 'Cinzel', w: 700, s: 9, c: ITGREEN, ls: 0.2, a: 'left', min: 6 }),
    line2(1, 14, 67, 'Margherita', typo.euro(7.9)),
    line2(2, 14, 77, 'Salame piccante', typo.euro(8.9)),
    line2(3, 14, 87, 'Quattro Formaggi', typo.euro(9.5)),
    text('Spalte 2', 112, 58, 60, 6, 'PASTA', { f: 'Cinzel', w: 700, s: 9, c: ITGREEN, ls: 0.2, a: 'left', min: 6 }),
    line2(4, 112, 67, 'Spaghetti Aglio e olio', typo.euro(7.9)),
    line2(5, 112, 77, 'Penne all’Arrabbiata', typo.euro(8.5)),
    line2(6, 112, 87, 'Tagliatelle al Ragù', typo.euro(9.9)),
    rect('Preisband', 14, 106, 182, 16, ITGREEN, { radius: 2 }),
    text('Preisband Text', 14, 106, 182, 16, `Jedes Mittagsgericht inklusive Salat und Espresso`, { f: 'Lora', i: true, w: 500, s: 12, c: '#ffffff', a: 'center', min: 8 }),
    text('Adresse', 14, 129, 182, 7, `Trattoria Da Marco  ·  ${ADDRESS}  ·  Tisch reservieren: ${PHONE}`, { f: 'Lora', s: 8.5, c: '#4a4a4a', a: 'center', min: 6 }),
  ])],
};

module.exports = { variants: [tafel, wochenkarte, trattoria] };
