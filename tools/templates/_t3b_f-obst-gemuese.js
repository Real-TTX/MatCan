'use strict';
const { text, rect, ellipse, line, icon, strip, deko, page } = require('./dsl');
const { family } = require('./_t3b-lib');
const base = require('./02-obst-gemuese');

const common = {
  no: 403, category: 'Etiketten', family: base.family, familyName: base.familyName, occasion: 'Handel & Preise',
  tags: ['Preisschild', 'Obst', 'Gemüse', 'Markt', 'Hofladen', 'Preis', 'Etikett', 'Herkunft'],
  formatKey: 'label-100x70', width: 100, height: 70, fields: base.fields, sampleRows: base.sampleRows,
};

// ------------------------------------------------------------------ Frisch: Weiß, grün, großer oranger Preiskreis
const G = '#1b4332';
const OR = '#ff7a1a';
const frisch = {
  slug: 'obst-gemuese-frisch', name: 'Obst & Gemüse – Preisschild frisch', variant: 'Frisch',
  description: 'Helles, frisches Preisschild (100 × 70 mm) für Obst und Gemüse: großer Produktname in Grün, Herkunft mit Flagge und Siegel und ein auffälliger orangefarbener Preiskreis. Alle Angaben sind Felder für eine Datenliste.',
  tags: ['Frisch', 'Hell', 'Supermarkt', 'Wochenmarkt', 'Preiskreis'],
  pages: [page('#ffffff', [
    deko('Blob', 'deko-formen-blob-3-salbei', 66, -20, 52, undefined, { opacity: 0.45, locked: true }),
    rect('Balken', 0, 0, 4, 70, G, { locked: true }),
    text('Klasse', 10, 7, 36, 6, '{{Klasse}}', { f: 'Poppins', s: 7.5, w: 600, c: '#ffffff', up: true, ls: 0.1, a: 'center', background: { color: G, radius: 3, padding: 1.8 }, showIf: 'Klasse' }),
    text('Name', 10, 15.5, 85, 15, '{{Name}}', { f: 'Poppins', s: 30, w: 700, c: G, v: 'bottom', lh: 1.1, min: 14 }),
    icon('Ort Symbol', 'map-pin', 10, 35.4, 4.4, OR, 2.2),
    text('Herkunft', 16, 34.6, 40, 6, '{{Herkunft}}', { f: 'Poppins', s: 9.5, w: 500, c: '#4a5a52', min: 7, showIf: 'Herkunft' }),
    line('Trenner', 10, 48, 54, 48, '#d6e4dc', 0.5),
    strip('Land und Siegel', 10, 53, 44, 9, ['Land', 'Siegel'], { gap: 2.5 }),
    ellipse('Preiskreis', 58, 31, 37, 37, OR, { locked: true }),
    text('Preis', 60.5, 38.4, 32, 14, '{{Preis}}', { f: 'Poppins', s: 34, w: 700, c: '#ffffff', a: 'center', lh: 1, min: 16 }),
    text('Euro Einheit', 61, 53, 31, 5, '€ {{Einheit}}', { f: 'Poppins', s: 10, w: 600, c: '#ffffff', a: 'center', min: 7 }),
  ])],
};

// ------------------------------------------------------------------ Marktstand: Kraftpapier, Handschrift, rote Zackenscheibe
const KR = '#ead9b9';
const BR = '#3b2a1a';
const markt = {
  slug: 'obst-gemuese-marktstand', name: 'Obst & Gemüse – Preisschild Marktstand', variant: 'Marktstand',
  description: 'Preisschild im Marktstand-Stil (100 × 70 mm): Kraftpapier-Optik, Produktname in handgezeichneter Schrift, Herkunft und Siegel und eine rote Zackenscheibe für den Preis. Alle Angaben sind Felder für eine Datenliste.',
  tags: ['Marktstand', 'Handschrift', 'Kraftpapier', 'Rustikal', 'Wochenmarkt', 'Hofladen', 'Angebot'],
  pages: [page(KR, [
    rect('Rand', 2.5, 2.5, 95, 65, null, { stroke: BR, sw: 0.5, dash: 'dashed', radius: 2, opacity: 0.55, locked: true }),
    text('Name', 7, 6, 62, 25, '{{Name}}', { f: 'Amatic SC', s: 50, w: 700, c: BR, up: true, v: 'bottom', wrap: true, lh: 0.95, fit: 'shrink', min: 20 }),
    text('Herkunft', 7, 33.2, 48, 6.4, 'aus {{Herkunft}}', { f: 'Patrick Hand', s: 12, c: '#7a4a1a', min: 8, showIf: 'Herkunft' }),
    text('Klasse', 7, 41.5, 40, 6, '{{Klasse}}', { f: 'Patrick Hand', s: 11, c: BR, min: 8, showIf: 'Klasse' }),
    line('Strich', 7, 50.4, 50, 50.4, BR, 0.4, { opacity: 0.5 }),
    strip('Land und Siegel', 7, 53, 46, 9, ['Land', 'Siegel'], { gap: 2.5 }),
    deko('Zackenscheibe', 'deko-baender-starburst-bordeaux', 56, 26, 38, undefined, { locked: true }),
    text('Preis', 60, 36, 30, 12, '{{Preis}}', { f: 'Amatic SC', s: 38, w: 700, c: '#ffffff', a: 'center', lh: 1, min: 18 }),
    text('Euro Einheit', 61, 48.4, 28, 5.4, '€ {{Einheit}}', { f: 'Patrick Hand', s: 11, c: '#ffffff', a: 'center', min: 7 }),
  ])],
};

module.exports = family(common, [frisch, markt]);
