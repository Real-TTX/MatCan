'use strict';
// The real stock-photo providers of plan 5 (Pexels, Pixabay, Openverse in C2, Unsplash added later), played by fake-catalogs.js (so no check ever talks to the internet). Each speaks the shape of the provider's documentation
// (verified 2026-10-26, see docs/PLAN-CATALOGS.md "C2 status") and answers with the 45 pictures of the fake library:
//
//   Pexels    https://www.pexels.com/api/documentation/   key in the header "Authorization: testkey-pexels"
//             /v1/curated  /v1/search?query&orientation&color&locale&page&per_page  /v1/collections/featured  /v1/collections/{id}  /v1/photos/{id}   pictures /pexels-img/{id}/{size}.jpg
//   Pixabay   https://pixabay.com/api/docs/                key in the query "key=testkey-pixabay" (400 for another one, as Pixabay does)
//             /api/?q&lang&image_type&orientation&category&editors_choice&colors&safesearch&page&per_page&id   pictures /get/g{id}_{size}.jpg (a redirect to /cdn/...)
//   Unsplash  https://unsplash.com/documentation       key in the header "Authorization: Client-ID testkey-unsplash" (401 for another one)
//             /photos  /photos/{id}  /photos/{id}/download (the ping, counted)  /search/photos?query&page&per_page(<=30)&orientation&color&content_filter  /topics  /topics/{slug}/photos
//             pictures /unsplash-img/{id}?ixid=...&w=  (the search word "limit" answers 403 "Rate Limit Exceeded", as Unsplash does)
//   Openverse https://api.openverse.org/v1/                 anonymous or "Authorization: Bearer tok-abc" after POST /v1/auth_tokens/token/ with client_id=cid and client_secret=sec
//             /v1/images/?q&license_type&license&aspect_ratio&category&mature&page&page_size (at most 20, depth 240, as for anonymous requests)  /v1/images/{id}/  /v1/images/{id}/thumb/[?full_size=true]
//
// Special words in a search: "limit" (429 with Retry-After 120; Pixabay: with the rate headers only), "down" (500), "leer" (nothing), and for Openverse "leck": the provider ignores its own
// licence filter and sends the NC and ND pictures too (the app must not show them). The provider hosts are the fake's own address, which the operator names with
// MATCAN__Catalogs__<pexels|pixabay|openverse>__BaseUrl.
const COLOURS = ['red', 'orange', 'yellow', 'green', 'turquoise', 'blue', 'violet', 'pink', 'brown', 'black', 'gray', 'white'];
const KEYS = { pexels: 'testkey-pexels', pixabay: 'testkey-pixabay', unsplash: 'testkey-unsplash' };
const CREDENTIALS = { id: 'cid', secret: 'sec', token: 'tok-abc' };

const colourOf = item => COLOURS[Math.floor(item.hue / 30) % 12];
const usable = item => /^(CC0-1\.0|CC-BY-4\.0)$/.test(item.licence) && !item.foreignThumb;
const slug = text => text.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const icons = require('./fake-icons.js');

function handle(req, res, ctx) {
  // Iconify and Fontsource (plan 5 / C3) have a file of their own
  if (icons.handle(req, res, ctx)) { return true; }
  const { items, base, png, stats, collectionNames } = ctx;
  const url = new URL(req.url, 'http://127.0.0.1');
  const path = url.pathname;
  const q = name => url.searchParams.get(name) || '';
  const json = (status, body, headers) => { res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers || {})); res.end(JSON.stringify(body)); return true; };
  const image = (item, scale) => {
    const body = png(Math.round(item.width * scale), Math.round(item.height * scale), item.hue);
    res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': body.length });   // the label says JPEG, the bytes are PNG: the app goes by the bytes
    res.end(body);
    return true;
  };
  const count = key => { stats[key] = (stats[key] || 0) + 1; };
  const words = (item) => (item.title + ' ' + collectionNames[item.collection]).toLowerCase();
  const orientationOk = (item, o) => !o || o === 'any' || (o === 'landscape' || o === 'horizontal' || o === 'wide' ? item.width > item.height : o === 'portrait' || o === 'vertical' || o === 'tall' ? item.height > item.width : item.width === item.height);
  const paging = (list) => {
    const page = Math.max(1, Number(q('page')) || 1);
    const per = Math.min(80, Math.max(1, Number(q('per_page') || q('page_size')) || 15));
    return { page, per, slice: list.slice((page - 1) * per, page * per) };
  };

  // ------------------------------------------------------------------------------------------ Unsplash
  // https://unsplash.com/documentation (verified 2026-11-01): "Authorization: Client-ID <key>", at most 30 per page, the pictures at images.unsplash.com with the ixid in every address
  // (here: the fake's own /unsplash-img/{id}), links.download_location for the download ping, "403 Rate Limit Exceeded" instead of 429, Unsplash+ photos marked "premium"
  if (path === '/photos' || path === '/search/photos' || path === '/topics' || /^\/(photos\/[A-Za-z0-9_-]+(\/download)?|topics\/[a-z0-9-]+\/photos)$/.test(path)) {
    const usId = item => 'Uns' + item.id + 'xYz';
    const ixid = item => 'M3wxfake' + item.id;
    const unsplashRate = () => ({ 'X-Ratelimit-Limit': '50', 'X-Ratelimit-Remaining': String(Math.max(1, 50 - (stats.__unsplashCalls || 0) % 49)) });
    if (req.headers.authorization !== 'Client-ID ' + KEYS.unsplash) { return json(401, { errors: ['OAuth error: The access token is invalid'] }); }
    stats.__unsplashCalls = (stats.__unsplashCalls || 0) + 1;
    const img = (item, params) => `${base}/unsplash-img/${usId(item)}?ixid=${ixid(item)}&ixlib=rb-4.1.0${params || ''}`;
    const userName = item => slug(item.author);
    const photo = item => ({
      id: usId(item), slug: slug(item.title) + '-' + usId(item), created_at: '2024-05-14T08:21:11Z', updated_at: '2026-10-30T04:10:42Z', width: item.width * 4, height: item.height * 4, color: '#8c7a66', blur_hash: 'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.',
      description: item.id === 'f03' ? 'A very long description written by the photographer that goes on and on about the light of the evening in the mountains' : null,
      alt_description: item.title.toLowerCase(), premium: item.id === 'nc1' || item.id === 'nd1', plus: false,
      urls: item.foreignThumb
        ? { raw: 'http://evil.invalid/raw.jpg', full: 'http://evil.invalid/full.jpg', regular: 'http://evil.invalid/regular.jpg', small: 'http://evil.invalid/small.jpg', thumb: 'http://evil.invalid/thumb.jpg' }
        : { raw: img(item), full: img(item, '&q=85&fm=jpg&crop=entropy&cs=srgb'), regular: img(item, '&q=80&fm=jpg&w=1080&fit=max'), small: img(item, '&q=80&fm=jpg&w=400&fit=max'), thumb: img(item, '&q=80&fm=jpg&w=200&fit=max') },
      links: { self: `${base}/photos/${usId(item)}`, html: `https://unsplash.com/photos/${usId(item)}`, download: `https://unsplash.com/photos/${usId(item)}/download?ixid=${ixid(item)}`, download_location: `${base}/photos/${usId(item)}/download?ixid=${ixid(item)}` },
      likes: 12, liked_by_user: false, current_user_collections: [], sponsorship: null,
      user: {
        id: 'u' + userName(item), updated_at: '2026-10-30T04:10:42Z', username: userName(item), name: item.author, portfolio_url: null, bio: null, location: null,
        links: { self: `${base}/users/${userName(item)}`, html: `https://unsplash.com/@${userName(item)}`, photos: `${base}/users/${userName(item)}/photos`, likes: `${base}/users/${userName(item)}/likes` },
        profile_image: { small: `${base}/unsplash-img/avatar`, medium: `${base}/unsplash-img/avatar`, large: `${base}/unsplash-img/avatar` },
      },
    });
    const orient = item => item.width > item.height ? 'landscape' : item.height > item.width ? 'portrait' : 'squarish';
    const unsplashColour = item => ({ turquoise: 'teal', violet: 'purple', pink: 'magenta', brown: 'black', gray: 'black_and_white' })[colourOf(item)] || colourOf(item);
    const perPage = () => Math.min(30, Math.max(1, Number(q('per_page')) || 10));
    const pageSlice = list => { const page = Math.max(1, Number(q('page')) || 1); const per = perPage(); return { page, per, slice: list.slice((page - 1) * per, page * per) }; };
    // the Unsplash+ photos and the one whose addresses are on another host are in the answers: the app has to leave them out
    const all = items.filter(i => i.id !== 'unk');
    const shown = x => x.id !== 'nc1' && x.id !== 'nd1' && !x.foreignThumb;   // what an app may show: the others are Unsplash+ or have addresses on another host
    const topics = [{ slug: 'nature', title: 'Nature', collection: 'nature' }, { slug: 'food-drink', title: 'Food & Drink', collection: 'food' }, { slug: 'street-photography', title: 'Street Photography', collection: 'city' }];
    let um = path.match(/^\/photos\/([A-Za-z0-9_-]+)\/download$/);
    if (um) {
      const item = all.find(i => usId(i) === um[1]);
      if (!item) { return json(404, { errors: ["Couldn't find Photo"] }); }
      count('unsplash:download');
      stats.__lastUnsplashDownload = { id: um[1], ixid: url.searchParams.get('ixid') || '', ua: req.headers['user-agent'] || '' };
      (stats.__unsplashDownloads = stats.__unsplashDownloads || []).push(um[1]);
      return json(200, { url: img(item, '&dl=' + um[1]) }, unsplashRate());
    }
    um = path.match(/^\/photos\/([A-Za-z0-9_-]+)$/);
    if (um) {
      const item = all.find(i => usId(i) === um[1]);
      if (!item) { return json(404, { errors: ["Couldn't find Photo"] }); }
      count('unsplash:photo');
      return json(200, photo(item), unsplashRate());
    }
    if (path === '/photos') {
      count('unsplash:list');
      const { slice } = pageSlice(all);
      return json(200, slice.map(photo), unsplashRate());
    }
    if (path === '/topics') {
      count('unsplash:topics');
      const list = topics.map((t, i) => ({ id: 'tp' + i, slug: t.slug, title: t.title, description: 'x', total_photos: all.filter(x => x.collection === t.collection && shown(x)).length, status: 'open', featured: true, links: {} }));
      list.push({ id: 'tpx', slug: 'closed-topic', title: 'Beendet', total_photos: 4, status: 'closed' });
      return json(200, list, unsplashRate());
    }
    um = path.match(/^\/topics\/([a-z0-9-]+)\/photos$/);
    if (um) {
      const t = topics.find(x => x.slug === um[1]);
      if (!t) { return json(404, { errors: ["Couldn't find Topic"] }); }
      count('unsplash:topic');
      stats.__lastUnsplashTopic = { slug: um[1], orientation: q('orientation'), order_by: q('order_by') };
      const { slice } = pageSlice(all.filter(i => i.collection === t.collection && (!q('orientation') || orient(i) === q('orientation'))));
      return json(200, slice.map(photo), unsplashRate());
    }
    if (path === '/search/photos') {
      const query = q('query').toLowerCase();
      if (query === 'limit') { res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Ratelimit-Limit': '50', 'X-Ratelimit-Remaining': '0' }); res.end('Rate Limit Exceeded'); return true; }
      if (query === 'down') { return json(500, { errors: ['down'] }); }
      count('unsplash:search');
      stats.__lastUnsplash = { query: q('query'), orientation: q('orientation'), color: q('color'), content_filter: q('content_filter'), order_by: q('order_by'), per_page: q('per_page'), page: q('page'), ua: req.headers['user-agent'] || '', version: req.headers['accept-version'] || '' };
      const found = query === 'leer' ? [] : all.filter(i => (!query || words(i).includes(query)) && (!q('orientation') || orient(i) === q('orientation')) && (!q('color') || q('color') === unsplashColour(i)));
      const per = perPage();
      const { slice } = pageSlice(found);
      return json(200, { total: found.length, total_pages: Math.ceil(found.length / per), results: slice.map(photo) }, unsplashRate());
    }
  }
  const imgMatch = path.match(/^\/unsplash-img\/([A-Za-z0-9_-]+)$/);
  if (imgMatch) {
    if (imgMatch[1] === 'avatar') { return image({ width: 64, height: 64, hue: 200 }, 1); }
    const item = items.find(i => 'Uns' + i.id + 'xYz' === imgMatch[1]);
    if (!item) { res.writeHead(404); res.end(); return true; }
    const w = Number(q('w')) || 0;
    count('unsplash-img:' + (w ? 'w' + w : 'raw'));
    if (!q('ixid')) { count('unsplash-img:without-ixid'); }
    // what the browser sent: the thumbnails are loaded by the page itself, so this shows whether it kept its address to itself (no Referer)
    const seen = stats.__unsplashImgReferers = stats.__unsplashImgReferers || {};
    const ref = req.headers.referer || '(none)';
    seen[ref] = (seen[ref] || 0) + 1;
    return image(item, w >= 1000 ? 0.45 : 0.2);
  }

  // ------------------------------------------------------------------------------------------ Pexels
  if (path.startsWith('/v1/') && !path.startsWith('/v1/images') && !path.startsWith('/v1/auth_tokens')) {
    if (req.headers.authorization !== KEYS.pexels) { return json(401, { error: 'Unauthorized' }); }
    const pid = item => 2000 + Number(item.id.slice(1));
    const photo = item => {
      const src = size => `${base}/pexels-img/${pid(item)}/${size}.jpg`;
      return {
        id: pid(item), width: item.width * 4, height: item.height * 4, url: `https://www.pexels.com/photo/${slug(item.title)}-${pid(item)}/`,
        photographer: item.author, photographer_url: `https://www.pexels.com/@${slug(item.author)}`, photographer_id: 100 + pid(item), avg_color: '#978E82',
        src: { original: src('original'), large2x: src('large2x'), large: src('large'), medium: src('medium'), small: src('small'), portrait: src('portrait'), landscape: src('landscape'), tiny: src('tiny') },
        liked: false, alt: item.title,
      };
    };
    const rate = { 'X-Ratelimit-Limit': '20000', 'X-Ratelimit-Remaining': String(19000 - (stats.__total || 0)), 'X-Ratelimit-Reset': String(Math.floor(Date.now() / 1000) + 9 * 86400) };
    const list = (all, array) => {
      const { page, per, slice } = paging(all);
      const body = { page, per_page: per, total_results: all.length };
      body[array || 'photos'] = slice.map(photo);
      if (page * per < all.length) { body.next_page = `${base}${path}?page=${page + 1}&per_page=${per}`; }
      return json(200, body, rate);
    };
    const good = items.filter(usable);
    const featured = [{ id: 'k4cheese', title: 'Käse & Co', collection: 'food' }, { id: 'natur99', title: 'Natur pur', collection: 'nature' }];
    if (path === '/v1/curated') { return list(good); }
    if (path === '/v1/search') {
      const query = q('query').toLowerCase();
      if (query === 'limit') { return json(429, { error: 'Rate limit exceeded' }, { 'Retry-After': '120' }); }
      if (query === 'down') { return json(500, { error: 'down' }); }
      if (query === 'leer') { return list([]); }
      const colour = q('color');
      return list(good.filter(i => (!query || words(i).includes(query)) && orientationOk(i, q('orientation')) && (!colour || colour === colourOf(i))));
    }
    if (path === '/v1/collections/featured') {
      return json(200, { collections: featured.map(c => ({ id: c.id, title: c.title, description: null, private: false, media_count: good.filter(i => i.collection === c.collection).length + 1, photos_count: good.filter(i => i.collection === c.collection).length, videos_count: 1 })), page: 1, per_page: 24, total_results: featured.length }, rate);
    }
    let m = path.match(/^\/v1\/collections\/([A-Za-z0-9]+)$/);
    if (m) {
      const c = featured.find(x => x.id === m[1]);
      if (!c) { return json(404, { error: 'Not Found' }); }
      const all = good.filter(i => i.collection === c.collection).map(photo).map(p => Object.assign({ type: 'Photo' }, p));
      all.push({ type: 'Video', id: 99999, width: 1920, height: 1080, url: 'https://www.pexels.com/video/x-99999/' });
      const { page, per, slice } = paging(all);
      return json(200, { id: m[1], media: slice, page, per_page: per, total_results: all.length }, rate);
    }
    m = path.match(/^\/v1\/photos\/(\d+)$/);
    if (m) { const item = good.find(i => String(pid(i)) === m[1]); return item ? json(200, photo(item), rate) : json(404, { error: 'Not Found' }); }
    return json(404, { error: 'Not Found' });
  }
  let m = path.match(/^\/pexels-img\/(\d+)\/([a-z0-9]+)\.jpg$/);
  if (m) {
    const item = items.find(i => 2000 + Number(i.id.slice(1)) === Number(m[1]));
    if (!item) { res.writeHead(404); res.end(); return true; }
    count('pexels-img:' + m[2]);
    return image(item, ['medium', 'small', 'tiny'].includes(m[2]) ? 0.2 : 0.45);
  }

  // ------------------------------------------------------------------------------------------ Pixabay
  if (path === '/api/' || path === '/api') {
    if (q('key') !== KEYS.pixabay) { res.writeHead(400, { 'Content-Type': 'text/plain' }); res.end('[ERROR 400] Invalid or missing API key'); return true; }
    const query = q('q').toLowerCase();
    const rateHeaders = { 'X-RateLimit-Limit': '100', 'X-RateLimit-Remaining': String(1 + (stats.__total || 0) % 90), 'X-RateLimit-Reset': '30' };
    if (query === 'limit') { res.writeHead(429, Object.assign({ 'Content-Type': 'text/plain', 'Retry-After': '0' }, rateHeaders, { 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': '75' })); res.end('API rate limit exceeded'); return true; }
    if (query === 'down') { res.writeHead(500); res.end('down'); return true; }
    const pbId = item => 9000 + Number(item.id.slice(1));
    const hit = item => ({
      id: pbId(item), pageURL: `https://pixabay.com/photos/${slug(item.title)}-${pbId(item)}/`, type: item.collection === 'city' ? 'illustration' : 'photo',
      tags: `${item.title.toLowerCase()}, ${collectionNames[item.collection].toLowerCase()}`,
      previewURL: `${base}/get/g${pbId(item)}_150.jpg`, previewWidth: 150, previewHeight: 100,
      webformatURL: `${base}/get/g${pbId(item)}_640.jpg`, webformatWidth: 640, webformatHeight: Math.round(640 * item.height / item.width),
      largeImageURL: `${base}/get/g${pbId(item)}_1280.jpg`, imageWidth: item.width * 4, imageHeight: item.height * 4, imageSize: 4731420,
      views: 7671, downloads: 6439, likes: 5, comments: 2, user_id: 300 + pbId(item) % 50, user: item.author, userImageURL: `${base}/get/avatar.jpg`,
    });
    const categoryOf = { nature: 'nature', food: 'food', city: 'places' };
    const colour = q('colors') === 'lilac' ? 'violet' : q('colors');
    let all = items.filter(usable).filter(i => {
      if (q('id')) { return String(pbId(i)) === q('id'); }
      return (!query || words(i).includes(query)) && (!q('category') || categoryOf[i.collection] === q('category')) && orientationOk(i, q('orientation'))
        && (!colour || colour === colourOf(i)) && (q('editors_choice') !== 'true' || Number(i.id.slice(1)) % 4 === 0)
        && (!q('image_type') || q('image_type') === 'all' || q('image_type') === (i.collection === 'city' ? 'illustration' : 'photo'));
    });
    if (query === 'leer') { all = []; }
    const { slice } = paging(all);
    if (!q('id')) { stats['pixabay:search'] = (stats['pixabay:search'] || 0) + 1; }
    stats.__lastPixabay = { safesearch: q('safesearch'), lang: q('lang'), colors: q('colors'), category: q('category'), image_type: q('image_type'), editors_choice: q('editors_choice') };
    return json(200, { total: all.length, totalHits: all.length, hits: slice.map(hit) }, rateHeaders);
  }
  m = path.match(/^\/get\/g(\d+)_(\d+)\.jpg$/);
  if (m) {
    const item = items.find(i => 9000 + Number(i.id.slice(1)) === Number(m[1]));
    if (!item) { res.writeHead(404); res.end(); return true; }
    count('pixabay-get:' + m[2]);
    res.writeHead(302, { Location: `${base}/cdn/${m[1]}_${m[2]}.jpg` });   // the real "get" addresses lead to the CDN
    res.end();
    return true;
  }
  m = path.match(/^\/cdn\/(\d+)_(\d+)\.jpg$/);
  if (m) {
    const item = items.find(i => 9000 + Number(i.id.slice(1)) === Number(m[1]));
    if (!item) { res.writeHead(404); res.end(); return true; }
    count('pixabay-cdn:' + m[2]);
    return image(item, Number(m[2]) <= 640 ? 0.2 : 0.45);
  }

  // ------------------------------------------------------------------------------------------ Openverse
  if (path === '/v1/auth_tokens/token/' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      const form = new URLSearchParams(body);
      count('openverse:token');
      if (form.get('grant_type') === 'client_credentials' && form.get('client_id') === CREDENTIALS.id && form.get('client_secret') === CREDENTIALS.secret) {
        json(200, { access_token: CREDENTIALS.token, scope: 'read write', expires_in: 36000, token_type: 'Bearer' });
      } else {
        json(401, { error: 'invalid_client' });
      }
    });
    return true;
  }
  if (path.startsWith('/v1/images')) {
    const bearer = req.headers.authorization === 'Bearer ' + CREDENTIALS.token;
    if (bearer) { count('openverse:bearer'); }
    const uuid = item => '00000000-0000-4000-8000-' + String(items.indexOf(item) + 1).padStart(12, '0');
    const codes = { 'CC0-1.0': ['cc0', '1.0'], 'CC-BY-4.0': ['by', '4.0'], 'CC-BY-NC-4.0': ['by-nc', '4.0'], 'CC-BY-ND-4.0': ['by-nd', '4.0'], '': ['sampling+', '1.0'] };
    // every fifth usable picture is CC BY-SA, so the licence filter and the tile have something to tell apart
    const licenceOf = item => (item.licence === 'CC-BY-4.0' && Number(item.id.slice(1)) % 5 === 0) ? ['by-sa', '4.0'] : (codes[item.licence] || ['by', '4.0']);
    const result = item => {
      const [lic, ver] = licenceOf(item);
      return {
        id: uuid(item), title: item.title, indexed_on: '2020-04-25T22:56:33.120466Z', foreign_landing_url: `https://www.flickr.com/photos/${100 + Number(item.id.slice(1))}/${item.id}`,
        url: `https://live.staticflickr.com/2691/${item.id}_b.jpg`, creator: item.author, creator_url: `https://www.flickr.com/people/${slug(item.author)}`,
        license: lic, license_version: ver, license_url: `https://creativecommons.org/licenses/${lic}/${ver}/`, provider: 'flickr', source: 'flickr', category: item.collection === 'city' ? 'illustration' : 'photograph',
        filesize: null, filetype: null, tags: [{ name: item.title.toLowerCase(), accuracy: null, unstable__provider: 'flickr' }],
        attribution: `"${item.title}" by ${item.author} is licensed under CC ${lic.toUpperCase()} ${ver}.`, fields_matched: ['title'], mature: false,
        height: item.height, width: item.width, thumbnail: `${base}/v1/images/${uuid(item)}/thumb/`, detail_url: `${base}/v1/images/${uuid(item)}/`, related_url: `${base}/v1/images/${uuid(item)}/related/`, unstable__sensitivity: [],
      };
    };
    const limits = { 'x-ratelimit-limit-anon_burst': '20/min', 'x-ratelimit-available-anon_burst': String(1 + (stats.__total || 0) % 18), 'x-ratelimit-limit-anon_sustained': '200/day', 'x-ratelimit-available-anon_sustained': '199' };
    if (path === '/v1/images/' || path === '/v1/images') {
      const query = q('q').toLowerCase();
      if (query === 'limit') { return json(429, { detail: 'Request was throttled.' }, { 'Retry-After': '120' }); }
      if (query === 'down') { res.writeHead(502); res.end('bad gateway'); return true; }
      const size = Number(q('page_size')) || 20;
      const page = Number(q('page')) || 1;
      if (size > 20) { return json(400, { detail: 'page_size may not exceed 20 for anonymous requests' }); }
      if (size * page > 240) { return json(400, { detail: 'pagination depth may not exceed 240 for anonymous requests' }); }
      count('openverse:search');
      stats.__lastOpenverse = { license_type: q('license_type'), license: q('license'), aspect_ratio: q('aspect_ratio'), category: q('category'), mature: q('mature'), page_size: q('page_size'), bearer };
      const allowed = q('license') ? q('license').split(',') : null;
      let all = items.filter(i => query === 'leck' || (usable(i) && (!allowed || allowed.includes(licenceOf(i)[0]))));
      all = all.filter(i => (!query || query === 'leck' || words(i).includes(query)) && orientationOk(i, q('aspect_ratio')) && (!q('category') || q('category').split(',').includes(result(i).category)));
      if (query === 'leer') { all = []; }
      const slice = all.slice((page - 1) * size, page * size);
      return json(200, { result_count: Math.min(all.length, 240), page_count: Math.ceil(all.length / size), page_size: size, page, results: slice.map(result) }, limits);
    }
    const t = path.match(/^\/v1\/images\/([0-9a-f-]{36})\/thumb\/$/);
    if (t) {
      const item = items.find(i => uuid(i) === t[1]);
      if (!item) { res.writeHead(404); res.end(); return true; }
      const full = q('full_size') === 'true';
      count(full ? 'openverse:full' : 'openverse:thumb');
      return image(item, full ? 0.45 : 0.2);
    }
    const d = path.match(/^\/v1\/images\/([0-9a-f-]{36})\/$/);
    if (d) {
      const item = items.find(i => uuid(i) === d[1]);
      return item ? json(200, result(item), limits) : json(404, { detail: 'Not found.' });
    }
    return json(404, { detail: 'Not found.' });
  }
  return false;
}

module.exports = { handle, KEYS, CREDENTIALS, COLOURS };
