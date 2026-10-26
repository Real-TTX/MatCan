'use strict';
/* Writes the numbered stub modules of batch T3a (300 to 399) from the family files `_t3a-<name>.js` (each exports `variants`).
   node tools/templates/_t3a-stubs.js   -> tools/templates/3NN-<slug>.js with  module.exports = require('./_t3a-<name>').variants[i];  (old stubs of this batch are removed first) */
const fs = require('fs');
const path = require('path');

const ORDER = [
  'wochenangebot', 'plakat-fest', 'veranstaltung', 'vereinsfest', 'flohmarkt', 'konzert', 'kurs', 'mittagstisch', 'lieferdienst', 'handwerker', 'reinigung', 'nachhilfe',
  'babysitter', 'wohnung-gesucht', 'tier-entlaufen', 'eroeffnung', 'sale', 'spendenaufruf', 'offene-tuer', 'plakat-event', 'plakat-kino', 'plakat-typo', 'plakat-minimal',
];
const MARK = '// t3a-stub';
for (const f of fs.readdirSync(__dirname)) {
  if (/^3\d\d-.*\.js$/.test(f) && fs.readFileSync(path.join(__dirname, f), 'utf8').startsWith(MARK)) fs.unlinkSync(path.join(__dirname, f));
}
let n = 300;
for (const name of ORDER) {
  const file = path.join(__dirname, `_t3a-${name}.js`);
  if (!fs.existsSync(file)) continue;
  const { variants } = require(file);
  variants.forEach((v, i) => {
    if (n > 399) throw new Error('range 300 to 399 is full');
    fs.writeFileSync(path.join(__dirname, `${n}-${v.slug}.js`), `${MARK}\nmodule.exports = require('./_t3a-${name}').variants[${i}];\n`);
    n++;
  });
}
console.log('stubs: ' + (n - 300));
