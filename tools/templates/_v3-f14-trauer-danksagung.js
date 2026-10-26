'use strict';
const { make, S, pre } = require('./_v3-lib');
const meta = { family: 'trauer-danksagung-karte', familyName: 'Trauer-Danksagung', occasion: 'Trauer', tags: ['Danksagung', 'Trauer', 'Beileid', 'Trauerfall', 'Abschied', 'Anteilnahme', 'Kerze', 'Gedenken', 'Karte'] };
const texts = {
  head: 'Danke für eure Anteilnahme',
  sign: 'Die Familie',
  body: 'Für die liebevolle Anteilnahme, die tröstenden Worte, die Blumen und die stille Umarmung beim Abschied von unserem lieben Vater danken wir von Herzen. Es hat uns sehr gutgetan, nicht allein zu sein.',
};

const ruhig = make(meta, Object.assign({
  pre: pre.elegant('#3d4660', '#6c7794', 'Cormorant Garamond', '#33384a'),
  layout: 'frame', slug: 'trauer-danksagung-ruhig', variant: 'Ruhig',
  desc: 'Ruhige Klappkarte A6 als Trauer-Danksagung: schlichter Rahmen, eine Kerze in Blau und „Danke für eure Anteilnahme“. Innen Platz für den persönlichen Dank der Familie.',
  tags: ['ruhig', 'Kerze', 'Klappkarte', 'schlicht', 'blau', 'Dank'],
  bg: '#f6f6f4', accent: '#6c7794', soft: '#dfe2ea', frame: 'deko-rahmen-doppellinie-hoch-navy', motif: 'deko-motive-kerze-navy',
  kicker: 'IN DANKBARKEIT', foot: 'In stillem Gedenken', ty: 80, title: ['Danke für', 'eure Anteilnahme'],
  t: [S('Cormorant Garamond', 24, '#3d4660', { w: 600, i: true, lh: 1.2 })],
  h: S('Cormorant Garamond', 19, '#3d4660', { w: 600, i: true }), g: S('Cormorant Garamond', 17, '#3d4660', { w: 600, i: true }),
}, texts));

const warm = make(meta, Object.assign({
  pre: pre.elegant('#6b4a3a', '#a07a5a', 'Cormorant Garamond', '#43362f'),
  layout: 'post', slug: 'trauer-danksagung-warm', variant: 'Warm',
  desc: 'Warme Postkarte A6 quer als Trauer-Danksagung: gedämpfte Farben, eine Kerze in Rosé und „Von Herzen Danke“. Die Rückseite bietet Platz für ein paar persönliche Zeilen.',
  tags: ['warm', 'Kerze', 'Postkarte', 'gedeckt', 'Dank', 'Trost'],
  bg: '#f8f3ee', accent: '#cdb8a6', soft: '#f1e6dc', motif: 'deko-motive-kerze-rose', kicker: 'DANKSAGUNG', foot: 'In Liebe und Dankbarkeit', ty: 32, title: ['Von Herzen', 'Danke'],
  t: [S('Cormorant Garamond', 28, '#6b4a3a', { w: 600, i: true, lh: 1.15 })],
  h: S('Cormorant Garamond', 19, '#6b4a3a', { w: 600, i: true }), g: S('Cormorant Garamond', 17, '#6b4a3a', { w: 600, i: true }),
}, texts, { head: 'Liebe Freunde und Verwandte,', pbody: 'für alle Zeichen der Anteilnahme, für Worte, Blumen und Umarmungen danken wir von ganzem Herzen.' }));

const natur = make(meta, Object.assign({
  pre: pre.elegant('#44604a', '#6d8c72', 'Cormorant Garamond', '#34413a'),
  layout: 'postp', slug: 'trauer-danksagung-natur', variant: 'Natur',
  desc: 'Stille Postkarte A6 hoch als Trauer-Danksagung: zarte Weizenähren als Zeichen des Lebens und „Danke für eure Anteilnahme“ in ruhiger Schrift. Rückseite für den Dank der Familie.',
  tags: ['natur', 'Weizenähren', 'Ähren', 'Postkarte', 'grün', 'still'],
  bg: '#f4f7f2', accent: '#6d8c72', soft: '#e1eadf', motif: 'deko-blumen-weizenaehren-gold', kicker: 'DANKSAGUNG', foot: 'In stiller Verbundenheit', ty: 96, title: ['Danke für', 'eure Anteilnahme'],
  t: [S('Cormorant Garamond', 25, '#44604a', { w: 600, i: true, lh: 1.2 })],
  h: S('Cormorant Garamond', 19, '#44604a', { w: 600, i: true }), g: S('Cormorant Garamond', 17, '#44604a', { w: 600, i: true }),
}, texts, { head: 'Liebe Freunde,', pbody: 'wir danken euch für jedes Wort, jede Geste und jede stille Umarmung in dieser schweren Zeit.' }));

module.exports = { ruhig, warm, natur };
