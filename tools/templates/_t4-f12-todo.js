'use strict';
const { field, page, rect, text, line, icon } = require('./dsl');
const { family, makeStyle, flow, tick } = require('./_t4-lib');

function klassisch() {
  const st = makeStyle('klassisch', '#9a3412');
  const f = flow(st, 210, 297);
  f.header('To-do-Liste', { subtitle: 'Was heute und diese Woche zu erledigen ist' });
  f.rows([[['Datum', 1, '{{Datum}}'], ['Schwerpunkt der Woche', 2.4]]], { pitch: 14 });
  const x = f.x;
  const w = f.w;
  const y0 = f.y + 1;
  const cP = x + w - 56;
  const cD = x + w - 26;
  f.add(text('Spalte Aufgabe', x + 8, y0, 60, 4, 'Aufgabe', { f: st.head, s: 9, w: 700, c: st.accent, v: 'top', min: 6 }), text('Spalte Priorität', cP, y0, 26, 4, 'Priorität', { f: st.head, s: 9, w: 700, c: st.accent, v: 'top', min: 6 }), text('Spalte Fällig', cD, y0, 26, 4, 'Fällig', { f: st.head, s: 9, w: 700, c: st.accent, v: 'top', min: 6 }));
  const pitch = 10;
  for (let i = 0; i < 17; i++) {
    const y = y0 + 6 + i * pitch;
    f.add(tick(st, 'Kästchen ' + (i + 1), x, y + 2, 4.4), line('Zeile ' + (i + 1), x + 8, y + 7.6, cP - 4, y + 7.6, '#9c9c9c', 0.35));
    ['A', 'B', 'C'].forEach((l, k) => f.add(rect('Priorität ' + l + (i + 1), cP + k * 8.4, y + 2.4, 6, 6, '#ffffff', { stroke: '#6b6b6b', sw: 0.4, radius: 3 }), text('Buchstabe ' + l + (i + 1), cP + k * 8.4, y + 2.4, 6, 6, l, { f: st.lab, s: 8, c: '#6b6b6b', a: 'center', min: 6 })));
    f.add(line('Fällig ' + (i + 1), cD, y + 7.6, x + w, y + 7.6, '#9c9c9c', 0.35));
  }
  f.y = y0 + 6 + 17 * pitch + 2;
  f.area('Notizen', 3, { pitch: 8.4 });
  f.footer('A = heute · B = diese Woche · C = irgendwann', 'Seite 1 von 1');
  return [page('#ffffff', f.done('todo klassisch'), 'To-do-Liste')];
}

function modern() {
  const st = makeStyle('modern', '#e11d48');
  const f = flow(st, 148, 210);
  f.header('Heute', { compact: true, org: '{{Datum}}', logo: false, orgW: 50 });
  f.y -= 2;
  f.section('Die drei wichtigsten Dinge', 1);
  for (let i = 0; i < 3; i++) {
    const y = f.y + i * 13;
    f.add(rect('Top ' + (i + 1), f.x, y, f.w, 11, '#ffffff', { stroke: st.accent, sw: 0.8, radius: 2 }), rect('Top Zahl ' + (i + 1), f.x, y, 11, 11, st.accent, { radius: 2, locked: true }), text('Top Nummer ' + (i + 1), f.x, y, 11, 11, String(i + 1), { f: st.head, s: 14, w: 700, c: '#ffffff', a: 'center', min: 8 }));
  }
  f.y += 3 * 13 + 2;
  f.section('Weitere Aufgaben', 2);
  for (let i = 0; i < 8; i++) {
    const y = f.y + i * 9;
    f.add(tick(st, 'Kästchen ' + (i + 1), f.x, y + 1.2, 4.4), line('Zeile ' + (i + 1), f.x + 8, y + 6.6, f.x + f.w, y + 6.6, '#c2c2c2', 0.35));
  }
  f.y += 8 * 9 + 2;
  f.add(rect('Notizkasten', f.x, f.y, f.w, 30, st.tint, { radius: 2, locked: true }), text('Notizen', f.x + 3, f.y + 1.5, 40, 4, 'Notizen', { f: st.head, s: 9, w: 700, c: st.deep, v: 'top', min: 6 }));
  f.y += 31;
  return [page('#ffffff', f.done('todo modern'), 'To-do-Liste')];
}

function minimal() {
  const st = makeStyle('minimal', '#1d4ed8', { font: 'mono' });
  const f = flow(st, 210, 297);
  f.header('Prioritäten', { subtitle: 'Wichtig und dringend zuerst', org: '{{Datum}}' });
  const gap = 6;
  const cw = (f.w - gap - 8) / 2;
  const ch = 98;
  const x0 = f.x + 8;
  const y0 = f.y + 8;
  const quads = [['Sofort erledigen', 'wichtig und dringend'], ['Einplanen', 'wichtig, nicht dringend'], ['Abgeben', 'dringend, nicht wichtig'], ['Streichen', 'weder noch']];
  f.add(text('Achse oben links', x0, f.y, cw, 4, 'DRINGEND', { f: st.lab, s: 8, c: st.mid, a: 'center', v: 'top', ls: 0.15, min: 6 }), text('Achse oben rechts', x0 + cw + gap, f.y, cw, 4, 'NICHT DRINGEND', { f: st.lab, s: 8, c: st.mid, a: 'center', v: 'top', ls: 0.15, min: 6 }));
  f.add(text('Achse links oben', f.x - 46, y0 + ch / 2 - 2, 98, 4, 'WICHTIG', { f: st.lab, s: 8, c: st.mid, a: 'center', ls: 0.15, rotation: 270, min: 6 }));
  f.add(text('Achse links unten', f.x - 46, y0 + ch + 5 + ch / 2 - 2, 98, 4, 'NICHT WICHTIG', { f: st.lab, s: 8, c: st.mid, a: 'center', ls: 0.15, rotation: 270, min: 6 }));
  quads.forEach((q, i) => {
    const c = i % 2;
    const r = Math.floor(i / 2);
    const x = x0 + c * (cw + gap);
    const y = y0 + r * (ch + 5);
    f.add(rect('Feld ' + q[0], x, y, cw, ch, i === 0 ? st.tint : null, { stroke: i === 0 ? st.accent : st.hair, sw: 0.5 }));
    f.add(text('Titel ' + q[0], x + 3, y + 2, cw - 6, 5, q[0], { f: st.head, s: 10, w: 700, c: i === 0 ? st.accent : st.ink, v: 'top', min: 7 }), text('Untertitel ' + q[0], x + 3, y + 7.4, cw - 6, 3.7, q[1], { f: st.lab, s: 8, c: st.mid, v: 'top', min: 6 }));
    for (let k = 0; k < 7; k++) {
      const ly = y + 21 + k * 11;
      f.add(tick(st, 'Kreis ' + q[0] + (k + 1), x + 3, ly - 4.6, 4.4), line('Zeile ' + q[0] + (k + 1), x + 10, ly, x + cw - 3, ly, '#c9c9c9', 0.35));
    }
  });
  f.y = y0 + 2 * ch + 5;
  f.footer('Datum: {{Datum}}', '1/1');
  return [page('#ffffff', f.done('todo minimal'), 'Prioritäten')];
}

void icon;

module.exports = family({
  nameBase: 'To-do-Liste',
  category: 'Formulare',
  family: 'todo-liste',
  familyName: 'To-do-Liste',
  occasion: 'Formulare & Planer',
  tags: ['To-do', 'Todo', 'Aufgabenliste', 'Aufgaben', 'Tagesplan', 'Prioritäten', 'Eisenhower', 'Planer', 'Liste'],
  formatKey: 'a4-portrait',
  width: 210,
  height: 297,
  fields: [field('Datum', 'Datum', 'text', 'Montag, 25. Oktober 2027')],
  sampleRows: [{ Datum: 'Montag, 25. Oktober 2027' }, { Datum: 'Kalenderwoche 43 · 25. bis 31. Oktober 2027' }, { Datum: '' }],
}, [
  {
    slug: 'todo-liste-klassisch', variant: 'Klassisch',
    description: 'To-do-Liste (A4) mit 17 Zeilen: Kästchen, Aufgabe, Priorität A, B oder C und Fälligkeit, dazu ein Notizfeld. Das Datum ist ein Feld; Serifenüberschriften und feine Linien.',
    tags: ['klassisch', 'Serifen', 'Priorität'], pages: klassisch,
  },
  {
    slug: 'todo-liste-modern', variant: 'Modern',
    description: 'Tagesliste „Heute“ (A5): die drei wichtigsten Dinge in nummerierten Feldern, acht weitere Aufgaben zum Abhaken und ein Notizkasten. Das Datum ist ein Feld; Akzent in Rot.',
    tags: ['modern', 'Tagesplan', 'Top 3'], formatKey: 'a5-portrait', width: 148, height: 210, pages: modern,
  },
  {
    slug: 'todo-liste-matrix', variant: 'Matrix – Minimal',
    description: 'Prioritäten-Matrix nach Eisenhower (A4): vier Felder für „Sofort erledigen“, „Einplanen“, „Abgeben“ und „Streichen“ mit je sieben Zeilen zum Abhaken. Das Datum ist ein Feld; Monospace, viel Weißraum.',
    tags: ['minimal', 'Matrix', 'Eisenhower', 'Mono'], pages: minimal,
  },
]);
