/* DesignThix: previews of designs without a saved thumbnail. A box with data-dt-preview and data-dt-preview-url (GET /api/designs/{id}) is drawn
   with the render engine (DtEngine) once it comes into view. Everything is built with DOM APIs; the size of the box follows the page of the design
   through the custom property --dt-ar (set through the CSSOM, no inline styles). A design that cannot be drawn leaves a calm placeholder.
   Boxes that a script adds later (the file browser draws its tiles after the page is loaded) are handed over with window.DtPreviews.add(box). */
(function () {
  'use strict';

  var boxes = Array.prototype.slice.call(document.querySelectorAll('[data-dt-preview]'));
  var sequence = 0;

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var engine = window.DtEngine;
  var documents = new Map();
  var fontCache = new Map();
  var iconsPromise = null;
  var running = 0;
  var waiting = [];
  var LIMIT = 3;

  function placeholder(box) {
    box.classList.add('is-failed');
    box.textContent = '';
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'mat-icon');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', '#mat-i-layers');
    svg.appendChild(use);
    box.appendChild(svg);
  }

  /** The fonts of the library, per area: the ones the person may use plus (for a design of another area) those of the design's area. */
  function loadFonts(designId, spaceId) {
    var key = spaceId === null || spaceId === undefined ? 'none' : String(spaceId);
    if (!fontCache.has(key)) {
      var url = key === 'none' ? '/api/fonts' : '/api/fonts?design=' + encodeURIComponent(designId);
      fontCache.set(key, fetch(url, { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (list) { return list.map(function (f) { return { family: f.family, weight: f.weight, style: f.style, url: f.url }; }); })
        .catch(function () { return []; }));
    }
    return fontCache.get(key);
  }

  /** The addresses (with their hashes) of the images a design uses: the person may only load what the server resolves for the design. */
  function resolveAssets(designId, doc) {
    var keys = engine.assetKeysUsed(doc);
    doc.fields.forEach(function (f) { if (f.type === 'image' && f.sample) { keys.push(f.sample); } });
    var wanted = [];
    keys.forEach(function (k) { if (wanted.indexOf(k) < 0) { wanted.push(k); } });
    if (!wanted.length) { return Promise.resolve({}); }
    return fetch('/api/assets/resolve?context=design:' + encodeURIComponent(designId) + '&keys=' + encodeURIComponent(wanted.join(',')), { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; });
  }

  /** The icon library (lib/icons.json, cached by the service worker), loaded once and only when a design on the page has an icon. */
  function loadIcons() {
    if (!iconsPromise) {
      iconsPromise = fetch('/lib/icons.json', { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : { icons: {} }; })
        .then(function (data) { return data && data.icons ? data.icons : {}; })
        .catch(function () { return {}; });
    }
    return iconsPromise;
  }

  function loadDocument(url) {
    if (!documents.has(url)) {
      documents.set(url, fetch(url, { credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) { throw new Error('HTTP ' + r.status); }
        return r.json();
      }));
    }
    return documents.get(url);
  }

  function draw(box) {
    var url = box.getAttribute('data-dt-preview-url');
    if (!url || !engine) { placeholder(box); return Promise.resolve(); }
    return loadDocument(url).then(function (data) {
      var normalized = engine.normalize(data.document);
      return Promise.all([loadFonts(data.id, data.spaceId), resolveAssets(data.id, normalized)]).then(function (parts) { return { normalized: normalized, fonts: parts[0], assets: parts[1] }; });
    }).then(function (prepared) {
      var normalized = prepared.normalized;
      box.style.setProperty('--dt-ar', normalized.width + ' / ' + normalized.height);
      return engine.renderInto(box, normalized, engine.sampleValues(normalized), {
        mode: 'output',
        assetUrl: function (key) {
          var found = prepared.assets[String(key).toLowerCase()];
          return found && found.url ? found.url : '/media/' + encodeURIComponent(String(key).toLowerCase());
        },
        fonts: prepared.fonts,
        icon: function (name) { return loadIcons().then(function (icons) { return icons[name] ? icons[name].b : null; }); },
        idPrefix: 'dtp' + (box.getAttribute('data-dt-preview') || '0') + '-' + (box.__dtpSeq || (box.__dtpSeq = ++sequence)) + '-',
      });
    }).then(function () { box.classList.add('is-ready'); }).catch(function () { placeholder(box); });
  }

  function pump() {
    while (running < LIMIT && waiting.length) {
      var box = waiting.shift();
      running++;
      draw(box).then(function () { running--; pump(); }, function () { running--; pump(); });
    }
  }

  function enqueue(box) {
    waiting.push(box);
    pump();
  }

  var observer = null;
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          observer.unobserve(entry.target);
          enqueue(entry.target);
        }
      });
    }, { rootMargin: '200px' });
  }

  function add(box) {
    if (box.__dtpAdded) { return; }
    box.__dtpAdded = true;
    if (observer) { observer.observe(box); } else { enqueue(box); }
  }

  window.DtPreviews = { add: add };
  boxes.forEach(add);
})();
