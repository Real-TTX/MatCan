'use strict';
const { dsl, pt, ADDRESS, PHONE, WEB, infoRow, tearOff } = require('./_t3a-lib');
const { text, rect, ellipse, shape, icon, frame, deko, dekoIn, group, page, typo, qr, line, ruled, gradient, shadow } = dsl;

const FAMILY = { family: 'flyer-nachhilfe', familyName: 'Flyer Nachhilfe', occasion: 'Verein & Schule', category: 'Flyer' };

// ---- Schulheft: A5, lined paper with a red margin, handwriting
const INKBLUE = '#1f3a8a';
const MARGIN = '#e0556a';
const subject = (n, y, label) => [
  icon(`Fach ${n} Haken`, 'check', 30, y + 0.6, 6, MARGIN, 2.6),
  text(`Fach ${n}`, 40, y - 1, 90, 8, label, { f: 'Caveat', w: 700, s: 22, c: INKBLUE, a: 'left', min: 12 }),
];
const schulheft = {
  ...FAMILY,
  slug: 'flyer-nachhilfe-schulheft',
  name: 'Flyer A5 – Nachhilfe Schulheft',
  variant: 'Schulheft',
  formatKey: 'a5-portrait', width: 148, height: 210,
  description: 'Verspielter A5-Flyer für Nachhilfe und Hausaufgabenhilfe: liniertes Heftblatt mit rotem Rand, Titel in Schulschrift, Fächerliste mit Häkchen, Notenzettel „Note 1“ als Stempel und Kontakt.',
  tags: ['Flyer', 'Nachhilfe', 'Hausaufgabenhilfe', 'Schule', 'Schulheft', 'Mathe', 'Deutsch', 'Englisch', 'Lernen', 'Schüler'],
  pages: [page('#fdfcf5', [
    ruled('Linie', 0, 30, 148, 22, 8, { color: '#bcd4ee', sw: 0.25 }),
    line('Rand', 24, 0, 24, 210, MARGIN, 0.4, { opacity: 0.8, locked: true }),
    text('Titel', 28, 12, 112, 24, 'Nachhilfe', { f: 'Caveat', w: 700, s: 62, c: INKBLUE, a: 'left', lh: 1.1, min: 30 }),
    line('Unterstrich', 30, 38, 120, 38, MARGIN, 0.8, { locked: true }),
    text('Untertitel', 28, 42, 112, 8, 'für Klasse 5 bis 10  ·  Einzeln oder zu zweit', { f: 'Caveat', w: 700, s: 17, c: '#4a4a5a', a: 'left', min: 9 }),
    subject(1, 62, 'Mathe'),
    subject(2, 70, 'Deutsch'),
    subject(3, 78, 'Englisch'),
    subject(4, 86, 'Physik und Chemie'),
    group('Note', [
      ellipse('Note Kreis', 96, 108, 36, 36, null, { stroke: MARGIN, sw: 2 }),
      text('Note Text', 96, 111, 36, 28, '1', { f: 'Caveat', w: 700, s: 66, c: MARGIN, a: 'center', lh: 1, min: 30 }),
    ], { rotation: -12 }),
    text('Versprechen', 28, 110, 66, 28, 'Verständlich erklärt,\ngeduldig geübt,\nbessere Noten.', { f: 'Caveat', w: 700, s: 19, c: '#4a4a5a', a: 'left', v: 'top', wrap: true, lh: 1.25, min: 10 }),
    rect('Preis Karte', 30, 154, 100, 18, '#fff3b0', { radius: 2, rotation: -1.5 }),
    text('Preis', 30, 154, 100, 18, `Probestunde gratis  ·  danach ${typo.euro(22, 0)} pro Stunde`, { f: 'Caveat', w: 700, s: 17, c: '#4a3b00', a: 'center', min: 9, rotation: -1.5 }),
    infoRow('Telefon', 'phone', 30, 182, 100, '', `${PHONE}  ·  Lena Hoffmann, Studentin`, { f: 'Source Sans 3', c: INKBLUE, icolor: MARGIN, vs: 10, vw: 700, ic: 6 }),
    infoRow('Mail', 'mail', 30, 191, 100, '', 'nachhilfe@beispiel.de', { f: 'Source Sans 3', c: INKBLUE, icolor: MARGIN, vs: 10, vw: 600, ic: 6 }),
  ])],
};

// ---- Fächer: A5, navy and yellow with six subject tiles
const NAVY = '#14213d';
const YEL = '#fcc419';
const tiles = [['calculator', 'Mathe', '#4dabf7'], ['book-open', 'Deutsch', '#ff8787'], ['languages', 'Sprachen', '#69db7c'], ['flask-conical', 'Chemie', '#b197fc'], ['atom', 'Physik', '#ffa94d'], ['music', 'Musik', '#38d9a9']];
const tile = (i, x, y, [ic, label, color]) => [
  rect(`Fach ${i}`, x, y, 38, 30, color, { radius: 4 }),
  icon(`Fach ${i} Symbol`, ic, x + 4, y + 4, 11, NAVY, 2),
  text(`Fach ${i} Text`, x + 4, y + 18, 32, 8, label, { f: 'Poppins', w: 700, s: 11, c: NAVY, a: 'left', min: 7 }),
];
const faecher = {
  ...FAMILY,
  slug: 'flyer-nachhilfe-faecher',
  name: 'Flyer A5 – Nachhilfe Fächer',
  variant: 'Fächer',
  formatKey: 'a5-portrait', width: 148, height: 210,
  description: 'Klar gegliederter A5-Flyer für Nachhilfeinstitut oder Lernstudio: dunkelblauer Grund, gelbe Schlagzeile, sechs farbige Fächerkacheln mit Symbolen, Vorteile in einer Zeile und Anmeldebutton.',
  tags: ['Flyer', 'Nachhilfe', 'Lernstudio', 'Nachhilfeinstitut', 'Fächer', 'Mathe', 'Schule', 'Abitur', 'Prüfung', 'Bunt'],
  pages: [page(NAVY, [
    text('Etikett', 12, 12, 60, 6, 'Lernstudio Klartext', { f: 'Poppins', w: 600, s: 8.5, c: NAVY, up: true, ls: 0.12, background: { color: YEL, radius: 3, padding: 2 }, fit: 'none' }),
    text('Titel', 12, 22, 124, 38, 'Gute Noten\nsind lernbar.', { f: 'Poppins', w: 800, s: 28, c: '#ffffff', a: 'left', v: 'top', wrap: true, lh: 1.15, min: 16 }),
    text('Untertitel', 12, 62, 124, 6, 'Nachhilfe für Schule, Ausbildung und Abitur', { f: 'Poppins', s: 9.5, c: YEL, a: 'left', min: 7 }),
    ...tiles.map((t, i) => tile(i + 1, 10 + (i % 3) * 41.5, 76 + Math.floor(i / 3) * 34, t)),
    text('Vorteile', 12, 148, 124, 14, 'Kleine Gruppen  ·  Geprüfte Lehrkräfte\nKostenlose Probestunde', { f: 'Poppins', w: 500, s: 9.5, c: '#dbe3f5', a: 'center', v: 'top', wrap: true, lh: 1.5, min: 6 }),
    rect('Button', 12, 168, 124, 16, YEL, { radius: 8 }),
    text('Button Text', 12, 168, 124, 16, `Jetzt Termin sichern: ${PHONE}`, { f: 'Poppins', w: 700, s: 11, c: NAVY, a: 'center', min: 7 }),
    text('Adresse', 12, 190, 124, 12, `${ADDRESS}\n${WEB}`, { f: 'Poppins', s: 8, c: '#9fb0d4', a: 'center', v: 'top', wrap: true, lh: 1.5, min: 6 }),
  ])],
};

// ---- Aushang mit Abreißzetteln
const GREENB = '#2f9e44';
const aushang = {
  ...FAMILY,
  slug: 'flyer-nachhilfe-aushang',
  name: 'Aushang A4 – Nachhilfe mit Abreißzetteln',
  variant: 'Aushang',
  formatKey: 'tearoff-a4', width: 210, height: 297,
  description: 'A4-Aushang für Schwarzes Brett, Bäcker oder Supermarkt: große Schlagzeile, drei Fächer, Preis und Kontakt, unten acht Abreißzettel mit senkrechter Schrift und Telefonnummer.',
  tags: ['Aushang', 'Nachhilfe', 'Abreißzettel', 'Schwarzes Brett', 'Mathe', 'Englisch', 'Schüler', 'Student', 'Plakat', 'Kontaktzettel'],
  pages: [page('#ffffff', [
    rect('Kopfband', 0, 0, 210, 118, GREENB, { locked: true }),
    ellipse('Kreis', 140, -40, 110, 110, '#ffffff', { opacity: 0.1, locked: true }),
    text('Anlass', 18, 20, 120, 8, 'SCHÜLER HELFEN SCHÜLERN', { f: 'Source Sans 3', w: 700, s: 13, c: '#d3f9d8', ls: 0.18, a: 'left', min: 8 }),
    text('Titel', 18, 32, 176, 60, 'Nachhilfe', { f: 'Poppins', w: 800, s: 80, c: '#ffffff', a: 'left', lh: 1.2, min: 40 }),
    text('Untertitel', 18, 92, 176, 14, 'in Mathe, Englisch und Deutsch', { f: 'Poppins', w: 500, s: 22, c: '#ffffff', a: 'left', min: 12 }),
    infoRow('Klassen', 'graduation-cap', 18, 134, 170, 'Für wen', 'Klasse 5 bis 10, bei dir zu Hause oder bei mir', { c: '#1b3a1f', icolor: GREENB, ic: 10, vs: 15, vw: 700, ls: 8, lc: '#5b7a60' }),
    infoRow('Preis', 'coins', 18, 152, 170, 'Preis', `${typo.euro(15, 0)} pro Stunde, erste Stunde gratis`, { c: '#1b3a1f', icolor: GREENB, ic: 10, vs: 15, vw: 700, ls: 8, lc: '#5b7a60' }),
    infoRow('Erfahrung', 'star', 18, 170, 170, 'Erfahrung', 'Abitur 1,3  ·  seit 3 Jahren Nachhilfelehrerin', { c: '#1b3a1f', icolor: GREENB, ic: 10, vs: 15, vw: 700, ls: 8, lc: '#5b7a60' }),
    rect('Kontakt Feld', 18, 192, 174, 30, '#ebfbee', { radius: 4 }),
    text('Kontakt', 18, 192, 174, 30, `Lena  ·  ${PHONE}  ·  lena@beispiel.de`, { f: 'Poppins', w: 700, s: 17, c: '#1b3a1f', a: 'center', min: 9 }),
    tearOff(8, 232, 65, ['Nachhilfe Mathe', 'Englisch · Deutsch', 'Lena', PHONE], { lineH: 5.2, sizes: [10, 8.5, 10, 10], weights: [700, 500, 700, 800], colors: ['#1b3a1f', '#4b6a50', '#1b3a1f', GREENB], f: 'Poppins', line: '#555555' }),
  ])],
};

module.exports = { variants: [schulheft, faecher, aushang] };
