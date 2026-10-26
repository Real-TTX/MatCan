'use strict';
const { text, rect, ellipse, line, icon, frame, deko, field, page, gradient, shadow } = require('./dsl');
const { family, fade } = require('./_t3b-lib');

const fields = [
  field('Produkt', 'Produkt', 'text', 'Frische Erdbeeren', { required: true }),
  field('Preis', 'Preis', 'text', '2,99 €'),
  field('Einheit', 'Einheit', 'text', 'pro Schale (500 g)'),
  field('Rabatt', 'Rabatt', 'text', '−30 %'),
  field('Zeitraum', 'Zeitraum', 'text', 'Nur heute und morgen'),
];
const sampleRows = [
  { Produkt: 'Frische Erdbeeren', Preis: '2,99 €', Einheit: 'pro Schale (500 g)', Rabatt: '−30 %', Zeitraum: 'Nur heute und morgen' },
  { Produkt: 'Hausgemachte Marmelade im Dreierpack', Preis: '11,50 €', Einheit: 'statt 14,90 €', Rabatt: '−25 %', Zeitraum: 'Solange der Vorrat reicht' },
  { Produkt: 'Eier', Preis: '3,20 €', Einheit: '', Rabatt: '', Zeitraum: '' },
];

const common = {
  no: 461, category: 'Social Media', family: 'instagram-story-angebot', familyName: 'Instagram-Story Angebot', occasion: 'Social Media',
  tags: ['Instagram', 'Story', 'Angebot', 'Preis', 'Aktion', 'Rabatt', 'Social Media', 'Hochformat', 'Sale'],
  formatKey: 'instagram-story', unit: 'px', width: 1080, height: 1920, fields, sampleRows,
};

// Document unit px; 1 pt = 1.333 px. The top and bottom 250 px of a story are covered by the app: the content stays between.
// ------------------------------------------------------------------ Preisknaller: Rot, riesiger Preis
const preis = {
  slug: 'instagram-story-angebot-preis', name: 'Instagram-Story – Angebot Preisknaller', variant: 'Preisknaller',
  description: 'Lautes Angebot als Story (1080 × 1920 px): roter Verlauf, „Angebot“-Etikett, Produktname, riesiger Preis in Schlagzeilenschrift, Zeitraum und Aufforderung. Produkt, Preis, Einheit und Zeitraum sind Felder.',
  tags: ['Preisknaller', 'Rot', 'Riesig', 'Schlagzeile', 'Discount', 'Wochenmarkt'],
  pages: [page(gradient(170, '#e41b2f', '#9b0c1c'), [
    ellipse('Kreis', 560, 1180, 760, 760, '#ffffff', { opacity: 0.08, locked: true }),
    text('Etikett', 90, 300, 400, 76, 'Angebot', { f: 'Montserrat', s: 20, w: 800, c: '#111111', up: true, ls: 0.2, background: { color: '#ffd23f', radius: 38, padding: 28 }, wrap: false, fit: 'none' }),
    text('Produkt', 90, 420, 900, 280, '{{Produkt}}', { f: 'Poppins', s: 60, w: 800, c: '#ffffff', v: 'top', wrap: true, lh: 1.08, fit: 'shrink', min: 28 }),
    text('Preis', 60, 730, 960, 460, '{{Preis}}', { f: 'Anton', s: 300, c: '#ffffff', a: 'center', lh: 1, min: 90, shadow: shadow('#000000', 0.3, 0, 12, 14) }),
    text('Einheit', 90, 1200, 900, 70, '{{Einheit}}', { f: 'Montserrat', s: 24, w: 700, c: '#ffe1e1', a: 'center', min: 12, showIf: 'Einheit' }),
    text('Zeitraum', 190, 1330, 700, 90, '{{Zeitraum}}', { f: 'Montserrat', s: 22, w: 800, c: '#111111', a: 'center', up: true, ls: 0.08, background: { color: '#ffd23f', radius: 45, padding: 30 }, wrap: false, fit: 'none', showIf: 'Zeitraum' }),
    icon('Pfeil', 'arrow-down', 490, 1500, 100, '#ffffff', 2.4),
  ])],
};

// ------------------------------------------------------------------ Foto mit Welle
const foto = {
  slug: 'instagram-story-angebot-foto', name: 'Instagram-Story – Angebot mit Foto und Welle', variant: 'Foto & Welle',
  description: 'Angebot als Story (1080 × 1920 px): großes Fotofeld oben, eine marineblaue Welle als Übergang, darunter Produkt, Preis in Gelb, Zeitraum und Hinweis. Produkt, Preis, Einheit und Zeitraum sind Felder.',
  tags: ['Foto', 'Welle', 'Marineblau', 'Gelb', 'Café', 'Hofladen', 'Produktfoto'],
  pages: [page('#16264f', [
    rect('Foto Hintergrund', 0, 0, 1080, 1180, '#8fa6d4', { locked: true }),
    icon('Foto Symbol', 'image', 440, 560, 200, '#6d86bd', 1.2),
    frame('Foto', 0, 0, 1080, 1180, {}),
    deko('Welle', 'deko-formen-wellenrand-navy', 0, 1010, 1080, undefined, { locked: true }),
    text('Produkt', 90, 1240, 900, 190, '{{Produkt}}', { f: 'Poppins', s: 56, w: 800, c: '#ffffff', v: 'top', wrap: true, lh: 1.08, fit: 'shrink', min: 26 }),
    text('Preis', 90, 1440, 560, 200, '{{Preis}}', { f: 'Anton', s: 150, c: '#ffd23f', lh: 1, v: 'middle', min: 60 }),
    text('Einheit', 90, 1642, 600, 50, '{{Einheit}}', { f: 'Montserrat', s: 21, w: 600, c: '#c9d4f0', min: 12, showIf: 'Einheit' }),
    text('Zeitraum', 640, 1470, 350, 140, '{{Zeitraum}}', { f: 'Montserrat', s: 20, w: 700, c: '#16264f', a: 'center', v: 'middle', wrap: true, lh: 1.2, fit: 'shrink', min: 12, background: { color: '#ffffff', radius: 24, padding: 26 }, showIf: 'Zeitraum' }),
  ])],
};

// ------------------------------------------------------------------ Neon: dunkel mit leuchtendem Rabatt
const MINT = '#3dffb0';
const neon = {
  slug: 'instagram-story-angebot-neon', name: 'Instagram-Story – Angebot Neon', variant: 'Neon',
  description: 'Angebot als Story (1080 × 1920 px) für junge Läden und Streetfood: dunkler Grund, riesiger leuchtend grüner Rabatt, Produkt, Preis und Zeitraum. Produkt, Preis, Rabatt und Zeitraum sind Felder.',
  tags: ['Neon', 'Dunkel', 'Leuchtend', 'Streetfood', 'Rabatt', 'Jung', 'Blitzangebot'],
  pages: [page('#0d0d1f', [
    deko('Funkeln links', 'deko-sterne-funkeln-weiss', 80, 340, 130, undefined, { opacity: 0.8, locked: true }),
    deko('Funkeln rechts', 'deko-sterne-funkeln-weiss', 860, 1240, 100, undefined, { opacity: 0.6, locked: true }),
    text('Etikett', 90, 400, 900, 60, 'Blitzangebot', { f: 'Montserrat', s: 20, w: 800, c: MINT, a: 'center', up: true, ls: 0.4, min: 12 }),
    text('Rabatt', 60, 480, 960, 520, '{{Rabatt}}', { f: 'Anton', s: 340, c: MINT, a: 'center', lh: 1, min: 100, shadow: shadow(MINT, 0.6, 40, 0, 0) }),
    text('Produkt', 90, 1040, 900, 220, '{{Produkt}}', { f: 'Poppins', s: 48, w: 700, c: '#ffffff', a: 'center', v: 'top', wrap: true, lh: 1.12, fit: 'shrink', min: 24 }),
    text('Preis', 90, 1280, 900, 130, '{{Preis}}', { f: 'Anton', s: 90, c: '#ffffff', a: 'center', lh: 1, min: 30 }),
    text('Einheit', 90, 1400, 900, 56, '{{Einheit}}', { f: 'Montserrat', s: 20, w: 600, c: '#9a9ac0', a: 'center', min: 12, showIf: 'Einheit' }),
    text('Zeitraum', 240, 1500, 600, 84, '{{Zeitraum}}', { f: 'Montserrat', s: 19, w: 800, c: '#0d0d1f', a: 'center', up: true, ls: 0.1, background: { color: MINT, radius: 42, padding: 28 }, wrap: false, fit: 'none', showIf: 'Zeitraum' }),
  ])],
};

module.exports = family(common, [preis, foto, neon]);
