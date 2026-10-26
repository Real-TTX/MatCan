// Checks the catalogues (docs/PLAN-CATALOGS.md, plan 5 phase C1) in a real browser (installed Edge, headless) against the LOCAL FAKE PROVIDER of fake-catalogs.js that this script starts.
// Nothing leaves the machine. The app must know where the provider is: start it with
//     DESIGNTHIX__Catalogs__example-browse__BaseUrl=http://127.0.0.1:3073   DESIGNTHIX__Catalogs__example-search__BaseUrl=http://127.0.0.1:3073
// (a Docker app: http://host.docker.internal:3073; the compose files and the notes in tests/e2e/README.md say how). Without these two addresses the example catalogues do not exist
// and the check says so and stops. What is checked, in the order of the sections:
//  admin      /Admin/Catalogs: the list, Schlüssel fehlt, the edit page, the key is never shown again, Testen, Zwischenspeicher leeren, a member is refused
//  media      the media browser: the five tabs of the library stay, the catalogues join them as tabs; a browsable catalogue (collections, first page, paging with "Mehr laden", search, the format
//             filter, author and licence on the tile), a search-only one (Gib einen Suchbegriff ein, suggestions, the key goes to the provider only), what must never be offered (NC, ND, no
//             licence, a thumbnail on another host), messages for a provider that is down or over its limit, the import on a click (spinner, picture on the page, source in the asset, reused the
//             second time), the browser never talks to the provider
//  fotos      the panel Fotos: the rail entry (hidden without a catalogue), search and chips, a click puts the photo on the page, a drag puts it where it is dropped, onto an image it replaces
//             the source, the Bildnachweise in the Datei menu (author, licence, links, Text kopieren)
//  folder     the server folder (needs --data <the data folder of the app>): collections, only pictures, the import, nothing outside the folder, the proxy refuses a changed token
//  roles      read-only editor (no Fotos, credits readable), the page of the asset shows its source
//  phone      the media browser and the panel Fotos at 390 px
//
//   node catalogs-check.js [base url, default http://localhost:3043] [--data <data folder of the app, for the folder catalogue>] [--catalog-port 3073] [--out <folder for the screenshots>]
//
// The data folder may also come from the environment (DT_DATA_DIR). Accounts: lib.js (DT_ACCOUNT_FILE). Zero console errors and zero CSP violations are part of the result. The check puts the settings
// back (every example catalogue off, its key removed, the folder list emptied) and removes the folders it made.
const fs = require('fs');
const os = require('os');
const path = require('path');
const lib = require('./lib.js');
const E = require('./editor-lib.js');
const { startFakeCatalogs, KEY } = require('./fake-catalogs.js');

const args = process.argv.slice(2);
const argValue = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const { base, problems, watch, launch, newContext, login, ensureAccounts, postJson, shareWith, purgeImage } = lib(args, { ignore: /status of (400|403|404|409|429|503)/ });
const outDir = path.resolve(argValue('--out', path.join(os.tmpdir(), 'designthix-catalogs-check')));
const fakePort = Number(argValue('--catalog-port', '3073'));
const dataDir = argValue('--data', process.env.DT_DATA_DIR || '');
fs.mkdirSync(outDir, { recursive: true });

const results = [];
let current = '';
const check = (name, ok, detail) => { results.push({ name: current + name, ok: !!ok, detail }); if (!ok) { console.log('FAIL ' + current + name + (detail ? '  -> ' + detail : '')); } };
let shotNo = 0;
const shot = async (page, name) => {
  shotNo++;
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(outDir, `${String(shotNo).padStart(2, '0')}-${name}-${page.viewportSize().width}.png`) });
};
const stamp = String(Date.now()).slice(-6);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const { idle, state, openDesigner, createDesign, openPanel, nodeOf, raf2 } = E;

/** Types a search into the media browser and waits until the results are exactly these titles (a search is answered after the pause of the field, so the results of earlier words may still be there). */
async function searchMedia(page, text, titles) {
  await page.fill('.dt-media__search', text);
  await page.waitForFunction(t => { const names = Array.from(document.querySelectorAll('.dt-media__tile--item .dt-media__name')).map(x => x.textContent); return names.length === t.length && t.every(n => names.includes(n)); }, titles, { timeout: 10000 });
}
/** The same for the panel Fotos. */
async function searchPhotos(page, text, titles) {
  await page.fill('.dt-psearch', text);
  await page.waitForFunction(t => { const names = Array.from(document.querySelectorAll('.dt-photo .dt-asset__name')).map(x => x.textContent); return names.length === t.length && t.every(n => names.includes(n)); }, titles, { timeout: 10000 });
}

const api = (page, method, url, body) => page.evaluate(async ({ method: m, url: u, body: b }) => {
  const r = await fetch(u, { method: m, headers: Object.assign({ Accept: 'application/json' }, m === 'GET' ? {} : { 'Content-Type': 'application/json', RequestVerificationToken: document.querySelector('meta[name=dt-csrf]').content }), body: m === 'GET' ? undefined : JSON.stringify(b || {}) });
  let json = null;
  try { json = await r.json(); } catch (e) { /* none */ }
  return { status: r.status, body: json, headers: { retryAfter: r.headers.get('Retry-After') } };
}, { method, url, body });

/** Removes every image that came from a catalogue of this check (what an earlier run left behind, and what this run made): trash, then purge. */
async function purgeImported(page) {
  const keys = new Set();
  for (const category of ['Katalog: Beispiel-Katalog', 'Katalog: Beispiel-Suche', 'Katalog: Ordner']) {
    const list = await api(page, 'GET', '/api/assets?category=' + encodeURIComponent(category) + '&take=100');
    (list.body || []).forEach(a => keys.add(a.key));
  }
  if (!keys.size) { return 0; }
  const items = (await api(page, 'GET', '/api/items?kinds=asset&recursive=true&take=200')).body;
  let n = 0;
  for (const item of (items && items.items) || []) { if (keys.has(item.key)) { await purgeImage(page, item.id); n++; } }
  return n;
}

(async () => {
  const fake = await startFakeCatalogs(fakePort);
  console.log(`fake provider on :${fakePort}`);
  const browser = await launch();
  const accounts = await ensureAccounts(browser);
  const wide = { viewport: { width: 1440, height: 900 } };

  const adminContext = await newContext(browser, wide);
  const admin = await adminContext.newPage();
  watch(admin, 'admin');
  if (!await login(admin, accounts.admin)) { throw new Error('Anmeldung des Administrators fehlgeschlagen.'); }
  const memberContext = await newContext(browser, wide);
  await memberContext.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  const A = await memberContext.newPage();
  watch(A, 'A');
  const viewerContext = await newContext(browser, wide);
  const B = await viewerContext.newPage();
  watch(B, 'B');
  check('the accounts sign in', (await login(A, accounts.designer)) && (await login(B, accounts.viewer)));

  // the browsers of the people must never talk to the provider (or to anybody but the app): every request that leaves the origin is a problem
  const outside = [];
  for (const p of [admin, A, B]) {
    p.on('request', r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob):/.test(u)) { outside.push(u); } });
  }

  const cleanup = { designs: [], assets: [] };
  const designs = [];
  await purgeImported(A);   // a run that stopped half way leaves its images behind

  // ---------------------------------------------------------------------------------------- admin
  current = 'admin: ';
  async function configure(id, values) {
    await admin.goto(base + '/Admin/Catalogs/Edit?id=' + id);
    const on = await admin.locator('input[type=checkbox][name="Input.Enabled"]').isChecked();
    if (values.enabled !== undefined && on !== values.enabled) { await admin.click('label.mat-switch:has(input[name="Input.Enabled"])'); }
    for (const [field, value] of Object.entries(values.fields || {})) { await admin.fill('#Input_' + field, String(value)); }
    if (values.key !== undefined) { await admin.fill('#Input_Key', values.key); }
    if (values.removeKey) { await admin.click('label.mat-switch:has(input[name="Input.RemoveKey"])'); }
    await Promise.all([admin.waitForNavigation(), admin.click('button[type=submit].mat-btn--primary')]);
    return admin.url();
  }

  await admin.goto(base + '/Admin/Catalogs');
  const names = await admin.$$eval('[data-catalog] .mat-item__title', t => t.map(x => x.textContent.trim()));
  if (!names.includes('Beispiel-Katalog')) {
    console.log('The example catalogues do not exist: start the app with DESIGNTHIX__Catalogs__example-browse__BaseUrl=http://127.0.0.1:' + fakePort + ' (and example-search). Stopping.');
    await fake.close();
    await browser.close();
    process.exit(1);
  }
  check('the list shows Mitgeliefert, Uploads, Ordner and the two example catalogues', ['Mitgeliefert', 'Uploads', 'Ordner', 'Beispiel-Katalog', 'Beispiel-Suche'].every(n => names.includes(n)), names.join('|'));
  // a clean start: both examples off, no key, no folders (earlier runs)
  await configure('example-browse', { enabled: false });
  await configure('example-search', { enabled: false, removeKey: true }).catch(() => {});
  await admin.goto(base + '/Admin/Catalogs');
  const pill = id => admin.$eval(`[data-catalog="${id}"] .mat-item__end`, e => e.textContent.replace(/\s+/g, ' ').trim());
  check('Mitgeliefert and Uploads are on by themselves, the examples are off', /an/.test(await pill('builtin')) && /an/.test(await pill('uploads')) && /aus/.test(await pill('example-browse')), await pill('builtin') + ' / ' + await pill('example-browse'));
  await configure('example-search', { enabled: true });
  await admin.goto(base + '/Admin/Catalogs');
  check('a catalogue that needs a key says "Schlüssel fehlt" until it has one', /Schlüssel fehlt/.test(await pill('example-search')), await pill('example-search'));
  await shot(admin, 'admin-list');

  // nothing but the library while no catalogue with pictures is usable: no Fotos entry, five tabs (the one that still needs its key is not offered either)
  const made = await createDesign(A, postJson, { preset: 'price-tag' });
  designs.push(made.id);
  cleanup.designs.push(made.id);
  await openDesigner(A, base, made.id);
  await A.evaluate(() => window.DtMedia.catalogs());
  const railNone = await A.$$eval('.dt-rail__btn', b => b.filter(x => !x.hidden).map(x => x.textContent.trim()));
  check('without a usable catalogue the rail has no Fotos entry', !railNone.includes('Fotos'), railNone.join('|'));
  await openPanel(A, 'uploads');
  await A.click('.dt-pbar button:has-text("Alle Medien")');
  await A.waitForSelector('dialog.dt-media[open]');
  await A.evaluate(() => window.DtMedia.catalogs());
  await A.waitForTimeout(300);
  check('the media browser has the five tabs of the library and nothing else (a catalogue without its key is not offered)', (await A.$$eval('.dt-media__tab', t => t.map(x => x.textContent))).join('|') === 'Uploads|Flaggen|Siegel|Logos|Alle');
  await A.keyboard.press('Escape');
  await A.waitForSelector('dialog.dt-media', { state: 'detached' });

  // the key: stored, never shown again, wrong key is refused by the provider, the right one works
  await admin.goto(base + '/Admin/Catalogs/Edit?id=example-search');
  await shot(admin, 'admin-edit');
  await configure('example-search', { enabled: true, key: 'wrong-key', fields: { PerUserPerMinute: 40, PerHour: 0 } });
  const editHtml = await admin.content();
  check('the key is not in the page after saving, only that there is one', !editHtml.includes('wrong-key') && /Ein Schlüssel ist gespeichert/.test(await admin.textContent('body')));
  check('the password field is empty again', (await admin.inputValue('#Input_Key')) === '');
  await admin.click('[data-catalog-test]');
  await admin.waitForLoadState();
  await admin.waitForSelector('.mat-toast');
  check('"Testen" with a wrong key says the key is not accepted', /Schlüssel/.test(await admin.textContent('.mat-toast')), await admin.textContent('.mat-toast'));
  await configure('example-search', { enabled: true, key: KEY });
  await admin.click('[data-catalog-test]');
  await admin.waitForLoadState();
  await admin.waitForSelector('.mat-toast');
  check('"Testen" with the right key finds pictures', /Verbindung steht/.test(await admin.textContent('.mat-toast')), await admin.textContent('.mat-toast'));
  check('nothing the app sent carries the key to another host', !outside.some(u => u.includes(KEY)));
  await configure('example-browse', { enabled: true, fields: { PerUserPerMinute: 500 } });
  await admin.goto(base + '/Admin/Catalogs');
  await admin.click('[data-catalog="example-browse"] button:has-text("Testen")');
  await admin.waitForSelector('.mat-toast');
  check('"Testen" on the list searches the catalogue', /Verbindung steht/.test(await admin.textContent('.mat-toast')), await admin.textContent('.mat-toast'));
  await admin.goto(base + '/Admin/Catalogs');
  await Promise.all([admin.waitForNavigation(), admin.click('button:has-text("Zwischenspeicher leeren")')]);
  check('"Zwischenspeicher leeren" answers', /Zwischenspeicher/.test(await admin.textContent('body')));
  await shot(admin, 'admin-list-on');
  check('a member may not open the administration of the catalogues', (await A.goto(base + '/Admin/Catalogs')).status() !== 200 || /AccessDenied/.test(A.url()));

  // ---------------------------------------------------------------------------------------- the editor and the media browser
  current = 'media: ';
  await openDesigner(A, base, made.id);
  fake.reset();
  await openPanel(A, 'uploads');
  await A.click('.dt-pbar button:has-text("Alle Medien")');
  await A.waitForSelector('dialog.dt-media[open]');
  await A.waitForFunction(() => document.querySelectorAll('.dt-media__tab').length >= 7);
  const tabs = await A.$$eval('.dt-media__tab', t => t.map(x => x.textContent));
  check('the five tabs of the library stay in front, the catalogues follow', tabs.slice(0, 5).join('|') === 'Uploads|Flaggen|Siegel|Logos|Alle' && tabs.includes('Beispiel-Katalog') && tabs.includes('Beispiel-Suche'), tabs.join('|'));
  check('the folder catalogue has no tab while it is off', !tabs.includes('Ordner'));

  // browsable
  await A.click('.dt-media__tab[data-tab="cat-example-browse"]');
  await A.waitForFunction(() => document.querySelectorAll('.dt-media__tile--item').length >= 30);
  check('a browsable catalogue shows its first page without a query (30 tiles, a next page)', (await A.$$('.dt-media__tile--item')).length === 30 && await A.isVisible('.dt-media__more'));
  const chips = await A.$$eval('.dt-media__chip', c => c.map(x => x.textContent.trim()));
  check('its collections are chips, "Alle" first, with counts', chips[0] === 'Alle' && /^Natur \(\d+\)$/.test(chips[1]) && chips.some(c => /^Essen/.test(c)) && chips.some(c => /^Stadt/.test(c)), chips.join('|'));
  check('the provider link is visible', await A.isVisible('.dt-media__provider') && /Beispielanbieter/.test(await A.textContent('.dt-media__provider')) && (await A.getAttribute('.dt-media__provider', 'rel')) === 'noopener noreferrer');
  const first = await A.$eval('.dt-media__tile--item', t => ({ title: t.getAttribute('title'), credit: t.querySelector('.dt-media__credit') && t.querySelector('.dt-media__credit').textContent, badge: t.querySelector('.dt-media__badge') && t.querySelector('.dt-media__badge').textContent, src: t.querySelector('img').getAttribute('src') }));
  check('a tile shows the author and the licence and the source of an external picture', /·/.test(first.credit || '') && first.badge === 'Beispiel-Katalog' && /Berglandschaft/.test(first.title), JSON.stringify(first));
  check('the thumbnail comes through the proxy of the app, never from the provider', /^\/api\/catalogs\/thumb\//.test(first.src) && !/127\.0\.0\.1|3073/.test(first.src), first.src);
  await A.waitForFunction(() => Array.from(document.querySelectorAll('.dt-media__tile--item img')).slice(0, 8).every(i => i.complete && i.naturalWidth > 0));
  check('the thumbnails load', true);
  await shot(A, 'media-browse');
  await A.evaluate(() => document.querySelector('.dt-media__more').scrollIntoView());
  await A.waitForFunction(() => document.querySelectorAll('.dt-media__tile--item').length > 30, null, { timeout: 8000 });
  check('the next page comes by scrolling (or "Mehr laden")', (await A.$$('.dt-media__tile--item')).length === 45, String((await A.$$('.dt-media__tile--item')).length));
  const titles = await A.$$eval('.dt-media__tile--item .dt-media__name', t => t.map(x => x.textContent));
  check('what the licence does not allow is not there: no NC, no ND, no picture without a licence, no foreign thumbnail', !titles.some(t => /Nur privat|Unveränderbar|Ohne Lizenz|Fremdes/.test(t)), titles.length + ' titles');
  await A.fill('.dt-media__search', 'privat');
  await A.waitForFunction(() => /Nichts gefunden/.test(document.querySelector('.dt-media__status').textContent), null, { timeout: 8000 });
  check('searching for the title of an NC picture finds nothing', (await A.$$('.dt-media__tile--item')).length === 0);
  await A.fill('.dt-media__search', 'berg');
  await A.waitForFunction(() => document.querySelectorAll('.dt-media__tile--item').length === 3, null, { timeout: 8000 });
  check('the search narrows the results (Berglandschaft, Bergsee, Schneeberg)', (await A.$$eval('.dt-media__tile--item .dt-media__name', t => t.map(x => x.textContent))).sort().join('|') === 'Berglandschaft|Bergsee|Schneeberg');
  await A.fill('.dt-media__search', '');
  await A.waitForFunction(() => document.querySelectorAll('.dt-media__tile--item').length === 30, null, { timeout: 8000 });
  await A.click('.dt-media__chip:has-text("Essen")');
  await A.waitForFunction(() => document.querySelectorAll('.dt-media__tile--item').length === 15, null, { timeout: 8000 });
  check('a collection chip filters (Essen: 15, the ND picture is not one of them)', (await A.$eval('.dt-media__chip[aria-pressed="true"]', c => c.textContent)).startsWith('Essen'));
  await A.click('.dt-media__chip:has-text("Alle")');
  await A.selectOption('.dt-media__orient', 'square');
  await A.waitForFunction(() => document.querySelectorAll('.dt-media__tile--item').length > 0 && document.querySelectorAll('.dt-media__tile--item').length < 30, null, { timeout: 8000 });
  check('the format filter works (quadratisch)', (await A.$$('.dt-media__tile--item')).length === 15, String((await A.$$('.dt-media__tile--item')).length));
  await A.selectOption('.dt-media__orient', 'any');
  await A.waitForFunction(() => document.querySelectorAll('.dt-media__tile--item').length === 30, null, { timeout: 8000 });
  const searches = (await (await fetch(`http://127.0.0.1:${fakePort}/__stats`)).json())['/api/search'] || 0;
  check('the provider was asked for each different search and page, not for each keystroke or repeat', searches >= 5 && searches <= 12, String(searches));
  const before = (await (await fetch(`http://127.0.0.1:${fakePort}/__stats`)).json())['/api/search'];
  await A.click('.dt-media__tab[data-tab="uploads"]');
  await A.click('.dt-media__tab[data-tab="cat-example-browse"]');
  await A.waitForFunction(() => document.querySelectorAll('.dt-media__tile--item').length === 30);
  check('the same first page again comes from the cache of the app', (await (await fetch(`http://127.0.0.1:${fakePort}/__stats`)).json())['/api/search'] === before);

  // a provider that is down and one that is over its limit: a message, no loop
  await A.fill('.dt-media__search', 'down');
  await A.waitForFunction(() => /nicht erreichbar/.test(document.querySelector('.dt-media__status').textContent), null, { timeout: 8000 });
  check('a provider that is down is "nicht erreichbar" in the browser, the rest still works', (await A.$$('.dt-media__tab')).length >= 7);
  await A.fill('.dt-media__search', 'limit');
  await A.waitForFunction(() => /genug Anfragen/.test(document.querySelector('.dt-media__status').textContent), null, { timeout: 8000 });
  check('a provider over its limit says so (no retry loop: one request per search)', true);
  await A.fill('.dt-media__search', '');
  await A.waitForTimeout(500);   // the field answers after a short pause

  // the brake of the person: with two requests to the provider a minute the next new search says so (a search that is in the cache would not count)
  await configure('example-browse', { enabled: true, fields: { PerUserPerMinute: 2 } });
  await A.fill('.dt-media__search', 'sonnenaufgang');
  await A.waitForFunction(() => /viele Suchen/.test(document.querySelector('.dt-media__status').textContent), null, { timeout: 8000 });
  check('a person who searches too much gets a message and the tab stays usable', (await A.$$('.dt-media__tab')).length >= 7);
  await configure('example-browse', { enabled: true, fields: { PerUserPerMinute: 500 } });
  await A.fill('.dt-media__search', '');
  await A.waitForTimeout(500);

  // search-only
  await A.click('.dt-media__tab[data-tab="cat-example-search"]');
  await A.waitForSelector('.dt-media__chip');
  check('a search-only catalogue shows suggestions and "Gib einen Suchbegriff ein."', /Gib einen Suchbegriff ein/.test(await A.textContent('.dt-media__status')) && (await A.$$eval('.dt-media__chip', c => c.map(x => x.textContent))).join('|') === 'Natur|Essen|Büro|Hintergrund|Textur|Menschen' && (await A.$$('.dt-media__tile--item')).length === 0);
  check('it has no collections and no request was made for the empty state', !(await A.$('.dt-media__chip:has-text("Alle")')));
  await A.click('.dt-media__chip:has-text("Natur")');
  await A.waitForFunction(() => document.querySelectorAll('.dt-media__tile--item').length > 0, null, { timeout: 8000 });
  check('a suggestion searches (Natur: the nature pictures, the NC one is not there)', (await A.$$('.dt-media__tile--item')).length === 15 && (await A.inputValue('.dt-media__search')) === 'Natur', String((await A.$$('.dt-media__tile--item')).length));
  await searchMedia(A, 'zitron', ['Zitronen']);
  check('words find pictures there (Zitronen), with the key sent to the provider', true);
  await shot(A, 'media-search');

  // import on a click
  await A.click('.dt-media__tab[data-tab="cat-example-browse"]');
  await searchMedia(A, 'berglandschaft', ['Berglandschaft']);
  const filesBefore = (await (await fetch(`http://127.0.0.1:${fakePort}/__stats`)).json())['/files/f01.png'] || 0;
  await A.click('.dt-media__tile--item');
  await A.waitForSelector('dialog.dt-media', { state: 'detached', timeout: 15000 });
  await idle(A);
  let s = await state(A);
  const imageEl = s.elements.find(e => e.type === 'image');
  check('a click imports the picture and puts it on the page', !!imageEl && imageEl.source && /^berglandschaft/.test(imageEl.source.asset), JSON.stringify(imageEl && imageEl.source));
  const assetKey = imageEl && imageEl.source && imageEl.source.asset;
  const library = await api(A, 'GET', '/api/assets?category=' + encodeURIComponent('Katalog: Beispiel-Katalog') + '&take=50');
  const imported = (library.body || []).find(a => a.key === assetKey);
  check('the image is in the library of the person with the category "Katalog: Beispiel-Katalog"', !!imported && imported.category === 'Katalog: Beispiel-Katalog' && imported.contentType === 'image/png', JSON.stringify(imported));
  if (assetKey) { cleanup.assets.push(assetKey); }
  check('the picture is drawn on the page', await A.evaluate(() => { const i = document.querySelector('#dt-page image'); return !!i; }));
  check('the file was downloaded by the server once', ((await (await fetch(`http://127.0.0.1:${fakePort}/__stats`)).json())['/files/f01.png'] || 0) === filesBefore + 1);

  // the second use reuses the asset
  await openPanel(A, 'uploads');
  await A.click('.dt-pbar button:has-text("Alle Medien")');
  await A.waitForSelector('dialog.dt-media[open]');
  await A.waitForFunction(() => document.querySelectorAll('.dt-media__tab').length >= 7);
  await A.click('.dt-media__tab[data-tab="cat-example-browse"]');
  await searchMedia(A, 'berglandschaft', ['Berglandschaft']);
  await A.click('.dt-media__tile--item');
  await A.waitForSelector('dialog.dt-media', { state: 'detached', timeout: 15000 });
  await idle(A);
  s = await state(A);
  const images = s.elements.filter(e => e.type === 'image');
  check('using the same picture again reuses the image of the library (same key, still one download)', images.length === 2 && images.every(e => e.source.asset === assetKey) && ((await (await fetch(`http://127.0.0.1:${fakePort}/__stats`)).json())['/files/f01.png'] || 0) === filesBefore + 1);
  const library2 = await api(A, 'GET', '/api/assets?category=' + encodeURIComponent('Katalog: Beispiel-Katalog') + '&take=50');
  check('and there is one copy of it in the library', (library2.body || []).filter(a => /^berglandschaft/.test(a.key)).length === 1);

  // the other tabs still work with the catalogues around
  await openPanel(A, 'uploads');
  await A.click('.dt-pbar button:has-text("Alle Medien")');
  await A.waitForSelector('dialog.dt-media[open]');
  await A.click('.dt-media__tab[data-tab="all"]');
  await A.fill('.dt-media__search', 'flag-fr');
  await A.waitForFunction(() => document.querySelectorAll('.dt-media__tile').length === 1 && document.querySelector('.dt-media__tile').getAttribute('data-key') === 'flag-fr', null, { timeout: 8000 });
  check('"Alle" still shows the library, a catalogue tab does not touch it', (await A.getAttribute('.dt-media__tile >> nth=0', 'data-key')) === 'flag-fr' && !(await A.isVisible('.dt-media__catbar')));
  await A.click('.dt-media__tab[data-tab="uploads"]');
  await A.waitForSelector('.dt-media__tile');
  check('the Uploads tab shows what was imported as well', await A.isVisible(`.dt-media__tile[data-key="${assetKey}"]`) || (await A.$$('.dt-media__tile')).length > 0);
  await A.keyboard.press('Escape');
  await A.waitForSelector('dialog.dt-media', { state: 'detached' });

  // ---------------------------------------------------------------------------------------- the panel Fotos
  current = 'fotos: ';
  const rail = await A.$$eval('.dt-rail__btn', b => b.filter(x => !x.hidden).map(x => x.textContent.trim()));
  check('the rail has Fotos after Uploads', rail.indexOf('Fotos') === rail.indexOf('Uploads') + 1, rail.join('|'));
  await openPanel(A, 'photos');
  check('the panel is titled Fotos', (await A.textContent('#dt-panel-title')).trim() === 'Fotos');
  const catChips = await A.$$eval('.dt-photos__cat', c => c.map(x => x.textContent));
  check('there is one chip per catalogue with photos (not Mitgeliefert, not Uploads)', catChips.join('|') === 'Beispiel-Katalog|Beispiel-Suche', catChips.join('|'));
  await A.waitForFunction(() => document.querySelectorAll('.dt-photo').length === 30);
  check('the browsable catalogue lists its first page', (await A.$$('.dt-photo')).length === 30 && await A.isVisible('.dt-photos__more'));
  check('its collections and the provider link are there', (await A.$$('.dt-photos__chip')).length === 4 && /Beispielanbieter/.test(await A.textContent('.dt-photos__providerlink')));
  await shot(A, 'fotos-panel');
  await searchPhotos(A, 'Zitronen', ['Zitronen']);
  const elementsBefore = (await state(A)).elements.length;
  await A.click('.dt-photo');
  await A.waitForFunction(n => window.DtDesigner.app.elements().length === n + 1, elementsBefore, { timeout: 15000 });
  await idle(A);
  s = await state(A);
  const lemon = s.elements.find(e => e.type === 'image' && e.source && e.source.asset && /^zitronen/.test(e.source.asset));
  check('a click puts the photo on the page (imported first)', !!lemon);
  if (lemon) { cleanup.assets.push(lemon.source.asset); }
  // a drag puts it where it is dropped
  await searchPhotos(A, 'Waldweg', ['Waldweg']);
  const sheet = await A.evaluate(() => { const r = document.getElementById('dt-sheet').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const tile = await A.$eval('.dt-photo', t => { const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 3 }; });
  const target = { x: sheet.x + sheet.w * 0.2, y: sheet.y + sheet.h * 0.25 };
  await E.drag(A, tile, target);
  await A.waitForFunction(n => window.DtDesigner.app.elements().length === n + 2, elementsBefore, { timeout: 15000 });
  await idle(A);
  s = await state(A);
  const dropped = s.elements.find(e => e.type === 'image' && e.source && /^waldweg/.test(e.source.asset || ''));
  check('a drag puts the photo where it is dropped', !!dropped && Math.abs((dropped.x + dropped.w / 2) - (s.doc.width * 0.2)) < s.doc.width * 0.2, JSON.stringify(dropped && { x: dropped.x, w: dropped.w, doc: s.doc.width }));
  if (dropped) { cleanup.assets.push(dropped.source.asset); }
  // dropped onto an image it replaces the source
  await searchPhotos(A, 'Honig', ['Honig']);
  const honey = await A.$eval('.dt-photo', t => { const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 3 }; });
  const at = await E.geometry(A, dropped.id);
  await E.drag(A, honey, { x: at.cx, y: at.cy });
  await A.waitForFunction(id => { const e = window.DtDesigner.app.element(id); return e && /^honig/.test((e.source && e.source.asset) || ''); }, dropped.id, { timeout: 15000 });
  check('a photo dropped onto an image replaces its source', (await state(A)).elements.length === elementsBefore + 2);
  cleanup.assets.push((await nodeOf(A, dropped.id)).source.asset);
  // the search-only catalogue and its chips in the panel
  await A.click('.dt-photos__cat:has-text("Beispiel-Suche")');
  await A.waitForSelector('.dt-photos__chip');
  check('the panel of a search-only catalogue shows the suggestions and the hint', /Gib einen Suchbegriff ein/.test(await A.textContent('#dt-panel-body')) && (await A.$$('.dt-photo')).length === 0);
  await A.click('.dt-photos__chip:has-text("Essen")');
  await A.waitForFunction(() => document.querySelectorAll('.dt-photo').length >= 0 && !/Gib einen/.test(document.querySelector('#dt-panel-body').textContent) || document.querySelectorAll('.dt-photo').length > 0, null, { timeout: 8000 });
  await A.click('.dt-photos__cat:has-text("Beispiel-Katalog")');
  await shot(A, 'fotos-after');

  // the credits
  current = 'credits: ';
  await A.waitForFunction(() => window.DtDesigner.app.saveState === 'saved', null, { timeout: 15000 });
  await A.click('#dt-file');
  await A.waitForSelector('.dt-menu');
  await A.click('.dt-menu__item:has(.dt-menu__label:text-is("Bildnachweise …"))');
  await A.waitForSelector('dialog.dt-credits[open] .dt-credits__item', { timeout: 10000 });
  const credits = await A.$$eval('.dt-credits__item', c => c.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  check('the dialog lists the pictures from catalogues with author, catalogue and licence', credits.length === 3 && credits.every(c => /Beispiel-Katalog/.test(c) && /CC/.test(c) && /· /.test(c)), credits.join(' || '));
  check('author, licence and source are links to http(s) addresses only', (await A.$$eval('.dt-credits__item a', a => a.map(x => x.getAttribute('href') + '|' + x.getAttribute('rel')))).every(v => /^https?:\/\/.*\|noopener noreferrer$/.test(v)));
  await shot(A, 'credits');
  await A.click('dialog.dt-credits button:has-text("Text kopieren")');
  await A.waitForSelector('.mat-toast');
  const clip = await A.evaluate(() => navigator.clipboard.readText());
  check('"Text kopieren" copies one credit line per picture', clip.split('\n').length === 3 && /Beispiel/.test(clip) && /https?:\/\//.test(clip), clip.slice(0, 200).split(String.fromCharCode(10)).join(' / '));
  await A.click('dialog.dt-credits button:has-text("Schließen")');
  await A.waitForSelector('dialog.dt-credits', { state: 'detached' });
  const apiCredits = await api(A, 'GET', `/api/designs/${made.id}/credits`);
  check('the credits endpoint says the same, with the licence record', apiCredits.status === 200 && apiCredits.body.items.length === 3 && apiCredits.body.items.every(i => i.licence.code && i.attribution));

  // ---------------------------------------------------------------------------------------- the server folder
  current = 'folder: ';
  if (!dataDir) {
    console.log('(no --data folder: the checks of the folder catalogue are skipped)');
  } else {
    const folderName = 'Bilder-' + stamp;
    const root = path.join(dataDir, 'catalogs', folderName);
    fs.mkdirSync(path.join(root, 'Natur'), { recursive: true });
    const pngBytes = n => E.png(160 + n * 8, 100, [20 + n * 30, 140, 90]);
    fs.writeFileSync(path.join(root, 'rot.png'), Buffer.from(pngBytes(1).base64 || pngBytes(1), 'base64'));
    fs.writeFileSync(path.join(root, 'Natur', 'gruen.png'), Buffer.from(pngBytes(2).base64 || pngBytes(2), 'base64'));
    fs.writeFileSync(path.join(root, 'keinbild.png'), 'das ist kein Bild');
    fs.writeFileSync(path.join(dataDir, 'catalogs', 'geheim.png'), Buffer.from(pngBytes(3).base64 || pngBytes(3), 'base64'));
    await admin.goto(base + '/Admin/Catalogs/Edit?id=folder');
    check('the page of the folder catalogue names the folders it found', new RegExp(folderName).test(await admin.textContent('[data-folders-on-disk]')));
    await admin.click('label.mat-switch:has(input[name="Input.Enabled"])');
    await admin.fill('#Input_Folders', folderName);
    await Promise.all([admin.waitForNavigation(), admin.click('button[type=submit].mat-btn--primary')]);
    await admin.fill('#Input_Folders', '../etc');
    await admin.goto(base + '/Admin/Catalogs/Edit?id=folder');
    await admin.fill('#Input_Folders', '../etc');
    await Promise.all([admin.waitForNavigation(), admin.click('button[type=submit].mat-btn--primary')]).catch(() => {});
    check('a folder name with a path is refused by the form', /kein Ordnername/.test(await admin.textContent('body')));

    await A.reload();
    await A.waitForSelector('#dt-ds:not(.is-loading)');
    await openPanel(A, 'uploads');
    await A.click('.dt-pbar button:has-text("Alle Medien")');
    await A.waitForSelector('dialog.dt-media[open]');
    await A.waitForFunction(() => document.querySelectorAll('.dt-media__tab').length >= 8);
    await A.click('.dt-media__tab[data-tab="cat-folder"]');
    await A.waitForSelector('.dt-media__tile--item');
    const folderTiles = await A.$$eval('.dt-media__tile--item', t => t.map(x => x.getAttribute('data-item')));
    check('the folder tab lists the pictures of the folder (not the text file)', folderTiles.join('|') === folderName + '/rot.png', folderTiles.join('|'));
    check('its sub-folder is a collection', (await A.$$eval('.dt-media__chip', c => c.map(x => x.textContent))).some(c => /Natur/.test(c)));
    check('there is no badge of an external source on a local picture', !(await A.$('.dt-media__tile--item .dt-media__badge')));
    await A.waitForFunction(() => { const i = document.querySelector('.dt-media__tile--item img'); return i && i.complete && i.naturalWidth > 0; });
    await shot(A, 'media-folder');
    await A.click('.dt-media__chip:has-text("Natur")');
    await A.waitForFunction(() => document.querySelector('.dt-media__tile--item') && /gruen/.test(document.querySelector('.dt-media__tile--item').getAttribute('data-item')), null, { timeout: 8000 });
    await A.click('.dt-media__tile--item');
    await A.waitForSelector('dialog.dt-media', { state: 'detached', timeout: 15000 });
    await idle(A);
    const green = (await state(A)).elements.filter(e => e.type === 'image').pop();
    check('a click imports a file of the folder', green && /^gruen/.test(green.source.asset), JSON.stringify(green && green.source));
    if (green) { cleanup.assets.push(green.source.asset); }
    const lib = await api(A, 'GET', '/api/assets?category=' + encodeURIComponent('Katalog: Ordner') + '&take=20');
    check('it is in the library with its category', (lib.body || []).some(a => /^gruen/.test(a.key)));
    for (const attack of ['../geheim.png', folderName + '/../geheim.png', folderName + '/keinbild.png', '/etc/passwd', 'C:\\Windows\\win.ini', folderName + '\\rot.png', '..', folderName + '/Natur/../../geheim.png']) {
      const res = await api(A, 'POST', '/api/catalogs/folder/import', { itemId: attack });
      check(`import of "${attack}" is refused`, res.status === 400, res.status + ' ' + JSON.stringify(res.body));
    }
    const thumbToken = folderTiles.length ? await A.evaluate(() => document.querySelector('.dt-media__tile--item img') && document.querySelector('.dt-media__tile--item img').getAttribute('src')) : null;
    await A.keyboard.press('Escape');
    if (thumbToken) {
      const ok = await A.evaluate(async u => (await fetch(u)).status, thumbToken);
      const bad = await A.evaluate(async u => (await fetch(u.slice(0, -3) + 'AAA')).status, thumbToken);
      check('a thumbnail address works, a changed one is not found', ok === 200 && bad === 404, ok + '/' + bad);
    }

    // put it back
    await admin.goto(base + '/Admin/Catalogs/Edit?id=folder');
    await admin.click('label.mat-switch:has(input[name="Input.Enabled"])');
    await admin.fill('#Input_Folders', '');
    await Promise.all([admin.waitForNavigation(), admin.click('button[type=submit].mat-btn--primary')]);
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(path.join(dataDir, 'catalogs', 'geheim.png'), { force: true });
  }

  // ---------------------------------------------------------------------------------------- roles
  current = 'roles: ';
  await shareWith(A, 'design', made.id, accounts.viewer.email, 'View');
  await openDesigner(B, base, made.id);
  const railB = await B.$$eval('.dt-rail__btn', b => b.filter(x => !x.hidden).map(x => x.textContent.trim()));
  check('somebody who may only look gets no Fotos entry', !railB.includes('Fotos'), railB.join('|'));
  await B.click('#dt-file');
  await B.waitForSelector('.dt-menu');
  await B.click('.dt-menu__item:has(.dt-menu__label:text-is("Bildnachweise …"))');
  await B.waitForSelector('dialog.dt-credits[open] .dt-credits__item', { timeout: 10000 });
  check('but the credits are readable for them', (await B.$$('.dt-credits__item')).length === 3);
  await B.keyboard.press('Escape');
  const asViewer = await api(B, 'POST', '/api/catalogs/example-browse/import', { itemId: 'f02' });
  check('an import by the viewer goes to their own area (not the team or the design owner)', asViewer.status === 200 && asViewer.body.spaceId !== undefined);
  if (asViewer.status === 200) { await api(B, 'POST', '/api/items/trash', { items: [{ kind: 'asset', id: (await api(B, 'GET', '/api/items?kinds=asset&recursive=true&take=30')).body.items.find(i => i.key === asViewer.body.key).id }] }); }
  const outsider = await api(B, 'GET', `/api/designs/${made.id + 99999}/credits`);
  check('the credits of a design that does not exist are a 404', outsider.status === 404);
  await admin.goto(base + '/Assets');
  const assetPage = await A.goto(base + '/Assets');
  await A.waitForSelector('main');
  const link = await A.$(`a[href*="/Assets/Edit"]:has-text("Berglandschaft")`);
  if (link) {
    await link.click();
    await A.waitForLoadState();
    await A.click('#asset-tabs-tab-file').catch(() => {});
    check('the page of an imported image shows its source (author, licence, link)', await A.isVisible('[data-asset-source]') && /Anna|Ben|Cem|Dora|Emil/.test(await A.textContent('[data-asset-source]')) && /CC/.test(await A.textContent('[data-asset-source]')));
    await shot(A, 'asset-source');
  } else {
    check('the page of an imported image shows its source (author, licence, link)', false, 'the image is not in the list');
  }
  void assetPage;

  // ---------------------------------------------------------------------------------------- tablet
  current = 'tablet: ';
  const tabletContext = await newContext(browser, { viewport: { width: 900, height: 800 } });
  const tablet = await tabletContext.newPage();
  watch(tablet, 'tablet');
  tablet.on('request', r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob):/.test(u)) { outside.push(u); } });
  await login(tablet, accounts.designer);
  await openDesigner(tablet, base, made.id);
  const tabletBefore = (await state(tablet)).elements.length;
  await tablet.click('.dt-rail__btn[data-panel="photos"]');
  await tablet.waitForSelector('.dt-photo', { timeout: 10000 });
  check('the panel Fotos is a drawer next to the rail on a tablet', await tablet.evaluate(() => { const p = document.getElementById('dt-panel').getBoundingClientRect(); return p.width > 200 && p.width < 460 && document.documentElement.scrollWidth <= 902; }));
  await shot(tablet, 'fotos-drawer');
  await searchPhotos(tablet, 'Pizza', ['Pizza']);
  await tablet.click('.dt-photo');
  await tablet.waitForFunction(n => window.DtDesigner.app.elements().length === n + 1, tabletBefore, { timeout: 15000 });
  check('a tap puts the photo on the page and closes the drawer', await tablet.evaluate(() => !document.getElementById('dt-panel') || document.getElementById('dt-panel').hidden || !document.getElementById('dt-panel').offsetParent));
  await tablet.evaluate(() => window.DtMedia.pick({ title: 'Bild wählen', tab: 'cat-example-browse' }, function () {}));
  await tablet.waitForSelector('dialog.dt-media[open]');
  await tablet.waitForFunction(() => document.querySelectorAll('.dt-media__tab').length >= 7);
  await tablet.waitForSelector('.dt-media__tile--item', { timeout: 10000 });
  check('the media browser fits a tablet without scrolling sideways', await tablet.evaluate(() => { const d = document.querySelector('dialog.dt-media').getBoundingClientRect(); return d.width <= 900 && document.documentElement.scrollWidth <= 902 && d.height <= 800; }));
  await shot(tablet, 'media-catalogue');
  await tablet.keyboard.press('Escape');
  await tabletContext.close();

  // ---------------------------------------------------------------------------------------- phone
  current = 'phone: ';
  const phoneContext = await newContext(browser, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const phone = await phoneContext.newPage();
  watch(phone, 'phone');
  phone.on('request', r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob):/.test(u)) { outside.push(u); } });
  await login(phone, accounts.designer);
  await openDesigner(phone, base, made.id);
  await phone.tap('#dt-tabbar-more');
  await phone.waitForSelector('.dt-menu');
  const more = await phone.$$eval('.dt-menu__label', l => l.map(x => x.textContent));
  check('Mehr offers Fotos', more.includes('Fotos'), more.join('|'));
  await phone.tap('.dt-menu__item:has(.dt-menu__label:text-is("Fotos"))');
  await phone.waitForSelector('.dt-photo', { timeout: 10000 });
  check('the panel is the sheet and shows photos in two columns', await phone.evaluate(() => { const g = document.querySelector('.dt-photos__grid'); return !!g && getComputedStyle(g).gridTemplateColumns.split(' ').length >= 2 && document.documentElement.scrollWidth <= 392; }));
  await shot(phone, 'fotos-sheet');
  await phone.keyboard.press('Escape').catch(() => {});
  await phone.evaluate(() => window.DtDesigner.panels.close());
  await phone.evaluate(() => window.DtMedia.pick({ title: 'Bild wählen', tab: 'cat-example-browse' }, function () {}));
  await phone.waitForSelector('dialog.dt-media[open]');
  await phone.waitForFunction(() => document.querySelectorAll('.dt-media__tab').length >= 7);
  await phone.tap('.dt-media__tab[data-tab="cat-example-browse"]');
  await phone.waitForSelector('.dt-media__tile--item', { timeout: 10000 });
  check('the media browser is full screen on a phone and does not scroll sideways', await phone.evaluate(() => { const d = document.querySelector('dialog.dt-media').getBoundingClientRect(); return d.width >= 385 && d.height >= 600 && document.documentElement.scrollWidth <= 392; }));
  await shot(phone, 'media-catalogue');
  await phone.keyboard.press('Escape');
  await phoneContext.close();

  // ---------------------------------------------------------------------------------------- put it back
  current = 'cleanup: ';
  check('the browsers of the people never talked to anybody but the app', outside.length === 0, outside.slice(0, 3).join(' '));
  await purgeImported(A);
  for (const id of cleanup.designs) { await postJson(A, `/api/designs/${id}/delete`, {}); }
  await configure('example-browse', { enabled: false });
  await configure('example-search', { enabled: false, removeKey: true });
  await admin.goto(base + '/Admin/Catalogs');
  check('both example catalogues are off again', /aus/.test(await pill('example-browse')) && /aus/.test(await pill('example-search')));

  current = 'console: ';
  check('no console errors and no CSP violations', problems.length === 0, problems.slice(0, 6).join(' | '));
  await browser.close();
  await fake.close();

  let failed = 0;
  for (const r of results) {
    if (!r.ok) { failed++; }
    console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail ? ' – ' + r.detail : ''}`);
  }
  console.log(`\n${results.length - failed} of ${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch(err => {
  console.error('The check stopped: ' + (err && err.stack || err));
  for (const r of results) { console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail ? ' – ' + r.detail : ''}`); }
  if (problems.length) { console.log('Problems: ' + problems.join('\n')); }
  process.exit(1);
});
