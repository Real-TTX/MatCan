'use strict';
const { dsl, pt, ADDRESS, PHONE, WEB, infoRow } = require('./_t3a-lib');
const { text, rect, ellipse, shape, icon, frame, deko, dekoIn, dekoCorners, group, page, typo, qr, line, gradient, shadow } = dsl;

const FAMILY = { family: 'flyer-eroeffnung', familyName: 'Flyer Eröffnung', occasion: 'Handel & Preise', category: 'Flyer' };

// ---- Feierlich: A5, navy and gold, laurel and sparkles
const NAVY = '#14213d';
const GOLD = '#d9b65c';
const IVORY = '#fbf6e8';
const gift = (n, y, label) => [
  icon(`Angebot ${n} Stern`, 'sparkles', 30, y, 6, GOLD, 1.8),
  text(`Angebot ${n}`, 40, y - 1, 90, 8, label, { f: 'Cormorant Garamond', w: 600, s: 15, c: IVORY, a: 'left', min: 9 }),
];
const feierlich = {
  ...FAMILY,
  slug: 'flyer-eroeffnung-feierlich',
  name: 'Flyer A5 – Eröffnung Feierlich',
  variant: 'Feierlich',
  formatKey: 'a5-portrait', width: 148, height: 210,
  description: 'Festlicher A5-Flyer zur Neueröffnung von Geschäft, Praxis oder Café: dunkelblau mit Goldrahmen, Lorbeerzweig, Titel „Neueröffnung“ in Cinzel, drei Eröffnungsgeschenke und das große Datum.',
  tags: ['Flyer', 'Eröffnung', 'Neueröffnung', 'Geschäft', 'Laden', 'Café', 'Praxis', 'Festlich', 'Gold', 'Einladung'],
  pages: [page(NAVY, [
    dekoIn('Rahmen', 'deko-rahmen-doppellinie-hoch-gold', 6, 6, 136, 198, { locked: true }),
    deko('Lorbeer', 'deko-blumen-lorbeerzweig-gold', 36, 12, 76, undefined, { locked: true }),
    text('Anlass', 16, 52, 116, 7, 'WIR LADEN HERZLICH EIN ZUR', { f: 'Cinzel', w: 500, s: 9, c: IVORY, ls: 0.2, a: 'center', min: 6 }),
    text('Titel', 12, 60, 124, 24, 'Neueröffnung', { f: 'Cinzel', w: 700, s: 31, c: GOLD, a: 'center', min: 16 }),
    text('Name', 16, 86, 116, 12, 'Blumenhaus Rosengarten', { f: 'Cormorant Garamond', i: true, w: 500, s: 20, c: IVORY, a: 'center', min: 11 }),
    deko('Trenner', 'deko-trenner-deco-gold', 44, 102, 60, undefined, { locked: true }),
    text('Tag', 16, 111, 116, 11, 'Samstag, 3. Oktober', { f: 'Cinzel', w: 600, s: 18, c: IVORY, a: 'center', min: 10 }),
    text('Zeit', 16, 124, 116, 9, 'ab 10 Uhr', { f: 'Cormorant Garamond', i: true, w: 500, s: 17, c: GOLD, a: 'center', min: 10 }),
    gift(1, 142, 'Sekt und Häppchen zur Begrüßung'),
    gift(2, 152, 'Eine Rose für jede Besucherin'),
    gift(3, 162, 'Eröffnungsrabatt: 15 % auf alles'),
    text('Adresse', 16, 178, 116, 6, `${ADDRESS}`, { f: 'Cinzel', w: 500, s: 8, c: IVORY, ls: 0.06, a: 'center', min: 6 }),
    text('Web', 16, 185, 116, 6, `${WEB}  ·  ${PHONE}`, { f: 'Cormorant Garamond', w: 500, s: 11, c: GOLD, a: 'center', min: 7 }),
  ])],
};

// ---- Konfetti: A5, bright, big pink title, confetti field at the top
const PINK = '#ff3d81';
const DARK = '#2b2d42';
const konfetti = {
  ...FAMILY,
  slug: 'flyer-eroeffnung-konfetti',
  name: 'Flyer A5 – Eröffnung Konfetti',
  variant: 'Konfetti',
  formatKey: 'a5-portrait', width: 148, height: 210,
  description: 'Bunter A5-Flyer zur Eröffnung eines Ladens, Spielwarengeschäfts oder Eiscafés: Konfettiregen oben, Titel „Wir eröffnen!“ in Righteous, Geschenkbox mit Eröffnungsaktion, Datum, Ort und Zeit.',
  tags: ['Flyer', 'Eröffnung', 'Neueröffnung', 'Konfetti', 'Party', 'Bunt', 'Eiscafé', 'Spielwaren', 'Aktion', 'Einladung'],
  pages: [page('#fffaf0', [
    deko('Konfetti', 'deko-konfetti-regen', 0, 0, 148, undefined, { locked: true }),
    text('Etikett', 12, 12, 40, 6, 'Große Eröffnung', { f: 'Righteous', s: 10, c: '#ffffff', ls: 0.14, background: { color: PINK, radius: 3, padding: 2 }, fit: 'none' }),
    text('Titel', 10, 58, 128, 44, 'Wir\neröffnen!', { f: 'Righteous', s: 54, c: DARK, a: 'left', v: 'top', wrap: true, lh: 1.05, min: 28 }),
    text('Name', 12, 104, 124, 8, 'Eiscafé Dolce Vita', { f: 'Righteous', s: 17, c: PINK, a: 'left', min: 10 }),
    group('Aktion', [
      rect('Aktion Karte', 12, 120, 124, 34, '#ffffff', { radius: 5, shadow: shadow('#2b2d42', 0.16, 4, 0, 1) }),
      ellipse('Aktion Kreis', 18, 128, 18, 18, '#ffd23f'),
      icon('Aktion Symbol', 'gift', 21.2, 131.2, 11.6, DARK, 1.8),
      text('Aktion Titel', 42, 124, 90, 12, 'Jede Kugel nur 1 €', { f: 'Righteous', s: 14, c: DARK, a: 'left', min: 8 }),
      text('Aktion Text', 42, 135, 90, 14, 'am Eröffnungstag, dazu Luftballons und eine Überraschung für alle Kinder.', { f: 'Nunito', s: 9, c: '#555566', a: 'left', v: 'top', wrap: true, lh: 1.35, min: 6 }),
    ], { rotation: -1.2 }),
    infoRow('Datum', 'calendar', 14, 164, 120, '', 'Freitag, 17. April, ab 11 Uhr', { f: 'Nunito', c: DARK, icolor: PINK, ic: 7, vs: 12, vw: 800 }),
    infoRow('Ort', 'map-pin', 14, 175, 120, '', ADDRESS, { f: 'Nunito', c: DARK, icolor: PINK, ic: 7, vs: 12, vw: 800 }),
    rect('Fuß', 0, 194, 148, 16, PINK, { locked: true }),
    text('Fußzeile', 12, 194, 124, 16, 'Wir freuen uns auf euch!', { f: 'Righteous', s: 13, c: '#ffffff', a: 'center', min: 8 }),
  ])],
};

// ---- Schaufenster: DIN lang, black and white, a huge date
const schaufenster = {
  ...FAMILY,
  slug: 'flyer-eroeffnung-schaufenster',
  name: 'Flyer DIN lang – Eröffnung Schaufenster',
  variant: 'Schaufenster',
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  description: 'Reduzierter DIN-lang-Flyer zur Eröffnung einer Boutique, Galerie oder eines Studios: Schwarz-Weiß, riesige Datumszahl in Raleway, feine Linien und ein Hinweis auf Aperitif und Eröffnungsangebot.',
  tags: ['Flyer', 'DIN lang', 'Eröffnung', 'Boutique', 'Galerie', 'Studio', 'Minimal', 'Schwarz-Weiß', 'Datum', 'Vernissage'],
  pages: [page('#ffffff', [
    text('Marke', 10, 12, 79, 6, 'ATELIER  NORD', { f: 'Raleway', w: 700, s: 9, c: '#111111', ls: 0.36, a: 'left', min: 6 }),
    line('Linie oben', 10, 22, 89, 22, '#111111', 0.5, { locked: true }),
    text('Anlass', 10, 30, 79, 8, 'Wir eröffnen am', { f: 'Raleway', i: true, w: 300, s: 15, c: '#111111', a: 'left', min: 8 }),
    text('Tag', 6, 40, 90, 70, '24', { f: 'Raleway', w: 200, s: 200, c: '#111111', a: 'left', lh: 1, min: 80 }),
    text('Monat', 10, 114, 79, 12, 'OKTOBER', { f: 'Raleway', w: 700, s: 24, c: '#111111', ls: 0.2, a: 'left', min: 12 }),
    text('Uhrzeit', 10, 128, 79, 8, `ab 17 Uhr  ·  Aperitif und Musik`, { f: 'Raleway', s: 9.5, c: '#444444', a: 'left', min: 6 }),
    line('Linie mitte', 10, 146, 89, 146, '#cccccc', 0.4, { locked: true }),
    text('Angebot', 10, 152, 79, 22, 'Zur Eröffnung:\n20 % auf die gesamte\nErsteinrichtung.', { f: 'Raleway', w: 500, s: 11, c: '#111111', a: 'left', v: 'top', wrap: true, lh: 1.5, min: 7 }),
    text('Adresse', 10, 184, 79, 14, `${ADDRESS.split(',')[0]}\n12345 Musterstadt`, { f: 'Raleway', w: 600, s: 9.5, c: '#111111', a: 'left', v: 'top', wrap: true, lh: 1.5, min: 6 }),
    text('Web', 10, 197, 79, 6, WEB, { f: 'Raleway', s: 8, c: '#777777', a: 'left', min: 6 }),
  ])],
};

module.exports = { variants: [feierlich, konfetti, schaufenster] };
