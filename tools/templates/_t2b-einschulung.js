'use strict';
/* Family: Einschulung (Einladung zur Schulanfangsfeier). Variants: Schultüte, Tafel, Modern. The name of the child is a field. */
const D = require('./dsl');
const { decor, scatter, cloud, infoRow } = require('./_t2b-lib');
const { text, rect, ellipse, shape, icon, deko, page, gradient, field, line } = D;

const fields = [field('Name', 'Name', 'text', 'Ben')];
const sampleRows = [{ Name: 'Ben' }, { Name: 'Emilia-Sophie' }, { Name: 'Jo' }];
const base = { category: 'Einladungen', family: 'einschulung', familyName: 'Einschulung', occasion: 'Kinder & Familie', unit: 'mm', fields, sampleRows };
const tags = (...more) => require('./_t2b-lib').dedupe(['Einschulung', 'Schulanfang', 'Schulstart', 'Schulkind', 'Einladung', 'Erster Schultag', 'Schule', ...more]);
const DATE = 'Samstag, 7. August 2027 · 10 Uhr';
const PLACE = 'Aula der Grundschule am Park';
const AFTER = 'Danach Kaffee und Kuchen bei uns';

// ------------------------------------------------------------------------------------------------------------------------ Schultüte
const tuete = (() => {
  const PINK = '#ff7aa8'; const BLUE = '#3f7fe6'; const CONE = '#5b6fe0'; const YEL = '#ffc93c'; const INK = '#2d3157';
  const cone = (() => {
    const out = [shape('triangle', 'Tüte', 29, 22, 47, 54, CONE, { flipY: true })];
    // polka dots inside the cone (half width at a given y: 23.5 * (1 - (y - 22) / 54))
    [[40, 34], [52, 33], [64, 34], [46, 45], [58, 45], [52, 57], [52, 68]].forEach(([cx, cy], i) => {
      const half = 23.5 * (1 - (cy - 22) / 54);
      if (Math.abs(cx - 52.5) + 3 < half) out.push(shape('star', 'Stern ' + (i + 1), cx - 3, cy - 3, 6, 6, '#ffffff', { points: 5, inner: 0.45, rotation: i * 20, opacity: 0.9 }));
    });
    return out;
  })();
  return Object.assign({}, base, {
    slug: 'einschulung-schultuete',
    name: 'Einschulung – Schultüte',
    description: 'Einladung zur Einschulungsfeier (A6 hoch) mit bunter Schultüte, Stiften und Sternen. Der Name des Schulkinds ist ein Feld, Termin und Ort schreibst du direkt hinein.',
    variant: 'Schultüte',
    tags: tags('Schultüte', 'Zuckertüte', 'Bunt', 'Kinder'),
    formatKey: 'a6-portrait', width: 105, height: 148,
    pages: [page(gradient(180, '#e6f4ff', '#fff4d9'), [
      decor([
        ...scatter('Konfetti', 21, [4, 4, 97, 100], { n: 14, colors: [PINK, BLUE, YEL, '#3fc7a8'], size: [2, 3.6], avoid: [[22, 4, 62, 76], [6, 78, 93, 62]], pad: 1 }),
        ...cone,
        ...[0, 1, 2, 3, 4, 5].map(i => ellipse('Papier ' + i, 27 + i * 8.4, 14, 11, 11, i % 2 ? PINK : YEL)),
        rect('Papier Boden', 28, 19, 49, 4, YEL),
        rect('Band', 28, 21, 49, 6.5, PINK, { radius: 3 }),
        shape('triangle', 'Schleife links', 36, 21, 10, 8, '#ff5d73', { rotation: -90 }), shape('triangle', 'Schleife rechts', 59, 21, 10, 8, '#ff5d73', { rotation: 90 }), ellipse('Schleife Mitte', 49.5, 21.5, 6, 6, '#e63e5a'),
        shape('star', 'Stern', 41, 3, 11, 11, '#ff5d73', { points: 5, inner: 0.45, rotation: 12 }),
        icon('Stift', 'pencil', 55, 1, 15, '#3fc7a8', 2, { rotation: 22 }),
        icon('Bonbon', 'candy', 33, 5, 10, '#9b6bff', 2, { rotation: -20 }),
      ]),
      text('Titel', 6, 79, 93, 24, '{{Name}} kommt\nin die Schule!', { f: 'Fredoka', s: 24, w: 700, c: INK, a: 'center', wrap: true, lh: 1.1, min: 12 }),
      text('Einladung', 8, 104, 89, 6, 'Wir laden dich herzlich zur Feier ein.', { f: 'Patrick Hand', s: 11.5, c: INK, a: 'center', min: 8 }),
      ...infoRow('Datum', 13, 114, 82, 'calendar-days', DATE, { chip: BLUE, ic: '#ffffff', c: INK, s: 9.5, w: 700 }),
      ...infoRow('Ort', 13, 124, 82, 'map-pin', PLACE, { chip: BLUE, ic: '#ffffff', c: INK, s: 9.5, w: 700 }),
      ...infoRow('Danach', 13, 134, 82, 'cake-slice', AFTER, { chip: BLUE, ic: '#ffffff', c: INK, s: 9.5, w: 700 }),
    ])],
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ Tafel
const tafel = (() => {
  const BOARD = '#2f5d50'; const WOOD = '#a8743e'; const WOOD2 = '#8b5c2e'; const CHALK = '#f5f3e8'; const YEL = '#ffe27a'; const PINK = '#ffb3c7';
  return Object.assign({}, base, {
    slug: 'einschulung-tafel',
    name: 'Einschulung – Tafel',
    description: 'Einladung zur Einschulung (A6 quer) auf einer Schultafel mit Kreide-Schrift, Schulranzen und Stiften. Der Name des Schulkinds ist ein Feld.',
    variant: 'Tafel',
    tags: tags('Tafel', 'Kreide', 'Schulranzen', 'Klassisch', 'Schultafel'),
    formatKey: 'a6-landscape', width: 148, height: 105,
    pages: [page(WOOD, [
      decor([
        rect('Rahmen innen', 3, 3, 142, 99, WOOD2, { radius: 2 }),
        rect('Tafel', 5.5, 5.5, 137, 88, BOARD, { radius: 1 }),
        rect('Ablage', 3, 94, 142, 8, WOOD2),
        rect('Kreide 1', 20, 95.5, 14, 3.4, CHALK, { radius: 1.2 }), rect('Kreide 2', 38, 96, 10, 3.4, PINK, { radius: 1.2, rotation: 8 }), rect('Schwamm', 112, 94.8, 16, 5, '#e7c75f', { radius: 1.5 }),
        icon('Ranzen', 'backpack', 12, 14, 28, CHALK, 1.4, { rotation: -6 }),
        icon('Stift', 'pencil', 115, 12, 14, YEL, 1.6, { rotation: 20 }),
        icon('Lineal', 'ruler', 129, 17, 10, PINK, 1.6, { rotation: -20 }),
        icon('Buch', 'book-open', 14, 62, 16, YEL, 1.5),
        shape('star', 'Stern', 119, 63, 10, 10, YEL, { points: 5, inner: 0.45, rotation: 10, opacity: 0.9 }),
        line('Unterstrich', 48, 33, 132, 33, CHALK, 0.7, { dash: 'dashed', opacity: 0.7 }),
      ]),
      text('Titel', 44, 11, 66, 20, 'Endlich Schulkind!', { f: 'Gochi Hand', s: 28, c: '#ffffff', a: 'left', min: 14 }),
      text('Name', 44, 36, 96, 12, '{{Name}} wird eingeschult.', { f: 'Patrick Hand', s: 19, c: YEL, a: 'left', min: 10 }),
      text('Einladung', 44, 49, 96, 7, 'Feiere mit uns den ersten Schultag:', { f: 'Patrick Hand', s: 12.5, c: CHALK, a: 'left', min: 8 }),
      ...infoRow('Datum', 44, 58, 96, 'calendar-days', DATE, { chip: null, ic: YEL, c: '#ffffff', f: 'Patrick Hand', s: 12.5, w: 400, d: 7 }),
      ...infoRow('Ort', 44, 66.5, 96, 'map-pin', PLACE, { chip: null, ic: YEL, c: '#ffffff', f: 'Patrick Hand', s: 12.5, w: 400, d: 7 }),
      ...infoRow('Danach', 44, 75, 96, 'cake-slice', AFTER, { chip: null, ic: YEL, c: '#ffffff', f: 'Patrick Hand', s: 12.5, w: 400, d: 7 }),
    ])],
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ Modern
const modern = (() => {
  const INK = '#2b3a4a'; const CREAM = '#fbf3e8'; const CORAL = '#e8725a'; const GOLD = '#d9a441';
  return Object.assign({}, base, {
    slug: 'einschulung-modern',
    name: 'Einschulung – Modern',
    description: 'Ruhige, moderne Einladung zur Einschulung (DIN lang hoch) mit Bogen, Schulranzen-Symbol und klarer Schrift in Creme und Koralle. Name als Feld.',
    variant: 'Modern',
    tags: tags('Modern', 'Minimal', 'Bogen', 'Boho', 'Creme', 'Schulranzen'),
    formatKey: 'din-lang-portrait', width: 99, height: 210,
    pages: [page(CREAM, [
      decor([
        deko('Bogen', 'deko-formen-bogen-rose', 18, 14, 63),
        deko('Regenbogen', 'deko-formen-regenbogen-boho', 31.5, 76, 36),
        icon('Ranzen', 'backpack', 36, 38, 27, CREAM, 1.5),
        deko('Funkeln 1', 'deko-sterne-funkeln-gold', 7, 24, 11),
        deko('Funkeln 2', 'deko-sterne-funkeln-gold', 84, 52, 8),
        deko('Blob', 'deko-formen-blob-3-salbei', 74, 100, 46, undefined, { opacity: 0.35 }),
        line('Trenner 1', 38, 136.5, 61, 136.5, GOLD, 0.6),
        line('Trenner 2', 38, 171, 61, 171, GOLD, 0.6),
      ]),
      text('Hallo', 8, 100, 83, 8, 'HALLO SCHULE!', { f: 'Poppins', s: 11, w: 600, c: CORAL, a: 'center', ls: 0.3, min: 7 }),
      text('Name', 6, 108, 87, 14, '{{Name}}', { f: 'Poppins', s: 32, w: 700, c: INK, a: 'center', min: 14, lh: 1.2 }),
      text('wird Schulkind', 8, 124.5, 83, 9, 'wird Schulkind', { f: 'Raleway', s: 17, w: 500, c: INK, a: 'center', min: 9 }),
      text('Einladung', 10, 138, 79, 20, 'Zur Feier der Einschulung\nlädt die Familie herzlich ein.', { f: 'Raleway', s: 10.5, w: 500, c: INK, a: 'center', wrap: true, v: 'top', lh: 1.4, min: 8 }),
      text('Datum', 8, 157, 83, 11, 'Samstag,\n7. August 2027 · 10 Uhr', { f: 'Raleway', s: 11, w: 700, c: INK, a: 'center', wrap: true, lh: 1.25, min: 8 }),
      text('Ort', 8, 173, 83, 12, 'Aula der Grundschule am Park\nMusterweg 5 · 12345 Musterstadt', { f: 'Raleway', s: 9.5, w: 500, c: INK, a: 'center', wrap: true, v: 'top', lh: 1.4, min: 7 }),
      text('Danach', 8, 189, 83, 8, 'Danach Kaffee und Kuchen', { f: 'Raleway', s: 9.5, w: 600, c: CORAL, a: 'center', min: 7 }),
    ])],
  });
})();

module.exports = { templates: [tuete, tafel, modern] };
