'use strict';
const { field, page, rect, ellipse, text, line, icon, frame } = require('./dsl');
const { family, makeStyle, flow, tick } = require('./_t4-lib');

function stars(f, st, x, y, size, o = {}) {
  const gap = o.gap || 2;
  for (let i = 0; i < 5; i++) f.add(icon('Stern ' + (i + 1), 'star', x + i * (size + gap), y, size, st.accent, 1.6, { locked: true }));
}

function klassisch() {
  const st = makeStyle('klassisch', '#8c2f39', { margin: 12 });
  const f = flow(st, 148, 210);
  f.header('Lesetagebuch', { compact: true, big: 19, titleW: 70, org: '{{Leser}}', orgW: 36 });
  f.rows([[['Titel des Buches', 1]], [['Autor(in)', 1.5], ['Seiten', 0.6]], [['Gelesen vom', 1], ['bis', 1]]], { pitch: 13.5 });
  f.y += 2;
  f.add(text('Bewertung Beschriftung', f.x, f.y + 1, 30, 7, 'Meine Bewertung', { f: st.head, s: 10, w: 700, c: st.accent, v: 'middle', min: 7 }));
  stars(f, st, f.x + 38, f.y + 0.6, 7.5);
  f.y += 11;
  f.area('Worum geht es?', 4, { pitch: 7.8 });
  f.area('Meine Lieblingsstelle', 3, { pitch: 7.8 });
  f.area('Das hat mir gefallen / nicht gefallen', 3, { pitch: 7.8 });
  return [page('#ffffff', f.done('lese klassisch'), 'Lesetagebuch')];
}

function modern() {
  const st = makeStyle('modern', '#6d28d9');
  const f = flow(st, 210, 297);
  f.header('Lesetagebuch', { compact: true, org: '{{Leser}}', orgW: 80 });
  const cx = f.x;
  const cy = f.y;
  f.add(rect('Cover Fläche', cx, cy, 46, 66, st.tint2, { radius: 2, locked: true }), frame('Cover', cx + 1.5, cy + 1.5, 43, 63, { radius: 1.5 }));
  f.add(text('Cover Beschriftung', cx, cy + 67, 46, 4, 'Cover', { f: st.lab, s: 8, c: st.mid, a: 'center', v: 'top', min: 6 }));
  const rx = cx + 52;
  const s = f.sub(rx, f.w - 52, cy);
  s.rows([[['Titel des Buches', 1]], [['Autor(in)', 1.6], ['Seiten', 0.6]], [['Gelesen vom', 1], ['bis', 1]]], { pitch: 17 });
  f.y = cy + 73;
  f.add(text('Bewertung Beschriftung', f.x, f.y, 40, 8, 'Meine Bewertung', { f: st.head, s: 10.5, w: 700, c: st.deep, v: 'middle', min: 7 }));
  stars(f, st, f.x + 46, f.y, 8, { gap: 2.5 });
  f.y += 13;
  f.section('Worum geht es?', 1);
  f.area('Inhalt in eigenen Worten', 4);
  f.section('Lieblingszitat', 2);
  f.area('Meine Lieblingsstelle', 3);
  f.section('Meine Meinung', 3);
  f.area('Das hat mir gefallen / nicht gefallen', 3);
  return [page('#ffffff', f.done('lese modern'), 'Lesetagebuch')];
}

function minimal() {
  const st = makeStyle('minimal', '#334155', { font: 'mono', margin: 13 });
  const f = flow(st, 148, 210);
  f.header('Gelesen', { compact: true, titleW: 70, org: '{{Leser}}', orgW: 36 });
  f.rows([[['Titel', 1]], [['Autor(in)', 1.5], ['Seiten', 0.6]], [['von', 1], ['bis', 1]]], { gap: 7, pitch: 13.2 });
  f.add(text('Bewertung Beschriftung', f.x, f.y + 1, 28, 6, 'Bewertung', { f: st.lab, s: 8.5, c: st.grey, v: 'middle', min: 6 }));
  for (let i = 0; i < 5; i++) f.add(ellipse('Bewertung Kreis ' + (i + 1), f.x + 30 + i * 11, f.y + 0.6, 6.4, 6.4, '#ffffff', { stroke: st.ink, sw: 0.5 }), text('Bewertung Zahl ' + (i + 1), f.x + 30 + i * 11, f.y + 0.6, 6.4, 6.4, String(i + 1), { f: st.lab, s: 8, c: st.ink, a: 'center', min: 6 }));
  f.y += 10.5;
  f.area('Worum geht es?', 4, { pitch: 7.8 });
  f.area('Lieblingsstelle', 3, { pitch: 7.8 });
  f.area('Meine Meinung', 3, { pitch: 7.8 });
  return [page('#ffffff', f.done('lese minimal'), 'Lesetagebuch')];
}

void line; void tick;

module.exports = family({
  nameBase: 'Lesetagebuch',
  category: 'Planer',
  family: 'lesetagebuch',
  familyName: 'Lesetagebuch',
  occasion: 'Verein & Schule',
  tags: ['Lesetagebuch', 'Buch', 'Lesen', 'Leseliste', 'Buchbewertung', 'Schule', 'Leseprojekt', 'Bücher', 'Planer'],
  formatKey: 'a5-portrait',
  width: 148,
  height: 210,
  fields: [field('Leser', 'Name', 'text', 'Mia')],
  sampleRows: [{ Leser: 'Mia' }, { Leser: 'Maximilian Schneider-Hohenstein' }, { Leser: '' }],
}, [
  {
    slug: 'lesetagebuch-klassisch', variant: 'Klassisch',
    description: 'Seite für ein Lesetagebuch (A5): Titel, Autorin, Lesezeitraum, fünf Sterne zum Bewerten und Schreiblinien für Inhalt, Lieblingsstelle und Meinung. Der Name ist ein Feld; Serifenschrift.',
    tags: ['klassisch', 'Serifen', 'Sterne'], pages: klassisch,
  },
  {
    slug: 'lesetagebuch-modern', variant: 'Modern',
    description: 'Seite für ein Lesetagebuch (A4) mit Platz für das Cover, Angaben in Kästchen, Sternebewertung und drei Schreibfeldern für Inhalt, Lieblingszitat und Meinung. Der Name ist ein Feld; Akzent in Violett.',
    tags: ['modern', 'Cover', 'Sterne', 'Kästchen'], formatKey: 'a4-portrait', width: 210, height: 297, pages: modern,
  },
  {
    slug: 'lesetagebuch-minimal', variant: 'Minimal',
    description: 'Schlichte Lesetagebuch-Seite (A5): Monospace-Schrift, Bewertung mit fünf nummerierten Kreisen, gepunktete Schreiblinien und viel Weißraum. Der Name ist ein Feld.',
    tags: ['minimal', 'Mono', 'schlicht'], pages: minimal,
  },
]);
