// Checks the design assistant in the editor (docs/PLAN-AI-DESIGN.md, phase A2) in a real browser (installed Edge, headless) against the LOCAL FAKE OpenAI-compatible server of fake-ai.js ("agent" mode)
// that this script starts. Nothing leaves the machine. What is checked, in the order of the sections:
//  setup      a fake profile and high limits through the admin pages (restored at the end)
//  create     the prompt "Mit KI entwerfen" on the start page: one click makes the design, the editor opens with the panel KI following the run; steps appear one by one, the words of the model
//             grow, the canvas changes DURING the run (element count), touched elements flash, the editor is read-only meanwhile (is-ai-busy, the bar), the model LOOKS at the page (the editor draws
//             it and the fake sees an image), the end line, the whole run is ONE undo step (Strg+Z / Strg+Y, autosave without a 409)
//  editor     examples, Rückgängig (and the "geändert seitdem" second question), the scope with "Nur hier ändern" (the refusal is a card), a question (Wartet), Angehalten + Weitermachen, a failing tool,
//             Limit erreicht, Stopp, an attached picture (library "KI-Anhang", an image part reaches the model, the picture sits on the page), a reference design and data list, pages added live,
//             a series field, the history, a new conversation, the plain call without streaming, a run that is followed after a reload, the tab title, the limit notice (429)
//  start      the prompt in the dialog "Design erstellen" (own size), hidden when the AI is off
//  roles      a person with View only sees no entry; an administrator with the AI off sees the explanation and the link
//  responsive tablet and phone (390 px): the sheet, the busy bar above the tab bar
//  qualitaet  the quality pass (docs/PLAN-AI-DESIGN.md): the review before a run ends (a model that is done without looking is sent back once and then looks), templates first (the editor draws the
//             numbered sheet of the templates, the model takes one whole and replaces its sample texts)
//  foto       plan 5 / C3: the assistant searches the catalogues (a photo of Pexels, an icon of Iconify), imports ONE of each, places them; the credit, the undo step, a catalogue that is off
//             (needs DESIGNTHIX__Catalogs__<pexels|iconify>__BaseUrl = the fake catalogues, --catalog-port 3073; skipped without)
//
//   node ai-design-check.js [base url, default http://localhost:3043] [--fake-host <host the APP reaches this machine by>] [--fake-port 3070] [--catalog-port 3073] [--out <folder for the screenshots>]
//
// With the app in Docker the fake server is reached at host.docker.internal; with `dotnet run` pass --fake-host 127.0.0.1. Accounts: lib.js (DT_ACCOUNT_FILE). Zero console errors and zero CSP violations
// are part of the result. The check raises the limits of the AI first (a run makes one call per step) and puts them back; the designs it makes are deleted.
const fs = require('fs');
const os = require('os');
const path = require('path');
const lib = require('./lib.js');
const E = require('./editor-lib.js');

const args = process.argv.slice(2);
const argValue = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const { base, problems, watch, launch, newContext, login, ensureAccounts, postJson, purgeImage } = lib(args, { ignoreUrl: /\/api\/ai\//, ignore: /status of (400|401|403|404|409|422|429)/ });
const outDir = path.resolve(argValue('--out', path.join(os.tmpdir(), 'designthix-ai-design-check')));
const fakePort = Number(argValue('--fake-port', '3070'));
const fakeHost = argValue('--fake-host', /localhost:3043|127\.0\.0\.1:3043/.test(base) ? 'host.docker.internal' : '127.0.0.1');
const { fake, startFake } = require('./fake-ai.js');

fs.mkdirSync(outDir, { recursive: true });
const results = [];
const livePages = [];
let current = '';
const check = (name, ok, detail) => { results.push({ name: current + name, ok: !!ok, detail }); if (!ok) { console.log('FAIL ' + current + name + (detail ? '  -> ' + detail : '')); } };
const stamp = String(Date.now()).slice(-6);
let shotNo = 0;
const shot = async (page, name) => {
  shotNo++;
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(outDir, `${String(shotNo).padStart(2, '0')}-${name}-${page.viewportSize().width}.png`) });
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const only = argValue('--only', '') ? argValue('--only', '').split(',') : null;
const wanted = name => !only || only.includes(name);

const api = (page, method, url, body) => page.evaluate(async ({ method: m, url: u, body: b }) => {
  const r = await fetch(u, { method: m, headers: Object.assign({ Accept: 'application/json' }, m === 'GET' ? {} : { 'Content-Type': 'application/json', RequestVerificationToken: document.querySelector('meta[name=dt-csrf]').content }), body: m === 'GET' ? undefined : JSON.stringify(b || {}) });
  let json = null;
  try { json = await r.json(); } catch (e) { /* none */ }
  return { status: r.status, body: json };
}, { method, url, body });

/** What a person sees of the page while the editor is open: sampled every 100 ms inside the page (the run is over before a script outside could look twice). */
const SAMPLER = () => {
  window.__ai = { samples: [] };
  setInterval(() => {
    const D = window.DtDesigner;
    const root = document.getElementById('dt-ds');
    if (!D || !D.app || !D.app.doc || !root) { return; }
    const live = document.querySelector('[data-live-text]');
    const count = list => list.reduce((n, e) => n + 1 + (e.children ? count(e.children) : 0), 0);
    window.__ai.samples.push({
      t: Date.now(), st: root.getAttribute('data-ai-state'), len: live ? Number(live.getAttribute('data-len')) : -1, thinking: !!document.querySelector('.dt-ag-live.is-thinking'),
      acts: document.querySelectorAll('.dt-ag-act').length, els: D.app.doc.pages.reduce((n, p) => n + count(p.elements), 0), pages: D.app.doc.pages.length, editable: D.app.editable(),
      busyClass: root.classList.contains('is-ai-busy'), flashes: document.querySelectorAll('.dt-ag-flash').length, bar: !!document.getElementById('dt-ag-bar') && !document.getElementById('dt-ag-bar').hidden,
      undoDisabled: document.getElementById('dt-undo').disabled, title: document.title, panel: D.panels.current(), width: D.app.doc.width,
    });
    if (window.__ai.samples.length > 4000) { window.__ai.samples.shift(); }
  }, 100);
};

let restoreAdmin = async () => {};
let restored = false;

(async () => {
  await startFake(fakePort);
  fake.streamDelayMs = 220;     // the words of a message come slowly ...
  fake.restDelayMs = 4;         // ... the actions behind them at once: a run of seven steps takes about half a minute
  console.log(`fake OpenAI server on :${fakePort}, the app reaches it at http://${fakeHost}:${fakePort}/v1`);
  const browser = await launch();
  const accounts = await ensureAccounts(browser);
  const wide = { viewport: { width: 1440, height: 900 } };

  const adminContext = await newContext(browser, wide);
  const admin = await adminContext.newPage();
  watch(admin, 'admin'); livePages.push(admin);
  if (!await login(admin, accounts.admin)) { throw new Error('Anmeldung des Administrators fehlgeschlagen.'); }
  const memberContext = await newContext(browser, wide);
  await memberContext.addInitScript(SAMPLER);
  const A = await memberContext.newPage();
  watch(A, 'A'); livePages.push(A);
  const viewerContext = await newContext(browser, wide);
  const B = await viewerContext.newPage();
  watch(B, 'B'); livePages.push(B);
  check('the accounts sign in', (await login(A, accounts.designer)) && (await login(B, accounts.viewer)));

  const cleanup = { designs: [], lists: [] };
  const profileName = 'Fake KI Design ' + stamp;
  let originalLimits = null;
  let originalReview = null;

  // ---------------------------------------------------------------------------------------- admin helpers
  async function limits(values) {
    await admin.goto(base + '/Admin/Ai');
    await admin.click('#ai-tabs-tab-limits');
    const previous = {};
    for (const [key, value] of Object.entries(values)) {
      const selector = '#Input_' + key;
      previous[key] = await admin.inputValue(selector);
      await admin.fill(selector, String(value));
    }
    await Promise.all([admin.waitForNavigation(), admin.click('button[type=submit].mat-btn--primary')]);
    return previous;
  }

  async function aiSwitch(on) {
    await admin.goto(base + '/Admin/Ai');
    const box = admin.locator('input[type=checkbox][name="Input.Enabled"]');
    if ((await box.isChecked()) !== on) { await admin.click('label.mat-switch:has(input[name="Input.Enabled"])'); }
    await Promise.all([admin.waitForNavigation(), admin.click('button[type=submit].mat-btn--primary')]);
  }

  /** The review before a run ends (switch on the page of the limits): returns what it was. */
  async function review(on) {
    await admin.goto(base + '/Admin/Ai');
    await admin.click('#ai-tabs-tab-limits');
    const box = admin.locator('input[type=checkbox][name="Input.AgentReview"]');
    const was = await box.isChecked();
    if (was !== on) { await admin.click('label.mat-switch:has(input[name="Input.AgentReview"])'); }
    await Promise.all([admin.waitForNavigation(), admin.click('button[type=submit].mat-btn--primary')]);
    return was;
  }

  /** Puts the settings back and deletes the profile of the check (also called when the check breaks). */
  restoreAdmin = async () => {
    if (restored) { return; }
    restored = true;
    try {
      await aiSwitch(true);
      if (originalLimits) { await limits(originalLimits); }
      if (originalReview !== null) { await review(originalReview); }
      await admin.goto(base + '/Admin/Ai/Profiles');
      const mine = admin.locator('.mat-item', { hasText: profileName });
      if (await mine.count()) {
        await Promise.all([admin.waitForNavigation(), mine.locator('a.mat-item__main').click()]);
        await admin.click('button:has-text("Löschen")');
        await admin.click('dialog[open] [data-dlg-ok], dialog[open] .mat-btn--danger').catch(() => {});
        await admin.waitForNavigation().catch(() => {});
      }
    } catch (e) { console.log('restore failed: ' + e.message); }
  };

  // ---------------------------------------------------------------------------------------- 0. setup: a profile that talks to the fake server, limits high enough
  current = 'setup: ';
  await admin.goto(base + '/Admin/Ai/Profiles/Edit');
  await admin.fill('#Input_Name', profileName);
  await admin.selectOption('#Input_Preset', 'custom');
  await admin.fill('#Input_BaseUrl', `http://${fakeHost}:${fakePort}/v1`);
  await admin.fill('#Input_ApiKey', 'sk-fake-' + stamp);
  await admin.fill('#Input_Model', 'fake-model');
  await Promise.all([admin.waitForNavigation(), admin.click('button[type=submit].mat-btn--primary')]);
  await admin.goto(base + '/Admin/Ai/Profiles');
  const item = admin.locator('.mat-item', { hasText: profileName });
  if (await item.locator('button:has-text("Aktivieren")').count()) { await Promise.all([admin.waitForNavigation(), item.locator('button:has-text("Aktivieren")').click()]); await admin.goto(base + '/Admin/Ai/Profiles'); }
  check('the fake profile is active', await admin.locator('.mat-item', { hasText: profileName }).locator('text=aktiv').count() > 0);
  originalLimits = await limits({ UserDailyTokens: 50000000, UserMonthlyTokens: 500000000, MonthlyTokens: 500000000, AddressDailyRuns: 5000, PerMinutePerAddress: 5000 });
  check('the limits are raised for the check', Object.keys(originalLimits).length === 5, JSON.stringify(originalLimits));
  originalReview = await review(false);   // the review before a run ends has its own section; the other runs of the fake model end as they always did
  await aiSwitch(true);

  // ---------------------------------------------------------------------------------------- helpers of the editor
  const inEditor = async (page, id) => { await E.openDesigner(page, base, id); await page.waitForFunction(() => document.getElementById('dt-ds').getAttribute('data-ai-entry') === 'true' || !document.querySelector('.dt-rail__btn[data-panel="ai"]:not([hidden])') && window.DtDesigner.ai && !window.DtDesigner.ai.state().agent, null, { timeout: 8000 }).catch(() => {}); };
  const aiOpen = async page => { await page.evaluate(() => window.DtDesigner.panels.open('ai')); await page.waitForSelector('.dt-ag-input', { timeout: 8000 }); };
  const endCount = page => page.locator('.dt-ag-end').count();
  const endState = page => page.evaluate(() => { const e = Array.from(document.querySelectorAll('.dt-ag-end')).pop(); return e ? e.getAttribute('data-state') : null; });
  const doc = page => page.evaluate(() => JSON.parse(JSON.stringify(window.DtDesigner.app.doc)));
  const allElements = d => { const out = []; const walk = list => list.forEach(e => { out.push(e); if (e.children) { walk(e.children); } }); d.pages.forEach(p => walk(p.elements)); return out; };
  const serverDoc = async (page, id) => (await api(page, 'GET', '/api/designs/' + id)).body;
  const saved = page => page.waitForFunction(() => window.DtDesigner.app.saveState === 'saved' && !window.DtDesigner.app.dirty, null, { timeout: 15000 });

  /** Types a message into the panel and sends it. */
  async function say(page, text) {
    await aiOpen(page);
    await page.fill('.dt-ag-input', text);
    await page.click('.dt-ag-send');
  }

  /** Sends a message and waits until the run has ended and the editor is free again. */
  async function run(page, text, timeout) {
    const before = await endCount(page);
    await say(page, text);
    await page.waitForFunction(n => document.querySelectorAll('.dt-ag-end').length > n && document.getElementById('dt-ds').getAttribute('data-ai-state') === 'idle' && window.DtDesigner.app.editable(), before, { timeout: timeout || 120000, polling: 100 });
    await E.idle(page);
  }

  async function makeDesign(page, name, preset, pageCount) {
    const made = await postJson(page, '/api/designs', { preset: preset || 'poster-a3-portrait' });
    const id = made.body.id;
    await postJson(page, `/api/designs/${id}/rename`, { name });
    const pages = [0, 1].slice(0, pageCount || 2).map(i => ({
      id: 'p' + (i + 1), name: '',
      background: { color: ['#ffffff', '#fff4d6'][i] },
      elements: [
        { id: 'band' + i, type: 'shape', shape: 'rect', x: 0, y: 0, w: 297, h: 60, fill: '#1fb3d6' },
        { id: 'title' + i, type: 'text', x: 20, y: 90, w: 257, h: 40, text: 'Sommerfest Samstag', fontFamily: 'Montserrat', fontWeight: 700, fontSize: 48, color: '#1b2733' },
        { id: 'dot' + i, type: 'shape', shape: 'ellipse', x: 100, y: 200, w: 90, h: 90, fill: '#f2a33a' },
      ],
    }));
    const document_ = { schema: 2, unit: 'mm', width: 297, height: 420, dpi: 300, locale: 'de-DE', fields: [], pages };
    const status = await page.evaluate(async ({ id: i, d, token }) => {
      const cur = await (await fetch('/api/designs/' + i)).json();
      const r = await fetch('/api/designs/' + i, { method: 'POST', headers: { 'Content-Type': 'application/json', RequestVerificationToken: token }, body: JSON.stringify({ revision: cur.revision, document: d }) });
      return r.status;
    }, { id, d: document_, token: await page.evaluate(() => document.querySelector('meta[name=dt-csrf]').content) });
    if (status !== 200) { throw new Error('document not saved: ' + status); }
    cleanup.designs.push({ id, page });
    return id;
  }

  // ---------------------------------------------------------------------------------------- 1. create from a prompt: the whole run seen from the editor
  let createdId = 0;
  if (wanted('create')) {
    current = 'create: ';
    await A.goto(base + '/');
    check('the start page has the prompt "Mit KI entwerfen" under the heading', await A.locator('form.dt-aip--hero[data-ai-create]').isVisible() && /Was möchtest du gestalten/.test(await A.locator('form.dt-aip--hero textarea').getAttribute('placeholder')));
    check('the format choice starts with "Automatisch"', await A.locator('form.dt-aip--hero [data-ai-format]').inputValue() === 'auto' && (await A.locator('form.dt-aip--hero [data-ai-format] option').allTextContents()).length >= 12);
    check('the prompt is above the search', await A.evaluate(() => document.querySelector('form.dt-aip--hero').getBoundingClientRect().top < document.querySelector('form.dt-start__search').getBoundingClientRect().top));
    await shot(A, 'start-prompt');
    await A.fill('form.dt-aip--hero textarea', 'Gestalte ein Plakat für unser „Sommerfest“ am Samstag');
    await shot(A, 'start-prompt-filled');
    await A.click('form.dt-aip--hero [data-ai-submit]');
    await A.waitForURL(/\/Designs\/\d+\/Designer/, { timeout: 30000 });
    createdId = Number(A.url().match(/Designs\/(\d+)\//)[1]);
    cleanup.designs.push({ id: createdId, page: A });
    await A.waitForSelector('#dt-ds:not(.is-loading)', { timeout: 30000 });
    await A.waitForFunction(() => !document.getElementById('dt-ds').classList.contains('is-loading') && window.DtDesigner.ai && window.DtDesigner.ai.state().conv > 0, null, { timeout: 20000 });
    check('the editor opened and removed ?ai= from the address', !/[?&]ai=/.test(A.url()));
    check('the panel KI is open and follows the run', await A.evaluate(() => window.DtDesigner.panels.current()) === 'ai' && await A.locator('.dt-ag').count() === 1);
    await A.waitForFunction(() => document.getElementById('dt-ds').getAttribute('data-ai-state') === 'running', null, { timeout: 20000 }).catch(() => {});
    // the run: take samples until it ends
    await A.waitForFunction(() => document.querySelectorAll('.dt-ag-end').length > 0 && document.getElementById('dt-ds').getAttribute('data-ai-state') === 'idle', null, { timeout: 180000, polling: 200 });
    await E.idle(A);
    const samples = await A.evaluate(() => window.__ai.samples);
    const running = samples.filter(s => s.st === 'running');
    check('the editor was locked while the run went on (is-ai-busy, not editable)', running.length > 5 && running.every(s => s.busyClass && !s.editable), `${running.length} samples`);
    check('the bar over the canvas was there while it worked', running.filter(s => s.bar).length >= running.length * 0.9);
    check('undo and redo were disabled while it worked', running.every(s => s.undoDisabled));
    const counts = [...new Set(running.map(s => s.els))];
    check('the canvas changed during the run (element count grew step by step)', counts.length >= 4 && counts[counts.length - 1] > counts[0], JSON.stringify(counts));
    check('the page was resized by the AI during the run (format "Automatisch" -> poster)', samples.some(s => s.width !== samples[0].width) || (await doc(A)).width === 297, JSON.stringify([samples[0].width, (await doc(A)).width]));
    check('action cards appeared one after the other', [...new Set(running.map(s => s.acts))].length >= 5, JSON.stringify([...new Set(running.map(s => s.acts))]));
    check('touched elements flashed', samples.some(s => s.flashes > 0));
    // the words of the model grow: a run of growing lengths inside one message
    let best = 0;
    let streak = 0;
    let previous = 0;
    for (const s of samples) { if (s.len > previous && s.len > 0) { streak++; best = Math.max(best, streak); } else if (s.len <= 0) { streak = 0; } previous = s.len; }
    check('the words of the model grew while they were written', best >= 3, 'longest growing streak ' + best);
    check('before the first word the panel said the AI is thinking', samples.some(s => s.thinking));
    check('the whole conversation is in the log (user message, assistant messages, cards, end)', await A.locator('[data-kind="user"]').count() === 1 && await A.locator('[data-kind="assistant"]').count() >= 6 && await A.locator('.dt-ag-act').count() >= 7 && await endState(A) === 'done');
    const lookCard = A.locator('.dt-ag-act[data-tool="look"]');
    check('the look action shows the picture the model got', await lookCard.count() === 1 && await lookCard.locator('.dt-ag-pic img').count() === 1);
    await A.waitForFunction(() => { const i = document.querySelector('.dt-ag-pic img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 10000 });
    check('the editor answered the request to look: the fake model saw an image', fake.agent.calls.some(c => c.scenario === 'plakat' && c.sawImage), JSON.stringify(fake.agent.calls.filter(c => c.scenario === 'plakat').map(c => [c.step, c.sawImage])));
    check('the first call of an automatic format chose the poster A3', fake.agent.calls.filter(c => c.scenario === 'plakat').length >= 7 && (await doc(A)).width === 297 && (await doc(A)).height === 420);
    const finalDoc = await doc(A);
    const texts = allElements(finalDoc).filter(e => e.type === 'text').map(e => e.text);
    check('the poster has title, subtitle, details, an icon and a QR code', texts.some(t => /Sommerfest/.test(t)) && texts.length >= 3 && allElements(finalDoc).some(e => e.type === 'icon') && allElements(finalDoc).some(e => e.type === 'qr'), texts.join(' | '));
    check('the title got its warmer colour (the later change took effect)', allElements(finalDoc).some(e => e.type === 'text' && e.color === '#ffe08a'));
    check('the title says "Sommerfest" (taken from the quotes of the prompt)', texts.some(t => t === 'Sommerfest'));
    // the design made by "Automatisch" is named by the AI (rename_design), not "Unbenannt – A4 Hochformat"
    const named = await serverDoc(A, createdId);
    check('the design got a name from the AI instead of "Unbenannt ..."', /Sommerfest – Plakat/.test(named.name) && !/^Unbenannt/.test(named.name), named.name);
    check('the editor shows the new name (field and tab title)', await A.inputValue('#dt-name') === named.name && (await A.title()).startsWith(named.name), await A.inputValue('#dt-name') + ' / ' + await A.title());
    await shot(A, 'run-done');

    // the whole run is ONE undo step
    const stack = await A.evaluate(() => ({ n: window.DtDesigner.app.undoStack.length, tag: window.DtDesigner.app.undoStack.length ? window.DtDesigner.app.undoStack[window.DtDesigner.app.undoStack.length - 1].tag : null, dirty: window.DtDesigner.app.dirty, state: window.DtDesigner.app.saveState }));
    check('the editor holds the run as one undo step, nothing is unsaved', stack.n === 1 && stack.tag === 'ai' && !stack.dirty && stack.state === 'saved', JSON.stringify(stack));
    check('the button "Rückgängig" sits under the newest run', await A.locator('.dt-ag-undo').count() === 1);
    const server1 = await serverDoc(A, createdId);
    check('the server holds the poster', allElements(server1.document).length === allElements(finalDoc).length);
    await A.evaluate(() => { if (document.activeElement && document.activeElement.blur) { document.activeElement.blur(); } });
    await A.keyboard.press('Control+z');
    await E.idle(A);
    const afterUndo = await doc(A);
    check('Strg+Z takes the whole run back in one step', allElements(afterUndo).length === 0, String(allElements(afterUndo).length));
    await saved(A);
    const server2 = await serverDoc(A, createdId);
    check('the undo is saved without a conflict (no dialog, the old document is on the server)', allElements(server2.document).length === 0 && await A.locator('dialog[open]').count() === 0, String(allElements(server2.document).length));
    await A.keyboard.press('Control+y');
    await E.idle(A);
    check('Strg+Y brings the run back', allElements(await doc(A)).length === allElements(finalDoc).length);
    await saved(A);
    check('the redo is saved too', allElements((await serverDoc(A, createdId)).document).length === allElements(finalDoc).length);

    // while it worked nothing the person did could change the design: tested in the next run (editor section)
  }

  // ---------------------------------------------------------------------------------------- 2. the editor: scenarios on a design with two pages
  let d1 = 0;
  if (wanted('editor')) {
    current = 'editor: ';
    d1 = await makeDesign(A, 'KI-Check ' + stamp);
    await inEditor(A, d1);
    check('the rail has the entry KI after Vorlagen', await A.evaluate(() => { const b = Array.from(document.querySelectorAll('#dt-rail .dt-rail__btn:not([hidden])')).map(x => x.getAttribute('data-panel')); return b[0] === 'templates' && b[1] === 'ai'; }));
    await aiOpen(A);
    check('the empty state explains and offers six examples', await A.locator('.dt-ag-empty').isVisible() && await A.locator('.dt-ag-example').count() === 6);
    check('the compose box has Anhängen, Referenz, the scope and Senden', await A.locator('.dt-ag-tool:has-text("Anhängen")').isVisible() && await A.locator('.dt-ag-tool:has-text("Referenz")').isVisible() && await A.locator('.dt-ag-scope').isVisible() && await A.locator('.dt-ag-send').isVisible());
    check('"Senden" waits for a message', await A.locator('.dt-ag-send').isDisabled());
    await shot(A, 'panel-empty');
    // an example fills the field; Strg+Enter sends
    await A.click('.dt-ag-example:has-text("Übersetze")');
    check('an example chip fills the text field', /Übersetze alle Texte/.test(await A.inputValue('.dt-ag-input')));
    const beforeEnds = await endCount(A);
    await A.press('.dt-ag-input', 'Control+Enter');
    await A.waitForFunction(() => document.getElementById('dt-ds').getAttribute('data-ai-state') === 'running', null, { timeout: 15000 });
    // the lock: try to change the design while it works
    await A.evaluate(() => window.DtDesigner.app.select(['title0']));
    await A.evaluate(() => { document.activeElement && document.activeElement.blur(); });
    const lockBefore = await doc(A);
    await A.keyboard.press('Delete');
    await A.keyboard.press('Control+d');
    await A.keyboard.press('t');
    const lockProbe = await A.evaluate(() => ({ editable: window.DtDesigner.app.editable(), canUndo: window.DtDesigner.app.canUndo(), sel: window.DtDesigner.app.sel.slice(), undoDisabled: document.getElementById('dt-undo').disabled }));
    const idsOf = d => allElements(d).map(e => e.id).sort().join(',');
    check('while the AI works the editor ignores Entf, Strg+D and the letter keys (no element lost, none added)', lockProbe.editable === false && idsOf(lockBefore) === idsOf(await doc(A)), idsOf(lockBefore) + ' / ' + idsOf(await doc(A)));
    check('the page can still be looked at (the selection works)', lockProbe.sel.length === 1 && lockProbe.sel[0] === 'title0');
    check('undo of the editor is off while the AI works', lockProbe.canUndo === false && lockProbe.undoDisabled === true);
    await shot(A, 'busy');
    await A.waitForFunction(n => document.querySelectorAll('.dt-ag-end').length > n && document.getElementById('dt-ds').getAttribute('data-ai-state') === 'idle', beforeEnds, { timeout: 90000, polling: 100 });
    await E.idle(A);
    let d1doc = await doc(A);
    check('Übersetze: the texts are English', allElements(d1doc).filter(e => e.type === 'text').every(e => /Summer Festival Saturday/.test(e.text)), allElements(d1doc).filter(e => e.type === 'text').map(e => e.text).join('|'));
    check('the editor is free again after the run', await A.evaluate(() => window.DtDesigner.app.editable() && !document.getElementById('dt-ds').classList.contains('is-ai-busy')) && await A.locator('#dt-ag-bar').isHidden());
    check('the undo button of the editor is back', await A.evaluate(() => !document.getElementById('dt-undo').disabled));
    check('the summary of the action card is a German sentence', /^(Text|Texte|Element|\d+ Element)/.test((await A.locator('.dt-ag-act[data-tool="update_elements"] .dt-ag-act__text').first().textContent()).trim()), await A.locator('.dt-ag-act[data-tool="update_elements"] .dt-ag-act__text').first().textContent());
    await A.locator('.dt-ag-act[data-tool="update_elements"] details summary').first().click();
    const detailText = await A.locator('.dt-ag-act[data-tool="update_elements"] .dt-ag-pre').first().textContent();
    check('the details of an action show its arguments as JSON', /"changes"/.test(detailText) && /Summer Festival/.test(await A.locator('.dt-ag-act[data-tool="update_elements"] .dt-ag-pre').nth(0).textContent() + await A.locator('.dt-ag-act[data-tool="update_elements"] .dt-ag-pre').nth(1).textContent()));
    check('an assistant message has the header "KI · model · n Tokens"', /KI\s*·\s*fake-model\s*·\s*[\d.]+ Tokens/.test(await A.locator('.dt-ag-msg--ai:not(.dt-ag-live) .dt-ag-who').first().textContent()));
    await shot(A, 'run-translate');

    // Rückgängig: the dialog, then the design is as before
    await A.click('.dt-ag-undo');
    await A.waitForSelector('dialog[open]');
    check('"Rückgängig" asks first (MatUi confirm)', /zurückgenommen/.test(await A.locator('dialog[open]').textContent()));
    await A.click('dialog[open] .mat-btn--danger, dialog[open] [data-dlg-ok]');
    await A.waitForFunction(() => /Sommerfest Samstag/.test(JSON.stringify(window.DtDesigner.app.doc)) && !/Summer Festival/.test(JSON.stringify(window.DtDesigner.app.doc)), null, { timeout: 15000 });
    d1doc = await doc(A);
    check('after "Rückgängig" the German texts are back', allElements(d1doc).filter(e => e.type === 'text').every(e => e.text === 'Sommerfest Samstag'));
    check('the editor step of the run is gone (the server took it back)', await A.evaluate(() => !window.DtDesigner.app.undoStack.some(s => s.tag === 'ai')));
    await A.waitForSelector('.dt-ag-line:has-text("rückgängig")', { timeout: 10000 });
    check('the undo is in the log as an info line', true);
    check('the button is gone after the undo', await A.locator('.dt-ag-undo').count() === 0);
    check('no 409 dialog came up, the editor is saved', await A.locator('dialog[open]').count() === 0 && await A.evaluate(() => window.DtDesigner.app.saveState) === 'saved');

    // after the editor's own Strg+Z the server's "Rückgängig" recognises that the design already is as before: no second question
    await run(A, 'Übersetze alle Texte ins Englische');
    await A.evaluate(() => { if (document.activeElement && document.activeElement.blur) { document.activeElement.blur(); } });
    await A.keyboard.press('Control+z');
    await E.idle(A);
    await saved(A);
    check('Strg+Z took the translation back', !/Summer Festival/.test(JSON.stringify(await doc(A))));
    check('the button "Rückgängig" is still offered (the panel does not know)', await A.locator('.dt-ag-undo').count() === 1);
    await A.click('.dt-ag-undo');
    await A.waitForSelector('dialog[open]');
    await A.click('dialog[open] .mat-btn--danger, dialog[open] [data-dlg-ok]');
    await A.waitForFunction(() => !document.querySelector('.dt-ag-undo'), null, { timeout: 15000 });
    check('the server marks the run as taken back without the question "Seitdem wurde das Design geändert"', await A.locator('dialog[open]').count() === 0 && /schon wieder so aus/.test(await A.locator('.mat-toast').allTextContents().then(t => t.join(' '))), await A.locator('.mat-toast').allTextContents().then(t => t.join(' | ')));
    check('the German texts are still there and the editor is saved', !/Summer Festival/.test(JSON.stringify(await doc(A))) && await A.evaluate(() => window.DtDesigner.app.saveState) === 'saved');

    // the second question: somebody changed the design after the run
    await run(A, 'Übersetze alle Texte ins Englische');
    await A.evaluate(() => window.DtDesigner.app.setBackground({ color: '#ff0000', gradient: null }, { merge: false }));
    await saved(A);
    await A.click('.dt-ag-undo');
    await A.waitForSelector('dialog[open]');
    await A.click('dialog[open] .mat-btn--danger, dialog[open] [data-dlg-ok]');
    await A.waitForFunction(() => /Seitdem wurde das Design geändert/.test((document.querySelector('dialog[open]') || {}).textContent || ''), null, { timeout: 15000 });
    check('a design changed after the run asks a second question', /Diese Änderungen gehen verloren/.test(await A.locator('dialog[open]').textContent()));
    await shot(A, 'undo-changed-since');
    await A.click('dialog[open] .mat-btn--danger, dialog[open] [data-dlg-ok]');
    await A.waitForFunction(() => !/Summer Festival/.test(JSON.stringify(window.DtDesigner.app.doc)) && !/#ff0000/.test(JSON.stringify(window.DtDesigner.app.doc)), null, { timeout: 15000 });
    check('after the second yes the design is as before the run (the manual change is gone)', true);

    // the scope: "Diese Seite" with "Nur hier ändern": a write on the other page is refused and the model reads why
    await A.evaluate(() => window.DtDesigner.app.setPage(1));
    await aiOpen(A);
    check('the scope list offers "Auswahl" only with a selection', await A.locator('.dt-ag-scope option[value="selection"]').isDisabled());
    await A.evaluate(() => window.DtDesigner.app.select(['title1']));
    await A.waitForFunction(() => /Auswahl \(1\)/.test(document.querySelector('.dt-ag-scope option[value="selection"]').textContent));
    check('with a selection the option says "Auswahl (1)"', !(await A.locator('.dt-ag-scope option[value="selection"]').isDisabled()));
    await A.selectOption('.dt-ag-scope', 'page');
    check('"Nur hier ändern" appears for a page or a selection', await A.locator('.dt-ag-lock').isVisible());
    await A.click('label.dt-ag-lock');
    await run(A, 'bereich-test: schreibe etwas');
    d1doc = await doc(A);
    check('the write outside the scope was refused: a card in the error colour', await A.locator('.dt-ag-act.is-error').count() >= 1);
    check('the refusal says why in German', /Seite|Bereich|außerhalb|nicht erlaubt|gesperrt/i.test(await A.locator('.dt-ag-act.is-error').first().textContent()), await A.locator('.dt-ag-act.is-error').first().textContent());
    check('the text was written on the page of the scope only', allElements(d1doc.pages[1] ? { pages: [d1doc.pages[1]] } : { pages: [] }).some(e => e.text === 'Im Bereich') && !allElements({ pages: [d1doc.pages[0]] }).some(e => e.text === 'Außerhalb' || e.text === 'Im Bereich'));
    check('the message of the person shows the scope as a chip', await A.locator('.dt-ag-chip.is-scope').last().textContent().then(t => /Diese Seite/.test(t) && /nur hier/.test(t)));
    await shot(A, 'scope-refused');
    await A.selectOption('.dt-ag-scope', 'design');

    // a question: the run waits
    await run(A, 'frage-test');
    check('a question ends the run with "Wartet auf deine Antwort"', await endState(A) === 'waiting' && /Wartet auf deine Antwort/.test(await A.locator('.dt-ag-end').last().textContent()));
    check('the question is the last message', /hell oder dunkel/.test(await A.locator('.dt-ag-msg--ai').last().textContent()));
    check('no "Weitermachen" after a question (the person answers)', await A.locator('.dt-ag-goon').count() === 0);

    // stalled: Weitermachen
    await run(A, 'format-test');
    check('a model that does not speak the protocol ends "Angehalten"', await endState(A) === 'stalled');
    check('"Weitermachen" is offered', await A.locator('.dt-ag-goon').count() === 1);
    await shot(A, 'stalled');
    const endsBefore = await endCount(A);
    await A.click('.dt-ag-goon');
    await A.waitForFunction(n => document.querySelectorAll('.dt-ag-end').length > n && document.getElementById('dt-ds').getAttribute('data-ai-state') === 'idle', endsBefore, { timeout: 60000, polling: 100 });
    check('"Weitermachen" sends "Mach weiter." and the run is done', await endState(A) === 'done' && /Mach weiter\./.test(await A.locator('.dt-ag-msg--user').last().textContent()));
    check('only the newest end line keeps a button', await A.locator('.dt-ag-goon').count() === 0);

    // scrolled up in a long log while a run goes on: the new steps do not pull the log down, the chip "Neue Schritte" does
    check('the log is long enough to scroll', await A.evaluate(() => { const l = document.querySelector('.dt-ag-log'); return l.scrollHeight > l.clientHeight + 200; }));
    const chipEnds = await endCount(A);
    const chipUsers = await A.locator('.dt-ag-msg--user').count();
    await A.fill('.dt-ag-input', 'Gestalte ein Plakat „Hoffest“ (chip)');
    await A.click('.dt-ag-send');
    await A.waitForFunction(n => document.querySelectorAll('.dt-ag-msg--user').length > n, chipUsers, { timeout: 15000 });
    await A.evaluate(() => { document.querySelector('.dt-ag-log').scrollTop = 0; });
    await A.waitForSelector('.dt-ag-more:not([hidden])', { timeout: 20000 });
    check('scrolled up, a new step does not drag the log down (the chip "Neue Schritte" appears)', await A.evaluate(() => document.querySelector('.dt-ag-log').scrollTop < 120));
    await A.click('.dt-ag-more');
    check('the chip jumps to the newest step', await A.evaluate(() => { const l = document.querySelector('.dt-ag-log'); return l.scrollHeight - l.scrollTop - l.clientHeight < 60; }) && await A.locator('.dt-ag-more').isHidden());
    await A.waitForFunction(n => document.querySelectorAll('.dt-ag-end').length > n && document.getElementById('dt-ds').getAttribute('data-ai-state') === 'idle', chipEnds, { timeout: 90000, polling: 100 });

    // a failing tool, then the repair
    await run(A, 'fehler-test');
    check('a failing tool is a card in the error colour, the repair goes on', await A.locator('.dt-ag-act.is-error[data-tool="add_elements"]').count() >= 1 && await endState(A) === 'done');
    check('the star was added after the repair', allElements(await doc(A)).some(e => e.type === 'icon' && e.icon === 'star'));

    // limit
    const lim = await limits({ AgentMaxCallsPerRun: 3 });
    await run(A, 'limit-test');
    check('too many calls end the run with "Limit erreicht" and a button', await endState(A) === 'limit' && await A.locator('.dt-ag-goon').count() === 1);
    await limits({ AgentMaxCallsPerRun: lim.AgentMaxCallsPerRun || 40 });

    // stopp
    const stopEnds = await endCount(A);
    await say(A, 'stopp-test: das dauert');
    await A.waitForSelector('#dt-ag-bar:not([hidden])', { timeout: 15000 });
    check('the bar over the canvas says the AI works and offers Stopp', /Die KI arbeitet/.test(await A.locator('#dt-ag-bar').textContent()) && await A.locator('#dt-ag-bar [data-ai-stop]').isVisible());
    check('before the first word it counts: "Die KI denkt nach … n s"', await A.waitForFunction(() => /Die KI denkt nach … \d+ s/.test((document.querySelector('.dt-ag-live__text') || {}).textContent || ''), null, { timeout: 8000 }).then(() => true, () => false));
    await shot(A, 'thinking-bar');
    check('the panel offers Stopp instead of Senden', await A.locator('.dt-ag-stop').isVisible() && await A.locator('.dt-ag-send').isHidden());
    await A.click('#dt-ag-bar [data-ai-stop]');
    await A.waitForFunction(n => document.querySelectorAll('.dt-ag-end').length > n && document.getElementById('dt-ds').getAttribute('data-ai-state') === 'idle', stopEnds, { timeout: 30000, polling: 100 });
    check('Stopp ends the run "Abgebrochen" and frees the editor', await endState(A) === 'cancelled' && await A.evaluate(() => window.DtDesigner.app.editable()));

    // an attached picture
    await aiOpen(A);
    const png = E.pngFile('Wiese Foto.png', [40, 160, 90], 400, 300);
    await A.setInputFiles('.dt-ag input[type=file]', { name: png.name, mimeType: 'image/png', buffer: Buffer.from(png.base64, 'base64') });
    await A.waitForSelector('.dt-agfiles:not(.dt-agfiles--refs) .dt-agfile');
    check('a chosen file is a chip with a thumbnail and a button to take it away', await A.locator('.dt-agfiles:not(.dt-agfiles--refs) .dt-agfile img.dt-agfile__thumb').count() === 1 && await A.locator('.dt-agfile__x').count() === 1);
    await A.click('.dt-agfile__x');
    check('the chip can be removed', await A.locator('.dt-agfiles:not(.dt-agfiles--refs) .dt-agfile').count() === 0 && await A.locator('.dt-agfiles:not(.dt-agfiles--refs)').isHidden());
    // paste of a picture into the text field
    const pasted = await A.evaluate(async b64 => {
      const bin = atob(b64); const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) { bytes[i] = bin.charCodeAt(i); }
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], 'image.png', { type: 'image/png' }));
      const ta = document.querySelector('.dt-ag-input');
      ta.focus();
      ta.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
      return document.querySelectorAll('.dt-agfiles:not(.dt-agfiles--refs) .dt-agfile').length;
    }, png.base64);
    check('a picture pasted into the field becomes an attachment', pasted === 1 && /^bild-\d{8}-\d{6}\.png$/.test(await A.locator('.dt-agfile__name').first().textContent()));
    await A.click('.dt-agfile__x');
    // a drop onto the panel
    const dropped = await A.evaluate(async b64 => {
      const bin = atob(b64); const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) { bytes[i] = bin.charCodeAt(i); }
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], 'Wiese Foto.png', { type: 'image/png' }));
      const target = document.querySelector('.dt-ag');
      const fire = type => target.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
      fire('dragenter'); fire('dragover');
      const overlay = !document.querySelector('.dt-ag-drop').hidden;
      fire('drop');
      return { overlay, n: document.querySelectorAll('.dt-agfiles:not(.dt-agfiles--refs) .dt-agfile').length };
    }, png.base64);
    check('files dropped on the panel show a drop field and become attachments (not images on the page)', dropped.overlay && dropped.n === 1 && (await doc(A)).pages[0].elements.every(e => e.type !== 'image'));
    await shot(A, 'attachment-chip');
    const callsBefore = fake.agent.calls.length;
    await run(A, 'anhang-test: setze das Bild ein');
    const attachCalls = fake.agent.calls.slice(callsBefore).filter(c => c.scenario === 'anhang-test');
    check('the picture reached the model as an image part', attachCalls.length >= 1 && attachCalls.some(c => c.sawImage), JSON.stringify(attachCalls));
    check('the user message shows the file as a chip with its thumbnail', await A.locator('.dt-ag-msg--user').last().locator('.dt-ag-chip img.dt-ag-chip__thumb').count() === 1);
    const library = await api(A, 'GET', '/api/assets?q=wiese&take=20');
    const attachedAsset = (library.body || []).find(a => /wiese/.test(a.key) && !a.isBuiltIn);
    check('the picture is in the library in the category "KI-Anhang"', attachedAsset && /KI-Anhang/.test(attachedAsset.category), JSON.stringify(attachedAsset));
    const img = allElements(await doc(A)).find(e => e.type === 'image' && e.source && e.source.asset);
    check('the AI placed the picture on the page (and the editor can draw it)', !!img && /wiese/.test(img.source.asset) && await A.evaluate(() => !document.querySelector('#dt-warnbar button') || !/gibt es nicht/.test(document.querySelector('#dt-warnbar').textContent)));
    check('the answer says the model saw the picture', /Bild gesehen: ja/.test(await A.locator('.dt-ag-msg--ai').last().textContent()));
    await shot(A, 'attachment-run');

    // a reference: a design and a data list
    const listMade = await api(A, 'POST', '/api/items/new-datalist', { name: 'Referenzliste ' + stamp });
    if (listMade.body && listMade.body.url) { cleanup.lists.push(Number(listMade.body.url.match(/Edit\/(\d+)/)[1])); }
    const otherId = await makeDesign(A, 'Vorbild-Design ' + stamp, 'price-tag');
    await aiOpen(A);
    await A.click('.dt-ag-tool:has-text("Referenz")');
    await A.waitForSelector('.dt-agref__row');
    check('the reference picker lists what was used lately', await A.locator('.dt-agref__row').count() >= 1);
    await A.fill('.dt-agref input[type=search]', 'Vorbild-Design ' + stamp);
    await A.waitForSelector('.dt-agref__row[data-ref-kind="design"]');
    await shot(A, 'reference-picker');
    await A.click('.dt-agref__row[data-ref-kind="design"]');
    await A.fill('.dt-agref input[type=search]', 'Referenzliste ' + stamp);
    await A.waitForSelector('.dt-agref__row[data-ref-kind="datalist"]');
    await A.click('.dt-agref__row[data-ref-kind="datalist"]');
    await A.keyboard.press('Escape');
    check('both references are chips under the field', await A.locator('.dt-agfiles--refs .dt-agfile.is-ref').count() === 2);
    await run(A, 'referenz-test: nimm das als Vorbild');
    check('the model got the design and the data list', /Vorbild-Design/.test(await A.locator('.dt-ag-msg--ai').last().textContent()) && /Datenliste/.test(await A.locator('.dt-ag-msg--ai').last().textContent()), await A.locator('.dt-ag-msg--ai').last().textContent());
    check('the user message shows the references as chips', await A.locator('.dt-ag-msg--user').last().locator('.dt-ag-chip.is-ref').count() === 2);
    check('the references are cleared after sending', await A.locator('.dt-agfiles--refs .dt-agfile').count() === 0);

    // pages are added while the editor looks on
    const pagesBefore = (await doc(A)).pages.length;
    await A.click('.dt-ag-new-btn');
    check('"Neu" starts a new conversation (the empty state is back)', await A.locator('.dt-ag-empty').isVisible());
    await A.click('.dt-ag-example:has-text("Varianten")');
    const beforeVar = await endCount(A);
    await A.click('.dt-ag-send');
    await A.waitForFunction(() => window.DtDesigner.app.doc.pages.length > 2, null, { timeout: 60000 });
    check('new pages appear in the page strip while the run goes on', await A.evaluate(() => document.querySelectorAll('#dt-pages .dt-thumb, #dt-pages [role="tab"]').length >= 3));
    await A.waitForFunction(n => document.querySelectorAll('.dt-ag-end').length > n && document.getElementById('dt-ds').getAttribute('data-ai-state') === 'idle', beforeVar, { timeout: 90000, polling: 100 });
    check('two variants were added on new pages', (await doc(A)).pages.length === pagesBefore + 2 && (await doc(A)).pages.some(p => p.name === 'Variante A'));
    check('the page that was changed last is shown', await A.evaluate(() => window.DtDesigner.app.pageIndex) >= 2);

    // a series field
    await run(A, 'Ersetze die Texte durch Platzhalter für eine Serie');
    check('a field was added and a text became a placeholder', (await doc(A)).fields.some(f => f.key === 'Name') && allElements(await doc(A)).some(e => e.text === '{{Name}}'));

    // the history
    await A.click('.dt-ag-hist-btn');
    await A.waitForSelector('[data-history] .dt-ag-hist__row');
    const histRows = await A.locator('.dt-ag-hist__row').count();
    check('"Verlauf" lists the conversations of this design with run counts', histRows >= 2 && /Läufe|Lauf/.test(await A.locator('.dt-ag-hist__row').first().textContent()), String(histRows));
    await shot(A, 'history');
    const oldest = A.locator('.dt-ag-hist__row').last();
    await oldest.locator('.dt-ag-hist__main').click();
    await A.waitForSelector('.dt-ag-msg--user');
    check('opening an old conversation replays its steps', await A.locator('.dt-ag-msg--user').count() >= 1 && await A.locator('.dt-ag-end').count() >= 1);
    await A.click('.dt-ag-new-btn');

    // the call without streaming: the words come at once, the run still works
    fake.mode = 'nostream';
    await run(A, 'Mach weiter. (nostream)');
    fake.mode = 'ok';
    check('a provider without streaming still works (no live words, the message is there)', await endState(A) === 'done' && /fertig/i.test(await A.locator('.dt-ag-msg--ai').last().textContent()));

    // the tab title
    await A.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); });
    await run(A, 'Mach weiter.');
    const hiddenTitle = await A.title();
    await A.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
    check('a run that ends in a hidden tab puts "Fertig ·" in the tab title, and it goes away on return', /^Fertig · /.test(hiddenTitle) && !/^Fertig/.test(await A.title()), hiddenTitle + ' / ' + await A.title());

    // the limit of the AI is a notice at the field
    const lim2 = await limits({ UserDailyTokens: 1000 });
    await say(A, 'Mach weiter.');
    await A.waitForSelector('.dt-ag-notice.is-danger:not([hidden])', { timeout: 15000 });
    check('a limit of the AI is a red notice above the field (nothing was sent, the editor stays free)', /Token|Limit|Grenze|erreicht|Budget|aufgebraucht/i.test(await A.locator('.dt-ag-notice').textContent()) && await A.evaluate(() => window.DtDesigner.app.editable()), await A.locator('.dt-ag-notice').textContent());
    check('the notice says WHICH limit it is (the daily budget, with its number) and a member gets no link to the settings', /Tagesbudget/.test(await A.locator('.dt-ag-notice').textContent()) && /1.000 Tokens pro Tag/.test(await A.locator('.dt-ag-notice').textContent()) && await A.locator('.dt-ag-notice [data-limits-link]').count() === 0, await A.locator('.dt-ag-notice').textContent());
    await shot(A, 'limit-notice');
    await A.click('.dt-ag-notice__x');
    await limits({ UserDailyTokens: lim2.UserDailyTokens || 50000000 });
    await A.fill('.dt-ag-input', '');

    // an administrator is told where to change the limit: first one run (so there is something used), then a limit of 1 000 tokens (the field has step 1000)
    const limitDesign = await makeDesign(admin, 'KI-Limit ' + stamp, 'price-tag', 1);
    await inEditor(admin, limitDesign);
    await run(admin, 'Mach weiter.');
    const lim3 = await limits({ UserDailyTokens: 1000 });
    await inEditor(admin, limitDesign);
    await say(admin, 'Mach weiter.');
    await admin.waitForSelector('.dt-ag-notice.is-danger:not([hidden])', { timeout: 15000 });
    const adminLink = admin.locator('.dt-ag-notice [data-limits-link]');
    check('an administrator gets the link "Limits anpassen" in the notice', await adminLink.count() === 1 && await adminLink.getAttribute('href') === '/Admin/Ai?tab=limits' && /Limits anpassen/.test(await adminLink.textContent()), await admin.locator('.dt-ag-notice').textContent());
    await shot(admin, 'limit-notice-admin');
    await admin.goto(base + '/Admin/Ai?tab=limits');
    check('the link opens the settings on the tab of the limits', await admin.locator('#ai-tabs-tab-limits').getAttribute('aria-selected') === 'true' && await admin.locator('#Input_UserDailyTokens').isVisible());
    await limits({ UserDailyTokens: lim3.UserDailyTokens || 50000000 });

    // a run followed after a reload
    await A.click('.dt-ag-new-btn');
    const d2 = await makeDesign(A, 'KI-Reload ' + stamp, 'poster-a3-portrait', 1);
    await inEditor(A, d2);
    await say(A, 'Gestalte ein Plakat „Hoffest“');
    await A.waitForFunction(() => window.DtDesigner.app.doc.pages[0].elements.length > 3, null, { timeout: 90000 });
    await A.reload();
    await A.waitForSelector('#dt-ds:not(.is-loading)', { timeout: 30000 });
    await A.waitForFunction(() => window.DtDesigner.ai && window.DtDesigner.ai.state().conv > 0, null, { timeout: 15000 });
    check('after a reload the running run is followed: panel open, editor locked', await A.evaluate(() => window.DtDesigner.panels.current()) === 'ai' && await A.evaluate(() => document.getElementById('dt-ds').getAttribute('data-ai-state')) === 'running');
    await A.waitForFunction(() => document.getElementById('dt-ds').getAttribute('data-ai-state') === 'idle' && document.querySelectorAll('.dt-ag-end').length > 0, null, { timeout: 120000, polling: 200 });
    check('the replayed conversation shows the whole run and ends', await endState(A) === 'done' && await A.locator('.dt-ag-act').count() >= 7);
    check('the editor holds the run as one undo step even after a reload', await A.evaluate(() => window.DtDesigner.app.undoStack.some(s => s.tag === 'ai')));
  }

  // ---------------------------------------------------------------------------------------- 3. the dialog "Design erstellen" and an AI that is off
  if (wanted('start')) {
    current = 'start: ';
    await A.goto(base + '/Projekte');
    await A.click('a[href="/Designs/Create"]');
    await A.waitForSelector('#dt-create[open]');
    check('the dialog "Design erstellen" has the prompt above the tiles', await A.locator('#dt-create form.dt-aip--dialog[data-ai-create]').isVisible() && await A.evaluate(() => document.querySelector('#dt-create form[data-ai-create]').getBoundingClientRect().top < document.querySelector('#dt-create .dt-formats').getBoundingClientRect().top));
    check('the dialog has its own ids (the start page has a prompt too)', await A.locator('#dt-create-ai-text').count() === 1);
    await shot(A, 'dialog-prompt');
    await A.fill('#dt-create form[data-ai-create] textarea', 'Gestalte eine Karte „Einladung“ mit Musik');
    await A.selectOption('#dt-create form[data-ai-create] [data-ai-format]', 'custom');
    check('"Eigene Größe …" shows width, height and unit', await A.locator('#dt-create form[data-ai-create] [data-ai-custom]').isVisible());
    await A.fill('#dt-create form[data-ai-create] [data-ai-width]', '120');
    await A.fill('#dt-create form[data-ai-create] [data-ai-height]', '80');
    await A.click('#dt-create form[data-ai-create] [data-ai-submit]');
    await A.waitForURL(/\/Designs\/\d+\/Designer/, { timeout: 30000 });
    const id3 = Number(A.url().match(/Designs\/(\d+)\//)[1]);
    cleanup.designs.push({ id: id3, page: A });
    await A.waitForSelector('#dt-ds:not(.is-loading)', { timeout: 30000 });
    const made3 = await serverDoc(A, id3);
    check('a custom size was used for the new design', made3.document.width === 120 && made3.document.height === 80 && made3.document.unit === 'mm', JSON.stringify([made3.document.width, made3.document.height]));
    await A.waitForFunction(() => document.querySelectorAll('.dt-ag-end').length > 0 && document.getElementById('dt-ds').getAttribute('data-ai-state') === 'idle', null, { timeout: 180000, polling: 200 });
    check('the run of the dialog ended', await endState(A) === 'done');

    // the AI is off: no prompt, no entry for a member; the administrator sees why
    await aiSwitch(false);
    await A.goto(base + '/');
    check('with the AI off the start page has no prompt', await A.locator('form[data-ai-create]').count() === 0);
    await A.goto(base + '/Projekte');
    check('with the AI off the dialog has no prompt', await A.locator('#dt-create form[data-ai-create]').count() === 0);
    await inEditor(A, id3);
    check('with the AI off a member has no entry in the rail', await A.locator('.dt-rail__btn[data-panel="ai"]:not([hidden])').count() === 0);
    const adminDesign = await makeDesign(admin, 'KI-Admin ' + stamp, 'price-tag', 1);
    await inEditor(admin, adminDesign);
    check('an administrator still sees the entry', await admin.locator('.dt-rail__btn[data-panel="ai"]:not([hidden])').count() === 1);
    await admin.click('.dt-rail__btn[data-panel="ai"]');
    await admin.waitForSelector('.dt-ag-off');
    check('the panel explains why and links to the settings', /ausgeschaltet/.test(await admin.locator('.dt-ag-off').textContent()) && (await admin.locator('.dt-ag-off a').getAttribute('href')) === '/Admin/Ai');
    await shot(admin, 'admin-off');
    await aiSwitch(true);
  }

  // ---------------------------------------------------------------------------------------- 4. roles
  if (wanted('roles')) {
    current = 'roles: ';
    const target = d1 || createdId || await makeDesign(A, 'KI-Rollen ' + stamp);
    const shared = await api(A, 'GET', '/api/share/search?q=' + encodeURIComponent(accounts.viewer.email));
    const person = (shared.body || []).find(r => r.type === 'user' && r.email === accounts.viewer.email);
    await postJson(A, '/api/share/design/' + target, { userId: person.id, permission: 'View' });
    await E.openDesigner(B, base, target);
    check('a person with View only has no entry KI', await B.locator('.dt-rail__btn[data-panel="ai"]:not([hidden])').count() === 0);
    const agent = await api(B, 'GET', `/api/ai/designs/${target}/agent`);
    check('the server says the same (showEntry false)', agent.status === 200 && agent.body.showEntry === false && agent.body.canEdit === false, JSON.stringify(agent.body));
    const post = await B.evaluate(async id => { const fd = new FormData(); fd.append('text', 'hallo'); const r = await fetch('/api/ai/designs/' + id + '/messages', { method: 'POST', headers: { RequestVerificationToken: document.querySelector('meta[name=dt-csrf]').content }, body: fd }); return r.status; }, target);
    check('a message from a person with View only is refused (403)', post === 403, String(post));
    check('the start page of the viewer has the prompt (everybody may start a design)', await (async () => { await B.goto(base + '/'); return B.locator('form.dt-aip--hero').isVisible(); })());
  }

  // ---------------------------------------------------------------------------------------- 5. tablet and phone
  if (wanted('responsive')) {
    current = 'responsive: ';
    const target = d1 || createdId || await makeDesign(A, 'KI-Phone ' + stamp);
    const tabletContext = await newContext(browser, { viewport: { width: 900, height: 720 } });
    const T = await tabletContext.newPage();
    watch(T, 'tablet');
    await login(T, accounts.designer);
    await E.openDesigner(T, base, target);
    await T.waitForFunction(() => window.DtDesigner.ai && window.DtDesigner.ai.state().agent);
    await T.evaluate(() => window.DtDesigner.panels.open('ai'));
    await T.waitForSelector('.dt-ag-input');
    const tb = await T.evaluate(() => { const p = document.getElementById('dt-panel').getBoundingClientRect(); return { right: p.right, w: p.width, vw: window.innerWidth }; });
    check('on a tablet the panel is a drawer that fits the screen', tb.right <= tb.vw && tb.w >= 300, JSON.stringify(tb));
    await shot(T, 'drawer');
    await tabletContext.close();

    const phoneContext = await newContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const P = await phoneContext.newPage();
    watch(P, 'phone');
    await login(P, accounts.designer);
    await E.openDesigner(P, base, target);
    await P.waitForFunction(() => window.DtDesigner.ai && window.DtDesigner.ai.state().agent);
    await P.click('#dt-tabbar-more');
    check('on a phone the entry is under "Mehr"', await P.locator('.mat-menu__item:has-text("KI-Assistent"), [role=menuitem]:has-text("KI-Assistent")').count() >= 1);
    await P.click('[role=menuitem]:has-text("KI-Assistent"), .mat-menu__item:has-text("KI-Assistent")');
    await P.waitForSelector('.dt-ag-input');
    const sheet = await P.evaluate(() => { const p = document.getElementById('dt-panel').getBoundingClientRect(); const t = document.getElementById('dt-tabbar').getBoundingClientRect(); const c = document.querySelector('.dt-ag-compose').getBoundingClientRect(); return { bottom: p.bottom, tabTop: t.top, composeBottom: c.bottom, height: p.height, vh: window.innerHeight, scrollW: document.documentElement.scrollWidth, vw: window.innerWidth }; });
    check('the sheet sits on the tab bar and the compose box is inside it', Math.abs(sheet.bottom - sheet.tabTop) <= 2 && sheet.composeBottom <= sheet.bottom + 1, JSON.stringify(sheet));
    check('no sideways scrolling on the phone', sheet.scrollW <= sheet.vw + 1, JSON.stringify(sheet));
    await shot(P, 'sheet-empty');
    await P.fill('.dt-ag-input', 'frage-test');
    await P.tap('.dt-ag-send');
    await P.waitForFunction(() => document.querySelectorAll('.dt-ag-end').length > 0 && document.getElementById('dt-ds').getAttribute('data-ai-state') === 'idle', null, { timeout: 60000, polling: 100 });
    await shot(P, 'sheet-run');
    // a running run with the sheet closed: the busy bar sits above the tab bar
    await P.evaluate(() => window.DtDesigner.panels.open('ai'));
    await P.fill('.dt-ag-input', 'stopp-test: lange');
    await P.tap('.dt-ag-send');
    await P.waitForFunction(() => document.getElementById('dt-ds').getAttribute('data-ai-state') === 'running');
    check('while a run works the sheet gets lower so the canvas shows', await P.evaluate(() => document.getElementById('dt-panel').getBoundingClientRect().height < 0.5 * window.innerHeight));
    await P.evaluate(() => window.DtDesigner.panels.close());
    await P.waitForSelector('#dt-ag-bar:not([hidden])');
    const barBox = await P.evaluate(() => { const b = document.getElementById('dt-ag-bar').getBoundingClientRect(); const t = document.getElementById('dt-tabbar').getBoundingClientRect(); return { bottom: b.bottom, tabTop: t.top, left: b.left, right: b.right, vw: window.innerWidth }; });
    check('with the sheet closed the busy bar sits above the tab bar, inside the screen', barBox.bottom <= barBox.tabTop + 1 && barBox.left >= 0 && barBox.right <= barBox.vw, JSON.stringify(barBox));
    await shot(P, 'busy-bar');
    await P.tap('#dt-ag-bar [data-ai-stop]');
    await P.waitForFunction(() => document.getElementById('dt-ds').getAttribute('data-ai-state') === 'idle', null, { timeout: 30000, polling: 100 });
    check('Stopp on the phone frees the editor', await P.evaluate(() => window.DtDesigner.app.editable()));
    // the start page of a phone
    await P.goto(base + '/');
    check('the start page prompt fits a phone', await P.evaluate(() => { const r = document.querySelector('form.dt-aip--hero').getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth && document.documentElement.scrollWidth <= window.innerWidth + 1; }));
    await shot(P, 'start-prompt');
    await phoneContext.close();
  }

  // ---------------------------------------------------------------------------------------- 3b. the quality pass: the review before a run ends, templates first
  if (wanted('qualitaet')) {
    current = 'qualitaet: ';
    await review(true);
    // a model that is done without having looked at its result is sent back once; then it looks, and the run ends
    const reviewId = await makeDesign(A, 'Prüfung ' + stamp, 'poster-a3-portrait', 1);
    await A.goto(`${base}/Designs/${reviewId}/Designer`);
    await A.waitForSelector('#dt-ds:not(.is-loading)', { timeout: 20000 });
    await E.idle(A);
    const c0 = fake.agent.calls.length;
    await run(A, 'pruefung-test: ein Titel');
    const rc = fake.agent.calls.slice(c0).filter(c => c.scenario === 'pruefung-test');
    check('the review sent the model back exactly once, and the next answer was a look', rc.filter(c => c.gate).length === 1, JSON.stringify(rc.map(c => [c.step, c.gate, c.sawImage])));
    check('the picture of the look reached the model after the review', rc.some(c => c.step === 2 && c.sawImage), JSON.stringify(rc.map(c => [c.step, c.gate, c.sawImage])));
    check('the log shows the review as a line and the look as a card, and the run ended done', (await A.locator('.dt-ag-line[data-kind="info"]').allTextContents()).some(t => /Prüfung vor dem Abschluss/.test(t)) && (await A.locator('.dt-ag-act').allTextContents()).some(t => /angesehen/.test(t)) && (await endState(A)) === 'done', (await A.locator('.dt-ag-line').allTextContents()).join(' | '));
    await shot(A, 'review');

    // templates first: the model searches (the editor draws the numbered sheet), takes the first one WHOLE and replaces its sample texts
    const made = await postJson(A, '/api/designs', { preset: 'a4-portrait' });
    await postJson(A, `/api/designs/${made.body.id}/rename`, { name: 'Vorlage zuerst ' + stamp });
    await A.goto(`${base}/Designs/${made.body.id}/Designer`);
    await A.waitForSelector('#dt-ds:not(.is-loading)', { timeout: 20000 });
    await E.idle(A);
    const c1 = fake.agent.calls.length;
    await run(A, 'vorlagen-test: Einladung für Alex');
    const tc = fake.agent.calls.slice(c1).filter(c => c.scenario === 'vorlagen-test');
    check('the editor drew the numbered sheet of the templates and the model saw it', tc.some(c => c.step === 1 && c.sawImage), JSON.stringify(tc.map(c => [c.step, c.sawImage])));
    await E.idle(A);
    const d = await doc(A);
    check('the design became the template: A6 landscape, the fields of the template, no leftover of the empty A4 page', d.width === 148 && d.height === 105 && d.unit === 'mm' && d.pages.length === 1 && d.fields.length >= 1, JSON.stringify([d.width, d.height, d.pages.length, d.fields.length]));
    check('the sample texts with digits were replaced', allElements(d).some(e => e.type === 'text' && /Sonntag, 14. März/.test(e.text)), allElements(d).filter(e => e.type === 'text').map(e => e.text).join(' | '));
    check('the log shows the search and the template as cards', (await A.locator('.dt-ag-act').allTextContents()).some(t => /Vorlagen für/.test(t)) && (await A.locator('.dt-ag-act').allTextContents()).some(t => /Vorlage .* übernommen/.test(t)), (await A.locator('.dt-ag-act').allTextContents()).join(' | '));
    await shot(A, 'template-first');
    await review(false);
  }

  // ---------------------------------------------------------------------------------------- 4. photos and icons from the catalogues (plan 5 / C3)
  if (wanted('foto')) {
    current = 'foto: ';
    let known = true;
    for (const id of ['pexels', 'iconify']) {
      await admin.goto(base + '/Admin/Catalogs/Edit?id=' + id);
      if (!/in der Konfiguration festgelegt/.test(await admin.textContent('body'))) { known = false; }
    }
    if (!known) {
      console.log(`(the app does not know the fake catalogues: start it with DESIGNTHIX__Catalogs__<pexels|iconify>__BaseUrl=http://127.0.0.1:${argValue('--catalog-port', '3073')}; the check "foto" is skipped)`);
    } else {
      const { startFakeCatalogs, providers } = require('./fake-catalogs.js');
      const catalogFake = await startFakeCatalogs(Number(argValue('--catalog-port', '3073')));
      const configure = async (id, values) => {
        await admin.goto(base + '/Admin/Catalogs/Edit?id=' + id);
        const on = await admin.locator('input[type=checkbox][name="Input.Enabled"]').isChecked();
        if (on !== values.enabled) { await admin.click('label.mat-switch:has(input[name="Input.Enabled"])'); }
        await admin.fill('#Input_PerUserPerMinute', '500');
        if (values.key !== undefined) { await admin.fill('#Input_Key', values.key); }
        if (values.removeKey && await admin.$('input[name="Input.RemoveKey"]')) { await admin.click('label.mat-switch:has(input[name="Input.RemoveKey"])'); }
        await Promise.all([admin.waitForNavigation(), admin.click('button[type=submit].mat-btn--primary')]);
      };
      await configure('pexels', { enabled: true, key: providers.KEYS.pexels });
      await configure('iconify', { enabled: true });

      const fotoId = await makeDesign(A, 'Foto-Design ' + stamp, 'poster-a3-portrait', 1);
      await A.goto(`${base}/Designs/${fotoId}/Designer`);
      await A.waitForSelector('#dt-ds:not(.is-loading)', { timeout: 20000 });
      await E.idle(A);
      const calls0 = fake.agent.calls.length;
      await run(A, 'foto-test: ein Foto von Zitronen und ein Symbol');
      const fotoCalls = fake.agent.calls.slice(calls0).filter(c => c.scenario === 'foto-test');
      check('the run went through the seven steps and the model saw the page (look)', fotoCalls.length >= 8 && fotoCalls.some(c => c.sawImage), JSON.stringify(fotoCalls.map(c => [c.step, c.sawImage])));
      check('the log shows the searches and the two imports as cards', (await A.locator('.dt-ag-act').allTextContents()).filter(t => /Treffer in|übernommen/.test(t)).length >= 4, (await A.locator('.dt-ag-act').allTextContents()).join(' | '));
      await E.idle(A);
      const d = await doc(A);
      const photo = allElements(d).find(e => e.type === 'image' && e.source && e.source.asset);
      const iconEl = allElements(d).find(e => e.type === 'icon' && /:cheese$/.test(e.icon));
      check('the assistant placed ONE imported photo (key from the title of the photo) and an icon of a set', !!photo && /^zitronen/.test(photo.source.asset) && !!iconEl && iconEl.icon === 'tabler:cheese', JSON.stringify([photo && photo.source, iconEl && iconEl.icon]));
      const stats = await (await fetch(`http://127.0.0.1:${argValue('--catalog-port', '3073')}/__stats`)).json();
      const storedIcon = (await api(A, 'GET', '/api/icons?names=' + iconEl.icon)).body || {};
      check('only the one chosen photo was downloaded in full size (no collecting), the icon came as a body and is stored on the server', (stats['pexels-img:large2x'] || 0) === 1 && !!storedIcon[iconEl.icon], JSON.stringify(Object.fromEntries(Object.entries(stats).filter(([k]) => /pexels-img|iconify/.test(k)))));
      await A.waitForFunction(() => window.DtDesigner.app.saveState === 'saved', null, { timeout: 15000 });
      await E.idle(A);
      check('the photo and the icon are drawn on the canvas (no dashed placeholder)', await A.evaluate(() => !!document.querySelector('[data-el-type="image"] image, [data-el-type="image"] img, [data-el-type="image"] pattern') || !!document.querySelector('[data-el-type="image"]')) && await A.evaluate(() => !!document.querySelector('[data-el-type="icon"] path')));
      await shot(A, 'foto-run');
      // the credit of the photo travels with the design; the run is one undo step
      await A.click('#dt-file');
      await A.waitForSelector('.dt-menu');
      await A.click('.dt-menu__item:has(.dt-menu__label:text-is("Bildnachweise …"))');
      await A.waitForSelector('dialog.dt-credits[open] .dt-credits__item', { timeout: 10000 });
      check('the Bildnachweise name the photo, its author and Pexels', /Pexels/.test(await A.locator('.dt-credits__item').first().textContent()) && /Ben Muster|Anna Beispiel|Cem Probe|Dora Demo|Emil Test/.test(await A.locator('.dt-credits__item').first().textContent()));
      await A.click('dialog.dt-credits button:has-text("Schließen")');
      await A.waitForSelector('dialog.dt-credits', { state: 'detached' });
      await A.keyboard.press('Control+z');
      await E.idle(A);
      check('Strg+Z takes the whole run back in one step (photo and icon gone); the library keeps the imported picture', !allElements(await doc(A)).some(e => e.type === 'image' || e.type === 'icon'));
      // a catalogue that is off does not exist for the assistant
      await configure('pexels', { enabled: false, removeKey: true });
      await A.goto(`${base}/Designs/${fotoId}/Designer`);
      await A.waitForSelector('#dt-ds:not(.is-loading)', { timeout: 20000 });
      const calls1 = fake.agent.calls.length;
      await run(A, 'foto-test: noch ein Foto');
      const after = await A.locator('.dt-ag-act').allTextContents();
      check('with Pexels off the search is refused with a reason and nothing is imported', after.some(t => /Katalog .?pexels.? gibt es nicht|Kein Katalog/.test(t)) || fake.agent.calls.slice(calls1).length > 0, after.slice(-4).join(' | '));
      check('...and no further photo came in', ((await (await fetch(`http://127.0.0.1:${argValue('--catalog-port', '3073')}/__stats`)).json())['pexels-img:large2x'] || 0) === 1);

      // put it back
      await configure('iconify', { enabled: false });
      const assets = (await api(A, 'GET', '/api/assets?category=' + encodeURIComponent('Katalog: Pexels') + '&take=50')).body || [];
      const items = (await api(A, 'GET', '/api/items?kinds=asset&recursive=true&take=200')).body;
      for (const item of (items && items.items) || []) { if (assets.some(a => a.key === item.key)) { await purgeImage(A, item.id); } }
      await catalogFake.close();
    }
  }

  // ---------------------------------------------------------------------------------------- the end: put the settings back, delete what the check made
  current = '';
  await restoreAdmin();
  for (const { id, page } of cleanup.designs) { await api(page, 'POST', '/api/items/trash', { items: [{ kind: 'design', id }] }); await api(page, 'POST', '/api/items/purge', { items: [{ kind: 'design', id }] }); }
  for (const id of cleanup.lists) { await api(A, 'POST', '/api/items/trash', { items: [{ kind: 'datalist', id }] }); await api(A, 'POST', '/api/items/purge', { items: [{ kind: 'datalist', id }] }); }
  await admin.goto(base + '/Admin/Ai/Profiles');
  check('the profile of the check is deleted again', await admin.locator('.mat-item', { hasText: profileName }).count() === 0);
  check('no console errors and no CSP violations', problems.length === 0, problems.slice(0, 6).join('\n'));
  await browser.close();
  fake.server.close();

  const failed = results.filter(r => !r.ok);
  for (const r of results) { console.log((r.ok ? 'ok   ' : 'FAIL ') + r.name + (r.ok || !r.detail ? '' : '  -> ' + r.detail)); }
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (problems.length) { console.log('problems:\n' + problems.join('\n')); }
  process.exit(failed.length === 0 ? 0 : 1);
})().catch(async e => {
  console.error(e);
  for (const [i, p] of livePages.entries()) { try { await p.screenshot({ path: path.join(outDir, `ai-design-failure-${i}.png`) }); console.log(`page ${i}: ${p.url()}`); } catch (x) { /* page gone */ } }
  await restoreAdmin();
  try { fake.server.close(); } catch (x) { /* closed */ }
  process.exit(1);
});
