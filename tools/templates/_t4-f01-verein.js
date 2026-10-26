'use strict';
const { field, page } = require('./dsl');
const { family, makeStyle, flow } = require('./_t4-lib');

const W = 210;
const H = 297;

function consent(f, items) {
  f.checks(items, { cols: 1, pitch: 7 });
}

function klassisch() {
  const st = makeStyle('klassisch', '#7a1f2b');
  const f = flow(st, W, H);
  f.header('Beitrittserklärung', { subtitle: 'Anmeldung zur Mitgliedschaft', org: '{{Verein}}' });
  f.section('Persönliche Angaben');
  f.rows([[['Vorname', 1], ['Nachname', 1]], [['Geburtsdatum', 0.8], ['Telefon', 1.2]], [['Straße und Hausnummer', 2.2], ['PLZ', 0.7], ['Ort', 1.5]], [['E-Mail-Adresse', 1]]]);
  f.gap(2);
  f.section('Mitgliedschaft');
  f.checks(['Erwachsene(r)', 'Kind / Jugendliche(r)', 'Familie', 'Fördermitglied'], { cols: 2, pitch: 7 });
  f.rows([[['Eintritt zum', 1], ['Abteilung / Gruppe', 1.4]]]);
  f.gap(2);
  f.section('Beitragszahlung per Lastschrift');
  f.rows([[['Kontoinhaber', 1]], [['IBAN', 1.6], ['BIC', 1]], [['Name der Bank', 1]]]);
  f.note('Ich ermächtige den Verein, den fälligen Mitgliedsbeitrag von meinem Konto einzuziehen. Zugleich weise ich mein Kreditinstitut an, die Lastschriften einzulösen.');
  f.section('Einwilligung');
  f.checks(['Fotos aus dem Vereinsleben dürfen veröffentlicht werden.', 'Ich möchte den Vereinsnewsletter per E-Mail erhalten.'], { pitch: 7 });
  f.sign(['Ort, Datum', 'Unterschrift (bei Minderjährigen: Erziehungsberechtigte)'], { drop: 9 });
  f.footer('{{Verein}}', 'Seite 1 von 1');
  return [page('#ffffff', f.done('verein klassisch'), 'Beitrittserklärung')];
}

function modern() {
  const st = makeStyle('modern', '#1d6fb8');
  const f = flow(st, W, H);
  f.header('Mitglied werden', { subtitle: 'Beitrittserklärung – bitte in Druckbuchstaben ausfüllen', org: '{{Verein}}' });
  f.section('Persönliche Angaben', 1);
  f.rows([[['Vorname', 1], ['Nachname', 1]], [['Geburtsdatum', 0.8], ['Telefon', 1.2]], [['Straße und Hausnummer', 2.2], ['PLZ', 0.8], ['Ort', 1.5]], [['E-Mail-Adresse', 1]]]);
  f.gap(1);
  const gapC = 8;
  const cw = (f.w - gapC) / 2;
  f.cols([cw, cw], gapC, (i, s) => {
    if (i === 0) {
      s.section('Mitgliedschaft', 2);
      s.checks(['Erwachsene(r)', 'Kind / Jugendliche(r)', 'Familie', 'Fördermitglied'], { pitch: 7 });
      s.gap(1);
      s.rows([[['Eintritt zum', 1]], [['Abteilung / Gruppe', 1]]]);
    } else {
      s.section('Lastschrift', 3);
      s.rows([[['Kontoinhaber', 1]], [['IBAN', 1]], [['BIC', 0.5], ['Bank', 1]]]);
      s.note('Ich ermächtige den Verein, den Beitrag per Lastschrift einzuziehen.', { s: 8 });
    }
  });
  f.gap(1);
  f.section('Einwilligung', 4);
  f.checks(['Fotos aus dem Vereinsleben dürfen veröffentlicht werden.', 'Ich möchte den Vereinsnewsletter per E-Mail erhalten.'], { pitch: 7 });
  f.gap(1);
  f.area('Bemerkungen', 3);
  f.sign(['Ort, Datum', 'Unterschrift (Erziehungsberechtigte bei Minderjährigen)'], { drop: 7 });
  f.footer('{{Verein}} · Wir freuen uns auf dich!', 'Seite 1 von 1');
  return [page('#ffffff', f.done('verein modern'), 'Beitrittserklärung')];
}

function minimal() {
  const st = makeStyle('minimal', '#c2410c', { font: 'mono' });
  const f = flow(st, W, H);
  f.header('Beitritt', { subtitle: 'Anmeldung zur Mitgliedschaft', org: '{{Verein}}' });
  f.section('Person', 1);
  f.rows([[['Vorname', 1], ['Nachname', 1]], [['Geburtsdatum', 0.8], ['Telefon', 1.2]], [['Straße, Hausnummer', 2.2], ['PLZ', 0.8], ['Ort', 1.5]], [['E-Mail', 1]]], { gap: 8 });
  f.gap(2);
  f.section('Mitgliedschaft', 2);
  f.checks(['Erwachsene(r)', 'Kind / Jugendliche(r)', 'Familie', 'Fördermitglied'], { cols: 2, pitch: 7 });
  f.rows([[['Eintritt zum', 1], ['Abteilung', 1.4]]], { gap: 8 });
  f.gap(2);
  f.section('Lastschrift', 3);
  f.rows([[['Kontoinhaber', 1]], [['IBAN', 1.6], ['BIC', 1]], [['Bank', 1]]], { gap: 8 });
  f.note('Ich ermächtige den Verein, den fälligen Mitgliedsbeitrag per Lastschrift einzuziehen.');
  f.section('Einwilligung', 4);
  consent(f, ['Fotos aus dem Vereinsleben dürfen veröffentlicht werden.', 'Ich möchte den Vereinsnewsletter erhalten.']);
  f.sign(['Ort, Datum', 'Unterschrift / Erziehungsberechtigte'], { drop: 10 });
  f.footer('{{Verein}}', '1/1');
  return [page('#ffffff', f.done('verein minimal'), 'Beitrittserklärung')];
}

module.exports = family({
  nameBase: 'Beitrittserklärung Verein',
  category: 'Formulare',
  family: 'anmeldung-verein',
  familyName: 'Beitrittserklärung Verein',
  occasion: 'Verein & Schule',
  tags: ['Formular', 'Verein', 'Beitritt', 'Anmeldung', 'Mitglied', 'Mitgliedsantrag', 'Lastschrift', 'SEPA', 'Aufnahmeantrag', 'A4'],
  formatKey: 'a4-portrait',
  width: 210,
  height: 297,
  fields: [field('Verein', 'Vereinsname', 'text', 'TSV Musterstadt 1923 e. V.')],
  sampleRows: [{ Verein: 'TSV Musterstadt 1923 e. V.' }, { Verein: 'Kleingartenverein „Am Sonnenhang“ e. V.' }, { Verein: 'MC' }],
}, [
  {
    slug: 'beitritt-verein-klassisch', variant: 'Klassisch',
    description: 'Beitrittserklärung für einen Verein (A4): Serifenschrift, Schreiblinien, Angaben zur Person, Mitgliedsart, Lastschrift und Einwilligung. Der Vereinsname ist ein Feld, oben links ist Platz fürs Logo.',
    tags: ['klassisch', 'Serifen', 'Linien'], pages: klassisch,
  },
  {
    slug: 'beitritt-verein-modern', variant: 'Modern',
    description: 'Moderne Beitrittserklärung für einen Verein (A4): Eingabefelder als Kästchen, nummerierte Abschnitte mit blauem Akzent, Mitgliedschaft und Lastschrift nebeneinander. Vereinsname als Feld, Platz fürs Logo.',
    tags: ['modern', 'Kästchen', 'Akzent'], pages: modern,
  },
  {
    slug: 'beitritt-verein-minimal', variant: 'Minimal',
    description: 'Reduzierte Beitrittserklärung für einen Verein (A4): Monospace-Schrift, Beschriftung über feinen Linien, runde Auswahlkreise und viel Weißraum. Der Vereinsname ist ein Feld, Platz fürs Logo.',
    tags: ['minimal', 'Mono', 'schlicht'], pages: minimal,
  },
]);
