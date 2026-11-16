/* The metadata rules of the built-in templates (plan 6), read from the C# sources so the tools and the app cannot drift apart:
     occasions  = TemplateMeta.Occasions   (src/MatCan.Core/Documents/TemplateMeta.cs)
     formats    = FormatPresets.All        (src/MatCan.Core/Documents/FormatPresets.cs): key -> { width, height, unit, fold, name }
   checkMeta(t, file) returns a list of problems for a template module (an empty list = fine). templates-build.js refuses to write a template with a problem.        */
'use strict';
const fs = require('fs');
const path = require('path');

const core = path.join(__dirname, '..', '..', 'src', 'MatCan.Core', 'Documents');

function readOccasions() {
  const text = fs.readFileSync(path.join(core, 'TemplateMeta.cs'), 'utf8');
  const block = /Occasions \{ get; \} =\s*\[([\s\S]*?)\];/.exec(text);
  if (!block) throw new Error('TemplateMeta.Occasions not found');
  return [...block[1].matchAll(/"([^"]+)"/g)].map(m => m[1]);
}

function readFormats() {
  const text = fs.readFileSync(path.join(core, 'FormatPresets.cs'), 'utf8');
  const formats = new Map();
  const re = /new\("([a-z0-9-]+)",\s*"([^"]*)",\s*\w+,\s*([\d.]+),\s*([\d.]+),\s*"(mm|px)"(?:,\s*"[^"]*",\s*"[^"]*"(?:,\s*"(none|vertical|horizontal)")?)?/g;
  let m;
  while ((m = re.exec(text))) formats.set(m[1], { key: m[1], name: m[2], width: Number(m[3]), height: Number(m[4]), unit: m[5], fold: m[6] || 'none' });
  if (formats.size < 20) throw new Error('FormatPresets.All could not be read (' + formats.size + ' entries)');
  return formats;
}

const occasions = readOccasions();
const formats = readFormats();
const folds = ['none', 'vertical', 'horizontal'];

/** The names of the two pages of a folded card (FormatPresets.FoldPageNames). */
const foldPageNames = fold => (fold === 'vertical' ? ['Außen (Rückseite | Vorderseite)', 'Innen'] : fold === 'horizontal' ? ['Außen (Rückseite oben | Vorderseite unten)', 'Innen'] : []);

function checkMeta(t) {
  const problems = [];
  const need = (cond, text) => { if (!cond) problems.push(text); };
  need(typeof t.slug === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(t.slug), 'slug must be lower case letters, digits and hyphens');
  need(t.name && t.category && t.description && t.description.length > 40, 'name, category and a description of more than 40 characters are needed');
  need(typeof t.family === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(t.family), 'family must be a slug (lower case, digits, hyphens)');
  need(typeof t.familyName === 'string' && t.familyName.length > 0 && t.familyName.length <= 120, 'familyName (German, e.g. "Geburtstagskarte") is needed');
  need(typeof t.variant === 'string' && t.variant.length > 0 && t.variant.length <= 60, 'variant (German style word, e.g. "Klassisch") is needed');
  need(occasions.includes(t.occasion), `occasion must be one of: ${occasions.join(', ')}`);
  need(Array.isArray(t.tags) && t.tags.length >= 3 && t.tags.length <= 30 && t.tags.every(x => typeof x === 'string' && x.length > 0 && x.length <= 40 && !x.includes(',')), 'tags: 3 to 30 German search words, none with a comma, at most 40 characters');
  const fold = t.fold || 'none';
  need(folds.includes(fold), 'fold must be none, vertical or horizontal');
  const format = formats.get(t.formatKey);
  need(!!format, `formatKey "${t.formatKey}" is no key of FormatPresets (see tools/templates/meta.js: formats)`);
  if (format) {
    const unit = t.unit || 'mm';
    need(format.width === t.width && format.height === t.height && format.unit === unit, `the size ${t.width} x ${t.height} ${unit} is not the size of the format ${t.formatKey} (${format.width} x ${format.height} ${format.unit})`);
    need(format.fold === fold, `fold "${fold}" differs from the format ${t.formatKey} ("${format.fold}")`);
  }
  if (fold !== 'none') {
    need(t.pages.length === 2, 'a folded card has exactly two pages (outside, inside)');
    need(t.pages.every((p, i) => p.name === foldPageNames(fold)[i]), `the pages of a folded card are named ${JSON.stringify(foldPageNames(fold))} (use foldCard() of dsl.js)`);
  }
  return problems;
}

module.exports = { occasions, formats, folds, foldPageNames, checkMeta };
