/* Families of batch V4, part B: 80er-Party, 90er-Party, Casino-Abend, Krimidinner. */
'use strict';
const { D, when, uhr, decor, T, P, info, infoRows, sprinkle, tags } = require('./_v4-lib');
const { text, rect, ellipse, line, icon, shape, deko, dekoIn, dekoWindow, page, gradient, shadow, field, foldCard, panels, formLine } = D;

const base = (family, familyName, extra = {}) => Object.assign({ category: 'Einladungen', family, familyName, occasion: 'Feste & Events', unit: 'mm' }, extra);

// ================================================================================================================== 80er
const NEON = '#ff4fd8', CY = '#2ff3ff', Y = '#ffd23f';
const b80 = base('party-80er', '80er-Party');
const t80 = (...m) => tags('80er', 'Party', 'Einladung', 'Achtziger', 'Retro', 'Neon', 'Motto', 'Mottoparty', 'Feier', 'Disco', m);
const d80 = when(10, 7);

const p80Neon = Object.assign({}, b80, {
  slug: 'party-80er-neon', name: '80er-Party – Neon', variant: 'Neon',
  description: 'Einladung zur 80er-Party (A6 hoch): Neon-Sonne mit Streifen, Gitterboden und Neonpalme auf Nachtviolett.',
  tags: t80('Sonnenuntergang', 'Synthwave', 'Palme', 'Gitter'),
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [page(gradient(180, '#1a0a4a', '#5a1a8a'), [
    decor([
      ellipse('Sonne', 28.5, 70, 48, 48, gradient(180, Y, NEON)),
      rect('Streifen 1', 28, 94, 49, 1.2, '#43157a'), rect('Streifen 2', 28, 99, 49, 1.8, '#43157a'), rect('Streifen 3', 28, 104, 49, 2.4, '#43157a'),
      rect('Boden', 0, 112, 105, 36, gradient(180, '#3a0a6a', '#10062a')),
      ...[114, 118, 124, 132, 142].map((y, i) => rect('Gitter ' + (i + 1), 0, y, 105, 0.5 + i * 0.12, NEON, { opacity: 0.85 })),
      deko('Neonpalme', 'deko-motive-neonpalme', 50, 82, undefined, 50),
    ]),
    T('Titel', 8, 6, 89, 28, '80er', 'Righteous', 56, NEON, { shadow: shadow(NEON, 0.9, 12, 0, 0), min: 30, lh: 1.1 }),
    T('Party', 8, 33, 89, 10, 'PARTY', 'Righteous', 20, CY, { ls: 0.4, shadow: shadow(CY, 0.9, 8, 0, 0), min: 12 }),
    T('Datum', 8, 46, 89, 6, d80 + ' · ' + uhr('20'), 'Poppins', 9, '#ffffff', { w: 600, min: 7 }),
    T('Ort', 8, 53, 89, 6, 'Musterweg 5 · 12345 Musterstadt', 'Poppins', 9, '#ffffff', { w: 500, min: 7 }),
    T('Code', 8, 60, 89, 6, 'Dresscode: Neon & Schulterpolster', 'Poppins', 8.5, Y, { w: 600, min: 7 }),
  ])],
});

const SIDE = '#16162b';
const p80Mix = Object.assign({}, b80, {
  slug: 'party-80er-mixtape', name: '80er-Party – Mixtape', variant: 'Mixtape',
  description: 'Hohe Einladung (DIN lang) mit einer Kassette als Titelbild: „Side A“ und „Side B“ erzählen, was gespielt und gefeiert wird.',
  tags: t80('Kassette', 'Mixtape', 'Tape', 'DIN lang', 'Streifen'),
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  pages: [page(SIDE, [
    decor([
      dekoIn('Kassette', 'deko-motive-kassette', 8, 10, 83, 58),
      rect('Streifen rosa', 0, 126, 99, 4, '#ff4fa3'), rect('Streifen gelb', 0, 131, 99, 4, '#ffc93c'), rect('Streifen cyan', 0, 136, 99, 4, '#2fd0e6'),
    ]),
    T('Titel', 6, 74, 87, 24, 'MIXTAPE', 'Righteous', 44, '#ffffff', { min: 22, lh: 1.1 }),
    T('Sub', 8, 99, 83, 9, 'Die 80er-Party', 'Righteous', 17, NEON, { min: 10, ls: 0.1 }),
    T('Seite A', 10, 111, 79, 11, 'SIDE A: Synthesizer, Dauerwelle & große Hits', 'Poppins', 8.5, CY, { w: 600, wrap: true, v: 'middle', min: 7, lh: 1.2 }),
    T('Datum', 8, 148, 83, 8, d80, 'Poppins', 11, '#ffffff', { w: 700, min: 8 }),
    T('Zeit', 8, 157, 83, 7, 'ab ' + uhr('20') + ' · Einlass 19:30 Uhr', 'Poppins', 9.5, '#ffffff', { w: 500, min: 7 }),
    T('Ort', 8, 165, 83, 7, 'Musterweg 5 · 12345 Musterstadt', 'Poppins', 9.5, '#ffffff', { w: 500, min: 7 }),
    T('Seite B', 10, 176, 79, 11, 'SIDE B: Cocktails, Neon & Moonwalk', 'Poppins', 8.5, Y, { w: 600, wrap: true, v: 'middle', min: 7, lh: 1.2 }),
    T('Zusage', 8, 190, 83, 7, 'Zusage bis 26. Juni: 0170 1234567', 'Poppins', 9, NEON, { w: 600, min: 7 }),
  ])],
});

const p80Sunset = Object.assign({}, b80, {
  slug: 'party-80er-sunset', name: '80er-Party – Sunset', variant: 'Sunset', unit: 'px',
  description: 'Instagram-Post zur 80er-Party: Verlauf von Rosa zu Orange, riesige „80er“, Kassette und Sonnenbrille.',
  tags: t80('Instagram', 'Post', 'Social Media', 'Sonnenbrille', 'Kassette', 'Sunset'),
  formatKey: 'instagram-post', width: 1080, height: 1080,
  pages: [page(gradient(180, '#ff4fa3', '#ffb347'), [
    decor([
      ellipse('Sonne', 340, 560, 400, 400, gradient(180, '#fff3b0', '#ff6a3d'), { opacity: 0.9 }),
      rect('Meer', 0, 800, 1080, 280, gradient(180, '#6a1a8a', '#1a0a4a')),
      ...[820, 850, 890, 940, 1000].map((y, i) => rect('Welle ' + (i + 1), 0, y, 1080, 4 + i * 2, '#ff4fd8', { opacity: 0.7 })),
      deko('Kassette', 'deko-motive-kassette', 90, 790, 300, undefined, { rotation: -8 }),
      deko('Sonnenbrille', 'deko-motive-sonne-brille-bunt', 790, 36, 220, undefined, { rotation: 6 }),
    ]),
    T('Kopf', 60, 52, 600, 52, 'BACK TO THE', 'Righteous', 28, '#2a0a5a', { ls: 0.3, a: 'left', min: 16 }),
    T('Titel', 60, 130, 960, 340, '80er', 'Righteous', 200, '#ffffff', { shadow: shadow('#2a0a5a', 0.9, 0, 10, 10), min: 80, lh: 1.05 }),
    T('Datum', 60, 470, 960, 70, d80, 'Poppins', 34, '#2a0a5a', { w: 700, min: 18 }),
    T('Zeit', 60, 540, 960, 56, uhr('20') + ' · Musterweg 5 · 12345 Musterstadt', 'Poppins', 24, '#2a0a5a', { w: 600, min: 15 }),
    T('Zusage', 420, 870, 600, 60, 'Dresscode: Neon & Schulterpolster', 'Poppins', 22, '#ffffff', { w: 600, a: 'right', min: 15 }),
    T('Zusage 2', 420, 940, 600, 60, 'Zusage bis 26. Juni: 0170 1234567', 'Poppins', 22, '#ffd23f', { w: 600, a: 'right', min: 15 }),
  ])],
});

// ================================================================================================================== 90er
const b90 = base('party-90er', '90er-Party');
const t90 = (...m) => tags('90er', 'Party', 'Einladung', 'Neunziger', 'Retro', 'Motto', 'Mottoparty', 'Feier', 'Boombox', 'Back to the 90s', m);
const d90 = when(17, 7);
const TEAL = '#12d3c0', MAG = '#ff3d8b', Y9 = '#ffe14d', IND = '#1d1a3a';

const p90Memphis = Object.assign({}, b90, {
  slug: 'party-90er-memphis', name: '90er-Party – Memphis', variant: 'Memphis',
  description: 'Querformatige Einladung (A6 quer) im Memphis-Stil der 90er: bunte Formen, Boombox und große Schrift auf Indigo.',
  tags: t90('Memphis', 'Querformat', 'Bunt', 'Funkeln'),
  formatKey: 'a6-landscape', width: 148, height: 105,
  pages: [page(IND, [
    decor([
      shape('triangle', 'Dreieck', 100, 62, 20, 20, TEAL, { rotation: 15 }),
      ellipse('Kreis', 112, 40, 12, 12, null, { stroke: MAG, sw: 3 }),
      rect('Balken', 136, 12, 8, 30, Y9, { rotation: 30, radius: 1 }),
      dekoIn('Boombox', 'deko-motive-boombox', 80, 14, 54, 38),
      deko('Funkeln', 'deko-motive-pop-funkeln', 126, 56, 14),
      deko('Schnörkel', 'deko-motive-pop-schnoerkel-bunt', 8, 36, 60),
    ]),
    T('Titel', 8, 8, 70, 26, 'DIE 90ER', 'Anton', 42, Y9, { a: 'left', min: 20, lh: 1.1 }),
    ...info('Datum', 8, 48, 66, 'calendar-days', d90, { chip: MAG, ic: '#ffffff', c: '#ffffff', f: 'Poppins', s: 8.5, w: 600, d: 8 }),
    ...info('Zeit', 8, 59, 66, 'clock', 'ab ' + uhr('20') + ' · Boombox läuft', { chip: TEAL, ic: IND, c: '#ffffff', f: 'Poppins', s: 8.5, w: 600, d: 8 }),
    ...info('Ort', 8, 70, 66, 'map-pin', 'Musterweg 5, 12345 Musterstadt', { chip: Y9, ic: IND, c: '#ffffff', f: 'Poppins', s: 8.5, w: 600, d: 8 }),
    ...info('Zusage', 8, 81, 66, 'phone', 'Zusage bis 3. Juli: 0170 1234567', { chip: MAG, ic: '#ffffff', c: '#ffffff', f: 'Poppins', s: 8.5, w: 600, d: 8 }),
    T('Code', 76, 92, 66, 7, 'Dresscode: Schlaghose & Bauchtasche', 'Poppins', 7, TEAL, { w: 600, min: 7 }),
  ])],
});

const GR = '#c0c0c0';
const p90Window = Object.assign({}, b90, {
  slug: 'party-90er-fenster', name: '90er-Party – Fenster', variant: 'Fenster', unit: 'px',
  description: 'Story-Einladung als altes Computerfenster auf Türkis: Titelleiste, Schaltflächen und eine Zusage-Taste wie in den 90ern.',
  tags: t90('Story', 'Instagram', 'Computer', 'Fenster', 'Social Media', 'Windows-Optik'),
  formatKey: 'instagram-story', width: 1080, height: 1920,
  pages: [page('#008080', [
    decor([
      rect('Schatten', 100, 360, 900, 1140, '#004a4a'),
      rect('Fenster', 80, 340, 900, 1140, GR, { stroke: '#000000', sw: 3 }),
      rect('Titelleiste', 92, 352, 876, 76, gradient(90, '#000080', '#1084d0')),
      rect('Knopf 1', 810, 362, 48, 48, GR, { stroke: '#000000', sw: 1.5 }), rect('Knopf 2', 868, 362, 48, 48, GR, { stroke: '#000000', sw: 1.5 }),
      icon('Schließen', 'x', 876, 368, 32, '#000000', 3),
      rect('Inhalt', 112, 460, 836, 700, '#ffffff', { stroke: '#000000', sw: 2 }),
      rect('Taste', 340, 1290, 400, 110, GR, { stroke: '#000000', sw: 4 }),
    ]),
    T('Titelzeile', 110, 358, 680, 64, 'Party90.exe', 'IBM Plex Mono', 28, '#ffffff', { a: 'left', w: 700, min: 15 }),
    T('Meldung', 140, 490, 780, 150, 'Du wurdest eingeladen zur großen 90er-Party!', 'IBM Plex Mono', 40, '#000000', { a: 'left', wrap: true, v: 'top', w: 700, min: 20, lh: 1.2 }),
    T('Datum', 140, 700, 780, 66, d90, 'IBM Plex Mono', 34, '#000080', { a: 'left', w: 700, min: 15 }),
    T('Zeit', 140, 775, 780, 62, 'Start: ' + uhr('20') + ' · Einlass 19:30 Uhr', 'IBM Plex Mono', 30, '#000000', { a: 'left', min: 15 }),
    T('Ort', 140, 850, 780, 62, 'Musterweg 5 · 12345 Musterstadt', 'IBM Plex Mono', 30, '#000000', { a: 'left', min: 15 }),
    T('Code', 140, 940, 780, 130, 'Dresscode: Schlaghose, Bauchtasche, Trainingsjacke', 'IBM Plex Mono', 28, '#000000', { a: 'left', wrap: true, v: 'top', min: 15 }),
    T('Taste', 340, 1290, 400, 110, '[ Zusagen ]', 'IBM Plex Mono', 30, '#000000', { w: 700, min: 18 }),
    T('Zusage', 80, 1510, 920, 60, 'Zusage bis 3. Juli: 0170 1234567', 'IBM Plex Mono', 28, '#ffffff', { w: 600, min: 15 }),
  ])],
});

const p90Post = Object.assign({}, b90, {
  slug: 'party-90er-postkarte', name: '90er-Party – Postkarte', variant: 'Postkarte', formatKey: 'postcard-a6-landscape', width: 148, height: 105,
  description: 'Postkarte (A6 quer, zwei Seiten): vorne das große „Back to the 90s“ in Neonfarben, hinten Datum, Ort und eine Briefmarke für den Gruß.',
  tags: t90('Postkarte', 'Zwei Seiten', 'Vorderseite', 'Rückseite', 'Neon'),
  pages: [
    page(gradient(135, MAG, '#6a2fd0'), [
      decor([
        shape('triangle', 'Dreieck', 6, 62, 30, 28, Y9, { rotation: -12 }),
        ellipse('Kreis', 120, 70, 24, 24, null, { stroke: TEAL, sw: 4 }),
        rect('Balken', 116, 8, 8, 34, TEAL, { rotation: 30, radius: 1 }),
        deko('Funkeln', 'deko-motive-pop-funkeln', 110, 40, 26), deko('Schnörkel', 'deko-motive-pop-schnoerkel-bunt', 40, 80, 70),
      ]),
      T('Kopf', 10, 10, 100, 10, 'BACK TO THE', 'Righteous', 18, '#ffffff', { a: 'left', ls: 0.2, min: 10 }),
      T('Titel', 10, 18, 110, 50, '90s', 'Anton', 100, Y9, { a: 'left', shadow: shadow('#1d1a3a', 1, 0, 1.2, 1.2), min: 40, lh: 1.05 }),
    ], 'Vorderseite'),
    page('#fffdf6', [
      decor([
        rect('Trenner', 73.5, 10, 0.4, 85, '#cfc6b3'),
        rect('Marke', 120, 8, 20, 24, null, { stroke: '#b9ae97', sw: 0.8, dash: [1.5, 1.5] }),
      ]),
      T('Kopf', 8, 8, 60, 10, 'Du bist eingeladen!', 'Caveat', 24, MAG, { a: 'left', w: 700, min: 14 }),
      T('Datum', 8, 22, 60, 7, d90, 'Poppins', 9.5, '#1d1a3a', { a: 'left', w: 700, min: 7 }),
      T('Zeit', 8, 30, 60, 7, 'ab ' + uhr('20') + ' · Einlass 19:30 Uhr', 'Poppins', 9, '#1d1a3a', { a: 'left', min: 7 }),
      T('Ort', 8, 38, 60, 7, 'Musterweg 5 · 12345 Musterstadt', 'Poppins', 9, '#1d1a3a', { a: 'left', min: 7 }),
      P('Text', 8, 50, 60, 22, 'Schlaghose raus, Bauchtasche um: Wir feiern die Neunziger mit Pizza, Eurodance und Wackelpudding.', 'Nunito', 9, '#333333', { a: 'left', min: 7 }),
      T('Zusage', 8, 84, 60, 7, 'Zusage bis 3. Juli: 0170 1234567', 'Poppins', 8.5, TEAL, { a: 'left', w: 700, min: 7 }),
      formLine('Anschrift', 82, 52, 58, '', { gap: 10, lines: 4, color: '#b9ae97' }),
    ], 'Rückseite'),
  ],
});

// ================================================================================================================== Casino
const bC = base('casino-abend', 'Casino-Abend');
const tC = (...m) => tags('Casino', 'Casinoabend', 'Poker', 'Roulette', 'Einladung', 'Mottoparty', 'Spielbank', 'Abendgarderobe', 'Feier', m);
const GOLD = '#d4af6a', CREAM = '#f3e8d0';
const dC = when(23, 10);

const casinoRoyal = Object.assign({}, bC, {
  slug: 'casino-abend-royal', name: 'Casino-Abend – Royal', variant: 'Royal',
  description: 'Schwarz-goldene Einladung (A6 hoch) zum Casino-Abend: Roulette-Kessel, Doppellinienrahmen und festliche Schrift.',
  tags: tC('Schwarz-Gold', 'Roulette-Kessel', 'Elegant', 'Gold'),
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [page('#0a0a0a', [
    decor([
      dekoIn('Rahmen', 'deko-rahmen-doppellinie-hoch-gold', 3, 3, 99, 142),
      dekoIn('Roulette', 'deko-motive-roulette', 28, 12, 49, 49),
      deko('Trenner', 'deko-trenner-deco-gold', 28, 106, 49),
    ]),
    T('Kopf', 12, 66, 81, 7, 'FAITES VOS JEUX', 'Cinzel', 9, GOLD, { ls: 0.25, min: 7 }),
    T('Titel', 10, 73, 85, 16, 'CASINO', 'Cinzel', 34, CREAM, { w: 600, ls: 0.1, min: 16 }),
    T('Sub', 10, 89, 85, 14, 'Royal Night', 'Great Vibes', 28, GOLD, { min: 14, lh: 1.3 }),
    T('Datum', 12, 108, 81, 7, dC, 'Cinzel', 9.5, CREAM, { w: 500, min: 7 }),
    T('Zeit', 12, 115, 81, 7, 'ab ' + uhr('19') + ' · Musterweg 5', 'Cormorant Garamond', 12, GOLD, { w: 600, min: 8 }),
    T('Code', 12, 122, 81, 7, 'Abendgarderobe erbeten', 'Cormorant Garamond', 11, CREAM, { i: true, w: 600, min: 8 }),
    T('Zusage', 12, 129, 81, 6, 'U. A. w. g. bis 9. Oktober', 'Cormorant Garamond', 10, GOLD, { i: true, w: 600, min: 8 }),
  ])],
});

const FELT = '#0d4a2e';
const casinoFilz = Object.assign({}, bC, {
  slug: 'casino-abend-spieltisch', name: 'Casino-Abend – Spieltisch', variant: 'Spieltisch',
  description: 'Hohe Einladung (DIN lang) auf grünem Spielfilz: Spielkarten, Chips, „All in“ und goldene Linien.',
  tags: tC('Spielfilz', 'Grün', 'Karten', 'Chips', 'DIN lang', 'All in'),
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  pages: [page(gradient(180, '#0f5a37', '#08301e'), [
    decor([
      dekoIn('Karten', 'deko-motive-spielkarten', 6, 10, 87, 60),
      rect('Linie oben', 10, 80, 79, 0.6, GOLD), rect('Linie unten', 10, 134, 79, 0.6, GOLD),
      dekoIn('Chips', 'deko-motive-pokerchips', 12, 154, 75, 44),
    ]),
    T('Titel', 6, 84, 87, 30, 'ALL IN', 'Anton', 60, '#ffffff', { min: 30, ls: 0.04, lh: 1.1 }),
    T('Sub', 8, 114, 83, 9, 'Casino-Abend für Mutige', 'Playfair Display', 13, GOLD, { i: true, min: 8 }),
    T('Datum', 8, 124, 83, 8, dC, 'Cinzel', 10, '#ffffff', { w: 500, min: 7 }),
    T('Zeit', 8, 134, 83, 7, 'ab ' + uhr('19') + ' · Musterweg 5', 'Cormorant Garamond', 12, CREAM, { w: 600, min: 8 }),
    T('Zusage', 8, 142, 83, 7, 'U. A. w. g. bis 9. Oktober', 'Cormorant Garamond', 11, GOLD, { i: true, w: 600, min: 8 }),
  ])],
});

const cp = panels(210, 148, 'vertical', 4);
const casinoKlapp = Object.assign({}, bC, {
  slug: 'casino-abend-klappkarte', name: 'Casino-Abend – Klappkarte', variant: 'Klappkarte', fold: 'vertical',
  description: 'Klappkarte (A6 hoch) im Kartenspiel-Look: außen Würfel und Titel, innen der Spielplan mit Roulette, Blackjack und Poker sowie alle Angaben.',
  tags: tC('Klappkarte', 'Würfel', 'Spielplan', 'Blackjack', 'Rot-Schwarz'),
  formatKey: 'card-a6-portrait', width: 210, height: 148,
  pages: foldCard('vertical', [
    decor([deko('Würfel', 'deko-motive-wuerfel', 125, 12, 64), rect('Linie', 118, 73, 78, 0.6, GOLD)]),
    T('Kopf', 112, 77, 90, 7, 'IHR EINSATZ, BITTE', 'Cinzel', 9, GOLD, { ls: 0.2, min: 7 }),
    T('Titel', 110, 85, 94, 16, 'CASINO-ABEND', 'Cinzel', 20, '#ffffff', { w: 600, min: 12 }),
    T('Datum', 112, 106, 90, 7, dC, 'Cormorant Garamond', 13, CREAM, { w: 600, min: 8 }),
    T('Zurück', 14, 62, 90, 14, 'Rien ne va plus!', 'Great Vibes', 26, GOLD, { min: 12 }),
  ], [
    T('Spielplan', cp[0].x, 12, cp[0].w, 10, 'DER SPIELPLAN', 'Cinzel', 15, GOLD, { ls: 0.15, min: 9 }),
    ...[['Roulette', 'Setzen Sie auf Rot, Schwarz oder die Glückszahl.'], ['Blackjack', 'Einundzwanzig schlägt alles – fast.'], ['Poker', 'Texas Hold’em am großen Tisch.']].flatMap(([h, t], i) => [
      T(h, cp[0].x, 30 + i * 30, cp[0].w, 8, h, 'Playfair Display', 13, CREAM, { w: 700, min: 9 }),
      P(h + ' Text', cp[0].x + 4, 39 + i * 30, cp[0].w - 8, 14, t, 'Cormorant Garamond', 11.5, GOLD, { w: 600, i: true, min: 8 }),
    ]),
    decor([rect('Mitte', 105, 12, 0.4, 124, GOLD, { opacity: 0.5 })]),
    T('Datum', 112, 22, 90, 9, dC, 'Cinzel', 12, '#ffffff', { w: 500, min: 8 }),
    T('Zeit', 112, 34, 90, 8, 'Einlass ' + uhr('19'), 'Cormorant Garamond', 14, GOLD, { w: 600, min: 9 }),
    T('Ort', 112, 46, 90, 8, 'Musterweg 5 · 12345 Musterstadt', 'Cormorant Garamond', 13, CREAM, { w: 600, min: 9 }),
    T('Code', 112, 62, 90, 8, 'Abendgarderobe erbeten', 'Cormorant Garamond', 13, CREAM, { i: true, w: 600, min: 9 }),
    T('Zusage', 112, 90, 90, 8, 'U. A. w. g. bis 9. Oktober', 'Cormorant Garamond', 13, GOLD, { i: true, w: 600, min: 9 }),
    T('Tel', 112, 100, 90, 8, '0170 1234567', 'Cormorant Garamond', 13, GOLD, { i: true, w: 600, min: 9 }),
  ], '#0a0a0a', '#0a0a0a'),
});

// ================================================================================================================== Krimidinner
const KF = [field('Titel', 'Titel des Falls', 'text', 'Mord im Herrenhaus')];
const KRows = [{ Titel: 'Mord im Herrenhaus' }, { Titel: 'Tod beim Dinner' }, { Titel: 'Die verschwundene Perlenkette' }];
const bK = base('krimidinner', 'Krimidinner', { fields: KF, sampleRows: KRows });
const tK = (...m) => tags('Krimidinner', 'Krimi', 'Mord', 'Detektiv', 'Dinner', 'Einladung', 'Mottoparty', 'Rätsel', 'Spiel', 'Verbrechen', m);
const dK = when(6, 11);
const YEL = '#ffd23f';

const krimiNoir = Object.assign({}, bK, {
  slug: 'krimidinner-noir', name: 'Krimidinner – Noir', variant: 'Noir',
  description: 'Einladung (A6 hoch) im Film-noir-Stil: Detektiv-Silhouette im Lichtkegel, gelber Titel und Angaben wie in einer Ermittlungsakte. Der Titel des Falls ist ein Feld.',
  tags: tK('Film noir', 'Silhouette', 'Schwarz-Gelb', 'Akte'),
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [page('#14141b', [
    decor([
      shape('triangle', 'Lichtkegel', 22, 8, 61, 78, '#ffffff', { opacity: 0.17 }),
      dekoIn('Detektiv', 'deko-motive-detektiv-silhouette', 30, 12, 45, 76),
      rect('Band', 0, 90, 105, 3, YEL),
    ]),
    T('Kopf', 8, 96, 89, 6, 'EINLADUNG ZUM KRIMIDINNER', 'IBM Plex Mono', 8, YEL, { w: 600, ls: 0.05, min: 7 }),
    T('Titel', 8, 102, 89, 20, '{{Titel}}', 'Playfair Display', 20, '#ffffff', { w: 800, wrap: true, lh: 1.15, min: 7 }),
    T('Datum', 8, 123, 89, 6, dK + ' · ' + uhr('19'), 'IBM Plex Mono', 8.5, '#ffffff', { w: 600, min: 7 }),
    T('Ort', 8, 130, 89, 6, 'Musterweg 5 · 12345 Musterstadt', 'IBM Plex Mono', 8.5, '#bdbdc4', { w: 500, min: 7 }),
    T('Zusage', 8, 137, 89, 6, 'Zusage bis 25. Oktober · Rolle folgt per Post', 'IBM Plex Mono', 7.5, YEL, { w: 500, min: 7 }),
  ])],
});

const krimiTatort = Object.assign({}, bK, {
  slug: 'krimidinner-tatort', name: 'Krimidinner – Tatort', variant: 'Tatort',
  description: 'Hohe Einladung (DIN lang) mit Absperrband in Gelb und Schwarz, Lupe und Fingerabdruck. Schreibmaschinenschrift wie in der Spurensicherung; der Titel des Falls ist ein Feld.',
  tags: tK('Tatort', 'Absperrband', 'Lupe', 'Fingerabdruck', 'DIN lang', 'Spurensicherung'),
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  pages: [page('#f4efe2', [
    decor([
      dekoWindow('Band oben', 'deko-muster-warnstreifen', 0, 8, 99, 11),
      dekoWindow('Band unten', 'deko-muster-warnstreifen', 0, 191, 99, 11),
      dekoIn('Lupe', 'deko-motive-lupe-fingerabdruck', 22, 30, 55, 56),
    ]),
    T('Kopf', 8, 90, 83, 7, 'ACHTUNG: TATORT', 'IBM Plex Mono', 10, '#b3202c', { w: 700, ls: 0.1, min: 7 }),
    T('Titel', 8, 98, 83, 38, '{{Titel}}', 'Abril Fatface', 24, '#14141b', { wrap: true, lh: 1.1, min: 12 }),
    rect('Linie', 14, 140, 71, 0.5, '#14141b'),
    T('Hinweis', 8, 144, 83, 7, 'Das Krimidinner mit Vier-Gänge-Menü', 'IBM Plex Mono', 8, '#14141b', { min: 7 }),
    T('Datum', 8, 153, 83, 7, dK, 'IBM Plex Mono', 9.5, '#14141b', { w: 700, min: 7 }),
    T('Zeit', 8, 161, 83, 7, 'Beginn ' + uhr('19'), 'IBM Plex Mono', 9, '#14141b', { min: 7 }),
    T('Ort', 8, 169, 83, 7, 'Musterweg 5 · 12345 Musterstadt', 'IBM Plex Mono', 9, '#14141b', { min: 7 }),
    T('Zusage', 8, 177, 83, 7, 'Zusage bis 25. Oktober', 'IBM Plex Mono', 9, '#b3202c', { w: 600, min: 7 }),
  ])],
});

const kp = panels(210, 148, 'vertical', 4);
const krimiAkte = Object.assign({}, bK, {
  slug: 'krimidinner-klappkarte', name: 'Krimidinner – Klappkarte', variant: 'Klappkarte', fold: 'vertical',
  description: 'Klappkarte (A6 hoch) mit Dolch und Fingerabdruck auf dem Titel; innen die Ermittlungsakte mit Ablauf und allen Angaben. Der Titel des Falls ist ein Feld.',
  tags: tK('Klappkarte', 'Dolch', 'Ermittlungsakte', 'Bordeaux', 'Ablauf'),
  formatKey: 'card-a6-portrait', width: 210, height: 148,
  pages: foldCard('vertical', [
    decor([deko('Dolch', 'deko-motive-dolch', 124, 14, undefined, 78, { rotation: 20 }), deko('Lupe', 'deko-motive-lupe-fingerabdruck', 36, 38, 34)]),
    T('Zurück', 14, 80, 90, 10, 'Wer war es wirklich?', 'Playfair Display', 12, '#e3c479', { i: true, min: 8 }),
    T('Kopf', 112, 96, 90, 6, 'EINLADUNG ZUM', 'IBM Plex Mono', 8, '#e3c479', { w: 600, ls: 0.2, min: 7 }),
    T('Titel', 110, 102, 94, 30, '{{Titel}}', 'Abril Fatface', 20, '#ffffff', { wrap: true, lh: 1.1, min: 10 }),
  ], [
    T('Akte', kp[0].x, 12, kp[0].w, 10, 'DIE ERMITTLUNG', 'Abril Fatface', 16, '#e3c479', { min: 10 }),
    ...[['19:00', 'Aperitif und Vorstellung der Verdächtigen'], ['20:00', 'Erster Gang · die Verhöre beginnen'], ['21:30', 'Hauptgang · Beweise werden verglichen'], ['23:00', 'Dessert · die Auflösung']].flatMap(([t, s], i) => [
      T('Zeit ' + (i + 1), kp[0].x, 30 + i * 26, 22, 8, t, 'IBM Plex Mono', 10, '#e3c479', { a: 'left', w: 700, min: 7 }),
      P('Schritt ' + (i + 1), kp[0].x + 24, 30 + i * 26, kp[0].w - 24, 16, s, 'IBM Plex Mono', 10, '#ffffff', { a: 'left', lh: 1.3, min: 7 }),
    ]),
    decor([rect('Mitte', 105, 12, 0.4, 124, '#e3c479', { opacity: 0.5 })]),
    T('Datum', 112, 24, 90, 8, dK, 'Playfair Display', 13, '#ffffff', { w: 700, min: 9 }),
    T('Zeit', 112, 35, 90, 7, 'Einlass ' + uhr('18:30'), 'IBM Plex Mono', 9.5, '#e3c479', { min: 7 }),
    T('Ort', 112, 45, 90, 7, 'Musterweg 5 · 12345 Musterstadt', 'IBM Plex Mono', 9.5, '#ffffff', { min: 7 }),
    T('Code', 112, 65, 90, 14, 'Jede Person bekommt eine Rolle und passende Kleidung.', 'IBM Plex Mono', 8.5, '#ffffff', { wrap: true, v: 'top', lh: 1.3, min: 7 }),
    T('Zusage', 112, 100, 90, 7, 'Zusage bis 25. Oktober', 'IBM Plex Mono', 9.5, '#e3c479', { w: 600, min: 7 }),
    T('Tel', 112, 108, 90, 7, '0170 1234567', 'IBM Plex Mono', 9.5, '#e3c479', { w: 600, min: 7 }),
  ], '#3a0f1c', '#3a0f1c'),
});

module.exports = { templates: [p80Neon, p80Mix, p80Sunset, p90Memphis, p90Window, p90Post, casinoRoyal, casinoFilz, casinoKlapp, krimiNoir, krimiTatort, krimiAkte] };
