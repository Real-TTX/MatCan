'use strict';
const { dsl, pt, ADDRESS, PHONE, WEB, infoRow } = require('./_t3a-lib');
const { text, rect, ellipse, shape, icon, frame, deko, dekoIn, group, page, typo, qr, line } = dsl;

const FAMILY = { family: 'flyer-vereinsfest', familyName: 'Flyer Vereinsfest', occasion: 'Verein & Schule', category: 'Flyer' };

// ---- Klassisch: A4, bordeaux and cream, banner, programme with dotted leaders
const BORD = '#7a1f2e';
const CREAM = '#fbf5e6';
const GOLD = '#b8923a';
const prog = (n, y, time, title, sub) => [
  text(`Zeit ${n}`, 24, y, 34, 8, time, { f: 'Playfair Display', w: 700, s: 16, c: BORD, a: 'left', min: 9 }),
  text(`Punkt ${n}`, 62, y - 1, 124, 8, title, { f: 'Playfair Display', w: 600, s: 16, c: '#2b2b2b', a: 'left', min: 9 }),
  text(`Punkt ${n} Zusatz`, 62, y + 7, 124, 6, sub, { f: 'Source Sans 3', s: 10.5, i: true, c: '#6b6256', a: 'left', min: 7 }),
];
const klassisch = {
  ...FAMILY,
  slug: 'flyer-vereinsfest-klassisch',
  name: 'Flyer A4 – Vereinsfest Klassisch',
  variant: 'Klassisch',
  formatKey: 'a4-portrait', width: 210, height: 297,
  description: 'Klassischer A4-Aushang für das Fest eines Vereins: Banderole, Wappenfeld für das Vereinslogo, Titel in Antiqua, Programm mit Uhrzeiten und Festplatz in Bordeaux und Creme.',
  tags: ['Flyer', 'Vereinsfest', 'Verein', 'Sportverein', 'Schützenverein', 'Jubiläum', 'Programm', 'Aushang', 'Klassisch'],
  pages: [page(CREAM, [
    dekoIn('Rahmen', 'deko-rahmen-doppellinie-hoch-gold', 6, 6, 198, 285, { locked: true }),
    ellipse('Wappen Grund', 80, 22, 50, 50, '#ffffff', { stroke: BORD, sw: 2.2 }),
    ellipse('Wappen Ring', 84, 26, 42, 42, null, { stroke: GOLD, sw: 0.7 }),
    icon('Wappen Symbol', 'shield', 92, 34, 26, '#d8c9ad', 1.2),
    frame('Vereinslogo', 88, 30, 34, 34, { fit: 'contain' }),
    deko('Banderole', 'deko-baender-banderole-bordeaux', 40, 78, 130, undefined, { locked: true }),
    text('Banderole Text', 61, 84, 88, 10, 'TSV Musterstadt 1921', { f: 'Cinzel', w: 600, s: 12, c: '#ffffff', a: 'center', min: 7, ls: 0.05 }),
    text('Titel', 20, 106, 170, 24, 'Großes Vereinsfest', { f: 'Playfair Display', w: 800, s: 48, c: BORD, a: 'center', lh: 1.15, min: 24 }),
    text('Jahr', 20, 131, 170, 10, 'zum 100-jährigen Bestehen', { f: 'Playfair Display', i: true, s: 20, c: '#4a4036', a: 'center', min: 12 }),
    text('Datum', 20, 148, 170, 12, 'Samstag, 3. Juli 2027', { f: 'Cinzel', w: 600, s: 21, c: GOLD, a: 'center', min: 12, ls: 0.04 }),
    deko('Trenner', 'deko-trenner-schnoerkel-gold', 65, 163, 80, undefined, { locked: true }),
    prog(1, 182, '11:00', 'Festakt und Begrüßung', 'Vereinsheim, Ehrung langjähriger Mitglieder'),
    prog(2, 202, '13:00', 'Mittagstisch', 'Gulaschkanone und Kuchenbuffet'),
    prog(3, 222, '15:00', 'Vorführungen und Turniere', 'Jugend, Damen und Herren'),
    prog(4, 242, '19:00', 'Festabend mit Tanz', 'Es spielt die Kapelle „Heimatklang“'),
    text('Ort', 20, 266, 170, 8, 'Sportplatz an der Waldstraße  ·  Eintritt frei', { f: 'Source Sans 3', w: 600, s: 12, c: BORD, a: 'center', min: 8 }),
    text('Kontakt', 20, 274, 170, 7, `${ADDRESS}  ·  ${PHONE}`, { f: 'Source Sans 3', s: 10, c: '#6b6256', a: 'center', min: 7 }),
  ])],
};

// ---- Zeitplan: DIN lang, dark green, vertical timeline
const GREEN = '#0f3d2e';
const LIME = '#b6e04a';
const step = (n, y, time, title, sub) => [
  ellipse(`Punkt ${n}`, 12.4, y + 1.6, 4.6, 4.6, LIME),
  text(`Zeit ${n}`, 22, y, 20, 7, time, { f: 'Oswald', w: 600, s: 15, c: LIME, a: 'left', min: 8 }),
  text(`Titel ${n}`, 22, y + 7, 70, 6, title, { f: 'Source Sans 3', w: 700, s: 12, c: '#ffffff', a: 'left', min: 8 }),
  text(`Zusatz ${n}`, 22, y + 13, 70, 5, sub, { f: 'Source Sans 3', s: 9, c: '#a9c9b8', a: 'left', min: 6 }),
];
const zeitplan = {
  ...FAMILY,
  slug: 'flyer-vereinsfest-zeitplan',
  name: 'Flyer DIN lang – Vereinsfest Zeitplan',
  variant: 'Zeitplan',
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  description: 'Schmaler DIN-lang-Flyer für Sommerfest, Feuerwehrfest oder Vereinsjubiläum: dunkelgrüner Grund, Titel in Oswald und ein senkrechter Zeitstrahl mit vier Programmpunkten.',
  tags: ['Flyer', 'DIN lang', 'Vereinsfest', 'Feuerwehrfest', 'Sommerfest', 'Zeitplan', 'Zeitstrahl', 'Programm', 'Verein'],
  pages: [page(GREEN, [
    text('Etikett', 12, 12, 40, 6, 'Einladung', { f: 'Source Sans 3', s: 8.5, w: 700, c: GREEN, up: true, ls: 0.2, background: { color: LIME, radius: 1.5, padding: 2 }, fit: 'none' }),
    text('Titel', 12, 24, 78, 40, 'SOMMER-\nFEST', { f: 'Oswald', w: 700, s: 44, c: '#ffffff', a: 'left', v: 'top', wrap: true, lh: 1.05, min: 22 }),
    text('Verein', 12, 61, 78, 7, 'der Freiwilligen Feuerwehr', { f: 'Source Sans 3', i: true, s: 11, c: '#a9c9b8', a: 'left', min: 8 }),
    text('Datum', 12, 72, 78, 9, 'Sa, 10. Juli 2027', { f: 'Oswald', w: 500, s: 18, c: LIME, a: 'left', min: 10 }),
    line('Zeitstrahl', 14.7, 92, 14.7, 172, LIME, 0.6, { opacity: 0.6 }),
    step(1, 90, '10:00', 'Frühschoppen', 'Weißwurst und Brezn'),
    step(2, 112, '12:00', 'Mittagessen', 'Grillstation und Salate'),
    step(3, 134, '14:00', 'Kinderprogramm', 'Löschübung und Hüpfburg'),
    step(4, 156, '19:00', 'Tanz im Festzelt', 'Live-Band „Rotlicht“'),
    rect('Fuß', 0, 188, 99, 22, '#0a2a20', { locked: true }),
    icon('Ort Symbol', 'map-pin', 12, 193, 6.5, LIME, 1.8),
    text('Ort', 21, 191.5, 70, 10, 'Feuerwehrhaus Musterstadt\nDorfstraße 12', { f: 'Source Sans 3', w: 600, s: 8.5, c: '#ffffff', a: 'left', v: 'middle', wrap: true, lh: 1.3, min: 6 }),
    text('Eintritt', 21, 201.5, 70, 5, 'Eintritt frei', { f: 'Source Sans 3', w: 700, s: 8.5, c: LIME, a: 'left', min: 6 }),
  ])],
};

// ---- Sportlich: A5 landscape, diagonal blocks, bold sans
const BLUE = '#0b3d91';
const ORANGE = '#ff7a00';
const sportlich = {
  ...FAMILY,
  slug: 'flyer-vereinsfest-sportlich',
  name: 'Flyer A5 quer – Vereinsfest Sportlich',
  variant: 'Sportlich',
  formatKey: 'a5-landscape', width: 210, height: 148,
  description: 'Dynamischer A5-Flyer im Querformat für Sportfest, Turnier oder Tag des Vereins: schräge Farbfelder in Blau und Orange, wuchtiger Titel in Oswald und drei Programmpunkte mit Symbolen.',
  tags: ['Flyer', 'Querformat', 'Sportfest', 'Turnier', 'Verein', 'Sportverein', 'Vereinsfest', 'Sport', 'Aktion'],
  pages: [page('#ffffff', [
    rect('Block Blau', -20, -10, 140, 170, BLUE, { rotation: 8, locked: true }),
    rect('Streifen Orange', 108, -10, 14, 170, ORANGE, { rotation: 8, locked: true }),
    text('Etikett', 12, 12, 70, 7, 'Tag des Vereins', { f: 'Oswald', w: 500, s: 11, c: '#ffffff', up: true, ls: 0.2, min: 7 }),
    text('Titel', 12, 22, 100, 56, 'SPORT-\nFEST', { f: 'Oswald', w: 700, s: 66, c: '#ffffff', a: 'left', v: 'top', wrap: true, lh: 1, min: 30 }),
    text('Datum', 12, 84, 92, 10, 'Sonntag, 5. September', { f: 'Oswald', w: 500, s: 17, c: ORANGE, a: 'left', min: 10 }),
    text('Zeit', 12, 95, 92, 7, `10${typo.dash}17 Uhr  ·  Eintritt frei`, { f: 'Source Sans 3', w: 600, s: 11, c: '#ffffff', a: 'left', min: 8 }),
    text('Ort', 12, 118, 92, 14, 'Sportanlage Waldstraße\nWaldstraße 5, Musterstadt', { f: 'Source Sans 3', s: 9.5, c: '#cfe0ff', a: 'left', v: 'top', wrap: true, lh: 1.4, min: 6 }),
    ellipse('Symbol 1 Kreis', 134, 14, 20, 20, BLUE),
    icon('Symbol 1', 'trophy', 139, 19, 10, '#ffffff', 1.8),
    text('Punkt 1', 158, 14, 44, 10, 'Turniere', { f: 'Oswald', w: 600, s: 17, c: BLUE, a: 'left', v: 'bottom', min: 9 }),
    text('Punkt 1 Zusatz', 158, 24, 44, 10, 'Fußball, Volleyball, Tischtennis', { f: 'Source Sans 3', s: 9.5, c: '#4a5568', a: 'left', v: 'top', wrap: true, lh: 1.3, min: 6 }),
    ellipse('Symbol 2 Kreis', 134, 56, 20, 20, ORANGE),
    icon('Symbol 2', 'users', 139, 61, 10, '#ffffff', 1.8),
    text('Punkt 2', 158, 56, 44, 10, 'Mitmachen', { f: 'Oswald', w: 600, s: 17, c: BLUE, a: 'left', v: 'bottom', min: 9 }),
    text('Punkt 2 Zusatz', 158, 66, 44, 10, 'Schnuppertraining für alle Altersgruppen', { f: 'Source Sans 3', s: 9.5, c: '#4a5568', a: 'left', v: 'top', wrap: true, lh: 1.3, min: 6 }),
    ellipse('Symbol 3 Kreis', 134, 98, 20, 20, BLUE),
    icon('Symbol 3', 'utensils', 139, 103, 10, '#ffffff', 1.8),
    text('Punkt 3', 158, 98, 44, 10, 'Essen & Trinken', { f: 'Oswald', w: 600, s: 17, c: BLUE, a: 'left', v: 'bottom', min: 9 }),
    text('Punkt 3 Zusatz', 158, 108, 44, 10, 'Grill, Kuchenbuffet und Getränke', { f: 'Source Sans 3', s: 9.5, c: '#4a5568', a: 'left', v: 'top', wrap: true, lh: 1.3, min: 6 }),
    text('Web', 134, 136, 70, 5, WEB, { f: 'Source Sans 3', w: 600, s: 8.5, c: BLUE, a: 'left', min: 6 }),
  ])],
};

module.exports = { variants: [klassisch, zeitplan, sportlich] };
