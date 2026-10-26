'use strict';
const { text, rect, ellipse, line, icon, frame, deko, field, page, gradient, shadow } = require('./dsl');
const { family } = require('./_t3b-lib');

const fields = [
  field('Preis', 'Preis', 'text', 'Ein Korb voller Hofladen-Spezialitäten', { required: true }),
  field('Konto', 'Dein Konto', 'text', '@hofladen.wiesengrund'),
  field('Frist', 'Teilnahmeschluss', 'text', 'Teilnahme bis 30. Juni 2027'),
];
const sampleRows = [
  { Preis: 'Ein Korb voller Hofladen-Spezialitäten', Konto: '@hofladen.wiesengrund', Frist: 'Teilnahme bis 30. Juni 2027' },
  { Preis: 'Drei Gutscheine für ein Wochenende mit Übernachtung, Frühstück und Wellness für zwei Personen', Konto: '@gasthof.zum.wiesengrund.musterstadt', Frist: 'Teilnahmeschluss: Sonntag, 31. Oktober 2027, 23:59 Uhr' },
  { Preis: 'Ein Buch', Konto: '@lesezeit', Frist: '' },
];

const common = {
  no: 458, category: 'Social Media', family: 'instagram-gewinnspiel', familyName: 'Instagram-Beitrag Gewinnspiel', occasion: 'Social Media',
  tags: ['Instagram', 'Beitrag', 'Gewinnspiel', 'Verlosung', 'Giveaway', 'Gewinn', 'Social Media', 'Facebook', 'Teilnahme'],
  formatKey: 'instagram-post', unit: 'px', width: 1080, height: 1080, fields, sampleRows,
};

// Document unit px: 1 pt = 1.333 px.
const steps = (x, y, gap, color, textColor, size) => [
  [icon('Schritt 1 Symbol', 'user-plus', x, y, size, color, 2.2), text('Schritt 1', x + size + 24, y - 4, 700, size + 8, 'Folge {{Konto}}', { f: 'Montserrat', s: 24, w: 700, c: textColor, min: 12 })],
  [icon('Schritt 2 Symbol', 'heart', x, y + gap, size, color, 2.2), text('Schritt 2', x + size + 24, y + gap - 4, 700, size + 8, 'Like diesen Beitrag', { f: 'Montserrat', s: 24, w: 700, c: textColor, min: 12 })],
  [icon('Schritt 3 Symbol', 'message-circle', x, y + 2 * gap, size, color, 2.2), text('Schritt 3', x + size + 24, y + 2 * gap - 4, 700, size + 8, 'Kommentiere und markiere einen Freund', { f: 'Montserrat', s: 24, w: 700, c: textColor, min: 12 })],
];

// ------------------------------------------------------------------ Konfetti: Konfettigrund, weiße Karte
const konfetti = {
  slug: 'instagram-gewinnspiel-konfetti', name: 'Instagram-Beitrag – Gewinnspiel Konfetti', variant: 'Konfetti',
  description: 'Buntes Gewinnspiel für Instagram (1080 × 1080 px): Konfettiregen, weiße Karte mit „Gewinnspiel“, dem Preis, drei Teilnahmeschritten mit Symbolen und dem Teilnahmeschluss. Preis, Konto und Frist sind Felder.',
  tags: ['Konfetti', 'Bunt', 'Party', 'Giveaway', 'Verlosung', 'Fröhlich', 'Geburtstagsaktion'],
  pages: [page('#7b3fe4', [
    deko('Konfetti', 'deko-konfetti-streuung-bunt', -60, -60, 1200, undefined, { locked: true }),
    rect('Karte', 90, 110, 900, 860, '#ffffff', { radius: 48, shadow: shadow('#2a0a60', 0.4, 36, 0, 20) }),
    text('Titel', 130, 150, 820, 150, 'GEWINNSPIEL', { f: 'Anton', s: 90, c: '#7b3fe4', a: 'center', lh: 1, min: 40 }),
    text('Wir verlosen', 130, 300, 820, 50, 'Wir verlosen', { f: 'Montserrat', s: 15, w: 700, c: '#777777', a: 'center', up: true, ls: 0.24, min: 10 }),
    text('Preis', 150, 350, 780, 190, '{{Preis}}', { f: 'Poppins', s: 32, w: 700, c: '#1a1033', a: 'center', v: 'middle', wrap: true, lh: 1.15, fit: 'shrink', min: 16 }),
    line('Linie', 190, 560, 890, 560, '#e6dcfb', 3, { locked: true }),
    ...steps(190, 598, 90, '#e8458b', '#1a1033', 52),
    text('Frist', 130, 870, 820, 60, '{{Frist}}', { f: 'Montserrat', s: 16, w: 700, c: '#ffffff', a: 'center', v: 'middle', background: { color: '#e8458b', radius: 30, padding: 20 }, wrap: false, fit: 'none', showIf: 'Frist' }),
  ])],
};

// ------------------------------------------------------------------ Geschenk dunkel: Pflaume mit Gold
const GOLD = '#e7c15a';
const geschenk = {
  slug: 'instagram-gewinnspiel-geschenk', name: 'Instagram-Beitrag – Gewinnspiel Geschenk', variant: 'Geschenk',
  description: 'Edles Gewinnspiel für Instagram (1080 × 1080 px): dunkles Pflaumenviolett, goldenes Geschenk, großes „Giveaway“, Preis, drei Schritte und Teilnahmeschluss. Preis, Konto und Frist sind Felder.',
  tags: ['Geschenk', 'Dunkel', 'Gold', 'Giveaway', 'Weihnachten', 'Verlosung', 'Edel'],
  pages: [page(gradient(160, '#2a0f3d', '#4a1b5e'), [
    deko('Geschenk', 'deko-konfetti-geschenk-gold', 620, 80, 380, undefined, { locked: true }),
    text('Titel', 70, 90, 560, 150, 'Giveaway', { f: 'Dancing Script', s: 96, w: 700, c: GOLD, lh: 1, min: 40 }),
    text('Wir verlosen', 70, 250, 540, 50, 'Wir verlosen', { f: 'Montserrat', s: 15, w: 700, c: '#cdb7dd', up: true, ls: 0.24, min: 10 }),
    text('Preis', 70, 310, 560, 280, '{{Preis}}', { f: 'Playfair Display', s: 34, w: 600, c: '#ffffff', v: 'top', wrap: true, lh: 1.2, fit: 'shrink', min: 17 }),
    line('Linie', 70, 640, 1010, 640, GOLD, 2, { opacity: 0.5, locked: true }),
    ...steps(70, 690, 84, GOLD, '#ffffff', 50),
    text('Frist', 70, 950, 940, 56, '{{Frist}}', { f: 'Montserrat', s: 16, w: 600, c: GOLD, min: 10, showIf: 'Frist' }),
  ])],
};

// ------------------------------------------------------------------ Schlicht: Weiß, nummerierte Kreise
const schlicht = {
  slug: 'instagram-gewinnspiel-schlicht', name: 'Instagram-Beitrag – Gewinnspiel schlicht', variant: 'Schlicht',
  description: 'Schlichtes Gewinnspiel für Instagram (1080 × 1080 px): weißer Grund, „Verlosung“ in Antiqua, Preis, drei nummerierte Schritte in Kreisen und ein Knopf mit dem Teilnahmeschluss. Preis, Konto und Frist sind Felder.',
  tags: ['Schlicht', 'Weiß', 'Minimal', 'Antiqua', 'Nummeriert', 'Boutique', 'Verlosung'],
  pages: [page('#fbfaf7', [
    text('Titel', 90, 90, 900, 150, 'Verlosung', { f: 'Playfair Display', s: 84, w: 700, c: '#161616', lh: 1, min: 40 }),
    rect('Akzent', 94, 250, 120, 6, '#d85c3a', { locked: true }),
    text('Preis', 90, 290, 900, 210, '{{Preis}}', { f: 'Montserrat', s: 28, w: 500, c: '#2d2d2d', v: 'top', wrap: true, lh: 1.3, fit: 'shrink', min: 15 }),
    ...[['1', 'Folge {{Konto}}', 560], ['2', 'Like diesen Beitrag', 660], ['3', 'Kommentiere und markiere einen Freund', 760]].map(([n, t, y], i) => [
      ellipse('Kreis ' + n, 90, y, 70, 70, '#161616'),
      text('Zahl ' + n, 90, y, 70, 70, n, { f: 'Playfair Display', s: 26, w: 700, c: '#ffffff', a: 'center', min: 12 }),
      text('Schritt ' + n, 190, y, 800, 70, t, { f: 'Montserrat', s: 24, w: 600, c: '#161616', min: 12 }),
    ]),
    text('Frist', 90, 900, 700, 76, '{{Frist}}', { f: 'Montserrat', s: 16, w: 700, c: '#ffffff', up: true, ls: 0.06, background: { color: '#d85c3a', radius: 38, padding: 28 }, wrap: false, fit: 'none', showIf: 'Frist' }),
  ])],
};

module.exports = family(common, [konfetti, geschenk, schlicht]);
