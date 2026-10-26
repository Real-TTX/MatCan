'use strict';
const { text, rect, ellipse, line, icon, qr, deko, field, page, gradient } = require('./dsl');
const { family } = require('./_t3b-lib');

const fields = [
  field('Betrag', 'Betrag oder Leistung', 'text', '25 €', { required: true }),
  field('Fuer', 'Für', 'text', 'Anna'),
  field('Code', 'Gutscheincode', 'text', 'GS-2027-0042'),
  field('Gueltig', 'Gültig bis', 'text', 'Gültig bis 31. Dezember 2027'),
];
const sampleRows = [
  { Betrag: '25 €', Fuer: 'Anna', Code: 'GS-2027-0042', Gueltig: 'Gültig bis 31. Dezember 2027' },
  { Betrag: '100 €', Fuer: 'Maximiliane Schneider-Hohenstein', Code: 'GS-2027-0107', Gueltig: 'Gültig bis 30. Juni 2028' },
  { Betrag: 'Ein Abendessen für zwei Personen', Fuer: 'Jo', Code: 'GS-2027-0108', Gueltig: '' },
  { Betrag: '50 €', Fuer: '', Code: 'GS-2027-0109', Gueltig: 'Gültig bis 31. März 2028' },
];

const common = {
  no: 416, category: 'Business', family: 'gutschein', familyName: 'Gutschein', occasion: 'Handel & Preise',
  tags: ['Gutschein', 'Geschenk', 'Wertgutschein', 'Geschenkgutschein', 'Code', 'Betrag', 'Verkauf'],
  formatKey: 'voucher-dl', width: 210, height: 99, fields, sampleRows,
};

// ------------------------------------------------------------------ Elegant: Elfenbein, Antiqua, Gold, Abriss mit Code
const GOLD = '#a8832f';
const INK = '#2b2a33';
const elegant = {
  slug: 'gutschein-elegant', name: 'Gutschein – Elegant', variant: 'Elegant',
  description: 'Eleganter Geschenkgutschein (DIN lang quer, 210 × 99 mm) in Elfenbein und Gold: Betrag in Antiqua, „für“-Zeile und Gültigkeit, rechts ein Abschnitt mit Gutscheincode und QR-Code. Betrag, Name, Code und Datum sind Felder für eine Serie.',
  tags: ['Elegant', 'Gold', 'Antiqua', 'Restaurant', 'Wellness', 'Friseur', 'QR-Code'],
  pages: [page('#fbf6ea', [
    rect('Rahmen außen', 4, 4, 202, 91, null, { stroke: GOLD, sw: 0.7, locked: true }),
    rect('Rahmen innen', 5.6, 5.6, 198.8, 87.8, null, { stroke: GOLD, sw: 0.25, locked: true }),
    text('Titel', 12, 11, 130, 11, 'Gutschein', { f: 'Cinzel', s: 30, w: 600, c: INK, a: 'center', ls: 0.14, min: 16 }),
    deko('Schnörkel', 'deko-ornamente-schnoerkel-breit-gold', 52, 24, 50, undefined, { locked: true }),
    text('Im Wert von', 12, 39, 130, 6, 'im Wert von', { f: 'Cormorant Garamond', s: 12, w: 500, i: true, c: '#6c6a73', a: 'center', min: 8 }),
    text('Betrag', 12, 45, 130, 22, '{{Betrag}}', { f: 'Cinzel', s: 38, w: 600, c: GOLD, a: 'center', lh: 1, min: 16 }),
    text('Für', 12, 72, 130, 8, 'für {{Fuer}}', { f: 'Cormorant Garamond', s: 17, w: 500, i: true, c: INK, a: 'center', min: 10, showIf: 'Fuer' }),
    text('Gültig', 12, 83, 130, 5, '{{Gueltig}}', { f: 'Raleway', s: 7.5, w: 500, c: '#6c6a73', a: 'center', up: true, ls: 0.14, min: 6, showIf: 'Gueltig' }),
    line('Trennlinie', 150, 8, 150, 91, GOLD, 0.5, { dash: 'dashed', locked: true }),
    icon('Schere', 'scissors', 147.4, 8.5, 5.2, GOLD, 1.8, { rotation: 90, locked: true }),
    text('Code Titel', 155, 14, 45, 4, 'Gutscheincode', { f: 'Raleway', s: 7, w: 600, c: GOLD, a: 'center', up: true, ls: 0.16, min: 5.5 }),
    rect('Code Feld', 156, 20, 43, 10, '#ffffff', { stroke: GOLD, sw: 0.4 }),
    text('Code', 157, 20, 41, 10, '{{Code}}', { f: 'IBM Plex Mono', s: 11, w: 700, c: INK, a: 'center', min: 6, showIf: 'Code' }),
    qr('QR-Code', 165, 36, 25, '{{Code}}', { c: INK, bg: null, ecc: 'M', quiet: false, showIf: 'Code' }),
    text('Einlösen', 155, 65, 45, 20, 'Einlösbar im\nHofladen Wiesengrund,\nDorfstraße 12', { f: 'Raleway', s: 7, c: '#6c6a73', a: 'center', v: 'top', wrap: true, lh: 1.5, min: 5.5 }),
  ])],
};

// ------------------------------------------------------------------ Modern: Farbfläche links mit großem Betrag, Codefeld rechts
const TEAL = '#0b4f58';
const MINT = '#3fd1b8';
const modern = {
  slug: 'gutschein-modern', name: 'Gutschein – Modern', variant: 'Modern',
  description: 'Moderner Gutschein (DIN lang quer, 210 × 99 mm): links eine dunkle Farbfläche mit riesigem Betrag, rechts weiß mit „für“-Zeile, gestricheltem Codefeld und Gültigkeit. Betrag, Name, Code und Datum sind Felder für eine Serie.',
  tags: ['Modern', 'Kräftig', 'Türkis', 'Shop', 'Studio', 'Café', 'Geschenk'],
  pages: [page('#ffffff', [
    rect('Farbfläche', 0, 0, 108, 99, gradient(150, TEAL, '#093a42'), { locked: true }),
    ellipse('Kreis oben', 38, -34, 70, 70, MINT, { opacity: 0.18, locked: true }),
    ellipse('Kreis unten', -20, 66, 60, 60, MINT, { opacity: 0.25, locked: true }),
    text('Titel', 12, 10, 90, 7, 'Gutschein', { f: 'Poppins', s: 12, w: 600, c: MINT, up: true, ls: 0.3, min: 8 }),
    text('Betrag', 10, 24, 94, 40, '{{Betrag}}', { f: 'Poppins', s: 64, w: 800, c: '#ffffff', v: 'middle', lh: 1, wrap: true, fit: 'shrink', min: 14 }),
    text('Hinweis', 12, 76, 90, 12, 'Zum Verschenken –\neinlösbar im Hofladen', { f: 'Poppins', s: 8.5, w: 400, c: '#cfe9ec', v: 'top', wrap: true, lh: 1.4, min: 6.5 }),
    icon('Geschenk', 'gift', 90, 76, 11, MINT, 1.6),
    text('Für Titel', 118, 12, 80, 4, 'Für', { f: 'Poppins', s: 7.5, w: 600, c: '#7a8a8d', up: true, ls: 0.2, min: 6 }),
    text('Für', 118, 17, 82, 12, '{{Fuer}}', { f: 'Poppins', s: 22, w: 700, c: '#102b30', min: 11, showIf: 'Fuer' }),
    line('Linie', 118, 33, 198, 33, '#d8e2e3', 0.4, { locked: true }),
    text('Code Titel', 118, 40, 80, 4, 'Code', { f: 'Poppins', s: 7.5, w: 600, c: '#7a8a8d', up: true, ls: 0.2, min: 6 }),
    rect('Code Feld', 118, 45, 80, 16, '#eef7f6', { stroke: TEAL, sw: 0.5, dash: 'dashed', radius: 2 }),
    text('Code', 119, 45, 78, 16, '{{Code}}', { f: 'IBM Plex Mono', s: 16, w: 700, c: TEAL, a: 'center', min: 8, showIf: 'Code' }),
    text('Gültig', 118, 68, 80, 8, '{{Gueltig}}', { f: 'Poppins', s: 8, w: 500, c: '#4a5b5e', min: 6, showIf: 'Gueltig' }),
    text('Firma', 118, 82, 80, 7, 'Hofladen Wiesengrund · Dorfstraße 12', { f: 'Poppins', s: 7, w: 400, c: '#7a8a8d', min: 5.5 }),
  ])],
};

// ------------------------------------------------------------------ Verspielt: Rosa, Schleife, Konfetti, Preiskreis
const CORAL = '#ff6b81';
const verspielt = {
  slug: 'gutschein-verspielt', name: 'Gutschein – Verspielt', variant: 'Verspielt',
  description: 'Fröhlicher Geschenkgutschein (DIN lang quer, 210 × 99 mm) mit Schleife, Konfetti und Betrag im bunten Kreis, dazu „für“-Zeile, Gültigkeit und Code. Betrag, Name, Code und Datum sind Felder für eine Serie.',
  tags: ['Verspielt', 'Rosa', 'Schleife', 'Konfetti', 'Kinder', 'Geburtstag', 'Weihnachten', 'Spielwaren'],
  pages: [page('#fff1f3', [
    deko('Konfetti', 'deko-konfetti-streuung-pastell', 100, -50, 150, undefined, { opacity: 0.6, locked: true }),
    deko('Schleife', 'deko-baender-schleife-rose', 8, 12, 46, undefined, { locked: true }),
    text('Titel', 58, 10, 90, 18, 'Gutschein', { f: 'Dancing Script', s: 44, w: 700, c: CORAL, min: 20 }),
    text('Für', 58, 30, 90, 10, 'für {{Fuer}}', { f: 'Fredoka', s: 20, w: 500, c: '#5b3a44', min: 10, showIf: 'Fuer' }),
    text('Gültig', 58, 44, 90, 6, '{{Gueltig}}', { f: 'Fredoka', s: 9, w: 400, c: '#8a6a73', min: 6.5, showIf: 'Gueltig' }),
    ellipse('Betrag Kreis', 148, 10, 52, 52, CORAL, { locked: true }),
    ellipse('Betrag Ring', 150.5, 12.5, 47, 47, null, { stroke: '#ffffff', sw: 0.8, dash: 'dotted', locked: true }),
    text('Betrag', 152, 22, 44, 26, '{{Betrag}}', { f: 'Fredoka', s: 30, w: 700, c: '#ffffff', a: 'center', wrap: true, lh: 1, fit: 'shrink', min: 9 }),
    rect('Code Feld', 58, 70, 80, 14, '#ffffff', { stroke: CORAL, sw: 0.5, dash: 'dashed', radius: 7 }),
    text('Code', 60, 70, 76, 14, '{{Code}}', { f: 'Fredoka', s: 15, w: 600, c: '#5b3a44', a: 'center', min: 8, showIf: 'Code' }),
    text('Hinweis', 148, 72, 52, 12, 'Einlösbar im\nHofladen Wiesengrund', { f: 'Fredoka', s: 8, w: 400, c: '#8a6a73', a: 'center', v: 'top', wrap: true, lh: 1.4, min: 6 }),
  ])],
};

module.exports = family(common, [elegant, modern, verspielt]);
