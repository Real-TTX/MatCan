'use strict';
const { dsl, pt, ADDRESS, PHONE, WEB, infoRow } = require('./_t3a-lib');
const { text, rect, ellipse, shape, icon, frame, deko, dekoIn, group, page, typo, qr, line, gradient, shadow } = dsl;

const FAMILY = { family: 'flyer-handwerker', familyName: 'Flyer Handwerker', occasion: 'Business', category: 'Flyer' };

// ---- Meisterbetrieb: A5, navy and orange, service grid in cards
const NAVY = '#12263f';
const ORANGE = '#f28c28';
const services = [['hammer', 'Reparaturen'], ['paintbrush', 'Maler- und Lackierarbeiten'], ['wrench', 'Sanitär und Heizung'], ['zap', 'Elektroinstallation'], ['door-open', 'Türen und Fenster'], ['ruler', 'Ausbau und Trockenbau']];
const svc = (i, x, y, [ic, label]) => [
  rect(`Leistung ${i}`, x, y, 62, 26, '#ffffff', { radius: 3, shadow: shadow(NAVY, 0.12, 3, 0, 0.8) }),
  ellipse(`Leistung ${i} Kreis`, x + 4, y + 7, 12, 12, ORANGE),
  icon(`Leistung ${i} Symbol`, ic, x + 6.4, y + 9.4, 7.2, '#ffffff', 2),
  text(`Leistung ${i} Text`, x + 19, y + 3, 40, 20, label, { f: 'Open Sans', w: 700, s: 9.5, c: NAVY, a: 'left', v: 'middle', wrap: true, lh: 1.25, min: 6 }),
];
const meister = {
  ...FAMILY,
  slug: 'flyer-handwerker-meisterbetrieb',
  name: 'Flyer A5 – Handwerker Meisterbetrieb',
  variant: 'Meisterbetrieb',
  formatKey: 'a5-portrait', width: 148, height: 210,
  description: 'Seriöser A5-Flyer für Handwerksbetrieb, Hausmeisterservice oder Renovierung: marineblauer Kopf mit Firmenname und Meisterbetrieb-Plakette, sechs Leistungskarten mit Symbolen, Kontakt mit Telefon.',
  tags: ['Flyer', 'Handwerker', 'Handwerk', 'Meisterbetrieb', 'Renovierung', 'Hausmeister', 'Reparatur', 'Sanitär', 'Elektro', 'Dienstleistung'],
  pages: [page('#f2f4f7', [
    rect('Kopf', 0, 0, 148, 70, NAVY, { locked: true }),
    shape('hexagon', 'Logo Fläche', 12, 12, 24, 26, ORANGE, { locked: true }),
    icon('Logo Symbol', 'hammer', 17.5, 18.5, 13, NAVY, 2, { locked: true }),
    text('Firma', 42, 14, 94, 10, 'Schneider & Söhne', { f: 'Open Sans', w: 800, s: 17, c: '#ffffff', a: 'left', min: 10 }),
    text('Firma Zusatz', 42, 24, 94, 6, 'MEISTERBETRIEB SEIT 1987', { f: 'Open Sans', w: 600, s: 7.5, c: ORANGE, ls: 0.18, a: 'left', min: 5 }),
    text('Titel', 12, 46, 92, 16, 'Wir machen’s fertig.', { f: 'Open Sans', w: 800, s: 21, c: '#ffffff', a: 'left', min: 14 }),
    text('Einleitung', 12, 78, 124, 10, 'Zuverlässig, sauber und zum Festpreis – alles aus einer Hand für Haus und Wohnung.', { f: 'Open Sans', s: 9.5, c: '#3a4a5e', a: 'left', v: 'top', wrap: true, lh: 1.4, min: 7 }),
    ...services.map((s, i) => svc(i + 1, 10 + (i % 2) * 66, 94 + Math.floor(i / 2) * 30, s)),
    group('Plakette', [
      ellipse('Plakette Kreis', 106, 40, 32, 32, ORANGE),
      text('Plakette Oben', 106, 46, 32, 6, 'KOSTENLOSES', { f: 'Open Sans', w: 700, s: 7, c: NAVY, a: 'center', ls: 0.06, min: 4 }),
      text('Plakette Mitte', 106, 51, 32, 9, 'Angebot', { f: 'Open Sans', w: 800, s: 12.5, c: NAVY, a: 'center', min: 7 }),
      text('Plakette Unten', 106, 59.5, 32, 6, 'vor Ort', { f: 'Open Sans', w: 700, s: 7.5, c: NAVY, a: 'center', min: 5 }),
    ], { rotation: 10 }),
    rect('Fuß', 0, 188, 148, 22, NAVY, { locked: true }),
    icon('Telefon', 'phone', 12, 193, 8, ORANGE, 2),
    text('Nummer', 23, 191.5, 70, 10, PHONE, { f: 'Open Sans', w: 800, s: 16, c: '#ffffff', a: 'left', min: 9 }),
    text('Adresse', 23, 200, 118, 6, `${ADDRESS}  ·  ${WEB}`, { f: 'Open Sans', s: 7.5, c: '#b8c4d4', a: 'left', min: 5 }),
  ])],
};

// ---- Warnstreifen: DIN lang, yellow with black hazard stripes
const YEL = '#ffd400';
const BLK = '#161616';
const stripesTop = Array.from({ length: 11 }, (_, i) => rect('Streifen ' + (i + 1), -20 + i * 14, -13, 7, 60, BLK, { rotation: -40, locked: true }));
const stripesBottom = Array.from({ length: 11 }, (_, i) => rect('Streifen unten ' + (i + 1), -20 + i * 14, 185, 7, 40, BLK, { rotation: -40, locked: true }));
const punkt = (n, y, label) => [
  rect(`Punkt ${n}`, 10, y + 1, 4, 4, BLK, { locked: true }),
  text(`Leistung ${n}`, 18, y - 1, 72, 8, label, { f: 'Oswald', w: 500, s: 14, c: BLK, a: 'left', min: 8 }),
];
const warnstreifen = {
  ...FAMILY,
  slug: 'flyer-handwerker-warnstreifen',
  name: 'Flyer DIN lang – Handwerker Warnstreifen',
  variant: 'Warnstreifen',
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  description: 'Auffälliger DIN-lang-Flyer für Hausmeister, Umzug, Entrümpelung oder Gartenbau: gelber Grund mit schwarzen Warnstreifen oben und unten, Oswald-Schlagzeile und Leistungsliste mit Telefon.',
  tags: ['Flyer', 'DIN lang', 'Handwerker', 'Hausmeisterservice', 'Entrümpelung', 'Umzug', 'Gartenbau', 'Warnstreifen', 'Gelb', 'Schnellservice'],
  pages: [page(YEL, [
    ...stripesTop,
    rect('Titelfeld', 0, 34, 99, 64, BLK, { locked: true }),
    text('Etikett', 10, 40, 79, 6, 'SCHNELL · SAUBER · FAIR', { f: 'Oswald', w: 500, s: 9, c: YEL, ls: 0.18, a: 'left', min: 6 }),
    text('Titel', 10, 47, 82, 48, 'HAUS-\nMEISTER\nSERVICE', { f: 'Oswald', w: 700, s: 30, c: '#ffffff', a: 'left', v: 'top', wrap: true, lh: 1.05, min: 16 }),
    punkt(1, 110, 'Kleinreparaturen'),
    punkt(2, 121, 'Gartenpflege und Winterdienst'),
    punkt(3, 132, 'Umzüge und Transporte'),
    punkt(4, 143, 'Entrümpelung'),
    punkt(5, 154, 'Montage und Aufbau'),
    ...stripesBottom,
    rect('Kontaktfeld', 0, 166, 99, 36, YEL, { locked: true }),
    text('Anrufen', 10, 168, 79, 6, 'JETZT ANRUFEN', { f: 'Oswald', w: 500, s: 10, c: BLK, ls: 0.18, a: 'left', min: 6 }),
    text('Nummer', 10, 175, 82, 14, PHONE, { f: 'Oswald', w: 700, s: 26, c: BLK, a: 'left', min: 14 }),
    text('Hinweis', 10, 190, 82, 6, 'Kostenloser Kostenvoranschlag', { f: 'Source Sans 3', w: 700, s: 9, c: BLK, a: 'left', min: 6 }),
  ])],
};

// ---- Modern: A5, white and teal, big numbers for facts
const TEAL = '#0f766e';
const facts = (n, x, big, small) => [
  text(`Zahl ${n}`, x, 150, 38, 14, big, { f: 'Inter', w: 800, s: 26, c: TEAL, a: 'left', min: 12 }),
  text(`Zahl ${n} Text`, x, 164, 38, 9, small, { f: 'Inter', s: 8, c: '#4b5563', a: 'left', v: 'top', wrap: true, lh: 1.35, min: 6 }),
];
const modern = {
  ...FAMILY,
  slug: 'flyer-handwerker-modern',
  name: 'Flyer A5 – Handwerker Modern',
  variant: 'Modern',
  formatKey: 'a5-portrait', width: 148, height: 210,
  description: 'Heller, aufgeräumter A5-Flyer für Maler, Fliesenleger oder Tischler: viel Weiß, Titel in Inter, drei Kennzahlen (Jahre, Aufträge, Garantie), Leistungsliste in zwei Spalten und Kontaktfeld in Petrol.',
  tags: ['Flyer', 'Handwerker', 'Maler', 'Fliesenleger', 'Tischler', 'Modern', 'Minimal', 'Garantie', 'Angebot', 'Renovierung'],
  pages: [page('#ffffff', [
    text('Firma', 12, 12, 100, 6, 'KRAUSE  AUSBAU', { f: 'Inter', w: 800, s: 9, c: TEAL, ls: 0.24, a: 'left', min: 6 }),
    rect('Akzent', 12, 22, 14, 1.2, TEAL, { locked: true }),
    text('Titel', 12, 28, 124, 44, 'Ihr Zuhause,\nneu gedacht.', { f: 'Inter', w: 800, s: 32, c: '#111827', a: 'left', v: 'top', wrap: true, lh: 1.12, min: 18 }),
    text('Einleitung', 12, 66, 100, 18, 'Von der Beratung bis zur Schlüsselübergabe: Wir planen und bauen aus, ohne Chaos und mit festem Termin.', { f: 'Inter', s: 10, c: '#4b5563', a: 'left', v: 'top', wrap: true, lh: 1.5, min: 7 }),
    text('Spalte 1', 12, 104, 60, 6, 'LEISTUNGEN', { f: 'Inter', w: 700, s: 7.5, c: TEAL, ls: 0.2, a: 'left', min: 5 }),
    text('Liste 1', 12, 112, 60, 30, 'Malerarbeiten\nFliesen und Bäder\nParkett und Böden\nTrockenbau', { f: 'Inter', w: 500, s: 10.5, c: '#111827', a: 'left', v: 'top', wrap: true, lh: 1.7, min: 7 }),
    text('Spalte 2', 80, 104, 56, 6, 'SERVICE', { f: 'Inter', w: 700, s: 7.5, c: TEAL, ls: 0.2, a: 'left', min: 5 }),
    text('Liste 2', 80, 112, 56, 30, 'Beratung vor Ort\nFestpreisangebot\nSaubere Baustelle\nEntsorgung', { f: 'Inter', w: 500, s: 10.5, c: '#111827', a: 'left', v: 'top', wrap: true, lh: 1.7, min: 7 }),
    line('Linie', 12, 146, 136, 146, '#e5e7eb', 0.4),
    facts(1, 12, '25', 'Jahre\nErfahrung'),
    facts(2, 56, '1.200', 'zufriedene\nKunden'),
    facts(3, 100, '5 J.', 'Garantie auf\nunsere Arbeit'),
    rect('Kontaktfeld', 0, 182, 148, 28, TEAL, { locked: true }),
    text('Kontakt Titel', 12, 186, 80, 6, 'Kostenloses Angebot anfragen', { f: 'Inter', w: 700, s: 10, c: '#ffffff', a: 'left', min: 7 }),
    text('Kontakt', 12, 193, 124, 12, `${PHONE}  ·  info@beispiel.de\n${ADDRESS}`, { f: 'Inter', s: 8.5, c: '#c6ebe6', a: 'left', v: 'top', wrap: true, lh: 1.5, min: 6 }),
  ])],
};

module.exports = { variants: [meister, warnstreifen, modern] };
