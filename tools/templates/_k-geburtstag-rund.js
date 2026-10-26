'use strict';
const L = require('./_t2a-lib');
const { text, rect, ellipse, line, icon, shape, page, ctext, divider, dk, dekoIn, tpl, field, shadow } = L;

const META = {
  family: 'geburtstag-rund', familyName: 'Runder Geburtstag (30, 40, 50, 60)', occasion: 'Geburtstag',
  formatKey: 'a6-portrait', width: 105, height: 148,
  fields: [field('Alter', 'Alter', 'text', '50'), field('Name', 'Name', 'text', 'Anna')],
  sampleRows: [{ Alter: '50', Name: 'Anna' }, { Alter: '30', Name: 'Maximiliane' }, { Alter: '60', Name: 'Jürgen' }, { Alter: '40', Name: 'Lu' }],
};

// ---------------------------------------------------------------------------------------------------------------------------- Große Zahl
const INK = '#2f2a4a';
const bunt = tpl(Object.assign({}, META, {
  slug: 'geburtstag-rund-grosse-zahl',
  name: 'Runder Geburtstag A6 – Große Zahl',
  description: 'Glückwunschkarte A6 hoch zum runden Geburtstag: riesige Zahl (Feld „Alter“) auf Konfettikranz, Name als Feld, innen Platz für deinen Text. Passt zu 30, 40, 50, 60 und mehr.',
  variant: 'Große Zahl',
  tags: ['Geburtstag', 'runder Geburtstag', '30', '40', '50', '60', 'Zahl', 'Konfetti', 'Glückwunsch', 'Karte', 'bunt'],
  pages: [
    page('#fff3df', [
      dk('Konfetti', 'deko-konfetti-streuung-bunt', 0, 6, 105, 105),
      ellipse('Scheibe', 9, 18, 87, 87, '#fff3df', { locked: true }),
      ctext('Zum', 52.5, 28, 80, 8, 'Alles Gute zum', { f: 'Fredoka', s: 13, w: 600, c: INK, up: true, ls: 0.12, min: 8 }),
      ctext('Zahl', 52.5, 36, 86, 58, '{{Alter}}', { f: 'Fredoka', s: 150, w: 700, c: '#ff5d73', lh: 1, min: 70, shadow: shadow('#2f2a4a', 0.18, 0, 1.2, 1.5) }),
      ctext('Geburtstag', 52.5, 92, 90, 14, 'Geburtstag!', { f: 'Dancing Script', s: 34, w: 700, c: '#13a89e', min: 18 }),
      ctext('Name', 52.5, 120, 86, 12, '{{Name}}', { f: 'Fredoka', s: 22, w: 600, c: INK, min: 11 }),
      line('Linie', 30, 134, 75, 134, '#ffb347', 0.8, { locked: true }),
    ], 'Vorderseite'),
    page('#ffffff', [
      dk('Ballons', 'deko-konfetti-ballons-drei-bunt', 70, 6, 26),
      dk('Wimpel', 'deko-konfetti-regen', 0, 128, 105, undefined, { opacity: 0.9 }),
      text('Anrede', 14, 44, 76, 12, 'Liebe {{Name}},', { f: 'Fredoka', s: 18, w: 600, c: '#ff5d73', min: 10 }),
      text('Text', 14, 58, 77, 50, 'ein ganzes Jahrzehnt mehr – und du wirst immer besser! Ich wünsche dir einen rauschenden Geburtstag, Gesundheit und viele Gründe zum Feiern.', { f: 'Nunito', s: 11, w: 500, c: INK, v: 'top', wrap: true, lh: 1.5, min: 8 }),
      text('Gruß', 14, 110, 77, 9, 'Alles Liebe, dein Max', { f: 'Dancing Script', s: 17, w: 700, c: INK, a: 'right', min: 10 }),
    ], 'Innenseite'),
  ],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Goldglanz
const GOLD = '#d8b25a';
const goldglanz = tpl(Object.assign({}, META, {
  slug: 'geburtstag-rund-goldglanz',
  name: 'Runder Geburtstag A6 – Goldglanz',
  description: 'Festliche Karte zum runden Geburtstag in Schwarz und Gold: Zahl in Antiqua (Feld „Alter“), Goldrahmen, Sternenfunkeln und Name in Schreibschrift. Innen dunkel mit goldener Schrift.',
  variant: 'Goldglanz',
  tags: ['Geburtstag', 'runder Geburtstag', 'Gold', 'schwarz', 'elegant', '50', '60', '40', 'festlich', 'Karte', 'Zahl'],
  pages: [
    page('#14130f', [
      dk('Himmel', 'deko-sterne-himmel-gold', 0, 30, 105, 105, { opacity: 0.22 }),
      dekoIn('Rahmen', 'deko-rahmen-doppellinie-hoch-gold', 4, 4, 97, 140, { locked: true }),
      ctext('Glückwunsch', 52.5, 20, 80, 8, 'Herzlichen Glückwunsch', { f: 'Cormorant Garamond', s: 17, w: 500, i: true, c: '#efe0b6', min: 9 }),
      ctext('Zahl', 52.5, 32, 86, 62, '{{Alter}}', { f: 'Abril Fatface', s: 140, c: GOLD, lh: 1, min: 70 }),
      divider('Trenner', 52.5, 99, 46, GOLD),
      ctext('zum Geburtstag', 52.5, 104, 80, 8, 'zum Geburtstag', { f: 'Cinzel', s: 11, w: 500, c: GOLD, ls: 0.25, min: 7 }),
      ctext('Name', 52.5, 116, 80, 14, '{{Name}}', { f: 'Great Vibes', s: 28, c: '#efe0b6', min: 14 }),
    ], 'Vorderseite'),
    page('#14130f', [
      dk('Ecke', 'deko-ecken-sterne-gold', 6, 6, 30),
      text('Anrede', 15, 44, 75, 12, 'Liebe {{Name}},', { f: 'Cormorant Garamond', s: 20, w: 600, i: true, c: GOLD, min: 11 }),
      text('Text', 15, 58, 75, 50, 'Jahre sind wie Wein: Mit der Zeit werden sie wertvoller. Ich wünsche dir einen glänzenden Geburtstag und alles, was dein Herz begehrt.', { f: 'Cormorant Garamond', s: 13.5, w: 500, c: '#efe0b6', v: 'top', wrap: true, lh: 1.4, min: 9 }),
      text('Gruß', 15, 112, 75, 9, 'Dein Max', { f: 'Cormorant Garamond', s: 16, w: 600, i: true, c: GOLD, a: 'right', min: 10 }),
      line('Linie', 15, 126, 90, 126, GOLD, 0.25, { locked: true }),
    ], 'Innenseite'),
  ],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Retro
const TEAL = '#1d6f72';
const retro = tpl(Object.assign({}, META, {
  slug: 'geburtstag-rund-retro',
  name: 'Runder Geburtstag A6 – Retro',
  description: 'Karte zum runden Geburtstag im Siebziger-Look: Sonnenstrahlen in Senfgelb, Zahl (Feld „Alter“) auf einer petrolfarbenen Scheibe, „Happy Birthday“ in runder Schaufensterschrift.',
  variant: 'Retro',
  tags: ['Geburtstag', 'runder Geburtstag', 'Retro', 'Vintage', '70er', 'Happy Birthday', 'Zahl', 'Karte', '40', '50', '60'],
  pages: [
    page('#f7ead0', [
      shape('star', 'Strahlen', 2.5, 28, 100, 100, '#f2b134', { points: 24, inner: 0.86, locked: true }),
      ellipse('Scheibe', 13, 38, 79, 79, TEAL, { locked: true }),
      ellipse('Ring', 16.5, 41.5, 72, 72, null, { stroke: '#f7ead0', sw: 0.6, dash: 'dashed', locked: true }),
      ctext('Happy', 52.5, 10, 90, 16, 'HAPPY', { f: 'Righteous', s: 32, c: TEAL, ls: 0.08, lh: 1, min: 16 }),
      ctext('Zahl', 52.5, 47, 72, 40, '{{Alter}}', { f: 'Righteous', s: 84, c: '#f7ead0', lh: 1, min: 40 }),
      ctext('Birthday', 52.5, 130, 96, 14, 'BIRTHDAY', { f: 'Righteous', s: 30, c: '#e2542f', ls: 0.12, lh: 1, min: 14 }),
      ctext('Name', 52.5, 90, 68, 8, '{{Name}}', { f: 'Righteous', s: 12, c: '#f2b134', min: 6, up: true, ls: 0.12 }),
    ], 'Vorderseite'),
    page('#1d6f72', [
      shape('star', 'Strahlen innen', 50, 92, 62, 62, '#f2b134', { points: 24, inner: 0.86, locked: true }),
      text('Anrede', 14, 24, 78, 12, 'Liebe {{Name}},', { f: 'Righteous', s: 17, c: '#f2b134', min: 10 }),
      text('Text', 14, 40, 77, 55, 'Du bist kein bisschen alt – du bist ein Klassiker! Lass dich heute feiern, tanz bis spät und genieß jeden Moment.', { f: 'Nunito', s: 11.5, w: 600, c: '#f7ead0', v: 'top', wrap: true, lh: 1.5, min: 8 }),
      text('Gruß', 14, 100, 77, 9, 'Dein Max', { f: 'Righteous', s: 14, c: '#f7ead0', a: 'right', min: 8 }),
    ], 'Innenseite'),
  ],
}));

module.exports = { bunt, goldglanz, retro };
