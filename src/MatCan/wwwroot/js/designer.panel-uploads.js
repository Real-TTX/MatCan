/* MatCan editor, part 10a: the panel "Uploads": a big upload button, a drop zone, a search field and the grid of the newest uploads. A click puts the picture on the page, a drag
   puts it where it is dropped (onto an image, frame or strip slot it replaces the source), files dropped on the zone are only uploaded. The media browser (js/dt-media.js) is one click
   away for everything else (flags, seals, logos). */
(function () {
  'use strict';

  var D = window.DtDesigner;

  D.panels.register({
    id: 'uploads', title: 'Uploads', label: 'Uploads', icon: 'cloud-upload', order: 40,
    build: function (host, api) {
      var app = api.app;
      var state = { q: '', token: 0, items: [], loaded: false, failed: false };
      var canUpload = app.editable();

      var upload = D.el('button', { type: 'button', class: 'mat-btn mat-btn--primary dt-upload__btn', disabled: !canUpload }, [D.icon('upload'), D.el('span', { text: 'Dateien hochladen' })]);
      upload.addEventListener('click', function () { D.io.pickImageFiles(false); });
      var zone = D.el('div', { class: 'dt-dropbox', 'data-dropzone': '' }, [
        D.icon('image-plus', 'dt-dropbox__icon'),
        D.el('strong', { text: 'Bilder hierher ziehen' }),
        D.el('span', { text: 'oder mit ' + D.modKey + '+V aus der Zwischenablage einfügen' }),
      ]);
      var search = D.el('input', { type: 'search', class: 'mat-input dt-psearch', placeholder: 'Uploads durchsuchen', 'aria-label': 'Uploads durchsuchen', autocomplete: 'off' });
      var browse = D.el('button', { type: 'button', class: 'mat-btn mat-btn--ghost mat-btn--sm' }, [D.icon('images'), D.el('span', { text: 'Alle Medien (Flaggen, Siegel, Logos)' })]);
      browse.addEventListener('click', function () {
        if (!window.DtMedia) { return; }
        window.DtMedia.pick({ title: 'Bild einfügen', tab: 'all' }, function (key, asset) { if (asset) { app.addAssets([asset]); D.io.useAsset(asset); } });
      });
      var info = D.el('p', { class: 'dt-empty', hidden: true });
      var grid = D.el('div', { class: 'dt-assetgrid', role: 'list' });
      host.appendChild(D.el('div', { class: 'dt-pbar dt-pbar--stack' }, [upload, zone, search]));
      host.appendChild(info);
      host.appendChild(grid);
      host.appendChild(D.el('div', { class: 'dt-pbar' }, browse));
      host.appendChild(D.el('p', { class: 'dt-pnote', text: 'Klicken setzt das Bild in die Seite, Ziehen setzt es an die Stelle. Auf ein Bild, einen Rahmen oder einen Platz der Bildleiste gezogen, ersetzt es dessen Bild.' }));

      var draw = function () {
        D.empty(grid);
        info.hidden = state.items.length > 0 || !state.loaded;
        info.textContent = state.failed ? 'Die Uploads konnten nicht geladen werden.' : (state.q ? 'Nichts gefunden.' : 'Noch keine Uploads. Ziehe Bilder hierher oder wähle „Dateien hochladen“.');
        state.items.forEach(function (a) {
          var tile = D.el('button', { type: 'button', class: 'dt-asset', title: a.name + ' (' + a.key + ')', 'data-key': a.key, disabled: !app.editable(), role: 'listitem' }, [
            D.el('span', { class: 'dt-asset__thumb' }, D.el('img', { src: a.url, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' })),
            D.el('span', { class: 'dt-asset__name', text: a.name }),
          ]);
          D.dnd.attach(tile, { ghost: function () { return D.el('img', { src: a.url, alt: '' }); }, onClick: function () { D.io.useAsset(a); }, onDrop: function (x, y) { D.canvas.dropAsset(a, x, y); } });
          grid.appendChild(tile);
        });
      };

      var load = function () {
        var token = ++state.token;
        D.request('GET', '/api/assets?category=uploads&sort=new&take=120' + (state.q ? '&q=' + encodeURIComponent(state.q) : '')).then(function (res) {
          if (token !== state.token) { return; }
          state.loaded = true;
          state.failed = !res.ok;
          state.items = res.ok && Array.isArray(res.data) ? res.data : [];
          draw();
        }, function () { if (token !== state.token) { return; } state.loaded = true; state.failed = true; state.items = []; draw(); });
      };

      var timer = 0;
      search.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { state.q = search.value.trim(); load(); }, 250); });
      api.cleanup(function () { clearTimeout(timer); });
      api.on('uploaded', function () { load(); });
      api.on('readonly', function () { api.rebuild(); });
      draw();
      load();

      // the zone highlights while files are dragged over it
      zone.addEventListener('dragenter', function () { zone.classList.add('is-over'); });
      zone.addEventListener('dragleave', function () { zone.classList.remove('is-over'); });
      zone.addEventListener('drop', function () { zone.classList.remove('is-over'); });
    },
  });
})();
