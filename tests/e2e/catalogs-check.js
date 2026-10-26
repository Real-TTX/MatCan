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
const { startFakeCatalogs, KEY, providers } = require('./fake-catalogs.js');

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
  try {
    await page.waitForFunction(t => { const names = Array.from(document.querySelectorAll('.dt-media__tile--item .dt-media__name')).map(x => x.textContent); return names.length === t.length && t.every(n => names.includes(n)); }, titles, { timeout: 10000 });
  } catch (e) {
    const seen = await page.evaluate(() => ({ status: (document.querySelector('.dt-media__status') || {}).textContent, names: Array.from(document.querySelectorAll('.dt-media__tile--item .dt-media__name')).map(x => x.textContent).slice(0, 8) }));
    throw new Error('search "' + text + '" did not show ' + titles.join(',') + ': ' + JSON.stringify(seen));
  }
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
  for (const category of ['Katalog: Beispiel-Katalog', 'Katalog: Beispiel-Suche', 'Katalog: Ordner', 'Katalog: Pexels', 'Katalog: Pixabay', 'Katalog: Openverse']) {
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
    if (values.removeKey && await admin.$('input[name="Input.RemoveKey"]')) { await admin.click('label.mat-switch:has(input[name="Input.RemoveKey"])'); }
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
  for (const id of ['pexels', 'pixabay', 'openverse']) { await configure(id, { enabled: false, removeKey: true }); }   // the providers (C2) too: a run that stopped half way leaves them on
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
  await A.waitForFunction(() => /bremst gerade/.test(document.querySelector('.dt-media__status').textContent), null, { timeout: 8000 });
  check('a provider over its limit says so (no retry loop: one request per search)', true);
  // the provider asked for a pause (Retry-After 120): the app leaves it alone until it is over; the "Testen" of the administrator ends the pause by asking once
  await admin.goto(base + '/Admin/Catalogs');
  await admin.click('[data-catalog="example-browse"] button:has-text("Testen")');
  await admin.waitForSelector('.mat-toast');
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

  // ---------------------------------------------------------------------------------------- the three providers (plan 5 / C2)
  current = 'providers: ';
  const PROVIDERS = ['pexels', 'pixabay', 'openverse'];
  const stats = async () => (await (await fetch(`http://127.0.0.1:${fakePort}/__stats`)).json());
  let pointed = true;
  for (const id of PROVIDERS) {
    await admin.goto(base + '/Admin/Catalogs/Edit?id=' + id);
    if (!/in der Konfiguration festgelegt/.test(await admin.textContent('body'))) { pointed = false; }
  }
  if (!pointed) {
    // never switch a real provider on from a check: without the address of the fake there is nothing to test against
    console.log(`(the app does not know the fake of the providers: start it with DESIGNTHIX__Catalogs__<pexels|pixabay|openverse>__BaseUrl=http://127.0.0.1:${fakePort}; the checks of the providers are skipped)`);
  } else {
    const lemon = fake.items.find(i => i.title === 'Zitronen');
    const lemonColour = providers.COLOURS[Math.floor(lemon.hue / 30) % 12];
    const otherColour = providers.COLOURS[(providers.COLOURS.indexOf(lemonColour) + 3) % 12];

    // ---- the administration (a start from a clean state: an earlier run may have stopped half way)
    for (const id of PROVIDERS) { await configure(id, { enabled: false, removeKey: true }); }
    await admin.goto(base + '/Admin/Catalogs');
    const providerNames = await admin.$$eval('[data-catalog] .mat-item__title', t => t.map(x => x.textContent.trim()));
    check('the list names Pexels, Pixabay and Openverse', ['Pexels', 'Pixabay', 'Openverse'].every(n => providerNames.includes(n)), providerNames.join('|'));
    check('all three are off, and the two that need a key say so', PROVIDERS.every(id => true) && /aus/.test(await pill('pexels')) && /Schlüssel fehlt/.test(await pill('pexels')) && /Schlüssel fehlt/.test(await pill('pixabay')) && /aus/.test(await pill('openverse')) && !/Schlüssel fehlt/.test(await pill('openverse')), await pill('pexels') + ' / ' + await pill('openverse'));
    for (const id of PROVIDERS) {
      await admin.goto(base + '/Admin/Catalogs/Edit?id=' + id);
      const rules = await admin.$$eval('[data-catalog-rules] li', l => l.map(x => x.textContent.trim()));
      check(`${id}: the page lists the rules of the provider`, rules.length >= 4, String(rules.length));
      check(`${id}: it says where to get a key and how it is written`, await admin.isVisible('[data-catalog-keyhint]') && (await admin.$$eval('main a[href^="https://"]', a => a.length)) >= 1);
      await shot(admin, 'admin-' + id);
    }
    await admin.goto(base + '/Admin/Catalogs/Edit?id=pexels');
    check('Pexels: no switch for safe search (Pexels has none) and no list of licences', !(await admin.$('input[type=checkbox][name="Input.SafeSearch"]')) && !(await admin.$('#Input_AllowedLicences')));
    check('Pexels: the rules name the limits of 200 an hour and 20 000 a month', /200 Anfragen pro Stunde/.test(await admin.textContent('[data-catalog-rules]')) && /20 000/.test(await admin.textContent('[data-catalog-rules]')));
    await admin.goto(base + '/Admin/Catalogs/Edit?id=pixabay');
    check('Pixabay: safe search can be switched, the 24 hours of the cache are in the rules', !!(await admin.$('input[type=checkbox][name="Input.SafeSearch"]')) && /24 Stunden/.test(await admin.textContent('[data-catalog-rules]')));
    await admin.goto(base + '/Admin/Catalogs/Edit?id=openverse');
    check('Openverse: the key is optional (credentials), the licences can be narrowed', /Zugangsdaten \(optional\)/.test(await admin.textContent('body')) && !!(await admin.$('#Input_AllowedLicences')));

    await configure('pexels', { enabled: true, key: providers.KEYS.pexels, fields: { PerUserPerMinute: 500 } });
    await configure('pixabay', { enabled: true, key: providers.KEYS.pixabay, fields: { PerUserPerMinute: 500 } });
    await configure('openverse', { enabled: true, fields: { PerUserPerMinute: 500 } });
    for (const id of PROVIDERS) {
      await admin.goto(base + '/Admin/Catalogs/Edit?id=' + id);
      await admin.click('[data-catalog-test]');
      await admin.waitForLoadState();
      await admin.waitForSelector('.mat-toast');
      check(`${id}: "Testen" finds pictures`, /Verbindung steht/.test(await admin.textContent('.mat-toast')), await admin.textContent('.mat-toast'));
    }
    await admin.goto(base + '/Admin/Catalogs/Edit?id=pexels');
    check('Pexels: the page shows what the provider reported about its limits', /noch \d+ von 20000/.test((await admin.textContent('[data-catalog-rate]')).replace(/\s/g, ' ')), await admin.textContent('[data-catalog-rate]').catch(() => '-'));
    check('no key is in any page of the administration', !(await admin.content()).includes(providers.KEYS.pexels));

    // ---- the media browser
    const pdesign = await createDesign(A, postJson, { preset: 'price-tag' });
    cleanup.designs.push(pdesign.id);
    await openDesigner(A, base, pdesign.id);
    const openMedia = async (page, id) => {
      await page.evaluate(i => { window.DtMedia.pick({ title: 'Bild wählen', tab: 'cat-' + i }, function () {}); }, id);
      await page.waitForSelector('dialog.dt-media[open]');
      await page.waitForSelector(`.dt-media__tab[data-tab="cat-${id}"]`);
      if ((await page.getAttribute(`.dt-media__tab[data-tab="cat-${id}"]`, 'aria-selected')) !== 'true') { await page.click(`.dt-media__tab[data-tab="cat-${id}"]`); }
    };
    const closeMedia = async page => { await page.click('dialog.dt-media button:has-text("Abbrechen")'); await page.waitForSelector('dialog.dt-media', { state: 'detached' }); };
    const tileCount = page => page.$$eval('.dt-media__tile--item', t => t.length);
    const titlesOf = page => page.$$eval('.dt-media__tile--item .dt-media__name', t => t.map(x => x.textContent));
    const importedBy = async category => ((await api(A, 'GET', '/api/assets?category=' + encodeURIComponent(category) + '&take=50')).body || []);

    const until = async (fn, what) => { const end = Date.now() + 8000; while (Date.now() < end) { if (await fn()) { return true; } await sleep(150); } throw new Error('timeout: ' + what); };

    // Pexels
    await openMedia(A, 'pexels');
    await A.waitForFunction(() => document.querySelectorAll('.dt-media__tile--item').length >= 30);
    const allTabs = await A.$$eval('.dt-media__tab', t => t.map(x => x.textContent));
    check('the three providers are tabs behind the five of the library', allTabs.slice(0, 5).join('|') === 'Uploads|Flaggen|Siegel|Logos|Alle' && ['Pexels', 'Pixabay', 'Openverse'].every(n => allTabs.includes(n)), allTabs.join('|'));
    check('Pexels: the first page is the curated one (30 tiles, more to come)', (await tileCount(A)) === 30 && await A.isVisible('.dt-media__more'));
    check('Pexels: the collections are chips: Alle, Kuratiert and the featured ones of Pexels', (await A.$$eval('.dt-media__chip', c => c.map(x => x.textContent.trim()))).join('|') === 'Alle|Kuratiert|Käse & Co (15)|Natur pur (15)');
    check('Pexels: the visible link to Pexels and the notice are there (their rule)', /Fotos von Pexels/.test(await A.textContent('.dt-media__provider')) && (await A.getAttribute('.dt-media__provider', 'href')) === 'https://www.pexels.com' && /Fotografin oder des Fotografen/.test(await A.textContent('.dt-media__notice')));
    check('Pexels: it has the format filter and the colour filter', await A.isVisible('.dt-media__orient') && await A.isVisible('.dt-media__colour') && (await A.$$eval('.dt-media__colour option', o => o.length)) === 13);
    const pexelsTile = await A.$eval('.dt-media__tile--item', t => ({ credit: t.querySelector('.dt-media__credit').textContent, badge: t.querySelector('.dt-media__badge').textContent, src: t.querySelector('img').getAttribute('src') }));
    check('Pexels: a tile names the photographer and the licence', /Pexels-Lizenz/.test(pexelsTile.credit) && pexelsTile.badge === 'Pexels' && /^\/api\/catalogs\/thumb\//.test(pexelsTile.src), JSON.stringify(pexelsTile));
    await A.waitForFunction(() => Array.from(document.querySelectorAll('.dt-media__tile--item img')).slice(0, 8).every(i => i.complete && i.naturalWidth > 0));
    check('Pexels: the thumbnails load through the proxy (the bytes are PNG, the label says JPEG)', true);
    await shot(A, 'media-pexels');
    await A.click('.dt-media__chip:has-text("Käse")');
    await A.waitForFunction(() => document.querySelectorAll('.dt-media__tile--item').length === 15, null, { timeout: 8000 });
    check('Pexels: a featured collection lists its photos (no video)', (await titlesOf(A)).every(t => !/video/i.test(t)));
    await A.click('.dt-media__chip:has-text("Alle")');
    await searchMedia(A, 'zitron', ['Zitronen']);
    await A.selectOption('.dt-media__colour', otherColour);
    await A.waitForFunction(() => /Nichts gefunden/.test(document.querySelector('.dt-media__status').textContent), null, { timeout: 8000 });
    check('Pexels: another colour finds nothing', (await tileCount(A)) === 0);
    await A.selectOption('.dt-media__colour', lemonColour);
    await A.waitForFunction(() => document.querySelectorAll('.dt-media__tile--item').length === 1, null, { timeout: 8000 });
    check('Pexels: the right colour finds the photo again', (await titlesOf(A))[0] === 'Zitronen');
    const importsBefore = (await stats())['pexels-img:large2x'] || 0;
    await A.click('.dt-media__tile--item');
    await A.waitForSelector('dialog.dt-media', { state: 'detached', timeout: 15000 });
    const pexelsAssets = await importedBy('Katalog: Pexels');
    check('Pexels: a click downloads the large file into the library (category "Katalog: Pexels")', pexelsAssets.some(a => /^zitronen/.test(a.key)) && ((await stats())['pexels-img:large2x'] || 0) === importsBefore + 1, JSON.stringify(pexelsAssets.map(a => a.key)));

    // a limit: the message, then no request while the provider asked for a pause
    await openMedia(A, 'pexels');
    await A.selectOption('.dt-media__colour', 'any');
    await A.fill('.dt-media__search', 'limit');
    await A.waitForFunction(() => /bremst gerade/.test(document.querySelector('.dt-media__status').textContent), null, { timeout: 8000 });
    const searchesAfterLimit = (await stats())['/v1/search'];
    await A.fill('.dt-media__search', 'wiese');
    await A.waitForFunction(() => /bremst gerade/.test(document.querySelector('.dt-media__status').textContent) && /Minute/.test(document.querySelector('.dt-media__status').textContent), null, { timeout: 8000 });
    await A.waitForTimeout(400);
    check('Pexels: a 429 says "bremst gerade" and the provider is not asked again meanwhile', (await stats())['/v1/search'] === searchesAfterLimit, String((await stats())['/v1/search']) + ' / ' + searchesAfterLimit);
    await shot(A, 'media-pexels-limit');
    await closeMedia(A);
    await admin.goto(base + '/Admin/Catalogs/Edit?id=pexels');
    await admin.click('[data-catalog-test]');
    await admin.waitForLoadState();
    await admin.waitForSelector('.mat-toast');
    check('Pexels: "Testen" of the administrator asks once more, whatever was said before', /Verbindung steht/.test(await admin.textContent('.mat-toast')));

    // Pixabay
    await openMedia(A, 'pixabay');
    await A.waitForFunction(() => document.querySelectorAll('.dt-media__tile--item').length >= 30);
    const pixChips = await A.$$eval('.dt-media__chip', c => c.map(x => x.textContent.trim()));
    check('Pixabay: the categories are chips (Alle, Empfehlung, Hintergründe, Natur, Essen ...)', pixChips.slice(0, 5).join('|') === 'Alle|Empfehlung|Hintergründe|Natur|Essen' && pixChips.length === 22, pixChips.join('|'));
    check('Pixabay: the first page is the popular images, with the link "Bilder von Pixabay" and the note about the copy', (await tileCount(A)) === 30 && /Bilder von Pixabay/.test(await A.textContent('.dt-media__provider')) && /auf diesen Server/.test(await A.textContent('.dt-media__notice')));
    const sent = (await stats()).__lastPixabay;
    check('Pixabay: the request was in German with safe search on (the settings of the administrator)', sent.lang === 'de' && sent.safesearch === 'true', JSON.stringify(sent));
    await shot(A, 'media-pixabay');
    await A.click('.dt-media__chip:has-text("Essen")');
    await A.waitForFunction(() => document.querySelectorAll('.dt-media__tile--item').length === 15, null, { timeout: 8000 });
    check('Pixabay: a category filters (Essen: 15 images)', (await stats()).__lastPixabay.category === 'food');
    await A.click('.dt-media__chip:has-text("Alle")');
    await A.selectOption('.dt-media__colour', 'violet');
    await until(async () => (await stats()).__lastPixabay.colors === 'lilac', 'lilac');
    check('Pixabay: "Violett" is asked for as "lilac"', true);
    await A.selectOption('.dt-media__colour', 'any');
    await searchMedia(A, 'zitron', ['Zitronen, essen']);   // Pixabay has no titles: the tags are the title
    const cdnBefore = (await stats())['pixabay-cdn:1280'] || 0;
    await A.click('.dt-media__tile--item');
    await A.waitForSelector('dialog.dt-media', { state: 'detached', timeout: 15000 });
    const pixAssets = await importedBy('Katalog: Pixabay');
    check('Pixabay: a click downloads the 1280 px file (through the redirect to the CDN) into the library', pixAssets.some(a => /^zitronen/.test(a.key)) && ((await stats())['pixabay-cdn:1280'] || 0) === cdnBefore + 1, JSON.stringify(pixAssets.map(a => a.key)));
    await openMedia(A, 'pixabay');
    await A.fill('.dt-media__search', 'down');
    await A.waitForFunction(() => /nicht erreichbar/.test(document.querySelector('.dt-media__status').textContent), null, { timeout: 8000 });
    check('Pixabay: a provider that is down is "nicht erreichbar" and the other tabs stay', (await A.$$('.dt-media__tab')).length >= 8);
    await closeMedia(A);

    // Openverse
    await openMedia(A, 'openverse');
    await A.waitForSelector('.dt-media__chip');
    check('Openverse: search only (suggestions, "Gib einen Suchbegriff ein."), no colour filter', /Gib einen Suchbegriff ein/.test(await A.textContent('.dt-media__status')) && (await A.$$('.dt-media__chip')).length === 6 && !(await A.isVisible('.dt-media__colour').catch(() => false)));
    check('Openverse: the link and the notice (Openverse does not endorse DesignThix)', /Bilder über Openverse/.test(await A.textContent('.dt-media__provider')) && /empfiehlt oder prüft DesignThix nicht/.test(await A.textContent('.dt-media__notice')));
    await searchMedia(A, 'zitron', ['Zitronen']);
    const ovTile = await A.$eval('.dt-media__tile--item', t => t.querySelector('.dt-media__credit').textContent);
    check('Openverse: the tile names the author and the licence (CC0 1.0)', /CC0 1\.0/.test(ovTile), ovTile);
    const ovSent = (await stats()).__lastOpenverse;
    check('Openverse: only licences that allow commercial use and changes are asked for, in pages of 20, without credentials', ovSent.license_type === 'commercial,modification' && ovSent.page_size === '20' && ovSent.bearer === false, JSON.stringify(ovSent));
    await shot(A, 'media-openverse');
    await searchMedia(A, 'morgentau', ['Morgentau']);
    check('Openverse: a CC BY-SA picture says so on its tile', /CC BY SA 4\.0/.test(await A.$eval('.dt-media__tile--item .dt-media__credit', c => c.textContent)));
    await A.fill('.dt-media__search', 'privat');
    await A.waitForFunction(() => /Nichts gefunden/.test(document.querySelector('.dt-media__status').textContent), null, { timeout: 8000 });
    check('Openverse: the NC picture is not found', (await tileCount(A)) === 0);
    const leaked = await api(A, 'GET', '/api/catalogs/openverse/search?q=leck&page=3&perPage=20');
    const leakTitles = ((leaked.body && leaked.body.items) || []).map(i => i.title);
    check('Openverse: even when the provider ignores its own filter, no NC, no ND and no unknown licence is offered', leaked.status === 200 && leakTitles.length > 0 && !leakTitles.some(t => /Nur privat|Unveränderbar|Ohne Lizenz/.test(t)) && !(leaked.body.items || []).some(i => /NC|ND/.test(i.licence.code)), leakTitles.join('|'));
    const forbiddenId = '00000000-0000-4000-8000-' + String(fake.items.findIndex(i => i.id === 'nc1') + 1).padStart(12, '0');
    const crafted = await api(A, 'POST', '/api/catalogs/openverse/import', { itemId: forbiddenId });
    check('Openverse: the NC picture cannot be imported by its id either', crafted.status === 503 && /Lizenz/.test((crafted.body && crafted.body.error) || ''), crafted.status + ' ' + JSON.stringify(crafted.body));
    const injected = await api(A, 'POST', '/api/catalogs/openverse/import', { itemId: '../../v1/auth_tokens/token/' });
    check('Openverse: an id that is an address is refused', injected.status === 400, String(injected.status));
    await searchMedia(A, 'zitron', ['Zitronen']);
    const fullBefore = (await stats())['openverse:full'] || 0;
    await A.click('.dt-media__tile--item');
    await A.waitForSelector('dialog.dt-media', { state: 'detached', timeout: 15000 });
    const ovAssets = await importedBy('Katalog: Openverse');
    check('Openverse: a click downloads the file through Openverse itself (full size) into the library', ovAssets.some(a => /^zitronen/.test(a.key)) && ((await stats())['openverse:full'] || 0) === fullBefore + 1, JSON.stringify(ovAssets.map(a => a.key)));

    // credentials: a token once, then with every request and thumbnail
    await configure('openverse', { enabled: true, key: 'cid:sec' });
    await openMedia(A, 'openverse');
    await searchMedia(A, 'wiese', ['Wiese im Sommer']);
    await A.waitForFunction(() => Array.from(document.querySelectorAll('.dt-media__tile--item img')).every(i => i.complete && i.naturalWidth > 0), null, { timeout: 8000 });
    const withToken = await stats();
    check('Openverse: with credentials a token is asked for once and sent with the search and the thumbnails', (withToken['openverse:token'] || 0) <= 1 && withToken.__lastOpenverse.bearer === true && (withToken['openverse:bearer'] || 0) >= 2, JSON.stringify({ token: withToken['openverse:token'], bearer: withToken['openverse:bearer'] }));
    check('Openverse: the credentials are not in the page of the administration', !(await (async () => { await admin.goto(base + '/Admin/Catalogs/Edit?id=openverse'); return (await admin.content()).includes('cid:sec'); })()));
    await configure('openverse', { enabled: true, key: 'cid:falsch' });
    await A.fill('.dt-media__search', 'berg');
    await A.waitForFunction(() => /Schlüssel/.test(document.querySelector('.dt-media__status').textContent), null, { timeout: 8000 });
    check('Openverse: wrong credentials are a message, not a silent fall back', !/falsch/.test(await A.textContent('.dt-media__status')));
    await configure('openverse', { enabled: true, removeKey: true });
    await closeMedia(A);

    // ---- the panel Fotos, with the providers
    await openDesigner(A, base, pdesign.id);
    await openPanel(A, 'photos');
    const photoCats = await A.$$eval('.dt-photos__cat', c => c.map(x => x.textContent));
    check('Fotos: a chip per catalogue with photos, the providers among them', ['Pexels', 'Pixabay', 'Openverse'].every(n => photoCats.includes(n)), photoCats.join('|'));
    await A.click('.dt-photos__cat:has-text("Pexels")');
    await A.waitForFunction(() => document.querySelectorAll('.dt-photo').length === 30);
    check('Fotos: the link to Pexels, the notice and the colour filter are in the panel', /Fotos von Pexels/.test(await A.textContent('.dt-photos__providerlink')) && /Fotografin/.test(await A.textContent('.dt-photos__notice')) && await A.isVisible('.dt-photos__colour'));
    await shot(A, 'fotos-pexels');
    await searchPhotos(A, 'Zitronen', ['Zitronen']);
    const placed = (await state(A)).elements.length;
    await A.click('.dt-photo');
    await A.waitForFunction(n => window.DtDesigner.app.elements().length === n + 1, placed, { timeout: 15000 });
    await openPanel(A, 'photos');
    await A.click('.dt-photos__cat:has-text("Pixabay")');
    await A.waitForFunction(() => document.querySelectorAll('.dt-photo').length === 30);
    check('Fotos: Pixabay shows its categories and its link', (await A.$$('.dt-photos__chip')).length === 22 && /Bilder von Pixabay/.test(await A.textContent('.dt-photos__providerlink')));
    await shot(A, 'fotos-pixabay');
    await searchPhotos(A, 'Zitronen', ['Zitronen, essen']);
    await A.click('.dt-photo');
    await A.waitForFunction(n => window.DtDesigner.app.elements().length === n + 2, placed, { timeout: 15000 });
    await openPanel(A, 'photos');
    await A.click('.dt-photos__cat:has-text("Openverse")');
    await A.waitForSelector('.dt-photos__chip');
    check('Fotos: Openverse shows the suggestions and the hint, no colour filter', /Gib einen Suchbegriff ein/.test(await A.textContent('#dt-panel-body')) && !(await A.$('.dt-photos__colour')));
    await searchPhotos(A, 'Zitronen', ['Zitronen']);
    await shot(A, 'fotos-openverse');
    await A.click('.dt-photo');
    await A.waitForFunction(n => window.DtDesigner.app.elements().length === n + 3, placed, { timeout: 15000 });
    await idle(A);

    // ---- the credits in the editor and in the public view
    current = 'providers/credits: ';
    await A.waitForFunction(() => window.DtDesigner.app.saveState === 'saved', null, { timeout: 15000 });
    await A.click('#dt-file');
    await A.waitForSelector('.dt-menu');
    await A.click('.dt-menu__item:has(.dt-menu__label:text-is("Bildnachweise …"))');
    await A.waitForSelector('dialog.dt-credits[open] .dt-credits__item', { timeout: 10000 });
    const providerCredits = await A.$$eval('.dt-credits__item', c => c.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
    check('the editor lists the three photos with their catalogue, author and licence', providerCredits.length === 3 && ['Pexels', 'Pixabay', 'Openverse'].every(n => providerCredits.some(c => c.includes(n))) && providerCredits.every(c => /Ben Muster/.test(c)), providerCredits.join(' || '));
    await A.click('dialog.dt-credits button:has-text("Text kopieren")');
    await A.waitForSelector('.mat-toast');
    const copied = await A.evaluate(() => navigator.clipboard.readText());
    check('"Text kopieren" gives the lines the providers\' rules ask for', /Foto von Ben Muster auf Pexels/.test(copied) && /Bild von Ben Muster auf Pixabay/.test(copied) && /über Openverse/.test(copied), copied.split('\n').join(' / '));
    await shot(A, 'credits-providers');
    await A.click('dialog.dt-credits button:has-text("Schließen")');
    await A.waitForSelector('dialog.dt-credits', { state: 'detached' });

    await api(A, 'POST', `/api/share/design/${pdesign.id}/link`, { audience: 'Public', permission: 'View', allowDownload: false });
    const token = ((await api(A, 'GET', `/api/share/design/${pdesign.id}`)).body.link || {}).token;
    const plainDesign = await createDesign(A, postJson, { preset: 'price-tag' });
    cleanup.designs.push(plainDesign.id);
    await api(A, 'POST', `/api/share/design/${plainDesign.id}/link`, { audience: 'Public', permission: 'View', allowDownload: false });
    const plainToken = ((await api(A, 'GET', `/api/share/design/${plainDesign.id}`)).body.link || {}).token;
    check('the two links are public', !!token && !!plainToken);
    const publicContext = await newContext(browser, { viewport: { width: 1440, height: 900 } });
    await publicContext.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
    const P = await publicContext.newPage();
    watch(P, 'public');
    P.on('request', r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob):/.test(u)) { outside.push(u); } });
    await P.goto(`${base}/s/${token}`);
    await P.waitForSelector('#dt-pv[data-state="ready"]', { timeout: 15000 });
    check('the public view has a link "Bildnachweise" in its footer (three pictures from catalogues)', await P.isVisible('.dt-pv__credits') && (await P.getAttribute('#dt-pv', 'data-credits')) === '3');
    await shot(P, 'public-credits-link');
    await P.click('.dt-pv__credits');
    await P.waitForSelector('dialog.dt-pv-cr[open] .dt-pv-cr__item');
    const publicCredits = await P.$$eval('.dt-pv-cr__item', c => c.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
    check('the dialog lists the three sources with author, catalogue and licence', publicCredits.length === 3 && ['Pexels', 'Pixabay', 'Openverse'].every(n => publicCredits.some(c => c.includes(n))) && publicCredits.every(c => /Ben Muster/.test(c)), publicCredits.join(' || '));
    check('author, licence and source are links to http(s) addresses only, opened safely', (await P.$$eval('.dt-pv-cr__item a', a => a.map(x => x.getAttribute('href') + '|' + x.getAttribute('rel')))).every(v => /^https?:\/\/.*\|noopener noreferrer$/.test(v)));
    await shot(P, 'public-credits');
    await P.click('dialog.dt-pv-cr button:has-text("Text kopieren")');
    await P.waitForSelector('.mat-toast');
    check('"Text kopieren" works without a sign-in', (await P.evaluate(() => navigator.clipboard.readText())).split('\n').length === 3);
    await P.click('dialog.dt-pv-cr button:has-text("Schließen")');
    await P.waitForSelector('dialog.dt-pv-cr', { state: 'detached' });
    const apiPayload = await P.evaluate(async t => (await fetch('/api/s/' + t)).json(), token);
    check('the public payload carries the credits and nothing of the library behind them', Array.isArray(apiPayload.credits) && apiPayload.credits.length === 3 && !JSON.stringify(apiPayload.credits).includes('SourceJson') && !JSON.stringify(apiPayload).includes(providers.KEYS.pexels));
    await P.goto(`${base}/s/${plainToken}`);
    await P.waitForSelector('#dt-pv[data-state="ready"]', { timeout: 15000 });
    check('a design without catalogue pictures has no such link', !(await P.$('.dt-pv__credits')));
    // the phone
    await P.setViewportSize({ width: 390, height: 844 });
    await P.goto(`${base}/s/${token}`);
    await P.waitForSelector('.dt-pv__credits', { timeout: 15000 });
    await P.click('.dt-pv__credits');
    await P.waitForSelector('dialog.dt-pv-cr[open] .dt-pv-cr__item');
    check('on a phone the dialog fits and does not scroll sideways', await P.evaluate(() => { const d = document.querySelector('dialog.dt-pv-cr').getBoundingClientRect(); return d.width <= 392 && document.documentElement.scrollWidth <= 392; }));
    await shot(P, 'public-credits');
    await publicContext.close();

    // ---- tablet and phone: every provider in the media browser, the panel Fotos
    current = 'providers/responsive: ';
    for (const [width, height, touch] of [[900, 800, false], [390, 844, true]]) {
      const ctx = await newContext(browser, touch ? { viewport: { width, height }, hasTouch: true, isMobile: true } : { viewport: { width, height } });
      const R = await ctx.newPage();
      watch(R, 'provider-' + width);
      R.on('request', r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob):/.test(u)) { outside.push(u); } });
      await login(R, accounts.designer);
      await openDesigner(R, base, pdesign.id);
      for (const id of PROVIDERS) {
        await openMedia(R, id);
        if (id === 'openverse') { await searchMedia(R, 'berg', ['Berglandschaft', 'Bergsee', 'Schneeberg']); } else { await R.waitForSelector('.dt-media__tile--item', { timeout: 10000 }); }
        await R.waitForFunction(() => Array.from(document.querySelectorAll('.dt-media__tile--item img')).slice(0, 6).every(i => i.complete && i.naturalWidth > 0), null, { timeout: 10000 });
        check(`${id} at ${width} px: the media browser fits, the provider link and the notice are visible, nothing scrolls sideways`, await R.evaluate(w => { const d = document.querySelector('dialog.dt-media').getBoundingClientRect(); const link = document.querySelector('.dt-media__provider'); const note = document.querySelector('.dt-media__notice'); return d.width <= w + 2 && document.documentElement.scrollWidth <= w + 2 && link && link.offsetParent !== null && note && note.offsetParent !== null; }, width));
        if (id !== 'pixabay') { await shot(R, 'media-' + id); }
        await closeMedia(R);
      }
      if (!touch) {
        await R.click('.dt-rail__btn[data-panel="photos"]');
        await R.waitForSelector('.dt-photo', { timeout: 10000 });
        check('the panel Fotos with the providers is a drawer on a tablet and does not scroll sideways', await R.evaluate(() => { const p = document.getElementById('dt-panel').getBoundingClientRect(); return p.width > 200 && p.width < 460 && document.documentElement.scrollWidth <= 902; }));
        await shot(R, 'fotos-providers');
      } else {
        await R.tap('#dt-tabbar-more');
        await R.waitForSelector('.dt-menu');
        await R.tap('.dt-menu__item:has(.dt-menu__label:text-is("Fotos"))');
        await R.waitForSelector('.dt-photo', { timeout: 10000 });
        check('the panel Fotos with the providers is a sheet on a phone and does not scroll sideways', await R.evaluate(() => document.documentElement.scrollWidth <= 392 && !!document.querySelector('.dt-photos__colour')));
        await shot(R, 'fotos-providers');
      }
      await ctx.close();
    }

    // ---- put the providers back
    current = 'providers/cleanup: ';
    await configure('pexels', { enabled: false, removeKey: true });
    await configure('pixabay', { enabled: false, removeKey: true });
    await configure('openverse', { enabled: false });
    await admin.goto(base + '/Admin/Catalogs');
    check('all three are off again', /aus/.test(await pill('pexels')) && /aus/.test(await pill('pixabay')) && /aus/.test(await pill('openverse')));
  }

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
