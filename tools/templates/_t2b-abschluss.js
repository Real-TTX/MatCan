'use strict';
/* Family: Abschlussfeier (Abitur, Abschluss, Ausbildung). Variants: Abi-Plakat (A3), Festlich (A6), Geschafft (Instagram-Post). Fields: Name, Abschluss. */
const D = require('./dsl');
const { decor, scatter, infoRow } = require('./_t2b-lib');
const { text, rect, ellipse, shape, icon, deko, dekoIn, page, gradient, field, line, shadow } = D;

const fields = [field('Name', 'Name', 'text', 'Jonas'), field('Abschluss', 'Abschluss', 'text', 'Abi 2027')];
const sampleRows = [{ Name: 'Jonas', Abschluss: 'Abi 2027' }, { Name: 'Maximiliane Schneider-Hohenstein', Abschluss: 'Realschulabschluss 2027' }, { Name: 'Jo', Abschluss: 'Gesellenbrief' }];
const base = { category: 'Einladungen', family: 'abschlussfeier', familyName: 'Abschlussfeier', occasion: 'Feste & Events', unit: 'mm', fields, sampleRows };
const tags = (...more) => require('./_t2b-lib').dedupe(['Abschluss', 'Abitur', 'Abi', 'Abschlussfeier', 'Schulabschluss', 'Ausbildung', 'Einladung', 'Feier', 'Geschafft', ...more]);

// ------------------------------------------------------------------------------------------------------------------------ Abi-Plakat
const plakat = (() => {
  const INK = '#101828'; const YEL = '#ffd23f'; const PINK = '#ff4f8b'; const CYAN = '#38d6e8';
  return Object.assign({}, base, {
    slug: 'abschlussfeier-abi-plakat',
    name: 'Abschlussfeier – Abi-Plakat',
    description: 'Plakat A3 hoch für Abi-Party, Abifete oder Abschlussfeier: gewaltige Schrift, bunte Farbblöcke auf Nachtblau und Abschlusshut. Die Bezeichnung des Abschlusses ist ein Feld.',
    variant: 'Abi-Plakat',
    category: 'Poster',
    tags: tags('Plakat', 'Poster', 'A3', 'Abifete', 'Abiparty', 'Abiball', 'Bunt', 'Aushang'),
    formatKey: 'poster-a3-portrait', width: 297, height: 420,
    pages: [page(INK, [
      decor([
        rect('Block Gelb', -30, 250, 240, 90, YEL, { rotation: -8 }),
        rect('Block Pink', 120, 300, 230, 80, PINK, { rotation: -8 }),
        rect('Block Cyan', -40, 336, 200, 44, CYAN, { rotation: -8 }),
        ellipse('Kreis', 200, 30, 120, 120, PINK, { opacity: 0.85 }),
        icon('Hut', 'graduation-cap', 226, 52, 66, '#ffffff', 1.5, { rotation: 12 }),
        shape('star', 'Stern', 30, 38, 22, 22, YEL, { points: 5, inner: 0.45, rotation: 12 }),
        shape('star', 'Stern 2', 266, 196, 12, 12, CYAN, { points: 5, inner: 0.45, rotation: -8 }),
      ]),
      text('Kopf', 24, 70, 190, 18, 'DIE GROSSE', { f: 'Oswald', s: 30, w: 500, c: CYAN, a: 'left', ls: 0.3, min: 14 }),
      text('Abschluss', 20, 90, 262, 110, '{{Abschluss}}', { f: 'Anton', s: 150, c: '#ffffff', a: 'left', up: true, lh: 1.05, min: 36 }),
      text('Party', 24, 204, 250, 40, 'PARTY & ZEUGNISÜBERGABE', { f: 'Oswald', s: 25, w: 500, c: YEL, a: 'left', ls: 0.12, min: 12 }),
      text('Datum', 20, 262, 160, 18, 'Freitag, 25. Juni 2027', { f: 'Anton', s: 28, c: INK, a: 'left', min: 14, rotation: -8 }),
      text('Hinweis', 20, 394, 257, 14, 'Eintritt frei für alle Abiturientinnen und Abiturienten  ·  Gäste 5 €  ·  Musterstadt', { f: 'Oswald', s: 14, w: 400, c: '#ffffff', a: 'left', ls: 0.04, min: 8 }),
    ])],
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ Festlich
const festlich = (() => {
  const NAVY = '#1c2b52'; const GOLD = '#b8893a'; const CREAM = '#fbf7ee';
  return Object.assign({}, base, {
    slug: 'abschlussfeier-festlich',
    name: 'Abschlussfeier – Festlich',
    description: 'Festliche Einladung zur Abschlussfeier (A6 hoch) in Marineblau und Gold mit Lorbeerkranz und Abschlusshut. Name und Abschluss sind Felder.',
    variant: 'Festlich',
    tags: tags('Festlich', 'Lorbeer', 'Gold', 'Marine', 'Elegant', 'Abschlusshut', 'Klassisch'),
    formatKey: 'a6-portrait', width: 105, height: 148,
    pages: [page(NAVY, [
      decor([
        rect('Fläche', 5, 5, 95, 138, null, { stroke: GOLD, sw: 0.6 }),
        deko('Lorbeerkranz', 'deko-blumen-lorbeerkranz-gold', 25, 14, 55),
        icon('Hut', 'graduation-cap', 41, 30, 23, '#ffffff', 1.4),
        deko('Trenner', 'deko-trenner-raute-gold', 27, 107, 51),
      ]),
      text('Kopf', 12, 74, 81, 6, 'WIR FEIERN DEN ABSCHLUSS VON', { f: 'Cinzel', s: 7, w: 400, c: GOLD, a: 'center', ls: 0.12, min: 5 }),
      text('Name', 10, 82, 85, 18, '{{Name}}', { f: 'Great Vibes', s: 36, c: '#ffffff', a: 'center', min: 12 }),
      text('Abschluss', 10, 98, 85, 8, '{{Abschluss}}', { f: 'Cormorant Garamond', s: 14, w: 700, c: GOLD, a: 'center', min: 8, ls: 0.05 }),
      text('Datum', 12, 114, 81, 8, 'Freitag, 25. Juni 2027 · 18 Uhr', { f: 'Cormorant Garamond', s: 12.5, w: 700, c: CREAM, a: 'center', min: 8 }),
      text('Ort', 12, 122, 81, 7, 'Aula am Park, Musterstadt', { f: 'Cormorant Garamond', s: 11, w: 600, i: true, c: CREAM, a: 'center', min: 7 }),
      text('Zusage', 12, 131, 81, 6, 'Zusage bis 11. Juni: 0170 1234567', { f: 'Cormorant Garamond', s: 8.5, w: 600, c: GOLD, a: 'center', min: 6.5 }),
    ])],
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ Geschafft
const geschafft = (() => {
  const INK = '#2a1b5e'; const YEL = '#ffd23f'; const PINK = '#ff5d9a'; const MINT = '#3fd6b2';
  return Object.assign({}, base, {
    slug: 'abschlussfeier-geschafft',
    name: 'Abschlussfeier – Geschafft',
    description: 'Post für Instagram und WhatsApp (1080 x 1080 px) zum bestandenen Abschluss oder zur Einladung zur Feier: großes „Geschafft!“, Hut und Konfetti. Name und Abschluss sind Felder.',
    variant: 'Geschafft',
    category: 'Social Media',
    unit: 'px',
    tags: tags('Instagram', 'Social Media', 'Geschafft', 'Bestanden', 'Glückwunsch', 'Post', 'Bunt'),
    formatKey: 'instagram-post', width: 1080, height: 1080,
    pages: [page(YEL, [
      decor([
        deko('Konfetti', 'deko-konfetti-streuung-bunt', 0, 0, 1080, undefined, { opacity: 0.7 }),
        ellipse('Kreis', 90, 150, 900, 900, '#ffffff'),
        icon('Hut', 'graduation-cap', 420, 80, 240, INK, 1.4),
        deko('Regenbogen', 'deko-formen-regenbogen-bunt', 790, 800, 260, undefined, { rotation: -10, opacity: 0.0 }),
      ]),
      text('Geschafft', 120, 330, 840, 230, 'Geschafft!', { f: 'Fredoka', s: 105, w: 700, c: PINK, a: 'center', min: 40, lh: 1.1 }),
      text('Name', 140, 570, 800, 120, '{{Name}}', { f: 'Fredoka', s: 64, w: 600, c: INK, a: 'center', min: 24 }),
      text('Abschluss', 140, 690, 800, 100, '{{Abschluss}}', { f: 'Poppins', s: 40, w: 700, c: MINT, a: 'center', min: 18 }),
      text('Danke', 160, 820, 760, 140, 'Wir feiern am 25. Juni ab 18 Uhr in der Aula. Kommt vorbei!', { f: 'Poppins', s: 27, w: 500, c: INK, a: 'center', wrap: true, v: 'top', lh: 1.35, min: 14 }),
    ])],
  });
})();

module.exports = { templates: [plakat, festlich, geschafft] };
