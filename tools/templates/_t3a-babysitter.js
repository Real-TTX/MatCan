'use strict';
const { dsl, pt, ADDRESS, PHONE, WEB, infoRow, tearOff } = require('./_t3a-lib');
const { text, rect, ellipse, shape, icon, frame, deko, dekoIn, group, page, typo, qr, line, gradient, shadow } = dsl;

const FAMILY = { family: 'aushang-babysitter', familyName: 'Aushang Babysitter', occasion: 'Kinder & Familie', category: 'Flyer', formatKey: 'tearoff-a4', width: 210, height: 297 };

// ---- Sonnig: warm yellow, big sun, rounded type
const SUN = '#fff1b8';
const ORANGE = '#f08a24';
const BROWN = '#5a3410';
const fact = (n, y, iconName, label, color) => [
  ellipse(`Merkmal ${n} Kreis`, 24, y, 17, 17, color),
  icon(`Merkmal ${n} Symbol`, iconName, 27.5, y + 3.5, 10, '#ffffff', 2),
  text(`Merkmal ${n}`, 48, y, 140, 17, label, { f: 'Fredoka', w: 500, s: 21, c: BROWN, a: 'left', min: 11 }),
];
const sonnig = {
  ...FAMILY,
  slug: 'aushang-babysitter-sonnig',
  name: 'Aushang A4 – Babysitter Sonnig',
  variant: 'Sonnig',
  description: 'Fröhlicher A4-Aushang mit Abreißzetteln für Babysitter-Angebote: gelber Grund, große Sonne, runde Schrift in Fredoka, drei Merkmale mit Symbolen, Name und Telefon sowie acht Zettel zum Abreißen.',
  tags: ['Aushang', 'Babysitter', 'Babysitterin', 'Kinderbetreuung', 'Abreißzettel', 'Schwarzes Brett', 'Sonnig', 'Kinder', 'Familie', 'Jugendliche'],
  pages: [page(SUN, [
    deko('Sonne', 'deko-formen-sonne-bunt', 128, -18, 100, undefined, { locked: true }),
    text('Anlass', 20, 24, 110, 10, 'Zuverlässig und lieb', { f: 'Fredoka', w: 500, s: 22, c: ORANGE, a: 'left', min: 12 }),
    text('Titel', 18, 36, 130, 36, 'Babysitter', { f: 'Fredoka', w: 700, s: 66, c: BROWN, a: 'left', lh: 1.15, min: 30 }),
    text('Untertitel', 20, 80, 150, 28, 'Ich passe gern auf\ndein Kind auf!', { f: 'Fredoka', w: 500, s: 31, c: BROWN, a: 'left', v: 'top', wrap: true, lh: 1.2, min: 16 }),
    fact(1, 124, 'baby', 'Erfahren mit Babys und Kindern', '#f08a24'),
    fact(2, 146, 'heart-pulse', 'Erste-Hilfe-Kurs für Kinder', '#e0556a'),
    fact(3, 168, 'moon', 'Abends und am Wochenende', '#5a7fd6'),
    rect('Kontakt Feld', 22, 196, 166, 28, '#ffffff', { radius: 14, shadow: shadow('#a56a10', 0.2, 4, 0, 1) }),
    text('Kontakt', 22, 196, 166, 28, `Lena, 17 Jahre  ·  ${PHONE}`, { f: 'Fredoka', w: 600, s: 21, c: BROWN, a: 'center', min: 11 }),
    tearOff(8, 232, 65, ['Babysitter Lena', 'Ruf mich an!', PHONE], { lineH: 5.6, sizes: [11, 9, 11], weights: [600, 400, 600], colors: [BROWN, ORANGE, BROWN], f: 'Fredoka', line: '#a56a10' }),
  ])],
};

// ---- Wolken: sky blue, clouds and a rainbow, round soft type
const SKY = '#d9eefc';
const NIGHT = '#1d3a5f';
const wolken = {
  ...FAMILY,
  slug: 'aushang-babysitter-wolken',
  name: 'Aushang A4 – Babysitter Wolken',
  variant: 'Wolken',
  description: 'Sanfter A4-Aushang mit Abreißzetteln für Babysitter und Kinderbetreuung: Himmelblau mit Wolken und Regenbogen, Titel in Baloo, kurze Vorstellung mit Alter, Erfahrung und Zeiten, acht Abreißzettel.',
  tags: ['Aushang', 'Babysitter', 'Kinderbetreuung', 'Abreißzettel', 'Wolken', 'Regenbogen', 'Pastell', 'Betreuung', 'Eltern', 'Schwarzes Brett'],
  pages: [page(SKY, [
    deko('Wolke 1', 'deko-formen-wolke-1-weiss', 14, 18, 60, undefined, { locked: true }),
    deko('Wolke 2', 'deko-formen-wolke-2-weiss', 128, 30, 70, undefined, { locked: true }),
    deko('Regenbogen', 'deko-formen-regenbogen-pastell', 55, 42, 100, undefined, { locked: true }),
    text('Titel', 14, 98, 182, 32, 'Babysitterin', { f: 'Baloo 2', w: 800, s: 62, c: NIGHT, a: 'center', lh: 1.25, min: 30 }),
    text('Untertitel', 24, 132, 162, 14, 'für kleine Schlafmützen und große Entdecker', { f: 'Baloo 2', w: 500, s: 19, c: '#3d6a9c', a: 'center', min: 11 }),
    rect('Karte', 24, 154, 162, 64, '#ffffff', { radius: 8, shadow: shadow('#1d3a5f', 0.14, 5, 0, 1.2) }),
    infoRow('Alter', 'user', 34, 162, 142, '', 'Anna, 18 Jahre, Abiturientin', { f: 'Baloo 2', c: NIGHT, icolor: '#5a7fd6', ic: 8, vs: 15, vw: 600 }),
    infoRow('Erfahrung', 'baby', 34, 175, 142, '', 'Betreue Kinder von 0 bis 10 Jahren', { f: 'Baloo 2', c: NIGHT, icolor: '#5a7fd6', ic: 8, vs: 15, vw: 600 }),
    infoRow('Zeiten', 'clock', 34, 188, 142, '', 'Abends, am Wochenende und in den Ferien', { f: 'Baloo 2', c: NIGHT, icolor: '#5a7fd6', ic: 8, vs: 15, vw: 600 }),
    infoRow('Telefon', 'phone', 34, 201, 142, '', `${PHONE} oder anna@beispiel.de`, { f: 'Baloo 2', c: '#d6477a', icolor: '#d6477a', ic: 8, vs: 15, vw: 700 }),
    tearOff(8, 232, 65, ['Babysitterin Anna', 'Abends & Wochenende', PHONE], { lineH: 5.6, sizes: [11, 8.5, 11], weights: [700, 500, 700], colors: [NIGHT, '#3d6a9c', '#d6477a'], f: 'Baloo 2', line: '#6b8fb5', bg: '#ffffff' }),
  ])],
};

// ---- Klar: white, bold black type, coral block and a round photo
const CORAL = '#ff5a5f';
const klar = {
  ...FAMILY,
  slug: 'aushang-babysitter-klar',
  name: 'Aushang A4 – Babysitter Klar',
  variant: 'Klar',
  description: 'Moderner A4-Aushang mit Abreißzetteln für Babysitter-Anzeigen: weiß mit korallrotem Block, rundes Fotofeld, Titel in Poppins, drei Stichpunkte mit Zahlen, Stundenlohn und acht Abreißzettel.',
  tags: ['Aushang', 'Babysitter', 'Kinderbetreuung', 'Abreißzettel', 'Foto', 'Modern', 'Minimal', 'Stundenlohn', 'Studentin', 'Schwarzes Brett'],
  pages: [page('#ffffff', [
    rect('Block', 0, 0, 210, 14, CORAL, { locked: true }),
    ellipse('Foto Hintergrund', 126, 36, 64, 64, '#ffd3d4', { locked: true }),
    icon('Foto Symbol', 'image', 148, 58, 20, '#ff8f93', 1.4, { locked: true }),
    frame('Foto', 126, 36, 64, 64, { mask: 'circle', border: { color: CORAL, width: 3 } }),
    text('Anlass', 20, 40, 100, 7, 'BABYSITTING', { f: 'Poppins', w: 600, s: 13, c: CORAL, ls: 0.3, a: 'left', min: 8 }),
    text('Titel', 18, 50, 110, 56, 'Ich\nbin da.', { f: 'Poppins', w: 800, s: 54, c: '#111111', a: 'left', v: 'top', wrap: true, lh: 1.05, min: 28 }),
    text('Untertitel', 20, 116, 170, 24, 'Verlässliche Kinderbetreuung bei dir zu Hause: abends, am Wochenende und in den Ferien.', { f: 'Poppins', s: 14, c: '#444444', a: 'left', v: 'top', wrap: true, lh: 1.5, min: 9 }),
    text('Zahl 1', 20, 150, 50, 20, '3 J.', { f: 'Poppins', w: 800, s: 34, c: CORAL, a: 'left', min: 16 }),
    text('Zahl 1 Text', 20, 168, 50, 11, 'Erfahrung mit\nKindern', { f: 'Poppins', s: 10.5, c: '#444444', a: 'left', v: 'top', wrap: true, lh: 1.35, min: 7 }),
    text('Zahl 2', 80, 150, 50, 20, '18 €', { f: 'Poppins', w: 800, s: 34, c: CORAL, a: 'left', min: 16 }),
    text('Zahl 2 Text', 80, 168, 50, 11, 'pro Stunde,\nab 21 Uhr 20 €', { f: 'Poppins', s: 10.5, c: '#444444', a: 'left', v: 'top', wrap: true, lh: 1.35, min: 7 }),
    text('Zahl 3', 140, 150, 55, 20, 'EH', { f: 'Poppins', w: 800, s: 34, c: CORAL, a: 'left', min: 16 }),
    text('Zahl 3 Text', 140, 168, 55, 11, 'Erste-Hilfe-Kurs\nam Kind', { f: 'Poppins', s: 10.5, c: '#444444', a: 'left', v: 'top', wrap: true, lh: 1.35, min: 7 }),
    rect('Kontakt Feld', 20, 194, 170, 26, '#111111', { radius: 4 }),
    text('Kontakt', 20, 194, 170, 26, `Mia  ·  ${PHONE}`, { f: 'Poppins', w: 700, s: 22, c: '#ffffff', a: 'center', min: 11 }),
    tearOff(8, 232, 65, ['Babysitter Mia', PHONE, 'ab 18 € / Std.'], { lineH: 5.6, sizes: [11, 11, 8.5], weights: [800, 600, 500], colors: ['#111111', CORAL, '#555555'], f: 'Poppins', line: '#777777' }),
  ])],
};

module.exports = { variants: [sonnig, wolken, klar] };
