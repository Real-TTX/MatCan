'use strict';
const { make, S, pre } = require('./_v3-lib');
const meta = { family: 'danke-geschenke-karte', familyName: 'Danke für die Geschenke', occasion: 'Geburtstag', tags: ['Danke', 'Geschenke', 'Dankeschön', 'Geburtstag', 'Gäste', 'Feier', 'Dank nach der Feier', 'Karte'] };
const texts = {
  head: 'Liebe Gäste,', sign: 'Euer Lukas',
  body: 'vielen herzlichen Dank für eure Glückwünsche, die schönen Geschenke und dafür, dass ihr diesen Tag mit mir gefeiert habt. Ich habe mich riesig gefreut und werde die Feier nie vergessen!',
};

const festlich = make(meta, Object.assign({
  pre: pre.elegant('#6b5326', '#b8923a', 'Great Vibes', '#3f3a30'),
  layout: 'frame', slug: 'danke-geschenke-festlich', variant: 'Festlich',
  desc: 'Klappkarte A6 als Dank nach der Feier: Goldrahmen, ein Geschenk mit Schleife und „Danke für die schönen Geschenke“ in Schreibschrift. Innen Platz für dein Dankeschön.',
  tags: ['festlich', 'Gold', 'Geschenk', 'Schleife', 'Klappkarte', 'elegant'],
  bg: '#fbf6ec', accent: '#b8923a', soft: '#f1e4c2', frame: 'deko-rahmen-doppellinie-hoch-gold', motif: 'deko-konfetti-geschenk-gold',
  kicker: 'DANKESCHÖN', foot: 'Von Herzen', ty: 78, title: ['Danke für die', 'schönen Geschenke'],
}, texts));

const bunt = make(meta, Object.assign({
  pre: pre.fun('#e8505b', '#40343a'),
  layout: 'postp', slug: 'danke-geschenke-bunt', variant: 'Bunt',
  desc: 'Bunte Postkarte A6 hoch als Dank für Geschenke: ein Geschenk im Kreis und „Danke, ihr Lieben!“ in Handschrift. Rückseite mit Platz für Gruß, Briefmarke und Adresse.',
  tags: ['bunt', 'Geschenk', 'Postkarte', 'Handschrift', 'Konfetti', 'Kinder'],
  bg: '#fff1e0', accent: '#e8505b', soft: '#ffffff', motif: 'deko-konfetti-geschenk-bunt', kicker: 'DANKESCHÖN', foot: 'Es war ein toller Tag', ty: 98, title: ['Danke,', 'ihr Lieben!'],
  head: 'Ihr Lieben,', sign: 'Euer Lukas', body: 'danke für eure Geschenke und Glückwünsche! Ich habe mich riesig gefreut.', pbody: 'danke für eure Geschenke und Glückwünsche! Ich habe mich riesig gefreut. Es war ein toller Tag mit euch.',
}));

const modern = make(meta, Object.assign({
  pre: pre.bold('#ffffff', '#fff3d0', 'Montserrat', '#1f6f68'),
  layout: 'block', slug: 'danke-geschenke-modern', variant: 'Modern',
  desc: 'Moderne Klappkarte A6 als Dank für die Geschenke: türkise Fläche, ein Geschenk im Kreis und „Vielen Dank“ in kräftigen Versalien. Innen eine farbige Seite.',
  tags: ['modern', 'türkis', 'Geschenk', 'Klappkarte', 'Versalien'],
  accent: '#2fa39a', soft: '#fff3d0', motif: 'deko-konfetti-geschenk-pastell', kicker: 'DANKESCHÖN', foot: 'Für die schöne Überraschung', ty: 95, title: ['VIELEN', 'DANK'],
}, texts));

module.exports = { festlich, bunt, modern };
