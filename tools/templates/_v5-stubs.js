'use strict';
/* Writes the numbered stub modules of batch V5 (910 to 999) from _v5-all.js.
   node tools/templates/_v5-stubs.js   -> tools/templates/9NN-<slug>.js with  module.exports = require('./_v5-all').list[i];  (old stubs of this batch are removed first) */
const fs = require('fs');
const path = require('path');
const MARK = '// v5-stub';
for (const f of fs.readdirSync(__dirname)) {
  if (/^9\d\d-.*\.js$/.test(f) && fs.readFileSync(path.join(__dirname, f), 'utf8').startsWith(MARK)) fs.unlinkSync(path.join(__dirname, f));
}
const { list } = require('./_v5-all');
let n = 910;
list.forEach((m, i) => {
  if (n > 999) throw new Error('range 910 to 999 is full');
  fs.writeFileSync(path.join(__dirname, `${n}-${m.slug}.js`), `${MARK}\nmodule.exports = require('./_v5-all').list[${i}];\n`);
  n++;
});
console.log('stubs: ' + (n - 910));
