'use strict';
const { gold: G, salbei: S, minimal: M, C, L } = require('./_t2a-wedding');
const { text, rect, ellipse, line, icon, page, ctext, divider, dk, dekoIn, tpl, diamond } = L;

const META = { family: 'hochzeit-programm', familyName: 'Hochzeit: Programm und Ablauf', occasion: 'Hochzeit' };

const PLAN = [
  ['14:00', 'Trauung', 'Im Gartenpavillon'],
  ['15:00', 'Sektempfang', 'Auf der Terrasse'],
  ['16:30', 'Kaffee und Kuchen', 'Mit Tortenbuffet'],
  ['18:00', 'Hochzeitsessen', 'Im Festsaal'],
  ['20:00', 'Eröffnungstanz', 'Das Brautpaar tanzt'],
  ['21:00', 'Feiern und Tanzen', 'Mit Live-Band'],
  ['23:30', 'Mitternachtssnack', 'Currywurst und Pommes'],
];

// ---------------------------------------------------------------------------------------------------------------------------- Klassisch Gold: DIN lang hoch
const gold = tpl(Object.assign({}, META, {
  slug: 'hochzeit-programm-klassisch-gold', variant: G.variant,
  name: 'Hochzeit Ablaufkarte – Klassisch Gold',
  description: 'Ablaufkarte für den Hochzeitstag im Format DIN lang hoch in Elfenbein und Gold: Uhrzeit und Programmpunkt Zeile für Zeile unter einem Zierrahmen. Zum Auslegen auf den Tischen oder in der Kirche.',
  tags: ['Hochzeit', 'Programm', 'Ablauf', 'Ablaufplan', 'Zeitplan', 'Gold', 'klassisch', 'DIN lang', 'Hochzeitsprogramm', 'Heirat'],
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  pages: [page(G.bg, [
    dekoIn('Rahmen', G.frameLang, 5, 5, 89, 200, { locked: true }),
    ctext('Titel', 49.5, 16, 76, 16, 'Unser Tag', { f: G.script, s: 32, c: G.ink, min: 16 }),
    ctext('Datum', 49.5, 32, 76, 7, C.dateShort.toUpperCase(), { f: G.caps, s: 7.5, w: 500, c: G.accent, ls: 0.3, min: 5 }),
    divider('Trenner', 49.5, 45, 40, G.line),
    ...PLAN.flatMap(([time, what, note], i) => [
      text('Uhrzeit ' + (i + 1), 14, 53 + i * 21, 22, 6, time, { f: G.caps, s: 8.5, w: 500, c: G.accent, ls: 0.05, min: 5 }),
      text('Programmpunkt ' + (i + 1), 38, 51 + i * 21, 52, 7, what, { f: G.serif, s: 13.5, w: 600, c: G.ink, min: 8 }),
      text('Hinweis ' + (i + 1), 38, 58.5 + i * 21, 52, 6, note, { f: G.serif, s: 10.5, i: true, c: G.accent, min: 6 }),
      i < PLAN.length - 1 && diamond('Punkt ' + (i + 1), 49.5, 70 + i * 21, 1.2, G.line),
    ]),
    dk('Funkeln', G.funkeln, 43.5, 194, 12),
  ], 'Ablauf')],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Botanisch Salbei: A5 hoch, Zeitstrahl
const salbei = tpl(Object.assign({}, META, {
  slug: 'hochzeit-programm-botanisch-salbei', variant: S.variant,
  name: 'Hochzeit Ablaufkarte – Botanisch Salbei',
  description: 'Ablaufkarte für den Hochzeitstag im Format A5 hoch: ein grüner Zeitstrahl mit Punkten, links die Uhrzeit, rechts der Programmpunkt, Eukalyptus oben und unten. Zum Aufstellen oder Verteilen.',
  tags: ['Hochzeit', 'Programm', 'Ablauf', 'Ablaufplan', 'Zeitstrahl', 'Eukalyptus', 'Salbei', 'botanisch', 'A5', 'Hochzeitsprogramm'],
  formatKey: 'a5-portrait', width: 148, height: 210,
  pages: [page(S.bg, [
    dk('Zweig links', S.stem, 12, 4, 11),
    dk('Zweig rechts', S.stem, 125, 4, 11, undefined, { flipX: true }),
    ctext('Titel', 74, 14, 90, 18, 'Unser Tag', { f: S.script, s: 38, c: S.ink, min: 18 }),
    ctext('Datum', 74, 33, 90, 7, C.date.toUpperCase(), { f: S.caps, s: 7, w: 600, c: S.accent, ls: 0.32, min: 5 }),
    line('Zeitstrahl', 58, 54, 58, 54 + 6 * 21 + 8, S.line, 0.5, { locked: true }),
    ...PLAN.flatMap(([time, what, note], i) => [
      ellipse('Punkt ' + (i + 1), 56.2, 54 + i * 21 + 3, 3.6, 3.6, S.accent, { locked: true }),
      text('Uhrzeit ' + (i + 1), 14, 54 + i * 21 + 1, 38, 8, time, { f: S.serif, s: 17, w: 600, c: S.accent, a: 'right', min: 9 }),
      text('Programmpunkt ' + (i + 1), 66, 54 + i * 21, 76, 8, what, { f: S.serif, s: 15, w: 600, c: S.ink, min: 9 }),
      text('Hinweis ' + (i + 1), 66, 54 + i * 21 + 8, 76, 6, note, { f: S.sans, s: 8, w: 400, c: S.ink, min: 5 }),
    ]),
    dk('Ecke unten', S.corner, 110, 176, 36, undefined, { flipX: true, flipY: true, locked: true }),
  ], 'Ablauf')],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Modern Minimal: A6 hoch
const minimal = tpl(Object.assign({}, META, {
  slug: 'hochzeit-programm-modern-minimal', variant: M.variant,
  name: 'Hochzeit Ablaufkarte – Modern Minimal',
  description: 'Ablaufkarte für den Hochzeitstag im Format A6 hoch: Zeile für Zeile Uhrzeit in Terrakotta und Programmpunkt in schlanker Schrift, dünne Trennlinien, viel Weiß. Passt zur Einladung im selben Stil.',
  tags: ['Hochzeit', 'Programm', 'Ablauf', 'Ablaufplan', 'Zeitplan', 'minimalistisch', 'modern', 'A6', 'schlicht', 'Hochzeitsprogramm'],
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [page(M.bg, [
    text('Titel', 12, 12, 70, 16, 'Der Ablauf.', { f: M.serif, s: 26, i: true, w: 400, c: M.ink, min: 13 }),
    text('Datum', 12, 28, 80, 6, C.dateNum + ' · ' + C.place.toUpperCase(), { f: M.caps, s: 6.5, w: 400, c: M.ink, ls: 0.24, min: 4 }),
    ...PLAN.flatMap(([time, what], i) => [
      line('Linie ' + (i + 1), 12, 40 + i * 13, 93, 40 + i * 13, M.soft, 0.4, { locked: true }),
      text('Uhrzeit ' + (i + 1), 12, 41 + i * 13, 20, 11, time, { f: M.caps, s: 9, w: 600, c: M.accent, ls: 0.05, min: 5 }),
      text('Programmpunkt ' + (i + 1), 34, 41 + i * 13, 60, 11, what, { f: M.sans, s: 9.5, w: 400, c: M.ink, min: 6 }),
    ]),
    line('Linie 8', 12, 40 + 7 * 13, 93, 40 + 7 * 13, M.soft, 0.4, { locked: true }),
    text('Fuß', 12, 136, 80, 4, 'ANNA & JONAS', { f: M.caps, s: 5.5, w: 600, c: M.ink, ls: 0.3, min: 4 }),
  ], 'Ablauf')],
}));

module.exports = { gold, salbei, minimal };
