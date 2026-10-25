/* DesignThix: the page of the brand kit "Marke" (/Brand).
   <div id="dt-brand" data-brand='{"colors":[],"fonts":{...},"logos":[{key,name,url}],"maxColors":40,"maxLogos":20}' data-can-edit="true">
   The server renders the frame; this script draws the colours and the logos from the state, keeps the fonts and saves everything with POST /api/brand?space={id} (the area of the kit: data-space-id; the antiforgery token is
   in <meta name="dt-csrf">). Nothing here builds markup from text (createElement, createElementNS, textContent); the colour of a swatch and the font of a preview are set
   through the CSSOM (a custom property on the element, a rule in a constructed style sheet).
   Logos are chosen with the media browser (wwwroot/js/dt-media.js): pickLogo() uses window.DtMedia.pick({ category: 'Logos', title }, callback) and falls back to the
   picker of the data list grid (window.DtDataListGrid.pickMedia) when the browser script is missing. */
(function () {
  'use strict';

  var doc = document;
  var root = doc.getElementById('dt-brand');
  if (!root) { return; }

  var canEdit = root.getAttribute('data-can-edit') === 'true';
  var spaceId = root.getAttribute('data-space-id') || '';
  // a logo uploaded from the media browser of a team's brand lands in that team's area
  if (spaceId && window.DtMedia) { window.DtMedia.preferSpace = Number(spaceId); }
  var state = { colors: [], fonts: { heading: null, subheading: null, body: null }, logos: [] };
  var limits = { colors: 40, logos: 20 };
  var dirty = false;
  var saving = false;

  var $ = function (id) { return doc.getElementById(id); };
  var ui = {
    colors: $('dt-brand-colors'), colorsEmpty: $('dt-brand-colors-empty'), newColor: $('dt-brand-newcolor'), addColor: $('dt-brand-addcolor'),
    logos: $('dt-brand-logos'), logosEmpty: $('dt-brand-logos-empty'), addLogo: $('dt-brand-addlogo'),
    save: $('dt-brand-save'), status: $('dt-brand-state'),
  };
  var ROLES = ['heading', 'subheading', 'body'];

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
    use.setAttribute('href', '#mat-i-' + name);
    svg.appendChild(use);
    return svg;
  }

  function iconButton(name, label, onClick, disabled) {
    var b = el('button', 'mat-btn mat-btn--ghost mat-btn--icon dt-brand__tool');
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.title = label;
    b.disabled = !!disabled;
    b.appendChild(icon(name));
    b.addEventListener('click', onClick);
    return b;
  }

  function toast(message, tone) { if (window.MatUi && window.MatUi.toast) { window.MatUi.toast(message, { tone: tone || 'success' }); } }

  function csrf() {
    var meta = doc.querySelector('meta[name="dt-csrf"]');
    return meta ? meta.getAttribute('content') : '';
  }

  function setState(text) { if (ui.status) { ui.status.textContent = text || ''; } }

  function markDirty() {
    dirty = true;
    setState('Nicht gespeicherte Änderungen');
  }

  // ================================================================================================ colours

  /** #rgb or #rrggbb (with or without the #) as #rrggbb in lower case; '' when it is no colour. */
  function normColor(text) {
    var t = String(text || '').trim().toLowerCase();
    if (t.charAt(0) !== '#') { t = '#' + t; }
    if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/.test(t)) { return ''; }
    return t.length === 4 ? '#' + t[1] + t[1] + t[2] + t[2] + t[3] + t[3] : t;
  }

  function moveColor(i, by) {
    var j = i + by;
    if (j < 0 || j >= state.colors.length) { return; }
    var c = state.colors.splice(i, 1)[0];
    state.colors.splice(j, 0, c);
    markDirty();
    drawColors(j, by < 0 ? 'left' : 'right');
  }

  function drawColors(focusIndex, focusTool) {
    ui.colors.textContent = '';
    state.colors.forEach(function (hex, i) {
      var li = el('li', 'dt-brand__swatch');
      var chip = el('span', 'dt-brand__chip');
      chip.style.setProperty('--dt-swatch', hex);
      chip.setAttribute('role', 'img');
      chip.setAttribute('aria-label', 'Farbe ' + hex.toUpperCase());
      li.appendChild(chip);
      li.appendChild(el('span', 'dt-brand__hex mat-mono', hex.toUpperCase()));
      if (canEdit) {
        var tools = el('span', 'dt-brand__tools');
        var left = iconButton('chevron-left', 'Nach links', function () { moveColor(i, -1); }, i === 0);
        var right = iconButton('chevron-right', 'Nach rechts', function () { moveColor(i, 1); }, i === state.colors.length - 1);
        var remove = iconButton('x', 'Farbe ' + hex.toUpperCase() + ' entfernen', function () {
          state.colors.splice(i, 1);
          markDirty();
          drawColors();
          if (ui.newColor) { ui.newColor.focus(); }
        });
        left.setAttribute('data-tool', 'left');
        right.setAttribute('data-tool', 'right');
        tools.appendChild(left);
        tools.appendChild(right);
        tools.appendChild(remove);
        li.appendChild(tools);
      }
      ui.colors.appendChild(li);
    });
    ui.colorsEmpty.hidden = state.colors.length > 0;
    if (focusIndex !== undefined) {
      var target = ui.colors.children[focusIndex];
      var tool = target && (target.querySelector('[data-tool="' + focusTool + '"]:not(:disabled)') || target.querySelector('button:not(:disabled)'));
      if (tool) { tool.focus(); }
    }
    if (ui.addColor) { ui.addColor.disabled = state.colors.length >= limits.colors; }
  }

  function addColor() {
    var hex = normColor(ui.newColor.value);
    if (!hex) { toast('Wähle zuerst eine Farbe aus.', 'warning'); return; }
    if (state.colors.indexOf(hex) >= 0) { toast('Diese Farbe gibt es schon in deiner Marke.', 'warning'); return; }
    if (state.colors.length >= limits.colors) { toast('Die Marke hat höchstens ' + limits.colors + ' Farben.', 'warning'); return; }
    state.colors.push(hex);
    ui.newColor.value = '';
    ui.newColor.dispatchEvent(new Event('input', { bubbles: true }));
    ui.newColor.dispatchEvent(new Event('change', { bubbles: true }));
    markDirty();
    drawColors();
  }

  // ================================================================================================ fonts

  // A rule per family in a constructed style sheet (the CSP forbids a <style> element and style attributes; the CSSOM is allowed). The families are known to the page
  // through /fonts.css, which every signed-in page loads.
  var fontSheet = null;
  var fontClasses = {};
  var fontCount = 0;

  function fontClass(family) {
    var key = String(family).toLowerCase();
    if (fontClasses[key]) { return fontClasses[key]; }
    var cls = 'dt-bf-' + (++fontCount);
    fontClasses[key] = cls;
    try {
      if (!fontSheet && typeof CSSStyleSheet === 'function' && 'adoptedStyleSheets' in doc) {
        fontSheet = new CSSStyleSheet();
        doc.adoptedStyleSheets = doc.adoptedStyleSheets.concat([fontSheet]);
      }
      if (fontSheet) { fontSheet.insertRule('.' + cls + ' { font-family: "' + String(family).replace(/["\\{};<>\u0000-\u001f]/g, ' ') + '", sans-serif; }', fontSheet.cssRules.length); }
    } catch (e) { /* the preview stays in the default font */ }
    return cls;
  }

  function previewOf(role) { return $('dt-brand-preview-' + role); }

  function drawFontPreview(role) {
    var p = previewOf(role);
    if (!p) { return; }
    var family = state.fonts[role];
    p.className = p.className.replace(/\s*dt-bf-\d+/g, '');
    if (family) { p.classList.add(fontClass(family)); }
    p.setAttribute('data-family', family || '');
  }

  function initFonts() {
    ROLES.forEach(function (role) {
      var select = $('dt-brand-font-' + role);
      if (!select) { return; }
      // each option is set in its own font (a class per family)
      Array.prototype.forEach.call(select.options, function (o) {
        if (o.value) { o.classList.add(fontClass(o.value)); }
      });
      select.value = state.fonts[role] || '';
      if (select.value !== (state.fonts[role] || '')) { state.fonts[role] = null; select.value = ''; }
      select.addEventListener('change', function () {
        state.fonts[role] = select.value || null;
        markDirty();
        drawFontPreview(role);
      });
      drawFontPreview(role);
    });
  }

  // ================================================================================================ logos

  function drawLogos() {
    ui.logos.textContent = '';
    state.logos.forEach(function (logo, i) {
      var li = el('li', 'dt-brand__logo');
      var frame = el('span', 'dt-brand__logoframe');
      var img = doc.createElement('img');
      img.alt = logo.name || logo.key;
      img.loading = 'lazy';
      img.src = logo.url || ('/media/' + encodeURIComponent(logo.key));
      frame.appendChild(img);
      li.appendChild(frame);
      li.appendChild(el('span', 'dt-brand__logoname', logo.name || logo.key));
      li.appendChild(el('span', 'dt-brand__logokey mat-mono', logo.key));
      if (canEdit) {
        li.appendChild(iconButton('x', 'Logo ' + (logo.name || logo.key) + ' entfernen', function () {
          state.logos.splice(i, 1);
          markDirty();
          drawLogos();
          if (ui.addLogo) { ui.addLogo.focus(); }
        }));
      }
      ui.logos.appendChild(li);
    });
    ui.logosEmpty.hidden = state.logos.length > 0;
    if (ui.addLogo) { ui.addLogo.disabled = state.logos.length >= limits.logos; }
  }

  /** Asks for a medium. K3's media browser (DtMedia.pick) when it is there, else the picker of the data list grid. callback(key). */
  function pickLogo(callback) {
    if (window.DtMedia && typeof window.DtMedia.pick === 'function') {
      window.DtMedia.pick({ category: 'Logos', title: 'Logo wählen' }, callback);
      return;
    }
    if (window.DtDataListGrid && window.DtDataListGrid.pickMedia) {
      window.DtDataListGrid.pickMedia({ assetsUrl: '/api/assets', mediaUrl: '/media/' }, { label: 'Logo', category: 'Logos' }, '', callback);
      return;
    }
    toast('Die Medienauswahl ist nicht verfügbar.', 'danger');
  }

  function addLogo(key) {
    if (!key) { return; }
    var k = String(key).toLowerCase();
    if (state.logos.some(function (l) { return l.key === k; })) { toast('Dieses Logo gibt es schon in deiner Marke.', 'warning'); return; }
    if (state.logos.length >= limits.logos) { toast('Die Marke hat höchstens ' + limits.logos + ' Logos.', 'warning'); return; }
    // the name and the address come from the library
    fetch('/api/assets?q=' + encodeURIComponent(k) + '&take=20', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (list) {
        var found = (Array.isArray(list) ? list : []).filter(function (a) { return a.key === k; })[0];
        state.logos.push({ key: k, name: found ? found.name : k, url: found ? found.url : '' });
        markDirty();
        drawLogos();
      })
      .catch(function () { state.logos.push({ key: k, name: k, url: '' }); markDirty(); drawLogos(); });
  }

  // ================================================================================================ save

  function applyAnswer(answer) {
    state.colors = (answer.colors || []).slice();
    state.fonts = { heading: (answer.fonts || {}).heading || null, subheading: (answer.fonts || {}).subheading || null, body: (answer.fonts || {}).body || null };
    var info = {};
    (answer.logoAssets || []).forEach(function (a) { info[a.key] = a; });
    state.logos = (answer.logos || []).map(function (k) { return { key: k, name: info[k] ? info[k].name : k, url: info[k] ? info[k].url : '' }; });
    ROLES.forEach(function (role) { var s = $('dt-brand-font-' + role); if (s) { s.value = state.fonts[role] || ''; } drawFontPreview(role); });
    drawColors();
    drawLogos();
  }

  function save() {
    if (saving || !canEdit) { return; }
    saving = true;
    ui.save.disabled = true;
    setState('Wird gespeichert ...');
    var body = { colors: state.colors, fonts: state.fonts, logos: state.logos.map(function (l) { return l.key; }) };
    fetch('/api/brand' + (spaceId ? '?space=' + encodeURIComponent(spaceId) : ''), { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', RequestVerificationToken: csrf() }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (a) { return { ok: r.ok, status: r.status, body: a }; }); })
      .then(function (r) {
        if (!r.ok) { throw new Error(r.body && r.body.error ? r.body.error : 'Die Marke konnte nicht gespeichert werden (Fehler ' + r.status + ').'); }
        applyAnswer(r.body);
        dirty = false;
        setState('Alle Änderungen gespeichert');
        toast('Die Marke ist gespeichert.');
      })
      .catch(function (e) {
        setState('Nicht gespeichert');
        toast(e instanceof TypeError ? 'Keine Verbindung: die Marke wurde nicht gespeichert.' : e.message, 'danger');
      })
      .then(function () { saving = false; ui.save.disabled = false; });
  }

  // ================================================================================================ start

  try {
    var data = JSON.parse(root.getAttribute('data-brand') || '{}');
    state.colors = (data.colors || []).slice();
    state.fonts = { heading: (data.fonts || {}).heading || null, subheading: (data.fonts || {}).subheading || null, body: (data.fonts || {}).body || null };
    state.logos = (data.logos || []).slice();
    limits.colors = data.maxColors || 40;
    limits.logos = data.maxLogos || 20;
  } catch (e) { /* an empty brand kit */ }

  drawColors();
  initFonts();
  drawLogos();

  if (canEdit) {
    ui.addColor.addEventListener('click', addColor);
    ui.addLogo.addEventListener('click', function () { pickLogo(addLogo); });
    ui.save.addEventListener('click', save);
    doc.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && String(e.key).toLowerCase() === 's') { e.preventDefault(); save(); }
    });
    window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  }
  root.setAttribute('data-ready', 'true');
})();
