'use strict';
const { text, rect, barcode, field, page, ean13 } = require('./dsl');

const NAVY = '#14213d';
const TEAL = '#0e8f8a';
const GREY = '#5b6475';

module.exports = {
  slug: 'regaletikett',
  name: 'Regaletikett mit EAN',
  category: 'Etiketten',
  description: 'Schmales Regaletikett (100 × 30 mm): Artikelname, Inhalt, Grundpreis, großer Preis und ein EAN-13-Strichcode, dessen Prüfziffer automatisch stimmt. Alle Werte sind Felder für eine Datenliste.',
  width: 100,
  height: 30,
  fields: [
    field('Artikel', 'Artikel', 'text', 'Haferflocken zart', { required: true }),
    field('Inhalt', 'Inhalt', 'text', 'Bio-Vollkorn · 500 g'),
    field('Grundpreis', 'Grundpreis', 'text', 'Grundpreis 3,98 € / kg'),
    field('Preis', 'Preis', 'price', '1.99', { required: true }),
    field('EAN', 'EAN-13', 'text', ean13('400638133393')),
  ],
  pages: [page('#ffffff', [
    rect('Preisfeld', 62, 0, 38, 30, '#edf3f5', { locked: true }),
    rect('Akzent', 0, 0, 3.2, 30, TEAL, { locked: true }),
    text('Artikel', 7, 3, 52, 12.2, '{{Artikel}}', { f: 'Montserrat', s: 13, w: 700, c: NAVY, v: 'bottom', wrap: true, fit: 'shrink', lh: 1.1, min: 8 }),
    text('Inhalt', 7, 16.2, 52, 4.4, '{{Inhalt}}', { f: 'Montserrat', s: 8, w: 500, c: GREY, min: 6 }),
    text('Grundpreis', 7, 22.4, 52, 4.4, '{{Grundpreis}}', { f: 'Montserrat', s: 7.5, w: 600, c: TEAL, min: 6, showIf: 'Grundpreis' }),
    text('Preis', 64, 2.2, 25, 12.3, '{{Preis}}', { f: 'Oswald', s: 33, w: 700, c: NAVY, a: 'right', lh: 1, min: 14 }),
    text('Euro', 90, 3.4, 7, 6, '€', { f: 'Oswald', s: 15, w: 500, c: NAVY, a: 'left' }),
    barcode('EAN-13', 66, 18.2, 30, 9.6, 'ean13', '{{EAN}}', { c: NAVY, bg: '#ffffff', f: 'Montserrat', showIf: 'EAN' }),
  ])],
  sampleRows: [
    { Artikel: 'Haferflocken zart', Inhalt: 'Bio-Vollkorn · 500 g', Grundpreis: 'Grundpreis 3,98 € / kg', Preis: '1.99', EAN: ean13('400638133393') },
    { Artikel: 'Bio-Müsli Beeren-Mix mit Cranberries und Himbeeren', Inhalt: 'Knusprig · 750 g', Grundpreis: 'Grundpreis 6,65 € / kg', Preis: '4.99', EAN: ean13('401234567890') },
    { Artikel: 'Olivenöl nativ extra', Inhalt: '0,5 l Flasche', Grundpreis: '', Preis: '12.50', EAN: ean13('978020137962') },
    { Artikel: 'Espresso', Inhalt: '', Grundpreis: '', Preis: '0.99', EAN: '' },
  ],
};
