/* MatCan: starting a design from anywhere in the shell.
   - A format tile (<a data-format="price-tag" href="/Designs/Create?format=price-tag">, on the start page and in the dialog "Design erstellen") creates a design of that format
     (POST /api/designs { preset }) and opens it in the designer; without script the link leads to the page "Design erstellen".
   - "Eigene Größe" (data-format-custom) opens the dialog (#dt-create) and focuses the width; the form of the dialog creates the design (POST /api/designs { preset: 'custom', width, height, unit }).
   - "Vorlage verwenden" (<a data-use-template="12" href="/Designs/Create?template=12">) copies a template (POST /api/designs/{id}/use-template) and opens the copy.
   - Every link to /Designs/Create (the menu item "Design erstellen", buttons "Neues Design") opens the dialog; the page stays the fallback without script.
   The antiforgery token is the one of <meta name="dt-csrf">. Nothing here builds markup from text: messages go through textContent or MatUi.toast. window.DtCreate offers post() to other scripts of the shell. */
(function () {
  'use strict';

  var doc = document;
  var dialog = doc.getElementById('dt-create');
  var errorBox = doc.getElementById('dt-create-error');

  function token() {
    var meta = doc.querySelector('meta[name="dt-csrf"]');
    return meta ? meta.getAttribute('content') : '';
  }

  function toast(message, tone) {
    if (window.MatUi && window.MatUi.toast) { window.MatUi.toast(message, { tone: tone || 'danger' }); }
  }

  /** POST with a JSON body; resolves to { ok, status, data } and never rejects (a lost connection is a message). */
  function post(url, body) {
    return fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'RequestVerificationToken': token() },
      body: JSON.stringify(body || {}),
    }).then(function (response) {
      return response.json().catch(function () { return null; }).then(function (data) {
        return { ok: response.ok, status: response.status, data: data };
      });
    }).catch(function () {
      return { ok: false, status: 0, data: { error: 'Keine Verbindung. Versuche es gleich noch einmal.' } };
    });
  }

  function messageOf(result) {
    if (result.status === 403) { return 'Dafür fehlt dir die Berechtigung.'; }
    return result.data && result.data.error ? result.data.error : 'Das hat nicht geklappt (Fehler ' + result.status + ').';
  }

  function showError(message) {
    if (errorBox && dialog && dialog.open) {
      errorBox.textContent = message;
      errorBox.hidden = false;
    } else {
      toast(message);
    }
  }

  function clearError() {
    if (errorBox) { errorBox.textContent = ''; errorBox.hidden = true; }
  }

  function busy(element, on) {
    if (!element) { return; }
    if (on) { element.setAttribute('aria-busy', 'true'); } else { element.removeAttribute('aria-busy'); }
  }

  function finish(result, element) {
    if (result.ok && result.data && result.data.url) {
      window.location.assign(result.data.url);
      return;
    }
    busy(element, false);
    showError(messageOf(result));
  }

  // Where a new design goes: the area and folder the page is in (the file browser says so: data-create-space, data-create-folder on its section), or what "Speichern in" of the dialog says.
  // A person without teams has no such field; without a context the server takes their own area.
  var context = { spaceId: null, folderId: null };
  var forced = null;

  function readContext() {
    var node = doc.querySelector('[data-browser][data-create-space]');
    context = node ? { spaceId: Number(node.getAttribute('data-create-space')) || null, folderId: Number(node.getAttribute('data-create-folder')) || null } : { spaceId: null, folderId: null };
  }

  function chosenSpace() {
    var select = doc.getElementById('dt-create-space');
    return select ? Number(select.value) || null : context.spaceId;
  }

  function target() {
    var spaceId = chosenSpace();
    var result = {};
    if (spaceId) { result.spaceId = spaceId; }
    if (context.folderId && context.spaceId === spaceId) { result.folderId = context.folderId; }
    return result;
  }

  function withTarget(body) { return Object.assign(body, target()); }

  function createFormat(key, element) {
    clearError();
    busy(element, true);
    return post('/api/designs', withTarget({ preset: key })).then(function (result) { finish(result, element); });
  }

  function createCustom(width, height, unit, element) {
    clearError();
    busy(element, true);
    return post('/api/designs', withTarget({ preset: 'custom', width: width, height: height, unit: unit })).then(function (result) { finish(result, element); });
  }

  function useTemplate(id, element) {
    clearError();
    busy(element, true);
    return post('/api/designs/' + encodeURIComponent(id) + '/use-template', target()).then(function (result) { finish(result, element); });
  }

  function syncSpaceField() {
    var select = doc.getElementById('dt-create-space');
    if (!select) { return; }
    var wanted = context.spaceId ? String(context.spaceId) : '';
    var has = Array.prototype.some.call(select.options, function (o) { return o.value === wanted; });
    select.value = has ? wanted : select.options[0].value;
  }

  function openDialog() {
    if (!dialog) { return false; }
    if (window.MatUi && window.MatUi.dialog) { window.MatUi.dialog.open(dialog); } else if (!dialog.open) { dialog.showModal(); }
    return true;
  }

  // Every link to the page "Design erstellen" opens the dialog (MatUi opens a dialog for data-dialog-open and cancels the link).
  if (dialog) {
    Array.prototype.forEach.call(doc.querySelectorAll('a[href="/Designs/Create"]'), function (link) { link.setAttribute('data-dialog-open', 'dt-create'); });
    // whoever opens the dialog (the menu item, a button, DtCreate.open): the place is the one of the page unless the opener named another
    dialog.addEventListener('mat:dialog-open', function () {
      readContext();
      if (forced) { context = forced; forced = null; }
      syncSpaceField();
      clearError();
    });
  }

  doc.addEventListener('click', function (event) {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) { return; }
    var target = event.target;
    if (!(target instanceof Element)) { return; }

    var tile = target.closest('[data-format]');
    if (tile) {
      event.preventDefault();
      createFormat(tile.getAttribute('data-format'), tile);
      return;
    }

    var custom = target.closest('[data-format-custom]');
    if (custom) {
      if (openDialog()) {
        event.preventDefault();
        var width = doc.getElementById('dt-create-width');
        if (width) { window.setTimeout(function () { width.focus(); width.select(); }, 30); }
      }
      return;
    }

    var template = target.closest('[data-use-template]');
    if (template && !template.hasAttribute('disabled')) {
      event.preventDefault();
      useTemplate(template.getAttribute('data-use-template'), template);
    }
  });

  var form = doc.getElementById('dt-create-custom');
  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var width = Number(doc.getElementById('dt-create-width').value);
      var height = Number(doc.getElementById('dt-create-height').value);
      var unit = doc.getElementById('dt-create-unit').value === 'px' ? 'px' : 'mm';
      if (!(width > 0) || !(height > 0)) {
        showError('Bitte gib Breite und Höhe als Zahl größer als 0 ein.');
        return;
      }
      createCustom(width, height, unit, form.querySelector('button[type=submit]'));
    });
  }

  readContext();
  syncSpaceField();

  /** Opens the dialog "Design erstellen" for a place: open({ spaceId, folderId }) (the file browser's "Neu" menu); without a place the area of the page counts. */
  function openFor(place) {
    if (!dialog) { window.location.assign('/Designs/Create'); return; }
    forced = place && place.spaceId ? { spaceId: Number(place.spaceId), folderId: place.folderId ? Number(place.folderId) : null } : null;
    openDialog();
  }

  window.DtCreate = { post: post, toast: toast, createFormat: createFormat, useTemplate: useTemplate, open: openFor, target: target };
})();
