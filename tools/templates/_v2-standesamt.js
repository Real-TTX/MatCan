/* Style line "Standesamt schlicht": white, one thin line, two small rings, Lora italic and Montserrat capitals. Quiet and short. */
'use strict';
const V = require('./_v2-lib');
const { text, rect, ellipse, line, page, ctext, ltext, dk, make, C, tent, TISCH_META, MENU, dekoIn } = V;

const S = { variant: 'Standesamt schlicht', bg: '#ffffff', ink: '#2b2b2b', sage: '#7f9186', gold: '#a98334', soft: '#f1f3f0', serif: 'Lora', caps: 'Montserrat' };
const TAGS = ['Hochzeit', 'Standesamt', 'standesamtlich', 'schlicht', 'zurückhaltend', 'klein', 'Trauung', 'Ringe', 'Brautpaar'];
const SER = (o) => Object.assign({ f: S.serif, c: S.ink, i: true, w: 400 }, o);
const CAP = (o) => Object.assign({ f: S.caps, c: S.sage, w: 500, ls: 0.3 }, o);
const RINGS = 'deko-motive-trauringe-gold';

const std = make('std', S, {
  slug: 'save-the-date-standesamt-schlicht', name: 'Save the Date – Standesamt schlicht',
  description: 'Schlichte Save-the-Date-Postkarte A6 hoch für die standesamtliche Trauung: zwei kleine goldene Ringe, die Namen in kursiver Antiqua und Datum samt Standesamt in feinen Kapitälchen. Rückseite mit kurzem Hinweis auf die Einladung im kleinen Kreis.',
  tags: [...TAGS, 'Save the Date', 'Termin', 'Postkarte'],
  formatKey: 'postcard-a6-portrait', width: 105, height: 148,
  pages: [
    page(S.bg, [
      dk('Ringe', RINGS, 38, 22, 29),
      ctext('Kopf', 52.5, 50, 80, 6, 'WIR HEIRATEN', CAP({ s: 7.5, min: 7 })),
      ctext('Namen', 52.5, 60, 90, 16, 'Anna & Jonas', SER({ s: 28, min: 16 })),
      line('Linie', 42, 84, 63, 84, S.gold, 0.4, { locked: true }),
      ctext('Datum', 52.5, 90, 90, 8, C.dateShort, SER({ s: 14, i: false, min: 9 })),
      ctext('Ort', 52.5, 102, 90, 10, 'STANDESAMT ' + C.city.toUpperCase() + '\nRATHAUSPLATZ 1', CAP({ s: 7, c: S.ink, wrap: true, v: 'top', lh: 1.6, a: 'center', min: 7 })),
    ], 'Vorderseite'),
    page(S.soft, [
      ctext('Text', 52.5, 54, 70, 40, 'Wir würden uns freuen, diesen Tag im kleinen Kreis mit euch zu verbringen. Die Einladung mit allen Einzelheiten folgt in Kürze.', SER({ s: 11, wrap: true, v: 'top', lh: 1.6, min: 8, a: 'center' })),
      line('Linie', 42, 104, 63, 104, S.gold, 0.4, { locked: true }),
    ], 'Rückseite'),
  ],
});

const einl = make('flach', S, {
  slug: 'hochzeit-einladung-flach-standesamt-schlicht', name: 'Hochzeit Einladung – Standesamt schlicht', formatKey: 'a6-portrait', width: 105, height: 148,
  description: 'Schlichte Einladungskarte A6 hoch zur standesamtlichen Trauung im kleinen Kreis: zwei goldene Ringe, Namen in kursiver Antiqua, Uhrzeit, Standesamt und ein anschließendes Mittagessen in feinen Kapitälchen. Viel Weiß, wenig Worte.',
  tags: [...TAGS, 'Einladung', 'Einladungskarte', 'A6', 'kleiner Kreis'],
  pages: [page(S.bg, [
    dk('Ringe', RINGS, 38, 14, 29),
    ctext('Kopf', 52.5, 42, 80, 6, 'WIR HEIRATEN', CAP({ s: 7.5, min: 7 })),
    ctext('Namen', 52.5, 51, 90, 16, 'Anna & Jonas', SER({ s: 28, min: 16 })),
    ctext('Einladung', 52.5, 72, 80, 10, 'und laden euch herzlich ein', SER({ s: 10.5, min: 8 })),
    line('Linie', 42, 87, 63, 87, S.gold, 0.4, { locked: true }),
    ctext('Datum', 52.5, 92, 90, 7, C.date, SER({ s: 12, i: false, min: 8 })),
    ctext('Zeit', 52.5, 100, 90, 6, 'TRAUUNG UM 11:00 UHR', CAP({ s: 7, c: S.ink, min: 7 })),
    ctext('Ort', 52.5, 108, 90, 12, 'Standesamt Musterstadt\nRathausplatz 1', SER({ s: 10.5, i: false, wrap: true, v: 'top', lh: 1.4, min: 7, a: 'center' })),
    ctext('Danach', 52.5, 122, 90, 10, 'Anschließend Mittagessen im\nRestaurant „Zur Linde“', SER({ s: 9.5, wrap: true, v: 'top', lh: 1.4, min: 7, a: 'center' })),
    ctext('Antwort', 52.5, 137, 90, 5, 'Um Antwort bis 1. Mai 2027 wird gebeten', CAP({ s: 7, min: 7, ls: 0.1 })),
  ], 'Einladung')],
});

const tisch = make('tisch', S, Object.assign({}, TISCH_META, {
  slug: 'hochzeit-tischkarte-standesamt-schlicht', name: 'Hochzeit Tischkarte – Standesamt schlicht',
  description: 'Schlichte Tischkarte als Zeltkarte (gefaltet 90 × 50 mm): der Name des Gastes in kursiver Antiqua, eine feine Goldlinie, die Tischnummer in Kapitälchen. Innen zwei kleine Ringe. Für Serien mit Gästelisten.',
  tags: [...TAGS, 'Tischkarte', 'Platzkarte', 'Namenskarte', 'Zeltkarte', 'Gäste', 'Serie'],
  pages: tent(y => [
    ctext('Name', 45, y + 12, 74, 15, '{{Name}}', SER({ s: 20, min: 9 })),
    line('Linie', 38, y + 31, 52, y + 31, S.gold, 0.4, { locked: true }),
    ctext('Tisch', 45, y + 34, 60, 5, 'TISCH {{Tisch}}', CAP({ s: 7, c: S.ink, min: 7 })),
  ], [
    dk('Ringe', RINGS, 36, 60, 18),
    ctext('Namen', 45, 80, 70, 8, 'Anna & Jonas', SER({ s: 14, min: 8 })),
    ctext('Datum', 45, 89, 70, 5, C.dateNum, CAP({ s: 7, min: 7 })),
  ], S.bg, S.soft),
}));

const menue = make('menue', S, {
  slug: 'hochzeit-menuekarte-standesamt-schlicht', name: 'Hochzeit Menükarte – Standesamt schlicht', formatKey: 'menu-dl', width: 99, height: 210,
  description: 'Schlichte Menükarte DIN lang für das Essen nach der standesamtlichen Trauung: kleine Ringe, „Menü“ in kursiver Antiqua, die Gänge in feinen Kapitälchen mit einer Goldlinie. Gerichte einfach überschreiben.',
  tags: [...TAGS, 'Menükarte', 'Menü', 'Speisekarte', 'DIN lang', 'Gänge'],
  pages: [page(S.bg, [
    dk('Ringe', RINGS, 38, 14, 23),
    ctext('Titel', 49.5, 36, 70, 12, 'Menü', SER({ s: 24, min: 14 })),
    line('Linie', 40, 52, 59, 52, S.gold, 0.4, { locked: true }),
    ...MENU.map(([course, dish], i) => [
      ctext('Gang ' + (i + 1), 49.5, 62 + i * 26, 76, 5, course.toUpperCase(), CAP({ s: 7, min: 7 })),
      ctext('Gericht ' + (i + 1), 49.5, 68 + i * 26, 80, 16, dish, SER({ s: 10.5, i: false, wrap: true, v: 'top', lh: 1.3, min: 7, a: 'center' })),
    ]),
    ctext('Fuß', 49.5, 196, 76, 6, 'ANNA & JONAS · 12.06.2027', CAP({ s: 7, c: S.ink, min: 7 })),
  ], 'Menükarte')],
});

module.exports = { std, einl, tisch, menue };
