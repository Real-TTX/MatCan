'use strict';
const { text, rect, ellipse, line, icon, deko, dekoIn, dekoCorners, field, page } = require('./dsl');
const { family } = require('./_t3b-lib');

const fields = [
  field('Name', 'Name', 'text', 'Anna Beispiel', { required: true }),
  field('Anlass', 'Anlass', 'multiline', 'für die erfolgreiche Teilnahme am Sommerlauf 2027'),
  field('Datum', 'Datum', 'text', '12. Juni 2027'),
];
const sampleRows = [
  { Name: 'Anna Beispiel', Anlass: 'für die erfolgreiche Teilnahme am Sommerlauf 2027', Datum: '12. Juni 2027' },
  { Name: 'Maximiliane Schneider-Hohenstein', Anlass: 'für hervorragende Leistungen im Schuljahr 2027/28 und ihr großes Engagement in der Schulgemeinschaft', Datum: '30. Juni 2027' },
  { Name: 'Jo Kurz', Anlass: 'für den ersten Platz', Datum: '' },
  { Name: 'Prof. Dr. Maximilian Mustermann', Anlass: '', Datum: '1. Oktober 2027' },
];

const common = {
  no: 419, category: 'Karten', family: 'certificate-a4', familyName: 'Urkunde & Zertifikat', occasion: 'Verein & Schule',
  tags: ['Urkunde', 'Zertifikat', 'Auszeichnung', 'Teilnahme', 'Gewinner', 'Schule', 'Verein', 'Sport', 'Teilnahmebescheinigung'],
  formatKey: 'certificate-a4', width: 297, height: 210, fields, sampleRows,
};

// ------------------------------------------------------------------ Klassisch: Doppellinienrahmen, Cinzel, Schreibschrift, goldenes Siegel
const NAVY = '#1f2a44';
const GOLD = '#a8832f';
const klassisch = {
  slug: 'urkunde-klassisch', name: 'Urkunde – Klassisch', variant: 'Klassisch',
  description: 'Klassische Urkunde (A4 quer) mit goldenem Doppellinienrahmen, Titel in römischen Versalien, Name in Schreibschrift, Anlass, Datum, Unterschriftenlinie und goldenem Siegel. Name, Anlass und Datum sind Felder, so druckst du eine ganze Liste.',
  tags: ['Klassisch', 'Gold', 'Feierlich', 'Siegel', 'Schreibschrift', 'Abschluss', 'Ehrung'],
  pages: [page('#fffdf6', [
    dekoIn('Rahmen', 'deko-rahmen-doppellinie-quer-gold', 6, 6, 285, 198, { locked: true }),
    text('Titel', 30, 23, 237, 19, 'Urkunde', { f: 'Cinzel', s: 46, w: 600, c: NAVY, a: 'center', ls: 0.22, min: 24 }),
    deko('Schnörkel', 'deko-ornamente-schnoerkel-breit-gold', 118.5, 44, 60, undefined, { locked: true }),
    text('Verliehen', 30, 68, 237, 8, 'wird verliehen an', { f: 'Cormorant Garamond', s: 17, w: 500, i: true, c: '#5c5a64', a: 'center', min: 11 }),
    text('Name', 30, 76, 237, 30, '{{Name}}', { f: 'Great Vibes', s: 58, c: NAVY, a: 'center', lh: 1.1, min: 24 }),
    line('Namenslinie', 78, 108, 219, 108, GOLD, 0.5, { locked: true }),
    text('Anlass', 50, 113, 197, 22, '{{Anlass}}', { f: 'Cormorant Garamond', s: 17, w: 500, c: '#2b2a33', a: 'center', v: 'top', wrap: true, lh: 1.35, min: 11, showIf: 'Anlass' }),
    deko('Siegel', 'deko-baender-siegel-zacken-gold', 133.5, 141, 30, undefined, { locked: true }),
    text('Datum', 34, 160, 80, 7, '{{Datum}}', { f: 'Cormorant Garamond', s: 14, w: 600, c: NAVY, a: 'center', min: 9 }),
    line('Datumslinie', 34, 168, 114, 168, '#555555', 0.3),
    text('Datum Beschriftung', 34, 169.4, 80, 4, 'Datum', { f: 'Raleway', s: 7, w: 500, c: '#777777', a: 'center', up: true, ls: 0.14, min: 5.5 }),
    line('Unterschriftslinie', 183, 168, 263, 168, '#555555', 0.3),
    text('Unterschrift Beschriftung', 183, 169.4, 80, 4, 'Unterschrift', { f: 'Raleway', s: 7, w: 500, c: '#777777', a: 'center', up: true, ls: 0.14, min: 5.5 }),
  ])],
};

// ------------------------------------------------------------------ Modern: Eckbänder, linksbündig, Poppins, Rosette
const modern = {
  slug: 'urkunde-modern', name: 'Urkunde – Modern', variant: 'Modern',
  description: 'Moderne Urkunde oder Zertifikat (A4 quer) mit Eckbändern in Marineblau, linksbündigem Layout in klarer Schrift, Rosette, Datum und Unterschriftenlinie. Name, Anlass und Datum sind Felder für eine Serie.',
  tags: ['Modern', 'Zertifikat', 'Marineblau', 'Weiterbildung', 'Kurs', 'Seminar', 'Rosette'],
  pages: [page('#ffffff', [
    deko('Eckband oben', 'deko-baender-eckband-navy', 0, 0, 62, undefined, { locked: true }),
    deko('Eckband unten', 'deko-baender-eckband-navy', 235, 148, 62, undefined, { flipX: true, flipY: true, locked: true }),
    text('Titel', 45, 34, 170, 12, 'Zertifikat', { f: 'Poppins', s: 40, w: 800, c: NAVY, min: 20 }),
    text('Untertitel', 45, 49, 170, 7, 'Teilnahmebescheinigung', { f: 'Poppins', s: 13, w: 500, c: '#2e8bd8', up: true, ls: 0.22, min: 9 }),
    text('Verliehen', 45, 72, 170, 6, 'Hiermit wird bestätigt, dass', { f: 'Poppins', s: 13, w: 400, c: '#5b6475', min: 8 }),
    text('Name', 45, 79, 170, 20, '{{Name}}', { f: 'Poppins', s: 38, w: 700, c: '#111827', lh: 1.1, min: 16 }),
    rect('Akzent', 45, 101, 24, 1.2, '#2e8bd8', { locked: true }),
    text('Anlass', 45, 108, 170, 24, '{{Anlass}}', { f: 'Poppins', s: 16, w: 400, c: '#1f2937', v: 'top', wrap: true, lh: 1.45, min: 9, showIf: 'Anlass' }),
    deko('Rosette', 'deko-baender-rosette-navy', 228, 62, 42, undefined, { locked: true }),
    text('Datum', 45, 154, 80, 7, '{{Datum}}', { f: 'Poppins', s: 12, w: 600, c: NAVY, min: 8 }),
    line('Datumslinie', 45, 162, 125, 162, '#9aa3b2', 0.3),
    text('Datum Beschriftung', 45, 163.4, 80, 4, 'Datum', { f: 'Poppins', s: 7, w: 500, c: '#7b8494', min: 5.5 }),
    line('Unterschriftslinie', 140, 162, 220, 162, '#9aa3b2', 0.3),
    text('Unterschrift Beschriftung', 140, 163.4, 80, 4, 'Unterschrift', { f: 'Poppins', s: 7, w: 500, c: '#7b8494', min: 5.5 }),
  ])],
};

// ------------------------------------------------------------------ Kinder und Sport: Konfetti, Medaille, Fredoka
const ORANGE = '#ff6b35';
const spass = {
  slug: 'urkunde-konfetti', name: 'Urkunde – Konfetti', variant: 'Konfetti',
  description: 'Fröhliche Urkunde (A4 quer) für Kinder, Sport und Feste: Konfettiregen, goldene Medaille, großer bunter Titel, Name in runder Schrift und Lücke für Anlass, Datum und Unterschrift. Name, Anlass und Datum sind Felder für eine Serie.',
  tags: ['Konfetti', 'Kinder', 'Bunt', 'Sportfest', 'Wettkampf', 'Kita', 'Grundschule', 'Medaille'],
  pages: [page('#fff7e0', [
    deko('Konfettiregen', 'deko-konfetti-regen', 40, -28, 257, undefined, { locked: true }),
    deko('Medaille', 'deko-baender-medaille-gold', 228, 56, 42, undefined, { locked: true }),
    text('Titel', 24, 52, 190, 34, 'Urkunde', { f: 'Baloo 2', s: 68, w: 800, c: ORANGE, lh: 1, min: 30 }),
    text('Für', 26, 90, 190, 8, 'Diese Urkunde bekommt', { f: 'Fredoka', s: 17, w: 500, c: '#5a4632', min: 10 }),
    text('Name', 26, 99, 190, 24, '{{Name}}', { f: 'Fredoka', s: 44, w: 700, c: '#1f6fd1', lh: 1.05, min: 18 }),
    line('Namenslinie', 26, 126, 214, 126, ORANGE, 1.2, { dash: 'dotted', locked: true }),
    text('Anlass', 26, 131, 214, 24, '{{Anlass}}', { f: 'Fredoka', s: 18, w: 400, c: '#3b2f22', v: 'top', wrap: true, lh: 1.35, min: 10, showIf: 'Anlass' }),
    text('Datum', 28, 163, 80, 7, '{{Datum}}', { f: 'Fredoka', s: 13, w: 500, c: '#3b2f22', min: 8 }),
    line('Datumslinie', 28, 171, 108, 171, '#3b2f22', 0.3),
    text('Datum Beschriftung', 28, 172.4, 80, 4, 'Datum', { f: 'Fredoka', s: 7.5, w: 400, c: '#7a6a58', min: 6 }),
    line('Unterschriftslinie', 130, 171, 210, 171, '#3b2f22', 0.3),
    text('Unterschrift Beschriftung', 130, 172.4, 80, 4, 'Unterschrift', { f: 'Fredoka', s: 7.5, w: 400, c: '#7a6a58', min: 6 }),
    deko('Sterne', 'deko-sterne-girlande-bunt', 222, 168, 66, undefined, { locked: true }),
  ])],
};

module.exports = family(common, [klassisch, modern, spass]);
