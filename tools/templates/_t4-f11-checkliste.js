'use strict';
const { field, page, rect, text, line } = require('./dsl');
const { family, makeStyle, flow, tick } = require('./_t4-lib');

function klassisch() {
  const st = makeStyle('klassisch', '#2f5d50');
  const f = flow(st, 210, 297);
  f.header('Checkliste', { subtitle: 'Nichts vergessen – alles abgehakt' });
  f.rows([[['Projekt / Anlass', 2, '{{Titel}}'], ['Datum', 1, '{{Datum}}'], ['Verantwortlich', 1.4]]], { pitch: 14 });
  const x = f.x;
  const w = f.w;
  const y0 = f.y + 1;
  const cA = x + 8;
  const cB = x + w - 62;
  const cC = x + w - 28;
  [['Aufgabe', cA, cB - 4], ['Zuständig', cB, cC - 4], ['Bis', cC, x + w]].forEach(([l, a, b]) => f.add(text('Spalte ' + l, a, y0, b - a, 4, l, { f: st.head, s: 9, w: 700, c: st.accent, v: 'top', min: 6 })));
  const pitch = 9.6;
  for (let i = 0; i < 20; i++) {
    const y = y0 + 6 + i * pitch;
    f.add(tick(st, 'Kästchen ' + (i + 1), x, y + 1.7, 4.4));
    [[cA, cB - 4], [cB, cC - 4], [cC, x + w]].forEach(([a, b], k) => f.add(line('Zeile ' + (i + 1) + '.' + (k + 1), a, y + 7.2, b, y + 7.2, '#9c9c9c', 0.35)));
  }
  f.y = y0 + 6 + 20 * pitch;
  f.footer('Stand: {{Datum}}', 'Seite 1 von 1');
  return [page('#ffffff', f.done('check klassisch'), 'Checkliste')];
}

function modern() {
  const st = makeStyle('modern', '#0d9488');
  const f = flow(st, 210, 297);
  f.header('Checkliste', { compact: true });
  f.rows([[['Projekt / Anlass', 2, '{{Titel}}'], ['Datum', 1, '{{Datum}}'], ['Verantwortlich', 1.4]]], { pitch: 18 });
  const gap = 6;
  const cw = (f.w - gap) / 2;
  const ch = 98;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const x = f.x + c * (cw + gap);
      const y = f.y + r * (ch + 5);
      f.add(rect('Karte ' + (r * 2 + c + 1), x, y, cw, ch, '#ffffff', { stroke: '#c8d2d0', sw: 0.5, radius: 2 }));
      f.add(rect('Kartenkopf ' + (r * 2 + c + 1), x, y, cw, 9, st.tint2, { radius: 2, locked: true }), rect('Kartenkopf unten ' + (r * 2 + c + 1), x, y + 5, cw, 4, st.tint2, { locked: true }));
      f.add(text('Kartentitel ' + (r * 2 + c + 1), x + 3, y, 22, 9, 'Bereich:', { f: st.head, s: 9, w: 700, c: st.deep, min: 6 }), line('Kartentitel Linie ' + (r * 2 + c + 1), x + 22, y + 7, x + cw - 3, y + 7, st.accent, 0.4));
      for (let i = 0; i < 9; i++) {
        const ry = y + 12 + i * 9.4;
        f.add(tick(st, 'Kästchen ' + (r * 2 + c + 1) + '.' + (i + 1), x + 3, ry, 4.2), line('Zeile ' + (r * 2 + c + 1) + '.' + (i + 1), x + 10, ry + 5.2, x + cw - 3, ry + 5.2, '#c4c4c4', 0.35));
      }
    }
  }
  f.y += 2 * ch + 5;
  f.footer('Stand: {{Datum}}', 'Seite 1 von 1');
  return [page('#ffffff', f.done('check modern'), 'Checkliste')];
}

function minimal() {
  const st = makeStyle('minimal', '#7c3a55', { font: 'light', margin: 14 });
  const f = flow(st, 148, 210);
  f.header('Checkliste', { compact: true });
  f.rows([[['Titel', 1.6, '{{Titel}}'], ['Datum', 1, '{{Datum}}']]], { gap: 7, pitch: 14 });
  for (let i = 0; i < 12; i++) {
    const y = f.y + 1 + i * 11.2;
    f.add(tick(st, 'Kreis ' + (i + 1), f.x, y + 2, 5), line('Zeile ' + (i + 1), f.x + 9, y + 8, f.x + f.w, y + 8, '#bcbcbc', 0.4));
  }
  f.y += 12 * 11.2 + 2;
  return [page('#ffffff', f.done('check minimal'), 'Checkliste')];
}

module.exports = family({
  nameBase: 'Checkliste',
  category: 'Formulare',
  family: 'checkliste',
  familyName: 'Checkliste',
  occasion: 'Formulare & Planer',
  tags: ['Checkliste', 'Liste', 'Aufgaben', 'Abhaken', 'Planer', 'Projekt', 'Umzug', 'Event', 'To-do', 'A4', 'A5'],
  formatKey: 'a4-portrait',
  width: 210,
  height: 297,
  fields: [field('Titel', 'Titel', 'text', 'Umzug im Oktober'), field('Datum', 'Datum', 'text', '3. Oktober 2026')],
  sampleRows: [{ Titel: 'Umzug im Oktober', Datum: '3. Oktober 2026' }, { Titel: 'Sommerfest des Kindergartens – Aufbau, Verpflegung und Aufräumen', Datum: '27. Juni 2027' }, { Titel: '', Datum: '' }],
}, [
  {
    slug: 'checkliste-klassisch', variant: 'Klassisch',
    description: 'Checkliste (A4): 20 Zeilen mit Kästchen zum Abhaken, dazu Spalten für „Zuständig“ und „Bis“. Titel und Datum sind Felder; ruhiges Layout mit Serifenüberschrift und feinen Linien.',
    tags: ['klassisch', 'Serifen', 'Linien'], pages: klassisch,
  },
  {
    slug: 'checkliste-modern', variant: 'Modern',
    description: 'Checkliste (A4) in vier Karten mit je neun Aufgaben zum Abhaken; jede Karte hat eine Zeile für den Bereich. Titel und Datum sind Felder; Akzent in Türkis.',
    tags: ['modern', 'Karten', 'Kästchen'], pages: modern,
  },
  {
    slug: 'checkliste-minimal', variant: 'Minimal',
    description: 'Schlichte Checkliste (A5): zwölf große Zeilen mit runden Auswahlkreisen, viel Weißraum und helle Linienschrift. Titel und Datum sind Felder.',
    tags: ['minimal', 'schlicht', 'Kreise'], formatKey: 'a5-portrait', width: 148, height: 210, pages: minimal,
  },
]);
