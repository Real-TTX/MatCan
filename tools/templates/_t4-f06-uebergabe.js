'use strict';
const { field, page, line, text } = require('./dsl');
const { family, makeStyle, flow, tick } = require('./_t4-lib');

const W = 210;
const H = 297;
const METERS = [['Strom', '', '', 'kWh'], ['Gas', '', '', 'm³'], ['Kaltwasser', '', '', 'm³'], ['Warmwasser', '', '', 'm³']];
const ROOMS = ['Flur / Diele', 'Wohnzimmer', 'Schlafzimmer', 'Küche', 'Bad / WC', 'Balkon / Keller'];
const KEYS = [[['Haustür', 1], ['Wohnung', 1], ['Keller', 1], ['Briefkasten', 1]]];

function klassisch() {
  const st = makeStyle('klassisch', '#6b4b2a');
  const f = flow(st, W, H);
  f.header('Übergabeprotokoll', { subtitle: 'Wohnungsübergabe', org: '{{Objekt}}' });
  f.section('Beteiligte');
  f.rows([[['Übergeber(in) – Vermieter oder Vormieter', 1], ['Übernehmer(in) – Mieter', 1]], [['Datum der Übergabe', 1], ['Uhrzeit', 0.6], ['Weitere Anwesende', 1.5]]]);
  f.gap(1);
  f.section('Zählerstände');
  f.table({ cols: [1.6, 1.8, 1.4, 0.8], header: ['Zähler', 'Zählernummer', 'Stand', 'Einheit'], rows: 4, fixedRow: 8, cells: METERS, align: ['left', 'left', 'left', 'center'] });
  f.gap(1);
  f.section('Schlüssel (Anzahl)');
  f.rows(KEYS, { gap: 6 });
  f.section('Zustand der Räume');
  f.table({ cols: [1.4, 4], header: ['Raum', 'Zustand und Mängel'], rows: 6, fixedRow: 10, cells: ROOMS.map(r => [r]) });
  f.sign(['Übergeber(in): Datum, Unterschrift', 'Übernehmer(in): Datum, Unterschrift'], { drop: 7 });
  f.footer('{{Objekt}}', 'Seite 1 von 1');
  return [page('#ffffff', f.done('uebergabe klassisch'), 'Übergabeprotokoll')];
}

function modern() {
  const st = makeStyle('modern', '#d1495b');
  const f = flow(st, W, H);
  f.header('Wohnungsübergabe', { subtitle: 'Übergabeprotokoll', org: '{{Objekt}}' });
  f.section('Beteiligte', 1);
  f.rows([[['Übergeber(in)', 1], ['Übernehmer(in)', 1]], [['Datum', 0.8], ['Uhrzeit', 0.6], ['Weitere Anwesende', 1.6]]]);
  f.gap(1);
  const gapC = 8;
  const cw = (f.w - gapC) / 2;
  f.cols([cw, cw], gapC, (i, s) => {
    if (i === 0) {
      s.section('Zählerstände', 2);
      s.table({ cols: [1.5, 1.4, 0.7], header: ['Zähler', 'Stand', 'Einheit'], rows: 4, fixedRow: 8.6, cells: [['Strom', '', 'kWh'], ['Gas', '', 'm³'], ['Kaltwasser', '', 'm³'], ['Warmwasser', '', 'm³']], align: ['left', 'left', 'center'] });
    } else {
      s.section('Schlüssel (Anzahl)', 3);
      s.rows([[['Haustür', 1], ['Wohnung', 1]], [['Keller', 1], ['Briefkasten', 1]]]);
    }
  });
  f.gap(1);
  f.section('Räume', 4);
  const t = f.table({ cols: [1.5, 0.9, 0.9, 3.2], header: ['Raum', 'in Ordnung', 'Mängel', 'Bemerkung'], rows: 6, fixedRow: 9.4, cells: ROOMS.map(r => [r]), align: ['left', 'center', 'center', 'left'] });
  ROOMS.forEach((r, i) => {
    [1, 2].forEach(c => {
      const b = t.cell(i, c);
      f.add(tick(st, r + (c === 1 ? ' in Ordnung' : ' Mängel'), b.x + b.w / 2 - 2.1, b.y + b.h / 2 - 2.1, 4.2));
    });
  });
  f.sign(['Übergeber(in): Datum, Unterschrift', 'Übernehmer(in): Datum, Unterschrift'], { drop: 6 });
  f.footer('{{Objekt}}', 'Seite 1 von 1');
  return [page('#ffffff', f.done('uebergabe modern'), 'Übergabeprotokoll')];
}

function minimal() {
  const st = makeStyle('minimal', '#3a6ea5', { font: 'mono' });
  const f = flow(st, W, H);
  f.header('Geräteübergabe', { subtitle: 'Übergabe- und Rückgabeprotokoll', org: '{{Firma}}' });
  f.section('Gerät', 1);
  f.rows([[['Bezeichnung', 1.6, '{{Geraet}}'], ['Inventarnummer', 1, '{{Inventarnr}}']], [['Seriennummer', 1], ['Standort / Raum', 1]]], { gap: 8 });
  f.section('Zubehör', 2);
  f.checks(['Netzteil', 'Tasche / Koffer', 'Kabel', 'Handbuch', 'Maus / Tastatur', 'Sonstiges:'], { cols: 3, byRow: true, pitch: 7 });
  f.gap(1);
  f.section('Zustand bei Übergabe', 3);
  f.checks(['neuwertig', 'gebrauchsfähig', 'Gebrauchsspuren', 'defekt'], { cols: 4, byRow: true, pitch: 7 });
  f.area('Mängel und Bemerkungen', 3);
  f.section('Übergabe', 4);
  f.rows([[['Übergeben von', 1], ['Übergeben an', 1]], [['Datum der Übergabe', 1], ['Rückgabe bis', 1]]], { gap: 8 });
  f.sign(['Übergeber(in): Unterschrift', 'Empfänger(in): Unterschrift'], { drop: 6 });
  f.footer('{{Firma}}', '1/1');
  return [page('#ffffff', f.done('uebergabe minimal'), 'Geräteübergabe')];
}

void line; void text;

module.exports = family({
  nameBase: 'Übergabeprotokoll',
  category: 'Formulare',
  family: 'uebergabeprotokoll',
  familyName: 'Übergabeprotokoll',
  occasion: 'Formulare & Planer',
  tags: ['Formular', 'Protokoll', 'Übergabe', 'Übergabeprotokoll', 'Zählerstand', 'Schlüssel', 'Mängel', 'A4'],
  formatKey: 'a4-portrait',
  width: 210,
  height: 297,
  fields: [field('Objekt', 'Objekt', 'text', 'Lindenweg 12, 2. OG links')],
  sampleRows: [{ Objekt: 'Lindenweg 12, 2. OG links' }, { Objekt: 'Am Schlosspark 114 b, Dachgeschoss rechts, 12345 Musterstadt' }, { Objekt: '' }],
}, [
  {
    slug: 'uebergabeprotokoll-klassisch', variant: 'Wohnung – Klassisch',
    description: 'Übergabeprotokoll für eine Wohnung (A4): Beteiligte, Zählerstände, Schlüssel und Zustand der Räume mit Schreiblinien und zwei Unterschriften. Die Adresse der Wohnung ist ein Feld.',
    tags: ['klassisch', 'Wohnung', 'Mietwohnung', 'Serifen'], pages: klassisch,
  },
  {
    slug: 'uebergabeprotokoll-modern', variant: 'Wohnung – Modern',
    description: 'Übergabeprotokoll für eine Wohnung (A4): Räume zum Abhaken mit „in Ordnung“ und „Mängel“, Zählerstände und Schlüssel nebeneinander, korallroter Akzent. Die Adresse der Wohnung ist ein Feld.',
    tags: ['modern', 'Wohnung', 'Mietwohnung', 'Kästchen'], pages: modern,
  },
  {
    slug: 'uebergabeprotokoll-geraet', variant: 'Gerät – Minimal',
    description: 'Übergabe- und Rückgabeprotokoll für ein Gerät (A4): Bezeichnung, Seriennummer, Zubehör zum Abhaken, Zustand, Mängel und Rückgabetermin. Monospace, viel Weißraum. Gerät und Inventarnummer sind Felder.',
    tags: ['minimal', 'Gerät', 'Notebook', 'Leihgabe', 'Inventar', 'Mono'], fields: [field('Firma', 'Firma', 'text', 'Müller & Söhne GmbH'), field('Geraet', 'Gerät', 'text', 'Notebook Dell Latitude 5440'), field('Inventarnr', 'Inventarnummer', 'text', 'IT-0231')],
    sampleRows: [{ Firma: 'Müller & Söhne GmbH', Geraet: 'Notebook Dell Latitude 5440', Inventarnr: 'IT-0231' }, { Firma: 'Müller & Söhne GmbH', Geraet: 'Beamer Epson EB-W49 mit Deckenhalterung und Fernbedienung', Inventarnr: 'IT-0302-B' }, { Firma: '', Geraet: '', Inventarnr: '' }], pages: minimal,
  },
]);
