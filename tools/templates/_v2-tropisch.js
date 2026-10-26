/* Style line "Tropisch": cream and jungle green, hot pink and sun yellow, monstera, palm leaf, hibiscus, flamingo and pineapple (Pacifico, Josefin Sans, Nunito). */
'use strict';
const V = require('./_v2-lib');
const { text, rect, ellipse, line, page, ctext, ltext, dk, make, C, tent, TISCH_META, MENU, dekoIn, foldCard } = V;

const S = { variant: 'Tropisch', bg: '#fffaf0', green: '#1f6b45', pink: '#ff5d7a', yellow: '#ffc933', ink: '#1d3b2c', blush: '#ffe3e8', script: 'Pacifico', caps: 'Josefin Sans', body: 'Nunito' };
const TAGS = ['Hochzeit', 'Tropisch', 'Sommer', 'Palme', 'Hibiskus', 'Flamingo', 'Ananas', 'Hawaii', 'Dschungel', 'Brautpaar'];
const SCR = (o) => Object.assign({ f: S.script, c: S.green }, o);
const CAP = (o) => Object.assign({ f: S.caps, c: S.pink, w: 700, ls: 0.3 }, o);
const BODY = (o) => Object.assign({ f: S.body, c: S.ink, w: 600 }, o);

const std = make('std', S, {
  slug: 'save-the-date-tropisch', name: 'Save the Date – Tropisch',
  description: 'Save-the-Date-Postkarte A6 quer für eine Sommerhochzeit: Palmenblatt und Hibiskus in Dschungelgrün und Pink, Namen in Pacifico. Die Rückseite in Rosa mit Flamingo und Ananas kündigt die Party an.',
  tags: [...TAGS, 'Save the Date', 'Termin', 'Postkarte'],
  formatKey: 'postcard-a6-landscape', width: 148, height: 105,
  pages: [
    page(S.bg, [
      dk('Palmenblatt', 'deko-motive-palmenblatt', 78, 4, 64),
      dk('Hibiskus', 'deko-motive-hibiskus', 108, 58, 34),
      ctext('Save the Date', 46, 16, 76, 6, 'SAVE THE DATE', CAP({ s: 7.5, min: 7 })),
      ctext('Namen', 46, 26, 80, 34, 'Anna\n& Jonas', SCR({ s: 34, lh: 1.15, wrap: true, v: 'top', min: 18 })),
      ctext('Datum', 46, 66, 76, 9, C.dateShort, BODY({ s: 15, w: 800, c: S.green, min: 9 })),
      ctext('Ort', 46, 77, 76, 6, C.place.toUpperCase(), CAP({ s: 7, c: S.green, w: 600, min: 7 })),
    ], 'Vorderseite'),
    page(S.blush, [
      dk('Flamingo', 'deko-motive-flamingo', 12, 12, 34),
      dk('Ananas', 'deko-motive-ananas', 120, 40, 20),
      ctext('Titel', 86, 20, 70, 14, 'Wir heiraten!', SCR({ s: 26, c: S.pink, min: 14 })),
      ctext('Text', 86, 40, 66, 38, 'Hawaiihemd raus, Sonnencreme rein: Wir feiern unsere Hochzeit mit Palmen, Cocktails und guter Laune. Die Einladung folgt.', BODY({ s: 10, wrap: true, v: 'top', lh: 1.5, min: 7, a: 'center' })),
      ctext('Namen', 86, 84, 60, 7, 'ANNA & JONAS', CAP({ s: 8, c: S.green, min: 7 })),
    ], 'Rückseite'),
  ],
});

const einl = make('klapp', S, {
  slug: 'hochzeit-einladung-klapp-tropisch', name: 'Hochzeit Einladung (Klappkarte) – Tropisch',
  description: 'Klappkarte A6 hoch für eine Sommerhochzeit: vorne Palmenblatt und Hibiskus mit den Namen in Pacifico, hinten Flamingo und Ananas, innen Einladungstext und Eckdaten mit Monstera. Dschungelgrün, Pink und Sonnengelb.',
  tags: [...TAGS, 'Einladung', 'Klappkarte', 'Einladungskarte', 'A6'],
  formatKey: 'card-a6-portrait', fold: 'vertical', width: 210, height: 148,
  pages: foldCard('vertical', [
    rect('Hintergrund hinten', 0, 0, 105, 148, S.blush, { locked: true }),
    dk('Flamingo', 'deko-motive-flamingo', 14, 20, 40),
    dk('Ananas', 'deko-motive-ananas', 66, 70, 24),
    ctext('Rückseite', 52.5, 120, 80, 10, 'Aloha!', SCR({ s: 22, c: S.pink, min: 12 })),
    dk('Palmenblatt', 'deko-motive-palmenblatt', 119, 8, 76),
    ctext('Kopf', 157.5, 62, 70, 6, 'WIR HEIRATEN', CAP({ s: 8, min: 7 })),
    ctext('Namen', 157.5, 70, 86, 34, 'Anna\n& Jonas', SCR({ s: 30, lh: 1.15, wrap: true, v: 'top', min: 16 })),
    ctext('Datum', 157.5, 108, 80, 8, C.dateShort, BODY({ s: 14, w: 800, c: S.green, min: 8 })),
    dk('Hibiskus', 'deko-motive-hibiskus', 187, 112, 15),
  ], [
    dk('Monstera', 'deko-motive-monstera-blatt', 6, 96, 34),
    ctext('Anrede', 52.5, 14, 84, 12, 'Liebe Freunde,', SCR({ s: 22, c: S.pink, min: 12 })),
    ctext('Text', 52.5, 32, 80, 56, 'wir sagen Ja und feiern mit Sonne, Palmen und Cocktails. Zieht euer buntestes Outfit an, lasst die Schuhe zu Hause und tanzt mit uns in den Sommerabend.', BODY({ s: 11, wrap: true, v: 'top', lh: 1.5, min: 8, a: 'center' })),
    ctext('Namen', 62, 118, 80, 8, 'Anna & Jonas', SCR({ s: 18, min: 10 })),
    ctext('Wann', 157.5, 14, 80, 5, 'WANN', CAP({ s: 7, min: 7 })),
    ctext('Wann Wert', 157.5, 20, 84, 14, C.date + '\nTrauung um 14:00 Uhr', BODY({ s: 12, wrap: true, v: 'top', lh: 1.3, min: 8, a: 'center' })),
    ctext('Wo', 157.5, 42, 80, 5, 'WO', CAP({ s: 7, min: 7 })),
    ctext('Wo Wert', 157.5, 48, 84, 16, C.place + '\nBirkenallee 4, 12345 Musterstadt', BODY({ s: 12, wrap: true, v: 'top', lh: 1.3, min: 8, a: 'center' })),
    ctext('Danach', 157.5, 72, 80, 5, 'DANACH', CAP({ s: 7, min: 7 })),
    ctext('Danach Wert', 157.5, 78, 84, 14, 'Strandbar, Musik und Tanz\nbis in die Nacht', BODY({ s: 12, wrap: true, v: 'top', lh: 1.3, min: 8, a: 'center' })),
    ctext('Antwort', 157.5, 104, 80, 5, 'ANTWORT', CAP({ s: 7, min: 7 })),
    ctext('Antwort Wert', 157.5, 110, 84, 10, C.reply, BODY({ s: 10.5, w: 600, min: 8 })),
  ], S.bg),
});

const tisch = make('tisch', S, Object.assign({}, TISCH_META, {
  slug: 'hochzeit-tischkarte-tropisch', name: 'Hochzeit Tischkarte – Tropisch',
  description: 'Tischkarte als Zeltkarte (gefaltet 90 × 50 mm) für eine Sommerhochzeit: Hibiskusblüte, der Name des Gastes in Pacifico, die Tischnummer in Pink. Innen Ananas auf Dschungelgrün. Für Serien mit Gästelisten.',
  tags: [...TAGS, 'Tischkarte', 'Platzkarte', 'Namenskarte', 'Zeltkarte', 'Gäste', 'Serie'],
  pages: tent(y => [
    dk('Hibiskus', 'deko-motive-hibiskus', 6, y + 14, 20),
    ctext('Name', 58, y + 13, 56, 15, '{{Name}}', SCR({ s: 17, min: 8 })),
    line('Strich', 44, y + 31, 72, y + 31, S.yellow, 0.8, { locked: true }),
    ctext('Tisch', 58, y + 34, 50, 6, 'TISCH {{Tisch}}', CAP({ s: 8, min: 7 })),
    rect('Band', 0, y + 46, 90, 4, S.green, { locked: true }),
  ], [
    dk('Ananas', 'deko-motive-ananas', 40, 56, 11),
    ctext('Namen', 45, 80, 74, 9, 'Anna & Jonas', SCR({ s: 18, c: S.yellow, min: 10 })),
    ctext('Datum', 45, 91, 70, 5, C.dateNum, CAP({ s: 7, c: '#ffffff', min: 7 })),
  ], S.bg, S.green),
}));

const menue = make('menue', S, {
  slug: 'hochzeit-menuekarte-tropisch', name: 'Hochzeit Menükarte – Tropisch', formatKey: 'menu-dl', width: 99, height: 210,
  description: 'Menükarte DIN lang für eine Sommerhochzeit: Palmenblatt, „Menü“ in Pacifico, die Gänge in Dschungelgrün mit pinken Überschriften und eine Hibiskusblüte am Fuß. Gerichte einfach überschreiben.',
  tags: [...TAGS, 'Menükarte', 'Menü', 'Speisekarte', 'DIN lang', 'Gänge'],
  pages: [page(S.bg, [
    dk('Palmenblatt', 'deko-motive-palmenblatt', 14, 4, 72),
    ctext('Titel', 49.5, 52, 70, 14, 'Menü', SCR({ s: 28, c: S.pink, min: 14 })),
    ...MENU.flatMap(([course, dish], i) => {
      const y = 74 + i * 24;
      return [
        ctext('Gang ' + (i + 1), 49.5, y, 76, 5, course.toUpperCase(), CAP({ s: 7, min: 7 })),
        ctext('Gericht ' + (i + 1), 49.5, y + 5.5, 80, 16, dish, BODY({ s: 10.5, wrap: true, v: 'top', lh: 1.25, min: 7, a: 'center' })),
      ];
    }),
    dk('Hibiskus', 'deko-motive-hibiskus', 41, 194, 15),
  ], 'Menükarte')],
});

const danke = make('danke', S, {
  slug: 'hochzeit-danksagung-tropisch', name: 'Hochzeit Danksagung – Tropisch',
  description: 'Danksagungskarte als Postkarte A6 quer für eine Sommerhochzeit: vorne „Danke“ in Pacifico mit Hibiskus und Palmenblatt, hinten ein Gruß auf Rosa mit Flamingo. Bunt und sommerlich.',
  tags: [...TAGS, 'Danksagung', 'Danke', 'Dankeskarte', 'Postkarte'],
  formatKey: 'postcard-a6-landscape', width: 148, height: 105,
  pages: [
    page(S.green, [
      dk('Palmenblatt', 'deko-motive-palmenblatt', 4, 4, 60),
      dk('Hibiskus', 'deko-motive-hibiskus', 12, 58, 34),
      ctext('Danke', 100, 24, 74, 28, 'Danke!', SCR({ s: 48, c: S.yellow, min: 24 })),
      ctext('Namen', 100, 56, 70, 10, 'Anna & Jonas', SCR({ s: 18, c: '#ffffff', min: 10 })),
      ctext('Datum', 100, 70, 60, 5, C.dateNum, CAP({ s: 7, c: S.blush, min: 7 })),
    ], 'Vorderseite'),
    page(S.blush, [
      dk('Flamingo', 'deko-motive-flamingo', 108, 12, 28),
      ctext('Titel', 58, 16, 90, 14, 'Ihr wart spitze!', SCR({ s: 22, c: S.pink, min: 12 })),
      ctext('Text', 58, 36, 88, 40, 'Danke, dass ihr mit uns gefeiert, getanzt und gelacht habt. Eure Geschenke und Wünsche haben uns riesig gefreut. Wir denken noch lange an diesen Sommertag.', BODY({ s: 10.5, wrap: true, v: 'top', lh: 1.5, min: 7, a: 'center' })),
      ctext('Gruß', 58, 82, 80, 9, 'Eure Anna & Jonas', SCR({ s: 16, c: S.green, min: 9 })),
    ], 'Rückseite'),
  ],
});

module.exports = { std, einl, tisch, menue, danke };
