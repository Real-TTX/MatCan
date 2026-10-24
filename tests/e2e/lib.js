'use strict';
// Helpers shared by the browser checks (designer-check.js, output-check.js): the base address, the console watcher (errors and CSP violations are problems), a context
// with the German locale, the sign-in, and the test accounts. Accounts: tests/e2e/test-account.json ({ "designer": {email,password}, "viewer": {...}, "admin": {...} }) is
// used when it exists. On an empty database the setup assistant creates the administrator (admin@example.com), who creates a designer and a viewer; the file is written.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PASSWORD = 'Passw0rd!Passw0rd';
const accountFile = path.join(__dirname, 'test-account.json');

/**
 * @param {string[]} args process arguments (an http(s) address is the base address)
 * @param {{ignore?: RegExp, ignoreUrl?: RegExp}} [options] ignore: console errors that are deliberate (the check provokes a 403 or 409 on purpose); ignoreUrl: such errors
 *   of requests to these addresses are ignored as well (a 404 that the check asks for)
 */
function create(args, options) {
  const ignore = (options && options.ignore) || /status of (403|409)/;
  const ignoreUrl = options && options.ignoreUrl;
  const base = ((args || []).find(a => /^https?:/.test(a)) || 'http://localhost:3043').replace(/\/$/, '');
  const problems = [];
  const dialogs = [];

  function watch(page, label) {
    page.on('console', m => {
      if (m.type() === 'error' && !ignore.test(m.text()) && !(ignoreUrl && ignoreUrl.test(m.location().url || ''))) { problems.push(`[${label}] console error: ${m.text()}`); }
    });
    page.on('pageerror', e => problems.push(`[${label}] page error: ${e.message}`));
    page.on('dialog', d => { dialogs.push(d.type()); d.accept().catch(() => {}); });
  }

  async function launch() {
    try { return await chromium.launch({ channel: 'msedge' }); } catch (e) { return chromium.launch(); }
  }

  async function newContext(browser, contextOptions) {
    const context = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 800 }, locale: 'de-DE' }, contextOptions || {}));
    await context.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', e => { console.error('CSP violation: ' + e.violatedDirective + ' ' + e.blockedURI); });
    });
    return context;
  }

  async function login(page, account) {
    await page.goto(base + '/Account/Login');
    await page.fill('#Input_Email', account.email);
    await page.fill('#Input_Password', account.password);
    await Promise.all([page.waitForNavigation(), page.click('button[type=submit]')]);
    return !/\/Account\//.test(new URL(page.url()).pathname);
  }

  async function ensureAccounts(browser) {
    let accounts = fs.existsSync(accountFile) ? JSON.parse(fs.readFileSync(accountFile, 'utf8')) : {};
    const context = await newContext(browser);
    const page = await context.newPage();
    watch(page, 'accounts');
    if (accounts.designer && await login(page, accounts.designer) && accounts.viewer) { await context.close(); return accounts; }

    await page.goto(base + '/Account/Setup');
    if (/Setup/.test(page.url())) {
      accounts = {};   // an empty database: whatever the file says does not exist any more
      accounts.admin = { email: 'admin@example.com', password: PASSWORD };
      await page.fill('#Input_DisplayName', 'Test Admin');
      await page.fill('#Input_Email', accounts.admin.email);
      await page.fill('#Input_Password', accounts.admin.password);
      await page.fill('#Input_PasswordRepeat', accounts.admin.password);
      await Promise.all([page.waitForNavigation(), page.click('button[type=submit]')]);
    } else if (!accounts.admin || !(await login(page, accounts.admin))) {
      throw new Error('Kein Konto: lege tests/e2e/test-account.json an oder starte mit ./scripts/redeploy.ps1 -Clean (leere Datenbank).');
    }
    const make = async (name, email, role) => {
      await page.goto(base + '/Admin/Users/Edit');
      await page.fill('#Input_DisplayName', name);
      await page.fill('#Input_Email', email);
      await page.selectOption('#Input_Role', { label: role });
      await page.fill('#Input_Password', PASSWORD);
      await Promise.all([page.waitForNavigation(), page.click('button[type=submit].mat-btn--primary')]);
      return { email, password: PASSWORD };
    };
    accounts.designer = accounts.designer || await make('E2E Gestalter', 'designer@example.com', 'Gestalter');
    accounts.viewer = accounts.viewer || await make('E2E Betrachter', 'viewer@example.com', 'Betrachter');
    fs.writeFileSync(accountFile, JSON.stringify(accounts, null, 2));
    await context.close();
    return accounts;
  }

  /** Posts a JSON body from inside a page (the antiforgery token comes from the page). */
  async function postJson(page, url, body) {
    return page.evaluate(async ({ url: u, body: b }) => {
      const r = await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json', RequestVerificationToken: document.querySelector('meta[name=dt-csrf]').content }, body: JSON.stringify(b) });
      let json = null;
      try { json = await r.json(); } catch (e) { /* no body */ }
      return { status: r.status, body: json };
    }, { url, body });
  }

  return { base, problems, dialogs, watch, launch, newContext, login, ensureAccounts, postJson, PASSWORD };
}

module.exports = create;
