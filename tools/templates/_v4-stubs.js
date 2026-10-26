/* Writes the numbered one-line modules 830-909 for batch V4, in the order of PARTS. Run: node tools/templates/_v4-stubs.js */
'use strict';
const fs = require('fs');
const path = require('path');
const PARTS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
for (const f of fs.readdirSync(__dirname)) { const m = /^(\d{3})-.*\.js$/.exec(f); if (m && +m[1] >= 830 && +m[1] <= 909) fs.unlinkSync(path.join(__dirname, f)); }
let n = 830;
for (const part of PARTS) {
  const file = path.join(__dirname, '_v4-' + part + '.js');
  if (!fs.existsSync(file)) continue;
  const { templates } = require(file);
  templates.forEach((t, i) => {
    fs.writeFileSync(path.join(__dirname, n + '-' + t.slug + '.js'), `'use strict';\nmodule.exports = require('./_v4-${part}').templates[${i}];\n`);
    n++;
  });
}
if (n > 910) throw new Error('more than 80 templates');
console.log('stubs 830 to ' + (n - 1));
