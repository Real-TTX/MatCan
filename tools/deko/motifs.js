'use strict';
// Reusable motifs of the Deko pack: leaves on branches (laurel, olive, eucalyptus, fern, fir), flowers, flourishes, beads. Each function returns SVG strings.
const L = require('./lib');
const { Path, Curve, ribbon, leaf, place, compose, move, rotm, scl, path, circle, g, rad, deg, lerp, clamp, TAU } = L;

/** The darker (or lighter) half-leaf overlay of a palette. */
const SHADE = {
  gold: ['#6e4a12', 0.3], rose: ['#7d3d3d', 0.24], salbei: ['#2a4531', 0.28], navy: ['#ffffff', 0.17], schwarz: ['#ffffff', 0.2],
  weiss: ['#6f6957', 0.2], bordeaux: ['#ffffff', 0.18],
};
const shadeOf = (p) => SHADE[p.id] || ['#000000', 0.14];
const shadeAttrs = (p) => { const s = shadeOf(p); return { fill: s[0], 'fill-opacity': s[1] }; };

/** One leaf (split tone: the lower half in the shade colour) placed with the matrix m. tone = an explicit fill, else the group's. */
function leafEl(lf, m, p, { tone, flip = false, mid = false } = {}) {
  const out = [path(lf.whole.transform(m), tone ? { fill: tone } : {})];
  out.push(path((flip ? lf.upper : lf.lower).transform(m), shadeAttrs(p)));
  if (mid) out.push(path(lf.mid.transform(m), { fill: 'none', stroke: shadeOf(p)[0], 'stroke-opacity': Math.min(0.5, shadeOf(p)[1] + 0.12), 'stroke-width': Math.max(1.4, lf.wid * 0.06), 'stroke-linecap': 'round' }));
  return out.join('');
}

/** A stem: a tapering brush stroke along the points. */
function stem(pts, w0, w1, { closed = false, count } = {}) {
  const curve = pts instanceof Curve ? pts : new Curve(pts, closed);
  return ribbon(curve, (t) => lerp(w0, w1, t), { count: count || Math.max(8, Math.round(curve.length / 32)) });
}

/** Points on an arc (degrees, 0 = right, clockwise on screen). */
function arcPts(cx, cy, rx, ry, a0, a1, step = 15) {
  const pts = [];
  const cnt = Math.max(2, Math.round(Math.abs(a1 - a0) / Math.abs(step)) + 1);
  for (let i = 0; i < cnt; i++) { const a = rad(lerp(a0, a1, i / (cnt - 1))); pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
  return pts;
}

/**
 * Leaves along a curve. mode 'pair' (a leaf on each side at every node) or 'alt' (one leaf, sides alternate).
 * o: n (nodes), t0, t1 (where on the curve), spread(t) degrees from the stem, len(t), wid(t) (half width), shape(r, t, side) -> leaf, tip: a leaf at the end,
 * tipLen, p (palette), tones(t, side, i) -> fill or undefined, rnd (random).
 * Returns { svg, nodes } (nodes: placement of each leaf for berries etc.).
 */
function leavesAlong(curve, o) {
  const { n: count, t0 = 0.1, t1 = 0.97, mode = 'pair', p, r } = o;
  const spread = o.spread || (() => 50), len = o.len || (() => 80), wid = o.wid || ((t) => len(t) * 0.2);
  const shape = o.shape || ((rr, t, side) => leaf(len(t), wid(t), { belly: 0.42, sharp: 0.75, asym: rr.jitter(0.1), tip: rr.jitter(0.2), bend: side * rr.jitter(0.06) }));
  const out = [];
  const nodes = [];
  for (let i = 0; i < count; i++) {
    const t = lerp(t0, t1, count === 1 ? 0 : i / (count - 1)) + (r ? r.jitter(0.008) : 0);
    const { p: pt, angle } = curve.at(t);
    const sides = mode === 'pair' ? [-1, 1] : [i % 2 ? -1 : 1];
    for (const side of sides) {
      const a = angle + side * (spread(t) + (r ? r.jitter(5) : 0));
      const lf = shape(r, t, side);
      const m = place(pt[0], pt[1], a, 1, side > 0);
      out.push(leafEl(lf, m, p, { tone: o.tones ? o.tones(t, side, i) : undefined, flip: side > 0, mid: o.mid }));
      nodes.push({ p: pt, a, t, side, len: lf.len });
    }
  }
  if (o.tip) {
    const { p: pt, angle } = curve.at(1);
    const lf = o.tip(r);
    out.push(leafEl(lf, place(pt[0], pt[1], angle, 1), p, { tone: o.tipTone }));
  }
  return { svg: out.join(''), nodes };
}

/** A laurel branch along the curve (pointed oval leaves in pairs, thick at the base, thin at the tip). */
function laurelBranch(curve, p, r, { n: count = 11, len0 = 92, len1 = 52, spread0 = 58, spread1 = 34, stemW = 7, tones, t0 = 0.06 } = {}) {
  const len = (t) => lerp(len0, len1, t);
  const body = leavesAlong(curve, {
    n: count, t0, t1: 0.95, mode: 'pair', p, r, spread: (t) => lerp(spread0, spread1, t), len,
    wid: (t) => len(t) * lerp(0.23, 0.2, t), tones,
    tip: (rr) => leaf(len1 * 0.95, len1 * 0.2, { belly: 0.42, sharp: 0.8, tip: rr.jitter(0.2) }),
  });
  return path(stem(curve, stemW, 2), {}) + body.svg;
}

/** An olive branch: slender leaves, olives on short stalks. */
function oliveBranch(curve, p, r, { n: count = 12, len0 = 96, len1 = 60, stemW = 5, olives = 4 } = {}) {
  const len = (t) => lerp(len0, len1, t) * (1 + r.jitter(0.08));
  const body = leavesAlong(curve, {
    n: count, t0: 0.1, t1: 0.94, mode: 'alt', p, r, spread: (t) => lerp(48, 32, t), len, wid: (t) => lerp(len0, len1, t) * 0.115,
    shape: (rr, t) => leaf(len(t), lerp(len0, len1, t) * 0.115, { belly: 0.46, sharp: 0.85, asym: rr.jitter(0.12), tip: rr.jitter(0.25), bend: rr.jitter(0.07) }),
    tip: (rr) => leaf(len1, len1 * 0.115, { belly: 0.46, sharp: 0.85, tip: 0.2 }),
  });
  let fruit = '';
  const stalks = [];
  for (let i = 0; i < olives; i++) {
    const t = lerp(0.2, 0.78, i / Math.max(1, olives - 1)) + r.jitter(0.03);
    const { p: pt, angle } = curve.at(t);
    const side = i % 2 ? 1 : -1;
    const a = angle + side * 78;
    const ex = pt[0] + Math.cos(rad(a)) * 34, ey = pt[1] + Math.sin(rad(a)) * 34 + 8;
    stalks.push(path(stem([pt, [ (pt[0] + ex) / 2 + side * 3, (pt[1] + ey) / 2 ], [ex, ey]], 3, 2), {}));
    fruit += path(L.ellipsePath(ex, ey + 16, 12.5, 18, a + 90 + side * 12), { fill: p.tones[0] });
    fruit += path(L.ellipsePath(ex - 3.5, ey + 9, 3, 6, a + 90 + side * 12), { fill: '#ffffff', 'fill-opacity': 0.25 });
  }
  return path(stem(curve, stemW, 1.8), {}) + stalks.join('') + body.svg + fruit;
}

/** A eucalyptus stem: round leaves, alternate, large at the base and small at the tip, tiny stalks. */
function eucalyptusStem(curve, p, r, { n: count = 11, len0 = 74, len1 = 36, stemW = 5 } = {}) {
  const len = (t) => lerp(len0, len1, t) * (1 + r.jitter(0.1));
  const shapes = [];
  const body = leavesAlong(curve, {
    n: count, t0: 0.08, t1: 0.92, mode: 'alt', p, r, mid: true, spread: (t) => lerp(62, 40, t), len,
    shape: (rr, t) => { const l = len(t); const lf = leaf(l, l * 0.4, { belly: 0.5, sharp: 0.1, round: true, asym: rr.jitter(0.08), tip: rr.jitter(0.1) }); shapes.push(lf); return lf; },
    tones: (t, side, i) => (i % 3 === 1 ? p.tones[1] : undefined),
    tip: (rr) => leaf(len1, len1 * 0.4, { belly: 0.5, sharp: 0.1, round: true }),
  });
  return path(stem(curve, stemW, 1.6), {}) + body.svg;
}

/** A fern frond (leaflets decrease towards the tip). */
function fernFrond(curve, p, r, { n: count = 16, maxLen = 110, wid = 0.15, stemW = 5 } = {}) {
  const prof = (t) => Math.sin(Math.PI * Math.pow(t, 0.62)) * 0.8 + 0.22 * (1 - t);
  const len = (t) => maxLen * clamp(prof(t), 0.14, 1);
  const body = leavesAlong(curve, {
    n: count, t0: 0.08, t1: 0.97, mode: 'pair', p, r, spread: (t) => lerp(70, 46, t), len, wid: (t) => len(t) * wid,
    shape: (rr, t, side) => leaf(len(t), len(t) * wid, { belly: 0.45, sharp: 0.7, bend: side * 0.07, tip: rr.jitter(0.1) }),
  });
  return path(stem(curve, stemW, 1.2), {}) + body.svg;
}

/** A slim needle (two quadratic curves), pointing +x. */
const needle = (len, wid, bend = 0) => new Path().M(0, 0).Q(len * 0.5, -wid + bend * len, len, bend * len * 0.6).Q(len * 0.5, wid + bend * len, 0, 0).Z();

/** Needles along a curve (one path for all of them). */
function needlesAlong(curve, p, r, { n: count = 30, len0 = 70, len1 = 30, spread = 52, stemW = 6, wid = 0.075, from = 0.04 } = {}) {
  const all = new Path();
  for (let i = 0; i < count; i++) {
    const t = lerp(from, 0.99, i / (count - 1));
    const { p: pt, angle } = curve.at(t);
    for (const side of [-1, 1]) {
      const a = angle + side * (spread + r.jitter(5));
      const l = lerp(len0, len1, Math.pow(t, 1.1)) * (1 + r.jitter(0.12));
      all.add(needle(l, l * wid, side * 0.02).transform(place(pt[0], pt[1], a, 1)));
    }
  }
  return path(stem(curve, stemW, 1.4), {}) + path(all, {});
}

/** A fir branch: a main stem with side twigs that carry needles. */
function firBranch(curve, p, r, { twigs = 12, sideLen0 = 230, sideLen1 = 70, spread = 50, needle0 = 46, needle1 = 30, wid = 0.085, per = 13 } = {}) {
  let s = '';
  const all = new Path();
  for (let i = 0; i < twigs; i++) {
    const t = lerp(0.07, 0.93, i / (twigs - 1));
    const { p: pt, angle } = curve.at(t);
    for (const side of (i % 2 ? [1, -1] : [-1, 1])) {
      const len = lerp(sideLen0, sideLen1, Math.pow(t, 0.9)) * (1 + r.jitter(0.12)) * (side > 0 ? 0.94 : 1);
      const a = angle + side * (spread + r.jitter(6));
      const dir = [Math.cos(rad(a)), Math.sin(rad(a))];
      const bendA = rad(a - side * 16);
      const p1 = [pt[0] + dir[0] * len * 0.5, pt[1] + dir[1] * len * 0.5];
      const p2 = [p1[0] + Math.cos(bendA) * len * 0.5, p1[1] + Math.sin(bendA) * len * 0.5];
      const twig = new Curve([pt, p1, p2]);
      const cnt = Math.max(5, Math.round(len / per));
      for (let k = 0; k < cnt; k++) {
        const tt = lerp(0.1, 1, k / (cnt - 1));
        const q = twig.at(tt);
        const nl = lerp(needle0, needle1, t) * lerp(1, 0.55, tt) * (1 + r.jitter(0.1));
        for (const sd of [-1, 1]) {
          all.add(needle(nl, nl * wid, sd * 0.02).transform(place(q.p[0], q.p[1], q.angle + sd * (46 + r.jitter(6)), 1)));
        }
      }
      s += path(stem(twig, 3.2, 1), {});
    }
  }
  return path(stem(curve, 8, 1.6), {}) + s + path(all, {});
}

/** Petal tones and centre colour of flower number i: [outer, mid, inner] light to dark. */
function petalTones(p, i = 0) {
  if (p.mono) return { tones: [p.tones[2], p.tones[1], p.tones[0]], centre: p.tones[0] };
  const base = p.colors[i % p.colors.length];
  return { tones: [L.mix(base, '#ffffff', 0.38), base, L.mix(base, '#000000', 0.2)], centre: L.mix(base, '#000000', 0.45) };
}

/** A single flower seen from the front. kind: daisy, anemone, peony, rose, blossom. tones: [outer, mid, inner] light to dark. Returns SVG. */
function flower(kind, x, y, R, p, r, { rot = 0, tones, centre, i: o_i = 0 } = {}) {
  const pt = petalTones(p, o_i);
  const t = tones || pt.tones;
  const ctr = centre || pt.centre;
  const lineAttrs = { 'stroke': t[2], 'stroke-width': Math.max(1.2, R * 0.012), 'stroke-linejoin': 'round', 'stroke-opacity': 0.55 };
  const veinAttrs = { fill: 'none', stroke: t[2], 'stroke-width': Math.max(1, R * 0.008), 'stroke-linecap': 'round', 'stroke-opacity': 0.5 };
  const veins = R >= 70;
  const at = (a, px = x, py = y) => place(px, py, a, 1);
  // petals are collected per fill colour so that one path holds many petals of one tone
  const layers = [];
  const layer = (fill) => { let l = layers.find((q) => q.fill === fill); if (!l) { l = { fill, path: new Path() }; layers.push(l); } return l.path; };
  const vein = new Path();
  const extra = [];
  if (kind === 'daisy') {
    const cnt = R < 45 ? 13 : 19;
    for (let k = 0; k < cnt; k++) {
      const a = rot + (k / cnt) * 360 + r.jitter(2.5);
      const len = R * (0.97 + r.jitter(0.05));
      layer(t[0]).add(L.drop(len, R * 0.085 * (cnt === 13 ? 1.4 : 1), { head: 0.8 }).transform(at(a)));
      if (veins) vein.add(new Path().M(R * 0.34, 0).L(len * 0.8, 0).transform(at(a)));
    }
    extra.push(circle(x, y, R * 0.3, { fill: ctr }), circle(x, y, R * 0.2, { fill: t[1] }));
    if (R >= 45) { const dd = []; for (let k = 0; k < 9; k++) { const a = rad(k * 40 + rot); dd.push({ x: x + Math.cos(a) * R * 0.12, y: y + Math.sin(a) * R * 0.12, r: R * 0.025, fill: ctr }); } extra.push(L.dots(dd)); }
  } else if (kind === 'anemone') {
    const cnt = 7;
    for (let k = 0; k < cnt; k++) {
      const a = rot + (k / cnt) * 360 + r.jitter(3);
      layer(t[0]).add(L.petal(R, R * 0.46, { belly: 0.66 }).transform(at(a)));
      if (veins) vein.add(new Path().M(R * 0.25, 0).Q(R * 0.55, R * 0.03, R * 0.85, 0).transform(at(a)));
    }
    extra.push(circle(x, y, R * 0.25, { fill: t[1] }), circle(x, y, R * 0.17, { fill: ctr }));
    if (R >= 40) { const dd = []; for (let k = 0; k < 16; k++) { const a = rad(k * 22.5 + rot); dd.push({ x: x + Math.cos(a) * R * 0.33, y: y + Math.sin(a) * R * 0.33, r: R * 0.024, fill: ctr }); } extra.push(L.dots(dd)); }
  } else if (kind === 'peony' || kind === 'rose') {
    const N = (kind === 'rose' ? 24 : 34) * (R < 60 ? 0.7 : 1);
    layer(t[1]).add(L.circlePath(x, y, R * 0.5));
    for (let k = Math.round(N) - 1; k >= 0; k--) {
      const u = k / N;
      const a = rot + k * 137.5;
      const rho = R * 0.74 * Math.sqrt(u);
      const size = R * (kind === 'rose' ? 0.28 + 0.4 * Math.pow(u, 0.85) : 0.26 + 0.4 * Math.pow(u, 0.85));
      const tone = u > 0.5 ? t[0] : t[1];
      const px = x + Math.cos(rad(a)) * rho, py = y + Math.sin(rad(a)) * rho;
      layer(tone).add(L.petal(size, size * (kind === 'rose' ? 0.62 : 0.5), { belly: 0.66 }).transform(at(a, px, py)));
      if (veins && u > 0.3) vein.add(new Path().M(size * 0.2, 0).Q(size * 0.5, size * 0.04, size * 0.78, 0).transform(at(a, px, py)));
    }
    if (kind === 'rose') {
      const sp = [];
      for (let k = 0; k < 22; k++) { const a = rad(rot + k * 40); const rr = R * 0.025 + k * R * 0.0066; sp.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
      extra.push(path(L.smooth(sp), { fill: 'none', stroke: t[2], 'stroke-width': Math.max(2, R * 0.025), 'stroke-linecap': 'round', 'stroke-opacity': 0.7 }));
    } else if (R >= 60) {
      const dd = []; for (let k = 0; k < 18; k++) { const a = rad(k * 20 + rot); dd.push({ x: x + Math.cos(a) * R * 0.1, y: y + Math.sin(a) * R * 0.1, r: R * 0.02, fill: ctr }); } extra.push(L.dots(dd));
    }
  } else if (kind === 'blossom') {
    for (let k = 0; k < 5; k++) {
      const a = rot + (k / 5) * 360 + r.jitter(3);
      layer(t[0]).add(L.petal(R, R * 0.66, { belly: 0.7, notch: 1 }).transform(at(a)));
    }
    const st = new Path(), sd = [];
    const sc = R >= 36 ? 8 : 5;
    for (let k = 0; k < sc; k++) {
      const a = rad(rot + k * (360 / sc) + 10);
      st.add(L.smooth([[x, y], [x + Math.cos(a) * R * 0.2, y + Math.sin(a) * R * 0.2], [x + Math.cos(a + 0.2) * R * 0.4, y + Math.sin(a + 0.2) * R * 0.4]]));
      sd.push({ x: x + Math.cos(a + 0.2) * R * 0.4, y: y + Math.sin(a + 0.2) * R * 0.4, r: Math.max(1.6, R * 0.05), fill: ctr });
    }
    extra.push(path(st, { fill: 'none', stroke: ctr, 'stroke-width': Math.max(1, R * 0.03), 'stroke-linecap': 'round' }), L.dots(sd), circle(x, y, R * 0.08, { fill: ctr }));
  }
  const body = layers.map((q) => path(q.path, { fill: q.fill })).join('');
  return g(lineAttrs, body) + (vein.empty ? '' : path(vein, veinAttrs)) + extra.join('');
}

/** A row of beads (dots) along a curve, optionally growing and shrinking. */
function beadsAlong(curve, count, r0, r1, p, { fill } = {}) {
  let s = '';
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const { p: pt } = curve.at(t);
    s += circle(pt[0], pt[1], lerp(r0, r1, Math.sin(Math.PI * t) ** 0.8), fill ? { fill } : {});
  }
  return s;
}

/** One piece of confetti at (x, y): kind 0 dot, 1 strip, 2 triangle, 3 squiggle, 4 star, 5 ring. */
function confettiBit(kind, x, y, size, rot, col) {
  switch (kind % 6) {
    case 0: return circle(x, y, size * 0.45, { fill: col });
    case 1: return path(L.rrect(-size * 0.75, -size * 0.25, size * 1.5, size * 0.5, 2).transform(place(x, y, rot, 1)), { fill: col });
    case 2: return path(L.poly([[0, -size * 0.7], [size * 0.62, size * 0.5], [-size * 0.62, size * 0.5]], true).transform(place(x, y, rot, 1)), { fill: col });
    case 3: return path(L.smooth([[-size, 0], [-size * 0.5, -size * 0.42], [0, 0], [size * 0.5, size * 0.42], [size, 0]]).transform(place(x, y, rot, 1)), { fill: 'none', stroke: col, 'stroke-width': Math.max(3, size * 0.17), 'stroke-linecap': 'round' });
    case 4: return path(L.starPath(0, 0, size * 0.72, size * 0.3, 5, -90).transform(place(x, y, rot, 1)), { fill: col });
    default: return circle(x, y, size * 0.4, { fill: 'none', stroke: col, 'stroke-width': Math.max(3, size * 0.15) });
  }
}

module.exports = { confettiBit, petalTones, SHADE, shadeOf, shadeAttrs, leafEl, stem, arcPts, leavesAlong, laurelBranch, oliveBranch, eucalyptusStem, fernFrond, needlesAlong, firBranch, needle, flower, beadsAlong };
