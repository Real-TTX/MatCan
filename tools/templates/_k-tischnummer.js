'use strict';
const { gold: G, salbei: S, minimal: M, C, L } = require('./_t2a-wedding');
const { text, rect, ellipse, line, icon, page, ctext, divider, dk, dekoIn, tpl, diamond, field } = L;

const META = {
  family: 'hochzeit-tischnummer', familyName: 'Hochzeit: Tischnummer', occasion: 'Hochzeit', formatKey: 'table-number', width: 105, height: 148,
  fields: [field('Tisch', 'Tischnummer', 'text', '7')],
  sampleRows: ['1', '7', '10', '12', '4'].map(Tisch => ({ Tisch })),
};

// ---------------------------------------------------------------------------------------------------------------------------- Klassisch Gold
const gold = tpl(Object.assign({}, META, {
  slug: 'hochzeit-tischnummer-klassisch-gold', variant: G.variant,
  name: 'Hochzeit Tischnummer – Klassisch Gold',
  description: 'Tischnummer im Format A6 hoch in Elfenbein und Gold: Doppelrahmen, „Tisch“ in Schreibschrift und die Nummer (Feld) in großer Antiqua. Mit einer Liste der Tische ganz einfach als Serie zu drucken.',
  tags: ['Hochzeit', 'Tischnummer', 'Tischnummern', 'Tisch', 'Gold', 'klassisch', 'A6', 'Dekoration', 'Serie', 'Aufsteller'],
  pages: [page(G.bg, [
    dekoIn('Rahmen', G.frameHoch, 4, 4, 97, 140, { locked: true }),
    dk('Funkeln', G.funkeln, 46.5, 20, 12),
    ctext('Tisch', 52.5, 30, 80, 18, 'Tisch', { f: G.script, s: 40, c: G.accent, min: 20 }),
    ctext('Nummer', 52.5, 48, 90, 64, '{{Tisch}}', { f: G.serif, s: 150, w: 500, c: G.ink, lh: 1, min: 60 }),
    divider('Trenner', 52.5, 126, 40, G.line),
  ], 'Tischnummer')],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Botanisch Salbei
const salbei = tpl(Object.assign({}, META, {
  slug: 'hochzeit-tischnummer-botanisch-salbei', variant: S.variant,
  name: 'Hochzeit Tischnummer – Botanisch Salbei',
  description: 'Tischnummer im Format A6 hoch: ein Eukalyptuskranz in Salbeigrün umrahmt die Nummer (Feld), darüber „Tisch“ in Kapitälchen. Mit einer Liste der Tische ganz einfach als Serie zu drucken.',
  tags: ['Hochzeit', 'Tischnummer', 'Tischnummern', 'Tisch', 'Eukalyptus', 'Salbei', 'botanisch', 'A6', 'Dekoration', 'Serie'],
  pages: [page(S.bg, [
    dk('Kranz', S.wreath, 6, 26, 93),
    ctext('Tisch', 52.5, 46, 60, 7, 'TISCH', { f: S.caps, s: 9, w: 600, c: S.accent, ls: 0.4, min: 5 }),
    ctext('Nummer', 52.5, 54, 60, 36, '{{Tisch}}', { f: S.serif, s: 80, w: 500, c: S.ink, lh: 1, min: 34 }),
    ctext('Namen', 52.5, 128, 80, 6, 'ANNA & JONAS', { f: S.caps, s: 7, w: 600, c: S.accent, ls: 0.34, min: 7 }),
  ], 'Tischnummer')],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Modern Minimal
const minimal = tpl(Object.assign({}, META, {
  slug: 'hochzeit-tischnummer-modern-minimal', variant: M.variant,
  name: 'Hochzeit Tischnummer – Modern Minimal',
  description: 'Tischnummer im Format A6 hoch: eine riesige, schlanke Ziffer (Feld) auf Weiß, ein sandfarbener Streifen und „Tisch“ in Terrakotta. Mit einer Liste der Tische ganz einfach als Serie zu drucken.',
  tags: ['Hochzeit', 'Tischnummer', 'Tischnummern', 'Tisch', 'minimalistisch', 'modern', 'A6', 'Typografie', 'Serie', 'Aufsteller'],
  pages: [page(M.bg, [
    rect('Streifen', 0, 112, 105, 36, M.soft, { locked: true }),
    text('Tisch', 12, 14, 60, 7, 'TISCH', { f: M.caps, s: 10, w: 600, c: M.accent, ls: 0.5, min: 5 }),
    text('Nummer', 4, 22, 97, 90, '{{Tisch}}', { f: M.caps, s: 200, w: 200, c: M.ink, lh: 1, a: 'center', min: 70 }),
    text('Namen', 12, 124, 80, 6, 'ANNA & JONAS', { f: M.caps, s: 7.5, w: 400, c: M.ink, ls: 0.34, min: 5 }),
    text('Datum', 12, 132, 80, 5, C.dateNum, { f: M.caps, s: 7, w: 600, c: M.accent, ls: 0.3, min: 7 }),
  ], 'Tischnummer')],
}));

module.exports = { gold, salbei, minimal };
