import { CATEGORIES } from './config.js';

export const FALLBACK = Object.freeze({ category: 'Uncategorised', severity: 1, title: 'Unclassified report' });

export class TriageUnavailableError extends Error {}

/**
 * AI boundary (placeholder). Receives media, returns a plain object - it NEVER touches the DB (L4).
 *
 * Inputs: `image`, `audio` (optional) and `description` (the citizen's typed text).
 *
 * TODO(manual): transcribe `audio` (native-language voice note) and put the text in `audio_text`.
 * TODO(manual): call the Gemini multimodal API with `image` + transcript + `description`, request JSON
 *               { category, severity, confidence, title } and return it. Read the key from
 *               process.env.GEMINI_API_KEY; never hardcode it.
 * TODO(manual): map API timeouts/5xx to `throw new TriageUnavailableError()`.
 *
 * Stub behaviour: deterministic { category: "Roads", severity: 8 }.
 * Demo hook: an image named `ai-timeout.jpg` simulates an AI outage.
 */
export async function analyzeReport(image, audio, description = '') {
  if (image?.filename?.toLowerCase() === 'ai-timeout.jpg') {
    throw new TriageUnavailableError('Simulated triage outage');
  }
  void audio;
  void description;
  return { category: 'Roads', severity: 8, confidence: 0.9, title: 'Road damage reported', audio_text: null };
}

// L3 + L4: accept only a well-formed result; anything doubtful becomes Uncategorised / 1.
export function validateTriage(raw) {
  const fallback = { ...FALLBACK, audio_text: null };
  try {
    if (!raw || typeof raw !== 'object') return fallback;
    const { category, severity, confidence } = raw;
    const sevOk = Number.isInteger(severity) && severity >= 1 && severity <= 10;
    const catOk = CATEGORIES.includes(category) && category !== 'Uncategorised';
    const confOk = confidence === undefined || (typeof confidence === 'number' && confidence >= 0.5);
    if (!sevOk || !catOk || !confOk) return fallback;
    const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 100) : `${category} issue reported`;
    const audio_text = typeof raw.audio_text === 'string' ? raw.audio_text.slice(0, 2000) : null;
    return { category, severity, title, audio_text };
  } catch {
    return fallback;
  }
}
