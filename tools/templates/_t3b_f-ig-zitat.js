'use strict';
const { text, rect, ellipse, line, icon, deko, field, page, gradient } = require('./dsl');
const { family } = require('./_t3b-lib');

const fields = [
  field('Zitat', 'Zitat', 'multiline', 'Wer aufhört, besser zu werden, hat aufgehört, gut zu sein.', { required: true }),
  field('Autor', 'Urheber', 'text', 'Marie von Ebner-Eschenbach'),
];
const sampleRows = [
  { Zitat: 'Wer aufhört, besser zu werden, hat aufgehört, gut zu sein.', Autor: 'Marie von Ebner-Eschenbach' },
  { Zitat: 'Das Leben ist das, was passiert, während du eifrig dabei bist, andere Pläne zu machen – und manchmal ist genau das das Beste daran.', Autor: 'John Lennon' },
  { Zitat: 'Heute ist ein guter Tag.', Autor: '' },
];

const common = {
  no: 449, category: 'Social Media', family: 'instagram-zitat', familyName: 'Instagram-Beitrag Zitat', occasion: 'Social Media',
  tags: ['Instagram', 'Beitrag', 'Zitat', 'Spruch', 'Weisheit', 'Motivation', 'Social Media', 'Facebook', 'Post'],
  formatKey: 'instagram-post', unit: 'px', width: 1080, height: 1080, fields, sampleRows,
};

// Document unit px: a font size is in points, 1 pt = 1.333 px.
// ------------------------------------------------------------------ Elegant dunkel
const GOLD = '#d6b25e';
const elegant = {
  slug: 'instagram-zitat-elegant', name: 'Instagram-Beitrag – Zitat elegant', variant: 'Elegant',
  description: 'Eleganter Zitat-Beitrag für Instagram (1080 × 1080 px): nachtblauer Verlauf, goldene Anführungszeichen, Zitat in kursiver Antiqua und Urheber mit Goldlinie. Zitat und Urheber sind Felder, so entsteht eine ganze Reihe aus einer Liste.',
  tags: ['Elegant', 'Dunkel', 'Gold', 'Antiqua', 'Nachtblau', 'Weisheit'],
  pages: [page(gradient(160, '#0f1a35', '#1d2d58'), [
    text('Anführungszeichen', 80, 60, 300, 300, '„', { f: 'Playfair Display', s: 260, w: 700, c: GOLD, lh: 1, min: 100, locked: true }),
    text('Zitat', 110, 330, 860, 430, '{{Zitat}}', { f: 'Playfair Display', s: 52, w: 500, i: true, c: '#ffffff', v: 'middle', wrap: true, lh: 1.35, fit: 'shrink', min: 20 }),
    line('Linie', 110, 800, 250, 800, GOLD, 3, { locked: true }),
    text('Autor', 110, 822, 860, 56, '{{Autor}}', { f: 'Montserrat', s: 19, w: 600, c: GOLD, up: true, ls: 0.2, min: 11, showIf: 'Autor' }),
    text('Handle', 110, 972, 860, 40, '@hofladen.wiesengrund', { f: 'Montserrat', s: 16, w: 500, c: '#8d9bc0', min: 9 }),
  ])],
};

// ------------------------------------------------------------------ Pastell mit Handschrift
const pastell = {
  slug: 'instagram-zitat-pastell', name: 'Instagram-Beitrag – Zitat pastell', variant: 'Pastell',
  description: 'Sanfter Zitat-Beitrag für Instagram (1080 × 1080 px): Pfirsichton mit weichen Formen, Zitat in Handschrift und kleinem Herz beim Urheber. Zitat und Urheber sind Felder, so entsteht eine ganze Reihe aus einer Liste.',
  tags: ['Pastell', 'Handschrift', 'Sanft', 'Rosa', 'Achtsamkeit', 'Blogger'],
  pages: [page('#ffe9dd', [
    deko('Form oben', 'deko-formen-blob-1-rose', 640, -140, 560, undefined, { opacity: 0.7, locked: true }),
    deko('Form unten', 'deko-formen-blob-3-salbei', -300, 760, 520, undefined, { opacity: 0.6, locked: true }),
    text('Zitat', 120, 210, 840, 520, '{{Zitat}}', { f: 'Caveat', s: 62, w: 700, c: '#4b2e2b', a: 'center', v: 'middle', wrap: true, lh: 1.15, fit: 'shrink', min: 26 }),
    icon('Herz', 'heart', 504, 770, 72, '#e0707f', 2),
    text('Autor', 140, 860, 800, 60, '{{Autor}}', { f: 'Poppins', s: 20, w: 600, c: '#7a5650', a: 'center', min: 11, showIf: 'Autor' }),
  ])],
};

// ------------------------------------------------------------------ Bold gelb
const bold = {
  slug: 'instagram-zitat-bold', name: 'Instagram-Beitrag – Zitat bold', variant: 'Bold',
  description: 'Kräftiger Zitat-Beitrag für Instagram (1080 × 1080 px): gelber Grund, riesige Anführungszeichen und Zitat in fetten Versalien, Urheber im schwarzen Balken. Zitat und Urheber sind Felder, so entsteht eine ganze Reihe aus einer Liste.',
  tags: ['Bold', 'Gelb', 'Schwarz', 'Versalien', 'Motivation', 'Laut'],
  pages: [page('#ffd23f', [
    text('Anführungszeichen', 40, -20, 420, 420, '“', { f: 'Anton', s: 330, c: '#111111', lh: 1, min: 100, locked: true }),
    text('Zitat', 80, 260, 920, 560, '{{Zitat}}', { f: 'Anton', s: 60, c: '#111111', up: true, v: 'middle', wrap: true, lh: 1.15, fit: 'shrink', min: 24 }),
    text('Autor', 80, 880, 700, 64, '{{Autor}}', { f: 'Montserrat', s: 20, w: 700, c: '#ffd23f', up: true, ls: 0.12, background: { color: '#111111', radius: 0, padding: 22 }, wrap: false, fit: 'none', showIf: 'Autor' }),
  ])],
};

module.exports = family(common, [elegant, pastell, bold]);
