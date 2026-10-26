/* Families of batch V4, part A: Metal/Rock-Geburtstag, Gamer-Party, 80er-Party, 90er-Party. */
'use strict';
const { D, when, uhr, decor, T, P, info, infoRows, sprinkle, tags } = require('./_v4-lib');
const { text, rect, ellipse, line, icon, shape, deko, dekoIn, dekoWindow, page, gradient, shadow, field, foldCard, panels } = D;

const OFFICIAL = 'Feste & Events';

// ================================================================================================================== Metal / Rock
const metalFields = [field('Name', 'Name', 'text', 'Dirk'), field('Alter', 'Alter', 'text', '50')];
const metalRows = [{ Name: 'Dirk', Alter: '50' }, { Name: 'Maximiliane', Alter: '40' }, { Name: 'Uwe', Alter: '60' }];
const metalBase = {
  category: 'Einladungen', family: 'metal-geburtstag', familyName: 'Metal-Geburtstag', occasion: 'Geburtstag', unit: 'mm', fields: metalFields, sampleRows: metalRows,
};
const metalTags = (...m) => tags('Metal', 'Rock', 'Geburtstag', 'Einladung', 'Heavy Metal', 'Totenkopf', 'Gitarre', 'Schwarz', 'Party', 'Konzert', m);
const RED = '#d4202f';
const metalDate = when(12, 6);

const metalSchaedel = Object.assign({}, metalBase, {
  slug: 'metal-geburtstag-schaedel', name: 'Metal-Geburtstag – Schädel', variant: 'Schädel',
  description: 'Schwarze Einladungskarte (A6 hoch) für einen Rock- und Metal-Geburtstag: Totenkopf mit Rosen, Stacheldraht, Name und Alter als Felder.',
  tags: metalTags('Totenkopf mit Rosen', 'Düster'),
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [page('#0b0b0d', [
    decor([
      dekoWindow('Textur', 'deko-motive-verschleiss-weiss', 0, 0, 105, 148, { opacity: 0.1 }),
      dekoIn('Totenkopf', 'deko-motive-totenkopf-rosen', 10, 6, 85, 62),
      deko('Stacheldraht', 'deko-motive-stacheldraht-weiss', 8, 70, 89),
    ]),
    T('Kopf', 8, 80, 89, 6, 'HEAVY BIRTHDAY NIGHT', 'Oswald', 9, RED, { ls: 0.25, w: 500, min: 7 }),
    T('Name', 6, 86, 93, 18, '{{Name}}', 'Anton', 36, '#ffffff', { up: true, min: 16, lh: 1.15 }),
    T('Alter', 8, 104, 89, 14, 'WIRD {{Alter}}', 'Anton', 28, RED, { min: 14, lh: 1.15 }),
    T('Datum', 8, 121, 89, 7, metalDate + ' · ' + uhr('20'), 'Oswald', 10.5, '#ffffff', { up: true, ls: 0.05, min: 7, w: 400 }),
    T('Ort', 8, 129, 89, 7, 'Proberaum Hinterhof · Musterweg 5', 'Oswald', 10.5, '#bdbdc4', { up: true, ls: 0.05, min: 7, w: 400 }),
    T('Zusage', 8, 137, 89, 7, 'Cuts & Bier mitbringen · Zusage bis 5. Juni', 'Oswald', 8.5, RED, { up: true, ls: 0.05, min: 7, w: 400 }),
  ])],
});

const metalGitarre = Object.assign({}, metalBase, {
  slug: 'metal-geburtstag-gitarre', name: 'Metal-Geburtstag – Gitarre', variant: 'Gitarre',
  description: 'Hohe Einladungskarte (DIN lang) mit riesiger Zahl in Rot, E-Gitarre und Blitzen auf Schwarz; Name und Alter sind Felder.',
  tags: metalTags('Gitarre', 'Blitz', 'Riesenzahl', 'DIN lang'),
  formatKey: 'din-lang-portrait', width: 99, height: 210,
  pages: [page(gradient(180, '#0b0b0d', '#2a0a10'), [
    decor([
      dekoWindow('Textur', 'deko-motive-verschleiss-weiss', 0, 0, 99, 210, { opacity: 0.08 }),
      deko('Stacheldraht oben', 'deko-motive-stacheldraht-weiss', 6, 7, 87),
      deko('Stacheldraht unten', 'deko-motive-stacheldraht-weiss', 6, 196, 87),
      deko('Blitz links', 'deko-motive-blitz-gold', 8, 112, undefined, 50),
      deko('Blitz rechts', 'deko-motive-blitz-gold', 66, 112, undefined, 50, { flipX: true }),
      deko('Gitarre', 'deko-motive-e-gitarre', 30, 106, undefined, 60),
    ]),
    T('Kopf', 8, 20, 83, 10, 'HEAVY BIRTHDAY', 'Bebas Neue', 22, '#ffffff', { ls: 0.2, min: 14 }),
    T('Zahl', 8, 32, 83, 52, '{{Alter}}', 'Anton', 110, RED, { min: 40, lh: 1.1 }),
    T('Jahre', 8, 85, 83, 13, 'JAHRE LAUT', 'Bebas Neue', 28, '#ffffff', { ls: 0.1, min: 14 }),
    T('Name', 8, 97, 83, 9, '{{Name}}', 'Oswald', 15, '#bdbdc4', { up: true, ls: 0.1, w: 400, min: 9 }),
    T('Datum', 8, 170, 83, 7, metalDate, 'Oswald', 11, '#ffffff', { up: true, w: 400, ls: 0.04, min: 7 }),
    T('Zeit', 8, 178, 83, 7, 'ab ' + uhr('20') + ' · Musterweg 5', 'Oswald', 11, '#ffffff', { up: true, w: 400, ls: 0.04, min: 7 }),
    T('Zusage', 8, 186, 83, 7, 'Zusage bis 5. Juni: 0170 1234567', 'Oswald', 9, RED, { up: true, w: 400, ls: 0.04, min: 7 }),
  ])],
});

const metalFestival = Object.assign({}, metalBase, {
  slug: 'metal-geburtstag-festival', name: 'Metal-Geburtstag – Festival', variant: 'Festival', unit: 'px',
  description: 'Digitale Einladung als Instagram-Post im Stil eines Festivalplakats: Totenkopf, Blitze, großer Name, Alter in Rot. Name und Alter sind Felder.',
  tags: metalTags('Festival', 'Plakat', 'Instagram', 'Social Media', 'Open Air'),
  formatKey: 'instagram-post', width: 1080, height: 1080,
  pages: [page(gradient(160, '#2a0508', '#050506'), [
    decor([
      dekoWindow('Textur', 'deko-motive-verschleiss-weiss', 0, 0, 1080, 1080, { opacity: 0.1 }),
      deko('Blitz links', 'deko-motive-blitz-gold', 110, 130, undefined, 330),
      deko('Blitz rechts', 'deko-motive-blitz-gold', 1080 - 110 - 161, 130, undefined, 330, { flipX: true }),
      dekoIn('Totenkopf', 'deko-motive-totenkopf-rosen', 290, 110, 500, 360),
      deko('Stacheldraht', 'deko-motive-stacheldraht-gold', 90, 495, 900),
    ]),
    T('Kopf', 60, 52, 960, 50, 'ROCK & METAL NIGHT', 'Oswald', 24, '#ffffff', { ls: 0.35, w: 500, min: 16 }),
    T('Name', 60, 560, 960, 130, '{{Name}}', 'Anton', 90, '#ffffff', { up: true, min: 40, lh: 1.15 }),
    T('Alter', 60, 690, 960, 110, 'WIRD {{Alter}}', 'Anton', 66, RED, { min: 30, lh: 1.15 }),
    T('Datum', 60, 825, 960, 52, metalDate + ' · 20 Uhr', 'Oswald', 28, '#ffffff', { up: true, w: 400, ls: 0.08, min: 15 }),
    T('Ort', 60, 885, 960, 52, 'Proberaum Hinterhof · Musterweg 5', 'Oswald', 28, '#bdbdc4', { up: true, w: 400, ls: 0.08, min: 15 }),
    T('Zusage', 60, 945, 960, 52, 'Zusage bis 5. Juni · 0170 1234567', 'Oswald', 22, RED, { up: true, w: 400, ls: 0.08, min: 15 }),
  ])],
});

// ================================================================================================================== Gamer
const gamerFields = [field('Name', 'Name', 'text', 'Jonas'), field('Alter', 'Alter', 'text', '30')];
const gamerRows = [{ Name: 'Jonas', Alter: '30' }, { Name: 'Maximilian', Alter: '40' }, { Name: 'Eva', Alter: '18' }];
const gamerBase = { category: 'Einladungen', family: 'gamer-party', familyName: 'Gamer-Party', occasion: 'Geburtstag', unit: 'mm', fields: gamerFields, sampleRows: gamerRows };
const gamerTags = (...m) => tags('Gamer', 'Gaming', 'Party', 'Geburtstag', 'Einladung', 'Level', 'Controller', 'Pixel', 'Zocken', 'LAN-Party', m);
const NAVY = '#14122e', CYAN = '#2ff3ff', PINK = '#ff4fa3', YEL = '#ffd23f';
const gamerDate = when(19, 6);

const gamerLevel = Object.assign({}, gamerBase, {
  slug: 'gamer-party-level', name: 'Gamer-Party – Level freigeschaltet', variant: 'Level',
  description: 'Einladung im Retro-Spiele-Look (A6 hoch): Pixelrahmen, Controller und „Level freigeschaltet“. Name und Alter sind Felder.',
  tags: gamerTags('Pixelrahmen', 'Retro', 'Level freigeschaltet'),
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [page(NAVY, [
    decor([
      dekoIn('Rahmen', 'deko-motive-pixelrahmen-hoch-bunt', 2, 2, 101, 144),
      dekoIn('Controller', 'deko-motive-gamepad', 16, 16, 73, 40),
    ]),
    T('Kopf', 14, 60, 77, 6, 'ACHIEVEMENT UNLOCKED', 'IBM Plex Mono', 8, CYAN, { w: 600, ls: 0.08, min: 7 }),
    T('Level', 14, 67, 77, 18, 'LEVEL {{Alter}}', 'Righteous', 34, '#ffffff', { min: 16 }),
    T('Frei', 14, 85, 77, 10, 'freigeschaltet', 'Righteous', 17, PINK, { min: 10 }),
    T('Spieler', 14, 97, 77, 7, 'Spieler 1: {{Name}}', 'IBM Plex Mono', 10, YEL, { w: 600, min: 7 }),
    T('Datum', 14, 109, 77, 6, gamerDate, 'IBM Plex Mono', 8.5, '#ffffff', { w: 500, min: 7 }),
    T('Zeit', 14, 116, 77, 6, 'Start ' + uhr('18') + ' · Pizza inklusive', 'IBM Plex Mono', 8.5, '#ffffff', { w: 500, min: 7 }),
    T('Ort', 14, 123, 77, 6, 'Musterweg 5 · 12345 Musterstadt', 'IBM Plex Mono', 8.5, '#ffffff', { w: 500, min: 7 }),
    T('Zusage', 14, 130, 77, 6, 'Zusage bis 5. Juni', 'IBM Plex Mono', 8.5, CYAN, { w: 500, min: 7 }),
  ])],
});

const gamerStory = Object.assign({}, gamerBase, {
  slug: 'gamer-party-story', name: 'Gamer-Party – Story', variant: 'Story', unit: 'px',
  description: 'Hochkant-Einladung für Instagram-Stories: Neon-Verlauf, Gamepad, Pixelsterne und „Level freigeschaltet“. Name und Alter sind Felder.',
  tags: gamerTags('Instagram', 'Story', 'Social Media', 'Neon', 'Pixelsterne'),
  formatKey: 'instagram-story', width: 1080, height: 1920,
  pages: [page(gradient(180, '#2a1070', '#0b0b2a'), [
    decor([
      deko('Stern 1', 'deko-motive-pixelstern', 90, 120, 90), deko('Stern 2', 'deko-motive-pixelstern', 880, 220, 70), deko('Stern 3', 'deko-motive-pixelstern', 180, 560, 60),
      deko('Stern 4', 'deko-motive-pixelstern', 860, 640, 100), deko('Stern 5', 'deko-motive-pixelstern', 120, 1520, 80), deko('Stern 6', 'deko-motive-pixelstern', 890, 1480, 60),
      dekoIn('Gamepad', 'deko-motive-gamepad', 150, 230, 780, 420),
      rect('Balken', 190, 1090, 700, 10, PINK, { radius: 5 }),
    ]),
    T('Kopf', 60, 140, 960, 60, 'ACHIEVEMENT UNLOCKED', 'IBM Plex Mono', 24, CYAN, { w: 700, ls: 0.1, min: 15 }),
    T('Level', 60, 700, 960, 190, 'LEVEL {{Alter}}', 'Righteous', 100, '#ffffff', { min: 40, lh: 1.15 }),
    T('Frei', 60, 890, 960, 120, 'freigeschaltet!', 'Righteous', 62, PINK, { min: 30, lh: 1.15 }),
    T('Spieler', 60, 1020, 960, 60, 'Spieler 1: {{Name}}', 'IBM Plex Mono', 28, YEL, { w: 700, min: 15 }),
    T('Datum', 60, 1170, 960, 70, gamerDate, 'IBM Plex Mono', 30, '#ffffff', { w: 600, min: 15 }),
    T('Zeit', 60, 1250, 960, 70, 'Start ' + uhr('18') + ' · Pizza inklusive', 'IBM Plex Mono', 30, '#ffffff', { w: 600, min: 15 }),
    T('Ort', 60, 1330, 960, 70, 'Musterweg 5 · 12345 Musterstadt', 'IBM Plex Mono', 30, '#ffffff', { w: 600, min: 15 }),
    T('Zusage', 60, 1450, 960, 70, 'Zusage bis 5. Juni', 'IBM Plex Mono', 30, CYAN, { w: 600, min: 15 }),
    T('Start', 60, 1660, 960, 80, 'PRESS START', 'Righteous', 44, YEL, { ls: 0.2, min: 24 }),
  ])],
});

const gp = panels(210, 148, 'vertical', 4);
const gamerKlapp = Object.assign({}, gamerBase, {
  slug: 'gamer-party-klappkarte', name: 'Gamer-Party – Klappkarte', variant: 'Klappkarte', fold: 'vertical',
  description: 'Klappkarte (A6 hoch, innen und außen) im Pixel-Look: Joystick und Münze auf der Titelseite, innen die Quest und alle Angaben. Name und Alter sind Felder.',
  tags: gamerTags('Klappkarte', 'Joystick', 'Münze', 'Quest'),
  formatKey: 'card-a6-portrait', width: 210, height: 148,
  pages: foldCard('vertical', [
    decor([deko('Münze', 'deko-motive-pixelmuenze', 38, 26, 30), deko('Herz', 'deko-motive-pixelherz-rot', 24, 84, 26), deko('Stern', 'deko-motive-pixelstern', 60, 88, 22)]),
    T('Zurück', gp[0].x, 60, gp[0].w, 12, 'GAME ON!', 'Righteous', 22, CYAN, { min: 12 }),
    dekoIn('Controller', 'deko-motive-gamepad', 114, 10, 82, 42),
    T('Kopf', 112, 56, 86, 6, 'ACHIEVEMENT UNLOCKED', 'IBM Plex Mono', 7.5, CYAN, { w: 600, min: 7 }),
    T('Level', 112, 63, 86, 18, 'LEVEL {{Alter}}', 'Righteous', 32, '#ffffff', { min: 14 }),
    T('Frei', 112, 82, 86, 10, 'freigeschaltet', 'Righteous', 17, PINK, { min: 10 }),
    T('Spieler', 112, 97, 86, 8, 'Spieler 1: {{Name}}', 'IBM Plex Mono', 10, YEL, { w: 600, min: 7 }),
  ], [
    T('Quest', gp[0].x, 14, gp[0].w, 10, 'DIE QUEST', 'Righteous', 20, CYAN, { min: 12 }),
    P('Text', gp[0].x + 4, 28, gp[0].w - 8, 54, 'Pizza, Pixel und Punkte: Wir zocken, essen und feiern ins nächste Level. Bring dein Lieblingsspiel mit – und gute Laune. Controller sind da, Snacks auch.', 'IBM Plex Mono', 10.5, '#ffffff', { a: 'left', lh: 1.5, min: 8 }),
    T('Rand', gp[0].x, 98, gp[0].w, 8, '** SPEICHERN NICHT VERGESSEN **', 'IBM Plex Mono', 7.5, YEL, { min: 7, w: 600 }),
    decor([rect('Linie', 128, 12, 0.5, 124, '#ffffff', { opacity: 0.2 })]),
    ...info('Datum', 117, 24, 80, 'calendar-days', gamerDate, { chip: PINK, ic: '#ffffff', c: '#ffffff', f: 'IBM Plex Mono', s: 10, w: 500, d: 9 }),
    ...info('Zeit', 117, 42, 80, 'clock', 'Start ' + uhr('18') + ' · Pizza inklusive', { chip: PINK, ic: '#ffffff', c: '#ffffff', f: 'IBM Plex Mono', s: 10, w: 500, d: 9 }),
    ...info('Ort', 117, 60, 80, 'map-pin', 'Musterweg 5, 12345 Musterstadt', { chip: PINK, ic: '#ffffff', c: '#ffffff', f: 'IBM Plex Mono', s: 10, w: 500, d: 9 }),
    ...info('Zusage', 117, 78, 80, 'phone', 'Zusage bis 5. Juni: 0170 1234567', { chip: CYAN, ic: '#14122e', c: '#ffffff', f: 'IBM Plex Mono', s: 10, w: 500, d: 9 }),
  ], NAVY, NAVY),
});

module.exports = { templates: [metalSchaedel, metalGitarre, metalFestival, gamerLevel, gamerStory, gamerKlapp] };
