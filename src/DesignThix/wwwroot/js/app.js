/* DesignThix: the behaviour of the app itself. MatUi (wwwroot/ui/matui.js) does menus, dialogs, tabs, validation, pickers and the upload control; this file adds
   what is specific to DesignThix: the bars of the charts, the installed
   app (service worker, colour of the status bar) and the behaviour without a connection. Everything is wired by data attributes; no inline styles
   anywhere (a value that is data is set here as a custom property, which the content security policy allows). */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var $ = function (sel, scope) { return (scope || doc).querySelector(sel); };
  var $$ = function (sel, scope) { return Array.prototype.slice.call((scope || doc).querySelectorAll(sel)); };
  var toast = function (message, tone) { if (window.MatUi && window.MatUi.toast) { window.MatUi.toast(message, { tone: tone || 'danger' }); } };


  // ================================================================================================ the installed app

  // The colour of the status bar follows the theme the person chose in the app (the meta tags follow the system by themselves).
  function syncThemeColor() {
    var theme = root.getAttribute('data-theme');
    $$('meta[data-theme-color]').forEach(function (m) {
      if (!m.hasAttribute('data-media')) { m.setAttribute('data-media', m.getAttribute('media') || ''); }
      if (theme === 'light' || theme === 'dark') {
        if (m.getAttribute('data-theme-color') === theme) { m.setAttribute('media', 'all'); } else { m.setAttribute('media', 'not all'); }
      } else {
        m.setAttribute('media', m.getAttribute('data-media'));
      }
    });
  }
  syncThemeColor();
  root.addEventListener('mat:theme', syncThemeColor);

  var sw = navigator.serviceWorker;
  if (sw && root.getAttribute('data-sw')) {
    window.addEventListener('load', function () {
      sw.register('/sw.js?v=' + encodeURIComponent(root.getAttribute('data-sw')), { scope: '/' }).catch(function () { /* the app works without it */ });
    });
  }

  // The kept pages hold the data of the person who was signed in: they go with signing out, and on the sign-in page.
  function clearKeptPages() {
    if (sw && sw.controller) { sw.controller.postMessage({ type: 'clear-pages' }); }
    if (window.caches) { caches.delete('dt-pages').catch(function () { }); caches.delete('dt-library').catch(function () { }); }
    try { Object.keys(localStorage).filter(function (k) { return k.indexOf('dt-draft-') === 0 || k.indexOf('dt-preview-') === 0; }).forEach(function (k) { localStorage.removeItem(k); }); } catch (e) { /* ignore */ }
  }
  if (root.hasAttribute('data-clear-kept')) { clearKeptPages(); }
  doc.addEventListener('submit', function (e) {
    if (e.target && e.target.getAttribute && /\/Account\/Logout$/i.test(e.target.getAttribute('action') || '')) { clearKeptPages(); }
  }, true);

  // ================================================================================================ without a connection

  var banner = $('[data-offline-banner]');
  var copyFrom = root.getAttribute('data-offline-copy');
  var retryTimer = null;
  var retryDelay = 3000;

  function setOffline(offline) {
    root.classList.toggle('is-offline', offline);
    if (banner) { banner.hidden = !offline && copyFrom === null; }
  }

  function ping() {
    return fetch('/health', { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.ok; }).catch(function () { return false; });
  }

  function back() {
    clearTimeout(retryTimer);
    retryDelay = 3000;
    setOffline(false);
    // A copy that was shown without a connection is replaced by the real page: nothing stale stays on the screen.
    if (copyFrom !== null || $('[data-offline-page]')) { location.reload(); return; }
    toast('Die Verbindung ist wieder da.', 'success');
  }

  function scheduleRetry() {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(function () {
      ping().then(function (ok) {
        if (ok) { back(); } else { retryDelay = Math.min(retryDelay * 2, 60000); scheduleRetry(); }
      });
    }, retryDelay);
  }

  function reconnectNow(button) {
    var status = $('[data-offline-status]');
    if (button) { button.disabled = true; }
    if (status) { status.textContent = 'Verbinde ...'; }
    ping().then(function (ok) {
      if (button) { button.disabled = false; }
      if (ok) { back(); return; }
      if (status) { status.textContent = 'Noch keine Verbindung. Es wird automatisch weiter versucht.'; }
      toast('Noch keine Verbindung.', 'warning');
      scheduleRetry();
    });
  }

  window.addEventListener('offline', function () { setOffline(true); scheduleRetry(); });
  window.addEventListener('online', function () { ping().then(function (ok) { if (ok) { back(); } else { scheduleRetry(); } }); });
  doc.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-reconnect]');
    if (b) { e.preventDefault(); reconnectNow(b); }
  });

  if (copyFrom !== null) {
    var text = $('[data-offline-text]');
    var when = copyFrom ? new Date(copyFrom) : null;
    if (text && when && !isNaN(when)) {
      text.textContent = 'Du siehst den Stand vom ' + when.toLocaleDateString('de-DE') + ', ' + when.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr. Speichern ist möglich, sobald die Verbindung zurück ist.';
    }
    setOffline(true);
    scheduleRetry();
  } else if (!navigator.onLine) {
    setOffline(true);
    scheduleRetry();
  }
  if ($('[data-offline-page]')) { scheduleRetry(); }

  // A form that is sent without a connection would end in the browser's error page and lose what was typed: keep the page, say why.
  doc.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || (form.method || '').toLowerCase() !== 'post') { return; }
    if (!navigator.onLine || root.classList.contains('is-offline')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      toast('Keine Verbindung: Es wurde nichts gespeichert. Deine Eingaben bleiben auf der Seite.', 'warning');
      scheduleRetry();
    }
  }, true);

  // ================================================================================================ small helpers of forms

  // <select data-submit-on-change> sends its form when it changes.
  doc.addEventListener('change', function (event) {
    var t = event.target;
    if (t && t.hasAttribute && t.hasAttribute('data-submit-on-change') && t.form) { t.form.requestSubmit ? t.form.requestSubmit() : t.form.submit(); }
  });

  // ================================================================================================ charts

  // A bar of a chart carries its share as data-bar="0..100"; it becomes a custom property (the content security policy allows no inline style).
  $$('[data-bar]').forEach(function (el) {
    var v = parseFloat(el.getAttribute('data-bar'));
    if (!isNaN(v)) { el.style.setProperty('--dt-bar', Math.max(0, Math.min(100, v)) + '%'); }
  });

  // ================================================================================================ requests of the pages

  function csrf() {
    var m = $('meta[name="dt-csrf"]');
    return m ? m.getAttribute('content') : '';
  }

  function post(url) {
    return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'RequestVerificationToken': csrf() } })
      .then(function (r) { if (!r.ok) { throw new Error('HTTP ' + r.status); } return r.json(); });
  }

  window.DtHttp = { csrf: csrf, post: post };
})();

// Scrollbars are only visible while something scrolls: the class is set on the scrolled element and removed a moment later.
(function () {
  'use strict';
  var timers = new WeakMap();
  document.addEventListener('scroll', function (event) {
    var el = event.target === document ? document.documentElement : event.target;
    if (!el || !el.classList) { return; }
    el.classList.add('is-scrolling');
    clearTimeout(timers.get(el));
    timers.set(el, setTimeout(function () { el.classList.remove('is-scrolling'); }, 900));
  }, true);
})();

