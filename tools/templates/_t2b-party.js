'use strict';
/* Family: Party-Einladung. Variants: Konfetti (A6), Neon (Instagram-Post), Elegant (DIN lang, Gold auf Schwarz). The occasion ("Sommerparty") is a field. */
const D = require('./dsl');
const { decor, scatter, infoRow } = require('./_t2b-lib');
const { text, rect, ellipse, shape, icon, deko, dekoIn, page, gradient, field, line, shadow } = D;

const fields = [field('Anlass', 'Anlass', 'text', 'Sommerparty')];
const sampleRows = [{ Anlass: 'Sommerparty' }, { Anlass: 'Garten-Geburtstagsparty' }, { Anlass: 'Party' }];
const base = { category: 'Einladungen', family: 'party-einladung', familyName: 'Party-Einladung', occasion: 'Feste & Events', unit: 'mm', fields, sampleRows };
const tags = (...more) => require('./_t2b-lib').dedupe(['Party', 'Einladung', 'Feier', 'Fest', 'Geburtstag', 'Einladungskarte', 'Feiern', ...more]);
const DATE = 'Samstag, 19. Juni 2027 · 19 Uhr';
const PLACE = 'Musterweg 5 · 12345 Musterstadt';
const RSVP = 'Zusage bis 5. Juni: 0170 1234567';

// ------------------------------------------------------------------------------------------------------------------------ Konfetti
const konfetti = (() => {
  const PURPLE = '#2f1c6b'; const PINK = '#ff4f8b'; const YEL = '#ffd23f';
  return Object.assign({}, base, {
    slug: 'party-konfetti',
    name: 'Party-Einladung – Konfetti',
    description: 'Bunte Einladung für jede Party (A6 hoch): Partyhut, Konfettiregen auf Violett und eine weiße Tafel für Datum, Ort und Zusage. Der Anlass ist ein Feld.',
    variant: 'Konfetti',
    tags: tags('Konfetti', 'Bunt', 'Partyhut', 'Geburtstagsparty', 'Gartenparty'),
    formatKey: 'a6-portrait', width: 105, height: 148,
    pages: [page(PURPLE, [
      decor([
        deko('Konfetti', 'deko-konfetti-streuung-bunt', 0, -4, 105),
        deko('Konfetti unten', 'deko-konfetti-streuung-bunt', 0, 60, 105, undefined, { flipX: true, flipY: true }),
        rect('Tafel', 10, 50, 85, 88, '#ffffff', { radius: 5 }),
        deko('Partyhut', 'deko-konfetti-partyhut-bunt', 40, 11, undefined, 42, { rotation: 8 }),
      ]),
      text('Kopf', 14, 56, 77, 6, 'DU BIST EINGELADEN', { f: 'Fredoka', s: 9.5, w: 600, c: PINK, a: 'center', ls: 0.2, min: 6 }),
      text('Anlass', 12, 63, 81, 24, '{{Anlass}}', { f: 'Baloo 2', s: 26, w: 800, c: PURPLE, a: 'center', wrap: true, min: 11, lh: 1.1 }),
      text('Text', 14, 87, 77, 7, 'Wir feiern – komm vorbei!', { f: 'Patrick Hand', s: 13, c: PURPLE, a: 'center', min: 8 }),
      ...infoRow('Datum', 15, 99, 75, 'calendar-days', DATE, { chip: PINK, ic: '#ffffff', c: PURPLE, s: 9, w: 700, d: 7.5 }),
      ...infoRow('Ort', 15, 109, 75, 'map-pin', PLACE, { chip: PINK, ic: '#ffffff', c: PURPLE, s: 9, w: 700, d: 7.5 }),
      ...infoRow('Zusage', 15, 119, 75, 'phone', RSVP, { chip: PINK, ic: '#ffffff', c: PURPLE, s: 9, w: 700, d: 7.5 }),
    ])],
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ Neon
const neon = (() => {
  const BG = '#0d0a29'; const PINK = '#ff3df2'; const CYAN = '#2ff3ff'; const WHITE = '#ffffff';
  return Object.assign({}, base, {
    slug: 'party-neon',
    name: 'Party-Einladung – Neon',
    description: 'Digitale Party-Einladung als Instagram-Post (1080 x 1080 px): dunkler Hintergrund, Neonrahmen in Pink und Cyan, große Schrift. Der Anlass ist ein Feld.',
    variant: 'Neon',
    unit: 'px',
    tags: tags('Neon', 'Disco', 'Nachtparty', 'Instagram', 'Social Media', 'Club', 'Dunkel'),
    formatKey: 'instagram-post', width: 1080, height: 1080,
    pages: [page(gradient(160, '#150a3d', BG), [
      decor([
        rect('Rahmen Pink', 50, 50, 980, 980, null, { stroke: PINK, sw: 5, radius: 40, shadow: shadow(PINK, 0.9, 30, 0, 0) }),
        rect('Rahmen Cyan', 70, 70, 940, 940, null, { stroke: CYAN, sw: 2.5, radius: 28, shadow: shadow(CYAN, 0.8, 20, 0, 0), opacity: 0.9 }),
        icon('Musik', 'music', 120, 130, 90, CYAN, 1.8, { shadow: shadow(CYAN, 0.9, 20, 0, 0) }),
        icon('Funken', 'sparkles', 870, 130, 90, PINK, 1.8, { shadow: shadow(PINK, 0.9, 20, 0, 0) }),
        line('Strich', 360, 660, 720, 660, PINK, 3, { shadow: shadow(PINK, 0.9, 16, 0, 0) }),
      ]),
      text('Party', 100, 180, 880, 80, 'DIE GROSSE', { f: 'Righteous', s: 34, c: CYAN, a: 'center', ls: 0.3, min: 20, shadow: shadow(CYAN, 0.9, 14, 0, 0) }),
      text('Anlass', 100, 260, 880, 330, '{{Anlass}}', { f: 'Righteous', s: 84, c: WHITE, a: 'center', lh: 1.05, min: 30, shadow: shadow(PINK, 1, 24, 0, 0) }),
      text('Datum', 100, 700, 880, 70, 'Samstag, 19. Juni 2027', { f: 'Poppins', s: 34, w: 600, c: WHITE, a: 'center', min: 18 }),
      text('Zeit', 100, 770, 880, 70, '19 Uhr · Einlass ab 18:30 Uhr', { f: 'Poppins', s: 26, w: 500, c: CYAN, a: 'center', min: 14 }),
      text('Ort', 100, 840, 880, 60, 'Musterweg 5 · 12345 Musterstadt', { f: 'Poppins', s: 24, w: 500, c: WHITE, a: 'center', min: 14 }),
      text('Zusage', 100, 910, 880, 60, 'Zusage bis 5. Juni · 0170 1234567', { f: 'Poppins', s: 20, w: 500, c: PINK, a: 'center', min: 12 }),
    ])],
  });
})();

// ------------------------------------------------------------------------------------------------------------------------ Elegant
const elegant = (() => {
  const BLACK = '#14100c'; const GOLD = '#d4af6a'; const CREAM = '#f3e8d0';
  return Object.assign({}, base, {
    slug: 'party-elegant',
    name: 'Party-Einladung – Elegant',
    description: 'Festliche Einladung für Cocktailparty, Gala oder Geburtstagsfeier (DIN lang hoch): Gold auf Schwarz mit langem Zierrahmen, Gläsern und Serifenschrift. Der Anlass ist ein Feld.',
    variant: 'Elegant',
    tags: tags('Elegant', 'Gold', 'Schwarz', 'Cocktail', 'Gala', 'Festlich', 'Abend'),
    formatKey: 'din-lang-portrait', width: 99, height: 210,
    pages: [page(BLACK, [
      decor([
        dekoIn('Rahmen', 'deko-rahmen-doppellinie-lang-gold', 5, 5, 89, 200),
        icon('Glas links', 'wine', 33, 24, 16, GOLD, 1.3, { rotation: -14 }),
        icon('Glas rechts', 'wine', 50, 24, 16, GOLD, 1.3, { rotation: 14 }),
        deko('Trenner', 'deko-trenner-deco-gold', 24, 66, 51),
        deko('Trenner unten', 'deko-trenner-deco-gold', 24, 150, 51),
      ]),
      text('Kopf', 14, 50, 71, 7, 'WIR LADEN EIN ZUR', { f: 'Cinzel', s: 8.5, w: 400, c: GOLD, a: 'center', ls: 0.2, min: 6 }),
      text('Anlass', 12, 76, 75, 50, '{{Anlass}}', { f: 'Playfair Display', s: 30, w: 600, i: true, c: CREAM, a: 'center', lh: 1.15, min: 12 }),
      text('Text', 14, 128, 71, 14, 'Ein Abend mit Musik, guten Gesprächen und Champagner.', { f: 'Cormorant Garamond', s: 12, w: 600, i: true, c: GOLD, a: 'center', wrap: true, v: 'top', lh: 1.35, min: 8 }),
      text('Datum', 12, 160, 75, 9, 'Samstag, 19. Juni 2027', { f: 'Cinzel', s: 11, w: 400, c: CREAM, a: 'center', ls: 0.06, min: 7 }),
      text('Zeit', 12, 170, 75, 7, 'ab 19 Uhr', { f: 'Cormorant Garamond', s: 13, w: 600, c: GOLD, a: 'center', min: 8 }),
      text('Ort', 12, 179, 75, 8, 'Musterweg 5 · 12345 Musterstadt', { f: 'Cormorant Garamond', s: 10.5, w: 600, c: CREAM, a: 'center', min: 7 }),
      text('Zusage', 12, 188, 75, 6, 'U. A. w. g. bis 5. Juni · 0170 1234567', { f: 'Cormorant Garamond', s: 9, w: 600, i: true, c: GOLD, a: 'center', min: 6.5 }),
    ])],
  });
})();

module.exports = { templates: [konfetti, neon, elegant] };
