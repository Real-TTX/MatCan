'use strict';
const { field, page, rect, text, line } = require('./dsl');
const { family, makeStyle, flow, tick, tickItem, logoBox } = require('./_t4-lib');

const TAX = ['inkl. 19 % MwSt.', 'inkl. 7 % MwSt.', 'steuerfrei (§ 19 UStG)'];

function klassisch() {
  const st = makeStyle('klassisch', '#7a1f2b', { margin: 8 });
  const f = flow(st, 148, 105);
  const x = 8;
  const w = 132;
  f.add(text('Titel', x, 7, 60, 10, 'Quittung', { f: st.head, s: 22, w: 700, c: st.ink, min: 12 }));
  f.add(text('Absender', x + 62, 7.5, w - 62, 9, '{{Aussteller}}', { f: st.lab, s: 8.5, i: true, c: st.grey, a: 'right', v: 'top', wrap: true, lh: 1.25, min: 6 }));
  f.add(line('Linie dick', x, 19.5, x + w, 19.5, st.ink, 1.4), line('Linie dünn', x, 20.9, x + w, 20.9, st.accent, 0.5));
  f.add(f.field(x, 23, 84, 'Betrag in Worten (Euro)'));
  f.add(rect('Betragsfeld', 100, 24.5, 40, 11.5, '#ffffff', { stroke: st.ink, sw: 0.8 }), text('Euro', 130, 24.5, 8, 11.5, '€', { f: st.head, s: 14, w: 700, c: st.ink, a: 'right', min: 8 }), text('Betrag Beschriftung', 101.5, 25.2, 26, 3.7, 'Betrag in Ziffern', { f: st.lab, s: 8, i: true, c: st.grey, v: 'top', min: 6 }));
  f.add(f.field(x, 39, w, 'erhalten von'));
  f.add(f.field(x, 55, w, 'für (Verwendungszweck)'));
  f.y = 73;
  f.checks(TAX, { cols: 3, byRow: true, s: 8, pitch: 6 });
  const sy = 90;
  f.add(line('Linie Datum', x, sy, x + 52, sy, st.ink, 0.5), text('Beschriftung Datum', x, sy + 0.7, 52, 3.7, 'Ort, Datum', { f: st.lab, s: 8, i: true, c: st.grey, v: 'top', min: 6 }));
  f.add(line('Linie Unterschrift', x + 60, sy, x + w, sy, st.ink, 0.5), text('Beschriftung Unterschrift', x + 60, sy + 0.7, 72, 3.7, 'Betrag dankend erhalten – Unterschrift / Stempel', { f: st.lab, s: 8, i: true, c: st.grey, v: 'top', min: 6 }));
  return [page('#ffffff', f.els, 'Quittung')];
}

function modern() {
  const st = makeStyle('modern', '#0b7285', { margin: 9 });
  const f = flow(st, 210, 99);
  const x = 9;
  f.add(rect('Akzentbalken', x, 9, 20, 1.6, st.accent, { locked: true }));
  f.add(text('Titel', x, 12, 80, 11, 'Quittung', { f: st.head, s: 24, w: 700, c: st.ink, min: 12 }));
  f.add(text('Absender', x + 50, 13, 76, 9, '{{Aussteller}}', { f: st.lab, s: 8.5, w: 600, c: st.deep, a: 'right', v: 'top', wrap: true, lh: 1.25, min: 6 }));
  f.add(f.field(x, 27, 126, 'Erhalten von'));
  f.add(f.field(x, 43, 126, 'für (Verwendungszweck)'));
  f.add(f.field(x, 59, 126, 'Betrag in Worten (Euro)'));
  const sy = 87;
  f.add(line('Linie Datum', x, sy, x + 52, sy, st.ink, 0.5), text('Beschriftung Datum', x, sy + 0.7, 52, 3.7, 'Ort, Datum', { f: st.lab, s: 8, c: st.grey, v: 'top', min: 6 }));
  f.add(line('Linie Unterschrift', x + 62, sy, x + 126, sy, st.ink, 0.5), text('Beschriftung Unterschrift', x + 62, sy + 0.7, 64, 3.7, 'Unterschrift des Empfängers', { f: st.lab, s: 8, c: st.grey, v: 'top', min: 6 }));
  // the amount card
  f.add(rect('Betragskarte', 143, 9, 58, 81, st.tint, { radius: 2, locked: true }));
  f.add(text('Betrag Etikett', 148, 13, 48, 3.8, 'Betrag', { f: st.lab, s: 8, w: 700, c: st.deep, up: true, ls: 0.1, v: 'top' }));
  f.add(rect('Betragsfeld', 148, 18, 48, 15, '#ffffff', { stroke: st.accent, sw: 1, radius: 1.5 }), text('Euro', 186, 18, 8, 15, '€', { f: st.head, s: 16, w: 700, c: st.accent, a: 'right', min: 8 }));
  TAX.forEach((t, i) => f.add(tickItem(st, 'Steuer ' + t, 148, 40 + i * 6.8, 48, t, { s: 8.5, size: 4 })));
  f.add(rect('Stempelfläche', 148, 63, 48, 22, '#ffffff', { stroke: st.accent, sw: 0.6, dash: 'dashed', radius: 1.5 }), text('Stempel', 148, 63, 48, 5, 'Stempel', { f: st.lab, s: 8, c: st.mid, a: 'center', v: 'bottom', min: 6 }));
  void tick; void logoBox;
  return [page('#ffffff', f.els, 'Quittung')];
}

function minimal() {
  const st = makeStyle('minimal', '#b45309', { margin: 9, font: 'mono' });
  const f = flow(st, 148, 105);
  const x = 9;
  const w = 130;
  f.add(text('Absender', x, 8, 90, 4, '{{Aussteller}}', { f: st.lab, s: 8, c: st.mid, v: 'top', min: 6 }));
  f.add(text('Titel', x, 13, 80, 7, 'Quittung', { f: st.head, s: 14, w: 700, c: st.ink, up: true, ls: 0.06, min: 9 }));
  f.add(line('Linie', x, 22, x + w, 22, st.ink, 0.5));
  f.add(f.field(x, 25, 40, 'Betrag in €'), f.field(x + 48, 25, w - 48, 'in Worten'));
  f.add(f.field(x, 40, w, 'erhalten von'));
  f.add(f.field(x, 55, w, 'für'));
  TAX.forEach((t, i) => f.add(tickItem(st, 'Steuer ' + t, x + i * 43.5, 73, 42, t, { s: 8, size: 3.8 })));
  const sy = 89;
  f.add(line('Linie Datum', x, sy, x + 52, sy, st.ink, 0.5), text('Beschriftung Datum', x, sy + 0.7, 52, 3.7, 'Ort, Datum', { f: st.lab, s: 8, c: st.grey, v: 'top', min: 6 }));
  f.add(line('Linie Unterschrift', x + 62, sy, x + w, sy, st.ink, 0.5), text('Beschriftung Unterschrift', x + 62, sy + 0.7, 68, 3.7, 'Unterschrift / Stempel', { f: st.lab, s: 8, c: st.grey, v: 'top', min: 6 }));
  return [page('#ffffff', f.els, 'Quittung')];
}

module.exports = family({
  nameBase: 'Quittung',
  category: 'Formulare',
  family: 'quittung',
  familyName: 'Quittung',
  occasion: 'Business',
  tags: ['Formular', 'Quittung', 'Beleg', 'Zahlungsbeleg', 'Empfangsbestätigung', 'Kassenbon', 'Betrag', 'Bargeld'],
  formatKey: 'a6-landscape',
  width: 148,
  height: 105,
  fields: [field('Aussteller', 'Aussteller', 'text', 'Töpferei am Fluss · Uferstraße 4 · 12345 Musterstadt')],
  sampleRows: [{ Aussteller: 'Töpferei am Fluss · Uferstraße 4 · 12345 Musterstadt' }, { Aussteller: 'Hausmeisterservice Schneider-Hohenstein GbR, Am Alten Bahnhof 114, 12345 Musterstadt' }, { Aussteller: '' }],
}, [
  {
    slug: 'quittung-klassisch', variant: 'Klassisch',
    description: 'Quittung (A6 quer): Betrag in Worten und Ziffern, erhalten von, Verwendungszweck, Steuerhinweis zum Ankreuzen und Unterschrift. Der Aussteller steht als Feld oben rechts.',
    tags: ['klassisch', 'Serifen', 'A6'], pages: klassisch,
  },
  {
    slug: 'quittung-modern', variant: 'Modern',
    description: 'Quittung (DIN lang quer): Eingabekästchen links, rechts eine farbige Betragskarte mit Steuerhinweis und Stempelfläche. Der Aussteller steht als Feld im Kopf.',
    tags: ['modern', 'DIN lang', 'Kästchen'], formatKey: 'din-lang-landscape', width: 210, height: 99, pages: modern,
  },
  {
    slug: 'quittung-minimal', variant: 'Minimal',
    description: 'Quittung (A6 quer): Monospace-Schrift, Beschriftung über feinen Linien, runde Auswahlkreise für den Steuerhinweis. Der Aussteller steht als Feld im Kopf.',
    tags: ['minimal', 'Mono', 'A6'], pages: minimal,
  },
]);
