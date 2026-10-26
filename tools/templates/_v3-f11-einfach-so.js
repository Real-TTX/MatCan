'use strict';
const { make, S, pre } = require('./_v3-lib');
const meta = { family: 'einfach-so-karte', familyName: 'Karte „Denk an dich“', occasion: 'Feste & Events', tags: ['Einfach so', 'Denk an dich', 'Gruß', 'Aufmunterung', 'Hallo', 'Kleiner Gruß', 'Karte', 'Freude schenken'] };
const texts = {
  head: 'Hallo du,', sign: 'Deine Lena',
  body: 'ich wollte dir einfach mal sagen, dass ich an dich denke. Ohne besonderen Anlass, nur weil du mir wichtig bist. Ich hoffe, du hast einen schönen Tag und ein Lächeln im Gesicht!',
};

const sonnig = make(meta, Object.assign({
  pre: pre.fun('#e8962a', '#4a3d2a'),
  layout: 'square', slug: 'einfach-so-sonnig', variant: 'Sonnig',
  desc: 'Sonnige quadratische Klappkarte „Denk an dich“: eine lächelnde Sonne mit Brille und „Ein Sonnengruß für dich“ in Handschrift. Innen Platz für deine Zeilen.',
  tags: ['sonnig', 'Sonne', 'Sommer', 'Sonnenbrille', 'quadratisch', 'Klappkarte', 'Gute Laune'],
  bg: '#fff3cf', accent: '#e8962a', soft: '#ffffff', motif: 'deko-motive-sonne-brille-pastell', motif2: 'deko-motive-sonne-brille-bunt', pat: 'deko-muster-wolken', patOp: 0.5,
  kicker: 'DENK AN DICH', foot: 'Einfach so, weil du du bist', ty: 80, tilt: 0, title: ['Ein Sonnengruß', 'für dich'],
}, texts));

const poetisch = make(meta, Object.assign({
  pre: pre.elegant('#8a5a3a', '#b9794f', 'Allura', '#463a30'),
  layout: 'frame', slug: 'einfach-so-poetisch', variant: 'Poetisch',
  desc: 'Klappkarte A6 „Denk an dich“: Blütenrahmen in Rosé, ein Brief mit Herz und „Ein kleiner Gruß von mir“ in feiner Schreibschrift. Innen Platz für persönliche Zeilen.',
  tags: ['poetisch', 'Brief', 'Herz', 'Klappkarte', 'Rosé', 'Gruß'],
  bg: '#fbf5ee', accent: '#b9794f', soft: '#f1e0cd', frame: 'deko-rahmen-zierrand-hoch-rose', motif: 'deko-motive-briefumschlag-boho',
  kicker: 'GEDANKEN AN DICH', foot: 'Von Herzen', ty: 78, title: ['Ein kleiner', 'Gruß von mir'],
}, texts));

const modern = make(meta, Object.assign({
  pre: pre.modern('#1f5f5b', '#2fa39a'),
  layout: 'post', slug: 'einfach-so-modern', variant: 'Modern',
  desc: 'Moderne Postkarte A6 quer „Denk an dich“: türkise Fläche mit Kaffeetasse im Kreis und „Hallo, du!“ in klarer Schrift. Rückseite mit Gruß, Briefmarke und Adresse.',
  tags: ['modern', 'Postkarte', 'Kaffee', 'Hallo', 'türkis', 'Kurzgruß'],
  bg: '#f2faf9', accent: '#2fa39a', soft: '#d4f0ec', motif: 'deko-motive-kaffeetasse-pastell', kicker: 'DENK AN DICH', foot: 'Zeit für eine Pause?', ty: 34, title: ['Hallo,', 'du!'],
}, texts, { pbody: 'ich wollte dir einfach mal sagen, dass ich an dich denke. Ohne Anlass, nur weil du mir wichtig bist. Hab einen schönen Tag!' }));

module.exports = { sonnig, poetisch, modern };
