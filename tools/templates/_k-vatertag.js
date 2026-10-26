'use strict';
const L = require('./_t2a-lib');
const { text, rect, ellipse, line, icon, shape, page, foldCard, panels, ctext, divider, dk, dekoIn, tpl, gradient, shadow } = L;

const META = { family: 'vatertagskarte', familyName: 'Vatertagskarte', occasion: 'Feiertage' };

// ---------------------------------------------------------------------------------------------------------------------------- Werkzeug
const BROWN = '#4a3524';
const werkzeug = tpl(Object.assign({}, META, {
  slug: 'vatertagskarte-werkzeug',
  name: 'Vatertagskarte A6 quer – Werkzeug',
  description: 'Handfeste Vatertagskarte im Format A6 quer: Kraftpapier-Ton, Hammer, Schraubenschlüssel und Werkzeugkasten als Symbole, „Bester Papa der Welt“ in kräftiger Slab-Schrift. Innen mit Platz für dein Dankeschön.',
  variant: 'Werkzeug',
  tags: ['Vatertag', 'Papa', 'Werkzeug', 'Handwerker', 'Hammer', 'Kraftpapier', 'Karte', 'bester Papa', 'rustikal', 'Männertag'],
  formatKey: 'a6-landscape', width: 148, height: 105,
  pages: [
    page('#e5d1ae', [
      rect('Rahmen', 6, 6, 136, 93, null, { stroke: BROWN, sw: 0.8, dash: 'dashed', locked: true }),
      icon('Hammer', 'hammer', 14, 14, 18, BROWN, 1.6, { rotation: -15 }),
      icon('Schlüssel', 'wrench', 116, 14, 18, BROWN, 1.6, { rotation: 15 }),
      ctext('Bester', 74, 20, 100, 14, 'BESTER', { f: 'Roboto Slab', s: 22, w: 700, c: BROWN, ls: 0.24, lh: 1, min: 12 }),
      ctext('Papa', 74, 33, 130, 36, 'PAPA', { f: 'Roboto Slab', s: 66, w: 900, c: '#c4572c', lh: 1, min: 30 }),
      ctext('der Welt', 74, 68, 100, 12, 'DER WELT', { f: 'Roboto Slab', s: 18, w: 700, c: BROWN, ls: 0.3, lh: 1, min: 10 }),
      icon('Werkzeugkasten', 'toolbox', 66, 82, 14, BROWN, 1.6),
    ], 'Vorderseite'),
    page('#f6ecd9', [
      rect('Band', 0, 0, 148, 8, '#c4572c', { locked: true }),
      text('Anrede', 18, 18, 112, 11, 'Lieber Papa,', { f: 'Roboto Slab', s: 17, w: 700, c: '#c4572c', min: 9 }),
      text('Text', 18, 32, 112, 40, 'du kannst fast alles reparieren – und hast immer Zeit für mich. Danke für deine Geduld, deine Hilfe und deine Ideen. Zum Vatertag gibt es heute mal nichts zu schrauben!', { f: 'Roboto Slab', s: 10.5, w: 400, c: BROWN, v: 'top', wrap: true, lh: 1.5, min: 7 }),
      text('Gruß', 18, 82, 112, 9, 'Dein Sohn Max', { f: 'Roboto Slab', s: 12, w: 700, c: BROWN, a: 'right', min: 7 }),
      icon('Hammer', 'hammer', 118, 14, 12, BROWN, 1.6, { rotation: -15 }),
    ], 'Innenseite'),
  ],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Held
const NAVY = '#16264d';
const held = tpl(Object.assign({}, META, {
  slug: 'vatertagskarte-held',
  name: 'Vatertagskarte A6 hoch – Held',
  description: 'Vatertagskarte im Format A6 hoch mit Abzeichen: goldener Zackenstern mit der „1“, „Bester Papa“ in schmaler Großschrift auf Nachtblau und ein Banner. Innen hell und mit Platz für lange Sätze.',
  variant: 'Held',
  tags: ['Vatertag', 'Papa', 'Held', 'Abzeichen', 'Nummer eins', 'Gold', 'Nachtblau', 'Karte', 'bester Papa', 'Superpapa'],
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [
    page(NAVY, [
      dk('Starburst', 'deko-baender-starburst-gold', 14, 14, 77),
      ctext('Eins', 52.5, 31, 60, 44, '1', { f: 'Anton', s: 100, c: NAVY, lh: 1, min: 40 }),
      dk('Banderole', 'deko-baender-banderole-gold', 8, 92, 89),
      ctext('Papa', 52.5, 95, 80, 14, 'DER BESTE', { f: 'Anton', s: 16, c: NAVY, ls: 0.08, lh: 1, min: 8 }),
      ctext('Papa 2', 52.5, 116, 90, 26, 'PAPA', { f: 'Anton', s: 60, c: '#f1d78a', ls: 0.04, lh: 1, min: 28 }),
    ], 'Vorderseite'),
    page('#f8f4ea', [
      rect('Band', 0, 0, 105, 7, NAVY, { locked: true }),
      shape('star', 'Stern', 76, 14, 12, 12, '#d9b866', { points: 5, inner: 0.45, rotation: 10, locked: true }),
      text('Anrede', 16, 34, 66, 12, 'Lieber Papa,', { f: 'Anton', s: 18, c: NAVY, min: 10, ls: 0.03 }),
      text('Text', 16, 50, 73, 64, 'für mich bist du ein Held – nicht nur am Vatertag. Danke, dass du mir zeigst, wie man mutig ist, zuhört und nie aufgibt. Ich bin stolz auf dich!', { f: 'Montserrat', s: 10, w: 500, c: NAVY, v: 'top', wrap: true, lh: 1.6, min: 7 }),
      text('Gruß', 16, 122, 73, 9, 'Dein Sohn Leon', { f: 'Montserrat', s: 10.5, w: 700, c: '#b8902f', a: 'right', min: 7 }),
    ], 'Innenseite'),
  ],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Streifen (Klappkarte)
const KM = { formatKey: 'card-a6-portrait', fold: 'vertical', width: 210, height: 148 };
const [BL, FR] = panels(210, 148, 'vertical', 4);
const streifen = tpl(Object.assign({}, META, KM, {
  slug: 'vatertagskarte-streifen',
  name: 'Vatertagskarte Klappkarte – Streifen',
  description: 'Coole Klappkarte A6 hoch zum Vatertag: Nadelstreifen in Marineblau, „PAPA“ in großen Blockbuchstaben, ein Hauch Gold und eine aufgeräumte Innenseite für deinen Text.',
  variant: 'Streifen',
  tags: ['Vatertag', 'Papa', 'modern', 'Streifen', 'Nadelstreifen', 'Marine', 'Klappkarte', 'Karte', 'cool', 'Typografie'],
  pages: foldCard('vertical', [
    dk('Muster', 'deko-muster-streifen-navy', 105, 0, 105, 105, { opacity: 0.12 }),
    dk('Muster 2', 'deko-muster-streifen-navy', 105, 44, 105, 105, { opacity: 0.12 }),
    rect('Tafel', 116, 28, 82, 92, NAVY, { locked: true }),
    rect('Tafel Linie', 120, 32, 74, 84, null, { stroke: '#d9b866', sw: 0.4, locked: true }),
    ctext('PAPA', FR.cx, 46, 74, 34, 'PAPA', { f: 'Bebas Neue', s: 84, c: '#ffffff', lh: 1, min: 30, ls: 0.04 }),
    line('Strich', FR.cx - 12, 84, FR.cx + 12, 84, '#d9b866', 0.6, { locked: true }),
    ctext('Zeile', FR.cx, 89, 70, 14, 'Danke für alles.', { f: 'Dancing Script', s: 18, w: 700, c: '#d9b866', min: 9 }),
    ctext('Hinten', BL.cx, 70, 80, 8, 'Zum Vatertag', { f: 'Montserrat', s: 8, w: 600, c: NAVY, up: true, ls: 0.3, min: 5 }),
    icon('Krone', 'crown', BL.cx - 5, 56, 10, '#b8902f', 1.6),
  ], [
    dk('Muster innen', 'deko-muster-streifen-navy', 14, 36, 76, 76, { opacity: 0.14 }),
    ctext('Titel', 52.5, 54, 76, 20, 'Für den\nbesten Vater', { f: 'Bebas Neue', s: 32, c: NAVY, wrap: true, lh: 1.05, ls: 0.04, min: 14 }),
    text('Anrede', 120, 26, 76, 12, 'Lieber Papa,', { f: 'Dancing Script', s: 24, w: 700, c: '#b8902f', min: 12 }),
    text('Text', 120, 42, 76, 60, 'danke für deinen Rat, deinen Humor und deine ruhige Art. Auf dich kann man sich immer verlassen. Lass dich heute feiern!', { f: 'Montserrat', s: 10, w: 400, c: NAVY, v: 'top', wrap: true, lh: 1.6, min: 7 }),
    text('Gruß', 120, 108, 76, 10, 'Deine Tochter Mia', { f: 'Dancing Script', s: 19, w: 700, c: NAVY, a: 'right', min: 9 }),
  ], '#f4f1e8', '#ffffff'),
}));

module.exports = { werkzeug, held, streifen };
