'use strict';
const { dsl, pt, ADDRESS, PHONE, WEB, infoRow } = require('./_t3a-lib');
const { text, rect, ellipse, shape, icon, frame, deko, dekoIn, dekoCorners, group, page, typo, qr, line, gradient, shadow } = dsl;

const FAMILY = { family: 'flyer-spendenaufruf', familyName: 'Flyer Spendenaufruf', occasion: 'Verein & Schule', category: 'Flyer' };

// ---- Barometer: A5, red heart, donation thermometer and bank details
const RED = '#c92a3b';
const CREAM = '#fff6f1';
const barometer = {
  ...FAMILY,
  slug: 'flyer-spendenaufruf-barometer',
  name: 'Flyer A5 – Spendenaufruf Barometer',
  variant: 'Barometer',
  formatKey: 'a5-portrait', width: 148, height: 210,
  description: 'Warmer A5-Spendenaufruf für Verein, Kita oder Sammelaktion: großes Herz, Titel „Hilf uns helfen“, Spendenbarometer mit Zwischenstand, Bankverbindung zum Eintragen und Dank an alle Unterstützer.',
  tags: ['Flyer', 'Spendenaufruf', 'Spenden', 'Spendenbarometer', 'Spendensammlung', 'Verein', 'Kita', 'Hilfe', 'IBAN', 'Gemeinnützig'],
  pages: [page(CREAM, [
    deko('Herz', 'deko-herzen-voll-rose', 52, 10, 44, undefined, { locked: true }),
    text('Titel', 12, 58, 124, 36, 'Hilf uns\nzu helfen', { f: 'Playfair Display', w: 800, s: 33, c: RED, a: 'center', v: 'top', wrap: true, lh: 1.1, min: 18 }),
    text('Text', 16, 98, 116, 22, 'Für den Umbau unseres Spielplatzes brauchen wir deine Hilfe. Jeder Euro bringt Kinderaugen zum Leuchten.', { f: 'Source Sans 3', s: 10.5, c: '#4a3a3a', a: 'center', v: 'top', wrap: true, lh: 1.45, min: 7 }),
    text('Stand Titel', 16, 126, 116, 5, 'SPENDENSTAND', { f: 'Source Sans 3', w: 800, s: 8, c: RED, ls: 0.2, a: 'left', min: 5 }),
    rect('Barometer Rahmen', 16, 133, 116, 10, '#f3d9d4', { radius: 5, locked: true }),
    rect('Barometer Füllung', 16, 133, 74, 10, RED, { radius: 5 }),
    text('Barometer Text', 16, 144, 116, 8, `${typo.euro(6400, 0)} von ${typo.euro(10000, 0)} gesammelt`, { f: 'Source Sans 3', w: 700, s: 11, c: '#3a2a2a', a: 'left', min: 7 }),
    rect('Bank Karte', 16, 158, 116, 30, '#ffffff', { radius: 4, shadow: shadow('#c92a3b', 0.14, 4, 0, 1) }),
    text('Bank Kopf', 21, 161, 100, 5, 'SPENDENKONTO', { f: 'Source Sans 3', w: 800, s: 7.5, c: RED, ls: 0.18, a: 'left', min: 5 }),
    text('Bank', 21, 167, 106, 19, 'Förderverein Kita Sonnenschein e. V.\nIBAN: DE12 3456 7890 1234 5678 90\nVerwendungszweck: Spielplatz', { f: 'IBM Plex Mono', s: 8.2, c: '#2a2a2a', a: 'left', v: 'top', wrap: true, lh: 1.55, min: 5 }),
    text('Dank', 12, 194, 124, 7, 'Danke! Spenden sind steuerlich absetzbar.', { f: 'Playfair Display', i: true, s: 10.5, c: RED, a: 'center', min: 7 }),
    text('Web', 12, 201, 124, 5, WEB, { f: 'Source Sans 3', s: 8, c: '#7a6a6a', a: 'center', min: 6 }),
  ])],
};

// ---- Mahlzeiten: A4, dark teal poster with what a donation does
const TEAL = '#0b3c49';
const SAND = '#f5e6c8';
const impact = (n, y, amount, what) => [
  text(`Betrag ${n}`, 20, y, 60, 22, amount, { f: 'Playfair Display', w: 800, s: 46, c: '#ffd166', a: 'right', lh: 1.1, min: 22 }),
  text(`Wirkung ${n}`, 88, y, 104, 22, what, { f: 'Source Sans 3', w: 600, s: 21, c: '#ffffff', a: 'left', v: 'middle', wrap: true, lh: 1.25, min: 10 }),
  line(`Linie ${n}`, 20, y + 27, 190, y + 27, '#2a6677', 0.4),
];
const wirkung = {
  ...FAMILY,
  slug: 'flyer-spendenaufruf-wirkung',
  name: 'Flyer A4 – Spendenaufruf Wirkung',
  variant: 'Wirkung',
  formatKey: 'a4-portrait', width: 210, height: 297,
  description: 'Eindringlicher A4-Spendenplakat für Tafel, Hilfsprojekt oder Kirchengemeinde: dunkles Petrol, Titel „Jede Spende kommt an“, drei Beträge mit ihrer Wirkung, QR-Code zur Online-Spende und Kontodaten.',
  tags: ['Flyer', 'Spendenaufruf', 'Spenden', 'Tafel', 'Hilfsprojekt', 'Kirchengemeinde', 'QR-Code', 'Wirkung', 'Plakat', 'Gemeinnützig'],
  pages: [page(TEAL, [
    text('Etikett', 20, 20, 170, 8, 'SPENDENAUFRUF', { f: 'Source Sans 3', w: 800, s: 13, c: '#ffd166', ls: 0.3, a: 'left', min: 8 }),
    text('Titel', 18, 30, 176, 62, 'Jede Spende\nkommt an.', { f: 'Playfair Display', w: 800, s: 54, c: '#ffffff', a: 'left', v: 'top', wrap: true, lh: 1.08, min: 28 }),
    text('Untertitel', 20, 100, 170, 18, 'Die Tafel Musterstadt versorgt jede Woche 300 Familien mit frischen Lebensmitteln.', { f: 'Source Sans 3', s: 15, c: SAND, a: 'left', v: 'top', wrap: true, lh: 1.4, min: 9 }),
    impact(1, 130, '10 €', 'sind eine Woche Obst und Gemüse für eine Familie'),
    impact(2, 160, '25 €', 'füllen einen Einkaufskorb mit Grundnahrungsmitteln'),
    impact(3, 190, '50 €', 'sichern eine Woche Kühlung in unserer Ausgabestelle'),
    rect('QR Karte', 20, 228, 52, 52, '#ffffff', { radius: 3 }),
    qr('QR-Code', 24, 232, 44, `https://${WEB}/spenden`, { c: TEAL, bg: '#ffffff' }),
    text('QR Text', 80, 230, 110, 8, 'Online spenden', { f: 'Source Sans 3', w: 800, s: 17, c: '#ffd166', a: 'left', min: 9 }),
    text('Konto', 80, 240, 112, 40, 'Tafel Musterstadt e. V.\nIBAN DE12 3456 7890 1234 5678 90\nSparkasse Musterstadt\nSpendenquittung auf Wunsch', { f: 'Source Sans 3', s: 12.5, c: '#ffffff', a: 'left', v: 'top', wrap: true, lh: 1.55, min: 8 }),
  ])],
};

// ---- Tierheim: DIN lang, friendly, paw prints and donation steps
const MINT = '#e3f4ee';
const GREEN = '#1f7a5c';
const ORANGE = '#f08a24';
const tierheim = {
  ...FAMILY,
  slug: 'flyer-spendenaufruf-tierheim',
  name: 'Flyer DIN lang – Spendenaufruf Tierheim',
  variant: 'Tierheim',
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  description: 'Freundlicher DIN-lang-Flyer für Tierheim, Tierschutzverein oder Futterspenden: sanftes Mintgrün, Pfotenabdrücke, Titel „Bitte helft uns“ in Fredoka, drei Wege zu helfen und Kontodaten mit QR-Code.',
  tags: ['Flyer', 'DIN lang', 'Spendenaufruf', 'Tierheim', 'Tierschutz', 'Futterspende', 'Pfoten', 'Hunde', 'Katzen', 'Verein'],
  pages: [page(MINT, [
    ellipse('Kreis', 52, -24, 70, 70, '#c8e8dc', { locked: true }),
    icon('Pfote 1', 'paw-print', 66, 14, 18, GREEN, 1.6, { rotation: 14, opacity: 0.9 }),
    icon('Pfote 2', 'paw-print', 52, 32, 12, GREEN, 1.6, { rotation: -10, opacity: 0.6 }),
    text('Titel', 9, 18, 60, 42, 'Bitte\nhelft\nuns!', { f: 'Fredoka', w: 700, s: 33, c: GREEN, a: 'left', v: 'top', wrap: true, lh: 1.05, min: 18 }),
    text('Text', 9, 64, 81, 20, 'Im Tierheim Musterstadt warten 40 Hunde und Katzen auf ein neues Zuhause und auf deine Hilfe.', { f: 'Fredoka', s: 10, c: '#2f4a40', a: 'left', v: 'top', wrap: true, lh: 1.45, min: 7 }),
    infoRow('Weg 1', 'wallet', 9, 92, 81, '', 'Geld spenden', { f: 'Fredoka', c: '#1d3d32', icolor: ORANGE, ic: 7, vs: 12, vw: 600 }),
    infoRow('Weg 2', 'package', 9, 104, 81, '', 'Futter und Decken bringen', { f: 'Fredoka', c: '#1d3d32', icolor: ORANGE, ic: 7, vs: 12, vw: 600 }),
    infoRow('Weg 3', 'heart-handshake', 9, 116, 81, '', 'Patenschaft übernehmen', { f: 'Fredoka', c: '#1d3d32', icolor: ORANGE, ic: 7, vs: 12, vw: 600 }),
    rect('Konto Karte', 9, 134, 81, 58, '#ffffff', { radius: 4 }),
    qr('QR-Code', 14, 138, 34, `https://${WEB}/spenden`, { c: GREEN, bg: '#ffffff' }),
    text('QR Text', 51, 140, 37, 22, 'Jetzt online spenden', { f: 'Fredoka', w: 600, s: 10.5, c: GREEN, a: 'left', v: 'top', wrap: true, lh: 1.25, min: 7 }),
    text('Konto', 14, 176, 72, 14, 'Tierschutzverein Musterstadt\nIBAN DE12 3456 7890 1234 5678 90', { f: 'IBM Plex Mono', s: 7.4, c: '#2a2a2a', a: 'left', v: 'top', wrap: true, lh: 1.6, min: 5 }),
    text('Dank', 9, 197, 81, 8, 'Danke von allen Fellnasen!', { f: 'Fredoka', w: 600, s: 11, c: ORANGE, a: 'center', min: 7 }),
  ])],
};

module.exports = { variants: [barometer, wirkung, tierheim] };
