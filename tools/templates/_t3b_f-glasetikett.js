'use strict';
const { text, rect, ellipse, line, icon, qr, deko, page } = require('./dsl');
const { family } = require('./_t3b-lib');
const base = require('./04-glasetikett');

const common = {
  no: 407, category: 'Etiketten', family: base.family, familyName: base.familyName, occasion: 'Handel & Preise',
  tags: ['Marmelade', 'Honig', 'Glas', 'Etikett', 'Hofladen', 'Selbstgemacht', 'Abfülldatum'],
  formatKey: 'label-70x50', width: 70, height: 50, fields: base.fields, sampleRows: base.sampleRows,
};

// ------------------------------------------------------------------ Landhaus: Rosa Bogenrand, zentriert, Schreibschrift
const BERRY = '#b3394f';
const ROSE = '#e7a1ae';
const CRM = '#fffaf2';
const landhaus = {
  slug: 'glasetikett-landhaus', name: 'Glasetikett – Landhaus', variant: 'Landhaus',
  description: 'Zentriertes Glasetikett (70 × 50 mm) im Landhaus-Stil: rosa Bogenrand, Produktname in Schreibschrift, Sorte in Kursiv, Herzchen-Trenner, Inhalt und Abfülldatum. Produkt, Sorte, Inhalt, Datum und Erzeuger sind Felder.',
  tags: ['Landhaus', 'Rosa', 'Romantisch', 'Konfitüre', 'Gelee', 'Beeren', 'Geschenk'],
  pages: [page(CRM, [
    deko('Bogenrand', 'deko-formen-bogenrand-rose', 0, 0, 70, undefined, { locked: true }),
    text('Erzeuger', 6, 5.6, 58, 4, '{{Erzeuger}}', { f: 'Lora', s: 7, i: true, c: '#ffffff', a: 'center', min: 5.5, showIf: 'Erzeuger' }),
    text('Produkt', 5, 10.6, 60, 13.5, '{{Produkt}}', { f: 'Dancing Script', s: 27, w: 700, c: '#4a1f2a', a: 'center', lh: 1, min: 12 }),
    text('Sorte', 6, 24.4, 58, 4.6, '{{Sorte}}', { f: 'Lora', s: 8.5, i: true, c: '#7a5560', a: 'center', min: 6.5, showIf: 'Sorte' }),
    deko('Trenner', 'deko-trenner-herz-rose', 20, 30.4, 30, undefined, { locked: true }),
    text('Inhalt', 6, 36.4, 24, 5.6, '{{Inhalt}}', { f: 'Lora', s: 10, w: 700, c: BERRY, a: 'right', min: 7 }),
    ellipse('Punkt', 34.2, 38.4, 1.6, 1.6, ROSE, { locked: true }),
    text('Datum', 38.4, 36.4, 28, 5.6, '{{Datum}}', { f: 'Lora', s: 8, c: '#7a5560', a: 'left', min: 6, showIf: 'Datum' }),
    text('Hinweis', 6, 42.4, 58, 3.8, 'Kühl und dunkel lagern', { f: 'Lora', s: 7, i: true, c: '#a58a92', a: 'center', min: 7 }),
  ])],
};

// ------------------------------------------------------------------ Modern: dunkelgrüner Streifen, senkrechter Erzeuger, Inhalt im Kreis
const GR = '#1d4d3b';
const MU = '#f2b632';
const modern = {
  slug: 'glasetikett-modern', name: 'Glasetikett – Modern', variant: 'Modern',
  description: 'Modernes Glasetikett (70 × 50 mm) mit dunkelgrünem Streifen und senkrecht gesetztem Erzeuger, kräftigem Produktnamen, Inhaltsangabe im Senfkreis und QR-Code. Produkt, Sorte, Inhalt, Datum, Erzeuger und Adresse sind Felder.',
  tags: ['Modern', 'Grün', 'Senf', 'Kräftig', 'Chutney', 'Senf', 'Pesto', 'QR-Code'],
  pages: [page('#ffffff', [
    rect('Streifen', 0, 0, 13, 50, GR, { locked: true }),
    text('Erzeuger', -13.5, 20.5, 40, 9, '{{Erzeuger}}', { f: 'Montserrat', s: 7, w: 700, c: '#ffffff', a: 'center', up: true, ls: 0.16, rotation: -90, min: 7 }),
    text('Etikett', 17, 5.4, 36, 3.6, 'Aus eigener Küche', { f: 'Montserrat', s: 7, w: 700, c: GR, up: true, ls: 0.16, min: 7 }),
    text('Produkt', 17, 10, 48.5, 14, '{{Produkt}}', { f: 'Poppins', s: 20, w: 700, c: '#111111', v: 'middle', lh: 1.08, min: 9 }),
    text('Sorte', 17, 25.8, 50, 4.4, '{{Sorte}}', { f: 'Montserrat', s: 8, w: 500, c: '#5c6b64', min: 6, showIf: 'Sorte' }),
    ellipse('Inhalt Kreis', 17, 32.4, 14.5, 14.5, MU, { locked: true }),
    text('Inhalt', 17.4, 35.6, 13.7, 8, '{{Inhalt}}', { f: 'Poppins', s: 8.5, w: 700, c: '#111111', a: 'center', min: 5.5 }),
    text('Datum', 33.4, 33.4, 18, 12, '{{Datum}}', { f: 'Montserrat', s: 7, w: 500, c: '#5c6b64', v: 'middle', wrap: true, lh: 1.3, min: 7, showIf: 'Datum' }),
    qr('QR-Code', 53.2, 32.6, 13.6, '{{URL}}', { c: GR, bg: null, ecc: 'M', quiet: false, showIf: 'URL' }),
  ])],
};

module.exports = family(common, [landhaus, modern]);
