'use strict';
const { make, S, pre } = require('./_v3-lib');
const meta = { family: 'geburtstag-frauen-karte', familyName: 'Geburtstagskarte für Frauen', occasion: 'Geburtstag', tags: ['Geburtstag', 'Frauen', 'Freundin', 'Mama', 'Schwester', 'Blumen', 'Glückwunsch', 'Karte'] };
const texts = {
  head: 'Liebe Katja,', sign: 'Deine Johanna',
  body: 'alles, alles Liebe zu deinem Geburtstag! Ich wünsche dir einen Tag voller Blumen, Lachen und Kuchen, dazu Gesundheit und alles, was dein Herz sich wünscht. Schön, dass es dich gibt!',
};

const blumen = make(meta, Object.assign({
  pre: pre.elegant('#8a3a5a', '#c0587a', 'Great Vibes', '#4a3340'),
  layout: 'frame', slug: 'geburtstag-frauen-blumen', variant: 'Blumen',
  desc: 'Klappkarte A6 zum Geburtstag für Frauen: Blütenrahmen in Rosé, eine große Pfingstrose und „Alles Liebe zum Geburtstag“ in Schreibschrift. Innen Platz für deine Wünsche.',
  tags: ['Blumen', 'Pfingstrose', 'Rosé', 'Klappkarte', 'romantisch', 'zart'],
  bg: '#fff6f6', accent: '#c0587a', soft: '#f9dde5', frame: 'deko-rahmen-blueten-hoch-rose', motif: 'deko-blumen-pfingstrose-rose',
  kicker: 'FÜR DICH', foot: 'Von Herzen', ty: 78, title: ['Alles Liebe', 'zum Geburtstag'],
}, texts));

const ballons = make(meta, Object.assign({
  pre: pre.modern('#6b3a8c', '#9b5bc8'),
  layout: 'postp', slug: 'geburtstag-frauen-ballons', variant: 'Ballons',
  desc: 'Moderne Postkarte A6 hoch zum Geburtstag: Pastellballons im Kreis und „Alles Gute!“ in klarer Schrift. Rückseite für Gruß, Briefmarke und Adresse.',
  tags: ['Ballons', 'Pastell', 'Postkarte', 'modern', 'fröhlich', 'Party'],
  bg: '#f8f2fc', accent: '#9b5bc8', soft: '#ffffff', motif: 'deko-konfetti-ballons-drei-pastell', kicker: 'HAPPY BIRTHDAY', foot: 'Lass dich feiern!', ty: 98, title: ['Alles', 'Gute!'],
  head: 'Liebe Katja,', sign: 'Deine Johanna', body: 'alles Liebe zu deinem Geburtstag!', pbody: 'alles Liebe zu deinem Geburtstag! Ich wünsche dir einen Tag voller Lachen, Kuchen und Überraschungen. Schön, dass es dich gibt!',
}));

const sonnig = make(meta, Object.assign({
  pre: pre.fun('#e8505b', '#4a3a3a'),
  layout: 'square', slug: 'geburtstag-frauen-bunt', variant: 'Bunt',
  desc: 'Bunte quadratische Klappkarte zum Geburtstag: fünf Ballons vor Konfetti und „Heute ist dein Tag!“ in Handschrift. Innen ein herzlicher Glückwunsch.',
  tags: ['bunt', 'Ballons', 'Konfetti', 'quadratisch', 'Klappkarte', 'fröhlich'],
  bg: '#ffeef2', accent: '#e8505b', soft: '#ffffff', motif: 'deko-konfetti-ballons-fuenf-bunt', motif2: 'deko-konfetti-torte-bunt', pat: 'deko-muster-konfettipunkte-bunt', patOp: 0.35,
  kicker: 'ZUM GEBURTSTAG', foot: 'Auf dich!', ty: 80, tilt: 0, title: ['Heute ist', 'dein Tag!'],
}, texts));

module.exports = { blumen, ballons, sonnig };
