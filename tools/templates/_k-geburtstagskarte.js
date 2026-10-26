'use strict';
const L = require('./_t2a-lib');
const { text, rect, ellipse, line, icon, shape, page, foldCard, panels, ctext, diamond, divider, dk, dekoIn, deko, tpl, shadow } = L;

const META = {
  family: 'geburtstagskarte', familyName: 'Geburtstagskarte', occasion: 'Geburtstag',
  formatKey: 'card-a6-portrait', fold: 'vertical', width: 210, height: 148,
};
const [BL, FR] = panels(210, 148, 'vertical', 4);   // back (left) and front (right) panel of the outside page

// ---------------------------------------------------------------------------------------------------------------------------- Konfetti
const INK = '#2f2a4a';
const konfetti = tpl(Object.assign({}, META, {
  slug: 'geburtstagskarte-konfetti',
  name: 'Geburtstagskarte Klappkarte – Konfetti',
  description: 'Bunte Klappkarte A6 hoch: vorne Torte, Konfetti und „Alles Gute“ in Schreibschrift, innen links Luftballons und rechts Platz für deinen Text, hinten ein kleiner Gruß.',
  variant: 'Konfetti',
  tags: ['Geburtstag', 'Glückwunsch', 'Klappkarte', 'Konfetti', 'Torte', 'bunt', 'Alles Gute', 'Karte', 'Kinder'],
  pages: foldCard('vertical', [
    // back
    dk('Konfetti hinten', 'deko-konfetti-streuung-pastell', 6, 70, 93, 93, { opacity: 0.8 }),
    ctext('Gruß hinten', BL.cx, 34, 80, 14, 'Mit Liebe für dich gemacht', { f: 'Dancing Script', s: 15, w: 600, c: INK, min: 9 }),
    icon('Herz hinten', 'heart', BL.cx - 3, 52, 6, '#ff5d73', 2),
    // front
    dk('Konfetti vorn', 'deko-konfetti-streuung-bunt', 106, 2, 103, 103, { opacity: 0.9 }),
    rect('Tafel', 116, 14, 82, 120, '#fff6e5', { radius: 8, locked: true }),
    dk('Torte', 'deko-konfetti-torte-bunt', 137, 24, 40),
    ctext('Alles Gute', FR.cx, 72, 80, 22, 'Alles Gute', { f: 'Dancing Script', s: 44, w: 700, c: '#ff5d73', min: 22 }),
    ctext('zum Geburtstag', FR.cx, 100, 80, 10, 'zum Geburtstag', { f: 'Fredoka', s: 15, w: 600, c: INK, up: true, ls: 0.18, min: 9 }),
  ], [
    // inside: left a bunch of balloons, right the message
    dk('Ballons', 'deko-konfetti-ballons-drei-bunt', 28, 18, 46),
    dk('Konfetti innen', 'deko-konfetti-regen', 4, 112, 97, undefined, { opacity: 0.9 }),
    text('Anrede', 120, 22, 76, 14, 'Liebe Anna,', { f: 'Dancing Script', s: 26, w: 700, c: '#ff5d73', min: 14 }),
    text('Text', 120, 40, 76, 62, 'heute wirst du ein Jahr älter, und wir feiern, dass es dich gibt! Ich wünsche dir einen Tag voller Lachen, Kuchen und Überraschungen.', { f: 'Nunito', s: 11.5, w: 500, c: INK, v: 'top', wrap: true, lh: 1.45, min: 8 }),
    text('Gruß', 120, 108, 76, 10, 'Alles Liebe, dein Max', { f: 'Dancing Script', s: 19, w: 700, c: INK, a: 'right', min: 11 }),
  ], '#fff6e5'),
}));

// ---------------------------------------------------------------------------------------------------------------------------- Klassisch
const GOLD = '#b08d3e';
const T = '#3a3226';
const klassisch = tpl(Object.assign({}, META, {
  slug: 'geburtstagskarte-klassisch',
  name: 'Geburtstagskarte Klappkarte – Klassisch',
  description: 'Festliche Klappkarte A6 hoch in Elfenbein und Gold: Doppelrahmen mit Schnörkeln, „Zum Geburtstag“ in Antiqua-Kapitälchen, innen Schwung und Raum für persönliche Worte.',
  variant: 'Klassisch',
  tags: ['Geburtstag', 'Glückwunsch', 'Klappkarte', 'klassisch', 'Gold', 'elegant', 'festlich', 'Karte', 'Elfenbein'],
  pages: foldCard('vertical', [
    // back
    dk('Siegel', 'deko-baender-siegel-zacken-gold', BL.cx - 9, 112, 18),
    // front
    dekoIn('Rahmen', 'deko-rahmen-schnoerkel-hoch-gold', 109, 5, 97, 138, { locked: true }),
    dk('Funkeln', 'deko-sterne-funkeln-gold', FR.cx - 7, 30, 14),
    ctext('Zum', FR.cx, 49, 70, 9, 'Zum', { f: 'Cormorant Garamond', s: 20, w: 500, i: true, c: T, min: 10 }),
    ctext('Geburtstag', FR.cx, 60, 80, 14, 'GEBURTSTAG', { f: 'Cinzel', s: 21, w: 500, c: GOLD, ls: 0.12, min: 12 }),
    divider('Trenner', FR.cx, 80, 40, GOLD),
    ctext('Wunsch', FR.cx, 86, 76, 24, 'Alles Liebe\nund Gute', { f: 'Cormorant Garamond', s: 17, w: 500, i: true, c: T, wrap: true, lh: 1.3, min: 10 }),
  ], [
    dk('Ecke links', 'deko-ecken-schnoerkel-gold', 8, 8, 30),
    dk('Ecke rechts', 'deko-ecken-schnoerkel-gold', 172, 110, 30, undefined, { flipX: true, flipY: true }),
    ctext('Titel innen', 52.5, 60.5, 80, 17, 'Herzlichen\nGlückwunsch', { f: 'Cormorant Garamond', s: 20, w: 500, i: true, c: GOLD, wrap: true, lh: 1.2, min: 11 }),
    line('Mittelstrich', 105, 20, 105, 128, '#e6dcc4', 0.25, { locked: true }),
    text('Anrede', 120, 24, 76, 10, 'Liebe Anna,', { f: 'Cormorant Garamond', s: 19, w: 600, i: true, c: T, min: 11 }),
    text('Text', 120, 38, 76, 62, 'zu deinem Ehrentag wünsche ich dir Gesundheit, Zufriedenheit und viele unvergessliche Momente mit den Menschen, die dir am Herzen liegen.', { f: 'Cormorant Garamond', s: 13.5, w: 500, c: T, v: 'top', wrap: true, lh: 1.4, min: 9 }),
    text('Gruß', 120, 108, 76, 9, 'In Zuneigung, Max', { f: 'Cormorant Garamond', s: 16, w: 600, i: true, c: GOLD, a: 'right', min: 10 }),
  ], '#fbf7ee'),
}));

// ---------------------------------------------------------------------------------------------------------------------------- Modern
const modern = tpl(Object.assign({}, META, {
  slug: 'geburtstagskarte-modern',
  name: 'Geburtstagskarte Klappkarte – Modern',
  description: 'Grafische Klappkarte A6 hoch: knallgelbe Vorderseite mit riesiger Schlagzeile „Alles Gute“, nachtblauer Rückseite, innen klare Linien und viel Weißraum für deine Grüße.',
  variant: 'Modern',
  tags: ['Geburtstag', 'Glückwunsch', 'Klappkarte', 'modern', 'gelb', 'Typografie', 'minimal', 'Karte', 'Alles Gute'],
  pages: foldCard('vertical', [
    // back: navy
    rect('Rückseite', 0, 0, 105, 148, '#1b2144', { locked: true }),
    shape('star', 'Stern hinten', BL.cx - 6, 64, 12, 12, '#ffd23f', { points: 4, inner: 0.3, locked: true }),
    ctext('Gruß hinten', BL.cx, 80, 80, 6, 'Zum Feiern gemacht.', { f: 'Montserrat', s: 7.5, w: 600, c: '#ffffff', up: true, ls: 0.2, min: 5 }),
    // front: yellow
    rect('Vorderseite', 105, 0, 105, 148, '#ffd23f', { locked: true }),
    ellipse('Sonne', 148, -34, 100, 100, '#ff6b4a', { locked: true }),
    text('ALLES', 111, 56, 96, 36, 'ALLES', { f: 'Anton', s: 78, c: '#1b2144', lh: 1, min: 40 }),
    text('GUTE', 111, 90, 96, 36, 'GUTE', { f: 'Anton', s: 78, c: '#1b2144', lh: 1, min: 40 }),
    text('Anlass', 112, 128, 90, 7, 'zum Geburtstag', { f: 'Montserrat', s: 9, w: 700, c: '#1b2144', up: true, ls: 0.24, min: 6 }),
  ], [
    rect('Band', 0, 0, 210, 12, '#ffd23f', { locked: true }),
    ellipse('Punkt', 20, 100, 22, 22, '#ff6b4a', { locked: true }),
    text('Anrede', 120, 24, 76, 14, 'Liebe Anna,', { f: 'Poppins', s: 21, w: 700, c: '#1b2144', min: 12 }),
    text('Text', 120, 42, 76, 58, 'heute gehört der Tag dir. Danke, dass es dich gibt – bleib genau so, wie du bist, und lass dich ordentlich feiern.', { f: 'Poppins', s: 10.5, w: 400, c: '#1b2144', v: 'top', wrap: true, lh: 1.5, min: 8 }),
    line('Trennlinie', 120, 108, 196, 108, '#1b2144', 0.4, { locked: true }),
    text('Gruß', 120, 111, 76, 9, 'Dein Max', { f: 'Poppins', s: 12, w: 600, c: '#ff6b4a', min: 8 }),
    text('Große Zahl', 14, 18, 80, 60, 'Hoch\nsoll er\nleben!', { f: 'Anton', s: 40, c: '#1b2144', v: 'top', wrap: true, lh: 1.05, min: 20 }),
  ], '#ffffff'),
}));

module.exports = { konfetti, klassisch, modern };
