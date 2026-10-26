/* Style line "Mittelalter": parchment, bordeaux and gold, castle, goblet, coat of arms, banners, wax seal (Cinzel and Lora). */
'use strict';
const V = require('./_v2-lib');
const { text, rect, ellipse, line, page, ctext, ltext, dk, make, C, tent, TISCH_META, dekoIn, frameLine, diamond } = V;

const S = { variant: 'Mittelalter', bg: '#eadbb8', bg2: '#7d2230', ink: '#3d2b1a', red: '#7d2230', gold: '#b88a2e', cream: '#f4e9cc', caps: 'Cinzel', serif: 'Lora' };
const TAGS = ['Hochzeit', 'Mittelalter', 'Ritter', 'Burg', 'Pergament', 'Wappen', 'Mittelalterfest', 'Burghochzeit', 'Brautpaar'];
const CAP = (o) => Object.assign({ f: S.caps, c: S.ink, w: 700, ls: 0.15 }, o);
const SER = (o) => Object.assign({ f: S.serif, c: S.ink, w: 400 }, o);
const MENU_M = [
  ['Zur Eröffnung', 'Tomaten-Mozzarella-Türmchen\nmit Basilikumöl'],
  ['Von der Suppe', 'Kräuterschaumsuppe\nmit Croûtons'],
  ['Der Hauptgang', 'Rosa gebratene Entenbrust\nmit Orangenjus, Kartoffelgratin\nund Honigkarotten'],
  ['Für die Fastenden', 'Ricotta-Tortelloni\nmit Salbeibutter'],
  ['Süßes zum Schluss', 'Hochzeitstorte\nund Kaffeespezialitäten'],
];

const std = make('std', S, {
  slug: 'save-the-date-mittelalter', name: 'Save the Date – Mittelalter',
  description: 'Save-the-Date-Postkarte A6 hoch auf Pergament für eine Hochzeit auf der Burg: eine Burg mit Fahne, „Hört, hört!“ und die Namen in Cinzel, Datum im Stil alter Urkunden. Die Rückseite in Bordeaux mit Wachssiegel kündigt das Fest an.',
  tags: [...TAGS, 'Save the Date', 'Termin', 'Postkarte'],
  formatKey: 'postcard-a6-portrait', width: 105, height: 148,
  pages: [
    page(S.bg, [
      frameLine('Rahmen', 5, 5, 95, 138, S.ink, 0.5),
      frameLine('Rahmen innen', 7, 7, 91, 134, S.gold, 0.3),
      dk('Burg', 'deko-motive-burg', 22, 12, 61),
      ctext('Hört', 52.5, 66, 80, 10, 'Hört, hört!', CAP({ s: 16, c: S.red, min: 9 })),
      ctext('Namen', 52.5, 78, 86, 12, 'ANNA & JONAS', CAP({ s: 18, min: 10 })),
      dk('Trenner', 'deko-motive-eichenlaub-trenner-bordeaux', 26, 93, 53),
      ctext('Text', 52.5, 99, 80, 10, 'wollen den Bund der Ehe schließen am', SER({ s: 9, i: true, min: 7 })),
      ctext('Datum', 52.5, 109, 80, 9, '12. Juni 2027', CAP({ s: 15, min: 9 })),
      ctext('Ort', 52.5, 121, 80, 6, 'AUF DER BURG ' + C.city.toUpperCase(), CAP({ s: 7, c: S.red, w: 400, min: 7 })),
    ], 'Vorderseite'),
    page(S.bg2, [
      dk('Siegel', 'deko-baender-siegel-wachs-bordeaux', 38, 16, 29),
      ctext('Titel', 52.5, 52, 86, 14, 'Ihr seid geladen!', CAP({ s: 15, c: '#f4e9cc', min: 9 })),
      ctext('Text', 52.5, 70, 72, 40, 'Haltet den Tag frei, edle Gäste, denn es wird gespeist, getanzt und gefeiert. Die Einladung wird euch in Kürze zugestellt.', SER({ s: 10, c: S.cream, wrap: true, v: 'top', lh: 1.55, min: 7, a: 'center' })),
      dk('Trenner', 'deko-motive-eichenlaub-trenner-gold', 26, 118, 53),
    ], 'Rückseite'),
  ],
});

const einl = make('flach', S, {
  slug: 'hochzeit-einladung-flach-mittelalter', name: 'Hochzeit Einladung – Mittelalter', formatKey: 'a5-portrait', width: 148, height: 210,
  description: 'Flache Einladungskarte A5 hoch auf Pergament für eine Mittelalter- oder Burghochzeit: zwei Banner, Wappen mit Herz, Einladungstext im Urkundenstil, Eckdaten und Wachssiegel. Cinzel und Lora, Bordeaux und Gold.',
  tags: [...TAGS, 'Einladung', 'Einladungskarte', 'A5', 'Banner', 'Siegel'],
  pages: [page(S.bg, [
    frameLine('Rahmen', 5, 5, 138, 200, S.ink, 0.5),
    frameLine('Rahmen innen', 7, 7, 134, 196, S.gold, 0.3),
    dk('Banner links', 'deko-motive-wimpelbanner-bordeaux', 12, 10, 24),
    dk('Banner rechts', 'deko-motive-wimpelbanner-bordeaux', 112, 10, 24),
    dk('Wappen', 'deko-motive-wappen-bordeaux', 56, 14, 36),
    ctext('Kopf', 74, 62, 100, 10, 'Kund und zu wissen sei,', SER({ s: 11, i: true, min: 8 })),
    ctext('Namen', 74, 74, 126, 18, 'ANNA & JONAS', CAP({ s: 28, min: 14 })),
    ctext('Text', 74, 94, 100, 14, 'laden alle Edlen und Getreuen\nzu ihrer Vermählung', SER({ s: 11, wrap: true, v: 'top', lh: 1.45, min: 8, a: 'center' })),
    dk('Trenner', 'deko-motive-eichenlaub-trenner-bordeaux', 44, 113, 60),
    ctext('Datum', 74, 122, 100, 9, 'am Samstag, den 12. Juni 2027', CAP({ s: 13, min: 8 })),
    ctext('Zeit', 74, 133, 100, 7, 'zur Stunde der Nachmittagsmesse (14 Uhr)', SER({ s: 10, i: true, min: 7 })),
    ctext('Ort', 74, 143, 100, 14, 'auf ' + C.place + '\nBirkenallee 4, 12345 Musterstadt', SER({ s: 11, wrap: true, v: 'top', lh: 1.4, min: 7, a: 'center' })),
    ctext('Danach', 74, 162, 110, 12, 'Es folgen Festmahl, Spielleute und Tanz\nbis in die späte Stunde.', SER({ s: 10, wrap: true, v: 'top', lh: 1.4, min: 7, a: 'center' })),
    ctext('Antwort', 58, 182, 80, 10, 'Eure Antwort erbitten wir bis zum 1. Mai 2027', SER({ s: 9, i: true, c: S.red, min: 7 })),
    dk('Siegel', 'deko-baender-siegel-wachs-bordeaux', 108, 178, 22),
  ], 'Einladung')],
});

const tisch = make('tisch', S, Object.assign({}, TISCH_META, {
  slug: 'hochzeit-tischkarte-mittelalter', name: 'Hochzeit Tischkarte – Mittelalter',
  description: 'Tischkarte als Zeltkarte (gefaltet 90 × 50 mm) auf Pergament: der Name des Gastes in Cinzel mit kleinem Wappen, darunter der Platz an der Tafel. Innen ein goldener Kelch auf Bordeaux. Für Serien mit Gästelisten.',
  tags: [...TAGS, 'Tischkarte', 'Platzkarte', 'Namenskarte', 'Zeltkarte', 'Gäste', 'Serie'],
  pages: tent(y => [
    frameLine('Rahmen', 3.5, y + 4, 83, 42, S.ink, 0.4),
    frameLine('Rahmen innen', 5.5, y + 6, 79, 38, S.gold, 0.2),
    dk('Wappen', 'deko-motive-wappen-bordeaux', 38, y + 7, 11),
    ctext('Name', 45, y + 20, 72, 9, '{{Name}}', CAP({ s: 13, min: 7 })),
    dk('Trenner', 'deko-motive-eichenlaub-trenner-bordeaux', 31, y + 31, 28),
    ctext('Tisch', 45, y + 36, 70, 5, 'AN DER TAFEL {{Tisch}}', CAP({ s: 7, c: S.red, w: 400, min: 7 })),
  ], [
    dk('Kelch', 'deko-motive-kelch-gold', 38, 53, 13),
    ctext('Namen', 45, 76, 74, 8, 'ANNA & JONAS', CAP({ s: 12, c: S.cream, min: 7 })),
    ctext('Datum', 45, 86, 70, 5, '12. JUNI 2027', CAP({ s: 7, c: '#e3c479', w: 400, min: 7 })),
  ], S.bg, S.bg2),
}));

const menue = make('menue', S, {
  slug: 'hochzeit-menuekarte-mittelalter', name: 'Hochzeit Menükarte – Mittelalter', formatKey: 'menu-dl', width: 99, height: 210,
  description: 'Menükarte DIN lang auf Pergament als „Festmahl“: goldener Kelch, Gänge mit altertümlichen Überschriften („Zur Eröffnung“, „Der Hauptgang“) und Eichenlaub-Trennern, Rahmen in Tinte und Gold. Gerichte einfach überschreiben.',
  tags: [...TAGS, 'Menükarte', 'Menü', 'Speisekarte', 'DIN lang', 'Festmahl', 'Kelch'],
  pages: [page(S.bg, [
    frameLine('Rahmen', 5, 5, 89, 200, S.ink, 0.5),
    frameLine('Rahmen innen', 7, 7, 85, 196, S.gold, 0.3),
    dk('Kelch', 'deko-motive-kelch-gold', 42, 10, 14),
    ctext('Titel', 49.5, 38, 76, 10, 'Das Festmahl', CAP({ s: 18, c: S.red, min: 10 })),
    dk('Trenner', 'deko-motive-eichenlaub-trenner-bordeaux', 22, 50, 55),
    ...MENU_M.flatMap(([course, dish], i) => {
      const y = 59 + i * 28;
      return [
        ctext('Gang ' + (i + 1), 49.5, y, 76, 6, course.toUpperCase(), CAP({ s: 7.5, c: S.red, min: 7 })),
        ctext('Gericht ' + (i + 1), 49.5, y + 6.5, 78, 17, dish, SER({ s: 10.5, i: true, wrap: true, v: 'top', lh: 1.3, min: 7, a: 'center' })),
      ];
    }),
  ], 'Menükarte')],
});

module.exports = { std, einl, tisch, menue };
