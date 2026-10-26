'use strict';
const { make, S } = require('./_v3-lib');
const meta = { family: 'hochzeitstag-karte', familyName: 'Karte zum Hochzeitstag', occasion: 'Hochzeit', tags: ['Hochzeitstag', 'Jahrestag', 'Ehe', 'Glückwunsch', 'Paar', 'Liebe', 'Karte'] };

const elegant = make(meta, {
  layout: 'frame', slug: 'hochzeitstag-elegant', variant: 'Elegant',
  desc: 'Klappkarte A6 zum Hochzeitstag: Goldrahmen, ein Paar Eheringe und „Alles Liebe zum Hochzeitstag“ in Schreibschrift. Innen Platz für deine Glückwünsche.',
  tags: ['elegant', 'Gold', 'Eheringe', 'Klappkarte', 'Silberhochzeit', 'Goldene Hochzeit'],
  bg: '#fbf7ee', accent: '#c9a04e', soft: '#f1e3bf', frame: 'deko-rahmen-doppellinie-hoch-gold', motif: 'deko-motive-eheringe-gold', motif2: 'deko-motive-eheringe-gold',
  kicker: 'FÜR EUCH BEIDE', foot: 'in Liebe und Dankbarkeit', ty: 78,
  k: S('Raleway', 8, '#a9822f', { w: 600, up: true, ls: 0.25 }),
  t: [S('Great Vibes', 30, '#a9822f', { lh: 1.25 }), S('Great Vibes', 24, '#6b5326', { lh: 1.25 })],
  title: ['Alles Liebe', 'zum Hochzeitstag'],
  head: 'Liebe Anna, lieber Jonas,', h: S('Great Vibes', 24, '#a9822f'),
  body: 'zu eurem Hochzeitstag wünschen wir euch von Herzen alles Liebe. Möge eure Liebe jeden Tag ein bisschen wachsen und euch noch viele gemeinsame Jahre voller Glück und Lachen schenken.',
  b: S('Cormorant Garamond', 12.5, '#4a3f2a', { w: 500, lh: 1.5 }), sign: 'Eure Lena', g: S('Great Vibes', 22, '#a9822f'),
});

const modern = make(meta, {
  layout: 'post', slug: 'hochzeitstag-modern', variant: 'Modern',
  desc: 'Moderne Postkarte A6 quer zum Hochzeitstag: navyblaue Fläche mit Sektgläsern, kräftige Schrift „Auf euch!“ und eine Rückseite mit Platz für Gruß, Briefmarke und Adresse.',
  tags: ['modern', 'Postkarte', 'Sektgläser', 'Anstoßen', 'Prost', 'navy', 'Jubiläum'],
  bg: '#fbf6ee', accent: '#1f2f5c', soft: '#f6e6c3', motif: 'deko-motive-sektglaeser-pastell', motif2: 'deko-motive-sektglaeser-pastell',
  kicker: 'HOCHZEITSTAG', foot: 'Alles Liebe für euch beide', ty: 30,
  k: S('Poppins', 8, '#a9822f', { w: 600, up: true, ls: 0.2 }),
  t: [S('Poppins', 26, '#1f2f5c', { w: 700, lh: 1.15 }), S('Poppins', 12, '#1f2f5c', { w: 500, lh: 1.3 })],
  title: ['Auf euch!', 'Noch viele Jahre voller Liebe'],
  head: 'Ihr zwei,', h: S('Caveat', 20, '#1f2f5c', { w: 700 }),
  body: 'ein Jahr mehr, ein Grund mehr zu feiern. Danke, dass ihr uns zeigt, wie Liebe geht. Bleibt, wie ihr seid!', pbody: 'ein Jahr mehr, ein Grund mehr zu feiern. Danke, dass ihr zeigt, wie Liebe geht. Bleibt, wie ihr seid!',
  b: S('Poppins', 9, '#333a52', { w: 400 }), sign: 'Eure Lena', g: S('Caveat', 18, '#1f2f5c', { w: 700 }),
});

const humorvoll = make(meta, {
  layout: 'square', slug: 'hochzeitstag-humorvoll', variant: 'Humorvoll',
  desc: 'Verschmitzte Klappkarte (quadratisch) zum Hochzeitstag: ein großes Herz mit Pfeil und „Immer noch verknallt!“ in Handschrift. Innen eine freche Gratulation.',
  tags: ['lustig', 'witzig', 'humorvoll', 'Herz', 'Pfeil', 'verknallt', 'quadratisch', 'Klappkarte'],
  bg: '#ffe7e1', accent: '#e8505b', soft: '#ffffff', motif: 'deko-motive-herz-pfeil-bunt', motif2: 'deko-motive-herz-pfeil-bunt', pat: 'deko-muster-herzchen-rose', patOp: 0.35,
  kicker: 'ZUM HOCHZEITSTAG', foot: 'Auf die Liebe!', ty: 82, tilt: -6,
  k: S('Nunito', 8, '#b33a46', { w: 800, up: true, ls: 0.15 }),
  t: [S('Caveat', 34, '#d63e4c', { w: 700, lh: 1.05 }), S('Caveat', 34, '#d63e4c', { w: 700, lh: 1.05 })],
  title: ['Immer noch', 'verknallt!'],
  head: 'Ihr Turteltauben,', h: S('Caveat', 24, '#d63e4c', { w: 700 }),
  body: 'Streit um die Fernbedienung, Socken auf dem Boden und trotzdem Herzklopfen: So geht Ehe! Wir wünschen euch einen wundervollen Hochzeitstag und noch ganz viele Jahre zu zweit.',
  b: S('Nunito', 10.5, '#5a3238', { w: 500, lh: 1.5 }), sign: 'Eure Lena', g: S('Caveat', 24, '#d63e4c', { w: 700 }),
});

module.exports = { elegant, modern, humorvoll };
