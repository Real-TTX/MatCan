'use strict';
const { field, page } = require('./dsl');
const { family, makeStyle, flow } = require('./_t4-lib');

const W = 210;
const H = 297;
const KINDS = ['Erholungsurlaub', 'Sonderurlaub', 'Unbezahlter Urlaub', 'Freizeitausgleich'];
const WHO = [[['Name', 1.6, '{{Name}}'], ['Personalnummer', 1, '{{Personalnr}}']], [['Abteilung', 1.6, '{{Abteilung}}'], ['Vorgesetzte(r)', 1]]];
const TIME = [[['Urlaub vom', 1], ['bis einschließlich', 1], ['Arbeitstage', 0.8]], [['Vertretung während der Abwesenheit', 1]]];
const KONTO = [[['Jahresanspruch (Tage)', 1], ['bereits genommen', 1], ['jetzt beantragt', 1], ['Resturlaub danach', 1]]];

function klassisch() {
  const st = makeStyle('klassisch', '#1f4e79');
  const f = flow(st, W, H);
  f.header('Urlaubsantrag', { subtitle: 'Antrag auf Gewährung von Urlaub', org: '{{Firma}}' });
  f.section('Antragsteller(in)');
  f.rows(WHO);
  f.gap(1);
  f.section('Art der Abwesenheit');
  f.checks(KINDS, { cols: 2, byRow: true, pitch: 7 });
  f.gap(1);
  f.section('Zeitraum');
  f.rows(TIME);
  f.gap(1);
  f.section('Urlaubskonto');
  f.rows(KONTO, { gap: 5 });
  f.gap(1);
  f.section('Entscheidung der Vorgesetzten');
  f.checks(['genehmigt', 'abgelehnt', 'mit Änderung genehmigt'], { cols: 3, byRow: true, pitch: 7 });
  f.rows([[['Bemerkung', 1]]]);
  f.sign(['Antragsteller(in): Datum, Unterschrift', 'Vorgesetzte(r): Datum, Unterschrift'], { drop: 6 });
  f.footer('{{Firma}} · Bitte rechtzeitig bei der Vorgesetzten einreichen', 'Seite 1 von 1');
  return [page('#ffffff', f.done('urlaub klassisch'), 'Urlaubsantrag')];
}

function modern() {
  const st = makeStyle('modern', '#2a9d6f');
  const f = flow(st, W, H);
  f.header('Urlaub beantragen', { subtitle: 'Urlaubsantrag', org: '{{Firma}}' });
  f.section('Wer fragt?', 1);
  f.rows(WHO);
  const gapC = 8;
  const cw = (f.w - gapC) / 2;
  f.cols([cw, cw], gapC, (i, s) => {
    if (i === 0) {
      s.section('Art', 2);
      s.checks(KINDS, { pitch: 7 });
    } else {
      s.section('Urlaubskonto', 3);
      s.rows([[['Anspruch', 1], ['genommen', 1]], [['beantragt', 1], ['Rest danach', 1]]]);
    }
  });
  f.gap(1);
  f.section('Wann?', 4);
  f.rows(TIME);
  f.gap(1);
  f.section('Entscheidung', 5);
  f.checks(['genehmigt', 'abgelehnt', 'mit Änderung'], { cols: 3, byRow: true, pitch: 7 });
  f.sign(['Antragsteller(in): Datum, Unterschrift', 'Vorgesetzte(r): Datum, Unterschrift'], { drop: 7 });
  f.footer('{{Firma}}', 'Seite 1 von 1');
  return [page('#ffffff', f.done('urlaub modern'), 'Urlaubsantrag')];
}

function minimal() {
  const st = makeStyle('minimal', '#2f855a', { font: 'mono' });
  const f = flow(st, W, H);
  f.header('Urlaubsantrag', { subtitle: 'Antrag auf Urlaub', org: '{{Firma}}' });
  f.section('Person', 1);
  f.rows(WHO, { gap: 8 });
  f.section('Art', 2);
  f.checks(KINDS, { cols: 2, byRow: true, pitch: 7 });
  f.gap(1);
  f.section('Zeitraum', 3);
  f.rows(TIME, { gap: 8 });
  f.section('Konto', 4);
  f.rows(KONTO, { gap: 8 });
  f.section('Entscheidung', 5);
  f.checks(['genehmigt', 'abgelehnt', 'mit Änderung'], { cols: 3, byRow: true, pitch: 7 });
  f.sign(['Antragsteller(in): Datum, Unterschrift', 'Vorgesetzte(r): Datum, Unterschrift'], { drop: 7 });
  f.footer('{{Firma}}', '1/1');
  return [page('#ffffff', f.done('urlaub minimal'), 'Urlaubsantrag')];
}

module.exports = family({
  nameBase: 'Urlaubsantrag',
  category: 'Formulare',
  family: 'urlaubsantrag',
  familyName: 'Urlaubsantrag',
  occasion: 'Business',
  tags: ['Formular', 'Urlaub', 'Urlaubsantrag', 'Antrag', 'Mitarbeiter', 'Personal', 'Abwesenheit', 'Genehmigung', 'A4'],
  formatKey: 'a4-portrait',
  width: 210,
  height: 297,
  fields: [
    field('Firma', 'Firma', 'text', 'Müller & Söhne GmbH'),
    field('Name', 'Name', 'text', 'Lena Krüger'),
    field('Personalnr', 'Personalnummer', 'text', '1042'),
    field('Abteilung', 'Abteilung', 'text', 'Vertrieb'),
  ],
  sampleRows: [
    { Firma: 'Müller & Söhne GmbH', Name: 'Lena Krüger', Personalnr: '1042', Abteilung: 'Vertrieb' },
    { Firma: 'Müller & Söhne GmbH', Name: 'Maximilian Schneider-Hohenstein', Personalnr: '2087', Abteilung: 'Einkauf und Logistik' },
    { Firma: 'Müller & Söhne GmbH', Name: 'Jo Li', Personalnr: '', Abteilung: '' },
  ],
}, [
  {
    slug: 'urlaubsantrag-klassisch', variant: 'Klassisch',
    description: 'Urlaubsantrag (A4): Antragsteller, Art der Abwesenheit, Zeitraum, Urlaubskonto und Entscheidung der Vorgesetzten mit zwei Unterschriften. Firma, Name und Abteilung sind Felder für eine Serie.',
    tags: ['klassisch', 'Serifen', 'Linien'], pages: klassisch,
  },
  {
    slug: 'urlaubsantrag-modern', variant: 'Modern',
    description: 'Moderner Urlaubsantrag (A4): nummerierte Abschnitte in Grün, Art der Abwesenheit und Urlaubskonto nebeneinander, Eingabekästchen. Firma, Name und Abteilung sind Felder für eine Serie.',
    tags: ['modern', 'Kästchen', 'Akzent'], pages: modern,
  },
  {
    slug: 'urlaubsantrag-minimal', variant: 'Minimal',
    description: 'Reduzierter Urlaubsantrag (A4): Monospace-Schrift, Beschriftung über feinen Linien, runde Auswahlkreise und viel Weißraum. Firma, Name und Abteilung sind Felder für eine Serie.',
    tags: ['minimal', 'Mono', 'schlicht'], pages: minimal,
  },
]);
