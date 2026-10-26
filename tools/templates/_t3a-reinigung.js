'use strict';
const { dsl, pt, ADDRESS, PHONE, WEB, infoRow } = require('./_t3a-lib');
const { text, rect, ellipse, shape, icon, frame, deko, dekoIn, group, page, typo, qr, line, gradient, shadow } = dsl;

const FAMILY = { family: 'flyer-reinigung', familyName: 'Flyer Reinigung und Haushaltshilfe', occasion: 'Business', category: 'Flyer' };

// ---- Frisch & sauber: A5, aqua with soap bubbles
const AQUA = '#e3f6fa';
const DEEP = '#0a6e8a';
const bubbles = [[100, 14, 30], [124, 40, 16], [84, 44, 12], [112, 62, 9], [122, 76, 14], [108, 82, 8]];
const chip = (n, x, y, w, label, iconName) => [
  rect(`Leistung ${n}`, x, y, w, 12, '#ffffff', { radius: 6, shadow: shadow(DEEP, 0.15, 3, 0, 0.8) }),
  icon(`Leistung ${n} Symbol`, iconName, x + 3.5, y + 3, 6, DEEP, 2),
  text(`Leistung ${n} Text`, x + 11.5, y, w - 13, 12, label, { f: 'Nunito', w: 700, s: 10, c: '#0b3b4a', a: 'left', min: 6 }),
];
const sauber = {
  ...FAMILY,
  slug: 'flyer-reinigung-frisch-sauber',
  name: 'Flyer A5 – Reinigung Frisch & sauber',
  variant: 'Frisch & sauber',
  formatKey: 'a5-portrait', width: 148, height: 210,
  description: 'Frischer A5-Flyer für Reinigungsservice, Fensterputzer oder Gebäudereinigung: aquablauer Grund mit Seifenblasen und Funkeln, Titel in Nunito, sechs Leistungen als Chips und ein Preisaufkleber.',
  tags: ['Flyer', 'Reinigung', 'Putzdienst', 'Gebäudereinigung', 'Fensterputzer', 'Haushaltsreinigung', 'Seifenblasen', 'Sauber', 'Service'],
  pages: [page(AQUA, [
    ...bubbles.map(([x, y, d], i) => group('Blase ' + (i + 1), [ellipse('Blase ' + (i + 1) + ' Fläche', x, y, d, d, '#ffffff', { opacity: 0.55 }), ellipse('Blase ' + (i + 1) + ' Rand', x, y, d, d, null, { stroke: '#8fd3e6', sw: 0.5 })], { locked: true })),
    icon('Funkeln 1', 'sparkles', 108, 22, 14, '#ffd24a', 1.6, { locked: true }),
    text('Etikett', 12, 14, 70, 6, 'Reinigungsservice Blitzblank', { f: 'Nunito', w: 800, s: 8.5, c: '#ffffff', up: true, ls: 0.1, background: { color: DEEP, radius: 3, padding: 2 }, fit: 'none' }),
    text('Titel', 12, 24, 100, 40, 'Frisch &\nsauber', { f: 'Nunito', w: 900, s: 44, c: DEEP, a: 'left', v: 'top', wrap: true, lh: 1.05, min: 24 }),
    text('Untertitel', 12, 70, 110, 12, 'Wir putzen, damit du Zeit für das hast, was dir wichtig ist.', { f: 'Nunito', s: 11, c: '#2b5563', a: 'left', v: 'top', wrap: true, lh: 1.4, min: 7 }),
    chip(1, 10, 92, 62, 'Wohnungsreinigung', 'sparkles'),
    chip(2, 76, 92, 62, 'Fensterputz', 'square'),
    chip(3, 10, 108, 62, 'Büroreinigung', 'briefcase'),
    chip(4, 76, 108, 62, 'Treppenhäuser', 'building'),
    chip(5, 10, 124, 62, 'Umzugsreinigung', 'truck'),
    chip(6, 76, 124, 62, 'Grundreinigung', 'spray-can'),
    group('Preisaufkleber', [
      ellipse('Aufkleber', 84, 150, 46, 46, '#ffd24a'),
      text('Aufkleber ab', 86, 158, 42, 5, 'ab', { f: 'Nunito', w: 800, s: 9, c: '#5a4300', a: 'center', up: true, min: 6 }),
      text('Aufkleber Preis', 86, 162, 42, 12, typo.euro(24, 0), { f: 'Nunito', w: 900, s: 24, c: '#3a2b00', a: 'center', lh: 1.1, min: 12 }),
      text('Aufkleber Stunde', 86, 175, 42, 5, 'pro Stunde', { f: 'Nunito', w: 700, s: 8.5, c: '#5a4300', a: 'center', min: 6 }),
    ], { rotation: 8 }),
    infoRow('Telefon', 'phone', 12, 156, 70, 'Anruf genügt', PHONE, { f: 'Nunito', lf: 'Nunito', c: '#0b3b4a', icolor: DEEP, vs: 13, vw: 800, lc: '#5a8794', ic: 8 }),
    infoRow('Web', 'globe', 12, 170, 70, 'Angebot online', WEB, { f: 'Nunito', lf: 'Nunito', c: '#0b3b4a', icolor: DEEP, vs: 10, vw: 700, lc: '#5a8794', ic: 8 }),
    text('Hinweis', 12, 198, 124, 6, 'Versichert  ·  Zuverlässig  ·  Eigene Reinigungsmittel', { f: 'Nunito', s: 8.5, c: '#2b5563', a: 'center', min: 6 }),
  ])],
};

// ---- Haushaltshilfe: A5, warm cream and olive, heart and checklist
const CREAM = '#faf3e6';
const OLIVE = '#5e7330';
const BERRY = '#b24b5e';
const todo = (n, y, label) => [
  ellipse(`Haken ${n} Kreis`, 18, y, 7, 7, OLIVE),
  icon(`Haken ${n}`, 'check', 19.2, y + 1.2, 4.6, '#ffffff', 3),
  text(`Aufgabe ${n}`, 28, y - 0.5, 100, 8, label, { f: 'Nunito', w: 700, s: 12, c: '#3b3b2c', a: 'left', min: 7 }),
];
const haushaltshilfe = {
  ...FAMILY,
  slug: 'flyer-reinigung-haushaltshilfe',
  name: 'Flyer A5 – Haushaltshilfe Herzlich',
  variant: 'Haushaltshilfe',
  formatKey: 'a5-portrait', width: 148, height: 210,
  description: 'Warmherziger A5-Flyer für Haushaltshilfe, Seniorenhilfe oder Alltagsbegleitung: Herzsymbol, Titel „Hilfe, die ankommt“, Checkliste der Aufgaben und ein freundliches Angebot zum Kennenlernen.',
  tags: ['Flyer', 'Haushaltshilfe', 'Seniorenhilfe', 'Alltagshilfe', 'Hilfe im Haushalt', 'Einkaufen', 'Begleitung', 'Pflege', 'Herzlich', 'Nachbarschaftshilfe'],
  pages: [page(CREAM, [
    ellipse('Kreis oben', 82, -34, 100, 100, '#efe3c8', { locked: true }),
    ellipse('Herz Kreis', 14, 16, 34, 34, BERRY, { locked: true }),
    icon('Herz', 'heart-handshake', 21, 23, 20, '#ffffff', 1.8, { locked: true }),
    text('Titel', 12, 58, 124, 36, 'Hilfe, die\nankommt.', { f: 'Nunito', w: 900, s: 35, c: OLIVE, a: 'left', v: 'top', wrap: true, lh: 1.08, min: 20 }),
    text('Untertitel', 12, 96, 118, 14, 'Haushaltshilfe mit Herz für Seniorinnen, Senioren und Familien in Musterstadt.', { f: 'Nunito', s: 11, c: '#4b4b3a', a: 'left', v: 'top', wrap: true, lh: 1.4, min: 7 }),
    rect('Liste Karte', 10, 116, 128, 50, '#ffffff', { radius: 5, shadow: shadow('#5e7330', 0.14, 4, 0, 1) }),
    todo(1, 122, 'Putzen, Wäsche und Bügeln'),
    todo(2, 133, 'Einkaufen und Besorgungen'),
    todo(3, 144, 'Kochen und Begleitung zu Terminen'),
    todo(4, 155, 'Gartenarbeit und Kleinigkeiten'),
    rect('Angebot Band', 10, 172, 128, 14, BERRY, { radius: 7 }),
    text('Angebot Text', 10, 172, 128, 14, 'Kostenloses Kennenlernen – ruf einfach an!', { f: 'Nunito', w: 800, s: 11, c: '#ffffff', a: 'center', min: 7 }),
    text('Name', 12, 191, 124, 7, 'Maria Lehmann  ·  Hilfe im Alltag', { f: 'Nunito', w: 800, s: 11, c: OLIVE, a: 'center', min: 7 }),
    text('Kontakt', 12, 198, 124, 6, `${PHONE}  ·  ${WEB}`, { f: 'Nunito', s: 9, c: '#4b4b3a', a: 'center', min: 6 }),
  ])],
};

// ---- Preisliste: DIN lang, table of services with prices
const INK = '#12343b';
const row = (n, y, label, price) => [
  text(`Leistung ${n}`, 9, y, 55, 7, label, { f: 'Raleway', w: 600, s: 10, c: INK, a: 'left', min: 6 }),
  line(`Punkte ${n}`, 9, y + 8, 90, y + 8, '#b8cfd4', 0.3, { dash: 'dotted' }),
  text(`Preis ${n}`, 62, y, 28, 7, price, { f: 'Raleway', w: 800, s: 10, c: '#0f8b8d', a: 'right', min: 6 }),
];
const preisliste = {
  ...FAMILY,
  slug: 'flyer-reinigung-preisliste',
  name: 'Flyer DIN lang – Reinigung Preisliste',
  variant: 'Preisliste',
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  description: 'Sachlicher DIN-lang-Flyer mit Preisliste für Reinigung und Haushaltshilfe: dunkler Kopf mit Funkeln, sieben Leistungen mit Preis auf Punktlinien, Hinweis auf Festpreise und Kontaktfeld.',
  tags: ['Flyer', 'DIN lang', 'Reinigung', 'Preisliste', 'Haushaltshilfe', 'Putzservice', 'Festpreis', 'Fensterreinigung', 'Leistungen', 'Preise'],
  pages: [page('#ffffff', [
    rect('Kopf', 0, 0, 99, 56, INK, { locked: true }),
    ellipse('Kreis', 60, -14, 56, 56, '#0f8b8d', { opacity: 0.55, locked: true }),
    icon('Funkeln', 'sparkles', 72, 12, 16, '#ffffff', 1.5, { locked: true }),
    text('Etikett', 9, 14, 50, 5, 'Preisliste', { f: 'Raleway', w: 700, s: 8, c: '#7fd6d8', up: true, ls: 0.26, min: 6 }),
    text('Titel', 9, 21, 70, 28, 'Sauber\nzum Festpreis', { f: 'Raleway', w: 800, s: 19, c: '#ffffff', a: 'left', v: 'top', wrap: true, lh: 1.15, min: 11 }),
    row(1, 66, 'Wohnung, bis 60 m²', typo.euro(89, 0)),
    row(2, 77, 'Wohnung, bis 100 m²', typo.euro(129, 0)),
    row(3, 88, 'Fenster pro Stück', typo.euro(4.5)),
    row(4, 99, 'Treppenhaus pro Etage', typo.euro(15, 0)),
    row(5, 110, 'Büro pro Stunde', typo.euro(26, 0)),
    row(6, 121, 'Umzugsreinigung ab', typo.euro(149, 0)),
    row(7, 132, 'Haushaltshilfe pro Stunde', typo.euro(24, 0)),
    text('Hinweis', 9, 146, 81, 14, 'Alle Preise inklusive Reinigungsmittel und Anfahrt in Musterstadt.', { f: 'Raleway', i: true, s: 8, c: '#4b6a70', a: 'left', v: 'top', wrap: true, lh: 1.45, min: 6 }),
    rect('Kontaktfeld', 9, 168, 81, 30, '#e6f4f4', { radius: 3 }),
    text('Kontakt Titel', 13, 171, 73, 6, 'Kostenloses Angebot', { f: 'Raleway', w: 800, s: 10, c: INK, a: 'left', min: 6 }),
    text('Kontakt', 13, 178, 73, 17, `${PHONE}\n${WEB}\nmo bis fr, 8${typo.dash}17 Uhr`, { f: 'Raleway', w: 500, s: 8.5, c: '#2b5560', a: 'left', v: 'top', wrap: true, lh: 1.45, min: 6 }),
  ])],
};

module.exports = { variants: [sauber, haushaltshilfe, preisliste] };
