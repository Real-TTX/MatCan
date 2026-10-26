'use strict';
// Calligraphic flourishes: scroll strokes that run along a line and end in a curl (spiral), drawn as brush-like ribbons that are thick on the bend and thin at the ends.
const L = require('./lib');
const { Curve, Path, path, circle, rad, deg, lerp, ribbon } = L;

/**
 * An arm that starts at `start`, runs in direction `dir` (degrees) for `len` with a gentle bow, and ends in a spiral.
 * o: len, bow (sideways bulge of the tail, + = to the right of the direction), R (outer radius of the curl), r (inner radius), turns, side (+1 curl to the right, -1 left),
 * w0 (start width), wmax (widest), w1 (end width), bulb (radius of the terminal dot, 0 = none).
 * Returns { svg, points, curve, end }.
 */
function curlArm(start, dir, o) {
  const { len = 200, bow = 0, R = 40, r = 7, turns = 1.4, side = 1, w0 = 3, wmax = 10, w1 = 2, bulb = 6, tailPts = 5, widest = 0.5 } = o;
  const d = [Math.cos(rad(dir)), Math.sin(rad(dir))];
  const nR = [-d[1], d[0]]; // to the right of the direction on screen (y down)
  const pts = [];
  for (let i = 0; i < tailPts; i++) {
    const s = (i / tailPts) * len;
    const sway = bow * Math.sin(Math.PI * (s / len)) * (o.bowSkew ? 1 : 1);
    pts.push([start[0] + d[0] * s + nR[0] * sway, start[1] + d[1] * s + nR[1] * sway]);
  }
  // the end of the tail and the curl
  const E = [start[0] + d[0] * len, start[1] + d[1] * len];
  const cdir = side > 0 ? nR : [-nR[0], -nR[1]];
  const c = [E[0] + cdir[0] * R, E[1] + cdir[1] * R];
  const th0 = Math.atan2(E[1] - c[1], E[0] - c[0]);
  // direction of rotation so that the tangent at E matches d
  const vInc = [-Math.sin(th0), Math.cos(th0)];
  const sgn = vInc[0] * d[0] + vInc[1] * d[1] >= 0 ? 1 : -1;
  const steps = Math.max(10, Math.round(turns * 12));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const th = th0 + sgn * turns * Math.PI * 2 * t;
    const rr = lerp(R, r, Math.pow(t, 0.8));
    pts.push([c[0] + Math.cos(th) * rr, c[1] + Math.sin(th) * rr]);
  }
  const curve = new Curve(pts);
  const ease = (x) => x * x * (3 - 2 * x);
  const widthAt = (t) => (t < widest ? lerp(w0, wmax, ease(t / widest)) : lerp(wmax, w1, ease((t - widest) / (1 - widest))));
  let svg = path(ribbon(curve, widthAt, { count: Math.max(14, Math.round(curve.length / 17)) }), {});
  const end = curve.at(1).p;
  if (bulb) svg += circle(end[0], end[1], bulb, {});
  return { svg, curve, end, centre: c };
}

/** Matrix for a diagonal mirror (swap x and y), as an SVG transform attribute value. */
const DIAG = 'matrix(0 1 1 0 0 0)';

module.exports = { curlArm, DIAG };
