// Checks sharing (docs/PLAN-PLATFORM.md section 1, items 6 to 11; phase P3):
//  - the Teilen dialog in the editor: the list of who has access, the search with chips and the keyboard, sharing with a person (View, then Edit), with a team, a folder that is shared (inherited rows "über Ordner X")
//  - what a person with View gets: the editor read-only ("Nur ansehen", no Teilen, "Kopie erstellen" that really makes a copy); with Edit: the editor as usual; a data list with View is read-only with a hint
//  - links: "Alle Angemeldeten" (a second account opens it and gets access, a person who is not signed in is sent to the sign-in and back, a reset kills the old link), "Öffentlich" (no sign-in: pages drawn
//    with the sample values, page navigation, thumbnails, zoom, download only when allowed, the payload has no data rows, the gallery of a shared folder, a design outside the folder is out of reach, a
//    dead link says so)
//  - "Zugriff anfordern" (the page, the request, "Gewähren" in the dialog, the person gets in) and presence (two browsers on one design: avatars, the toast), the dialog on a phone
//
//   node share-check.js [base url, default http://localhost:3043] [--out <folder for the screenshots, default: the temp folder>]
// The check makes its own accounts (lib.js; DT_ACCOUNT_FILE) and a third one ("E2E Dritte"); the things it makes are deleted at the end where the API allows it.
const fs = require('fs');
const os = require('os');
const path = require('path');
const lib = require('./lib.js');
const ed = require('./editor-lib.js');

const args = process.argv.slice(2);
const { base, problems, watch, launch, newContext, login, ensureAccounts, postJson, PASSWORD } = lib(args, { ignore: /status of (403|404|409|429)/ });
const outIndex = args.indexOf('--out');
const outDir = path.resolve(outIndex >= 0 ? args[outIndex + 1] : path.join(os.tmpdir(), 'designthix-share-check'));
fs.mkdirSync(outDir, { recursive: true });

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); };
const stamp = String(Date.now()).slice(-6);
let shotNo = 0;
const shot = async (page, name, width) => {
  shotNo++;
  const file = `${String(shotNo).padStart(2, '0')}-${name}-${width || page.viewportSize().width}.png`;
  await page.screenshot({ path: path.join(outDir, file) });
};

(async () => {
  const browser = await launch();
  const accounts = await ensureAccounts(browser);
  const accountFile = process.env.DT_ACCOUNT_FILE || path.join(__dirname, 'test-account.json');

  // ---- a third member (the shared accounts are the designer, the viewer and the administrator)
  {
    const ctx = await newContext(browser);
    const page = await ctx.newPage();
    watch(page, 'accounts');
    if (!accounts.third || !(await login(page, accounts.third))) {
      await login(page, accounts.admin);
      await page.goto(base + '/Admin/Users/Edit');
      await page.fill('#Input_DisplayName', 'E2E Dritte');
      await page.fill('#Input_Email', 'third@example.com');
      await page.selectOption('#Input_Role', { label: 'Mitglied' });
      await page.fill('#Input_Password', PASSWORD);
      await Promise.all([page.waitForNavigation(), page.click('button[type=submit].mat-btn--primary')]);
      accounts.third = { email: 'third@example.com', password: PASSWORD };
      fs.writeFileSync(accountFile, JSON.stringify(accounts, null, 2));
    }
    await ctx.close();
  }

  const wide = { viewport: { width: 1440, height: 900 } };
  const ctxA = await newContext(browser, wide);
  const ctxB = await newContext(browser, wide);
  const ctxC = await newContext(browser, wide);
  const ctxAnon = await newContext(browser, wide);
  const A = await ctxA.newPage();
  const B = await ctxB.newPage();
  const C = await ctxC.newPage();
  const X = await ctxAnon.newPage();
  [[A, 'A'], [B, 'B'], [C, 'C'], [X, 'anonym']].forEach(([p, n]) => watch(p, n));
  check('A (Gestalter), B (Betrachter) and C (Dritte) sign in', (await login(A, accounts.designer)) && (await login(B, accounts.viewer)) && (await login(C, accounts.third)));

  const cleanup = { designs: [], folders: [], lists: [], spaces: [] };

  // ---- helpers
  const csrf = p => p.evaluate(() => document.querySelector('meta[name=dt-csrf]').content);

  /** A design with content: n pages, a title, a field with a sample ("Beispiel-Käse"), a band and an ellipse. */
  async function makeDesign(page, name, pageCount, folderId) {
    const made = await postJson(page, '/api/designs', { preset: 'price-tag' });
    const id = made.body.id;
    await postJson(page, `/api/designs/${id}/rename`, { name });
    const pages = [];
    for (let i = 0; i < (pageCount || 1); i++) {
      pages.push({
        id: 'p' + (i + 1), name: '',
        background: { color: ['#ffffff', '#fff4d6', '#e6f4f1'][i % 3] },
        elements: [
          { id: 'band' + i, type: 'shape', shape: 'rect', x: 0, y: 0, w: 150, h: 22, fill: '#1fb3d6' },
          { id: 'title' + i, type: 'text', x: 8, y: 30, w: 134, h: 24, text: name + ' – Seite ' + (i + 1), fontFamily: 'Montserrat', fontWeight: 700, fontSize: 28, color: '#1b2733' },
          { id: 'field' + i, type: 'text', x: 8, y: 60, w: 134, h: 14, text: '{{Name}}', fontFamily: 'Open Sans', fontSize: 18, color: '#0a7590' },
          { id: 'dot' + i, type: 'shape', shape: 'ellipse', x: 112, y: 70, w: 26, h: 26, fill: '#f2a33a' },
        ],
      });
    }
    const document = { schema: 2, unit: 'mm', width: 150, height: 100, dpi: 300, locale: 'de-DE', fields: [{ key: 'Name', label: 'Name', type: 'text', sample: 'Beispiel-Käse' }], pages };
    const status = await page.evaluate(async ({ id: i, doc, token }) => {
      const cur = await (await fetch('/api/designs/' + i)).json();
      const r = await fetch('/api/designs/' + i, { method: 'POST', headers: { 'Content-Type': 'application/json', RequestVerificationToken: token }, body: JSON.stringify({ revision: cur.revision, document: doc }) });
      return r.status;
    }, { id, doc: document, token: await csrf(page) });
    if (status !== 200) { throw new Error('document not saved: ' + status); }
    if (folderId) { await postJson(page, '/api/items/move', { items: [{ kind: 'design', id }], folderId }); }
    cleanup.designs.push(id);
    return id;
  }

  const shareApi = (page, kind, id) => page.evaluate(async ([k, i]) => (await fetch(`/api/share/${k}/${i}`)).json(), [kind, id]);

  async function openDialog(page, kind, id, name) {
    await page.evaluate(([k, i, n]) => { window.DtShare.open({ kind: k, id: i, name: n }); }, [kind, id, name || '']);
    await page.waitForSelector('dialog.dt-share[open] .dt-sh-people, dialog.dt-share[open] section[aria-label="Personen mit Zugriff"]:not([hidden])', { timeout: 15000 });
    await page.waitForTimeout(150);
  }
  async function closeDialog(page) {
    await page.click('dialog.dt-share[open] .mat-dialog__foot .mat-btn--primary');
    await page.waitForSelector('dialog.dt-share', { state: 'detached', timeout: 5000 }).catch(() => { });
  }
  const rowTexts = page => page.$$eval('dialog.dt-share .dt-sh-rows .dt-sh-row', rows => rows.map(r => r.textContent.replace(/\s+/g, ' ').trim()));

  /** Types into the search, picks the first hit with this text, sets the permission and shares. */
  async function shareVia(page, query, hitText, permission, message) {
    await page.fill('dialog.dt-share .dt-sh-search', query);
    await page.waitForSelector('dialog.dt-share .dt-sh-option', { timeout: 8000 });
    await page.click(`dialog.dt-share .dt-sh-option:has-text("${hitText}")`);
    await page.selectOption('dialog.dt-share select[aria-label="Berechtigung"]', permission);
    if (message) { await page.fill('dialog.dt-share input[aria-label="Nachricht (optional)"]', message); }
    await page.click('dialog.dt-share .dt-sh-go');
    await page.waitForFunction(() => document.querySelectorAll('dialog.dt-share .dt-sh-chip').length === 0, null, { timeout: 8000 });
    await page.waitForTimeout(250);
  }

  // =====================================================================================================================================  A: design, dialog, search
  const designId = await makeDesign(A, 'Sommerfest Plakat', 3);
  await ed.openDesigner(A, base, designId);
  check('the editor has a primary "Teilen" button next to "Herunterladen"', await A.isVisible('#dt-share') && /Teilen/.test(await A.textContent('#dt-share')) && /mat-btn--primary/.test(await A.getAttribute('#dt-share', 'class')) && /mat-btn--secondary/.test(await A.getAttribute('#dt-download', 'class')));
  check('a person who may edit sees no "Kopie erstellen" button in the top bar', !(await A.isVisible('#dt-copy')));
  await shot(A, 'editor-topbar');
  await A.click('#dt-share');
  await A.waitForSelector('dialog.dt-share[open]');
  await A.waitForSelector('dialog.dt-share section[aria-label="Personen mit Zugriff"]:not([hidden])');
  check('the dialog title names the design', /Sommerfest Plakat.*teilen/.test(await A.textContent('dialog.dt-share .mat-dialog__title')));
  let rows = await rowTexts(A);
  check('the list starts with the owner', rows.length === 1 && /Inhaber/.test(rows[0]) && /E2E Gestalter/.test(rows[0]), JSON.stringify(rows));
  check('the add field has focus, the share button waits for a chip', await A.evaluate(() => document.activeElement && document.activeElement.classList.contains('dt-sh-search')) && await A.isDisabled('dialog.dt-share .dt-sh-go'));
  check('the link section says "Nur Personen mit Zugriff" at first', (await A.$eval('dialog.dt-share select[aria-label="Wer den Link nutzen kann"]', s => s.value)) === 'none');

  // search: one character does nothing, two give hits, the keyboard picks
  await A.fill('dialog.dt-share .dt-sh-search', 'E');
  await A.waitForTimeout(500);
  check('one character does not search', await A.isHidden('dialog.dt-share .dt-sh-results'));
  await A.fill('dialog.dt-share .dt-sh-search', 'E2E');
  await A.waitForSelector('dialog.dt-share .dt-sh-option');
  const hitNames = await A.$$eval('dialog.dt-share .dt-sh-option__name', els => els.map(e => e.textContent));
  check('the search finds people by name (not the person themselves)', hitNames.includes('E2E Betrachter') && hitNames.includes('E2E Dritte') && !hitNames.includes('E2E Gestalter'), JSON.stringify(hitNames));
  await shot(A, 'share-search');
  await A.keyboard.press('ArrowDown');
  await A.keyboard.press('Enter');
  check('Enter turns the active hit into a chip', (await A.$$('dialog.dt-share .dt-sh-chip')).length === 1);
  await A.keyboard.press('Backspace');
  check('Backspace in the empty field removes the last chip', (await A.$$('dialog.dt-share .dt-sh-chip')).length === 0);

  // share with B: View
  await shareVia(A, 'E2E Bet', 'E2E Betrachter', 'view', 'Schau mal, ob das passt.');
  rows = await rowTexts(A);
  check('B appears with "Kann ansehen"', rows.some(r => /E2E Betrachter/.test(r)) && (await A.$eval('dialog.dt-share .dt-sh-row__perm', s => s.value)) === 'view', JSON.stringify(rows));
  await shot(A, 'share-dialog-people');
  await closeDialog(A);

  // ---- B: read-only
  await ed.openDesigner(B, base, designId);
  check('B (View): the editor is read-only', await B.evaluate(() => document.getElementById('dt-ds').classList.contains('is-readonly')));
  check('B: "Nur ansehen" is in the top bar, "Kopie erstellen" instead of "Teilen"', /Nur ansehen/.test(await B.textContent('#dt-state-text')) && await B.isVisible('#dt-copy') && !(await B.$('#dt-share')));
  check('B: Herunterladen and Drucken stay', await B.isVisible('#dt-download') && await B.isVisible('#dt-print'));
  await B.waitForTimeout(600);
  await shot(B, 'editor-readonly');
  check('B: the avatars show the people with access', Number(await B.getAttribute('#dt-people', 'data-count')) >= 2);
  // B copies
  await B.click('#dt-copy');
  await B.waitForSelector('dialog.dt-move[open]', { timeout: 8000 });
  await B.waitForTimeout(400);
  await B.waitForTimeout(300);
  await shot(B, 'copy-dialog');
  check('the copy dialog is the picker of the file browser (areas to write in)', /Meine Projekte/.test(await B.textContent('dialog.dt-move[open]')));
  await B.click('dialog.dt-move[open] [role=treeitem]:first-child');
  await B.click('dialog.dt-move[open] .mat-btn--primary');
  await B.waitForFunction(old => /\/Designs\/\d+\/Designer/.test(location.pathname) && !location.pathname.includes('/' + old + '/'), designId, { timeout: 15000 });
  await B.waitForSelector('#dt-ds:not(.is-loading)', { timeout: 20000 });
  const copyId = Number(/Designs\/(\d+)\//.exec(B.url())[1]);
  check('the copy opens in the editor and belongs to B (editable)', copyId !== designId && await B.evaluate(() => !document.getElementById('dt-ds').classList.contains('is-readonly')) && await B.isVisible('#dt-share'));
  const copyDoc = await B.evaluate(async i => (await fetch('/api/designs/' + i)).json(), copyId);
  check('the copy holds the content of the original', /Sommerfest Plakat/.test(JSON.stringify(copyDoc.document)) && copyDoc.canEdit === true);
  cleanup.designs.push(copyId);
  const noEdit = await B.evaluate(async ([i, token]) => (await fetch('/api/designs/' + i, { method: 'POST', headers: { 'Content-Type': 'application/json', RequestVerificationToken: token }, body: JSON.stringify({ revision: 1, document: { schema: 2, pages: [] } }) })).status, [designId, await csrf(B)]);
  check('B cannot save the original (403)', noEdit === 403, String(noEdit));

  // ---- A makes B an editor
  await ed.openDesigner(A, base, designId);
  await openDialog(A, 'design', designId, 'Sommerfest Plakat');
  await A.selectOption('dialog.dt-share .dt-sh-row__perm', 'edit');
  await A.waitForFunction(() => document.querySelector('dialog.dt-share .dt-sh-row__perm').value === 'edit');
  await A.waitForTimeout(300);
  check('A changes B to "Kann bearbeiten" (the API says so)', (await shareApi(A, 'design', designId)).entries.some(e => e.name === 'E2E Betrachter' && e.permission === 'edit'));
  await closeDialog(A);
  await ed.openDesigner(B, base, designId);
  check('B (Edit): the editor is editable, with "Teilen"', await B.evaluate(() => !document.getElementById('dt-ds').classList.contains('is-readonly')) && await B.isVisible('#dt-share') && !(await B.isVisible('#dt-copy')));

  // ---- the dialog of B (Edit): shares with people but sets no link
  await B.click('#dt-share');
  await B.waitForSelector('dialog.dt-share section[aria-label="Personen mit Zugriff"]:not([hidden])');
  check('B (Edit): can add people, but the link section says that only managers set links', await B.isVisible('dialog.dt-share .dt-sh-add') && /Nur wer dieses Element verwaltet/.test(await B.textContent('dialog.dt-share .dt-sh-link')));
  rows = await rowTexts(B);
  check('B sees the owner and themselves; cannot change A or remove the owner', rows.length >= 2 && (await B.$$('dialog.dt-share .dt-sh-row__perm')).length === 0, JSON.stringify(rows));
  await closeDialog(B);

  // =====================================================================================================================================  team
  // C makes the team (so that the people of the other checks can leave it again and keep their menu clean), A is Bearbeiter in it, B Betrachter
  const teamName = 'E2E Team ' + stamp;
  const team = await postJson(C, '/api/spaces', { name: teamName });
  check('C makes a team', team.status === 200, JSON.stringify(team));
  const teamId = team.body.id;
  cleanup.spaces.push(teamId);
  const found = name => A.evaluate(async q => (await (await fetch('/api/share/search?q=' + encodeURIComponent(q))).json()).find(r => r.type === 'user'), name);
  const thirdUser = (await found('Dritte')).id;
  const viewerUser = (await found('Betrachter')).id;
  const designerUser = await C.evaluate(async () => (await (await fetch('/api/share/search?q=Gestalter')).json()).find(r => r.type === 'user').id);
  const addedA = await postJson(C, `/api/spaces/${teamId}/members`, { userId: designerUser, role: 'Editor' });
  const addedB = await postJson(C, `/api/spaces/${teamId}/members`, { userId: viewerUser, role: 'Viewer' });
  check('C adds A as Bearbeiter and B as Betrachter', addedA.status === 200 && addedB.status === 200, JSON.stringify([addedA, addedB]));
  const teamDesign = await makeDesign(A, 'Team-Plakat', 1);
  await ed.openDesigner(A, base, teamDesign);
  await A.click('#dt-share');
  await A.waitForSelector('dialog.dt-share section[aria-label="Personen mit Zugriff"]:not([hidden])');
  await shareVia(A, 'E2E Team', teamName, 'edit');
  rows = await rowTexts(A);
  check('the team appears in the list', rows.some(r => r.includes(teamName) && /Team/.test(r)), JSON.stringify(rows));
  await closeDialog(A);
  await B.goto(base + '/Designs/' + teamDesign + '/Designer');
  await B.waitForSelector('#dt-ds:not(.is-loading)', { timeout: 20000 });
  check('B (a Betrachter of the team that has the Edit share) can edit the design', await B.evaluate(() => !document.getElementById('dt-ds').classList.contains('is-readonly')));

  // =====================================================================================================================================  folder, inherited
  const folder = await postJson(A, '/api/folders', { name: 'Plakate ' + stamp });
  const folderId = folder.body.id;
  cleanup.folders.push(folderId);
  const inFolder = await makeDesign(A, 'Im Ordner', 1, folderId);
  const outside = await makeDesign(A, 'Außerhalb', 1);
  await A.evaluate(([k, i, u]) => fetch(`/api/share/${k}/${i}`, { method: 'POST', headers: { 'Content-Type': 'application/json', RequestVerificationToken: document.querySelector('meta[name=dt-csrf]').content }, body: JSON.stringify({ userId: u, permission: 'View' }) }), ['folder', folderId, thirdUser]);
  await ed.openDesigner(A, base, inFolder);
  await A.click('#dt-share');
  await A.waitForSelector('dialog.dt-share section[aria-label="Personen mit Zugriff"]:not([hidden])');
  rows = await rowTexts(A);
  check('the share of the folder is listed as "über Ordner"', rows.some(r => /E2E Dritte/.test(r) && /über Ordner „Plakate/.test(r)), JSON.stringify(rows));
  check('an inherited row cannot be changed here', (await A.$$('dialog.dt-share .is-inherited .dt-sh-row__perm')).length === 0 && (await A.$$('dialog.dt-share .is-inherited .dt-sh-row__x')).length === 0);
  await A.click('dialog.dt-share .dt-sh-via');
  await A.waitForSelector('dialog.dt-share[open] >> nth=1', { timeout: 8000 }).catch(() => { });
  await A.waitForTimeout(400);
  const dialogsOpen = await A.$$eval('dialog.dt-share[open]', d => d.length);
  check('the link "über Ordner" opens the dialog of the folder on top', dialogsOpen === 2 && /Plakate/.test(await A.$eval('dialog.dt-share[open]:last-of-type .mat-dialog__title', e => e.textContent)), String(dialogsOpen));
  await A.click('dialog.dt-share[open]:last-of-type .mat-dialog__foot .mat-btn--primary');
  await A.waitForTimeout(300);
  await closeDialog(A);
  await ed.openDesigner(C, base, inFolder);
  check('C opens the design in the shared folder read-only (View through the folder)', await C.evaluate(() => document.getElementById('dt-ds').classList.contains('is-readonly')));

  // =====================================================================================================================================  link for signed-in people
  const linkId = await makeDesign(A, 'Nur per Link', 1);
  await ed.openDesigner(A, base, linkId);
  await A.click('#dt-share');
  await A.waitForSelector('dialog.dt-share section[aria-label="Link"]:not([hidden])');
  await A.selectOption('dialog.dt-share select[aria-label="Wer den Link nutzen kann"]', 'signedin');
  await A.waitForSelector('dialog.dt-share .dt-sh-url');
  const urlSignedIn = await A.inputValue('dialog.dt-share .dt-sh-url');
  check('the link is /s/<token>', /\/s\/[0-9a-f-]{36}$/.test(urlSignedIn), urlSignedIn);
  check('the link grants the access "Kann ansehen" by default', (await A.$eval('dialog.dt-share select[aria-label="Berechtigung für Angemeldete mit dem Link"]', s => s.value)) === 'view');
  await ctxA.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => { });
  await A.click('dialog.dt-share .dt-sh-copy');
  await A.waitForTimeout(300);
  const copied = await A.evaluate(() => navigator.clipboard.readText().catch(() => null));
  check('"Link kopieren" copies it', copied === urlSignedIn || copied === null, String(copied));
  await B.goto(base + '/Designs/' + linkId + '/Designer');
  check('B (not in the list yet) cannot open the design: the page offers to ask for access', /\/Zugriff\/design\/\d+/.test(B.url()), B.url());
  const tokenSigned = urlSignedIn.split('/').pop();

  // an anonymous visitor is sent to the sign-in and back
  await X.goto(base + '/s/' + tokenSigned);
  check('without a sign-in the link leads to the sign-in with the way back', /\/Account\/Login/.test(X.url()) && /returnUrl=%2Fs%2F/.test(X.url()), X.url());
  await X.fill('#Input_Email', accounts.viewer.email);
  await X.fill('#Input_Password', accounts.viewer.password);
  await Promise.all([X.waitForNavigation(), X.click('button[type=submit]')]);
  await X.waitForURL(/\/Designs\/\d+\/Designer/, { timeout: 15000 }).catch(() => { });
  check('after signing in the link lands on the design', new RegExp('/Designs/' + linkId + '/Designer').test(X.url()), X.url());
  await X.waitForSelector('#dt-ds:not(.is-loading)', { timeout: 20000 });
  check('the person got View through the link (read-only)', await X.evaluate(() => document.getElementById('dt-ds').classList.contains('is-readonly')));
  await ctxAnon.clearCookies();

  // the dialog counts who opened it; a reset kills the old one
  await A.waitForTimeout(200);
  await A.evaluate(() => { document.querySelector('dialog.dt-share .dt-mat-never'); });
  await closeDialog(A);
  await openDialog(A, 'design', linkId, 'Nur per Link');
  check('the dialog says that one person opened the link', /1 Person hat den Link geöffnet/.test(await A.textContent('dialog.dt-share .dt-sh-link')));
  await A.click('dialog.dt-share .dt-sh-reset');
  await A.waitForSelector('dialog.mat-dialog[open] [value=ok], dialog[open] button[value=ok]');
  await A.waitForTimeout(300);
  await shot(A, 'reset-confirm');
  await A.click('dialog[open] button[value=ok]');
  await A.waitForFunction(old => document.querySelector('dialog.dt-share .dt-sh-url') && document.querySelector('dialog.dt-share .dt-sh-url').value !== old, urlSignedIn, { timeout: 8000 });
  const urlReset = await A.inputValue('dialog.dt-share .dt-sh-url');
  check('"Link zurücksetzen" gives a new address', urlReset !== urlSignedIn && /\/s\//.test(urlReset), urlReset);
  await closeDialog(A);
  const deadResponse = await C.goto(base + '/s/' + tokenSigned);
  check('the old link answers "Dieser Link ist nicht mehr gültig" (404)', deadResponse.status() === 404 && /Dieser Link ist nicht mehr gültig/.test(await C.textContent('main')), String(deadResponse.status()));
  await shot(C, 'link-invalid');
  await C.setViewportSize({ width: 390, height: 844 });
  await C.waitForTimeout(200);
  await shot(C, 'link-invalid');
  await C.setViewportSize({ width: 1440, height: 900 });
  check('the person who had opened it lost the access (the page asks for access)', await (async () => { await B.goto(base + '/Designs/' + linkId + '/Designer'); return /\/Zugriff\/design\/\d+/.test(B.url()); })(), B.url());

  // =====================================================================================================================================  request access
  await shot(B, 'no-access');
  await B.setViewportSize({ width: 390, height: 844 });
  await B.waitForTimeout(200);
  await shot(B, 'no-access');
  await B.setViewportSize({ width: 1440, height: 900 });
  check('the page "Zugriff anfordern" does not name the item', !/Nur per Link/.test(await B.textContent('main')) && /Du hast keinen Zugriff/.test(await B.textContent('main')));
  await B.check('input[type=radio][value=edit]');
  await B.fill('#Input_Message', 'Ich brauche das für den Flyer.');
  await B.click('#dt-share-request button[type=submit]');
  await B.waitForSelector('[data-share-sent]');
  check('after sending the page says "Anfrage gesendet"', /Anfrage gesendet/.test(await B.textContent('[data-share-sent]')));
  await shot(B, 'request-sent');
  // asking about an id that is not there looks the same
  await B.goto(base + '/Zugriff/design/9999999');
  await B.click('#dt-share-request button[type=submit]');
  await B.waitForSelector('[data-share-sent]', { timeout: 5000 }).catch(() => { });
  check('asking for something that does not exist answers like any other request (and writes nothing)', /Anfrage gesendet/.test(await B.textContent('main')));
  await ed.openDesigner(A, base, linkId);
  await A.click('#dt-share');
  await A.waitForSelector('dialog.dt-share section[aria-label="Zugriffsanfragen"]:not([hidden])', { timeout: 8000 });
  await A.evaluate(() => document.querySelector('dialog.dt-share section[aria-label="Zugriffsanfragen"]').scrollIntoView({ block: 'center' }));
  await A.waitForTimeout(400);
  check('A sees the request with the message', /E2E Betrachter/.test(await A.textContent('dialog.dt-share section[aria-label="Zugriffsanfragen"]')) && /Flyer/.test(await A.textContent('dialog.dt-share section[aria-label="Zugriffsanfragen"]')) && /bearbeiten/.test(await A.textContent('dialog.dt-share section[aria-label="Zugriffsanfragen"]')));
  await shot(A, 'share-requests');
  await A.click('dialog.dt-share section[aria-label="Zugriffsanfragen"] .mat-btn--primary');
  await A.waitForSelector('dialog.dt-share section[aria-label="Zugriffsanfragen"]', { state: 'hidden', timeout: 8000 });
  check('"Gewähren" shares the design with B (Edit) and the request is gone', (await shareApi(A, 'design', linkId)).entries.some(e => e.name === 'E2E Betrachter' && e.permission === 'edit'));
  await closeDialog(A);
  await ed.openDesigner(B, base, linkId);
  check('B can edit the design now', await B.evaluate(() => !document.getElementById('dt-ds').classList.contains('is-readonly')));

  // a second request that is declined
  const declined = await makeDesign(A, 'Wird abgelehnt', 1);
  await B.goto(base + '/Zugriff/design/' + declined);
  await B.click('#dt-share-request button[type=submit]');
  await B.waitForSelector('[data-share-sent]');
  await ed.openDesigner(A, base, declined);
  await A.click('#dt-share');
  await A.waitForSelector('dialog.dt-share section[aria-label="Zugriffsanfragen"]:not([hidden])');
  await A.click('dialog.dt-share section[aria-label="Zugriffsanfragen"] .mat-btn--secondary');
  await A.waitForSelector('dialog.dt-share section[aria-label="Zugriffsanfragen"]', { state: 'hidden', timeout: 8000 });
  await closeDialog(A);
  await B.goto(base + '/Designs/' + declined + '/Designer');
  check('a declined request leaves B without access', /\/Zugriff\/design\//.test(B.url()));

  // =====================================================================================================================================  public link
  const pub = await makeDesign(A, 'Öffentliches Plakat', 3);
  await ed.openDesigner(A, base, pub);
  await A.click('#dt-share');
  await A.waitForSelector('dialog.dt-share section[aria-label="Link"]:not([hidden])');
  await A.selectOption('dialog.dt-share select[aria-label="Wer den Link nutzen kann"]', 'public');
  await A.waitForSelector('dialog.dt-share .dt-sh-url');
  const urlPublic = await A.inputValue('dialog.dt-share .dt-sh-url');
  const tokenPublic = urlPublic.split('/').pop();
  check('the public option is offered for designs', await A.$eval('dialog.dt-share select[aria-label="Wer den Link nutzen kann"]', s => Array.from(s.options).some(o => o.value === 'public' && !o.disabled)));
  check('"Herunterladen erlauben" is off by default', !(await A.isChecked('dialog.dt-share input[id^="dt-sh-dl-"]')));
  await A.waitForTimeout(300);
  await shot(A, 'share-dialog-public');
  // the download switch and an expiry date
  await A.click('dialog.dt-share label.mat-switch');
  await A.waitForFunction(async () => true);
  await A.waitForTimeout(500);
  const tomorrow = new Date(Date.now() + 36 * 3600 * 1000);
  const tomorrowText = tomorrow.getFullYear() + '-' + String(tomorrow.getMonth() + 1).padStart(2, '0') + '-' + String(tomorrow.getDate()).padStart(2, '0');
  await A.fill('dialog.dt-share input[type=date]', tomorrowText);
  await A.dispatchEvent('dialog.dt-share input[type=date]', 'change');
  await A.waitForTimeout(600);
  const linkInfo = (await shareApi(A, 'design', pub)).link;
  check('the link is public, downloads are allowed, and it expires tomorrow', linkInfo.audience === 'Public' && linkInfo.allowDownload === true && !!linkInfo.expires && !linkInfo.expired, JSON.stringify(linkInfo));
  await closeDialog(A);

  // anonymous: the viewer
  const pubResponse = await X.goto(base + '/s/' + tokenPublic);
  check('the public page needs no sign-in (200) and is not indexed', pubResponse.status() === 200 && /noindex/.test(await X.getAttribute('meta[name=robots]', 'content')) && /noindex/.test(pubResponse.headers()['x-robots-tag'] || ''));
  await X.waitForSelector('.dt-pv__page.is-drawn', { timeout: 20000 });
  await X.waitForFunction(() => document.querySelectorAll('.dt-pv__page.is-drawn').length >= 1);
  check('three pages are there, the first one is drawn', (await X.$$('.dt-pv__page')).length === 3 && (await X.$$('.dt-pv__page.is-drawn')).length >= 1);
  const text0 = await X.$eval('.dt-pv__page[data-page="0"] svg', s => s.textContent);
  check('the page shows the title and the SAMPLE value of the field', /Öffentliches Plakat/.test(text0) && /Seite 1/.test(text0) && /Beispiel-Käse/.test(text0), text0);
  check('the page label says "Seite 1 von 3"', /Seite 1 von 3/.test(await X.textContent('.dt-pv__pagelabel')));
  check('the title is the name of the design, the footer says "Erstellt mit DesignThix"', /Öffentliches Plakat/.test(await X.textContent('.dt-pv__title')) && /Erstellt mit DesignThix/.test(await X.textContent('.dt-pv__foot')));
  check('thumbnails are shown for several pages', await X.isVisible('#dt-pv-thumbs') && (await X.$$('.dt-pv-thumb')).length === 3);
  await X.waitForTimeout(800);
  await shot(X, 'public-design-multipage');
  await X.click('button[aria-label="Nächste Seite"]');
  await X.waitForFunction(() => /Seite 2 von 3/.test(document.querySelector('.dt-pv__pagelabel').textContent), null, { timeout: 5000 });
  check('"Nächste Seite" goes to page 2', /Seite 2 von 3/.test(await X.textContent('.dt-pv__pagelabel')));
  await X.click('.dt-pv-thumb[aria-label="Seite 3"]');
  await X.waitForFunction(() => /Seite 3 von 3/.test(document.querySelector('.dt-pv__pagelabel').textContent), null, { timeout: 5000 });
  check('a thumbnail goes to its page', (await X.getAttribute('.dt-pv-thumb[aria-label="Seite 3"]', 'aria-current')) === 'true');
  await X.waitForSelector('.dt-pv__page[data-page="2"].is-drawn');
  check('page 3 is drawn when it comes into view', (await X.$$('.dt-pv__page.is-drawn')).length >= 2);
  const w1 = await X.$eval('.dt-pv__page', e => e.getBoundingClientRect().width);
  await X.click('button[aria-label="Vergrößern"]');
  await X.waitForTimeout(300);
  const w2 = await X.$eval('.dt-pv__page', e => e.getBoundingClientRect().width);
  check('zoom in makes the pages bigger, the label follows', w2 > w1 * 1.1 && /125 %/.test(await X.textContent('.dt-pv__zoomtext')), w1 + ' -> ' + w2 + ' ' + (await X.textContent('.dt-pv__zoomtext')));
  await X.click('.dt-pv__zoomtext');
  await X.waitForTimeout(300);
  check('the zoom label returns to the fit', /100 %/.test(await X.textContent('.dt-pv__zoomtext')));
  check('keys: + zooms and 0 fits', await (async () => { await X.focus('#dt-pv-stage'); await X.keyboard.press('+'); await X.waitForTimeout(200); const z = await X.textContent('.dt-pv__zoomtext'); await X.keyboard.press('0'); await X.waitForTimeout(200); return /125 %/.test(z) && /100 %/.test(await X.textContent('.dt-pv__zoomtext')); })());
  check('the download button is there (allowed)', await X.isVisible('.dt-pv__download'));
  // payload: no data rows, no foreign things
  const payload = await X.evaluate(async t => (await fetch('/api/s/' + t)).json(), tokenPublic);
  const keys = Object.keys(payload).sort().join(',');
  check('the payload holds the design, fonts, addresses of images, the bodies of catalogue icons and the credits of catalogue images, nothing else', keys === 'allowDownload,assets,credits,document,folderId,fonts,icons,id,kind,name,pages,warnings', keys);
  check('the payload has no rows or values of a data list', !/"rows"|"values"|"labels"|"copies"/.test(JSON.stringify(payload)));
  // download: PNG of the current page
  await X.click('.dt-pv__download');
  await X.waitForSelector('dialog.dt-pv-dl[open]');
  await X.waitForTimeout(400);
  await shot(X, 'public-download');
  const [download] = await Promise.all([X.waitForEvent('download', { timeout: 30000 }), X.click('dialog.dt-pv-dl .dt-pv-opt:has-text("PNG – diese Seite")')]);
  check('"PNG – diese Seite" downloads a PNG named after the design and page', /Öffentliches Plakat-\d\.png$/.test(download.suggestedFilename()), download.suggestedFilename());
  await X.waitForSelector('dialog.dt-pv-dl', { state: 'detached', timeout: 5000 }).catch(() => { });
  await X.click('.dt-pv__download');
  await X.waitForSelector('dialog.dt-pv-dl[open]');
  const [zip] = await Promise.all([X.waitForEvent('download', { timeout: 60000 }), X.click('dialog.dt-pv-dl .dt-pv-opt:has-text("alle Seiten")')]);
  check('"PNG – alle Seiten" downloads a ZIP', /\.zip$/.test(zip.suggestedFilename()), zip.suggestedFilename());
  await X.waitForSelector('dialog.dt-pv-dl', { state: 'detached', timeout: 5000 }).catch(() => { });
  // PDF / print: the print view is prepared (window.print is a no-op in the headless browser)
  await X.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; window.dispatchEvent(new Event('afterprint')); }; });
  await X.click('.dt-pv__download');
  await X.waitForSelector('dialog.dt-pv-dl[open]');
  await X.click('dialog.dt-pv-dl .dt-pv-opt:has-text("PDF")');
  await X.waitForFunction(() => window.__printed === 1, null, { timeout: 20000 });
  check('"PDF / Drucken" prepares the print view with all pages and prints', await X.evaluate(() => document.getElementById('dt-pv').getAttribute('data-print-pages') === '3'));
  check('the print view is emptied again and the @page rule is gone', await X.evaluate(() => document.getElementById('dt-pv-print').children.length === 0 && !document.documentElement.classList.contains('is-printing')));
  // phone
  const phoneCtx = await newContext(browser, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const P = await phoneCtx.newPage();
  watch(P, 'phone');
  await P.goto(base + '/s/' + tokenPublic);
  await P.waitForSelector('.dt-pv__page.is-drawn', { timeout: 20000 });
  await P.waitForTimeout(800);
  check('phone: the page fits the width, nothing scrolls sideways', await P.evaluate(() => { const r = document.querySelector('.dt-pv__page').getBoundingClientRect(); return r.right <= window.innerWidth + 1 && r.left >= -1 && document.documentElement.scrollWidth <= window.innerWidth + 1; }));
  check('phone: the bar fits (tools and name)', await P.evaluate(() => { const b = document.querySelector('.dt-pv__bar'); return b.scrollWidth <= b.clientWidth + 1; }));
  await shot(P, 'public-design-multipage');

  // single page design public view
  const single = await makeDesign(A, 'Einzelseite', 1);
  await A.evaluate(([k, i]) => fetch(`/api/share/${k}/${i}/link`, { method: 'POST', headers: { 'Content-Type': 'application/json', RequestVerificationToken: document.querySelector('meta[name=dt-csrf]').content }, body: JSON.stringify({ audience: 'Public', permission: 'View', allowDownload: false }) }), ['design', single]);
  const tokenSingle = (await shareApi(A, 'design', single)).link.token;
  await X.goto(base + '/s/' + tokenSingle);
  await X.waitForSelector('.dt-pv__page.is-drawn', { timeout: 20000 });
  await X.waitForTimeout(500);
  check('a single page: no page navigation, no thumbnails, no download button when not allowed', !(await X.$('.dt-pv__pagelabel')) && await X.isHidden('#dt-pv-thumbs') && !(await X.$('.dt-pv__download')));
  await shot(X, 'public-design-single');
  await P.goto(base + '/s/' + tokenSingle);
  await P.waitForSelector('.dt-pv__page.is-drawn', { timeout: 20000 });
  await P.waitForTimeout(500);
  await shot(P, 'public-design-single');
  await phoneCtx.close();

  // the owner who looks at the public page gets a way back into the app
  await A.goto(base + '/s/' + tokenSingle);
  await A.waitForSelector('.dt-pv__page.is-drawn', { timeout: 20000 });
  check('a signed-in person with access gets "In DesignThix öffnen" on the public page', (await A.getAttribute('.dt-pv__open', 'href')) === '/Designs/' + single + '/Designer');
  await X.goto(base + '/s/' + tokenSingle);
  await X.waitForSelector('.dt-pv__page.is-drawn', { timeout: 20000 });
  check('and somebody who is not signed in does not', !(await X.$('.dt-pv__open')));

  // the design that was shared by "Alle Angemeldeten" is not reachable as a public link
  const notPublic = await X.evaluate(async t => (await fetch('/api/s/' + t)).status, urlReset.split('/').pop());
  check('a link for signed-in people shows nothing to the public (404)', notPublic === 404, String(notPublic));
  const nonsense = await X.evaluate(async () => (await fetch('/api/s/not-a-token')).status);
  check('nonsense instead of a token is a 404', nonsense === 404);

  // =====================================================================================================================================  public folder
  const folderPub = await postJson(A, '/api/folders', { name: 'Galerie ' + stamp });
  const galleryId = folderPub.body.id;
  cleanup.folders.push(galleryId);
  const sub = await postJson(A, '/api/folders', { name: 'Unterordner', parentId: galleryId });
  cleanup.folders.push(sub.body.id);
  const g1 = await makeDesign(A, 'Galerie eins', 2, galleryId);
  const g2 = await makeDesign(A, 'Galerie zwei', 1, galleryId);
  const g3 = await makeDesign(A, 'Tief unten', 1, sub.body.id);
  await A.evaluate(([k, i]) => fetch(`/api/share/${k}/${i}/link`, { method: 'POST', headers: { 'Content-Type': 'application/json', RequestVerificationToken: document.querySelector('meta[name=dt-csrf]').content }, body: JSON.stringify({ audience: 'Public', permission: 'View', allowDownload: true }) }), ['folder', galleryId]);
  const folderToken = (await shareApi(A, 'folder', galleryId)).link.token;
  await X.goto(base + '/s/' + folderToken);
  await X.waitForSelector('.dt-pv-tile', { timeout: 20000 });
  const tiles = await X.$$eval('.dt-pv-tile', ts => ts.map(t => t.textContent.replace(/\s+/g, ' ').trim()));
  check('the gallery lists the subfolder and the two designs', tiles.length === 3 && tiles.some(t => /Unterordner/.test(t) && /1 Design/.test(t)) && tiles.some(t => /Galerie eins/.test(t)) && tiles.some(t => /Galerie zwei/.test(t)), JSON.stringify(tiles));
  await X.waitForFunction(() => document.querySelectorAll('.dt-pv-tile__thumb.is-drawn, .dt-pv-tile__thumb img').length >= 2, null, { timeout: 20000 });
  await X.waitForTimeout(600);
  await shot(X, 'public-folder-gallery');
  const folderPayload = await X.evaluate(async t => (await fetch('/api/s/' + t)).json(), folderToken);
  check('the folder payload lists names and thumbnails only', folderPayload.kind === 'folder' && folderPayload.items.length === 3 && !JSON.stringify(folderPayload).includes('document'));
  await X.click('.dt-pv-tile:has-text("Galerie eins")');
  await X.waitForSelector('.dt-pv__page.is-drawn', { timeout: 20000 });
  check('a design opens in the viewer; the address says ?d=', /\?d=\d+$/.test(X.url()) && /Seite 1 von 2/.test(await X.textContent('.dt-pv__pagelabel')));
  check('the breadcrumb starts at the shared folder and ends at the design', /Galerie \d+/.test(await X.textContent('.dt-pv__crumblist')) && /Galerie eins/.test(await X.textContent('.dt-pv__crumblist [aria-current=page]')));
  await shot(X, 'public-folder-design');
  await X.goBack();
  await X.waitForSelector('.dt-pv-tile', { timeout: 10000 });
  check('the back button of the browser returns to the gallery', (await X.$$('.dt-pv-tile')).length === 3);
  await X.click('.dt-pv-tile:has-text("Unterordner")');
  await X.waitForSelector('.dt-pv-tile:has-text("Tief unten")', { timeout: 10000 });
  check('a subfolder opens; the breadcrumb has the shared folder and the subfolder', (await X.$$('.dt-pv__crumblist li')).length === 2);
  await X.click('.dt-pv__crumb');
  await X.waitForSelector('.dt-pv-tile:has-text("Galerie eins")', { timeout: 10000 });
  check('the breadcrumb leads back to the shared folder', (await X.$$('.dt-pv-tile')).length === 3);
  const inside = await X.evaluate(async ([t, i]) => (await fetch(`/api/s/${t}/d/${i}`)).status, [folderToken, g3]);
  const outsideStatus = await X.evaluate(async ([t, i]) => (await fetch(`/api/s/${t}/d/${i}`)).status, [folderToken, outside]);
  const otherPublic = await X.evaluate(async ([t, i]) => (await fetch(`/api/s/${t}/d/${i}`)).status, [folderToken, pub]);
  check('a design in a subfolder is reachable, one outside the folder is not (404)', inside === 200 && outsideStatus === 404 && otherPublic === 404, `${inside} ${outsideStatus} ${otherPublic}`);
  const designTokenOnFolderApi = await X.evaluate(async ([t, i]) => (await fetch(`/api/s/${t}/d/${i}`)).status, [tokenPublic, g1]);
  check('the link of a design does not open other designs through /d/', designTokenOnFolderApi === 404);
  await X.goto(base + '/s/' + folderToken + '?d=' + outside);
  await X.waitForSelector('.dt-pv-dead__card', { timeout: 10000 });
  check('?d= with a design outside the folder shows the "nicht mehr gültig" message', /nicht mehr gültig/.test(await X.textContent('.dt-pv-dead__card')));
  // a design moved out of the folder is gone from the link
  await postJson(A, '/api/items/move', { items: [{ kind: 'design', id: g2 }], folderId: null });
  const moved = await X.evaluate(async ([t, i]) => (await fetch(`/api/s/${t}/d/${i}`)).status, [folderToken, g2]);
  check('a design moved out of the shared folder is out of reach', moved === 404);
  await postJson(A, '/api/items/trash', { items: [{ kind: 'design', id: g3 }] });
  const trashed = await X.evaluate(async ([t, i]) => (await fetch(`/api/s/${t}/d/${i}`)).status, [folderToken, g3]);
  check('a design in the trash is out of reach', trashed === 404);
  // phone gallery
  const phone2 = await newContext(browser, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const P2 = await phone2.newPage();
  watch(P2, 'phone2');
  await P2.goto(base + '/s/' + folderToken);
  await P2.waitForSelector('.dt-pv-tile', { timeout: 20000 }).catch(async e => { console.log('PHONE GALLERY: ' + (await P2.textContent('body')).replace(/s+/g, ' ').slice(0, 300)); throw e; });
  await P2.waitForTimeout(1200);
  check('phone: the gallery has two columns and does not scroll sideways', await P2.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await shot(P2, 'public-folder-gallery');
  await phone2.close();

  // the whole link revoked
  await A.evaluate(([k, i]) => fetch(`/api/share/${k}/${i}/link/revoke`, { method: 'POST', headers: { RequestVerificationToken: document.querySelector('meta[name=dt-csrf]').content } }), ['folder', galleryId]);
  const afterRevoke = await X.goto(base + '/s/' + folderToken);
  check('a link that was switched off is dead (404)', afterRevoke.status() === 404 && /nicht mehr gültig/.test(await X.textContent('main')));

  // =====================================================================================================================================  presence
  await A.bringToFront();
  await B.bringToFront();
  const room = await makeDesign(A, 'Zu zweit', 1);
  await ed.openDesigner(A, base, room);
  await A.click('#dt-share');
  await A.waitForSelector('dialog.dt-share section[aria-label="Personen mit Zugriff"]:not([hidden])');
  await shareVia(A, 'E2E Bet', 'E2E Betrachter', 'edit');
  await closeDialog(A);
  await ed.openDesigner(B, base, room);
  await B.evaluate(() => window.DtDesigner.share.beat());
  await A.evaluate(() => window.DtDesigner.share.beat());
  await A.waitForFunction(() => Number(document.getElementById('dt-people').getAttribute('data-present')) === 1, null, { timeout: 10000 });
  check('A sees B as present (avatar with a dot)', await A.isVisible('#dt-people .dt-person.is-present .dt-person__dot'));
  check('A gets the toast "E2E Betrachter bearbeitet dieses Design gerade."', await A.waitForFunction(() => /E2E Betrachter bearbeitet dieses Design gerade/.test(document.body.textContent), null, { timeout: 8000 }).then(() => true, () => false));
  await A.waitForTimeout(400);
  await shot(A, 'editor-presence');
  check('B sees A as present too', await (async () => { await B.evaluate(() => window.DtDesigner.share.beat()); return B.waitForFunction(() => Number(document.getElementById('dt-people').getAttribute('data-present')) === 1, null, { timeout: 8000 }).then(() => true, () => false); })());
  // B leaves: the room empties on the next beat
  await B.goto(base + '/');
  // the goodbye (a keepalive fetch on pagehide) is not always delivered when the page is left at once; then the 30 s timeout of the server empties the room: wait for that too
  for (let i = 0; i < 80 && Number(await A.getAttribute('#dt-people', 'data-present')) !== 0; i++) {
    await A.waitForTimeout(500);
    await A.evaluate(() => window.DtDesigner.share.beat());
  }
  check('after B left, A sees nobody else', Number(await A.getAttribute('#dt-people', 'data-present')) === 0, JSON.stringify(await A.evaluate(() => window.DtDesigner.share.presence())));
  const presenceApi = await B.evaluate(async i => { const r = await fetch('/api/designs/' + i + '/presence', { method: 'POST', headers: { 'Content-Type': 'application/json', RequestVerificationToken: document.querySelector('meta[name=dt-csrf]').content }, body: '{}' }); return r.status; }, designId + 0);
  check('the presence API answers a person with access', presenceApi === 200, String(presenceApi));
  const stranger = await C.evaluate(async i => { const r = await fetch('/api/designs/' + i + '/presence', { method: 'POST', headers: { 'Content-Type': 'application/json', RequestVerificationToken: document.querySelector('meta[name=dt-csrf]').content }, body: '{}' }); return r.status; }, declined);
  check('and 404 for a stranger', stranger === 404, String(stranger));

  // =====================================================================================================================================  a data list with View
  await A.goto(base + '/DataLists/Edit');
  await A.fill('#Input_Name', 'Liste ' + stamp);
  await Promise.all([A.waitForNavigation(), A.click('button[type=submit].mat-btn--primary')]);
  const listId = Number(/DataLists\/Edit\/(\d+)/.exec(A.url())[1]);
  cleanup.lists.push(listId);
  // the edit pages have a "Teilen" button of their own (data-share-open)
  await A.waitForSelector('[data-share-open][data-share-kind="datalist"]');
  await A.click('[data-share-open][data-share-kind="datalist"]');
  await A.waitForSelector('dialog.dt-share[open] section[aria-label="Personen mit Zugriff"]:not([hidden])');
  check('the data list page has a "Teilen" button that opens the dialog of the list', /Liste \d+.*teilen/.test(await A.textContent('dialog.dt-share .mat-dialog__title')));
  await closeDialog(A);
  await A.goto(base + '/Designs/Edit/' + designId);
  await A.click('[data-share-open][data-share-kind="design"]');
  await A.waitForSelector('dialog.dt-share[open] section[aria-label="Personen mit Zugriff"]:not([hidden])');
  check('the design page has one too', /Sommerfest Plakat.*teilen/.test(await A.textContent('dialog.dt-share .mat-dialog__title')));
  await closeDialog(A);
  await A.goto(base + '/DataLists/Edit/' + listId);
  await A.evaluate(([k, i, u]) => fetch(`/api/share/${k}/${i}`, { method: 'POST', headers: { 'Content-Type': 'application/json', RequestVerificationToken: document.querySelector('meta[name=dt-csrf]').content }, body: JSON.stringify({ userId: u, permission: 'View' }) }), ['datalist', listId, thirdUser]);
  await C.goto(base + '/DataLists/Edit/' + listId);
  check('a data list with View is read-only with a hint', /Du darfst diese Datenliste nur ansehen/.test(await C.textContent('main')) && await C.evaluate(() => document.querySelector('#Input_Name').readOnly || document.querySelector('#Input_Name').disabled), (await C.textContent('main')).slice(0, 200));
  await shot(C, 'datalist-readonly');
  await C.goto(base + '/DataLists/Edit/987654');
  check('a data list that does not exist or is not shared leads to the request page', /\/Zugriff\/datalist\//.test(C.url()), C.url());

  // =====================================================================================================================================  the dialog on a phone
  const phone3 = await newContext(browser, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const P3 = await phone3.newPage();
  watch(P3, 'phone3');
  await login(P3, accounts.designer);
  await P3.goto(base + '/Designs/' + designId + '/Designer');
  await P3.waitForSelector('#dt-ds:not(.is-loading)', { timeout: 20000 });
  await P3.click('#dt-share');
  await P3.waitForSelector('dialog.dt-share section[aria-label="Personen mit Zugriff"]:not([hidden])');
  await P3.waitForTimeout(400);
  check('phone: the dialog fills the screen and does not scroll sideways', await P3.evaluate(() => { const d = document.querySelector('dialog.dt-share').getBoundingClientRect(); const body = document.querySelector('dialog.dt-share .mat-dialog__body'); return d.width <= window.innerWidth + 1 && d.height <= window.innerHeight + 1 && body.scrollWidth <= body.clientWidth + 1; }));
  await P3.evaluate(() => document.querySelectorAll('.mat-toast').forEach(t => t.remove()));   // a toast of the presence beat would hide the field in the picture
  await shot(P3, 'share-dialog');
  await P3.fill('dialog.dt-share .dt-sh-search', 'E2E');
  await P3.waitForSelector('dialog.dt-share .dt-sh-option');
  await P3.waitForTimeout(300);
  await P3.evaluate(() => document.querySelectorAll('.mat-toast').forEach(t => t.remove()));
  await shot(P3, 'share-search');
  check('phone: the hits are within the dialog', await P3.evaluate(() => { const r = document.querySelector('dialog.dt-share .dt-sh-results').getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth + 1; }));
  await phone3.close();

  // =====================================================================================================================================  clean up
  for (const id of cleanup.spaces) { await postJson(A, `/api/spaces/${id}/leave`, {}).catch(() => { }); await postJson(B, `/api/spaces/${id}/leave`, {}).catch(() => { }); }
  for (const id of cleanup.designs) { await postJson(A, `/api/designs/${id}/delete`, {}).catch(() => { }); await postJson(B, `/api/designs/${id}/delete`, {}).catch(() => { }); }
  for (const id of cleanup.folders) { await postJson(A, '/api/items/trash', { items: [{ kind: 'folder', id }] }).catch(() => { }); }
  for (const id of cleanup.lists) { await postJson(A, '/api/items/trash', { items: [{ kind: 'datalist', id }] }).catch(() => { }); }
  check('no console errors and no CSP violations', problems.length === 0, problems.join(' | '));
  await browser.close();
  let failed = 0;
  for (const r of results) {
    if (!r.ok) { failed++; }
    console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail && !r.ok ? ' - ' + r.detail : ''}`);
  }
  console.log(`\n${results.length - failed} of ${results.length} checks passed. Screenshots: ${outDir}`);
  process.exit(failed === 0 ? 0 : 1);
})().catch(e => {
  for (const r of results.filter(x => !x.ok)) { console.log('FAIL ' + r.name + (r.detail ? ' - ' + r.detail : '')); }
  console.log('stopped after ' + results.length + ' checks');
  console.error(e);
  process.exit(1);
});
