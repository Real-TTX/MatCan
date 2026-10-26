#!/usr/bin/env node
/* Writes the built-in templates: src/DesignThix/Demo/templates/<slug>.json (embedded into the app, seeded by Services/TemplateSeeder) from the compact sources in
   tools/templates/*.js (see tools/templates/dsl.js and the guide in docs/PLAN-TEMPLATES.md), and upgrades the demo file src/DesignThix/Demo/kaesetheke.json to document schema 2.
   Every document goes through the engine's normalize(), so the files are already normalised (the integration test checks that the server's validator
   changes nothing). The metadata of plan 6 (family, familyName, variant, occasion, tags, formatKey, number = the NN of the file name) is checked against the rules of the app
   (tools/templates/meta.js reads TemplateMeta.cs and FormatPresets.cs): a template with a problem is not written and the exit code is 1.
   Look at the result with:  node tools/templates-preview.js --out <folder>   and   node tools/templates-sheet.js --from 100 --to 199

   node tools/templates-build.js [--only slug,slug] [--from N --to M]                                                                        */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const demoDir = path.join(root, 'src', 'DesignThix', 'Demo');
const outDir = path.join(demoDir, 'templates');
const meta = require('./templates/meta');

global.window = global;
require(path.join(root, 'src', 'DesignThix', 'wwwroot', 'js', 'dt-engine.js'));
const engine = global.DtEngine;

const args = process.argv.slice(2);
const argValue = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const only = argValue('--only') ? argValue('--only').split(',') : null;
const from = argValue('--from') ? Number(argValue('--from')) : null;
const to = argValue('--to') ? Number(argValue('--to')) : null;

/** JSON with one line per element: readable and easy to diff, without a page of indentation per shape. */
function formatDocument(doc) {
  const one = value => JSON.stringify(value);
  const element = (e, indent) => {
    if (e.type !== 'group') return indent + one(e);
    const { children, ...rest } = e;
    const head = one(rest).slice(0, -1);
    return `${indent}${head},"children":[\n${children.map(c => element(c, indent + '  ')).join(',\n')}\n${indent}]}`;
  };
  const pages = doc.pages.map(p => {
    const { elements, ...rest } = p;
    return `    ${one(rest).slice(0, -1)},"elements":[\n${elements.map(e => element(e, '      ')).join(',\n')}\n    ]}`;
  });
  const { fields, pages: _pages, ...top } = doc;
  const topText = one(top).slice(1, -1);
  return `{\n  ${topText},\n  "fields": [\n${fields.map(f => '    ' + one(f)).join(',\n')}\n  ],\n  "pages": [\n${pages.join(',\n')}\n  ]\n}`.replace(/\n  "fields": \[\n\n  \]/, '\n  "fields": []');
}

function formatFile(file) {
  const parts = [`  "name": ${JSON.stringify(file.name)}`, `  "category": ${JSON.stringify(file.category)}`, `  "description": ${JSON.stringify(file.description)}`];
  if (file.family) {
    parts.push(`  "family": ${JSON.stringify(file.family)}`, `  "familyName": ${JSON.stringify(file.familyName)}`, `  "variant": ${JSON.stringify(file.variant)}`,
      `  "occasion": ${JSON.stringify(file.occasion)}`, `  "tags": ${JSON.stringify(file.tags)}`, `  "formatKey": ${JSON.stringify(file.formatKey)}`, `  "number": ${file.number}`);
  }
  parts.push(`  "document": ${formatDocument(file.document).split('\n').join('\n  ')}`);
  if (file.sampleRows && file.sampleRows.length) parts.push(`  "sampleRows": [\n${file.sampleRows.map(r => '    ' + JSON.stringify(r)).join(',\n')}\n  ]`);
  return '{\n' + parts.join(',\n') + '\n}\n';
}

function build(t, number) {
  const raw = {
    schema: 2, unit: t.unit || 'mm', width: t.width, height: t.height, dpi: t.dpi || (t.unit === 'px' ? 96 : 300), locale: 'de-DE',
    fields: t.fields || [],
    pages: t.pages.map((p, i) => Object.assign({ id: 'p' + (i + 1) }, p)),
  };
  if (t.fold && t.fold !== 'none') raw.fold = t.fold;
  const document = JSON.parse(JSON.stringify(engine.normalize(raw)));
  const result = { name: t.name, category: t.category, description: t.description, document, sampleRows: t.sampleRows || [] };
  if (t.family) Object.assign(result, { family: t.family, familyName: t.familyName, variant: t.variant, occasion: t.occasion, tags: t.tags, formatKey: t.formatKey, number });
  return result;
}

fs.mkdirSync(outDir, { recursive: true });
const modules = fs.readdirSync(path.join(__dirname, 'templates')).filter(f => /^\d+-.*\.js$/.test(f)).sort();
let failed = 0;
for (const file of modules) {
  const number = Number(/^(\d+)-/.exec(file)[1]);
  if ((from !== null && number < from) || (to !== null && number > to)) continue;
  const t = require(path.join(__dirname, 'templates', file));
  if (only && !only.includes(t.slug)) continue;
  const problems = meta.checkMeta(t);
  if (problems.length) {
    failed++;
    console.log(`${file}: NOT written`);
    problems.forEach(p => console.log('   - ' + p));
    continue;
  }
  const result = build(t, number);
  fs.writeFileSync(path.join(outDir, t.slug + '.json'), formatFile(result));
  const count = result.document.pages.reduce((n, p) => n + p.elements.length, 0);
  console.log(`${t.slug.padEnd(28)} ${result.document.width} x ${result.document.height} ${result.document.unit}, ${result.document.pages.length} page(s), ${count} elements${result.document.fold ? ', fold ' + result.document.fold : ''}`);
}

// The demo of the Käsetheke becomes schema 2 (pages): the document is only upgraded, not redrawn.
if (!only || only.includes('kaesetheke')) {
  const demoFile = path.join(demoDir, 'kaesetheke.json');
  const demo = JSON.parse(fs.readFileSync(demoFile, 'utf8'));
  if (demo.document.schema !== 2) {
    demo.document = JSON.parse(JSON.stringify(engine.normalize(demo.document)));
    const lines = [
      '{',
      `  "design": ${JSON.stringify(demo.design)},`,
      `  "list": ${JSON.stringify(demo.list)},`,
      `  "output": ${JSON.stringify(demo.output)},`,
      `  "document": ${formatDocument(demo.document).split('\n').join('\n  ')},`,
      `  "rows": [\n${demo.rows.map(r => '    ' + JSON.stringify(r)).join(',\n')}\n  ]`,
      '}',
    ];
    fs.writeFileSync(demoFile, lines.join('\n') + '\n');
    console.log('kaesetheke        upgraded to schema 2');
  }
}
process.exit(failed ? 1 : 0);
