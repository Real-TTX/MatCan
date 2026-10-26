'use strict';
const { text, rect, ellipse, shape, icon, qr, group, page, gradient } = require('./dsl');

const SUN = '#ffd23f';
const CORAL = '#ff5d73';
const NAVY = '#150e48';
const LILAC = '#cfc6f5';

const feature = (n, y, iconName, title, sub) => [
  ellipse(`Chip ${n}`, 24, y, 30, 30, '#ffffff', { opacity: 0.1 }),
  ellipse(`Ring ${n}`, 24, y, 30, 30, null, { stroke: SUN, sw: 2 }),
  icon(`Symbol ${n}`, iconName, 31, y + 7, 16, SUN, 1.7),
  text(`Titel ${n}`, 62, y + 2.5, 112, 14, title, { f: 'Montserrat', s: 21, w: 700, c: '#ffffff', v: 'bottom', min: 12 }),
  text(`Text ${n}`, 62, y + 17, 112, 9, sub, { f: 'Montserrat', s: 13, w: 500, c: LILAC, v: 'top', min: 9 }),
];

module.exports = {
  slug: 'poster-hoffest',
  name: 'Poster A3 – Hoffest',
  category: 'Poster',
  description: 'Plakat im Format A3 für ein Fest oder eine Veranstaltung: riesige Schrift, Datumsplakette, drei Programmpunkte mit Symbolen, Farbverlauf und ein QR-Code zum Programm.',
  family: 'plakat-fest',
  familyName: 'Plakat für ein Fest',
  variant: 'Groß und bunt',
  occasion: 'Feste & Events',
  tags: ['Plakat', 'Poster', 'Hoffest', 'Fest', 'Veranstaltung', 'Einladung', 'Programm', 'Aushang'],
  formatKey: 'poster-a3-portrait',
  width: 297,
  height: 420,
  pages: [page(gradient(165, '#150e48', '#4a1d8f'), [
    ellipse('Kreis Koralle', -70, -70, 210, 210, CORAL, { opacity: 0.28, locked: true }),
    ellipse('Kreis Gelb', 190, 140, 190, 190, SUN, { opacity: 0.1, locked: true }),
    ellipse('Kreis Weiß', -50, 235, 130, 130, '#ffffff', { opacity: 0.05, locked: true }),
    shape('star', 'Stern klein', 246, 34, 26, 26, SUN, { points: 5, inner: 0.45, rotation: 14 }),
    shape('star', 'Stern winzig', 270, 64, 12, 12, CORAL, { points: 5, inner: 0.45, rotation: -10 }),
    text('Das große', 26, 38, 170, 30, 'Das große', { f: 'Kaushan Script', s: 52, c: SUN, a: 'left', rotation: -4 }),
    text('Hoffest', 20.5, 64, 258, 100, 'HOFFEST', { f: 'Bebas Neue', s: 262, c: '#ffffff', ls: 0.015, lh: 1, min: 100 }),
    text('Untertitel', 24, 152, 249, 14, 'mit Live-Musik, Grillen und Kinderspaß', { f: 'Montserrat', s: 22, w: 600, c: '#ffffff', min: 12 }),
    ...feature(1, 204, 'music', 'Live-Musik', 'Ab 12 Uhr auf der Hofbühne'),
    ...feature(2, 248, 'utensils', 'Grill und Kuchenbuffet', 'Regionales vom Hof und aus der Küche'),
    ...feature(3, 292, 'party-popper', 'Programm für Kinder', 'Hüpfburg, Basteln und Ponyreiten'),
    group('Datumsplakette', [
      ellipse('Plakette', 180, 216, 96, 96, CORAL),
      ellipse('Plakette Ring', 185, 221, 86, 86, null, { stroke: '#ffffff', sw: 1.2, dash: 'dashed', opacity: 0.8 }),
      text('Wochentag', 190, 232, 76, 8, 'Samstag', { f: 'Montserrat', s: 15, w: 700, c: '#ffffff', a: 'center', up: true, ls: 0.22, min: 9 }),
      text('Tag', 190, 240, 76, 38, '12.', { f: 'Bebas Neue', s: 118, c: '#ffffff', a: 'center', lh: 1, min: 40 }),
      text('Monat', 190, 276, 76, 14, 'Juni', { f: 'Bebas Neue', s: 52, c: NAVY, a: 'center', up: true, ls: 0.1, lh: 1, min: 20 }),
      text('Uhrzeit', 190, 291, 76, 7, 'ab 11 Uhr', { f: 'Montserrat', s: 14, w: 700, c: '#ffffff', a: 'center', min: 8 }),
    ], { rotation: -8 }),
    rect('Fußband', 0, 346, 297, 74, SUN, { locked: true }),
    text('Eintritt frei', 24, 356, 160, 26, 'Eintritt frei', { f: 'Bebas Neue', s: 76, c: NAVY, ls: 0.02, lh: 1, min: 30, a: 'left' }),
    text('Adresse', 24, 384, 170, 24, 'Hofladen Wiesengrund\nDorfstraße 12 · 12345 Musterstadt', { f: 'Montserrat', s: 14, w: 600, c: NAVY, v: 'top', wrap: true, lh: 1.4, min: 9 }),
    qr('QR-Code', 224, 351.5, 52, 'https://example.org/hoffest', { c: NAVY, bg: '#ffffff', quiet: true }),
    text('QR Hinweis', 214, 404.5, 72, 6, 'Das ganze Programm online', { f: 'Montserrat', s: 9, w: 600, c: NAVY, a: 'center', min: 6 }),
  ])],
};
