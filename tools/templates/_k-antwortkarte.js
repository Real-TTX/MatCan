'use strict';
const { gold: G, salbei: S, minimal: M, C, L } = require('./_t2a-wedding');
const { text, rect, ellipse, line, icon, page, ctext, divider, dk, dekoIn, tpl, diamond, formLine, checkItem } = L;

const META = { family: 'hochzeit-antwortkarte', familyName: 'Hochzeit: Antwortkarte', occasion: 'Hochzeit' };

/** The stamp field and the address of the couple on the back of a reply card. */
function addressSide(st, o) {
  return page(st.bg, [
    rect('Briefmarke', o.sx, o.sy, 22, 26, null, { stroke: st.line, sw: 0.3, dash: 'dashed', locked: true }),
    ctext('Briefmarke Hinweis', o.sx + 11, o.sy + 9, 20, 8, 'Marke', { f: st.sans, s: 6, c: st.accent, min: 4 }),
    ...o.extra,
    text('Empfänger', o.ax, o.ay, o.aw, 6, 'ANTWORT AN', { f: st.caps, s: 6.5, w: 600, c: st.accent, ls: 0.3, min: 4 }),
    text('Anschrift', o.ax, o.ay + 8, o.aw, 22, 'Anna & Jonas Berger\nBirkenallee 4\n12345 ' + C.city, { f: st.serif, s: o.fs || 14, w: 600, c: st.ink, wrap: true, v: 'top', lh: 1.4, min: 8 }),
  ], 'Rückseite');
}

// ---------------------------------------------------------------------------------------------------------------------------- Klassisch Gold: A6 quer
const gold = tpl(Object.assign({}, META, {
  slug: 'hochzeit-antwortkarte-klassisch-gold', variant: G.variant,
  name: 'Hochzeit Antwortkarte – Klassisch Gold',
  description: 'Antwortkarte zur Hochzeit im Format A6 quer in Elfenbein und Gold: Zu- oder Absage zum Ankreuzen, Zeilen für Namen, Personenzahl und Menüwünsche; die Rückseite mit Anschrift des Brautpaars und Briefmarkenfeld.',
  tags: ['Hochzeit', 'Antwortkarte', 'Rückmeldung', 'Zusage', 'Absage', 'Gold', 'klassisch', 'Postkarte', 'Einladung', 'Heirat'],
  formatKey: 'postcard-a6-landscape', width: 148, height: 105,
  pages: [
    page(G.bg, [
      dekoIn('Rahmen', G.frameQuer, 3, 3, 142, 99, { locked: true }),
      ctext('Titel', 74, 11, 120, 14, 'Wir freuen uns auf eure Antwort', { f: G.script, s: 21, c: G.ink, min: 11 }),
      ...checkItem('Zusage', 18, 29, 56, 'Wir kommen sehr gern', { f: G.serif, s: 11, c: G.ink, color: G.accent, size: 3.6 }),
      ...checkItem('Absage', 80, 29, 56, 'Wir können leider nicht', { f: G.serif, s: 11, c: G.ink, color: G.accent, size: 3.6 }),
      ...formLine('Namen', 18, 50, 112, 'Name(n)', { color: G.line, f: G.serif, labelSize: 8.5, labelColor: G.accent }),
      ...formLine('Personen', 18, 65, 28, 'Anzahl Personen', { color: G.line, f: G.serif, labelSize: 8.5, labelColor: G.accent }),
      ...formLine('Wünsche', 54, 65, 76, 'Menüwunsch / Unverträglichkeiten', { color: G.line, f: G.serif, labelSize: 8.5, labelColor: G.accent }),
      ctext('Frist', 74, 82, 120, 7, C.reply, { f: G.serif, s: 10.5, i: true, c: G.accent, min: 7 }),
    ], 'Vorderseite'),
    addressSide(G, {
      sx: 120, sy: 9, ax: 58, ay: 46, aw: 80,
      extra: [dk('Schwung', G.schwung, 8, 12, 40), dk('Funkeln', G.funkeln, 20, 70, 14), line('Strich', 52, 44, 52, 90, G.soft, 0.3, { locked: true })],
    }),
  ],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Botanisch Salbei: A6 hoch
const salbei = tpl(Object.assign({}, META, {
  slug: 'hochzeit-antwortkarte-botanisch-salbei', variant: S.variant,
  name: 'Hochzeit Antwortkarte – Botanisch Salbei',
  description: 'Antwortkarte zur Hochzeit im Format A6 hoch: Eukalyptusecken in Salbeigrün, Zu- oder Absage zum Ankreuzen, Zeilen für Namen, Personenzahl und Menüwunsch; die Rückseite mit Anschrift und Briefmarkenfeld.',
  tags: ['Hochzeit', 'Antwortkarte', 'Rückmeldung', 'Zusage', 'Absage', 'Eukalyptus', 'Salbei', 'botanisch', 'Postkarte', 'Boho'],
  formatKey: 'postcard-a6-portrait', width: 105, height: 148,
  pages: [
    page(S.bg, [
      dk('Ecke oben', S.corner, 0, 0, 36),
      dk('Ecke unten', S.corner, 69, 112, 36, undefined, { flipX: true, flipY: true }),
      ctext('Titel', 52.5, 22, 80, 22, 'Wir freuen uns\nauf eure Antwort', { f: S.script, s: 22, c: S.ink, wrap: true, lh: 1.1, min: 12 }),
      ...checkItem('Zusage', 16, 52, 74, 'Wir kommen sehr gern', { f: S.serif, s: 11.5, c: S.ink, color: S.accent, size: 3.6 }),
      ...checkItem('Absage', 16, 61, 74, 'Wir können leider nicht', { f: S.serif, s: 11.5, c: S.ink, color: S.accent, size: 3.6 }),
      ...formLine('Namen', 16, 82, 73, 'Name(n)', { color: S.line, f: S.sans, labelSize: 7.5, labelColor: S.accent }),
      ...formLine('Personen', 16, 96, 30, 'Anzahl Personen', { color: S.line, f: S.sans, labelSize: 7.5, labelColor: S.accent }),
      ...formLine('Wünsche', 16, 110, 73, 'Menüwunsch / Unverträglichkeiten', { color: S.line, f: S.sans, labelSize: 7.5, labelColor: S.accent }),
      ctext('Frist', 52.5, 128, 80, 8, C.reply, { f: S.serif, s: 9.5, i: true, c: S.accent, min: 6 }),
    ], 'Vorderseite'),
    addressSide(S, {
      sx: 77, sy: 8, ax: 18, ay: 68, aw: 70, fs: 14,
      extra: [dk('Zweig', S.stem, 8, 8, 10), dk('Trenner', S.divider, 18, 58, 60)],
    }),
  ],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Modern Minimal: A6 quer
const minimal = tpl(Object.assign({}, META, {
  slug: 'hochzeit-antwortkarte-modern-minimal', variant: M.variant,
  name: 'Hochzeit Antwortkarte – Modern Minimal',
  description: 'Antwortkarte zur Hochzeit im Format A6 quer: links Titel und Frist, rechts Zu- oder Absage zum Ankreuzen und dünne Schreiblinien; die Rückseite in warmem Sand mit Anschrift und Briefmarkenfeld.',
  tags: ['Hochzeit', 'Antwortkarte', 'Rückmeldung', 'Zusage', 'Absage', 'minimalistisch', 'modern', 'schlicht', 'Postkarte', 'Typografie'],
  formatKey: 'postcard-a6-landscape', width: 148, height: 105,
  pages: [
    page(M.bg, [
      rect('Block', 0, 0, 52, 105, M.soft, { locked: true }),
      text('Titel', 9, 12, 38, 40, 'Wir freuen\nuns auf\neure\nAntwort.', { f: M.serif, s: 21, i: true, w: 400, c: M.ink, wrap: true, lh: 1.1, v: 'top', min: 10 }),
      text('Frist', 9, 82, 38, 14, 'BITTE BIS\n1. MAI 2027', { f: M.caps, s: 6.5, w: 600, c: M.ink, ls: 0.24, wrap: true, lh: 1.5, v: 'top', min: 4 }),
      ...checkItem('Zusage', 62, 12, 78, 'Wir kommen gern', { f: M.sans, s: 9, c: M.ink, color: M.ink, size: 3.4, radius: 0 }),
      ...checkItem('Absage', 62, 21, 78, 'Wir können leider nicht', { f: M.sans, s: 9, c: M.ink, color: M.ink, size: 3.4, radius: 0 }),
      ...formLine('Namen', 62, 44, 76, 'NAME(N)', { color: M.ink, f: M.caps, labelSize: 7, labelColor: M.accent }),
      ...formLine('Personen', 62, 60, 28, 'PERSONEN', { color: M.ink, f: M.caps, labelSize: 7, labelColor: M.accent }),
      ...formLine('Wünsche', 62, 76, 76, 'MENÜWUNSCH / UNVERTRÄGLICHKEITEN', { color: M.ink, f: M.caps, labelSize: 7, labelColor: M.accent }),
    ], 'Vorderseite'),
    addressSide(M, {
      sx: 118, sy: 9, ax: 14, ay: 52, aw: 80, fs: 13,
      extra: [text('Hinweis', 14, 12, 70, 14, 'Danke für eure\nRückmeldung.', { f: M.serif, s: 17, i: true, c: M.ink, wrap: true, lh: 1.15, v: 'top', min: 9 })],
    }),
  ].map((p, i) => (i === 1 ? Object.assign(p, { background: { color: M.paper2 } }) : p)),
}));

module.exports = { gold, salbei, minimal };
