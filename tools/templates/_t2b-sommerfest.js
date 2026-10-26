'use strict';
/* Family: Sommerfest. Variants: Sonnig (Flyer A5), Tropisch (Plakat A3), Strand (Instagram-Post). The organiser is a field. */
const D = require('./dsl');
const { decor, scatter, cloud, infoRow } = require('./_t2b-lib');
const { text, rect, ellipse, shape, icon, deko, dekoIn, page, gradient, field, line, shadow } = D;

const fields = [field('Veranstalter', 'Veranstalter', 'text', 'Sportverein Musterstadt')];
const sampleRows = [{ Veranstalter: 'Sportverein Musterstadt' }, { Veranstalter: 'Freiwillige Feuerwehr Oberhausen-Niederweiler' }, { Veranstalter: 'Kita Sonnenschein' }];
const base = { category: 'Flyer', family: 'sommerfest', familyName: 'Sommerfest', occasion: 'Feste & Events', unit: 'mm', fields, sampleRows };
const tags = (...more) => require('./_t2b-lib').dedupe(['Sommerfest', 'Sommer', 'Fest', 'Einladung', 'Flyer', 'Verein', 'Kita', 'Gartenfest', 'Straßenfest', 'Feier', ...more]);

// ------------------------------------------------------------------------------------------------------------------------ Sonnig
const sonnig = (() => {
  const CORAL = '#ff6a4d'; const INK = '#3a2e22'; const TEAL = '#1aa6a0'; const CREAM = '#fff8e0';
  const row = (n, y, iconName, title, sub) => [
    ellipse('Chip ' + n, 18, y, 15, 15, TEAL, { locked: true }),
    icon('Symbol ' + n, iconName, 21, y + 3, 9, '#ffffff', 2, { locked: true }),
    text('Programm ' + n, 38, y - 0.5, 92, 8, title, { f: 'Baloo 2', s: 15, w: 700, c: INK, a: 'left', min: 9 }),
    text('Programm Zeit ' + n, 38, y + 7, 92, 6, sub, { f: 'Nunito', s: 10, w: 600, c: '#6b5a44', a: 'left', min: 7 }),
  ];
  return Object.assign({}, base, {
    slug: 'sommerfest-sonnig',
    name: 'Sommerfest – Sonnig',
    description: 'Fröhlicher Flyer A5 hoch für Sommerfest von Verein, Kita oder Nachbarschaft: Wimpelkette, Sonne, Datum in der Plakette und vier Programmpunkte mit Symbolen. Der Veranstalter ist ein Feld.',
    variant: 'Sonnig',
    tags: tags('Sonnig', 'Wimpel', 'Programm', 'A5', 'Bunt', 'Familie'),
    formatKey: 'a5-portrait', width: 148, height: 210,
    pages: [page(CREAM, [
      decor([
        deko('Wimpel', 'deko-konfetti-wimpelkette-bunt', 0, -2, 148),
        deko('Sonne', 'deko-formen-sonne-bunt', 96, 30, 44),
        ellipse('Plakette', 12, 150, 42, 42, CORAL), ellipse('Plakette Ring', 14, 152, 38, 38, null, { stroke: '#ffffff', sw: 0.8, dash: 'dashed' }),
        rect('Boden', 0, 200, 148, 10, '#6fbf5f'),
      ]),
      text('Veranstalter', 12, 36, 84, 14, '{{Veranstalter}} lädt ein zum', { f: 'Nunito', s: 11, w: 700, c: INK, a: 'left', wrap: true, v: 'bottom', lh: 1.2, min: 6 }),
      text('Titel', 10, 52, 130, 30, 'Sommerfest', { f: 'Pacifico', s: 52, c: CORAL, a: 'left', min: 26 }),
      text('Untertitel', 12, 84, 126, 9, 'Spiel, Spaß und gute Laune für die ganze Familie!', { f: 'Patrick Hand', s: 14, c: INK, a: 'left', min: 8 }),
      ...row(1, 98, 'music', 'Live-Musik', 'ab 15 Uhr auf der Bühne'),
      ...row(2, 116, 'utensils', 'Grill, Salate und Kuchen', 'ab 14 Uhr, alles zum Selbstkostenpreis'),
      ...row(3, 134, 'ice-cream-cone', 'Eis und kühle Getränke', 'den ganzen Nachmittag', ),
      text('Datum Tag', 12, 156, 42, 9, 'SAMSTAG', { f: 'Nunito', s: 8, w: 800, c: '#ffffff', a: 'center', ls: 0.2, min: 5 }),
      text('Datum Zahl', 12, 163, 42, 16, '17. Juli', { f: 'Baloo 2', s: 22, w: 800, c: '#ffffff', a: 'center', min: 10 }),
      text('Datum Zeit', 12, 177, 42, 7, '14 – 20 Uhr', { f: 'Nunito', s: 9, w: 700, c: '#ffffff', a: 'center', min: 6 }),
      text('Ort', 62, 160, 76, 14, 'Festwiese am Sportplatz\nMusterweg 1 · 12345 Musterstadt', { f: 'Nunito', s: 10.5, w: 700, c: INK, a: 'left', wrap: true, v: 'top', lh: 1.4, min: 7 }),
      text('Eintritt', 62, 178, 76, 8, 'Eintritt frei!', { f: 'Baloo 2', s: 15, w: 700, c: TEAL, a: 'left', min: 8 }),
    ])],
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ Tropisch
const tropisch = (() => {
  const INK = '#2b1a3b';
  return Object.assign({}, base, {
    slug: 'sommerfest-tropisch',
    name: 'Sommerfest – Tropisch',
    description: 'Plakat A3 hoch für das Sommerfest mit Sonnenuntergangs-Verlauf, Palmwedeln, Wellen und großer Schrift: Aushang für Gemeinde, Verein oder Betrieb. Der Veranstalter ist ein Feld.',
    variant: 'Tropisch',
    category: 'Poster',
    tags: tags('Tropisch', 'Palmen', 'Sonnenuntergang', 'Plakat', 'Poster', 'A3', 'Aushang', 'Strandparty'),
    formatKey: 'poster-a3-portrait', width: 297, height: 420,
    pages: [page(gradient(180, '#ff7a59', '#ffb347', '#ffe08a'), [
      decor([
        ellipse('Sonne', 73, 222, 150, 150, '#fff0b5', { opacity: 0.9 }),
        ellipse('Sonne innen', 93, 242, 110, 110, '#fffbe0', { opacity: 0.9 }),
        deko('Palme links', 'deko-blumen-palmwedel-salbei', -34, -4, 190, undefined, { rotation: 8 }),
        deko('Palme rechts', 'deko-blumen-palmwedel-salbei', 150, -14, 170, undefined, { rotation: -18, flipX: true }),
        deko('Wellen vorn', 'deko-formen-wellenrand-navy', 0, 316, 297),
        rect('Meer', 0, 386, 297, 34, '#1f2f5c'),
      ]),
      text('Kopf', 20, 128, 257, 14, 'KOMM VORBEI ZUM', { f: 'Montserrat', s: 22, w: 700, c: INK, a: 'center', ls: 0.5, min: 12 }),
      text('Titel', 10, 148, 277, 80, 'SOMMERFEST', { f: 'Anton', s: 118, c: '#ffffff', a: 'center', lh: 1.1, min: 40, shadow: shadow('#d1432b', 0.6, 0, 3, 4) }),
      text('Untertitel', 20, 232, 257, 20, 'Musik · Cocktails · Strandfeeling', { f: 'Montserrat', s: 20, w: 600, c: INK, a: 'center', min: 11 }),
      text('Datum', 20, 340, 257, 26, 'Samstag, 17. Juli 2027 · ab 14 Uhr', { f: 'Montserrat', s: 26, w: 700, c: '#ffffff', a: 'center', min: 12 }),
      text('Ort', 20, 366, 257, 14, 'Festwiese am Sportplatz · Musterweg 1', { f: 'Montserrat', s: 15, w: 500, c: '#dfe6ff', a: 'center', min: 9 }),
      text('Veranstalter', 20, 399, 257, 14, 'Es lädt ein: {{Veranstalter}}', { f: 'Montserrat', s: 14, w: 600, c: '#ffffff', a: 'center', min: 8 }),
    ])],
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ Strand
const strand = (() => {
  const SKY = '#bfe9f5'; const NAVY = '#13506b'; const CORAL = '#ff6a4d'; const YEL = '#ffd23f';
  return Object.assign({}, base, {
    slug: 'sommerfest-strand',
    name: 'Sommerfest – Strand',
    description: 'Instagram-Post (1080 x 1080 px) zum Sommerfest: hellblauer Himmel, Sonne, Wolken und Wellen mit Eis und Sonnenschirm. Der Veranstalter ist ein Feld.',
    variant: 'Strand',
    category: 'Social Media',
    unit: 'px',
    tags: tags('Strand', 'Instagram', 'Social Media', 'Post', 'Wellen', 'Eis', 'Sonnenschirm', 'Sonne'),
    formatKey: 'instagram-post', width: 1080, height: 1080,
    pages: [page(gradient(180, SKY, '#e8f7fb'), [
      decor([
        deko('Sonne', 'deko-formen-sonne-bunt', 700, 50, 300),
        ...cloud('Wolke', 60, 90, 230, '#ffffff'), ...cloud('Wolke 2', 330, 200, 160, '#ffffff', { opacity: 0.9 }),
        deko('Wellen hinten', 'deko-formen-wellenrand-navy', 0, 760, 1080, undefined, { opacity: 0.45 }),
        deko('Wellen', 'deko-formen-wellenrand-navy', 0, 800, 1080),
        rect('Meer', 0, 1000, 1080, 80, '#1f2f5c'),
        icon('Eis', 'ice-cream-cone', 80, 660, 180, CORAL, 1.6, { rotation: -10 }),
        icon('Schirm', 'umbrella', 840, 650, 190, YEL, 1.6, { rotation: 8 }),
      ]),
      text('Kopf', 80, 260, 920, 70, 'DAS GROSSE', { f: 'Fredoka', s: 34, w: 600, c: NAVY, a: 'left', ls: 0.3, min: 18 }),
      text('Titel', 70, 330, 940, 170, 'Sommerfest', { f: 'Pacifico', s: 90, c: CORAL, a: 'left', min: 40 }),
      text('Datum', 80, 520, 920, 70, 'Sa., 17. Juli · ab 14 Uhr', { f: 'Fredoka', s: 34, w: 600, c: NAVY, a: 'left', min: 18 }),
      text('Ort', 80, 590, 920, 60, 'Festwiese am Sportplatz', { f: 'Fredoka', s: 26, w: 500, c: NAVY, a: 'left', min: 14 }),
      text('Veranstalter', 80, 1010, 920, 60, '{{Veranstalter}}', { f: 'Fredoka', s: 24, w: 500, c: '#ffffff', a: 'center', min: 12 }),
    ])],
  });
})();

module.exports = { templates: [sonnig, tropisch, strand] };
