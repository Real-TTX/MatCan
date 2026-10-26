'use strict';
/* Family: Grillfest. Variants: Kreide (Flyer A5, Tafel), BBQ (Plakat A3, Retro), Karo (Einladung A6, Picknickdecke). The organiser is a field. */
const D = require('./dsl');
const { decor, scatter, infoRow, gingham } = require('./_t2b-lib');
const { text, rect, ellipse, shape, icon, deko, dekoIn, image, page, gradient, field, line, shadow } = D;

const fields = [field('Veranstalter', 'Veranstalter', 'text', 'Familie Mustermann')];
const sampleRows = [{ Veranstalter: 'Familie Mustermann' }, { Veranstalter: 'Schützenverein Oberhausen-Niederweiler e. V.' }, { Veranstalter: 'Ben' }];
const base = { category: 'Flyer', family: 'grillfest', familyName: 'Grillfest', occasion: 'Feste & Events', unit: 'mm', fields, sampleRows };
const tags = (...more) => require('./_t2b-lib').dedupe(['Grillfest', 'Grillen', 'Grillparty', 'BBQ', 'Barbecue', 'Einladung', 'Flyer', 'Fest', 'Gartenparty', 'Nachbarschaft', ...more]);

// ------------------------------------------------------------------------------------------------------------------------ Kreide
const kreide = (() => {
  const BOARD = '#2a2724'; const CHALK = '#f3efe4'; const ORANGE = '#ff9f40'; const YEL = '#ffd96b';
  return Object.assign({}, base, {
    slug: 'grillfest-kreide',
    name: 'Grillfest – Kreide',
    description: 'Flyer A5 hoch im Stil einer Kreidetafel: Amatic-Schrift, Flamme, Würstchen, Bier und Salat als Kreidezeichnung, Termin und Ort in der Mitte. Der Veranstalter ist ein Feld.',
    variant: 'Kreide',
    tags: tags('Kreide', 'Tafel', 'Rustikal', 'A5', 'Handschrift', 'Schwarz'),
    formatKey: 'a5-portrait', width: 148, height: 210,
    pages: [page(BOARD, [
      decor([
        rect('Rahmen', 8, 8, 132, 194, null, { stroke: CHALK, sw: 0.8, opacity: 0.6, dash: 'dashed' }),
        icon('Flamme', 'flame', 56, 18, 36, ORANGE, 1.5),
        icon('Fleisch', 'beef', 16, 151, 20, CHALK, 1.5, { rotation: -12 }),
        icon('Keule', 'drumstick', 46, 153, 20, CHALK, 1.5, { rotation: 10 }),
        icon('Bier', 'beer', 80, 151, 20, YEL, 1.5, { rotation: -8 }),
        icon('Salat', 'salad', 110, 152, 20, '#9be24b', 1.5, { rotation: 8 }),
        line('Strich 1', 38, 124, 110, 124, CHALK, 0.6, { dash: 'dashed', opacity: 0.7 }),
        line('Strich 2', 38, 191, 110, 191, CHALK, 0.6, { dash: 'dashed', opacity: 0.7 }),
      ]),
      text('Kopf', 16, 60, 116, 12, 'ES WIRD HEISS BEI', { f: 'Amatic SC', s: 26, w: 700, c: ORANGE, a: 'center', ls: 0.12, min: 12 }),
      text('Veranstalter', 16, 70, 116, 14, '{{Veranstalter}}', { f: 'Patrick Hand', s: 17, c: CHALK, a: 'center', min: 9 }),
      text('Titel', 10, 84, 128, 40, 'GRILLFEST', { f: 'Amatic SC', s: 84, w: 700, c: '#ffffff', a: 'center', lh: 1, min: 34 }),
      text('Datum', 14, 128, 120, 14, 'Samstag, 24. Juli · ab 16 Uhr', { f: 'Patrick Hand', s: 19, c: YEL, a: 'center', min: 10 }),
      text('Ort', 14, 140, 120, 9, 'im Garten, Musterweg 5', { f: 'Patrick Hand', s: 15, c: CHALK, a: 'center', min: 8 }),
      text('Mitbringen', 16, 175, 116, 14, 'Fleisch und Getränke gibt es vor Ort –\nSalate und gute Laune bringst du mit!', { f: 'Patrick Hand', s: 12, c: CHALK, a: 'center', wrap: true, v: 'top', lh: 1.3, min: 8 }),
      text('Zusage', 16, 192.5, 116, 7, 'Bitte kurz Bescheid sagen: 0170 1234567', { f: 'Patrick Hand', s: 12, c: ORANGE, a: 'center', min: 8 }),
    ])],
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ BBQ
const bbq = (() => {
  const RED = '#d2392b'; const MUST = '#ffc233'; const CREAM = '#fff3d6'; const INK = '#2a1510';
  return Object.assign({}, base, {
    slug: 'grillfest-bbq',
    name: 'Grillfest – BBQ',
    description: 'Plakat A3 hoch im Retro-Stil: Tomatenrot und Senfgelb, riesiges GRILLFEST in Righteous, große Flamme und ein Karoband. Aushang für Vereinsheim, Nachbarschaft oder Betrieb. Der Veranstalter ist ein Feld.',
    variant: 'BBQ',
    category: 'Poster',
    tags: tags('BBQ', 'Retro', 'Plakat', 'Poster', 'A3', 'Aushang', 'Rot', 'Gelb', 'Verein'),
    formatKey: 'poster-a3-portrait', width: 297, height: 420,
    pages: [page(RED, [
      decor([
        ellipse('Kreis groß', 62, 150, 173, 173, MUST),
        ellipse('Kreis Ring', 69, 157, 159, 159, null, { stroke: RED, sw: 1.4, dash: 'dashed' }),
        icon('Flamme', 'flame', 108, 188, 82, RED, 1.4),
        icon('Steak', 'beef', 10, 200, 46, CREAM, 1.4, { rotation: -14 }),
        icon('Keule', 'drumstick', 241, 206, 46, CREAM, 1.4, { rotation: 14 }),
        rect('Band', 0, 326, 297, 94, CREAM),
        ...gingham('Karo oben', 0, 326, 297, 24, 6, RED, '#ffffff'),
        ...gingham('Karo unten', 0, 396, 297, 24, 6, RED, '#ffffff'),
      ]),
      text('Kopf', 20, 26, 257, 14, 'ANGRILLEN – JETZT MIT DIR', { f: 'Righteous', s: 22, c: MUST, a: 'center', ls: 0.2, min: 10 }),
      text('Titel', 6, 46, 285, 90, 'GRILLFEST', { f: 'Righteous', s: 124, c: '#ffffff', a: 'center', lh: 1.05, min: 40, shadow: shadow('#7d1a12', 0.5, 0, 2.5, 3) }),
      text('Datum', 14, 353, 269, 22, 'Samstag, 24. Juli · ab 16 Uhr', { f: 'Righteous', s: 24, c: RED, a: 'center', min: 12 }),
      text('Ort', 14, 374, 269, 18, 'Vereinsheim, Musterweg 5 · {{Veranstalter}}', { f: 'Montserrat', s: 13, w: 700, c: INK, a: 'center', min: 8 }),
    ])],
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ Karo
const karo = (() => {
  const RED = '#c8372d'; const CREAM = '#fffaf0'; const INK = '#3b2a20'; const MUST = '#e9a82b';
  return Object.assign({}, base, {
    slug: 'grillfest-karo',
    name: 'Grillfest – Karo',
    description: 'Einladung zum Grillfest (A6 hoch) mit rot-weißer Picknickdecke als Rand, Flamme und handgeschriebener Schrift. Der Veranstalter ist ein Feld, Datum und Ort trägst du ein.',
    variant: 'Karo',
    category: 'Einladungen',
    tags: tags('Karo', 'Picknick', 'Rot-Weiß', 'Einladungskarte', 'A6', 'Gemütlich'),
    formatKey: 'a6-portrait', width: 105, height: 148,
    pages: [page(CREAM, [
      decor([
        ...gingham('Karo oben', 0, 0, 105, 24, 6, RED, '#ffffff'),
        ...gingham('Karo unten', 0, 124, 105, 24, 6, RED, '#ffffff'),
        ellipse('Kreis', 36, 32, 33, 33, MUST), icon('Flamme', 'flame', 44.5, 38, 16, '#ffffff', 1.7),
        deko('Trenner', 'deko-trenner-punkte-gold', 29, 105, 47),
      ]),
      text('Einladung', 8, 70, 89, 8, 'Wir laden ein zum', { f: 'Dancing Script', s: 17, w: 700, c: RED, a: 'center', min: 9 }),
      text('Titel', 4, 77, 97, 18, 'GRILLFEST', { f: 'Righteous', s: 32, c: INK, a: 'center', min: 14 }),
      text('Veranstalter', 10, 94, 85, 8, 'bei {{Veranstalter}}', { f: 'Nunito', s: 10, w: 700, c: INK, a: 'center', min: 6 }),
      text('Datum', 8, 107, 89, 7, 'Samstag, 24. Juli · ab 16 Uhr', { f: 'Nunito', s: 10.5, w: 800, c: RED, a: 'center', min: 7 }),
      text('Ort', 8, 114, 89, 6, 'Musterweg 5 · 12345 Musterstadt', { f: 'Nunito', s: 9, w: 600, c: INK, a: 'center', min: 6.5 }),
    ])],
  });
})();

module.exports = { templates: [kreide, bbq, karo] };
