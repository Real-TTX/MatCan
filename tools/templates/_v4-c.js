/* Families of batch V4, part C: Cocktailparty, Weinprobe, Spieleabend, Junggesellenabschied. */
'use strict';
const { D, when, uhr, decor, T, P, info, infoRows, sprinkle, tags } = require('./_v4-lib');
const { text, rect, ellipse, line, icon, shape, deko, dekoIn, dekoWindow, page, gradient, shadow, field, foldCard, panels } = D;

const base = (family, familyName, extra = {}) => Object.assign({ category: 'Einladungen', family, familyName, occasion: 'Feste & Events', unit: 'mm' }, extra);

// ================================================================================================================== Cocktailparty
const bCo = base('cocktailparty', 'Cocktailparty');
const tCo = (...m) => tags('Cocktail', 'Cocktailparty', 'Party', 'Einladung', 'Drinks', 'Bar', 'Aperitif', 'Feier', 'Sommer', 'Happy Hour', m);
const dCo = when(14, 8);
const TEAL = '#0b5d63';

const cocktailTropisch = Object.assign({}, bCo, {
  slug: 'cocktailparty-tropisch', name: 'Cocktailparty – Tropisch', variant: 'Tropisch',
  description: 'Sommerliche Einladung (A6 hoch) zur Cocktailparty: Cocktail mit Schirmchen und Strohhalm zwischen Palmenblättern auf Tiefgrün, Datum und Ort darunter.',
  tags: tCo('Tropisch', 'Palmen', 'Schirmchen', 'Strohhalm', 'Grün'),
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [page(gradient(180, '#0b5d63', '#063a40'), [
    decor([
      dekoIn('Palme links', 'deko-motive-palmenblatt', 0, 30, 40, 76, { align: 'left' }),
      dekoIn('Palme rechts', 'deko-motive-palmenblatt', 65, 30, 40, 76, { align: 'right', flipX: true }),
      dekoIn('Cocktail', 'deko-motive-cocktail-tropisch', 26, 36, 53, 66),
    ]),
    T('Titel', 8, 8, 89, 18, 'Cocktail', 'Pacifico', 34, '#ffd23f', { min: 18, lh: 1.5 }),
    T('Party', 8, 26, 89, 8, 'PARTY', 'Josefin Sans', 17, '#ffffff', { ls: 0.5, w: 600, min: 10 }),
    T('Datum', 8, 108, 89, 7, dCo + ' · ' + uhr('18'), 'Josefin Sans', 11, '#ffffff', { w: 700, min: 8 }),
    T('Ort', 8, 116, 89, 7, 'Dachterrasse · Musterweg 5', 'Josefin Sans', 10.5, '#ffd23f', { w: 600, min: 8 }),
    T('Zusage', 8, 126, 89, 7, 'Zusage bis 7. August', 'Josefin Sans', 10, '#ffffff', { w: 500, min: 8 }),
    T('Hinweis', 8, 134, 89, 6, 'Die erste Runde geht aufs Haus.', 'Josefin Sans', 8.5, '#bfe9e4', { i: true, min: 7 }),
  ])],
});

const cocktailMartini = Object.assign({}, bCo, {
  slug: 'cocktailparty-martini', name: 'Cocktailparty – Martini', variant: 'Martini',
  description: 'Festliche Einladung (DIN lang) in Schwarz und Gold: Martini-Glas mit Olive, Zierlinien und Serifenschrift für den Cocktail-Abend.',
  tags: tCo('Martini', 'Elegant', 'Schwarz-Gold', 'DIN lang', 'Olive'),
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  pages: [page('#101010', [
    decor([
      dekoIn('Rahmen', 'deko-rahmen-doppellinie-lang-gold', 4, 4, 91, 202),
      dekoIn('Martini', 'deko-motive-martini-glas', 24, 22, 51, 74),
      deko('Trenner', 'deko-trenner-deco-gold', 25, 138, 49),
    ]),
    T('Kopf', 10, 102, 79, 7, 'EIN ABEND MIT', 'Cinzel', 8.5, '#d4af6a', { ls: 0.25, min: 7 }),
    T('Titel', 8, 110, 83, 24, 'Shaken, not stirred', 'Playfair Display', 19, '#f3e8d0', { i: true, w: 600, wrap: true, lh: 1.2, min: 10 }),
    T('Datum', 8, 148, 83, 8, dCo, 'Cinzel', 10, '#f3e8d0', { min: 7 }),
    T('Zeit', 8, 157, 83, 8, 'ab ' + uhr('18'), 'Cormorant Garamond', 13, '#d4af6a', { w: 600, min: 8 }),
    T('Ort', 8, 166, 83, 8, 'Hotelbar Musterhof · Musterweg 5', 'Cormorant Garamond', 11.5, '#f3e8d0', { w: 600, min: 8 }),
    T('Zusage', 8, 176, 83, 8, 'U. A. w. g. bis 7. August', 'Cormorant Garamond', 11, '#d4af6a', { i: true, w: 600, min: 8 }),
  ])],
});

const cocktailSundowner = Object.assign({}, bCo, {
  slug: 'cocktailparty-sundowner', name: 'Cocktailparty – Sundowner', variant: 'Sundowner', unit: 'px',
  description: 'Instagram-Post in Pastell: zwei Cocktails, „Happy Hour“ in großer Schreibschrift und alle Angaben für den Sundowner auf einen Blick.',
  tags: tCo('Sundowner', 'Instagram', 'Post', 'Social Media', 'Pastell', 'Rosa'),
  formatKey: 'instagram-post', width: 1080, height: 1080,
  pages: [page(gradient(180, '#ffe4ec', '#ffd8b8'), [
    decor([
      ellipse('Sonne', 600, 80, 380, 380, '#ffb199', { opacity: 0.5 }),
      dekoIn('Martini', 'deko-motive-martini-glas', 90, 140, 240, 340, { rotation: -8 }),
      dekoIn('Cocktail', 'deko-motive-cocktail-tropisch', 670, 120, 300, 380, { rotation: 6 }),
    ]),
    T('Kopf', 60, 50, 960, 52, 'SUNDOWNER', 'Josefin Sans', 26, '#7a2a4a', { ls: 0.5, w: 600, min: 15 }),
    T('Titel', 340, 190, 400, 250, 'Happy Hour', 'Pacifico', 62, '#d8386b', { wrap: true, lh: 1.3, min: 30 }),
    rect('Linie', 440, 560, 200, 4, '#d8386b', { radius: 2 }),
    T('Datum', 60, 600, 960, 70, dCo, 'Josefin Sans', 36, '#3a1428', { w: 700, min: 18 }),
    T('Zeit', 60, 676, 960, 60, 'ab ' + uhr('18') + ' · Dachterrasse', 'Josefin Sans', 30, '#3a1428', { w: 500, min: 15 }),
    T('Ort', 60, 745, 960, 60, 'Musterweg 5 · 12345 Musterstadt', 'Josefin Sans', 28, '#3a1428', { w: 500, min: 15 }),
    T('Zusage', 60, 850, 960, 60, 'Zusage bis 7. August: 0170 1234567', 'Josefin Sans', 26, '#d8386b', { w: 700, min: 15 }),
  ])],
});

// ================================================================================================================== Weinprobe
const bW = base('weinprobe', 'Weinprobe');
const tW = (...m) => tags('Wein', 'Weinprobe', 'Weinabend', 'Verkostung', 'Einladung', 'Winzer', 'Rotwein', 'Weißwein', 'Genuss', 'Feier', m);
const dW = when(9, 10);
const BORD = '#5a1428', WGOLD = '#d4af6a';

const weinKlapp = Object.assign({}, bW, {
  slug: 'weinprobe-bordeaux', name: 'Weinprobe – Bordeaux', variant: 'Bordeaux', fold: 'vertical',
  description: 'Klappkarte (A6 hoch) in Bordeaux und Gold: außen das Weinglas, innen der Ablauf der Verkostung mit sechs Weinen sowie Datum, Ort und Zusage.',
  tags: tW('Klappkarte', 'Bordeaux', 'Gold', 'Glas', 'Verkostung'),
  formatKey: 'card-a6-portrait', width: 210, height: 148,
  pages: foldCard('vertical', [
    decor([dekoIn('Trauben', 'deko-motive-trauben', 40, 36, 28, 40)]),
    T('Zurück', 12, 82, 90, 8, 'Auf Ihr Wohl', 'Great Vibes', 22, WGOLD, { min: 12 }),
    decor([dekoIn('Glas', 'deko-motive-weinglas-rot', 130, 10, 48, 78), rect('Linie', 120, 94, 70, 0.5, WGOLD)]),
    T('Kopf', 112, 97, 90, 6, 'EINLADUNG ZUR', 'Cinzel', 8, WGOLD, { ls: 0.25, min: 7 }),
    T('Titel', 110, 104, 94, 16, 'WEINPROBE', 'Cinzel', 24, '#f3e8d0', { w: 600, ls: 0.06, min: 12 }),
    T('Datum', 112, 121, 90, 7, dW, 'Cormorant Garamond', 13, WGOLD, { i: true, w: 600, min: 8 }),
  ], [
    T('Ablauf', 14, 14, 87, 12, 'DER ABEND', 'Cinzel', 19, WGOLD, { ls: 0.15, min: 9 }),
    P('Text', 14, 28, 87, 70, 'Sechs Weine, drei Rebsorten, ein Winzer, der zu jedem Glas eine Geschichte erzählt. Dazu gibt es Brot, Käse und Antworten auf alle Fragen, die Sie schon immer stellen wollten.', 'Cormorant Garamond', 16, '#f3e8d0', { a: 'left', w: 500, min: 9, lh: 1.4 }),
    decor([rect('Mitte', 105, 12, 0.4, 124, WGOLD, { opacity: 0.5 })]),
    T('Datum', 112, 22, 90, 10, dW, 'Cinzel', 14, '#f3e8d0', { w: 500, min: 8 }),
    T('Zeit', 112, 34, 90, 8, 'Beginn ' + uhr('18'), 'Cormorant Garamond', 17, WGOLD, { w: 600, min: 9 }),
    T('Ort', 112, 46, 90, 8, 'Weingut Musterhof · Musterweg 5', 'Cormorant Garamond', 15, '#f3e8d0', { w: 600, min: 9 }),
    T('Beitrag', 112, 66, 90, 8, 'Kostenbeitrag: 25 € pro Person', 'Cormorant Garamond', 15, '#f3e8d0', { i: true, w: 600, min: 9 }),
    T('Zusage', 112, 96, 90, 8, 'U. A. w. g. bis 25. September', 'Cormorant Garamond', 15, WGOLD, { i: true, w: 600, min: 9 }),
    T('Tel', 112, 106, 90, 8, '0170 1234567', 'Cormorant Garamond', 15, WGOLD, { i: true, w: 600, min: 9 }),
  ], BORD, BORD),
});

const weinKeller = Object.assign({}, bW, {
  slug: 'weinprobe-weinkeller', name: 'Weinprobe – Weinkeller', variant: 'Weinkeller',
  description: 'Hohe Einladung (DIN lang) im hellen Etiketten-Stil: Weinflasche, Trauben, Serifenschrift und zwei Linien wie auf einem Weinetikett.',
  tags: tW('Weinkeller', 'Etikett', 'DIN lang', 'Flasche', 'Trauben', 'Creme'),
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  pages: [page('#f3ead3', [
    decor([
      dekoIn('Flasche', 'deko-motive-weinflasche', 34, 10, 31, 90),
      dekoIn('Trauben', 'deko-motive-trauben', 66, 62, 26, 38),
      rect('Linie 1', 12, 108, 75, 0.6, '#5a1428'), rect('Linie 2', 12, 112, 75, 0.6, '#5a1428'),
    ]),
    T('Kopf', 8, 117, 83, 7, 'ES LADEN EIN', 'Cinzel', 8.5, '#8a6a2a', { ls: 0.3, min: 7 }),
    T('Titel', 6, 125, 87, 20, 'Weinprobe', 'Playfair Display', 31, '#5a1428', { w: 700, i: true, min: 14 }),
    T('Sub', 8, 146, 83, 8, 'im Gewölbekeller', 'Cormorant Garamond', 14, '#5a1428', { w: 600, min: 8 }),
    rect('Linie 3', 30, 158, 39, 0.4, '#8a6a2a'),
    T('Datum', 8, 163, 83, 8, dW, 'Cinzel', 10, '#2a0d17', { min: 7 }),
    T('Zeit', 8, 172, 83, 7, 'ab ' + uhr('18') + ' · Musterweg 5', 'Cormorant Garamond', 12, '#2a0d17', { w: 600, min: 8 }),
    T('Beitrag', 8, 180, 83, 7, 'Beitrag: 25 € inkl. Brot und Käse', 'Cormorant Garamond', 11, '#2a0d17', { w: 600, min: 8 }),
    T('Zusage', 8, 190, 83, 7, 'Zusage bis 25. September', 'Cormorant Garamond', 11, '#5a1428', { i: true, w: 700, min: 8 }),
  ])],
});

const weinPost = Object.assign({}, bW, {
  slug: 'weinprobe-wein-und-kaese', name: 'Weinprobe – Wein & Käse', variant: 'Wein & Käse', unit: 'px',
  description: 'Instagram-Post auf Tiefrot: Weinglas und Flasche links und rechts, in der Mitte „Wein & Käse“ und die Angaben zur Verkostung.',
  tags: tW('Instagram', 'Post', 'Social Media', 'Wein und Käse', 'Dunkel'),
  formatKey: 'instagram-post', width: 1080, height: 1080,
  pages: [page(gradient(160, '#3a0f1c', '#17060c'), [
    decor([
      dekoIn('Glas', 'deko-motive-weinglas-rot', 70, 190, 220, 640),
      dekoIn('Flasche', 'deko-motive-weinflasche', 800, 130, 220, 700),
      dekoIn('Trenner', 'deko-trenner-deco-gold', 340, 440, 400),
    ]),
    T('Kopf', 330, 120, 420, 50, 'EINLADUNG ZUR', 'Cinzel', 20, WGOLD, { ls: 0.3, min: 14 }),
    T('Titel', 320, 175, 440, 250, 'Wein & Käse', 'Playfair Display', 60, '#f3e8d0', { i: true, w: 700, wrap: true, lh: 1.15, min: 30 }),
    T('Datum', 320, 510, 440, 60, dW, 'Cinzel', 24, '#f3e8d0', { wrap: true, v: 'top', min: 15, lh: 1.25 }),
    T('Zeit', 320, 610, 440, 60, 'Beginn ' + uhr('18'), 'Cormorant Garamond', 34, WGOLD, { w: 600, min: 15 }),
    T('Ort', 320, 680, 440, 60, 'Weingut Musterhof', 'Cormorant Garamond', 30, '#f3e8d0', { w: 600, min: 15 }),
    T('Zusage', 320, 800, 440, 80, 'Zusage bis 25. September', 'Cormorant Garamond', 28, WGOLD, { i: true, w: 600, min: 15 }),
  ])],
});

// ================================================================================================================== Spieleabend
const bS = base('spieleabend', 'Spieleabend');
const tS = (...m) => tags('Spieleabend', 'Spiele', 'Brettspiele', 'Kartenspiele', 'Einladung', 'Gesellschaftsspiele', 'Würfel', 'Freunde', 'Feier', 'Spaß', m);
const dS = when(15, 1);
const RS = '#d8283c';

const spielWuerfel = Object.assign({}, bS, {
  slug: 'spieleabend-wuerfel', name: 'Spieleabend – Würfel', variant: 'Würfel',
  description: 'Bunte Einladung (A6 hoch) zum Spieleabend: zwei Würfel, runde Schrift und Konfetti auf warmem Papierton; mit allen Angaben zum Mitbringen.',
  tags: tS('Würfel', 'Bunt', 'Konfetti', 'Fröhlich'),
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [page('#fff6e0', [
    sprinkle('Konfetti', 801, [4, 4, 97, 140], { n: 26, avoid: [[8, 8, 89, 138]], colors: [RS, '#2358c9', '#f2b631', '#1f8a4c'], kinds: ['dot', 'ring', 'bar'], size: [2, 4] }),
    decor([dekoIn('Würfel', 'deko-motive-wuerfel', 14, 12, 77, 56)]),
    T('Titel', 8, 72, 89, 18, 'Spieleabend', 'Fredoka', 31, RS, { w: 700, min: 16 }),
    T('Sub', 8, 90, 89, 7, 'Brettspiele · Karten · Knabberzeug', 'Fredoka', 11, '#2358c9', { w: 500, min: 8 }),
    ...info('Datum', 14, 104, 78, 'calendar-days', dS + ' · ' + uhr('19'), { chip: RS, ic: '#ffffff', c: '#1d1a3a', f: 'Fredoka', s: 10, w: 500, d: 8 }),
    ...info('Ort', 14, 114, 78, 'map-pin', 'Musterweg 5 · 12345 Musterstadt', { chip: '#2358c9', ic: '#ffffff', c: '#1d1a3a', f: 'Fredoka', s: 10, w: 500, d: 8 }),
    ...info('Zusage', 14, 124, 78, 'gamepad-2', 'Bring dein Lieblingsspiel mit!', { chip: '#f2b631', ic: '#1d1a3a', c: '#1d1a3a', f: 'Fredoka', s: 10, w: 500, d: 8 }),
  ])],
});

const spielMeeples = Object.assign({}, bS, {
  slug: 'spieleabend-meeples', name: 'Spieleabend – Meeples', variant: 'Meeples', unit: 'px',
  description: 'Instagram-Post auf Spielfilz-Grün: drei bunte Spielfiguren, große Schrift und Hinweise, was mitgebracht werden soll.',
  tags: tS('Instagram', 'Post', 'Social Media', 'Meeple', 'Spielfiguren', 'Grün'),
  formatKey: 'instagram-post', width: 1080, height: 1080,
  pages: [page(gradient(180, '#1f7a5e', '#13503d'), [
    decor([dekoIn('Meeples', 'deko-motive-meeples', 150, 60, 780, 400), rect('Band', 0, 500, 1080, 14, '#f3e8d0', { opacity: 0.25 })]),
    T('Titel', 60, 520, 960, 150, 'Spieleabend', 'Baloo 2', 84, '#ffffff', { w: 800, min: 40, lh: 1.15 }),
    T('Sub', 60, 665, 960, 60, 'Bring dein Lieblingsspiel mit!', 'Baloo 2', 32, '#ffd23f', { w: 600, min: 18 }),
    T('Datum', 60, 770, 960, 66, dS + ' · ' + uhr('19'), 'Baloo 2', 36, '#ffffff', { w: 700, min: 18 }),
    T('Ort', 60, 842, 960, 60, 'Musterweg 5 · 12345 Musterstadt', 'Baloo 2', 30, '#ffffff', { w: 600, min: 15 }),
    T('Zusage', 60, 930, 960, 56, 'Zusage bis 8. Januar · Snacks willkommen', 'Baloo 2', 26, '#ffd23f', { w: 600, min: 15 }),
  ])],
});

const spielBrett = Object.assign({}, bS, {
  slug: 'spieleabend-schachbrett', name: 'Spieleabend – Schachbrett', variant: 'Schachbrett',
  description: 'Hohe Einladung (DIN lang) mit Schachbrettmuster im oberen Teil, Spielkarten und Würfeln; Untertitel „Spiel · Spaß · Snacks“ und alle Angaben.',
  tags: tS('Schachbrett', 'DIN lang', 'Karten', 'Würfel', 'Blau'),
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  pages: [page('#262a6a', [
    decor([
      ...Array.from({ length: 24 }, (_, i) => rect('Feld ' + (i + 1), (i % 6) * 16.5, Math.floor(i / 6) * 16.5, 16.5, 16.5, (i % 6 + Math.floor(i / 6)) % 2 ? '#262a6a' : '#f3e8d0')),
      dekoIn('Karten', 'deko-motive-spielkarten', 14, 76, 71, 52),
    ]),
    T('Titel', 6, 132, 87, 18, 'Spieleabend', 'Fredoka', 29, '#ffffff', { w: 700, min: 14 }),
    T('Sub', 8, 150, 83, 8, 'Spiel · Spaß · Snacks', 'Fredoka', 14, '#ffd23f', { w: 500, min: 9 }),
    T('Datum', 8, 164, 83, 8, dS, 'Fredoka', 11, '#ffffff', { w: 600, min: 8 }),
    T('Zeit', 8, 172, 83, 8, 'ab ' + uhr('19') + ' · Musterweg 5', 'Fredoka', 10.5, '#ffffff', { w: 500, min: 8 }),
    T('Mitbringen', 8, 181, 83, 8, 'Mitbringen: Lieblingsspiel & gute Laune', 'Fredoka', 9.5, '#ffd23f', { w: 500, min: 8 }),
    T('Zusage', 8, 192, 83, 8, 'Zusage bis 8. Januar: 0170 1234567', 'Fredoka', 9.5, '#ffffff', { w: 500, min: 8 }),
  ])],
});

// ================================================================================================================== Junggesellenabschied
const JF = [field('Name', 'Name', 'text', 'Lena')];
const JRows = [{ Name: 'Lena' }, { Name: 'Maximiliane' }, { Name: 'Tim' }];
const bJ = base('junggesellenabschied', 'Junggesellenabschied', { fields: JF, sampleRows: JRows });
const tJ = (...m) => tags('Junggesellenabschied', 'JGA', 'Junggesellinnenabschied', 'Hochzeit', 'Einladung', 'Party', 'Brautparty', 'Feier', 'Polterabend', m);
const dJ = when(8, 5);

const jgaSie = Object.assign({}, bJ, {
  slug: 'junggesellenabschied-sie', name: 'Junggesellenabschied – Sie', variant: 'Sie',
  description: 'Rosa Einladung (A6 hoch) zum Junggesellinnenabschied: Diamantring, Sektgläser und der Name der Braut als Feld.',
  tags: tJ('Sie', 'Braut', 'Bride to be', 'Rosa', 'Diamantring', 'Sekt'),
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [page(gradient(180, '#ffe3ee', '#ffc4d9'), [
    decor([
      sprinkle('Herzen', 811, [4, 4, 97, 140], { n: 16, avoid: [[10, 10, 85, 132]], colors: ['#ff6b9a', '#ffffff', '#d4af6a'], kinds: ['heart', 'spark', 'dot'], size: [2.5, 5] }),
      dekoIn('Ring', 'deko-motive-diamantring', 12, 12, 38, 44),
      dekoIn('Sekt', 'deko-motive-sektglaeser-bunt', 58, 16, 36, 40),
    ]),
    T('Kopf', 8, 62, 89, 7, 'BRIDE TO BE', 'Josefin Sans', 10, '#c2185b', { ls: 0.4, w: 600, min: 7 }),
    T('Name', 6, 69, 93, 22, '{{Name}}', 'Great Vibes', 44, '#c2185b', { min: 20, lh: 1.3 }),
    T('Titel', 8, 91, 89, 9, 'sagt bald JA!', 'Great Vibes', 22, '#7a1f4a', { min: 12, lh: 1.3 }),
    T('Kopf 2', 8, 101, 89, 7, 'Wir feiern ihren Junggesellinnenabschied', 'Josefin Sans', 8, '#7a1f4a', { w: 600, min: 7 }),
    T('Datum', 8, 112, 89, 7, dJ, 'Josefin Sans', 10.5, '#3a1428', { w: 700, min: 8 }),
    T('Zeit', 8, 120, 89, 7, 'Treffpunkt ' + uhr('14') + ' · Hauptbahnhof', 'Josefin Sans', 9.5, '#3a1428', { w: 500, min: 7 }),
    T('Zusage', 8, 128, 89, 7, 'Dresscode: Rosa · Zusage bis 20. April', 'Josefin Sans', 9, '#c2185b', { w: 600, min: 7 }),
  ])],
});

const jgaIhn = Object.assign({}, bJ, {
  slug: 'junggesellenabschied-ihn', name: 'Junggesellenabschied – Ihn', variant: 'Ihn',
  description: 'Dunkle Einladung (A6 hoch) zum Junggesellenabschied des Bräutigams: Fliege, Anton-Schrift in Weiß und Rot, Name des Bräutigams als Feld.',
  tags: tJ('Ihn', 'Bräutigam', 'Herren', 'Fliege', 'Männer', 'Dunkel'),
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [page('#14141b', [
    decor([
      dekoIn('Fliege', 'deko-motive-fliege', 17, 12, 71, 38),
      rect('Band', 0, 58, 105, 3, '#b3202c'), rect('Band 2', 0, 63, 105, 1, '#b3202c'),
    ]),
    T('Kopf', 8, 70, 89, 6, 'DIE LETZTEN STUNDEN IN FREIHEIT VON', 'Oswald', 8, '#b3202c', { ls: 0.15, w: 500, min: 7 }),
    T('Name', 6, 77, 93, 22, '{{Name}}', 'Anton', 40, '#ffffff', { up: true, min: 18, lh: 1.15 }),
    T('Titel', 8, 99, 89, 10, 'JUNGGESELLENABSCHIED', 'Oswald', 15, '#b3202c', { ls: 0.1, w: 600, min: 9 }),
    T('Datum', 8, 114, 89, 7, dJ, 'Oswald', 11, '#ffffff', { up: true, w: 400, ls: 0.05, min: 8 }),
    T('Zeit', 8, 122, 89, 7, 'Treffpunkt ' + uhr('13') + ' · Hauptbahnhof', 'Oswald', 10.5, '#bdbdc4', { up: true, w: 400, ls: 0.05, min: 8 }),
    T('Zusage', 8, 130, 89, 7, 'Zusage bis 20. April · Bargeld nicht vergessen', 'Oswald', 8.5, '#b3202c', { up: true, w: 400, ls: 0.05, min: 7 }),
  ])],
});

const jgaTeam = Object.assign({}, bJ, {
  slug: 'junggesellenabschied-team', name: 'Junggesellenabschied – Team', variant: 'Team', unit: 'px',
  description: 'Story-Einladung für alle: „Team {{Name}}“ in großer Schrift auf Rosé und Weiß, mit Herzen, Sektgläsern und den Angaben zum Treffpunkt.',
  tags: tJ('Team', 'Story', 'Instagram', 'Social Media', 'Sektgläser', 'Herzen', 'Für alle'),
  formatKey: 'instagram-story', width: 1080, height: 1920,
  pages: [page(gradient(180, '#fff0f5', '#ffc4d9'), [
    decor([
      dekoIn('Herzen', 'deko-herzen-streuung-rose', 80, 90, 920, 740),
      dekoIn('Sekt', 'deko-motive-sektglaeser-bunt', 280, 330, 520, 480),
      dekoIn('Trenner', 'deko-trenner-girlande-rose', 240, 1250, 600, 50),
    ]),
    T('Kopf', 60, 860, 960, 60, 'JUNGGESELLENABSCHIED', 'Josefin Sans', 26, '#c2185b', { ls: 0.4, w: 700, min: 15 }),
    T('Team', 60, 920, 960, 130, 'Team', 'Great Vibes', 70, '#7a1f4a', { min: 36, lh: 1.3 }),
    T('Name', 60, 1050, 960, 220, '{{Name}}', 'Great Vibes', 110, '#c2185b', { min: 40, lh: 1.3 }),
    T('Datum', 60, 1320, 960, 70, dJ, 'Josefin Sans', 34, '#3a1428', { w: 700, min: 18 }),
    T('Zeit', 60, 1400, 960, 62, 'Treffpunkt ' + uhr('14') + ' · Hauptbahnhof', 'Josefin Sans', 30, '#3a1428', { w: 500, min: 15 }),
    T('Code', 60, 1480, 960, 62, 'Dresscode: Rosa', 'Josefin Sans', 30, '#3a1428', { w: 500, min: 15 }),
    T('Zusage', 60, 1590, 960, 62, 'Zusage bis 20. April: 0170 1234567', 'Josefin Sans', 28, '#c2185b', { w: 700, min: 15 }),
  ])],
});

module.exports = { templates: [cocktailTropisch, cocktailMartini, cocktailSundowner, weinKlapp, weinKeller, weinPost, spielWuerfel, spielMeeples, spielBrett, jgaSie, jgaIhn, jgaTeam] };
