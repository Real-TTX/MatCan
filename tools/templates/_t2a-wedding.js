/* The three style lines of the wedding set (batch T2a). The same variant names run through every wedding kind, so a couple can take a matching set:
   "Klassisch Gold", "Botanisch Salbei" and "Modern Minimal". Tokens only: every kind draws its own layout with them. */
'use strict';
const L = require('./_t2a-lib');

const gold = {
  key: 'gold', variant: 'Klassisch Gold', short: 'Klassisch Gold',
  bg: '#fbf7ee', ink: '#3a3226', accent: '#a98334', line: '#c9a24b', soft: '#e8dcc0', paper2: '#f4ecd9',
  serif: 'Cormorant Garamond', caps: 'Cinzel', script: 'Great Vibes', sans: 'Cormorant Garamond',
  frameHoch: 'deko-rahmen-doppellinie-hoch-gold', frameQuer: 'deko-rahmen-doppellinie-quer-gold', frameLang: 'deko-rahmen-doppellinie-lang-gold', frameQuadrat: 'deko-rahmen-doppellinie-quadrat-gold',
  corner: 'deko-ecken-schnoerkel-gold', corner2: 'deko-ecken-deco-gold', divider: 'deko-trenner-schnoerkel-gold', schwung: 'deko-ornamente-schwung-gold', fleuron: 'deko-ornamente-fleuron-gold',
  wreath: 'deko-blumen-lorbeerkranz-gold', branch: 'deko-blumen-lorbeerzweig-gold', arch: 'deko-blumen-lorbeerbogen-gold', seal: 'deko-baender-siegel-zacken-gold', funkeln: 'deko-sterne-funkeln-gold',
};

const salbei = {
  key: 'salbei', variant: 'Botanisch Salbei', short: 'Botanisch Salbei',
  bg: '#f6f7f1', ink: '#33423a', accent: '#5f8167', line: '#9db79f', soft: '#dfe8dc', paper2: '#edf1e8',
  serif: 'Cormorant Garamond', caps: 'Josefin Sans', script: 'Allura', sans: 'Josefin Sans',
  wreath: 'deko-blumen-eukalyptuskranz-salbei', corner: 'deko-ecken-eukalyptus-salbei', corner2: 'deko-ecken-ranke-salbei', stem: 'deko-blumen-eukalyptuszweig-salbei', olive: 'deko-blumen-olivenzweig-salbei',
  divider: 'deko-trenner-blattreihe-salbei', frameHoch: 'deko-rahmen-ranke-hoch-salbei', frameQuer: 'deko-rahmen-ranke-quer-salbei', arch: 'deko-rahmen-bogen-salbei', oliveWreath: 'deko-blumen-olivenkranz-salbei', fern: 'deko-blumen-farnwedel-salbei',
};

const minimal = {
  key: 'minimal', variant: 'Modern Minimal', short: 'Modern Minimal',
  bg: '#ffffff', ink: '#1d1d1b', accent: '#b5836a', line: '#1d1d1b', soft: '#efe5dc', paper2: '#f6f1ec',
  serif: 'Cormorant Garamond', caps: 'Josefin Sans', script: 'Cormorant Garamond', sans: 'Josefin Sans',
};

const C = {
  couple: 'Anna & Jonas', a: 'Anna', b: 'Jonas', date: 'Samstag, 12. Juni 2027', dateShort: '12. Juni 2027', dateNum: '12.06.2027', weekday: 'Samstag',
  place: 'Gut Birkenhof', city: 'Musterstadt', address: 'Gut Birkenhof · Birkenallee 4 · 12345 Musterstadt', time: '14:00 Uhr',
  reply: 'Antwort bitte bis zum 1. Mai 2027',
};

module.exports = { gold, salbei, minimal, C, L };
