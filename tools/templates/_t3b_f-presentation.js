'use strict';
const { text, rect, ellipse, line, icon, frame, deko, page, gradient, shadow } = require('./dsl');
const { family } = require('./_t3b-lib');

const common = {
  no: 470, category: 'Business', family: 'presentation', familyName: 'Präsentation Titelfolie', occasion: 'Business',
  tags: ['Präsentation', 'Titelfolie', 'Folie', 'Vortrag', 'Slide', 'PowerPoint', 'Pitch', 'Business', 'Schule', 'Referat'],
  formatKey: 'presentation', unit: 'px', width: 1920, height: 1080,
};

// Document unit px; 1 pt = 1.333 px.
// ------------------------------------------------------------------ Business blau: Farbfläche links, Titel rechts
const BLUE = '#1f4fd8';
const business = {
  slug: 'praesentation-business', name: 'Präsentation – Titelfolie Business', variant: 'Business',
  description: 'Titelfolie für Vorträge und Pitches (1920 × 1080 px): kräftige blaue Fläche mit Logo-Rahmen, großer Titel, Untertitel, Name und Datum. Ändere die Texte, ziehe dein Logo in den Rahmen und lade die Folie als Bild herunter.',
  tags: ['Business', 'Blau', 'Pitch', 'Konzernlook', 'Firma', 'Quartalsbericht'],
  pages: [page('#ffffff', [
    rect('Fläche', 0, 0, 640, 1080, gradient(160, BLUE, '#16339a'), { locked: true }),
    ellipse('Kreis oben', -160, -200, 560, 560, '#ffffff', { opacity: 0.08, locked: true }),
    ellipse('Kreis unten', 280, 760, 640, 640, '#ffffff', { opacity: 0.07, locked: true }),
    rect('Logo Kachel', 100, 100, 180, 180, '#ffffff', { radius: 32, opacity: 0.18 }),
    icon('Logo Symbol', 'sparkles', 156, 156, 68, '#ffffff', 1.6),
    frame('Logo', 100, 100, 180, 180, { mask: 'rounded', radius: 32 }),
    text('Reihe', 100, 880, 440, 90, 'Hofladen Wiesengrund', { f: 'Inter', s: 22, w: 600, c: '#dbe5ff', v: 'bottom', wrap: true, lh: 1.3, min: 12 }),
    text('Kicker', 760, 250, 1000, 50, 'Jahresbericht', { f: 'Inter', s: 20, w: 700, c: BLUE, up: true, ls: 0.24, min: 12 }),
    text('Titel', 760, 310, 1060, 330, 'Ein starkes Jahr für die Region', { f: 'Inter', s: 78, w: 800, c: '#0f172a', v: 'top', wrap: true, lh: 1.08, fit: 'shrink', min: 36 }),
    rect('Akzent', 764, 660, 140, 8, BLUE, { locked: true }),
    text('Untertitel', 760, 700, 1060, 100, 'Rückblick, Zahlen und Ausblick auf das kommende Jahr', { f: 'Inter', s: 28, w: 400, c: '#475569', v: 'top', wrap: true, lh: 1.3, min: 16 }),
    text('Sprecher', 760, 900, 1060, 50, 'Anna Beispiel · Geschäftsführung', { f: 'Inter', s: 21, w: 600, c: '#0f172a', min: 12 }),
    text('Datum', 760, 950, 1060, 50, '12. Juni 2027', { f: 'Inter', s: 20, w: 400, c: '#64748b', min: 12 }),
  ])],
};

// ------------------------------------------------------------------ Elegant minimal: Weiß, Serife, feine Linien
const minimal = {
  slug: 'praesentation-minimal', name: 'Präsentation – Titelfolie Minimal', variant: 'Minimal',
  description: 'Ruhige Titelfolie (1920 × 1080 px) mit viel Weißraum: großer Titel in Antiqua, feine Linie, Untertitel und Angaben zum Vortrag klein am Rand. Ändere die Texte und lade die Folie als Bild herunter.',
  tags: ['Minimal', 'Weiß', 'Antiqua', 'Vortrag', 'Referat', 'Universität', 'Kunst', 'Elegant'],
  pages: [page('#fbfaf7', [
    rect('Rahmen', 60, 60, 1800, 960, null, { stroke: '#1a1a1a', sw: 1.5, locked: true }),
    text('Kicker', 160, 160, 1000, 50, 'Vortrag', { f: 'Raleway', s: 18, w: 600, c: '#8a6a3a', up: true, ls: 0.4, min: 12 }),
    text('Titel', 160, 260, 1500, 400, 'Vom Samen zum Brot', { f: 'Cormorant Garamond', s: 140, w: 600, c: '#1a1a1a', v: 'top', wrap: true, lh: 1.02, fit: 'shrink', min: 50 }),
    line('Linie', 160, 700, 560, 700, '#8a6a3a', 3, { locked: true }),
    text('Untertitel', 160, 730, 1300, 100, 'Eine kleine Geschichte des Getreides in unserer Region', { f: 'Cormorant Garamond', s: 38, i: true, w: 500, c: '#4a4a4a', v: 'top', wrap: true, lh: 1.25, min: 20 }),
    text('Sprecher', 160, 900, 800, 50, 'Anna Beispiel', { f: 'Raleway', s: 20, w: 600, c: '#1a1a1a', min: 12 }),
    text('Datum', 1060, 900, 700, 50, 'Musterstadt, 12. Juni 2027', { f: 'Raleway', s: 20, w: 400, c: '#6a6a6a', a: 'right', min: 12 }),
  ])],
};

// ------------------------------------------------------------------ Kreativ: bunte Formen
const kreativ = {
  slug: 'praesentation-kreativ', name: 'Präsentation – Titelfolie Kreativ', variant: 'Kreativ',
  description: 'Lebendige Titelfolie (1920 × 1080 px) für Workshops, Schule und Kreativprojekte: bunte Formen, Titel in runder, fetter Schrift, Untertitel und Namensetikett. Ändere die Texte und lade die Folie als Bild herunter.',
  tags: ['Kreativ', 'Bunt', 'Workshop', 'Schule', 'Referat', 'Formen', 'Jung', 'Poppins'],
  pages: [page('#fff4e0', [
    deko('Form 1', 'deko-formen-blob-1-rose', 1180, -120, 760, undefined, { locked: true }),
    deko('Form 2', 'deko-formen-blob-3-gold', 1400, 560, 640, undefined, { locked: true }),
    deko('Form 3', 'deko-formen-blob-2-navy', 1090, 330, 360, undefined, { locked: true }),
    deko('Sonne', 'deko-formen-sonne-bunt', 1590, 120, 230, undefined, { locked: true }),
    text('Kicker', 120, 190, 900, 60, 'Workshop', { f: 'Poppins', s: 21, w: 700, c: '#ffffff', up: true, ls: 0.2, background: { color: '#e8553d', radius: 36, padding: 28 }, wrap: false, fit: 'none' }),
    text('Titel', 120, 310, 1050, 380, 'Ideen, die ins Rollen kommen', { f: 'Poppins', s: 84, w: 800, c: '#2a1a4a', v: 'top', wrap: true, lh: 1.08, fit: 'shrink', min: 40 }),
    text('Untertitel', 120, 720, 1000, 112, 'Gemeinsam entwickeln wir Projekte für unsere Stadt', { f: 'Poppins', s: 30, w: 500, c: '#4a3a6a', v: 'top', wrap: true, lh: 1.3, min: 18 }),
    text('Sprecher', 120, 900, 800, 56, 'Mit Anna Beispiel und Jo Kurz', { f: 'Poppins', s: 22, w: 700, c: '#e8553d', min: 12 }),
    text('Datum', 120, 960, 800, 50, '12. Juni 2027 · Kulturhaus', { f: 'Poppins', s: 20, w: 400, c: '#4a3a6a', min: 12 }),
  ])],
};

module.exports = family(common, [business, minimal, kreativ]);
