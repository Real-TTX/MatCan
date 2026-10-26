'use strict';
// Group "Motive", batch V1 (Kindergeburtstag II): themed illustrations for the children's invitations (racing, princess, magic school, horses, knights, fairies, heroes,
// police, building site, farm, jungle, mermaid, ninja, gamer, detective, circus, camping, railway, ballet, pyjama party). Flat, friendly, few colours, fixed colours
// (one palette entry "bunt" = one file per drawing). Own drawings, no protected characters or logos.
const L = require('./lib');
const { Path, path, g, ellipsePath, rrect, poly, smooth, starPath, sparkle, rad } = L;

const ex = (o) => { const r = Object.assign({}, o); delete r.rot; return r; };
const E = (cx, cy, rx, ry, fill, o) => path(ellipsePath(cx, cy, rx, ry, (o && o.rot) || 0), Object.assign({ fill }, ex(o)));
const C = (cx, cy, r, fill, o) => E(cx, cy, r, r, fill, o);
const R = (x, y, w, h, r, fill, o) => path(rrect(x, y, w, h, r), Object.assign({ fill }, o));
const PG = (pts, fill, o) => path(poly(pts, true), Object.assign({ fill }, o));
const SM = (pts, fill, o) => path(smooth(pts, true), Object.assign({ fill }, o));
const LN = (pts, stroke, w, o) => path(poly(pts, false), Object.assign({ fill: 'none', stroke, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, o));
const SL = (pts, stroke, w, o) => path(smooth(pts, false), Object.assign({ fill: 'none', stroke, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, o));
const D = (d, fill, o) => path(d, Object.assign({ fill }, o));
const DS = (d, stroke, w, o) => path(d, Object.assign({ fill: 'none', stroke, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, o));
const ARC = (cx, cy, rx, ry, a0, a1, stroke, w, o) => path(new Path().arc(cx, cy, rx, ry, a0, a1, true), Object.assign({ fill: 'none', stroke, 'stroke-width': w, 'stroke-linecap': 'round' }, o));
const STAR = (cx, cy, ro, ri, fill, rot, pts) => path(starPath(cx, cy, ro, ri, pts || 5, rot === undefined ? -90 : rot), { fill });
const SPARK = (cx, cy, r, fill) => path(sparkle(cx, cy, r), { fill });
const MIR = (w, ...kids) => g({ transform: `translate(${w} 0) scale(-1 1)` }, ...kids);
const T = (x, y, ...kids) => g({ transform: `translate(${x} ${y})` }, ...kids);
const ROT = (deg, cx, cy, ...kids) => g({ transform: `rotate(${deg} ${cx} ${cy})` }, ...kids);
const SHADOW = (cx, cy, rx) => E(cx, cy, rx, rx * 0.07, '#1b2a41', { 'fill-opacity': 0.13 });
const eye = (x, y, r, o) => C(x, y, r, '#2b2230') + C(x - r * 0.3, y - r * 0.3, r * 0.34, '#ffffff');

const pieces = [];
const add = (slug, name, w, h, tags, draw) => pieces.push({ slug, name, w, h, palettes: ['bunt'], tags: ['Motiv', 'Kinder', 'Kindergeburtstag', ...tags], draw });

// ------------------------------------------------------------------------------------------------------------------------ Rennfahrer
add('rennwagen', 'Rennwagen', 640, 300, ['Rennwagen', 'Auto', 'Rennfahrer', 'Formel', 'Rennen', 'Jungen'], () => {
  const wheel = (x, y, r) => C(x, y, r, '#222831') + C(x, y, r * 0.52, '#cfd6df') + C(x, y, r * 0.2, '#222831') + ARC(x, y, r * 0.77, r * 0.77, 200, 290, '#4a5360', r * 0.1);
  return [
    SHADOW(320, 268, 290),
    R(528, 62, 92, 15, 5, '#1b2a41'), R(588, 62, 15, 100, 5, '#1b2a41'), R(548, 76, 16, 70, 4, '#33415c'),
    D('M30 228C62 212 150 198 232 186L262 152C280 132 320 126 344 140L374 114L432 114L472 162L578 172L594 236L482 248L122 248C70 248 38 242 30 228Z', '#e63946'),
    D('M232 186L262 152C280 132 320 126 344 140L350 150L286 150L262 186Z', '#c42a37'),
    D('M120 248L482 248L594 236L588 222L110 226Z', '#c42a37'),
    D('M374 114L432 114L472 162L420 160L394 136Z', '#f0626d'),
    C(306, 136, 22, '#ffd23f'), D('M290 128C306 120 330 124 330 136L330 144L288 146Z', '#2b3a55'),
    R(346, 190, 70, 20, 10, '#ffffff'), C(382, 200, 0.1, '#fff'),
    R(24, 238, 160, 13, 5, '#1b2a41'), R(24, 220, 13, 32, 4, '#1b2a41'),
    wheel(504, 214, 54), wheel(150, 222, 44),
  ].join('');
});

add('zielflagge', 'Zielflagge', 420, 540, ['Zielflagge', 'Karo', 'Flagge', 'Rennfahrer', 'Ziel', 'Rennen'], () => {
  const cols = 6, rows = 5, s = 52, x0 = 62, y0 = 50;
  const pt = (i, j) => [x0 + i * s, y0 + j * s * 0.92 + 14 * Math.sin((i / cols) * Math.PI * 2.2 + 0.4) * (0.4 + i / cols)];
  const out = [R(40, 40, 14, 480, 7, '#8a95a5'), C(47, 36, 16, '#ffc633'), C(41, 30, 5, '#ffe9a3')];
  const edge = [];
  for (let i = 0; i <= cols; i++) edge.push(pt(i, 0));
  for (let j = 1; j <= rows; j++) edge.push(pt(cols, j));
  for (let i = cols - 1; i >= 0; i--) edge.push(pt(i, rows));
  for (let j = rows - 1; j >= 1; j--) edge.push(pt(0, j));
  out.push(PG(edge, '#ffffff', { stroke: '#cfd6df', 'stroke-width': 3, 'stroke-linejoin': 'round' }));
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) if ((i + j) % 2 === 0) out.push(PG([pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)], '#222831'));
  return out.join('');
});

add('rennhelm', 'Rennhelm', 420, 400, ['Helm', 'Rennhelm', 'Rennfahrer', 'Motorsport'], () => [
  SHADOW(205, 372, 150),
  D('M56 230C40 110 130 40 222 44C322 50 366 140 356 232L356 306C356 336 336 356 306 356L128 356C88 356 56 306 56 230Z', '#e63946'),
  D('M56 230C50 170 76 110 120 78C112 140 120 250 150 356L128 356C88 356 56 306 56 230Z', '#c42a37'),
  D('M178 164C178 142 198 132 218 132L338 138C354 142 356 154 354 164L354 214C354 236 338 244 322 244L206 244C186 244 178 228 178 206Z', '#263248'),
  D('M196 150L330 154L330 164L196 160Z', '#ffffff', { 'fill-opacity': 0.35 }),
  R(176, 266, 180, 26, 13, '#c42a37'),
  C(112, 262, 38, '#ffffff'), C(112, 262, 22, '#ffd23f'), STAR(112, 262, 20, 8, '#e63946'),
  D('M200 46C240 38 290 50 320 84', 'none', { stroke: '#ffffff', 'stroke-width': 10, 'stroke-linecap': 'round', 'stroke-opacity': 0.55 }),
].join(''));

add('pokal', 'Pokal', 300, 380, ['Pokal', 'Sieger', 'Gewinner', 'Preis', 'Rennfahrer', 'Wettkampf'], () => [
  ARC(80, 112, 54, 50, 92, 268, '#f0a81a', 16), ARC(220, 112, 54, 50, -88, 88, '#f0a81a', 16),
  D('M62 38L238 38L226 160C220 214 188 240 150 242C112 240 80 214 74 160Z', '#ffc633'),
  D('M62 38L96 38L106 176C108 206 122 226 142 238C106 232 80 210 74 160Z', '#ffe08a'),
  STAR(152, 118, 40, 17, '#fff4cf'),
  R(132, 238, 36, 52, 8, '#f0a81a'), R(92, 288, 116, 26, 9, '#ffc633'), R(70, 312, 160, 44, 10, '#b4801a'), R(88, 324, 124, 8, 4, '#e8b64a'),
].join(''));

add('karoband', 'Karoband', 1200, 120, ['Karo', 'Zielflagge', 'Rennfahrer', 'Band', 'Streifen', 'Trenner', 'Rennen'], () => {
  const out = [R(0, 0, 1200, 120, 0, '#ffffff')];
  let d = '';
  for (let i = 0; i < 20; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2 === 0) d += `M${i * 60} ${j * 60}h60v60h-60z`;
  out.push(D(d, '#222831'));
  return out.join('');
});

// ------------------------------------------------------------------------------------------------------------------------ Prinzessin
add('prinzessinnenkrone', 'Prinzessinnenkrone', 400, 300, ['Krone', 'Prinzessin', 'Königin', 'Königin', 'Gold', 'Märchen'], () => [
  D('M62 214L40 92L124 152L200 62L276 152L360 92L338 214Z', '#ffc633'),
  D('M62 214L40 92L90 128L110 214Z', '#f0a81a'),
  C(38, 86, 17, '#ffd966'), C(200, 52, 18, '#ffd966'), C(362, 86, 17, '#ffd966'),
  R(56, 200, 288, 62, 14, '#f0a81a'), R(56, 200, 288, 22, 11, '#ffd966'),
  C(130, 236, 15, '#ff6fa5'), C(200, 236, 17, '#5ec8f2'), C(270, 236, 15, '#ff6fa5'),
  C(125, 231, 4, '#ffffff'), C(194, 230, 5, '#ffffff'), C(265, 231, 4, '#ffffff'),
  SPARK(70, 40, 20, '#ffd966'), SPARK(336, 36, 14, '#ffd966'),
].join(''));

add('tiara', 'Tiara', 460, 260, ['Tiara', 'Diadem', 'Prinzessin', 'Krone', 'Silber', 'Glitzer'], () => {
  const S = '#b9c4e6';
  const petals = [[60, 50, 10, '#ffffff'], [110, 84, 13, '#8bd3f7'], [160, 118, 15, '#ffd23f'], [230, 160, 22, '#ff6fa5'], [300, 118, 15, '#ffd23f'], [350, 84, 13, '#8bd3f7'], [400, 50, 10, '#ffffff']];
  return [
    ...petals.map(([x, h]) => PG([[x - 20, 200], [x, 204 - h], [x + 20, 200]], S, { stroke: S, 'stroke-width': 10, 'stroke-linejoin': 'round' })),
    ...petals.map(([x, h, r, col]) => C(x, 204 - h - r * 0.4, r, col, { stroke: S, 'stroke-width': 5 })),
    R(30, 196, 400, 34, 17, S), R(30, 196, 400, 12, 6, '#d9e2fb'),
    ...Array.from({ length: 11 }, (_, i) => C(66 + i * 33.4, 216, 7, '#ffffff')),
  ].join('');
});

add('maerchenschloss', 'Märchenschloss', 520, 600, ['Schloss', 'Prinzessin', 'Märchen', 'Burg', 'Rosa', 'Türme'], () => {
  const wall = '#fbd5e5', shade = '#f2b3cf', roof = '#9b6bd6', roofD = '#7e4fb8', win = '#ffe9a8';
  const tower = (x, w, top, rtop, rh) => [
    R(x, top, w, 560 - top, 0, wall), R(x + w * 0.62, top, w * 0.38, 560 - top, 0, shade),
    PG([[x - 12, top], [x + w + 12, top], [x + w / 2, top - rh]], roof), PG([[x + w / 2, top - rh], [x + w + 12, top], [x + w / 2 + 6, top]], roofD),
    R(x + w / 2 - 1.5, top - rh - 44, 3, 46, 0, '#8a95a5'), PG([[x + w / 2 + 1.5, top - rh - 44], [x + w / 2 + 38, top - rh - 30], [x + w / 2 + 1.5, top - rh - 16]], '#ff6f91'),
    D(`M${x + w / 2 - 14} ${top + 90}v-24a14 14 0 0 1 28 0v24z`, win), C(x + w / 2, top + 190, 0.1, win),
  ].join('');
  return [
    R(40, 400, 440, 160, 0, wall), R(40, 400, 440, 20, 0, shade),
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => R(46 + i * 48, 388, 30, 24, 0, wall)),
    tower(62, 92, 300, 0, 120), tower(366, 92, 300, 0, 120), tower(190, 140, 230, 0, 170),
    D('M232 560v-80a28 28 0 0 1 56 0v80z', '#8a54c4'), D('M246 560v-76a14 14 0 0 1 28 0v76z', '#a97be0'), C(278, 526, 4, '#ffd966'),
    D('M98 480v-20a14 14 0 0 1 28 0v20z', win), D('M394 480v-20a14 14 0 0 1 28 0v20z', win),
    D('M240 330v-30a20 20 0 0 1 40 0v30z', win), D('M130 430v-12a10 10 0 0 1 20 0v12z', win),
    SPARK(30, 120, 22, '#ffd966'), SPARK(490, 190, 16, '#ffd966'), SPARK(470, 60, 12, '#ff9fc4'),
  ].join('');
});

add('zauberstab', 'Zauberstab', 300, 420, ['Zauberstab', 'Magie', 'Fee', 'Zauberer', 'Stern', 'Prinzessin'], () => [
  ROT(24, 150, 210,
    R(138, 120, 24, 290, 12, '#7b4a8f'), R(138, 120, 10, 290, 5, '#9b6bb3'), R(130, 190, 40, 14, 5, '#ffd23f'), R(130, 260, 40, 14, 5, '#ffd23f'),
    STAR(150, 78, 74, 32, '#ffd23f'), STAR(150, 78, 46, 20, '#fff0a8')),
  SPARK(52, 60, 26, '#ff9fc4'), SPARK(250, 150, 20, '#8bd3f7'), SPARK(60, 190, 14, '#ffd23f'), C(240, 48, 8, '#ff9fc4'), C(40, 130, 6, '#8bd3f7'),
].join(''));

// ------------------------------------------------------------------------------------------------------------------------ Zauberschule
add('zaubereule', 'Zaubereule', 400, 450, ['Eule', 'Zauberschule', 'Magie', 'Vogel', 'Post', 'Zauberer'], () => [
  R(50, 410, 300, 24, 12, '#6b4a2f'), R(50, 410, 300, 9, 4, '#8a6240'),
  PG([[84, 150], [100, 64], [150, 108]], '#8d5b3a'), PG([[316, 150], [300, 64], [250, 108]], '#8d5b3a'),
  E(200, 270, 134, 158, '#8d5b3a'), E(200, 312, 90, 114, '#f3d9b1'),
  ...[0, 1, 2, 3].flatMap((r) => [0, 1, 2].map((c) => ARC(150 + c * 50, 262 + r * 36, 22, 14, 20, 160, '#d9b98a', 5))),
  E(80, 300, 34, 104, '#6f4528', { rot: 10 }), E(320, 300, 34, 104, '#6f4528', { rot: -10 }),
  C(144, 176, 58, '#f3d9b1'), C(256, 176, 58, '#f3d9b1'),
  C(144, 176, 42, '#ffffff'), C(256, 176, 42, '#ffffff'), C(144, 176, 28, '#ffb703'), C(256, 176, 28, '#ffb703'),
  C(144, 176, 15, '#2b2230'), C(256, 176, 15, '#2b2230'), C(139, 170, 5, '#ffffff'), C(251, 170, 5, '#ffffff'),
  PG([[184, 192], [216, 192], [200, 232]], '#f08a24'),
  E(168, 420, 24, 10, '#f08a24'), E(232, 420, 24, 10, '#f08a24'),
  SPARK(40, 60, 20, '#ffd23f'), SPARK(366, 100, 14, '#8bd3f7'),
].join(''));

add('hexenhut', 'Zauberhut', 420, 380, ['Hut', 'Hexenhut', 'Zauberhut', 'Zauberschule', 'Magie', 'Halloween'], () => [
  E(210, 304, 196, 40, '#3a2563'), E(210, 296, 196, 36, '#4b2f7a'),
  D('M112 296C140 210 168 120 250 36C246 82 292 112 306 296Z', '#4b2f7a'),
  D('M250 36C246 82 292 112 306 296L270 296C268 190 262 100 250 36Z', '#3a2563'),
  D('M122 252C170 262 250 262 300 250L306 296C260 310 160 310 112 296Z', '#ff6fa5'),
  R(176, 252, 56, 50, 8, '#ffd23f'), R(190, 264, 28, 26, 4, '#4b2f7a'),
  SPARK(170, 190, 18, '#ffd23f'), SPARK(250, 150, 12, '#ffd23f'), C(210, 214, 5, '#8bd3f7'),
].join(''));

add('zauberbesen', 'Zauberbesen', 540, 260, ['Besen', 'Zauberbesen', 'Hexe', 'Zauberschule', 'fliegen'], () => ROT(-10, 270, 130,
  R(30, 118, 330, 18, 9, '#7a4b2a'), R(30, 118, 330, 6, 3, '#9a6a44'),
  D('M350 108C410 82 480 72 512 66L512 200C480 192 410 176 350 148Z', '#e3b04b'),
  D('M350 128C410 120 470 116 512 116L512 170C470 168 410 160 350 148Z', '#c98f2e'),
  ...[0, 1, 2, 3, 4].map((i) => LN([[372, 116 + i * 7], [510, 80 + i * 26]], '#a8731f', 3, { 'stroke-opacity': 0.6 })),
  R(326, 98, 40, 62, 8, '#d94b4b'), R(326, 98, 14, 62, 6, '#f26a6a')));

add('zauberkessel', 'Zauberkessel', 380, 360, ['Kessel', 'Zaubertrank', 'Hexe', 'Zauberschule', 'Halloween', 'Trank'], () => [
  SHADOW(190, 344, 130),
  R(78, 306, 34, 38, 12, '#2a2a36'), R(268, 306, 34, 38, 12, '#2a2a36'),
  C(188, 62, 20, '#8fe07f', { 'fill-opacity': 0.9 }), C(238, 38, 12, '#8fe07f', { 'fill-opacity': 0.9 }), C(140, 30, 9, '#8fe07f', { 'fill-opacity': 0.9 }),
  D('M44 130C34 260 84 322 190 322C296 322 346 260 336 130Z', '#34344a'),
  D('M44 130C38 200 52 250 80 282C70 230 72 180 84 130Z', '#4c4c68'),
  E(190, 130, 152, 34, '#4c4c68'), E(190, 132, 130, 24, '#6fd263'), E(190, 128, 100, 14, '#9be88c', { 'fill-opacity': 0.8 }),
  C(150, 126, 8, '#c8f7bd'), C(226, 134, 6, '#c8f7bd'),
  SPARK(60, 70, 18, '#9be88c'), SPARK(330, 90, 14, '#9be88c'),
  ARC(34, 168, 20, 22, 100, 260, '#4c4c68', 10), ARC(346, 168, 20, 22, -80, 80, '#4c4c68', 10),
].join(''));

add('zaubertrank', 'Zaubertrank', 260, 380, ['Trank', 'Zaubertrank', 'Flasche', 'Zauberschule', 'Magie', 'Fläschchen'], () => [
  SHADOW(130, 366, 90),
  R(94, 24, 56, 34, 8, '#b9825a'), R(100, 50, 44, 70, 6, '#dff1ff'),
  C(122, 250, 104, '#dff1ff'),
  D('M22 244C50 256 84 230 122 244C160 258 190 232 222 244A104 104 0 0 1 22 244Z', '#a65cf0'),
  C(100, 290, 12, '#d9b3ff'), C(150, 316, 8, '#d9b3ff'), C(136, 270, 6, '#d9b3ff'), SPARK(150, 196, 14, '#ffffff'),
  ARC(122, 250, 84, 84, 160, 215, '#ffffff', 10, { 'stroke-opacity': 0.8 }),
  STAR(190, 120, 16, 7, '#ffd23f'),
].join(''));

add('zauberbuch', 'Zauberbuch', 380, 320, ['Buch', 'Zauberbuch', 'Zauberschule', 'Magie', 'Schule', 'Zaubersprüche'], () => [
  SHADOW(190, 300, 150),
  R(54, 60, 280, 232, 16, '#fff6e0'), R(40, 44, 284, 232, 16, '#5b3fa8'), R(40, 44, 44, 232, 12, '#432d82'),
  R(98, 62, 210, 196, 10, '#5b3fa8', { stroke: '#ffd23f', 'stroke-width': 6 }),
  STAR(204, 160, 62, 28, '#ffd23f'), STAR(204, 160, 36, 16, '#fff0a8'),
  C(60, 90, 8, '#ffd23f'), C(60, 230, 8, '#ffd23f'),
  SPARK(344, 52, 22, '#ffd23f'), SPARK(24, 20, 12, '#8bd3f7'),
].join(''));

// ------------------------------------------------------------------------------------------------------------------------ Pferde
add('pferdekopf', 'Pferdekopf', 380, 460, ['Pferd', 'Pony', 'Reiterhof', 'Pferdekopf', 'Tier', 'Mähne'], () => [
  SM([[160, 36], [210, 82], [262, 190], [312, 296], [322, 332], [294, 350], [262, 330], [232, 292], [196, 290], [196, 350], [210, 436], [60, 436], [64, 280], [86, 140], [110, 62]], '#a8663a'),
  SM([[262, 282], [316, 290], [326, 330], [296, 350], [262, 332], [246, 304]], '#d9a171'),
  SM([[172, 28], [210, 70], [200, 180], [150, 300], [120, 436], [60, 436], [48, 300], [74, 140], [110, 60]], '#3b2a24'),
  PG([[158, 44], [178, 8], [196, 52]], '#a8663a'), PG([[168, 46], [178, 22], [186, 50]], '#e9b48d'),
  C(232, 148, 13, '#2b2230'), C(228, 143, 4, '#ffffff'),
  E(304, 316, 7, 11, '#6e3f22', { rot: 20 }), SL([[274, 340], [292, 350]], '#6e3f22', 5),
].join(''));

add('hufeisen', 'Hufeisen', 300, 300, ['Hufeisen', 'Glück', 'Pferd', 'Reiterhof', 'Glücksbringer'], () => [
  ARC(150, 156, 92, 100, -62, 242, '#aab6c8', 52, { 'stroke-linecap': 'butt' }),
  ARC(150, 156, 92, 100, -62, 110, '#c9d2de', 18, { 'stroke-linecap': 'butt', 'stroke-opacity': 0.6 }),
  ...[-30, 10, 50, 90, 130, 170, 210].map((a) => C(150 + 92 * Math.cos(rad(a)), 156 + 100 * Math.sin(rad(a)), 6.5, '#5d6b82')),
].join(''));

add('reithelm', 'Reithelm', 380, 280, ['Reithelm', 'Reiten', 'Reiterhof', 'Helm', 'Pferd'], () => [
  SHADOW(180, 262, 150),
  D('M40 200C40 90 110 34 190 34C270 34 320 100 320 200Z', '#2f4f9a'),
  D('M40 200C40 130 66 82 106 54C92 100 96 160 106 200Z', '#244080'),
  D('M268 196C312 190 352 200 360 218C340 232 296 230 268 224Z', '#244080'),
  ...[0, 1, 2].map((i) => LN([[130 + i * 26, 62 + i * 4], [128 + i * 42, 170]], '#7f9be0', 7, { 'stroke-opacity': 0.8 })),
  R(24, 192, 306, 38, 19, '#e63946'), R(24, 192, 306, 12, 6, '#f26a6a'),
  PG([[88, 232], [110, 232], [120, 270], [98, 270]], '#e63946'),
].join(''));

// ------------------------------------------------------------------------------------------------------------------------ Ritter & Burg
add('ritterhelm', 'Ritterhelm', 360, 450, ['Ritter', 'Helm', 'Ritterhelm', 'Mittelalter', 'Burg', 'Federbusch'], () => T(0, 40,
  D('M120 60C110 -10 180 -30 270 20C226 30 214 56 236 80Z', '#d94b4b'),
  D('M70 380L70 190C70 90 120 50 170 50C220 50 270 90 270 190L270 380Z', '#b9c4d6'),
  D('M170 50C220 50 270 90 270 190L270 380L190 380L190 60Z', '#9aa8bf'),
  D('M70 190C70 90 120 50 170 50C130 90 120 200 128 380L70 380Z', '#d4dcea'),
  R(70, 180, 200, 24, 8, '#2b3a55'), R(150, 214, 22, 130, 8, '#2b3a55'),
  ...[0, 1, 2, 3].map((i) => C(222, 240 + i * 28, 6, '#2b3a55')),
  R(60, 370, 220, 24, 10, '#ffc633')));

add('wappenschild', 'Wappenschild', 300, 360, ['Wappen', 'Schild', 'Ritter', 'Mittelalter', 'Burg'], () => [
  D('M30 30L150 30L150 340C110 320 30 270 30 170Z', '#d94b4b'),
  D('M150 30L270 30L270 170C270 270 190 320 150 340Z', '#2f6fd1'),
  D('M30 30L270 30L270 170C270 270 190 320 150 340C110 320 30 270 30 170Z', 'none', { stroke: '#ffc633', 'stroke-width': 14, 'stroke-linejoin': 'round' }),
  STAR(150, 140, 60, 26, '#ffffff'), STAR(150, 140, 34, 15, '#ffc633'),
].join(''));

add('ritterburg', 'Ritterburg', 580, 500, ['Burg', 'Ritter', 'Mittelalter', 'Turm', 'Festung', 'Ritterburg'], () => {
  const stone = '#c3c9d4', shade = '#a2abbb';
  const crenel = (x, w, y) => Array.from({ length: Math.floor(w / 36) }, (_, i) => R(x + i * 36 + 4, y - 22, 20, 24, 0, stone)).join('');
  const tower = (x, w, top) => [
    crenel(x - 8, w + 16, top), R(x - 8, top, w + 16, 22, 0, shade), R(x, top + 22, w, 480 - top - 22, 0, stone), R(x + w * 0.66, top + 22, w * 0.34, 480 - top - 22, 0, shade),
    D(`M${x + w / 2 - 12} ${top + 90}v-30a12 12 0 0 1 24 0v30z`, '#2b3a55'),
  ].join('');
  return [
    R(284, 120, 4, 90, 0, '#8a95a5'), PG([[288, 120], [350, 140], [288, 160]], '#ffc633'),
    R(138, 150, 4, 90, 0, '#8a95a5'), PG([[142, 150], [190, 166], [142, 182]], '#d94b4b'),
    R(438, 150, 4, 90, 0, '#8a95a5'), PG([[442, 150], [490, 166], [442, 182]], '#d94b4b'),
    R(120, 300, 340, 180, 0, stone), R(120, 300, 340, 24, 0, shade), crenel(120, 340, 300),
    tower(30, 110, 170), tower(440, 110, 170),
    D('M240 480v-110a50 50 0 0 1 100 0v110z', '#6b4a2f'), D('M254 480v-104a36 36 0 0 1 72 0v104z', '#8a6240'),
    ...[0, 1, 2, 3, 4].map((i) => R(262 + i * 14, 346, 4, 134, 0, '#4d3420')), R(254, 400, 72, 4, 0, '#4d3420'), R(254, 440, 72, 4, 0, '#4d3420'),
    D('M200 380v-30a10 10 0 0 1 20 0v30z', '#2b3a55'), D('M360 380v-30a10 10 0 0 1 20 0v30z', '#2b3a55'),
  ].join('');
});

add('drache', 'Drache', 580, 440, ['Drache', 'Ritter', 'Märchen', 'Fantasy', 'Feuer', 'Dino'], () => [
  SHADOW(290, 424, 190),
  SL([[150, 330], [90, 350], [50, 330], [30, 290]], '#4faa5c', 40), PG([[16, 270], [48, 250], [40, 300]], '#f08a24'),
  D('M220 260L130 120C190 130 250 170 280 250Z', '#f08a24'), D('M220 260L180 200L260 240Z', '#f6a24e'),
  E(280, 310, 150, 92, '#4faa5c'), E(290, 346, 104, 52, '#cfeaa8'),
  R(184, 366, 46, 54, 20, '#3d8c4a'), R(318, 366, 46, 54, 20, '#3d8c4a'),
  SL([[330, 280], [384, 230], [396, 170]], '#4faa5c', 74),
  ...[[210, 240], [250, 224], [300, 218], [350, 230]].map(([x, y], i) => PG([[x - 14, y + 6], [x + 4, y - 26 - (i % 2) * 6], [x + 20, y + 6]], '#f08a24')),
  E(428, 138, 66, 50, '#4faa5c', { rot: -8 }), E(470, 158, 40, 30, '#7cc47f', { rot: -8 }),
  PG([[384, 100], [388, 56], [416, 96]], '#f08a24'), PG([[418, 92], [434, 54], [448, 96]], '#f08a24'),
  C(430, 122, 12, '#ffffff'), C(433, 124, 7, '#2b2230'), C(484, 148, 4, '#2d6e3a'),
  D('M500 180C530 190 548 176 552 150C544 172 524 176 504 164Z', '#f08a24'),
  D('M500 130C528 100 560 110 556 70C540 94 520 90 504 116Z', '#ffc633'),
].join(''));

add('ritterschwert', 'Ritterschwert', 160, 500, ['Schwert', 'Ritter', 'Mittelalter', 'Waffe'], () => [
  PG([[80, 6], [102, 52], [100, 340], [60, 340], [58, 52]], '#c9d2de'), R(78, 52, 8, 280, 4, '#eef2f7'),
  R(14, 338, 132, 24, 11, '#ffc633'), R(70, 360, 20, 78, 7, '#7a4b2a'), R(70, 380, 20, 6, 2, '#5a3820'), R(70, 404, 20, 6, 2, '#5a3820'),
  C(80, 454, 20, '#ffc633'), C(80, 454, 8, '#d94b4b'),
].join(''));

// ------------------------------------------------------------------------------------------------------------------------ Feen
add('feenfluegel', 'Feenflügel', 520, 400, ['Flügel', 'Fee', 'Feenflügel', 'Elfe', 'Märchen', 'Schmetterling'], () => {
  const wing = [
    SM([[250, 200], [214, 96], [120, 24], [48, 52], [40, 150], [120, 214], [236, 232]], '#f7bfe6'),
    SM([[246, 232], [180, 252], [112, 330], [128, 384], [196, 360], [240, 290]], '#d5b8f5'),
    SM([[250, 204], [216, 112], [130, 52], [84, 82], [92, 150], [150, 200]], '#ffffff', { 'fill-opacity': 0.4 }),
    LN([[248, 210], [160, 120], [70, 70]], '#ffffff', 4, { 'stroke-opacity': 0.7 }), LN([[246, 216], [140, 190], [62, 140]], '#ffffff', 4, { 'stroke-opacity': 0.7 }),
    LN([[244, 240], [180, 300], [130, 360]], '#ffffff', 4, { 'stroke-opacity': 0.7 }),
  ].join('');
  return wing + MIR(520, wing) + SPARK(260, 60, 22, '#ffd23f') + SPARK(430, 340, 14, '#8bd3f7') + SPARK(90, 330, 12, '#ff9fc4');
});

add('fliegenpilz', 'Fliegenpilz', 320, 340, ['Pilz', 'Fliegenpilz', 'Fee', 'Wald', 'Märchen', 'Glückspilz'], () => [
  SHADOW(160, 326, 100),
  D('M112 170C108 250 96 300 78 320L242 320C224 300 212 250 208 170Z', '#fbf1dc'), D('M170 170C170 250 170 300 190 320L242 320C224 300 212 250 208 170Z', '#eadcbd'),
  D('M20 180C20 90 80 20 160 20C240 20 300 90 300 180C300 196 280 190 250 192L70 192C40 190 20 196 20 180Z', '#e63946'),
  D('M20 180C20 120 44 70 84 42C70 90 76 150 90 192L70 192C40 190 20 196 20 180Z', '#c42a37'),
  C(160, 62, 18, '#ffffff'), C(88, 100, 14, '#ffffff'), C(234, 94, 16, '#ffffff'), C(200, 140, 11, '#ffffff'), C(126, 148, 10, '#ffffff'), C(268, 150, 9, '#ffffff'),
  SPARK(298, 40, 16, '#ffd23f'),
].join(''));

add('fee', 'Fee', 400, 520, ['Fee', 'Elfe', 'Märchen', 'Prinzessin', 'Zauberstab', 'Flügel'], () => {
  const wings = [
    SM([[196, 220], [150, 130], [70, 100], [34, 140], [70, 210], [160, 260]], '#f7bfe6'), SM([[196, 250], [140, 290], [100, 340], [140, 360], [190, 310]], '#d5b8f5'),
  ].join('');
  return [
    wings + MIR(392, wings),
    ...[176, 216].map((x) => R(x - 7, 350, 14, 110, 6, '#ffd9bd')),
    E(170, 462, 22, 10, '#ff6fa5'), E(222, 462, 22, 10, '#ff6fa5'),
    D('M150 214L242 214L318 360C280 380 110 380 74 360Z', '#ff8fc2'), D('M200 214L242 214L318 360C290 372 250 376 226 378Z', '#f26aa8'),
    ...[0, 1, 2, 3, 4, 5].map((i) => C(110 + i * 38, 358, 22, '#ffb3d9')),
    R(160, 190, 72, 40, 14, '#ffd23f'), R(174, 198, 44, 8, 4, '#fff0a8'),
    LN([[158, 230], [112, 276]], '#ffd9bd', 12), LN([[238, 230], [292, 190]], '#ffd9bd', 12),
    C(196, 130, 60, '#7a4a2d'), C(196, 134, 46, '#ffd9bd'), C(196, 70, 22, '#7a4a2d'),
    D('M150 124C170 100 210 100 244 124C236 96 210 84 196 84C176 84 154 98 150 124Z', '#7a4a2d'),
    C(180, 138, 5, '#2b2230'), C(214, 138, 5, '#2b2230'), E(168, 154, 9, 6, '#ffb3c7', { 'fill-opacity': 0.8 }), E(226, 154, 9, 6, '#ffb3c7', { 'fill-opacity': 0.8 }),
    ARC(197, 150, 14, 9, 25, 155, '#c25a6e', 3.5),
    ROT(30, 292, 190, R(288, 120, 8, 100, 4, '#9b6bd6'), STAR(292, 108, 26, 12, '#ffd23f')),
    SPARK(350, 60, 18, '#ffd23f'), SPARK(60, 60, 14, '#8bd3f7'),
  ].join('');
});

add('schmetterling-fee', 'Schmetterling', 400, 320, ['Schmetterling', 'Fee', 'Frühling', 'Garten', 'Insekt'], () => {
  const half = [
    SM([[196, 150], [150, 50], [70, 20], [24, 70], [50, 150], [140, 190]], '#ff8fc2'), SM([[196, 170], [150, 230], [100, 290], [140, 300], [190, 250]], '#ffc633'),
    C(80, 76, 20, '#ffffff', { 'fill-opacity': 0.75 }), C(130, 240, 14, '#ffffff', { 'fill-opacity': 0.75 }),
  ].join('');
  return half + MIR(400, half) + E(200, 170, 11, 80, '#4b2f7a') + C(200, 90, 13, '#4b2f7a') + SL([[196, 84], [180, 40], [160, 30]], '#4b2f7a', 4) + SL([[204, 84], [220, 40], [240, 30]], '#4b2f7a', 4);
});

// ------------------------------------------------------------------------------------------------------------------------ Superhelden
add('heldenmaske', 'Heldenmaske', 400, 230, ['Maske', 'Superheld', 'Held', 'Superhelden', 'Verkleidung'], () => [
  D('M20 110C60 40 150 60 200 92C250 60 340 40 380 110C360 190 280 196 240 156L200 136L160 156C120 196 40 190 20 110Z', '#e63946'),
  D('M20 110C60 40 150 60 200 92C170 80 100 76 60 100C50 130 70 160 100 172C60 160 30 140 20 110Z', '#c42a37'),
  E(120, 124, 44, 24, '#ffffff', { rot: 14 }), E(280, 124, 44, 24, '#ffffff', { rot: -14 }),
  E(124, 126, 14, 14, '#2b2230'), E(276, 126, 14, 14, '#2b2230'),
].join(''));

add('heldenumhang', 'Heldenumhang', 340, 440, ['Umhang', 'Cape', 'Superheld', 'Held', 'Superhelden'], () => [
  D('M80 50L260 50C282 200 336 330 312 420C250 396 90 396 28 420C4 330 58 200 80 50Z', '#e63946'),
  D('M170 70C190 200 230 330 300 410C250 396 220 394 176 392C160 270 150 150 130 70Z', '#c42a37'),
  R(64, 24, 212, 42, 20, '#ffd23f'), R(64, 24, 212, 14, 7, '#ffe680'),
  C(170, 46, 12, '#e5a50a'),
].join(''));

add('heldenabzeichen', 'Heldenabzeichen', 360, 360, ['Abzeichen', 'Superheld', 'Emblem', 'Stern', 'Held', 'Wappen'], () => [
  C(180, 180, 160, '#e63946'), C(180, 180, 132, '#ffd23f'), C(180, 180, 112, '#2f6fd1'),
  STAR(180, 184, 86, 38, '#ffffff'), STAR(180, 184, 50, 22, '#ffd23f'),
  ARC(180, 180, 122, 122, 200, 250, '#ffffff', 8, { 'stroke-opacity': 0.5 }),
].join(''));

add('heldenstadt', 'Heldenstadt', 1000, 400, ['Stadt', 'Skyline', 'Häuser', 'Nacht', 'Superheld', 'Detektiv', 'Polizei'], (c) => {
  const out = [];
  const row = (y0, col, win, x0, count, wmin, wmax, hmin, hmax) => {
    let x = x0;
    for (let i = 0; i < count && x < 1000; i++) {
      const w = Math.round(c.r.range(wmin, wmax)); const h = Math.round(c.r.range(hmin, hmax));
      out.push(R(x, y0 - h, w, h, 0, col));
      if (c.r.chance(0.25)) out.push(R(x + w / 2 - 3, y0 - h - 36, 6, 40, 3, col));
      const cols = Math.max(1, Math.floor((w - 16) / 26));
      for (let j = 0; j < cols; j++) for (let k = 0; k < Math.floor((h - 30) / 34); k++) if (c.r.chance(0.42)) out.push(R(x + 12 + j * 26, y0 - h + 18 + k * 34, 12, 16, 3, win));
      x += w + Math.round(c.r.range(0, 10));
    }
  };
  row(400, '#4a5a8e', '#8e9fd0', -10, 18, 60, 110, 150, 290);
  row(400, '#2a3563', '#ffe08a', -20, 18, 50, 100, 80, 220);
  return out.join('');
});

add('superheld', 'Superheld', 380, 520, ['Superheld', 'Held', 'Superhelden', 'Kind', 'Umhang', 'Maske'], () => [
  D('M100 170L260 170C290 270 340 380 350 440C270 420 90 420 10 440C20 380 70 270 100 170Z', '#c42a37'),
  R(130, 330, 44, 130, 18, '#2f6fd1'), R(206, 330, 44, 130, 18, '#2f6fd1'),
  R(118, 444, 64, 40, 16, '#e63946'), R(198, 444, 64, 40, 16, '#e63946'),
  R(106, 168, 168, 176, 34, '#2f6fd1'), R(106, 300, 168, 26, 8, '#ffd23f'), R(176, 303, 28, 20, 5, '#e5a50a'),
  C(190, 232, 36, '#ffd23f'), STAR(190, 234, 28, 12, '#e63946'),
  LN([[112, 196], [58, 262], [92, 312]], '#2f6fd1', 38), LN([[268, 196], [322, 262], [288, 312]], '#2f6fd1', 38),
  C(92, 318, 21, '#ffd9bd'), C(288, 318, 21, '#ffd9bd'),
  C(190, 112, 56, '#ffd9bd'), D('M134 104C130 50 250 44 246 104C226 84 156 84 134 104Z', '#7a4a2d'),
  R(130, 92, 120, 34, 16, '#e63946'), E(164, 108, 13, 8, '#ffffff', { rot: 10 }), E(216, 108, 13, 8, '#ffffff', { rot: -10 }),
  C(164, 109, 4.5, '#2b2230'), C(216, 109, 4.5, '#2b2230'),
  ARC(190, 138, 18, 11, 25, 155, '#c25a6e', 4),
].join(''));

// ------------------------------------------------------------------------------------------------------------------------ Polizei
add('polizeiauto', 'Polizeiauto', 620, 310, ['Polizei', 'Auto', 'Polizeiauto', 'Streifenwagen', 'Blaulicht', 'Einsatz'], () => [
  SHADOW(310, 288, 270),
  R(280, 36, 62, 30, 10, '#2f6fd1'), R(312, 36, 30, 30, 10, '#e63946'),
  D('M150 160L190 90C196 78 206 74 220 74L400 74C416 74 428 82 436 94L478 160Z', '#ffffff'),
  D('M178 150L204 100C207 94 211 92 217 92L286 92L286 150Z', '#9ed3f5'), D('M300 150L300 92L396 92C402 92 406 94 410 99L444 150Z', '#9ed3f5'),
  R(36, 150, 548, 100, 30, '#ffffff'), R(36, 192, 548, 28, 0, '#2f6fd1'), R(36, 150, 548, 14, 7, '#e9eef5'),
  STAR(300, 206, 17, 8, '#ffffff'), C(554, 176, 11, '#ffd23f'), C(66, 176, 10, '#e63946'),
  C(150, 252, 46, '#2a2f3a'), C(150, 252, 22, '#cfd6df'), C(470, 252, 46, '#2a2f3a'), C(470, 252, 22, '#cfd6df'),
].join(''));

add('polizeimuetze', 'Polizeimütze', 400, 300, ['Mütze', 'Polizei', 'Polizeimütze', 'Kappe', 'Uniform'], () => [
  SHADOW(200, 282, 150),
  D('M44 170C20 70 90 24 200 24C310 24 380 70 356 170Z', '#2a3a6b'),
  D('M44 170C28 100 60 48 130 32C100 80 100 130 108 170Z', '#1f2c52'),
  R(36, 148, 328, 56, 16, '#1b2442'),
  D('M62 204C130 270 270 270 338 204C336 250 280 286 200 286C120 286 64 250 62 204Z', '#10172e'),
  C(200, 176, 30, '#ffc633'), STAR(200, 177, 22, 10, '#2a3a6b'),
].join(''));

add('polizeistern', 'Polizeistern', 340, 340, ['Stern', 'Polizei', 'Abzeichen', 'Sheriff', 'Marke'], () => {
  const pts = [], r = 140;
  for (let i = 0; i < 6; i++) { const a = rad(-90 + i * 60); pts.push([170 + r * Math.cos(a), 170 + r * Math.sin(a)]); const b = rad(-60 + i * 60); pts.push([170 + 70 * Math.cos(b), 170 + 70 * Math.sin(b)]); }
  return [
    PG(pts, '#ffc633'), ...pts.filter((_, i) => i % 2 === 0).map(([x, y]) => C(x, y, 16, '#ffd966')),
    C(170, 170, 58, '#2a3a6b'), STAR(170, 172, 42, 18, '#ffc633'),
  ].join('');
});

// ------------------------------------------------------------------------------------------------------------------------ Baustelle
add('bagger', 'Bagger', 640, 430, ['Bagger', 'Baustelle', 'Baufahrzeug', 'Radlader', 'Bauarbeiter', 'Baggern'], () => [
  SHADOW(300, 408, 250),
  D('M426 410C450 340 540 336 612 410Z', '#9a6b43'), D('M470 410C490 364 550 360 590 410Z', '#b7835a'),
  LN([[330, 238], [430, 96]], '#e5a50a', 44), LN([[430, 96], [530, 230]], '#e5a50a', 34),
  LN([[330, 238], [430, 96]], '#ffc633', 32), LN([[430, 96], [530, 230]], '#ffc633', 22),
  LN([[300, 300], [412, 180]], '#8a95a5', 10),
  D('M500 232L592 262L566 322C546 330 520 322 504 304Z', '#6b7689'), D('M500 232L550 250L526 304L504 304Z', '#8a95a5'),
  R(66, 316, 320, 84, 42, '#33415c'), C(108, 358, 26, '#4a5978'), C(344, 358, 26, '#4a5978'), C(226, 358, 26, '#4a5978'),
  R(86, 214, 260, 116, 20, '#ffc633'), R(86, 300, 260, 30, 12, '#e5a50a'), R(60, 232, 50, 90, 16, '#8a95a5'),
  R(120, 130, 150, 96, 16, '#ffc633'), R(136, 144, 118, 66, 10, '#9ed3f5'), R(136, 144, 40, 66, 10, '#cdeafb'),
  R(110, 112, 170, 24, 10, '#e5a50a'),
  C(332, 238, 22, '#e5a50a'), C(332, 238, 10, '#8a95a5'), C(430, 96, 18, '#e5a50a'), C(430, 96, 8, '#8a95a5'),
].join(''));

add('bauhelm', 'Bauhelm', 400, 290, ['Helm', 'Bauhelm', 'Baustelle', 'Bauarbeiter', 'Schutzhelm', 'Handwerker'], () => [
  SHADOW(200, 270, 160),
  D('M60 230C60 110 130 50 200 50C270 50 340 110 340 230Z', '#ffd23f'),
  D('M60 230C60 150 84 90 128 62C112 110 118 180 124 230Z', '#e5a50a'),
  R(168, 40, 64, 196, 12, '#f5b800'), R(180, 46, 14, 184, 6, '#ffe680'),
  R(30, 226, 340, 34, 17, '#f5b800'), R(30, 226, 340, 12, 6, '#ffd23f'),
  D('M250 100C290 110 316 140 322 180', 'none', { stroke: '#ffffff', 'stroke-width': 10, 'stroke-linecap': 'round', 'stroke-opacity': 0.5 }),
].join(''));

add('pylone', 'Pylone', 260, 340, ['Pylone', 'Leitkegel', 'Baustelle', 'Kegel', 'Warnung', 'Straße'], () => [
  SHADOW(130, 322, 100),
  R(34, 276, 192, 38, 9, '#e5600f'),
  D('M110 28L150 28L204 280L56 280Z', '#ff7a1a'), D('M150 28L204 280L170 280Z', '#e5600f'),
  D('M95.2 104L164.8 104L173.7 136L86.3 136Z', '#ffffff'), D('M82 170L178 170L188 206L72 206Z', '#ffffff'),
].join(''));

add('baukran', 'Baukran', 460, 580, ['Kran', 'Baukran', 'Baustelle', 'Bau', 'Hebekran'], () => {
  const zig = (x0, x1, y0, y1, n, col, w) => LN(Array.from({ length: n + 1 }, (_, i) => [i % 2 ? x1 : x0, y0 + ((y1 - y0) * i) / n]), col, w);
  return [
    R(70, 540, 150, 30, 8, '#8a95a5'),
    R(120, 130, 10, 412, 3, '#e5a50a'), R(160, 130, 10, 412, 3, '#e5a50a'), zig(125, 165, 150, 540, 12, '#ffc633', 5),
    R(30, 108, 400, 16, 4, '#ffc633'), R(30, 94, 400, 6, 3, '#e5a50a'), zig(34, 424, 100, 124, 0, '#ffc633', 4),
    ...Array.from({ length: 13 }, (_, i) => LN([[40 + i * 30, 124], [55 + i * 30, 100]], '#e5a50a', 4)),
    R(110, 86, 70, 48, 8, '#33415c'), R(120, 94, 24, 22, 4, '#9ed3f5'),
    R(34, 124, 46, 46, 6, '#8a95a5'),
    LN([[145, 86], [60, 100]], '#8a95a5', 3), LN([[145, 86], [380, 100]], '#8a95a5', 3),
    LN([[360, 124], [360, 340]], '#4a5360', 4), R(344, 338, 32, 14, 4, '#ff7a1a'),
    R(310, 356, 100, 72, 6, '#c28b52'), LN([[310, 392], [410, 392]], '#9a6a38', 5), LN([[360, 356], [360, 428]], '#9a6a38', 5),
  ].join('');
});

// ------------------------------------------------------------------------------------------------------------------------ Bauernhof
add('traktor', 'Traktor', 620, 440, ['Traktor', 'Bauernhof', 'Landwirt', 'Trecker', 'Feld', 'Fahrzeug'], () => [
  SHADOW(310, 418, 270),
  R(486, 130, 16, 100, 6, '#33415c'), R(330, 218, 190, 98, 18, '#e63946'), R(330, 218, 190, 28, 14, '#f26a6a'), R(500, 250, 36, 56, 10, '#b72a36'),
  R(120, 70, 220, 28, 12, '#b72a36'), R(128, 90, 12, 150, 0, '#b72a36'), R(300, 90, 12, 150, 0, '#b72a36'),
  R(140, 92, 160, 150, 14, '#9ed3f5', { 'fill-opacity': 0.9 }), R(140, 92, 50, 150, 14, '#cdeafb'),
  R(120, 232, 240, 90, 20, '#e63946'),
  C(170, 310, 108, '#2a2f3a'), C(170, 310, 74, '#f2c94c'), C(170, 310, 24, '#2a2f3a'),
  ...Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * 360; return LN([[170 + 94 * Math.cos(rad(a)), 310 + 94 * Math.sin(rad(a))], [170 + 111 * Math.cos(rad(a)), 310 + 111 * Math.sin(rad(a))]], '#12151b', 12, { 'stroke-linecap': 'butt' }); }),
  C(460, 354, 62, '#2a2f3a'), C(460, 354, 40, '#f2c94c'), C(460, 354, 14, '#2a2f3a'),
].join(''));

add('kuh', 'Kuh', 540, 430, ['Kuh', 'Bauernhof', 'Tier', 'Milch', 'Rind', 'Weide'], () => [
  SHADOW(280, 414, 200),
  R(176, 310, 40, 90, 16, '#ffffff'), R(210, 316, 40, 84, 16, '#e9eef5'), R(360, 310, 40, 90, 16, '#ffffff'), R(394, 316, 40, 84, 16, '#e9eef5'),
  R(176, 380, 40, 24, 8, '#3a3340'), R(210, 380, 40, 24, 8, '#3a3340'), R(360, 380, 40, 24, 8, '#3a3340'), R(394, 380, 40, 24, 8, '#3a3340'),
  SL([[440, 220], [488, 230], [496, 290]], '#ffffff', 12), C(496, 296, 14, '#3a3340'),
  E(300, 250, 190, 108, '#ffffff'), E(330, 270, 120, 60, '#f3f6fa'),
  E(380, 240, 40, 30, '#3a3340', { rot: 20 }), E(250, 210, 36, 24, '#3a3340', { rot: -10 }), E(310, 300, 30, 20, '#3a3340', { rot: 10 }),
  E(280, 354, 38, 22, '#f7b2b8'),
  D('M100 120C70 120 56 150 60 180C80 170 96 156 104 140Z', '#3a3340'), D('M180 120C210 120 224 150 220 180C200 170 184 156 176 140Z', '#3a3340'),
  PG([[100, 112], [88, 70], [116, 98]], '#f2c94c'), PG([[180, 112], [192, 70], [164, 98]], '#f2c94c'),
  E(140, 190, 84, 82, '#ffffff'), E(140, 230, 54, 38, '#f7b2b8'),
  E(106, 240, 7, 9, '#c9708a'), E(174, 240, 7, 9, '#c9708a'),
  C(104, 168, 9, '#2b2230'), C(176, 168, 9, '#2b2230'), C(101, 164, 3, '#ffffff'), C(173, 164, 3, '#ffffff'),
  E(112, 126, 28, 22, '#3a3340', { rot: -14 }),
].join(''));

add('schwein', 'Schwein', 500, 380, ['Schwein', 'Ferkel', 'Bauernhof', 'Tier', 'rosa'], () => [
  SHADOW(260, 366, 190),
  R(170, 290, 40, 70, 16, '#f48fb1'), R(334, 290, 40, 70, 16, '#f48fb1'), R(210, 296, 36, 64, 16, '#e57a9f'), R(374, 296, 36, 64, 16, '#e57a9f'),
  SL([[420, 200], [460, 190], [450, 240], [476, 250]], '#f48fb1', 10),
  E(290, 220, 170, 108, '#f8a9c4'), E(300, 262, 120, 52, '#fbc2d4'),
  PG([[88, 112], [76, 64], [128, 92]], '#f48fb1'), PG([[168, 100], [200, 56], [214, 106]], '#f48fb1'),
  C(126, 190, 84, '#f8a9c4'), E(78, 216, 40, 32, '#f48fb1'), E(62, 214, 7, 10, '#b2506f'), E(94, 214, 7, 10, '#b2506f'),
  C(124, 160, 10, '#2b2230'), C(121, 156, 3.5, '#ffffff'), E(156, 218, 14, 9, '#f06292', { 'fill-opacity': 0.5 }),
].join(''));

add('huhn', 'Huhn', 380, 420, ['Huhn', 'Henne', 'Bauernhof', 'Tier', 'Vogel', 'Ei'], () => [
  LN([[160, 350], [160, 404]], '#f08a24', 8), LN([[210, 350], [210, 404]], '#f08a24', 8), LN([[140, 404], [180, 404]], '#f08a24', 8), LN([[190, 404], [232, 404]], '#f08a24', 8),
  D('M70 220C30 200 20 150 36 110C60 150 90 170 110 190Z', '#f2c94c'), D('M70 250C20 250 4 200 10 170C40 200 70 210 96 220Z', '#f6e6a0'),
  E(180, 260, 124, 100, '#ffffff'), E(150, 270, 66, 46, '#f1f4f8', { rot: 20 }),
  C(250, 150, 66, '#ffffff'),
  C(224, 70, 20, '#e63946'), C(252, 56, 22, '#e63946'), C(282, 74, 18, '#e63946'),
  PG([[308, 150], [346, 170], [308, 188]], '#f08a24'), E(296, 206, 12, 22, '#e63946'),
  C(272, 138, 8, '#2b2230'), C(269, 135, 3, '#ffffff'),
].join(''));

add('scheune', 'Scheune', 580, 460, ['Scheune', 'Bauernhof', 'Stall', 'Haus', 'Landwirtschaft'], () => [
  R(60, 190, 460, 250, 0, '#d94b4b'), ...Array.from({ length: 9 }, (_, i) => R(60 + i * 51, 190, 3, 250, 0, '#b83a3a')),
  D('M30 210L290 50L550 210L520 224L290 82L60 224Z', '#7a3030'),
  R(210, 290, 160, 150, 4, '#f5e9d6'), R(210, 290, 160, 150, 4, 'none', { stroke: '#ffffff', 'stroke-width': 8 }),
  LN([[216, 296], [364, 434]], '#d94b4b', 12), LN([[364, 296], [216, 434]], '#d94b4b', 12), R(210, 290, 160, 150, 4, 'none', { stroke: '#d94b4b', 'stroke-width': 12 }),
  R(256, 140, 68, 56, 4, '#f5e9d6'), R(256, 140, 68, 56, 4, 'none', { stroke: '#ffffff', 'stroke-width': 6 }), LN([[290, 140], [290, 196]], '#d94b4b', 6), LN([[256, 168], [324, 168]], '#d94b4b', 6),
  R(100, 280, 60, 60, 4, '#f5e9d6'), R(420, 280, 60, 60, 4, '#f5e9d6'), LN([[130, 280], [130, 340]], '#d94b4b', 6), LN([[450, 280], [450, 340]], '#d94b4b', 6),
].join(''));

add('schaf', 'Schaf', 440, 360, ['Schaf', 'Lamm', 'Bauernhof', 'Wolle', 'Tier', 'Weide'], () => [
  SHADOW(220, 346, 160),
  R(130, 270, 18, 66, 8, '#4a4350'), R(190, 274, 18, 62, 8, '#4a4350'), R(270, 274, 18, 62, 8, '#4a4350'), R(326, 270, 18, 66, 8, '#4a4350'),
  ...[[110, 200, 62], [180, 160, 68], [260, 150, 68], [330, 180, 66], [350, 240, 56], [250, 250, 70], [160, 250, 66], [90, 250, 40]].map(([x, y, r]) => C(x + 30, y + 10, r * 0.62, '#ffffff')),
  ...[[170, 200], [250, 190], [320, 230]].map(([x, y]) => C(x, y, 40, '#f1f4f8')),
  E(78, 190, 44, 54, '#4a4350'), E(42, 214, 14, 11, '#6a6272'), C(66, 176, 6, '#ffffff'), C(66, 176, 3, '#2b2230'),
  E(110, 154, 30, 14, '#4a4350', { rot: -30 }), E(96, 172, 28, 12, '#4a4350', { rot: 40 }),
  ...[[104, 120], [134, 112], [92, 142]].map(([x, y]) => C(x, y, 22, '#ffffff')),
].join(''));

// ------------------------------------------------------------------------------------------------------------------------ Dschungel / Safari
add('loewe', 'Löwe', 420, 420, ['Löwe', 'Safari', 'Dschungel', 'Tier', 'Mähne', 'König'], () => {
  const mane = Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * 360; return C(210 + 128 * Math.cos(rad(a)), 214 + 128 * Math.sin(rad(a)), 56, i % 2 ? '#d9822b' : '#c26d1c'); });
  return [
    ...mane, C(210, 214, 150, '#d9822b'),
    C(112, 108, 38, '#f2b84b'), C(308, 108, 38, '#f2b84b'), C(112, 110, 20, '#e9967a'), C(308, 110, 20, '#e9967a'),
    E(210, 224, 112, 118, '#f2b84b'), E(210, 280, 66, 48, '#fbe3a8'),
    D('M190 236L230 236L210 262Z', '#6b3b2a'), LN([[210, 262], [210, 286]], '#6b3b2a', 5), ARC(190, 286, 20, 14, 0, 180, '#6b3b2a', 5), ARC(230, 286, 20, 14, 0, 180, '#6b3b2a', 5),
    C(164, 200, 11, '#2b2230'), C(256, 200, 11, '#2b2230'), C(161, 196, 4, '#ffffff'), C(253, 196, 4, '#ffffff'),
    ...[[-3, 266], [-14, 276], [-4, 284]].map(([dx, y]) => C(210 - 54 + dx * 1.5, y, 2.5, '#c26d1c')), ...[[3, 266], [14, 276], [4, 284]].map(([dx, y]) => C(210 + 54 + dx * 1.5, y, 2.5, '#c26d1c')),
  ].join('');
});

add('giraffe', 'Giraffe', 380, 540, ['Giraffe', 'Safari', 'Dschungel', 'Tier', 'Afrika'], () => [
  D('M130 540L160 250L250 250L282 540Z', '#ffc84a'), D('M226 250L250 250L282 540L238 540Z', '#f2b134'),
  D('M140 120C120 200 120 300 112 540L148 540C150 400 160 260 180 150Z', '#a8582b'),
  ...[[196, 330, 26], [232, 410, 28], [188, 470, 28], [236, 520, 20], [214, 292, 16]].map(([x, y, r]) => E(x, y, r, r * 0.8, '#b8692f', { rot: 20 })),
  LN([[150, 70], [146, 16]], '#a8582b', 10), C(146, 14, 15, '#a8582b'), LN([[214, 64], [222, 12]], '#a8582b', 10), C(222, 10, 15, '#a8582b'),
  E(112, 100, 34, 18, '#f2b134', { rot: 30 }), E(112, 100, 18, 9, '#e8a0a8', { rot: 30 }),
  E(190, 130, 104, 96, '#ffc84a', { rot: -10 }), E(274, 150, 84, 58, '#ffd878', { rot: -6 }), E(338, 160, 34, 30, '#f7dca0', { rot: -6 }),
  E(328, 160, 6, 9, '#a8582b'), C(212, 112, 14, '#2b2230'), C(208, 107, 5, '#ffffff'),
  E(180, 80, 18, 12, '#e29a3a', { rot: 20 }), E(238, 92, 12, 9, '#e29a3a', { rot: 20 }),
].join(''));

add('elefant', 'Elefant', 560, 440, ['Elefant', 'Safari', 'Dschungel', 'Zirkus', 'Tier', 'Rüssel'], () => [
  SHADOW(300, 424, 220),
  R(200, 300, 62, 112, 24, '#9aa7b8'), R(250, 306, 62, 106, 24, '#8896a8'), R(380, 300, 62, 112, 24, '#9aa7b8'), R(430, 306, 62, 106, 24, '#8896a8'),
  SL([[498, 200], [534, 240], [530, 290]], '#9aa7b8', 12),
  E(330, 240, 190, 118, '#aab6c6'), E(330, 290, 130, 56, '#bec8d6'),
  SL([[100, 200], [64, 280], [100, 340], [82, 380]], '#aab6c6', 70), SL([[82, 380], [74, 402]], '#aab6c6', 54),
  C(150, 190, 90, '#aab6c6'),
  E(190, 200, 56, 84, '#8896a8', { rot: -8 }), E(190, 200, 36, 62, '#e9a9b3', { rot: -8 }),
  D('M96 262C84 290 90 320 120 330C112 306 108 286 120 262Z', '#fffdf5'),
  C(130, 170, 10, '#2b2230'), C(127, 166, 3.5, '#ffffff'),
].join(''));

add('affe', 'Affe', 420, 480, ['Affe', 'Dschungel', 'Safari', 'Tier', 'Banane', 'Äffchen'], () => T(10, 10,
  SL([[270, 400], [350, 380], [370, 300], [330, 250]], '#8a5a3c', 22),
  E(200, 380, 100, 86, '#8a5a3c'), E(200, 396, 62, 56, '#f3d9b1'),
  E(100, 420, 36, 22, '#8a5a3c'), E(300, 420, 36, 22, '#8a5a3c'),
  C(70, 168, 44, '#8a5a3c'), C(330, 168, 44, '#8a5a3c'), C(70, 168, 26, '#f3d9b1'), C(330, 168, 26, '#f3d9b1'),
  C(200, 170, 118, '#8a5a3c'),
  C(156, 172, 52, '#f3d9b1'), C(244, 172, 52, '#f3d9b1'), E(200, 214, 74, 60, '#f3d9b1'),
  C(168, 162, 12, '#2b2230'), C(232, 162, 12, '#2b2230'), C(165, 158, 4, '#ffffff'), C(229, 158, 4, '#ffffff'),
  E(188, 196, 5, 7, '#8a5a3c'), E(212, 196, 5, 7, '#8a5a3c'), ARC(200, 214, 28, 18, 20, 160, '#8a5a3c', 5),
));

add('dschungelblatt', 'Dschungelblatt', 440, 460, ['Blatt', 'Monstera', 'Dschungel', 'Tropisch', 'Pflanze', 'Palme'], () => {
  const notchAt = [-2.6, -2.1, -1.55, -0.9, 0.9, 1.55, 2.1, 2.6];
  const pts = [];
  for (let i = 0; i <= 140; i++) {
    const t = -Math.PI + (i / 140) * Math.PI * 2;
    const hx = 16 * Math.sin(t) ** 3, hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    let k = 1;
    const ang = Math.atan2(hx, -hy);
    for (const n of notchAt) { const d = Math.abs(Math.atan2(Math.sin(ang - n), Math.cos(ang - n))); if (d < 0.1) k = Math.min(k, 0.45 + (d / 0.1) * 0.55); }
    pts.push([220 + hx * 12.2 * k, 190 + hy * 12.2 * k + 40]);
  }
  void notchAt;
  return [
    LN([[220, 240], [226, 450]], '#4f9a3f', 12),
    PG(pts, '#4fb356'),
    LN([[220, 244], [220, 70]], '#2f7d3a', 7),
  ].join('');
});

add('safarijeep', 'Safarijeep', 620, 360, ['Jeep', 'Safari', 'Auto', 'Expedition', 'Dschungel', 'Abenteuer'], () => [
  SHADOW(310, 340, 270),
  LN([[170, 80], [170, 170]], '#6b4a2f', 9), LN([[440, 80], [440, 170]], '#6b4a2f', 9), LN([[300, 80], [300, 170]], '#6b4a2f', 9),
  R(140, 60, 330, 26, 13, '#6f9a4a'), R(140, 60, 330, 9, 4, '#8fb868'),
  R(36, 168, 544, 100, 26, '#d9a441'), R(36, 168, 544, 16, 8, '#e8bd66'), R(36, 236, 544, 30, 14, '#b8832b'),
  D('M440 170L468 110C470 104 476 100 482 100L496 100L520 170Z', '#9ed3f5'),
  R(150, 118, 84, 52, 12, '#c28b52'), R(250, 118, 84, 52, 12, '#c28b52'),
  R(548, 190, 36, 26, 8, '#ffe08a'), C(66, 200, 10, '#e63946'),
  C(150, 278, 52, '#2a2f3a'), C(150, 278, 26, '#d9a441'), C(470, 278, 52, '#2a2f3a'), C(470, 278, 26, '#d9a441'),
  C(150, 278, 8, '#2a2f3a'), C(470, 278, 8, '#2a2f3a'),
].join(''));

// ------------------------------------------------------------------------------------------------------------------------ Meerjungfrau
add('meerjungfrauenflosse', 'Meerjungfrauenflosse', 380, 480, ['Meerjungfrau', 'Flosse', 'Schwanz', 'Meer', 'Wasser', 'Schuppen'], () => {
  const scales = [];
  for (let r = 0; r < 7; r++) for (let c = 0; c < 4 - Math.floor(r / 3); c++) {
    const w = 110 - r * 14; const x = 190 - ((4 - Math.floor(r / 3) - 1) * 36) / 2 + c * 36 + (r % 2 ? 18 : 0) - 18 + 0; const y = 40 + r * 40;
    if (x > 190 - w / 2 + 6 && x < 190 + w / 2 - 6) scales.push(ARC(x, y, 20, 20, 10, 170, '#7fe3d8', 4));
  }
  return [
    D('M190 300C150 330 70 350 36 458C100 440 150 420 190 392C230 420 280 440 344 458C310 350 230 330 190 300Z', '#1da0a0'),
    D('M190 316C160 340 100 360 64 436C110 424 156 404 190 380C224 404 270 424 316 436C280 360 220 340 190 316Z', '#35c9bb'),
    D('M126 8L254 8C264 120 244 230 210 322L170 322C136 230 116 120 126 8Z', '#2ec4b6'),
    D('M126 8L160 8C158 120 168 230 184 322L170 322C136 230 116 120 126 8Z', '#1da0a0'),
    ...scales,
    R(110, 0, 160, 26, 13, '#ff8fc2'), C(190, 13, 9, '#ffe9a3'),
    SPARK(40, 120, 18, '#ffd23f'), SPARK(340, 200, 14, '#ffd23f'),
  ].join('');
});

add('jakobsmuschel', 'Muschel', 380, 330, ['Muschel', 'Meer', 'Strand', 'Meerjungfrau', 'Perle', 'Sommer'], () => T(10, 0, (() => {
  const pts = [[180, 292]];
  for (let i = 0; i <= 56; i++) { const a = 200 + (i / 56) * 140; const rr = 218 + 16 * Math.abs(Math.sin((i / 56) * Math.PI * 7)); pts.push([180 + rr * Math.cos(rad(a)) * 0.9, 292 + rr * Math.sin(rad(a))]); }
  return [
    PG(pts, '#f9b3c4'),
    ...Array.from({ length: 9 }, (_, i) => { const a = 200 + (i / 8) * 140; return LN([[180, 292], [180 + 205 * Math.cos(rad(a)) * 0.9, 292 + 205 * Math.sin(rad(a))]], '#ee8aa4', 6); }),
    R(130, 280, 100, 34, 14, '#f4a0b6'), R(150, 296, 60, 14, 7, '#ee8aa4'),
  ].join('');
})()));

add('seestern-orange', 'Seestern', 320, 320, ['Seestern', 'Meer', 'Strand', 'Meerjungfrau', 'Sommer', 'Urlaub'], () => {
  const pts = [];
  for (let i = 0; i < 10; i++) { const a = rad(-90 + i * 36); const r = i % 2 ? 62 : 128; pts.push([160 + r * Math.cos(a), 168 + r * Math.sin(a)]); }
  return [
    PG(pts, '#ff8a4c', { stroke: '#ff8a4c', 'stroke-width': 30, 'stroke-linejoin': 'round' }),
    ...Array.from({ length: 5 }, (_, i) => { const a = rad(-90 + i * 72); return [0.3, 0.52, 0.74].map((k) => C(160 + 128 * k * Math.cos(a), 168 + 128 * k * Math.sin(a), 6 - k * 3, '#ffd2a8')).join(''); }),
    C(160, 168, 10, '#ffd2a8'),
  ].join('');
});

add('seepferdchen', 'Seepferdchen', 280, 440, ['Seepferdchen', 'Meer', 'Meerjungfrau', 'Wasser', 'Tier'], () => {
  const key = [[150, 80, 44], [150, 140, 40], [140, 200, 40], [150, 260, 34], [170, 310, 28], [180, 350, 22], [162, 390, 16], [130, 400, 12], [114, 380, 8]];
  const circles = [];
  for (let i = 0; i < key.length - 1; i++) for (let s = 0; s < 5; s++) { const t = s / 5; circles.push(C(key[i][0] + (key[i + 1][0] - key[i][0]) * t, key[i][1] + (key[i + 1][1] - key[i][1]) * t, key[i][2] + (key[i + 1][2] - key[i][2]) * t, '#ffb22e')); }
  return [
    LN([[110, 60], [54, 64]], '#ffb22e', 26), C(52, 64, 14, '#ffb22e'),
    ...[[190, 130], [190, 190], [196, 250]].map(([x, y], i) => PG([[x - 10, y - 18], [x + 34 - i * 4, y - 6], [x - 10, y + 18]], '#ff7a45')),
    ...circles, E(150, 190, 22, 94, '#ffd88a', { rot: 4 }),
    ...[130, 160, 190, 220, 250].map((y) => ARC(150, y, 24, 8, 0, 180, '#ffb22e', 4)),
    PG([[104, 20], [120, 0], [132, 30]], '#ff7a45'), PG([[130, 14], [150, 0], [160, 34]], '#ff7a45'),
    C(120, 66, 11, '#2b2230'), C(117, 62, 4, '#ffffff'),
  ].join('');
});

// ------------------------------------------------------------------------------------------------------------------------ Ninja
add('ninjakopf', 'Ninjakopf', 380, 380, ['Ninja', 'Kampfsport', 'Maske', 'Stirnband', 'Kopf'], () => [
  C(190, 200, 150, '#2b2f3a'),
  R(70, 148, 240, 92, 46, '#f3cfae'),
  E(138, 192, 30, 20, '#ffffff', { rot: 12 }), E(242, 192, 30, 20, '#ffffff', { rot: -12 }), C(142, 194, 11, '#2b2230'), C(238, 194, 11, '#2b2230'),
  LN([[100, 158], [166, 176]], '#2b2f3a', 10), LN([[280, 158], [214, 176]], '#2b2f3a', 10),
  R(40, 98, 300, 44, 8, '#e63946'), R(40, 98, 300, 12, 4, '#f26a6a'), R(150, 100, 80, 40, 6, '#c9d2de'), STAR(190, 120, 14, 6, '#8a95a5'),
  D('M330 120L372 76L366 132L380 170L336 140Z', '#e63946'), D('M50 120L8 86L16 140L2 176L44 142Z', '#c42a37'),
].join(''));

add('shuriken', 'Wurfstern', 320, 320, ['Shuriken', 'Ninja', 'Wurfstern', 'Kampfsport', 'Stern'], () => [
  PG([[160, 8], [194, 126], [312, 160], [194, 194], [160, 312], [126, 194], [8, 160], [126, 126]], '#8a95a5'),
  PG([[160, 8], [194, 126], [160, 160], [126, 126]], '#aab6c6'), PG([[312, 160], [194, 194], [160, 160], [194, 126]], '#7b8798'), PG([[160, 312], [126, 194], [160, 160], [194, 194]], '#6b7689'), PG([[8, 160], [126, 126], [160, 160], [126, 194]], '#97a3b5'),
  C(160, 160, 32, '#e63946'), C(160, 160, 14, '#2b2f3a'),
].join(''));

add('bambus', 'Bambus', 300, 560, ['Bambus', 'Ninja', 'Asien', 'Pflanze', 'Japan'], () => [
  ...[0, 1, 2].flatMap((i) => [R(110, 30 + i * 170, 50, 160, 14, '#7cc66a'), R(110, 30 + i * 170, 14, 160, 7, '#a2dc8e'), R(102, 182 + i * 170 - 6, 66, 14, 7, '#4f9a3f')]),
  D('M160 130C200 90 250 90 290 70C270 120 220 140 166 142Z', '#5fb352'), D('M110 300C70 260 30 260 6 230C26 290 70 310 108 314Z', '#5fb352'), D('M160 400C204 372 244 372 284 350C264 400 220 420 164 420Z', '#5fb352'),
].join(''));

add('pagode', 'Pagode', 440, 540, ['Pagode', 'Ninja', 'Japan', 'Asien', 'Tempel', 'Dach'], () => {
  const tier = (cx, w, y, h, wall) => [
    R(cx - w * 0.36, y, w * 0.72, h, 0, wall), R(cx - w * 0.36 + w * 0.72 * 0.6, y, w * 0.72 * 0.4, h, 0, '#b83a3a'),
    R(cx - w * 0.08, y + h * 0.3, w * 0.16, h * 0.7, 3, '#ffd23f'),
    D(`M${cx - w / 2} ${y} C${cx - w * 0.3} ${y - 8} ${cx - w * 0.2} ${y - 34} ${cx} ${y - 46}C${cx + w * 0.2} ${y - 34} ${cx + w * 0.3} ${y - 8} ${cx + w / 2} ${y}C${cx + w * 0.54} ${y + 4} ${cx + w * 0.5} ${y + 12} ${cx + w * 0.44} ${y + 14}L${cx - w * 0.44} ${y + 14}C${cx - w * 0.5} ${y + 12} ${cx - w * 0.54} ${y + 4} ${cx - w / 2} ${y}Z`, '#33415c'),
  ].join('');
  return [
    R(214, 8, 12, 60, 4, '#ffc633'), C(220, 12, 12, '#ffc633'),
    tier(220, 150, 100, 64, '#d94b4b'), tier(220, 250, 214, 80, '#d94b4b'), tier(220, 360, 360, 100, '#d94b4b'),
    R(40, 480, 360, 40, 6, '#8a95a5'), R(70, 456, 300, 30, 6, '#aab6c6'),
  ].join('');
});

// ------------------------------------------------------------------------------------------------------------------------ Gamer (generic)
add('gamepad', 'Gamepad', 500, 340, ['Gamepad', 'Controller', 'Gamer', 'Spielen', 'Konsole', 'Videospiel'], () => [
  SHADOW(250, 322, 210),
  D('M120 56C70 56 32 130 22 222C16 286 56 316 98 296C140 276 160 238 182 224L318 224C340 238 360 276 402 296C444 316 484 286 478 222C468 130 430 56 380 56Z', '#5b6ee1'),
  D('M120 56L380 56C400 56 410 62 420 78C380 70 340 74 250 74C160 74 120 70 80 78C90 62 100 56 120 56Z', '#7f8ff0'),
  R(98, 118, 78, 26, 8, '#2b3a55'), R(124, 92, 26, 78, 8, '#2b3a55'),
  C(372, 100, 17, '#ffc633'), C(406, 134, 17, '#e63946'), C(372, 168, 17, '#4cc27a'), C(338, 134, 17, '#3fb6e8'),
  C(184, 196, 34, '#2b3a55'), C(184, 196, 22, '#4a5978'), C(310, 196, 34, '#2b3a55'), C(310, 196, 22, '#4a5978'),
  R(210, 128, 30, 12, 6, '#2b3a55'), R(260, 128, 30, 12, 6, '#2b3a55'),
].join(''));

add('joystick', 'Joystick', 320, 420, ['Joystick', 'Arcade', 'Gamer', 'Spielen', 'Videospiel', 'Retro'], () => [
  SHADOW(160, 404, 120),
  D('M30 400L50 270L270 270L290 400Z', '#2b3a55'), D('M30 400L50 270L90 270L80 400Z', '#4a5978'), R(30, 372, 260, 28, 8, '#1b2438'),
  R(140, 120, 40, 160, 12, '#aab6c6'), R(140, 120, 14, 160, 7, '#cfd6df'),
  C(160, 90, 66, '#e63946'), C(140, 66, 18, '#f58a93'),
  C(70, 316, 20, '#ffc633'), C(250, 316, 20, '#3fb6e8'),
].join(''));

const pixels = (rows, s, fillMap, border) => {
  const out = [];
  if (border) { let d = ''; rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') d += `M${x * s - border} ${y * s - border}h${s + border * 2}v${s + border * 2}h${-(s + border * 2)}z`; })); out.push(D(d, border === 0 ? 'none' : '#2b2230')); }
  const per = new Map();
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') { per.set(ch, (per.get(ch) || '') + `M${x * s} ${y * s}h${s}v${s}h${-s}z`); } }));
  for (const [ch, d] of per) out.push(D(d, fillMap[ch]));
  return out.join('');
};
add('pixelherz-rot', 'Pixelherz', 360, 330, ['Pixel', 'Herz', 'Gamer', 'Retro', 'Videospiel', 'Leben'], () => T(14, 14, pixels([
  '.XXX...XXX.', 'XXWWXXXXXXX', 'XWWXXXXXXXX', 'XWXXXXXXXXX', 'XXXXXXXXXXX', '.XXXXXXXXX.', '..XXXXXXX..', '...XXXXX...', '....XXX....', '.....X.....',
], 30, { X: '#e63946', W: '#ffd0d4' }, 6)));

add('pixelstern-gelb', 'Pixelstern', 330, 330, ['Pixel', 'Stern', 'Gamer', 'Retro', 'Videospiel', 'Punkte'], () => T(14, 14, pixels([
  '....X....', '....X....', '...XWX...', '..XXXXX..', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '..XXXXX..', '.XXX.XXX.', '.XX...XX.',
], 30, { X: '#ffc633', W: '#fff2b3' }, 6)));

add('pixelkrone-gold', 'Pixelkrone', 360, 260, ['Pixel', 'Krone', 'Gamer', 'Retro', 'Sieger', 'Videospiel'], () => T(14, 14, pixels([
  'X....X....X', 'XX..XXX..XX', 'XXXXXXXXXXX', 'XWXXXXXXXXX', 'XXXXRXBXRXX', 'XXXXXXXXXXX',
], 30, { X: '#ffc633', W: '#fff2b3', R: '#e63946', B: '#3fb6e8' }, 6)));

// ------------------------------------------------------------------------------------------------------------------------ Detektiv
add('lupe', 'Lupe', 380, 420, ['Lupe', 'Detektiv', 'Suchen', 'Spurensuche', 'Rätsel', 'Krimi'], () => [
  LN([[238, 238], [330, 350]], '#6b4a2f', 46), LN([[238, 238], [330, 350]], '#8a6240', 18, { 'stroke-opacity': 0.8 }),
  LN([[224, 224], [262, 266]], '#e8b64a', 52, { 'stroke-linecap': 'butt' }),
  C(150, 150, 118, '#e8b64a'), C(150, 150, 98, '#cdeafb'), C(150, 150, 98, 'none', { stroke: '#c28a1c', 'stroke-width': 8 }),
  D('M78 128C90 82 130 60 176 62', 'none', { stroke: '#ffffff', 'stroke-width': 14, 'stroke-linecap': 'round', 'stroke-opacity': 0.85 }),
  SPARK(222, 70, 16, '#ffffff'),
].join(''));

add('detektivhut', 'Detektivhut', 440, 300, ['Hut', 'Detektiv', 'Krimi', 'Spürnase', 'Mütze', 'Ermittler'], () => [
  SHADOW(220, 282, 190),
  E(220, 214, 200, 52, '#7a5236'), E(220, 206, 200, 48, '#8a5a3c'),
  D('M92 206C80 100 130 34 220 34C310 34 360 100 348 206C300 232 140 232 92 206Z', '#a8754c'),
  D('M220 34C310 34 360 100 348 206C330 216 310 220 290 224C310 150 280 80 220 34Z', '#8a5a3c'),
  D('M150 52C190 80 250 80 290 52C250 40 190 40 150 52Z', '#8a5a3c', { 'fill-opacity': 0.6 }),
  D('M90 186C140 224 300 224 350 186L348 206C300 232 140 232 92 206Z', '#3a2a22'),
].join(''));

add('fingerabdruck', 'Fingerabdruck', 320, 400, ['Fingerabdruck', 'Detektiv', 'Spur', 'Krimi', 'Ermittler', 'Beweis'], () => {
  const arcs = [];
  for (let i = 0; i < 11; i++) {
    const rx = 18 + i * 12.5, ry = 24 + i * 15.5;
    const a0 = 180 + (i % 3) * 8, a1 = 360 - (i % 2) * 10;
    arcs.push(ARC(160, 210, rx, ry, a0 - 20, a1 + 20 + (i > 6 ? 70 : 0), '#33415c', 6.5));
  }
  arcs.push(LN([[160, 170], [160, 250]], '#33415c', 6.5));
  return arcs.join('');
});

add('fussspuren', 'Fußspuren', 440, 560, ['Fußspuren', 'Spuren', 'Detektiv', 'Schuhabdruck', 'Krimi', 'Spurensuche'], () => {
  const foot = (x, y, rot, mirror) => ROT(rot, x, y, g({ transform: `translate(${x} ${y}) scale(${mirror ? -1 : 1} 1)` },
    D('M-26 -80C-26 -112 20 -118 28 -84C32 -60 24 -34 22 -10C20 6 0 10 -14 6C-30 0 -26 -50 -26 -80Z', '#5d4a3d'),
    D('M-24 22C-24 4 16 4 20 22C24 50 14 84 -2 86C-18 86 -26 54 -24 22Z', '#5d4a3d')));
  return [foot(130, 120, -12, false), foot(280, 220, -12, true), foot(150, 360, -12, false), foot(300, 460, -12, true)].join('');
});

// ------------------------------------------------------------------------------------------------------------------------ Zirkus
add('zirkuszelt', 'Zirkuszelt', 560, 480, ['Zirkus', 'Zelt', 'Zirkuszelt', 'Manege', 'Show', 'Clown'], () => {
  const n = 8, x0 = 40, x1 = 520, ax = 280, ay = 70, by = 250;
  const wedges = Array.from({ length: n }, (_, i) => {
    const xa = x0 + ((x1 - x0) * i) / n, xb = x0 + ((x1 - x0) * (i + 1)) / n;
    return PG([[ax, ay], [xa, by], [xb, by]], i % 2 ? '#ffffff' : '#e63946');
  });
  const wall = Array.from({ length: n }, (_, i) => { const xa = 60 + (440 * i) / n, w = 440 / n; return R(xa, by, w, 190, 0, i % 2 ? '#ffffff' : '#e63946'); });
  const scallops = Array.from({ length: n }, (_, i) => { const xa = x0 + ((x1 - x0) * i) / n, w = (x1 - x0) / n; return E(xa + w / 2, by, w / 2, 22, i % 2 ? '#ffffff' : '#e63946'); });
  return [
    R(276, 10, 5, 70, 0, '#8a95a5'), PG([[281, 10], [340, 28], [281, 46]], '#ffc633'),
    ...wedges, ...wall, ...scallops,
    D('M230 440C230 340 330 340 330 440Z', '#7a1f2a'), D('M254 440C254 372 306 372 306 440Z', '#3a0f16'),
    R(0, 436, 560, 44, 0, '#f2c94c', { 'fill-opacity': 0.0 }),
    STAR(70, 380, 14, 6, '#ffc633'), STAR(490, 380, 14, 6, '#ffc633'),
  ].join('').replace(/<rect[^>]*fill-opacity="0"[^>]*\/>/, '');
});

add('zirkuszylinder', 'Zylinder', 360, 340, ['Zylinder', 'Zirkus', 'Zauberer', 'Hut', 'Show', 'Magier'], () => [
  SHADOW(180, 322, 150),
  E(180, 270, 160, 38, '#1b2133'), R(78, 54, 204, 220, 20, '#2a3350'), E(180, 54, 102, 24, '#3b4670'),
  R(78, 200, 204, 46, 0, '#e63946'), R(78, 200, 204, 12, 0, '#f26a6a'),
  D('M20 262C60 296 300 296 340 262C330 238 280 252 180 252C80 252 30 238 20 262Z', '#2a3350'),
  STAR(180, 224, 16, 7, '#ffd23f'), SPARK(300, 90, 18, '#ffd23f'), SPARK(58, 120, 14, '#ffffff'),
].join(''));

add('jonglierbaelle', 'Jonglierbälle', 460, 330, ['Jonglieren', 'Bälle', 'Zirkus', 'Artist', 'Show', 'Clown'], () => {
  const ball = (x, y, c, c2) => [C(x, y, 58, c), C(x, y, 58, 'none', { stroke: c2, 'stroke-width': 0 }), ARC(x, y, 42, 42, 200, 320, c2, 12), ARC(x, y, 42, 42, 20, 140, c2, 12), C(x - 20, y - 24, 10, '#ffffff', { 'fill-opacity': 0.6 })].join('');
  return [
    ARC(230, 230, 130, 150, 205, 335, '#8a95a5', 5, { 'stroke-dasharray': '4 16' }),
    ball(90, 230, '#e63946', '#ffd23f'), ball(230, 76, '#2f6fd1', '#ffffff'), ball(370, 230, '#ffc633', '#e63946'),
    SPARK(40, 60, 18, '#ffd23f'), SPARK(420, 80, 14, '#e63946'),
  ].join('');
});

add('clownkopf', 'Clown', 400, 420, ['Clown', 'Zirkus', 'Show', 'Spaß', 'Gesicht', 'Karneval'], () => [
  C(70, 210, 54, '#ff6fa5'), C(60, 140, 44, '#ffc633'), C(80, 280, 44, '#3fb6e8'), C(330, 210, 54, '#4cc27a'), C(340, 140, 44, '#ff6fa5'), C(320, 280, 44, '#ffc633'),
  D('M110 120L200 12L290 120Z', '#2f6fd1'), C(200, 12, 16, '#ffd23f'), R(100, 106, 200, 28, 14, '#e63946'),
  E(200, 236, 110, 120, '#fff5ec'),
  E(150, 202, 24, 32, '#ffffff'), E(250, 202, 24, 32, '#ffffff'), C(150, 210, 12, '#2b2230'), C(250, 210, 12, '#2b2230'),
  STAR(150, 160, 14, 6, '#2f6fd1'), STAR(250, 160, 14, 6, '#2f6fd1'),
  C(200, 252, 36, '#e63946'), C(190, 240, 10, '#f58a93'),
  D('M118 296C140 350 260 350 282 296C250 318 150 318 118 296Z', '#e63946'),
  E(106, 262, 22, 14, '#ffb3c7', { 'fill-opacity': 0.9 }), E(294, 262, 22, 14, '#ffb3c7', { 'fill-opacity': 0.9 }),
].join(''));

// ------------------------------------------------------------------------------------------------------------------------ Camping
add('campingzelt', 'Zelt', 580, 400, ['Zelt', 'Camping', 'Outdoor', 'Wald', 'Zelten', 'Natur'], () => [
  SHADOW(290, 380, 270),
  LN([[100, 330], [20, 360]], '#8a95a5', 4), LN([[480, 330], [560, 360]], '#8a95a5', 4), PG([[14, 358], [30, 366], [22, 374]], '#8a6240'), PG([[566, 358], [550, 366], [558, 374]], '#8a6240'),
  PG([[50, 360], [290, 40], [530, 360]], '#f08a24'), PG([[290, 40], [530, 360], [380, 360]], '#d9710f'),
  PG([[210, 360], [290, 150], [370, 360]], '#2b3a55'), PG([[290, 150], [370, 360], [300, 360]], '#1b2438'),
  LN([[290, 150], [210, 360]], '#ffd23f', 6), LN([[290, 150], [370, 360]], '#ffd23f', 6),
  C(290, 36, 8, '#8a95a5'), R(288, 6, 4, 36, 0, '#8a95a5'), PG([[292, 6], [330, 18], [292, 30]], '#e63946'),
].join(''));

add('lagerfeuer', 'Lagerfeuer', 400, 360, ['Lagerfeuer', 'Feuer', 'Camping', 'Flammen', 'Abend', 'Grillen'], () => [
  SHADOW(200, 342, 150),
  D('M200 20C250 90 300 120 292 200C286 270 240 300 200 300C160 300 112 270 108 200C104 150 140 110 160 80C170 120 190 120 190 90C190 60 190 40 200 20Z', '#e63946'),
  D('M200 90C240 140 266 170 260 220C256 262 230 284 200 284C170 284 144 262 140 220C136 180 166 150 180 130C186 150 200 150 200 90Z', '#ff8a1f'),
  D('M200 170C222 196 234 214 230 240C228 262 214 272 200 272C186 272 172 262 170 240C168 214 186 196 200 170Z', '#ffd23f'),
  ROT(24, 200, 306, R(60, 286, 280, 34, 16, '#7a4b2a'), R(60, 286, 280, 12, 6, '#9a6a44')), ROT(-24, 200, 306, R(60, 286, 280, 34, 16, '#6b4a2f'), R(60, 286, 280, 12, 6, '#8a6240')),
  ...[0, 1, 2, 3, 4, 5, 6].map((i) => E(70 + i * 43, 338, 22, 14, i % 2 ? '#8a95a5' : '#aab6c6')),
  SPARK(90, 130, 14, '#ffd23f'), SPARK(318, 90, 12, '#ff8a1f'), C(330, 150, 5, '#ffd23f'),
].join(''));

add('taschenlampe', 'Taschenlampe', 560, 220, ['Taschenlampe', 'Camping', 'Nacht', 'Licht', 'Abenteuer', 'Schatzsuche'], () => [
  D('M330 90L560 10L560 210L330 130Z', '#ffe680', { 'fill-opacity': 0.45 }), D('M330 100L560 56L560 164L330 120Z', '#fff4b8', { 'fill-opacity': 0.55 }),
  R(30, 78, 230, 64, 20, '#2f6fd1'), R(30, 78, 230, 18, 9, '#5b8fe8'), R(120, 70, 36, 80, 6, '#1f4a99'), R(132, 60, 12, 14, 4, '#ffc633'),
  D('M250 62L330 40L330 180L250 158Z', '#33415c'), R(244, 66, 22, 88, 4, '#4a5978'), E(330, 110, 14, 70, '#fff4b8'),
  R(40, 100, 6, 20, 3, '#ffffff', { 'fill-opacity': 0.3 }),
].join(''));

add('tannenbaum', 'Tannenbaum', 280, 380, ['Tanne', 'Wald', 'Camping', 'Baum', 'Natur', 'Weihnachten'], () => [
  R(120, 300, 40, 70, 6, '#7a4b2a'),
  PG([[140, 100], [226, 220], [54, 220]], '#2f8a4a'), PG([[140, 20], [236, 150], [44, 150]], '#3aa05a'), PG([[140, 170], [262, 320], [18, 320]], '#2f8a4a'),
  PG([[140, 20], [236, 150], [140, 150]], '#2f8a4a', { 'fill-opacity': 0.5 }), PG([[140, 170], [262, 320], [140, 320]], '#26703c', { 'fill-opacity': 0.6 }),
].join(''));

// ------------------------------------------------------------------------------------------------------------------------ Eisenbahn
add('lokomotive', 'Lokomotive', 670, 412, ['Lokomotive', 'Eisenbahn', 'Zug', 'Dampflok', 'Bahn', 'Schiene'], () => [
  SHADOW(330, 388, 300),
  C(530, 30, 22, '#ffffff', { 'fill-opacity': 0.9 }), C(570, 10, 16, '#ffffff', { 'fill-opacity': 0.8 }), C(496, 6, 12, '#ffffff', { 'fill-opacity': 0.7 }),
  D('M470 74L550 74L536 130L484 130Z', '#2b3a55'), R(462, 64, 96, 16, 8, '#1b2438'),
  R(206, 120, 390, 124, 40, '#2b3a55'), R(206, 120, 390, 30, 15, '#4a5978'), R(330, 100, 44, 28, 14, '#ffc633'),
  R(506, 160, 90, 60, 12, '#e63946'), C(596, 182, 18, '#ffe08a'),
  R(40, 76, 190, 190, 12, '#e63946'), R(26, 62, 218, 24, 10, '#b72a36'), R(66, 108, 94, 74, 10, '#9ed3f5'), R(66, 108, 30, 74, 10, '#cdeafb'),
  R(30, 258, 600, 40, 10, '#33415c'), PG([[600, 296], [660, 340], [600, 340]], '#2b3a55'),
  C(130, 320, 62, '#e63946'), C(130, 320, 38, '#ffd23f'), C(130, 320, 12, '#2b3a55'),
  C(290, 330, 52, '#e63946'), C(290, 330, 30, '#ffd23f'), C(290, 330, 10, '#2b3a55'),
  C(480, 344, 38, '#33415c'), C(480, 344, 18, '#aab6c6'), C(570, 344, 38, '#33415c'), C(570, 344, 18, '#aab6c6'),
  LN([[130, 320], [290, 330]], '#aab6c6', 12),
].join(''));

add('waggon', 'Waggon', 530, 330, ['Waggon', 'Eisenbahn', 'Zug', 'Güterwagen', 'Bahn', 'Fracht'], () => [
  SHADOW(260, 306, 230),
  R(50, 62, 420, 170, 14, '#2f6fd1'), R(50, 62, 420, 24, 12, '#4a8be8'), R(40, 52, 440, 18, 8, '#1f4a99'),
  ...[0, 1, 2, 3, 4, 5].map((i) => R(86 + i * 62, 90, 6, 140, 0, '#1f4a99', { 'fill-opacity': 0.5 })),
  R(190, 100, 140, 124, 6, '#ffc633'), R(190, 100, 140, 124, 6, 'none', { stroke: '#e5a50a', 'stroke-width': 6 }), LN([[260, 100], [260, 224]], '#e5a50a', 6),
  R(40, 232, 440, 20, 6, '#33415c'), LN([[40, 242], [10, 242]], '#33415c', 8), LN([[480, 242], [510, 242]], '#33415c', 8),
  C(130, 266, 36, '#2a2f3a'), C(130, 266, 16, '#aab6c6'), C(390, 266, 36, '#2a2f3a'), C(390, 266, 16, '#aab6c6'),
].join(''));

add('gleisband', 'Gleisband', 1200, 120, ['Gleis', 'Schiene', 'Eisenbahn', 'Band', 'Bahn', 'Trenner'], () => [
  ...Array.from({ length: 20 }, (_, i) => R(i * 60 + 12, 10, 36, 100, 4, '#9a6a44')),
  ...Array.from({ length: 20 }, (_, i) => R(i * 60 + 12, 10, 8, 100, 3, '#b8854f')),
  R(0, 30, 1200, 12, 4, '#8a95a5'), R(0, 78, 1200, 12, 4, '#8a95a5'), R(0, 30, 1200, 4, 2, '#cfd6df'), R(0, 78, 1200, 4, 2, '#cfd6df'),
].join(''));

// ------------------------------------------------------------------------------------------------------------------------ Ballett
add('ballettschuhe', 'Ballettschuhe', 460, 400, ['Ballett', 'Tanzen', 'Schuhe', 'Ballerina', 'Spitzenschuhe', 'Tanz'], () => {
  const shoe = (x, y, rot) => ROT(rot, x, y, T(x, y,
    SL([[30, 56], [86, 96], [100, 168]], '#f48fb1', 9), SL([[-30, 56], [-86, 96], [-100, 168]], '#f48fb1', 9),
    SM([[0, -150], [52, -134], [72, -90], [64, -20], [50, 60], [42, 120], [0, 150], [-42, 120], [-50, 60], [-64, -20], [-72, -90], [-52, -134]], '#ffb3c7'),
    E(0, -96, 44, 40, '#ffc9d8'),
    E(0, 66, 40, 64, '#e57a9f'), E(0, 76, 30, 50, '#f9d2dd'),
    ARC(0, 64, 40, 64, 200, 340, '#ffffff', 5, { 'stroke-opacity': 0.8 })));
  return [shoe(140, 200, -10), shoe(320, 200, 10), SPARK(230, 40, 18, '#ffd23f'), SPARK(420, 60, 12, '#ffd23f'), SPARK(36, 340, 12, '#ffd23f')].join('');
});

add('tutu', 'Tutu', 500, 300, ['Tutu', 'Ballett', 'Tanzen', 'Ballerina', 'Rock', 'Tanzrock'], () => [
  D('M200 60L300 60L486 226L14 226Z', '#d5b8f5'),
  ...Array.from({ length: 9 }, (_, i) => E(40 + i * 52.5, 226, 30, 34, '#d5b8f5')),
  D('M210 60L290 60L420 200L80 200Z', '#ffb3d9'),
  ...Array.from({ length: 8 }, (_, i) => E(78 + i * 49, 200, 28, 32, '#ffb3d9')),
  D('M220 60L280 60L350 160L150 160Z', '#ff8fc2'),
  ...Array.from({ length: 5 }, (_, i) => E(160 + i * 45, 160, 26, 30, '#ff8fc2')),
  R(190, 44, 120, 34, 14, '#e5509b'), R(190, 44, 120, 10, 5, '#f58fc3'),
  SPARK(60, 100, 18, '#ffd23f'), SPARK(448, 120, 14, '#ffd23f'),
].join(''));

add('buehnenvorhang-rot', 'Bühnenvorhang', 1000, 1000, ['Vorhang', 'Bühne', 'Theater', 'Ballett', 'Zirkus', 'Rahmen', 'Show'], () => {
  const left = [
    D('M0 0L300 0C250 240 300 640 150 1000L0 1000Z', '#c42a37'),
    D('M60 0L110 0C90 240 130 640 40 1000L0 1000L0 0Z', '#a8222e'),
    D('M170 0L215 0C190 240 230 640 110 1000L70 1000C190 640 140 240 170 0Z', '#e63946', { 'fill-opacity': 0.7 }),
  ].join('');
  return [
    left, MIR(1000, left),
    R(0, 0, 1000, 120, 0, '#a8222e'),
    ...Array.from({ length: 10 }, (_, i) => E(50 + i * 100, 120, 50, 44, '#c42a37')),
    ...Array.from({ length: 10 }, (_, i) => E(50 + i * 100, 118, 50, 20, '#ffc633')),
    R(0, 0, 1000, 78, 0, '#c42a37'), R(0, 70, 1000, 14, 0, '#ffc633'),
    ...Array.from({ length: 10 }, (_, i) => C(50 + i * 100, 156, 10, '#ffc633')),
  ].join('');
});

// ------------------------------------------------------------------------------------------------------------------------ Pyjama-Party
add('schlafkissen', 'Kissen', 420, 320, ['Kissen', 'Pyjama', 'Schlafen', 'Übernachtung', 'Kuschelig', 'Schlafanzug'], () => [
  SHADOW(210, 296, 170),
  D('M36 64C140 30 280 30 384 64C406 130 406 190 384 256C280 290 140 290 36 256C14 190 14 130 36 64Z', '#bfdcf7'),
  D('M36 64C140 30 280 30 384 64C392 84 396 100 396 112C290 62 130 62 24 112C24 100 28 84 36 64Z', '#d9ecfc'),
  D('M60 100C150 76 270 76 360 100C376 150 376 190 360 232C270 256 150 256 60 232C44 190 44 150 60 100Z', 'none', { stroke: '#ffffff', 'stroke-width': 4, 'stroke-dasharray': '12 10', 'stroke-linecap': 'round' }),
  STAR(130, 170, 20, 9, '#ffffff'), STAR(210, 140, 14, 6, '#ffffff'), STAR(290, 180, 22, 10, '#ffffff'), C(190, 200, 5, '#ffffff'), C(330, 130, 5, '#ffffff'),
].join(''));

add('schlafmuetze', 'Schlafmütze', 400, 420, ['Schlafmütze', 'Pyjama', 'Schlafen', 'Mütze', 'Nacht', 'Schlafanzug'], () => [
  SHADOW(200, 400, 150),
  D('M44 340C60 190 130 90 240 70C300 60 340 90 344 150C346 190 330 230 340 340Z', '#5b6ee1'),
  D('M240 70C300 60 340 90 344 150C346 190 330 230 340 340L300 340C300 250 320 190 300 130C290 100 270 80 240 70Z', '#4856bd'),
  R(26, 316, 336, 56, 28, '#ffffff'), R(26, 316, 336, 14, 7, '#eef2f7'),
  C(340, 128, 34, '#ffffff'), C(330, 118, 10, '#eef2f7'),
  STAR(120, 240, 18, 8, '#ffd23f'), STAR(200, 160, 14, 6, '#ffffff'), STAR(240, 260, 12, 5, '#ffd23f'), STAR(150, 160, 9, 4, '#ffffff'),
  LN([[290, 20], [320, 20], [290, 50], [320, 50]], '#8bd3f7', 6),
].join(''));

add('teddy', 'Teddy', 380, 460, ['Teddy', 'Teddybär', 'Kuscheltier', 'Pyjama', 'Bär', 'Kuscheln'], () => [
  SHADOW(190, 444, 130),
  E(190, 330, 110, 108, '#b9824f'), E(190, 346, 70, 70, '#e8c89a'),
  E(96, 400, 44, 32, '#b9824f'), E(284, 400, 44, 32, '#b9824f'), E(96, 404, 24, 18, '#e8c89a'), E(284, 404, 24, 18, '#e8c89a'),
  E(76, 300, 36, 56, '#b9824f', { rot: 24 }), E(304, 300, 36, 56, '#b9824f', { rot: -24 }),
  C(86, 78, 46, '#b9824f'), C(294, 78, 46, '#b9824f'), C(86, 80, 26, '#e8c89a'), C(294, 80, 26, '#e8c89a'),
  C(190, 168, 110, '#b9824f'), E(190, 202, 56, 46, '#e8c89a'),
  E(190, 188, 20, 14, '#3b2a24'), ARC(190, 208, 14, 12, 20, 160, '#3b2a24', 5), LN([[190, 196], [190, 210]], '#3b2a24', 5),
  C(148, 150, 11, '#2b2230'), C(232, 150, 11, '#2b2230'), C(145, 146, 4, '#ffffff'), C(229, 146, 4, '#ffffff'),
  E(120, 188, 16, 10, '#f29aa8', { 'fill-opacity': 0.7 }), E(260, 188, 16, 10, '#f29aa8', { 'fill-opacity': 0.7 }),
  D('M120 252L190 270L260 252L254 280L190 290L126 280Z', '#e63946'),
].join(''));

add('schlafmond', 'Schlafmond', 380, 380, ['Mond', 'Schlafen', 'Nacht', 'Pyjama', 'Gute Nacht', 'Träumen'], () => {
  const c1 = [170, 200, 150], c2 = [250, 160, 118];
  const dx = c2[0] - c1[0], dy = c2[1] - c1[1], d = Math.hypot(dx, dy);
  const a = (c1[2] ** 2 - c2[2] ** 2 + d * d) / (2 * d), h = Math.sqrt(c1[2] ** 2 - a * a);
  const px = c1[0] + (a * dx) / d, py = c1[1] + (a * dy) / d;
  const P1 = [px + (h * dy) / d, py - (h * dx) / d], P2 = [px - (h * dy) / d, py + (h * dx) / d];
  const f = (v) => Math.round(v * 10) / 10;
  const moon = `M${f(P1[0])} ${f(P1[1])}A${c1[2]} ${c1[2]} 0 1 0 ${f(P2[0])} ${f(P2[1])}A${c2[2]} ${c2[2]} 0 0 1 ${f(P1[0])} ${f(P1[1])}Z`;
  return [
    D(moon, '#ffd23f'),
    ARC(98, 212, 24, 16, 20, 160, '#b8832b', 6), ARC(110, 280, 14, 10, 20, 160, '#b8832b', 5),
    E(100, 250, 20, 12, '#ff9fc4', { 'fill-opacity': 0.8 }),
    STAR(290, 280, 22, 9, '#ffd23f'), STAR(320, 60, 16, 7, '#ffffff'), SPARK(60, 70, 20, '#ffffff'), C(330, 340, 6, '#ffffff'),
    LN([[300, 150], [334, 150], [300, 188], [334, 188]], '#8bd3f7', 7),
  ].join('');
});

add('pony', 'Pony', 580, 440, ['Pony', 'Pferd', 'Reiterhof', 'Reiten', 'Tier', 'Ponyhof'], () => [
  SHADOW(290, 428, 230),
  SL([[130, 228], [64, 262], [50, 346]], '#3b2a24', 36),
  R(160, 290, 34, 112, 14, '#b86a38'), R(206, 298, 34, 104, 14, '#8e5530'), R(336, 290, 34, 112, 14, '#b86a38'), R(382, 298, 34, 104, 14, '#8e5530'),
  R(160, 384, 34, 22, 8, '#3b2a24'), R(206, 384, 34, 22, 8, '#3b2a24'), R(336, 384, 34, 22, 8, '#3b2a24'), R(382, 384, 34, 22, 8, '#3b2a24'),
  E(280, 242, 168, 88, '#c2753f'), E(290, 276, 110, 40, '#d4905a', { 'fill-opacity': 0.7 }),
  D('M366 230C396 176 412 128 434 94L498 116C478 160 470 214 446 270Z', '#c2753f'),
  SL([[432, 92], [404, 140], [372, 212]], '#3b2a24', 30),
  PG([[444, 86], [452, 42], [474, 90]], '#c2753f'), PG([[452, 80], [455, 56], [466, 84]], '#e9b48d'),
  E(490, 138, 66, 42, '#c2753f', { rot: 30 }), E(534, 176, 28, 24, '#e0a878', { rot: 30 }),
  C(494, 122, 8, '#2b2230'), C(491, 119, 3, '#ffffff'), E(544, 180, 4, 6, '#8e5530'),
  SL([[452, 94], [490, 104]], '#3b2a24', 14),
  R(222, 170, 100, 28, 12, '#ffc633'), R(232, 154, 78, 34, 16, '#d94b4b'), R(246, 188, 6, 60, 3, '#ffc633'),
].join(''));

// @@END
module.exports = { pieces };
