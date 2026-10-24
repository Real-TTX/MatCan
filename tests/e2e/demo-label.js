'use strict';
/* The demo label of docs/PLAN.md section 1.2 ("Käsetheke – Preisschild", 150 × 100 mm) as a design document, with the sample values of the reference
   (docs/images/demo-label.png). Used by designer-check.js (posted through the API, then looked at in the designer) and a model for the demo seed (phase I).
   Fonts and seals are the ones that ship with the app (Kaushan Script, Caveat, Montserrat, Oswald; icon-*, flag-*). */

function text(id, name, x, y, w, h, value, o) {
  return Object.assign({
    id, type: 'text', name, x, y, w, h, rotation: 0, opacity: 1, locked: false, hidden: false, showIf: null,
    text: value, fontFamily: 'Montserrat', fontSize: 12, fontWeight: 400, italic: false, color: '#111111',
    align: 'left', valign: 'middle', lineHeight: 1.1, letterSpacing: 0, uppercase: false, wrap: false, fit: 'shrink', minFontSize: 4,
  }, o || {});
}

function line(id, name, x, y, w, showIf) {
  return {
    id, type: 'shape', name, x, y, w, h: 0, rotation: 0, opacity: 1, locked: false, hidden: false, showIf: showIf || null,
    shape: 'line', fill: null, stroke: '#8c8c8c', strokeWidth: 0.6, dash: 'dotted', radius: 0,
  };
}

function demoDocument() {
  const navy = '#14213d';
  const orange = '#f5a524';
  const fields = [
    { key: 'Land', label: 'Herkunftsland', type: 'image', sample: 'flag-de', decimals: null, category: 'Flaggen', required: false },
    { key: 'Icon1', label: 'Siegel 1', type: 'image', sample: 'icon-schwangerschaft', decimals: null, category: 'Siegel', required: false },
    { key: 'Icon2', label: 'Siegel 2', type: 'image', sample: 'icon-heumilch', decimals: null, category: 'Siegel', required: false },
    { key: 'Icon3', label: 'Siegel 3', type: 'image', sample: 'icon-bio', decimals: null, category: 'Siegel', required: false },
    { key: 'Ort', label: 'Ort', type: 'text', sample: 'Geifertshofen', decimals: null, category: null, required: false },
    { key: 'Name', label: 'Name', type: 'text', sample: 'Holunderblüte', decimals: null, category: null, required: true },
    { key: 'Region', label: 'Region', type: 'text', sample: 'Hohenlohe / Schwäbischer Wald', decimals: null, category: null, required: false },
    { key: 'Gereift', label: 'Gereift', type: 'text', sample: '4 Wochen', decimals: null, category: null, required: false },
    { key: 'Fett', label: 'Fett i. Tr.', type: 'text', sample: '45 %', decimals: null, category: null, required: false },
    { key: 'Milchart', label: 'Milchart', type: 'text', sample: 'Kuhmilch, past.', decimals: null, category: null, required: false },
    { key: 'Preis', label: 'Preis', type: 'price', sample: '2.99', decimals: 2, category: null, required: true },
    { key: 'Einheit', label: 'Einheit', type: 'text', sample: '/ 100 g', decimals: null, category: null, required: false },
  ];
  const label = { fontFamily: 'Montserrat', fontSize: 10.5, fontWeight: 500, color: '#1a1a1a', align: 'left', valign: 'middle', fit: 'none' };
  const value = { fontFamily: 'Caveat', fontSize: 25, fontWeight: 700, color: '#111111', align: 'left', valign: 'middle', fit: 'shrink', minFontSize: 10 };
  const rows = [['GEREIFT:', 'Gereift', 70.6], ['FETT i. TR.:', 'Fett', 78.0], ['MILCH-ART:', 'Milchart', 85.4]];
  const elements = [
    {
      id: 'e1', type: 'shape', name: 'Rahmen', x: 1, y: 1, w: 148, h: 98, rotation: 0, opacity: 1, locked: true, hidden: false, showIf: null,
      shape: 'rect', fill: null, stroke: '#111111', strokeWidth: 0.9, dash: 'solid', radius: 0,
    },
    {
      id: 'e2', type: 'imageStrip', name: 'Herkunft und Siegel', x: 4, y: 4.2, w: 92, h: 16.5, rotation: 0, opacity: 1, locked: false, hidden: false, showIf: null,
      items: [{ field: 'Land' }, { field: 'Icon1' }, { field: 'Icon2' }, { field: 'Icon3' }], gap: 3.2, align: 'left',
    },
    text('e3', 'Logo: Der', 112, 2.2, 22, 10, 'Der', { fontFamily: 'Caveat', fontSize: 26, fontWeight: 700, italic: true, color: navy, fit: 'none', align: 'left' }),
    text('e4', 'Logo: Käse', 101.5, 10.4, 17, 10.5, 'KÄSE', { fontFamily: 'Oswald', fontSize: 25, fontWeight: 600, color: orange, fit: 'shrink', align: 'left' }),
    text('e5', 'Logo: Schneider', 116.2, 10.4, 31.8, 10.5, 'SCHNEIDER', { fontFamily: 'Oswald', fontSize: 25, fontWeight: 600, color: navy, fit: 'shrink', align: 'left' }),
    text('e6', 'Logo: Zeile', 103, 20.3, 43, 3.6, 'Käse für Genießer', { fontFamily: 'Montserrat', fontSize: 7.5, fontWeight: 500, color: navy, uppercase: true, letterSpacing: 0.16, align: 'center', fit: 'shrink' }),
    text('e7', 'Ort', 15, 25.2, 120, 10, '{{Ort}}', { fontFamily: 'Kaushan Script', fontSize: 27, color: '#111111', align: 'center', fit: 'shrink', minFontSize: 8 }),
    text('e8', 'Name', 3, 33.2, 144, 29.6, '{{Name}}', { fontFamily: 'Kaushan Script', fontSize: 100, color: '#000000', align: 'center', fit: 'shrink', minFontSize: 20, lineHeight: 1 }),
    text('e9', 'Region', 15, 62.2, 120, 7.4, '{{Region}}', { fontFamily: 'Kaushan Script', fontSize: 17, color: '#111111', align: 'center', fit: 'shrink', minFontSize: 7 }),
  ];
  let n = 10;
  for (const [title, key, y] of rows) {
    elements.push(text('e' + n++, 'Beschriftung ' + title, 3.9, y, 24, 7, title, Object.assign({}, label, { showIf: key })));
    elements.push(text('e' + n++, 'Wert ' + key, 28.8, y - 0.4, 60, 7.4, '{{' + key + '}}', Object.assign({}, value, { showIf: key })));
    elements.push(line('e' + n++, 'Linie ' + key, 29.4, y + 7.3, 59, key));
  }
  elements.push(text('e' + n++, 'Preis', 84.5, 67.5, 48, 26, '{{Preis}}', { fontFamily: 'Kaushan Script', fontSize: 86, color: '#000000', align: 'right', fit: 'shrink', minFontSize: 20, lineHeight: 1 }));
  elements.push(text('e' + n++, 'Euro', 136, 72, 11, 9, '€', { fontFamily: 'Montserrat', fontSize: 30, fontWeight: 500, color: '#111111', align: 'center', fit: 'none' }));
  elements.push(text('e' + n++, 'Einheit', 121, 86.8, 25, 6.5, '{{Einheit}}', { fontFamily: 'Montserrat', fontSize: 16, fontWeight: 500, color: '#111111', align: 'right', fit: 'shrink', minFontSize: 8 }));
  return { schema: 1, unit: 'mm', width: 150, height: 100, dpi: 300, locale: 'de-DE', background: { color: '#ffffff', asset: null, fit: 'cover' }, fields, elements };
}

/** Rows for the data list "Käsetheke (Beispiel)": the cheeses of the demo (the first is the reference label). */
function demoRows() {
  return [
    { Land: 'flag-de', Icon1: 'icon-schwangerschaft', Icon2: 'icon-heumilch', Icon3: 'icon-bio', Ort: 'Geifertshofen', Name: 'Holunderblüte', Region: 'Hohenlohe / Schwäbischer Wald', Gereift: '4 Wochen', Fett: '45 %', Milchart: 'Kuhmilch, past.', Preis: '2,99', Einheit: '/ 100 g' },
    { Land: 'flag-nl', Icon1: 'icon-laktosefrei', Icon2: '', Icon3: '', Ort: 'Gouda', Name: 'Alter Gouda', Region: 'Niederlande', Gereift: '18 Monate', Fett: '48 %', Milchart: 'Kuhmilch, past.', Preis: '3.49', Einheit: '/ 100 g' },
    { Land: 'flag-ch', Icon1: 'icon-rohmilch', Icon2: 'icon-regional', Icon3: '', Ort: 'Emmental', Name: 'Bergkäse', Region: 'Schweiz', Gereift: '12 Monate', Fett: '45 %', Milchart: 'Rohmilch', Preis: '4,25', Einheit: '/ 100 g' },
    { Land: 'flag-fr', Icon1: '', Icon2: '', Icon3: '', Ort: 'Normandie', Name: 'Camembert', Region: 'Frankreich', Gereift: '', Fett: '', Milchart: 'Kuhmilch', Preis: '2.19', Einheit: '/ 100 g' },
  ];
}

module.exports = { demoDocument, demoRows };
