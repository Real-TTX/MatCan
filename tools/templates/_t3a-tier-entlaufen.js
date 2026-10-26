'use strict';
const { dsl, pt, ADDRESS, PHONE, WEB, infoRow, tearOff } = require('./_t3a-lib');
const { text, rect, ellipse, shape, icon, frame, deko, dekoIn, group, page, typo, qr, line, gradient, shadow } = dsl;

const FAMILY = { family: 'aushang-tier-entlaufen', familyName: 'Aushang Tier entlaufen', occasion: 'Kinder & Familie', category: 'Flyer' };

// ---- Vermisst: A4, alarm red, big photo frame, data sheet
const RED = '#d11a2a';
const INK = '#1a1a1a';
const datum = (n, y, label, value) => [
  text(`Angabe ${n} Name`, 20, y, 44, 8, label, { f: 'Source Sans 3', w: 800, s: 13, c: RED, up: true, ls: 0.1, a: 'left', min: 8 }),
  text(`Angabe ${n}`, 66, y, 124, 8, value, { f: 'Source Sans 3', w: 600, s: 16, c: INK, a: 'left', min: 9 }),
  line(`Angabe ${n} Linie`, 20, y + 9.5, 190, y + 9.5, '#d9d9d9', 0.3),
];
const vermisst = {
  ...FAMILY,
  slug: 'aushang-tier-entlaufen-vermisst',
  name: 'Aushang A4 – Tier entlaufen Vermisst',
  variant: 'Vermisst',
  formatKey: 'a4-portrait', width: 210, height: 297,
  description: 'Unübersehbarer A4-Aushang für ein vermisstes Haustier: roter Kopf mit „Vermisst“, großes Fotofeld mit Rahmen, Steckbrief mit Name, Rasse, Farbe und letztem Standort, Belohnung und Telefonnummer in großer Schrift.',
  tags: ['Aushang', 'Tier entlaufen', 'Vermisst', 'Hund vermisst', 'Katze vermisst', 'Haustier', 'Suchplakat', 'Belohnung', 'Foto', 'Suche'],
  pages: [page('#ffffff', [
    rect('Kopf', 0, 0, 210, 56, RED, { locked: true }),
    text('Titel', 12, 6, 186, 44, 'VERMISST!', { f: 'Anton', s: 100, c: '#ffffff', a: 'center', lh: 1.15, min: 50 }),
    rect('Foto Hintergrund', 20, 66, 170, 100, '#f1dcdc', { locked: true }),
    icon('Foto Symbol', 'paw-print', 86, 96, 38, '#d8a8ac', 1.2, { locked: true }),
    frame('Foto', 20, 66, 170, 100, { border: { color: INK, width: 2 } }),
    text('Name', 20, 172, 170, 20, 'Bello', { f: 'Anton', s: 54, c: INK, a: 'left', lh: 1.1, min: 24 }),
    text('Zusatz', 76, 178, 114, 12, 'sucht sein Zuhause', { f: 'Source Sans 3', i: true, s: 18, c: '#555555', a: 'left', min: 10 }),
    datum(1, 198, 'Tier', 'Hund, Mischling, 4 Jahre'),
    datum(2, 211, 'Aussehen', 'Braun mit weißer Brust, rotes Halsband'),
    datum(3, 224, 'Zuletzt gesehen', 'Sonntag, 6. Juni, Stadtpark Musterstadt'),
    rect('Belohnung', 20, 242, 170, 14, '#fff0f0', { radius: 3 }),
    text('Belohnung Text', 20, 242, 170, 14, 'Hohe Belohnung für Hinweise! Bello ist gechippt und sehr lieb.', { f: 'Source Sans 3', w: 700, s: 13, c: RED, a: 'center', min: 8 }),
    rect('Telefonband', 0, 262, 210, 35, INK, { locked: true }),
    icon('Telefon', 'phone', 30, 272, 16, '#ffffff', 2),
    text('Anrufen', 52, 266, 130, 7, 'BITTE SOFORT ANRUFEN', { f: 'Source Sans 3', w: 800, s: 13, c: '#ff8a93', ls: 0.2, a: 'left', min: 8 }),
    text('Nummer', 52, 272, 140, 16, PHONE, { f: 'Anton', s: 40, c: '#ffffff', a: 'left', lh: 1.15, min: 20 }),
  ])],
};

// ---- Suchplakat: A4, friendly, round photo, paw prints
const CREAM = '#fff7ec';
const TEAL = '#1f7a8c';
const ORANGE = '#f08a24';
const paws = [[14, 92, 10, -20], [24, 118, 8, 15], [176, 100, 9, 20], [168, 128, 8, -10], [16, 160, 8, 10]];
const suchplakat = {
  ...FAMILY,
  slug: 'aushang-tier-entlaufen-suchplakat',
  name: 'Aushang A4 – Tier entlaufen Suchplakat',
  variant: 'Suchplakat',
  formatKey: 'a4-portrait', width: 210, height: 297,
  description: 'Freundlicher A4-Aushang „Wer hat mich gesehen?“ für Katze, Hund oder Kaninchen: rundes Foto in Orange, Pfotenspuren, Steckbrief in drei Zeilen, Hinweis auf Chip und Kontakt mit großem Telefon.',
  tags: ['Aushang', 'Tier entlaufen', 'Katze vermisst', 'Hund vermisst', 'Kaninchen', 'Suchplakat', 'Haustier', 'Pfoten', 'Foto', 'Hinweise'],
  pages: [page(CREAM, [
    text('Titel', 14, 16, 182, 44, 'Wer hat mich\ngesehen?', { f: 'Fredoka', w: 700, s: 56, c: TEAL, a: 'center', v: 'top', wrap: true, lh: 1.1, min: 30 }),
    ellipse('Foto Hintergrund', 45, 82, 120, 120, '#ffe0b8', { locked: true }),
    icon('Foto Symbol', 'cat', 80, 117, 50, '#e8b27a', 1.1, { locked: true }),
    frame('Foto', 45, 82, 120, 120, { mask: 'circle', border: { color: ORANGE, width: 4 } }),
    ...paws.map(([x, y, s, r], i) => icon('Pfote ' + (i + 1), 'paw-print', x, y, s * 1.5, '#f2c58b', 1.8, { rotation: r, locked: true })),
    text('Name', 20, 208, 170, 20, 'Mimi', { f: 'Fredoka', w: 700, s: 54, c: ORANGE, a: 'center', lh: 1.1, min: 24 }),
    text('Steckbrief', 20, 228, 170, 30, 'Graue Katze mit weißen Pfoten, 3 Jahre, gechippt\nVerschwunden am Montag in der Gartenstraße', { f: 'Fredoka', s: 15, c: '#3a4a50', a: 'center', v: 'top', wrap: true, lh: 1.5, min: 9 }),
    rect('Kontakt Feld', 20, 258, 170, 28, TEAL, { radius: 14 }),
    icon('Telefon', 'phone', 30, 265, 14, '#ffffff', 2),
    text('Nummer', 50, 258, 136, 28, PHONE, { f: 'Fredoka', w: 700, s: 34, c: '#ffffff', a: 'left', min: 16 }),
  ])],
};

// ---- Abreißzettel: tear-off A4 for a lost dog, black and yellow
const YEL = '#ffd60a';
const DARK = '#111111';
const abreiss = {
  ...FAMILY,
  slug: 'aushang-tier-entlaufen-abreisszettel',
  name: 'Aushang A4 – Tier entlaufen mit Abreißzetteln',
  variant: 'Abreißzettel',
  formatKey: 'tearoff-a4', width: 210, height: 297,
  description: 'A4-Aushang für ein entlaufenes Tier mit acht Abreißzetteln: gelber Kopf, Fotofeld, wichtigste Angaben und Telefon in großer Schrift, damit Passanten die Nummer mitnehmen können.',
  tags: ['Aushang', 'Tier entlaufen', 'Hund vermisst', 'Abreißzettel', 'Suchplakat', 'Foto', 'Haustier', 'Vermisst', 'Gelb', 'Telefon'],
  pages: [page('#ffffff', [
    rect('Kopf', 0, 0, 210, 52, YEL, { locked: true }),
    text('Titel', 12, 6, 186, 28, 'HUND ENTLAUFEN', { f: 'Anton', s: 64, c: DARK, a: 'center', lh: 1.15, min: 32 }),
    text('Untertitel', 12, 34, 186, 12, 'Wer hat Rocky gesehen?', { f: 'Source Sans 3', w: 700, s: 22, c: DARK, a: 'center', min: 12 }),
    rect('Foto Hintergrund', 12, 60, 100, 96, '#eeeeee', { locked: true }),
    icon('Foto Symbol', 'dog', 44, 90, 36, '#c4c4c4', 1.2, { locked: true }),
    frame('Foto', 12, 60, 100, 96, { border: { color: DARK, width: 1.5 } }),
    text('Steckbrief Kopf', 120, 60, 80, 8, 'ROCKY', { f: 'Anton', s: 40, c: DARK, a: 'left', lh: 1.1, min: 18 }),
    text('Steckbrief', 120, 76, 78, 80, 'Schäferhund-Mischling\nRüde, 5 Jahre, schwarz-braun\nTrägt ein blaues Halsband\nVerschwunden am Freitag\nim Waldweg bei Musterstadt\nScheu, bitte nicht jagen', { f: 'Source Sans 3', w: 600, s: 12.5, c: DARK, a: 'left', v: 'top', wrap: true, lh: 1.6, min: 8 }),
    rect('Hinweisfeld', 12, 164, 186, 32, DARK, { radius: 3 }),
    text('Hinweis', 12, 164, 186, 32, 'Bitte nicht verfolgen,\nsondern sofort anrufen!', { f: 'Anton', s: 26, c: YEL, a: 'center', v: 'middle', wrap: true, lh: 1.25, min: 12 }),
    text('Nummer', 12, 200, 186, 22, PHONE, { f: 'Anton', s: 56, c: DARK, a: 'center', lh: 1.1, min: 24 }),
    text('Belohnung', 12, 222, 186, 8, 'Belohnung für Hinweise', { f: 'Source Sans 3', w: 700, s: 14, c: '#555555', a: 'center', min: 8 }),
    tearOff(8, 236, 61, ['Hund entlaufen: Rocky', PHONE], { lineH: 6, sizes: [10, 11], weights: [700, 800], colors: [DARK, DARK], f: 'Source Sans 3', line: '#555555' }),
  ])],
};

module.exports = { variants: [vermisst, suchplakat, abreiss] };
