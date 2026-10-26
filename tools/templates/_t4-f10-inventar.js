'use strict';
const { field, page } = require('./dsl');
const { family, makeStyle, flow, tick } = require('./_t4-lib');

const nums = n => Array.from({ length: n }, (_, i) => [String(i + 1)]);
const WHO = [[['Bereich / Raum', 1.6, '{{Bereich}}'], ['Stand', 1, '{{Stand}}'], ['Geprüft von', 1.2]]];

function klassisch() {
  const st = makeStyle('klassisch', '#4a5d23');
  const f = flow(st, 210, 297);
  f.header('Inventarliste', { compact: true, org: '{{Organisation}}' });
  f.rows(WHO, { pitch: 15.5 });
  f.table({ cols: [0.45, 2.6, 0.7, 1.5, 1.1, 1], header: ['Nr.', 'Gegenstand', 'Anzahl', 'Standort', 'Zustand', 'Wert €'], headerHeight: 8, rows: 21, fixedRow: 10.1, cells: nums(21), align: ['center', 'left', 'center', 'left', 'left', 'right'], s: 9 });
  return [page('#ffffff', f.done('inventar klassisch'), 'Inventarliste')];
}

function modern() {
  const st = makeStyle('modern', '#2563eb');
  const f = flow(st, 297, 210);
  f.header('Inventarliste', { compact: true, org: '{{Organisation}}' });
  f.rows(WHO, { pitch: 17 });
  const t = f.table({ cols: [0.4, 2.8, 0.65, 1.6, 0.55, 0.55, 0.7, 1.2, 0.9], header: ['Nr.', 'Gegenstand', 'Anzahl', 'Standort', 'neu', 'gut', 'defekt', 'Anschaffung', 'Wert €'], headerHeight: 8, rows: 14, fixedRow: 9.3, cells: nums(14), align: ['center', 'left', 'center', 'left', 'center', 'center', 'center', 'left', 'right'], s: 9 });
  for (let r = 0; r < 14; r++) [4, 5, 6].forEach(c => { const b = t.cell(r, c); f.add(tick(st, 'Zustand ' + r + c, b.x + b.w / 2 - 2, b.y + b.h / 2 - 2, 4)); });
  return [page('#ffffff', f.done('inventar modern'), 'Inventarliste')];
}

function minimal() {
  const st = makeStyle('minimal', '#8b5e34', { font: 'mono' });
  const f = flow(st, 210, 297);
  f.header('Inventar', { subtitle: '{{Bereich}} · Stand {{Stand}}', org: '{{Organisation}}' });
  f.gap(1);
  f.table({ cols: [0.4, 2.8, 0.7, 1.6, 0.9], header: ['Nr', 'Gegenstand', 'Stk.', 'Standort', 'Wert €'], headerHeight: 8, rows: 19, fixedRow: 11, cells: nums(19), align: ['center', 'left', 'center', 'left', 'right'], s: 8.5 });
  return [page('#ffffff', f.done('inventar minimal'), 'Inventarliste')];
}

module.exports = family({
  nameBase: 'Inventarliste',
  category: 'Formulare',
  family: 'inventarliste',
  familyName: 'Inventarliste',
  occasion: 'Business',
  tags: ['Formular', 'Inventar', 'Inventarliste', 'Bestandsliste', 'Inventur', 'Lager', 'Gegenstände', 'Liste', 'Verein', 'A4'],
  formatKey: 'a4-portrait',
  width: 210,
  height: 297,
  fields: [field('Organisation', 'Organisation', 'text', 'Jugendtreff Südstadt'), field('Bereich', 'Bereich / Raum', 'text', 'Geräteraum'), field('Stand', 'Stand', 'text', 'Oktober 2026')],
  sampleRows: [
    { Organisation: 'Jugendtreff Südstadt', Bereich: 'Geräteraum', Stand: 'Oktober 2026' },
    { Organisation: 'Freiwillige Feuerwehr Musterstadt-Neuenhagen', Bereich: 'Lager im Keller, Regalreihe C bis F', Stand: '31. Dezember 2026' },
    { Organisation: '', Bereich: '', Stand: '' },
  ],
}, [
  {
    slug: 'inventarliste-klassisch', variant: 'Klassisch',
    description: 'Inventarliste (A4 hoch) mit 21 Zeilen für Gegenstand, Anzahl, Standort, Zustand und Wert. Organisation, Bereich und Stand sind Felder; ein klares Tabellenraster mit Serifenschrift.',
    tags: ['klassisch', 'Serifen', 'Tabelle'], pages: klassisch,
  },
  {
    slug: 'inventarliste-modern', variant: 'Modern',
    description: 'Inventarliste im Querformat (A4 quer): blaue Tabellenkopfzeile mit Streifen, Zustand zum Ankreuzen (neu, gut, defekt), Anschaffung und Wert. Organisation, Bereich und Stand sind Felder.',
    tags: ['modern', 'quer', 'Querformat', 'Kästchen'], formatKey: 'a4-landscape', width: 297, height: 210, pages: modern,
  },
  {
    slug: 'inventarliste-minimal', variant: 'Minimal',
    description: 'Reduzierte Inventarliste (A4 hoch): Monospace-Schrift, nur Querlinien und 19 großzügige Zeilen. Organisation, Bereich und Stand sind Felder.',
    tags: ['minimal', 'Mono', 'schlicht'], pages: minimal,
  },
]);
