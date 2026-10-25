'use strict';
const { text, ellipse, shape, icon, line, group, page, gradient, shadow } = require('./dsl');

const SUN = '#ffe14d';
const INK = '#1a1033';

// Document unit px: a font size is in points, 1 pt = 1.333 px (a text of 30 pt is 40 px high).
module.exports = {
  slug: 'instagram-sale',
  name: 'Instagram-Beitrag – SALE −30 %',
  category: 'Social Media',
  description: 'Quadratischer Beitrag für Instagram (1080 × 1080 px): große Schrift „SALE“, Preisaufkleber mit Rabatt, Farbverlauf und Fußzeile. Passe Rabatt und Zeitraum an und lade das Bild als PNG herunter.',
  unit: 'px',
  width: 1080,
  height: 1080,
  pages: [page(gradient(145, '#ff2d6f', '#ff8f3a'), [
    ellipse('Kreis oben links', -200, -220, 640, 640, '#ffffff', { opacity: 0.1, locked: true }),
    ellipse('Kreis unten rechts', 640, 620, 640, 640, '#ffffff', { opacity: 0.08, locked: true }),
    text('Zeitraum', 102, 84, 440, 64, 'Nur diese Woche', { f: 'Montserrat', s: 18, w: 800, c: INK, a: 'left', up: true, ls: 0.1, background: { color: '#ffffff', radius: 32, padding: 22 }, wrap: false, fit: 'none' }),
    text('SALE', 70, 150, 940, 540, 'SALE', { f: 'Bebas Neue', s: 405, c: '#ffffff', lh: 1, ls: 0.01, min: 150, shadow: shadow('#7a0f3a', 0.28, 0, 10, 12) }),
    group('Rabattaufkleber', [
      shape('star', 'Aufkleber', 690, 590, 340, 340, SUN, { points: 16, inner: 0.88, shadow: shadow('#7a0f3a', 0.3, 18, 0, 10) }),
      text('Bis zu', 730, 662, 260, 34, 'Bis zu', { f: 'Montserrat', s: 15, w: 700, c: INK, a: 'center', up: true, ls: 0.12, min: 10 }),
      text('Rabatt', 715, 692, 290, 110, '−30 %', { f: 'Bebas Neue', s: 80, c: INK, a: 'center', lh: 1, min: 40 }),
      text('auf alles', 730, 800, 260, 40, 'auf alles', { f: 'Kaushan Script', s: 20, c: INK, a: 'center', min: 12 }),
    ], { rotation: -9 }),
    text('Hinweis', 80, 790, 560, 110, 'Im ganzen Laden und im Online-Shop', { f: 'Montserrat', s: 24, w: 700, c: '#ffffff', v: 'top', wrap: true, lh: 1.3, min: 12 }),
    line('Trennlinie', 80, 944, 1000, 944, '#ffffff', 1.5, { opacity: 0.55 }),
    icon('Pfeil', 'arrow-right', 80, 975, 44, '#ffffff', 2.4),
    text('Adresse', 140, 969, 520, 52, 'www.wiesengrund.example', { f: 'Montserrat', s: 16, w: 700, c: '#ffffff', min: 10 }),
    text('Bis', 660, 969, 340, 52, 'bis Samstag, 8.11.', { f: 'Montserrat', s: 14, w: 500, c: '#ffffff', a: 'right', min: 9 }),
  ])],
};
