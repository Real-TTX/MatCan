'use strict';
const { make, S, pre } = require('./_v3-lib');
const meta = { family: 'neues-zuhause-karte', familyName: 'Karte zum neuen Zuhause', occasion: 'Kinder & Familie', tags: ['Neues Zuhause', 'Umzug', 'Einzug', 'Wohnung', 'Haus', 'Einweihung', 'Glückwunsch', 'Karte'] };
const texts = {
  head: 'Liebe Familie Schneider,', sign: 'Eure Nachbarn',
  body: 'herzlichen Glückwunsch zum neuen Zuhause! Wir wünschen euch, dass ihr euch in den neuen vier Wänden schnell wohlfühlt, viele Feste feiert und immer einen Platz für Gäste habt. Auf eine gute Nachbarschaft!',
};

const klassisch = make(meta, Object.assign({
  pre: pre.elegant('#5b4630', '#b07a3c', 'Parisienne', '#3d362c'),
  layout: 'frame', slug: 'neues-zuhause-klassisch', variant: 'Klassisch',
  desc: 'Klappkarte A6 zum Einzug: Bogenrahmen in Gold, ein Haus mit Schlüssel und „Viel Glück im neuen Zuhause“ in Schreibschrift. Innen Platz für Glückwünsche.',
  tags: ['klassisch', 'Haus', 'Schlüssel', 'Klappkarte', 'Gold', 'Hauskauf'],
  bg: '#fbf5ea', accent: '#b07a3c', soft: '#f0e0c4', frame: 'deko-rahmen-bogen-gold', motif: 'deko-motive-haus-schluessel-boho',
  kicker: 'HERZLICH WILLKOMMEN', foot: 'Auf eine gute Nachbarschaft', ty: 80, title: ['Viel Glück', 'im neuen Zuhause'],
}, texts));

const modern = make(meta, Object.assign({
  pre: pre.bold('#ffffff', '#cfe3ff', 'Montserrat', '#2457b8'),
  layout: 'block', slug: 'neues-zuhause-modern', variant: 'Modern',
  desc: 'Moderne Klappkarte A6 zum neuen Zuhause: blaue Fläche, Haus im Kreis und „Neues Zuhause“ in kräftigen Versalien. Innen eine farbige Seite und Platz für deine Worte.',
  tags: ['modern', 'blau', 'Haus', 'Klappkarte', 'Wohnung', 'Einzug'],
  accent: '#3a7be0', soft: '#ffffff', motif: 'deko-motive-haus-schluessel-bunt', kicker: 'UMZUG GESCHAFFT', foot: 'Home, sweet home', ty: 95, title: ['Neues', 'Zuhause'],
}, texts));

const humorvoll = make(meta, Object.assign({
  pre: pre.fun('#e8505b', '#40343a'),
  layout: 'postp', slug: 'neues-zuhause-humorvoll', variant: 'Humorvoll',
  desc: 'Verspielte Postkarte A6 hoch zum Einzug: ein Umzugskarton im Kreis und „Frohes Auspacken!“ in Handschrift. Auf der Rückseite Platz für Gruß und Adresse.',
  tags: ['lustig', 'Umzugskarton', 'Postkarte', 'Auspacken', 'Kisten', 'Nachbarn'],
  bg: '#fff1e6', accent: '#e8505b', soft: '#ffffff', motif: 'deko-motive-umzugskarton-pastell', kicker: 'ZUM EINZUG', foot: 'Wo sind nur die Kaffeetassen?', ty: 98, title: ['Frohes', 'Auspacken!'],
  head: 'Ihr Lieben,', sign: 'Eure Nachbarn', body: 'Kisten, Kisten, Kisten! Wir drücken euch die Daumen, dass ihr bald alles findet. Klingelt, wenn ihr Hilfe braucht!', pbody: 'Kisten, Kisten, Kisten! Wir drücken euch die Daumen, dass ihr bald alles findet. Klingelt, wenn ihr Hilfe braucht.',
}));

module.exports = { klassisch, modern, humorvoll };
