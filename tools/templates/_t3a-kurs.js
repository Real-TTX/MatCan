'use strict';
const { dsl, pt, ADDRESS, PHONE, WEB, infoRow } = require('./_t3a-lib');
const { text, rect, ellipse, shape, icon, frame, deko, dekoIn, group, page, typo, qr, line, gradient, shadow } = dsl;

const FAMILY = { family: 'flyer-kurs', familyName: 'Flyer Kurs', occasion: 'Verein & Schule', category: 'Flyer' };

// ---- Yoga: A5, sage and sand, arch with a lotus
const SAND = '#f3efe6';
const SAGE = '#3f5b47';
const CLAY = '#b9826a';
const yoga = {
  ...FAMILY,
  slug: 'flyer-kurs-yoga',
  name: 'Flyer A5 – Kurs Yoga',
  variant: 'Yoga',
  formatKey: 'a5-portrait', width: 148, height: 210,
  description: 'Ruhiger A5-Flyer für einen Yoga-, Pilates- oder Entspannungskurs: Salbeibogen mit Lotussymbol, Titel in Cormorant, drei Infozeilen zu Termin, Ort und Preis und ein freundlicher Hinweis für Anfänger.',
  tags: ['Flyer', 'Kurs', 'Yoga', 'Pilates', 'Entspannung', 'Gesundheit', 'Sport', 'Salbei', 'Ruhig', 'Anfänger'],
  pages: [page(SAND, [
    deko('Bogen', 'deko-formen-bogen-doppelt-salbei', 34, 12, 80, undefined, { locked: true }),
    ellipse('Sonne', 56, 52, 36, 36, '#e9d3b4', { locked: true }),
    icon('Lotus', 'flower-2', 55, 51, 38, SAGE, 1.1, { locked: true }),
    text('Titel', 12, 124, 124, 24, 'Yoga am Morgen', { f: 'Cormorant Garamond', w: 600, s: 40, c: SAGE, a: 'center', min: 20 }),
    text('Untertitel', 12, 148, 124, 8, 'für Körper und Seele', { f: 'Cormorant Garamond', i: true, w: 500, s: 17, c: CLAY, a: 'center', min: 10 }),
    rect('Linie', 64, 160, 20, 0.5, CLAY, { locked: true }),
    infoRow('Termin', 'calendar', 26, 167, 100, '', `Dienstags, 18:30${typo.dash}19:45 Uhr, ab 6. Oktober`, { f: 'Raleway', c: SAGE, icolor: CLAY, vs: 10, vw: 600, ic: 6 }),
    infoRow('Ort', 'map-pin', 26, 177, 100, '', 'Gymnastikraum der Turnhalle, Musterstadt', { f: 'Raleway', c: SAGE, icolor: CLAY, vs: 10, vw: 600, ic: 6 }),
    infoRow('Preis', 'tag', 26, 187, 100, '', `8 Termine für ${typo.euro(96, 0)}  ·  Probestunde gratis`, { f: 'Raleway', c: SAGE, icolor: CLAY, vs: 10, vw: 600, ic: 6 }),
    text('Hinweis', 12, 198, 124, 6, `Anmeldung: ${PHONE}  ·  Matte bitte mitbringen`, { f: 'Raleway', s: 8, c: '#7a8a7e', a: 'center', min: 6 }),
  ])],
};

// ---- Sprache: A5, blue header with speech bubbles
const BLUE = '#1f4fd8';
const YEL = '#ffcb47';
const bubble = (n, x, y, w, h, color, label, tc, rot) => group('Sprechblase ' + n, [
  shape('speech', `Blase ${n}`, x, y, w, h, color),
  text(`Gruß ${n}`, x + 1, y + 1, w - 2, h * 0.78, label, { f: 'Poppins', w: 600, s: 14, c: tc, a: 'center', lh: 1.2, min: 8 }),
], { rotation: rot });
const sprache = {
  ...FAMILY,
  slug: 'flyer-kurs-sprache',
  name: 'Flyer A5 – Kurs Sprache',
  variant: 'Sprache',
  formatKey: 'a5-portrait', width: 148, height: 210,
  description: 'Lebendiger A5-Flyer für Sprachkurse (Englisch, Spanisch, Deutsch als Fremdsprache): blauer Kopf mit vier bunten Sprechblasen, Kursstufen als Karten, Termin, Preis und Anmeldebutton.',
  tags: ['Flyer', 'Kurs', 'Sprachkurs', 'Englisch', 'Spanisch', 'Volkshochschule', 'Fremdsprache', 'Sprechblasen', 'Anmeldung'],
  pages: [page('#f1f5ff', [
    rect('Kopf', 0, 0, 148, 96, BLUE, { locked: true }),
    ellipse('Kreis', 100, -30, 80, 80, '#ffffff', { opacity: 0.08, locked: true }),
    text('Etikett', 12, 12, 44, 6, 'Neuer Kurs', { f: 'Poppins', w: 600, s: 8.5, c: BLUE, up: true, ls: 0.14, background: { color: YEL, radius: 3, padding: 2 }, fit: 'none' }),
    text('Titel', 12, 22, 124, 20, 'Englisch', { f: 'Poppins', w: 700, s: 44, c: '#ffffff', a: 'left', lh: 1.2, min: 24 }),
    text('Titel 2', 12, 40, 124, 10, 'für Anfänger und Wiedereinsteiger', { f: 'Poppins', w: 400, s: 12.5, c: '#dbe5ff', a: 'left', min: 8 }),
    bubble(1, 12, 58, 34, 24, '#ffffff', 'Hello!', BLUE, -6),
    bubble(2, 50, 64, 34, 24, YEL, 'Hola!', '#3a2a00', 5),
    bubble(3, 88, 56, 38, 24, '#ff7aa8', 'Bonjour!', '#ffffff', -4),
    rect('Karte 1', 10, 106, 60, 38, '#ffffff', { radius: 4, shadow: shadow('#1f4fd8', 0.15, 4, 0, 1) }),
    text('Stufe 1', 14, 109, 52, 12, 'A1', { f: 'Poppins', w: 700, s: 26, c: BLUE, a: 'left', min: 12 }),
    text('Stufe 1 Text', 14, 122, 52, 18, 'Anfänger\nmontags, 18 Uhr', { f: 'Poppins', s: 9, c: '#41506e', a: 'left', v: 'top', wrap: true, lh: 1.4, min: 6 }),
    rect('Karte 2', 78, 106, 60, 38, '#ffffff', { radius: 4, shadow: shadow('#1f4fd8', 0.15, 4, 0, 1) }),
    text('Stufe 2', 82, 109, 52, 12, 'B1', { f: 'Poppins', w: 700, s: 26, c: '#e0457b', a: 'left', min: 12 }),
    text('Stufe 2 Text', 82, 122, 52, 18, 'Mittelstufe\nmittwochs, 19 Uhr', { f: 'Poppins', s: 9, c: '#41506e', a: 'left', v: 'top', wrap: true, lh: 1.4, min: 6 }),
    infoRow('Beginn', 'calendar', 12, 154, 124, '', 'Start: 5. Oktober, 12 Abende à 90 Minuten', { f: 'Poppins', c: '#1a2540', icolor: BLUE, vs: 9.5, vw: 500, ic: 6 }),
    infoRow('Ort', 'map-pin', 12, 164, 124, '', 'Volkshochschule, Raum 12, Musterstadt', { f: 'Poppins', c: '#1a2540', icolor: BLUE, vs: 9.5, vw: 500, ic: 6 }),
    rect('Button', 12, 178, 124, 20, BLUE, { radius: 10 }),
    text('Button Text', 12, 178, 124, 20, `Jetzt anmelden: ${WEB}`, { f: 'Poppins', w: 600, s: 12, c: '#ffffff', a: 'center', min: 8 }),
    text('Preis', 12, 200, 124, 6, `Kursgebühr ${typo.euro(119, 0)}  ·  Lehrbuch inklusive`, { f: 'Poppins', s: 8, c: '#41506e', a: 'center', min: 6 }),
  ])],
};

// ---- Musik: DIN lang, dark brown and orange, guitar in a circle
const BROWN = '#2b1810';
const ORANGE = '#ff7043';
const CREAM = '#fff1dc';
const musik = {
  ...FAMILY,
  slug: 'flyer-kurs-musik',
  name: 'Flyer DIN lang – Kurs Musik',
  variant: 'Musik',
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  description: 'Schlanker DIN-lang-Flyer für Musikunterricht (Gitarre, Klavier, Gesang): großer oranger Kreis mit Gitarre, Titel in Josefin Sans, drei Vorteile mit Häkchen, Probestunde und Kontakt.',
  tags: ['Flyer', 'DIN lang', 'Kurs', 'Musik', 'Gitarre', 'Musikunterricht', 'Klavier', 'Gesang', 'Probestunde', 'Musikschule'],
  pages: [page(BROWN, [
    ellipse('Kreis', 14, 12, 71, 71, ORANGE, { locked: true }),
    ellipse('Kreis Ring', 10, 8, 79, 79, null, { stroke: ORANGE, sw: 0.6, opacity: 0.6, locked: true }),
    icon('Gitarre', 'guitar', 28, 26, 43, BROWN, 1.5, { locked: true }),
    icon('Note 1', 'music', 8, 94, 8, ORANGE, 1.6, { opacity: 0.6, rotation: -12 }),
    icon('Note 2', 'music-2', 84, 90, 8, ORANGE, 1.6, { opacity: 0.6, rotation: 12 }),
    text('Titel', 8, 98, 83, 18, 'GITARRE', { f: 'Josefin Sans', w: 700, s: 34, c: CREAM, a: 'center', ls: 0.1, min: 18 }),
    text('Titel 2', 8, 115, 83, 8, 'lernen für Anfänger', { f: 'Josefin Sans', w: 400, s: 13, c: ORANGE, a: 'center', min: 9 }),
    infoRow('Vorteil 1', 'check', 12, 134, 78, '', 'Einzel- und Kleingruppen', { f: 'Josefin Sans', c: CREAM, icolor: ORANGE, vs: 10.5, vw: 600, ic: 5.5, sw: 2.4 }),
    infoRow('Vorteil 2', 'check', 12, 144, 78, '', 'Leihgitarren vorhanden', { f: 'Josefin Sans', c: CREAM, icolor: ORANGE, vs: 10.5, vw: 600, ic: 5.5, sw: 2.4 }),
    infoRow('Vorteil 3', 'check', 12, 154, 78, '', 'Alle Altersgruppen willkommen', { f: 'Josefin Sans', c: CREAM, icolor: ORANGE, vs: 10.5, vw: 600, ic: 5.5, sw: 2.4 }),
    rect('Probestunde', 10, 168, 79, 15, ORANGE, { radius: 7.5 }),
    text('Probestunde Text', 10, 168, 79, 15, 'Erste Probestunde gratis', { f: 'Josefin Sans', w: 700, s: 11, c: BROWN, a: 'center', min: 7 }),
    text('Kontakt', 8, 188, 83, 14, `Musikschule Klangraum\n${PHONE}  ·  ${WEB}`, { f: 'Josefin Sans', s: 8.5, c: '#d9bfa0', a: 'center', v: 'top', wrap: true, lh: 1.45, min: 6 }),
  ])],
};

module.exports = { variants: [yoga, sprache, musik] };
