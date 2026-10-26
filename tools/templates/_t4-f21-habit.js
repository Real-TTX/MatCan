'use strict';
const { field, page, rect, ellipse, text, line } = require('./dsl');
const { family, makeStyle, flow } = require('./_t4-lib');

const days = n => Array.from({ length: n }, (_, i) => [String(i + 1)]);
const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function klassisch() {
  const st = makeStyle('klassisch', '#9a3412');
  const f = flow(st, 297, 210);
  f.header('Gewohnheits-Tracker', { compact: true, titleW: 130 });
  f.rows([[['Monat', 1, '{{Monat}}'], ['Mein Ziel in diesem Monat', 3]]], { pitch: 15 });
  f.y += 1;
  const rel = [Array.from({ length: 31 }, () => 1)].flat();
  f.table({ cols: [8.2, ...rel], header: ['Gewohnheit', ...Array.from({ length: 31 }, (_, i) => String(i + 1))], headerHeight: 7, rows: 11, fixedRow: 11.2, pad: 0.3, s: 8, align: ['left', ...Array(31).fill('center')] });
  f.note('Jeden Tag, an dem du dran geblieben bist, ein Kreuz setzen – die Kette nicht reißen lassen.', { i: true });
  return [page('#ffffff', f.done('habit klassisch'), 'Gewohnheits-Tracker')];
}

function modern() {
  const st = makeStyle('modern', '#db2777');
  const f = flow(st, 210, 297);
  f.header('Gewohnheits-Tracker', { compact: true, titleW: 110, org: '{{Monat}}', orgW: 55 });
  f.rows([[['Woche vom', 1], ['Mein Fokus', 2.4]]], { pitch: 17 });
  const nameW = 62;
  const dw = (f.w - nameW) / 7;
  const y0 = f.y;
  f.add(rect('Kopf', f.x, y0, f.w, 8, st.accent, { radius: 1.5, locked: true }), text('Kopf Gewohnheit', f.x + 3, y0, nameW, 8, 'Gewohnheit', { f: st.head, s: 9.5, w: 700, c: '#ffffff', min: 6 }));
  WD.forEach((d, i) => f.add(text('Wochentag ' + d, f.x + nameW + i * dw, y0, dw, 8, d, { f: st.head, s: 9.5, w: 700, c: '#ffffff', a: 'center', min: 6 })));
  const rh = 16;
  for (let r = 0; r < 10; r++) {
    const y = y0 + 9 + r * rh;
    if (r % 2 === 0) f.add(rect('Streifen ' + (r + 1), f.x, y, f.w, rh, st.tint, { radius: 1.5, locked: true }));
    f.add(line('Gewohnheit Linie ' + (r + 1), f.x + 3, y + rh - 4, f.x + nameW - 4, y + rh - 4, '#b4a7ad', 0.4));
    for (let i = 0; i < 7; i++) f.add(ellipse('Kreis ' + (r + 1) + ' ' + WD[i], f.x + nameW + i * dw + dw / 2 - 4, y + rh / 2 - 4, 8, 8, '#ffffff', { stroke: st.accent, sw: 0.9 }));
  }
  f.y = y0 + 9 + 10 * rh + 3;
  f.area('Wie lief die Woche?', 3, { pitch: 8.4 });
  return [page('#ffffff', f.done('habit modern'), 'Gewohnheits-Tracker')];
}

function minimal() {
  const st = makeStyle('minimal', '#047857', { font: 'light' });
  const f = flow(st, 210, 297);
  f.header('Gewohnheiten', { compact: true, org: '{{Monat}}', orgW: 70 });
  f.add(text('Hinweis', f.x, f.y - 2, f.w, 4, 'Oben die Gewohnheiten eintragen, dann täglich ein Kreuz setzen.', { f: st.lab, s: 8.5, c: st.mid, v: 'middle', min: 6 }));
  f.y += 3;
  f.table({ cols: [0.55, 1, 1, 1, 1, 1, 1], header: ['Tag', '', '', '', '', '', ''], headerHeight: 13, rows: 31, fixedRow: 6.9, cells: days(31), align: ['center'], s: 8.5, verticals: true });
  return [page('#ffffff', f.done('habit minimal'), 'Gewohnheits-Tracker')];
}

module.exports = family({
  nameBase: 'Gewohnheits-Tracker',
  category: 'Planer',
  family: 'gewohnheits-tracker',
  familyName: 'Gewohnheits-Tracker',
  occasion: 'Formulare & Planer',
  tags: ['Habit Tracker', 'Gewohnheiten', 'Tracker', 'Routine', 'Ziele', 'Selbstorganisation', 'Monat', 'Woche', 'Planer', 'Sport'],
  formatKey: 'a4-landscape',
  width: 297,
  height: 210,
  fields: [field('Monat', 'Monat', 'text', 'November 2027')],
  sampleRows: [{ Monat: 'November 2027' }, { Monat: 'Dezember 2027' }, { Monat: '' }],
}, [
  {
    slug: 'gewohnheits-tracker-klassisch', variant: 'Klassisch',
    description: 'Gewohnheits-Tracker für den Monat (A4 quer): zehn Zeilen für Gewohnheiten, 31 Tagesspalten zum Ankreuzen. Der Monat ist ein Feld; Serifenüberschrift und klares Raster.',
    tags: ['klassisch', 'Serifen', 'Raster', 'quer'], pages: klassisch,
  },
  {
    slug: 'gewohnheits-tracker-modern', variant: 'Modern',
    description: 'Wochen-Tracker für Gewohnheiten (A4 hoch): zehn Gewohnheiten mit sieben Kreisen von Mo bis So, rosa Kopfzeile und Platz für einen Rückblick. Der Monat ist ein Feld.',
    tags: ['modern', 'Woche', 'Kreise'], formatKey: 'a4-portrait', width: 210, height: 297, pages: modern,
  },
  {
    slug: 'gewohnheits-tracker-minimal', variant: 'Minimal',
    description: 'Gewohnheits-Tracker (A4 hoch): 31 Tage untereinander, sechs freie Spalten für eigene Gewohnheiten, feine Linien und helle Schrift. Der Monat ist ein Feld.',
    tags: ['minimal', 'hoch', 'schlicht'], formatKey: 'a4-portrait', width: 210, height: 297, pages: minimal,
  },
]);
