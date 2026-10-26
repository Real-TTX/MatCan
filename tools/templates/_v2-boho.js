/* Style line "Boho": cream paper, terracotta, ochre and sage, arch shapes, pampas grass, dried flowers, sun and moon phases. */
'use strict';
const V = require('./_v2-lib');
const { text, rect, ellipse, line, page, ctext, ltext, dk, make, C, tent, TISCH_META, MENU, foldCard, panels } = V;

const S = { variant: 'Boho', bg: '#f6ede0', blush: '#f1d9c8', sand: '#ecd9b0', terra: '#c9714f', ochre: '#e1a96c', sage: '#8c9a7c', ink: '#5a4033', serif: 'Cormorant Garamond', caps: 'Josefin Sans', script: 'Allura' };
const TAGS = ['Hochzeit', 'Boho', 'Pampasgras', 'Trockenblumen', 'Terrakotta', 'natürlich', 'Bogen', 'Sonne', 'Brautpaar'];
const CAP = (o) => Object.assign({ f: S.caps, w: 400, c: S.sage, ls: 0.3 }, o);
const SER = (o) => Object.assign({ f: S.serif, c: S.ink }, o);

/** An arch: a rectangle with a round top. */
const arch = (name, x, y, w, h, fill, o = {}) => [rect(name, x, y, w, h, fill, Object.assign({ radius: w / 2, locked: true }, o)), rect(name + ' Fuß', x, y + h / 2, w, h / 2, fill, { locked: true, stroke: o.stroke, sw: o.sw })];

const std = make('std', S, {
  slug: 'save-the-date-boho', name: 'Save the Date – Boho',
  description: 'Save-the-Date-Postkarte A6 hoch im Boho-Stil: ein zarter Bogen mit Sonne in Terrakotta, Namen in Antiqua, Pampasgras und Trockenblumen am Rand. Die Rückseite zeigt die Mondphasen und kündigt die Einladung an.',
  tags: [...TAGS, 'Save the Date', 'Termin', 'Postkarte'],
  formatKey: 'postcard-a6-portrait', width: 105, height: 148,
  pages: [
    page(S.bg, [
      arch('Bogen', 21, 10, 63, 128, S.blush),
      dk('Pampasgras', 'deko-motive-pampasgras', 1, 88, 20),
      dk('Trockenblumen', 'deko-motive-trockenblumen', 80, 104, 24),
      dk('Sonne', 'deko-motive-bohosonne', 36, 20, 33),
      ctext('Save the Date', 52.5, 59, 50, 6, 'SAVE THE DATE', CAP({ s: 7, w: 600, min: 7 })),
      ctext('Name 1', 52.5, 66, 56, 14, 'Anna', SER({ s: 32, w: 500, min: 18 })),
      ctext('Und', 52.5, 79, 20, 7, '&', SER({ s: 16, i: true, c: S.terra, min: 10 })),
      ctext('Name 2', 52.5, 85, 56, 14, 'Jonas', SER({ s: 32, w: 500, min: 18 })),
      ctext('Wochentag', 52.5, 103, 50, 5, 'SAMSTAG', CAP({ s: 7, w: 600, c: S.terra, min: 7 })),
      ctext('Datum', 52.5, 109, 56, 9, C.dateShort, SER({ s: 16, w: 600, min: 10 })),
      ctext('Ort', 52.5, 121, 52, 5, C.place.toUpperCase(), CAP({ s: 7, min: 7 })),
    ], 'Vorderseite'),
    page(S.sand, [
      dk('Mondphasen', 'deko-motive-mondphasen-schwarz', 17, 18, 71),
      ctext('Titel', 52.5, 38, 90, 20, 'Wir heiraten', { f: S.script, s: 38, c: S.terra, min: 20 }),
      ctext('Text', 52.5, 64, 70, 36, 'Bitte merkt euch den Tag vor. Wir feiern draußen, barfuß im Gras, mit Musik, gutem Essen und euch. Die Einladung folgt.', SER({ s: 12.5, w: 500, wrap: true, v: 'top', lh: 1.45, min: 8 })),
      ctext('Namen', 52.5, 108, 70, 6, 'ANNA & JONAS', CAP({ s: 8, w: 600, c: S.ink, min: 7 })),
      dk('Pampasgras', 'deko-motive-pampasgras', 82, 100, 20),
    ], 'Rückseite'),
  ],
});

const einl = make('klapp', S, {
  slug: 'hochzeit-einladung-klapp-boho', name: 'Hochzeit Einladung (Klappkarte) – Boho',
  description: 'Klappkarte A6 hoch im Boho-Stil: vorne ein Bogen mit Sonne und den Namen, hinten Mondphasen und Pampasgras, innen Einladungstext und Eckdaten. Warme Erdtöne auf Cremepapier; passt zum Save the Date.',
  tags: [...TAGS, 'Einladung', 'Klappkarte', 'Einladungskarte', 'A6'],
  formatKey: 'card-a6-portrait', fold: 'vertical', width: 210, height: 148,
  pages: foldCard('vertical', [
    // back (left half)
    dk('Pampasgras', 'deko-motive-pampasgras', 10, 76, 24),
    dk('Trockenblumen', 'deko-motive-trockenblumen', 68, 86, 28),
    dk('Mondphasen', 'deko-motive-mondphasen-schwarz', 17, 22, 71),
    ctext('Rückseite Text', 52.5, 42, 70, 12, 'in Liebe', { f: S.script, s: 26, c: S.terra, min: 14 }),
    // front (right half)
    ...arch('Bogen', 126, 10, 63, 128, S.blush),
    dk('Sonne', 'deko-motive-bohosonne', 141, 20, 33),
    ctext('Kopf', 157.5, 59, 56, 6, 'WIR HEIRATEN', CAP({ s: 7, w: 600, min: 7 })),
    ctext('Name 1', 157.5, 66, 56, 14, 'Anna', SER({ s: 32, w: 500, min: 18 })),
    ctext('Und', 157.5, 79, 20, 7, '&', SER({ s: 16, i: true, c: S.terra, min: 10 })),
    ctext('Name 2', 157.5, 85, 56, 14, 'Jonas', SER({ s: 32, w: 500, min: 18 })),
    ctext('Datum', 157.5, 106, 56, 9, C.dateShort, SER({ s: 16, w: 600, min: 10 })),
    ctext('Ort', 157.5, 119, 52, 5, C.place.toUpperCase(), CAP({ s: 7, min: 7 })),
  ], [
    dk('Trockenblumen', 'deko-motive-trockenblumen', 6, 100, 26),
    ctext('Anrede', 52.5, 14, 84, 12, 'Liebe Familie, liebe Freunde,', { f: S.script, s: 22, c: S.terra, min: 12 }),
    ctext('Text', 56, 32, 80, 56, 'wir sagen Ja und möchten diesen Tag mit den Menschen feiern, die uns am Herzen liegen. Kommt zu uns aufs Land, bringt gute Laune mit und lasst euch von uns verwöhnen.', SER({ s: 12, w: 500, wrap: true, v: 'top', lh: 1.5, min: 8, a: 'center' })),
    ctext('Name', 52.5, 120, 80, 8, 'Anna & Jonas', { f: S.script, s: 20, c: S.ink, min: 12 }),
    ctext('Wann', 157.5, 14, 80, 5, 'WANN', CAP({ s: 7, w: 600, min: 7 })),
    ctext('Wann Wert', 157.5, 20, 84, 14, C.date + '\nTrauung um 14:00 Uhr', SER({ s: 13, w: 500, wrap: true, v: 'top', lh: 1.3, min: 8 })),
    ctext('Wo', 157.5, 44, 80, 5, 'WO', CAP({ s: 7, w: 600, min: 7 })),
    ctext('Wo Wert', 157.5, 50, 84, 16, C.place + '\nBirkenallee 4, 12345 Musterstadt', SER({ s: 13, w: 500, wrap: true, v: 'top', lh: 1.3, min: 8 })),
    ctext('Danach', 157.5, 74, 80, 5, 'DANACH', CAP({ s: 7, w: 600, min: 7 })),
    ctext('Danach Wert', 157.5, 80, 84, 16, 'Essen, Musik und Tanz\nunter dem Sternenhimmel', SER({ s: 13, w: 500, wrap: true, v: 'top', lh: 1.3, min: 8 })),
    ctext('Antwort', 157.5, 104, 80, 5, 'ANTWORT', CAP({ s: 7, w: 600, min: 7 })),
    ctext('Antwort Wert', 157.5, 110, 84, 12, C.reply, SER({ s: 12, i: true, w: 500, min: 8 })),
    dk('Pampasgras', 'deko-motive-pampasgras', 190, 90, 14),
  ], S.bg),
});

const tisch = make('tisch', S, Object.assign({}, TISCH_META, {
  slug: 'hochzeit-tischkarte-boho', name: 'Hochzeit Tischkarte – Boho',
  description: 'Tischkarte als Zeltkarte (gefaltet 90 × 50 mm) im Boho-Stil: Trockenblumen links, der Name des Gastes in Antiqua, die Tischnummer in Salbeigrün. Die Rückseite zeigt dasselbe. Für Serien mit Gästelisten.',
  tags: [...TAGS, 'Tischkarte', 'Platzkarte', 'Namenskarte', 'Zeltkarte', 'Gäste', 'Serie'],
  pages: tent(y => [
    rect('Band', 0, y + 46, 90, 4, S.terra, { locked: true }),
    dk('Trockenblumen', 'deko-motive-trockenblumen', 7, y + 8, 24),
    ctext('Name', 61, y + 11, 52, 14, '{{Name}}', SER({ s: 20, w: 500, min: 9 })),
    line('Strich', 50, y + 29, 72, y + 29, S.terra, 0.3, { locked: true }),
    ctext('Tisch', 61, y + 32, 50, 5, 'TISCH {{Tisch}}', CAP({ s: 7, w: 600, min: 7 })),
  ], [
    dk('Mondphasen', 'deko-motive-mondphasen-schwarz', 20, 60, 50),
    ctext('Namen', 45, 76, 70, 9, 'Anna & Jonas', { f: S.script, s: 20, c: S.ink, min: 10 }),
    ctext('Datum', 45, 87, 70, 5, C.dateNum, CAP({ s: 7, w: 600, min: 7 })),
  ], S.sand),
}));

const menue = make('menue', S, {
  slug: 'hochzeit-menuekarte-boho', name: 'Hochzeit Menükarte – Boho', formatKey: 'menu-dl', width: 99, height: 210,
  description: 'Menükarte DIN lang im Boho-Stil: ein Bogen mit Sonne und „Menü“ in Schreibschrift, darunter die fünf Gänge in Antiqua mit Terrakotta-Überschriften. Gerichte einfach überschreiben.',
  tags: [...TAGS, 'Menükarte', 'Menü', 'Speisekarte', 'DIN lang', 'Gänge'],
  pages: [page(S.bg, [
    ...arch('Bogen', 17, 8, 65, 58, S.blush),
    dk('Sonne', 'deko-motive-bohosonne', 36, 14, 26),
    ctext('Titel', 49.5, 42, 56, 18, 'Menü', { f: S.script, s: 38, c: S.terra, min: 20 }),
    ...MENU.flatMap(([course, dish], i) => {
      const y = 76 + i * 25;
      return [
        ctext('Gang ' + (i + 1), 49.5, y, 76, 5, course.toUpperCase(), CAP({ s: 7, w: 600, c: S.terra, min: 7 })),
        ctext('Gericht ' + (i + 1), 49.5, y + 5.5, 80, 16, dish, SER({ s: 11, w: 500, i: true, wrap: true, v: 'top', lh: 1.25, min: 7 })),
      ];
    }),
    dk('Pampasgras', 'deko-motive-pampasgras', 3, 150, 13),
    dk('Trockenblumen', 'deko-motive-trockenblumen', 80, 168, 17),
  ], 'Menükarte')],
});

const danke = make('danke', S, {
  slug: 'hochzeit-danksagung-boho', name: 'Hochzeit Danksagung – Boho',
  description: 'Danksagungskarte als Postkarte A6 quer im Boho-Stil: vorne „Danke“ in Schreibschrift neben einem Strauß Trockenblumen, hinten Platz für einen persönlichen Gruß mit Mondphasen. Warm und natürlich.',
  tags: [...TAGS, 'Danksagung', 'Danke', 'Dankeskarte', 'Postkarte'],
  formatKey: 'postcard-a6-landscape', width: 148, height: 105,
  pages: [
    page(S.blush, [
      dk('Trockenblumen', 'deko-motive-trockenblumen', 10, 8, 63),
      ctext('Danke', 108, 22, 66, 32, 'Danke', { f: S.script, s: 58, c: S.terra, min: 30 }),
      line('Strich', 90, 62, 126, 62, S.ink, 0.3, { locked: true }),
      ctext('Namen', 108, 66, 66, 9, 'Anna & Jonas', SER({ s: 18, w: 500, min: 10 })),
      ctext('Datum', 108, 78, 66, 5, C.dateNum, CAP({ s: 7, w: 600, min: 7 })),
    ], 'Vorderseite'),
    page(S.bg, [
      dk('Mondphasen', 'deko-motive-mondphasen-schwarz', 39, 8, 70),
      ctext('Titel', 74, 22, 120, 14, 'Von Herzen danke', { f: S.script, s: 28, c: S.terra, min: 14 }),
      ctext('Text', 74, 40, 112, 34, 'Ihr habt unseren Tag zu etwas ganz Besonderem gemacht. Danke für eure Zeit, eure Wünsche und die vielen schönen Momente.', SER({ s: 12.5, w: 500, wrap: true, v: 'top', lh: 1.45, min: 8, a: 'center' })),
      ctext('Gruß', 74, 82, 100, 8, 'Eure Anna & Jonas', SER({ s: 15, i: true, w: 500, min: 9 })),
    ], 'Rückseite'),
  ],
});

module.exports = { std, einl, tisch, menue, danke };
