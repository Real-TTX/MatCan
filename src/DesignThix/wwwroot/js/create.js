/* DesignThix: starting a design from anywhere in the shell.
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
    if (result.status === 403) { return 'Das dürfen nur Gestalter und Administratoren.'; }
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

  function createFormat(key, element) {
    clearError();
    busy(element, true);
    return post('/api/designs', { preset: key }).then(function (result) { finish(result, element); });
  }

  function createCustom(width, height, unit, element) {
    clearError();
    busy(element, true);
    return post('/api/designs', { preset: 'custom', width: width, height: height, unit: unit }).then(function (result) { finish(result, element); });
  }

  function useTemplate(id, element) {
    clearError();
    busy(element, true);
    return post('/api/designs/' + encodeURIComponent(id) + '/use-template', {}).then(function (result) { finish(result, element); });
  }

  function openDialog() {
    if (!dialog) { return false; }
    if (window.MatUi && window.MatUi.dialog) { window.MatUi.dialog.open(dialog); } else if (!dialog.open) { dialog.showModal(); }
    return true;
  }

  // Every link to the page "Design erstellen" opens the dialog (MatUi opens a dialog for data-dialog-open and cancels the link).
  if (dialog) {
    Array.prototype.forEach.call(doc.querySelectorAll('a[href="/Designs/Create"]'), function (link) { link.setAttribute('data-dialog-open', 'dt-create'); });
    dialog.addEventListener('mat:dialog-open', clearError);
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

  window.DtCreate = { post: post, toast: toast, createFormat: createFormat, useTemplate: useTemplate };
})();
