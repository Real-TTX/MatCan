'use strict';
const { text, rect, ellipse, line, icon, frame, deko, field, page, gradient, shadow } = require('./dsl');
const { family } = require('./_t3b-lib');

const fields = [
  field('Titel', 'Überschrift', 'text', 'Angebot der Woche'),
  field('Produkt', 'Produkt', 'text', 'Bio-Äpfel Elstar', { required: true }),
  field('Preis', 'Preis', 'text', '2,49 €'),
  field('Einheit', 'Einheit', 'text', 'pro Kilo'),
  field('Zeitraum', 'Zeitraum', 'text', 'Nur bis Samstag'),
];
const sampleRows = [
  { Titel: 'Angebot der Woche', Produkt: 'Bio-Äpfel Elstar', Preis: '2,49 €', Einheit: 'pro Kilo', Zeitraum: 'Nur bis Samstag' },
  { Titel: 'Heute im Angebot', Produkt: 'Frisches Dinkelbrot aus dem Steinofen', Preis: '12,90 €', Einheit: 'pro 750-g-Laib', Zeitraum: 'Nur solange der Vorrat reicht' },
  { Titel: '', Produkt: 'Eier', Preis: '3,20 €', Einheit: '', Zeitraum: '' },
];

const common = {
  no: 452, category: 'Social Media', family: 'instagram-angebot', familyName: 'Instagram-Beitrag Angebot', occasion: 'Social Media',
  tags: ['Instagram', 'Beitrag', 'Angebot', 'Preis', 'Aktion', 'Produkt', 'Social Media', 'Facebook', 'Wochenangebot'],
  formatKey: 'instagram-post', unit: 'px', width: 1080, height: 1080, fields, sampleRows,
};

// Document unit px: 1 pt = 1.333 px.
// ------------------------------------------------------------------ Fotokarte: Bildfläche oben, weiße Karte unten, Preisrund
const GRN = '#1b4332';
const OR = '#ff7a1a';
const karte = {
  slug: 'instagram-angebot-fotokarte', name: 'Instagram-Beitrag – Angebot mit Foto', variant: 'Fotokarte',
  description: 'Angebots-Beitrag für Instagram (1080 × 1080 px): große Bildfläche für dein Produktfoto, darunter eine Karte mit Überschrift, Produkt und Zeitraum, dazu ein orangefarbener Preisrund. Alle Texte und der Preis sind Felder.',
  tags: ['Foto', 'Karte', 'Preisrund', 'Grün', 'Orange', 'Lebensmittel', 'Hofladen'],
  pages: [page(GRN, [
    rect('Foto Hintergrund', 0, 0, 1080, 640, '#a9c5b3', { locked: true }),
    icon('Foto Symbol', 'image', 440, 220, 200, '#7fa592', 1.2),
    frame('Foto', 0, 0, 1080, 640, {}),
    rect('Karte', 60, 560, 960, 460, '#ffffff', { radius: 44, shadow: shadow('#000000', 0.25, 30, 0, 16) }),
    text('Titel', 110, 600, 520, 50, '{{Titel}}', { f: 'Poppins', s: 15, w: 700, c: OR, up: true, ls: 0.14, min: 10, showIf: 'Titel' }),
    text('Produkt', 110, 654, 560, 200, '{{Produkt}}', { f: 'Poppins', s: 44, w: 700, c: GRN, v: 'middle', wrap: true, lh: 1.1, fit: 'shrink', min: 18 }),
    line('Linie', 110, 870, 640, 870, '#d9e6de', 3, { locked: true }),
    icon('Uhr', 'clock', 110, 902, 44, OR, 2.2),
    text('Zeitraum', 168, 898, 520, 52, '{{Zeitraum}}', { f: 'Montserrat', s: 20, w: 600, c: '#3d5a4b', min: 10, showIf: 'Zeitraum' }),
    ellipse('Preisrund', 700, 600, 280, 280, OR, { shadow: shadow('#000000', 0.2, 16, 0, 8) }),
    text('Preis', 716, 668, 248, 110, '{{Preis}}', { f: 'Poppins', s: 40, w: 800, c: '#ffffff', a: 'center', lh: 1, min: 18 }),
    text('Einheit', 716, 780, 248, 50, '{{Einheit}}', { f: 'Montserrat', s: 18, w: 600, c: '#ffffff', a: 'center', min: 9, showIf: 'Einheit' }),
  ])],
};

// ------------------------------------------------------------------ Preisplakat: riesiger Preis auf Rot
const RED = '#d6182c';
const preis = {
  slug: 'instagram-angebot-preisplakat', name: 'Instagram-Beitrag – Angebot Preisplakat', variant: 'Preisplakat',
  description: 'Lauter Angebots-Beitrag für Instagram (1080 × 1080 px): roter Grund, riesiger weißer Preis in Schlagzeilenschrift, Produkt und Zeitraum darunter. Alle Texte und der Preis sind Felder, ideal für eine Serie.',
  tags: ['Preisplakat', 'Rot', 'Schlagzeile', 'Anton', 'Laut', 'Discount', 'Aktion'],
  pages: [page(RED, [
    rect('Band oben', 0, 0, 1080, 130, '#111111', { locked: true }),
    text('Titel', 60, 0, 960, 130, '{{Titel}}', { f: 'Anton', s: 34, c: '#ffd23f', up: true, ls: 0.06, min: 18, showIf: 'Titel' }),
    text('Preis', 40, 190, 1000, 460, '{{Preis}}', { f: 'Anton', s: 260, c: '#ffffff', a: 'center', lh: 1, min: 80, shadow: shadow('#000000', 0.3, 0, 10, 12) }),
    text('Einheit', 60, 640, 960, 70, '{{Einheit}}', { f: 'Montserrat', s: 21, w: 700, c: '#ffffff', a: 'center', up: true, ls: 0.2, min: 12, showIf: 'Einheit' }),
    rect('Produktband', 0, 740, 1080, 190, '#ffffff', { locked: true }),
    text('Produkt', 60, 740, 960, 190, '{{Produkt}}', { f: 'Anton', s: 44, c: '#111111', a: 'center', up: true, v: 'middle', wrap: true, lh: 1.1, fit: 'shrink', min: 20 }),
    text('Zeitraum', 60, 960, 960, 80, '{{Zeitraum}}', { f: 'Montserrat', s: 22, w: 700, c: '#ffffff', a: 'center', min: 11, showIf: 'Zeitraum' }),
  ])],
};

// ------------------------------------------------------------------ Geteilt: Pastell links, runde Bildfläche rechts
const MINT = '#dff3ea';
const geteilt = {
  slug: 'instagram-angebot-geteilt', name: 'Instagram-Beitrag – Angebot geteilt', variant: 'Geteilt',
  description: 'Ruhiger Angebots-Beitrag für Instagram (1080 × 1080 px): Mintgrün mit rundem Bildrahmen für dein Foto, Überschrift, Produktname, Preis in einem Etikett und Zeitraum. Alle Texte und der Preis sind Felder.',
  tags: ['Geteilt', 'Mint', 'Rund', 'Foto', 'Café', 'Bäckerei', 'Dezent'],
  pages: [page(MINT, [
    ellipse('Kreis groß', 440, 90, 760, 760, '#bfe6d4', { locked: true }),
    ellipse('Foto Hintergrund', 480, 130, 680, 680, '#9fd4bd'),
    icon('Foto Symbol', 'image', 720, 370, 200, '#6fb79b', 1.2),
    frame('Foto', 480, 130, 680, 680, { mask: 'circle', border: { color: '#ffffff', width: 8 } }),
    text('Titel', 70, 140, 460, 50, '{{Titel}}', { f: 'Poppins', s: 14, w: 700, c: '#2f7a5e', up: true, ls: 0.16, min: 9, showIf: 'Titel' }),
    text('Produkt', 70, 200, 420, 360, '{{Produkt}}', { f: 'Poppins', s: 36, w: 700, c: '#123d2e', v: 'top', wrap: true, lh: 1.1, fit: 'shrink', min: 18 }),
    rect('Preis Etikett', 70, 640, 420, 130, '#e8553d', { radius: 26 }),
    text('Preis', 80, 640, 400, 130, '{{Preis}}', { f: 'Poppins', s: 52, w: 800, c: '#ffffff', a: 'center', v: 'middle', lh: 1, min: 22 }),
    text('Einheit', 70, 790, 420, 46, '{{Einheit}}', { f: 'Montserrat', s: 18, w: 600, c: '#2f7a5e', min: 9, showIf: 'Einheit' }),
    icon('Uhr', 'clock', 70, 934, 40, '#2f7a5e', 2.2),
    text('Zeitraum', 124, 928, 800, 52, '{{Zeitraum}}', { f: 'Montserrat', s: 20, w: 600, c: '#123d2e', min: 10, showIf: 'Zeitraum' }),
  ])],
};

module.exports = family(common, [karte, preis, geteilt]);
