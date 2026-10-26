'use strict';
const { make, S, pre } = require('./_v3-lib');
const meta = { family: 'valentinstag-karte', familyName: 'Valentinstagskarte', occasion: 'Feiertage', tags: ['Valentinstag', 'Liebe', 'Herz', 'Liebeskarte', 'Verliebt', 'Paar', 'Karte', '14. Februar'] };
const texts = {
  head: 'Mein Schatz,', sign: 'Dein Jonas',
  body: 'mit dir ist jeder Tag ein kleiner Valentinstag. Danke für dein Lachen, deine Nähe und dafür, dass du immer an meiner Seite bist. Ich liebe dich mehr, als Worte sagen können.',
};

const romantisch = make(meta, Object.assign({
  pre: pre.elegant('#8a3a4a', '#b0585f', 'Great Vibes', '#4a3338'),
  layout: 'frame', slug: 'valentinstag-romantisch', variant: 'Romantisch',
  desc: 'Klappkarte A6 zum Valentinstag: Blütenrahmen in Rosé, ein Liebesbrief mit Herz und „Für dich von Herzen“ in Schreibschrift. Innen Platz für deine Liebeserklärung.',
  tags: ['romantisch', 'Liebesbrief', 'Rosé', 'Klappkarte', 'Blüten', 'Liebeserklärung'],
  bg: '#fff6f4', accent: '#b0585f', soft: '#f7dcd9', frame: 'deko-rahmen-blueten-hoch-rose', motif: 'deko-motive-briefumschlag-pastell', motif2: 'deko-herzen-streuung-rose',
  kicker: 'ZUM VALENTINSTAG', foot: 'in Liebe', ty: 78, title: ['Für dich', 'von Herzen'],
}, texts));

const modern = make(meta, Object.assign({
  pre: pre.modern('#c2253d', '#c2253d'),
  layout: 'postp', slug: 'valentinstag-modern', variant: 'Modern',
  desc: 'Moderne Postkarte A6 hoch zum Valentinstag: ein Herz mit Pfeil im Kreis und „Ich liebe dich“ in fetter Schrift. Rückseite für Gruß, Briefmarke und Adresse.',
  tags: ['modern', 'Herz', 'Pfeil', 'Amor', 'Postkarte', 'Ich liebe dich'],
  bg: '#fff0f0', accent: '#c2253d', soft: '#ffd6dc', motif: 'deko-motive-herz-pfeil-bunt', kicker: 'VALENTINSTAG', foot: '14. Februar', ty: 96, title: ['ICH', 'LIEBE', 'DICH'],
  t: [S('Poppins', 30, '#c2253d', { w: 800, lh: 1.05, ls: 0.1 })],
  head: 'Mein Herz,', sign: 'Dein Jonas', body: 'ohne dich wäre alles nur halb so schön. Danke für dich! Alles Liebe zum Valentinstag.', pbody: 'ohne dich wäre alles nur halb so schön. Danke für dich! Alles Liebe zum Valentinstag.',
}));

const humorvoll = make(meta, Object.assign({
  pre: pre.fun('#d6334b', '#4a2f35'),
  layout: 'square', slug: 'valentinstag-humorvoll', variant: 'Humorvoll',
  desc: 'Freche quadratische Klappkarte zum Valentinstag: ein Briefumschlag mit Herz vor Herzchen-Muster und „Du bist mein Lieblingsmensch!“ in Handschrift.',
  tags: ['lustig', 'witzig', 'Lieblingsmensch', 'Herzchen', 'quadratisch', 'Klappkarte'],
  bg: '#ffe3e6', accent: '#d6334b', soft: '#ffffff', motif: 'deko-motive-briefumschlag-bunt', motif2: 'deko-motive-herz-pfeil-pastell', pat: 'deko-muster-herzchen-bunt', patOp: 0.3,
  kicker: 'VALENTINSTAG', foot: 'Auch ohne Schokolade', ty: 80, tilt: -4, title: ['Du bist mein', 'Lieblingsmensch!'],
}, texts, { body: 'Du bist der Grund für mein Dauergrinsen und der Einzige, mit dem ich mir das letzte Stück Schokolade teile. Danke, dass es dich gibt!' }));

module.exports = { romantisch, modern, humorvoll };
