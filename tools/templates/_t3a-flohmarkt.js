'use strict';
const { dsl, pt, ADDRESS, PHONE, WEB, infoRow } = require('./_t3a-lib');
const { text, rect, ellipse, shape, icon, frame, deko, dekoIn, group, page, typo, qr, line, shadow } = dsl;

const FAMILY = { family: 'flyer-flohmarkt', familyName: 'Flyer Flohmarkt', occasion: 'Handel & Preise', category: 'Flyer' };

// ---- Kraftpapier: A4, hand-lettered, taped paper card and a stamp
const KRAFT = '#e2c79b';
const INK = '#2b1d12';
const RED = '#b3261e';
const PAPER = '#fffaf0';
const kraftpapier = {
  ...FAMILY,
  slug: 'flyer-flohmarkt-kraftpapier',
  name: 'Flyer A4 – Flohmarkt Kraftpapier',
  variant: 'Kraftpapier',
  formatKey: 'a4-portrait', width: 210, height: 297,
  description: 'A4-Aushang für Flohmarkt, Trödelmarkt oder Garagenflohmarkt im Kraftpapier-Stil: Filzstift-Schrift, Zettel mit Klebeband für Datum und Ort, Stempel „Eintritt frei“ und Infos zur Standanmeldung.',
  tags: ['Flyer', 'Flohmarkt', 'Trödelmarkt', 'Garagenflohmarkt', 'Hofflohmarkt', 'Aushang', 'Kraftpapier', 'Plakat', 'Schnäppchen'],
  pages: [page(KRAFT, [
    text('Großer', 30, 20, 80, 18, 'Der große', { f: 'Caveat', w: 700, s: 46, c: RED, a: 'left', min: 20, rotation: -5 }),
    text('Titel', 16, 34, 178, 46, 'FLOHMARKT', { f: 'Permanent Marker', s: 100, c: INK, a: 'center', lh: 1.1, min: 50 }),
    rect('Unterstrich', 62, 82, 86, 1.6, RED, { locked: true, rotation: -1.2 }),
    text('Untertitel', 20, 90, 170, 14, 'Trödeln, Stöbern, Schnäppchen finden', { f: 'Caveat', w: 700, s: 34, c: INK, a: 'center', min: 18 }),
    text('Rubriken', 15, 108, 180, 8, 'KLEIDUNG  ·  BÜCHER  ·  SPIELZEUG  ·  HAUSHALT  ·  DEKO', { f: 'Source Sans 3', w: 700, s: 11, c: INK, a: 'center', ls: 0.12, min: 7 }),
    group('Zettel', [
      rect('Zettel Papier', 22, 130, 166, 74, PAPER, { shadow: shadow('#3b2a1a', 0.3, 3, 0.5, 1) }),
      rect('Klebeband links', 14, 128, 30, 9, '#f2dc8a', { opacity: 0.85, rotation: -35 }),
      rect('Klebeband rechts', 166, 128, 30, 9, '#f2dc8a', { opacity: 0.85, rotation: 35 }),
      text('Datum', 30, 140, 150, 17, 'Samstag, 11. September', { f: 'Permanent Marker', s: 30, c: INK, a: 'center', min: 14 }),
      text('Uhrzeit', 30, 160, 150, 12, 'von 9 bis 16 Uhr', { f: 'Caveat', w: 700, s: 32, c: RED, a: 'center', min: 16 }),
      text('Ort', 30, 176, 150, 20, 'Schulhof der Grundschule\nSchulstraße 4, 12345 Musterstadt', { f: 'Source Sans 3', w: 600, s: 13, c: '#4a3b2c', a: 'center', v: 'top', wrap: true, lh: 1.4, min: 8 }),
    ], { rotation: -1.5 }),
    group('Stempel', [
      ellipse('Stempel Ring außen', 144, 218, 50, 50, null, { stroke: INK, sw: 2.4 }),
      ellipse('Stempel Ring innen', 147.5, 221.5, 43, 43, null, { stroke: INK, sw: 0.7 }),
      text('Stempel Text', 148, 234, 42, 18, 'EINTRITT\nFREI', { f: 'Permanent Marker', s: 15, c: INK, a: 'center', v: 'middle', wrap: true, lh: 1.15, min: 8 }),
    ], { rotation: -12, opacity: 0.85 }),
    text('Anmeldung Titel', 24, 220, 110, 12, 'Du willst einen Stand?', { f: 'Permanent Marker', s: 22, c: INK, a: 'left', min: 12 }),
    infoRow('Gebühr', 'coins', 24, 237, 110, '', 'Standgebühr 10 € pro Tisch', { c: INK, vs: 12, vw: 600, ic: 6.5 }),
    infoRow('Aufbau', 'clock', 24, 248, 110, '', 'Aufbau ab 7 Uhr', { c: INK, vs: 12, vw: 600, ic: 6.5 }),
    infoRow('Anmeldung', 'phone', 24, 259, 110, '', `Anmeldung unter ${PHONE}`, { c: INK, vs: 12, vw: 600, ic: 6.5 }),
    rect('Fußband', 0, 281, 210, 16, INK, { locked: true }),
    text('Hinweis', 14, 275, 182, 16, 'Bei schlechtem Wetter findet der Flohmarkt in der Turnhalle statt.', { f: 'Caveat', w: 700, s: 17, c: KRAFT, a: 'center', min: 10 }),
  ])],
};

// ---- Plakativ: A5, yellow with a black stripe
const YEL = '#ffe14d';
const BLK = '#111111';
const plakativ = {
  ...FAMILY,
  slug: 'flyer-flohmarkt-plakativ',
  name: 'Flyer A5 – Flohmarkt Plakativ',
  variant: 'Plakativ',
  formatKey: 'a5-portrait', width: 148, height: 210,
  description: 'Lauter A5-Flyer für den Flohmarkt: gelber Grund, zwei riesige Anton-Zeilen, schräges schwarzes Band mit Mitmachaufruf und eine runde Plakette mit dem Datum.',
  tags: ['Flyer', 'Flohmarkt', 'Trödelmarkt', 'Plakativ', 'Gelb', 'Schwarz', 'Aushang', 'Stand', 'Verkaufen'],
  pages: [page(YEL, [
    text('Zeile 1', 8, 8, 132, 48, 'FLOH-', { f: 'Anton', s: 130, c: BLK, a: 'left', lh: 1.15, min: 50 }),
    text('Zeile 2', 8, 52, 132, 48, 'MARKT', { f: 'Anton', s: 130, c: BLK, a: 'left', lh: 1.15, min: 50 }),
    rect('Band', -10, 108, 170, 17, BLK, { rotation: -4, locked: true }),
    text('Band Text', -4, 108, 160, 17, 'JEDER KANN MITMACHEN  ·  JEDER KANN MITMACHEN', { f: 'Anton', s: 16, c: YEL, a: 'center', ls: 0.06, min: 9, rotation: -4 }),
    group('Datum', [
      ellipse('Datum Kreis', 92, 132, 46, 46, BLK),
      text('Datum Wochentag', 94, 140, 42, 6, 'SAMSTAG', { f: 'Source Sans 3', w: 700, s: 8, c: '#ffffff', a: 'center', ls: 0.16, min: 6 }),
      text('Datum Tag', 94, 145, 42, 17, '11.9.', { f: 'Anton', s: 32, c: YEL, a: 'center', lh: 1.1, min: 16 }),
      text('Datum Zeit', 94, 162, 42, 6, '9–16 Uhr', { f: 'Source Sans 3', w: 700, s: 9, c: '#ffffff', a: 'center', min: 6 }),
    ], { rotation: 8 }),
    text('Ort Titel', 10, 134, 78, 8, 'WO?', { f: 'Anton', s: 20, c: BLK, a: 'left', min: 10 }),
    text('Ort', 10, 143, 80, 18, 'Festplatz am Marktring\nMarktring 1, Musterstadt', { f: 'Source Sans 3', w: 600, s: 10.5, c: BLK, a: 'left', v: 'top', wrap: true, lh: 1.4, min: 7 }),
    text('Stand Titel', 10, 166, 78, 8, 'STAND GESUCHT?', { f: 'Anton', s: 14, c: BLK, a: 'left', min: 9 }),
    text('Stand', 10, 174, 80, 12, 'Tisch 5 €, Aufbau ab 7 Uhr\nAnmeldung: ' + PHONE, { f: 'Source Sans 3', s: 9.5, c: BLK, a: 'left', v: 'top', wrap: true, lh: 1.4, min: 7 }),
    rect('Fuß', 0, 194, 148, 16, BLK, { locked: true }),
    text('Fußzeile', 10, 194, 128, 16, 'Eintritt frei  ·  Kaffee und Kuchen vor Ort', { f: 'Source Sans 3', w: 700, s: 10, c: YEL, a: 'center', min: 7 }),
  ])],
};

// ---- Pastell: A5, soft pattern top, white card with rounded type
const PINK = '#ff8fab';
const MINTY = '#2a9d8f';
const DARK = '#2d3a4a';
const pastell = {
  ...FAMILY,
  slug: 'flyer-flohmarkt-pastell',
  name: 'Flyer A5 – Flohmarkt Pastell',
  variant: 'Pastell',
  formatKey: 'a5-portrait', width: 148, height: 210,
  description: 'Freundlicher A5-Flyer für Kinderflohmarkt oder Basar: Blümchenmuster oben, rosa Titelpille, weiße Infokarte mit runden Symbolen und ein Hinweis auf Standgebühr und Anmeldung.',
  tags: ['Flyer', 'Flohmarkt', 'Kinderflohmarkt', 'Basar', 'Kleiderbasar', 'Pastell', 'Rund', 'Familie', 'Aushang'],
  pages: [page('#fff1f4', [
    deko('Muster', 'deko-muster-bluemchen-pastell', -5, -20, 158, undefined, { locked: true }),
    rect('Karte', 8, 62, 132, 140, '#ffffff', { radius: 8, shadow: shadow('#8a4a5a', 0.18, 6, 0, 1.5) }),
    rect('Titelpille', 14, 44, 120, 34, PINK, { radius: 17, shadow: shadow('#8a4a5a', 0.25, 4, 0, 1.2) }),
    text('Titel', 16, 45, 116, 32, 'Flohmarkt', { f: 'Fredoka', w: 700, s: 54, c: '#ffffff', a: 'center', lh: 1.15, min: 24 }),
    text('Untertitel', 14, 84, 120, 9, 'für Kinderkleidung & Spielzeug', { f: 'Fredoka', w: 500, s: 16, c: DARK, a: 'center', min: 10 }),
    infoRow('Datum', 'calendar-days', 20, 102, 108, 'Wann', `Sonntag, 19. September, 10${typo.dash}14 Uhr`, { f: 'Fredoka', lf: 'Fredoka', c: DARK, icolor: '#ffffff', disc: MINTY, ic: 6, discSize: 10, vs: 11, vw: 500, lc: '#8a8f98', gap: 3.5 }),
    infoRow('Ort', 'map-pin', 20, 120, 108, 'Wo', 'Gemeindesaal St. Martin, Kirchweg 2', { f: 'Fredoka', lf: 'Fredoka', c: DARK, icolor: '#ffffff', disc: PINK, ic: 6, discSize: 10, vs: 11, vw: 500, lc: '#8a8f98', gap: 3.5 }),
    infoRow('Stand', 'tag', 20, 138, 108, 'Stand', 'Tisch 5 €, ein Kuchen für das Buffet', { f: 'Fredoka', lf: 'Fredoka', c: DARK, icolor: '#ffffff', disc: '#f4a261', ic: 6, discSize: 10, vs: 11, vw: 500, lc: '#8a8f98', gap: 3.5 }),
    rect('Anmeldung Feld', 18, 160, 112, 26, '#fff1f4', { radius: 6 }),
    text('Anmeldung Titel', 22, 162, 104, 8, 'Standanmeldung', { f: 'Fredoka', w: 600, s: 13, c: PINK, a: 'center', min: 8 }),
    text('Anmeldung', 22, 170, 104, 12, `Bis 13. September unter ${PHONE}\noder per Mail an markt@beispiel.de`, { f: 'Fredoka', s: 10, c: DARK, a: 'center', v: 'top', wrap: true, lh: 1.35, min: 7 }),
    text('Hinweis', 14, 190, 120, 7, 'Eintritt frei  ·  Café vor Ort', { f: 'Fredoka', w: 500, s: 11, c: MINTY, a: 'center', min: 8 }),
  ])],
};

module.exports = { variants: [kraftpapier, plakativ, pastell] };
