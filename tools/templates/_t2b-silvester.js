'use strict';
/* Family: Silvester-Party. Variants: Mitternacht (Einladung A6), Countdown (Plakat A3), Prosit (Instagram-Story). The year is a field. */
const D = require('./dsl');
const { decor, scatter, infoRow } = require('./_t2b-lib');
const { text, rect, ellipse, shape, icon, deko, dekoIn, page, gradient, field, line, shadow } = D;

const fields = [field('Jahr', 'Neues Jahr', 'text', '2028')];
const sampleRows = [{ Jahr: '2028' }, { Jahr: '2030' }, { Jahr: '2099' }];
const base = { category: 'Einladungen', family: 'silvester-party', familyName: 'Silvester-Party', occasion: 'Feiertage', unit: 'mm', fields, sampleRows };
const tags = (...more) => require('./_t2b-lib').dedupe(['Silvester', 'Silvesterparty', 'Neujahr', 'Party', 'Einladung', 'Jahreswechsel', 'Feuerwerk', 'Sekt', 'Prosit Neujahr', ...more]);
const GOLD = '#e6c06a'; const NAVY = '#0b1030';

// ------------------------------------------------------------------------------------------------------------------------ Mitternacht
const mitternacht = (() => Object.assign({}, base, {
  slug: 'silvester-mitternacht',
  name: 'Silvester – Mitternacht',
  description: 'Einladung zur Silvesterparty (A6 hoch) in Mitternachtsblau und Gold: Uhr auf zwölf, Sektgläser und Sterne. Das neue Jahr ist ein Feld, Termin und Ort trägst du ein.',
  variant: 'Mitternacht',
  tags: tags('Mitternacht', 'Gold', 'Uhr', 'Sektgläser', 'Elegant', 'Blau'),
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [page(gradient(175, '#0b1030', '#1f2c6b'), [
    decor([
      deko('Sterne', 'deko-sterne-himmel-gold', 0, -6, 105, undefined, { opacity: 0.4 }),
      ellipse('Uhr Glanz', 27, 12, 51, 51, '#ffffff', { opacity: 0.06 }),
      ellipse('Uhr', 31, 16, 43, 43, null, { stroke: GOLD, sw: 1.6 }),
      icon('Zeiger', 'clock-12', 37, 22, 31, GOLD, 1.3),
      icon('Glas links', 'wine', 8, 22, 17, '#ffffff', 1.3, { rotation: -16 }),
      icon('Glas rechts', 'wine', 80, 22, 17, '#ffffff', 1.3, { rotation: 16, flipX: true }),
      deko('Funkeln', 'deko-sterne-funkeln-gold', 80, 56, 10), deko('Funkeln 2', 'deko-sterne-funkeln-gold', 14, 52, 8),
      deko('Trenner', 'deko-trenner-sterne-gold', 27, 106, 51),
    ]),
    text('Kopf', 8, 68, 89, 7, 'SILVESTERPARTY', { f: 'Cinzel', s: 12, w: 400, c: GOLD, a: 'center', ls: 0.22, min: 7 }),
    text('Prosit', 6, 76, 93, 18, 'Prosit {{Jahr}}!', { f: 'Great Vibes', s: 38, c: '#ffffff', a: 'center', min: 16 }),
    text('Text', 12, 94, 81, 9, 'Wir tanzen, lachen und stoßen an.', { f: 'Cormorant Garamond', s: 12.5, w: 600, i: true, c: '#dfe3ff', a: 'center', min: 8 }),
    text('Datum', 8, 114, 89, 8, 'Freitag, 31. Dezember · ab 20 Uhr', { f: 'Cinzel', s: 10, w: 400, c: '#ffffff', a: 'center', ls: 0.04, min: 7 }),
    text('Ort', 8, 123, 89, 7, 'Musterweg 5 · 12345 Musterstadt', { f: 'Cormorant Garamond', s: 11.5, w: 600, c: GOLD, a: 'center', min: 7 }),
    text('Zusage', 8, 131, 89, 6, 'Bitte um Zusage bis 15. Dezember', { f: 'Cormorant Garamond', s: 9, w: 600, i: true, c: '#c9cff0', a: 'center', min: 6.5 }),
  ])],
}))();

// ------------------------------------------------------------------------------------------------------------------------ Countdown
const countdown = (() => Object.assign({}, base, {
  slug: 'silvester-countdown',
  name: 'Silvester – Countdown',
  description: 'Plakat A3 hoch für die Silvesterparty im Verein, Club oder Dorfgemeinschaftshaus: riesige Jahreszahl in Gold, Feuerwerk aus Sternen und Platz für Programm und Termin. Das Jahr ist ein Feld.',
  variant: 'Countdown',
  category: 'Poster',
  tags: tags('Plakat', 'Poster', 'A3', 'Countdown', 'Aushang', 'Feuerwerk', 'Verein', 'Club'),
  formatKey: 'poster-a3-portrait', width: 297, height: 420,
  pages: [page(gradient(170, '#05061a', '#17205a'), [
    decor([
      deko('Sterne', 'deko-sterne-himmel-weiss', 0, 0, 297, undefined, { opacity: 0.4 }),
      deko('Feuerwerk 1', 'deko-sterne-strahlen-gold', 14, 20, 130), deko('Feuerwerk 2', 'deko-sterne-strahlen-weiss', 190, 4, 96, undefined, { opacity: 0.85 }),
      deko('Feuerwerk 3', 'deko-sterne-strahlen-gold', 214, 120, 70, undefined, { opacity: 0.9 }),
      deko('Funkeln', 'deko-sterne-funkeln-gold', 150, 120, 26), deko('Funkeln 2', 'deko-sterne-funkeln-weiss', 236, 214, 22),
      rect('Band', 0, 336, 297, 84, '#0b1030'),
      line('Band Linie', 0, 336, 297, 336, GOLD, 0.8),
    ]),
    text('Kopf', 20, 176, 257, 22, 'SILVESTERPARTY', { f: 'Oswald', s: 28, w: 500, c: '#ffffff', a: 'left', ls: 0.4, min: 14 }),
    text('Jahr', 8, 184, 285, 148, '{{Jahr}}', { f: 'Anton', s: 250, c: GOLD, a: 'left', lh: 1, min: 70, shadow: shadow('#000000', 0.4, 4, 0, 3) }),
    text('Programm', 20, 342, 257, 24, 'Buffet · DJ · Mitternachts-Feuerwerk', { f: 'Oswald', s: 20, w: 500, c: '#ffffff', a: 'left', ls: 0.05, min: 10 }),
    text('Datum', 20, 366, 257, 22, 'Freitag, 31. Dezember · ab 20 Uhr', { f: 'Oswald', s: 24, w: 600, c: GOLD, a: 'left', min: 12 }),
    text('Ort', 20, 391, 257, 14, 'Dorfgemeinschaftshaus Musterstadt · Eintritt 15 €', { f: 'Oswald', s: 14, w: 400, c: '#c9cff0', a: 'left', min: 9 }),
  ])],
}))();

// ------------------------------------------------------------------------------------------------------------------------ Prosit
const prosit = (() => Object.assign({}, base, {
  slug: 'silvester-prosit',
  name: 'Silvester – Prosit',
  description: 'Instagram-Story (1080 x 1920 px) für den Jahreswechsel: Konfetti, Sektgläser und große Grußschrift auf Violett-Rosa. Das neue Jahr ist ein Feld.',
  variant: 'Prosit',
  category: 'Social Media',
  unit: 'px',
  tags: tags('Story', 'Instagram', 'Social Media', 'Konfetti', 'Gruß', 'Neujahrsgruß', 'Bunt'),
  formatKey: 'instagram-story', width: 1080, height: 1920,
  pages: [page(gradient(165, '#3a1c8a', '#d6409f'), [
    decor([
      deko('Konfetti', 'deko-konfetti-streuung-gold', 0, 0, 1080, undefined, { opacity: 0.8 }),
      deko('Konfetti 2', 'deko-konfetti-streuung-gold', 0, 840, 1080, undefined, { opacity: 0.8, flipX: true, flipY: true }),
      ellipse('Glanz', 140, 520, 800, 800, '#ffffff', { opacity: 0.1 }),
      rect('Textfeld', 100, 1470, 880, 190, '#3a1c8a', { opacity: 0.55, radius: 40 }),
      icon('Glas links', 'wine', 190, 560, 340, '#ffffff', 1.1, { rotation: -14 }),
      icon('Glas rechts', 'wine', 550, 560, 340, GOLD, 1.1, { rotation: 14, flipX: true }),
      deko('Funkeln', 'deko-sterne-funkeln-gold', 470, 470, 140), deko('Funkeln 2', 'deko-sterne-funkeln-weiss', 130, 520, 80), deko('Funkeln 3', 'deko-sterne-funkeln-weiss', 850, 600, 90),
    ]),
    text('Frohes', 80, 330, 920, 160, 'Frohes neues Jahr', { f: 'Great Vibes', s: 78, c: '#ffffff', a: 'center', min: 36, shadow: shadow('#3a1c8a', 0.4, 4, 0, 4) }),
    text('Jahr', 80, 1000, 920, 330, '{{Jahr}}', { f: 'Anton', s: 230, c: GOLD, a: 'center', lh: 1, min: 90, shadow: shadow('#3a1c8a', 0.5, 0, 6, 8) }),
    text('Prosit', 80, 1360, 920, 120, 'PROSIT!', { f: 'Poppins', s: 46, w: 700, c: '#ffffff', a: 'center', ls: 0.5, min: 24 }),
    text('Text', 140, 1490, 800, 150, 'Danke für ein tolles Jahr – wir starten gemeinsam ins neue.', { f: 'Poppins', s: 27, w: 600, c: '#ffe9f7', a: 'center', wrap: true, v: 'top', lh: 1.4, min: 14 }),
  ])],
}))();

module.exports = { templates: [mitternacht, countdown, prosit] };
