'use strict';
const { field, page, rect, ellipse, text, line, ruled } = require('./dsl');
const { family, makeStyle, flow, tick } = require('./_t4-lib');

const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

function klassisch() {
  const st = makeStyle('klassisch', '#1e3a5f');
  const f = flow(st, 297, 210);
  f.header('{{Monat}}', { compact: true, big: 24 });
  f.add(text('Untertitel', f.x + f.w - 92, f.y - 17.5, 76, 5, 'Monatsplaner', { f: st.lab, s: 10, i: true, c: st.grey, a: 'right', min: 7 }));
  f.table({ cols: [1, 1, 1, 1, 1, 1, 1], header: DAYS, headerHeight: 7.5, rows: 6, fixedRow: 24, s: 9.5, align: Array(7).fill('center') });
  f.add(text('Hinweis', f.x, f.y - 2, f.w, 4, 'Datum in die Ecke schreiben, Platz für Termine, Geburtstage und Notizen.', { f: st.lab, s: 8, i: true, c: st.grey, v: 'top', min: 6 }));
  return [page('#ffffff', f.done('monat klassisch'), 'Monatsplaner')];
}

function modern() {
  const st = makeStyle('modern', '#c2410c');
  const f = flow(st, 210, 297);
  f.header('Monatsplaner', { compact: true, org: '{{Monat}}', orgW: 90 });
  f.section('Meine Ziele', 1);
  for (let i = 0; i < 3; i++) f.add(tick(st, 'Ziel Kästchen ' + (i + 1), f.x, f.y + i * 8, 4.4), line('Ziel Zeile ' + (i + 1), f.x + 8, f.y + i * 8 + 5.4, f.x + f.w, f.y + i * 8 + 5.4, '#c4c4c4', 0.35));
  f.y += 3 * 8 + 3;
  f.section('Tage', 2);
  const gap = 8;
  const cw = (f.w - gap) / 2;
  const pitch = 9.2;
  for (let c = 0; c < 2; c++) {
    const n = c === 0 ? 16 : 15;
    for (let i = 0; i < n; i++) {
      const day = c * 16 + i + 1;
      const x = f.x + c * (cw + gap);
      const y = f.y + i * pitch;
      f.add(ellipse('Tag Kreis ' + day, x, y + 0.9, 6.6, 6.6, st.tint2, { locked: true }), text('Tag ' + day, x, y + 0.9, 6.6, 6.6, String(day), { f: st.head, s: 8.5, w: 700, c: st.deep, a: 'center', min: 6 }), line('Tag Zeile ' + day, x + 9, y + 7.2, x + cw, y + 7.2, '#c4c4c4', 0.35));
    }
  }
  f.y += 16 * pitch + 3;
  f.area('Notizen', 3, { pitch: 8.4 });
  return [page('#ffffff', f.done('monat modern'), 'Monatsplaner')];
}

function minimal() {
  const st = makeStyle('minimal', '#0f766e', { font: 'light', margin: 15 });
  const f = flow(st, 297, 210);
  f.header('{{Monat}}', { compact: true, big: 18 });
  const kw = 12;
  const cw = (f.w - kw) / 7;
  const top = f.y + 1;
  const rh = 21.5;
  DAYS.forEach((d, i) => f.add(text('Wochentag ' + d, f.x + kw + i * cw + 2, top, cw - 4, 5, d, { f: st.lab, s: 8.5, w: 600, c: i > 4 ? st.accent : st.grey, v: 'middle', up: true, ls: 0.1, min: 6 })));
  const gy = top + 6;
  for (let r = 0; r <= 6; r++) f.add(line('Zeilenlinie ' + r, f.x, gy + r * rh, f.x + f.w, gy + r * rh, r === 0 ? st.ink : '#cfcfcf', r === 0 ? 0.6 : 0.4));
  for (let c = 0; c <= 7; c++) f.add(line('Spaltenlinie ' + c, f.x + kw + c * cw, gy, f.x + kw + c * cw, gy + 6 * rh, '#cfcfcf', 0.4));
  f.add(text('KW Beschriftung', f.x, top, kw - 1, 5, 'KW', { f: st.lab, s: 8.5, w: 600, c: st.mid, v: 'middle', min: 6 }));
  const yy = gy + 6 * rh + 5;
  f.add(text('Ziele Beschriftung', f.x, yy - 1, 40, 5, 'Ziele des Monats', { f: st.lab, s: 8.5, w: 700, c: st.accent, v: 'middle', min: 6 }), line('Ziele Linie', f.x + 38, yy + 3.6, f.x + f.w, yy + 3.6, st.ink, 0.5));
  f.y = yy + 6;
  return [page('#ffffff', f.done('monat minimal'), 'Monatsplaner')];
}

void rect; void ruled;

module.exports = family({
  nameBase: 'Monatsplaner',
  category: 'Planer',
  family: 'monatsplaner',
  familyName: 'Monatsplaner',
  occasion: 'Formulare & Planer',
  tags: ['Planer', 'Monatsplaner', 'Monatskalender', 'Kalender', 'Termine', 'Monat', 'Organizer', 'Übersicht'],
  formatKey: 'a4-landscape',
  width: 297,
  height: 210,
  fields: [field('Monat', 'Monat', 'text', 'November 2027')],
  sampleRows: [{ Monat: 'November 2027' }, { Monat: 'Dezember 2027' }, { Monat: 'Januar 2028' }, { Monat: '' }],
}, [
  {
    slug: 'monatsplaner-klassisch', variant: 'Klassisch',
    description: 'Monatsplaner (A4 quer): Kalenderraster Montag bis Sonntag mit sechs Wochen und viel Platz je Tag. Der Monat ist ein Feld, so entsteht aus einer Datenliste ein Plan je Monat; Serifenüberschrift.',
    tags: ['klassisch', 'Serifen', 'Raster', 'quer'], pages: klassisch,
  },
  {
    slug: 'monatsplaner-modern', variant: 'Modern',
    description: 'Monatsplaner (A4 hoch) als Tagesliste: Ziele zum Abhaken, 31 nummerierte Tageszeilen in zwei Spalten und ein Notizfeld. Der Monat ist ein Feld; Akzent in Orange.',
    tags: ['modern', 'Liste', 'Ziele'], formatKey: 'a4-portrait', width: 210, height: 297, pages: modern,
  },
  {
    slug: 'monatsplaner-minimal', variant: 'Minimal',
    description: 'Monatsplaner (A4 quer): feines Raster mit Spalte für die Kalenderwoche, helle Linienschrift und eine Zeile für die Ziele des Monats. Der Monat ist ein Feld.',
    tags: ['minimal', 'quer', 'Raster', 'schlicht'], pages: minimal,
  },
]);
