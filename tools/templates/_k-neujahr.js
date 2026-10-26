'use strict';
const L = require('./_t2a-lib');
const { text, rect, ellipse, line, icon, shape, page, ctext, divider, dk, dekoIn, tpl, gradient, shadow } = L;

const META = { family: 'neujahrskarte', familyName: 'Neujahrskarte', occasion: 'Feiertage' };

// ---------------------------------------------------------------------------------------------------------------------------- Feuerwerk
const GOLD = '#e8c46a';
const feuerwerk = tpl(Object.assign({}, META, {
  slug: 'neujahrskarte-feuerwerk',
  name: 'Neujahrskarte A6 quer – Feuerwerk',
  description: 'Festliche Neujahrskarte im Format A6 quer: nachtblauer Himmel mit goldenen Feuerwerksblüten, „Prosit Neujahr“ in Schreibschrift und die Jahreszahl groß darunter. Innen Platz für deine Wünsche.',
  variant: 'Feuerwerk',
  tags: ['Neujahr', 'Silvester', 'Feuerwerk', 'Prosit', '2027', 'Gold', 'Nachthimmel', 'Neujahrskarte', 'Karte', 'guten Rutsch'],
  formatKey: 'a6-landscape', width: 148, height: 105,
  pages: [
    page(gradient(180, '#0b1230', '#1d2b66'), [
      dk('Feuerwerk 1', 'deko-sterne-strahlen-gold', -8, -12, 62),
      dk('Feuerwerk 2', 'deko-sterne-strahlen-gold', 104, 4, 46),
      dk('Feuerwerk 3', 'deko-sterne-strahlen-gold', 112, 62, 34, undefined, { opacity: 0.8 }),
      dk('Funkeln', 'deko-sterne-funkeln-gold', 14, 70, 20),
      ctext('Prosit', 74, 24, 100, 24, 'Prosit', { f: 'Great Vibes', s: 44, c: '#ffffff', min: 20 }),
      ctext('Neujahr', 74, 40, 110, 22, 'Neujahr!', { f: 'Great Vibes', s: 50, c: GOLD, min: 22 }),
      ctext('Jahr', 74, 68, 100, 18, '2027', { f: 'Cinzel', s: 34, w: 500, c: '#ffffff', ls: 0.3, lh: 1, min: 16 }),
      divider('Trenner', 74, 91, 36, GOLD),
    ], 'Vorderseite'),
    page('#fbf6ea', [
      dk('Funkeln innen', 'deko-sterne-funkeln-gold', 118, 10, 18),
      text('Anrede', 20, 18, 100, 11, 'Liebe Freunde,', { f: 'Cormorant Garamond', s: 20, w: 600, i: true, c: '#16213e', min: 10 }),
      text('Text', 20, 32, 106, 42, 'wir wünschen euch einen fröhlichen Jahreswechsel und ein neues Jahr voller Gesundheit, Glück und schöner Begegnungen. Auf ein Wiedersehen in 2027!', { f: 'Cormorant Garamond', s: 14.5, w: 500, c: '#16213e', v: 'top', wrap: true, lh: 1.4, min: 9 }),
      text('Gruß', 20, 80, 108, 10, 'Eure Familie Roth', { f: 'Cormorant Garamond', s: 17, w: 600, i: true, c: '#a8822f', a: 'right', min: 9 }),
      line('Linie', 20, 94, 128, 94, GOLD, 0.25, { locked: true }),
    ], 'Innenseite'),
  ],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Glücksbringer
const GREEN = '#2e7d4f';
const gluecksbringer = tpl(Object.assign({}, META, {
  slug: 'neujahrskarte-gluecksbringer',
  name: 'Neujahrskarte A6 hoch – Glücksbringer',
  description: 'Freundliche Neujahrskarte im Format A6 hoch: Glücksklee, Glücksschwein und Sterne auf Mintgrün, „Viel Glück im neuen Jahr“ in runder Schrift. Innen Platz für Wünsche an Kollegen, Kunden und Nachbarn.',
  variant: 'Glücksbringer',
  tags: ['Neujahr', 'Silvester', 'Glücksklee', 'Glücksschwein', 'Glück', '2027', 'Neujahrskarte', 'Karte', 'freundlich', 'Kunden'],
  formatKey: 'a6-portrait', width: 105, height: 148,
  pages: [
    page('#e3f4e6', [
      ellipse('Scheibe', 12, 18, 81, 81, '#ffffff', { locked: true }),
      icon('Klee', 'clover', 22, 28, 61, GREEN, 1.4),
      shape('star', 'Stern 1', 78, 18, 10, 10, '#f4b942', { points: 5, inner: 0.45, rotation: 12, locked: true }),
      shape('star', 'Stern 2', 14, 22, 7, 7, '#f4b942', { points: 5, inner: 0.45, rotation: -10, locked: true }),
      shape('star', 'Stern 3', 86, 86, 6, 6, '#e87a8a', { points: 5, inner: 0.45, locked: true }),
      icon('Schwein', 'piggy-bank', 12, 124, 16, '#e87a8a', 1.6),
      ctext('Viel Glück', 52.5, 102, 92, 20, 'Viel Glück', { f: 'Fredoka', s: 30, w: 700, c: GREEN, lh: 1, min: 14 }),
      text('Neues Jahr', 32, 123, 64, 10, 'im neuen Jahr 2027', { f: 'Fredoka', s: 13, w: 500, c: '#35404a', min: 8 }),
    ], 'Vorderseite'),
    page('#ffffff', [
      rect('Band', 0, 0, 105, 7, GREEN, { locked: true }),
      icon('Klee', 'clover', 76, 14, 14, GREEN, 1.8),
      text('Anrede', 14, 30, 60, 11, 'Liebe Frau Keller,', { f: 'Fredoka', s: 14, w: 600, c: GREEN, min: 8 }),
      text('Text', 14, 45, 77, 62, 'zum Jahreswechsel danken wir Ihnen für das Vertrauen im vergangenen Jahr und wünschen Ihnen Glück, Gesundheit und Erfolg für 2027.', { f: 'Nunito', s: 11, w: 500, c: '#35404a', v: 'top', wrap: true, lh: 1.55, min: 8 }),
      text('Gruß', 14, 114, 77, 14, 'Ihr Team von\nMeier & Söhne', { f: 'Fredoka', s: 12, w: 600, c: '#e87a8a', a: 'right', wrap: true, lh: 1.2, min: 8 }),
    ], 'Innenseite'),
  ],
}));

// ---------------------------------------------------------------------------------------------------------------------------- Jahreszahl
const jahreszahl = tpl(Object.assign({}, META, {
  slug: 'neujahrskarte-jahreszahl',
  name: 'Neujahrskarte A6 quer – Jahreszahl',
  description: 'Plakative Neujahrskarte im Format A6 quer: die Jahreszahl 2027 in riesigen Ziffern auf Schwarz mit gelbem Konfettiband und „Happy New Year“ in schlanker Schrift. Innen schlicht in Schwarz und Weiß.',
  variant: 'Jahreszahl',
  tags: ['Neujahr', 'Silvester', '2027', 'Happy New Year', 'modern', 'Typografie', 'schwarz', 'gelb', 'Neujahrskarte', 'Karte'],
  formatKey: 'a6-landscape', width: 148, height: 105,
  pages: [
    page('#141414', [
      rect('Band', 0, 80, 148, 25, '#ffd23f', { locked: true }),
      dk('Konfetti', 'deko-konfetti-streuung-gold', 70, 0, 78, 78, { opacity: 0.5 }),
      ctext('Zahl', 74, 6, 138, 70, '2027', { f: 'Anton', s: 126, c: '#ffffff', lh: 1, min: 50, ls: 0.02 }),
      ctext('Zeile', 74, 85, 120, 8, 'Happy New Year', { f: 'Montserrat', s: 14, w: 800, c: '#141414', up: true, ls: 0.3, min: 8 }),
      ctext('Zeile 2', 74, 94, 120, 6, 'Auf ein gutes Jahr', { f: 'Montserrat', s: 7, w: 500, c: '#141414', up: true, ls: 0.3, min: 5 }),
    ], 'Vorderseite'),
    page('#ffffff', [
      text('Zahl', 12, 8, 60, 30, '2027', { f: 'Anton', s: 50, c: '#ffd23f', lh: 1, min: 20, background: undefined }),
      rect('Balken', 12, 36, 20, 1.6, '#141414', { locked: true }),
      text('Anrede', 12, 44, 124, 10, 'Hallo Jana,', { f: 'Montserrat', s: 14, w: 800, c: '#141414', min: 8 }),
      text('Text', 12, 56, 124, 28, 'ein neues Jahr, neue Pläne, neue Chancen. Ich wünsche dir, dass sich möglichst viele deiner Vorsätze erfüllen – und die anderen vergisst du einfach.', { f: 'Montserrat', s: 9.5, w: 400, c: '#141414', v: 'top', wrap: true, lh: 1.55, min: 7 }),
      text('Gruß', 12, 90, 124, 8, 'Prost, dein Ben', { f: 'Montserrat', s: 10, w: 700, c: '#141414', a: 'right', min: 6 }),
    ], 'Innenseite'),
  ],
}));

module.exports = { feuerwerk, gluecksbringer, jahreszahl };
