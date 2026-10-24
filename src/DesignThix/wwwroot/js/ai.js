/* DesignThix: the AI actions in the browser (phase G).
   One script for the pages that use them: the data list (Zeilen and Import/Export tabs) and the designer (text of an element).
     DtAi.importForm(container, ctx)   the form "Mit KI übernehmen": text + hint -> proposal -> preview dialog -> Übernehmen
     DtAi.openImport(ctx)              the same form in a dialog (the button of the grid)
     DtAi.openFill(ctx)                "Mit KI füllen": column + instruction + context columns for the selected rows -> preview -> Übernehmen
     DtAi.openProposal(runId, ctx)     reopens a proposal that waits (Vorschlag ansehen)
     DtAi.runsPanel(container, ctx)    the latest runs on a list with "Rückgängig" and "Vorschlag ansehen"
     DtAi.suggestText(ctx)             the dialog of the designer: instruction -> up to five suggestions -> click one
   ctx (data list): { listId, blocked: reason|null, onApplied(result), onUndone(), columns, rowIds }.  ctx (designer): { designId, text, ..., onPick(text) }.
   What the model wrote is NEVER put into HTML: every text goes through textContent, every element is made with createElement / createElementNS.
   Nothing is written by this script directly: the server holds the checked proposal, "Übernehmen" only names the run and the entries to take.
   Endpoints (all POSTs with the antiforgery header from <meta name="dt-csrf">): see Endpoints/AiEndpoints.cs. No inline styles or scripts (CSP). */
(function () {
  'use strict';

  var doc = document;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var counter = 0;

  // ================================================================================================ small helpers

  function el(tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined && text !== null) { e.textContent = text; }
    return e;
  }

  function icon(name, cls) {
    var svg = doc.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', cls ? 'mat-icon ' + cls : 'mat-icon');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var use = doc.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', (doc.getElementById('dt-i-' + name) ? '#dt-i-' : '#mat-i-') + name);
    svg.appendChild(use);
    return svg;
  }

  function button(label, iconName, cls) {
    var b = el('button', 'mat-btn ' + (cls || 'mat-btn--secondary'));
    b.type = 'button';
    if (iconName) { b.appendChild(icon(iconName)); }
    if (label) { b.appendChild(el('span', null, label)); }
    return b;
  }

  function setLabel(b, text) {
    var s = b.querySelector('span');
    if (s) { s.textContent = text; }
  }

  function csrf() {
    var m = doc.querySelector('meta[name="dt-csrf"]');
    return m ? m.getAttribute('content') : '';
  }

  function request(method, url, body, signal) {
    var opts = { method: method, credentials: 'same-origin', headers: { Accept: 'application/json' }, signal: signal };
    if (method !== 'GET') { opts.headers.RequestVerificationToken = csrf(); }
    if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    return fetch(url, opts).then(function (r) {
      return r.text().then(function (t) {
        var data = {};
        try { data = t ? JSON.parse(t) : {}; } catch (e) { data = {}; }
        return { status: r.status, ok: r.ok, data: data };
      });
    });
  }

  function toast(message, tone) {
    if (window.MatUi && window.MatUi.toast) { window.MatUi.toast(message, { tone: tone || undefined }); }
  }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  function uid(prefix) { counter += 1; return 'dt-ai-' + prefix + '-' + counter; }

  /** What went wrong, in German, from an answer of the server; with the way to the settings when an administrator can fix it. */
  function explain(res) {
    var d = res.data || {};
    if (res.status === 403) { return { message: 'Dafür fehlt dir die Berechtigung.', href: null }; }
    if (res.status === 409) { return { message: d.error || 'Die Daten wurden inzwischen geändert.', href: null }; }
    return { message: d.error || 'Das hat nicht geklappt (HTTP ' + res.status + ').', href: d.settingsHref || null };
  }

  function showAlert(box, tone, message, href) {
    box.textContent = '';
    box.hidden = false;
    var a = el('div', 'mat-alert mat-alert--' + tone);
    a.setAttribute('role', tone === 'danger' ? 'alert' : 'status');
    a.appendChild(icon(tone === 'danger' ? 'x-circle' : tone === 'warning' ? 'alert' : 'info'));
    var body = el('div', 'mat-alert__body');
    body.appendChild(doc.createTextNode(message));
    if (href) {
      body.appendChild(doc.createTextNode(' '));
      var link = el('a', null, 'Zu den KI-Einstellungen');
      link.href = href;
      body.appendChild(link);
    }
    a.appendChild(body);
    box.appendChild(a);
  }

  function hideAlert(box) { box.textContent = ''; box.hidden = true; }

  function failure(error) {
    if (error && error.name === 'AbortError') { return 'Abgebrochen.'; }
    return navigator.onLine === false ? 'Es gibt keine Verbindung. Die KI braucht eine Verbindung zum Server.' : 'Der Server hat nicht geantwortet.';
  }

  function dateText(value) {
    var d = new Date(value);
    return isNaN(d.getTime()) ? '' : d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  // ================================================================================================ the dialog frame

  function makeDialog(title, iconName, size) {
    var id = uid('dlg');
    var dlg = el('dialog', 'mat-dialog mat-dialog--' + (size || 'lg') + ' dt-ai');
    dlg.id = id;
    dlg.setAttribute('aria-labelledby', id + '-title');
    dlg.setAttribute('data-static', '');
    var form = el('form', 'mat-dialog__form');
    form.method = 'dialog';
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    var head = el('div', 'mat-dialog__head');
    head.appendChild(icon(iconName || 'sparkles'));
    var h = el('h2', 'mat-dialog__title', title);
    h.id = id + '-title';
    head.appendChild(h);
    var x = el('button', 'mat-btn mat-btn--ghost mat-btn--icon mat-dialog__close');
    x.type = 'button';
    x.setAttribute('data-dialog-close', '');
    x.setAttribute('aria-label', 'Schließen');
    x.appendChild(icon('x'));
    head.appendChild(x);
    var body = el('div', 'mat-dialog__body mat-form dt-ai__body');
    var foot = el('div', 'mat-dialog__foot');
    var row = el('div', 'mat-btn-row mat-btn-row--plain');
    foot.appendChild(row);
    form.appendChild(head);
    form.appendChild(body);
    form.appendChild(foot);
    dlg.appendChild(form);
    doc.body.appendChild(dlg);
    var api = { dlg: dlg, body: body, row: row, title: h, onClose: null };
    api.open = function () { if (window.MatUi && window.MatUi.dialog) { window.MatUi.dialog.open(dlg); } else { dlg.showModal(); } };
    api.close = function () { if (!dlg.open) { return; } if (window.MatUi && window.MatUi.dialog) { window.MatUi.dialog.close(dlg, 'cancel'); } else { dlg.close(); } };
    dlg.addEventListener('close', function () {
      if (api.onClose) { api.onClose(); }
      setTimeout(function () { dlg.remove(); }, 0);
    });
    return api;
  }

  /** "Vollständige Anweisung anzeigen": loads the exact text from the server (no call to the model) and shows it below the button. */
  function promptBox(loader) {
    var wrap = el('div', 'dt-ai-prompt');
    var b = button('Vollständige Anweisung anzeigen', 'file-text', 'mat-btn--ghost mat-btn--sm');
    var note = el('p', 'mat-hint dt-ai-prompt__note');
    note.hidden = true;
    var pre = el('pre', 'dt-code dt-code--wrap dt-ai-prompt__text');
    pre.hidden = true;
    pre.tabIndex = 0;
    wrap.appendChild(b);
    wrap.appendChild(note);
    wrap.appendChild(pre);
    b.addEventListener('click', function () {
      if (!pre.hidden) {
        pre.hidden = true;
        note.hidden = true;
        setLabel(b, 'Vollständige Anweisung anzeigen');
        return;
      }
      b.disabled = true;
      loader().then(function (res) {
        if (res.ok && res.data && res.data.text) {
          pre.textContent = res.data.text;
          pre.hidden = false;
          note.textContent = 'Genau dieser Text geht an die KI (Anweisungen, Antwortformat, Lage).';
          note.hidden = false;
          setLabel(b, 'Anweisung ausblenden');
        } else {
          note.textContent = (res.data && res.data.error) || 'Die Anweisung konnte nicht geladen werden.';
          note.hidden = false;
        }
      }, function () {
        note.textContent = 'Die Anweisung konnte nicht geladen werden (keine Verbindung).';
        note.hidden = false;
      }).then(function () { b.disabled = false; });
    });
    return wrap;
  }

  /** A busy line with a spinner and a "Abbrechen" that ends the request. */
  function busyLine() {
    var line = el('div', 'dt-ai-busy');
    line.hidden = true;
    line.setAttribute('role', 'status');
    line.appendChild(el('span', 'mat-spinner mat-spinner--sm'));
    var text = el('span', 'dt-ai-busy__text', '');
    var cancel = button('Abbrechen', 'x', 'mat-btn--ghost mat-btn--sm');
    line.appendChild(text);
    line.appendChild(cancel);
    return { el: line, text: text, cancel: cancel };
  }

  // ================================================================================================ "Rückgängig" right after applying

  function undoToast(message, runId, after) {
    if (!window.MatUi || !window.MatUi.toast) { return; }
    window.MatUi.toast(message, { tone: 'success', timeout: 20000 });
    var hosts = doc.querySelectorAll('.mat-toasts');
    var host = hosts.length ? hosts[hosts.length - 1] : null;
    var t = host && host.lastElementChild;
    var body = t && t.querySelector('.mat-alert__body');
    if (!body) { return; }
    var row = el('div', 'dt-ai-toastactions');
    var b = button('Rückgängig', 'restore', 'mat-btn--secondary mat-btn--sm');
    b.addEventListener('click', function () {
      b.disabled = true;
      request('POST', '/api/ai/runs/' + runId + '/undo').then(function (res) {
        if (res.ok) {
          toast(res.data.message || 'Rückgängig gemacht.', 'success');
          if (after) { after(); }
        } else {
          toast(explain(res).message, 'danger');
        }
        if (t.parentNode) { t.remove(); }
      }, function () { b.disabled = false; toast('Keine Verbindung.', 'warning'); });
    });
    row.appendChild(b);
    body.appendChild(row);
  }

  // ================================================================================================ the preview of a proposal (import and fill)

  function cellContent(td, column, value) {
    if (!value) { td.appendChild(el('span', 'mat-muted', '–')); return; }
    if (column && column.type === 'image') {
      var img = el('img', 'dt-ai-thumb');
      img.alt = '';
      img.loading = 'lazy';
      img.src = '/media/' + encodeURIComponent(value);
      td.appendChild(img);
      td.appendChild(el('span', 'dt-ai-key', value));
      return;
    }
    td.appendChild(el('span', 'dt-ai-value', value));
  }

  function listBlock(title, items, tone) {
    var box = el('div', 'mat-alert mat-alert--' + tone);
    box.setAttribute('role', 'note');
    box.appendChild(icon(tone === 'warning' ? 'alert' : 'info'));
    var body = el('div', 'mat-alert__body');
    body.appendChild(el('strong', null, title));
    var ul = el('ul', 'dt-ai-list');
    items.forEach(function (t) { ul.appendChild(el('li', null, t)); });
    body.appendChild(ul);
    box.appendChild(body);
    return box;
  }

  /**
   * The preview dialog. data = { runId, status, proposal } as the server answers (propose and GET proposal); proposal.kind is 'import' or 'fill'.
   * ctx.promptLoader (optional) shows the instruction of this request. Applying posts only the run and the chosen entries.
   */
  function openPreview(data, ctx) {
    var p = data.proposal || {};
    var isImport = p.kind === 'import';
    var open = data.status === 'Waiting';
    var dlg = makeDialog(isImport ? 'Vorschlag der KI: neue Zeilen' : 'Vorschlag der KI: ' + (p.column ? p.column.label : 'Spalte'), 'sparkles', 'xl');
    var body = dlg.body;
    var entries = isImport ? (p.rows || []) : (p.values || []);
    // an import shows the columns that have something to look at (a column that is empty in every proposed row is left out and counted)
    var allColumns = isImport ? (p.columns || []) : [];
    var columns = allColumns.filter(function (c) { return entries.some(function (e) { return (e.values && e.values[c.key]) || (e.warnings && e.warnings[c.key]); }); });
    var imageColumn = !isImport && p.column && p.column.type === 'image' ? p.column : null;

    var summary = el('p', 'dt-ai-summary');
    if (isImport) {
      summary.textContent = entries.length === 0
        ? 'Die KI hat im Text keine Zeilen für „' + (p.listName || 'die Liste') + '“ gefunden.'
        : plural(entries.length, 'Zeile', 'Zeilen') + ' für „' + (p.listName || 'die Liste') + '“ erkannt. Prüfe sie und nimm nur die, die stimmen. Hervorgehobene Zellen haben einen Hinweis.'
          + (allColumns.length > columns.length ? ' ' + plural(allColumns.length - columns.length, 'Spalte ohne Werte ist', 'Spalten ohne Werte sind') + ' ausgeblendet.' : '');
    } else {
      summary.textContent = entries.length === 0
        ? 'Die KI hat keine neuen Werte für die Spalte „' + (p.column ? p.column.label : '') + '“ vorgeschlagen.'
        : 'Neue Werte für die Spalte „' + (p.column ? p.column.label : '') + '“ in ' + plural(entries.length, 'Zeile', 'Zeilen') + '.'
          + (p.unchanged ? ' ' + plural(p.unchanged, 'Zeile bleibt', 'Zeilen bleiben') + ' unverändert.' : '')
          + (p.missing ? ' Für ' + plural(p.missing, 'Zeile', 'Zeilen') + ' kam keine Antwort.' : '');
    }
    body.appendChild(summary);
    if (!open && entries.length > 0) {
      var closed = el('div', 'mat-alert mat-alert--info');
      closed.appendChild(icon('info'));
      closed.appendChild(el('div', 'mat-alert__body', data.status === 'Done' ? 'Dieser Vorschlag ist schon übernommen worden.' : 'Dieser Vorschlag ist nicht mehr offen.'));
      body.appendChild(closed);
    }

    if (isImport && p.notes) { body.appendChild(listBlock('Hinweis der KI', [p.notes], 'info')); }
    if ((p.warnings || []).length) { body.appendChild(listBlock('Was der Code nicht übernommen hat', p.warnings, 'warning')); }

    var checks = [];
    var apply = null;
    var alertBox = el('div', 'dt-ai-alert');
    alertBox.hidden = true;

    if (entries.length > 0) {
      var wrap = el('div', 'dt-ai-tablewrap');
      wrap.tabIndex = 0;
      var table = el('table', 'dt-ai-table');
      table.appendChild(el('caption', 'mat-sr-only', isImport ? 'Vorgeschlagene Zeilen' : 'Vorgeschlagene Werte'));
      var thead = el('thead');
      var htr = el('tr');
      var allBox = el('input');
      allBox.type = 'checkbox';
      allBox.checked = open;
      allBox.disabled = !open;
      allBox.setAttribute('aria-label', 'Alle auswählen');
      var th0 = el('th', 'dt-ai-table__check');
      th0.scope = 'col';
      th0.appendChild(allBox);
      htr.appendChild(th0);
      function head(text, cls) { var th = el('th', cls || null, text); th.scope = 'col'; htr.appendChild(th); }
      if (isImport) {
        head('#', 'dt-ai-table__n');
        columns.forEach(function (c) { head(c.label || c.key); });
        head('Hinweise');
      } else {
        head('Zeile');
        head('Bisher');
        head('Neu');
        head('Hinweis');
      }
      thead.appendChild(htr);
      table.appendChild(thead);
      var tbody = el('tbody');
      entries.forEach(function (entry, index) {
        var tr = el('tr');
        var box = el('input');
        box.type = 'checkbox';
        box.checked = open;
        box.disabled = !open;
        box.setAttribute('aria-label', (isImport ? 'Zeile ' + (index + 1) : 'Zeile ' + entry.n) + ' übernehmen');
        var td0 = el('td', 'dt-ai-table__check');
        td0.appendChild(box);
        tr.appendChild(td0);
        checks.push({ box: box, key: isImport ? index : entry.row });
        if (isImport) {
          tr.appendChild(el('td', 'dt-ai-table__n', String(index + 1)));
          var notes = [];
          columns.forEach(function (c) {
            var td = el('td');
            td.setAttribute('data-label', c.label || c.key);
            var warn = entry.warnings ? entry.warnings[c.key] : null;
            cellContent(td, c, entry.values ? entry.values[c.key] : '');
            if (warn) { td.classList.add('dt-ai-cell--warn'); td.title = warn; notes.push(warn); }
            tr.appendChild(td);
          });
          var tdn = el('td', 'dt-ai-table__notes');
          tdn.setAttribute('data-label', 'Hinweise');
          notes.forEach(function (n) { tdn.appendChild(el('span', 'dt-ai-note', n)); });
          tr.appendChild(tdn);
        } else {
          var tdr = el('td');
          tdr.setAttribute('data-label', 'Zeile');
          tdr.appendChild(el('strong', null, String(entry.n)));
          if (entry.label) { tdr.appendChild(el('span', 'dt-ai-rowlabel', entry.label)); }
          tr.appendChild(tdr);
          var tdo = el('td', 'dt-ai-old');
          tdo.setAttribute('data-label', 'Bisher');
          cellContent(tdo, imageColumn, entry.old);
          tr.appendChild(tdo);
          var tdv = el('td', 'dt-ai-new' + (entry.warning ? ' dt-ai-cell--warn' : ''));
          tdv.setAttribute('data-label', 'Neu');
          cellContent(tdv, imageColumn, entry.new);
          tr.appendChild(tdv);
          var tdw = el('td', 'dt-ai-table__notes');
          tdw.setAttribute('data-label', 'Hinweis');
          if (entry.warning) { tdw.appendChild(el('span', 'dt-ai-note', entry.warning)); }
          tr.appendChild(tdw);
        }

        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      body.appendChild(wrap);

      allBox.addEventListener('change', function () { checks.forEach(function (c) { c.box.checked = allBox.checked; }); update(); });
      checks.forEach(function (c) { c.box.addEventListener('change', function () { update(); }); });
    }

    body.appendChild(alertBox);
    if (ctx && ctx.promptLoader) { body.appendChild(promptBox(ctx.promptLoader)); }

    var tokens = el('p', 'mat-hint', 'Lauf #' + data.runId + (data.tokens ? ' · ' + data.tokens.toLocaleString('de-DE') + (data.estimated ? ' Tokens (geschätzt)' : ' Tokens') : '') + '. Der Vorschlag ist vom Code geprüft; erst „Übernehmen“ ändert etwas, und es lässt sich rückgängig machen.');
    body.appendChild(tokens);

    function chosen() { return checks.filter(function (c) { return c.box.checked; }).map(function (c) { return c.key; }); }

    function update() {
      if (!apply) { return; }
      var n = chosen().length;
      apply.disabled = n === 0;
      setLabel(apply, n === 0 ? 'Übernehmen' : isImport ? 'Übernehmen (' + plural(n, 'Zeile', 'Zeilen') + ')' : 'Übernehmen (' + plural(n, 'Wert', 'Werte') + ')');
    }

    if (open && entries.length > 0) {
      apply = button('Übernehmen', 'check', 'mat-btn--primary');
      dlg.row.appendChild(apply);
      apply.addEventListener('click', function () {
        apply.disabled = true;
        hideAlert(alertBox);
        request('POST', '/api/ai/runs/' + data.runId + '/apply', { include: chosen() }).then(function (res) {
          if (res.ok) {
            dlg.close();
            if (ctx && ctx.onApplied) { ctx.onApplied(res.data); }
            undoToast(res.data.message || 'Übernommen.', data.runId, function () { if (ctx && ctx.onUndone) { ctx.onUndone(); } });
            return;
          }

          var e = explain(res);
          showAlert(alertBox, 'danger', res.status === 409 ? e.message + ' Lass die KI den Vorschlag neu machen.' : e.message, null);
          update();
        }, function (error) { showAlert(alertBox, 'danger', failure(error), null); update(); });
      });
    }

    var close = button(open && entries.length > 0 ? 'Später entscheiden' : 'Schließen', null, 'mat-btn--secondary');
    close.setAttribute('data-dialog-close', '');
    dlg.row.appendChild(close);
    if (open) {
      dlg.row.appendChild(el('span', 'mat-btn-row__spacer'));
      var discard = button('Verwerfen', 'trash', 'mat-btn--ghost mat-btn--end');
      discard.addEventListener('click', function () {
        discard.disabled = true;
        request('POST', '/api/ai/runs/' + data.runId + '/discard').then(function () {
          dlg.close();
          toast('Der Vorschlag wurde verworfen. Nichts wurde geändert.', 'info');
          if (ctx && ctx.onDiscarded) { ctx.onDiscarded(); }
        }, function () { discard.disabled = false; });
      });
      dlg.row.appendChild(discard);
    }

    update();
    dlg.open();
    setTimeout(function () { if (apply) { apply.focus(); } }, 30);
    return dlg;
  }

  function openProposal(runId, ctx) {
    return request('GET', '/api/ai/runs/' + runId + '/proposal').then(function (res) {
      if (!res.ok) { toast(explain(res).message, 'danger'); return null; }
      return openPreview({ runId: res.data.runId, status: res.data.status, proposal: res.data.proposal }, ctx);
    }, function () { toast('Keine Verbindung.', 'warning'); return null; });
  }

  // ================================================================================================ data import

  /** The form "Mit KI übernehmen" inside container. ctx.listId is needed; ctx.blocked is the reason the AI may not read this list (then only the reason is shown). */
  function importForm(container, ctx) {
    container.textContent = '';
    if (ctx.blocked) {
      var info = el('div', 'mat-alert mat-alert--info');
      info.setAttribute('role', 'note');
      info.appendChild(icon('shield'));
      info.appendChild(el('div', 'mat-alert__body', ctx.blocked));
      container.appendChild(info);
      return;
    }

    var id = uid('imp');
    var f = el('div', 'dt-ai-form');
    var taField = el('div', 'mat-field mat-field--full');
    var taLabel = el('label', 'mat-label', 'Text oder Tabelle');
    taLabel.setAttribute('for', id + '-text');
    var ta = el('textarea', 'mat-textarea mat-input dt-ai-text');
    ta.id = id + '-text';
    ta.rows = 8;
    ta.setAttribute('spellcheck', 'false');
    ta.placeholder = 'Zum Beispiel: eine Lieferantenliste, eine E-Mail, eine Speisekarte oder Zellen aus Excel.';
    var taHint = el('span', 'mat-hint', 'Die KI macht daraus Zeilen für die Spalten dieser Liste. Du siehst vorher eine Vorschau und entscheidest.');
    taField.appendChild(taLabel);
    taField.appendChild(ta);
    taField.appendChild(taHint);

    var hintField = el('div', 'mat-field mat-field--full');
    var hintLabel = el('label', 'mat-label', 'Hinweis (optional)');
    hintLabel.setAttribute('for', id + '-hint');
    var hint = el('input', 'mat-input');
    hint.type = 'text';
    hint.id = id + '-hint';
    hint.maxLength = 1000;
    hint.autocomplete = 'off';
    hint.placeholder = 'Zum Beispiel: Preise sind Preise pro 100 g; Herkunft ist immer Deutschland';
    hintField.appendChild(hintLabel);
    hintField.appendChild(hint);

    var alertBox = el('div', 'dt-ai-alert');
    alertBox.hidden = true;
    var busy = busyLine();
    var actions = el('div', 'mat-btn-row mat-btn-row--plain');
    var go = button('Vorschlag erstellen', 'sparkles', 'mat-btn--primary');
    actions.appendChild(go);

    function requestBody() { return { text: ta.value, hint: hint.value }; }

    var prompt = promptBox(function () { return request('POST', '/api/ai/datalists/' + ctx.listId + '/import/prompt', requestBody()); });
    f.appendChild(taField);
    f.appendChild(hintField);
    f.appendChild(alertBox);
    f.appendChild(busy.el);
    f.appendChild(actions);
    f.appendChild(prompt);
    container.appendChild(f);

    var controller = null;
    busy.cancel.addEventListener('click', function () { if (controller) { controller.abort(); } });
    go.addEventListener('click', function () {
      if (ta.value.trim() === '') { showAlert(alertBox, 'warning', 'Füge zuerst einen Text oder eine Tabelle ein.', null); ta.focus(); return; }
      hideAlert(alertBox);
      go.disabled = true;
      busy.el.hidden = false;
      busy.text.textContent = 'Die KI liest den Text und macht Zeilen daraus. Das kann etwas dauern ...';
      controller = new AbortController();
      request('POST', '/api/ai/datalists/' + ctx.listId + '/import', requestBody(), controller.signal).then(function (res) {
        if (res.ok && res.data.ok) {
          var loader = function () { return request('POST', '/api/ai/datalists/' + ctx.listId + '/import/prompt', requestBody()); };
          var after = Object.assign({}, ctx, { promptLoader: loader });
          openPreview(res.data, after);
        } else {
          var e = explain(res);
          showAlert(alertBox, 'danger', e.message, e.href);
        }
      }, function (error) { showAlert(alertBox, 'danger', failure(error), null); }).then(function () {
        go.disabled = false;
        busy.el.hidden = true;
        controller = null;
      });
    });
  }

  function openImport(ctx) {
    var dlg = makeDialog('Mit KI übernehmen', 'sparkles', 'lg');
    var holder = el('div');
    dlg.body.appendChild(holder);
    var inner = Object.assign({}, ctx);
    var applied = ctx.onApplied;
    inner.onApplied = function (result) { dlg.close(); if (applied) { applied(result); } };
    importForm(holder, inner);
    var close = button('Schließen', null, 'mat-btn--secondary');
    close.setAttribute('data-dialog-close', '');
    dlg.row.appendChild(close);
    dlg.open();
    setTimeout(function () { var t = dlg.body.querySelector('textarea'); if (t) { t.focus(); } }, 30);
  }

  // ================================================================================================ data fill

  var FILL_EXAMPLES = ['Schreibe die Region passend zum Ort', 'Übersetze den Namen ins Englische', 'Korrigiere die Rechtschreibung'];

  /** ctx: { listId, columns: [{key,label,type}], rowIds: [..], blocked, onApplied, onUndone } */
  function openFill(ctx) {
    var dlg = makeDialog('Spalte mit KI füllen', 'sparkles', 'lg');
    var body = dlg.body;
    if (ctx.blocked) {
      var info = el('div', 'mat-alert mat-alert--info');
      info.setAttribute('role', 'note');
      info.appendChild(icon('shield'));
      info.appendChild(el('div', 'mat-alert__body', ctx.blocked));
      body.appendChild(info);
      var closeOnly = button('Schließen', null, 'mat-btn--secondary');
      closeOnly.setAttribute('data-dialog-close', '');
      dlg.row.appendChild(closeOnly);
      dlg.open();
      return;
    }

    var id = uid('fill');
    var columns = ctx.columns || [];
    var rowIds = ctx.rowIds || [];
    body.appendChild(el('p', 'dt-ai-summary', plural(rowIds.length, 'Zeile ist', 'Zeilen sind') + ' ausgewählt. Die KI sieht nur diese Zeilen und nur die Spalten, die du unten als Zusammenhang ankreuzt.'));

    var targetField = el('div', 'mat-field mat-field--full');
    var targetLabel = el('label', 'mat-label', 'Spalte, die gefüllt werden soll');
    targetLabel.setAttribute('for', id + '-col');
    var select = el('select', 'mat-select');
    select.id = id + '-col';
    columns.forEach(function (c) {
      var o = el('option', null, (c.label || c.key) + ' (' + c.key + ')');
      o.value = c.key;
      select.appendChild(o);
    });
    targetField.appendChild(targetLabel);
    targetField.appendChild(select);
    body.appendChild(targetField);

    var instrField = el('div', 'mat-field mat-field--full');
    var instrLabel = el('label', 'mat-label', 'Was soll die KI tun?');
    instrLabel.setAttribute('for', id + '-instr');
    var instr = el('textarea', 'mat-textarea mat-input dt-ai-text');
    instr.id = id + '-instr';
    instr.rows = 3;
    instr.maxLength = 2000;
    instr.placeholder = 'Zum Beispiel: Schreibe die Region passend zum Ort.';
    instrField.appendChild(instrLabel);
    instrField.appendChild(instr);
    var chips = el('div', 'dt-ai-chips');
    FILL_EXAMPLES.forEach(function (text) {
      var chip = button(text, null, 'mat-btn--secondary mat-btn--sm');
      chip.addEventListener('click', function () { instr.value = text; instr.focus(); });
      chips.appendChild(chip);
    });
    instrField.appendChild(chips);
    body.appendChild(instrField);

    var fieldset = el('fieldset', 'dt-ai-context');
    fieldset.appendChild(el('legend', null, 'Zusammenhang für die KI (diese Spalten der gewählten Zeilen werden gesendet)'));
    var boxes = [];
    columns.forEach(function (c) {
      var label = el('label', 'dt-ai-context__item');
      var box = el('input');
      box.type = 'checkbox';
      box.value = c.key;
      box.checked = c.type === 'text' || c.type === 'multiline';
      label.appendChild(box);
      label.appendChild(el('span', null, (c.label || c.key) + (c.type === 'image' ? ' (Bild)' : c.type === 'price' ? ' (Preis)' : c.type === 'number' ? ' (Zahl)' : '')));
      fieldset.appendChild(label);
      boxes.push({ box: box, key: c.key, label: label });
    });
    body.appendChild(fieldset);

    function syncTarget() {
      boxes.forEach(function (b) {
        var isTarget = b.key === select.value;
        if (isTarget) { b.box.checked = false; }
        b.box.disabled = isTarget;
        b.label.classList.toggle('is-disabled', isTarget);
      });
    }
    select.addEventListener('change', syncTarget);
    syncTarget();

    function requestBody() {
      return { rowIds: rowIds, column: select.value, context: boxes.filter(function (b) { return b.box.checked; }).map(function (b) { return b.key; }), instruction: instr.value };
    }

    var alertBox = el('div', 'dt-ai-alert');
    alertBox.hidden = true;
    body.appendChild(alertBox);
    var busy = busyLine();
    body.appendChild(busy.el);
    body.appendChild(promptBox(function () { return request('POST', '/api/ai/datalists/' + ctx.listId + '/fill/prompt', requestBody()); }));

    var go = button('Vorschlag erstellen', 'sparkles', 'mat-btn--primary');
    var cancel = button('Abbrechen', null, 'mat-btn--secondary');
    cancel.setAttribute('data-dialog-close', '');
    dlg.row.appendChild(go);
    dlg.row.appendChild(cancel);

    var controller = null;
    busy.cancel.addEventListener('click', function () { if (controller) { controller.abort(); } });
    dlg.onClose = function () { if (controller) { controller.abort(); } };
    go.addEventListener('click', function () {
      if (instr.value.trim() === '') { showAlert(alertBox, 'warning', 'Schreibe, was die KI tun soll.', null); instr.focus(); return; }
      hideAlert(alertBox);
      go.disabled = true;
      busy.el.hidden = false;
      busy.text.textContent = 'Die KI arbeitet an ' + plural(rowIds.length, 'Zeile', 'Zeilen') + ' ...';
      controller = new AbortController();
      request('POST', '/api/ai/datalists/' + ctx.listId + '/fill', requestBody(), controller.signal).then(function (res) {
        if (res.ok && res.data.ok) {
          var loader = function () { return request('POST', '/api/ai/datalists/' + ctx.listId + '/fill/prompt', requestBody()); };
          var inner = Object.assign({}, ctx, { promptLoader: loader });
          var applied = ctx.onApplied;
          inner.onApplied = function (result) { dlg.close(); if (applied) { applied(result); } };
          openPreview(res.data, inner);
        } else {
          var e = explain(res);
          showAlert(alertBox, 'danger', e.message, e.href);
        }
      }, function (error) { showAlert(alertBox, 'danger', failure(error), null); }).then(function () {
        go.disabled = false;
        busy.el.hidden = true;
        controller = null;
      });
    });

    dlg.open();
    setTimeout(function () { instr.focus(); }, 30);
  }

  // ================================================================================================ the latest runs on a list

  function statusClass(status) {
    return status === 'Done' ? 'mat-pill--ok' : status === 'Waiting' ? 'mat-pill--info' : status === 'Error' ? 'mat-pill--error' : status === 'Stuck' || status === 'LimitReached' ? 'mat-pill--warn' : '';
  }

  /** The newest runs on this list (a designer sees their own, an administrator all): "Vorschlag ansehen" for a waiting proposal, "Rückgängig" for what a run changed. */
  function runsPanel(container, ctx) {
    function load() {
      return request('GET', '/api/ai/datalists/' + ctx.listId + '/runs').then(function (res) {
        container.textContent = '';
        if (!res.ok || !Array.isArray(res.data)) { container.appendChild(el('p', 'mat-muted', 'Die Läufe konnten nicht geladen werden.')); return; }
        if (res.data.length === 0) { container.appendChild(el('p', 'mat-muted', 'Noch keine KI-Läufe an dieser Liste.')); return; }
        var ul = el('ul', 'dt-notes');
        res.data.forEach(function (run) {
          var li = el('li', 'dt-note');
          var ic = el('span', 'dt-note__icon');
          ic.appendChild(icon('sparkles'));
          li.appendChild(ic);
          var bodyEl = el('div', 'dt-note__body');
          var title = el('span', 'dt-note__title');
          title.appendChild(doc.createTextNode(run.actionLabel + ' '));
          title.appendChild(el('span', 'mat-pill ' + statusClass(run.status), run.statusLabel));
          bodyEl.appendChild(title);
          var meta = dateText(run.date) + (run.who ? ' · ' + run.who : '') + (run.changes ? ' · ' + plural(run.changes, 'Änderung', 'Änderungen') + (run.open === 0 ? ' (rückgängig)' : '') : '')
            + (run.tokens ? ' · ' + run.tokens.toLocaleString('de-DE') + (run.estimated ? ' Tokens ≈' : ' Tokens') : '') + (run.error ? ' · ' + run.error : '');
          bodyEl.appendChild(el('span', 'dt-note__meta', meta));
          li.appendChild(bodyEl);
          var actions = el('div', 'dt-ai-runactions');
          if (run.canOpen) {
            var view = button('Vorschlag ansehen', 'eye', 'mat-btn--secondary mat-btn--sm');
            view.addEventListener('click', function () { openProposal(run.id, Object.assign({}, ctx, { onApplied: function (r) { if (ctx.onApplied) { ctx.onApplied(r); } load(); }, onDiscarded: load })); });
            actions.appendChild(view);
          }
          if (run.canUndo) {
            var undo = button('Rückgängig', 'restore', 'mat-btn--ghost mat-btn--sm');
            undo.addEventListener('click', function () {
              undo.disabled = true;
              request('POST', '/api/ai/runs/' + run.id + '/undo').then(function (r) {
                if (r.ok) { toast(r.data.message || 'Rückgängig gemacht.', 'success'); if (ctx.onUndone) { ctx.onUndone(); } } else { toast(explain(r).message, 'danger'); }
                load();
              }, function () { undo.disabled = false; toast('Keine Verbindung.', 'warning'); });
            });
            actions.appendChild(undo);
          }
          if (ctx.runHref) {
            var link = el('a', 'mat-btn mat-btn--ghost mat-btn--sm', 'Details');
            link.href = ctx.runHref.replace('{id}', String(run.id));
            actions.appendChild(link);
          }
          li.appendChild(actions);
          ul.appendChild(li);
        });
        container.appendChild(ul);
      }, function () { container.textContent = ''; container.appendChild(el('p', 'mat-muted', 'Die Läufe konnten nicht geladen werden.')); });
    }
    load();
    return { reload: load };
  }

  // ================================================================================================ text suggestion (designer)

  var TEXT_PRESETS = ['Kürzer', 'Freundlicher', 'Sachlicher', 'Werblicher', 'Einfacher'];

  /**
   * ctx: { designId, text, elementName, width, height, unit, fields: [{key,label,type,sample}], onPick(text) }.
   * The server keeps only suggestions that carry exactly the placeholders of the text; the person clicks one, the designer applies it as an ordinary change (Strg+Z).
   */
  function suggestText(ctx) {
    var dlg = makeDialog('Mit KI formulieren', 'sparkles', 'lg');
    var body = dlg.body;
    var id = uid('sug');
    var preview = el('div', 'dt-ai-original');
    preview.appendChild(el('span', 'dt-ai-original__label', 'Jetziger Text'));
    preview.appendChild(el('p', 'dt-ai-original__text', ctx.text && ctx.text.trim() ? ctx.text : '(leer)'));
    body.appendChild(preview);

    var field = el('div', 'mat-field mat-field--full');
    var label = el('label', 'mat-label', 'Was soll die KI anders machen? (optional)');
    label.setAttribute('for', id + '-instr');
    var instr = el('textarea', 'mat-textarea mat-input dt-ai-text');
    instr.id = id + '-instr';
    instr.rows = 2;
    instr.maxLength = 1000;
    instr.placeholder = 'Zum Beispiel: kürzer, freundlicher, für Kinder, im Ton einer Bäckerei.';
    field.appendChild(label);
    field.appendChild(instr);
    var chips = el('div', 'dt-ai-chips');
    TEXT_PRESETS.forEach(function (text) {
      var chip = button(text, null, 'mat-btn--secondary mat-btn--sm');
      chip.addEventListener('click', function () { instr.value = text; instr.focus(); });
      chips.appendChild(chip);
    });
    field.appendChild(chips);
    body.appendChild(field);
    body.appendChild(el('p', 'mat-hint', 'Platzhalter wie {{Name}} bleiben unverändert: Vorschläge, die sie ändern, verwirft der Code.'));

    function requestBody() {
      return { text: ctx.text || '', instruction: instr.value, elementName: ctx.elementName || null, width: ctx.width || null, height: ctx.height || null, unit: ctx.unit || 'mm', fields: ctx.fields || [] };
    }

    var alertBox = el('div', 'dt-ai-alert');
    alertBox.hidden = true;
    body.appendChild(alertBox);
    var busy = busyLine();
    body.appendChild(busy.el);
    var results = el('div', 'dt-ai-results');
    results.hidden = true;
    results.setAttribute('aria-live', 'polite');
    body.appendChild(results);
    body.appendChild(promptBox(function () { return request('POST', '/api/ai/designs/' + ctx.designId + '/suggest/prompt', requestBody()); }));

    var go = button('Vorschläge holen', 'sparkles', 'mat-btn--primary');
    var cancel = button('Schließen', null, 'mat-btn--secondary');
    cancel.setAttribute('data-dialog-close', '');
    dlg.row.appendChild(go);
    dlg.row.appendChild(cancel);

    var controller = null;
    busy.cancel.addEventListener('click', function () { if (controller) { controller.abort(); } });
    dlg.onClose = function () { if (controller) { controller.abort(); } };

    function showResults(data) {
      results.textContent = '';
      results.hidden = false;
      var p = data.proposal || {};
      var items = p.suggestions || [];
      if (items.length === 0) {
        results.appendChild(el('p', 'dt-ai-summary', 'Die KI hat keinen brauchbaren Vorschlag geliefert. Versuche es mit einer genaueren Anweisung.'));
      } else {
        results.appendChild(el('p', 'dt-ai-summary', 'Klicke einen Vorschlag an, um ihn zu übernehmen. Du kannst das mit Strg+Z zurücknehmen.'));
        items.forEach(function (text, index) {
          var b = el('button', 'dt-ai-suggestion');
          b.type = 'button';
          b.setAttribute('aria-label', 'Vorschlag ' + (index + 1) + ' übernehmen');
          b.appendChild(el('span', 'dt-ai-suggestion__n', String(index + 1)));
          b.appendChild(el('span', 'dt-ai-suggestion__text', text));
          b.addEventListener('click', function () {
            dlg.close();
            if (ctx.onPick) { ctx.onPick(text); }
            toast('Der Text ist übernommen. Strg+Z nimmt ihn zurück.', 'success');
          });
          results.appendChild(b);
        });
      }

      if ((p.warnings || []).length) { results.appendChild(listBlock('Verworfen', p.warnings, 'warning')); }
      results.appendChild(el('p', 'mat-hint', 'Lauf #' + data.runId + (data.tokens ? ' · ' + data.tokens.toLocaleString('de-DE') + (data.estimated ? ' Tokens (geschätzt)' : ' Tokens') : '') + '.'));
    }

    go.addEventListener('click', function () {
      hideAlert(alertBox);
      results.hidden = true;
      go.disabled = true;
      busy.el.hidden = false;
      busy.text.textContent = 'Die KI formuliert ...';
      controller = new AbortController();
      request('POST', '/api/ai/designs/' + ctx.designId + '/suggest', requestBody(), controller.signal).then(function (res) {
        if (res.ok && res.data.ok) { showResults(res.data); setLabel(go, 'Neue Vorschläge'); }
        else { var e = explain(res); showAlert(alertBox, 'danger', e.message, e.href); }
      }, function (error) { showAlert(alertBox, 'danger', failure(error), null); }).then(function () {
        go.disabled = false;
        busy.el.hidden = true;
        controller = null;
      });
    });

    dlg.open();
    setTimeout(function () { instr.focus(); }, 30);
  }

  window.DtAi = { request: request, importForm: importForm, openImport: openImport, openFill: openFill, openProposal: openProposal, runsPanel: runsPanel, suggestText: suggestText, undoToast: undoToast };

  // ================================================================================================ the data list page: the Import/Export section

  function startPage() {
    var section = doc.querySelector('[data-ai-import]');
    if (!section) { return; }
    var listId = parseInt(section.getAttribute('data-list-id'), 10);
    var blocked = section.getAttribute('data-ai-blocked') || null;
    function grid() { var g = doc.querySelector('[data-dt-grid]'); return g && g._dtGrid ? g._dtGrid : null; }
    function reloadGrid() { var g = grid(); if (g) { g.load(); } }
    var ctx = {
      listId: listId,
      blocked: blocked,
      runHref: section.getAttribute('data-run-href'),
      onApplied: function () { reloadGrid(); if (panel) { panel.reload(); } updateRowCount(); },
      onUndone: function () { reloadGrid(); updateRowCount(); },
    };
    function updateRowCount() { /* the count in the tab label is refreshed on the next page load */ }
    var formHost = section.querySelector('[data-ai-form]');
    var panelHost = section.querySelector('[data-ai-runs]');
    if (formHost) { importForm(formHost, ctx); }
    var panel = panelHost ? runsPanel(panelHost, ctx) : null;
    var wanted = parseInt(section.getAttribute('data-open-run') || '', 10);
    if (wanted > 0) { openProposal(wanted, ctx); }
  }

  if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', startPage); } else { startPage(); }
})();
