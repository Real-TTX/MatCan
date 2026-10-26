'use strict';
// Group "Ornamente": flourishes, swashes, fleurons, mandalas, fans, paisley, sunbursts.
const L = require('./lib');
const M = require('./motifs');
const { curlArm } = require('./flourish');
const { Curve, Path, g, path, circle, rad, lerp, place, leaf, ribbon } = L;

const FOUR = ['gold', 'navy', 'schwarz', 'weiss'];
const FIVE = ['gold', 'rose', 'navy', 'schwarz', 'weiss'];
const diamond = (x, y, r) => L.poly([[x, y - r], [x + r * 0.72, y], [x, y + r], [x - r * 0.72, y]], true);
const mirrorX = (c, cx, svg, id) => { c.defs.push(`<g id="${id}">${svg}</g>`); L.tracker.mirrorX(cx); return `<use href="#${id}" /><use href="#${id}" transform="matrix(-1 0 0 1 ${2 * cx} 0)" />`; };

/** A wedge of a ring: from radius r0 to r1 between the angles a0 and a1. */
function wedge(cx, cy, r0, r1, a0, a1) {
  return new Path().arc(cx, cy, r1, r1, a0, a1, true).arc(cx, cy, r0, r0, a1, a0).Z();
}

const pieces = [
  {
    slug: 'schnoerkel-breit', name: 'Schnörkel breit', w: 1200, h: 340, palettes: FIVE, fit: 16,
    tags: ['Schnörkel', 'Ornament', 'Verzierung', 'Trenner', 'Hochzeit', 'Urkunde', 'barock', 'symmetrisch', 'Titel'],
    draw(c) {
      const { p, r } = c;
      let s = '';
      const up = curlArm([630, 164], -4, { len: 300, bow: -16, R: 58, r: 8, turns: 1.5, side: -1, w0: 2.4, wmax: 13, w1: 2, bulb: 7.5, widest: 0.4 });
      const down = curlArm([630, 178], 4, { len: 300, bow: 16, R: 58, r: 8, turns: 1.5, side: 1, w0: 2.4, wmax: 13, w1: 2, bulb: 7.5, widest: 0.4 });
      let half = up.svg + down.svg;
      half += M.leafEl(leaf(70, 17, { belly: 0.42, sharp: 0.75, tip: 0.2 }), place(800, 152, -30, 1), p, {});
      half += M.leafEl(leaf(70, 17, { belly: 0.42, sharp: 0.75, tip: -0.2 }), place(800, 190, 30, 1, true), p, { flip: true });
      half += circle(704, 171, 5.5, {});
      s += mirrorX(c, 600, half, 'h');
      s += path(diamond(600, 171, 20), {});
      s += circle(566, 171, 6, {}) + circle(634, 171, 6, {});
      return g({ fill: p.ink }, s);
    },
  },
  {
    slug: 'schwung', name: 'Doppelschwung', w: 1000, h: 300, palettes: FIVE, fit: 16,
    tags: ['Schwung', 'Unterstreichung', 'Swash', 'kalligrafisch', 'Name', 'Titel', 'Hochzeit', 'Linie'],
    draw(c) {
      const { p } = c;
      const right = curlArm([500, 228], -5, { len: 360, bow: 26, R: 78, r: 9, turns: 1.6, side: -1, w0: 4, wmax: 24, w1: 2.6, bulb: 9, widest: 0.38, tailPts: 7 });
      const left = curlArm([500, 232], 175, { len: 360, bow: 26, R: 78, r: 9, turns: 1.6, side: -1, w0: 4, wmax: 24, w1: 2.6, bulb: 9, widest: 0.38, tailPts: 7 });
      let s = right.svg + left.svg;
      s += path(diamond(500, 230, 16), {});
      return g({ fill: p.ink }, s);
    },
  },
  {
    slug: 's-schnoerkel', name: 'S-Schnörkel', w: 900, h: 460, palettes: FOUR, fit: 16,
    tags: ['Schnörkel', 'S-Form', 'Volute', 'Spirale', 'Ornament', 'barock', 'Verzierung'],
    draw(c) {
      const { p } = c;
      const a = curlArm([450, 231], 8, { len: 210, bow: 30, R: 74, r: 9, turns: 1.55, side: 1, w0: 3, wmax: 17, w1: 2.4, bulb: 8, widest: 0.45, tailPts: 6 });
      const b = curlArm([450, 229], 188, { len: 210, bow: 30, R: 74, r: 9, turns: 1.55, side: 1, w0: 3, wmax: 17, w1: 2.4, bulb: 8, widest: 0.45, tailPts: 6 });
      let s = a.svg + b.svg;
      const l1 = curlArm([450, 231], 38, { len: 60, bow: 0, R: 22, r: 5, turns: 1.3, side: -1, w0: 2, wmax: 5.5, w1: 1.5, bulb: 4, widest: 0.4 });
      s += path(diamond(450, 230, 14), {});
      s += M.leafEl(leaf(70, 16, { belly: 0.42, sharp: 0.75, tip: 0.2 }), place(540, 252, 24, 1), p, {});
      s += M.leafEl(leaf(70, 16, { belly: 0.42, sharp: 0.75, tip: -0.2 }), place(360, 208, 204, 1), p, {});
      return g({ fill: p.ink }, s);
    },
  },
  {
    slug: 'fleuron', name: 'Fleuron', w: 520, h: 520, palettes: FOUR, fit: 16,
    tags: ['Fleuron', 'Ornament', 'Blüte', 'Rosette', 'Schmuck', 'Zierstück', 'Mitte'],
    draw(c) {
      const { p } = c;
      let s = '';
      for (let i = 0; i < 4; i++) {
        const a = -45 + i * 90;
        const side = i % 2 ? 1 : -1;
        const arm = curlArm([260 + Math.cos(rad(a)) * 22, 260 + Math.sin(rad(a)) * 22], a, { len: 100, bow: side * 10, R: 44, r: 7, turns: 1.4, side, w0: 3, wmax: 10, w1: 2, bulb: 6, widest: 0.4 });
        s += arm.svg;
      }
      for (let i = 0; i < 4; i++) {
        const a = i * 90;
        s += M.leafEl(leaf(112, 26, { belly: 0.42, sharp: 0.75, tip: 0.15 }), place(260, 260, a, 1), p, {});
      }
      s += path(diamond(260, 260, 22), { fill: p.mono && p.id !== 'gold' ? p.tones[0] : p.mono ? p.tones[0] : p.ink });
      s += circle(260, 260, 7, { fill: p.ink });
      return g({ fill: p.ink }, s);
    },
  },
  {
    slug: 'mandala', name: 'Mandala', w: 800, h: 800, palettes: FOUR.concat(['rose']),
    tags: ['Mandala', 'Rosette', 'Kreis', 'Boho', 'Ornament', 'rund', 'Yoga', 'Henna'],
    draw(c) {
      const { p } = c;
      const cx = 400, cy = 400;
      let s = '';
      const radial = (cnt, r0, shape, rot0 = 0) => { const q = new Path(); for (let i = 0; i < cnt; i++) q.add(shape.transform(place(cx, cy, rot0 + (i / cnt) * 360, 1)).transform(L.IDENT)); return q; };
      const petalAt = (len, wid, r0) => leaf(len, wid, { belly: 0.45, sharp: 0.75 }).whole.transform(L.move(r0, 0));
      s += path(radial(8, 0, petalAt(78, 15, 20)), {});
      s += path(radial(16, 0, petalAt(74, 11, 118), 11.25), {});
      const dots = new Path();
      for (let i = 0; i < 16; i++) { const a = rad(i * 22.5); dots.add(L.circlePath(cx + Math.cos(a) * 114, cy + Math.sin(a) * 114, 6)); }
      s += path(dots, {});
      s += path(radial(16, 0, petalAt(130, 24, 134)), {});
      const dots2 = new Path();
      for (let i = 0; i < 48; i++) { const a = rad(i * 7.5); dots2.add(L.circlePath(cx + Math.cos(a) * 290, cy + Math.sin(a) * 290, 5)); }
      s += path(dots2, {});
      const tri = new Path();
      for (let i = 0; i < 24; i++) {
        const long = i % 2 === 0;
        tri.add(leaf(long ? 78 : 50, long ? 14 : 10, { belly: 0.4, sharp: 0.9 }).whole.transform(place(cx, cy, i * 15, 1)).transform(L.IDENT));
      }
      const ring = new Path();
      for (let i = 0; i < 24; i++) {
        const long = i % 2 === 0;
        ring.add(leaf(long ? 78 : 50, long ? 13 : 9, { belly: 0.4, sharp: 0.9 }).whole.transform(L.compose(L.move(cx, cy), L.rotm(i * 15), L.move(304, 0))));
      }
      s += path(ring, {});
      s += path(L.circlePath(cx, cy, 392), { fill: 'none', stroke: p.ink, 'stroke-width': 3 });
      return g({ fill: p.ink }, s);
    },
  },
  {
    slug: 'faecher', name: 'Fächer', w: 1000, h: 520, palettes: FOUR,
    tags: ['Fächer', 'Art Déco', 'Sonnenaufgang', 'Gatsby', 'Strahlen', 'geometrisch', 'Silvester', 'Hochzeit'],
    draw(c) {
      const { p } = c;
      const cx = 500, cy = 500;
      let s = '';
      const ring = (r0, r1, n, gap) => {
        const q = new Path();
        for (let i = 0; i < n; i++) {
          const a0 = 180 + (i / n) * 180 + gap, a1 = 180 + ((i + 1) / n) * 180 - gap;
          q.add(wedge(cx, cy, r0, r1, a0, a1));
        }
        return q;
      };
      s += path(wedge(cx, cy, 0, 64, 180, 360), {});
      s += path(ring(84, 160, 7, 1.6), {});
      s += path(ring(176, 286, 11, 1.1), { fill: p.mono ? p.tones[1] : p.colors[1] });
      s += path(ring(302, 420, 15, 0.8), {});
      s += path(new Path().arc(cx, cy, 440, 440, 180, 360, true).arc(cx, cy, 434, 434, 360, 180).Z(), {});
      s += path(new Path().arc(cx, cy, 462, 462, 180, 360, true).arc(cx, cy, 458, 458, 360, 180).Z(), {});
      const dots = new Path();
      for (let i = 0; i <= 28; i++) { const a = rad(180 + (i / 28) * 180); if (i % 2) dots.add(L.circlePath(cx + Math.cos(a) * 480, cy + Math.sin(a) * 480, 4)); }
      s += path(dots, {});
      return g({ fill: p.ink }, s);
    },
  },
  {
    slug: 'paisley', name: 'Paisley', w: 560, h: 760, palettes: FOUR.concat(['rose']), fit: 20,
    tags: ['Paisley', 'Boteh', 'Orient', 'Ornament', 'Boho', 'Henna', 'Indien'],
    draw(c) {
      const { p } = c;
      // a teardrop whose tip is bent into a hook: sample the outline, rotate every point by an angle that grows towards the tip
      const K = 520, DEG = 100, ROT = 128;
      const warp = (x, y) => { const a = rad(DEG * Math.pow(Math.max(0, x) / K, 1.5)); return [Math.cos(a) * x - Math.sin(a) * y, Math.sin(a) * x + Math.cos(a) * y]; };
      const rotate = L.rotm(ROT);
      const bend = (path) => L.smooth(L.samplePath(path, 12).filter((q, i, arr) => i === 0 || Math.hypot(q[0] - arr[i - 1][0], q[1] - arr[i - 1][1]) > 3).map(([x, y]) => warp(x, y)), true).transform(rotate);
      const drop = (len, wid, ox, oy) => bend(leaf(len, wid, { belly: 0.2, sharp: 0.95 }).whole.transform(L.move(ox, oy)));
      let s = path(drop(520, 205, 0, 0), {});
      s += path(drop(410, 156, 34, 0), { fill: p.mono ? p.accent : p.colors[3] });
      s += path(drop(290, 104, 70, 0), {});
      return g({ fill: p.ink }, s);
    },
  },
  {
    slug: 'strahlenkranz', name: 'Strahlenkranz', w: 800, h: 800, palettes: ['gold', 'navy', 'schwarz', 'weiss'],
    tags: ['Strahlen', 'Sonne', 'Strahlenkranz', 'Heiligenschein', 'Retro', 'Sonnenstrahlen', 'Burst'],
    draw(c) {
      const { p } = c;
      const cx = 400, cy = 400;
      const rays = new Path();
      for (let i = 0; i < 40; i++) {
        const long = i % 2 === 0;
        const a = (i / 40) * Math.PI * 2;
        const r0 = 230, r1 = long ? 392 : 330, wid = rad(long ? 3.4 : 2.4);
        rays.M(cx + Math.cos(a - wid) * r0, cy + Math.sin(a - wid) * r0).L(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1).L(cx + Math.cos(a + wid) * r0, cy + Math.sin(a + wid) * r0).Z();
      }
      return g({ fill: p.ink }, path(rays, {}), path(L.circlePath(cx, cy, 204), { fill: 'none', stroke: p.ink, 'stroke-width': 5 }), path(L.circlePath(cx, cy, 186), { fill: 'none', stroke: p.ink, 'stroke-width': 2 }));
    },
  },
  {
    slug: 'rosette', name: 'Guilloche-Rosette', w: 760, h: 760, palettes: FOUR,
    tags: ['Rosette', 'Guilloche', 'Spirograph', 'Banknote', 'Urkunde', 'Sicherheitsmuster', 'Kreise'],
    draw(c) {
      const { p } = c;
      const cx = 380, cy = 380;
      const rr = new Path();
      for (let i = 0; i < 24; i++) rr.add(L.circlePath(cx + Math.cos(rad(i * 15)) * 150, cy + Math.sin(rad(i * 15)) * 150, 188 * 0.98));
      return g({}, path(rr, { fill: 'none', stroke: p.ink, 'stroke-width': 1.6, 'stroke-opacity': 0.9 }), path(L.circlePath(cx, cy, 366), { fill: 'none', stroke: p.ink, 'stroke-width': 6 }), path(L.circlePath(cx, cy, 20), { fill: p.ink }));
    },
  },
];

module.exports = { name: 'Ornamente', slug: 'ornamente', tags: ['Ornament', 'Verzierung', 'Schmuck', 'Deko'], pieces };
