// Takes the screenshots of the README (docs/images/*.png) from a running stack, light mode, 1440 x 900 (and one phone, 390 wide), with the content of the seeded demo and templates ONLY:
// run it against a CLEAN DATABASE (./scripts/redeploy.ps1 -Clean, or the app from source against a new database, see CLAUDE.md), NOT after the other checks, which leave test designs and lists behind.
// On an empty database the setup assistant makes the administrator "Anna Beispiel" (the account is written to the git-ignored tests/e2e/test-account.json, replacing it: back it up first); otherwise
// that file must hold the administrator. The script changes nothing that lasts: the copy of a template that it needs for the text effects is deleted again, the AI profile is removed.
//
//   cd tests/e2e && npm install
//   node screens.js [base url, default http://localhost:3043] [--out ../../docs/images] [--fake-host <host the APP reaches this machine by>] [--fake-port 3066] [--no-ai]
//
// Shots: start, create-dialog, templates, datalist, media, output, output-job, phone-start, then the editor (editor, context-menu, text-combinations, download, media-browser, editor-data,
// text-effects, phone-editor), then the platform (projects, share, team-members, public-view, comments, notifications) and ai-import. The shot of the AI preview needs a provider: the script starts
// the fake server of ai-check.js, makes a profile through the admin pages, shows the preview of an import (nothing is applied) and removes the profile again. With --no-ai that screenshot is skipped.
//
// The platform shots (docs/PLAN-PLATFORM.md) need people: the administrator makes four members (Mia Hofmann, Jonas Weber, Lea Schneider, Tim Brandt), Mia makes the team "Team Marketing", folders and
// designs from the templates, the others share, comment and ask for access. Everything the platform shots made is removed again at the end (the team by its owner, the accounts by the administrator
// with their content), so the checks that follow find the stack as the shots before found it. --platform-only runs just these (for a stack that is clean otherwise).
const fs = require('fs');
const path = require('path');
const lib = require('./lib.js');
const { fake, startFake } = require('./fake-ai.js');
const { openDesigner, openPanel, idle, raf2 } = require('./editor-lib.js');

const args = process.argv.slice(2);
const argValue = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const { base, problems, watch, launch, newContext, login, postJson, PASSWORD } = lib(args);
const out = path.resolve(__dirname, argValue('--out', '../../docs/images'));
const fakePort = Number(argValue('--fake-port', '3066'));
const fakeHost = argValue('--fake-host', /localhost:3043|127\.0\.0\.1:3043/.test(base) ? 'host.docker.internal' : '127.0.0.1');
const withAi = !args.includes('--no-ai');
const platformOnly = args.includes('--platform-only');
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

/** The images of the page are loaded (the tiles of the browser fetch them after they are drawn). */
const picturesLoaded = (pg, selector = 'img') => pg.waitForFunction(s => Array.from(document.querySelectorAll(s)).every(i => i.complete && i.naturalWidth > 0), selector, { timeout: 20000 }).catch(() => { });

/**
 * The shots of the platform (plan 3): Projekte with folders, the Teilen dialog, a team (Mitglieder), the public view, the comments with a pin and the bell. Four people are made by the
 * administrator (page) and removed again at the end; what they made goes with them. Returns nothing; the files are written to `out`.
 */
async function platformShots(browser, page) {
  const snap = async (pg, file) => {
    await pg.waitForTimeout(500);
    await pg.screenshot({ path: path.join(out, file) });
    written.push(file);
    console.log('wrote ' + file);
  };
  const people = {
    mia: { name: 'Mia Hofmann', email: 'mia.hofmann@example.com' },
    jonas: { name: 'Jonas Weber', email: 'jonas.weber@example.com' },
    lea: { name: 'Lea Schneider', email: 'lea.schneider@example.com' },
    tim: { name: 'Tim Brandt', email: 'tim.brandt@example.com' },
  };
  for (const p of Object.values(people)) {
    await page.goto(base + '/Admin/Users/Edit');
    await page.fill('#Input_DisplayName', p.name);
    await page.fill('#Input_Email', p.email);
    await page.selectOption('#Input_Role', { label: 'Mitglied' });
    await page.fill('#Input_Password', PASSWORD);
    await Promise.all([page.waitForNavigation(), page.click('button[type=submit].mat-btn--primary')]);
    p.password = PASSWORD;
  }

  const contexts = [];
  const signIn = async (p, viewport) => {
    const ctx = await newContext(browser, { viewport: viewport || { width: 1440, height: 900 }, colorScheme: 'light', deviceScaleFactor: 1 });
    contexts.push(ctx);
    const pg = await ctx.newPage();
    watch(pg, p.email);
    if (!await login(pg, p)) { throw new Error('Sign-in of ' + p.email + ' failed.'); }
    return pg;
  };
  const mia = await signIn(people.mia);
  const jonas = await signIn(people.jonas);
  const lea = await signIn(people.lea);
  const tim = await signIn(people.tim);
  const must = (res, what) => { if (res.status !== 200) { throw new Error(`${what} failed: ${res.status} ${JSON.stringify(res.body)}`); } return res.body; };
  const userId = async (pg, p) => (await pg.evaluate(async q => (await fetch('/api/share/search?q=' + encodeURIComponent(q))).json(), p.email)).find(r => r.type === 'user' && r.email === p.email).id;
  // a person does not find themselves in the search: Mia finds the others, Jonas finds Mia
  for (const p of [people.jonas, people.lea, people.tim]) { p.id = await userId(mia, p); }
  people.mia.id = await userId(jonas, people.mia);

  // the team, its people and its roles
  const team = must(await postJson(mia, '/api/spaces', { name: 'Team Marketing', description: 'Plakate, Flyer und Beiträge für Hof und Wochenmarkt.', color: '#1fb3d6' }), 'team');
  for (const [p, role] of [[people.jonas, 'Editor'], [people.lea, 'Admin'], [people.tim, 'Viewer']]) {
    must(await postJson(mia, `/api/spaces/${team.id}/members`, { userId: p.id, role }), 'member ' + p.name);
  }

  // folders and designs of Mia (copies of the templates with names of a farm shop), each with a picture of its own
  const templates = await mia.evaluate(async () => (await (await fetch('/api/templates')).json()));
  const template = prefix => { const t = templates.find(x => x.name.indexOf(prefix) === 0); if (!t) { throw new Error('No template ' + prefix); } return t.id; };
  const folder = async (name, color) => must(await postJson(mia, '/api/folders', { name, color }), 'folder ' + name).id;
  const folders = { hofladen: await folder('Hofladen Sommer', '#f2a65a'), markt: await folder('Wochenmarkt', '#7cb518'), herbst: await folder('Herbstkampagne', '#e5634d') };
  const made = [];
  const design = async (templatePrefix, name, folderId) => {
    const copy = must(await postJson(mia, `/api/designs/${template(templatePrefix)}/use-template`, folderId ? { folderId } : {}), 'copy ' + name);
    must(await postJson(mia, `/api/designs/${copy.id}/rename`, { name }), 'rename ' + name);
    made.push(copy.id);
    return copy.id;
  };
  const poster = await design('Poster A3', 'Hoffest-Plakat', folders.hofladen);
  await design('Flyer A5', 'Wochenangebot Flyer', folders.hofladen);
  await design('Instagram-Beitrag', 'Sommeraktion Instagram', folders.hofladen);
  await design('Glasetikett', 'Honig-Etikett', folders.hofladen);
  await design('Obst', 'Preisschilder Obst und Gemüse', folders.markt);
  await design('Regaletikett', 'Regaletikett Hofladen', folders.markt);
  await design('Grußkarte', 'Herbstgruß an Stammkunden', folders.herbst);
  await design('Instagram-Story', 'Erntedank Story', folders.herbst);
  const cheese = await design('Käsetheke', 'Käsetheke – Preisschild');
  await design('Flyer A5', 'Flyer Herbstmarkt');
  await design('Poster A3', 'Plakat Wochenmarkt');
  await design('Instagram-Beitrag', 'Angebot der Woche');
  await design('Glasetikett', 'Marmeladen-Etikett');
  // the picture of a design is made by the editor after a save: open each one and let it make the picture
  for (const id of made) {
    await openDesigner(mia, base, id);
    await mia.evaluate(() => window.DtDesigner.save.thumbnail());
  }

  // 1. Projekte: the folders with their pictures, loose designs
  await mia.goto(base + '/Projekte', { waitUntil: 'networkidle' });
  await mia.waitForSelector('.dt-bitem[data-kind=folder]');
  await picturesLoaded(mia, '.dt-bitem img');
  await snap(mia, 'projects.png');

  // 2. Teilen: a design of the folder shared with a person, with the team and by a link for signed-in people
  must(await postJson(mia, `/api/share/design/${poster}`, { userId: people.jonas.id, permission: 'Edit', message: 'Schau bitte mal über die Texte.' }), 'share with Jonas');
  must(await postJson(mia, `/api/share/design/${poster}`, { teamId: team.id, permission: 'View' }), 'share with the team');
  must(await postJson(mia, `/api/share/design/${poster}/link`, { audience: 'SignedIn', permission: 'View' }), 'link');
  await mia.goto(`${base}/Projekte/Ordner/${folders.hofladen}`, { waitUntil: 'networkidle' });
  await mia.evaluate(id => { window.DtShare.open({ kind: 'design', id, name: 'Hoffest-Plakat' }); }, poster);   // resolves when the dialog closes: not awaited
  await mia.waitForSelector('dialog.dt-share[open]');
  await mia.waitForFunction(() => { const d = document.querySelector('dialog.dt-share[open]'); return !!d && /Jonas Weber/.test(d.textContent) && /Team Marketing/.test(d.textContent); }, null, { timeout: 15000 });
  // the address of the link is the one of this test stack: the picture shows an address like the one of a real installation
  await mia.evaluate(() => { const i = document.querySelector('dialog.dt-share[open] input[readonly]'); if (i) { i.value = i.value.replace(new RegExp('^https?://[^/]+'), 'https://design.wiesengrund.example'); } });
  await snap(mia, 'share.png');
  await mia.keyboard.press('Escape');
  await mia.waitForSelector('dialog.dt-share', { state: 'detached' }).catch(() => { });

  // 3. The team: its members and their roles
  await mia.goto(`${base}/Teams/${team.slug}/Mitglieder`, { waitUntil: 'networkidle' });
  await snap(mia, 'team-members.png');

  // 4. The public view of a design (no sign-in): the demo label with a public link that allows downloads
  const link = must(await postJson(mia, `/api/share/design/${cheese}/link`, { audience: 'Public', permission: 'View', allowDownload: true }), 'public link');
  const anonymous = await newContext(browser, { viewport: { width: 1440, height: 900 }, colorScheme: 'light', deviceScaleFactor: 1 });
  contexts.push(anonymous);
  const visitor = await anonymous.newPage();
  watch(visitor, 'visitor');
  await visitor.goto(`${base}/s/${link.token}`);
  await visitor.waitForSelector('#dt-pv[data-state="ready"]', { timeout: 30000 });
  await picturesLoaded(visitor, '.dt-pv__thumbs img');
  await snap(visitor, 'public-view.png');

  // 5. Comments: a pin on the date, an answer, a comment on the page
  const info = await mia.evaluate(async id => { const d = await (await fetch('/api/designs/' + id)).json(); return { page: d.document.pages[0].id }; }, poster);
  const thread = must(await postJson(mia, `/api/designs/${poster}/comments`, { text: '@Jonas Weber, kannst du das Datum noch etwas größer machen?', pageId: info.page, elementId: 'e24', x: 228, y: 264, mentions: [people.jonas.id] }), 'comment');
  must(await postJson(jonas, `/api/designs/${poster}/comments`, { text: 'Klar, mache ich heute Nachmittag.', parentId: thread.id }), 'reply');
  must(await postJson(lea, `/api/designs/${poster}/comments`, { text: 'Die Farben passen gut zu unserem Herbstflyer. @Mia Hofmann, hast du die Adresse geprüft?', pageId: info.page, elementId: 'e33', x: 100, y: 396, mentions: [people.mia.id] }), 'comment of Lea');
  await openDesigner(mia, base, poster);
  await openPanel(mia, 'comments');
  await mia.waitForFunction(() => window.DtDesigner.comments.state().loaded);
  await mia.waitForFunction(() => document.querySelectorAll('.dt-cm-thread').length >= 2);
  await mia.locator('.dt-cm-thread', { hasText: 'Datum' }).first().locator('.dt-cm-text').first().click();
  await idle(mia);
  await snap(mia, 'comments.png');

  // 6. The bell: a share with a message, an answer, a mention and a request for access with its two buttons
  const jonasDesign = must(await postJson(jonas, '/api/designs', { preset: 'a4-portrait', name: 'Plakat Herbstmarkt' }), 'design of Jonas');
  must(await postJson(jonas, `/api/share/design/${jonasDesign.id}`, { userId: people.mia.id, permission: 'Edit', message: 'Hier ist mein Entwurf fürs Plakat. Magst du drüberschauen?' }), 'share of Jonas');
  must(await postJson(tim, '/api/access-requests', { kind: 'design', id: poster, permission: 'edit', message: 'Darf ich die Texte ändern?' }), 'request of Tim');
  await mia.goto(base + '/Projekte', { waitUntil: 'networkidle' });
  await mia.waitForFunction(() => { const b = document.querySelector('[data-notify-badge]'); return !!b && !b.hidden && parseInt(b.textContent, 10) > 0; }, null, { timeout: 15000 });
  await mia.click('[data-notify-toggle]');
  await mia.waitForSelector('[data-notify-list] li', { timeout: 15000 });
  await mia.waitForFunction(() => document.querySelectorAll('[data-notify-list] li').length >= 4, null, { timeout: 15000 });
  await snap(mia, 'notifications.png');
  await mia.keyboard.press('Escape');

  // clean up: the team goes (its owner types the name), then the accounts with what they made (the administrator hands nothing over)
  must(await postJson(mia, `/api/spaces/${team.id}/delete`, { name: 'Team Marketing' }), 'delete team');
  for (const c of contexts) { await c.close(); }
  for (const p of Object.values(people)) {
    await page.goto(`${base}/Admin/Users?q=${encodeURIComponent(p.email)}`, { waitUntil: 'networkidle' });
    const row = page.locator('#user-table a[href^="/Admin/Users/Edit"]').first();
    if ((await row.count()) === 0) { continue; }
    await row.click();
    await page.waitForURL(/\/Admin\/Users\/Edit/);
    await page.click('button[data-dialog-open="dt-delete-user"]');
    await page.waitForSelector('dialog#dt-delete-user[open]');
    await page.waitForTimeout(250);
    await page.click('#dt-delete-user label.mat-check:has-text("Nicht übertragen")');
    await Promise.all([page.waitForNavigation(), page.click('#dt-delete-user button[type=submit]')]);
  }
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await launch();
  const admin = await ensureAdmin(browser);

  const desktop = await newContext(browser, { viewport: { width: 1440, height: 900 }, colorScheme: 'light', deviceScaleFactor: 1 });
  const page = await desktop.newPage();
  watch(page, 'screens');
  if (!await login(page, admin)) { throw new Error('Sign-in failed.'); }

  if (platformOnly) {
    await platformShots(browser, page);
    await browser.close();
    console.log(`\n${written.length} screenshots in ${out}`);
    if (problems.length) { console.log('problems:\n' + problems.join('\n')); process.exit(1); }
    return;
  }

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

  // 9. The platform: Projekte with folders, Teilen, a team, the public view, comments and the bell (made with four people who are removed again).
  await platformShots(browser, page);

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
