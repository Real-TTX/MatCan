'use strict';
const { make, S, pre } = require('./_v3-lib');
const meta = { family: 'geburt-glueckwunsch-karte', familyName: 'Glückwunschkarte zur Geburt', occasion: 'Kinder & Familie', tags: ['Geburt', 'Baby', 'Neugeborenes', 'Glückwunsch', 'Nachwuchs', 'Eltern', 'Willkommen', 'Karte'] };
const texts = {
  head: 'Liebe Maria, lieber David,', sign: 'Eure Freunde',
  body: 'herzlichen Glückwunsch zur Geburt eures Kindes! Wir freuen uns riesig mit euch und wünschen eurer kleinen Familie eine wunderschöne gemeinsame Zeit, viel Kraft, ein paar ruhige Nächte und ganz viel Liebe.',
};

const zart = make(meta, Object.assign({
  pre: pre.elegant('#4d6c8c', '#7d9bb8', 'Parisienne', '#3a4652'),
  layout: 'frame', slug: 'geburt-zart', variant: 'Zart',
  desc: 'Klappkarte A6 zur Geburt: zarter Bogenrahmen, ein Babybody in Pastell und „Willkommen auf der Welt“ in Schreibschrift. Innen Platz für Glückwünsche an die jungen Eltern.',
  tags: ['zart', 'Pastell', 'Babybody', 'Klappkarte', 'Junge', 'Mädchen', 'Willkommen'],
  bg: '#f8f6f3', accent: '#7d9bb8', soft: '#e1e9f1', frame: 'deko-rahmen-bogen-rose', motif: 'deko-motive-babybody-pastell',
  kicker: 'ZUR GEBURT', foot: 'Herzlichen Glückwunsch', ty: 78, title: ['Willkommen', 'auf der Welt'],
}, texts));

const modern = make(meta, Object.assign({
  pre: pre.bold('#ffffff', '#fff3d0', 'Montserrat', '#2d6aa8'),
  layout: 'block', slug: 'geburt-modern', variant: 'Modern',
  desc: 'Moderne Klappkarte A6 zur Geburt: hellblaue Fläche, ein Babybody im Kreis und „Es ist da!“ in kräftigen Versalien. Innen eine farbige Seite für eure Glückwünsche.',
  tags: ['modern', 'blau', 'Babybody', 'Klappkarte', 'Neugeborenes', 'Es ist da'],
  accent: '#58a6e6', soft: '#ffffff', motif: 'deko-motive-babybody-bunt', kicker: 'DAS BABY IST DA', foot: 'Alles Liebe für die kleine Familie', ty: 95, title: ['Es ist', 'da!'],
}, texts));

const humorvoll = make(meta, Object.assign({
  pre: pre.fun('#e07a9a', '#4a3a40'),
  layout: 'square', slug: 'geburt-humorvoll', variant: 'Humorvoll',
  desc: 'Fröhliche quadratische Klappkarte zur Geburt: ein Babybody vor Wolken und „Willkommen, kleiner Boss!“ in Handschrift. Innen ein augenzwinkernder Glückwunsch für die Eltern.',
  tags: ['lustig', 'witzig', 'Babybody', 'Wolken', 'quadratisch', 'Klappkarte', 'Boss'],
  bg: '#fde8ee', accent: '#e07a9a', soft: '#ffffff', motif: 'deko-motive-babybody-pastell', motif2: 'deko-motive-babybody-bunt', pat: 'deko-muster-wolken', patOp: 0.7,
  kicker: 'ZUR GEBURT', foot: 'Schlaf ist überbewertet!', ty: 80, tilt: -5, title: ['Willkommen,', 'kleiner Boss!'],
}, texts, { body: 'Ab jetzt bestimmt jemand Neues, wann gegessen, gespielt und geschlafen wird. Wir wünschen euch starke Nerven, viele Kuschelmomente und noch mehr Glück. Herzlichen Glückwunsch!' }));

module.exports = { zart, modern, humorvoll };
