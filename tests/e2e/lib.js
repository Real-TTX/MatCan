'use strict';
// Helpers shared by the browser checks (designer-check.js, output-check.js): the base address, the console watcher (errors and CSP violations are problems), a context
// with the German locale, the sign-in, and the test accounts. Accounts: tests/e2e/test-account.json ({ "designer": {email,password}, "viewer": {...}, "admin": {...} }) is
// used when it exists. On an empty database the setup assistant creates the administrator (admin@example.com), who creates two members (the "designer" works in an own area, the "viewer" only sees what the designer shares with them: use shareWith); the file is written.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PASSWORD = 'Passw0rd!Passw0rd';
const accountFile = process.env.DT_ACCOUNT_FILE || path.join(__dirname, 'test-account.json'); // DT_ACCOUNT_FILE: another file, for checks that run side by side

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
      if (m.type() === 'error' && !ignore.test(m.text()) && !(ignoreUrl && ignoreUrl.test(m.location().url || ''))) { problems.push(`[${label}] console error: ${m.text()}${m.location().url ? ' (' + m.location().url + ')' : ''}`); }
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
    accounts.designer = accounts.designer || await make('E2E Gestalter', 'designer@example.com', 'Mitglied');
    accounts.viewer = accounts.viewer || await make('E2E Betrachter', 'viewer@example.com', 'Mitglied');
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

  /**
   * Shares an item of the signed-in person with another person (by e-mail address) through the API of the Teilen dialog: kind is "design", "datalist", "outputjob" or "folder",
   * permission "View" or "Edit". The person who looks at things in a check gets what they look at this way: nothing is shared with a member by default.
   */
  async function shareWith(page, kind, id, email, permission) {
    const found = await page.evaluate(async q => (await fetch('/api/share/search?q=' + encodeURIComponent(q))).json(), email);
    const person = (found || []).find(r => r.type === 'user' && r.email === email);
    if (!person) { throw new Error('Niemand gefunden für ' + email); }
    const result = await postJson(page, '/api/share/' + kind + '/' + id, { userId: person.id, permission: permission || 'View' });
    if (result.status !== 200) { throw new Error('Teilen schlug fehl: ' + result.status + ' ' + JSON.stringify(result.body)); }
    return result.body;
  }

  /**
   * Uploads the icon of the app as an image of the signed-in person through the API (the name gives the key) and returns { key, id }. A key that a data list or a design uses must be one the
   * person may use, so a check that wants an image that is gone later uploads one first and removes it with purgeImage after the work is saved.
   */
  async function uploadImage(page, name) {
    return page.evaluate(async n => {
      const token = document.querySelector('meta[name=dt-csrf]').content;
      const blob = await (await fetch('/img/icon-192.png')).blob();
      const form = new FormData();
      form.append('files', new File([blob], n + '.png', { type: 'image/png' }));
      const up = await (await fetch('/api/assets/upload', { method: 'POST', headers: { RequestVerificationToken: token }, body: form })).json();
      const key = up.uploaded[0].key;
      const found = await (await fetch('/api/items?kinds=asset&recursive=true&take=30')).json();
      return { key, id: found.items.find(i => i.key === key).id };
    }, name);
  }

  /** Deletes an image for good (trash, then purge): what still uses its key finds it missing. */
  async function purgeImage(page, id) {
    await postJson(page, '/api/items/trash', { items: [{ kind: 'asset', id }] });
    return postJson(page, '/api/items/purge', { items: [{ kind: 'asset', id }] });
  }

  return { base, problems, dialogs, watch, launch, newContext, login, ensureAccounts, postJson, shareWith, uploadImage, purgeImage, PASSWORD };
}

module.exports = create;
