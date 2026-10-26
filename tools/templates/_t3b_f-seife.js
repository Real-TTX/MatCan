'use strict';
const { text, rect, ellipse, line, icon, deko, field, page } = require('./dsl');
const { family } = require('./_t3b-lib');

const fields = [
  field('Produkt', 'Duft oder Sorte', 'text', 'Lavendel & Honig', { required: true }),
  field('Zusatz', 'Zusatz', 'text', 'Handgemachte Naturseife'),
  field('Zutaten', 'Zutaten', 'text', 'Olivenöl, Kokosöl, Sheabutter, Honig, Lavendelöl'),
  field('Gewicht', 'Gewicht', 'text', '100 g'),
  field('Hersteller', 'Hersteller', 'text', 'Manufaktur Wiesengrund'),
];
const sampleRows = [
  { Produkt: 'Lavendel & Honig', Zusatz: 'Handgemachte Naturseife', Zutaten: 'Olivenöl, Kokosöl, Sheabutter, Honig, Lavendelöl', Gewicht: '100 g', Hersteller: 'Manufaktur Wiesengrund' },
  { Produkt: 'Orange, Zimt und Nelke', Zusatz: 'Handgemachte Peelingseife mit Mohn', Zutaten: 'Sonnenblumenöl, Kokosöl, Sheabutter, Mohn, Orangenöl, Zimt, Nelke, Kaolin', Gewicht: '120 g', Hersteller: 'Manufaktur Wiesengrund' },
  { Produkt: 'Pur', Zusatz: 'ohne Duft', Zutaten: 'Olivenöl, Kokosöl', Gewicht: '90 g', Hersteller: '' },
  { Produkt: 'Rose', Zusatz: '', Zutaten: '', Gewicht: '100 g', Hersteller: 'Manufaktur Wiesengrund' },
];

const common = {
  no: 431, category: 'Etiketten', family: 'seifenetikett', familyName: 'Seifenetikett', occasion: 'Handel & Preise',
  tags: ['Seife', 'Naturseife', 'Handseife', 'Kosmetik', 'Duft', 'Etikett', 'Zutaten', 'Manufaktur', 'Wellness'],
  formatKey: 'label-70x50', width: 70, height: 50, fields, sampleRows,
};

// ------------------------------------------------------------------ Botanisch: Creme, Lavendel, Antiqua
const PLUM = '#4b3a63';
const botanisch = {
  slug: 'seifenetikett-botanisch', name: 'Seifenetikett – Botanisch', variant: 'Botanisch',
  description: 'Seifenetikett (70 × 50 mm) im botanischen Stil: Cremeton, Lavendelzweig links, Duft in feiner Antiqua, Zutaten und Gewicht. Alle Angaben sind Felder für eine Datenliste.',
  tags: ['Botanisch', 'Lavendel', 'Creme', 'Antiqua', 'Natur', 'Pflanzen'],
  pages: [page('#faf6ee', [
    deko('Lavendel', 'deko-blumen-lavendel-navy', 5, 5, 14.5, undefined, { locked: true }),
    text('Kopf', 24, 6, 41, 3.4, 'Naturseife', { f: 'Raleway', s: 7, w: 600, c: PLUM, up: true, ls: 0.26, min: 5.5 }),
    text('Produkt', 24, 10.4, 42, 15, '{{Produkt}}', { f: 'Cormorant Garamond', s: 21, w: 700, c: '#2e2540', v: 'top', wrap: true, lh: 1, fit: 'shrink', min: 10 }),
    text('Zusatz', 24, 26, 40, 4.4, '{{Zusatz}}', { f: 'Cormorant Garamond', s: 9, i: true, w: 500, c: '#6a5f78', min: 6.5, showIf: 'Zusatz' }),
    line('Trenner', 24, 31.6, 66, 31.6, '#cfc4dc', 0.3),
    text('Zutaten', 24, 32.8, 42, 8.6, '{{Zutaten}}', { f: 'Raleway', s: 7, c: '#4a4358', v: 'top', wrap: true, lh: 1.25, min: 5.5, showIf: 'Zutaten' }),
    text('Gewicht', 24, 42.6, 12, 4, '{{Gewicht}}', { f: 'Raleway', s: 7.5, w: 800, c: PLUM, min: 6 }),
    text('Hersteller', 34, 42.6, 32, 4, '{{Hersteller}}', { f: 'Raleway', s: 7, w: 500, c: '#6a5f78', a: 'right', min: 5.5, showIf: 'Hersteller' }),
  ])],
};

// ------------------------------------------------------------------ Pastell: Blobs, runde Schrift, Gewichtskreis
const pastell = {
  slug: 'seifenetikett-pastell', name: 'Seifenetikett – Pastell', variant: 'Pastell',
  description: 'Freundliches Seifenetikett (70 × 50 mm) mit weichen Pastellformen: Duft in runder Schrift, Zusatz, Zutaten und das Gewicht in einem Kreis. Alle Angaben sind Felder für eine Datenliste.',
  tags: ['Pastell', 'Rosa', 'Rund', 'Freundlich', 'Blob', 'Modern', 'Fredoka'],
  pages: [page('#fff7f4', [
    deko('Form oben', 'deko-formen-blob-1-rose', 44, -14, 36, undefined, { opacity: 0.8, locked: true }),
    deko('Form unten', 'deko-formen-blob-3-salbei', -10, 34, 30, undefined, { opacity: 0.7, locked: true }),
    text('Kopf', 6, 5.6, 36, 3.4, 'Handgemachte Seife', { f: 'Fredoka', s: 7.5, w: 500, c: '#b05a68', min: 5.5 }),
    text('Produkt', 6, 10, 42, 17, '{{Produkt}}', { f: 'Fredoka', s: 19, w: 600, c: '#3d2a30', v: 'top', wrap: true, lh: 1.05, fit: 'shrink', min: 9 }),
    text('Zusatz', 6, 27.6, 40, 4.4, '{{Zusatz}}', { f: 'Fredoka', s: 8, w: 400, c: '#7a5a62', min: 6, showIf: 'Zusatz' }),
    text('Zutaten', 22, 34, 42, 8.6, '{{Zutaten}}', { f: 'Fredoka', s: 7, w: 400, c: '#5b4a4e', v: 'top', wrap: true, lh: 1.25, min: 5.5, showIf: 'Zutaten' }),
    text('Hersteller', 22, 43, 42, 3.6, '{{Hersteller}}', { f: 'Fredoka', s: 7, w: 500, c: '#b05a68', min: 5.5, showIf: 'Hersteller' }),
    ellipse('Gewicht Kreis', 52, 4.6, 14, 14, '#ffffff', { stroke: '#e89aa8', sw: 0.6, locked: true }),
    text('Gewicht', 52.2, 4.6, 13.6, 14, '{{Gewicht}}', { f: 'Fredoka', s: 9, w: 700, c: '#b05a68', a: 'center', min: 6 }),
  ])],
};

// ------------------------------------------------------------------ Apotheke: Schwarz auf Weiß, Raster, Mono
const apotheke = {
  slug: 'seifenetikett-labor', name: 'Seifenetikett – Labor', variant: 'Labor',
  description: 'Klares Seifenetikett (70 × 50 mm) im Laborstil: Schwarz auf Weiß, Kopfband, Tabelle für Zutaten, Gewicht und Hersteller in Schreibmaschinenschrift. Alle Angaben sind Felder für eine Datenliste.',
  tags: ['Labor', 'Schwarz-Weiß', 'Mono', 'Minimalistisch', 'Skandinavisch', 'Tabelle', 'Kosmetik'],
  pages: [page('#ffffff', [
    rect('Rahmen', 2.4, 2.4, 65.2, 45.2, null, { stroke: '#111111', sw: 0.6, locked: true }),
    rect('Kopfband', 2.4, 2.4, 65.2, 8.6, '#111111', { locked: true }),
    text('Kopf', 5, 2.4, 30, 8.6, 'NATURSEIFE', { f: 'IBM Plex Mono', s: 8, w: 700, c: '#ffffff', ls: 0.12, min: 6 }),
    text('Nr', 40, 2.4, 25.6, 8.6, '{{Gewicht}}', { f: 'IBM Plex Mono', s: 8, w: 700, c: '#ffffff', a: 'right', min: 6 }),
    text('Produkt', 5, 12.4, 58.5, 11, '{{Produkt}}', { f: 'Josefin Sans', s: 17, w: 600, c: '#111111', up: true, ls: 0.06, lh: 1, min: 8 }),
    text('Zusatz', 5, 23.4, 60, 4, '{{Zusatz}}', { f: 'IBM Plex Mono', s: 7, c: '#555555', min: 5.5, showIf: 'Zusatz' }),
    line('Linie 1', 2.4, 28.6, 67.6, 28.6, '#111111', 0.3, { locked: true }),
    text('Zutaten Titel', 5, 29.4, 14, 3.8, 'Inhalt', { f: 'IBM Plex Mono', s: 7, w: 700, c: '#111111', min: 5.5 }),
    text('Zutaten', 18, 29.6, 48, 10.2, '{{Zutaten}}', { f: 'IBM Plex Mono', s: 7, c: '#333333', v: 'top', wrap: true, lh: 1.25, min: 5.5, showIf: 'Zutaten' }),
    line('Linie 2', 2.4, 40.6, 67.6, 40.6, '#111111', 0.3, { locked: true }),
    text('Hersteller Titel', 5, 41.6, 14, 4.4, 'Von', { f: 'IBM Plex Mono', s: 7, w: 700, c: '#111111', min: 5.5 }),
    text('Hersteller', 18, 41.6, 48, 4.4, '{{Hersteller}}', { f: 'IBM Plex Mono', s: 7, c: '#333333', min: 5.5, showIf: 'Hersteller' }),
  ])],
};

module.exports = family(common, [botanisch, pastell, apotheke]);
