/* Helpers of batch V2 (weddings II, numbers 680 to 749). Starts with an underscore: ignored as a module by templates-build.js.
   Every style line (_v2-<style>.js) exports { std, einl, tisch, menue, danke } (a template each); the numbered files only pick one.
   The templates join the EXISTING wedding families (same family and familyName as the first wedding batch) with a new variant. */
'use strict';
const L = require('./_t2a-lib');
const { text, rect, ellipse, line, icon, page, ctext, dk, dekoIn, deko, dekoWindow, foldCard, turn180, field, frameLine, tpl } = L;

const FAM = {
  std: { family: 'hochzeit-save-the-date', familyName: 'Hochzeit: Save the Date' },
  klapp: { family: 'hochzeit-einladung-klappkarte', familyName: 'Hochzeit: Einladung (Klappkarte)' },
  flach: { family: 'hochzeit-einladung-flach', familyName: 'Hochzeit: Einladung (flache Karte)' },
  tisch: { family: 'hochzeit-tischkarte', familyName: 'Hochzeit: Tischkarte' },
  menue: { family: 'hochzeit-menuekarte', familyName: 'Hochzeit: Menükarte' },
  danke: { family: 'hochzeit-danksagung', familyName: 'Hochzeit: Danksagung' },
};

const C = {
  couple: 'Anna & Jonas', a: 'Anna', b: 'Jonas', date: 'Samstag, 12. Juni 2027', dateShort: '12. Juni 2027', dateNum: '12.06.2027', weekday: 'Samstag',
  place: 'Gut Birkenhof', city: 'Musterstadt', address: 'Gut Birkenhof · Birkenallee 4 · 12345 Musterstadt', time: '14:00 Uhr',
  reply: 'Antwort bitte bis zum 1. Mai 2027',
};

/** One template of a kind: the family of the kind, the variant of the style, the rest from o. */
const make = (kind, S, o) => tpl(Object.assign({ occasion: 'Hochzeit', variant: S.variant }, FAM[kind], o));

const TISCH_META = {
  formatKey: 'table-card', fold: 'horizontal', width: 90, height: 100,
  fields: [field('Name', 'Name des Gastes', 'text', 'Marie Hoffmann'), field('Tisch', 'Tisch', 'text', '4')],
  sampleRows: [{ Name: 'Marie Hoffmann', Tisch: '4' }, { Name: 'Familie Meyer', Tisch: '1' }, { Name: 'Maximiliane Schneider-Hohenstein', Tisch: '12' }, { Name: 'Jo', Tisch: '7' }],
};

/** A tent card: face(y) draws one 90 x 50 mm face with its top at y; the back (upper half) is turned, the inside is a quiet page. */
const tent = (face, inside, bg, bgInside = bg) => foldCard('horizontal', [turn180(face(0), 45, 25), face(50)], inside, bg, bgInside);

/** Left aligned text. */
const ltext = (name, x, y, w, h, value, o = {}) => text(name, x, y, w, h, value, Object.assign({ a: 'left' }, o));

/** A pill (rounded rectangle) with a centred text. */
function pill(name, x, y, w, h, fill, value, o = {}) {
  return [rect(name, x, y, w, h, fill, { radius: h / 2, locked: true, stroke: o.stroke, sw: o.sw }), ctext(name + ' Text', x + w / 2, y, w - 4, h, value, o)];
}

/** The sample menu: [course, dish] (dishes may have line breaks). */
const MENU = [
  ['Vorspeise', 'Tomaten-Mozzarella-Türmchen\nmit Basilikumöl'],
  ['Suppe', 'Kräuterschaumsuppe\nmit Croûtons'],
  ['Hauptgang', 'Rosa gebratene Entenbrust\nmit Orangenjus, Kartoffelgratin\nund Honigkarotten'],
  ['Vegetarisch', 'Ricotta-Tortelloni\nmit Salbeibutter'],
  ['Dessert', 'Hochzeitstorte\nund Kaffeespezialitäten'],
];

module.exports = Object.assign({}, L, { FAM, C, make, TISCH_META, tent, ltext, pill, MENU });
