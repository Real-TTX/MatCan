'use strict';
// A fake stock-photo provider for the browser checks of the catalogues (docs/PLAN-CATALOGS.md). It speaks the small API of the reference catalogue
// (src/MatCan/Catalogs/Providers/ExampleCatalog.cs) and answers with pictures it draws itself, so nothing ever leaves the machine:
//
//   GET /api/collections                       -> { collections: [{ id, name, count }] }
//   GET /api/search?query&collection&page&per_page&orientation&safe -> { total, page, items: [{ id, title, width, height, thumb, author, authorUrl, url, licence: { code, name, url } }] }
//   GET /api/items/{id}                        -> the item with "download" and "credit"
//   GET /img/{id}.png   thumbnails   GET /files/{id}.png   the picture itself
//   GET /__stats       what was asked (counts per path), POST /__reset
//
// Since plan 5 / C2 the same server also plays Pexels, Pixabay and Openverse (fake-providers.js: their documented shapes, keys "testkey-pexels" / "testkey-pixabay", credentials "cid:sec" for Openverse).
//
// What it holds: 45 pictures (nature, food, city) with authors and licences (CC0-1.0 and CC-BY-4.0), and the ones that must never appear: a CC-BY-NC picture, a CC-BY-ND picture, one without a
// licence, one whose thumbnail points to another host. Special words: "limit" answers 429 with Retry-After, "down" answers 500, "leer" finds nothing. The key of the search-only catalogue is "testkey-123"
// (header Authorization); a request without it answers 401. Used by catalogs-check.js; the app reaches it through MATCAN__Catalogs__example-browse__BaseUrl (and example-search).
//
//   node fake-catalogs.js [port, default 3073]     (standalone)      const { startFakeCatalogs } = require('./fake-catalogs.js')
const http = require('http');
const zlib = require('zlib');
const providers = require('./fake-providers.js');

const KEY = 'testkey-123';
const COLLECTIONS = [{ id: 'nature', name: 'Natur' }, { id: 'food', name: 'Essen' }, { id: 'city', name: 'Stadt' }];
const AUTHORS = ['Anna Beispiel', 'Ben Muster', 'Cem Probe', 'Dora Demo', 'Emil Test'];
const NAMES = {
  nature: ['Berglandschaft', 'Waldweg', 'Sonnenaufgang', 'Wiese im Sommer', 'Bergsee', 'Herbstlaub', 'Nebel im Tal', 'Küste bei Ebbe', 'Schneeberg', 'Blumenfeld', 'Wasserfall', 'Dünen', 'Birkenwald', 'Alpenrose', 'Morgentau'],
  food: ['Zitronen', 'Frisches Brot', 'Käseplatte', 'Tomaten', 'Kaffeetasse', 'Obstkorb', 'Gewürze', 'Pizza', 'Salat', 'Beeren', 'Honig', 'Nudeln', 'Kuchen', 'Äpfel', 'Oliven'],
  city: ['Skyline', 'Altstadtgasse', 'Brücke bei Nacht', 'Marktplatz', 'Straßenbahn', 'Hinterhof', 'Dachterrassen', 'Bahnhof', 'Hafen', 'Rathaus', 'Café-Terrasse', 'Fahrradweg', 'Hochhaus', 'Park im Frühling', 'Neonlichter'],
};

function crcTable() {
  const t = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) { c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } t[n] = c >>> 0; }
  return t;
}
const TABLE = crcTable();
function crc32(buf) { let c = 0xffffffff; for (const b of buf) { c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8); } return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** A PNG of w x h pixels: a diagonal gradient between two colours with a lighter disc, so every picture looks different and a crop is visible. */
function png(w, h, hue) {
  const colour = (shift, t) => {
    const k = (hue + shift) % 360;
    const f = n => { const a = (n + k / 60) % 6; return Math.round(255 * (0.55 - 0.45 * Math.max(0, Math.min(a, 4 - a, 1)))); };
    return [Math.round(f(5) * (1 - t * 0.35)), Math.round(f(3) * (1 - t * 0.35)), Math.round(f(1) * (1 - t * 0.35))];
  };
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const t = (x / w + y / h) / 2;
      let [r, g, b] = colour(t * 60, t);
      const dx = x - w * 0.62; const dy = y - h * 0.38;
      if (dx * dx + dy * dy < (Math.min(w, h) * 0.2) ** 2) { r = Math.min(255, r + 80); g = Math.min(255, g + 80); b = Math.min(255, b + 80); }
      const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function makeItems(authors) {
  const items = [];
  let n = 0;
  for (const c of COLLECTIONS) {
    NAMES[c.id].forEach((title, i) => {
      n++;
      const id = 'f' + String(n).padStart(2, '0');
      const by = n % 3 === 0;   // every third one needs the credit
      items.push({ id, title, collection: c.id, width: i % 3 === 0 ? 1200 : i % 3 === 1 ? 800 : 900, height: i % 3 === 0 ? 800 : i % 3 === 1 ? 1200 : 900, author: (authors || AUTHORS)[n % (authors || AUTHORS).length], licence: by ? 'CC-BY-4.0' : 'CC0-1.0', hue: (n * 29) % 360 });
    });
  }
  // what must never be offered
  items.push({ id: 'nc1', title: 'Nur privat nutzbar', collection: 'nature', width: 800, height: 600, author: 'Nina NC', licence: 'CC-BY-NC-4.0', hue: 10 });
  items.push({ id: 'nd1', title: 'Unveränderbar', collection: 'food', width: 800, height: 600, author: 'Nils ND', licence: 'CC-BY-ND-4.0', hue: 20 });
  items.push({ id: 'unk', title: 'Ohne Lizenz', collection: 'city', width: 800, height: 600, author: 'Uwe Unbekannt', licence: '', hue: 30 });
  items.push({ id: 'far', title: 'Fremdes Vorschaubild', collection: 'nature', width: 800, height: 600, author: 'Frida Fremd', licence: 'CC0-1.0', hue: 40, foreignThumb: true });
  return items;
}

const LICENCES = {
  'CC0-1.0': { code: 'CC0-1.0', name: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  'CC-BY-4.0': { code: 'CC-BY-4.0', name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
  'CC-BY-NC-4.0': { code: 'CC-BY-NC-4.0', name: 'CC BY-NC 4.0', url: 'https://creativecommons.org/licenses/by-nc/4.0/' },
  'CC-BY-ND-4.0': { code: 'CC-BY-ND-4.0', name: 'CC BY-ND 4.0', url: 'https://creativecommons.org/licenses/by-nd/4.0/' },
};

/** options.authors: other names for the photographers (the shots of the README use names that do not say "Beispiel"). */
function startFakeCatalogs(port, options) {
  const items = makeItems(options && options.authors);
  const stats = {};
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const host = req.headers.host || ('127.0.0.1:' + port);
    const base = 'http://' + host;
    const json = (status, body, headers) => { res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers || {})); res.end(JSON.stringify(body)); };
    const path = url.pathname;
    stats[path] = (stats[path] || 0) + 1;
    stats.__total = (stats.__total || 0) + 1;
    const shape = i => ({
      id: i.id, title: i.title, kind: 'photo', width: i.width, height: i.height,
      thumb: i.foreignThumb ? 'http://evil.invalid/thumb.png' : `${base}/img/${i.id}.png`,
      author: i.author, authorUrl: `${base}/u/${encodeURIComponent(i.author)}`, url: `${base}/photo/${i.id}`,
      licence: LICENCES[i.licence] || (i.licence ? { code: i.licence, name: i.licence, url: '' } : { code: '', name: '', url: '' }),
    });

    if (path === '/__stats') { return json(200, stats); }
    if (path === '/__reset') { for (const k of Object.keys(stats)) { delete stats[k]; } return json(200, {}); }

    // Pexels, Pixabay and Openverse as their documentation shows them (fake-providers.js)
    if (providers.handle(req, res, { items, base, png, stats, collectionNames: Object.fromEntries(COLLECTIONS.map(c => [c.id, c.name])) })) { return; }

    // a key that is sent must be the right one (the browsable catalogue sends none)
    if (path.startsWith('/api/') && req.headers.authorization !== undefined && req.headers.authorization !== KEY) { return json(401, { error: 'bad key' }); }

    if (path === '/api/collections') {
      return json(200, { collections: COLLECTIONS.map(c => ({ id: c.id, name: c.name, count: items.filter(i => i.collection === c.id && LICENCES[i.licence] && !/NC|ND/.test(i.licence)).length })) });
    }

    if (path === '/api/search') {
      const query = (url.searchParams.get('query') || '').toLowerCase();
      if (query === 'limit') { return json(429, { error: 'rate limit' }, { 'Retry-After': '120' }); }
      if (query === 'down') { return json(500, { error: 'down' }); }
      if (query === 'leer') { return json(200, { total: 0, page: 1, items: [] }); }
      const collection = url.searchParams.get('collection') || '';
      const orientation = url.searchParams.get('orientation') || '';
      const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
      const per = Math.min(50, Math.max(1, Number(url.searchParams.get('per_page')) || 30));
      const collectionName = id => (COLLECTIONS.find(c => c.id === id) || {}).name || '';
      // the words are looked for in the title and in the name of the collection (so "natur" finds the nature pictures)
      const found = items.filter(i => (!query || (i.title + ' ' + collectionName(i.collection)).toLowerCase().includes(query)) && (!collection || i.collection === collection)
        && (!orientation || (orientation === 'landscape' ? i.width > i.height : orientation === 'portrait' ? i.height > i.width : i.width === i.height)));
      return json(200, { total: found.length, page, items: found.slice((page - 1) * per, page * per).map(shape) });
    }

    const item = path.match(/^\/api\/items\/([A-Za-z0-9_-]+)$/);
    if (item) {
      const i = items.find(x => x.id === item[1]);
      if (!i) { return json(404, { error: 'not found' }); }
      return json(200, Object.assign(shape(i), { download: `${base}/files/${i.id}.png`, credit: `Foto von ${i.author} (${(LICENCES[i.licence] || {}).name || ''}) bei Beispielbilder` }));
    }

    const img = path.match(/^\/(img|files)\/([A-Za-z0-9_-]+)\.png$/);
    if (img) {
      const i = items.find(x => x.id === img[2]);
      if (!i) { res.writeHead(404); return res.end(); }
      const thumb = img[1] === 'img';
      const scale = thumb ? 0.2 : 0.4;
      const body = png(Math.round(i.width * scale), Math.round(i.height * scale), i.hue);
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': body.length });
      return res.end(body);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve({
      port, server, stats, items, key: KEY,
      reset: () => { for (const k of Object.keys(stats)) { delete stats[k]; } },
      close: () => new Promise(done => server.close(() => done())),
    }));
  });
}

module.exports = { startFakeCatalogs, KEY, providers };

if (require.main === module) {
  const port = Number(process.argv[2]) || 3073;
  startFakeCatalogs(port).then(() => console.log(`fake catalogue provider on http://127.0.0.1:${port}`));
}
