// Checks the templates (docs/PLAN-CANVA.md section 1 item 3 and section 5, docs/PLAN-TEMPLATES.md section 2): the gallery "Vorlagen" (one tile per FAMILY, occasions as chips, the format and the
// search over names and tags, the address keeps the state, paging), the variant dots of a family and the dialog "Vorlage ansehen" (all pages, switching variants, "Vorlage verwenden"),
// "Vorlage verwenden" (a copy opens in the designer, the template stays; every member), "Bearbeiten" (the templates are the platform's own: only an administrator), the start page row,
// "Mehr Formate" of the create dialog, a folded card in the editor (fold line and margin guides, never in the drawing), the panel Vorlagen with its filters, the tab Deko of the media
// browser, and that EVERY page of EVERY template draws without an engine warning. The copies the check makes are deleted again at the end.
//
//   cd tests/e2e && npm install
//   node templates-check.js [base url, default http://localhost:3043] [--out folder]
const lib = require('./lib.js');
const fs = require('fs');
const os = require('os');
const path = require('path');

const args = process.argv.slice(2);
const { base, problems, watch, launch, newContext, login, ensureAccounts, postJson } = lib(args, { ignoreUrl: /\/api\/designs\/\d+/ });
const outIndex = args.indexOf('--out');
const outDir = outIndex >= 0 ? path.resolve(args[outIndex + 1]) : path.join(os.tmpdir(), 'designthix-templates-check');
fs.mkdirSync(outDir, { recursive: true });

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); };

(async () => {
  const browser = await launch();
  const accounts = await ensureAccounts(browser);
  const created = [];
  const shot = (page, name) => page.screenshot({ path: path.join(outDir, name) }).catch(() => { });

  const ctx = await newContext(browser, { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  watch(page, 'designer');
  check('the designer signs in', await login(page, accounts.designer));
  const settle = (p) => (p || page).waitForFunction(() => document.querySelectorAll('[data-dt-preview]:not([hidden]):not(.is-ready):not(.is-failed)').length === 0, null, { timeout: 40000 }).catch(() => { });
  const ready = () => page.waitForFunction(() => { const g = document.querySelector('[data-gallery]'); return g && g.getAttribute('data-state') === 'ready'; }, null, { timeout: 20000 });
  const api = (p, url) => p.evaluate(async u => (await fetch(u)).json(), url);
  const titles = () => page.$$eval('.dt-tg .dt-tile__title', els => els.map(e => e.textContent.trim()));

  // ------------------------------------------------------------------------------------------------ the gallery
  const everything = await api(page, '/api/templates/gallery?take=60');
  const familyCount = everything.total;
  await page.goto(base + '/Templates', { waitUntil: 'networkidle' });
  await ready();
  // The thumbnails are drawn lazily (when they come into view): scroll through the gallery once.
  const tileCount = (await page.$$('.dt-tg')).length;
  for (let i = 0; i < tileCount; i++) { await page.locator('.dt-tg .dt-designthumb:not([hidden])').nth(i).scrollIntoViewIfNeeded().catch(() => { }); await page.waitForTimeout(120); }
  await settle();
  check('the gallery shows one tile per family (' + familyCount + ')', tileCount === Math.min(familyCount, 24) && familyCount >= 100, `${tileCount} of ${familyCount}`);
  const occasions = await page.$$eval('[data-gallery-occasions] .dt-chip', els => els.map(e => e.getAttribute('data-occasion') + ':' + e.querySelector('.dt-chip__count').textContent));
  check('the occasions are chips with their counts, "Alle" first (Geburtstag, Feste & Events, Business, Handel & Preise, Social Media)', occasions[0] === ':' + familyCount && ['Geburtstag', 'Feste & Events', 'Business', 'Handel & Preise', 'Social Media'].every(o => occasions.some(x => x.startsWith(o + ':'))), occasions.join(' | '));
  const headings = await page.$$eval('.dt-category__title', els => els.map(e => e.firstChild.textContent.trim()));
  check('without a filter the tiles are grouped under the occasions in the order of the list', headings.length >= 3 && headings.indexOf('Geburtstag') < headings.indexOf('Hochzeit') && headings.indexOf('Hochzeit') < headings.indexOf('Kinder & Familie'), headings.join(' | '));
  // scrolling through the first page loads the next ones ("Mehr laden" by itself): only the tiles of the first page are looked at
  const thumbs = await page.evaluate(n => Array.from(document.querySelectorAll('.dt-tg .dt-designthumb:not([hidden])')).slice(0, n).map(t => ({ ok: !!t.querySelector('svg:not(.mat-icon), img'), failed: t.classList.contains('is-failed') })), tileCount);
  check('every tile has a thumbnail (a saved picture or one drawn by the engine), none failed', thumbs.length === tileCount && thumbs.every(t => t.ok && !t.failed), JSON.stringify(thumbs));
  const allNames = (await api(page, '/api/templates')).map(x => x.name);
  check('the nine templates of the first plans and the demo are still there, and the library has at least 330 templates in at least 100 families', ['Käsetheke', 'Obst & Gemüse – Preisschild', 'Regaletikett mit EAN', 'Glasetikett – Marmelade & Honig', 'Visitenkarte modern (2 Seiten)', 'Flyer A5 – Wochenangebot', 'Poster A3 – Hoffest', 'Instagram-Beitrag – SALE', 'Instagram-Story – Neu im Laden', 'Grußkarte A6 quer (2 Seiten)'].every(n => allNames.some(x => x.includes(n))) && allNames.length >= 330 && familyCount >= 100, allNames.length + ' templates, ' + familyCount + ' families');
  check('every tile has "Ansehen" and "Vorlage verwenden"; a member has no "Bearbeiten" (the templates belong to the platform)', (await page.$$('.dt-tg [data-tile-preview]')).length >= tileCount && (await page.$$('.dt-tg .mat-btn--primary[data-use-template]')).length === (await page.$$('.dt-tg')).length && (await page.$$('.dt-tg [data-tile-preview]')).length === (await page.$$('.dt-tg')).length && (await page.$$('.dt-tg [data-tile-edit]:not([hidden])')).length === 0);
  check('the search, the format and the chips are above the tiles', await page.isVisible('[data-gallery-search]') && await page.isVisible('[data-gallery-format]') && await page.isVisible('[data-gallery-occasions]'));
  check('the format list has groups and counts', (await page.$$eval('[data-gallery-format] optgroup', g => g.length)) >= 3 && /\(\d+\)/.test(await page.$eval('[data-gallery-format] option:nth-child(2)', o => o.textContent)));
  await shot(page, 'templates-gallery-1440.png');

  // search: names, tags (not in the description) and umlauts folded; the address keeps it
  await page.fill('[data-gallery-search]', 'supermarkt');
  await ready();
  await page.waitForFunction(() => document.querySelectorAll('.dt-tg').length === 5);
  check('the search finds a template by a TAG ("supermarkt" is a tag of the Regaletikett and of four more families)', (await titles()).includes('Regaletikett') && (await titles()).length === 5 && /[?&]q=supermarkt/.test(page.url()), (await titles()).join('|') + ' ' + page.url());
  await page.fill('[data-gallery-search]', 'grusskarte');
  await page.waitForFunction(() => document.querySelectorAll('.dt-tg').length >= 1 && document.querySelector('.dt-tg .dt-tile__title').textContent.includes('Gru'));
  check('the search folds umlauts ("grusskarte" finds Grußkarte)', (await titles()).some(t => t.includes('Grußkarte')));
  await page.fill('[data-gallery-search]', 'gibt-es-nicht-xyz');
  await page.waitForSelector('[data-templates-empty]:not([hidden])');
  check('a search without a hit shows an empty state with a way back', await page.isVisible('[data-templates-empty] [data-gallery-reset]') && (await page.$$('.dt-tg')).length === 0);
  await page.click('[data-gallery-reset]');
  await page.waitForFunction(n => document.querySelectorAll('.dt-tg').length === n, tileCount);
  check('"Filter zurücksetzen" brings everything back and clears the address', !/[?&](q|occasion|format)=/.test(page.url()) && (await page.inputValue('[data-gallery-search]')) === '');

  // occasion and format
  await page.click('[data-gallery-occasions] [data-occasion="Social Media"]');
  await ready();
  const social = await titles();
  check('the chip "Social Media" keeps its nine families, no headings, the address says so', social.length === 9 && social.every(t => /^(Instagram|Facebook)/.test(t)) && (await page.$$('.dt-category__title')).length === 0 && /occasion=Social\+Media|occasion=Social%20Media/.test(page.url()), social.join(' | ') + ' ' + page.url());
  check('the pressed chip says so (aria-pressed)', (await page.getAttribute('[data-occasion="Social Media"]', 'aria-pressed')) === 'true');
  await page.selectOption('[data-gallery-format]', 'instagram-story');
  await ready();
  check('the format "Instagram-Story" narrows it to the three story families', (await titles()).length === 3 && (await titles()).every(t => t.includes('Story')), (await titles()).join('|'));
  const formatCounts = await page.$$eval('[data-gallery-format] option', o => o.map(x => x.value + ':' + x.textContent));
  check('the formats are counted with the occasion applied (only the formats of Social Media are listed)', formatCounts.every(f => /^(:Alle Formate|instagram-|facebook-)/.test(f)), formatCounts.join(' | '));
  const storyChips = await page.$$eval('[data-gallery-occasions] .dt-chip', c => c.map(x => x.getAttribute('data-occasion')));
  check('(the story formats are Social Media and a few party stories: the chips of the other occasions are gone)', storyChips.includes('Social Media') && storyChips.length < occasions.length - 1, storyChips.join('|'));
  await page.goto(base + '/Templates?occasion=Business&format=instagram-story', { waitUntil: 'networkidle' });
  await ready();
  check('a deep link to a combination without a hit shows the empty state', await page.isVisible('[data-templates-empty]'));
  await page.goto(base + '/Templates?occasion=' + encodeURIComponent('Handel & Preise') + '&format=shelf-strip&q=etikett', { waitUntil: 'networkidle' });
  await ready();
  check('a deep link applies occasion, format and search (Regaletikett)', (await titles()).join('|') === 'Regaletikett' && (await page.inputValue('[data-gallery-search]')) === 'etikett' && (await page.inputValue('[data-gallery-format]')) === 'shelf-strip' && (await page.getAttribute('[data-occasion="Handel & Preise"]', 'aria-pressed')) === 'true');

  // paging: the page asks for 24 families; here a request for 4 stands in for a long library (IntersectionObserver + "Mehr laden")
  await page.route('**/api/templates/gallery*', route => { const u = new URL(route.request().url()); u.searchParams.set('take', '4'); route.continue({ url: u.toString() }); });
  await page.goto(base + '/Templates', { waitUntil: 'networkidle' });
  await ready();
  // a short first page may fill itself (the end of the list is in view and scrolls in by itself): the pages are multiples of 4
  const firstPage = (await page.$$('.dt-tg')).length;
  check('the first page holds whole pages of 4 families and "Mehr laden" is offered while there are more', firstPage >= 4 && firstPage % 4 === 0 && firstPage < familyCount && await page.isVisible('[data-gallery-more]') && Number(await page.getAttribute('[data-gallery]', 'data-count')) === firstPage, String(firstPage));
  await page.click('[data-gallery-load]');
  await page.waitForFunction(n => document.querySelectorAll('.dt-tg').length > n, firstPage);
  await page.locator('[data-gallery-more]').scrollIntoViewIfNeeded().catch(() => { });
  await page.waitForFunction(n => document.querySelectorAll('.dt-tg').length >= n, Math.min(familyCount, 12), { timeout: 15000 }).catch(() => { });
  const allLoaded = await page.evaluate(() => new Set(Array.from(document.querySelectorAll('.dt-tg')).map(t => t.getAttribute('data-family'))).size === document.querySelectorAll('.dt-tg').length);
  check('"Mehr laden" adds the next families without a repeat, the end of the list scrolls in by itself', allLoaded && (await page.$$('.dt-tg')).length > firstPage);
  await page.unroute('**/api/templates/gallery*');

  // ------------------------------------------------------------------------------------------------ variants: dots and the preview dialog
  // The library has families of one variant so far: the answer of the API is changed on its way so that three templates form ONE family (the tile and the dialog do not know the difference).
  await page.route('**/api/templates/gallery*', async route => {
    const response = await route.fetch();
    const data = await response.json();
    const first = data.families[0];
    const merged = Object.assign({}, first, { key: 'merged-test', name: 'Testfamilie', variants: first.variants.map((v, i) => Object.assign({}, v, { variant: ['Klassisch', 'Modern', 'Verspielt'][i], family: 'merged-test', familyName: 'Testfamilie' })) });
    data.families = [merged].concat(data.families.slice(1));
    route.fulfill({ response, json: data });
  });
  await page.goto(base + '/Templates', { waitUntil: 'networkidle' });
  await ready();
  const tile = page.locator('.dt-tg[data-family="merged-test"]');
  await settle();
  check('a family of three variants shows "3 Varianten" and three dots', (await tile.locator('.dt-tg__badge').textContent()).trim() === '3 Varianten' && (await tile.locator('.dt-tg__dot').count()) === 3 && (await tile.locator('.dt-tg__dot.is-active').count()) === 1);
  const ids = await tile.locator('.dt-tg__dot').evaluateAll(d => d.map(x => x.getAttribute('data-variant-id')));
  check('the tile shows the first variant: its id is on the tile and on "Vorlage verwenden"', (await tile.getAttribute('data-template')) === ids[0] && (await tile.locator('[data-use-template]').getAttribute('data-use-template')) === ids[0]);
  await tile.locator('.dt-tg__dot').nth(2).hover();
  await settle();
  check('hovering a dot shows that variant (picture, id, name)', (await tile.getAttribute('data-template')) === ids[2] && (await tile.locator('.mat-tile__meta').textContent()).startsWith('Verspielt') && (await tile.locator('.dt-tg__thumb:not([hidden])').count()) === 1 && (await tile.locator('[data-use-template]').getAttribute('data-use-template')) === ids[2]);
  await tile.locator('.dt-tg__dot').nth(1).click();
  check('a click on a dot does the same (touch)', (await tile.getAttribute('data-template')) === ids[1] && (await tile.locator('.dt-tg__dot').nth(1).getAttribute('aria-pressed')) === 'true');
  await tile.locator('[data-tile-preview]').click();
  await page.waitForSelector('dialog.dt-tpv[open]');
  const dlg = page.locator('dialog.dt-tpv');
  check('"Ansehen" opens the dialog on the SHOWN variant, with the variants as a radio group', (await dlg.getAttribute('data-template')) === ids[1] && (await dlg.locator('[role=radio]').count()) === 3 && (await dlg.locator('[role=radio][aria-checked=true]').getAttribute('data-variant-id')) === ids[1]);
  await page.waitForFunction(() => document.querySelectorAll('dialog.dt-tpv .dt-tpv__page').length >= 1);
  await settle();
  const pageCount = await dlg.locator('.dt-tpv__page').count();
  check('the dialog draws every page of the variant (' + pageCount + '), each with a caption', pageCount >= 1 && (await dlg.locator('.dt-tpv__page .dt-designthumb.is-ready svg').count()) === pageCount && (await dlg.locator('.dt-tpv__caption').count()) === pageCount);
  await dlg.locator('[role=radio]').nth(0).click();
  await page.waitForFunction(first => document.querySelector('dialog.dt-tpv').getAttribute('data-template') === first, ids[0]);
  await settle();
  check('a variant button switches the pages and "Vorlage verwenden" follows', (await dlg.locator('[data-use-template]').getAttribute('data-use-template')) === ids[0] && (await dlg.locator('.dt-tpv__page .dt-designthumb svg').count()) >= 1);
  await dlg.locator('[role=radio][aria-checked=true]').focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(second => document.querySelector('dialog.dt-tpv').getAttribute('data-template') === second, ids[1]);
  check('the arrow keys switch the variant', (await dlg.locator('[role=radio][aria-checked=true]').getAttribute('data-variant-id')) === ids[1]);
  check('the dialog says size, format, occasion and how many pages', /Größe/.test(await dlg.locator('.dt-tpv__facts').textContent()) && /Seite/.test(await dlg.locator('[data-tpv-pages]').textContent()) && (await dlg.locator('.dt-tpv__tags li').count()) >= 3);
  await shot(page, 'templates-preview-1440.png');
  await page.keyboard.press('Escape');
  await page.waitForSelector('dialog.dt-tpv', { state: 'detached' });
  await page.unroute('**/api/templates/gallery*');

  // a template with two pages: both are in the dialog, "Vorlage verwenden" in the dialog makes a copy
  await page.goto(base + '/Templates?q=visitenkarte', { waitUntil: 'networkidle' });
  await ready();
  const visitTile = page.locator('.dt-tg').first();
  const visitId = await visitTile.getAttribute('data-template');
  await visitTile.locator('.dt-tg__media').click();
  await page.waitForSelector('dialog.dt-tpv[open]');
  await page.waitForFunction(() => document.querySelectorAll('dialog.dt-tpv .dt-tpv__page').length === 2);
  await settle();
  check('a click on the picture opens the dialog; a card with two pages shows both, named', (await page.$$eval('dialog.dt-tpv .dt-tpv__caption', c => c.map(x => x.textContent))).join('|').length > 3 && (await page.$$('dialog.dt-tpv .dt-tpv__page .is-ready')).length === 2);
  await Promise.all([page.waitForURL(/\/Designs\/\d+\/Designer/), page.click('dialog.dt-tpv [data-use-template]')]);
  const copyId = Number(/Designs\/(\d+)\/Designer/.exec(page.url())[1]);
  created.push(copyId);
  const copy = await page.evaluate(async i => (await fetch('/api/designs/' + i)).json(), copyId);
  check('"Vorlage verwenden" in the dialog opens a COPY (new id) with both pages of the card', copyId !== Number(visitId) && copy.document.pages.length === 2, `${copyId} ${copy.name}`);
  const list = await api(page, '/api/templates');
  check('the copy is not a template, the template is still there, and the API lists the metadata of every template', !list.some(t => t.id === copyId) && list.some(t => t.id === Number(visitId)) && list.every(t => t.occasion && t.family && t.format && t.tags.length >= 3));

  // ------------------------------------------------------------------------------------------------ the administrator edits, a member uses
  const actx = await newContext(browser, { viewport: { width: 1440, height: 900 } });
  const admin = await actx.newPage();
  watch(admin, 'admin');
  check('the administrator signs in', await login(admin, accounts.admin));
  await admin.goto(base + '/Templates?q=visitenkarte', { waitUntil: 'networkidle' });
  await admin.waitForSelector('.dt-tg [data-tile-edit]:not([hidden])');
  const href = await admin.locator('.dt-tg [data-tile-edit]').first().getAttribute('href');
  check('the administrator has "Bearbeiten" on the tile: it opens the template itself in the designer', href === `/Designs/${visitId}/Designer`, href);
  await actx.close();

  // ------------------------------------------------------------------------------------------------ the start page row and the search
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  const startTiles = await page.$$eval('[data-start-templates] .dt-tpl', els => els.map(e => e.querySelector('.dt-tile__title').textContent.trim()));
  check('the start page shows one template per family, the first of each occasion first', startTiles.length >= 6 && new Set(startTiles).size === startTiles.length, startTiles.join(' | '));
  await page.locator('[data-start-templates] .dt-tpl .dt-tpl__media').first().click();
  await page.waitForSelector('dialog.dt-tpv[open]');
  await page.waitForFunction(() => document.querySelectorAll('dialog.dt-tpv .dt-tpv__page').length >= 1);
  check('a click on the picture of a tile of the start page opens "Vorlage ansehen" there too', await page.isVisible('dialog.dt-tpv .dt-tpv__side'));
  await page.keyboard.press('Escape');
  await page.goto(base + '/?q=supermarkt', { waitUntil: 'networkidle' });
  check('the search of the start page finds a template by its tag', (await page.$$eval('[data-found-templates] .dt-tpl .dt-tile__title', e => e.map(x => x.textContent.trim()))).some(x => x.startsWith('Regaletikett')));

  // ------------------------------------------------------------------------------------------------ "Mehr Formate" and the folded card
  await page.evaluate(() => window.DtCreate.open());
  await page.waitForSelector('dialog#dt-create[open]');
  check('the create dialog keeps its ten tiles and has a closed list "Mehr Formate"', (await page.$$('dialog#dt-create .dt-formats [data-format]')).length === 10 && !(await page.getAttribute('dialog#dt-create details[data-more-formats]', 'open') !== null));
  await page.click('dialog#dt-create .dt-moreformats__summary');
  const more = await page.$$eval('dialog#dt-create .dt-moreformats__item', els => els.map(e => e.getAttribute('data-format')));
  const groupTitles = await page.$$eval('dialog#dt-create .dt-moreformats__title', els => els.map(e => e.textContent));
  check('"Mehr Formate" lists the sizes in groups (cards and postcards first) with the folded cards among them', more.length >= 25 && groupTitles[0] === 'Klappkarten und Postkarten' && ['card-a6-portrait', 'card-a6-landscape', 'card-square-145', 'table-card', 'certificate-a4', 'facebook-cover', 'poster-a2-portrait'].every(k => more.includes(k)) && !more.includes('price-tag'), groupTitles.join('|'));
  check('a folded card says its folded size', /gefaltet 105 × 148 mm/.test(await page.textContent('dialog#dt-create [data-format="card-a6-portrait"]')));
  await shot(page, 'templates-create-more-1440.png');
  await Promise.all([page.waitForURL(/\/Designs\/\d+\/Designer/), page.click('dialog#dt-create [data-format="card-a6-portrait"]')]);
  const cardId = Number(/Designs\/(\d+)\/Designer/.exec(page.url())[1]);
  created.push(cardId);
  const cardDoc = (await api(page, '/api/designs/' + cardId)).document;
  check('a click creates the card: the open sheet 210 x 148 mm, fold vertical, two named pages', cardDoc.fold === 'vertical' && cardDoc.width === 210 && cardDoc.height === 148 && cardDoc.pages.map(p => p.name).join('|') === 'Außen (Rückseite | Vorderseite)|Innen', JSON.stringify(cardDoc.pages.map(p => p.name)));
  await page.waitForSelector('#dt-fold:not([hidden])');
  const guides = await page.evaluate(() => ({
    line: !!document.querySelector('#dt-fold [data-fold-line="vertical"]'), safe: document.querySelectorAll('#dt-fold [data-fold-safe]').length,
    inSheet: !!document.querySelector('#dt-sheet #dt-fold'), inPage: !!document.querySelector('#dt-page #dt-fold, #dt-page [data-fold-line]'), pe: getComputedStyle(document.getElementById('dt-fold')).pointerEvents,
    lineBox: document.querySelector('#dt-fold [data-fold-line]').getBoundingClientRect().toJSON(), sheetBox: document.getElementById('dt-sheet').getBoundingClientRect().toJSON(),
  }));
  check('the editor draws a dashed fold line in the middle and a safe margin in each half, in a layer of the sheet that is no part of the page', guides.line && guides.safe === 2 && guides.inSheet && !guides.inPage && guides.pe === 'none' && Math.abs(guides.lineBox.left - (guides.sheetBox.left + guides.sheetBox.width / 2)) < 2, JSON.stringify(guides));
  check('the safe margin is 4 mm (a card): the first half starts at 4 / 210 of the sheet', await page.evaluate(() => { const b = document.querySelector('#dt-fold [data-fold-safe="0"]'); return Math.abs(parseFloat(b.style.getPropertyValue('--dt-fx')) - (4 / 210 * 100)) < 0.1; }));
  check('the second page "Innen" has the guides too', await (async () => { await page.keyboard.press('Escape'); await page.click('#dt-pages [role=tab]:nth-child(2), #dt-pages > *:nth-child(2)'); await page.waitForTimeout(300); return page.isVisible('#dt-fold [data-fold-line]'); })());
  // the guides are never part of the drawing: the engine makes the same picture with and without a fold, and the page layer holds no guide
  const same = await page.evaluate(async () => {
    const engine = window.DtEngine;
    const d = window.DtDesigner.app.doc;
    const withFold = engine.toStandaloneSvg ? await engine.toStandaloneSvg(d, engine.sampleValues(d), { page: 0, fonts: [] }) : '';
    const plain = JSON.parse(JSON.stringify(d));
    delete plain.fold;
    const without = engine.toStandaloneSvg ? await engine.toStandaloneSvg(engine.normalize(plain), engine.sampleValues(d), { page: 0, fonts: [] }) : '';
    const svgOf = typeof withFold === 'string' ? withFold : (withFold && withFold.svg) || '';
    return { equal: svgOf.length > 100 && svgOf === (typeof without === 'string' ? without : (without && without.svg) || ''), hasFoldWord: /fold/i.test(svgOf) };
  });
  check('the drawing (download, print, thumbnail, public view) is the same with and without a fold: nothing of the guides is in it', same.equal && !same.hasFoldWord, JSON.stringify(same));
  await page.click('#dt-pages > *:nth-child(1)').catch(() => { });
  // the toolbar of the page: Falz
  await page.click('.dt-stage, #dt-stage', { position: { x: 5, y: 5 } }).catch(() => { });
  await page.click('#dt-ctx button[aria-label="Falz (Klappkarte)"]');
  await page.waitForSelector('.dt-pop [data-value="horizontal"]');
  await page.click('.dt-pop [data-value="horizontal"]');
  check('"Falz" switches to a horizontal fold: the line runs through the middle of the page, one undo step', await page.evaluate(() => { const l = document.querySelector('#dt-fold [data-fold-line]'); return l.getAttribute('data-fold-line') === 'horizontal' && window.DtDesigner.app.doc.fold === 'horizontal'; }));
  await page.click('.dt-pop .mat-switch');
  check('"Hilfslinien zeigen" off hides the guides (the document keeps its fold)', await page.evaluate(() => document.getElementById('dt-fold').hidden && window.DtDesigner.app.doc.fold === 'horizontal'));
  await page.click('.dt-pop .mat-switch');
  await page.click('.dt-pop [data-value="none"]');
  check('"Keiner" takes the fold away: no guides, no fold in the document', await page.evaluate(() => document.getElementById('dt-fold').hidden && !('fold' in window.DtDesigner.app.doc)));
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  check('undo brings the fold back', await page.evaluate(() => window.DtDesigner.app.doc.fold === 'horizontal' && !document.getElementById('dt-fold').hidden));
  await shot(page, 'templates-fold-1440.png');

  // a one-page design that gets a fold becomes a card with two named pages
  const plainMade = await postJson(page, '/api/designs', { preset: 'a5-landscape' });
  created.push(plainMade.body.id);
  await page.goto(base + plainMade.body.url, { waitUntil: 'networkidle' });
  await page.waitForSelector('#dt-ctx');
  check('a design without a fold has no guides', await page.evaluate(() => document.getElementById('dt-fold').hidden));
  await page.click('#dt-ctx button[aria-label="Falz (Klappkarte)"]');
  await page.click('.dt-pop [data-value="vertical"]');
  check('"Senkrecht" on a one-page design adds the page "Innen" and names both', await page.evaluate(() => { const d = window.DtDesigner.app.doc; return d.fold === 'vertical' && d.pages.length === 2 && d.pages.map(p => p.name).join('|') === 'Außen (Rückseite | Vorderseite)|Innen'; }));
  await page.keyboard.press('Escape');

  // ------------------------------------------------------------------------------------------------ the panel Vorlagen of the editor
  await page.click('#dt-rail button:has-text("Vorlagen")');
  await page.waitForSelector('.dt-tpl__cell');
  const filters = await page.$$eval('.dt-tplfilter', s => s.map(x => x.getAttribute('data-filter') + ':' + x.options.length));
  check('the panel has compact filters: Anlass and Format', filters.length === 2 && filters[0].startsWith('occasion:') && Number(filters[0].split(':')[1]) >= 6 && Number(filters[1].split(':')[1]) >= 5, filters.join(' | '));
  const cells = (await page.$$('.dt-tpl__cell')).length;
  await page.selectOption('.dt-tplfilter[data-filter=occasion]', 'Social Media');
  const socialCount = new Set((await api(page, '/api/templates')).filter(x => x.occasion === 'Social Media').map(x => x.family)).size;
  await page.waitForFunction(n => document.querySelectorAll('.dt-tpl__cell').length === n, socialCount);
  check('the occasion narrows the panel to the families of that occasion (' + socialCount + ')', (await page.$$('.dt-tpl__cell')).length === socialCount && cells > socialCount);
  await page.selectOption('.dt-tplfilter[data-filter=occasion]', '');
  await page.fill('.dt-psearch', 'supermarkt');
  await page.waitForFunction(() => document.querySelectorAll('.dt-tpl__cell').length === 5);
  check('the search of the panel looks at the tags too ("supermarkt": five families, among them the Regaletikett)', (await page.$$eval('.dt-tpl__item', l => l.map(x => x.getAttribute('title')))).some(x => x.startsWith('Regaletikett')));
  await page.fill('.dt-psearch', '');
  await page.selectOption('.dt-tplfilter[data-filter=format]', '@page');
  await page.waitForFunction(() => document.querySelectorAll('.dt-tpl__cell').length >= 1);
  check('"Passend zur Seite" keeps the templates of the proportions of the page (a5 landscape = 210 x 148: about 1.42 to 1)', (await page.$$eval('.dt-tpl__item', l => l.map(x => x.getAttribute('title')))).length >= 1, (await page.$$eval('.dt-tpl__item', l => l.map(x => x.getAttribute('title')))).join(' | '));
  await shot(page, 'templates-panel-1440.png');

  // ------------------------------------------------------------------------------------------------ the tab Deko of the media browser
  const deko = await api(page, '/api/assets?take=300&category=Deko');
  if (deko.length) {
    await page.evaluate(() => { window.__picked = null; window.DtMedia.pick({ tab: 'deko' }, key => { window.__picked = key; }); });
    await page.waitForSelector('dialog.dt-media[open] .dt-media__tile');
    const tabs = await page.$$eval('.dt-media__tab', t => t.map(x => x.textContent));
    check('the media browser has the tab Deko between Logos and Alle', tabs.join('|').includes('Logos|Deko|Alle'), tabs.join('|'));
    const chips = await page.$$eval('.dt-media__chip', c => c.map(x => x.textContent));
    check('the tab Deko has chips for its groups (Alle and at least 8 groups with their counts)', chips.length >= 9 && /^Alle \(\d+\)$/.test(chips[0]) && chips.slice(1).every(c => /\(\d+\)$/.test(c)), chips.join(' | '));
    // the chips come from the server (all groups, not only those of the first page): the same list as the API says
    const apiGroups = await api(page, '/api/assets/groups?category=Deko');
    check('the chips are the groups of the whole Deko pack (the list of /api/assets/groups, with its counts)', apiGroups.length >= 9 && JSON.stringify(chips.slice(1)) === JSON.stringify(apiGroups.map(g => g.name + ' (' + g.count + ')')), chips.join(' | '));
    const total = apiGroups.reduce((n, g) => n + g.count, 0);
    check('"Alle" counts every piece, and the grid pages (a first page, "Mehr laden" until all are there)', chips[0] === 'Alle (' + total + ')' && total > (await page.$$('.dt-media__tile')).length && await page.isVisible('.dt-media__more'));
    const firstPageTiles = (await page.$$('.dt-media__tile')).length;
    await page.click('.dt-media__more');
    await page.waitForFunction(n => document.querySelectorAll('.dt-media__tile').length > n, firstPageTiles);
    const before = (await page.$$('.dt-media__tile')).length;
    const lastGroup = apiGroups[apiGroups.length - 1].name;
    await page.click('.dt-media__chip[data-chip="' + lastGroup + '"]');
    await page.waitForFunction(g => { const t = Array.from(document.querySelectorAll('.dt-media__tile')); return t.length > 0 && t.every(x => x.getAttribute('title').startsWith(g + ' · ')); }, lastGroup);
    const after = (await page.$$('.dt-media__tile')).length;
    check('a group chip shows only that group (the tiles drop the group from their names)', after > 0 && after < before && (await page.$$eval('.dt-media__tile', n => { const g = document.querySelector('.dt-media__chip[aria-pressed=true]').textContent.split(' (')[0]; return n.every(x => x.getAttribute('title').startsWith(g + ' · ') && !x.querySelector('.dt-media__name').textContent.startsWith(g)); })));
    await shot(page, 'templates-deko-1440.png');
    await page.click('.dt-media__tile');
    await page.waitForFunction(() => window.__picked);
    check('a click on a piece picks its key (deko-...)', /^deko-/.test(await page.evaluate(() => window.__picked)));
  } else {
    check('the Deko pack is seeded (category Deko in the library)', false, 'no Deko piece in /api/assets');
  }

  // ------------------------------------------------------------------------------------------------ every template draws without a warning
  await page.goto(base + '/Templates', { waitUntil: 'networkidle' });
  const report = await page.evaluate(async () => {
    const engine = window.DtEngine;
    const fonts = (await (await fetch('/api/fonts')).json()).map(f => ({ family: f.family, weight: f.weight, style: f.style, url: f.url }));
    const icons = (await (await fetch('/lib/icons.json')).json()).icons;
    const templates = await (await fetch('/api/templates')).json();
    const out = [];
    for (const t of templates) {
      const doc = engine.normalize((await (await fetch('/api/designs/' + t.id)).json()).document);
      const warnings = [];
      let drawn = 0;
      const host = document.createElement('div');
      for (let p = 0; p < doc.pages.length; p++) {
        for (const mode of ['output', 'editor']) {
          const svg = await engine.renderInto(host, doc, engine.sampleValues(doc), {
            page: p, mode, fonts, idPrefix: 'tc' + p + mode + '-',
            assetUrl: key => '/media/' + encodeURIComponent(key),
            icon: name => (icons[name] ? icons[name].b : null),
            onWarning: m => warnings.push(`${t.name} S.${p + 1}: ${m}`),
          });
          if (mode === 'output' && svg.querySelectorAll('rect, path, text, image, ellipse, polygon').length > 0) drawn++;
        }
      }
      out.push({ name: t.name, pages: doc.pages.length, drawn, warnings: Array.from(new Set(warnings)) });
    }
    return out;
  });
  check('the engine draws every page of every template (' + report.length + ' templates)', report.length >= 330 && report.every(r => r.drawn === r.pages), JSON.stringify(report.filter(r => r.drawn !== r.pages)));
  const warned = report.flatMap(r => r.warnings);
  check('no template makes the engine warn (missing medium, icon, font, invalid code)', warned.length === 0, warned.join(' | '));

  // ------------------------------------------------------------------------------------------------ the viewer
  const vctx = await newContext(browser, { viewport: { width: 1440, height: 900 } });
  const viewer = await vctx.newPage();
  watch(viewer, 'viewer');
  check('the viewer signs in', await login(viewer, accounts.viewer));
  await viewer.goto(base + '/Templates', { waitUntil: 'networkidle' });
  await viewer.waitForSelector('.dt-tg');
  const vTiles = await viewer.$$('.dt-tg');
  check('a second member sees the templates with "Vorlage verwenden" enabled and no "Bearbeiten"', vTiles.length >= 10 && (await viewer.$$('.dt-tg button[disabled]')).length === 0 && (await viewer.$$('.dt-tg .mat-btn--primary[data-use-template]')).length === vTiles.length && (await viewer.$$('.dt-tg [data-tile-edit]:not([hidden])')).length === 0);
  const used = await postJson(viewer, `/api/designs/${visitId}/use-template`, {});
  check('the API gives them their own copy (200); the template itself they cannot delete (403)', used.status === 200 && used.body.id !== Number(visitId) && (await postJson(viewer, `/api/designs/${visitId}/delete`, {})).status === 403, JSON.stringify(used));
  if (used.status === 200) { await postJson(viewer, `/api/designs/${used.body.id}/delete`, {}); }
  await vctx.close();

  // ------------------------------------------------------------------------------------------------ the phone
  const phone = await newContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await phone.newPage();
  watch(p, 'phone');
  await login(p, accounts.designer);
  await p.goto(base + '/Templates', { waitUntil: 'networkidle' });
  await p.waitForSelector('.dt-tg');
  check('phone: the gallery does not scroll sideways, the chips scroll inside their row', (await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1);
  await shot(p, 'templates-gallery-390.png');
  await p.tap('.dt-tg [data-tile-preview]');
  await p.waitForSelector('dialog.dt-tpv[open]');
  await p.waitForTimeout(800);
  check('phone: the preview dialog fits the screen and the pages come after the details', await p.evaluate(() => { const d = document.querySelector('dialog.dt-tpv').getBoundingClientRect(); return d.width <= 391 && d.right <= 391.5; }));
  await shot(p, 'templates-preview-390.png');
  await p.keyboard.press('Escape').catch(() => { });
  await p.evaluate(() => window.DtCreate.open());
  await p.waitForSelector('dialog#dt-create[open]');
  await p.click('dialog#dt-create .dt-moreformats__summary');
  check('phone: "Mehr Formate" fits the dialog', await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1 && document.querySelector('.dt-moreformats__item').getBoundingClientRect().right <= window.innerWidth));
  await shot(p, 'templates-create-more-390.png');
  await phone.close();

  for (const id of created) await postJson(page, `/api/designs/${id}/delete`, {});
  check('no console errors and no CSP violations', problems.length === 0, problems.join(' | '));
  await browser.close();
  let failed = 0;
  for (const r of results) {
    if (!r.ok) { failed++; }
    console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail && !r.ok ? ' - ' + r.detail : ''}`);
  }
  console.log(`\n${results.length - failed} of ${results.length} checks passed. Screenshots in ${outDir}`);
  process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
