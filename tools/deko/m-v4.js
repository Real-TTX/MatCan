'use strict';
/* Motive of batch V4 (Einladungen für Erwachsene und Mottopartys, templates 830-909): fixed colours (palette "bunt" is only the placeholder, the drawings
   ignore it), flat, few tones, every drawing fitted to its content. Run: node tools/deko/build.js, look: node tools/deko/sheet.js --group Motive --key <part>. */
const L = require('./lib');
const { Path, path, rrect, circlePath, ellipsePath, poly, smooth, place, rad, IDENT, mix } = L;

/** A pen for one drawing: every shape goes through the matrix m first (so a whole drawing can be turned, the fit box stays right). */
const mk = (m = IDENT) => {
  const tp = (p) => (m === IDENT ? p : p.transform(m));
  const o = {
    f: (p, fill, a = {}) => path(tp(p), { fill, ...a }),
    s: (p, stroke, w, a = {}) => path(tp(p), { fill: 'none', stroke, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...a }),
    r: (x, y, w, h, r, fill, a) => o.f(rrect(x, y, w, h, r), fill, a),
    c: (cx, cy, rr, fill, a) => o.f(circlePath(cx, cy, rr), fill, a),
    e: (cx, cy, rx, ry, rot, fill, a) => o.f(ellipsePath(cx, cy, rx, ry, rot), fill, a),
    l: (x1, y1, x2, y2, stroke, w, a) => o.s(new Path().M(x1, y1).L(x2, y2), stroke, w, a),
    p: (pts, fill, a) => o.f(poly(pts, true), fill, a),
    sm: (pts, fill, a) => o.f(smooth(pts, true), fill, a),
    sl: (pts, stroke, w, a) => o.s(smooth(pts, false), stroke, w, a),
  };
  return o;
};
const D = mk();
const at = (x, y, rot = 0, s = 1) => mk(place(x, y, rot, s));
/** A counter clockwise ellipse (a hole when it is added to a path that runs clockwise). */
const holeEllipse = (cx, cy, rx, ry, rot = 0) => {
  const kx = 0.5522847498 * rx, ky = 0.5522847498 * ry;
  return new Path().M(rx, 0).C(rx, -ky, kx, -ry, 0, -ry).C(-kx, -ry, -rx, -ky, -rx, 0).C(-rx, ky, -kx, ry, 0, ry).C(kx, ry, rx, ky, rx, 0).Z().transform(place(cx, cy, rot, 1));
};
const holeCircle = (cx, cy, r) => holeEllipse(cx, cy, r, r, 0);
const hole = (pts) => smooth(pts.slice().reverse(), true);
const clamp = L.clamp;

/** A suit as a path: heart, spade, diamond, club (s = height of the sign). */
function suitPath(kind, cx, cy, s) {
  const p = new Path();
  if (kind === 'heart') return L.heart(cx, cy, s * 0.95);
  if (kind === 'diamond') return poly([[cx, cy - s * 0.55], [cx + s * 0.4, cy], [cx, cy + s * 0.55], [cx - s * 0.4, cy]]);
  if (kind === 'spade') {
    p.add(L.heart(0, 0, s * 0.9).transform(place(cx, cy - s * 0.04, 180, 1)));
    p.add(poly([[cx - s * 0.04, cy + s * 0.1], [cx + s * 0.04, cy + s * 0.1], [cx + s * 0.17, cy + s * 0.52], [cx - s * 0.17, cy + s * 0.52]]));
    return p;
  }
  p.add(circlePath(cx, cy - s * 0.2, s * 0.21)).add(circlePath(cx - s * 0.23, cy + s * 0.12, s * 0.21)).add(circlePath(cx + s * 0.23, cy + s * 0.12, s * 0.21));
  p.add(poly([[cx - s * 0.04, cy + s * 0.05], [cx + s * 0.04, cy + s * 0.05], [cx + s * 0.16, cy + s * 0.52], [cx - s * 0.16, cy + s * 0.52]]));
  return p;
}

const pieces = [];
const piece = (slug, name, w, h, tags, draw) => pieces.push({ slug, name, w, h, palettes: ['bunt'], fit: 24, tags, draw });

// ------------------------------------------------------------------------------------------------------------------------ 80s, disco, music
piece('kassette', 'Kassette', 700, 470, ['Kassette', 'Tape', 'Mixtape', '80er', '90er', 'Musik', 'Retro'], () => {
  let s = D.r(0, 0, 700, 470, 34, '#262a3b');
  s += D.r(50, 44, 600, 262, 18, '#f3ead3');
  s += D.r(50, 100, 600, 34, 0, '#ff4fa3') + D.r(50, 134, 600, 34, 0, '#ffc93c') + D.r(50, 168, 600, 34, 0, '#2fd0e6');
  s += D.l(90, 74, 610, 74, '#c9bda0', 5);
  s += D.r(190, 218, 320, 80, 40, '#161826');
  s += D.c(254, 258, 30, '#e9e4d6') + D.c(446, 258, 30, '#e9e4d6');
  s += D.c(254, 258, 12, '#161826') + D.c(446, 258, 12, '#161826');
  for (let i = 0; i < 6; i++) { s += D.l(254 + 20 * Math.cos(i * 1.047), 258 + 20 * Math.sin(i * 1.047), 254 + 27 * Math.cos(i * 1.047), 258 + 27 * Math.sin(i * 1.047), '#161826', 5); }
  s += D.l(284, 280, 416, 280, '#6b4a2e', 6);
  s += D.p([[120, 470], [152, 372], [548, 372], [580, 470]], '#3b4058');
  s += D.c(250, 424, 16, '#262a3b') + D.c(450, 424, 16, '#262a3b') + D.r(300, 410, 100, 28, 8, '#262a3b');
  [[30, 30], [670, 30], [30, 440], [670, 440]].forEach(([x, y]) => { s += D.c(x, y, 10, '#8d93a8'); });
  return s;
});

piece('discokugel', 'Discokugel', 600, 720, ['Discokugel', 'Disco', 'Party', 'Tanzen', '70er', '80er', 'Nacht'], (c) => {
  const cx = 300, cy = 410, R = 230;
  let s = D.l(300, 0, 300, cy - R + 6, '#9aa3bd', 8);
  s += D.r(284, cy - R - 26, 32, 36, 8, '#aab3cc');
  s += D.c(cx, cy, R, '#8f9bc4');
  const proj = (lat, lon) => [cx + R * Math.cos(rad(lat)) * Math.sin(rad(lon)), cy - R * Math.sin(rad(lat))];
  const tones = ['#4f5f94', '#6b7bb3', '#8c9bcb', '#b3c0e4', '#dde4f6', '#ffffff'];
  const rows = 14;
  for (let i = 0; i < rows; i++) {
    const lat0 = -90 + (180 * i) / rows, lat1 = -90 + (180 * (i + 1)) / rows;
    const mid = (lat0 + lat1) / 2;
    const m = Math.max(3, Math.round(18 * Math.cos(rad(mid))));
    for (let j = 0; j < m; j++) {
      const lon0 = -90 + (180 * j) / m, lon1 = -90 + (180 * (j + 1)) / m, lm = (lon0 + lon1) / 2;
      const a = proj(lat0, lon0), b = proj(lat0, lon1), cc = proj(lat1, lon1), d = proj(lat1, lon0);
      const ctr = [(a[0] + b[0] + cc[0] + d[0]) / 4, (a[1] + b[1] + cc[1] + d[1]) / 4];
      const shrink = (q) => [q[0] + (ctr[0] - q[0]) * 0.1, q[1] + (ctr[1] - q[1]) * 0.1];
      const nx = Math.cos(rad(mid)) * Math.sin(rad(lm)), ny = Math.sin(rad(mid)), nz = Math.cos(rad(mid)) * Math.cos(rad(lm));
      const b0 = clamp(0.5 + 0.5 * (-0.45 * nx + 0.5 * ny + 0.7 * nz) + c.r.jitter(0.22), 0, 0.999);
      let fill = tones[Math.floor(b0 * tones.length)];
      const t = c.r.next();
      if (t < 0.1) fill = '#ff8be0'; else if (t < 0.18) fill = '#7ceeff';
      s += D.p([a, b, cc, d].map(shrink), fill);
    }
  }
  [[70, 120, 46], [520, 90, 36], [545, 330, 30], [48, 380, 26], [500, 600, 40], [90, 640, 30]].forEach(([x, y, r]) => { s += D.f(L.sparkle(x, y, r, { squash: 0.16 }), '#ffffff'); });
  return s;
});

piece('neonpalme', 'Neonpalme', 760, 820, ['Palme', 'Neon', '80er', 'Retro', 'Sommer', 'Miami', 'Strand', 'Sunset'], () => {
  const PINK = '#ff4fd8', CY = '#2ff3ff', Y = '#ffb347';
  const T = [380, 330];
  let s = '';
  const glow = (p, col, w) => D.s(p, col, w * 2.4, { 'stroke-opacity': 0.2 }) + D.s(p, col, w);
  s += D.c(T[0], T[1] - 20, 210, 'none', { stroke: Y, 'stroke-width': 34, 'stroke-opacity': 0.2 }) + D.c(T[0], T[1] - 20, 210, 'none', { stroke: Y, 'stroke-width': 14 });
  const trunk = smooth([[366, 700], [352, 590], [372, 470], [T[0], T[1] + 6]], false);
  s += glow(trunk, CY, 16);
  const ends = [[-300, 80], [-230, 170], [-120, 225], [300, 80], [230, 170], [120, 225], [-170, -90], [170, -90]];
  ends.forEach(([ex, ey], k) => {
    const ctrl = [T[0] + ex * 0.55, T[1] + ey * 0.4 - (k >= 6 ? 130 : 120)];
    const fr = new Path().M(T[0], T[1]).Q(ctrl[0], ctrl[1], T[0] + ex, T[1] + ey);
    s += glow(fr, PINK, 14);
    for (let i = 1; i <= 5; i++) {
      const t = 0.15 + i * 0.15, u = 1 - t;
      const px = u * u * T[0] + 2 * u * t * ctrl[0] + t * t * (T[0] + ex), py = u * u * T[1] + 2 * u * t * ctrl[1] + t * t * (T[1] + ey);
      const dir = ex < 0 ? -1 : 1;
      const len = 46 - i * 4;
      s += D.s(new Path().M(px, py).L(px + dir * len * 0.4, py + len * 0.9), PINK, 8);
      s += D.s(new Path().M(px, py).L(px - dir * len * 0.1, py + len * 0.95), PINK, 8);
    }
  });
  s += D.c(T[0], T[1] + 12, 20, CY);
  s += glow(smooth([[250, 712], [300, 696], [350, 712], [400, 728], [450, 712], [500, 696]], false), Y, 10);
  return s;
});

// ------------------------------------------------------------------------------------------------------------------------ casino, games
piece('spielkarten', 'Spielkarten', 860, 700, ['Spielkarten', 'Karten', 'Poker', 'Casino', 'Skat', 'Herz', 'Pik', 'Karo', 'Spiel'], () => {
  const RED = '#d8283c', BLK = '#1d1d27';
  let s = '';
  [[-30, -150, 'spade', BLK], [0, 0, 'heart', RED], [30, 150, 'diamond', RED]].forEach(([rot, dx, kind, col]) => {
    const d = at(430 + dx, 700, rot, 1);
    s += d.r(-160, -620, 320, 460, 24, '#fffdf6', { stroke: '#cfc6b3', 'stroke-width': 5 });
    s += d.f(suitPath(kind, 0, -390, 210), col);
    s += d.f(suitPath(kind, -112, -560, 52), col);
    s += d.f(suitPath(kind, 0, 0, 52).transform(place(112, -226, 180, 1)), col);
  });
  return s;
});

piece('pokerchips', 'Pokerchips', 760, 620, ['Pokerchips', 'Chips', 'Poker', 'Casino', 'Spielbank', 'Glücksspiel', 'Jeton'], () => {
  const chipFace = (cx, cy, R, col, rot = 0) => {
    const d = at(cx, cy, rot, 1);
    let s = d.c(0, 0, R, col);
    for (let i = 0; i < 8; i++) { const a = at(cx, cy, rot + i * 45, 1); s += a.r(-R * 0.13, -R * 1.0, R * 0.26, R * 0.3, R * 0.04, '#ffffff'); }
    s += d.c(0, 0, R * 0.68, mix(col, '#000000', 0.12)) + d.c(0, 0, R * 0.62, col, { stroke: '#ffffff', 'stroke-width': R * 0.05, 'stroke-dasharray': `${R * 0.12} ${R * 0.09}` });
    s += d.f(L.starPath(0, 0, R * 0.34, R * 0.15, 5, -90), '#ffffff');
    return s;
  };
  const stack = (x, y, n, col, w = 250, h = 46) => {
    let s = '';
    for (let i = 0; i < n; i++) {
      const yy = y - (i + 1) * h;
      s += D.r(x, yy, w, h + 2, 12, i % 2 ? mix(col, '#000000', 0.1) : col);
      for (let k = 0; k < 6; k++) s += D.r(x + 22 + k * (w - 44) / 6 + 8, yy + 6, 16, h - 10, 4, '#ffffff', { opacity: 0.95 });
    }
    return s;
  };
  let s = stack(30, 620, 7, '#c5202e') + stack(300, 620, 4, '#1c1f2b');
  s += chipFace(600, 190, 150, '#2358c9', 14);
  s += chipFace(590, 440, 100, '#1f8a4c', -10);
  return s;
});

piece('roulette', 'Roulette', 700, 700, ['Roulette', 'Casino', 'Kessel', 'Spielbank', 'Glücksspiel', 'Rad', 'Spiel'], () => {
  const cx = 350, cy = 350;
  let s = D.c(cx, cy, 340, '#4e2a13') + D.c(cx, cy, 318, '#7a4421') + D.c(cx, cy, 300, '#e3c479');
  const wedge = (k, r1, r2) => {
    const a0 = -90 + (k * 360) / 37, a1 = -90 + ((k + 1) * 360) / 37;
    return new Path().arc(cx, cy, r2, r2, a0, a1, true).arc(cx, cy, r1, r1, a1, a0).Z();
  };
  for (let k = 0; k < 37; k++) s += D.f(wedge(k, 196, 290), k === 0 ? '#1f8a4c' : k % 2 ? '#c5202e' : '#17171c');
  for (let k = 0; k < 37; k++) { const a = rad(-90 + (k * 360) / 37); s += D.l(cx + 196 * Math.cos(a), cy + 196 * Math.sin(a), cx + 290 * Math.cos(a), cy + 290 * Math.sin(a), '#e3c479', 3); }
  s += D.c(cx, cy, 196, '#e3c479') + D.c(cx, cy, 184, '#8d5a2b') + D.c(cx, cy, 150, '#a8713a');
  for (let i = 0; i < 4; i++) { const a = rad(i * 90 + 45); s += D.l(cx, cy, cx + 150 * Math.cos(a), cy + 150 * Math.sin(a), '#e3c479', 16); s += D.c(cx + 150 * Math.cos(a), cy + 150 * Math.sin(a), 14, '#e3c479'); }
  s += D.c(cx, cy, 58, '#e3c479') + D.c(cx, cy, 36, '#c9a04e') + D.c(cx, cy, 14, '#f4dca0');
  s += D.c(cx + 245 * Math.cos(rad(-55)), cy + 245 * Math.sin(rad(-55)), 17, '#ffffff', { stroke: '#cfcfcf', 'stroke-width': 3 });
  return s;
});

piece('lupe-fingerabdruck', 'Lupe mit Fingerabdruck', 640, 700, ['Lupe', 'Fingerabdruck', 'Krimi', 'Detektiv', 'Krimidinner', 'Spurensuche', 'Tatort', 'Ermittlung'], (c) => {
  const cx = 270, cy = 270, R = 200;
  let s = D.c(cx, cy, R, '#d9f1ff');
  const h = at(cx, cy, 45, 1);
  s += h.r(R + 8, -32, 290, 64, 30, '#8a5530') + h.r(R + 8, -42, 44, 84, 14, '#2b2f3a');
  s += D.c(cx, cy, R, 'none', { stroke: '#2b2f3a', 'stroke-width': 38 });
  for (let k = 0; k < 8; k++) {
    const r = 22 + k * 19;
    const a0 = -205 + c.r.range(-8, 8), a1 = 25 + c.r.range(-8, 8);
    const gap = c.r.range(70, 150);
    const arc = new Path().arc(cx, cy + 14, r, r * 1.22, a0, a0 + gap * 0.45, true);
    s += D.s(arc, '#2b4a66', 9);
    s += D.s(new Path().arc(cx, cy + 14, r, r * 1.22, a0 + gap * 0.6, a1, true), '#2b4a66', 9);
  }
  s += D.s(new Path().arc(cx, cy, R - 34, R - 34, 200, 255, true), '#ffffff', 14, { opacity: 0.8 });
  return s;
});

// ------------------------------------------------------------------------------------------------------------------------ drinks
piece('martini-glas', 'Martini-Glas', 520, 720, ['Martini', 'Cocktail', 'Cocktailglas', 'Oliven', 'Bar', 'Drink', 'Aperitif', 'Cocktailparty'], () => {
  let s = D.p([[40, 90], [460, 90], [250, 380]], '#dff3fb', { 'fill-opacity': 0.75, stroke: '#9fc4d4', 'stroke-width': 8, 'stroke-linejoin': 'round' });
  s += D.p([[84, 152], [416, 152], [250, 372]], '#ff7a45');
  s += D.l(84, 152, 416, 152, '#ffb18f', 6);
  s += D.r(240, 380, 20, 252, 10, '#b9d6e3') + D.e(250, 640, 132, 22, 0, '#b9d6e3');
  s += D.l(118, 4, 312, 214, '#b8864b', 9) + D.c(118, 4, 12, '#b8864b');
  s += D.e(224, 126, 34, 27, -35, '#8aa83a') + D.c(214, 118, 8, '#d8283c');
  s += D.e(284, 184, 34, 27, -35, '#9bb946') + D.c(274, 176, 8, '#d8283c');
  s += D.l(70, 108, 150, 230, '#ffffff', 10, { opacity: 0.6 });
  return s;
});

piece('cocktail-tropisch', 'Tropischer Cocktail', 640, 800, ['Cocktail', 'Tropisch', 'Sommer', 'Strohhalm', 'Orange', 'Schirmchen', 'Bar', 'Drink', 'Sunrise'], () => {
  const hwPts = [[110, 150], [260, 130], [380, 70], [470, 30], [520, 14]];
  const hw = (y) => { for (let i = 0; i < hwPts.length - 1; i++) { const [y0, w0] = hwPts[i], [y1, w1] = hwPts[i + 1]; if (y <= y1) return w0 + (w1 - w0) * (y - y0) / (y1 - y0); } return 14; };
  const cx = 320;
  let s = D.c(168, 120, 78, '#ff9f1c') + D.c(168, 120, 62, '#ffd36b');
  for (let i = 0; i < 8; i++) { const a = rad(i * 45 + 22); s += D.l(168 + 10 * Math.cos(a), 120 + 10 * Math.sin(a), 168 + 56 * Math.cos(a), 120 + 56 * Math.sin(a), '#ff9f1c', 5); }
  const outline = [[cx - 150, 110], [cx + 150, 110], [cx + 130, 260], [cx + 70, 380], [cx + 30, 470], [cx + 14, 520], [cx + 14, 610], [cx + 76, 632], [cx + 92, 664], [cx - 92, 664], [cx - 76, 632], [cx - 14, 610], [cx - 14, 520], [cx - 30, 470], [cx - 70, 380], [cx - 130, 260]];
  s += D.sm(outline, '#e2f3f8', { 'fill-opacity': 0.8, stroke: '#9fc4d4', 'stroke-width': 8 });
  [[165, 250, '#ffd23f'], [250, 340, '#ff8a2a'], [340, 440, '#e5283c'], [440, 515, '#a3122f']].forEach(([y0, y1, col]) => {
    const a = hw(y0) - 10, b = hw(y1) - 10;
    s += D.p([[cx - a, y0], [cx + a, y0], [cx + b, y1], [cx - b, y1]], col);
  });
  s += D.l(cx - 118, 200, cx - 84, 330, '#ffffff', 11, { opacity: 0.55 });
  s += D.l(cx + 40, 250, cx + 150, 40, '#ff4f8b', 24);
  for (let i = 0; i < 4; i++) { const t0 = 0.12 + i * 0.22; s += D.l(cx + 40 + 110 * t0, 250 - 210 * t0, cx + 40 + 110 * (t0 + 0.1), 250 - 210 * (t0 + 0.1), '#ffffff', 24, { 'stroke-linecap': 'butt' }); }
  s += D.l(cx - 70, 190, cx - 150, 12, '#9a6a3a', 8);
  const um = at(cx - 150, 14, -28, 1);
  ['#e5283c', '#ffd23f', '#2fd0e6', '#ff4f8b'].forEach((col, i) => { s += um.f(new Path().arc(0, 0, 92, 62, 180 + i * 45, 225 + i * 45, true).L(0, 0).Z(), col); });
  return s;
});

piece('weinglas-rot', 'Weinglas mit Rotwein', 400, 760, ['Wein', 'Weinglas', 'Rotwein', 'Weinprobe', 'Glas', 'Weinabend', 'Sommelier'], () => {
  const bowl = [[70, 40], [330, 40], [350, 170], [305, 300], [200, 352], [95, 300], [50, 170]];
  let s = D.r(188, 340, 24, 300, 8, '#cfe3ea') + D.e(200, 654, 118, 20, 0, '#cfe3ea');
  s += D.sm(bowl, '#eef7fa', { 'fill-opacity': 0.8, stroke: '#a9c4cf', 'stroke-width': 8 });
  const lower = smooth([[53, 190], [62, 250], [95, 300], [200, 352], [305, 300], [338, 250], [347, 190]], false).Z();
  s += D.f(lower, '#8e1b3a') + D.e(200, 190, 147, 14, 0, '#b3294d');
  s += D.s(new Path().arc(200, 190, 135, 135, 140, 200, true), '#ffffff', 12, { opacity: 0.55 });
  return s;
});

piece('weinflasche', 'Weinflasche', 260, 780, ['Wein', 'Weinflasche', 'Flasche', 'Rotwein', 'Weinprobe', 'Winzer'], () => {
  let s = D.f(new Path().M(30, 340).C(30, 262, 100, 252, 100, 190).L(100, 70).L(160, 70).L(160, 190).C(160, 252, 230, 262, 230, 340).L(230, 728).Q(230, 760, 198, 760).L(62, 760).Q(30, 760, 30, 728).Z(), '#1f4d2e');
  s += D.r(94, 32, 72, 110, 10, '#8e1b3a') + D.r(94, 100, 72, 12, 0, '#6e1129');
  s += D.r(48, 440, 164, 220, 6, '#f3ead3') + D.r(60, 456, 140, 5, 0, '#c9a04e') + D.r(60, 640, 140, 5, 0, '#c9a04e');
  s += D.c(130, 540, 34, '#c9a04e') + D.c(130, 540, 24, '#f3ead3') + D.l(80, 590, 180, 590, '#9a948a', 5) + D.l(92, 608, 168, 608, '#9a948a', 5);
  s += D.r(46, 300, 14, 430, 7, '#ffffff', { opacity: 0.16 });
  return s;
});

piece('trauben', 'Weintrauben', 560, 700, ['Trauben', 'Weintrauben', 'Wein', 'Weinlese', 'Herbst', 'Weinprobe', 'Weinfest', 'Traube'], (c) => {
  let s = D.l(290, 70, 290, 160, '#7a5a2e', 16) + D.s(new Path().M(290, 96).C(330, 60, 380, 60, 396, 90), '#7a5a2e', 8);
  const lf = L.leaf(250, 105, { belly: 0.45, sharp: 0.5 });
  s += D.f(lf.whole.transform(place(300, 112, -28, 1)), '#5b8a3c');
  s += D.s(lf.mid.transform(place(300, 112, -28, 1)), '#3f6a28', 6);
  const tones = ['#5a2670', '#6b2a7a', '#7d3590', '#8d44a3'];
  [4, 5, 4, 3, 2, 1].forEach((n, r) => {
    for (let i = 0; i < n; i++) {
      const x = 290 + (i - (n - 1) / 2) * 96 + c.r.jitter(4), y = 190 + r * 86 + c.r.jitter(4);
      s += D.c(x, y, 54, tones[(r + i) % tones.length]) + D.e(x - 16, y - 18, 11, 7, -35, '#ffffff', { opacity: 0.45 });
    }
  });
  return s;
});

// ------------------------------------------------------------------------------------------------------------------------ games
piece('wuerfel', 'Würfel', 640, 560, ['Würfel', 'Spiel', 'Spieleabend', 'Brettspiel', 'Casino', 'Glück', 'Würfelspiel'], () => {
  const pips = (d, n, col) => {
    const g = 82, spots = { 1: [[0, 0]], 2: [[-g, -g], [g, g]], 3: [[-g, -g], [0, 0], [g, g]], 4: [[-g, -g], [g, -g], [-g, g], [g, g]], 5: [[-g, -g], [g, -g], [0, 0], [-g, g], [g, g]], 6: [[-g, -g], [g, -g], [-g, 0], [g, 0], [-g, g], [g, g]] };
    return spots[n].map(([x, y]) => d.c(x, y, 27, col)).join('');
  };
  const die = (cx, cy, rot, face, ink, n) => {
    const d = at(cx, cy, rot, 1);
    return d.r(-150, -138, 300, 300, 46, mix(face, '#000000', 0.16)) + d.r(-150, -150, 300, 300, 46, face) + pips(d, n, ink);
  };
  return die(210, 330, -14, '#fffdf6', '#1d1d27', 5) + die(440, 200, 18, '#d8283c', '#ffffff', 3);
});

const MEEPLE = [[50, 34], [36, 34], [26, 40], [8, 42], [0, 52], [6, 62], [28, 62], [30, 74], [18, 96], [14, 110], [36, 110], [50, 92], [64, 110], [86, 110], [82, 96], [70, 74], [72, 62], [94, 62], [100, 52], [92, 42], [74, 40], [64, 34]];
piece('meeples', 'Spielfiguren', 780, 620, ['Meeple', 'Spielfigur', 'Brettspiel', 'Spieleabend', 'Gesellschaftsspiel', 'Spiel', 'Figuren'], () => {
  const one = (x, y, k, col, rot) => {
    const d = mk(place(x, y, rot, k));
    const dark = mix(col, '#000000', 0.28);
    return d.sm(MEEPLE.map(([a, b]) => [a - 50, b - 55]), col, { stroke: dark, 'stroke-width': 3 }) + d.c(0, -38, 17, col, { stroke: dark, 'stroke-width': 3 }) + d.e(-8, -46, 5, 3, -30, '#ffffff', { opacity: 0.5 });
  };
  return one(400, 320, 4.2, '#d8283c', 0) + one(110, 420, 3, '#2358c9', -12) + one(690, 420, 3, '#f2b631', 12);
});

// ------------------------------------------------------------------------------------------------------------------------ Oktoberfest, beer
piece('brezel-salz', 'Brezel mit Salz', 640, 560, ['Brezel', 'Breze', 'Oktoberfest', 'Wiesn', 'Bayern', 'Bäcker', 'Brotzeit', 'Salz'], (c) => {
  const pts = [[540, 265], [575, 160], [505, 55], [410, 62], [320, 150], [170, 232], [105, 330], [150, 450], [320, 510], [490, 450], [535, 330], [470, 232], [320, 150], [230, 62], [130, 55], [65, 160], [100, 265]];
  const full = smooth(pts, false);
  const over = smooth(pts.slice(9, 15), false);
  let s = D.s(full, '#8a4d17', 66) + D.s(full, '#c27a2b', 52);
  s += D.s(over, '#8a4d17', 66, { 'stroke-linecap': 'butt' }) + D.s(over, '#c27a2b', 52);
  s += D.s(full, '#d99a45', 14, { opacity: 0.7 });
  const cv = new L.Curve(pts, false);
  for (let i = 0; i < 46; i++) {
    const q = cv.at(c.r.range(0.03, 0.97));
    const nx = -q.tan[1], ny = q.tan[0], off = c.r.range(-14, 14);
    s += D.f(rrect(-6, -3, 12, 6, 2.5).transform(place(q.p[0] + nx * off, q.p[1] + ny * off, c.r.range(0, 180), 1)), '#ffffff');
  }
  return s;
});

piece('lebkuchenherz-guss', 'Lebkuchenherz mit Zuckerguss', 600, 640, ['Lebkuchenherz', 'Herz', 'Oktoberfest', 'Wiesn', 'Volksfest', 'Kirmes', 'Lebkuchen', 'Zuckerguss'], () => {
  let s = D.s(new Path().arc(300, 170, 100, 84, 0, 360, true), '#e5283c', 18);
  s += D.f(L.heart(300, 330, 560), '#8a4b1f');
  s += D.f(L.heart(300, 330, 500), '#a35e28');
  s += D.f(L.heart(300, 330, 500), 'none', { stroke: '#ffffff', 'stroke-width': 13, 'stroke-dasharray': '0.1 26', 'stroke-linecap': 'round' });
  s += D.f(L.heart(300, 330, 410), 'none', { stroke: '#fffdf6', 'stroke-width': 9, opacity: 0.9 });
  return s;
});

piece('rautenband', 'Rautenband weiß-blau', 1400, 140, ['Raute', 'Rauten', 'Weiß-Blau', 'Oktoberfest', 'Bayern', 'Wiesn', 'Muster', 'Band', 'Borte'], () => {
  const BL = '#2b86d6';
  let s = '';
  for (let b = 0; b <= 2; b++) {
    for (let a = (b % 2 ? 1 : 2); a <= (b % 2 ? 19 : 18); a += 2) {
      const x = a * 70, y = b * 70, col = a % 2 ? BL : '#ffffff';
      const pts = b === 0 ? [[x + 70, y], [x, y + 70], [x - 70, y]] : b === 2 ? [[x, y - 70], [x + 70, y], [x - 70, y]] : [[x, y - 70], [x + 70, y], [x, y + 70], [x - 70, y]];
      s += D.p(pts, col, col === '#ffffff' ? { stroke: '#d6e4f2', 'stroke-width': 1 } : {});
    }
  }
  return s;
});

// ------------------------------------------------------------------------------------------------------------------------ Karneval
piece('maske', 'Venezianische Maske', 800, 440, ['Maske', 'Venezianisch', 'Karneval', 'Fasching', 'Maskenball', 'Verkleidung', 'Maskerade', 'Fastnacht'], () => {
  const outer = new Path().M(30, 170).C(100, 60, 300, 60, 400, 122).C(500, 60, 700, 60, 770, 170).C(800, 250, 720, 350, 600, 332).C(510, 322, 450, 272, 400, 272).C(350, 272, 290, 322, 200, 332).C(80, 350, 0, 250, 30, 170).Z();
  const body = outer.clone().add(holeEllipse(232, 208, 104, 46, -14)).add(holeEllipse(568, 208, 104, 46, 14));
  let s = D.f(body, '#6a2fa8');
  s += D.s(new Path().M(40, 176).C(110, 70, 300, 70, 400, 130).C(500, 70, 690, 70, 760, 176), '#e3c479', 9);
  s += D.s(ellipsePath(232, 208, 118, 58, -14), '#e3c479', 9) + D.s(ellipsePath(568, 208, 118, 58, 14), '#e3c479', 9);
  [[400, 160, 16], [400, 205, 11], [400, 240, 8]].forEach(([x, y, r]) => { s += D.f(L.starPath(x, y, r * 1.5, r * 0.6, 4, -90), '#e3c479'); });
  [[120, 290], [90, 262], [680, 290], [710, 262], [170, 300], [630, 300]].forEach(([x, y]) => { s += D.c(x, y, 9, '#e3c479'); });
  [['#ff4f8b', 38], ['#2fd0e6', 18], ['#ffc93c', 0]].forEach(([col, rot], i) => {
    const lf = L.leaf(240, 52, { belly: 0.45, sharp: 0.6 });
    const m = place(660 + i * 6, 110, -52 - rot, 1);
    s += D.f(lf.whole.transform(m), col) + D.s(lf.mid.transform(m), mix(col, '#000000', 0.25), 4);
  });
  return s;
});

piece('narrenkappe', 'Narrenkappe', 760, 640, ['Narrenkappe', 'Jester', 'Fasching', 'Karneval', 'Fastnacht', 'Hofnarr', 'Schellen', 'Verkleidung'], () => {
  let s = '';
  s += D.f(new Path().M(380, 440).C(300, 300, 160, 230, 40, 200).C(70, 250, 100, 340, 90, 440).Z(), '#e5283c');
  s += D.f(new Path().M(380, 440).C(460, 300, 600, 230, 720, 200).C(690, 250, 660, 340, 670, 440).Z(), '#2358c9');
  s += D.f(new Path().M(380, 440).C(300, 330, 290, 200, 380, 60).C(470, 200, 460, 330, 380, 440).Z(), '#ffc93c');
  s += D.f(new Path().M(380, 440).C(420, 340, 430, 200, 380, 60).C(470, 200, 460, 330, 380, 440).Z(), '#e5a11b');
  s += D.r(90, 440, 580, 120, 26, '#7a2fb5');
  for (let i = 0; i < 8; i++) s += D.p([[130 + i * 70, 450], [165 + i * 70, 500], [130 + i * 70, 550], [95 + i * 70, 500]], i % 2 ? '#ffc93c' : '#ffffff');
  [[40, 200], [720, 200], [380, 60]].forEach(([x, y]) => { s += D.c(x, y, 38, '#e3c479') + D.c(x, y, 38, 'none', { stroke: '#b98f3b', 'stroke-width': 5 }) + D.l(x - 22, y + 6, x + 22, y + 6, '#b98f3b', 5) + D.c(x - 10, y - 12, 8, '#ffffff', { opacity: 0.6 }); });
  return s;
});

// ------------------------------------------------------------------------------------------------------------------------ film, grill, fashion
piece('filmklappe', 'Filmklappe', 700, 640, ['Filmklappe', 'Klappe', 'Film', 'Kino', 'Filmabend', 'Regie', 'Movie', 'Drehbuch'], () => {
  const INK = '#22262f';
  let s = D.r(40, 250, 620, 350, 18, INK);
  for (let i = 0; i < 3; i++) s += D.l(76, 330 + i * 78, 624, 330 + i * 78, '#ffffff', 5, { opacity: 0.5 });
  s += D.l(250, 290, 250, 580, '#ffffff', 5, { opacity: 0.35 }) + D.l(450, 290, 450, 580, '#ffffff', 5, { opacity: 0.35 });
  const bar = (d, y0) => {
    let t = d.r(0, y0, 620, 64, 12, INK);
    for (let i = 0; i < 8; i++) t += d.p([[i * 80 + 8, y0 + 4], [i * 80 + 48, y0 + 4], [i * 80 + 30, y0 + 60], [i * 80 - 10, y0 + 60]].map(([x, y]) => [clamp(x, 6, 614), y]), '#ffffff');
    return t;
  };
  s += bar(at(40, 244, 0, 1), -2);
  s += bar(at(40, 232, -17, 1), -64);
  s += D.c(46, 232, 13, '#8d93a8');
  return s;
});

piece('popcorn', 'Popcorn', 580, 720, ['Popcorn', 'Kino', 'Filmabend', 'Snack', 'Film', 'Jahrmarkt', 'Knabberei', 'Fernsehabend'], (c) => {
  const quad = (x0, x1, y0, y1, k, col) => {
    const w0 = 420 / 6, w1 = 320 / 6;
    return D.p([[70 + w0 * k, 250], [70 + w0 * (k + 1), 250], [120 + w1 * (k + 1), 670], [120 + w1 * k, 670]], col);
  };
  let s = '';
  const blobs = [[110, 230], [190, 190], [280, 170], [370, 190], [460, 230], [150, 120], [240, 100], [330, 96], [420, 130], [200, 40], [300, 36], [380, 56]];
  blobs.forEach(([x, y], i) => {
    s += D.c(x, y, 50, '#fff4d1') + D.c(x - 30, y + 20, 30, '#fff4d1') + D.c(x + 30, y + 24, 28, '#fff4d1');
    s += D.c(x + 14, y - 8, 22, '#ffd34e', { opacity: 0.9 }) + D.c(x - 24, y + 4, 12, '#ffe58a');
  });
  for (let k = 0; k < 6; k++) s += quad(0, 0, 0, 0, k, k % 2 ? '#ffffff' : '#d8283c');
  s += D.r(50, 236, 480, 44, 18, '#d8283c') + D.r(50, 270, 480, 8, 0, '#a51d2e');
  s += D.r(120, 660, 340, 16, 8, '#a51d2e');
  return s;
});

piece('filmrolle', 'Filmrolle', 760, 640, ['Filmrolle', 'Film', 'Kino', 'Filmabend', 'Streifen', 'Movie', 'Spule', 'Lichtspiel'], () => {
  const cx = 280, cy = 280;
  const reel = circlePath(cx, cy, 250).add(holeCircle(cx, cy, 36));
  for (let i = 0; i < 6; i++) { const a = rad(i * 60 + 30); reel.add(holeCircle(cx + 146 * Math.cos(a), cy + 146 * Math.sin(a), 66)); }
  let s = '';
  const pts = [[190, 560], [300, 600], [440, 590], [570, 520], [660, 420]];
  const cv = new L.Curve(pts, false);
  s += D.f(L.ribbon(cv, () => 140, { count: 36, ends: 'flat' }), '#1b1e27');
  for (let u = 18; u < cv.length - 10; u += 30) {
    const q = cv.at(u / cv.length), nx = -q.tan[1], ny = q.tan[0];
    [-52, 52].forEach((off) => { s += D.f(rrect(-9, -7, 18, 14, 3).transform(place(q.p[0] + nx * off, q.p[1] + ny * off, q.angle, 1)), '#f3ead3'); });
    if (Math.round(u / 30) % 3 === 0) s += D.f(rrect(-32, -27, 64, 54, 5).transform(place(q.p[0], q.p[1], q.angle, 1)), '#4a5470');
  }
  s += D.f(reel, '#2c3140') + D.c(cx, cy, 250, 'none', { stroke: '#5b6482', 'stroke-width': 8 }) + D.c(cx, cy, 70, 'none', { stroke: '#5b6482', 'stroke-width': 8 });
  s += D.s(new Path().arc(cx, cy, 225, 225, 200, 260, true), '#ffffff', 10, { opacity: 0.25 });
  return s;
});

piece('grill', 'Kugelgrill', 780, 780, ['Grill', 'Grillen', 'Kugelgrill', 'Barbecue', 'BBQ', 'Würstchen', 'Sommer', 'Grillfest', 'Grillparty'], () => {
  let s = D.l(250, 600, 200, 750, '#2d2d34', 18) + D.l(520, 600, 570, 750, '#2d2d34', 18) + D.l(390, 640, 390, 750, '#2d2d34', 18);
  s += D.c(200, 752, 18, '#2d2d34') + D.c(570, 752, 18, '#2d2d34');
  s += D.f(new Path().arc(390, 350, 300, 290, 0, 180, true).Z(), '#3b3b44');
  s += D.s(new Path().arc(390, 350, 262, 252, 20, 80, true), '#ffffff', 12, { opacity: 0.16 });
  s += D.r(60, 330, 660, 34, 17, '#5a5a66');
  s += D.r(14, 318, 90, 18, 9, '#8a5a2b');
  s += D.l(100, 304, 680, 304, '#a7a7b3', 8);
  [140, 220, 300, 380, 460, 540, 620].forEach((x) => { s += D.l(x, 300, x, 330, '#a7a7b3', 5); });
  const f = (x, y, rot, col) => { const d = at(x, y, rot, 1); return d.r(-95, -26, 190, 52, 26, col) + [-55, -15, 25, 62].map((k) => d.l(k, -18, k + 14, 18, '#5a2810', 6, { opacity: 0.7 })).join(''); };
  s += f(240, 272, -6, '#b3532c') + f(500, 270, 5, '#c0623a');
  [[300, 60, 150], [390, 40, 130], [480, 70, 150]].forEach(([x, y, h], i) => {
    s += D.s(new Path().M(x, y + h).C(x - 36, y + h * 0.7, x + 36, y + h * 0.4, x, y), '#c9ced9', 10, { opacity: 0.7 });
  });
  return s;
});

piece('flamme-rot', 'Flamme', 400, 560, ['Flamme', 'Feuer', 'Lagerfeuer', 'Grill', 'Hitze', 'heiß', 'Brennen', 'Rock'], () => {
  const outer = new Path().M(200, 10).C(240, 130, 370, 200, 370, 340).C(370, 460, 300, 540, 200, 540).C(100, 540, 30, 460, 30, 340).C(30, 260, 80, 220, 110, 160).C(122, 220, 150, 240, 165, 224).C(205, 170, 160, 90, 200, 10).Z();
  let s = D.f(outer, '#ff5a1f');
  s += D.f(new Path().M(200, 190).C(230, 270, 310, 310, 310, 400).C(310, 470, 260, 520, 200, 520).C(140, 520, 90, 470, 90, 400).C(90, 340, 130, 320, 145, 280).C(160, 310, 180, 316, 190, 300).C(210, 270, 188, 230, 200, 190).Z(), '#ffb627');
  s += D.f(new Path().M(200, 340).C(220, 390, 262, 410, 262, 456).C(262, 494, 236, 512, 200, 512).C(164, 512, 138, 494, 138, 456).C(138, 420, 176, 400, 200, 340).Z(), '#fff1a8');
  return s;
});

piece('kussmund', 'Kussmund', 640, 400, ['Lippen', 'Kussmund', 'Lippenstift', 'Mädelsabend', 'Kuss', 'Make-up', 'Glamour', 'Rot'], () => {
  let s = D.f(new Path().M(20, 180).C(90, 120, 170, 30, 290, 100).C(300, 106, 310, 106, 320, 100).C(440, 30, 530, 120, 620, 180).C(520, 206, 420, 214, 320, 214).C(220, 214, 120, 206, 20, 180).Z(), '#d3213f');
  s += D.f(new Path().M(20, 180).C(120, 206, 220, 214, 320, 214).C(420, 214, 520, 206, 620, 180).C(580, 310, 460, 370, 320, 370).C(180, 370, 60, 310, 20, 180).Z(), '#ea3d5d');
  s += D.s(new Path().M(20, 180).C(120, 206, 220, 214, 320, 214).C(420, 214, 520, 206, 620, 180), '#8d1327', 8);
  s += D.e(230, 290, 80, 22, -8, '#ffffff', { opacity: 0.32 }) + D.e(220, 130, 40, 12, -22, '#ffffff', { opacity: 0.28 });
  return s;
});

piece('diamantring', 'Diamantring', 560, 640, ['Ring', 'Diamant', 'Diamantring', 'Verlobung', 'Junggesellenabschied', 'Antrag', 'Brillant', 'Heiraten', 'Braut'], () => {
  let s = D.s(new Path().arc(280, 420, 150, 150, 0, 360, true), '#c9a04e', 40) + D.s(new Path().arc(280, 420, 150, 150, 0, 360, true), '#e3c479', 22);
  s += D.p([[238, 276], [322, 276], [334, 250], [226, 250]], '#c9a04e');
  const T = [[212, 100], [348, 100]], G = [[160, 170], [400, 170]], B = [280, 280];
  s += D.p([T[0], T[1], G[1], B, G[0]], '#9fdcf7');
  s += D.p([T[0], T[1], G[1], G[0]], '#e8f8ff');
  s += D.p([T[0], [280, 170], G[0]], '#bfe9ff') + D.p([T[1], [280, 170], G[1]], '#8fd3f5') + D.p([T[0], T[1], [280, 170]], '#ffffff');
  s += D.p([G[0], [280, 170], B], '#8fd3f5') + D.p([G[1], [280, 170], B], '#6bc2ee');
  s += D.f(L.sparkle(450, 90, 46, { squash: 0.16 }), '#ffd23f') + D.f(L.sparkle(100, 60, 30, { squash: 0.16 }), '#ffd23f') + D.f(L.sparkle(470, 220, 22, { squash: 0.16 }), '#ffd23f');
  return s;
});

piece('fliege', 'Fliege', 660, 340, ['Fliege', 'Krawatte', 'Smoking', 'Junggesellenabschied', 'Gala', 'Herrenabend', 'Anzug', 'Casino', 'Feier'], () => {
  const RED = '#7a1230';
  let s = D.f(new Path().M(30, 40).C(86, 130, 86, 210, 30, 300).L(296, 205).L(296, 135).Z(), RED);
  s += D.f(new Path().M(630, 40).C(574, 130, 574, 210, 630, 300).L(364, 205).L(364, 135).Z(), RED);
  [[100, 120], [150, 180], [100, 230], [200, 150], [190, 215], [230, 175], [560, 120], [510, 180], [560, 230], [460, 150], [470, 215], [430, 175]].forEach(([x, y]) => { s += D.c(x, y, 8, '#ffffff', { opacity: 0.9 }); });
  s += D.r(276, 110, 108, 120, 24, mix(RED, '#000000', 0.2)) + D.r(300, 120, 14, 100, 7, '#ffffff', { opacity: 0.18 });
  return s;
});

piece('sonnenschirm', 'Sonnenschirm', 720, 800, ['Sonnenschirm', 'Strand', 'Sommer', 'Urlaub', 'Ruhestand', 'Ferien', 'Gartenparty', 'Schirm', 'Sonne'], () => {
  const A = [360, 80];
  let s = D.r(352, 330, 16, 420, 6, '#8a5a2b') + D.e(360, 764, 210, 34, 0, '#f1d79a');
  const base = (k) => [60 + k * 100, 330];
  for (let k = 0; k < 6; k++) {
    const b0 = base(k), b1 = base(k + 1);
    const c0 = [b0[0], A[1] + 60], c1 = [b1[0], A[1] + 60];
    const p = new Path().M(A[0], A[1]).Q(c0[0], c0[1], b0[0], b0[1]).Q((b0[0] + b1[0]) / 2, 330 + 70, b1[0], b1[1]).Q(c1[0], c1[1], A[0], A[1]).Z();
    s += D.f(p, k % 2 ? '#fff3d6' : '#ff5a4a');
  }
  s += D.c(360, 74, 16, '#c9a04e');
  return s;
});

piece('croissant', 'Croissant', 720, 440, ['Croissant', 'Brunch', 'Frühstück', 'Bäckerei', 'Gebäck', 'Hörnchen', 'Café', 'Backen'], () => {
  const cx = 360, cy = 520, R = 240;
  let s = '';
  [[-66, 58, 78], [66, 58, 78], [-34, 88, 100], [34, 88, 100], [0, 112, 112]].forEach(([ang, rr, tt]) => {
    const a = rad(-90 + ang * 0.95), x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
    const rot = -90 + ang * 0.95;
    const d = at(x, y, rot, 1);
    s += d.e(0, 0, rr, tt, 0, '#c97f2c') + d.e(-4, 0, rr - 8, tt - 8, 0, '#e3a047') + d.e(-rr * 0.25, -tt * 0.2, rr * 0.5, tt * 0.45, 0, '#f4c677', { opacity: 0.8 });
  });
  return s;
});

piece('lichterkette-warm', 'Lichterkette warm', 1400, 330, ['Lichterkette', 'Lichter', 'Gartenparty', 'Sommerfest', 'Abend', 'Terrasse', 'Glühbirnen', 'Hochzeit', 'Beleuchtung'], () => {
  const sag = (t) => 30 + 120 * Math.sin(Math.PI * t);
  const cv = new L.Curve(Array.from({ length: 14 }, (_, i) => [30 + (1340 * i) / 13, sag(i / 13)]));
  let s = D.f(L.ribbon(cv, () => 5, { count: 50 }), '#3a3a44');
  const cols = ['#ffd36b', '#ffb347', '#fff0b0', '#ffc65c'];
  for (let i = 0; i < 9; i++) {
    const q = cv.at((i + 0.5) / 9);
    const [x, y] = q.p;
    const col = cols[i % cols.length];
    s += D.c(x, y + 62, 62, col, { opacity: 0.2 });
    s += D.r(x - 11, y + 4, 22, 24, 5, '#3a3a44') + D.e(x, y + 60, 25, 34, 0, col) + D.e(x - 8, y + 50, 6, 10, 20, '#ffffff', { opacity: 0.7 });
  }
  return s;
});

piece('dolch', 'Dolch', 280, 820, ['Dolch', 'Messer', 'Krimi', 'Krimidinner', 'Mord', 'Tatwaffe', 'Mittelalter', 'Verbrechen', 'Spannung'], () => {
  let s = D.c(140, 50, 34, '#c9a04e') + D.c(140, 50, 14, '#d8283c');
  s += D.r(118, 80, 44, 130, 12, '#3b2a20');
  for (let i = 0; i < 5; i++) s += D.l(118, 100 + i * 24, 162, 114 + i * 24, '#c9a04e', 5);
  s += D.r(26, 208, 228, 36, 18, '#c9a04e') + D.c(26, 226, 20, '#e3c479') + D.c(254, 226, 20, '#e3c479');
  s += D.p([[96, 244], [184, 244], [184, 650], [140, 790], [96, 650]], '#cfd6e2');
  s += D.p([[140, 244], [184, 244], [184, 650], [140, 790]], '#aeb8c9');
  s += D.p([[136, 560], [150, 560], [140, 760]], '#d8283c', { opacity: 0.9 });
  return s;
});

piece('detektiv-silhouette', 'Detektiv-Silhouette', 440, 900, ['Detektiv', 'Silhouette', 'Krimi', 'Krimidinner', 'Trenchcoat', 'Hut', 'Ermittler', 'Film noir', 'Spion'], () => {
  const INK = '#17181f';
  let s = D.f(new Path().M(60, 890).L(88, 340).C(100, 262, 150, 244, 220, 244).C(290, 244, 340, 262, 352, 340).L(380, 890).Z(), INK);
  s += D.p([[170, 244], [220, 350], [100, 310]], '#2d3040') + D.p([[270, 244], [220, 350], [340, 310]], '#2d3040');
  s += D.r(60, 560, 320, 26, 4, '#2d3040') + D.r(204, 552, 32, 42, 6, '#c9a04e');
  s += D.l(220, 350, 220, 890, '#2d3040', 5);
  s += D.c(220, 205, 66, INK);
  s += D.f(ellipsePath(220, 150, 190, 34, 0), INK) + D.r(124, 28, 192, 124, 52, INK) + D.r(124, 108, 192, 34, 0, '#3a3d4d');
  return s;
});

piece('boombox', 'Radiorekorder', 820, 540, ['Radio', 'Boombox', 'Ghettoblaster', '80er', '90er', 'Musik', 'Retro', 'Kassettenrekorder', 'Party'], () => {
  const BODY = '#3b4058', DARK = '#1b1d26';
  let s = D.s(new Path().M(200, 130).L(200, 90).Q(200, 50, 240, 50).L(580, 50).Q(620, 50, 620, 90).L(620, 130), '#8d93a8', 24);
  s += D.r(30, 120, 760, 400, 38, BODY);
  [[200, 340], [620, 340]].forEach(([x, y]) => {
    s += D.c(x, y, 128, DARK) + D.c(x, y, 100, 'none', { stroke: '#4a5068', 'stroke-width': 8 }) + D.c(x, y, 48, '#8d93a8') + D.c(x, y, 22, DARK);
    s += D.c(x, y - 148 + 40, 0.1, DARK) + D.c(x, 190, 22, '#8d93a8') + D.c(x, 190, 12, DARK);
  });
  s += D.r(340, 168, 140, 100, 14, DARK) + D.r(356, 184, 108, 56, 28, '#6b7390') + D.c(384, 212, 16, DARK) + D.c(436, 212, 16, DARK);
  s += D.r(344, 296, 132, 36, 6, '#2fd0e6');
  for (let i = 0; i < 9; i++) s += D.r(352 + i * 14, 322 - (i % 4) * 5 - 6, 8, (i % 4) * 5 + 6, 2, DARK);
  ['#ff4fa3', '#ffc93c', '#ff4fa3', '#ffc93c', '#2fd0e6'].forEach((col, i) => { s += D.r(346 + i * 28, 360, 22, 30, 5, col); });
  s += D.c(372, 440, 22, DARK) + D.c(448, 440, 22, DARK) + D.l(372, 428, 372, 440, '#ffffff', 4) + D.l(448, 428, 454, 438, '#ffffff', 4);
  return s;
});

// @@END
module.exports = { pieces };
