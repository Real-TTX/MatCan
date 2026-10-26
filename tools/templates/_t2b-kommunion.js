'use strict';
/* Family: Kommunion (Einladung zur Ersten Heiligen Kommunion). Variants: Klassisch (A6, Ähren und Gold), Boho (Klappkarte, Bogen), Sonnenstrahl (Postkarte, Kinderschrift). The name is a field. */
const D = require('./dsl');
const { decor, scatter } = require('./_t2b-lib');
const { text, rect, ellipse, shape, icon, deko, dekoIn, page, gradient, field, line, foldCard, panels } = D;

const fields = [field('Name', 'Name', 'text', 'Paul')];
const sampleRows = [{ Name: 'Paul' }, { Name: 'Marie-Theres' }, { Name: 'Jo' }];
const base = { category: 'Einladungen', family: 'kommunion-einladung', familyName: 'Kommunion – Einladung', occasion: 'Kinder & Familie', unit: 'mm', fields, sampleRows };
const tags = (...more) => require('./_t2b-lib').dedupe(['Kommunion', 'Erstkommunion', 'Heilige Kommunion', 'Einladung', 'Kirche', 'Familie', 'Glaube', ...more]);
const DATE = 'Sonntag, 25. April 2027';
const TIME = '10 Uhr';
const CHURCH = 'Kirche St. Martin, Musterstadt';
const FEIER = 'Wir feiern anschließend im Gasthof Zur Linde.';
const RSVP = 'Bitte um Antwort bis 10. April: 0170 1234567';

// ------------------------------------------------------------------------------------------------------------------------ Klassisch
const klassisch = (() => {
  const IVORY = '#fcf8ef'; const GOLD = '#b8893a'; const INK = '#463d33';
  return Object.assign({}, base, {
    slug: 'kommunion-klassisch',
    name: 'Kommunion – Klassisch',
    description: 'Festliche Einladung zur Ersten Heiligen Kommunion (A6 hoch) in Elfenbein und Gold mit Rahmen, Weizenähren und Schreibschrift. Der Name ist ein Feld.',
    variant: 'Klassisch',
    tags: tags('Klassisch', 'Gold', 'Weizen', 'Ähren', 'Schreibschrift', 'Festlich'),
    formatKey: 'a6-portrait', width: 105, height: 148,
    pages: [page(IVORY, [
      decor([
        dekoIn('Rahmen', 'deko-rahmen-doppellinie-hoch-gold', 5, 5, 95, 138),
        icon('Kreuz', 'cross', 47, 14, 11, GOLD, 1.5),
        deko('Ähren links', 'deko-blumen-weizenaehren-gold', 11, 100, undefined, 36),
        deko('Ähren rechts', 'deko-blumen-weizenaehren-gold', 73, 100, undefined, 36, { flipX: true }),
        deko('Trenner', 'deko-trenner-schnoerkel-gold', 30, 72, 45),
      ]),
      text('Kopf', 12, 29, 81, 12, 'ZUR ERSTEN\nHEILIGEN KOMMUNION', { f: 'Cinzel', s: 8.5, w: 400, c: GOLD, a: 'center', ls: 0.14, wrap: true, lh: 1.5, min: 6 }),
      text('Name', 10, 43, 85, 22, '{{Name}}', { f: 'Great Vibes', s: 42, c: INK, a: 'center', min: 16 }),
      text('Einladung', 12, 64, 81, 7, 'laden wir herzlich ein', { f: 'Cormorant Garamond', s: 12.5, w: 600, i: true, c: INK, a: 'center', min: 8 }),
      text('Datum', 14, 78, 77, 8, DATE, { f: 'Cormorant Garamond', s: 15, w: 700, c: INK, a: 'center', min: 9 }),
      text('Zeit', 14, 86, 77, 7, 'um ' + TIME, { f: 'Cormorant Garamond', s: 13, w: 600, c: INK, a: 'center', min: 8 }),
      text('Kirche', 14, 94, 77, 6, CHURCH, { f: 'Cormorant Garamond', s: 11, w: 600, i: true, c: INK, a: 'center', min: 7 }),
      text('Feier', 37, 104, 31, 16, FEIER, { f: 'Cormorant Garamond', s: 9.5, w: 600, c: INK, a: 'center', wrap: true, v: 'top', lh: 1.3, min: 7 }),
      text('Zusage', 37, 121, 31, 12, RSVP, { f: 'Cormorant Garamond', s: 8.5, w: 600, c: GOLD, a: 'center', wrap: true, v: 'top', lh: 1.3, min: 6.5 }),
    ])],
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ Boho
const boho = (() => {
  const BLUSH = '#f6ebe2'; const CLAY = '#d1967e'; const BROWN = '#5b3a2e'; const SAGE = '#7d9378';
  const [back, front] = panels(210, 148, 'vertical', 4);
  return Object.assign({}, base, {
    slug: 'kommunion-boho',
    name: 'Kommunion – Boho',
    description: 'Klappkarte A6 hoch (2 Seiten) zur Kommunion im Boho-Stil: Doppelbogen in Terrakotta, Kerzenflamme, Pampasgrün und klare Schrift. Name als Feld.',
    variant: 'Boho',
    tags: tags('Boho', 'Bogen', 'Terrakotta', 'Modern', 'Klappkarte', 'Kerze'),
    formatKey: 'card-a6-portrait', width: 210, height: 148, fold: 'vertical',
    pages: foldCard('vertical', [
      decor([deko('Zweig', 'deko-blumen-olivenzweig-salbei', 20, 54, 65)]),
      text('Rückseite', 8, 86, 89, 14, 'Familie Mustermann\nMusterweg 5 · 12345 Musterstadt', { f: 'Josefin Sans', s: 8, w: 400, c: BROWN, a: 'center', wrap: true, v: 'top', lh: 1.5, ls: 0.04, min: 6 }),
      decor([
        deko('Bogen', 'deko-formen-bogen-doppelt-rose', 135.5, 10, 44),
        icon('Flamme', 'flame', 150, 26, 15, '#ffffff', 1.5),
      ]),
      text('Kommunion', 110, 74, 90, 12, 'KOMMUNION', { f: 'Josefin Sans', s: 17, w: 400, c: BROWN, a: 'center', ls: 0.35, min: 9 }),
      text('Name', 112, 88, 86, 20, '{{Name}}', { f: 'Cormorant Garamond', s: 36, w: 500, i: true, c: CLAY, a: 'center', min: 14 }),
      text('Datum vorn', 112, 114, 86, 7, '25. 04. 2027', { f: 'Josefin Sans', s: 10, w: 600, c: BROWN, a: 'center', ls: 0.25, min: 6 }),
    ], [
      decor([deko('Zweig innen', 'deko-ecken-eukalyptus-salbei', 4, 4, 30), deko('Zweig innen unten', 'deko-ecken-eukalyptus-salbei', 176, 114, 30, undefined, { flipX: true, flipY: true })]),
      text('Titel', 14, 30, 77, 8, 'ERSTE HEILIGE KOMMUNION', { f: 'Josefin Sans', s: 8.5, w: 700, c: CLAY, a: 'center', ls: 0.25, min: 6 }),
      text('Name innen', 12, 40, 81, 20, '{{Name}}', { f: 'Cormorant Garamond', s: 38, w: 500, i: true, c: BROWN, a: 'center', min: 14 }),
      text('Text', 16, 66, 73, 28, 'Wir laden dich ein,\nmit uns diesen besonderen Tag\nzu feiern.', { f: 'Cormorant Garamond', s: 13, w: 500, c: BROWN, a: 'center', wrap: true, v: 'top', lh: 1.4, min: 8 }),
      text('Zusage', 16, 108, 73, 14, RSVP, { f: 'Josefin Sans', s: 8, w: 400, c: BROWN, a: 'center', wrap: true, v: 'top', lh: 1.5, min: 6 }),
      text('Wann', 119, 32, 77, 6, 'WANN', { f: 'Josefin Sans', s: 8, w: 700, c: CLAY, a: 'center', ls: 0.3, min: 6 }),
      text('Datum', 119, 40, 77, 9, DATE, { f: 'Cormorant Garamond', s: 17, w: 600, c: BROWN, a: 'center', min: 9 }),
      text('Zeit', 119, 50, 77, 7, 'um ' + TIME, { f: 'Cormorant Garamond', s: 14, w: 500, c: BROWN, a: 'center', min: 8 }),
      line('Linie', 143, 66, 173, 66, SAGE, 0.5),
      text('Wo', 119, 72, 77, 6, 'WO', { f: 'Josefin Sans', s: 8, w: 700, c: CLAY, a: 'center', ls: 0.3, min: 6 }),
      text('Kirche', 119, 80, 77, 9, CHURCH, { f: 'Cormorant Garamond', s: 14, w: 500, c: BROWN, a: 'center', min: 8 }),
      text('Feier', 125, 98, 65, 14, FEIER, { f: 'Cormorant Garamond', s: 12, w: 500, i: true, c: BROWN, a: 'center', wrap: true, v: 'top', lh: 1.35, min: 8 }),
    ], BLUSH),
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ Sonnenstrahl
const sonne = (() => {
  const SUN = '#ffd24a'; const INK = '#4a3c1e'; const BLUE = '#4c87d6'; const CREAM = '#fffaf0';
  return Object.assign({}, base, {
    slug: 'kommunion-sonnenstrahl',
    name: 'Kommunion – Sonnenstrahl',
    description: 'Fröhliche Einladung zur Kommunion als Postkarte A6 quer (Vorderseite mit Sonne und Taube, Rückseite mit Angaben und Adressfeld). Name als Feld.',
    variant: 'Sonnenstrahl',
    tags: tags('Sonne', 'Taube', 'Postkarte', 'Fröhlich', 'Kinderschrift', 'Bunt', 'Kinder'),
    formatKey: 'postcard-a6-landscape', width: 148, height: 105,
    pages: [
      page(gradient(150, '#fff6cf', '#ffe38a'), [
        decor([
          deko('Strahlen', 'deko-sterne-strahlen-gold', -16, -22, 100),
          ellipse('Sonne', 14, 14, 52, 52, SUN),
          ellipse('Sonne Ring', 17, 17, 46, 46, null, { stroke: '#ffffff', sw: 1.2, opacity: 0.8 }),
          icon('Taube', 'bird', 26, 26, 28, '#ffffff', 1.6),
          deko('Ähren', 'deko-blumen-weizenaehren-gold', 100, 66, undefined, 34),
          ...scatter('Funkeln', 8, [70, 6, 74, 94], { n: 8, colors: ['#ffffff', '#f2a93b', BLUE], kinds: ['spark', 'star', 'dot'], size: [2, 3.6], avoid: [[72, 14, 70, 60]], pad: 1 }),
        ]),
        text('Meine', 72, 14, 70, 11, 'Meine Erste', { f: 'Dancing Script', s: 24, w: 700, c: BLUE, a: 'center', min: 12 }),
        text('Kommunion', 72, 26, 70, 16, 'Kommunion', { f: 'Fredoka', s: 28, w: 700, c: INK, a: 'center', min: 14 }),
        text('Name', 72, 46, 70, 14, '{{Name}}', { f: 'Dancing Script', s: 32, w: 700, c: '#e0793a', a: 'center', min: 14 }),
        text('Gott', 72, 62, 70, 6, 'Du bist herzlich eingeladen!', { f: 'Patrick Hand', s: 12, c: INK, a: 'center', min: 8 }),
      ], 'Vorderseite'),
      page(CREAM, [
        decor([
          line('Trennlinie', 84, 12, 84, 93, '#e6d9b8', 0.5),
          rect('Briefmarke', 118, 10, 20, 24, null, { stroke: '#d8c9a2', sw: 0.5, dash: 'dashed', radius: 1 }),
          line('Adresse 1', 92, 52, 140, 52, '#b8a982', 0.3), line('Adresse 2', 92, 62, 140, 62, '#b8a982', 0.3), line('Adresse 3', 92, 72, 140, 72, '#b8a982', 0.3),
          icon('Sonne klein', 'sun', 10, 10, 9, '#f2a93b', 1.8),
        ]),
        text('Titel', 22, 10, 56, 10, 'Einladung', { f: 'Dancing Script', s: 20, w: 700, c: BLUE, a: 'left', min: 11 }),
        text('Text', 10, 24, 68, 14, 'Wir feiern die Erste Heilige Kommunion von {{Name}}.', { f: 'Nunito', s: 10, w: 700, c: INK, a: 'left', wrap: true, v: 'top', lh: 1.35, min: 7 }),
        text('Datum', 10, 42, 68, 7, DATE, { f: 'Nunito', s: 10, w: 800, c: INK, a: 'left', min: 7 }),
        text('Zeit', 10, 49, 68, 6, 'um ' + TIME + ' · ' + 'Kirche St. Martin', { f: 'Nunito', s: 9, w: 600, c: INK, a: 'left', min: 6.5 }),
        text('Feier', 10, 60, 68, 12, FEIER, { f: 'Nunito', s: 9, w: 600, c: INK, a: 'left', wrap: true, v: 'top', lh: 1.35, min: 6.5 }),
        text('Zusage', 10, 78, 68, 12, RSVP, { f: 'Nunito', s: 8, w: 600, c: '#a0742a', a: 'left', wrap: true, v: 'top', lh: 1.35, min: 6 }),
      ], 'Rückseite'),
    ],
  });
})();

module.exports = { templates: [klassisch, boho, sonne] };
