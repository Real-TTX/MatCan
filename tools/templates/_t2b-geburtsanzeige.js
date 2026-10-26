'use strict';
/* Family: Geburtsanzeige. Variants: Blumenkranz (Postkarte, 2 Seiten), Stern (Klappkarte quadratisch), Hallo Welt (A6 quer). Fields: Name, Datum, Gewicht, Groesse. */
const D = require('./dsl');
const { decor, scatter, cloud } = require('./_t2b-lib');
const { text, rect, ellipse, shape, icon, deko, dekoIn, page, gradient, field, line, foldCard, panels } = D;

const fields = [
  field('Name', 'Name des Kindes', 'text', 'Emil'), field('Datum', 'Geburtsdatum', 'text', '12. März 2027'),
  field('Gewicht', 'Gewicht', 'text', '3.420 g'), field('Groesse', 'Größe', 'text', '52 cm'),
];
const sampleRows = [
  { Name: 'Emil', Datum: '12. März 2027', Gewicht: '3.420 g', Groesse: '52 cm' },
  { Name: 'Charlotte-Sophie', Datum: '30. September 2027', Gewicht: '2.980 g', Groesse: '49 cm' },
  { Name: 'Jo', Datum: '1. Januar 2027', Gewicht: '4.105 g', Groesse: '55 cm' },
];
const base = { category: 'Karten', family: 'geburtsanzeige', familyName: 'Geburtsanzeige', occasion: 'Kinder & Familie', unit: 'mm', fields, sampleRows };
const tags = (...more) => require('./_t2b-lib').dedupe(['Geburtsanzeige', 'Geburtskarte', 'Baby', 'Geburt', 'Neugeborenes', 'Willkommen', 'Danke', 'Familie', ...more]);
const PARENTS = 'Anna und Tom Mustermann';
const ADDR = 'Musterweg 5 · 12345 Musterstadt';

// ------------------------------------------------------------------------------------------------------------------------ Blumenkranz
const kranz = (() => {
  const CREAM = '#fdf3ea'; const ROSE = '#c9788a'; const INK = '#4d3b3b'; const SAGE = '#7a9a82';
  return Object.assign({}, base, {
    slug: 'geburtsanzeige-blumenkranz',
    name: 'Geburtsanzeige – Blumenkranz',
    description: 'Postkarte A6 hoch (Vorder- und Rückseite) zur Geburt: Blumenkranz mit dem Namen, auf der Rückseite Datum, Gewicht, Größe und die Eltern. Alle Angaben sind Felder.',
    variant: 'Blumenkranz',
    tags: tags('Blumenkranz', 'Postkarte', 'Rosa', 'Blumen', 'Zart', 'Mädchen'),
    formatKey: 'postcard-a6-portrait', width: 105, height: 148,
    pages: [
      page(CREAM, [
        decor([deko('Kranz', 'deko-blumen-blumenkranz', 11, 22, 83)]),
        text('Willkommen', 12, 8, 81, 10, 'Willkommen auf der Welt', { f: 'Dancing Script', s: 16, w: 700, c: SAGE, a: 'center', min: 9 }),
        text('Name', 28, 56, 49, 22, '{{Name}}', { f: 'Dancing Script', s: 40, w: 700, c: ROSE, a: 'center', min: 14 }),
        text('Zeile', 12, 112, 81, 9, 'ist da!', { f: 'Cormorant Garamond', s: 22, w: 500, i: true, c: INK, a: 'center', min: 10 }),
        text('Datum', 12, 126, 81, 8, '{{Datum}}', { f: 'Raleway', s: 11, w: 600, c: INK, a: 'center', ls: 0.1, min: 7 }),
      ], 'Vorderseite'),
      page(CREAM, [
        decor([
          deko('Trenner', 'deko-trenner-bluetenranke-rose', 20, 54, 65),
          icon('Gewicht Symbol', 'scale', 22, 83, 8, ROSE, 1.7), icon('Größe Symbol', 'ruler', 22, 97, 8, ROSE, 1.7), icon('Datum Symbol', 'calendar-heart', 22, 69, 8, ROSE, 1.7),
          deko('Trenner 2', 'deko-trenner-bluetenranke-rose', 20, 110, 65, undefined, { flipY: true }),
        ]),
        text('Titel', 10, 14, 85, 22, 'Mit großer Freude\nzeigen wir die Geburt\nunseres Kindes an', { f: 'Cormorant Garamond', s: 13, w: 600, i: true, c: INK, a: 'center', wrap: true, v: 'top', lh: 1.35, min: 8 }),
        text('Name hinten', 10, 36, 85, 14, '{{Name}}', { f: 'Dancing Script', s: 26, w: 700, c: ROSE, a: 'center', min: 11 }),
        text('Datum', 33, 68, 52, 10, '{{Datum}}', { f: 'Raleway', s: 11, w: 600, c: INK, a: 'left', min: 7 }),
        text('Gewicht', 33, 82, 52, 10, '{{Gewicht}}', { f: 'Raleway', s: 11, w: 600, c: INK, a: 'left', min: 7 }),
        text('Größe', 33, 96, 52, 10, '{{Groesse}}', { f: 'Raleway', s: 11, w: 600, c: INK, a: 'left', min: 7 }),
        text('Eltern', 8, 120, 89, 8, 'Es freuen sich\n' + PARENTS, { f: 'Raleway', s: 9.5, w: 600, c: INK, a: 'center', wrap: true, v: 'top', lh: 1.4, min: 7 }),
        text('Adresse', 8, 134, 89, 6, ADDR, { f: 'Raleway', s: 7.5, w: 500, c: SAGE, a: 'center', min: 6 }),
      ], 'Rückseite'),
    ],
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ Stern
const stern = (() => {
  const NAVY = '#243a63'; const GOLD = '#e8b84d'; const CREAM = '#fbf6e9'; const INK = '#2b3350';
  const stat = (x, iconName, label, key) => [
    ellipse('Kreis ' + label, x, 40, 34, 34, '#ffffff', { stroke: GOLD, sw: 1, locked: true }),
    icon('Symbol ' + label, iconName, x + 10, 47, 14, GOLD, 1.6, { locked: true }),
    text(label, x - 8, 78, 50, 6, label.toUpperCase(), { f: 'Josefin Sans', s: 7.5, w: 700, c: GOLD, a: 'center', ls: 0.2, min: 5.5 }),
    text('Wert ' + label, x - 10, 85, 54, 10, '{{' + key + '}}', { f: 'Cormorant Garamond', s: 15, w: 700, c: INK, a: 'center', min: 8 }),
  ];
  return Object.assign({}, base, {
    slug: 'geburtsanzeige-stern',
    name: 'Geburtsanzeige – Stern',
    description: 'Quadratische Klappkarte (2 Seiten) zur Geburt: außen ein goldener Stern auf Nachtblau, innen Name, Datum, Gewicht und Größe in drei Kreisen. Alle Angaben sind Felder.',
    variant: 'Stern',
    tags: tags('Stern', 'Sternenkind', 'Nachtblau', 'Gold', 'Klappkarte', 'Quadratisch', 'Junge'),
    formatKey: 'card-square-145', width: 290, height: 145, fold: 'vertical',
    pages: foldCard('vertical', [
      decor([
        rect('Nacht', 0, 0, 290, 145, NAVY),
        deko('Himmel', 'deko-sterne-himmel-gold', 145, 0, 145, undefined, { opacity: 0.4 }),
        deko('Himmel hinten', 'deko-sterne-himmel-gold', 0, 0, 145, undefined, { opacity: 0.3 }),
        deko('Stern', 'deko-sterne-stern-gold', 187, 20, 60),
      ]),
      text('Ein', 150, 90, 135, 10, 'Ein neuer Stern ist aufgegangen', { f: 'Cormorant Garamond', s: 14, w: 600, i: true, c: '#f3e3b8', a: 'center', min: 8 }),
      text('Name', 150, 102, 135, 20, '{{Name}}', { f: 'Cinzel', s: 20, w: 400, c: '#ffffff', a: 'center', ls: 0.14, min: 10 }),
      text('Rückseite', 20, 118, 105, 12, 'Familie Mustermann\n' + ADDR, { f: 'Josefin Sans', s: 7.5, w: 400, c: '#c8cfe6', a: 'center', wrap: true, v: 'top', lh: 1.5, min: 6 }),
    ], [
      decor([
        deko('Funkeln', 'deko-sterne-funkeln-gold', 10, 10, 14), deko('Funkeln 2', 'deko-sterne-funkeln-gold', 122, 118, 12),
        line('Linie', 145, 18, 145, 127, '#e7dcc0', 0.4),
      ]),
      text('Hallo', 14, 28, 117, 8, 'WIR FREUEN UNS', { f: 'Josefin Sans', s: 8, w: 700, c: GOLD, a: 'center', ls: 0.3, min: 6 }),
      text('Name', 10, 38, 125, 26, '{{Name}}', { f: 'Cormorant Garamond', s: 48, w: 500, i: true, c: NAVY, a: 'center', min: 18 }),
      text('Text', 18, 70, 109, 24, 'ist geboren und macht uns\nzu einer Familie mit Herz.', { f: 'Cormorant Garamond', s: 13.5, w: 600, c: INK, a: 'center', wrap: true, v: 'top', lh: 1.4, min: 8 }),
      text('Eltern', 14, 104, 117, 14, 'In Liebe\n' + PARENTS, { f: 'Josefin Sans', s: 8.5, w: 600, c: INK, a: 'center', wrap: true, v: 'top', lh: 1.5, ls: 0.04, min: 6 }),
      ...stat(163, 'calendar-heart', 'Geboren', 'Datum'), ...stat(204, 'scale', 'Gewicht', 'Gewicht'), ...stat(245, 'ruler', 'Größe', 'Groesse'),
    ], NAVY, CREAM),
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ Hallo Welt
const hallo = (() => {
  const PEACH = '#ffd9bf'; const TEAL = '#2a8c82'; const INK = '#33403f'; const BG = '#fff7ec';
  const chip = (x, iconName, key, label) => [
    rect('Chip ' + label, x, 74, 38, 22, '#ffffff', { radius: 11, stroke: '#f0d6c0', sw: 0.5, locked: true }),
    icon('Symbol ' + label, iconName, x + 4, 79.5, 11, TEAL, 1.7, { locked: true }),
    text('Wert ' + label, x + 15.5, 75.5, 21, 10, '{{' + key + '}}', { f: 'Fredoka', s: 9, w: 600, c: INK, a: 'left', min: 5.5 }),
    text('Etikett ' + label, x + 15.5, 85, 21, 6, label, { f: 'Nunito', s: 6.5, w: 700, c: TEAL, a: 'left', min: 5, up: true, ls: 0.1 }),
  ];
  return Object.assign({}, base, {
    slug: 'geburtsanzeige-hallo-welt',
    name: 'Geburtsanzeige – Hallo Welt',
    description: 'Fröhliche Geburtskarte (A6 quer): großer Name in runder Schrift, Fußspuren, Wolken und drei Kästchen für Datum, Gewicht und Größe. Alle Angaben sind Felder.',
    variant: 'Hallo Welt',
    tags: tags('Hallo Welt', 'Fußspuren', 'Fröhlich', 'Modern', 'Pfirsich', 'Türkis', 'Neutral'),
    formatKey: 'a6-landscape', width: 148, height: 105,
    pages: [page(BG, [
      decor([
        ellipse('Kreis', -26, -34, 96, 96, PEACH), ellipse('Kreis klein', 112, 66, 56, 56, '#c9ebe4'),
        ...cloud('Wolke', 110, 8, 28, '#ffffff'),
        icon('Fuß 1', 'footprints', 14, 14, 18, '#ffffff', 1.6, { rotation: -14 }),
        icon('Fuß 2', 'footprints', 124, 49, 14, '#7cc4b8', 1.6, { rotation: 14 }),
      ]),
      text('Hallo', 38, 12, 100, 14, 'Hallo Welt, ich bin', { f: 'Fredoka', s: 18, w: 500, c: TEAL, a: 'left', min: 10 }),
      text('Name', 10, 26, 128, 30, '{{Name}}!', { f: 'Fredoka', s: 52, w: 700, c: INK, a: 'left', min: 20 }),
      text('Text', 10, 57, 128, 12, 'Wir sind überglücklich über unser kleines Wunder.', { f: 'Nunito', s: 10.5, w: 700, c: INK, a: 'left', min: 7 }),
      ...chip(10, 'calendar-heart', 'Datum', 'Geboren'), ...chip(54, 'scale', 'Gewicht', 'Gewicht'), ...chip(98, 'ruler', 'Groesse', 'Größe'),
      text('Eltern', 10, 98, 128, 5, 'Anna und Tom Mustermann · Musterweg 5 · 12345 Musterstadt', { f: 'Nunito', s: 7.5, w: 600, c: TEAL, a: 'left', min: 5.5 }),
    ])],
  });
})();

module.exports = { templates: [kranz, stern, hallo] };
