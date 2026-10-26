// Checks teams, accounts, administration, mail and notifications (docs/PLAN-PLATFORM.md section 1, items 12 to 17; phase P4):
//  - Teams: the overview (tiles), "Team erstellen", the team page with its tabs (Projekte = the file browser, Mitglieder, Marke, Vorlagen, Einstellungen), the menu
//  - Einladen: by link (a second browser registers through it while registration is off and joins), by e-mail address (no mail server: the link is shown), "Erneut senden", "Link kopieren",
//    "Zurückziehen", an address that does not match, a signed-in person who accepts
//  - roles: the select, "mindestens ein Inhaber", a viewer of the team sees the team read-only, "Team verlassen", the settings (name, colour), ownership handed over, "Team löschen" with the name typed
//  - the brand of the team (Marke tab, used by the editor's Marke panel for a design of the team) and the templates of the team ("Als Teamvorlage", "Vorlage verwenden")
//  - the bell: the count, the popover, a share with a message, an access request with "Gewähren", "Alle als gelesen markieren", the page "Benachrichtigungen"; the mail settings of the profile
//  - the administration: Plattform (registration modes, domains), registration open and with approval (the waiting page, approve in the list), Teams (list, details, "Mir beitreten"), Mail,
//    deleting an account with a transfer of its content to another person
//  - the phone (390): team page, bell, registration
// The check makes accounts of its own through registration (names with a stamp) and deletes what it can; the platform settings are put back at the end.
//
//   node teams-check.js [base url, default http://localhost:3043] [--out <folder for the screenshots, default: the temp folder>]
const fs = require('fs');
const os = require('os');
const path = require('path');
const lib = require('./lib.js');
const ed = require('./editor-lib.js');

const args = process.argv.slice(2);
const { base, problems, watch, launch, newContext, login, ensureAccounts, postJson, PASSWORD } = lib(args, { ignore: /status of (400|403|404|409|429)/ });
const outIndex = args.indexOf('--out');
const outDir = path.resolve(outIndex >= 0 ? args[outIndex + 1] : path.join(os.tmpdir(), 'designthix-teams-check'));
fs.mkdirSync(outDir, { recursive: true });

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); };
const stamp = String(Date.now()).slice(-6);
let shotNo = 0;
const shot = async (page, name) => {
  shotNo++;
  const width = page.viewportSize().width;
  await page.screenshot({ path: path.join(outDir, `${String(shotNo).padStart(2, '0')}-${name}-${width}.png`) });
};

(async () => {
  const browser = await launch();
  const accounts = await ensureAccounts(browser);
  const wide = { viewport: { width: 1440, height: 900 } };
  const ctxA = await newContext(browser, wide);
  const ctxB = await newContext(browser, wide);
  const ctxC = await newContext(browser, wide);
  const ctxX = await newContext(browser, wide);
  const A = await ctxA.newPage();
  const B = await ctxB.newPage();
  const C = await ctxC.newPage();
  const X = await ctxX.newPage();
  [[A, 'A'], [B, 'B'], [C, 'C'], [X, 'X']].forEach(([p, n]) => watch(p, n));
  check('A (Gestalter), B (Betrachter) and C (Administrator) sign in', (await login(A, accounts.designer)) && (await login(B, accounts.viewer)) && (await login(C, accounts.admin)));

  const section = async (name, fn) => {
    try { await fn(); } catch (e) {
      check(name + ': ran to the end', false, String(e.message || e).split('\n')[0]);
      for (const [p, n] of [[A, 'A'], [B, 'B'], [C, 'C'], [X, 'X']]) { try { await p.screenshot({ path: path.join(outDir, `failed-${name.replace(/\W+/g, '-')}-${n}.png`) }); } catch (x) { /* no picture */ } }
    }
  };
  const get = (p, url) => p.evaluate(async u => { const r = await fetch(u); let body = null; try { body = await r.json(); } catch (e) { /* no body */ } return { status: r.status, body }; }, url);
  const toastText = p => p.$$eval('.mat-toast', els => els.map(e => e.textContent.trim()).join(' | '));
  const go = async (p, url) => { const r = await p.goto(base + url, { waitUntil: 'networkidle' }); return r; };
  const menuTeams = p => p.$$eval('.mat-nav [data-nav-panel="main"] a', els => els.map(e => ({ text: e.textContent.trim(), href: e.getAttribute('href') })));
  const confirmOk = async p => { await p.waitForSelector('dialog[open] button[value=ok]'); await p.waitForTimeout(250); await Promise.all([p.waitForNavigation(), p.click('dialog[open] button[value=ok]')]); };
  const submitIn = async (p, scope) => Promise.all([p.waitForNavigation(), p.click(`${scope} button[type=submit]`)]);
  const memberRow = (p, name) => p.locator('tr[data-member]', { hasText: name });

  const teamName = `Team P4 ${stamp}`;
  const newName = `E2E Neu ${stamp}`;
  const newMail = `neu${stamp}@example.com`;
  const stillWaitingMail = `bleibt${stamp}@example.com`;
  const waitingMail = `wartend${stamp}@example.com`;
  const openMail = `offen${stamp}@irgendwo.test`;
  let slug = '';
  let teamId = 0;

  // ------------------------------------------------------------------------------------------------ the administrator sets the stage: registration off
  await section('platform off', async () => {
    await go(C, '/Admin/Platform');
    await shot(C, 'admin-platform');
    check('the platform page has the three modes, the switches and the numbers', (await C.$$('input[name="Input.Registration"]')).length === 3 && (await C.$$('input[name="Input.TrashDays"]')).length === 1 && (await C.textContent('main')).includes('Öffentliche Links erlauben'));
    await C.click('label.mat-check:has-text("Aus: nur mit Einladung")');
    await Promise.all([C.waitForNavigation(), C.click('button[type=submit].mat-btn--primary')]);
    check('the settings are saved ("Die Einstellungen sind gespeichert")', /Die Einstellungen sind gespeichert/.test(await toastText(C)));
  });

  // ------------------------------------------------------------------------------------------------ 1. teams: create, tabs, menu
  await section('create the team', async () => {
    await go(A, '/Teams');
    check('the overview has "Team erstellen"', await A.isVisible('a[href="/Teams/Create"]'));
    await shot(A, 'teams-overview');
    await A.locator('a[href="/Teams/Create"]:visible').first().click();   // in the page and, when the person has no team yet, in the empty state
    await A.waitForURL(/\/Teams\/Create$/);
    await A.fill('#Input_Name', teamName);
    await A.fill('#Input_Description', 'Das Team der Browser-Prüfung.');
    await shot(A, 'team-create');
    await Promise.all([A.waitForNavigation(), A.click('button[type=submit].mat-btn--primary')]);
    slug = decodeURIComponent(A.url()).split('/')[4];
    check('creating a team opens its member list', /\/Teams\/[^/]+\/Mitglieder$/.test(A.url()), A.url());
    check('the page says what happened and has the team name as the heading', /ist angelegt/.test(await toastText(A)) && (await A.textContent('h1')).trim() === teamName);
    const spaces = await get(A, '/api/spaces');
    teamId = (spaces.body.find(s => s.slug === slug) || {}).id;
    check('the team exists with the person as Owner', !!teamId);
    const tabs = await A.$$eval('.dt-linktabs .mat-tab', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
    check('an owner sees the five tabs', tabs.length === 5 && ['Projekte', 'Mitglieder', 'Marke', 'Vorlagen', 'Einstellungen'].every((t, i) => tabs[i].startsWith(t)), tabs.join('|'));
    const teams = await menuTeams(A);
    check('the menu lists the team and "Team erstellen" and "Alle Teams"', teams.some(t => t.text === teamName && t.href === `/Teams/${slug}/Projekte`) && teams.some(t => t.href === '/Teams/Create') && teams.some(t => t.href === '/Teams'));
    check('the team\'s own address leads to its file browser', (await A.goto(base + `/Teams/${slug}`, { waitUntil: 'networkidle' })).url().endsWith(`/Teams/${slug}/Projekte`));
    check('the Projekte tab is the file browser with the tabs above it and the team name as the only heading', (await A.$$('[data-browser]')).length === 1 && (await A.$$('.dt-linktabs')).length === 1 && (await A.$$('h1')).length === 1 && (await A.textContent('h1')).trim() === teamName);
    await shot(A, 'team-projekte');
    await go(A, '/Teams');
    const tile = A.locator(`[data-team="${slug}"]`);
    check('the overview shows the team as a tile with its role and storage', (await tile.count()) === 1 && /Inhaber/.test(await tile.textContent()) && /von 10 GB/.test(await tile.textContent()), (await tile.textContent()).replace(/\s+/g, ' '));
    await shot(A, 'teams-overview-with-team');
  });

  // ------------------------------------------------------------------------------------------------ 2. invite by link: a new person registers through it while registration is off
  let linkUrl = '';
  await section('invite by link', async () => {
    await go(A, `/Teams/${slug}/Mitglieder`);
    await A.click('button[data-dialog-open="dt-invite"]');
    await A.waitForSelector('dialog#dt-invite[open]');
    await A.waitForTimeout(300);
    check('the dialog offers e-mail first, with the address field and the roles', await A.isVisible('#Input_Addresses') && !(await A.isVisible('#Input_MaxUses')) && (await A.$$eval('#Input_Role option', os => os.map(o => o.textContent.trim()))).join('|') === 'Inhaber|Admin|Bearbeiter|Betrachter');
    await shot(A, 'invite-dialog');
    await A.click('#dt-invite label.mat-check:has-text("Einladungslink erzeugen")');
    check('"Einladungslink" shows how often the link may be used and hides the addresses', await A.isVisible('#Input_MaxUses') && !(await A.isVisible('#Input_Addresses')));
    await A.selectOption('#Input_Role', 'Editor');
    await A.selectOption('#Input_Days', '30');
    await A.fill('#Input_MaxUses', '3');
    await submitIn(A, '#dt-invite');
    await A.waitForSelector('[data-invite-links]');
    linkUrl = await A.inputValue('.dt-invite-links__url');
    check('the link is shown (no mail server), with "Link kopieren"', /\/Einladung\/[0-9a-f-]{36}$/.test(linkUrl) && await A.isVisible('[data-invite-links] [data-copy]') && /Mailversand ist nicht eingerichtet/.test(await A.textContent('[data-invite-links]')));
    const rows = await A.$$eval('#invitations-table tr[data-invitation]', rs => rs.map(r => r.textContent.replace(/\s+/g, ' ').trim()));
    check('the open invitations list the link with its role and "0 von 3 benutzt"', rows.length === 1 && /Einladungslink/.test(rows[0]) && /Bearbeiter/.test(rows[0]) && /0 von 3 benutzt/.test(rows[0]), rows.join('|'));
    await shot(A, 'members-with-invitation');

    // the second browser: not signed in, registration is off
    const dest = linkUrl.replace(/^https?:\/\/[^/]+/, base);
    await X.goto(base + '/Account/Register', { waitUntil: 'networkidle' });
    check('without an invitation the register page does not exist while registration is off', /\/Account\/Login/.test(X.url()) && (await X.$$('[data-register-link]')).length === 0);
    await X.goto(dest, { waitUntil: 'networkidle' });
    check('the invitation page names the team and offers "Konto erstellen" and "Anmelden"', (await X.textContent('h1')).includes(teamName) && await X.isVisible('[data-invite-register]') && await X.isVisible('[data-invite-login]'), await X.textContent('h1'));
    await shot(X, 'invite-accept-signed-out');
    await X.click('[data-invite-register]');
    await X.waitForURL(/\/Account\/Register\?invitation=/);
    check('the register page says who invited and has the address field free', /hat dich ins Team/.test(await X.textContent('.mat-auth__brand')) && !(await X.getAttribute('#Input_Email', 'readonly') !== null));
    await shot(X, 'register-invitation');
    await X.fill('#Input_DisplayName', newName);
    await X.fill('#Input_Email', newMail);
    await X.fill('#Input_Password', PASSWORD);
    await X.fill('#Input_PasswordRepeat', PASSWORD);
    await Promise.all([X.waitForNavigation(), X.click('button[type=submit].mat-btn--primary')]);
    check('registering through the invitation signs in and opens the team', X.url().endsWith(`/Teams/${slug}/Projekte`), X.url());
    check('the new person is a member: the menu lists the team, the page welcomes them', (await menuTeams(X)).some(t => t.text === teamName) && /Willkommen/.test(await toastText(X)));
    await go(A, `/Teams/${slug}/Mitglieder`);
    const row = memberRow(A, newName);
    check('the owner sees the new member as Bearbeiter', (await row.count()) === 1 && (await row.locator('select').inputValue()) === 'Editor');
    check('and the link was used once (0 -> 1 of 3)', /1 von 3 benutzt/.test(await A.textContent('#invitations-table')));
    // a used link on a person who is a member already: friendly
    await X.goto(dest, { waitUntil: 'networkidle' });
    check('a member who opens the link again can only "accept" (they are in already)', await X.isVisible('[data-accept-invitation]'));
  });

  // ------------------------------------------------------------------------------------------------ 3. invite by e-mail address (no mail server): the link is shown
  await section('invite by address', async () => {
    const wanted = `gast${stamp}@example.com`;
    await go(A, `/Teams/${slug}/Mitglieder`);
    await A.click('button[data-dialog-open="dt-invite"]');
    await A.waitForSelector('dialog#dt-invite[open]');
    await A.waitForTimeout(250);
    await A.fill('#Input_Addresses', `${wanted}, kaputt`);
    await A.selectOption('#Input_Role', 'Viewer');
    await submitIn(A, '#dt-invite');
    check('an address that is none is refused in the dialog, which stays open', await A.isVisible('dialog#dt-invite[open]') && /keine gültige E-Mail-Adresse/.test(await A.textContent('dialog#dt-invite')));
    await shot(A, 'invite-dialog-error');
    await A.fill('#Input_Addresses', `${wanted}\n${accounts.viewer.email}`);
    await A.selectOption('#Input_Role', 'Viewer');
    await submitIn(A, '#dt-invite');
    await A.waitForSelector('[data-invite-links]');
    const links = await A.$$eval('.dt-invite-links__list li', ls => ls.map(l => ({ label: l.querySelector('.dt-invite-links__label').textContent.trim(), url: l.querySelector('input').value })));
    check('two invitations were made and their links are shown', links.length === 2 && links[0].label === wanted && links[1].label === accounts.viewer.email, JSON.stringify(links.map(l => l.label)));
    check('the toast says the mail server is not set up', /Mailversand ist nicht eingerichtet/.test(await toastText(A)));
    const pending = await A.$$eval('#invitations-table tr[data-invitation]', rs => rs.map(r => r.textContent.replace(/\s+/g, ' ').trim()));
    check('the list has both addresses with Betrachter and "Offen"', pending.some(r => r.includes(wanted) && /Betrachter/.test(r) && /Offen/.test(r)) && pending.some(r => r.includes(accounts.viewer.email)), pending.join('|'));

    // resend: the link stays, a flash says so
    await Promise.all([A.waitForNavigation(), A.click(`tr[data-invitation]:has-text("${wanted}") button:has-text("Erneut senden")`)]);
    check('"Erneut senden" answers (the mail server is not set up, so: copy the link)', /Mailversand ist nicht eingerichtet/.test(await toastText(A)));
    check('"Link kopieren" has the link of that invitation', (await A.getAttribute(`tr[data-invitation]:has-text("${wanted}") button[data-copy]`, 'data-copy')) === links[0].url);

    // a person signed in with another address cannot accept
    const forB = links[1].url.replace(/^https?:\/\/[^/]+/, base);
    const forWanted = links[0].url.replace(/^https?:\/\/[^/]+/, base);
    await B.goto(forWanted, { waitUntil: 'networkidle' });
    check('somebody signed in with another address is told whom the invitation is for', /Diese Einladung gilt für/.test(await B.textContent('.mat-alert')) && (await B.$$('[data-accept-invitation]')).length === 0);
    await shot(B, 'invite-wrong-address');

    // revoke: the link is dead
    await A.click(`tr[data-invitation]:has-text("${wanted}") button:has-text("Zurückziehen")`);
    await confirmOk(A);
    check('"Zurückziehen" removes the row', (await A.$$(`tr[data-invitation]:has-text("${wanted}")`)).length === 0 && /zurückgezogen/.test(await toastText(A)));
    const dead = await B.goto(forWanted, { waitUntil: 'networkidle' });
    check('the revoked link says "Diese Einladung gilt nicht mehr" (404)', dead.status() === 404 && /Diese Einladung gilt nicht mehr/.test(await B.textContent('h1')));
    await shot(B, 'invite-dead');

    // the viewer accepts the invitation made for the viewer's address
    await B.goto(forB, { waitUntil: 'networkidle' });
    check('the right person gets the button "Einladung annehmen"', await B.isVisible('[data-accept-invitation]'));
    await Promise.all([B.waitForNavigation(), B.click('[data-accept-invitation]')]);
    check('accepting opens the team (as Betrachter)', B.url().endsWith(`/Teams/${slug}/Projekte`) && /Willkommen im Team/.test(await toastText(B)), B.url());
  });

  // ------------------------------------------------------------------------------------------------ 4. roles, the team's viewer, brand, templates
  let designId = 0;
  await section('roles and the viewer', async () => {
    // a design of the team, made by the owner
    const made = await postJson(A, '/api/designs', { preset: 'price-tag', spaceId: teamId });
    designId = made.body.id;
    await postJson(A, `/api/designs/${designId}/rename`, { name: `Teamdesign ${stamp}` });
    await go(A, `/Teams/${slug}/Mitglieder`);
    const ownRow = memberRow(A, 'E2E Gestalter');
    check('the owner has no select for their own role', (await ownRow.locator('select').count()) === 0 && /Inhaber/.test(await ownRow.textContent()));
    check('the only owner cannot leave: the button is disabled and says why', (await A.isDisabled('button:has-text("Team verlassen")')) && /einzige Inhaber/.test(await A.textContent('main')));
    // change the role of the new person with the select
    const row = memberRow(A, newName);
    await Promise.all([A.waitForNavigation(), row.locator('select').selectOption('Viewer')]);
    check('changing the select changes the role ("Die Rolle ist geändert")', /Die Rolle ist geändert/.test(await toastText(A)) && (await memberRow(A, newName).locator('select').inputValue()) === 'Viewer');
    await shot(A, 'members-roles');
    // B is a viewer of the team now
    await go(B, `/Teams/${slug}/Projekte`);
    check('a viewer of the team sees the team area (the design) and no "Neu"', (await B.$$('[data-browser-new]')).length === 0 && (await B.textContent('[data-browser]')).includes(`Teamdesign ${stamp}`));
    await shot(B, 'team-viewer');
    const tabsB = await B.$$eval('.dt-linktabs .mat-tab', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
    check('a viewer has four tabs (no Einstellungen)', tabsB.length === 4 && !tabsB.some(t => t.startsWith('Einstellungen')), tabsB.join('|'));
    const refused = await B.goto(base + `/Teams/${slug}/Einstellungen`);
    check('the settings answer a viewer with 403', refused.status() === 403);
    await go(B, `/Teams/${slug}/Mitglieder`);
    check('a viewer sees the list without selects, without "Einladen" and without the open invitations', (await B.$$('select[data-autosubmit]')).length === 0 && (await B.$$('button[data-dialog-open="dt-invite"]')).length === 0 && (await B.$$('#invitations-table')).length === 0);
    await shot(B, 'members-viewer');
    // a notification for the person whose role changed
    const notes = await get(X, '/api/notifications');
    check('the person whose role changed has a notification, written from data', notes.body.items.some(n => /Deine Rolle im Team/.test(n.text) && /Betrachter/.test(n.text)), JSON.stringify(notes.body.items.map(n => n.text)));
  });

  await section('brand and templates', async () => {
    // the brand of the team
    await go(A, `/Teams/${slug}/Marke`);
    check('the Marke tab holds the brand kit of the team', await A.isVisible('#dt-brand[data-space-id]') && (await A.getAttribute('#dt-brand', 'data-space-id')) === String(teamId) && await A.isVisible('#dt-brand-save'));
    await A.fill('#dt-brand-newcolor', '#ff6600');
    await A.dispatchEvent('#dt-brand-newcolor', 'input');
    await A.dispatchEvent('#dt-brand-newcolor', 'change');
    await A.click('#dt-brand-addcolor');
    await A.click('#dt-brand-save');
    await A.waitForFunction(() => /Alle Änderungen gespeichert/.test(document.getElementById('dt-brand-state').textContent), null, { timeout: 8000 }).catch(() => { });
    const kit = await get(A, `/api/brand?space=${teamId}`);
    check('saving the team brand keeps the colour in the team (and not in the personal brand)', kit.body.colors.includes('#ff6600') && !(await get(A, '/api/brand')).body.colors.includes('#ff6600'), JSON.stringify(kit.body.colors));
    await shot(A, 'team-brand');
    // the personal brand page has the switch to the team
    await go(A, '/Brand');
    check('/Brand has a switch to the teams the person may change the brand of', (await A.$$eval('.dt-linktabs .mat-tab', els => els.map(e => e.textContent.trim()))).some(t => t.includes(teamName)));
    // the editor uses the brand of the area of the design
    await ed.openDesigner(A, base, designId);
    await ed.openPanel(A, 'brand');
    const swatches = await A.$$eval('#dt-panel-body .dt-swatch', els => els.map(e => e.getAttribute('data-colour')));
    check('the Marke panel of a design of the team shows the team\'s colour', swatches.includes('#ff6600'), swatches.join(','));
    check('"Marke bearbeiten" in the panel leads to the brand page of the team', (await A.$$(`#dt-panel-body a[href="/Teams/${slug}/Marke"]`)).length === 1);
    await shot(A, 'editor-team-brand');
    const personal = await postJson(A, '/api/designs', { preset: 'price-tag' });
    await ed.openDesigner(A, base, personal.body.id);
    await ed.openPanel(A, 'brand');
    check('a personal design does not show it', !(await A.$$eval('#dt-panel-body .dt-swatch', els => els.map(e => e.getAttribute('data-colour')))).includes('#ff6600'));
    await postJson(A, '/api/items/trash', { items: [{ kind: 'design', id: personal.body.id }] });
    await postJson(A, '/api/items/purge', { items: [{ kind: 'design', id: personal.body.id }] });

    // team templates
    await go(A, `/Teams/${slug}/Vorlagen`);
    check('without templates the tab says so', (await A.$$('[data-team-templates-empty]')).length === 1);
    await shot(A, 'team-templates-empty');
    await A.selectOption('#team-template-design', String(designId));
    await Promise.all([A.waitForNavigation(), A.click('button:has-text("Als Teamvorlage anbieten")')]);
    check('the design is a team template: a tile with "Vorlage verwenden"', (await A.$$('[data-team-templates] [data-template]')).length === 1 && await A.isVisible('[data-team-templates] .dt-tpl__actions [data-use-template]'));
    await A.waitForTimeout(600);
    await shot(A, 'team-templates');
    // the viewer of the team uses it: the copy is theirs
    await go(B, `/Teams/${slug}/Vorlagen`);
    check('a member who is a viewer sees the template and no form to add one', (await B.$$('[data-team-templates] [data-template]')).length === 1 && (await B.$$('#team-template-design')).length === 0);
    await Promise.all([B.waitForURL(/\/Designs\/\d+\/Designer/), B.click('[data-team-templates] .dt-tpl__actions [data-use-template]')]);
    const copyId = Number(/Designs\/(\d+)\/Designer/.exec(B.url())[1]);
    const copy = await get(B, `/api/designs/${copyId}`);
    check('"Vorlage verwenden" makes a copy in the personal area of the person', copy.status === 200 && copy.body.spaceId !== teamId && copy.body.isTemplate !== true, JSON.stringify([copy.body.spaceId, teamId]));
    await postJson(B, '/api/items/trash', { items: [{ kind: 'design', id: copyId }] });
    await postJson(B, '/api/items/purge', { items: [{ kind: 'design', id: copyId }] });
    // take it back
    await go(A, `/Teams/${slug}/Vorlagen`);
    await A.click('.dt-tplwrap__remove button');
    await confirmOk(A);
    check('"Keine Vorlage mehr" takes the template back (the design stays)', (await A.$$('[data-team-templates] [data-template]')).length === 0 && (await get(A, `/api/designs/${designId}`)).status === 200);
  });

  // ------------------------------------------------------------------------------------------------ 5. the bell: a share with a message, the popover, an access request, the page
  await section('the bell', async () => {
    // the sender is the person this check registered: the brake on notifications counts per sender and receiver (10 of one kind in 10 minutes), and the other checks have used up the pair designer -> viewer
    const shared = await postJson(X, '/api/designs', { preset: 'price-tag' });
    const sharedId = shared.body.id;
    await postJson(X, `/api/designs/${sharedId}/rename`, { name: `Geteilt ${stamp}` });
    const found = await X.evaluate(async q => (await fetch('/api/share/search?q=' + encodeURIComponent(q))).json(), accounts.viewer.email);
    const person = found.find(r => r.type === 'user' && r.email === accounts.viewer.email);
    const result = await postJson(X, `/api/share/design/${sharedId}`, { userId: person.id, permission: 'Edit', message: 'Schau mal, ist noch <b>roh</b>.' });
    check('the new person shares a design with B and a message', result.status === 200, JSON.stringify(result.body));

    await go(B, '/Teams');
    await B.waitForFunction(() => { const b = document.querySelector('[data-notify-badge]'); return b && !b.hidden && parseInt(b.textContent, 10) >= 1; }, null, { timeout: 10000 });
    const unread = (await get(B, '/api/notifications/count')).body.unread;   // the badge says 99+ on a database that has been used for long: the exact number comes from the API
    check('the bell shows the count of the unread ones', unread >= 1 && /ungelesen/.test(await B.getAttribute('[data-notify-toggle]', 'aria-label')), String(unread));
    check('the bell sits in the header bar', await B.isVisible('.mat-topbar__actions [data-notify-toggle]'));
    await B.click('[data-notify-toggle]');
    await B.waitForSelector('.dt-notify:not([hidden]) .dt-notif[data-kind="share"]');
    const first = B.locator('.dt-notify .dt-notif[data-kind="share"]').first();
    const text = (await first.textContent()).replace(/\s+/g, ' ');
    check('the popover lists the share with its text, the message as text and the time', text.includes(`${newName} hat „Geteilt ${stamp}“ mit dir geteilt (Kann bearbeiten)`) && text.includes('Schau mal, ist noch <b>roh</b>.') && /gerade eben|vor \d+ Min/.test(text), text);
    check('the message is text, not markup', (await B.$$('.dt-notify .dt-notif__message b')).length === 0);
    check('the first item is unread (dot)', await first.evaluate(e => e.classList.contains('is-unread')));
    await shot(B, 'bell-popover');
    await Promise.all([B.waitForNavigation(), first.locator('.dt-notif__main').click()]);
    check('a click opens the design', B.url().includes(`/Designs/${sharedId}/Designer`), B.url());
    const after = await get(B, '/api/notifications/count');
    check('and marked it read (the count went down)', after.body.unread === unread - 1, `${unread} -> ${after.body.unread}`);

    // an access request: the new person asks for A's design; A grants it in the popover
    const secret = await postJson(A, '/api/designs', { preset: 'price-tag' });
    await postJson(A, `/api/designs/${secret.body.id}/rename`, { name: `Geheim ${stamp}` });
    const asked = await postJson(X, '/api/access-requests', { kind: 'design', id: secret.body.id, permission: 'view', message: 'Darf ich?' });
    check('the new person asks for access', asked.status === 200, JSON.stringify(asked.body));
    await go(A, '/Teams');
    await A.waitForFunction(() => { const b = document.querySelector('[data-notify-badge]'); return b && !b.hidden; }, null, { timeout: 10000 });
    await A.click('[data-notify-toggle]');
    await A.waitForSelector('.dt-notify:not([hidden]) .dt-notif[data-kind="access-request"]');
    const request = A.locator('.dt-notif[data-kind="access-request"]', { hasText: `Geheim ${stamp}` }).first();
    check('A sees the request with "Gewähren" and "Ablehnen"', (await request.textContent()).includes(`${newName} möchte „Geheim ${stamp}“ ansehen`) && await request.locator('button:has-text("Gewähren")').isVisible() && await request.locator('button:has-text("Ablehnen")').isVisible());
    await shot(A, 'bell-access-request');
    await request.locator('button:has-text("Gewähren")').click();
    await A.waitForFunction(t => Array.from(document.querySelectorAll('.dt-notif[data-kind="access-request"]')).some(e => e.textContent.includes(t) && /Gewährt/.test(e.textContent)), `Geheim ${stamp}`, { timeout: 8000 });
    check('one click grants it and the item shows "Gewährt"', true);
    const mine = await get(X, '/api/notifications');
    check('the requester has "access-granted" and no second notification for the share', mine.body.items.some(n => n.kind === 'access-granted' && n.text.includes(`Geheim ${stamp}`)) && !mine.body.items.some(n => n.kind === 'share' && n.text.includes(`Geheim ${stamp}`)));
    check('and can open the design now', (await get(X, `/api/designs/${secret.body.id}`)).status === 200);

    // "Alle als gelesen markieren" and the page
    await A.click('[data-notify-read-all]');
    await A.waitForFunction(() => document.querySelector('[data-notify-badge]').hidden, null, { timeout: 8000 });
    check('"Alle als gelesen markieren" empties the badge', (await get(A, '/api/notifications/count')).body.unread === 0);
    await A.keyboard.press('Escape');
    check('Escape closes the popover', await A.isHidden('.dt-notify'));
    await go(X, '/Account/Notifications');
    check('the page "Benachrichtigungen" lists them with the "Alle anzeigen" target', (await X.$$('.dt-notif')).length >= 2 && (await X.textContent('h1')).trim() === 'Benachrichtigungen');
    await shot(X, 'notifications-page');
    const unreadBefore = (await get(X, '/api/notifications/count')).body.unread;
    await Promise.all([X.waitForNavigation(), X.click('.dt-notif.is-unread .dt-notif__text >> nth=0')]);
    await X.waitForLoadState('networkidle');
    check('clicking one on the page opens what it is about and marks it read', !/\/Account\/Notifications/.test(X.url()) && (await get(X, '/api/notifications/count')).body.unread === unreadBefore - 1, X.url() + ' ' + unreadBefore);
    await go(X, '/Account/Notifications');
    if (await X.isEnabled('main button:has-text("Alle als gelesen markieren")')) { await Promise.all([X.waitForNavigation(), X.click('main button:has-text("Alle als gelesen markieren")')]); }
    check('"Alle als gelesen markieren" on the page leaves nothing unread', (await get(X, '/api/notifications/count')).body.unread === 0);

    await postJson(X, '/api/items/trash', { items: [{ kind: 'design', id: sharedId }] });
    await postJson(X, '/api/items/purge', { items: [{ kind: 'design', id: sharedId }] });
    await postJson(A, '/api/items/trash', { items: [{ kind: 'design', id: secret.body.id }] });
    await postJson(A, '/api/items/purge', { items: [{ kind: 'design', id: secret.body.id }] });
  });

  await section('profile mail settings', async () => {
    await go(A, '/Account/Profile');
    check('the profile has the four mail switches and says the mail server is not set up', (await A.$$('[data-mail-settings] label.mat-switch')).length === 4 && /noch nicht eingerichtet/.test(await A.textContent('[data-mail-settings]')));
    await shot(A, 'profile-mail');
    await A.click('[data-mail-settings] label.mat-switch:has-text("Erwähnungen")');
    await Promise.all([A.waitForNavigation(), A.click('[data-mail-settings] button[type=submit]')]);
    check('saving keeps the choice', /E-Mails ist gespeichert|gespeichert/.test(await toastText(A)) && !(await A.isChecked('[data-mail-settings] input[name="Notify.Mentions"]')));
    await A.click('[data-mail-settings] label.mat-switch:has-text("Erwähnungen")');
    await Promise.all([A.waitForNavigation(), A.click('[data-mail-settings] button[type=submit]')]);
    check('and can be switched on again', await A.isChecked('[data-mail-settings] input[name="Notify.Mentions"]'));
  });

  // ------------------------------------------------------------------------------------------------ 6. leave, ownership, delete
  await section('leave', async () => {
    await go(X, `/Teams/${slug}/Mitglieder`);
    await X.click('button:has-text("Team verlassen")');
    await confirmOk(X);
    check('"Team verlassen" leaves the team and goes to the overview', /\/Teams$/.test(X.url()) && /verlassen/.test(await toastText(X)), X.url());
    check('the team is gone from the menu and its pages are 404', !(await menuTeams(X)).some(t => t.text === teamName) && (await X.goto(base + `/Teams/${slug}/Projekte`)).status() === 404);
  });

  await section('settings, ownership, delete', async () => {
    const throwaway = `Wegwerf ${stamp}`;
    await go(A, '/Teams/Create');
    await A.fill('#Input_Name', throwaway);
    await Promise.all([A.waitForNavigation(), A.click('button[type=submit].mat-btn--primary')]);
    const slug2 = decodeURIComponent(A.url()).split('/')[4];
    // change name and description in the settings
    await go(A, `/Teams/${slug2}/Einstellungen`);
    await shot(A, 'team-settings');
    await A.fill('#Input_Description', 'Nur zum Löschen.');
    await Promise.all([A.waitForNavigation(), A.click('button[type=submit].mat-btn--primary')]);
    check('the settings are saved', /Die Einstellungen sind gespeichert/.test(await toastText(A)) && (await A.inputValue('#Input_Description')) === 'Nur zum Löschen.');
    check('the owner sees "Inhaberschaft übergeben" and "Team löschen"', /Inhaberschaft übergeben/.test(await A.textContent('main')) && /Team löschen/.test(await A.textContent('main')));
    check('the delete button is disabled until the name is typed', await A.isDisabled('[data-delete-team-button]'));
    await A.fill('#ConfirmName', throwaway.slice(0, -1));
    check('a wrong name keeps it disabled', await A.isDisabled('[data-delete-team-button]'));

    // hand the ownership to the viewer: invite B by link
    await go(A, `/Teams/${slug2}/Mitglieder`);
    await A.click('button[data-dialog-open="dt-invite"]');
    await A.waitForSelector('dialog#dt-invite[open]');
    await A.waitForTimeout(250);
    await A.click('#dt-invite label.mat-check:has-text("Einladungslink erzeugen")');
    await A.selectOption('#Input_Role', 'Admin');
    await submitIn(A, '#dt-invite');
    await A.waitForSelector('[data-invite-links]');
    const link2 = (await A.inputValue('.dt-invite-links__url')).replace(/^https?:\/\/[^/]+/, base);
    await B.goto(link2, { waitUntil: 'networkidle' });
    await Promise.all([B.waitForNavigation(), B.click('[data-accept-invitation]')]);
    await go(A, `/Teams/${slug2}/Einstellungen`);
    await A.selectOption('#NewOwnerId', { label: 'E2E Betrachter (Admin)' });
    await A.click('button:has-text("Inhaberschaft übergeben")');
    await confirmOk(A);
    check('the ownership is handed over: A is Admin now and has no delete card', /Die Inhaberschaft ist übergeben/.test(await toastText(A)) && !/Team löschen/.test(await A.textContent('main')));
    await go(A, `/Teams/${slug2}/Mitglieder`);
    check('the list shows A as Admin and B as Inhaber', /Admin/.test(await memberRow(A, 'E2E Gestalter').textContent()) && /Inhaber/.test(await memberRow(A, 'E2E Betrachter').textContent()));
    const deleteDenied = await postJson(A, `/api/spaces/${(await get(A, '/api/spaces')).body.find(s => s.slug === slug2).id}/delete`, { name: throwaway });
    check('an Admin cannot delete the team (403 from the API)', deleteDenied.status === 403, String(deleteDenied.status));

    // B (Owner now) deletes it with the name typed
    await go(B, `/Teams/${slug2}/Einstellungen`);
    await B.fill('#ConfirmName', throwaway);
    check('the right name enables the button', !(await B.isDisabled('[data-delete-team-button]')));
    await shot(B, 'team-delete');
    await Promise.all([B.waitForNavigation(), B.click('[data-delete-team-button]')]);
    check('deleting the team goes to the overview and says what happens to the content', /\/Teams$/.test(B.url()) && /ist gelöscht/.test(await toastText(B)));
    check('the team is gone for everybody (404)', (await B.goto(base + `/Teams/${slug2}/Projekte`)).status() === 404 && (await A.goto(base + `/Teams/${slug2}/Projekte`)).status() === 404);
  });

  // ------------------------------------------------------------------------------------------------ 7. administration: teams, support join, mail
  await section('admin teams', async () => {
    await go(C, '/Admin/Teams');
    check('the admin sees the team in the list with its members', (await C.textContent('#admin-teams')).includes(teamName));
    await shot(C, 'admin-teams');
    await C.click(`#admin-teams a:has-text("${teamName}")`);
    await C.waitForURL(/\/Admin\/Teams\/Details/);
    check('the detail page lists the members and says the content stays closed', /E2E Gestalter/.test(await C.textContent('#admin-team-members')) && /nicht, was es enthält/.test(await C.textContent('main')));
    await shot(C, 'admin-team-details');
    check('before joining, the administrator has no access to the team', (await C.goto(base + `/Teams/${slug}/Projekte`)).status() === 404);
    await C.goBack();
    await C.waitForLoadState('networkidle');
    await C.click('button:has-text("Mir beitreten")');
    await confirmOk(C);
    check('"Mir beitreten (Support)" makes the administrator an Admin of the team', /Du bist dem Team als Admin beigetreten/.test(await toastText(C)) && (await C.$$('a:has-text("Team öffnen")')).length === 1);
    await go(A, `/Teams/${slug}/Mitglieder`);
    check('the team sees the administrator in its list', (await A.textContent('#members-table')).includes(accounts.admin.email), (await A.textContent('#members-table')).replace(/\s+/g, ' ').slice(0, 200));
    const log = await C.goto(base + '/Admin/Activity?q=beigetreten', { waitUntil: 'networkidle' });
    check('the activity log has the join', log.status() === 200 && /Administrator ist einem Team beigetreten/.test(await C.textContent('main')));
  });

  await section('admin mail', async () => {
    await go(C, '/Admin/Mail');
    await shot(C, 'admin-mail');
    check('the mail page has the SMTP fields, the password note and the test form', (await C.$$('#Input_Host, #Input_Port, #Input_FromAddress')).length === 3 && await C.isVisible('#TestTo'));
    await C.fill('#TestTo', 'test@example.com');
    await Promise.all([C.waitForNavigation(), C.click('button:has-text("Testnachricht senden")')]);
    check('a test without settings says why it failed', /Der Test ist fehlgeschlagen/.test(await toastText(C)) && /nicht vollständig|ausgeschaltet/.test(await toastText(C)), await toastText(C));
    await C.fill('#Input_FromAddress', 'design@example.com');
    await C.click('label.mat-switch:has-text("Mails verschicken")');
    await Promise.all([C.waitForNavigation(), C.click('button[type=submit].mat-btn--primary')]);
    check('switching on without a server is refused with a message', /Zum Einschalten braucht es den Server/.test(await C.textContent('main')));
    await C.fill('#Input_FromAddress', 'nicht-gut');
    await C.click('button[type=submit].mat-btn--primary');
    await C.waitForTimeout(300);
    check('a sender address that is none is stopped at the field', /gültigen Wert/.test(await C.textContent('main')));
  });

  // ------------------------------------------------------------------------------------------------ 8. registration: approval, then open, domains
  await section('registration', async () => {
    const waiting = `Wartend ${stamp}`;
    await go(C, '/Admin/Platform');
    await C.click('label.mat-check:has-text("Mit Freigabe")');
    await C.fill('#Input_AllowedDomains', 'example.com\n@Firma.Example');
    await Promise.all([C.waitForNavigation(), C.click('button[type=submit].mat-btn--primary')]);
    check('registration with approval and two domains is saved', /gespeichert/.test(await toastText(C)) && (await C.inputValue('#Input_AllowedDomains')).includes('firma.example'));

    const ctxR = await newContext(browser, wide);
    const R = await ctxR.newPage();
    watch(R, 'R');
    await R.goto(base + '/Account/Login', { waitUntil: 'networkidle' });
    check('the sign-in page links to "Konto erstellen"', await R.isVisible('[data-register-link]'));
    await R.click('[data-register-link]');
    await R.waitForURL(/\/Account\/Register$/);
    check('the register page says the administration approves, and names the domains', /gibt die Administration dein Konto frei/.test(await R.textContent('.mat-auth__brand')) && /example\.com, firma\.example/.test(await R.textContent('form')));
    await shot(R, 'register');
    await R.fill('#Input_DisplayName', waiting);
    await R.fill('#Input_Email', `jemand${stamp}@fremd.test`);
    await R.fill('#Input_Password', PASSWORD);
    await R.fill('#Input_PasswordRepeat', PASSWORD);
    await Promise.all([R.waitForNavigation(), R.click('button[type=submit].mat-btn--primary')]);
    check('an address of another domain is refused at the field', /Erlaubt sind nur Adressen von/.test(await R.textContent('form')) && /\/Account\/Register/.test(R.url()));
    await R.fill('#Input_Email', waitingMail);
    await R.fill('#Input_Password', PASSWORD);
    await R.fill('#Input_PasswordRepeat', PASSWORD + 'x');
    await Promise.all([R.waitForNavigation(), R.click('button[type=submit].mat-btn--primary')]);
    check('different passwords are refused at the field', /stimmen nicht überein/.test(await R.textContent('form')));
    await R.fill('#Input_Password', PASSWORD);
    await R.fill('#Input_PasswordRepeat', PASSWORD);
    await Promise.all([R.waitForNavigation(), R.click('button[type=submit].mat-btn--primary')]);
    check('a registration with approval ends on the waiting page', /\/Account\/Pending$/.test(R.url()) && /Dein Konto wartet auf Freigabe/.test(await R.textContent('h1')));
    await shot(R, 'pending');
    // the same address again: the same page, nothing new
    await R.goto(base + '/Account/Register', { waitUntil: 'networkidle' });
    await R.fill('#Input_DisplayName', 'Zweiter Versuch');
    await R.fill('#Input_Email', waitingMail);
    await R.fill('#Input_Password', PASSWORD);
    await R.fill('#Input_PasswordRepeat', PASSWORD);
    await Promise.all([R.waitForNavigation(), R.click('button[type=submit].mat-btn--primary')]);
    check('registering the same address again ends the same way (nothing tells it exists)', /\/Account\/Pending$/.test(R.url()));
    // signing in while waiting shows the page
    await login(R, { email: waitingMail, password: PASSWORD });
    check('signing in while waiting shows the waiting page', /\/Account\/Pending$/.test(R.url()), R.url());

    // the administrator approves in the list
    await go(C, '/Admin/Users?status=pending');
    check('the list of users has the pending filter and the account with "Freigeben" and "Ablehnen"', (await C.textContent('#user-table')).includes(waiting) && await C.isVisible(`#user-table tr:has-text("${waiting}") button:has-text("Freigeben")`) && await C.isVisible(`#user-table tr:has-text("${waiting}") button:has-text("Ablehnen")`));
    await shot(C, 'admin-users-pending');
    check('the administrator has a notification about it', (await get(C, '/api/notifications')).body.items.some(n => n.kind === 'registration-pending' && n.text.includes(waiting)));
    await Promise.all([C.waitForNavigation(), C.click(`#user-table tr:has-text("${waiting}") button:has-text("Freigeben")`)]);
    check('approving says so', /Das Konto ist freigegeben/.test(await toastText(C)));
    check('the account can sign in now', await login(R, { email: waitingMail, password: PASSWORD }));
    await ctxR.close();
    // a second account that keeps waiting (the phone pictures of the list need one; the clean up deletes it)
    const ctxW = await newContext(browser, wide);
    const W = await ctxW.newPage();
    watch(W, 'W');
    await W.goto(base + '/Account/Register', { waitUntil: 'networkidle' });
    await W.fill('#Input_DisplayName', `Bleibt wartend ${stamp}`);
    await W.fill('#Input_Email', stillWaitingMail);
    await W.fill('#Input_Password', PASSWORD);
    await W.fill('#Input_PasswordRepeat', PASSWORD);
    await Promise.all([W.waitForNavigation(), W.click('button[type=submit].mat-btn--primary')]);
    check('a second registration waits as well', /\/Account\/Pending$/.test(W.url()));
    await ctxW.close();

    // open registration: sign in afterwards
    await go(C, '/Admin/Platform');
    await C.click('label.mat-check:has-text("Offen")');
    await C.fill('#Input_AllowedDomains', '');
    await Promise.all([C.waitForNavigation(), C.click('button[type=submit].mat-btn--primary')]);
    const ctxO = await newContext(browser, wide);
    const O = await ctxO.newPage();
    watch(O, 'O');
    await O.goto(base + '/Account/Register', { waitUntil: 'networkidle' });
    check('with open registration the page does not mention approval', !/gibt die Administration dein Konto frei/.test(await O.textContent('.mat-auth__brand')));
    await O.fill('#Input_DisplayName', `Offen ${stamp}`);
    await O.fill('#Input_Email', openMail);
    await O.fill('#Input_Password', PASSWORD);
    await O.fill('#Input_PasswordRepeat', PASSWORD);
    await Promise.all([O.waitForNavigation(), O.click('button[type=submit].mat-btn--primary')]);
    check('open registration leads to the sign-in page with the message', /\/Account\/Login/.test(O.url()) && /Registrierung ist eingegangen/.test(await toastText(O)), O.url());
    check('and the new account signs in', await login(O, { email: openMail, password: PASSWORD }));
    check('a person without a team has the overview with "Team erstellen" and no tile', (await go(O, '/Teams'), (await O.$$('[data-team]')).length === 0 && await O.isVisible('a[href="/Teams/Create"]')));
    await ctxO.close();

    // back to off
    await go(C, '/Admin/Platform');
    await C.click('label.mat-check:has-text("Aus: nur mit Einladung")');
    await Promise.all([C.waitForNavigation(), C.click('button[type=submit].mat-btn--primary')]);
    check('registration is switched off again', (await C.isChecked('input[name="Input.Registration"][value="off"]')));
  });

  // ------------------------------------------------------------------------------------------------ 9. administration: delete an account with a transfer of its content
  await section('delete with transfer', async () => {
    const leaver = `Gehender ${stamp}`;
    const leaverMail = `gehender${stamp}@example.com`;
    await go(C, '/Admin/Users/Edit');
    await C.fill('#Input_DisplayName', leaver);
    await C.fill('#Input_Email', leaverMail);
    await C.fill('#Input_Password', PASSWORD);
    await Promise.all([C.waitForNavigation(), C.click('button[type=submit].mat-btn--primary')]);
    const leaverId = Number(/id=(\d+)/.exec(C.url())[1]);
    const ctxL = await newContext(browser, wide);
    const L = await ctxL.newPage();
    watch(L, 'L');
    await login(L, { email: leaverMail, password: PASSWORD });
    const made = await postJson(L, '/api/designs', { preset: 'price-tag' });
    await postJson(L, `/api/designs/${made.body.id}/rename`, { name: `Erbstück ${stamp}` });
    await ctxL.close();

    await go(C, `/Admin/Users/Edit?id=${leaverId}`);
    check('the edit page has the card for the storage and for deleting the account', /Speicherplatz/.test(await C.textContent('main')) && await C.isVisible('button[data-dialog-open="dt-delete-user"]'));
    await C.click('button[data-dialog-open="dt-delete-user"]');
    await C.waitForSelector('dialog#dt-delete-user[open]');
    await C.waitForTimeout(250);
    await C.click('#dt-delete-user label.mat-check:has-text("an eine Person")');
    await C.selectOption('#TransferUserId', { label: `E2E Gestalter (${accounts.designer.email})` });
    await shot(C, 'admin-delete-dialog');
    await Promise.all([C.waitForNavigation(), C.click('#dt-delete-user button[type=submit]')]);
    check('deleting says the content was handed over', /Inhalte sind übertragen/.test(await toastText(C)) && /\/Admin\/Users$/.test(C.url()));
    const folders = await get(A, '/api/items?scope=space&kinds=folder&take=100');
    const wrapper = (folders.body.items || []).find(f => f.name === `Übernommen von ${leaver}`);
    check('the person who got it has a folder "Übernommen von ..."', !!wrapper);
    const inside = wrapper ? await get(A, `/api/items?scope=space&folder=${wrapper.id}&kinds=design`) : { body: { items: [] } };
    check('with the design of the person who left inside', inside.body.items.some(i => i.name === `Erbstück ${stamp}`), JSON.stringify(inside.body.items.map(i => i.name)));
    check('A was told', (await get(A, '/api/notifications')).body.items.some(n => n.kind === 'content-transferred' && n.text.includes(leaver)));
    await go(C, `/Admin/Users?q=${encodeURIComponent(leaverMail)}`);
    check('the account is gone from the list', (await C.$$('#user-table')).length === 0);
    // clean up what was handed over
    if (wrapper) {
      await postJson(A, '/api/items/trash', { items: [{ kind: 'folder', id: wrapper.id }] });
      await postJson(A, '/api/items/purge', { items: [{ kind: 'folder', id: wrapper.id }] });
    }
  });

  // ------------------------------------------------------------------------------------------------ 10. the phone
  await section('phone', async () => {
    const phone = await newContext(browser, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const P = await phone.newPage();
    watch(P, 'phone');
    await login(P, accounts.designer);
    await go(P, '/Teams');
    await shot(P, 'teams-overview');
    await go(P, `/Teams/${slug}/Mitglieder`);
    const overflow = await P.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('the member page does not scroll sideways on a phone', overflow <= 1, `overflow ${overflow}px`);
    await shot(P, 'team-members');
    await P.click('button[data-dialog-open="dt-invite"]');
    await P.waitForSelector('dialog#dt-invite[open]');
    await P.waitForTimeout(300);
    await shot(P, 'invite-dialog');
    await P.click('#dt-invite button[data-dialog-close]');
    for (const tab of ['Projekte', 'Marke', 'Vorlagen', 'Einstellungen']) {
      await go(P, `/Teams/${slug}/${tab}`);
      const o = await P.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(`the ${tab} tab fits a phone`, o <= 1, `overflow ${o}px`);
    }
    await shot(P, 'team-settings');
    // the bell in the phone's top bar
    const shared = await postJson(P, '/api/designs', { preset: 'price-tag' });
    const found = await P.evaluate(async q => (await fetch('/api/share/search?q=' + encodeURIComponent(q))).json(), accounts.viewer.email);
    await postJson(P, `/api/share/design/${shared.body.id}`, { userId: found.find(r => r.type === 'user').id, permission: 'View', message: 'Für unterwegs.' });
    const phoneB = await newContext(browser, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const PB = await phoneB.newPage();
    watch(PB, 'phoneB');
    await login(PB, accounts.viewer);
    await go(PB, '/Teams');
    await PB.waitForFunction(() => { const b = document.querySelector('[data-notify-badge]'); return b && !b.hidden; }, null, { timeout: 10000 });
    check('the bell fits the top bar of a phone', await PB.isVisible('.mat-topbar [data-notify-toggle]'));
    await PB.tap('[data-notify-toggle]');
    await PB.waitForSelector('.dt-notify:not([hidden]) .dt-notif');
    const box = await PB.locator('.dt-notify').boundingBox();
    check('the popover fits the screen width', box.x >= 0 && box.x + box.width <= 390 + 1, JSON.stringify(box));
    await shot(PB, 'bell-popover');
    await PB.keyboard.press('Escape');
    await postJson(P, '/api/items/trash', { items: [{ kind: 'design', id: shared.body.id }] });
    await postJson(P, '/api/items/purge', { items: [{ kind: 'design', id: shared.body.id }] });
    // registration on a phone
    const phoneX = await newContext(browser, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const PX = await phoneX.newPage();
    watch(PX, 'phoneX');
    const link = (await (async () => {
      await go(A, `/Teams/${slug}/Mitglieder`);
      await A.click('button[data-dialog-open="dt-invite"]');
      await A.waitForSelector('dialog#dt-invite[open]');
      await A.waitForTimeout(250);
      await A.click('#dt-invite label.mat-check:has-text("Einladungslink erzeugen")');
      await submitIn(A, '#dt-invite');
      await A.waitForSelector('[data-invite-links]');
      return A.inputValue('.dt-invite-links__url');
    })()).replace(/^https?:\/\/[^/]+/, base);
    await PX.goto(link, { waitUntil: 'networkidle' });
    await shot(PX, 'invite-accept-signed-out');
    await PX.click('[data-invite-register]');
    await PX.waitForURL(/Register/);
    const ro = await PX.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('the register page fits a phone', ro <= 1, `overflow ${ro}px`);
    await shot(PX, 'register');
    // the other pages of this phase on a phone: no sideways scrolling, a picture of each
    const fits = async (p, name) => { const o = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); check(`${name} fits a phone`, o <= 1, `overflow ${o}px`); };
    await go(P, '/Account/Notifications');
    await fits(P, 'the page Benachrichtigungen');
    await shot(P, 'notifications-page');
    await go(P, '/Account/Profile');
    await fits(P, 'the profile');
    await P.locator('[data-mail-settings]').scrollIntoViewIfNeeded();
    await shot(P, 'profile-mail');
    await go(P, `/Teams/${slug}/Vorlagen`);
    await shot(P, 'team-templates');
    await go(P, `/Teams/${slug}/Marke`);
    await shot(P, 'team-brand');
    await go(P, `/Teams/${slug}/Projekte`);
    await shot(P, 'team-projekte');
    const phoneAdmin = await newContext(browser, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const PA = await phoneAdmin.newPage();
    watch(PA, 'phoneAdmin');
    await login(PA, accounts.admin);
    for (const [url, name] of [['/Admin/Users?status=pending', 'admin-users-pending'], ['/Admin/Teams', 'admin-teams'], ['/Admin/Platform', 'admin-platform'], ['/Admin/Mail', 'admin-mail']]) {
      await go(PA, url);
      await fits(PA, `the admin page ${name}`);
      await shot(PA, name);
    }
    const phoneAnon = await newContext(browser, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const PN = await phoneAnon.newPage();
    watch(PN, 'phoneAnon');
    await PN.goto(base + '/Account/Pending', { waitUntil: 'networkidle' });
    await fits(PN, 'the waiting page');
    await shot(PN, 'pending');
    await phone.close();
    await phoneB.close();
    await phoneX.close();
    await phoneAdmin.close();
    await phoneAnon.close();
  });

  // ------------------------------------------------------------------------------------------------ clean up: the team goes (the owner types the name)
  await section('clean up', async () => {
    await go(A, `/Teams/${slug}/Einstellungen`);
    await A.fill('#ConfirmName', teamName);
    await Promise.all([A.waitForNavigation(), A.click('[data-delete-team-button]')]);
    check('clean up: the team of the check is deleted', /\/Teams$/.test(A.url()) && (await menuTeams(A)).every(t => t.text !== teamName));
    // the invitations of the deleted team are dead
    const anyLink = linkUrl.replace(/^https?:\/\/[^/]+/, base);
    check('clean up: the link of a deleted team does not work', (await X.goto(anyLink, { waitUntil: 'networkidle' })).status() === 404);
    // the accounts the check made go as well (the administrator deletes them, nothing is handed over)
    for (const email of [newMail, waitingMail, stillWaitingMail, openMail]) {
      await go(C, `/Admin/Users?q=${encodeURIComponent(email)}`);
      const link = C.locator('#user-table a[href^="/Admin/Users/Edit"]').first();
      if ((await link.count()) === 0) { continue; }
      await link.click();
      await C.waitForURL(/\/Admin\/Users\/Edit/);
      await C.click('button[data-dialog-open="dt-delete-user"]');
      await C.waitForSelector('dialog#dt-delete-user[open]');
      await C.waitForTimeout(250);
      await C.click('#dt-delete-user label.mat-check:has-text("Nicht übertragen")');
      await Promise.all([C.waitForNavigation(), C.click('#dt-delete-user button[type=submit]')]);
      await go(C, `/Admin/Users?q=${encodeURIComponent(email)}`);
      check(`clean up: the account ${email} is deleted`, (await C.$$('#user-table')).length === 0);
    }
  });

  check('no console errors and no CSP violations', problems.length === 0, problems.join(' | '));
  await browser.close();
  let failed = 0;
  for (const r of results) {
    if (!r.ok) { failed++; }
    console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail && !r.ok ? ' - ' + r.detail : ''}`);
  }
  console.log(`\n${results.length - failed} of ${results.length} checks passed. Screenshots: ${outDir}`);
  process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
