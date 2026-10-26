'use strict';
const { field, page, rect, ellipse, text, line, icon } = require('./dsl');
const { family, makeStyle, flow, tick } = require('./_t4-lib');

const W = 210;
const H = 297;
const ITEMS = ['Die Organisation', 'Die Inhalte', 'Die Leitung / Referent(in)', 'Die Räumlichkeiten', 'Die Verpflegung', 'Preis und Leistung'];
const WHO = [[['Veranstaltung', 2, '{{Veranstaltung}}'], ['Datum', 1, '{{Datum}}']]];

function klassisch() {
  const st = makeStyle('klassisch', '#8a3b12');
  const f = flow(st, W, H);
  f.header('Feedbackbogen', { subtitle: 'Deine Meinung hilft uns weiter – das Ausfüllen dauert zwei Minuten', org: '{{Veranstalter}}' });
  f.rows(WHO);
  f.section('Wie hat dir die Veranstaltung gefallen?');
  const t = f.table({ cols: [3.2, 1, 1, 1, 1, 1], header: ['', 'sehr gut', 'gut', 'okay', 'mäßig', 'schlecht'], headerHeight: 8, rows: ITEMS.length, fixedRow: 9.6, cells: ITEMS.map(i => [i]), align: ['left', 'center', 'center', 'center', 'center', 'center'], s: 9 });
  ITEMS.forEach((it, r) => [1, 2, 3, 4, 5].forEach(c => { const b = t.cell(r, c); f.add(tick(st, it + ' ' + c, b.x + b.w / 2 - 2.1, b.y + b.h / 2 - 2.1, 4.2)); }));
  f.gap(1);
  f.area('Was hat dir besonders gut gefallen?', 4);
  f.area('Was können wir besser machen?', 4);
  f.checks(['ja', 'vielleicht', 'eher nicht'], { label: 'Würdest du uns weiterempfehlen?', cols: 3, byRow: true, pitch: 7 });
  f.note('Du kannst den Bogen anonym abgeben. Vielen Dank für deine Zeit!', { i: true });
  f.footer('{{Veranstalter}}', 'Seite 1 von 1');
  return [page('#ffffff', f.done('feedback klassisch'), 'Feedbackbogen')];
}

function modern() {
  const st = makeStyle('modern', '#7c3aed');
  const f = flow(st, W, H);
  f.header('Dein Feedback', { subtitle: 'Wie war es für dich? 1 = schlecht, 5 = sehr gut', org: '{{Veranstalter}}' });
  f.rows(WHO);
  f.section('Bewerte uns', 1);
  const x0 = f.x + f.w - 5 * 12.5 + 2;
  const y0 = f.y;
  [['thumbs-down', 0], ['thumbs-up', 4]].forEach(([n, i]) => f.add(icon('Skala ' + n, n, x0 + i * 12.5 + 1.5, y0 - 0.6, 6, st.deep, 2, { locked: true })));
  f.y += 6.2;
  ITEMS.forEach((it, r) => {
    const y = f.y + r * 11.5;
    f.add(rect('Zeile ' + it, f.x, y, f.w, 10, r % 2 ? '#ffffff' : '#f6f4fd', { radius: 1.5, locked: true }));
    f.add(text('Frage ' + it, f.x + 3, y, f.w - 75, 10, it, { f: st.lab, s: 10, w: 500, c: st.ink, min: 7 }));
    for (let i = 0; i < 5; i++) {
      const bx = x0 + i * 12.5 + 1;
      f.add(rect('Feld ' + it + ' ' + (i + 1), bx, y + 1.5, 7, 7, '#ffffff', { stroke: st.accent, sw: 0.8, radius: 1.4 }), text('Zahl ' + (i + 1), bx, y + 1.5, 7, 7, String(i + 1), { f: st.head, s: 9, w: 700, c: st.accent, a: 'center', min: 6 }));
    }
  });
  f.y += ITEMS.length * 11.5 + 2;
  f.section('In deinen Worten', 2);
  f.area('Was hat dir besonders gut gefallen?', 4);
  f.area('Was können wir besser machen?', 4);
  f.checks(['ja', 'vielleicht', 'eher nicht'], { label: 'Würdest du uns weiterempfehlen?', cols: 3, byRow: true, pitch: 7 });
  f.footer('{{Veranstalter}} · Danke für dein Feedback!', 'Seite 1 von 1');
  return [page('#ffffff', f.done('feedback modern'), 'Feedbackbogen')];
}

function minimal() {
  const st = makeStyle('minimal', '#0f766e', { font: 'light' });
  const f = flow(st, W, H);
  f.header('Feedback', { subtitle: 'Bitte einen Kreis je Zeile ausfüllen', org: '{{Veranstalter}}' });
  f.rows(WHO, { gap: 8 });
  f.section('Bewertung', 1);
  const x0 = f.x + f.w - 5 * 14;
  ['sehr gut', 'gut', 'okay', 'mäßig', 'schlecht'].forEach((l, i) => f.add(text('Skala ' + l, x0 + i * 14 - 3, f.y, 14, 3.7, l, { f: st.lab, s: 8, c: st.mid, a: 'center', v: 'top', min: 6 })));
  f.y += 5;
  ITEMS.forEach((it, r) => {
    const y = f.y + r * 10;
    f.add(text('Frage ' + it, f.x, y, f.w - 72, 8, it, { f: st.lab, s: 10, c: st.ink, min: 7 }), line('Trenner ' + it, f.x, y + 9.4, f.x + f.w, y + 9.4, '#dddddd', 0.4));
    for (let i = 0; i < 5; i++) f.add(tick(st, it + ' ' + (i + 1), x0 + i * 14 + 7 - 2.3 - 3, y + 1.4, 5.2));
  });
  f.y += ITEMS.length * 10 + 4;
  f.section('Freitext', 2);
  f.area('Was hat dir gefallen?', 3);
  f.area('Was können wir besser machen?', 3);
  f.checks(['ja', 'vielleicht', 'eher nicht'], { label: 'Würdest du uns weiterempfehlen?', cols: 3, byRow: true, pitch: 7 });
  f.footer('{{Veranstalter}}', '1/1');
  return [page('#ffffff', f.done('feedback minimal'), 'Feedbackbogen')];
}

void ellipse;

module.exports = family({
  nameBase: 'Feedbackbogen',
  category: 'Formulare',
  family: 'feedbackbogen',
  familyName: 'Feedbackbogen',
  occasion: 'Formulare & Planer',
  tags: ['Formular', 'Feedback', 'Feedbackbogen', 'Umfrage', 'Bewertung', 'Evaluation', 'Rückmeldung', 'Skala', 'Seminar', 'A4'],
  formatKey: 'a4-portrait',
  width: 210,
  height: 297,
  fields: [field('Veranstalter', 'Veranstalter', 'text', 'Bildungswerk Nord'), field('Veranstaltung', 'Veranstaltung', 'text', 'Sommerseminar „Achtsam arbeiten“'), field('Datum', 'Datum', 'text', '12. Juni 2027')],
  sampleRows: [
    { Veranstalter: 'Bildungswerk Nord', Veranstaltung: 'Sommerseminar „Achtsam arbeiten“', Datum: '12. Juni 2027' },
    { Veranstalter: 'Kulturverein Stadtmitte e. V.', Veranstaltung: 'Tag der offenen Tür mit Konzert, Führungen und Mitmachaktionen', Datum: '3. und 4. Oktober 2027' },
    { Veranstalter: '', Veranstaltung: 'Workshop', Datum: '' },
  ],
}, [
  {
    slug: 'feedbackbogen-klassisch', variant: 'Klassisch',
    description: 'Feedbackbogen (A4): sechs Fragen mit Ankreuzskala von „sehr gut“ bis „schlecht“ in einer Tabelle, zwei Freitextfelder und Weiterempfehlung. Veranstaltung, Datum und Veranstalter sind Felder.',
    tags: ['klassisch', 'Tabelle', 'Serifen'], pages: klassisch,
  },
  {
    slug: 'feedbackbogen-modern', variant: 'Modern',
    description: 'Moderner Feedbackbogen (A4): Bewertung mit nummerierten Feldern von 1 bis 5 in violetten Zeilenkarten, Freitext und Weiterempfehlung. Veranstaltung, Datum und Veranstalter sind Felder.',
    tags: ['modern', 'Zahlen', 'Kästchen'], pages: modern,
  },
  {
    slug: 'feedbackbogen-minimal', variant: 'Minimal',
    description: 'Reduzierter Feedbackbogen (A4): eine Zeile je Frage mit fünf Auswahlkreisen unter einer feinen Skala, viel Weißraum. Veranstaltung, Datum und Veranstalter sind Felder.',
    tags: ['minimal', 'Kreise', 'schlicht'], pages: minimal,
  },
]);
