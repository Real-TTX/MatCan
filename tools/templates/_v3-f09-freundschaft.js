'use strict';
const { make, S, pre } = require('./_v3-lib');
const meta = { family: 'freundschaft-karte', familyName: 'Karte für Freunde', occasion: 'Feste & Events', tags: ['Freundschaft', 'Freund', 'Freundin', 'Danke', 'Beste Freunde', 'Herzensmensch', 'Karte'] };
const texts = {
  head: 'Liebe Mia,', sign: 'Deine Johanna',
  body: 'gute Freunde sind wie Sterne: Man sieht sie nicht immer, aber man weiß, dass sie da sind. Danke, dass du mir zuhörst, mich zum Lachen bringst und einfach da bist. Ich bin so froh, dass es dich gibt!',
};

const herzlich = make(meta, Object.assign({
  pre: pre.elegant('#34624a', '#5d8d6e', 'Dancing Script', '#34413a'),
  layout: 'frame', slug: 'freundschaft-herzlich', variant: 'Herzlich',
  desc: 'Klappkarte A6 für Freunde: Rahmen aus Ranken in Salbei, ein Kleeblatt als Glücksbringer und „Für dich, mein Herzensmensch“ in lebendiger Schrift.',
  tags: ['herzlich', 'Kleeblatt', 'Glück', 'Klappkarte', 'Salbei', 'Herzensmensch'],
  bg: '#f6f8f1', accent: '#5d8d6e', soft: '#dfeadb', frame: 'deko-rahmen-ranke-hoch-salbei', motif: 'deko-motive-kleeblatt-pastell',
  kicker: 'FREUNDSCHAFT', foot: 'Schön, dass es dich gibt', ty: 78, title: ['Für dich,', 'mein Herzensmensch'],
  t: [S('Dancing Script', 30, '#5d8d6e', { w: 700, lh: 1.25 }), S('Dancing Script', 23, '#34624a', { w: 700, lh: 1.25 })],
  h: S('Dancing Script', 24, '#5d8d6e', { w: 700 }), g: S('Dancing Script', 22, '#5d8d6e', { w: 700 }),
}, texts));

const modern = make(meta, Object.assign({
  pre: pre.modern('#2b2b3d', '#e8505b'),
  layout: 'post', slug: 'freundschaft-modern', variant: 'Modern',
  desc: 'Moderne Postkarte A6 quer für Freunde: kräftige Farbfläche mit zwei Kaffeepausen im Kreis und „Beste Freunde“ in klarer Schrift. Rückseite für Gruß und Adresse.',
  tags: ['modern', 'Kaffee', 'Postkarte', 'Beste Freunde', 'Kaffeepause'],
  bg: '#fff6ef', accent: '#e8505b', soft: '#ffe0d6', motif: 'deko-motive-kaffeetasse-bunt', kicker: 'FREUNDSCHAFT', foot: 'Kaffee? Bin dabei.', ty: 33, title: ['Beste', 'Freunde'],
}, texts, { pbody: 'gute Freunde sind wie Sterne: Man sieht sie nicht immer, aber sie sind da. Danke, dass du mein Leben so viel schöner machst.' }));

const humorvoll = make(meta, Object.assign({
  pre: pre.fun('#f07b1a', '#40362a'),
  layout: 'square', slug: 'freundschaft-humorvoll', variant: 'Humorvoll',
  desc: 'Bunte quadratische Klappkarte für Freunde: eine strahlende Sonne mit Sonnenbrille und „Danke, dass es dich gibt!“ in Handschrift. Innen ein warmer, frecher Gruß.',
  tags: ['lustig', 'witzig', 'Sonne', 'Sonnenbrille', 'quadratisch', 'Klappkarte', 'Danke'],
  bg: '#fff0d4', accent: '#f07b1a', soft: '#ffffff', motif: 'deko-motive-sonne-brille-bunt', motif2: 'deko-motive-kleeblatt-bunt', pat: 'deko-muster-konfettipunkte-bunt', patOp: 0.35,
  kicker: 'FREUNDSCHAFT', foot: 'Du bist der Hammer!', ty: 80, tilt: 4, title: ['Danke, dass', 'es dich gibt!'],
}, texts));

module.exports = { herzlich, modern, humorvoll };
