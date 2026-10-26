'use strict';
const { field, page } = require('./dsl');
const { family, makeStyle, flow } = require('./_t4-lib');

const days = (from, to, extra) => [...Array.from({ length: to - from + 1 }, (_, i) => [String(from + i)]), ...(extra ? [[extra]] : [])];
const HEAD = ['Tag', 'Beginn', 'Ende', 'Pause', 'Stunden', 'Tätigkeit / Projekt'];
const WHO = [['Name', 1.6, '{{Name}}'], ['Monat', 1, '{{Monat}}'], ['Abteilung', 1.2, '{{Abteilung}}']];

function klassisch() {
  const st = makeStyle('klassisch', '#25473f');
  const f = flow(st, 210, 297);
  f.header('Stundenzettel', { compact: true });
  f.rows([WHO], { pitch: 15 });
  f.table({ cols: [0.9, 1, 1, 1, 1, 4], header: HEAD, headerHeight: 7, rows: 32, fixedRow: 6.25, cells: days(1, 31, 'Summe'), align: ['center', 'center', 'center', 'center', 'center', 'left'], s: 8.5 });
  f.sign(['Mitarbeiter(in): Datum, Unterschrift', 'Vorgesetzte(r): Datum, Unterschrift'], { drop: 8 });
  return [page('#ffffff', f.done('stunden klassisch'), 'Stundenzettel')];
}

function modern() {
  const st = makeStyle('modern', '#6a4bc4');
  const f = flow(st, 210, 297);
  f.header('Stundenzettel', { compact: true });
  f.rows([WHO], { pitch: 17.5 });
  f.table({ cols: [0.9, 1, 1, 1, 1, 4], header: HEAD, headerHeight: 7, rows: 31, fixedRow: 6.2, cells: days(1, 31), align: ['center', 'center', 'center', 'center', 'center', 'left'], s: 8.5 });
  f.rows([[['Soll-Stunden', 1], ['Ist-Stunden', 1], ['Überstunden / Minusstunden', 1.3]]], { pitch: 17 });
  f.sign(['Mitarbeiter(in): Datum, Unterschrift', 'Vorgesetzte(r): Datum, Unterschrift'], { drop: 5 });
  return [page('#ffffff', f.done('stunden modern'), 'Stundenzettel')];
}

function minimal() {
  const st = makeStyle('minimal', '#c05621', { font: 'light' });
  const f = flow(st, 297, 210);
  f.header('Stundenzettel', { compact: true });
  f.rows([[['Name', 1.6, '{{Name}}'], ['Monat', 1, '{{Monat}}'], ['Abteilung', 1.2, '{{Abteilung}}']]], { gap: 10, pitch: 14.5 });
  f.gap(2);
  const cw = (f.w - 12) / 2;
  const base = { cols: [0.8, 1, 1, 1, 1, 2.2], header: ['Tag', 'Beginn', 'Ende', 'Pause', 'Std.', 'Notiz'], headerHeight: 7, rows: 16, fixedRow: 7.3, align: ['center', 'center', 'center', 'center', 'center', 'left'], s: 8.5 };
  f.cols([cw, cw], 12, (i, s) => s.table(Object.assign({}, base, { cells: i === 0 ? days(1, 16) : days(17, 31, 'Summe') })));
  f.sign(['Mitarbeiter(in): Datum, Unterschrift', 'Vorgesetzte(r): Datum, Unterschrift'], { drop: 8 });
  return [page('#ffffff', f.done('stunden minimal'), 'Stundenzettel')];
}

module.exports = family({
  nameBase: 'Stundenzettel',
  category: 'Formulare',
  family: 'stundenzettel',
  familyName: 'Stundenzettel',
  occasion: 'Business',
  tags: ['Formular', 'Stundenzettel', 'Arbeitszeit', 'Zeiterfassung', 'Monat', 'Minijob', 'Aushilfe', 'Stunden', 'Arbeitsnachweis'],
  formatKey: 'a4-portrait',
  width: 210,
  height: 297,
  fields: [field('Name', 'Name', 'text', 'Mia Hartmann'), field('Monat', 'Monat', 'text', 'November 2026'), field('Abteilung', 'Abteilung', 'text', 'Service')],
  sampleRows: [
    { Name: 'Mia Hartmann', Monat: 'November 2026', Abteilung: 'Service' },
    { Name: 'Maximilian Schneider-Hohenstein', Monat: 'Dezember 2026', Abteilung: 'Lager und Versand' },
    { Name: 'Jo Li', Monat: 'Januar 2027', Abteilung: '' },
  ],
}, [
  {
    slug: 'stundenzettel-klassisch', variant: 'Klassisch',
    description: 'Stundenzettel für einen Monat (A4 hoch): 31 Tage mit Beginn, Ende, Pause, Stunden und Tätigkeit, Summenzeile und zwei Unterschriften. Name, Monat und Abteilung sind Felder für eine Serie.',
    tags: ['klassisch', 'Serifen', 'Tabelle'], pages: klassisch,
  },
  {
    slug: 'stundenzettel-modern', variant: 'Modern',
    description: 'Moderner Stundenzettel (A4 hoch): violette Tabellenkopfzeile mit Streifen, darunter Felder für Soll, Ist und Überstunden. Name, Monat und Abteilung sind Felder für eine Serie.',
    tags: ['modern', 'Kästchen', 'Tabelle'], pages: modern,
  },
  {
    slug: 'stundenzettel-minimal', variant: 'Minimal',
    description: 'Reduzierter Stundenzettel (A4 quer): der Monat in zwei Blöcken nebeneinander mit großzügigen Zeilen zum Schreiben, nur Querlinien. Name, Monat und Abteilung sind Felder für eine Serie.',
    tags: ['minimal', 'quer', 'Querformat'], formatKey: 'a4-landscape', width: 297, height: 210, pages: minimal,
  },
]);
