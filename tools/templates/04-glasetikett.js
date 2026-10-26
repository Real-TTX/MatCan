'use strict';
const { text, rect, ellipse, line, icon, frame, qr, field, page } = require('./dsl');

const CREAM = '#fbf4e6';
const HONEY = '#c9892b';
const SOFT = '#f3dca8';
const BROWN = '#4a2c17';
const WARM = '#7a5a3e';

module.exports = {
  slug: 'glasetikett',
  name: 'Glasetikett – Marmelade & Honig',
  category: 'Etiketten',
  description: 'Etikett für Gläser (70 × 50 mm) mit rundem Bildrahmen für ein Foto, Produktname in Schreibschrift, Inhalt, Abfülldatum und einem QR-Code zu einer Internetadresse. Produkt, Sorte, Inhalt, Datum und Adresse sind Felder.',
  family: 'glasetikett',
  familyName: 'Glasetikett',
  variant: 'Mit Foto',
  occasion: 'Handel & Preise',
  tags: ['Marmelade', 'Honig', 'Glas', 'Etikett', 'Hofladen', 'Selbstgemacht', 'QR-Code', 'Abfülldatum'],
  formatKey: 'label-70x50',
  width: 70,
  height: 50,
  fields: [
    field('Produkt', 'Produkt', 'text', 'Waldhonig', { required: true }),
    field('Sorte', 'Sorte oder Zusatz', 'text', 'Sommertracht, cremig'),
    field('Inhalt', 'Inhalt', 'text', '500 g'),
    field('Datum', 'Abgefüllt', 'text', 'Abgefüllt 07/2027'),
    field('Erzeuger', 'Erzeuger', 'text', 'Imkerei Sonnenhang'),
    field('URL', 'Internetadresse für den QR-Code', 'text', 'https://example.org/honig'),
  ],
  pages: [page(CREAM, [
    rect('Rand', 1.8, 1.8, 66.4, 46.4, null, { stroke: HONEY, sw: 0.7, radius: 5, locked: true }),
    ellipse('Foto Hintergrund', 4.5, 7, 28.5, 28.5, SOFT),
    icon('Foto Platzhalter', 'flower-2', 13.2, 15.7, 11, HONEY, 1.6),
    frame('Foto', 6, 8.5, 25.5, 25.5, { mask: 'circle', border: { color: HONEY, width: 1.4 } }),
    text('Erzeuger', 3, 37.3, 32, 4, '{{Erzeuger}}', { f: 'Montserrat', s: 7, w: 600, c: WARM, a: 'center', ls: 0.04, showIf: 'Erzeuger' }),
    text('Handgemacht', 37, 6.8, 28, 3.4, 'Handgemacht', { f: 'Montserrat', s: 7, w: 600, c: HONEY, up: true, ls: 0.2 }),
    text('Produkt', 37, 10.2, 29, 12.5, '{{Produkt}}', { f: 'Kaushan Script', s: 25, c: BROWN, lh: 1, min: 11 }),
    text('Sorte', 37, 23.2, 27.5, 4.6, '{{Sorte}}', { f: 'Lora', s: 8.5, i: true, c: WARM, min: 6, showIf: 'Sorte' }),
    line('Trennlinie', 37, 29.6, 65.5, 29.6, '#e3c88e', 0.6),
    text('Inhalt', 37, 31.6, 13, 6, '{{Inhalt}}', { f: 'Montserrat', s: 11, w: 700, c: BROWN, min: 7 }),
    text('Datum', 37, 38, 13, 7, '{{Datum}}', { f: 'Montserrat', s: 7, w: 500, c: WARM, v: 'top', wrap: true, lh: 1.25, min: 7, showIf: 'Datum' }),
    qr('QR-Code', 50.4, 30.4, 14.8, '{{URL}}', { c: BROWN, bg: null, ecc: 'M', quiet: false, showIf: 'URL' }),
  ])],
  sampleRows: [
    { Produkt: 'Waldhonig', Sorte: 'Sommertracht, cremig', Inhalt: '500 g', Datum: 'Abgefüllt 07/2027', Erzeuger: 'Imkerei Sonnenhang', URL: 'https://example.org/honig' },
    { Produkt: 'Erdbeermarmelade', Sorte: 'mit 60 % Frucht', Inhalt: '250 g', Datum: 'Abgefüllt 06/2027', Erzeuger: 'Hofladen Wiesengrund', URL: 'https://example.org/erdbeere' },
    { Produkt: 'Holunder-Gelee', Sorte: 'Herbstlese', Inhalt: '200 g', Datum: '', Erzeuger: 'Hofladen Wiesengrund', URL: 'https://example.org/gelee' },
    { Produkt: 'Quittenkonfitüre', Sorte: '', Inhalt: '250 g', Datum: 'Abgefüllt 10/2027', Erzeuger: '', URL: '' },
  ],
};
