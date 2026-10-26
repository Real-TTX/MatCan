'use strict';
const { field, page, rect, text, line, icon } = require('./dsl');
const { family, makeStyle, flow, tick } = require('./_t4-lib');

const G = {
  Dokumente: { icon: 'id-card', items: ['Personalausweis / Reisepass', 'Tickets und Buchungen', 'Versicherungskarten', 'Führerschein', 'Bargeld und Karten'], blank: 1 },
  Kleidung: { icon: 'shirt', items: ['T-Shirts', 'Hosen / Röcke', 'Unterwäsche', 'Socken', 'Pullover / Jacke', 'Schlafanzug', 'Schuhe', 'Badesachen'], blank: 1 },
  Hygiene: { icon: 'bath', items: ['Zahnbürste, Zahnpasta', 'Shampoo, Duschgel', 'Deo', 'Sonnencreme', 'Handtuch'], blank: 1 },
  Technik: { icon: 'smartphone', items: ['Handy und Ladekabel', 'Powerbank', 'Kamera', 'Reiseadapter'], blank: 2 },
  Gesundheit: { icon: 'pill', items: ['Medikamente', 'Pflaster', 'Schmerzmittel', 'Insektenschutz'], blank: 2 },
  Sonstiges: { icon: 'briefcase', items: ['Reiseführer / Karte', 'Wasserflasche', 'Buch oder Tablet'], blank: 2 },
};
const WHO = [[['Reiseziel', 1.5, '{{Reiseziel}}'], ['Reisezeit', 1.5, '{{Reisezeit}}'], ['Personen', 0.7]]];

function klassisch() {
  const st = makeStyle('klassisch', '#1f5f8b');
  const f = flow(st, 210, 297);
  f.header('Packliste', { subtitle: 'Nichts vergessen – von A wie Ausweis bis Z wie Zahnbürste' });
  f.rows(WHO);
  const gap = 10;
  const cw = (f.w - gap) / 2;
  const col = (s, names) => names.forEach(n => {
    const g = G[n];
    s.section(n);
    g.items.forEach(it => { s.add(tick(st, n + ' ' + it, s.x, s.y + 1, 4.2), text('Punkt ' + it, s.x + 7, s.y, s.w - 7, 6.2, it, { f: st.lab, s: 9.5, c: st.ink, min: 7 })); s.y += 7; });
    for (let b = 0; b < g.blank; b++) { s.add(tick(st, n + ' frei ' + b, s.x, s.y + 1, 4.2), line('Freizeile ' + n + b, s.x + 7, s.y + 5.4, s.x + s.w, s.y + 5.4, '#9c9c9c', 0.35)); s.y += 7; }
  });
  f.cols([cw, cw], gap, (i, s) => col(s, i === 0 ? ['Dokumente', 'Kleidung'] : ['Hygiene', 'Technik', 'Gesundheit', 'Sonstiges']));
  f.footer('Gute Reise!', 'Seite 1 von 1');
  return [page('#ffffff', f.done('pack klassisch'), 'Packliste')];
}

function modern() {
  const st = makeStyle('modern', '#0891b2');
  const f = flow(st, 210, 297);
  f.header('Packliste', { compact: true });
  f.rows(WHO, { pitch: 17.5 });
  const gap = 5;
  const cw = (f.w - 2 * gap) / 3;
  const ch = 108;
  Object.keys(G).forEach((n, i) => {
    const g = G[n];
    const x = f.x + (i % 3) * (cw + gap);
    const y = f.y + Math.floor(i / 3) * (ch + 4);
    f.add(rect('Karte ' + n, x, y, cw, ch, '#ffffff', { stroke: '#c9d6dc', sw: 0.5, radius: 2 }));
    f.add(rect('Kartenkopf ' + n, x, y, cw, 9, st.tint2, { radius: 2, locked: true }), rect('Kartenkopf unten ' + n, x, y + 5, cw, 4, st.tint2, { locked: true }), icon('Symbol ' + n, g.icon, x + 3, y + 2, 5, st.deep, 2, { locked: true }), text('Karte Titel ' + n, x + 10, y, cw - 12, 9, n, { f: st.head, s: 10.5, w: 700, c: st.deep, min: 7 }));
    const all = [...g.items, ...Array(11 - g.items.length).fill('')];
    all.slice(0, 11).forEach((it, k) => {
      const ky = y + 11.5 + k * 8.5;
      f.add(tick(st, n + ' ' + k, x + 3, ky + 1, 4.2));
      if (it) f.add(text('Punkt ' + it, x + 10, ky, cw - 13, 6.2, it, { f: st.lab, s: 8.8, c: st.ink, min: 6 }));
      else f.add(line('Freizeile ' + n + k, x + 10, ky + 5.4, x + cw - 3, ky + 5.4, '#c4c4c4', 0.35));
    });
  });
  f.y += 2 * ch + 4;
  return [page('#ffffff', f.done('pack modern'), 'Packliste')];
}

function minimal() {
  const st = makeStyle('minimal', '#a16207', { font: 'light' });
  const f = flow(st, 210, 297);
  f.header('Packliste', { compact: true });
  f.rows(WHO, { gap: 8, pitch: 14.5 });
  f.gap(2);
  const gap = 12;
  const cw = (f.w - gap) / 2;
  const col = (s, names) => names.forEach(n => {
    const g = G[n];
    s.add(text('Gruppe ' + n, s.x, s.y, s.w, 4.5, n, { f: st.lab, s: 8.5, w: 700, c: st.accent, up: true, ls: 0.14, v: 'top', min: 6 }), line('Gruppenlinie ' + n, s.x, s.y + 5.4, s.x + s.w, s.y + 5.4, st.ink, 0.5));
    s.y += 7.5;
    [...g.items.slice(0, 5), ...Array(Math.max(1, g.blank - 1)).fill('')].forEach((it, k) => {
      s.add(tick(st, n + ' ' + k, s.x, s.y + 1.2, 4.2));
      if (it) s.add(text('Punkt ' + it, s.x + 7, s.y, s.w - 7, 6.4, it, { f: st.lab, s: 9.5, c: st.ink, min: 7 }));
      else s.add(line('Freizeile ' + n + k, s.x + 7, s.y + 5.6, s.x + s.w, s.y + 5.6, '#b5b5b5', 0.4));
      s.y += 8;
    });
    s.gap(5);
  });
  f.cols([cw, cw], gap, (i, s) => col(s, i === 0 ? ['Dokumente', 'Kleidung', 'Hygiene'] : ['Technik', 'Gesundheit', 'Sonstiges']));
  return [page('#ffffff', f.done('pack minimal'), 'Packliste')];
}

module.exports = family({
  nameBase: 'Packliste',
  category: 'Planer',
  family: 'packliste',
  familyName: 'Packliste',
  occasion: 'Formulare & Planer',
  tags: ['Packliste', 'Urlaub', 'Reise', 'Koffer', 'Checkliste', 'Reisevorbereitung', 'Ferien', 'Gepäck', 'Planer'],
  formatKey: 'a4-portrait',
  width: 210,
  height: 297,
  fields: [field('Reiseziel', 'Reiseziel', 'text', 'Südtirol'), field('Reisezeit', 'Reisezeit', 'text', '12.–26. Juli 2027')],
  sampleRows: [{ Reiseziel: 'Südtirol', Reisezeit: '12.–26. Juli 2027' }, { Reiseziel: 'Rundreise durch Schottland und Irland', Reisezeit: '3. bis 24. August 2027' }, { Reiseziel: '', Reisezeit: '' }],
}, [
  {
    slug: 'packliste-klassisch', variant: 'Klassisch',
    description: 'Packliste für den Urlaub (A4): Dokumente, Kleidung, Hygiene, Technik, Gesundheit und Sonstiges mit vorgeschlagenen Punkten und freien Zeilen. Reiseziel und Reisezeit sind Felder; Serifenschrift.',
    tags: ['klassisch', 'Serifen', 'zwei Spalten'], pages: klassisch,
  },
  {
    slug: 'packliste-modern', variant: 'Modern',
    description: 'Packliste (A4) als sechs Karten mit Symbolen für Dokumente, Kleidung, Hygiene, Technik, Gesundheit und Sonstiges, je elf Zeilen zum Abhaken. Reiseziel und Reisezeit sind Felder; Akzent in Türkis.',
    tags: ['modern', 'Karten', 'Symbole'], pages: modern,
  },
  {
    slug: 'packliste-minimal', variant: 'Minimal',
    description: 'Packliste (A4) in zwei ruhigen Spalten: Gruppen mit feiner Linie, runde Auswahlkreise, helle Schrift und viel Weißraum. Reiseziel und Reisezeit sind Felder.',
    tags: ['minimal', 'hell', 'schlicht'], pages: minimal,
  },
]);
