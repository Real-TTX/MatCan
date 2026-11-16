#!/usr/bin/env node
/* Evaluation of the design assistant (docs/PLAN-AI-DESIGN.md, "Quality pass"): sends a fixed set of prompts through the REAL assistant of a running app (a copy of a stack that has a working AI profile; never the
   owner's own stack), waits for every run to end, draws every result with the engine in the editor (so what you see is what a person sees) and writes a contact sheet to LOOK at. Nothing is judged by a script:
   the pictures are read by a person, the numbers (calls, tools, looks, tokens, lint warnings left, end state) are there to see what the model did.

     node tools/ai-eval.js <base url> --email <admin> --password <pw> [--out <folder>] [--label round1] [--set a|b|c|all] [--only dino,trampolin] [--concurrency 3] [--limits] [--timeout 25]
       --limits      raises the budgets of the AI in the settings of THIS app first (a run is many calls); never use it on a stack that is not a copy
       --set         a = the 15 prompts of the owner's review, b = ten more (other subjects, to keep the changes honest), c = eight harder ones (no template fits, English, a vague request ...), all = all three
   Output (in <out>/<label>): <id>-p<page>.png per page, <id>-steps.json (what the model did), results.json, contact.png (the first pages side by side with the key numbers), contact-<n>.png when large.
   The account may be an administrator (it needs nothing else); credentials come from the arguments or DT_EVAL_EMAIL / DT_EVAL_PASSWORD, never from the repository. Playwright comes from tests/e2e/node_modules. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', 'tests', 'e2e', 'node_modules', 'playwright'));

const args = process.argv.slice(2);
const argValue = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const base = (args.find(a => /^https?:/.test(a)) || 'http://localhost:3066').replace(/\/$/, '');
const email = argValue('--email', process.env.DT_EVAL_EMAIL || '');
const password = argValue('--password', process.env.DT_EVAL_PASSWORD || '');
const label = argValue('--label', 'run');
const out = path.resolve(argValue('--out', path.join(os.tmpdir(), 'designthix-ai-eval')), label);
const concurrency = Number(argValue('--concurrency', '3'));
const timeoutMinutes = Number(argValue('--timeout', '25'));
const only = argValue('--only', '') ? argValue('--only', '').split(',') : null;
const set = argValue('--set', 'a');
const raiseLimits = args.includes('--limits');

/** The prompts. `preset` empty = "Automatisch" (the model picks the format, as on the start page). `edit` = an existing design made from a template, then the message. */
const SET_A = [
  { id: 'dino', text: 'Mach mir eine Einladungskarte für eine Dinosaurier-Party. Alex wird 9!' },
  { id: 'trampolin', text: 'Mach mir eine Einladungskarte für ein Trampolin Geburtstag in der Sprungarena Brackenheim am 11.11.2027 für Jürgen, der wird 12!' },
  { id: 'visitenkarte', text: 'Visitenkarte für Petra Wagner, Physiotherapeutin, Praxis am Markt, Marktplatz 4, 74072 Heilbronn, Telefon 07131 123456, petra@wagner-physio.example', preset: 'business-card' },
  { id: 'hochzeit-boho', text: 'Hochzeitseinladung im Boho-Stil für Lena und Max, Samstag, 12. Juni 2027, 14 Uhr, Gutshof Eichenhain in Heilbronn, Antwort bitte bis 1. Mai' },
  { id: 'flohmarkt', text: 'Flyer für unseren Flohmarkt am 14. September 2027 von 9 bis 15 Uhr auf dem Schulhof der Grundschule Nordheim. Standgebühr 5 Euro, Kaffee und Kuchen gibt es auch.' },
  { id: 'preisschild-kaese', text: 'Preisschild für Bergkäse: 100 g 2,99 €, Herkunft Allgäu, 6 Monate gereift, Kuhmilch', preset: 'price-tag' },
  { id: 'insta-cafe', text: 'Instagram-Post für das Café Sonnenschein: Frühstück mit Cappuccino und Croissant nur 4,50 € bis Sonntag', preset: 'instagram-post' },
  { id: 'danke-hochzeit', text: 'Danke-Karte nach unserer Hochzeit von Anna und Jonas, wir bedanken uns für die Glückwünsche und Geschenke' },
  { id: 'kinderfasching', text: 'Einladung zum Kinderfasching der Kita Regenbogen am Freitag, 28. Februar 2027 um 15 Uhr im Gemeindehaus Neckarwestheim. Bitte verkleiden!' },
  { id: 'firmenfest-a3', text: 'Plakat für das Sommerfest der Firma Müller & Söhne am 18. Juli 2027 ab 16 Uhr: Grillen, Live-Musik, Hüpfburg für die Kinder', preset: 'poster-a3-portrait' },
  { id: 'speisekarte', text: 'Speisekarte für die Pizzeria Bella Napoli: Pizza Margherita 8,50 €, Pizza Salami 9,50 €, Pizza Quattro Formaggi 11,00 €, Spaghetti Carbonara 10,50 €, Lasagne 11,50 €, Tiramisu 5,50 €, Panna Cotta 5,00 €, Getränke ab 3,00 €', preset: 'menu-dl' },
  { id: 'urkunde', text: 'Urkunde für Mia Schneider für den 1. Platz beim Vereinsturnier des TSV Nordheim 2027', preset: 'certificate-a4' },
  { id: 'vereinsfest', text: 'Flyer für das Sommerfest des Gesangvereins Harmonie Nordheim am 27. Juni 2027: Festzelt am Sportplatz, Beginn 11 Uhr, Mittagstisch, Tombola, Kaffee und Kuchen' },
  { id: 'geburtstag-80', text: 'Geburtstagskarte zum 80. Geburtstag für meine Oma Hildegard, herzlich und gut lesbar' },
  { id: 'edit-titel-logo', text: 'Mach den Titel größer und füge ein Logo-Feld hinzu', edit: { template: 'Flyer A5 – Wochenangebot' } },
];

const SET_B = [
  { id: 'halloween', text: 'Einladung zur Halloween-Party bei Familie Krause am 31. Oktober 2027 ab 18 Uhr, Kostüm Pflicht, Schaurige Snacks' },
  { id: 'weltall', text: 'Einladung zum Weltraum-Geburtstag von Lukas (7) am Samstag, 5. März 2027, 14 Uhr, Spielplatz am Neckar. Bitte bis 1. März Bescheid geben.' },
  { id: 'pferde', text: 'Einladung zum Reiterhof-Geburtstag von Sophie (10), am 22. Mai 2027 ab 11 Uhr auf dem Ponyhof Sonnenhang in Lauffen, Telefon 07133 4567' },
  { id: 'yoga-flyer', text: 'Flyer für den neuen Yoga-Kurs im Studio Atem in Bad Wimpfen: dienstags 18:30 Uhr, ab 5. April 2027, 10 Termine für 120 €, Anmeldung unter info@studio-atem.example' },
  { id: 'weihnachtsmarkt', text: 'Plakat für den Weihnachtsmarkt in Eppingen am 3. und 4. Dezember 2027, Marktplatz, 11 bis 20 Uhr, Glühwein, Kunsthandwerk, Kinderkarussell', preset: 'poster-a3-portrait' },
  { id: 'gutschein', text: 'Geschenkgutschein für das Blumenhaus Rosenblatt im Wert von 25 Euro, gültig bis 31.12.2027', preset: 'voucher-dl' },
  { id: 'insta-sale', text: 'Instagram-Post für den Sommerschlussverkauf bei Mode Lindner: bis zu 50 % auf die gesamte Sommerkollektion, nur diese Woche', preset: 'instagram-post' },
  { id: 'taufe', text: 'Einladung zur Taufe von Emma am Sonntag, 8. August 2027 um 10:30 Uhr in der Kirche St. Peter in Löwenstein, anschließend Mittagessen im Gasthaus Krone' },
  { id: 'rennauto', text: 'Einladung zum Rennfahrer-Geburtstag von Ben (6) am 13. März 2027 um 15 Uhr in der Kartbahn Speedpark Neckarsulm' },
  { id: 'edit-farben', text: 'Gestalte das Design in warmen Herbstfarben um und ersetze die Texte durch eine Einladung zum Erntedankfest am 3. Oktober 2027, 11 Uhr, im Gemeindehaus.', edit: { template: 'Flyer A5 – Wochenangebot' } },
];

// harder ones: no template fits, a series name badge, English, a vague request (the model should ask), a price list, a round label, a translation of an existing design
const SET_C = [
  { id: 'ausstellung', text: 'Plakat für eine Ausstellung über Pilze im Naturkundemuseum Stuttgart, 14. bis 28. März 2027, Eintritt frei, täglich 10 bis 18 Uhr', preset: 'poster-a3-portrait' },
  { id: 'namensschild', text: 'Namensschild für eine Konferenz: Name, Firma und ein Feld für das Logo, damit ich es für alle Teilnehmer aus einer Liste drucken kann', preset: 'name-badge' },
  { id: 'englisch', text: 'Birthday card for my friend Tom who turns 30, funny, with a cake' },
  { id: 'vage', text: 'Mach was Schönes für unser Fest' },
  { id: 'hundesalon', text: 'Flyer für unseren Hundesalon Pfötchen in Neckarsulm, Hauptstraße 12: Waschen 25 €, Schneiden 35 €, Komplett 55 €, Termine unter 07132 98765' },
  { id: 'marmelade', text: 'Etikett für selbstgemachte Erdbeermarmelade, Ernte 2027, mit Liebe gekocht', preset: 'label-round-60' },
  { id: 'edit-englisch', text: 'Übersetze alle Texte ins Englische und behalte das Layout', edit: { template: 'Flyer A5 – Wochenangebot' } },
  { id: 'silberhochzeit', text: 'Einladung zur Silberhochzeit von Renate und Klaus am 19. September 2027 um 17 Uhr im Landgasthof Adler in Neuenstadt, mit Abendessen und Tanz' },
];

const PROMPTS = set === 'b' ? SET_B : set === 'c' ? SET_C : set === 'all' ? [...SET_A, ...SET_B, ...SET_C] : SET_A;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function api(page, method, url, body) {
  return page.evaluate(async ({ method: m, url: u, body: b }) => {
    const token = document.querySelector('meta[name=dt-csrf]');
    const headers = { Accept: 'application/json' };
    let payload;
    if (m !== 'GET') {
      headers.RequestVerificationToken = token ? token.content : '';
      if (b instanceof Object && b.__form) { payload = new FormData(); for (const [k, v] of Object.entries(b.__form)) { if (v !== undefined && v !== null) { payload.append(k, v); } } }
      else { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(b || {}); }
    }
    const r = await fetch(u, { method: m, headers, body: payload });
    let json = null;
    try { json = await r.json(); } catch (e) { /* no body */ }
    return { status: r.status, body: json };
  }, { method, url, body });
}

async function raiseTheLimits(page) {
  await page.goto(base + '/Admin/Ai');
  await page.click('#ai-tabs-tab-limits');
  const values = { UserDailyTokens: 2000000000, UserMonthlyTokens: 2000000000, MonthlyTokens: 2000000000, AddressDailyRuns: 5000, PerMinutePerAddress: 600, AgentMaxLooks: 8 };
  for (const [key, value] of Object.entries(values)) { await page.fill('#Input_' + key, String(value)); }
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit].mat-btn--primary')]);
  log('limits raised in the settings of', base);
}

/** The pictures of a design as the editor draws them (sample values), one PNG per page. */
async function renderPages(page, designId, folder, id, suffix) {
  await page.goto(`${base}/Designs/${designId}/Designer`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.DtDesigner && window.DtDesigner.app && window.DtDesigner.app.doc && window.DtEngine, null, { timeout: 60000 });
  await page.evaluate(async () => { await document.fonts.ready; });
  await sleep(1500);
  const pages = await page.evaluate(async () => {
    const D = window.DtDesigner;
    const app = D.app;
    const result = [];
    for (let i = 0; i < app.doc.pages.length; i++) {
      const blob = await window.DtEngine.rasterize(app.doc, app.computeValues(), { page: i, maxWidth: 1000, format: 'png', assetUrl: app.assetUrl, fonts: app.fonts, icon: D.icons.body });
      const data = await new Promise(resolve => { const r = new FileReader(); r.onloadend = () => resolve(String(r.result).split(',')[1]); r.readAsDataURL(blob); });
      result.push({ name: app.doc.pages[i].name || '', data });
    }
    return { pages: result, doc: app.doc };
  });
  const files = [];
  pages.pages.forEach((p, i) => {
    const file = path.join(folder, `${id}${suffix || ''}-p${i + 1}.png`);
    fs.writeFileSync(file, Buffer.from(p.data, 'base64'));
    files.push(file);
  });
  return { files, doc: pages.doc };
}

const count = list => list.reduce((n, e) => n + 1 + (e.children ? count(e.children) : 0), 0);

async function waitIdle(page, conversationId, deadline) {
  for (;;) {
    const r = await api(page, 'GET', `/api/ai/conversations/${conversationId}`);
    if (r.status === 200 && r.body && r.body.status === 'Idle' && r.body.runs.length > 0) { return r.body; }
    if (Date.now() > deadline) { return null; }
    await sleep(2500);
  }
}

async function oneRun(context, item, folder) {
  const started = Date.now();
  const page = await context.newPage();
  const result = { id: item.id, prompt: item.text, state: 'error', note: '' };
  try {
    await page.goto(base + '/', { waitUntil: 'load' });
    let designId, conversationId, before = null;
    if (item.edit) {
      const all = await api(page, 'GET', '/api/templates');
      const template = (all.body || []).find(t => t.name === item.edit.template);
      if (!template) { throw new Error('no template with ' + item.edit.template); }
      const used = await api(page, 'POST', `/api/designs/${template.id}/use-template`, {});
      designId = used.body.id;
      before = await renderPages(page, designId, folder, item.id, '-before');
      await page.goto(base + '/', { waitUntil: 'load' });
      const sent = await api(page, 'POST', `/api/ai/designs/${designId}/messages`, { __form: { text: item.text, scope: JSON.stringify({ kind: 'design' }) } });
      if (sent.status !== 200) { throw new Error('send failed: ' + sent.status + ' ' + JSON.stringify(sent.body)); }
      conversationId = sent.body.conversationId;
    } else {
      const created = await api(page, 'POST', '/api/ai/designs/new', { __form: { text: item.text, preset: item.preset || '' } });
      if (created.status !== 200) { throw new Error('create failed: ' + created.status + ' ' + JSON.stringify(created.body)); }
      designId = created.body.id;
      conversationId = created.body.conversationId;
    }
    result.designId = designId;
    result.conversationId = conversationId;
    // the editor is open while the run works: it answers "look" and shows what a person would see
    await page.goto(`${base}/Designs/${designId}/Designer?ai=${conversationId}`, { waitUntil: 'load' });
    const deadline = Date.now() + timeoutMinutes * 60000;
    let info = await waitIdle(page, conversationId, deadline);
    let follow = 0;
    while (info && info.runs[info.runs.length - 1].status === 'Waiting' && follow < 1) {
      follow++;
      log(item.id, 'asks a question: answering once');
      const sent = await api(page, 'POST', `/api/ai/designs/${designId}/messages`, { __form: { text: 'Mach einfach einen guten Vorschlag mit den Angaben, die du hast. Fehlende Angaben darfst du weglassen.', conversationId: String(conversationId) } });
      if (sent.status !== 200) { break; }
      await sleep(3000);
      info = await waitIdle(page, conversationId, deadline);
    }
    if (!info) { result.state = 'timeout'; await api(page, 'POST', `/api/ai/conversations/${conversationId}/cancel`, {}); }
    else { result.state = info.runs[info.runs.length - 1].status; result.tokens = info.tokens; result.runs = info.runs.length; }

    const steps = (await api(page, 'GET', `/api/ai/conversations/${conversationId}/steps?after=0`)).body || { steps: [] };
    fs.writeFileSync(path.join(folder, `${item.id}-steps.json`), JSON.stringify(steps.steps, null, 1));
    const actions = steps.steps.filter(s => s.kind === 'action');
    const tools = {};
    for (const a of actions) { const t = a.data && a.data.tool; tools[t] = (tools[t] || 0) + 1; }
    result.calls = steps.steps.filter(s => s.kind === 'assistant').length;
    result.tools = tools;
    result.looks = tools.look || 0;
    result.failedActions = actions.filter(a => a.data && a.data.ok === false).length;
    result.warnings = actions.reduce((n, a) => n + ((a.data && a.data.warnings) || []).length, 0);
    const lastWriteIndex = actions.map(a => a.data && a.data.changed).lastIndexOf(true);
    result.lastWarnings = lastWriteIndex >= 0 ? ((actions[lastWriteIndex].data.warnings) || []).slice(0, 6) : [];
    const lastAssistant = [...steps.steps].reverse().find(s => s.kind === 'assistant');
    result.message = lastAssistant ? lastAssistant.text.slice(0, 400) : '';
    result.seconds = Math.round((Date.now() - started) / 1000);

    const rendered = await renderPages(page, designId, folder, item.id);
    result.files = rendered.files.map(f => path.basename(f));
    result.pages = rendered.doc.pages.length;
    result.elements = rendered.doc.pages.reduce((n, p) => n + count(p.elements), 0);
    result.size = `${rendered.doc.width} x ${rendered.doc.height} ${rendered.doc.unit || 'mm'}`;
    result.before = before ? before.files.map(f => path.basename(f)) : null;
    result.name = rendered.doc.name || '';
    log(item.id, result.state, `calls ${result.calls}`, `looks ${result.looks}`, `tokens ${result.tokens}`, `${result.seconds}s`, `${result.elements} elements`);
  } catch (e) {
    result.note = String(e && e.message || e);
    log(item.id, 'ERROR', result.note);
  } finally {
    await page.close().catch(() => {});
  }
  return result;
}

/** One picture with all first pages (and the second one of a folded card) and the key numbers under each: what the person at the screen looks at first. */
async function contactSheet(browser, results, folder, fileName, title) {
  const rows = results.map(r => {
    const imgs = (r.files || []).slice(0, 2).map(f => `<img src="data:image/png;base64,${fs.readFileSync(path.join(folder, f)).toString('base64')}">`).join('');
    const tools = Object.entries(r.tools || {}).map(([k, v]) => `${k}${v > 1 ? '×' + v : ''}`).join(' ');
    const meta = `${r.state} · ${r.calls ?? '?'} Aufrufe · ${r.looks ?? '?'} Blicke · ${r.elements ?? '?'} Elemente · ${Math.round((r.tokens || 0) / 1000)}k Tokens · ${r.seconds ?? '?'}s`;
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    return `<div class="cell"><div class="imgs">${imgs || '<div class="none">kein Ergebnis</div>'}</div><div class="id">${esc(r.id)}</div><div class="p">${esc(r.prompt.slice(0, 110))}</div><div class="m">${esc(meta)}</div><div class="t">${esc(tools)}</div>${r.note ? `<div class="e">${esc(r.note)}</div>` : ''}</div>`;
  }).join('');
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:16px;background:#e9ecef;font:13px/1.35 Segoe UI,Arial,sans-serif;color:#222;width:1700px}
    h1{font-size:18px;margin:0 0 12px}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
    .cell{background:#fff;padding:8px;border-radius:6px;display:flex;flex-direction:column}
    .imgs{display:flex;gap:6px;align-items:flex-start;justify-content:center;height:420px;background:#f5f5f5;padding:4px;box-sizing:border-box}
    .imgs img{max-height:410px;max-width:100%;object-fit:contain;flex:0 1 auto;min-width:0}
    .id{font-weight:700;margin-top:6px}.p{color:#555;font-size:12px}.m{font-size:12px;color:#06c}.t{font-size:11px;color:#888}.e{color:#b00}.none{margin:auto;color:#b00}
  </style><h1>${title}</h1><div class="grid">${rows}</div>`;
  const page = await browser.newPage({ viewport: { width: 1730, height: 900 } });
  await page.setContent(html);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(folder, fileName), fullPage: true });
  await page.close();
}

(async () => {
  if (!email || !password) { console.error('--email and --password (or DT_EVAL_EMAIL / DT_EVAL_PASSWORD) are needed.'); process.exit(2); }
  fs.mkdirSync(out, { recursive: true });
  let browser;
  try { browser = await chromium.launch({ channel: 'msedge' }); } catch (e) { browser = await chromium.launch(); }
  const login = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'de-DE' });
  const lp = await login.newPage();
  await lp.goto(base + '/Account/Login');
  await lp.fill('#Input_Email', email);
  await lp.fill('#Input_Password', password);
  await Promise.all([lp.waitForNavigation(), lp.click('button[type=submit]')]);
  if (/\/Account\//.test(new URL(lp.url()).pathname)) { throw new Error('login failed'); }
  if (raiseLimits) { await raiseTheLimits(lp); }
  const state = await login.storageState();
  await login.close();

  const list = PROMPTS.filter(p => !only || only.includes(p.id));
  log(`label ${label}: ${list.length} prompts, ${concurrency} at a time, results in ${out}`);
  const results = new Array(list.length);
  let next = 0;
  const worker = async () => {
    const context = await browser.newContext({ storageState: state, viewport: { width: 1440, height: 900 }, locale: 'de-DE' });
    for (;;) {
      const i = next++;
      if (i >= list.length) { break; }
      results[i] = await oneRun(context, list[i], out);
      fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results.filter(Boolean), null, 1));
    }
    await context.close();
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));
  const done = results.filter(Boolean);
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(done, null, 1));
  const per = 8;
  for (let i = 0; i < done.length; i += per) {
    await contactSheet(browser, done.slice(i, i + per), out, `contact${done.length > per ? '-' + (i / per + 1) : ''}.png`, `${label} (${i + 1}–${Math.min(done.length, i + per)} von ${done.length})`);
  }
  const total = done.reduce((n, r) => n + (r.tokens || 0), 0);
  log(`done: ${done.length} runs, ${done.filter(r => r.state === 'Done').length} Done, ${Math.round(total / 1000)}k tokens in all`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
