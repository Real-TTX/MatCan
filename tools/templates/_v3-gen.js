/* Writes the numbered stub files 750 to 829 from the family files: node tools/templates/_v3-gen.js (reads the sources, loads nothing) */
'use strict';
const fs = require('fs'), path = require('path');
const FAM = fs.readdirSync(__dirname).filter(f => /^_v3-f\d\d-.*\.js$/.test(f)).sort();
for (const f of fs.readdirSync(__dirname)) if (/^(7[5-9]\d|8[0-2]\d)-.*\.js$/.test(f)) fs.unlinkSync(path.join(__dirname, f));
let n = 750;
for (const f of FAM) {
  const src = fs.readFileSync(path.join(__dirname, f), 'utf8');
  const keys = /module\.exports = \{([^}]*)\}/.exec(src)[1].split(',').map(x => x.trim()).filter(Boolean);
  for (const key of keys) {
    const m = new RegExp('const ' + key + ' = make\\([^]*?slug: \'([a-z0-9-]+)\'').exec(src);
    if (!m) throw new Error('no slug for ' + key + ' in ' + f);
    fs.writeFileSync(path.join(__dirname, `${n}-${m[1]}.js`), `'use strict';\nmodule.exports = require('./${f.replace(/\.js$/, '')}').${key};\n`);
    n++;
  }
}
console.log('stubs up to', n - 1);
