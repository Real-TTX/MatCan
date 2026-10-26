'use strict';
const { dsl, pt, ADDRESS, PHONE, WEB, infoRow } = require('./_t3a-lib');
const { text, rect, ellipse, shape, icon, frame, deko, dekoIn, dekoCorners, group, page, typo, qr, line, gradient, shadow } = dsl;

const FAMILY = { family: 'flyer-tag-der-offenen-tuer', familyName: 'Flyer Tag der offenen Tür', occasion: 'Verein & Schule', category: 'Flyer' };

// ---- Einladung: A5, blue and yellow with an open door
const BLUE = '#1b4fb5';
const YEL = '#ffcf33';
const time = (n, y, t, label) => [
  text(`Zeit ${n}`, 14, y, 24, 8, t, { f: 'Poppins', w: 700, s: 12, c: BLUE, a: 'left', min: 7 }),
  text(`Programm ${n}`, 40, y, 94, 8, label, { f: 'Poppins', w: 500, s: 11, c: '#1c2a4a', a: 'left', min: 7 }),
  line(`Linie ${n}`, 14, y + 9.5, 134, y + 9.5, '#d8e2f7', 0.3),
];
const einladung = {
  ...FAMILY,
  slug: 'flyer-tag-der-offenen-tuer-einladung',
  name: 'Flyer A5 – Tag der offenen Tür Einladung',
  variant: 'Einladung',
  formatKey: 'a5-portrait', width: 148, height: 210,
  description: 'Einladender A5-Flyer für Tag der offenen Tür von Verein, Firma oder Einrichtung: blauer Kopf mit geöffneter Tür als Symbol, gelbes Datum, Programm mit Uhrzeiten und Hinweis „Eintritt frei“.',
  tags: ['Flyer', 'Tag der offenen Tür', 'Offene Tür', 'Einladung', 'Verein', 'Einrichtung', 'Führung', 'Programm', 'Eintritt frei', 'Besichtigung'],
  pages: [page('#ffffff', [
    rect('Kopf', 0, 0, 148, 78, BLUE, { locked: true }),
    rect('Tür', 100, 14, 34, 52, YEL, { radius: 17, locked: true }),
    icon('Tür Symbol', 'door-open', 106, 28, 22, BLUE, 1.6, { locked: true }),
    text('Etikett', 12, 12, 70, 6, 'Du bist eingeladen', { f: 'Poppins', w: 600, s: 8.5, c: BLUE, up: true, ls: 0.12, background: { color: YEL, radius: 3, padding: 2 }, fit: 'none' }),
    text('Titel', 12, 22, 92, 40, 'Tag der\noffenen Tür', { f: 'Poppins', w: 800, s: 27, c: '#ffffff', a: 'left', v: 'top', wrap: true, lh: 1.12, min: 14 }),
    text('Ort', 12, 64, 92, 7, 'Vereinsheim Eintracht Musterstadt', { f: 'Poppins', s: 9, c: '#cfe0ff', a: 'left', min: 6 }),
    group('Datum', [
      rect('Datum Fläche', 12, 86, 124, 22, YEL, { radius: 4 }),
      text('Datum', 12, 86, 124, 22, `Samstag, 21. März  ·  10${typo.dash}16 Uhr`, { f: 'Poppins', w: 700, s: 15, c: '#1c2a4a', a: 'center', min: 8 }),
    ]),
    text('Programm Kopf', 14, 116, 120, 5, 'PROGRAMM', { f: 'Poppins', w: 700, s: 8, c: '#6b7aa0', ls: 0.2, a: 'left', min: 5 }),
    time(1, 123, '10:00', 'Begrüßung und Rundgang'),
    time(2, 135, '11:30', 'Mitmach-Stationen'),
    time(3, 147, '13:00', 'Mittagessen und Kuchen'),
    time(4, 159, '14:30', 'Vorführung der Jugend'),
    rect('Fuß', 0, 184, 148, 26, '#eef3ff', { locked: true }),
    text('Eintritt', 14, 187, 120, 8, 'Eintritt frei  ·  Für Kinder gibt es eine Hüpfburg', { f: 'Poppins', w: 600, s: 9.5, c: BLUE, a: 'left', min: 6 }),
    text('Adresse', 14, 196, 120, 10, `${ADDRESS}\n${WEB}`, { f: 'Poppins', s: 8, c: '#4a5a80', a: 'left', v: 'top', wrap: true, lh: 1.4, min: 6 }),
  ])],
};

// ---- Schule: A4, cream with a door arch
const CREAMS = '#fbf3e4';
const PLUM = '#5b2a5e';
const CORAL = '#e8665a';
const schule = {
  ...FAMILY,
  slug: 'flyer-tag-der-offenen-tuer-schule',
  name: 'Flyer A4 – Tag der offenen Tür Schule',
  variant: 'Schule',
  formatKey: 'a4-portrait', width: 210, height: 297,
  description: 'Bunter A4-Aushang für Tag der offenen Tür in Schule, Kita oder Musikschule: Bogen als Tür mit Willkommen, Titel „Tür auf!“ in Fredoka, vier Programmpunkte mit Symbolen und Anmeldehinweis.',
  tags: ['Flyer', 'Tag der offenen Tür', 'Schule', 'Kita', 'Musikschule', 'Schnuppern', 'Einschulung', 'Elterninfo', 'Aushang', 'Willkommen'],
  pages: [page(CREAMS, [
    deko('Bogen', 'deko-formen-bogen-doppelt-rose', 128, 18, 62, undefined, { locked: true }),
    icon('Tür Symbol', 'door-open', 143, 52, 32, PLUM, 1.5, { locked: true }),
    text('Anlass', 20, 24, 100, 8, 'GRUNDSCHULE AM PARK', { f: 'Fredoka', w: 600, s: 14, c: CORAL, ls: 0.14, a: 'left', min: 8 }),
    text('Titel', 18, 36, 112, 76, 'Tür\nauf!', { f: 'Fredoka', w: 700, s: 92, c: PLUM, a: 'left', v: 'top', wrap: true, lh: 0.98, min: 40 }),
    text('Untertitel', 20, 118, 170, 24, 'Tag der offenen Tür für alle Kinder und Eltern, die unsere Schule kennenlernen möchten.', { f: 'Fredoka', s: 17, c: '#4a3550', a: 'left', v: 'top', wrap: true, lh: 1.35, min: 10 }),
    rect('Datum', 20, 150, 170, 26, PLUM, { radius: 13 }),
    text('Datum Text', 20, 150, 170, 26, `Samstag, 14. Februar  ·  10${typo.dash}13 Uhr`, { f: 'Fredoka', w: 600, s: 24, c: '#ffffff', a: 'center', min: 12 }),
    ...[['book-open', 'Schnupperunterricht', 'für Vorschulkinder in der ersten Klasse'], ['palette', 'Mitmachwerkstätten', 'Basteln, Experimentieren und Musik'], ['coffee', 'Elterncafé', 'Kaffee, Kuchen und Gespräche mit dem Kollegium'], ['school', 'Rundgang', 'durch Klassenzimmer, Turnhalle und Hort']].map(([ic, t, s], i) => [
      ellipse(`Punkt ${i + 1} Kreis`, 22, 190 + i * 21, 15, 15, i % 2 ? CORAL : PLUM),
      icon(`Punkt ${i + 1} Symbol`, ic, 25.2, 193.2 + i * 21, 8.6, '#ffffff', 2),
      text(`Punkt ${i + 1}`, 44, 189 + i * 21, 146, 8, t, { f: 'Fredoka', w: 600, s: 17, c: PLUM, a: 'left', min: 9 }),
      text(`Punkt ${i + 1} Zusatz`, 44, 197 + i * 21, 146, 7, s, { f: 'Fredoka', s: 12, c: '#5a4a60', a: 'left', min: 7 }),
    ]),
    text('Fuß', 20, 276, 170, 8, `${ADDRESS}  ·  Keine Anmeldung nötig`, { f: 'Fredoka', s: 12, c: '#5a4a60', a: 'center', min: 7 }),
  ])],
};

// ---- Betrieb: DIN lang, dark with orange, behind the scenes
const COAL = '#1c1f26';
const AMBER = '#ff8a00';
const betrieb = {
  ...FAMILY,
  slug: 'flyer-tag-der-offenen-tuer-betrieb',
  name: 'Flyer DIN lang – Tag der offenen Tür Betrieb',
  variant: 'Betrieb',
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  description: 'Kräftiger DIN-lang-Flyer für Tag der offenen Tür in Betrieb, Werkstatt oder Feuerwehr: dunkler Grund mit Orange, Titel „Blick hinter die Kulissen“, Führungen mit Uhrzeiten und Hinweis auf Ausbildung.',
  tags: ['Flyer', 'DIN lang', 'Tag der offenen Tür', 'Betrieb', 'Werkstatt', 'Feuerwehr', 'Führung', 'Ausbildung', 'Kulissen', 'Industrie'],
  pages: [page(COAL, [
    rect('Balken', 0, 0, 99, 10, AMBER, { locked: true }),
    text('Etikett', 9, 20, 79, 6, 'TAG DER OFFENEN TÜR', { f: 'Oswald', w: 500, s: 10, c: AMBER, ls: 0.2, a: 'left', min: 6 }),
    text('Titel', 9, 28, 82, 52, 'BLICK\nHINTER DIE\nKULISSEN', { f: 'Oswald', w: 700, s: 29, c: '#ffffff', a: 'left', v: 'top', wrap: true, lh: 1.08, min: 16 }),
    icon('Zahnrad', 'settings', 66, 90, 22, AMBER, 1.4, { opacity: 0.9 }),
    text('Datum', 9, 90, 56, 14, 'Sa, 6. Juni', { f: 'Oswald', w: 600, s: 21, c: AMBER, a: 'left', min: 10 }),
    text('Zeit', 9, 103, 56, 7, `10${typo.dash}15 Uhr`, { f: 'Source Sans 3', w: 600, s: 11, c: '#ffffff', a: 'left', min: 7 }),
    line('Linie', 9, 118, 89, 118, '#3a3f4a', 0.4),
    ...[['10:30', 'Werksführung'], ['12:00', 'Imbiss vom Grill'], ['13:30', 'Ausbildung live'], ['14:30', 'Gewinnspiel']].map(([t, l], i) => [
      text(`Zeit ${i + 1}`, 9, 124 + i * 11, 20, 7, t, { f: 'Oswald', w: 600, s: 12, c: AMBER, a: 'left', min: 7 }),
      text(`Punkt ${i + 1}`, 30, 124 + i * 11, 60, 7, l, { f: 'Source Sans 3', w: 600, s: 11, c: '#ffffff', a: 'left', min: 7 }),
    ]),
    rect('Karte', 9, 172, 81, 20, AMBER, { radius: 2 }),
    text('Karte Text', 9, 172, 81, 20, 'Ausbildung ab August:\nfrag uns vor Ort!', { f: 'Oswald', w: 500, s: 11, c: COAL, a: 'center', v: 'middle', wrap: true, lh: 1.25, min: 7 }),
    text('Adresse', 9, 196, 81, 10, `Metallbau Hartmann\n${ADDRESS.split(',')[0]}, Musterstadt`, { f: 'Source Sans 3', s: 8, c: '#9aa0ad', a: 'left', v: 'top', wrap: true, lh: 1.4, min: 6 }),
  ])],
};

module.exports = { variants: [einladung, schule, betrieb] };
