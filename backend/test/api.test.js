import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../src/config.js';
import { createServer } from '../src/server.js';
import { validateTriage } from '../src/triage.js';

const jpeg = (bytes) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(bytes - 4)]);
const webm = () => Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(1000)]);

let ctx;
async function start(overrides = {}, deps = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'civicpulse-'));
  const logs = [];
  const config = loadConfig({ DATA_DIR: dir, ...overrides });
  const server = createServer(config, { log: (m) => logs.push(m), ...deps });
  await new Promise((r) => server.listen(0, r));
  return { server, logs, dir, base: `http://localhost:${server.address().port}` };
}
const stop = (c) => new Promise((r) => { c.server.close(r); fs.rmSync(c.dir, { recursive: true, force: true }); });

function form({ name = 'photo.jpg', data = jpeg(2 * 1024 * 1024), lat, lng, neighbourhood, audio, description = 'Deep pothole near the junction' } = {}) {
  const fd = new FormData();
  if (description !== null) fd.append('description', description);
  fd.append('image', new File([data], name, { type: 'image/jpeg' }));
  if (audio) fd.append('audio', new File([audio], 'note.webm', { type: 'audio/webm' }));
  if (lat !== undefined) fd.append('lat', String(lat));
  if (lng !== undefined) fd.append('lng', String(lng));
  if (neighbourhood) fd.append('neighbourhood', neighbourhood);
  return fd;
}
const post = (base, fd) => fetch(`${base}/api/reports`, { method: 'POST', body: fd });

before(async () => { ctx = await start(); });
after(() => stop(ctx));

test('AC1: GET /api/map-data returns >= 3 GeoJSON points', async () => {
  const res = await fetch(`${ctx.base}/api/map-data`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.type, 'FeatureCollection');
  assert.ok(body.features.length >= 3);
  assert.equal(body.features[0].geometry.type, 'Point');
  for (const k of ['id', 'lat', 'lng', 'image_url', 'audio_text', 'category', 'severity', 'status']) {
    assert.ok(k in body.features[0].properties, `missing key ${k}`);
  }
});

test('AC2: valid 2 MB JPEG -> 201, Roads/8, routed, appears on the map, mock-dispatched', async () => {
  const res = await post(ctx.base, form({ lat: 21.15, lng: 79.09, audio: webm() }));
  assert.equal(res.status, 201);
  const { report } = await res.json();
  assert.equal(report.category, 'Roads');
  assert.equal(report.severity, 8);
  assert.equal(report.status, 'routed');
  assert.match(report.image_url, /^\/uploads\/[\w-]+\.jpg$/);
  assert.ok(ctx.logs.some((l) => l.includes('[MOCK DISPATCH]') && l.includes(report.id)));
  const map = await (await fetch(`${ctx.base}/api/map-data?min_severity=8`)).json();
  assert.ok(map.features.some((f) => f.properties.id === report.id));
  const img = await fetch(ctx.base + report.image_url);
  assert.equal(img.status, 200);
});

test('AC3: manual neighbourhood saves with the Nagpur coordinates', async () => {
  const res = await post(ctx.base, form({ neighbourhood: 'Dharampeth' }));
  assert.equal(res.status, 201);
  const { report } = await res.json();
  assert.equal(report.lat, 21.1458);
  assert.equal(report.lng, 79.0882);
  assert.equal(report.neighbourhood, 'Dharampeth');
});

test('no GPS and no neighbourhood -> 400 Location required', async () => {
  const res = await post(ctx.base, form());
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /Location required/);
});

test('photo over 5 MB -> 413 with the demo message', async () => {
  const res = await post(ctx.base, form({ data: jpeg(5 * 1024 * 1024 + 10), lat: 1, lng: 1 }));
  assert.equal(res.status, 413);
  assert.equal((await res.json()).error, 'Please upload a smaller photo for this demo.');
});

test('not-an-issue.jpg -> 422 and nothing is saved', async () => {
  const before = ctx.server.store.items.length;
  const res = await post(ctx.base, form({ name: 'not-an-issue.jpg', lat: 1, lng: 1 }));
  assert.equal(res.status, 422);
  assert.equal((await res.json()).error, 'No civic issue detected. Please take a clearer picture.');
  assert.equal(ctx.server.store.items.length, before);
});

test('non-image upload -> 415', async () => {
  const res = await post(ctx.base, form({ data: Buffer.from('hello world'), lat: 1, lng: 1 }));
  assert.equal(res.status, 415);
});

test('AI outage -> 503, report still saved as Uncategorised / 1 / pending', async () => {
  const res = await post(ctx.base, form({ name: 'ai-timeout.jpg', lat: 21.1, lng: 79.1 }));
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.error, 'Triage engine offline, saving as Uncategorised.');
  assert.equal(body.saved, true);
  assert.equal(body.report.category, 'Uncategorised');
  assert.equal(body.report.severity, 1);
  assert.equal(body.report.status, 'pending');
});

test('AI that hangs is cut off by the timeout', async () => {
  const c = await start({ TRIAGE_TIMEOUT_MS: '50' }, { analyzeReport: () => new Promise(() => {}) });
  try {
    const res = await post(c.base, form({ lat: 1, lng: 1 }));
    assert.equal(res.status, 503);
    assert.equal((await res.json()).report.severity, 1);
  } finally { await stop(c); }
});

test('PATCH marks resolved; bad status 400; unknown id 404', async () => {
  const { reports } = await (await fetch(`${ctx.base}/api/reports`)).json();
  const id = reports[0].id;
  const ok = await fetch(`${ctx.base}/api/reports/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'resolved' }) });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).report.status, 'resolved');
  const bad = await fetch(`${ctx.base}/api/reports/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'nope' }) });
  assert.equal(bad.status, 400);
  const missing = await fetch(`${ctx.base}/api/reports/does-not-exist`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'resolved' }) });
  assert.equal(missing.status, 404);
});

test('POST /api/dispatch: logs severity >= 8, rejects lower severity', async () => {
  const { reports } = await (await fetch(`${ctx.base}/api/reports`)).json();
  const high = reports.find((r) => r.severity >= 8 && r.status !== 'resolved');
  const low = reports.find((r) => r.severity < 8 && r.status !== 'resolved');
  const post1 = (report_id) => fetch(`${ctx.base}/api/dispatch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ report_id }) });
  const ok = await post1(high.id);
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).mock, true);
  assert.equal((await post1(low.id)).status, 422);
});

test('validateTriage enforces the schema and falls back safely (L3/L4)', () => {
  assert.deepEqual(validateTriage({ category: 'Water', severity: 4, title: 'Leak' }), { category: 'Water', severity: 4, title: 'Leak', audio_text: null });
  for (const bad of [null, 'x', { category: 'Roads', severity: 11 }, { category: 'Roads', severity: 5.5 }, { category: 'Bridges', severity: 5 }, { category: 'Roads', severity: 9, confidence: 0.2 }]) {
    const out = validateTriage(bad);
    assert.equal(out.category, 'Uncategorised');
    assert.equal(out.severity, 1);
  }
});

test('description is required (400) and stored on the report', async () => {
  const missing = await post(ctx.base, form({ description: '   ', lat: 1, lng: 1 }));
  assert.equal(missing.status, 400);
  assert.match((await missing.json()).error, /describe the problem/i);
  const tooLong = await post(ctx.base, form({ description: 'x'.repeat(501), lat: 1, lng: 1 }));
  assert.equal(tooLong.status, 400);
  const ok = await post(ctx.base, form({ description: '  Water pooling on the road  ', lat: 1, lng: 1 }));
  const { report } = await ok.json();
  assert.equal(report.description, 'Water pooling on the road');
  assert.equal(report.upvotes, 0);
});

test('upvote adds one, undo removes one, never below zero, 404 for unknown id', async () => {
  const { reports } = await (await fetch(`${ctx.base}/api/reports`)).json();
  const { id, upvotes } = reports[0];
  const up = await fetch(`${ctx.base}/api/reports/${id}/upvote`, { method: 'POST' });
  assert.equal((await up.json()).report.upvotes, upvotes + 1);
  const down = await fetch(`${ctx.base}/api/reports/${id}/upvote`, { method: 'DELETE' });
  assert.equal((await down.json()).report.upvotes, upvotes);
  const fresh = (await (await post(ctx.base, form({ lat: 1, lng: 1 }))).json()).report;
  const floor = await fetch(`${ctx.base}/api/reports/${fresh.id}/upvote`, { method: 'DELETE' });
  assert.equal((await floor.json()).report.upvotes, 0);
  assert.equal((await fetch(`${ctx.base}/api/reports/nope/upvote`, { method: 'POST' })).status, 404);
});
