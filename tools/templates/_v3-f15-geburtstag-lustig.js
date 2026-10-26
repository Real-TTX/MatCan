'use strict';
const { make, S, pre } = require('./_v3-lib');
const meta = { family: 'geburtstag-lustig-karte', familyName: 'Geburtstagskarte lustig', occasion: 'Geburtstag', tags: ['Geburtstag', 'lustig', 'witzig', 'Humor', 'Spruch', 'Glückwunsch', 'Karte', 'Torte'] };
const texts = {
  head: 'Lieber Stefan,', sign: 'Dein Matthias',
  body: 'herzlichen Glückwunsch zum Geburtstag! Du bist nicht älter, du bist nur länger gut. Genieße deinen Tag, iss reichlich Kuchen und denk dran: Kerzen zählen nicht, die sind nur Deko. Lass dich feiern!',
};

const torte = make(meta, Object.assign({
  pre: pre.fun('#d6334b', '#42303a'),
  layout: 'square', slug: 'geburtstag-lustig-torte', variant: 'Torte',
  desc: 'Lustige quadratische Klappkarte zum Geburtstag: eine bunte Torte vor Konfettipunkten und „Nicht älter, nur besser gereift!“ in Handschrift. Innen ein Spruch zum Schmunzeln.',
  tags: ['Torte', 'Kerzen', 'Konfetti', 'quadratisch', 'Klappkarte', 'bunt'],
  bg: '#ffeaf0', accent: '#d6334b', soft: '#ffffff', motif: 'deko-konfetti-torte-bunt', motif2: 'deko-konfetti-geschenk-bunt', pat: 'deko-muster-konfettipunkte-bunt', patOp: 0.35,
  kicker: 'ZUM GEBURTSTAG', foot: 'Kuchen first!', ty: 80, tilt: -3, title: ['Nicht älter,', 'nur besser gereift!'],
}, texts));

const limited = make(meta, Object.assign({
  pre: pre.bold('#ffffff', '#ffe08a', 'Montserrat', '#5a2d9c'),
  layout: 'block', slug: 'geburtstag-lustig-limited-edition', variant: 'Limited Edition',
  desc: 'Freche Klappkarte A6 zum Geburtstag: lila Fläche, ein Geschenk im Kreis und „Limited Edition“ in Versalien. Innen ein Spruch, der gutes Altern feiert.',
  tags: ['Limited Edition', 'Geschenk', 'lila', 'Klappkarte', 'Spruch', 'Jahrgang'],
  accent: '#7a45c8', soft: '#ffe08a', motif: 'deko-konfetti-geschenk-bunt', kicker: 'JAHRGANG UNVERWECHSELBAR', foot: 'Wird mit dem Alter besser', ty: 95, title: ['LIMITED', 'EDITION'],
}, texts));

const hurra = make(meta, Object.assign({
  pre: pre.fun('#e07a1a', '#42362a'),
  layout: 'postp', slug: 'geburtstag-lustig-hurra', variant: 'Hurra',
  desc: 'Fröhliche Postkarte A6 hoch zum Geburtstag: ein Wecker im Kreis und „Hurra, du lebst noch!“ in Handschrift. Auf der Rückseite Platz für einen Gruß mit Augenzwinkern.',
  tags: ['Wecker', 'Postkarte', 'Hurra', 'Humor', 'Augenzwinkern', 'Handschrift'],
  bg: '#fff1da', accent: '#e07a1a', soft: '#ffffff', motif: 'deko-motive-wecker-pastell', kicker: 'ZUM GEBURTSTAG', foot: 'Auf noch viele Jahre!', ty: 96, title: ['Hurra,', 'du lebst noch!'],
  head: 'Du Jungspund,', sign: 'Dein Matthias', body: 'wieder ein Jahr geschafft! Wir feiern dich und deine Falten, die nur zeigen, wie viel du gelacht hast.', pbody: 'wieder ein Jahr geschafft! Wir feiern dich und deine Lachfalten. Alles Gute zum Geburtstag!',
}));

module.exports = { torte, limited, hurra };
