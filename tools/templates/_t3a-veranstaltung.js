'use strict';
const { dsl, pt, ADDRESS, PHONE, WEB, infoRow } = require('./_t3a-lib');
const { text, rect, ellipse, shape, icon, frame, deko, dekoIn, group, page, typo, qr, line } = dsl;

const FAMILY = { family: 'flyer-veranstaltung', familyName: 'Flyer für eine Veranstaltung', occasion: 'Feste & Events', category: 'Flyer' };

// ---- Bildfläche: big picture area, date badge, three info rows
const TEAL = '#0f4c5c';
const ORANGE = '#fb8b24';
const SAND = '#fdf6ec';
const bildflaeche = {
  ...FAMILY,
  slug: 'flyer-veranstaltung-bildflaeche',
  name: 'Flyer A5 – Veranstaltung Bildfläche',
  variant: 'Bildfläche',
  formatKey: 'a5-portrait', width: 148, height: 210,
  description: 'A5-Flyer für Konzert, Lesung oder Stadtteilfest: große Bildfläche oben (Foto einsetzen), runde Datumsplakette, Titel, Kurztext und drei Infozeilen mit Symbolen.',
  tags: ['Flyer', 'Veranstaltung', 'Event', 'Einladung', 'Kulturabend', 'Stadtteilfest', 'Foto', 'Programm', 'Eintritt'],
  pages: [page(SAND, [
    rect('Bild Hintergrund', 0, 0, 148, 92, '#cfe3e6', { locked: true }),
    icon('Bild Symbol', 'image', 62, 34, 24, '#8fb9c1', 1.3, { locked: true }),
    frame('Foto', 0, 0, 148, 92),
    rect('Streifen', 0, 92, 148, 3, ORANGE, { locked: true }),
    group('Datumsplakette', [
      ellipse('Plakette', 10, 74, 36, 36, ORANGE),
      text('Tag', 12, 80, 32, 14, '12', { f: 'Poppins', w: 700, s: 28, c: '#ffffff', a: 'center', lh: 1.2, min: 14 }),
      text('Monat', 12, 94, 32, 6, 'JUNI', { f: 'Poppins', w: 600, s: 10, c: TEAL, a: 'center', ls: 0.16, min: 7 }),
    ], { rotation: -6 }),
    text('Titel', 12, 113, 124, 26, 'Kulturabend\nim Stadtgarten', { f: 'Poppins', w: 700, s: 22, c: TEAL, a: 'left', v: 'top', wrap: true, lh: 1.15, min: 14 }),
    text('Beschreibung', 12, 141, 124, 12, 'Livemusik, Lesung und Mitmachaktionen für die ganze Familie.', { f: 'Source Sans 3', s: 11, c: '#4b5b60', a: 'left', v: 'top', wrap: true, lh: 1.35, min: 8 }),
    infoRow('Datum', 'calendar', 12, 158, 124, 'Wann', `Samstag, 12. Juni  ·  ab ${typo.time('17:00')}`, { c: TEAL, icolor: ORANGE, vs: 11, lc: '#7a8a8f' }),
    infoRow('Ort', 'map-pin', 12, 170, 124, 'Wo', 'Stadtgarten, Parkallee 3, Musterstadt', { c: TEAL, icolor: ORANGE, vs: 11, lc: '#7a8a8f' }),
    infoRow('Eintritt', 'ticket', 12, 182, 124, 'Eintritt', 'Frei, Spenden willkommen', { c: TEAL, icolor: ORANGE, vs: 11, lc: '#7a8a8f' }),
    rect('Fuß', 0, 199, 148, 11, TEAL, { locked: true }),
    text('Fußzeile', 12, 199, 124, 11, `Mehr Infos: ${WEB}  ·  ${PHONE}`, { f: 'Source Sans 3', s: 8.5, w: 600, c: '#ffffff', a: 'center', min: 6 }),
  ])],
};

// ---- Typografisch: black, lime, stacked Anton lines with a hollow word
const BLACK = '#121212';
const LIME = '#c8ff3d';
const typografisch = {
  ...FAMILY,
  slug: 'flyer-veranstaltung-typografisch',
  name: 'Flyer A5 – Veranstaltung Typografisch',
  variant: 'Typografisch',
  formatKey: 'a5-portrait', width: 148, height: 210,
  description: 'Mutiger A5-Flyer nur aus Schrift: schwarzer Grund, drei gestapelte Anton-Zeilen (eine hohl), Limetten-Akzent, Rubrik-Liste und Ort mit Zeit. Ohne Bild, nur Farbe und Typografie.',
  tags: ['Flyer', 'Veranstaltung', 'Event', 'Kulturnacht', 'Festival', 'Typografie', 'Schwarz', 'Modern', 'Programm'],
  pages: [page(BLACK, [
    text('Zeile 1', 10, 10, 128, 36, 'KULTUR', { f: 'Anton', s: 100, c: '#ffffff', lh: 1.15, a: 'left', min: 50 }),
    text('Zeile 2', 10, 44, 128, 36, 'NACHT', { f: 'Anton', s: 100, c: BLACK, outline: { color: LIME, width: 1.6 }, lh: 1.15, a: 'left', min: 50 }),
    text('Zeile 3', 10, 78, 128, 36, '2027', { f: 'Anton', s: 100, c: LIME, lh: 1.15, a: 'left', min: 50 }),
    rect('Balken', 12, 123, 124, 1.2, LIME, { locked: true }),
    text('Rubriken', 12, 129, 124, 24, 'Konzerte  /  Lesungen  /  Theater  /  Ausstellungen  /  Tanz', { f: 'Inter', w: 500, s: 12, c: '#ffffff', a: 'left', v: 'top', wrap: true, lh: 1.5, min: 8 }),
    text('Datum', 12, 160, 90, 12, 'Sa, 11. September', { f: 'Anton', s: 26, c: LIME, a: 'left', lh: 1.15, min: 14 }),
    text('Zeit', 12, 172, 90, 8, `18${typo.dash}24 Uhr`, { f: 'Inter', w: 600, s: 14, c: '#ffffff', a: 'left', min: 9 }),
    text('Ort', 12, 182, 90, 12, 'Altstadt Musterstadt\nTreffpunkt Marktplatz', { f: 'Inter', s: 9.5, c: '#bdbdbd', a: 'left', v: 'top', wrap: true, lh: 1.4, min: 7 }),
    group('Plakette', [
      ellipse('Plakette Kreis', 98, 156, 40, 40, LIME),
      text('Plakette Oben', 100, 164, 36, 8, 'EINTRITT', { f: 'Anton', s: 12, c: BLACK, a: 'center', ls: 0.08, min: 8 }),
      text('Plakette Unten', 100, 172, 36, 14, 'FREI', { f: 'Anton', s: 28, c: BLACK, a: 'center', lh: 1.1, min: 12 }),
    ], { rotation: 10 }),
    text('Web', 12, 198, 124, 6, WEB, { f: 'Inter', w: 500, s: 8, c: '#8a8a8a', a: 'left', min: 6 }),
  ])],
};

// ---- Geometrisch: DIN lang, circles and a pink pill, timetable below
const VIOLET = '#4b1d7c';
const PINK = '#ff4f8b';
const MINT = '#10c9b7';
const slot = (n, y, time, title) => [
  text(`Uhrzeit ${n}`, 9, y, 20, 8, time, { f: 'Raleway', w: 800, s: 13, c: PINK, a: 'left', min: 8 }),
  text(`Programm ${n}`, 30, y, 60, 8, title, { f: 'Raleway', w: 600, s: 11.5, c: VIOLET, a: 'left', min: 8 }),
  line(`Linie ${n}`, 9, y + 10.5, 90, y + 10.5, '#e4d9f0', 0.3),
];
const geometrisch = {
  ...FAMILY,
  slug: 'flyer-veranstaltung-geometrisch',
  name: 'Flyer DIN lang – Veranstaltung Geometrisch',
  variant: 'Geometrisch',
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  description: 'Schlanker DIN-lang-Flyer für ein Lichterfest oder eine Abendveranstaltung: violetter Kopf mit großen Kreisen, rosa Datumsstreifen und eine Zeittafel mit drei Programmpunkten.',
  tags: ['Flyer', 'DIN lang', 'Veranstaltung', 'Lichterfest', 'Laternenfest', 'Programm', 'Zeitplan', 'Geometrisch', 'Abend'],
  pages: [page('#ffffff', [
    rect('Kopf', 0, 0, 99, 104, VIOLET, { locked: true }),
    ellipse('Kreis Rosa', 52, -22, 74, 74, PINK, { locked: true }),
    ellipse('Kreis Mint', -22, 46, 58, 58, MINT, { opacity: 0.9, locked: true }),
    ellipse('Kreis Ring', 52, 52, 52, 52, null, { stroke: '#ffffff', sw: 1.2, opacity: 0.6, locked: true }),
    text('Anlass', 9, 14, 50, 6, 'Einladung zum', { f: 'Raleway', w: 600, s: 10, c: '#ffffff', up: true, ls: 0.2, min: 7 }),
    text('Titel', 9, 44, 82, 50, 'LICHTER\nFEST', { f: 'Raleway', w: 800, s: 38, c: '#ffffff', a: 'left', v: 'bottom', wrap: true, lh: 1.05, min: 20 }),
    rect('Datum Streifen', 0, 104, 99, 14, PINK, { locked: true }),
    text('Datum', 9, 104, 81, 14, `Freitag, 22. Oktober  ·  19 Uhr`, { f: 'Raleway', w: 700, s: 11, c: '#ffffff', a: 'left', min: 8 }),
    text('Programm Titel', 9, 126, 81, 6, 'Programm', { f: 'Raleway', w: 700, s: 8, c: '#8a6fa8', up: true, ls: 0.2, min: 6 }),
    slot(1, 135, '19:00', 'Laternenumzug'),
    slot(2, 148, '20:00', 'Feuershow'),
    slot(3, 161, '21:00', 'Musik & Suppe'),
    text('Eintritt', 9, 178, 81, 7, 'Eintritt frei', { f: 'Raleway', w: 800, s: 15, c: MINT, a: 'left', min: 9 }),
    text('Adresse', 9, 187, 81, 12, 'Festplatz am Schloss\nSchlossallee 1, Musterstadt', { f: 'Raleway', s: 8.5, c: '#5a4a6e', a: 'left', v: 'top', wrap: true, lh: 1.4, min: 6 }),
    rect('Fuß', 0, 202, 99, 8, VIOLET, { locked: true }),
    text('Web', 9, 199.5, 81, 8, WEB, { f: 'Raleway', w: 600, s: 8, c: '#ffffff', a: 'left', min: 6 }),
  ])],
};

module.exports = { variants: [bildflaeche, typografisch, geometrisch] };
