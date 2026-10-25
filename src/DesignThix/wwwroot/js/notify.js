/* DesignThix: the bell in the header bar (Pages/Shared/_Bell.cshtml, docs/PLAN-PLATFORM.md section 1.17).
   - The count of the unread notifications: GET /api/notifications/count once a minute while the page is visible, again when the window gets the focus or the tab becomes visible (at most once
     every 5 seconds). The badge is the toolkit's .mat-topbar__badge ("99+" above 99).
   - The popover: the newest ten (GET /api/notifications?take=10): icon, text, the optional message, "vor 5 Min.", a dot while unread. A click marks it read (POST /api/notifications/{id}/read) and
     opens what it is about. An access request offers "Gewähren" / "Ablehnen" (POST /api/access-requests/{id}/decide). "Alle als gelesen markieren" posts /api/notifications/read-all. Esc and a click
     outside close it; the focus goes back to the bell. "Alle anzeigen" is the page /Account/Notifications.
   Everything is built with createElement and textContent (the text comes from the server as plain text, never as markup); the antiforgery token is the one of <meta name="dt-csrf">.
   window.DtNotify = { refresh() } is for the browser checks. */
(function () {
  'use strict';

  var doc = document;
  var root = doc.querySelector('[data-notify]');
  if (!root) { return; }

  var toggle = root.querySelector('[data-notify-toggle]');
  var badge = root.querySelector('[data-notify-badge]');
  var pop = root.querySelector('.dt-notify');
  var list = root.querySelector('[data-notify-list]');
  var empty = root.querySelector('[data-notify-empty]');
  var readAll = root.querySelector('[data-notify-read-all]');
  var unread = 0;
  var open = false;
  var lastCheck = 0;

  function csrf() {
    var meta = doc.querySelector('meta[name="dt-csrf"]');
    return meta ? meta.getAttribute('content') : '';
  }

  function api(method, url, body) {
    var init = { method: method, credentials: 'same-origin', headers: { Accept: 'application/json', RequestVerificationToken: csrf() } };
    if (body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
    return fetch(url, init).then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(String(r.status))); });
  }

  function el(tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined && text !== null) { e.textContent = text; }
    return e;
  }

  function icon(name) {
    var svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'mat-icon');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var use = doc.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', (String(name).indexOf('dt:') === 0 ? '#dt-i-' + String(name).slice(3) : '#mat-i-' + name));
    svg.appendChild(use);
    return svg;
  }

  function toast(message, tone) { if (window.MatUi && window.MatUi.toast) { window.MatUi.toast(message, { tone: tone || 'danger' }); } }

  // ================================================================================================ the count

  function setUnread(n) {
    unread = Math.max(0, n | 0);
    if (badge) {
      badge.hidden = unread === 0;
      badge.textContent = unread > 99 ? '99+' : String(unread);
    }
    root.setAttribute('data-unread', String(unread));
    var label = unread === 0 ? 'Benachrichtigungen' : 'Benachrichtigungen, ' + unread + ' ungelesen';
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('title', label);
  }

  function refresh() {
    lastCheck = Date.now();
    return api('GET', '/api/notifications/count').then(function (r) { setUnread(r.unread); return r.unread; }).catch(function () { return unread; });
  }

  function maybeRefresh() {
    if (doc.visibilityState === 'visible' && Date.now() - lastCheck > 5000) { refresh(); if (open) { load(); } }
  }

  setInterval(function () { if (doc.visibilityState === 'visible') { refresh(); if (open) { load(); } } }, 60000);
  window.addEventListener('focus', maybeRefresh);
  doc.addEventListener('visibilitychange', maybeRefresh);

  // ================================================================================================ the popover

  function renderItem(n) {
    var li = el('li', 'dt-notif' + (n.read ? '' : ' is-unread'));
    li.setAttribute('data-notification', String(n.id));
    li.setAttribute('data-kind', n.kind);
    var main = el('button', 'dt-notif__main');
    main.type = 'button';
    main.appendChild(el('span', 'dt-notif__icon')).appendChild(icon(n.icon || 'bell'));
    var body = el('span', 'dt-notif__body');
    body.appendChild(el('span', 'dt-notif__text', n.text));
    if (n.message) { body.appendChild(el('q', 'dt-notif__message', n.message)); }
    body.appendChild(el('span', 'dt-notif__time', n.ago));
    main.appendChild(body);
    if (!n.read) {
      var dot = el('span', 'dt-notif__dot');
      dot.setAttribute('role', 'img');
      dot.setAttribute('aria-label', 'ungelesen');
      main.appendChild(dot);
    }
    main.addEventListener('click', function () { choose(n, li); });
    li.appendChild(main);

    if (n.requestId && n.requestState === 'open') {
      var actions = el('div', 'dt-notif__actions');
      [['Gewähren', true, 'primary', 'check'], ['Ablehnen', false, 'secondary', 'x']].forEach(function (spec) {
        var b = el('button', 'mat-btn mat-btn--' + spec[2] + ' mat-btn--sm');
        b.type = 'button';
        b.appendChild(icon(spec[3]));
        b.appendChild(el('span', null, spec[0]));
        b.addEventListener('click', function () { decide(n, spec[1], b); });
        actions.appendChild(b);
      });
      li.appendChild(actions);
    } else if (n.requestId && (n.requestState === 'granted' || n.requestState === 'declined')) {
      li.appendChild(el('span', 'dt-notif__state', n.requestState === 'granted' ? 'Gewährt' : 'Abgelehnt'));
    }
    return li;
  }

  function render(items) {
    list.textContent = '';
    items.forEach(function (n) { list.appendChild(renderItem(n)); });
    empty.hidden = items.length > 0;
    list.hidden = items.length === 0;
    readAll.disabled = unread === 0;
  }

  function load() {
    return api('GET', '/api/notifications?take=10').then(function (r) {
      setUnread(r.unread);
      render(r.items);
      root.setAttribute('data-loaded', 'true');
    }).catch(function () {
      list.textContent = '';
      empty.hidden = false;
      empty.textContent = 'Die Benachrichtigungen konnten nicht geladen werden.';
    });
  }

  function choose(n, li) {
    var go = function () { if (n.url) { window.location.href = n.url; } };
    if (n.read) { go(); return; }
    api('POST', '/api/notifications/' + n.id + '/read').then(function (r) {
      setUnread(r.unread);
      n.read = true;
      li.classList.remove('is-unread');
      var dot = li.querySelector('.dt-notif__dot');
      if (dot) { dot.remove(); }
      go();
    }).catch(function () { go(); });
  }

  function decide(n, grant, button) {
    button.disabled = true;
    api('POST', '/api/access-requests/' + n.requestId + '/decide', { grant: grant }).then(function () {
      toast(grant ? 'Der Zugriff ist gewährt.' : 'Die Anfrage ist abgelehnt.', 'success');
      return api('POST', '/api/notifications/' + n.id + '/read');
    }).then(function () { return load(); }).catch(function () {
      button.disabled = false;
      toast('Das hat nicht geklappt. Du darfst vielleicht nicht mehr darüber entscheiden.', 'danger');
    });
  }

  function setOpen(value) {
    open = value;
    pop.hidden = !value;
    toggle.setAttribute('aria-expanded', value ? 'true' : 'false');
    root.classList.toggle('is-open', value);
    if (value) {
      load();
    } else {
      root.removeAttribute('data-loaded');
    }
  }

  toggle.addEventListener('click', function (e) {
    e.preventDefault();
    setOpen(!open);
  });

  readAll.addEventListener('click', function () {
    api('POST', '/api/notifications/read-all').then(function () { setUnread(0); return load(); }).catch(function () { toast('Das hat nicht geklappt.', 'danger'); });
  });

  doc.addEventListener('keydown', function (e) {
    if (open && e.key === 'Escape') { setOpen(false); toggle.focus(); }
  });
  doc.addEventListener('pointerdown', function (e) {
    if (open && !root.contains(e.target)) { setOpen(false); }
  });
  // focus leaving the popover through the keyboard closes it as well
  root.addEventListener('focusout', function (e) {
    if (open && e.relatedTarget && !root.contains(e.relatedTarget)) { setOpen(false); }
  });

  window.DtNotify = { refresh: refresh, load: load };
  refresh();
})();
