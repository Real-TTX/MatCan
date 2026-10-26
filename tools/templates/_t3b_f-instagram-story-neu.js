'use strict';
const { text, rect, ellipse, line, icon, frame, deko, page, shadow } = require('./dsl');
const { family } = require('./_t3b-lib');

const common = {
  no: 411, category: 'Social Media', family: 'instagram-story-neu', familyName: 'Instagram-Story Neuheit', occasion: 'Social Media',
  tags: ['Instagram', 'Story', 'Neu', 'Neuheit', 'Social Media', 'Foto', 'Ankündigung'],
  formatKey: 'instagram-story', unit: 'px', width: 1080, height: 1920,
};

// Document unit px; 1 pt = 1.333 px. Top and bottom 250 px of a story are covered by the app: content stays between.
// ------------------------------------------------------------------ Pastell: Kreisfoto im Pinselring
const PEACH = '#fbe3d6';
const COCOA = '#4b2e2b';
const pastell = {
  slug: 'instagram-story-neu-pastell', name: 'Instagram-Story – Neu im Sortiment (Pastell)', variant: 'Pastell',
  description: 'Sanfte Story (1080 × 1920 px) für eine Neuheit: rundes Foto im goldenen Pinselring, Überschrift in Schreibschrift, Produktname, Preis und Knopf „Jetzt im Laden“. Ziehe dein Foto in den Kreis und ändere die Texte.',
  tags: ['Pastell', 'Rund', 'Sanft', 'Boutique', 'Café', 'Bäckerei', 'Neuheit'],
  pages: [page(PEACH, [
    ellipse('Kreis oben', -240, -120, 700, 700, '#f6cdbb', { locked: true }),
    ellipse('Kreis unten', 700, 1300, 620, 620, '#f9d9a8', { opacity: 0.7, locked: true }),
    text('Überschrift', 90, 280, 900, 150, 'Neu im Sortiment', { f: 'Dancing Script', s: 78, w: 700, c: COCOA, a: 'center', lh: 1.1, min: 40 }),
    ellipse('Foto Hintergrund', 170, 470, 740, 740, '#f1c3ae'),
    icon('Foto Symbol', 'image', 440, 740, 200, '#d49a82', 1.2),
    frame('Foto', 170, 470, 740, 740, { mask: 'circle' }),
    deko('Pinselring', 'deko-formen-pinselring-gold', 130, 430, 820, undefined, { locked: true }),
    text('Produkt', 90, 1260, 900, 90, 'Dein neues Lieblingsstück', { f: 'Poppins', s: 40, w: 700, c: COCOA, a: 'center', min: 22 }),
    text('Beschreibung', 140, 1352, 800, 100, 'Handgemacht aus regionalen Zutaten', { f: 'Montserrat', s: 22, w: 500, c: '#7a5650', a: 'center', v: 'top', wrap: true, lh: 1.35, min: 14 }),
    text('Knopf', 280, 1480, 520, 88, 'ab 4,90 € · jetzt im Laden', { f: 'Montserrat', s: 17, w: 700, c: '#ffffff', a: 'center', background: { color: COCOA, radius: 44, padding: 28 }, wrap: false, fit: 'none' }),
  ])],
};

// ------------------------------------------------------------------ Bold: Schwarz, riesiges NEU, schräges Foto
const bold = {
  slug: 'instagram-story-neu-bold', name: 'Instagram-Story – Neu im Laden (Bold)', variant: 'Bold',
  description: 'Kräftige Story (1080 × 1920 px) für eine Neuheit: schwarzer Grund, riesiges gelbes „NEU“, leicht gedrehtes Fotofeld, Produktname und Preis. Ziehe ein Foto in den Rahmen und ändere die Texte.',
  tags: ['Bold', 'Schwarz', 'Gelb', 'Streetfood', 'Laden', 'Drop', 'Release'],
  pages: [page('#101010', [
    rect('Band oben', 0, 262, 1080, 10, '#ffd23f', { locked: true }),
    text('Neu', 40, 280, 1000, 420, 'NEU', { f: 'Anton', s: 330, c: '#ffd23f', a: 'center', lh: 1, min: 120 }),
    text('Unterzeile', 90, 690, 900, 70, 'ab sofort im Laden', { f: 'Montserrat', s: 24, w: 700, c: '#ffffff', a: 'center', up: true, ls: 0.28, min: 14 }),
    rect('Foto Hintergrund', 150, 820, 780, 640, '#2a2a2a', { rotation: -4, radius: 24 }),
    icon('Foto Symbol', 'image', 440, 1060, 200, '#555555', 1.2, { rotation: -4 }),
    frame('Foto', 150, 820, 780, 640, { mask: 'rounded', radius: 24, rotation: -4, border: { color: '#ffffff', width: 5 } }),
    text('Preis', 640, 1380, 340, 110, 'ab 4,90 €', { f: 'Anton', s: 40, c: '#101010', a: 'center', background: { color: '#ffd23f', radius: 12, padding: 26 }, rotation: 4, wrap: false, fit: 'none', shadow: shadow('#000000', 0.4, 12, 0, 8) }),
    text('Produkt', 90, 1520, 900, 90, 'Dein neues Lieblingsprodukt', { f: 'Poppins', s: 34, w: 700, c: '#ffffff', a: 'left', min: 18 }),
    text('Adresse', 90, 1594, 900, 50, 'Hofladen Wiesengrund · Dorfstraße 12', { f: 'Montserrat', s: 18, w: 500, c: '#b8b8b8', a: 'left', min: 12 }),
  ])],
};

module.exports = family(common, [pastell, bold]);
