'use strict';
// A LOCAL FAKE OpenAI-compatible server for the browser checks (ai-check.js, ai-design-check.js, screens.js): it answers /v1/models and /v1/chat/completions with canned JSON that
// depends on the instruction it got (the fixed part of the instruction names the task: data import, data fill, text suggestion, test, and the design assistant). Nothing leaves the machine.
//   const { fake, startFake } = require('./fake-ai.js');
//   await startFake(3066);          // fake.mode = 'ok' | 'unauthorized' | 'announce' | 'nostream'; fake.requests = the bodies that were sent; fake.agent.calls = what the assistant was asked (scenario, step, sawImage ...); fake.streamDelayMs / fake.restDelayMs = the pause between the pieces of a streamed answer (the words of the message / the rest of the JSON)
//
// THE DESIGN ASSISTANT ("agent" mode, recognised by "ANTWORTFORMAT (technisch, immer einhalten)" in the system message): the answers are deterministic and depend on the message of the person
// (the newest user message that is not a result of tools) and on how many results of tools came back since: a scenario is a function of (the step, the results so far, the situation).
// Scenarios, chosen by words in the message of the person (the first that fits):
//   stopp-test    waits 30 s before it answers (so "Stopp" can be tested), then says it is done
//   frage-test    ends with a question and no action: the run waits for the person
//   format-test   never answers in the protocol: the run ends "Angehalten" after the re-asks
//   limit-test    keeps reading the design and never says it is done: the run ends "Limit erreicht" (with a small AgentMaxCallsPerRun)
//   fehler-test   first a tool call that fails (a symbol that does not exist), then the repair
//   bereich-test  tries to write on a page outside the scope (fails), then writes on the page of the scope
//   anhang-test   places the picture that came with the message (the key stands in the line "[Anhang: ... in der Bibliothek als <key>"), says whether it SAW a picture
//   referenz-test says what the references of the message were (a design: "[Referenz: Design ...]", a data list: reads it with read_datalist)
//   uebersetze    ("übersetze", "english"): reads the design, translates every text with a small dictionary
//   serie         ("platzhalter", "serie"): makes the field Name and turns the first text into {{Name}}
//   varianten     ("variante"): two copies of page 1 with other background colours
//   weiter        ("mach weiter"): says it is done
//   plakat        everything else ("gestalte", "plakat", "entwirf", ... or anything): in seven steps (read, background and title, subtitle and icon, details and QR, a change of the title, look, done)
//                 that make the canvas change one step after the other; with an automatic format (the situation says "kein Format gewählt") it chooses the poster A3 first.
// Every answer is streamed in small pieces (about 12 characters, 20 ms apart) when the request says "stream": true; mode 'nostream' answers such a request with a 400 so the fall back can be tested.
const http = require('http');

const fake = { mode: 'ok', requests: [], server: null, streamDelayMs: 20, restDelayMs: null, agent: { calls: [] } };

const slot = (text, start, end) => { const a = text.indexOf(start); if (a < 0) { return ''; } const b = text.indexOf(end, a + start.length); return text.slice(a + start.length, b < 0 ? undefined : b); };
const norm = text => String(text || '').split(String.fromCharCode(13, 10)).join(String.fromCharCode(10));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** The messages as plain objects: role, the text, the number of pictures that ride along. */
function plain(messages) {
  return (messages || []).map(m => {
    const parts = Array.isArray(m.content) ? m.content : null;
    const text = parts ? parts.filter(p => p.type === 'text').map(p => p.text).join('\n') : String(m.content || '');
    return { role: m.role, text: norm(text), images: parts ? parts.filter(p => p.type === 'image_url').length : 0 };
  });
}

/** The canned answers of the one-shot actions: what the model "says" depends on the instruction it got (the fixed part names the task). */
function answer(system, user) {
  if (system.includes('Bestätige, dass du erreichbar bist')) { return { ok: true, message: 'Hallo vom Fake-Server' }; }
  if (system.includes('Übernimm die Angaben aus dem Text')) {
    const text = slot(user, '<<<TEXT\n', '\nTEXT>>>');
    const flags = { Niederlande: 'flag-nl', Frankreich: 'flag-fr', Deutschland: 'flag-de' };
    const rows = text.split('\n').filter(l => l.includes('€')).map(line => {
      const parts = line.split(',').map(p => p.trim());
      const price = (line.match(/(\d+(?:[.,]\d+)?)\s*€/) || [])[1] || '';
      const country = parts[parts.length - 1].replace(/^aus (den |dem |der )?/, '');
      const key = Object.keys(flags).find(c => country.includes(c.slice(0, 6)));
      return { Name: parts[0], Preis: price, Land: key ? flags[key] : 'flag-' + country.toLowerCase() };
    });
    return { rows, notes: rows.length + ' Zeilen aus dem Lieferschein.' };
  }
  if (system.includes('Schreibe für jede der genannten Zeilen')) {
    const instruction = slot(system, '## Anweisung der Person für diesen Schritt\n', '\n\n');
    const values = user.split('\n').filter(l => l.startsWith('{"row":')).map(l => JSON.parse(l)).map(r => {
      const name = (r.werte && r.werte.Name) || '';
      if (/Englisch/i.test(instruction)) { return { row: r.row, value: name + ' (EN)' }; }
      const region = /Gouda/.test(name) ? 'Südholland' : /Brie/.test(name) ? 'Île-de-France' : 'Unbekannt';
      return { row: r.row, value: region };
    });
    values.push({ row: 999999, value: 'gehört nicht zur Auswahl' });
    return { values };
  }
  if (system.includes('Formuliere Alternativen')) {
    const tokens = slot(user, 'Platzhalter im Text, die in jedem Vorschlag unverändert vorkommen müssen\n', '\n\n').trim();
    const t = tokens === '(keine)' ? '' : tokens;
    const instruction = slot(system, '## Anweisung der Person für diesen Schritt\n', '\n\n').trim();
    const tag = instruction ? ' [' + instruction + ']' : '';
    return { suggestions: [`Heute im Angebot: ${t}${tag}`.trim(), `Frisch für dich: ${t}`.trim(), `${t} – einfach lecker`.trim(), 'Ganz ohne Platzhalter'] };
  }
  return { ok: true };
}

// ------------------------------------------------------------------------------------------------ the design assistant

const say = (message, done, ...actions) => ({ message, actions: actions.map(a => ({ tool: a[0], args: a[1] || {} })), done: !!done });

/** The results of the tools since the message of the person: [{ tool, ok, result, warnings }] per batch. */
function batches(msgs, start) {
  const out = [];
  for (let i = start + 1; i < msgs.length; i++) {
    const m = msgs[i];
    if (m.role === 'user' && m.text.startsWith('Ergebnisse der Aktionen:')) {
      try { out.push(JSON.parse(m.text.slice('Ergebnisse der Aktionen:'.length).trim())); } catch (e) { out.push([]); }
    }
  }
  return out;
}

const resultOf = (list, tool) => { for (const batch of list) { for (const r of batch) { if (r.tool === tool) { return r; } } } return null; };
const ptToUnit = (pt, unit) => (unit === 'px' ? pt * 96 / 72 : pt * 25.4 / 72);

function quoted(text) { const m = text.match(/[„"“]([^„"“”]{2,60})[“"”]/); return m ? m[1] : null; }

/** Which scenario a message of the person asks for. */
function scenarioOf(text) {
  const t = text.toLowerCase();
  if (t.includes('stopp-test')) { return 'stopp-test'; }
  if (t.includes('frage-test')) { return 'frage-test'; }
  if (t.includes('format-test')) { return 'format-test'; }
  if (t.includes('limit-test')) { return 'limit-test'; }
  if (t.includes('fehler-test')) { return 'fehler-test'; }
  if (t.includes('bereich-test')) { return 'bereich-test'; }
  if (t.includes('anhang-test') || t.includes('[anhang:')) { return 'anhang-test'; }
  if (t.includes('referenz-test') || t.includes('[referenz:')) { return 'referenz-test'; }
  if (t.includes('mach weiter')) { return 'weiter'; }
  if (t.includes('übersetze') || t.includes('uebersetze') || t.includes('englisch')) { return 'uebersetze'; }
  if (t.includes('platzhalter') || t.includes('serie')) { return 'serie'; }
  if (t.includes('variante')) { return 'varianten'; }
  return 'plakat';
}

const DICTIONARY = { Sommerfest: 'Summer Festival', Hoffest: 'Farm Festival', Samstag: 'Saturday', Uhr: "o'clock", Eintritt: 'Admission', frei: 'free', Käse: 'Cheese', Preis: 'Price', Herzlich: 'Warm', willkommen: 'welcome', Einladung: 'Invitation', Musik: 'Music', Essen: 'Food' };
const translate = text => String(text).split(/(\s+)/).map(w => { const bare = w.replace(/[.,!?:·]/g, ''); return /^{{/.test(w) || !DICTIONARY[bare] ? w : w.replace(bare, DICTIONARY[bare]); }).join('');

function agentAnswer(system, msgs) {
  // the message of the person: the newest user message that is neither the results of tools nor a push of the loop
  let start = -1;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.role === 'user' && !m.text.startsWith('Ergebnisse der Aktionen:') && !m.text.startsWith('Deine letzte Antwort war nicht') && !m.text.startsWith('Du hast "done": false gesetzt') && !m.text.startsWith('Die Änderungen von Lauf')) { start = i; break; }
  }
  const person = start >= 0 ? msgs[start] : { text: '', images: 0 };
  const scenario = scenarioOf(person.text);
  const list = batches(msgs, start);
  const step = list.length;
  const situation = slot(system, '## Die Lage\n', '\u0000');
  const autoFormat = situation.includes('kein Format gewählt');
  const read = resultOf(list, 'read_design');
  const format = read && read.result && read.result.format ? read.result.format : { width: 297, height: 420, unit: 'mm' };
  const W = Number(format.width), H = Number(format.height), unit = format.unit || 'mm';
  const pageWpt = unit === 'px' ? W * 0.75 : W * 72 / 25.4;
  const lastImages = msgs.length ? msgs[msgs.length - 1].images : 0;
  const record = { scenario, step, sawImage: lastImages > 0 || person.images > 0, personText: person.text.slice(0, 200) };
  fake.agent.calls.push(record);

  switch (scenario) {
    case 'stopp-test': return { delay: 30000, body: say('Das dauert etwas …', true) };
    case 'frage-test': return { body: say('Soll das Plakat hell oder dunkel sein?', false) };
    case 'format-test': return { raw: 'Ich schaue mir das gleich an, einen Moment.' };
    case 'limit-test': return { body: say('Ich lese noch einmal.', false, ['read_design']) };
    case 'weiter': return { body: say('Alles klar, ich bin fertig. Die Arbeit ist abgeschlossen.', true) };
    case 'fehler-test':
      if (step === 0) { return { body: say('Ich setze ein Symbol.', false, ['add_elements', { page: 'p1', elements: [{ type: 'icon', icon: 'gibt-es-nicht-xyz', x: 10, y: 10, w: 20, h: 20 }] }]) }; }
      if (step === 1) { return { body: say('Das Symbol gibt es nicht, ich nehme einen Stern.', false, ['add_elements', { page: 'p1', elements: [{ type: 'icon', icon: 'star', x: 10, y: 10, w: 20, h: 20, color: '#ff8800' }] }]) }; }
      return { body: say('Fertig: der Stern steht.', true) };
    case 'bereich-test': {
      const pages = read && read.result ? read.result.pages : [];
      const scopeId = (situation.match(/Seite \d+ \(id (p\d+)\)\. Die Person hat/) || [])[1];
      if (step === 0) { return { body: say('Ich schaue mir das Design an.', false, ['read_design']) }; }
      const other = pages.find(p => p.id !== scopeId);
      if (step === 1) {
        return { body: say('Ich schreibe auf die andere Seite.', false, ['add_elements', { page: other ? other.id : 'p9', elements: [{ type: 'text', x: 10, y: 10, w: 100, h: 10, text: 'Außerhalb' }] }]) };
      }
      if (step === 2) { return { body: say('Das war nicht erlaubt, ich schreibe auf die Seite des Bereichs.', false, ['add_elements', { page: scopeId, elements: [{ type: 'text', x: 10, y: 10, w: 100, h: 10, text: 'Im Bereich' }] }]) }; }
      return { body: say('Fertig: nur im Bereich geändert.', true) };
    }
    case 'anhang-test': {
      const key = (person.text.match(/in der Bibliothek als ([a-z0-9][a-z0-9_-]*)/) || [])[1];
      if (step === 0) { return { body: say('Ich schaue mir das Design an.', false, ['read_design']) }; }
      if (step === 1 && key) {
        return { body: say('Ich setze das angehängte Bild ein.', false, ['add_elements', { page: 'p1', elements: [{ type: 'image', x: W * 0.1, y: H * 0.1, w: W * 0.5, h: W * 0.5, source: { asset: key }, fit: 'contain', name: 'Anhang' }] }]) };
      }
      return { body: say(`Fertig. Bild gesehen: ${person.images > 0 ? 'ja' : 'nein'}.`, true) };
    }
    case 'referenz-test': {
      const design = (person.text.match(/\[Referenz: Design „([^“]+)“/) || [])[1];
      const hasList = /\[Referenz: Datenliste/.test(person.text);
      if (step === 0 && hasList) { return { body: say('Ich lese die Datenliste.', false, ['read_datalist']) }; }
      return { body: say(`Ich habe die Referenz${design ? ' „' + design + '“' : ''}${hasList ? ' und die Datenliste' : ''} gelesen.`, true) };
    }
    case 'uebersetze': {
      if (step === 0) { return { body: say('Ich lese das Design.', false, ['read_design']) }; }
      if (step === 1) {
        const changes = [];
        for (const page of (read && read.result ? read.result.pages : [])) {
          for (const e of page.elements || []) { if (e.type === 'text' && e.text) { changes.push({ id: e.id, set: { text: translate(e.text) } }); } }
        }
        return { body: say('Ich übersetze die Texte ins Englische.', false, ['update_elements', { changes }]) };
      }
      return { body: say('Fertig: alle Texte sind übersetzt.', true) };
    }
    case 'serie': {
      if (step === 0) { return { body: say('Ich lese das Design.', false, ['read_design']) }; }
      if (step === 1) {
        const first = ((read && read.result ? read.result.pages : [])[0] || { elements: [] }).elements.find(e => e.type === 'text');
        const actions = [['set_fields', { fields: [{ key: 'Name', label: 'Name', type: 'text', sample: 'Gouda' }] }]];
        if (first) { actions.push(['update_elements', { changes: [{ id: first.id, set: { text: '{{Name}}' } }] }]); }
        return { body: say('Ich lege das Feld Name an und setze den Platzhalter ein.', false, ...actions) };
      }
      return { body: say('Fertig: der erste Text ist jetzt {{Name}} und das Feld ist angelegt.', true) };
    }
    case 'varianten': {
      if (step === 0) { return { body: say('Ich lese das Design.', false, ['read_design']) }; }
      if (step === 1) { return { body: say('Variante A.', false, ['add_page', { copyOf: 'p1', name: 'Variante A', background: { color: '#7a1f1f' } }]) }; }
      if (step === 2) { return { body: say('Variante B.', false, ['add_page', { copyOf: 'p1', name: 'Variante B', background: { color: '#1f7a3a' } }]) }; }
      return { body: say('Fertig: zwei neue Seiten mit anderen Farben.', true) };
    }
    default: break;
  }

  // plakat: the canvas changes step by step
  const title = quoted(person.text) || (/hoffest/i.test(person.text) ? 'Hoffest' : 'Sommerfest');
  const m = Math.round(W * 0.08 * 10) / 10;
  const titlePt = Math.max(10, Math.round(pageWpt * 0.07));
  const subPt = Math.max(8, Math.round(pageWpt * 0.032));
  const bodyPt = Math.max(8, Math.round(pageWpt * 0.026));
  const box = pt => Math.round(ptToUnit(pt, unit) * 1.45 * 10) / 10;
  if (autoFormat && step === 0) { return { body: say('Ich wähle zuerst ein Format, das zu einem Plakat passt.', false, ['resize_design', { preset: 'poster-a3-portrait' }]) }; }
  const n = autoFormat ? step - 1 : step;
  const addIds = list.flatMap(b => b.filter(r => r.tool === 'add_elements' && r.result && r.result.added).flatMap(r => r.result.added));
  const titleId = addIds.length ? addIds[0].id : null;
  switch (n) {
    case 0: return { body: say('Ich schaue mir zuerst an, was schon im Design ist.', false, ['read_design']) };
    case 1: return { body: say('Ich lege den dunklen Hintergrund und die Überschrift an.', false,
      ['set_page', { page: 'p1', background: { color: '#0b3d5c' } }],
      ['add_elements', { elements: [{ type: 'text', name: 'Titel', x: m, y: H * 0.14, w: W - 2 * m, h: box(titlePt), text: title, fontFamily: 'Montserrat', fontSize: titlePt, fontWeight: 800, color: '#ffffff', align: 'center', fit: 'shrink' }] }]) };
    case 2: return { body: say('Jetzt kommen der Untertitel und ein Symbol dazu.', false,
      ['add_elements', { elements: [
        { type: 'text', name: 'Untertitel', x: m, y: H * 0.14 + box(titlePt) + H * 0.02, w: W - 2 * m, h: box(subPt), text: 'Musik, Essen und gute Laune für alle', fontFamily: 'Open Sans', fontSize: subPt, fontWeight: 400, color: '#cfe8f5', align: 'center' },
        { type: 'icon', name: 'Sonne', icon: 'sun', x: W / 2 - W * 0.09, y: H * 0.42, w: W * 0.18, h: W * 0.18, color: '#ffcc00', strokeWidth: 1.5 }] }]) };
    case 3: return { body: say('Zum Schluss die Angaben und ein QR-Code.', false,
      ['add_elements', { elements: [
        { type: 'text', name: 'Angaben', x: m, y: H * 0.68, w: W - 2 * m, h: box(bodyPt) * 2, text: 'Samstag, 12. Juli · ab 14 Uhr\nEintritt frei', fontFamily: 'Open Sans', fontSize: bodyPt, fontWeight: 600, color: '#ffffff', align: 'center' },
        { type: 'qr', name: 'QR-Code', x: W / 2 - W * 0.09, y: H * 0.8, w: W * 0.18, h: W * 0.18, value: 'https://example.org/sommerfest', color: '#0b3d5c', background: '#ffffff' }] }]) };
    case 4: return { body: say('Die Überschrift darf etwas wärmer sein.', false, titleId ? ['update_elements', { changes: [{ id: titleId, set: { color: '#ffe08a' } }] }] : ['read_design']) };
    case 5: return { body: say('Ich sehe mir das Ergebnis an.', false, ['look', { page: 'p1' }]) };
    default: return { body: say(`Fertig: ich habe ein Plakat „${title}“ entworfen, mit Überschrift, Untertitel, Symbol, Angaben und QR-Code.`, true) };
  }
}

// ------------------------------------------------------------------------------------------------ the server

function startFake(port) {
  return new Promise((resolve, reject) => {
    fake.server = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', async () => {
        const url = req.url.split('?')[0];
        const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
        if (req.method === 'GET' && url === '/v1/models') { return send(200, { data: [{ id: 'fake-model' }, { id: 'fake-model-2' }] }); }
        if (req.method === 'POST' && url === '/v1/chat/completions') {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          fake.requests.push(body);
          if (fake.mode === 'unauthorized') { return send(401, { error: { message: 'Incorrect API key provided' } }); }
          if (body.stream && fake.mode === 'nostream') { return send(400, { error: { message: 'stream is not supported by this model' } }); }
          const msgs = plain(body.messages);
          const system = ((msgs.find(m => m.role === 'system') || {}).text) || '';
          const firstUser = ((msgs.filter(m => m.role === 'user')[0] || {}).text) || '';
          let content;
          if (system.includes('ANTWORTFORMAT (technisch, immer einhalten)')) {
            const a = agentAnswer(system, msgs);
            if (a.delay) { await sleep(a.delay); }
            content = a.raw !== undefined ? a.raw : JSON.stringify(a.body);
          } else {
            content = fake.mode === 'announce' ? 'Ich schaue mir das gleich an.' : JSON.stringify(answer(system, firstUser));
          }
          const usage = { prompt_tokens: Math.ceil(msgs.reduce((n, m) => n + m.text.length, 0) / 4), completion_tokens: Math.ceil(content.length / 4) };
          if (body.stream) {
            res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
            // the words of the "message" come at streamDelayMs, the rest of the JSON (the actions) at restDelayMs (null = the same): a person watching sees the text grow and the run does not take minutes
            const messageEnd = (/^\{"message":"(?:[^"\\]|\\.)*"/.exec(content) || [''])[0].length;
            for (let i = 0; i < content.length; i += 12) {
              res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: content.slice(i, i + 12) }, finish_reason: null }] }) + '\n\n');
              const pause = fake.restDelayMs !== null && i >= messageEnd ? fake.restDelayMs : fake.streamDelayMs;
              if (pause) { await sleep(pause); }
            }
            res.write('data: ' + JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }) + '\n\n');
            res.write('data: ' + JSON.stringify({ choices: [], usage }) + '\n\n');
            res.end('data: [DONE]\n\n');
            return undefined;
          }
          return send(200, { choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }], usage });
        }
        send(404, { error: { message: 'not found' } });
        return undefined;
      });
    });
    fake.server.on('error', reject);
    fake.server.listen(port, '0.0.0.0', () => resolve());
  });
}

module.exports = { fake, startFake };
