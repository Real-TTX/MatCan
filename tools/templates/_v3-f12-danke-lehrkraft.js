'use strict';
const { make, S, pre } = require('./_v3-lib');
const meta = { family: 'danke-lehrkraft-karte', familyName: 'Dankeskarte für Lehrkräfte und Erzieherinnen', occasion: 'Verein & Schule', tags: ['Danke', 'Lehrerin', 'Lehrer', 'Erzieherin', 'Erzieher', 'Kita', 'Schule', 'Abschied', 'Schuljahr', 'Dankeschön', 'Karte'] };
const texts = {
  head: 'Liebe Frau Weber,', sign: 'Eure Klasse 4b',
  body: 'vielen herzlichen Dank für Ihre Geduld, Ihre Begeisterung und Ihr offenes Ohr. Sie haben uns nicht nur Lesen, Schreiben und Rechnen beigebracht, sondern auch gezeigt, wie viel Spaß Lernen machen kann. Wir werden Sie vermissen!',
};

const klassisch = make(meta, Object.assign({
  pre: pre.elegant('#7a2d2d', '#b04545', 'Parisienne', '#40302f'),
  layout: 'frame', slug: 'danke-lehrkraft-klassisch', variant: 'Klassisch',
  desc: 'Klappkarte A6 als Dank an Lehrerin oder Lehrer: Rahmen mit Lorbeer, ein roter Apfel und „Danke für alles“ in Schreibschrift. Innen Platz für Worte der Klasse.',
  tags: ['klassisch', 'Apfel', 'Lehrerapfel', 'Klappkarte', 'Lorbeer', 'Schuljahresende'],
  bg: '#fbf6ee', accent: '#b04545', soft: '#f2dcd5', frame: 'deko-rahmen-doppellinie-hoch-gold', motif: 'deko-motive-apfel-bunt',
  kicker: 'EIN DANKESCHÖN', foot: 'Von der ganzen Klasse', ty: 78, title: ['Danke', 'für alles'],
}, texts));

const bunt = make(meta, Object.assign({
  pre: pre.bold('#ffffff', '#fff3d0', 'Montserrat', '#a33b3b'),
  layout: 'block', slug: 'danke-lehrkraft-bunt', variant: 'Bunt',
  desc: 'Bunte Klappkarte A6 als Dank an Lehrkräfte und Erzieherinnen: ein Bücherstapel im Kreis und „Danke, du bist die Beste“ in Versalien. Innen eine farbige Seite für Kinderwünsche.',
  tags: ['bunt', 'Bücher', 'Klappkarte', 'Kita', 'Grundschule', 'Danke'],
  accent: '#e8505b', soft: '#fff3d0', motif: 'deko-motive-buecherstapel-bunt', kicker: 'DANKE', foot: 'Für ein tolles Schuljahr', ty: 95, title: ['Du bist', 'die Beste!'],
}, texts));

const humorvoll = make(meta, Object.assign({
  pre: pre.fun('#2f8f5f', '#2f4038'),
  layout: 'post', slug: 'danke-lehrkraft-humorvoll', variant: 'Humorvoll',
  desc: 'Postkarte A6 quer für Erzieherinnen und Lehrkräfte: ein Apfel im Kreis und „Ein Apfel für die Lehrerin“ in Handschrift. Rückseite für Gruß und Unterschriften der Kinder.',
  tags: ['lustig', 'Apfel', 'Postkarte', 'Erzieherin', 'Handschrift', 'Kinder'],
  bg: '#f3faea', accent: '#2f8f5f', soft: '#ffffff', motif: 'deko-motive-apfel-pastell', kicker: 'DANKESCHÖN', foot: 'Von allen Kindern', ty: 30, title: ['Ein Apfel für', 'die Beste'],
  t: [S('Caveat', 38, '#2f8f5f', { w: 700, lh: 1.05 })],
}, texts, { pbody: 'danke für alles, was wir bei Ihnen lernen durften! Sie sind die beste Lehrerin der Welt.' }));

module.exports = { klassisch, bunt, humorvoll };
