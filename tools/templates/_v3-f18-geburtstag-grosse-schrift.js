'use strict';
const { make, S, pre } = require('./_v3-lib');
const meta = { family: 'geburtstag-grosse-schrift-karte', familyName: 'Geburtstagskarte 70, 80, 90 (große Schrift)', occasion: 'Geburtstag', tags: ['Geburtstag', 'Großeltern', 'Oma', 'Opa', 'große Schrift', 'gut lesbar', 'Glückwunsch', 'Karte', 'Runder Geburtstag'] };

const siebzig = make(meta, {
  pre: pre.elegant('#4a3a28', '#a9822f', 'Great Vibes', '#2f2a22'),
  layout: 'frame', slug: 'geburtstag-70-gross', variant: '70 – Festlich',
  desc: 'Klappkarte A6 zum 70. Geburtstag in großer, gut lesbarer Schrift: Goldrahmen, eine kräftige „70“ und „Alles Gute zum Geburtstag“. Innen großer Text für Glückwünsche.',
  tags: ['70. Geburtstag', 'siebzig', 'Gold', 'Klappkarte', 'festlich', 'Rubinhochzeit'],
  bg: '#fbf6ea', accent: '#a9822f', soft: '#f1e4c2', frame: 'deko-rahmen-doppellinie-hoch-gold', big: '70', bigf: 'Abril Fatface', bigk: 0.9, motif: 'deko-motive-sektglaeser-pastell', motif2: 'deko-motive-sektglaeser-pastell',
  kicker: 'ZUM GEBURTSTAG', foot: 'Von Herzen alles Gute', ty: 76, title: ['Alles Gute', 'zum Geburtstag'],
  head: 'Liebe Oma,', sign: 'Deine Enkel',
  body: 'zu deinem 70. Geburtstag wünschen wir dir von Herzen alles Liebe, Gesundheit und viele schöne Stunden im Kreis der Familie. Danke für alles, was du für uns tust!',
  b: S('Cormorant Garamond', 16, '#2f2a22', { w: 600, lh: 1.4 }),
});

const achtzig = make(meta, {
  pre: pre.bold('#ffffff', '#ffe9a8', 'Montserrat', '#1f4d3a'),
  layout: 'block', slug: 'geburtstag-80-gross', variant: '80 – Kräftig',
  desc: 'Klappkarte A6 zum 80. Geburtstag in großer Schrift: grüne Fläche, eine riesige „80“ im hellen Kreis und „Herzlichen Glückwunsch“ in Versalien. Innen großer, klarer Text.',
  tags: ['80. Geburtstag', 'achtzig', 'grün', 'Klappkarte', 'gut lesbar', 'Opa'],
  accent: '#2f7a5a', soft: '#ffe9a8', big: '80', bigf: 'Montserrat', bigw: 800, bigk: 0.62, bigc: '#1f4d3a', motif: 'deko-motive-kleeblatt-bunt', motif2: 'deko-motive-kleeblatt-bunt',
  kicker: 'GEBURTSTAG', foot: 'Bleib gesund und munter', ty: 94, title: ['Herzlichen', 'Glückwunsch'],
  head: 'Lieber Opa,', sign: 'Deine Familie',
  body: 'zu deinem 80. Geburtstag gratulieren wir dir ganz herzlich. Wir wünschen dir Gesundheit, Zufriedenheit und noch viele gemeinsame Jahre. Wir haben dich lieb!',
  b: S('Nunito', 14, '#2a2a2a', { w: 600, lh: 1.4 }),
});

const neunzig = make(meta, {
  pre: pre.fun('#3a6ea5', '#2a2a30'),
  layout: 'square', slug: 'geburtstag-90-gross', variant: '90 – Herzlich',
  desc: 'Quadratische Klappkarte zum 90. Geburtstag in großer, gut lesbarer Schrift: eine freundliche „90“ vor Wolken und „Alles Liebe zum Neunzigsten“. Innen großer Text.',
  tags: ['90. Geburtstag', 'neunzig', 'quadratisch', 'Klappkarte', 'Kleeblatt', 'gut lesbar'],
  bg: '#eaf2fa', accent: '#3a6ea5', soft: '#ffffff', big: '90', bigf: 'Fredoka', bigw: 700, bigk: 0.9, bigc: '#3a6ea5', motif: 'deko-motive-kleeblatt-pastell', motif2: 'deko-motive-kleeblatt-pastell', pat: 'deko-muster-wolken', patOp: 0.7,
  kicker: 'GEBURTSTAG', foot: 'Bleiben Sie, wie Sie sind', ty: 80, tilt: 0, title: ['Alles Liebe', 'zum Neunzigsten'],
  head: 'Liebe Erna,', sign: 'Deine Nachbarn',
  body: 'zu Ihrem 90. Geburtstag gratulieren wir Ihnen von ganzem Herzen. Möge Ihnen das Glück treu bleiben und die Sonne jeden Tag ins Fenster scheinen. Wir wünschen Ihnen alles Gute!',
  b: S('Nunito', 13, '#2a2a30', { w: 600, lh: 1.4 }),
});

module.exports = { siebzig, achtzig, neunzig };
