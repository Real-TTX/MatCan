// Checks the comments of the editor (docs/PLAN-PLATFORM.md section 1, item 18; phase P5):
//  - the rail entry "Kommentare" and its badge, the panel (filter Offen / Erledigt / Alle, "Nur diese Seite", the composer), a comment on the page, a pin set by a click ("Pin setzen", Esc cancels),
//    a comment pinned to an element (the pin follows the element after it moved), replies, resolve and reopen (the pin of a resolved thread hides), edit one's own, delete (own, and as the manager)
//  - @mentions with the keyboard (arrows, Enter), only people who can see the design; the notification of the person (the bell, the link `?comment=`), a reply notifies the author of the thread
//  - a person with View only writes in the read-only editor but cannot change the comments of others
//  - pins are no part of the document: not in a PNG or SVG download, not in the thumbnail, not in the public view
//  - the deep link `?comment=<id>`, a deleted element or page leaves the comment where it is, the context menu "Kommentieren", the key K, polling, the phone (390: sheet, pin tap)
//
//   node comments-check.js [base url, default http://localhost:3043] [--out <folder for the screenshots, default: the temp folder>]
// The check makes its own accounts (lib.js; DT_ACCOUNT_FILE); the designs it makes are deleted at the end.
const fs = require('fs');
const os = require('os');
const path = require('path');
const lib = require('./lib.js');
const E = require('./editor-lib.js');

const args = process.argv.slice(2);
const { base, problems, watch, launch, newContext, login, ensureAccounts, postJson, shareWith } = lib(args, { ignore: /status of (400|403|404|409|429)/ });
const outIndex = args.indexOf('--out');
const outDir = path.resolve(outIndex >= 0 ? args[outIndex + 1] : path.join(os.tmpdir(), 'designthix-comments-check'));
fs.mkdirSync(outDir, { recursive: true });

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); };
const stamp = String(Date.now()).slice(-6);
let shotNo = 0;
const shot = async (page, name) => {
  shotNo++;
  await page.screenshot({ path: path.join(outDir, `${String(shotNo).padStart(2, '0')}-${name}-${page.viewportSize().width}.png`) });
};

(async () => {
  const browser = await launch();
  const accounts = await ensureAccounts(browser);
  const wide = { viewport: { width: 1440, height: 900 } };
  const ctxA = await newContext(browser, wide);
  const ctxB = await newContext(browser, wide);
  const ctxX = await newContext(browser, wide);
  const A = await ctxA.newPage();
  const B = await ctxB.newPage();
  const X = await ctxX.newPage();
  [[A, 'A'], [B, 'B'], [X, 'anonym']].forEach(([p, n]) => watch(p, n));
  check('A (Gestalter) and B (Betrachter) sign in', (await login(A, accounts.designer)) && (await login(B, accounts.viewer)));
  const cleanup = { designs: [] };

  // ---------------------------------------------------------------------------------------------------------------------- helpers
  const csrf = p => p.evaluate(() => document.querySelector('meta[name=dt-csrf]').content);

  /** A design with two pages, a band, a title, a field and an ellipse on each. */
  async function makeDesign(page, name) {
    const made = await postJson(page, '/api/designs', { preset: 'price-tag' });
    const id = made.body.id;
    await postJson(page, `/api/designs/${id}/rename`, { name });
    const pages = [0, 1].map(i => ({
      id: 'p' + (i + 1), name: '',
      background: { color: ['#ffffff', '#fff4d6'][i] },
      elements: [
        { id: 'band' + i, type: 'shape', shape: 'rect', x: 0, y: 0, w: 150, h: 22, fill: '#1fb3d6' },
        { id: 'title' + i, type: 'text', x: 8, y: 30, w: 134, h: 24, text: name + ' – Seite ' + (i + 1), fontFamily: 'Montserrat', fontWeight: 700, fontSize: 28, color: '#1b2733' },
        { id: 'dot' + i, type: 'shape', shape: 'ellipse', x: 100, y: 62, w: 34, h: 34, fill: '#f2a33a' },
      ],
    }));
    const document = { schema: 2, unit: 'mm', width: 150, height: 100, dpi: 300, locale: 'de-DE', fields: [], pages };
    const status = await page.evaluate(async ({ id: i, doc, token }) => {
      const cur = await (await fetch('/api/designs/' + i)).json();
      const r = await fetch('/api/designs/' + i, { method: 'POST', headers: { 'Content-Type': 'application/json', RequestVerificationToken: token }, body: JSON.stringify({ revision: cur.revision, document: doc }) });
      return r.status;
    }, { id, doc: document, token: await csrf(page) });
    if (status !== 200) { throw new Error('document not saved: ' + status); }
    cleanup.designs.push(id);
    return id;
  }

  const api = (page, method, url, body) => page.evaluate(async ({ method: m, url: u, body: b }) => {
    const r = await fetch(u, { method: m, headers: Object.assign({ Accept: 'application/json' }, m === 'GET' ? {} : { 'Content-Type': 'application/json', RequestVerificationToken: document.querySelector('meta[name=dt-csrf]').content }), body: m === 'GET' ? undefined : JSON.stringify(b || {}) });
    let json = null;
    try { json = await r.json(); } catch (e) { /* none */ }
    return { status: r.status, body: json };
  }, { method, url, body });

  const comments = (page, id) => api(page, 'GET', `/api/designs/${id}/comments`).then(r => r.body);
  const cstate = page => page.evaluate(() => { const s = window.DtDesigner.comments.state(); return { open: s.open, total: s.total, filter: s.filter, thisPage: s.thisPage, activeId: s.activeId, loaded: s.loaded, placing: s.placing, draft: s.draft }; });
  const threadCount = page => page.$$eval('.dt-cm-thread', n => n.length);
  const badge = page => page.evaluate(() => { const b = document.querySelector('.dt-rail__btn[data-panel="comments"] .dt-rail__badge'); return b && !b.hidden ? b.textContent : ''; });
  const pins = page => page.evaluate(() => Array.from(document.querySelectorAll('#dt-pins .dt-pin')).map(p => { const r = p.getBoundingClientRect(); return { id: Number(p.getAttribute('data-comment-id')) || 0, draft: p.classList.contains('is-draft'), resolved: p.classList.contains('is-resolved'), active: p.classList.contains('is-active'), cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height }; }));
  const zipEntries = buf => {
    let end = buf.length - 22;
    while (end >= 0 && buf.readUInt32LE(end) !== 0x06054b50) { end--; }
    const count = buf.readUInt16LE(end + 10);
    let p = buf.readUInt32LE(end + 16);
    const out = [];
    for (let i = 0; i < count; i++) {
      const size = buf.readUInt32LE(p + 20);
      const nameLength = buf.readUInt16LE(p + 28);
      const extra = buf.readUInt16LE(p + 30);
      const comment = buf.readUInt16LE(p + 32);
      const local = buf.readUInt32LE(p + 42);
      const name = buf.slice(p + 46, p + 46 + nameLength).toString('utf8');
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      out.push({ name, data: buf.slice(start, start + size) });
      p += 46 + nameLength + extra + comment;
    }
    return out;
  };
  const settle = async page => { await E.idle(page); await E.raf2(page); await E.raf2(page); };
  const openComments = async page => { await E.openPanel(page, 'comments'); await page.waitForFunction(() => window.DtDesigner.comments.state().loaded); await settle(page); };
  const cardOf = (page, text) => page.locator('.dt-cm-thread', { hasText: text }).first();
  const toast = page => page.evaluate(() => document.querySelectorAll('.mat-toast').forEach(t => t.remove()));
  const centreOf = (page, id) => page.evaluate(i => { const r = window.DtDesigner.canvas.clientRectOf(i); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
  const clientAt = (page, x, y) => page.evaluate(p => window.DtDesigner.canvas.toClient(p), { x, y });

  /** Writes a comment with the composer (the pin is whatever the composer holds) and waits until the thread is in the list. */
  async function write(page, text, options) {
    const o = options || {};
    const before = await threadCount(page);
    await page.fill('.dt-cm-input--new', text);
    await page.click('.dt-cm-send');
    if (!o.noWait) {
      await page.waitForFunction(n => document.querySelectorAll('.dt-cm-thread').length > n || !document.querySelector('.dt-cm-input--new').value, before, { timeout: 10000 });
      await page.waitForFunction(t => Array.from(document.querySelectorAll('.dt-cm-thread .dt-cm-text')).some(x => x.textContent.includes(t)) || !!document.querySelector('.mat-toast'), text.slice(0, 20), { timeout: 10000 });
    }
    await settle(page);
  }

  const designId = await makeDesign(A, `Kommentare ${stamp}`);
  const shareRes = await shareWith(A, 'design', designId, accounts.viewer.email, 'View');
  check('the design is shared with B (View)', !!shareRes);

  // ---------------------------------------------------------------------------------------------------------------------- 1. the rail and the empty panel
  await E.openDesigner(A, base, designId);
  check('the rail has the entry "Kommentare" (after Ebenen, before Daten)', await A.evaluate(() => { const b = Array.from(document.querySelectorAll('.dt-rail__btn')).map(x => x.getAttribute('data-panel')); return b.indexOf('comments') === b.indexOf('layers') + 1 && b.indexOf('data') === b.indexOf('comments') + 1; }));
  check('the entry has its label and no badge while nothing is open', /Kommentare/.test(await A.textContent('.dt-rail__btn[data-panel="comments"]')) && (await badge(A)) === '');
  await openComments(A);
  check('the panel has the filter Offen / Erledigt / Alle', (await A.$$eval('.dt-cm-filters [data-filter]', n => n.map(b => b.getAttribute('data-filter')))).join() === 'open,done,all');
  check('"Nur diese Seite" is a switch and off', await A.isVisible('.dt-cm-pageonly') && !(await A.isChecked('.dt-cm-pageonly input')));
  check('the empty list says so', /Noch keine Kommentare/.test(await A.textContent('.dt-cm-list')));
  check('the composer has the field, "Pin setzen", "An Element heften" (off without a selection) and "Senden" (off while empty)', await A.isVisible('.dt-cm-input--new') && await A.isVisible('.dt-cm-place') && await A.isDisabled('.dt-cm-attach') && await A.isDisabled('.dt-cm-send'));
  check('the composer says where the comment goes: the page', /Auf Seite 1/.test(await A.textContent('.dt-cm-target')));
  await shot(A, 'empty-panel');

  // ---------------------------------------------------------------------------------------------------------------------- 2. a comment on the page
  await write(A, 'Bitte den Titel etwas größer machen.');
  check('a comment on the page: the thread appears with author, time and text', await threadCount(A) === 1 && /E2E Gestalter/.test(await A.textContent('.dt-cm-thread .dt-cm-author')) && /gerade eben|vor \d+ Min/.test(await A.textContent('.dt-cm-thread .dt-cm-time')) && /Titel etwas größer/.test(await A.textContent('.dt-cm-thread .dt-cm-text')));
  check('the thread says "Seite 1" and has no pin on the canvas (a comment on the page only)', /Seite 1/.test(await A.textContent('.dt-cm-where')) && (await pins(A)).length === 0);
  check('the badge counts the open thread', (await badge(A)) === '1');
  check('the composer is empty again', (await A.inputValue('.dt-cm-input--new')) === '' && await A.isDisabled('.dt-cm-send'));
  const first = (await comments(A, designId)).threads[0];
  check('the server has it with the page and no pin', first.pageId === 'p1' && first.x === null && first.elementId === null, JSON.stringify(first));

  // ---------------------------------------------------------------------------------------------------------------------- 3. a pin by a click
  await A.click('.dt-cm-place');
  check('"Pin setzen" starts the mode: crosshair class, the hint, no selection', await A.evaluate(() => document.getElementById('dt-ds').classList.contains('is-commenting') && !document.querySelector('.dt-cm-hint').hidden) && (await cstate(A)).placing === true);
  check('the cursor over the canvas is a crosshair', await A.evaluate(() => getComputedStyle(document.getElementById('dt-viewport')).cursor === 'crosshair'));
  await shot(A, 'placing-pin');
  await A.keyboard.press('Escape');
  check('Esc cancels the mode', !(await cstate(A)).placing && await A.evaluate(() => !document.getElementById('dt-ds').classList.contains('is-commenting') && document.querySelector('.dt-cm-hint').hidden));
  check('Esc left no pin and no draft', (await pins(A)).length === 0 && (await cstate(A)).draft.x === null);
  await A.click('.dt-cm-place');
  const spot = await clientAt(A, 40, 75);
  await A.mouse.click(spot.x, spot.y);
  await settle(A);
  check('a click on the page puts a draft pin there and ends the mode', (await cstate(A)).placing === false && (await pins(A)).filter(p => p.draft).length === 1);
  const draftPin = (await pins(A)).find(p => p.draft);
  check('the draft pin sits at the click', Math.abs(draftPin.cx - spot.x) < 2 && Math.abs(draftPin.cy - spot.y) < 2, JSON.stringify([draftPin, spot]));
  check('the composer says "Punkt gesetzt"', /Punkt gesetzt/.test(await A.textContent('.dt-cm-target')) && await A.isVisible('.dt-cm-target__clear'));
  await A.fill('.dt-cm-input--new', 'Hier fehlt noch ein Preis.');
  await shot(A, 'draft-pin');
  await write(A, 'Hier fehlt noch ein Preis.');
  const pinned = (await pins(A)).filter(p => !p.draft);
  check('after sending, the real pin sits at the point, the draft is gone', pinned.length === 1 && Math.abs(pinned[0].cx - spot.x) < 2 && Math.abs(pinned[0].cy - spot.y) < 2 && (await pins(A)).every(p => !p.draft), JSON.stringify(await pins(A)));
  check('the pin is a button with a label that names the author', /Kommentar von E2E Gestalter: Hier fehlt/.test(await A.getAttribute('#dt-pins .dt-pin', 'aria-label')));
  check('the badge says 2', (await badge(A)) === '2');
  const pointComment = (await comments(A, designId)).threads.find(t => t.text.startsWith('Hier fehlt'));
  check('the server stored the point in document units', Math.abs(pointComment.x - 40) < 0.3 && Math.abs(pointComment.y - 75) < 0.3 && pointComment.pageId === 'p1', JSON.stringify(pointComment));

  // the pin follows zoom
  await A.evaluate(() => window.DtDesigner.canvas.setZoom(window.DtDesigner.app.zoom * 0.7, false));
  await settle(A);
  const zoomed = await clientAt(A, 40, 75);
  const pinZ = (await pins(A))[0];
  check('the pin follows the zoom', Math.abs(pinZ.cx - zoomed.x) < 2 && Math.abs(pinZ.cy - zoomed.y) < 2, JSON.stringify([pinZ, zoomed]));
  await A.evaluate(() => window.DtDesigner.canvas.fit());
  await settle(A);

  // ---------------------------------------------------------------------------------------------------------------------- 4. a pin on an element
  await E.selectIds(A, ['dot0']);
  check('with an element selected, "An Element heften" is on', !(await A.isDisabled('.dt-cm-attach')));
  await A.click('.dt-cm-attach');
  check('the composer says the comment is pinned to the element', /an „.*“ geheftet/.test(await A.textContent('.dt-cm-target')), await A.textContent('.dt-cm-target'));
  await write(A, 'Der Kreis ist zu orange.');
  const elPin = (await pins(A)).find(p => !p.draft && p.id !== pointComment.id);
  const dotCentre = await centreOf(A, 'dot0');
  check('the element pin sits at the centre of the element', !!elPin && Math.abs(elPin.cx - dotCentre.x) < 2 && Math.abs(elPin.cy - dotCentre.y) < 2, JSON.stringify([elPin, dotCentre]));
  const dotComment = (await comments(A, designId)).threads.find(t => t.text.startsWith('Der Kreis'));
  check('the server has the element id', dotComment.elementId === 'dot0' && dotComment.pageId === 'p1');
  // move the element (grab it away from the pin): the pin follows
  const g = await E.geometry(A, 'dot0');
  await E.selectIds(A, []);
  await E.drag(A, { x: g.rect.left + g.rect.width * 0.18, y: g.cy }, { x: g.rect.left + g.rect.width * 0.18 - 150, y: g.cy - 60 });
  await settle(A);
  const dotAfter = await centreOf(A, 'dot0');
  const elPinAfter = (await pins(A)).find(p => p.id === dotComment.id);
  check('the element moved on the canvas', Math.abs(dotAfter.x - (dotCentre.x - 150)) < 4, JSON.stringify([dotCentre, dotAfter]));
  check('the pin followed the element', Math.abs(elPinAfter.cx - dotAfter.x) < 2 && Math.abs(elPinAfter.cy - dotAfter.y) < 2, JSON.stringify([elPinAfter, dotAfter]));
  await A.keyboard.press('Control+z');
  await settle(A);
  const dotBack = await centreOf(A, 'dot0');
  const elPinBack = (await pins(A)).find(p => p.id === dotComment.id);
  check('undo moves the pin back with the element', Math.abs(elPinBack.cx - dotBack.x) < 2 && Math.abs(elPinBack.cy - dotBack.y) < 2);
  check('a click on the pin opens the thread, selects the element and marks the pin', await (async () => {
    await A.click('#dt-pins .dt-pin[data-comment-id="' + dotComment.id + '"]');
    await settle(A);
    const s = await cstate(A);
    return s.activeId === dotComment.id && (await A.evaluate(() => window.DtDesigner.app.sel.join())) === 'dot0' && (await pins(A)).find(p => p.id === dotComment.id).active && await A.locator('.dt-cm-thread.is-active', { hasText: 'Der Kreis' }).count() === 1;
  })());
  check('the badge says 3', (await badge(A)) === '3');
  await shot(A, 'three-comments');

  // ---------------------------------------------------------------------------------------------------------------------- 5. replies
  const firstCard = cardOf(A, 'Titel etwas größer');
  await firstCard.locator('.dt-cm-input--reply').fill('Mache ich gleich.');
  await A.keyboard.press('Control+Enter');
  await A.waitForFunction(() => document.querySelectorAll('.dt-cm-reply-item').length === 1);
  check('a reply with Strg+Enter nests under the thread', /Mache ich gleich/.test(await cardOf(A, 'Titel etwas größer').locator('.dt-cm-replies').textContent()));
  check('the reply box is empty again', (await cardOf(A, 'Titel etwas größer').locator('.dt-cm-input--reply').inputValue()) === '');
  const withReply = (await comments(A, designId)).threads.find(t => t.text.startsWith('Bitte den Titel'));
  check('the server nests it one level (parentId) and the reply has no pin', withReply.replies.length === 1 && withReply.replies[0].parentId === withReply.id && withReply.replies[0].x === null && withReply.replies[0].pageId === null);
  check('a reply is no new open thread', (await badge(A)) === '3');
  const noNesting = await api(A, 'POST', `/api/designs/${designId}/comments`, { text: 'Antwort auf Antwort', parentId: withReply.replies[0].id });
  check('a reply to a reply is refused (400, a message)', noNesting.status === 400 && /nur auf Kommentare/.test(noNesting.body.error), JSON.stringify(noNesting));

  // ---------------------------------------------------------------------------------------------------------------------- 6. B: a person with View only
  await E.openDesigner(B, base, designId);
  check('B has the editor read-only', await B.evaluate(() => document.getElementById('dt-ds').classList.contains('is-readonly')) && /Nur ansehen/.test(await B.textContent('.dt-top')));
  await B.waitForFunction(() => window.DtDesigner.comments.state().loaded);
  check('B sees the badge with the open threads in the rail of the read-only editor', (await badge(B)) === '3', await badge(B));
  check('B sees the pins on the canvas', (await pins(B)).filter(p => !p.draft).length === 2, JSON.stringify(await pins(B)));
  await openComments(B);
  check('B sees the three threads and the reply', await threadCount(B) === 3 && await B.$$eval('.dt-cm-reply-item', n => n.length) === 1);
  check('B can write: the composer is there', await B.isVisible('.dt-cm-input--new') && await B.isVisible('.dt-cm-place'));
  await shot(B, 'viewer-panel');
  await write(B, 'Sieht schon gut aus, finde ich.');
  check('B writes a comment in the read-only editor', await threadCount(B) === 4 && /E2E Betrachter/.test(await cardOf(B, 'Sieht schon gut aus').locator('.dt-cm-author').textContent()));
  // what B may do with the comments of A
  check('B cannot edit, delete or resolve what A wrote: no menu and no resolve button on it', await cardOf(B, 'Titel etwas größer').locator('.dt-cm-more').count() === 0 && await cardOf(B, 'Titel etwas größer').locator('.dt-cm-resolve').count() === 0);
  await cardOf(B, 'Sieht schon gut aus').locator('.dt-cm-more').first().click();
  await B.waitForSelector('.mat-menu');
  const menuB = await B.$$eval('.mat-menu .mat-menu__item', n => n.map(x => x.textContent.trim()));
  check('B may edit, resolve and delete the own', menuB.some(t => /Bearbeiten/.test(t)) && menuB.some(t => /erledigt/.test(t)) && menuB.some(t => /Löschen/.test(t)), menuB.join('|'));
  await B.keyboard.press('Escape');
  const rawEdit = await api(B, 'POST', `/api/comments/${withReply.id}/edit`, { text: 'mitgeschrieben' });
  const rawDelete = await api(B, 'POST', `/api/comments/${withReply.id}/delete`, {});
  const rawResolve = await api(B, 'POST', `/api/comments/${withReply.id}/resolve`, {});
  check('the API says 403 to B for edit, delete and resolve of A\'s comment', rawEdit.status === 403 && rawDelete.status === 403 && rawResolve.status === 403, [rawEdit.status, rawDelete.status, rawResolve.status].join());
  // B replies in A's thread
  await cardOf(B, 'Titel etwas größer').locator('.dt-cm-input--reply').fill('Danke, A!');
  await cardOf(B, 'Titel etwas größer').locator('.dt-cm-reply__send').click();
  await B.waitForFunction(() => document.querySelectorAll('.dt-cm-reply-item').length === 2);
  check('B answers in the thread of A', /Danke, A!/.test(await cardOf(B, 'Titel etwas größer').locator('.dt-cm-replies').textContent()));

  // ---------------------------------------------------------------------------------------------------------------------- 7. the notification of the reply (A) and the poll
  await A.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await A.waitForFunction(() => window.DtDesigner.comments.state().total >= 5, null, { timeout: 8000 });
  check('A gets the new comments of B through the poll (the badge counts them)', (await badge(A)) === '4', await badge(A));
  check('the poll is set up (30 s) while the tab is visible', await A.evaluate(() => window.DtDesigner.comments.state().timer > 0));
  check('the reply box of the thread that A answered is empty after the list was refreshed', (await cardOf(A, 'Titel etwas größer').locator('.dt-cm-input--reply').inputValue()) === '');
  // what A has typed into a reply box stays when the list is refreshed (and the field keeps the focus)
  const draftBox = cardOf(A, 'Hier fehlt noch ein Preis').locator('.dt-cm-input--reply');
  await draftBox.click();
  await A.keyboard.type('Entwurf bleibt');
  const totalNow = (await comments(A, designId)).total;
  await api(B, 'POST', `/api/designs/${designId}/comments`, { text: 'Noch ein Kommentar von B.', pageId: 'p1' });
  await A.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await A.waitForFunction(n => window.DtDesigner.comments.state().total > n, totalNow, { timeout: 8000 });
  await settle(A);
  check('a reply being typed survives the refresh of the list, with its focus', (await cardOf(A, 'Hier fehlt noch ein Preis').locator('.dt-cm-input--reply').inputValue()) === 'Entwurf bleibt' && await A.evaluate(() => document.activeElement && document.activeElement.classList.contains('dt-cm-input--reply')));
  await cardOf(A, 'Hier fehlt noch ein Preis').locator('.dt-cm-input--reply').fill('');
  await A.evaluate(() => document.activeElement && document.activeElement.blur());
  const notesA = (await api(A, 'GET', '/api/notifications?take=50')).body;
  const replyNote = notesA.items.find(n => n.kind === 'comment-reply' && (n.url || '').startsWith(`/Designs/${designId}/`));
  check('A got a notification "hat auf deinen Kommentar … geantwortet" with the excerpt and the link to the thread', !!replyNote && /E2E Betrachter hat auf deinen Kommentar in „Kommentare \d+“ geantwortet/.test(replyNote.text) && replyNote.message === 'Danke, A!' && replyNote.url === `/Designs/${designId}/Designer?comment=${withReply.id}`, JSON.stringify(replyNote));
  check('B got none for their own reply', !(await api(B, 'GET', '/api/notifications?take=50')).body.items.some(n => n.kind === 'comment-reply' && (n.url || '').startsWith(`/Designs/${designId}/`)));

  // ---------------------------------------------------------------------------------------------------------------------- 8. mentions with the keyboard
  // start from nothing unread: the other checks leave notifications behind, and the badge of the bell says "99+" after many runs on one database
  await api(B, 'POST', '/api/notifications/read-all', {});
  await api(A, 'POST', '/api/notifications/read-all', {});
  await A.fill('.dt-cm-input--new', '');
  await A.click('.dt-cm-input--new');
  await A.keyboard.type('Hallo @Test');
  await A.waitForTimeout(500);
  check('a name of somebody who cannot see the design is not offered (the administrator has no access)', !(await A.isVisible('.dt-cm-mentions')));
  await A.fill('.dt-cm-input--new', '');
  await A.keyboard.type('Schau mal, @E2E');
  await A.waitForSelector('.dt-cm-mentions:not([hidden]) .dt-cm-mentions__item');
  const offered = await A.$$eval('.dt-cm-mentions__item .dt-cm-mentions__name', n => n.map(x => x.textContent));
  check('typing @ and the start of a name offers the person who can see the design (B), not the person who writes', offered.join() === 'E2E Betrachter', offered.join());
  check('with a design that A manages, the address is shown', /@example\.com/.test(await A.textContent('.dt-cm-mentions__item')));
  await shot(A, 'mention-list');
  await A.keyboard.press('ArrowDown');
  await A.keyboard.press('ArrowUp');
  await A.keyboard.press('Enter');
  check('Enter takes the name: "@E2E Betrachter " is in the text and the list is closed', (await A.inputValue('.dt-cm-input--new')) === 'Schau mal, @E2E Betrachter ' && !(await A.isVisible('.dt-cm-mentions')), await A.inputValue('.dt-cm-input--new'));
  await A.keyboard.type('prüfst du das?');
  await A.keyboard.press('Control+Enter');
  await A.waitForFunction(() => Array.from(document.querySelectorAll('.dt-cm-text')).some(x => x.textContent.includes('prüfst du das')));
  await settle(A);
  check('the sent comment shows the name highlighted', await A.locator('.dt-cm-text .dt-cm-mention', { hasText: '@E2E Betrachter' }).count() === 1);
  // Esc closes the list without taking anything; a click takes a name
  await A.fill('.dt-cm-input--new', '');
  await A.keyboard.type('@E2E');
  await A.waitForSelector('.dt-cm-mentions:not([hidden])');
  await A.keyboard.press('Escape');
  check('Esc closes the list and leaves the text', !(await A.isVisible('.dt-cm-mentions')) && (await A.inputValue('.dt-cm-input--new')) === '@E2E');
  await A.fill('.dt-cm-input--new', '');
  // a mention in the text of a reply is sent, too (B gets two notifications by now)
  await cardOf(A, 'Der Kreis').locator('.dt-cm-input--reply').click();
  await A.keyboard.type('@E2E');
  await A.waitForSelector('.dt-cm-thread .dt-cm-mentions:not([hidden]) .dt-cm-mentions__item');
  await A.click('.dt-cm-thread .dt-cm-mentions__item');
  await A.keyboard.type('was meinst du zum Orange?');
  await A.keyboard.press('Control+Enter');
  await A.waitForFunction(() => document.querySelectorAll('.dt-cm-reply-item').length === 3);
  const notesB = (await api(B, 'GET', '/api/notifications?take=50')).body;
  const mentions = notesB.items.filter(n => n.kind === 'mention' && (n.url || '').startsWith(`/Designs/${designId}/`));
  check('B has two mention notifications (the comment and the reply)', mentions.length === 2, JSON.stringify(notesB.items.map(n => n.kind)));
  const mention = mentions.find(n => /prüfst du das/.test(n.message));
  check('the text says who mentioned B where, with an excerpt', !!mention && /E2E Gestalter hat dich in „Kommentare \d+“ erwähnt\./.test(mention.text) && mention.url.startsWith(`/Designs/${designId}/Designer?comment=`), JSON.stringify(mention));
  const serverMention = (await comments(A, designId)).threads.find(t => /prüfst du das/.test(t.text));
  check('the server keeps the mention (id and name) with the comment', serverMention.mentions.length === 1 && serverMention.mentions[0].name === 'E2E Betrachter');
  // the bell of B in the app shell
  await B.goto(base + '/');
  await B.waitForFunction(() => { const b = document.querySelector('[data-notify-badge]'); return b && !b.hidden && parseInt(b.textContent, 10) >= 2; }, null, { timeout: 10000 });
  check('the bell of B counts them', parseInt(await B.textContent('[data-notify-badge]'), 10) >= 2);
  await B.click('[data-notify-toggle]');
  await B.waitForSelector('.dt-notify:not([hidden]) .dt-notif[data-kind="mention"]');
  const bellText = (await B.locator('.dt-notify .dt-notif[data-kind="mention"]').first().textContent()).replace(/\s+/g, ' ');
  check('the bell lists the mention as text', /E2E Gestalter hat dich in „Kommentare \d+“ erwähnt/.test(bellText), bellText);
  await shot(B, 'bell-mention');
  await Promise.all([B.waitForNavigation(), B.locator('.dt-notify .dt-notif[data-kind="mention"] .dt-notif__main').first().click()]);
  await B.waitForSelector('#dt-ds:not(.is-loading)');
  await B.waitForFunction(() => window.DtDesigner.comments.state().activeId > 0, null, { timeout: 10000 });
  check('a click on the notification opens the editor with the comment panel and the thread marked', /Designer/.test(B.url()) && !/comment=/.test(B.url()) && (await B.evaluate(() => window.DtDesigner.panels.current())) === 'comments' && await B.locator('.dt-cm-thread.is-active').count() === 1, B.url());
  await shot(B, 'deep-link');

  // ---------------------------------------------------------------------------------------------------------------------- 9. resolve, reopen, filters
  await A.fill('.dt-cm-input--new', '');
  const openBefore = await badge(A);
  const dotCard = cardOf(A, 'Der Kreis');
  await dotCard.locator('.dt-cm-resolve').click();
  await A.waitForFunction(() => !Array.from(document.querySelectorAll('.dt-cm-thread .dt-cm-text')).some(x => x.textContent.includes('Der Kreis ist zu orange')), null, { timeout: 8000 });
  await settle(A);
  check('resolving takes the thread out of "Offen", the pin hides and the badge goes down', (await badge(A)) === String(Number(openBefore) - 1) && !(await pins(A)).some(p => p.id === dotComment.id), `${openBefore} -> ${await badge(A)}`);
  await A.click('.dt-cm-filters [data-filter="done"]');
  await settle(A);
  check('"Erledigt" lists it with "Erledigt von …" and shows its pin faded', await threadCount(A) === 1 && /Erledigt von E2E Gestalter/.test(await A.textContent('.dt-cm-resolved')) && (await pins(A)).some(p => p.id === dotComment.id && p.resolved));
  await shot(A, 'resolved');
  await A.click('.dt-cm-filters [data-filter="all"]');
  await settle(A);
  check('"Alle" lists open and done', await threadCount(A) === Number(openBefore), `${await threadCount(A)} / ${openBefore}`);
  check('the counts of the filter buttons are right', (await A.$$eval('.dt-cm-filters [data-filter]', n => n.map(b => b.querySelector('.dt-cm-count').textContent))).join() === `${Number(openBefore) - 1},1,${Number(openBefore)}`, (await A.$$eval('.dt-cm-filters [data-filter]', n => n.map(b => b.querySelector('.dt-cm-count').textContent))).join());
  await cardOf(A, 'Der Kreis').locator('.dt-cm-resolve').click();
  await A.waitForFunction(() => !document.querySelector('.dt-cm-resolved'), null, { timeout: 8000 });
  await A.click('.dt-cm-filters [data-filter="open"]');
  await settle(A);
  check('reopening puts it back into "Offen" with its pin', (await badge(A)) === openBefore && (await pins(A)).some(p => p.id === dotComment.id && !p.resolved));
  // A resolves B's comment (A edits the design, so may), B resolves their own
  const bComment = (await comments(A, designId)).threads.find(t => t.text.startsWith('Sieht schon gut'));
  check('A (may edit) may resolve the thread of B', bComment.canResolve === true);
  // only this page
  await A.evaluate(() => window.DtDesigner.app.setPage(1));
  await settle(A);
  await write(A, 'Auf Seite zwei: Hintergrund prüfen.');
  check('a comment written on page 2 goes to page 2', (await comments(A, designId)).threads.some(t => t.text.startsWith('Auf Seite zwei') && t.pageId === 'p2'));
  await A.click('.dt-cm-pageonly');
  await settle(A);
  check('"Nur diese Seite" shows only the threads of page 2', await threadCount(A) === 1 && /Auf Seite zwei/.test(await A.textContent('.dt-cm-thread')));
  check('only the pins of page 2 are on the canvas (none: the comment has no pin)', (await pins(A)).length === 0);
  await A.click('.dt-cm-pageonly');
  await A.evaluate(() => window.DtDesigner.app.setPage(0));
  await settle(A);
  check('on page 1 the pins of page 1 are back', (await pins(A)).filter(p => !p.draft).length === 2);

  // ---------------------------------------------------------------------------------------------------------------------- 10. edit own, not others'
  await cardOf(A, 'Titel etwas größer').locator('.dt-cm-more').first().click();
  await A.waitForSelector('.mat-menu');
  await A.click('.mat-menu .mat-menu__item:has-text("Bearbeiten")');
  await A.waitForSelector('.dt-cm-input--edit');
  await A.fill('.dt-cm-input--edit', 'Bitte den Titel deutlich größer machen.');
  await A.click('.dt-cm-save');
  await A.waitForFunction(() => Array.from(document.querySelectorAll('.dt-cm-text')).some(x => x.textContent.includes('deutlich größer')));
  check('editing one\'s own comment changes the text and says "bearbeitet"', /bearbeitet/.test(await cardOf(A, 'deutlich größer').locator('.dt-cm-edited').first().textContent()));
  await cardOf(A, 'deutlich größer').locator('.dt-cm-more').first().click();
  await A.waitForSelector('.mat-menu');
  await A.click('.mat-menu .mat-menu__item:has-text("Bearbeiten")');
  await A.waitForSelector('.dt-cm-input--edit');
  await A.keyboard.press('Escape');
  check('Esc cancels the edit', await A.locator('.dt-cm-input--edit').count() === 0);
  await cardOf(A, 'Sieht schon gut').locator('.dt-cm-more').first().click();
  await A.waitForSelector('.mat-menu');
  const menuOther = await A.$$eval('.mat-menu .mat-menu__item', n => n.map(x => x.textContent.trim()));
  check('A cannot edit the comment of B but may resolve and delete it (A manages the design)', !menuOther.some(t => /Bearbeiten/.test(t)) && menuOther.some(t => /Löschen/.test(t)) && menuOther.some(t => /erledigt/.test(t)), menuOther.join('|'));
  await A.keyboard.press('Escape');

  // ---------------------------------------------------------------------------------------------------------------------- 11. delete: own, and as the manager
  await B.evaluate(() => window.DtDesigner.comments.reload());
  await openComments(B);
  const bOwn = await api(B, 'POST', `/api/designs/${designId}/comments`, { text: 'Das lösche ich gleich wieder.' });
  await B.evaluate(() => window.DtDesigner.comments.reload());
  await B.waitForFunction(() => Array.from(document.querySelectorAll('.dt-cm-text')).some(x => x.textContent.includes('lösche ich gleich')));
  await cardOf(B, 'lösche ich gleich').locator('.dt-cm-more').first().click();
  await B.waitForSelector('.mat-menu');
  await B.click('.mat-menu .mat-menu__item:has-text("Löschen")');
  await B.waitForSelector('dialog.mat-dialog[open]');
  check('deleting asks first', /Kommentar löschen\?/.test(await B.textContent('dialog.mat-dialog[open] .mat-dialog__title')));
  await B.click('dialog.mat-dialog[open] button[data-value="delete"]');
  await B.waitForFunction(() => !Array.from(document.querySelectorAll('.dt-cm-text')).some(x => x.textContent.includes('lösche ich gleich')));
  check('B deletes the own comment', !(await comments(A, designId)).threads.some(t => t.id === bOwn.body.id));
  // A (manager) deletes the comment of B
  const before = (await comments(A, designId)).total;
  await A.evaluate(() => window.DtDesigner.comments.reload());
  await cardOf(A, 'Sieht schon gut').locator('.dt-cm-more').first().click();
  await A.waitForSelector('.mat-menu');
  await A.click('.mat-menu .mat-menu__item:has-text("Löschen")');
  await A.waitForSelector('dialog.mat-dialog[open]');
  await A.click('dialog.mat-dialog[open] button[data-value="delete"]');
  await A.waitForFunction(() => !Array.from(document.querySelectorAll('.dt-cm-text')).some(x => x.textContent.includes('Sieht schon gut')));
  check('A deletes the comment of B as the manager of the design', (await comments(A, designId)).total === before - 1);
  // a thread with replies: the replies go along
  const threadWithReplies = (await comments(A, designId)).threads.find(t => t.replies.length >= 1);
  const totalBefore = (await comments(A, designId)).total;
  await api(A, 'POST', `/api/comments/${threadWithReplies.id}/delete`, {});
  check('deleting a thread takes its replies with it', (await comments(A, designId)).total === totalBefore - 1 - threadWithReplies.replies.length);

  // ---------------------------------------------------------------------------------------------------------------------- 12. a deleted element, a deleted page
  await A.reload();
  await A.waitForSelector('#dt-ds:not(.is-loading)');
  await E.idle(A);
  check('after a reload the editor starts with the comment panel open again (the panel is built before the comments start)', (await A.evaluate(() => window.DtDesigner.panels.current())) === 'comments' && await A.isVisible('.dt-cm-composer'));
  await openComments(A);
  const keep = await api(A, 'POST', `/api/designs/${designId}/comments`, { text: 'Am Band, bleibt stehen.', pageId: 'p1', elementId: 'band0', x: 75, y: 11 });
  const onPage2 = await api(A, 'POST', `/api/designs/${designId}/comments`, { text: 'Auf der Seite, die gleich verschwindet.', pageId: 'p2', x: 20, y: 20 });
  check('the API drops an element that is not in the document and a page that is not there', (await api(A, 'POST', `/api/designs/${designId}/comments`, { text: 'Falsches Element', pageId: 'p1', elementId: 'nope', x: 1, y: 1 })).body.elementId === null && (await api(A, 'POST', `/api/designs/${designId}/comments`, { text: 'Falsche Seite', pageId: 'nowhere', x: 1, y: 1 })).body.pageId === null);
  await A.evaluate(() => window.DtDesigner.comments.reload());
  await settle(A);
  await E.selectIds(A, ['band0']);
  await A.keyboard.press('Delete');
  await settle(A);
  await A.evaluate(() => window.DtDesigner.comments.reload());
  await settle(A);
  const bandCard = cardOf(A, 'Am Band, bleibt stehen');
  check('a comment on a deleted element stays and says so', /Element entfernt/.test(await bandCard.locator('.dt-cm-where').textContent()), await bandCard.locator('.dt-cm-where').textContent());
  check('its pin stays at the last point', (await pins(A)).some(p => p.id === keep.body.id));
  await A.evaluate(() => window.DtDesigner.app.deletePage(1));
  await settle(A);
  await A.waitForFunction(() => window.DtDesigner.app.doc.pages.length === 1);
  await settle(A);
  const orphan = cardOf(A, 'Auf der Seite, die gleich verschwindet');
  check('a comment on a deleted page is shown under "Ohne Seite"', /Ohne Seite/.test(await orphan.locator('.dt-cm-where').textContent()) && await orphan.locator('.dt-cm-where').isDisabled());
  await A.keyboard.press('Control+z');
  await A.keyboard.press('Control+z');
  await settle(A);

  // ---------------------------------------------------------------------------------------------------------------------- 13. the context menu and the key K
  await A.evaluate(() => window.DtDesigner.panels.close());
  await settle(A);
  await E.selectIds(A, ['title0']);
  const tc = await centreOf(A, 'title0');
  await A.mouse.click(tc.x + 200, tc.y, { button: 'right' });
  await A.waitForSelector('.mat-menu');
  const entries = await A.$$eval('.mat-menu .mat-menu__item', n => n.map(x => x.textContent.trim()));
  check('the context menu of an element has "Kommentieren"', entries.some(t => /Kommentieren/.test(t)), entries.join('|'));
  await A.click('.mat-menu .mat-menu__item:has-text("Kommentieren")');
  await A.waitForSelector('.dt-cm-input--new');
  check('it opens the panel with the composer pinned to that element', (await A.evaluate(() => window.DtDesigner.panels.current())) === 'comments' && /an „.*“ geheftet/.test(await A.textContent('.dt-cm-target')) && (await cstate(A)).draft.elementId === 'title0', await A.textContent('.dt-cm-target'));
  check('the composer has the focus', await A.evaluate(() => document.activeElement && document.activeElement.classList.contains('dt-cm-input--new')));
  await A.click('.dt-cm-target__clear');
  check('the little x takes the pin off (the comment goes to the page again)', /Auf Seite 1/.test(await A.textContent('.dt-cm-target')) && (await cstate(A)).draft.elementId === null);
  await A.evaluate(() => window.DtDesigner.panels.close());
  await settle(A);
  check('closing the panel drops a pin that was only started', (await pins(A)).every(p => !p.draft) && (await cstate(A)).draft.x === null);
  await E.selectIds(A, ['dot0']);
  await A.evaluate(() => document.getElementById('dt-viewport').focus());
  await A.keyboard.press('k');
  await A.waitForSelector('.dt-cm-input--new');
  check('the key K opens the composer for the selected element', /an „.*“ geheftet/.test(await A.textContent('.dt-cm-target')) && (await cstate(A)).draft.elementId === 'dot0');
  await A.click('.dt-cm-input--new');
  const circlesBefore = await A.evaluate(() => window.DtDesigner.app.elements().length);
  await A.keyboard.type('kcrl');
  check('typing the letters k, c, r, l in the field adds nothing to the page', await A.evaluate(() => window.DtDesigner.app.elements().length) === circlesBefore && (await A.inputValue('.dt-cm-input--new')) === 'kcrl');
  await A.fill('.dt-cm-input--new', '');
  await A.evaluate(() => document.getElementById('dt-viewport').focus());
  await A.keyboard.press('c');
  check('the key C still adds a circle (it was taken before: K is for comments)', await A.evaluate(() => window.DtDesigner.app.elements().length) === circlesBefore + 1);
  await A.keyboard.press('Control+z');
  await A.evaluate(() => window.DtDesigner.app.select([]));
  check('the list of shortcuts names K', await (async () => { await A.keyboard.press('Shift+?'); await A.waitForSelector('dialog.dt-keysdlg[open]'); const t = await A.textContent('dialog.dt-keysdlg'); await A.keyboard.press('Escape'); return /Kommentare/.test(t) && /Kommentar zur Auswahl schreiben/.test(t); })());
  await A.waitForSelector('dialog.dt-keysdlg', { state: 'detached' }).catch(() => { });

  // ---------------------------------------------------------------------------------------------------------------------- 14. the pins are no part of the document
  const dom = await A.evaluate(() => ({ inPage: document.querySelectorAll('#dt-page .dt-pin, #dt-page [class*="dt-pin"]').length, layerInSheet: !!document.querySelector('#dt-sheet > #dt-pins'), layerInPage: !!document.querySelector('#dt-page #dt-pins'), pins: document.querySelectorAll('#dt-pins .dt-pin').length }));
  check('the pins are in their own layer of the sheet, not in the drawing of the page', dom.layerInSheet && !dom.layerInPage && dom.inPage === 0 && dom.pins >= 2, JSON.stringify(dom));
  await A.evaluate(() => window.DtDesigner.panels.close());
  await A.click('#dt-download');
  await A.waitForSelector('dialog.dt-downloaddlg[open]');
  await A.click('.dt-dl__formats [data-fmt="png"]');
  let [download] = await Promise.all([A.waitForEvent('download'), A.click('dialog.dt-downloaddlg button[data-value="go"]')]);
  const pngWith = await E.readDownload(download);
  await A.waitForSelector('dialog.dt-downloaddlg', { state: 'detached' });
  await A.click('#dt-download');
  await A.waitForSelector('dialog.dt-downloaddlg[open]');
  await A.click('.dt-dl__formats [data-fmt="svg"]');
  [download] = await Promise.all([A.waitForEvent('download'), A.click('dialog.dt-downloaddlg button[data-value="go"]')]);
  const svgText = (await E.readDownload(download)).toString('utf8');
  await A.waitForSelector('dialog.dt-downloaddlg', { state: 'detached' });
  check('the SVG download has no pin and no avatar', svgText.includes('<svg') && !/dt-pin|dt-sh-av|data-comment/.test(svgText));
  // the same PNG after every comment is gone: byte for byte the same
  for (const t of (await comments(A, designId)).threads) { await api(A, 'POST', `/api/comments/${t.id}/delete`, {}); }
  await A.evaluate(() => window.DtDesigner.comments.reload());
  await settle(A);
  check('all comments deleted: no pins, no badge', (await pins(A)).length === 0 && (await badge(A)) === '');
  await A.click('#dt-download');
  await A.waitForSelector('dialog.dt-downloaddlg[open]');
  await A.click('.dt-dl__formats [data-fmt="png"]');
  [download] = await Promise.all([A.waitForEvent('download'), A.click('dialog.dt-downloaddlg button[data-value="go"]')]);
  const pngWithout = await E.readDownload(download);
  await A.waitForSelector('dialog.dt-downloaddlg', { state: 'detached' });
  const zipWith = zipEntries(pngWith);
  const zipWithout = zipEntries(pngWithout);
  check('the PNG download (one file per page, in a ZIP) is byte for byte the same with and without comments', zipWith.length === 2 && zipWith.length === zipWithout.length && zipWith.every((f, i) => f.name === zipWithout[i].name && f.data.length > 1000 && f.data.equals(zipWithout[i].data)), zipWith.map(f => f.name + ':' + f.data.length).join(' ') + ' / ' + zipWithout.map(f => f.name + ':' + f.data.length).join(' '));
  // the thumbnail is drawn by the engine from the document (the pins are not in it); the served PNG is the same with or without comments
  const thumb = await A.evaluate(async id => { const r = await fetch('/designs/' + id + '/thumbnail.png'); return { status: r.status, size: (await r.arrayBuffer()).byteLength }; }, designId);
  check('the thumbnail of the design exists', thumb.status === 200 && thumb.size > 500, JSON.stringify(thumb));
  // the public view
  await api(A, 'POST', `/api/designs/${designId}/comments`, { text: 'Nur intern.', pageId: 'p1', x: 10, y: 10 });
  const link = await api(A, 'POST', `/api/share/design/${designId}/link`, { audience: 'Public', permission: 'View', allowDownload: false });
  const info = (await api(A, 'GET', `/api/share/design/${designId}`)).body;
  const token = info.link && info.link.token;
  check('a public link exists', link.status === 200 && !!token, JSON.stringify(link.body).slice(0, 200));
  await X.goto(`${base}/s/${token}`);
  await X.waitForSelector('.dt-pv-page svg, [data-state="ready"]', { timeout: 20000 }).catch(() => { });
  await X.waitForTimeout(800);
  const pv = await X.evaluate(() => ({ pins: document.querySelectorAll('.dt-pin, #dt-pins, [class*="dt-cm-"]').length, text: document.body.innerText.includes('Nur intern'), html: document.documentElement.outerHTML.includes('Nur intern') }));
  check('the public view has no pin, no comment panel and none of the text', pv.pins === 0 && !pv.text && !pv.html, JSON.stringify(pv));
  const payload = await (await X.request.get(`${base}/api/s/${token}`)).text();
  check('the public payload has no comments', !/Nur intern|comments|pinX/i.test(payload));
  await api(A, 'POST', `/api/share/design/${designId}/link/revoke`, {});

  // ---------------------------------------------------------------------------------------------------------------------- 15. the deep link, a person who lost access
  const deep = await api(A, 'POST', `/api/designs/${designId}/comments`, { text: 'Zum Verlinken.', pageId: 'p1', x: 50, y: 50 });
  await E.openDesigner(B, base, designId);
  await B.goto(`${base}/Designs/${designId}/Designer?comment=${deep.body.id}`);
  await B.waitForSelector('#dt-ds:not(.is-loading)');
  await B.waitForFunction(() => window.DtDesigner.comments.state().activeId > 0, null, { timeout: 10000 });
  await settle(B);
  check('?comment=<id> opens the panel on that thread and marks its pin', (await B.evaluate(() => window.DtDesigner.panels.current())) === 'comments' && (await cstate(B)).activeId === deep.body.id && (await pins(B)).some(p => p.id === deep.body.id && p.active), JSON.stringify([await cstate(B), await pins(B)]));
  check('the parameter is taken out of the address', !/comment=/.test(B.url()), B.url());
  await B.goto(`${base}/Designs/${designId}/Designer?comment=987654`);
  await B.waitForSelector('#dt-ds:not(.is-loading)');
  await B.waitForSelector('.mat-toast');
  check('a comment that is gone says so', /Den Kommentar gibt es nicht mehr/.test(await B.evaluate(() => Array.from(document.querySelectorAll('.mat-toast')).map(t => t.textContent).join('|'))), await B.evaluate(() => Array.from(document.querySelectorAll('.mat-toast')).map(t => t.textContent).join('|')));
  // a person who may not see the design: 404 from every API, the page sends them to the request page
  const strangerCtx = await newContext(browser, wide);
  const S = await strangerCtx.newPage();
  watch(S, 'stranger');
  if (accounts.third && await login(S, accounts.third)) {
    check('a person without access gets 404 for the comments of the design', (await api(S, 'GET', `/api/designs/${designId}/comments`)).status === 404 && (await api(S, 'POST', `/api/designs/${designId}/comments`, { text: 'x' })).status === 404);
  } else {
    // no third account in this database: the administrator has no access to a design of somebody else's personal area
    await login(S, accounts.admin);
    check('a person without access gets 404 for the comments of the design', (await api(S, 'GET', `/api/designs/${designId}/comments`)).status === 404 && (await api(S, 'POST', `/api/designs/${designId}/comments`, { text: 'x' })).status === 404);
  }
  await strangerCtx.close();

  // ---------------------------------------------------------------------------------------------------------------------- 16. the screenshots of a full panel at 1440
  for (const t of (await comments(A, designId)).threads) { await api(A, 'POST', `/api/comments/${t.id}/delete`, {}); }
  const seed = [
    ['Der Titel ist zu klein, bitte größer.', { pageId: 'p1', elementId: 'title0', x: 75, y: 42 }],
    ['Passt die Farbe des Bandes zur Marke?', { pageId: 'p1', elementId: 'band0', x: 75, y: 11 }],
    ['Hier fehlt noch ein Preis.', { pageId: 'p1', x: 40, y: 80 }],
    ['Hintergrund auf Seite 2 etwas heller?', { pageId: 'p2' }],
  ];
  const ids = [];
  for (const [text, pin] of seed) { ids.push((await api(A, 'POST', `/api/designs/${designId}/comments`, Object.assign({ text }, pin))).body.id); }
  await api(B, 'POST', `/api/designs/${designId}/comments`, { text: 'Das gefällt mir, finde ich auch.', parentId: ids[0] });
  await api(A, 'POST', `/api/designs/${designId}/comments`, { text: 'Danke, dann lasse ich es so.', parentId: ids[0] });
  await api(A, 'POST', `/api/comments/${ids[1]}/resolve`, {});
  await E.openDesigner(A, base, designId);
  await openComments(A);
  await A.click('.dt-cm-filters [data-filter="all"]');
  await settle(A);
  await A.fill('.dt-cm-input--new', 'Noch ein Gedanke zum Layout, @E2E');
  await A.waitForSelector('.dt-cm-mentions:not([hidden])');
  await toast(A);
  await shot(A, 'panel-full');
  await A.keyboard.press('Escape');
  await A.fill('.dt-cm-input--new', '');
  await A.click('.dt-cm-filters [data-filter="open"]');
  await A.click('#dt-pins .dt-pin[data-comment-id="' + ids[0] + '"]');
  await settle(A);
  await shot(A, 'pin-active');

  // ---------------------------------------------------------------------------------------------------------------------- 17. the phone
  const phoneCtx = await newContext(browser, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const P = await phoneCtx.newPage();
  watch(P, 'phone');
  await login(P, accounts.designer);
  await E.openDesigner(P, base, designId);
  await P.waitForFunction(() => window.DtDesigner.comments.state().loaded);
  await settle(P);
  const pp = (await pins(P)).filter(p => !p.draft);
  check('phone: the pins are on the page and big enough for a finger (36 px)', pp.length >= 2 && pp.every(p => p.w >= 32 && p.h >= 32), JSON.stringify(pp));
  await P.click('#dt-tabbar-more');
  await P.waitForSelector('.mat-menu');
  const moreItems = await P.$$eval('.mat-menu .mat-menu__item', n => n.map(x => x.textContent.trim()));
  check('phone: the "Mehr" menu has "Kommentare" with the count', moreItems.some(t => /^Kommentare \(\d+\)/.test(t)), moreItems.join('|'));
  await P.click('.mat-menu .mat-menu__item:has-text("Kommentare")');
  await P.waitForSelector('.dt-cm-thread');
  await settle(P);
  const sheet = await P.evaluate(() => { const r = document.getElementById('dt-panel').getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: innerWidth, h: innerHeight, sideways: document.documentElement.scrollWidth > innerWidth + 1 }; });
  check('phone: the panel is a bottom sheet across the screen, nothing scrolls sideways', sheet.left <= 1 && sheet.right >= sheet.w - 1 && sheet.bottom <= sheet.h && !sheet.sideways, JSON.stringify(sheet));
  check('phone: the composer is in the sheet below the threads', await P.evaluate(() => { const c = document.querySelector('.dt-cm-composer').getBoundingClientRect(); const l = document.querySelector('.dt-cm-list').getBoundingClientRect(); const s = document.getElementById('dt-panel').getBoundingClientRect(); return c.top >= l.bottom - 1 && c.bottom <= s.bottom + 1; }));
  await toast(P);
  await shot(P, 'sheet');
  await P.fill('.dt-cm-input--new', 'Vom Handy aus geschrieben.');
  await P.tap('.dt-cm-send');
  await P.waitForFunction(() => Array.from(document.querySelectorAll('.dt-cm-text')).some(x => x.textContent.includes('Vom Handy')));
  check('phone: writing a comment works', true);
  await P.evaluate(() => window.DtDesigner.panels.close());
  await settle(P);
  const target = (await pins(P)).find(p => p.id === ids[2]);
  await P.touchscreen.tap(target.cx, target.cy);
  await P.waitForFunction(() => window.DtDesigner.panels.current() === 'comments' && window.DtDesigner.comments.state().activeId > 0, null, { timeout: 8000 });
  check('phone: a tap on a pin opens the sheet on that thread', (await cstate(P)).activeId === ids[2] && await P.locator('.dt-cm-thread.is-active', { hasText: 'Preis' }).count() === 1);
  await settle(P);
  const above = await P.evaluate(id => { const pin = document.querySelector('#dt-pins .dt-pin[data-comment-id="' + id + '"]').getBoundingClientRect(); const sheet = document.getElementById('dt-panel').getBoundingClientRect(); const vp = document.getElementById('dt-viewport').getBoundingClientRect(); return { pinBottom: pin.bottom, pinTop: pin.top, sheetTop: sheet.top, vpTop: vp.top }; }, ids[2]);
  check('phone: the pin of the open thread is scrolled into the part of the page above the sheet', above.pinBottom <= above.sheetTop + 1 && above.pinTop >= above.vpTop - 1, JSON.stringify(above));
  await toast(P);
  await shot(P, 'pin-tap');
  await P.evaluate(() => window.DtDesigner.panels.close());
  await P.evaluate(() => window.DtDesigner.comments.startPlacing());
  check('phone: "Pin setzen" closes the sheet and shows the hint', await P.evaluate(() => window.DtDesigner.panels.current() === null && !document.querySelector('.dt-cm-hint').hidden));
  const spotP = await clientAt(P, 30, 60);
  await P.touchscreen.tap(spotP.x, spotP.y);
  await P.waitForSelector('.dt-cm-target__chip.is-pinned');
  check('phone: a tap on the page sets the pin and reopens the sheet with the composer', /Punkt gesetzt/.test(await P.textContent('.dt-cm-target')));
  await settle(P);
  const draftAbove = await P.evaluate(() => { const pin = document.querySelector('#dt-pins .dt-pin.is-draft').getBoundingClientRect(); const sheet = document.getElementById('dt-panel').getBoundingClientRect(); return { pinBottom: pin.bottom, sheetTop: sheet.top }; });
  check('phone: the new pin is visible above the sheet', draftAbove.pinBottom <= draftAbove.sheetTop + 1, JSON.stringify(draftAbove));
  await toast(P);
  await shot(P, 'place-pin');
  await phoneCtx.close();

  // ---------------------------------------------------------------------------------------------------------------------- clean up
  // what the check wrote to the bells is read (the other checks count the unread ones of these accounts)
  await A.goto(base + '/');
  await api(A, 'POST', '/api/notifications/read-all', {});
  await B.goto(base + '/');
  await api(B, 'POST', '/api/notifications/read-all', {});
  for (const id of cleanup.designs) { await postJson(A, `/api/designs/${id}/delete`, {}).catch(() => { }); }
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
