'use strict';
const { make, S, pre } = require('./_v3-lib');
const meta = { family: 'neuer-job-karte', familyName: 'Glückwunsch zum neuen Job', occasion: 'Business', tags: ['Neuer Job', 'Jobwechsel', 'Karriere', 'Glückwunsch', 'Beförderung', 'Neustart', 'Erfolg', 'Karte'] };
const texts = {
  head: 'Liebe Nora,', sign: 'Dein Team',
  body: 'herzlichen Glückwunsch zum neuen Job! Wir freuen uns mit dir und sind sicher, dass du dort bald genauso glänzt wie bei uns. Wir wünschen dir einen tollen Start, nette Kollegen und viel Erfolg. Bleib in Kontakt!',
};

const modern = make(meta, Object.assign({
  pre: pre.bold('#ffffff', '#ffe08a', 'Montserrat', '#4a3a8c'),
  layout: 'block', slug: 'neuer-job-modern', variant: 'Modern',
  desc: 'Moderne Klappkarte A6 zum neuen Job: violette Fläche, eine Aktentasche im Kreis und „Neuer Job, neues Glück“ in Versalien. Innen eine farbige Seite für gute Wünsche.',
  tags: ['modern', 'Aktentasche', 'violett', 'Klappkarte', 'Karriere', 'Start'],
  accent: '#5a47b0', soft: '#ffe08a', motif: 'deko-motive-aktentasche-bunt', kicker: 'GLÜCKWUNSCH', foot: 'Viel Erfolg im neuen Job', ty: 94, title: ['NEUER JOB,', 'NEUES GLÜCK'],
}, texts));

const elegant = make(meta, Object.assign({
  pre: pre.elegant('#2f4a3a', '#7a8e5a', 'Parisienne', '#2f3a33'),
  layout: 'frame', slug: 'neuer-job-elegant', variant: 'Elegant',
  desc: 'Klappkarte A6 zum neuen Job: Lorbeer-Rahmen in Salbei, ein Kleeblatt als Glücksbringer und „Viel Erfolg im neuen Job“ in Schreibschrift. Innen Platz für Glückwünsche.',
  tags: ['elegant', 'Kleeblatt', 'Glück', 'Klappkarte', 'Salbei', 'Erfolg'],
  bg: '#f7f8f1', accent: '#7a8e5a', soft: '#e3e9d6', frame: 'deko-rahmen-ranke-hoch-salbei', motif: 'deko-motive-kleeblatt-bunt',
  kicker: 'GLÜCKWUNSCH', foot: 'Auf einen guten Start', ty: 78, title: ['Viel Erfolg', 'im neuen Job'],
}, texts));

const humorvoll = make(meta, Object.assign({
  pre: pre.fun('#2f86d6', '#2f3a46'),
  layout: 'postp', slug: 'neuer-job-humorvoll', variant: 'Humorvoll',
  desc: 'Frische Postkarte A6 hoch zum neuen Job: ein Papierflieger im Kreis und „Auf zu neuen Ufern!“ in Handschrift. Rückseite mit Platz für einen Gruß und die Adresse.',
  tags: ['lustig', 'Papierflieger', 'Postkarte', 'Neustart', 'Ufer', 'Handschrift'],
  bg: '#eaf4fe', accent: '#2f86d6', soft: '#ffffff', motif: 'deko-motive-papierflieger-pastell', kicker: 'NEUER JOB', foot: 'Montag wird jetzt spannend', ty: 98, title: ['Auf zu', 'neuen Ufern!'],
  head: 'Du Karrieretiger,', sign: 'Dein Team', body: 'viel Erfolg im neuen Job!', pbody: 'viel Erfolg im neuen Job! Wir sind sicher, du rockst das. Und wenn nicht: Wir haben Kuchen.',
}));

module.exports = { modern, elegant, humorvoll };
