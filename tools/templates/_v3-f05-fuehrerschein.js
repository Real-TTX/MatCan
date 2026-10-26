'use strict';
const { make, S, pre } = require('./_v3-lib');
const meta = { family: 'fuehrerschein-karte', familyName: 'Karte zum Führerschein', occasion: 'Feste & Events', tags: ['Führerschein', 'Fahrprüfung', 'Bestanden', 'Auto', 'Glückwunsch', 'Fahranfänger', 'Karte'] };
const texts = {
  head: 'Lieber Tim,', sign: 'Deine Familie',
  body: 'herzlichen Glückwunsch zum bestandenen Führerschein! Jetzt beginnt für dich ein ganz neues Stück Freiheit. Fahr vorsichtig, schnall dich an und denk daran: Nach der Prüfung ist vor der Spritztour. Allzeit gute Fahrt!',
};

const humorvoll = make(meta, Object.assign({
  pre: pre.fun('#2f6fe0', '#2e3340'),
  layout: 'square', slug: 'fuehrerschein-humorvoll', variant: 'Humorvoll',
  desc: 'Fröhliche quadratische Klappkarte zum Führerschein: ein Auto mit L-Schild und „Bestanden! Gute Fahrt!“ in Handschrift. Innen eine freche Gratulation.',
  tags: ['lustig', 'witzig', 'Auto', 'L-Schild', 'quadratisch', 'Klappkarte'],
  bg: '#e6f0ff', accent: '#2f6fe0', soft: '#ffffff', motif: 'deko-motive-auto-l-schild-bunt', motif2: 'deko-motive-fuehrerschein-bunt', pat: 'deko-muster-wolken', patOp: 0.6,
  kicker: 'FÜHRERSCHEIN', foot: 'Die Straße gehört dir!', ty: 82, tilt: -3, title: ['Bestanden!', 'Gute Fahrt!'],
}, texts));

const modern = make(meta, Object.assign({
  pre: pre.modern('#16213f', '#2f6fe0'),
  layout: 'post', slug: 'fuehrerschein-modern', variant: 'Modern',
  desc: 'Moderne Postkarte A6 quer zum Führerschein: dunkelblaue Fläche mit Führerschein-Karte und „Führerschein bestanden!“ in klarer Schrift. Rückseite mit Gruß und Adresse.',
  tags: ['modern', 'Postkarte', 'Karte', 'Fahrerlaubnis', 'dunkelblau'],
  bg: '#f4f7fd', accent: '#1d2b52', soft: '#dce8ff', motif: 'deko-motive-fuehrerschein-bunt', kicker: 'GRATULATION', foot: 'Allzeit gute Fahrt!', ty: 33, title: ['Führerschein', 'bestanden!'],
}, texts, { pbody: 'herzlichen Glückwunsch zum bestandenen Führerschein! Fahr vorsichtig und genieße die neue Freiheit. Allzeit gute Fahrt!' }));

const klassisch = make(meta, Object.assign({
  pre: pre.elegant('#2c2c2c', '#9a7a2e', 'Parisienne', '#2f2f2f'),
  layout: 'frame', slug: 'fuehrerschein-klassisch', variant: 'Klassisch',
  desc: 'Klappkarte A6 zum Führerschein in ruhigem Stil: schwarzer Doppelrahmen, ein vierblättriges Kleeblatt als Glücksbringer und „Allzeit gute Fahrt“ in Schreibschrift.',
  tags: ['klassisch', 'Kleeblatt', 'Glücksbringer', 'Klappkarte', 'schwarz', 'gold'],
  bg: '#f8f6f0', accent: '#9a7a2e', soft: '#ece5d2', frame: 'deko-rahmen-doppellinie-hoch-schwarz', motif: 'deko-motive-kleeblatt-bunt', motif2: 'deko-motive-auto-l-schild-pastell',
  kicker: 'BESTANDEN', foot: 'Herzlichen Glückwunsch', ty: 78, title: ['Allzeit', 'gute Fahrt'],
}, texts));

module.exports = { humorvoll, modern, klassisch };
