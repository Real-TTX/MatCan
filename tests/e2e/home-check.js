// Checks the start page and the navigation around it (docs/PLAN-CANVA.md section 1, items 1 and 2):
//  - the heading, the search, the format tiles (one click creates a design of the right size and opens the designer), "Eigene Größe", the dialog "Design erstellen"
//  - the menu: "Design erstellen" first, Start, Projekte, Freigegeben, Mit Stern, the group Teams, Vorlagen and Designs, Uploads & Medien, Marke, Schriften, the group "Serien (Zusatz)" (Datenlisten, Serienausgaben, Druckbögen), Papierkorb
//  - the row of templates ("Vorlage verwenden" opens a copy in the designer), the search (everything the person may see, templates), "Zuletzt verwendet" (the file browser in the mode "recent") and its item menu (rename, copy, trash)
//  - a member who only looks at one design that was shared with them (tiles and own area as for everybody, read-only actions on the shared design, the API refuses to delete it), the phone (no sideways scrolling), zero console errors and CSP violations
// The designs the check makes are deleted again at the end.
//
//   cd tests/e2e && npm install
//   node home-check.js [base url, default http://localhost:3043] [--out <folder for the screenshots, default: the temp folder>]
const fs = require('fs');
const os = require('os');
const path = require('path');
const lib = require('./lib.js');

const args = process.argv.slice(2);
const { base, problems, watch, launch, newContext, login, ensureAccounts, postJson, shareWith } = lib(args, { ignoreUrl: /\/api\/designs\/\d+/ });
const outIndex = args.indexOf('--out');
const outDir = path.resolve(outIndex >= 0 ? args[outIndex + 1] : path.join(os.tmpdir(), 'designthix-home-check'));
fs.mkdirSync(outDir, { recursive: true });

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); };
const stamp = String(Date.now()).slice(-6);

(async () => {
  const browser = await launch();
  const accounts = await ensureAccounts(browser);
  const created = [];   // ids of designs to delete at the end

  const ctx = await newContext(browser, { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  watch(page, 'designer');
  check('the designer signs in', await login(page, accounts.designer));

  const settle = async p => {
    // only the previews in view are drawn (IntersectionObserver): the ones below the fold or beyond the edge of the row of templates stay empty until they are scrolled to,
    // so only those whose centre is on the screen are waited for
    await p.waitForFunction(() => Array.from(document.querySelectorAll('[data-dt-preview]:not(.is-ready):not(.is-failed)')).every(e => { const r = e.getBoundingClientRect(); const x = (r.left + r.right) / 2; const y = (r.top + r.bottom) / 2; return r.width === 0 || x < 0 || x > window.innerWidth || y < 0 || y > window.innerHeight; }), null, { timeout: 30000 }).catch(() => { });
  };
  const apiDesign = (p, id) => p.evaluate(async i => { const r = await fetch('/api/designs/' + i); return r.ok ? r.json() : { status: r.status }; }, id);
  const designIdOf = url => { const m = /\/Designs\/(\d+)\/Designer/.exec(url); return m ? Number(m[1]) : null; };

  // ------------------------------------------------------------------------------------------------ the page
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  check('the heading asks what to design today', (await page.textContent('h1')).trim() === 'Was möchtest du heute gestalten?');
  check('there is a search field', await page.isVisible('input[type=search][name=q]'));
  const tiles = await page.$$eval('main [data-formats] [data-format], main [data-formats] [data-format-custom]', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  check('eleven format tiles, the last one is "Eigene Größe"', tiles.length === 11 && /Eigene Größe/.test(tiles[10]), JSON.stringify(tiles));
  check('the tiles are Preisschild, Etikett, Regaletikett, Visitenkarte, Flyer A5, Poster A3, Karte A6, Instagram-Beitrag, Instagram-Story, Präsentation',
    ['Preisschild', 'Etikett', 'Regaletikett', 'Visitenkarte', 'Flyer A5', 'Poster A3', 'Karte A6', 'Instagram-Beitrag', 'Instagram-Story', 'Präsentation'].every((n, i) => tiles[i].startsWith(n)), JSON.stringify(tiles));
  check('a tile shows its size', /85 × 55 mm/.test(tiles[3]) && /1\.080 × 1\.920 px/.test(tiles[8]), tiles[3] + ' | ' + tiles[8]);
  check('the sections are Design erstellen, Vorlagen and Zuletzt verwendet', (await page.$$eval('.dt-section__title', els => els.map(e => e.textContent.trim()))).join('|').startsWith('Design erstellen|Vorlagen|Zuletzt verwendet'));
  check('the key figures are at the bottom and small', await page.evaluate(() => { const f = document.querySelector('.dt-facts'); const last = document.querySelector('#dt-recent'); return !!f && !!last && (f.compareDocumentPosition(last) & Node.DOCUMENT_POSITION_PRECEDING) !== 0; }));
  await settle(page);
  await page.screenshot({ path: path.join(outDir, 'start-desktop.png') });

  // ------------------------------------------------------------------------------------------------ the menu
  const menu = await page.$$eval('.mat-nav [data-nav-panel="main"] a, .mat-nav [data-nav-panel="main"] .mat-nav__group', els => els.map(e => ({ text: e.textContent.trim(), href: e.getAttribute('href') })));
  // teams the person belongs to (other checks leave some behind) are listed between "Teams" and "Alle Teams": they are not what this check is about
  const texts = menu.filter(m => !/^\/Teams\/[^/]+\/Projekte$/.test(m.href || '') && m.href !== '/Teams/Create').map(m => m.text);
  check('the menu: Design erstellen, Start, Projekte, Freigegeben, Mit Stern, Teams, Gestalten, Bibliothek, Serien (Zusatz), Aufräumen',
    texts.join('|') === 'Design erstellen|Start|Projekte|Freigegeben|Mit Stern|Teams|Alle Teams|Gestalten|Vorlagen|Designs|Bibliothek|Uploads & Medien|Marke|Schriften|Serien (Zusatz)|Datenlisten|Serienausgaben|Druckbögen|Aufräumen|Papierkorb', texts.join('|'));
  check('the menu addresses', ['/Designs/Create', '/', '/Projekte', '/Freigegeben', '/Mit-Stern', '/Teams', '/Designs', '/Templates', '/Assets', '/Brand', '/Fonts', '/DataLists', '/Outputs', '/Sheets', '/Papierkorb'].every(h => menu.some(m => m.href === h)), JSON.stringify(menu));
  check('"Design erstellen" is the primary action', await page.isVisible('.mat-nav a.mat-nav__item--primary'));
  check('"Vorlagen" is the current item on its page', await (async () => { await page.goto(base + '/Templates', { waitUntil: 'networkidle' }); const t = await page.$eval('.mat-nav a.is-active', a => a.textContent.trim()); await page.goto(base + '/', { waitUntil: 'networkidle' }); return t === 'Vorlagen'; })());
  const designsRedirect = await page.goto(base + '/Designs?filter=templates', { waitUntil: 'networkidle' });
  check('/Designs?filter=templates leads to /Templates', /\/Templates$/.test(page.url()) && designsRedirect.status() === 200, page.url());
  for (const [url, title] of [['/Outputs', 'Serienausgaben'], ['/DataLists', 'Datenlisten'], ['/Sheets', 'Druckbögen'], ['/Assets', 'Uploads & Medien'], ['/Brand', 'Marke'], ['/Fonts', 'Schriften'], ['/Designs', 'Designs'], ['/Templates', 'Vorlagen']]) {
    await page.goto(base + url, { waitUntil: 'domcontentloaded' });
    const head = await page.textContent('main h1');
    const crumbs = (await page.$$eval('.mat-crumbs li', els => els.map(e => e.textContent.trim()))).join(' / ');
    check(`${url}: title "${title}" and breadcrumb ending in it`, head.trim() === title && crumbs.endsWith(title), `${head.trim()} | ${crumbs}`);
  }
  for (const [url, group] of [['/Outputs', 'Serien (Zusatz)'], ['/DataLists', 'Serien (Zusatz)'], ['/Sheets', 'Serien (Zusatz)'], ['/Outputs/Create', 'Serien (Zusatz)']]) {
    await page.goto(base + url, { waitUntil: 'domcontentloaded' });
    const crumbs = (await page.$$eval('.mat-crumbs li', els => els.map(e => e.textContent.trim()))).join(' / ');
    check(`${url}: the breadcrumb starts with "${group}"`, crumbs.startsWith('DesignThix / ' + group), crumbs);
  }
  await page.goto(base + '/Outputs', { waitUntil: 'domcontentloaded' });
  check('the list of outputs says Serienausgabe on its button', await page.isVisible('.mat-actions a:has-text("Neue Serienausgabe")'));
  await page.goto(base + '/Designs/Create', { waitUntil: 'domcontentloaded' });
  check('the page "Design erstellen" is still there (fallback without script)', (await page.textContent('main h1')).trim() === 'Design erstellen');
  await page.goto(base + '/Designs/Create?format=business-card', { waitUntil: 'domcontentloaded' });
  check('?format= chooses the format on that page', (await page.inputValue('#Input_PresetKey')) === 'business-card');

  // ------------------------------------------------------------------------------------------------ the dialog from the menu
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.click('.mat-nav a.mat-nav__item--primary');
  await page.waitForSelector('#dt-create[open]');
  check('the menu item opens the dialog "Design erstellen" (not the page)', new URL(page.url()).pathname === '/');
  check('the dialog has ten format tiles and fields for an own size', (await page.$$('#dt-create [data-format]')).length === 10 && await page.isVisible('#dt-create-width') && await page.isVisible('#dt-create-height') && await page.isVisible('#dt-create-unit'));
  await page.screenshot({ path: path.join(outDir, 'dialog-desktop.png') });
  await Promise.all([page.waitForURL(/\/Designs\/\d+\/Designer/), page.click('#dt-create [data-format="instagram-story"]')]);
  let id = designIdOf(page.url());
  created.push(id);
  let d = await apiDesign(page, id);
  check('the Instagram-Story tile in the dialog creates a 1080 × 1920 px design and opens the designer', d.document && d.document.width === 1080 && d.document.height === 1920 && d.document.unit === 'px', JSON.stringify(d).slice(0, 120));
  check('the new design is called "Unbenannt – Instagram-Story"', d.name === 'Unbenannt – Instagram-Story', d.name);

  // ------------------------------------------------------------------------------------------------ one click on a tile of the page
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await Promise.all([page.waitForURL(/\/Designs\/\d+\/Designer/), page.click('.dt-section [data-format="business-card"]')]);
  id = designIdOf(page.url());
  created.push(id);
  d = await apiDesign(page, id);
  check('one click on "Visitenkarte" creates 85 × 55 mm and opens the designer', d.document && d.document.width === 85 && d.document.height === 55 && d.document.unit === 'mm', JSON.stringify(d).slice(0, 120));
  check('the editor URL is /Designs/{id}/Designer', /\/Designs\/\d+\/Designer$/.test(page.url()));

  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.click('[data-format-custom]');
  await page.waitForSelector('#dt-create[open]');
  await page.fill('#dt-create-width', '120');
  await page.fill('#dt-create-height', '80');
  await page.selectOption('#dt-create-unit', 'mm');
  await Promise.all([page.waitForURL(/\/Designs\/\d+\/Designer/), page.click('#dt-create-custom button[type=submit]')]);
  id = designIdOf(page.url());
  created.push(id);
  d = await apiDesign(page, id);
  check('"Eigene Größe" opens the dialog; 120 × 80 mm creates exactly that', d.document && d.document.width === 120 && d.document.height === 80 && d.document.unit === 'mm', JSON.stringify(d).slice(0, 120));
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.click('[data-format-custom]');
  await page.waitForSelector('#dt-create[open]');
  await page.fill('#dt-create-width', '0');
  await page.click('#dt-create-custom button[type=submit]');
  check('a size of 0 is refused with a message', (await page.textContent('#dt-create-error')).includes('größer als 0') && new URL(page.url()).pathname === '/');
  await page.keyboard.press('Escape');

  // ------------------------------------------------------------------------------------------------ templates on the page
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  const templateTiles = await page.$$eval('[data-start-templates] .dt-tpl', els => els.map(e => e.getAttribute('data-template')));
  check('the row "Vorlagen" has template tiles and a link "Alle Vorlagen"', templateTiles.length >= 6 && await page.isVisible('a:has-text("Alle Vorlagen")'), String(templateTiles.length));
  await settle(page);
  const firstTemplate = page.locator('[data-start-templates] .dt-tpl').first();
  const templateName = (await firstTemplate.locator('.dt-tile__title').textContent()).trim();
  await Promise.all([page.waitForURL(/\/Designs\/\d+\/Designer/), firstTemplate.locator('[data-use-template].mat-btn').click()]);
  id = designIdOf(page.url());
  created.push(id);
  d = await apiDesign(page, id);
  check('"Vorlage verwenden" opens a copy of the template in the designer', d.name === templateName && d.document && d.document.pages.length >= 1, `${d.name} / ${templateName}`);

  // ------------------------------------------------------------------------------------------------ search
  const name = `Suchtest ${stamp}`;
  const own = await postJson(page, '/api/designs', { preset: 'a6-landscape', name });
  created.push(own.body.id);
  await page.goto(base + '/?q=' + encodeURIComponent(name.toLowerCase()), { waitUntil: 'networkidle' });
  await page.waitForSelector('#dt-found[data-state=ready]');
  check('a search finds the own design by its name', (await page.$$('#dt-found .dt-bitem[data-kind=design]')).length === 1 && (await page.textContent('#dt-found')).includes(name));
  check('a search hides the rest of the page (no format tiles)', (await page.$$('main [data-formats]')).length === 0);
  await page.fill('#start-q', 'hoffest');
  await Promise.all([page.waitForNavigation(), page.press('#start-q', 'Enter')]);
  await settle(page);
  check('a search finds a template ("hoffest")', (await page.$$('[data-found-templates] .dt-tpl')).length === 1 && (await page.textContent('[data-found-templates]')).includes('Hoffest'));
  await page.goto(base + '/?q=Social%20Media', { waitUntil: 'networkidle' });
  check('a search matches the category ("Social Media") of templates', (await page.$$('[data-found-templates] .dt-tpl')).length >= 2);
  await page.goto(base + '/?q=' + encodeURIComponent('gibt-es-nicht-' + stamp), { waitUntil: 'networkidle' });
  check('a search without a hit says so', (await page.textContent('[data-search-results]')).includes('Nichts gefunden'));
  const folderName = `Suchordner ${stamp}`;
  const madeFolder = await postJson(page, '/api/folders', { name: folderName });
  await page.goto(base + '/?q=' + encodeURIComponent(folderName.toLowerCase()), { waitUntil: 'networkidle' });
  await page.waitForSelector('#dt-found[data-state=ready]');
  check('a search also finds a folder', (await page.$$('#dt-found .dt-bitem[data-kind=folder]')).length === 1);
  await postJson(page, '/api/items/trash', { items: [{ kind: 'folder', id: madeFolder.body.id }] });
  await postJson(page, '/api/items/purge', { items: [{ kind: 'folder', id: madeFolder.body.id }] });

  // ------------------------------------------------------------------------------------------------ "Zuletzt verwendet" and the menu of an item
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForSelector('#dt-recent[data-state=ready]');
  const tile = page.locator(`#dt-recent .dt-bitem[data-name="${name}"]`).first();
  check('the new design is among the first tiles of "Zuletzt verwendet"', (await page.$$eval('#dt-recent .dt-bitem', els => els.slice(0, 6).map(e => e.getAttribute('data-name')))).includes(name));
  await tile.hover();
  await page.waitForTimeout(400);
  check('hovering a design shows the button "⋯"', (await tile.locator('.dt-bitem__more').evaluate(e => getComputedStyle(e).opacity)) === '1');
  await page.screenshot({ path: path.join(outDir, 'start-hover.png') });
  const tileId = await tile.getAttribute('data-id');
  await tile.locator('.dt-bitem__more').click();
  await page.waitForSelector('.dt-menu');
  const entries = await page.$$eval('.dt-menu .dt-menu__label', els => els.map(e => e.textContent.trim()));
  check('the menu of an own design: Öffnen, Teilen, Umbenennen, Verschieben, Kopie, Stern, Papierkorb', ['Öffnen', 'Teilen …', 'Umbenennen', 'Verschieben nach …', 'Kopie erstellen', 'Mit Stern markieren', 'In den Papierkorb'].every(t => entries.includes(t)), entries.join('|'));
  await page.click('.dt-menu .dt-menu__item:has-text("Umbenennen")');
  await page.waitForSelector('#dt-recent .dt-bitem__rename');
  await page.fill('#dt-recent .dt-bitem__rename', name + ' neu');
  await page.press('#dt-recent .dt-bitem__rename', 'Enter');
  await page.waitForFunction(n => Array.from(document.querySelectorAll('#dt-recent .dt-bitem__name')).some(t => t.textContent === n), name + ' neu');
  d = await apiDesign(page, tileId);
  check('rename: the tile and the design carry the new name', d.name === name + ' neu', d.name);
  await page.locator(`#dt-recent .dt-bitem[data-id="${tileId}"] .dt-bitem__more`).click({ force: true });
  await page.click('.dt-menu .dt-menu__item:has-text("Kopie erstellen")');
  await page.waitForFunction(n => Array.from(document.querySelectorAll('#dt-recent .dt-bitem__name')).some(t => t.textContent === n + ' (Kopie)'), name + ' neu', { timeout: 15000 });
  const copyId = Number(await page.locator(`#dt-recent .dt-bitem[data-name="${name} neu (Kopie)"]`).first().getAttribute('data-id'));
  check('copy: a copy "(Kopie)" appears on the page', copyId > 0 && copyId !== Number(tileId));
  created.push(copyId);
  await page.locator(`#dt-recent .dt-bitem[data-id="${copyId}"] .dt-bitem__more`).click({ force: true });
  await page.click('.dt-menu .dt-menu__item:has-text("In den Papierkorb")');
  await page.waitForFunction(i => !document.querySelector(`#dt-recent .dt-bitem[data-id="${i}"]`), String(copyId));
  d = await apiDesign(page, copyId);
  check('trash: the tile is gone and the design cannot be opened any more', d.status === 404, JSON.stringify(d).slice(0, 80));
  await postJson(page, '/api/items/restore', { items: [{ kind: 'design', id: copyId }] });

  // ------------------------------------------------------------------------------------------------ a member who only looks (the "viewer" of the older checks)
  // Every member makes designs in their own area; what somebody else made is only there when it was shared, and then it is read-only.
  const sharedMade = await postJson(page, '/api/designs', { preset: 'business-card' });
  const sharedId = sharedMade.body.id;
  created.push(sharedId);
  await shareWith(page, 'design', sharedId, accounts.viewer.email, 'View');
  const vctx = await newContext(browser, { viewport: { width: 1440, height: 900 } });
  const viewer = await vctx.newPage();
  watch(viewer, 'viewer');
  check('the second member signs in', await login(viewer, accounts.viewer));
  await viewer.goto(base + '/', { waitUntil: 'networkidle' });
  await settle(viewer);
  check('they see the format tiles and "Design erstellen" like everybody', (await viewer.$$('main [data-formats] [data-format], main [data-formats] [data-format-custom]')).length === 11 && await viewer.isVisible('.mat-nav a.mat-nav__item--primary') && (await viewer.$$('#dt-create')).length === 1);
  check('they see the templates, "Vorlage verwenden" is enabled', await viewer.evaluate(() => { const b = Array.from(document.querySelectorAll('.dt-tpl .mat-btn--primary')); return b.length >= 6 && b.every(x => !x.disabled && x.hasAttribute('data-use-template')); }));
  check('they see the heading and the search', (await viewer.textContent('h1')).includes('Was möchtest du heute gestalten?') && await viewer.isVisible('input[name=q]'));
  await viewer.goto(base + `/Designs/${sharedId}/Designer`, { waitUntil: 'domcontentloaded' });
  await viewer.goto(base + '/', { waitUntil: 'networkidle' });
  await viewer.waitForSelector('#dt-recent[data-state=ready]');
  const sharedTile = viewer.locator(`#dt-recent .dt-bitem[data-id="${sharedId}"]`);
  check('after they opened the shared design it is among their recent ones', (await sharedTile.count()) === 1);
  await sharedTile.locator('.dt-bitem__more').click({ force: true });
  await viewer.waitForSelector('.dt-menu');
  const viewerEntries = await viewer.$$eval('.dt-menu .dt-menu__label', els => els.map(e => e.textContent.trim()));
  check('its menu offers only what a viewer may do (Öffnen, Kopie erstellen, Stern)', viewerEntries.join('|') === 'Öffnen|Kopie erstellen|Mit Stern markieren', viewerEntries.join('|'));
  await viewer.keyboard.press('Escape');
  await viewer.screenshot({ path: path.join(outDir, 'start-viewer.png') });
  const ownMade = await postJson(viewer, '/api/designs', { preset: 'business-card' });
  check("the API lets them make a design of their own (200)", ownMade.status === 200, String(ownMade.status));
  const usedTemplate = await postJson(viewer, `/api/designs/${templateTiles[0]}/use-template`, {});
  check('"Vorlage verwenden" gives them a copy of their own (200)', usedTemplate.status === 200 && usedTemplate.body.id !== templateTiles[0], String(usedTemplate.status));
  const refusedDelete = await postJson(viewer, `/api/designs/${sharedId}/delete`, {});
  check('deleting the shared design is refused by the API (403)', refusedDelete.status === 403, String(refusedDelete.status));
  const refusedRename = await postJson(viewer, `/api/designs/${sharedId}/rename`, { name: 'Meins' });
  check('so is renaming it (403)', refusedRename.status === 403, String(refusedRename.status));
  const unknown = await viewer.evaluate(async () => (await fetch('/api/designs/999999999')).status);
  check('a design nobody shared with them is not even there (404)', unknown === 404, String(unknown));
  for (const made of [ownMade, usedTemplate]) { if (made.status === 200) { await postJson(viewer, `/api/designs/${made.body.id}/delete`, {}); } }
  await viewer.goto(base + '/Templates', { waitUntil: 'networkidle' });
  check('the page Vorlagen: "Vorlage verwenden" is enabled and there is no "Bearbeiten"', (await viewer.$$('.dt-tpl button[disabled]')).length === 0 && (await viewer.$$('.dt-tpl a:has-text("Bearbeiten")')).length === 0);

  // ------------------------------------------------------------------------------------------------ the phone
  const phone = await newContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await phone.newPage();
  watch(p, 'phone');
  await login(p, accounts.designer);
  for (const url of ['/', '/Templates', '/?q=hof']) {
    await p.goto(base + url, { waitUntil: 'networkidle' });
    await settle(p);
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`phone ${url}: nothing scrolls sideways`, overflow <= 1, String(overflow));
  }
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  await p.screenshot({ path: path.join(outDir, 'start-phone.png') });
  await p.click('[data-nav-toggle]');
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(outDir, 'menu-phone.png') });
  await p.click('.mat-nav a.mat-nav__item--primary');
  await p.waitForSelector('#dt-create[open]');
  await p.waitForTimeout(300);
  check('phone: the dialog fits the screen', await p.evaluate(() => { const r = document.querySelector('#dt-create').getBoundingClientRect(); return r.width <= window.innerWidth && r.height <= window.innerHeight + 1; }));
  await p.screenshot({ path: path.join(outDir, 'dialog-phone.png') });

  // ------------------------------------------------------------------------------------------------ clean up
  for (const designId of created.filter(Boolean)) {
    await postJson(page, `/api/designs/${designId}/delete`, {});
  }
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  check('no console errors and no CSP violations', problems.length === 0, problems.join(' | '));
  await browser.close();
  let failed = 0;
  for (const r of results) {
    if (!r.ok) { failed++; }
    console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail && !r.ok ? ' - ' + r.detail : ''}`);
  }
  console.log(`\n${results.length - failed} of ${results.length} checks passed. Screenshots: ${outDir}`);
  process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
