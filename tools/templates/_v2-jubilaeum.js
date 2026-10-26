/* Style lines for older couples: Goldene Hochzeit, Silberne Hochzeit, Eheversprechen erneuern. Large, easy-to-read type (12 to 15 pt body), calm layouts.
   Each line exports { einl, tisch, menue, danke }. */
'use strict';
const V = require('./_v2-lib');
const { text, rect, ellipse, line, page, ctext, ltext, dk, make, C, tent, TISCH_META, MENU, dekoIn, frameLine, diamond } = V;

const TAGS = ['Hochzeit', 'Jubiläum', 'Hochzeitstag', 'Ehejubiläum', 'groß gedruckt', 'gut lesbar', 'Familienfeier', 'Jubelpaar'];

// ====================================================================================================================== Goldene Hochzeit
const G = { variant: 'Goldene Hochzeit', bg: '#fbf6e6', ink: '#3a3226', gold: '#a98334', soft: '#f1e6c4', serif: 'Playfair Display', caps: 'Cinzel', body: 'Lora' };
const GP = (o) => Object.assign({ f: G.serif, c: G.ink }, o);
const GC = (o) => Object.assign({ f: G.caps, c: G.gold, w: 400, ls: 0.2 }, o);
const GB = (o) => Object.assign({ f: G.body, c: G.ink, w: 400 }, o);
const GT = [...TAGS, 'Goldene Hochzeit', '50 Jahre', 'Gold', 'Goldhochzeit', 'Lorbeerkranz'];

const goldEinl = make('flach', G, {
  slug: 'hochzeit-einladung-flach-goldene-hochzeit', name: 'Hochzeit Einladung – Goldene Hochzeit', formatKey: 'a5-portrait', width: 148, height: 210,
  description: 'Einladung zur Goldenen Hochzeit als flache Karte A5 hoch: goldener Lorbeerkranz mit der 50, Namen in Antiqua, Einladungstext und Eckdaten in großer, gut lesbarer Schrift. Ruhig, festlich und für alle Generationen gut zu lesen.',
  tags: [...GT, 'Einladung', 'Einladungskarte', 'A5'],
  pages: [page(G.bg, [
    dekoIn('Rahmen', 'deko-rahmen-doppellinie-hoch-gold', 4, 4, 140, 202, { locked: true }),
    dk('Kranz', 'deko-motive-goldene-50-gold', 34, 14, 80),
    ctext('Zahl', 74, 38, 50, 34, '50', GP({ s: 82, c: G.gold, lh: 1, min: 40 })),
    ctext('Titel', 74, 98, 120, 8, 'GOLDENE HOCHZEIT', GC({ s: 15, min: 9 })),
    ctext('Namen', 74, 109, 126, 16, 'Anna & Jonas', GP({ s: 32, i: true, min: 16 })),
    ctext('Text', 74, 129, 112, 22, 'laden herzlich ein zur Feier\nihrer Goldenen Hochzeit', GB({ s: 14, wrap: true, v: 'top', lh: 1.4, a: 'center', min: 9 })),
    ctext('Datum', 74, 154, 120, 9, 'Samstag, 12. Juni 2027, 14:00 Uhr', GB({ s: 14, w: 700, min: 9 })),
    ctext('Ort', 74, 165, 120, 16, C.place + '\nBirkenallee 4, 12345 Musterstadt', GB({ s: 13, wrap: true, v: 'top', lh: 1.35, a: 'center', min: 8 })),
    ctext('Antwort', 74, 187, 120, 8, 'Wir bitten um Antwort bis zum 1. Mai 2027.', GB({ s: 11.5, i: true, c: G.gold, min: 8 })),
  ], 'Einladung')],
});

const goldTisch = make('tisch', G, Object.assign({}, TISCH_META, {
  slug: 'hochzeit-tischkarte-goldene-hochzeit', name: 'Hochzeit Tischkarte – Goldene Hochzeit',
  description: 'Tischkarte zur Goldenen Hochzeit als Zeltkarte (gefaltet 90 × 50 mm): doppelte Goldlinie, der Name des Gastes in großer Antiqua, Tischnummer in Kapitälchen. Innen die goldene 50. Für Serien mit Gästelisten.',
  tags: [...GT, 'Tischkarte', 'Platzkarte', 'Namenskarte', 'Zeltkarte', 'Gäste', 'Serie'],
  pages: tent(y => [
    frameLine('Rahmen', 3.5, y + 4, 83, 42, G.gold, 0.4),
    frameLine('Rahmen innen', 5.5, y + 6, 79, 38, G.gold, 0.2),
    ctext('Name', 45, y + 11, 72, 16, '{{Name}}', GP({ s: 22, min: 10 })),
    dk('Trenner', 'deko-trenner-schnoerkel-gold', 30, y + 30, 30),
    ctext('Tisch', 45, y + 35, 60, 6, 'TISCH {{Tisch}}', GC({ s: 8.5, min: 7 })),
  ], [
    ctext('Zahl', 45, 55, 50, 22, '50', GP({ s: 56, c: G.gold, lh: 1, min: 28 })),
    ctext('Namen', 45, 80, 76, 9, 'Anna & Jonas', GP({ s: 18, i: true, min: 10 })),
    ctext('Datum', 45, 91, 70, 5, C.dateNum, GC({ s: 7.5, min: 7 })),
  ], G.bg, G.soft),
}));

const goldMenue = make('menue', G, {
  slug: 'hochzeit-menuekarte-goldene-hochzeit', name: 'Hochzeit Menükarte – Goldene Hochzeit', formatKey: 'menu-dl', width: 99, height: 210,
  description: 'Menükarte zur Goldenen Hochzeit im Format DIN lang: kleiner Lorbeerkranz mit der 50, „Festtafel“ in Antiqua, die Gänge in großer, gut lesbarer Schrift. Gerichte einfach überschreiben.',
  tags: [...GT, 'Menükarte', 'Menü', 'Speisekarte', 'DIN lang', 'Gänge'],
  pages: [page(G.bg, [
    dekoIn('Rahmen', 'deko-rahmen-doppellinie-lang-gold', 5, 5, 89, 200, { locked: true }),
    dk('Kranz', 'deko-motive-goldene-50-gold', 33, 12, 33),
    ctext('Zahl', 49.5, 20, 22, 16, '50', GP({ s: 30, c: G.gold, lh: 1, min: 16 })),
    ctext('Titel', 49.5, 48, 76, 12, 'Festtafel', GP({ s: 24, i: true, min: 12 })),
    ...MENU.flatMap(([course, dish], i) => {
      const y = 65 + i * 27;
      return [
        ctext('Gang ' + (i + 1), 49.5, y, 76, 6, course.toUpperCase(), GC({ s: 8.5, w: 700, min: 7 })),
        ctext('Gericht ' + (i + 1), 49.5, y + 6.5, 80, 18, dish, GB({ s: 12, wrap: true, v: 'top', lh: 1.25, a: 'center', min: 8 })),
      ];
    }),
  ], 'Menükarte')],
});

const goldDanke = make('danke', G, {
  slug: 'hochzeit-danksagung-goldene-hochzeit', name: 'Hochzeit Danksagung – Goldene Hochzeit',
  description: 'Danksagungskarte zur Goldenen Hochzeit als Postkarte A6 quer: vorne der goldene Lorbeerkranz mit der 50 und „Herzlichen Dank“, hinten ein persönlicher Gruß in großer Schrift. Ruhig und gut lesbar.',
  tags: [...GT, 'Danksagung', 'Danke', 'Dankeskarte', 'Postkarte'],
  formatKey: 'postcard-a6-landscape', width: 148, height: 105,
  pages: [
    page(G.bg, [
      dk('Kranz', 'deko-motive-goldene-50-gold', 6, 10, 80),
      ctext('Zahl', 46, 34, 44, 30, '50', GP({ s: 70, c: G.gold, lh: 1, min: 36 })),
      ctext('Danke', 114, 26, 66, 34, 'Herzlichen\nDank', GP({ s: 26, i: true, lh: 1.15, wrap: true, v: 'top', min: 14 })),
      line('Strich', 100, 64, 128, 64, G.gold, 0.4, { locked: true }),
      ctext('Namen', 114, 68, 66, 8, 'Anna & Jonas', GB({ s: 13, w: 700, min: 8 })),
      ctext('Datum', 114, 78, 66, 6, C.dateNum, GC({ s: 8, min: 7 })),
    ], 'Vorderseite'),
    page(G.soft, [
      frameLine('Rahmen', 6, 6, 136, 93, G.gold, 0.4),
      ctext('Titel', 74, 14, 100, 12, 'Liebe Familie, liebe Freunde,', GP({ s: 18, i: true, min: 10 })),
      ctext('Text', 74, 30, 112, 40, 'ihr habt mit uns 50 gemeinsame Jahre gefeiert und diesen Tag unvergesslich gemacht. Für eure Glückwünsche, Geschenke und die vielen guten Gespräche danken wir euch von Herzen.', GB({ s: 12.5, wrap: true, v: 'top', lh: 1.5, a: 'center', min: 8 })),
      ctext('Gruß', 74, 80, 100, 9, 'Eure Anna & Jonas', GP({ s: 17, i: true, c: G.gold, min: 9 })),
    ], 'Rückseite'),
  ],
});

// ====================================================================================================================== Silberne Hochzeit
const SV = { variant: 'Silberne Hochzeit', bg: '#f3f5f7', ink: '#2f3a45', silver: '#7d8791', band: '#cfd5db', soft: '#e4e8ec', serif: 'Playfair Display', caps: 'Josefin Sans', body: 'Lora' };
const SP = (o) => Object.assign({ f: SV.serif, c: SV.ink }, o);
const SC = (o) => Object.assign({ f: SV.caps, c: SV.silver, w: 600, ls: 0.3 }, o);
const SB = (o) => Object.assign({ f: SV.body, c: SV.ink, w: 400 }, o);
const ST = [...TAGS, 'Silberne Hochzeit', '25 Jahre', 'Silber', 'Silberhochzeit', 'silbern'];

const silEinl = make('flach', SV, {
  slug: 'hochzeit-einladung-flach-silberne-hochzeit', name: 'Hochzeit Einladung – Silberne Hochzeit', formatKey: 'a5-portrait', width: 148, height: 210,
  description: 'Einladung zur Silbernen Hochzeit als flache Karte A5 hoch: große silberne 25 neben zwei Ringen, Namen in Antiqua und die Eckdaten linksbündig in großer, gut lesbarer Schrift auf kühlem Hellgrau. Klar und ruhig.',
  tags: [...ST, 'Einladung', 'Einladungskarte', 'A5', 'Ringe'],
  pages: [page(SV.bg, [
    rect('Band oben', 0, 0, 148, 12, SV.band, { locked: true }),
    ltext('Zahl', 14, 22, 80, 46, '25', SP({ s: 130, c: SV.silver, lh: 1, min: 60 })),
    dk('Ringe', 'deko-motive-trauringe-silber', 90, 34, 46),
    ltext('Titel', 14, 76, 120, 8, 'SILBERHOCHZEIT', SC({ s: 15, min: 9 })),
    ltext('Namen', 14, 87, 124, 16, 'Anna & Jonas', SP({ s: 32, i: true, min: 16 })),
    line('Strich', 14, 108, 54, 108, SV.silver, 0.5, { locked: true }),
    ltext('Text', 14, 114, 120, 14, 'Wir feiern 25 gemeinsame Jahre und laden euch herzlich dazu ein.', SB({ s: 14, wrap: true, v: 'top', lh: 1.4, min: 9 })),
    ltext('Datum', 14, 138, 124, 9, 'Samstag, 12. Juni 2027, 14:00 Uhr', SB({ s: 14, w: 700, min: 9 })),
    ltext('Ort', 14, 150, 124, 16, C.place + '\nBirkenallee 4, 12345 Musterstadt', SB({ s: 13, wrap: true, v: 'top', lh: 1.35, min: 8 })),
    ltext('Antwort', 14, 176, 124, 8, 'Wir bitten um Antwort bis zum 1. Mai 2027.', SB({ s: 11.5, i: true, c: SV.silver, min: 8 })),
    rect('Band unten', 0, 198, 148, 12, SV.band, { locked: true }),
  ], 'Einladung')],
});

const silTisch = make('tisch', SV, Object.assign({}, TISCH_META, {
  slug: 'hochzeit-tischkarte-silberne-hochzeit', name: 'Hochzeit Tischkarte – Silberne Hochzeit',
  description: 'Tischkarte zur Silbernen Hochzeit als Zeltkarte (gefaltet 90 × 50 mm): ein silbernes Band links, der Name des Gastes in großer Antiqua, die Tischnummer in Kapitälchen. Innen die silberne 25. Für Serien mit Gästelisten.',
  tags: [...ST, 'Tischkarte', 'Platzkarte', 'Namenskarte', 'Zeltkarte', 'Gäste', 'Serie'],
  pages: tent(y => [
    rect('Band', 0, y, 10, 50, SV.band, { locked: true }),
    ctext('Name', 52, y + 12, 64, 16, '{{Name}}', SP({ s: 21, min: 9 })),
    line('Strich', 42, y + 31, 62, y + 31, SV.silver, 0.4, { locked: true }),
    ctext('Tisch', 52, y + 34, 60, 6, 'TISCH {{Tisch}}', SC({ s: 8.5, min: 7 })),
  ], [
    ctext('Zahl', 45, 55, 50, 22, '25', SP({ s: 56, c: SV.silver, lh: 1, min: 28 })),
    ctext('Namen', 45, 80, 76, 9, 'Anna & Jonas', SP({ s: 18, i: true, min: 10 })),
    ctext('Datum', 45, 91, 70, 5, C.dateNum, SC({ s: 7.5, min: 7 })),
  ], SV.bg, SV.soft),
}));

const silMenue = make('menue', SV, {
  slug: 'hochzeit-menuekarte-silberne-hochzeit', name: 'Hochzeit Menükarte – Silberne Hochzeit', formatKey: 'menu-dl', width: 99, height: 210,
  description: 'Menükarte zur Silbernen Hochzeit im Format DIN lang: silberne 25 in einem Band, „Festtafel“ in Antiqua und die Gänge linksbündig in großer, gut lesbarer Schrift. Gerichte einfach überschreiben.',
  tags: [...ST, 'Menükarte', 'Menü', 'Speisekarte', 'DIN lang', 'Gänge'],
  pages: [page(SV.bg, [
    rect('Band', 0, 0, 99, 40, SV.band, { locked: true }),
    ctext('Zahl', 30, 4, 40, 32, '25', SP({ s: 56, c: SV.ink, lh: 1, min: 28 })),
    dk('Ringe', 'deko-motive-trauringe-silber', 60, 8, 30),
    ctext('Titel', 49.5, 46, 76, 12, 'Festtafel', SP({ s: 24, i: true, min: 12 })),
    ...MENU.flatMap(([course, dish], i) => {
      const y = 64 + i * 27;
      return [
        ltext('Gang ' + (i + 1), 12, y, 76, 6, course.toUpperCase(), SC({ s: 8.5, min: 7 })),
        ltext('Gericht ' + (i + 1), 12, y + 6.5, 80, 18, dish, SB({ s: 12, wrap: true, v: 'top', lh: 1.25, min: 8 })),
      ];
    }),
  ], 'Menükarte')],
});

const silDanke = make('danke', SV, {
  slug: 'hochzeit-danksagung-silberne-hochzeit', name: 'Hochzeit Danksagung – Silberne Hochzeit',
  description: 'Danksagungskarte zur Silbernen Hochzeit als Postkarte A6 quer: vorne die silberne 25 neben dem Lorbeerkranz und „Herzlichen Dank“, hinten ein persönlicher Gruß in großer Schrift. Kühl, klar und gut lesbar.',
  tags: [...ST, 'Danksagung', 'Danke', 'Dankeskarte', 'Postkarte'],
  formatKey: 'postcard-a6-landscape', width: 148, height: 105,
  pages: [
    page(SV.bg, [
      dk('Kranz', 'deko-motive-lorbeerkranz-silber', 66, 8, 78),
      ctext('Zahl', 105, 32, 44, 30, '25', SP({ s: 66, c: SV.silver, lh: 1, min: 34 })),
      ltext('Danke', 12, 26, 66, 36, 'Herzlichen\nDank', SP({ s: 26, i: true, lh: 1.15, wrap: true, v: 'top', min: 14 })),
      line('Strich', 12, 66, 36, 66, SV.silver, 0.5, { locked: true }),
      ltext('Namen', 12, 70, 60, 8, 'Anna & Jonas', SB({ s: 13, w: 700, min: 8 })),
      ltext('Datum', 12, 80, 60, 6, C.dateNum, SC({ s: 8, min: 7 })),
    ], 'Vorderseite'),
    page(SV.soft, [
      rect('Band', 0, 0, 148, 8, SV.band, { locked: true }),
      ctext('Titel', 74, 18, 110, 12, 'Liebe Familie, liebe Freunde,', SP({ s: 18, i: true, min: 10 })),
      ctext('Text', 74, 34, 112, 38, '25 Jahre sind wir ein Paar, und mit euch haben wir diesen Tag gefeiert. Danke für eure Wünsche, eure Geschenke und die schönen Stunden.', SB({ s: 12.5, wrap: true, v: 'top', lh: 1.5, a: 'center', min: 8 })),
      ctext('Gruß', 74, 80, 100, 9, 'Eure Anna & Jonas', SP({ s: 17, i: true, c: SV.silver, min: 9 })),
    ], 'Rückseite'),
  ],
});

// ====================================================================================================================== Eheversprechen erneuern
const V2 = { variant: 'Eheversprechen', bg: '#fbf3ee', ink: '#4a3a3a', rose: '#b97a7a', sage: '#6f8f75', soft: '#f3e4de', script: 'Great Vibes', serif: 'Cormorant Garamond', body: 'Lora' };
const VS = (o) => Object.assign({ f: V2.script, c: V2.rose }, o);
const VC = (o) => Object.assign({ f: V2.serif, c: V2.sage, w: 700, ls: 0.25 }, o);
const VB = (o) => Object.assign({ f: V2.body, c: V2.ink, w: 400 }, o);
const VT = [...TAGS, 'Eheversprechen', 'Vows', 'Ehegelübde erneuern', 'Segnung', 'Olivenzweig', 'Hochzeitstag feiern'];

const vowEinl = make('flach', V2, {
  slug: 'hochzeit-einladung-flach-eheversprechen', name: 'Hochzeit Einladung – Eheversprechen erneuern', formatKey: 'a5-portrait', width: 148, height: 210,
  description: 'Einladung zur Erneuerung des Eheversprechens als flache Karte A5 hoch: Olivenzweig und goldene Herzen, „Wir sagen noch einmal Ja“ in Schreibschrift, Eckdaten in großer, gut lesbarer Schrift auf zartem Rosé. Warm und ruhig.',
  tags: [...VT, 'Einladung', 'Einladungskarte', 'A5', 'Herzen'],
  pages: [page(V2.bg, [
    dk('Olivenzweig', 'deko-blumen-olivenzweig-salbei', 24, 12, 100),
    ctext('Titel', 74, 56, 126, 36, 'Wir sagen noch\neinmal Ja', VS({ s: 40, lh: 1.15, wrap: true, v: 'top', min: 22 })),
    ctext('Untertitel', 74, 96, 124, 7, 'WIR ERNEUERN UNSER EHEVERSPRECHEN', VC({ s: 9.5, min: 7 })),
    ctext('Namen', 74, 107, 120, 14, 'Anna & Jonas', VS({ s: 32, c: V2.ink, min: 16 })),
    dk('Herzen', 'deko-herzen-doppelt-gold', 62, 124, 24),
    ctext('Text', 74, 150, 112, 10, 'Feiert mit uns 30 Jahre Ehe.', VB({ s: 14, i: true, min: 9 })),
    ctext('Datum', 74, 162, 120, 8, 'Samstag, 12. Juni 2027, 14:00 Uhr', VB({ s: 14, w: 700, min: 9 })),
    ctext('Ort', 74, 172, 120, 14, C.place + '\nBirkenallee 4, 12345 Musterstadt', VB({ s: 13, wrap: true, v: 'top', lh: 1.35, a: 'center', min: 8 })),
    ctext('Antwort', 74, 192, 120, 7, 'Wir bitten um Antwort bis zum 1. Mai 2027.', VB({ s: 11, i: true, c: V2.sage, min: 8 })),
  ], 'Einladung')],
});

const vowTisch = make('tisch', V2, Object.assign({}, TISCH_META, {
  slug: 'hochzeit-tischkarte-eheversprechen', name: 'Hochzeit Tischkarte – Eheversprechen erneuern',
  description: 'Tischkarte zur Erneuerung des Eheversprechens als Zeltkarte (gefaltet 90 × 50 mm): Olivenzweig, der Name des Gastes in großer Antiqua, die Tischnummer in Kapitälchen. Innen zwei goldene Herzen. Für Serien mit Gästelisten.',
  tags: [...VT, 'Tischkarte', 'Platzkarte', 'Namenskarte', 'Zeltkarte', 'Gäste', 'Serie'],
  pages: tent(y => [
    dk('Zweig', 'deko-blumen-olivenzweig-salbei', 25, y + 6, 40),
    ctext('Name', 45, y + 20, 74, 12, '{{Name}}', { f: V2.serif, w: 600, c: V2.ink, s: 20, min: 9 }),
    ctext('Tisch', 45, y + 35, 60, 6, 'TISCH {{Tisch}}', VC({ s: 8.5, min: 7 })),
  ], [
    dk('Herzen', 'deko-herzen-doppelt-gold', 33, 56, 24),
    ctext('Namen', 45, 78, 76, 11, 'Anna & Jonas', VS({ s: 24, min: 12 })),
    ctext('Datum', 45, 90, 70, 5, C.dateNum, VC({ s: 7.5, min: 7 })),
  ], V2.bg, V2.soft),
}));

const vowMenue = make('menue', V2, {
  slug: 'hochzeit-menuekarte-eheversprechen', name: 'Hochzeit Menükarte – Eheversprechen erneuern', formatKey: 'menu-dl', width: 99, height: 210,
  description: 'Menükarte zur Erneuerung des Eheversprechens im Format DIN lang: Olivenzweig, „Zum Fest“ in Schreibschrift und die Gänge in großer, gut lesbarer Schrift mit goldenen Herzen am Fuß. Gerichte einfach überschreiben.',
  tags: [...VT, 'Menükarte', 'Menü', 'Speisekarte', 'DIN lang', 'Gänge'],
  pages: [page(V2.bg, [
    dk('Olivenzweig', 'deko-blumen-olivenzweig-salbei', 14, 8, 71),
    ctext('Titel', 49.5, 40, 76, 16, 'Zum Fest', VS({ s: 32, min: 16 })),
    ...MENU.flatMap(([course, dish], i) => {
      const y = 62 + i * 24.5;
      return [
        ctext('Gang ' + (i + 1), 49.5, y, 76, 6, course.toUpperCase(), VC({ s: 8.5, min: 7 })),
        ctext('Gericht ' + (i + 1), 49.5, y + 6, 80, 17, dish, VB({ s: 11.5, wrap: true, v: 'top', lh: 1.25, a: 'center', min: 8 })),
      ];
    }),
    dk('Herzen', 'deko-herzen-doppelt-gold', 40, 190, 19),
  ], 'Menükarte')],
});

const vowDanke = make('danke', V2, {
  slug: 'hochzeit-danksagung-eheversprechen', name: 'Hochzeit Danksagung – Eheversprechen erneuern',
  description: 'Danksagungskarte zur Erneuerung des Eheversprechens als Postkarte A6 quer: vorne „Danke“ in Schreibschrift mit Olivenzweig und goldenen Herzen, hinten ein persönlicher Gruß in großer Schrift. Zart und gut lesbar.',
  tags: [...VT, 'Danksagung', 'Danke', 'Dankeskarte', 'Postkarte'],
  formatKey: 'postcard-a6-landscape', width: 148, height: 105,
  pages: [
    page(V2.soft, [
      dk('Olivenzweig', 'deko-blumen-olivenzweig-salbei', 29, 4, 90),
      ctext('Danke', 74, 42, 110, 28, 'Danke', VS({ s: 58, min: 30 })),
      dk('Herzen', 'deko-herzen-doppelt-gold', 63, 71, 22),
      ctext('Namen', 74, 92, 100, 8, 'Anna & Jonas', VB({ s: 14, w: 700, min: 9 })),
    ], 'Vorderseite'),
    page(V2.bg, [
      ctext('Titel', 74, 14, 110, 14, 'Liebe Familie, liebe Freunde,', VS({ s: 24, min: 12 })),
      ctext('Text', 74, 32, 112, 40, 'es war schön, mit euch unser Eheversprechen zu erneuern. Danke für eure Anwesenheit, eure Wünsche und die vielen herzlichen Momente.', VB({ s: 12.5, wrap: true, v: 'top', lh: 1.5, a: 'center', min: 8 })),
      ctext('Gruß', 74, 80, 100, 10, 'Eure Anna & Jonas', VS({ s: 22, min: 11 })),
    ], 'Rückseite'),
  ],
});

module.exports = {
  gold: { einl: goldEinl, tisch: goldTisch, menue: goldMenue, danke: goldDanke },
  silver: { einl: silEinl, tisch: silTisch, menue: silMenue, danke: silDanke },
  vow: { einl: vowEinl, tisch: vowTisch, menue: vowMenue, danke: vowDanke },
};
