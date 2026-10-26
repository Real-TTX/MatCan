'use strict';
const { text, rect, ellipse, icon, frame, field, page, gradient } = require('./dsl');

const NAVY = '#101c34';
const AQUA = '#29c7ac';
const MIST = '#a3b4d2';

const contactRow = (y, name, iconName, value, key, h = 4.6) => [
  icon(name + ' Symbol', iconName, 9, y + (h - 4.4) / 2, 4.4, AQUA, 2),
  text(name, 16.5, y, 60, h, value, { f: 'Montserrat', s: 7.5, w: 500, c: NAVY, wrap: h > 5, fit: 'shrink', lh: 1.3, min: 5.5, showIf: key }),
];

module.exports = {
  slug: 'visitenkarte-modern',
  name: 'Visitenkarte modern (2 Seiten)',
  category: 'Karten',
  description: 'Moderne Visitenkarte (85 × 55 mm) mit zwei Seiten: vorne Name, Funktion und ein Rahmen für dein Logo, hinten die Kontaktdaten mit Symbolen. Alle Angaben sind Felder, damit du Karten für ein ganzes Team aus einer Liste drucken kannst.',
  family: 'visitenkarte',
  familyName: 'Visitenkarte',
  variant: 'Modern',
  occasion: 'Business',
  tags: ['Visitenkarte', 'Kontakt', 'Firma', 'Logo', 'Business', 'Netzwerk'],
  formatKey: 'business-card',
  width: 85,
  height: 55,
  fields: [
    field('Name', 'Name', 'text', 'Anna Beispiel', { required: true }),
    field('Rolle', 'Funktion', 'text', 'Geschäftsführung'),
    field('Firma', 'Firma', 'text', 'Hofladen Wiesengrund'),
    field('Telefon', 'Telefon', 'text', '+49 123 456 789'),
    field('Mail', 'E-Mail', 'text', 'anna@wiesengrund.example'),
    field('Web', 'Internet', 'text', 'www.wiesengrund.example'),
    field('Adresse', 'Adresse', 'multiline', 'Dorfstraße 12\n12345 Musterstadt'),
  ],
  pages: [
    page(gradient(135, NAVY, '#1d3158'), [
      ellipse('Kreis groß', 49, -24, 62, 62, AQUA, { opacity: 0.16, locked: true }),
      ellipse('Kreis klein', 66, 36, 30, 30, AQUA, { opacity: 0.3, locked: true }),
      rect('Logo Kachel', 8, 8, 14, 14, AQUA, { radius: 3 }),
      icon('Logo Symbol', 'sparkles', 11, 11, 8, NAVY, 1.8),
      frame('Logo', 8, 8, 14, 14, { mask: 'rounded', radius: 3 }),
      rect('Akzentlinie', 8, 28.2, 10, 0.8, AQUA, { locked: true }),
      text('Name', 8, 31, 62, 8, '{{Name}}', { f: 'Montserrat', s: 16, w: 700, c: '#ffffff', min: 9 }),
      text('Funktion', 8, 39.6, 62, 4.2, '{{Rolle}}', { f: 'Montserrat', s: 7.5, w: 500, c: AQUA, up: true, ls: 0.16, min: 5.5, showIf: 'Rolle' }),
      text('Firma', 8, 47.2, 50, 4, '{{Firma}}', { f: 'Montserrat', s: 7, w: 500, c: MIST, min: 5.5, showIf: 'Firma' }),
    ], 'Vorderseite'),
    page('#ffffff', [
      rect('Seitenband', 0, 0, 3.2, 55, AQUA, { locked: true }),
      ellipse('Kreis', 62, 38, 40, 40, AQUA, { opacity: 0.14, locked: true }),
      text('Firma', 9, 8, 60, 6, '{{Firma}}', { f: 'Montserrat', s: 11, w: 700, c: NAVY, min: 7, showIf: 'Firma' }),
      rect('Akzentlinie', 9, 15.6, 10, 0.8, AQUA, { locked: true }),
      ...contactRow(21, 'Telefon', 'phone', '{{Telefon}}', 'Telefon'),
      ...contactRow(28.2, 'E-Mail', 'mail', '{{Mail}}', 'Mail'),
      ...contactRow(35.4, 'Internet', 'globe', '{{Web}}', 'Web'),
      ...contactRow(42.6, 'Adresse', 'map-pin', '{{Adresse}}', 'Adresse', 8),
    ], 'Rückseite'),
  ],
  sampleRows: [
    { Name: 'Anna Beispiel', Rolle: 'Geschäftsführung', Firma: 'Hofladen Wiesengrund', Telefon: '+49 123 456 789', Mail: 'anna@wiesengrund.example', Web: 'www.wiesengrund.example', Adresse: 'Dorfstraße 12\n12345 Musterstadt' },
    { Name: 'Prof. Dr. Maximilian Mustermann-Schneider', Rolle: 'Leitung Einkauf und Qualitätssicherung', Firma: 'Hofladen Wiesengrund', Telefon: '+49 123 456 780', Mail: 'm.mustermann-schneider@wiesengrund.example', Web: 'www.wiesengrund.example', Adresse: 'Dorfstraße 12\n12345 Musterstadt' },
    { Name: 'Jo Beispiel', Rolle: '', Firma: 'Hofladen Wiesengrund', Telefon: '', Mail: 'jo@wiesengrund.example', Web: '', Adresse: '' },
  ],
};
