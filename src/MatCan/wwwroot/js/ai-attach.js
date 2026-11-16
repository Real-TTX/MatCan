/* MatCan: the attachments of a message to the design assistant (docs/PLAN-AI-DESIGN.md 3.5), shared by the panel "KI" of the editor (designer.ai.js) and the prompt of the start page and of
   the dialog "Design erstellen" (create-ai.js). window.DtAiAttach.create({ max, maxBytes, onChange }) returns a list of chosen files with
     add(fileList) -> [messages of what was refused], remove(i), clear(), count(), items(), render(host) (chips: thumbnail or icon, name, a button to take it away),
     ready() -> Promise (the downscaled copies for the model are done), append(formData) (files, model-{i}), accept (the value for <input type=file accept>).
   A picture is drawn on a canvas at 1600 px at most as JPEG 0.82 and sent as the copy for the model (re-encoding drops EXIF and keeps the upload small); the original goes to the library.
   Everything the person typed or picked goes to the page through textContent and DOM APIs. */
(function () {
  'use strict';

  var MODEL_EDGE = 1600;
  var MODEL_QUALITY = 0.82;
  var ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml,.jpg,.jpeg,.png,.webp,.gif,.svg,.pdf,.docx,.xlsx,.csv,.txt,.md,.json';
  var EXT = /\.(jpe?g|png|webp|gif|svg|pdf|docx|xlsx|csv|txt|md|json)$/i;
  var NS = 'http://www.w3.org/2000/svg';

  function icon(name) {
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'mat-icon');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var use = document.createElementNS(NS, 'use');
    use.setAttribute('href', (document.getElementById('dt-i-' + name) ? '#dt-i-' : '#mat-i-') + name);
    svg.appendChild(use);
    return svg;
  }

  function isRaster(file) { return /^image\/(jpeg|png|webp|gif)$/.test(file.type) || (!file.type && /\.(jpe?g|png|webp|gif)$/i.test(file.name)); }
  function isImage(file) { return isRaster(file) || file.type === 'image/svg+xml' || /\.svg$/i.test(file.name); }

  function size(bytes) {
    if (bytes < 1024) { return bytes + ' B'; }
    if (bytes < 1024 * 1024) { return Math.round(bytes / 1024) + ' KB'; }
    return (Math.round(bytes / 1024 / 1024 * 10) / 10).toString().replace('.', ',') + ' MB';
  }

  /** The copy for the model: the picture at 1600 px at most, as JPEG; resolves null when it cannot be drawn (the server takes the original). */
  function downscale(file) {
    if (!isRaster(file)) { return Promise.resolve(null); }
    var load = typeof createImageBitmap === 'function'
      ? createImageBitmap(file)
      : new Promise(function (resolve, reject) {
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('image')); };
        img.src = url;
      });
    return load.then(function (bitmap) {
      var w = bitmap.width || bitmap.naturalWidth;
      var h = bitmap.height || bitmap.naturalHeight;
      if (!w || !h) { return null; }
      var k = Math.min(1, MODEL_EDGE / Math.max(w, h));
      var canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(w * k));
      canvas.height = Math.max(1, Math.round(h * k));
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      if (bitmap.close) { bitmap.close(); }
      return new Promise(function (resolve) { canvas.toBlob(function (blob) { resolve(blob && blob.size > 0 && blob.size <= 3 * 1024 * 1024 ? blob : null); }, 'image/jpeg', MODEL_QUALITY); });
    }).catch(function () { return null; });
  }

  function stamp() {
    var d = new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  function create(options) {
    var o = options || {};
    var max = o.max || 6;
    var maxBytes = o.maxBytes || 25 * 1024 * 1024;
    var list = [];
    var host = null;

    function revoke(item) { if (item.url) { URL.revokeObjectURL(item.url); item.url = null; } }

    var api = {
      accept: ACCEPT,
      count: function () { return list.length; },
      items: function () { return list.slice(); },
      setMax: function (n) { if (n > 0) { max = n; } },
      add: function (files) {
        var refused = [];
        Array.prototype.slice.call(files || []).forEach(function (file, n) {
          var name = file.name || '';
          if (!name || name === 'image.png' || /^image\.(jpe?g|webp|gif)$/i.test(name)) {
            var ext = (file.type || 'image/png').split('/')[1] || 'png';
            name = 'bild-' + stamp() + (n ? '-' + (n + 1) : '') + '.' + (ext === 'jpeg' ? 'jpg' : ext.replace('svg+xml', 'svg'));
          }
          if (!EXT.test(name) && !isImage(file)) { refused.push('„' + name + '“: Dieser Dateityp wird nicht gelesen (Bilder, PDF, DOCX, XLSX, CSV, TXT, MD, JSON).'); return; }
          if (file.size > maxBytes) { refused.push('„' + name + '“ ist größer als ' + size(maxBytes) + '.'); return; }
          if (list.length >= max) { refused.push('„' + name + '“: Höchstens ' + max + ' Dateien pro Nachricht.'); return; }
          var item = { file: file, name: name, image: isImage(file), model: null, url: null, ready: Promise.resolve() };
          if (item.image && file.type !== 'image/svg+xml' && !/\.svg$/i.test(name)) { item.url = URL.createObjectURL(file); }
          item.ready = downscale(file).then(function (blob) { item.model = blob; });
          list.push(item);
        });
        api.render();
        if (o.onChange) { o.onChange(api); }
        return refused;
      },
      remove: function (i) {
        var item = list[i];
        if (!item) { return; }
        revoke(item);
        list.splice(i, 1);
        api.render();
        if (o.onChange) { o.onChange(api); }
      },
      clear: function () {
        list.forEach(revoke);
        list = [];
        api.render();
        if (o.onChange) { o.onChange(api); }
      },
      ready: function () { return Promise.all(list.map(function (i) { return i.ready; })); },
      /** Adds the files to a FormData: `files` (repeated, in order) and `model-{i}` (the downscaled JPEG of file i). */
      append: function (fd) {
        list.forEach(function (item, i) {
          fd.append('files', item.file, item.name);
          if (item.model) { fd.append('model-' + i, item.model, 'model.jpg'); }
        });
      },
      render: function (target) {
        if (target) { host = target; }
        if (!host) { return; }
        while (host.firstChild) { host.removeChild(host.firstChild); }
        host.hidden = list.length === 0;
        list.forEach(function (item, i) {
          var chip = document.createElement('span');
          chip.className = 'dt-agfile';
          chip.setAttribute('data-name', item.name);
          if (item.url) {
            var img = document.createElement('img');
            img.className = 'dt-agfile__thumb';
            img.alt = '';
            img.src = item.url;
            chip.appendChild(img);
          } else {
            chip.appendChild(icon(item.image ? 'image' : 'file-text'));
          }
          var label = document.createElement('span');
          label.className = 'dt-agfile__name';
          label.textContent = item.name;
          label.title = item.name + ' (' + size(item.file.size) + ')';
          chip.appendChild(label);
          var x = document.createElement('button');
          x.type = 'button';
          x.className = 'dt-agfile__x';
          x.setAttribute('aria-label', item.name + ' entfernen');
          x.title = 'Entfernen';
          x.appendChild(icon('x'));
          x.addEventListener('click', function () { api.remove(i); });
          chip.appendChild(x);
          host.appendChild(chip);
        });
      },
    };
    return api;
  }

  /** The files a paste or a drop carries (pictures from the clipboard, files from the explorer). */
  function filesOf(dataTransfer) {
    if (!dataTransfer) { return []; }
    var out = [];
    if (dataTransfer.files && dataTransfer.files.length) { out = Array.prototype.slice.call(dataTransfer.files); }
    else if (dataTransfer.items) {
      Array.prototype.forEach.call(dataTransfer.items, function (it) { if (it.kind === 'file') { var f = it.getAsFile(); if (f) { out.push(f); } } });
    }
    return out;
  }

  window.DtAiAttach = { create: create, filesOf: filesOf, size: size, accept: ACCEPT, downscale: downscale, isImage: isImage };
})();
