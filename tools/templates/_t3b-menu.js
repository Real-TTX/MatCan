'use strict';
/* Menu lines for the Speisekarte families of batch T3b: sections with dishes (name, description, price). Not a template module (no leading number). */
const { text, line } = require('./dsl');

const SECTIONS = [
  { title: 'Vorspeisen', dishes: [['Tomatensuppe', 'mit Basilikum und Croutons', '6,50 €'], ['Ziegenkäse im Speckmantel', 'auf Feldsalat mit Honig-Senf-Dressing', '9,80 €']] },
  { title: 'Hauptgerichte', dishes: [['Schweinemedaillons', 'Champignonrahm, Spätzle, Gemüse', '18,50 €'], ['Gebratene Forelle', 'Petersilienkartoffeln, Zitronenbutter', '17,90 €'], ['Gemüse-Lasagne', 'mit saisonalem Gemüse, vegetarisch', '13,90 €']] },
  { title: 'Desserts', dishes: [['Crème brûlée', 'Vanille und Beeren', '6,50 €'], ['Apfelstrudel', 'mit warmer Vanillesoße', '5,90 €']] },
  { title: 'Getränke', dishes: [['Apfelschorle', 'hausgemacht, 0,4 l', '3,60 €'], ['Riesling trocken', 'Weingut am Hang, 0,2 l', '5,80 €']] },
];

/**
 * menuBlock({ x, y, w, sections, st }): the elements of a list of sections and its lower edge. st: name { f, s, w, c }, desc { f, s, c, i }, price { f, s, w, c }, priceW, nameH, descH, gap (between dishes),
 * head(x, y, w, title) -> { els, h } (the section title), rule (colour of a thin line under each dish), center (centred dishes: price after the name is not possible, so the price goes on its own line).
 */
function menuBlock({ x, y, w, sections = SECTIONS, st }) {
  const els = [];
  let cy = y;
  const nameH = st.nameH || 4.8;
  const descH = st.descH || 3.8;
  for (const sec of sections) {
    const h = st.head(x, cy, w, sec.title);
    els.push(...h.els);
    cy += h.h;
    for (const [n, d, p] of sec.dishes) {
      if (st.center && st.inline) {
        els.push(text(n, x, cy, w, nameH, n + '   ' + p, Object.assign({ a: 'center', min: 6 }, nameStyle(st))));
        if (d) els.push(text(n + ' Beschreibung', x, cy + nameH, w, descH, d, Object.assign({ a: 'center', min: 5.5 }, descStyle(st))));
        cy += nameH + (d ? descH : 0) + st.gap;
      } else if (st.center) {
        els.push(text(n, x, cy, w, nameH, n, Object.assign({ a: 'center', min: 6 }, nameStyle(st))));
        if (d) els.push(text(n + ' Beschreibung', x, cy + nameH, w, descH, d, Object.assign({ a: 'center', min: 5.5 }, descStyle(st))));
        els.push(text(n + ' Preis', x, cy + nameH + (d ? descH : 0), w, st.priceH || 4.2, p, Object.assign({ a: 'center', min: 6 }, priceStyle(st))));
        cy += nameH + (d ? descH : 0) + (st.priceH || 4.2) + st.gap;
      } else {
        const pw = st.priceW || 17;
        els.push(text(n, x, cy, w - pw - 1, nameH, n, Object.assign({ min: 6 }, nameStyle(st))));
        els.push(text(n + ' Preis', x + w - pw, cy, pw, nameH, p, Object.assign({ a: 'right', min: 6 }, priceStyle(st))));
        if (d) els.push(text(n + ' Beschreibung', x, cy + nameH, w - pw - 1, descH, d, Object.assign({ min: 5.5 }, descStyle(st))));
        cy += nameH + (d ? descH : 0) + st.gap;
        if (st.rule) els.push(line(n + ' Linie', x, cy - st.gap / 2, x + w, cy - st.gap / 2, st.rule, 0.2));
      }
    }
    cy += st.after || 2;
  }
  return { els, bottom: cy };
}

const nameStyle = st => ({ f: st.name.f, s: st.name.s, w: st.name.w, c: st.name.c, i: st.name.i, up: st.name.up });
const descStyle = st => ({ f: st.desc.f, s: st.desc.s, c: st.desc.c, i: st.desc.i, w: st.desc.w });
const priceStyle = st => ({ f: st.price.f, s: st.price.s, w: st.price.w, c: st.price.c, i: st.price.i });

module.exports = { menuBlock, SECTIONS };
