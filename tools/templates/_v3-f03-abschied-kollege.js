'use strict';
const { make, S, pre } = require('./_v3-lib');
const meta = { family: 'abschied-kollege-karte', familyName: 'Abschiedskarte für Kollegen', occasion: 'Business', tags: ['Abschied', 'Kollege', 'Kollegin', 'Jobwechsel', 'Verabschiedung', 'Team', 'Büro', 'Karte'] };
const texts = {
  head: 'Liebe Katrin,', sign: 'Dein Team',
  body: 'schade, dass du gehst! Danke für jede Kaffeepause, jede Hilfe und jedes Lachen im Büro. Du wirst uns fehlen. Für deinen neuen Weg wünschen wir dir alles Gute und viel Erfolg. Melde dich bald!',
};

const modern = make(meta, Object.assign({
  pre: pre.modern('#7a3b2e', '#c0562b'),
  layout: 'post', slug: 'abschied-kollege-modern', variant: 'Modern',
  desc: 'Postkarte A6 quer zum Abschied von einer Kollegin oder einem Kollegen: terrakottafarbene Fläche mit Kaffeetasse, „Wir werden dich vermissen“ und eine Rückseite für Grüße der ganzen Abteilung.',
  tags: ['modern', 'Kaffeetasse', 'Postkarte', 'Teamgruß', 'terrakotta', 'vermissen'],
  bg: '#fbf4ea', accent: '#c0562b', soft: '#f7dcc4', motif: 'deko-motive-kaffeetasse-boho', kicker: 'ABSCHIED', foot: 'Alles Gute auf deinem neuen Weg', ty: 32,
  title: ['Wir werden', 'dich vermissen'],
}, texts));

const elegant = make(meta, Object.assign({
  pre: pre.elegant('#28365c', '#8a6f3d', 'Allura', '#2d3345'),
  layout: 'frame', slug: 'abschied-kollege-elegant', variant: 'Elegant',
  desc: 'Klappkarte A6 zum Abschied: marineblauer Rahmen, ein Papierflieger als Zeichen für den Aufbruch und „Alles Gute für deinen neuen Weg“ in feiner Schrift.',
  tags: ['elegant', 'Papierflieger', 'Aufbruch', 'Klappkarte', 'Neuanfang', 'navy', 'Glückwunsch'],
  bg: '#f8f6f1', accent: '#8a6f3d', soft: '#e7dfcf', frame: 'deko-rahmen-doppellinie-hoch-navy', motif: 'deko-motive-papierflieger-pastell',
  kicker: 'ZUM ABSCHIED', foot: 'Dein Team', ty: 78, title: ['Alles Gute', 'für deinen neuen Weg'],
}, texts));

const humorvoll = make(meta, Object.assign({
  pre: pre.fun('#2a9d8f', '#33403f'),
  layout: 'square', slug: 'abschied-kollege-humorvoll', variant: 'Humorvoll',
  desc: 'Freche quadratische Klappkarte zum Abschied: ein gepackter Umzugskarton und „Wer macht jetzt den Kaffee?“ in Handschrift. Innen ein augenzwinkernder Gruß.',
  tags: ['lustig', 'witzig', 'Umzugskarton', 'Kaffee', 'quadratisch', 'Klappkarte', 'Büro'],
  bg: '#e3f4f1', accent: '#2a9d8f', soft: '#ffffff', motif: 'deko-motive-umzugskarton-bunt', motif2: 'deko-motive-kaffeetasse-bunt', pat: 'deko-muster-konfettipunkte-pastell', patOp: 0.4,
  kicker: 'ZUM ABSCHIED', foot: 'Wir stoßen auf dich an!', ty: 80, tilt: -4, title: ['Wer macht jetzt', 'den Kaffee?'],
  head: 'Liebe Katrin,', sign: 'Dein Team',
  body: 'Der Schreibtisch ist leer, die Kaffeemaschine traurig. Danke für die tolle Zeit mit dir! Bleib so, wie du bist, und besuche uns bald. Wir halten dir einen Keks warm.',
}));

module.exports = { modern, elegant, humorvoll };
