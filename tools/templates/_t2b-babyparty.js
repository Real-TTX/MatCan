'use strict';
/* Family: Babyparty (Einladung). Variants: Wolkenkind (A6, Pastell), Boho (A5, Regenbogen), Instagram (Post 1080 px, Ballons). The name of the mother-to-be is a field. */
const D = require('./dsl');
const { decor, scatter, cloud, infoRow } = require('./_t2b-lib');
const { text, rect, ellipse, shape, icon, deko, dekoIn, page, gradient, field, line } = D;

const fields = [field('Name', 'Name', 'text', 'Anna')];
const sampleRows = [{ Name: 'Anna' }, { Name: 'Franziska-Marie' }, { Name: 'Jo' }];
const base = { category: 'Einladungen', family: 'babyparty-einladung', familyName: 'Babyparty – Einladung', occasion: 'Kinder & Familie', unit: 'mm', fields, sampleRows };
const tags = (...more) => require('./_t2b-lib').dedupe(['Babyparty', 'Babyshower', 'Baby Shower', 'Einladung', 'Baby', 'Schwangerschaft', 'Party', ...more]);
const DATE = 'Samstag, 22. Mai 2027 · 15 Uhr';
const PLACE = 'Bei Familie Beispiel, Musterweg 5';
const RSVP = 'Zusage bis 8. Mai: 0170 1234567';

// ------------------------------------------------------------------------------------------------------------------------ Wolkenkind
const wolken = (() => {
  const NAVY = '#33507a'; const SUN = '#ffd66b'; const SKY = '#9ccbf0'; const PINK = '#ffb8c9';
  return Object.assign({}, base, {
    slug: 'babyparty-wolkenkind',
    name: 'Babyparty – Wolkenkind',
    description: 'Zarte Einladung zur Babyparty (A6 hoch) mit Wolken, Mond und Sternen in Pastellblau und Gelb. Der Name der werdenden Mama ist ein Feld.',
    variant: 'Wolkenkind',
    tags: tags('Wolken', 'Pastell', 'Mond', 'Sterne', 'Neutral', 'Junge', 'Mädchen'),
    formatKey: 'a6-portrait', width: 105, height: 148,
    pages: [page(gradient(180, '#eaf4fd', '#fff7de'), [
      decor([
        ...scatter('Sterne', 33, [4, 4, 97, 62], { n: 12, colors: [SUN, SKY, PINK], kinds: ['spark', 'star', 'dot'], size: [2, 3.8], avoid: [[16, 12, 73, 52]], pad: 1 }),
        deko('Mond', 'deko-formen-mond-gold', 62, 12, 24),
        ...cloud('Wolke 1', 17, 28, 40, '#ffffff'), ...cloud('Wolke 2', 52, 40, 36, '#ffffff', { opacity: 0.95 }), ...cloud('Wolke 3', 8, 52, 24, '#ffffff', { opacity: 0.9 }),
        icon('Baby', 'baby', 30, 21, 16, SKY, 1.7),
        deko('Funkeln', 'deko-sterne-funkeln-gold', 80, 56, 9),
        ...cloud('Wolke unten', -6, 128, 44, '#ffffff'), ...cloud('Wolke unten 2', 66, 132, 46, '#ffffff'),
      ]),
      text('Baby', 6, 74, 93, 18, 'Babyparty', { f: 'Dancing Script', s: 42, w: 700, c: NAVY, a: 'center', min: 16 }),
      text('für', 8, 91, 89, 7, 'für {{Name}}', { f: 'Nunito', s: 14, w: 800, c: '#4f8fd8', a: 'center', min: 8 }),
      text('Text', 12, 100, 81, 10, 'Der kleine Sonnenschein ist bald da. Feiere mit uns!', { f: 'Nunito', s: 9.5, w: 600, c: NAVY, a: 'center', wrap: true, v: 'top', lh: 1.35, min: 7 }),
      text('Datum', 8, 113, 89, 6, DATE, { f: 'Nunito', s: 10, w: 800, c: NAVY, a: 'center', min: 7 }),
      text('Ort', 8, 119.5, 89, 6, PLACE, { f: 'Nunito', s: 9, w: 600, c: NAVY, a: 'center', min: 7 }),
      text('Zusage', 8, 126, 89, 6, RSVP, { f: 'Nunito', s: 8.5, w: 600, c: '#4f8fd8', a: 'center', min: 6.5 }),
    ])],
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ Boho
const boho = (() => {
  const CREAM = '#f8efe6'; const BROWN = '#5e4234'; const CLAY = '#c98467';
  return Object.assign({}, base, {
    slug: 'babyparty-boho',
    name: 'Babyparty – Boho',
    description: 'Ruhige Boho-Einladung zur Babyparty (A5 hoch) mit Regenbogen in Erdtönen, Schleierkraut und Serifenschrift. Der Name der werdenden Mama ist ein Feld.',
    variant: 'Boho',
    tags: tags('Boho', 'Regenbogen', 'Erdtöne', 'Schleierkraut', 'Natur', 'Modern'),
    formatKey: 'a5-portrait', width: 148, height: 210,
    pages: [page(CREAM, [
      decor([
        deko('Regenbogen', 'deko-formen-regenbogen-boho', 29, 16, 90),
        deko('Schleierkraut links', 'deko-blumen-schleierkraut-gold', 6, 44, 24),
        deko('Schleierkraut rechts', 'deko-blumen-schleierkraut-gold', 118, 44, 24, undefined, { flipX: true }),
        deko('Trenner', 'deko-trenner-punkte-gold', 49, 158, 50),
      ]),
      text('Willkommen', 12, 76, 124, 8, 'WIR FREUEN UNS AUF', { f: 'Josefin Sans', s: 9, w: 600, c: CLAY, a: 'center', ls: 0.3, min: 6 }),
      text('Baby', 10, 86, 128, 18, 'BABYPARTY', { f: 'Josefin Sans', s: 36, w: 300, c: BROWN, a: 'center', ls: 0.22, min: 16 }),
      text('für', 10, 106, 128, 18, 'für {{Name}}', { f: 'Cormorant Garamond', s: 32, w: 500, i: true, c: CLAY, a: 'center', min: 14 }),
      text('Text', 24, 128, 100, 20, 'Ein kleiner Mensch ist unterwegs.\nWir feiern mit Kuchen, Spielen\nund vielen guten Wünschen.', { f: 'Raleway', s: 10.5, w: 500, c: BROWN, a: 'center', wrap: true, v: 'top', lh: 1.45, min: 7 }),
      text('Datum', 14, 167, 120, 8, DATE, { f: 'Raleway', s: 12, w: 700, c: BROWN, a: 'center', min: 8 }),
      text('Ort', 14, 176, 120, 7, PLACE, { f: 'Raleway', s: 10.5, w: 500, c: BROWN, a: 'center', min: 7 }),
      text('Zusage', 14, 188, 120, 6, RSVP, { f: 'Raleway', s: 9, w: 600, c: CLAY, a: 'center', min: 6.5 }),
    ])],
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ Instagram
const insta = (() => {
  const MINT = '#d6f0e4'; const NAVY = '#1f4a5c'; const CORAL = '#ff7a8a'; const YEL = '#ffd66b';
  return Object.assign({}, base, {
    slug: 'babyparty-instagram',
    name: 'Babyparty – Instagram-Post',
    description: 'Digitale Einladung zur Babyparty als Instagram-Post (1080 x 1080 px) mit Pastellballons, Konfetti und runder Schrift. Zum Teilen in Gruppen und Storys. Name als Feld.',
    variant: 'Instagram',
    unit: 'px',
    tags: tags('Instagram', 'Social Media', 'Digital', 'Ballons', 'Mint', 'WhatsApp', 'Post'),
    formatKey: 'instagram-post', width: 1080, height: 1080,
    pages: [page(MINT, [
      decor([
        deko('Konfetti', 'deko-konfetti-streuung-pastell', 0, 0, 1080, undefined, { opacity: 0.5 }),
        ellipse('Kreis', 560, 300, 640, 640, '#ffffff', { opacity: 0.55 }),
        deko('Ballons', 'deko-konfetti-ballons-drei-pastell', 800, 560, undefined, 480),
        deko('Wellen', 'deko-formen-wellenrand-salbei', 0, 920, 1080, undefined, { opacity: 0.0 }),
      ]),
      text('Kopf', 80, 110, 700, 70, 'WIR FEIERN', { f: 'Fredoka', s: 34, w: 600, c: CORAL, a: 'left', ls: 0.2, min: 20 }),
      text('Baby', 80, 180, 900, 190, 'Babyparty', { f: 'Baloo 2', s: 118, w: 800, c: NAVY, a: 'left', min: 50, lh: 1.1 }),
      text('für', 80, 370, 860, 110, 'für {{Name}}', { f: 'Fredoka', s: 62, w: 500, c: CORAL, a: 'left', min: 28 }),
      ...infoRow('Datum', 80, 600, 700, 'calendar-days', 'Samstag, 22. Mai 2027', { chip: NAVY, ic: '#ffffff', c: NAVY, f: 'Nunito', s: 26, w: 800, d: 78 }),
      ...infoRow('Zeit', 80, 700, 700, 'clock', '15 Uhr', { chip: NAVY, ic: '#ffffff', c: NAVY, f: 'Nunito', s: 26, w: 800, d: 78 }),
      ...infoRow('Ort', 80, 800, 700, 'map-pin', 'Musterweg 5, Musterstadt', { chip: NAVY, ic: '#ffffff', c: NAVY, f: 'Nunito', s: 26, w: 800, d: 78 }),
      text('Zusage', 80, 930, 700, 60, 'Sag bis 8. Mai Bescheid!', { f: 'Fredoka', s: 24, w: 500, c: NAVY, a: 'left', min: 14 }),
    ])],
  });
})();

module.exports = { templates: [wolken, boho, insta] };
