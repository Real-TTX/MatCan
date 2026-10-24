#!/usr/bin/env node
/*
 * tools/icons.js — renders the PNG icons of DesignThix from the SVG sources.
 *
 * Sources (hand-maintained SVG, the single source of truth):
 *   src/DesignThix/wwwroot/favicon.svg             favicon, simplified silhouette (legible at 16 px)
 *   src/DesignThix/wwwroot/logo.svg                full logo: mark + word mark (og-image)
 *   src/DesignThix/wwwroot/img/icon-maskable.svg   full-bleed PWA icon (tag inside the 80 % safe zone)
 *
 * Output (src/DesignThix/wwwroot/img/):
 *   favicon-32.png, apple-touch-icon.png (180, opaque), icon-192.png, icon-512.png (rounded tile, transparent corners),
 *   icon-maskable-192.png, icon-maskable-512.png (full bleed), og-image.png (1200x630)
 *
 * How to run (from the repository root; Playwright lives in tests/e2e):
 *   cd tests/e2e && npm install && cd ../..          # once
 *   Git Bash:    NODE_PATH=tests/e2e/node_modules node tools/icons.js
 *   PowerShell:  $env:NODE_PATH="tests/e2e/node_modules"; node tools/icons.js
 *
 * Uses the installed Microsoft Edge (channel "msedge"). Without Edge it falls back
 * to Playwright's bundled Chromium (install it once with: npx playwright install chromium).
 * Re-run after every change to one of the SVG sources and commit the PNGs.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const web = path.join(root, 'src', 'DesignThix', 'wwwroot');
const img = path.join(web, 'img');

const read = (file) => fs.readFileSync(path.join(web, file), 'utf8');
const dataUrl = (svg) => 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');

// One page per image: the SVG as <img> at exactly the target size, optionally with rounded corners.
const svgPage = (file, w, h, options) => {
  const o = options || {};
  return `<!doctype html><html><head><style>
  html,body{margin:0;padding:0;background:${o.background || 'transparent'};}
  img{display:block;width:${w}px;height:${h}px;${o.radius ? `border-radius:${o.radius};` : ''}}
</style></head><body><img src="${dataUrl(read(file))}" alt=""></body></html>`;
};

const ogPage = () => `<!doctype html><html lang="de"><head><style>
  html,body{margin:0;padding:0;}
  body{width:1200px;height:630px;position:relative;overflow:hidden;
       background:radial-gradient(900px 520px at 12% 0%,rgba(24,212,192,.16),transparent 70%),
                  radial-gradient(900px 520px at 100% 100%,rgba(47,134,246,.16),transparent 70%),#f4f8fb;
       display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px;
       font-family:system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
  img{display:block;width:820px;height:auto;}
  p{margin:0;font-size:40px;font-weight:500;color:#3d4b5f;letter-spacing:.005em;}
  .bar{position:absolute;left:0;right:0;bottom:0;height:12px;background:linear-gradient(90deg,#18d4c0,#22b8e0,#2f86f6);}
</style></head><body>
  <img src="${dataUrl(read('logo.svg'))}" alt="DesignThix">
  <p>Etiketten &amp; Designs – offline, mit Platzhaltern</p>
  <div class="bar"></div>
</body></html>`;

const jobs = [
  { out: 'favicon-32.png', w: 32, h: 32, html: () => svgPage('favicon.svg', 32, 32), transparent: true },
  { out: 'icon-192.png', w: 192, h: 192, html: () => svgPage('img/icon-maskable.svg', 192, 192, { radius: '22%' }), transparent: true },
  { out: 'icon-512.png', w: 512, h: 512, html: () => svgPage('img/icon-maskable.svg', 512, 512, { radius: '22%' }), transparent: true },
  { out: 'icon-maskable-192.png', w: 192, h: 192, html: () => svgPage('img/icon-maskable.svg', 192, 192) },
  { out: 'icon-maskable-512.png', w: 512, h: 512, html: () => svgPage('img/icon-maskable.svg', 512, 512) },
  // iOS rounds the corners itself and wants no transparency: the full-bleed maskable design.
  { out: 'apple-touch-icon.png', w: 180, h: 180, html: () => svgPage('img/icon-maskable.svg', 180, 180, { background: '#22b8e0' }) },
  { out: 'og-image.png', w: 1200, h: 630, html: ogPage },
];

async function launch() {
  try {
    return await chromium.launch({ channel: 'msedge' });
  } catch (err) {
    console.warn('Microsoft Edge not usable (' + err.message.split('\n')[0] + '), falling back to bundled Chromium.');
    return chromium.launch();
  }
}

(async () => {
  fs.mkdirSync(img, { recursive: true });
  const browser = await launch();
  try {
    for (const job of jobs) {
      const page = await browser.newPage({ viewport: { width: job.w, height: job.h }, deviceScaleFactor: 1, colorScheme: 'light' });
      await page.setContent(job.html(), { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const file = path.join(img, job.out);
      await page.screenshot({ path: file, omitBackground: !!job.transparent, clip: { x: 0, y: 0, width: job.w, height: job.h } });
      await page.close();
      console.log('wrote ' + path.relative(root, file) + ' (' + job.w + 'x' + job.h + ')');
    }
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
