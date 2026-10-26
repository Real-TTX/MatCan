'use strict';
const { field, page } = require('./dsl');
const { family, makeStyle, flow } = require('./_t4-lib');

const W = 210;
const H = 297;
const COLS = { cols: [0.55, 1.3, 3.9, 0.9, 1.4, 1.5], header: ['Pos.', 'Art.-Nr.', 'Bezeichnung', 'Menge', 'Einzelpreis €', 'Gesamt €'], align: ['center', 'left', 'left', 'center', 'right', 'right'] };
const PAY = ['Rechnung', 'Vorkasse', 'Nachnahme', 'Lastschrift'];

function numbered(n) {
  return Array.from({ length: n }, (_, i) => [String(i + 1)]);
}

function klassisch() {
  const st = makeStyle('klassisch', '#1f3a5f');
  const f = flow(st, W, H);
  f.header('Bestellschein', { subtitle: 'Bitte vollständig ausfüllen und an uns zurücksenden', org: '{{Firma}}' });
  f.section('Besteller');
  f.rows([[['Name / Firma', 1.7], ['Kundennummer', 1]], [['Straße und Hausnummer', 2.2], ['PLZ', 0.7], ['Ort', 1.5]], [['Telefon', 1], ['E-Mail-Adresse', 1.4]]]);
  f.section('Lieferadresse (falls abweichend)');
  f.rows([[['Name, Straße, PLZ und Ort', 1]]]);
  f.gap(1);
  f.table(Object.assign({ rows: 8, fixedRow: 8.6, cells: numbered(8) }, COLS));
  f.gap(1);
  f.totals(['Zwischensumme', 'zzgl. MwSt.', 'Gesamtbetrag']);
  f.checks(PAY, { label: 'Zahlungsart', cols: 4, byRow: true, pitch: 7 });
  f.sign(['Ort, Datum', 'Unterschrift'], { drop: 7 });
  f.footer('{{Firma}} · Alle Preise in Euro', 'Seite 1 von 1');
  return [page('#ffffff', f.done('bestell klassisch'), 'Bestellschein')];
}

function modern() {
  const st = makeStyle('modern', '#0e7c86');
  const f = flow(st, W, H);
  f.header('Bestellung', { subtitle: 'Bestellschein – einfach ausfüllen und zurücksenden', org: '{{Firma}}' });
  const gapC = 8;
  const cw = (f.w - gapC) / 2;
  f.cols([cw, cw], gapC, (i, s) => {
    if (i === 0) {
      s.section('Besteller', 1);
      s.rows([[['Name / Firma', 1]], [['Straße und Hausnummer', 1]], [['PLZ', 0.8], ['Ort', 1.5]]]);
    } else {
      s.section('Lieferadresse', 2);
      s.rows([[['Kundennummer', 1], ['Telefon', 1]], [['Name, Straße (falls abweichend)', 1]], [['PLZ', 0.8], ['Ort', 1.5]]]);
    }
  });
  f.gap(1);
  f.section('Bestellte Artikel', 3);
  f.table(Object.assign({ rows: 8, fixedRow: 8.8, cells: numbered(8), s: 9 }, COLS));
  f.gap(1);
  f.cols([88, 84], 10, (i, s) => {
    if (i === 0) {
      s.checks(PAY, { label: 'Zahlungsart', cols: 2, byRow: true, pitch: 7 });
      s.gap(2);
      s.rows([[['E-Mail für die Rechnung', 1]]]);
    } else {
      s.totals(['Zwischensumme', 'zzgl. MwSt.', 'Gesamtbetrag'], { w: 84, x: s.x });
    }
  });
  f.sign(['Ort, Datum', 'Unterschrift'], { drop: 5 });
  f.footer('{{Firma}} · Alle Preise in Euro', 'Seite 1 von 1');
  return [page('#ffffff', f.done('bestell modern'), 'Bestellschein')];
}

function minimal() {
  const st = makeStyle('minimal', '#b4412b', { font: 'mono' });
  const f = flow(st, W, H);
  f.header('Bestellschein', { subtitle: 'Bitte ausfüllen und zurücksenden', org: '{{Firma}}' });
  f.section('Besteller', 1);
  f.rows([[['Name / Firma', 1.7], ['Kundennr.', 1]], [['Straße, Hausnummer', 2.2], ['PLZ', 0.8], ['Ort', 1.5]], [['Telefon', 1], ['E-Mail', 1.4]]], { gap: 8 });
  f.section('Lieferung (falls abweichend)', 2);
  f.rows([[['Name, Straße, PLZ, Ort', 1]]], { gap: 8 });
  f.gap(1);
  f.section('Artikel', 3);
  f.table(Object.assign({ rows: 8, fixedRow: 8.6, cells: numbered(8), s: 8.5 }, COLS, { header: ['Pos', 'Art.-Nr.', 'Bezeichnung', 'Menge', 'Einzelpreis', 'Gesamt'] }));
  f.gap(1);
  f.totals(['Zwischensumme', 'zzgl. MwSt.', 'Gesamt'], { pitch: 8.2 });
  f.checks(PAY, { label: 'Zahlung', cols: 4, byRow: true, pitch: 7 });
  f.sign(['Ort, Datum', 'Unterschrift'], { drop: 7 });
  f.footer('{{Firma}}', '1/1');
  return [page('#ffffff', f.done('bestell minimal'), 'Bestellschein')];
}

module.exports = family({
  nameBase: 'Bestellschein',
  category: 'Formulare',
  family: 'bestellschein',
  familyName: 'Bestellschein',
  occasion: 'Business',
  tags: ['Formular', 'Bestellung', 'Bestellschein', 'Bestellformular', 'Auftrag', 'Artikel', 'Rechnung', 'Lieferadresse', 'A4'],
  formatKey: 'a4-portrait',
  width: 210,
  height: 297,
  fields: [field('Firma', 'Firma', 'text', 'Gartenbedarf Müller GmbH')],
  sampleRows: [{ Firma: 'Gartenbedarf Müller GmbH' }, { Firma: 'Hofladen Sonnenschein · Familie Schneider-Hohenstein' }, { Firma: 'KM' }],
}, [
  {
    slug: 'bestellschein-klassisch', variant: 'Klassisch',
    description: 'Bestellschein (A4) mit Besteller, Lieferadresse, Artikeltabelle mit acht Positionen, Summenlinien und Zahlungsart. Serifenschrift, feine Linien. Der Firmenname ist ein Feld, oben links ist Platz fürs Logo.',
    tags: ['klassisch', 'Serifen', 'Linien'], pages: klassisch,
  },
  {
    slug: 'bestellschein-modern', variant: 'Modern',
    description: 'Moderner Bestellschein (A4): Besteller und Lieferadresse nebeneinander in Kästchen, Artikeltabelle mit türkiser Kopfzeile und Streifen, Summenfelder. Firmenname als Feld, Platz fürs Logo.',
    tags: ['modern', 'Kästchen', 'Tabelle'], pages: modern,
  },
  {
    slug: 'bestellschein-minimal', variant: 'Minimal',
    description: 'Reduzierter Bestellschein (A4): Monospace-Schrift, Artikeltabelle nur mit Querlinien, runde Auswahlkreise, viel Weißraum. Der Firmenname ist ein Feld, Platz fürs Logo.',
    tags: ['minimal', 'Mono', 'schlicht'], pages: minimal,
  },
]);
