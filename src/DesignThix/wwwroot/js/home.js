/* DesignThix: the actions on the design tiles of the start page (and of its search results): Duplizieren, Umbenennen, Löschen.
   <article data-recent="12" data-name="Mein Design"> ... <button data-recent-action="duplicate|rename|delete">. The requests go through window.DtCreate.post (create.js): the antiforgery token is the
   one of <meta name="dt-csrf">, the answers are { id, name, url } (duplicate), { name } (rename), { id } (delete). Rename asks with MatUi.prompt, delete with MatUi.confirm. The new name is
   written with textContent. After a duplicate the page reloads (the new design belongs at the top of the grid) and a toast says what happened (kept in sessionStorage over the reload). */
(function () {
  'use strict';

  var doc = document;
  var FLASH = 'dt-home-flash';

  function post(url, body) {
    if (window.DtCreate && window.DtCreate.post) { return window.DtCreate.post(url, body); }
    return Promise.resolve({ ok: false, status: 0, data: { error: 'Die Seite ist noch nicht fertig geladen.' } });
  }

  function toast(message, tone) {
    if (window.MatUi && window.MatUi.toast) { window.MatUi.toast(message, { tone: tone || 'success' }); }
  }

  function problem(result) {
    if (result.status === 403) { return 'Dafür fehlt dir die Berechtigung.'; }
    return result.data && result.data.error ? result.data.error : 'Das hat nicht geklappt (Fehler ' + result.status + ').';
  }

  function busy(tile, on) { tile.classList.toggle('is-busy', on); }

  function duplicate(tile, id) {
    busy(tile, true);
    post('/api/designs/' + id + '/duplicate', {}).then(function (result) {
      if (!result.ok) { busy(tile, false); toast(problem(result), 'danger'); return; }
      try { window.sessionStorage.setItem(FLASH, 'Dupliziert: ' + (result.data.name || '')); } catch (e) { /* storage is off: no toast */ }
      window.location.reload();
    });
  }

  function rename(tile, id) {
    var current = tile.getAttribute('data-name') || '';
    var ask = window.MatUi && window.MatUi.prompt
      ? window.MatUi.prompt('Name des Designs', { title: 'Design umbenennen', value: current, ok: 'Umbenennen' })
      : Promise.resolve(window.prompt('Name des Designs', current));
    ask.then(function (value) {
      if (value === null || value === undefined) { return; }
      var name = String(value).trim();
      if (name === '' || name === current) { return; }
      busy(tile, true);
      post('/api/designs/' + id + '/rename', { name: name }).then(function (result) {
        busy(tile, false);
        if (!result.ok) { toast(problem(result), 'danger'); return; }
        var shown = result.data && result.data.name ? result.data.name : name;
        tile.setAttribute('data-name', shown);
        var title = tile.querySelector('[data-recent-title]');
        if (title) { title.textContent = shown; title.setAttribute('title', shown); }
        Array.prototype.forEach.call(tile.querySelectorAll('[data-recent-action]'), function (button) {
          var action = button.getAttribute('data-recent-action');
          button.setAttribute('aria-label', shown + (action === 'duplicate' ? ' duplizieren' : action === 'rename' ? ' umbenennen' : ' löschen'));
        });
        toast('Umbenannt: ' + shown);
      });
    });
  }

  function remove(tile, id) {
    var name = tile.getAttribute('data-name') || 'Dieses Design';
    var ask = window.MatUi && window.MatUi.confirm
      ? window.MatUi.confirm('„' + name + '“ wirklich löschen? Serienausgaben, die dieses Design nutzen, können danach nicht mehr laufen.', { danger: true, ok: 'Löschen', cancel: 'Abbrechen', title: 'Design löschen' })
      : Promise.resolve(window.confirm('Design löschen?'));
    ask.then(function (ok) {
      if (!ok) { return; }
      busy(tile, true);
      post('/api/designs/' + id + '/delete', {}).then(function (result) {
        if (!result.ok) { busy(tile, false); toast(problem(result), 'danger'); return; }
        var grid = tile.parentNode;
        tile.remove();
        toast('Gelöscht: ' + name);
        if (grid && !grid.querySelector('[data-recent]')) { window.location.reload(); }
      });
    });
  }

  doc.addEventListener('click', function (event) {
    var target = event.target;
    if (!(target instanceof Element)) { return; }
    var button = target.closest('[data-recent-action]');
    if (!button) { return; }
    var tile = button.closest('[data-recent]');
    if (!tile) { return; }
    event.preventDefault();
    var id = tile.getAttribute('data-recent');
    var action = button.getAttribute('data-recent-action');
    if (action === 'duplicate') { duplicate(tile, id); } else if (action === 'rename') { rename(tile, id); } else if (action === 'delete') { remove(tile, id); }
  });

  doc.addEventListener('DOMContentLoaded', function () {
    var message = null;
    try { message = window.sessionStorage.getItem(FLASH); window.sessionStorage.removeItem(FLASH); } catch (e) { message = null; }
    if (message) { toast(message); }
  });
})();
