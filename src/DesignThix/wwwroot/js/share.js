/* DesignThix: the "Teilen" dialog (docs/PLAN-PLATFORM.md section 1.6). ONE entry point for everybody - the editor, the menus of the file browser, the folder header, server-rendered buttons:

     window.DtShare.open({ kind: 'design'|'folder'|'datalist'|'outputjob', id, name })  ->  Promise<{ changed }> (resolves when the dialog closes)
     <button data-share-open data-share-kind="design" data-share-id="12" data-share-name="Flyer">   (the same, without script of your own)

   What it shows comes from GET /api/share/{kind}/{id}: who has access (owner, team members, shares with people and teams, shares inherited through a folder, read only with a link to that folder's
   dialog), the link of the item and what THIS person may do (canShare, canLink, publicLinksAllowed ...). The dialog shows what the API allows and the API enforces it: View cannot share, Edit shares with
   people and teams up to Edit but sets no links, Manage does everything. Search (at least two characters, debounced) fills chips; "Teilen" posts one share per chip. Link: only people with access / every
   signed-in person with the link (ansehen or bearbeiten) / public (designs and folders, when the administrator allows it; download allowed, expiry date); copy; reset. Open access requests of the item
   (Manage) are granted or declined here. Everything is built with DOM APIs (no innerHTML); names and messages of other people only go through textContent. After a change the event
   `dt:share-changed` ({ kind, id }) is fired on window. Also exposed for the editor: DtShare.avatar(name, { color, size }), DtShare.initials(name), DtShare.request(method, url, body). */
(function () {
  'use strict';

  if (window.DtShare) { return; }

  var doc = document;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var KIND_LABEL = { design: 'Design', folder: 'Ordner', datalist: 'Datenliste', outputjob: 'Serienausgabe' };
  var ROLE_LABEL = { Owner: 'Inhaber', Admin: 'Admin', Editor: 'Bearbeiter', Viewer: 'Betrachter' };
  var PERM_LABEL = { view: 'Kann ansehen', edit: 'Kann bearbeiten', manage: 'Kann verwalten' };
  var MEMBERS_SHOWN = 4;
  var seq = 0;

  // ================================================================================================ small helpers

  /** el('div', { class, text, 'aria-label': ..., hidden: true }, [children]); attribute values false/null/undefined are left out. */
  function el(tag, attrs, kids) {
    var node = doc.createElement(tag);
    Object.keys(attrs || {}).forEach(function (name) {
      var v = attrs[name];
      if (v === false || v === null || v === undefined) { return; }
      if (name === 'text') { node.textContent = v; } else if (name === 'class') { node.className = v; } else { node.setAttribute(name, v === true ? '' : String(v)); }
    });
    (kids || []).forEach(function (k) { if (k) { node.appendChild(typeof k === 'string' ? doc.createTextNode(k) : k); } });
    return node;
  }

  function icon(name, cls) {
    var svg = doc.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'mat-icon' + (cls ? ' ' + cls : ''));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var use = doc.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', (doc.getElementById('dt-i-' + name) ? '#dt-i-' : '#mat-i-') + name);
    svg.appendChild(use);
    return svg;
  }

  function csrf() {
    var meta = doc.querySelector('meta[name="dt-csrf"]');
    return meta ? meta.getAttribute('content') : '';
  }

  /** Resolves { ok, status, data } for any answer; a lost connection is a message, never a rejection. */
  function request(method, url, body) {
    var headers = { Accept: 'application/json' };
    var init = { method: method, credentials: 'same-origin', headers: headers };
    if (method !== 'GET') { headers.RequestVerificationToken = csrf(); }
    if (body !== undefined && body !== null) { headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
    return fetch(url, init).then(function (r) {
      return r.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
        return { ok: r.ok, status: r.status, data: data };
      });
    }, function () { return { ok: false, status: 0, data: { error: 'Keine Verbindung. Versuche es gleich noch einmal.' } }; });
  }

  function messageOf(res) {
    if (res.data && res.data.error) { return res.data.error; }
    if (res.status === 403) { return 'Dafür fehlt dir die Berechtigung.'; }
    if (res.status === 404) { return 'Das gibt es nicht (mehr).'; }
    return 'Das hat nicht geklappt (Fehler ' + res.status + ').';
  }

  function toast(message, tone) {
    if (window.MatUi && window.MatUi.toast) { window.MatUi.toast(message, { tone: tone || undefined }); }
  }

  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) { return '?'; }
    var first = Array.from(parts[0])[0] || '?';
    var last = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] || '') : '';
    return (first + last).toUpperCase();
  }

  function hueOf(text) {
    var h = 0;
    for (var i = 0; i < text.length; i++) { h = (h * 31 + text.charCodeAt(i)) % 360; }
    return h;
  }

  /** A round avatar with the initials. options: color (#rrggbb: a team), size ('sm'), team (a group icon instead of initials). The colour goes through the CSSOM. */
  function avatar(name, options) {
    var o = options || {};
    var node = el('span', { class: 'mat-avatar dt-sh-av' + (o.size === 'sm' ? ' mat-avatar--sm' : '') + (o.team ? ' dt-sh-av--team' : ''), 'aria-hidden': 'true' });
    if (o.team) { node.appendChild(icon('users')); } else { node.textContent = initials(name); }
    node.style.setProperty('--dt-av', o.color || 'hsl(' + hueOf(String(name || '')) + ' 42% 36%)');
    return node;
  }

  function dateInputValue(iso) {
    if (!iso) { return ''; }
    var d = new Date(iso);
    if (isNaN(d.getTime())) { return ''; }
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /** The date typed into the field as the end of that day in the person's time zone, as an ISO string for the API. */
  function endOfDayIso(value) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    if (!m) { return null; }
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59).toISOString();
  }

  function linkUrl(token) { return window.location.origin + '/s/' + token; }

  function normKind(kind) {
    var k = String(kind || '').toLowerCase().replace('-', '');
    return k === 'output' ? 'outputjob' : k;
  }

  // ================================================================================================ the dialog

  function open(options) {
    var o = options || {};
    var kind = normKind(o.kind);
    var id = Number(o.id);
    if (!KIND_LABEL[kind] || !id) { toast('Dieses Element lässt sich nicht teilen.', 'danger'); return Promise.resolve({ changed: false }); }
    var base = '/api/share/' + kind + '/' + id;
    var uid = ++seq;
    var state = { info: null, chips: [], results: [], active: -1, requests: [], membersOpen: false, changed: false, query: '', searchSeq: 0 };
    var name = o.name || '';

    var dlg = el('dialog', { class: 'mat-dialog mat-dialog--lg dt-share', 'data-static': '', 'aria-labelledby': 'dt-sh-title-' + uid });
    var title = el('h2', { class: 'mat-dialog__title', id: 'dt-sh-title-' + uid, text: name ? '„' + name + '“ teilen' : KIND_LABEL[kind] + ' teilen' });
    var closeX = el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--icon mat-dialog__close', 'aria-label': 'Schließen', 'data-dialog-close': '' }, [icon('x')]);
    var body = el('div', { class: 'mat-dialog__body dt-share__body' });
    var doneButton = el('button', { type: 'button', class: 'mat-btn mat-btn--primary', 'data-dialog-close': '' }, [el('span', { text: 'Fertig' })]);
    var form = el('form', { class: 'mat-dialog__form', method: 'dialog' }, [
      el('div', { class: 'mat-dialog__head' }, [icon('share-2'), title, closeX]),
      body,
      el('div', { class: 'mat-dialog__foot' }, [el('div', { class: 'mat-btn-row mat-btn-row--plain' }, [doneButton])]),
    ]);
    dlg.appendChild(form);
    form.addEventListener('submit', function (ev) { ev.preventDefault(); });

    // ---- the parts of the body: the loading line, then the sections
    var loading = el('div', { class: 'dt-sh-loading', role: 'status' }, [el('span', { class: 'mat-spinner', 'aria-hidden': 'true' }), el('span', { text: 'Wird geladen …' })]);
    var addBox = el('section', { class: 'dt-sh-sec dt-sh-add', 'aria-label': 'Personen oder Teams hinzufügen', hidden: true });
    var hintBox = el('p', { class: 'mat-muted dt-sh-hint', hidden: true });
    var peopleBox = el('section', { class: 'dt-sh-sec', 'aria-label': 'Personen mit Zugriff', hidden: true });
    var linkBox = el('section', { class: 'dt-sh-sec dt-sh-link', 'aria-label': 'Link', hidden: true });
    var requestBox = el('section', { class: 'dt-sh-sec', 'aria-label': 'Zugriffsanfragen', hidden: true });
    body.appendChild(loading);
    [addBox, hintBox, peopleBox, linkBox, requestBox].forEach(function (b) { body.appendChild(b); });

    // ---- add: chips, search, permission, message, button
    var chipsEl = el('span', { class: 'dt-sh-chips' });
    var search = el('input', {
      type: 'text', class: 'dt-sh-search', id: 'dt-sh-q-' + uid, role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': 'dt-sh-list-' + uid,
      placeholder: 'Name oder E-Mail-Adresse', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Personen oder Teams hinzufügen',
    });
    var field = el('div', { class: 'dt-sh-field' }, [chipsEl, search]);
    var list = el('ul', { class: 'dt-sh-results', id: 'dt-sh-list-' + uid, role: 'listbox', 'aria-label': 'Treffer', hidden: true });
    var searchWrap = el('div', { class: 'dt-sh-searchwrap' }, [field, list]);
    var permSelect = el('select', { class: 'mat-select', id: 'dt-sh-perm-' + uid, 'aria-label': 'Berechtigung' }, [
      el('option', { value: 'view', text: PERM_LABEL.view }), el('option', { value: 'edit', text: PERM_LABEL.edit })]);
    var message = el('input', { type: 'text', class: 'mat-input', id: 'dt-sh-msg-' + uid, placeholder: 'Nachricht hinzufügen (optional)', maxlength: '300', autocomplete: 'off', 'aria-label': 'Nachricht (optional)' });
    var shareButton = el('button', { type: 'button', class: 'mat-btn mat-btn--primary dt-sh-go', disabled: true }, [icon('user-plus'), el('span', { text: 'Teilen' })]);
    var addError = el('p', { class: 'mat-field__error dt-sh-error', role: 'alert', hidden: true });
    addBox.appendChild(el('label', { class: 'mat-label dt-sh-label', for: 'dt-sh-q-' + uid, text: 'Personen oder Teams hinzufügen' }));
    addBox.appendChild(searchWrap);
    addBox.appendChild(el('div', { class: 'dt-sh-addrow' }, [permSelect, message, shareButton]));
    addBox.appendChild(addError);

    function showError(box, text) { box.textContent = text || ''; box.hidden = !text; }

    // ---- search (debounced, at least two characters)
    var timer = 0;

    function closeList() {
      list.hidden = true;
      search.setAttribute('aria-expanded', 'false');
      search.removeAttribute('aria-activedescendant');
      state.active = -1;
    }

    function shownResults() {
      return state.results.filter(function (r) { return !state.chips.some(function (c) { return c.type === r.type && c.id === r.id; }); });
    }

    function setActive(index) {
      var items = list.querySelectorAll('[role="option"]');
      state.active = items.length ? (index + items.length) % items.length : -1;
      items.forEach(function (li, i) { li.setAttribute('aria-selected', String(i === state.active)); li.classList.toggle('is-active', i === state.active); });
      if (state.active >= 0) { search.setAttribute('aria-activedescendant', items[state.active].id); items[state.active].scrollIntoView({ block: 'nearest' }); } else { search.removeAttribute('aria-activedescendant'); }
    }

    function hasAccess(r) {
      return state.info && state.info.entries.some(function (e) { return (r.type === 'team' ? e.spaceId === r.id && e.kind === 'team' : e.userId === r.id) && !e.inherited && e.shareId; });
    }

    function renderResults() {
      list.textContent = '';
      var items = shownResults();
      if (!items.length) {
        if (state.query.length >= 2) {
          list.appendChild(el('li', { class: 'dt-sh-results__empty', role: 'presentation', text: 'Niemanden gefunden.' }));
          list.hidden = false;
          search.setAttribute('aria-expanded', 'true');
        } else { closeList(); }
        state.active = -1;
        return;
      }
      items.forEach(function (r, i) {
        var li = el('li', { class: 'dt-sh-option', role: 'option', id: 'dt-sh-opt-' + uid + '-' + i, 'aria-selected': 'false' }, [
          avatar(r.name, { color: r.type === 'team' ? r.color : null, team: r.type === 'team', size: 'sm' }),
          el('span', { class: 'dt-sh-option__text' }, [el('span', { class: 'dt-sh-option__name', text: r.name }), el('span', { class: 'dt-sh-option__sub', text: r.type === 'team' ? 'Team' : (r.email || '') })]),
          hasAccess(r) ? el('span', { class: 'dt-sh-option__tag', text: 'hat Zugriff' }) : null,
        ]);
        li.addEventListener('pointerdown', function (ev) { ev.preventDefault(); });   // keep the focus in the field
        li.addEventListener('click', function () { pick(r); });
        list.appendChild(li);
      });
      list.hidden = false;
      search.setAttribute('aria-expanded', 'true');
      setActive(0);
    }

    function runSearch() {
      var q = search.value.trim();
      state.query = q;
      if (q.length < 2) { state.results = []; closeList(); return; }
      var mine = ++state.searchSeq;
      request('GET', '/api/share/search?q=' + encodeURIComponent(q)).then(function (res) {
        if (mine !== state.searchSeq || state.query !== q) { return; }
        state.results = res.ok && Array.isArray(res.data) ? res.data : [];
        if (!res.ok) { showError(addError, messageOf(res)); }
        renderResults();
      });
    }

    function pick(r) {
      if (!state.chips.some(function (c) { return c.type === r.type && c.id === r.id; })) { state.chips.push(r); }
      search.value = '';
      state.query = '';
      state.results = [];
      showError(addError, '');
      closeList();
      renderChips();
      search.focus();
    }

    function renderChips() {
      chipsEl.textContent = '';
      state.chips.forEach(function (c, i) {
        var x = el('button', { type: 'button', class: 'dt-sh-chip__x', 'aria-label': c.name + ' entfernen' }, [icon('x')]);
        x.addEventListener('click', function () { state.chips.splice(i, 1); renderChips(); search.focus(); });
        chipsEl.appendChild(el('span', { class: 'dt-sh-chip' }, [avatar(c.name, { color: c.type === 'team' ? c.color : null, team: c.type === 'team', size: 'sm' }), el('span', { class: 'dt-sh-chip__name', text: c.name }), x]));
      });
      shareButton.disabled = !state.chips.length;
    }

    search.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(runSearch, 250); });
    search.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        if (list.hidden) { return; }
        ev.preventDefault();
        setActive(state.active + (ev.key === 'ArrowDown' ? 1 : -1));
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        var items = shownResults();
        if (!list.hidden && state.active >= 0 && items[state.active]) { pick(items[state.active]); } else if (!search.value && state.chips.length) { share(); }
      } else if (ev.key === 'Escape') {
        if (!list.hidden) { ev.preventDefault(); ev.stopPropagation(); closeList(); }
      } else if (ev.key === 'Backspace' && !search.value && state.chips.length) {
        state.chips.pop();
        renderChips();
      }
    });
    search.addEventListener('blur', function () { setTimeout(closeList, 120); });
    field.addEventListener('click', function () { search.focus(); });

    // ---- share: one POST per chip
    function share() {
      if (!state.chips.length || shareButton.disabled) { return Promise.resolve(); }
      var chips = state.chips.slice();
      var permission = permSelect.value;
      var text = message.value.trim();
      shareButton.disabled = true;
      shareButton.setAttribute('aria-busy', 'true');
      showError(addError, '');
      var failed = [];
      var done = [];
      var chain = Promise.resolve();
      chips.forEach(function (c) {
        chain = chain.then(function () {
          var payload = { permission: permission, message: text || null };
          payload[c.type === 'team' ? 'teamId' : 'userId'] = c.id;
          return request('POST', base, payload).then(function (res) {
            if (res.ok) { done.push(c); } else { failed.push(c.name + ': ' + messageOf(res)); }
          });
        });
      });
      return chain.then(function () {
        shareButton.removeAttribute('aria-busy');
        state.chips = state.chips.filter(function (c) { return !done.some(function (d) { return d.type === c.type && d.id === c.id; }); });
        renderChips();
        if (done.length) {
          state.changed = true;
          message.value = '';
          toast('Geteilt mit ' + done.map(function (d) { return d.name; }).slice(0, 3).join(', ') + (done.length > 3 ? ' und ' + (done.length - 3) + ' weiteren' : '') + '.', 'success');
          window.dispatchEvent(new CustomEvent('dt:share-changed', { detail: { kind: kind, id: id } }));
        }
        showError(addError, failed.join(' '));
        return reload();
      });
    }
    shareButton.addEventListener('click', share);
    message.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); share(); } });

    // ---- people with access
    function permissionText(entry) { return PERM_LABEL[entry.permission] || entry.permission; }

    function personRow(entry) {
      var isTeam = entry.kind === 'team';
      var sub = entry.inherited ? '' : (isTeam ? 'Team' : (entry.email || ''));
      var textBox = el('div', { class: 'dt-sh-row__text' }, [el('span', { class: 'dt-sh-row__name', text: entry.name }), sub ? el('span', { class: 'dt-sh-row__sub', text: sub }) : null]);
      if (entry.inherited) {
        var via = el('button', { type: 'button', class: 'dt-sh-via', title: 'Das Teilen dieses Ordners öffnen' }, [icon('folder'), el('span', { text: 'über Ordner „' + (entry.viaFolderName || '') + '“' })]);
        via.addEventListener('click', function () { open({ kind: 'folder', id: entry.viaFolderId, name: entry.viaFolderName }).then(reload); });
        textBox.appendChild(el('span', { class: 'dt-sh-row__sub dt-sh-row__sub--wrap' }, [isTeam ? 'Team · ' : (entry.email ? entry.email + ' · ' : ''), via]));
      }
      var right;
      if (entry.shareId && entry.canChange && !entry.inherited) {
        right = el('select', { class: 'mat-select mat-select--sm dt-sh-row__perm', 'aria-label': 'Berechtigung von ' + entry.name }, [
          el('option', { value: 'view', text: PERM_LABEL.view }), el('option', { value: 'edit', text: PERM_LABEL.edit })]);
        right.value = entry.permission;
        right.addEventListener('change', function () {
          var chosen = right.value;
          right.disabled = true;
          request('POST', base + '/change', { shareId: entry.shareId, permission: chosen }).then(function (res) {
            if (!res.ok) { toast(messageOf(res), 'danger'); } else { state.changed = true; window.dispatchEvent(new CustomEvent('dt:share-changed', { detail: { kind: kind, id: id } })); }
            return reload();
          });
        });
      } else {
        right = el('span', { class: 'dt-sh-row__role', text: entry.kind === 'owner' ? 'Inhaber' : (entry.role ? ROLE_LABEL[entry.role] || entry.role : permissionText(entry)) });
      }
      var remove = null;
      if (entry.shareId && entry.canChange && !entry.inherited) {
        remove = el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--icon mat-btn--sm dt-sh-row__x', 'aria-label': 'Zugriff von ' + entry.name + ' entfernen', title: 'Zugriff entfernen' }, [icon('x')]);
        remove.addEventListener('click', function () {
          remove.disabled = true;
          request('POST', base + '/remove', { shareId: entry.shareId }).then(function (res) {
            if (!res.ok) { toast(messageOf(res), 'danger'); } else { state.changed = true; window.dispatchEvent(new CustomEvent('dt:share-changed', { detail: { kind: kind, id: id } })); }
            return reload();
          });
        });
      }
      return el('li', { class: 'dt-sh-row' + (entry.inherited ? ' is-inherited' : '') }, [avatar(entry.name, { color: isTeam ? entry.color : null, team: isTeam }), textBox, right, remove]);
    }

    function renderPeople() {
      var info = state.info;
      peopleBox.textContent = '';
      peopleBox.appendChild(el('h3', { class: 'dt-sh-h', text: 'Personen mit Zugriff' }));
      var ul = el('ul', { class: 'dt-sh-rows' });
      var members = info.entries.filter(function (e) { return e.kind === 'member'; });
      var owners = info.entries.filter(function (e) { return e.kind === 'owner'; });
      var others = info.entries.filter(function (e) { return e.kind !== 'member' && e.kind !== 'owner'; });
      owners.forEach(function (e) { ul.appendChild(personRow(e)); });
      if (members.length) {
        ul.appendChild(el('li', { class: 'dt-sh-caption', text: 'Mitglieder von „' + (info.spaceName || 'Team') + '“' }));
        var shown = state.membersOpen ? members : members.slice(0, MEMBERS_SHOWN);
        shown.forEach(function (e) { ul.appendChild(personRow(e)); });
        if (members.length > MEMBERS_SHOWN) {
          var more = el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--sm dt-sh-more', text: state.membersOpen ? 'Weniger anzeigen' : 'Alle ' + members.length + ' Mitglieder anzeigen' });
          more.addEventListener('click', function () { state.membersOpen = !state.membersOpen; renderPeople(); });
          ul.appendChild(el('li', { class: 'dt-sh-morerow' }, [more]));
        }
      }
      if (others.length) {
        if (members.length || owners.length) { ul.appendChild(el('li', { class: 'dt-sh-caption', text: 'Geteilt mit' })); }
        others.forEach(function (e) { ul.appendChild(personRow(e)); });
      }
      peopleBox.appendChild(ul);
      if (!others.length) { peopleBox.appendChild(el('p', { class: 'mat-muted dt-sh-none', text: 'Noch mit niemandem geteilt.' })); }
    }

    // ---- the link
    var linkError = el('p', { class: 'mat-field__error dt-sh-error', role: 'alert', hidden: true });

    function saveLink(audience, permission, allowDownload, expiresValue) {
      showError(linkError, '');
      var payload = { audience: audience, permission: permission, allowDownload: !!allowDownload, expires: endOfDayIso(expiresValue) };
      return request('POST', base + '/link', payload).then(function (res) {
        if (!res.ok) { showError(linkError, messageOf(res)); } else { state.changed = true; window.dispatchEvent(new CustomEvent('dt:share-changed', { detail: { kind: kind, id: id } })); }
        return reload();
      });
    }

    function copyLink(input) {
      var text = input.value;
      var fallback = function () {
        input.focus();
        input.select();
        var ok = false;
        try { ok = doc.execCommand('copy'); } catch (e) { ok = false; }
        toast(ok ? 'Link kopiert.' : 'Markiere den Link und kopiere ihn mit Strg+C.', ok ? 'success' : 'warning');
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { toast('Link kopiert.', 'success'); }, fallback);
      } else { fallback(); }
    }

    function renderLink() {
      var info = state.info;
      linkBox.textContent = '';
      linkBox.appendChild(el('h3', { class: 'dt-sh-h' }, [icon('globe'), el('span', { text: 'Link' })]));
      if (!info.canLink) {
        linkBox.appendChild(el('p', { class: 'mat-muted dt-sh-none', text: 'Nur wer dieses Element verwaltet, kann einen Link einrichten.' }));
        return;
      }
      var link = info.link;
      var current = !link ? 'none' : (link.audience === 'Public' ? 'public' : 'signedin');
      var kindOk = kind === 'design' || kind === 'folder';
      var select = el('select', { class: 'mat-select', id: 'dt-sh-aud-' + uid, 'aria-label': 'Wer den Link nutzen kann' }, [
        el('option', { value: 'none', text: 'Nur Personen mit Zugriff' }),
        el('option', { value: 'signedin', text: 'Alle Angemeldeten mit dem Link' }),
        kindOk ? el('option', { value: 'public', text: 'Öffentlich – jeder mit dem Link kann ansehen', disabled: !info.publicLinksAllowed }) : null,
      ]);
      select.value = current;
      linkBox.appendChild(select);
      if (kindOk && !info.publicLinksAllowed) { linkBox.appendChild(el('p', { class: 'mat-muted dt-sh-none', text: 'Öffentliche Links hat der Administrator ausgeschaltet.' })); }

      var permValue = link ? link.permission.toLowerCase() : 'view';
      var expiresValue = link ? dateInputValue(link.expires) : '';
      var downloadOn = !!(link && link.allowDownload);
      var permField = null;
      var downloadField = null;
      var dateInput = null;

      select.addEventListener('change', function () {
        var v = select.value;
        select.disabled = true;
        if (v === 'none') {
          request('POST', base + '/link/revoke').then(function (res) {
            if (!res.ok) { showError(linkError, messageOf(res)); } else { state.changed = true; window.dispatchEvent(new CustomEvent('dt:share-changed', { detail: { kind: kind, id: id } })); }
            return reload();
          });
        } else { saveLink(v === 'public' ? 'Public' : 'SignedIn', v === 'public' ? 'view' : permValue, downloadOn, expiresValue); }
      });

      if (current !== 'none') {
        if (current === 'signedin') {
          permField = el('select', { class: 'mat-select mat-select--sm', id: 'dt-sh-lp-' + uid, 'aria-label': 'Berechtigung für Angemeldete mit dem Link' }, [
            el('option', { value: 'view', text: 'Kann ansehen' }), el('option', { value: 'edit', text: 'Kann bearbeiten' })]);
          permField.value = permValue;
          permField.addEventListener('change', function () { saveLink('SignedIn', permField.value, false, expiresValue); });
          linkBox.appendChild(el('div', { class: 'dt-sh-opt' }, [el('label', { class: 'dt-sh-opt__label', for: 'dt-sh-lp-' + uid, text: 'Berechtigung' }), permField]));
        } else {
          var sw = el('input', { type: 'checkbox', id: 'dt-sh-dl-' + uid });
          sw.checked = downloadOn;
          sw.addEventListener('change', function () { saveLink('Public', 'view', sw.checked, expiresValue); });
          downloadField = el('div', { class: 'dt-sh-opt' }, [el('label', { class: 'mat-switch', for: 'dt-sh-dl-' + uid }, [sw, el('span', { class: 'mat-switch__track' }), el('span', { text: 'Herunterladen erlauben' })])]);
          linkBox.appendChild(downloadField);
        }
        dateInput = el('input', { type: 'date', class: 'mat-input mat-input--sm dt-sh-date', id: 'dt-sh-exp-' + uid, value: expiresValue || null, 'aria-label': 'Gültig bis' });
        dateInput.addEventListener('change', function () { saveLink(current === 'public' ? 'Public' : 'SignedIn', current === 'public' ? 'view' : permValue, downloadOn, dateInput.value); });
        linkBox.appendChild(el('div', { class: 'dt-sh-opt' }, [el('label', { class: 'dt-sh-opt__label', for: 'dt-sh-exp-' + uid, text: 'Gültig bis (optional)' }), dateInput]));
        if (link.expired) {
          linkBox.appendChild(el('div', { class: 'mat-alert mat-alert--warning dt-sh-expired', role: 'status' }, [icon('alert'), el('div', { class: 'mat-alert__body', text: 'Dieser Link ist abgelaufen. Wähle ein neues Datum oder lösche das Datum.' })]));
        }

        var url = el('input', { type: 'text', class: 'mat-input dt-sh-url', id: 'dt-sh-url-' + uid, readonly: true, value: linkUrl(link.token), 'aria-label': 'Link' });
        url.addEventListener('focus', function () { url.select(); });
        var copy = el('button', { type: 'button', class: 'mat-btn mat-btn--secondary dt-sh-copy' }, [icon('copy'), el('span', { text: 'Link kopieren' })]);
        copy.addEventListener('click', function () { copyLink(url); });
        linkBox.appendChild(el('div', { class: 'dt-sh-urlrow' }, [url, copy]));

        var reset = el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--sm dt-sh-reset' }, [icon('refresh'), el('span', { text: 'Link zurücksetzen' })]);
        reset.addEventListener('click', function () {
          var ask = window.MatUi && window.MatUi.confirm
            ? window.MatUi.confirm('Der bisherige Link funktioniert danach nicht mehr. Alle bekommen einen neuen Link, wenn du ihn weitergibst. Fortfahren?', { title: 'Link zurücksetzen?', ok: 'Zurücksetzen', danger: true })
            : Promise.resolve(true);
          ask.then(function (yes) {
            if (!yes) { return null; }
            reset.disabled = true;
            return request('POST', base + '/link/reset').then(function (res) {
              if (!res.ok) { showError(linkError, messageOf(res)); } else { state.changed = true; toast('Der Link ist neu. Der alte funktioniert nicht mehr.', 'success'); window.dispatchEvent(new CustomEvent('dt:share-changed', { detail: { kind: kind, id: id } })); }
              return reload();
            });
          });
        });
        var meta = el('div', { class: 'dt-sh-linkmeta' }, [reset]);
        if (current === 'signedin' && link.grantCount > 0) {
          meta.appendChild(el('span', { class: 'mat-muted dt-sh-grants', text: link.grantCount === 1 ? '1 Person hat den Link geöffnet.' : link.grantCount + ' Personen haben den Link geöffnet.' }));
        }
        linkBox.appendChild(meta);
      } else {
        linkBox.appendChild(el('p', { class: 'mat-muted dt-sh-none', text: 'Ohne Link kommen nur die Personen oben ans Element.' }));
      }
      linkBox.appendChild(linkError);
    }

    // ---- open requests
    function renderRequests() {
      requestBox.textContent = '';
      requestBox.hidden = !state.requests.length;
      if (!state.requests.length) { return; }
      requestBox.appendChild(el('h3', { class: 'dt-sh-h' }, [icon('mail'), el('span', { text: 'Zugriffsanfragen' }), el('span', { class: 'mat-badge dt-sh-count', text: String(state.requests.length) })]));
      var ul = el('ul', { class: 'dt-sh-rows' });
      state.requests.forEach(function (r) {
        var grant = el('button', { type: 'button', class: 'mat-btn mat-btn--primary mat-btn--sm', 'aria-label': 'Zugriff für ' + r.name + ' gewähren' }, [el('span', { text: 'Gewähren' })]);
        var decline = el('button', { type: 'button', class: 'mat-btn mat-btn--secondary mat-btn--sm', 'aria-label': 'Anfrage von ' + r.name + ' ablehnen' }, [el('span', { text: 'Ablehnen' })]);
        var decide = function (yes) {
          grant.disabled = true;
          decline.disabled = true;
          request('POST', '/api/access-requests/' + r.id + '/decide', { grant: yes, permission: r.permission }).then(function (res) {
            if (!res.ok) { toast(messageOf(res), 'danger'); } else {
              state.changed = true;
              toast(yes ? r.name + ' hat jetzt Zugriff.' : 'Die Anfrage von ' + r.name + ' ist abgelehnt.', 'success');
              window.dispatchEvent(new CustomEvent('dt:share-changed', { detail: { kind: kind, id: id } }));
            }
            return reload();
          });
        };
        grant.addEventListener('click', function () { decide(true); });
        decline.addEventListener('click', function () { decide(false); });
        ul.appendChild(el('li', { class: 'dt-sh-row dt-sh-request' }, [
          avatar(r.name),
          el('div', { class: 'dt-sh-row__text' }, [
            el('span', { class: 'dt-sh-row__name', text: r.name }),
            el('span', { class: 'dt-sh-row__sub', text: (r.permission === 'edit' ? 'möchte bearbeiten' : 'möchte ansehen') + (r.email ? ' · ' + r.email : '') }),
            r.message ? el('span', { class: 'dt-sh-request__msg', text: '„' + r.message + '“' }) : null,
          ]),
          el('div', { class: 'dt-sh-request__btns' }, [grant, decline]),
        ]));
      });
      requestBox.appendChild(ul);
    }

    // ---- loading and rendering
    function render() {
      var info = state.info;
      loading.hidden = true;
      title.textContent = '„' + info.name + '“ teilen';
      name = info.name;
      addBox.hidden = !info.canShare;
      hintBox.hidden = info.canShare;
      if (!info.canShare) { hintBox.textContent = 'Du darfst dieses Element nur ansehen. Teilen dürfen nur Personen, die es bearbeiten können.'; }
      peopleBox.hidden = false;
      linkBox.hidden = false;
      renderPeople();
      renderLink();
      renderRequests();
    }

    function reload() {
      return request('GET', base).then(function (res) {
        if (!res.ok) {
          loading.hidden = false;
          loading.textContent = res.status === 404 ? 'Das gibt es nicht (mehr).' : messageOf(res);
          [addBox, hintBox, peopleBox, linkBox, requestBox].forEach(function (b) { b.hidden = true; });
          return null;
        }
        state.info = res.data;
        if (res.data.canLink) {
          return request('GET', '/api/access-requests?kind=' + kind + '&id=' + id).then(function (r) { state.requests = r.ok && Array.isArray(r.data) ? r.data : []; });
        }
        state.requests = [];
        return null;
      }).then(function () { if (state.info) { render(); } });
    }

    return new Promise(function (resolve) {
      dlg.addEventListener('close', function () {
        clearTimeout(timer);
        resolve({ changed: state.changed });
        setTimeout(function () { dlg.remove(); }, 0);
      });
      doc.body.appendChild(dlg);
      if (window.MatUi && window.MatUi.dialog) { window.MatUi.dialog.open(dlg); } else if (dlg.showModal) { dlg.showModal(); }
      // on a phone the keyboard would cover the dialog: focus the field only where there is a keyboard of its own
      reload().then(function () { if (state.info && state.info.canShare && !window.matchMedia('(pointer: coarse)').matches) { search.focus({ preventScroll: true }); } });
    });
  }

  // a button with data-share-open does the same without script of its own
  doc.addEventListener('click', function (ev) {
    var trigger = ev.target && ev.target.closest ? ev.target.closest('[data-share-open]') : null;
    if (!trigger) { return; }
    ev.preventDefault();
    open({ kind: trigger.getAttribute('data-share-kind'), id: trigger.getAttribute('data-share-id'), name: trigger.getAttribute('data-share-name') || '' });
  });

  window.DtShare = { open: open, avatar: avatar, initials: initials, request: request, linkUrl: linkUrl };
})();
