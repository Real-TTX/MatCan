#!/usr/bin/env node
'use strict';
// Generator for the built-in content of DesignThix:
//   src/DesignThix/wwwroot/builtin/flags/*.svg, builtin/icons/*.svg, builtin/builtin.json, fonts/fonts.json
// Usage: node tools/builtin.js     (the fonts themselves are downloaded once, see wwwroot/fonts/README.md)
// All drawings are our own work (country flags are public domain designs, the seals are generic and carry no trademark).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'src', 'DesignThix', 'wwwroot');
const flagDir = path.join(root, 'builtin', 'flags');
const iconDir = path.join(root, 'builtin', 'icons');
fs.mkdirSync(flagDir, { recursive: true });
fs.mkdirSync(iconDir, { recursive: true });

const n = (v) => String(Math.round(v * 100) / 100);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function svgFile(w, h, title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n<title>${esc(title)}</title>\n${body}\n</svg>\n`;
}

function star(cx, cy, r, rotation = -90) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.381966;
    const a = (rotation + i * 36) * Math.PI / 180;
    pts.push(`${n(cx + radius * Math.cos(a))},${n(cy + radius * Math.sin(a))}`);
  }
  return pts.join(' ');
}

const rect = (x, y, w, h, fill) => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}"/>`;

// ---------------------------------------------------------------- flags
const W = 900, H = 600;
const hBands = (colors) => colors.map((c, i) => rect(0, i * H / colors.length, W, H / colors.length, c)).join('\n');
const vBands = (colors) => colors.map((c, i) => rect(i * W / colors.length, 0, W / colors.length, H, c)).join('\n');

const flags = [];
const addFlag = (iso, name, tags, body, w = W, h = H) => flags.push({ iso, name, tags, w, h, body });

addFlag('de', 'Deutschland', ['Deutschland', 'Germany', 'DE'], hBands(['#000000', '#DD0000', '#FFCE00']));
addFlag('at', 'Österreich', ['Österreich', 'Austria', 'AT'], hBands(['#ED2939', '#FFFFFF', '#ED2939']));
addFlag('fr', 'Frankreich', ['Frankreich', 'France', 'FR'], vBands(['#0055A4', '#FFFFFF', '#EF4135']));
addFlag('it', 'Italien', ['Italien', 'Italy', 'IT'], vBands(['#009246', '#FFFFFF', '#CE2B37']));
addFlag('nl', 'Niederlande', ['Niederlande', 'Holland', 'Netherlands', 'NL'], hBands(['#AE1C28', '#FFFFFF', '#21468B']));
addFlag('be', 'Belgien', ['Belgien', 'Belgium', 'BE'], vBands(['#000000', '#FAE042', '#ED2939']));
addFlag('lu', 'Luxemburg', ['Luxemburg', 'Luxembourg', 'LU'], hBands(['#ED2939', '#FFFFFF', '#00A1DE']));
addFlag('ie', 'Irland', ['Irland', 'Ireland', 'IE'], vBands(['#169B62', '#FFFFFF', '#FF883E']));
addFlag('pl', 'Polen', ['Polen', 'Poland', 'PL'], hBands(['#FFFFFF', '#DC143C']));
addFlag('hu', 'Ungarn', ['Ungarn', 'Hungary', 'HU'], hBands(['#CD2A3E', '#FFFFFF', '#436F4D']));
addFlag('cz', 'Tschechien', ['Tschechien', 'Czechia', 'CZ'],
  `${rect(0, 0, W, H / 2, '#FFFFFF')}\n${rect(0, H / 2, W, H / 2, '#D7141A')}\n<polygon points="0,0 450,300 0,600" fill="#11457E"/>`);

// Switzerland is square (official ratio 1:1)
addFlag('ch', 'Schweiz', ['Schweiz', 'Switzerland', 'CH'],
  `${rect(0, 0, 32, 32, '#DA291C')}\n${rect(13, 6, 6, 20, '#FFFFFF')}\n${rect(6, 13, 20, 6, '#FFFFFF')}`, 32, 32);

// Spain without the coat of arms
addFlag('es', 'Spanien', ['Spanien', 'Spain', 'ES'],
  `${rect(0, 0, W, H, '#AA151B')}\n${rect(0, H / 4, W, H / 2, '#F1BF00')}`);

// Nordic crosses: the bars are equally wide in both directions
function nordic(field, cx, cy, bar, color) {
  return `${rect(0, 0, W, H, field)}\n${rect(cx - bar / 2, 0, bar, H, color)}\n${rect(0, cy - bar / 2, W, bar, color)}`;
}
addFlag('dk', 'Dänemark', ['Dänemark', 'Denmark', 'DK'], nordic('#C8102E', 330, 300, 90, '#FFFFFF'));
addFlag('se', 'Schweden', ['Schweden', 'Sweden', 'SE'], nordic('#006AA7', 330, 300, 110, '#FECC02'));
addFlag('fi', 'Finnland', ['Finnland', 'Finland', 'FI'], nordic('#FFFFFF', 325, 300, 160, '#003580'));
addFlag('no', 'Norwegen', ['Norwegen', 'Norway', 'NO'],
  `${rect(0, 0, W, H, '#BA0C2F')}\n${rect(245, 0, 164, H, '#FFFFFF')}\n${rect(0, 225, W, 150, '#FFFFFF')}\n${rect(286, 0, 82, H, '#00205B')}\n${rect(0, 262.5, W, 75, '#00205B')}`);

// Greece: nine stripes, cross canton five stripes high
{
  const s = H / 9;
  let body = rect(0, 0, W, H, '#FFFFFF');
  for (let i = 0; i < 9; i += 2) body += '\n' + rect(0, i * s, W, s, '#0D5EAF');
  const c = 5 * s;
  body += `\n${rect(0, 0, c, c, '#0D5EAF')}\n${rect(c / 2 - s / 2, 0, s, c, '#FFFFFF')}\n${rect(0, c / 2 - s / 2, c, s, '#FFFFFF')}`;
  addFlag('gr', 'Griechenland', ['Griechenland', 'Greece', 'GR'], body);
}

// Portugal: simplified armillary sphere with shield
{
  const cx = 360, cy = 294;
  const shield = (sc) => {
    const x = cx, y = cy;
    return `M${n(x - 55 * sc)},${n(y - 60 * sc)} H${n(x + 55 * sc)} V${n(y + 5 * sc)} C${n(x + 55 * sc)},${n(y + 45 * sc)} ${n(x + 20 * sc)},${n(y + 62 * sc)} ${n(x)},${n(y + 72 * sc)} C${n(x - 20 * sc)},${n(y + 62 * sc)} ${n(x - 55 * sc)},${n(y + 45 * sc)} ${n(x - 55 * sc)},${n(y + 5 * sc)} Z`;
  };
  let body = `${rect(0, 0, 360, H, '#006600')}\n${rect(360, 0, 540, H, '#FF0000')}`;
  body += `\n<circle cx="${cx}" cy="${cy + 6}" r="118" fill="#FFE000"/>`;
  body += `\n<circle cx="${cx}" cy="${cy + 6}" r="102" fill="#FF0000"/>`;
  body += `\n<ellipse cx="${cx}" cy="${cy + 6}" rx="52" ry="102" fill="none" stroke="#FFE000" stroke-width="12"/>`;
  body += `\n<rect x="${cx - 102}" y="${cy}" width="204" height="12" fill="#FFE000"/>`;
  body += `\n<path d="${shield(1.02)}" fill="#FF0000" stroke="#FFE000" stroke-width="10" stroke-linejoin="round"/>`;
  body += `\n<path d="${shield(0.78)}" fill="#FFFFFF"/>`;
  body += `\n<path d="${shield(0.52)}" fill="#003399"/>`;
  body += `\n<path d="${shield(0.34)}" fill="#FFFFFF"/>`;
  for (const [dx, dy] of [[0, -14], [-12, 0], [12, 0], [0, 14], [0, 0]]) {
    body += `\n<circle cx="${n(cx + dx * 0.9)}" cy="${n(cy + dy * 0.9 + 4)}" r="3.6" fill="#003399"/>`;
  }
  addFlag('pt', 'Portugal', ['Portugal', 'PT'], body);
}

// United Kingdom (Union Jack), drawn on a 60x40 grid; the red diagonals are counterchanged
addFlag('gb', 'Vereinigtes Königreich', ['Vereinigtes Königreich', 'Großbritannien', 'England', 'United Kingdom', 'Union Jack', 'UK', 'GB'],
  `<defs>
<clipPath id="f-gb-quarters"><path d="M30,20 h30 v20 z v20 h-30 z h-30 v-20 z v-20 h30 z"/></clipPath>
</defs>
<rect width="60" height="40" fill="#012169"/>
<path d="M0,0 L60,40 M60,0 L0,40" stroke="#FFFFFF" stroke-width="8" fill="none"/>
<path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" stroke-width="5.3" fill="none" clip-path="url(#f-gb-quarters)"/>
<path d="M30,0 V40 M0,20 H60" stroke="#FFFFFF" stroke-width="13.4" fill="none"/>
<path d="M30,0 V40 M0,20 H60" stroke="#C8102E" stroke-width="8" fill="none"/>`, 60, 40);

// European Union: 12 gold stars, circle radius = H/3, star radius = H/18
{
  let body = rect(0, 0, W, H, '#003399');
  for (let i = 0; i < 12; i++) {
    const a = (i * 30 - 90) * Math.PI / 180;
    body += `\n<polygon points="${star(450 + 200 * Math.cos(a), 300 + 200 * Math.sin(a), H / 18)}" fill="#FFCC00"/>`;
  }
  addFlag('eu', 'Europäische Union', ['Europäische Union', 'Europa', 'EU', 'Europe'], body);
}

// United States: 13 stripes, canton 0.76 x 7/13, 50 stars (9 rows of 6 / 5)
{
  const s = H / 13, cw = 0.76 * H, ch = 7 * s;
  let body = rect(0, 0, W, H, '#FFFFFF');
  for (let i = 0; i < 13; i += 2) body += '\n' + rect(0, i * s, W, s, '#B22234');
  body += '\n' + rect(0, 0, cw, ch, '#3C3B6E');
  const r = 0.0616 * H / 2;
  let pts = '';
  for (let row = 1; row <= 9; row++) {
    const y = row * ch / 10;
    const odd = row % 2 === 1;
    const count = odd ? 6 : 5;
    for (let j = 0; j < count; j++) {
      const x = (odd ? 2 * j + 1 : 2 * j + 2) * cw / 12;
      pts += `<polygon points="${star(x, y, r)}"/>\n`;
    }
  }
  body += `\n<g fill="#FFFFFF">\n${pts.trim()}\n</g>`;
  addFlag('us', 'Vereinigte Staaten', ['Vereinigte Staaten', 'USA', 'Amerika', 'United States', 'US'], body);
}

// ---------------------------------------------------------------- seals
// Style: 200x200 round badge, white face, ring 8 px, one pictogram in the main colour, one optional accent colour.
const GREEN = '#2E8B47', BLUE = '#1F6FB8', RED = '#D6342B', ORANGE = '#F0A020', BROWN = '#8A5A12', AMBER = '#E7A21B', RUST = '#C4561B';

const LETTERS = {
  A: 'M0,14 L5,0 L10,14 M2,9 H8',
  B: 'M0,14 V0 H7 L9,2 V5 L7,7 H0 M7,7 L9.5,9 V12 L7.5,14 H0',
  E: 'M10,0 H0 V14 H10 M0,7 H8',
  G: 'M10,3 L8,0 H2 L0,3 V11 L2,14 H8 L10,11 V7 H5',
  H: 'M0,0 V14 M10,0 V14 M0,7 H10',
  I: 'M5,0 V14',
  N: 'M0,14 V0 L10,14 V0',
  O: 'M2,0 H8 L10,2 V12 L8,14 H2 L0,12 V2 Z',
  R: 'M0,14 V0 H7 L9.5,2 V5 L7,7.5 H0 M5,7.5 L10,14',
  U: 'M0,0 V12 L2,14 H8 L10,12 V0',
  V: 'M0,0 L5,14 L10,0',
};

// A word of stroked block letters, centred at cx, top at y, letter height h.
function word(text, cx, y, h, color, sw) {
  const k = h / 14, adv = 13 * k;
  const total = text.length * adv - 3 * k;
  let d = '';
  [...text].forEach((ch, i) => {
    const ox = cx - total / 2 + i * adv;
    const cmds = LETTERS[ch].match(/[MLHVZ][^MLHVZ]*/g);
    let cur = [0, 0];
    for (const c of cmds) {
      const op = c[0];
      if (op === 'Z') { d += 'Z'; continue; }
      const a = c.slice(1).trim().split(/[ ,]+/).filter(Boolean).map(Number);
      let p;
      if (op === 'H') p = [a[0], cur[1]];
      else if (op === 'V') p = [cur[0], a[0]];
      else p = [a[0], a[1]];
      cur = p;
      d += `${op === 'M' ? 'M' : 'L'}${n(ox + p[0] * k)},${n(y + p[1] * k)}`;
    }
  });
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${n(sw)}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

const face = (color) => `<circle cx="100" cy="100" r="92" fill="#FFFFFF" stroke="${color}" stroke-width="8"/>\n`;
const slash = (color) => `<path d="M52,52 L148,148" stroke="#FFFFFF" stroke-width="22" stroke-linecap="round" fill="none"/>\n<path d="M52,52 L148,148" stroke="${color}" stroke-width="10" stroke-linecap="round" fill="none"/>`;
const drop = (cx, top, w, h) => `M${cx},${top} C${n(cx + w * 0.15)},${n(top + h * 0.28)} ${n(cx + w / 2)},${n(top + h * 0.5)} ${n(cx + w / 2)},${n(top + h * 0.72)} C${n(cx + w / 2)},${n(top + h * 0.9)} ${n(cx + w * 0.3)},${top + h} ${cx},${top + h} C${n(cx - w * 0.3)},${top + h} ${n(cx - w / 2)},${n(top + h * 0.9)} ${n(cx - w / 2)},${n(top + h * 0.72)} C${n(cx - w / 2)},${n(top + h * 0.5)} ${n(cx - w * 0.15)},${n(top + h * 0.28)} ${cx},${top} Z`;

// Leaf-shaped grain from (x,y) pointing in direction angle (deg, 0 = up).
function grain(x, y, angle, len, wid, fill) {
  const a = angle * Math.PI / 180;
  const dx = Math.sin(a), dy = -Math.cos(a), px = -dy, py = dx;
  const P = (t, s) => `${n(x + dx * len * t + px * wid * s)},${n(y + dy * len * t + py * wid * s)}`;
  return `<path d="M${P(0, 0)} C${P(0.2, 1)} ${P(0.7, 1.1)} ${P(1, 0)} C${P(0.7, -1.1)} ${P(0.2, -1)} ${P(0, 0)} Z" fill="${fill}"/>`;
}

function burst(cx, cy, r1, r2, points) {
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? r1 : r2;
    const a = (-90 + i * 180 / points) * Math.PI / 180;
    d += `${i === 0 ? 'M' : 'L'}${n(cx + r * Math.cos(a))},${n(cy + r * Math.sin(a))}`;
  }
  return d + 'Z';
}

const icons = [];
const addIcon = (name, title, tags, color, body, custom = false) => icons.push({ name, title, tags, color, body, custom });

addIcon('vegetarisch', 'Vegetarisch', ['vegetarisch', 'veggie', 'ohne Fleisch', 'Ernährung'], GREEN, `
<path d="M58,70 L92,140 L126,70" fill="none" stroke="${GREEN}" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M116,64 C118,44 134,34 154,38 C156,58 142,74 116,64 Z" fill="${GREEN}"/>
<path d="M122,62 C132,54 142,48 150,43" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>`);

addIcon('vegan', 'Vegan', ['vegan', 'pflanzlich', 'Ernährung'], GREEN, `
<path d="M100,128 V92" fill="none" stroke="${GREEN}" stroke-width="9" stroke-linecap="round"/>
<path d="M100,98 C70,100 52,82 52,56 C80,54 100,70 100,98 Z" fill="${GREEN}"/>
<path d="M100,92 C100,66 118,46 148,46 C148,76 130,94 100,92 Z" fill="${GREEN}"/>
<path d="M92,92 C80,84 70,74 62,64" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>
<path d="M108,86 C118,76 128,66 138,56" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>
${word('VEGAN', 100, 140, 24, GREEN, 5)}`);

addIcon('bio', 'Bio', ['bio', 'öko', 'organic', 'Blatt', 'Ernährung'], GREEN, `
<path d="M52,112 C44,62 84,30 148,34 C152,92 118,126 52,112 Z" fill="${GREEN}"/>
<path d="M52,112 L112,62" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round"/>
${word('BIO', 100, 134, 28, GREEN, 6)}`);

addIcon('laktosefrei', 'Laktosefrei', ['laktosefrei', 'ohne Laktose', 'Milch', 'Unverträglichkeit'], BLUE, `
<path d="${drop(100, 38, 84, 118)}" fill="${BLUE}"/>
<path d="M78,102 C78,114 86,122 96,124" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/>
${slash(RED)}`);

addIcon('glutenfrei', 'Glutenfrei', ['glutenfrei', 'ohne Gluten', 'Weizen', 'Getreide', 'Unverträglichkeit'], BROWN, `
<path d="M100,166 V70" fill="none" stroke="${BROWN}" stroke-width="6" stroke-linecap="round"/>
${grain(100, 84, 0, 44, 11, BROWN)}
${[106, 126, 146].map((y) => grain(100, y, -36, 40, 10.5, BROWN) + '\n' + grain(100, y, 36, 40, 10.5, BROWN)).join('\n')}
${slash(RED)}`);

addIcon('regional', 'Regional', ['regional', 'Heimat', 'aus der Region', 'Herkunft'], GREEN, `
<defs><clipPath id="i-regional-face"><circle cx="100" cy="100" r="88"/></clipPath></defs>
<path d="M0,168 C50,110 150,110 200,168 V200 H0 Z" fill="${GREEN}" clip-path="url(#i-regional-face)"/>
<path d="M100,36 C78,36 62,52 62,72 C62,98 100,128 100,128 C100,128 138,98 138,72 C138,52 122,36 100,36 Z" fill="${RED}" stroke="#FFFFFF" stroke-width="5"/>
<circle cx="100" cy="72" r="14" fill="#FFFFFF"/>`);

addIcon('rohmilch', 'Rohmilch', ['rohmilch', 'Milch', 'Käse'], BLUE, `
<path d="${drop(100, 30, 100, 134)}" fill="${BLUE}"/>
${word('ROH', 100, 104, 26, '#FFFFFF', 5.5)}`);

addIcon('heumilch', 'Heumilch', ['heumilch', 'Heu', 'Milch', 'Wiese', 'Käse'], GREEN, `
<path d="M100,118 C100,90 96,66 86,44 M100,118 C104,86 112,62 128,42 M100,118 C84,100 68,86 52,76 M100,118 C116,100 134,90 150,84 M100,118 C98,92 100,66 104,40" fill="none" stroke="${GREEN}" stroke-width="7" stroke-linecap="round"/>
${word('HEU', 100, 130, 26, BLUE, 5.5)}`);

// Pregnant woman in side view with a check mark (as in the reference label)
addIcon('schwangerschaft', 'Für Schwangere geeignet', ['schwangerschaft', 'schwanger', 'Schwangere', 'geeignet', 'Käse'], ORANGE, `
<circle cx="96" cy="46" r="13.5" fill="${ORANGE}"/>
<path d="M87,38 C68,30 54,48 58,70 C61,56 70,52 85,54 Z" fill="${ORANGE}"/>
<path d="M89,56 C89,64 84,68 82,76 C79,88 80,100 78,110 C75,120 73,128 74,138 C75,150 77,160 77,172 L106,172 C104,160 104,148 108,140 C128,138 146,126 150,106 C152,94 143,86 130,85 C124,84 123,80 121,75 C119,69 108,66 103,58 Z" fill="${ORANGE}"/>
<path d="M90,76 C98,94 116,106 136,100" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round"/>
<path d="M92,150 L91,172" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>
<path d="M130,48 L148,68 L180,28" fill="none" stroke="#FFFFFF" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M130,48 L148,68 L180,28" fill="none" stroke="${ORANGE}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>`);

addIcon('neu', 'Neu', ['neu', 'Neuheit', 'new'], RED, `<path d="${burst(100, 100, 96, 84, 20)}" fill="${RED}" stroke="${RED}" stroke-width="4" stroke-linejoin="round"/>
<circle cx="100" cy="100" r="72" fill="none" stroke="#FFFFFF" stroke-width="3"/>
${word('NEU', 100, 78, 44, '#FFFFFF', 9)}`, true);

addIcon('angebot', 'Angebot', ['angebot', 'Aktion', 'Rabatt', 'Prozent', 'sale'], RED, `<circle cx="100" cy="100" r="96" fill="${RED}"/>
<circle cx="100" cy="100" r="82" fill="none" stroke="#FFFFFF" stroke-width="3"/>
<circle cx="70" cy="70" r="19" fill="none" stroke="#FFFFFF" stroke-width="12"/>
<circle cx="130" cy="130" r="19" fill="none" stroke="#FFFFFF" stroke-width="12"/>
<path d="M142,56 L58,144" fill="none" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round"/>`, true);

addIcon('handgemacht', 'Handgemacht', ['handgemacht', 'Handarbeit', 'Manufaktur', 'selbstgemacht'], RUST, `
<path d="M76,112 V76 M93,112 V62 M110,112 V66 M127,112 V80" fill="none" stroke="${RUST}" stroke-width="15" stroke-linecap="round"/>
<path d="M68,100 H135 V124 C135,146 120,158 100,158 C80,158 68,144 68,124 Z" fill="${RUST}"/>
<path d="M70,128 L50,100" fill="none" stroke="${RUST}" stroke-width="15" stroke-linecap="round"/>
<path d="M101,142 C88,134 82,126 82,119 C82,113 87,110 92,110 C96,110 99,112 101,115 C103,112 106,110 110,110 C115,110 120,113 120,119 C120,126 114,134 101,142 Z" fill="#FFFFFF"/>`);

addIcon('gereift', 'Gereift', ['gereift', 'Reifung', 'Käse', 'lange gereift', 'Reifezeit'], BROWN, `
<path d="M34,134 L150,60 C166,58 170,68 168,84 L168,134 Z" fill="${AMBER}" stroke="${BROWN}" stroke-width="6" stroke-linejoin="round"/>
<path d="M34,134 L168,134 L168,148 L34,148 Z" fill="${BROWN}"/>
<circle cx="130" cy="96" r="9" fill="#FFFFFF" stroke="${BROWN}" stroke-width="3"/>
<circle cx="102" cy="116" r="7" fill="#FFFFFF" stroke="${BROWN}" stroke-width="3"/>
<circle cx="150" cy="118" r="6" fill="#FFFFFF" stroke="${BROWN}" stroke-width="3"/>
<circle cx="74" cy="124" r="4.5" fill="#FFFFFF" stroke="${BROWN}" stroke-width="3"/>`);

// Generic DNA helix, crossed out (not the registered "Ohne GenTechnik" seal)
addIcon('gentechnikfrei', 'Gentechnikfrei', ['gentechnikfrei', 'ohne Gentechnik', 'GVO', 'DNA'], GREEN, `
<path d="M72,36 C72,70 128,70 128,100 C128,130 72,130 72,164" fill="none" stroke="${GREEN}" stroke-width="9" stroke-linecap="round"/>
<path d="M128,36 C128,70 72,70 72,100 C72,130 128,130 128,164" fill="none" stroke="${GREEN}" stroke-width="9" stroke-linecap="round"/>
<path d="M82,52 H118 M77,76 H123 M77,124 H123 M82,148 H118" fill="none" stroke="${GREEN}" stroke-width="6" stroke-linecap="round"/>
${slash(RED)}`);

// ---------------------------------------------------------------- write
const catalogue = [];
for (const f of flags) {
  fs.writeFileSync(path.join(flagDir, `${f.iso}.svg`), svgFile(f.w, f.h, f.name, f.body), 'utf8');
  catalogue.push({ key: `flag-${f.iso}`, name: f.name, category: 'Flaggen', file: `flags/${f.iso}.svg`, tags: f.tags });
}
for (const i of icons) {
  const body = (i.custom ? '' : face(i.color)) + i.body.replace(/^\n/, '');
  fs.writeFileSync(path.join(iconDir, `${i.name}.svg`), svgFile(200, 200, i.title, body), 'utf8');
  catalogue.push({ key: `icon-${i.name}`, name: i.title, category: 'Siegel', file: `icons/${i.name}.svg`, tags: i.tags });
}
// The Deko pack (category "Deko") is owned by tools/deko/build.js: its entries are kept as they are.
const listPath = path.join(root, 'builtin', 'builtin.json');
if (fs.existsSync(listPath)) {
  for (const entry of JSON.parse(fs.readFileSync(listPath, 'utf8'))) if (entry.category === 'Deko') catalogue.push(entry);
}
fs.writeFileSync(listPath, JSON.stringify(catalogue, null, 2) + '\n', 'utf8');

// ---------------------------------------------------------------- fonts.json
const gf = 'https://github.com/google/fonts/blob/main/';
const font = (family, file, weight, style, dir, upstream, license = 'OFL-1.1') =>
  ({ family, file, weight, style, license, source: `${gf}${dir}/${upstream}` });
const fonts = [
  font('Montserrat', 'Montserrat-Variable.ttf', '100 900', 'normal', 'ofl/montserrat', 'Montserrat[wght].ttf'),
  font('Montserrat', 'Montserrat-Italic-Variable.ttf', '100 900', 'italic', 'ofl/montserrat', 'Montserrat-Italic[wght].ttf'),
  font('Bebas Neue', 'BebasNeue-Regular.ttf', '400', 'normal', 'ofl/bebasneue', 'BebasNeue-Regular.ttf'),
  font('Oswald', 'Oswald-Variable.ttf', '200 700', 'normal', 'ofl/oswald', 'Oswald[wght].ttf'),
  font('Kaushan Script', 'KaushanScript-Regular.ttf', '400', 'normal', 'ofl/kaushanscript', 'KaushanScript-Regular.ttf'),
  font('Caveat', 'Caveat-Variable.ttf', '400 700', 'normal', 'ofl/caveat', 'Caveat[wght].ttf'),
  font('Playfair Display', 'PlayfairDisplay-Variable.ttf', '400 900', 'normal', 'ofl/playfairdisplay', 'PlayfairDisplay[wght].ttf'),
  font('Playfair Display', 'PlayfairDisplay-Italic-Variable.ttf', '400 900', 'italic', 'ofl/playfairdisplay', 'PlayfairDisplay-Italic[wght].ttf'),
  font('Lora', 'Lora-Variable.ttf', '400 700', 'normal', 'ofl/lora', 'Lora[wght].ttf'),
  font('Lora', 'Lora-Italic-Variable.ttf', '400 700', 'italic', 'ofl/lora', 'Lora-Italic[wght].ttf'),
  font('Open Sans', 'OpenSans-Variable.ttf', '300 800', 'normal', 'ofl/opensans', 'OpenSans[wdth,wght].ttf'),
  font('Open Sans', 'OpenSans-Italic-Variable.ttf', '300 800', 'italic', 'ofl/opensans', 'OpenSans-Italic[wdth,wght].ttf'),
  font('Roboto Slab', 'RobotoSlab-Variable.ttf', '100 900', 'normal', 'apache/robotoslab', 'RobotoSlab[wght].ttf', 'Apache-2.0'),
  font('Pacifico', 'Pacifico-Regular.ttf', '400', 'normal', 'ofl/pacifico', 'Pacifico-Regular.ttf'),
  font('Permanent Marker', 'PermanentMarker-Regular.ttf', '400', 'normal', 'apache/permanentmarker', 'PermanentMarker-Regular.ttf', 'Apache-2.0'),
  font('Source Sans 3', 'SourceSans3-Variable.ttf', '200 900', 'normal', 'ofl/sourcesans3', 'SourceSans3[wght].ttf'),
  font('Source Sans 3', 'SourceSans3-Italic-Variable.ttf', '200 900', 'italic', 'ofl/sourcesans3', 'SourceSans3-Italic[wght].ttf'),
  // plan 6 / T1: more families. woff2 = Latin + Latin Extended subset made by tools/fonts-subset.js (families without a Reserved Font Name),
  // ttf = the unmodified file of the repository (families that reserve their name: the OFL counts a changed format as a modification)
  font('Great Vibes', 'GreatVibes-Regular.woff2', '400', 'normal', 'ofl/greatvibes', 'GreatVibes-Regular.ttf'),
  font('Parisienne', 'Parisienne-Regular.ttf', '400', 'normal', 'ofl/parisienne', 'Parisienne-Regular.ttf'),
  font('Allura', 'Allura-Regular.woff2', '400', 'normal', 'ofl/allura', 'Allura-Regular.ttf'),
  font('Dancing Script', 'DancingScript-Variable.ttf', '400 700', 'normal', 'ofl/dancingscript', 'DancingScript[wght].ttf'),
  font('Cormorant Garamond', 'CormorantGaramond-Variable.woff2', '300 700', 'normal', 'ofl/cormorantgaramond', 'CormorantGaramond[wght].ttf'),
  font('Cormorant Garamond', 'CormorantGaramond-Italic-Variable.woff2', '300 700', 'italic', 'ofl/cormorantgaramond', 'CormorantGaramond-Italic[wght].ttf'),
  font('Libre Baskerville', 'LibreBaskerville-Variable.ttf', '400 700', 'normal', 'ofl/librebaskerville', 'LibreBaskerville[wght].ttf'),
  font('Libre Baskerville', 'LibreBaskerville-Italic-Variable.ttf', '400 700', 'italic', 'ofl/librebaskerville', 'LibreBaskerville-Italic[wght].ttf'),
  font('Cinzel', 'Cinzel-Variable.woff2', '400 900', 'normal', 'ofl/cinzel', 'Cinzel[wght].ttf'),
  font('Fredoka', 'Fredoka-Variable.woff2', '300 700', 'normal', 'ofl/fredoka', 'Fredoka[wdth,wght].ttf'),
  font('Baloo 2', 'Baloo2-Variable.woff2', '400 800', 'normal', 'ofl/baloo2', 'Baloo2[wght].ttf'),
  font('Patrick Hand', 'PatrickHand-Regular.woff2', '400', 'normal', 'ofl/patrickhand', 'PatrickHand-Regular.ttf'),
  font('Gochi Hand', 'GochiHand-Regular.ttf', '400', 'normal', 'ofl/gochihand', 'GochiHand-Regular.ttf'),
  font('Abril Fatface', 'AbrilFatface-Regular.ttf', '400', 'normal', 'ofl/abrilfatface', 'AbrilFatface-Regular.ttf'),
  font('Anton', 'Anton-Regular.woff2', '400', 'normal', 'ofl/anton', 'Anton-Regular.ttf'),
  font('Righteous', 'Righteous-Regular.ttf', '400', 'normal', 'ofl/righteous', 'Righteous-Regular.ttf'),
  font('Amatic SC', 'AmaticSC-Regular.woff2', '400', 'normal', 'ofl/amaticsc', 'AmaticSC-Regular.ttf'),
  font('Amatic SC', 'AmaticSC-Bold.woff2', '700', 'normal', 'ofl/amaticsc', 'AmaticSC-Bold.ttf'),
  font('Inter', 'Inter-Variable.woff2', '100 900', 'normal', 'ofl/inter', 'Inter[opsz,wght].ttf'),
  font('Inter', 'Inter-Italic-Variable.woff2', '100 900', 'italic', 'ofl/inter', 'Inter-Italic[opsz,wght].ttf'),
  font('Nunito', 'Nunito-Variable.woff2', '200 900', 'normal', 'ofl/nunito', 'Nunito[wght].ttf'),
  font('Nunito', 'Nunito-Italic-Variable.woff2', '200 900', 'italic', 'ofl/nunito', 'Nunito-Italic[wght].ttf'),
  font('Josefin Sans', 'JosefinSans-Variable.ttf', '100 700', 'normal', 'ofl/josefinsans', 'JosefinSans[wght].ttf'),
  font('Josefin Sans', 'JosefinSans-Italic-Variable.ttf', '100 700', 'italic', 'ofl/josefinsans', 'JosefinSans-Italic[wght].ttf'),
  font('Raleway', 'Raleway-Variable.ttf', '100 900', 'normal', 'ofl/raleway', 'Raleway[wght].ttf'),
  font('Raleway', 'Raleway-Italic-Variable.ttf', '100 900', 'italic', 'ofl/raleway', 'Raleway-Italic[wght].ttf'),
  font('Poppins', 'Poppins-Regular.woff2', '400', 'normal', 'ofl/poppins', 'Poppins-Regular.ttf'),
  font('Poppins', 'Poppins-Medium.woff2', '500', 'normal', 'ofl/poppins', 'Poppins-Medium.ttf'),
  font('Poppins', 'Poppins-SemiBold.woff2', '600', 'normal', 'ofl/poppins', 'Poppins-SemiBold.ttf'),
  font('Poppins', 'Poppins-Bold.woff2', '700', 'normal', 'ofl/poppins', 'Poppins-Bold.ttf'),
  font('Poppins', 'Poppins-Italic.woff2', '400', 'italic', 'ofl/poppins', 'Poppins-Italic.ttf'),
  font('Poppins', 'Poppins-BoldItalic.woff2', '700', 'italic', 'ofl/poppins', 'Poppins-BoldItalic.ttf'),
  font('IBM Plex Mono', 'IBMPlexMono-Regular.ttf', '400', 'normal', 'ofl/ibmplexmono', 'IBMPlexMono-Regular.ttf'),
  font('IBM Plex Mono', 'IBMPlexMono-Bold.ttf', '700', 'normal', 'ofl/ibmplexmono', 'IBMPlexMono-Bold.ttf'),
  font('IBM Plex Mono', 'IBMPlexMono-Italic.ttf', '400', 'italic', 'ofl/ibmplexmono', 'IBMPlexMono-Italic.ttf'),
  font('IBM Plex Mono', 'IBMPlexMono-BoldItalic.ttf', '700', 'italic', 'ofl/ibmplexmono', 'IBMPlexMono-BoldItalic.ttf'),
];
fs.writeFileSync(path.join(root, 'fonts', 'fonts.json'), JSON.stringify(fonts, null, 2) + '\n', 'utf8');
console.log(`${flags.length} flags, ${icons.length} seals, ${fonts.length} font files written`);
