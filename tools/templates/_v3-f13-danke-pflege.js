'use strict';
const { make, S, pre } = require('./_v3-lib');
const meta = { family: 'danke-pflege-karte', familyName: 'Dankeskarte für Pflege und Helfer', occasion: 'Feste & Events', tags: ['Danke', 'Pflege', 'Pflegekraft', 'Krankenschwester', 'Arzt', 'Helfer', 'Ehrenamt', 'Dankeschön', 'Nachbarschaftshilfe', 'Karte'] };
const texts = {
  head: 'Liebes Team,', sign: 'Familie Berger',
  body: 'mit großer Dankbarkeit denken wir an die Wochen bei Ihnen zurück. Ihre Freundlichkeit, Ihre Geduld und Ihre Fürsorge haben uns Halt gegeben. Danke für alles, was Sie jeden Tag leisten. Sie machen einen wunderbaren Unterschied!',
};

const herzlich = make(meta, Object.assign({
  pre: pre.elegant('#2b6a64', '#3f8f86', 'Parisienne', '#2f403e'),
  layout: 'frame', slug: 'danke-pflege-herzlich', variant: 'Herzlich',
  desc: 'Klappkarte A6 als Dank an Pflege und Helfer: ruhiger Rahmen, ein Herz mit Pflaster und „Danke von Herzen“ in Schreibschrift. Innen Platz für persönliche Worte.',
  tags: ['herzlich', 'Pflaster', 'Herz', 'Klappkarte', 'Krankenhaus', 'Pflegedienst'],
  bg: '#f4f9f8', accent: '#3f8f86', soft: '#d9ece9', frame: 'deko-rahmen-doppellinie-hoch-gold', motif: 'deko-motive-pflaster-herz-bunt',
  kicker: 'EIN GROSSES DANKESCHÖN', foot: 'Für Ihre Fürsorge', ty: 78, title: ['Danke', 'von Herzen'],
}, texts));

const modern = make(meta, Object.assign({
  pre: pre.modern('#1c5f6e', '#2a9db0'),
  layout: 'postp', slug: 'danke-pflege-modern', variant: 'Modern',
  desc: 'Moderne Postkarte A6 hoch als Dank an Pflegekräfte und Helfer: ein Herz mit Pflaster im Kreis und „Danke für Ihre Hilfe“ in klarer Schrift. Rückseite für Gruß und Adresse.',
  tags: ['modern', 'Pflaster', 'Herz', 'Postkarte', 'Danke', 'türkis'],
  bg: '#eef9fb', accent: '#2a9db0', soft: '#ffffff', motif: 'deko-motive-pflaster-herz-pastell', kicker: 'DANKE', foot: 'Sie sind Gold wert', ty: 96, title: ['Danke für', 'Ihre Hilfe'],
  head: 'Liebes Team,', sign: 'Familie Berger', pbody: 'danke für Ihre Fürsorge, Ihre Geduld und Ihre Freundlichkeit. Sie machen einen wunderbaren Unterschied.',
}));

const sonnig = make(meta, Object.assign({
  pre: pre.fun('#e0762a', '#4a3a2a'),
  layout: 'square', slug: 'danke-pflege-sonnig', variant: 'Sonnig',
  desc: 'Warme quadratische Klappkarte als Dank an Helfer: ein Kleeblatt als Glücksbringer und „Ihr seid Gold wert!“ in Handschrift. Innen Platz für einen persönlichen Dank.',
  tags: ['sonnig', 'Kleeblatt', 'Ehrenamt', 'quadratisch', 'Klappkarte', 'Helfer', 'Gold wert'],
  bg: '#fff2d9', accent: '#e0762a', soft: '#ffffff', motif: 'deko-motive-kleeblatt-bunt', motif2: 'deko-motive-pflaster-herz-bunt', pat: 'deko-muster-konfettipunkte-bunt', patOp: 0.3,
  kicker: 'DANKESCHÖN', foot: 'Von ganzem Herzen', ty: 80, tilt: -4, title: ['Ihr seid', 'Gold wert!'],
}, texts, { body: 'Ohne Menschen wie Sie wäre vieles schwerer gewesen. Danke für Ihre Zeit, Ihre Hilfe und Ihr Lächeln. Das vergessen wir nie!' }));

module.exports = { herzlich, modern, sonnig };
