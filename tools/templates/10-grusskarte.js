'use strict';
const { text, rect, ellipse, shape, icon, line, group, page, gradient, shadow } = require('./dsl');

const CREAM = '#fff7ea';
const TEAL = '#12a594';
const CORAL = '#ff6b5e';
const SUN = '#ffc947';
const INK = '#2a2440';

/** A little piece of confetti */
const dot = (n, x, y, d, color, o) => ellipse('Konfetti ' + n, x, y, d, d, color, o);

module.exports = {
  slug: 'grusskarte',
  name: 'Grußkarte A6 quer (2 Seiten)',
  category: 'Karten',
  description: 'Klappkarte im Format A6 quer mit zwei Seiten: vorne „Alles Gute“ mit Konfetti und Symbolen, innen Platz für deinen persönlichen Text. Zum Verschenken oder als Kundenkarte.',
  width: 148,
  height: 105,
  pages: [
    page(gradient(150, TEAL, '#0e7f8f'), [
      ellipse('Kreis groß', 84, -40, 100, 100, '#ffffff', { opacity: 0.1, locked: true }),
      ellipse('Kreis unten', -30, 62, 80, 80, '#ffffff', { opacity: 0.08, locked: true }),
      dot(1, 18, 16, 5, SUN), dot(2, 36, 30, 3, CORAL), dot(3, 124, 14, 4, SUN), dot(4, 132, 36, 6, CORAL),
      dot(5, 116, 84, 5, SUN), dot(6, 20, 78, 4, CORAL), dot(7, 100, 22, 3, '#ffffff', { opacity: 0.8 }), dot(8, 44, 90, 3, '#ffffff', { opacity: 0.8 }),
      shape('star', 'Stern 1', 108, 56, 12, 12, SUN, { points: 5, inner: 0.45, rotation: 15 }),
      shape('star', 'Stern 2', 14, 46, 9, 9, '#ffffff', { points: 5, inner: 0.45, rotation: -12, opacity: 0.9 }),
      shape('triangle', 'Wimpel', 126, 60, 8, 8, CORAL, { rotation: 25 }),
      shape('triangle', 'Wimpel 2', 30, 12, 7, 7, SUN, { rotation: -20 }),
      icon('Geschenk', 'gift', 108, 70, 20, CREAM, 1.5, { rotation: 8 }),
      icon('Torte', 'cake', 19, 52, 20, CREAM, 1.5, { rotation: -8 }),
      text('Alles', 20, 20, 108, 36, 'Alles', { f: 'Pacifico', s: 44, c: CREAM, a: 'center', min: 24, shadow: shadow('#0a5a63', 0.35, 0, 0.8, 1) }),
      text('Gute', 20, 46, 108, 30, 'Gute!', { f: 'Pacifico', s: 52, c: SUN, a: 'center', min: 24, shadow: shadow('#0a5a63', 0.35, 0, 0.8, 1), rotation: -3 }),
      text('Zeile', 20, 80, 108, 8, 'von ganzem Herzen', { f: 'Montserrat', s: 9, w: 600, c: CREAM, a: 'center', up: true, ls: 0.28, min: 6 }),
    ], 'Vorderseite'),
    page(CREAM, [
      ellipse('Kreis', 112, 66, 60, 60, SUN, { opacity: 0.22, locked: true }),
      ellipse('Kreis 2', -20, -22, 50, 50, CORAL, { opacity: 0.14, locked: true }),
      rect('Seitenband', 0, 0, 148, 5, TEAL, { locked: true }),
      icon('Herz', 'heart', 20, 16, 11, CORAL, 2),
      text('Anrede', 20, 30, 108, 11, 'Liebe Anna,', { f: 'Caveat', s: 30, w: 700, c: INK, min: 14 }),
      text('Text', 20, 43, 108, 34, 'zu deinem Geburtstag wünsche ich dir Sonne im Herzen, viel Zeit für das, was dir Freude macht, und ein Jahr voller schöner Überraschungen.', { f: 'Caveat', s: 21, w: 500, c: INK, v: 'top', wrap: true, lh: 1.25, fit: 'shrink', min: 12 }),
      text('Gruß', 20, 80, 108, 10, 'Alles Liebe, dein Max', { f: 'Caveat', s: 24, w: 700, c: TEAL, a: 'right', min: 12 }),
      line('Linie', 20, 93, 128, 93, '#e6d9c2', 0.6, { dash: 'dotted' }),
      text('Absender', 20, 94.5, 108, 5, 'Hofladen Wiesengrund · Dorfstraße 12 · 12345 Musterstadt', { f: 'Montserrat', s: 6.5, w: 500, c: '#8a8095', a: 'center', min: 5 }),
    ], 'Innenseite'),
  ],
};
