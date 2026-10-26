'use strict';
const { text, rect, line, barcode, deko, page } = require('./dsl');
const { family } = require('./_t3b-lib');
const base = require('./03-regaletikett');

const common = {
  no: 405, category: 'Etiketten', family: base.family, familyName: base.familyName, occasion: 'Handel & Preise',
  tags: ['Regal', 'Etikett', 'EAN', 'Strichcode', 'Preis', 'Grundpreis', 'Supermarkt', 'Laden'],
  formatKey: 'shelf-strip', width: 100, height: 30, fields: base.fields, sampleRows: base.sampleRows,
};

// ------------------------------------------------------------------ Discount: Gelb mit rotem Preisfeld
const RED = '#d3001b';
const YEL = '#ffe600';
const discount = {
  slug: 'regaletikett-discount', name: 'Regaletikett Discount (gelb-rot)', variant: 'Discount',
  description: 'Lautes Regaletikett (100 × 30 mm) im Discounter-Stil: gelber Grund, schwarzer Artikelname, großer weißer Preis auf rotem Feld und ein EAN-13-Strichcode. Alle Werte sind Felder für eine Datenliste.',
  tags: ['Discount', 'Gelb', 'Rot', 'Aktion', 'Angebot', 'Schlagzeile'],
  pages: [page(YEL, [
    rect('Preisfeld', 61, 0, 39, 30, RED, { locked: true }),
    text('Artikel', 4, 2.6, 54, 11.6, '{{Artikel}}', { f: 'Oswald', s: 15, w: 700, c: '#111111', v: 'bottom', wrap: true, fit: 'shrink', lh: 1.05, min: 8 }),
    text('Inhalt', 4, 15, 54, 4.6, '{{Inhalt}}', { f: 'Oswald', s: 9, w: 400, c: '#222222', min: 6.5 }),
    rect('Grundpreis Feld', 4, 21.4, 46, 5.2, '#111111', { radius: 0.8, showIf: 'Grundpreis' }),
    text('Grundpreis', 5.2, 21.4, 44, 5.2, '{{Grundpreis}}', { f: 'Oswald', s: 8, w: 500, c: YEL, min: 6.5, showIf: 'Grundpreis' }),
    text('Preis', 62, 1.6, 29, 15, '{{Preis}}', { f: 'Anton', s: 36, c: '#ffffff', a: 'right', lh: 1, min: 16 }),
    text('Euro', 91.6, 3.4, 6.5, 8, '€', { f: 'Anton', s: 17, c: '#ffffff', a: 'left' }),
    barcode('EAN-13', 66, 17.8, 30, 10.2, 'ean13', '{{EAN}}', { c: '#111111', bg: '#ffffff', f: 'Montserrat', showIf: 'EAN' }),
  ])],
};

// ------------------------------------------------------------------ Premium: Schwarz mit Gold, Antiqua
const GOLD = '#c9a24a';
const premium = {
  slug: 'regaletikett-premium', name: 'Regaletikett Premium (Schwarz-Gold)', variant: 'Premium',
  description: 'Edles Regaletikett (100 × 30 mm) für Feinkost, Wein und Spirituosen: schwarzer Grund, Artikelname in Antiqua, goldene Linie, Preis in Gold und ein EAN-13-Strichcode. Alle Werte sind Felder für eine Datenliste.',
  tags: ['Premium', 'Feinkost', 'Wein', 'Delikatessen', 'Schwarz', 'Gold', 'Edel'],
  pages: [page('#121216', [
    line('Goldlinie oben', 4, 2.6, 96, 2.6, GOLD, 0.4, { locked: true }),
    line('Goldlinie unten', 4, 27.4, 96, 27.4, GOLD, 0.4, { locked: true }),
    text('Artikel', 6, 4.4, 55, 10.4, '{{Artikel}}', { f: 'Playfair Display', s: 12.5, w: 600, c: '#ffffff', v: 'bottom', wrap: true, fit: 'shrink', lh: 1.1, min: 8 }),
    text('Inhalt', 6, 15.6, 55, 4.2, '{{Inhalt}}', { f: 'Raleway', s: 7.5, w: 500, c: GOLD, up: true, ls: 0.12, min: 6, showIf: 'Inhalt' }),
    text('Grundpreis', 6, 20.8, 55, 4.2, '{{Grundpreis}}', { f: 'Raleway', s: 7, w: 400, c: '#a7a7b2', min: 6, showIf: 'Grundpreis' }),
    text('Preis', 62, 4.6, 27, 12, '{{Preis}}', { f: 'Libre Baskerville', s: 22, w: 700, c: GOLD, a: 'right', lh: 1, min: 12 }),
    text('Euro', 89.8, 5.6, 6.2, 7, '€', { f: 'Libre Baskerville', s: 11, w: 400, c: GOLD, a: 'left' }),
    barcode('EAN-13', 66, 17.6, 28, 8.6, 'ean13', '{{EAN}}', { c: '#121216', bg: '#ffffff', f: 'Montserrat', showIf: 'EAN' }),
  ])],
};

module.exports = family(common, [discount, premium]);
