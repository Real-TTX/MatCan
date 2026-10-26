/* Style line "Elegant Schwarz": black paper, gold line art, ivory type (Cinzel, Great Vibes, Cormorant). */
'use strict';
const V = require('./_v2-lib');
const { text, rect, ellipse, line, page, ctext, ltext, dk, make, C, tent, TISCH_META, MENU, dekoIn, foldCard, frameLine, divider, diamond } = V;

const S = { variant: 'Elegant Schwarz', bg: '#0e0e10', bg2: '#17171a', gold: '#c9a24b', ivory: '#f3ead6', dim: '#b9b09a', script: 'Great Vibes', caps: 'Cinzel', serif: 'Cormorant Garamond' };
const TAGS = ['Hochzeit', 'Schwarz', 'Gold', 'elegant', 'edel', 'Black Tie', 'festlich', 'Abendhochzeit', 'Brautpaar'];
const SCR = (o) => Object.assign({ f: S.script, c: S.ivory }, o);
const CAP = (o) => Object.assign({ f: S.caps, c: S.gold, w: 400, ls: 0.3 }, o);
const SER = (o) => Object.assign({ f: S.serif, c: S.ivory, w: 500 }, o);

const std = make('std', S, {
  slug: 'save-the-date-elegant-schwarz', name: 'Save the Date – Elegant Schwarz',
  description: 'Save-the-Date-Postkarte A6 hoch in Schwarz und Gold: Zierrahmen im Art-déco-Stil, Namen in elfenbeinfarbener Schreibschrift, Datum in Kapitälchen. Die Rückseite kündigt einen festlichen Abend an. Für Black-Tie-Hochzeiten.',
  tags: [...TAGS, 'Save the Date', 'Termin', 'Postkarte', 'Art déco'],
  formatKey: 'postcard-a6-portrait', width: 105, height: 148,
  pages: [
    page(S.bg, [
      dekoIn('Rahmen', 'deko-rahmen-deco-hoch-gold', 4, 4, 97, 140, { locked: true }),
      ctext('Save the Date', 52.5, 26, 70, 6, 'SAVE THE DATE', CAP({ s: 8, min: 7 })),
      dk('Trenner oben', 'deko-trenner-deco-gold', 27, 36, 51),
      ctext('Name 1', 52.5, 46, 80, 18, 'Anna', SCR({ s: 40, min: 22 })),
      ctext('Und', 52.5, 63, 20, 8, '&', SER({ s: 18, c: S.gold, i: true, min: 10 })),
      ctext('Name 2', 52.5, 70, 80, 18, 'Jonas', SCR({ s: 40, min: 22 })),
      dk('Trenner unten', 'deko-trenner-deco-gold', 27, 94, 51),
      ctext('Datum', 52.5, 104, 80, 8, C.dateShort.toUpperCase(), CAP({ s: 10, c: S.ivory, min: 7 })),
      ctext('Ort', 52.5, 115, 70, 5, C.place.toUpperCase(), CAP({ s: 7, c: S.gold, min: 7 })),
    ], 'Vorderseite'),
    page(S.bg2, [
      dk('Funkeln', 'deko-sterne-funkeln-gold', 46, 26, 13),
      ctext('Titel', 52.5, 44, 86, 16, 'Wir heiraten', SCR({ s: 34, c: S.gold, min: 18 })),
      ctext('Text', 52.5, 68, 70, 36, 'Wir laden euch zu einem festlichen Abend ein. Bitte merkt euch den Tag vor, die Einladung folgt. Dresscode: Black Tie.', SER({ s: 12, wrap: true, v: 'top', lh: 1.5, min: 8, a: 'center' })),
      dk('Trenner', 'deko-trenner-deco-gold', 27, 112, 51),
    ], 'Rückseite'),
  ],
});

const einl = make('klapp', S, {
  slug: 'hochzeit-einladung-klapp-elegant-schwarz', name: 'Hochzeit Einladung (Klappkarte) – Elegant Schwarz',
  description: 'Klappkarte A6 hoch in Schwarz und Gold: vorne Zierrahmen mit Namen in Schreibschrift, hinten Trauringe, innen Einladungstext und Eckdaten mit goldenem Fleuron. Festlich, ruhig und gut lesbar; passt zum Save the Date.',
  tags: [...TAGS, 'Einladung', 'Klappkarte', 'Einladungskarte', 'A6'],
  formatKey: 'card-a6-portrait', fold: 'vertical', width: 210, height: 148,
  pages: foldCard('vertical', [
    dekoIn('Rahmen hinten', 'deko-rahmen-deco-hoch-gold', 4, 4, 97, 140, { locked: true }),
    dk('Ringe', 'deko-motive-trauringe-gold', 33, 52, 39),
    ctext('Rückseite', 52.5, 100, 70, 7, 'IN LIEBE', CAP({ s: 8, min: 7 })),
    dekoIn('Rahmen vorn', 'deko-rahmen-deco-hoch-gold', 109, 4, 97, 140, { locked: true }),
    ctext('Kopf', 157.5, 26, 70, 6, 'WIR HEIRATEN', CAP({ s: 8, min: 7 })),
    dk('Trenner', 'deko-trenner-deco-gold', 132, 36, 51),
    ctext('Name 1', 157.5, 46, 80, 18, 'Anna', SCR({ s: 40, min: 22 })),
    ctext('Und', 157.5, 63, 20, 8, '&', SER({ s: 18, c: S.gold, i: true, min: 10 })),
    ctext('Name 2', 157.5, 70, 80, 18, 'Jonas', SCR({ s: 40, min: 22 })),
    ctext('Datum', 157.5, 100, 80, 8, C.dateShort.toUpperCase(), CAP({ s: 10, c: S.ivory, min: 7 })),
    ctext('Ort', 157.5, 112, 70, 5, C.place.toUpperCase(), CAP({ s: 7, min: 7 })),
  ], [
    ctext('Anrede', 52.5, 16, 84, 12, 'Liebe Familie, liebe Freunde,', SCR({ s: 22, c: S.gold, min: 12 })),
    ctext('Text', 52.5, 34, 80, 56, 'wir würden uns sehr freuen, euch an unserem Hochzeitstag bei einem festlichen Abendessen zu begrüßen. Wir bitten um festliche Kleidung.', SER({ s: 12, wrap: true, v: 'top', lh: 1.5, min: 8, a: 'center' })),
    dk('Fleuron', 'deko-ornamente-fleuron-gold', 47, 100, 10),
    ctext('Wann', 157.5, 14, 80, 5, 'WANN', CAP({ s: 7, min: 7 })),
    ctext('Wann Wert', 157.5, 20, 84, 14, C.date + '\nTrauung um 16:00 Uhr', SER({ s: 13, wrap: true, v: 'top', lh: 1.3, min: 8, a: 'center' })),
    ctext('Wo', 157.5, 42, 80, 5, 'WO', CAP({ s: 7, min: 7 })),
    ctext('Wo Wert', 157.5, 48, 84, 16, C.place + '\nBirkenallee 4, 12345 Musterstadt', SER({ s: 13, wrap: true, v: 'top', lh: 1.3, min: 8, a: 'center' })),
    ctext('Danach', 157.5, 72, 80, 5, 'ANSCHLIESSEND', CAP({ s: 7, min: 7 })),
    ctext('Danach Wert', 157.5, 78, 84, 14, 'Festliches Dinner,\nMusik und Tanz', SER({ s: 13, wrap: true, v: 'top', lh: 1.3, min: 8, a: 'center' })),
    ctext('Antwort', 157.5, 104, 80, 5, 'ANTWORT', CAP({ s: 7, min: 7 })),
    ctext('Antwort Wert', 157.5, 110, 84, 10, C.reply, SER({ s: 12, i: true, min: 8 })),
  ], S.bg, S.bg2),
});

const tisch = make('tisch', S, Object.assign({}, TISCH_META, {
  slug: 'hochzeit-tischkarte-elegant-schwarz', name: 'Hochzeit Tischkarte – Elegant Schwarz',
  description: 'Tischkarte als Zeltkarte (gefaltet 90 × 50 mm) in Schwarz und Gold: doppelte Goldlinie, der Name des Gastes in elfenbeinfarbener Schreibschrift, die Tischnummer in goldenen Kapitälchen. Innen ein Goldfunkeln. Für Serien mit Gästelisten.',
  tags: [...TAGS, 'Tischkarte', 'Platzkarte', 'Namenskarte', 'Zeltkarte', 'Gäste', 'Serie'],
  pages: tent(y => [
    frameLine('Rahmen', 3.5, y + 4, 83, 42, S.gold, 0.4),
    frameLine('Rahmen innen', 5.5, y + 6, 79, 38, S.gold, 0.2),
    ctext('Name', 45, y + 11, 70, 16, '{{Name}}', SCR({ s: 26, min: 11 })),
    dk('Trenner', 'deko-trenner-deco-gold', 31, y + 30, 28),
    ctext('Tisch', 45, y + 35, 60, 5, 'TISCH {{Tisch}}', CAP({ s: 7, min: 7 })),
  ], [
    dk('Funkeln', 'deko-sterne-funkeln-gold', 38, 58, 14),
    ctext('Namen', 45, 76, 70, 9, 'Anna & Jonas', SCR({ s: 20, min: 10 })),
    ctext('Datum', 45, 87, 70, 5, C.dateNum, CAP({ s: 7, min: 7 })),
  ], S.bg, S.bg2),
}));

const menue = make('menue', S, {
  slug: 'hochzeit-menuekarte-elegant-schwarz', name: 'Hochzeit Menükarte – Elegant Schwarz', formatKey: 'menu-dl', width: 99, height: 210,
  description: 'Menükarte DIN lang in Schwarz und Gold: Doppelrahmen, „Menü“ in goldener Schreibschrift, die Gänge in Elfenbein mit goldenen Kapitälchen und Trennern. Für das festliche Dinner; Gerichte einfach überschreiben.',
  tags: [...TAGS, 'Menükarte', 'Menü', 'Speisekarte', 'DIN lang', 'Gänge', 'Dinner'],
  pages: [page(S.bg, [
    dekoIn('Rahmen', 'deko-rahmen-doppellinie-lang-gold', 5, 5, 89, 200, { locked: true }),
    ctext('Titel', 49.5, 14, 76, 16, 'Menü', SCR({ s: 34, c: S.gold, min: 18 })),
    dk('Trenner', 'deko-trenner-deco-gold', 24.5, 31, 50),
    ...MENU.flatMap(([course, dish], i) => {
      const y = 42 + i * 29;
      return [
        ctext('Gang ' + (i + 1), 49.5, y, 76, 5, course.toUpperCase(), CAP({ s: 7, min: 7 })),
        ctext('Gericht ' + (i + 1), 49.5, y + 6, 78, 17, dish, SER({ s: 11.5, i: true, wrap: true, v: 'top', lh: 1.3, min: 7, a: 'center' })),
        i < MENU.length - 1 && diamond('Raute ' + (i + 1), 49.5, y + 26.5, 1.3, S.gold),
      ];
    }),
    ctext('Fuß', 49.5, 192, 76, 6, 'ANNA & JONAS · 12.06.2027', CAP({ s: 7, min: 7 })),
  ], 'Menükarte')],
});

const danke = make('danke', S, {
  slug: 'hochzeit-danksagung-elegant-schwarz', name: 'Hochzeit Danksagung – Elegant Schwarz',
  description: 'Danksagungskarte als Postkarte A6 quer in Schwarz und Gold: vorne „Danke“ in goldener Schreibschrift im Zierrahmen, hinten ein Gruß in Elfenbein. Festlich und ruhig, passend zur Einladung.',
  tags: [...TAGS, 'Danksagung', 'Danke', 'Dankeskarte', 'Postkarte'],
  formatKey: 'postcard-a6-landscape', width: 148, height: 105,
  pages: [
    page(S.bg, [
      dekoIn('Rahmen', 'deko-rahmen-deco-quer-gold', 4, 4, 140, 97, { locked: true }),
      ctext('Danke', 74, 22, 100, 34, 'Danke', SCR({ s: 70, c: S.gold, min: 34 })),
      dk('Trenner', 'deko-trenner-deco-gold', 48, 62, 52),
      ctext('Namen', 74, 70, 100, 9, 'Anna & Jonas', SCR({ s: 22, min: 12 })),
      ctext('Datum', 74, 82, 80, 5, C.dateNum, CAP({ s: 7, min: 7 })),
    ], 'Vorderseite'),
    page(S.bg2, [
      dk('Funkeln', 'deko-sterne-funkeln-gold', 68, 12, 12),
      ctext('Titel', 74, 28, 110, 12, 'Von ganzem Herzen', SCR({ s: 26, c: S.gold, min: 14 })),
      ctext('Text', 74, 44, 108, 34, 'Ihr habt unseren Abend zu einem Fest gemacht, das wir nie vergessen werden. Für eure Geschenke, eure Wünsche und eure Gesellschaft danken wir euch sehr.', SER({ s: 12, wrap: true, v: 'top', lh: 1.5, min: 8, a: 'center' })),
      ctext('Gruß', 74, 84, 80, 9, 'Anna & Jonas', SCR({ s: 20, min: 10 })),
    ], 'Rückseite'),
  ],
});

module.exports = { std, einl, tisch, menue, danke };
