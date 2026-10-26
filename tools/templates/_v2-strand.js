/* Style line "Strand": sand, sea blue and coral, wave edges, sailing boat, shell and starfish, Dancing Script and Josefin Sans. */
'use strict';
const V = require('./_v2-lib');
const { text, rect, ellipse, line, page, ctext, ltext, dk, make, C, tent, TISCH_META, MENU, dekoIn } = V;

const S = { variant: 'Strand', sand: '#f6ecd9', sky: '#d7eeee', navy: '#1f4e79', sea: '#2a7fa6', coral: '#e8896a', white: '#ffffff', ink: '#1f3a52', script: 'Dancing Script', caps: 'Josefin Sans', serif: 'Raleway' };
const TAGS = ['Hochzeit', 'Strand', 'Meer', 'maritim', 'Sommer', 'Küste', 'Boot', 'Muschel', 'Urlaub', 'Brautpaar'];
const SCR = (o) => Object.assign({ f: S.script, w: 700, c: S.navy }, o);
const CAP = (o) => Object.assign({ f: S.caps, w: 600, c: S.coral, ls: 0.3 }, o);
const BODY = (o) => Object.assign({ f: S.serif, w: 500, c: S.ink }, o);

const std = make('std', S, {
  slug: 'save-the-date-strand', name: 'Save the Date – Strand',
  description: 'Save-the-Date-Postkarte A6 quer für eine Hochzeit am Meer: Sonne, Segelboot und Wellen in Marineblau auf Sand, Namen in fließender Schreibschrift. Die Rückseite mit Muschel und Seestern kündigt die Einladung an.',
  tags: [...TAGS, 'Save the Date', 'Termin', 'Postkarte', 'Wellen'],
  formatKey: 'postcard-a6-landscape', width: 148, height: 105,
  pages: [
    page(S.sand, [
      dk('Sonne', 'deko-formen-sonne-gold', 112, 6, 28),
      dk('Boot', 'deko-motive-segelboot-navy', 96, 40, 24),
      dk('Wellen', 'deko-formen-wellenrand-navy', 0, 71, 148),
      ctext('Save the Date', 64, 12, 100, 6, 'SAVE THE DATE', CAP({ s: 7.5, min: 7 })),
      ctext('Namen', 64, 22, 112, 22, 'Anna & Jonas', SCR({ s: 42, min: 22 })),
      ctext('Datum', 64, 46, 100, 8, C.dateShort, BODY({ s: 14, w: 600, min: 8 })),
      ctext('Ort', 64, 56, 100, 6, 'AM STRAND VON ' + C.city.toUpperCase(), CAP({ s: 7, c: S.sea, min: 7 })),
    ], 'Vorderseite'),
    page(S.navy, [
      dk('Muschel', 'deko-motive-strand-muschel', 14, 14, 26),
      dk('Seestern', 'deko-motive-seestern-koralle', 108, 54, 28),
      ctext('Titel', 74, 22, 96, 18, 'Wir heiraten', SCR({ s: 34, c: S.white, min: 18 })),
      ctext('Text', 74, 46, 84, 24, 'Packt die Sandalen ein: Wir sagen Ja am Meer. Haltet euch den Tag frei, die Einladung folgt.', BODY({ s: 10, c: S.white, wrap: true, v: 'top', lh: 1.5, min: 7, a: 'center' })),
      ctext('Datum', 74, 80, 70, 6, C.dateNum, CAP({ s: 8, c: S.sky, min: 7 })),
    ], 'Rückseite'),
  ],
});

const einl = make('flach', S, {
  slug: 'hochzeit-einladung-flach-strand', name: 'Hochzeit Einladung – Strand', formatKey: 'a5-portrait', width: 148, height: 210,
  description: 'Flache Einladungskarte A5 hoch für eine Hochzeit am Meer: oben Himmel mit Sonne und Segelboot, dann eine Wellenkante in Marineblau, darunter die Einladung in Weiß mit Muschel und Seestern. Passt zum Save the Date im selben Stil.',
  tags: [...TAGS, 'Einladung', 'Einladungskarte', 'A5', 'Segelboot'],
  pages: [page(S.navy, [
    rect('Himmel', 0, 0, 148, 70, S.sky, { locked: true }),
    dk('Sonne', 'deko-formen-sonne-gold', 100, 10, 34),
    dk('Wolke', 'deko-formen-wolke-1-weiss', 18, 14, 34),
    dk('Boot', 'deko-motive-segelboot-navy', 54, 20, 34),
    dk('Wellen', 'deko-formen-wellenrand-navy', 0, 52, 148),
    ctext('Kopf', 74, 90, 100, 6, 'WIR HEIRATEN AM MEER', CAP({ s: 8, c: S.sky, min: 7 })),
    ctext('Namen', 74, 98, 130, 26, 'Anna & Jonas', SCR({ s: 52, c: S.white, min: 28 })),
    line('Strich', 54, 130, 94, 130, S.coral, 0.4, { locked: true }),
    ctext('Datum', 74, 134, 120, 9, C.date, BODY({ s: 14, c: S.white, w: 600, min: 8 })),
    ctext('Zeit', 74, 145, 100, 7, 'Trauung um 14:00 Uhr', BODY({ s: 11.5, c: S.sky, min: 7 })),
    ctext('Ort', 74, 156, 110, 14, C.place + '\nStrandpromenade 4, 12345 Musterstadt', BODY({ s: 11.5, c: S.white, wrap: true, v: 'top', lh: 1.4, min: 7, a: 'center' })),
    ctext('Antwort', 74, 180, 110, 6, C.reply, BODY({ s: 9.5, c: S.sky, i: true, min: 7 })),
    dk('Muschel', 'deko-motive-strand-muschel', 10, 168, 24),
    dk('Seestern', 'deko-motive-seestern-koralle', 116, 166, 24),
  ], 'Einladung')],
});

const tisch = make('tisch', S, Object.assign({}, TISCH_META, {
  slug: 'hochzeit-tischkarte-strand', name: 'Hochzeit Tischkarte – Strand',
  description: 'Tischkarte als Zeltkarte (gefaltet 90 × 50 mm) für eine Hochzeit am Meer: der Name des Gastes in Schreibschrift über einer Wellenkante, die Tischnummer in Weiß auf Marineblau. Innen ein Segelboot. Für Serien mit Gästelisten.',
  tags: [...TAGS, 'Tischkarte', 'Platzkarte', 'Namenskarte', 'Zeltkarte', 'Gäste', 'Serie'],
  pages: tent(y => [
    dk('Wellen', 'deko-formen-wellenrand-navy', 0, y + 28, 90),
    ctext('Name', 45, y + 8, 74, 15, '{{Name}}', SCR({ s: 24, min: 10 })),
    ctext('Tisch', 45, y + 37, 60, 6, 'TISCH {{Tisch}}', CAP({ s: 8, c: S.white, min: 7 })),
    dk('Seestern', 'deko-motive-seestern-koralle', 77, y + 6, 8),
  ], [
    dk('Boot', 'deko-motive-segelboot-navy', 33, 56, 24),
    ctext('Namen', 45, 82, 74, 9, 'Anna & Jonas', SCR({ s: 20, min: 10 })),
    ctext('Datum', 45, 92, 70, 5, C.dateNum, CAP({ s: 7, c: S.sea, min: 7 })),
  ], S.sky),
}));

const menue = make('menue', S, {
  slug: 'hochzeit-menuekarte-strand', name: 'Hochzeit Menükarte – Strand', formatKey: 'menu-dl', width: 99, height: 210,
  description: 'Menükarte DIN lang für eine Hochzeit am Meer: Muschel und „Menü“ in Schreibschrift, die Gänge in Marineblau mit Korallen-Überschriften, am Fuß eine Wellenkante mit Seestern. Gerichte einfach überschreiben.',
  tags: [...TAGS, 'Menükarte', 'Menü', 'Speisekarte', 'DIN lang', 'Gänge'],
  pages: [page(S.sand, [
    dk('Muschel', 'deko-motive-strand-muschel', 41, 8, 17),
    ctext('Titel', 49.5, 27, 70, 16, 'Menü', SCR({ s: 36, min: 18 })),
    ...MENU.flatMap(([course, dish], i) => {
      const y = 50 + i * 26;
      return [
        ctext('Gang ' + (i + 1), 49.5, y, 76, 5, course.toUpperCase(), CAP({ s: 7, min: 7 })),
        ctext('Gericht ' + (i + 1), 49.5, y + 6, 80, 16, dish, BODY({ s: 10.5, wrap: true, v: 'top', lh: 1.3, min: 7, a: 'center' })),
      ];
    }),
    dk('Wellen', 'deko-formen-wellenrand-navy', 0, 188, 99),
    dk('Seestern', 'deko-motive-seestern-koralle', 78, 177, 14),
  ], 'Menükarte')],
});

const danke = make('danke', S, {
  slug: 'hochzeit-danksagung-strand', name: 'Hochzeit Danksagung – Strand',
  description: 'Danksagungskarte als Postkarte A6 quer für eine Hochzeit am Meer: vorne „Danke“ in Weiß auf Meerblau mit Segelboot und Wellen, hinten ein Gruß auf Sand mit Muschel. Passt zur Einladung im selben Stil.',
  tags: [...TAGS, 'Danksagung', 'Danke', 'Dankeskarte', 'Postkarte'],
  formatKey: 'postcard-a6-landscape', width: 148, height: 105,
  pages: [
    page(S.sea, [
      dk('Boot', 'deko-motive-segelboot-weiss', 100, 14, 30),
      ctext('Danke', 56, 18, 100, 32, 'Danke', SCR({ s: 64, c: S.white, min: 32 })),
      ctext('Namen', 56, 52, 90, 10, 'Anna & Jonas', SCR({ s: 22, c: S.sky, min: 12 })),
      dk('Wellen', 'deko-formen-wellenrand-navy', 0, 72, 148),
      ctext('Datum', 74, 90, 80, 6, C.dateNum, CAP({ s: 8, c: S.white, min: 7 })),
    ], 'Vorderseite'),
    page(S.sand, [
      dk('Muschel', 'deko-motive-strand-muschel', 12, 12, 24),
      dk('Seestern', 'deko-motive-seestern-koralle', 112, 12, 24),
      ctext('Titel', 74, 14, 70, 14, 'Von Herzen', SCR({ s: 28, min: 14 })),
      ctext('Text', 74, 34, 106, 36, 'Ihr habt mit uns Sand unter den Füßen und Salz auf den Lippen gefeiert. Danke für eure Geschenke, eure Wünsche und diesen unvergesslichen Tag am Meer.', BODY({ s: 10.5, wrap: true, v: 'top', lh: 1.5, min: 7, a: 'center' })),
      ctext('Gruß', 74, 76, 100, 9, 'Eure Anna & Jonas', SCR({ s: 18, c: S.coral, min: 10 })),
    ], 'Rückseite'),
  ],
});

module.exports = { std, einl, tisch, menue, danke };
