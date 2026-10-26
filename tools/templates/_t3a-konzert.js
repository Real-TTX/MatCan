'use strict';
const { dsl, pt, ADDRESS, PHONE, WEB, infoRow } = require('./_t3a-lib');
const { text, rect, ellipse, shape, icon, frame, deko, dekoIn, group, page, typo, qr, line, gradient, shadow } = dsl;

const FAMILY = { family: 'flyer-konzert', familyName: 'Flyer Konzert', occasion: 'Feste & Events', category: 'Flyer' };

// ---- Bühne: A5, dark violet gradient, spotlights and a vinyl record
const PINK = '#ff3d81';
const bühne = {
  ...FAMILY,
  slug: 'flyer-konzert-buehne',
  name: 'Flyer A5 – Konzert Bühne',
  variant: 'Bühne',
  formatKey: 'a5-portrait', width: 148, height: 210,
  description: 'A5-Flyer für ein Rock- oder Pop-Konzert: dunkler Violettverlauf, Scheinwerferkegel, eine Schallplatte als Blickfang, Bandname in Bebas Neue und Eintrittspreis mit Vorverkauf.',
  tags: ['Flyer', 'Konzert', 'Live', 'Band', 'Rock', 'Pop', 'Open Air', 'Schallplatte', 'Eintritt', 'Vorverkauf'],
  pages: [page(gradient(170, '#120d2b', '#3b1670'), [
    shape('triangle', 'Scheinwerfer links', -16, -8, 70, 130, '#ffffff', { opacity: 0.07, rotation: 22, locked: true }),
    shape('triangle', 'Scheinwerfer rechts', 94, -8, 70, 130, '#ffffff', { opacity: 0.07, rotation: -22, locked: true }),
    ellipse('Platte', 28, 20, 92, 92, '#0b0b12', { locked: true }),
    ellipse('Rille 1', 34, 26, 80, 80, null, { stroke: '#2a2a3c', sw: 0.6, locked: true }),
    ellipse('Rille 2', 40, 32, 68, 68, null, { stroke: '#2a2a3c', sw: 0.6, locked: true }),
    ellipse('Rille 3', 46, 38, 56, 56, null, { stroke: '#2a2a3c', sw: 0.6, locked: true }),
    ellipse('Etikett', 53, 45, 42, 42, PINK, { locked: true }),
    ellipse('Etikett Loch', 71, 63, 6, 6, '#120d2b', { locked: true }),
    text('Etikett Text', 55, 49, 38, 8, 'LIVE', { f: 'Bebas Neue', s: 16, c: '#ffffff', a: 'center', ls: 0.2, min: 8 }),
    text('Etikett Text unten', 55, 75, 38, 8, '2026', { f: 'Bebas Neue', s: 14, c: '#ffffff', a: 'center', ls: 0.2, min: 8 }),
    text('Anlass', 12, 115, 124, 7, 'LIVE IN CONCERT', { f: 'Bebas Neue', s: 20, c: PINK, a: 'center', ls: 0.3, min: 10 }),
    text('Band', 8, 123, 132, 38, 'THE MIDNIGHT\nROADS', { f: 'Bebas Neue', s: 54, c: '#ffffff', a: 'center', wrap: true, lh: 0.95, min: 26, v: 'middle' }),
    text('Datum', 12, 163, 124, 10, `Freitag, 18. September  ·  20 Uhr`, { f: 'Montserrat', w: 700, s: 12, c: '#ffffff', a: 'center', min: 8 }),
    text('Ort', 12, 173, 124, 7, 'Kulturfabrik Musterstadt  ·  Einlass 19 Uhr', { f: 'Montserrat', s: 9.5, c: '#c9bff0', a: 'center', min: 7 }),
    rect('Ticketband', 16, 184, 116, 16, PINK, { radius: 3 }),
    text('Ticket', 20, 184, 108, 16, `Tickets ${typo.euro(18, 0)} im Vorverkauf  ·  ${typo.euro(22, 0)} Abendkasse`, { f: 'Montserrat', w: 700, s: 9.5, c: '#ffffff', a: 'center', min: 6 }),
    text('Web', 12, 202, 124, 5, `Karten: ${WEB}/tickets`, { f: 'Montserrat', s: 7.5, c: '#8f86c0', a: 'center', min: 6 }),
  ])],
};

// ---- Retro: A5 landscape, setting sun made of stripes, Righteous
const CREAM = '#fff0d6';
const SUN1 = '#ff5e5b';
const SUN2 = '#ff9f1c';
const stripes = [];
for (let i = 0; i < 6; i++) {
  const h = 3.4 - i * 0.4;
  stripes.push(rect('Sonne Streifen ' + (i + 1), 118, 78 + i * 7.2, 80, 7.2 - (i + 1) * 0.55, i < 3 ? SUN1 : SUN1, { locked: true }));
}
const retro = {
  ...FAMILY,
  slug: 'flyer-konzert-retro',
  name: 'Flyer A5 quer – Konzert Retro',
  variant: 'Retro',
  formatKey: 'a5-landscape', width: 210, height: 148,
  description: 'Querformatiger A5-Flyer im 70er-Stil für ein Sommer-Konzert oder eine Jam-Session: untergehende Sonne aus Streifen, Righteous-Titel in Creme und Orange, Datum und Ort in einer Zeile.',
  tags: ['Flyer', 'Konzert', 'Retro', '70er', 'Sommer', 'Open Air', 'Jam Session', 'Querformat', 'Live', 'Festival'],
  pages: [page('#2b1a4a', [
    ellipse('Sonne', 112, 6, 88, 88, SUN2, { locked: true }),
    ellipse('Sonne Glut', 120, 14, 72, 72, SUN1, { opacity: 0.6, locked: true }),
    ...Array.from({ length: 6 }, (_, i) => rect('Streifen ' + (i + 1), 104, 62 + i * 5.4, 104, 0.8 + i * 0.5, '#2b1a4a', { locked: true })),
    rect('Horizont', 0, 92, 210, 56, '#2b1a4a', { locked: true }),
    rect('Horizontlinie', 0, 92, 210, 0.8, SUN2, { opacity: 0.6, locked: true }),
    text('Etikett', 14, 14, 90, 8, 'SOMMER OPEN AIR', { f: 'Righteous', s: 13, c: SUN2, ls: 0.22, min: 8, a: 'left' }),
    text('Titel', 12, 24, 130, 52, 'Sunset\nSessions', { f: 'Righteous', s: 58, c: CREAM, a: 'left', v: 'top', wrap: true, lh: 1.02, min: 28 }),
    text('Bands', 14, 98, 120, 9, 'mit Lena Wolff, Funkhaus & The Birds', { f: 'Source Sans 3', w: 600, s: 12, c: CREAM, a: 'left', min: 8 }),
    rect('Datum Band', 0, 108, 210, 22, SUN2, { locked: true }),
    text('Datum', 14, 108, 100, 22, 'Sa, 25. Juli · 17 Uhr', { f: 'Righteous', s: 19, c: '#2b1a4a', a: 'left', min: 10 }),
    text('Ort', 110, 108, 88, 22, 'Wiese am See, Musterstadt', { f: 'Righteous', s: 14, c: '#2b1a4a', a: 'right', min: 8 }),
    text('Fußzeile', 14, 134, 182, 6, `Eintritt frei, Hut geht rum  ·  Decken und Picknick mitbringen  ·  ${WEB}`, { f: 'Source Sans 3', s: 8.5, c: '#d9c8f5', a: 'left', min: 6 }),
  ])],
};

// ---- Klassik: DIN lang, cream, Roman capitals, gold ornaments
const IVORY = '#faf5e8';
const GOLD = '#a8832f';
const NIGHT = '#1d2540';
const klassik = {
  ...FAMILY,
  slug: 'flyer-konzert-klassik',
  name: 'Flyer DIN lang – Konzert Klassik',
  variant: 'Klassik',
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  description: 'Festlicher DIN-lang-Flyer für ein Kirchen- oder Benefizkonzert: elfenbeinfarbener Grund, goldener Rahmen und Schnörkel, Titel in Cinzel, Programm mit Komponisten und Hinweis auf Spenden.',
  tags: ['Flyer', 'DIN lang', 'Konzert', 'Klassik', 'Kirchenkonzert', 'Benefizkonzert', 'Chor', 'Orchester', 'Festlich', 'Programm'],
  pages: [page(IVORY, [
    dekoIn('Rahmen', 'deko-rahmen-doppellinie-lang-gold', 4, 4, 91, 202, { locked: true }),
    deko('Schnörkel', 'deko-ornamente-schnoerkel-breit-gold', 24, 16, 51, undefined, { locked: true }),
    text('Anlass', 10, 34, 79, 6, 'BENEFIZKONZERT', { f: 'Cinzel', w: 500, s: 8.5, c: GOLD, a: 'center', ls: 0.22, min: 6 }),
    text('Titel', 10, 42, 79, 34, 'Musik in\nSt. Martin', { f: 'Cinzel', w: 600, s: 25, c: NIGHT, a: 'center', wrap: true, lh: 1.2, min: 14, v: 'middle' }),
    text('Ensemble', 10, 78, 79, 12, 'Kammerchor Musterstadt\nund Kammerorchester', { f: 'Cormorant Garamond', i: true, w: 500, s: 12, c: '#4a4a5a', a: 'center', v: 'top', wrap: true, lh: 1.25, min: 8 }),
    deko('Trenner', 'deko-trenner-deco-gold', 22, 97, 55, undefined, { locked: true }),
    text('Programm Kopf', 10, 108, 79, 5, 'AUF DEM PROGRAMM', { f: 'Cinzel', w: 500, s: 7.2, c: GOLD, a: 'center', ls: 0.2, min: 5 }),
    text('Werk 1', 10, 115, 79, 12, 'Johann Sebastian Bach\nMagnificat in D-Dur', { f: 'Cormorant Garamond', w: 600, s: 11.5, c: NIGHT, a: 'center', v: 'top', wrap: true, lh: 1.25, min: 8 }),
    text('Werk 2', 10, 131, 79, 12, 'Wolfgang Amadeus Mozart\nAve verum corpus', { f: 'Cormorant Garamond', w: 600, s: 11.5, c: NIGHT, a: 'center', v: 'top', wrap: true, lh: 1.25, min: 8 }),
    text('Werk 3', 10, 147, 79, 12, 'Antonio Vivaldi\nGloria in D-Dur', { f: 'Cormorant Garamond', w: 600, s: 11.5, c: NIGHT, a: 'center', v: 'top', wrap: true, lh: 1.25, min: 8 }),
    text('Datum', 10, 165, 79, 8, 'Sonntag, 8. November', { f: 'Cinzel', w: 600, s: 11, c: NIGHT, a: 'center', min: 7 }),
    text('Zeit', 10, 172, 79, 6, `17 Uhr  ·  Eintritt frei`, { f: 'Cormorant Garamond', i: true, w: 600, s: 11.5, c: GOLD, a: 'center', min: 8 }),
    text('Ort', 10, 179, 79, 12, 'Kirche St. Martin\nKirchplatz 1, Musterstadt', { f: 'Cormorant Garamond', w: 500, s: 10.5, c: '#4a4a5a', a: 'center', v: 'top', wrap: true, lh: 1.25, min: 7 }),
    text('Spende', 10, 191, 79, 5, 'Um eine Spende für die Jugendarbeit wird gebeten.', { f: 'Cormorant Garamond', i: true, s: 8, c: '#6a6a7a', a: 'center', min: 6 }),
  ])],
};

module.exports = { variants: [bühne, retro, klassik] };
