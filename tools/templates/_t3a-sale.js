'use strict';
const { dsl, pt, ADDRESS, PHONE, WEB, infoRow } = require('./_t3a-lib');
const { text, rect, ellipse, shape, icon, frame, deko, dekoIn, dekoCorners, group, page, typo, qr, line, gradient, shadow } = dsl;

const FAMILY = { family: 'flyer-sale', familyName: 'Flyer Sale', occasion: 'Handel & Preise', category: 'Flyer' };

// ---- Prozent: A4 shop-window sheet, giant -50 %
const RED = '#e10600';
const prozent = {
  ...FAMILY,
  slug: 'flyer-sale-prozent',
  name: 'Flyer A4 – Sale Prozent',
  variant: 'Prozent',
  formatKey: 'a4-portrait', width: 210, height: 297,
  description: 'Schreiendes A4-Blatt für Schaufenster und Eingang: roter Grund, riesiges „–50 %“ in Anton, schräges weißes Band „Räumungsverkauf“, Warengruppen und Zeitraum. Sofort lesbar aus zehn Metern.',
  tags: ['Flyer', 'Sale', 'Rabatt', 'Räumungsverkauf', 'Schlussverkauf', 'Prozent', 'Schaufenster', 'Aushang', 'Angebot', 'Preis'],
  pages: [page(RED, [
    text('Etikett', 14, 14, 182, 16, 'RÄUMUNGSVERKAUF', { f: 'Anton', s: 40, c: '#ffffff', ls: 0.12, a: 'center', min: 18 }),
    text('Zahl', 10, 34, 190, 130, '–50 %', { f: 'Anton', s: 300, c: '#ffffff', a: 'center', lh: 1, min: 100 }),
    rect('Band', -10, 176, 230, 30, '#ffffff', { rotation: -3, locked: true }),
    text('Band Text', -4, 176, 218, 30, 'AUF ALLES, WAS IM LADEN STEHT', { f: 'Anton', s: 30, c: RED, a: 'center', min: 14, rotation: -3 }),
    text('Gruppen', 14, 220, 182, 24, 'Mode  ·  Schuhe  ·  Taschen  ·  Accessoires', { f: 'Source Sans 3', w: 700, s: 22, c: '#ffffff', a: 'center', min: 12 }),
    text('Zeitraum', 14, 246, 182, 14, `Nur vom 6. bis 18. Januar`, { f: 'Anton', s: 30, c: '#ffe14d', a: 'center', min: 14 }),
    rect('Fuß', 0, 270, 210, 27, '#111111', { locked: true }),
    text('Adresse', 14, 270, 182, 27, `Modehaus Winter  ·  ${ADDRESS}`, { f: 'Source Sans 3', w: 600, s: 13, c: '#ffffff', a: 'center', min: 8 }),
  ])],
};

// ---- Summer Sale: A5, warm gradient, sun and script
const summer = {
  ...FAMILY,
  slug: 'flyer-sale-summer',
  name: 'Flyer A5 – Sale Summer',
  variant: 'Summer Sale',
  formatKey: 'a5-portrait', width: 148, height: 210,
  description: 'Sommerlicher A5-Flyer für den Sommerschlussverkauf: Verlauf von Koralle zu Gelb, große Sonne, Schreibschrift „Summer“ über fettem „SALE“, Rabattstufen als Etiketten und Aktionszeitraum.',
  tags: ['Flyer', 'Sale', 'Summer Sale', 'Sommer', 'Schlussverkauf', 'Rabatt', 'Mode', 'Sonne', 'Aktion', 'Bunt'],
  pages: [page(gradient(160, '#ff6b6b', '#ffd166'), [
    deko('Sonne', 'deko-formen-sonne-bunt', 82, -22, 88, undefined, { locked: true }),
    text('Script', 12, 14, 124, 30, 'Summer', { f: 'Pacifico', s: 52, c: '#ffffff', a: 'left', lh: 1.4, min: 26, rotation: -6 }),
    text('Sale', 8, 52, 132, 52, 'SALE', { f: 'Anton', s: 170, c: '#ffffff', a: 'left', lh: 1.1, min: 70 }),
    text('Bis zu', 14, 108, 80, 10, 'BIS ZU', { f: 'Poppins', w: 700, s: 16, c: '#7a1f1f', ls: 0.2, a: 'left', min: 8 }),
    text('Prozent', 12, 116, 124, 30, '–70 %', { f: 'Anton', s: 90, c: '#7a1f1f', a: 'left', lh: 1.1, min: 40 }),
    ...[['Shirts', '20 %'], ['Kleider', '40 %'], ['Schuhe', '50 %']].map(([n, p], i) => group('Etikett ' + (i + 1), [
      rect(`Etikett ${i + 1} Fläche`, 12 + i * 41, 152, 38, 20, '#ffffff', { radius: 4, shadow: shadow('#7a1f1f', 0.25, 3, 0, 0.8) }),
      text(`Etikett ${i + 1} Name`, 12 + i * 41, 154, 38, 7, n, { f: 'Poppins', w: 600, s: 10, c: '#555555', a: 'center', min: 6 }),
      text(`Etikett ${i + 1} Prozent`, 12 + i * 41, 161, 38, 10, p, { f: 'Anton', s: 20, c: '#e63946', a: 'center', lh: 1.1, min: 10 }),
    ], { rotation: [-3, 2, -2][i] })),
    text('Zeitraum', 12, 181, 124, 8, 'Vom 12. bis 25. Juli', { f: 'Poppins', w: 700, s: 14, c: '#ffffff', a: 'left', min: 8 }),
    text('Adresse', 12, 191, 124, 12, `Boutique Sonnendeck\n${ADDRESS}`, { f: 'Poppins', s: 8.5, c: '#7a1f1f', a: 'left', v: 'top', wrap: true, lh: 1.45, min: 6 }),
  ])],
};

// ---- Black Week: DIN lang, black and gold
const GOLD = '#d4af37';
const blackweek = {
  ...FAMILY,
  slug: 'flyer-sale-black-week',
  name: 'Flyer DIN lang – Sale Black Week',
  variant: 'Black Week',
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  description: 'Edler DIN-lang-Flyer für Black Friday und Black Week: schwarzer Grund, goldener Starburst mit Rabatt, Titel in Cinzel, drei Angebotszeilen mit Preisen und Hinweis auf Gutscheincode.',
  tags: ['Flyer', 'DIN lang', 'Sale', 'Black Friday', 'Black Week', 'Rabatt', 'Gold', 'Schwarz', 'Gutscheincode', 'Angebot'],
  pages: [page('#0b0b0b', [
    deko('Starburst', 'deko-baender-starburst-gold', 14, 14, 52, undefined, { locked: true, rotation: 8 }),
    text('Starburst Zahl', 18, 28, 44, 20, '–40 %', { f: 'Cinzel', w: 800, s: 27, c: '#0b0b0b', a: 'center', min: 12, rotation: 8 }),
    text('Anlass', 10, 76, 79, 8, 'BLACK WEEK', { f: 'Cinzel', w: 700, s: 22, c: GOLD, ls: 0.1, a: 'left', min: 10 }),
    text('Titel', 10, 86, 79, 24, 'Alles muss\nraus.', { f: 'Cinzel', w: 500, s: 22, c: '#ffffff', a: 'left', v: 'top', wrap: true, lh: 1.2, min: 12 }),
    line('Linie', 10, 120, 89, 120, GOLD, 0.5, { locked: true }),
    ...[['Wollmantel', typo.euro(199, 0), typo.euro(329, 0)], ['Lederstiefel', typo.euro(129, 0), typo.euro(219, 0)], ['Kaschmirschal', typo.euro(49, 0), typo.euro(89, 0)]].map(([n, p, o], i) => [
      text(`Artikel ${i + 1}`, 10, 126 + i * 14, 50, 7, n, { f: 'Cormorant Garamond', w: 600, s: 14, c: '#ffffff', a: 'left', min: 8 }),
      text(`Alter Preis ${i + 1}`, 10, 132.5 + i * 14, 50, 5, o, { f: 'Cormorant Garamond', s: 9, c: '#8a8a8a', strike: true, a: 'left', min: 6 }),
      text(`Preis ${i + 1}`, 58, 126 + i * 14, 31, 10, p, { f: 'Cinzel', w: 700, s: 14, c: GOLD, a: 'right', min: 8 }),
    ]),
    rect('Code Feld', 10, 172, 79, 14, null, { stroke: GOLD, sw: 0.5 }),
    text('Code', 10, 172, 79, 14, 'Code: BLACK40', { f: 'Cinzel', w: 600, s: 11, c: GOLD, a: 'center', ls: 0.1, min: 7 }),
    text('Zeitraum', 10, 191, 79, 5, 'Nur 24. bis 30. November', { f: 'Cormorant Garamond', i: true, w: 500, s: 11, c: '#ffffff', a: 'left', min: 7 }),
    text('Web', 10, 197, 79, 5, `${WEB}  ·  ${ADDRESS.split(',')[0]}`, { f: 'Cormorant Garamond', s: 8.5, c: '#8a8a8a', a: 'left', min: 6 }),
  ])],
};

module.exports = { variants: [prozent, summer, blackweek] };
