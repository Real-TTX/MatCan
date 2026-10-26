'use strict';
// Group "Ecken": one corner ornament each, drawn for the top left corner of a 400 x 400 box (a template flips it with flipX / flipY for the other corners).
const C = require('./corners');

const piece = (slug, name, palettes, tags, fn) => ({ slug, name, w: 400, h: 400, palettes, tags: ['Ecke', 'Eckornament', 'Rahmen', ...tags], draw: (c) => fn(c.p, c.r) });

const pieces = [
  piece('schnoerkel', 'Schnörkel', ['gold', 'rose', 'navy', 'schwarz', 'weiss'], ['Schnörkel', 'Ornament', 'Hochzeit', 'Urkunde', 'barock', 'elegant'], C.scrollCorner),
  piece('ranke', 'Ranke', ['gold', 'salbei', 'navy', 'weiss'], ['Ranke', 'Blätter', 'Hochzeit', 'Natur', 'Beeren'], C.vineCorner),
  piece('deco', 'Art Déco', ['gold', 'navy', 'schwarz', 'weiss'], ['Art Déco', 'Fächer', 'Gatsby', 'Silvester', 'elegant', 'geometrisch'], C.decoCorner),
  piece('blueten', 'Blüten', ['rose', 'pastell', 'gold', 'navy'], ['Blüten', 'Blumen', 'Hochzeit', 'Geburtstag', 'Frühling', 'Pfingstrose'], C.floralCorner),
  piece('lorbeer', 'Lorbeer', ['gold', 'salbei', 'navy', 'weiss'], ['Lorbeer', 'Zweige', 'Urkunde', 'Hochzeit'], C.laurelCorner),
  piece('eukalyptus', 'Eukalyptus', ['salbei', 'gold', 'weiss'], ['Eukalyptus', 'Boho', 'Hochzeit', 'Natur'], C.eucalyptusCorner),
  piece('klammer', 'Klammer', ['gold', 'navy', 'schwarz', 'weiss'], ['Klammer', 'Linie', 'schlicht', 'modern', 'Urkunde'], C.bracketCorner),
  piece('konfetti', 'Konfetti', ['bunt', 'pastell', 'gold'], ['Konfetti', 'Party', 'Geburtstag', 'Silvester', 'Kinder'], C.confettiCorner),
  piece('sterne', 'Sterne', ['gold', 'navy', 'weiss'], ['Sterne', 'Funkeln', 'Weihnachten', 'Silvester', 'Nacht', 'Kinder'], C.starCorner),
];

module.exports = { name: 'Ecken', slug: 'ecken', tags: ['Ecke', 'Deko'], pieces };
