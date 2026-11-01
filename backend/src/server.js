import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  CRITICAL_THRESHOLD, MAX_AUDIO_BYTES, MAX_DESCRIPTION, MAX_IMAGE_BYTES, NAGPUR, STATUSES,
} from './config.js';
import { HttpError, parseMultipart, sniff } from './multipart.js';
import { Store } from './store.js';
import { seedIfEmpty } from './seed.js';
import { analyzeReport as defaultAnalyze, validateTriage, FALLBACK } from './triage.js';
import { mockDispatch } from './dispatch.js';

const MSG = {
  bigPhoto: 'Please upload a smaller photo for this demo.',
  bigAudio: 'Voice note is too large. Keep it under 2 MB.',
  noIssue: 'No civic issue detected. Please take a clearer picture.',
  aiOffline: 'Triage engine offline, saving as Uncategorised.',
};
const MIME = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webm': 'audio/webm', '.ogg': 'audio/ogg' };

export function createServer(config, deps = {}) {
  const store = deps.store ?? new Store(config.dataDir);
  const analyze = deps.analyzeReport ?? defaultAnalyze;
  const log = deps.log ?? console.log;
  fs.mkdirSync(config.uploadDir, { recursive: true });
  if (config.seedDemoData) seedIfEmpty(store);

  const send = (res, status, body) => {
    const data = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data) });
    res.end(data);
  };

  const readBody = (req, limit) => new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let over = false;
    req.on('data', (c) => { size += c.length; if (size <= limit) chunks.push(c); else over = true; });
    req.on('end', () => (over ? reject(new HttpError(413, MSG.bigPhoto)) : resolve(Buffer.concat(chunks))));
    req.on('error', reject);
  });

  const readJson = async (req) => {
    const raw = await readBody(req, 20 * 1024);
    try { return JSON.parse(raw.toString('utf8') || '{}'); } catch { throw new HttpError(400, 'Body must be valid JSON.'); }
  };

  const toFeature = (r) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
    properties: r,
  });

  const withTimeout = (p, ms) => Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error('triage timeout')), ms)),
  ]);

  function saveMedia(file, ext) {
    const name = `${randomUUID()}.${ext}`; // original filenames are never stored
    fs.writeFileSync(path.join(config.uploadDir, name), file.data);
    return name;
  }

  async function createReport(req, res) {
    const body = await readBody(req, MAX_IMAGE_BYTES + MAX_AUDIO_BYTES + 256 * 1024);
    const { fields, files } = parseMultipart(body, req.headers['content-type']);
    const { image, audio } = files;

    if (!image || !image.data.length) throw new HttpError(400, 'A photo is required.');
    if (image.data.length > MAX_IMAGE_BYTES) throw new HttpError(413, MSG.bigPhoto);
    if (image.filename.toLowerCase() === 'not-an-issue.jpg') throw new HttpError(422, MSG.noIssue); // stub test trigger
    const imageKind = sniff(image.data);
    if (imageKind !== 'jpeg' && imageKind !== 'png') throw new HttpError(415, 'Photos must be JPEG or PNG.');

    let audioKind = null;
    if (audio && audio.data.length) {
      if (audio.data.length > MAX_AUDIO_BYTES) throw new HttpError(413, MSG.bigAudio);
      audioKind = sniff(audio.data);
      if (audioKind !== 'webm' && audioKind !== 'ogg') throw new HttpError(415, 'Voice notes must be WebM or OGG.');
    }

    const description = (fields.description || '').trim();
    if (!description) throw new HttpError(400, 'Please describe the problem in a few words.');
    if (description.length > MAX_DESCRIPTION) throw new HttpError(400, `Description must be ${MAX_DESCRIPTION} characters or fewer.`);

    // Location: real GPS, or manual neighbourhood -> hardcoded Nagpur coordinates.
    const neighbourhood = (fields.neighbourhood || '').trim().slice(0, 80) || null;
    let lat = Number(fields.lat);
    let lng = Number(fields.lng);
    const hasGps = fields.lat !== undefined && fields.lng !== undefined && fields.lat !== '' && fields.lng !== '';
    if (hasGps) {
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        throw new HttpError(400, 'Invalid coordinates.');
      }
    } else if (neighbourhood) {
      ({ lat, lng } = NAGPUR);
    } else {
      throw new HttpError(400, 'Location required. Share your location or enter a neighbourhood.');
    }

    // L1: save media -> AI -> validate -> insert
    const imageName = saveMedia(image, imageKind === 'png' ? 'png' : 'jpg');
    if (audioKind) saveMedia(audio, audioKind);

    let triage;
    let aiOffline = false;
    try {
      const raw = await withTimeout(analyze({ filename: image.filename, data: image.data }, audio ? { data: audio.data } : null, description), config.triageTimeoutMs);
      triage = validateTriage(raw);
    } catch (err) {
      log(`[triage] unavailable: ${err.message}`);
      aiOffline = true;
      triage = { ...FALLBACK, audio_text: null };
    }

    const critical = triage.severity >= CRITICAL_THRESHOLD;
    const report = store.insert({
      lat, lng,
      image_url: `/uploads/${imageName}`,
      audio_text: triage.audio_text,
      category: triage.category,
      severity: triage.severity,
      status: critical ? 'routed' : 'pending',
      title: triage.title,
      description,
      upvotes: 0,
      neighbourhood,
    });
    if (critical) mockDispatch(report, log); // L2

    if (aiOffline) return send(res, 503, { error: MSG.aiOffline, saved: true, report });
    return send(res, 201, { report });
  }

  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const { pathname } = url;
    const method = req.method;

    if (method === 'GET' && pathname === '/api/health') {
      return send(res, 200, { status: 'ok', triage_mode: config.triageMode, reports: store.items.length });
    }
    if (method === 'GET' && pathname === '/api/map-data') {
      const min = Number.parseInt(url.searchParams.get('min_severity') ?? '1', 10);
      const minSeverity = Number.isInteger(min) && min >= 1 && min <= 10 ? min : 1;
      return send(res, 200, { type: 'FeatureCollection', features: store.list({ minSeverity }).map(toFeature) });
    }
    if (method === 'GET' && pathname === '/api/reports') {
      return send(res, 200, { reports: store.list() });
    }
    if (method === 'POST' && pathname === '/api/reports') return createReport(req, res);

    const one = /^\/api\/reports\/([\w-]+)$/.exec(pathname);
    if (one && method === 'GET') {
      const r = store.get(one[1]);
      if (!r) throw new HttpError(404, 'Report not found.');
      return send(res, 200, { report: r });
    }
    if (one && method === 'PATCH') {
      const body = await readJson(req);
      if (!STATUSES.includes(body.status)) throw new HttpError(400, `status must be one of: ${STATUSES.join(', ')}.`);
      const r = store.update(one[1], { status: body.status });
      if (!r) throw new HttpError(404, 'Report not found.');
      return send(res, 200, { report: r });
    }

    const vote = /^\/api\/reports\/([\w-]+)\/upvote$/.exec(pathname);
    if (vote && (method === 'POST' || method === 'DELETE')) {
      const r = store.get(vote[1]);
      if (!r) throw new HttpError(404, 'Report not found.');
      const upvotes = Math.max(0, (r.upvotes ?? 0) + (method === 'POST' ? 1 : -1));
      return send(res, 200, { report: store.update(r.id, { upvotes }) });
    }

    if (method === 'POST' && pathname === '/api/dispatch') {
      const body = await readJson(req);
      const r = store.get(String(body.report_id ?? ''));
      if (!r) throw new HttpError(404, 'Report not found.');
      if (r.status === 'resolved') throw new HttpError(409, 'Report is already resolved.');
      if (r.severity < CRITICAL_THRESHOLD) throw new HttpError(422, `Only reports with severity >= ${CRITICAL_THRESHOLD} can be dispatched.`);
      const payload = mockDispatch(r, log);
      const updated = store.update(r.id, { status: 'routed' });
      return send(res, 200, { dispatched: true, mock: true, payload: { ...payload, report: updated } });
    }

    const up = /^\/uploads\/([\w-]+\.(?:jpg|png|webm|ogg))$/.exec(pathname);
    if (up && method === 'GET') {
      const file = path.join(config.uploadDir, up[1]);
      if (!fs.existsSync(file)) throw new HttpError(404, 'Not found.');
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)], 'X-Content-Type-Options': 'nosniff' });
      return fs.createReadStream(file).pipe(res);
    }

    throw new HttpError(404, 'Not found.');
  }

  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', config.corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    try {
      await handle(req, res);
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { error: err.message, ...err.extra });
      console.error(err);
      return send(res, 500, { error: 'Something went wrong on the server.' });
    }
  });
  server.store = store;
  return server;
}
