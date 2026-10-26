'use strict';
const { text, rect, ellipse, line, icon, deko, field, page } = require('./dsl');
const { family } = require('./_t3b-lib');

const fields = [
  field('Produkt', 'Produkt', 'text', 'Bergkäse', { required: true }),
  field('Zusatz', 'Zusatz', 'text', '12 Monate gereift'),
  field('Inhalt', 'Inhalt', 'text', 'ca. 250 g'),
];
const sampleRows = [
  { Produkt: 'Bergkäse', Zusatz: '12 Monate gereift', Inhalt: 'ca. 250 g' },
  { Produkt: 'Himbeer-Rhabarber-Marmelade', Zusatz: 'mit 55 % Frucht, kleine Charge', Inhalt: '250 g' },
  { Produkt: 'Tee', Zusatz: '', Inhalt: '' },
  { Produkt: 'Brot', Zusatz: 'Sauerteig, Steinofen', Inhalt: '750 g' },
];

const common = {
  no: 440, category: 'Etiketten', family: 'label-round-60', familyName: 'Etikett rund', occasion: 'Handel & Preise',
  tags: ['Etikett', 'Aufkleber', 'Sticker', 'Rund', 'Siegel', 'Verpackung', 'Geschenk', 'Hofladen', 'Marktstand'],
  formatKey: 'label-round-60', width: 60, height: 60, fields, sampleRows,
};

// ------------------------------------------------------------------ Stempel: Kraftpapier, Doppelring, Bogenschrift
const BR = '#3b2a1a';
const stempel = {
  slug: 'etikett-rund-stempel', name: 'Etikett rund – Stempel', variant: 'Stempel',
  description: 'Rundes Etikett (60 mm) im Stempel-Look: Kraftpapier, Doppelring, Bogenschrift oben und unten, in der Mitte Produkt, Zusatz und Inhalt. Produkt, Zusatz und Inhalt sind Felder für eine Datenliste.',
  tags: ['Stempel', 'Kraftpapier', 'Vintage', 'Bogenschrift', 'Doppelring', 'Handgemacht'],
  pages: [page('#ffffff', [
    ellipse('Grund', 0.5, 0.5, 59, 59, '#e6d3ae', { locked: true }),
    ellipse('Ring außen', 3, 3, 54, 54, null, { stroke: BR, sw: 0.7, locked: true }),
    ellipse('Ring innen', 13.4, 13.4, 33.2, 33.2, null, { stroke: BR, sw: 0.25, locked: true }),
    text('Bogen oben', 8, 5.6, 44, 6, 'HANDGEMACHT · REGIONAL', { f: 'Montserrat', s: 7, w: 700, c: BR, ls: 0.14, curve: 36, v: 'top', min: 5.5, locked: true }),
    text('Bogen unten', 8, 47.4, 44, 6, '★ AUS UNSERER REGION ★', { f: 'Montserrat', s: 7, w: 700, c: BR, ls: 0.14, curve: -36, v: 'bottom', min: 5.5, locked: true }),
    text('Produkt', 14.6, 21.4, 30.8, 10.6, '{{Produkt}}', { f: 'Abril Fatface', s: 14, c: BR, a: 'center', lh: 1, min: 5.5 }),
    text('Zusatz', 15, 32.4, 30, 4.6, '{{Zusatz}}', { f: 'Lora', s: 7, i: true, c: '#5a4328', a: 'center', min: 5.5, showIf: 'Zusatz' }),
    text('Inhalt', 15, 38, 30, 4.2, '{{Inhalt}}', { f: 'Montserrat', s: 7, w: 700, c: BR, a: 'center', min: 5.5, showIf: 'Inhalt' }),
  ])],
};

// ------------------------------------------------------------------ Sonne: Korallrot, Strahlenkranz, Schreibschrift
const CORAL = '#ee5a3c';
const sonne = {
  slug: 'etikett-rund-sonne', name: 'Etikett rund – Sonne', variant: 'Sonne',
  description: 'Fröhliches rundes Etikett (60 mm): korallroter Grund, goldener Strahlenkranz und eine helle Scheibe mit Produktname in Schreibschrift, Zusatz und Inhalt. Produkt, Zusatz und Inhalt sind Felder für eine Datenliste.',
  tags: ['Sonne', 'Bunt', 'Strahlenkranz', 'Schreibschrift', 'Sommer', 'Fröhlich', 'Marmelade'],
  pages: [page('#ffffff', [
    ellipse('Grund', 0.5, 0.5, 59, 59, CORAL, { locked: true }),
    deko('Strahlenkranz', 'deko-ornamente-strahlenkranz-gold', 2, 2, 56, undefined, { locked: true }),
    ellipse('Scheibe', 14, 14, 32, 32, '#fff6e6', { locked: true }),
    text('Produkt', 15.4, 19.4, 29.2, 12, '{{Produkt}}', { f: 'Dancing Script', s: 17, w: 700, c: '#7a2410', a: 'center', lh: 1, min: 5.5, v: 'middle' }),
    text('Zusatz', 16, 32, 28, 4.4, '{{Zusatz}}', { f: 'Montserrat', s: 7, w: 600, c: '#7a2410', a: 'center', min: 5.5, showIf: 'Zusatz' }),
    text('Inhalt', 16, 36.6, 28, 4, '{{Inhalt}}', { f: 'Montserrat', s: 7, w: 800, c: CORAL, a: 'center', min: 5.5, showIf: 'Inhalt' }),
  ])],
};

// ------------------------------------------------------------------ Minimal: Weiß, Haarring, Blatt
const minimal = {
  slug: 'etikett-rund-minimal', name: 'Etikett rund – Minimal', variant: 'Minimal',
  description: 'Schlichtes rundes Etikett (60 mm): weiße Scheibe mit feinem schwarzem Ring, kleinem Blatt, Produktname in Versalien, Zusatz und Inhalt. Produkt, Zusatz und Inhalt sind Felder für eine Datenliste.',
  tags: ['Minimal', 'Schlicht', 'Weiß', 'Ring', 'Skandinavisch', 'Bio', 'Verpackung'],
  pages: [page('#ffffff', [
    ellipse('Ring', 1, 1, 58, 58, '#ffffff', { stroke: '#111111', sw: 0.8, locked: true }),
    ellipse('Ring innen', 3.4, 3.4, 53.2, 53.2, null, { stroke: '#111111', sw: 0.2, locked: true }),
    icon('Blatt', 'leaf', 26.5, 9.6, 7, '#3d7a4a', 1.6, { locked: true }),
    text('Produkt', 8, 19.4, 44, 14, '{{Produkt}}', { f: 'Inter', s: 12, w: 700, c: '#111111', a: 'center', up: true, ls: 0.08, lh: 1.1, v: 'middle', min: 5.5 }),
    line('Trenner', 25, 35, 35, 35, '#111111', 0.3, { locked: true }),
    text('Zusatz', 10, 36.6, 40, 4.4, '{{Zusatz}}', { f: 'Inter', s: 7, w: 400, c: '#555555', a: 'center', min: 5.5, showIf: 'Zusatz' }),
    text('Inhalt', 10, 41.4, 40, 4.4, '{{Inhalt}}', { f: 'Inter', s: 7, w: 700, c: '#111111', a: 'center', min: 5.5, showIf: 'Inhalt' }),
  ])],
};

module.exports = family(common, [stempel, sonne, minimal]);
