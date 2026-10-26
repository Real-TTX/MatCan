'use strict';
const { gold: G, salbei: S, minimal: M, C, L } = require('./_t2a-wedding');
const { text, rect, ellipse, line, icon, page, ctext, divider, dk, dekoIn, tpl, diamond, foldCard, turn180, field, frameLine } = L;

const META = {
  family: 'hochzeit-tischkarte', familyName: 'Hochzeit: Tischkarte', occasion: 'Hochzeit', formatKey: 'table-card', fold: 'horizontal', width: 90, height: 100,
  fields: [field('Name', 'Name des Gastes', 'text', 'Marie Hoffmann'), field('Tisch', 'Tisch', 'text', '4')],
  sampleRows: [
    { Name: 'Marie Hoffmann', Tisch: '4' }, { Name: 'Familie Meyer', Tisch: '1' }, { Name: 'Maximiliane Schneider-Hohenstein', Tisch: '12' }, { Name: 'Jo', Tisch: '7' },
  ],
};

/** The upper half (the back) is read from the other side: the same face, turned. The inside is a quiet page. */
const tent = (face, inside, bg) => foldCard('horizontal', [turn180(face(0), 45, 25), face(50)], inside, bg);

// ---------------------------------------------------------------------------------------------------------------------------- Klassisch Gold
const gold = tpl(Object.assign({}, META, {
  slug: 'hochzeit-tischkarte-klassisch-gold', variant: G.variant,
  name: 'Hochzeit Tischkarte – Klassisch Gold',
  description: 'Tischkarte als Zeltkarte (gefaltet 90 × 50 mm) in Elfenbein und Gold: Name des Gastes in Schreibschrift zwischen zwei Goldlinien, darunter die Tischnummer. Vorder- und Rückseite zeigen den Namen. Für Serien mit Gästelisten.',
  tags: ['Hochzeit', 'Tischkarte', 'Platzkarte', 'Namenskarte', 'Zeltkarte', 'Gold', 'klassisch', 'Gäste', 'Tischordnung', 'Serie'],
  pages: tent(y => [
    frameLine('Rahmen', 4, y + 4, 82, 42, G.line, 0.3),
    dk('Funkeln', G.funkeln, 41, y + 7, 8),
    ctext('Name', 45, y + 16, 76, 15, '{{Name}}', { f: G.script, s: 25, c: G.ink, min: 11 }),
    divider('Trenner', 45, y + 35, 26, G.line, { gap: 3 }),
    ctext('Tisch', 45, y + 37.5, 60, 5, 'TISCH {{Tisch}}', { f: G.caps, s: 7, w: 500, c: G.accent, ls: 0.3, min: 5 }),
  ], [
    dk('Funkeln', G.funkeln, 38, 38, 14),
    ctext('Namen', 45, 56, 70, 8, 'Anna & Jonas', { f: G.script, s: 20, c: G.ink, min: 10 }),
    ctext('Datum', 45, 66, 70, 5, C.dateNum, { f: G.caps, s: 6.5, w: 500, c: G.accent, ls: 0.3, min: 4 }),
  ], G.bg),
}));

// ---------------------------------------------------------------------------------------------------------------------------- Botanisch Salbei
const salbei = tpl(Object.assign({}, META, {
  slug: 'hochzeit-tischkarte-botanisch-salbei', variant: S.variant,
  name: 'Hochzeit Tischkarte – Botanisch Salbei',
  description: 'Tischkarte als Zeltkarte (gefaltet 90 × 50 mm): Eukalyptuszweige in Salbeigrün, der Name des Gastes in leichter Schreibschrift, die Tischnummer in Kapitälchen. Beide Seiten zeigen den Namen. Für Serien mit Gästelisten.',
  tags: ['Hochzeit', 'Tischkarte', 'Platzkarte', 'Namenskarte', 'Zeltkarte', 'Eukalyptus', 'Salbei', 'botanisch', 'Gäste', 'Serie'],
  pages: tent(y => [
    dk('Zweig links', S.stem, 5, y + 4, 7),
    dk('Zweig rechts', S.stem, 78, y + 4, 7, undefined, { flipX: true }),
    ctext('Name', 45, y + 14, 56, 16, '{{Name}}', { f: S.script, s: 25, c: S.ink, min: 11 }),
    line('Strich', 38, y + 35, 52, y + 35, S.line, 0.3, { locked: true }),
    ctext('Tisch', 45, y + 38, 60, 5, 'TISCH {{Tisch}}', { f: S.caps, s: 6.5, w: 600, c: S.accent, ls: 0.34, min: 4.5 }),
  ], [
    dk('Zweig', S.stem, 41, 20, 8),
    ctext('Namen', 45, 62, 70, 8, 'Anna & Jonas', { f: S.script, s: 22, c: S.ink, min: 10 }),
    ctext('Datum', 45, 72, 70, 5, C.dateNum, { f: S.caps, s: 6.5, w: 600, c: S.accent, ls: 0.34, min: 4 }),
  ], S.bg),
}));

// ---------------------------------------------------------------------------------------------------------------------------- Modern Minimal
const minimal = tpl(Object.assign({}, META, {
  slug: 'hochzeit-tischkarte-modern-minimal', variant: M.variant,
  name: 'Hochzeit Tischkarte – Modern Minimal',
  description: 'Tischkarte als Zeltkarte (gefaltet 90 × 50 mm): der Name des Gastes in schlanken Großbuchstaben, darüber eine dünne Linie, die Tischnummer in Terrakotta. Beide Seiten zeigen den Namen. Für Serien mit Gästelisten.',
  tags: ['Hochzeit', 'Tischkarte', 'Platzkarte', 'Namenskarte', 'Zeltkarte', 'minimalistisch', 'modern', 'schlicht', 'Gäste', 'Serie'],
  pages: tent(y => [
    rect('Band', 0, y, 90, 5, M.soft, { locked: true }),
    ctext('Tisch', 45, y + 10, 60, 5, 'TISCH {{Tisch}}', { f: M.caps, s: 6.5, w: 600, c: M.accent, ls: 0.4, min: 4.5 }),
    ctext('Name', 45, y + 19, 76, 14, '{{Name}}', { f: M.caps, s: 15, w: 300, c: M.ink, ls: 0.12, up: true, min: 7 }),
    line('Linie', 40, y + 38, 50, y + 38, M.ink, 0.4, { locked: true }),
  ], [
    ctext('Namen', 45, 56, 70, 6, 'ANNA & JONAS', { f: M.caps, s: 8, w: 400, c: M.ink, ls: 0.34, min: 5 }),
    ctext('Datum', 45, 64, 70, 5, C.dateNum, { f: M.caps, s: 6.5, w: 600, c: M.accent, ls: 0.3, min: 4 }),
  ], M.bg),
}));

module.exports = { gold, salbei, minimal };
