'use strict';
const { dsl, pt, ADDRESS, PHONE, infoRow } = require('./_t3a-lib');
const { text, rect, ellipse, shape, icon, deko, dekoIn, group, page, typo, qr } = dsl;

const FAMILY = { family: 'plakat-fest', familyName: 'Plakat für ein Fest', occasion: 'Feste & Events', category: 'Poster', formatKey: 'poster-a3-portrait', width: 297, height: 420 };

// ---- Wimpelkette: light, friendly, round type, bunting and balloons
const NAVY = '#1d3557';
const CORAL = '#ff6b6b';
const CREAM = '#fff6e5';
const feat = (n, x, iconName, label, sub, color) => [
  ellipse(`Kreis ${n}`, x + 12, 264, 36, 36, color),
  icon(`Symbol ${n}`, iconName, x + 20, 272, 20, '#ffffff', 2),
  text(`Merkmal ${n}`, x, 304, 60, 9, label, { f: 'Fredoka', s: 22, w: 600, c: NAVY, a: 'center', min: 11 }),
  text(`Merkmal ${n} Zusatz`, x, 314, 60, 14, sub, { f: 'Fredoka', s: 14, w: 400, c: '#4a5d7a', a: 'center', v: 'top', wrap: true, lh: 1.25, min: 8 }),
];

const wimpel = {
  ...FAMILY,
  slug: 'plakat-fest-wimpelkette',
  name: 'Poster A3 – Fest Wimpelkette',
  variant: 'Wimpelkette',
  description: 'Heiteres A3-Plakat für Sommerfest, Straßenfest oder Vereinsfest: Wimpelkette, runde Schlagzeile, Datumsbalken, drei Programmpunkte mit Symbolen, Luftballons und Fußzeile mit Ort.',
  tags: ['Plakat', 'Poster', 'Sommerfest', 'Straßenfest', 'Fest', 'Wimpel', 'Luftballons', 'Einladung', 'Nachbarschaft', 'Aushang'],
  pages: [page(CREAM, [
    deko('Wimpelkette', 'deko-konfetti-wimpelkette-bunt', -2, -6, 301, undefined, { locked: true }),
    text('Einladung', 20, 84, 257, 18, 'Herzliche Einladung zum', { f: 'Caveat', w: 700, s: 44, c: CORAL, a: 'center', min: 20 }),
    text('Schlagzeile', 14, 104, 269, 56, 'SOMMERFEST', { f: 'Fredoka', w: 700, s: 112, c: NAVY, a: 'center', lh: 1.1, min: 50 }),
    text('Zusatz', 20, 164, 257, 16, 'für Jung und Alt in der Nachbarschaft', { f: 'Fredoka', s: 28, c: '#4a5d7a', a: 'center', min: 14 }),
    rect('Datumsbalken', 24, 196, 249, 48, CORAL, { radius: 24 }),
    text('Datum', 34, 198, 229, 28, 'Samstag, 20. Juni 2026', { f: 'Fredoka', w: 600, s: 46, c: '#ffffff', a: 'center', min: 22 }),
    text('Uhrzeit', 34, 225, 229, 13, 'ab 14 Uhr · Eintritt frei', { f: 'Fredoka', s: 24, c: '#ffffff', a: 'center', min: 12 }),
    feat(1, 14, 'cake', 'Kuchenbuffet', 'Spenden sind willkommen', '#f4a261'),
    feat(2, 80, 'music', 'Live-Musik', 'Die Dorfband spielt auf', '#2a9d8f'),
    feat(3, 146, 'gamepad-2', 'Spiele', 'Hüpfburg und Kinderschminken', '#7b6cf6'),
    deko('Ballons', 'deko-konfetti-ballons-fuenf-bunt', 212, 246, 74, undefined, { locked: true }),
    rect('Fuß', 0, 352, 297, 68, NAVY, { locked: true }),
    text('Ort', 24, 362, 190, 14, 'Auf der Festwiese am Dorfplatz', { f: 'Fredoka', w: 600, s: 26, c: '#ffffff', min: 14 }),
    text('Adresse', 24, 378, 190, 9, `${ADDRESS}`, { f: 'Fredoka', s: 15, c: '#c9d6ea', min: 9 }),
    text('Hinweis', 24, 390, 190, 9, 'Bei Regen findet das Fest in der Turnhalle statt.', { f: 'Fredoka', s: 13, c: '#c9d6ea', min: 9 }),
  ])],
};

// ---- Festlich: deep green, gold double frame, script and Roman capitals
const GREEN = '#12372a';
const GOLD = '#d9b65c';
const IVORY = '#f6f0df';
const festlich = {
  ...FAMILY,
  slug: 'plakat-fest-festlich',
  name: 'Poster A3 – Fest Festlich',
  variant: 'Festlich',
  description: 'Edles A3-Plakat für Gartenfest, Jubiläum oder Empfang: dunkelgrün mit goldenem Doppelrahmen, Schreibschrift-Titel, Lorbeerkranz um das Datum und Programm in klassischer Antiqua.',
  tags: ['Plakat', 'Poster', 'Gartenfest', 'Jubiläum', 'Empfang', 'Festlich', 'Elegant', 'Gold', 'Einladung', 'Gala'],
  pages: [page(GREEN, [
    dekoIn('Rahmen', 'deko-rahmen-doppellinie-hoch-gold', 12, 12, 273, 396, { locked: true }),
    deko('Schnörkel oben', 'deko-ornamente-schnoerkel-breit-gold', 113, 36, 71, undefined, { locked: true }),
    text('Einladung', 30, 68, 237, 14, 'Wir laden herzlich ein zum', { f: 'Cormorant Garamond', i: true, w: 500, s: 30, c: IVORY, a: 'center', min: 16 }),
    text('Titel', 24, 82, 249, 62, 'Gartenfest', { f: 'Great Vibes', s: 124, c: GOLD, a: 'center', lh: 1.2, min: 60 }),
    text('Anlass', 30, 146, 237, 14, 'AM ABEND DES SOMMERS', { f: 'Cinzel', w: 500, s: 22, c: IVORY, a: 'center', ls: 0.2, min: 12 }),
    deko('Lorbeerkranz', 'deko-blumen-lorbeerkranz-gold', 79, 168, 140, undefined, { locked: true }),
    text('Tag', 100, 199, 97, 34, '20.', { f: 'Cinzel', w: 600, s: 74, c: IVORY, a: 'center', lh: 1.1, min: 30 }),
    text('Monat', 100, 234, 97, 10, 'JUNI 2026', { f: 'Cinzel', w: 500, s: 22, c: GOLD, a: 'center', ls: 0.12, min: 12 }),
    text('Uhrzeit', 100, 246, 97, 9, 'ab 18 Uhr', { f: 'Cormorant Garamond', i: true, w: 500, s: 22, c: IVORY, a: 'center', min: 12 }),
    text('Programm', 30, 304, 237, 13, 'Musik · Buffet · Feuerschale', { f: 'Cormorant Garamond', i: true, w: 500, s: 30, c: IVORY, a: 'center', min: 16 }),
    deko('Trenner', 'deko-trenner-deco-gold', 89, 322, 120, undefined, { locked: true }),
    text('Ort', 30, 339, 237, 11, 'Im Garten der Villa Sonnenhof', { f: 'Cinzel', w: 600, s: 21, c: GOLD, a: 'center', min: 12 }),
    text('Adresse', 30, 352, 237, 9, ADDRESS, { f: 'Cormorant Garamond', w: 500, s: 19, c: IVORY, a: 'center', min: 11 }),
    text('Zusage', 30, 366, 237, 9, `Um Zusage wird gebeten: ${PHONE}`, { f: 'Cormorant Garamond', i: true, w: 500, s: 18, c: IVORY, a: 'center', min: 11 }),
    text('Kleiderordnung', 30, 376, 237, 9, 'Festliche Sommerkleidung erwünscht', { f: 'Cormorant Garamond', i: true, w: 500, s: 18, c: GOLD, a: 'center', min: 11 }),
  ])],
};

module.exports = { variants: [wimpel, festlich] };
