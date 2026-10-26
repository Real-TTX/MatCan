'use strict';
const { text, rect, ellipse, line, icon, deko, field, page } = require('./dsl');
const { family } = require('./_t3b-lib');

const fields = [
  field('Produkt', 'Duft', 'text', 'Vanille & Zimt', { required: true }),
  field('Zusatz', 'Zusatz', 'text', 'Duftkerze aus Sojawachs'),
  field('Brenndauer', 'Brenndauer', 'text', 'ca. 40 Stunden'),
  field('Gewicht', 'Gewicht', 'text', '180 g'),
  field('Hersteller', 'Hersteller', 'text', 'Manufaktur Wiesengrund'),
];
const sampleRows = [
  { Produkt: 'Vanille & Zimt', Zusatz: 'Duftkerze aus Sojawachs', Brenndauer: 'ca. 40 Stunden', Gewicht: '180 g', Hersteller: 'Manufaktur Wiesengrund' },
  { Produkt: 'Wintermärchen: Tannennadel, Orange und Gewürznelke', Zusatz: 'Handgegossene Duftkerze aus nachhaltigem Sojawachs im Glas', Brenndauer: 'ca. 60 Stunden', Gewicht: '300 g', Hersteller: 'Manufaktur Wiesengrund' },
  { Produkt: 'Meeresbrise', Zusatz: 'Duftkerze', Brenndauer: 'ca. 25 Stunden', Gewicht: '110 g', Hersteller: '' },
  { Produkt: 'Zeder', Zusatz: '', Brenndauer: '', Gewicht: '180 g', Hersteller: 'Manufaktur Wiesengrund' },
];
const HINWEIS = 'Nie unbeaufsichtigt brennen lassen. Von Kindern und Haustieren fernhalten. Docht vor dem Anzünden auf 5 mm kürzen.';

const common = {
  no: 434, category: 'Etiketten', family: 'kerzenetikett', familyName: 'Kerzenetikett', occasion: 'Handel & Preise',
  tags: ['Kerze', 'Duftkerze', 'Sojawachs', 'Kerzenglas', 'Etikett', 'Brenndauer', 'Warnhinweis', 'Manufaktur', 'Wohnen'],
  formatKey: 'label-100x70', width: 100, height: 70, fields, sampleRows,
};

// ------------------------------------------------------------------ Dunkel und Gold
const GOLD = '#c9a24a';
const dunkel = {
  slug: 'kerzenetikett-gold', name: 'Kerzenetikett – Schwarz & Gold', variant: 'Schwarz & Gold',
  description: 'Edles Kerzenetikett (100 × 70 mm): schwarzer Grund, goldener Rahmen und Flammensymbol, Duft in römischen Versalien, Zusatz, Brenndauer, Gewicht und Sicherheitshinweis. Alle Angaben sind Felder für eine Datenliste.',
  tags: ['Schwarz', 'Gold', 'Luxus', 'Edel', 'Cinzel', 'Geschenk'],
  pages: [page('#111113', [
    rect('Rahmen außen', 3, 3, 94, 64, null, { stroke: GOLD, sw: 0.6, locked: true }),
    rect('Rahmen innen', 4.4, 4.4, 91.2, 61.2, null, { stroke: GOLD, sw: 0.2, locked: true }),
    icon('Flamme', 'flame', 45.5, 8.4, 9, GOLD, 1.3, { locked: true }),
    text('Produkt', 10, 19.4, 80, 14, '{{Produkt}}', { f: 'Cinzel', s: 20, w: 600, c: '#fff4dc', a: 'center', up: true, ls: 0.1, lh: 1.1, wrap: true, fit: 'shrink', v: 'middle', min: 9 }),
    deko('Schnörkel', 'deko-ornamente-schnoerkel-breit-gold', 37, 34.4, 26, undefined, { locked: true }),
    text('Zusatz', 10, 43.4, 80, 4.6, '{{Zusatz}}', { f: 'Cormorant Garamond', s: 10, i: true, w: 500, c: '#d8c49a', a: 'center', min: 7, showIf: 'Zusatz' }),
    text('Brenndauer', 10, 49.4, 38, 4.2, '{{Brenndauer}}', { f: 'Raleway', s: 7.5, w: 600, c: GOLD, a: 'right', up: true, ls: 0.12, min: 6, showIf: 'Brenndauer' }),
    ellipse('Punkt', 49.2, 51, 1.6, 1.6, GOLD, { locked: true }),
    text('Gewicht', 52, 49.4, 38, 4.2, 'Inhalt {{Gewicht}}', { f: 'Raleway', s: 7.5, w: 600, c: GOLD, up: true, ls: 0.12, min: 6 }),
    text('Hinweis', 12, 55.6, 76, 8, HINWEIS, { f: 'Raleway', s: 7, c: '#9a9488', a: 'center', v: 'top', wrap: true, lh: 1.3, min: 5.5 }),
  ])],
};

// ------------------------------------------------------------------ Skandi: helles Beige, zwei Spalten, Haarlinien
const skandi = {
  slug: 'kerzenetikett-skandi', name: 'Kerzenetikett – Skandinavisch', variant: 'Skandinavisch',
  description: 'Ruhiges Kerzenetikett (100 × 70 mm) im skandinavischen Stil: helles Beige, viel Weißraum, Duft in schmaler Grotesk, Haarlinien, Angaben in zwei Spalten. Alle Angaben sind Felder für eine Datenliste.',
  tags: ['Skandinavisch', 'Minimal', 'Beige', 'Hell', 'Ruhig', 'Hygge', 'Wohnen'],
  pages: [page('#f1ece3', [
    ellipse('Sonne', 78, 7, 16, 16, null, { stroke: '#8a7c6a', sw: 0.5, locked: true }),
    ellipse('Sonne innen', 83, 12, 6, 6, '#c9b99f', { locked: true }),
    text('Kopf', 9, 7, 66, 8, '{{Zusatz}}', { f: 'Josefin Sans', s: 7.5, w: 400, c: '#6b5f50', up: true, ls: 0.1, v: 'top', wrap: true, lh: 1.25, min: 5.5, showIf: 'Zusatz' }),
    text('Produkt', 9, 16, 66, 23, '{{Produkt}}', { f: 'Josefin Sans', s: 30, w: 300, c: '#2b251d', up: true, ls: 0.06, lh: 1.05, wrap: true, fit: 'shrink', v: 'top', min: 12 }),
    line('Haarlinie', 9, 41, 91, 41, '#8a7c6a', 0.25, { locked: true }),
    text('Brenndauer Titel', 9, 43.4, 28, 3.4, 'Brenndauer', { f: 'Josefin Sans', s: 7, w: 600, c: '#8a7c6a', up: true, ls: 0.2, min: 5.5 }),
    text('Brenndauer', 9, 46.8, 28, 4.6, '{{Brenndauer}}', { f: 'Josefin Sans', s: 10, w: 400, c: '#2b251d', min: 7, showIf: 'Brenndauer' }),
    text('Gewicht Titel', 38, 43.4, 16, 3.4, 'Inhalt', { f: 'Josefin Sans', s: 7, w: 600, c: '#8a7c6a', up: true, ls: 0.2, min: 5.5 }),
    text('Gewicht', 38, 46.8, 16, 4.6, '{{Gewicht}}', { f: 'Josefin Sans', s: 10, w: 400, c: '#2b251d', min: 7 }),
    text('Hersteller', 55, 46.8, 36, 4.6, '{{Hersteller}}', { f: 'Josefin Sans', s: 7, w: 400, c: '#6b5f50', a: 'right', min: 5.5, showIf: 'Hersteller' }),
    text('Hinweis', 9, 56, 82, 9, HINWEIS, { f: 'Josefin Sans', s: 7, w: 400, c: '#8a7c6a', v: 'top', wrap: true, lh: 1.35, min: 5.5 }),
  ])],
};

// ------------------------------------------------------------------ Boho: Sand, Terrakotta, Bogen
const TERRA = '#b8613f';
const boho = {
  slug: 'kerzenetikett-boho', name: 'Kerzenetikett – Boho', variant: 'Boho',
  description: 'Warmes Boho-Kerzenetikett (100 × 70 mm): Sandton, Rosé-Bogen mit Flamme, Duft in Schreibschrift, Zusatz, Brenndauer, Gewicht und Sicherheitshinweis. Alle Angaben sind Felder für eine Datenliste.',
  tags: ['Boho', 'Rosé', 'Sand', 'Bogen', 'Schreibschrift', 'Natürlich', 'Warm'],
  pages: [page('#f3e6d6', [
    deko('Bogen', 'deko-formen-bogen-rose', 7, 8, 30, undefined, { locked: true }),
    icon('Flamme', 'flame', 17, 23, 10, '#ffffff', 1.4, { locked: true }),
    text('Produkt', 44, 8, 50, 22, '{{Produkt}}', { f: 'Parisienne', s: 25, c: '#4a2a1d', lh: 1.15, wrap: true, fit: 'shrink', v: 'middle', min: 11 }),
    text('Zusatz', 44, 31.2, 50, 7, '{{Zusatz}}', { f: 'Lora', s: 8.5, i: true, c: '#7a5a46', v: 'top', wrap: true, lh: 1.25, min: 6, showIf: 'Zusatz' }),
    line('Linie', 44, 39.4, 93, 39.4, TERRA, 0.4, { locked: true }),
    text('Brenndauer', 44, 41, 50, 4.2, '{{Brenndauer}}', { f: 'Montserrat', s: 7.5, w: 700, c: TERRA, up: true, ls: 0.1, min: 6, showIf: 'Brenndauer' }),
    text('Gewicht', 44, 45.6, 50, 4.2, 'Inhalt {{Gewicht}}', { f: 'Montserrat', s: 7.5, w: 600, c: '#4a2a1d', min: 6 }),
    text('Hersteller', 44, 50.2, 50, 4, '{{Hersteller}}', { f: 'Montserrat', s: 7, w: 500, c: '#7a5a46', min: 5.5, showIf: 'Hersteller' }),
    text('Hinweis', 8, 57, 86, 9, HINWEIS, { f: 'Montserrat', s: 7, c: '#7a5a46', v: 'top', wrap: true, lh: 1.35, min: 5.5 }),
  ])],
};

module.exports = family(common, [dunkel, skandi, boho]);
