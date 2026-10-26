'use strict';
const { text, rect, ellipse, line, icon, frame, deko, field, page, gradient, shadow } = require('./dsl');
const { family, fade } = require('./_t3b-lib');

const fields = [
  field('Titel', 'Titel', 'text', 'Hoffest am See', { required: true }),
  field('Tag', 'Tag (Zahl)', 'text', '12'),
  field('Monat', 'Monat (kurz)', 'text', 'JUN'),
  field('Datum', 'Datum', 'text', 'Samstag, 12. Juni 2027'),
  field('Zeit', 'Uhrzeit', 'text', 'ab 14 Uhr'),
  field('Ort', 'Ort', 'text', 'Festplatz Musterstadt'),
  field('Zusatz', 'Zusatz', 'text', 'Eintritt frei'),
];
const sampleRows = [
  { Titel: 'Hoffest am See', Tag: '12', Monat: 'JUN', Datum: 'Samstag, 12. Juni 2027', Zeit: 'ab 14 Uhr', Ort: 'Festplatz Musterstadt', Zusatz: 'Eintritt frei' },
  { Titel: 'Großes Sommerfest der Freiwilligen Feuerwehr mit Live-Musik', Tag: '28', Monat: 'AUG', Datum: 'Samstag, 28. August 2027', Zeit: '16 bis 23 Uhr', Ort: 'Gerätehaus Musterstadt-Oberdorf, Feuerwehrstraße 1', Zusatz: 'Für Speisen und Getränke ist gesorgt' },
  { Titel: 'Lesung', Tag: '3', Monat: 'MAI', Datum: '', Zeit: '', Ort: 'Bücherei', Zusatz: '' },
];

const common = {
  no: 455, category: 'Social Media', family: 'instagram-ankuendigung', familyName: 'Instagram-Beitrag Ankündigung', occasion: 'Social Media',
  tags: ['Instagram', 'Beitrag', 'Ankündigung', 'Veranstaltung', 'Event', 'Termin', 'Einladung', 'Save the Date', 'Social Media', 'Facebook'],
  formatKey: 'instagram-post', unit: 'px', width: 1080, height: 1080, fields, sampleRows,
};

// Document unit px: 1 pt = 1.333 px.
// ------------------------------------------------------------------ Datumskachel
const kachel = {
  slug: 'instagram-ankuendigung-kachel', name: 'Instagram-Beitrag – Ankündigung Datumskachel', variant: 'Datumskachel',
  description: 'Ankündigung für Instagram (1080 × 1080 px): violett-rosa Verlauf mit einer großen weißen Datumskachel, Titel in kräftiger Schrift und den Angaben zu Uhrzeit und Ort mit Symbolen. Titel, Datum, Zeit und Ort sind Felder.',
  tags: ['Datumskachel', 'Kalender', 'Verlauf', 'Violett', 'Fest', 'Konzert', 'Termin'],
  pages: [page(gradient(150, '#5b2bd9', '#e8458b'), [
    ellipse('Kreis oben', 700, -240, 700, 700, '#ffffff', { opacity: 0.09, locked: true }),
    ellipse('Kreis unten', -260, 760, 640, 640, '#ffffff', { opacity: 0.08, locked: true }),
    rect('Kachel', 90, 110, 330, 380, '#ffffff', { radius: 40, shadow: shadow('#2a0a60', 0.35, 30, 0, 18) }),
    rect('Kachel Kopf', 90, 110, 330, 110, '#ffd23f', { radius: 40, locked: true }),
    rect('Kachel Kopf unten', 90, 170, 330, 50, '#ffd23f', { locked: true }),
    text('Monat', 110, 118, 290, 96, '{{Monat}}', { f: 'Anton', s: 50, c: '#2a0a60', a: 'center', v: 'middle', lh: 1, ls: 0.1, min: 20 }),
    text('Tag', 110, 236, 290, 230, '{{Tag}}', { f: 'Anton', s: 150, c: '#5b2bd9', a: 'center', v: 'middle', lh: 1, min: 50 }),
    text('Titel', 90, 540, 900, 250, '{{Titel}}', { f: 'Poppins', s: 52, w: 800, c: '#ffffff', v: 'top', wrap: true, lh: 1.08, fit: 'shrink', min: 22 }),
    icon('Uhr', 'clock', 90, 810, 52, '#ffd23f', 2.2),
    text('Zeit', 160, 804, 820, 64, '{{Zeit}}', { f: 'Montserrat', s: 24, w: 700, c: '#ffffff', min: 12, showIf: 'Zeit' }),
    icon('Ort', 'map-pin', 90, 900, 52, '#ffd23f', 2.2),
    text('Ort', 160, 894, 820, 64, '{{Ort}}', { f: 'Montserrat', s: 24, w: 700, c: '#ffffff', min: 12, showIf: 'Ort' }),
    text('Zusatz', 90, 984, 900, 54, '{{Zusatz}}', { f: 'Montserrat', s: 17, w: 600, c: '#ffe3f0', min: 11, showIf: 'Zusatz' }),
  ])],
};

// ------------------------------------------------------------------ Foto mit Verlauf
const foto = {
  slug: 'instagram-ankuendigung-foto', name: 'Instagram-Beitrag – Ankündigung mit Foto', variant: 'Foto',
  description: 'Ankündigung für Instagram (1080 × 1080 px): dein Foto füllt den ganzen Beitrag, unten dunkelt ein Schatten ab, darauf Titel, Datum, Uhrzeit und Ort mit Symbolen und ein „Save the Date“-Etikett. Titel, Datum, Zeit und Ort sind Felder.',
  tags: ['Foto', 'Vollbild', 'Save the Date', 'Konzert', 'Ausstellung', 'Workshop', 'Dunkel'],
  pages: [page('#2b2f3a', [
    icon('Foto Symbol', 'image', 440, 260, 200, '#5a6072', 1.2),
    frame('Foto', 0, 0, 1080, 1080, {}),
    ...fade('Schatten', 0, 300, 1080, 780, '#000000', 0.88, 'up', 26),
    text('Etikett', 70, 70, 460, 64, 'Save the Date', { f: 'Montserrat', s: 17, w: 800, c: '#111111', up: true, ls: 0.16, background: { color: '#ffd23f', radius: 32, padding: 24 }, wrap: false, fit: 'none' }),
    text('Titel', 70, 520, 940, 270, '{{Titel}}', { f: 'Poppins', s: 54, w: 800, c: '#ffffff', v: 'bottom', wrap: true, lh: 1.08, fit: 'shrink', min: 24 }),
    icon('Kalender', 'calendar', 70, 826, 48, '#ffd23f', 2.2),
    text('Datum', 136, 820, 880, 60, '{{Datum}}', { f: 'Montserrat', s: 21, w: 700, c: '#ffffff', min: 12, showIf: 'Datum' }),
    icon('Uhr', 'clock', 70, 902, 48, '#ffd23f', 2.2),
    text('Zeit', 136, 896, 880, 60, '{{Zeit}}', { f: 'Montserrat', s: 21, w: 700, c: '#ffffff', min: 12, showIf: 'Zeit' }),
    icon('Ort', 'map-pin', 70, 978, 48, '#ffd23f', 2.2),
    text('Ort', 136, 972, 880, 60, '{{Ort}}', { f: 'Montserrat', s: 21, w: 700, c: '#ffffff', min: 12, showIf: 'Ort' }),
  ])],
};

// ------------------------------------------------------------------ Typografisch hell
const TERRA = '#c4552d';
const typografisch = {
  slug: 'instagram-ankuendigung-typografisch', name: 'Instagram-Beitrag – Ankündigung typografisch', variant: 'Typografisch',
  description: 'Ruhige, typografische Ankündigung für Instagram (1080 × 1080 px): Cremeton, großer Titel in Antiqua, drei feine Zeilen für Datum, Uhrzeit und Ort mit Linien. Titel, Datum, Zeit, Ort und Zusatz sind Felder.',
  tags: ['Typografisch', 'Antiqua', 'Creme', 'Terrakotta', 'Lesung', 'Vernissage', 'Kultur'],
  pages: [page('#f6efe2', [
    rect('Rahmen', 40, 40, 1000, 1000, null, { stroke: TERRA, sw: 3, locked: true }),
    text('Kopf', 110, 110, 860, 50, 'Einladung', { f: 'Montserrat', s: 15, w: 700, c: TERRA, up: true, ls: 0.3, min: 10 }),
    text('Titel', 110, 170, 860, 330, '{{Titel}}', { f: 'Playfair Display', s: 80, w: 700, c: '#2b1d14', v: 'top', wrap: true, lh: 1.08, fit: 'shrink', min: 30 }),
    line('Linie 1', 110, 600, 970, 600, '#2b1d14', 1.5, { locked: true }),
    text('Datum Titel', 110, 624, 200, 40, 'Wann', { f: 'Montserrat', s: 15, w: 700, c: TERRA, up: true, ls: 0.2, min: 9 }),
    text('Datum', 330, 614, 640, 66, '{{Datum}}', { f: 'Playfair Display', s: 24, w: 500, c: '#2b1d14', min: 12, showIf: 'Datum' }),
    line('Linie 2', 110, 700, 970, 700, '#cdbfa8', 1.5, { locked: true }),
    text('Zeit Titel', 110, 724, 200, 40, 'Um', { f: 'Montserrat', s: 15, w: 700, c: TERRA, up: true, ls: 0.2, min: 9 }),
    text('Zeit', 330, 714, 640, 66, '{{Zeit}}', { f: 'Playfair Display', s: 24, w: 500, c: '#2b1d14', min: 12, showIf: 'Zeit' }),
    line('Linie 3', 110, 800, 970, 800, '#cdbfa8', 1.5, { locked: true }),
    text('Ort Titel', 110, 824, 200, 40, 'Wo', { f: 'Montserrat', s: 15, w: 700, c: TERRA, up: true, ls: 0.2, min: 9 }),
    text('Ort', 330, 814, 640, 100, '{{Ort}}', { f: 'Playfair Display', s: 24, w: 500, c: '#2b1d14', v: 'top', wrap: true, lh: 1.2, fit: 'shrink', min: 12, showIf: 'Ort' }),
    text('Zusatz', 110, 940, 860, 56, '{{Zusatz}}', { f: 'Playfair Display', s: 17, i: true, c: '#6e5a48', min: 11, showIf: 'Zusatz' }),
  ])],
};

module.exports = family(common, [kachel, foto, typografisch]);
