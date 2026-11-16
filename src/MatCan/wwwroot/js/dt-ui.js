/* MatCan: the small helpers the scripts of the shell share (the file browser, the move dialog, the menu): DOM builders, icons, requests with the antiforgery token, toasts.
   Nothing here builds markup from text: el() sets text through textContent and attributes through setAttribute; icons come from the inline sprites (#dt-i-* of the app, #mat-i-* of the toolkit).
   window.DtUi = { el, icon, toast, csrf, get, post, upload, problem, plural } */
(function () {
  'use strict';

  if (window.DtUi) { return; }

  var SVG_NS = 'http://www.w3.org/2000/svg';

  /** el('div', { class: 'x', text: 'hello', on: { click: fn }, 'data-id': 3 }, [children]) */
  function el(tag, props, kids) {
    var node = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) { return; }
      if (k === 'class') { node.className = v; }
      else if (k === 'text') { node.textContent = v; }
      else if (k === 'on') { Object.keys(v).forEach(function (ev) { node.addEventListener(ev, v[ev]); }); }
      else if (k === 'disabled') { node.disabled = !!v; }
      else { node.setAttribute(k, v === true ? '' : String(v)); }
    });
    (Array.isArray(kids) ? kids : (kids ? [kids] : [])).forEach(function (kid) { if (kid) { node.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid); } });
    return node;
  }

  /** An icon of the sprite: "dt:name" and plain names both work; the app's own sprite is looked at first, then the toolkit's. */
  function icon(name, cls) {
    var bare = String(name).replace(/^dt:/, '');
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'mat-icon' + (cls ? ' ' + cls : ''));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', (document.getElementById('dt-i-' + bare) ? '#dt-i-' : '#mat-i-') + bare);
    svg.appendChild(use);
    return svg;
  }

  function csrf() {
    var m = document.querySelector('meta[name="dt-csrf"]');
    return m ? m.getAttribute('content') : '';
  }

  function toast(message, tone) {
    if (window.MatUi && window.MatUi.toast) { window.MatUi.toast(message, { tone: tone || undefined }); }
  }

  /** The sentence for a failed request: the server's message, or one for the status. */
  function problem(result) {
    if (result && result.data && result.data.error) { return result.data.error; }
    var s = result ? result.status : 0;
    if (s === 0) { return 'Keine Verbindung. Versuche es gleich noch einmal.'; }
    if (s === 403) { return 'Dafür fehlt dir die Berechtigung.'; }
    if (s === 404) { return 'Das gibt es nicht (mehr).'; }
    return 'Das hat nicht geklappt (Fehler ' + s + ').';
  }

  function read(response) {
    return response.json().catch(function () { return null; }).then(function (data) { return { ok: response.ok, status: response.status, data: data }; });
  }

  /** GET -> { ok, status, data }; never rejects. */
  function get(url) {
    return fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(read).catch(function () { return { ok: false, status: 0, data: null }; });
  }

  /** POST with a JSON body -> { ok, status, data }; never rejects. */
  function post(url, body) {
    return fetch(url, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', RequestVerificationToken: csrf() },
      body: JSON.stringify(body || {}),
    }).then(read).catch(function () { return { ok: false, status: 0, data: null }; });
  }

  /** Uploads files to /api/assets/upload into an area and folder; onProgress(0..1). Resolves { uploaded: [], errors: [{ fileName, error }] }. */
  function upload(files, target, onProgress) {
    return new Promise(function (resolve) {
      var form = new FormData();
      files.forEach(function (f) { form.append('files', f, f.name || ''); });
      if (target && target.spaceId) { form.append('spaceId', String(target.spaceId)); }
      if (target && target.folderId) { form.append('folderId', String(target.folderId)); }
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/assets/upload');
      xhr.setRequestHeader('RequestVerificationToken', csrf());
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.upload.addEventListener('progress', function (e) { if (e.lengthComputable && onProgress) { onProgress(e.loaded / e.total); } });
      xhr.addEventListener('load', function () {
        var data = null;
        try { data = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch (e) { data = null; }
        data = data || {};
        if (xhr.status === 403) { resolve({ uploaded: [], errors: [{ fileName: '', error: 'Du darfst hier nichts hochladen.' }] }); return; }
        if (xhr.status === 404) { resolve({ uploaded: [], errors: [{ fileName: '', error: 'Dieser Ordner ist nicht mehr da.' }] }); return; }
        resolve({ uploaded: data.uploaded || [], errors: data.errors && data.errors.length ? data.errors : (data.uploaded && data.uploaded.length ? [] : [{ fileName: '', error: data.error || 'Der Upload ist fehlgeschlagen.' }]) });
      });
      xhr.addEventListener('error', function () { resolve({ uploaded: [], errors: [{ fileName: '', error: 'Keine Verbindung: Die Dateien konnten nicht hochgeladen werden.' }] }); });
      xhr.send(form);
    });
  }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  window.DtUi = { el: el, icon: icon, toast: toast, csrf: csrf, get: get, post: post, upload: upload, problem: problem, plural: plural };
})();
