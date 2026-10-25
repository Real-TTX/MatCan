/* DesignThix service worker: makes the app installable and usable without a connection, as far as that makes sense for a designer.
   - The files of the app (toolkit, styles, scripts, icons, the icon library lib/icons.json) come from the cache first: their addresses carry a version, so a new build loads new files.
   - Pages come from the network first; a page that loaded is kept, so the last state of a list or a design can be read offline. Such a copy is marked
     (data-offline-copy on <html>), and app.js says so and reloads it as soon as the connection is back: nothing stale stays on the screen.
   - Nothing that changes data is ever answered from the cache (POST, /api), nor sign-in (the one /api address that is kept is the payload of an output, see the library below). Without a copy the offline page explains it.
   - Signing out (or the sign-in page) clears the kept pages: they hold the data of the person who was signed in.
   The version comes from the address the layout registers (sw.js?v=...): a new build is a new worker, which removes the caches of the old one. */
'use strict';

var VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
var STATIC = 'dt-static-' + VERSION;
var PAGES = 'dt-pages';
var LIBRARY = 'dt-library';
var OFFLINE = '/Offline';
var MAX_PAGES = 60;
var MAX_LIBRARY = 800;
var NETWORK_TIMEOUT = 6000;

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(STATIC)
      // One file that is missing (a logo that is not made yet) must not stop the worker from installing: each is kept on its own.
      .then(function (cache) {
        return Promise.all([OFFLINE, '/favicon.svg', '/logo.svg', '/logo-mark.svg', '/img/icon-192.png', '/manifest.webmanifest', '/lib/icons.json'].map(function (url) {
          return cache.add(url).catch(function () { /* not available: fetched when it is needed */ });
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k.indexOf('dt-static-') === 0 && k !== STATIC; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (event) {
  var data = event.data || {};
  if (data.type === 'clear-pages') {
    event.waitUntil(Promise.all([caches.delete(PAGES), caches.delete(LIBRARY)]));
  }
});

function isStatic(url) {
  return /^\/(ui|css|js|img|fonts|builtin|lib)\//.test(url.pathname) || /\.(svg|png|woff2?|ttf|otf)$/.test(url.pathname) || url.pathname === '/manifest.webmanifest';
}

function isPrivateOrLive(url) {
  var p = url.pathname;
  return /^\/(api|account|health|s|einladung)(\/|$)/i.test(p) || p === '/sw.js' || /[?&]preview=/.test(url.search);
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') { return; }
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) { return; }

  var library = libraryKind(url);
  if (library === 'immutable') { event.respondWith(cacheFirstLibrary(request)); return; }
  if (library === 'live') { event.respondWith(networkFirstLibrary(request)); return; }

  if (isStatic(url)) {
    event.respondWith(caches.open(STATIC).then(function (cache) {
      // The icon library (lib/icons.json, about 600 KB) is kept per version of the app, whatever query the page adds: a new build is a new cache.
      return cache.match(request, { ignoreSearch: /^\/lib\//.test(url.pathname) }).then(function (hit) {
        return hit || fetch(request).then(function (response) {
          if (response.ok) { cache.put(request, response.clone()); }
          return response;
        });
      });
    }));
    return;
  }

  if (request.mode !== 'navigate' || isPrivateOrLive(url)) { return; }
  event.respondWith(networkFirst(request));
});

function timeout(ms) {
  return new Promise(function (_, reject) { setTimeout(function () { reject(new Error('timeout')); }, ms); });
}

function networkFirst(request) {
  return Promise.race([fetch(request), timeout(NETWORK_TIMEOUT)]).then(function (response) {
    // Keep a copy of a page that loaded normally (not a redirect to the sign-in, not an error page).
    if (response.ok && !response.redirected && (response.headers.get('content-type') || '').indexOf('text/html') === 0) {
      var copy = response.clone();
      caches.open(PAGES).then(function (cache) { return cache.put(request, copy).then(function () { return trim(cache); }); });
    }
    return response;
  }).catch(function () {
    return caches.open(PAGES).then(function (cache) { return cache.match(request, { ignoreVary: true }); }).then(function (hit) {
      if (!hit) { return caches.match(OFFLINE); }
      return markAsCopy(hit);
    });
  });
}

/* The kept page says that it is a copy, and from when: app.js shows it and reloads when the connection is back. */
function markAsCopy(response) {
  var when = response.headers.get('date') || '';
  return response.text().then(function (html) {
    var marked = html.replace('<html ', '<html data-offline-copy="' + when.replace(/"/g, '') + '" ');
    return new Response(marked, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  });
}

function trim(cache) {
  return cache.keys().then(function (keys) {
    if (keys.length <= MAX_PAGES) { return; }
    return Promise.all(keys.slice(0, keys.length - MAX_PAGES).map(function (k) { return cache.delete(k); }));
  });
}

/* The library (media, fonts, thumbnails): what a design needs to be drawn, kept so that designs render offline after they were seen once.
   - Addresses that carry a hash (/fonts/12-ab34....ttf, /media/flag-de?v=..., /designs/5/thumbnail.png?v=...) never change: cache first.
   - The style sheet of the fonts, the list of fonts, a medium asked for without a hash and the payload of an output (/api/outputs/{id}/payload) can change:
     network first, the kept copy when offline (so an output that was run once can be printed again without a connection).
   The cache outlives a new version of the app (the addresses are versioned by their content) and goes with signing out. */
function libraryKind(url) {
  var p = url.pathname;
  if (/^\/fonts\/\d+-[0-9a-f]+\.(ttf|otf|woff2?)$/i.test(p)) { return 'immutable'; }
  if ((/^\/media\//.test(p) || /^\/designs\/\d+\/thumbnail\.png$/.test(p)) && /[?&]v=/.test(url.search)) { return 'immutable'; }
  // The payload of an output (what the run page renders): network first; the copy of the last run lets a job that was run once be printed again without a connection.
  if (/^\/api\/outputs\/\d+\/payload$/.test(p)) { return 'live'; }
  if (p === '/fonts.css' || p === '/api/fonts' || /^\/media\//.test(p) || /^\/designs\/\d+\/thumbnail\.png$/.test(p)) { return 'live'; }
  return null;
}

function cacheFirstLibrary(request) {
  return caches.open(LIBRARY).then(function (cache) {
    return cache.match(request).then(function (hit) {
      return hit || fetch(request).then(function (response) {
        if (response.ok) { cache.put(request, response.clone()).then(function () { return trimLibrary(cache); }); }
        return response;
      });
    });
  });
}

function networkFirstLibrary(request) {
  return fetch(request).then(function (response) {
    if (response.ok) {
      var copy = response.clone();
      caches.open(LIBRARY).then(function (cache) { return cache.put(request, copy); });
    }
    return response;
  }).catch(function () {
    return caches.open(LIBRARY).then(function (cache) { return cache.match(request); }).then(function (hit) { return hit || Response.error(); });
  });
}

function trimLibrary(cache) {
  return cache.keys().then(function (keys) {
    if (keys.length <= MAX_LIBRARY) { return; }
    return Promise.all(keys.slice(0, keys.length - MAX_LIBRARY).map(function (k) { return cache.delete(k); }));
  });
}
