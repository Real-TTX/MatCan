/* Families of batch V4, part E: Familienfeier, Oktoberfest, Fasching/Karneval, Gartenparty. */
'use strict';
const { D, when, uhr, decor, T, P, info, infoRows, sprinkle, tags } = require('./_v4-lib');
const { text, rect, ellipse, line, icon, shape, frame, deko, dekoIn, dekoWindow, page, gradient, shadow, field, foldCard, panels } = D;

const base = (family, familyName, extra = {}) => Object.assign({ category: 'Einladungen', family, familyName, occasion: 'Feste & Events', unit: 'mm' }, extra);

// ================================================================================================================== Familienfeier
const FF = [field('Anlass', 'Anlass', 'text', 'Familienfeier')];
const FRows = [{ Anlass: 'Familienfeier' }, { Anlass: 'Omas 80. Geburtstag' }, { Anlass: 'Silberhochzeit Anna & Peter' }];
const bF = base('familienfeier', 'Familienfeier', { fields: FF, sampleRows: FRows });
const tF = (...m) => tags('Familienfeier', 'Familie', 'Einladung', 'Feier', 'Verwandtschaft', 'Familientreffen', 'Geburtstag', 'Jubiläum', 'Kaffeetafel', 'Fest', m);
const dF = when(5, 6);

const familieRanke = Object.assign({}, bF, {
  slug: 'familienfeier-ranke', name: 'Familienfeier – Ranke', variant: 'Ranke',
  description: 'Natürliche Einladung (A6 hoch) für Familienfeiern jeder Art: Rankenrahmen in Salbeigrün, Schreibschrift und klare Angaben. Der Anlass ist ein Feld.',
  tags: tF('Ranke', 'Salbei', 'Natürlich', 'Rahmen', 'Grün'),
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [page('#f6f4ea', [
    decor([dekoIn('Rahmen', 'deko-rahmen-ranke-hoch-salbei', 3, 3, 99, 142), deko('Trenner', 'deko-trenner-blattreihe-salbei', 28, 76, 49)]),
    T('Kopf', 14, 26, 77, 7, 'WIR LADEN EUCH EIN ZUR', 'Josefin Sans', 8.5, '#5f7f66', { ls: 0.3, w: 700, min: 7 }),
    T('Anlass', 14, 34, 77, 38, '{{Anlass}}', 'Dancing Script', 32, '#2f4a37', { w: 700, wrap: true, lh: 1.2, min: 14 }),
    T('Text', 14, 84, 77, 7, 'Kaffee, Kuchen und ganz viel Familie', 'Nunito', 9.5, '#3a3a3a', { w: 600, min: 7 }),
    T('Datum', 14, 96, 77, 7, dF + ' · ' + uhr('14'), 'Josefin Sans', 10, '#2f4a37', { w: 700, min: 8 }),
    T('Ort', 14, 104, 77, 7, 'Musterweg 5 · 12345 Musterstadt', 'Josefin Sans', 9.5, '#2f4a37', { w: 500, min: 8 }),
    T('Zusage', 14, 112, 77, 7, 'Zusage bis 29. Mai: 0170 1234567', 'Josefin Sans', 9, '#5f7f66', { w: 700, min: 7 }),
  ])],
});

const fg = panels(210, 148, 'vertical', 4);
const familieHerz = Object.assign({}, bF, {
  slug: 'familienfeier-herzgirlande', name: 'Familienfeier – Herzgirlande', variant: 'Herzgirlande', fold: 'vertical',
  description: 'Klappkarte (A6 hoch) mit Herzgirlande auf der Titelseite; innen ein Tagesprogramm von Kaffeetafel bis Abendessen und die Angaben. Der Anlass ist ein Feld.',
  tags: tF('Klappkarte', 'Herzgirlande', 'Herzen', 'Programm', 'Rosa'),
  formatKey: 'card-a6-portrait', width: 210, height: 148,
  pages: foldCard('vertical', [
    T('Zurück', 12, 62, 90, 14, 'Schön, dass es euch gibt!', 'Caveat', 22, '#c2185b', { w: 700, min: 12 }),
    decor([deko('Girlande', 'deko-herzen-girlande-rose', 112, 10, 90)]),
    T('Kopf', 112, 52, 90, 6, 'WIR FEIERN', 'Josefin Sans', 9, '#c2185b', { ls: 0.35, w: 700, min: 7 }),
    T('Anlass', 110, 60, 94, 44, '{{Anlass}}', 'Dancing Script', 30, '#7a1f4a', { w: 700, wrap: true, lh: 1.2, min: 14 }),
    T('Datum', 112, 112, 90, 8, dF, 'Nunito', 11, '#3a1428', { w: 700, min: 8 }),
  ], [
    T('Programm', fg[0].x, 12, fg[0].w, 12, 'Das Programm', 'Dancing Script', 24, '#c2185b', { w: 700, min: 12, lh: 1.2 }),
    ...[['14:00', 'Ankommen, Kaffee und Kuchen'], ['16:00', 'Spiele und Geschichten im Garten'], ['18:00', 'Grillen und Salate'], ['20:00', 'Ausklang am Lagerfeuer']].flatMap(([z, s], i) => [
      T('Zeit ' + (i + 1), fg[0].x, 32 + i * 22, 20, 8, z, 'Nunito', 11, '#c2185b', { a: 'left', w: 800, min: 8 }),
      T('Punkt ' + (i + 1), fg[0].x + 22, 32 + i * 22, fg[0].w - 22, 8, s, 'Nunito', 11, '#3a1428', { a: 'left', w: 600, min: 8 }),
    ]),
    decor([rect('Mitte', 105, 12, 0.4, 124, '#c2185b', { opacity: 0.4 })]),
    ...info('Datum', 114, 24, 84, 'calendar-days', dF, { chip: '#c2185b', ic: '#ffffff', c: '#3a1428', f: 'Nunito', s: 11, w: 700, d: 9 }),
    ...info('Zeit', 114, 40, 84, 'clock', 'ab ' + uhr('14') + ' · Musterweg 5', { chip: '#c2185b', ic: '#ffffff', c: '#3a1428', f: 'Nunito', s: 11, w: 600, d: 9 }),
    ...info('Ort', 114, 56, 84, 'map-pin', 'Garten Familie Muster, Musterstadt', { chip: '#c2185b', ic: '#ffffff', c: '#3a1428', f: 'Nunito', s: 10.5, w: 600, d: 9 }),
    ...info('Zusage', 114, 72, 84, 'phone', 'Zusage bis 29. Mai: 0170 1234567', { chip: '#7a1f4a', ic: '#ffffff', c: '#3a1428', f: 'Nunito', s: 10.5, w: 600, d: 9 }),
  ], '#fff6f9', '#fff6f9'),
});

const familieLicht = Object.assign({}, bF, {
  slug: 'familienfeier-lichter', name: 'Familienfeier – Lichter', variant: 'Lichter', unit: 'px',
  description: 'Instagram-Post auf warmem Abendblau mit Lichterkette: „Zusammen feiern“ und die Angaben zur Familienfeier. Der Anlass ist ein Feld.',
  tags: tF('Lichterkette', 'Instagram', 'Post', 'Social Media', 'Abend', 'Warm'),
  formatKey: 'instagram-post', width: 1080, height: 1080,
  pages: [page(gradient(180, '#27345a', '#3d2a4a'), [
    decor([deko('Lichterkette', 'deko-motive-lichterkette-warm', 20, 40, 1040)]),
    T('Kopf', 60, 330, 960, 56, 'ZUSAMMEN FEIERN', 'Josefin Sans', 26, '#ffd36b', { ls: 0.4, w: 700, min: 15 }),
    T('Anlass', 60, 395, 960, 270, '{{Anlass}}', 'Dancing Script', 84, '#ffffff', { w: 700, wrap: true, lh: 1.15, min: 24 }),
    T('Datum', 60, 680, 960, 64, dF + ' · ' + uhr('14'), 'Nunito', 34, '#ffffff', { w: 800, min: 18 }),
    T('Ort', 60, 752, 960, 56, 'Musterweg 5 · 12345 Musterstadt', 'Nunito', 28, '#ffd36b', { w: 600, min: 15 }),
    T('Zusage', 60, 840, 960, 56, 'Zusage bis 29. Mai: 0170 1234567', 'Nunito', 26, '#ffffff', { w: 600, min: 15 }),
  ])],
});

// ================================================================================================================== Oktoberfest
const bO = base('oktoberfest', 'Oktoberfest');
const tO = (...m) => tags('Oktoberfest', 'Wiesn', 'Bayerisch', 'Tracht', 'Dirndl', 'Lederhose', 'Bier', 'Brezel', 'Einladung', 'Party', 'Prosit', m);
const dO = when(25, 9);
const BLUE = '#2b86d6';

const oktoHerz = Object.assign({}, bO, {
  slug: 'oktoberfest-lebkuchenherz', name: 'Oktoberfest – Lebkuchenherz', variant: 'Lebkuchenherz',
  description: 'Einladung (A6 hoch) zum Oktoberfest: weiß-blaues Rautenband, Lebkuchenherz mit „O’zapft is!“ und Datum, Ort und Hinweis auf Tracht.',
  tags: tO('Lebkuchenherz', 'Rauten', 'Weiß-Blau', 'O’zapft is'),
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [page('#ffffff', [
    decor([
      deko('Rauten oben', 'deko-motive-rautenband', 0, 0, 105),
      deko('Rauten unten', 'deko-motive-rautenband', 0, 137, 105),
      dekoIn('Herz', 'deko-motive-lebkuchenherz-guss', 20, 14, 65, 68),
    ]),
    T('Herz', 29, 42, 47, 18, 'O’zapft is!', 'Abril Fatface', 17, '#fffdf6', { min: 9 }),
    T('Titel', 6, 84, 93, 18, 'Oktoberfest', 'Abril Fatface', 31, '#1f5fa8', { min: 16 }),
    T('Sub', 8, 102, 89, 7, 'Bier, Brezn und Blasmusik', 'Nunito', 10.5, '#5a2a22', { w: 700, min: 8 }),
    T('Datum', 8, 112, 89, 7, dO + ' · ' + uhr('17'), 'Nunito', 10.5, '#1f5fa8', { w: 800, min: 8 }),
    T('Ort', 8, 120, 89, 7, 'Festzelt Musterwiese · Musterweg 5', 'Nunito', 9.5, '#3a3a3a', { w: 600, min: 8 }),
    T('Zusage', 8, 128, 89, 7, 'Tracht erwünscht · Zusage bis 18. September', 'Nunito', 8.5, '#5a2a22', { w: 700, min: 7 }),
  ])],
});

const oktoBrezel = Object.assign({}, bO, {
  slug: 'oktoberfest-brezel', name: 'Oktoberfest – Brezel', variant: 'Brezel',
  description: 'Hohe Einladung (DIN lang) mit Brezel und Bierkrug zwischen zwei weiß-blauen Rautenbändern; „Prosit!“ in großer Schrift und Hinweis auf Tracht.',
  tags: tO('Brezel', 'Bierkrug', 'Prosit', 'DIN lang', 'Rautenband'),
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  pages: [page('#fdf8ec', [
    decor([
      deko('Rauten oben', 'deko-motive-rautenband', 0, 0, 99), deko('Rauten unten', 'deko-motive-rautenband', 0, 199, 99),
      dekoIn('Brezel', 'deko-motive-brezel-salz', 8, 20, 83, 60), dekoIn('Bierkrug', 'deko-motive-bierkrug-bunt', 56, 74, 36, 40),
    ]),
    T('Prosit', 6, 82, 55, 26, 'Prosit!', 'Abril Fatface', 36, '#1f5fa8', { a: 'left', min: 16 }),
    T('Titel', 8, 116, 83, 14, 'Oktoberfest', 'Abril Fatface', 28, '#5a2a22', { min: 14 }),
    T('Sub', 8, 131, 83, 8, 'Tracht, Bier und gute Laune', 'Nunito', 11, '#5a2a22', { w: 700, min: 8 }),
    T('Datum', 8, 148, 83, 8, dO, 'Nunito', 11.5, '#1f5fa8', { w: 800, min: 8 }),
    T('Zeit', 8, 157, 83, 8, 'ab ' + uhr('17') + ' · Festzelt Musterwiese', 'Nunito', 10.5, '#3a3a3a', { w: 600, min: 8 }),
    T('Ort', 8, 166, 83, 8, 'Musterweg 5 · 12345 Musterstadt', 'Nunito', 10.5, '#3a3a3a', { w: 600, min: 8 }),
    T('Zusage', 8, 180, 83, 8, 'Zusage bis 18. September', 'Nunito', 10.5, '#5a2a22', { w: 800, min: 8 }),
  ])],
});

const oktoPost = Object.assign({}, bO, {
  slug: 'oktoberfest-wiesn-post', name: 'Oktoberfest – Wiesn', variant: 'Wiesn', unit: 'px',
  description: 'Instagram-Post auf Himmelblau mit riesigem Lebkuchenherz: „Einladung zum Oktoberfest“ im Herz, darunter Datum, Zelt und Zusage.',
  tags: tO('Instagram', 'Post', 'Social Media', 'Lebkuchenherz', 'Himmelblau', 'Wiesn'),
  formatKey: 'instagram-post', width: 1080, height: 1080,
  pages: [page(BLUE, [
    decor([
      deko('Rauten', 'deko-motive-rautenband', 0, 0, 1080), deko('Rauten unten', 'deko-motive-rautenband', 0, 940, 1080),
      dekoIn('Herz', 'deko-motive-lebkuchenherz-guss', 190, 110, 700, 640),
    ]),
    T('Kopf', 340, 392, 400, 40, 'EINLADUNG ZUM', 'Josefin Sans', 15, '#fffdf6', { ls: 0.3, w: 700, min: 14 }),
    T('Titel', 350, 432, 380, 80, 'Oktoberfest', 'Abril Fatface', 30, '#fffdf6', { min: 24 }),
    T('Datum', 60, 760, 960, 64, dO + ' · ab ' + uhr('17'), 'Nunito', 34, '#ffffff', { w: 800, min: 18 }),
    T('Ort', 60, 828, 960, 56, 'Festzelt Musterwiese · Musterweg 5', 'Nunito', 28, '#ffffff', { w: 600, min: 15 }),
    T('Zusage', 60, 890, 960, 40, 'Tracht erwünscht · Zusage bis 18. September', 'Nunito', 22, '#ffe58a', { w: 700, min: 15 }),
  ])],
});

// ================================================================================================================== Fasching / Karneval
const bFa = base('fasching-karneval', 'Fasching und Karneval');
const tFa = (...m) => tags('Fasching', 'Karneval', 'Fastnacht', 'Kostümparty', 'Maskenball', 'Verkleidung', 'Einladung', 'Narren', 'Konfetti', 'Party', 'Helau', m);
const dFa = when(26, 2);

const faschingMaske = Object.assign({}, bFa, {
  slug: 'fasching-karneval-maskenball', name: 'Fasching – Maskenball', variant: 'Maskenball',
  description: 'Geheimnisvolle Einladung (A6 hoch) zum Maskenball: venezianische Maske mit Federn auf Nachtviolett, goldene Schrift und Konfetti.',
  tags: tFa('Venezianisch', 'Maske', 'Maskenball', 'Violett', 'Gold'),
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [page(gradient(180, '#2a1050', '#4a1f78'), [
    sprinkle('Konfetti', 821, [3, 3, 99, 142], { n: 24, avoid: [[8, 70, 89, 70]], colors: ['#e3c479', '#ff4f8b', '#2fd0e6'], kinds: ['dot', 'bar', 'star', 'spark'], size: [2, 4] }),
    decor([dekoIn('Maske', 'deko-motive-maske', 12, 16, 81, 46), deko('Trenner', 'deko-trenner-deco-gold', 28, 104, 49)]),
    T('Kopf', 8, 66, 89, 7, 'EINE NACHT UNTER MASKEN', 'Cinzel', 8.5, '#e3c479', { ls: 0.2, min: 7 }),
    T('Titel', 6, 74, 93, 22, 'Maskenball', 'Great Vibes', 40, '#ffffff', { min: 20, lh: 1.3 }),
    T('Datum', 8, 110, 89, 7, dFa + ' · ' + uhr('20'), 'Cinzel', 9.5, '#ffffff', { min: 7 }),
    T('Ort', 8, 118, 89, 7, 'Festsaal Musterhof · Musterweg 5', 'Cormorant Garamond', 12, '#e3c479', { w: 600, min: 8 }),
    T('Zusage', 8, 127, 89, 7, 'Maske Pflicht · Zusage bis 12. Februar', 'Cormorant Garamond', 11, '#ffffff', { i: true, w: 600, min: 8 }),
  ])],
});

const faschingNarr = Object.assign({}, bFa, {
  slug: 'fasching-karneval-narrenkappe', name: 'Fasching – Narrenkappe', variant: 'Narrenkappe',
  description: 'Fröhliche Einladung (DIN lang) mit Narrenkappe, Luftschlangen und Konfetti; „Helau!“ groß, darunter Kostümparty-Angaben in Rot, Blau und Gelb.',
  tags: tFa('Narrenkappe', 'Luftschlangen', 'Bunt', 'DIN lang', 'Kostümparty', 'Schellen'),
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  pages: [page('#fff6dc', [
    decor([
      deko('Schlangen', 'deko-konfetti-luftschlangen-bunt', 0, 0, 99),
      dekoIn('Kappe', 'deko-motive-narrenkappe', 10, 36, 79, 64),
    ]),
    T('Helau', 6, 104, 87, 24, 'Helau!', 'Abril Fatface', 42, '#e5283c', { min: 20 }),
    T('Titel', 8, 128, 83, 11, 'Kostümparty', 'Fredoka', 20, '#2358c9', { w: 700, min: 10 }),
    T('Datum', 8, 142, 83, 8, dFa, 'Fredoka', 11, '#1d1a3a', { w: 600, min: 8 }),
    T('Zeit', 8, 151, 83, 8, 'ab ' + uhr('19:11'), 'Fredoka', 11, '#1d1a3a', { w: 500, min: 8 }),
    T('Ort', 8, 160, 83, 8, 'Vereinsheim · Musterweg 5', 'Fredoka', 10.5, '#1d1a3a', { w: 500, min: 8 }),
    T('Zusage', 8, 175, 83, 8, 'Kostüm Pflicht · Zusage bis 12. Februar', 'Fredoka', 9.5, '#e5283c', { w: 600, min: 8 }),
  ])],
});

const faschingStory = Object.assign({}, bFa, {
  slug: 'fasching-karneval-konfetti', name: 'Fasching – Konfetti', variant: 'Konfetti', unit: 'px',
  description: 'Story-Einladung zur Faschingsparty: leuchtender Verlauf, Maske, Narrenkappe und Konfettiregen mit großem Titel „Fasching“.',
  tags: tFa('Story', 'Instagram', 'Social Media', 'Konfettiregen', 'Maske', 'Narrenkappe'),
  formatKey: 'instagram-story', width: 1080, height: 1920,
  pages: [page(gradient(180, '#7a2fb5', '#e5283c'), [
    decor([
      deko('Konfetti', 'deko-konfetti-streuung-bunt', 0, 0, 1080),
      dekoIn('Narrenkappe', 'deko-motive-narrenkappe', 140, 200, 800, 560),
      dekoIn('Maske', 'deko-motive-maske', 200, 1190, 680, 320),
    ]),
    T('Titel', 60, 850, 960, 200, 'Fasching', 'Abril Fatface', 100, '#ffffff', { shadow: shadow('#3a0f5a', 0.9, 0, 6, 6), min: 40 }),
    T('Sub', 60, 1050, 960, 80, 'Die große Kostümparty', 'Fredoka', 40, '#ffd23f', { w: 700, min: 20 }),
    T('Datum', 60, 1520, 960, 70, dFa + ' · ' + uhr('19:11'), 'Fredoka', 34, '#ffffff', { w: 700, min: 18 }),
    T('Ort', 60, 1600, 960, 60, 'Vereinsheim · Musterweg 5 · Musterstadt', 'Fredoka', 28, '#ffffff', { w: 500, min: 15 }),
    T('Zusage', 60, 1690, 960, 60, 'Kostüm Pflicht · Zusage bis 12. Februar', 'Fredoka', 26, '#ffd23f', { w: 600, min: 15 }),
  ])],
});

// ================================================================================================================== Gartenparty
const bG = base('gartenparty', 'Gartenparty');
const tG = (...m) => tags('Gartenparty', 'Garten', 'Sommerfest', 'Party', 'Einladung', 'Grillen', 'Terrasse', 'Draußen', 'Sommer', 'Feier', m);
const dG = when(10, 7);

const gartenDaemmer = Object.assign({}, bG, {
  slug: 'gartenparty-daemmerung', name: 'Gartenparty – Dämmerung', variant: 'Dämmerung',
  description: 'Einladung (A6 hoch) für einen lauen Abend im Garten: Lichterkette über dunklem Grün, Blumenwiese am Fuß der Karte und Schrift in Gelb und Weiß.',
  tags: tG('Lichterkette', 'Dämmerung', 'Abend', 'Blumenwiese', 'Dunkelgrün'),
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [page(gradient(180, '#1f3a2c', '#2f4a37'), [
    decor([deko('Lichterkette', 'deko-motive-lichterkette-warm', 0, 4, 105), dekoIn('Wiese', 'deko-blumen-wiese', 0, 108, 105, 40, { valign: 'bottom' })]),
    T('Kopf', 8, 34, 89, 7, 'EIN LAUER ABEND IM GARTEN', 'Josefin Sans', 8.5, '#ffd36b', { ls: 0.3, w: 700, min: 7 }),
    T('Titel', 6, 42, 93, 22, 'Gartenparty', 'Pacifico', 32, '#ffffff', { min: 16, lh: 1.5 }),
    T('Datum', 8, 70, 89, 7, dG + ' · ' + uhr('18'), 'Nunito', 10.5, '#ffffff', { w: 800, min: 8 }),
    T('Ort', 8, 78, 89, 7, 'Garten Familie Muster · Musterweg 5', 'Nunito', 9.5, '#ffd36b', { w: 600, min: 8 }),
    T('Zusage', 8, 86, 89, 7, 'Zusage bis 3. Juli · Salat oder Dessert mitbringen', 'Nunito', 8.5, '#ffffff', { w: 600, min: 7 }),
  ])],
});

const gp = panels(210, 148, 'vertical', 4);
const gartenKranz = Object.assign({}, bG, {
  slug: 'gartenparty-blumenkranz', name: 'Gartenparty – Blumenkranz', variant: 'Blumenkranz', fold: 'vertical',
  description: 'Klappkarte (A6 hoch) mit Blumenkranz auf der Titelseite; innen eine freundliche Einladung mit Hinweisen zum Mitbringen und allen Angaben.',
  tags: tG('Klappkarte', 'Blumenkranz', 'Pastell', 'Blumen', 'Freundlich'),
  formatKey: 'card-a6-portrait', width: 210, height: 148,
  pages: foldCard('vertical', [
    T('Zurück', 12, 62, 90, 14, 'Wir freuen uns auf euch!', 'Caveat', 22, '#5f7f66', { w: 700, min: 12 }),
    decor([dekoIn('Kranz', 'deko-blumen-blumenkranz', 114, 12, 86, 86)]),
    T('Titel', 120, 44, 74, 16, 'Garten-', 'Pacifico', 22, '#2f4a37', { min: 12, lh: 1.5 }),
    T('Titel 2', 120, 58, 74, 16, 'party', 'Pacifico', 22, '#2f4a37', { min: 12, lh: 1.5 }),
    T('Datum', 112, 106, 90, 8, dG, 'Nunito', 11, '#2f4a37', { w: 800, min: 8 }),
  ], [
    T('Titel', fg2().x, 14, fg2().w, 12, 'Kommt vorbei!', 'Pacifico', 20, '#5f7f66', { min: 12, lh: 1.4 }),
    P('Text', fg2().x, 30, fg2().w, 64, 'Wir feiern den Sommer: mit Grill, kalten Getränken und Musik bis in die Dämmerung. Bringt gern einen Salat oder ein Dessert mit, Getränke und Würstchen gibt es bei uns. Gartenstühle sind erwünscht!', 'Nunito', 11.5, '#3a3a3a', { a: 'left', lh: 1.45, min: 8 }),
    decor([rect('Mitte', 105, 12, 0.4, 124, '#5f7f66', { opacity: 0.5 })]),
    ...info('Datum', 114, 24, 84, 'calendar-days', dG, { chip: '#5f7f66', ic: '#ffffff', c: '#2a2a2a', f: 'Nunito', s: 11, w: 700, d: 9 }),
    ...info('Zeit', 114, 40, 84, 'clock', 'ab ' + uhr('18') + ' bis in die Nacht', { chip: '#5f7f66', ic: '#ffffff', c: '#2a2a2a', f: 'Nunito', s: 11, w: 600, d: 9 }),
    ...info('Ort', 114, 56, 84, 'map-pin', 'Garten Familie Muster, Musterweg 5', { chip: '#e8a0b4', ic: '#ffffff', c: '#2a2a2a', f: 'Nunito', s: 10.5, w: 600, d: 9 }),
    ...info('Zusage', 114, 72, 84, 'phone', 'Zusage bis 3. Juli: 0170 1234567', { chip: '#e8a0b4', ic: '#ffffff', c: '#2a2a2a', f: 'Nunito', s: 10.5, w: 600, d: 9 }),
  ], '#fbf9f0', '#fbf9f0'),
});

const gartenWimpel = Object.assign({}, bG, {
  slug: 'gartenparty-wimpel', name: 'Gartenparty – Wimpel', variant: 'Wimpel', unit: 'px',
  description: 'Bunter Instagram-Post mit Wimpelkette und Blumenwiese: „Sommer im Garten“ in großer Schrift, darunter Datum, Ort und Zusage.',
  tags: tG('Wimpelkette', 'Instagram', 'Post', 'Social Media', 'Bunt', 'Blumenwiese'),
  formatKey: 'instagram-post', width: 1080, height: 1080,
  pages: [page(gradient(180, '#bfe9ff', '#fff6dc'), [
    decor([deko('Wimpel', 'deko-konfetti-wimpelkette-bunt', 0, 20, 1080), dekoIn('Wiese', 'deko-blumen-wiese', 0, 720, 1080, 360, { valign: 'bottom' })]),
    T('Titel', 60, 330, 960, 120, 'Sommer im Garten', 'Pacifico', 60, '#d8386b', { min: 30, lh: 1.5 }),
    T('Datum', 60, 470, 960, 64, dG + ' · ab ' + uhr('18'), 'Nunito', 34, '#1f3a2c', { w: 800, min: 18 }),
    T('Ort', 60, 540, 960, 56, 'Garten Familie Muster · Musterweg 5', 'Nunito', 28, '#1f3a2c', { w: 600, min: 15 }),
    T('Zusage', 60, 610, 960, 56, 'Zusage bis 3. Juli · Salat oder Dessert mitbringen', 'Nunito', 24, '#d8386b', { w: 700, min: 15 }),
  ])],
});

function fg2() { return gp[0]; }

module.exports = { templates: [familieRanke, familieHerz, familieLicht, oktoHerz, oktoBrezel, oktoPost, faschingMaske, faschingNarr, faschingStory, gartenDaemmer, gartenKranz, gartenWimpel] };
