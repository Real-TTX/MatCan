/* Style line "Winter": midnight blue and ice, ice crystals, snowy branches, holly, a little gold. */
'use strict';
const V = require('./_v2-lib');
const { text, rect, ellipse, line, page, ctext, ltext, dk, make, C, tent, TISCH_META, MENU, dekoIn, foldCard } = V;

const S = { variant: 'Winter', navy: '#1f2f5c', ice: '#e8f0f9', frost: '#8fb4d9', white: '#ffffff', gold: '#c9a04e', script: 'Great Vibes', serif: 'Cormorant Garamond', caps: 'Josefin Sans' };
const TAGS = ['Hochzeit', 'Winter', 'Winterhochzeit', 'Schnee', 'Eiskristall', 'Schneeflocken', 'Weihnachten', 'Nachtblau', 'Brautpaar'];
const SCR = (o) => Object.assign({ f: S.script, c: S.white }, o);
const SER = (o) => Object.assign({ f: S.serif, c: S.navy, w: 500 }, o);
const CAP = (o) => Object.assign({ f: S.caps, c: S.gold, w: 600, ls: 0.3 }, o);

const std = make('std', S, {
  slug: 'save-the-date-winter', name: 'Save the Date – Winter',
  description: 'Save-the-Date-Postkarte A6 hoch für eine Winterhochzeit: Mitternachtsblau mit großem Eiskristall, Namen in weißer Schreibschrift, Goldfunkeln und ein verschneiter Zweig am Fuß. Die Rückseite in Eisblau mit Stechpalme kündigt die Einladung an.',
  tags: [...TAGS, 'Save the Date', 'Termin', 'Postkarte'],
  formatKey: 'postcard-a6-portrait', width: 105, height: 148,
  pages: [
    page(S.navy, [
      dk('Kristall', 'deko-motive-eiskristall-weiss', 12, 14, 81, undefined, { opacity: 0.16 }),
      dk('Funkeln', 'deko-sterne-funkeln-gold', 80, 14, 12),
      ctext('Save the Date', 52.5, 34, 80, 6, 'SAVE THE DATE', CAP({ s: 7.5, min: 7 })),
      ctext('Name 1', 52.5, 44, 90, 20, 'Anna', SCR({ s: 46, min: 24 })),
      ctext('Und', 52.5, 62, 20, 8, '&', SER({ s: 18, c: S.gold, i: true, min: 10 })),
      ctext('Name 2', 52.5, 68, 90, 20, 'Jonas', SCR({ s: 46, min: 24 })),
      ctext('Datum', 52.5, 94, 80, 9, C.dateShort, SER({ s: 16, c: S.white, w: 600, min: 9 })),
      dk('Zweig', 'deko-motive-schneezweig-weiss', 13, 104, 80),
    ], 'Vorderseite'),
    page(S.ice, [
      dk('Stechpalme', 'deko-motive-stechpalme', 25, 16, 55),
      ctext('Titel', 52.5, 52, 86, 18, 'Wir heiraten', SCR({ s: 36, c: S.navy, min: 18 })),
      ctext('Text', 52.5, 76, 70, 38, 'Bitte merkt euch den Tag vor. Wir feiern mitten im Winter, mit Kerzenlicht, Glühwein und warmem Herzen. Die Einladung folgt.', SER({ s: 12, wrap: true, v: 'top', lh: 1.5, min: 8, a: 'center' })),
      ctext('Ort', 52.5, 122, 70, 6, C.place.toUpperCase(), CAP({ s: 7, c: S.navy, min: 7 })),
    ], 'Rückseite'),
  ],
});

const einl = make('klapp', S, {
  slug: 'hochzeit-einladung-klapp-winter', name: 'Hochzeit Einladung (Klappkarte) – Winter', formatKey: 'card-square-145', fold: 'vertical', width: 290, height: 145,
  description: 'Quadratische Klappkarte (145 mm) für eine Winterhochzeit: vorne Mitternachtsblau mit Eiskristall und Namen in Schreibschrift, hinten ein verschneiter Zweig, innen Eisblau mit Einladungstext und Eckdaten. Passt zum Save the Date.',
  tags: [...TAGS, 'Einladung', 'Klappkarte', 'Einladungskarte', 'quadratisch'],
  pages: foldCard('vertical', [
    rect('Hintergrund hinten', 0, 0, 145, 145, S.ice, { locked: true }),
    dk('Zweig', 'deko-motive-schneezweig-navy', 12, 44, 121),
    ctext('Rückseite', 72.5, 112, 90, 10, 'in Liebe', SCR({ s: 22, c: S.navy, min: 12 })),
    dk('Kristall', 'deko-motive-eiskristall-weiss', 182, 14, 72, undefined, { opacity: 0.16 }),
    ctext('Kopf', 217.5, 30, 90, 6, 'WIR HEIRATEN', CAP({ s: 8, min: 7 })),
    ctext('Name 1', 217.5, 40, 100, 24, 'Anna', SCR({ s: 54, min: 28 })),
    ctext('Und', 217.5, 63, 20, 9, '&', SER({ s: 20, c: S.gold, i: true, min: 10 })),
    ctext('Name 2', 217.5, 70, 100, 24, 'Jonas', SCR({ s: 54, min: 28 })),
    ctext('Datum', 217.5, 100, 90, 9, C.dateShort, SER({ s: 17, c: S.white, w: 600, min: 9 })),
    ctext('Ort', 217.5, 112, 90, 6, C.place.toUpperCase(), CAP({ s: 7.5, c: S.frost, min: 7 })),
  ], [
    ctext('Anrede', 72.5, 16, 112, 12, 'Liebe Familie, liebe Freunde,', SCR({ s: 26, c: S.navy, min: 14 })),
    ctext('Text', 72.5, 34, 104, 56, 'mitten im Winter, wenn draußen der Schnee fällt, wollen wir drinnen unsere Herzen wärmen und Ja sagen. Wir laden euch ein, diesen Tag mit uns zu feiern.', SER({ s: 12.5, wrap: true, v: 'top', lh: 1.5, min: 8, a: 'center' })),
    dk('Zweig', 'deko-motive-stechpalme', 52, 94, 40),
    ctext('Wann', 217.5, 18, 100, 5, 'WANN', CAP({ s: 7, c: S.gold, min: 7 })),
    ctext('Wann Wert', 217.5, 24, 110, 15, C.date + '\nTrauung um 14:00 Uhr', SER({ s: 14, wrap: true, v: 'top', lh: 1.3, min: 8, a: 'center' })),
    ctext('Wo', 217.5, 48, 100, 5, 'WO', CAP({ s: 7, c: S.gold, min: 7 })),
    ctext('Wo Wert', 217.5, 54, 110, 15, C.place + '\nBirkenallee 4, 12345 Musterstadt', SER({ s: 14, wrap: true, v: 'top', lh: 1.3, min: 8, a: 'center' })),
    ctext('Danach', 217.5, 78, 100, 5, 'DANACH', CAP({ s: 7, c: S.gold, min: 7 })),
    ctext('Danach Wert', 217.5, 84, 110, 15, 'Festessen am Kaminfeuer,\nGlühwein und Tanz', SER({ s: 14, wrap: true, v: 'top', lh: 1.3, min: 8, a: 'center' })),
    ctext('Antwort', 217.5, 112, 110, 8, C.reply, SER({ s: 12, i: true, min: 8 })),
  ], S.navy, S.ice),
});

const tisch = make('tisch', S, Object.assign({}, TISCH_META, {
  slug: 'hochzeit-tischkarte-winter', name: 'Hochzeit Tischkarte – Winter',
  description: 'Tischkarte als Zeltkarte (gefaltet 90 × 50 mm) für eine Winterhochzeit: Eisblau mit kleinen Eiskristallen, der Name des Gastes in Mitternachtsblau, die Tischnummer in Gold. Innen ein verschneiter Zweig. Für Serien mit Gästelisten.',
  tags: [...TAGS, 'Tischkarte', 'Platzkarte', 'Namenskarte', 'Zeltkarte', 'Gäste', 'Serie'],
  pages: tent(y => [
    dk('Kristall links', 'deko-motive-eiskristall-navy', 5, y + 6, 12),
    dk('Kristall rechts', 'deko-motive-eiskristall-navy', 73, y + 6, 12),
    ctext('Name', 45, y + 12, 52, 15, '{{Name}}', SCR({ s: 22, c: S.navy, min: 9 })),
    line('Strich', 35, y + 31, 55, y + 31, S.gold, 0.4, { locked: true }),
    ctext('Tisch', 45, y + 34, 60, 6, 'TISCH {{Tisch}}', CAP({ s: 8, min: 7 })),
  ], [
    dk('Zweig', 'deko-motive-schneezweig-weiss', 15, 56, 60),
    ctext('Namen', 45, 82, 74, 9, 'Anna & Jonas', SCR({ s: 20, min: 10 })),
    ctext('Datum', 45, 92, 70, 5, C.dateNum, CAP({ s: 7, c: S.frost, min: 7 })),
  ], S.ice, S.navy),
}));

const menue = make('menue', S, {
  slug: 'hochzeit-menuekarte-winter', name: 'Hochzeit Menükarte – Winter', formatKey: 'menu-dl', width: 99, height: 210,
  description: 'Menükarte DIN lang für eine Winterhochzeit: Eisblau mit Stechpalme und „Menü“ in Schreibschrift, die Gänge in Mitternachtsblau mit goldenen Überschriften, am Fuß ein verschneiter Zweig. Gerichte einfach überschreiben.',
  tags: [...TAGS, 'Menükarte', 'Menü', 'Speisekarte', 'DIN lang', 'Gänge'],
  pages: [page(S.ice, [
    dk('Stechpalme', 'deko-motive-stechpalme', 27, 6, 45),
    ctext('Titel', 49.5, 34, 70, 16, 'Menü', SCR({ s: 36, c: S.navy, min: 18 })),
    ...MENU.flatMap(([course, dish], i) => {
      const y = 54 + i * 24;
      return [
        ctext('Gang ' + (i + 1), 49.5, y, 76, 5, course.toUpperCase(), CAP({ s: 7, min: 7 })),
        ctext('Gericht ' + (i + 1), 49.5, y + 5.5, 80, 16, dish, SER({ s: 11, wrap: true, v: 'top', lh: 1.25, min: 7, a: 'center' })),
      ];
    }),
    dk('Zweig', 'deko-motive-schneezweig-navy', 14, 176, 71),
  ], 'Menükarte')],
});

const danke = make('danke', S, {
  slug: 'hochzeit-danksagung-winter', name: 'Hochzeit Danksagung – Winter',
  description: 'Danksagungskarte als Postkarte A6 quer für eine Winterhochzeit: vorne „Danke“ in weißer Schreibschrift auf Mitternachtsblau mit Eiskristall, hinten ein herzlicher Gruß auf Eisblau mit Stechpalme.',
  tags: [...TAGS, 'Danksagung', 'Danke', 'Dankeskarte', 'Postkarte'],
  formatKey: 'postcard-a6-landscape', width: 148, height: 105,
  pages: [
    page(S.navy, [
      dk('Kristall', 'deko-motive-eiskristall-weiss', 8, 14, 77, undefined, { opacity: 0.16 }),
      dk('Funkeln', 'deko-sterne-funkeln-gold', 118, 12, 12),
      ctext('Danke', 90, 24, 96, 30, 'Danke', SCR({ s: 62, min: 30 })),
      line('Strich', 78, 62, 102, 62, S.gold, 0.4, { locked: true }),
      ctext('Namen', 90, 66, 90, 10, 'Anna & Jonas', SER({ s: 18, c: S.white, i: true, min: 10 })),
      ctext('Datum', 90, 78, 70, 5, C.dateNum, CAP({ s: 7, c: S.frost, min: 7 })),
    ], 'Vorderseite'),
    page(S.ice, [
      dk('Stechpalme', 'deko-motive-stechpalme', 10, 52, 40),
      ctext('Titel', 90, 14, 90, 14, 'Von Herzen', SCR({ s: 30, c: S.navy, min: 14 })),
      ctext('Text', 90, 34, 84, 40, 'Ihr habt unseren Wintertag zum schönsten Fest gemacht. Danke für eure Wärme, eure Geschenke und alle guten Wünsche.', SER({ s: 12, wrap: true, v: 'top', lh: 1.5, min: 8, a: 'center' })),
      ctext('Gruß', 90, 82, 80, 9, 'Eure Anna & Jonas', SCR({ s: 20, c: S.navy, min: 10 })),
    ], 'Rückseite'),
  ],
});

module.exports = { std, einl, tisch, menue, danke };
