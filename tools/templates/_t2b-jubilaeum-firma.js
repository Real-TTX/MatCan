'use strict';
/* Family: Firmenjubiläum. Variants: Plakat (A3, große Zahl im Lorbeerkranz), Festakt (DIN lang, Siegel), Instagram (Post). Fields: Jahre, Firma. */
const D = require('./dsl');
const { decor, scatter, infoRow } = require('./_t2b-lib');
const { text, rect, ellipse, shape, icon, deko, dekoIn, page, gradient, field, line, shadow } = D;

const fields = [field('Jahre', 'Jahre', 'text', '25'), field('Firma', 'Firma', 'text', 'Mustermann GmbH')];
const sampleRows = [{ Jahre: '25', Firma: 'Mustermann GmbH' }, { Jahre: '100', Firma: 'Schreinerei Huber & Söhne' }, { Jahre: '10', Firma: 'Bäckerei Korn' }];
const base = { category: 'Poster', family: 'firmenjubilaeum', familyName: 'Firmenjubiläum', occasion: 'Feste & Events', unit: 'mm', fields, sampleRows };
const tags = (...more) => require('./_t2b-lib').dedupe(['Jubiläum', 'Firmenjubiläum', 'Firma', 'Betriebsjubiläum', 'Jahre', 'Feier', 'Festakt', 'Geburtstag der Firma', ...more]);

// ------------------------------------------------------------------------------------------------------------------------ Plakat
const plakat = (() => {
  const NAVY = '#0f1b3d'; const GOLD = '#e0b85c'; const CREAM = '#f7ecd2';
  return Object.assign({}, base, {
    slug: 'firmenjubilaeum-plakat',
    name: 'Firmenjubiläum – Plakat',
    description: 'Plakat A3 hoch zum Firmenjubiläum: eine riesige Jahreszahl im goldenen Lorbeerkranz auf Nachtblau, darunter Firmenname und Termin der Feier. Jahre und Firma sind Felder.',
    variant: 'Plakat',
    tags: tags('Plakat', 'Poster', 'Aushang', 'Gold', 'Lorbeer', 'A3', 'Zahl'),
    formatKey: 'poster-a3-portrait', width: 297, height: 420,
    pages: [page(gradient(170, '#0f1b3d', '#1e3070'), [
      decor([
        deko('Sterne', 'deko-sterne-himmel-gold', 0, 0, 297, undefined, { opacity: 0.35 }),
        deko('Lorbeerkranz', 'deko-blumen-lorbeerkranz-gold', 25, 34, 247),
        shape('star', 'Stern', 134, 46, 29, 29, GOLD, { points: 5, inner: 0.45 }),
        deko('Banderole', 'deko-baender-banderole-gold', 55, 236, 187),
        line('Linie', 40, 358, 257, 358, GOLD, 0.8),
      ]),
      text('Jahre', 55, 100, 187, 130, '{{Jahre}}', { f: 'Anton', s: 250, c: GOLD, a: 'center', lh: 1, min: 80, shadow: shadow('#000000', 0.3, 6, 0, 3) }),
      text('Jahre Wort', 82, 248, 133, 20, 'JAHRE', { f: 'Cinzel', s: 30, w: 700, c: NAVY, a: 'center', ls: 0.4, min: 14 }),
      text('Firma', 24, 296, 249, 34, '{{Firma}}', { f: 'Playfair Display', s: 40, w: 700, c: '#ffffff', a: 'center', min: 18 }),
      text('Wir feiern', 24, 332, 249, 14, 'Wir feiern mit allen, die uns begleitet haben.', { f: 'Cormorant Garamond', s: 21, w: 600, i: true, c: CREAM, a: 'center', min: 12 }),
      text('Datum', 24, 366, 249, 16, 'Festakt am Freitag, 20. September 2027 · 17 Uhr', { f: 'Montserrat', s: 17, w: 600, c: '#ffffff', a: 'center', min: 10 }),
      text('Ort', 24, 384, 249, 12, 'Firmengelände Musterweg 5 · 12345 Musterstadt', { f: 'Montserrat', s: 13, w: 500, c: GOLD, a: 'center', min: 9 }),
      text('Eintritt', 24, 398, 249, 10, 'Der Eintritt ist frei – Anmeldung unter 0170 1234567', { f: 'Montserrat', s: 11, w: 500, c: CREAM, a: 'center', min: 8 }),
    ])],
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ Festakt
const festakt = (() => {
  const NAVY = '#1c2b52'; const GOLD = '#b8893a'; const CREAM = '#fbf6ea';
  return Object.assign({}, base, {
    slug: 'firmenjubilaeum-festakt',
    name: 'Firmenjubiläum – Festakt',
    description: 'Einladung zum Festakt anlässlich eines Firmenjubiläums (DIN lang hoch) in Creme, Marine und Gold mit goldenem Siegel für die Jahreszahl. Jahre und Firma sind Felder.',
    variant: 'Festakt',
    tags: tags('Einladung', 'Festakt', 'Siegel', 'Elegant', 'Creme', 'Geschäftspartner', 'Kunden'),
    category: 'Einladungen',
    formatKey: 'din-lang-portrait', width: 99, height: 210,
    pages: [page(CREAM, [
      decor([
        deko('Ecke', 'deko-ecken-deco-gold', 5, 5, 26), deko('Ecke 2', 'deko-ecken-deco-gold', 68, 5, 26, undefined, { flipX: true }), deko('Ecke 3', 'deko-ecken-deco-gold', 5, 179, 26, undefined, { flipY: true }), deko('Ecke 4', 'deko-ecken-deco-gold', 68, 179, 26, undefined, { flipX: true, flipY: true }),
        ellipse('Siegel', 27.5, 30, 44, 44, gradient(135, '#e0c07a', '#a87a2c')),
        ellipse('Siegel Ring', 30.5, 33, 38, 38, null, { stroke: '#ffffff', sw: 0.8, opacity: 0.85 }),
        deko('Trenner', 'deko-trenner-raute-gold', 24, 146, 51),
      ]),
      text('Jahre', 30, 38, 39, 22, '{{Jahre}}', { f: 'Playfair Display', s: 34, w: 700, c: '#ffffff', a: 'center', min: 12 }),
      text('Jahre Wort', 30, 54, 39, 8, 'JAHRE', { f: 'Cinzel', s: 9, w: 700, c: '#ffffff', a: 'center', ls: 0.2, min: 6 }),
      text('Kopf', 10, 82, 79, 8, 'FESTAKT ZUM JUBILÄUM', { f: 'Cinzel', s: 9, w: 400, c: GOLD, a: 'center', ls: 0.16, min: 6 }),
      text('Firma', 10, 92, 79, 30, '{{Firma}}', { f: 'Playfair Display', s: 24, w: 600, c: NAVY, a: 'center', wrap: true, lh: 1.15, min: 11 }),
      text('Text', 12, 124, 75, 18, 'Wir blicken auf viele gemeinsame Jahre zurück und laden Sie herzlich ein, mit uns zu feiern.', { f: 'Cormorant Garamond', s: 11.5, w: 600, i: true, c: NAVY, a: 'center', wrap: true, v: 'top', lh: 1.35, min: 8 }),
      text('Datum', 12, 154, 75, 8, 'Freitag, 20. September 2027', { f: 'Cinzel', s: 10.5, w: 400, c: NAVY, a: 'center', min: 7 }),
      text('Zeit', 12, 163, 75, 7, 'um 17 Uhr', { f: 'Cormorant Garamond', s: 13, w: 700, c: GOLD, a: 'center', min: 8 }),
      text('Ort', 12, 171, 75, 12, 'Firmengelände\nMusterweg 5 · 12345 Musterstadt', { f: 'Cormorant Garamond', s: 10.5, w: 600, c: NAVY, a: 'center', wrap: true, v: 'top', lh: 1.35, min: 7 }),
      text('Zusage', 12, 186, 75, 6, 'Um Antwort wird gebeten: 0170 1234567', { f: 'Cormorant Garamond', s: 9, w: 600, i: true, c: GOLD, a: 'center', min: 6.5 }),
    ])],
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ Instagram
const insta = (() => {
  const INK = '#1b1442'; const CORAL = '#ff6b5e'; const YEL = '#ffcf4a';
  return Object.assign({}, base, {
    slug: 'firmenjubilaeum-instagram',
    name: 'Firmenjubiläum – Instagram-Post',
    description: 'Jubiläums-Post (1080 x 1080 px) für Instagram, Facebook und LinkedIn: farbiger Verlauf, riesige Jahreszahl, Konfetti und ein Dankeschön an die Kundschaft. Jahre und Firma sind Felder.',
    variant: 'Instagram',
    category: 'Social Media',
    unit: 'px',
    tags: tags('Instagram', 'Social Media', 'LinkedIn', 'Facebook', 'Post', 'Danke', 'Konfetti'),
    formatKey: 'instagram-post', width: 1080, height: 1080,
    pages: [page(gradient(145, '#ff6b5e', '#7b3fe4'), [
      decor([
        deko('Konfetti', 'deko-konfetti-streuung-gold', 0, 0, 1080, undefined, { opacity: 0.55 }),
        ellipse('Kreis', 190, 190, 700, 700, '#ffffff', { opacity: 0.12 }),
        icon('Popper', 'party-popper', 70, 70, 130, YEL, 1.6, { rotation: -10 }),
        icon('Popper 2', 'party-popper', 880, 880, 130, YEL, 1.6, { rotation: 80, flipX: true }),
      ]),
      text('Wir', 100, 150, 880, 80, 'WIR FEIERN', { f: 'Poppins', s: 32, w: 700, c: '#ffffff', a: 'center', ls: 0.3, min: 18 }),
      text('Jahre', 140, 215, 800, 420, '{{Jahre}}', { f: 'Anton', s: 300, c: '#ffffff', a: 'center', lh: 1, min: 90, shadow: shadow(INK, 0.25, 0, 10, 12) }),
      text('Jahre Wort', 140, 635, 800, 100, 'JAHRE', { f: 'Poppins', s: 52, w: 700, c: YEL, a: 'center', ls: 0.4, min: 24 }),
      text('Firma', 100, 760, 880, 90, '{{Firma}}', { f: 'Poppins', s: 40, w: 700, c: '#ffffff', a: 'center', min: 18 }),
      text('Danke', 100, 855, 880, 80, 'Danke für euer Vertrauen!', { f: 'Poppins', s: 28, w: 500, c: '#ffffff', a: 'center', min: 14 }),
    ])],
  });
})();

module.exports = { templates: [plakat, festakt, insta] };
