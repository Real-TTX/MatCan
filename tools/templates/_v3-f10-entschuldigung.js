'use strict';
const { make, S, pre } = require('./_v3-lib');
const meta = { family: 'entschuldigung-karte', familyName: 'Entschuldigungskarte', occasion: 'Feste & Events', tags: ['Entschuldigung', 'Tut mir leid', 'Sorry', 'Verzeihung', 'Versöhnung', 'Frieden', 'Karte'] };
const texts = {
  head: 'Liebe Anja,', sign: 'Dein Paul',
  body: 'es tut mir aufrichtig leid, was ich gesagt habe. Du bedeutest mir viel, und ich möchte, dass wir das wieder in Ordnung bringen. Können wir bald in Ruhe darüber reden? Ich würde mich sehr freuen.',
};

const aufrichtig = make(meta, Object.assign({
  pre: pre.elegant('#4a5a6e', '#7a8ea6', 'Parisienne', '#363d48'),
  layout: 'frame', slug: 'entschuldigung-aufrichtig', variant: 'Aufrichtig',
  desc: 'Klappkarte A6 zur Entschuldigung: ruhiger Rahmen, eine weiße Fahne mit Herz als Zeichen des Friedens und „Es tut mir so leid“ in Schreibschrift. Innen Platz für deine Worte.',
  tags: ['aufrichtig', 'ruhig', 'Fahne', 'Frieden', 'Klappkarte', 'Versöhnung'],
  bg: '#f6f7f9', accent: '#7a8ea6', soft: '#e1e6ed', frame: 'deko-rahmen-doppellinie-hoch-navy', motif: 'deko-motive-fahne-herz-pastell',
  kicker: 'ENTSCHULDIGUNG', foot: 'Von Herzen', ty: 78, title: ['Es tut mir', 'so leid'],
}, texts));

const modern = make(meta, Object.assign({
  pre: pre.modern('#6b2d4a', '#c2577a'),
  layout: 'postp', slug: 'entschuldigung-modern', variant: 'Modern',
  desc: 'Moderne Postkarte A6 hoch zur Entschuldigung: eine große Pfingstrose und „Entschuldigung“ in klarer Schrift. Die Rückseite hat Platz für ein paar ehrliche Zeilen.',
  tags: ['modern', 'Pfingstrose', 'Blume', 'Postkarte', 'Verzeihung', 'rosa'],
  bg: '#fdf3f6', accent: '#c2577a', soft: '#f9dde7', motif: 'deko-blumen-pfingstrose-rose', kicker: 'ES TUT MIR LEID', foot: 'Verzeihst du mir?', ty: 98, title: ['Entschuldigung'],
  t: [S('Poppins', 25, '#6b2d4a', { w: 700, lh: 1.1 })],
  head: 'Liebe Anja,', sign: 'Dein Paul', pbody: 'ich habe Mist gebaut und das tut mir leid. Du bist mir wichtig. Lass uns bitte reden.',
}));

const humorvoll = make(meta, Object.assign({
  pre: pre.fun('#e0647a', '#4a343a'),
  layout: 'square', slug: 'entschuldigung-humorvoll', variant: 'Humorvoll',
  desc: 'Versöhnliche quadratische Klappkarte: eine Friedensfahne mit Herz und „Sorry! Ich bring auch Kuchen mit.“ in Handschrift. Innen ein Friedensangebot mit Augenzwinkern.',
  tags: ['lustig', 'witzig', 'Fahne', 'Kuchen', 'Sorry', 'quadratisch', 'Klappkarte'],
  bg: '#fff0ee', accent: '#e0647a', soft: '#ffffff', motif: 'deko-motive-fahne-herz-bunt', motif2: 'deko-konfetti-geschenk-pastell', pat: 'deko-muster-konfettipunkte-pastell', patOp: 0.4,
  kicker: 'FRIEDENSANGEBOT', foot: 'Weiße Fahne, rotes Herz', ty: 80, tilt: -3, title: ['Sorry!', 'Ich bring auch Kuchen mit.'], t: [S('Caveat', 44, '#e0647a', { w: 700, lh: 1.05 }), S('Caveat', 24, '#e0647a', { w: 700, lh: 1.1 })],
}, texts, { body: 'Ich weiß, ich war ein Sturkopf. Es tut mir leid! Als Wiedergutmachung gibt es Kuchen, Kaffee und ein offenes Ohr. Frieden?' }));

module.exports = { aufrichtig, modern, humorvoll };
