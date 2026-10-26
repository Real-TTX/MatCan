'use strict';
const { text, rect, ellipse, line, icon, shape, deko, field, page, gradient } = require('./dsl');
const { family } = require('./_t3b-lib');

const fields = [
  field('Sorte', 'Sorte', 'text', 'Waldhonig', { required: true }),
  field('Zusatz', 'Zusatz', 'text', 'cremig, aus der Region'),
  field('Gewicht', 'Gewicht', 'text', '500 g'),
  field('Imker', 'Imkerei', 'text', 'Imkerei Sonnenhang'),
  field('MHD', 'Mindestens haltbar bis', 'text', 'MHD 12/2028'),
];
const sampleRows = [
  { Sorte: 'Waldhonig', Zusatz: 'cremig, aus der Region', Gewicht: '500 g', Imker: 'Imkerei Sonnenhang', MHD: 'MHD 12/2028' },
  { Sorte: 'Frühlingsblütenhonig', Zusatz: 'fein cremig, Raps und Obstblüte, aus eigener Imkerei', Gewicht: '250 g', Imker: 'Imkerei Familie Mustermann-Schneider', MHD: 'MHD 06/2028' },
  { Sorte: 'Linde', Zusatz: 'flüssig', Gewicht: '1 kg', Imker: 'Imkerei Sonnenhang', MHD: '' },
  { Sorte: 'Akazie', Zusatz: '', Gewicht: '125 g', Imker: '', MHD: 'MHD 03/2029' },
];

const common = {
  no: 437, category: 'Etiketten', family: 'honigetikett', familyName: 'Honigetikett', occasion: 'Handel & Preise',
  tags: ['Honig', 'Imker', 'Imkerei', 'Honigglas', 'Etikett', 'Hofladen', 'Biene', 'Glas', 'Sorte'],
  formatKey: 'label-70x50', width: 70, height: 50, fields, sampleRows,
};

// ------------------------------------------------------------------ Waben: Honiggelb, Sechsecke
const BROWN = '#4a2c0a';
const waben = {
  slug: 'honigetikett-waben', name: 'Honigetikett – Waben', variant: 'Waben',
  description: 'Honigetikett (70 × 50 mm) mit goldgelbem Verlauf und Wabenmuster: Sorte in großen Versalien, Zusatz, Imkerei, Mindesthaltbarkeit und das Gewicht im Sechseck. Alle Angaben sind Felder für eine Datenliste.',
  tags: ['Waben', 'Gelb', 'Sechseck', 'Goldgelb', 'Bienenwabe', 'Kräftig'],
  pages: [page(gradient(160, '#ffd34d', '#f0a21b'), [
    ...[[44, -3], [57, -3], [50.5, 8.2], [63.5, 8.2], [57, 19.4], [70, 19.4], [63.5, 30.6], [50.5, 30.6], [57, 41.8], [70, 41.8]].map(([x, y], i) => shape('hexagon', 'Wabe ' + (i + 1), x - 6.2, y - 0.4, 12.4, 12.4, null, { stroke: '#ffffff', sw: 0.9, opacity: 0.4, locked: true })),
    text('Kopf', 5, 5, 40, 3.4, 'Echter Honig', { f: 'Montserrat', s: 7, w: 700, c: BROWN, up: true, ls: 0.24, min: 5.5 }),
    text('Sorte', 5, 9, 54, 17, '{{Sorte}}', { f: 'Bebas Neue', s: 36, c: BROWN, lh: 1, min: 14 }),
    text('Zusatz', 5, 25.6, 60, 4.6, '{{Zusatz}}', { f: 'Lora', s: 8.5, i: true, c: BROWN, min: 6, showIf: 'Zusatz' }),
    line('Trenner', 5, 33.4, 36, 33.4, BROWN, 0.4, { opacity: 0.6 }),
    text('Imker', 5, 35, 38, 4.4, '{{Imker}}', { f: 'Montserrat', s: 7.5, w: 700, c: BROWN, min: 5.5, showIf: 'Imker' }),
    text('MHD', 5, 38, 38, 4, '{{MHD}}', { f: 'Montserrat', s: 7, w: 500, c: '#6b4a1c', min: 5.5, showIf: 'MHD' }),
    shape('hexagon', 'Gewicht Sechseck', 47, 30.6, 18, 18, BROWN, { locked: true }),
    text('Gewicht', 47.6, 35.4, 16.8, 8.6, '{{Gewicht}}', { f: 'Oswald', s: 14, w: 600, c: '#ffd34d', a: 'center', lh: 1, min: 8 }),
  ])],
};

// ------------------------------------------------------------------ Natur: Wiese, Handschrift
const GREEN = '#3f6b2c';
const natur = {
  slug: 'honigetikett-natur', name: 'Honigetikett – Blumenwiese', variant: 'Blumenwiese',
  description: 'Helles Honigetikett (70 × 50 mm) mit Blumenwiese am unteren Rand: Sorte in Handschrift, Zusatz, Imkerei, Gewicht und Mindesthaltbarkeit. Alle Angaben sind Felder für eine Datenliste.',
  tags: ['Blumenwiese', 'Natur', 'Handschrift', 'Wiese', 'Bio', 'Regional', 'Hell'],
  pages: [page('#fffdf3', [
    deko('Wiese', 'deko-blumen-wiese', 0, 25.4, 70, undefined, { locked: true }),
    text('Kopf', 5, 4.6, 60, 3.4, 'Honig aus der Region', { f: 'Montserrat', s: 7, w: 600, c: GREEN, a: 'center', up: true, ls: 0.2, min: 5.5 }),
    text('Sorte', 5, 8.4, 60, 12, '{{Sorte}}', { f: 'Caveat', s: 32, w: 700, c: '#3a2a0e', a: 'center', lh: 1, min: 13 }),
    text('Zusatz', 5, 20.2, 60, 4.4, '{{Zusatz}}', { f: 'Lora', s: 8, i: true, c: '#6b5a3a', a: 'center', min: 6, showIf: 'Zusatz' }),
    rect('Fußband', 0, 39.4, 70, 10.6, '#fffdf3', { opacity: 0.95, locked: true }),
    text('Gewicht', 5, 41.4, 16, 6, '{{Gewicht}}', { f: 'Montserrat', s: 10, w: 800, c: '#3a2a0e', min: 7 }),
    text('Imker', 21, 40.8, 44, 4.2, '{{Imker}}', { f: 'Montserrat', s: 7, w: 700, c: GREEN, a: 'right', min: 5.5, showIf: 'Imker' }),
    text('MHD', 21, 43.4, 44, 3.6, '{{MHD}}', { f: 'Montserrat', s: 7, w: 500, c: '#6b5a3a', a: 'right', min: 5.5, showIf: 'MHD' }),
  ])],
};

// ------------------------------------------------------------------ Siegel: dunkles Braun, Gold, Rund
const GOLD = '#d9b25a';
const siegel = {
  slug: 'honigetikett-siegel', name: 'Honigetikett – Goldsiegel', variant: 'Goldsiegel',
  description: 'Edles Honigetikett (70 × 50 mm) für Spezialitäten: dunkelbrauner Grund, Goldlinien, Sorte in kursiver Antiqua, Imkerei in Versalien und ein rundes Siegel mit dem Gewicht. Alle Angaben sind Felder für eine Datenliste.',
  tags: ['Siegel', 'Edel', 'Gold', 'Braun', 'Geschenk', 'Spezialität', 'Manufaktur'],
  pages: [page('#33200f', [
    rect('Rahmen', 2.2, 2.2, 65.6, 45.6, null, { stroke: GOLD, sw: 0.5, locked: true }),
    text('Imker', 5, 5.4, 60, 4, '{{Imker}}', { f: 'Cinzel', s: 7.5, w: 600, c: GOLD, a: 'center', ls: 0.14, min: 5.5, showIf: 'Imker' }),
    line('Linie oben', 20, 10.8, 50, 10.8, GOLD, 0.3, { locked: true }),
    text('Sorte', 6, 13, 58, 14, '{{Sorte}}', { f: 'Playfair Display', s: 22, w: 600, i: true, c: '#fff4dc', a: 'center', lh: 1.05, min: 10 }),
    text('Zusatz', 6, 28, 58, 4.4, '{{Zusatz}}', { f: 'Raleway', s: 7.5, w: 500, c: '#d8c49a', a: 'center', min: 6, showIf: 'Zusatz' }),
    line('Linie unten', 20, 34.4, 50, 34.4, GOLD, 0.3, { locked: true }),
    ellipse('Siegel Ring', 16.4, 35.4, 11.4, 11.4, null, { stroke: GOLD, sw: 0.6, locked: true }),
    ellipse('Siegel Ring innen', 17.4, 36.4, 9.4, 9.4, null, { stroke: GOLD, sw: 0.2, locked: true }),
    text('Gewicht', 16.8, 35.4, 10.6, 11.4, '{{Gewicht}}', { f: 'Cinzel', s: 7.5, w: 700, c: GOLD, a: 'center', min: 5.5 }),
    text('MHD', 31.4, 38.4, 24, 5.4, '{{MHD}}', { f: 'Raleway', s: 7, w: 500, c: '#d8c49a', v: 'middle', wrap: true, lh: 1.2, min: 5.5, showIf: 'MHD' }),
  ])],
};

module.exports = family(common, [waben, natur, siegel]);
