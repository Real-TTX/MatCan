'use strict';
const { gold: G, salbei: S, minimal: M, C, L } = require('./_t2a-wedding');
const { text, rect, ellipse, line, icon, page, ctext, divider, dk, dekoIn, tpl, diamond } = L;

const META = { family: 'hochzeit-menuekarte', familyName: 'Hochzeit: Menükarte', occasion: 'Hochzeit', formatKey: 'menu-dl', width: 99, height: 210 };

const MENU = [
  ['Vorspeise', 'Tomaten-Mozzarella-Türmchen\nmit Basilikumöl'],
  ['Suppe', 'Kräuterschaumsuppe\nmit Croûtons'],
  ['Hauptgang', 'Rosa gebratene Entenbrust\nmit Orangenjus, Kartoffelgratin\nund Honigkarotten'],
  ['Vegetarisch', 'Ricotta-Tortelloni\nmit Salbeibutter'],
  ['Dessert', 'Hochzeitstorte\nund Kaffeespezialitäten'],
];

// ---------------------------------------------------------------------------------------------------------------------------- Klassisch Gold
const gold = tpl(Object.assign({}, META, {
  slug: 'hochzeit-menuekarte-klassisch-gold', variant: G.variant,
  name: 'Hochzeit Menükarte – Klassisch Gold',
  description: 'Menükarte für die Hochzeitstafel im Format DIN lang in Elfenbein und Gold: Zierrahmen, „Unser Menü“ in Schreibschrift, die Gänge mittig mit goldenen Trennern. Gerichte einfach überschreiben.',
  tags: ['Hochzeit', 'Menükarte', 'Menü', 'Speisekarte', 'Hochzeitsmenü', 'Gold', 'klassisch', 'DIN lang', 'Tafel', 'Gänge'],
  pages: [page(G.bg, [
    dekoIn('Rahmen', G.frameLang, 5, 5, 89, 200, { locked: true }),
    ctext('Titel', 49.5, 14, 76, 16, 'Unser Menü', { f: G.script, s: 31, c: G.ink, min: 16 }),
    dk('Trenner', G.divider, 24.5, 30, 50),
    ...MENU.flatMap(([course, dish], i) => {
      const y = 44 + i * 29;
      return [
        ctext('Gang ' + (i + 1), 49.5, y, 76, 6, course.toUpperCase(), { f: G.caps, s: 7.5, w: 500, c: G.accent, ls: 0.3, min: 5 }),
        ctext('Gericht ' + (i + 1), 49.5, y + 7, 78, 16, dish, { f: G.serif, s: 11.5, w: 500, i: true, c: G.ink, wrap: true, v: 'top', lh: 1.3, min: 7 }),
        i < MENU.length - 1 && diamond('Raute ' + (i + 1), 49.5, y + 26.5, 1.2, G.line),
      ];
    }),
    ctext('Fuß', 49.5, 193, 76, 6, 'ANNA & JONAS · 12.06.2027', { f: G.caps, s: 7, w: 500, c: G.accent, ls: 0.24, min: 7 }),
  ], 'Menükarte')],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Botanisch Salbei
const salbei = tpl(Object.assign({}, META, {
  slug: 'hochzeit-menuekarte-botanisch-salbei', variant: S.variant,
  name: 'Hochzeit Menükarte – Botanisch Salbei',
  description: 'Menükarte für die Hochzeitstafel im Format DIN lang: Olivenzweig, „Menü“ in leichter Schreibschrift und die Gänge in Salbeigrün und Serife, unten Eukalyptus. Gerichte einfach überschreiben.',
  tags: ['Hochzeit', 'Menükarte', 'Menü', 'Speisekarte', 'Hochzeitsmenü', 'Eukalyptus', 'Salbei', 'botanisch', 'DIN lang', 'Olive'],
  pages: [page(S.bg, [
    dk('Olivenzweig', S.olive, 24.5, 6, 50),
    ctext('Titel', 49.5, 24, 76, 16, 'Menü', { f: S.script, s: 38, c: S.ink, min: 18 }),
    ...MENU.flatMap(([course, dish], i) => {
      const y = 46 + i * 27;
      return [
        ctext('Gang ' + (i + 1), 49.5, y, 76, 6, course.toUpperCase(), { f: S.caps, s: 7, w: 600, c: S.accent, ls: 0.34, min: 7 }),
        ctext('Gericht ' + (i + 1), 49.5, y + 7, 80, 17, dish, { f: S.serif, s: 12, w: 500, c: S.ink, wrap: true, v: 'top', lh: 1.3, min: 7 }),
      ];
    }),
    dk('Ecke links', S.corner, 0, 170, 40, undefined, { flipY: true }),
    dk('Ecke rechts', S.corner, 59, 170, 40, undefined, { flipX: true, flipY: true }),
    ctext('Fuß', 49.5, 196, 70, 6, 'ANNA & JONAS', { f: S.caps, s: 7, w: 600, c: S.accent, ls: 0.34, min: 7 }),
  ], 'Menükarte')],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Modern Minimal
const minimal = tpl(Object.assign({}, META, {
  slug: 'hochzeit-menuekarte-modern-minimal', variant: M.variant,
  name: 'Hochzeit Menükarte – Modern Minimal',
  description: 'Menükarte für die Hochzeitstafel im Format DIN lang: links ausgerichtet, nummerierte Gänge, dünne Linien und eine Spalte in warmem Sand. Reduziert und gut lesbar, Gerichte einfach überschreiben.',
  tags: ['Hochzeit', 'Menükarte', 'Menü', 'Speisekarte', 'Hochzeitsmenü', 'minimalistisch', 'modern', 'DIN lang', 'schlicht', 'Gänge'],
  pages: [page(M.bg, [
    rect('Sandspalte', 0, 0, 10, 210, M.soft, { locked: true }),
    text('Titel', 18, 14, 70, 18, 'Menü.', { f: M.serif, s: 32, i: true, w: 400, c: M.ink, min: 16 }),
    text('Unter', 18, 32, 70, 6, C.dateNum + ' · ' + C.place.toUpperCase(), { f: M.caps, s: 7, w: 400, c: M.accent, ls: 0.24, min: 7 }),
    ...MENU.flatMap(([course, dish], i) => {
      const y = 48 + i * 29;
      return [
        line('Linie ' + (i + 1), 18, y, 91, y, M.ink, 0.25, { locked: true }),
        text('Nummer ' + (i + 1), 18, y + 3, 10, 6, '0' + (i + 1), { f: M.caps, s: 7, w: 600, c: M.accent, min: 4 }),
        text('Gang ' + (i + 1), 30, y + 3, 60, 6, course.toUpperCase(), { f: M.caps, s: 7, w: 600, c: M.ink, ls: 0.3, min: 7 }),
        text('Gericht ' + (i + 1), 30, y + 10, 62, 16, dish, { f: M.sans, s: 8.5, w: 400, c: M.ink, wrap: true, v: 'top', lh: 1.45, min: 6 }),
      ];
    }),
    line('Linie 6', 18, 48 + 5 * 29, 91, 48 + 5 * 29, M.ink, 0.25, { locked: true }),
  ], 'Menükarte')],
}));

module.exports = { gold, salbei, minimal };
