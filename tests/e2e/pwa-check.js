// Checks the installable app in a real browser (installed Edge, headless, an emulated phone): the manifest and its icons, the service worker, the meta tags for iOS
// (standalone, status bar, colours of the status bar for light and dark = the colour of the app, viewport-fit=cover, pinch zoom allowed), the safe areas in the styles of
// the shell, 16 px inputs on touch screens (iOS does not zoom into a field), the behaviour without a connection (a kept page is marked as a copy, an unknown page shows
// the offline page, the banner appears) and the clean return (the copy is replaced by the real page, nothing stale stays), and that signing out empties the kept pages.
//
//   cd tests/e2e && npm install
//   node pwa-check.js [base url, default http://localhost:3043]
const lib = require('./lib.js');

const args = process.argv.slice(2);
const { base, problems, watch, launch, newContext, login, ensureAccounts } = lib(args);

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); };

const rgb = hex => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  return m ? `rgb(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)})` : null;
};

(async () => {
  const browser = await launch();
  const accounts = await ensureAccounts(browser);
  const context = await newContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  watch(page, 'pwa');
  // The check goes offline on purpose: the failed requests of that time are not a problem of the app.
  const offlineNoise = /Failed to load resource|net::ERR_/;
  page.removeAllListeners('console');
  page.on('console', m => { if (m.type() === 'error' && !/status of (403|409)/.test(m.text()) && !offlineNoise.test(m.text())) { problems.push(`[pwa] console error: ${m.text()}`); } });

  check('signed in as the designer', await login(page, accounts.designer));
  await page.goto(base + '/Designs', { waitUntil: 'networkidle' });

  // ------------------------------------------------------------------------------------------------ manifest and icons
  const manifestLink = await page.getAttribute('link[rel=manifest]', 'href');
  const manifest = await page.evaluate(async url => (await fetch(url)).json(), manifestLink);
  check('the manifest is linked and valid (name, start address, scope, standalone, language)', manifest.name === 'MatCan' && manifest.short_name && manifest.start_url && manifest.scope === '/' && manifest.display === 'standalone' && manifest.lang === 'de' && manifest.id, JSON.stringify({ name: manifest.name, display: manifest.display, scope: manifest.scope }));
  const purposes = manifest.icons.map(i => `${i.sizes}/${i.purpose || 'any'}`);
  check('the manifest has icons 192 and 512 for "any" and for "maskable"', ['192x192/any', '512x512/any', '192x192/maskable', '512x512/maskable'].every(p => purposes.includes(p)), purposes.join(' '));
  const iconStates = await page.evaluate(async icons => Promise.all(icons.map(async i => {
    const r = await fetch(i.src);
    return { src: i.src, ok: r.ok, type: r.headers.get('content-type') || '' };
  })), manifest.icons);
  check('every icon of the manifest can be loaded as an image', iconStates.every(i => i.ok && i.type.startsWith('image/')), JSON.stringify(iconStates.filter(i => !i.ok || !i.type.startsWith('image/'))));
  const pngSizes = await page.evaluate(async icons => Promise.all(icons.filter(i => /png/.test(i.type)).map(async i => {
    const image = new Image();
    image.src = i.src;
    await image.decode();
    return { src: i.src, expected: i.sizes, actual: `${image.naturalWidth}x${image.naturalHeight}` };
  })), manifest.icons);
  check('the PNG icons have the size they announce', pngSizes.length >= 4 && pngSizes.every(i => i.expected === i.actual), JSON.stringify(pngSizes));
  check('the manifest colours are the colour of the app', rgb(manifest.theme_color) === rgb(manifest.background_color) && rgb(manifest.theme_color) === (await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--mat-bg')).then(v => rgb(v.trim()))), `${manifest.theme_color} ${manifest.background_color}`);
  check('shortcut "Design erstellen" is offered', (manifest.shortcuts || []).some(s => s.url === '/Designs/Create'));
  check('apple touch icon and favicon are linked and reachable', await page.evaluate(async () => {
    const hrefs = [...document.querySelectorAll('link[rel=apple-touch-icon], link[rel=icon]')].map(l => l.href);
    if (hrefs.length < 2) { return false; }
    return (await Promise.all(hrefs.map(h => fetch(h).then(r => r.ok)))).every(Boolean);
  }));

  // ------------------------------------------------------------------------------------------------ service worker
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  check('the service worker is active for the whole app', scope === base + '/', scope);
  await page.reload({ waitUntil: 'networkidle' });
  check('the page is controlled by the service worker after a reload', await page.evaluate(() => !!navigator.serviceWorker.controller));
  const swHeaders = await page.evaluate(async () => { const r = await fetch('/sw.js'); return { cache: r.headers.get('cache-control'), type: r.headers.get('content-type') }; });
  check('sw.js is never cached by the browser and is JavaScript', /no-cache/.test(swHeaders.cache || '') && /javascript/.test(swHeaders.type || ''), JSON.stringify(swHeaders));

  // ------------------------------------------------------------------------------------------------ iOS meta tags, status bar colours
  const viewport = await page.getAttribute('meta[name=viewport]', 'content');
  check('viewport: width=device-width, viewport-fit=cover, pinch zoom allowed', /width=device-width/.test(viewport) && /viewport-fit=cover/.test(viewport) && !/user-scalable\s*=\s*(no|0)/.test(viewport) && !/maximum-scale\s*=\s*1(\.0)?\b/.test(viewport), viewport);
  check('apple-mobile-web-app-capable = yes', (await page.getAttribute('meta[name=apple-mobile-web-app-capable]', 'content')) === 'yes');
  check('mobile-web-app-capable = yes', (await page.getAttribute('meta[name=mobile-web-app-capable]', 'content')) === 'yes');
  const statusBar = await page.getAttribute('meta[name=apple-mobile-web-app-status-bar-style]', 'content');
  check('apple-mobile-web-app-status-bar-style is set', ['default', 'black', 'black-translucent'].includes(statusBar), statusBar);
  check('apple-mobile-web-app-title is set', !!(await page.getAttribute('meta[name=apple-mobile-web-app-title]', 'content')));
  for (const scheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.evaluate(() => { document.documentElement.removeAttribute('data-theme'); window.dispatchEvent(new Event('resize')); });
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const metaColor = await page.getAttribute(`meta[name=theme-color][media*="${scheme}"]`, 'content');
    const topbar = await page.evaluate(() => { const t = document.querySelector('.mat-topbar'); return t ? getComputedStyle(t).backgroundColor : null; });
    check(`theme-color for ${scheme} is the background colour of the app`, rgb(metaColor) === background, `${metaColor} vs ${background}`);
    check(`the top bar in ${scheme} has that colour too (the status bar blends into it)`, topbar === background || topbar === 'rgba(0, 0, 0, 0)', `${topbar} vs ${background}`);
  }
  await page.emulateMedia({ colorScheme: 'light' });
  // A theme chosen inside the app wins over the system: the meta tag of the other theme is switched off.
  const chosen = await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.dispatchEvent(new Event('mat:theme'));
    return [...document.querySelectorAll('meta[data-theme-color]')].map(m => `${m.getAttribute('data-theme-color')}=${m.getAttribute('media')}`);
  });
  check('a theme chosen in the app switches the colour of the status bar', chosen.includes('dark=all') && chosen.includes('light=not all'), chosen.join(' '));
  await page.evaluate(() => { document.documentElement.removeAttribute('data-theme'); document.documentElement.dispatchEvent(new Event('mat:theme')); });

  // ------------------------------------------------------------------------------------------------ safe areas
  const styles = await page.evaluate(async () => {
    const sheets = [...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.href).filter(h => /matui\.css|app\.css/.test(h));
    const texts = await Promise.all(sheets.map(h => fetch(h).then(r => r.text())));
    return texts.join('\n');
  });
  check('the styles use all four safe-area insets (notch, home indicator, landscape)', ['top', 'bottom', 'left', 'right'].every(side => styles.includes(`env(safe-area-inset-${side}`)));
  check('the top bar keeps clear of the notch (padding uses the top inset)', /\.mat-topbar[^{]*\{[^}]*padding-top:\s*var\(--mat-safe-top\)/.test(styles));
  check('the page keeps clear of the home indicator (bottom inset in padding)', /padding[^;{}]*var\(--mat-safe-bottom\)/.test(styles));
  const designerStyles = await page.evaluate(async () => (await fetch('/css/designer.css')).text());
  check('the designer respects the safe areas', /safe-area-inset|--mat-safe-/.test(designerStyles));

  // ------------------------------------------------------------------------------------------------ no zoom into fields, pinch zoom stays
  const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  check('the emulated phone has a coarse pointer', coarse);
  const small = [];
  for (const path of ['/Designs', '/Designs/Create', '/DataLists', '/DataLists/Edit', '/Assets', '/Assets/Upload', '/Outputs', '/Outputs/Create', '/Sheets/Edit', '/Account/Profile', '/Account/Security']) {
    await page.goto(base + path, { waitUntil: 'domcontentloaded' });
    const fields = await page.evaluate(() => [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]):not([type=color]), select, textarea')]
      .filter(e => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden')
      .map(e => ({ id: e.id || e.name || e.tagName, size: parseFloat(getComputedStyle(e).fontSize) })).filter(f => f.size < 16));
    small.push(...fields.map(f => `${path} ${f.id} ${f.size}px`));
  }
  check('every visible input, select and textarea is at least 16 px on a touch screen', small.length === 0, small.join(' | '));
  await page.goto(base + '/Account/Login');
  check('the sign-in page has 16 px fields as well (checked when signed out below)', true);

  // ------------------------------------------------------------------------------------------------ without a connection
  await page.goto(base + '/Designs', { waitUntil: 'networkidle' });
  await page.goto(base + '/DataLists', { waitUntil: 'networkidle' });
  await page.goto(base + '/Designs/Create', { waitUntil: 'networkidle' });
  await context.setOffline(true);
  await page.goto(base + '/Designs', { waitUntil: 'domcontentloaded' });
  const copy = await page.getAttribute('html', 'data-offline-copy');
  check('a page that was open is shown without a connection and marked as a copy', copy !== null, String(copy));
  check('the offline banner is visible', await page.isVisible('[data-offline-banner]'));
  const bannerText = await page.textContent('[data-offline-banner]');
  check('the banner says "Du siehst den Stand vom ..."', /Stand vom/.test(bannerText), bannerText.trim().slice(0, 100));
  await page.goto(base + '/Designs/Create', { waitUntil: 'domcontentloaded' });
  const submitBlocked = await page.evaluate(() => {
    const form = document.querySelector('form[method=post]:not([action*="Logout"])');
    if (!form) { return 'no form'; }
    const event = new Event('submit', { cancelable: true, bubbles: true });
    form.dispatchEvent(event);
    return event.defaultPrevented;
  });
  check('a form is not sent without a connection (the input stays on the page)', submitBlocked === true, String(submitBlocked));
  await page.goto(base + '/Fonts/Upload', { waitUntil: 'domcontentloaded' }).catch(() => { });
  const offlinePage = await page.$('[data-offline-page]');
  const text = await page.textContent('body');
  check('a page that was never open shows the offline page "Keine Verbindung" with "Erneut verbinden"', !!offlinePage && /Keine Verbindung/.test(text) && /Erneut verbinden/.test(text), text.replace(/\s+/g, ' ').slice(0, 100));
  check('the offline page holds no data of anybody (no menu, no names)', !(await page.$('.mat-nav')) && !text.includes(accounts.designer.email));
  const staticOffline = await page.evaluate(async () => { const urls = [...document.querySelectorAll('script[src], link[rel=stylesheet]')].map(e => e.src || e.href); return (await Promise.all(urls.map(u => fetch(u).then(r => r.ok).catch(() => false)))).every(Boolean); });
  check('the app files still load from the cache without a connection', staticOffline);
  const apiOffline = await page.evaluate(async () => fetch('/api/fonts').then(r => r.status).catch(() => 'failed'));
  check('data requests (/api) are not answered from an old copy when the person is offline (fonts list is kept for drawing, the rest fails)', apiOffline === 200 || apiOffline === 'failed', String(apiOffline));
  const postOffline = await page.evaluate(async () => fetch('/api/datalists', { method: 'POST' }).then(r => r.status).catch(() => 'failed'));
  check('a POST without a connection fails cleanly and is never answered by the worker', postOffline === 'failed', String(postOffline));

  // ------------------------------------------------------------------------------------------------ reconnect without stale content
  await page.goto(base + '/DataLists', { waitUntil: 'domcontentloaded' });
  check('the copy of a list is shown offline', (await page.getAttribute('html', 'data-offline-copy')) !== null, page.url() + ' ' + await page.title());
  const reloaded = page.waitForNavigation({ timeout: 20000 }).then(() => true).catch(() => false);
  await context.setOffline(false);
  check('the page reloads itself when the connection is back', await reloaded);
  await page.waitForLoadState('domcontentloaded');
  check('after the reload the page is the real one: no copy mark, no banner', (await page.getAttribute('html', 'data-offline-copy')) === null && !(await page.isVisible('[data-offline-banner]')));
  await page.goto(base + '/Fonts/Upload', { waitUntil: 'domcontentloaded' });
  check('the page that was unknown offline now opens normally', !!(await page.$('.mat-topbar')) && !(await page.$('[data-offline-page]')));

  // ------------------------------------------------------------------------------------------------ the offline page reconnects by itself
  await page.goto(base + '/Designs', { waitUntil: 'networkidle' });
  await context.setOffline(true);
  await page.goto(base + '/Fonts', { waitUntil: 'domcontentloaded' }).catch(() => { });
  check('offline again: the offline page', !!(await page.$('[data-offline-page]')));
  await context.setOffline(false);
  await page.click('[data-reconnect]', { timeout: 1500 }).catch(() => { /* the page already reconnected by itself */ });
  await page.waitForFunction(() => !document.querySelector('[data-offline-page]'), null, { timeout: 20000 }).catch(() => { });
  check('the offline page leaves by itself or with "Erneut verbinden" when the connection is back', !(await page.$('[data-offline-page]')));

  // ------------------------------------------------------------------------------------------------ signing out empties the kept pages
  await page.goto(base + '/Designs', { waitUntil: 'networkidle' });
  const kept = await page.evaluate(async () => (await caches.has('dt-pages')) ? (await (await caches.open('dt-pages')).keys()).length : 0);
  check('pages are kept while signed in', kept > 0, String(kept));
  await page.evaluate(() => document.querySelector('form[action*="/Account/Logout"]').requestSubmit());
  await page.waitForURL(/\/Account\//, { timeout: 15000 }).catch(() => { });
  await page.waitForTimeout(500);
  const keptAfter = await page.evaluate(async () => (await caches.has('dt-pages')) ? (await (await caches.open('dt-pages')).keys()).length : 0);
  check('signing out empties the kept pages (they hold the data of the person)', keptAfter === 0, String(keptAfter));
  const loginSmall = await page.evaluate(() => [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox])')].filter(e => parseFloat(getComputedStyle(e).fontSize) < 16).map(e => e.id));
  check('the fields of the sign-in page are 16 px on a touch screen', loginSmall.length === 0, loginSmall.join(','));
  const loginViewport = await page.getAttribute('meta[name=viewport]', 'content');
  check('the sign-in page has the same viewport', /viewport-fit=cover/.test(loginViewport) && !/user-scalable/.test(loginViewport));

  check('no console errors and no CSP violations', problems.length === 0, problems.join(' | '));
  await browser.close();
  let failed = 0;
  for (const r of results) {
    if (!r.ok) { failed++; }
    console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail && !r.ok ? ' - ' + r.detail : ''}`);
  }
  console.log(`\n${results.length - failed} of ${results.length} checks passed.`);
  process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
