'use strict';
const { text, rect, ellipse, line, icon, frame, deko, qr, field, page, gradient, shadow } = require('./dsl');
const { family, fade } = require('./_t3b-lib');

const fields = [
  field('Titel', 'Titel', 'text', 'Hoffest am See', { required: true }),
  field('Tag', 'Tag (Zahl)', 'text', '12'),
  field('Monat', 'Monat (kurz)', 'text', 'JUNI'),
  field('Datum', 'Datum', 'text', 'Samstag, 12. Juni 2027'),
  field('Zeit', 'Uhrzeit', 'text', 'ab 14 Uhr'),
  field('Ort', 'Ort', 'text', 'Festplatz Musterstadt'),
  field('Link', 'Internetadresse (QR-Code)', 'text', 'https://example.org/hoffest'),
];
const sampleRows = [
  { Titel: 'Hoffest am See', Tag: '12', Monat: 'JUNI', Datum: 'Samstag, 12. Juni 2027', Zeit: 'ab 14 Uhr', Ort: 'Festplatz Musterstadt', Link: 'https://example.org/hoffest' },
  { Titel: 'Großes Sommerfest der Freiwilligen Feuerwehr mit Live-Musik', Tag: '28', Monat: 'AUGUST', Datum: 'Samstag, 28. August 2027', Zeit: '16 bis 23 Uhr', Ort: 'Gerätehaus Musterstadt-Oberdorf, Feuerwehrstraße 1', Link: 'https://example.org/feuerwehr-sommerfest' },
  { Titel: 'Lesung', Tag: '3', Monat: 'MAI', Datum: '', Zeit: '', Ort: 'Bücherei', Link: '' },
];

const common = {
  no: 464, category: 'Social Media', family: 'instagram-story-event', familyName: 'Instagram-Story Ankündigung', occasion: 'Social Media',
  tags: ['Instagram', 'Story', 'Ankündigung', 'Veranstaltung', 'Event', 'Termin', 'Einladung', 'Social Media', 'Hochformat'],
  formatKey: 'instagram-story', unit: 'px', width: 1080, height: 1920, fields, sampleRows,
};

// Document unit px; 1 pt = 1.333 px. The top and bottom 250 px of a story are covered by the app.
// ------------------------------------------------------------------ Datum riesig
const datum = {
  slug: 'instagram-story-event-datum', name: 'Instagram-Story – Ankündigung Datum groß', variant: 'Datum groß',
  description: 'Ankündigung als Story (1080 × 1920 px): oranger Verlauf, riesiger Tag und Monat in Schlagzeilenschrift, darunter Titel, Uhrzeit und Ort mit Symbolen. Titel, Tag, Monat, Zeit und Ort sind Felder.',
  tags: ['Datum', 'Orange', 'Riesig', 'Fest', 'Konzert', 'Termin', 'Anton'],
  pages: [page(gradient(165, '#ff7a18', '#e62e6b'), [
    ellipse('Kreis', -240, 1200, 760, 760, '#ffffff', { opacity: 0.1, locked: true }),
    text('Tag', 40, 300, 1000, 500, '{{Tag}}', { f: 'Anton', s: 330, c: '#ffffff', a: 'center', lh: 1, min: 100, shadow: shadow('#7a0f3a', 0.25, 0, 10, 12) }),
    text('Monat', 40, 780, 1000, 150, '{{Monat}}', { f: 'Anton', s: 100, c: '#ffd23f', a: 'center', lh: 1, ls: 0.12, min: 50 }),
    line('Linie', 340, 980, 740, 980, '#ffffff', 4, { opacity: 0.6, locked: true }),
    text('Titel', 90, 1030, 900, 250, '{{Titel}}', { f: 'Poppins', s: 60, w: 800, c: '#ffffff', a: 'center', v: 'middle', wrap: true, lh: 1.1, fit: 'shrink', min: 24 }),
    icon('Uhr', 'clock', 170, 1340, 60, '#ffd23f', 2.2),
    text('Zeit', 252, 1336, 700, 70, '{{Zeit}}', { f: 'Montserrat', s: 30, w: 700, c: '#ffffff', min: 12, showIf: 'Zeit' }),
    icon('Ort', 'map-pin', 170, 1450, 60, '#ffd23f', 2.2),
    text('Ort', 252, 1446, 700, 150, '{{Ort}}', { f: 'Montserrat', s: 30, w: 700, c: '#ffffff', v: 'top', wrap: true, lh: 1.2, fit: 'shrink', min: 12, showIf: 'Ort' }),
  ])],
};

// ------------------------------------------------------------------ Foto Vollbild
const foto = {
  slug: 'instagram-story-event-foto', name: 'Instagram-Story – Ankündigung mit Foto', variant: 'Foto',
  description: 'Ankündigung als Story (1080 × 1920 px): dein Foto füllt die ganze Story, ein Schatten dunkelt den unteren Teil ab, darauf Titel, Datum, Uhrzeit und Ort. Titel, Datum, Zeit und Ort sind Felder.',
  tags: ['Foto', 'Vollbild', 'Konzert', 'Ausstellung', 'Workshop', 'Dunkel', 'Save the Date'],
  pages: [page('#2b2f3a', [
    icon('Foto Symbol', 'image', 440, 560, 200, '#5a6072', 1.2),
    frame('Foto', 0, 0, 1080, 1920, {}),
    ...fade('Schatten', 0, 700, 1080, 1220, '#000000', 0.9, 'up', 30),
    text('Etikett', 90, 300, 520, 70, 'Save the Date', { f: 'Montserrat', s: 18, w: 800, c: '#111111', up: true, ls: 0.16, background: { color: '#ffd23f', radius: 35, padding: 26 }, wrap: false, fit: 'none' }),
    text('Titel', 90, 960, 900, 330, '{{Titel}}', { f: 'Poppins', s: 60, w: 800, c: '#ffffff', v: 'bottom', wrap: true, lh: 1.06, fit: 'shrink', min: 28 }),
    icon('Kalender', 'calendar', 90, 1338, 58, '#ffd23f', 2.2),
    text('Datum', 176, 1332, 830, 70, '{{Datum}}', { f: 'Montserrat', s: 28, w: 700, c: '#ffffff', min: 12, showIf: 'Datum' }),
    icon('Uhr', 'clock', 90, 1438, 58, '#ffd23f', 2.2),
    text('Zeit', 176, 1432, 830, 70, '{{Zeit}}', { f: 'Montserrat', s: 28, w: 700, c: '#ffffff', min: 12, showIf: 'Zeit' }),
    icon('Ort', 'map-pin', 90, 1538, 58, '#ffd23f', 2.2),
    text('Ort', 176, 1532, 830, 120, '{{Ort}}', { f: 'Montserrat', s: 28, w: 700, c: '#ffffff', v: 'top', wrap: true, lh: 1.2, fit: 'shrink', min: 12, showIf: 'Ort' }),
  ])],
};

// ------------------------------------------------------------------ Ticket mit QR-Code
const ticket = {
  slug: 'instagram-story-event-ticket', name: 'Instagram-Story – Ankündigung Ticket', variant: 'Ticket',
  description: 'Ankündigung als Story (1080 × 1920 px) im Ticket-Look: cremefarbenes Ticket mit Titel, Datum, Zeit und Ort, Abreißlinie und QR-Code zur Anmeldung. Titel, Datum, Zeit, Ort und Internetadresse sind Felder.',
  tags: ['Ticket', 'Eintrittskarte', 'QR-Code', 'Anmeldung', 'Creme', 'Verlosung', 'Einlass'],
  pages: [page('#1d3a34', [
    ellipse('Kreis oben', 600, -200, 800, 800, '#ffffff', { opacity: 0.05, locked: true }),
    ellipse('Kreis unten', -300, 1300, 800, 800, '#ffffff', { opacity: 0.05, locked: true }),
    text('Kopf', 90, 290, 900, 60, 'Du bist eingeladen', { f: 'Dancing Script', s: 48, w: 700, c: '#f0d9a0', a: 'center', min: 24 }),
    rect('Ticket', 120, 400, 840, 1200, '#fbf4e4', { radius: 36, shadow: shadow('#000000', 0.35, 40, 0, 24) }),
    ellipse('Kerbe links', 80, 1060, 80, 80, '#1d3a34', { locked: true }),
    ellipse('Kerbe rechts', 920, 1060, 80, 80, '#1d3a34', { locked: true }),
    line('Abreißlinie', 190, 1100, 890, 1100, '#b9a77f', 4, { dash: 'dashed', locked: true }),
    text('Titel', 180, 450, 720, 330, '{{Titel}}', { f: 'Playfair Display', s: 54, w: 700, c: '#1d3a34', a: 'center', v: 'middle', wrap: true, lh: 1.1, fit: 'shrink', min: 26 }),
    text('Datum', 180, 800, 720, 70, '{{Datum}}', { f: 'Montserrat', s: 26, w: 700, c: '#8a5a1c', a: 'center', min: 12, showIf: 'Datum' }),
    text('Zeit', 180, 880, 720, 64, '{{Zeit}}', { f: 'Montserrat', s: 26, w: 600, c: '#3a3a34', a: 'center', min: 12, showIf: 'Zeit' }),
    text('Ort', 180, 950, 720, 120, '{{Ort}}', { f: 'Montserrat', s: 26, w: 600, c: '#3a3a34', a: 'center', v: 'top', wrap: true, lh: 1.2, fit: 'shrink', min: 12, showIf: 'Ort' }),
    qr('QR-Code', 380, 1170, 320, '{{Link}}', { c: '#1d3a34', bg: null, ecc: 'M', quiet: false, showIf: 'Link' }),
    text('Hinweis', 180, 1510, 720, 60, 'Scanne den Code zur Anmeldung', { f: 'Montserrat', s: 19, w: 600, c: '#6a6a5a', a: 'center', min: 10 }),
  ])],
};

module.exports = family(common, [datum, foto, ticket]);
