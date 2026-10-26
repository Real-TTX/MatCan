'use strict';
const { field, page } = require('./dsl');
const { family, makeStyle, flow, tick } = require('./_t4-lib');

const nums = n => Array.from({ length: n }, (_, i) => [String(i + 1)]);
const WHO = [[['Veranstaltung', 2.4, '{{Veranstaltung}}'], ['Datum', 1, '{{Datum}}'], ['Ort', 1.2, '{{Ort}}']]];

function klassisch() {
  const st = makeStyle('klassisch', '#34495e');
  const f = flow(st, 210, 297);
  f.header('Teilnehmerliste', { compact: true, org: '{{Veranstalter}}' });
  f.rows(WHO, { pitch: 15.5 });
  f.table({ cols: [0.45, 2.5, 2.2, 2.4, 2.4], header: ['Nr.', 'Name, Vorname', 'Verein / Firma', 'E-Mail', 'Unterschrift'], headerHeight: 8, rows: 20, fixedRow: 10.3, cells: nums(20), align: ['center', 'left', 'left', 'left', 'left'], s: 9 });
  return [page('#ffffff', f.done('teilnehmer klassisch'), 'Teilnehmerliste')];
}

function modern() {
  const st = makeStyle('modern', '#d97706');
  const f = flow(st, 297, 210);
  f.header('Teilnehmerliste', { compact: true, org: '{{Veranstalter}}' });
  f.rows(WHO, { pitch: 17 });
  const t = f.table({ cols: [0.45, 2.6, 2.2, 1.7, 2.4, 0.85, 2.3], header: ['Nr.', 'Name, Vorname', 'Verein / Firma', 'Telefon', 'E-Mail', 'anwesend', 'Unterschrift'], headerHeight: 8, rows: 14, fixedRow: 9.3, cells: nums(14), align: ['center', 'left', 'left', 'left', 'left', 'center', 'left'], s: 9 });
  for (let r = 0; r < 14; r++) { const b = t.cell(r, 5); f.add(tick(st, 'anwesend ' + (r + 1), b.x + b.w / 2 - 2.1, b.y + b.h / 2 - 2.1, 4.2)); }
  return [page('#ffffff', f.done('teilnehmer modern'), 'Teilnehmerliste')];
}

function minimal() {
  const st = makeStyle('minimal', '#7c3a55', { font: 'mono' });
  const f = flow(st, 210, 297);
  f.header('Teilnehmerliste', { subtitle: '{{Veranstaltung}}', org: '{{Veranstalter}}' });
  f.rows([[['Datum', 1, '{{Datum}}'], ['Ort', 1.6, '{{Ort}}']]], { gap: 8, pitch: 14.5 });
  f.gap(1);
  f.table({ cols: [0.4, 2.6, 2.6, 2.2], header: ['Nr', 'Name', 'Kontakt', 'Unterschrift'], headerHeight: 8, rows: 17, fixedRow: 10.8, cells: nums(17), align: ['center', 'left', 'left', 'left'], s: 8.5 });
  return [page('#ffffff', f.done('teilnehmer minimal'), 'Teilnehmerliste')];
}

module.exports = family({
  nameBase: 'Teilnehmerliste',
  category: 'Formulare',
  family: 'teilnehmerliste',
  familyName: 'Teilnehmerliste',
  occasion: 'Verein & Schule',
  tags: ['Formular', 'Teilnehmerliste', 'Anwesenheitsliste', 'Unterschriftenliste', 'Anwesenheit', 'Veranstaltung', 'Kurs', 'Liste', 'A4'],
  formatKey: 'a4-portrait',
  width: 210,
  height: 297,
  fields: [field('Veranstalter', 'Veranstalter', 'text', 'Turnverein 1888'), field('Veranstaltung', 'Veranstaltung', 'text', 'Jahreshauptversammlung'), field('Datum', 'Datum', 'text', '14. März 2027'), field('Ort', 'Ort', 'text', 'Vereinsheim')],
  sampleRows: [
    { Veranstalter: 'Turnverein 1888', Veranstaltung: 'Jahreshauptversammlung', Datum: '14. März 2027', Ort: 'Vereinsheim' },
    { Veranstalter: 'Volkshochschule Musterstadt', Veranstaltung: 'Erste-Hilfe-Kurs für Eltern und Großeltern, Teil 2', Datum: '9. und 16. Mai 2027', Ort: 'Gemeindezentrum St. Michael, Raum 3' },
    { Veranstalter: '', Veranstaltung: 'Elternabend', Datum: '', Ort: '' },
  ],
}, [
  {
    slug: 'teilnehmerliste-klassisch', variant: 'Klassisch',
    description: 'Teilnehmerliste (A4 hoch) mit 20 Zeilen für Name, Verein oder Firma, E-Mail und Unterschrift. Veranstaltung, Datum, Ort und Veranstalter sind Felder; serifenbetont mit klarem Tabellenraster.',
    tags: ['klassisch', 'Serifen', 'Tabelle'], pages: klassisch,
  },
  {
    slug: 'teilnehmerliste-modern', variant: 'Modern',
    description: 'Teilnehmerliste im Querformat (A4 quer): orange Tabellenkopf, Streifen, Spalte „anwesend“ zum Abhaken, Telefon und Unterschrift. Veranstaltung, Datum und Ort sind Felder.',
    tags: ['modern', 'quer', 'Querformat', 'Kästchen'], formatKey: 'a4-landscape', width: 297, height: 210, pages: modern,
  },
  {
    slug: 'teilnehmerliste-minimal', variant: 'Minimal',
    description: 'Reduzierte Teilnehmerliste (A4 hoch): Monospace-Schrift, nur Querlinien, großzügige Zeilen zum Schreiben. Veranstaltung, Datum, Ort und Veranstalter sind Felder.',
    tags: ['minimal', 'Mono', 'schlicht'], pages: minimal,
  },
]);
