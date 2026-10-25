'use strict';
// Runs the browser checks one after the other against a running stack and reports one line per check. The exit code is 0 only when all of them passed.
//
//   node run-all.js [base url, default http://localhost:3043] [--only engine,pwa,demo,home,templates,designer,canva,output,ai] [--quiet]
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

const checks = [
  { name: 'engine', file: 'engine/engine-check.js', takesBase: false, what: 'the render engine in the browser (own test page)' },
  { name: 'pwa', file: 'pwa-check.js', takesBase: true, what: 'manifest, service worker, iOS meta tags, safe areas, offline' },
  { name: 'demo', file: 'demo-check.js', takesBase: true, what: 'the demo: six labels, nothing touches; the seeded records' },
  { name: 'home', file: 'home-check.js', takesBase: true, what: 'start page, navigation, format tiles, search, actions of a design, viewer' },
  { name: 'templates', file: 'templates-check.js', takesBase: true, what: 'gallery of templates, use, filter, every template draws without a warning' },
  { name: 'designer', file: 'designer-check.js', takesBase: true, what: 'the editor mechanics: pointer, keyboard, snapping, undo, layers, fields, preview data, autosave, conflicts, viewer, tablet, phone' },
  { name: 'canva', file: 'canva-check.js', takesBase: true, what: 'the Canva-style editor: rail and panels, toolbar, context menu, paste and drop, media browser, pages, groups, download, phone' },
  { name: 'output', file: 'output-check.js', takesBase: true, what: 'output jobs: print pages, sheets, PNG-ZIP, single print, export/import' },
  { name: 'ai', file: 'ai-check.js', takesBase: true, what: 'AI actions against a fake provider' },
];

const summary = [];
for (const check of checks.filter(c => !only || only.includes(c.name))) {
  console.log(`\n=== ${check.name}: ${check.what}`);
  const started = Date.now();
  const result = spawnSync(process.execPath, [path.join(__dirname, check.file), ...(check.takesBase ? [base] : [])], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
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
