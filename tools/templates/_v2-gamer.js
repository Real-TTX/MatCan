/* Style line "Gamer / Nerd": night-blue screen, pixel hearts and coins, controller, "Player 1 + Player 2". No brands, no characters. */
'use strict';
const V = require('./_v2-lib');
const { text, rect, ellipse, line, page, ctext, ltext, dk, make, C, tent, TISCH_META, MENU, dekoIn } = V;

const S = { variant: 'Gamer', bg: '#16143a', bg2: '#201c52', white: '#f4f1ff', yellow: '#ffd23f', pink: '#ff5d8f', cyan: '#3ad4c0', grey: '#9a96c8', disp: 'Righteous', mono: 'IBM Plex Mono' };
const TAGS = ['Hochzeit', 'Gamer', 'Nerd', 'Zocker', 'Pixel', 'Retro', '8-Bit', 'Controller', 'Player 1', 'Brautpaar'];
const DISP = (o) => Object.assign({ f: S.disp, c: S.white, lh: 1 }, o);
const MONO = (o) => Object.assign({ f: S.mono, c: S.white, w: 700 }, o);

const std = make('std', S, {
  slug: 'save-the-date-gamer', name: 'Save the Date – Gamer',
  description: 'Quadratische Save-the-Date-Karte (100 mm) im Retro-Spielstil: Nachtblau mit „Player 1“ und „Player 2“, Pixelherzen als Lebensleiste, „Press Start“ und das Datum als Level-Up. Die Rückseite meldet die neue Mission. Ohne Marken und Spielfiguren.',
  tags: [...TAGS, 'Save the Date', 'Termin', 'quadratisch', 'Level Up'],
  formatKey: 'square-100', width: 100, height: 100,
  pages: [
    page(S.bg, [
      ltext('Player 1', 8, 8, 40, 5, 'PLAYER 1', MONO({ s: 7.5, c: S.pink, min: 7 })),
      text('Player 2', 52, 8, 40, 5, 'PLAYER 2', MONO({ s: 7.5, c: S.cyan, a: 'right', min: 7 })),
      ctext('Name 1', 50, 18, 84, 17, 'ANNA', DISP({ s: 40, c: S.pink, min: 22 })),
      ctext('Plus', 50, 36, 20, 9, '+', MONO({ s: 22, c: S.yellow, min: 12 })),
      ctext('Name 2', 50, 44, 84, 17, 'JONAS', DISP({ s: 40, c: S.cyan, min: 22 })),
      ctext('Level', 50, 66, 90, 7, 'LEVEL UP: 12.06.2027', MONO({ s: 11, c: S.yellow, min: 8 })),
      ctext('Start', 50, 75, 80, 6, 'PRESS START', MONO({ s: 8, w: 400, c: S.grey, ls: 0.3, min: 7 })),
      dk('Leben', 'deko-motive-pixelherzen-leiste', 28, 86, 44),
    ], 'Vorderseite'),
    page(S.bg2, [
      ctext('Titel', 50, 12, 84, 8, 'NEUE MISSION', MONO({ s: 10, c: S.yellow, ls: 0.2, min: 7 })),
      ctext('Titel 2', 50, 22, 88, 26, 'WIR\nHEIRATEN!', DISP({ s: 30, lh: 1.05, wrap: true, v: 'top', min: 18 })),
      ctext('Text', 50, 54, 76, 24, 'Speichert den Spielstand: Am Samstag steigt das größte Event des Jahres. Die Einladung folgt in Kürze.', MONO({ s: 8, w: 400, wrap: true, v: 'top', lh: 1.5, c: S.white, min: 7, a: 'center' })),
      dk('Münze', 'deko-motive-pixelmuenze', 14, 80, 12),
      dk('Stern', 'deko-motive-pixelstern', 74, 80, 12),
      ctext('Ort', 50, 84, 40, 6, 'GUT BIRKENHOF', MONO({ s: 7, w: 400, c: S.cyan, ls: 0.2, min: 7 })),
    ], 'Rückseite'),
  ],
});

const einl = make('flach', S, {
  slug: 'hochzeit-einladung-flach-gamer', name: 'Hochzeit Einladung – Gamer', formatKey: 'a5-portrait', width: 148, height: 210,
  description: 'Flache Einladungskarte A5 hoch im Retro-Spielstil: Pixelrahmen, Controller, „Player 1 + Player 2“ und die Eckdaten als Quest-Liste. Dazu Lebensleiste aus Pixelherzen. Für Zocker, Nerds und alle, die gern spielen. Ohne Marken und Spielfiguren.',
  tags: [...TAGS, 'Einladung', 'Einladungskarte', 'A5', 'Quest', 'Pixelrahmen'],
  pages: [page(S.bg, [
    dekoIn('Pixelrahmen', 'deko-motive-pixelrahmen-hoch-bunt', 4, 4, 140, 202, { locked: true }),
    dk('Controller', 'deko-motive-controller-weiss', 44, 20, 60),
    ctext('Kopf', 74, 64, 100, 6, 'EINLADUNG ZUM MULTIPLAYER', MONO({ s: 8, w: 400, c: S.grey, ls: 0.25, min: 7 })),
    ctext('Name 1', 74, 71, 110, 20, 'ANNA', DISP({ s: 50, c: S.pink, min: 24 })),
    ctext('Plus', 74, 91, 20, 8, '+', MONO({ s: 20, c: S.yellow, min: 12 })),
    ctext('Name 2', 74, 99, 110, 20, 'JONAS', DISP({ s: 50, c: S.cyan, min: 24 })),
    ctext('Quest', 74, 126, 100, 7, 'QUEST: HOCHZEIT', MONO({ s: 12, c: S.yellow, ls: 0.1, min: 8 })),
    ltext('Zeilen', 18, 137, 118, 40, '> WANN: Sa, 12.06.2027, 14:00 Uhr\n> WO: Gut Birkenhof, Musterstadt\n> LOOT: Torte, Musik und gute Laune\n> DRESSCODE: Casual Hero', MONO({ s: 10.5, w: 400, wrap: true, v: 'top', lh: 1.7, min: 7 })),
    ctext('Antwort', 74, 175, 100, 6, 'RSVP BIS 01.05.2027', MONO({ s: 10, c: S.pink, ls: 0.15, min: 7 })),
    dk('Leben', 'deko-motive-pixelherzen-leiste', 52, 183, 44),
  ], 'Einladung')],
});

const tisch = make('tisch', S, Object.assign({}, TISCH_META, {
  slug: 'hochzeit-tischkarte-gamer', name: 'Hochzeit Tischkarte – Gamer',
  description: 'Tischkarte als Zeltkarte (gefaltet 90 × 50 mm) im Retro-Spielstil: „Player“ mit dem Namen des Gastes in Righteous, darunter der Spawn-Punkt (Tisch). Innen Pixelmünze und Pixelstern. Für Serien mit Gästelisten.',
  tags: [...TAGS, 'Tischkarte', 'Platzkarte', 'Namenskarte', 'Zeltkarte', 'Gäste', 'Serie'],
  pages: tent(y => [
    rect('Balken', 0, y, 90, 6, S.pink, { locked: true }),
    ctext('Player', 45, y + 9, 60, 5, 'PLAYER', MONO({ s: 7, c: S.yellow, ls: 0.3, min: 7 })),
    ctext('Name', 45, y + 15, 76, 14, '{{Name}}', DISP({ s: 21, c: S.white, min: 8 })),
    ctext('Tisch', 45, y + 33, 76, 6, 'SPAWN: TISCH {{Tisch}}', MONO({ s: 8.5, c: S.cyan, ls: 0.1, min: 7 })),
    dk('Leben', 'deko-motive-pixelherzen-leiste', 30, y + 41, 30),
  ], [
    dk('Münze', 'deko-motive-pixelmuenze', 21, 60, 14),
    dk('Stern', 'deko-motive-pixelstern', 55, 60, 14),
    ctext('Namen', 45, 80, 76, 7, 'ANNA + JONAS', DISP({ s: 14, min: 8 })),
    ctext('Datum', 45, 89, 70, 5, 'GAME ON · ' + C.dateNum, MONO({ s: 7, w: 400, c: S.grey, ls: 0.1, min: 7 })),
  ], S.bg2),
}));

const menue = make('menue', S, {
  slug: 'hochzeit-menuekarte-gamer', name: 'Hochzeit Menükarte – Gamer', formatKey: 'menu-dl', width: 99, height: 210,
  description: 'Menükarte DIN lang im Retro-Spielstil: jeder Gang ist ein Level mit gelber Nummer, oben die Lebensleiste aus Pixelherzen, unten Münze und Stern. Gerichte einfach überschreiben. Ohne Marken und Spielfiguren.',
  tags: [...TAGS, 'Menükarte', 'Menü', 'Speisekarte', 'DIN lang', 'Level', 'Inventar'],
  pages: [page(S.bg, [
    dk('Leben', 'deko-motive-pixelherzen-leiste', 25, 9, 50),
    ctext('Titel', 49.5, 22, 80, 12, 'LEVEL-MENÜ', DISP({ s: 24, c: S.yellow, min: 14 })),
    ctext('Untertitel', 49.5, 35, 80, 5, 'ANNA + JONAS · 12.06.2027', MONO({ s: 7, w: 400, c: S.grey, ls: 0.15, min: 7 })),
    ...MENU.flatMap(([course, dish], i) => {
      const y = 48 + i * 27;
      return [
        ltext('Level ' + (i + 1), 10, y, 79, 6, 'LEVEL ' + (i + 1) + ' · ' + course.toUpperCase(), MONO({ s: 10, c: i % 2 ? S.cyan : S.pink, min: 7 })),
        ltext('Gericht ' + (i + 1), 10, y + 7, 80, 15, dish, MONO({ s: 10, w: 400, wrap: true, v: 'top', lh: 1.35, min: 7 })),
      ];
    }),
    dk('Münze', 'deko-motive-pixelmuenze', 28, 190, 12),
    dk('Stern', 'deko-motive-pixelstern', 59, 190, 12),
  ], 'Menükarte')],
});

const danke = make('danke', S, {
  slug: 'hochzeit-danksagung-gamer', name: 'Hochzeit Danksagung – Gamer',
  description: 'Danksagungskarte als Postkarte A6 quer im Retro-Spielstil: Pixelrahmen, „Game completed“ mit Pixelstern, hinten „Thanks for playing“ mit Lebensleiste und Platz für einen persönlichen Gruß. Ohne Marken und Spielfiguren.',
  tags: [...TAGS, 'Danksagung', 'Danke', 'Dankeskarte', 'Postkarte', 'Game Over'],
  formatKey: 'postcard-a6-landscape', width: 148, height: 105,
  pages: [
    page(S.bg, [
      dekoIn('Pixelrahmen', 'deko-motive-pixelrahmen-quer-bunt', 3, 3, 142, 99, { locked: true }),
      dk('Stern', 'deko-motive-pixelstern', 64, 14, 20),
      ctext('Game', 74, 38, 110, 18, 'GAME COMPLETED', DISP({ s: 28, c: S.yellow, min: 14 })),
      ctext('Danke', 74, 58, 110, 9, 'DANKE FÜRS MITSPIELEN!', MONO({ s: 11, c: S.white, min: 8 })),
      ctext('Namen', 74, 72, 100, 7, 'ANNA + JONAS', MONO({ s: 9, c: S.pink, ls: 0.2, min: 7 })),
      dk('Leben', 'deko-motive-pixelherzen-leiste', 52, 82, 44),
    ], 'Vorderseite'),
    page(S.bg2, [
      ctext('Titel', 74, 14, 110, 12, 'THANKS FOR PLAYING', DISP({ s: 22, c: S.cyan, min: 12 })),
      ctext('Text', 74, 32, 112, 36, 'Ihr habt mit uns den Hochzeits-Level gemeistert: gefeiert, getanzt und jeden Bonus eingesammelt. Danke für eure Geschenke und diesen unvergesslichen Tag.', MONO({ s: 10, w: 400, wrap: true, v: 'top', lh: 1.6, min: 7, a: 'center' })),
      ctext('Gruß', 74, 76, 100, 8, 'Player 1 + Player 2', MONO({ s: 11, c: S.pink, min: 8 })),
      dk('Münze', 'deko-motive-pixelmuenze', 14, 82, 12),
      dk('Münze 2', 'deko-motive-pixelmuenze', 122, 82, 12),
    ], 'Rückseite'),
  ],
});

module.exports = { std, einl, tisch, menue, danke };
