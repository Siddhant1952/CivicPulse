const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request(path, options) {
  let res;
  try {
    res = await fetch(BASE + path, options);
  } catch {
    throw new ApiError(0, 'Cannot reach the CivicPulse server. Is the backend running?', null);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body?.error || `Request failed (${res.status}).`, body);
  return body;
}

export const mediaUrl = (u) => (u ? (u.startsWith('http') ? u : BASE + u) : null);

export async function fetchReports(minSeverity = 1) {
  const data = await request(`/api/map-data?min_severity=${minSeverity}`);
  return data.features.map((f) => f.properties);
}
export const createReport = (formData) => request('/api/reports', { method: 'POST', body: formData });
export const setStatus = (id, status) =>
  request(`/api/reports/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
export const upvote = (id) => request(`/api/reports/${id}/upvote`, { method: 'POST' });
export const removeUpvote = (id) => request(`/api/reports/${id}/upvote`, { method: 'DELETE' });
