'use strict';
const { field, page, rect, text, line, icon, ruled } = require('./dsl');
const { family, makeStyle, flow } = require('./_t4-lib');

const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const MEALS = [['Frühstück', 'coffee'], ['Mittagessen', 'utensils'], ['Abendessen', 'soup']];

function klassisch() {
  const st = makeStyle('klassisch', '#7f1d1d');
  const f = flow(st, 210, 297);
  f.header('Essensplan', { compact: true });
  f.rows([[['Woche', 1.3, '{{Woche}}'], ['Wer isst mit?', 1.6]]], { pitch: 15 });
  f.table({ cols: [1.15, 2, 2, 2], header: ['', 'Frühstück', 'Mittagessen', 'Abendessen'], headerHeight: 8, rows: 7, fixedRow: 24.5, cells: DAYS.map(d => [d]), s: 9.5, align: ['left', 'center', 'center', 'center'] });
  f.area('Einkaufsnotizen', 3, { pitch: 8.4 });
  return [page('#ffffff', f.done('essen klassisch'), 'Essensplan')];
}

function modern() {
  const st = makeStyle('modern', '#16a34a');
  const f = flow(st, 297, 210);
  f.header('Essensplan', { compact: true, org: '{{Woche}}', orgW: 100 });
  const lw = 34;
  const dw = (f.w - lw) / 7;
  const y0 = f.y;
  f.add(rect('Kopf', f.x, y0, f.w, 8, st.accent, { radius: 1.5, locked: true }));
  DAYS.forEach((d, i) => f.add(text('Tag ' + d, f.x + lw + i * dw, y0, dw, 8, d, { f: st.head, s: 9.5, w: 700, c: '#ffffff', a: 'center', min: 6 })));
  const rh = 34;
  MEALS.forEach(([m, ic], r) => {
    const y = y0 + 8 + r * rh;
    f.add(rect('Mahlzeit ' + m, f.x, y, lw, rh, st.tint, { locked: true }), icon('Symbol ' + m, ic, f.x + lw / 2 - 4, y + rh / 2 - 8, 8, st.deep, 2, { locked: true }), text('Mahlzeit Text ' + m, f.x, y + rh / 2 + 1.5, lw, 6, m, { f: st.head, s: 9, w: 700, c: st.deep, a: 'center', min: 6 }));
    f.add(line('Zeilenlinie ' + m, f.x, y + rh, f.x + f.w, y + rh, '#cfd6dd', 0.4));
  });
  for (let c = 1; c < 7; c++) f.add(line('Spaltenlinie ' + c, f.x + lw + c * dw, y0 + 8, f.x + lw + c * dw, y0 + 8 + 3 * rh, '#cfd6dd', 0.4));
  f.add(rect('Rahmen', f.x, y0 + 8, f.w, 3 * rh, null, { stroke: '#cfd6dd', sw: 0.5 }));
  const y1 = y0 + 8 + 3 * rh + 4;
  f.add(rect('Einkaufskasten', f.x, y1, f.w, 36, '#ffffff', { stroke: st.accent, sw: 0.8, radius: 2 }), text('Einkaufskasten Titel', f.x + 3, y1 + 1.5, 80, 5, 'Das muss auf die Einkaufsliste', { f: st.head, s: 9.5, w: 700, c: st.deep, v: 'top', min: 6 }));
  f.add(ruled('Einkauf Zeile', f.x + 3, y1 + 15, f.w - 6, 3, 8.2, { color: '#c4c4c4', sw: 0.35 }));
  f.y = y1 + 37;
  return [page('#ffffff', f.done('essen modern'), 'Essensplan')];
}

function minimal() {
  const st = makeStyle('minimal', '#a16207', { font: 'light' });
  const f = flow(st, 210, 297);
  f.header('Essensplan', { compact: true });
  f.rows([[['Woche', 1.3, '{{Woche}}'], ['Wer isst mit?', 1.6]]], { gap: 8, pitch: 14.5 });
  const bh = 28.5;
  DAYS.forEach((d, i) => {
    const y = f.y + 2 + i * bh;
    f.add(line('Tagestrenner ' + d, f.x, y, f.x + f.w, y, i === 0 ? st.ink : '#c4c4c4', i === 0 ? 0.6 : 0.4));
    f.add(text('Tag ' + d, f.x, y + 2, 28, 6, d.slice(0, 2), { f: st.head, s: 15, w: 300, c: i > 4 ? st.accent : st.ink, v: 'top', up: true, ls: 0.05, min: 9 }));
    f.add(text('Tag lang ' + d, f.x, y + 10.5, 28, 4, d, { f: st.lab, s: 8, c: st.mid, v: 'top', min: 6 }));
    MEALS.forEach(([m], k) => {
      const ly = y + 8.4 + k * 6.6;
      f.add(text('Mahlzeit ' + d + ' ' + m, f.x + 32, ly - 4.6, 24, 4.4, m, { f: st.lab, s: 8, c: st.mid, v: 'middle', min: 6 }), line('Zeile ' + d + ' ' + m, f.x + 56, ly, f.x + f.w, ly, '#b5b5b5', 0.4));
    });
  });
  f.add(line('Tagestrenner Ende', f.x, f.y + 2 + 7 * bh, f.x + f.w, f.y + 2 + 7 * bh, st.ink, 0.6));
  f.y += 2 + 7 * bh + 2;
  return [page('#ffffff', f.done('essen minimal'), 'Essensplan')];
}

module.exports = family({
  nameBase: 'Essensplan',
  category: 'Planer',
  family: 'essensplan',
  familyName: 'Essensplan',
  occasion: 'Formulare & Planer',
  tags: ['Planer', 'Essensplan', 'Speiseplan', 'Wochenplan', 'Mahlzeiten', 'Kochen', 'Meal Prep', 'Menüplan', 'Familie', 'Küche'],
  formatKey: 'a4-portrait',
  width: 210,
  height: 297,
  fields: [field('Woche', 'Woche', 'text', 'KW 44 · 26. Oktober – 1. November 2026')],
  sampleRows: [{ Woche: 'KW 44 · 26. Oktober – 1. November 2026' }, { Woche: 'KW 45 · 2. – 8. November 2026' }, { Woche: '' }],
}, [
  {
    slug: 'essensplan-klassisch', variant: 'Klassisch',
    description: 'Essensplan für die Woche (A4 hoch): Tabelle mit sieben Tagen und Frühstück, Mittagessen, Abendessen, darunter Platz für Einkaufsnotizen. Die Woche ist ein Feld; Serifenüberschrift.',
    tags: ['klassisch', 'Serifen', 'Tabelle'], pages: klassisch,
  },
  {
    slug: 'essensplan-modern', variant: 'Modern',
    description: 'Essensplan (A4 quer): sieben Tagesspalten, drei Mahlzeiten mit Symbolen und ein Kasten für die Einkaufsliste. Die Woche ist ein Feld; grüner Akzent.',
    tags: ['modern', 'quer', 'Querformat', 'Symbole'], formatKey: 'a4-landscape', width: 297, height: 210, pages: modern,
  },
  {
    slug: 'essensplan-minimal', variant: 'Minimal',
    description: 'Essensplan (A4 hoch): jeder Tag ein großzügiger Streifen mit drei Schreiblinien für Frühstück, Mittag und Abend, helle Linienschrift. Die Woche ist ein Feld.',
    tags: ['minimal', 'hell', 'schlicht'], pages: minimal,
  },
]);
