'use strict';
const { text, rect, ellipse, shape, icon, frame, line, group, page, gradient, shadow } = require('./dsl');

const CREAM = '#f6efe3';
const CORAL = '#ff6b4a';
const GREEN = '#1f4d3a';

// Document unit px; a font size is in points (1 pt = 1.333 px). The top and bottom 250 px of a story are covered by the app, so the content stays between.
module.exports = {
  slug: 'instagram-story',
  name: 'Instagram-Story – Neu im Laden',
  category: 'Social Media',
  description: 'Hochformat-Story (1080 × 1920 px) für eine Neuheit: großer Bildrahmen für dein Foto, „NEU“-Aufkleber, Überschrift, Preis und Adresse. Ziehe ein Foto in den Rahmen und ändere die Texte.',
  unit: 'px',
  width: 1080,
  height: 1920,
  pages: [page(gradient(180, GREEN, '#123124'), [
    ellipse('Kreis oben', 690, -140, 540, 540, CREAM, { opacity: 0.07, locked: true }),
    ellipse('Kreis unten', -300, 1050, 720, 720, CREAM, { opacity: 0.06, locked: true }),
    text('Etikett', 112, 270, 420, 52, 'Neu im Laden', { f: 'Montserrat', s: 17, w: 800, c: '#ffffff', up: true, ls: 0.18, background: { color: CORAL, radius: 30, padding: 22 }, wrap: false, fit: 'none' }),
    text('Überschrift', 90, 345, 900, 240, 'Schau mal, was neu ist!', { f: 'Playfair Display', s: 76, w: 800, i: true, c: CREAM, v: 'top', wrap: true, lh: 1.1, fit: 'shrink', min: 30 }),
    rect('Foto Hintergrund', 90, 630, 900, 770, '#e9dcc3', { radius: 56 }),
    icon('Foto Symbol', 'image', 440, 915, 200, '#cdb98f', 1.2),
    frame('Foto', 90, 630, 900, 770, { mask: 'rounded', radius: 56, border: { color: CREAM, width: 4 } }),
    group('NEU-Aufkleber', [
      shape('star', 'Aufkleber', 740, 550, 270, 270, CORAL, { points: 14, inner: 0.86, shadow: shadow('#000000', 0.25, 14, 0, 8) }),
      text('Neu', 770, 605, 210, 120, 'NEU', { f: 'Bebas Neue', s: 78, c: '#ffffff', a: 'center', lh: 1, ls: 0.04, min: 30 }),
      text('ab sofort', 770, 720, 210, 44, 'ab sofort', { f: 'Kaushan Script', s: 19, c: '#ffffff', a: 'center', min: 10 }),
    ], { rotation: 12 }),
    text('Preis', 148, 1370, 420, 64, 'ab 4,90 €', { f: 'Montserrat', s: 22, w: 800, c: GREEN, background: { color: CREAM, radius: 36, padding: 26 }, wrap: false, fit: 'none', shadow: shadow('#000000', 0.22, 14, 0, 8) }),
    text('Produkt', 90, 1450, 900, 90, 'Dein neues Lieblingsprodukt', { f: 'Kaushan Script', s: 48, c: CREAM, min: 20 }),
    line('Trennlinie', 90, 1556, 990, 1556, CREAM, 1.2, { opacity: 0.4 }),
    icon('Ort Symbol', 'map-pin', 90, 1582, 44, CORAL, 2),
    text('Adresse', 152, 1576, 838, 84, 'Hofladen Wiesengrund · Dorfstraße 12\nMo bis Sa 8 bis 18 Uhr', { f: 'Montserrat', s: 17, w: 600, c: CREAM, v: 'top', wrap: true, lh: 1.4, min: 10 }),
  ])],
};
