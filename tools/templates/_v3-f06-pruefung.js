'use strict';
const { make, S, pre } = require('./_v3-lib');
const meta = { family: 'pruefung-karte', familyName: 'Karte zur bestandenen Prüfung', occasion: 'Verein & Schule', tags: ['Prüfung', 'Bestanden', 'Abschluss', 'Glückwunsch', 'Zeugnis', 'Examen', 'Studium', 'Ausbildung', 'Karte'] };
const texts = {
  head: 'Liebe Sophie,', sign: 'Deine Freunde',
  body: 'wir gratulieren dir von Herzen zur bestandenen Prüfung! All das Lernen, Zittern und Durchhalten hat sich gelohnt. Wir sind stolz auf dich und freuen uns, mit dir zu feiern. Jetzt hast du dir eine Pause verdient!',
};

const elegant = make(meta, Object.assign({
  pre: pre.elegant('#1f2f5c', '#8a6f3d', 'Great Vibes', '#2d3345'),
  layout: 'frame', slug: 'pruefung-elegant', variant: 'Elegant',
  desc: 'Klappkarte A6 zur bestandenen Prüfung: marineblauer Rahmen, ein Doktorhut und „Herzlichen Glückwunsch“ in Schreibschrift. Innen Platz für deine Gratulation.',
  tags: ['elegant', 'Doktorhut', 'Klappkarte', 'navy', 'Studium', 'Abschluss'],
  bg: '#f7f5f0', accent: '#8a6f3d', soft: '#e7e1d0', frame: 'deko-rahmen-deco-hoch-navy', motif: 'deko-motive-doktorhut-navy',
  kicker: 'BESTANDEN', foot: 'Wir sind stolz auf dich', ty: 78, title: ['Herzlichen', 'Glückwunsch'],
}, texts));

const modern = make(meta, Object.assign({
  pre: pre.bold('#ffffff', '#ffd166', 'Montserrat', '#1f2f5c'),
  layout: 'block', slug: 'pruefung-modern', variant: 'Modern',
  desc: 'Moderne Klappkarte A6 zur bestandenen Prüfung: navyblaue Fläche, eine Urkundenrolle im gelben Kreis und „Geschafft!“ in Versalien. Innen eine farbige Seite für deine Worte.',
  tags: ['modern', 'Urkunde', 'navy', 'gelb', 'Klappkarte', 'Zeugnis'],
  accent: '#1f2f5c', soft: '#ffd166', motif: 'deko-motive-urkunde-rolle-bunt', kicker: 'PRÜFUNG BESTANDEN', foot: 'Glückwunsch!', ty: 95, title: ['Geschafft!'],
}, texts));

const humorvoll = make(meta, Object.assign({
  pre: pre.fun('#c98a0a', '#40361f'),
  layout: 'postp', slug: 'pruefung-humorvoll', variant: 'Humorvoll',
  desc: 'Fröhliche Postkarte A6 hoch zur bestandenen Prüfung: ein goldener Pokal im Kreis und „Prüfung gerockt!“ in Handschrift. Rückseite mit Gruß und Adresse.',
  tags: ['lustig', 'Pokal', 'gerockt', 'Postkarte', 'Sieger', 'Champion'],
  bg: '#fff6dc', accent: '#c98a0a', soft: '#ffffff', motif: 'deko-motive-siegerpokal-gold', kicker: 'GLÜCKWUNSCH', foot: 'Du bist der Champion!', ty: 96, title: ['Prüfung', 'gerockt!'],
  head: 'Du Genie,', sign: 'Deine Freunde', body: 'nie wieder Karteikarten! Wir feiern dich, deinen Fleiß und deine Nerven aus Stahl. Auf den Erfolg!', pbody: 'nie wieder Karteikarten! Wir feiern dich, deinen Fleiß und deine Nerven aus Stahl. Auf den Erfolg!',
}));

module.exports = { elegant, modern, humorvoll };
