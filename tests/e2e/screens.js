// Takes the screenshots of the README (docs/images/*.png) from a running stack, light mode, 1440 x 900 (and one phone, 390 wide), with the content of the seeded demo and templates ONLY:
// run it against a CLEAN DATABASE (./scripts/redeploy.ps1 -Clean, or the app from source against a new database, see CLAUDE.md), NOT after the other checks, which leave test designs and lists behind.
// On an empty database the setup assistant makes the administrator "Anna Beispiel" (the account is written to the git-ignored tests/e2e/test-account.json, replacing it: back it up first); otherwise
// that file must hold the administrator. The script changes nothing that lasts: the copy of a template that it needs for the text effects is deleted again, the AI profile is removed.
//
//   cd tests/e2e && npm install
//   node screens.js [base url, default http://localhost:3043] [--out ../../docs/images] [--fake-host <host the APP reaches this machine by>] [--fake-port 3066] [--no-ai]
//
// Shots: start, create-dialog, templates, datalist, media, output, output-job, phone-start, then the editor (editor, context-menu, text-combinations, download, media-browser, editor-data,
// text-effects, phone-editor) and ai-import. The shot of the AI preview needs a provider: the script starts the fake server of ai-check.js, makes a profile through the admin pages, shows the preview of an
// import (nothing is applied) and removes the profile again. With --no-ai that screenshot is skipped.
const fs = require('fs');
const path = require('path');
const lib = require('./lib.js');
const { fake, startFake } = require('./fake-ai.js');
const { openDesigner, openPanel, idle, raf2 } = require('./editor-lib.js');

const args = process.argv.slice(2);
const argValue = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const { base, problems, watch, launch, newContext, login, PASSWORD } = lib(args);
const out = path.resolve(__dirname, argValue('--out', '../../docs/images'));
const fakePort = Number(argValue('--fake-port', '3066'));
const fakeHost = argValue('--fake-host', /localhost:3043|127\.0\.0\.1:3043/.test(base) ? 'host.docker.internal' : '127.0.0.1');
const withAi = !args.includes('--no-ai');
const accountFile = process.env.DT_ACCOUNT_FILE || path.join(__dirname, 'test-account.json'); // DT_ACCOUNT_FILE: another file, for checks that run side by side

const written = [];

async function ensureAdmin(browser) {
  const context = await newContext(browser);
  const page = await context.newPage();
  watch(page, 'setup');
  const accounts = fs.existsSync(accountFile) ? JSON.parse(fs.readFileSync(accountFile, 'utf8')) : {};
  await page.goto(base + '/Account/Setup');
  if (/Setup/.test(page.url())) {
    const admin = { email: 'anna@example.com', password: PASSWORD };
    await page.fill('#Input_DisplayName', 'Anna Beispiel');
    await page.fill('#Input_Email', admin.email);
    await page.fill('#Input_Password', admin.password);
    await page.fill('#Input_PasswordRepeat', admin.password);
    await Promise.all([page.waitForNavigation(), page.click('button[type=submit]')]);
    fs.writeFileSync(accountFile, JSON.stringify({ admin }, null, 2));
    await context.close();
    return admin;
  }
  await context.close();
  if (!accounts.admin) { throw new Error('The database is not empty and test-account.json has no administrator: start from a clean stack.'); }
  return accounts.admin;
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await launch();
  const admin = await ensureAdmin(browser);

  const desktop = await newContext(browser, { viewport: { width: 1440, height: 900 }, colorScheme: 'light', deviceScaleFactor: 1 });
  const page = await desktop.newPage();
  watch(page, 'screens');
  if (!await login(page, admin)) { throw new Error('Sign-in failed.'); }

  async function shot(file, target) {
    await page.waitForTimeout(500);
    await (target || page).screenshot({ path: path.join(out, file) });
    written.push(file);
    console.log('wrote ' + file);
  }

  async function hrefOf(url, selector, text) {
    await page.goto(base + url, { waitUntil: 'networkidle' });
    const href = await page.locator(selector, { hasText: text }).first().getAttribute('href');
    if (!href) { throw new Error(`No link "${text}" on ${url}`); }
    return href;
  }

  const waitPreviews = p => p.waitForFunction(() => document.querySelectorAll('[data-dt-preview]:not(.is-ready)').length === 0, null, { timeout: 20000 }).catch(() => { });

  // The start page ("Was möchtest du heute gestalten?"), the dialog "Design erstellen" and the gallery of templates.
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await waitPreviews(page);
  await page.setViewportSize({ width: 1440, height: 1100 });   // taller, so that the row of templates shows
  await shot('start.png');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.click('.mat-nav a.mat-nav__item--primary');
  await page.waitForSelector('#dt-create[open]');
  await shot('create-dialog.png');
  await page.keyboard.press('Escape');
  await page.goto(base + '/Templates', { waitUntil: 'networkidle' });
  await waitPreviews(page);
  await shot('templates.png');

  // The add-on "Serien": the data list, the library of media, the output job with its sheets.
  const listId = Number((await hrefOf('/DataLists', 'a', 'Käsetheke (Beispiel)')).match(/(\d+)(\?.*)?$/)[1]);
  await page.goto(`${base}/DataLists/Edit/${listId}?tab=rows`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-dt-grid][data-ready="true"]', { state: 'attached', timeout: 20000 });
  await shot('datalist.png');
  await page.goto(base + '/Assets', { waitUntil: 'networkidle' });
  await shot('media.png');
  const jobHref = await hrefOf('/Outputs', 'a', 'Käsetheke – A4 mit 4 Etiketten');
  const jobId = Number(jobHref.match(/(\d+)/)[1]);
  await page.goto(`${base}/Outputs/${jobId}/Run`);
  await page.waitForFunction(() => document.getElementById('dt-run') && document.getElementById('dt-run').getAttribute('data-state') === 'ready', null, { timeout: 60000 });
  await shot('output.png');
  await page.goto(`${base}/Outputs/Edit/${jobId}?tab=layout`, { waitUntil: 'networkidle' });
  await shot('output-job.png');

  // The phone: the start page, before anything changes the counts, and later the editor.
  const phone = await newContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'light', deviceScaleFactor: 2 });
  const p = await phone.newPage();
  watch(p, 'phone');
  await login(p, admin);
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  await waitPreviews(p);
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(out, 'phone-start.png') });
  written.push('phone-start.png');
  console.log('wrote phone-start.png');

  // The editor. A template is opened itself where nothing is changed; a copy (deleted at the end) is made for the effects.
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  const templates = await page.evaluate(async () => (await (await fetch('/api/templates')).json()));
  const templateId = name => { const t = templates.find(x => x.name.indexOf(name) === 0); if (!t) { throw new Error('No template ' + name); } return t.id; };
  const open = id => openDesigner(page, base, id);
  const select = async name => {
    await page.evaluate(n => { const app = window.DtDesigner.app; const el = app.elements().find(e => e.name === n); app.select([el.id]); }, name);
    await raf2(page);
    await idle(page);
  };
  const elementId = name => page.evaluate(n => window.DtDesigner.app.elements().find(e => e.name === n).id, name);

  // 1. The Instagram post with the panel Elemente and a selected headline.
  await open(templateId('Instagram-Beitrag'));
  await openPanel(page, 'elements');
  await page.waitForTimeout(800);
  await select('SALE');
  await page.waitForTimeout(400);
  await shot('editor.png');
  // 2. The context menu of the headline.
  const at = await page.evaluate(id => { const r = window.DtDesigner.canvas.clientRectOf(id); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, await elementId('SALE'));
  await page.mouse.click(at.x, at.y, { button: 'right' });
  await page.waitForSelector('.mat-menu');
  await shot('context-menu.png');
  await page.keyboard.press('Escape');
  // 3. The panel Text with the font combinations.
  await openPanel(page, 'text');
  await page.waitForFunction(() => document.querySelectorAll('.dt-combo__thumb svg').length >= 10, null, { timeout: 15000 }).catch(() => { });
  await page.waitForTimeout(500);
  await shot('text-combinations.png');
  // 4. The download dialog.
  await page.click('#dt-download');
  await page.waitForSelector('dialog.dt-downloaddlg[open]');
  await shot('download.png');
  await page.keyboard.press('Escape');
  await page.waitForSelector('dialog.dt-downloaddlg', { state: 'detached' });

  // 5. The media browser through "Ersetzen" of the photo frame.
  await open(templateId('Glasetikett'));
  await openPanel(page, 'uploads');
  await select('Foto');
  await page.click('#dt-ctx button:has-text("Bild wählen")');
  await page.waitForSelector('dialog.dt-media[open]');
  await page.click('.dt-media__tab[data-tab="all"]');
  await page.waitForSelector('.dt-media__tile');
  await page.waitForTimeout(700);
  await shot('media-browser.png');
  await page.keyboard.press('Escape');
  await page.waitForSelector('dialog.dt-media', { state: 'detached' });

  // 6. The demo label with the panel Daten (Zusatz): the preview with a row of the data list.
  await open(templateId('Käsetheke'));
  await page.evaluate(id => window.DtDesigner.data.choose(id, 1), listId);
  await page.waitForFunction(() => window.DtDesigner.app.preview && window.DtDesigner.app.preview.rows.length > 0);
  await openPanel(page, 'data');
  await idle(page);
  await select('Name');
  await page.waitForTimeout(500);
  await shot('editor-data.png');

  // 7. Text effects on a copy of the Instagram template.
  const copy = await page.evaluate(async id => {
    const token = document.querySelector('meta[name=dt-csrf]').content;
    const r = await fetch('/api/designs/' + id + '/use-template', { method: 'POST', headers: { RequestVerificationToken: token } });
    return r.json();
  }, templateId('Instagram-Beitrag'));
  await open(copy.id);
  await select('Hinweis');
  await page.click('#dt-ctx button[aria-label="Effekte"]');
  await page.waitForFunction(() => document.querySelectorAll(".dt-fxpreset__thumb svg").length >= 7, null, { timeout: 10000 });
  await page.click(".dt-fxpreset[data-fx=\"background\"]");
  await idle(page);
  await page.waitForFunction(() => window.DtDesigner.app.saveState === 'saved', null, { timeout: 15000 });   // the autosave must be through before the shot and before the copy goes
  await page.waitForTimeout(500);
  await shot('text-effects.png');
  await page.evaluate(async id => {
    const token = document.querySelector('meta[name=dt-csrf]').content;
    await fetch('/api/designs/' + id + '/delete', { method: 'POST', headers: { RequestVerificationToken: token } });
  }, copy.id);

  // 8. The phone editor.
  await openDesigner(p, base, templateId('Instagram-Beitrag'));
  await p.waitForTimeout(800);
  await p.screenshot({ path: path.join(out, 'phone-editor.png') });
  written.push('phone-editor.png');
  console.log('wrote phone-editor.png');

  // The AI import preview, against the fake provider (last: it leaves one run in the log).
  if (withAi) {
    await startFake(fakePort);
    await page.goto(base + '/Admin/Ai/Profiles/Edit');
    await page.fill('#Input_Name', 'Beispiel-Anbieter');
    await page.selectOption('#Input_Preset', 'custom');
    await page.fill('#Input_BaseUrl', `http://${fakeHost}:${fakePort}/v1`);
    await page.fill('#Input_ApiKey', 'sk-fake-screens');
    await page.fill('#Input_Model', 'fake-model');
    await Promise.all([page.waitForNavigation(), page.click('button[type=submit].mat-btn--primary')]);
    await page.goto(base + '/Admin/Ai/Profiles');
    const item = page.locator('.mat-item', { hasText: 'Beispiel-Anbieter' });
    if (await item.locator('button:has-text("Aktivieren")').count()) { await Promise.all([page.waitForNavigation(), item.locator('button:has-text("Aktivieren")').click()]); }

    await page.goto(`${base}/DataLists/Edit/${listId}?tab=import`);
    await page.waitForSelector('[data-ai-import]');
    await page.fill('[data-ai-form] textarea', 'Lieferschein Käse Herbst\nTilsiter, 2,79 € pro 100 g, aus Deutschland\nBrie de Meaux, 3,90 €, Frankreich\nGouda jung, 2,50 € pro 100 g, aus den Niederlanden');
    await page.fill('[data-ai-form] input[type=text]', 'Land ist das Herkunftsland');
    await page.click('[data-ai-form] button:has-text("Vorschlag erstellen")');
    await page.waitForSelector('dialog.dt-ai[open] .dt-ai-table', { timeout: 30000 });
    await page.waitForTimeout(500);
    await shot('ai-import.png');
    // Nothing is taken over: the proposal is discarded, the profile removed, so the clean stack stays as it was.
    await page.locator('dialog.dt-ai[open] button:has-text("Verwerfen")').first().click().catch(() => page.keyboard.press('Escape'));
    await page.waitForTimeout(400);
    await page.goto(base + '/Admin/Ai/Profiles');
    await Promise.all([page.waitForNavigation(), page.locator('.mat-item', { hasText: 'Beispiel-Anbieter' }).locator('a.mat-item__main').click()]);
    await page.click('button:has-text("Löschen")');
    await page.click('dialog[open] [data-dlg-ok], dialog[open] .mat-btn--danger').catch(() => { });
    await page.waitForNavigation().catch(() => { });
    fake.server.close();
  }

  await browser.close();
  console.log(`\n${written.length} screenshots in ${out}`);
  if (problems.length) { console.log('problems:\n' + problems.join('\n')); process.exit(1); }
})().catch(e => { console.error(e); try { fake.server.close(); } catch (x) { /* not started */ } process.exit(1); });
