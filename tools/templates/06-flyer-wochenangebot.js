'use strict';
const { text, rect, ellipse, shape, icon, frame, group, field, page, gradient, shadow } = require('./dsl');

const CREAM = '#fff8ec';
const GREEN = '#1f7a4d';
const FOREST = '#14452f';
const SUN = '#ffc93c';
const INK = '#1b2a22';
const GREY = '#5e6b63';

/** One offer: a white card with a photo frame, name, text and a price sticker (a group, so it moves as one piece). */
function offer(n, y, title, description, price) {
  const x = 12;
  return group('Angebot ' + n, [
    rect(`Karte ${n}`, x, y, 124, 33, '#ffffff', { radius: 4, shadow: shadow('#14452f', 0.2, 4, 0, 1.4) }),
    rect(`Foto ${n} Hintergrund`, x + 4, y + 4, 25, 25, '#fdeab0', { radius: 3 }),
    icon(`Foto ${n} Symbol`, 'image', x + 11, y + 11, 11, '#e6bb4a', 1.5),
    frame(`Foto ${n}`, x + 4, y + 4, 25, 25, { mask: 'rounded', radius: 3 }),
    text(`Titel ${n}`, x + 34, y + 5, 50, 8, title, { f: 'Playfair Display', s: 15, w: 700, c: FOREST, min: 9 }),
    text(`Text ${n}`, x + 34, y + 14, 50, 14, description, { f: 'Montserrat', s: 8, c: GREY, v: 'top', wrap: true, lh: 1.4, fit: 'shrink', min: 6 }),
    shape('star', `Aufkleber ${n}`, x + 88, y + 3.5, 28, 28, SUN, { points: 12, inner: 0.84, rotation: -8 }),
    text(`Preis ${n}`, x + 91, y + 11.5, 21, 10, price + ' €', { f: 'Oswald', s: 22, w: 700, c: FOREST, a: 'center', lh: 1, min: 12, rotation: -8 }),
  ]);
}

const info = (x, iconName, label, value) => [
  icon(label + ' Symbol', iconName, x, 196.2, 6, SUN, 1.8),
  text(label, x + 8.5, 195.2, 34, 3.4, label, { f: 'Montserrat', s: 6, w: 700, c: SUN, up: true, ls: 0.16, v: 'top' }),
  text(label + ' Wert', x + 8.5, 199, 34, 8, value, { f: 'Montserrat', s: 7.5, w: 500, c: '#ffffff', v: 'top', wrap: true, lh: 1.3, min: 5.5 }),
];

module.exports = {
  slug: 'flyer-wochenangebot',
  name: 'Flyer A5 – Wochenangebot',
  category: 'Flyer',
  description: 'Flyer im Format A5 für die Angebote der Woche: Überschrift, drei Angebotskarten mit Bildrahmen und Preisaufkleber, Fußzeile mit Adresse, Öffnungszeiten und Telefon.',
  width: 148,
  height: 210,
  pages: [page(CREAM, [
    rect('Kopfbereich', 0, 0, 148, 66, gradient(160, GREEN, FOREST), { locked: true }),
    ellipse('Kreis oben rechts', 96, -34, 82, 82, SUN, { opacity: 0.2, locked: true }),
    ellipse('Kurve', -16, 60, 180, 30, CREAM, { locked: true }),
    text('Etikett', 12, 11.5, 60, 6, 'Wochenangebot', { f: 'Montserrat', s: 8, w: 700, c: FOREST, up: true, ls: 0.2, background: { color: SUN, radius: 3, padding: 2 }, wrap: false, fit: 'none' }),
    text('Überschrift', 12, 22, 118, 28, 'Frisch auf den Tisch', { f: 'Playfair Display', s: 37, w: 700, c: '#ffffff', v: 'top', wrap: true, lh: 1.02, fit: 'shrink', min: 20 }),
    text('Gültigkeit', 12, 51.5, 118, 5, 'Gültig von Montag, 3. bis Samstag, 8. November', { f: 'Montserrat', s: 9, w: 500, c: '#d4efe0', min: 6 }),
    offer(1, 69, 'Frische Erdbeeren', 'Süß und aromatisch, 500 g Schale, aus Anbau der Region.', '2,99'),
    offer(2, 107.5, 'Bauernbrot', 'Im Steinofen gebacken, kräftige Kruste, 750 g Laib.', '3,50'),
    offer(3, 146, 'Ziegenfrischkäse', 'Cremig und mild, 150 g, vom Hof nebenan.', '2,29'),
    text('Hinweis', 12, 181, 124, 4, 'Solange der Vorrat reicht.', { f: 'Montserrat', s: 7, i: true, c: GREY, a: 'center' }),
    rect('Fußzeile', 0, 188, 148, 22, FOREST, { locked: true }),
    ...info(12, 'map-pin', 'Adresse', 'Dorfstraße 12\n12345 Musterstadt'),
    ...info(55, 'clock', 'Geöffnet', 'Mo bis Sa 8 bis 18 Uhr\nSo geschlossen'),
    ...info(98, 'phone', 'Telefon', '+49 123 456 789\nwiesengrund.example'),
  ])],
};
