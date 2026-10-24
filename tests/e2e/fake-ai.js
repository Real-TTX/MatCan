'use strict';
// A LOCAL FAKE OpenAI-compatible server for the browser checks (ai-check.js, screens.js): it answers /v1/models and /v1/chat/completions with canned JSON that
// depends on the instruction it got (the fixed part of the instruction names the task: data import, data fill, text suggestion, test). Nothing leaves the machine.
//   const { fake, startFake } = require('./fake-ai.js');
//   await startFake(3066);          // fake.mode = 'ok' | 'unauthorized' | 'announce'; fake.requests = the bodies that were sent
const http = require('http');

const fake = { mode: 'ok', requests: [], server: null };

const slot = (text, start, end) => { const a = text.indexOf(start); if (a < 0) { return ''; } const b = text.indexOf(end, a + start.length); return text.slice(a + start.length, b < 0 ? undefined : b); };

/** The canned answers: what the model "says" depends on the instruction it got (the fixed part names the task). */
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

function startFake(port) {
  return new Promise((resolve, reject) => {
    fake.server = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        const url = req.url.split('?')[0];
        const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
        if (req.method === 'GET' && url === '/v1/models') { return send(200, { data: [{ id: 'fake-model' }, { id: 'fake-model-2' }] }); }
        if (req.method === 'POST' && url === '/v1/chat/completions') {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          fake.requests.push(body);
          if (fake.mode === 'unauthorized') { return send(401, { error: { message: 'Incorrect API key provided' } }); }
          const norm = text => String(text || '').split(String.fromCharCode(13, 10)).join(String.fromCharCode(10));
          const system = norm(((body.messages || []).find(m => m.role === 'system') || {}).content);
          const user = norm(((body.messages || []).filter(m => m.role === 'user')[0] || {}).content);
          const content = fake.mode === 'announce' ? 'Ich schaue mir das gleich an.' : JSON.stringify(answer(system, user));
          return send(200, { choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }], usage: { prompt_tokens: Math.ceil((system.length + user.length) / 4), completion_tokens: Math.ceil(content.length / 4) } });
        }
        send(404, { error: { message: 'not found' } });
      });
    });
    fake.server.on('error', reject);
    fake.server.listen(port, '0.0.0.0', () => resolve());
  });
}

module.exports = { fake, startFake };
