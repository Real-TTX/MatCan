/* DesignThix editor, part 10e: the design assistant (docs/PLAN-AI-DESIGN.md sections 1 and 4). The rail entry "KI" and its panel: a chat about THIS design. The server runs the model in a loop
   (one run per message); this script follows the run: it polls the steps, shows every step as it happens (the model's words while they are written, every action as a card), and makes the
   canvas the live preview - after each action that changed the design it loads the document and shows it, the touched elements flash, the page of the action comes into view.
   While a run works the editor is read-only (app.setBusy: is-ai-busy, a bar over the canvas "Die KI arbeitet … Stopp"); after the run the whole run is ONE undo step of the editor
   (app.replaceDocument(doc, { undoable: 'ai', before })). The model can LOOK at the page: a poll that carries a renderRequest is answered with a picture the engine draws.
   All text of the model and of the person goes to the page through textContent and DOM APIs (the tiny Markdown builds elements); no markup strings, no style attributes (flash places are custom properties).
   D.ai = { init, open, send, entryVisible, state } - the module keeps its state itself, so the panel can be rebuilt at any time. Server: Endpoints/AiAgentEndpoints.cs, docs/EDITOR.md "The design assistant". */
(function () {
  'use strict';

  var D = window.DtDesigner;
  var POLL_MS = 1000;
  var POLL_ERROR_MS = 3000;
  var EXAMPLES = [
    'Mach daraus ein Plakat für ein Sommerfest',
    'Übersetze alle Texte ins Englische',
    'Nutze unsere Markenfarben und Schriften',
    'Erzeuge drei Varianten auf neuen Seiten',
    'Mehr Weißraum, ruhiger',
    'Ersetze die Texte durch Platzhalter für eine Serie',
  ];
  var END_TEXT = {
    done: ['is-done', 'check-circle', 'Fertig'],
    waiting: ['is-waiting', 'circle-question-mark', 'Wartet auf deine Antwort'],
    stalled: ['is-stopped', 'pause', 'Angehalten'],
    limit: ['is-stopped', 'pause', 'Limit erreicht'],
    error: ['is-error', 'alert', 'Fehler'],
    cancelled: ['is-stopped', 'stop', 'Abgebrochen'],
  };

  var app;
  var config;
  var root;
  var ui = null;                    // the parts of the panel while it is shown
  var attach = null;                // the files chosen for the next message (ai-attach.js)
  var pollTimer = 0;
  var pollSeq = 0;
  var thinkTimer = 0;
  var typeTimer = 0;
  var shown = '';                   // how much of the partial answer has been typed out
  var docChain = Promise.resolve();
  var renderSeen = {};
  var baseTitle = document.title;
  var autoFollow = true;
  var flashLayer = null;
  var bar = null;
  var vvBound = false;

  var state = {
    agent: null,                    // the answer of GET /api/ai/designs/{id}/agent
    conv: 0, title: '', steps: [], lastStep: 0,
    running: false, busy: false, sending: false, offline: false,
    run: 0, runId: 0, tokens: 0, partial: null, thinkSince: 0,
    undoRun: null, undoOther: false,
    scope: { kind: 'design', locked: false },
    draft: '', refs: [], notice: null, view: 'chat',
    preRun: null,                   // the document before the run (the one undo step leads back to it)
  };

  // ================================================================================================ small helpers

  function request(method, url, body, options) {
    return D.request(method, url, body, options).catch(function () { return { ok: false, status: 0, data: null, offline: true }; });
  }

  function errorText(res, fallback) {
    if (res.offline) { return 'Keine Verbindung: Das hat nicht geklappt.'; }
    if (res.data && res.data.error) { return res.data.error; }
    if (res.status === 403 || res.status === 404) { return 'Das geht nicht (mehr).'; }
    return fallback || 'Das hat nicht geklappt.';
  }

  function ago(iso) {
    var t = new Date(iso).getTime();
    if (isNaN(t)) { return ''; }
    var s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) { return 'gerade eben'; }
    if (s < 3600) { return 'vor ' + Math.floor(s / 60) + ' Min.'; }
    if (s < 86400) { return 'vor ' + Math.floor(s / 3600) + ' Std.'; }
    if (s < 7 * 86400) { return 'vor ' + Math.floor(s / 86400) + ' Tg.'; }
    return new Date(t).toLocaleDateString('de-DE');
  }

  function pretty(v) {
    var text;
    try { text = JSON.stringify(v === undefined ? null : v, null, 2); } catch (e) { text = String(v); }
    return text.length > 20000 ? text.slice(0, 20000) + '\n… (gekürzt)' : text;
  }

  function storeKey() { return 'dt-ai-conv-' + app.id; }

  function remember(id) {
    try { if (id) { sessionStorage.setItem(storeKey(), String(id)); } else { sessionStorage.removeItem(storeKey()); } } catch (e) { /* ignore */ }
  }

  function pageName(pageId) {
    var i = app.doc ? app.doc.pages.findIndex(function (p) { return p.id === pageId; }) : -1;
    return i < 0 ? '' : (app.doc.pages[i].name || 'Seite ' + (i + 1));
  }

  // ================================================================================================ tiny Markdown (elements, never markup)

  /** **bold** and `code` inside a line, as text nodes and elements. */
  function inline(parent, text) {
    var parts = String(text).split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/);
    parts.forEach(function (part) {
      if (!part) { return; }
      if (part.length > 4 && part.slice(0, 2) === '**' && part.slice(-2) === '**') { parent.appendChild(D.el('strong', { text: part.slice(2, -2) })); }
      else if (part.length > 2 && part[0] === '`' && part[part.length - 1] === '`') { parent.appendChild(D.el('code', { text: part.slice(1, -1) })); }
      else { parent.appendChild(document.createTextNode(part)); }
    });
  }

  /** The text of a message as paragraphs and bullet lists (a line that starts with "- " or "* "); everything else is text. */
  function markdown(text) {
    var box = D.el('div', { class: 'dt-ag-text' });
    var list = null;
    var para = null;
    var closeBlocks = function () { list = null; para = null; };
    String(text || '').replace(/\r\n?/g, '\n').split('\n').forEach(function (line) {
      var bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
      if (bullet) {
        para = null;
        if (!list) { list = D.el('ul', { class: 'dt-ag-list' }); box.appendChild(list); }
        var li = D.el('li');
        inline(li, bullet[1]);
        list.appendChild(li);
      } else if (!line.trim()) {
        closeBlocks();
      } else {
        list = null;
        if (!para) { para = D.el('p'); box.appendChild(para); } else { para.appendChild(D.el('br')); }
        inline(para, line.trim());
      }
    });
    return box;
  }

  // ================================================================================================ the log

  function runBox(run) {
    var box = D.$('.dt-ag-run[data-run="' + run + '"]', ui.log);
    if (!box) {
      box = D.el('div', { class: 'dt-ag-run', 'data-run': String(run) });
      ui.log.appendChild(box);
    }
    return box;
  }

  function chipFor(f, isRef) {
    var cls = 'dt-ag-chip' + (f.refused ? ' is-refused' : '') + (isRef ? ' is-ref' : '');
    var chip = D.el('span', { class: cls, title: f.refused ? f.name + ': ' + f.refused : f.name });
    if (!f.refused && f.kind === 'image' && f.assetKey) {
      var a = app.assetByKey ? app.assetByKey(f.assetKey) : null;
      chip.appendChild(D.el('img', { class: 'dt-ag-chip__thumb', src: a && a.url ? a.url : '/media/' + encodeURIComponent(f.assetKey), alt: '', loading: 'lazy' }));
    } else {
      chip.appendChild(D.icon(f.refused ? 'alert' : (isRef ? (f.refKind === 'datalist' ? 'table-2' : 'layout-template') : (f.kind === 'image' ? 'image' : 'file-text'))));
    }
    chip.appendChild(D.el('span', { class: 'dt-ag-chip__name', text: f.refused ? f.name + ' – ' + f.refused : f.name }));
    return chip;
  }

  function userMessage(step) {
    var d = step.data || {};
    var msg = D.el('div', { class: 'dt-ag-msg dt-ag-msg--user', 'data-kind': 'user' });
    msg.appendChild(D.el('div', { class: 'dt-ag-bubble' }, [markdownOrText(step.text)]));
    var chips = (d.files || []).map(function (f) { return chipFor(f, false); }).concat((d.refs || []).map(function (f) { return chipFor(f, true); }));
    if (d.scope && d.scope.kind && d.scope.kind !== 'design') {
      var where = d.scope.kind === 'page' ? 'Diese Seite' : 'Auswahl (' + ((d.scope.elementIds || []).length) + ')';
      chips.push(D.el('span', { class: 'dt-ag-chip is-scope', title: d.scope.locked ? 'Die KI darf nur hier ändern' : 'Die KI arbeitet hier, darf aber auch woanders ändern' }, [D.icon(d.scope.locked ? 'lock' : 'scan'), D.el('span', { class: 'dt-ag-chip__name', text: where + (d.scope.locked ? ' · nur hier' : '') })]));
    }
    if (chips.length) { msg.appendChild(D.el('div', { class: 'dt-ag-chips' }, chips)); }
    return msg;
  }

  function markdownOrText(text) {
    var box = D.el('div', { class: 'dt-ag-text' });
    String(text || '').split(/\n/).forEach(function (line, i) { if (i) { box.appendChild(D.el('br')); } box.appendChild(document.createTextNode(line)); });
    return box;
  }

  function details(label, text) {
    return D.el('details', { class: 'dt-ag-details' }, [D.el('summary', { text: label }), D.el('pre', { class: 'dt-ag-pre', text: text })]);
  }

  function assistantMessage(step) {
    var d = step.data || {};
    var msg = D.el('div', { class: 'dt-ag-msg dt-ag-msg--ai', 'data-kind': 'assistant' });
    var head = D.el('div', { class: 'dt-ag-who' }, [D.icon('sparkles'), D.el('strong', { text: 'KI' })]);
    if (d.model) { head.appendChild(D.el('span', { class: 'dt-ag-meta', text: '· ' + d.model })); }
    if (d.tokens) { head.appendChild(D.el('span', { class: 'dt-ag-meta', text: '· ' + Number(d.tokens).toLocaleString('de-DE') + ' Tokens' })); }
    msg.appendChild(head);
    if (step.text) { msg.appendChild(markdown(step.text)); }
    else if (d.actions) { msg.appendChild(D.el('div', { class: 'dt-ag-text mat-muted', text: d.actions === 1 ? 'plant 1 Aktion …' : 'plant ' + d.actions + ' Aktionen …' })); }
    if (d.note) { msg.appendChild(D.el('div', { class: 'dt-ag-note', text: d.note })); }
    if (d.raw) { msg.appendChild(details('Rohe Antwort', String(d.raw))); }
    return msg;
  }

  function pictureUrl(name) { return '/api/ai/conversations/' + state.conv + '/files/' + encodeURIComponent(name); }

  function openPicture(name) {
    D.dialog.show({
      title: 'Das hat die KI gesehen', icon: 'eye', size: 'lg',
      body: function (body) { body.appendChild(D.el('img', { class: 'dt-ag-bigpic', src: pictureUrl(name), alt: 'Die Seite, wie die KI sie gesehen hat' })); },
      buttons: [{ label: 'Schließen', kind: 'primary', value: 'ok' }],
    });
  }

  function actionCard(step) {
    var d = step.data || {};
    var ok = d.ok !== false;
    var warnings = d.warnings || [];
    var tone = !ok ? ' is-error' : (warnings.length ? ' is-warn' : (d.changed ? ' is-changed' : ' is-read'));
    var card = D.el('div', { class: 'dt-ag-act' + tone, 'data-kind': 'action', 'data-tool': d.tool || '', 'data-changed': String(!!d.changed) });
    var head = D.el('div', { class: 'dt-ag-act__head' }, [
      D.icon(!ok ? 'alert' : (warnings.length ? 'triangle-alert' : (d.changed ? 'pencil' : 'eye')), 'dt-ag-act__icon'),
      D.el('span', { class: 'dt-ag-act__text', text: step.text }),
    ]);
    card.appendChild(head);
    // a refused action says why in the words of the tool (the headline is only a few words)
    var why = !ok && d.result && typeof d.result.error === 'string' ? d.result.error : '';
    if (why && why.toLowerCase() !== String(step.text || '').toLowerCase()) { card.appendChild(D.el('p', { class: 'dt-ag-act__why', text: why })); }
    if (warnings.length) {
      var ul = D.el('ul', { class: 'dt-ag-warn' });
      warnings.forEach(function (w) { ul.appendChild(D.el('li', { text: String(w) })); });
      card.appendChild(ul);
    }
    if (d.picture) {
      var thumb = D.el('img', { src: pictureUrl(d.picture), alt: '' });
      thumb.addEventListener('load', function () { scrollEnd(false); });
      var pic = D.el('button', { type: 'button', class: 'dt-ag-pic', title: 'Größer ansehen', 'aria-label': 'Das Bild ansehen, das die KI bekommen hat' }, thumb);
      pic.addEventListener('click', function () { openPicture(d.picture); });
      card.appendChild(pic);
    }
    var det = D.el('details', { class: 'dt-ag-details' }, [D.el('summary', { text: 'Details · ' + (d.tool || 'Aktion') })]);
    det.appendChild(D.el('div', { class: 'dt-ag-label', text: 'Angaben' }));
    det.appendChild(D.el('pre', { class: 'dt-ag-pre', text: pretty(d.args) }));
    det.appendChild(D.el('div', { class: 'dt-ag-label', text: 'Ergebnis' }));
    det.appendChild(D.el('pre', { class: 'dt-ag-pre', text: pretty(d.result) }));
    card.appendChild(det);
    return card;
  }

  function infoLine(step, isError) {
    var d = step.data || {};
    var line = D.el('div', { class: 'dt-ag-line' + (isError ? ' is-error' : ''), 'data-kind': isError ? 'error' : 'info' }, [D.icon(isError ? 'alert' : 'info'), D.el('span', { text: step.text })]);
    if (d.raw) { line.appendChild(details('Rohe Antwort', String(d.raw))); }
    return line;
  }

  /** The link of an administrator to the limits of the AI (only the server gives the address, and only to an administrator). */
  function limitsLink(href) {
    return D.el('a', { class: 'mat-btn mat-btn--ghost mat-btn--sm dt-ag-limits', href: href, target: '_blank', rel: 'noopener', 'data-limits-link': '' }, [D.icon('sliders'), D.el('span', { text: 'Limits anpassen' })]);
  }

  function endLine(step) {
    var st = (step.data && step.data.state) || 'stalled';
    var m = END_TEXT[st] || END_TEXT.stalled;
    var line = D.el('div', { class: 'dt-ag-end ' + m[0], 'data-kind': 'end', 'data-state': st }, D.el('div', { class: 'dt-ag-end__head' }, [D.icon(m[1]), D.el('strong', { text: m[2] })]));
    if (step.text && st !== 'done' && st !== 'waiting' && st !== 'cancelled') { line.appendChild(D.el('p', { class: 'dt-ag-end__why', text: step.text })); }
    // an administrator can change the limit that stopped the run
    if (st === 'limit' && step.data && step.data.href) { line.appendChild(limitsLink(step.data.href)); }
    if (st === 'stalled' || st === 'error' || st === 'limit') {
      var go = D.el('button', { type: 'button', class: 'mat-btn mat-btn--secondary mat-btn--sm dt-ag-goon' }, [D.icon('play'), D.el('span', { text: 'Weitermachen' })]);
      go.addEventListener('click', function () { send('Mach weiter.'); });
      line.appendChild(go);
    }
    return line;
  }

  /** Puts one step into the log (its run's box). */
  function addStep(step) {
    var empty = D.$('.dt-ag-empty', ui.log);
    if (empty) { empty.remove(); }
    var box = runBox(step.run);
    var node = null;
    if (step.kind === 'user') { node = userMessage(step); }
    else if (step.kind === 'assistant') { node = assistantMessage(step); shown = ''; }
    else if (step.kind === 'action') { node = actionCard(step); }
    else if (step.kind === 'error') { node = infoLine(step, true); }
    else if (step.kind === 'info') { node = infoLine(step, false); }
    else if (step.kind === 'end') {
      D.$$('.dt-ag-goon', ui.log).forEach(function (b) { b.remove(); });
      node = endLine(step);
    }
    if (node) { node.setAttribute('data-step', String(step.id)); box.appendChild(node); }
    if (ui.live && ui.live.parentNode) { ui.live.parentNode.removeChild(ui.live); box.appendChild(ui.live); }
  }

  function renderLog() {
    if (!ui) { return; }
    D.empty(ui.log);
    ui.live = null;
    ui.liveText = null;
    if (!state.steps.length) { ui.log.appendChild(emptyState()); }
    state.steps.forEach(addStep);
    updateLive();
    updateUndo();
    scrollEnd(true);
  }

  function emptyState() {
    var box = D.el('div', { class: 'dt-ag-empty' });
    box.appendChild(D.el('span', { class: 'dt-ag-empty__mark' }, D.icon('sparkles')));
    box.appendChild(D.el('h3', { text: 'Was soll die KI tun?' }));
    box.appendChild(D.el('p', { text: 'Beschreibe, was du brauchst. Die KI arbeitet direkt in deinem Design, du siehst jeden Schritt, und mit Strg+Z nimmst du alles in einem Zug zurück.' }));
    var list = D.el('div', { class: 'dt-ag-examples', role: 'list', 'aria-label': 'Beispiele' });
    EXAMPLES.forEach(function (text) {
      var b = D.el('button', { type: 'button', class: 'dt-ag-example', role: 'listitem', 'data-example': '', text: text });
      b.addEventListener('click', function () {
        if (!ui) { return; }
        ui.input.value = text;
        state.draft = text;
        autosize();
        syncCompose();
        ui.input.focus();
      });
      list.appendChild(b);
    });
    box.appendChild(list);
    return box;
  }

  // ---- scrolling: follows the newest step until the person scrolls up

  function atEnd() { return ui && ui.log.scrollHeight - ui.log.scrollTop - ui.log.clientHeight < 48; }

  function scrollEnd(force) {
    if (!ui) { return; }
    if (force || autoFollow) {
      ui.log.scrollTop = ui.log.scrollHeight;
      autoFollow = true;
      ui.more.hidden = true;
    } else {
      ui.more.hidden = false;
    }
  }

  // ---- the live part: "Die KI denkt nach … 12 s", then the words as they are written

  function liveNode() {
    var node = D.el('div', { class: 'dt-ag-msg dt-ag-msg--ai dt-ag-live', 'data-live': '' });
    node.appendChild(D.el('div', { class: 'dt-ag-who' }, [D.icon('sparkles'), D.el('strong', { text: 'KI' }), D.el('span', { class: 'dt-ag-dots', 'aria-hidden': 'true' }, [D.el('i'), D.el('i'), D.el('i')])]));
    var text = D.el('div', { class: 'dt-ag-text dt-ag-live__text', 'data-live-text': '', 'data-len': '0' });
    node.appendChild(text);
    ui.liveText = text;
    return node;
  }

  function updateLive() {
    if (!ui) { return; }
    if (!state.running) {
      if (ui.live) { ui.live.remove(); ui.live = null; ui.liveText = null; }
      stopTimers();
      return;
    }
    if (!ui.live) {
      ui.live = liveNode();
      var box = runBox(state.run || 1);
      box.appendChild(ui.live);
      var empty = D.$('.dt-ag-empty', ui.log);
      if (empty) { empty.remove(); }
    }
    if (!thinkTimer) { thinkTimer = setInterval(drawThinking, 400); }
    var text = typeof state.partial === 'string' ? state.partial : '';
    if (text.length) {
      if (text.indexOf(shown) !== 0) { shown = ''; }
      if (shown.length < text.length && !typeTimer) { typeTimer = setTimeout(typeStep, 30); }
      ui.live.classList.remove('is-thinking');
    } else {
      shown = '';
      ui.live.classList.add('is-thinking');
      drawThinking();
    }
    scrollEnd(false);
  }

  function drawThinking() {
    if (!ui || !ui.live || !ui.live.classList.contains('is-thinking')) { return; }
    var s = Math.max(0, Math.round((Date.now() - (state.thinkSince || Date.now())) / 1000));
    ui.liveText.textContent = 'Die KI denkt nach … ' + s + ' s';
    ui.liveText.setAttribute('data-len', '0');
  }

  /** The words of the answer appear one after the other (a poll brings a piece of them at once). */
  function typeStep() {
    typeTimer = 0;
    if (!ui || !ui.live || typeof state.partial !== 'string') { return; }
    var target = state.partial;
    if (target.indexOf(shown) !== 0) { shown = ''; }
    if (shown.length >= target.length) { return; }
    var backlog = target.length - shown.length;
    var words = 1 + Math.floor(backlog / 90);
    var end = shown.length;
    for (var i = 0; i < words && end < target.length; i++) {
      var next = target.indexOf(' ', end + 1);
      end = next < 0 ? target.length : next;
    }
    shown = target.slice(0, end);
    ui.liveText.textContent = shown;
    ui.liveText.setAttribute('data-len', String(shown.length));
    scrollEnd(false);
    if (shown.length < target.length) { typeTimer = setTimeout(typeStep, 38); }
  }

  function stopTimers() {
    clearInterval(thinkTimer);
    thinkTimer = 0;
    clearTimeout(typeTimer);
    typeTimer = 0;
  }

  // ---- the button "Rückgängig" under the newest run that changed something

  function updateUndo() {
    if (!ui) { return; }
    D.$$('.dt-ag-undo', ui.log).forEach(function (b) { b.remove(); });
    if (state.running || state.undoRun === null || state.undoRun === undefined) { return; }
    var box = D.$('.dt-ag-run[data-run="' + state.undoRun + '"]', ui.log);
    var other = state.undoOther || !box;
    if (other) { box = ui.log.lastElementChild && ui.log.lastElementChild.classList.contains('dt-ag-run') ? ui.log.lastElementChild : null; }
    if (!box) { return; }
    var b = D.el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--sm dt-ag-undo', 'data-undo-run': String(state.undoRun) }, [D.icon('undo-2'), D.el('span', { text: other ? 'Letzte KI-Änderung rückgängig machen' : 'Rückgängig' })]);
    if (other) { b.title = 'Die letzte Änderung der KI an diesem Design stammt aus einer anderen Unterhaltung.'; }
    b.addEventListener('click', function () { undo(b); });
    box.appendChild(b);
  }

  function undo(button) {
    var confirmText = 'Die Änderungen dieses Laufs werden zurückgenommen. Das Design sieht danach wieder so aus wie vor der Anfrage an die KI.';
    window.MatUi.confirm(confirmText, { ok: 'Rückgängig machen', cancel: 'Abbrechen', title: 'KI-Änderungen zurücknehmen?', danger: true }).then(function (yes) {
      if (!yes) { return null; }
      button.disabled = true;
      return D.save.flush().then(function () { return postUndo(button, false); });
    });
  }

  function postUndo(button, force) {
    return request('POST', '/api/ai/conversations/' + state.conv + '/undo', force ? { force: true } : {}).then(function (res) {
      if (res.status === 409 && res.data && res.data.changedSince) {
        return window.MatUi.confirm('Seitdem wurde das Design geändert. Trotzdem zurücksetzen? Diese Änderungen gehen verloren.', { ok: 'Trotzdem zurücksetzen', cancel: 'Abbrechen', title: 'Das Design wurde geändert', danger: true }).then(function (yes) {
          if (!yes) { button.disabled = false; return null; }
          return postUndo(button, true);
        });
      }
      if (!res.ok) { button.disabled = false; D.toast(errorText(res, 'Das ließ sich nicht zurücknehmen.'), 'danger'); return null; }
      return refreshDoc(false).then(function () {
        app.dropHistory('ai');
        D.toast(res.data && res.data.message ? res.data.message : 'Die KI-Änderungen sind zurückgenommen.', 'success');
        return tick(true);
      });
    });
  }

  // ================================================================================================ the canvas is the preview

  /** Loads the document of the server and shows it. final: the run is over, the whole run becomes ONE undo step. Resolves true when the picture changed. */
  function refreshDoc(final) {
    docChain = docChain.then(function () {
      return request('GET', '/api/designs/' + app.id).then(function (res) {
        if (!res.ok || !res.data || !res.data.document) { return false; }
        var data = res.data;
        var doc = window.DtEngine.normalize(data.document);
        return app.resolveAssets('design:' + app.id, app.assetKeysOf(doc)).then(function () {
          var changed = app.replaceDocument(doc, { undoable: final ? 'ai' : false, before: final ? state.preRun : null, revision: data.revision });
          if (data.name && data.name !== app.name) {
            app.name = data.name;
            var field = document.getElementById('dt-name');
            if (field && document.activeElement !== field) { field.value = data.name; }
            document.title = data.name + ' · DesignThix';
            baseTitle = document.title;
          }
          if (D.save && D.save.clearDraft) { D.save.clearDraft(); }
          return changed;
        });
      });
    }).catch(function () { return false; });
    return docChain;
  }

  function showPage(pageId) {
    if (!pageId || !app.doc) { return; }
    var i = app.doc.pages.findIndex(function (p) { return p.id === pageId; });
    if (i >= 0 && i !== app.pageIndex) { app.setPage(i); }
  }

  function flashLayerEl() {
    if (flashLayer && flashLayer.isConnected) { return flashLayer; }
    flashLayer = D.el('div', { class: 'dt-ag-flashes', id: 'dt-ag-flashes', 'aria-hidden': 'true' });
    document.getElementById('dt-sheet').appendChild(flashLayer);
    return flashLayer;
  }

  /** A short outline around what an action touched (their own layer in the sheet, never in the document); without elements the whole page. */
  function flash(ids) {
    var layer = flashLayerEl();
    var k = app.scale();
    var boxes = [];
    (ids || []).slice(0, 40).forEach(function (id) {
      var r = app.locate(id, false);
      if (!r) { return; }
      boxes.push(D.boxOfPoints(D.worldCorners(r.el, r.chain)));
    });
    var whole = !boxes.length;
    if (whole) { boxes.push({ x: 0, y: 0, w: app.doc.width, h: app.doc.height }); }
    boxes.forEach(function (b) {
      var node = D.el('span', { class: 'dt-ag-flash' + (whole ? ' is-page' : ''), css: { '--dt-fx': D.round(b.x * k, 1) + 'px', '--dt-fy': D.round(b.y * k, 1) + 'px', '--dt-fw': D.round(b.w * k, 1) + 'px', '--dt-fh': D.round(b.h * k, 1) + 'px' } });
      node.addEventListener('animationend', function () { node.remove(); });
      layer.appendChild(node);
      setTimeout(function () { node.remove(); }, 3000);
    });
  }

  // ---- the lock while a run works

  function busyBar() {
    if (bar) { return bar; }
    var stage = D.$('.dt-ds__stage', root);
    bar = D.el('div', { class: 'dt-ag-bar', id: 'dt-ag-bar', role: 'status', 'aria-live': 'polite', hidden: true });
    bar.appendChild(D.el('span', { class: 'dt-ag-bar__spin', 'aria-hidden': 'true' }, D.icon('sparkles')));
    bar.appendChild(D.el('span', { class: 'dt-ag-bar__text', 'data-bar-text': '', text: 'Die KI arbeitet …' }));
    var stop = D.el('button', { type: 'button', class: 'mat-btn mat-btn--sm dt-ag-bar__stop', 'data-ai-stop': '' }, [D.icon('stop'), D.el('span', { text: 'Stopp' })]);
    stop.addEventListener('click', cancel);
    bar.appendChild(stop);
    stage.appendChild(bar);
    return bar;
  }

  function drawBar() {
    if (!bar) { return; }
    var text = D.$('[data-bar-text]', bar);
    var steps = state.steps.filter(function (s) { return s.kind === 'action' && s.run === state.run; }).length;
    text.textContent = state.offline ? 'Verbindung verloren, ich versuche es weiter …' : (steps ? 'Die KI arbeitet … · ' + (steps === 1 ? '1 Aktion' : steps + ' Aktionen') : 'Die KI arbeitet …');
  }

  /** The editor becomes read-only; the document before the run is remembered (the end of the run is ONE undo step back to it). */
  function beginBusy() {
    if (state.busy) { return; }
    state.busy = true;
    if (state.preRun === null && app.doc) { state.preRun = JSON.stringify(app.doc); }
    if (D.canvas.isEditing()) { D.canvas.endTextEdit(true); }
    D.popover.close(false);
    D.menu.close();
    app.setBusy(true);
    root.classList.add('is-ai-busy');
    root.setAttribute('data-ai-state', 'running');
    busyBar().hidden = false;
    drawBar();
  }

  function endBusy() {
    state.busy = false;
    state.preRun = null;
    app.setBusy(false);
    root.classList.remove('is-ai-busy');
    root.setAttribute('data-ai-state', 'idle');
    if (bar) { bar.hidden = true; }
  }

  function loadAssets() {
    return request('GET', '/api/assets?take=500').then(function (res) { if (res.ok && Array.isArray(res.data)) { app.setAssets(res.data, res.data.length < 500); } });
  }

  // ================================================================================================ following a run: polling

  function follow(id) {
    state.conv = id;
    state.steps = [];
    state.lastStep = 0;
    state.title = '';
    state.partial = null;
    state.undoRun = null;
    state.running = false;
    shown = '';
    remember(id);
    if (ui) { renderLog(); }
    return tick(true);
  }

  function tick(now) {
    clearTimeout(pollTimer);
    pollTimer = 0;
    if (!state.conv) { return Promise.resolve(); }
    var seq = ++pollSeq;
    var run = function () {
      return request('GET', '/api/ai/conversations/' + state.conv + '/steps?after=' + state.lastStep).then(function (res) {
        if (seq !== pollSeq) { return null; }
        if (!res.ok || !res.data) {
          if (res.status === 404 || res.status === 403) { lostConversation(); return null; }
          state.offline = true;
          drawBar();
          pollTimer = setTimeout(function () { tick(true); }, POLL_ERROR_MS);
          return null;
        }
        state.offline = false;
        return handle(res.data).then(function () {
          if (seq !== pollSeq) { return null; }
          if (state.running || state.busy) { pollTimer = setTimeout(function () { tick(true); }, POLL_MS); }
          return null;
        });
      });
    };
    return now ? run() : new Promise(function (resolve) { pollTimer = setTimeout(function () { run().then(resolve); }, POLL_MS); });
  }

  function lostConversation() {
    state.conv = 0;
    state.steps = [];
    state.running = false;
    remember(0);
    if (state.busy) { endBusy(); refreshDoc(false); }
    if (ui) { renderLog(); syncCompose(); }
  }

  /** One answer of the steps endpoint: new steps into the log, the canvas follows, a request to look is answered, the end of a run is handled. */
  function handle(data) {
    // a conversation of another design (a hand-made ?ai= address) is not followed here
    if (data.designId && Number(data.designId) !== Number(app.id)) { lostConversation(); return Promise.resolve(); }
    var fresh = [];
    (data.steps || []).forEach(function (s) { if (s.id > state.lastStep) { state.lastStep = s.id; fresh.push(s); } });
    state.steps = state.steps.concat(fresh);
    state.tokens = data.tokens || 0;
    state.undoRun = data.undoRun === undefined ? null : data.undoRun;
    state.undoOther = !!data.undoOther;
    var running = data.status === 'Running';
    state.running = running;
    state.run = data.run || state.run;
    state.runId = data.runId || state.runId;
    if (fresh.length || (running && state.partial === null && typeof data.partial === 'string')) { state.thinkSince = Date.now(); }
    state.partial = running ? (data.partial === undefined ? null : data.partial) : null;
    if (!state.title) {
      var first = state.steps.find(function (s) { return s.kind === 'user'; });
      if (first) { state.title = String(first.text || '').slice(0, 80); }
    }
    if (running) { beginBusy(); }
    if (ui) {
      fresh.forEach(addStep);
      updateLive();
      updateUndo();
      syncCompose();
      drawBar();
      if (fresh.length) { scrollEnd(false); }
      var top = D.$('[data-title]', ui.host);
      if (top) { top.textContent = state.title || 'Neue Unterhaltung'; }
    } else {
      drawBar();
    }
    root.setAttribute('data-ai-steps', String(state.steps.length));

    var changedSteps = fresh.filter(function (s) { return s.kind === 'action' && s.data && s.data.changed; });
    var ending = !running && state.busy;
    var chain = Promise.resolve();
    if (changedSteps.length || ending) {
      chain = refreshDoc(ending).then(function () {
        var last = changedSteps[changedSteps.length - 1];
        if (last) { showPage(last.data.pageId); }
        changedSteps.forEach(function (s) {
          var onPage = (s.data.elementIds || []).filter(function (id) { return app.has(id); });
          if (onPage.length || !(s.data.elementIds || []).length) { flash(onPage); }
        });
      });
    }
    if (data.renderRequest) { answerLook(data.renderRequest); }
    if (ending) {
      chain = chain.then(function () {
        endBusy();
        return loadAssets();
      }).then(function () {
        stopTimers();
        if (document.hidden) { document.title = 'Fertig · ' + baseTitle; }
        if (ui) { updateLive(); updateUndo(); syncCompose(); }
      });
    }
    return chain;
  }

  // ---- "look": the model asked for a picture of a page

  function answerLook(req) {
    if (!req || !req.token || renderSeen[req.token]) { return; }
    renderSeen[req.token] = true;
    var base = '/api/ai/runs/' + req.runId + '/render/' + encodeURIComponent(req.token);
    refreshDoc(false).then(function () {
      var index = app.doc.pages.findIndex(function (p) { return p.id === req.page; });
      if (index < 0) { index = Math.max(0, Math.min(app.doc.pages.length - 1, (req.pageNumber || 1) - 1)); }
      return window.DtEngine.rasterize(app.doc, app.computeValues(), { page: index, maxWidth: req.maxWidth || 1024, format: 'jpeg', quality: 0.85, assetUrl: app.assetUrl, fonts: app.fonts, icon: D.icons.body });
    }).then(function (blob) {
      return request('POST', base, blob, { raw: true, contentType: blob.type || 'image/jpeg' });
    }).catch(function () { return request('POST', base + '/failed', {}); }).then(function (res) {
      if (res && !res.ok && res.status !== 404) { return request('POST', base + '/failed', {}); }
      return null;
    });
  }

  // ================================================================================================ sending

  function currentScope() {
    var s = state.scope;
    if (s.kind === 'page') { return { kind: 'page', pageId: app.page().id, locked: !!s.locked }; }
    if (s.kind === 'selection' && app.sel.length) { return { kind: 'selection', pageId: app.page().id, elementIds: app.sel.slice(), locked: !!s.locked }; }
    return { kind: 'design', locked: false };
  }

  function setNotice(text, tone, href) {
    state.notice = text ? { text: text, tone: tone || 'danger', href: href || '' } : null;
    drawNotice();
  }

  function drawNotice() {
    if (!ui) { return; }
    D.empty(ui.notice);
    ui.notice.hidden = !state.notice;
    if (!state.notice) { return; }
    ui.notice.className = 'dt-ag-notice is-' + state.notice.tone;
    ui.notice.appendChild(D.icon(state.notice.tone === 'danger' ? 'alert' : 'info'));
    ui.notice.appendChild(D.el('span', { text: state.notice.text }));
    if (state.notice.href) { ui.notice.appendChild(limitsLink(state.notice.href)); }
    var x = D.el('button', { type: 'button', class: 'dt-ag-notice__x', 'aria-label': 'Hinweis schließen' }, D.icon('x'));
    x.addEventListener('click', function () { setNotice(null); });
    ui.notice.appendChild(x);
  }

  /** The text of the person (or a fixed text such as "Mach weiter.") goes to the model together with the files, the references and the scope. */
  function send(override) {
    if (state.sending || state.running || state.busy || !state.agent || !state.agent.available) { return Promise.resolve(false); }
    var text = String(typeof override === 'string' ? override : (ui ? ui.input.value : state.draft)).trim();
    var hasFiles = attach.count() > 0;
    if (!text && !hasFiles && !state.refs.length) { if (ui) { ui.input.focus(); } return Promise.resolve(false); }
    if (!text) { text = hasFiles ? 'Bitte sieh dir die Anhänge an.' : 'Bitte sieh dir die Referenzen an.'; }
    setNotice(null);
    state.sending = true;
    syncCompose();
    var failed = function (message, href) { state.sending = false; syncCompose(); setNotice(message, 'danger', href); return false; };
    return D.save.flush().then(function (saved) {
      if (!saved) { return failed('Dein Design konnte gerade nicht gespeichert werden, deshalb habe ich nichts an die KI geschickt. Versuche es gleich noch einmal.'); }
      return attach.ready().then(function () {
        var scope = currentScope();
        var fd = new FormData();
        fd.append('text', text);
        fd.append('scope', JSON.stringify(scope));
        if (state.conv) { fd.append('conversationId', String(state.conv)); }
        fd.append('refs', JSON.stringify(state.refs.map(function (r) { return { kind: r.kind, id: r.id }; })));
        attach.append(fd);
        var previous = state.conv;
        // the editor reads only from here on: nothing the person changes now would be missing from what the AI works on
        beginBusy();
        return request('POST', '/api/ai/designs/' + app.id + '/messages', fd, { formData: true }).then(function (res) {
          if (!res.ok || !res.data) {
            endBusy();
            if (res.status === 429 || (res.data && res.data.code === 'limit')) { return failed(errorText(res, 'Das Limit der KI ist erreicht.'), res.data && res.data.href); }
            return failed(errorText(res, 'Die Nachricht ging nicht an die KI.'));
          }
          state.sending = false;
          if (ui) { ui.input.value = ''; autosize(); }
          state.draft = '';
          attach.clear();
          state.refs = [];
          drawRefs();
          state.running = true;
          state.thinkSince = Date.now();
          autoFollow = true;
          if (res.data.conversationId === previous) { remember(previous); syncCompose(); return tick(true); }
          return follow(res.data.conversationId);
        });
      });
    });
  }

  function cancel() {
    if (!state.conv) { return; }
    var buttons = D.$$('[data-ai-stop]');
    buttons.forEach(function (b) { b.disabled = true; });
    request('POST', '/api/ai/conversations/' + state.conv + '/cancel', {}).then(function () {
      buttons.forEach(function (b) { b.disabled = false; });
      return tick(true);
    });
  }

  // ================================================================================================ the compose box

  function autosize() {
    if (!ui) { return; }
    ui.input.style.setProperty('height', 'auto');
    ui.input.style.setProperty('height', Math.min(ui.input.scrollHeight + 2, 168) + 'px');
  }

  function syncCompose() {
    if (!ui) { return; }
    var running = state.running || state.busy;
    ui.send.hidden = running;
    ui.stop.hidden = !running;
    ui.send.disabled = state.sending || (!ui.input.value.trim() && !attach.count() && !state.refs.length);
    ui.send.classList.toggle('is-loading', state.sending);
    ui.attachBtn.disabled = running || state.sending;
    ui.refBtn.disabled = running || state.sending;
    ui.input.placeholder = running ? 'Die KI arbeitet … du kannst schon die nächste Nachricht schreiben.' : (state.steps.length ? 'Was soll sich noch ändern?' : 'Beschreibe, was die KI tun soll …');
    ui.panelRoot.setAttribute('data-ai-running', String(!!running));
    drawScopeOptions();
    ui.lock.hidden = state.scope.kind === 'design';
  }

  function drawScopeOptions() {
    if (!ui) { return; }
    var n = app.sel.length;
    var sel = ui.scope;
    var options = sel.options;
    options[2].textContent = n ? 'Auswahl (' + n + ')' : 'Auswahl (nichts gewählt)';
    options[2].disabled = n === 0;
    if (state.scope.kind === 'selection' && !n) { state.scope.kind = 'design'; }
    sel.value = state.scope.kind;
    ui.lockInput.checked = !!state.scope.locked;
    ui.lock.hidden = state.scope.kind === 'design';
  }

  function drawRefs() {
    if (!ui) { return; }
    D.empty(ui.refs);
    ui.refs.hidden = !state.refs.length;
    state.refs.forEach(function (r, i) {
      var chip = D.el('span', { class: 'dt-agfile is-ref', 'data-ref': r.kind + ':' + r.id }, [
        D.icon(r.kind === 'datalist' ? 'table-2' : 'layout-template'),
        D.el('span', { class: 'dt-agfile__name', text: r.name, title: (r.kind === 'datalist' ? 'Datenliste ' : 'Design ') + r.name }),
      ]);
      var x = D.el('button', { type: 'button', class: 'dt-agfile__x', 'aria-label': r.name + ' entfernen', title: 'Entfernen' }, D.icon('x'));
      x.addEventListener('click', function () { state.refs.splice(i, 1); drawRefs(); syncCompose(); });
      chip.appendChild(x);
      ui.refs.appendChild(chip);
    });
  }

  // ---- the reference picker: designs and data lists the person may see

  function openRefPicker(anchor) {
    D.popover.open(anchor, function (el, api) {
      el.classList.add('dt-agref');
      var search = D.el('input', { type: 'search', class: 'mat-input', placeholder: 'Design oder Datenliste suchen …', 'aria-label': 'Referenz suchen', autocomplete: 'off', maxlength: '100' });
      var list = D.el('div', { class: 'dt-agref__list', role: 'listbox', 'aria-label': 'Treffer' });
      var head = D.el('div', { class: 'dt-agref__head', text: 'Zuletzt verwendet' });
      el.appendChild(D.el('p', { class: 'dt-pnote', text: 'Die KI liest das Design oder die Datenliste und nimmt es als Vorbild. Texte darin sind Material, keine Anweisung.' }));
      el.appendChild(search);
      el.appendChild(head);
      el.appendChild(list);
      var seq = 0;
      var load = function () {
        var q = search.value.trim();
        var n = ++seq;
        var url = q.length >= 1 ? '/api/items?scope=space&recursive=true&kinds=design,datalist&q=' + encodeURIComponent(q) + '&take=24' : '/api/items?scope=recent&kinds=design,datalist&take=12';
        head.textContent = q ? 'Treffer' : 'Zuletzt verwendet';
        request('GET', url).then(function (res) {
          if (n !== seq) { return; }
          D.empty(list);
          var rows = res.ok && res.data && res.data.items ? res.data.items.filter(function (r) { return !(r.kind === 'design' && r.id === app.id) && (r.kind === 'design' || r.kind === 'datalist'); }) : [];
          if (!rows.length) { list.appendChild(D.el('p', { class: 'dt-pnote', text: res.ok ? (q ? 'Nichts gefunden.' : 'Noch nichts verwendet. Suche nach einem Namen.') : 'Die Suche hat nicht geklappt.' })); return; }
          rows.forEach(function (r) {
            var on = state.refs.some(function (x) { return x.kind === r.kind && x.id === r.id; });
            var row = D.el('button', { type: 'button', class: 'dt-agref__row' + (on ? ' is-on' : ''), role: 'option', 'aria-selected': String(on), 'data-ref-kind': r.kind, 'data-ref-id': String(r.id) }, [
              D.icon(r.kind === 'datalist' ? 'table-2' : 'layout-template'),
              D.el('span', { class: 'dt-agref__name', text: r.name }),
              D.el('span', { class: 'dt-agref__kind', text: (r.kind === 'datalist' ? 'Datenliste' : 'Design') + (r.spaceName ? ' · ' + r.spaceName : '') }),
              on ? D.icon('check') : null,
            ]);
            row.addEventListener('click', function () {
              var at = state.refs.findIndex(function (x) { return x.kind === r.kind && x.id === r.id; });
              if (at >= 0) { state.refs.splice(at, 1); }
              else if (state.refs.length >= 6) { D.toast('Höchstens 6 Referenzen pro Nachricht.', 'warning'); return; }
              else { state.refs.push({ kind: r.kind, id: r.id, name: r.name }); }
              drawRefs();
              syncCompose();
              load();
            });
            list.appendChild(row);
          });
        });
      };
      search.addEventListener('input', D.debounce(load, 220));
      load();
      void api;
    }, { title: 'Referenz wählen', width: 340, align: 'start', keepEdit: false });
  }

  // ---- the whole instruction ("Vollständige Anweisung anzeigen") and the menu of the panel

  function showInstruction() {
    var scope = encodeURIComponent(JSON.stringify(currentScope()));
    request('GET', '/api/ai/designs/' + app.id + '/agent/prompt?scope=' + scope).then(function (res) {
      D.dialog.show({
        title: 'Anweisung an die KI', icon: 'sparkles', size: 'lg',
        body: function (body) {
          body.appendChild(D.el('p', { class: 'mat-muted', text: 'Genau dieser Text geht an die KI: die Anweisungen, das Antwortformat, die Werkzeuge und die Lage deines Designs. Die Nachrichten kommen danach.' }));
          body.appendChild(D.el('pre', { class: 'dt-ag-pre dt-ag-pre--tall', text: res.ok && res.data ? String(res.data.text || '') : errorText(res, 'Die Anweisung konnte nicht geladen werden.') }));
        },
        buttons: [{ label: 'Schließen', kind: 'primary', value: 'ok' }],
      });
    });
  }

  function newConversation() {
    if (state.running || state.busy) { D.toast('Die KI arbeitet gerade. Stoppe sie, bevor du neu beginnst.', 'warning'); return; }
    pollSeq++;
    clearTimeout(pollTimer);
    state.conv = 0;
    state.steps = [];
    state.lastStep = 0;
    state.title = '';
    state.undoRun = null;
    state.view = 'chat';
    shown = '';
    remember(0);
    setNotice(null);
    if (ui) { ui.api.rebuild(); }
  }

  function deleteConversation(id, then) {
    window.MatUi.confirm('Die Unterhaltung mit allen Schritten wird gelöscht. Änderungen am Design bleiben, wie sie sind.', { ok: 'Löschen', cancel: 'Abbrechen', title: 'Unterhaltung löschen?', danger: true }).then(function (yes) {
      if (!yes) { return; }
      request('POST', '/api/ai/conversations/' + id + '/delete', {}).then(function (res) {
        if (!res.ok) { D.toast(errorText(res, 'Das Löschen hat nicht geklappt.'), 'danger'); return; }
        if (id === state.conv) { state.conv = 0; state.steps = []; remember(0); }
        if (then) { then(); }
      });
    });
  }

  // ================================================================================================ the history

  function buildHistory(host, api) {
    var wrap = D.el('div', { class: 'dt-ag-history' });
    var back = D.el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--sm dt-ag-back' }, [D.icon('arrow-left'), D.el('span', { text: 'Zurück zum Chat' })]);
    back.addEventListener('click', function () { state.view = 'chat'; api.rebuild(); });
    wrap.appendChild(D.el('div', { class: 'dt-ag-top' }, [back]));
    wrap.appendChild(D.el('h3', { class: 'dt-ag-hist__head', text: 'Frühere Unterhaltungen mit der KI' }));
    var list = D.el('div', { class: 'dt-ag-hist', 'data-history': '' }, D.el('p', { class: 'dt-pnote', text: 'Die Unterhaltungen werden geladen …' }));
    wrap.appendChild(list);
    host.appendChild(wrap);
    request('GET', '/api/ai/designs/' + app.id + '/conversations').then(function (res) {
      D.empty(list);
      if (!res.ok || !Array.isArray(res.data)) { list.appendChild(D.el('p', { class: 'dt-pnote', text: errorText(res, 'Der Verlauf konnte nicht geladen werden.') })); return; }
      if (!res.data.length) { list.appendChild(D.el('div', { class: 'dt-pempty' }, [D.icon('clock', 'dt-pempty__icon'), D.el('p', { text: 'Noch keine Unterhaltungen mit der KI zu diesem Design.' })])); return; }
      res.data.forEach(function (c) {
        var open = D.el('button', { type: 'button', class: 'dt-ag-hist__main', 'data-conv': String(c.id) }, [
          D.el('span', { class: 'dt-ag-hist__title', text: c.title || 'Unterhaltung' }),
          D.el('span', { class: 'dt-ag-hist__meta mat-muted', text: (c.runs === 1 ? '1 Lauf' : c.runs + ' Läufe') + ' · ' + ago(c.updated) + (c.status === 'Running' ? ' · arbeitet gerade' : '') }),
        ]);
        open.addEventListener('click', function () {
          if (state.running || state.busy) { D.toast('Die KI arbeitet gerade.', 'warning'); return; }
          state.view = 'chat';
          autoFollow = true;
          follow(c.id);
          api.rebuild();
        });
        var del = D.el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--icon mat-btn--sm', 'aria-label': 'Unterhaltung löschen', title: 'Löschen' }, D.icon('trash'));
        del.addEventListener('click', function () { deleteConversation(c.id, function () { api.rebuild(); }); });
        list.appendChild(D.el('div', { class: 'dt-ag-hist__row' + (c.id === state.conv ? ' is-active' : '') }, [open, del]));
      });
    });
  }

  // ================================================================================================ the panel

  function buildUnavailable(host) {
    var a = state.agent || {};
    var box = D.el('div', { class: 'dt-pempty dt-ag-off' }, [
      D.icon('sparkles', 'dt-pempty__icon'),
      D.el('h3', { text: 'Die KI ist noch nicht bereit' }),
      D.el('p', { text: a.reason || 'Die KI ist hier gerade nicht verfügbar.' }),
    ]);
    if (a.settingsHref) { box.appendChild(D.el('a', { class: 'mat-btn mat-btn--primary', href: a.settingsHref, target: '_blank', rel: 'noopener' }, [D.icon('settings'), D.el('span', { text: 'Zu den KI-Einstellungen' })])); }
    host.appendChild(box);
  }

  function build(host, api) {
    app = api.app;
    host.classList.add('dt-ag-host');
    api.setTitle('KI-Assistent');
    if (!state.agent) { host.appendChild(D.el('p', { class: 'dt-pnote', text: 'Die KI wird vorbereitet …' })); return; }
    if (!state.agent.available) { buildUnavailable(host); return; }
    if (state.view === 'history') { buildHistory(host, api); return; }

    var panelRoot = D.el('div', { class: 'dt-ag', 'data-ai-panel': '' });
    // top: the title of the conversation, the history, a new one, more
    var title = D.el('span', { class: 'dt-ag-top__title', 'data-title': '', text: state.title || 'Neue Unterhaltung' });
    var histBtn = D.el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--sm dt-ag-hist-btn', title: 'Frühere Unterhaltungen', 'aria-label': 'Verlauf' }, [D.icon('clock'), D.el('span', { text: 'Verlauf' })]);
    histBtn.addEventListener('click', function () { state.view = 'history'; api.rebuild(); });
    var newBtn = D.el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--sm dt-ag-new-btn', title: 'Neue Unterhaltung beginnen', 'aria-label': 'Neu' }, [D.icon('plus'), D.el('span', { text: 'Neu' })]);
    newBtn.addEventListener('click', newConversation);
    var more = D.el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--icon mat-btn--sm', title: 'Mehr', 'aria-label': 'Mehr', 'aria-haspopup': 'menu' }, D.icon('ellipsis'));
    more.addEventListener('click', function () {
      D.menu.open([
        { label: 'Anweisung an die KI anzeigen', icon: 'eye', run: showInstruction },
        { type: 'separator' },
        { label: 'Unterhaltung löschen', icon: 'trash', danger: true, disabled: !state.conv ? 'Es gibt noch keine Unterhaltung.' : (state.running ? 'Die KI arbeitet gerade.' : false), run: function () { deleteConversation(state.conv, function () { newConversation(); }); } },
      ], { anchor: more });
    });
    var top = D.el('div', { class: 'dt-ag-top' }, [title, D.el('span', { class: 'dt-ag-top__spacer' }), histBtn, newBtn, more]);

    var log = D.el('div', { class: 'dt-ag-log', role: 'log', 'aria-label': 'Verlauf mit der KI', tabindex: '0' });
    var moreChip = D.el('button', { type: 'button', class: 'dt-ag-more', hidden: true }, [D.el('span', { text: 'Neue Schritte' }), D.icon('arrow-down')]);
    moreChip.addEventListener('click', function () { autoFollow = true; scrollEnd(true); });
    log.addEventListener('scroll', function () {
      autoFollow = !!atEnd();
      if (autoFollow) { moreChip.hidden = true; }
    });

    // the compose box
    var notice = D.el('div', { class: 'dt-ag-notice', role: 'alert', hidden: true });
    var files = D.el('div', { class: 'dt-agfiles', hidden: true });
    var refs = D.el('div', { class: 'dt-agfiles dt-agfiles--refs', hidden: true });
    var input = D.el('textarea', { class: 'mat-input dt-ag-input', rows: '2', 'aria-label': 'Nachricht an die KI', placeholder: 'Beschreibe, was die KI tun soll …', maxlength: '20000' });
    input.value = state.draft;
    var fileInput = D.el('input', { type: 'file', multiple: true, class: 'mat-sr-only', accept: attach.accept, tabindex: '-1', 'aria-hidden': 'true' });
    var attachBtn = D.el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--sm dt-ag-tool', title: 'Bilder, PDF, Word, Excel, Texte anhängen (auch per Ziehen oder Einfügen)' }, [D.icon('paperclip'), D.el('span', { text: 'Anhängen' })]);
    var refBtn = D.el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--sm dt-ag-tool', title: 'Ein Design oder eine Datenliste als Vorbild mitgeben', 'aria-haspopup': 'dialog' }, [D.icon('link-2'), D.el('span', { text: 'Referenz' })]);
    var scope = D.el('select', { class: 'mat-select mat-select--sm dt-ag-scope', 'aria-label': 'Wo darf die KI arbeiten?' }, [
      D.el('option', { value: 'design', text: 'Ganzes Design' }),
      D.el('option', { value: 'page', text: 'Diese Seite' }),
      D.el('option', { value: 'selection', text: 'Auswahl' }),
    ]);
    var lockInput = D.el('input', { type: 'checkbox' });
    var lock = D.el('label', { class: 'mat-switch dt-switch dt-ag-lock', title: 'Eine Änderung außerhalb wird abgewiesen, und die KI liest den Grund' }, [lockInput, D.el('span', { class: 'mat-switch__track' }), D.el('span', { text: 'Nur hier ändern' })]);
    var stop = D.el('button', { type: 'button', class: 'mat-btn mat-btn--secondary mat-btn--sm dt-ag-stop', 'data-ai-stop': '', hidden: true }, [D.icon('stop'), D.el('span', { text: 'Stopp' })]);
    var sendBtn = D.el('button', { type: 'button', class: 'mat-btn mat-btn--primary mat-btn--sm dt-ag-send', title: 'Senden (Strg+Enter)' }, [D.icon('send'), D.el('span', { text: 'Senden' })]);
    var tools = D.el('div', { class: 'dt-ag-tools' }, [attachBtn, refBtn, D.el('span', { class: 'dt-ag-tools__spacer' }), stop, sendBtn]);
    var scopeRow = D.el('div', { class: 'dt-ag-scoperow' }, [D.icon('scan', 'dt-ag-scoperow__icon'), scope, lock]);
    var compose = D.el('div', { class: 'dt-ag-compose' }, [notice, files, refs, input, tools, scopeRow, fileInput]);
    var drop = D.el('div', { class: 'dt-ag-drop', hidden: true, 'aria-hidden': 'true' }, [D.icon('cloud-upload'), D.el('strong', { text: 'Zum Anhängen loslassen' }), D.el('span', { text: 'Bilder, PDF, Word, Excel, Texte' })]);

    panelRoot.appendChild(top);
    panelRoot.appendChild(D.el('div', { class: 'dt-ag-logwrap' }, [log, moreChip]));
    panelRoot.appendChild(compose);
    panelRoot.appendChild(drop);
    host.appendChild(panelRoot);

    ui = { api: api, host: host, panelRoot: panelRoot, log: log, more: moreChip, notice: notice, input: input, send: sendBtn, stop: stop, attachBtn: attachBtn, refBtn: refBtn, scope: scope, lock: lock, lockInput: lockInput, files: files, refs: refs, live: null, liveText: null };
    api.cleanup(function () { if (ui && ui.panelRoot === panelRoot) { stopTimers(); ui = null; } });

    attach.render(files);
    drawRefs();
    drawNotice();
    autosize();

    input.addEventListener('input', function () { state.draft = input.value; autosize(); syncCompose(); });
    input.addEventListener('keydown', function (ev) {
      ev.stopPropagation();      // the keys of the editor (Entf, T, R ...) never act while somebody types here
      if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); send(); }
    });
    input.addEventListener('paste', function (ev) {
      var pasted = window.DtAiAttach.filesOf(ev.clipboardData);
      if (!pasted.length) { return; }
      ev.preventDefault();
      ev.stopPropagation();
      addFiles(pasted);
    });
    sendBtn.addEventListener('click', function () { send(); });
    stop.addEventListener('click', cancel);
    attachBtn.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () { addFiles(Array.prototype.slice.call(fileInput.files)); fileInput.value = ''; });
    refBtn.addEventListener('click', function () { openRefPicker(refBtn); });
    scope.addEventListener('change', function () { state.scope.kind = scope.value; syncCompose(); });
    lockInput.addEventListener('change', function () { state.scope.locked = lockInput.checked; });

    // files dropped onto the panel are attachments (not images for the canvas)
    var depth = 0;
    var hasFiles = function (ev) { var t = ev.dataTransfer && ev.dataTransfer.types; return !!t && Array.prototype.indexOf.call(t, 'Files') >= 0; };
    panelRoot.addEventListener('dragenter', function (ev) { if (hasFiles(ev)) { depth++; drop.hidden = false; } });
    panelRoot.addEventListener('dragover', function (ev) { if (hasFiles(ev)) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; drop.hidden = false; } });
    panelRoot.addEventListener('dragleave', function (ev) { if (hasFiles(ev)) { depth = Math.max(0, depth - 1); if (!depth) { drop.hidden = true; } } });
    panelRoot.addEventListener('drop', function (ev) {
      if (!hasFiles(ev)) { return; }
      ev.preventDefault();
      ev.stopPropagation();
      depth = 0;
      drop.hidden = true;
      addFiles(Array.prototype.slice.call(ev.dataTransfer.files || []));
    });

    api.on('selection', function () { drawScopeOptions(); });
    api.on('page', function () { drawScopeOptions(); });
    log.addEventListener('click', function () { /* keeps the log focusable for the keyboard */ });
    renderLog();
    syncCompose();
    if (!window.matchMedia('(pointer: coarse)').matches && !state.running) { setTimeout(function () { if (ui && ui.input === input && (document.activeElement === document.body || (document.activeElement && document.activeElement.closest && document.activeElement.closest('#dt-rail, #dt-tabbar')))) { input.focus({ preventScroll: true }); } }, 0); }
  }

  function addFiles(list) {
    if (!attach) { return; }
    var refused = attach.add(list);
    if (refused.length) { setNotice(refused.slice(0, 3).join(' '), 'warning'); }
    syncCompose();
  }

  // ================================================================================================ the keyboard on a phone

  /** The sheet stays above the keyboard: the visual viewport tells how much of the page the keyboard covers. */
  function bindViewport() {
    if (vvBound || !window.visualViewport) { return; }
    vvBound = true;
    var update = function () {
      var vv = window.visualViewport;
      var covered = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      var typing = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('dt-ag-input');
      var on = typing && covered > 80 && window.matchMedia('(max-width: 767px)').matches;
      root.classList.toggle('is-keyboard', !!on);
      root.style.setProperty('--dt-kb', on ? covered + 'px' : '0px');
      root.style.setProperty('--dt-vvh', Math.round(vv.height) + 'px');
    };
    window.visualViewport.addEventListener('resize', update);
    window.visualViewport.addEventListener('scroll', update);
    document.addEventListener('focusout', function () { setTimeout(update, 50); });
  }

  // ================================================================================================ start

  function open() { D.panels.open('ai'); }

  function init(theApp, cfg) {
    app = theApp;
    config = cfg;
    root = document.getElementById('dt-ds');
    root.setAttribute('data-ai-state', 'idle');
    attach = window.DtAiAttach.create({ max: 6, onChange: function () { syncCompose(); } });
    app.on('selection', function () { if (ui) { drawScopeOptions(); } });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { document.title = baseTitle; if (state.conv && (state.running || state.busy)) { tick(true); } }
    });
    app.on('panel', function () { root.classList.toggle('is-ai-open', D.panels.current() === 'ai'); });
    bindViewport();
    if (!cfg.canEdit) { return Promise.resolve(); }
    return request('GET', '/api/ai/designs/' + app.id + '/agent').then(function (res) {
      if (!res.ok || !res.data || !res.data.showEntry) { return; }
      state.agent = res.data;
      if (res.data.maxFiles) { attach.setMax(res.data.maxFiles); }
      D.panels.setVisible('ai', true);
      root.setAttribute('data-ai-entry', 'true');
      var wanted = Number(new URLSearchParams(window.location.search).get('ai')) || 0;
      if (wanted) {
        try {
          var params = new URLSearchParams(window.location.search);
          params.delete('ai');
          var query = params.toString();
          window.history.replaceState(null, '', window.location.pathname + (query ? '?' + query : '') + window.location.hash);
        } catch (e) { /* ignore */ }
      }
      var stored = 0;
      try { stored = Number(sessionStorage.getItem(storeKey())) || 0; } catch (e) { stored = 0; }
      var conv = wanted || (res.data.available ? res.data.runningConversationId || stored : 0);
      if (!res.data.available) { return; }
      if (wanted || res.data.runningConversationId) { open(); }
      if (conv) { return follow(conv); }
      return undefined;
    });
  }

  D.panels.register({
    id: 'ai', title: 'KI-Assistent', label: 'KI', icon: 'sparkles', order: 12, hidden: true,
    build: build,
  });

  D.ai = {
    init: init,
    open: open,
    send: send,
    entryVisible: function () { return !!(state.agent && state.agent.showEntry); },
    state: function () { return { conv: state.conv, running: state.running, busy: state.busy, steps: state.steps.length, partial: state.partial, shown: shown, agent: state.agent, run: state.run, undoRun: state.undoRun }; },
  };
})();
