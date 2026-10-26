'use strict';
const { make, S, pre } = require('./_v3-lib');
const meta = { family: 'geburtstag-18-karte', familyName: 'Geburtstagskarte zum 18.', occasion: 'Geburtstag', tags: ['18. Geburtstag', 'Volljährig', 'Achtzehn', 'Geburtstag', 'Glückwunsch', 'Jugend', 'Karte'] };
const texts = {
  head: 'Liebe Emma,', sign: 'Deine Familie',
  body: 'herzlichen Glückwunsch zum 18. Geburtstag! Ab heute darfst du fast alles, und wir wissen, dass du klug damit umgehst. Wir sind stolz auf dich und wünschen dir Mut, Neugier und die schönsten Abenteuer. Die Welt gehört dir!',
};

const gold = make(meta, Object.assign({
  pre: pre.elegant('#6b5326', '#b8923a', 'Great Vibes', '#3f3a30'),
  layout: 'frame', slug: 'geburtstag-18-gold', variant: 'Gold',
  desc: 'Klappkarte A6 zum 18. Geburtstag: Goldrahmen, eine große „18“ in fetter Antiqua und „Volljährig!“ in Schreibschrift. Innen Platz für einen persönlichen Gruß.',
  tags: ['Gold', 'elegant', 'Klappkarte', 'Sektgläser', 'Volljährigkeit'],
  bg: '#faf6ec', accent: '#b8923a', soft: '#f1e4c2', frame: 'deko-rahmen-doppellinie-hoch-gold', big: '18', bigf: 'Abril Fatface', bigk: 0.9, motif: 'deko-motive-sektglaeser-pastell', motif2: 'deko-motive-sektglaeser-pastell',
  kicker: 'GEBURTSTAG', foot: 'Alles Gute zum Achtzehnten', ty: 76, title: ['Volljährig!'],
}, texts));

const modern = make(meta, Object.assign({
  pre: pre.modern('#16213f', '#ff5a7a'),
  layout: 'post', slug: 'geburtstag-18-modern', variant: 'Modern',
  desc: 'Moderne Postkarte A6 quer zum 18. Geburtstag: dunkle Fläche mit leuchtender „18“ und „Jetzt wird’s erwachsen. Ein bisschen.“ Rückseite für Gruß und Adresse.',
  tags: ['modern', 'Postkarte', 'dunkel', 'Neon', 'Teenager', 'erwachsen'],
  bg: '#f5f6fb', accent: '#16213f', soft: '#ff5a7a', big: '18', bigf: 'Anton', bigc: '#ffffff', bigk: 0.9, motif: 'deko-motive-sektglaeser-bunt', kicker: 'HAPPY BIRTHDAY', foot: 'Die Welt gehört dir', ty: 32,
  title: ['Jetzt wird’s', 'erwachsen.', 'Ein bisschen.'],
}, texts, { pbody: 'herzlichen Glückwunsch zum 18.! Wir sind stolz auf dich. Die Welt gehört dir!' }));

const party = make(meta, Object.assign({
  pre: pre.fun('#e8505b', '#40343a'),
  layout: 'square', slug: 'geburtstag-18-party', variant: 'Party',
  desc: 'Bunte quadratische Klappkarte zum 18.: eine riesige „18“ vor Konfetti und „Endlich 18!“ in Handschrift. Innen ein Glückwunsch zum Start ins große Abenteuer.',
  tags: ['Party', 'Konfetti', 'bunt', 'quadratisch', 'Klappkarte', 'Volljährig'],
  bg: '#fff0c9', accent: '#e8505b', soft: '#ffffff', big: '18', bigf: 'Righteous', bigk: 0.9, bigc: '#e8505b', motif: 'deko-motive-fuehrerschein-bunt', motif2: 'deko-motive-sektglaeser-bunt', pat: 'deko-muster-konfettipunkte-bunt', patOp: 0.4,
  kicker: 'HAPPY BIRTHDAY', foot: 'Auf den Start ins Abenteuer', ty: 82, tilt: 0, title: ['Endlich 18!'],
  t: [S('Caveat', 44, '#e8505b', { w: 700, lh: 1.05 })],
}, texts));

module.exports = { gold, modern, party };
