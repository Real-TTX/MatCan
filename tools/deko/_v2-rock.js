'use strict';
// Motive of batch V2 (weddings II), part 1: Rock & Metal, Gamer, Pop. Flat, few colours. Loaded by m-v2.js.
const L = require('./lib');
const M = require('./motifs');
const { Path, Curve, g, path, circle, rad, lerp, place, compose, move, rotm, scl, leaf } = L;

const BONE = '#efe6d2', BONE_D = '#cbbd9d', INK = '#16141a', RED = '#c4283c', RED_D = '#8f1628', RED_L = '#e5546a', LEAF = '#2f5a41', LEAF_D = '#214332';
const ROSE_TONES = [RED_L, RED, RED_D];

/** A rose seen from the front with tones red. */
const redRose = (x, y, R, c, rot = 0) => M.flower('rose', x, y, R, c.p, c.r, { rot, tones: ROSE_TONES, centre: '#5a0c1a' });

/** Pixel art: rows of characters, map char -> colour, one path per colour. */
function pixels(rows, map, s, x0 = 0, y0 = 0) {
  const per = {};
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.' || ch === ' ' || !map[ch]) { x++; continue; }
      let n = 1;
      while (x + n < row.length && row[x + n] === ch) n++;
      (per[ch] = per[ch] || new Path()).M(x0 + x * s, y0 + y * s).L(x0 + (x + n) * s, y0 + y * s).L(x0 + (x + n) * s, y0 + (y + 1) * s).L(x0 + x * s, y0 + (y + 1) * s).Z();
      x += n;
    }
  });
  return Object.keys(per).map((ch) => path(per[ch], { fill: map[ch] })).join('');
}

/** A pixel mask from a test function on normalised coordinates, as rows of 'r'; outline 'o' around it, shade 'd', highlight 'h'. */
function pixelShape(n, m, inside, hi = []) {
  const grid = [];
  for (let y = 0; y < m; y++) { const row = []; for (let x = 0; x < n; x++) row.push(inside((x + 0.5) / n * 2 - 1, (y + 0.5) / m * 2 - 1) ? 'r' : '.'); grid.push(row); }
  const at = (x, y) => (grid[y] && grid[y][x]) || '.';
  const out = grid.map((r) => r.slice());
  const pad = (arr) => { const w = arr.map((r) => ['.', ...r, '.']); const e = new Array(n + 2).fill('.'); return [e.slice(), ...w, e.slice()]; };
  const G = pad(out);
  const R = G.map((r) => r.slice());
  for (let y = 0; y < G.length; y++) for (let x = 0; x < G[0].length; x++) {
    if (G[y][x] !== '.') continue;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (G[y + dy] && G[y + dy][x + dx]) === 'r');
    if (nb) R[y][x] = 'o';
  }
  for (let y = 0; y < R.length; y++) for (let x = 0; x < R[0].length; x++) {
    if (R[y][x] !== 'r') continue;
    if (R[y + 1] && R[y + 1][x] === 'o' || R[y][x + 1] === 'o') R[y][x] = 'd';
  }
  for (const [x, y] of hi) if (R[y + 1] && R[y + 1][x + 1] === 'r') R[y + 1][x + 1] = 'h';
  return R.map((r) => r.join(''));
}

const heartIn = (x, y) => { const X = x * 1.15, Y = -y * 1.2 + 0.2; return (X * X + Y * Y - 1) ** 3 - X * X * Y ** 3 <= 0; };
const starIn = (x, y) => { const r = Math.hypot(x, y), a = Math.atan2(y, x) + Math.PI / 2; const k = 2 * Math.PI / 5; const t = ((a % k) + k) % k - k / 2; return r * Math.cos(t) <= 0.5 * (0.9 - 0.38 * Math.abs(t) / (k / 2) * 0.0) + 0.0 && r <= 0.98 * (0.46 / (0.46 + 0.54 * Math.abs(t) / (k / 2))) + 0.0 || false; };

const pieces = [
  // ------------------------------------------------------------------------------------------------ Rock & Metal
  {
    slug: 'totenkopf-rosen', name: 'Totenkopf mit Rosen', w: 900, h: 800, palettes: ['bunt'], fit: 14,
    tags: ['Totenkopf', 'Schädel', 'Rosen', 'Rock', 'Metal', 'Gothic', 'Tattoo', 'schwarz', 'Rocker'],
    draw(c) {
      let s = '';
      // leaves and stems behind
      const lf = (x, y, a, len) => path(leaf(len, len * 0.24, { belly: 0.45, sharp: 0.8 }).whole.transform(place(x, y, a, 1)), { fill: LEAF }) + path(leaf(len, len * 0.24, { belly: 0.45, sharp: 0.8 }).lower.transform(place(x, y, a, 1)), { fill: LEAF_D });
      s += lf(190, 640, 200, 150) + lf(130, 560, 160, 130) + lf(250, 700, 235, 120) + lf(710, 640, -20, 150) + lf(770, 560, 20, 130) + lf(650, 700, -55, 120);
      // skull
      const skull = new Path().M(450, 40).C(650, 40, 740, 180, 716, 340).C(706, 410, 662, 440, 640, 478).L(640, 540).C(640, 566, 622, 580, 600, 580).L(300, 580)
        .C(278, 580, 260, 566, 260, 540).L(260, 478).C(238, 440, 194, 410, 184, 340).C(160, 180, 250, 40, 450, 40).Z();
      s += path(skull, { fill: BONE });
      s += path(new Path().M(450, 40).C(650, 40, 740, 180, 716, 340).C(706, 410, 662, 440, 640, 478).L(640, 540).C(640, 566, 622, 580, 600, 580).L(450, 580).C(520, 400, 560, 200, 450, 40).Z(), { fill: BONE_D, 'fill-opacity': 0.5 });
      // cheek bone dents and cracks
      s += path(new Path().M(232, 400).C(250, 440, 262, 470, 262, 478), { fill: 'none', stroke: BONE_D, 'stroke-width': 8, 'stroke-linecap': 'round' });
      s += path(new Path().M(668, 400).C(650, 440, 638, 470, 638, 478), { fill: 'none', stroke: BONE_D, 'stroke-width': 8, 'stroke-linecap': 'round' });
      s += path(L.smooth([[520, 56], [540, 100], [524, 140], [548, 190], [534, 226]]), { fill: 'none', stroke: INK, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
      // eyes (rounded, slightly slanted) and nose
      s += path(L.ellipsePath(342, 330, 82, 92, 14), { fill: INK }) + path(L.ellipsePath(558, 330, 82, 92, -14), { fill: INK });
      s += circle(318, 296, 14, { fill: '#ffffff', 'fill-opacity': 0.12 }) + circle(534, 296, 14, { fill: '#ffffff', 'fill-opacity': 0.12 });
      s += path(new Path().M(450, 410).C(470, 440, 488, 470, 478, 484).C(468, 494, 432, 494, 422, 484).C(412, 470, 430, 440, 450, 410).Z(), { fill: INK });
      // teeth
      s += path(L.rrect(300, 520, 300, 80, 16), { fill: BONE }) + path(L.rrect(300, 520, 300, 80, 16), { fill: 'none', stroke: INK, 'stroke-width': 7 });
      const t = new Path(); for (let i = 1; i < 6; i++) t.M(300 + i * 50, 520).L(300 + i * 50, 600);
      s += path(t, { fill: 'none', stroke: INK, 'stroke-width': 6 });
      s += path(new Path().M(300, 560).L(600, 560), { fill: 'none', stroke: INK, 'stroke-width': 5 });
      // roses at the bottom
      s += redRose(205, 600, 108, c, 10) + redRose(695, 600, 108, c, 40) + redRose(120, 700, 64, c, 80) + redRose(780, 700, 64, c, 20);
      return s;
    },
  },
  {
    slug: 'e-gitarre', name: 'E-Gitarre', w: 760, h: 960, palettes: ['bunt'],
    tags: ['Gitarre', 'E-Gitarre', 'Rock', 'Metal', 'Musik', 'Band', 'Konzert', 'Instrument', 'Rocker'],
    draw(c) {
      let s = '';
      const body = L.smooth([[-30, 30], [-95, -25], [-125, 10], [-100, 70], [-92, 120], [-135, 185], [-130, 265], [-70, 320], [0, 332], [70, 320], [130, 265], [135, 185], [92, 125], [100, 60], [115, 0], [90, -20], [30, 30]], true);
      let inner = '';
      // neck first (it sits above the body's top)
      inner += path(L.rrect(-24, -350, 48, 400, 4), { fill: '#d6a468' });
      inner += path(L.rrect(-24, -350, 48, 400, 4), { fill: 'none', stroke: '#8a5a2a', 'stroke-width': 3 });
      const fr = new Path(); for (let i = 0; i < 9; i++) fr.M(-24, -300 + i * 38).L(24, -300 + i * 38);
      inner += path(fr, { fill: 'none', stroke: '#8f8f96', 'stroke-width': 3 });
      inner += circle(0, -262, 4.5, { fill: '#f4ecd8' }) + circle(0, -186, 4.5, { fill: '#f4ecd8' }) + circle(0, -110, 4.5, { fill: '#f4ecd8' }) + circle(-8, -30, 4.5, { fill: '#f4ecd8' }) + circle(8, -30, 4.5, { fill: '#f4ecd8' });
      // headstock
      const head = new Path().M(-28, -350).L(-34, -440).Q(-36, -490, 0, -496).Q(36, -490, 34, -440).L(28, -350).Z();
      inner += path(head, { fill: '#2a2530' });
      for (const [x, y] of [[-34, -460], [-34, -430], [-34, -400], [34, -460], [34, -430], [34, -400]]) inner += path(L.rrect(x - (x < 0 ? 16 : -2), y - 7, 14, 14, 3), { fill: '#c9c9d0' });
      s += g({}, inner);
      // body
      s += path(body, { fill: '#8f1628' }) + path(body.transform(compose(move(0, 6), scl(0.97, 0.97))), { fill: RED });
      s += path(L.smooth([[-84, 4], [-100, 60], [-82, 130], [-116, 190], [-112, 262], [-70, 304]]), { fill: 'none', stroke: '#ffffff', 'stroke-opacity': 0.25, 'stroke-width': 10, 'stroke-linecap': 'round' });
      s += path(L.rrect(-62, 100, 124, 130, 40), { fill: '#16141a', 'fill-opacity': 0.9 });
      for (const y of [124, 168]) s += path(L.rrect(-48, y, 96, 22, 8), { fill: '#d9d9de' }) + path(new Path().M(-34, y + 11).L(34, y + 11), { fill: 'none', stroke: '#16141a', 'stroke-width': 4, 'stroke-linecap': 'round' });
      s += path(L.rrect(-56, 250, 112, 14, 6), { fill: '#d9d9de' });
      s += circle(86, 248, 14, { fill: '#d9d9de' }) + circle(60, 292, 14, { fill: '#d9d9de' });
      // strings
      const st = new Path(); for (let i = -2; i <= 2; i++) st.M(i * 7.5, -440).L(i * 8.5, 258);
      s += path(st, { fill: 'none', stroke: '#e9e9ee', 'stroke-width': 1.8, 'stroke-opacity': 0.9 });
      return g({ transform: 'translate(390 500) rotate(30)' }, s);
    },
  },
  {
    slug: 'blitz', name: 'Blitz', w: 500, h: 900, palettes: ['gold', 'weiss', 'schwarz', 'rose'], fit: 14,
    tags: ['Blitz', 'Blitzschlag', 'Strom', 'Energie', 'Rock', 'Metal', 'Gewitter', 'Power', 'Elektro'],
    draw(c) {
      const { p } = c;
      const bolt = L.poly([[290, 0], [40, 470], [210, 470], [120, 900], [460, 330], [270, 330], [400, 0]], true);
      return path(bolt, { fill: p.ink, 'stroke-linejoin': 'round', stroke: p.ink, 'stroke-width': 10 }) + path(L.poly([[290, 0], [40, 470], [210, 470], [250, 420], [190, 420], [330, 100]], true), { fill: '#ffffff', 'fill-opacity': p.id === 'weiss' ? 0 : 0.25 });
    },
  },
  {
    slug: 'stacheldraht', name: 'Stacheldraht', w: 1200, h: 110, palettes: ['schwarz', 'weiss', 'gold'], fit: 12,
    tags: ['Stacheldraht', 'Draht', 'Trenner', 'Linie', 'Rock', 'Metal', 'Rocker', 'Zaun'],
    draw(c) {
      const { p } = c;
      let s = '';
      const wire = (ph) => { const pts = []; for (let i = 0; i <= 60; i++) pts.push([i * 20, 55 + Math.sin(i * 0.5 + ph) * 12]); return L.smooth(pts); };
      s += path(wire(0), { fill: 'none', stroke: p.ink, 'stroke-width': 7, 'stroke-linecap': 'round' }) + path(wire(Math.PI), { fill: 'none', stroke: p.ink, 'stroke-width': 7, 'stroke-linecap': 'round' });
      const barb = new Path();
      for (let i = 1; i < 6; i++) {
        const x = i * 200 - 100;
        barb.M(x - 24, 22).L(x + 24, 88).M(x + 24, 22).L(x - 24, 88);
      }
      s += path(barb, { fill: 'none', stroke: p.ink, 'stroke-width': 7, 'stroke-linecap': 'round' });
      return s;
    },
  },
  {
    slug: 'rosenranke', name: 'Rosenranke dunkel', w: 1400, h: 260, palettes: ['bunt'], fit: 12,
    tags: ['Rosen', 'Ranke', 'Dornen', 'Trenner', 'Rock', 'Gothic', 'Rocker', 'Band', 'rot'],
    draw(c) {
      let s = '';
      const pts = []; for (let i = 0; i <= 14; i++) pts.push([i * 100, 130 + Math.sin(i * 0.9) * 34]);
      const curve = new Curve(pts);
      s += path(M.stem(curve, 9, 9), { fill: LEAF_D });
      for (let i = 1; i < 13; i += 1) { const { p: pt, angle } = curve.at(i / 13); s += path(leaf(70, 17, { belly: 0.45, sharp: 0.8 }).whole.transform(place(pt[0], pt[1], angle + (i % 2 ? -60 : 60), 1)), { fill: LEAF }); }
      for (const t of [0.07, 0.22, 0.38, 0.5, 0.64, 0.8, 0.93]) { const { p: pt, angle } = curve.at(t); const th = new Path().M(0, 0).L(0, i2(t) * 22).transform(place(pt[0], pt[1], angle, 1)); s += path(th, { fill: 'none', stroke: LEAF_D, 'stroke-width': 5, 'stroke-linecap': 'round' }); }
      for (const [t, R] of [[0.22, 54], [0.5, 66], [0.78, 54]]) { const { p: pt } = curve.at(t); s += redRose(pt[0], pt[1] - 4, R, c, t * 300); }
      for (const [t, R] of [[0.06, 26], [0.36, 28], [0.64, 28], [0.94, 26]]) { const { p: pt } = curve.at(t); s += redRose(pt[0], pt[1], R, c, t * 500); }
      return s;
      function i2(t) { return t * 100 % 2 < 1 ? -1 : 1; }
    },
  },
  {
    slug: 'verschleiss', name: 'Verschleiß Kratzer', w: 1000, h: 1000, bleed: true, palettes: ['schwarz', 'weiss'],
    tags: ['Kratzer', 'Verschleiß', 'Used Look', 'Distressed', 'Textur', 'Rock', 'Metal', 'Punk', 'grunge'],
    draw(c) {
      const { p, r } = c;
      let s = '';
      const sc = new Path();
      for (let i = 0; i < 70; i++) {
        const x = r.range(0, 1000), y = r.range(0, 1000), len = r.range(30, 220), a = r.range(-0.5, 0.5) + (r.chance(0.5) ? 0 : 1.2);
        sc.M(x, y).L(x + Math.cos(a) * len, y + Math.sin(a) * len);
      }
      s += path(sc, { fill: 'none', stroke: p.ink, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-opacity': 0.9 });
      const sc2 = new Path();
      for (let i = 0; i < 40; i++) { const x = r.range(0, 1000), y = r.range(0, 1000), len = r.range(8, 60), a = r.range(-0.6, 0.6); sc2.M(x, y).L(x + Math.cos(a) * len, y + Math.sin(a) * len); }
      s += path(sc2, { fill: 'none', stroke: p.ink, 'stroke-width': 7, 'stroke-linecap': 'round' });
      const dots = [];
      for (let i = 0; i < 520; i++) dots.push({ x: r.range(0, 1000), y: r.range(0, 1000), r: r.chance(0.1) ? r.range(5, 9) : r.range(1.5, 4), fill: p.ink });
      return s + L.dots(dots);
    },
  },

  // ------------------------------------------------------------------------------------------------ Gamer
  {
    slug: 'pixelherz-gross', name: 'Pixelherz', w: 480, h: 440, palettes: ['bunt'], fit: 10,
    tags: ['Pixelherz', 'Pixel', 'Herz', 'Gamer', 'Retro', '8-Bit', 'Liebe', 'Nerd', 'Spiel', 'Leben'],
    draw() {
      const rows = pixelShape(15, 14, heartIn, [[3, 3], [4, 2], [3, 4]]);
      return pixels(rows, { o: '#2a1631', r: '#ee3d57', d: '#b21f3d', h: '#ffffff' }, 30);
    },
  },
  {
    slug: 'pixelherzen-leiste', name: 'Pixelherzen Lebensleiste', w: 1200, h: 180, palettes: ['bunt'], fit: 10,
    tags: ['Pixelherz', 'Pixel', 'Herzen', 'Leben', 'Lebensleiste', 'Gamer', 'Retro', '8-Bit', 'Trenner', 'Nerd'],
    draw() {
      const full = pixelShape(15, 14, heartIn, [[3, 3], [4, 2], [3, 4]]);
      const empty = full.map((r) => r.replace(/[rdh]/g, 'e'));
      let s = '';
      [full, full, full, full, empty].forEach((rows, i) => { s += pixels(rows, { o: '#2a1631', r: '#ee3d57', d: '#b21f3d', h: '#ffffff', e: '#f6dbe0' }, 10, i * 168, 0); });
      return s;
    },
  },
  {
    slug: 'pixelstern', name: 'Pixelstern', w: 440, h: 440, palettes: ['bunt'], fit: 10,
    tags: ['Pixelstern', 'Pixel', 'Stern', 'Gamer', 'Retro', '8-Bit', 'Punkte', 'Nerd', 'Spiel'],
    draw() {
      const star = [
        '......oo......', '.....oyyo.....', '.....oyyo.....', '....oyyyyo....', 'ooooyyyyyyoooo', 'oyyyyyyyyyyyyo', '.oyyyyyyyyyyo.', '..oyyyyyyyyo..',
        '...oyyyyyyo...', '...oyyyyyyo...', '..oyyyooyyyo..', '..oyyo..oyyo..', '.oyo......oyo.', '.oo........oo.'];
      return pixels(star, { o: '#3a2a08', y: '#ffd23f' }, 30);
    },
  },
  {
    slug: 'pixelmuenze', name: 'Pixelmünze', w: 360, h: 440, palettes: ['bunt'], fit: 10,
    tags: ['Münze', 'Pixel', 'Coin', 'Gamer', 'Retro', '8-Bit', 'Gold', 'Nerd', 'Spiel'],
    draw() {
      const coin = [
        '...oooooo...', '..ohhyyyyo..', '.ohyyyyyyyo.', 'ohyyyoyyyyyo', 'ohyyoyoyyydo', 'oyyyoyoyyydo', 'oyyyoyoyyydo', 'oyyyoyoyyydo', 'oyyyyoyyyydo', '.oyyyyyyydo.', '..oyyyyyddo.', '...oooooo...'];
      return pixels(coin, { o: '#4a3306', y: '#ffc933', h: '#fff2a8', d: '#d99410' }, 30);
    },
  },
  {
    slug: 'controller', name: 'Game Controller', w: 900, h: 640, palettes: ['bunt', 'schwarz', 'weiss'], fit: 14,
    tags: ['Controller', 'Gamepad', 'Konsole', 'Gamer', 'Zocken', 'Videospiel', 'Spiel', 'Nerd'],
    draw(c) {
      const { p } = c;
      const fixed = !p.mono;
      const body = fixed ? '#3b3f5c' : p.ink, dark = fixed ? '#262942' : (p.id === 'weiss' ? '#d6d1c4' : p.tones[0]), light = fixed ? '#555a82' : (p.id === 'weiss' ? '#ffffff' : p.tones[1]);
      const accent = (i) => (fixed ? ['#ee3d57', '#ffc933', '#37c18a', '#3a86ff'][i] : (p.id === 'weiss' ? '#9a9486' : '#ffffff'));
      const shape = new Path().M(220, 70).C(320, 40, 580, 40, 680, 70).C(760, 90, 800, 140, 830, 250).C(870, 400, 890, 520, 840, 580).C(790, 630, 720, 620, 680, 560)
        .C(640, 500, 600, 440, 540, 430).L(360, 430).C(300, 440, 260, 500, 220, 560).C(180, 620, 110, 630, 60, 580).C(10, 520, 30, 400, 70, 250).C(100, 140, 140, 90, 220, 70).Z();
      let s = path(shape, { fill: body });
      s += path(shape, { fill: 'none', stroke: dark, 'stroke-width': 10, 'stroke-linejoin': 'round' });
      // d-pad
      s += path(L.rrect(138, 188, 120, 40, 8), { fill: dark }) + path(L.rrect(178, 148, 40, 120, 8), { fill: dark });
      s += path(L.rrect(148, 198, 100, 20, 4), { fill: light, 'fill-opacity': 0.5 });
      // buttons
      const bx = 690, by = 208;
      [[0, -52], [52, 0], [0, 52], [-52, 0]].forEach(([dx, dy], i) => { s += circle(bx + dx, by + dy, 28, { fill: dark }) + circle(bx + dx, by + dy, 21, { fill: accent(i) }); });
      // sticks
      s += circle(330, 330, 56, { fill: dark }) + circle(330, 330, 38, { fill: light }) + circle(570, 330, 56, { fill: dark }) + circle(570, 330, 38, { fill: light });
      // centre buttons
      s += path(L.rrect(404, 160, 92, 30, 15), { fill: dark }) + circle(450, 250, 22, { fill: dark }) + circle(450, 250, 14, { fill: accent(1) });
      // shoulder
      s += path(L.rrect(170, 14, 190, 36, 14), { fill: dark }) + path(L.rrect(540, 14, 190, 36, 14), { fill: dark });
      return s;
    },
  },
  {
    slug: 'pixelrahmen-hoch', name: 'Pixelrahmen hoch', w: 1000, h: 1414, palettes: ['schwarz', 'weiss', 'bunt'],
    tags: ['Rahmen', 'Pixel', 'Pixelrahmen', 'Gamer', 'Retro', '8-Bit', 'Nerd', 'Spiel', 'Umrandung'],
    draw(c) {
      const { p } = c;
      const col = p.mono ? p.ink : '#3a86ff', col2 = p.mono ? p.ink : '#ee3d57';
      const px = 20, W = 1000, H = 1414;
      const a = new Path(), b = new Path();
      const sq = (path_, x, y) => path_.M(x, y).L(x + px, y).L(x + px, y + px).L(x, y + px).Z();
      // outer line, two pixels thick, with stepped corners; inner line dashed
      for (let x = 2 * px; x < W - 2 * px; x += px) { sq(a, x, 0); sq(a, x, px); sq(a, x, H - px); sq(a, x, H - 2 * px); }
      for (let y = 2 * px; y < H - 2 * px; y += px) { sq(a, 0, y); sq(a, px, y); sq(a, W - px, y); sq(a, W - 2 * px, y); }
      for (const [x, y] of [[px, px], [W - 2 * px, px], [px, H - 2 * px], [W - 2 * px, H - 2 * px]]) sq(a, x, y);
      for (let x = 5 * px; x < W - 5 * px; x += 2 * px) { sq(b, x, 3 * px); sq(b, x, H - 4 * px); }
      for (let y = 5 * px; y < H - 5 * px; y += 2 * px) { sq(b, 3 * px, y); sq(b, W - 4 * px, y); }
      return path(a, { fill: col }) + path(b, { fill: col2 });
    },
  },
  {
    slug: 'pixelrahmen-quer', name: 'Pixelrahmen quer', w: 1414, h: 1000, palettes: ['schwarz', 'weiss', 'bunt'],
    tags: ['Rahmen', 'Pixel', 'Pixelrahmen', 'Gamer', 'Retro', '8-Bit', 'Nerd', 'Spiel', 'Umrandung', 'quer'],
    draw(c) {
      const { p } = c;
      const col = p.mono ? p.ink : '#3a86ff', col2 = p.mono ? p.ink : '#ee3d57';
      const px = 20, W = 1414, H = 1000;
      const a = new Path(), b = new Path();
      const sq = (path_, x, y) => path_.M(x, y).L(x + px, y).L(x + px, y + px).L(x, y + px).Z();
      for (let x = 2 * px; x < W - 2 * px; x += px) { sq(a, x, 0); sq(a, x, px); sq(a, x, H - px); sq(a, x, H - 2 * px); }
      for (let y = 2 * px; y < H - 2 * px; y += px) { sq(a, 0, y); sq(a, px, y); sq(a, W - px, y); sq(a, W - 2 * px, y); }
      for (const [x, y] of [[px, px], [W - 2 * px, px], [px, H - 2 * px], [W - 2 * px, H - 2 * px]]) sq(a, x, y);
      for (let x = 5 * px; x < W - 5 * px; x += 2 * px) { sq(b, x, 3 * px); sq(b, x, H - 4 * px); }
      for (let y = 5 * px; y < H - 5 * px; y += 2 * px) { sq(b, 3 * px, y); sq(b, W - 4 * px, y); }
      return path(a, { fill: col }) + path(b, { fill: col2 });
    },
  },

  // ------------------------------------------------------------------------------------------------ Pop (jung und modern)
  {
    slug: 'pop-herz', name: 'Pop-Herz', w: 760, h: 700, palettes: ['bunt'], fit: 14,
    tags: ['Herz', 'Pop', 'Pop-Art', 'modern', 'bunt', 'Hochzeit', 'jung', 'Liebe', 'Comic'],
    draw() {
      const h1 = L.heart(380, 330, 600);
      return path(h1.transform(move(26, 26)), { fill: '#1d1d1b' }) + path(h1, { fill: '#ff5d8f', stroke: '#1d1d1b', 'stroke-width': 14, 'stroke-linejoin': 'round' })
        + path(L.ellipsePath(250, 200, 36, 76, 38), { fill: '#ffffff', 'fill-opacity': 0.55 });
    },
  },
  {
    slug: 'pop-funkeln', name: 'Pop-Funkeln', w: 700, h: 700, palettes: ['bunt'], fit: 14,
    tags: ['Funkeln', 'Sterne', 'Glitzer', 'Pop', 'modern', 'bunt', 'Party', 'jung', 'Hochzeit'],
    draw() {
      let s = '';
      const sp = (x, y, r, f) => path(L.sparkle(x, y, r, { squash: 0.12 }), { fill: f, stroke: '#1d1d1b', 'stroke-width': 10, 'stroke-linejoin': 'round' });
      s += sp(260, 400, 230, '#ffd23f') + sp(520, 190, 130, '#3ad4c0') + sp(540, 520, 90, '#ff5d8f') + sp(120, 120, 62, '#8e5cf0');
      return s;
    },
  },
  {
    slug: 'pop-schnoerkel', name: 'Pop-Schnörkel', w: 1200, h: 160, palettes: ['bunt', 'schwarz', 'weiss'], fit: 12,
    tags: ['Schnörkel', 'Welle', 'Squiggle', 'Linie', 'Trenner', 'Pop', 'modern', 'jung', 'bunt'],
    draw(c) {
      const { p } = c;
      const pts = []; for (let i = 0; i <= 12; i++) pts.push([i * 100, 70 + (i % 2 ? 46 : -46)]);
      const col = p.mono ? p.ink : '#ff5d8f';
      let s = path(L.smooth(pts), { fill: 'none', stroke: col, 'stroke-width': 24, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
      if (!p.mono) s += path(L.smooth(pts).transform(move(0, 34)), { fill: 'none', stroke: '#3ad4c0', 'stroke-width': 24, 'stroke-linecap': 'round' });
      return s;
    },
  },
  {
    slug: 'pop-regenbogen', name: 'Pop-Bogen', w: 900, h: 480, palettes: ['bunt'], fit: 12,
    tags: ['Bogen', 'Regenbogen', 'Pop', 'modern', 'bunt', 'jung', 'Streifen', 'Hochzeit', 'Retro'],
    draw() {
      let s = '';
      ['#ff5d8f', '#ffb627', '#ffd23f', '#3ad4c0', '#3a86ff'].forEach((col, i) => { s += path(new Path().arc(450, 450, 400 - i * 64, 400 - i * 64, 180, 360, true), { fill: 'none', stroke: col, 'stroke-width': 62, 'stroke-linecap': 'butt' }); });
      return s;
    },
  },
];

module.exports = { pieces, pixels, pixelShape, redRose };
