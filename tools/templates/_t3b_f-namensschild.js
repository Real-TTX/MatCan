'use strict';
const { text, rect, ellipse, line, icon, deko, field, page, gradient } = require('./dsl');
const { family } = require('./_t3b-lib');

const fields = [
  field('Name', 'Name', 'text', 'Anna Beispiel', { required: true }),
  field('Firma', 'Firma oder Verein', 'text', 'Hofladen Wiesengrund'),
  field('Rolle', 'Rolle', 'text', 'Referentin'),
];
const sampleRows = [
  { Name: 'Anna Beispiel', Firma: 'Hofladen Wiesengrund', Rolle: 'Referentin' },
  { Name: 'Prof. Dr. Maximilian Mustermann-Schneider', Firma: 'Institut für angewandte Lebensmitteltechnologie und Ernährung', Rolle: 'Organisation' },
  { Name: 'Jo Kurz', Firma: '', Rolle: 'Gast' },
  { Name: 'Sabine Müller', Firma: 'Stadtwerke Musterstadt', Rolle: '' },
];

const common = {
  no: 443, category: 'Business', family: 'name-badge', familyName: 'Namensschild', occasion: 'Business',
  tags: ['Namensschild', 'Namensschilder', 'Badge', 'Ausweis', 'Konferenz', 'Messe', 'Veranstaltung', 'Teilnehmer', 'Gast', 'Name'],
  formatKey: 'name-badge', width: 90, height: 55, fields, sampleRows,
};

// ------------------------------------------------------------------ Konferenz: Farbband mit Veranstaltung, großer Name, Rollenband
const BLUE = '#1f4fd8';
const konferenz = {
  slug: 'namensschild-konferenz', name: 'Namensschild – Konferenz', variant: 'Konferenz',
  description: 'Klares Namensschild (90 × 55 mm) für Tagungen und Messen: Kopfband mit Veranstaltungsname, großer Name, Firma und eine farbige Rollenleiste unten. Name, Firma und Rolle sind Felder, so druckst du alle Schilder aus einer Teilnehmerliste.',
  tags: ['Konferenz', 'Tagung', 'Messe', 'Blau', 'Modern', 'Rollenleiste', 'Teilnehmerliste'],
  pages: [page('#ffffff', [
    rect('Kopfband', 0, 0, 90, 12, BLUE, { locked: true }),
    text('Veranstaltung', 6, 0, 78, 12, 'Fachtagung Regional 2027', { f: 'Poppins', s: 9, w: 600, c: '#ffffff', up: true, ls: 0.14, min: 6.5 }),
    text('Name', 6, 15.4, 78, 17, '{{Name}}', { f: 'Poppins', s: 24, w: 700, c: '#111827', lh: 1.05, wrap: true, fit: 'shrink', v: 'middle', min: 10 }),
    text('Firma', 6, 33.4, 78, 6, '{{Firma}}', { f: 'Poppins', s: 11, w: 400, c: '#4b5563', min: 7, showIf: 'Firma' }),
    rect('Rollenleiste', 0, 44, 90, 11, '#111827', { locked: true }),
    text('Rolle', 6, 44, 78, 11, '{{Rolle}}', { f: 'Poppins', s: 11, w: 600, c: '#ffffff', up: true, ls: 0.16, min: 7, showIf: 'Rolle' }),
  ])],
};

// ------------------------------------------------------------------ Hallo: Aufkleber im bekannten Stil
const RED = '#e63232';
const hallo = {
  slug: 'namensschild-hallo', name: 'Namensschild – Hallo, ich bin', variant: 'Hallo, ich bin',
  description: 'Namensschild (90 × 55 mm) im bekannten Aufkleber-Stil: roter Kopf mit „Hallo ich bin“, großes Feld für den Namen in Filzstiftschrift, darunter Firma und Rolle. Name, Firma und Rolle sind Felder, auch zum Ausfüllen von Hand.',
  tags: ['Hallo', 'Aufkleber', 'Sticker', 'Party', 'Kennenlernen', 'Workshop', 'Rot', 'Handschrift'],
  pages: [page('#ffffff', [
    rect('Rahmen', 1.2, 1.2, 87.6, 52.6, '#ffffff', { stroke: RED, sw: 1.4, radius: 3, locked: true }),
    rect('Kopf', 1.2, 1.2, 87.6, 17, RED, { radius: 3, locked: true }),
    rect('Kopf unten', 1.2, 12, 87.6, 6.2, RED, { locked: true }),
    text('Hallo', 6, 3.4, 78, 8, 'HALLO', { f: 'Anton', s: 24, c: '#ffffff', a: 'center', lh: 1, min: 14 }),
    text('Ich bin', 6, 10.6, 78, 6, 'ich bin', { f: 'Montserrat', s: 9, w: 700, c: '#ffffff', a: 'center', up: true, ls: 0.3, min: 6.5 }),
    text('Name', 5, 19.4, 80, 18, '{{Name}}', { f: 'Permanent Marker', s: 24, c: '#111111', a: 'center', lh: 1.05, wrap: true, fit: 'shrink', v: 'middle', min: 9 }),
    line('Linie', 14, 38.4, 76, 38.4, '#d7d7d7', 0.3, { locked: true }),
    text('Firma', 6, 40, 78, 5.2, '{{Firma}}', { f: 'Montserrat', s: 8.5, w: 600, c: '#333333', a: 'center', min: 6.5, showIf: 'Firma' }),
    text('Rolle', 6, 45.4, 78, 4.4, '{{Rolle}}', { f: 'Montserrat', s: 7, w: 700, c: RED, a: 'center', up: true, ls: 0.2, min: 5.5, showIf: 'Rolle' }),
  ])],
};

// ------------------------------------------------------------------ Elegant: Elfenbein, Goldrahmen, Antiqua
const GOLD = '#a8832f';
const elegant = {
  slug: 'namensschild-elegant', name: 'Namensschild – Elegant', variant: 'Elegant',
  description: 'Elegantes Namensschild (90 × 55 mm) für Empfänge, Vereinsfeiern und Jubiläen: Elfenbein, Goldrahmen und Schnörkel, Name in Antiqua, darunter Firma und Rolle in Kapitälchen. Name, Firma und Rolle sind Felder für eine Gästeliste.',
  tags: ['Elegant', 'Gold', 'Empfang', 'Gala', 'Jubiläum', 'Antiqua', 'Gästeliste'],
  pages: [page('#fbf6ea', [
    rect('Rahmen außen', 2.4, 2.4, 85.2, 50.2, null, { stroke: GOLD, sw: 0.5, locked: true }),
    rect('Rahmen innen', 3.4, 3.4, 83.2, 48.2, null, { stroke: GOLD, sw: 0.2, locked: true }),
    text('Rolle', 8, 6.6, 74, 4, '{{Rolle}}', { f: 'Raleway', s: 7, w: 600, c: GOLD, a: 'center', up: true, ls: 0.28, min: 5.5, showIf: 'Rolle' }),
    text('Name', 7, 12, 76, 16, '{{Name}}', { f: 'Cormorant Garamond', s: 25, w: 700, c: '#2b2a33', a: 'center', lh: 1.05, wrap: true, fit: 'shrink', v: 'middle', min: 10 }),
    deko('Schnörkel', 'deko-ornamente-schnoerkel-breit-gold', 30, 30, 30, undefined, { locked: true }),
    text('Firma', 8, 40.4, 74, 6, '{{Firma}}', { f: 'Cormorant Garamond', s: 11, w: 600, i: true, c: '#5c5a64', a: 'center', min: 7, showIf: 'Firma' }),
  ])],
};

module.exports = family(common, [konferenz, hallo, elegant]);
