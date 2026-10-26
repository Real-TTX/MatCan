'use strict';
const L = require('./_t2a-lib');
const { text, rect, ellipse, line, icon, shape, page, shadow, ctext, diamond, divider, dk, dekoIn, deko, tpl, gradient } = L;

const META = {
  family: 'grusskarte-alles-gute', familyName: 'Grußkarte „Alles Gute“', occasion: 'Geburtstag',
  formatKey: 'a6-landscape', width: 148, height: 105,
};

// ---------------------------------------------------------------------------------------------------------------------------- Ballons
const INK = '#2b2a4c';
const ballons = tpl(Object.assign({}, META, {
  slug: 'grusskarte-ballons',
  name: 'Grußkarte A6 quer – Ballons',
  description: 'Fröhliche Geburtstagskarte im Format A6 quer: bunte Luftballons, große runde Schrift „Alles Gute!“ und innen Platz für deinen Text unter einer Wimpelkette.',
  variant: 'Ballons',
  tags: ['Grußkarte', 'Geburtstag', 'Alles Gute', 'Ballons', 'Kinder', 'Glückwunsch', 'bunt', 'Karte'],
  pages: [
    page('#fff4e4', [
      dk('Ballons', 'deko-konfetti-ballons-fuenf-bunt', 6, 8, 66, 90),
      ellipse('Kreis Gelb', 108, -22, 62, 62, '#ffd447', { opacity: 0.35, locked: true }),
      ellipse('Kreis Türkis', 96, 78, 46, 46, '#2ec4b6', { opacity: 0.2, locked: true }),
      text('Anlass', 74, 15, 68, 6, 'zum Geburtstag', { f: 'Montserrat', s: 8, w: 700, c: '#e8505b', up: true, ls: 0.22, min: 6 }),
      text('Alles', 74, 23, 70, 22, 'Alles', { f: 'Baloo 2', s: 46, w: 800, c: INK, lh: 1, min: 24 }),
      text('Gute', 74, 41, 70, 24, 'Gute!', { f: 'Baloo 2', s: 54, w: 800, c: '#e8505b', lh: 1, min: 24, rotation: -3 }),
      text('Wunsch', 74, 70, 62, 14, 'und ein Jahr voller Überraschungen', { f: 'Nunito', s: 10, w: 600, c: INK, v: 'top', wrap: true, lh: 1.3, min: 7 }),
    ], 'Vorderseite'),
    page('#fffaf2', [
      dk('Wimpelkette', 'deko-konfetti-wimpelkette-bunt', 24, 1, 100),
      text('Anrede', 20, 33, 108, 12, 'Liebe Anna,', { f: 'Patrick Hand', s: 24, c: INK, min: 12 }),
      text('Text', 20, 46, 108, 30, 'heute ist dein Tag! Ich wünsche dir einen bunten Geburtstag mit Kuchen, Kerzen und ganz viel Lachen.', { f: 'Patrick Hand', s: 17, c: INK, v: 'top', wrap: true, lh: 1.3, min: 10 }),
      text('Gruß', 20, 80, 108, 10, 'Dein Max', { f: 'Patrick Hand', s: 21, c: '#e8505b', a: 'right', min: 12 }),
      dk('Ballon', 'deko-konfetti-ballon-bunt', 4, 60, 11),
      ellipse('Konfetti 1', 130, 26, 3, 3, '#2ec4b6', { locked: true }),
      ellipse('Konfetti 2', 138, 36, 2.2, 2.2, '#ffd447', { locked: true }),
      ellipse('Konfetti 3', 134, 92, 3, 3, '#e8505b', { locked: true }),
    ], 'Innenseite'),
  ],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Elegant
const GOLD = '#cfa94f';
const elegant = tpl(Object.assign({}, META, {
  slug: 'grusskarte-elegant',
  name: 'Grußkarte A6 quer – Elegant',
  description: 'Festliche Geburtstagskarte im Format A6 quer: nachtblau mit goldenem Rahmen und Kursivschrift, innen cremefarben mit goldenem Schwung für deinen persönlichen Text.',
  variant: 'Elegant',
  tags: ['Grußkarte', 'Geburtstag', 'Alles Gute', 'elegant', 'Gold', 'Nachtblau', 'festlich', 'Glückwunsch', 'Karte'],
  pages: [
    page('#16213e', [
      dekoIn('Rahmen', 'deko-rahmen-doppellinie-quer-gold', 4, 4, 140, 97, { locked: true }),
      dk('Funkeln', 'deko-sterne-funkeln-gold', 66, 15, 16),
      text('Alles Gute', 14, 33, 120, 24, 'Alles Gute', { f: 'Cormorant Garamond', s: 52, w: 500, i: true, c: '#ecd49a', a: 'center', min: 24 }),
      divider('Trenner', 74, 62, 46, GOLD, { gap: 5 }),
      text('Anlass', 14, 67, 120, 7, 'zum Geburtstag', { f: 'Cinzel', s: 10, w: 500, c: GOLD, a: 'center', ls: 0.3, min: 7 }),
    ], 'Vorderseite'),
    page('#fbf6ea', [
      dk('Schwung', 'deko-ornamente-schwung-gold', 49, 6, 50),
      text('Anrede', 24, 28, 100, 10, 'Liebe Anna,', { f: 'Cormorant Garamond', s: 20, w: 600, i: true, c: '#3a3226', min: 11 }),
      text('Text', 24, 40, 100, 34, 'zu deinem Geburtstag wünsche ich dir von Herzen Gesundheit, Glück und viele schöne Stunden im Kreis der Menschen, die du liebst.', { f: 'Cormorant Garamond', s: 15, w: 500, c: '#3a3226', v: 'top', wrap: true, lh: 1.35, min: 9 }),
      text('Gruß', 24, 79, 100, 9, 'In Zuneigung, Max', { f: 'Cormorant Garamond', s: 17, w: 600, i: true, c: '#a8822f', a: 'right', min: 10 }),
      line('Linie', 24, 92, 124, 92, GOLD, 0.25, { locked: true }),
    ], 'Innenseite'),
  ],
}));

module.exports = { ballons, elegant };
