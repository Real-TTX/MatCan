'use strict';
const { make, S, pre } = require('./_v3-lib');
const meta = { family: 'hauskauf-karte', familyName: 'Glückwunsch zum Hauskauf', occasion: 'Kinder & Familie', tags: ['Hauskauf', 'Eigenheim', 'Haus', 'Eigentum', 'Glückwunsch', 'Richtfest', 'Schlüsselübergabe', 'Immobilie', 'Karte'] };
const texts = {
  head: 'Liebe Sabine, lieber Peter,', sign: 'Eure Freunde',
  body: 'herzlichen Glückwunsch zum Hauskauf! Aus einem Traum wird ein Zuhause. Wir wünschen euch viel Freude beim Planen, Streichen und Einrichten und später viele schöne Feste unter eurem eigenen Dach. Auf euer Glück!',
};

const klassisch = make(meta, Object.assign({
  pre: pre.elegant('#5b4630', '#b07a3c', 'Great Vibes', '#3d362c'),
  layout: 'frame', slug: 'hauskauf-klassisch', variant: 'Klassisch',
  desc: 'Klappkarte A6 zum Hauskauf: Goldrahmen, ein Haus mit Schlüssel und „Glückwunsch zum eigenen Haus“ in Schreibschrift. Innen Platz für Wünsche an die neuen Eigentümer.',
  tags: ['klassisch', 'Haus', 'Schlüssel', 'Klappkarte', 'Gold', 'Eigentum'],
  bg: '#faf5ea', accent: '#b07a3c', soft: '#efe0c4', frame: 'deko-rahmen-doppellinie-hoch-gold', motif: 'deko-motive-haus-schluessel-bunt',
  kicker: 'ENDLICH ZUHAUSE', foot: 'Auf euer Glück', ty: 78, title: ['Glückwunsch', 'zum eigenen Haus'],
}, texts));

const modern = make(meta, Object.assign({
  pre: pre.modern('#2b4a3a', '#3f8f6a'),
  layout: 'post', slug: 'hauskauf-modern', variant: 'Modern',
  desc: 'Moderne Postkarte A6 quer zum Hauskauf: grüne Fläche mit Haus im Kreis und „Der Schlüssel ist da!“ in klarer Schrift. Rückseite für Gruß, Briefmarke und Adresse.',
  tags: ['modern', 'grün', 'Postkarte', 'Schlüssel', 'Haus', 'Einzug'],
  bg: '#f3faf5', accent: '#3f8f6a', soft: '#d9efe2', motif: 'deko-motive-haus-schluessel-pastell', kicker: 'HAUSKAUF', foot: 'Willkommen im Eigenheim', ty: 31, title: ['Der Schlüssel', 'ist da!'],
}, texts, { pbody: 'herzlichen Glückwunsch zum Hauskauf! Aus dem Traum wird ein Zuhause. Wir freuen uns mit euch.' }));

const humorvoll = make(meta, Object.assign({
  pre: pre.fun('#e8505b', '#40343a'),
  layout: 'square', slug: 'hauskauf-humorvoll', variant: 'Humorvoll',
  desc: 'Fröhliche quadratische Klappkarte zum Hauskauf: ein buntes Haus mit Schlüssel und „Endlich Hausbesitzer!“ in Handschrift. Innen ein Glückwunsch mit Augenzwinkern.',
  tags: ['lustig', 'witzig', 'Haus', 'quadratisch', 'Klappkarte', 'Hausbesitzer', 'Rasenmäher'],
  bg: '#fff0e0', accent: '#e8505b', soft: '#ffffff', motif: 'deko-motive-haus-schluessel-bunt', motif2: 'deko-motive-sektglaeser-bunt', pat: 'deko-muster-konfettipunkte-pastell', patOp: 0.45,
  kicker: 'GLÜCKWUNSCH', foot: 'Der Rasenmäher wartet schon', ty: 80, tilt: -3, title: ['Endlich', 'Hausbesitzer!'],
}, texts, { body: 'Ab jetzt gehört der Rasen euch und die Heizungsrechnung auch. Aber das Beste: Es gehört alles euch! Wir gratulieren und kommen zur Einweihung. Mit Sekt!' }));

module.exports = { klassisch, modern, humorvoll };
