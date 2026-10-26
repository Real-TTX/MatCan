'use strict';
const { field, page, rect, text, line, ruled } = require('./dsl');
const { family, makeStyle, flow, tick } = require('./_t4-lib');

const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function klassisch() {
  const st = makeStyle('klassisch', '#7c2d12');
  const f = flow(st, 210, 297);
  f.header('Wochenplaner', { compact: true });
  f.rows([[['Woche', 1.3, '{{Woche}}'], ['Ziel der Woche', 2]]], { pitch: 15 });
  const x = f.x;
  const w = f.w;
  const bh = 27.5;
  let y = f.y + 1;
  const block = (bx, bw, name, ly) => {
    f.add(text('Tag ' + name, bx, ly + 1.5, 32, 7, name, { f: st.head, s: 12.5, w: 700, c: st.ink, v: 'top', min: 8 }));
    f.add(line('Datum ' + name, bx, ly + 13, bx + 24, ly + 13, '#9c9c9c', 0.35), text('Datum Beschriftung ' + name, bx, ly + 13.6, 24, 3.7, 'Datum', { f: st.lab, s: 8, i: true, c: st.grey, v: 'top', min: 6 }));
    f.add(ruled('Schreiblinie ' + name, bx + 31, ly + 9.2, bw - 31, 2, 9.1, { color: '#9c9c9c', sw: 0.35 }));
  };
  for (let i = 0; i < 5; i++) {
    f.add(line('Tagestrenner ' + (i + 1), x, y, x + w, y, st.ink, i === 0 ? 1.1 : 0.6));
    block(x, w, DAYS[i], y);
    y += bh;
  }
  f.add(line('Tagestrenner Wochenende', x, y, x + w, y, st.ink, 0.6));
  block(x, w / 2 - 3, DAYS[5], y);
  block(x + w / 2 + 3, w / 2 - 3, DAYS[6], y);
  f.add(line('Trenner Wochenende', x + w / 2, y + 2, x + w / 2, y + bh - 1, st.ink, 0.6));
  y += bh;
  f.add(line('Tagestrenner unten', x, y, x + w, y, st.ink, 1.1));
  f.y = y + 3;
  f.area('Notizen und Termine der nächsten Woche', 4, { pitch: 8.4 });
  return [page('#ffffff', f.done('woche klassisch'), 'Wochenplaner')];
}

function modern() {
  const st = makeStyle('modern', '#0f62c9');
  const f = flow(st, 210, 297);
  f.header('Wochenplaner', { compact: true, org: '{{Woche}}', orgW: 80 });
  const gap = 5;
  const cw = (f.w - gap) / 2;
  const ch = 57;
  const cards = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1], [3, 0]];
  cards.forEach(([r, c], i) => {
    const x = f.x + c * (cw + gap);
    const y = f.y + r * (ch + 4);
    f.add(rect('Karte ' + DAYS[i], x, y, cw, ch, '#ffffff', { stroke: '#c9d3df', sw: 0.5, radius: 2 }));
    f.add(rect('Kartenkopf ' + DAYS[i], x, y, cw, 9, i > 4 ? st.tint2 : st.tint, { radius: 2, locked: true }), rect('Kartenkopf unten ' + DAYS[i], x, y + 5, cw, 4, i > 4 ? st.tint2 : st.tint, { locked: true }));
    f.add(text('Tag ' + DAYS[i], x + 3, y, 40, 9, DAYS[i], { f: st.head, s: 10.5, w: 700, c: st.deep, min: 7 }));
    f.add(line('Datum ' + DAYS[i], x + cw - 24, y + 7, x + cw - 3, y + 7, st.accent, 0.4), text('Datum Beschriftung ' + DAYS[i], x + cw - 24, y + 1.2, 21, 3.7, 'Datum', { f: st.lab, s: 8, c: st.deep, a: 'right', v: 'top', min: 6 }));
    f.add(ruled('Schreiblinie ' + DAYS[i], x + 3, y + 17.5, cw - 6, 5, 9, { color: '#a3aebb', sw: 0.35 }));
  });
  // the last card: goals of the week
  const x = f.x + cw + gap;
  const y = f.y + 3 * (ch + 4);
  f.add(rect('Karte Wochenziele', x, y, cw, ch, st.tint, { stroke: st.accent, sw: 0.8, radius: 2 }));
  f.add(text('Titel Wochenziele', x + 3, y + 1, cw - 6, 8, 'Meine Ziele der Woche', { f: st.head, s: 10.5, w: 700, c: st.deep, min: 7 }));
  for (let i = 0; i < 4; i++) f.add(tick(st, 'Ziel Kästchen ' + (i + 1), x + 3, y + 12 + i * 11, 4.2), line('Ziel Zeile ' + (i + 1), x + 10, y + 17 + i * 11, x + cw - 3, y + 17 + i * 11, '#9fb4d0', 0.4));
  f.y += 4 * (ch + 4);
  return [page('#ffffff', f.done('woche modern'), 'Wochenplaner')];
}

function minimal() {
  const st = makeStyle('minimal', '#b91c1c', { font: 'mono', margin: 15 });
  const f = flow(st, 297, 210);
  f.header('Woche', { compact: true, org: '{{Woche}}', orgW: 110 });
  const x0 = f.x;
  const cw = f.w / 7;
  const top = f.y + 1;
  const lines = 15;
  const pitch = 9.3;
  SHORT.forEach((d, i) => {
    const x = x0 + i * cw;
    f.add(text('Tag ' + DAYS[i], x + 2, top, cw - 4, 6, d, { f: st.head, s: 12, w: 700, c: i > 4 ? st.accent : st.ink, v: 'top', up: true, ls: 0.1, min: 8 }));
    f.add(ruled('Schreiblinie ' + d, x + 2, top + 16, cw - 4, lines, pitch, { color: '#808080', sw: 0.6, dash: 'dotted' }));
    if (i > 0) f.add(line('Spaltenlinie ' + d, x, top, x, top + 16 + (lines - 1) * pitch + 4, st.hair, 0.5));
  });
  f.add(line('Kopflinie', x0, top + 10, x0 + f.w, top + 10, st.hair, 0.5));
  const yy = top + 16 + (lines - 1) * pitch + 9;
  f.add(text('Fokus Beschriftung', x0, yy - 1, 40, 5, 'Fokus der Woche', { f: st.lab, s: 8.5, w: 700, c: st.accent, v: 'middle', min: 6 }), line('Fokus Linie', x0 + 38, yy + 3.6, x0 + f.w, yy + 3.6, st.ink, 0.5));
  f.y = yy + 6;
  return [page('#ffffff', f.done('woche minimal'), 'Woche')];
}

module.exports = family({
  nameBase: 'Wochenplaner',
  category: 'Planer',
  family: 'wochenplaner',
  familyName: 'Wochenplaner',
  occasion: 'Formulare & Planer',
  tags: ['Planer', 'Wochenplaner', 'Wochenplan', 'Kalender', 'Terminplaner', 'Woche', 'Organizer', 'Wochenübersicht', 'A4'],
  formatKey: 'a4-portrait',
  width: 210,
  height: 297,
  fields: [field('Woche', 'Woche', 'text', 'KW 44 · 26. Oktober – 1. November 2026')],
  sampleRows: [{ Woche: 'KW 44 · 26. Oktober – 1. November 2026' }, { Woche: 'KW 45 · 2. – 8. November 2026' }, { Woche: '' }],
}, [
  {
    slug: 'wochenplaner-klassisch', variant: 'Klassisch',
    description: 'Wochenplaner (A4 hoch): jeder Tag ein Streifen mit Datum und drei Schreiblinien, Samstag und Sonntag nebeneinander, unten Notizen. Die Woche ist ein Feld; Serifenschrift.',
    tags: ['klassisch', 'Serifen', 'Linien'], pages: klassisch,
  },
  {
    slug: 'wochenplaner-modern', variant: 'Modern',
    description: 'Wochenplaner (A4 hoch): sieben Tageskarten in zwei Spalten, dazu eine Karte „Meine Ziele der Woche“ zum Abhaken. Die Woche ist ein Feld; blauer Akzent.',
    tags: ['modern', 'Karten', 'Kästchen'], pages: modern,
  },
  {
    slug: 'wochenplaner-minimal', variant: 'Minimal',
    description: 'Wochenplaner im Querformat (A4 quer): sieben schmale Spalten Mo bis So mit gepunkteten Schreiblinien und einer Zeile für den Fokus der Woche. Die Woche ist ein Feld; Monospace.',
    tags: ['minimal', 'quer', 'Querformat', 'Mono'], formatKey: 'a4-landscape', width: 297, height: 210, pages: minimal,
  },
]);
