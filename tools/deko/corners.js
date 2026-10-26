'use strict';
// Corner ornaments of the Deko pack: each function draws the TOP LEFT corner in a 400 x 400 box (the corner of the page is at 0,0; content hugs the two edges and
// leaves the inside free). Frames reuse them (mirrored at the four corners), the group "Ecken" offers them as they are.
const L = require('./lib');
const M = require('./motifs');
const { Curve, Path, g, path, circle, rad, lerp, place, leaf, ribbon } = L;
const { curlArm, DIAG } = require('./flourish');

/** Points of a spiral: from radius r0 to r1 over `turns` turns, starting at angle a0 (degrees), dir +1 clockwise on screen. */
function spiralPts(cx, cy, r0, r1, turns, a0, dir = 1, steps = 22) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = rad(a0 + dir * turns * 360 * t);
    const rr = lerp(r0, r1, Math.pow(t, 0.85));
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return pts;
}

/** A tapering scroll stroke: arm points, then a spiral that continues it. Returns { svg path string } using the brush ribbon. */
function scrollStroke(pts, w0, w1, bulb = 6.5) {
  const curve = new Curve(pts);
  let s = path(ribbon(curve, (t) => lerp(w0, w1, Math.pow(t, 0.9)), { count: Math.max(14, Math.round(curve.length / 14)) }), {});
  const end = curve.at(1).p;
  if (bulb) s += circle(end[0], end[1], bulb, {});
  return s;
}

/** Decorative scroll corner: two arms along the edges that end in curls, a small counter curl on each, a diamond in the corner. */
function scrollCorner(p, r) {
  const arm = () => {
    const a = curlArm([40, 40], 0, { len: 236, bow: 12, R: 44, r: 7, turns: 1.45, side: 1, w0: 2.5, wmax: 11, w1: 2, bulb: 6, widest: 0.42 });
    const b = curlArm([104, 46], 64, { len: 62, bow: -5, R: 25, r: 5, turns: 1.3, side: -1, w0: 2.2, wmax: 6, w1: 1.6, bulb: 4.5, widest: 0.4 });
    const lf = leaf(64, 15, { belly: 0.42, sharp: 0.75, tip: 0.2, bend: 0.06 });
    return a.svg + b.svg + M.leafEl(lf, place(176, 52, 38, 1), p, {}) + M.leafEl(leaf(52, 12, { belly: 0.42, sharp: 0.75 }), place(236, 52, 52, 1), p, {});
  };
  const one = arm();
  let s = one + `<g transform="${DIAG}">${one}</g>`;
  s += path(L.poly([[26, 6], [46, 26], [26, 46], [6, 26]], true), {});
  s += M.leafEl(leaf(84, 20, { belly: 0.42, sharp: 0.75, tip: 0.15, bend: 0.05 }), place(62, 62, 45, 1), p, {});
  s += circle(100, 100, 6, {});
  return g({ fill: p.ink }, s);
}

/** Leafy vine along both edges with a curl and berries. */
function vineCorner(p, r) {
  let s = '';
  // draw one side, then the other mirrored along the diagonal
  const one = (() => {
    const curve = new Curve([[96, 84], [150, 70], [200, 78], [262, 64], [326, 72], [376, 58]]);
    let out = path(M.stem(curve, 7, 1.8), {});
    const body = M.leavesAlong(curve, {
      n: 10, t0: 0.12, t1: 0.94, mode: 'alt', p, r, spread: () => 54, len: (t) => lerp(82, 48, t), wid: (t) => lerp(82, 48, t) * 0.24,
      shape: (rr, t, sd) => leaf(lerp(82, 48, t), lerp(82, 48, t) * 0.24, { belly: 0.42, sharp: 0.7, asym: rr.jitter(0.1), tip: rr.jitter(0.2), bend: sd * 0.05 }),
    });
    out += body.svg;
    // berries on stalks
    const berries = new Path();
    for (const t of [0.3, 0.52, 0.78]) {
      const q = curve.at(t);
      const a = rad(q.angle + 80);
      const bx = q.p[0] + Math.cos(a) * 38, by = q.p[1] + Math.sin(a) * 38;
      out += path(M.stem([q.p, [bx, by]], 2.6, 1.8, { count: 6 }), {});
      berries.add(L.circlePath(bx, by, 8.5));
    }
    out += path(berries, { fill: p.mono ? p.tones[0] : p.colors[0] });
    return out;
  })();
  s = one + `<g transform="matrix(0 1 1 0 0 0)">${one}</g>`;
  // small curl at the corner
  s += scrollStroke(spiralPts(52, 52, 26, 6, 1.4, 40, -1), 8, 2, 5);
  return g({ fill: p.leaf }, s);
}

/** Art déco: stepped lines and concentric quarter circles around the corner, with diamonds. */
function decoCorner(p) {
  const ink = p.ink;
  const sw = { fill: 'none', stroke: ink, 'stroke-linecap': 'butt' };
  let s = '';
  for (const [rr, w] of [[64, 3], [96, 7], [128, 3], [160, 3]]) s += path(new Path().arc(0, 0, rr, rr, 0, 90, true), { ...sw, 'stroke-width': w });
  const rays = new Path();
  for (let a = 15; a < 90; a += 15) { const c = Math.cos(rad(a)), sn = Math.sin(rad(a)); rays.M(c * 100, sn * 100).L(c * 124, sn * 124); }
  s += path(rays, { ...sw, 'stroke-width': 3.2 });
  s += path(new Path().M(10, 280).L(10, 10).L(280, 10), { ...sw, 'stroke-width': 4, 'stroke-linejoin': 'miter' });
  s += path(new Path().M(26, 240).L(26, 26).L(240, 26), { ...sw, 'stroke-width': 2, 'stroke-linejoin': 'miter' });
  for (const [x, y] of [[280, 10], [10, 280]]) s += path(L.poly([[x, y - 13], [x + 13, y], [x, y + 13], [x - 13, y]], true), { fill: ink });
  for (const [x, y] of [[240, 26], [26, 240]]) s += circle(x, y, 5, { fill: ink });
  s += path(L.poly([[0, 26], [26, 0], [52, 26], [26, 52]], true), { fill: ink });
  return s;
}

/** A floral corner: a bloom with leaves along both edges. */
function floralCorner(p, r) {
  let s = '';
  const sprig = (swap) => {
    const curve = new Curve([[130, 120], [196, 96], [260, 86], [310, 74], [348, 66]]);
    let out = path(M.stem(curve, 6, 1.6), {});
    const body = M.leavesAlong(curve, {
      n: 7, t0: 0.18, t1: 0.96, mode: 'pair', p, r, spread: () => 44, len: (t) => lerp(78, 44, t), wid: (t) => lerp(78, 44, t) * 0.24,
      shape: (rr, t, sd) => leaf(lerp(78, 44, t), lerp(78, 44, t) * 0.24, { belly: 0.42, sharp: 0.7, asym: rr.jitter(0.1), tip: rr.jitter(0.2), bend: sd * 0.05 }),
    });
    return out + body.svg;
  };
  const leaves = sprig(false);
  s += g({ fill: p.leaf }, leaves, `<g transform="${DIAG}">${leaves}</g>`);
  // buds on stalks
  const budsA = [[232, 128, 10], [316, 104, 8], [128, 232, 10], [104, 316, 8]];
  for (const [x, y, rr] of budsA) s += circle(x, y, rr, { fill: p.mono ? p.tones[1] : p.colors[1] });
  s += M.flower('blossom', 244, 58, 38, p, r, { rot: 12, i: 1 });
  s += M.flower('blossom', 58, 244, 38, p, r, { rot: 40, i: 2 });
  s += M.flower('peony', 120, 120, 86, p, r, { rot: 8, i: 0 });
  s += M.flower('daisy', 330, 44, 28, p, r, { rot: 4, i: 3 });
  s += M.flower('daisy', 44, 330, 28, p, r, { rot: 4, i: 3 });
  return s;
}

/** A laurel branch along each edge. */
function laurelCorner(p, r) {
  const one = (() => {
    const curve = new Curve([[132, 94], [190, 82], [244, 76], [292, 68], [330, 62]]);
    return M.laurelBranch(curve, p, r, { n: 7, len0: 76, len1: 46, stemW: 6, t0: 0.02 });
  })();
  const corner = M.leafEl(leaf(86, 21, { belly: 0.42, sharp: 0.75, tip: 0.15, bend: 0.05 }), place(60, 60, 45, 1), p, {}) + M.leafEl(leaf(64, 16, { belly: 0.42, sharp: 0.75 }), place(70, 70, 14, 1), p, {}) + M.leafEl(leaf(64, 16, { belly: 0.42, sharp: 0.75 }), place(70, 70, 76, 1, true), p, { flip: true });
  return g({ fill: p.leaf }, one, `<g transform="${DIAG}">${one}</g>`, corner);
}

/** Eucalyptus stems along each edge. */
function eucalyptusCorner(p, r) {
  const one = (() => {
    const curve = new Curve([[110, 100], [170, 106], [236, 86], [304, 92], [360, 72]]);
    return M.eucalyptusStem(curve, p, r, { n: 8, len0: 70, len1: 42, stemW: 5 });
  })();
  return g({ fill: p.leaf }, one, `<g transform="${DIAG}">${one}</g>`);
}

/** A bracket: a thick and a thin L line with a diamond at the corner and dots at the ends. */
function bracketCorner(p) {
  const sw = { fill: 'none', stroke: p.ink, 'stroke-linecap': 'butt', 'stroke-linejoin': 'miter' };
  let s = path(new Path().M(8, 300).L(8, 8).L(300, 8), { ...sw, 'stroke-width': 8 });
  s += path(new Path().M(30, 240).L(30, 30).L(240, 30), { ...sw, 'stroke-width': 2.5 });
  s += path(L.poly([[48, 62], [62, 48], [76, 62], [62, 76]], true), { fill: p.ink });
  s += circle(300, 8, 7, { fill: p.ink });
  s += circle(8, 300, 7, { fill: p.ink });
  s += circle(240, 30, 4.5, { fill: p.ink });
  s += circle(30, 240, 4.5, { fill: p.ink });
  return s;
}

/** Confetti falling into the corner. */
function confettiCorner(p, r) {
  let s = '';
  const pts = L.scatter(r, { box: [10, 10, 390, 390], count: 60, minDist: 38, accept: (x, y) => x + y < 430 && (Math.hypot(x, y) < 330) });
  pts.forEach(([x, y], i) => {
    const col = p.colors[i % p.colors.length];
    const size = r.range(16, 30) * (1.15 - (x + y) / 700);
    const kind = i % 5;
    const rot = r.range(0, 180);
    if (kind === 0) s += circle(x, y, size * 0.5, { fill: col });
    else if (kind === 1) s += path(L.rrect(-size * 0.7, -size * 0.28, size * 1.4, size * 0.56, 2).transform(place(x, y, rot, 1)), { fill: col });
    else if (kind === 2) s += path(L.poly([[0, -size * 0.7], [size * 0.62, size * 0.5], [-size * 0.62, size * 0.5]], true).transform(place(x, y, rot, 1)), { fill: col });
    else if (kind === 3) s += path(L.smooth([[-size, 0], [-size * 0.5, -size * 0.42], [0, 0], [size * 0.5, size * 0.42], [size, 0]]).transform(place(x, y, rot, 1)), { fill: 'none', stroke: col, 'stroke-width': 3.2, 'stroke-linecap': 'round' });
    else s += path(L.starPath(0, 0, size * 0.7, size * 0.3, 5, -90).transform(place(x, y, rot, 1)), { fill: col });
  });
  return s;
}

/** Stars and sparkles in the corner. */
function starCorner(p, r) {
  let s = '';
  const specs = [[70, 70, 46, 4], [180, 52, 24, 4], [54, 186, 24, 4], [270, 36, 14, 4], [36, 272, 14, 4], [128, 128, 16, 4], [330, 22, 8, 4], [22, 330, 8, 4]];
  specs.forEach(([x, y, rr], i) => { s += path(L.sparkle(x, y, rr, { squash: 0.2 }), {}); });
  const dots = [[116, 44, 5], [44, 116, 5], [236, 98, 5], [98, 236, 5], [190, 150, 4], [150, 190, 4], [310, 90, 3.5], [90, 310, 3.5], [374, 40, 3.5], [40, 374, 3.5]];
  for (const [x, y, rr] of dots) s += circle(x, y, rr, {});
  return g({ fill: p.ink }, s);
}

module.exports = { scrollCorner, vineCorner, decoCorner, floralCorner, laurelCorner, eucalyptusCorner, bracketCorner, confettiCorner, starCorner, spiralPts, scrollStroke };
