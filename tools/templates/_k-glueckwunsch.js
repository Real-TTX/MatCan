'use strict';
const L = require('./_t2a-lib');
const { text, rect, ellipse, line, icon, shape, page, ctext, divider, dk, dekoIn, deko, tpl, gradient, shadow } = L;

const META = { family: 'glueckwunschkarte', familyName: 'Glückwunschkarte', occasion: 'Feste & Events' };

// ---------------------------------------------------------------------------------------------------------------------------- Gold
const GOLD = '#d4af5f';
const gold = tpl(Object.assign({}, META, {
  slug: 'glueckwunsch-gold',
  name: 'Glückwunschkarte DIN lang – Gold',
  description: 'Feierliche Glückwunschkarte im Format DIN lang quer für Prüfung, Jubiläum oder neuen Job: nachtblau mit goldener Rosette, Lorbeerzweigen und „Herzlichen Glückwunsch“ in Kursivschrift.',
  variant: 'Gold',
  tags: ['Glückwunsch', 'Gratulation', 'Gold', 'Lorbeer', 'bestanden', 'Jubiläum', 'Erfolg', 'Karte', 'DIN lang', 'feierlich'],
  formatKey: 'din-lang-landscape', width: 210, height: 99,
  pages: [
    page('#16213e', [
      dekoIn('Rahmen', 'deko-rahmen-doppellinie-quer-gold', 4, 4, 202, 91, { locked: true }),
      dk('Lorbeer links', 'deko-blumen-lorbeerzweig-gold', 40, 76, 36),
      dk('Lorbeer rechts', 'deko-blumen-lorbeerzweig-gold', 134, 76, 36, undefined, { flipX: true }),
      ctext('Erfolg', 105, 76, 56, 9, 'zum großen Erfolg', { f: 'Cormorant Garamond', s: 14, w: 500, i: true, c: '#ecd49a', min: 8 }),
      dk('Rosette', 'deko-baender-rosette-gold', 94, 10, 22),
      ctext('Herzlichen', 105, 38, 150, 14, 'Herzlichen', { f: 'Cormorant Garamond', s: 26, w: 500, i: true, c: '#ecd49a', min: 12 }),
      ctext('Glückwunsch', 105, 49, 190, 20, 'GLÜCKWUNSCH', { f: 'Cinzel', s: 34, w: 500, c: GOLD, ls: 0.14, min: 16 }),
    ], 'Vorderseite'),
    page('#fbf6ea', [
      dk('Schwung', 'deko-ornamente-schwung-gold', 80, 6, 50),
      text('Anrede', 40, 26, 130, 10, 'Liebe Anna,', { f: 'Cormorant Garamond', s: 19, w: 600, i: true, c: '#3a3226', min: 10 }),
      text('Text', 40, 38, 130, 34, 'zu diesem großen Erfolg gratulieren wir dir von Herzen. Du hast dir diesen Moment mit Fleiß und Ausdauer verdient – wir sind stolz auf dich!', { f: 'Cormorant Garamond', s: 14.5, w: 500, c: '#3a3226', v: 'top', wrap: true, lh: 1.4, min: 9 }),
      text('Gruß', 40, 78, 130, 9, 'Deine Familie', { f: 'Cormorant Garamond', s: 17, w: 600, i: true, c: '#a8822f', a: 'right', min: 10 }),
    ], 'Innenseite'),
  ],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Bunt
const bunt = tpl(Object.assign({}, META, {
  slug: 'glueckwunsch-bunt',
  name: 'Glückwunschkarte A6 quer – Bunt',
  description: 'Fröhliche Glückwunschkarte im Format A6 quer: Farbverlauf in Violett und Pink, Konfetti, Partyknaller und „Glückwunsch!“ in dicker runder Schrift – für Bestandenes, Neues und Gutes.',
  variant: 'Bunt',
  tags: ['Glückwunsch', 'Gratulation', 'bunt', 'Konfetti', 'Party', 'Erfolg', 'bestanden', 'Karte', 'fröhlich', 'Baby', 'Führerschein'],
  formatKey: 'a6-landscape', width: 148, height: 105,
  pages: [
    page(gradient(140, '#7b3fe4', '#e0489b'), [
      dk('Konfetti', 'deko-konfetti-streuung-bunt', 0, 0, 148, 148, { opacity: 0.55 }),
      icon('Knaller', 'party-popper', 10, 10, 24, '#ffd23f', 1.6, { rotation: -8 }),
      icon('Stern', 'sparkles', 108, 22, 22, '#ffffff', 1.6),
      ctext('Glück', 74, 26, 130, 28, 'Glück-', { f: 'Baloo 2', s: 54, w: 800, c: '#ffffff', lh: 1, min: 26, shadow: shadow('#4a1a8f', 0.45, 0, 0.9, 1.2) }),
      ctext('wunsch', 74, 50, 130, 28, 'wunsch!', { f: 'Baloo 2', s: 54, w: 800, c: '#ffd23f', lh: 1, min: 26, shadow: shadow('#4a1a8f', 0.45, 0, 0.9, 1.2) }),
      ctext('Unterzeile', 74, 82, 120, 8, 'Das habt ihr großartig gemacht', { f: 'Nunito', s: 10, w: 700, c: '#ffffff', up: true, ls: 0.14, min: 6 }),
    ], 'Vorderseite'),
    page('#ffffff', [
      rect('Band', 0, 0, 148, 8, '#e0489b', { locked: true }),
      rect('Band 2', 0, 8, 148, 2.5, '#7b3fe4', { locked: true }),
      text('Anrede', 18, 22, 112, 12, 'Liebe Anna,', { f: 'Baloo 2', s: 20, w: 700, c: '#7b3fe4', min: 11 }),
      text('Text', 18, 36, 112, 40, 'Wow, das ist ein toller Erfolg! Wir freuen uns riesig mit dir und feiern mit dir – bald gibt es Kuchen und Sekt.', { f: 'Nunito', s: 12, w: 500, c: '#2f2a4a', v: 'top', wrap: true, lh: 1.5, min: 8 }),
      text('Gruß', 18, 82, 112, 10, 'Dein Team', { f: 'Baloo 2', s: 16, w: 700, c: '#e0489b', a: 'right', min: 9 }),
      dk('Konfetti unten', 'deko-konfetti-regen', 0, 92, 148, undefined, { opacity: 0.9 }),
    ], 'Innenseite'),
  ],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Schlicht
const INK = '#1f2a2e';
const schlicht = tpl(Object.assign({}, META, {
  slug: 'glueckwunsch-schlicht',
  name: 'Glückwunschkarte A6 hoch – Schlicht',
  description: 'Ruhige Glückwunschkarte im Format A6 hoch: viel Weißraum, „Gratulation“ in feiner Schrift mit weitem Abstand, ein mintgrüner Block und dünne Linien. Innen Platz für einen persönlichen Text.',
  variant: 'Schlicht',
  tags: ['Glückwunsch', 'Gratulation', 'schlicht', 'minimal', 'modern', 'mint', 'ruhig', 'Karte', 'Typografie', 'Erfolg'],
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [
    page('#ffffff', [
      rect('Block', 0, 86, 105, 62, '#d6ece4', { locked: true }),
      line('Linie oben', 20, 28, 85, 28, INK, 0.3, { locked: true }),
      ctext('Gratulation', 52.5, 40, 96, 12, 'GRATULATION', { f: 'Josefin Sans', s: 22, w: 300, c: INK, ls: 0.28, min: 10 }),
      ctext('Zeile', 52.5, 56, 80, 7, 'zu deinem großen Erfolg', { f: 'Josefin Sans', s: 9.5, w: 400, c: INK, up: true, ls: 0.3, min: 6 }),
      icon('Stern', 'star', 48.5, 68, 8, '#2f8f78', 1.6),
      line('Linie unten', 20, 124, 85, 124, INK, 0.3, { locked: true }),
      ctext('Absender', 52.5, 128, 80, 7, 'von uns allen', { f: 'Josefin Sans', s: 8, w: 400, c: INK, ls: 0.2, min: 5 }),
    ], 'Vorderseite'),
    page('#ffffff', [
      line('Linie', 20, 24, 40, 24, '#2f8f78', 0.8, { locked: true }),
      text('Anrede', 20, 30, 70, 12, 'Liebe Anna,', { f: 'Josefin Sans', s: 14, w: 600, c: INK, min: 9 }),
      text('Text', 20, 46, 66, 70, 'wir gratulieren dir von Herzen zu diesem besonderen Moment. Du hast es dir verdient, genieße ihn in vollen Zügen.', { f: 'Josefin Sans', s: 10.5, w: 400, c: INK, v: 'top', wrap: true, lh: 1.7, min: 7 }),
      text('Gruß', 20, 122, 66, 8, 'Viele Grüße, dein Team', { f: 'Josefin Sans', s: 9, w: 600, c: '#2f8f78', min: 6 }),
    ], 'Innenseite'),
  ],
}));

module.exports = { gold, bunt, schlicht };
