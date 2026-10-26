/* Style line "Rock & Metal": black paper, bone white and blood red, skull with roses, electric guitar, barbed wire, worn type (Anton, Oswald, Permanent Marker). No band names, no logos. */
'use strict';
const V = require('./_v2-lib');
const { text, rect, ellipse, line, page, ctext, ltext, dk, make, C, tent, TISCH_META, MENU, dekoIn, dekoWindow } = V;

const S = { variant: 'Rock & Metal', bg: '#1c1c1c', bone: '#f2efe8', red: '#d12f45', grey: '#8d8a84', disp: 'Anton', cond: 'Oswald', marker: 'Permanent Marker' };
const TAGS = ['Hochzeit', 'Rock', 'Metal', 'Rocker', 'Totenkopf', 'Gitarre', 'schwarz', 'düster', 'Gothic', 'Brautpaar'];
const DISP = (o) => Object.assign({ f: S.disp, c: S.bone, lh: 1 }, o);
const COND = (o) => Object.assign({ f: S.cond, c: S.bone, w: 400 }, o);
const MARK = (o) => Object.assign({ f: S.marker, c: S.red }, o);
/** Scratches in the colour of the paper over a part of the page: the worn print. */
const worn = (name, x, y, w, h, ax = 0.5, ay = 0.5) => dekoWindow(name, 'deko-motive-verschleiss-schwarz', x, y, w, h, { locked: true, ax, ay });

const std = make('std', S, {
  slug: 'save-the-date-rock-metal', name: 'Save the Date – Rock & Metal',
  description: 'Save-the-Date-Postkarte A6 hoch in Schwarz: Totenkopf mit roten Rosen, die Namen in fetter Schmalschrift mit abgenutzter Kratzer-Textur, Stacheldraht oben. Die Rückseite kündigt eine laute Hochzeit an. Ohne Bandnamen oder Logos.',
  tags: [...TAGS, 'Save the Date', 'Termin', 'Postkarte', 'Rosen'],
  formatKey: 'postcard-a6-portrait', width: 105, height: 148,
  pages: [
    page(S.bg, [
      dk('Stacheldraht', 'deko-motive-stacheldraht-weiss', 6, 5, 93),
      dk('Totenkopf', 'deko-motive-totenkopf-rosen', 14, 18, 77),
      ctext('Name 1', 52.5, 84, 90, 17, 'ANNA', DISP({ s: 44, min: 24 })),
      ctext('Und', 52.5, 99, 20, 10, '&', MARK({ s: 24, min: 12 })),
      ctext('Name 2', 52.5, 105, 90, 17, 'JONAS', DISP({ s: 44, min: 24 })),
      ctext('Save the Date', 52.5, 128, 90, 6, 'SAVE THE DATE · 12.06.2027', COND({ s: 9.5, w: 700, c: S.red, ls: 0.25, min: 7 })),
      worn('Verschleiß', 0, 80, 105, 48, 0.2, 0.3),
    ], 'Vorderseite'),
    page(S.bg, [
      dk('Blitz', 'deko-motive-blitz-rose', 46, 12, 13),
      ctext('Titel', 52.5, 34, 90, 40, 'ES WIRD\nLAUT!', DISP({ s: 40, wrap: true, v: 'top', lh: 1.05, min: 22 })),
      ctext('Text', 52.5, 80, 70, 28, 'Wir heiraten und feiern mit Livemusik, kaltem Bier und euch. Bitte merkt euch den Tag vor, die Einladung folgt.', COND({ s: 10.5, w: 300, wrap: true, v: 'top', lh: 1.5, min: 7, a: 'center' })),
      ctext('Ort', 52.5, 112, 70, 6, C.place.toUpperCase() + ' · ' + C.city.toUpperCase(), COND({ s: 8, w: 700, c: S.red, ls: 0.2, min: 7 })),
      dk('Rosenranke', 'deko-motive-rosenranke', 6, 124, 93),
    ], 'Rückseite'),
  ],
});

const einl = make('flach', S, {
  slug: 'hochzeit-einladung-flach-rock-metal', name: 'Hochzeit Einladung – Rock & Metal', formatKey: 'a5-portrait', width: 148, height: 210,
  description: 'Flache Einladungskarte A5 hoch in Schwarz: Stacheldraht, die Namen in Anton mit Kratzer-Textur, rote Schreibschrift-Markierung, eine E-Gitarre und Rosenranke am Fuß. Für Paare, die laut und dunkel feiern. Ohne Bandnamen oder Logos.',
  tags: [...TAGS, 'Einladung', 'Einladungskarte', 'A5', 'E-Gitarre', 'Rosen'],
  pages: [page(S.bg, [
    dk('Stacheldraht', 'deko-motive-stacheldraht-weiss', 12, 10, 124),
    ltext('Kopf', 12, 28, 100, 7, 'WIR HEIRATEN. LAUT.', COND({ s: 10, w: 700, c: S.red, ls: 0.25, min: 7 })),
    ltext('Name 1', 12, 38, 124, 34, 'ANNA', DISP({ s: 80, min: 40 })),
    ltext('Und', 12, 71, 30, 14, '&', MARK({ s: 38, min: 20 })),
    ltext('Name 2', 12, 84, 124, 34, 'JONAS', DISP({ s: 80, min: 40 })),
    worn('Verschleiß', 0, 34, 148, 88, 0.3, 0.3),
    ltext('Datum', 12, 130, 76, 9, 'SAMSTAG, 12. JUNI 2027', COND({ s: 13, w: 700, ls: 0.1, min: 8 })),
    ltext('Zeit', 12, 141, 70, 7, 'TRAUUNG 14:00 UHR', COND({ s: 11, w: 400, c: S.grey, ls: 0.15, min: 7 })),
    ltext('Ort', 12, 152, 70, 14, C.place + '\nBirkenallee 4, 12345 Musterstadt', COND({ s: 11.5, w: 300, wrap: true, v: 'top', lh: 1.4, min: 7 })),
    ltext('Antwort', 12, 172, 68, 10, 'Zusage bis zum 1. Mai 2027', COND({ s: 10, w: 400, c: S.red, min: 7 })),
    dk('Gitarre', 'deko-motive-e-gitarre', 84, 118, 60),
    dk('Rosenranke', 'deko-motive-rosenranke', 12, 190, 124),
  ], 'Einladung')],
});

const tisch = make('tisch', S, Object.assign({}, TISCH_META, {
  slug: 'hochzeit-tischkarte-rock-metal', name: 'Hochzeit Tischkarte – Rock & Metal',
  description: 'Tischkarte als Zeltkarte (gefaltet 90 × 50 mm) in Schwarz: der Name des Gastes in Anton, die Tischnummer in Rot, Stacheldraht als Kante. Innen ein Totenkopf mit Rosen. Für Serien mit Gästelisten.',
  tags: [...TAGS, 'Tischkarte', 'Platzkarte', 'Namenskarte', 'Zeltkarte', 'Gäste', 'Serie'],
  pages: tent(y => [
    dk('Stacheldraht', 'deko-motive-stacheldraht-weiss', 5, y + 4, 80),
    ctext('Name', 45, y + 14, 74, 15, '{{Name}}', DISP({ s: 22, min: 9 })),
    ctext('Tisch', 45, y + 32, 60, 7, 'TISCH {{Tisch}}', COND({ s: 10, w: 700, c: S.red, ls: 0.3, min: 7 })),
    worn('Verschleiß', 0, y + 8, 90, 26, 0.3, 0.5),
  ], [
    dk('Totenkopf', 'deko-motive-totenkopf-rosen', 27, 54, 36),
    ctext('Namen', 45, 86, 74, 8, 'ANNA & JONAS', DISP({ s: 14, min: 8 })),
  ], S.bg),
}));

const menue = make('menue', S, {
  slug: 'hochzeit-menuekarte-rock-metal', name: 'Hochzeit Menükarte – Rock & Metal', formatKey: 'menu-dl', width: 99, height: 210,
  description: 'Menükarte DIN lang in Schwarz als „Tracklist“: die Gänge sind nummerierte Titel mit roten Überschriften, oben ein Blitz, unten die Rosenranke. Gerichte einfach überschreiben. Ohne Bandnamen oder Logos.',
  tags: [...TAGS, 'Menükarte', 'Menü', 'Speisekarte', 'DIN lang', 'Tracklist', 'Setlist'],
  pages: [page(S.bg, [
    ltext('Titel', 10, 12, 70, 18, 'TRACKLIST', DISP({ s: 38, min: 22 })),
    dk('Blitz', 'deko-motive-blitz-rose', 80, 8, 10),
    ltext('Untertitel', 10, 31, 80, 6, 'ANNA & JONAS · LIVE · 12.06.2027', COND({ s: 7.5, w: 400, c: S.grey, ls: 0.2, min: 7 })),
    line('Linie', 10, 42, 89, 42, S.red, 0.4, { locked: true }),
    ...MENU.flatMap(([course, dish], i) => {
      const y = 48 + i * 27;
      return [
        ltext('Nr ' + (i + 1), 10, y, 10, 8, '0' + (i + 1), COND({ s: 16, w: 700, c: S.red, min: 8 })),
        ltext('Gang ' + (i + 1), 22, y, 66, 7, course.toUpperCase(), COND({ s: 12, w: 700, ls: 0.1, min: 7 })),
        ltext('Gericht ' + (i + 1), 22, y + 7.5, 68, 15, dish, COND({ s: 10.5, w: 300, c: S.bone, wrap: true, v: 'top', lh: 1.3, min: 7 })),
      ];
    }),
    dk('Rosenranke', 'deko-motive-rosenranke', 7, 188, 85),
  ], 'Menükarte')],
});

const danke = make('danke', S, {
  slug: 'hochzeit-danksagung-rock-metal', name: 'Hochzeit Danksagung – Rock & Metal',
  description: 'Danksagungskarte als Postkarte A6 quer in Schwarz: vorne Totenkopf mit Rosen und „Thanks for rocking“, hinten ein Gruß mit E-Gitarre und Rosenranke. Für Paare mit Hang zu Rock und Metal. Ohne Bandnamen oder Logos.',
  tags: [...TAGS, 'Danksagung', 'Danke', 'Dankeskarte', 'Postkarte'],
  formatKey: 'postcard-a6-landscape', width: 148, height: 105,
  pages: [
    page(S.bg, [
      dk('Totenkopf', 'deko-motive-totenkopf-rosen', 8, 22, 62),
      ltext('Thanks', 76, 20, 66, 24, 'THANKS', DISP({ s: 46, min: 24 })),
      ltext('For rocking', 76, 44, 66, 12, 'for rocking', MARK({ s: 22, min: 12 })),
      ltext('With us', 76, 58, 66, 14, 'WITH US', DISP({ s: 30, min: 16 })),
      ltext('Namen', 76, 78, 64, 8, 'ANNA & JONAS', COND({ s: 11, w: 700, c: S.red, ls: 0.25, min: 7 })),
      worn('Verschleiß', 70, 18, 78, 60, 0.4, 0.4),
    ], 'Vorderseite'),
    page(S.bg, [
      dk('Stacheldraht', 'deko-motive-stacheldraht-weiss', 10, 8, 128),
      ltext('Titel', 12, 24, 100, 12, 'DANKE FÜR DEN LÄRM!', DISP({ s: 22, min: 12 })),
      ltext('Text', 12, 40, 80, 38, 'Ihr habt mit uns gefeiert, geschwitzt und mitgegrölt. Danke für eure Geschenke, eure Wünsche und eine Nacht, die wir nie vergessen.', COND({ s: 10.5, w: 300, wrap: true, v: 'top', lh: 1.5, min: 7 })),
      ltext('Gruß', 12, 82, 76, 10, 'Anna & Jonas', MARK({ s: 18, min: 10 })),
      dk('Gitarre', 'deko-motive-e-gitarre', 104, 26, 36),
    ], 'Rückseite'),
  ],
});

module.exports = { std, einl, tisch, menue, danke };
