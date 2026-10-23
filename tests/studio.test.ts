import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODELS, MODEL_IDS, normalizeSettings, validatePrompt } from '../src/lib/models';
import { PRESETS } from '../src/lib/presets';
import { persistedSongs, type Song } from '../src/lib/storage';
import { signTicket, verifyTicket, validMediaUrl } from '../src/lib/tickets';
import { POST as generate } from '../src/app/api/generate/route';
import { POST as promptWriter } from '../src/app/api/prompt/route';
import { GET as status } from '../src/app/api/status/route';
import { GET as download } from '../src/app/api/download/route';

process.env.PIXAZO_API_KEY = 'test-pixazo-not-a-real-key';
process.env.ZAI_API_KEY = 'test-zai-not-a-real-key';
const realFetch = globalThis.fetch;
const req = (path: string, body: unknown) => new Request(`http://localhost/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('24 detailed presets fit the strictest model prompt limit', () => {
  assert.equal(PRESETS.length, 24);
  assert.equal(new Set(PRESETS.map(p => p.id)).size, 24);
  for (const p of PRESETS) {
    assert.ok(p.prompt.length > 400, p.name);
    assert.ok(/instrumental/i.test(p.prompt));
    for (const model of MODEL_IDS) assert.equal(validatePrompt(model, p.prompt), p.prompt);
  }
});
test('MiniMax audio settings and conditional lyric modes enforce the documented contract', () => {
  const input = { ...MODELS['minimax-music-3-0'].defaults, lyrics: 'ignored', duration: 99, is_instrumental: true };
  const value = normalizeSettings('minimax-music-3-0', input);
  assert.equal(value.is_instrumental, true); assert.ok(!('lyrics' in value)); assert.ok(!('duration' in value));
  assert.throws(() => normalizeSettings('minimax-music-3-0', { ...input, sample_rate: 48000 }));
  assert.throws(() => normalizeSettings('minimax-music-3-0', { ...input, is_instrumental: false, lyrics: '' }));
  const auto = normalizeSettings('minimax-music-3-0', { ...input, is_instrumental: false, lyrics_optimizer: true });
  assert.ok(!('lyrics' in auto));
});
test('Mureka exposes all four versions and never sends unsupported settings', () => {
  for (const version of ['mureka-7.6', 'mureka-8', 'mureka-9', 'mureka-9.5']) assert.deepEqual(normalizeSettings('mureka-instrumental', { model: version, duration: 10, sync_mode: true }), { model: version, sync_mode: false });
});
test('Stable Audio preserves all controls and rejects bad types and ranges', () => {
  const defaults = MODELS['stable-audio-3-small-music-text-to-audio'].defaults;
  const value = normalizeSettings('stable-audio-3-small-music-text-to-audio', { ...defaults, seed: 123, duration: 380, guidance_scale: 25, num_inference_steps: 100, sync_mode: true, output_format: 'flac' });
  assert.equal(value.seed, 123); assert.equal(value.duration, 380); assert.equal(value.sync_mode, true);
  assert.ok(!('seed' in normalizeSettings('stable-audio-3-small-music-text-to-audio', defaults)));
  for (const bad of [{ duration: 381 }, { num_inference_steps: 1.5 }, { enable_safety_checker: 'false' }, { seed: NaN }]) assert.throws(() => normalizeSettings('stable-audio-3-small-music-text-to-audio', { ...defaults, ...bad }));
});
test('prompt whitespace remains exact and downloaded tracks leave persistence', () => {
  assert.equal(validatePrompt('minimax-music-3-0', '  Same prompt.\n'), '  Same prompt.\n');
  const songs = [{ id: 'a' }, { id: 'b', downloaded: true }] as Song[];
  assert.deepEqual(persistedSongs(songs), [songs[0]]);
});
test('signed job and audio references reject tampering and arbitrary hosts', () => {
  const ticket = signTicket({ kind: 'job', id: 'mureka-instrumental_123' });
  assert.equal(verifyTicket(ticket, 'job').kind, 'job');
  assert.throws(() => verifyTicket(ticket + 'z', 'job'));
  assert.throws(() => verifyTicket(ticket, 'audio'));
  assert.equal(validMediaUrl('https://example.com/a.mp3'), false);
  assert.equal(validMediaUrl('http://localhost/audio.mp3'), false);
  assert.equal(validMediaUrl('https://pub-example.r2.dev/audio.mp3'), true);
});
test('all three generate routes use documented endpoints, server headers, and exact prompts', async () => {
  try {
    for (const model of MODEL_IDS) {
      let called = false;
      globalThis.fetch = async (input, init) => {
        called = true; assert.equal(String(input), `https://gateway.pixazo.ai${MODELS[model].endpoint}`);
        assert.equal((init!.headers as Record<string, string>)['Ocp-Apim-Subscription-Key'], process.env.PIXAZO_API_KEY);
        assert.equal(JSON.parse(init!.body as string).prompt, '  Exact original prompt.\n');
        return Response.json({ request_id: `${model}_test`, status: 'QUEUED' }, { status: 202 });
      };
      const result = await generate(req('generate', { model, settings: MODELS[model].defaults, prompt: '  Exact original prompt.\n' }));
      assert.equal(result.status, 200); const data = await result.json(); assert.equal(data.status, 'QUEUED'); assert.ok(data.ticket); assert.ok(called); assert.ok(!JSON.stringify(data).includes(process.env.PIXAZO_API_KEY!));
    }
  } finally { globalThis.fetch = realFetch; }
});
test('polling normalizes completion and download streams an attachment', async () => {
  try {
    globalThis.fetch = async () => Response.json({ status: 'COMPLETED', output: { media_url: ['https://pub-test.r2.dev/output.wav'], media_type: 'audio/wav' } });
    const result = await status(new Request(`http://localhost/api/status?ticket=${signTicket({ kind: 'job', id: 'test_123' })}`));
    const data = await result.json(); assert.equal(data.status, 'COMPLETED'); assert.ok(data.downloadTicket);
    globalThis.fetch = async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'audio/wav' } });
    const file = await download(new Request(`http://localhost/api/download?ticket=${data.downloadTicket}&name=Test`));
    assert.equal(file.status, 200); assert.equal(file.headers.get('content-disposition'), 'attachment; filename="Test.wav"'); assert.equal((await file.arrayBuffer()).byteLength, 3);
  } finally { globalThis.fetch = realFetch; }
});
test('synchronous audio and provider errors normalize without exposing credentials', async () => {
  try {
    globalThis.fetch = async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'audio/mpeg' } });
    const body = { model: MODEL_IDS[2], settings: { ...MODELS[MODEL_IDS[2]].defaults, sync_mode: true }, prompt: 'instrumental' };
    const data = await (await generate(req('generate', body))).json(); assert.equal(data.status, 'COMPLETED'); assert.match(data.audioUrl, /^data:audio\/mpeg;base64,/);
    globalThis.fetch = async () => Response.json({ message: `failure ${process.env.PIXAZO_API_KEY}` }, { status: 402 });
    const fail = await generate(req('generate', body)); assert.equal(fail.status, 402); assert.ok(!(await fail.text()).includes(process.env.PIXAZO_API_KEY!));
  } finally { globalThis.fetch = realFetch; }
});
test('AI mode sets GLM 5.3 Flash to high reasoning and omits tools when search is off', async () => {
  try {
    globalThis.fetch = async (url, init) => {
      assert.ok(String(url).endsWith('/chat/completions'));
      const body = JSON.parse(init!.body as string); assert.equal(body.model, 'glm-5.3-flash'); assert.equal(body.reasoning_effort, 'high'); assert.ok(!body.tools);
      return Response.json({ choices: [{ message: { role: 'assistant', content: PRESETS[0].prompt }, finish_reason: 'stop' }] });
    };
    const result = await promptWriter(req('prompt', { model: MODEL_IDS[0], description: 'City pop tennis', webSearch: false }));
    assert.equal(result.status, 200); assert.equal((await result.json()).prompt, PRESETS[0].prompt);
  } finally { globalThis.fetch = realFetch; }
});
test('AI web search executes function calls and preserves returned reasoning across the tool loop', async () => {
  let chats = 0, searches = 0;
  try {
    globalThis.fetch = async (url, init) => {
      const body = JSON.parse(init!.body as string);
      if (String(url).endsWith('/web_search')) { searches++; assert.equal(body.search_engine, 'search-prime'); return Response.json({ search_result: [{ title: 'Genre', content: 'Syncopated bass.' }] }); }
      chats++;
      if (chats === 1) { assert.equal(body.tools[0].function.name, 'web_search'); return Response.json({ choices: [{ message: { role: 'assistant', content: null, reasoning_content: 'provider reasoning', tool_calls: [{ id: 'tool-1', type: 'function', function: { name: 'web_search', arguments: '{"query":"city pop instrumentation"}' } }] } }] }); }
      assert.equal(body.messages[2].reasoning_content, 'provider reasoning'); assert.equal(body.messages[3].role, 'tool');
      return Response.json({ choices: [{ message: { content: PRESETS[0].prompt }, finish_reason: 'stop' }] });
    };
    const result = await promptWriter(req('prompt', { model: MODEL_IDS[0], description: 'City pop tennis', webSearch: true }));
    assert.equal(result.status, 200); assert.equal((await result.json()).searches, 1); assert.equal(chats, 2); assert.equal(searches, 1);
  } finally { globalThis.fetch = realFetch; }
});
test('cross-origin submissions and unsupported models fail before a provider call', async () => {
  const result = await generate(new Request('http://localhost/api/generate', { method: 'POST', headers: { origin: 'https://other.example' }, body: '{}' }));
  assert.equal(result.status, 403);
  assert.equal((await generate(req('generate', { model: 'not-real' }))).status, 400);
});
