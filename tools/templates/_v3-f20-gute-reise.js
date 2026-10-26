'use strict';
const { make, S, pre } = require('./_v3-lib');
const meta = { family: 'gute-reise-karte', familyName: 'Karte „Gute Reise“', occasion: 'Feste & Events', tags: ['Gute Reise', 'Reise', 'Urlaub', 'Abschied', 'Auslandsjahr', 'Auswandern', 'Bon Voyage', 'Karte'] };
const texts = {
  head: 'Liebe Clara,', sign: 'Deine Freunde',
  body: 'wir wünschen dir eine wunderbare Reise! Genieße jeden Moment, sammle viele Eindrücke und komm gesund zurück. Wir freuen uns schon auf deine Geschichten und die Fotos. Pass auf dich auf!',
};

const modern = make(meta, Object.assign({
  pre: pre.modern('#16406a', '#2f86d6'),
  layout: 'post', slug: 'gute-reise-modern', variant: 'Modern',
  desc: 'Moderne Postkarte A6 quer „Gute Reise“: blaue Fläche, ein Papierflieger im Kreis und „Gute Reise!“ in klarer Schrift. Die Rückseite hat Platz für Gruß und Adresse.',
  tags: ['modern', 'Papierflieger', 'Postkarte', 'blau', 'Flug', 'Abenteuer'],
  bg: '#f2f8fe', accent: '#2f86d6', soft: '#dcecfb', motif: 'deko-motive-papierflieger-bunt', kicker: 'BON VOYAGE', foot: 'Wir sehen uns bald wieder', ty: 34, title: ['Gute', 'Reise!'],
}, texts, { pbody: 'wir wünschen dir eine wunderbare Reise! Genieße jeden Moment und komm gesund zurück.' }));

const klassisch = make(meta, Object.assign({
  pre: pre.elegant('#3a4a66', '#9a7a3e', 'Parisienne', '#2f3646'),
  layout: 'frame', slug: 'gute-reise-klassisch', variant: 'Klassisch',
  desc: 'Klappkarte A6 „Gute Reise“: Doppelrahmen in Navy, ein Kompass und „Bon Voyage“ in Schreibschrift. Innen Platz für Wünsche an die Reisende oder den Reisenden.',
  tags: ['klassisch', 'Kompass', 'Bon Voyage', 'Klappkarte', 'navy', 'Weltreise'],
  bg: '#f7f5ee', accent: '#9a7a3e', soft: '#e6dfcb', frame: 'deko-rahmen-doppellinie-hoch-navy', motif: 'deko-motive-kompass-boho',
  kicker: 'GUTE REISE', foot: 'Und komm gesund zurück', ty: 80, title: ['Bon Voyage'],
}, texts));

const humorvoll = make(meta, Object.assign({
  pre: pre.fun('#e8505b', '#40343a'),
  layout: 'square', slug: 'gute-reise-humorvoll', variant: 'Humorvoll',
  desc: 'Fröhliche quadratische Klappkarte „Gute Reise“: ein bunter Koffer und „Koffer gepackt? Dann kann’s losgehen!“ in Handschrift. Innen ein lustiger Reisegruß.',
  tags: ['lustig', 'Koffer', 'quadratisch', 'Klappkarte', 'Urlaub', 'Sonne'],
  bg: '#fff0d8', accent: '#e8505b', soft: '#ffffff', motif: 'deko-motive-koffer-bunt', motif2: 'deko-motive-papierflieger-bunt', pat: 'deko-muster-wolken', patOp: 0.5,
  kicker: 'GUTE REISE', foot: 'Vergiss die Sonnencreme nicht!', ty: 80, tilt: -4, title: ['Koffer gepackt?', 'Dann los!'],
  t: [S('Caveat', 34, '#e8505b', { w: 700, lh: 1.05 }), S('Caveat', 40, '#e8505b', { w: 700, lh: 1.05 })],
}, texts, { body: 'Hoffentlich passt alles in den Koffer, außer den Sorgen. Die bleiben zu Hause! Wir wünschen dir eine tolle Reise voller Sonne, Eis und schöner Momente.' }));

module.exports = { modern, klassisch, humorvoll };
