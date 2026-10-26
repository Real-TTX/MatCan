'use strict';
const { text, rect, ellipse, line, icon, deko, page } = require('./dsl');
const { family } = require('./_t3b-lib');
const { menuBlock } = require('./_t3b-menu');

const common = {
  no: 422, category: 'Karten', family: 'speisekarte-dl', familyName: 'Speisekarte DIN lang', occasion: 'Gastronomie',
  tags: ['Speisekarte', 'Menükarte', 'Restaurant', 'Café', 'Gastronomie', 'Karte', 'Getränke', 'DIN lang', 'Preisliste'],
  formatKey: 'menu-dl', width: 99, height: 210,
};

// ------------------------------------------------------------------ Klassisch: zentriert, Antiqua, Gold
const GOLD = '#a8832f';
const INK = '#2b2a33';
const klassisch = {
  slug: 'speisekarte-dl-klassisch', name: 'Speisekarte DIN lang – Klassisch', variant: 'Klassisch',
  description: 'Klassische Speisekarte im Format DIN lang (99 × 210 mm): zentriert gesetzt in Antiqua auf Elfenbein mit Goldrahmen und Schnörkeln, Vorspeisen, Hauptgerichte, Desserts und Getränke mit Beschreibung und Preis. Gerichte und Preise überschreibst du direkt.',
  tags: ['Klassisch', 'Elegant', 'Gold', 'Antiqua', 'Fine Dining', 'Zentriert'],
  pages: (() => {
    const m = menuBlock({
      x: 11, y: 50, w: 77,
      st: {
        center: true, inline: true, gap: 1.8, after: 1.2, nameH: 4.4, descH: 3.6,
        name: { f: 'Cormorant Garamond', s: 10.5, w: 700, c: INK }, desc: { f: 'Cormorant Garamond', s: 8.5, c: '#6c6a73', i: true, w: 500 }, price: { f: 'Cormorant Garamond', s: 10, w: 700, c: GOLD },
        head: (x, y, w, t) => ({ h: 8.6, els: [text(t, x, y, w, 5, t, { f: 'Cinzel', s: 8.5, w: 600, c: GOLD, a: 'center', ls: 0.2, min: 6 }), line(t + ' Linie', x + w / 2 - 6, y + 6.2, x + w / 2 + 6, y + 6.2, GOLD, 0.3)] }),
      },
    });
    return [page('#fbf6ea', [
      rect('Rahmen außen', 4, 4, 91, 202, null, { stroke: GOLD, sw: 0.6, locked: true }),
      rect('Rahmen innen', 5.4, 5.4, 88.2, 199.2, null, { stroke: GOLD, sw: 0.2, locked: true }),
      text('Titel', 10, 12, 79, 11, 'Speisekarte', { f: 'Cormorant Garamond', s: 28, w: 600, c: INK, a: 'center', min: 14 }),
      deko('Schnörkel', 'deko-ornamente-schnoerkel-breit-gold', 29.5, 24.4, 40, undefined, { locked: true }),
      text('Untertitel', 10, 38, 79, 5, 'Restaurant Wiesengrund', { f: 'Raleway', s: 7.5, w: 600, c: GOLD, a: 'center', up: true, ls: 0.24, min: 6 }),
      ...m.els,
      text('Fuß', 10, 191, 79, 8, 'Alle Preise inklusive Mehrwertsteuer.\nFragen Sie nach Allergenen.', { f: 'Cormorant Garamond', s: 8, i: true, c: '#6c6a73', a: 'center', v: 'top', wrap: true, lh: 1.35, min: 6 }),
    ])];
  })(),
};

// ------------------------------------------------------------------ Modern: linksbündig, Farbkopf, dünne Linien
const TEAL = '#0e6f6a';
const modern = {
  slug: 'speisekarte-dl-modern', name: 'Speisekarte DIN lang – Modern', variant: 'Modern',
  description: 'Moderne Speisekarte im Format DIN lang (99 × 210 mm): farbiger Kopf mit Titel, linksbündige Gerichte in klarer Schrift mit Preisen rechts und feinen Linien, Abschnitte als Farbmarken. Gerichte und Preise überschreibst du direkt.',
  tags: ['Modern', 'Klar', 'Türkis', 'Bistro', 'Imbiss', 'Linksbündig', 'Poppins'],
  pages: (() => {
    const m = menuBlock({
      x: 10, y: 52, w: 79,
      st: {
        gap: 2.6, after: 1, nameH: 4.8, descH: 3.8, rule: '#dfe9e8', priceW: 17,
        name: { f: 'Poppins', s: 9, w: 600, c: '#0f2a2a' }, desc: { f: 'Poppins', s: 7, c: '#6a7b7a', w: 400 }, price: { f: 'Poppins', s: 9, w: 600, c: TEAL },
        head: (x, y, w, t) => ({ h: 8.4, els: [rect(t + ' Marke', x, y + 1.2, 1.6, 4.4, TEAL), text(t, x + 4, y, w - 4, 6.6, t, { f: 'Poppins', s: 10.5, w: 700, c: TEAL, up: true, ls: 0.08, min: 7 })] }),
      },
    });
    return [page('#ffffff', [
      rect('Kopf', 0, 0, 99, 40, TEAL, { locked: true }),
      ellipse('Kreis', 66, -14, 50, 50, '#ffffff', { opacity: 0.1, locked: true }),
      text('Titel', 10, 11, 79, 12, 'Speisekarte', { f: 'Poppins', s: 24, w: 800, c: '#ffffff', min: 14 }),
      text('Untertitel', 10, 24, 79, 5, 'Restaurant Wiesengrund', { f: 'Poppins', s: 8.5, w: 500, c: '#bfe6e2', min: 6 }),
      ...m.els,
      text('Fuß', 10, 192, 79, 8, 'Alle Preise inkl. MwSt. · Allergene auf Anfrage', { f: 'Poppins', s: 6.5, c: '#6a7b7a', v: 'top', wrap: true, lh: 1.4, min: 5.5 }),
    ])];
  })(),
};

// ------------------------------------------------------------------ Tafel: dunkelgrün, Kreide, Handschrift
const CHALK = '#f5f1e6';
const tafel = {
  slug: 'speisekarte-dl-tafel', name: 'Speisekarte DIN lang – Kreidetafel', variant: 'Kreidetafel',
  description: 'Speisekarte im Kreidetafel-Look für Café, Biergarten und Imbiss im Format DIN lang (99 × 210 mm): dunkelgrüner Grund, Überschriften in Handschrift, Kreidelinien und Sternchen. Gerichte und Preise überschreibst du direkt.',
  tags: ['Kreidetafel', 'Rustikal', 'Café', 'Biergarten', 'Handschrift', 'Tafel', 'Gemütlich'],
  pages: (() => {
    const m = menuBlock({
      x: 11, y: 44, w: 77,
      st: {
        gap: 2.6, after: 1.4, nameH: 4.8, descH: 3.8, priceW: 16,
        name: { f: 'Patrick Hand', s: 11.5, c: CHALK }, desc: { f: 'Patrick Hand', s: 8.5, c: '#a9d3b9' }, price: { f: 'Patrick Hand', s: 11.5, c: '#ffd46b' },
        head: (x, y, w, t) => ({ h: 9.4, els: [text(t, x, y, w, 7.2, t, { f: 'Amatic SC', s: 22, w: 700, c: '#ffd46b', up: true, ls: 0.06, min: 12 }), line(t + ' Linie', x, y + 7.8, x + w, y + 7.8, CHALK, 0.3, { dash: 'dotted', opacity: 0.55 })] }),
      },
    });
    return [page('#1f4435', [
      rect('Kreiderahmen', 4, 4, 91, 202, null, { stroke: CHALK, sw: 0.6, radius: 3, opacity: 0.5, locked: true }),
      text('Titel', 10, 10, 79, 16, 'Heute auf der Karte', { f: 'Amatic SC', s: 40, w: 700, c: CHALK, a: 'center', min: 20 }),
      text('Untertitel', 10, 27, 79, 6, 'Zum Wiesengrund · frisch und regional', { f: 'Patrick Hand', s: 10, c: '#a9d3b9', a: 'center', min: 7 }),
      deko('Trenner', 'deko-trenner-sterne-weiss', 24.5, 34.6, 50, undefined, { opacity: 0.7, locked: true }),
      ...m.els,
      text('Fuß', 10, 190, 79, 10, 'Alle Preise inklusive Mehrwertsteuer.\nFragt uns nach Allergenen!', { f: 'Patrick Hand', s: 9, c: '#a9d3b9', a: 'center', v: 'top', wrap: true, lh: 1.3, min: 6 }),
    ])];
  })(),
};

module.exports = family(common, [klassisch, modern, tafel]);
