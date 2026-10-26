/* Families of batch V4, part D: Housewarming, Ruhestandsfeier, Klassentreffen, Brunch. */
'use strict';
const { D, when, uhr, decor, T, P, info, infoRows, sprinkle, tags } = require('./_v4-lib');
const { text, rect, ellipse, line, icon, shape, frame, deko, dekoIn, dekoWindow, page, gradient, shadow, field, foldCard, panels } = D;

const base = (family, familyName, extra = {}) => Object.assign({ category: 'Einladungen', family, familyName, occasion: 'Feste & Events', unit: 'mm' }, extra);

// ================================================================================================================== Housewarming
const HF = [field('Name', 'Name', 'text', 'Familie Muster')];
const HRows = [{ Name: 'Familie Muster' }, { Name: 'Anna & Jonas' }, { Name: 'Maximiliane Schneider-Hohenstein' }];
const bH = base('housewarming', 'Housewarming', { fields: HF, sampleRows: HRows });
const tH = (...m) => tags('Housewarming', 'Einweihungsparty', 'Einweihung', 'Umzug', 'Neues Zuhause', 'Einladung', 'Party', 'Wohnung', 'Haus', 'Feier', m);
const dH = when(24, 4);

const houseBoho = Object.assign({}, bH, {
  slug: 'housewarming-boho', name: 'Housewarming – Boho', variant: 'Boho',
  description: 'Warme Einladung (A6 hoch) zur Einweihungsparty: kleines Haus mit Schlüssel in Erdtönen, Schreibschrift und drei Zeilen zu Datum, Adresse und Zusage. Der Name der Gastgeber ist ein Feld.',
  tags: tH('Boho', 'Erdtöne', 'Haus', 'Schlüssel', 'Terrakotta'),
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [page('#f4e6d4', [
    decor([dekoIn('Haus', 'deko-motive-haus-schluessel-boho', 22, 10, 61, 52), rect('Linie', 40, 69, 25, 0.5, '#c9714f')]),
    T('Kopf', 8, 72, 89, 7, 'EINLADUNG ZUR', 'Josefin Sans', 9, '#c9714f', { ls: 0.35, w: 600, min: 7 }),
    T('Titel', 6, 79, 93, 16, 'Housewarming', 'Dancing Script', 34, '#7a3b24', { w: 700, min: 16, lh: 1.3 }),
    T('Name', 8, 96, 89, 8, 'bei {{Name}}', 'Nunito', 13, '#7a3b24', { w: 700, min: 8 }),
    ...info('Datum', 14, 110, 78, 'calendar-days', dH + ' · ab ' + uhr('15'), { chip: '#c9714f', ic: '#ffffff', c: '#4a2a1c', f: 'Nunito', s: 10, w: 700, d: 8 }),
    ...info('Ort', 14, 120, 78, 'map-pin', 'Neue Adresse: Musterweg 5, Musterstadt', { chip: '#c9714f', ic: '#ffffff', c: '#4a2a1c', f: 'Nunito', s: 9.5, w: 600, d: 8 }),
    ...info('Zusage', 14, 130, 78, 'phone', 'Zusage bis 17. April: 0170 1234567', { chip: '#a9b79a', ic: '#3a4a2a', c: '#4a2a1c', f: 'Nunito', s: 9.5, w: 600, d: 8 }),
  ])],
});

const houseKarton = Object.assign({}, bH, {
  slug: 'housewarming-umzugskarton', name: 'Housewarming – Umzugskartons', variant: 'Umzugskartons',
  description: 'Hohe Einladung (DIN lang) mit Umzugskartons in Pastell: „Neues Zuhause“ in Fredoka, Hinweis „Kartons sind noch da – Sekt auch!“. Der Name der Gastgeber ist ein Feld.',
  tags: tH('Umzugskartons', 'Kartons', 'Pastell', 'DIN lang', 'Sekt'),
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  pages: [page('#fffaf0', [
    decor([
      rect('Boden', 0, 128, 99, 82, '#ffe9d6'),
      dekoIn('Kartons', 'deko-motive-umzugskarton-pastell', 8, 22, 83, 66),
      deko('Girlande', 'deko-konfetti-wimpelkette-pastell', 4, 4, 91),
    ]),
    T('Titel', 6, 94, 87, 16, 'Neues Zuhause!', 'Fredoka', 25, '#d8386b', { w: 700, min: 12 }),
    T('Name', 8, 110, 83, 9, 'Wir laden ein: {{Name}}', 'Fredoka', 12.5, '#3a2a28', { w: 500, min: 7 }),
    T('Hinweis', 10, 134, 79, 12, 'Kartons sind noch da – Sekt auch!', 'Fredoka', 14, '#3a2a28', { w: 500, wrap: true, lh: 1.25, min: 8 }),
    T('Datum', 8, 152, 83, 8, dH, 'Fredoka', 12.5, '#d8386b', { w: 600, min: 8 }),
    T('Zeit', 8, 161, 83, 7, 'ab ' + uhr('15') + ' · Kaffee und Kuchen', 'Fredoka', 11, '#3a2a28', { w: 400, min: 8 }),
    T('Ort', 8, 169, 83, 7, 'Musterweg 5 · 12345 Musterstadt', 'Fredoka', 11, '#3a2a28', { w: 400, min: 8 }),
    T('Zusage', 8, 182, 83, 7, 'Zusage bis 17. April: 0170 1234567', 'Fredoka', 10.5, '#3a2a28', { w: 500, min: 8 }),
  ])],
});

const houseSchluessel = Object.assign({}, bH, {
  slug: 'housewarming-schluessel', name: 'Housewarming – Schlüssel', variant: 'Schlüssel', unit: 'px',
  description: 'Instagram-Post auf Dunkelblau: goldener Schlüssel, „Wir sind umgezogen!“ und die neue Adresse zum Einweihen. Der Name der Gastgeber ist ein Feld.',
  tags: tH('Schlüssel', 'Instagram', 'Post', 'Social Media', 'Dunkelblau', 'Gold'),
  formatKey: 'instagram-post', width: 1080, height: 1080,
  pages: [page(gradient(180, '#223a5e', '#14233b'), [
    decor([
      deko('Schlüssel', 'deko-motive-schluessel-gold', 130, 110, undefined, 700, { rotation: 20 }),
      deko('Funkeln 1', 'deko-sterne-funkeln-gold', 330, 130, 110), deko('Funkeln 2', 'deko-sterne-funkeln-gold', 280, 740, 80),
    ]),
    T('Kopf', 480, 150, 560, 50, 'EINWEIHUNGSPARTY', 'Josefin Sans', 22, '#e3c479', { ls: 0.35, w: 600, min: 15, a: 'left' }),
    T('Titel', 480, 210, 560, 300, 'Wir sind umgezogen!', 'Playfair Display', 56, '#ffffff', { w: 700, wrap: true, a: 'left', lh: 1.15, min: 28 }),
    T('Name', 480, 540, 560, 70, '{{Name}}', 'Josefin Sans', 30, '#e3c479', { w: 600, a: 'left', min: 15 }),
    T('Datum', 480, 660, 560, 60, dH, 'Josefin Sans', 28, '#ffffff', { w: 700, a: 'left', min: 15 }),
    T('Zeit', 480, 730, 560, 56, 'ab ' + uhr('15') + ' · Musterweg 5', 'Josefin Sans', 26, '#ffffff', { w: 400, a: 'left', min: 15 }),
    T('Zusage', 480, 800, 560, 56, 'Zusage bis 17. April', 'Josefin Sans', 26, '#e3c479', { w: 600, a: 'left', min: 15 }),
  ])],
});

// ================================================================================================================== Ruhestandsfeier
const RF = [field('Name', 'Name', 'text', 'Heinz')];
const RRows = [{ Name: 'Heinz' }, { Name: 'Ingrid' }, { Name: 'Dr. Maximiliane Schneider' }];
const bR = base('ruhestandsfeier', 'Ruhestandsfeier', { fields: RF, sampleRows: RRows });
const tR = (...m) => tags('Ruhestand', 'Rente', 'Ruhestandsfeier', 'Verabschiedung', 'Pension', 'Einladung', 'Feier', 'Abschied', 'Kollege', 'Feierabend', m);
const dR = when(25, 6);

const ruheKlapp = Object.assign({}, bR, {
  slug: 'ruhestandsfeier-haengematte', name: 'Ruhestandsfeier – Hängematte', variant: 'Hängematte', fold: 'vertical',
  description: 'Klappkarte (A6 hoch) für die Ruhestandsfeier: Hängematte zwischen Palmen auf der Titelseite, innen die Einladung mit allen Angaben. Der Name ist ein Feld.',
  tags: tR('Klappkarte', 'Hängematte', 'Palme', 'Sonne', 'Entspannt'),
  formatKey: 'card-a6-portrait', width: 210, height: 148,
  pages: foldCard('vertical', [
    T('Zurück', 12, 62, 90, 18, 'Gut gemacht!', 'Dancing Script', 28, '#1f6f8b', { w: 700, min: 12 }),
    decor([dekoIn('Hängematte', 'deko-motive-palme-haengematte-bunt', 116, 10, 82, 70)]),
    T('Kopf', 112, 86, 90, 7, 'FEIERABEND FÜR', 'Josefin Sans', 9, '#e8651a', { ls: 0.3, w: 700, min: 7 }),
    T('Name', 110, 94, 94, 16, '{{Name}}', 'Dancing Script', 32, '#1f6f8b', { w: 700, min: 14, lh: 1.3 }),
    T('Titel', 112, 112, 90, 9, 'Jetzt beginnt der Ruhestand', 'Nunito', 10.5, '#3a3a3a', { w: 600, min: 8 }),
  ], [
    T('Titel', 14, 14, 78, 14, 'Wir feiern!', 'Dancing Script', 30, '#1f6f8b', { w: 700, a: 'left', min: 14, lh: 1.3 }),
    P('Text', 14, 32, 78, 62, 'Nach vielen Jahren packt {{Name}} den Schreibtisch ein – und wir packen den Grill aus. Kommt vorbei, erzählt Geschichten und wünscht dem Ruheständler einen langen, entspannten Ruhestand.', 'Nunito', 11.5, '#3a3a3a', { a: 'left', lh: 1.45, min: 8 }),
    decor([rect('Mitte', 105, 12, 0.4, 124, '#e8651a', { opacity: 0.5 })]),
    ...info('Datum', 114, 24, 84, 'calendar-days', dR, { chip: '#e8651a', ic: '#ffffff', c: '#2a2a2a', f: 'Nunito', s: 11, w: 700, d: 9 }),
    ...info('Zeit', 114, 40, 84, 'clock', 'ab ' + uhr('16') + ' · Musterweg 5', { chip: '#1f6f8b', ic: '#ffffff', c: '#2a2a2a', f: 'Nunito', s: 11, w: 600, d: 9 }),
    ...info('Ort', 114, 56, 84, 'map-pin', 'Gartenlokal Sonnenschein, Musterstadt', { chip: '#1f6f8b', ic: '#ffffff', c: '#2a2a2a', f: 'Nunito', s: 10.5, w: 600, d: 9 }),
    ...info('Zusage', 114, 72, 84, 'phone', 'Zusage bis 11. Juni: 0170 1234567', { chip: '#e8651a', ic: '#ffffff', c: '#2a2a2a', f: 'Nunito', s: 10.5, w: 600, d: 9 }),
  ], '#fffaf0', '#fffaf0'),
});

const ruheWecker = Object.assign({}, bR, {
  slug: 'ruhestandsfeier-wecker', name: 'Ruhestandsfeier – Wecker', variant: 'Wecker',
  description: 'Einladung (A6 hoch) mit Wecker: „Der Wecker hat ausgedient“ – gelb-blau, heiter, mit allen Angaben und dem Namen als Feld.',
  tags: tR('Wecker', 'Ausschlafen', 'Gelb', 'Blau', 'Humorvoll'),
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [page('#ffe9a8', [
    decor([dekoIn('Wecker', 'deko-motive-wecker-bunt', 26, 10, 53, 64), rect('Boden', 0, 112, 105, 36, '#2358c9')]),
    T('Kopf', 8, 76, 89, 6, 'DER WECKER HAT AUSGEDIENT', 'Nunito', 8, '#2358c9', { w: 800, ls: 0.12, min: 7 }),
    T('Name', 6, 82, 93, 16, '{{Name}}', 'Fredoka', 28, '#14233b', { w: 700, min: 12 }),
    T('Titel', 8, 98, 89, 9, 'geht in den Ruhestand!', 'Fredoka', 13, '#14233b', { w: 500, min: 8 }),
    T('Datum', 8, 116, 89, 7, dR + ' · ' + uhr('16'), 'Nunito', 10.5, '#ffffff', { w: 700, min: 8 }),
    T('Ort', 8, 124, 89, 7, 'Gartenlokal Sonnenschein · Musterstadt', 'Nunito', 10, '#ffffff', { w: 600, min: 8 }),
    T('Zusage', 8, 132, 89, 7, 'Zusage bis 11. Juni · Ausschlafen erlaubt', 'Nunito', 9, '#ffe9a8', { w: 600, min: 7 }),
  ])],
});

const ruheSchirm = Object.assign({}, bR, {
  slug: 'ruhestandsfeier-sonnenschirm', name: 'Ruhestandsfeier – Sonnenschirm', variant: 'Sonnenschirm', unit: 'px',
  description: 'Instagram-Post für die Ruhestandsfeier: Sonnenschirm am Strand auf himmelblauem Verlauf, „Endlich Ruhestand“ und die Angaben zur Feier. Der Name ist ein Feld.',
  tags: tR('Sonnenschirm', 'Strand', 'Instagram', 'Post', 'Social Media', 'Urlaub'),
  formatKey: 'instagram-post', width: 1080, height: 1080,
  pages: [page(gradient(180, '#8fd3f5', '#e8f6fb'), [
    decor([
      ellipse('Sonne', 790, 70, 190, 190, '#ffd23f'),
      rect('Sand', 0, 840, 1080, 240, '#f1d79a'),
      dekoIn('Sonnenschirm', 'deko-motive-sonnenschirm', 640, 260, 360, 640),
    ]),
    T('Kopf', 60, 60, 640, 50, 'RUHESTANDSFEIER', 'Josefin Sans', 22, '#1f6f8b', { ls: 0.35, w: 700, a: 'left', min: 15 }),
    T('Name', 60, 130, 560, 170, '{{Name}}', 'Dancing Script', 80, '#1f6f8b', { w: 700, a: 'left', min: 36, lh: 1.2 }),
    T('Titel', 60, 310, 560, 190, 'macht jetzt Urlaub – für immer!', 'Fredoka', 44, '#14233b', { w: 600, wrap: true, a: 'left', lh: 1.2, min: 24 }),
    T('Datum', 60, 560, 560, 56, dR, 'Nunito', 28, '#14233b', { w: 800, a: 'left', min: 15 }),
    T('Zeit', 60, 622, 560, 50, 'ab ' + uhr('16'), 'Nunito', 26, '#14233b', { w: 600, a: 'left', min: 15 }),
    T('Ort', 60, 676, 560, 90, 'Gartenlokal Sonnenschein, Musterstadt', 'Nunito', 26, '#14233b', { w: 600, wrap: true, a: 'left', lh: 1.2, v: 'top', min: 15 }),
    T('Zusage', 60, 900, 960, 56, 'Zusage bis 11. Juni: 0170 1234567', 'Nunito', 26, '#7a4a1a', { w: 700, a: 'left', min: 15 }),
  ])],
});

// ================================================================================================================== Klassentreffen
const KF = [field('Jahrgang', 'Jahrgang', 'text', 'Abitur 2007')];
const KRows = [{ Jahrgang: 'Abitur 2007' }, { Jahrgang: 'Klasse 10b' }, { Jahrgang: 'Realschulabschluss 1997' }];
const bK = base('klassentreffen', 'Klassentreffen', { fields: KF, sampleRows: KRows });
const tK = (...m) => tags('Klassentreffen', 'Schule', 'Jahrgang', 'Abitur', 'Wiedersehen', 'Einladung', 'Ehemalige', 'Treffen', 'Schultreffen', 'Jubiläum', m);
const dK = when(2, 10);

const klassenTafel = Object.assign({}, bK, {
  slug: 'klassentreffen-tafel', name: 'Klassentreffen – Schultafel', variant: 'Schultafel',
  description: 'Einladung (A6 hoch) im Look einer Schultafel: grüne Tafel mit Kreideschrift, Schulranzen und Bücherstapel. Der Jahrgang ist ein Feld.',
  tags: tK('Schultafel', 'Kreide', 'Tafel', 'Schulranzen', 'Grün'),
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [page('#2b4a3f', [
    decor([
      rect('Rahmen', 3, 3, 99, 142, null, { stroke: '#c9a46a', sw: 3, radius: 2 }),
      rect('Kreide', 12, 70, 81, 0.5, '#ffffff', { opacity: 0.5 }),
      dekoIn('Ranzen', 'deko-motive-schulranzen', 62, 16, 30, 40), dekoIn('Bücher', 'deko-motive-buecherstapel-bunt', 14, 22, 40, 36),
    ]),
    T('Kopf', 10, 8, 85, 8, 'Heute kein Unterricht, sondern', 'Caveat', 14, '#ffffff', { w: 500, min: 9 }),
    T('Titel', 8, 62, 89, 14, 'Klassentreffen!', 'Amatic SC', 36, '#ffffff', { w: 700, min: 18, ls: 0.04 }),
    T('Jahrgang', 8, 78, 89, 10, '{{Jahrgang}}', 'Caveat', 22, '#ffe08a', { w: 700, min: 10 }),
    T('Datum', 8, 94, 89, 8, dK, 'Caveat', 17, '#ffffff', { w: 600, min: 9 }),
    T('Zeit', 8, 104, 89, 8, 'ab ' + uhr('18') + ' · Gasthof zur Linde', 'Caveat', 16, '#ffffff', { w: 500, min: 9 }),
    T('Ort', 8, 114, 89, 8, 'Musterweg 5, 12345 Musterstadt', 'Caveat', 16, '#ffffff', { w: 500, min: 9 }),
    T('Zusage', 8, 126, 89, 8, 'Zusage bitte bis 18. September!', 'Caveat', 15, '#ffe08a', { w: 600, min: 9 }),
  ])],
});

const klassenZeugnis = Object.assign({}, bK, {
  slug: 'klassentreffen-zeugnis', name: 'Klassentreffen – Zeugnis', variant: 'Zeugnis',
  description: 'Feierliche Einladung (DIN lang) im Stil eines Zeugnisses: Doktorhut, Siegelband und ein Text, der alle Ehemaligen zum Wiedersehen bittet. Der Jahrgang ist ein Feld.',
  tags: tK('Zeugnis', 'Urkunde', 'Doktorhut', 'DIN lang', 'Siegel', 'Festlich'),
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  pages: [page('#f6f0e0', [
    decor([
      dekoIn('Rahmen', 'deko-rahmen-doppellinie-lang-gold', 4, 4, 91, 202),
      dekoIn('Doktorhut', 'deko-motive-doktorhut-navy', 24, 20, 51, 40),
      deko('Trenner', 'deko-trenner-raute-navy', 25, 126, 49),
    ]),
    T('Kopf', 10, 66, 79, 7, 'EINLADUNG ZUM', 'Cinzel', 8.5, '#8a6a2a', { ls: 0.3, min: 7 }),
    T('Titel', 8, 74, 83, 24, 'Klassentreffen', 'Playfair Display', 23, '#1f2f5c', { w: 700, min: 12 }),
    T('Jahrgang', 8, 100, 83, 12, '{{Jahrgang}}', 'Cormorant Garamond', 19, '#1f2f5c', { i: true, w: 700, min: 9 }),
    P('Text', 12, 112, 75, 13, 'Alle Ehemaligen sind herzlich zum Wiedersehen eingeladen.', 'Cormorant Garamond', 12.5, '#333333', { w: 600, min: 8 }),
    T('Datum', 8, 136, 83, 8, dK, 'Cinzel', 10, '#1f2f5c', { min: 7 }),
    T('Zeit', 8, 146, 83, 8, 'ab ' + uhr('18'), 'Cormorant Garamond', 13, '#8a6a2a', { w: 700, min: 8 }),
    T('Ort', 8, 155, 83, 8, 'Gasthof zur Linde · Musterweg 5', 'Cormorant Garamond', 12, '#333333', { w: 600, min: 8 }),
    T('Zusage', 8, 170, 83, 8, 'Zusage bis 18. September', 'Cormorant Garamond', 12, '#1f2f5c', { i: true, w: 700, min: 8 }),
    T('Tel', 8, 178, 83, 8, '0170 1234567', 'Cormorant Garamond', 12, '#1f2f5c', { i: true, w: 700, min: 8 }),
  ])],
});

const klassenFotos = Object.assign({}, bK, {
  slug: 'klassentreffen-wer-ist-wer', name: 'Klassentreffen – Wer ist wer?', variant: 'Wer ist wer?', unit: 'px',
  description: 'Instagram-Post mit sechs Bildrahmen für alte Klassenfotos („Wer ist wer?“), dazu Jahrgang, Datum und Ort. Die Bildrahmen füllst du mit eigenen Fotos.',
  tags: tK('Fotos', 'Instagram', 'Post', 'Social Media', 'Bildrahmen', 'Wer ist wer'),
  formatKey: 'instagram-post', width: 1080, height: 1080,
  pages: [page('#fbf3df', [
    decor([
      ...[0, 1, 2].flatMap((i) => [0, 1].map((j) => rect('Foto Grund ' + (i + 1) + (j + 1), 74 + i * 318, 250 + j * 330, 290, 300, '#d9c9a3', { rotation: (i + j) % 2 ? 2 : -2, radius: 4 }))),
      ...[0, 1, 2].flatMap((i) => [0, 1].map((j) => frame('Foto ' + (i + 1) + (j + 1), 82 + i * 318, 258 + j * 330, 274, 250, { radius: 3, mask: 'none', rotation: (i + j) % 2 ? 2 : -2 }))),
    ]),
    T('Kopf', 60, 48, 960, 56, 'KLASSENTREFFEN', 'Amatic SC', 38, '#7a3b24', { w: 700, ls: 0.15, min: 20 }),
    T('Titel', 60, 100, 960, 110, 'Wer ist wer?', 'Caveat', 64, '#2b4a3f', { w: 700, min: 30, lh: 1.2 }),
    T('Jahrgang', 60, 906, 960, 60, '{{Jahrgang}} · ' + dK, 'Caveat', 34, '#2b4a3f', { w: 700, min: 18 }),
    T('Ort', 60, 970, 960, 56, 'Gasthof zur Linde · ab ' + uhr('18') + ' · Zusage bis 18. September', 'Caveat', 28, '#7a3b24', { w: 600, min: 15 }),
  ])],
});

// ================================================================================================================== Brunch
const bB = base('brunch', 'Brunch');
const tB = (...m) => tags('Brunch', 'Frühstück', 'Sonntagsbrunch', 'Einladung', 'Buffet', 'Croissant', 'Kaffee', 'Feier', 'Genuss', 'Morgen', m);
const dB = when(18, 4);

const brunchPastell = Object.assign({}, bB, {
  slug: 'brunch-pastell', name: 'Brunch – Pastell', variant: 'Pastell',
  description: 'Zarte Einladung (A6 hoch) zum Brunch: Croissant und Kaffeetasse auf Pastellrosa, Schreibschrift und drei Zeilen zu Datum, Ort und Zusage.',
  tags: tB('Pastell', 'Rosa', 'Kaffeetasse', 'Zart'),
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [page('#fde7e0', [
    decor([
      ellipse('Kreis', 14, 6, 77, 77, '#f9cfc4'),
      dekoIn('Croissant', 'deko-motive-croissant', 14, 36, 54, 36), dekoIn('Tasse', 'deko-motive-kaffeetasse-pastell', 54, 20, 38, 44),
    ]),
    T('Kopf', 8, 86, 89, 6, 'KOMM ZUM', 'Josefin Sans', 9, '#b04a3a', { ls: 0.45, w: 700, min: 7 }),
    T('Titel', 6, 92, 93, 20, 'Brunch', 'Pacifico', 36, '#b04a3a', { min: 18, lh: 1.5 }),
    T('Datum', 8, 114, 89, 7, dB + ' · ' + uhr('11'), 'Josefin Sans', 10.5, '#5a2a22', { w: 700, min: 8 }),
    T('Ort', 8, 122, 89, 7, 'Musterweg 5 · 12345 Musterstadt', 'Josefin Sans', 10, '#5a2a22', { w: 500, min: 8 }),
    T('Zusage', 8, 130, 89, 7, 'Zusage bis 11. April · Hunger mitbringen', 'Josefin Sans', 9, '#b04a3a', { w: 600, min: 7 }),
  ])],
});

const brunchSonne = Object.assign({}, bB, {
  slug: 'brunch-sonntag', name: 'Brunch – Sonntag', variant: 'Sonntag', unit: 'px',
  description: 'Instagram-Post in Sonnengelb: „Sonntagsbrunch“ in Schreibschrift, Croissant und Kaffeetasse, darunter Zeit und Ort des Buffets.',
  tags: tB('Sonntag', 'Instagram', 'Post', 'Social Media', 'Gelb', 'Sonnig'),
  formatKey: 'instagram-post', width: 1080, height: 1080,
  pages: [page(gradient(180, '#ffe27a', '#ffc94d'), [
    decor([
      ellipse('Kreis', 220, 130, 640, 640, '#fff3b8', { opacity: 0.8 }),
      dekoIn('Croissant', 'deko-motive-croissant', 300, 210, 480, 300), dekoIn('Tasse', 'deko-motive-kaffeetasse-bunt', 640, 330, 260, 280),
    ]),
    T('Kopf', 60, 50, 960, 56, 'EINLADUNG ZUM', 'Josefin Sans', 24, '#7a4a1a', { ls: 0.4, w: 700, min: 15 }),
    T('Titel', 60, 590, 960, 170, 'Sonntagsbrunch', 'Pacifico', 80, '#7a2a1a', { min: 36, lh: 1.5 }),
    T('Datum', 60, 780, 960, 60, dB + ' · ab ' + uhr('11'), 'Josefin Sans', 32, '#3a2410', { w: 700, min: 18 }),
    T('Ort', 60, 850, 960, 56, 'Musterweg 5 · 12345 Musterstadt', 'Josefin Sans', 28, '#3a2410', { w: 500, min: 15 }),
    T('Zusage', 60, 930, 960, 56, 'Zusage bis 11. April · Buffet ohne Ende', 'Josefin Sans', 26, '#7a2a1a', { w: 700, min: 15 }),
  ])],
});

const brunchBuffet = Object.assign({}, bB, {
  slug: 'brunch-buffet', name: 'Brunch – Buffet', variant: 'Buffet',
  description: 'Hohe Einladung (DIN lang) im Speisekarten-Stil: das Brunch-Buffet in vier Zeilen, Croissant oben, Datum, Ort und Zusage unten.',
  tags: tB('Buffet', 'Speisekarte', 'DIN lang', 'Menü', 'Creme', 'Grün'),
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  pages: [page('#f7f3e8', [
    decor([
      dekoIn('Croissant', 'deko-motive-croissant', 24, 12, 51, 34),
      deko('Trenner', 'deko-trenner-blattreihe-salbei', 20, 98, 59),
      deko('Trenner 2', 'deko-trenner-blattreihe-salbei', 20, 148, 59),
    ]),
    T('Kopf', 8, 50, 83, 7, 'WIR LADEN EIN ZUM', 'Josefin Sans', 8.5, '#5f7f66', { ls: 0.35, w: 700, min: 7 }),
    T('Titel', 6, 57, 87, 22, 'Brunch', 'Playfair Display', 36, '#2f4a37', { w: 700, i: true, min: 18 }),
    T('Sub', 8, 80, 83, 9, 'mit großem Buffet', 'Josefin Sans', 11, '#5f7f66', { w: 600, min: 8 }),
    ...['Frische Brötchen & Croissants', 'Rührei, Käse und Aufschnitt', 'Obstsalat, Joghurt, Müsli', 'Kaffee, Saft und Sekt'].map((t, i) => T('Buffet ' + (i + 1), 8, 108 + i * 9.5, 83, 8, t, 'Cormorant Garamond', 14.5, '#2f4a37', { w: 600, min: 8 })),
    T('Datum', 8, 156, 83, 8, dB, 'Josefin Sans', 11, '#2f4a37', { w: 700, min: 8 }),
    T('Zeit', 8, 165, 83, 7, 'ab ' + uhr('11'), 'Josefin Sans', 10, '#2f4a37', { w: 500, min: 8 }),
    T('Ort', 8, 173, 83, 7, 'Musterweg 5 · 12345 Musterstadt', 'Josefin Sans', 10, '#2f4a37', { w: 500, min: 8 }),
    T('Zusage', 8, 187, 83, 7, 'Zusage bis 11. April', 'Josefin Sans', 9.5, '#5f7f66', { w: 700, min: 8 }),
  ])],
});

module.exports = { templates: [houseBoho, houseKarton, houseSchluessel, ruheKlapp, ruheWecker, ruheSchirm, klassenTafel, klassenZeugnis, klassenFotos, brunchPastell, brunchSonne, brunchBuffet] };
