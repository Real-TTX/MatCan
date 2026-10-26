'use strict';
const { field, page, rect, ellipse, text, line, icon } = require('./dsl');
const { family, makeStyle, flow } = require('./_t4-lib');

const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
const SLOTS = [
  { n: '1.', t: '8:00–8:45' }, { n: '2.', t: '8:50–9:35' }, { pause: 'Pause', t: '9:35–9:55' },
  { n: '3.', t: '9:55–10:40' }, { n: '4.', t: '10:45–11:30' }, { pause: 'Pause', t: '11:30–11:50' },
  { n: '5.', t: '11:50–12:35' }, { n: '6.', t: '12:40–13:25' }, { pause: 'Mittagspause', t: '13:25–14:15', tall: true },
  { n: '7.', t: '14:15–15:00' }, { n: '8.', t: '15:05–15:50' },
];

/** Draws the grid of a timetable; returns the bottom edge. o: lesson (height of a lesson row), pause, timeW, headerH */
function grid(f, st, x, y, w, o) {
  const timeW = o.timeW;
  const dw = (w - timeW) / 5;
  const els = [];
  const kind = st.kind;
  let yy = y;
  // header
  if (kind === 'modern') els.push(rect('Kopf', x, yy, w, o.headerH, st.accent, { radius: 1.5, locked: true }));
  DAYS.forEach((d, i) => els.push(text('Tag ' + d, x + timeW + i * dw, yy, dw, o.headerH, d, { f: kind === 'minimal' ? st.lab : st.head, s: o.daySize || 10, w: kind === 'minimal' ? 600 : 700, c: kind === 'modern' ? '#ffffff' : st.ink, a: 'center', up: kind === 'minimal', ls: kind === 'minimal' ? 0.08 : 0, min: 6 })));
  els.push(text('Kopf Zeit', x, yy, timeW, o.headerH, 'Zeit', { f: kind === 'minimal' ? st.lab : st.head, s: o.daySize || 10, w: kind === 'minimal' ? 600 : 700, c: kind === 'modern' ? '#ffffff' : st.grey, a: 'center', up: kind === 'minimal', min: 6 }));
  yy += o.headerH;
  const top = yy;
  const rowsInfo = [];
  SLOTS.forEach(s => {
    const h = s.pause ? (s.tall ? o.pause + 2 : o.pause) : o.lesson;
    rowsInfo.push({ s, y: yy, h });
    yy += h;
  });
  const bottom = yy;
  rowsInfo.forEach(r => {
    if (r.s.pause) {
      els.push(rect('Pause ' + r.s.t, x, r.y, w, r.h, kind === 'modern' ? st.tint : '#f1f1f1', { locked: true }));
      els.push(text('Pause Text ' + r.s.t, x + timeW, r.y, w - timeW, r.h, r.s.pause + '  ·  ' + r.s.t, { f: st.lab, s: 8, i: kind === 'klassisch', c: st.grey, a: 'center', min: 6 }));
      if (kind === 'modern') els.push(icon('Pause Symbol ' + r.s.t, r.s.tall ? 'utensils' : 'coffee', x + timeW / 2 - 2, r.y + (r.h - 4) / 2, 4, st.deep, 2, { locked: true }));
    } else {
      if (kind === 'modern') els.push(ellipse('Nummer Kreis ' + r.s.n, x + 2, r.y + r.h / 2 - 3.4, 6.8, 6.8, st.tint2, { locked: true }));
      els.push(text('Stunde ' + r.s.n, x + 2, r.y + r.h / 2 - 3.4, kind === 'modern' ? 6.8 : 8, 6.8, r.s.n, { f: st.head, s: 10, w: 700, c: kind === 'modern' ? st.deep : st.ink, a: 'center', min: 6 }));
      els.push(text('Zeit ' + r.s.n, x + (kind === 'modern' ? 9.5 : 10), r.y, timeW - (kind === 'modern' ? 10 : 11), r.h, r.s.t, { f: st.lab, s: 8, c: st.grey, a: 'left', min: 6 }));
    }
  });
  const hairs = kind === 'klassisch' ? '#555555' : kind === 'modern' ? '#cfd6dd' : '#c4c4c4';
  const sw = kind === 'klassisch' ? 0.5 : 0.4;
  rowsInfo.forEach((r, i) => { if (i > 0) els.push(line('Zeilenlinie ' + i, x, r.y, x + w, r.y, hairs, sw)); });
  if (kind !== 'minimal') for (let c = 0; c <= 5; c++) els.push(line('Spaltenlinie ' + c, x + timeW + c * dw, top, x + timeW + c * dw, bottom, hairs, sw));
  else for (let c = 0; c <= 5; c++) els.push(line('Spaltenlinie ' + c, x + timeW + c * dw, y, x + timeW + c * dw, bottom, '#d2d2d2', 0.4));
  els.push(line('Kopflinie', x, top, x + w, top, kind === 'klassisch' ? st.ink : kind === 'modern' ? st.accent : st.ink, kind === 'klassisch' ? 1.1 : 0.6));
  if (kind === 'klassisch') els.push(rect('Rahmen', x, y, w, bottom - y, null, { stroke: st.ink, sw: 1.1 }), line('Zeitspalte', x + timeW, y, x + timeW, bottom, st.ink, 1.1));
  if (kind === 'modern') els.push(rect('Rahmen', x, top, w, bottom - top, null, { stroke: '#cfd6dd', sw: 0.5 }));
  els.push(line('Fusslinie', x, bottom, x + w, bottom, kind === 'minimal' ? st.ink : hairs, kind === 'minimal' ? 0.6 : sw));
  f.add(els);
  return bottom;
}

function klassisch() {
  const st = makeStyle('klassisch', '#134e4a');
  const f = flow(st, 297, 210);
  f.header('Stundenplan', { compact: true });
  f.rows([[['Name', 1.6, '{{Name}}'], ['Klasse', 0.8, '{{Klasse}}'], ['Schuljahr', 1, '{{Schuljahr}}']]], { pitch: 14 });
  f.y = grid(f, st, f.x, f.y + 1, f.w, { timeW: 36, headerH: 8, lesson: 14.6, pause: 5.2 });
  return [page('#ffffff', f.done('stundenplan klassisch'), 'Stundenplan')];
}

function modern() {
  const st = makeStyle('modern', '#7c3aed');
  const f = flow(st, 297, 210);
  f.header('Mein Stundenplan', { compact: true, org: '{{Klasse}} · {{Schuljahr}}', orgW: 90 });
  f.rows([[['Name', 1.6, '{{Name}}'], ['Klassenlehrer(in)', 1], ['Raum', 0.6]]], { pitch: 17 });
  f.y = grid(f, st, f.x, f.y, f.w, { timeW: 38, headerH: 8, lesson: 14.8, pause: 5, daySize: 10.5 });
  return [page('#ffffff', f.done('stundenplan modern'), 'Stundenplan')];
}

function minimal() {
  const st = makeStyle('minimal', '#0369a1', { font: 'mono' });
  const f = flow(st, 210, 297);
  f.header('Stundenplan', { compact: true });
  f.rows([[['Name', 1.6, '{{Name}}'], ['Klasse', 0.8, '{{Klasse}}'], ['Schuljahr', 1, '{{Schuljahr}}']]], { gap: 8, pitch: 14.5 });
  f.y = grid(f, st, f.x, f.y + 2, f.w, { timeW: 31, headerH: 8, lesson: 25, pause: 6.5, daySize: 8 });
  return [page('#ffffff', f.done('stundenplan minimal'), 'Stundenplan')];
}

module.exports = family({
  nameBase: 'Stundenplan',
  category: 'Planer',
  family: 'stundenplan',
  familyName: 'Stundenplan',
  occasion: 'Verein & Schule',
  tags: ['Stundenplan', 'Schule', 'Unterricht', 'Schulplaner', 'Wochenplan', 'Schuljahr', 'Klasse', 'Schüler', 'Planer'],
  formatKey: 'a4-landscape',
  width: 297,
  height: 210,
  fields: [field('Name', 'Name', 'text', 'Emma Wagner'), field('Klasse', 'Klasse', 'text', '5b'), field('Schuljahr', 'Schuljahr', 'text', '2027/28')],
  sampleRows: [
    { Name: 'Emma Wagner', Klasse: '5b', Schuljahr: '2027/28' },
    { Name: 'Maximilian Schneider-Hohenstein', Klasse: '10 d (Gymnasium)', Schuljahr: '2027/2028' },
    { Name: '', Klasse: '', Schuljahr: '' },
  ],
}, [
  {
    slug: 'stundenplan-klassisch', variant: 'Klassisch',
    description: 'Stundenplan (A4 quer): Montag bis Freitag, acht Stunden mit Zeiten, Pausen als graue Zeilen. Name, Klasse und Schuljahr sind Felder für eine Serie; Serifenüberschriften und klares Raster.',
    tags: ['klassisch', 'Serifen', 'Raster'], pages: klassisch,
  },
  {
    slug: 'stundenplan-modern', variant: 'Modern',
    description: 'Stundenplan (A4 quer) mit farbiger Kopfzeile, nummerierten Stundenkreisen und Pausenzeilen mit Symbolen. Name, Klasse und Schuljahr sind Felder für eine Serie; violetter Akzent.',
    tags: ['modern', 'bunt', 'Symbole'], pages: modern,
  },
  {
    slug: 'stundenplan-minimal', variant: 'Minimal',
    description: 'Stundenplan im Hochformat (A4 hoch): acht große Stundenfelder je Tag, nur feine Linien, Monospace. Name, Klasse und Schuljahr sind Felder für eine Serie.',
    tags: ['minimal', 'hoch', 'Mono', 'schlicht'], formatKey: 'a4-portrait', width: 210, height: 297, pages: minimal,
  },
]);
