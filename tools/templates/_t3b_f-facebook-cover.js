'use strict';
const { text, rect, ellipse, line, icon, frame, deko, page, gradient, shadow } = require('./dsl');
const { family } = require('./_t3b-lib');

const common = {
  no: 467, category: 'Social Media', family: 'facebook-cover', familyName: 'Facebook-Titelbild', occasion: 'Social Media',
  tags: ['Facebook', 'Titelbild', 'Cover', 'Banner', 'Kopfbild', 'Social Media', 'Seite', 'Firma', 'Verein', 'LinkedIn'],
  formatKey: 'facebook-cover', unit: 'px', width: 1640, height: 624,
};

// Document unit px; 1 pt = 1.333 px. On a computer the round profile picture covers the lower left (about 330 px wide, 250 px high): nothing important sits there.
// ------------------------------------------------------------------ Hofladen: Cremeton, grüne Welle, Merkmale
const GRN = '#3f6b4c';
const hof = {
  slug: 'facebook-cover-hofladen', name: 'Facebook-Titelbild – Hofladen', variant: 'Hofladen',
  description: 'Titelbild für deine Facebook-Seite (1640 × 624 px): Cremeton mit grüner Welle, großer Satz in Antiqua, Unterzeile und drei Merkmale mit Symbolen. Der Bereich links unten bleibt frei für dein rundes Profilbild.',
  tags: ['Hofladen', 'Bauernhof', 'Regional', 'Grün', 'Natur', 'Lebensmittel', 'Café', 'Antiqua'],
  pages: [page('#f7f1e1', [
    deko('Welle', 'deko-formen-wellenrand-salbei', 0, 440, 1640, undefined, { locked: true }),
    text('Titel', 560, 70, 1020, 150, 'Frisch vom Hof', { f: 'Playfair Display', s: 96, w: 700, c: '#233a2a', lh: 1, min: 40 }),
    text('Unterzeile', 560, 222, 1020, 70, 'Regionale Lebensmittel aus eigener Erzeugung', { f: 'Lora', s: 28, i: true, c: '#5c6b55', min: 16 }),
    icon('Merkmal 1', 'leaf', 560, 330, 56, GRN, 2),
    text('Merkmal 1 Text', 630, 330, 280, 56, 'Saisonal und bio', { f: 'Montserrat', s: 17, w: 700, c: '#233a2a', min: 10 }),
    icon('Merkmal 2', 'store', 940, 330, 56, GRN, 2),
    text('Merkmal 2 Text', 1010, 330, 280, 56, 'Hofladen und Café', { f: 'Montserrat', s: 17, w: 700, c: '#233a2a', min: 10 }),
    icon('Merkmal 3', 'truck', 1320, 330, 56, GRN, 2),
    text('Merkmal 3 Text', 1390, 330, 230, 56, 'Lieferservice', { f: 'Montserrat', s: 17, w: 700, c: '#233a2a', min: 10 }),
    text('Öffnungszeiten', 560, 392, 1060, 44, 'Mo bis Sa 8 bis 18 Uhr · Dorfstraße 12 · Musterstadt', { f: 'Montserrat', s: 17, w: 600, c: '#4a5d44', min: 10 }),
    deko('Ähren', 'deko-blumen-weizenaehren-gold', 1480, 40, 90, undefined, { opacity: 0.9, rotation: 12, locked: true }),
  ])],
};

// ------------------------------------------------------------------ Fest: Farbverlauf mit Wimpelkette
const fest = {
  slug: 'facebook-cover-fest', name: 'Facebook-Titelbild – Fest', variant: 'Fest',
  description: 'Fröhliches Titelbild für Vereine und Veranstaltungen (1640 × 624 px): Türkis-Violett-Verlauf, bunte Wimpelkette, großer Veranstaltungstitel mit Datum und Ort. Der Bereich links unten bleibt frei für dein rundes Profilbild.',
  tags: ['Fest', 'Verein', 'Veranstaltung', 'Wimpel', 'Bunt', 'Sommerfest', 'Event', 'Gemeinde'],
  pages: [page(gradient(110, '#12b5b0', '#6b3fd4'), [
    deko('Wimpelkette', 'deko-konfetti-wimpelkette-bunt', 500, -14, 1140, undefined, { locked: true }),
    ellipse('Kreis', 1180, 120, 700, 700, '#ffffff', { opacity: 0.08, locked: true }),
    text('Kopf', 560, 250, 1000, 50, 'Herzliche Einladung zum', { f: 'Montserrat', s: 17, w: 700, c: '#ffe27a', up: true, ls: 0.24, min: 10 }),
    text('Titel', 560, 296, 1060, 150, 'Sommerfest 2027', { f: 'Poppins', s: 80, w: 800, c: '#ffffff', lh: 1, min: 36, shadow: shadow('#2a1068', 0.3, 0, 4, 6) }),
    icon('Kalender', 'calendar', 560, 480, 48, '#ffe27a', 2.2),
    text('Datum', 624, 478, 480, 52, 'Samstag, 12. Juni', { f: 'Montserrat', s: 17, w: 700, c: '#ffffff', min: 10 }),
    icon('Ort', 'map-pin', 1090, 480, 48, '#ffe27a', 2.2),
    text('Ort', 1154, 478, 460, 52, 'Festplatz am See', { f: 'Montserrat', s: 17, w: 700, c: '#ffffff', min: 10 }),
  ])],
};

// ------------------------------------------------------------------ Business: dunkel mit Kreisen, Logo, Leistungen
const business = {
  slug: 'facebook-cover-business', name: 'Facebook-Titelbild – Business', variant: 'Business',
  description: 'Seriöses Titelbild für Firmen, Praxen und Beratungen (1640 × 624 px): Marineblau mit Kreisen, Logofeld, Firmenname, Leitsatz und drei Leistungen. Der Bereich links unten bleibt frei für dein rundes Profilbild.',
  tags: ['Business', 'Firma', 'Dienstleistung', 'Beratung', 'Marineblau', 'Praxis', 'Handwerk', 'LinkedIn', 'XING'],
  pages: [page(gradient(120, '#0f1d3d', '#1b3568'), [
    ellipse('Kreis groß', 1100, -240, 760, 760, '#3b82f6', { opacity: 0.16, locked: true }),
    ellipse('Kreis klein', 1400, 330, 360, 360, '#3b82f6', { opacity: 0.22, locked: true }),
    rect('Logo Kachel', 1420, 60, 150, 150, '#ffffff', { radius: 28, opacity: 0.12 }),
    icon('Logo Symbol', 'sparkles', 1470, 110, 50, '#ffffff', 1.6),
    frame('Logo', 1420, 60, 150, 150, { mask: 'rounded', radius: 28 }),
    text('Name', 560, 80, 840, 110, 'Wiesengrund Beratung', { f: 'Inter', s: 56, w: 800, c: '#ffffff', lh: 1, min: 30 }),
    text('Leitsatz', 560, 200, 840, 60, 'Gemeinsam nach vorn. Klar, ehrlich, persönlich.', { f: 'Inter', s: 24, w: 400, c: '#b7c6e6', min: 14 }),
    line('Linie', 560, 310, 1560, 310, '#ffffff', 2, { opacity: 0.25, locked: true }),
    icon('Leistung 1', 'target', 560, 360, 52, '#60a5fa', 2),
    text('Leistung 1 Text', 626, 358, 280, 56, 'Strategie', { f: 'Inter', s: 20, w: 700, c: '#ffffff', min: 12 }),
    icon('Leistung 2', 'users', 900, 360, 52, '#60a5fa', 2),
    text('Leistung 2 Text', 966, 358, 280, 56, 'Teamentwicklung', { f: 'Inter', s: 20, w: 700, c: '#ffffff', min: 12 }),
    icon('Leistung 3', 'chart-line', 1260, 360, 52, '#60a5fa', 2),
    text('Leistung 3 Text', 1326, 358, 280, 56, 'Wachstum', { f: 'Inter', s: 20, w: 700, c: '#ffffff', min: 12 }),
    text('Kontakt', 560, 500, 1000, 50, 'www.wiesengrund.example · 01234 56789', { f: 'Inter', s: 17, w: 500, c: '#8fa3cc', min: 11 }),
  ])],
};

module.exports = family(common, [hof, fest, business]);
