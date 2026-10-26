'use strict';
/* Family: Weihnachtsfeier (Firma, Verein). Variants: Tannengrün (DIN lang), Winternacht (Plakat A3), Gemütlich (A6 quer). The host (company, club) is a field. */
const D = require('./dsl');
const { decor, scatter, cloud, infoRow } = require('./_t2b-lib');
const { text, rect, ellipse, shape, icon, deko, dekoIn, page, gradient, field, line, shadow } = D;

const fields = [field('Firma', 'Firma oder Verein', 'text', 'Mustermann GmbH')];
const sampleRows = [{ Firma: 'Mustermann GmbH' }, { Firma: 'Turn- und Sportverein Oberhausen-Niederweiler 1897 e. V.' }, { Firma: 'Kita Sonnenschein' }];
const base = { category: 'Einladungen', family: 'weihnachtsfeier', familyName: 'Weihnachtsfeier', occasion: 'Feiertage', unit: 'mm', fields, sampleRows };
const tags = (...more) => require('./_t2b-lib').dedupe(['Weihnachtsfeier', 'Weihnachten', 'Advent', 'Firmenfeier', 'Vereinsfeier', 'Einladung', 'Weihnachtsmarkt', 'Jahresabschluss', 'Dezember', ...more]);
const GOLD = '#e6c06a'; const RED = '#c8372d';

// ------------------------------------------------------------------------------------------------------------------------ Tannengrün
const tanne = (() => {
  const bauble = (name, cx, y, d, color) => [line(name + ' Faden', cx, y - 8, cx, y + 1, GOLD, 0.4), rect(name + ' Kappe', cx - d * 0.18, y, d * 0.36, d * 0.14, GOLD), ellipse(name, cx - d / 2, y + d * 0.1, d, d, color), ellipse(name + ' Glanz', cx - d * 0.28, y + d * 0.27, d * 0.2, d * 0.28, '#ffffff', { opacity: 0.35 })];
  return Object.assign({}, base, {
    slug: 'weihnachtsfeier-tanne',
    name: 'Weihnachtsfeier – Tannengrün',
    description: 'Festliche Einladung zur Weihnachtsfeier (DIN lang hoch) in Tannengrün und Gold mit Zweigen, Kugeln und Sternen. Firma oder Verein ist ein Feld, Termin und Ort trägst du ein.',
    variant: 'Tannengrün',
    tags: tags('Tanne', 'Grün', 'Gold', 'Kugeln', 'Klassisch', 'Festlich', 'Tannenzweig'),
    formatKey: 'din-lang-portrait', width: 99, height: 210,
    pages: [page(gradient(180, '#143f30', '#0a271e'), [
      decor([
        deko('Zweig oben', 'deko-blumen-tannenzweig-salbei', 4, -4, 96),
        ...bauble('Kugel 1', 22, 26, 13, RED), ...bauble('Kugel 2', 56, 30, 10, GOLD), ...bauble('Kugel 3', 78, 24, 14, '#ffffff'),
        deko('Stern', 'deko-sterne-stern-gold', 41.5, 56, 16),
        deko('Funkeln', 'deko-sterne-funkeln-gold', 12, 62, 10), deko('Funkeln 2', 'deko-sterne-funkeln-gold', 78, 58, 9),
        deko('Zweig unten', 'deko-blumen-tannenzweig-salbei', -4, 168, 96, undefined, { flipY: true, flipX: true }),
        deko('Trenner', 'deko-trenner-sterne-gold', 24, 138, 51),
      ]),
      text('Kopf', 10, 80, 79, 7, 'WIR LADEN EIN ZUR', { f: 'Cinzel', s: 8.5, w: 400, c: GOLD, a: 'center', ls: 0.2, min: 6 }),
      text('Titel', 4, 88, 91, 24, 'Weihnachts-\nfeier', { f: 'Playfair Display', s: 30, w: 600, i: true, c: '#ffffff', a: 'center', wrap: true, lh: 1.05, min: 14 }),
      text('Firma', 10, 118, 79, 16, '{{Firma}}', { f: 'Cormorant Garamond', s: 14, w: 700, c: GOLD, a: 'center', wrap: true, lh: 1.15, min: 8 }),
      text('Datum', 8, 146, 83, 8, 'Freitag, 17. Dezember 2027', { f: 'Cinzel', s: 10, w: 400, c: '#ffffff', a: 'center', min: 6.5 }),
      text('Zeit', 8, 155, 83, 7, 'ab 18 Uhr · Gasthof Zur Linde', { f: 'Cormorant Garamond', s: 12, w: 600, c: '#e9f1ea', a: 'center', min: 7 }),
      text('Zusage', 8, 163, 83, 6, 'Anmeldung bis 3. Dezember: 0170 1234567', { f: 'Cormorant Garamond', s: 9.5, w: 600, i: true, c: GOLD, a: 'center', min: 6.5 }),
    ])],
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ Winternacht
const winter = (() => {
  const row = (n, y, iconName, title, sub) => [
    ellipse('Chip ' + n, 24, y, 22, 22, '#ffffff', { opacity: 0.14, locked: true }),
    icon('Symbol ' + n, iconName, 29, y + 5, 12, GOLD, 1.7, { locked: true }),
    text('Programm ' + n, 54, y - 1, 210, 14, title, { f: 'Oswald', s: 19, w: 500, c: '#ffffff', a: 'left', ls: 0.04, min: 10 }),
    text('Programm Text ' + n, 54, y + 12, 210, 10, sub, { f: 'Montserrat', s: 11, w: 500, c: '#c9d6ff', a: 'left', min: 7 }),
  ];
  return Object.assign({}, base, {
    slug: 'weihnachtsfeier-winternacht',
    name: 'Weihnachtsfeier – Winternacht',
    description: 'Plakat A3 hoch für die Weihnachtsfeier von Firma oder Verein: Nachtblau mit Schneeflocken, große Schrift in Weiß und Gold und Programmpunkte mit Symbolen. Die Firma ist ein Feld.',
    variant: 'Winternacht',
    category: 'Poster',
    tags: tags('Winter', 'Schnee', 'Plakat', 'Poster', 'A3', 'Aushang', 'Blau', 'Schneeflocken'),
    formatKey: 'poster-a3-portrait', width: 297, height: 420,
    pages: [page(gradient(170, '#0c1638', '#27418a'), [
      decor([
        deko('Sterne', 'deko-sterne-himmel-weiss', 0, 0, 297, undefined, { opacity: 0.2 }),
        deko('Flocke 1', 'deko-sterne-schneeflocke-1-weiss', 214, 20, 66), deko('Flocke 2', 'deko-sterne-schneeflocke-3-weiss', 24, 14, 40, undefined, { opacity: 0.8 }),
        deko('Flocke 3', 'deko-sterne-schneeflocke-2-weiss', 140, 38, 30, undefined, { opacity: 0.7 }), deko('Flocke 4', 'deko-sterne-schneeflocke-1-weiss', 250, 78, 24, undefined, { opacity: 0.6 }),
        deko('Flocke 5', 'deko-sterne-schneeflocke-3-weiss', 254, 346, 32, undefined, { opacity: 0.55 }),
        line('Linie', 24, 200, 273, 200, GOLD, 0.8),
      ]),
      text('Kopf', 24, 92, 249, 16, 'IHR SEID EINGELADEN', { f: 'Oswald', s: 22, w: 500, c: GOLD, a: 'left', ls: 0.35, min: 11 }),
      text('Titel', 18, 106, 262, 58, 'WEIHNACHTSFEIER', { f: 'Anton', s: 108, c: '#ffffff', a: 'left', lh: 1.1, min: 30 }),
      text('Firma', 24, 168, 249, 26, '{{Firma}}', { f: 'Playfair Display', s: 28, w: 500, i: true, c: GOLD, a: 'left', min: 12 }),
      ...row(1, 214, 'utensils', 'Festessen vom Buffet', 'ab 18 Uhr im großen Saal'),
      ...row(2, 244, 'music', 'Musik und Tanz', 'mit der Hausband bis Mitternacht'),
      ...row(3, 274, 'gift', 'Wichteln', 'bitte ein Geschenk bis 10 Euro mitbringen'),
      ...row(4, 304, 'sparkles', 'Überraschungsgast', 'lasst euch überraschen'),
      text('Datum', 24, 352, 249, 20, 'Freitag, 17. Dezember 2027 · 18 Uhr', { f: 'Oswald', s: 26, w: 600, c: '#ffffff', a: 'left', min: 12 }),
      text('Ort', 24, 374, 249, 14, 'Gasthof Zur Linde · Musterstraße 1 · Musterstadt', { f: 'Montserrat', s: 14, w: 500, c: '#c9d6ff', a: 'left', min: 8 }),
      text('Zusage', 24, 392, 249, 12, 'Anmeldung bis 3. Dezember bei Frau Muster: 0170 1234567', { f: 'Montserrat', s: 12, w: 600, c: GOLD, a: 'left', min: 8 }),
    ])],
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ Gemütlich
const gemuetlich = (() => {
  const CREAM = '#fff6e6'; const INK = '#3b2a20'; const GREEN = '#2f6b4a';
  return Object.assign({}, base, {
    slug: 'weihnachtsfeier-gemuetlich',
    name: 'Weihnachtsfeier – Gemütlich',
    description: 'Warme Einladung zur Weihnachtsfeier (A6 quer) in Rot, Creme und Grün mit Zuckerstange, Geschenk und Tannenzweigen in Kaushan-Schrift. Firma oder Verein ist ein Feld.',
    variant: 'Gemütlich',
    tags: tags('Gemütlich', 'Rot', 'Creme', 'Zuckerstange', 'Geschenk', 'Familiär', 'Verein', 'Kaffee'),
    formatKey: 'a6-landscape', width: 148, height: 105,
    pages: [page(CREAM, [
      decor([
        rect('Band', 0, 0, 148, 12, RED),
        deko('Zweig links', 'deko-blumen-tannenzweig-salbei', -6, 80, 60),
        deko('Zweig rechts', 'deko-blumen-tannenzweig-salbei', 96, 80, 60, undefined, { flipX: true }),
        icon('Zuckerstange', 'candy-cane', 5, 22, 20, RED, 1.8, { rotation: -12 }),
        icon('Geschenk', 'gift', 123, 22, 20, GREEN, 1.8, { rotation: 10 }),
        deko('Funkeln', 'deko-sterne-funkeln-gold', 14, 50, 9), deko('Funkeln 2', 'deko-sterne-funkeln-gold', 126, 52, 8),
        ...scatter('Punkte', 4, [6, 14, 136, 60], { n: 8, colors: [RED, GREEN, '#e6c06a'], kinds: ['dot', 'star'], size: [1.6, 2.6], avoid: [[10, 14, 128, 58]], pad: 0.5 }),
      ]),
      text('Kopf', 36, 18, 76, 7, 'WIR LADEN EIN ZUR', { f: 'Montserrat', s: 8, w: 700, c: GREEN, a: 'center', ls: 0.25, min: 6 }),
      text('Titel', 26, 25, 96, 22, 'Weihnachtsfeier', { f: 'Kaushan Script', s: 34, c: RED, a: 'center', min: 18 }),
      text('Firma', 22, 47, 104, 10, 'der {{Firma}}', { f: 'Lora', s: 12, w: 600, i: true, c: INK, a: 'center', min: 6.5 }),
      text('Datum', 20, 60, 108, 8, 'Freitag, 17. Dezember 2027 · 18 Uhr', { f: 'Montserrat', s: 10.5, w: 700, c: INK, a: 'center', min: 7 }),
      text('Ort', 20, 68, 108, 7, 'Gasthof Zur Linde, Musterstraße 1', { f: 'Montserrat', s: 9.5, w: 500, c: INK, a: 'center', min: 6.5 }),
      text('Zusage', 20, 75, 108, 6, 'Anmeldung bis 3. Dezember: 0170 1234567', { f: 'Montserrat', s: 8, w: 600, c: GREEN, a: 'center', min: 6 }),
    ])],
  });
})();

module.exports = { templates: [tanne, winter, gemuetlich] };
