export function severityMeta(report) {
  const { severity, status } = report;
  if (status === 'resolved') return { label: 'Resolved', color: '#16a34a', cls: 'bg-green-100 text-green-800' };
  if (severity >= 8) return { label: 'Critical', color: '#ef4444', cls: 'bg-red-100 text-red-700' };
  if (severity >= 6) return { label: 'High', color: '#f97316', cls: 'bg-orange-100 text-orange-800' };
  if (severity >= 4) return { label: 'Moderate', color: '#eab308', cls: 'bg-yellow-100 text-yellow-800' };
  return { label: 'Low', color: '#06b6d4', cls: 'bg-cyan-100 text-cyan-800' };
}

export function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
