'use strict';
const { dsl, pt, ADDRESS, PHONE, WEB, infoRow } = require('./_t3a-lib');
const { text, rect, ellipse, shape, icon, frame, deko, dekoIn, dekoCorners, group, page, typo, qr, line, gradient, shadow } = dsl;

const FAMILY = { family: 'plakat-event', familyName: 'Plakat Veranstaltung', occasion: 'Feste & Events', category: 'Poster' };

// ---- Festival: A3 portrait, sunset gradient, huge OPEN AIR
const festival = {
  ...FAMILY,
  slug: 'plakat-event-festival',
  name: 'Poster A3 – Event Festival',
  variant: 'Festival',
  formatKey: 'poster-a3-portrait', width: 297, height: 420,
  description: 'Großes A3-Plakat für Open-Air-Konzert oder Sommerfestival: Violett-Orange-Verlauf, rosa Sonne, riesiges „OPEN AIR“ in Anton, vier Bands in einer Zeile, Datum, Ort und QR-Code für Tickets.',
  tags: ['Plakat', 'Poster', 'Open Air', 'Festival', 'Konzert', 'Sommer', 'Line-up', 'Bands', 'Tickets', 'Veranstaltung'],
  pages: [page(gradient(180, '#2b1a6e', '#ff7a3d'), [
    ellipse('Sonne', 34, 18, 230, 230, '#ff4d8d', { opacity: 0.85, locked: true }),
    ellipse('Sonne Ring', 22, 6, 254, 254, null, { stroke: '#ffd166', sw: 1, opacity: 0.7, locked: true }),
    text('Zeile 1', 10, 56, 277, 100, 'OPEN', { f: 'Anton', s: 280, c: '#ffffff', a: 'center', lh: 1, min: 120 }),
    text('Zeile 2', 10, 150, 277, 100, 'AIR', { f: 'Anton', s: 280, c: '#ffd166', a: 'center', lh: 1, min: 120 }),
    text('Anlass', 20, 262, 257, 12, 'SOMMER FESTIVAL 2027', { f: 'Montserrat', w: 800, s: 26, c: '#ffffff', ls: 0.3, a: 'center', min: 12 }),
    text('Lineup', 14, 278, 269, 16, 'LENA WOLFF  /  FUNKHAUS  /  THE BIRDS  /  DJ MARLO', { f: 'Anton', s: 34, c: '#ffffff', a: 'center', min: 14 }),
    rect('Datum Pille', 64, 304, 169, 22, '#ffffff', { radius: 11 }),
    text('Datum', 64, 304, 169, 22, `Samstag, 17. Juli  ·  ab 15 Uhr`, { f: 'Montserrat', w: 800, s: 19, c: '#2b1a6e', a: 'center', min: 10 }),
    rect('Fuß', 0, 346, 297, 74, '#150d38', { locked: true }),
    text('Ort', 24, 356, 190, 13, 'Seebühne Musterstadt', { f: 'Anton', s: 32, c: '#ffffff', a: 'left', min: 14 }),
    text('Info', 24, 372, 190, 30, `Einlass ab 14 Uhr  ·  Eintritt ${typo.euro(25, 0)}\nFood Trucks und Zeltplatz vor Ort`, { f: 'Montserrat', w: 500, s: 13, c: '#d6ccff', a: 'left', v: 'top', wrap: true, lh: 1.5, min: 8 }),
    rect('QR Karte', 226, 351.5, 52, 52, '#ffffff', { radius: 3 }),
    qr('QR-Code', 230, 355.5, 44, `https://${WEB}/tickets`, { c: '#150d38', bg: '#ffffff' }),
    text('QR Text', 218, 404.5, 68, 6, 'Tickets online', { f: 'Montserrat', w: 700, s: 9, c: '#d6ccff', a: 'center', min: 6 }),
  ])],
};

// ---- Geometrisch: A3 landscape, white with black, pink and cyan shapes
const PINK = '#ff2d78';
const CYAN = '#00c2d1';
const geometrisch = {
  ...FAMILY,
  slug: 'plakat-event-geometrisch',
  name: 'Poster A3 quer – Event Geometrisch',
  variant: 'Geometrisch',
  formatKey: 'poster-a3-landscape', width: 420, height: 297,
  description: 'Grafisches A3-Plakat im Querformat für Markt, Messe oder Clubnacht: große Kreise, Dreieck und Balken in Pink und Cyan auf Weiß, Titel „NIGHT MARKET“ in Montserrat und Infoblöcke mit Datum, Ort und Eintritt.',
  tags: ['Plakat', 'Poster', 'Querformat', 'Markt', 'Nachtmarkt', 'Clubnacht', 'Messe', 'Geometrisch', 'Pink', 'Veranstaltung'],
  pages: [page('#ffffff', [
    ellipse('Kreis Pink', 250, -60, 230, 230, PINK, { locked: true }),
    ellipse('Kreis Cyan', 304, 96, 180, 180, CYAN, { locked: true }),
    shape('triangle', 'Dreieck', 336, 196, 60, 60, '#111111', { rotation: 14, locked: true }),
    rect('Balken', 0, 0, 22, 297, '#111111', { locked: true }),
    text('Anlass', 46, 24, 200, 10, 'Der Markt für Nachteulen', { f: 'Montserrat', w: 600, s: 24, c: PINK, a: 'left', min: 12 }),
    text('Titel', 40, 40, 300, 150, 'NIGHT\nMARKET', { f: 'Montserrat', w: 900, s: 130, c: '#111111', a: 'left', v: 'top', wrap: true, lh: 0.95, min: 60 }),
    rect('Datum Block', 46, 208, 128, 54, '#111111'),
    text('Datum Zeile 1', 54, 212, 112, 16, 'Fr, 8. Oktober', { f: 'Montserrat', w: 800, s: 28, c: '#ffffff', a: 'left', min: 12 }),
    text('Datum Zeile 2', 54, 230, 112, 28, '18 bis 24 Uhr', { f: 'Montserrat', w: 500, s: 20, c: '#ffffff', a: 'left', v: 'top', min: 10 }),
    text('Ort Titel', 190, 208, 160, 8, 'ORT', { f: 'Montserrat', w: 800, s: 12, c: PINK, ls: 0.3, a: 'left', min: 7 }),
    text('Ort', 190, 218, 108, 30, 'Alte Gießerei\nHafenstraße 8, Musterstadt', { f: 'Montserrat', w: 600, s: 15, c: '#111111', a: 'left', v: 'top', wrap: true, lh: 1.4, min: 9 }),
    text('Eintritt', 46, 272, 340, 12, 'Eintritt frei  ·  120 Stände  ·  Live-DJs  ·  Street Food', { f: 'Montserrat', w: 600, s: 15, c: '#111111', a: 'left', min: 8 }),
  ])],
};

// ---- Blob: A2 portrait, soft blobs, round friendly type
const bloblich = {
  ...FAMILY,
  slug: 'plakat-event-blob',
  name: 'Poster A2 – Event Blob',
  variant: 'Blob',
  formatKey: 'poster-a2-portrait', width: 420, height: 594,
  description: 'Großformatiges A2-Plakat für Stadtteilfest, Kulturtag oder Familientag: weiche Farbflächen in Rosé, Salbei und Navy, Titel „Stadtteil-Tag“ in Fredoka, Programmliste mit Uhrzeiten und Angabe zum Treffpunkt.',
  tags: ['Plakat', 'Poster', 'A2', 'Stadtteilfest', 'Kulturtag', 'Familientag', 'Blobs', 'Organisch', 'Programm', 'Veranstaltung'],
  pages: [page('#fff6ee', [
    deko('Blob rosa', 'deko-formen-blob-1-rose', -60, -50, 330, undefined, { locked: true }),
    deko('Blob grün', 'deko-formen-blob-3-salbei', 250, 120, 240, undefined, { locked: true }),
    deko('Blob blau', 'deko-formen-blob-2-navy', -70, 322, 560, undefined, { locked: true }),
    rect('Fläche blau', 0, 392, 420, 202, '#1d3557', { locked: true }),
    text('Anlass', 40, 96, 340, 14, 'Miteinander feiern', { f: 'Fredoka', w: 500, s: 36, c: '#ffffff', a: 'left', min: 16 }),
    text('Titel', 34, 112, 360, 130, 'Stadtteil-\nTag', { f: 'Fredoka', w: 700, s: 128, c: '#ffffff', a: 'left', v: 'top', wrap: true, lh: 1, min: 60 }),
    text('Datum', 40, 262, 340, 22, 'Sonntag, 12. September', { f: 'Fredoka', w: 600, s: 44, c: '#1d3557', a: 'left', min: 20 }),
    text('Zeit', 40, 285, 340, 14, '11 bis 18 Uhr  ·  Eintritt frei', { f: 'Fredoka', w: 400, s: 28, c: '#1d3557', a: 'left', min: 14 }),
    ...[['11:00', 'Eröffnung auf dem Marktplatz'], ['12:30', 'Straßenmusik und Tanzgruppen'], ['14:00', 'Kinderprogramm und Mitmach-Werkstätten'], ['16:00', 'Konzert der Stadtkapelle']].map(([t, l], i) => [
      text(`Zeit ${i + 1}`, 40, 404 + i * 30, 70, 16, t, { f: 'Fredoka', w: 700, s: 34, c: '#ffd166', a: 'left', min: 16 }),
      text(`Punkt ${i + 1}`, 118, 404 + i * 30, 280, 16, l, { f: 'Fredoka', w: 500, s: 28, c: '#ffffff', a: 'left', min: 14 }),
    ]),
    text('Treffpunkt', 40, 526, 340, 40, 'Treffpunkt: Marktplatz Musterstadt\nAlle Vereine, Läden und Nachbarn sind dabei!', { f: 'Fredoka', w: 500, s: 22, c: '#ffffff', a: 'left', v: 'top', wrap: true, lh: 1.4, min: 12 }),
    text('Web', 40, 568, 340, 12, WEB, { f: 'Fredoka', w: 600, s: 22, c: '#ffd166', a: 'left', min: 12 }),
  ])],
};

module.exports = { variants: [festival, geometrisch, bloblich] };
