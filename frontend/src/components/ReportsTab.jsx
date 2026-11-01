import { useState } from 'react';
import { Braces, CheckCircle2, Droplets, Loader2, MapPin, Route, ThumbsUp, Trash2, Zap, HelpCircle } from 'lucide-react';
import { mediaUrl } from '../api.js';
import { severityMeta, timeAgo } from '../lib.js';

const ICONS = { Water: Droplets, Roads: Route, Electricity: Zap, Sanitation: Trash2, Uncategorised: HelpCircle };

function Item({ r, onResolve, upvoted, onUpvote }) {
  const [showJson, setShowJson] = useState(false);
  const meta = severityMeta(r);
  const Icon = ICONS[r.category] || HelpCircle;
  const img = mediaUrl(r.image_url);
  return (
    <li className="glass rounded-3xl p-3">
      <div className="flex gap-3">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-100 to-purple-100 text-purple-700">
          {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <Icon size={26} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${meta.cls}`}>
              {meta.label} · {r.severity}
            </span>
            <span className="text-xs font-semibold text-purple-800">{r.category}</span>
          </div>
          <p className="mt-1 truncate text-sm font-bold">{r.title}</p>
          {r.description && <p className="line-clamp-2 text-xs text-slate-700">{r.description}</p>}
          <p className="flex items-center gap-1 text-xs text-slate-600">
            <MapPin size={12} />
            {r.neighbourhood || `${r.lat.toFixed(3)}, ${r.lng.toFixed(3)}`} · {timeAgo(r.created_at)}
            {r.status === 'routed' && ' · routed (mock)'}
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => onUpvote(r.id)}
          aria-pressed={upvoted}
          aria-label={`${upvoted ? 'Remove upvote from' : 'Upvote'} ${r.title}`}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
            upvoted ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow' : 'bg-white/70 text-purple-900'
          }`}
        >
          <ThumbsUp size={14} /> {upvoted ? 'Upvoted' : 'Same problem'} · {r.upvotes ?? 0}
        </button>
        <span className="flex-1" />
        <button
          onClick={() => setShowJson((v) => !v)}
          aria-expanded={showJson}
          className="flex items-center gap-1 rounded-full bg-white/70 px-3 py-1.5 text-xs font-semibold text-purple-900 outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
        >
          <Braces size={14} /> {showJson ? 'Hide JSON' : 'View JSON'}
        </button>
        {r.status !== 'resolved' && (
          <button
            onClick={() => onResolve(r.id)}
            className="flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <CheckCircle2 size={14} /> Resolve
          </button>
        )}
      </div>
      {showJson && (
        <pre className="mt-2 max-h-48 overflow-auto rounded-2xl bg-slate-900 p-3 text-[11px] leading-relaxed text-cyan-100">
          {JSON.stringify(r, null, 2)}
        </pre>
      )}
    </li>
  );
}

export default function ReportsTab({ reports, loading, error, criticalOnly, onResolve, onRetry, upvoted, onUpvote }) {
  const [sort, setSort] = useState('new');
  if (loading) {
    return (
      <p className="flex items-center justify-center gap-2 py-10 text-sm font-medium text-purple-900/70">
        <Loader2 className="animate-spin" size={18} /> Loading incidents…
      </p>
    );
  }
  if (error) {
    return (
      <div className="glass rounded-3xl p-5 text-center text-sm">
        <p className="font-semibold text-red-700">{error}</p>
        <button onClick={onRetry} className="mt-3 rounded-full bg-purple-600 px-4 py-2 text-xs font-bold text-white">Try again</button>
      </div>
    );
  }
  if (!reports.length) {
    return (
      <div className="glass rounded-3xl p-6 text-center text-sm text-purple-950/80">
        {criticalOnly ? 'No critical incidents right now. Turn off the severity filter to see everything.' : 'No incidents yet. Open the Capture tab to file the first one.'}
      </div>
    );
  }
  const list = sort === 'top' ? [...reports].sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0)) : reports;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-xs font-medium text-purple-950/80">Seen the same problem? Upvote it instead of reporting it again.</p>
        <div className="flex shrink-0 gap-1" role="group" aria-label="Sort reports">
          {[['new', 'Newest'], ['top', 'Top']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSort(id)}
              aria-pressed={sort === id}
              className={`rounded-full px-2.5 py-1 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                sort === id ? 'bg-purple-600 text-white' : 'glass text-purple-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <ul className="space-y-3">
        {list.map((r) => <Item key={r.id} r={r} onResolve={onResolve} upvoted={upvoted.has(r.id)} onUpvote={onUpvote} />)}
      </ul>
    </div>
  );
}
