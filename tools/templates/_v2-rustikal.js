/* Style line "Rustikal" (Scheune): kraft paper, wooden boards, string lights, mason jars, stitched labels, Amatic and Lora. */
'use strict';
const V = require('./_v2-lib');
const { text, rect, ellipse, line, page, ctext, ltext, dk, make, C, tent, TISCH_META, MENU, dekoIn } = V;

const S = { variant: 'Rustikal', kraft: '#d8bd93', kraft2: '#c7a678', cream: '#fbf4e4', ink: '#3b2a1a', green: '#5f7a4f', red: '#9c3f2a', disp: 'Amatic SC', body: 'Lora', hand: 'Caveat' };
const TAGS = ['Hochzeit', 'Rustikal', 'Scheune', 'Landhaus', 'Kraftpapier', 'Holz', 'Lichterkette', 'Vintage', 'Brautpaar'];
const DISP = (o) => Object.assign({ f: S.disp, w: 700, c: S.ink }, o);
const BODY = (o) => Object.assign({ f: S.body, c: S.ink }, o);
const HAND = (o) => Object.assign({ f: S.hand, w: 700, c: S.red }, o);
/** A cream label with a stitched seam. */
const label = (name, x, y, w, h) => [rect(name, x, y, w, h, S.cream, { locked: true }), rect(name + ' Naht', x + 2.5, y + 2.5, w - 5, h - 5, null, { stroke: S.kraft2, sw: 0.6, dash: 'dashed', locked: true })];

const std = make('std', S, {
  slug: 'save-the-date-rustikal', name: 'Save the Date – Rustikal',
  description: 'Save-the-Date-Postkarte A6 quer auf Kraftpapier: warme Lichterkette oben, ein cremefarbenes Etikett mit gesteppter Naht, Namen in Amatic. Die Rückseite mit Holzherz kündigt die Scheunenhochzeit an.',
  tags: [...TAGS, 'Save the Date', 'Termin', 'Postkarte'],
  formatKey: 'postcard-a6-landscape', width: 148, height: 105,
  pages: [
    page(S.kraft, [
      ...label('Etikett', 16, 36, 116, 62),
      dk('Lichterkette', 'deko-motive-lichterkette', 0, 0, 148),
      ctext('Save the Date', 74, 41, 100, 6, 'SAVE THE DATE', BODY({ s: 7.5, w: 700, c: S.red, ls: 0.3, min: 7 })),
      ctext('Namen', 74, 48, 108, 22, 'ANNA & JONAS', DISP({ s: 52, lh: 1, min: 24 })),
      ctext('Datum', 74, 71, 100, 9, C.dateShort, BODY({ s: 14, w: 700, min: 9 })),
      ctext('Ort', 74, 82, 100, 7, C.place + ' · ' + C.city, BODY({ s: 9, i: true, min: 7 })),
    ], 'Vorderseite'),
    page(S.cream, [
      rect('Rahmen', 5, 5, 138, 95, null, { stroke: S.kraft2, sw: 0.6, dash: 'dashed', locked: true }),
      dk('Holzherz', 'deko-motive-holzherz', 14, 16, 42),
      ctext('Titel', 100, 18, 80, 18, 'Wir heiraten!', HAND({ s: 30, min: 16 })),
      ctext('Text', 100, 40, 76, 34, 'Haltet euch den Tag frei: Wir feiern in der Scheune mit Lichterkette, Heu und Livemusik. Die Einladung folgt.', BODY({ s: 9.5, wrap: true, v: 'top', lh: 1.5, min: 7, a: 'center' })),
      ctext('Ort', 100, 80, 80, 6, C.place.toUpperCase(), BODY({ s: 7.5, w: 700, c: S.green, ls: 0.2, min: 7 })),
    ], 'Rückseite'),
  ],
});

const einl = make('flach', S, {
  slug: 'hochzeit-einladung-flach-rustikal', name: 'Hochzeit Einladung – Rustikal', formatKey: 'din-lang-portrait', width: 99, height: 210,
  description: 'Einladung im Format DIN lang auf Kraftpapier: Lichterkette, ein Holzschild mit den Namen in Amatic, darunter Datum, Ort und Antwortwunsch auf cremefarbenem Etikett und Wiesenblumen am Fuß. Scheunenhochzeit, Landhaus, Gartenfest.',
  tags: [...TAGS, 'Einladung', 'Einladungskarte', 'DIN lang', 'Holzschild', 'Wiesenblumen'],
  pages: [page(S.kraft, [
    dk('Lichterkette', 'deko-motive-lichterkette', 0, 0, 99),
    dk('Holzschild', 'deko-motive-holzschild', 9, 24, 81),
    ctext('Name 1', 49.5, 45, 56, 17, 'ANNA', DISP({ s: 44, lh: 1, min: 24 })),
    ctext('Und', 49.5, 59, 20, 7, 'und', HAND({ s: 15, c: S.ink, min: 9 })),
    ctext('Name 2', 49.5, 65, 56, 17, 'JONAS', DISP({ s: 44, lh: 1, min: 24 })),
    ...label('Etikett', 10, 106, 79, 70),
    ctext('Einladung', 49.5, 111, 66, 8, 'Wir heiraten!', HAND({ s: 22, min: 12 })),
    ctext('Datum', 49.5, 122, 70, 8, C.date, BODY({ s: 12, w: 700, min: 7 })),
    ctext('Zeit', 49.5, 131, 70, 6, 'Trauung um 14:00 Uhr', BODY({ s: 10.5, min: 7 })),
    ctext('Ort', 49.5, 142, 70, 12, C.place + '\nBirkenallee 4, Musterstadt', BODY({ s: 10.5, i: true, wrap: true, v: 'top', lh: 1.35, min: 7, a: 'center' })),
    ctext('Antwort', 49.5, 160, 70, 10, 'Um Antwort bitten wir\nbis zum 1. Mai 2027', BODY({ s: 9, wrap: true, v: 'top', lh: 1.3, c: S.green, min: 7, a: 'center' })),
    dekoIn('Wiese', 'deko-blumen-wiese', 0, 178, 99, 32, { locked: true }),
  ], 'Einladung')],
});

const tisch = make('tisch', S, Object.assign({}, TISCH_META, {
  slug: 'hochzeit-tischkarte-rustikal', name: 'Hochzeit Tischkarte – Rustikal',
  description: 'Tischkarte als Zeltkarte (gefaltet 90 × 50 mm) auf Kraftpapier mit gestepptem Etikett: der Name des Gastes in Amatic, die Tischnummer in Lora. Innen eine Baumscheibe mit den Namen des Paares. Für Serien mit Gästelisten.',
  tags: [...TAGS, 'Tischkarte', 'Platzkarte', 'Namenskarte', 'Zeltkarte', 'Gäste', 'Serie'],
  pages: tent(y => [
    ...label('Etikett', 6, y + 6, 78, 38),
    ctext('Name', 45, y + 12, 66, 15, '{{Name}}', DISP({ s: 30, lh: 1, min: 12 })),
    line('Strich', 35, y + 31, 55, y + 31, S.kraft2, 0.4, { locked: true }),
    ctext('Tisch', 45, y + 33, 60, 6, 'TISCH {{Tisch}}', BODY({ s: 7.5, w: 700, c: S.red, ls: 0.2, min: 7 })),
  ], [
    dk('Baumscheibe', 'deko-motive-baumscheibe', 22, 57, 46),
    ctext('Namen', 45, 70, 40, 12, 'ANNA & JONAS', DISP({ s: 20, lh: 1, min: 10 })),
    ctext('Datum', 45, 81, 40, 5, C.dateNum, BODY({ s: 7, w: 700, min: 7 })),
  ], S.kraft),
}));

const menue = make('menue', S, {
  slug: 'hochzeit-menuekarte-rustikal', name: 'Hochzeit Menükarte – Rustikal', formatKey: 'menu-dl', width: 99, height: 210,
  description: 'Menükarte DIN lang auf Kraftpapier: ein Holzschild mit „Menü“ in Amatic, die Gänge auf einem gesteppten cremefarbenen Etikett mit handgeschriebenen Überschriften. Landhaus, Scheune, Gartenfest.',
  tags: [...TAGS, 'Menükarte', 'Menü', 'Speisekarte', 'DIN lang', 'Gänge'],
  pages: [page(S.kraft, [
    dk('Holzschild', 'deko-motive-holzschild', 14, 4, 71),
    ctext('Titel', 49.5, 27, 56, 22, 'MENÜ', DISP({ s: 48, lh: 1, min: 24 })),
    ...label('Etikett', 7, 66, 85, 133),
    ...MENU.flatMap(([course, dish], i) => {
      const y = 73 + i * 24.5;
      return [
        ctext('Gang ' + (i + 1), 49.5, y, 70, 7, course, HAND({ s: 16, min: 9 })),
        ctext('Gericht ' + (i + 1), 49.5, y + 7, 72, 14, dish, BODY({ s: 10.5, wrap: true, v: 'top', lh: 1.25, min: 7, a: 'center' })),
      ];
    }),
  ], 'Menükarte')],
});

const danke = make('danke', S, {
  slug: 'hochzeit-danksagung-rustikal', name: 'Hochzeit Danksagung – Rustikal',
  description: 'Danksagungskarte als Postkarte A6 quer auf Kraftpapier: vorne ein Einmachglas mit Wiesenblumen und „DANKE“ in Amatic, hinten ein cremefarbenes Etikett für den persönlichen Gruß. Scheune, Landhaus, Gartenfest.',
  tags: [...TAGS, 'Danksagung', 'Danke', 'Dankeskarte', 'Postkarte', 'Einmachglas'],
  formatKey: 'postcard-a6-landscape', width: 148, height: 105,
  pages: [
    page(S.kraft, [
      dk('Einmachglas', 'deko-motive-einmachglas', 14, 8, 56),
      ctext('Danke', 110, 20, 80, 38, 'DANKE', DISP({ s: 90, lh: 1, min: 40 })),
      line('Strich', 90, 62, 130, 62, S.ink, 0.4, { locked: true }),
      ctext('Namen', 110, 66, 70, 10, 'Anna & Jonas', HAND({ s: 22, c: S.ink, min: 12 })),
      ctext('Datum', 110, 79, 60, 5, C.dateNum, BODY({ s: 7.5, w: 700, c: S.red, ls: 0.2, min: 7 })),
    ], 'Vorderseite'),
    page(S.kraft, [
      ...label('Etikett', 10, 10, 128, 85),
      ctext('Titel', 74, 17, 100, 12, 'Von Herzen danke!', HAND({ s: 24, min: 14 })),
      ctext('Text', 74, 34, 106, 34, 'Ihr habt mit uns gefeiert, getanzt und gelacht. Danke für eure Geschenke, eure Wünsche und diesen wunderbaren Tag in der Scheune.', BODY({ s: 10, wrap: true, v: 'top', lh: 1.5, min: 7, a: 'center' })),
      ctext('Gruß', 74, 74, 90, 9, 'Eure Anna & Jonas', BODY({ s: 12, i: true, min: 8 })),
    ], 'Rückseite'),
  ],
});

module.exports = { std, einl, tisch, menue, danke };
