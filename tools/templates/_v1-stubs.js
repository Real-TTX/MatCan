/* Writes the numbered one-line modules 600 to 659 for batch V1 (20 themes x 3 variants), in the order of ORDER. Run: node tools/templates/_v1-stubs.js */
'use strict';
const fs = require('fs');
const path = require('path');
const { make, ORDER } = require('./_v1-lib');
for (const f of fs.readdirSync(__dirname)) if (/^6[0-7]\d-.*\.js$/.test(f)) fs.unlinkSync(path.join(__dirname, f));
let n = 600;
for (const id of ORDER) {
  for (let i = 0; i < 3; i++) {
    const t = make(id, i);
    fs.writeFileSync(path.join(__dirname, `${n}-${t.slug}.js`), `'use strict';\nmodule.exports = require('./_v1-lib').make('${id}', ${i});\n`);
    n++;
  }
}
if (n > 680) throw new Error('more than 80 templates');
console.log('stubs 600 to ' + (n - 1));
