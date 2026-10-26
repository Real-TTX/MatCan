'use strict';
const { text, rect, ellipse, line, icon, deko, page, shadow } = require('./dsl');
const { family } = require('./_t3b-lib');

const common = {
  no: 409, category: 'Social Media', family: 'instagram-sale', familyName: 'Instagram-Beitrag Sale', occasion: 'Social Media',
  tags: ['Instagram', 'Beitrag', 'Sale', 'Rabatt', 'Angebot', 'Social Media', 'Facebook'],
  formatKey: 'instagram-post', unit: 'px', width: 1080, height: 1080,
};

// Document unit px: a font size is in points, 1 pt = 1.333 px.
// ------------------------------------------------------------------ Hell und ruhig: große Prozentzahl
const CORAL = '#ff5a3c';
const hell = {
  slug: 'instagram-sale-hell', name: 'Instagram-Beitrag – Sale hell', variant: 'Hell & ruhig',
  description: 'Ruhiger Sale-Beitrag für Instagram (1080 × 1080 px): heller Grund, riesige Prozentzahl in kräftiger Schrift, Hinweis auf das Sortiment und ein Knopf mit Zeitraum. Passe Rabatt, Text und Datum an.',
  tags: ['Hell', 'Ruhig', 'Mode', 'Boutique', 'Sommerschlussverkauf', 'Typografisch'],
  pages: [page('#f4efe7', [
    ellipse('Kreis', 640, -180, 640, 640, '#ffd9cc', { locked: true }),
    ellipse('Kreis klein', -120, 840, 360, 360, '#ffe9a8', { locked: true }),
    text('Anlass', 90, 96, 700, 50, 'Sommer-Sale', { f: 'Montserrat', s: 22, w: 700, c: '#111111', up: true, ls: 0.22, min: 14 }),
    line('Linie', 90, 166, 230, 166, CORAL, 5),
    text('Rabatt', 70, 250, 940, 420, '−30 %', { f: 'Poppins', s: 250, w: 800, c: '#111111', lh: 1, min: 100 }),
    text('Hinweis', 90, 690, 800, 130, 'auf ausgewählte Artikel im ganzen Laden', { f: 'Montserrat', s: 30, w: 500, c: '#3a3a3a', v: 'top', wrap: true, lh: 1.3, min: 16 }),
    text('Knopf', 90, 858, 520, 92, 'Jetzt entdecken', { f: 'Montserrat', s: 22, w: 700, c: '#ffffff', a: 'center', up: true, ls: 0.1, background: { color: CORAL, radius: 46, padding: 30 }, wrap: false, fit: 'none' }),
    text('Zeitraum', 640, 876, 350, 56, 'bis 15. August', { f: 'Montserrat', s: 20, w: 600, c: '#3a3a3a', a: 'right', min: 12 }),
  ])],
};

// ------------------------------------------------------------------ Retro: Marineblau, Zackenscheibe, Wimpel
const NAVY = '#1b2559';
const retro = {
  slug: 'instagram-sale-retro', name: 'Instagram-Beitrag – Sale retro', variant: 'Retro',
  description: 'Bunter Retro-Beitrag für Instagram (1080 × 1080 px): Marineblau, bunte Wimpelkette, goldene Zackenscheibe mit „SALE“ und halbem Preis, dazu Zeitraum und Adresse. Texte und Prozentzahl änderst du direkt.',
  tags: ['Retro', 'Bunt', 'Wimpel', 'Vintage', 'Aktion', 'Ausverkauf', 'Gold'],
  pages: [page(NAVY, [
    deko('Wimpelkette', 'deko-konfetti-wimpelkette-bunt', 0, 0, 1080, undefined, { locked: true }),
    deko('Zackenscheibe', 'deko-baender-starburst-gold', 150, 250, 780, undefined, { shadow: shadow('#000000', 0.3, 24, 0, 14), locked: true }),
    text('Sale', 240, 440, 600, 140, 'SALE', { f: 'Righteous', s: 105, c: NAVY, a: 'center', lh: 1, min: 60 }),
    text('Rabatt', 240, 580, 600, 110, '−50 %', { f: 'Righteous', s: 78, c: '#b3243b', a: 'center', lh: 1, min: 50 }),
    text('Auf alles', 240, 690, 600, 56, 'auf alles', { f: 'Kaushan Script', s: 26, c: NAVY, a: 'center', min: 16 }),
    line('Linie', 90, 960, 990, 960, '#ffffff', 2, { opacity: 0.4 }),
    text('Zeitraum', 90, 975, 460, 60, 'Nur bis Samstag', { f: 'Righteous', s: 24, c: '#ffd34d', min: 14 }),
    text('Adresse', 520, 978, 470, 52, 'Hofladen Wiesengrund', { f: 'Montserrat', s: 17, w: 600, c: '#ffffff', a: 'right', min: 10 }),
  ])],
};

module.exports = family(common, [hell, retro]);
