'use strict';
// Group "Motive", batch Q1 (quality pass of the design assistant): the themes people really ask for and the pack did not draw yet. Dinosaurs (a friendly long-neck, a T-Rex, an egg with a hatching
// baby), trampoline, rocket, planet, pumpkin, ghost, bat. Flat, friendly, few colours, fixed colours (one palette entry "bunt" = one file per drawing). Own drawings.
const L = require('./lib');
const { Path, path, g, ellipsePath, rrect, poly, smooth, starPath, sparkle } = L;

const ex = (o) => { const r = Object.assign({}, o); delete r.rot; return r; };
const E = (cx, cy, rx, ry, fill, o) => path(ellipsePath(cx, cy, rx, ry, (o && o.rot) || 0), Object.assign({ fill }, ex(o)));
const C = (cx, cy, r, fill, o) => E(cx, cy, r, r, fill, o);
const R = (x, y, w, h, r, fill, o) => path(rrect(x, y, w, h, r), Object.assign({ fill }, o));
const PG = (pts, fill, o) => path(poly(pts, true), Object.assign({ fill }, o));
const SM = (pts, fill, o) => path(smooth(pts, true), Object.assign({ fill }, o));
const LN = (pts, stroke, w, o) => path(poly(pts, false), Object.assign({ fill: 'none', stroke, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, o));
const SL = (pts, stroke, w, o) => path(smooth(pts, false), Object.assign({ fill: 'none', stroke, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, o));
const D = (d, fill, o) => path(d, Object.assign({ fill }, o));
const ARC = (cx, cy, rx, ry, a0, a1, stroke, w, o) => path(new Path().arc(cx, cy, rx, ry, a0, a1, true), Object.assign({ fill: 'none', stroke, 'stroke-width': w, 'stroke-linecap': 'round' }, o));
const STAR = (cx, cy, ro, ri, fill, rot, pts) => path(starPath(cx, cy, ro, ri, pts || 5, rot === undefined ? -90 : rot), { fill });
const SPARK = (cx, cy, r, fill) => path(sparkle(cx, cy, r), { fill });
const MIR = (w, ...kids) => g({ transform: `translate(${w} 0) scale(-1 1)` }, ...kids);
const T = (x, y, ...kids) => g({ transform: `translate(${x} ${y})` }, ...kids);
const ROT = (deg, cx, cy, ...kids) => g({ transform: `rotate(${deg} ${cx} ${cy})` }, ...kids);
const SHADOW = (cx, cy, rx) => E(cx, cy, rx, rx * 0.07, '#1b2a41', { 'fill-opacity': 0.13 });
const eye = (x, y, r) => C(x, y, r, '#ffffff') + C(x + r * 0.15, y + r * 0.1, r * 0.6, '#2b2230') + C(x - r * 0.05, y - r * 0.2, r * 0.22, '#ffffff');

const pieces = [];
const add = (slug, name, w, h, tags, draw) => pieces.push({ slug, name, w, h, palettes: ['bunt'], tags: ['Motiv', 'Kinder', 'Kindergeburtstag', ...tags], draw });

// ------------------------------------------------------------------------------------------------------------------------ Dinosaurier
add('dinosaurier', 'Dinosaurier', 620, 480, ['Dinosaurier', 'Dino', 'Saurier', 'Urzeit', 'Langhals', 'Jungen', 'Tier', 'Dschungel'], () => {
  const green = '#53b36a', dark = '#3a8f50', belly = '#cdeaa6', plate = '#f28c28';
  const plates = [[196, 214, 30], [236, 192, 36], [284, 182, 40], [334, 184, 40], [382, 198, 36]].map(([x, y, s]) => PG([[x - s * 0.5, y + s * 0.5], [x, y - s * 0.7], [x + s * 0.5, y + s * 0.5]], plate));
  return [
    SHADOW(310, 452, 250),
    // tail
    SM([[200, 270], [140, 300], [80, 306], [26, 282], [62, 334], [130, 354], [214, 360]], green),
    // legs behind and in front
    R(214, 340, 56, 100, 24, dark), R(396, 340, 56, 100, 24, dark),
    E(242, 438, 38, 16, dark), E(424, 438, 38, 16, dark),
    // body
    E(330, 286, 180, 106, green), E(330, 336, 128, 52, belly),
    R(168, 340, 62, 100, 26, green), R(342, 340, 62, 100, 26, green),
    E(199, 438, 40, 17, green), E(373, 438, 40, 17, green),
    ...plates,
    // spots
    C(250, 270, 14, dark, { 'fill-opacity': 0.55 }), C(310, 236, 11, dark, { 'fill-opacity': 0.55 }), C(372, 262, 16, dark, { 'fill-opacity': 0.55 }), C(430, 296, 10, dark, { 'fill-opacity': 0.55 }),
    // neck and head
    SL([[438, 250], [492, 196], [506, 128]], green, 84),
    E(516, 94, 70, 52, green, { rot: -6 }), E(556, 112, 40, 30, '#7fcf8a', { rot: -6 }),
    PG([[470, 56], [482, 18], [506, 52]], plate), PG([[508, 46], [526, 12], [546, 50]], plate),
    eye(512, 84, 15), C(572, 104, 4, '#2d6e3a'), E(494, 112, 12, 8, '#ff9fae', { 'fill-opacity': 0.8 }),
    ARC(548, 126, 26, 16, 20, 150, '#2d6e3a', 5),
  ].join('');
});

add('t-rex', 'T-Rex', 620, 480, ['Dinosaurier', 'Dino', 'T-Rex', 'Tyrannosaurus', 'Saurier', 'Urzeit', 'Jungen', 'Tier', 'Zähne'], () => {
  const orange = '#f08a24', dark = '#c96a12', belly = '#ffd9a0';
  const teeth = [0, 1, 2, 3, 4].map((i) => PG([[468 + i * 22, 214], [478 + i * 22, 214 + 20], [488 + i * 22, 214]], '#ffffff'));
  return [
    SHADOW(300, 458, 240),
    // tail
    SM([[200, 250], [130, 280], [60, 290], [14, 262], [58, 322], [130, 344], [226, 340]], orange),
    // legs
    R(200, 316, 74, 126, 30, dark), E(236, 440, 50, 18, dark), R(188, 360, 14, 0.1, 0, dark),
    // body
    E(300, 262, 156, 118, orange), E(330, 318, 96, 62, belly),
    R(280, 330, 82, 112, 32, orange), E(322, 440, 52, 19, orange),
    // arms
    SL([[404, 292], [430, 304], [446, 296]], dark, 16), C(450, 295, 8, dark),
    // spikes on the back
    ...[[170, 200], [212, 168], [262, 150], [316, 150]].map(([x, y]) => PG([[x - 18, y + 24], [x, y - 16], [x + 20, y + 24]], '#2f8f46')),
    // head
    SL([[380, 200], [420, 150]], orange, 90),
    D('M390 96C420 62 520 56 584 92C612 106 616 150 598 176L598 226C598 244 580 252 560 250L430 246C396 244 372 212 376 168Z', orange),
    D('M392 214L592 220L592 232C592 244 578 250 560 250L430 246C404 244 388 232 392 214Z', belly),
    ...teeth,
    eye(458, 116, 20), C(584, 112, 6, dark), C(572, 150, 5, dark),
    PG([[400, 92], [414, 60], [436, 84]], '#2f8f46'),
    ARC(560, 208, 40, 14, 0, 40, '#8a470c', 5),
  ].join('');
});

add('dino-ei', 'Dino-Ei', 360, 440, ['Dinosaurier', 'Dino', 'Ei', 'Baby', 'Schlüpfen', 'Urzeit', 'Geburt'], () => [
  SHADOW(180, 424, 130),
  D('M180 90C86 90 40 250 56 330C66 386 120 420 180 420C240 420 294 386 304 330C320 250 274 90 180 90Z', '#f6e7c4'),
  D('M180 90C86 90 40 250 56 330C66 386 120 420 180 420C126 400 100 330 100 250C100 170 130 110 180 90Z', '#e8d3a2'),
  C(94, 214, 10, '#7fcf8a'), C(266, 190, 12, '#7fcf8a'),
  // the baby

  E(180, 200, 78, 66, '#53b36a'), E(180, 238, 44, 26, '#7fcf8a'),
  PG([[132, 148], [142, 112], [160, 144]], '#f28c28'), PG([[168, 138], [182, 100], [198, 138]], '#f28c28'), PG([[204, 144], [222, 114], [232, 152]], '#f28c28'),
  eye(150, 196, 16), eye(210, 196, 16), ARC(180, 224, 22, 14, 20, 160, '#2d6e3a', 5),
  E(122, 218, 11, 7, '#ff9fae', { 'fill-opacity': 0.8 }), E(238, 218, 11, 7, '#ff9fae', { 'fill-opacity': 0.8 }),
  // the lower half of the shell, in front of the baby, with a zigzag edge
  D('M58 284L106 252L140 290L180 248L222 290L254 254L302 284C306 304 306 318 304 330C294 386 240 420 180 420C120 420 66 386 56 330C54 318 54 304 58 284Z', '#fbf3df'),
  D('M58 284L106 252L140 290L180 248L222 290L254 254L302 284L302 294L254 266L222 302L180 262L140 302L106 266L58 294Z', '#e8d3a2'),
  C(110, 330, 14, '#7fcf8a'), C(246, 360, 18, '#7fcf8a'), C(190, 396, 10, '#7fcf8a'),
].join(''));

// ------------------------------------------------------------------------------------------------------------------------ Trampolin
add('trampolin', 'Trampolin mit Kind', 560, 600, ['Trampolin', 'Springen', 'Hüpfen', 'Sprungarena', 'Sport', 'Spaß', 'Trampolinpark', 'Sprungpark'], () => {
  const leg = (x, y, tilt) => LN([[x, y], [x + tilt, y + 118]], '#2f3b52', 20);
  return [
    SHADOW(280, 566, 220),
    // legs
    leg(110, 430, -20), leg(450, 430, 20), leg(180, 456, -8), leg(380, 456, 8),
    // the child, jumping
    ROT(-8, 280, 190,
      LN([[240, 280], [212, 346]], '#2f3b52', 22), LN([[320, 280], [352, 340]], '#2f3b52', 22),
      E(280, 232, 52, 66, '#ff6b6b'), R(228, 262, 104, 40, 18, '#2f6fed'),
      LN([[236, 210], [172, 150]], '#ffcf9f', 22), LN([[324, 210], [388, 142]], '#ffcf9f', 22), C(168, 144, 15, '#ffcf9f'), C(392, 138, 15, '#ffcf9f'),
      C(280, 144, 52, '#ffcf9f'), D('M230 136C230 100 260 84 288 90C322 92 336 116 332 140C312 120 270 118 230 136Z', '#7a4b2a'),
      C(262, 150, 6, '#2b2230'), C(300, 150, 6, '#2b2230'), ARC(281, 160, 18, 12, 20, 160, '#2b2230', 5)),
    // the mat and the frame
    E(280, 438, 230, 56, '#2f3b52'), E(280, 434, 214, 46, '#1fb3d6'), E(280, 428, 190, 34, '#7fd8ec', { 'fill-opacity': 0.55 }),
    path(new Path().arc(280, 438, 230, 56, 0, 180, true), { fill: 'none', stroke: '#ff9f1c', 'stroke-width': 14, 'stroke-linecap': 'round' }),
    // stars of joy
    STAR(112, 150, 30, 13, '#ffd23f'), STAR(460, 96, 24, 10, '#ffd23f'), SPARK(470, 250, 18, '#ff9fc4'), SPARK(96, 300, 14, '#8bd3f7'),
  ].join('');
});

// ------------------------------------------------------------------------------------------------------------------------ Weltall
add('rakete', 'Rakete', 300, 540, ['Rakete', 'Weltall', 'Weltraum', 'Raumschiff', 'Astronaut', 'Start', 'Mond', 'Jungen'], () => [
  D('M150 470C120 500 124 520 150 534C176 520 180 500 150 470Z', '#ffd23f'), D('M150 470C136 490 138 504 150 514C162 504 164 490 150 470Z', '#ff8c42'),
  D('M92 330C52 350 36 400 42 440L96 410Z', '#e63946'), D('M208 330C248 350 264 400 258 440L204 410Z', '#e63946'),
  D('M150 16C220 84 232 200 224 330L224 440L76 440L76 330C68 200 80 84 150 16Z', '#f4f6fa'),
  D('M150 16C220 84 232 200 224 330L224 440L190 440C198 300 196 150 150 16Z', '#dde3ee'),
  D('M150 16C186 52 208 98 218 150L82 150C92 98 114 52 150 16Z', '#e63946'),
  C(150, 230, 46, '#2f3b52'), C(150, 230, 36, '#7fd8ec'), E(138, 218, 14, 8, '#ffffff', { 'fill-opacity': 0.7, rot: -30 }),
  R(76, 372, 148, 22, 6, '#2f6fed'), R(98, 330, 104, 10, 5, '#2f6fed', { 'fill-opacity': 0.25 }),
  R(110, 440, 80, 22, 8, '#2f3b52'),
].join(''));

add('planet', 'Planet mit Ring', 480, 360, ['Planet', 'Saturn', 'Weltall', 'Weltraum', 'Stern', 'Himmel', 'Jungen'], () => [
  path(new Path().arc(240, 190, 220, 54, 180, 360, true), { fill: 'none', stroke: '#f6c453', 'stroke-width': 22, 'stroke-linecap': 'round' }),
  C(240, 180, 118, '#8f6fe8'), E(240, 180, 118, 118, '#6f4fd1', { 'fill-opacity': 0.4 }),
  path(ellipsePath(210, 120, 70, 18, -12), { fill: '#b7a2f5' }), path(ellipsePath(270, 236, 80, 14, -12), { fill: '#6f4fd1' }), C(180, 190, 14, '#b7a2f5'), C(296, 150, 10, '#b7a2f5'),
  path(new Path().arc(240, 190, 220, 54, 0, 180, true), { fill: 'none', stroke: '#f6c453', 'stroke-width': 22, 'stroke-linecap': 'round' }),
  path(new Path().arc(240, 190, 196, 42, 0, 180, true), { fill: 'none', stroke: '#ffe08a', 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-opacity': 0.9 }),
  STAR(60, 52, 14, 6, '#ffd23f'), STAR(430, 60, 10, 4, '#ffffff'), SPARK(420, 300, 12, '#8bd3f7'),
].join(''));

// ------------------------------------------------------------------------------------------------------------------------ Halloween
add('kuerbis', 'Kürbis', 440, 400, ['Kürbis', 'Halloween', 'Herbst', 'Erntedank', 'Gruselig', 'Gesicht', 'Oktober'], () => [
  SHADOW(220, 384, 170),
  E(120, 220, 96, 148, '#f08a24', { rot: 8 }), E(320, 220, 96, 148, '#f08a24', { rot: -8 }),
  E(170, 224, 100, 154, '#f59a3b'), E(270, 224, 100, 154, '#f59a3b'), E(220, 226, 78, 158, '#ffad4d'),
  R(204, 36, 34, 70, 12, '#6b8f3a'), D('M236 60C262 40 290 50 296 76C270 70 254 78 240 92Z', '#7cc44f'),
  PG([[140, 192], [186, 184], [160, 240]], '#3b2410'), PG([[300, 192], [254, 184], [280, 240]], '#3b2410'),
  D('M140 268C170 330 270 330 300 268C270 290 240 280 220 296C200 280 170 290 140 268Z', '#3b2410'),
  PG([[196, 262], [214, 262], [204, 290]], '#ffd23f'), PG([[246, 262], [264, 262], [256, 292]], '#ffd23f'),
  PG([[142, 270], [168, 270], [154, 300]], '#ffd23f', { 'fill-opacity': 0 }),
].join(''));

add('geist', 'Geist', 340, 420, ['Geist', 'Halloween', 'Gespenst', 'Gruselig', 'Spuk', 'Verkleiden', 'Oktober'], () => [
  SHADOW(170, 404, 110),
  D('M170 24C94 24 52 82 52 160L52 372C52 392 72 392 82 376C94 358 112 358 124 376C136 394 156 394 170 376C184 394 204 394 216 376C228 358 246 358 258 376C268 392 288 392 288 372L288 160C288 82 246 24 170 24Z', '#f4f6fa'),
  D('M52 160C52 82 94 24 170 24C130 40 110 96 110 180L110 372C110 388 98 372 90 366C72 354 58 372 52 372Z', '#dde3ee'),
  E(130, 160, 22, 34, '#2b2230'), E(210, 160, 22, 34, '#2b2230'), C(124, 148, 6, '#ffffff'), C(204, 148, 6, '#ffffff'),
  E(170, 232, 30, 40, '#2b2230'), E(96, 214, 16, 10, '#ffb3c1', { 'fill-opacity': 0.8 }), E(244, 214, 16, 10, '#ffb3c1', { 'fill-opacity': 0.8 }),
  SM([[40, 200], [14, 160], [34, 120]], '#f4f6fa', { 'fill-opacity': 0 }),
].join(''));

add('fledermaus', 'Fledermaus', 540, 320, ['Fledermaus', 'Halloween', 'Gruselig', 'Nacht', 'Oktober', 'Tier', 'Flügel'], () => {
  const wing = [
    D('M250 150C200 70 110 40 20 60C50 90 50 120 40 150C80 140 110 150 130 190C150 160 190 160 210 200C220 170 240 160 258 190Z', '#3a2c52'),
    D('M250 150C200 90 130 60 70 62C110 90 130 130 130 190C150 160 190 160 210 200C220 170 240 160 258 190Z', '#4f3d6e', { 'fill-opacity': 0.7 }),
  ].join('');
  return [
    wing, MIR(540, wing),
    E(270, 180, 44, 64, '#3a2c52'), C(270, 110, 44, '#3a2c52'),
    PG([[232, 86], [228, 28], [262, 70]], '#3a2c52'), PG([[308, 86], [312, 28], [278, 70]], '#3a2c52'),
    PG([[236, 82], [234, 48], [254, 72]], '#e58fa6'), PG([[304, 82], [306, 48], [286, 72]], '#e58fa6'),
    C(254, 108, 12, '#ffd23f'), C(286, 108, 12, '#ffd23f'), C(254, 108, 5, '#2b2230'), C(286, 108, 5, '#2b2230'),
    PG([[258, 134], [266, 150], [272, 134]], '#ffffff'), PG([[272, 134], [280, 150], [286, 134]], '#ffffff'),
  ].join('');
});

module.exports = { pieces };
