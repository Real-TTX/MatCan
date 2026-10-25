#!/usr/bin/env node
/* Writes tests/DesignThix.Tests/Core/EngineAgreementDocuments.cs: documents (hostile, old, new element types) together with what DtEngine.normalize makes of them.
   The unit tests (DocumentValidatorTests.Validator_agrees_with_the_engine) feed the same documents to the C# DocumentValidator and compare the two results property by property,
   so the engine (wwwroot/js/dt-engine.js, the reference) and the server cannot drift apart. Re-run it, and the tests, whenever the rules of normalize change.
   Run: node tools/engine-agreement.js            (needs no browser: the engine runs in a node context)
   The value formats (ValueFormat <-> DtEngine.formatValue) are in EngineAgreementData.cs and are not touched by this script. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const engineFile = path.join(root, 'src', 'DesignThix', 'wwwroot', 'js', 'dt-engine.js');
const outFile = path.join(root, 'tests', 'DesignThix.Tests', 'Core', 'EngineAgreementDocuments.cs');

const sandbox = { console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(engineFile, 'utf8'), sandbox, { filename: 'dt-engine.js' });
const engine = sandbox.DtEngine;
if (!engine || typeof engine.normalize !== 'function') { throw new Error('DtEngine.normalize not found'); }

// ---------------------------------------------------------------------------------------------------- the documents (name -> JSON text)

const longText = (n) => 'x'.repeat(n);

const documents = {
  // schema 1, as the first version stored it, with everything hostile at once (upgraded to one page)
  HostileOne: JSON.stringify({
    schema: 1, unit: 'mm', width: -5, height: '150', dpi: 5000, locale: 'fr_FR', extra: 1,
    background: { color: '#ABC', asset: '  flag-de  ', fit: 'zoom', junk: true },
    fields: [{ key: 'Name', label: '', type: 'weird', sample: 'x', unknown: 1 }, { key: 'name', label: 'dup' }, { key: '1abc' }, { key: 'a-b' }, { key: 'Ünder' },
      { key: 'Preis', type: 'price', decimals: '3', sample: '2.5', required: true }, { key: 'Land', type: 'image', category: 'Flaggen' }, { key: 'N', type: 'number', decimals: 9 },
      { key: 'T', type: 'text', decimals: 2 }, { key: 'P2', type: 'price', decimals: null }, 'string', null],
    elements: [
      { id: 'a', type: 'text', text: 'Hi {{Name}}', fontSize: 5000, opacity: 7, rotation: 999, lineHeight: 0, color: 'red', fontWeight: '650', x: '12.5', w: -3, fit: 'shrink', minFontSize: 9999, wrap: false, evil: '<script>' },
      { id: 'a', type: 'image', source: { asset: ' k ', field: 'x' }, fit: 'stretch', radius: -1 },
      { type: 'imageStrip', items: [{ asset: 'a' }, { field: 'Land' }, { field: '9x' }, null, 'x', { asset: '' }, { asset: '1' }, { asset: '2' }, { asset: '3' }, { asset: '4' }, { asset: '5' }, { asset: '6' }, { asset: '7' }], gap: 2, align: 'middle' },
      { type: 'shape', shape: 'line', stroke: null, fill: '#FF00AA' },
      { type: 'shape', shape: 'line' },
      { type: 'shape', shape: 'circle', stroke: 'nope', dash: 'dotted' },
      { type: 'video' }, 5,
      { id: 'e3', type: 'text', showIf: 'Land', hidden: true, locked: true, italic: true, uppercase: true, align: 'right', valign: 'bottom' },
    ],
  }),
  // the demo of the first version (schema 1)
  Demo: JSON.stringify({
    schema: 1, unit: 'mm', width: 150, height: 100, dpi: 300, locale: 'de-DE', background: { color: '#ffffff', asset: null, fit: 'cover' },
    fields: [{ key: 'Name', label: 'Name', type: 'text', sample: 'Holunderblüte' }, { key: 'Preis', label: 'Preis', type: 'price', sample: '2.99', decimals: 2 },
      { key: 'Land', label: 'Herkunftsland', type: 'image', sample: 'flag-de', category: 'Flaggen' }, { key: 'Icon1', label: 'Siegel 1', type: 'image', sample: 'icon-bio', category: 'Siegel' }],
    elements: [
      { id: 'strip', type: 'imageStrip', name: 'Siegel', x: 6, y: 6, w: 70, h: 14, items: [{ field: 'Land' }, { field: 'Icon1' }, { asset: 'icon-neu' }], gap: 2, align: 'left' },
      { id: 'name', type: 'text', name: 'Name', x: 10, y: 30, w: 130, h: 22, text: '{{ Name }}', fontFamily: 'Kaushan Script', fontSize: 40, fontWeight: 400, color: '#1B2A49', align: 'center', valign: 'middle', fit: 'shrink', minFontSize: 12 },
      { id: 'price', type: 'text', name: 'Preis', x: 10, y: 60, w: 80, h: 30, text: '{{Preis}} €', fontSize: 60, align: 'right', showIf: 'Preis' },
      { id: 'border', type: 'shape', shape: 'rect', x: 1, y: 1, w: 148, h: 98, fill: null, stroke: '#333333', strokeWidth: 0.4, radius: 3 },
    ],
  }),
  // garbage of every kind (no schema, wrong types)
  Garbage: JSON.stringify({ unit: 'px', width: 'abc', height: null, locale: 'xx-YY', fields: 'nope', elements: [{ type: 'shape', shape: 'line' }, { type: 'text', fontSize: 'abc', color: '#12', text: 123 }] }),
  // schema 2: two pages, a group in a group, every new element type with legal values
  Pages: JSON.stringify({
    schema: 2, unit: 'mm', width: 85, height: 55, dpi: 300, locale: 'de-DE',
    fields: [{ key: 'Name', label: 'Name', type: 'text', sample: 'Anna' }, { key: 'Url', label: 'Adresse', type: 'text', sample: 'https://example.org' }, { key: 'Ean', label: 'EAN', type: 'text', sample: '400638133393' }],
    pages: [
      {
        id: 'front', name: 'Vorderseite', background: { color: null, gradient: { type: 'linear', angle: 90, stops: [{ offset: 0, color: '#18D4C0' }, { offset: 1, color: '#2f86f6' }] }, asset: 'bg', fit: 'contain' },
        elements: [
          { id: 't1', type: 'text', name: 'Titel', x: 5, y: 5, w: 60, h: 10, text: '{{Name}}', fontFamily: 'Montserrat', fontSize: 18, fontWeight: 700, underline: true, strike: true, list: 'bullet',
            outline: { color: '#FFFFFF', width: 0.5 }, background: { color: '#112233', radius: 1, padding: 2 }, curve: 40, shadow: { color: '#000', opacity: 0.4, blur: 1, x: 0.5, y: 0.5 }, flipX: true },
          { id: 'g1', type: 'group', name: 'Gruppe', x: 0, y: 0, w: 50, h: 20, rotation: 10, opacity: 0.8, shadow: { color: '#000000', opacity: 0.3, blur: 2, x: 1, y: 1 }, children: [
            { id: 's1', type: 'shape', shape: 'star', points: 8, innerRadius: 0.4, fill: { type: 'linear', angle: 45, stops: [{ offset: 0, color: '#f00' }, { offset: 0.5, color: '#0f0' }, { offset: 1, color: '#00f' }] }, stroke: '#000000', strokeWidth: 0.3 },
            { id: 'g2', type: 'group', x: 1, y: 1, w: 10, h: 10, children: [{ id: 'g3', type: 'group', children: [{ id: 'i1', type: 'icon', icon: 'heart', color: '#E11D48', strokeWidth: 1.5, x: 2, y: 2, w: 8, h: 8 }] }] },
          ] },
          { id: 'f1', type: 'image', source: null, mask: 'circle', crop: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 }, border: { color: '#ffffff', width: 2 }, filters: { brightness: 10, contrast: -10, saturation: 100, blur: 2, grayscale: true, sepia: false }, x: 60, y: 5, w: 20, h: 20 },
          { id: 'ln', type: 'shape', shape: 'line', x: 5, y: 30, w: 70, h: 0, stroke: '#ffffff', strokeWidth: 0.4, dash: 'dashed', startCap: 'circle', endCap: 'arrow' },
        ],
      },
      {
        id: 'back', name: 'Rückseite', background: { color: '#FFFFFF', gradient: null, asset: null, fit: 'cover' },
        elements: [
          { id: 'q1', type: 'qr', value: '{{Url}}', color: '#000000', background: null, ecc: 'H', quiet: false, x: 5, y: 5, w: 25, h: 25 },
          { id: 'b1', type: 'barcode', format: 'ean13', value: '{{Ean}}', color: '#000000', background: '#ffffff', showText: false, fontFamily: 'Roboto', x: 35, y: 5, w: 40, h: 20 },
          { id: 'b2', type: 'barcode', format: 'code128', value: 'ABC-123', x: 35, y: 30, w: 40, h: 15 },
        ],
      },
    ],
  }),
  // schema 2, hostile values for everything that is new
  HostileTwo: JSON.stringify({
    schema: 2, unit: 'px', width: 1080, height: 1080, locale: 'de-DE', extra: [1],
    pages: [
      { id: 'p', name: longText(200), background: { color: 'blue', gradient: { type: 'radial', angle: 999, stops: [{ offset: 5, color: '#fff' }, { offset: -1, color: 'nope' }, { color: '#000' }, 7, null] }, asset: ' x ', fit: 'stretch' }, elements: [
        { id: 'i', type: 'icon', icon: 'Heart', color: 'x', strokeWidth: 99 },
        { id: 'i2', type: 'icon', icon: '../../etc/passwd', strokeWidth: 0 },
        { id: 'i3', type: 'icon', icon: 'a'.repeat(65) },
        { id: 'i4', type: 'icon', icon: 'ok-name-2' },
        { id: 'q', type: 'qr', value: longText(2000), ecc: 'X', background: 'javascript:1', quiet: 'yes' },
        { id: 'b', type: 'barcode', format: 'upc', value: longText(200), showText: 0, fontFamily: '', background: null },
        { id: 'sh', type: 'shape', shape: 'star', points: 99, innerRadius: 5, fill: { stops: [{ color: '#fff' }] }, startCap: 'x', shadow: { color: 'red', opacity: 9, blur: 9999, x: 1e9, y: -1e9 } },
        { id: 'sh2', type: 'shape', shape: 'hexagon', fill: 'bad', stroke: '#FFF' },
        { id: 'sh3', type: 'shape', shape: 'speech', fill: { stops: [{ offset: 0, color: '#111' }, { offset: 1, color: '#222' }, { offset: 0.5, color: '#333' }, { offset: 0.6, color: '#444' }, { offset: 0.7, color: '#555' }, { offset: 0.8, color: '#666' }] } },
        { id: 'im', type: 'image', source: { asset: 'a' }, crop: { x: 5, y: -5, w: 0, h: 9 }, mask: 'blob', border: { color: 'x', width: 1e9 }, filters: { brightness: 1e9, blur: -5, grayscale: 'true' } },
        { id: 'im2', type: 'image', crop: 'all', border: 5, filters: 5, shadow: true },
        { id: 'tx', type: 'text', list: 'roman', outline: { width: 1e9 }, background: { color: 'x', radius: -1, padding: 1e9 }, curve: 1e9, underline: 'yes', strike: 1 },
        { id: 'tx2', type: 'text', outline: 5, background: 'red' },
        { id: 'st', type: 'imageStrip', mask: 'x', border: { width: 3 }, items: [{ asset: 'a' }] },
        { id: 'g', type: 'group', children: 'nope' },
        { id: 'g', type: 'group', x: 1, children: [{ id: 'g', type: 'text' }, { id: 'deep1', type: 'group', children: [{ id: 'deep2', type: 'group', children: [{ id: 'deep3', type: 'group', children: [{ id: 'tooDeep', type: 'text' }] }, { id: 'ok3', type: 'text' }] }] }] },
      ] },
      5,
      { id: 'p', elements: [{ type: 'shape' }] },
      'text',
      { name: 7, background: 5, elements: 'x' },
    ],
  }),
  // schema 2 without any page and without a list of pages at all
  NoPages: JSON.stringify({ schema: 2, unit: 'mm', width: 10, height: 10, pages: [] }),
  // schema 2 that still carries its elements at the top level (the engine reads them as the one page)
  TopLevel: JSON.stringify({ schema: 2, width: 20, height: 20, background: { color: '#123456' }, elements: [{ type: 'shape', shape: 'ellipse', fill: '#abcdef' }] }),
};

// ---------------------------------------------------------------------------------------------------- the file

const lines = [
  '// <auto-generated>',
  '// Produced by tools/engine-agreement.js, which loads wwwroot/js/dt-engine.js and prints JSON.stringify(DtEngine.normalize(doc)) for each document.',
  '// Re-run it (node tools/engine-agreement.js) when the engine changes its rules, then run the tests.',
  '// </auto-generated>',
  'namespace DesignThix.Tests.Core;',
  '',
  'internal static partial class EngineAgreementData',
  '{',
];
const names = Object.keys(documents);
for (const name of names) {
  const input = documents[name];
  const output = JSON.stringify(engine.normalize(JSON.parse(input)));
  for (const [suffix, text] of [['Input', input], ['Engine', output]]) {
    if (text.includes('"""')) { throw new Error('raw string clash in ' + name); }
    lines.push('    public const string ' + name + suffix + ' = """', text, '""";', '');
  }
}
lines.push('    /// <summary>The names of the documents above (the fields NameInput and NameEngine exist for each).</summary>');
lines.push('    public static readonly string[] DocumentNames = [' + names.map((n) => '"' + n + '"').join(', ') + '];');
lines.push('}', '');
fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
console.log('written ' + path.relative(root, outFile) + ' (' + names.length + ' documents)');
