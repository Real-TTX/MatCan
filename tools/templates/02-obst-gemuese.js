'use strict';
const { text, rect, line, strip, field, page, gradient } = require('./dsl');

const CHALK = '#f5f1e6';
const YELLOW = '#ffd46b';
const SOFT = '#a9d3b9';

module.exports = {
  slug: 'obst-gemuese',
  name: 'Obst & Gemüse – Preisschild',
  category: 'Etiketten',
  description: 'Preisschild im Kreidetafel-Look (100 × 70 mm) für Obst und Gemüse: Name, Herkunft mit Flagge, Klasse, Bio-Siegel und ein großer Preis. Die Felder kannst du aus einer Datenliste füllen.',
  family: 'preisschild-obst-gemuese',
  familyName: 'Preisschild Obst & Gemüse',
  variant: 'Kreidetafel',
  occasion: 'Handel & Preise',
  tags: ['Preisschild', 'Obst', 'Gemüse', 'Markt', 'Hofladen', 'Preis', 'Etikett', 'Herkunft'],
  formatKey: 'label-100x70',
  width: 100,
  height: 70,
  fields: [
    field('Name', 'Name', 'text', 'Erdbeeren', { required: true }),
    field('Land', 'Herkunftsland', 'image', 'flag-de', { category: 'Flaggen' }),
    field('Siegel', 'Siegel', 'image', 'icon-bio', { category: 'Siegel' }),
    field('Klasse', 'Klasse', 'text', 'Klasse I'),
    field('Herkunft', 'Herkunft', 'text', 'Region Oberrhein'),
    field('Preis', 'Preis', 'price', '3.49', { required: true }),
    field('Einheit', 'Einheit', 'text', '/ 500 g'),
  ],
  pages: [page(gradient(160, '#234a3c', '#17302a'), [
    rect('Kreiderahmen', 2.5, 2.5, 95, 65, null, { stroke: CHALK, sw: 0.6, radius: 3, opacity: 0.45, locked: true }),
    strip('Herkunft und Siegel', 7, 7, 38, 8.5, ['Land', 'Siegel'], { gap: 2.5 }),
    text('Klasse', 52, 7.2, 41, 8, '{{Klasse}}', { f: 'Montserrat', s: 8, w: 700, c: '#17302a', a: 'right', up: true, ls: 0.12, background: { color: YELLOW, radius: 4, padding: 1.9 }, showIf: 'Klasse' }),
    text('Name', 7, 18, 86, 16, '{{Name}}', { f: 'Oswald', s: 44, w: 600, c: CHALK, v: 'bottom', lh: 1, min: 20 }),
    text('Herkunft', 7, 35.5, 86, 5, 'Herkunft: {{Herkunft}}', { f: 'Montserrat', s: 9.5, w: 500, c: SOFT, showIf: 'Herkunft' }),
    line('Trennlinie', 7, 44, 93, 44, CHALK, 0.5, { dash: 'dotted', opacity: 0.4 }),
    text('Preis', 7, 45.5, 60, 17.5, '{{Preis}}', { f: 'Oswald', s: 60, w: 700, c: YELLOW, a: 'right', v: 'bottom', lh: 1, min: 24 }),
    text('Euro', 69, 47, 12, 11, '€', { f: 'Oswald', s: 32, w: 500, c: CHALK, a: 'left' }),
    text('Einheit', 69, 58.5, 24, 6, '{{Einheit}}', { f: 'Montserrat', s: 11, w: 500, c: CHALK, a: 'left', min: 7 }),
  ])],
  sampleRows: [
    { Name: 'Erdbeeren', Land: 'flag-de', Siegel: 'icon-bio', Klasse: 'Klasse I', Herkunft: 'Region Oberrhein', Preis: '3.49', Einheit: '/ 500 g' },
    { Name: 'Kirschtomaten', Land: 'flag-es', Siegel: '', Klasse: 'Klasse I', Herkunft: 'Almería', Preis: '2.99', Einheit: '/ 250 g' },
    { Name: 'Bio-Äpfel Elstar', Land: 'flag-de', Siegel: 'icon-bio', Klasse: 'Klasse I', Herkunft: 'Bodensee', Preis: '2.79', Einheit: '/ kg' },
    { Name: 'Zitronen Primofiori', Land: 'flag-it', Siegel: '', Klasse: '', Herkunft: 'Sizilien', Preis: '12.90', Einheit: '/ kg' },
  ],
};
