'use strict';
const L = require('./_t2a-lib');
const { text, rect, ellipse, line, icon, shape, page, ctext, divider, dk, dekoIn, tpl, gradient } = L;

const META = { family: 'gute-besserung', familyName: 'Gute Besserung', occasion: 'Kinder & Familie' };

// ---------------------------------------------------------------------------------------------------------------------------- Sonnenschein
const BROWN = '#6b4a1e';
const sonnenschein = tpl(Object.assign({}, META, {
  slug: 'gute-besserung-sonnenschein',
  name: 'Gute-Besserung-Karte A6 quer – Sonnenschein',
  description: 'Aufmunternde Karte im Format A6 quer: große gelbe Sonne, „Gute Besserung!“ in Handschrift und ein kleiner Wolkenhimmel. Innen Platz für Genesungswünsche an Freunde, Familie oder Kollegen.',
  variant: 'Sonnenschein',
  tags: ['Gute Besserung', 'Genesung', 'krank', 'Sonne', 'aufmuntern', 'Karte', 'Genesungswünsche', 'gelb', 'Handschrift'],
  formatKey: 'a6-landscape', width: 148, height: 105,
  pages: [
    page('#fff3b8', [
      dk('Sonne', 'deko-formen-sonne-bunt', 88, -10, 76),
      dk('Wolke', 'deko-formen-wolke-1-weiss', 108, 70, 34),
      dk('Wolke 2', 'deko-formen-wolke-2-weiss', 6, 4, 46),
      text('Gute', 12, 30, 100, 26, 'Gute', { f: 'Caveat', s: 64, w: 700, c: BROWN, lh: 1, min: 30 }),
      text('Besserung', 12, 52, 120, 30, 'Besserung!', { f: 'Caveat', s: 72, w: 700, c: '#e2742b', lh: 1, min: 30, rotation: -2 }),
      text('Zeile', 14, 86, 120, 8, 'Die Sonne scheint auch für dich', { f: 'Nunito', s: 10, w: 700, c: BROWN, min: 6 }),
    ], 'Vorderseite'),
    page('#fffdf3', [
      icon('Sonne', 'sun', 118, 12, 16, '#f5a623', 1.8),
      text('Anrede', 18, 14, 96, 12, 'Lieber Tom,', { f: 'Caveat', s: 28, w: 700, c: '#e2742b', min: 14 }),
      text('Text', 18, 28, 100, 46, 'wir denken an dich und wünschen dir von Herzen, dass du ganz schnell wieder auf die Beine kommst. Ruh dich gut aus, wir warten auf dich!', { f: 'Caveat', s: 21, w: 500, c: BROWN, v: 'top', wrap: true, lh: 1.3, min: 12 }),
      text('Gruß', 18, 80, 112, 10, 'Dein Team', { f: 'Caveat', s: 25, w: 700, c: BROWN, a: 'right', min: 12 }),
      rect('Band', 0, 99, 148, 6, '#f5a623', { locked: true }),
    ], 'Innenseite'),
  ],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Aquarell
const SAGE = '#4f6f58';
const aquarell = tpl(Object.assign({}, META, {
  slug: 'gute-besserung-aquarell',
  name: 'Gute-Besserung-Karte A6 hoch – Aquarell',
  description: 'Beruhigende Karte im Format A6 hoch: sanfte Salbei-Aquarellfläche mit Olivenzweig, „Werde bald wieder gesund“ in feiner Kursivschrift, innen Platz für warme Worte.',
  variant: 'Aquarell',
  tags: ['Gute Besserung', 'Genesung', 'Aquarell', 'ruhig', 'Salbei', 'Olivenzweig', 'Karte', 'Genesungswünsche', 'beruhigend'],
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [
    page('#fbfaf6', [
      dk('Aquarell', 'deko-formen-aquarell-salbei', -6, 18, 118),
      dk('Zweig', 'deko-blumen-olivenzweig-salbei', 12, 112, 80),
      ctext('Werde', 52.5, 40, 80, 14, 'Werde bald', { f: 'Lora', s: 19, i: true, c: SAGE, min: 10 }),
      ctext('gesund', 52.5, 54, 86, 26, 'wieder gesund', { f: 'Playfair Display', s: 26, w: 600, i: true, c: '#2f4a3b', min: 13 }),
      ctext('Gruß', 52.5, 84, 74, 8, 'Ich denke an dich', { f: 'Raleway', s: 8.5, w: 600, c: SAGE, up: true, ls: 0.2, min: 5 }),
    ], 'Vorderseite'),
    page('#fbfaf6', [
      dk('Zweig innen', 'deko-blumen-olivenzweig-salbei', 16, 12, 74),
      text('Anrede', 16, 44, 74, 11, 'Liebe Anna,', { f: 'Playfair Display', s: 15, i: true, c: SAGE, min: 9 }),
      text('Text', 16, 58, 74, 50, 'ich wünsche dir viel Ruhe, gute Pflege und bald wieder ganz viel Kraft. Lass dich verwöhnen und melde dich, wenn ich dir etwas vorbeibringen soll.', { f: 'Lora', s: 10.5, c: '#2f4a3b', v: 'top', wrap: true, lh: 1.55, min: 7 }),
      text('Gruß', 16, 114, 74, 9, 'Gute Besserung, Lisa', { f: 'Playfair Display', s: 12.5, i: true, c: SAGE, a: 'right', min: 8 }),
    ], 'Innenseite'),
  ],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Pflaster
const pflaster = tpl(Object.assign({}, META, {
  slug: 'gute-besserung-pflaster',
  name: 'Gute-Besserung-Karte A6 quer – Pflaster',
  description: 'Verspielte Karte im Format A6 quer: ein großes Herz mit aufgeklebtem Pflaster, kleine Symbole für Tee, Tablette und Thermometer und „Gute Besserung“ in krakeliger Kinderschrift.',
  variant: 'Pflaster',
  tags: ['Gute Besserung', 'Genesung', 'Pflaster', 'Herz', 'Kinder', 'verspielt', 'krank', 'Karte', 'Genesungswünsche', 'Tee'],
  formatKey: 'a6-landscape', width: 148, height: 105,
  pages: [
    page('#e9f6f3', [
      dk('Herz', 'deko-herzen-voll-rose', 8, 14, 68),
      rect('Pflaster', 20, 38, 46, 13, '#f2cf9b', { radius: 3, rotation: -35, locked: true }),
      rect('Pflaster Mitte', 36, 41, 14, 7, '#ecbd7c', { rotation: -35, locked: true }),
      rect('Pflaster 2', 20, 38, 46, 13, '#f2cf9b', { radius: 3, rotation: 35, locked: true }),
      rect('Pflaster 2 Mitte', 36, 41, 14, 7, '#ecbd7c', { rotation: 35, locked: true }),
      text('Gute', 82, 14, 60, 24, 'Gute', { f: 'Gochi Hand', s: 40, c: '#c9505c', lh: 1, min: 20 }),
      text('Besserung', 80, 34, 66, 28, 'Besserung!', { f: 'Gochi Hand', s: 38, c: '#1f6f78', lh: 1, min: 18 }),
      icon('Tee', 'coffee', 86, 74, 14, '#1f6f78', 1.6),
      icon('Tablette', 'pill', 106, 74, 14, '#c9505c', 1.6, { rotation: 25 }),
      icon('Thermometer', 'thermometer', 126, 74, 14, '#1f6f78', 1.6),
    ], 'Vorderseite'),
    page('#ffffff', [
      rect('Band', 0, 0, 148, 8, '#c9505c', { locked: true }),
      icon('Herz', 'heart-pulse', 118, 16, 16, '#c9505c', 1.8),
      text('Anrede', 18, 20, 96, 11, 'Hallo Tom,', { f: 'Gochi Hand', s: 24, c: '#1f6f78', min: 12 }),
      text('Text', 18, 34, 100, 40, 'Mit Tee, Ruhe und viel Schlaf geht es bald wieder bergauf! Wir vermissen dich und freuen uns, wenn du wieder dabei bist.', { f: 'Gochi Hand', s: 16, c: '#2f2a4a', v: 'top', wrap: true, lh: 1.35, min: 10 }),
      text('Gruß', 18, 82, 112, 10, 'Deine Klasse 3b', { f: 'Gochi Hand', s: 21, c: '#c9505c', a: 'right', min: 11 }),
    ], 'Innenseite'),
  ],
}));

module.exports = { sonnenschein, aquarell, pflaster };
