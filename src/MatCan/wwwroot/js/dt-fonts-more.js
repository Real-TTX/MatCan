/* MatCan "Weitere Schriften" (plan 5, docs/PLAN-CATALOGS.md section 6): a dialog over the catalogue of fonts (Google Fonts).
     window.DtFontsMore.open({ designId, spaceId, onAdded(result), onClose(addedCount) })   result = { family, faces, reused, spaceId }
     window.DtFontsMore.available()  -> Promise<boolean>: a usable catalogue with fonts exists (the button is only shown then)
   The dialog has a search field, the categories (serifenlos, Serif, Display, Handschrift, Monospace) and a text to try the fonts with. Every family is drawn in its OWN letters: the server hands out
   a preview address (the small Latin file of the regular weight, through the thumbnail proxy of the catalogues), the script loads it as a FontFace (same origin, so the CSP stays as it is) and
   sets the font on the sample through the CSSOM. "Hinzufügen" IMPORTS the family (POST /api/catalogs/{id}/import: its regular, bold and italic faces are stored as fonts of the area of the design,
   or of the person), after which the font select and the style sheet of the page know it. Nothing here builds HTML from data: every text goes in through textContent. */
(function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var SAMPLE = 'Zwölf Boxkämpfer jagen Viktor quer über den großen Sylter Deich';
  var counter = 0;
  var catalogPromise = null;

  function el(tag, props, kids) {
    var node = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) { return; }
      if (k === 'class') { node.className = v; }
      else if (k === 'text') { node.textContent = v; }
      else if (k === 'disabled') { node.disabled = !!v; }
      else { node.setAttribute(k, v === true ? '' : String(v)); }
    });
    (Array.isArray(kids) ? kids : (kids ? [kids] : [])).forEach(function (kid) { if (kid) { node.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid); } });
    return node;
  }

  function icon(name) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'mat-icon');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', (document.getElementById('dt-i-' + name) ? '#dt-i-' : '#mat-i-') + name);
    svg.appendChild(use);
    return svg;
  }

  function csrf() { var m = document.querySelector('meta[name="dt-csrf"]'); return m ? m.getAttribute('content') : ''; }

  function toast(message, tone) { if (window.MatUi && window.MatUi.toast) { window.MatUi.toast(message, { tone: tone || undefined }); } }

  function getJson(url) {
    return fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (data) { return { ok: r.ok, status: r.status, data: data }; });
    }, function () { return { ok: false, status: 0, data: null }; });
  }

  function postJson(url, body) {
    return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json', RequestVerificationToken: csrf() }, body: JSON.stringify(body) }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (data) { return { ok: r.ok, status: r.status, data: data }; });
    }, function () { return { ok: false, status: 0, data: null }; });
  }

  /** The catalogue with fonts the person may use (null when there is none). */
  function catalog() {
    if (!catalogPromise) {
      catalogPromise = getJson('/api/catalogs').then(function (res) {
        var list = res.ok && Array.isArray(res.data) ? res.data : [];
        return list.filter(function (c) { return (c.kinds || []).indexOf('font') >= 0; })[0] || null;
      });
    }
    return catalogPromise;
  }

  function safeHref(url) { return /^https?:\/\//i.test(String(url || '')) ? String(url) : ''; }

  function open(options) {
    var o = options || {};
    var id = 'dt-fm-' + (++counter);
    var state = { q: '', collection: '', sample: SAMPLE, page: 1, hasMore: false, loading: false, token: 0, c: null, faces: 0 };
    var dlg = el('dialog', { class: 'mat-dialog mat-dialog--xl dt-fm', 'data-static': '', 'aria-labelledby': id + '-t' });
    var close = el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--icon mat-dialog__close', 'aria-label': 'Schließen', 'data-dialog-close': '' }, icon('x'));
    var head = el('div', { class: 'mat-dialog__head' }, [icon('type'), el('h2', { class: 'mat-dialog__title', id: id + '-t', text: 'Weitere Schriften' }), close]);
    var search = el('input', { type: 'search', class: 'mat-input dt-fm__search', placeholder: 'Schrift suchen', 'aria-label': 'Schrift suchen', autocomplete: 'off', spellcheck: 'false' });
    var sample = el('input', { type: 'text', class: 'mat-input dt-fm__sample', 'aria-label': 'Vorschautext', autocomplete: 'off', maxlength: '80', value: SAMPLE });
    var tools = el('div', { class: 'dt-fm__tools' }, [search, sample]);
    var chips = el('div', { class: 'dt-fm__chips', role: 'group', 'aria-label': 'Arten von Schriften' });
    var list = el('ul', { class: 'dt-fm__list', 'aria-label': 'Schriften', 'data-font-list': '' });
    var status = el('p', { class: 'dt-fm__status', role: 'status', 'aria-live': 'polite' });
    var more = el('button', { type: 'button', class: 'mat-btn mat-btn--secondary dt-fm__more', hidden: true, text: 'Mehr laden' });
    var scroller = el('div', { class: 'dt-fm__scroll' }, [list, status, more]);
    var notice = el('p', { class: 'dt-fm__notice' });
    var body = el('div', { class: 'mat-dialog__body dt-fm__body' }, [tools, chips, scroller]);
    var done = el('button', { type: 'button', class: 'mat-btn mat-btn--primary', 'data-dialog-close': '', text: 'Fertig' });
    var foot = el('div', { class: 'mat-dialog__foot' }, el('div', { class: 'mat-btn-row mat-btn-row--plain' }, [done, notice]));
    dlg.appendChild(el('div', { class: 'mat-dialog__form' }, [head, body, foot]));
    document.body.appendChild(dlg);

    function drawChips(collections) {
      while (chips.firstChild) { chips.removeChild(chips.firstChild); }
      [{ id: '', name: 'Alle' }].concat(collections).forEach(function (c) {
        var b = el('button', { type: 'button', class: 'dt-fm__chip', 'data-collection': c.id, 'aria-pressed': String(state.collection === c.id), text: c.name });
        b.addEventListener('click', function () {
          state.collection = c.id;
          Array.prototype.forEach.call(chips.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          reload();
        });
        chips.appendChild(b);
      });
    }

    function row(item) {
      var name = 'dtfm-' + id + '-' + (++state.faces);
      var preview = el('span', { class: 'dt-fm__preview', text: state.sample });
      var add = el('button', { type: 'button', class: 'mat-btn mat-btn--secondary mat-btn--sm dt-fm__add', 'data-add-font': item.id }, [icon('plus'), el('span', { text: 'Hinzufügen' })]);
      var li = el('li', { class: 'dt-fm__row', 'data-family': item.title }, [
        el('span', { class: 'dt-fm__name', text: item.title }),
        preview,
        add,
      ]);
      // the font file of the regular weight comes through the proxy of this app; once it is loaded the sample is drawn in it (the family name is made up, so nothing a provider says reaches a style)
      if (item.thumb && window.FontFace) {
        var face = new window.FontFace(name, 'url("' + item.thumb + '")');
        face.load().then(function (loaded) {
          document.fonts.add(loaded);
          preview.style.setProperty('font-family', '"' + name + '", sans-serif');
          preview.classList.add('is-loaded');
        }, function () { preview.classList.add('is-failed'); });
      }

      add.addEventListener('click', function () {
        if (add.disabled) { return; }
        add.disabled = true;
        add.classList.add('is-busy');
        postJson('/api/catalogs/' + encodeURIComponent(state.c.id) + '/import', { itemId: item.id, designId: o.designId || null, preferSpace: o.spaceId || null }).then(function (res) {
          add.classList.remove('is-busy');
          if (!res.ok || !res.data || res.data.kind !== 'font') {
            add.disabled = false;
            toast((res.data && res.data.error) || 'Die Schrift konnte nicht hinzugefügt werden.', 'danger');
            return;
          }
          while (add.firstChild) { add.removeChild(add.firstChild); }
          add.appendChild(icon('check'));
          add.appendChild(el('span', { text: res.data.reused ? 'Schon da' : 'Hinzugefügt' }));
          li.classList.add('is-added');
          toast(res.data.reused ? '„' + res.data.family + '“ hattest du schon.' : '„' + res.data.family + '“ ist jetzt in deinen Schriften.', 'success');
          if (!res.data.reused) { added += 1; }
          if (typeof o.onAdded === 'function') { o.onAdded(res.data); }
        });
      });
      return li;
    }

    function load(append) {
      var my = state.token;
      state.loading = true;
      status.textContent = append ? '' : 'Schriften werden geladen …';
      var url = '/api/catalogs/' + encodeURIComponent(state.c.id) + '/search?q=' + encodeURIComponent(state.q) + '&collection=' + encodeURIComponent(state.collection) + '&page=' + state.page + '&perPage=24';
      return getJson(url).then(function (res) {
        if (my !== state.token) { return; }
        state.loading = false;
        if (!res.ok || !res.data) {
          status.textContent = (res.data && res.data.error) || 'Die Schriften konnten nicht geladen werden.';
          more.hidden = true;
          return;
        }
        (res.data.items || []).forEach(function (item) { list.appendChild(row(item)); });
        state.hasMore = !!res.data.hasMore;
        more.hidden = !state.hasMore;
        status.textContent = list.children.length ? '' : 'Keine Schrift gefunden. Probiere einen anderen Namen oder „Alle“.';
      });
    }

    function reload() {
      state.token++;
      state.page = 1;
      while (list.firstChild) { list.removeChild(list.firstChild); }
      return load(false);
    }

    var timer = 0;
    search.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { state.q = search.value.trim(); reload(); }, 250); });
    sample.addEventListener('input', function () {
      state.sample = sample.value.trim() || SAMPLE;
      Array.prototype.forEach.call(list.querySelectorAll('.dt-fm__preview'), function (p) { p.textContent = state.sample; });
    });
    more.addEventListener('click', function () { if (state.hasMore && !state.loading) { state.page += 1; load(true); } });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) { if (entries.some(function (e) { return e.isIntersecting; }) && state.hasMore && !state.loading) { state.page += 1; load(true); } }, { root: scroller, rootMargin: '200px' }).observe(more);
    }
    var added = 0;
    dlg.addEventListener('close', function () { clearTimeout(timer); state.token++; setTimeout(function () { dlg.remove(); }, 0); if (typeof o.onClose === 'function') { o.onClose(added); } });
    dlg.querySelector('form, .mat-dialog__form').addEventListener('submit', function (ev) { ev.preventDefault(); });

    window.MatUi.dialog.open(dlg);
    catalog().then(function (c) {
      if (!c) {
        status.textContent = 'Es ist kein Katalog mit Schriften eingeschaltet. Eine Administratorin oder ein Administrator kann Google Fonts unter Verwaltung → Kataloge einschalten.';
        return null;
      }

      state.c = c;
      if (c.notice) { notice.textContent = c.notice; }
      if (c.provider && safeHref(c.provider.url)) {
        notice.appendChild(document.createTextNode(' '));
        notice.appendChild(el('a', { href: c.provider.url, target: '_blank', rel: 'noopener noreferrer', text: c.provider.text }));
      }

      return getJson('/api/catalogs/' + encodeURIComponent(c.id) + '/collections').then(function (res) {
        drawChips(res.ok && Array.isArray(res.data) ? res.data : []);
        return reload();
      });
    });
    search.focus();
    return { close: function () { window.MatUi.dialog.close(dlg, 'cancel'); } };
  }

  window.DtFontsMore = { open: open, available: function () { return catalog().then(function (c) { return !!c; }); } };

  // the page of the fonts (/Fonts) has a button: shown only when the catalogue is switched on, and the list is read again when families were added
  var button = document.querySelector('[data-fonts-more]');
  if (button) {
    window.DtFontsMore.available().then(function (yes) { button.hidden = !yes; });
    button.addEventListener('click', function () { open({ onClose: function (count) { if (count > 0) { window.location.reload(); } } }); });
  }
})();
