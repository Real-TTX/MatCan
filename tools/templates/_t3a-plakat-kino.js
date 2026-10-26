'use strict';
const { dsl, pt, ADDRESS, PHONE, WEB, infoRow } = require('./_t3a-lib');
const { text, rect, ellipse, shape, icon, frame, deko, dekoIn, dekoCorners, group, page, typo, qr, line, gradient, shadow } = dsl;

const FAMILY = { family: 'plakat-kino', familyName: 'Plakat im Kino-Stil', occasion: 'Feste & Events', category: 'Poster' };

// ---- Thriller: A3 portrait, dark, light beams, condensed credits
const thriller = {
  ...FAMILY,
  slug: 'plakat-kino-thriller',
  name: 'Poster A3 – Kino Thriller',
  variant: 'Thriller',
  formatKey: 'poster-a3-portrait', width: 297, height: 420,
  description: 'Dramatisches A3-Plakat im Look eines Kinofilms für Krimi-Dinner, Mottoparty oder Theaterabend: fast schwarz, Lichtkegel, Slogan oben, Titel in Oswald, Rollenliste im Abspann-Stil und Altersfreigabe.',
  tags: ['Plakat', 'Poster', 'Kino', 'Filmplakat', 'Thriller', 'Krimi-Dinner', 'Mottoparty', 'Theater', 'Dunkel', 'Abspann'],
  pages: [page(gradient(180, '#05070d', '#1a2233'), [
    shape('triangle', 'Lichtkegel', 40, 50, 217, 260, '#ffffff', { opacity: 0.07, rotation: 180, locked: true }),
    ellipse('Lichtfleck', 78, 270, 140, 40, '#ffffff', { opacity: 0.08, locked: true }),
    text('Slogan', 20, 24, 257, 10, 'EINE NACHT. EIN FEST. KEIN ZURÜCK.', { f: 'Oswald', w: 400, s: 15, c: '#c9d3e6', ls: 0.5, a: 'center', min: 8 }),
    icon('Detektiv', 'search', 118, 76, 60, '#e9edf5', 0.9, { opacity: 0.9 }),
    text('Titel', 10, 150, 277, 70, 'DAS LETZTE\nDINNER', { f: 'Oswald', w: 700, s: 92, c: '#f3f5fa', ls: 0.04, a: 'center', v: 'top', wrap: true, lh: 0.98, min: 40 }),
    line('Linie', 40, 306, 257, 306, '#6a768d', 0.4, { locked: true }),
    text('Datum', 20, 312, 257, 14, 'AB 24. OKTOBER IM SAAL DES ALTEN GASTHOFS', { f: 'Oswald', w: 500, s: 19, c: '#ffffff', ls: 0.2, a: 'center', min: 9 }),
    text('Rollen', 30, 332, 237, 20, 'MIT  Ines Brandt  ·  Tom Lehmann  ·  Sabine Roth  ·  Klaus Meier\nund den Gästen des Abends', { f: 'Oswald', w: 300, s: 14, c: '#aeb8cc', ls: 0.14, a: 'center', v: 'top', wrap: true, lh: 1.6, min: 7 }),
    text('Abspann', 30, 360, 237, 22, 'REGIE  Eva Sommer     BUCH  Jonas Falk     MUSIK  Das Quartett\nPRODUKTION  Theaterverein Musterstadt', { f: 'Oswald', w: 300, s: 11.5, c: '#8d98ae', ls: 0.2, a: 'center', v: 'top', wrap: true, lh: 1.7, min: 6 }),
    rect('Freigabe', 24, 392, 24, 14, null, { stroke: '#aeb8cc', sw: 0.5 }),
    text('Freigabe Text', 24, 392, 24, 14, 'FSK 16', { f: 'Oswald', w: 500, s: 11, c: '#aeb8cc', a: 'center', min: 6 }),
    text('Tickets', 60, 392, 213, 14, `Karten ${typo.euro(48, 0)} inklusive Dreigängemenü  ·  ${WEB}`, { f: 'Oswald', w: 400, s: 13, c: '#aeb8cc', ls: 0.12, a: 'right', min: 6 }),
  ])],
};

// ---- Vintage: A3 portrait, cream paper, red starburst, serif poster type
const PAPER = '#f2e6cc';
const RED = '#b3261e';
const DARK = '#2a1c14';
const vintage = {
  ...FAMILY,
  slug: 'plakat-kino-vintage',
  name: 'Poster A3 – Kino Vintage',
  variant: 'Vintage',
  formatKey: 'poster-a3-portrait', width: 297, height: 420,
  description: 'Nostalgisches A3-Plakat im Stil alter Kinoplakate für Open-Air-Kino, Filmabend oder Vereinsvorführung: Papierton, roter Starburst, fette Antiqua-Zeilen, Programm der Reihe und Preisangabe im Rahmen.',
  tags: ['Plakat', 'Poster', 'Kino', 'Open-Air-Kino', 'Filmabend', 'Vintage', 'Retro', 'Nostalgie', 'Filmreihe', 'Vorführung'],
  pages: [page(PAPER, [
    rect('Rahmen', 12, 12, 273, 396, null, { stroke: DARK, sw: 2.5, locked: true }),
    rect('Rahmen innen', 17, 17, 263, 386, null, { stroke: DARK, sw: 0.6, locked: true }),
    text('Kopf', 30, 28, 237, 10, 'DER FILMVEREIN PRÄSENTIERT', { f: 'Libre Baskerville', w: 700, s: 14, c: DARK, ls: 0.3, a: 'center', min: 8 }),
    text('Titel 1', 24, 44, 249, 70, 'Sommer-', { f: 'Abril Fatface', s: 112, c: RED, a: 'center', lh: 1.1, min: 50 }),
    text('Titel 2', 24, 108, 249, 70, 'Kino', { f: 'Abril Fatface', s: 150, c: DARK, a: 'center', lh: 1.1, min: 50 }),
    deko('Starburst', 'deko-baender-starburst-bordeaux', 190, 160, 80, undefined, { rotation: 12, locked: true }),
    text('Starburst Text', 196, 182, 68, 36, 'Eintritt\n6 €', { f: 'Abril Fatface', s: 22, c: '#f2e6cc', a: 'center', v: 'middle', wrap: true, lh: 1.05, min: 10, rotation: 12 }),
    text('Unter', 30, 184, 150, 12, 'Drei Filmklassiker unter freiem Himmel', { f: 'Libre Baskerville', i: true, s: 16, c: DARK, a: 'left', min: 9 }),
    line('Linie', 30, 206, 267, 206, DARK, 1, { locked: true }),
    ...[['Fr, 17. Juli', 'Das Appartement'], ['Fr, 24. Juli', 'Ein Herz und eine Krone'], ['Fr, 31. Juli', 'Der dritte Mann']].map(([d, f], i) => [
      text(`Datum ${i + 1}`, 30, 218 + i * 36, 80, 14, d, { f: 'Libre Baskerville', w: 700, s: 18, c: RED, a: 'left', min: 9 }),
      text(`Film ${i + 1}`, 30, 232 + i * 36, 237, 18, f, { f: 'Abril Fatface', s: 30, c: DARK, a: 'left', min: 14 }),
    ]),
    line('Linie 2', 30, 326, 267, 326, DARK, 1, { locked: true }),
    text('Beginn', 30, 334, 237, 12, 'Beginn bei Einbruch der Dunkelheit, gegen 21 Uhr', { f: 'Libre Baskerville', s: 14, c: DARK, a: 'center', min: 8 }),
    text('Ort', 30, 350, 237, 14, 'Hinterhof des Alten Rathauses, Musterstadt', { f: 'Libre Baskerville', w: 700, s: 16, c: DARK, a: 'center', min: 8 }),
    text('Hinweis', 30, 370, 237, 24, 'Bitte Decken und Kissen mitbringen. Bei Regen fällt die Vorführung aus.\nGetränke und Popcorn vor Ort.', { f: 'Libre Baskerville', i: true, s: 11, c: '#5a4636', a: 'center', v: 'top', wrap: true, lh: 1.6, min: 7 }),
  ])],
};

// ---- Neon: A3 landscape, black, outlined neon title and grid lines
const NEON = '#25f4ee';
const MAG = '#ff2bd6';
const gridLines = Array.from({ length: 8 }, (_, i) => line('Gitter ' + (i + 1), 0, 190 + i * 14, 420, 190 + i * 14, MAG, 0.4 + i * 0.1, { opacity: 0.35 + i * 0.05, locked: true }));
const neon = {
  ...FAMILY,
  slug: 'plakat-kino-neon',
  name: 'Poster A3 quer – Kino Neon',
  variant: 'Neon',
  formatKey: 'poster-a3-landscape', width: 420, height: 297,
  description: 'Futuristisches A3-Plakat im Querformat für Filmnacht, Gaming-Abend oder Sci-Fi-Marathon: Schwarz mit Neonlinien, Gitterhorizont, hohler Titel „MIDNIGHT“ in Cyan, Programm und Ticketpreis.',
  tags: ['Plakat', 'Poster', 'Querformat', 'Kino', 'Filmnacht', 'Sci-Fi', 'Neon', 'Gaming', 'Retrowave', 'Synthwave'],
  pages: [page('#0a0612', [
    ellipse('Sonne', 130, 96, 160, 160, MAG, { opacity: 0.85, locked: true }),
    rect('Horizont', 0, 190, 420, 107, '#0a0612', { locked: true }),
    line('Horizont Linie', 0, 190, 420, 190, NEON, 1.2, { locked: true }),
    ...gridLines,
    ...Array.from({ length: 11 }, (_, i) => line('Fluchtlinie ' + (i + 1), 210 + (i - 5) * 12, 190, 210 + (i - 5) * 60, 297, MAG, 0.5, { opacity: 0.5, locked: true })),
    text('Anlass', 20, 22, 380, 12, 'EINE LANGE NACHT VOLLER SCIENCE-FICTION', { f: 'Oswald', w: 400, s: 18, c: NEON, ls: 0.45, a: 'center', min: 9 }),
    text('Titel', 10, 40, 400, 90, 'MIDNIGHT', { f: 'Anton', s: 200, c: '#0a0612', outline: { color: NEON, width: 2.4 }, a: 'center', lh: 1, min: 80 }),
    text('Untertitel', 20, 134, 380, 18, 'DIE FILMNACHT', { f: 'Anton', s: 48, c: '#ffffff', ls: 0.3, a: 'center', min: 20 }),
    text('Datum', 20, 164, 380, 12, 'Samstag, 7. November  ·  ab 20 Uhr  ·  Kulturzentrum Musterstadt', { f: 'Oswald', w: 500, s: 18, c: '#ffe9fb', ls: 0.15, a: 'center', min: 9 }),
    text('Filme', 20, 262, 380, 14, 'Drei Filme  ·  Snacks und Getränke  ·  Sitzsäcke  ·  Eintritt 12 €', { f: 'Oswald', w: 400, s: 16, c: '#ffffff', ls: 0.2, a: 'center', min: 8 }),
  ])],
};

module.exports = { variants: [thriller, vintage, neon] };
