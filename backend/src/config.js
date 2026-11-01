import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const CATEGORIES = ['Water', 'Roads', 'Electricity', 'Sanitation', 'Uncategorised'];
export const STATUSES = ['pending', 'routed', 'resolved'];
export const CRITICAL_THRESHOLD = 8;
export const NAGPUR = { lat: 21.1458, lng: 79.0882 };
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
export const MAX_DESCRIPTION = 500;

export function loadConfig(env = process.env) {
  const dataDir = path.resolve(root, env.DATA_DIR || 'data');
  return {
    port: Number(env.PORT || 4000),
    dataDir,
    uploadDir: path.join(dataDir, 'uploads'),
    corsOrigin: env.CORS_ORIGIN || 'http://localhost:5173',
    triageMode: env.TRIAGE_MODE || 'stub',
    triageTimeoutMs: Number(env.TRIAGE_TIMEOUT_MS || 8000),
    seedDemoData: env.SEED_DEMO_DATA !== 'false',
    geminiApiKey: env.GEMINI_API_KEY || '', // never logged, never returned
  };
}
