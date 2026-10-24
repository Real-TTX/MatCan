// Takes the screenshots of the README (docs/images/*.png) from a running stack, light mode, with the content of the seeded demo ONLY: run it against a clean stack
// (./scripts/redeploy.ps1 -Clean), NOT after the other checks, which leave test designs and lists behind. On an empty database the setup assistant makes the
// administrator "Anna Beispiel" (the account is written to the git-ignored tests/e2e/test-account.json); otherwise that file must hold the administrator.
//
//   cd tests/e2e && npm install
//   node screens.js [base url, default http://localhost:3043] [--out ../../docs/images] [--fake-host <host the APP reaches this machine by>] [--fake-port 3066] [--no-ai]
//
// The screenshot of the AI preview needs a provider: the script starts the fake server of ai-check.js, makes a profile through the admin pages, shows the preview of an
// import (nothing is applied) and removes the profile again. With --no-ai that screenshot is skipped.
const fs = require('fs');
const path = require('path');
const lib = require('./lib.js');
const { fake, startFake } = require('./fake-ai.js');

const args = process.argv.slice(2);
const argValue = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const { base, problems, watch, launch, newContext, login, PASSWORD } = lib(args);
const out = path.resolve(__dirname, argValue('--out', '../../docs/images'));
const fakePort = Number(argValue('--fake-port', '3066'));
const fakeHost = argValue('--fake-host', /localhost:3043|127\.0\.0\.1:3043/.test(base) ? 'host.docker.internal' : '127.0.0.1');
const withAi = !args.includes('--no-ai');
const accountFile = path.join(__dirname, 'test-account.json');

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

  // The start page, the gallery of designs.
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelectorAll('[data-dt-preview]:not(.is-ready)').length === 0, null, { timeout: 20000 }).catch(() => { });
  await shot('start.png');
  await page.goto(base + '/Designs', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelectorAll('[data-dt-preview]:not(.is-ready)').length === 0, null, { timeout: 20000 }).catch(() => { });
  await shot('designs.png');

  // The designer with the demo label, the name selected.
  const designId = Number((await hrefOf('/Designs', 'a.dt-designtile', 'Käsetheke – Preisschild')).match(/(\d+)$/)[1]);
  await page.goto(`${base}/Designs/${designId}/Designer`);
  await page.waitForSelector('#dt-ds:not(.is-loading)', { timeout: 20000 });
  await page.evaluate(() => window.DtDesigner.canvas.whenIdle());
  await page.evaluate(() => { const app = window.DtDesigner.app; const name = app.doc.elements.find(e => e.name === 'Name'); app.select([name.id]); });
  await page.evaluate(() => window.DtDesigner.canvas.whenIdle());
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await shot('designer.png');

  // The data list: the grid of the six cheeses.
  const listId = Number((await hrefOf('/DataLists', 'a', 'Käsetheke (Beispiel)')).match(/(\d+)(\?.*)?$/)[1]);
  await page.goto(`${base}/DataLists/Edit/${listId}?tab=rows`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-dt-grid][data-ready="true"]', { state: 'attached', timeout: 20000 });
  await shot('datalist.png');

  // The media library.
  await page.goto(base + '/Assets', { waitUntil: 'networkidle' });
  await shot('media.png');

  // The output job: the run page with the sheets.
  const jobHref = await hrefOf('/Outputs', 'a', 'Käsetheke – A4 mit 4 Etiketten');
  const jobId = Number(jobHref.match(/(\d+)/)[1]);
  await page.goto(`${base}/Outputs/${jobId}/Run`);
  await page.waitForFunction(() => document.getElementById('dt-run') && document.getElementById('dt-run').getAttribute('data-state') === 'ready', null, { timeout: 60000 });
  await shot('output.png');
  await page.goto(`${base}/Outputs/Edit/${jobId}?tab=layout`, { waitUntil: 'networkidle' });
  await shot('output-job.png');

  // The phone: the start page and the designs (before the AI run, so that the counts on the start page are those of a new installation).
  const phone = await newContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'light', deviceScaleFactor: 2 });
  const p = await phone.newPage();
  watch(p, 'phone');
  await login(p, admin);
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.querySelectorAll('[data-dt-preview]:not(.is-ready)').length === 0, null, { timeout: 20000 }).catch(() => { });
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(out, 'phone-start.png') });
  written.push('phone-start.png');
  console.log('wrote phone-start.png');
  await p.goto(base + '/Designs', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.querySelectorAll('[data-dt-preview]:not(.is-ready)').length === 0, null, { timeout: 20000 }).catch(() => { });
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(out, 'phone-designs.png') });
  written.push('phone-designs.png');
  console.log('wrote phone-designs.png');

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
