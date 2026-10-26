'use strict';
const { gold: G, salbei: S, minimal: M, C, L } = require('./_t2a-wedding');
const { text, rect, ellipse, line, icon, page, ctext, divider, dk, dekoIn, tpl, diamond, foldCard, panels, turn180, ticks } = L;

const META = { family: 'hochzeit-einladung-klappkarte', familyName: 'Hochzeit: Einladung (Klappkarte)', occasion: 'Hochzeit' };

const INTRO = 'Wir heiraten und möchten diesen besonderen Tag gemeinsam mit euch feiern. Es wäre uns eine große Freude, euch an unserer Seite zu wissen.';

// ---------------------------------------------------------------------------------------------------------------------------- Klassisch Gold: 210 x 148, vertical fold
const [GBL, GFR] = panels(210, 148, 'vertical', 4);
const gold = tpl(Object.assign({}, META, {
  slug: 'hochzeit-einladung-klapp-klassisch-gold', variant: G.variant,
  name: 'Hochzeitseinladung Klappkarte – Klassisch Gold',
  description: 'Klassische Hochzeitseinladung als Klappkarte A6 hoch in Elfenbein und Gold: Doppelrahmen und Schreibschrift außen, innen links der Einladungstext, rechts Termin, Ort und Antwortfrist.',
  tags: ['Hochzeit', 'Einladung', 'Hochzeitseinladung', 'Klappkarte', 'Gold', 'klassisch', 'elegant', 'Einladungskarte', 'Heirat', 'Brautpaar'],
  formatKey: 'card-a6-portrait', fold: 'vertical', width: 210, height: 148,
  pages: foldCard('vertical', [
    dk('Siegel', G.seal, GBL.cx - 9, 62, 18),
    ctext('Hinten', GBL.cx, 84, 70, 7, 'ANNA & JONAS', { f: G.caps, s: 7, w: 500, c: G.accent, ls: 0.3, min: 4 }),
    dekoIn('Rahmen', G.frameHoch, 109, 5, 97, 138, { locked: true }),
    dk('Funkeln', G.funkeln, GFR.cx - 6, 22, 12),
    ctext('Einladung', GFR.cx, 40, 80, 7, 'WIR HEIRATEN', { f: G.caps, s: 9, w: 500, c: G.accent, ls: 0.3, min: 5 }),
    ctext('Name 1', GFR.cx, 50, 84, 20, C.a, { f: G.script, s: 40, c: G.ink, min: 20 }),
    ctext('Und', GFR.cx, 66, 20, 8, '&', { f: G.serif, s: 18, i: true, c: G.accent, min: 8 }),
    ctext('Name 2', GFR.cx, 72, 84, 20, C.b, { f: G.script, s: 40, c: G.ink, min: 20 }),
    divider('Trenner', GFR.cx, 100, 36, G.line),
    ctext('Datum', GFR.cx, 105, 80, 9, C.dateShort, { f: G.serif, s: 17, w: 600, c: G.ink, min: 9 }),
  ], [
    dk('Ecke oben', G.corner, 8, 8, 26),
    dk('Ecke unten', G.corner, 71, 114, 26, undefined, { flipX: true, flipY: true }),
    ctext('Titel', GBL.cx, 34, 80, 18, 'Mit Freude', { f: G.script, s: 32, c: G.accent, min: 16 }),
    ctext('Text', GBL.cx, 56, 74, 50, INTRO, { f: G.serif, s: 12.5, w: 500, c: G.ink, wrap: true, v: 'top', lh: 1.45, min: 8 }),
    ctext('Namen', GBL.cx, 112, 80, 8, 'Anna & Jonas', { f: G.script, s: 20, c: G.ink, min: 10 }),
    line('Mittelstrich', 105, 20, 105, 128, G.soft, 0.25, { locked: true }),
    ctext('Wann Label', 157.5, 24, 70, 6, 'WANN', { f: G.caps, s: 7.5, w: 500, c: G.accent, ls: 0.3, min: 5 }),
    ctext('Wann', 157.5, 30, 76, 14, C.date + '\nTrauung um ' + C.time, { f: G.serif, s: 12.5, w: 600, c: G.ink, wrap: true, lh: 1.35, v: 'top', min: 8 }),
    divider('Trenner 1', 157.5, 56, 30, G.line, { gap: 3 }),
    ctext('Wo Label', 157.5, 62, 70, 6, 'WO', { f: G.caps, s: 7.5, w: 500, c: G.accent, ls: 0.3, min: 5 }),
    ctext('Wo', 157.5, 68, 76, 18, C.place + '\nBirkenallee 4\n12345 ' + C.city, { f: G.serif, s: 12.5, w: 600, c: G.ink, wrap: true, lh: 1.35, v: 'top', min: 8 }),
    divider('Trenner 2', 157.5, 96, 30, G.line, { gap: 3 }),
    ctext('Antwort Label', 157.5, 102, 70, 6, 'ANTWORT', { f: G.caps, s: 7.5, w: 500, c: G.accent, ls: 0.3, min: 5 }),
    ctext('Antwort', 157.5, 108, 76, 14, 'Wir bitten um Rückmeldung\nbis zum 1. Mai 2027', { f: G.serif, s: 12, i: true, c: G.ink, wrap: true, lh: 1.35, v: 'top', min: 8 }),
  ], G.bg),
}));

// ---------------------------------------------------------------------------------------------------------------------------- Botanisch Salbei: 148 x 210, horizontal fold (top half = back, read upside down)
const [SBK, SFR] = panels(148, 210, 'horizontal', 4);
const salbei = tpl(Object.assign({}, META, {
  slug: 'hochzeit-einladung-klapp-botanisch-salbei', variant: S.variant,
  name: 'Hochzeitseinladung Klappkarte – Botanisch Salbei',
  description: 'Botanische Hochzeitseinladung als Klappkarte A6 quer (oben geklappt): Eukalyptus in Salbeigrün, Namen in leichter Schreibschrift außen; innen Einladungstext, Termin und Ort in ruhiger Serife.',
  tags: ['Hochzeit', 'Einladung', 'Hochzeitseinladung', 'Klappkarte', 'Eukalyptus', 'Salbei', 'botanisch', 'Boho', 'Einladungskarte', 'Heirat'],
  formatKey: 'card-a6-landscape', fold: 'horizontal', width: 148, height: 210,
  pages: foldCard('horizontal', [
    turn180([
      dk('Zweig hinten', S.stem, SBK.cx - 6, 10, 12),
      ctext('Hinten', SBK.cx, 62, 100, 8, 'Wir freuen uns auf euch', { f: S.serif, s: 14, i: true, c: S.ink, min: 8 }),
      ctext('Hinten Namen', SBK.cx, 74, 100, 6, 'ANNA & JONAS', { f: S.caps, s: 7, w: 600, c: S.accent, ls: 0.34, min: 7 }),
    ], SBK.cx, SBK.cy),
    dk('Ecke links', S.corner, 2, 107, 50),
    dk('Ecke rechts', S.corner, 96, 160, 50, undefined, { flipX: true, flipY: true }),
    ctext('Einladung', SFR.cx, 140, 100, 6, 'EINLADUNG ZUR HOCHZEIT', { f: S.caps, s: 7, w: 600, c: S.accent, ls: 0.34, min: 7 }),
    ctext('Namen', SFR.cx, 148, 120, 22, C.couple, { f: S.script, s: 40, c: S.ink, min: 20 }),
    line('Strich', SFR.cx - 12, 176, SFR.cx + 12, 176, S.line, 0.3, { locked: true }),
    ctext('Datum', SFR.cx, 180, 100, 8, C.dateShort, { f: S.serif, s: 15, w: 600, c: S.ink, min: 8 }),
  ], [
    dk('Zweig innen', S.stem, 22, 10, 9),
    dk('Zweig innen 2', S.stem, 117, 10, 9, undefined, { flipX: true }),
    ctext('Titel', 74, 30, 110, 18, 'Mit großer Freude', { f: S.script, s: 30, c: S.ink, min: 14 }),
    ctext('Text', 74, 52, 100, 32, INTRO, { f: S.serif, s: 12, w: 500, c: S.ink, wrap: true, v: 'top', lh: 1.45, min: 8 }),
    dk('Trenner', S.divider, 44, 94, 60),
    ctext('Wann Label', 74, 118, 80, 6, 'WANN', { f: S.caps, s: 7, w: 600, c: S.accent, ls: 0.34, min: 7 }),
    ctext('Wann', 74, 124, 110, 12, C.date + '\nTrauung um ' + C.time, { f: S.serif, s: 12, w: 600, c: S.ink, wrap: true, lh: 1.35, v: 'top', min: 8 }),
    ctext('Wo Label', 74, 146, 80, 6, 'WO', { f: S.caps, s: 7, w: 600, c: S.accent, ls: 0.34, min: 7 }),
    ctext('Wo', 74, 152, 110, 12, C.place + ', Birkenallee 4\n12345 ' + C.city, { f: S.serif, s: 12, w: 600, c: S.ink, wrap: true, lh: 1.35, v: 'top', min: 8 }),
    ctext('Antwort', 74, 178, 110, 12, 'Wir bitten um Rückmeldung\nbis zum 1. Mai 2027', { f: S.serif, s: 11, i: true, c: S.ink, wrap: true, lh: 1.35, v: 'top', min: 7 }),
  ], S.bg),
}));

// ---------------------------------------------------------------------------------------------------------------------------- Modern Minimal: 290 x 145, vertical fold
const [MBL, MFR] = panels(290, 145, 'vertical', 4);
const minimal = tpl(Object.assign({}, META, {
  slug: 'hochzeit-einladung-klapp-modern-minimal', variant: M.variant,
  name: 'Hochzeitseinladung Klappkarte – Modern Minimal',
  description: 'Moderne quadratische Klappkarte zur Hochzeit: die Initialen in schlanker Großschrift auf Weiß, dünne Linien; innen links der Text, rechts Termin, Ort und Antwort in drei klaren Zeilen.',
  tags: ['Hochzeit', 'Einladung', 'Hochzeitseinladung', 'Klappkarte', 'minimalistisch', 'modern', 'quadratisch', 'Typografie', 'schlicht', 'Heirat'],
  formatKey: 'card-square-145', fold: 'vertical', width: 290, height: 145,
  pages: foldCard('vertical', [
    ctext('Hinten', MBL.cx, 130, 100, 6, 'ANNA & JONAS · 12.06.2027', { f: M.caps, s: 7, w: 400, c: M.ink, ls: 0.3, min: 7 }),
    ticks('Marken', 160, 15, 115, 115, 6, M.ink, 0.3),
    ctext('Initialen', MFR.cx, 34, 110, 52, 'A & J', { f: M.caps, s: 70, w: 200, c: M.ink, lh: 1, min: 30 }),
    line('Linie', MFR.cx - 10, 92, MFR.cx + 10, 92, M.accent, 0.6, { locked: true }),
    ctext('Wir heiraten', MFR.cx, 98, 100, 7, 'WIR HEIRATEN', { f: M.caps, s: 8, w: 600, c: M.ink, ls: 0.4, min: 5 }),
    ctext('Datum', MFR.cx, 108, 100, 6, C.dateNum, { f: M.caps, s: 7.5, w: 300, c: M.accent, ls: 0.3, min: 5 }),
  ], [
    ctext('Titel', MBL.cx, 26, 100, 18, 'Wir laden euch ein.', { f: M.serif, s: 24, i: true, w: 400, c: M.ink, min: 12 }),
    line('Linie', MBL.cx - 10, 50, MBL.cx + 10, 50, M.accent, 0.6, { locked: true }),
    ctext('Text', MBL.cx, 58, 90, 44, INTRO, { f: M.sans, s: 9, w: 400, c: M.ink, wrap: true, v: 'top', lh: 1.8, min: 6 }),
    ctext('Namen', MBL.cx, 112, 90, 7, 'ANNA & JONAS', { f: M.caps, s: 8, w: 600, c: M.ink, ls: 0.34, min: 5 }),
    line('Mittelstrich', 145, 16, 145, 129, M.ink, 0.25, { locked: true }),
    text('Wann Label', 176, 22, 30, 6, 'WANN', { f: M.caps, s: 7, w: 600, c: M.accent, ls: 0.34, min: 4 }),
    text('Wann', 176, 29, 100, 14, C.date + '\nTrauung um ' + C.time, { f: M.sans, s: 10, w: 400, c: M.ink, wrap: true, lh: 1.5, v: 'top', min: 6 }),
    line('Linie 1', 176, 54, 276, 54, M.soft, 0.4, { locked: true }),
    text('Wo Label', 176, 60, 30, 6, 'WO', { f: M.caps, s: 7, w: 600, c: M.accent, ls: 0.34, min: 4 }),
    text('Wo', 176, 67, 100, 14, C.place + '\nBirkenallee 4 · 12345 ' + C.city, { f: M.sans, s: 10, w: 400, c: M.ink, wrap: true, lh: 1.5, v: 'top', min: 6 }),
    line('Linie 2', 176, 92, 276, 92, M.soft, 0.4, { locked: true }),
    text('Antwort Label', 176, 98, 40, 6, 'ANTWORT', { f: M.caps, s: 7, w: 600, c: M.accent, ls: 0.34, min: 4 }),
    text('Antwort', 176, 105, 100, 14, 'Bitte um Rückmeldung\nbis zum 1. Mai 2027', { f: M.sans, s: 10, w: 400, c: M.ink, wrap: true, lh: 1.5, v: 'top', min: 6 }),
  ], M.bg),
}));

module.exports = { gold, salbei, minimal };
