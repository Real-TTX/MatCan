'use strict';
// Helpers of the editor checks (designer-check.js, canva-check.js): reading the state of the editor, pointer gestures, panels, PNG files made in memory, synthetic paste and
// drop events with files, reading downloads. The editor exposes window.DtDesigner (app = the state, canvas.whenIdle() for the drawing).
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const idle = page => page.evaluate(() => window.DtDesigner.canvas.whenIdle());
const raf2 = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

/** The document and the selection of the editor as plain data. */
const state = page => page.evaluate(() => {
  const app = window.DtDesigner.app;
  const plain = o => JSON.parse(JSON.stringify(o));
  return { doc: plain(app.doc), pages: plain(app.doc.pages), elements: plain(app.elements()), fields: plain(app.doc.fields), sel: app.sel.slice(), dirty: app.dirty, saveState: app.saveState, revision: app.baseRevision, zoom: app.zoom, pageIndex: app.pageIndex };
});

/** One node (any page, any group level) as plain data. */
const nodeOf = (page, id) => page.evaluate(i => { const e = window.DtDesigner.app.element(i); return e ? JSON.parse(JSON.stringify(e)) : null; }, id);

async function openDesigner(page, base, id) {
  await page.goto(`${base}/Designs/${id}/Designer`);
  await page.waitForSelector('#dt-ds:not(.is-loading)', { timeout: 20000 });
  await idle(page);
  await raf2(page);
}

/** One-click creation through the API (like the tiles of the start page). Resolves { id, url }. */
async function createDesign(page, postJson, body) {
  const res = await postJson(page, '/api/designs', body || { preset: 'price-tag' });
  if (res.status !== 200) { throw new Error('POST /api/designs failed: ' + res.status + ' ' + JSON.stringify(res.body)); }
  return res.body;
}

/** Client geometry of the page and one node: centre and box on the screen (page coordinates of the node frame are on the screen only for top-level nodes). */
const geometry = (page, id) => page.evaluate(elementId => {
  const D = window.DtDesigner;
  const rect = D.canvas.clientRectOf(elementId);
  const e = D.app.element(elementId);
  const r = document.getElementById('dt-sheet').getBoundingClientRect();
  return { k: D.app.scale(), left: r.left, top: r.top, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2, x: e.x, y: e.y, w: e.w, h: e.h, rect };
}, id);

async function handleCentre(page, name) {
  return page.evaluate(n => {
    const c = document.querySelector(`[data-handle="${n}"]`);
    if (!c) { return null; }
    const r = c.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, name);
}

async function drag(page, from, to, options) {
  const o = options || {};
  if (o.hold) { for (const key of o.hold) { await page.keyboard.down(key); } }
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  if (o.holdAfterDown) { for (const key of o.holdAfterDown) { await page.keyboard.down(key); } }
  await page.mouse.move(to.x, to.y, { steps: 6 });
  if (o.beforeUp) { await o.beforeUp(); }
  await page.mouse.up();
  if (o.holdAfterDown) { for (const key of o.holdAfterDown.slice().reverse()) { await page.keyboard.up(key); } }
  if (o.hold) { for (const key of o.hold.slice().reverse()) { await page.keyboard.up(key); } }
  await idle(page);
}

const selectIds = async (page, ids) => { await page.evaluate(i => window.DtDesigner.app.select(i), ids); await raf2(page); };
const waitState = (page, wanted, timeout) => page.waitForFunction(w => window.DtDesigner.app.saveState === w, wanted, { timeout: timeout || 10000 });
const svgText = page => page.evaluate(() => Array.from(document.querySelectorAll('#dt-page svg text')).map(t => t.textContent).join('|'));
const near = (a, b, tolerance) => Math.abs(a - b) <= tolerance;

/** Opens a panel of the rail (a click on the active button would close it). */
async function openPanel(page, id) {
  const open = await page.evaluate(() => window.DtDesigner.panels.current());
  if (open !== id) { await page.click(`.dt-rail__btn[data-panel="${id}"]`); }
  await page.waitForFunction(p => window.DtDesigner.panels.current() === p, id);
  await raf2(page);
}

/** Makes a PNG in memory (a plain colour with a lighter square) - no dependencies. */
function png(width, height, rgb) {
  const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) { c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } t[n] = c >>> 0; } return t; })();
  const crc = buf => { let c = 0xffffffff; for (const b of buf) { c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); } return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body)); return Buffer.concat([len, body, sum]); };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const inner = x > width / 4 && x < width / 2 && y > height / 4 && y < height / 2;
      const o = y * (width * 3 + 1) + 1 + x * 3;
      raw[o] = inner ? 255 : rgb[0]; raw[o + 1] = inner ? 255 : rgb[1]; raw[o + 2] = inner ? 255 : rgb[2];
    }
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** A file for the synthetic events: { name, type, base64 }. */
const pngFile = (name, rgb, w, h) => ({ name, type: 'image/png', base64: png(w || 120, h || 80, rgb).toString('base64') });

/** A copy of a bundled font with a few extra bytes (another hash, so the server takes it as a new file). */
function fontFile(name) {
  const file = path.join(__dirname, '..', '..', 'src', 'DesignThix', 'wwwroot', 'fonts', 'Pacifico-Regular.ttf');
  const bytes = Buffer.concat([fs.readFileSync(file), Buffer.from(String(Date.now()) + Math.random())]);
  return { name: name || 'Pacifico-Check.ttf', type: 'font/ttf', base64: bytes.toString('base64') };
}

/** Builds a DataTransfer with files inside the page (Chromium lets a script do that). */
const BUILD_DT = `
  (files) => {
    const dt = new DataTransfer();
    for (const f of files) {
      const bin = atob(f.base64); const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) { bytes[i] = bin.charCodeAt(i); }
      dt.items.add(new File([bytes], f.name, { type: f.type }));
    }
    return dt;
  }`;

/** Ctrl+V with files in the clipboard (a screenshot, an image copied in a browser or in the explorer). */
function pasteFiles(page, files) {
  return page.evaluate(({ files: list, build }) => {
    const dt = eval(build)(list);
    document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, { files, build: BUILD_DT });
}

/** Ctrl+V with plain text. */
function pasteText(page, text) {
  return page.evaluate(t => {
    const dt = new DataTransfer();
    dt.setData('text/plain', t);
    document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, text);
}

/** Files dropped from the file explorer onto a client point of the canvas: dragenter, dragover, drop. Resolves whether the overlay was visible while dragging. */
function dropFiles(page, files, x, y) {
  return page.evaluate(({ files: list, build, x: px, y: py }) => {
    const dt = eval(build)(list);
    const target = document.elementFromPoint(px, py) || document.getElementById('dt-viewport');
    const fire = type => target.dispatchEvent(new DragEvent(type, { dataTransfer: dt, clientX: px, clientY: py, bubbles: true, cancelable: true }));
    fire('dragenter');
    fire('dragover');
    const overlay = !document.getElementById('dt-dropzone').hidden;
    fire('drop');
    return overlay;
  }, { files, build: BUILD_DT, x, y });
}

/** Reads the width and height of a PNG buffer. */
const pngSize = buf => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

/** The file names inside a ZIP buffer (central directory). */
function zipNames(buf) {
  const names = [];
  let end = buf.length - 22;
  while (end >= 0 && buf.readUInt32LE(end) !== 0x06054b50) { end--; }
  if (end < 0) { return names; }
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  for (let i = 0; i < count; i++) {
    const nameLength = buf.readUInt16LE(p + 28);
    const extra = buf.readUInt16LE(p + 30);
    const comment = buf.readUInt16LE(p + 32);
    names.push(buf.slice(p + 46, p + 46 + nameLength).toString('utf8'));
    p += 46 + nameLength + extra + comment;
  }
  return names;
}

/** Reads a Playwright download into a Buffer. */
async function readDownload(download) {
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const c of stream) { chunks.push(c); }
  return Buffer.concat(chunks);
}

/** A finger drag with the DevTools protocol (touch events). */
async function touchDrag(client, from, to, steps) {
  const point = p => ({ x: p.x, y: p.y, id: 1 });
  const n = steps || 8;
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(from)] });
  for (let i = 1; i <= n; i++) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point({ x: from.x + (to.x - from.x) * i / n, y: from.y + (to.y - from.y) * i / n })] });
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** A long press (finger down, wait, up). */
async function longPress(client, at, ms) {
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: at.x, y: at.y, id: 1 }] });
  await new Promise(r => setTimeout(r, ms || 700));
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

module.exports = { idle, raf2, state, nodeOf, openDesigner, createDesign, geometry, handleCentre, drag, selectIds, waitState, svgText, near, openPanel, png, pngFile, fontFile, pasteFiles, pasteText, dropFiles, pngSize, zipNames, readDownload, touchDrag, longPress };
