'use strict';
const { dsl, pt, ADDRESS, PHONE, WEB, infoRow } = require('./_t3a-lib');
const { text, rect, ellipse, shape, icon, frame, deko, dekoIn, dekoCorners, group, page, typo, qr, line, gradient, shadow } = dsl;

const FAMILY = { family: 'plakat-typo', familyName: 'Typo-Plakat', occasion: 'Feste & Events', category: 'Poster' };

// ---- Riesenwort: A3 portrait, one word turned by 90 degrees along the page
const BEIGE = '#f1ebdf';
const RED = '#d7263d';
const INK = '#161616';
const riesenwort = {
  ...FAMILY,
  slug: 'plakat-typo-riesenwort',
  name: 'Poster A3 – Typo Riesenwort',
  variant: 'Riesenwort',
  formatKey: 'poster-a3-portrait', width: 297, height: 420,
  description: 'Reines Schriftplakat im A3-Hochformat für Jazzabend, Konzert oder Lesung: ein einziges Wort in Anton, um 90 Grad gedreht über die ganze Seitenhöhe, daneben Datum, Ort und Programm in klarer Spalte.',
  tags: ['Plakat', 'Poster', 'Typografie', 'Schriftplakat', 'Jazz', 'Konzert', 'Riesenwort', 'Gedreht', 'Rot', 'Minimal'],
  pages: [page(BEIGE, [
    // a 400 x 150 mm box turned by -90 degrees: it fills the page height at x = 20 to 170
    text('Riesenwort', -105, 135, 410, 150, 'JAZZ', { f: 'Anton', s: 520, c: RED, a: 'center', lh: 1, min: 200, rotation: -90 }),
    text('Anlass', 186, 26, 96, 10, 'LIVE', { f: 'Inter', w: 800, s: 15, c: INK, ls: 0.3, a: 'left', min: 8 }),
    line('Linie oben', 186, 40, 277, 40, INK, 1.2, { locked: true }),
    text('Tag', 184, 48, 100, 40, '14', { f: 'Anton', s: 110, c: INK, a: 'left', lh: 1, min: 50 }),
    text('Monat', 186, 90, 96, 12, 'NOVEMBER', { f: 'Inter', w: 800, s: 15, c: RED, ls: 0.2, a: 'left', min: 8 }),
    text('Uhrzeit', 186, 104, 96, 8, '20 Uhr', { f: 'Inter', w: 500, s: 15, c: INK, a: 'left', min: 8 }),
    line('Linie mitte', 186, 128, 277, 128, INK, 0.5, { locked: true }),
    text('Programm', 186, 134, 96, 90, 'Lena Wolff\nQuartett\n\nMarlo Trio\nfeat. Anna Beck\n\nJam Session\nab 22 Uhr', { f: 'Inter', w: 600, s: 14, c: INK, a: 'left', v: 'top', wrap: true, lh: 1.5, min: 8 }),
    line('Linie unten', 186, 330, 277, 330, INK, 0.5, { locked: true }),
    text('Ort', 186, 336, 96, 40, 'Alte Brauerei\nSudhaus, Hofweg 4\n12345 Musterstadt', { f: 'Inter', w: 500, s: 12.5, c: INK, a: 'left', v: 'top', wrap: true, lh: 1.5, min: 7 }),
    text('Preis', 186, 380, 96, 20, `Eintritt ${typo.euro(15, 0)}\nVorverkauf ${WEB}`, { f: 'Inter', w: 500, s: 11, c: '#555555', a: 'left', v: 'top', wrap: true, lh: 1.5, min: 7 }),
  ])],
};

// ---- Zeilen: A3 portrait, a justified stack of lines in two typefaces
const zeilen = {
  ...FAMILY,
  slug: 'plakat-typo-zeilen',
  name: 'Poster A3 – Typo Zeilen',
  variant: 'Zeilen',
  formatKey: 'poster-a3-portrait', width: 297, height: 420,
  description: 'Redaktionelles A3-Schriftplakat für Lesung, Buchmesse oder Bibliotheksnacht: gestapelte Zeilen in Playfair und Inter, die das Format füllen, ein roter Akzent und Informationen in einer schmalen Fußzeile.',
  tags: ['Plakat', 'Poster', 'Typografie', 'Lesung', 'Buchmesse', 'Bibliothek', 'Schriftplakat', 'Zeilen', 'Redaktionell', 'Schwarz-Weiß'],
  pages: [page('#fbfaf7', [
    text('Zeile 1', 20, 20, 257, 30, 'Die lange', { f: 'Playfair Display', i: true, w: 400, s: 78, c: INK, a: 'left', lh: 1.1, min: 30 }),
    text('Zeile 2', 14, 52, 269, 78, 'NACHT', { f: 'Inter', w: 900, s: 190, c: INK, a: 'left', lh: 1, min: 60 }),
    text('Zeile 3', 20, 134, 257, 30, 'der', { f: 'Playfair Display', i: true, w: 400, s: 78, c: RED, a: 'left', lh: 1.1, min: 30 }),
    text('Zeile 4', 14, 160, 269, 80, 'BÜCHER', { f: 'Inter', w: 900, s: 110, c: INK, a: 'left', lh: 1, min: 40 }),
    rect('Balken', 20, 250, 257, 4, RED, { locked: true }),
    text('Info 1', 20, 262, 120, 60, '27. September\n18 bis 24 Uhr\nStadtbibliothek\nMarktplatz 3', { f: 'Inter', w: 700, s: 22, c: INK, a: 'left', v: 'top', wrap: true, lh: 1.35, min: 10 }),
    text('Info 2', 152, 262, 125, 60, 'Lesungen, Bücherflohmarkt,\nSchreibwerkstatt und\nSuppe um Mitternacht.', { f: 'Playfair Display', i: true, s: 20, c: INK, a: 'left', v: 'top', wrap: true, lh: 1.4, min: 10 }),
    line('Linie', 20, 372, 277, 372, INK, 0.6, { locked: true }),
    text('Fuß', 20, 378, 257, 12, `Eintritt frei  ·  ${WEB}  ·  Ein Abend der Stadtbibliothek Musterstadt`, { f: 'Inter', w: 600, s: 12, c: INK, a: 'left', min: 7 }),
  ])],
};

// ---- Hohl: A2 portrait, rows of hollow words and one solid line
const DARK = '#10151f';
const hohl = {
  ...FAMILY,
  slug: 'plakat-typo-hohl',
  name: 'Poster A2 – Typo Hohl',
  variant: 'Hohl',
  formatKey: 'poster-a2-portrait', width: 420, height: 594,
  description: 'Starkes A2-Schriftplakat für Tanzabend, Club oder Festival: zehn Zeilen mit hohlem Wort in Linienschrift, eine Zeile gefüllt in Gelb, davor eine weiße Infotafel mit Datum, Ort und Eintritt.',
  tags: ['Plakat', 'Poster', 'A2', 'Typografie', 'Tanzabend', 'Club', 'Hohlschrift', 'Wiederholung', 'Gelb', 'Dunkel'],
  pages: [page(DARK, [
    ...Array.from({ length: 9 }, (_, i) => text('Wiederholung ' + (i + 1), -10, 8 + i * 62, 440, 64, i === 4 ? 'TANZ TANZ TANZ' : 'TANZ TANZ TANZ', { f: 'Anton', s: 150, c: i === 4 ? '#ffd23f' : DARK, outline: i === 4 ? null : { color: '#3b4a68', width: 1.4 }, a: 'center', lh: 1, min: 60 })),
    rect('Tafel', 40, 360, 340, 186, '#ffffff', { locked: true }),
    text('Anlass', 60, 372, 300, 12, 'DER GROSSE', { f: 'Inter', w: 800, s: 22, c: '#10151f', ls: 0.3, a: 'left', min: 10 }),
    text('Titel', 58, 384, 304, 60, 'Tanzabend', { f: 'Anton', s: 120, c: '#10151f', a: 'left', lh: 1, min: 50 }),
    text('Datum', 60, 450, 300, 18, 'Freitag, 20. November, 21 Uhr', { f: 'Inter', w: 800, s: 30, c: '#c1121f', a: 'left', min: 14 }),
    text('Info', 60, 476, 300, 52, 'Stadthalle Musterstadt, Großer Saal\nMit Live-Band und DJ  ·  Eintritt 8 €\nTischreservierung unter ' + PHONE, { f: 'Inter', w: 500, s: 20, c: '#10151f', a: 'left', v: 'top', wrap: true, lh: 1.5, min: 10 }),
  ])],
};

module.exports = { variants: [riesenwort, zeilen, hohl] };
