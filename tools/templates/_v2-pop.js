/* Style line "Jung & Modern" (Pop): bold colour blocks, chunky Poppins, hearts and sparkles with a black outline. */
'use strict';
const V = require('./_v2-lib');
const { text, rect, ellipse, line, page, ctext, ltext, dk, make, C, tent, TISCH_META, MENU, pill, deko } = V;

const S = { variant: 'Jung & Modern', bg: '#fff6e5', ink: '#1d1d1b', pink: '#ff5d8f', yellow: '#ffd23f', teal: '#3ad4c0', violet: '#8e5cf0', f: 'Poppins' };
const H = (o) => Object.assign({ f: S.f, w: 700, c: S.ink }, o);
const TAGS = ['Hochzeit', 'Pop', 'bunt', 'modern', 'jung', 'Pop-Art', 'frech', 'knallig', 'Brautpaar'];

const std = make('std', S, {
  slug: 'save-the-date-jung-modern', name: 'Save the Date – Jung & Modern',
  description: 'Quadratische Save-the-Date-Karte (100 mm) in Knallgelb und Türkis: Namen in fetten Kleinbuchstaben, Datum in einer schwarzen Pille, Herz und Funkeln mit Outline. Die Rückseite kündigt die Feier an. Für Paare, die laut und bunt heiraten.',
  tags: [...TAGS, 'Save the Date', 'Termin', 'quadratisch'],
  formatKey: 'square-100', width: 100, height: 100,
  pages: [
    page(S.yellow, [
      dk('Funkeln', 'deko-motive-pop-funkeln', 58, 3, 38),
      ltext('Save the Date', 8, 9, 46, 6, 'SAVE THE DATE', H({ s: 8, ls: 0.12, min: 6 })),
      ltext('Name 1', 8, 22, 84, 24, 'anna', H({ s: 58, lh: 1, min: 30 })),
      ltext('Name 2', 8, 44, 84, 24, '& jonas', H({ s: 58, lh: 1, min: 30 })),
      dk('Schnörkel', 'deko-motive-pop-schnoerkel-bunt', 8, 71, 38),
      ...pill('Datum', 8, 80, 52, 11, S.ink, 'SA · 12.06.2027', { f: S.f, s: 10, w: 700, c: S.yellow, min: 7 }),
      dk('Herz', 'deko-motive-pop-herz', 66, 66, 28),
    ], 'Vorderseite'),
    page(S.teal, [
      ltext('Titel', 8, 10, 84, 38, 'WIR\nHEIRATEN!', H({ s: 32, lh: 1.02, wrap: true, v: 'top', min: 20 })),
      ltext('Text', 8, 52, 58, 28, 'Haltet euch den Tag frei: Es gibt Konfetti, Torte und Tanzen bis zum Morgengrauen. Die Einladung folgt.', H({ s: 9, w: 500, wrap: true, v: 'top', lh: 1.4, min: 7 })),
      ltext('Ort', 8, 86, 60, 6, C.place.toUpperCase() + ' · ' + C.city.toUpperCase(), H({ s: 7, ls: 0.1, min: 7 })),
      dk('Funkeln', 'deko-motive-pop-funkeln', 68, 62, 26),
    ], 'Rückseite'),
  ],
});

const einl = make('flach', S, {
  slug: 'hochzeit-einladung-flach-jung-modern', name: 'Hochzeit Einladung – Jung & Modern',
  description: 'Flache Einladungskarte A5 hoch: oben ein pinker Farbblock mit den Namen in fetten Kleinbuchstaben, darunter Datum, Ort, Uhrzeit und Antwortwunsch. Regenbogen, Herz und Funkeln mit Outline. Passt zum Save the Date im selben Stil.',
  tags: [...TAGS, 'Einladung', 'Einladungskarte', 'A5', 'Regenbogen'],
  formatKey: 'a5-portrait', width: 148, height: 210,
  pages: [page(S.bg, [
    rect('Block', 0, 0, 148, 104, S.pink, { locked: true }),
    dk('Funkeln', 'deko-motive-pop-funkeln', 96, 8, 40),
    ltext('Kopf', 12, 14, 80, 7, 'WIR HEIRATEN!', H({ s: 10, ls: 0.12, min: 7 })),
    ltext('Name 1', 12, 30, 124, 30, 'anna', H({ s: 70, lh: 1, min: 36 })),
    ltext('Name 2', 12, 60, 124, 30, '& jonas', H({ s: 70, lh: 1, min: 36 })),
    ...pill('Datum', 12, 114, 124, 14, S.ink, 'SAMSTAG · 12.06.2027', { f: S.f, s: 15, w: 700, c: S.yellow, min: 9 }),
    ltext('Einladung', 12, 136, 124, 8, 'Wir laden euch zu unserer Hochzeit ein!', H({ s: 12, min: 8 })),
    ltext('Ort', 12, 148, 90, 22, C.place + '\nBirkenallee 4, 12345 Musterstadt', H({ s: 11.5, w: 500, wrap: true, v: 'top', lh: 1.4, min: 7 })),
    ltext('Zeit', 12, 171, 90, 16, 'Trauung ab 14:00 Uhr\nDresscode: bunt!', H({ s: 11.5, w: 500, wrap: true, v: 'top', lh: 1.4, min: 7 })),
    ltext('Antwort', 12, 192, 100, 6, C.reply, H({ s: 8, w: 500, min: 7 })),
    dk('Herz', 'deko-motive-pop-herz', 104, 148, 32),
    dk('Regenbogen', 'deko-motive-pop-regenbogen', 100, 178, 36),
  ], 'Einladung')],
});

const tisch = make('tisch', S, Object.assign({}, TISCH_META, {
  slug: 'hochzeit-tischkarte-jung-modern', name: 'Hochzeit Tischkarte – Jung & Modern',
  description: 'Tischkarte als Zeltkarte (gefaltet 90 × 50 mm): der Name des Gastes in fetten Buchstaben auf Cremeweiß, ein türkiser Balken, die Tischnummer in einer gelben Pille. Für Serien mit Gästelisten.',
  tags: [...TAGS, 'Tischkarte', 'Platzkarte', 'Namenskarte', 'Zeltkarte', 'Gäste', 'Serie'],
  pages: tent(y => [
    rect('Balken', 0, y, 90, 7, S.teal, { locked: true }),
    dk('Funkeln', 'deko-motive-pop-funkeln', 7, y + 33, 14),
    ctext('Name', 45, y + 14, 66, 15, '{{Name}}', H({ s: 22, min: 9 })),
    ...pill('Tischnummer', 25, y + 35, 40, 9, S.yellow, 'TISCH {{Tisch}}', { f: S.f, s: 8, w: 700, c: S.ink, stroke: S.ink, sw: 1, min: 7 }),
  ], [
    dk('Herz', 'deko-motive-pop-herz', 36, 53, 18),
    ctext('Namen', 45, 74, 70, 8, 'anna & jonas', H({ s: 14, min: 8 })),
    ctext('Datum', 45, 84, 70, 5, C.dateNum, H({ s: 7.5, ls: 0.1, min: 7 })),
  ], S.bg),
}));

const menue = make('menue', S, {
  slug: 'hochzeit-menuekarte-jung-modern', name: 'Hochzeit Menükarte – Jung & Modern', formatKey: 'menu-dl', width: 99, height: 210,
  description: 'Menükarte DIN lang: gelber Kopf mit „menü“ in fetten Buchstaben und Funkeln, die Gänge mit nummerierten pinken Kreisen. Frisch, laut und gut lesbar; die Gerichte einfach überschreiben.',
  tags: [...TAGS, 'Menükarte', 'Menü', 'Speisekarte', 'DIN lang', 'Gänge'],
  pages: [page(S.bg, [
    rect('Kopf', 0, 0, 99, 46, S.yellow, { locked: true }),
    ltext('Titel', 9, 12, 60, 26, 'menü', H({ s: 54, lh: 1, min: 28 })),
    dk('Funkeln', 'deko-motive-pop-funkeln', 66, 6, 28),
    ...MENU.slice(0, 4).flatMap(([course, dish], i) => {
      const y = 56 + i * 36;
      return [
        ellipse('Kreis ' + (i + 1), 9, y, 12, 12, S.pink, { stroke: S.ink, sw: 1.5, locked: true }),
        ctext('Nr ' + (i + 1), 15, y, 12, 12, String(i + 1), H({ s: 12, min: 8 })),
        ltext('Gang ' + (i + 1), 26, y - 1, 66, 7, course.toUpperCase(), H({ s: 10, ls: 0.1, min: 7 })),
        ltext('Gericht ' + (i + 1), 26, y + 7, 68, 22, dish, H({ s: 10.5, w: 500, wrap: true, v: 'top', lh: 1.35, min: 7 })),
      ];
    }),
    dk('Schnörkel', 'deko-motive-pop-schnoerkel-bunt', 9, 198, 50),
    ltext('Fuß', 62, 197, 30, 6, 'anna & jonas', H({ s: 8, min: 7 })),
  ], 'Menükarte')],
});

const danke = make('danke', S, {
  slug: 'hochzeit-danksagung-jung-modern', name: 'Hochzeit Danksagung – Jung & Modern',
  description: 'Danksagungskarte als Postkarte A6 quer: vorne ein riesiges „danke“ auf Pink mit Herz und Funkeln, hinten Platz für einen persönlichen Gruß. Laut, froh und im Stil der Einladung.',
  tags: [...TAGS, 'Danksagung', 'Danke', 'Dankeskarte', 'Postkarte'],
  formatKey: 'postcard-a6-landscape', width: 148, height: 105,
  pages: [
    page(S.pink, [
      dk('Funkeln', 'deko-motive-pop-funkeln', 112, 4, 30),
      ltext('Danke', 10, 30, 130, 44, 'danke!', H({ s: 92, lh: 1, min: 40 })),
      ...pill('Namen', 10, 76, 66, 12, S.ink, 'anna & jonas', { f: S.f, s: 12, w: 700, c: S.yellow, min: 8 }),
      dk('Herz', 'deko-motive-pop-herz', 108, 56, 32),
    ], 'Vorderseite'),
    page(S.bg, [
      rect('Streifen', 0, 0, 8, 105, S.teal, { locked: true }),
      ltext('Titel', 18, 12, 120, 12, 'Ihr wart großartig!', H({ s: 18, min: 10 })),
      ltext('Text', 18, 30, 118, 44, 'Danke, dass ihr mit uns gefeiert, getanzt und gelacht habt. Euer Kommen, eure Geschenke und eure Wünsche haben diesen Tag unvergesslich gemacht.', H({ s: 10, w: 500, wrap: true, v: 'top', lh: 1.5, min: 7 })),
      ltext('Gruß', 18, 82, 100, 8, 'Eure Anna & Jonas', H({ s: 13, min: 8 })),
      dk('Schnörkel', 'deko-motive-pop-schnoerkel-bunt', 18, 92, 40),
    ], 'Rückseite'),
  ],
});

module.exports = { std, einl, tisch, menue, danke };
