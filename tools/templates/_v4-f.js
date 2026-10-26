/* Families of batch V4, part F: Runder Geburtstag (Party), Firmenfeier, Grill & Chill, Filmabend, Mädelsabend. */
'use strict';
const { D, when, uhr, decor, T, P, info, infoRows, sprinkle, tags } = require('./_v4-lib');
const { gingham } = require('./_t2b-lib');
const { text, rect, ellipse, line, icon, shape, frame, deko, dekoIn, dekoWindow, page, gradient, shadow, field } = D;

const base = (family, familyName, extra = {}) => Object.assign({ category: 'Einladungen', family, familyName, occasion: 'Feste & Events', unit: 'mm' }, extra);

// ================================================================================================================== Runder Geburtstag
const RF = [field('Alter', 'Alter', 'text', '40'), field('Name', 'Name', 'text', 'Katrin')];
const RRows = [{ Alter: '40', Name: 'Katrin' }, { Alter: '30', Name: 'Maximilian' }, { Alter: '50', Name: 'Dr. Maximiliane Schneider' }];
const bR = base('runder-geburtstag-party', 'Runder Geburtstag – Party', { occasion: 'Geburtstag', fields: RF, sampleRows: RRows });
const tR = (...m) => tags('Runder Geburtstag', 'Geburtstag', 'Party', 'Einladung', '30', '40', '50', 'Zahl', 'Feier', 'Jubiläum', 'Geburtstagsparty', m);
const dR = when(13, 11);

const rundGold = Object.assign({}, bR, {
  slug: 'runder-geburtstag-party-gold', name: 'Runder Geburtstag – Gold', variant: 'Gold',
  description: 'Festliche Einladung (A6 hoch) zum runden Geburtstag: riesige goldene Zahl auf Schwarz, Sektgläser und Goldkonfetti. Alter und Name sind Felder.',
  tags: tR('Gold', 'Schwarz', 'Sekt', 'Elegant', 'Konfetti'),
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [page('#0e0e12', [
    sprinkle('Konfetti', 831, [3, 3, 99, 142], { n: 30, avoid: [[8, 8, 89, 130]], colors: ['#d4af6a', '#f3e8d0', '#e3c479'], kinds: ['dot', 'bar', 'star', 'spark'], size: [1.8, 3.6] }),
    decor([dekoIn('Sekt', 'deko-motive-sektglaeser-bunt', 38, 100, 29, 34)]),
    T('Kopf', 8, 12, 89, 7, 'ICH WERDE', 'Cinzel', 10, '#d4af6a', { ls: 0.4, min: 7 }),
    T('Zahl', 6, 20, 93, 52, '{{Alter}}', 'Playfair Display', 96, '#d4af6a', { w: 700, min: 40, lh: 1.1 }),
    T('Sub', 8, 74, 89, 10, 'und das feiern wir!', 'Great Vibes', 22, '#f3e8d0', { min: 12, lh: 1.3 }),
    T('Name', 8, 86, 89, 8, 'Eure {{Name}}', 'Cinzel', 12, '#ffffff', { ls: 0.1, min: 7 }),
    T('Datum', 8, 96, 89, 6, dR + ' · ' + uhr('19'), 'Cormorant Garamond', 12, '#f3e8d0', { w: 600, min: 8 }),
    T('Ort', 8, 136, 89, 6, 'Musterweg 5 · 12345 Musterstadt · Zusage bis 30. Oktober', 'Cormorant Garamond', 10, '#d4af6a', { w: 600, i: true, min: 8 }),
  ])],
});

const rundBunt = Object.assign({}, bR, {
  slug: 'runder-geburtstag-party-ballons', name: 'Runder Geburtstag – Ballons', variant: 'Ballons', unit: 'px',
  description: 'Bunter Instagram-Post zum runden Geburtstag: Luftballons, eine riesige weiße Zahl auf Verlauf von Pink zu Orange und die Angaben zur Party. Alter und Name sind Felder.',
  tags: tR('Ballons', 'Instagram', 'Post', 'Social Media', 'Bunt', 'Pink'),
  formatKey: 'instagram-post', width: 1080, height: 1080,
  pages: [page(gradient(160, '#ff4f8b', '#ff9a3d'), [
    decor([dekoIn('Ballons', 'deko-konfetti-ballons-fuenf-bunt', 40, 40, 1000, 440)]),
    T('Zahl', 60, 380, 960, 330, '{{Alter}}', 'Righteous', 210, '#ffffff', { shadow: shadow('#7a1f4a', 0.5, 0, 8, 8), min: 80, lh: 1.05 }),
    T('Name', 60, 700, 960, 80, '{{Name}} lädt zur Party', 'Poppins', 32, '#ffffff', { w: 700, min: 18 }),
    T('Datum', 60, 800, 960, 60, dR + ' · ab ' + uhr('19'), 'Poppins', 30, '#3a1428', { w: 700, min: 18 }),
    T('Ort', 60, 868, 960, 56, 'Musterweg 5 · 12345 Musterstadt', 'Poppins', 26, '#3a1428', { w: 500, min: 15 }),
    T('Zusage', 60, 938, 960, 56, 'Zusage bis 30. Oktober: 0170 1234567', 'Poppins', 24, '#ffffff', { w: 600, min: 15 }),
  ])],
});

const rundSterne = Object.assign({}, bR, {
  slug: 'runder-geburtstag-party-sterne', name: 'Runder Geburtstag – Sterne', variant: 'Sterne',
  description: 'Hohe Einladung (DIN lang) auf Nachtblau: riesige Zahl im Sternenhimmel, „feiert“ in Schreibschrift und alle Angaben zur Geburtstagsparty. Alter und Name sind Felder.',
  tags: tR('Sterne', 'Nachtblau', 'DIN lang', 'Himmel', 'Gold'),
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  pages: [page(gradient(180, '#14233b', '#27345a'), [
    decor([
      dekoIn('Sterne', 'deko-sterne-himmel-gold', 4, 6, 91, 70),
      deko('Trenner', 'deko-trenner-sterne-gold', 25, 128, 49),
    ]),
    T('Zahl', 6, 36, 87, 60, '{{Alter}}', 'Playfair Display', 120, '#e3c479', { w: 700, min: 40, lh: 1.1 }),
    T('Name', 8, 98, 83, 12, '{{Name}}', 'Great Vibes', 28, '#ffffff', { min: 14, lh: 1.3 }),
    T('Sub', 8, 110, 83, 14, 'feiert Geburtstag!', 'Great Vibes', 24, '#e3c479', { min: 12, lh: 1.3 }),
    T('Datum', 8, 140, 83, 8, dR, 'Cinzel', 10.5, '#ffffff', { min: 7 }),
    T('Zeit', 8, 149, 83, 8, 'ab ' + uhr('19'), 'Cormorant Garamond', 14, '#e3c479', { w: 600, min: 8 }),
    T('Ort', 8, 158, 83, 8, 'Musterweg 5 · 12345 Musterstadt', 'Cormorant Garamond', 12, '#ffffff', { w: 600, min: 8 }),
    T('Zusage', 8, 172, 83, 8, 'Zusage bis 30. Oktober', 'Cormorant Garamond', 12, '#e3c479', { i: true, w: 600, min: 8 }),
    T('Tel', 8, 180, 83, 8, '0170 1234567', 'Cormorant Garamond', 12, '#e3c479', { i: true, w: 600, min: 8 }),
  ])],
});

// ================================================================================================================== Firmenfeier
const FiF = [field('Firma', 'Firma', 'text', 'Muster GmbH')];
const FiRows = [{ Firma: 'Muster GmbH' }, { Firma: 'Schneider & Söhne Metallbau' }, { Firma: 'Atelier Neun' }];
const bFi = base('firmenfeier', 'Firmenfeier', { occasion: 'Business', fields: FiF, sampleRows: FiRows });
const tFi = (...m) => tags('Firmenfeier', 'Betriebsfeier', 'Firma', 'Team', 'Mitarbeiter', 'Einladung', 'Sommerfest', 'Jubiläum', 'Business', 'Event', m);
const dFi = when(2, 7);
const NAVYF = '#14233b';

const firmaGala = Object.assign({}, bFi, {
  slug: 'firmenfeier-gala', name: 'Firmenfeier – Gala', variant: 'Gala',
  description: 'Festliche Einladung (DIN lang) zur Firmenfeier: Marineblau mit Gold, Sektgläser, Zierlinien und die Firma als Feld.',
  tags: tFi('Gala', 'Festlich', 'Marineblau', 'Gold', 'Sekt', 'DIN lang'),
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  pages: [page(NAVYF, [
    decor([
      dekoIn('Rahmen', 'deko-rahmen-doppellinie-lang-gold', 4, 4, 91, 202),
      dekoIn('Sekt', 'deko-motive-sektglaeser-bunt', 30, 22, 39, 46),
      deko('Trenner', 'deko-trenner-deco-gold', 25, 138, 49),
    ]),
    T('Kopf', 10, 76, 79, 7, '{{Firma}} LÄDT EIN', 'Cinzel', 8, '#e3c479', { ls: 0.2, min: 6.5 }),
    T('Titel', 8, 84, 83, 28, 'Firmenfeier', 'Playfair Display', 25, '#ffffff', { w: 700, i: true, min: 12 }),
    T('Sub', 10, 114, 79, 14, 'Ein Abend für das ganze Team: Essen, Musik und Zeit zum Anstoßen.', 'Cormorant Garamond', 11, '#f3e8d0', { w: 600, wrap: true, v: 'top', lh: 1.3, min: 8 }),
    T('Datum', 8, 148, 83, 8, dFi, 'Cinzel', 10.5, '#ffffff', { min: 7 }),
    T('Zeit', 8, 157, 83, 8, 'ab ' + uhr('18'), 'Cormorant Garamond', 14, '#e3c479', { w: 600, min: 8 }),
    T('Ort', 8, 166, 83, 8, 'Eventlocation Musterhof · Musterweg 5', 'Cormorant Garamond', 11.5, '#ffffff', { w: 600, min: 8 }),
    T('Zusage', 8, 180, 83, 8, 'Zusage bis 18. Juni an das Büro', 'Cormorant Garamond', 11.5, '#e3c479', { i: true, w: 600, min: 8 }),
  ])],
});

const firmaBlock = Object.assign({}, bFi, {
  slug: 'firmenfeier-farbblock', name: 'Firmenfeier – Farbblock', variant: 'Farbblock',
  description: 'Klare Einladung (A5 quer) mit türkisem Farbblock links und Angaben mit Symbolen rechts; ruhig, modern und auf jede Firma anpassbar. Die Firma ist ein Feld.',
  tags: tFi('Farbblock', 'Modern', 'Türkis', 'A5 quer', 'Sauber', 'Symbole'),
  formatKey: 'a5-landscape', width: 210, height: 148,
  pages: [page('#ffffff', [
    decor([
      rect('Block', 0, 0, 84, 148, '#0f7c8a'),
      icon('Sektglas', 'wine', 12, 14, 18, '#ffffff', 1.5),
    ]),
    T('Kopf', 12, 40, 62, 8, '{{Firma}}', 'Montserrat', 10, '#c8f2f0', { a: 'left', w: 700, ls: 0.05, min: 7 }),
    T('Titel', 12, 50, 66, 52, 'Unsere Firmenfeier', 'Montserrat', 26, '#ffffff', { a: 'left', w: 800, wrap: true, v: 'top', lh: 1.15, min: 12 }),
    T('Sub', 12, 112, 66, 22, 'Danke für ein starkes Jahr – lasst uns gemeinsam feiern.', 'Montserrat', 9.5, '#ffffff', { a: 'left', w: 500, wrap: true, v: 'top', lh: 1.35, min: 7 }),
    ...info('Datum', 100, 28, 100, 'calendar-days', dFi, { chip: '#0f7c8a', ic: '#ffffff', c: '#14233b', f: 'Montserrat', s: 12, w: 700, d: 11 }),
    ...info('Zeit', 100, 50, 100, 'clock', 'ab ' + uhr('18') + ' · Einlass 17:30 Uhr', { chip: '#0f7c8a', ic: '#ffffff', c: '#14233b', f: 'Montserrat', s: 12, w: 600, d: 11 }),
    ...info('Ort', 100, 72, 100, 'map-pin', 'Eventlocation Musterhof, Musterweg 5', { chip: '#0f7c8a', ic: '#ffffff', c: '#14233b', f: 'Montserrat', s: 11.5, w: 600, d: 11 }),
    ...info('Zusage', 100, 94, 100, 'mail', 'Zusage bis 18. Juni: feier@muster.de', { chip: '#e8651a', ic: '#ffffff', c: '#14233b', f: 'Montserrat', s: 11.5, w: 600, d: 11 }),
    T('Hinweis', 100, 122, 100, 14, 'Familie und Partner sind herzlich willkommen.', 'Montserrat', 9.5, '#5a6a7a', { a: 'left', w: 500, i: true, min: 7 }),
  ])],
});

const firmaFolie = Object.assign({}, bFi, {
  slug: 'firmenfeier-praesentation', name: 'Firmenfeier – Präsentation', variant: 'Präsentation', unit: 'px',
  description: 'Einladung als Bildschirmfolie (1920 x 1080 px) für Intranet, Bildschirm im Flur oder Bildschirmpräsentation: großer Titel, Farbband und die Angaben in drei Spalten.',
  tags: tFi('Präsentation', 'Folie', 'Bildschirm', 'Intranet', '16:9', 'Digital'),
  formatKey: 'presentation', width: 1920, height: 1080,
  pages: [page(gradient(135, '#0f7c8a', '#14233b'), [
    decor([
      rect('Band', 100, 560, 160, 10, '#e8651a', { radius: 5 }),
      icon('Sektglas', 'wine', 1520, 150, 220, '#ffffff', 1.2),
    ]),
    T('Kopf', 100, 120, 1100, 70, '{{Firma}} LÄDT EIN', 'Montserrat', 30, '#c8f2f0', { a: 'left', w: 700, ls: 0.2, min: 18 }),
    T('Titel', 100, 210, 1300, 320, 'Unsere Firmenfeier', 'Montserrat', 100, '#ffffff', { a: 'left', w: 800, wrap: true, v: 'top', lh: 1.1, min: 40 }),
    T('Datum', 100, 640, 560, 70, 'Wann', 'Montserrat', 26, '#9fd9d6', { a: 'left', w: 700, min: 15 }),
    T('Datum 2', 100, 700, 560, 140, dFi + '\nab ' + uhr('18'), 'Montserrat', 30, '#ffffff', { a: 'left', w: 600, wrap: true, v: 'top', lh: 1.3, min: 18 }),
    T('Ort', 720, 640, 560, 70, 'Wo', 'Montserrat', 26, '#9fd9d6', { a: 'left', w: 700, min: 15 }),
    T('Ort 2', 720, 700, 560, 140, 'Eventlocation Musterhof\nMusterweg 5', 'Montserrat', 30, '#ffffff', { a: 'left', w: 600, wrap: true, v: 'top', lh: 1.3, min: 18 }),
    T('Zusage', 1340, 640, 480, 70, 'Zusage', 'Montserrat', 26, '#9fd9d6', { a: 'left', w: 700, min: 15 }),
    T('Zusage 2', 1340, 700, 480, 140, 'bis 18. Juni\nfeier@muster.de', 'Montserrat', 30, '#ffffff', { a: 'left', w: 600, wrap: true, v: 'top', lh: 1.3, min: 18 }),
  ])],
});

// ================================================================================================================== Grill & Chill
const bGr = base('grill-und-chill', 'Grill & Chill');
const tGr = (...m) => tags('Grillen', 'Grillparty', 'Grill', 'Chillen', 'Barbecue', 'BBQ', 'Einladung', 'Sommer', 'Würstchen', 'Draußen', m);
const dGr = when(31, 7);

const grillKreide = Object.assign({}, bGr, {
  slug: 'grill-und-chill-kreide', name: 'Grill & Chill – Kreide', variant: 'Kreide',
  description: 'Einladung (A6 hoch) auf Tafelschwarz: Kugelgrill mit Würstchen, orange Flamme und Schrift wie mit Kreide geschrieben.',
  tags: tGr('Kreide', 'Tafel', 'Schwarz', 'Orange', 'Kugelgrill'),
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [page('#202225', [
    decor([
      rect('Rahmen', 4, 4, 97, 140, null, { stroke: '#ffffff', sw: 0.8, opacity: 0.35, dash: [2, 2], radius: 2 }),
      dekoIn('Grill', 'deko-motive-grill', 22, 12, 61, 58),
    ]),
    T('Titel', 8, 74, 89, 18, 'GRILL & CHILL', 'Permanent Marker', 26, '#ffffff', { min: 14 }),
    T('Sub', 8, 93, 89, 8, 'Würstchen, Salat und kühle Getränke', 'Caveat', 16, '#ffb14a', { w: 600, min: 9 }),
    T('Datum', 8, 106, 89, 7, dGr + ' · ab ' + uhr('17'), 'Caveat', 17, '#ffffff', { w: 700, min: 9 }),
    T('Ort', 8, 114, 89, 7, 'Garten Familie Muster · Musterweg 5', 'Caveat', 15, '#ffffff', { w: 500, min: 9 }),
    T('Zusage', 8, 124, 89, 7, 'Zusage bis 24. Juli · Hunger mitbringen!', 'Caveat', 15, '#ffb14a', { w: 600, min: 9 }),
  ])],
});

const grillKraft = Object.assign({}, bGr, {
  slug: 'grill-und-chill-kraftpapier', name: 'Grill & Chill – Kraftpapier', variant: 'Kraftpapier', unit: 'px',
  description: 'Instagram-Post im Kraftpapier-Look: Grill und Flamme, „Grill & Chill“ in dicker Handschrift und alle Angaben zum Grillabend.',
  tags: tGr('Kraftpapier', 'Instagram', 'Post', 'Social Media', 'Braun', 'Rustikal'),
  formatKey: 'instagram-post', width: 1080, height: 1080,
  pages: [page('#d9b98c', [
    decor([
      rect('Rand', 40, 40, 1000, 1000, null, { stroke: '#5a3a1a', sw: 3, dash: [8, 6], radius: 12 }),
      dekoIn('Grill', 'deko-motive-grill', 700, 110, 270, 270), dekoIn('Flamme', 'deko-motive-flamme-rot', 120, 130, 140, 200),
    ]),
    T('Kopf', 120, 80, 520, 50, 'EINLADUNG ZUM', 'Permanent Marker', 22, '#5a3a1a', { a: 'left', min: 14 }),
    T('Titel', 80, 400, 920, 180, 'Grill & Chill', 'Permanent Marker', 84, '#2b1a0a', { min: 36 }),
    T('Datum', 80, 640, 920, 70, dGr + ' · ab ' + uhr('17'), 'Caveat', 44, '#2b1a0a', { w: 700, min: 22 }),
    T('Ort', 80, 720, 920, 60, 'Garten Familie Muster · Musterweg 5', 'Caveat', 38, '#2b1a0a', { w: 600, min: 20 }),
    T('Zusage', 80, 860, 920, 60, 'Zusage bis 24. Juli · Hunger mitbringen!', 'Caveat', 36, '#a2380f', { w: 700, min: 20 }),
  ])],
});

const grillKaro = Object.assign({}, bGr, {
  slug: 'grill-und-chill-karo', name: 'Grill & Chill – Karo', variant: 'Karo',
  description: 'Hohe Einladung (DIN lang) mit rot-weißem Karoband wie eine Picknickdecke, Flamme und Würstchen-Schrift; für gemütliche Grillabende im Garten.',
  tags: tGr('Karo', 'Picknick', 'Rot-Weiß', 'DIN lang', 'Flamme'),
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  pages: [page('#fffaf0', [
    gingham('Karo oben', 0, 0, 99, 40, 5, '#d8283c', '#ffffff'),
    gingham('Karo unten', 0, 192, 99, 18, 5, '#d8283c', '#ffffff'),
    decor([dekoIn('Flamme', 'deko-motive-flamme-rot', 34, 48, 31, 44), dekoIn('Grill', 'deko-motive-grill', 20, 98, 59, 52)]),
    T('Titel', 6, 148, 87, 14, 'Grill & Chill', 'Righteous', 26, '#d8283c', { min: 14 }),
    T('Datum', 8, 163, 83, 8, dGr + ' · ' + uhr('17'), 'Nunito', 10.5, '#2b1a0a', { w: 800, min: 8 }),
    T('Ort', 8, 172, 83, 8, 'Musterweg 5 · 12345 Musterstadt', 'Nunito', 10, '#2b1a0a', { w: 600, min: 8 }),
    T('Zusage', 8, 180, 83, 8, 'Zusage bis 24. Juli', 'Nunito', 10, '#d8283c', { w: 800, min: 8 }),
  ])],
});

// ================================================================================================================== Filmabend
const FiL = [field('Film', 'Film', 'text', 'Eine Nacht im Kino')];
const FRowsL = [{ Film: 'Eine Nacht im Kino' }, { Film: 'Der große Filmmarathon' }, { Film: 'Gruselabend: Drei Filme, kein Schlaf' }];
const bFl = base('filmabend', 'Filmabend', { fields: FiL, sampleRows: FRowsL });
const tFl = (...m) => tags('Filmabend', 'Kino', 'Heimkino', 'Film', 'Popcorn', 'Einladung', 'Kinoabend', 'Movie Night', 'Freunde', 'Abend', m);
const dFl = when(22, 1);

const filmPoster = Object.assign({}, bFl, {
  slug: 'filmabend-kinoplakat', name: 'Filmabend – Kinoplakat', variant: 'Kinoplakat',
  description: 'Einladung (A6 hoch) im Stil eines Kinoplakats: Filmklappe und Popcorn auf Samtrot, der Filmtitel als Feld, darunter Vorführung, Ort und Zusage.',
  tags: tFl('Kinoplakat', 'Filmklappe', 'Popcorn', 'Samtrot', 'Plakat'),
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [page(gradient(180, '#7a1020', '#3a0810'), [
    decor([dekoIn('Klappe', 'deko-motive-filmklappe', 12, 10, 50, 46), dekoIn('Popcorn', 'deko-motive-popcorn', 66, 14, 28, 40), rect('Linie', 14, 62, 77, 0.6, '#e3c479')]),
    T('Kopf', 8, 66, 89, 7, 'HEUTE IM HEIMKINO', 'Oswald', 10, '#e3c479', { ls: 0.35, w: 500, min: 7 }),
    T('Film', 8, 74, 89, 30, '{{Film}}', 'Abril Fatface', 22, '#ffffff', { wrap: true, lh: 1.1, min: 10 }),
    T('Sub', 8, 105, 89, 7, 'Mit Popcorn, Decken und besten Freunden', 'Oswald', 9, '#e3c479', { w: 400, min: 7 }),
    T('Datum', 8, 116, 89, 7, dFl + ' · ' + uhr('20'), 'Oswald', 11, '#ffffff', { up: true, w: 400, ls: 0.05, min: 8 }),
    T('Ort', 8, 124, 89, 7, 'Wohnzimmer-Kino · Musterweg 5', 'Oswald', 10.5, '#ffffff', { up: true, w: 400, ls: 0.05, min: 8 }),
    T('Zusage', 8, 133, 89, 7, 'Zusage bis 15. Januar', 'Oswald', 9, '#e3c479', { up: true, w: 400, ls: 0.05, min: 7 }),
  ])],
});

const filmTicket = Object.assign({}, bFl, {
  slug: 'filmabend-eintrittskarte', name: 'Filmabend – Eintrittskarte', variant: 'Eintrittskarte',
  description: 'Hohe Einladung (DIN lang) als Eintrittskarte: Filmrolle, Perforationslinie und Abriss-Abschnitt; Filmtitel als Feld, Platz und Einlass darunter.',
  tags: tFl('Eintrittskarte', 'Ticket', 'DIN lang', 'Filmrolle', 'Perforation'),
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  pages: [page('#f6efdc', [
    decor([
      rect('Rahmen', 6, 6, 87, 198, null, { stroke: '#7a1020', sw: 1.2, radius: 4 }),
      rect('Kopfband', 6, 6, 87, 16, '#7a1020', { radius: 4 }), rect('Kopfband 2', 6, 14, 87, 8, '#7a1020'),
      dekoIn('Filmrolle', 'deko-motive-filmrolle', 24, 32, 51, 44),
      rect('Perforation', 10, 150, 79, 0.6, '#7a1020', { dash: [1.5, 1.5] }),
    ]),
    T('Kopf', 10, 8, 79, 12, 'EINTRITTSKARTE', 'Oswald', 17, '#f6efdc', { ls: 0.3, w: 500, min: 9 }),
    T('Kopf 2', 10, 80, 79, 7, 'HEUTE AUF DER LEINWAND', 'Oswald', 8.5, '#7a1020', { ls: 0.25, w: 500, min: 7 }),
    T('Film', 10, 88, 79, 30, '{{Film}}', 'Abril Fatface', 21, '#2b0a10', { wrap: true, lh: 1.1, min: 10 }),
    T('Datum', 10, 120, 79, 8, dFl, 'Oswald', 11, '#2b0a10', { up: true, w: 500, min: 8 }),
    T('Zeit', 10, 129, 79, 8, 'Einlass 19:30 Uhr · Beginn ' + uhr('20'), 'Oswald', 10, '#2b0a10', { up: true, w: 400, min: 8 }),
    T('Ort', 10, 138, 79, 8, 'Musterweg 5 · freie Platzwahl', 'Oswald', 10, '#2b0a10', { up: true, w: 400, min: 8 }),
    T('Abriss', 10, 156, 79, 8, 'ABRISS: Bitte zusagen bis 15. Januar', 'Oswald', 10, '#7a1020', { ls: 0.1, w: 500, min: 8 }),
    T('Tel', 10, 166, 79, 8, '0170 1234567', 'Oswald', 13, '#2b0a10', { w: 500, min: 8 }),
    T('Snack', 10, 180, 79, 14, 'Popcorn und Getränke sind im Preis enthalten.', 'Oswald', 9, '#7a1020', { w: 400, wrap: true, v: 'top', lh: 1.3, min: 7 }),
  ])],
});

const filmStory = Object.assign({}, bFl, {
  slug: 'filmabend-movie-night', name: 'Filmabend – Movie Night', variant: 'Movie Night', unit: 'px',
  description: 'Story-Einladung zum Filmabend: Filmrolle, Popcorn und Klappe auf Dunkelblau, „Movie Night“ in Gold und der Filmtitel als Feld.',
  tags: tFl('Story', 'Instagram', 'Social Media', 'Movie Night', 'Gold', 'Dunkelblau'),
  formatKey: 'instagram-story', width: 1080, height: 1920,
  pages: [page(gradient(180, '#0e1830', '#050a18'), [
    decor([
      dekoIn('Filmrolle', 'deko-motive-filmrolle', 140, 160, 800, 640),
      dekoIn('Popcorn', 'deko-motive-popcorn', 720, 1200, 250, 340), dekoIn('Klappe', 'deko-motive-filmklappe', 90, 1250, 380, 340),
    ]),
    T('Kopf', 60, 840, 960, 60, 'HEUTE ABEND', 'Oswald', 28, '#e3c479', { ls: 0.4, w: 500, min: 16 }),
    T('Titel', 60, 900, 960, 140, 'MOVIE NIGHT', 'Anton', 80, '#ffffff', { ls: 0.04, min: 36 }),
    T('Film', 60, 1040, 960, 160, '{{Film}}', 'Abril Fatface', 40, '#e3c479', { wrap: true, lh: 1.15, min: 18 }),
    T('Datum', 60, 1610, 960, 66, dFl + ' · ' + uhr('20'), 'Oswald', 32, '#ffffff', { up: true, w: 400, min: 18 }),
    T('Ort', 60, 1690, 960, 56, 'Musterweg 5 · Zusage bis 15. Januar', 'Oswald', 26, '#e3c479', { up: true, w: 400, min: 15 }),
  ])],
});

// ================================================================================================================== Mädelsabend
const bM = base('maedelsabend', 'Mädelsabend');
const tM = (...m) => tags('Mädelsabend', 'Mädels', 'Girls Night', 'Freundinnen', 'Party', 'Einladung', 'Sekt', 'Pyjamaparty', 'Abend', 'Feier', m);
const dM = when(19, 11);

const maedelsKuss = Object.assign({}, bM, {
  slug: 'maedelsabend-kussmund', name: 'Mädelsabend – Kussmund', variant: 'Kussmund',
  description: 'Glamouröse Einladung (A6 hoch) zum Mädelsabend: roter Kussmund, Sektgläser und Pink auf Schwarz mit viel Glitzer.',
  tags: tM('Kussmund', 'Glamour', 'Pink', 'Schwarz', 'Lippen'),
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [page('#16121a', [
    sprinkle('Glitzer', 841, [3, 3, 99, 142], { n: 22, avoid: [[8, 8, 89, 130]], colors: ['#ff4fa3', '#e3c479', '#ffffff'], kinds: ['spark', 'star', 'dot'], size: [2, 4.5] }),
    decor([dekoIn('Kuss', 'deko-motive-kussmund', 22, 14, 61, 38), dekoIn('Sekt', 'deko-motive-sektglaeser-bunt', 74, 62, 20, 24)]),
    T('Kopf', 8, 58, 66, 7, 'GIRLS NIGHT', 'Josefin Sans', 11, '#ff4fa3', { ls: 0.5, w: 700, a: 'left', min: 8 }),
    T('Titel', 8, 64, 89, 24, 'Mädelsabend', 'Pacifico', 25, '#ffffff', { a: 'left', min: 12, lh: 1.5 }),
    T('Sub', 8, 92, 89, 8, 'Sekt, Snacks und Tratsch bis Mitternacht', 'Josefin Sans', 9.5, '#e3c479', { w: 600, min: 7 }),
    T('Datum', 8, 106, 89, 7, dM + ' · ' + uhr('19'), 'Josefin Sans', 10.5, '#ffffff', { w: 700, min: 8 }),
    T('Ort', 8, 114, 89, 7, 'Bei Lena · Musterweg 5', 'Josefin Sans', 10, '#ffffff', { w: 500, min: 8 }),
    T('Zusage', 8, 124, 89, 7, 'Zusage bis 12. November · Outfit: Glitzer', 'Josefin Sans', 9, '#ff4fa3', { w: 700, min: 7 }),
  ])],
});

const maedelsPost = Object.assign({}, bM, {
  slug: 'maedelsabend-rosa-wolke', name: 'Mädelsabend – Rosa Wolke', variant: 'Rosa Wolke', unit: 'px',
  description: 'Zarter Instagram-Post auf Rosa mit Herzen: „Mädelsabend“ in Schreibschrift, Sektgläser und alles Wichtige zu Datum, Ort und Mitbringen.',
  tags: tM('Rosa', 'Instagram', 'Post', 'Social Media', 'Herzen', 'Zart'),
  formatKey: 'instagram-post', width: 1080, height: 1080,
  pages: [page(gradient(180, '#ffe3ee', '#ffc4d9'), [
    decor([
      dekoIn('Herzen', 'deko-herzen-streuung-rose', 40, 30, 1000, 500),
      dekoIn('Sekt', 'deko-motive-sektglaeser-bunt', 130, 230, 280, 330), dekoIn('Kuss', 'deko-motive-kussmund', 660, 280, 300, 190, { valign: 'top' }),
    ]),
    T('Titel', 60, 560, 960, 190, 'Mädelsabend', 'Great Vibes', 96, '#c2185b', { min: 40, lh: 1.3 }),
    T('Datum', 60, 760, 960, 64, dM + ' · ' + uhr('19'), 'Josefin Sans', 34, '#3a1428', { w: 700, min: 18 }),
    T('Ort', 60, 830, 960, 56, 'Bei Lena · Musterweg 5', 'Josefin Sans', 28, '#3a1428', { w: 500, min: 15 }),
    T('Zusage', 60, 906, 960, 56, 'Zusage bis 12. November · Snacks mitbringen', 'Josefin Sans', 24, '#c2185b', { w: 700, min: 15 }),
  ])],
});

const maedelsPyjama = Object.assign({}, bM, {
  slug: 'maedelsabend-pyjama', name: 'Mädelsabend – Pyjamaparty', variant: 'Pyjamaparty',
  description: 'Gemütliche Einladung (DIN lang) zur Pyjamaparty: Lavendel mit Sternen und Mond, weiche Schrift und der Hinweis, Schlafanzug und Kuscheldecke mitzubringen.',
  tags: tM('Pyjama', 'Schlafanzug', 'Kuscheln', 'DIN lang', 'Sterne', 'Lavendel'),
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  pages: [page(gradient(180, '#6a4fb0', '#a98bd8'), [
    decor([
      dekoIn('Sterne', 'deko-sterne-himmel-weiss', 6, 8, 87, 80),
      icon('Mond', 'moon', 34, 36, 32, '#ffe58a', 1.6),
    ]),
    T('Kopf', 8, 96, 83, 7, 'SCHLAFANZUG-ALARM', 'Josefin Sans', 9, '#ffe58a', { ls: 0.4, w: 700, min: 7 }),
    T('Titel', 6, 106, 87, 30, 'Pyjamaparty', 'Pacifico', 28, '#ffffff', { lh: 1.5, min: 14 }),
    T('Sub', 10, 146, 79, 12, 'Kuscheldecke, Kissen und gute Laune mitbringen!', 'Nunito', 10.5, '#ffffff', { w: 700, wrap: true, lh: 1.3, v: 'top', min: 8 }),
    T('Datum', 8, 164, 83, 8, dM + ' · ' + uhr('19'), 'Nunito', 11, '#ffffff', { w: 800, min: 8 }),
    T('Ort', 8, 173, 83, 8, 'Bei Lena · Musterweg 5', 'Nunito', 10.5, '#ffffff', { w: 600, min: 8 }),
    T('Zusage', 8, 185, 83, 8, 'Zusage bis 12. November', 'Nunito', 10.5, '#ffe58a', { w: 800, min: 8 }),
  ])],
});

module.exports = { templates: [rundGold, rundBunt, rundSterne, firmaGala, firmaBlock, firmaFolie, grillKreide, grillKraft, grillKaro, filmPoster, filmTicket, filmStory, maedelsKuss, maedelsPost, maedelsPyjama] };
