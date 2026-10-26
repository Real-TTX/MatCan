'use strict';
const { text, rect, ellipse, line, icon, deko, field, page } = require('./dsl');
const { family } = require('./_t3b-lib');

const fields = [
  field('Produkt', 'Gewürz', 'text', 'Grillgewürz', { required: true }),
  field('Zusatz', 'Zusatz', 'text', 'für Fleisch und Gemüse'),
  field('Zutaten', 'Zutaten', 'text', 'Paprika, Knoblauch, Salz, Kräuter'),
  field('Inhalt', 'Inhalt', 'text', '60 g'),
  field('MHD', 'Mindestens haltbar bis', 'text', 'MHD 12/2027'),
];
const sampleRows = [
  { Produkt: 'Grillgewürz', Zusatz: 'für Fleisch und Gemüse', Zutaten: 'Paprika, Knoblauch, Salz, Kräuter', Inhalt: '60 g', MHD: 'MHD 12/2027' },
  { Produkt: 'Zitronen-Kräuter-Salz', Zusatz: 'feine Würzmischung für Fisch, Geflügel und Salate', Zutaten: 'Meersalz, Zitronenschale, Thymian, Rosmarin, Petersilie, Pfeffer', Inhalt: '120 g', MHD: 'MHD 06/2028' },
  { Produkt: 'Chili', Zusatz: 'scharf', Zutaten: 'Chilischoten', Inhalt: '35 g', MHD: '' },
  { Produkt: 'Glühweingewürz', Zusatz: '', Zutaten: '', Inhalt: '50 g', MHD: 'MHD 10/2027' },
];

const common = {
  no: 428, category: 'Etiketten', family: 'gewuerzetikett', familyName: 'Gewürzetikett', occasion: 'Handel & Preise',
  tags: ['Gewürz', 'Gewürzmischung', 'Gewürzdose', 'Etikett', 'Kräuter', 'Hofladen', 'Selbstgemacht', 'Salz', 'Zutaten'],
  formatKey: 'label-58x40', width: 58, height: 40, fields, sampleRows,
};

// ------------------------------------------------------------------ Apotheke: Kraftpapier, Doppelrahmen, Fettschrift
const KRAFT = '#dcc59c';
const BR = '#3b2a1a';
const apotheke = {
  slug: 'gewuerzetikett-apotheke', name: 'Gewürzetikett – Apotheke', variant: 'Apotheke',
  description: 'Gewürzetikett (58 × 40 mm) im Apothekerstil: Kraftpapier, Doppelrahmen, Name in kräftiger Antiqua, Zusatz, Zutaten sowie Inhalt und Mindesthaltbarkeit. Alle Angaben sind Felder für eine Datenliste.',
  tags: ['Apotheke', 'Kraftpapier', 'Vintage', 'Antiqua', 'Rahmen'],
  pages: [page(KRAFT, [
    rect('Rahmen außen', 1.8, 1.8, 54.4, 36.4, null, { stroke: BR, sw: 0.6, radius: 1, locked: true }),
    rect('Rahmen innen', 2.9, 2.9, 52.2, 34.2, null, { stroke: BR, sw: 0.2, radius: 0.6, locked: true }),
    text('Kopf', 6, 4.2, 46, 3.2, 'Handgemischt', { f: 'Montserrat', s: 7, w: 600, c: BR, a: 'center', up: true, ls: 0.3, min: 7 }),
    text('Produkt', 5, 7.6, 48, 10, '{{Produkt}}', { f: 'Abril Fatface', s: 19, c: BR, a: 'center', lh: 1, min: 9 }),
    text('Zusatz', 5, 18, 48, 4, '{{Zusatz}}', { f: 'Lora', s: 7.5, i: true, c: '#5a4328', a: 'center', min: 6, showIf: 'Zusatz' }),
    line('Trenner', 18, 23.2, 40, 23.2, BR, 0.3),
    text('Zutaten', 5.4, 24.2, 47.2, 6.2, '{{Zutaten}}', { f: 'Lora', s: 7, c: BR, a: 'center', v: 'top', wrap: true, lh: 1.2, min: 5.5, showIf: 'Zutaten' }),
    text('Inhalt', 5.4, 32, 18, 4, '{{Inhalt}}', { f: 'Montserrat', s: 7.5, w: 700, c: BR, min: 6 }),
    text('MHD', 24, 32, 28.6, 4, '{{MHD}}', { f: 'Montserrat', s: 7, w: 500, c: '#5a4328', a: 'right', min: 5.5, showIf: 'MHD' }),
  ])],
};

// ------------------------------------------------------------------ Paprika: weiße Fläche, rote Leiste, Flamme
const RED = '#c8301f';
const paprika = {
  slug: 'gewuerzetikett-paprika', name: 'Gewürzetikett – Paprika', variant: 'Paprika',
  description: 'Kräftiges Gewürzetikett (58 × 40 mm) mit roter Leiste und Flammensymbol: Name in fetter Grotesk, Zusatz, Zutaten und der Inhalt in einer Kapsel. Alle Angaben sind Felder für eine Datenliste.',
  tags: ['Paprika', 'Rot', 'Scharf', 'Grill', 'Kräftig', 'Modern'],
  pages: [page('#ffffff', [
    rect('Leiste', 0, 0, 13, 40, RED, { locked: true }),
    icon('Flamme', 'flame', 3, 5, 7, '#ffffff', 1.8, { locked: true }),
    text('Inhalt Leiste', -10, 17.2, 33, 5.6, '{{Inhalt}}', { f: 'Poppins', s: 9, w: 700, c: '#ffffff', a: 'center', rotation: -90, min: 6 }),
    text('Produkt', 16.5, 3.4, 37, 11, '{{Produkt}}', { f: 'Poppins', s: 15, w: 800, c: '#1d1d1f', v: 'bottom', lh: 1, min: 8 }),
    text('Zusatz', 16.5, 14.6, 38.5, 6.2, '{{Zusatz}}', { f: 'Poppins', s: 7, w: 600, c: RED, v: 'top', wrap: true, lh: 1.2, min: 5.5, showIf: 'Zusatz' }),
    line('Trenner', 16.5, 21.6, 55, 21.6, '#e4e4e8', 0.3),
    text('Zutaten', 16.5, 22.6, 38.5, 10.6, '{{Zutaten}}', { f: 'Poppins', s: 7, c: '#4a4a52', v: 'top', wrap: true, lh: 1.25, min: 5.5, showIf: 'Zutaten' }),
    text('MHD', 16.5, 31.8, 38.5, 3.8, '{{MHD}}', { f: 'Poppins', s: 7, w: 500, c: '#8a8a94', min: 5.5, showIf: 'MHD' }),
  ])],
};

// ------------------------------------------------------------------ Kräutergarten: Cremeton, Handschrift, Olivenzweig
const GRN = '#41592f';
const kraeuter = {
  slug: 'gewuerzetikett-kraeutergarten', name: 'Gewürzetikett – Kräutergarten', variant: 'Kräutergarten',
  description: 'Sanftes Gewürzetikett (58 × 40 mm) für Kräuter und Mischungen: Cremeton, Name in Handschrift, Olivenzweig, Zutaten und Inhalt. Alle Angaben sind Felder für eine Datenliste.',
  tags: ['Kräuter', 'Handschrift', 'Olivenzweig', 'Grün', 'Natur', 'Garten', 'Bio'],
  pages: [page('#fbf7ea', [
    deko('Zweig', 'deko-blumen-olivenzweig-salbei', 38, 0.8, 16, undefined, { locked: true }),
    text('Produkt', 4.5, 6.4, 48.5, 10.6, '{{Produkt}}', { f: 'Caveat', s: 24, w: 700, c: GRN, lh: 1, min: 11 }),
    text('Zusatz', 4.5, 17, 49, 4.2, '{{Zusatz}}', { f: 'Caveat', s: 11, w: 500, c: '#6b7d55', min: 7.5, showIf: 'Zusatz' }),
    deko('Welle', 'deko-trenner-welle-gold', 4.5, 22, 20, undefined, { locked: true }),
    text('Zutaten', 4.5, 25.4, 49, 7.4, '{{Zutaten}}', { f: 'Caveat', s: 10, w: 500, c: '#3b3b34', v: 'top', wrap: true, lh: 1.1, min: 7, showIf: 'Zutaten' }),
    text('Inhalt', 4.5, 31.6, 18, 4, '{{Inhalt}}', { f: 'Lora', s: 8, w: 700, c: GRN, min: 6 }),
    text('MHD', 22, 31.6, 31.5, 4, '{{MHD}}', { f: 'Lora', s: 7, i: true, c: '#7d7d70', a: 'right', min: 5.5, showIf: 'MHD' }),
  ])],
};

module.exports = family(common, [apotheke, paprika, kraeuter]);
