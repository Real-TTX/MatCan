/*!
 * DesignThix render engine (phase D).
 *
 * Turns a design document (docs/PLAN.md section 2) plus a set of field values into an SVG element, a standalone SVG
 * string (fonts and images embedded), a PNG blob, and packs many PNGs into a store-only ZIP. The browser is the only
 * renderer: the designer, previews, thumbnails, print and export all go through this file.
 *
 * Plain JavaScript, no dependencies, no build step. Everything is built with DOM APIs (createElementNS, setAttribute,
 * textContent); document data never reaches HTML parsing, style attributes or URLs (assets resolve only through
 * opts.assetUrl). The one generated <style> element lives inside the exported SVG string (@font-face data URIs).
 *
 * Public API: window.DtEngine = { normalize, fieldsUsed, sampleValues, formatValue, resolveText, render, renderInto,
 *   toStandaloneSvg, rasterize, zip, layoutText, ptToUnit, unitToPx, unitToInch, SCHEMA, version }.
 */
(function (global) {
  'use strict';

  // ------------------------------------------------------------------------------------------------------------
  // Constants and small helpers
  // ------------------------------------------------------------------------------------------------------------

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const XLINK_NS = 'http://www.w3.org/1999/xlink';
  const XML_NS = 'http://www.w3.org/XML/1998/namespace';

  const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
  const TOKEN_PATTERN = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;
  const GENERIC_FAMILIES = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-sans-serif|ui-serif|ui-monospace)$/i;

  /**
   * The document schema as the engine understands it (limits are enforced by the C# side; the engine only clamps).
   * @type {Readonly<object>}
   */
  const SCHEMA = Object.freeze({
    version: 1,
    units: Object.freeze(['mm', 'px']),
    fieldTypes: Object.freeze(['text', 'multiline', 'number', 'price', 'image']),
    elementTypes: Object.freeze(['text', 'image', 'imageStrip', 'shape']),
    limits: Object.freeze({ elements: 500, fields: 100, stripItems: 12, textLength: 5000, sampleLength: 2000 }),
  });

  /** Reference font size (CSS px) used for canvas measuring; widths are scaled linearly to the real size. */
  const MEASURE_SIZE = 100;
  /** Placeholder (editor mode) colours. */
  const PLACEHOLDER_STROKE = '#8a94a0';
  const PLACEHOLDER_FILL = '#eef1f4';
  const PLACEHOLDER_TEXT = '#5f6975';

  let renderCounter = 0;

  function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }

  /** Finite number clamped to [min, max]; strings with a number are accepted, everything else gives `fallback`. */
  function num(value, fallback, min, max) {
    let n = typeof value === 'number' ? value : (typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN);
    if (!Number.isFinite(n)) n = fallback;
    if (min !== undefined && n < min) n = min;
    if (max !== undefined && n > max) n = max;
    return n;
  }

  function str(value, fallback, maxLength) {
    if (typeof value !== 'string') return fallback;
    return maxLength && value.length > maxLength ? value.slice(0, maxLength) : value;
  }

  function oneOf(value, allowed, fallback) { return allowed.indexOf(value) >= 0 ? value : fallback; }

  /** `#rgb` / `#rrggbb` or the fallback. Pass `null` as value to keep an explicit null (when `allowNull`). */
  function colour(value, fallback, allowNull) {
    if (value === null && allowNull) return null;
    if (typeof value === 'string' && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim())) return value.trim().toLowerCase();
    return fallback;
  }

  /** Number for an attribute: at most 4 decimals, no exponent. */
  function fmt(n) {
    if (!Number.isFinite(n)) return '0';
    const rounded = Math.round(n * 10000) / 10000;
    return Object.is(rounded, -0) ? '0' : String(rounded);
  }

  function countCodePoints(s) {
    let n = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c >= 0xdc00 && c <= 0xdfff && i > 0) continue; // low surrogate of a pair
      n++;
    }
    return n;
  }

  function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), ms);
      promise.then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
    });
  }

  // ------------------------------------------------------------------------------------------------------------
  // Units
  // ------------------------------------------------------------------------------------------------------------

  /**
   * Converts a font size in points to document units.
   * @param {number} pt points
   * @param {'mm'|'px'} unit document unit
   * @returns {number}
   */
  function ptToUnit(pt, unit) { return unit === 'px' ? pt * 96 / 72 : pt * 25.4 / 72; }

  /**
   * Converts a length in document units to CSS pixels (96 per inch).
   * @param {number} value length
   * @param {'mm'|'px'} unit document unit
   * @returns {number}
   */
  function unitToPx(value, unit) { return unit === 'px' ? value : value * 96 / 25.4; }

  /** Converts a length in document units to inches. */
  function unitToInch(value, unit) { return unit === 'px' ? value / 96 : value / 25.4; }

  // ------------------------------------------------------------------------------------------------------------
  // normalize / fields
  // ------------------------------------------------------------------------------------------------------------

  function validLocale(value) {
    if (typeof value !== 'string' || value.length > 35) return 'de-DE';
    try { new Intl.NumberFormat(value); return value; } catch (e) { return 'de-DE'; }
  }

  function normalizeField(raw) {
    if (!isObject(raw) || typeof raw.key !== 'string' || !KEY_PATTERN.test(raw.key)) return null;
    const type = oneOf(raw.type, SCHEMA.fieldTypes, 'text');
    let decimals = null;
    if (raw.decimals !== null && raw.decimals !== undefined && Number.isFinite(Number(raw.decimals))) decimals = Math.round(num(raw.decimals, 2, 0, 4));
    if (type === 'price' && decimals === null) decimals = 2;
    return {
      key: raw.key,
      label: str(raw.label, raw.key, 80) || raw.key,
      type,
      sample: str(raw.sample, '', 2000),
      decimals: type === 'price' || type === 'number' ? decimals : null,
      category: typeof raw.category === 'string' && raw.category ? raw.category.slice(0, 80) : null,
      required: raw.required === true,
    };
  }

  function normalizeSource(raw) {
    if (!isObject(raw)) return null;
    if (typeof raw.asset === 'string' && raw.asset.trim() !== '') return { asset: raw.asset.trim().slice(0, 200) };
    if (typeof raw.field === 'string' && KEY_PATTERN.test(raw.field)) return { field: raw.field };
    return null;
  }

  function normalizeElement(raw, usedIds, index) {
    if (!isObject(raw)) return null;
    const type = oneOf(raw.type, SCHEMA.elementTypes, null);
    if (!type) return null;
    let id = typeof raw.id === 'string' && raw.id !== '' ? raw.id.slice(0, 24) : '';
    if (!id || usedIds.has(id)) {
      let n = index + 1;
      while (usedIds.has('e' + n)) n++;
      id = 'e' + n;
    }
    usedIds.add(id);
    const e = {
      id,
      type,
      name: str(raw.name, '', 80),
      x: num(raw.x, 0, -1e6, 1e6),
      y: num(raw.y, 0, -1e6, 1e6),
      w: num(raw.w, 0, 0, 1e6),
      h: num(raw.h, 0, 0, 1e6),
      rotation: num(raw.rotation, 0, -360, 360),
      opacity: num(raw.opacity, 1, 0, 1),
      locked: raw.locked === true,
      hidden: raw.hidden === true,
      showIf: typeof raw.showIf === 'string' && KEY_PATTERN.test(raw.showIf) ? raw.showIf : null,
    };
    if (type === 'text') {
      const fontSize = num(raw.fontSize, 12, 1, 1000);
      Object.assign(e, {
        text: str(raw.text, '', 5000),
        fontFamily: str(raw.fontFamily, 'sans-serif', 100) || 'sans-serif',
        fontSize,
        fontWeight: Math.round(num(raw.fontWeight, 400, 100, 900)),
        italic: raw.italic === true,
        color: colour(raw.color, '#000000'),
        align: oneOf(raw.align, ['left', 'center', 'right'], 'left'),
        valign: oneOf(raw.valign, ['top', 'middle', 'bottom'], 'top'),
        lineHeight: num(raw.lineHeight, 1.2, 0.5, 3),
        letterSpacing: num(raw.letterSpacing, 0, -0.5, 2),
        uppercase: raw.uppercase === true,
        wrap: raw.wrap !== false,
        fit: oneOf(raw.fit, ['none', 'shrink'], 'none'),
        minFontSize: Math.min(fontSize, num(raw.minFontSize, 4, 0.5, 1000)),
      });
    } else if (type === 'image') {
      Object.assign(e, {
        source: normalizeSource(raw.source),
        fit: oneOf(raw.fit, ['contain', 'cover', 'fill'], 'contain'),
        radius: num(raw.radius, 0, 0, 1e6),
      });
    } else if (type === 'imageStrip') {
      const items = Array.isArray(raw.items) ? raw.items.slice(0, SCHEMA.limits.stripItems).map(normalizeSource) : [];
      Object.assign(e, {
        items,
        gap: num(raw.gap, 0, 0, 1e6),
        align: oneOf(raw.align, ['left', 'center', 'right'], 'left'),
      });
    } else {
      const shape = oneOf(raw.shape, ['rect', 'ellipse', 'line'], 'rect');
      Object.assign(e, {
        shape,
        fill: colour(raw.fill, null, true),
        stroke: colour(raw.stroke, shape === 'line' ? '#000000' : null, true),
        strokeWidth: num(raw.strokeWidth, 1, 0, 1000),
        dash: oneOf(raw.dash, ['solid', 'dashed', 'dotted'], 'solid'),
        radius: num(raw.radius, 0, 0, 1e6),
      });
    }
    return e;
  }

  /**
   * Returns a new, fully defaulted and clamped copy of a design document. Unknown properties are dropped, invalid
   * colours/numbers replaced by defaults, unknown element types removed. Idempotent; never throws; never mutates.
   * @param {object} input the (possibly incomplete or hostile) document
   * @returns {object} normalized document
   */
  function normalize(input) {
    const src = isObject(input) ? input : {};
    const unit = src.unit === 'px' ? 'px' : 'mm';
    const defaultSize = unit === 'px' ? 800 : 100;
    const background = isObject(src.background) ? src.background : {};
    const fields = [];
    const seenKeys = new Set();
    for (const raw of Array.isArray(src.fields) ? src.fields : []) {
      const f = normalizeField(raw);
      if (!f || seenKeys.has(f.key.toLowerCase())) continue;
      seenKeys.add(f.key.toLowerCase());
      fields.push(f);
      if (fields.length >= SCHEMA.limits.fields) break;
    }
    const usedIds = new Set();
    const elements = [];
    const rawElements = Array.isArray(src.elements) ? src.elements.slice(0, SCHEMA.limits.elements) : [];
    rawElements.forEach((raw, i) => {
      const e = normalizeElement(raw, usedIds, i);
      if (e) elements.push(e);
    });
    return {
      schema: 1,
      unit,
      width: num(src.width, defaultSize, 0.1, 100000),
      height: num(src.height, defaultSize, 0.1, 100000),
      dpi: Math.round(num(src.dpi, 300, 72, 1200)),
      locale: validLocale(src.locale),
      background: {
        color: colour(background.color, '#ffffff'),
        asset: typeof background.asset === 'string' && background.asset.trim() !== '' ? background.asset.trim().slice(0, 200) : null,
        fit: oneOf(background.fit, ['cover', 'contain', 'fill'], 'cover'),
      },
      fields,
      elements,
    };
  }

  /**
   * Lists the field keys a document uses (placeholders in texts, image sources, strip items, showIf), with where.
   * @param {object} input document
   * @returns {Array<{key:string, defined:boolean, field:object|null, uses:Array<{elementId:string, elementName:string, kind:'text'|'image'|'strip'|'showIf'}>}>}
   *   one entry per key (case-insensitive), in order of first use; `defined` = the document has a field of that key
   */
  function fieldsUsed(input) {
    const doc = normalize(input);
    const byKey = new Map(doc.fields.map(f => [f.key.toLowerCase(), f]));
    const entries = new Map();
    const add = (key, element, kind) => {
      const lower = key.toLowerCase();
      let entry = entries.get(lower);
      if (!entry) {
        const field = byKey.get(lower) || null;
        entry = { key: field ? field.key : key, defined: field !== null, field, uses: [] };
        entries.set(lower, entry);
      }
      if (!entry.uses.some(u => u.elementId === element.id && u.kind === kind)) entry.uses.push({ elementId: element.id, elementName: element.name, kind });
    };
    for (const e of doc.elements) {
      if (e.showIf) add(e.showIf, e, 'showIf');
      if (e.type === 'text') {
        for (const m of e.text.matchAll(TOKEN_PATTERN)) add(m[1], e, 'text');
      } else if (e.type === 'image') {
        if (e.source && e.source.field) add(e.source.field, e, 'image');
      } else if (e.type === 'imageStrip') {
        for (const item of e.items) if (item && item.field) add(item.field, e, 'strip');
      }
    }
    return Array.from(entries.values());
  }

  /**
   * The sample value of every field as a values object (key → sample).
   * @param {object} input document
   * @returns {Object<string,string>}
   */
  function sampleValues(input) {
    const values = {};
    for (const f of normalize(input).fields) values[f.key] = f.sample;
    return values;
  }

  // ------------------------------------------------------------------------------------------------------------
  // Values: formatting and placeholder substitution
  // ------------------------------------------------------------------------------------------------------------

  const formatters = new Map();

  function numberFormatter(locale, decimals) {
    const key = locale + '|' + decimals;
    let f = formatters.get(key);
    if (!f) {
      try {
        f = new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      } catch (e) {
        f = new Intl.NumberFormat('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      }
      formatters.set(key, f);
    }
    return f;
  }

  /**
   * Parses a typed number: "2.99", "2,99", "1.234,56", "1,234.56", "2,99 €", "-3". A single separator is the decimal
   * separator; a separator that occurs several times, or the one before the last in "1.234,56", groups thousands.
   * @returns {number|null} null when the text is not a number
   */
  function parseNumber(text) {
    let t = text.replace(/[\s\u00a0\u202f']/g, '').replace(/[€$£¥%]/g, '');
    if (!/^[+-]?[\d.,]*\d[\d.,]*$/.test(t)) return null;
    let sign = 1;
    if (t[0] === '-') sign = -1;
    if (t[0] === '-' || t[0] === '+') t = t.slice(1);
    const lastComma = t.lastIndexOf(',');
    const lastDot = t.lastIndexOf('.');
    let decimalIndex = -1;
    if (lastComma >= 0 && lastDot >= 0) {
      decimalIndex = Math.max(lastComma, lastDot);
    } else if (lastComma >= 0 || lastDot >= 0) {
      const sep = lastComma >= 0 ? ',' : '.';
      const occurrences = t.split(sep).length - 1;
      if (occurrences === 1) decimalIndex = t.lastIndexOf(sep);
    }
    const integer = (decimalIndex >= 0 ? t.slice(0, decimalIndex) : t).replace(/[.,]/g, '');
    const fraction = decimalIndex >= 0 ? t.slice(decimalIndex + 1).replace(/[.,]/g, '') : '';
    const n = Number((integer || '0') + (fraction ? '.' + fraction : ''));
    return Number.isFinite(n) ? sign * n : null;
  }

  /**
   * Formats a raw value as a field of its type: `price` → number with `decimals` (default 2) in `locale` ("2,99"),
   * `number` → `decimals` if set, otherwise as typed; text/multiline as is; image trimmed. Values that are not numbers
   * stay as typed. null/undefined → ''.
   * @param {{type?:string, decimals?:number|null}|null} field the field definition (null/undefined: plain text)
   * @param {*} raw raw value (data list cells are strings; numbers are accepted)
   * @param {string} [locale] BCP 47 tag, default de-DE
   * @returns {string}
   */
  function formatValue(field, raw, locale) {
    if (raw === null || raw === undefined) return '';
    const text = typeof raw === 'string' ? raw : String(raw);
    const type = field && typeof field.type === 'string' ? field.type : 'text';
    if (type === 'price' || type === 'number') {
      const trimmed = text.trim();
      if (trimmed === '') return '';
      let decimals = field.decimals;
      decimals = decimals === null || decimals === undefined || !Number.isFinite(Number(decimals)) ? null : Math.round(num(decimals, 2, 0, 4));
      if (type === 'price' && decimals === null) decimals = 2;
      if (decimals === null) return trimmed;
      const n = parseNumber(trimmed);
      return n === null ? trimmed : numberFormatter(locale || 'de-DE', decimals).format(n);
    }
    if (type === 'image') return text.trim();
    return text;
  }

  function buildValueMap(values) {
    const map = new Map();
    if (values instanceof Map) {
      values.forEach((v, k) => map.set(String(k).toLowerCase(), v === null || v === undefined ? null : String(v)));
    } else if (values && typeof values === 'object') {
      for (const k of Object.keys(values)) {
        const v = values[k];
        map.set(k.toLowerCase(), v === null || v === undefined ? null : String(v));
      }
    }
    return map;
  }

  /** Resolver over fields and values: `.raw(key)` raw string or null, `.value(key)` formatted ('' when missing),
   *  `.text(key)` formatted, or the token itself when missing and `missing === 'token'`. */
  function makeResolver(fields, valueMap, locale, missing) {
    const byKey = new Map();
    for (const f of fields) if (f && typeof f.key === 'string') byKey.set(f.key.toLowerCase(), f);
    const raw = key => { const v = valueMap.get(key.toLowerCase()); return v === undefined ? null : v; };
    const value = key => {
      const r = raw(key);
      return r === null ? '' : formatValue(byKey.get(key.toLowerCase()) || null, r, locale);
    };
    return {
      field: key => byKey.get(key.toLowerCase()) || null,
      raw,
      value,
      text: key => (raw(key) === null && missing === 'token' ? '{{' + key + '}}' : value(key)),
    };
  }

  /**
   * Replaces `{{Key}}` placeholders (whitespace inside the braces allowed, key matched case-insensitively) with the
   * formatted value of the field. An unknown key or a missing value renders empty, or as `{{Key}}` with
   * `missing === 'token'`.
   * @param {string} text text with placeholders
   * @param {Array<object>} fields field definitions (for the type formatting)
   * @param {object|Map} values values by field key
   * @param {string} [locale] default de-DE
   * @param {'empty'|'token'} [missing] default 'empty'
   * @returns {string}
   */
  function resolveText(text, fields, values, locale, missing) {
    const resolver = makeResolver(Array.isArray(fields) ? fields : [], buildValueMap(values), locale || 'de-DE', missing === 'token' ? 'token' : 'empty');
    return String(text === null || text === undefined ? '' : text).replace(TOKEN_PATTERN, (all, key) => resolver.text(key));
  }

  function upperCase(text, locale) {
    try { return text.toLocaleUpperCase(locale); } catch (e) { return text.toUpperCase(); }
  }

  // ------------------------------------------------------------------------------------------------------------
  // Fonts: families, loading, registering
  // ------------------------------------------------------------------------------------------------------------

  /** Family name that is safe inside a CSS string / SVG attribute: no quotes, backslashes, braces, semicolons, commas. */
  function cleanFamily(family) {
    // eslint-disable-next-line no-control-regex
    const cleaned = String(family || '').replace(/[\u0000-\u001f"'\\;{}<>,]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
    return cleaned || 'sans-serif';
  }

  /** CSS font-family list for attributes and canvas: `'Name', sans-serif` (generic names stay unquoted). */
  function cssFamily(family) {
    const name = cleanFamily(family);
    return GENERIC_FAMILIES.test(name) ? name : "'" + name + "', sans-serif";
  }

  function fontShorthand(family, weight, italic, sizePx) {
    return (italic ? 'italic ' : '') + weight + ' ' + sizePx + 'px ' + cssFamily(family);
  }

  function parseWeightRange(weight) {
    if (typeof weight === 'number' && Number.isFinite(weight)) return [weight, weight];
    const text = String(weight === null || weight === undefined ? '400' : weight);
    const numbers = text.match(/\d+/g);
    if (!numbers) return /bold/i.test(text) ? [700, 700] : [400, 400];
    const a = Number(numbers[0]);
    const b = numbers[1] ? Number(numbers[1]) : a;
    return [Math.min(a, b), Math.max(a, b)];
  }

  function normalizeFaceList(list) {
    const faces = [];
    for (const f of Array.isArray(list) ? list : []) {
      if (!isObject(f) || typeof f.family !== 'string' || typeof f.url !== 'string' || f.url === '') continue;
      const range = parseWeightRange(f.weight);
      faces.push({
        family: cleanFamily(f.family),
        min: range[0],
        max: range[1],
        style: /italic|oblique/i.test(String(f.style || '')) ? 'italic' : 'normal',
        url: f.url,
      });
    }
    return faces;
  }

  /** Best face for a requested family/weight/style: same style first, then the range containing the weight, else nearest. */
  function pickFace(faces, family, weight, italic) {
    const lower = cleanFamily(family).toLowerCase();
    let candidates = faces.filter(f => f.family.toLowerCase() === lower);
    if (!candidates.length) return null;
    const style = italic ? 'italic' : 'normal';
    const sameStyle = candidates.filter(f => f.style === style);
    if (sameStyle.length) candidates = sameStyle;
    let best = null;
    let bestDistance = Infinity;
    for (const f of candidates) {
      const distance = weight < f.min ? f.min - weight : (weight > f.max ? weight - f.max : 0);
      if (distance < bestDistance) { best = f; bestDistance = distance; }
    }
    return best;
  }

  function weightDescriptor(face) { return face.min === face.max ? String(face.min) : face.min + ' ' + face.max; }

  function cssUrl(url) { return 'url("' + String(url).replace(/["\\\r\n]/g, ch => '%' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')) + '"'; }

  const registeredFaces = new Map();

  function documentHasFace(face) {
    if (!global.document || !document.fonts || typeof document.fonts.forEach !== 'function') return false;
    let found = false;
    const wanted = face.family.toLowerCase();
    document.fonts.forEach(ff => {
      if (found) return;
      const family = String(ff.family).replace(/^["']|["']$/g, '').toLowerCase();
      if (family === wanted && ff.style === face.style && String(ff.weight).replace(/\s+/g, ' ') === weightDescriptor(face)) found = true;
    });
    return found;
  }

  /** Registers the faces of `opts.fonts` that the document uses and that the page does not know yet. */
  function registerFaces(faces, usedFamilies) {
    if (!global.document || !document.fonts || typeof global.FontFace !== 'function') return;
    for (const face of faces) {
      if (!usedFamilies.has(face.family.toLowerCase())) continue;
      const key = face.family.toLowerCase() + '|' + weightDescriptor(face) + '|' + face.style + '|' + face.url;
      if (registeredFaces.has(key)) continue;
      registeredFaces.set(key, null);
      if (documentHasFace(face)) continue;
      try {
        const fontFace = new FontFace(face.family, cssUrl(face.url), { weight: weightDescriptor(face), style: face.style });
        document.fonts.add(fontFace);
        registeredFaces.set(key, fontFace);
        fontFace.load().catch(() => { /* reported through the load of document.fonts below */ });
      } catch (e) { /* unsupported descriptor or url: the fallback font is used */ }
    }
  }

  /** Waits until every used face is loaded (registering `fontList` entries first). Never rejects. */
  async function ensureFonts(used, fontList) {
    if (!global.document || !document.fonts || typeof document.fonts.load !== 'function') return;
    const families = new Set(used.map(u => cleanFamily(u.family).toLowerCase()));
    registerFaces(normalizeFaceList(fontList), families);
    const samples = new Map();
    for (const u of used) {
      const shorthand = fontShorthand(u.family, u.weight, u.italic, 16);
      const previous = samples.get(shorthand) || '';
      if (previous.length < 600) samples.set(shorthand, previous + u.text);
    }
    await Promise.all(Array.from(samples, ([shorthand, sample]) =>
      withTimeout(document.fonts.load(shorthand, sample || ' '), 10000).catch(() => { /* fallback font */ })));
  }

  // ------------------------------------------------------------------------------------------------------------
  // Text measuring and layout
  // ------------------------------------------------------------------------------------------------------------

  let measureContext = null;
  let fontEpoch = 0;
  const measurers = new Map();

  if (global.document && document.fonts && typeof document.fonts.addEventListener === 'function') {
    // A face that finishes loading changes the metrics of everything measured before: drop the caches.
    document.fonts.addEventListener('loadingdone', () => { fontEpoch++; measurers.clear(); });
  }

  function getMeasureContext() {
    if (!measureContext) {
      const canvas = document.createElement('canvas');
      measureContext = canvas.getContext('2d');
    }
    return measureContext;
  }

  /** Measures strings of one face at a reference size; results are in em (multiply by the font size). */
  function getMeasurer(family, weight, italic) {
    const key = fontEpoch + '|' + cleanFamily(family) + '|' + weight + '|' + (italic ? 1 : 0);
    let measurer = measurers.get(key);
    if (measurer) return measurer;
    const ctx = getMeasureContext();
    const font = fontShorthand(family, weight, italic, MEASURE_SIZE);
    const widths = new Map();
    ctx.font = font;
    const probe = ctx.measureText('Hxg');
    const hasMetrics = typeof probe.fontBoundingBoxAscent === 'number' && probe.fontBoundingBoxAscent + probe.fontBoundingBoxDescent > 0;
    measurer = {
      ascent: hasMetrics ? probe.fontBoundingBoxAscent / MEASURE_SIZE : 0.8,
      descent: hasMetrics ? probe.fontBoundingBoxDescent / MEASURE_SIZE : 0.2,
      width(text) {
        let w = widths.get(text);
        if (w === undefined) {
          ctx.font = font;
          w = ctx.measureText(text).width / MEASURE_SIZE;
          widths.set(text, w);
        }
        return w;
      },
    };
    measurers.set(key, measurer);
    return measurer;
  }

  /** Cuts the longest head of `text` that fits `available` (at least one character) – for words wider than the box. */
  function splitToFit(text, available, measure) {
    const chars = Array.from(text);
    let n = 1;
    while (n < chars.length && measure(chars.slice(0, n + 1).join('')) <= available) n++;
    return [chars.slice(0, n).join(''), chars.slice(n).join('')];
  }

  /** Greedy word wrap of one paragraph into `out`; `available` in em, Infinity = no wrapping. */
  function wrapParagraph(paragraph, available, measure, out) {
    if (available === Infinity) { out.push(paragraph); return; }
    let line = null;
    for (const word of paragraph.split(' ')) {
      if (line === null) {
        line = word;
      } else {
        const candidate = line + ' ' + word;
        if (measure(candidate) <= available) { line = candidate; continue; }
        out.push(line.replace(/\s+$/, ''));
        line = word;
      }
      while (measure(line) > available) {
        const parts = splitToFit(line, available, measure);
        if (parts[1] === '') break; // a single glyph wider than the box cannot be broken further
        out.push(parts[0]);
        line = parts[1];
      }
    }
    out.push((line || '').replace(/\s+$/, ''));
  }

  /**
   * Lays a text out in a box (no DOM involved except a measuring canvas). Fonts must be loaded before (render() does it).
   * Widths are measured at a reference size and scaled, so the result does not depend on rounding of tiny sizes.
   * @param {object} spec
   * @param {string} spec.text final text (placeholders resolved, uppercase applied); `\n` starts a new line
   * @param {string} [spec.fontFamily] @param {number} [spec.fontSize] pt @param {number} [spec.fontWeight]
   * @param {boolean} [spec.italic] @param {number} [spec.letterSpacing] em @param {number} [spec.lineHeight] factor
   * @param {boolean} [spec.wrap] default true @param {'none'|'shrink'} [spec.fit] @param {number} [spec.minFontSize] pt
   * @param {number} [spec.width] box width in `unit` (0 = unlimited) @param {number} [spec.height] box height (0 = unlimited)
   * @param {'mm'|'px'} [spec.unit]
   * @returns {{fontSizePt:number, fontSize:number, lineHeight:number, ascent:number, descent:number, baselineOffset:number,
   *   lines:Array<{text:string,width:number}>, width:number, height:number, shrunk:boolean, fits:boolean}}
   *   sizes in document units: `baselineOffset` = baseline distance from the top of a line box, `width` = widest line,
   *   `height` = lines × lineHeight, `fits` = the result fits the box (width, and height when wrapping)
   */
  function layoutText(spec) {
    const s = spec || {};
    const unit = s.unit === 'px' ? 'px' : 'mm';
    const weight = Math.round(num(s.fontWeight, 400, 100, 900));
    const italic = s.italic === true;
    const measurer = getMeasurer(s.fontFamily || 'sans-serif', weight, italic);
    const spacing = num(s.letterSpacing, 0, -0.5, 2);
    const lineHeightFactor = num(s.lineHeight, 1.2, 0.5, 3);
    const wrap = s.wrap !== false;
    const boxWidth = num(s.width, 0, 0);
    const boxHeight = num(s.height, 0, 0);
    const paragraphs = String(s.text === null || s.text === undefined ? '' : s.text).split(/\r\n|\r|\n/);
    const maxPt = num(s.fontSize, 12, 0.1, 10000);
    const minPt = Math.min(maxPt, num(s.minFontSize, 4, 0.1, 10000));
    const measure = text => measurer.width(text) + spacing * Math.max(0, countCodePoints(text) - 1);

    // Line height box: content area (ascent + descent) centred in lineHeight × size, like CSS half-leading.
    const baselineEm = (lineHeightFactor - (measurer.ascent + measurer.descent)) / 2 + measurer.ascent;

    function layoutAt(pt) {
      const size = ptToUnit(pt, unit);
      const available = wrap && boxWidth > 0 ? boxWidth / size : Infinity;
      const texts = [];
      for (const paragraph of paragraphs) wrapParagraph(paragraph, available, measure, texts);
      const lines = texts.map(text => ({ text, width: measure(text) * size }));
      const width = lines.reduce((max, l) => Math.max(max, l.width), 0);
      return { pt, size, lines, width, height: lines.length * lineHeightFactor * size };
    }
    function fits(layout) {
      if (boxWidth > 0 && layout.width > boxWidth + 0.001) return false;
      return !(wrap && boxHeight > 0 && layout.height > boxHeight + 0.001);
    }

    let chosen = layoutAt(maxPt);
    let shrunk = false;
    if (s.fit === 'shrink' && !fits(chosen)) {
      // Largest size on the 0.25 pt grid above minPt that fits; binary search (fit is monotonic in the size).
      const steps = Math.floor((maxPt - minPt) / 0.25);
      let low = 0;
      let high = steps;
      let best = null;
      while (low <= high) {
        const mid = (low + high) >> 1;
        const candidate = layoutAt(minPt + mid * 0.25);
        if (fits(candidate)) { best = candidate; low = mid + 1; } else { high = mid - 1; }
      }
      chosen = best || layoutAt(minPt);
      shrunk = true;
    }
    return {
      fontSizePt: chosen.pt,
      fontSize: chosen.size,
      lineHeight: lineHeightFactor * chosen.size,
      ascent: measurer.ascent * chosen.size,
      descent: measurer.descent * chosen.size,
      baselineOffset: baselineEm * chosen.size,
      lines: chosen.lines,
      width: chosen.width,
      height: chosen.height,
      shrunk,
      fits: fits(chosen),
    };
  }

  // ------------------------------------------------------------------------------------------------------------
  // Images: natural size, data URIs
  // ------------------------------------------------------------------------------------------------------------

  const imageInfoCache = new Map();

  function parseLength(value) {
    const m = /^\s*([\d.]+)\s*(px|pt|mm|cm|in|)?\s*$/i.exec(value || '');
    return m ? Number(m[1]) : NaN;
  }

  /** Aspect ratio of an SVG source: width/height attributes, else the viewBox, else 1. */
  function svgRatio(svgText) {
    try {
      const parsed = new DOMParser().parseFromString(svgText, 'image/svg+xml');
      const root = parsed.documentElement;
      if (!root || root.localName !== 'svg') return 1;
      const w = parseLength(root.getAttribute('width'));
      const h = parseLength(root.getAttribute('height'));
      if (w > 0 && h > 0) return w / h;
      const box = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
      if (box.length === 4 && box[2] > 0 && box[3] > 0) return box[2] / box[3];
    } catch (e) { /* fall through */ }
    return 1;
  }

  /**
   * Natural aspect ratio of an image URL, loaded once and cached. SVG without an intrinsic size uses its viewBox
   * ratio, anything unknown 1:1. Never rejects; failures are not cached.
   * @returns {Promise<{ratio:number, ok:boolean}>}
   */
  function loadImageInfo(url) {
    let promise = imageInfoCache.get(url);
    if (promise) return promise;
    promise = (async () => {
      let width = 0;
      let height = 0;
      let ok = false;
      try {
        const img = new Image();
        const loaded = new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(new Error('image')); });
        img.src = url;
        await withTimeout(loaded, 15000);
        width = img.naturalWidth;
        height = img.naturalHeight;
        ok = true;
      } catch (e) { ok = false; }
      if (ok && (!(width > 0) || !(height > 0))) {
        try {
          const response = await fetch(url, { credentials: 'same-origin' });
          const text = response.ok ? await response.text() : '';
          if (text.indexOf('<svg') >= 0) { const ratio = svgRatio(text); return { ratio, ok: true }; }
        } catch (e) { /* 1:1 */ }
        return { ratio: 1, ok: true };
      }
      return { ratio: ok ? width / height : 1, ok };
    })();
    imageInfoCache.set(url, promise);
    promise.then(info => { if (!info.ok) imageInfoCache.delete(url); });
    return promise;
  }

  const dataUriCache = new Map();

  function readAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error || new Error('read'));
      reader.readAsDataURL(blob);
    });
  }

  function blobToArrayBuffer(blob) {
    if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('read'));
      reader.readAsArrayBuffer(blob);
    });
  }

  function startsWith(bytes, ...codes) { return codes.every((c, i) => bytes[i] === c); }

  function sniffImageType(bytes, textStart) {
    if (startsWith(bytes, 0x89, 0x50, 0x4e, 0x47)) return 'image/png';
    if (startsWith(bytes, 0xff, 0xd8, 0xff)) return 'image/jpeg';
    if (startsWith(bytes, 0x47, 0x49, 0x46, 0x38)) return 'image/gif';
    if (startsWith(bytes, 0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
    if (/<svg[\s>]/i.test(textStart)) return 'image/svg+xml';
    return '';
  }

  function sniffFontType(bytes) {
    if (startsWith(bytes, 0x77, 0x4f, 0x46, 0x32)) return 'font/woff2';
    if (startsWith(bytes, 0x77, 0x4f, 0x46, 0x46)) return 'font/woff';
    if (startsWith(bytes, 0x4f, 0x54, 0x54, 0x4f)) return 'font/otf';
    return 'font/ttf';
  }

  function rememberDataUri(url, promise) {
    dataUriCache.set(url, promise);
    if (dataUriCache.size > 120) dataUriCache.delete(dataUriCache.keys().next().value);
    promise.then(v => { if (v === null) dataUriCache.delete(url); });
    return promise;
  }

  /** Fetches a URL and returns it as `data:` URI (null when it cannot be read). `kind` is 'image' or 'font'. */
  function toDataUri(url, kind) {
    const cacheKey = kind + '|' + url;
    const cached = dataUriCache.get(cacheKey);
    if (cached) return cached;
    return rememberDataUri(cacheKey, (async () => {
      try {
        const response = await fetch(url, { credentials: 'same-origin' });
        if (!response.ok) return null;
        const blob = await response.blob();
        const bytes = new Uint8Array(await blobToArrayBuffer(blob.slice(0, 512)));
        let type;
        if (kind === 'font') {
          type = sniffFontType(bytes);
        } else {
          let head = '';
          for (let i = 0; i < bytes.length; i++) head += String.fromCharCode(bytes[i]);
          type = sniffImageType(bytes, head) || (/^image\//.test(blob.type) ? blob.type : '');
        }
        if (!type) return null;
        return await readAsDataUrl(new Blob([blob], { type }));
      } catch (e) { return null; }
    })());
  }

  // ------------------------------------------------------------------------------------------------------------
  // SVG building
  // ------------------------------------------------------------------------------------------------------------

  function svgElement(name, attributes, parent) {
    const node = document.createElementNS(SVG_NS, name);
    if (attributes) {
      for (const key of Object.keys(attributes)) {
        const value = attributes[key];
        if (value !== null && value !== undefined) node.setAttribute(key, String(value));
      }
    }
    if (parent) parent.appendChild(node);
    return node;
  }

  function rotationTransform(e) {
    if (!e.rotation) return null;
    return 'rotate(' + fmt(e.rotation) + ' ' + fmt(e.x + e.w / 2) + ' ' + fmt(e.y + e.h / 2) + ')';
  }

  function sanitizeId(value) { return String(value).replace(/[^A-Za-z0-9_-]/g, '_'); }

  /** The `<g>` of an element: id, type, rotation around the centre, opacity. */
  function elementGroup(e, parent) {
    const g = svgElement('g', { 'data-el-id': e.id, 'data-el-type': e.type }, parent);
    const transform = rotationTransform(e);
    if (transform) g.setAttribute('transform', transform);
    if (e.opacity < 1) g.setAttribute('opacity', fmt(e.opacity));
    return g;
  }

  /** Dash pattern: dashed = 3w,2w, dotted = 0,2w with round caps (w = stroke width). */
  function applyStroke(node, colourValue, widthUnits, dash) {
    if (!colourValue || !(widthUnits > 0)) { node.setAttribute('stroke', 'none'); return; }
    node.setAttribute('stroke', colourValue);
    node.setAttribute('stroke-width', fmt(widthUnits));
    if (dash === 'dashed') {
      node.setAttribute('stroke-dasharray', fmt(3 * widthUnits) + ',' + fmt(2 * widthUnits));
    } else if (dash === 'dotted') {
      node.setAttribute('stroke-dasharray', '0,' + fmt(2 * widthUnits));
      node.setAttribute('stroke-linecap', 'round');
    }
  }

  function createClip(state, parent, x, y, w, h, radius) {
    const id = state.prefix + 'c' + (++state.clipCounter);
    const clip = svgElement('clipPath', { id }, parent);
    const r = Math.min(radius || 0, w / 2, h / 2);
    svgElement('rect', { x: fmt(x), y: fmt(y), width: fmt(w), height: fmt(h), rx: r > 0 ? fmt(r) : null }, clip);
    return id;
  }

  /** Draws one `<image>`. cover = slice + clip, contain = meet, fill = none; radius clips with rounded corners. */
  function drawImage(state, parent, box, url, fit, radius, ratio) {
    const preserve = fit === 'fill' ? 'none' : (fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet');
    let clipBox = null;
    if (fit === 'cover' || radius > 0) {
      clipBox = box;
      if (fit === 'contain' && ratio > 0 && box.w > 0 && box.h > 0) {
        // Round the corners of the picture itself, not of the whole box.
        const w = Math.min(box.w, box.h * ratio);
        const h = w / ratio;
        clipBox = { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
      }
    }
    const image = svgElement('image', {
      x: fmt(box.x), y: fmt(box.y), width: fmt(box.w), height: fmt(box.h), href: url, preserveAspectRatio: preserve,
    }, parent);
    if (clipBox) image.setAttribute('clip-path', 'url(#' + createClip(state, parent, clipBox.x, clipBox.y, clipBox.w, clipBox.h, radius) + ')');
    state.images.push({ el: image, url });
    return image;
  }

  /** Editor-only dashed rectangle with a small label where an image would be. */
  function drawPlaceholder(state, parent, box, label) {
    if (!(box.w > 0) || !(box.h > 0)) return;
    const unit = state.doc.unit;
    const strokeWidth = ptToUnit(0.75, unit);
    const group = svgElement('g', { 'data-dt-placeholder': '1' }, parent);
    const rect = svgElement('rect', {
      x: fmt(box.x), y: fmt(box.y), width: fmt(box.w), height: fmt(box.h), fill: PLACEHOLDER_FILL, 'fill-opacity': '0.7',
    }, group);
    applyStroke(rect, PLACEHOLDER_STROKE, strokeWidth, 'dashed');
    const size = Math.min(ptToUnit(8, unit), box.h * 0.4);
    if (!label || size <= 0) return;
    const clipId = createClip(state, group, box.x, box.y, box.w, box.h, 0);
    const text = svgElement('text', {
      x: fmt(box.x + box.w / 2), y: fmt(box.y + box.h / 2 + size * 0.35), 'text-anchor': 'middle', 'font-size': fmt(size),
      'font-family': 'sans-serif', fill: PLACEHOLDER_TEXT, 'clip-path': 'url(#' + clipId + ')',
    }, group);
    text.textContent = label;
  }

  function sourceLabel(state, source) {
    if (source && source.field) {
      const field = state.resolver.field(source.field);
      return field ? field.label : source.field;
    }
    return source && source.asset ? source.asset : '';
  }

  function buildText(state, item, g) {
    const e = item.e;
    const unit = state.doc.unit;
    const layout = layoutText({
      text: item.text, fontFamily: e.fontFamily, fontSize: e.fontSize, fontWeight: e.fontWeight, italic: e.italic,
      letterSpacing: e.letterSpacing, lineHeight: e.lineHeight, wrap: e.wrap, fit: e.fit, minFontSize: e.minFontSize,
      width: e.w, height: e.h, unit,
    });
    const anchorX = e.align === 'center' ? e.x + e.w / 2 : (e.align === 'right' ? e.x + e.w : e.x);
    let top = e.y;
    if (e.h > 0) {
      if (e.valign === 'middle') top = e.y + (e.h - layout.height) / 2;
      else if (e.valign === 'bottom') top = e.y + e.h - layout.height;
    }
    const text = svgElement('text', {
      fill: e.color,
      'font-family': cssFamily(e.fontFamily),
      'font-size': fmt(layout.fontSize),
      'font-weight': e.fontWeight,
      'font-style': e.italic ? 'italic' : null,
      'letter-spacing': e.letterSpacing ? fmt(e.letterSpacing) + 'em' : null,
      'text-anchor': e.align === 'center' ? 'middle' : (e.align === 'right' ? 'end' : 'start'),
    }, g);
    text.setAttributeNS(XML_NS, 'xml:space', 'preserve');
    layout.lines.forEach((line, i) => {
      if (line.text === '') return;
      const tspan = svgElement('tspan', { x: fmt(anchorX), y: fmt(top + i * layout.lineHeight + layout.baselineOffset) }, text);
      tspan.textContent = line.text;
    });
  }

  function buildImage(state, item, g) {
    const e = item.e;
    const box = { x: e.x, y: e.y, w: e.w, h: e.h };
    if (!item.url) {
      if (state.mode === 'editor') drawPlaceholder(state, g, box, sourceLabel(state, e.source));
      return;
    }
    const info = state.infos.get(item.url);
    drawImage(state, g, box, item.url, e.fit, e.radius, info ? info.ratio : 1);
  }

  function buildStrip(state, item, g) {
    const e = item.e;
    const filled = [];
    const empty = [];
    item.slots.forEach(slot => {
      if (slot.url) {
        const info = state.infos.get(slot.url);
        filled.push({ url: slot.url, ratio: info && info.ratio > 0 ? info.ratio : 1 });
      } else if (slot.source) {
        empty.push(slot.source);
      }
    });
    if (!(e.h > 0)) return;
    const natural = filled.reduce((sum, f) => sum + e.h * f.ratio, 0) + e.gap * Math.max(0, filled.length - 1);
    // Wider than the box: everything (images, gaps, height) shrinks by the same factor, centred vertically.
    const scale = e.w > 0 && natural > e.w ? e.w / natural : 1;
    const height = e.h * scale;
    const gap = e.gap * scale;
    const total = natural * scale;
    let x = e.align === 'center' ? e.x + (e.w - total) / 2 : (e.align === 'right' ? e.x + e.w - total : e.x);
    const y = e.y + (e.h - height) / 2;
    for (const f of filled) {
      const width = height * f.ratio;
      drawImage(state, g, { x, y, w: width, h: height }, f.url, 'contain', 0, f.ratio);
      x += width + gap;
    }
    if (state.mode !== 'editor') return;
    // Editor: empty slots follow the filled pictures as dashed squares (positions of the real pictures stay as in the output).
    for (const source of empty) {
      if (e.w > 0 && x + height > e.x + e.w + 0.001) break;
      drawPlaceholder(state, g, { x, y, w: height, h: height }, sourceLabel(state, source));
      x += height + gap;
    }
  }

  function buildShape(state, item, g) {
    const e = item.e;
    const strokeWidth = ptToUnit(e.strokeWidth, state.doc.unit);
    let node;
    if (e.shape === 'line') {
      node = svgElement('line', { x1: fmt(e.x), y1: fmt(e.y), x2: fmt(e.x + e.w), y2: fmt(e.y + e.h), fill: 'none' }, g);
    } else if (e.shape === 'ellipse') {
      node = svgElement('ellipse', { cx: fmt(e.x + e.w / 2), cy: fmt(e.y + e.h / 2), rx: fmt(e.w / 2), ry: fmt(e.h / 2) }, g);
      node.setAttribute('fill', e.fill || 'none');
    } else {
      const r = Math.min(e.radius, e.w / 2, e.h / 2);
      node = svgElement('rect', { x: fmt(e.x), y: fmt(e.y), width: fmt(e.w), height: fmt(e.h), rx: r > 0 ? fmt(r) : null }, g);
      node.setAttribute('fill', e.fill || 'none');
    }
    applyStroke(node, e.stroke, strokeWidth, e.dash);
  }

  function buildBackground(state, svg) {
    const doc = state.doc;
    svgElement('rect', { x: 0, y: 0, width: fmt(doc.width), height: fmt(doc.height), fill: doc.background.color, 'data-dt-background': '1' }, svg);
    if (!state.backgroundUrl) return;
    const info = state.infos.get(state.backgroundUrl);
    const g = svgElement('g', { 'data-dt-background': '1' }, svg);
    // cover is sliced and clipped to the page by drawImage; contain/fill stay inside the page anyway.
    drawImage(state, g, { x: 0, y: 0, w: doc.width, h: doc.height }, state.backgroundUrl, doc.background.fit, 0, info ? info.ratio : 1);
  }

  /**
   * Internal: resolves the document against the values, loads fonts and image sizes, builds the SVG.
   * @returns {Promise<{svg:SVGSVGElement, doc:object, images:Array<{el:Element,url:string}>, faces:Array<object>}>}
   */
  async function build(input, values, options) {
    const opts = options || {};
    const doc = normalize(input);
    const mode = opts.mode === 'editor' ? 'editor' : 'output';
    const missing = opts.missing === 'token' ? 'token' : 'empty';
    const prefix = opts.idPrefix ? sanitizeId(opts.idPrefix) + '-' : 'dt' + (++renderCounter) + '-';
    const valueMap = values === null || values === undefined ? buildValueMap(sampleValues(doc)) : buildValueMap(values);
    const resolver = makeResolver(doc.fields, valueMap, doc.locale, missing);
    const assetUrl = key => {
      if (typeof opts.assetUrl !== 'function') return null;
      try { const url = opts.assetUrl(String(key)); return typeof url === 'string' && url !== '' ? url : null; } catch (e) { return null; }
    };
    /** Image source → URL: asset key directly, field → the field's value is an asset key. Values are never URLs. */
    const sourceUrl = source => {
      if (!source) return null;
      if (source.asset) return assetUrl(source.asset);
      if (source.field) {
        const value = resolver.value(source.field).trim();
        return value === '' ? null : assetUrl(value);
      }
      return null;
    };

    // 1. Plan: which elements are drawn, their resolved texts and image URLs, which faces and images are needed.
    const items = [];
    const faces = [];
    const imageUrls = new Set();
    for (const e of doc.elements) {
      if (e.hidden) continue;
      if (e.showIf && resolver.value(e.showIf).trim() === '') continue;
      const item = { e };
      if (e.type === 'text') {
        const resolved = e.text.replace(TOKEN_PATTERN, (all, key) => resolver.text(key));
        item.text = e.uppercase ? upperCase(resolved, doc.locale) : resolved;
        if (item.text.trim() !== '') faces.push({ family: e.fontFamily, weight: e.fontWeight, italic: e.italic, text: item.text });
      } else if (e.type === 'image') {
        item.url = sourceUrl(e.source);
        if (item.url) imageUrls.add(item.url);
      } else if (e.type === 'imageStrip') {
        item.slots = e.items.map(source => ({ source, url: sourceUrl(source) }));
        for (const slot of item.slots) if (slot.url) imageUrls.add(slot.url);
      }
      items.push(item);
    }
    const backgroundUrl = doc.background.asset ? assetUrl(doc.background.asset) : null;
    if (backgroundUrl) imageUrls.add(backgroundUrl);

    // 2. Load fonts and image sizes.
    const infos = new Map();
    await Promise.all([
      ensureFonts(faces, opts.fonts),
      ...Array.from(imageUrls, url => loadImageInfo(url).then(info => infos.set(url, info))),
    ]);

    // 3. Build the DOM.
    const svg = svgElement('svg', {
      viewBox: '0 0 ' + fmt(doc.width) + ' ' + fmt(doc.height),
      width: fmt(doc.width) + doc.unit,
      height: fmt(doc.height) + doc.unit,
      'data-dt-engine': '1',
    });
    const state = { doc, mode, prefix, clipCounter: 0, resolver, infos, backgroundUrl, images: [] };
    buildBackground(state, svg);
    for (const item of items) {
      const g = elementGroup(item.e, svg);
      if (item.e.type === 'text') buildText(state, item, g);
      else if (item.e.type === 'image') buildImage(state, item, g);
      else if (item.e.type === 'imageStrip') buildStrip(state, item, g);
      else buildShape(state, item, g);
    }
    return { svg, doc, images: state.images, faces };
  }

  /**
   * Renders a document with values into a new SVG element (not attached to the page). Loads fonts and image sizes first.
   * `viewBox` is `0 0 width height` in document units; `width`/`height` carry the physical size (`150mm`, `800px`) –
   * editor callers override them for zoom. Each element is `<g data-el-id="…">` (both modes).
   * @param {object} doc the design document (normalised internally; never mutated)
   * @param {object|Map|null} values values by field key (case-insensitive); null = the fields' sample values
   * @param {object} [opts]
   * @param {(key:string)=>string|null} [opts.assetUrl] asset key → URL (null/unknown: nothing is drawn)
   * @param {Array<{family:string,weight:(number|string),style:string,url:string}>} [opts.fonts] faces to register and embed
   * @param {'editor'|'output'} [opts.mode] editor draws dashed placeholders for empty image fields (default output)
   * @param {'empty'|'token'} [opts.missing] missing values render empty (default) or as `{{Key}}`
   * @param {string} [opts.idPrefix] prefix of generated ids (clip paths); default a per-render counter
   * @returns {Promise<SVGSVGElement>}
   */
  async function render(doc, values, opts) {
    return (await build(doc, values, opts)).svg;
  }

  const renderTokens = new WeakMap();

  /**
   * Renders and puts the SVG into `container` (replacing its children). When several calls overlap on one container,
   * only the newest result is inserted (the older ones still resolve with their SVG).
   * @param {Element} container
   * @param {object} doc @param {object|Map|null} values @param {object} [opts] see render
   * @returns {Promise<SVGSVGElement>}
   */
  async function renderInto(container, doc, values, opts) {
    const token = (renderTokens.get(container) || 0) + 1;
    renderTokens.set(container, token);
    const svg = await render(doc, values, opts);
    if (renderTokens.get(container) === token) {
      if (typeof container.replaceChildren === 'function') {
        container.replaceChildren(svg);
      } else {
        while (container.firstChild) container.removeChild(container.firstChild);
        container.appendChild(svg);
      }
    }
    return svg;
  }

  // ------------------------------------------------------------------------------------------------------------
  // Standalone SVG and PNG
  // ------------------------------------------------------------------------------------------------------------

  /** @font-face sources from the page's style sheets (when the caller passes no `opts.fonts`). */
  function stylesheetFaces() {
    const faces = [];
    const visit = (rules, baseHref, depth) => {
      if (!rules || depth > 4) return;
      for (const rule of Array.from(rules)) {
        try {
          if (rule.type === 5 && rule.style) { // CSSFontFaceRule
            const match = /url\(\s*(["']?)(.*?)\1\s*\)/.exec(rule.style.getPropertyValue('src'));
            const family = rule.style.getPropertyValue('font-family');
            if (!match || !family) continue;
            const range = parseWeightRange(rule.style.getPropertyValue('font-weight') || '400');
            faces.push({
              family: cleanFamily(family),
              min: range[0],
              max: range[1],
              style: /italic|oblique/i.test(rule.style.getPropertyValue('font-style')) ? 'italic' : 'normal',
              url: new URL(match[2], baseHref || document.baseURI).href,
            });
          } else if (rule.type === 3 && rule.styleSheet) { // @import
            visit(rule.styleSheet.cssRules, rule.styleSheet.href || baseHref, depth + 1);
          } else if (rule.cssRules) { // @media, @supports, @layer
            visit(rule.cssRules, baseHref, depth + 1);
          }
        } catch (e) { /* unreadable rule */ }
      }
    };
    for (const sheet of Array.from(document.styleSheets)) {
      try { visit(sheet.cssRules, sheet.href, 0); } catch (e) { /* cross-origin sheet */ }
    }
    return faces;
  }

  /** `@font-face` CSS (data URIs) for every face the document uses and whose file can be found and read. */
  async function embeddedFontCss(used, fontList) {
    const faces = normalizeFaceList(fontList);
    const fallback = faces.length ? [] : stylesheetFaces();
    const picked = new Map();
    for (const u of used) {
      const face = pickFace(faces, u.family, u.weight, u.italic) || pickFace(fallback, u.family, u.weight, u.italic);
      if (face) picked.set(face.family.toLowerCase() + '|' + weightDescriptor(face) + '|' + face.style + '|' + face.url, face);
    }
    const rules = await Promise.all(Array.from(picked.values(), async face => {
      const uri = await toDataUri(face.url, 'font');
      if (!uri) return '';
      return '@font-face{font-family:\'' + face.family + '\';font-weight:' + weightDescriptor(face) + ';font-style:' + face.style +
        ';src:url("' + uri + '")}';
    }));
    return rules.filter(Boolean).join('\n');
  }

  /**
   * Internal: build + embed. `size` (CSS px) replaces width/height for rasterising.
   * @returns {Promise<string>} serialised SVG with an XML declaration
   */
  async function buildStandalone(doc, values, opts, size) {
    const built = await build(doc, values, opts);
    const svg = built.svg;
    const urls = Array.from(new Set(built.images.map(i => i.url)));
    const uris = new Map();
    await Promise.all(urls.map(async url => uris.set(url, await toDataUri(url, 'image'))));
    for (const image of built.images) {
      const uri = uris.get(image.url);
      if (!uri) { // unreadable image: leave nothing that points outside the file
        if (image.el.parentNode) image.el.parentNode.removeChild(image.el);
        continue;
      }
      image.el.removeAttribute('href');
      image.el.setAttributeNS(XLINK_NS, 'xlink:href', uri);
    }
    const css = await embeddedFontCss(built.faces, opts && opts.fonts);
    if (css) {
      const defs = document.createElementNS(SVG_NS, 'defs');
      const style = document.createElementNS(SVG_NS, 'style');
      style.textContent = css;
      defs.appendChild(style);
      svg.insertBefore(defs, svg.firstChild);
    }
    if (size) {
      svg.setAttribute('width', String(size.width));
      svg.setAttribute('height', String(size.height));
    }
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg);
  }

  /**
   * Renders to a self-contained SVG file text: every used font face as `@font-face` with a base64 data URI (the one
   * generated <style> element) and every image as a data URI – no external reference. Fonts are found through
   * `opts.fonts`, or else the page's @font-face rules; a font without a findable file stays a (system) font reference.
   * @param {object} doc @param {object|Map|null} values @param {object} [opts] see render
   * @returns {Promise<string>} SVG text (UTF-8, with XML declaration)
   */
  async function toStandaloneSvg(doc, values, opts) {
    return buildStandalone(doc, values, opts || {}, null);
  }

  function loadSvgImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('The SVG could not be decoded'));
      img.src = src;
    });
  }

  /** Inserts a pHYs chunk (pixels per metre) behind IHDR so printers know the physical size. */
  async function pngWithDpi(blob, dpi) {
    const bytes = new Uint8Array(await blobToArrayBuffer(blob));
    if (bytes.length < 33 || !startsWith(bytes, 0x89, 0x50, 0x4e, 0x47) || bytes[12] !== 0x49 || bytes[13] !== 0x48) return blob;
    const chunk = new Uint8Array(21);
    const view = new DataView(chunk.buffer);
    const perMetre = Math.round(dpi / 0.0254);
    view.setUint32(0, 9);
    chunk.set([0x70, 0x48, 0x59, 0x73], 4); // 'pHYs'
    view.setUint32(8, perMetre);
    view.setUint32(12, perMetre);
    chunk[16] = 1; // unit: metre
    view.setUint32(17, crc32(chunk.subarray(4, 17)));
    return new Blob([bytes.subarray(0, 33), chunk, bytes.subarray(33)], { type: 'image/png' });
  }

  /**
   * Rasterises to PNG at `opts.dpi` (default `doc.dpi`): 150 × 100 mm at 300 dpi = 1772 × 1181 px. `opts.scale`
   * multiplies the size, `opts.maxWidth` (px) limits it (thumbnails). The PNG carries its dpi (pHYs).
   * @param {object} doc @param {object|Map|null} values
   * @param {object} [opts] see render, plus `dpi`, `scale`, `maxWidth`
   * @returns {Promise<Blob>} image/png
   */
  async function rasterize(doc, values, opts) {
    const options = opts || {};
    const normalized = normalize(doc);
    const dpi = num(options.dpi, normalized.dpi, 72, 1200);
    let scale = num(options.scale, 1, 0.01, 100);
    let width = unitToInch(normalized.width, normalized.unit) * dpi * scale;
    let height = unitToInch(normalized.height, normalized.unit) * dpi * scale;
    const maxWidth = num(options.maxWidth, 0, 0);
    if (maxWidth > 0 && width > maxWidth) { scale = maxWidth / width; height *= scale; width = maxWidth; }
    const pixelWidth = Math.max(1, Math.round(width));
    const pixelHeight = Math.max(1, Math.round(height));
    if (pixelWidth > 16384 || pixelHeight > 16384 || pixelWidth * pixelHeight > 120e6) {
      throw new Error('The raster image would be too large (' + pixelWidth + ' × ' + pixelHeight + ' px)');
    }
    const svgText = await buildStandalone(normalized, values, options, { width: pixelWidth, height: pixelHeight });

    // Blob URL first (large documents), data URI as fallback for browsers that refuse blob SVGs.
    let img;
    const blobUrl = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      img = await loadSvgImage(blobUrl);
    } catch (e) {
      img = await loadSvgImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText));
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
    if (typeof img.decode === 'function') { try { await img.decode(); } catch (e) { /* Safari: decode() of SVG may reject although it loaded */ } }

    const canvas = document.createElement('canvas');
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, pixelWidth, pixelHeight);
    const png = await new Promise((resolve, reject) => {
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('The PNG could not be created'))), 'image/png');
    });
    const effectiveDpi = pixelWidth / unitToInch(normalized.width, normalized.unit);
    return pngWithDpi(png, effectiveDpi);
  }

  // ------------------------------------------------------------------------------------------------------------
  // ZIP (store only)
  // ------------------------------------------------------------------------------------------------------------

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();

  /** CRC-32 (IEEE) of a byte array. */
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  async function toBytes(data) {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (typeof data === 'string') return new TextEncoder().encode(data);
    if (data && typeof data.size === 'number') return new Uint8Array(await blobToArrayBuffer(data));
    throw new Error('zip: unsupported file content');
  }

  function zipName(name, used) {
    let clean = String(name || 'file').replace(/\\/g, '/').split('/')
      .filter(part => part !== '' && part !== '.' && part !== '..').join('/')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f]/g, '_');
    if (clean === '') clean = 'file';
    let candidate = clean;
    let counter = 1;
    const dot = clean.lastIndexOf('.');
    const stem = dot > clean.lastIndexOf('/') + 1 ? clean.slice(0, dot) : clean;
    const extension = stem === clean ? '' : clean.slice(dot);
    while (used.has(candidate.toLowerCase())) candidate = stem + ' (' + (++counter) + ')' + extension;
    used.add(candidate.toLowerCase());
    return candidate;
  }

  /**
   * Packs files into a ZIP (method 0 = stored, CRC-32, UTF-8 file names via general purpose flag bit 11). No ZIP64:
   * at most 65535 files and 4 GiB per file/archive. Duplicate names get " (2)", unsafe path parts are removed.
   * @param {Array<{name:string, blob:(Blob|Uint8Array|ArrayBuffer|string)}>} files
   * @returns {Promise<Blob>} application/zip
   */
  async function zip(files) {
    const list = Array.isArray(files) ? files : [];
    if (list.length > 65535) throw new Error('zip: too many files');
    const encoder = new TextEncoder();
    const used = new Set();
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((Math.max(1980, now.getFullYear()) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const parts = [];
    const central = [];
    let offset = 0;
    for (const file of list) {
      const data = await toBytes(file.blob !== undefined ? file.blob : file.data);
      const name = encoder.encode(zipName(file.name, used));
      if (data.length >= 0xffffffff || offset >= 0xffffffff) throw new Error('zip: archive too large');
      const crc = crc32(data);
      const local = new Uint8Array(30);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true);
      lv.setUint16(8, 0, true);
      lv.setUint16(10, dosTime, true);
      lv.setUint16(12, dosDate, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, name.length, true);
      lv.setUint16(28, 0, true);
      parts.push(local, name, data);
      const entry = new Uint8Array(46);
      const cv = new DataView(entry.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, dosTime, true);
      cv.setUint16(14, dosDate, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, name.length, true);
      cv.setUint32(42, offset, true);
      central.push(entry, name);
      offset += local.length + name.length + data.length;
    }
    const centralSize = central.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, list.length, true);
    ev.setUint16(10, list.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end], { type: 'application/zip' });
  }

  // ------------------------------------------------------------------------------------------------------------

  global.DtEngine = Object.freeze({
    version: 1,
    SCHEMA,
    normalize,
    fieldsUsed,
    sampleValues,
    formatValue,
    resolveText,
    render,
    renderInto,
    toStandaloneSvg,
    rasterize,
    zip,
    layoutText,
    ptToUnit,
    unitToPx,
    unitToInch,
  });
})(typeof window !== 'undefined' ? window : globalThis);
