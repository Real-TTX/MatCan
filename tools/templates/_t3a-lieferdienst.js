'use strict';
const { dsl, pt, ADDRESS, PHONE, WEB, infoRow } = require('./_t3a-lib');
const { text, rect, ellipse, shape, icon, frame, deko, dekoIn, group, page, typo, qr, line, gradient, shadow } = dsl;

const FAMILY = { family: 'flyer-lieferdienst', familyName: 'Flyer Lieferdienst', occasion: 'Gastronomie', category: 'Flyer' };

// ---- Pizzaservice: A5, red, big pizza cut by the page edge, phone strip
const RED = '#d62828';
const CHEESE = '#ffcf5a';
const toppings = [[78, 82, 11, '#b3261e'], [104, 76, 9, '#b3261e'], [124, 96, 11, '#b3261e'], [96, 106, 8, '#2e8b57'], [118, 124, 8, '#2e8b57'], [86, 130, 11, '#b3261e'], [132, 72, 7, '#2e8b57'], [108, 146, 9, '#b3261e']];
const pizzaservice = {
  ...FAMILY,
  slug: 'flyer-lieferdienst-pizzaservice',
  name: 'Flyer A5 – Lieferdienst Pizzaservice',
  variant: 'Pizzaservice',
  formatKey: 'a5-portrait', width: 148, height: 210,
  description: 'Appetitlicher A5-Flyer für Pizzaservice oder Lieferdienst: roter Grund, riesige Schlagzeile „Wir liefern“, gezeichnete Pizza als Blickfang, Preisplakette und eine Telefonleiste zum Bestellen.',
  tags: ['Flyer', 'Lieferdienst', 'Pizzaservice', 'Pizza', 'Bringdienst', 'Essen bestellen', 'Imbiss', 'Gastronomie', 'Lieferung'],
  pages: [page(RED, [
    text('Zeile 1', 10, 8, 128, 26, 'WIR', { f: 'Anton', s: 78, c: '#ffffff', a: 'left', lh: 1.15, min: 36 }),
    text('Zeile 2', 10, 30, 128, 30, 'LIEFERN!', { f: 'Anton', s: 78, c: '#ffe066', a: 'left', lh: 1.15, min: 36 }),
    ellipse('Pizza Rand', 58, 68, 118, 118, '#e8a33d', { locked: true }),
    ellipse('Pizza Käse', 63, 73, 108, 108, CHEESE, { locked: true }),
    ...toppings.map(([x, y, d, c], i) => ellipse('Belag ' + (i + 1), x, y, d, d, c, { locked: true })),
    group('Preisplakette', [
      shape('star', 'Plakette', 6, 70, 46, 46, '#ffffff', { points: 14, inner: 0.88 }),
      text('Plakette ab', 8, 80, 42, 5, 'ab', { f: 'Source Sans 3', w: 700, s: 9, c: RED, a: 'center', up: true, min: 6 }),
      text('Plakette Preis', 8, 84, 42, 14, typo.euro(9.9), { f: 'Anton', s: 24, c: RED, a: 'center', lh: 1.1, min: 12 }),
      text('Plakette Pizza', 8, 98, 42, 5, 'für jede Pizza', { f: 'Source Sans 3', w: 600, s: 7.5, c: '#333333', a: 'center', min: 5 }),
    ], { rotation: -10 }),
    text('Angebot', 10, 130, 54, 24, 'Pizza · Pasta ·\nSalate · Burger', { f: 'Source Sans 3', w: 700, s: 13, c: '#ffffff', a: 'left', v: 'top', wrap: true, lh: 1.35, min: 8 }),
    text('Lieferzeit', 10, 154, 54, 14, 'Lieferzeit ca. 30 Min.\nMindestbestellwert 12 €', { f: 'Source Sans 3', s: 9, c: '#ffd9d9', a: 'left', v: 'top', wrap: true, lh: 1.4, min: 6 }),
    rect('Leiste', 0, 176, 148, 34, '#141414', { locked: true }),
    icon('Telefon', 'phone', 12, 187, 14, '#ffe066', 2),
    text('Bestellen', 30, 180, 100, 6, 'JETZT BESTELLEN', { f: 'Source Sans 3', w: 700, s: 9, c: '#ffe066', ls: 0.18, a: 'left', min: 6 }),
    text('Nummer', 30, 186, 110, 16, PHONE, { f: 'Anton', s: 34, c: '#ffffff', a: 'left', lh: 1.15, min: 18 }),
    text('Zeiten', 30, 202, 110, 5, `täglich 11${typo.dash}22 Uhr  ·  ${WEB}`, { f: 'Source Sans 3', s: 8, c: '#bdbdbd', a: 'left', min: 6 }),
  ])],
};

// ---- Drei Schritte: DIN lang, green, numbered steps
const GREEN = '#0f5132';
const MINT = '#9be7b4';
const stepRow = (n, y, iconName, title, sub) => [
  ellipse(`Schritt ${n} Kreis`, 10, y, 22, 22, MINT),
  text(`Schritt ${n} Nummer`, 10, y + 0.5, 22, 22, String(n), { f: 'Nunito', w: 900, s: 26, c: GREEN, a: 'center', min: 14 }),
  icon(`Schritt ${n} Symbol`, iconName, 38, y + 2, 9, MINT, 1.8),
  text(`Schritt ${n} Titel`, 50, y, 42, 9, title, { f: 'Nunito', w: 800, s: 14, c: '#ffffff', a: 'left', min: 8 }),
  text(`Schritt ${n} Text`, 38, y + 10.5, 54, 12, sub, { f: 'Nunito', s: 9, c: '#cfe9d9', a: 'left', v: 'top', wrap: true, lh: 1.35, min: 6 }),
];
const schritte = {
  ...FAMILY,
  slug: 'flyer-lieferdienst-drei-schritte',
  name: 'Flyer DIN lang – Lieferdienst Drei Schritte',
  variant: 'Drei Schritte',
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  description: 'Freundlicher DIN-lang-Flyer für einen Lieferdienst oder Mittagsservice: grüner Grund, drei nummerierte Schritte (Anrufen, Zubereiten, Liefern), Hinweis auf Liefergebiet und Telefonnummer in großer Schrift.',
  tags: ['Flyer', 'DIN lang', 'Lieferdienst', 'Bringdienst', 'Essen auf Rädern', 'Mittagsservice', 'Bestellen', 'Lieferung', 'Schritte'],
  pages: [page(gradient(170, GREEN, '#0a3622'), [
    ellipse('Kreis oben', 54, -22, 70, 70, '#ffffff', { opacity: 0.06, locked: true }),
    text('Etikett', 10, 14, 50, 6, 'Frisch geliefert', { f: 'Nunito', w: 800, s: 9, c: GREEN, up: true, ls: 0.14, background: { color: MINT, radius: 3, padding: 2 }, fit: 'none' }),
    text('Titel', 10, 24, 80, 34, 'So einfach\ngeht Essen', { f: 'Nunito', w: 900, s: 27, c: '#ffffff', a: 'left', v: 'top', wrap: true, lh: 1.1, min: 14 }),
    stepRow(1, 70, 'phone', 'Anrufen', 'Wähle aus der Karte, wir nehmen deine Bestellung an.'),
    stepRow(2, 102, 'chef-hat', 'Kochen', 'Alles wird frisch und mit regionalen Zutaten zubereitet.'),
    stepRow(3, 134, 'bike', 'Liefern', 'Warm und pünktlich bei dir zu Hause, ab 15 € frei Haus.'),
    rect('Leiste', 0, 172, 99, 38, '#0a3622', { locked: true }),
    text('Anrufen', 10, 177, 80, 5, 'JETZT BESTELLEN', { f: 'Nunito', w: 800, s: 8, c: MINT, ls: 0.18, a: 'left', min: 6 }),
    text('Nummer', 10, 182, 80, 10, PHONE, { f: 'Nunito', w: 900, s: 22, c: '#ffffff', a: 'left', min: 12 }),
    text('Gebiet', 10, 194, 80, 12, 'Wir liefern in Musterstadt\nund allen Ortsteilen.', { f: 'Nunito', s: 8.5, c: '#cfe9d9', a: 'left', v: 'top', wrap: true, lh: 1.4, min: 6 }),
  ])],
};

// ---- Asia: A5 landscape, near black with a red sun disc and a QR code
const INK = '#16161a';
const CRIMSON = '#c1121f';
const asia = {
  ...FAMILY,
  slug: 'flyer-lieferdienst-asia',
  name: 'Flyer A5 quer – Lieferdienst Asia',
  variant: 'Asia',
  formatKey: 'a5-landscape', width: 210, height: 148,
  description: 'Reduzierter A5-Flyer im Querformat für Sushi-, Wok- oder Asia-Lieferdienst: nahezu schwarzer Grund, roter Sonnenkreis, feine Schrift in Raleway, Liefergebiet und QR-Code zur Online-Bestellung.',
  tags: ['Flyer', 'Querformat', 'Lieferdienst', 'Sushi', 'Asia', 'Wok', 'Online bestellen', 'QR-Code', 'Gastronomie', 'Reduziert'],
  pages: [page(INK, [
    ellipse('Sonne', 112, 10, 100, 100, CRIMSON, { locked: true }),
    ellipse('Sonne Ring', 106, 4, 112, 112, null, { stroke: CRIMSON, sw: 0.5, opacity: 0.6, locked: true }),
    text('Etikett', 16, 18, 80, 6, 'SUSHI  ·  WOK  ·  BOWLS', { f: 'Raleway', w: 600, s: 9, c: '#ff8a8a', ls: 0.32, a: 'left', min: 6 }),
    text('Titel', 16, 28, 112, 52, 'Frisch\ngerollt.', { f: 'Raleway', w: 200, s: 54, c: '#ffffff', a: 'left', v: 'top', wrap: true, lh: 1.05, min: 28 }),
    text('Titel 2', 16, 84, 100, 8, 'Direkt an deine Tür.', { f: 'Raleway', w: 500, s: 14, c: '#ffffff', a: 'left', min: 8 }),
    line('Linie', 16, 100, 56, 100, CRIMSON, 0.8),
    text('Lieferung', 16, 104, 100, 18, `Lieferung täglich 17${typo.dash}22 Uhr\nMindestbestellwert ${typo.euro(15, 0)}  ·  Lieferung ${typo.euro(2, 0)}`, { f: 'Raleway', w: 500, s: 9.5, c: '#bdbdc6', a: 'left', v: 'top', wrap: true, lh: 1.5, min: 6 }),
    group('QR Karte', [
      rect('QR Karte Hintergrund', 138, 78, 54, 58, '#ffffff', { radius: 3 }),
      qr('QR-Code', 143, 82, 44, `https://${WEB}/bestellen`, { c: INK, bg: '#ffffff' }),
      text('QR Text', 140, 127, 50, 6, 'Online bestellen', { f: 'Raleway', w: 700, s: 8.5, c: INK, a: 'center', min: 6 }),
    ]),
    text('Name', 16, 134, 100, 6, `Sakura Sushi  ·  ${PHONE}`, { f: 'Raleway', w: 600, s: 9, c: '#ffffff', a: 'left', min: 6 }),
  ])],
};

module.exports = { variants: [pizzaservice, schritte, asia] };
