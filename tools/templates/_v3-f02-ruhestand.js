'use strict';
const { make, S, pre } = require('./_v3-lib');
const meta = { family: 'ruhestand-karte', familyName: 'Karte zum Ruhestand', occasion: 'Business', tags: ['Ruhestand', 'Rente', 'Pension', 'Abschied', 'Kollege', 'Kollegin', 'Glückwunsch', 'Karte'] };
const texts = {
  head: 'Liebe Renate,', sign: 'Dein Team',
  body: 'jetzt beginnt dein wohlverdienter Ruhestand. Danke für so viele Jahre guter Zusammenarbeit, für deine Ruhe, deinen Humor und deine Hilfe. Wir wünschen dir Zeit für alles, was dir Freude macht, und vor allem Gesundheit.',
};

const elegant = make(meta, Object.assign({
  pre: pre.elegant('#4f6b55', '#6f8f75', 'Parisienne', '#37403a'),
  layout: 'frame', slug: 'ruhestand-elegant', variant: 'Elegant',
  desc: 'Klappkarte A6 zum Ruhestand: Rankenrahmen in Salbei, ein gemütlicher Schaukelstuhl und „Alles Gute zum Ruhestand“ in Schreibschrift. Innen Platz für Dank und gute Wünsche.',
  tags: ['elegant', 'Schaukelstuhl', 'Salbei', 'Klappkarte', 'Pensionierung', 'Rentner'],
  bg: '#f7f3ea', accent: '#6f8f75', soft: '#dfe8dc', frame: 'deko-rahmen-ranke-hoch-salbei', motif: 'deko-motive-schaukelstuhl-pastell',
  kicker: 'ENDLICH ZEIT', foot: 'Von Herzen alles Gute', ty: 78, title: ['Alles Gute', 'zum Ruhestand'],
}, texts));

const modern = make(meta, Object.assign({
  pre: pre.bold('#ffffff', '#fff1c9', 'Montserrat', '#1f6f68'),
  layout: 'block', slug: 'ruhestand-modern', variant: 'Modern',
  desc: 'Moderne Klappkarte A6 zum Ruhestand: türkise Fläche, ein Wecker im Kreis und „Endlich ohne Wecker“ in kräftigen Versalien. Innen eine farbige Seite und viel Platz für Worte.',
  tags: ['modern', 'Wecker', 'türkis', 'Klappkarte', 'Feierabend', 'Frühstück'],
  accent: '#2fb5a8', soft: '#fff4d6', motif: 'deko-motive-wecker-bunt', kicker: 'RUHESTAND', foot: 'Ab jetzt zählt nur noch die Freizeit', ty: 94, title: ['Endlich', 'ohne Wecker'],
}, texts));

const humorvoll = make(meta, Object.assign({
  pre: pre.fun('#e0702a', '#4a3a2a'),
  layout: 'square', slug: 'ruhestand-humorvoll', variant: 'Humorvoll',
  desc: 'Sonnige quadratische Klappkarte zum Ruhestand: eine Sonne mit Sonnenbrille und „Jetzt hast du Zeit für alles!“ in Handschrift. Innen ein augenzwinkernder Gruß.',
  tags: ['lustig', 'witzig', 'Sonne', 'Sonnenbrille', 'Urlaub', 'quadratisch', 'Klappkarte'],
  bg: '#fff1c9', accent: '#e0702a', soft: '#ffffff', motif: 'deko-motive-sonne-brille-bunt', motif2: 'deko-motive-palme-haengematte-bunt', pat: 'deko-muster-wolken', patOp: 0.5,
  kicker: 'ZUM RUHESTAND', foot: 'Alles Gute für die schönste Zeit', ty: 80, tilt: 0, title: ['Jetzt hast du', 'Zeit für alles!'],
  head: 'Liebe Renate,', sign: 'Dein Team',
  body: 'ab heute klingelt kein Wecker mehr, und der Montag ist nur noch ein Wort. Wir danken dir für die schönen Jahre und wünschen dir Sonne, Hängematte und ganz viel Lieblingszeit!',
}));

module.exports = { elegant, modern, humorvoll };
