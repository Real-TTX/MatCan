'use strict';
// Motive of batch V2, part 3: Mittelalter, Vintage, Eheringe. Loaded by m-v2.js.
const L = require('./lib');
const M = require('./motifs');
const { Path, Curve, g, path, circle, rad, lerp, place, compose, move, rotm, scl, leaf } = L;

const sl = (pts, w, col, extra = {}) => path(L.smooth(pts), { fill: 'none', stroke: col, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra });
const SILVER = [[0, '#8e969f'], [0.35, '#e6e9ee'], [0.6, '#a5adb6'], [1, '#d6dae0']];
const silverDefs = (id, w, h) => `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${w}" y2="${h}">${SILVER.map(([o, c]) => `<stop offset="${o}" stop-color="${c}" />`).join('')}</linearGradient>`;

/** Two rings that overlap, with a small diamond. ink = paint for the rings. */
function rings(ink, dark, stone) {
  let s = '';
  s += path(L.ellipsePath(300, 340, 190, 190), { fill: 'none', stroke: ink, 'stroke-width': 46 });
  s += path(L.ellipsePath(300, 340, 190, 190).transform(L.IDENT), { fill: 'none', stroke: dark, 'stroke-width': 4, 'stroke-opacity': 0.0 });
  s += path(L.ellipsePath(520, 340, 190, 190), { fill: 'none', stroke: ink, 'stroke-width': 46 });
  // the right ring passes over the left one at the top and under it at the bottom
  s += path(new Path().arc(300, 340, 190, 190, -60, 25, true), { fill: 'none', stroke: ink, 'stroke-width': 46 });
  s += path(L.ellipsePath(300, 340, 213, 213), { fill: 'none', stroke: dark, 'stroke-width': 3, 'stroke-opacity': 0.35 });
  s += path(L.ellipsePath(520, 340, 213, 213), { fill: 'none', stroke: dark, 'stroke-width': 3, 'stroke-opacity': 0.35 });
  s += path(L.poly([[520, 70], [552, 108], [520, 142], [488, 108]], true), { fill: stone, stroke: dark, 'stroke-width': 5, 'stroke-linejoin': 'round' });
  s += path(L.poly([[520, 70], [552, 108], [488, 108]], true), { fill: '#ffffff', 'fill-opacity': 0.5 });
  return s;
}

const pieces = [
  {
    slug: 'trauringe', name: 'Eheringe', w: 840, h: 600, palettes: ['gold', 'schwarz', 'weiss', 'rose'], fit: 16,
    tags: ['Eheringe', 'Ringe', 'Trauringe', 'Hochzeit', 'Verlobung', 'Liebe', 'Jubiläum', 'Standesamt'],
    draw(c) { const { p } = c; return rings(p.ink, p.tones[0], p.id === 'weiss' ? '#ffffff' : '#ffffff'); },
  },
  {
    slug: 'trauringe-silber', name: 'Eheringe Silber', w: 840, h: 600, palettes: ['bunt'], fit: 16,
    tags: ['Eheringe', 'Ringe', 'Trauringe', 'Silber', 'Silberhochzeit', 'Hochzeit', 'Jubiläum', 'silbern'],
    draw(c) { c.defs.push(silverDefs('sv', 840, 600)); return rings('url(#sv)', '#6c747d', '#ffffff'); },
  },
  {
    slug: 'lorbeerkranz-silber', name: 'Lorbeerkranz Silber', w: 900, h: 900, palettes: ['bunt'], fit: 16,
    tags: ['Lorbeerkranz', 'Kranz', 'Lorbeer', 'Silber', 'Silberhochzeit', 'Jubiläum', 'silbern', 'Ehrung', 'Hochzeit'],
    draw(c) {
      c.defs.push(silverDefs('sv', 900, 900));
      const p = { id: 'silber', mono: true, ink: 'url(#sv)', leaf: 'url(#sv)', tones: ['#6c747d', '#9aa3ad', '#d6dae0'] };
      const right = new Path().arc(450, 450, 340, 340, 100, -85, true); // from the bottom up the right side
      const pts = (a0, a1) => { const o = []; for (let i = 0; i <= 12; i++) { const a = rad(lerp(a0, a1, i / 12)); o.push([450 + Math.cos(a) * 340, 450 + Math.sin(a) * 340]); } return o; };
      const mk = (a0, a1) => M.laurelBranch(new Curve(pts(a0, a1)), p, c.r, { n: 13, len0: 120, len1: 80, stemW: 9, t0: 0.04 });
      const left = new Curve(pts(80, 265).map(([x, y]) => [x, y]));
      return g({ fill: 'url(#sv)' }, mk(95, -85), M.laurelBranch(new Curve(pts(85, 265)), p, c.r, { n: 13, len0: 120, len1: 80, stemW: 9, t0: 0.04 }));
    },
  },
  {
    slug: 'goldene-50', name: 'Goldkranz mit Band', w: 900, h: 900, palettes: ['gold'], fit: 16,
    tags: ['Lorbeerkranz', 'Kranz', 'Goldhochzeit', 'Goldene Hochzeit', 'Jubiläum', 'Gold', 'Ehrung', '50 Jahre'],
    draw(c) {
      const { p } = c;
      const pts = (a0, a1) => { const o = []; for (let i = 0; i <= 12; i++) { const a = rad(lerp(a0, a1, i / 12)); o.push([450 + Math.cos(a) * 340, 450 + Math.sin(a) * 340]); } return o; };
      const mk = (a0, a1) => M.laurelBranch(new Curve(pts(a0, a1)), p, c.r, { n: 13, len0: 120, len1: 80, stemW: 9, t0: 0.04 });
      return g({ fill: p.leaf }, mk(95, -85), mk(85, 265)) + path(L.poly([[400, 800], [450, 770], [500, 800], [540, 880], [450, 850], [360, 880]], true), { fill: p.ink });
    },
  },
  {
    slug: 'burg', name: 'Burg', w: 760, h: 680, palettes: ['bunt'], fit: 14,
    tags: ['Burg', 'Schloss', 'Mittelalter', 'Ritter', 'Festung', 'Turm', 'Hochzeit', 'Märchen'],
    draw() {
      const stone = '#b9b2a5', dark = '#8f887a', light = '#d7d1c4';
      let s = '';
      const tower = (x, w, top, bottom, flag) => {
        let o = path(L.poly([[x, top], [x, bottom], [x + w, bottom], [x + w, top]], true), { fill: stone });
        const n = Math.round(w / 40);
        for (let i = 0; i < n; i++) o += path(L.rrect(x + (w / n) * i + 4, top - 30, w / n - 8, 34, 2), { fill: stone });
        o += path(L.poly([[x + w * 0.5 - 12, top + 40], [x + w * 0.5 - 12, top + 100], [x + w * 0.5 + 12, top + 100], [x + w * 0.5 + 12, top + 40]], true), { fill: '#3a352e' });
        o += path(L.poly([[x + w * 0.62, top], [x + w, top], [x + w, bottom], [x + w * 0.62, bottom]], true), { fill: dark, 'fill-opacity': 0.35 });
        if (flag) o += path(new Path().M(x + w / 2, top - 30).L(x + w / 2, top - 120), { fill: 'none', stroke: '#6e4f2a', 'stroke-width': 7, 'stroke-linecap': 'round' }) + path(L.poly([[x + w / 2, top - 120], [x + w / 2 + 70, top - 98], [x + w / 2, top - 76]], true), { fill: '#b4283c' });
        return o;
      };
      s += tower(80, 130, 260, 640, false) + tower(550, 130, 260, 640, false);
      s += path(L.poly([[190, 330], [190, 640], [570, 640], [570, 330]], true), { fill: light });
      for (let i = 0; i < 7; i++) s += path(L.rrect(190 + i * 54 + 6, 300, 42, 34, 2), { fill: light });
      s += tower(300, 160, 150, 640, true);
      s += path(new Path().M(330, 640).L(330, 540).C(330, 480, 430, 480, 430, 540).L(430, 640).Z().transform(compose(move(25, 0))), { fill: '#3a352e' });
      for (const [x, y] of [[250, 400], [510, 400]]) s += path(new Path().M(x - 12, y + 40).L(x - 12, y).C(x - 12, y - 24, x + 12, y - 24, x + 12, y).L(x + 12, y + 40).Z(), { fill: '#3a352e' });
      s += path(new Path().M(20, 640).L(740, 640), { fill: 'none', stroke: '#7a9a5a', 'stroke-width': 24, 'stroke-linecap': 'round' });
      return s;
    },
  },
  {
    slug: 'kelch', name: 'Kelch', w: 440, h: 700, palettes: ['gold', 'schwarz', 'weiss'], fit: 14,
    tags: ['Kelch', 'Pokal', 'Becher', 'Mittelalter', 'Wein', 'Trinkbecher', 'Hochzeit', 'Gold', 'Gral'],
    draw(c) {
      const { p } = c;
      let s = path(new Path().M(60, 80).L(380, 80).C(380, 260, 300, 340, 220, 340).C(140, 340, 60, 260, 60, 80).Z(), { fill: p.ink });
      s += path(new Path().M(60, 80).L(380, 80).L(372, 120).L(68, 120).Z(), { fill: p.tones[0], 'fill-opacity': 0.55 });
      s += path(L.rrect(196, 330, 48, 190, 10), { fill: p.ink }) + circle(220, 420, 36, { fill: p.ink }) + circle(220, 420, 22, { fill: p.id === 'weiss' ? '#d6d1c4' : '#b4283c' });
      s += path(new Path().M(90, 640).C(90, 560, 150, 520, 220, 520).C(290, 520, 350, 560, 350, 640).Z(), { fill: p.ink });
      s += path(L.rrect(70, 630, 300, 36, 14), { fill: p.tones[0] });
      s += path(new Path().M(110, 130).C(120, 220, 160, 280, 200, 300), { fill: 'none', stroke: '#ffffff', 'stroke-opacity': 0.4, 'stroke-width': 12, 'stroke-linecap': 'round' });
      return s;
    },
  },
  {
    slug: 'wappen', name: 'Wappenschild', w: 560, h: 680, palettes: ['bordeaux', 'navy', 'schwarz'], fit: 14,
    tags: ['Wappen', 'Schild', 'Wappenschild', 'Mittelalter', 'Ritter', 'Heraldik', 'Familienwappen', 'Hochzeit'],
    draw(c) {
      const { p } = c;
      const shield = new Path().M(40, 50).L(520, 50).L(520, 330).C(520, 500, 400, 600, 280, 650).C(160, 600, 40, 500, 40, 330).Z();
      let s = path(shield, { fill: p.ink });
      s += path(new Path().M(280, 50).L(520, 50).L(520, 330).C(520, 500, 400, 600, 280, 650).Z(), { fill: '#ffffff', 'fill-opacity': 0.14 });
      s += path(shield, { fill: 'none', stroke: '#e3c479', 'stroke-width': 16, 'stroke-linejoin': 'round' });
      s += path(L.heart(280, 330, 300), { fill: '#e3c479' });
      s += path(L.poly([[150, 560], [280, 520], [410, 560]], false), { fill: 'none', stroke: '#e3c479', 'stroke-width': 10, 'stroke-linecap': 'round' });
      return s;
    },
  },
  {
    slug: 'schwerter', name: 'Gekreuzte Schwerter', w: 760, h: 780, palettes: ['gold', 'schwarz', 'weiss'],
    tags: ['Schwerter', 'Schwert', 'gekreuzt', 'Mittelalter', 'Ritter', 'Kampf', 'Wappen', 'Hochzeit'],
    draw(c) {
      const { p } = c;
      const sword = (a) => {
        let o = path(new Path().M(-18, -330).L(0, -370).L(18, -330).L(18, 150).L(-18, 150).Z(), { fill: p.id === 'weiss' ? '#ffffff' : p.tones[2] });
        o += path(new Path().M(0, -370).L(18, -330).L(18, 150).L(0, 150).Z(), { fill: p.tones[1], 'fill-opacity': 0.7 });
        o += path(L.rrect(-90, 150, 180, 30, 12), { fill: p.ink }) + path(L.rrect(-12, 180, 24, 110, 8), { fill: p.tones[0] }) + circle(0, 306, 24, { fill: p.ink });
        return g({ transform: `translate(380 400) rotate(${a})` }, o);
      };
      return sword(42) + sword(-42);
    },
  },
  {
    slug: 'wimpelbanner', name: 'Banner mit Schwalbenschwanz', w: 400, h: 900, palettes: ['bordeaux', 'navy', 'gold'], fit: 14,
    tags: ['Banner', 'Wimpel', 'Fahne', 'Mittelalter', 'Ritter', 'Burg', 'Wappen', 'Hochzeit', 'Stoff'],
    draw(c) {
      const { p } = c;
      let s = path(L.rrect(20, 20, 360, 22, 10), { fill: '#6e4f2a' }) + circle(20, 31, 20, { fill: '#c9a04e' }) + circle(380, 31, 20, { fill: '#c9a04e' });
      const cloth = new Path().M(50, 42).L(350, 42).L(350, 800).L(200, 700).L(50, 800).Z();
      s += path(cloth, { fill: p.ink });
      s += path(new Path().M(200, 42).L(350, 42).L(350, 800).L(200, 700).Z(), { fill: '#ffffff', 'fill-opacity': 0.13 });
      s += path(cloth.transform(compose(move(200, 0), scl(0.88, 1), move(-200, 0))), { fill: 'none', stroke: '#e3c479', 'stroke-width': 8, 'stroke-linejoin': 'round' });
      s += path(L.starPath(200, 330, 110, 46, 8), { fill: '#e3c479' }) + circle(200, 330, 34, { fill: p.ink });
      s += path(L.poly([[200, 520], [230, 560], [200, 600], [170, 560]], true), { fill: '#e3c479' });
      return s;
    },
  },
  {
    slug: 'eichenlaub-trenner', name: 'Eichenlaub Trenner', w: 1200, h: 150, palettes: ['gold', 'schwarz', 'bordeaux'], fit: 12,
    tags: ['Eichenlaub', 'Eiche', 'Trenner', 'Linie', 'Mittelalter', 'Ritter', 'Blätter', 'Hochzeit'],
    draw(c) {
      const { p } = c;
      let s = path(new Path().M(0, 75).L(1200, 75), { fill: 'none', stroke: p.ink, 'stroke-width': 6 });
      const oak = (x, a) => path(leaf(80, 20, { belly: 0.45, sharp: 0.8 }).whole.transform(place(x, 75, a, 1)), { fill: p.ink });
      for (let i = 0; i < 6; i++) { s += oak(110 + i * 80, -35) + oak(110 + i * 80 + 40, 35) + oak(1090 - i * 80, 215) + oak(1090 - i * 80 - 40, 145); }
      s += path(L.poly([[600, 30], [640, 75], [600, 120], [560, 75]], true), { fill: p.ink });
      return s;
    },
  },

  // ------------------------------------------------------------------------------------------------ Vintage
  {
    slug: 'schluessel', name: 'Schlüssel antik', w: 300, h: 760, palettes: ['gold', 'schwarz', 'weiss'], fit: 14,
    tags: ['Schlüssel', 'antik', 'Vintage', 'Retro', 'Hochzeit', 'Schloss', 'Nostalgie', 'Dank'],
    draw(c) {
      const { p } = c;
      let s = path(L.ellipsePath(150, 110, 100, 100), { fill: 'none', stroke: p.ink, 'stroke-width': 28 });
      s += path(L.ellipsePath(150, 110, 52, 52), { fill: 'none', stroke: p.ink, 'stroke-width': 14 });
      s += path(L.rrect(136, 200, 28, 480, 8), { fill: p.ink });
      for (const y of [240, 270]) s += path(L.rrect(124, y - 8, 52, 16, 8), { fill: p.ink });
      s += circle(150, 300, 16, { fill: p.ink });
      s += path(new Path().M(164, 600).L(240, 600).L(240, 660).L(210, 660).L(210, 640).L(164, 640).Z(), { fill: p.ink });
      s += path(new Path().M(164, 660).L(220, 660).L(220, 700).L(164, 700).Z(), { fill: p.ink });
      return s;
    },
  },
  {
    slug: 'vogelkaefig', name: 'Vogelkäfig', w: 460, h: 800, palettes: ['gold', 'schwarz', 'weiss'], fit: 14,
    tags: ['Vogelkäfig', 'Käfig', 'Vintage', 'Retro', 'Hochzeit', 'Karten', 'Briefkasten', 'Nostalgie'],
    draw(c) {
      const { p } = c;
      const st = { fill: 'none', stroke: p.ink, 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
      let s = circle(230, 40, 20, st.fill === 'none' ? { fill: 'none', stroke: p.ink, 'stroke-width': 9 } : {});
      s += path(new Path().M(230, 60).L(230, 110), st);
      s += path(new Path().M(100, 220).C(100, 150, 160, 110, 230, 110).C(300, 110, 360, 150, 360, 220), st);
      s += path(new Path().M(70, 230).L(390, 230), { ...st, 'stroke-width': 14 });
      s += path(new Path().M(110, 230).L(110, 690).M(350, 230).L(350, 690), st);
      s += path(new Path().M(230, 120).L(230, 690).M(170, 230).C(150, 380, 150, 560, 170, 690).M(290, 230).C(310, 380, 310, 560, 290, 690), st);
      s += path(L.rrect(80, 690, 300, 40, 14), { fill: p.ink });
      s += path(new Path().M(110, 450).L(350, 450), st);
      s += path(new Path().M(210, 450).C(190, 400, 220, 360, 260, 370).C(280, 376, 290, 396, 276, 420).C(264, 440, 250, 450, 250, 450).Z(), { fill: p.ink });
      return s;
    },
  },
  {
    slug: 'schmetterling', name: 'Schmetterling', w: 760, h: 640, palettes: ['gold', 'schwarz', 'navy', 'rose'], fit: 14,
    tags: ['Schmetterling', 'Falter', 'Vintage', 'Retro', 'Frühling', 'Hochzeit', 'Insekt', 'Flügel'],
    draw(c) {
      const { p } = c;
      let s = '';
      const half = (side) => {
        const m = compose(move(380, 320), scl(side, 1));
        const wing1 = new Path().M(0, 0).C(60, -180, 220, -300, 330, -240).C(400, -190, 360, -60, 250, 10).C(160, 60, 60, 40, 0, 0).Z().transform(m);
        const wing2 = new Path().M(0, 10).C(120, 30, 260, 70, 270, 160).C(270, 260, 140, 300, 70, 220).C(20, 160, 0, 80, 0, 10).Z().transform(m);
        let o = path(wing1, { fill: p.ink }) + path(wing2, { fill: p.ink, 'fill-opacity': 0.85 });
        o += path(L.ellipsePath(0, 0, 60, 40).transform(compose(m, move(240, -150))), { fill: '#ffffff', 'fill-opacity': 0.5 });
        o += path(L.ellipsePath(0, 0, 36, 28).transform(compose(m, move(170, 150))), { fill: '#ffffff', 'fill-opacity': 0.5 });
        return o;
      };
      s += half(1) + half(-1);
      s += path(L.ellipsePath(380, 330, 18, 100), { fill: p.tones[0] });
      s += sl([[380, 240], [350, 170], [330, 130]], 6, p.tones[0]) + sl([[380, 240], [410, 170], [430, 130]], 6, p.tones[0]);
      return s;
    },
  },
];

module.exports = { pieces };
