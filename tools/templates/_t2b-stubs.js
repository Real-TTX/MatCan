/* Writes the numbered one-line modules 2NN-<slug>.js (200 to 299) for the families of batch T2b, in the order of FAMILIES. Run: node tools/templates/_t2b-stubs.js */
'use strict';
const fs = require('fs');
const path = require('path');
const FAMILIES = ['kigeb', 'einschulung', 'taufe', 'kommunion', 'konfirmation', 'babyparty', 'geburtsanzeige', 'party', 'jubilaeum-firma', 'jubilaeum-ehe', 'abschluss', 'halloween', 'silvester', 'sommerfest', 'grillfest', 'weihnachtsfeier'];
for (const f of fs.readdirSync(__dirname)) if (/^2\d\d-.*\.js$/.test(f)) fs.unlinkSync(path.join(__dirname, f));
let n = 200;
for (const fam of FAMILIES) {
  const file = path.join(__dirname, '_t2b-' + fam + '.js');
  if (!fs.existsSync(file)) continue;
  const { templates } = require(file);
  templates.forEach((t, i) => {
    fs.writeFileSync(path.join(__dirname, n + '-' + t.slug + '.js'), `'use strict';\nmodule.exports = require('./_t2b-${fam}').templates[${i}];\n`);
    n++;
  });
}
if (n > 300) throw new Error('more than 100 templates');
console.log('stubs 200 to ' + (n - 1));
