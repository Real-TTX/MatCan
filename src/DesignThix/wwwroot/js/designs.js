/* DesignThix: previews of designs without a saved thumbnail. A box with data-dt-preview and data-dt-preview-url (GET /api/designs/{id}) is drawn
   with the render engine (DtEngine) once it comes into view. Everything is built with DOM APIs; the size of the box follows the page of the design
   through the custom property --dt-ar (set through the CSSOM, no inline styles). A design that cannot be drawn leaves a calm placeholder. */
(function () {
  'use strict';

  var boxes = Array.prototype.slice.call(document.querySelectorAll('[data-dt-preview]'));
  if (!boxes.length) { return; }

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var engine = window.DtEngine;
  var documents = new Map();
  var fontsPromise = null;
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

  function loadFonts() {
    if (!fontsPromise) {
      fontsPromise = fetch('/api/fonts', { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (list) { return list.map(function (f) { return { family: f.family, weight: f.weight, style: f.style, url: f.url }; }); })
        .catch(function () { return []; });
    }
    return fontsPromise;
  }

  function loadDocument(url) {
    if (!documents.has(url)) {
      documents.set(url, fetch(url, { credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) { throw new Error('HTTP ' + r.status); }
        return r.json();
      }).then(function (data) { return data.document; }));
    }
    return documents.get(url);
  }

  function draw(box) {
    var url = box.getAttribute('data-dt-preview-url');
    if (!url || !engine) { placeholder(box); return Promise.resolve(); }
    return Promise.all([loadDocument(url), loadFonts()]).then(function (parts) {
      var doc = parts[0];
      var normalized = engine.normalize(doc);
      box.style.setProperty('--dt-ar', normalized.width + ' / ' + normalized.height);
      return engine.renderInto(box, normalized, engine.sampleValues(normalized), {
        mode: 'output',
        assetUrl: function (key) { return '/media/' + encodeURIComponent(key); },
        fonts: parts[1],
        idPrefix: 'dtp' + (box.getAttribute('data-dt-preview') || '0') + '-',
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

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          observer.unobserve(entry.target);
          enqueue(entry.target);
        }
      });
    }, { rootMargin: '200px' });
    boxes.forEach(function (box) { observer.observe(box); });
  } else {
    boxes.forEach(enqueue);
  }
})();
