// Checks the AI actions (phase G) in a real browser (installed Edge, headless) against a LOCAL FAKE OpenAI-compatible server that this script starts: it answers
// /v1/models and /v1/chat/completions with canned JSON that depends on the prompt (data import, data fill, text suggestion, test). Nothing leaves the machine.
//
//   cd tests/e2e && npm install
//   node ai-check.js [base url, default http://localhost:3043] [--fake-host <host the APP reaches this machine by>] [--fake-port 3066] [--out <folder for the screenshots>]
//
// The app runs in Docker by default and reaches the fake server at http://host.docker.internal:<port>/v1 (verified to work from the container). With the app started by
// `dotnet run` (port 3053, see CLAUDE.md) pass --fake-host 127.0.0.1. Accounts: see lib.js. What is checked: the AI profile and the settings through the admin pages (instruction
// layers, additions per action, privacy note), the import of three rows from text (the preview with a warning, "Vollständige Anweisung anzeigen", Übernehmen, the toast and
// the runs panel), the fill of a column (old -> new, a row that was not selected is ignored), undo of both (newest first), the personal-data refusal, the viewer (no buttons,
// 403), the text suggestions in the designer (a suggestion that drops a placeholder is dropped, picking one is an undoable change), the error messages (rejected key, no
// profile: a link for the administrator, a neutral hint for the designer), the admin run list and details, and screenshots at 1280 and 390 px. Zero console errors and zero
// CSP violations are part of the result.
const fs = require('fs');
const os = require('os');
const path = require('path');
const lib = require('./lib.js');
const { demoDocument } = require('./demo-label.js');

const args = process.argv.slice(2);
const argValue = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const { base, problems, watch, launch, newContext, login, ensureAccounts, postJson, shareWith } = lib(args, { ignoreUrl: /\/api\/ai\//, ignore: /status of (400|401|403|409|422)/ });
const outDir = path.resolve(argValue('--out', path.join(os.tmpdir(), 'matcan-ai-check')));
const fakePort = Number(argValue('--fake-port', '3066'));
const fakeHost = argValue('--fake-host', /localhost:3043|127\.0\.0\.1:3043/.test(base) ? 'host.docker.internal' : '127.0.0.1');

const results = [];
const livePages = [];
let current = '';
const check = (name, ok, detail) => { results.push({ name: current + name, ok: !!ok, detail }); };
const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');

const { fake, startFake } = require('./fake-ai.js');

// ------------------------------------------------------------------------------------------------ helpers

async function shot(page, name, options) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, name);
  await page.waitForTimeout(450);   // a dialog fades in
  await page.screenshot(Object.assign({ path: file }, options || {}));
  console.log('screenshot ' + file);
  return file;
}

const idOf = (url, pattern) => Number(url.match(pattern)[1]);

async function createDesign(page, name, document_) {
  await page.goto(base + '/Designs/Create');
  await page.fill('#Input_Name', name);
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit].mat-btn--primary')]);
  const id = idOf(page.url(), /Designs\/(\d+)\//);
  const posted = await page.evaluate(async ({ id: designId, doc }) => {
    const got = await (await fetch('/api/designs/' + designId)).json();
    const r = await fetch('/api/designs/' + designId, { method: 'POST', headers: { 'Content-Type': 'application/json', RequestVerificationToken: document.querySelector('meta[name=dt-csrf]').content }, body: JSON.stringify({ revision: got.revision, document: doc }) });
    return { status: r.status, body: await r.json() };
  }, { id, doc: document_ });
  if (posted.status !== 200) { throw new Error('The design was refused: ' + JSON.stringify(posted.body)); }
  return id;
}

/** A data list with the columns of a design (the form "Spalten aus Design übernehmen"); personal: the switch "Enthält personenbezogene Daten". */
async function createList(page, name, designId, personal) {
  await page.goto(base + '/DataLists/Edit');
  await page.fill('#Input_Name', name);
  if (personal) { await page.click('label.mat-switch:has(input[name="Input.ContainsPersonalData"])'); }
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit].mat-btn--primary')]);
  const id = idOf(page.url(), /DataLists\/Edit\/(\d+)/);
  await page.goto(`${base}/DataLists/Edit/${id}?tab=columns`);
  await page.selectOption('form[action*="FromDesign"] select', String(designId));
  await Promise.all([page.waitForNavigation(), page.click('form[action*="FromDesign"] button[type=submit]')]);
  return id;
}

const gridReady = page => page.waitForSelector('[data-dt-grid][data-ready="true"]', { state: 'attached', timeout: 15000 });
const rowsOf = (page, listId) => page.evaluate(async id => (await (await fetch('/api/datalists/' + id + '/rows')).json()).rows, listId);
const dialog = page => page.locator('dialog.dt-ai[open]').last();
const toastText = async page => (await page.locator('.mat-toast').allTextContents()).join(' | ');

async function openImportTab(page, listId, extra) {
  await page.goto(`${base}/DataLists/Edit/${listId}?tab=import${extra || ''}`);
  await page.waitForSelector('[data-ai-import]');
}

const IMPORT_TEXT = 'Lieferschein Käse Herbst\nGouda jung, 2,50 € pro 100 g, aus den Niederlanden\nBrie de Meaux, 3,90 €, Frankreich\nAtlantis Blauschimmel, 5 €, Atlantis';

// ------------------------------------------------------------------------------------------------ the check

(async () => {
  await startFake(fakePort);
  console.log(`fake OpenAI server on :${fakePort}, the app reaches it at http://${fakeHost}:${fakePort}/v1`);
  const browser = await launch();
  const accounts = await ensureAccounts(browser);

  const adminContext = await newContext(browser);
  const admin = await adminContext.newPage();
  watch(admin, 'admin'); livePages.push(admin);
  if (!await login(admin, accounts.admin)) { throw new Error('Anmeldung des Administrators fehlgeschlagen.'); }

  // ---------------------------------------------------------------------------------------- 1. a profile through the admin pages, settings, privacy note
  current = 'profile: ';
  const profileName = 'Fake KI ' + stamp;
  await admin.goto(base + '/Admin/Ai/Profiles/Edit');
  await admin.fill('#Input_Name', profileName);
  await admin.selectOption('#Input_Preset', 'custom');
  await admin.fill('#Input_BaseUrl', `http://${fakeHost}:${fakePort}/v1`);
  await admin.fill('#Input_ApiKey', 'sk-fake-' + stamp);
  await admin.fill('#Input_Model', 'fake-model');
  await Promise.all([admin.waitForNavigation(), admin.click('button[type=submit].mat-btn--primary')]);
  await admin.goto(base + '/Admin/Ai/Profiles');
  const item = admin.locator('.mat-item', { hasText: profileName });
  check('the profile is in the list', await item.count() === 1);
  if (await item.locator('button:has-text("Aktivieren")').count()) { await Promise.all([admin.waitForNavigation(), item.locator('button:has-text("Aktivieren")').click()]); await admin.goto(base + '/Admin/Ai/Profiles'); }
  check('the profile is active', await admin.locator('.mat-item', { hasText: profileName }).locator('text=aktiv').count() > 0);
  check('the key is not on any page', !(await admin.content()).includes('sk-fake-'));
  await admin.goto(base + '/Admin/Ai');
  await admin.click('#ai-tabs-tab-instructions');
  const additionBox = admin.locator('textarea[name="Input.ActionInstructions[DataImport]"]');
  check('there is an addition per action in the settings', await additionBox.count() === 1 && await admin.locator('textarea[name="Input.ActionInstructions[DataFill]"]').count() === 1 && await admin.locator('textarea[name="Input.ActionInstructions[TextSuggest]"]').count() === 1);
  await additionBox.fill('Preise sind immer Preise pro 100 g.');
  await admin.click('#ai-tabs-tab-limits');
  await admin.fill('#Input_AddressDailyRuns', '1000');
  await admin.fill('#Input_PerMinutePerAddress', '100');   // the check makes many calls in a minute; the brake itself is checked at the end
  // the budgets of tokens are per person and day: the runs of the design assistant (ai-design-check.js) may have used them up, and this check does not test them
  await admin.fill('#Input_UserDailyTokens', '50000000');
  await admin.fill('#Input_UserMonthlyTokens', '500000000');
  await admin.fill('#Input_MonthlyTokens', '500000000');
  await Promise.all([admin.waitForNavigation(), admin.click('button[type=submit].mat-btn--primary')]);
  await admin.goto(base + '/Admin/Ai');
  await admin.click('#ai-tabs-tab-instructions');
  check('the addition is saved', (await additionBox.inputValue()) === 'Preise sind immer Preise pro 100 g.');
  const shownInstruction = await admin.locator('details.dt-details', { hasText: 'Daten übernehmen' }).locator('pre').textContent();
  check('the full instruction in the settings has the layers', /Grundanweisung/.test(shownInstruction) && /Ergänzung der Website für diese Aktion/.test(shownInstruction) && /Preise sind immer Preise pro 100 g/.test(shownInstruction) && /Format und Regeln \(fest\)/.test(shownInstruction));
  await admin.click('#ai-tabs-tab-privacy');
  const privacy = await admin.locator('#ai-tabs-panel-privacy').textContent();
  check('the privacy note: EU recommended, third country, China without adequacy decision', /Mistral/.test(privacy) && /Drittland/.test(privacy) && /China/.test(privacy) && /Angemessenheitsbeschluss/.test(privacy), privacy.slice(0, 120));
  await admin.click('#ai-tabs-tab-limits');
  check('limits per user per day and month, per address', await admin.locator('#Input_UserDailyTokens').count() === 1 && await admin.locator('#Input_UserMonthlyTokens').count() === 1 && await admin.locator('#Input_AddressDailyRuns').count() === 1);

  await admin.goto(base + '/Admin/Ai/Profiles');
  await Promise.all([admin.waitForNavigation(), admin.click('button:has-text("Aktives Profil testen")')]);
  await admin.waitForSelector('.mat-toast');
  check('the test action works through the fake server', /Hallo vom Fake-Server/.test(await toastText(admin)), await toastText(admin));


  // ---------------------------------------------------------------------------------------- 2. the designer account: design, list, import
  const context = await newContext(browser);
  const page = await context.newPage();
  watch(page, 'designer'); livePages.push(page);
  if (!await login(page, accounts.designer)) { throw new Error('Anmeldung des Gestalters fehlgeschlagen.'); }
  const designId = await createDesign(page, 'KI-Check ' + stamp, demoDocument());
  const listId = await createList(page, 'KI-Check Liste ' + stamp, designId, false);

  current = 'import: ';
  await openImportTab(page, listId);
  check('the section "Mit KI übernehmen" is there', await page.locator('[data-ai-import] .mat-card, [data-ai-import] section, [data-ai-import] .dt-card').count() >= 1 || await page.locator('[data-ai-import]').count() === 1);
  await page.fill('[data-ai-form] textarea', IMPORT_TEXT);
  await page.fill('[data-ai-form] input[type=text]', 'Land ist das Herkunftsland');
  await page.click('[data-ai-form] .dt-ai-prompt button');
  await page.waitForSelector('[data-ai-form] .dt-ai-prompt__text:not([hidden])');
  const prompt = await page.locator('[data-ai-form] .dt-ai-prompt__text').textContent();
  check('"Vollständige Anweisung anzeigen" shows the layers and the situation', /\[system\]/.test(prompt) && /Grundanweisung/.test(prompt) && /Ergänzung der Website für diese Aktion/.test(prompt) && /Preise sind immer Preise pro 100 g/.test(prompt) && /Land ist das Herkunftsland/.test(prompt) && /Format und Regeln \(fest\)/.test(prompt) && /<<<TEXT/.test(prompt) && /Atlantis Blauschimmel/.test(prompt), prompt.slice(0, 200));
  const landSection = prompt.split('## Erlaubte Medien für die Spalte Land')[1] ? prompt.split('## Erlaubte Medien für die Spalte Land')[1].split('## Erlaubte Medien')[0].split('## Text der Person')[0] : '';
  check('the prompt lists the allowed media of the category (flags only)', /flag-nl = Niederlande/.test(landSection) && !/icon-bio/.test(landSection) && landSection.split(String.fromCharCode(10)).filter(l => / = /.test(l)).length <= 300);
  check('the prompt has columns with their types', /Name \| Name \| Text/.test(prompt) && /Preis \| Preis \| Preis/.test(prompt) && /Land \| Herkunftsland \| Bild/.test(prompt));
  const requestsBefore = fake.requests.length;
  await page.click('[data-ai-form] button:has-text("Vorschlag erstellen")');
  await page.waitForSelector('dialog.dt-ai[open] .dt-ai-table', { timeout: 30000 });
  check('exactly one request went to the model', fake.requests.length === requestsBefore + 1);
  const sent = fake.requests[fake.requests.length - 1];
  check('the model got JSON mode and the generous limit', sent.response_format && sent.response_format.type === 'json_object' && (sent.max_tokens || sent.max_completion_tokens) === 16000, JSON.stringify({ rf: sent.response_format, mt: sent.max_tokens }));
  check('what went to the model is what the dialog showed', sent.messages[0].content + '\n\n[user]\n' + sent.messages[1].content === prompt.replace(/^\[system\]\n/, '').replace(/\n\n\[user\]\n[\s\S]*$/, '') + '\n\n[user]\n' + sent.messages[1].content && prompt.includes(sent.messages[0].content) && prompt.includes(sent.messages[1].content));
  let rows = await page.locator('dialog.dt-ai[open] .dt-ai-table tbody tr').count();
  check('the preview has three proposed rows', rows === 3, String(rows));
  check('the cell with an unknown medium is highlighted with a reason', await page.locator('dialog.dt-ai[open] .dt-ai-cell--warn').count() === 1 && /flag-atlantis/.test(await page.locator('dialog.dt-ai[open] .dt-ai-table__notes').last().textContent()));
  check('the note of the model is shown', /3 Zeilen aus dem Lieferschein/.test(await dialog(page).textContent()));
  check('the preview shows the flag thumbnails and the prices as the grid writes them', await page.locator('dialog.dt-ai[open] img.dt-ai-thumb').count() === 2 && /2,50/.test(await dialog(page).locator('tbody tr').first().textContent()));
  check('nothing was written before Übernehmen', (await rowsOf(page, listId)).length === 0);
  await shot(page, 'ai-import-preview-1280.png');
  // uncheck the third row: only two are taken
  await dialog(page).locator('tbody tr').nth(2).locator('input[type=checkbox]').uncheck();
  check('the button counts the chosen rows', /2 Zeilen/.test(await dialog(page).locator('button.mat-btn--primary').textContent()));
  await dialog(page).locator('button.mat-btn--primary').click();
  await page.waitForSelector('.mat-toast:has-text("übernommen")');
  check('a toast with Rückgängig comes right after applying', await page.locator('.mat-toast button:has-text("Rückgängig")').count() === 1, await toastText(page));
  let list = await rowsOf(page, listId);
  check('two rows were appended', list.length === 2 && list[0].values.Name === 'Gouda jung' && list[0].values.Preis === '2,50' && list[0].values.Land === 'flag-nl' && list[1].values.Name === 'Brie de Meaux', JSON.stringify(list.map(r => r.values)));
  await page.click('.mat-toast button:has-text("Rückgängig")');
  await page.waitForFunction(() => /Rückgängig gemacht/.test(document.body.textContent));
  check('the toast button takes the import back', (await rowsOf(page, listId)).length === 0);

  // again, this time all three rows; kept for the fill
  await openImportTab(page, listId);
  await page.fill('[data-ai-form] textarea', IMPORT_TEXT);
  await page.click('[data-ai-form] button:has-text("Vorschlag erstellen")');
  await page.waitForSelector('dialog.dt-ai[open] .dt-ai-table');
  await dialog(page).locator('button.mat-btn--primary').click();
  await page.waitForSelector('.mat-toast:has-text("übernommen")');
  list = await rowsOf(page, listId);
  check('three rows after the second import', list.length === 3 && list[2].values.Land === undefined || list[2].values.Land === '', JSON.stringify(list.map(r => r.values)));
  await page.waitForSelector('[data-ai-runs] .dt-note');
  const panel = await page.locator('[data-ai-runs]').textContent();
  check('the runs panel lists the runs with their status', /Daten übernehmen/.test(panel) && /Fertig/.test(panel) && /Änderung/.test(panel), panel.slice(0, 200));

  // ---------------------------------------------------------------------------------------- 3. the fill
  current = 'fill: ';
  await page.goto(`${base}/DataLists/Edit/${listId}?tab=rows`);
  await gridReady(page);
  check('the grid has the AI buttons', await page.locator('[data-act="ai-fill"]').count() === 1 && await page.locator('[data-act="ai-import"]').count() === 1);
  await page.click('[data-act="ai-fill"]');
  check('without a selection the grid asks for rows first', /Wähle zuerst Zeilen aus/.test(await toastText(page)) && await page.locator('dialog.dt-ai[open]').count() === 0);
  await page.click('.dt-grid__th--select input[type=checkbox]');
  await page.click('[data-act="ai-fill"]');
  await page.waitForSelector('dialog.dt-ai[open]');
  check('the dialog says how many rows are selected', /3 Zeilen sind ausgewählt/.test(await dialog(page).textContent()));
  await dialog(page).locator('select').selectOption('Region');
  const regionBox = dialog(page).locator('.dt-ai-context input[value="Region"]');
  check('the target column is not offered as context', await regionBox.isDisabled() && !(await regionBox.isChecked()));
  check('text columns are the default context, others are not', await dialog(page).locator('.dt-ai-context input[value="Name"]').isChecked() && !(await dialog(page).locator('.dt-ai-context input[value="Preis"]').isChecked()) && !(await dialog(page).locator('.dt-ai-context input[value="Land"]').isChecked()));
  await dialog(page).locator('.dt-ai-context input[value="Ort"]').uncheck();
  await dialog(page).locator('textarea').fill('Schreibe die Region passend zum Käse');
  await dialog(page).locator('.dt-ai-prompt button').click();
  await page.waitForSelector('dialog.dt-ai[open] .dt-ai-prompt__text:not([hidden])');
  const fillPrompt = await dialog(page).locator('.dt-ai-prompt__text').textContent();
  check('the fill instruction has the layers, the instruction of the person and only the chosen columns', /Schreibe die Region passend zum Käse/.test(fillPrompt) && /"werte":\{"Name":"Gouda jung"/.test(fillPrompt) && !/Preis"?:/.test(fillPrompt.split('## Zeilen')[1]) && /Zielspalte/.test(fillPrompt), fillPrompt.slice(-300));
  await dialog(page).locator('.dt-ai-prompt button').click();   // hide the instruction again for the picture
  await dialog(page).evaluate(d => { d.querySelector('.dt-ai__body').scrollTop = 0; });
  await shot(page, 'ai-fill-dialog-1280.png');
  await dialog(page).locator('button:has-text("Vorschlag erstellen")').click();
  await page.waitForSelector('dialog.dt-ai[open] .dt-ai-table', { timeout: 30000 });
  const previewDialog = dialog(page);
  check('the preview has old and new for three rows', await previewDialog.locator('tbody tr').count() === 3 && /Südholland/.test(await previewDialog.locator('tbody').textContent()) && /Île-de-France/.test(await previewDialog.locator('tbody').textContent()));
  check('the row that was not selected is named as ignored', /nicht ausgewählt/.test(await previewDialog.textContent()) && !/gehört nicht zur Auswahl/.test(await previewDialog.locator('tbody').textContent()));
  check('nothing was written before Übernehmen', (await rowsOf(page, listId)).every(r => !r.values.Region));
  await shot(page, 'ai-fill-preview-1280.png');
  await previewDialog.locator('button.mat-btn--primary').click();
  await page.waitForSelector('.mat-toast:has-text("übernommen")');
  await page.waitForFunction(() => document.querySelector('[data-dt-grid]').getAttribute('data-ready') === 'true');
  list = await rowsOf(page, listId);
  check('the values were written', list[0].values.Region === 'Südholland' && list[1].values.Region === 'Île-de-France' && list[2].values.Region === 'Unbekannt', JSON.stringify(list.map(r => r.values.Region)));
  check('the grid shows the new values', await page.locator('input[data-cell="Region"]').first().inputValue() === 'Südholland');

  // ---------------------------------------------------------------------------------------- 4. undo, newest first
  current = 'undo: ';
  await openImportTab(page, listId);
  await page.waitForSelector('[data-ai-runs] .dt-note');
  const noteCount = await page.locator('[data-ai-runs] .dt-note').count();
  check('the panel has the fill (newest) and the import', noteCount >= 2, String(noteCount));
  const importLine = page.locator('[data-ai-runs] .dt-note', { hasText: 'Daten übernehmen' }).filter({ hasText: 'Fertig' }).filter({ has: page.locator('button:has-text("Rückgängig")') }).first();
  await importLine.locator('button:has-text("Rückgängig")').click();
  await page.waitForSelector('.mat-toast:has-text("Erst Lauf"), .mat-toast:has-text("neuerer Lauf")');
  check('the import cannot be undone before the newer fill', /neuerer Lauf|Erst Lauf/.test(await toastText(page)) && (await rowsOf(page, listId)).length === 3, await toastText(page));
  const fillLine = page.locator('[data-ai-runs] .dt-note', { hasText: 'Spalte füllen' }).filter({ has: page.locator('button:has-text("Rückgängig")') }).first();
  await fillLine.locator('button:has-text("Rückgängig")').click();
  await page.waitForFunction(() => /Rückgängig gemacht/.test(document.body.textContent));
  check('the fill is undone: the old values are back', (await rowsOf(page, listId)).every(r => !r.values.Region));
  await page.waitForSelector('[data-ai-runs] .dt-note');
  await page.locator('[data-ai-runs] .dt-note', { hasText: 'Daten übernehmen' }).filter({ has: page.locator('button:has-text("Rückgängig")') }).first().locator('button:has-text("Rückgängig")').click();
  await page.waitForFunction(() => document.querySelectorAll('[data-ai-runs] .dt-note').length > 0 && !document.querySelector('[data-ai-runs] button[disabled]'));
  await page.waitForTimeout(400);
  check('the import is undone after it: the rows are gone', (await rowsOf(page, listId)).length === 0);

  // ---------------------------------------------------------------------------------------- 5. the admin run list and details
  current = 'runs: ';
  await admin.goto(base + '/Admin/Ai/Runs');
  const runsText = await admin.locator('main, .mat-content, body').first().textContent();
  check('the run list shows the actions and the data list as a link', /Daten übernehmen/.test(runsText) && /Spalte füllen/.test(runsText) && await admin.locator(`a[href^="/DataLists/Edit/${listId}"]`).count() >= 1);
  const detailHref = await admin.locator('a[href^="/Admin/Ai/Runs/Details"]', { hasText: 'Spalte füllen' }).first().getAttribute('href');
  await admin.goto(base + detailHref);
  const details = await admin.locator('body').textContent();
  check('the details show steps: action, message with the instruction, result, check, journal', /Aktion/.test(details) && /Nachricht/.test(details) && /Ergebnis/.test(details) && /Prüfung im Code/.test(details) && /Änderungen \(Journal\)/.test(details));
  await admin.locator('details.dt-details summary', { hasText: 'Vollständige Anweisung anzeigen' }).first().click();
  const fullMessage = await admin.locator('details.dt-details pre').first().textContent();
  check('the details have the exact instruction that was sent', /Format und Regeln \(fest\)/.test(fullMessage) && /Schreibe die Region passend zum Käse/.test(fullMessage));
  check('the details link to the subject and show tokens', await admin.locator(`.mat-kv a[href^="/DataLists/Edit/${listId}"]`).count() === 1 && /Tokens/.test(details));
  check('the undone journal is marked', /rückgängig/.test(details));
  await shot(admin, 'ai-run-details-1280.png', { fullPage: true });

  // ---------------------------------------------------------------------------------------- 6. personal data
  current = 'personal data: ';
  const personalId = await createList(page, 'KI-Check Personen ' + stamp, designId, true);
  await openImportTab(page, personalId);
  const reason = await page.locator('[data-ai-form]').textContent();
  check('a list with personal data shows the reason instead of the form', /personenbezogene Daten/.test(reason) && await page.locator('[data-ai-form] textarea').count() === 0, reason.slice(0, 160));
  const before = fake.requests.length;
  const refused = await postJson(page, `/api/ai/datalists/${personalId}/import`, { text: 'Max Mustermann, Musterstraße 1' });
  check('the endpoint refuses it too (422, refused) and the model is not called', refused.status === 422 && refused.body.code === 'refused' && /personenbezogene Daten/.test(refused.body.error) && fake.requests.length === before, JSON.stringify(refused));
  await page.goto(`${base}/DataLists/Edit/${personalId}?tab=rows`);
  await gridReady(page);
  await page.click('[data-act="ai-import"]');
  await page.waitForSelector('dialog.dt-ai[open]');
  check('the grid button shows the reason in its dialog', /personenbezogene Daten/.test(await dialog(page).textContent()));
  await page.keyboard.press('Escape');

  // ---------------------------------------------------------------------------------------- 7. the viewer
  current = 'viewer: ';
  const viewerContext = await newContext(browser);
  const viewer = await viewerContext.newPage();
  watch(viewer, 'viewer');
  await shareWith(page, 'datalist', listId, accounts.viewer.email, 'View');
  await shareWith(page, 'design', designId, accounts.viewer.email, 'View');
  if (!await login(viewer, accounts.viewer)) { throw new Error('Anmeldung des Betrachters fehlgeschlagen.'); }
  await viewer.goto(`${base}/DataLists/Edit/${listId}?tab=import`);
  await gridReady(viewer);
  check('a viewer has no AI buttons and no AI section', await viewer.locator('[data-act^="ai-"]').count() === 0 && await viewer.locator('[data-ai-import]').count() === 0);
  const viewerCall = await postJson(viewer, `/api/ai/datalists/${listId}/import`, { text: 'x' });
  check('the viewer is refused by the endpoint (403) and by nothing else', viewerCall.status === 403, JSON.stringify(viewerCall));
  await viewer.goto(`${base}/Designs/${designId}/Designer`);
  await viewer.waitForFunction(() => window.DtDesigner && window.DtDesigner.app && window.DtDesigner.app.doc);
  check('a viewer has no "Mit KI formulieren"', await viewer.locator('.dt-aibtn').count() === 0);
  const viewerAdmin = await viewer.goto(base + '/Admin/Ai/Runs');
  check('a viewer cannot open the run list', !viewerAdmin.ok() || /Account\/(AccessDenied|Login)/.test(viewer.url()), String(viewerAdmin.status()));
  await viewerContext.close();

  // ---------------------------------------------------------------------------------------- 8. text suggestions in the designer
  current = 'suggest: ';
  await page.goto(`${base}/Designs/${designId}/Designer`);
  await page.waitForFunction(() => window.DtDesigner && window.DtDesigner.app && window.DtDesigner.app.doc);
  await page.evaluate(() => window.DtDesigner.canvas.whenIdle());
  check('nothing selected: no AI button', await page.locator('.dt-aibtn').count() === 0);
  await page.evaluate(() => window.DtDesigner.app.select(['e8']));
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  // "Mit KI formulieren" is an entry of the ⋯ menu of the text toolbar (and of the context menu)
  await page.click('#dt-ctx button[aria-label="Mehr"]');
  await page.waitForSelector('.dt-menu');
  const aiButton = page.locator('.dt-menu .dt-aibtn');
  check('the text toolbar has "Mit KI formulieren" in its ⋯ menu', await aiButton.count() === 1 && /Mit KI formulieren/.test(await aiButton.textContent()));
  const undoBefore = await page.evaluate(() => window.DtDesigner.app.undoStack.length);
  await aiButton.click();
  await page.waitForSelector('dialog.dt-ai[open]');
  check('the dialog shows the current text', /\{\{Name\}\}/.test(await dialog(page).locator('.dt-ai-original__text').textContent()));
  await dialog(page).locator('.dt-ai-chips button:has-text("Freundlicher")').click();
  await dialog(page).locator('.dt-ai-prompt button').click();
  await page.waitForSelector('dialog.dt-ai[open] .dt-ai-prompt__text:not([hidden])');
  const suggestPrompt = await dialog(page).locator('.dt-ai-prompt__text').textContent();
  check('the instruction of the suggestion has fields with labels and samples', /Felder des Designs/.test(suggestPrompt) && /Holunderblüte/.test(suggestPrompt) && /Herkunftsland/.test(suggestPrompt) && /Freundlicher/.test(suggestPrompt) && /Format und Regeln \(fest\)/.test(suggestPrompt) && /Größe des Textfeldes: 138 × 29 mm/.test(suggestPrompt), suggestPrompt.slice(0, 300));
  await dialog(page).locator('button:has-text("Vorschläge holen")').click();
  await page.waitForSelector('dialog.dt-ai[open] .dt-ai-suggestion', { timeout: 30000 });
  const suggestions = await dialog(page).locator('.dt-ai-suggestion__text').allTextContents();
  check('three suggestions, the one without the placeholder is dropped', suggestions.length === 3 && suggestions.every(s => /\{\{Name\}\}/.test(s)), JSON.stringify(suggestions));
  check('the dropped suggestion is named', /Platzhalter/.test(await dialog(page).locator('.dt-ai-results').textContent()));
  await dialog(page).locator('.dt-ai-prompt button').click();   // hide the instruction again for the picture
  await shot(page, 'ai-suggest-dialog-1280.png');
  await dialog(page).locator('.dt-ai-suggestion').nth(1).click();
  await page.waitForFunction(() => document.querySelectorAll('dialog.dt-ai[open]').length === 0);
  const applied = await page.evaluate(() => window.DtDesigner.app.element('e8').text);
  check('picking one applies it to the element', applied === suggestions[1], applied);
  check('it is one undo step', await page.evaluate(() => window.DtDesigner.app.undoStack.length) === undoBefore + 1);
  check('the design is marked as changed (the autosave takes it from there)', await page.evaluate(() => window.DtDesigner.app.dirty === true || window.DtDesigner.app.saveState !== 'saved'));
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  check('Strg+Z brings the old text back', await page.evaluate(() => window.DtDesigner.app.element('e8').text) === '{{Name}}');
  await page.waitForFunction(() => window.DtDesigner.app.saveState === 'saved', null, { timeout: 15000 });
  const stored = await page.evaluate(async id => (await (await fetch('/api/designs/' + id)).json()).document.pages[0].elements.find(e => e.id === 'e8').text, designId);
  check('after the undo the saved design holds the old text again', stored === '{{Name}}', stored);
  // a hostile model: the dialog never turns the text into HTML
  const fakeSuggest = await page.evaluate(async id => {
    const r = await fetch('/api/ai/designs/' + id + '/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json', RequestVerificationToken: document.querySelector('meta[name=dt-csrf]').content }, body: JSON.stringify({ text: '{{Name}}', instruction: '' }) });
    return { status: r.status, body: await r.json() };
  }, designId);
  check('the endpoint answers with checked suggestions only', fakeSuggest.status === 200 && fakeSuggest.body.ok && fakeSuggest.body.proposal.suggestions.every(s => /\{\{Name\}\}/.test(s)), JSON.stringify(fakeSuggest.body).slice(0, 200));

  // ---------------------------------------------------------------------------------------- 9. phone size (390 px)
  current = '390 px: ';
  const phoneContext = await newContext(browser, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const phone = await phoneContext.newPage();
  watch(phone, 'phone');
  await login(phone, accounts.designer);
  await openImportTab(phone, listId);
  await phone.fill('[data-ai-form] textarea', IMPORT_TEXT);
  await phone.click('[data-ai-form] button:has-text("Vorschlag erstellen")');
  await phone.waitForSelector('dialog.dt-ai[open] .dt-ai-table', { timeout: 30000 });
  await shot(phone, 'ai-import-preview-390.png');
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check('the preview does not widen the page', overflow);
  await phone.locator('dialog.dt-ai[open] button:has-text("Verwerfen")').click();
  await phone.waitForFunction(() => document.querySelectorAll('dialog.dt-ai[open]').length === 0);
  await phone.goto(`${base}/DataLists/Edit/${listId}?tab=rows`);
  await gridReady(phone);
  await phone.click('.dt-grid__th--select input[type=checkbox]').catch(() => {});
  // the fill needs rows: the list is empty again, so the suggestion dialog and the fill dialog are shown as they are
  await phone.goto(`${base}/Designs/${designId}/Designer`);
  await phone.waitForFunction(() => window.DtDesigner && window.DtDesigner.app && window.DtDesigner.app.doc);
  await phone.evaluate(id => window.DtAi.suggestText({ designId: id, text: '{{Name}} jetzt {{Preis}} €', elementName: 'Titel', width: 100, height: 20, unit: 'mm', fields: [], onPick: () => {} }), designId);
  await phone.waitForSelector('dialog.dt-ai[open]');
  await phone.locator('dialog.dt-ai[open] button:has-text("Vorschläge holen")').click();
  await phone.waitForSelector('dialog.dt-ai[open] .dt-ai-suggestion', { timeout: 30000 });
  await shot(phone, 'ai-suggest-dialog-390.png');
  await phone.keyboard.press('Escape');
  // a fill preview at 390 px: import first, then fill
  await openImportTab(phone, listId);
  await phone.fill('[data-ai-form] textarea', IMPORT_TEXT);
  await phone.click('[data-ai-form] button:has-text("Vorschlag erstellen")');
  await phone.waitForSelector('dialog.dt-ai[open] .dt-ai-table', { timeout: 30000 });
  await phone.locator('dialog.dt-ai[open] button.mat-btn--primary').click();
  await phone.waitForSelector('.mat-toast:has-text("übernommen")');
  await phone.goto(`${base}/DataLists/Edit/${listId}?tab=rows`);
  await gridReady(phone);
  await phone.locator('.dt-grid__th--select input[type=checkbox]').check();
  await phone.click('[data-act="ai-fill"]');
  await phone.waitForSelector('dialog.dt-ai[open]');
  await phone.locator('dialog.dt-ai[open] select').selectOption('Region');
  await phone.locator('dialog.dt-ai[open] textarea').fill('Schreibe die Region passend zum Käse');
  await phone.locator('dialog.dt-ai[open] button:has-text("Vorschlag erstellen")').click();
  await phone.waitForSelector('dialog.dt-ai[open] .dt-ai-table', { timeout: 30000 });
  await shot(phone, 'ai-fill-preview-390.png');
  check('the fill preview does not widen the page', await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await phone.locator('dialog.dt-ai[open] button:has-text("Verwerfen")').click();
  await phone.waitForFunction(() => document.querySelectorAll('dialog.dt-ai[open]').length === 1);   // the form of the fill stays open behind the preview
  check('after discarding the preview the form is still there', await phone.locator('dialog.dt-ai[open] textarea').count() === 1);
  await phone.keyboard.press('Escape');
  await phoneContext.close();
  await admin.setViewportSize({ width: 390, height: 844 });
  await admin.goto(base + detailHref);
  await shot(admin, 'ai-run-details-390.png', { fullPage: true });
  check('the run details do not widen the page', await admin.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await admin.setViewportSize({ width: 1280, height: 800 });

  // ---------------------------------------------------------------------------------------- 10. errors in plain German
  current = 'errors: ';
  fake.mode = 'unauthorized';
  const unauthorized = await postJson(page, `/api/ai/datalists/${listId}/import`, { text: IMPORT_TEXT });
  check('a rejected key gives a clear message (422)', unauthorized.status === 422 && /API-Schlüssel wurde abgelehnt/.test(unauthorized.body.error) && unauthorized.body.status === 'Error', JSON.stringify(unauthorized));
  fake.mode = 'announce';
  const stuck = await postJson(page, `/api/ai/datalists/${listId}/import`, { text: IMPORT_TEXT });
  check('an announcement is nudged twice, then the run is stuck', stuck.status === 422 && stuck.body.status === 'Stuck' && /zweimal angestoßen/.test(stuck.body.error), JSON.stringify(stuck));
  fake.mode = 'ok';
  await shareWith(page, 'datalist', listId, accounts.admin.email, 'Edit');
  await admin.goto(base + '/Admin/Ai/Runs');
  check('the failed runs are in the list with their end', await admin.locator('.mat-pill', { hasText: 'Hängt' }).count() >= 1 && await admin.locator('.mat-pill', { hasText: 'Fehler' }).count() >= 1);
  await admin.goto(base + '/Admin/Ai/Runs/Details?id=' + stuck.body.runId);
  check('a stuck run offers "Weitermachen"', await admin.locator('button:has-text("Weitermachen")').count() === 1);
  await Promise.all([admin.waitForNavigation(), admin.click('button:has-text("Weitermachen")')]);
  check('"Weitermachen" starts a new run with the same request (a proposal waits)', /Vorschlag liegt bereit/.test(await toastText(admin)) && await admin.locator('a:has-text("Vorschlag ansehen"), .mat-btn:has-text("Vorschlag ansehen")').count() === 1, await toastText(admin));
  const continueHref = await admin.locator('.mat-btn:has-text("Vorschlag ansehen")').getAttribute('href');
  const runOfAdmin = Number(new URL(base + continueHref).searchParams.get('aiRun'));
  const foreign = await page.evaluate(async id => (await fetch('/api/ai/runs/' + id + '/proposal')).status, runOfAdmin);
  check('a designer cannot open the proposal of somebody else (403)', foreign === 403, String(foreign));
  await admin.goto(base + continueHref);
  await admin.waitForSelector('dialog.dt-ai[open] .dt-ai-table', { timeout: 15000 });
  check('"Vorschlag ansehen" opens the waiting proposal on the list', await dialog(admin).locator('tbody tr').count() === 3);
  await dialog(admin).locator('button:has-text("Verwerfen")').click();
  await admin.waitForFunction(() => document.querySelectorAll('dialog.dt-ai[open]').length === 0);

  // no profile: the administrator gets the way to the settings, the designer a neutral hint
  await admin.goto(base + '/Admin/Ai/Profiles');
  const mine = admin.locator('.mat-item', { hasText: profileName });
  await Promise.all([admin.waitForNavigation(), mine.locator('a.mat-item__main').click()]);
  await admin.click('button:has-text("Löschen")');
  await admin.click('dialog[open] [data-dlg-ok], dialog[open] .mat-btn--danger').catch(() => {});
  await admin.waitForNavigation().catch(() => {});
  const none = await postJson(page, `/api/ai/datalists/${listId}/import`, { text: IMPORT_TEXT });
  check('without a profile a designer gets a neutral message and no link', none.status === 422 && none.body.code === 'not-configured' && /Administrator/.test(none.body.error) && !none.body.settingsHref, JSON.stringify(none));
  const noneAdmin = await postJson(admin, `/api/ai/datalists/${listId}/import`, { text: IMPORT_TEXT });
  check('without a profile an administrator gets the link to the profiles', noneAdmin.status === 422 && noneAdmin.body.settingsHref === '/Admin/Ai/Profiles' && /Profile/.test(noneAdmin.body.error), JSON.stringify(noneAdmin));
  await openImportTab(page, listId);
  await page.fill('[data-ai-form] textarea', IMPORT_TEXT);
  await page.click('[data-ai-form] button:has-text("Vorschlag erstellen")');
  await page.waitForSelector('[data-ai-form] .mat-alert--danger');
  check('the dialog shows the neutral message', /Administrator/.test(await page.locator('[data-ai-form] .mat-alert--danger').textContent()) && await page.locator('[data-ai-form] .mat-alert--danger a').count() === 0);
  await shot(page, 'ai-not-configured-1280.png');

  // the brake per address and minute (the calls above are all within the last minute)
  await admin.goto(base + '/Admin/Ai');
  await admin.click('#ai-tabs-tab-limits');
  await admin.fill('#Input_PerMinutePerAddress', '2');
  await Promise.all([admin.waitForNavigation(), admin.click('button[type=submit].mat-btn--primary')]);
  const braked = await postJson(page, `/api/ai/datalists/${listId}/import`, { text: IMPORT_TEXT });
  check('the brake per address answers before the model is called', braked.status === 422 && braked.body.status === 'LimitReached' && /Zu viele Anfragen/.test(braked.body.error), JSON.stringify(braked));
  await admin.goto(base + '/Admin/Ai');
  await admin.click('#ai-tabs-tab-limits');
  await admin.fill('#Input_PerMinutePerAddress', '60');
  await admin.fill('#Input_AddressDailyRuns', '200');
  await admin.fill('#Input_UserDailyTokens', '1500000');
  await admin.fill('#Input_UserMonthlyTokens', '20000000');
  await admin.fill('#Input_MonthlyTokens', '100000000');
  await admin.click('#ai-tabs-tab-instructions');
  await admin.fill('textarea[name="Input.ActionInstructions[DataImport]"]', '');   // the addition of this check goes away again
  await Promise.all([admin.waitForNavigation(), admin.click('button[type=submit].mat-btn--primary')]);
  await admin.goto(base + '/Admin/Ai');
  await admin.click('#ai-tabs-tab-instructions');
  check('the settings are back to normal', (await admin.locator('textarea[name="Input.ActionInstructions[DataImport]"]').inputValue()) === '');


  // ---------------------------------------------------------------------------------------- the end
  current = '';
  check('no console errors and no CSP violations', problems.length === 0, problems.slice(0, 5).join('\n'));
  await browser.close();
  fake.server.close();

  const failed = results.filter(r => !r.ok);
  for (const r of results) { console.log((r.ok ? 'ok   ' : 'FAIL ') + r.name + (r.ok || !r.detail ? '' : '  -> ' + r.detail)); }
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (problems.length) { console.log('problems:\n' + problems.join('\n')); }
  process.exit(failed.length === 0 ? 0 : 1);
})().catch(async e => {
  console.error(e);
  for (const [i, p] of livePages.entries()) { try { await shot(p, `ai-failure-${i}.png`); console.log(`page ${i}: ${p.url()}`); console.log((await p.locator('dialog[open]').allInnerTexts()).join(' --- ').slice(0, 1500)); } catch (x) { /* page gone */ } }
  try { fake.server.close(); } catch (x) { /* closed */ } process.exit(1); });
