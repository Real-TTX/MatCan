/* MatCan editor, part 12b: sharing in the top bar (docs/PLAN-PLATFORM.md sections 1.6, 1.10, 1.11). Loaded after designer.file.js and before designer.js, which calls D.share.init.
   - "Teilen" (people who may edit) opens the dialog of js/share.js (DtShare.open); somebody who may only look gets "Kopie erstellen" instead: a dialog that asks where the copy goes (DtMove.pick of the
     file browser, else a plain choice of the areas) and opens the copy. Herunterladen and Drucken stay for everybody.
   - The avatars next to the buttons: the people who have access (at most 4 and "+N"), the ones who have the design open right now first, with a green dot (title: "Anna bearbeitet gerade").
   - Presence: POST /api/designs/{id}/presence every 15 s while the tab is visible (at once when it becomes visible, with { leave: true } when the page goes away). The answer lists everybody who has the
     design open; a toast says "Anna bearbeitet dieses Design gerade." when somebody else is editing (the revision check of the save still guards the document: the conflict dialog).
   D.share = { init, copyDialog, presence() }. */
(function () {
  'use strict';

  var D = window.DtDesigner;
  var app;
  var config;
  var refs;
  var HEARTBEAT_MS = 15000;
  var MAX_AVATARS = 4;
  var access = [];          // [{ userId, name }] the people who have access
  var present = [];         // [{ userId, name, editing, you }] who has the design open right now
  var knownEditors = {};    // userId -> true: the editors the toast already named
  var timer = 0;
  var gone = false;

  function request(method, url, body, options) {
    return D.request(method, url, body, options).catch(function () { return { ok: false, status: 0, data: null }; });
  }

  function names(list) {
    if (list.length === 1) { return list[0]; }
    if (list.length === 2) { return list[0] + ' und ' + list[1]; }
    return list.slice(0, list.length - 1).join(', ') + ' und ' + list[list.length - 1];
  }

  // ================================================================================================ the people next to the buttons

  function avatar(person, isPresent) {
    var node = D.el('span', { class: 'dt-person' + (isPresent ? ' is-present' : ''), title: person.title });
    node.appendChild(window.DtShare ? window.DtShare.avatar(person.name, { size: 'sm' }) : D.el('span', { class: 'mat-avatar mat-avatar--sm', text: (person.name || '?').slice(0, 1).toUpperCase() }));
    if (isPresent) { node.appendChild(D.el('span', { class: 'mat-avatar__status mat-avatar__status--ok dt-person__dot' })); }
    return node;
  }

  function renderPeople() {
    var host = refs.people;
    if (!host) { return; }
    D.empty(host);
    var me = present.find(function (p) { return p.you; });
    var others = present.filter(function (p) { return !p.you; });
    var byId = {};
    var list = [];
    others.forEach(function (p) {
      byId[p.userId] = true;
      list.push({ userId: p.userId, name: p.name, present: true, title: p.name + (p.editing ? ' bearbeitet gerade' : ' sieht gerade zu') });
    });
    access.forEach(function (a) {
      if (byId[a.userId]) { return; }
      byId[a.userId] = true;
      var itsMe = me && me.userId === a.userId;
      list.push({ userId: a.userId, name: a.name, present: false, title: a.name + (itsMe ? ' (du)' : ' hat Zugriff') });
    });
    host.hidden = !list.length;
    if (!list.length) { return; }
    var shown = list.slice(0, MAX_AVATARS);
    var more = list.length - shown.length;
    var stack = D.el('button', { type: 'button', class: 'dt-people__stack mat-avatars', title: list.length + (list.length === 1 ? ' Person hat' : ' Personen haben') + ' Zugriff', 'aria-label': 'Personen mit Zugriff anzeigen' });
    shown.forEach(function (p) { stack.appendChild(avatar(p, p.present)); });
    if (more > 0) { stack.appendChild(D.el('span', { class: 'mat-avatar mat-avatar--sm dt-sh-av dt-person__more', text: '+' + more, title: more + ' weitere' })); }
    stack.addEventListener('click', function () { openShare(); });
    host.appendChild(stack);
    host.setAttribute('data-count', String(list.length));
    host.setAttribute('data-present', String(others.length));
  }

  function loadAccess() {
    return request('GET', '/api/share/design/' + config.id).then(function (res) {
      if (!res.ok || !res.data) { return; }
      var seen = {};
      access = [];
      res.data.entries.forEach(function (e) {
        if (!e.userId || seen[e.userId]) { return; }
        seen[e.userId] = true;
        access.push({ userId: e.userId, name: e.name });
      });
      renderPeople();
    });
  }

  // ================================================================================================ Teilen

  function openShare() {
    if (!window.DtShare || !config.canEdit) { return Promise.resolve(); }
    return D.save.flush().then(function () {
      return window.DtShare.open({ kind: 'design', id: config.id, name: app.name });
    }).then(loadAccess);
  }

  // ================================================================================================ Kopie erstellen (for people who may only look)

  function doCopy(spaceId, folderId) {
    return request('POST', '/api/items/copy', { items: [{ kind: 'design', id: config.id }], spaceId: spaceId || null, folderId: folderId || null }).then(function (res) {
      var made = res.ok && res.data && res.data.items && res.data.items[0];
      if (made) {
        D.toast('Deine Kopie ist angelegt. Sie wird geöffnet.', 'success');
        setTimeout(function () { window.location.href = '/Designs/' + made.id + '/Designer'; }, 500);
        return true;
      }
      D.toast((res.data && res.data.error) || 'Die Kopie konnte nicht angelegt werden.', 'danger');
      return false;
    });
  }

  /** A plain choice of the areas the person may write in (used when the move dialog of the file browser is not there). */
  function plainCopyDialog() {
    return request('GET', '/api/spaces').then(function (res) {
      var spaces = (res.ok && Array.isArray(res.data) ? res.data : []).filter(function (s) { return s.myRole && s.myRole !== 'Viewer'; });
      var select = D.el('select', { class: 'mat-select', id: 'dt-copy-space', 'aria-label': 'Wohin soll die Kopie?' });
      spaces.forEach(function (s) { select.appendChild(D.el('option', { value: String(s.id), text: s.name })); });
      return D.dialog.show({
        title: 'Kopie erstellen', icon: 'copy-plus', size: 'sm',
        body: function (body) {
          body.appendChild(D.el('p', { class: 'mat-muted', text: 'Du darfst dieses Design nur ansehen. Die Kopie gehört dir und lässt sich bearbeiten. Wohin soll sie?' }));
          body.appendChild(D.ui.field('Bereich', select));
        },
        buttons: [
          { label: 'Kopie erstellen', kind: 'primary', value: 'ok', onClick: function (api) { api.button('ok').disabled = true; doCopy(Number(select.value), null).then(function (ok) { if (ok) { api.close('ok'); } else { api.button('ok').disabled = false; } }); return false; } },
          { label: 'Abbrechen', kind: 'secondary', value: 'cancel' },
        ],
      });
    });
  }

  function copyDialog() {
    if (window.DtMove && typeof window.DtMove.pick === 'function' && window.DtUi) {
      window.DtMove.pick({ title: 'Kopie erstellen in …', ok: 'Kopie hier erstellen', kinds: ['design'] }, function (spaceId, folderId) { doCopy(spaceId, folderId); });
      return Promise.resolve();
    }
    return plainCopyDialog();
  }

  // ================================================================================================ presence

  function handlePresence(people) {
    present = people;
    var editors = people.filter(function (p) { return !p.you && p.editing; });
    var fresh = editors.filter(function (p) { return !knownEditors[p.userId]; });
    var now = {};
    editors.forEach(function (p) { now[p.userId] = true; });
    knownEditors = now;
    if (fresh.length) {
      var who = names(fresh.map(function (p) { return p.name; }));
      D.toast(who + (fresh.length === 1 ? ' bearbeitet' : ' bearbeiten') + ' dieses Design gerade.', 'warning');
    }
    var root = document.getElementById('dt-ds');
    if (root) { root.setAttribute('data-editors', String(editors.length)); root.setAttribute('data-viewers', String(people.filter(function (p) { return !p.you; }).length)); }
    renderPeople();
  }

  function beat() {
    if (gone || document.hidden) { return Promise.resolve(); }
    return request('POST', '/api/designs/' + config.id + '/presence', {}).then(function (res) {
      if (res.ok && res.data && Array.isArray(res.data.people)) { handlePresence(res.data.people); }
    });
  }

  function leave() {
    if (gone) { return; }
    gone = true;
    clearInterval(timer);
    try { request('POST', '/api/designs/' + config.id + '/presence', { leave: true }, { keepalive: true }); } catch (e) { /* the beat times out after 30 s anyway */ }
  }

  // ================================================================================================ start

  function init(theApp, cfg, elements) {
    app = theApp;
    config = cfg;
    refs = elements;
    if (refs.share) { refs.share.addEventListener('click', openShare); }
    if (refs.copy) { refs.copy.addEventListener('click', copyDialog); }
    window.addEventListener('dt:share-changed', function (ev) { if (ev.detail && ev.detail.kind === 'design' && ev.detail.id === config.id) { loadAccess(); } });
    loadAccess();
    beat();
    timer = setInterval(beat, HEARTBEAT_MS);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { beat(); } });
    window.addEventListener('pagehide', leave);
    // a page that comes back from the back/forward cache has its heartbeat to start again
    window.addEventListener('pageshow', function (ev) {
      if (ev.persisted && gone) { gone = false; clearInterval(timer); timer = setInterval(beat, HEARTBEAT_MS); beat(); }
    });
  }

  D.share = { init: init, copyDialog: copyDialog, openShare: openShare, presence: function () { return present.slice(); }, beat: beat };
})();
