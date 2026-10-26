'use strict';
const { dsl, pt, ADDRESS, PHONE, WEB, infoRow } = require('./_t3a-lib');
const { text, rect, ellipse, shape, icon, frame, deko, dekoIn, dekoCorners, group, page, typo, qr, line, gradient, shadow } = dsl;

const FAMILY = { family: 'plakat-minimal', familyName: 'Minimalistisches Plakat', occasion: 'Feste & Events', category: 'Poster' };

// ---- Stille: A3 portrait, lots of air, one hairline, light serif
const BONE = '#f7f4ee';
const INK = '#1d1d1b';
const stille = {
  ...FAMILY,
  slug: 'plakat-minimal-stille',
  name: 'Poster A3 – Minimal Stille',
  variant: 'Stille',
  formatKey: 'poster-a3-portrait', width: 297, height: 420,
  description: 'Ruhiges A3-Plakat für Ausstellung, Vernissage oder Lesung: heller Grund, ein feiner senkrechter Strich, leichter Titel in Cormorant, Angaben klein am Fuß. Viel Weißraum, ein Gedanke.',
  tags: ['Plakat', 'Poster', 'Minimal', 'Ausstellung', 'Vernissage', 'Galerie', 'Kunst', 'Ruhig', 'Weißraum', 'Elegant'],
  pages: [page(BONE, [
    line('Strich', 60, 0, 60, 300, INK, 0.5, { locked: true }),
    text('Reihe', 78, 28, 150, 8, 'AUSSTELLUNG  2027', { f: 'Inter', w: 500, s: 13, c: INK, ls: 0.4, a: 'left', min: 6 }),
    text('Titel', 74, 214, 210, 60, 'Stille', { f: 'Cormorant Garamond', w: 300, s: 150, c: INK, a: 'left', lh: 1, min: 60 }),
    text('Untertitel', 78, 278, 190, 14, 'Fotografien von Hanna Lorenz', { f: 'Cormorant Garamond', i: true, w: 400, s: 24, c: INK, a: 'left', min: 12 }),
    text('Datum', 78, 346, 100, 28, '12. September bis\n8. November 2027', { f: 'Inter', w: 400, s: 13, c: INK, a: 'left', v: 'top', wrap: true, lh: 1.6, min: 7 }),
    text('Ort', 182, 346, 90, 28, 'Galerie am Fluss\nUferweg 5, Musterstadt', { f: 'Inter', w: 400, s: 13, c: INK, a: 'left', v: 'top', wrap: true, lh: 1.6, min: 7 }),
    text('Eröffnung', 78, 386, 190, 8, 'Eröffnung: Freitag, 10. September, 19 Uhr', { f: 'Inter', w: 500, s: 12, c: '#777770', a: 'left', min: 6 }),
  ])],
};

// ---- Kreis: A3 portrait, one terracotta circle with the title inside
const TERRA = '#c8613f';
const CREAM = '#f6efe4';
const kreis = {
  ...FAMILY,
  slug: 'plakat-minimal-kreis',
  name: 'Poster A3 – Minimal Kreis',
  variant: 'Kreis',
  formatKey: 'poster-a3-portrait', width: 297, height: 420,
  description: 'Klares A3-Plakat für Workshop, Markttag oder Vortrag: eine große terrakottafarbene Scheibe mit dem Titel darin, darunter Datum und Ort in schlanker Inter. Erkennbar aus großer Entfernung.',
  tags: ['Plakat', 'Poster', 'Minimal', 'Workshop', 'Vortrag', 'Markttag', 'Kreis', 'Terrakotta', 'Modern', 'Klar'],
  pages: [page(CREAM, [
    ellipse('Scheibe', 28, 40, 241, 241, TERRA, { locked: true }),
    text('Titel', 40, 100, 217, 120, 'Töpfern\nam Fluss', { f: 'Inter', w: 800, s: 62, c: CREAM, a: 'center', v: 'middle', wrap: true, lh: 1.05, min: 30 }),
    text('Reihe', 40, 76, 217, 10, 'WORKSHOP', { f: 'Inter', w: 600, s: 13, c: CREAM, ls: 0.4, a: 'center', min: 8 }),
    text('Zusatz', 40, 232, 217, 10, 'für Anfänger und Fortgeschrittene', { f: 'Inter', w: 400, s: 15, c: CREAM, a: 'center', min: 8 }),
    text('Datum', 28, 304, 241, 14, 'Samstag, 2. Oktober', { f: 'Inter', w: 700, s: 28, c: '#1d1d1b', a: 'left', min: 12 }),
    text('Zeit', 28, 320, 241, 10, '10 bis 16 Uhr, Material inklusive', { f: 'Inter', w: 400, s: 18, c: '#1d1d1b', a: 'left', min: 9 }),
    line('Linie', 28, 346, 269, 346, '#1d1d1b', 0.5, { locked: true }),
    text('Ort', 28, 352, 120, 30, 'Kunstwerkstatt\nUferweg 5, Musterstadt', { f: 'Inter', w: 400, s: 13, c: '#1d1d1b', a: 'left', v: 'top', wrap: true, lh: 1.5, min: 7 }),
    text('Anmeldung', 160, 352, 109, 30, `Anmeldung\n${WEB}`, { f: 'Inter', w: 400, s: 13, c: '#1d1d1b', a: 'right', v: 'top', wrap: true, lh: 1.5, min: 7 }),
  ])],
};

// ---- Raster: A3 landscape, Swiss grid, bold sans, one red field
const raster = {
  ...FAMILY,
  slug: 'plakat-minimal-raster',
  name: 'Poster A3 quer – Minimal Raster',
  variant: 'Raster',
  formatKey: 'poster-a3-landscape', width: 420, height: 297,
  description: 'Sachliches A3-Plakat im Querformat nach dem Schweizer Raster für Konferenz, Symposium oder Tagung: ein rotes Feld links, fette Inter-Schlagzeile, Programm in drei Spalten und ein klares Kopf- und Fußband.',
  tags: ['Plakat', 'Poster', 'Querformat', 'Minimal', 'Konferenz', 'Tagung', 'Symposium', 'Schweizer Raster', 'Rot', 'Sachlich'],
  pages: [page('#ffffff', [
    rect('Feld', 0, 0, 140, 297, '#e63222', { locked: true }),
    text('Nummer', 20, 20, 100, 70, '04', { f: 'Inter', w: 900, s: 150, c: '#ffffff', a: 'left', lh: 1, min: 60 }),
    text('Reihe', 20, 252, 110, 30, 'Zukunftstag\nMusterstadt', { f: 'Inter', w: 700, s: 18, c: '#ffffff', a: 'left', v: 'bottom', wrap: true, lh: 1.25, min: 9 }),
    text('Titel', 160, 20, 240, 100, 'Wie wohnen\nwir morgen?', { f: 'Inter', w: 900, s: 66, c: '#111111', a: 'left', v: 'top', wrap: true, lh: 1.02, min: 30 }),
    line('Linie', 160, 140, 400, 140, '#111111', 1.2, { locked: true }),
    ...[['09:00', 'Begrüßung', 'Oberbürgermeisterin'], ['10:30', 'Bauen mit Holz', 'Prof. Dr. Anna Kessel'], ['13:00', 'Quartier 2040', 'Podiumsdiskussion']].map(([t, h, s], i) => [
      text(`Zeit ${i + 1}`, 160 + i * 82, 150, 76, 14, t, { f: 'Inter', w: 900, s: 30, c: '#e63222', a: 'left', min: 12 }),
      text(`Thema ${i + 1}`, 160 + i * 82, 168, 76, 12, h, { f: 'Inter', w: 800, s: 19, c: '#111111', a: 'left', min: 8 }),
      text(`Sprecher ${i + 1}`, 160 + i * 82, 178, 76, 10, s, { f: 'Inter', w: 400, s: 14.5, c: '#111111', a: 'left', min: 7 }),
    ]),
    line('Linie unten', 160, 250, 400, 250, '#111111', 0.5, { locked: true }),
    text('Datum', 160, 256, 120, 24, 'Mi, 13. Oktober 2027\n09 bis 17 Uhr', { f: 'Inter', w: 700, s: 14, c: '#111111', a: 'left', v: 'top', wrap: true, lh: 1.4, min: 8 }),
    text('Ort', 290, 256, 110, 24, `Stadthalle\n${WEB}`, { f: 'Inter', w: 400, s: 14, c: '#111111', a: 'left', v: 'top', wrap: true, lh: 1.4, min: 8 }),
  ])],
};

module.exports = { variants: [stille, kreis, raster] };
