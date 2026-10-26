/* Style line "Vintage": aged paper, sepia ink, oxblood, old keys, bird cage and butterfly, flourishes and a wax seal. */
'use strict';
const V = require('./_v2-lib');
const { text, rect, ellipse, line, page, ctext, ltext, dk, make, C, tent, TISCH_META, MENU, dekoIn, foldCard, frameLine, diamond, divider } = V;

const S = { variant: 'Vintage', bg: '#efe3cc', bg2: '#e6d5b4', ink: '#4a3a2a', red: '#8f3a3a', teal: '#3e6b6a', line: '#a98334', serif: 'Playfair Display', book: 'Libre Baskerville', script: 'Parisienne' };
const TAGS = ['Hochzeit', 'Vintage', 'Retro', 'Nostalgie', 'antik', 'Sepia', 'Schnörkel', 'romantisch', 'Brautpaar'];
const SCR = (o) => Object.assign({ f: S.script, c: S.red }, o);
const SER = (o) => Object.assign({ f: S.serif, c: S.ink }, o);
const CAP = (o) => Object.assign({ f: S.book, c: S.red, w: 400, ls: 0.22 }, o);

const std = make('std', S, {
  slug: 'save-the-date-vintage', name: 'Save the Date – Vintage',
  description: 'Save-the-Date-Postkarte A6 hoch im Vintage-Stil: Goldschnörkelrahmen auf altem Papier, ein goldener Schmetterling, „Save the Date“ in Schreibschrift und Namen in Antiqua. Die Rückseite mit Vogelkäfig kündigt die Einladung an.',
  tags: [...TAGS, 'Save the Date', 'Termin', 'Postkarte', 'Schmetterling'],
  formatKey: 'postcard-a6-portrait', width: 105, height: 148,
  pages: [
    page(S.bg, [
      dekoIn('Rahmen', 'deko-rahmen-schnoerkel-hoch-gold', 4, 4, 97, 140, { locked: true }),
      dk('Schmetterling', 'deko-motive-schmetterling-gold', 40, 17, 25),
      ctext('Save the Date', 52.5, 36, 80, 14, 'Save the Date', SCR({ s: 32, min: 18 })),
      ctext('Name 1', 52.5, 58, 70, 12, 'Anna', SER({ s: 28, i: true, min: 16 })),
      ctext('Und', 52.5, 70, 20, 7, '&', SER({ s: 16, c: S.red, i: true, min: 10 })),
      ctext('Name 2', 52.5, 77, 70, 12, 'Jonas', SER({ s: 28, i: true, min: 16 })),
      dk('Trenner', 'deko-trenner-schnoerkel-schwarz', 27, 95, 51),
      ctext('Wochentag', 52.5, 104, 60, 5, 'SAMSTAG', CAP({ s: 7, min: 7 })),
      ctext('Datum', 52.5, 110, 70, 9, C.dateShort, SER({ s: 15, min: 9 })),
      ctext('Ort', 52.5, 122, 70, 5, C.place.toUpperCase(), CAP({ s: 7, c: S.ink, min: 7 })),
    ], 'Vorderseite'),
    page(S.bg2, [
      dk('Vogelkäfig', 'deko-motive-vogelkaefig-gold', 41, 14, 23),
      ctext('Titel', 52.5, 62, 86, 16, 'Wir heiraten!', SCR({ s: 34, min: 18 })),
      ctext('Text', 52.5, 82, 70, 38, 'Bitte merkt euch den Tag vor. Wir freuen uns darauf, ihn mit euch bei Kaffee, Kuchen und Tanz zu feiern. Die Einladung folgt.', SER({ s: 10.5, wrap: true, v: 'top', lh: 1.5, min: 7, a: 'center' })),
      dk('Trenner', 'deko-trenner-schnoerkel-schwarz', 27, 126, 51),
    ], 'Rückseite'),
  ],
});

const einl = make('klapp', S, {
  slug: 'hochzeit-einladung-klapp-vintage', name: 'Hochzeit Einladung (Klappkarte) – Vintage',
  description: 'Klappkarte A6 hoch im Vintage-Stil: vorne Goldschnörkel und die Namen in Schreibschrift, hinten ein antiker Schlüssel, innen Einladungstext und Eckdaten mit Wachssiegel. Altes Papier, Sepia, Oxblut.',
  tags: [...TAGS, 'Einladung', 'Klappkarte', 'Einladungskarte', 'A6', 'Schlüssel', 'Siegel'],
  formatKey: 'card-a6-portrait', fold: 'vertical', width: 210, height: 148,
  pages: foldCard('vertical', [
    dk('Schlüssel', 'deko-motive-schluessel-gold', 44, 24, 17),
    ctext('Rückseite', 52.5, 100, 70, 10, 'in Liebe', SCR({ s: 22, min: 12 })),
    dekoIn('Rahmen', 'deko-rahmen-schnoerkel-hoch-gold', 109, 4, 97, 140, { locked: true }),
    ctext('Kopf', 157.5, 22, 70, 5, 'WIR HEIRATEN', CAP({ s: 7.5, w: 700, min: 7 })),
    ctext('Name 1', 157.5, 34, 80, 20, 'Anna', SCR({ s: 40, c: S.ink, min: 20 })),
    ctext('Und', 157.5, 52, 20, 8, '&', SER({ s: 18, i: true, c: S.red, min: 10 })),
    ctext('Name 2', 157.5, 60, 80, 20, 'Jonas', SCR({ s: 40, c: S.ink, min: 20 })),
    dk('Trenner', 'deko-trenner-schnoerkel-schwarz', 132, 88, 51),
    ctext('Datum', 157.5, 98, 70, 9, C.dateShort, SER({ s: 16, min: 9 })),
    ctext('Ort', 157.5, 110, 70, 5, C.place.toUpperCase(), CAP({ s: 7, c: S.ink, min: 7 })),
  ], [
    ctext('Anrede', 52.5, 14, 84, 12, 'Liebe Familie, liebe Freunde,', SCR({ s: 20, min: 12 })),
    ctext('Text', 52.5, 32, 82, 56, 'wir haben uns entschieden, den Bund fürs Leben zu schließen, und möchten diesen Tag in alter Tradition mit euch feiern. Wir bitten euch herzlich, unsere Gäste zu sein.', SER({ s: 11, wrap: true, v: 'top', lh: 1.5, min: 7, a: 'center' })),
    ctext('Namen', 52.5, 116, 80, 12, 'Anna & Jonas', SCR({ s: 22, min: 12 })),
    ctext('Wann', 157.5, 14, 80, 5, 'ZEIT', CAP({ s: 7, w: 700, min: 7 })),
    ctext('Wann Wert', 157.5, 20, 84, 14, C.date + '\nTrauung um 14:00 Uhr', SER({ s: 12, wrap: true, v: 'top', lh: 1.3, min: 8, a: 'center' })),
    ctext('Wo', 157.5, 42, 80, 5, 'ORT', CAP({ s: 7, w: 700, min: 7 })),
    ctext('Wo Wert', 157.5, 48, 84, 16, C.place + '\nBirkenallee 4, 12345 Musterstadt', SER({ s: 12, wrap: true, v: 'top', lh: 1.3, min: 8, a: 'center' })),
    ctext('Danach', 157.5, 72, 80, 5, 'IM ANSCHLUSS', CAP({ s: 7, w: 700, min: 7 })),
    ctext('Danach Wert', 157.5, 78, 84, 14, 'Kaffee und Kuchen,\nFestmahl und Tanz', SER({ s: 12, wrap: true, v: 'top', lh: 1.3, min: 8, a: 'center' })),
    ctext('Antwort', 140, 112, 62, 12, C.reply, SER({ s: 9.5, i: true, wrap: true, v: 'top', lh: 1.3, min: 7, a: 'center' })),
    dk('Siegel', 'deko-baender-siegel-wachs-bordeaux', 184, 106, 18),
  ], S.bg),
});

const tisch = make('tisch', S, Object.assign({}, TISCH_META, {
  slug: 'hochzeit-tischkarte-vintage', name: 'Hochzeit Tischkarte – Vintage',
  description: 'Tischkarte als Zeltkarte (gefaltet 90 × 50 mm) im Vintage-Stil: Doppelrand auf altem Papier, der Name des Gastes in Schreibschrift, die Tischnummer in Kapitälchen. Innen ein Schmetterling. Für Serien mit Gästelisten.',
  tags: [...TAGS, 'Tischkarte', 'Platzkarte', 'Namenskarte', 'Zeltkarte', 'Gäste', 'Serie'],
  pages: tent(y => [
    frameLine('Rahmen', 3.5, y + 4, 83, 42, S.line, 0.4),
    frameLine('Rahmen innen', 5.5, y + 6, 79, 38, S.line, 0.2),
    ctext('Name', 45, y + 10, 70, 16, '{{Name}}', SCR({ s: 26, c: S.ink, min: 11 })),
    dk('Trenner', 'deko-trenner-schnoerkel-schwarz', 30, y + 29, 30),
    ctext('Tisch', 45, y + 35, 60, 5, 'TISCH {{Tisch}}', CAP({ s: 7, w: 700, min: 7 })),
  ], [
    dk('Schmetterling', 'deko-motive-schmetterling-gold', 33, 55, 24),
    ctext('Namen', 45, 76, 70, 9, 'Anna & Jonas', SCR({ s: 20, c: S.ink, min: 10 })),
    ctext('Datum', 45, 87, 70, 5, C.dateNum, CAP({ s: 7, min: 7 })),
  ], S.bg2),
}));

const menue = make('menue', S, {
  slug: 'hochzeit-menuekarte-vintage', name: 'Hochzeit Menükarte – Vintage', formatKey: 'menu-dl', width: 99, height: 210,
  description: 'Menükarte DIN lang im Vintage-Stil: Goldrahmen auf altem Papier, „Speisenfolge“ in Schreibschrift, die Gänge in kursiver Antiqua mit Schnörkelstrichen. Gerichte einfach überschreiben.',
  tags: [...TAGS, 'Menükarte', 'Menü', 'Speisekarte', 'DIN lang', 'Speisenfolge'],
  pages: [page(S.bg, [
    dekoIn('Rahmen', 'deko-rahmen-doppellinie-lang-gold', 5, 5, 89, 200, { locked: true }),
    ctext('Titel', 49.5, 14, 76, 14, 'Speisenfolge', SCR({ s: 30, min: 16 })),
    dk('Trenner', 'deko-trenner-schnoerkel-schwarz', 24.5, 30, 50),
    ...MENU.flatMap(([course, dish], i) => {
      const y = 42 + i * 29;
      return [
        ctext('Gang ' + (i + 1), 49.5, y, 76, 5, course.toUpperCase(), CAP({ s: 7, w: 700, min: 7 })),
        ctext('Gericht ' + (i + 1), 49.5, y + 6, 76, 17, dish, SER({ s: 12, i: true, wrap: true, v: 'top', lh: 1.3, min: 7, a: 'center' })),
        i < MENU.length - 1 && diamond('Raute ' + (i + 1), 49.5, y + 26.5, 1.3, S.line),
      ];
    }),
    ctext('Fuß', 49.5, 192, 76, 6, 'ANNA & JONAS · 12.06.2027', CAP({ s: 7, c: S.ink, min: 7 })),
  ], 'Menükarte')],
});

const danke = make('danke', S, {
  slug: 'hochzeit-danksagung-vintage', name: 'Hochzeit Danksagung – Vintage',
  description: 'Danksagungskarte als Postkarte A6 quer im Vintage-Stil: ein goldener Schmetterling, „Herzlichen Dank“ in Schreibschrift und Goldschnörkel auf altem Papier. Hinten ein Gruß im Briefstil.',
  tags: [...TAGS, 'Danksagung', 'Danke', 'Dankeskarte', 'Postkarte', 'Schmetterling'],
  formatKey: 'postcard-a6-landscape', width: 148, height: 105,
  pages: [
    page(S.bg, [
      dekoIn('Rahmen', 'deko-rahmen-schnoerkel-quer-gold', 4, 4, 140, 97, { locked: true }),
      dk('Schmetterling', 'deko-motive-schmetterling-gold', 62, 12, 24),
      ctext('Danke', 74, 34, 110, 22, 'Herzlichen Dank', SCR({ s: 44, min: 22 })),
      dk('Trenner', 'deko-trenner-schnoerkel-schwarz', 48, 62, 52),
      ctext('Namen', 74, 70, 100, 10, 'Anna & Jonas', SER({ s: 18, i: true, min: 10 })),
      ctext('Datum', 74, 82, 80, 5, C.dateNum, CAP({ s: 7, c: S.ink, min: 7 })),
    ], 'Vorderseite'),
    page(S.bg2, [
      ctext('Anrede', 74, 14, 110, 10, 'Liebe Freunde und Familie,', SCR({ s: 22, min: 12 })),
      ctext('Text', 74, 30, 112, 38, 'ihr habt unseren Hochzeitstag zu einem Fest gemacht, an das wir uns ein Leben lang erinnern werden. Für alle Wünsche, Geschenke und die schönen Stunden danken wir euch von Herzen.', SER({ s: 10.5, wrap: true, v: 'top', lh: 1.5, min: 7, a: 'center' })),
      ctext('Gruß', 74, 78, 100, 9, 'In Liebe, Anna & Jonas', SCR({ s: 20, c: S.ink, min: 10 })),
    ], 'Rückseite'),
  ],
});

module.exports = { std, einl, tisch, menue, danke };
