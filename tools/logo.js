'use strict';
// Generates the MatCan logo SVGs (concept E: a "D" shaped like a label, with a punched hole and two text lines).
// Word mark outlines: Poppins SemiBold (SIL OFL 1.1), from the npm package @fontsource/poppins.
// Once:  cd tests/e2e && npm install --no-save opentype.js@1 @fontsource/poppins && cd ../..
// Then:  NODE_PATH=tests/e2e/node_modules node tools/logo.js && NODE_PATH=tests/e2e/node_modules node tools/icons.js
const opentype = require('opentype.js');
const fs = require('fs');
const path = require('path');

const out = process.argv[2] || path.join(__dirname, '..', 'src', 'MatCan', 'wwwroot');
const T = '#18d4c0', M = '#22b8e0', B = '#2f86f6', NAVY = '#0f1b2d', LIGHT = '#f2f7fb', BLUE_DARK = '#4fb4ff';

const buf = fs.readFileSync(require.resolve('@fontsource/poppins/files/poppins-latin-600-normal.woff'));
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

// ---- the mark: a D in a 96 x 96 box (92 wide, centred) -------------------------------------------
const rr = (x, y, w, h, r) => `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
const circle = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const OX = 2;
const D_OUT = `M${OX + 10} 0H${OX + 44}A48 48 0 0 1 ${OX + 44} 96H${OX + 10}A10 10 0 0 1 ${OX} 86V10A10 10 0 0 1 ${OX + 10} 0Z`;
// detailed: hole r8, two bars; favicon: everything heavier so it survives 16 px
const DETAIL = { hole: circle(OX + 18, 19, 8), bars: rr(OX + 14, 47, 46, 10, 5) + rr(OX + 14, 64, 28, 10, 5) };
const SMALL = { hole: circle(OX + 19, 21, 10), bars: rr(OX + 13, 46, 50, 13, 6.5) + rr(OX + 13, 67, 30, 13, 6.5) };
const markPath = (d) => D_OUT + d.hole + d.bars;

const grad = (id, x1, y1, x2, y2) =>
  `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${T}"/><stop offset="0.5" stop-color="${M}"/><stop offset="1" stop-color="${B}"/></linearGradient>`;
const head = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img">\n  <title>MatCan</title>\n`;
const write = (f, s) => { fs.writeFileSync(path.join(out, f), s); console.log('wrote', f); };

// ---- word mark ------------------------------------------------------------------------------------
const SIZE = 72, TRACK = -0.012 * SIZE;
function words() {
  let x = 0; const a = [], b = [];
  const glyphs = font.stringToGlyphs('MatCan');
  glyphs.forEach((g, i) => {
    if (i > 0) x += font.getKerningValue(glyphs[i - 1], g) * SIZE / font.unitsPerEm;
    (i < 3 ? a : b).push(g.getPath(x, 0, SIZE));
    x += g.advanceWidth * SIZE / font.unitsPerEm + TRACK;
  });
  const all = a.concat(b).map((p) => p.getBoundingBox());
  return {
    design: a.map((p) => p.toPathData(2)).join(''),
    thix: b.map((p) => p.toPathData(2)).join(''),
    left: Math.min(...all.map((q) => q.x1)), right: Math.max(...all.map((q) => q.x2)),
    top: Math.min(...all.map((q) => q.y1)), bottom: Math.max(...all.map((q) => q.y2)),
  };
}
const W = words();
const capH = font.charToGlyph('D').getBoundingBox().y2 * SIZE / font.unitsPerEm; // height of the D above the baseline

// mark
write('logo-mark.svg', head(96, 96) + `  <defs>${grad('dtlogo-mark-g', 0, 0, 96, 96)}</defs>\n  <path fill="url(#dtlogo-mark-g)" fill-rule="evenodd" d="${markPath(DETAIL)}"/>\n</svg>\n`);
write('favicon.svg', head(96, 96) + `  <defs>${grad('dtlogo-fav-g', 0, 0, 96, 96)}</defs>\n  <path fill="url(#dtlogo-fav-g)" fill-rule="evenodd" d="${markPath(SMALL)}"/>\n</svg>\n`);

// full logo: mark 96 high, the word mark's capitals centred on it
const GAP = 22, BASE = (96 + capH) / 2, X0 = 96 + GAP - W.left;
const fullW = Math.ceil(X0 + W.right + 2);
function full(dark) {
  const g = dark ? 'dtlogo-full-dark-g' : 'dtlogo-full-g';
  return head(fullW, 96) + `  <defs>${grad(g, 0, 0, 96, 96)}</defs>\n  <path fill="url(#${g})" fill-rule="evenodd" d="${markPath(DETAIL)}"/>\n` +
    `  <g transform="translate(${X0.toFixed(2)} ${BASE.toFixed(2)})"><path fill="${dark ? LIGHT : NAVY}" d="${W.design}"/><path fill="${dark ? BLUE_DARK : B}" d="${W.thix}"/></g>\n</svg>\n`;
}
write('logo.svg', full(false));
write('logo-dark.svg', full(true));

function wordmark(dark) {
  const pad = 2, w = Math.ceil(W.right - W.left + 2 * pad), h = Math.ceil(W.bottom - W.top + 2 * pad);
  return head(w, h) + `  <g transform="translate(${(pad - W.left).toFixed(2)} ${(pad - W.top).toFixed(2)})"><path fill="${dark ? LIGHT : NAVY}" d="${W.design}"/><path fill="${dark ? BLUE_DARK : B}" d="${W.thix}"/></g>\n</svg>\n`;
}
write('logo-wordmark.svg', wordmark(false));
write('logo-wordmark-dark.svg', wordmark(true));

// maskable / app icon: full-bleed gradient, a white D with the cut-outs, inside the 80 % safe circle
const S = 2.8, TX = 256 - 48 * S, TY = 256 - 48 * S;
write('img/icon-maskable.svg', head(512, 512) + `  <defs>${grad('dtlogo-mask-bg', 0, 0, 512, 512)}</defs>\n  <rect width="512" height="512" fill="url(#dtlogo-mask-bg)"/>\n` +
  `  <path fill="#ffffff" fill-rule="evenodd" transform="translate(${TX.toFixed(1)} ${TY.toFixed(1)}) scale(${S})" d="${markPath(DETAIL)}"/>\n</svg>\n`);
