'use strict';
const L = require('./_t2a-lib');
const { text, rect, ellipse, line, icon, shape, page, foldCard, panels, ctext, divider, dk, dekoIn, tpl, gradient } = L;

const META = { family: 'beileidskarte', familyName: 'Beileidskarte', occasion: 'Trauer', formatKey: 'card-a6-portrait', fold: 'vertical', width: 210, height: 148 };
const [BL, FR] = panels(210, 148, 'vertical', 4);

const TEXT_IN = 'In Gedanken sind wir bei dir und deiner Familie. Wir wünschen euch Kraft, Zeit zum Trauern und Menschen, die euch in diesen schweren Tagen zur Seite stehen.';

// ---------------------------------------------------------------------------------------------------------------------------- Stilles Weiß
const INK = '#3b3b3b';
const weiss = tpl(Object.assign({}, META, {
  slug: 'beileidskarte-stilles-weiss',
  name: 'Beileidskarte Klappkarte – Stilles Weiß',
  description: 'Ruhige Beileidskarte als Klappkarte A6 hoch: Weiß mit einem einzelnen Olivenzweig in gedämpftem Grün, „In stillem Gedenken“ in zurückhaltender Antiqua. Innen viel Raum für persönliche Worte.',
  variant: 'Stilles Weiß',
  tags: ['Beileid', 'Trauer', 'Trauerkarte', 'Kondolenz', 'Anteilnahme', 'Gedenken', 'Klappkarte', 'ruhig', 'Olivenzweig', 'Karte'],
  pages: foldCard('vertical', [
    ctext('Hinten', BL.cx, 130, 80, 7, 'In Anteilnahme', { f: 'Cormorant Garamond', s: 10, w: 500, i: true, c: '#8b8b8b', min: 6 }),
    dk('Zweig', 'deko-blumen-olivenzweig-salbei', 118, 40, 76),
    ctext('Titel 1', FR.cx, 66, 84, 14, 'In stillem', { f: 'Cormorant Garamond', s: 22, w: 500, c: INK, min: 11 }),
    ctext('Titel 2', FR.cx, 77, 84, 14, 'Gedenken', { f: 'Cormorant Garamond', s: 22, w: 500, i: true, c: INK, min: 11 }),
  ], [
    text('Anrede', 120, 28, 76, 11, 'Liebe Familie Hoffmann,', { f: 'Cormorant Garamond', s: 17, w: 600, i: true, c: INK, min: 9 }),
    text('Text', 120, 42, 76, 62, TEXT_IN, { f: 'Cormorant Garamond', s: 13, w: 500, c: INK, v: 'top', wrap: true, lh: 1.5, min: 8 }),
    text('Gruß', 120, 108, 76, 9, 'In stiller Anteilnahme, Familie Beck', { f: 'Cormorant Garamond', s: 12.5, w: 500, i: true, c: '#6f7f6f', a: 'right', min: 7 }),
    line('Strich', 120, 106, 196, 106, '#d7d7d7', 0.25, { locked: true }),
    dk('Zweig innen', 'deko-blumen-olivenzweig-salbei', 14, 60, 76, undefined, { opacity: 0.8 }),
  ], '#ffffff'),
}));

// ---------------------------------------------------------------------------------------------------------------------------- Lavendel
const PLUM = '#4b4560';
const lavendel = tpl(Object.assign({}, META, {
  slug: 'beileidskarte-lavendel',
  name: 'Beileidskarte Klappkarte – Lavendel',
  description: 'Sanfte Beileidskarte als Klappkarte A6 hoch in Grau und gedämpftem Violett: drei Lavendelstängel, „Unser aufrichtiges Mitgefühl“ in ruhiger Serifenschrift, innen Platz für einen persönlichen Text.',
  variant: 'Lavendel',
  tags: ['Beileid', 'Trauer', 'Trauerkarte', 'Kondolenz', 'Mitgefühl', 'Lavendel', 'Klappkarte', 'sanft', 'Anteilnahme', 'Karte'],
  pages: foldCard('vertical', [
    dk('Lavendel hinten', 'deko-blumen-lavendel-navy', BL.cx - 6, 54, 12, undefined, { opacity: 0.6 }),
    dk('Lavendel', 'deko-blumen-lavendel-navy', FR.cx - 12, 14, 24),
    ctext('Titel 1', FR.cx, 80, 84, 12, 'Unser aufrichtiges', { f: 'Lora', s: 14, i: true, c: PLUM, min: 8 }),
    ctext('Titel 2', FR.cx, 91, 84, 14, 'Mitgefühl', { f: 'Lora', s: 19, w: 600, c: PLUM, min: 10 }),
    line('Strich', FR.cx - 8, 112, FR.cx + 8, 112, '#b9b3cf', 0.5, { locked: true }),
  ], [
    dk('Lavendel innen', 'deko-blumen-lavendel-navy', 38, 36, 30, undefined, { opacity: 0.85 }),
    text('Anrede', 120, 28, 76, 11, 'Liebe Anna,', { f: 'Lora', s: 13, i: true, c: PLUM, min: 8 }),
    text('Text', 120, 42, 76, 62, TEXT_IN, { f: 'Lora', s: 10.5, c: '#3d3a4a', v: 'top', wrap: true, lh: 1.65, min: 7 }),
    text('Gruß', 120, 108, 76, 9, 'Mit herzlichem Mitgefühl, Jonas', { f: 'Lora', s: 10, i: true, c: PLUM, a: 'right', min: 6 }),
  ], '#f3f1f6', '#fbfafc'),
}));

// ---------------------------------------------------------------------------------------------------------------------------- Abendlicht
const abendlicht = tpl(Object.assign({}, META, {
  slug: 'beileidskarte-abendlicht',
  name: 'Beileidskarte Klappkarte – Abendlicht',
  description: 'Würdevolle Beileidskarte als Klappkarte A6 hoch: ein weicher Verlauf in Dämmerblau mit schmaler Mondsichel und einer kleinen Flamme, „Wir sind in Gedanken bei dir“ in heller Schrift. Innen hell.',
  variant: 'Abendlicht',
  tags: ['Beileid', 'Trauer', 'Trauerkarte', 'Kondolenz', 'Abendlicht', 'Mond', 'Kerze', 'Klappkarte', 'würdevoll', 'Karte', 'Anteilnahme'],
  pages: foldCard('vertical', [
    rect('Rückseite', 0, 0, 105, 148, '#2b3a55', { locked: true }),
    icon('Flamme', 'flame', BL.cx - 4.5, 62, 9, '#e9c98a', 1.6),
    rect('Front', 105, 0, 105, 148, '#34466a', { locked: true }),
    dk('Mond', 'deko-formen-mond-weiss', 150, 18, 26, undefined, { opacity: 0.9 }),
    ctext('Titel 1', FR.cx, 74, 84, 12, 'Wir sind in', { f: 'Cormorant Garamond', s: 17, w: 400, c: '#dfe5f2', min: 9 }),
    ctext('Titel 2', FR.cx, 84, 84, 16, 'Gedanken bei dir', { f: 'Cormorant Garamond', s: 22, w: 500, i: true, c: '#ffffff', min: 11 }),
    line('Strich', FR.cx - 8, 108, FR.cx + 8, 108, '#e9c98a', 0.5, { locked: true }),
  ], [
    icon('Flamme', 'flame', 48, 62, 9, '#c9a45a', 1.6),
    text('Anrede', 120, 28, 76, 11, 'Liebe Familie Hoffmann,', { f: 'Cormorant Garamond', s: 17, w: 600, i: true, c: '#34466a', min: 9 }),
    text('Text', 120, 42, 76, 62, TEXT_IN, { f: 'Cormorant Garamond', s: 13, w: 500, c: '#2b3340', v: 'top', wrap: true, lh: 1.5, min: 8 }),
    text('Gruß', 120, 108, 76, 9, 'In stiller Anteilnahme, Familie Beck', { f: 'Cormorant Garamond', s: 12.5, w: 500, i: true, c: '#34466a', a: 'right', min: 7 }),
  ], '#2b3a55', '#f6f4ef'),
}));

module.exports = { weiss, lavendel, abendlicht };
