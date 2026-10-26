/* DesignThix: "Mit KI entwerfen" on the start page and in the dialog "Design erstellen" (docs/PLAN-AI-DESIGN.md section 1 item 5). Every form[data-ai-create] (partial _AiPrompt) is a prompt card: the text,
   attachments (ai-attach.js: the button, drop onto the card, paste of a picture), the format ("Automatisch" lets the AI choose one) and the button. Sending posts multipart form data to
   POST /api/ai/designs/new (text, preset, width/height/unit, spaceId/folderId of the dialog or the page, files, model-{i}) and opens the editor at the address the server gives
   (/Designs/{id}/Designer?ai=<conversation>), where the panel KI follows the run. The cards are hidden until this script has started them (without script nothing is offered).
   Messages go through textContent; the antiforgery token is the one of <meta name="dt-csrf">. */
(function () {
  'use strict';

  var doc = document;
  var forms = Array.prototype.slice.call(doc.querySelectorAll('form[data-ai-create]'));
  if (!forms.length || !window.DtAiAttach) { return; }

  function token() {
    var meta = doc.querySelector('meta[name="dt-csrf"]');
    return meta ? meta.getAttribute('content') : '';
  }

  function setup(form) {
    var text = form.querySelector('[data-ai-text]');
    var filesBox = form.querySelector('[data-ai-files]');
    var fileInput = form.querySelector('[data-ai-file]');
    var attachButton = form.querySelector('[data-ai-attach]');
    var format = form.querySelector('[data-ai-format]');
    var custom = form.querySelector('[data-ai-custom]');
    var submit = form.querySelector('[data-ai-submit]');
    var errorBox = form.querySelector('[data-ai-error]');
    var card = form.querySelector('.dt-aip__card');
    var attach = window.DtAiAttach.create({ max: 6, onChange: function () { /* the chips draw themselves */ } });
    attach.render(filesBox);
    fileInput.setAttribute('accept', attach.accept);
    form.hidden = false;

    function showError(message, href) {
      errorBox.textContent = message || '';
      errorBox.hidden = !message;
      if (message && href) {
        // a limit of the AI: an administrator gets the way to the settings (the server gives the address only to them)
        var link = document.createElement('a');
        link.href = href;
        link.target = '_blank';
        link.rel = 'noopener';
        link.setAttribute('data-limits-link', '');
        link.textContent = 'Limits anpassen';
        errorBox.appendChild(document.createTextNode(' '));
        errorBox.appendChild(link);
      }
    }

    function autosize() {
      text.style.setProperty('height', 'auto');
      text.style.setProperty('height', Math.min(text.scrollHeight + 2, 192) + 'px');
    }

    function addFiles(list) {
      var refused = attach.add(list);
      showError(refused.length ? refused.slice(0, 3).join(' ') : '');
    }

    text.addEventListener('input', function () { autosize(); showError(''); });
    text.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); form.requestSubmit(); }
    });
    text.addEventListener('paste', function (event) {
      var pasted = window.DtAiAttach.filesOf(event.clipboardData);
      if (!pasted.length) { return; }
      event.preventDefault();
      addFiles(pasted);
    });
    attachButton.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () { addFiles(Array.prototype.slice.call(fileInput.files)); fileInput.value = ''; });
    format.addEventListener('change', function () { custom.hidden = format.value !== 'custom'; });
    Array.prototype.forEach.call(form.querySelectorAll('[data-ai-example]'), function (button) {
      button.addEventListener('click', function () { text.value = button.textContent.trim(); autosize(); text.focus(); showError(''); });
    });

    // files dropped onto the card are attachments
    var depth = 0;
    var hasFiles = function (event) { var types = event.dataTransfer && event.dataTransfer.types; return !!types && Array.prototype.indexOf.call(types, 'Files') >= 0; };
    card.addEventListener('dragenter', function (event) { if (hasFiles(event)) { depth++; card.classList.add('is-drop'); } });
    card.addEventListener('dragover', function (event) { if (hasFiles(event)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } });
    card.addEventListener('dragleave', function (event) { if (hasFiles(event)) { depth = Math.max(0, depth - 1); if (!depth) { card.classList.remove('is-drop'); } } });
    card.addEventListener('drop', function (event) {
      if (!hasFiles(event)) { return; }
      event.preventDefault();
      depth = 0;
      card.classList.remove('is-drop');
      addFiles(Array.prototype.slice.call(event.dataTransfer.files || []));
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (submit.getAttribute('aria-busy') === 'true') { return; }
      var prompt = text.value.trim();
      if (!prompt && !attach.count()) { showError('Beschreibe kurz, was die KI gestalten soll.'); text.focus(); return; }
      var body = new FormData();
      body.append('text', prompt || 'Bitte sieh dir die Anhänge an und gestalte danach ein Design.');
      var preset = format.value || 'auto';
      body.append('preset', preset);
      if (preset === 'custom') {
        var width = Number(form.querySelector('[data-ai-width]').value);
        var height = Number(form.querySelector('[data-ai-height]').value);
        if (!(width > 0) || !(height > 0)) { showError('Bitte gib Breite und Höhe als Zahl größer als 0 ein.'); return; }
        body.append('width', String(width));
        body.append('height', String(height));
        body.append('unit', form.querySelector('[data-ai-unit]').value === 'px' ? 'px' : 'mm');
      }
      var place = window.DtCreate && window.DtCreate.target ? window.DtCreate.target() : {};
      if (place.spaceId) { body.append('spaceId', String(place.spaceId)); }
      if (place.folderId) { body.append('folderId', String(place.folderId)); }
      showError('');
      submit.setAttribute('aria-busy', 'true');
      var label = submit.querySelector('span');
      var before = label.textContent;
      label.textContent = 'Wird angelegt …';
      var done = function (message, href) {
        submit.removeAttribute('aria-busy');
        label.textContent = before;
        showError(message, href);
      };
      attach.ready().then(function () {
        attach.append(body);
        return fetch('/api/ai/designs/new', { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json', RequestVerificationToken: token() }, body: body });
      }).then(function (response) {
        return response.json().catch(function () { return null; }).then(function (data) {
          if (response.ok && data && data.url) { window.location.assign(data.url); return; }
          done(data && data.error ? data.error : (response.status === 403 ? 'Dafür fehlt dir die Berechtigung.' : 'Das hat nicht geklappt (Fehler ' + response.status + ').'), data && data.code === 'limit' ? data.href : '');
        });
      }, function () { done('Keine Verbindung. Versuche es gleich noch einmal.'); });
    });

    autosize();
  }

  forms.forEach(setup);
})();
