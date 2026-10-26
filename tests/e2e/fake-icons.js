'use strict';
// Iconify and Fontsource (Google Fonts), played by fake-catalogs.js for the browser checks of plan 5 / C3 (so no check ever talks to the internet). The shapes are the real ones (verified against
// api.iconify.design and api.fontsource.org on 2026-10-26, see docs/PLAN-CATALOGS.md "C3 status"); the icon bodies in fixtures/iconify.json ARE real bodies of mdi (Apache-2.0), tabler (MIT),
// ph (MIT) and fa7-solid (CC BY 4.0, Font Awesome Free), fetched once; the fonts are the bundled ones served under other names (the families have made-up names where a real one could be bundled too: a family that the app has already is not added again).
//
//   Iconify    GET /collections  /collection?prefix=  /search?query&limit&start&prefix|prefixes  /{prefix}.json?icons=a,b        set the base address to the fake: DESIGNTHIX__Catalogs__iconify__BaseUrl
//   Fontsource GET /v1/fonts   and the files at /files/{id}@latest/latin-{weight}-{style}.woff2 (a TTF of the bundled fonts: the app goes by the bytes)       DESIGNTHIX__Catalogs__googlefonts__BaseUrl
//
// Special words in a search: "limit" (429 with Retry-After 120), "down" (500). Sets that must never be offered are in the list of /collections too: a set with colours (noto), a share-alike set,
// a non-commercial one and a GPL one; a search that asks for the word "leck" is answered with their icons as well (the app must not show them). /__stats counts what was asked.
const fs = require('fs');
const path = require('path');

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'iconify.json'), 'utf8'));

// 60 more icons in mdi so that a set has more than two pages (circles of different sizes: real names would not be real icons)
const mdi = fixture.icons.mdi;
for (let i = 1; i <= 60; i++) {
  mdi.icons['dot-' + String(i).padStart(2, '0')] = { body: `<circle cx="12" cy="12" r="${2 + (i % 9)}" fill="currentColor"/>` };
}

const SETS = Object.assign({}, fixture.sets, fixture.excluded);
SETS.mdi = Object.assign({}, SETS.mdi, { total: Object.keys(mdi.icons).length });

const FONTS = [
  // id, family, category, licence, weights, italic, a bundled file that stands in for its letters
  ['lobster', 'Lobster', 'display', 'OFL-1.1', [400], false, 'Kaushan Script'],
  ['fira-sans', 'Fira Sans', 'sans-serif', 'OFL-1.1', [300, 400, 500, 700], true, 'Source Sans 3'],
  ['ubuntu', 'Ubuntu', 'sans-serif', 'UFL-1.0', [300, 400, 500, 700], true, 'Open Sans'],
  ['kritzelschrift', 'Kritzelschrift', 'handwriting', 'OFL-1.1', [400, 700], false, 'Caveat'],
  ['plakat-kompakt', 'Plakat Kompakt', 'sans-serif', 'OFL-1.1', [400], false, 'Bebas Neue'],
  ['antiqua-fein', 'Antiqua Fein', 'serif', 'OFL-1.1', [300, 400, 500, 600, 700], true, 'Playfair Display'],
  ['tintenfluss', 'Tintenfluss', 'handwriting', 'OFL-1.1', [400, 500, 600, 700], false, 'Pacifico'],
  ['merriweather', 'Merriweather', 'serif', 'OFL-1.1', [300, 400, 700, 900], true, 'Lora'],
  ['rundlich-sans', 'Rundlich Sans', 'sans-serif', 'OFL-1.1', [200, 300, 400, 600, 700, 800], true, 'Montserrat'],
  ['special-elite', 'Special Elite', 'display', 'Apache-2.0', [400], false, 'Permanent Marker'],
  ['zilla-slab', 'Zilla Slab', 'serif', 'OFL-1.1', [300, 400, 500, 600, 700], true, 'Roboto Slab'],
  ['oswald-x', 'Oswald Condensed', 'sans-serif', 'OFL-1.1', [400, 700], false, 'Oswald'],
  // never offered: not under an allowed licence, from another source than Google Fonts, without Latin letters
  ['nur-privat', 'Nur privat', 'display', 'CC-BY-NC-4.0', [400], false, 'Pacifico'],
  ['gnu-schrift', 'Gnu Schrift', 'serif', 'GPL-3.0', [400], false, 'Lora'],
  ['andere-quelle', 'Andere Quelle', 'display', 'OFL-1.1', [400], false, 'Pacifico', 'other'],
  ['nur-koreanisch', 'Nur Koreanisch', 'sans-serif', 'OFL-1.1', [400], false, 'Open Sans', 'google', ['korean']],
];

function handle(req, res, ctx) {
  const { stats } = ctx;
  const url = new URL(req.url, 'http://127.0.0.1');
  const p = url.pathname;
  const q = name => url.searchParams.get(name) || '';
  const json = (status, body, headers) => { res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers || {})); res.end(JSON.stringify(body)); return true; };
  const count = key => { stats[key] = (stats[key] || 0) + 1; };

  // ------------------------------------------------------------------------------------------ Iconify
  if (p === '/collections') {
    count('iconify:collections');
    return json(200, SETS);
  }
  if (p === '/collection') {
    count('iconify:collection');
    const set = fixture.icons[q('prefix')];
    if (!set) { return json(404, { error: 'not found' }); }
    const names = Object.keys(set.icons).sort();
    return json(200, { prefix: q('prefix'), total: names.length, title: SETS[q('prefix')].name, uncategorized: names.filter((n, i) => i % 2 === 0), categories: { Weiteres: names.filter((n, i) => i % 2 === 1) }, hidden: [], aliases: {} });
  }
  if (p === '/search') {
    count('iconify:search');
    const query = q('query').toLowerCase();
    if (!query) { res.writeHead(400, { 'Content-Type': 'text/plain' }); res.end('Bad request'); return true; }
    if (query === 'limit') { return json(429, { error: 'rate limit' }, { 'Retry-After': '120' }); }
    if (query === 'down') { return json(500, { error: 'down' }); }
    const limit = Math.min(999, Math.max(32, Number(q('limit')) || 64));
    const start = Math.max(0, Number(q('start')) || 0);
    const wanted = q('prefix') ? [q('prefix')] : q('prefixes').split(',').filter(Boolean);
    const sets = query === 'leck' ? Object.keys(SETS) : (wanted.length ? wanted : Object.keys(fixture.icons));
    const found = [];
    for (const prefix of sets) {
      const set = fixture.icons[prefix];
      if (!set) { if (query === 'leck' && SETS[prefix]) { found.push(prefix + ':home'); } continue; }
      for (const name of Object.keys(set.icons).sort()) { if (query === 'leck' || name.includes(query)) { found.push(prefix + ':' + name); } }
    }
    const slice = found.slice(start, start + limit);
    return json(200, { icons: slice, total: slice.length, limit, start, collections: {}, request: { query } });
  }
  const bodies = p.match(/^\/([a-z0-9-]+)\.json$/);
  if (bodies && SETS[bodies[1]]) {
    count('iconify:bodies');
    const set = fixture.icons[bodies[1]];
    const names = q('icons').split(',').filter(Boolean);
    const icons = {};
    const missing = [];
    for (const name of names) {
      if (set && set.icons[name]) { icons[name] = set.icons[name]; }
      else if (!set) { icons[name] = { body: fixture.icons.mdi.icons.home.body }; }   // the sets that must never be offered answer with a house
      else { missing.push(name); }
    }
    const body = { prefix: bodies[1], lastModified: 1737398331, aliases: {}, width: set ? set.width : 24, height: set ? set.height : 24, icons };
    if (missing.length) { body.not_found = missing; }
    return json(200, body);
  }

  // ------------------------------------------------------------------------------------------ Fontsource
  if (p === '/v1/fonts') {
    count('fontsource:list');
    return json(200, FONTS.map(([id, family, category, license, weights, italic, , type, subsets]) => ({
      id, family, subsets: subsets || ['latin', 'latin-ext'], weights, styles: italic ? ['italic', 'normal'] : ['normal'], defSubset: 'latin', variable: false, lastModified: '2025-09-08',
      category, license, type: type || 'google',
    })));
  }
  const file = p.match(/^\/files\/([a-z0-9-]+)@latest\/latin-([1-9]00)-(normal|italic)\.woff2$/);
  if (file) {
    const entry = FONTS.find(f => f[0] === file[1]);
    if (!entry) { res.writeHead(404); res.end(); return true; }
    count('fontsource:file');
    const fontsDir = path.join(__dirname, '..', '..', 'src', 'DesignThix', 'wwwroot', 'fonts');
    const list = JSON.parse(fs.readFileSync(path.join(fontsDir, 'fonts.json'), 'utf8'));
    const bundled = list.find(f => f.family === entry[6] && f.style === 'normal') || list[0];
    const body = fs.readFileSync(path.join(fontsDir, bundled.file));
    res.writeHead(200, { 'Content-Type': 'font/woff2', 'Content-Length': body.length });
    res.end(body);
    return true;
  }
  return false;
}

module.exports = { handle, SETS, FONTS };
