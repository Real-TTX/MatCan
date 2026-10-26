'use strict';
// Runs the browser checks one after the other against a running stack and reports one line per check. The exit code is 0 only when all of them passed.
//
//   node run-all.js [base url, default http://localhost:3043] [--only engine,pwa,demo,home,projects,templates,designer,canva,content,output,share,comments,teams,ai,aidesign,catalogs] [--quiet] [--fake-host h] [--fake-port p] [--data <data folder of the app>] [--catalog-port p]
//   (--fake-host / --fake-port go to the AI checks: with the app started by dotnet run on 3053 the default 127.0.0.1 is right, with Docker host.docker.internal is chosen for port 3043;
//   --data / --catalog-port go to the check of the catalogues: the data folder of the app (for the folder catalogue, else DT_DATA_DIR) and the port of its fake provider, 3073; the app must have been
//   started with DESIGNTHIX__Catalogs__example-browse__BaseUrl and ...example-search__BaseUrl pointing at that port, see tests/e2e/README.md)
//
// The checks make their own accounts (see lib.js): start from an empty database (./scripts/redeploy.ps1 -Clean) or put the accounts into tests/e2e/test-account.json.
// They leave test designs, lists and jobs behind: for the screenshots of the README use screens.js on a clean stack, not after this.
const { spawnSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const base = (args.find(a => /^https?:/.test(a)) || 'http://localhost:3043').replace(/\/$/, '');
const onlyIndex = args.indexOf('--only');
const only = onlyIndex >= 0 ? args[onlyIndex + 1].split(',') : null;
const quiet = args.includes('--quiet');
const passOn = name => { const i = args.indexOf(name); return i >= 0 ? [name, args[i + 1]] : []; };


const checks = [
  { name: 'engine', file: 'engine/engine-check.js', takesBase: false, what: 'the render engine in the browser (own test page)' },
  { name: 'pwa', file: 'pwa-check.js', takesBase: true, what: 'manifest, service worker, iOS meta tags, safe areas, offline' },
  { name: 'demo', file: 'demo-check.js', takesBase: true, what: 'the demo: six labels, nothing touches; the seeded records' },
  { name: 'home', file: 'home-check.js', takesBase: true, what: 'start page, navigation, format tiles, search, actions of a design, viewer' },
  { name: 'projects', file: 'projects-check.js', takesBase: true, what: 'the file browser: folders, selection, menu, drag and drop, move dialog, trash, stars, shared, team area, area filter, phone' },
  { name: 'templates', file: 'templates-check.js', takesBase: true, what: 'gallery of templates, use, filter, every template draws without a warning' },
  { name: 'designer', file: 'designer-check.js', takesBase: true, what: 'the editor mechanics: pointer, keyboard, snapping, undo, layers, fields, preview data, autosave, conflicts, viewer, tablet, phone' },
  { name: 'canva', file: 'canva-check.js', takesBase: true, what: 'the Canva-style editor: rail and panels, toolbar, context menu, paste and drop, media browser, pages, groups, download, phone' },
  { name: 'content', file: 'content-check.js', takesBase: true, what: 'editor content: elements, icons, text combinations, toolbars per kind, crop, colour picker and gradients, brand, templates, resize, media browser everywhere, phone' },
  { name: 'output', file: 'output-check.js', takesBase: true, what: 'output jobs: print pages, sheets, PNG-ZIP, single print, export/import' },
  { name: 'share', file: 'share-check.js', takesBase: true, what: 'sharing: the Teilen dialog, read-only editor and copy, links, public view, access requests, presence' },
  { name: 'comments', file: 'comments-check.js', takesBase: true, what: 'comments in the editor: panel, pins, replies, resolve, mentions and notifications, read-only editor, deep link, phone' },
  { name: 'teams', file: 'teams-check.js', takesBase: true, what: 'teams, invitations, registration, administration, the bell and the notifications, mail settings, the phone' },
  { name: 'ai', file: 'ai-check.js', takesBase: true, extra: [...passOn('--fake-host'), ...passOn('--fake-port')], what: 'AI actions against a fake provider' },
  { name: 'aidesign', file: 'ai-design-check.js', takesBase: true, extra: [...passOn('--fake-host'), ...passOn('--fake-port')], what: 'the design assistant in the editor: create from a prompt, live canvas, steps, Stopp, undo, attachments, references, roles, phone' },
  { name: 'catalogs', file: 'catalogs-check.js', takesBase: true, extra: [...passOn('--data'), ...passOn('--catalog-port')], what: 'the catalogues: admin pages, the media browser with catalogue tabs, the panel Fotos, imports, Bildnachweise, the server folder, roles, phone' },
];

const summary = [];
for (const check of checks.filter(c => !only || only.includes(c.name))) {
  console.log(`\n=== ${check.name}: ${check.what}`);
  const started = Date.now();
  const result = spawnSync(process.execPath, [path.join(__dirname, check.file), ...(check.takesBase ? [base] : []), ...(check.extra || [])], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const output = (result.stdout || '') + (result.stderr || '');
  const lines = output.split(/\r?\n/);
  const failures = lines.filter(l => /^(FAIL|not ok)\b/.test(l));
  const counts = lines.reverse().find(l => /\d+\s*(of|\/)\s*\d+ checks? passed/.test(l)) || '';
  if (!quiet || result.status !== 0) {
    console.log(output.split(/\r?\n/).filter(l => !/^(OK|ok|PASS)\b/.test(l) && l.trim()).slice(-40).join('\n'));
  }
  summary.push({ name: check.name, ok: result.status === 0, counts: counts.trim(), seconds: Math.round((Date.now() - started) / 1000), failures });
}

console.log('\n=== summary (' + base + ')');
for (const s of summary) {
  console.log(`${s.ok ? 'OK  ' : 'FAIL'} ${s.name.padEnd(9)} ${s.counts || '(no count)'}  ${s.seconds}s`);
  s.failures.forEach(f => console.log('       ' + f.slice(0, 200)));
}
process.exit(summary.every(s => s.ok) ? 0 : 1);
