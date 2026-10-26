'use strict';
/* Family: Halloween-Party. Variants: Gruselparty (A6, Einladung), Night (Plakat A3), Süßes oder Saures (Instagram-Post). */
const D = require('./dsl');
const { decor, scatter, infoRow, pumpkin, bat, ghost } = require('./_t2b-lib');
const { text, rect, ellipse, shape, icon, deko, dekoIn, page, gradient, field, line, shadow } = D;

const base = { category: 'Einladungen', family: 'halloween-party', familyName: 'Halloween-Party', occasion: 'Feiertage', unit: 'mm', fields: [], sampleRows: [] };
const tags = (...more) => require('./_t2b-lib').dedupe(['Halloween', 'Party', 'Gruselparty', 'Einladung', 'Kürbis', 'Gruseln', 'Verkleiden', 'Oktober', ...more]);
const ORANGE = '#ff8a1f'; const LIME = '#9be24b'; const NIGHT = '#1a0f2e';

// ------------------------------------------------------------------------------------------------------------------------ Gruselparty
const gruselparty = (() => Object.assign({}, base, {
  slug: 'halloween-gruselparty',
  name: 'Halloween – Gruselparty',
  description: 'Einladung zur Halloween-Party (A6 hoch): Vollmond, Fledermäuse, Gespenst und ein grinsender Kürbis auf Nachtviolett. Datum, Ort und Kostümhinweis trägst du ein.',
  variant: 'Gruselparty',
  tags: tags('Gruselparty', 'Fledermaus', 'Gespenst', 'Vollmond', 'Kostüm', 'Lila'),
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [page(gradient(175, '#1a0f2e', '#44207a'), [
    decor([
      deko('Himmel', 'deko-sterne-himmel-weiss', 0, -10, 105, undefined, { opacity: 0.55 }),
      ellipse('Mondschein', 56, 4, 46, 46, '#fff3c4', { opacity: 0.18 }),
      ellipse('Mond', 60, 8, 38, 38, '#fff3c4'),
      ellipse('Krater 1', 70, 16, 8, 8, '#f0dfa0', { opacity: 0.8 }), ellipse('Krater 2', 82, 28, 6, 6, '#f0dfa0', { opacity: 0.8 }), ellipse('Krater 3', 66, 30, 4, 4, '#f0dfa0', { opacity: 0.8 }),
      ...bat('Fledermaus 1', 12, 14, 22, '#0d0718'), ...bat('Fledermaus 2', 42, 34, 14, '#0d0718'), ...bat('Fledermaus 3', 80, 40, 12, '#0d0718'),
    ]),
    text('Kopf', 8, 54, 89, 8, 'WER TRAUT SICH?', { f: 'Oswald', s: 11, w: 500, c: LIME, a: 'center', ls: 0.35, min: 7 }),
    text('Titel', 4, 61, 97, 24, 'Halloween', { f: 'Permanent Marker', s: 42, c: ORANGE, a: 'center', min: 18, shadow: shadow('#000000', 0.5, 0, 0.8, 1) }),
    text('Untertitel', 8, 84, 89, 9, 'Gruselparty', { f: 'Permanent Marker', s: 20, c: '#ffffff', a: 'center', min: 10 }),
    ...infoRow('Datum', 14, 94, 80, 'calendar-days', 'Samstag, 30. Oktober 2027 · 19 Uhr', { chip: ORANGE, ic: NIGHT, c: '#ffffff', s: 9.5, w: 700, d: 7.5 }),
    ...infoRow('Ort', 14, 104, 80, 'map-pin', 'Musterweg 5 · 12345 Musterstadt', { chip: ORANGE, ic: NIGHT, c: '#ffffff', s: 9.5, w: 700, d: 7.5 }),
    ...infoRow('Kostüm', 14, 114, 80, 'ghost', 'Bitte gruselig verkleidet kommen!', { chip: ORANGE, ic: NIGHT, c: '#ffffff', s: 9.5, w: 700, d: 7.5 }),
    decor([
      rect('Boden', 0, 140, 105, 8, '#0d0718'),
      ...pumpkin('Kürbis', 5, 126, 22),
      ...pumpkin('Kürbis klein', 76, 130, 14),
      ...ghost('Gespenst', 88, 120, 11, { color: '#ffffff' }),
    ]),
  ])],
}))();

// ------------------------------------------------------------------------------------------------------------------------ Night
const night = (() => Object.assign({}, base, {
  slug: 'halloween-night',
  name: 'Halloween – Night',
  description: 'Plakat A3 hoch für Halloween-Party, Kostümparty oder Gruselnacht: riesige Schrift in Orange, grüner Schleim, Totenkopf und Kürbisse auf Schwarz. Termin und Ort trägst du ein.',
  variant: 'Night',
  category: 'Poster',
  tags: tags('Plakat', 'Poster', 'A3', 'Aushang', 'Night', 'Totenkopf', 'Schleim', 'Kostümparty', 'Club'),
  formatKey: 'poster-a3-portrait', width: 297, height: 420,
  pages: [page(gradient(180, '#08050f', '#1c0b2e', '#4a1a05'), [
    decor([
      deko('Schleim', 'deko-formen-wellenrand-salbei', 0, -2, 297, undefined, { flipY: true, opacity: 0.0 }),
      rect('Schleim', 0, 0, 297, 34, LIME),
      ...[18, 62, 118, 170, 226, 270].map((x, i) => ellipse('Tropfen ' + (i + 1), x - 12, 20 + (i % 3) * 8, 24, 34 + (i % 2) * 22, LIME)),
      ...[18, 62, 118, 170, 226, 270].map((x, i) => ellipse('Tropfen Kopf ' + (i + 1), x - 12, 20 + (i % 3) * 8 + (34 + (i % 2) * 22) - 12, 24, 24, LIME)),
      ellipse('Mond', 214, 70, 76, 76, '#fff3c4', { opacity: 0.9 }),
      ...bat('Fledermaus 1', 24, 62, 50, '#000000', { opacity: 0.9 }), ...bat('Fledermaus 2', 130, 54, 30, '#000000'), ...bat('Fledermaus 3', 226, 214, 40, '#000000'),
      icon('Totenkopf', 'skull', 124, 230, 50, '#ffffff', 1.6, { opacity: 0.95 }),
      ...pumpkin('Kürbis links', 8, 300, 96), ...pumpkin('Kürbis rechts', 200, 312, 84), ...pumpkin('Kürbis klein', 118, 342, 54),
      rect('Boden', 0, 386, 297, 34, '#000000'),
    ]),
    text('Kopf', 20, 112, 200, 20, 'DIE GRUSELIGSTE NACHT DES JAHRES', { f: 'Oswald', s: 20, w: 500, c: LIME, a: 'left', ls: 0.2, min: 10 }),
    text('Titel', 14, 132, 270, 70, 'HALLOWEEN', { f: 'Anton', s: 118, c: ORANGE, a: 'left', lh: 1, min: 50, shadow: shadow('#000000', 0.55, 0, 3, 4) }),
    text('Party', 20, 200, 250, 26, 'Kostümparty mit Livemusik', { f: 'Permanent Marker', s: 26, c: '#ffffff', a: 'left', min: 12 }),
    text('Datum', 16, 393, 160, 20, 'Sa., 30. Oktober 2027 · 20 Uhr', { f: 'Oswald', s: 21, w: 600, c: '#ffffff', a: 'left', min: 9 }),
    text('Ort', 170, 393, 112, 20, 'Alte Mühle, Musterstadt', { f: 'Oswald', s: 21, w: 600, c: ORANGE, a: 'right', min: 9 }),
  ])],
}))();

// ------------------------------------------------------------------------------------------------------------------------ Süßes oder Saures
const suess = (() => Object.assign({}, base, {
  slug: 'halloween-suesses-oder-saures',
  name: 'Halloween – Süßes oder Saures',
  description: 'Fröhlicher Instagram-Post (1080 x 1080 px) für Kinder-Halloween: freundliches Gespenst, Kürbisse und Süßigkeiten auf Orange. Termin und Treffpunkt trägst du ein.',
  variant: 'Süßes oder Saures',
  category: 'Social Media',
  unit: 'px',
  tags: tags('Instagram', 'Social Media', 'Kinder', 'Süßes oder Saures', 'Umzug', 'Süßigkeiten', 'Post', 'Laternenumzug'),
  formatKey: 'instagram-post', width: 1080, height: 1080,
  pages: [page(gradient(160, '#ff9a2e', '#ff6a1a'), [
    decor([
      deko('Konfetti', 'deko-konfetti-streuung-gold', 0, 0, 1080, undefined, { opacity: 0.35 }),
      ellipse('Mond', 650, -120, 520, 520, '#ffb85a', { opacity: 0.5 }),
      ...ghost('Gespenst', 640, 420, 330),
      ...pumpkin('Kürbis', 40, 700, 340, { color: '#ffb12e', dark: '#e07a0c' }),
      ...pumpkin('Kürbis 2', 400, 800, 190, { color: '#ffb12e', dark: '#e07a0c' }),
      icon('Bonbon', 'candy', 700, 800, 140, '#ffffff', 1.6, { rotation: -16 }),
      icon('Lolli', 'lollipop', 860, 770, 140, '#2a1238', 1.6, { rotation: 14 }),
      icon('Zuckerstange', 'candy-cane', 540, 720, 110, '#ffffff', 1.6, { rotation: 10 }),
      ...bat('Fledermaus', 100, 60, 160, '#2a1238'),
    ]),
    text('Kopf', 80, 150, 900, 90, 'KOMMT MIT ZUM', { f: 'Fredoka', s: 30, w: 600, c: '#2a1238', a: 'left', ls: 0.2, min: 18 }),
    text('Titel', 70, 217, 940, 256, 'Süßes oder\nSaures!', { f: 'Baloo 2', s: 95, w: 800, c: '#ffffff', a: 'left', wrap: true, lh: 1.0, min: 40, shadow: shadow('#2a1238', 0.35, 0, 6, 8) }),
    text('Datum', 80, 560, 520, 70, 'Sonntag, 31. Oktober', { f: 'Fredoka', s: 30, w: 600, c: '#2a1238', a: 'left', min: 16 }),
    text('Zeit', 80, 622, 520, 60, 'ab 17 Uhr · Treffpunkt Spielplatz', { f: 'Fredoka', s: 20, w: 500, c: '#2a1238', a: 'left', wrap: true, v: 'top', min: 12 }),
  ])],
}))();

module.exports = { templates: [gruselparty, night, suess] };
