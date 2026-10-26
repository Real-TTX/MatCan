'use strict';
// Helpers of the Deko pack generators: seeded random numbers, matrices, a small path class (written as compact relative SVG path data), smooth curves
// (Catmull-Rom to Bézier), tapering ribbons (brush-like strokes of variable width), leaf / petal shapes, branches, scatter with a Poisson-disc feel,
// palettes and the SVG writer. Everything is deterministic: the same piece always gives the same bytes.

const TAU = Math.PI * 2;
const rad = (d) => d * Math.PI / 180;
const deg = (r) => r * 180 / Math.PI;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ------------------------------------------------------------------ random
function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

function rng(seed) {
  let a = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
  const next = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const o = {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => Math.floor(lo + (hi - lo + 1) * next()),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    sign: () => (next() < 0.5 ? -1 : 1),
    jitter: (amount) => (next() * 2 - 1) * amount,
    chance: (p) => next() < p,
    gauss: () => { let s = 0; for (let i = 0; i < 4; i++) s += next(); return (s - 2) / 0.577; },
    shuffle: (arr) => { const c = arr.slice(); for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } return c; },
  };
  return o;
}

// ------------------------------------------------------------------ matrices: [a b c d e f] like SVG; compose(a, b) applies b first
const IDENT = [1, 0, 0, 1, 0, 0];
const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const compose = (...ms) => ms.reduce(mul, IDENT);
const move = (x, y) => [1, 0, 0, 1, x, y];
const rotm = (degrees) => { const a = rad(degrees), c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c, 0, 0]; };
const scl = (sx, sy = sx) => [sx, 0, 0, sy, 0, 0];
/** Place something that is drawn at the origin (pointing +x): at (x, y), rotated, scaled, optionally mirrored vertically (flip). */
const place = (x, y, rot = 0, s = 1, flip = false) => compose(move(x, y), rotm(rot), scl(s, flip ? -s : s));
const ap = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];

// ------------------------------------------------------------------ number formatting
let PREC = 1;
const setPrecision = (p) => { PREC = p; };
function rnd(v, prec = PREC) { const f = 10 ** prec; const r = Math.round(v * f) / f; return Object.is(r, -0) ? 0 : r; }
function num(v, prec = PREC) {
  let s = String(rnd(v, prec));
  if (s.startsWith('0.')) s = s.slice(1);
  else if (s.startsWith('-0.')) s = '-' + s.slice(2);
  return s;
}
/** Plain number for attributes (keeps the leading zero, no exponent). */
const n = (v, prec = PREC) => String(rnd(v, prec));

// ------------------------------------------------------------------ paths
class Path {
  constructor() { this.o = []; }
  M(x, y) { this.o.push(['M', x, y]); return this; }
  L(x, y) { this.o.push(['L', x, y]); return this; }
  C(x1, y1, x2, y2, x, y) { this.o.push(['C', x1, y1, x2, y2, x, y]); return this; }
  Q(x1, y1, x, y) { this.o.push(['Q', x1, y1, x, y]); return this; }
  Z() { this.o.push(['Z']); return this; }
  add(other) { for (const op of other.o) this.o.push(op.slice()); return this; }
  clone() { return new Path().add(this); }
  get empty() { return this.o.length === 0; }
  transform(m) {
    const p = new Path();
    for (const [c, ...a] of this.o) {
      const q = [];
      for (let i = 0; i < a.length; i += 2) { const [x, y] = ap(m, [a[i], a[i + 1]]); q.push(x, y); }
      p.o.push([c, ...q]);
    }
    return p;
  }
  /** Moves every point through fn([x, y]) -> [x, y] (bending, waves ...). */
  map(fn) {
    const p = new Path();
    for (const [c, ...a] of this.o) {
      const q = [];
      for (let i = 0; i < a.length; i += 2) { const r = fn([a[i], a[i + 1]]); q.push(r[0], r[1]); }
      p.o.push([c, ...q]);
    }
    return p;
  }
  /**
   * Appends an elliptical arc (degrees, 0 = right, increasing = clockwise on screen) as cubic segments; it starts with M when the path is empty or move is true,
   * else it continues with a line to the start point of the arc when that is not the current point.
   */
  arc(cx, cy, rx, ry, a0, a1, move = false) {
    if (ry === undefined || ry === null) ry = rx;
    const pt = (a) => [cx + rx * Math.cos(rad(a)), cy + ry * Math.sin(rad(a))];
    const s0 = pt(a0);
    if (move || this.o.length === 0) this.M(s0[0], s0[1]);
    else {
      const last = this.o[this.o.length - 1];
      const lx = last[last.length - 2], ly = last[last.length - 1];
      if (Math.hypot(lx - s0[0], ly - s0[1]) > 0.01) this.L(s0[0], s0[1]);
    }
    const total = a1 - a0;
    const n = Math.max(1, Math.ceil(Math.abs(total) / 90));
    const step = total / n;
    for (let i = 0; i < n; i++) {
      const t0 = rad(a0 + step * i), t1 = rad(a0 + step * (i + 1));
      const k = (4 / 3) * Math.tan((t1 - t0) / 4);
      const p0 = [Math.cos(t0), Math.sin(t0)], p1 = [Math.cos(t1), Math.sin(t1)];
      this.C(cx + rx * (p0[0] - k * p0[1]), cy + ry * (p0[1] + k * p0[0]), cx + rx * (p1[0] + k * p1[1]), cy + ry * (p1[1] - k * p1[0]), cx + rx * p1[0], cy + ry * p1[1]);
    }
    return this;
  }
  /** A dot: a zero length stroke (draw the path with a round line cap and stroke-width = the diameter). */
  dot(x, y) { return this.M(x, y).L(x + 0.1, y); }
  /** Appends Bézier segments through the points, starting at pts[0] (the current point must be pts[0]). */
  through(pts, closed = false) {
    const k = 1 / 6, cnt = pts.length;
    const get = (i) => (closed ? pts[((i % cnt) + cnt) % cnt] : pts[clamp(i, 0, cnt - 1)]);
    const segs = closed ? cnt : cnt - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      this.C(p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k, p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k, p2[0], p2[1]);
    }
    return this;
  }
  /** Compact relative path data; the rounded absolute position is tracked so that rounding errors do not add up. */
  d(prec = PREC) {
    const f = 10 ** prec;
    const rd = (v) => { const r = Math.round(v * f) / f; return Object.is(r, -0) ? 0 : r; };
    let out = '', last = '', cx = 0, cy = 0, sx = 0, sy = 0;
    const push = (s) => {
      if (out.length && !s.startsWith('-') && /[0-9.]$/.test(out)) out += ' ';
      out += s;
    };
    const cmd = (c) => { if (c !== last) { out += c; last = c; } };
    const fmt = (v) => { let s = String(rd(v)); if (s.startsWith('0.')) s = s.slice(1); else if (s.startsWith('-0.')) s = '-' + s.slice(2); return s; };
    for (const op of this.o) {
      const c = op[0];
      if (c === 'M') {
        const x = rd(op[1]), y = rd(op[2]);
        out += (out.length ? 'M' : 'M'); last = 'M'; push(fmt(x)); push(fmt(y));
        cx = x; cy = y; sx = x; sy = y;
      } else if (c === 'L') {
        const x = rd(op[1]), y = rd(op[2]);
        const dx = rd(x - cx), dy = rd(y - cy);
        if (dx === 0 && dy === 0) continue;
        if (dy === 0) { cmd('h'); push(fmt(dx)); } else if (dx === 0) { cmd('v'); push(fmt(dy)); } else { cmd('l'); push(fmt(dx)); push(fmt(dy)); }
        cx = x; cy = y;
      } else if (c === 'C') {
        const x1 = rd(op[1]), y1 = rd(op[2]), x2 = rd(op[3]), y2 = rd(op[4]), x = rd(op[5]), y = rd(op[6]);
        cmd('c');
        for (const v of [x1 - cx, y1 - cy, x2 - cx, y2 - cy, x - cx, y - cy]) push(fmt(rd(v)));
        cx = x; cy = y;
      } else if (c === 'Q') {
        const x1 = rd(op[1]), y1 = rd(op[2]), x = rd(op[3]), y = rd(op[4]);
        cmd('q');
        for (const v of [x1 - cx, y1 - cy, x - cx, y - cy]) push(fmt(rd(v)));
        cx = x; cy = y;
      } else if (c === 'Z') {
        cmd('z'); last = 'z'; cx = sx; cy = sy;
      }
    }
    return out;
  }
}

const P = () => new Path();

/** Smooth open or closed curve through the points. */
function smooth(pts, closed = false) {
  const p = new Path();
  if (pts.length < 2) return p;
  p.M(pts[0][0], pts[0][1]).through(pts, closed);
  if (closed) p.Z();
  return p;
}

/** Polyline path. */
function poly(pts, closed = true) {
  const p = new Path();
  pts.forEach((q, i) => (i ? p.L(q[0], q[1]) : p.M(q[0], q[1])));
  if (closed) p.Z();
  return p;
}

const circlePath = (cx, cy, r) => {
  const k = 0.5522847498 * r;
  return new Path().M(cx + r, cy).C(cx + r, cy + k, cx + k, cy + r, cx, cy + r).C(cx - k, cy + r, cx - r, cy + k, cx - r, cy)
    .C(cx - r, cy - k, cx - k, cy - r, cx, cy - r).C(cx + k, cy - r, cx + r, cy - k, cx + r, cy).Z();
};
const ellipsePath = (cx, cy, rx, ry, rot = 0) => {
  const kx = 0.5522847498 * rx, ky = 0.5522847498 * ry;
  const p = new Path().M(rx, 0).C(rx, ky, kx, ry, 0, ry).C(-kx, ry, -rx, ky, -rx, 0).C(-rx, -ky, -kx, -ry, 0, -ry).C(kx, -ry, rx, -ky, rx, 0).Z();
  return p.transform(place(cx, cy, rot, 1));
};
/** Rounded rectangle (r clamped). */
function rrect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  const k = r * 0.4477152502;
  const p = new Path().M(x + r, y).L(x + w - r, y).C(x + w - k, y, x + w, y + k, x + w, y + r).L(x + w, y + h - r)
    .C(x + w, y + h - k, x + w - k, y + h, x + w - r, y + h).L(x + r, y + h).C(x + k, y + h, x, y + h - k, x, y + h - r)
    .L(x, y + r).C(x, y + k, x + k, y, x + r, y).Z();
  return p;
}

// ------------------------------------------------------------------ curves sampled by arc length
function sampleBezier(p0, p1, p2, p3, steps, out) {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
}
/** Dense points along the cubic and quadratic segments of a path (all subpaths in order). */
function samplePath(p, per = 14) {
  const out = [];
  let cur = [0, 0];
  for (const op of p.o) {
    if (op[0] === 'M' || op[0] === 'L') { cur = [op[1], op[2]]; out.push(cur.slice()); }
    else if (op[0] === 'C') { sampleBezier(cur, [op[1], op[2]], [op[3], op[4]], [op[5], op[6]], per, out); cur = [op[5], op[6]]; }
    else if (op[0] === 'Q') { sampleBezier(cur, [cur[0] + (op[1] - cur[0]) * 2 / 3, cur[1] + (op[2] - cur[1]) * 2 / 3], [op[3] + (op[1] - op[3]) * 2 / 3, op[4] + (op[2] - op[4]) * 2 / 3], [op[3], op[4]], per, out); cur = [op[3], op[4]]; }
  }
  return out;
}
/** Dense points along the smooth curve through pts. */
function sampleSmooth(pts, closed = false, per = 16) {
  const out = [pts[0].slice()];
  const k = 1 / 6, cnt = pts.length;
  const get = (i) => (closed ? pts[((i % cnt) + cnt) % cnt] : pts[clamp(i, 0, cnt - 1)]);
  const segs = closed ? cnt : cnt - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    sampleBezier(p1, [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k], [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k], p2, per, out);
  }
  return out;
}
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** A curve you can ask for a point and a direction at the fraction t of its length. */
class Curve {
  constructor(pts, closed = false) {
    this.pts = sampleSmooth(pts, closed, 24);
    this.cum = [0];
    for (let i = 1; i < this.pts.length; i++) this.cum.push(this.cum[i - 1] + dist(this.pts[i - 1], this.pts[i]));
    this.length = this.cum[this.cum.length - 1];
  }
  at(t) {
    t = clamp(t, 0, 1);
    const target = t * this.length;
    let lo = 0, hi = this.cum.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (this.cum[mid] <= target) lo = mid; else hi = mid; }
    const a = this.pts[lo], b = this.pts[hi], seg = this.cum[hi] - this.cum[lo] || 1;
    const u = (target - this.cum[lo]) / seg;
    const tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1;
    return { p: [lerp(a[0], b[0], u), lerp(a[1], b[1], u)], tan: [tx / tl, ty / tl], angle: deg(Math.atan2(ty, tx)) };
  }
  points(count) { const out = []; for (let i = 0; i < count; i++) out.push(this.at(i / (count - 1)).p); return out; }
}

/**
 * A brush-like stroke: the filled outline of a centre line whose width changes along it. widthFn(t) is the full width at the fraction t.
 * ends: 'round' (a half circle where the width is not zero) or 'flat'. Where the width is (almost) zero the end is a sharp tip.
 */
function ribbon(centre, widthFn, { count = 22, ends = 'round', closed = false } = {}) {
  const curve = centre instanceof Curve ? centre : new Curve(centre, closed);
  const L = [], R = [], C = [], W = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const { p, tan } = curve.at(t);
    const w = Math.max(0, widthFn(t)) / 2;
    const nx = -tan[1], ny = tan[0];
    L.push([p[0] + nx * w, p[1] + ny * w]);
    R.push([p[0] - nx * w, p[1] - ny * w]);
    C.push(p); W.push(w);
  }
  const path = new Path();
  path.M(L[0][0], L[0][1]).through(L);
  const capTo = (from, to, centre_, dir, w) => {
    if (w < 0.35) { path.L(to[0], to[1]); return; }
    if (ends === 'flat') { path.L(to[0], to[1]); return; }
    const k = (4 / 3) * w;
    path.C(from[0] + dir[0] * k, from[1] + dir[1] * k, to[0] + dir[0] * k, to[1] + dir[1] * k, to[0], to[1]);
  };
  const last = count - 1;
  const tEnd = curve.at(1).tan, tStart = curve.at(0).tan;
  capTo(L[last], R[last], C[last], tEnd, W[last]);
  const Rrev = R.slice().reverse();
  path.through(Rrev);
  capTo(R[0], L[0], C[0], [-tStart[0], -tStart[1]], W[0]);
  path.Z();
  return path;
}

// ------------------------------------------------------------------ shapes in local coordinates: base at the origin, pointing +x
/**
 * A leaf: width is the half width at the widest point, belly the position of it (0..1 of the length), tip the sideways offset of the tip (asymmetry),
 * asym makes one side fuller than the other, sharp (0..1) how pointed the tip is, bend curves the whole leaf.
 * Returns { whole, upper, lower, mid } as paths (upper = the half at -y, lower = the half at +y; mid = the midrib).
 */
function leaf(len, wid, { belly = 0.38, tip = 0, asym = 0, sharp = 0.6, bend = 0, round = false } = {}) {
  const wu = wid * (1 + asym), wl = wid * (1 - asym);
  const c1x = len * Math.max(0.02, belly - 0.24);
  const c2x = len * Math.min(0.97, belly + 0.30 + (1 - sharp) * 0.16);
  const h1 = round ? 1.42 : 1.32, h2 = (1.0 + 0.32 * (1 - sharp)) * (round ? 1.12 : 1);
  const tipY = tip * wid;
  const f = (p) => { const u = p[0] / len; return [p[0], p[1] + bend * len * u * u]; };
  const upper = new Path().M(0, 0).C(c1x, -wu * h1, c2x, -wu * h2, len, tipY).Z();
  const lower = new Path().M(0, 0).C(c1x, wl * h1, c2x, wl * h2, len, tipY).Z();
  const whole = new Path().M(0, 0).C(c1x, -wu * h1, c2x, -wu * h2, len, tipY).C(c2x, wl * h2, c1x, wl * h1, 0, 0).Z();
  const mid = new Path().M(0, 0).C(len * 0.33, tipY * 0.33, len * 0.66, tipY * 0.66, len, tipY);
  const w = (path) => (bend ? path.map(f) : path);
  return { whole: w(whole), upper: w(upper), lower: w(lower), mid: w(mid), len, wid };
}

/** A petal: round at the far end, narrow at the base, optionally with a notch (heart-like) at the tip. */
function petal(len, wid, { belly = 0.62, notch = 0, point = 0 } = {}) {
  const b = len * belly;
  const p = new Path().M(0, 0)
    .C(len * 0.12, -wid * 0.55, b - len * 0.28, -wid * 1.05, b, -wid * 0.95)
    .C(len * (belly + 0.2), -wid * 0.86, len * (1 - point * 0.15), -wid * (0.35 - point * 0.25), len, -notch * wid * 0.0);
  if (notch) { p.L(len - notch * len * 0.14, 0); p.L(len, 0); }
  p.C(len * (1 - point * 0.15), wid * (0.35 - point * 0.25), len * (belly + 0.2), wid * 0.86, b, wid * 0.95)
    .C(b - len * 0.28, wid * 1.05, len * 0.12, wid * 0.55, 0, 0).Z();
  return p;
}

/** A teardrop-like petal that is simple and robust: round head at the far end, pointed foot at the origin. */
function drop(len, wid, { head = 0.7, point = 0.0 } = {}) {
  const h = len * head;
  return new Path().M(0, 0)
    .C(len * 0.18, -wid * 0.9, h * 0.6, -wid * 1.25, h, -wid)
    .C(len * (head + 0.18), -wid * 0.8, len, -wid * (0.45 - point * 0.4), len, 0)
    .C(len, wid * (0.45 - point * 0.4), len * (head + 0.18), wid * 0.8, h, wid)
    .C(h * 0.6, wid * 1.25, len * 0.18, wid * 0.9, 0, 0).Z();
}

/** Points of the classic heart curve, centred at (cx, cy), total width w (the tip points down), t from t0 to t1 (0 = the dimple at the top, PI = the tip). */
function heartPts(cx, cy, w, t0 = 0, t1 = Math.PI * 2, steps = 72) {
  const k = w / 32;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = t0 + (t1 - t0) * (i / steps);
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push([cx + x * k, cy - (y - 2.2) * k]);
  }
  return pts;
}
/** Heart outline centred at (cx, cy) with total width w (point down). */
function heart(cx, cy, w) {
  const pts = heartPts(cx, cy, w, 0, Math.PI * 2, 30);
  pts.pop();
  return smooth(pts, true);
}

/** Star with `points` points; inner = ratio of the inner radius. Optional rounded tips are not done: sharp is what is wanted here. */
function starPath(cx, cy, ro, ri, points = 5, rot = -90) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? ro : ri;
    const a = rad(rot + i * 180 / points);
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return poly(pts, true);
}
/** A four-point sparkle with concave sides. */
function sparkle(cx, cy, r, { squash = 0.18, rot = 0, points = 4 } = {}) {
  const p = new Path();
  const step = TAU / points;
  const pts = [];
  for (let i = 0; i < points; i++) {
    const a = rad(rot) + i * step - Math.PI / 2;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  p.M(pts[0][0], pts[0][1]);
  for (let i = 0; i < points; i++) {
    const a = pts[i], b = pts[(i + 1) % points];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const cxp = cx + (mx - cx) * squash * 1.8, cyp = cy + (my - cy) * squash * 1.8;
    p.Q(cxp, cyp, b[0], b[1]);
  }
  return p.Z();
}

// ------------------------------------------------------------------ scatter (Poisson-disc like dart throwing)
/**
 * Points inside the box [x0, y0, x1, y1] that keep at least `minDist` from each other (dart throwing with a seeded generator).
 * accept(x, y) can veto a point (keep-out areas). If it cannot find `count` points it returns what it has.
 */
function scatter(r, { box, count, minDist, accept = () => true, tries = 40 }) {
  const pts = [];
  let miss = 0;
  while (pts.length < count && miss < count * tries) {
    const x = r.range(box[0], box[2]), y = r.range(box[1], box[3]);
    if (!accept(x, y)) { miss++; continue; }
    let ok = true;
    for (const q of pts) { if ((q[0] - x) ** 2 + (q[1] - y) ** 2 < minDist * minDist) { ok = false; break; } }
    if (ok) pts.push([x, y]); else miss++;
  }
  return pts;
}

// ------------------------------------------------------------------ colour helpers
function hex2rgb(h) { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
function mix(a, b, t) {
  const A = hex2rgb(a), B = hex2rgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

// ------------------------------------------------------------------ palettes
const GOLD_STOPS = [[0, '#a2712a'], [0.3, '#d2a84f'], [0.55, '#b3832f'], [0.8, '#dab45c'], [1, '#a2712a']];
function mono(id, label, slug, ink, tones, extra = {}) {
  return { id, label, slug, mono: true, ink, leaf: ink, tones, accent: id === 'weiss' ? '#cdc7b8' : tones[2], colors: [...tones, ink], dark: tones[0], mid: tones[1], light: tones[2], ...extra };
}
const PALETTES = {
  gold: mono('gold', 'Gold', 'gold', 'url(#g)', ['#a9782b', '#c9a04e', '#e3c479'], { gradient: true, solidInk: '#c9a04e', tags: ['Gold', 'golden', 'metallic', 'edel'] }),
  rose: mono('rose', 'Rosé', 'rose', '#c98686', ['#b97a7a', '#d7a2a2', '#ecc8c4'], { tags: ['Rosé', 'rosa', 'altrosa', 'zart'] }),
  salbei: mono('salbei', 'Salbei', 'salbei', '#6f8f75', ['#5f7f66', '#8aa68f', '#b9cdbb'], { tags: ['Salbei', 'grün', 'Salbeigrün', 'natürlich'] }),
  navy: mono('navy', 'Navy', 'navy', '#1f2f5c', ['#1f2f5c', '#3d5189', '#8190b8'], { tags: ['Navy', 'blau', 'dunkelblau', 'marine'] }),
  schwarz: mono('schwarz', 'Schwarz', 'schwarz', '#1c1c1c', ['#1c1c1c', '#4b4b4b', '#8c8c8c'], { tags: ['Schwarz', 'dunkel', 'minimalistisch'] }),
  weiss: mono('weiss', 'Weiß', 'weiss', '#ffffff', ['#d6d1c4', '#ebe7dc', '#ffffff'], { tags: ['Weiß', 'hell', 'für dunklen Hintergrund'] }),
  bordeaux: mono('bordeaux', 'Bordeaux', 'bordeaux', '#8a2a3a', ['#6a1b2b', '#8a2a3a', '#b4535f'], { tags: ['Bordeaux', 'rot', 'weinrot', 'Siegel'] }),
  bunt: { id: 'bunt', label: 'Bunt', slug: 'bunt', mono: false, leaf: '#35a874', ink: '#3a86ff', colors: ['#f2545b', '#ffb627', '#2ec4b6', '#3a86ff', '#8e5cf0', '#ff7eb6'], tags: ['bunt', 'Party', 'fröhlich', 'Kinder'] },
  pastell: { id: 'pastell', label: 'Pastell', slug: 'pastell', mono: false, leaf: '#9cc7ae', ink: '#b9d4f2', colors: ['#f7b7c5', '#fde2a7', '#b8e0d2', '#b9d4f2', '#d4c1ec', '#fbcfb2'], tags: ['Pastell', 'zart', 'sanft', 'Kinder', 'Baby'] },
  herbst: { id: 'herbst', label: 'Herbst', slug: 'herbst', mono: false, leaf: '#8a9a3b', ink: '#c0562b', colors: ['#c0562b', '#e3a02f', '#8a5a2b', '#a8b04a', '#9a3b1d'], tags: ['Herbst', 'Laub', 'warm', 'bunt'] },
  boho: { id: 'boho', label: 'Boho', slug: 'boho', mono: false, leaf: '#8c9a7c', ink: '#c9714f', colors: ['#c9714f', '#e1a96c', '#ecd9b0', '#a9b79a', '#8c9a7c'], tags: ['Boho', 'Terrakotta', 'Erdtöne', 'natürlich'] },
};

/** Gradient definition of the gold palette across a box (userSpaceOnUse: the whole drawing shares one sheen). */
function goldDefs(w, h) {
  const stops = GOLD_STOPS.map(([o, c]) => `<stop offset="${o}" stop-color="${c}" />`).join('');
  return `<linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${n(w)}" y2="${n(h)}">${stops}</linearGradient>`;
}

// ------------------------------------------------------------------ SVG writer (the form SvgSafe writes: one line, `<tag a="b" />` for empty elements)
const escAttr = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function el(tag, attrs, children) {
  let s = '<' + tag;
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    s += ` ${k}="${escAttr(typeof v === 'number' ? n(v, 2) : v)}"`;
  }
  if (children === undefined || children === '' || (Array.isArray(children) && !children.length)) return s + ' />';
  return s + '>' + (Array.isArray(children) ? children.join('') : children) + `</${tag}>`;
}
// The bounding box of everything drawn through path() and circle() is tracked, so a piece can be fitted to its content ("fit" in build.js).
let TRACK = null;
const tracker = {
  start() { TRACK = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }; },
  stop() { const t = TRACK; TRACK = null; return t; },
  /** Reflects the box around the vertical line x = cx (after drawing the half that is then mirrored with a transform). */
  mirrorX(cx) { if (!TRACK) return; const a = 2 * cx - TRACK.x1, b = 2 * cx - TRACK.x0; TRACK.x0 = Math.min(TRACK.x0, a); TRACK.x1 = Math.max(TRACK.x1, b); },
  extend(x, y, pad = 0) { if (!TRACK) return; TRACK.x0 = Math.min(TRACK.x0, x - pad); TRACK.y0 = Math.min(TRACK.y0, y - pad); TRACK.x1 = Math.max(TRACK.x1, x + pad); TRACK.y1 = Math.max(TRACK.y1, y + pad); },
};
function trackPath(p, pad) {
  if (!TRACK) return;
  let cx = 0, cy = 0;
  for (const op of p.o) {
    const c = op[0];
    if (c === 'M' || c === 'L') { tracker.extend(op[1], op[2], pad); cx = op[1]; cy = op[2]; }
    else if (c === 'C') {
      for (let i = 1; i <= 10; i++) {
        const t = i / 10, u = 1 - t;
        tracker.extend(u * u * u * cx + 3 * u * u * t * op[1] + 3 * u * t * t * op[3] + t * t * t * op[5], u * u * u * cy + 3 * u * u * t * op[2] + 3 * u * t * t * op[4] + t * t * t * op[6], pad);
      }
      cx = op[5]; cy = op[6];
    } else if (c === 'Q') {
      for (let i = 1; i <= 8; i++) { const t = i / 8, u = 1 - t; tracker.extend(u * u * cx + 2 * u * t * op[1] + t * t * op[3], u * u * cy + 2 * u * t * op[2] + t * t * op[4], pad); }
      cx = op[3]; cy = op[4];
    }
  }
}
/** A path element from a Path and the paint attributes. */
const path = (p, attrs = {}) => {
  if (typeof p !== 'string') trackPath(p, attrs.stroke && attrs.stroke !== 'none' ? (parseFloat(attrs['stroke-width']) || 1) / 2 : 0);
  return el('path', { d: typeof p === 'string' ? p : p.d(), ...attrs });
};
const circle = (cx, cy, r, attrs = {}) => {
  tracker.extend(cx, cy, r + (attrs.stroke && attrs.stroke !== 'none' ? (parseFloat(attrs['stroke-width']) || 1) / 2 : 0));
  return el('circle', { cx: rnd(cx), cy: rnd(cy), r: rnd(r, 2), ...attrs });
};
const g = (attrs, ...children) => el('g', attrs, children.flat().filter(Boolean));
/** An instance of a symbol defined in <defs> (id): placed with a translation, rotation and scale, painted with fill. */
const useAt = (id, x, y, { rot = 0, s = 1, fill } = {}) => el('use', { href: `#${id}`, transform: `translate(${n(x, 1)} ${n(y, 1)})${rot ? ` rotate(${n(rot, 1)})` : ''}${s !== 1 ? ` scale(${n(s, 3)})` : ''}`, fill });
/**
 * Many dots as a few paths: dots are zero length strokes with round caps; items = [{ x, y, r, fill }] (r is rounded to 0.5, one path per radius and colour).
 * Much smaller than a circle per dot.
 */
function dots(items) {
  const groups = new Map();
  for (const it of items) {
    const r = Math.max(0.5, Math.round(it.r * 2) / 2);
    const key = r + '|' + (it.fill || '');
    if (!groups.has(key)) groups.set(key, { r, fill: it.fill, path: new Path() });
    groups.get(key).path.dot(it.x, it.y);
  }
  return [...groups.values()].map((gr) => path(gr.path, { fill: 'none', stroke: gr.fill || undefined, 'stroke-width': gr.r * 2, 'stroke-linecap': 'round' })).join('');
}
const svgDoc = (w, h, defs, body) =>
  `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`;

module.exports = {
  TAU, rad, deg, lerp, clamp, rng, hashSeed, IDENT, mul, compose, move, rotm, scl, place, ap, setPrecision, rnd, num, n,
  Path, P, samplePath, smooth, poly, heartPts, circlePath, ellipsePath, rrect, sampleSmooth, sampleBezier, Curve, ribbon, leaf, petal, drop, heart, starPath, sparkle, scatter, dist,
  tracker, PALETTES, goldDefs, mix, hex2rgb, el, path, circle, g, useAt, dots, svgDoc, escAttr,
};
