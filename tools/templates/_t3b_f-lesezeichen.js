'use strict';
const { text, rect, ellipse, line, icon, deko, field, page, gradient } = require('./dsl');
const { family } = require('./_t3b-lib');

const fields = [
  field('Zitat', 'Zitat', 'multiline', 'Ein Zimmer ohne Bücher ist wie ein Körper ohne Seele.'),
  field('Autor', 'Urheber', 'text', 'Cicero'),
];
const sampleRows = [
  { Zitat: 'Ein Zimmer ohne Bücher ist wie ein Körper ohne Seele.', Autor: 'Cicero' },
  { Zitat: 'Lesen heißt, mit fremden Augen sehen, mit fremden Ohren hören, mit fremdem Herzen fühlen und mit fremdem Verstand denken – und zugleich ganz bei sich selbst bleiben.', Autor: 'Sehr langer Name der Autorin' },
  { Zitat: 'Kurz und gut.', Autor: '' },
];

const common = {
  no: 446, category: 'Karten', family: 'bookmark', familyName: 'Lesezeichen', occasion: 'Verein & Schule',
  tags: ['Lesezeichen', 'Buch', 'Lesen', 'Bibliothek', 'Zitat', 'Geschenk', 'Schule', 'Werbegeschenk', 'Buchhandlung'],
  formatKey: 'bookmark', width: 50, height: 150, fields, sampleRows,
};

// ------------------------------------------------------------------ Botanisch: Zweig, Antiqua
const GREEN = '#41592f';
const botanisch = {
  slug: 'lesezeichen-botanisch', name: 'Lesezeichen – Botanisch', variant: 'Botanisch',
  description: 'Lesezeichen (50 × 150 mm) mit Eukalyptuszweig, Zitat in feiner Antiqua und Urheber: Zitat und Urheber sind Felder, du kannst also eine ganze Sammlung aus einer Liste drucken. Das Loch für ein Bändchen sitzt oben.',
  tags: ['Botanisch', 'Zweig', 'Eukalyptus', 'Natur', 'Antiqua', 'Grün'],
  pages: [page('#fbf8ee', [
    ellipse('Loch', 22.5, 7, 5, 5, '#ffffff', { stroke: '#cfc8b0', sw: 0.3, locked: true }),
    deko('Zweig', 'deko-blumen-eukalyptuszweig-salbei', 15.5, 17, 19, undefined, { locked: true }),
    line('Linie', 20, 124, 30, 124, GREEN, 0.4, { locked: true }),
    text('Zitat', 6, 90, 38, 31, '{{Zitat}}', { f: 'Cormorant Garamond', s: 11, w: 600, i: true, c: '#2c3a22', a: 'center', v: 'bottom', wrap: true, lh: 1.3, min: 6.5 }),
    text('Autor', 6, 127, 38, 6, '{{Autor}}', { f: 'Raleway', s: 7, w: 700, c: GREEN, a: 'center', up: true, ls: 0.2, min: 5.5, showIf: 'Autor' }),
  ])],
};

// ------------------------------------------------------------------ Bunt: Farbflächen, Kinder
const kinder = {
  slug: 'lesezeichen-bunt', name: 'Lesezeichen – Bunt', variant: 'Bunt',
  description: 'Buntes Lesezeichen (50 × 150 mm) für Kinder und Schulen: Regenbogen oben, runde Schrift für den Spruch, kleine Sterne. Zitat und Urheber sind Felder, so entsteht eine ganze Serie. Das Loch für ein Bändchen sitzt oben.',
  tags: ['Bunt', 'Kinder', 'Regenbogen', 'Schule', 'Klasse', 'Grundschule', 'Lesemaus', 'Fredoka'],
  pages: [page('#fff7e6', [
    deko('Regenbogen', 'deko-formen-regenbogen-bunt', 2, 14, 46, undefined, { locked: true }),
    ellipse('Loch', 22.5, 5, 5, 5, '#ffffff', { stroke: '#d9c9a6', sw: 0.3, locked: true }),
    text('Titel', 5, 42, 40, 9, 'Ich lese!', { f: 'Fredoka', s: 18, w: 700, c: '#ff6b35', a: 'center', min: 9 }),
    text('Zitat', 6, 56, 38, 54, '{{Zitat}}', { f: 'Fredoka', s: 11, w: 500, c: '#3b2f22', a: 'center', v: 'middle', wrap: true, lh: 1.35, min: 6.5 }),
    deko('Sterne', 'deko-sterne-girlande-bunt', 4, 120, 42, undefined, { locked: true }),
    text('Autor', 6, 134, 38, 7, '{{Autor}}', { f: 'Fredoka', s: 8, w: 500, c: '#1f6fd1', a: 'center', min: 6, showIf: 'Autor' }),
  ])],
};

// ------------------------------------------------------------------ Typografisch: Schwarz, senkrechte Schrift
const typo = {
  slug: 'lesezeichen-typografisch', name: 'Lesezeichen – Typografisch', variant: 'Typografisch',
  description: 'Typografisches Lesezeichen (50 × 150 mm) in Schwarz mit senkrecht gesetztem „LESEN“ und dem Zitat in klarer Grotesk: Zitat und Urheber sind Felder für eine Serie. Das Loch für ein Bändchen sitzt oben.',
  tags: ['Typografisch', 'Schwarz', 'Modern', 'Minimal', 'Senkrecht', 'Gelb', 'Buchhandlung'],
  pages: [page('#141414', [
    ellipse('Loch', 22.5, 7, 5, 5, '#2b2b2b', { stroke: '#555555', sw: 0.3, locked: true }),
    text('Lesen', -5, 29, 60, 30, 'LESEN', { f: 'Anton', s: 52, c: '#ffd23f', a: 'center', lh: 1, rotation: -90, min: 20, locked: true }),
    rect('Balken', 6, 80, 8, 1.2, '#ffd23f', { locked: true }),
    text('Zitat', 6, 85, 38, 42, '{{Zitat}}', { f: 'Inter', s: 8, w: 500, c: '#e6e6e6', v: 'top', wrap: true, lh: 1.4, min: 5.5 }),
    text('Autor', 6, 131, 38, 12, '{{Autor}}', { f: 'Inter', s: 7, w: 700, c: '#ffd23f', v: 'bottom', wrap: true, lh: 1.3, min: 5.5, showIf: 'Autor' }),
  ])],
};

module.exports = family(common, [botanisch, kinder, typo]);
