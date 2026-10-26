'use strict';
const { field, page, rect, text, line, icon } = require('./dsl');
const { family, makeStyle, flow, tick } = require('./_t4-lib');

const W = 210;
const H = 297;

const CHANNELS = ['Empfehlung', 'Internet / Social Media', 'Aushang / Flyer', 'Zeitung'];

function klassisch() {
  const st = makeStyle('klassisch', '#2f5d50');
  const f = flow(st, W, H);
  f.header('Kursanmeldung', { subtitle: 'Verbindliche Anmeldung', org: '{{Anbieter}}' });
  f.section('Kurs');
  f.rows([[['Kurs', 2.2, '{{Kurs}}'], ['Gebühr', 1, '{{Gebuehr}}']], [['Termin', 1, '{{Termin}}']]]);
  f.gap(2);
  f.section('Teilnehmer(in)');
  f.rows([[['Vorname', 1], ['Nachname', 1]], [['Geburtsdatum', 0.8], ['Telefon', 1.2]], [['Straße und Hausnummer', 2.2], ['PLZ', 0.7], ['Ort', 1.5]], [['E-Mail-Adresse', 1]]]);
  f.gap(2);
  f.section('Zahlung und Hinweise');
  f.checks(['Überweisung', 'Barzahlung vor Ort', 'Lastschrift (Formular folgt)'], { cols: 3, byRow: true, pitch: 7 });
  f.checks(CHANNELS, { label: 'Wie hast du von uns erfahren?', cols: 2, pitch: 7, byRow: true });
  f.note('Mit meiner Unterschrift melde ich mich verbindlich an. Ein Rücktritt ist bis 14 Tage vor Kursbeginn kostenfrei möglich, danach wird die volle Gebühr fällig. Bei Verhinderung ist eine Ersatzperson willkommen.', { s: 8.5 });
  f.sign(['Ort, Datum', 'Unterschrift'], { drop: 10 });
  f.footer('{{Anbieter}}', 'Seite 1 von 1');
  return [page('#ffffff', f.done('kurs klassisch'), 'Kursanmeldung')];
}

function modern() {
  const st = makeStyle('modern', '#e0701a');
  const f = flow(st, W, H);
  f.header('Jetzt anmelden', { subtitle: 'Kursanmeldung – bitte vollständig ausfüllen', org: '{{Anbieter}}' });
  // the course ticket
  const y = f.y;
  const w = f.w;
  f.add(rect('Kurskarte', f.x, y, w, 25, st.tint, { radius: 1.6, locked: true }), rect('Kurskarte Balken', f.x, y, 2.6, 25, st.accent, { locked: true }));
  f.add(text('Kurs Etikett', f.x + 7, y + 3, 40, 3.8, 'Dein Kurs', { f: st.lab, s: 8, w: 700, c: st.deep, up: true, ls: 0.1, v: 'top' }));
  f.add(text('Kurs', f.x + 7, y + 7.2, w - 62, 8, '{{Kurs}}', { f: st.head, s: 17, w: 700, c: st.ink, min: 10 }));
  f.add(text('Termin', f.x + 7, y + 16.5, w - 62, 5, '{{Termin}}', { f: st.lab, s: 10, c: st.ink, min: 7 }));
  f.add(line('Kurskarte Trenner', f.x + w - 50, y + 4, f.x + w - 50, y + 21, st.accent, 0.5));
  f.add(text('Gebühr Etikett', f.x + w - 46, y + 3, 42, 3.8, 'Gebühr', { f: st.lab, s: 8, w: 700, c: st.deep, up: true, ls: 0.1, v: 'top' }));
  f.add(text('Gebühr', f.x + w - 46, y + 8, 42, 10, '{{Gebuehr}}', { f: st.head, s: 20, w: 700, c: st.ink, min: 10 }));
  f.y = y + 31;
  f.section('Teilnehmer(in)', 1);
  f.rows([[['Vorname', 1], ['Nachname', 1]], [['Geburtsdatum', 0.8], ['Telefon', 1.2]], [['Straße und Hausnummer', 2.2], ['PLZ', 0.8], ['Ort', 1.5]], [['E-Mail-Adresse', 1]]]);
  f.gap(1);
  const gapC = 8;
  const cw = (f.w - gapC) / 2;
  f.cols([cw, cw], gapC, (i, s) => {
    if (i === 0) {
      s.section('Zahlung', 2);
      s.checks(['Überweisung', 'Barzahlung vor Ort', 'Lastschrift (Formular folgt)'], { pitch: 7 });
    } else {
      s.section('Wie hast du uns gefunden?', 3);
      s.checks(CHANNELS, { pitch: 7 });
    }
  });
  f.gap(2);
  f.note('Mit meiner Unterschrift melde ich mich verbindlich an. Ein Rücktritt ist bis 14 Tage vor Kursbeginn kostenfrei möglich, danach wird die volle Gebühr fällig.', { s: 8.5 });
  f.sign(['Ort, Datum', 'Unterschrift'], { drop: 9 });
  f.footer('{{Anbieter}} · Wir freuen uns auf dich!', 'Seite 1 von 1');
  return [page('#ffffff', f.done('kurs modern'), 'Kursanmeldung')];
}

function minimal() {
  const st = makeStyle('minimal', '#2f6f9a', { font: 'light' });
  const f = flow(st, W, H);
  f.header('Anmeldung', { subtitle: '{{Kurs}}', org: '{{Anbieter}}', big: 20 });
  f.section('Termin und Gebühr', 1);
  f.rows([[['Termin', 2, '{{Termin}}'], ['Gebühr', 1, '{{Gebuehr}}']]], { gap: 8 });
  f.gap(2);
  f.section('Teilnehmer(in)', 2);
  f.rows([[['Vorname', 1], ['Nachname', 1]], [['Geburtsdatum', 0.8], ['Telefon', 1.2]], [['Straße und Hausnummer', 2.2], ['PLZ', 0.8], ['Ort', 1.5]], [['E-Mail-Adresse', 1]]], { gap: 8 });
  f.gap(2);
  f.section('Bezahlung', 3);
  f.checks(['Überweisung', 'Barzahlung vor Ort', 'Lastschrift'], { cols: 3, byRow: true, pitch: 7 });
  f.gap(2);
  f.section('Woher kennst du uns?', 4);
  f.checks(CHANNELS, { cols: 2, pitch: 7, byRow: true });
  f.note('Mit meiner Unterschrift melde ich mich verbindlich an. Rücktritt kostenfrei bis 14 Tage vor Kursbeginn.', { s: 8.5 });
  f.sign(['Ort, Datum', 'Unterschrift'], { drop: 10 });
  f.footer('{{Anbieter}}', '1/1');
  return [page('#ffffff', f.done('kurs minimal'), 'Kursanmeldung')];
}

module.exports = family({
  nameBase: 'Kursanmeldung',
  category: 'Formulare',
  family: 'anmeldung-kurs',
  familyName: 'Kursanmeldung',
  occasion: 'Verein & Schule',
  tags: ['Formular', 'Kurs', 'Anmeldung', 'Kursanmeldung', 'Teilnehmer', 'Workshop', 'Volkshochschule', 'Seminar', 'A4'],
  formatKey: 'a4-portrait',
  width: 210,
  height: 297,
  fields: [
    field('Anbieter', 'Anbieter', 'text', 'Töpferei am Fluss'),
    field('Kurs', 'Kurs', 'text', 'Töpfern für Einsteiger'),
    field('Termin', 'Termin', 'text', 'Dienstags, 18:00–20:00 Uhr · ab 4. Mai 2027'),
    field('Gebuehr', 'Gebühr', 'text', '89,00 €'),
  ],
  sampleRows: [
    { Anbieter: 'Töpferei am Fluss', Kurs: 'Töpfern für Einsteiger', Termin: 'Dienstags, 18:00–20:00 Uhr · ab 4. Mai 2027', Gebuehr: '89,00 €' },
    { Anbieter: 'Sprachschule Lingua', Kurs: 'Italienisch A1 – Grundkurs für Anfängerinnen und Anfänger', Termin: 'Montags und mittwochs, 19:00–20:30 Uhr', Gebuehr: '1.240,00 €' },
    { Anbieter: 'Yoga am Markt', Kurs: 'Yoga', Termin: 'Fr 9:00 Uhr', Gebuehr: '9 €' },
  ],
}, [
  {
    slug: 'kursanmeldung-klassisch', variant: 'Klassisch',
    description: 'Kursanmeldung (A4) mit Schreiblinien: Kursname, Termin und Gebühr sind Felder, dazu Angaben zur Teilnehmerin, Zahlungsart, „Wie hast du von uns erfahren?“ und Rücktrittshinweis.',
    tags: ['klassisch', 'Serifen', 'Linien'], pages: klassisch,
  },
  {
    slug: 'kursanmeldung-modern', variant: 'Modern',
    description: 'Moderne Kursanmeldung (A4): eine orange Kurskarte mit Kurs, Termin und Gebühr als Felder, Eingabefelder als Kästchen, Zahlung und Herkunft nebeneinander. Platz fürs Logo.',
    tags: ['modern', 'Kästchen', 'Akzent'], pages: modern,
  },
  {
    slug: 'kursanmeldung-minimal', variant: 'Minimal',
    description: 'Reduzierte Kursanmeldung (A4): helle Linienschrift, Beschriftung über feinen Linien, runde Auswahlkreise, viel Weißraum. Kurs, Termin und Gebühr als Felder für eine Serie.',
    tags: ['minimal', 'schlicht', 'hell'], pages: minimal,
  },
]);
