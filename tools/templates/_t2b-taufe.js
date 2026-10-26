'use strict';
/* Family: Taufe (Einladung als Klappkarte). Variants: Klassisch (A6 hoch, Gold), Natur (quadratisch, Eukalyptus), Himmel (DIN-lang-Karte, Wolken und Sterne). The name is a field. */
const D = require('./dsl');
const { decor, scatter, cloud } = require('./_t2b-lib');
const { text, rect, ellipse, shape, icon, deko, dekoIn, page, gradient, field, line, foldCard, panels } = D;

const fields = [field('Name', 'Name', 'text', 'Lina')];
const sampleRows = [{ Name: 'Lina' }, { Name: 'Maximilian Alexander' }, { Name: 'Jo' }];
const base = { category: 'Einladungen', family: 'taufe-einladung', familyName: 'Taufe – Einladung', occasion: 'Kinder & Familie', unit: 'mm', fields, sampleRows, fold: 'vertical' };
const tags = (...more) => require('./_t2b-lib').dedupe(['Taufe', 'Taufeinladung', 'Einladung', 'Klappkarte', 'Baby', 'Kirche', 'Familie', ...more]);
const DATE = 'Sonntag, 16. Mai 2027';
const TIME = 'um 11 Uhr';
const CHURCH = 'Kirche St. Martin, Musterstadt';
const FEIER = 'Anschließend feiern wir bei uns: Musterweg 5';
const RSVP = 'Um eine Rückmeldung bis 1. Mai bitten wir: 0170 1234567';

// ------------------------------------------------------------------------------------------------------------------------ Klassisch
const klassisch = (() => {
  const IVORY = '#fbf7ee'; const GOLD = '#b8893a'; const INK = '#4a4033';
  const [back, front] = panels(210, 148, 'vertical', 4);
  const [inL, inR] = panels(210, 148, 'vertical', 4);
  return Object.assign({}, base, {
    slug: 'taufe-klassisch',
    name: 'Taufe – Klassisch',
    description: 'Klappkarte A6 hoch (2 Seiten) zur Taufe in Elfenbein und Gold: Doppelrahmen, Schreibschrift und ein Tropfen als Zeichen. Der Name des Täuflings ist ein Feld.',
    variant: 'Klassisch',
    tags: tags('Klassisch', 'Gold', 'Elfenbein', 'Schreibschrift', 'Festlich'),
    formatKey: 'card-a6-portrait', width: 210, height: 148,
    pages: foldCard('vertical', [
      decor([
        deko('Zweig', 'deko-blumen-olivenzweig-gold', 22, 52, 61),
        deko('Trenner', 'deko-trenner-schnoerkel-gold', 30, 80, 45),
      ]),
      text('Rückseite', 8, 90, 89, 20, 'Mit Liebe gestaltet von\nFamilie Mustermann\nMusterweg 5 · 12345 Musterstadt', { f: 'Cormorant Garamond', s: 9, w: 600, c: INK, a: 'center', wrap: true, v: 'top', lh: 1.4, min: 7 }),
      decor([
        dekoIn('Rahmen', 'deko-rahmen-doppellinie-hoch-gold', 109, 5, 97, 138),
        icon('Tropfen', 'droplet', 151, 22, 12, GOLD, 1.5),
        deko('Zweig vorn', 'deko-blumen-olivenzweig-gold', 130, 116, 45),
      ]),
      text('Taufe', 110, 38, 90, 32, 'Taufe', { f: 'Great Vibes', s: 58, c: GOLD, a: 'center', min: 24 }),
      text('Name', 112, 76, 86, 10, '{{Name}}', { f: 'Cinzel', s: 17, w: 400, c: INK, a: 'center', ls: 0.14, min: 9 }),
      decor([deko('Trenner vorn', 'deko-trenner-raute-gold', 135, 91, 45)]),
      text('Datum vorn', 112, 100, 86, 8, '16. Mai 2027', { f: 'Cormorant Garamond', s: 15, w: 600, c: INK, a: 'center', ls: 0.06, min: 8 }),
    ], [
      decor([deko('Ecke', 'deko-ecken-schnoerkel-gold', 6, 6, 22), deko('Ecke 2', 'deko-ecken-schnoerkel-gold', 182, 120, 22, undefined, { flipX: true, flipY: true })]),
      text('Gruß', inL.x + 6, 26, inL.w - 12, 30, 'Wir freuen uns sehr,\ndass unser Kind getauft wird,\nund laden euch herzlich ein,\ndiesen Tag mit uns zu feiern.', { f: 'Cormorant Garamond', s: 12, w: 600, i: true, c: INK, a: 'center', wrap: true, v: 'top', lh: 1.4, min: 8 }),
      text('Name innen', inL.x + 6, 68, inL.w - 12, 16, '{{Name}}', { f: 'Great Vibes', s: 34, c: GOLD, a: 'center', min: 14 }),
      decor([deko('Trenner innen', 'deko-trenner-schnoerkel-gold', 28, 92, 50)]),
      text('Zusage', inL.x + 6, 102, inL.w - 12, 16, RSVP, { f: 'Cormorant Garamond', s: 9.5, w: 600, c: INK, a: 'center', wrap: true, v: 'top', lh: 1.35, min: 7 }),
      text('Wann', inR.x + 4, 34, inR.w - 8, 6, 'DIE TAUFE FINDET STATT', { f: 'Cinzel', s: 8.5, w: 400, c: GOLD, a: 'center', ls: 0.12, min: 6 }),
      text('Datum', inR.x + 4, 46, inR.w - 8, 10, DATE, { f: 'Cormorant Garamond', s: 19, w: 700, c: INK, a: 'center', min: 9 }),
      text('Uhrzeit', inR.x + 4, 58, inR.w - 8, 8, TIME, { f: 'Cormorant Garamond', s: 15, w: 600, c: INK, a: 'center', min: 8 }),
      text('Kirche', inR.x + 4, 70, inR.w - 8, 8, CHURCH, { f: 'Cormorant Garamond', s: 13.5, w: 600, i: true, c: INK, a: 'center', min: 8 }),
      decor([deko('Trenner rechts', 'deko-trenner-punkte-gold', 130, 88, 45)]),
      text('Feier', inR.x + 8, 98, inR.w - 16, 16, FEIER, { f: 'Cormorant Garamond', s: 12.5, w: 600, c: INK, a: 'center', wrap: true, v: 'top', lh: 1.35, min: 8 }),
    ], IVORY),
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ Natur
const natur = (() => {
  const CREAM = '#f7f2e8'; const SAGE = '#6f8f75'; const INK = '#3d4a3f'; const CLAY = '#b98062';
  return Object.assign({}, base, {
    slug: 'taufe-natur',
    name: 'Taufe – Natur',
    description: 'Quadratische Klappkarte (29 x 14,5 cm offen) zur Taufe mit Eukalyptuskranz, Salbeigrün und ruhiger Schrift. Der Name des Täuflings ist ein Feld.',
    variant: 'Natur',
    tags: tags('Natur', 'Eukalyptus', 'Salbei', 'Boho', 'Grün', 'Quadratisch', 'Kranz'),
    formatKey: 'card-square-145', width: 290, height: 145,
    pages: foldCard('vertical', [
      decor([deko('Zweig', 'deko-blumen-eukalyptuszweig-salbei', 66, 28, undefined, 78, { rotation: 8 })]),
      text('Rückseite', 30, 118, 85, 12, 'Familie Mustermann\nMusterweg 5 · 12345 Musterstadt', { f: 'Josefin Sans', s: 8, w: 400, c: INK, a: 'center', wrap: true, v: 'top', lh: 1.5, ls: 0.04, min: 6 }),
      decor([deko('Kranz', 'deko-blumen-eukalyptuskranz-salbei', 167.5, 22.5, 100)]),
      text('Zur', 190, 52, 55, 6, 'ZUR TAUFE VON', { f: 'Josefin Sans', s: 8, w: 600, c: SAGE, a: 'center', ls: 0.3, min: 6 }),
      text('Name', 188, 60, 59, 16, '{{Name}}', { f: 'Cormorant Garamond', s: 30, w: 500, i: true, c: INK, a: 'center', min: 13 }),
      text('Datum vorn', 190, 80, 55, 6, '16. 05. 2027', { f: 'Josefin Sans', s: 9, w: 600, c: INK, a: 'center', ls: 0.2, min: 6 }),
    ], [
      decor([deko('Ecke', 'deko-ecken-eukalyptus-salbei', 250, 1, 38, undefined, { flipX: true }), deko('Ecke unten', 'deko-ecken-eukalyptus-salbei', 252, 105, 36, undefined, { flipX: true, flipY: true })]),
      text('Titel', 22, 22, 100, 20, 'Wir feiern\ndie Taufe von', { f: 'Cormorant Garamond', s: 21, w: 500, c: INK, a: 'left', wrap: true, v: 'top', lh: 1.2, min: 10 }),
      text('Name innen', 22, 46, 100, 18, '{{Name}}', { f: 'Cormorant Garamond', s: 36, w: 600, i: true, c: SAGE, a: 'left', min: 14 }),
      text('Text', 22, 70, 98, 26, 'und freuen uns, wenn du mit uns\ndanke sagst, singst und isst.', { f: 'Josefin Sans', s: 11, w: 400, c: INK, a: 'left', wrap: true, v: 'top', lh: 1.55, min: 7 }),
      text('Zusage', 22, 108, 98, 14, RSVP, { f: 'Josefin Sans', s: 9, w: 400, c: INK, a: 'left', wrap: true, v: 'top', lh: 1.5, min: 6 }),
      text('Wann', 170, 28, 100, 6, 'WANN', { f: 'Josefin Sans', s: 8, w: 700, c: CLAY, a: 'left', ls: 0.3, min: 6 }),
      text('Datum', 170, 36, 100, 9, DATE, { f: 'Cormorant Garamond', s: 17, w: 600, c: INK, a: 'left', min: 9 }),
      text('Uhrzeit', 170, 46, 100, 7, TIME, { f: 'Cormorant Garamond', s: 14, w: 500, c: INK, a: 'left', min: 8 }),
      line('Linie 1', 170, 62, 270, 62, SAGE, 0.5),
      text('Wo', 170, 70, 100, 6, 'WO', { f: 'Josefin Sans', s: 8, w: 700, c: CLAY, a: 'left', ls: 0.3, min: 6 }),
      text('Kirche', 170, 78, 100, 8, CHURCH, { f: 'Cormorant Garamond', s: 14, w: 500, c: INK, a: 'left', min: 8 }),
      line('Linie 2', 170, 96, 270, 96, SAGE, 0.5),
      text('Feier', 170, 103, 100, 14, FEIER, { f: 'Cormorant Garamond', s: 12, w: 500, i: true, c: INK, a: 'left', wrap: true, v: 'top', lh: 1.35, min: 8 }),
    ], CREAM),
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ Himmel
const himmel = (() => {
  const SKY = '#cfe6fa'; const NAVY = '#26436e'; const GOLD = '#f0b84a'; const CREAM = '#fffaf0';
  return Object.assign({}, base, {
    slug: 'taufe-himmel',
    name: 'Taufe – Himmel',
    description: 'Verspielte Klappkarte (Doppelkarte DIN lang, 2 Seiten) zur Taufe mit hellblauem Himmel, Mond, Sternen und Wolken. Der Name des Täuflings ist ein Feld.',
    variant: 'Himmel',
    tags: tags('Himmel', 'Sterne', 'Mond', 'Wolken', 'Verspielt', 'Pastell', 'Junge', 'Mädchen'),
    formatKey: 'card-dl-portrait', width: 198, height: 210,
    pages: foldCard('vertical', [
      decor([
        rect('Himmel hinten', 0, 0, 99, 210, CREAM),
        deko('Sterne hinten', 'deko-muster-sterne-gold', 0, 130, 99, undefined, { opacity: 0.25 }),
        rect('Himmel', 99, 0, 99, 210, SKY),
        ...scatter('Funkeln', 14, [103, 6, 91, 198], { n: 14, colors: ['#ffffff', GOLD], kinds: ['spark', 'star', 'dot'], size: [2.4, 4.4], avoid: [[108, 30, 82, 140]], pad: 1 }),
        ...cloud('Wolke 1', 104, 150, 44, '#ffffff'), ...cloud('Wolke 2', 150, 170, 40, '#ffffff', { opacity: 0.9 }), ...cloud('Wolke 3', 118, 184, 34, '#ffffff'),
        deko('Mond', 'deko-formen-mond-gold', 168, 9, 20),
      ]),
      text('Zeile', 105, 42, 87, 8, 'Unser kleiner Stern', { f: 'Dancing Script', s: 20, w: 700, c: NAVY, a: 'center', min: 11 }),
      text('Taufe', 105, 54, 87, 20, 'wird getauft', { f: 'Baloo 2', s: 25, w: 700, c: NAVY, a: 'center', min: 13 }),
      text('Name', 105, 82, 87, 18, '{{Name}}', { f: 'Dancing Script', s: 40, w: 700, c: '#3b78c4', a: 'center', min: 14 }),
      decor([deko('Stern', 'deko-sterne-stern-gold', 134.5, 108, 20)]),
      text('Rückseite', 8, 176, 83, 12, 'Familie Mustermann\nMusterweg 5 · 12345 Musterstadt', { f: 'Nunito', s: 8, w: 600, c: NAVY, a: 'center', wrap: true, v: 'top', lh: 1.45, min: 6 }),
    ], [
      decor([
        ...cloud('Wolke innen', 148, 8, 40, SKY), ...cloud('Wolke innen 2', 10, 176, 42, SKY),
        deko('Sterne innen', 'deko-sterne-funkeln-gold', 18, 14, 14), deko('Stern innen', 'deko-sterne-stern-gold', 168, 188, 9),
      ]),
      text('Titel', 14, 36, 72, 26, 'Wir laden euch\nzur Taufe ein', { f: 'Baloo 2', s: 22, w: 700, c: NAVY, a: 'center', wrap: true, lh: 1.1, min: 10 }),
      text('Name innen', 14, 68, 72, 18, '{{Name}}', { f: 'Dancing Script', s: 34, w: 700, c: '#4f8fd8', a: 'center', min: 13 }),
      text('Text', 16, 98, 68, 38, 'Gemeinsam wollen wir danke sagen, beten, singen und fröhlich feiern.', { f: 'Nunito', s: 12, w: 600, c: NAVY, a: 'center', wrap: true, v: 'top', lh: 1.45, min: 8 }),
      text('Zusage', 16, 152, 68, 16, RSVP, { f: 'Nunito', s: 9.5, w: 600, c: NAVY, a: 'center', wrap: true, v: 'top', lh: 1.4, min: 6.5 }),
      text('Datum', 114, 40, 70, 18, 'Sonntag,\n16. Mai 2027', { f: 'Baloo 2', s: 19, w: 700, c: NAVY, a: 'center', wrap: true, lh: 1.15, min: 9 }),
      text('Uhrzeit', 114, 62, 70, 8, TIME, { f: 'Nunito', s: 14, w: 700, c: '#4f8fd8', a: 'center', min: 8 }),
      decor([deko('Trenner', 'deko-trenner-sterne-gold', 124, 84, 50)]),
      text('Kirche', 114, 98, 70, 18, 'Kirche St. Martin\nMusterstadt', { f: 'Nunito', s: 12.5, w: 700, c: NAVY, a: 'center', wrap: true, v: 'top', lh: 1.35, min: 8 }),
      text('Feier', 114, 128, 70, 22, FEIER, { f: 'Nunito', s: 11, w: 600, c: NAVY, a: 'center', wrap: true, v: 'top', lh: 1.45, min: 7 }),
    ], SKY, CREAM),
  });
})();

module.exports = { templates: [klassisch, natur, himmel] };
