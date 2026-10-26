'use strict';
const { text, rect, ellipse, line, icon, frame, deko, field, page } = require('./dsl');
const { family } = require('./_t3b-lib');

const fields = [
  field('Name', 'Name', 'text', 'Anna Beispiel', { required: true }),
  field('Rolle', 'Funktion', 'text', 'Geschäftsführung'),
  field('Firma', 'Firma', 'text', 'Hofladen Wiesengrund'),
  field('Telefon', 'Telefon', 'text', '+49 123 456 789'),
  field('Mail', 'E-Mail', 'text', 'anna@wiesengrund.example'),
  field('Web', 'Internet', 'text', 'www.wiesengrund.example'),
  field('Adresse', 'Adresse', 'multiline', 'Dorfstraße 12\n12345 Musterstadt'),
];
const sampleRows = [
  { Name: 'Anna Beispiel', Rolle: 'Geschäftsführung', Firma: 'Hofladen Wiesengrund', Telefon: '+49 123 456 789', Mail: 'anna@wiesengrund.example', Web: 'www.wiesengrund.example', Adresse: 'Dorfstraße 12\n12345 Musterstadt' },
  { Name: 'Prof. Dr. Maximilian Mustermann-Schneider', Rolle: 'Leitung Einkauf und Qualitätssicherung', Firma: 'Hofladen Wiesengrund', Telefon: '+49 123 456 780', Mail: 'm.mustermann-schneider@wiesengrund.example', Web: 'www.wiesengrund.example', Adresse: 'Dorfstraße 12\n12345 Musterstadt' },
  { Name: 'Jo Beispiel', Rolle: '', Firma: 'Hofladen Wiesengrund', Telefon: '', Mail: 'jo@wiesengrund.example', Web: '', Adresse: '' },
];

const common = {
  no: 400, category: 'Karten', family: 'visitenkarte', familyName: 'Visitenkarte', occasion: 'Business',
  tags: ['Visitenkarte', 'Kontakt', 'Firma', 'Logo', 'Business', 'Netzwerk'],
  formatKey: 'business-card', width: 85, height: 55, fields, sampleRows,
};

// ------------------------------------------------------------------ Klassisch: Elfenbein, Antiqua, Goldlinien, Rückseite dunkel
const INK = '#2b2a33';
const GOLD = '#a8832f';
const IVORY = '#faf5ea';
const centered = (name, y, h, key, o) => text(name, 8, y, 69, h, '{{' + key + '}}', Object.assign({ f: 'Raleway', s: 7.5, w: 500, c: '#f3ead6', a: 'center', min: 6, showIf: key }, o));

const klassisch = {
  slug: 'visitenkarte-klassisch', name: 'Visitenkarte klassisch (2 Seiten)', variant: 'Klassisch',
  description: 'Klassische Visitenkarte (85 × 55 mm) auf Elfenbein mit Goldlinien und Schnörkel: vorne Name und Funktion in feiner Antiqua, hinten dunkel mit Logo und zentrierten Kontaktdaten. Alle Angaben sind Felder für ein ganzes Team.',
  tags: ['Klassisch', 'Elegant', 'Gold', 'Kanzlei', 'Beratung', 'Antiqua'],
  pages: [
    page(IVORY, [
      rect('Rahmen außen', 2.6, 2.6, 79.8, 49.8, null, { stroke: GOLD, sw: 0.5, locked: true }),
      rect('Rahmen innen', 3.6, 3.6, 77.8, 47.8, null, { stroke: GOLD, sw: 0.2, locked: true }),
      text('Firma', 8, 11, 69, 4.6, '{{Firma}}', { f: 'Cormorant Garamond', s: 9, w: 600, i: true, c: GOLD, a: 'center', min: 7, showIf: 'Firma' }),
      deko('Schnörkel', 'deko-ornamente-schnoerkel-breit-gold', 28.5, 16.6, 28, undefined, { locked: true }),
      text('Name', 8, 26.6, 69, 9, '{{Name}}', { f: 'Cormorant Garamond', s: 19, w: 600, c: INK, a: 'center', min: 10 }),
      text('Funktion', 8, 37.2, 69, 4.4, '{{Rolle}}', { f: 'Raleway', s: 7, w: 600, c: '#6c6a73', a: 'center', up: true, ls: 0.22, min: 5.5, showIf: 'Rolle' }),
    ], 'Vorderseite'),
    page(INK, [
      rect('Rahmen', 2.6, 2.6, 79.8, 49.8, null, { stroke: GOLD, sw: 0.4, locked: true }),
      ellipse('Logo Ring', 36.1, 6.8, 12.8, 12.8, null, { stroke: GOLD, sw: 0.5, locked: true }),
      icon('Logo Symbol', 'sparkles', 39.5, 10.2, 6, GOLD, 1.5),
      frame('Logo', 37.1, 7.8, 10.8, 10.8, { mask: 'circle' }),
      centered('Telefon', 22.4, 4, 'Telefon', { w: 600 }),
      centered('E-Mail', 27.2, 4, 'Mail'),
      centered('Internet', 32, 4, 'Web'),
      line('Trenner', 36, 38.2, 49, 38.2, GOLD, 0.4),
      text('Adresse', 14, 39.8, 57, 8, '{{Adresse}}', { f: 'Raleway', s: 7, w: 400, c: '#c9bfa7', a: 'center', v: 'top', wrap: true, lh: 1.3, min: 5.5, showIf: 'Adresse' }),
    ], 'Rückseite'),
  ],
};

// ------------------------------------------------------------------ Minimal: Weiß, Inter, ein Orange, Rückseite Vollfläche
const ORANGE = '#ff4f1f';
const gray = '#6d6d72';
const minimal = {
  slug: 'visitenkarte-minimal', name: 'Visitenkarte minimal (2 Seiten)', variant: 'Minimal',
  description: 'Minimalistische Visitenkarte (85 × 55 mm): vorne viel Weiß mit Name, Funktion und Kontakt in zwei ruhigen Spalten, hinten eine volle Farbfläche mit Logo. Alle Angaben sind Felder, die Farbe änderst du mit einem Klick.',
  tags: ['Minimal', 'Reduziert', 'Modern', 'Design', 'Agentur', 'Studio', 'Weiß'],
  pages: [
    page('#ffffff', [
      rect('Akzent', 8, 8, 6, 1.1, ORANGE, { locked: true }),
      text('Name', 8, 12, 69, 7, '{{Name}}', { f: 'Inter', s: 15, w: 700, c: '#16161a', min: 9 }),
      text('Funktion', 8, 19.4, 69, 4, '{{Rolle}}', { f: 'Inter', s: 8, w: 400, c: gray, min: 6, showIf: 'Rolle' }),
      text('Firma', 8, 33.6, 36, 4, '{{Firma}}', { f: 'Inter', s: 7, w: 700, c: '#16161a', min: 5.5, showIf: 'Firma' }),
      text('Telefon', 8, 38.2, 38, 3.8, '{{Telefon}}', { f: 'Inter', s: 7, w: 400, c: gray, min: 5.5, showIf: 'Telefon' }),
      text('E-Mail', 8, 41.4, 36, 3.8, '{{Mail}}', { f: 'Inter', s: 7, w: 400, c: gray, min: 5.5, showIf: 'Mail' }),
      text('Internet', 8, 45.8, 38, 3.8, '{{Web}}', { f: 'Inter', s: 7, w: 400, c: gray, min: 5.5, showIf: 'Web' }),
      text('Adresse', 50, 37.8, 27, 11.4, '{{Adresse}}', { f: 'Inter', s: 7, w: 400, c: gray, v: 'top', wrap: true, lh: 1.35, min: 5.5, showIf: 'Adresse' }),
    ], 'Vorderseite'),
    page(ORANGE, [
      rect('Logo Kachel', 34.5, 12.5, 16, 16, '#ffffff', { radius: 2 }),
      icon('Logo Symbol', 'sparkles', 38.5, 16.5, 8, ORANGE, 1.8),
      frame('Logo', 34.5, 12.5, 16, 16, { mask: 'rounded', radius: 2 }),
      text('Firma', 8, 32.5, 69, 6, '{{Firma}}', { f: 'Inter', s: 11, w: 700, c: '#ffffff', a: 'center', min: 7, showIf: 'Firma' }),
      text('Internet', 8, 39.6, 69, 4, '{{Web}}', { f: 'Inter', s: 7, w: 500, c: '#ffe3d9', a: 'center', min: 5.5, showIf: 'Web' }),
    ], 'Rückseite'),
  ],
};

// ------------------------------------------------------------------ Kreativ: Gelb und Schwarz, Anton, Block
const YEL = '#ffd23f';
const BLK = '#121212';
const kreativ = {
  slug: 'visitenkarte-kreativ', name: 'Visitenkarte kreativ (2 Seiten)', variant: 'Kreativ',
  description: 'Auffällige Visitenkarte (85 × 55 mm) in Gelb und Schwarz mit kräftiger Schlagzeilen-Schrift: vorne Name und Funktion über einem schwarzen Kontaktband, hinten der Firmenname groß. Alle Angaben sind Felder.',
  tags: ['Kreativ', 'Bunt', 'Auffällig', 'Gelb', 'Schwarz', 'Handwerk', 'Werbung'],
  pages: [
    page(YEL, [
      rect('Band', 0, 33, 85, 22, BLK, { locked: true }),
      ellipse('Kreis', 59, 5.5, 21, 21, BLK, { locked: true }),
      icon('Logo Symbol', 'zap', 65, 11.5, 9, YEL, 1.8),
      frame('Logo', 60.5, 7, 18, 18, { mask: 'circle' }),
      text('Name', 6, 6.5, 52, 15.5, '{{Name}}', { f: 'Anton', s: 17, c: BLK, up: true, lh: 1.05, v: 'bottom', wrap: true, fit: 'shrink', min: 9 }),
      text('Funktion', 6, 22.8, 50, 4.6, '{{Rolle}}', { f: 'Poppins', s: 7.5, w: 600, c: BLK, min: 6, showIf: 'Rolle' }),
      icon('Telefon Symbol', 'phone', 6, 37.2, 3.4, YEL, 2.2),
      text('Telefon', 11, 36.6, 32, 4.6, '{{Telefon}}', { f: 'Poppins', s: 7.5, w: 500, c: '#ffffff', min: 6, showIf: 'Telefon' }),
      icon('E-Mail Symbol', 'mail', 6, 43, 3.4, YEL, 2.2),
      text('E-Mail', 11, 42.4, 38, 4.6, '{{Mail}}', { f: 'Poppins', s: 7, w: 500, c: '#ffffff', min: 5.5, showIf: 'Mail' }),
      icon('Internet Symbol', 'globe', 6, 48, 3.4, YEL, 2.2),
      text('Internet', 11, 47.4, 36, 3.8, '{{Web}}', { f: 'Poppins', s: 7, w: 500, c: '#ffffff', min: 5.5, showIf: 'Web' }),
    ], 'Vorderseite'),
    page(BLK, [
      rect('Streifen 1', 0, 0, 85, 4.5, YEL, { locked: true }),
      rect('Streifen 2', 0, 50.5, 85, 4.5, YEL, { locked: true }),
      text('Firma', 6, 8.4, 73, 24, '{{Firma}}', { f: 'Anton', s: 28, c: YEL, up: true, lh: 1.05, v: 'top', wrap: true, fit: 'shrink', min: 12, showIf: 'Firma' }),
      text('Adresse', 6, 35.2, 52, 12, '{{Adresse}}', { f: 'Poppins', s: 7, w: 500, c: '#ffffff', v: 'bottom', wrap: true, lh: 1.35, min: 5.5, showIf: 'Adresse' }),
      text('Internet', 40, 42, 39, 4.6, '{{Web}}', { f: 'Poppins', s: 7, w: 600, c: YEL, a: 'right', v: 'bottom', min: 7, showIf: 'Web' }),
    ], 'Rückseite'),
  ],
};

module.exports = family(common, [klassisch, minimal, kreativ]);
