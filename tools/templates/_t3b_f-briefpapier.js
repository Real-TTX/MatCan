'use strict';
const { text, rect, ellipse, line, icon, frame, deko, page } = require('./dsl');
const { family } = require('./_t3b-lib');

const common = {
  no: 413, category: 'Business', family: 'briefpapier', familyName: 'Briefpapier', occasion: 'Business',
  tags: ['Briefpapier', 'Brief', 'Geschäftsbrief', 'Firma', 'Briefkopf', 'DIN 5008', 'Business', 'A4', 'Logo'],
  formatKey: 'letterhead-a4', width: 210, height: 297,
};

/** What every letter needs (DIN 5008, form B): fold and punch marks, the address field, the info block, subject and salutation. */
function letter(o) {
  const body = o.body || 'Source Sans 3';
  return [
    line('Falzmarke oben', 0, 105, 6, 105, '#9a9a9a', 0.25, { locked: true }),
    line('Lochmarke', 0, 148.5, 8, 148.5, '#9a9a9a', 0.25, { locked: true }),
    line('Falzmarke unten', 0, 210, 6, 210, '#9a9a9a', 0.25, { locked: true }),
    text('Absenderzeile', 25, o.addrY, 85, 4, 'Hofladen Wiesengrund · Dorfstraße 12 · 12345 Musterstadt', { f: body, s: 7, c: '#6a6a6a', ls: 0.01, min: 5.5 }),
    line('Absenderlinie', 25, o.addrY + 4.2, 110, o.addrY + 4.2, '#c8c8c8', 0.25, { locked: true }),
    text('Anschrift', 25, o.addrY + 5.6, 85, 22, 'Frau\nMaria Mustermann\nMusterweg 7\n54321 Beispielstadt', { f: body, s: 10.5, c: '#1a1a1a', v: 'top', wrap: true, lh: 1.3, min: 8 }),
    text('Infoblock', o.infoX || 125, o.addrY + 5.6, 55, 28, 'Datum: 12. Juni 2027\nIhr Zeichen: ab-01\nUnser Zeichen: wg-17\nBearbeiter: Anna Beispiel', { f: body, s: 8.5, c: '#4a4a4a', v: 'top', wrap: true, lh: 1.45, min: 7 }),
    text('Betreff', 25, o.addrY + 40, o.bodyW || 160, 7, 'Betreff: Ihre Anfrage vom 3. Juni', { f: o.head || body, s: 11.5, w: 700, c: o.ink, min: 9 }),
    text('Anrede', 25, o.addrY + 50, o.bodyW || 160, 6, 'Sehr geehrte Frau Mustermann,', { f: body, s: 10.5, c: '#1a1a1a', min: 8 }),
    text('Brieftext', 25, o.addrY + 59, o.bodyW || 160, 24, 'hier beginnt Ihr Brief. Klicken Sie in den Text und überschreiben Sie ihn mit Ihrer Nachricht. Der Briefkopf, die Falzmarken und die Fußzeile bleiben stehen.', { f: body, s: 10.5, c: '#1a1a1a', v: 'top', wrap: true, lh: 1.4, min: 8 }),
  ];
}

// ------------------------------------------------------------------ Klassisch: zentriert, Antiqua, Gold
const NAVY = '#1f2a44';
const GOLD = '#a8832f';
const klassisch = {
  slug: 'briefpapier-klassisch', name: 'Briefpapier – Klassisch', variant: 'Klassisch',
  description: 'Klassisches Briefpapier A4 nach DIN 5008: zentrierter Briefkopf mit Firmenname in Antiqua und Schnörkel, Anschriftfeld, Falz- und Lochmarken und eine dreispaltige Fußzeile. Alle Texte kannst du überschreiben, das Logo kommt in den Rahmen.',
  tags: ['Klassisch', 'Kanzlei', 'Praxis', 'Antiqua', 'Gold', 'Elegant'],
  pages: [page('#ffffff', [
    frame('Logo', 95, 12, 20, 20, { mask: 'circle' }),
    icon('Logo Symbol', 'landmark', 100.5, 17.5, 9, GOLD, 1.5),
    text('Firma', 25, 34, 160, 9, 'Hofladen Wiesengrund', { f: 'Cormorant Garamond', s: 25, w: 600, c: NAVY, a: 'center', min: 14 }),
    text('Zusatz', 25, 43.5, 160, 4.4, 'Regionale Lebensmittel · Seit 1998', { f: 'Raleway', s: 7.5, w: 600, c: GOLD, a: 'center', up: true, ls: 0.24, min: 6 }),
    deko('Schnörkel', 'deko-ornamente-schnoerkel-breit-gold', 87, 49.4, 36, undefined, { locked: true }),
    ...letter({ addrY: 64, ink: NAVY, body: 'Libre Baskerville' }),
    line('Fußlinie', 25, 268, 185, 268, GOLD, 0.4, { locked: true }),
    text('Fuß links', 25, 271, 50, 14, 'Hofladen Wiesengrund\nDorfstraße 12\n12345 Musterstadt', { f: 'Raleway', s: 7.5, c: '#4a4a55', v: 'top', wrap: true, lh: 1.45, min: 6 }),
    text('Fuß Mitte', 80, 271, 50, 14, 'Telefon 01234 56789\ninfo@wiesengrund.example\nwww.wiesengrund.example', { f: 'Raleway', s: 7.5, c: '#4a4a55', a: 'center', v: 'top', wrap: true, lh: 1.45, min: 6 }),
    text('Fuß rechts', 135, 271, 50, 14, 'Sparkasse Musterstadt\nIBAN DE00 0000 0000 0000 0000 00\nUSt-IdNr. DE123456789', { f: 'Raleway', s: 7.5, c: '#4a4a55', a: 'right', v: 'top', wrap: true, lh: 1.45, min: 6 }),
  ])],
};

// ------------------------------------------------------------------ Modern: Farbbalken und Kreise, Inter, Fußband
const TEAL = '#0e8f8a';
const DARK = '#12303a';
const modern = {
  slug: 'briefpapier-modern', name: 'Briefpapier – Modern', variant: 'Modern',
  description: 'Modernes Briefpapier A4 nach DIN 5008: Logo links, geometrische Farbformen oben rechts, Anschriftfeld, Falz- und Lochmarken und ein farbiges Fußband mit den Kontaktdaten in drei Spalten. Texte überschreiben, Logo in den Rahmen ziehen.',
  tags: ['Modern', 'Farbig', 'Agentur', 'Start-up', 'Kreise', 'Fußband', 'Inter'],
  pages: [page('#ffffff', [
    ellipse('Kreis groß', 150, -34, 90, 90, TEAL, { opacity: 0.16, locked: true }),
    ellipse('Kreis klein', 176, 8, 36, 36, TEAL, { opacity: 0.4, locked: true }),
    rect('Balken', 0, 0, 12, 297, TEAL, { locked: true }),
    rect('Logo Kachel', 25, 14, 16, 16, TEAL, { radius: 3 }),
    icon('Logo Symbol', 'sparkles', 29, 18, 8, '#ffffff', 1.8),
    frame('Logo', 25, 14, 16, 16, { mask: 'rounded', radius: 3 }),
    text('Firma', 45, 15, 90, 7, 'Wiesengrund', { f: 'Inter', s: 17, w: 800, c: DARK, min: 10 }),
    text('Zusatz', 45, 22.4, 90, 5, 'Hofladen & Lieferservice', { f: 'Inter', s: 8.5, w: 500, c: TEAL, min: 6.5 }),
    ...letter({ addrY: 45, ink: DARK, body: 'Inter' }),
    rect('Fußband', 0, 270, 210, 27, DARK, { locked: true }),
    rect('Fußband Akzent', 0, 270, 210, 1.2, TEAL, { locked: true }),
    text('Fuß links', 25, 276, 52, 14, 'Hofladen Wiesengrund\nDorfstraße 12\n12345 Musterstadt', { f: 'Inter', s: 7.5, c: '#d6e5ea', v: 'top', wrap: true, lh: 1.5, min: 6 }),
    text('Fuß Mitte', 81, 276, 52, 14, 'Telefon 01234 56789\ninfo@wiesengrund.example\nwww.wiesengrund.example', { f: 'Inter', s: 7.5, c: '#d6e5ea', v: 'top', wrap: true, lh: 1.5, min: 6 }),
    text('Fuß rechts', 137, 276, 52, 14, 'Sparkasse Musterstadt\nIBAN DE00 0000 0000 0000 0000 00\nUSt-IdNr. DE123456789', { f: 'Inter', s: 7.5, c: '#d6e5ea', v: 'top', wrap: true, lh: 1.5, min: 6 }),
  ])],
};

// ------------------------------------------------------------------ Minimal: nur eine Linie, Kontakt rechts am Rand
const minimal = {
  slug: 'briefpapier-minimal', name: 'Briefpapier – Minimal', variant: 'Minimal',
  description: 'Minimales Briefpapier A4 nach DIN 5008 mit viel Weiß: kleines Logo und Firmenname oben links, die Kontaktdaten in einer schmalen Spalte am rechten Rand, eine hauchdünne Linie als einziger Schmuck. Texte überschreiben, Logo in den Rahmen ziehen.',
  tags: ['Minimal', 'Schlicht', 'Reduziert', 'Weiß', 'Freiberufler', 'Design', 'Raleway'],
  pages: [page('#ffffff', [
    frame('Logo', 25, 15, 12, 12, { mask: 'circle' }),
    ellipse('Logo Punkt', 25, 15, 12, 12, null, { stroke: '#111111', sw: 0.6, locked: true }),
    text('Firma', 40, 15, 80, 6, 'Wiesengrund', { f: 'Raleway', s: 14, w: 700, c: '#111111', min: 9 }),
    text('Zusatz', 40, 21.2, 80, 4.4, 'Hofladen', { f: 'Raleway', s: 8, w: 400, c: '#777777', min: 6 }),
    line('Haarlinie', 25, 34, 185, 34, '#111111', 0.25, { locked: true }),
    ...letter({ addrY: 46, ink: '#111111', body: 'Raleway', bodyW: 118 }),
    text('Kontakt', 151, 112, 34, 60, 'Hofladen Wiesengrund\nDorfstraße 12\n12345 Musterstadt\n\nTelefon\n01234 56789\n\nE-Mail\ninfo@wiesengrund.example\n\nInternet\nwww.wiesengrund.example', { f: 'Raleway', s: 7.5, c: '#555555', v: 'top', wrap: true, lh: 1.4, min: 6, locked: false }),
    text('Fuß', 25, 283, 160, 4, 'Sparkasse Musterstadt · IBAN DE00 0000 0000 0000 0000 00 · USt-IdNr. DE123456789', { f: 'Raleway', s: 7, c: '#888888', min: 5.5 }),
  ])],
};

module.exports = family(common, [klassisch, modern, minimal]);
