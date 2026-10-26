'use strict';
// Motive of batch V2, part 2: rustic, boho, beach, tropical, winter. Loaded by m-v2.js.
const L = require('./lib');
const M = require('./motifs');
const { Path, Curve, g, path, circle, rad, lerp, place, compose, move, rotm, scl, leaf, ribbon } = L;

const sl = (pts, w, col, extra = {}) => path(L.smooth(pts), { fill: 'none', stroke: col, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra });
const lf = (x, y, a, len, col, shade, wid = 0.24) => {
  const l = leaf(len, len * wid, { belly: 0.45, sharp: 0.8 });
  return path(l.whole.transform(place(x, y, a, 1)), { fill: col }) + path(l.lower.transform(place(x, y, a, 1)), { fill: shade || '#000000', 'fill-opacity': shade ? 1 : 0.14 });
};

const pieces = [
  // ------------------------------------------------------------------------------------------------ Rustikal
  {
    slug: 'holzschild', name: 'Holzschild', w: 960, h: 760, palettes: ['boho'], fit: 14,
    tags: ['Holzschild', 'Holz', 'Schild', 'Rustikal', 'Scheune', 'Landhaus', 'Vintage', 'Hochzeit', 'Wegweiser'],
    draw(c) {
      let s = '';
      s += sl([[170, 150], [300, 40], [480, 20]], 9, '#b5894f') + sl([[790, 150], [660, 40], [480, 20]], 9, '#b5894f');
      s += circle(480, 22, 17, { fill: 'none', stroke: '#8f6a3a', 'stroke-width': 9 });
      const board = L.rrect(60, 130, 840, 560, 22);
      s += path(board, { fill: '#cf9f66' });
      for (let i = 1; i < 4; i++) s += path(new Path().M(60 + i * 210, 134).L(60 + i * 210, 686), { fill: 'none', stroke: '#a67740', 'stroke-width': 7 });
      const grain = new Path();
      for (const [x, y, w2] of [[100, 190, 90], [330, 270, 120], [560, 220, 100], [740, 330, 110], [150, 420, 110], [360, 520, 100], [610, 470, 120], [760, 590, 90], [110, 630, 100], [300, 380, 70], [550, 620, 80]]) grain.M(x, y).C(x + w2 * 0.3, y - 5, x + w2 * 0.7, y + 5, x + w2, y);
      s += path(grain, { fill: 'none', stroke: '#a67740', 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-opacity': 0.8 });
      s += path(board, { fill: 'none', stroke: '#8f6a3a', 'stroke-width': 12 });
      for (const [x, y] of [[110, 180], [850, 180], [110, 640], [850, 640]]) s += circle(x, y, 9, { fill: '#6e4f2a' });
      return s;
    },
  },
  {
    slug: 'lichterkette', name: 'Lichterkette', w: 1400, h: 340, palettes: ['boho'], fit: 14,
    tags: ['Lichterkette', 'Lichter', 'Glühbirnen', 'Girlande', 'Rustikal', 'Scheune', 'Sommer', 'Hochzeit', 'Gartenparty'],
    draw() {
      let s = '';
      const swag = (x0, x1, y0, sag) => {
        const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([lerp(x0, x1, t), y0 + sag * Math.sin(Math.PI * t)]); }
        let o = sl(pts, 5, '#3a3430');
        const cv = new Curve(pts);
        for (let i = 1; i <= 5; i++) {
          const { p } = cv.at(i / 6);
          o += path(L.rrect(p[0] - 11, p[1] + 2, 22, 26, 5), { fill: '#3a3430' });
          o += circle(p[0], p[1] + 66, 54, { fill: '#ffd36b', 'fill-opacity': 0.28 });
          o += path(new Path().M(p[0] - 14, p[1] + 28).C(p[0] - 36, p[1] + 52, p[0] - 30, p[1] + 90, p[0], p[1] + 92).C(p[0] + 30, p[1] + 90, p[0] + 36, p[1] + 52, p[0] + 14, p[1] + 28).Z(), { fill: '#ffc94d' });
          o += path(new Path().M(p[0] - 9, p[1] + 50).C(p[0] - 14, p[1] + 66, p[0] - 8, p[1] + 74, p[0] - 2, p[1] + 78), { fill: 'none', stroke: '#fff3c4', 'stroke-width': 5, 'stroke-linecap': 'round' });
        }
        return o;
      };
      return s + swag(0, 700, 20, 90) + swag(700, 1400, 20, 90);
    },
  },
  {
    slug: 'einmachglas', name: 'Einmachglas mit Wiesenblumen', w: 560, h: 760, palettes: ['boho'], fit: 14,
    tags: ['Einmachglas', 'Glas', 'Wiesenblumen', 'Blumen', 'Rustikal', 'Landhaus', 'Scheune', 'Hochzeit', 'Deko', 'Tischdeko'],
    draw(c) {
      let s = '';
      const { r, p } = c;
      for (const [x, a, h2] of [[220, -14, 300], [280, 4, 380], [340, 16, 280], [250, -4, 250]]) s += sl([[280, 540], [x, 540 - h2 * 0.5], [x + a * 4, 540 - h2]], 7, '#4f7a4f');
      s += lf(260, 400, -130, 90, '#5f8f5a') + lf(300, 360, -40, 90, '#5f8f5a');
      s += M.flower('daisy', 160, 220, 62, p, r, { tones: ['#ffffff', '#ffe27a', '#e0a43c'], centre: '#c98a1c' });
      s += M.flower('daisy', 280, 110, 70, p, r, { tones: ['#fbf3ea', '#ffe27a', '#e0a43c'], centre: '#c98a1c', rot: 12 });
      s += M.flower('daisy', 410, 200, 56, p, r, { tones: ['#ffffff', '#ffe27a', '#e0a43c'], centre: '#c98a1c', rot: 5 });
      for (const [x, y] of [[210, 300], [350, 280], [330, 150], [220, 130]]) s += circle(x, y, 20, { fill: '#9b7bd0' }) + circle(x, y, 8, { fill: '#7658b0' });
      const jar = L.rrect(100, 270, 360, 460, 70);
      s += path(L.rrect(100, 400, 360, 330, 70), { fill: '#a9c6c8', 'fill-opacity': 0.45 });
      s += path(jar, { fill: '#dff0f0', 'fill-opacity': 0.4, stroke: '#8fb2b4', 'stroke-width': 10 });
      s += path(L.rrect(120, 330, 28, 300, 14), { fill: '#ffffff', 'fill-opacity': 0.5 });
      s += path(L.rrect(130, 232, 300, 52, 12), { fill: '#d3a85a', stroke: '#9d7a34', 'stroke-width': 8 });
      return s;
    },
  },
  {
    slug: 'holzherz', name: 'Holzherz mit Schnur', w: 600, h: 640, palettes: ['boho'], fit: 14,
    tags: ['Holzherz', 'Herz', 'Holz', 'Schnur', 'Rustikal', 'Scheune', 'Landhaus', 'Hochzeit', 'Liebe'],
    draw() {
      const h = L.heart(300, 360, 460);
      let s = sl([[300, 110], [240, 40], [300, 6], [360, 40], [300, 110]], 8, '#b5894f');
      s += path(h, { fill: '#cf9f66', stroke: '#8f6a3a', 'stroke-width': 14, 'stroke-linejoin': 'round' });
      const gr = new Path();
      for (const [x, y, w2] of [[170, 260, 120], [330, 220, 90], [200, 380, 140], [330, 340, 110], [250, 470, 100], [300, 280, 40]]) gr.M(x, y).C(x + w2 * 0.3, y - 6, x + w2 * 0.7, y + 6, x + w2, y);
      s += path(gr, { fill: 'none', stroke: '#a67740', 'stroke-width': 5, 'stroke-linecap': 'round' });
      return s;
    },
  },
  {
    slug: 'baumscheibe', name: 'Baumscheibe', w: 700, h: 640, palettes: ['boho'], fit: 14,
    tags: ['Baumscheibe', 'Holz', 'Baumstamm', 'Jahresringe', 'Rustikal', 'Scheune', 'Landhaus', 'Hochzeit'],
    draw() {
      let s = path(L.ellipsePath(350, 330, 320, 290, -6), { fill: '#6e4f2a' });
      s += path(L.ellipsePath(350, 330, 296, 266, -6), { fill: '#d9b07a' });
      for (let i = 0; i < 6; i++) s += path(L.ellipsePath(350 + i * 2, 330 - i, 262 - i * 44, 236 - i * 40, -6), { fill: 'none', stroke: '#b98a52', 'stroke-width': 5 });
      s += circle(352, 326, 8, { fill: '#8f6a3a' });
      s += path(new Path().M(352, 326).L(520, 270), { fill: 'none', stroke: '#8f6a3a', 'stroke-width': 5, 'stroke-linecap': 'round' });
      return s;
    },
  },

  // ------------------------------------------------------------------------------------------------ Boho
  {
    slug: 'pampasgras', name: 'Pampasgras', w: 500, h: 1000, palettes: ['boho'], fit: 14,
    tags: ['Pampasgras', 'Gras', 'Boho', 'Trockenblumen', 'Federn', 'Hochzeit', 'natürlich', 'beige'],
    draw(c) {
      const { r } = c;
      let s = sl([[250, 990], [244, 700], [250, 400]], 7, '#b69a72');
      const tones = ['#e6d6bb', '#d9c3a0', '#c9ac84', '#f1e7d4'];
      for (let i = 0; i < 70; i++) {
        const t = r.range(0, 1), y0 = lerp(560, 330, t) + r.range(-10, 10);
        const side = r.range(-1, 1), len = r.range(160, 330) * (1 - Math.abs(side) * 0.25);
        const x1 = 250 + side * len * 0.55, x2 = 250 + side * len * 0.9;
        s += sl([[250, y0 + 50], [x1, y0 - len * 0.35], [x2 + r.range(-20, 20), y0 - len]], r.range(2.5, 5), r.pick(tones), { 'stroke-opacity': 0.9 });
      }
      for (let i = 0; i < 50; i++) { const y0 = r.range(60, 330), side = r.range(-1, 1); s += sl([[250, y0 + 170], [250 + side * 70, y0 + 60], [250 + side * 120, y0 - 30 + r.range(-20, 20)]], r.range(2, 4), r.pick(tones)); }
      return s;
    },
  },
  {
    slug: 'trockenblumen', name: 'Trockenblumen Strauß', w: 700, h: 960, palettes: ['boho'], fit: 14,
    tags: ['Trockenblumen', 'Strauß', 'Blumen', 'Boho', 'Hochzeit', 'natürlich', 'Terrakotta', 'Gräser'],
    draw(c) {
      let s = '';
      const stems = [[350, 940, 350, 400, 350, 110], [350, 940, 250, 500, 160, 260], [350, 940, 450, 500, 540, 290], [350, 940, 300, 560, 250, 420], [350, 940, 410, 600, 450, 450], [350, 940, 200, 700, 110, 560], [350, 940, 500, 720, 590, 580]];
      for (const [x0, y0, x1, y1, x2, y2] of stems) s += sl([[x0, y0], [x1, y1], [x2, y2]], 6, '#9a8559');
      s += lf(350, 800, -125, 160, '#9aa27a') + lf(350, 780, -55, 160, '#9aa27a') + lf(340, 700, -150, 120, '#b4b88f') + lf(360, 690, -30, 120, '#b4b88f');
      for (const [x, y, rr, col] of [[350, 110, 44, '#c9714f'], [160, 260, 40, '#e1a96c'], [540, 290, 42, '#c9714f'], [250, 420, 30, '#ecd9b0'], [450, 450, 32, '#e1a96c']]) {
        s += circle(x, y, rr, { fill: col });
        for (let k = 0; k < 8; k++) { const a = rad(k * 45); s += circle(x + Math.cos(a) * rr * 0.9, y + Math.sin(a) * rr * 0.9, rr * 0.38, { fill: col }); }
        s += circle(x, y, rr * 0.4, { fill: '#8a4a2e', 'fill-opacity': 0.55 });
      }
      for (const [x, y, a] of [[110, 560, -20], [590, 580, 20]]) s += path(L.ellipsePath(x, y, 18, 60, a), { fill: '#b88c62' });
      s += path(L.ellipsePath(350, 910, 50, 20, 0), { fill: '#c9714f', 'fill-opacity': 0.9 }) + path(L.rrect(300, 900, 100, 40, 8), { fill: '#e9d8b4' });
      return s;
    },
  },
  {
    slug: 'mondphasen', name: 'Mondphasen', w: 1200, h: 200, palettes: ['gold', 'schwarz', 'weiss'], fit: 12,
    tags: ['Mond', 'Mondphasen', 'Boho', 'Trenner', 'Himmel', 'Hochzeit', 'mystisch', 'Nacht'],
    draw(c) {
      const { p } = c;
      let s = '';
      const R = 80;
      [0, 0.2, 0.5, 0.8, 1].forEach((ph, i) => {
        const cx = 100 + i * 250, cy = 100;
        s += circle(cx, cy, R, { fill: 'none', stroke: p.ink, 'stroke-width': 7 });
        if (ph === 1) { s += circle(cx, cy, R, { fill: p.ink }); return; }
        if (ph === 0) return;
        const lit = new Path().arc(cx, cy, R, R, -90, 90, true);
        const rx = Math.abs(1 - 2 * ph) * R;
        if (ph < 0.5) lit.arc(cx, cy, rx, R, 90, -90); else lit.arc(cx, cy, rx, R, 90, 270);
        s += path(lit.Z(), { fill: p.ink });
      });
      return s;
    },
  },
  {
    slug: 'bohosonne', name: 'Boho-Sonne', w: 800, h: 800, palettes: ['boho'], fit: 14,
    tags: ['Sonne', 'Sonnenstrahlen', 'Boho', 'Terrakotta', 'Retro', 'Hochzeit', 'Sommer'],
    draw() {
      let s = '';
      for (let i = 0; i < 16; i++) { const a = i * 22.5; s += path(L.poly([[0, -250], [34, -380], [-34, -380]], true).transform(compose(move(400, 400), rotm(a))), { fill: i % 2 ? '#e1a96c' : '#c9714f' }); }
      s += circle(400, 400, 210, { fill: '#c9714f' }) + circle(400, 400, 160, { fill: '#e1a96c' }) + circle(400, 400, 110, { fill: '#ecd9b0' });
      return s;
    },
  },

  // ------------------------------------------------------------------------------------------------ Strand
  {
    slug: 'strand-muschel', name: 'Muschel', w: 560, h: 520, palettes: ['boho'], fit: 14,
    tags: ['Muschel', 'Jakobsmuschel', 'Strand', 'Meer', 'Sommer', 'Maritim', 'Hochzeit', 'Urlaub'],
    draw() {
      let s = '';
      const cx = 280, cy = 440;
      const fan = new Path().M(cx, cy);
      for (let i = 0; i <= 16; i++) { const a = rad(-170 + i * (160 / 16)); const rr = 380 + (i % 2 ? 0 : 22); fan.L(cx + Math.cos(a) * rr * 0.72, cy + Math.sin(a) * rr * 0.9); }
      s += path(fan.Z(), { fill: '#f0b99a', stroke: '#d98d6a', 'stroke-width': 8, 'stroke-linejoin': 'round' });
      const rib = new Path();
      for (let i = 1; i < 16; i++) { const a = rad(-170 + i * (160 / 16)); rib.M(cx, cy).L(cx + Math.cos(a) * 340 * 0.72, cy + Math.sin(a) * 340 * 0.9); }
      s += path(rib, { fill: 'none', stroke: '#d98d6a', 'stroke-width': 7, 'stroke-linecap': 'round' });
      s += path(L.rrect(cx - 70, cy - 12, 140, 60, 20), { fill: '#e6a07f', stroke: '#d98d6a', 'stroke-width': 8 });
      return s;
    },
  },
  {
    slug: 'seestern-koralle', name: 'Seestern', w: 560, h: 560, palettes: ['boho'], fit: 14,
    tags: ['Seestern', 'Strand', 'Meer', 'Sommer', 'Maritim', 'Hochzeit', 'Urlaub', 'Küste'],
    draw() {
      const pts = [];
      for (let i = 0; i < 10; i++) { const a = rad(-90 + i * 36), rr = i % 2 ? 90 : 270; pts.push([280 + Math.cos(a) * rr, 290 + Math.sin(a) * rr]); }
      let s = path(L.smooth(pts, true).d ? roundPoly(pts) : '', { fill: '#e8896a', stroke: '#e8896a', 'stroke-width': 40, 'stroke-linejoin': 'round' });
      const dots = [];
      for (let i = 0; i < 5; i++) { const a = rad(-90 + i * 72); for (let k = 1; k <= 4; k++) dots.push({ x: 280 + Math.cos(a) * k * 52, y: 290 + Math.sin(a) * k * 52, r: 9 - k, fill: '#f6d2b8' }); }
      s += L.dots(dots);
      return s;
      function roundPoly(p2) { return L.poly(p2, true); }
    },
  },
  {
    slug: 'segelboot', name: 'Segelboot', w: 640, h: 640, palettes: ['navy', 'weiss'], fit: 14,
    tags: ['Segelboot', 'Boot', 'Segel', 'Meer', 'Strand', 'Maritim', 'Hochzeit', 'Sommer', 'Urlaub'],
    draw(c) {
      const { p } = c;
      let s = path(L.poly([[320, 40], [320, 440], [110, 440]], true), { fill: p.ink }) + path(L.poly([[350, 120], [350, 440], [520, 440]], true), { fill: p.ink, 'fill-opacity': 0.75 });
      s += path(new Path().M(60, 480).L(580, 480).L(520, 570).L(120, 570).Z(), { fill: p.ink });
      s += path(new Path().M(40, 610).C(120, 580, 180, 640, 260, 610).C(340, 580, 400, 640, 480, 610).C(530, 592, 570, 600, 600, 610), { fill: 'none', stroke: p.ink, 'stroke-width': 12, 'stroke-linecap': 'round' });
      return s;
    },
  },

  // ------------------------------------------------------------------------------------------------ Tropisch
  {
    slug: 'monstera-blatt', name: 'Monstera-Blatt', w: 760, h: 820, palettes: ['bunt'], fit: 14,
    tags: ['Monstera', 'Blatt', 'Tropisch', 'Dschungel', 'Urwald', 'Sommer', 'Hochzeit', 'grün', 'Palme'],
    draw() {
      const cx = 380, cy = 400;
      let s = '';
      const bounds = [-92, -58, -24, 10, 44, 88];
      const Rs = [270, 330, 350, 350, 300];
      for (const side of [1, -1]) {
        bounds.slice(0, -1).forEach((a0, i) => {
          const a1 = bounds[i + 1] - 4, aa0 = a0 + 4;
          const A = (an) => (side > 0 ? an : 180 - an);
          const R = Rs[i];
          const lobe = new Path();
          const P0 = (an, r) => [cx + Math.cos(rad(A(an))) * r, cy + Math.sin(rad(A(an))) * r];
          const q0 = P0(aa0, 40), q1 = P0(a1, 40);
          lobe.M(q0[0], q0[1]);
          const o0 = P0(aa0, R * 0.92);
          lobe.L(o0[0], o0[1]);
          lobe.arc(cx, cy, R, R, A(aa0), A(a1), false);
          lobe.L(q1[0], q1[1]).Z();
          s += path(lobe, { fill: i % 2 ? '#2f8a5b' : '#34945f', stroke: i % 2 ? '#2f8a5b' : '#34945f', 'stroke-width': 30, 'stroke-linejoin': 'round' });
        });
      }
      s += circle(cx, cy, 70, { fill: '#34945f' });
      s += path(new Path().M(cx, 760).L(cx, cy - 100), { fill: 'none', stroke: '#1f6b45', 'stroke-width': 14, 'stroke-linecap': 'round' });
      const v = new Path();
      for (const side of [1, -1]) bounds.slice(0, -1).forEach((a0, i) => { const am = (a0 + bounds[i + 1]) / 2, an = side > 0 ? am : 180 - am; v.M(cx + Math.cos(rad(an)) * 50, cy + Math.sin(rad(an)) * 50).L(cx + Math.cos(rad(an)) * Rs[i] * 0.8, cy + Math.sin(rad(an)) * Rs[i] * 0.8); });
      s += path(v, { fill: 'none', stroke: '#a8dcb4', 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-opacity': 0.75 });
      return s;
    },
  },
  {
    slug: 'palmenblatt', name: 'Palmenblatt', w: 900, h: 700, palettes: ['bunt'], fit: 14,
    tags: ['Palme', 'Palmenblatt', 'Palmwedel', 'Tropisch', 'Strand', 'Sommer', 'Hochzeit', 'grün', 'Urlaub'],
    draw(c) {
      const curve = new Curve([[60, 640], [260, 420], [520, 300], [840, 330]]);
      let s = path(M.stem(curve, 14, 4), { fill: '#1f6b45' });
      for (let i = 0; i < 18; i++) {
        const t = 0.06 + i * 0.052, { p, angle } = curve.at(t);
        const len = 250 * Math.sin(Math.PI * (0.15 + t * 0.85)) + 40;
        for (const side of [-1, 1]) {
          const l = leaf(len, len * 0.1, { belly: 0.4, sharp: 0.9, bend: side * 0.12 });
          s += path(l.whole.transform(place(p[0], p[1], angle + side * (62 - t * 10), 1, side > 0)), { fill: i % 2 ? '#2f8a5b' : '#3c9d6a' });
        }
      }
      return s;
    },
  },
  {
    slug: 'hibiskus', name: 'Hibiskusblüte', w: 700, h: 700, palettes: ['bunt'], fit: 14,
    tags: ['Hibiskus', 'Blüte', 'Blume', 'Tropisch', 'Hawaii', 'Sommer', 'Hochzeit', 'Urlaub', 'pink'],
    draw() {
      let s = '';
      for (let i = 0; i < 5; i++) {
        const a = -90 + i * 72;
        s += path(L.petal(290, 150, { belly: 0.7 }).transform(place(350, 350, a, 1)), { fill: '#ff5d7a' });
        s += path(L.petal(150, 70, { belly: 0.65 }).transform(place(350, 350, a, 1)), { fill: '#c91f4a', 'fill-opacity': 0.8 });
      }
      s += path(new Path().M(350, 350).C(360, 280, 380, 220, 430, 150), { fill: 'none', stroke: '#ffd23f', 'stroke-width': 14, 'stroke-linecap': 'round' });
      s += L.dots([{ x: 430, y: 150, r: 16, fill: '#e0a43c' }, { x: 410, y: 176, r: 10, fill: '#e0a43c' }, { x: 446, y: 186, r: 10, fill: '#e0a43c' }, { x: 396, y: 210, r: 9, fill: '#e0a43c' }]);
      return s;
    },
  },
  {
    slug: 'flamingo', name: 'Flamingo', w: 640, h: 900, palettes: ['bunt'], fit: 14,
    tags: ['Flamingo', 'Vogel', 'Tropisch', 'Sommer', 'Hochzeit', 'rosa', 'Urlaub', 'Pool'],
    draw() {
      let s = '';
      const pink = '#ff8fab', dk = '#e5638a';
      s += sl([[330, 600], [345, 740], [340, 860]], 10, dk) + sl([[340, 860], [370, 874], [400, 872]], 9, dk);
      s += path(ribbon([[200, 520], [160, 400], [250, 300], [270, 200], [240, 120], [300, 70]], (t) => lerp(52, 26, t)), { fill: pink });
      s += path(L.ellipsePath(330, 520, 190, 110, -18), { fill: pink });
      s += path(L.ellipsePath(300, 520, 100, 58, -20), { fill: dk, 'fill-opacity': 0.55 });
      s += path(new Path().M(270, 70).C(300, 40, 360, 54, 358, 100).C(340, 90, 300, 100, 290, 110).Z(), { fill: '#2a2530' }) + path(new Path().M(240, 70).C(250, 40, 290, 36, 306, 56).L(270, 100).Z(), { fill: pink });
      s += circle(268, 74, 6, { fill: '#2a2530' });
      return s;
    },
  },
  {
    slug: 'ananas', name: 'Ananas', w: 560, h: 840, palettes: ['bunt'], fit: 14,
    tags: ['Ananas', 'Frucht', 'Tropisch', 'Sommer', 'Hochzeit', 'Urlaub', 'gelb', 'Hawaii'],
    draw() {
      let s = '';
      [[-48, 150], [-24, 190], [0, 210], [24, 190], [48, 150], [-72, 110], [72, 110]].forEach(([a, len], i) => { s += path(leaf(len, len * 0.12, { belly: 0.4, sharp: 0.9 }).whole.transform(place(280, 270, -90 + a, 1)), { fill: i % 2 ? '#2f8a5b' : '#3c9d6a' }); });
      s += path(L.ellipsePath(280, 540, 190, 270), { fill: '#ffc933' });
      const grid = new Path();
      for (let i = -6; i <= 6; i++) { grid.M(280 + i * 60 - 300, 300 - 80).L(280 + i * 60 + 300, 780 + 80).M(280 + i * 60 + 300, 300 - 80).L(280 + i * 60 - 300, 780 + 80); }
      s += `<clipPath id="a"><path d="${L.ellipsePath(280, 540, 190, 270).d()}" /></clipPath>` ? '' : '';
      s += path(L.ellipsePath(280, 540, 190, 270), { fill: 'none', stroke: '#d99410', 'stroke-width': 10 });
      const dots = [];
      for (let y = 330; y < 780; y += 56) for (let x = 130; x < 440; x += 56) { const o = ((y - 330) / 56) % 2 ? 28 : 0; const px = x + o, dx = (px - 280) / 190, dy = (y - 540) / 270; if (dx * dx + dy * dy < 0.72) dots.push({ x: px, y, r: 7, fill: '#d99410' }); }
      s += L.dots(dots);
      return s;
    },
  },

  // ------------------------------------------------------------------------------------------------ Winter
  {
    slug: 'eiskristall', name: 'Eiskristall', w: 700, h: 700, palettes: ['weiss', 'navy', 'gold'], fit: 14,
    tags: ['Eiskristall', 'Schneeflocke', 'Kristall', 'Winter', 'Eis', 'Schnee', 'Weihnachten', 'Hochzeit'],
    draw(c) {
      const { p } = c;
      const arm = new Path().M(0, 0).L(300, 0).M(110, 0).L(180, -70).M(110, 0).L(180, 70).M(200, 0).L(260, -56).M(200, 0).L(260, 56);
      let s = '';
      for (let i = 0; i < 6; i++) s += path(arm.transform(compose(move(350, 350), rotm(i * 60))), { fill: 'none', stroke: p.ink, 'stroke-width': 18, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
      s += path(L.poly(Array.from({ length: 6 }, (_, i) => [350 + Math.cos(rad(i * 60 + 30)) * 52, 350 + Math.sin(rad(i * 60 + 30)) * 52]), true), { fill: p.ink });
      return s;
    },
  },
  {
    slug: 'schneezweig', name: 'Zweig mit Schneeflocken', w: 1000, h: 520, palettes: ['weiss', 'navy'], fit: 14,
    tags: ['Zweig', 'Schneeflocken', 'Winter', 'Schnee', 'Weihnachten', 'Hochzeit', 'kahl', 'Ast'],
    draw(c) {
      const { p, r } = c;
      let s = '';
      const main = new Curve([[20, 400], [300, 330], [600, 250], [980, 140]]);
      s += path(M.stem(main, 14, 3), { fill: p.ink });
      for (const [t, a, len] of [[0.2, -50, 200], [0.4, 55, 160], [0.55, -45, 190], [0.72, 50, 130], [0.85, -40, 110]]) {
        const { p: pt, angle } = main.at(t);
        const br = new Curve([pt, [pt[0] + Math.cos(rad(angle + a)) * len * 0.5, pt[1] + Math.sin(rad(angle + a)) * len * 0.5], [pt[0] + Math.cos(rad(angle + a * 0.7)) * len, pt[1] + Math.sin(rad(angle + a * 0.7)) * len]]);
        s += path(M.stem(br, 7, 2), { fill: p.ink });
      }
      const flake = (x, y, R) => { let o = ''; const arm = new Path().M(0, 0).L(R, 0).M(R * 0.5, 0).L(R * 0.75, -R * 0.25).M(R * 0.5, 0).L(R * 0.75, R * 0.25); for (let i = 0; i < 6; i++) o += path(arm.transform(compose(move(x, y), rotm(i * 60))), { fill: 'none', stroke: p.ink, 'stroke-width': Math.max(4, R * 0.1), 'stroke-linecap': 'round' }); return o; };
      for (const [x, y, R] of [[330, 140, 54], [610, 100, 44], [780, 330, 60], [150, 250, 34], [900, 40, 30], [520, 420, 36]]) s += flake(x, y, R);
      return s;
    },
  },
  {
    slug: 'stechpalme', name: 'Stechpalmenzweig', w: 760, h: 520, palettes: ['bunt'], fit: 14,
    tags: ['Stechpalme', 'Ilex', 'Beeren', 'Zweig', 'Winter', 'Weihnachten', 'Hochzeit', 'rot', 'grün'],
    draw() {
      let s = '';
      const holly = (x, y, a, len) => {
        const pts = [];
        for (let i = 0; i <= 12; i++) { const t = i / 12, w = Math.sin(Math.PI * t) * len * 0.22 * (1 + 0.18 * (i % 2 ? 1 : -1) * (i > 0 && i < 12 ? 1 : 0)); pts.push([t * len, -w]); }
        for (let i = 12; i >= 0; i--) { const t = i / 12, w = Math.sin(Math.PI * t) * len * 0.22 * (1 + 0.18 * (i % 2 ? -1 : 1) * (i > 0 && i < 12 ? 1 : 0)); pts.push([t * len, w]); }
        return path(L.poly(pts, true).transform(place(x, y, a, 1)), { fill: '#2f6a45', stroke: '#2f6a45', 'stroke-width': 6, 'stroke-linejoin': 'round' })
          + path(new Path().M(0, 0).L(len * 0.92, 0).transform(place(x, y, a, 1)), { fill: 'none', stroke: '#9ad0a8', 'stroke-width': 4, 'stroke-linecap': 'round' });
      };
      s += sl([[40, 440], [300, 360], [600, 280]], 9, '#6e4f2a');
      s += holly(200, 390, -40, 260) + holly(210, 395, 35, 250) + holly(420, 330, -50, 240) + holly(430, 330, 20, 250) + holly(560, 290, -10, 190);
      for (const [x, y] of [[360, 350], [400, 370], [380, 320], [560, 290], [590, 310]]) s += circle(x, y, 28, { fill: '#d62f45' }) + circle(x - 8, y - 9, 8, { fill: '#ffffff', 'fill-opacity': 0.6 });
      return s;
    },
  },
];

module.exports = { pieces };
