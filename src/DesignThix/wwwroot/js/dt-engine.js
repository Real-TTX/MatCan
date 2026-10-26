/*!
 * DesignThix render engine (phase D, extended in K1 to document schema 2: docs/PLAN-CANVA.md section 2).
 *
 * Turns a design document plus a set of field values into an SVG element, a standalone SVG string (fonts and images
 * embedded), a PNG/JPEG blob, and packs many files into a store-only ZIP. The browser is the only renderer: the designer,
 * previews, thumbnails, print and export all go through this file.
 *
 * Plain JavaScript, no dependencies, no build step. Everything is built with DOM APIs (createElementNS, setAttribute,
 * textContent); document data never reaches HTML parsing, style attributes or URLs (assets resolve only through
 * opts.assetUrl, icon bodies only through opts.icon and a strict element/attribute allowlist). The one generated <style>
 * element lives inside the exported SVG string (@font-face data URIs).
 *
 * DOCUMENT (schema 2; schema 1 is upgraded by normalize()):
 *   { schema: 2, unit: 'mm'|'px', width, height, dpi, locale, fold?: 'vertical'|'horizontal' (a folded card, written only when set), fields: [...],
 *     pages: [ { id, name, background: { color: '#rrggbb'|null, gradient: Gradient|null, asset: key|null, fit }, elements: [...] } ] }
 *   Upgrade 1 -> 2: pages = [{ id: 'p1', name: '', background: doc.background, elements: doc.elements }]. normalize() never mutates, is
 *   idempotent, clamps and defaults every property, drops unknown ones. The result also carries the NON-ENUMERABLE legacy aliases
 *   `elements` and `background` (page 0) so old callers keep working; they are not part of the JSON.
 *   Gradient: { type: 'linear', angle: 0..360 (CSS: 0 = to top, 90 = to right, 180 = to bottom), stops: [{ offset 0..1, color }] (2..5) }.
 *   A Fill is '#rrggbb', a Gradient or null. Common element properties: id, type, name, x, y, w, h, rotation, opacity, locked,
 *   hidden, showIf, flipX, flipY, shadow { color, opacity, blur, x, y } | null.
 *   Element types: text (+ underline, strike, list none|bullet|number, outline {color,width pt}, background {color,radius,padding},
 *   curve -100..100), image (+ crop {x,y,w,h} fractions of the natural image, mask none|rounded|circle|heart|star|hexagon|triangle,
 *   border {color,width pt}, filters {brightness,contrast,saturation -100..100, blur 0..20, grayscale, sepia}; no source = frame),
 *   imageStrip (+ mask, border), shape (rect|ellipse|line|triangle|diamond|pentagon|hexagon|star|heart|arrow|speech, points,
 *   innerRadius, fill = Fill, startCap/endCap), icon (Lucide name or prefix:name of a catalogue icon, color, strokeWidth), qr (value, color, background, ecc, quiet),
 *   barcode (format ean13|ean8|code128, value, color, background, showText, fontFamily), group (children in PAGE coordinates;
 *   rotation, flip, opacity and shadow apply to the whole group around the centre of its box; nesting depth <= 3).
 *   Limits: 50 pages, 500 elements per page and 2000 in total (group children count), 100 fields.
 *
 * Public API: window.DtEngine = { normalize, pageCount, fieldsUsed, assetKeysUsed, iconNamesUsed, iconSource, sampleValues, formatValue, resolveText,
 *   render, renderInto, toStandaloneSvg, rasterize, zip, layoutText, qrEncode, barcodeInfo, ptToUnit, unitToPx, unitToInch,
 *   SCHEMA, version }.
 *
 * Options of render / renderInto / toStandaloneSvg / rasterize (`opts`):
 *   page            0-based page index (default 0, clamped).
 *   assetUrl(key)   asset key -> URL or null (null/unknown: nothing is drawn, a warning is reported).
 *   fonts           [{ family, weight, style, url }] faces to register and embed.
 *   icon(name)      icon name (Lucide `star`, or `prefix:name` of a catalogue) -> SVG body string (the inner markup of the 24 x 24 icon) or { body, width, height } (any grid) or a Promise of it; parsed with an allowlist. DtEngine.iconSource() makes one.
 *   mode            'editor' | 'output' (default output): the editor draws dashed placeholders (empty image frame "Bild hierher
 *                   ziehen", unknown icon, invalid code with its reason); output draws nothing for them.
 *   missing         'empty' | 'token' (missing values render empty (default) or as {{Key}}).
 *   idPrefix        prefix of generated ids (gradients, filters, clip paths, masks); default a per-render counter.
 *   onWarning(msg, elementId)  called for unknown placeholders, missing assets, unknown icons, invalid codes (German text).
 *   background      false = skip the page background (colour, gradient, picture): transparent PNG.
 *   rasterize only: dpi, scale, maxWidth (px), format 'png' | 'jpeg', quality 0..1 (jpeg; default 0.92). JPEG is filled white.
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
    version: 2,
    units: Object.freeze(['mm', 'px']),
    folds: Object.freeze(['none', 'vertical', 'horizontal']),
    fieldTypes: Object.freeze(['text', 'multiline', 'number', 'price', 'image']),
    elementTypes: Object.freeze(['text', 'image', 'imageStrip', 'shape', 'icon', 'qr', 'barcode', 'group']),
    limits: Object.freeze({
      pages: 50, elements: 500, totalElements: 2000, fields: 100, stripItems: 12, textLength: 5000, sampleLength: 2000,
      groupDepth: 3, gradientStops: 5, qrLength: 1000, barcodeLength: 80,
    }),
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

  const SHAPE_KINDS = ['rect', 'ellipse', 'line', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'heart', 'arrow', 'speech'];
  const MASK_KINDS = ['none', 'rounded', 'circle', 'heart', 'star', 'hexagon', 'triangle'];
  const CAP_KINDS = ['none', 'arrow', 'circle', 'square'];
  const ICON_NAME_PATTERN = /^(?:[a-z0-9-]{1,64}:)?[a-z0-9-]{1,64}$/;
  const FULL_CROP = Object.freeze({ x: 0, y: 0, w: 1, h: 1 });

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

  /** Linear gradient with 2..5 valid stops (invalid stops are skipped), or null. */
  function normalizeGradient(raw) {
    if (!isObject(raw)) return null;
    const stops = [];
    for (const s of Array.isArray(raw.stops) ? raw.stops : []) {
      if (stops.length >= SCHEMA.limits.gradientStops) break;
      if (!isObject(s)) continue;
      const c = colour(s.color, null);
      if (c) stops.push({ offset: num(s.offset, 0, 0, 1), color: c });
    }
    if (stops.length < 2) return null;
    return { type: 'linear', angle: num(raw.angle, 0, 0, 360), stops };
  }

  /** A Fill: hex colour, gradient or null (an explicit null stays null; anything unusable gives `fallback`). */
  function normalizeFill(value, fallback) {
    if (value === null) return null;
    if (isObject(value)) return normalizeGradient(value) || fallback;
    return colour(value, fallback, true);
  }

  function normalizeShadow(raw, unit) {
    if (!isObject(raw)) return null;
    return {
      color: colour(raw.color, '#000000'),
      opacity: num(raw.opacity, 0.5, 0, 1),
      blur: num(raw.blur, 0, 0, unit === 'px' ? 200 : 50),
      x: num(raw.x, 0, -1000, 1000),
      y: num(raw.y, 0, -1000, 1000),
    };
  }

  function normalizeCrop(raw) {
    if (!isObject(raw)) return { x: 0, y: 0, w: 1, h: 1 };
    const x = num(raw.x, 0, 0, 0.999);
    const y = num(raw.y, 0, 0, 0.999);
    return { x, y, w: Math.min(num(raw.w, 1, 0.001, 1), 1 - x), h: Math.min(num(raw.h, 1, 0.001, 1), 1 - y) };
  }

  function normalizeBorder(raw) {
    if (!isObject(raw)) return null;
    return { color: colour(raw.color, '#000000'), width: num(raw.width, 1, 0, 100) };
  }

  function normalizeFilters(raw) {
    const f = isObject(raw) ? raw : {};
    return {
      brightness: num(f.brightness, 0, -100, 100),
      contrast: num(f.contrast, 0, -100, 100),
      saturation: num(f.saturation, 0, -100, 100),
      blur: num(f.blur, 0, 0, 20),
      grayscale: f.grayscale === true,
      sepia: f.sepia === true,
    };
  }

  /** ctx: { usedIds:Set, unit, page:number (elements on this page), total:number }. depth: 1 = page level. */
  function normalizeElement(raw, ctx, depth, index) {
    if (!isObject(raw)) return null;
    const type = oneOf(raw.type, SCHEMA.elementTypes, null);
    if (!type) return null;
    if (type === 'group' && depth > SCHEMA.limits.groupDepth) return null;
    if (ctx.page >= SCHEMA.limits.elements || ctx.total >= SCHEMA.limits.totalElements) return null;
    ctx.page++;
    ctx.total++;
    let id = typeof raw.id === 'string' && raw.id !== '' ? raw.id.slice(0, 24) : '';
    if (!id || ctx.usedIds.has(id)) {
      let n = index + 1;
      while (ctx.usedIds.has('e' + n)) n++;
      id = 'e' + n;
    }
    ctx.usedIds.add(id);
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
      flipX: raw.flipX === true,
      flipY: raw.flipY === true,
      shadow: normalizeShadow(raw.shadow, ctx.unit),
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
        underline: raw.underline === true,
        strike: raw.strike === true,
        list: oneOf(raw.list, ['none', 'bullet', 'number'], 'none'),
        outline: isObject(raw.outline) ? { color: colour(raw.outline.color, '#000000'), width: num(raw.outline.width, 1, 0, 100) } : null,
        background: isObject(raw.background) ? {
          color: colour(raw.background.color, '#ffffff'),
          radius: num(raw.background.radius, 0, 0, 1e6),
          padding: num(raw.background.padding, 0, 0, 1e6),
        } : null,
        curve: num(raw.curve, 0, -100, 100),
      });
    } else if (type === 'image') {
      Object.assign(e, {
        source: normalizeSource(raw.source),
        fit: oneOf(raw.fit, ['contain', 'cover', 'fill'], 'contain'),
        radius: num(raw.radius, 0, 0, 1e6),
        crop: normalizeCrop(raw.crop),
        mask: oneOf(raw.mask, MASK_KINDS, 'none'),
        border: normalizeBorder(raw.border),
        filters: normalizeFilters(raw.filters),
      });
    } else if (type === 'imageStrip') {
      const items = Array.isArray(raw.items) ? raw.items.slice(0, SCHEMA.limits.stripItems).map(normalizeSource) : [];
      Object.assign(e, {
        items,
        gap: num(raw.gap, 0, 0, 1e6),
        align: oneOf(raw.align, ['left', 'center', 'right'], 'left'),
        mask: oneOf(raw.mask, MASK_KINDS, 'none'),
        border: normalizeBorder(raw.border),
      });
    } else if (type === 'shape') {
      const shape = oneOf(raw.shape, SHAPE_KINDS, 'rect');
      Object.assign(e, {
        shape,
        points: Math.round(num(raw.points, 5, 5, 12)),
        innerRadius: num(raw.innerRadius, 0.5, 0.2, 0.9),
        fill: normalizeFill(raw.fill, null),
        stroke: colour(raw.stroke, shape === 'line' ? '#000000' : null, true),
        strokeWidth: num(raw.strokeWidth, 1, 0, 1000),
        dash: oneOf(raw.dash, ['solid', 'dashed', 'dotted'], 'solid'),
        radius: num(raw.radius, 0, 0, 1e6),
        startCap: oneOf(raw.startCap, CAP_KINDS, 'none'),
        endCap: oneOf(raw.endCap, CAP_KINDS, 'none'),
      });
    } else if (type === 'icon') {
      Object.assign(e, {
        icon: typeof raw.icon === 'string' && ICON_NAME_PATTERN.test(raw.icon) ? raw.icon : '',
        color: colour(raw.color, '#000000'),
        strokeWidth: num(raw.strokeWidth, 2, 0.5, 4),
      });
    } else if (type === 'qr') {
      Object.assign(e, {
        value: str(raw.value, '', SCHEMA.limits.qrLength),
        color: colour(raw.color, '#000000'),
        background: colour(raw.background, '#ffffff', true),
        ecc: oneOf(raw.ecc, ['L', 'M', 'Q', 'H'], 'M'),
        quiet: raw.quiet !== false,
      });
    } else if (type === 'barcode') {
      Object.assign(e, {
        format: oneOf(raw.format, ['ean13', 'ean8', 'code128'], 'ean13'),
        value: str(raw.value, '', SCHEMA.limits.barcodeLength),
        color: colour(raw.color, '#000000'),
        background: colour(raw.background, '#ffffff', true),
        showText: raw.showText !== false,
        fontFamily: str(raw.fontFamily, 'sans-serif', 100) || 'sans-serif',
      });
    } else {
      e.children = normalizeElementList(raw.children, ctx, depth + 1);
    }
    return e;
  }

  function normalizeElementList(rawList, ctx, depth) {
    const out = [];
    const list = Array.isArray(rawList) ? rawList : [];
    for (let i = 0; i < list.length; i++) {
      const e = normalizeElement(list[i], ctx, depth, i);
      if (e) out.push(e);
    }
    return out;
  }

  function normalizeBackground(raw) {
    const b = isObject(raw) ? raw : {};
    return {
      color: colour(b.color, '#ffffff', true),
      gradient: normalizeGradient(b.gradient),
      asset: typeof b.asset === 'string' && b.asset.trim() !== '' ? b.asset.trim().slice(0, 200) : null,
      fit: oneOf(b.fit, ['cover', 'contain', 'fill'], 'cover'),
    };
  }

  /**
   * Returns a new, fully defaulted and clamped copy of a design document (schema 2). A schema-1 document (`elements` +
   * `background` at the top) is upgraded to one page. Unknown properties are dropped, invalid colours/numbers replaced by
   * defaults, unknown element types removed, groups normalised recursively (depth <= 3). Idempotent; never throws; never mutates.
   * The result has the non-enumerable legacy aliases `elements` / `background` (page 0).
   * @param {object} input the (possibly incomplete or hostile) document
   * @returns {object} normalized document
   */
  function normalize(input) {
    const src = isObject(input) ? input : {};
    const unit = src.unit === 'px' ? 'px' : 'mm';
    const defaultSize = unit === 'px' ? 800 : 100;
    const fields = [];
    const seenKeys = new Set();
    for (const raw of Array.isArray(src.fields) ? src.fields : []) {
      const f = normalizeField(raw);
      if (!f || seenKeys.has(f.key.toLowerCase())) continue;
      seenKeys.add(f.key.toLowerCase());
      fields.push(f);
      if (fields.length >= SCHEMA.limits.fields) break;
    }
    const rawPages = Array.isArray(src.pages)
      ? src.pages
      : [{ id: 'p1', name: '', background: src.background, elements: src.elements }];
    const ctx = { usedIds: new Set(), unit, page: 0, total: 0 };
    const pageIds = new Set();
    const pages = [];
    rawPages.slice(0, SCHEMA.limits.pages).forEach((rawPage, i) => {
      const p = isObject(rawPage) ? rawPage : {};
      let id = typeof p.id === 'string' && p.id !== '' ? p.id.slice(0, 24) : '';
      if (!id || pageIds.has(id)) {
        let n = i + 1;
        while (pageIds.has('p' + n)) n++;
        id = 'p' + n;
      }
      pageIds.add(id);
      ctx.page = 0;
      pages.push({
        id,
        name: str(p.name, '', 80),
        background: normalizeBackground(p.background),
        elements: normalizeElementList(p.elements, ctx, 1),
      });
    });
    if (!pages.length) pages.push({ id: 'p1', name: '', background: normalizeBackground(null), elements: [] });
    const doc = {
      schema: 2,
      unit,
      width: num(src.width, defaultSize, 0.1, 100000),
      height: num(src.height, defaultSize, 0.1, 100000),
      dpi: Math.round(num(src.dpi, 300, 72, 1200)),
      locale: validLocale(src.locale),
    };
    // a folded card (fold line in the middle of every page); 'none' is the default and not written, so older documents stay as they are
    const fold = oneOf(src.fold, SCHEMA.folds, 'none');
    if (fold !== 'none') doc.fold = fold;
    doc.fields = fields;
    doc.pages = pages;
    Object.defineProperty(doc, 'elements', { get() { return pages[0].elements; }, set(v) { pages[0].elements = v; }, enumerable: false, configurable: true });
    Object.defineProperty(doc, 'background', { get() { return pages[0].background; }, set(v) { pages[0].background = v; }, enumerable: false, configurable: true });
    return doc;
  }

  /**
   * Number of pages of a document (1..50).
   * @param {object} input document (schema 1 or 2)
   * @returns {number}
   */
  function pageCount(input) { return normalize(input).pages.length; }

  /** Calls `visit(element)` for every element of the list, groups first, then their children (depth first, bottom first). */
  function walkElements(list, visit) {
    for (const e of list) {
      visit(e);
      if (e.type === 'group') walkElements(e.children, visit);
    }
  }

  /**
   * Lists the field keys a document uses (placeholders in texts, QR/barcode values, image sources, strip items, showIf) on all
   * pages and in all groups, with where.
   * @param {object} input document
   * @returns {Array<{key:string, defined:boolean, field:object|null, uses:Array<{elementId:string, elementName:string, kind:'text'|'image'|'strip'|'showIf'|'qr'|'barcode'}>}>}
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
    for (const page of doc.pages) {
      walkElements(page.elements, e => {
        if (e.showIf) add(e.showIf, e, 'showIf');
        if (e.type === 'text') {
          for (const m of e.text.matchAll(TOKEN_PATTERN)) add(m[1], e, 'text');
        } else if (e.type === 'qr' || e.type === 'barcode') {
          for (const m of e.value.matchAll(TOKEN_PATTERN)) add(m[1], e, e.type);
        } else if (e.type === 'image') {
          if (e.source && e.source.field) add(e.source.field, e, 'image');
        } else if (e.type === 'imageStrip') {
          for (const item of e.items) if (item && item.field) add(item.field, e, 'strip');
        }
      });
    }
    return Array.from(entries.values());
  }

  /**
   * The asset keys a document names directly (image sources, strip items, page background pictures) on all pages and in all
   * groups; unique case-insensitively, in order of first use, spelled as first written. Keys that arrive through field values
   * are not included (they depend on the data).
   * @param {object} input document
   * @returns {string[]}
   */
  function assetKeysUsed(input) {
    const doc = normalize(input);
    const seen = new Set();
    const keys = [];
    const add = key => {
      if (typeof key !== 'string' || key === '' || seen.has(key.toLowerCase())) return;
      seen.add(key.toLowerCase());
      keys.push(key);
    };
    for (const page of doc.pages) {
      add(page.background.asset);
      walkElements(page.elements, e => {
        if (e.type === 'image' && e.source) add(e.source.asset);
        else if (e.type === 'imageStrip') for (const item of e.items) if (item) add(item.asset);
      });
    }
    return keys;
  }

/**
   * The icons a document names that come from a catalogue (`prefix:name`), unique, in order of first use. Lucide icons (no prefix) are not
   * listed: they are in lib/icons.json.
   * @param {object} input document
   * @returns {string[]}
   */
  function iconNamesUsed(input) {
    const doc = normalize(input);
    const seen = new Set();
    for (const page of doc.pages) {
      walkElements(page.elements, e => { if (e.type === 'icon' && e.icon && e.icon.indexOf(':') > 0) seen.add(e.icon); });
    }
    return Array.from(seen);
  }

  let lucideLibrary = null;

  /**
   * A function for `opts.icon`: Lucide icons come from lib/icons.json (loaded once), icons of a catalogue (`prefix:name`) from `config.extra`
   * (`{ 'mdi:home': { body, width, height } }`, what a payload carries) and, with `config.remote`, from `GET /api/icons?names=` (a signed-in
   * page; names asked for within a few milliseconds go in one request). A name nobody knows gives null (the engine reports it).
   * @param {{extra?:object, remote?:boolean}} [config]
   * @returns {(name:string)=>(object|string|null|Promise<object|string|null>)}
   */
  function iconSource(config) {
    const cfg = config || {};
    const extra = cfg.extra || {};
    const known = new Map();
    let batch = null;
    const shape = v => (v && typeof v.body === 'string' ? { body: v.body, width: v.width, height: v.height } : null);
    const lucide = () => {
      if (!lucideLibrary) {
        lucideLibrary = fetch('/lib/icons.json', { credentials: 'same-origin' })
          .then(r => (r.ok ? r.json() : { icons: {} })).then(j => (j && j.icons ? j.icons : {})).catch(() => ({}));
      }
      return lucideLibrary;
    };
    const ask = name => {
      if (!batch) {
        const entry = { names: new Map() };
        batch = entry;
        setTimeout(() => {
          batch = null;
          const names = Array.from(entry.names.keys());
          fetch('/api/icons?names=' + encodeURIComponent(names.join(',')), { credentials: 'same-origin', headers: { Accept: 'application/json' } })
            .then(r => (r.ok ? r.json() : {})).catch(() => ({}))
            .then(found => { for (const [n, resolve] of entry.names) resolve(shape(found && found[n])); });
        }, 15);
      }
      return new Promise(resolve => {
        const resolvers = batch.names;
        if (resolvers.size >= 50) { resolve(null); return; }
        resolvers.set(name, resolve);
      });
    };
    return name => {
      if (typeof name !== 'string' || name === '') return null;
      if (name.indexOf(':') < 0) return lucide().then(icons => (icons[name] ? icons[name].b : null));
      if (extra[name]) return shape(extra[name]);
      if (!cfg.remote || !ICON_NAME_PATTERN.test(name)) return null;
      if (!known.has(name)) known.set(name, ask(name));
      return known.get(name);
    };
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
   * @param {'mm'|'px'} [spec.unit] @param {number} [spec.indent] hanging indent of every line in em (lists; reduces the wrap width)
   * @returns {{fontSizePt:number, fontSize:number, lineHeight:number, ascent:number, descent:number, baselineOffset:number, indent:number,
   *   lines:Array<{text:string,width:number,first:boolean}>, width:number, height:number, shrunk:boolean, fits:boolean}}
   *   sizes in document units: `baselineOffset` = baseline distance from the top of a line box, `width` = widest line (without the
   *   indent), `indent` = the indent in units, `first` = the line starts a paragraph,
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
    const indentEm = num(s.indent, 0, 0, 10);
    const measure = text => measurer.width(text) + spacing * Math.max(0, countCodePoints(text) - 1);

    // Line height box: content area (ascent + descent) centred in lineHeight × size, like CSS half-leading.
    const baselineEm = (lineHeightFactor - (measurer.ascent + measurer.descent)) / 2 + measurer.ascent;

    function layoutAt(pt) {
      const size = ptToUnit(pt, unit);
      const available = wrap && boxWidth > 0 ? Math.max(0.01, boxWidth / size - indentEm) : Infinity;
      const texts = [];
      const starts = new Set();
      for (const paragraph of paragraphs) {
        starts.add(texts.length);
        wrapParagraph(paragraph, available, measure, texts);
      }
      const lines = texts.map((text, i) => ({ text, width: measure(text) * size, first: starts.has(i) }));
      const width = lines.reduce((max, l) => Math.max(max, l.width), 0);
      return { pt, size, lines, width, height: lines.length * lineHeightFactor * size, indent: indentEm * size };
    }
    function fits(layout) {
      if (boxWidth > 0 && layout.width + layout.indent > boxWidth + 0.001) return false;
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
      indent: chosen.indent,
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
  // Shape geometry (shapes, image masks, frames)
  // ------------------------------------------------------------------------------------------------------------

  const HEART_PATH = ['M', 0.5, 1, 'C', 0.1, 0.72, 0, 0.5, 0, 0.3, 'C', 0, 0.12, 0.13, 0, 0.28, 0, 'C', 0.38, 0, 0.46, 0.05, 0.5, 0.15,
    'C', 0.54, 0.05, 0.62, 0, 0.72, 0, 'C', 0.87, 0, 1, 0.12, 1, 0.3, 'C', 1, 0.5, 0.9, 0.72, 0.5, 1, 'Z'];

  function polarPoints(count, startDeg, stepDeg, radiusAt) {
    const points = [];
    for (let k = 0; k < count; k++) {
      const a = (startDeg + k * stepDeg) * Math.PI / 180;
      const r = radiusAt(k);
      points.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return points;
  }

  /** Scales a point list so that its bounding box is exactly the unit square (the shape touches all four box edges). */
  function fitUnit(points) {
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    for (const p of points) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    const w = maxX - minX || 1;
    const h = maxY - minY || 1;
    return points.map(p => [(p[0] - minX) / w, (p[1] - minY) / h]);
  }

  /** Polygon vertices of a shape in unit-square coordinates (null when the shape is not a plain polygon). */
  function unitPolygon(kind, points, innerRadius) {
    switch (kind) {
      case 'triangle': return [[0.5, 0], [1, 1], [0, 1]];
      case 'diamond': return [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]];
      case 'pentagon': return fitUnit(polarPoints(5, -90, 72, () => 1));
      case 'hexagon': return fitUnit(polarPoints(6, 0, 60, () => 1));
      case 'star': {
        const n = Math.max(5, Math.min(12, Math.round(points || 5)));
        return fitUnit(polarPoints(n * 2, -90, 180 / n, k => (k % 2 === 0 ? 1 : innerRadius || 0.5)));
      }
      default: return null;
    }
  }

  function pointsPath(points, box) {
    return 'M' + points.map(p => fmt(box.x + p[0] * box.w) + ' ' + fmt(box.y + p[1] * box.h)).join('L') + 'Z';
  }

  /** The `d` of a non-rect, non-ellipse outline exactly inside `box`. */
  function outlinePath(kind, box, o) {
    const { x, y, w, h } = box;
    const polygon = unitPolygon(kind, o && o.points, o && o.innerRadius);
    if (polygon) return pointsPath(polygon, box);
    if (kind === 'heart') {
      const parts = [];
      for (let i = 0; i < HEART_PATH.length;) {
        const token = HEART_PATH[i];
        if (typeof token === 'string') { parts.push(token); i++; continue; }
        parts.push(fmt(x + HEART_PATH[i] * w) + ' ' + fmt(y + HEART_PATH[i + 1] * h));
        i += 2;
      }
      return parts.join(' ');
    }
    if (kind === 'arrow') {
      const head = Math.min(h * 0.5, w * 0.6);
      const pts = [[0, h * 0.3], [w - head, h * 0.3], [w - head, 0], [w, h / 2], [w - head, h], [w - head, h * 0.7], [0, h * 0.7]];
      return 'M' + pts.map(p => fmt(x + p[0]) + ' ' + fmt(y + p[1])).join('L') + 'Z';
    }
    // speech bubble: rounded body in the upper 80 % of the box, tail at the bottom left
    const bodyH = h * 0.8;
    const r = Math.max(0, Math.min((o && o.radius > 0) ? o.radius : 0.18 * Math.min(w, bodyH), w * 0.2, bodyH / 2));
    return 'M' + fmt(x + r) + ' ' + fmt(y) + 'H' + fmt(x + w - r) + 'A' + fmt(r) + ' ' + fmt(r) + ' 0 0 1 ' + fmt(x + w) + ' ' + fmt(y + r) +
      'V' + fmt(y + bodyH - r) + 'A' + fmt(r) + ' ' + fmt(r) + ' 0 0 1 ' + fmt(x + w - r) + ' ' + fmt(y + bodyH) +
      'H' + fmt(x + w * 0.42) + 'L' + fmt(x + w * 0.14) + ' ' + fmt(y + h) + 'L' + fmt(x + w * 0.22) + ' ' + fmt(y + bodyH) +
      'H' + fmt(x + r) + 'A' + fmt(r) + ' ' + fmt(r) + ' 0 0 1 ' + fmt(x) + ' ' + fmt(y + bodyH - r) +
      'V' + fmt(y + r) + 'A' + fmt(r) + ' ' + fmt(r) + ' 0 0 1 ' + fmt(x + r) + ' ' + fmt(y) + 'Z';
  }

  /** Creates the outline node of a shape / mask kind inside `box` (rect/rounded, ellipse/circle, or a path). */
  function outlineNode(parent, kind, box, o) {
    if (kind === 'rect' || kind === 'rounded' || kind === 'none') {
      const r = Math.min((o && o.radius) || 0, box.w / 2, box.h / 2);
      return svgElement('rect', { x: fmt(box.x), y: fmt(box.y), width: fmt(box.w), height: fmt(box.h), rx: r > 0 ? fmt(r) : null }, parent);
    }
    if (kind === 'ellipse' || kind === 'circle') {
      return svgElement('ellipse', { cx: fmt(box.x + box.w / 2), cy: fmt(box.y + box.h / 2), rx: fmt(box.w / 2), ry: fmt(box.h / 2) }, parent);
    }
    return svgElement('path', { d: outlinePath(kind, box, o) }, parent);
  }

  // ------------------------------------------------------------------------------------------------------------
  // QR code encoder (ISO/IEC 18004: byte mode UTF-8, versions 1-40, ECC L/M/Q/H, all 8 masks with the penalty rules)
  // ------------------------------------------------------------------------------------------------------------

  // Error correction codewords per block and number of blocks, by version (index 0 unused).
  const QR_ECC_PER_BLOCK = {
    L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    Q: [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    H: [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  };
  const QR_BLOCKS = {
    L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    Q: [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    H: [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
  };
  const QR_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

  /** Number of data modules of a version (everything except function patterns). */
  function qrRawModules(version) {
    let result = (16 * version + 128) * version + 64;
    if (version >= 2) {
      const align = Math.floor(version / 7) + 2;
      result -= (25 * align - 10) * align - 55;
      if (version >= 7) result -= 36;
    }
    return result;
  }

  function qrDataCodewords(version, ecc) {
    return Math.floor(qrRawModules(version) / 8) - QR_ECC_PER_BLOCK[ecc][version] * QR_BLOCKS[ecc][version];
  }

  const GF_EXP = new Uint8Array(512);
  const GF_LOG = new Uint8Array(256);
  (() => {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
  })();

  function gfMultiply(a, b) { return a && b ? GF_EXP[GF_LOG[a] + GF_LOG[b]] : 0; }

  const rsGenerators = new Map();
  /** Coefficients (highest degree first, leading 1 included) of the Reed-Solomon generator polynomial of `degree`. */
  function rsGenerator(degree) {
    let g = rsGenerators.get(degree);
    if (g) return g;
    g = [1];
    for (let i = 0; i < degree; i++) {
      const next = new Array(g.length + 1).fill(0);
      for (let j = 0; j < g.length; j++) {
        next[j] ^= g[j];
        next[j + 1] ^= gfMultiply(g[j], GF_EXP[i]);
      }
      g = next;
    }
    rsGenerators.set(degree, g);
    return g;
  }

  /** Reed-Solomon remainder (the error correction codewords) of `data` over GF(256), polynomial 0x11D. */
  function rsRemainder(data, degree) {
    const g = rsGenerator(degree);
    const rem = new Array(degree).fill(0);
    for (const byte of data) {
      const factor = byte ^ rem.shift();
      rem.push(0);
      for (let i = 0; i < degree; i++) rem[i] ^= gfMultiply(g[i + 1], factor);
    }
    return rem;
  }

  function utf8Bytes(text) {
    if (typeof TextEncoder === 'function') return Array.from(new TextEncoder().encode(text));
    const bytes = [];
    const encoded = unescape(encodeURIComponent(text));
    for (let i = 0; i < encoded.length; i++) bytes.push(encoded.charCodeAt(i));
    return bytes;
  }

  function qrAlignmentPositions(version) {
    if (version === 1) return [];
    const count = Math.floor(version / 7) + 2;
    const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
    const positions = [6];
    for (let pos = version * 4 + 10; positions.length < count; pos -= step) positions.splice(1, 0, pos);
    return positions;
  }

  function qrMaskBit(mask, x, y) {
    switch (mask) {
      case 0: return (x + y) % 2 === 0;
      case 1: return y % 2 === 0;
      case 2: return x % 3 === 0;
      case 3: return (x + y) % 3 === 0;
      case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
      case 5: return (x * y) % 2 + (x * y) % 3 === 0;
      case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
      default: return ((x + y) % 2 + (x * y) % 3) % 2 === 0;
    }
  }

  function countOccurrences(text, pattern) {
    let n = 0;
    for (let i = text.indexOf(pattern); i >= 0; i = text.indexOf(pattern, i + 1)) n++;
    return n;
  }

  /**
   * Encodes text as a QR code (byte mode, UTF-8). The smallest version 1..40 that holds the data at the given error correction
   * level is used; the mask with the lowest penalty score wins.
   * @param {string} value the text
   * @param {'L'|'M'|'Q'|'H'} [ecc] error correction level (default M)
   * @returns {{ok:true, version:number, ecc:string, mask:number, size:number, modules:Uint8Array[]}|{ok:false, reason:string}}
   *   `modules[y][x]` is 1 for a dark module
   */
  function qrEncode(value, ecc) {
    const level = oneOf(ecc, ['L', 'M', 'Q', 'H'], 'M');
    const bytes = utf8Bytes(String(value === null || value === undefined ? '' : value));
    if (bytes.length === 0) return { ok: false, reason: 'QR-Code: Inhalt fehlt' };
    let version = 0;
    for (let v = 1; v <= 40; v++) {
      if (4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= qrDataCodewords(v, level) * 8) { version = v; break; }
    }
    if (!version) return { ok: false, reason: 'QR-Code: Inhalt ist zu lang' };
    const size = version * 4 + 17;

    // 1. Data bits: mode 0100, character count, bytes, terminator, padding.
    const bits = [];
    const put = (n, length) => { for (let i = length - 1; i >= 0; i--) bits.push((n >>> i) & 1); };
    put(4, 4);
    put(bytes.length, version < 10 ? 8 : 16);
    for (const b of bytes) put(b, 8);
    const capacityBits = qrDataCodewords(version, level) * 8;
    for (let i = 0; i < 4 && bits.length < capacityBits; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
      data.push(byte);
    }
    for (let pad = 0xec; data.length < capacityBits / 8; pad ^= 0xec ^ 0x11) data.push(pad);

    // 2. Blocks, error correction, interleaving.
    const blockCount = QR_BLOCKS[level][version];
    const eccLength = QR_ECC_PER_BLOCK[level][version];
    const rawCodewords = Math.floor(qrRawModules(version) / 8);
    const shortBlocks = blockCount - rawCodewords % blockCount;
    const shortLength = Math.floor(rawCodewords / blockCount);
    const blocks = [];
    for (let i = 0, k = 0; i < blockCount; i++) {
      const length = shortLength - eccLength + (i < shortBlocks ? 0 : 1);
      const dat = data.slice(k, k + length);
      k += length;
      blocks.push({ dat, ecc: rsRemainder(dat, eccLength) });
    }
    const codewords = [];
    for (let i = 0; i <= shortLength - eccLength; i++) for (const block of blocks) if (i < block.dat.length) codewords.push(block.dat[i]);
    for (let i = 0; i < eccLength; i++) for (const block of blocks) codewords.push(block.ecc[i]);

    // 3. Function patterns.
    const modules = new Uint8Array(size * size);
    const isFunction = new Uint8Array(size * size);
    const set = (x, y, dark) => { modules[y * size + x] = dark ? 1 : 0; isFunction[y * size + x] = 1; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const x = cx + dx; const y = cy + dy;
          if (x < 0 || x >= size || y < 0 || y >= size) continue;
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          set(x, y, dist !== 2 && dist !== 4);
        }
      }
    };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const positions = qrAlignmentPositions(version);
    for (let i = 0; i < positions.length; i++) {
      for (let j = 0; j < positions.length; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === positions.length - 1) || (i === positions.length - 1 && j === 0)) continue;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(positions[i] + dx, positions[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
    const drawFormat = mask => {
      const formatData = (QR_FORMAT_BITS[level] << 3) | mask;
      let rem = formatData;
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const formatBits = ((formatData << 10) | rem) ^ 0x5412;
      const bit = i => ((formatBits >>> i) & 1) !== 0;
      for (let i = 0; i <= 5; i++) set(8, i, bit(i));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
      set(8, size - 8, true);
    };
    drawFormat(0);
    if (version >= 7) {
      let rem = version;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const versionBits = (version << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const dark = ((versionBits >>> i) & 1) !== 0;
        const a = size - 11 + i % 3;
        const b = Math.floor(i / 3);
        set(a, b, dark); set(b, a, dark);
      }
    }

    // 4. Place the codewords in the zigzag order (the remainder bits stay light).
    let bitIndex = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!isFunction[y * size + x] && bitIndex < codewords.length * 8) {
            modules[y * size + x] = (codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1;
            bitIndex++;
          }
        }
      }
    }

    // 5. Masks: the lowest penalty wins.
    const applyMask = mask => {
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!isFunction[y * size + x] && qrMaskBit(mask, x, y)) modules[y * size + x] ^= 1;
    };
    const penalty = () => {
      let result = 0;
      let dark = 0;
      for (let dir = 0; dir < 2; dir++) {
        for (let a = 0; a < size; a++) {
          let runColour = -1;
          let runLength = 0;
          const line = [];
          for (let b = 0; b < size; b++) {
            const c = dir === 0 ? modules[a * size + b] : modules[b * size + a];
            line.push(c);
            if (dir === 0) dark += c;
            if (c === runColour) {
              runLength++;
              if (runLength === 5) result += 3; else if (runLength > 5) result++;
            } else { runColour = c; runLength = 1; }
          }
          const text = '0000' + line.join('') + '0000';
          result += 40 * (countOccurrences(text, '00001011101') + countOccurrences(text, '10111010000'));
        }
      }
      for (let y = 0; y < size - 1; y++) {
        for (let x = 0; x < size - 1; x++) {
          const c = modules[y * size + x];
          if (c === modules[y * size + x + 1] && c === modules[(y + 1) * size + x] && c === modules[(y + 1) * size + x + 1]) result += 3;
        }
      }
      const total = size * size;
      result += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
      return result;
    };
    let bestMask = 0;
    let bestPenalty = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      applyMask(mask);
      drawFormat(mask);
      const score = penalty();
      if (score < bestPenalty) { bestPenalty = score; bestMask = mask; }
      applyMask(mask);
    }
    applyMask(bestMask);
    drawFormat(bestMask);

    const rows = [];
    for (let y = 0; y < size; y++) rows.push(modules.slice(y * size, (y + 1) * size));
    return { ok: true, version, ecc: level, mask: bestMask, size, modules: rows };
  }

  /** One `d` string of module squares: horizontal runs merged, module coordinates (1 unit = 1 module). */
  function qrPathData(rows, offset) {
    const parts = [];
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length;) {
        if (!row[x]) { x++; continue; }
        let end = x;
        while (end < row.length && row[end]) end++;
        parts.push('M' + (x + offset) + ' ' + (y + offset) + 'h' + (end - x) + 'v1h-' + (end - x) + 'z');
        x = end;
      }
    }
    return parts.join('');
  }

  // ------------------------------------------------------------------------------------------------------------
  // Barcodes: EAN-13, EAN-8, Code 128
  // ------------------------------------------------------------------------------------------------------------

  const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
  const EAN_R = EAN_L.map(p => p.replace(/[01]/g, c => (c === '0' ? '1' : '0')));
  const EAN_G = EAN_R.map(p => p.split('').reverse().join(''));
  const EAN_PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

  // Code 128 symbol patterns (bar/space widths, 11 modules each), values 0..106, and the stop pattern (13 modules).
  const CODE128_PATTERNS = ('212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 ' +
    '123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 ' +
    '131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 ' +
    '311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 ' +
    '142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 ' +
    '111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232').split(' ');
  const CODE128_STOP = '2331112';

  function eanCheckDigit(payload) {
    let sum = 0;
    for (let i = 0; i < payload.length; i++) sum += Number(payload[payload.length - 1 - i]) * (i % 2 === 0 ? 3 : 1);
    return (10 - sum % 10) % 10;
  }

  function patternBits(pattern, firstIsBar) {
    const out = [];
    let bar = firstIsBar;
    for (const ch of pattern) {
      for (let i = 0; i < Number(ch); i++) out.push(bar ? 1 : 0);
      bar = !bar;
    }
    return out;
  }

  /**
   * Validates and encodes a barcode value.
   * @param {'ean13'|'ean8'|'code128'} format
   * @param {string} value EAN: 12/7 digits (check digit is added) or 13/8 digits (check digit is verified); Code 128: printable ASCII
   * @returns {{ok:true, format:string, text:string, bars:number[], guards:Array<[number,number]>, values?:number[], checksum?:number}|{ok:false, reason:string}}
   *   `text` = the digits with the check digit (EAN) or the value; `bars` = module sequence (1 = bar) without quiet zones;
   *   `guards` = module ranges of the guard bars (EAN); Code 128: `values` = start symbol + data symbols, `checksum`
   */
  function barcodeInfo(format, value) {
    const text = value === null || value === undefined ? '' : String(value);
    if (format === 'ean13' || format === 'ean8') {
      const n = format === 'ean13' ? 13 : 8;
      const label = format === 'ean13' ? 'EAN-13' : 'EAN-8';
      const digits = text.replace(/\s+/g, '');
      if (!/^\d+$/.test(digits) || (digits.length !== n && digits.length !== n - 1)) return { ok: false, reason: label + ' braucht ' + (n - 1) + ' oder ' + n + ' Ziffern' };
      const check = eanCheckDigit(digits.slice(0, n - 1));
      if (digits.length === n && Number(digits[n - 1]) !== check) return { ok: false, reason: label + ': Prüfziffer stimmt nicht (richtig wäre ' + check + ')' };
      const full = digits.slice(0, n - 1) + check;
      const half = n === 13 ? 6 : 4;
      const bits = [1, 0, 1];
      const guards = [[0, 3]];
      const parity = n === 13 ? EAN_PARITY[Number(full[0])] : 'L'.repeat(half);
      const leftDigits = n === 13 ? full.slice(1, 1 + half) : full.slice(0, half);
      for (let i = 0; i < half; i++) {
        const pattern = (parity[i] === 'G' ? EAN_G : EAN_L)[Number(leftDigits[i])];
        for (const c of pattern) bits.push(Number(c));
      }
      guards.push([bits.length, bits.length + 5]);
      for (const c of '01010') bits.push(Number(c));
      for (const d of full.slice(n - half)) for (const c of EAN_R[Number(d)]) bits.push(Number(c));
      guards.push([bits.length, bits.length + 3]);
      bits.push(1, 0, 1);
      return { ok: true, format, text: full, bars: bits, guards };
    }
    // Code 128: code set B, code set C for runs of four or more digits.
    if (text === '') return { ok: false, reason: 'Code 128: kein Wert' };
    if (!/^[\x20-\x7e]+$/.test(text)) return { ok: false, reason: 'Code 128: nur druckbare ASCII-Zeichen' };
    const values = [];
    let set = null;
    let i = 0;
    const isDigit = at => text.charCodeAt(at) >= 48 && text.charCodeAt(at) <= 57;
    while (i < text.length) {
      let run = 0;
      while (i + run < text.length && isDigit(i + run)) run++;
      if (run >= 4) {
        if (run % 2 === 1) {
          if (set === null) { values.push(104); set = 'B'; }
          values.push(text.charCodeAt(i) - 32);
          i++;
          run--;
        }
        values.push(set === null ? 105 : 99);
        set = 'C';
        for (let k = 0; k < run; k += 2) values.push(Number(text.slice(i + k, i + k + 2)));
        i += run;
        continue;
      }
      if (set === null) values.push(104);
      else if (set === 'C') values.push(100);
      set = 'B';
      values.push(text.charCodeAt(i) - 32);
      i++;
    }
    let sum = values[0];
    for (let k = 1; k < values.length; k++) sum += k * values[k];
    const checksum = sum % 103;
    const bars = [];
    for (const v of values.concat([checksum])) for (const bit of patternBits(CODE128_PATTERNS[v], true)) bars.push(bit);
    for (const bit of patternBits(CODE128_STOP, true)) bars.push(bit);
    return { ok: true, format, text, bars, guards: [], values, checksum };
  }

  // ------------------------------------------------------------------------------------------------------------
  // Icons: Lucide bodies are parsed with a strict allowlist and re-created element by element (never inserted as parsed)
  // ------------------------------------------------------------------------------------------------------------

  const ICON_TAGS = {
    path: ['d'], circle: ['cx', 'cy', 'r'], rect: ['x', 'y', 'width', 'height', 'rx', 'ry'], line: ['x1', 'y1', 'x2', 'y2'],
    polyline: ['points'], polygon: ['points'], ellipse: ['cx', 'cy', 'rx', 'ry'],
  };
  const ICON_REQUIRED = { path: ['d'], circle: ['r'], rect: ['width', 'height'], line: ['x1', 'y1', 'x2', 'y2'], polyline: ['points'], polygon: ['points'], ellipse: ['rx', 'ry'] };
  const ICON_NUMBER = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
  const ICON_PATH = /^[0-9eE+\-.,\sMmLlHhVvCcSsQqTtAaZz]*$/;
  const ICON_POINTS = /^[0-9eE+\-.,\s]*$/;
  const iconCache = new Map();

  // Presentation attributes of the icons of catalogues (Iconify): a paint is only currentColor or none (the colour of the element), the rest small numbers and keywords. Lucide bodies have none of them.
  const ICON_PAINT_ATTRIBUTES = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'fill-rule', 'opacity', 'fill-opacity', 'stroke-opacity'];
  const ICON_ATTRIBUTES = new Set(['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'x1', 'y1', 'x2', 'y2', 'points'].concat(ICON_PAINT_ATTRIBUTES));

  /**
   * Text-level pass before parsing: every start tag keeps only the allowed geometry attributes. The allowlist below stays the
   * security boundary; this pass only keeps event handler and style attributes of a hostile body from ever reaching a parsed
   * document (the browser would report them as Content-Security-Policy violations).
   */
  function stripIconAttributes(body) {
    return body.replace(/<([A-Za-z][\w:.-]*)((?:\s+[^\s=<>"'/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*(\/?)>/g, (all, tag, attributes, close) => {
      const kept = [];
      for (const m of attributes.matchAll(/\s+([^\s=<>"'/]+)(?:\s*=\s*("[^"]*"|'[^']*'))?/g)) {
        if (ICON_ATTRIBUTES.has(m[1]) && m[2] !== undefined) kept.push(m[1] + '=' + m[2]);
      }
      return '<' + tag + (kept.length ? ' ' + kept.join(' ') : '') + (close ? '/' : '') + '>';
    });
  }

  function validIconAttribute(name, value) {
    if (name === 'd') return value.length <= 20000 && ICON_PATH.test(value);
    if (name === 'points') return value.length <= 20000 && ICON_POINTS.test(value);
    if (name === 'fill' || name === 'stroke') return value === 'currentColor' || value === 'none';
    if (name === 'stroke-linecap') return value === 'butt' || value === 'round' || value === 'square';
    if (name === 'stroke-linejoin') return value === 'miter' || value === 'round' || value === 'bevel';
    if (name === 'fill-rule') return value === 'nonzero' || value === 'evenodd';
    if (name === 'opacity' || name === 'fill-opacity' || name === 'stroke-opacity') return ICON_NUMBER.test(value.trim()) && Number(value) >= 0 && Number(value) <= 1;
    if (name === 'stroke-width') return ICON_NUMBER.test(value.trim()) && Number(value) >= 0 && Number(value) <= 64;
    if (name === 'stroke-miterlimit') return ICON_NUMBER.test(value.trim()) && Number(value) >= 1 && Number(value) <= 100;
    return ICON_NUMBER.test(value.trim()) && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= 1000000;
  }

  /**
   * Parses an icon body (the inner markup of a 24 x 24 Lucide icon) into a list of plain `{ tag, attrs }` records. Only path,
   * circle, rect, line, polyline, polygon and ellipse with their geometry attributes survive; everything else (script,
   * foreignObject, g, use, href, on*, style, ...) is dropped silently. Returns null for a body that is not well-formed.
   */
  function parseIconBody(body) {
    if (typeof body !== 'string' || body.length > 60000) return null;
    if (iconCache.has(body)) return iconCache.get(body);
    let result = null;
    try {
      const parsed = new DOMParser().parseFromString('<svg xmlns="' + SVG_NS + '">' + stripIconAttributes(body) + '</svg>', 'image/svg+xml');
      const root = parsed.documentElement;
      if (root && root.localName === 'svg' && root.namespaceURI === SVG_NS && parsed.getElementsByTagName('parsererror').length === 0) {
        result = [];
        for (const child of Array.from(root.children)) {
          if (result.length >= 64) break;
          const allowed = child.namespaceURI === SVG_NS ? ICON_TAGS[child.localName] : null;
          if (!allowed) continue;
          const attrs = {};
          for (const name of allowed.concat(ICON_PAINT_ATTRIBUTES)) {
            const value = child.getAttribute(name);
            if (value !== null && validIconAttribute(name, value)) attrs[name] = value.trim();
          }
          if (ICON_REQUIRED[child.localName].every(name => attrs[name] !== undefined)) result.push({ tag: child.localName, attrs });
        }
      }
    } catch (e) { result = null; }
    iconCache.set(body, result);
    if (iconCache.size > 400) iconCache.delete(iconCache.keys().next().value);
    return result;
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

  /** Number with up to 6 decimals (scales of tiny icons). */
  function fmt6(n) {
    if (!Number.isFinite(n)) return '0';
    const rounded = Math.round(n * 1e6) / 1e6;
    return Object.is(rounded, -0) ? '0' : String(rounded);
  }

  /** transform of an element or group: flip (mirror around the centre of the box), then rotation around the centre. */
  function elementTransform(e) {
    const cx = e.x + e.w / 2;
    const cy = e.y + e.h / 2;
    const parts = [];
    if (e.rotation) parts.push('rotate(' + fmt(e.rotation) + ' ' + fmt(cx) + ' ' + fmt(cy) + ')');
    if (e.flipX || e.flipY) {
      parts.push('translate(' + fmt(cx) + ' ' + fmt(cy) + ') scale(' + (e.flipX ? -1 : 1) + ' ' + (e.flipY ? -1 : 1) + ') translate(' + fmt(-cx) + ' ' + fmt(-cy) + ')');
    }
    return parts.length ? parts.join(' ') : null;
  }

  function sanitizeId(value) { return String(value).replace(/[^A-Za-z0-9_-]/g, '_'); }

  /** A new id that is unique on the page: render prefix + kind letter + counter. */
  function nextId(state, kind) { return state.prefix + kind + (++state.counter); }

  /** Drop shadow filter (feDropShadow) for an element or group; the region is in user space so zero-size boxes (lines) work. */
  function createShadow(state, parent, e) {
    const s = e.shadow;
    const id = nextId(state, 'f');
    const margin = 3 * s.blur + Math.max(Math.abs(s.x), Math.abs(s.y)) + 0.25 * Math.max(e.w, e.h) + ptToUnit(8, state.doc.unit);
    const filter = svgElement('filter', {
      id, filterUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB',
      x: fmt(e.x - margin), y: fmt(e.y - margin), width: fmt(e.w + 2 * margin), height: fmt(e.h + 2 * margin),
    }, parent);
    svgElement('feDropShadow', { dx: fmt(s.x), dy: fmt(s.y), stdDeviation: fmt(s.blur / 2), 'flood-color': s.color, 'flood-opacity': fmt(s.opacity) }, filter);
    return id;
  }

  /** The `<g>` of an element: id, type, flip + rotation around the centre, opacity, shadow. */
  function elementGroup(state, e, parent) {
    const g = svgElement('g', { 'data-el-id': e.id, 'data-el-type': e.type }, parent);
    const transform = elementTransform(e);
    if (transform) g.setAttribute('transform', transform);
    if (e.opacity < 1) g.setAttribute('opacity', fmt(e.opacity));
    if (e.shadow) g.setAttribute('filter', 'url(#' + createShadow(state, g, e) + ')');
    return g;
  }

  /** Linear gradient along the CSS angle (0 = to top, 90 = to right) across `box`; returns its id. */
  function createGradient(state, parent, gradient, box) {
    const id = nextId(state, 'g');
    const angle = gradient.angle * Math.PI / 180;
    const dx = Math.sin(angle);
    const dy = -Math.cos(angle);
    const length = Math.abs(box.w * dx) + Math.abs(box.h * dy);
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const node = svgElement('linearGradient', {
      id, gradientUnits: 'userSpaceOnUse',
      x1: fmt(cx - dx * length / 2), y1: fmt(cy - dy * length / 2), x2: fmt(cx + dx * length / 2), y2: fmt(cy + dy * length / 2),
    }, parent);
    for (const stop of gradient.stops) svgElement('stop', { offset: fmt(stop.offset), 'stop-color': stop.color }, node);
    return id;
  }

  /** Sets `fill` from a Fill (hex, gradient or null). */
  function applyFill(state, node, parent, fill, box) {
    if (!fill) node.setAttribute('fill', 'none');
    else if (typeof fill === 'string') node.setAttribute('fill', fill);
    else node.setAttribute('fill', 'url(#' + createGradient(state, parent, fill, box) + ')');
  }

  /** Dash pattern: dashed = 3w,2w, dotted = 0,2w with round caps (w = stroke width in units). */
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

  /** clipPath with the outline of a mask kind inside `box` (rect with radius, ellipse, heart, star ...); returns its id. */
  function createClip(state, parent, kind, box, radius) {
    const id = nextId(state, 'c');
    const clip = svgElement('clipPath', { id }, parent);
    outlineNode(clip, kind, box, { radius: radius || 0, points: 5, innerRadius: 0.5 });
    return id;
  }

  /** Image filter chain (brightness + contrast, saturation, grayscale, sepia, blur) or null when nothing is set. */
  function createImageFilter(state, parent, f, box) {
    const brightness = 1 + f.brightness / 100;
    const contrast = 1 + f.contrast / 100;
    const sigma = f.blur * Math.min(box.w, box.h) / 200;
    if (f.brightness === 0 && f.contrast === 0 && f.saturation === 0 && !f.grayscale && !f.sepia && !(sigma > 0)) return null;
    const margin = 3 * sigma + 1;
    const id = nextId(state, 'f');
    const filter = svgElement('filter', {
      id, filterUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB',
      x: fmt(box.x - margin), y: fmt(box.y - margin), width: fmt(box.w + 2 * margin), height: fmt(box.h + 2 * margin),
    }, parent);
    if (f.brightness !== 0 || f.contrast !== 0) {
      const transfer = svgElement('feComponentTransfer', null, filter);
      for (const channel of ['feFuncR', 'feFuncG', 'feFuncB']) {
        svgElement(channel, { type: 'linear', slope: fmt(brightness * contrast), intercept: fmt(0.5 - 0.5 * contrast) }, transfer);
      }
    }
    if (f.saturation !== 0) svgElement('feColorMatrix', { type: 'saturate', values: fmt(1 + f.saturation / 100) }, filter);
    if (f.grayscale) svgElement('feColorMatrix', { type: 'saturate', values: '0' }, filter);
    if (f.sepia) svgElement('feColorMatrix', { type: 'matrix', values: '0.393 0.769 0.189 0 0 0.349 0.686 0.168 0 0 0.272 0.534 0.131 0 0 0 0 0 1 0' }, filter);
    if (sigma > 0) svgElement('feGaussianBlur', { stdDeviation: fmt(sigma) }, filter);
    return id;
  }

  function maskKind(mask, radius) { return mask === 'none' || !mask ? (radius > 0 ? 'rounded' : 'none') : mask; }

  /**
   * Draws one picture. Without a crop: cover = slice + clip, contain = meet, fill = none. With a crop (fractions of the natural
   * image) the visible part is placed into the box with `fit` and the whole image is positioned and clipped accordingly.
   * `mask` clips to a shape (inside the picture rectangle for contain), `border` strokes that outline, `filters` as an SVG filter.
   * @returns {Element|null} the `<image>`
   */
  function drawPicture(state, parent, box, url, o) {
    if (!(box.w > 0) || !(box.h > 0)) return null;
    const kind = o.mask || 'none';
    const radius = o.radius || 0;
    const ratio = o.ratio > 0 ? o.ratio : 1;
    const crop = o.crop || FULL_CROP;
    const cropped = crop.x > 0 || crop.y > 0 || crop.w < 1 || crop.h < 1;
    let imageBox = box;
    let preserve;
    let clipBox = null;
    if (!cropped) {
      preserve = o.fit === 'fill' ? 'none' : (o.fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet');
      if (o.fit === 'cover' || kind !== 'none') {
        clipBox = box;
        if (o.fit === 'contain') {
          // Mask the picture itself, not the whole box.
          const w = Math.min(box.w, box.h * ratio);
          const h = w / ratio;
          clipBox = { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
        }
      }
    } else {
      preserve = 'none';
      const regionRatio = ratio * crop.w / crop.h;
      let w = box.w;
      let h = box.h;
      if (o.fit !== 'fill') {
        const boxIsWider = box.w / box.h > regionRatio;
        if (boxIsWider === (o.fit === 'contain')) { h = box.h; w = h * regionRatio; } else { w = box.w; h = w / regionRatio; }
      }
      const dest = { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
      const fullW = w / crop.w;
      const fullH = h / crop.h;
      imageBox = { x: dest.x - crop.x * fullW, y: dest.y - crop.y * fullH, w: fullW, h: fullH };
      const left = Math.max(dest.x, box.x);
      const top = Math.max(dest.y, box.y);
      clipBox = { x: left, y: top, w: Math.min(dest.x + dest.w, box.x + box.w) - left, h: Math.min(dest.y + dest.h, box.y + box.h) - top };
    }
    const image = svgElement('image', {
      x: fmt(imageBox.x), y: fmt(imageBox.y), width: fmt(imageBox.w), height: fmt(imageBox.h), href: url, preserveAspectRatio: preserve,
    }, parent);
    if (o.filters) {
      const filterId = createImageFilter(state, parent, o.filters, clipBox || box);
      if (filterId) image.setAttribute('filter', 'url(#' + filterId + ')');
    }
    if (clipBox) image.setAttribute('clip-path', 'url(#' + createClip(state, parent, kind, clipBox, radius) + ')');
    state.images.push({ el: image, url });
    if (o.border && o.border.width > 0) {
      const outline = outlineNode(parent, kind, clipBox || box, { radius, points: 5, innerRadius: 0.5 });
      outline.setAttribute('fill', 'none');
      applyStroke(outline, o.border.color, ptToUnit(o.border.width, state.doc.unit), 'solid');
      if (kind !== 'none' && kind !== 'rounded' && kind !== 'circle') outline.setAttribute('stroke-linejoin', 'round');
    }
    return image;
  }

  /** Editor-only dashed outline (rectangle, or the shape of the mask) with a small label where content would be. */
  function drawPlaceholder(state, parent, box, label, kind, radius) {
    if (!(box.w > 0) || !(box.h > 0)) return;
    const unit = state.doc.unit;
    const strokeWidth = ptToUnit(0.75, unit);
    const group = svgElement('g', { 'data-dt-placeholder': '1' }, parent);
    const outline = outlineNode(group, kind || 'rect', box, { radius: radius || 0, points: 5, innerRadius: 0.5 });
    outline.setAttribute('fill', PLACEHOLDER_FILL);
    outline.setAttribute('fill-opacity', '0.7');
    applyStroke(outline, PLACEHOLDER_STROKE, strokeWidth, 'dashed');
    const size = Math.min(ptToUnit(8, unit), box.h * 0.4);
    if (!label || size <= 0) return;
    const clipId = createClip(state, group, 'rect', box, 0);
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

  const FRAME_LABEL = 'Bild hierher ziehen';

  function boxOf(e) { return { x: e.x, y: e.y, w: e.w, h: e.h }; }

  /** Text on one circular arc (curve ≠ 0): one line, centred on the box; positive = arc above the text, negative = below. */
  function buildCurvedText(state, item, g) {
    const e = item.e;
    const unit = state.doc.unit;
    const single = item.text.replace(/\s*[\r\n]+\s*/g, ' ');
    const layout = layoutText({
      text: single, fontFamily: e.fontFamily, fontSize: e.fontSize, fontWeight: e.fontWeight, italic: e.italic,
      letterSpacing: e.letterSpacing, lineHeight: e.lineHeight, wrap: false, fit: e.fit, minFontSize: e.minFontSize,
      width: e.w, height: e.h, unit,
    });
    const length = layout.lines.length ? layout.lines[0].width : 0;
    if (!(length > 0)) return;
    const phi = Math.max(Math.abs(e.curve), 0.1) * 3.6 * Math.PI / 180; // 100 = full circle
    const radius = length / phi;
    const sagitta = radius * (1 - Math.cos(phi / 2));
    const blockHeight = layout.height + sagitta;
    let blockTop = e.y;
    if (e.h > 0) {
      if (e.valign === 'middle') blockTop = e.y + (e.h - blockHeight) / 2;
      else if (e.valign === 'bottom') blockTop = e.y + e.h - blockHeight;
    }
    const above = e.curve > 0;
    const cx = e.x + e.w / 2;
    const cy = above ? blockTop + layout.baselineOffset + radius : blockTop + layout.baselineOffset + sagitta - radius;
    const sign = above ? -1 : 1; // the apex of the circle is above (-) or below (+) its centre
    const at = a => fmt(cx + radius * Math.sin(a)) + ' ' + fmt(cy + sign * radius * Math.cos(a));
    const sweep = above ? 1 : 0;
    const arc = 'A' + fmt(radius) + ' ' + fmt(radius) + ' 0 0 ' + sweep + ' ';
    const defs = svgElement('defs', null, g);
    const pathId = nextId(state, 'p');
    svgElement('path', { id: pathId, d: 'M' + at(-phi / 2) + arc + at(0) + arc + at(phi / 2), fill: 'none' }, defs);
    const text = svgElement('text', {
      fill: e.color, 'font-family': cssFamily(e.fontFamily), 'font-size': fmt(layout.fontSize), 'font-weight': e.fontWeight,
      'font-style': e.italic ? 'italic' : null, 'letter-spacing': e.letterSpacing ? fmt(e.letterSpacing) + 'em' : null, 'text-anchor': 'middle',
    }, g);
    text.setAttributeNS(XML_NS, 'xml:space', 'preserve');
    applyOutline(state, text, e);
    const path = svgElement('textPath', { href: '#' + pathId, startOffset: '50%' }, text);
    path.textContent = layout.lines[0].text;
  }

  function applyOutline(state, textNode, e) {
    if (!e.outline || !(e.outline.width > 0)) return;
    // paint-order: stroke puts the stroke behind the fill, so only the outer half is visible: double the width.
    textNode.setAttribute('stroke', e.outline.color);
    textNode.setAttribute('stroke-width', fmt(2 * ptToUnit(e.outline.width, state.doc.unit)));
    textNode.setAttribute('stroke-linejoin', 'round');
    textNode.setAttribute('paint-order', 'stroke');
  }

  function buildText(state, item, g) {
    const e = item.e;
    if (e.curve !== 0 && item.text.trim() !== '') { buildCurvedText(state, item, g); return; }
    const unit = state.doc.unit;
    const layout = layoutText({
      text: item.text, fontFamily: e.fontFamily, fontSize: e.fontSize, fontWeight: e.fontWeight, italic: e.italic,
      letterSpacing: e.letterSpacing, lineHeight: e.lineHeight, wrap: e.wrap, fit: e.fit, minFontSize: e.minFontSize,
      width: e.w, height: e.h, unit, indent: e.list === 'bullet' ? 1.1 : (e.list === 'number' ? 1.7 : 0),
    });
    const indent = layout.indent;
    const anchorX = e.align === 'center' ? e.x + indent + (e.w - indent) / 2 : (e.align === 'right' ? e.x + e.w : e.x + indent);
    let top = e.y;
    if (e.h > 0) {
      if (e.valign === 'middle') top = e.y + (e.h - layout.height) / 2;
      else if (e.valign === 'bottom') top = e.y + e.h - layout.height;
    }
    const lefts = layout.lines.map(line => (e.align === 'center' ? anchorX - line.width / 2 : (e.align === 'right' ? anchorX - line.width : anchorX)));
    const baselines = layout.lines.map((line, i) => top + i * layout.lineHeight + layout.baselineOffset);
    const filled = layout.lines.map(line => line.text.trim() !== '');
    const hasInk = filled.some(Boolean);
    let blockLeft = Infinity;
    let blockRight = -Infinity;
    layout.lines.forEach((line, i) => {
      if (!filled[i]) return;
      blockLeft = Math.min(blockLeft, lefts[i] - indent);
      blockRight = Math.max(blockRight, lefts[i] + line.width);
    });

    if (e.background && hasInk) {
      const pad = e.background.padding;
      const box = svgElement('rect', {
        x: fmt(blockLeft - pad), y: fmt(top - pad), width: fmt(blockRight - blockLeft + 2 * pad), height: fmt(layout.height + 2 * pad),
        rx: e.background.radius > 0 ? fmt(Math.min(e.background.radius, (blockRight - blockLeft) / 2 + pad, layout.height / 2 + pad)) : null,
        fill: e.background.color, 'data-dt-text-background': '1',
      }, g);
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
    applyOutline(state, text, e);
    layout.lines.forEach((line, i) => {
      if (line.text === '') return;
      const tspan = svgElement('tspan', { x: fmt(anchorX), y: fmt(baselines[i]) }, text);
      tspan.textContent = line.text;
    });

    if (e.list !== 'none' && hasInk) {
      const size = layout.fontSize;
      let counter = 0;
      let markers = null;
      layout.lines.forEach((line, i) => {
        if (!line.first || !filled[i]) return;
        if (e.list === 'bullet') {
          svgElement('circle', { cx: fmt(blockLeft + size * 0.3), cy: fmt(baselines[i] - size * 0.32), r: fmt(size * 0.1), fill: e.color }, g);
          return;
        }
        if (!markers) {
          markers = svgElement('text', {
            fill: e.color, 'font-family': cssFamily(e.fontFamily), 'font-size': fmt(size), 'font-weight': e.fontWeight,
            'font-style': e.italic ? 'italic' : null, 'text-anchor': 'start',
          }, g);
        }
        counter++;
        const tspan = svgElement('tspan', { x: fmt(blockLeft), y: fmt(baselines[i]) }, markers);
        tspan.textContent = counter + '.';
      });
    }

    if ((e.underline || e.strike) && hasInk) {
      const size = layout.fontSize;
      const thickness = Math.max(size * 0.055, ptToUnit(0.3, unit));
      layout.lines.forEach((line, i) => {
        if (!filled[i]) return;
        if (e.underline) svgElement('rect', { x: fmt(lefts[i]), y: fmt(baselines[i] + size * 0.1), width: fmt(line.width), height: fmt(thickness), fill: e.color }, g);
        if (e.strike) svgElement('rect', { x: fmt(lefts[i]), y: fmt(baselines[i] - size * 0.3 - thickness / 2), width: fmt(line.width), height: fmt(thickness), fill: e.color }, g);
      });
    }
  }

  function buildImage(state, item, g) {
    const e = item.e;
    const box = boxOf(e);
    const kind = maskKind(e.mask, e.radius);
    if (!item.url) {
      if (state.mode === 'editor') drawPlaceholder(state, g, box, e.source ? sourceLabel(state, e.source) : FRAME_LABEL, kind, e.radius);
      return;
    }
    const info = state.infos.get(item.url);
    drawPicture(state, g, box, item.url, {
      fit: e.fit, ratio: info ? info.ratio : 1, crop: e.crop, mask: kind, radius: e.radius, border: e.border, filters: e.filters,
    });
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
    const kind = maskKind(e.mask, 0);
    for (const f of filled) {
      const width = height * f.ratio;
      drawPicture(state, g, { x, y, w: width, h: height }, f.url, { fit: 'contain', ratio: f.ratio, mask: kind, radius: 0, border: e.border });
      x += width + gap;
    }
    if (state.mode !== 'editor') return;
    // Editor: empty slots follow the filled pictures as dashed squares (positions of the real pictures stay as in the output).
    for (const source of empty) {
      if (e.w > 0 && x + height > e.x + e.w + 0.001) break;
      drawPlaceholder(state, g, { x, y, w: height, h: height }, sourceLabel(state, source), kind);
      x += height + gap;
    }
  }

  /** A line with optional end caps drawn as filled paths (arrow head, dot, square): the stroke stops where a head begins. */
  function buildLine(state, e, g, strokeWidth) {
    let x1 = e.x;
    let y1 = e.y;
    let x2 = e.x + e.w;
    let y2 = e.y + e.h;
    const length = Math.hypot(x2 - x1, y2 - y1);
    const caps = [];
    if (e.stroke && strokeWidth > 0 && length > 0 && (e.startCap !== 'none' || e.endCap !== 'none')) {
      const ux = (x2 - x1) / length;
      const uy = (y2 - y1) / length;
      const cap = (kind, px, py, dx, dy) => {
        if (kind === 'none') return;
        const nx = -dy;
        const ny = dx;
        if (kind === 'arrow') {
          const head = Math.min(4 * strokeWidth, length * 0.45);
          const half = 2 * strokeWidth;
          const bx = px - dx * head;
          const by = py - dy * head;
          caps.push('M' + fmt(px) + ' ' + fmt(py) + 'L' + fmt(bx + nx * half) + ' ' + fmt(by + ny * half) + 'L' + fmt(bx - nx * half) + ' ' + fmt(by - ny * half) + 'Z');
          return { x: bx, y: by };
        }
        if (kind === 'circle') {
          const r = 1.5 * strokeWidth;
          caps.push('M' + fmt(px - r) + ' ' + fmt(py) + 'A' + fmt(r) + ' ' + fmt(r) + ' 0 1 0 ' + fmt(px + r) + ' ' + fmt(py) + 'A' + fmt(r) + ' ' + fmt(r) + ' 0 1 0 ' + fmt(px - r) + ' ' + fmt(py) + 'Z');
          return null;
        }
        const half = 1.5 * strokeWidth;
        const corner = (a, b) => fmt(px + dx * half * a + nx * half * b) + ' ' + fmt(py + dy * half * a + ny * half * b);
        caps.push('M' + corner(-1, -1) + 'L' + corner(1, -1) + 'L' + corner(1, 1) + 'L' + corner(-1, 1) + 'Z');
        return null;
      };
      const start = cap(e.startCap, x1, y1, -ux, -uy);
      const end = cap(e.endCap, x2, y2, ux, uy);
      if (start) { x1 = start.x; y1 = start.y; }
      if (end) { x2 = end.x; y2 = end.y; }
    }
    const node = svgElement('line', { x1: fmt(x1), y1: fmt(y1), x2: fmt(x2), y2: fmt(y2), fill: 'none' }, g);
    applyStroke(node, e.stroke, strokeWidth, e.dash);
    for (const d of caps) svgElement('path', { d, fill: e.stroke, stroke: 'none' }, g);
  }

  function buildShape(state, item, g) {
    const e = item.e;
    const strokeWidth = ptToUnit(e.strokeWidth, state.doc.unit);
    if (e.shape === 'line') { buildLine(state, e, g, strokeWidth); return; }
    const box = boxOf(e);
    const node = outlineNode(g, e.shape, box, e);
    if (e.shape !== 'rect' && e.shape !== 'ellipse') node.setAttribute('stroke-linejoin', 'round');
    applyFill(state, node, g, e.fill, box);
    applyStroke(node, e.stroke, strokeWidth, e.dash);
  }

  function buildIcon(state, item, g) {
    const e = item.e;
    const parts = item.parts;
    if (!parts) {
      state.warn(e.icon ? 'Icon "' + e.icon + '" nicht gefunden' : 'Icon fehlt', e.id);
      if (state.mode === 'editor') drawPlaceholder(state, g, boxOf(e), e.icon || 'Icon');
      return;
    }
    // the grid of the icon: 24 x 24 for Lucide, whatever the set uses for an icon of a catalogue (576 x 512 for a wide Font Awesome icon); the icon is centred in its box
    const [gw, gh] = item.grid || [24, 24];
    const scale = Math.min(e.w, e.h) / Math.max(gw, gh);
    if (!(scale > 0)) return;
    const group = svgElement('g', {
      transform: 'translate(' + fmt(e.x + (e.w - gw * scale) / 2) + ' ' + fmt(e.y + (e.h - gh * scale) / 2) + ') scale(' + fmt6(scale) + ')',
      fill: 'none', stroke: e.color, 'stroke-width': fmt(e.strokeWidth), 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    }, g);
    for (const part of parts) {
      const attrs = part.attrs;
      let drawn = attrs;
      if (attrs.fill !== undefined || attrs.stroke !== undefined) {
        // a part of a catalogue icon says what it is: currentColor is the colour of the element, a stroke width is relative to the usual 2
        drawn = Object.assign({}, attrs);
        if (drawn.fill === 'currentColor') drawn.fill = e.color;
        if (drawn.stroke === 'currentColor') drawn.stroke = e.color;
        if (drawn['stroke-width'] !== undefined) drawn['stroke-width'] = fmt6(Number(drawn['stroke-width']) * e.strokeWidth / 2);
      }
      svgElement(part.tag, drawn, group);
    }
  }

  function buildQr(state, item, g) {
    const e = item.e;
    const code = item.code;
    if (!code.ok) {
      if (state.mode === 'editor') drawPlaceholder(state, g, boxOf(e), code.reason);
      return;
    }
    if (!(e.w > 0) || !(e.h > 0)) return;
    if (e.background) svgElement('rect', { x: fmt(e.x), y: fmt(e.y), width: fmt(e.w), height: fmt(e.h), fill: e.background }, g);
    const quiet = e.quiet ? 4 : 0;
    const across = code.size + 2 * quiet;
    const scale = Math.min(e.w, e.h) / across;
    svgElement('path', {
      d: qrPathData(code.modules, quiet), fill: e.color,
      transform: 'translate(' + fmt(e.x + (e.w - across * scale) / 2) + ' ' + fmt(e.y + (e.h - across * scale) / 2) + ') scale(' + fmt6(scale) + ')',
    }, g);
  }

  function buildBarcode(state, item, g) {
    const e = item.e;
    const code = item.code;
    if (!code.ok) {
      if (state.mode === 'editor') drawPlaceholder(state, g, boxOf(e), code.reason);
      return;
    }
    if (!(e.w > 0) || !(e.h > 0)) return;
    const ean = e.format !== 'code128';
    const quietLeft = e.format === 'ean13' ? 11 : (e.format === 'ean8' ? 7 : 10);
    const quietRight = e.format === 'ean13' ? 7 : (e.format === 'ean8' ? 7 : 10);
    const module = e.w / (quietLeft + code.bars.length + quietRight);
    if (e.background) svgElement('rect', { x: fmt(e.x), y: fmt(e.y), width: fmt(e.w), height: fmt(e.h), fill: e.background }, g);
    let fontSize = Math.min(ean ? 8.5 * module : 11 * module, e.h * 0.22);
    if (e.showText && !ean) {
      const measurer = getMeasurer(e.fontFamily, 400, false);
      const width = measurer.width(code.text) * fontSize;
      if (width > e.w * 0.96) fontSize *= e.w * 0.96 / width;
    }
    const band = e.showText ? fontSize * 1.25 : 0;
    const barHeight = e.h - band;
    const guardHeight = ean && e.showText ? barHeight + band * 0.55 : barHeight;
    const inGuard = index => code.guards.some(range => index >= range[0] && index < range[1]);
    const parts = [];
    for (let i = 0; i < code.bars.length;) {
      if (!code.bars[i]) { i++; continue; }
      let end = i;
      while (end < code.bars.length && code.bars[end] && inGuard(end) === inGuard(i)) end++;
      parts.push('M' + (quietLeft + i) + ' 0h' + (end - i) + 'v' + fmt(((inGuard(i) ? guardHeight : barHeight)) / module) + 'h-' + (end - i) + 'z');
      i = end;
    }
    svgElement('path', {
      d: parts.join(''), fill: e.color, transform: 'translate(' + fmt(e.x) + ' ' + fmt(e.y) + ') scale(' + fmt6(module) + ')',
    }, g);
    if (!e.showText || !(fontSize > 0)) return;
    const baseline = e.y + e.h - fontSize * 0.2;
    const common = { fill: e.color, 'font-family': cssFamily(e.fontFamily), 'font-size': fmt(fontSize), 'text-anchor': 'middle' };
    if (!ean) {
      svgElement('text', Object.assign({ x: fmt(e.x + e.w / 2), y: fmt(baseline) }, common), g).textContent = code.text;
      return;
    }
    const half = e.format === 'ean13' ? 6 : 4;
    const digits = code.text;
    const leftDigits = e.format === 'ean13' ? digits.slice(1, 7) : digits.slice(0, 4);
    const rightDigits = digits.slice(digits.length - half);
    const centre = (offset, i) => fmt(e.x + (quietLeft + offset + 7 * i + 3.5) * module);
    const row = (text, offset) => svgElement('text', Object.assign({ x: Array.from(text, (c, i) => centre(offset, i)).join(' '), y: fmt(baseline) }, common), g);
    row(leftDigits, 3).textContent = leftDigits;
    row(rightDigits, 3 + 7 * half + 5).textContent = rightDigits;
    if (e.format === 'ean13') {
      svgElement('text', Object.assign({ x: fmt(e.x + quietLeft * module / 2), y: fmt(baseline) }, common), g).textContent = digits[0];
    }
  }

  function buildBackground(state, svg) {
    if (state.noBackground) return;
    const doc = state.doc;
    const bg = state.page.background;
    const box = { x: 0, y: 0, w: doc.width, h: doc.height };
    const rectAttributes = { x: 0, y: 0, width: fmt(doc.width), height: fmt(doc.height), 'data-dt-background': '1' };
    if (bg.color) svgElement('rect', Object.assign({ fill: bg.color }, rectAttributes), svg);
    if (bg.gradient) svgElement('rect', Object.assign({ fill: 'url(#' + createGradient(state, svg, bg.gradient, box) + ')' }, rectAttributes), svg);
    if (!state.backgroundUrl) return;
    const info = state.infos.get(state.backgroundUrl);
    const g = svgElement('g', { 'data-dt-background': '1' }, svg);
    // cover is sliced and clipped to the page by drawPicture; contain/fill stay inside the page anyway.
    drawPicture(state, g, box, state.backgroundUrl, { fit: bg.fit, ratio: info ? info.ratio : 1, mask: 'none', radius: 0 });
  }

  /**
   * Internal: resolves the document against the values, loads fonts, image sizes and icons, builds the SVG of one page.
   * @returns {Promise<{svg:SVGSVGElement, doc:object, images:Array<{el:Element,url:string}>, faces:Array<object>}>}
   */
  async function build(input, values, options) {
    const opts = options || {};
    const doc = normalize(input);
    const pageIndex = Math.floor(num(opts.page, 0, 0, doc.pages.length - 1));
    const page = doc.pages[pageIndex];
    const mode = opts.mode === 'editor' ? 'editor' : 'output';
    const missing = opts.missing === 'token' ? 'token' : 'empty';
    const prefix = opts.idPrefix ? sanitizeId(opts.idPrefix) + '-' : 'dt' + (++renderCounter) + '-';
    const valueMap = values === null || values === undefined ? buildValueMap(sampleValues(doc)) : buildValueMap(values);
    const resolver = makeResolver(doc.fields, valueMap, doc.locale, missing);
    const warned = new Set();
    const warn = (message, elementId) => {
      const key = message + '|' + elementId;
      if (warned.has(key)) return;
      warned.add(key);
      if (typeof opts.onWarning === 'function') { try { opts.onWarning(message, elementId || null); } catch (e) { /* a broken callback must not stop the render */ } }
    };
    const assetUrl = key => {
      if (typeof opts.assetUrl !== 'function') return null;
      try { const url = opts.assetUrl(String(key)); return typeof url === 'string' && url !== '' ? url : null; } catch (e) { return null; }
    };
    /** Image source → URL: asset key directly, field → the field's value is an asset key. Values are never URLs. */
    const sourceUrl = (source, e) => {
      if (!source) return null;
      let key = null;
      if (source.asset) key = source.asset;
      else if (source.field) {
        const value = resolver.value(source.field).trim();
        key = value === '' ? null : value;
      }
      if (key === null) return null;
      const url = assetUrl(key);
      if (!url) warn('Medium "' + key + '" nicht gefunden', e ? e.id : null);
      return url;
    };
    const resolveTokens = (text, e) => text.replace(TOKEN_PATTERN, (all, key) => {
      if (!resolver.field(key) && resolver.raw(key) === null) warn('Unbekannter Platzhalter {{' + key + '}}', e.id);
      return resolver.text(key);
    });

    // 1. Plan: which elements are drawn, their resolved texts, codes and image URLs, which faces, images and icons are needed.
    const faces = [];
    const imageUrls = new Set();
    const iconNames = new Set();
    const plan = list => {
      const items = [];
      for (const e of list) {
        if (e.hidden) continue;
        if (e.showIf && resolver.value(e.showIf).trim() === '') continue;
        const item = { e };
        if (e.type === 'text') {
          const resolved = resolveTokens(e.text, e);
          item.text = e.uppercase ? upperCase(resolved, doc.locale) : resolved;
          if (item.text.trim() !== '') faces.push({ family: e.fontFamily, weight: e.fontWeight, italic: e.italic, text: item.text + (e.list === 'number' ? '0123456789.' : '') });
        } else if (e.type === 'image') {
          item.url = sourceUrl(e.source, e);
          if (item.url) imageUrls.add(item.url);
        } else if (e.type === 'imageStrip') {
          item.slots = e.items.map(source => ({ source, url: sourceUrl(source, e) }));
          for (const slot of item.slots) if (slot.url) imageUrls.add(slot.url);
        } else if (e.type === 'icon') {
          if (e.icon) iconNames.add(e.icon);
        } else if (e.type === 'qr') {
          item.code = qrEncode(resolveTokens(e.value, e), e.ecc);
          if (!item.code.ok) warn(item.code.reason, e.id);
        } else if (e.type === 'barcode') {
          item.code = barcodeInfo(e.format, resolveTokens(e.value, e));
          if (!item.code.ok) warn(item.code.reason, e.id);
          else if (e.showText) faces.push({ family: e.fontFamily, weight: 400, italic: false, text: item.code.text });
        } else if (e.type === 'group') {
          item.children = plan(e.children);
        }
        items.push(item);
      }
      return items;
    };
    const items = plan(page.elements);
    const bg = page.background;
    const backgroundUrl = opts.background !== false && bg.asset ? sourceUrl({ asset: bg.asset }, null) : null;
    if (backgroundUrl) imageUrls.add(backgroundUrl);

    // 2. Load fonts, image sizes and icon bodies.
    const infos = new Map();
    const icons = new Map();
    await Promise.all([
      ensureFonts(faces, opts.fonts),
      ...Array.from(imageUrls, url => loadImageInfo(url).then(info => infos.set(url, info))),
      ...Array.from(iconNames, async name => {
        // opts.icon gives the body of a 24 x 24 Lucide icon as text, or { body, width, height } for an icon of a catalogue (any grid up to 2048)
        let body = null;
        let iw = 24;
        let ih = 24;
        if (typeof opts.icon === 'function') {
          try {
            body = await opts.icon(name);
            if (body && typeof body === 'object') {
              const w = Number(body.width);
              const h = Number(body.height);
              iw = w >= 1 && w <= 2048 ? w : 24;
              ih = h >= 1 && h <= 2048 ? h : 24;
              body = body.body;
            }
          } catch (e) { body = null; }
        }
        const parsed = parseIconBody(body);
        icons.set(name, parsed && parsed.length ? { parts: parsed, w: iw, h: ih } : null);
      }),
    ]);

    // 3. Build the DOM.
    const svg = svgElement('svg', {
      viewBox: '0 0 ' + fmt(doc.width) + ' ' + fmt(doc.height),
      width: fmt(doc.width) + doc.unit,
      height: fmt(doc.height) + doc.unit,
      'data-dt-engine': '1',
    });
    const state = { doc, page, mode, prefix, counter: 0, resolver, infos, backgroundUrl, images: [], warn, noBackground: opts.background === false };
    buildBackground(state, svg);
    const buildItem = (item, parent) => {
      const e = item.e;
      const g = elementGroup(state, e, parent);
      if (e.type === 'text') buildText(state, item, g);
      else if (e.type === 'image') buildImage(state, item, g);
      else if (e.type === 'imageStrip') buildStrip(state, item, g);
      else if (e.type === 'shape') buildShape(state, item, g);
      else if (e.type === 'icon') { const icon = icons.get(e.icon) || null; item.parts = icon && icon.parts; item.grid = icon ? [icon.w, icon.h] : [24, 24]; buildIcon(state, item, g); }
      else if (e.type === 'qr') buildQr(state, item, g);
      else if (e.type === 'barcode') buildBarcode(state, item, g);
      else for (const child of item.children) buildItem(child, g);
    };
    for (const item of items) buildItem(item, svg);
    return { svg, doc, images: state.images, faces };
  }

  /**
   * Renders one page of a document with values into a new SVG element (not attached to the page). Loads fonts, image sizes
   * and icons first. `viewBox` is `0 0 width height` in document units; `width`/`height` carry the physical size (`150mm`,
   * `800px`) – editor callers override them for zoom. Each element, group and group child is `<g data-el-id="…">` (both modes).
   * @param {object} doc the design document (schema 1 or 2; normalised internally, never mutated)
   * @param {object|Map|null} values values by field key (case-insensitive); null = the fields' sample values
   * @param {object} [opts]
   * @param {number} [opts.page] 0-based page index (default 0)
   * @param {(key:string)=>string|null} [opts.assetUrl] asset key → URL (null/unknown: nothing is drawn, a warning is reported)
   * @param {Array<{family:string,weight:(number|string),style:string,url:string}>} [opts.fonts] faces to register and embed
   * @param {(name:string)=>(string|Promise<string>|null)} [opts.icon] Lucide icon name → body markup of the 24 × 24 icon
   * @param {'editor'|'output'} [opts.mode] editor draws dashed placeholders (empty frames, unknown icons, invalid codes); default output
   * @param {'empty'|'token'} [opts.missing] missing values render empty (default) or as `{{Key}}`
   * @param {string} [opts.idPrefix] prefix of generated ids (gradients, filters, clip paths); default a per-render counter
   * @param {(message:string, elementId:string|null)=>void} [opts.onWarning] unknown placeholders, missing assets, unknown icons, invalid codes
   * @param {boolean} [opts.background] false = skip the page background (colour, gradient, picture)
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

  /** Writes the density (dpi) into the JFIF header of a JPEG so printers know the physical size. */
  async function jpegWithDpi(blob, dpi) {
    const bytes = new Uint8Array(await blobToArrayBuffer(blob));
    // SOI, APP0 marker, length, "JFIF" and a zero byte: units at 13, X density at 14-15, Y density at 16-17.
    if (bytes.length < 20 || !startsWith(bytes, 0xff, 0xd8, 0xff, 0xe0) || bytes[6] !== 0x4a || bytes[7] !== 0x46 || bytes[8] !== 0x49 || bytes[9] !== 0x46) return blob;
    const density = Math.max(1, Math.min(65535, Math.round(dpi)));
    bytes[13] = 1;
    bytes[14] = density >> 8; bytes[15] = density & 255;
    bytes[16] = density >> 8; bytes[17] = density & 255;
    return new Blob([bytes], { type: 'image/jpeg' });
  }

  /**
   * Rasterises one page to PNG or JPEG at `opts.dpi` (default `doc.dpi`): 150 × 100 mm at 300 dpi = 1772 × 1181 px. `opts.scale`
   * multiplies the size, `opts.maxWidth` (px) limits it (thumbnails). The file carries its dpi (PNG pHYs, JPEG JFIF density).
   * PNG is transparent where the page has no background; `opts.background: false` skips the page background altogether
   * (transparent PNG). JPEG is filled white under transparency.
   * @param {object} doc @param {object|Map|null} values
   * @param {object} [opts] see render (`page`, `assetUrl`, `fonts`, `icon`, ...), plus `dpi`, `scale`, `maxWidth`,
   *   `format` ('png' default | 'jpeg'), `quality` (0..1, jpeg, default 0.92), `background` (false = no page background)
   * @returns {Promise<Blob>} image/png or image/jpeg
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
    const jpeg = options.format === 'jpeg' || options.format === 'jpg';
    if (jpeg) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pixelWidth, pixelHeight);
    }
    ctx.drawImage(img, 0, 0, pixelWidth, pixelHeight);
    const mime = jpeg ? 'image/jpeg' : 'image/png';
    const encoded = await new Promise((resolve, reject) => {
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('The image could not be created'))), mime, jpeg ? num(options.quality, 0.92, 0.01, 1) : undefined);
    });
    const effectiveDpi = pixelWidth / unitToInch(normalized.width, normalized.unit);
    return jpeg ? jpegWithDpi(encoded, effectiveDpi) : pngWithDpi(encoded, effectiveDpi);
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
    version: 2,
    SCHEMA,
    normalize,
    pageCount,
    fieldsUsed,
    assetKeysUsed,
    iconNamesUsed,
    iconSource,
    sampleValues,
    formatValue,
    resolveText,
    render,
    renderInto,
    toStandaloneSvg,
    rasterize,
    zip,
    layoutText,
    qrEncode,
    barcodeInfo,
    ptToUnit,
    unitToPx,
    unitToInch,
  });
})(typeof window !== 'undefined' ? window : globalThis);
