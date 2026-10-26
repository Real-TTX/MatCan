'use strict';
const { make, S, pre } = require('./_v3-lib');
const meta = { family: 'geburtstag-maenner-karte', familyName: 'Geburtstagskarte für Männer', occasion: 'Geburtstag', tags: ['Geburtstag', 'Männer', 'Mann', 'Papa', 'Bruder', 'Freund', 'Glückwunsch', 'Karte', 'Bier'] };
const texts = {
  head: 'Lieber Thomas,', sign: 'Dein Bruder',
  body: 'alles Gute zum Geburtstag! Ein Jahr mehr auf dem Tacho, aber noch lange kein Fall für die Werkstatt. Wir wünschen dir Gesundheit, Zeit für deine Hobbys und immer ein kühles Getränk in Reichweite. Lass es krachen!',
};

const prost = make(meta, Object.assign({
  pre: pre.bold('#ffffff', '#f2b134', 'Oswald', '#2b2f3a'),
  layout: 'block', slug: 'geburtstag-maenner-prost', variant: 'Prost',
  desc: 'Kernige Klappkarte A6 für Männer zum Geburtstag: anthrazitfarbene Fläche, ein Bierkrug im Kreis und „Prost, alter Junge!“ in Versalien. Innen eine farbige Seite.',
  tags: ['Prost', 'Bierkrug', 'anthrazit', 'Klappkarte', 'Stammtisch', 'Feierabend'],
  accent: '#2f3440', soft: '#f2b134', motif: 'deko-motive-bierkrug-bunt', kicker: 'ZUM GEBURTSTAG', foot: 'Auf die nächste Runde', ty: 94, title: ['PROST,', 'ALTER JUNGE!'],
}, texts));

const klassisch = make(meta, Object.assign({
  pre: pre.elegant('#26303f', '#8a6a2e', 'Cinzel', '#2c3340'),
  layout: 'frame', slug: 'geburtstag-maenner-klassisch', variant: 'Klassisch',
  desc: 'Klappkarte A6 für Männer zum Geburtstag: dunkler Doppelrahmen, ein Kompass und „Alles Gute zum Geburtstag“ in Antiqua-Kapitalen. Innen Platz für deine Zeilen.',
  tags: ['klassisch', 'Kompass', 'Klappkarte', 'Herr', 'edel', 'gold'],
  bg: '#f6f4ee', accent: '#8a6a2e', soft: '#e6dfcc', frame: 'deko-rahmen-doppellinie-hoch-schwarz', motif: 'deko-motive-kompass-boho',
  kicker: 'FÜR DICH', foot: 'Auf alle Wege, die noch kommen', ty: 80, title: ['Alles Gute', 'zum Geburtstag'],
  t: [S('Cinzel', 20, '#26303f', { w: 700, lh: 1.25, ls: 0.04 })],
  h: S('Cinzel', 15, '#26303f', { w: 700 }), g: S('Cormorant Garamond', 20, '#8a6a2e', { w: 700, i: true }),
}, texts));

const pokal = make(meta, Object.assign({
  pre: pre.fun('#2f6fa8', '#2a3340'),
  layout: 'square', slug: 'geburtstag-maenner-pokal', variant: 'Champion',
  desc: 'Humorvolle quadratische Klappkarte für Männer: ein goldener Pokal und „Ein Jahr älter, ein Jahr legendärer!“ in Handschrift. Innen ein kerniger Glückwunsch.',
  tags: ['Pokal', 'Champion', 'legendär', 'quadratisch', 'Klappkarte', 'lustig'],
  bg: '#e8f0f8', accent: '#2f6fa8', soft: '#ffffff', motif: 'deko-motive-siegerpokal-gold', motif2: 'deko-motive-bierkrug-boho', pat: 'deko-muster-karo-navy', patOp: 0.12,
  kicker: 'ZUM GEBURTSTAG', foot: 'Du alter Held!', ty: 80, tilt: 0, title: ['Ein Jahr älter,', 'ein Jahr legendärer!'],
}, texts));

module.exports = { prost, klassisch, pokal };
