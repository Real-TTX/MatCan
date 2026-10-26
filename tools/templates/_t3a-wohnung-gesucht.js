'use strict';
const { dsl, pt, ADDRESS, PHONE, WEB, infoRow, tearOff } = require('./_t3a-lib');
const { text, rect, ellipse, shape, icon, frame, deko, dekoIn, group, page, typo, qr, line, gradient, shadow } = dsl;

const FAMILY = { family: 'aushang-wohnung-gesucht', familyName: 'Aushang Wohnung gesucht', occasion: 'Handel & Preise', category: 'Flyer', formatKey: 'tearoff-a4', width: 210, height: 297 };

// ---- Kleinanzeige: newspaper classified look, serif, stamp "GESUCHT"
const PAPER = '#f6f1e4';
const INK = '#1c1c1c';
const ANZ = '#9b1c1c';
const kleinanzeige = {
  ...FAMILY,
  slug: 'aushang-wohnung-gesucht-kleinanzeige',
  name: 'Aushang A4 – Wohnung gesucht Kleinanzeige',
  variant: 'Kleinanzeige',
  description: 'A4-Aushang mit Abreißzetteln im Stil einer Zeitungsanzeige: Doppelrahmen, Schlagzeile „Gesucht“ in Playfair, Anzeigentext mit Eckdaten zur Wohnung und Kontaktblock, acht Zettel zum Abreißen.',
  tags: ['Aushang', 'Wohnung gesucht', 'Wohnungssuche', 'Mietgesuch', 'Kleinanzeige', 'Abreißzettel', 'Zeitung', 'Suche', 'Miete', 'Schwarzes Brett'],
  pages: [page(PAPER, [
    rect('Rahmen außen', 12, 12, 186, 210, null, { stroke: INK, sw: 1.8, locked: true }),
    rect('Rahmen innen', 15.5, 15.5, 179, 203, null, { stroke: INK, sw: 0.4, locked: true }),
    text('Kopf', 24, 22, 162, 8, 'KLEINANZEIGE  ·  WOHNEN', { f: 'Libre Baskerville', w: 400, s: 10, c: INK, ls: 0.25, a: 'center', min: 6 }),
    line('Linie oben', 24, 33, 186, 33, INK, 0.5, { locked: true }),
    text('Titel', 20, 36, 170, 40, 'Gesucht!', { f: 'Playfair Display', w: 900, s: 84, c: INK, a: 'center', lh: 1.1, min: 40 }),
    text('Untertitel', 24, 77, 162, 14, 'Ruhige 3-Zimmer-Wohnung für junge Familie', { f: 'Playfair Display', i: true, w: 500, s: 22, c: ANZ, a: 'center', min: 12 }),
    line('Linie unten', 24, 96, 186, 96, INK, 0.5, { locked: true }),
    text('Text', 26, 102, 158, 64, 'Wir sind eine Familie mit zwei Kindern (4 und 7 Jahre) und suchen eine helle Wohnung mit Balkon oder Garten in Musterstadt oder Umgebung. Wir sind Nichtraucher, haben ein festes Einkommen und keine Haustiere. Gern auch Neubau oder Altbau, Hauptsache ein gutes Miteinander.', { f: 'Libre Baskerville', s: 13.5, c: INK, a: 'left', v: 'top', wrap: true, lh: 1.6, min: 8 }),
    rect('Eckdaten', 26, 168, 158, 38, '#ffffff', { stroke: INK, sw: 0.4 }),
    text('Eckdaten 1', 31, 170, 70, 34, 'Zimmer: 3 bis 4\nFläche: ab 70 m²\nMiete: bis 1.200 € warm', { f: 'Libre Baskerville', w: 700, s: 12, c: INK, a: 'left', v: 'middle', wrap: true, lh: 1.55, min: 7 }),
    text('Eckdaten 2', 106, 170, 76, 34, `Einzug: ab sofort\nRaum: Musterstadt\nKontakt: ${PHONE}`, { f: 'Libre Baskerville', w: 700, s: 12, c: ANZ, a: 'left', v: 'middle', wrap: true, lh: 1.55, min: 7 }),
    text('Fuß', 24, 208, 162, 6, 'Familie Weber freut sich auf Ihren Anruf.', { f: 'Libre Baskerville', i: true, s: 9.5, c: INK, a: 'center', min: 6 }),
    tearOff(8, 232, 65, ['Wohnung gesucht', 'Familie Weber', PHONE], { lineH: 5.6, sizes: [10.5, 9, 10.5], weights: [700, 400, 700], colors: [INK, '#555555', ANZ], f: 'Libre Baskerville', line: '#666666' }),
  ])],
};

// ---- Familie: warm, house icon and hearts, round sans
const WARM = '#fff3e6';
const BRICK = '#c4552d';
const SAGE = '#4f6f52';
const wish = (n, y, iconName, label) => [
  ellipse(`Wunsch ${n} Kreis`, 24, y, 16, 16, BRICK),
  icon(`Wunsch ${n} Symbol`, iconName, 27.5, y + 3.5, 9, '#ffffff', 2),
  text(`Wunsch ${n}`, 46, y, 144, 16, label, { f: 'Nunito', w: 700, s: 20, c: '#4a2a1a', a: 'left', min: 11 }),
];
const familie = {
  ...FAMILY,
  slug: 'aushang-wohnung-gesucht-familie',
  name: 'Aushang A4 – Wohnung gesucht Familie',
  variant: 'Familie',
  description: 'Herzlicher A4-Aushang mit Abreißzetteln für die Wohnungssuche einer Familie: warme Farben, rundes Fotofeld für ein Familienfoto, Wunschliste mit Symbolen, Kontakt und acht Abreißzettel.',
  tags: ['Aushang', 'Wohnung gesucht', 'Familie', 'Haus gesucht', 'Mietgesuch', 'Wohnungssuche', 'Abreißzettel', 'Familienfoto', 'Herzlich', 'Schwarzes Brett'],
  pages: [page(WARM, [
    ellipse('Foto Hintergrund', 120, 18, 76, 76, '#f6d5bd', { locked: true }),
    icon('Foto Symbol', 'users', 144, 42, 28, '#d8a483', 1.3, { locked: true }),
    frame('Foto', 120, 18, 76, 76, { mask: 'circle', border: { color: BRICK, width: 2.5 } }),
    icon('Haus', 'house', 20, 22, 24, BRICK, 1.8),
    text('Titel', 18, 50, 110, 42, 'Wir suchen\nein Zuhause', { f: 'Nunito', w: 900, s: 38, c: '#4a2a1a', a: 'left', v: 'top', wrap: true, lh: 1.1, min: 20 }),
    text('Untertitel', 20, 100, 170, 20, 'Familie mit zwei Kindern sucht eine Wohnung oder ein kleines Haus in Musterstadt.', { f: 'Nunito', s: 15, c: '#6b4a38', a: 'left', v: 'top', wrap: true, lh: 1.4, min: 9 }),
    wish(1, 130, 'bed-double', 'Mindestens 3 Zimmer, ab 70 m²'),
    wish(2, 152, 'trees', 'Balkon, Garten oder Hof'),
    wish(3, 174, 'euro', 'Bis 1.200 € warm, ab sofort'),
    text('Kontakt', 22, 202, 166, 20, `Familie Weber  ·  ${PHONE}`, { f: 'Nunito', w: 900, s: 23, c: BRICK, a: 'center', min: 11 }),
    tearOff(8, 232, 65, ['Wohnung gesucht', 'Familie Weber', PHONE], { lineH: 5.6, sizes: [10.5, 9, 10.5], weights: [800, 500, 800], colors: ['#4a2a1a', SAGE, BRICK], f: 'Nunito', line: '#a07050' }),
  ])],
};

// ---- Direkt: yellow and black, loud headline
const YEL = '#ffe600';
const BLK = '#0e0e0e';
const direkt = {
  ...FAMILY,
  slug: 'aushang-wohnung-gesucht-direkt',
  name: 'Aushang A4 – Wohnung gesucht Direkt',
  variant: 'Direkt',
  description: 'Lauter A4-Aushang mit Abreißzetteln: schwarz-gelb, Schlagzeile „Wohnung gesucht!“ in Anton, drei Eckdaten als große Zahlen (Zimmer, Miete, Einzug), Kontakt und acht Zettel zum Abreißen.',
  tags: ['Aushang', 'Wohnung gesucht', 'WG-Zimmer', 'Mietgesuch', 'Student', 'Plakativ', 'Gelb', 'Abreißzettel', 'Wohnungssuche', 'Schwarzes Brett'],
  pages: [page(YEL, [
    text('Zeile 1', 12, 12, 186, 46, 'WOHNUNG', { f: 'Anton', s: 118, c: BLK, a: 'left', lh: 1.15, min: 50 }),
    text('Zeile 2', 12, 56, 186, 46, 'GESUCHT!', { f: 'Anton', s: 118, c: BLK, a: 'left', lh: 1.15, min: 50 }),
    rect('Band', 0, 112, 210, 24, BLK, { locked: true }),
    text('Band Text', 12, 112, 186, 24, 'Student sucht 1 bis 2 Zimmer in Musterstadt', { f: 'Anton', s: 24, c: YEL, a: 'left', min: 12 }),
    text('Zahl 1', 12, 146, 62, 28, '1–2', { f: 'Anton', s: 64, c: BLK, a: 'left', lh: 1.1, min: 30 }),
    text('Zahl 1 Text', 12, 172, 62, 7, 'ZIMMER', { f: 'Source Sans 3', w: 800, s: 13, c: BLK, ls: 0.18, a: 'left', min: 7 }),
    text('Zahl 2', 76, 146, 62, 28, '600 €', { f: 'Anton', s: 64, c: BLK, a: 'left', lh: 1.1, min: 30 }),
    text('Zahl 2 Text', 76, 172, 62, 7, 'WARM, MAXIMAL', { f: 'Source Sans 3', w: 800, s: 13, c: BLK, ls: 0.18, a: 'left', min: 7 }),
    text('Zahl 3', 140, 146, 58, 28, '1.10.', { f: 'Anton', s: 64, c: BLK, a: 'left', lh: 1.1, min: 30 }),
    text('Zahl 3 Text', 140, 172, 58, 7, 'EINZUG', { f: 'Source Sans 3', w: 800, s: 13, c: BLK, ls: 0.18, a: 'left', min: 7 }),
    text('Kontakt', 12, 192, 186, 26, `Jonas  ·  ${PHONE}`, { f: 'Anton', s: 38, c: BLK, a: 'left', min: 16 }),
    tearOff(8, 232, 65, ['Wohnung gesucht', 'Jonas', PHONE], { lineH: 5.6, sizes: [11, 11, 11], weights: [800, 800, 800], colors: [BLK, BLK, BLK], f: 'Source Sans 3', line: '#111111', bg: '#ffffff' }),
  ])],
};

module.exports = { variants: [kleinanzeige, familie, direkt] };
