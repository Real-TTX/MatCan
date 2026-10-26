'use strict';
/* Family: Kindergeburtstag-Einladung. The variants are the themes (Pirat, Einhorn, Dino, Weltall, Fußball, Feuerwehr, Unterwasser). The name and the age are fields. */
const D = require('./dsl');
const { decor, scatter, cloud, infoRow } = require('./_t2b-lib');
const { text, rect, ellipse, shape, icon, deko, dekoIn, page, gradient, field, line, shadow, typo } = D;

const fields = [field('Name', 'Name', 'text', 'Mia'), field('Alter', 'Alter', 'text', '6')];
const sampleRows = [{ Name: 'Mia', Alter: '6' }, { Name: 'Maximilian', Alter: '10' }, { Name: 'Sophie-Charlotte', Alter: '7' }];
const base = {
  category: 'Einladungen', family: 'kindergeburtstag-einladung', familyName: 'Kindergeburtstag-Einladung', occasion: 'Kinder & Familie', unit: 'mm', fields, sampleRows,
};
const tags = (...more) => require('./_t2b-lib').dedupe(['Kindergeburtstag', 'Einladung', 'Geburtstag', 'Kinder', 'Party', 'Einladungskarte', 'Geburtstagseinladung', ...more]);
const DATE = 'Samstag, 12. Juni 2027 · 15 Uhr';
const PLACE = 'Musterweg 5 · 12345 Musterstadt';
const RSVP = 'Zusage bis 5. Juni: 0170 1234567';

// ------------------------------------------------------------------------------------------------------------------------ Pirat
const pirat = (() => {
  const NAVY = '#16384f'; const SAND = '#f6e7c1'; const RED = '#c9382c'; const GOLD = '#e3a72a'; const SEA = '#1d6f8f';
  const W = 105;
  return Object.assign({}, base, {
    slug: 'kindergeburtstag-pirat',
    name: 'Kindergeburtstag – Pirat',
    description: 'Einladung zum Piraten-Geburtstag (A6 hoch): Totenkopf-Plakette, Wellen und Ahoi-Gruß. Name und Alter sind Felder, Datum, Ort und Zusage trägst du direkt ein.',
    variant: 'Pirat',
    tags: tags('Pirat', 'Piraten', 'Schatzsuche', 'Ahoi', 'Totenkopf'),
    formatKey: 'a6-portrait', width: 105, height: 148,
    pages: [page(SAND, [
      decor([
        ellipse('Sonne', 70, -14, 52, 52, GOLD, { opacity: 0.22 }),
        ...scatter('Funkeln', 11, [4, 4, 97, 38], { n: 8, colors: [GOLD, RED], kinds: ['star', 'spark', 'dot'], size: [2, 3.4], avoid: [[12, 10, 81, 34]], pad: 1 }),
        ellipse('Plakette', 37.5, 11, 30, 30, NAVY),
        ellipse('Plakette Ring', 39.3, 12.8, 26.4, 26.4, null, { stroke: GOLD, sw: 1.4 }),
        icon('Totenkopf', 'skull', 43.5, 17, 18, SAND, 1.7),
        icon('Anker', 'anchor', 14, 17, 14, NAVY, 1.9, { rotation: -12 }),
        icon('Kompass', 'compass', 77, 17, 14, NAVY, 1.9, { rotation: 12 }),
      ]),
      text('Gruß', 8, 45, 89, 9, 'Ahoi, Landratte!', { f: 'Gochi Hand', s: 22, c: RED, a: 'center', min: 12 }),
      text('Titel', 6, 55, 93, 15, '{{Name}} wird {{Alter}}!', { f: 'Fredoka', s: 31, w: 700, c: NAVY, a: 'center', min: 15 }),
      text('Einladung', 10, 72, 85, 6.5, 'und lädt dich zur Schatzsuche ein.', { f: 'Patrick Hand', s: 13, c: NAVY, a: 'center', min: 8 }),
      ...infoRow('Datum', 13, 86, 82, 'calendar-days', DATE, { chip: NAVY, ic: SAND, c: NAVY, f: 'Nunito', s: 9.5, w: 700 }),
      ...infoRow('Ort', 13, 97, 82, 'map-pin', PLACE, { chip: NAVY, ic: SAND, c: NAVY, f: 'Nunito', s: 9.5, w: 700 }),
      ...infoRow('Zusage', 13, 108, 82, 'phone', RSVP, { chip: NAVY, ic: SAND, c: NAVY, f: 'Nunito', s: 9.5, w: 700 }),
      decor([
                deko('Wellen', 'deko-formen-wellenrand-navy', 0, 119, W),
        rect('Meer Fuß', 0, 141, W, 7, '#1f2f5c'),
        icon('Schiff', 'sailboat', 82, 97, 15, RED, 1.7, { rotation: 6 }),
      ]),
      text('Hinweis', 8, 134, 89, 9, 'Piratenkostüm nicht vergessen!', { f: 'Fredoka', s: 11, w: 500, c: SAND, a: 'center', min: 7 }),
    ])],
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ Einhorn
const einhorn = (() => {
  const INK = '#5b3a8e'; const PINK = '#ff8fc2'; const LILAC = '#b79cf2'; const MINT = '#7fd8c3'; const SUN = '#ffd66b';
  const head = (ox, oy, s) => {
    const k = s / 60;
    const P = (x, y, w, h) => [ox + x * k, oy + y * k, w * k, h * k];
    return decor([
      ellipse('Mähne 1', ...P(34, 12, 24, 24), PINK), ellipse('Mähne 2', ...P(40, 26, 22, 22), LILAC), ellipse('Mähne 3', ...P(36, 40, 20, 20), MINT),
      shape('triangle', 'Ohr links', ...P(10, 8, 12, 18), '#ffffff', { rotation: -18 }),
      shape('triangle', 'Ohr links innen', ...P(12.5, 12, 7, 11), '#ffc6e1', { rotation: -18 }),
      shape('triangle', 'Ohr rechts', ...P(33, 8, 12, 18), '#ffffff', { rotation: 18 }),
      shape('triangle', 'Ohr rechts innen', ...P(35.5, 12, 7, 11), '#ffc6e1', { rotation: 18 }),
      shape('triangle', 'Horn', ...P(22.5, -14, 11, 30), gradient(180, '#ffe58a', '#e8a93a'), { rotation: 4 }),
      ellipse('Kopf', ...P(8, 14, 44, 44), '#ffffff', { shadow: shadow('#b79cf2', 0.35, 4 * k, 0, 1.2 * k) }),
      ellipse('Wange links', ...P(13, 40, 9, 6), '#ffc0dc'), ellipse('Wange rechts', ...P(38, 40, 9, 6), '#ffc0dc'),
      ellipse('Auge links', ...P(18, 32, 5.5, 7), INK), ellipse('Auge rechts', ...P(36.5, 32, 5.5, 7), INK),
      ellipse('Glanz links', ...P(19.8, 33, 2, 2.4), '#ffffff'), ellipse('Glanz rechts', ...P(38.3, 33, 2, 2.4), '#ffffff'),
      ellipse('Nase', ...P(26, 46, 8, 5), '#ffd9ea'),
      ellipse('Blume 1', ...P(9, 12, 9, 9), PINK), ellipse('Blume 2', ...P(17, 8.5, 9, 9), SUN), ellipse('Blume 3', ...P(35, 8.5, 9, 9), LILAC), ellipse('Blume 4', ...P(43, 12, 9, 9), MINT),
      ellipse('Blume 1 Mitte', ...P(12, 15, 3, 3), '#ffffff'), ellipse('Blume 3 Mitte', ...P(38, 11.5, 3, 3), '#ffffff'),
    ]);
  };
  return Object.assign({}, base, {
    slug: 'kindergeburtstag-einhorn',
    name: 'Kindergeburtstag – Einhorn',
    description: 'Einladung zum Einhorn-Geburtstag (A6 hoch): ein freundliches Einhorn mit Blumenkranz, Wolken und Glitzer in Pastell. Name und Alter sind Felder.',
    variant: 'Einhorn',
    tags: tags('Einhorn', 'Regenbogen', 'Glitzer', 'Mädchen', 'Pastell', 'Wolken'),
    formatKey: 'a6-portrait', width: 105, height: 148,
    pages: [page(gradient(170, '#ffeef8', '#e8e6ff'), [
      decor([
        ...cloud('Wolke 1', 4, 20, 26, '#ffffff'), ...cloud('Wolke 2', 76, 33, 24, '#ffffff'), ...cloud('Wolke 3', 70, 8, 16, '#ffffff', { opacity: 0.8 }),
        ...scatter('Glitzer', 5, [4, 4, 97, 70], { n: 9, colors: [PINK, SUN, LILAC, MINT], kinds: ['spark', 'spark', 'star', 'dot'], size: [2.2, 4], avoid: [[26, 5, 52, 62]], pad: 1.5 }),
        deko('Regenbogen', 'deko-formen-regenbogen-pastell', 17.5, 116, 70),
      ]),
      ...head(27.5, 14, 50),
      text('Kleine Zeile', 8, 66, 89, 7, 'Magische Einladung', { f: 'Dancing Script', s: 19, w: 700, c: LILAC, a: 'center', min: 11 }),
      text('Titel', 6, 74, 93, 15, '{{Name}} wird {{Alter}}!', { f: 'Fredoka', s: 31, w: 700, c: INK, a: 'center', min: 15 }),
      text('Datum', 8, 92, 89, 7, DATE, { f: 'Nunito', s: 10.5, w: 800, c: INK, a: 'center', min: 7 }),
      text('Ort', 8, 99.5, 89, 6, PLACE, { f: 'Nunito', s: 9.5, w: 600, c: INK, a: 'center', min: 7 }),
      text('Zusage', 8, 106, 89, 6, RSVP, { f: 'Nunito', s: 9, w: 600, c: '#8a6fc0', a: 'center', min: 7 }),
    ])],
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ Dino
const dino = (() => {
  const GREEN = '#4faa5c'; const DARK = '#2f7d45'; const BELLY = '#c9eaa8'; const ORANGE = '#f08a24'; const BROWN = '#5a3b24'; const SAND = '#fbf1cf';
  const figure = (ox, oy, s) => {
    const k = s / 100;
    const P = (x, y, w, h) => [ox + x * k, oy + y * k, w * k, h * k];
    return decor([
      shape('triangle', 'Schwanz', ...P(-2, 38, 22, 36), GREEN, { rotation: -90 }),
      ...[[22, 16, 11], [33, 11, 12], [45, 9, 13], [57, 11, 12], [67, 17, 10]].map(([x, y, w], i) => shape('triangle', 'Rückenplatte ' + (i + 1), ...P(x, y, w, w * 1.05), ORANGE, { rotation: (i - 2) * 10 })),
      rect('Bein hinten', ...P(30, 54, 13, 24), GREEN, { radius: 6 * k }), rect('Bein vorn', ...P(57, 54, 13, 24), GREEN, { radius: 6 * k }),
      ellipse('Fuß hinten', ...P(27, 73, 20, 8), DARK), ellipse('Fuß vorn', ...P(54, 73, 20, 8), DARK),
      ellipse('Körper', ...P(16, 22, 66, 42), GREEN),
      ellipse('Bauch', ...P(26, 40, 46, 22), BELLY),
      ellipse('Fleck 1', ...P(30, 28, 7, 6), DARK), ellipse('Fleck 2', ...P(44, 25, 6, 5), DARK), ellipse('Fleck 3', ...P(56, 30, 7, 6), DARK),
      ellipse('Hals', ...P(66, 6, 18, 44), GREEN, { rotation: 12 }),
      ellipse('Kopf', ...P(68, -10, 32, 24), GREEN),
      ellipse('Auge', ...P(84, -6, 8, 8), '#ffffff'), ellipse('Pupille', ...P(87, -4.5, 4, 4.4), BROWN), ellipse('Nase', ...P(94, 2, 3, 2.4), DARK),
      ellipse('Wange', ...P(80, 4, 7, 5), '#f6a08c'),
    ]);
  };
  const egg = (x, y, w, c) => decor([ellipse('Ei ' + x, x, y, w, w * 1.28, c), ellipse('Eifleck ' + x, x + w * 0.22, y + w * 0.34, w * 0.2, w * 0.2, '#ffffff', { opacity: 0.5 }), ellipse('Eifleck 2 ' + x, x + w * 0.58, y + w * 0.7, w * 0.16, w * 0.16, '#ffffff', { opacity: 0.5 })]);
  return Object.assign({}, base, {
    slug: 'kindergeburtstag-dino',
    name: 'Kindergeburtstag – Dino',
    description: 'Einladung zum Dino-Geburtstag (A6 quer): ein kleiner Dino aus Formen, Palmwedel, Berge und Fußspuren. Name und Alter sind Felder.',
    variant: 'Dino',
    tags: tags('Dino', 'Dinosaurier', 'Urzeit', 'Dschungel', 'Abenteuer', 'Jungen'),
    formatKey: 'a6-landscape', width: 148, height: 105,
    pages: [page(SAND, [
      decor([
        deko('Berge', 'deko-formen-berge-salbei', 0, 70, 148),
        rect('Boden', 0, 96, 148, 9, '#6f9473'),
        deko('Palme links', 'deko-blumen-palmwedel-salbei', -12, -6, 52, undefined, { rotation: 20 }),
        deko('Palme rechts', 'deko-blumen-palmwedel-salbei', 112, -8, 44, undefined, { rotation: -25, flipX: true }),
        ellipse('Sonne', 108, 6, 20, 20, '#ffc947'),
      ]),
      figure(4, 50, 56),
      egg(42, 83, 8, '#f5d9a0'), egg(52, 87, 6, '#d9c0f2'),
      text('Brüllen', 68, 8, 40, 8, 'RAAAWR!', { f: 'Gochi Hand', s: 20, c: ORANGE, a: 'left', min: 10, rotation: -4 }),
      text('Titel', 66, 17, 78, 19, '{{Name}} wird {{Alter}}!', { f: 'Fredoka', s: 34, w: 700, c: DARK, a: 'left', min: 16 }),
      text('Einladung', 66, 37, 78, 7, 'Komm mit auf Dino-Expedition!', { f: 'Patrick Hand', s: 14, c: BROWN, a: 'left', min: 9 }),
      ...infoRow('Datum', 66, 50, 78, 'calendar-days', DATE, { chip: GREEN, ic: '#ffffff', c: BROWN, s: 10, w: 700 }),
      ...infoRow('Ort', 66, 61, 78, 'map-pin', PLACE, { chip: GREEN, ic: '#ffffff', c: BROWN, s: 10, w: 700 }),
      ...infoRow('Zusage', 66, 72, 78, 'phone', RSVP, { chip: GREEN, ic: '#ffffff', c: BROWN, s: 10, w: 700 }),
    ])],
  });
})();


// ------------------------------------------------------------------------------------------------------------------------ Weltall
const weltall = (() => {
  const GOLD = '#ffcf4a'; const CORAL = '#ff6b5e'; const LILAC = '#c9b8ff'; const W = 99;
  return Object.assign({}, base, {
    slug: 'kindergeburtstag-weltall',
    name: 'Kindergeburtstag – Weltall',
    description: 'Einladung zum Weltraum-Geburtstag (DIN lang hoch): Sternenhimmel, Rakete, Mond und Planeten auf nachtblauem Verlauf. Name und Alter sind Felder.',
    variant: 'Weltall',
    tags: tags('Weltall', 'Weltraum', 'Rakete', 'Astronaut', 'Sterne', 'Planeten', 'Mond'),
    formatKey: 'din-lang-portrait', width: 99, height: 210,
    pages: [page(gradient(175, '#0a0e2e', '#2b1a6e'), [
      decor([
        deko('Sternenhimmel', 'deko-sterne-himmel-weiss', 0, -14, W, undefined, { opacity: 0.6 }),
        deko('Mond', 'deko-formen-mond-gold', 67, 9, 22),
        ellipse('Planet klein', 9, 42, 14, 14, CORAL), ellipse('Planet klein Streifen', 11.5, 47, 9, 2.2, '#ffffff', { opacity: 0.35 }),
        ellipse('Glanz', 23, 28, 56, 56, '#1c2070'),
        ellipse('Glanz innen', 28, 33, 46, 46, '#2a2f8a'),
        icon('Rakete', 'rocket', 29.5, 33, 40, GOLD, 1.5),
        ellipse('Planet Ring hinten', 58, 182, 56, 16, null, { stroke: LILAC, sw: 2.6, rotation: -18, opacity: 0.9 }),
        ellipse('Planet groß', 67, 175, 34, 34, '#7a5be0'),
        ellipse('Planet Streifen', 69, 188, 30, 4, '#ffffff', { opacity: 0.2 }),
        deko('Funkeln', 'deko-sterne-funkeln-gold', 10, 184, 14),
        deko('Funkeln 2', 'deko-sterne-stern-gold', 40, 197, 6),
      ]),
      text('Countdown', 8, 86, 83, 7, 'Countdown läuft!', { f: 'Righteous', s: 13, c: GOLD, a: 'center', ls: 0.12, min: 8 }),
      text('Name', 6, 93, 87, 16, '{{Name}}', { f: 'Righteous', s: 36, c: '#ffffff', a: 'center', min: 14 }),
      text('wird', 6, 109, 87, 12, 'wird {{Alter}}!', { f: 'Righteous', s: 27, c: CORAL, a: 'center', min: 14 }),
      text('Einladung', 8, 125, 83, 11, 'Starte mit uns zur\nGeburtstagsmission.', { f: 'Nunito', s: 11, w: 600, c: '#e6e1ff', a: 'center', wrap: true, v: 'top', lh: 1.25, min: 8 }),
      ...infoRow('Datum', 11, 142, 77, 'calendar-days', DATE, { chip: GOLD, ic: '#0a0e2e', c: '#ffffff', s: 9, w: 700, d: 7.5 }),
      ...infoRow('Ort', 11, 153, 77, 'map-pin', PLACE, { chip: GOLD, ic: '#0a0e2e', c: '#ffffff', s: 9, w: 700, d: 7.5 }),
      ...infoRow('Zusage', 11, 164, 77, 'phone', RSVP, { chip: GOLD, ic: '#0a0e2e', c: '#ffffff', s: 9, w: 700, d: 7.5 }),
    ])],
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ Fußball
const fussball = (() => {
  const GRASS = '#1f8f4e'; const GRASS2 = '#27a35a'; const YELLOW = '#ffd23f'; const W = 148; const H = 105;
  const ball = (cx, cy, r) => {
    const out = [ellipse('Ballschatten', cx - r * 0.9, cy + r * 0.88, r * 1.8, r * 0.3, '#000000', { opacity: 0.18 }), ellipse('Ball', cx - r, cy - r, 2 * r, 2 * r, '#ffffff', { stroke: '#222222', sw: 1.4 }),
      shape('pentagon', 'Ball Mitte', cx - r * 0.3, cy - r * 0.3, r * 0.6, r * 0.6, '#222222')];
    for (let i = 0; i < 5; i++) {
      const a = (-90 + i * 72) * Math.PI / 180;
      const d = r * 0.74; const sz = r * 0.3;
      out.push(shape('pentagon', 'Ball Fleck ' + (i + 1), cx + Math.cos(a) * d - sz / 2, cy + Math.sin(a) * d - sz / 2, sz, sz, '#222222', { rotation: i * 72 + 36 }));
    }
    return out;
  };
  const stripes = Array.from({ length: 8 }, (_, i) => (i % 2 ? rect('Rasen ' + i, i * W / 8, 0, W / 8, H, GRASS2) : null));
  return Object.assign({}, base, {
    slug: 'kindergeburtstag-fussball',
    name: 'Kindergeburtstag – Fußball',
    description: 'Einladung zum Fußball-Geburtstag (A6 quer): Rasenstreifen, Spielfeldlinien, Ball und Pokal. Name und Alter sind Felder, der Anstoß steht im Datum.',
    variant: 'Fußball',
    tags: tags('Fußball', 'Sport', 'Fussball', 'Verein', 'Rasen', 'Pokal', 'Jungen', 'Mädchen'),
    formatKey: 'a6-landscape', width: 148, height: 105,
    pages: [page(GRASS, [
      decor([
        ...stripes,
        rect('Spielfeld', 5, 5, 138, 95, null, { stroke: '#ffffff', sw: 1.3, opacity: 0.8, radius: 1 }),
        ellipse('Mittelkreis', 5.5, 22.5, 60, 60, null, { stroke: '#ffffff', sw: 1.3, opacity: 0.8 }),
        ellipse('Anstoßpunkt', 32.5, 50, 5, 5, '#ffffff', { opacity: 0.8 }),
        ...ball(35, 52.5, 17),
        icon('Pokal', 'trophy', 124, 11, 14, YELLOW, 1.8),
      ]),
      text('Anpfiff', 66, 12, 56, 7, 'ANPFIFF FÜR', { f: 'Oswald', s: 14, w: 500, c: YELLOW, a: 'left', ls: 0.2, min: 8 }),
      text('Titel', 66, 20, 72, 22, '{{Name}} wird {{Alter}}!', { f: 'Anton', s: 36, c: '#ffffff', a: 'left', lh: 1.15, min: 16 }),
      text('Einladung', 66, 43, 72, 7, 'Komm zum Torjubel-Geburtstag!', { f: 'Patrick Hand', s: 13.5, c: '#ffffff', a: 'left', min: 8 }),
      ...infoRow('Datum', 66, 56, 72, 'calendar-days', DATE, { chip: '#ffffff', ic: GRASS, c: '#ffffff', s: 9.5, w: 700 }),
      ...infoRow('Ort', 66, 67, 72, 'map-pin', PLACE, { chip: '#ffffff', ic: GRASS, c: '#ffffff', s: 9.5, w: 700 }),
      ...infoRow('Zusage', 66, 78, 72, 'phone', RSVP, { chip: '#ffffff', ic: GRASS, c: '#ffffff', s: 9.5, w: 700 }),
      text('Hinweis', 66, 89, 72, 6, 'Sportzeug und gute Laune mitbringen!', { f: 'Nunito', s: 8.5, w: 600, c: YELLOW, a: 'left', min: 6 }),
    ])],
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ Feuerwehr
const feuerwehr = (() => {
  const RED = '#d62828'; const YEL = '#ffb627'; const INK = '#2b1d1d';
  return Object.assign({}, base, {
    slug: 'kindergeburtstag-feuerwehr',
    name: 'Kindergeburtstag – Feuerwehr',
    description: 'Einladung zum Feuerwehr-Geburtstag (A6 hoch): rote Alarmzentrale mit Löschfahrzeug, Sirenen und gelber Zackenkante. Name und Alter sind Felder.',
    variant: 'Feuerwehr',
    tags: tags('Feuerwehr', 'Löschzug', 'Tatütata', 'Feuerwehrauto', 'Einsatz', 'Jungen', 'Rot'),
    formatKey: 'a6-portrait', width: 105, height: 148,
    pages: [page(YEL, [
      decor([
        rect('Rot', 0, 0, 105, 68, RED),
        deko('Zacken', 'deko-formen-zackenrand-bunt', 0, 60, 105, undefined, { flipY: true }),
        ellipse('Glanz', 22, 12, 61, 61, '#ffffff', { opacity: 0.07 }),
        icon('Sirene links', 'siren', 11, 11, 14, YEL, 1.8, { rotation: -14 }),
        icon('Sirene rechts', 'siren', 80, 11, 14, YEL, 1.8, { rotation: 14 }),
        icon('Löschfahrzeug', 'truck', 28.5, 20, 48, '#ffffff', 1.4),
      ]),
      text('Alarm', 8, 8, 89, 12, 'TATÜTATA!', { f: 'Anton', s: 24, c: '#ffffff', a: 'center', ls: 0.06, min: 12, lh: 1.15 }),
      text('Titel', 6, 77, 93, 16, '{{Name}} wird {{Alter}}!', { f: 'Fredoka', s: 31, w: 700, c: RED, a: 'center', min: 15 }),
      text('Einladung', 8, 94, 89, 7, 'Einsatz: Geburtstagsfeier!', { f: 'Patrick Hand', s: 14, c: INK, a: 'center', min: 8 }),
      ...infoRow('Datum', 14, 106, 80, 'calendar-days', DATE, { chip: RED, ic: '#ffffff', c: INK, s: 9.5, w: 700 }),
      ...infoRow('Ort', 14, 116.5, 80, 'map-pin', PLACE, { chip: RED, ic: '#ffffff', c: INK, s: 9.5, w: 700 }),
      ...infoRow('Zusage', 14, 127, 80, 'phone', RSVP, { chip: RED, ic: '#ffffff', c: INK, s: 9.5, w: 700 }),
    ])],
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ Unterwasser
const unterwasser = (() => {
  const NAVY = '#0d4a6b'; const CORAL = '#ff7a59'; const YEL = '#ffd23f';
  return Object.assign({}, base, {
    slug: 'kindergeburtstag-unterwasser',
    name: 'Kindergeburtstag – Unterwasser',
    description: 'Einladung zum Meeres-Geburtstag (quadratisch 10 cm): Blasen, Fische, Schildkröte und Seetang auf blauem Verlauf. Name und Alter sind Felder.',
    variant: 'Unterwasser',
    tags: tags('Unterwasser', 'Meer', 'Fische', 'Schildkröte', 'Taucher', 'Wasser', 'Ozean'),
    formatKey: 'square-100', width: 100, height: 100,
    pages: [page(gradient(180, '#9be4f5', '#1b9bc4', '#0e5f8c'), [
      decor([
        ...scatter('Blase', 3, [3, 3, 94, 94], { n: 16, colors: ['#ffffff'], kinds: ['ring'], size: [2.5, 6], avoid: [[6, 8, 88, 80]], pad: 1, opacity: 0.7 }),
        rect('Sand', 0, 91, 100, 9, '#f2d79b'),
        deko('Tang links', 'deko-blumen-farnwedel-salbei', 1, 62, undefined, 36),
        deko('Tang rechts', 'deko-blumen-farnwedel-salbei', 86, 66, undefined, 32, { flipX: true }),
        icon('Fisch 1', 'fish', 6, 10, 14, CORAL, 1.8),
        icon('Fisch 2', 'fish-symbol', 81, 13, 13, YEL, 1.8, { flipX: true }),
        icon('Schildkröte', 'turtle', 80, 77, 14, '#bff0c6', 1.8),
        icon('Fisch 3', 'fish', 8, 80, 12, '#ffffff', 1.8, { flipX: true }),
      ]),
      text('Kleine Zeile', 12, 12, 76, 8, 'Tauch mit uns ab!', { f: 'Baloo 2', s: 16, w: 600, c: '#ffffff', a: 'center', min: 9 }),
      text('Titel', 8, 23, 84, 17, '{{Name}} wird {{Alter}}!', { f: 'Baloo 2', s: 31, w: 800, c: '#ffffff', a: 'center', min: 15, shadow: D.shadow(NAVY, 0.4, 0, 0.6, 0.8) }),
      rect('Tafel', 17, 45, 66, 39, '#ffffff', { radius: 4, opacity: 0.92, locked: true }),
      ...infoRow('Datum', 21, 48.5, 60, 'calendar-days', DATE, { chip: '#1b9bc4', ic: '#ffffff', c: NAVY, s: 8, w: 700, d: 6.5 }),
      ...infoRow('Ort', 21, 59, 60, 'map-pin', PLACE, { chip: '#1b9bc4', ic: '#ffffff', c: NAVY, s: 8, w: 700, d: 6.5 }),
      ...infoRow('Zusage', 21, 69.5, 60, 'phone', RSVP, { chip: '#1b9bc4', ic: '#ffffff', c: NAVY, s: 8, w: 700, d: 6.5 }),
    ])],
  });
})();

module.exports = { templates: [pirat, einhorn, dino, weltall, fussball, feuerwehr, unterwasser] };
