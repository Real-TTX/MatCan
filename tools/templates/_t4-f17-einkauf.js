'use strict';
const { field, page, rect, text, line, icon } = require('./dsl');
const { family, makeStyle, flow, tick } = require('./_t4-lib');

function klassisch() {
  const st = makeStyle('klassisch', '#7a1f2b', { margin: 9 });
  const f = flow(st, 99, 210);
  const x = 9;
  const w = 81;
  f.add(text('Titel', x, 8, w, 10, 'Einkaufsliste', { f: st.head, s: 20, w: 700, c: st.ink, min: 12 }));
  f.add(line('Linie dick', x, 20, x + w, 20, st.ink, 1.4), line('Linie dünn', x, 21.4, x + w, 21.4, st.accent, 0.5));
  f.add(text('Datum Beschriftung', x, 23.2, 14, 4, 'Datum:', { f: st.lab, s: 8, i: true, c: st.grey, v: 'middle', min: 6 }), line('Datum Linie', x + 14, 27, x + 40, 27, '#9c9c9c', 0.35), text('Menge Kopf', x + w - 17, 23.2, 17, 4, 'Menge', { f: st.lab, s: 8, i: true, c: st.grey, a: 'center', v: 'middle', min: 6 }));
  const pitch = 8.1;
  for (let i = 0; i < 21; i++) {
    const y = 30 + i * pitch;
    f.add(tick(st, 'Kästchen ' + (i + 1), x, y + 1.6, 3.9), line('Zeile ' + (i + 1), x + 6, y + 6.2, x + w - 19, y + 6.2, '#9c9c9c', 0.35), line('Menge ' + (i + 1), x + w - 17, y + 6.2, x + w, y + 6.2, '#9c9c9c', 0.35));
  }
  return [page('#ffffff', f.els, 'Einkaufsliste')];
}

const GROUPS = [['Obst & Gemüse', 'apple'], ['Brot & Backwaren', 'croissant'], ['Milch & Käse', 'milk'], ['Fleisch & Fisch', 'beef'], ['Getränke', 'glass-water'], ['Haushalt & Drogerie', 'spray-can']];

function modern() {
  const st = makeStyle('modern', '#d97706', { margin: 10 });
  const f = flow(st, 148, 210);
  const x = 10;
  const w = 128;
  f.add(rect('Akzentbalken', x, 10, 20, 1.6, st.accent, { locked: true }), text('Titel', x, 13, 80, 10, 'Einkaufsliste', { f: st.head, s: 21, w: 700, c: st.ink, min: 12 }));
  f.add(text('Datum Beschriftung', x + w - 44, 14, 14, 4, 'Datum:', { f: st.lab, s: 8, w: 600, c: st.deep, a: 'right', v: 'middle', min: 6 }), line('Datum Linie', x + w - 29, 18.4, x + w, 18.4, st.accent, 0.5));
  f.add(line('Linie', x, 27, x + w, 27, st.hair, 0.6));
  const gap = 6;
  const cw = (w - gap) / 2;
  GROUPS.forEach(([name, ic], i) => {
    const c = i % 2;
    const r = Math.floor(i / 2);
    const gx = x + c * (cw + gap);
    const gy = 31 + r * 56;
    f.add(rect('Gruppenkopf ' + name, gx, gy, cw, 8, st.tint2, { radius: 1.5, locked: true }), icon('Symbol ' + name, ic, gx + 2, gy + 1.6, 4.8, st.deep, 2, { locked: true }), text('Gruppe ' + name, gx + 8.5, gy, cw - 10, 8, name, { f: st.head, s: 9, w: 700, c: st.deep, min: 6 }));
    for (let k = 0; k < 5; k++) {
      const ky = gy + 10.4 + k * 8.2;
      f.add(tick(st, 'Kästchen ' + name + (k + 1), gx, ky + 1, 4), line('Zeile ' + name + (k + 1), gx + 6.5, ky + 6.2, gx + cw, ky + 6.2, '#c4c4c4', 0.35));
    }
  });
  return [page('#ffffff', f.els, 'Einkaufsliste')];
}

function minimal() {
  const st = makeStyle('minimal', '#15803d', { margin: 8, font: 'mono' });
  const f = flow(st, 105, 148);
  const x = 8;
  const w = 89;
  f.add(text('Titel', x, 8, w, 7, 'Einkauf', { f: st.head, s: 13, w: 700, c: st.ink, up: true, ls: 0.06, min: 8 }), text('Datum', x, 8, w, 7, '__ . __ .', { f: st.lab, s: 8, c: st.mid, a: 'right', min: 6 }));
  f.add(line('Linie', x, 17, x + w, 17, st.ink, 0.5));
  for (let i = 0; i < 14; i++) {
    const y = 20 + i * 8.5;
    f.add(tick(st, 'Kreis ' + (i + 1), x, y + 1.6, 4), line('Zeile ' + (i + 1), x + 7, y + 6.4, x + w, y + 6.4, '#a8a8a8', 0.4));
  }
  return [page('#ffffff', f.els, 'Einkauf')];
}

void field;

module.exports = family({
  nameBase: 'Einkaufsliste',
  category: 'Planer',
  family: 'einkaufsliste',
  familyName: 'Einkaufsliste',
  occasion: 'Formulare & Planer',
  tags: ['Einkaufsliste', 'Einkaufszettel', 'Einkaufen', 'Supermarkt', 'Haushalt', 'Liste', 'Notizzettel', 'Lebensmittel'],
  formatKey: 'din-lang-portrait',
  width: 99,
  height: 210,
  fields: [],
  sampleRows: [],
}, [
  {
    slug: 'einkaufsliste-klassisch', variant: 'Klassisch',
    description: 'Einkaufszettel im Format DIN lang (99 × 210 mm, passt in die Tasche): 21 Zeilen mit Kästchen, Artikel und Menge, oben das Datum. Serifenüberschrift mit feiner Doppellinie.',
    tags: ['klassisch', 'Serifen', 'DIN lang'], pages: klassisch,
  },
  {
    slug: 'einkaufsliste-modern', variant: 'Modern',
    description: 'Einkaufsliste (A5): sechs Gruppen mit Symbolen – Obst und Gemüse, Brot, Milch und Käse, Fleisch und Fisch, Getränke, Haushalt – mit je fünf Zeilen zum Abhaken. Akzent in Bernstein.',
    tags: ['modern', 'Gruppen', 'Symbole', 'A5'], formatKey: 'a5-portrait', width: 148, height: 210, pages: modern,
  },
  {
    slug: 'einkaufsliste-minimal', variant: 'Minimal',
    description: 'Kleiner Einkaufszettel (A6 hoch): 14 Zeilen mit runden Kreisen zum Abhaken, Monospace-Schrift und viel Weißraum – zum Mitnehmen oder an den Kühlschrank.',
    tags: ['minimal', 'Mono', 'A6', 'klein'], formatKey: 'a6-portrait', width: 105, height: 148, pages: minimal,
  },
]);
