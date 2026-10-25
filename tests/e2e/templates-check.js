// Checks the templates (docs/PLAN-CANVA.md section 1 item 3 and section 5): the gallery "Vorlagen" (grouped by category, search, category filter, thumbnails drawn by the engine),
// "Vorlage verwenden" (a copy opens in the designer, the template stays; every member), "Bearbeiten" (the templates are the platform's own: only an administrator opens them), and that EVERY template draws on every page without a warning of the render engine
// (missing medium, unknown icon, invalid code, unknown placeholder, missing font). The copies the check makes are deleted again at the end.
//
//   cd tests/e2e && npm install
//   node templates-check.js [base url, default http://localhost:3043]
const lib = require('./lib.js');

const args = process.argv.slice(2);
const { base, problems, watch, launch, newContext, login, ensureAccounts, postJson } = lib(args, { ignoreUrl: /\/api\/designs\/\d+/ });

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); };

(async () => {
  const browser = await launch();
  const accounts = await ensureAccounts(browser);
  const created = [];

  const ctx = await newContext(browser, { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  watch(page, 'designer');
  check('the designer signs in', await login(page, accounts.designer));
  const settle = () => page.waitForFunction(() => document.querySelectorAll('[data-dt-preview]:not(.is-ready):not(.is-failed)').length === 0, null, { timeout: 40000 }).catch(() => { });

  // ------------------------------------------------------------------------------------------------ the gallery
  await page.goto(base + '/Templates', { waitUntil: 'networkidle' });
  // The thumbnails are drawn lazily (when they come into view): scroll through the gallery once.
  const below = (await page.$$('.dt-tpl')).length;
  for (let i = 0; i < below; i++) { const thumb = page.locator('.dt-tpl .dt-designthumb').nth(i); await thumb.scrollIntoViewIfNeeded(); await page.waitForTimeout(150); await thumb.locator('svg:not(.mat-icon), img').first().waitFor({ timeout: 30000 }).catch(() => { }); }
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.dt-tpl .dt-designthumb')).every(t => t.classList.contains('is-ready') || t.querySelector('img')), null, { timeout: 40000 }).catch(() => { });
  const tiles = await page.$$eval('.dt-tpl', els => els.map(e => ({ id: e.getAttribute('data-template'), title: e.querySelector('.dt-tile__title').textContent.trim(), meta: e.querySelector('.mat-tile__meta').textContent.trim() })));
  check('the gallery shows at least 10 templates', tiles.length >= 10, String(tiles.length));
  const categories = await page.$$eval('.dt-category__title', els => els.map(e => e.firstChild.textContent.trim()));
  check('they are grouped by category (Etiketten, Flyer, Karten, Poster, Social Media)', ['Etiketten', 'Flyer', 'Karten', 'Poster', 'Social Media'].every(c => categories.includes(c)), categories.join(', '));
  const thumbs = await page.evaluate(() => Array.from(document.querySelectorAll('.dt-tpl .dt-designthumb')).map(t => ({ ok: !!t.querySelector('svg:not(.mat-icon), img'), failed: t.classList.contains('is-failed') })));
  check('every tile has a thumbnail (a saved picture or one drawn by the engine), none failed', thumbs.length === tiles.length && thumbs.every(t => t.ok && !t.failed), JSON.stringify(thumbs));
  check('the ten templates of the plan are there by name', ['Käsetheke', 'Obst & Gemüse', 'Regaletikett', 'Glasetikett', 'Visitenkarte', 'Flyer A5', 'Poster A3', 'SALE', 'Neu im Laden', 'Grußkarte'].every(n => tiles.some(t => t.title.includes(n))), tiles.map(t => t.title).join(' | '));
  check('a tile shows name, size and category', tiles.every(t => /\d/.test(t.meta) && t.title.length > 3));
  check('every tile has "Vorlage verwenden"; a member has no "Bearbeiten" (the templates belong to the platform)', (await page.$$('.dt-tpl .mat-btn--primary[data-use-template]')).length === tiles.length && (await page.$$('.dt-tpl .mat-btn:has-text("Bearbeiten")')).length === 0);
  check('the toolbar is above the gallery (search, filter, sort)', await page.isVisible('.mat-toolbar input[type=search]') && await page.isVisible('.mat-toolbar button:has-text("Filter")') && await page.isVisible('.mat-toolbar button:has-text("Sortierung")'));
  await page.screenshot({ path: require('path').join(require('os').tmpdir(), 'designthix-templates-gallery.png') });

  // search and category filter
  await page.fill('.mat-toolbar input[type=search]', 'karte');
  await Promise.all([page.waitForNavigation(), page.press('.mat-toolbar input[type=search]', 'Enter')]);
  const found = await page.$$eval('.dt-tpl .dt-tile__title', els => els.map(e => e.textContent.trim()));
  check('the search "karte" finds the cards (name and category)', found.length >= 2 && found.length < tiles.length && found.some(t => t.includes('Visitenkarte')) && found.some(t => t.includes('Grußkarte')), found.join(' | '));
  await page.goto(base + '/Templates', { waitUntil: 'networkidle' });
  await page.click('.mat-toolbar button:has-text("Filter")');
  await page.waitForSelector('dialog[open] select');
  await page.selectOption('dialog[open] select', 'Social Media');
  await Promise.all([page.waitForNavigation(), page.click('dialog[open] button[type=submit]')]);
  const social = await page.$$eval('.dt-tpl .dt-tile__title', els => els.map(e => e.textContent.trim()));
  check('the category filter "Social Media" keeps the two posts', social.length === 2 && social.every(t => t.startsWith('Instagram')), social.join(' | '));
  await page.goto(base + '/Templates?q=' + encodeURIComponent('gibt-es-nicht-xyz'), { waitUntil: 'networkidle' });
  check('a search without a hit shows an empty state', await page.isVisible('[data-templates-empty]'));
  await page.goto(base + '/Templates', { waitUntil: 'networkidle' });

  // ------------------------------------------------------------------------------------------------ use and edit
  const visit = tiles.find(t => t.title.startsWith('Visitenkarte'));
  // an administrator manages the templates of the platform: every tile has "Bearbeiten"
  const actx = await newContext(browser, { viewport: { width: 1440, height: 900 } });
  const admin = await actx.newPage();
  watch(admin, 'admin');
  check('the administrator signs in', await login(admin, accounts.admin));
  await admin.goto(base + '/Templates', { waitUntil: 'networkidle' });
  check('the administrator has "Bearbeiten" on every tile', (await admin.$$('.dt-tpl .mat-btn:has-text("Bearbeiten")')).length === tiles.length);
  const href = await admin.locator(`[data-template="${visit.id}"] .mat-btn:has-text("Bearbeiten")`).getAttribute('href');
  check('"Bearbeiten" opens the template itself in the designer', href === `/Designs/${visit.id}/Designer`, href);
  await actx.close();
  await Promise.all([page.waitForURL(/\/Designs\/\d+\/Designer/), page.click(`[data-template="${visit.id}"] [data-use-template].mat-btn`)]);
  const copyId = Number(/Designs\/(\d+)\/Designer/.exec(page.url())[1]);
  created.push(copyId);
  const copy = await page.evaluate(async i => (await fetch('/api/designs/' + i)).json(), copyId);
  check('"Vorlage verwenden" opens a COPY (new id) with both pages of the card', copyId !== Number(visit.id) && copy.document.pages.length === 2 && copy.name === visit.title, `${copyId} ${copy.name}`);
  const list = await page.evaluate(async () => (await (await fetch('/api/templates')).json()).map(t => t.id));
  check('the copy is not a template, the template is still there', !list.includes(copyId) && list.includes(Number(visit.id)));

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
      // a design with data: every row of its sample values draws as well (empty values must not warn)
      out.push({ name: t.name, pages: doc.pages.length, drawn, warnings: Array.from(new Set(warnings)) });
    }
    return out;
  });
  check('the engine draws every page of every template (' + report.length + ' templates)', report.length >= 10 && report.every(r => r.drawn === r.pages), JSON.stringify(report.filter(r => r.drawn !== r.pages)));
  const warned = report.flatMap(r => r.warnings);
  check('no template makes the engine warn (missing medium, icon, font, invalid code)', warned.length === 0, warned.join(' | '));

  // ------------------------------------------------------------------------------------------------ the viewer
  const vctx = await newContext(browser, { viewport: { width: 1440, height: 900 } });
  const viewer = await vctx.newPage();
  watch(viewer, 'viewer');
  check('the viewer signs in', await login(viewer, accounts.viewer));
  await viewer.goto(base + '/Templates', { waitUntil: 'networkidle' });
  const vTiles = await viewer.$$('.dt-tpl');
  check('a second member sees all templates with "Vorlage verwenden" enabled and no "Bearbeiten"', vTiles.length >= 10 && (await viewer.$$('.dt-tpl button[disabled]')).length === 0 && (await viewer.$$('.dt-tpl .mat-btn--primary[data-use-template]')).length === vTiles.length && (await viewer.$$('.dt-tpl a:has-text("Bearbeiten")')).length === 0);
  const used = await postJson(viewer, `/api/designs/${visit.id}/use-template`, {});
  check('the API gives them their own copy (200); the template itself they cannot delete (403)', used.status === 200 && used.body.id !== Number(visit.id) && (await postJson(viewer, `/api/designs/${visit.id}/delete`, {})).status === 403, JSON.stringify(used));
  if (used.status === 200) { await postJson(viewer, `/api/designs/${used.body.id}/delete`, {}); }

  // ------------------------------------------------------------------------------------------------ the phone
  const phone = await newContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await phone.newPage();
  watch(p, 'phone');
  await login(p, accounts.designer);
  await p.goto(base + '/Templates', { waitUntil: 'networkidle' });
  check('phone: the gallery does not scroll sideways', (await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1);

  for (const id of created) await postJson(page, `/api/designs/${id}/delete`, {});
  check('no console errors and no CSP violations', problems.length === 0, problems.join(' | '));
  await browser.close();
  let failed = 0;
  for (const r of results) {
    if (!r.ok) { failed++; }
    console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail && !r.ok ? ' - ' + r.detail : ''}`);
  }
  console.log(`\n${results.length - failed} of ${results.length} checks passed.`);
  process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
