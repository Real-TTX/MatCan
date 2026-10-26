'use strict';
const { field, page, rect, text, line } = require('./dsl');
const { family, makeStyle, flow } = require('./_t4-lib');

const dates = n => Array.from({ length: n }, () => ['']);

function klassisch() {
  const st = makeStyle('klassisch', '#355c3a');
  const f = flow(st, 210, 297);
  f.header('Haushaltsbuch', { compact: true });
  f.rows([[['Monat', 1.3, '{{Monat}}'], ['Anfangsbestand (€)', 1], ['Budget für den Monat (€)', 1]]], { pitch: 15 });
  f.table({ cols: [0.9, 3, 1.7, 1.15, 1.15], header: ['Datum', 'Beschreibung', 'Kategorie', 'Einnahme €', 'Ausgabe €'], headerHeight: 8, rows: 22, fixedRow: 8.2, cells: dates(22), align: ['left', 'left', 'left', 'right', 'right'], s: 9 });
  f.totals(['Summe Einnahmen', 'Summe Ausgaben', 'Saldo'], { w: 100, pitch: 8.4 });
  return [page('#ffffff', f.done('haushalt klassisch'), 'Haushaltsbuch')];
}

function modern() {
  const st = makeStyle('modern', '#0f9d6e');
  const f = flow(st, 210, 297);
  f.header('Haushaltsbuch', { compact: true, org: '{{Monat}}', orgW: 80 });
  const gap = 5;
  const kw = (f.w - 2 * gap) / 3;
  [['Einnahmen', st.tint], ['Ausgaben', st.tint], ['Übrig', st.tint2]].forEach(([l, fill], i) => {
    const x = f.x + i * (kw + gap);
    f.add(rect('Kennzahl ' + l, x, f.y, kw, 19, fill, { radius: 2, locked: true }), text('Kennzahl Etikett ' + l, x + 3, f.y + 1.5, kw - 6, 4, l, { f: st.lab, s: 8, w: 700, c: st.deep, up: true, ls: 0.08, v: 'top', min: 6 }), line('Kennzahl Linie ' + l, x + 3, f.y + 15.5, x + kw - 12, f.y + 15.5, st.accent, 0.6), text('Kennzahl Euro ' + l, x + kw - 11, f.y + 8.5, 8, 7.4, '€', { f: st.head, s: 13, w: 700, c: st.deep, a: 'right', min: 8 }));
  });
  f.y += 22;
  f.section('Einnahmen', 1);
  f.table({ cols: [0.9, 3.2, 1.2], header: ['Datum', 'Quelle', 'Betrag €'], headerHeight: 8, rows: 4, fixedRow: 8.2, cells: dates(4), align: ['left', 'left', 'right'], s: 9 });
  f.section('Ausgaben', 2);
  f.table({ cols: [0.9, 2.6, 1.6, 1.2], header: ['Datum', 'Beschreibung', 'Kategorie', 'Betrag €'], headerHeight: 8, rows: 18, fixedRow: 8.2, cells: dates(18), align: ['left', 'left', 'left', 'right'], s: 9 });
  return [page('#ffffff', f.done('haushalt modern'), 'Haushaltsbuch')];
}

function minimal() {
  const st = makeStyle('minimal', '#4d7c0f', { font: 'mono', margin: 15 });
  const f = flow(st, 297, 210);
  f.header('Haushaltsbuch', { compact: true });
  f.rows([[['Monat', 1.3, '{{Monat}}'], ['Anfangsbestand (€)', 1], ['Saldo am Monatsende (€)', 1]]], { gap: 10, pitch: 14.5 });
  const gap = 12;
  const cwA = 100;
  const cwB = f.w - gap - cwA;
  f.cols([cwA, cwB], gap, (i, s) => {
    if (i === 0) s.table({ cols: [0.9, 2.4, 1.2], header: ['Datum', 'Einnahmen', '€'], headerHeight: 7, rows: 17, fixedRow: 8, cells: [...dates(16), ['', 'Summe', '']], align: ['left', 'left', 'right'], s: 8.5 });
    else s.table({ cols: [0.8, 2.4, 1.5, 1], header: ['Datum', 'Ausgaben', 'Kategorie', '€'], headerHeight: 7, rows: 17, fixedRow: 8, cells: [...dates(16), ['', 'Summe', '', '']], align: ['left', 'left', 'left', 'right'], s: 8.5 });
  });
  return [page('#ffffff', f.done('haushalt minimal'), 'Haushaltsbuch')];
}

module.exports = family({
  nameBase: 'Haushaltsbuch',
  category: 'Planer',
  family: 'haushaltsbuch',
  familyName: 'Haushaltsbuch',
  occasion: 'Formulare & Planer',
  tags: ['Haushaltsbuch', 'Budget', 'Finanzen', 'Ausgaben', 'Einnahmen', 'Monat', 'Sparen', 'Kassenbuch', 'Planer', 'Geld'],
  formatKey: 'a4-portrait',
  width: 210,
  height: 297,
  fields: [field('Monat', 'Monat', 'text', 'November 2026')],
  sampleRows: [{ Monat: 'November 2026' }, { Monat: 'Dezember 2026' }, { Monat: 'Januar 2027' }, { Monat: '' }],
}, [
  {
    slug: 'haushaltsbuch-klassisch', variant: 'Klassisch',
    description: 'Haushaltsbuch-Seite für einen Monat (A4 hoch): 22 Zeilen mit Datum, Beschreibung, Kategorie, Einnahme und Ausgabe, darunter Summen und Saldo. Der Monat ist ein Feld; Serifenüberschrift.',
    tags: ['klassisch', 'Serifen', 'Tabelle'], pages: klassisch,
  },
  {
    slug: 'haushaltsbuch-modern', variant: 'Modern',
    description: 'Haushaltsbuch-Seite (A4 hoch): drei Kennzahlenkarten für Einnahmen, Ausgaben und Übriges, darunter getrennte Tabellen für Einnahmen und Ausgaben. Der Monat ist ein Feld; grüner Akzent.',
    tags: ['modern', 'Karten', 'Tabelle'], pages: modern,
  },
  {
    slug: 'haushaltsbuch-minimal', variant: 'Minimal',
    description: 'Haushaltsbuch-Seite im Querformat (A4 quer): Einnahmen links, Ausgaben rechts, je 14 Zeilen mit Summenzeile, Monospace und nur feine Linien. Der Monat ist ein Feld.',
    tags: ['minimal', 'quer', 'Querformat', 'Mono'], formatKey: 'a4-landscape', width: 297, height: 210, pages: minimal,
  },
]);
