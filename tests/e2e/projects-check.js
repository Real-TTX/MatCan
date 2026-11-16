// Checks the file browser and what hangs on it (docs/PLAN-PLATFORM.md section 1, items 2 to 5 and 19; docs/PLAN-PLATFORM.md "P2"):
//  - Projekte: the path (drop target), folders three levels deep, the menu "Neu" (Design, Ordner, Bilder hochladen, Datenliste), grid and list, filter by kind, sort, search, paging
//  - selection (checkbox, Shift, Ctrl, Strg+A, the bar "N ausgewählt"), the menu of an item (right click, "⋯"), inline rename, copy, star
//  - moving: by dragging onto a folder and onto the path, by the dialog "Verschieben nach …" (also "Neuer Ordner" in it), into a team
//  - the trash: restore (a folder brings its content back), delete for good, empty; Mit Stern; Freigegeben (an item shared through the API); files dropped from the explorer
//  - the filter "Bereich" on the lists, the menu of the shell (Teams), a team area made through the API, a member without access sees nothing, the phone (list, long press, selection bar)
// The things the check makes are deleted again (a team stays: there is no API to delete one).
//
//   cd tests/e2e && npm install
//   node projects-check.js [base url, default http://localhost:3043] [--out <folder for the screenshots, default: the temp folder>]
const fs = require('fs');
const os = require('os');
const path = require('path');
const lib = require('./lib.js');

const args = process.argv.slice(2);
const { base, problems, watch, launch, newContext, login, ensureAccounts, postJson, shareWith } = lib(args, { ignoreUrl: /\/(api\/(items|folders|designs|spaces)|(Projekte|Freigegeben)\/Ordner\/)/ });
const outIndex = args.indexOf('--out');
const outDir = path.resolve(outIndex >= 0 ? args[outIndex + 1] : path.join(os.tmpdir(), 'matcan-projects-check'));
fs.mkdirSync(outDir, { recursive: true });

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); };
const stamp = String(Date.now()).slice(-6);

(async () => {
  const browser = await launch();
  const accounts = await ensureAccounts(browser);
  const ctx = await newContext(browser, { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  watch(page, 'designer');
  check('the designer signs in', await login(page, accounts.designer));

  const section = async (name, fn) => {
    try { await fn(); } catch (e) { check(name + ': ran to the end', false, String(e.message || e).split('\n')[0]); try { await page.screenshot({ path: path.join(outDir, 'failed-' + name.replace(/\W+/g, '-') + '.png') }); } catch (x) { /* no picture */ } }
  };
  const get = (p, url) => p.evaluate(async u => { const r = await fetch(u); let body = null; try { body = await r.json(); } catch (e) { /* no body */ } return { status: r.status, body }; }, url);
  const items = async (p, query) => { const r = await get(p, '/api/items?' + query); return (r.body && r.body.items) || []; };
  const named = (list, name) => list.filter(i => i.name === name);
  const tile = (p, name) => p.locator(`.dt-bitem[data-name="${name}"]`).first();
  const ready = p => p.waitForFunction(() => { const b = document.querySelector('[data-browser]'); return b && b.getAttribute('data-state') === 'ready'; }, null, { timeout: 15000 });
  const settle = async p => {
    await ready(p);
    await p.waitForFunction(() => Array.from(document.querySelectorAll('[data-dt-preview]:not(.is-ready):not(.is-failed)')).every(e => { const r = e.getBoundingClientRect(); return r.width === 0 || r.bottom < 0 || r.top > window.innerHeight; }), null, { timeout: 20000 }).catch(() => { });
  };
  const openPage = async (p, url) => { await p.goto(base + url, { waitUntil: 'networkidle' }); await ready(p); };
  const menuLabels = p => p.$$eval('.dt-menu .dt-menu__label', els => els.map(e => e.textContent.trim()));
  const toastText = p => p.$$eval('.mat-toast', els => els.map(e => e.textContent.trim()).join(' | '));
  const names = p => p.$$eval('.dt-bitem', els => els.map(e => e.getAttribute('data-name')));
  const crumbs = p => p.$$eval('.dt-bcrumbs li', els => els.map(e => e.textContent.trim()));
  const shot = async (p, name) => p.screenshot({ path: path.join(outDir, name + '.png') });
  const useMenuItem = async (p, tileLocator, label) => {
    await tileLocator.hover();
    await tileLocator.locator('.dt-bitem__more').click();
    await p.waitForSelector('.dt-menu');
    await p.click(`.dt-menu .dt-menu__item:has-text("${label}")`);
  };
  const dragTo = async (p, from, to) => {
    const a = await from.boundingBox();
    const b = await to.boundingBox();
    await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await p.mouse.down();
    await p.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2 + 12, { steps: 3 });
    await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
    await p.waitForTimeout(150);
    const lit = await to.evaluate(e => e.classList.contains('is-drop'));
    await p.mouse.up();
    return lit;
  };
  const created = { designs: [], folders: [], lists: [], assets: [] };
  const purge = async (kind, id) => { await postJson(page, '/api/items/trash', { items: [{ kind, id }] }); await postJson(page, '/api/items/purge', { items: [{ kind, id }] }); };

  // ------------------------------------------------------------------------------------------------ the page and the menu
  await section('the page', async () => {
    await openPage(page, '/Projekte');
    check('/Projekte: the heading is "Meine Projekte"', (await page.textContent('h1')).trim() === 'Meine Projekte');
    check('/Projekte: the menu item "Projekte" is current', (await page.$eval('.mat-nav a.is-active', a => a.textContent.trim())) === 'Projekte');
    check('/Projekte: the storage of the area is shown with a bar', await page.isVisible('[data-storage] .mat-meter') && /von 2 GB/.test(await page.textContent('[data-storage]')));
    check('the toolbar has Neu, the filter chips, the search, the sort and the view', await page.isVisible('[data-browser-new]') && (await page.$$('.dt-chip')).length === 6 && await page.isVisible('.dt-btool__search input') && await page.isVisible('.dt-btool__sort') && (await page.$$('.dt-btool__view button')).length === 2);
    const menuTexts = await page.$$eval('.mat-nav [data-nav-panel="main"] a', els => els.map(e => e.textContent.trim()));
    check('the menu has Projekte, Freigegeben, Mit Stern, Alle Teams and Papierkorb', ['Projekte', 'Freigegeben', 'Mit Stern', 'Alle Teams', 'Papierkorb'].every(t => menuTexts.includes(t)), menuTexts.join('|'));
    for (const [url, item] of [['/Freigegeben', 'Freigegeben'], ['/Mit-Stern', 'Mit Stern'], ['/Papierkorb', 'Papierkorb']]) {
      await openPage(page, url);
      check(`${url}: the heading and the current menu item are "${item}"`, (await page.textContent('h1')).trim() === item && (await page.$eval('.mat-nav a.is-active', a => a.textContent.trim())) === item);
    }
  });

  // ------------------------------------------------------------------------------------------------ folders three deep, "Neu"
  const top = `Projekt ${stamp}`;
  const mid = `Mitte ${stamp}`;
  const low = `Unten ${stamp}`;
  let topId = 0;
  let midId = 0;
  let lowId = 0;
  await section('folders', async () => {
    await openPage(page, '/Projekte');
    await page.click('[data-browser-new]');
    await page.waitForSelector('.dt-menu');
    check('"Neu" offers Design, Ordner, Bilder hochladen, Datenliste', (await menuLabels(page)).join('|') === 'Design|Ordner|Bilder hochladen|Datenliste', (await menuLabels(page)).join('|'));
    await page.click('.dt-menu .dt-menu__item:has-text("Ordner")');
    await page.waitForSelector('dialog[open] input[name=value]');
    await page.fill('dialog[open] input[name=value]', top);
    await page.click('dialog[open] button[value=ok]');
    await tile(page, top).waitFor();
    check('a folder made with "Neu" shows up at once', (await tile(page, top).getAttribute('data-kind')) === 'folder');
    topId = Number(await tile(page, top).getAttribute('data-id'));
    created.folders.push(topId);

    await page.click(`.dt-bitem[data-name="${top}"] .dt-bitem__name`);
    await page.waitForURL(new RegExp(`/Projekte/Ordner/${topId}$`));
    await ready(page);
    check('the folder opens at /Projekte/Ordner/{id} with the path "Meine Projekte › Projekt"', (await crumbs(page)).join('|').replace(/\s+/g, ' ') === `Meine Projekte|${top}`, (await crumbs(page)).join('|'));
    check('an empty folder says so and offers a way on', (await page.textContent('.dt-bempty')).includes('Dieser Ordner ist leer') && await page.isVisible('.dt-bempty button:has-text("Ordner anlegen")'));
    await shot(page, 'empty-folder');
    const a = await postJson(page, '/api/folders', { name: mid, parentId: topId });
    midId = a.body.id;
    const b = await postJson(page, '/api/folders', { name: low, parentId: midId });
    lowId = b.body.id;
    created.folders.push(midId, lowId);
    await openPage(page, `/Projekte/Ordner/${midId}`);
    await page.click(`.dt-bitem[data-name="${low}"] .dt-bitem__name`);
    await page.waitForURL(new RegExp(`/Projekte/Ordner/${lowId}$`));
    await ready(page);
    check('three levels deep: the path is Meine Projekte › Projekt › Mitte › Unten', (await crumbs(page)).length === 4 && (await crumbs(page)).join('|').includes(`${top}|${mid}|${low}`), (await crumbs(page)).join('|'));
    await page.click(`.dt-bcrumbs a:has-text("${mid}")`);
    await page.waitForURL(new RegExp(`/Projekte/Ordner/${midId}$`));
    check('a step of the path leads back up', (await page.textContent('h1')).trim() === mid);
  });

  // ------------------------------------------------------------------------------------------------ designs, lists, images in a folder; kinds, search, sort, views
  const designA = `Plakat ${stamp}`;
  const designB = `Beschriftung ${stamp}`;
  const listName = `Adressen ${stamp}`;
  await section('content', async () => {
    await openPage(page, `/Projekte/Ordner/${topId}`);
    await page.click('[data-browser-new]');
    await page.click('.dt-menu .dt-menu__item:has-text("Design")');
    await page.waitForSelector('#dt-create[open]');
    check('"Design" of the menu opens the dialog "Design erstellen"', await page.isVisible('#dt-create .dt-formattile'));
    await page.click('#dt-create [data-format="business-card"]');
    await page.waitForURL(/\/Designs\/\d+\/Designer/);
    const madeId = Number(/Designs\/(\d+)\/Designer/.exec(page.url())[1]);
    created.designs.push(madeId);
    const made = await get(page, `/api/designs/${madeId}`);
    check('the design made from the folder lies in that folder', made.body.folderId === topId, JSON.stringify({ folderId: made.body.folderId, topId }));
    await postJson(page, `/api/designs/${madeId}/rename`, { name: designA });
    const second = await postJson(page, '/api/designs', { preset: 'a5-portrait', name: designB, folderId: topId });
    created.designs.push(second.body.id);
    await openPage(page, `/Projekte/Ordner/${topId}`);
    await page.click('[data-browser-new]');
    await page.click('.dt-menu .dt-menu__item:has-text("Datenliste")');
    await page.waitForSelector('dialog[open] input[name=value]');
    await page.fill('dialog[open] input[name=value]', listName);
    await Promise.all([page.waitForURL(/\/DataLists\/Edit\/\d+/), page.click('dialog[open] button[value=ok]')]);
    const listId = Number(/Edit\/(\d+)/.exec(page.url())[1]);
    created.lists.push(listId);
    await openPage(page, `/Projekte/Ordner/${topId}`);
    check('a data list made with "Neu" lies in the folder', (await tile(page, listName).count()) === 1 && (await tile(page, listName).getAttribute('data-kind')) === 'datalist');
    check('the folder holds the folder, two designs and a list', (await names(page)).length === 4 && (await names(page))[0] === mid, (await names(page)).join('|'));

    await page.click('.dt-chip[data-kind-filter="design"]');
    await page.waitForFunction(() => document.querySelectorAll('.dt-bitem').length === 2 && !document.querySelector('.dt-bitem--folder'));
    check('the chip "Designs" keeps the two designs', (await names(page)).every(n => n === designA || n === designB));
    await page.click('.dt-chip[data-kind-filter="folder"]');
    await page.waitForFunction(() => document.querySelectorAll('.dt-bitem').length === 1 && document.querySelector('.dt-bitem--folder'));
    check('the chip "Ordner" keeps the folder', (await names(page))[0] === mid);
    await page.click('.dt-chip[data-kind-filter="datalist"]');
    await page.waitForFunction(() => document.querySelectorAll('.dt-bitem').length === 1 && document.querySelector('.dt-bitem--datalist'));
    check('the chip "Datenlisten" keeps the list', (await names(page))[0] === listName);
    await page.click('.dt-chip[data-kind-filter=""]');
    await page.waitForFunction(() => document.querySelectorAll('.dt-bitem').length === 4);

    await page.fill('.dt-btool__search input', 'beschrift');
    await page.waitForFunction(() => document.querySelectorAll('.dt-bitem').length === 1);
    check('the search finds by a part of the name, in this folder', (await names(page))[0] === designB);
    await page.fill('.dt-btool__search input', 'gibt-es-nicht-' + stamp);
    await page.waitForSelector('.dt-bempty:not([hidden]) .mat-empty__title');
    check('a search without a hit says so and offers to reset', (await page.textContent('.dt-bempty')).includes('Nichts gefunden') && await page.isVisible('.dt-bempty button:has-text("zurücksetzen")'));
    await page.click('.dt-bempty button:has-text("zurücksetzen")');
    await page.waitForFunction(() => document.querySelectorAll('.dt-bitem').length === 4);

    await page.selectOption('.dt-btool__sort', 'name');
    await page.waitForFunction(() => document.querySelectorAll('.dt-bitem').length === 4);
    const sorted = (await names(page)).slice(1);
    check('sorted by name (folders first)', JSON.stringify(sorted) === JSON.stringify([...sorted].sort((x, y) => x.localeCompare(y, 'de'))), sorted.join('|'));
    await page.selectOption('.dt-btool__sort', 'updated');

    await settle(page);
    await shot(page, 'projects-grid');
    await page.click('.dt-btool__view [data-view="list"]');
    check('the list view has a head and rows with name, owner, date', await page.isVisible('.dt-blisthead') && (await page.$$('.dt-bitem__cell--when')).length === 4);
    await settle(page);
    await shot(page, 'projects-list');
    await page.reload({ waitUntil: 'networkidle' });
    await ready(page);
    check('the view is remembered', (await page.getAttribute('[data-browser]', 'data-view')) === 'list');
    await page.click('.dt-btool__view [data-view="grid"]');
  });

  // ------------------------------------------------------------------------------------------------ selection, menu, rename, copy, star
  await section('selection', async () => {
    await openPage(page, `/Projekte/Ordner/${topId}`);
    await page.locator(`.dt-bitem[data-name="${designA}"] .dt-bitem__check`).check({ force: true });
    check('a checkbox selects: the bar says "1 ausgewählt"', (await page.textContent('.dt-bsel__count')).trim() === '1 ausgewählt');
    await page.click(`.dt-bitem[data-name="${designB}"] .dt-bitem__media`, { modifiers: ['Control'] });
    check('Ctrl+click adds one: "2 ausgewählt"', (await page.textContent('.dt-bsel__count')).trim() === '2 ausgewählt' && !/\/Designs\//.test(page.url()));
    await page.click('.dt-bsel__clear');
    check('"Auswahl aufheben" clears', await page.locator('.dt-bsel').isHidden());
    const all = await names(page);
    await page.click(`.dt-bitem[data-name="${all[0]}"] .dt-bitem__media`, { modifiers: ['Control'] });
    await page.click(`.dt-bitem[data-name="${all[all.length - 1]}"] .dt-bitem__media`, { modifiers: ['Shift'] });
    check('Shift+click selects the range', (await page.textContent('.dt-bsel__count')).trim() === `${all.length} ausgewählt`);
    await page.keyboard.press('Escape');
    check('Escape clears the selection', await page.locator('.dt-bsel').isHidden());
    await page.click('main', { position: { x: 5, y: 5 } });
    await page.keyboard.press('Control+a');
    check('Strg+A selects everything', (await page.textContent('.dt-bsel__count')).trim() === `${all.length} ausgewählt`);
    const barButtons = await page.$$eval('.dt-bsel__btn span', els => els.map(e => e.textContent.trim()));
    check('the bar offers Verschieben, Mit Stern, In den Papierkorb (no Teilen for several)', ['Verschieben', 'Mit Stern', 'In den Papierkorb'].every(t => barButtons.includes(t)) && !barButtons.includes('Teilen'), barButtons.join('|'));
    await shot(page, 'selection-bar');
    await page.keyboard.press('Escape');

    // the context menu
    await tile(page, designA).click({ button: 'right' });
    await page.waitForSelector('.dt-menu');
    const entries = await menuLabels(page);
    check('the context menu of a design: Öffnen, Teilen, Umbenennen, Verschieben, Kopie, Stern, Papierkorb', ['Öffnen', 'Teilen …', 'Umbenennen', 'Verschieben nach …', 'Kopie erstellen', 'Mit Stern markieren', 'In den Papierkorb'].every(t => entries.includes(t)), entries.join('|'));
    await page.waitForTimeout(300);
    await shot(page, 'context-menu');
    await page.keyboard.press('Escape');
    check('Escape closes the menu', (await page.$$('.dt-menu')).length === 0);
    await tile(page, mid).click({ button: 'right' });
    await page.waitForSelector('.dt-menu');
    check('the menu of a folder has "Farbe"', (await menuLabels(page)).includes('Farbe'));
    await page.hover('.dt-menu .dt-menu__item:has-text("Farbe")');
    await page.waitForSelector('.dt-menu[data-level="1"]');
    await page.click('.dt-menu[data-level="1"] .dt-menu__item:has-text("Rot")');
    await page.waitForFunction(n => { const t = document.querySelector(`.dt-bitem[data-name="${n}"] .dt-bfolder`); return t && getComputedStyle(t).getPropertyValue('--dt-folder').trim() === '#d64545'; }, mid);
    check('a folder takes its colour', true);

    // share: the hook of P3 or the note
    await useMenuItem(page, tile(page, designB), 'Teilen');
    await page.waitForTimeout(500);
    const hasShare = await page.evaluate(() => !!(window.DtShare && window.DtShare.open));
    check('"Teilen …" calls the dialog (or says that it is coming)', hasShare ? (await page.$$('dialog[open]')).length === 1 || (await page.$$('.dt-share')).length >= 0 : (await toastText(page)).includes('Teilen kommt gleich'), String(hasShare));
    if (hasShare) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }

    // rename inline
    await useMenuItem(page, tile(page, designB), 'Umbenennen');
    await page.waitForSelector('.dt-bitem__rename');
    check('"Umbenennen" edits the name in place', await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('dt-bitem__rename')));
    await page.fill('.dt-bitem__rename', designB + ' neu');
    await page.press('.dt-bitem__rename', 'Enter');
    await tile(page, designB + ' neu').waitFor();
    const afterRename = await get(page, `/api/designs/${created.designs[1]}`);
    check('the new name is saved', afterRename.body.name === designB + ' neu', afterRename.body.name);
    if (await page.locator('.dt-bsel').isVisible()) { await page.click('.dt-bsel__clear'); }
    await page.locator(`.dt-bitem[data-name="${designB} neu"] .dt-bitem__check`).check({ force: true });
    await page.keyboard.press('F2');
    await page.waitForSelector('.dt-bitem__rename');
    await page.press('.dt-bitem__rename', 'Escape');
    check('F2 renames the one selected item, Escape cancels', (await page.$$('.dt-bitem__rename')).length === 0 && (await tile(page, designB + ' neu').count()) === 1);
    await page.keyboard.press('Escape');

    // copy
    await useMenuItem(page, tile(page, designA), 'Kopie erstellen');
    await tile(page, designA + ' (Kopie)').waitFor();
    const copy = await items(page, `scope=space&folder=${topId}`);
    const copyRow = named(copy, designA + ' (Kopie)')[0];
    created.designs.push(copyRow.id);
    check('"Kopie erstellen" puts the copy next to the original', copyRow.folderId === topId);

    // star
    await useMenuItem(page, tile(page, designA), 'Mit Stern markieren');
    await page.waitForFunction(n => { const s = document.querySelector(`.dt-bitem[data-name="${n}"] .dt-bitem__star`); return s && !s.hidden; }, designA);
    check('a starred item shows a star', true);
    await openPage(page, '/Mit-Stern');
    check('/Mit-Stern lists it', (await names(page)).includes(designA) && (await page.textContent('h1')).trim() === 'Mit Stern');
    await shot(page, 'starred');
    await useMenuItem(page, tile(page, designA), 'Stern entfernen');
    await page.waitForFunction(n => !document.querySelector(`.dt-bitem[data-name="${n}"]`), designA);
    check('taking the star away removes it from /Mit-Stern', !(await names(page)).includes(designA));
  });

  // ------------------------------------------------------------------------------------------------ moving: drag, the dialog, "Neuer Ordner"
  const moveFolder = `Ziel ${stamp}`;
  await section('moving', async () => {
    const f = await postJson(page, '/api/folders', { name: moveFolder });
    created.folders.push(f.body.id);
    const sheet = `Zettel ${stamp}`;
    const d = await postJson(page, '/api/designs', { preset: 'a6-landscape', name: sheet });
    created.designs.push(d.body.id);
    await openPage(page, '/Projekte');
    const lit = await dragTo(page, tile(page, sheet), tile(page, moveFolder));
    check('dragging over a folder lights it up', lit);
    await page.waitForFunction(n => !document.querySelector(`.dt-bitem[data-name="${n}"]`), sheet);
    let moved = await get(page, `/api/designs/${d.body.id}`);
    check('dropping onto a folder moves the design there', moved.body.folderId === f.body.id, String(moved.body.folderId));
    check('a toast says it', (await toastText(page)).includes('wurde verschoben'));
    await openPage(page, `/Projekte/Ordner/${f.body.id}`);
    check('the moved design is in the folder', (await tile(page, sheet).count()) === 1);
    const litCrumb = await dragTo(page, tile(page, sheet), page.locator('.dt-bcrumbs a:has-text("Meine Projekte")'));
    await page.waitForFunction(n => !document.querySelector(`.dt-bitem[data-name="${n}"]`), sheet);
    moved = await get(page, `/api/designs/${d.body.id}`);
    check('dropping onto the path moves it up (to the top of the area)', litCrumb && moved.body.folderId === null, String(moved.body.folderId));

    // the dialog
    await openPage(page, '/Projekte');
    await tile(page, sheet).locator('.dt-bitem__check').check({ force: true });
    await page.click('.dt-bsel__btn:has-text("Verschieben")');
    await page.waitForSelector('dialog.dt-move[open] .dt-move__row');
    const rows = await page.$$eval('.dt-move__row', els => els.map(e => ({ name: e.querySelector('.dt-move__name').textContent, depth: Number(e.getAttribute('data-depth')) })));
    check('the dialog shows "Meine Projekte" and its folders as a tree', rows[0].name === 'Meine Projekte' && rows.some(r => r.name === moveFolder && r.depth === 1), JSON.stringify(rows.slice(0, 4)));
    await shot(page, 'move-dialog');
    await page.click('dialog.dt-move [data-key]:has(.dt-move__name:text-is("' + top + '")) .dt-move__fold');
    await page.waitForSelector(`.dt-move__row:has(.dt-move__name:text-is("${mid}"))`);
    check('a folder unfolds in the dialog', true);
    await page.click(`.dt-move__row:has(.dt-move__name:text-is("${top}"))`);
    await page.click('dialog.dt-move button:has-text("Neuer Ordner")');
    await page.waitForSelector('dialog[open] input[name=value]');
    await page.fill('dialog[open] input[name=value]', `Neu im Dialog ${stamp}`);
    await page.click('dialog[open] button[value=ok]');
    await page.waitForSelector(`.dt-move__row.is-selected:has(.dt-move__name:text-is("Neu im Dialog ${stamp}"))`);
    check('"Neuer Ordner" in the dialog makes a folder and chooses it', true);
    const newFolder = (await items(page, 'scope=space&recursive=true&q=' + encodeURIComponent('Neu im Dialog ' + stamp)))[0];
    created.folders.push(newFolder.id);
    await page.click('dialog.dt-move button:has-text("Hierher verschieben")');
    await page.waitForFunction(n => !document.querySelector(`.dt-bitem[data-name="${n}"]`), sheet);
    moved = await get(page, `/api/designs/${d.body.id}`);
    check('"Hierher verschieben" moves the design into that folder', moved.body.folderId === newFolder.id, String(moved.body.folderId));

    // a folder cannot go into itself: the dialog greys out the folder and what is below it
    await openPage(page, '/Projekte');
    await tile(page, top).locator('.dt-bitem__check').check({ force: true });
    await page.click('.dt-bsel__btn:has-text("Verschieben")');
    await page.waitForSelector('dialog.dt-move[open] .dt-move__row');
    check('the moved folder is greyed out in the dialog', (await page.locator(`.dt-move__row:has(.dt-move__name:text-is("${top}"))`).getAttribute('aria-disabled')) === 'true');
    await page.click('dialog.dt-move button:has-text("Abbrechen")');
    await page.keyboard.press('Escape');
  });

  // ------------------------------------------------------------------------------------------------ the trash
  await section('trash', async () => {
    await openPage(page, '/Projekte');
    check('before: the folder with its content is there', (await tile(page, top).count()) === 1);
    await useMenuItem(page, tile(page, top), 'In den Papierkorb');
    await page.waitForFunction(n => !document.querySelector(`.dt-bitem[data-name="${n}"]`), top);
    check('the folder is gone from the area and a toast says so', (await toastText(page)).includes('Papierkorb'));
    await openPage(page, '/Papierkorb');
    check('/Papierkorb lists the folder only (not what lay in it)', (await names(page)).includes(top) && !(await names(page)).includes(designA) && !(await names(page)).includes(mid));
    check('it says that the trash empties itself after 30 days', (await page.textContent('.dt-bhead')).includes('nach 30 Tagen'));
    check('the button "Papierkorb leeren" is there', await page.isVisible('[data-browser-empty-trash]'));
    check('a trashed item does not link anywhere', (await page.$$(`.dt-bitem[data-name="${top}"] a`)).length === 0);
    await shot(page, 'trash');
    await tile(page, top).click({ button: 'right' });
    await page.waitForSelector('.dt-menu');
    check('the menu in the trash: Wiederherstellen, Endgültig löschen', (await menuLabels(page)).join('|') === 'Wiederherstellen|Endgültig löschen');
    await page.click('.dt-menu .dt-menu__item:has-text("Wiederherstellen")');
    await page.waitForFunction(n => !document.querySelector(`.dt-bitem[data-name="${n}"]`), top);
    await openPage(page, `/Projekte/Ordner/${topId}`);
    check('restoring the folder brings its content back', (await names(page)).includes(mid) && (await names(page)).includes(listName) && (await names(page)).includes(designB + ' neu'), (await names(page)).join('|'));

    // for good
    const trashName = `Weg ${stamp}`;
    const t = await postJson(page, '/api/designs', { preset: 'a6-landscape', name: trashName });
    await postJson(page, '/api/items/trash', { items: [{ kind: 'design', id: t.body.id }] });
    await openPage(page, '/Papierkorb');
    await tile(page, trashName).locator('.dt-bitem__check').check({ force: true });
    await page.click('.dt-bsel__btn:has-text("Endgültig löschen")');
    await page.waitForSelector('dialog[open] .mat-btn--danger');
    check('deleting for good asks first', (await page.textContent('dialog[open]')).includes('endgültig löschen'));
    await page.click('dialog[open] button[data-dialog-close]');
    check('cancelling keeps it', (await tile(page, trashName).count()) === 1);
    await page.click('.dt-bsel__btn:has-text("Endgültig löschen")');
    await page.click('dialog[open] button[value=ok]');
    await page.waitForFunction(n => !document.querySelector(`.dt-bitem[data-name="${n}"]`), trashName);
    const gone = await get(page, `/api/designs/${t.body.id}`);
    check('after "Endgültig löschen" the design is gone', gone.status === 404);

    // empty
    const e1 = await postJson(page, '/api/designs', { preset: 'a6-landscape', name: `Leeren ${stamp}` });
    const e2 = await postJson(page, '/api/folders', { name: `Leeren Ordner ${stamp}` });
    await postJson(page, '/api/items/trash', { items: [{ kind: 'design', id: e1.body.id }, { kind: 'folder', id: e2.body.id }] });
    await openPage(page, '/Papierkorb');
    await page.click('[data-browser-empty-trash]');
    await page.waitForSelector('dialog[open] .mat-btn--danger');
    await page.click('dialog[open] button[value=ok]');
    await page.waitForSelector('.dt-bempty:not([hidden])');
    check('"Papierkorb leeren" empties it', (await page.textContent('.dt-bempty')).includes('Der Papierkorb ist leer') && (await get(page, `/api/designs/${e1.body.id}`)).status === 404);
  });

  // ------------------------------------------------------------------------------------------------ files dropped from the explorer
  await section('drop', async () => {
    await openPage(page, `/Projekte/Ordner/${midId}`);
    const dropFile = async (fileName, targetSelector) => page.evaluate(async ({ fileName: n, targetSelector: sel }) => {
      const blob = await (await fetch('/img/icon-192.png')).blob();
      const dt = new DataTransfer();
      dt.items.add(new File([blob], n, { type: 'image/png' }));
      const target = sel ? document.querySelector(sel) : document.body;
      for (const type of ['dragenter', 'dragover', 'drop']) { target.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true })); }
    }, { fileName, targetSelector });
    const before = await page.evaluate(() => document.querySelector('[data-storage] .dt-storage__text').textContent);
    await dropFile(`gedroppt-${stamp}.png`, null);
    await page.waitForSelector(`.dt-bitem[data-kind=asset]`, { timeout: 20000 });
    const inFolder = await items(page, `scope=space&folder=${midId}&kinds=asset`);
    check('a file dropped on the browser is uploaded into the open folder', inFolder.length === 1 && inFolder[0].folderId === midId, JSON.stringify(inFolder.map(i => i.name)));
    created.assets.push(inFolder[0].id);
    // the picture is fetched after the tile is drawn: wait for it instead of reading it at once (the check was flaky)
    await page.waitForFunction(() => { const i = document.querySelector('.dt-bitem[data-kind=asset] img'); return !!i && i.complete && i.naturalWidth > 0; }, null, { timeout: 10000 }).catch(() => { });
    check('the image tile shows the picture', await page.$eval('.dt-bitem[data-kind=asset] img', i => i.complete && i.naturalWidth > 0));
    await page.waitForFunction(b => document.querySelector('[data-storage] .dt-storage__text').textContent !== b, before, { timeout: 5000 }).catch(() => { });
    check('the storage shown follows the upload', (await page.textContent('[data-storage] .dt-storage__text')) !== before);

    // onto a folder tile: into that folder
    await openPage(page, `/Projekte/Ordner/${topId}`);
    const lowTile = `.dt-bitem[data-name="${mid}"]`;
    await dropFile(`gedroppt2-${stamp}.png`, lowTile);
    await page.waitForTimeout(1500);
    const inMid = await items(page, `scope=space&folder=${midId}&kinds=asset`);
    check('a file dropped onto a folder tile goes into that folder', inMid.length === 2, String(inMid.length));
    created.assets.push(...inMid.map(i => i.id));
    await dropFile(`kein-bild-${stamp}.txt`, null).catch(() => { });
    await openPage(page, `/Projekte/Ordner/${topId}`);
    await page.waitForFunction(() => document.querySelector('.dt-bitem--folder .dt-bfolder'));
    check('a folder with images shows pictures of them', (await page.$$(`.dt-bitem[data-name="${mid}"] .dt-bfolder__pic`)).length >= 1);
    await settle(page);
    await shot(page, 'folder-previews');
  });

  // ------------------------------------------------------------------------------------------------ the filter "Bereich" on the lists, the start page
  const teamName = `Team Alpha ${stamp}`;
  let team = null;
  await section('team', async () => {
    const made = await postJson(page, '/api/spaces', { name: teamName });
    check('a team is made through the API', made.status === 200 && made.body.slug, JSON.stringify(made.body));
    team = made.body;
    const spaces = (await get(page, '/api/spaces')).body;
    const teamSpace = spaces.find(s => s.id === team.id);
    const viewerSearch = await get(page, '/api/share/search?q=' + encodeURIComponent('viewer@'));
    const viewerUser = (viewerSearch.body || []).find(r => r.type === 'user');
    await postJson(page, `/api/spaces/${team.id}/members`, { userId: viewerUser.id, role: 'Viewer' });
    await openPage(page, '/Projekte');
    const teams = await page.$$eval('.mat-nav [data-nav-panel="main"] a', els => els.map(e => ({ text: e.textContent.trim(), href: e.getAttribute('href') })));
    check('the menu lists the team with its address', teams.some(t => t.text === teamName && t.href === `/Teams/${team.slug}/Projekte`), JSON.stringify(teams.filter(t => /Team/.test(t.text))));
    await page.click(`.mat-nav a[href="/Teams/${team.slug}/Projekte"]`);
    await page.waitForURL(new RegExp(`/Teams/${team.slug}/Projekte$`));
    await ready(page);
    check('the team area: heading, current menu item, storage of the team', (await page.textContent('h1')).trim() === teamName && (await page.$eval('.mat-nav a.is-active', a => a.textContent.trim())) === teamName && /von 10 GB/.test(await page.textContent('[data-storage]')));

    // a folder and a design made there
    await page.click('[data-browser-new]');
    await page.click('.dt-menu .dt-menu__item:has-text("Ordner")');
    await page.waitForSelector('dialog[open] input[name=value]');
    await page.fill('dialog[open] input[name=value]', `Teamordner ${stamp}`);
    await page.click('dialog[open] button[value=ok]');
    await tile(page, `Teamordner ${stamp}`).waitFor();
    const teamFolder = (await items(page, `scope=space&space=${team.id}`)).find(i => i.name === `Teamordner ${stamp}`);
    created.folders.push(teamFolder.id);
    check('a folder made in the team area belongs to the team', teamFolder.spaceId === team.id);
    await page.click(`.dt-bitem[data-name="Teamordner ${stamp}"] .dt-bitem__name`);
    await page.waitForURL(new RegExp(`/Teams/${team.slug}/Projekte/Ordner/${teamFolder.id}$`));
    await ready(page);
    check('the path of a team folder starts with the team', (await crumbs(page))[0].startsWith(teamName), (await crumbs(page)).join('|'));
    await page.click('[data-browser-new]');
    await page.click('.dt-menu .dt-menu__item:has-text("Design")');
    await page.waitForSelector('#dt-create[open]');
    check('the dialog asks "Speichern in" and has the team chosen', (await page.$eval('#dt-create-space', s => s.selectedOptions[0].textContent.trim())) === 'Team ' + teamName, await page.$eval('#dt-create-space', s => Array.from(s.options).map(o => o.textContent).join('|')));
    await shot(page, 'create-dialog-area');
    await page.click('#dt-create [data-format="a5-portrait"]');
    await page.waitForURL(/\/Designs\/\d+\/Designer/);
    const teamDesignId = Number(/Designs\/(\d+)\/Designer/.exec(page.url())[1]);
    created.designs.push(teamDesignId);
    const teamDesign = await get(page, `/api/designs/${teamDesignId}`);
    check('the design made there lies in the team folder', teamDesign.body.spaceId === team.id && teamDesign.body.folderId === teamFolder.id, JSON.stringify([teamDesign.body.spaceId, teamDesign.body.folderId]));

    // the area filter on the lists
    const teamList = await postJson(page, '/api/items/new-datalist', { name: `Teamliste ${stamp}`, spaceId: team.id });
    created.lists.push(teamList.body.id);
    await page.goto(base + '/DataLists', { waitUntil: 'networkidle' });
    const options = await page.$$eval('select[name="bereich"] option', els => els.map(e => ({ value: e.value, text: e.textContent.trim() })));
    check('Datenlisten: the filter "Bereich" offers Meine Projekte, the team and Freigegeben', options.some(o => o.value === 'mine') && options.some(o => o.value === `team-${team.id}`) && options.some(o => o.value === 'shared'), JSON.stringify(options));
    await page.goto(base + `/DataLists?bereich=team-${team.id}`, { waitUntil: 'networkidle' });
    check('Datenlisten of the team: only the team\'s', (await page.textContent('main')).includes(`Teamliste ${stamp}`) && !(await page.textContent('main')).includes(listName));
    await page.goto(base + '/DataLists?bereich=mine', { waitUntil: 'networkidle' });
    check('Datenlisten of Meine Projekte: not the team\'s', (await page.textContent('main')).includes(listName) && !(await page.textContent('main')).includes(`Teamliste ${stamp}`));
    for (const url of ['/Assets', '/Outputs', '/Fonts', '/Sheets', '/Designs']) {
      await page.goto(base + url, { waitUntil: 'networkidle' });
      check(`${url}: has the filter "Bereich" with the team`, (await page.$$(`select[name="bereich"] option[value="team-${team.id}"]`)).length === 1);
    }
    await page.goto(base + '/Assets', { waitUntil: 'networkidle' });
    check('/Assets: the storage bar is there', await page.isVisible('[data-storage]'));
    await page.goto(base + `/Designs?bereich=team-${team.id}`, { waitUntil: 'networkidle' });
    check('/Designs of the team: only the team\'s designs', (await page.$$('main .mat-tile, main table tbody tr')).length >= 1 && !(await page.textContent('main')).includes(designA));
  });

  // ------------------------------------------------------------------------------------------------ moving into a team, the team's viewer
  await section('team move and viewer', async () => {
    const mover = `Umzug ${stamp}`;
    const d = await postJson(page, '/api/designs', { preset: 'a6-landscape', name: mover });
    created.designs.push(d.body.id);
    await openPage(page, '/Projekte');
    await tile(page, mover).locator('.dt-bitem__check').check({ force: true });
    await page.click('.dt-bsel__btn:has-text("Verschieben")');
    await page.waitForSelector('dialog.dt-move[open] .dt-move__row');
    const rowNames = await page.$$eval('.dt-move__row.is-space .dt-move__name', els => els.map(e => e.textContent));
    check('the dialog lists the areas: Meine Projekte and the team', rowNames.includes('Meine Projekte') && rowNames.includes(teamName), rowNames.join('|'));
    await page.click(`.dt-move__row.is-space:has(.dt-move__name:text-is("${teamName}"))`);
    await page.click('dialog.dt-move button:has-text("Hierher verschieben")');
    await page.waitForFunction(n => !document.querySelector(`.dt-bitem[data-name="${n}"]`), mover);
    const moved = await get(page, `/api/designs/${d.body.id}`);
    check('moving to the team area changes the area of the design', moved.body.spaceId === team.id && moved.body.folderId === null);

    // the team viewer
    const vctx = await newContext(browser, { viewport: { width: 1440, height: 900 } });
    const viewer = await vctx.newPage();
    watch(viewer, 'viewer');
    await login(viewer, accounts.viewer);
    await viewer.goto(base + `/Teams/${team.slug}/Projekte`, { waitUntil: 'networkidle' });
    await ready(viewer);
    check('a team viewer sees the team area', (await viewer.textContent('h1')).trim() === teamName && (await names(viewer)).includes(mover));
    check('a team viewer has no "Neu" and no drop of files', (await viewer.$$('[data-browser-new]')).length === 0);
    await tile(viewer, mover).click({ button: 'right' });
    await viewer.waitForSelector('.dt-menu');
    check('their menu has no Umbenennen, Verschieben, Papierkorb', (await menuLabels(viewer)).join('|') === 'Öffnen|Kopie erstellen|Mit Stern markieren', (await menuLabels(viewer)).join('|'));
    await shot(viewer, 'team-viewer');
    await viewer.keyboard.press('Escape');
    const refused = await postJson(viewer, '/api/items/trash', { items: [{ kind: 'design', id: d.body.id }] });
    check('the API refuses them to trash it (403)', refused.status === 403, String(refused.status));
    const refusedMove = await postJson(viewer, '/api/items/move', { items: [{ kind: 'design', id: d.body.id }], spaceId: team.id });
    check('and to move it (403)', refusedMove.status === 403, String(refusedMove.status));

    // somebody without access sees nothing of the designer's area
    await viewer.goto(base + '/Projekte', { waitUntil: 'networkidle' });
    await ready(viewer);
    check('the member\'s own area does not show the designer\'s folders', !(await names(viewer)).includes(top) && !(await names(viewer)).includes(moveFolder));
    const foreign = await viewer.evaluate(async id => { const r = await fetch('/Projekte/Ordner/' + id); return r.url.replace(location.origin, ''); }, topId);
    check('the page of a folder they have no access to leads to "Zugriff anfordern"', foreign === '/Zugriff/folder/' + topId, foreign);
    const foreignItems = await get(viewer, `/api/items?scope=space&folder=${topId}`);
    check('the API lists nothing of it', foreignItems.body.total === 0);
    const foreignRename = await postJson(viewer, '/api/items/rename', { kind: 'folder', id: topId, name: 'Meins' });
    check('renaming it is a 404', foreignRename.status === 404, String(foreignRename.status));
    await openPage(viewer, '/Freigegeben');
    check('Freigegeben is empty for them (the team area is theirs by membership, not shared)', !(await names(viewer)).includes(mover), (await names(viewer)).join('|'));
    await vctx.close();
  });

  // ------------------------------------------------------------------------------------------------ Freigegeben
  await section('shared', async () => {
    const vctx = await newContext(browser, { viewport: { width: 1440, height: 900 } });
    const viewer = await vctx.newPage();
    watch(viewer, 'viewer');
    await login(viewer, accounts.viewer);
    await openPage(page, `/Projekte/Ordner/${topId}`);
    await shareWith(page, 'folder', midId, accounts.viewer.email, 'View');
    await shareWith(page, 'design', created.designs[0], accounts.viewer.email, 'Edit');
    await openPage(viewer, '/Freigegeben');
    check('Freigegeben lists the folder and the design that were shared', (await names(viewer)).includes(mid) && (await names(viewer)).includes(designA), (await names(viewer)).join('|'));
    check('the chip "Bilder" is not there (images are not shared one by one)', (await viewer.$$('.dt-chip[data-kind-filter="asset"]')).length === 0);
    check('there is no "Neu" on the top level of Freigegeben', (await viewer.$$('[data-browser-new]')).length === 0);
    await shot(viewer, 'shared');
    await viewer.click(`.dt-bitem[data-name="${mid}"] .dt-bitem__name`);
    await viewer.waitForURL(new RegExp(`/Freigegeben/Ordner/${midId}$`));
    await ready(viewer);
    check('a shared folder opens with a path that starts at it: Freigegeben › Folder', (await crumbs(viewer)).join('|') === `Freigegeben|${mid}`, (await crumbs(viewer)).join('|'));
    check('it shows the content, as read-only (no Neu)', (await names(viewer)).includes(low) && (await viewer.$$('[data-browser-new]')).length === 0);
    await viewer.click(`.dt-bitem[data-name="${low}"] .dt-bitem__name`);
    await viewer.waitForURL(new RegExp(`/Freigegeben/Ordner/${lowId}$`));
    check('a folder inside it keeps the way: Freigegeben › Mitte › Unten', (await crumbs(viewer)).join('|') === `Freigegeben|${mid}|${low}`, (await crumbs(viewer)).join('|'));
    const above = await viewer.evaluate(async id => { const r = await fetch('/Freigegeben/Ordner/' + id); return r.url.replace(location.origin, ''); }, topId);
    check('the folder above it was never given: "Zugriff anfordern"', above === '/Zugriff/folder/' + topId, above);
    await openPage(viewer, '/Freigegeben');
    await tile(viewer, designA).click({ button: 'right' });
    await viewer.waitForSelector('.dt-menu');
    const labels = await menuLabels(viewer);
    check('a design shared for editing may be renamed but not moved or trashed', labels.includes('Umbenennen') && !labels.includes('Verschieben nach …') && !labels.includes('In den Papierkorb'), labels.join('|'));
    await viewer.keyboard.press('Escape');
    await vctx.close();
  });

  // ------------------------------------------------------------------------------------------------ the phone
  await section('phone', async () => {
    const pctx = await newContext(browser, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const p = await pctx.newPage();
    watch(p, 'phone');
    await login(p, accounts.designer);
    await openPage(p, `/Projekte/Ordner/${topId}`);
    check('phone: the list is the default view', (await p.getAttribute('[data-browser]', 'data-view')) === 'list');
    check('phone: nothing scrolls sideways', await p.evaluate(() => document.documentElement.scrollWidth <= 391));
    check('phone: the checkboxes and "⋯" are visible without hovering', await p.evaluate(() => { const c = document.querySelector('.dt-bitem__check'); const m = document.querySelector('.dt-bitem__more'); return getComputedStyle(c).opacity === '1' && getComputedStyle(m).opacity === '1'; }));
    await settle(p);
    await shot(p, 'phone-projects');
    await p.locator('.dt-bitem .dt-bitem__check').first().check({ force: true });
    const bar = await p.locator('.dt-bsel').boundingBox();
    check('phone: the selection bar sits at the bottom of the screen', bar && bar.y > 844 - 160 && bar.y + bar.height <= 844 + 1, JSON.stringify(bar));
    await shot(p, 'phone-selection');
    await p.keyboard.press('Escape');
    // a long press opens the menu
    const target = p.locator('.dt-bitem').nth(1);
    const box = await target.locator('.dt-bitem__body').boundingBox();
    const cdp = await pctx.newCDPSession(p);
    const point = [{ x: box.x + 30, y: box.y + box.height / 2, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point });
    await p.waitForTimeout(700);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForSelector('.dt-menu', { timeout: 3000 }).catch(() => { });
    check('phone: a long press opens the menu of the item', (await p.$$('.dt-menu')).length === 1 && !/\/Designs\/\d+\/Designer/.test(p.url()));
    await shot(p, 'phone-menu');
    await p.keyboard.press('Escape');
    await openPage(p, '/Projekte');
    await p.tap('[data-browser-new]');
    await p.waitForSelector('.dt-menu');
    check('phone: "Neu" opens its menu', (await menuLabels(p)).length === 4);
    await p.keyboard.press('Escape');
    await openPage(p, '/Papierkorb');
    check('phone: /Papierkorb fits', await p.evaluate(() => document.documentElement.scrollWidth <= 391));
    await shot(p, 'phone-trash');
    await openPage(p, '/Mit-Stern');
    await shot(p, 'phone-starred');
    await p.goto(base + '/', { waitUntil: 'networkidle' });
    await p.waitForSelector('#dt-recent[data-state=ready]');
    await p.waitForTimeout(800);
    check('phone: the start page fits', await p.evaluate(() => document.documentElement.scrollWidth <= 391));
    await shot(p, 'phone-start');
    await p.click('.mat-burger').catch(() => { });
    await p.waitForTimeout(500);
    await shot(p, 'phone-menu-open');
    await pctx.close();
  });

  // ------------------------------------------------------------------------------------------------ the start page shows what was used; screenshots at the desktop width
  await section('start', async () => {
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.waitForSelector('#dt-recent[data-state=ready]');
    const recent = await names(page);
    check('"Zuletzt verwendet" holds designs that were opened or made lately', recent.length > 0);
    await settle(page);
    await shot(page, 'start');
    await page.goto(base + '/Projekte', { waitUntil: 'networkidle' });
    await settle(page);
    await shot(page, 'projects-root');
  });

  // ------------------------------------------------------------------------------------------------ clean up
  await section('clean up', async () => {
    for (const id of created.assets) { await purge('asset', id); }
    for (const id of created.lists) { await purge('datalist', id); }
    for (const id of created.designs) { await purge('design', id); }
    for (const id of created.folders) { await purge('folder', id); }
    await page.goto(base + '/Projekte', { waitUntil: 'networkidle' });
    check('clean up: nothing of the check is left in the area', !(await names(page)).some(n => n.includes(stamp)), (await names(page)).join('|'));
  });

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
