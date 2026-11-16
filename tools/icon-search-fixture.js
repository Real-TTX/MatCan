#!/usr/bin/env node
/* The fixture of tests/MatCan.Tests/Fixtures/icon-search.json: what the icon search of the EDITOR (D.iconSearch in wwwroot/js/designer.icons-de.js, with wwwroot/lib/icons.json) answers for a list of
   queries. The C# twin (Logic/IconSearch.cs) must answer the same; IconSearchTests compares the two (and, where node is installed, runs this script again to prove the fixture is current).
   node tools/icon-search-fixture.js            writes the fixture
   node tools/icon-search-fixture.js --stdout   prints it (what the test compares with) */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'src', 'MatCan', 'wwwroot');
const lib = JSON.parse(fs.readFileSync(path.join(root, 'lib', 'icons.json'), 'utf8'));
const sandbox = { window: { DtDesigner: {} } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'js', 'designer.icons-de.js'), 'utf8'), sandbox);
const D = sandbox.window.DtDesigner;

const QUERIES = [
  'käse', 'kase', 'kaese', 'KÄSE', 'kuh', 'ziege', 'milch', 'brot', 'kuchen', 'herz', 'stern', 'pfeil', 'wasser', 'wein', 'bier', 'auto', 'haus', 'uhr', 'kalender', 'preis', 'euro', 'sale', 'rabatt',
  'schloss', 'schloss burg', 'glühbirne', 'gluehbirne', 'strom', 'sonne', 'mond', 'mail', 'post', 'pizza', 'arrow', 'arrow right', 'user', 'tag', 'heart', 'star', 'ö', 'ß', 'fußball', 'fussball',
  'tier', 'hund katze', 'bio', 'öko', 'oko', 'oeko', 'ue', 'ae', 'oe', 'weihnachten', 'geburtstag', 'hoffest', 'party', 'qr', 'barcode', 'drucker', 'telefon', 'handy', 'blume baum', 'zzzzqq', 'fisch',
  'wandern', 'camping', 'urlaub', 'koffer', 'musik', 'kamera', 'buch', 'schere', 'hammer', 'apfel', 'zitrone', 'kaffee', 'tee', 'küche', 'restaurant', 'lieferung', 'geschenk', 'gutschein', 'neu', 'info',
  'warnung', 'häkchen', 'check', 'x', 'a', 'the', 'letter font', '  kaese   ',
];

const result = { generatedBy: 'tools/icon-search-fixture.js', total: Object.keys(lib.icons).length, queries: {} };
QUERIES.forEach(function (q) {
  const found = D.iconSearch(lib, q);
  result.queries[q] = { total: found.length, first: found.slice(0, 400) };
});

const text = JSON.stringify(result, null, 1) + '\n';
if (process.argv.includes('--stdout')) { process.stdout.write(text); } else {
  const target = path.join(__dirname, '..', 'tests', 'MatCan.Tests', 'Fixtures', 'icon-search.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
  console.log('written ' + target + ' (' + QUERIES.length + ' queries)');
}
