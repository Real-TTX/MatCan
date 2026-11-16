'use strict';
/* The demo of docs/PLAN.md section 1.2 ("Käsetheke – Preisschild", 150 x 100 mm) as a design document with its data rows. The single source is the file
   src/MatCan/Demo/kaesetheke.json, which the app embeds and seeds into an empty database (Services/DemoSeeder); the checks read the same file, so they
   work with exactly what a new installation shows.
   demoDocument()   the design document
   demoRows()       the first four cheeses (the checks count on four labels)
   demoRowsAll()    all rows of the seeded list
   demoMeta()       names of the design, the list and the output job */
const fs = require('fs');
const path = require('path');

const demo = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'MatCan', 'Demo', 'kaesetheke.json'), 'utf8'));

const clone = value => JSON.parse(JSON.stringify(value));

module.exports = {
  demoDocument: () => clone(demo.document),
  demoRows: () => clone(demo.rows.slice(0, 4)),
  demoRowsAll: () => clone(demo.rows),
  demoMeta: () => ({ design: demo.design.name, list: demo.list.name, output: demo.output.name }),
};
