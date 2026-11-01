import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, List, Map as MapIcon, Camera, X } from 'lucide-react';
import MapView from './components/MapView.jsx';
import CaptureTab from './components/CaptureTab.jsx';
import ReportsTab from './components/ReportsTab.jsx';
import Logo from './components/Logo.jsx';
import { fetchReports, removeUpvote, setStatus, upvote } from './api.js';

const VOTE_KEY = 'civicpulse:upvoted';
const loadVotes = () => {
  try { return new Set(JSON.parse(localStorage.getItem(VOTE_KEY) || '[]')); } catch { return new Set(); }
};

const TABS = [
  { id: 'capture', label: 'Capture', Icon: Camera },
  { id: 'reports', label: 'Reports', Icon: List },
  { id: 'map', label: 'Map', Icon: MapIcon },
];
const TOAST_STYLE = {
  error: 'bg-red-600 text-white',
  warn: 'bg-amber-500 text-white',
  success: 'bg-emerald-600 text-white',
};

export default function App() {
  const [tab, setTab] = useState('capture');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [upvoted, setUpvoted] = useState(loadVotes);

  const dismiss = (id) => setToasts((t) => t.filter((x) => x.id !== id));
  const notify = useCallback((kind, text) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, kind, text }]);
    if (kind === 'success') setTimeout(() => dismiss(id), 4000);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setReports(await fetchReports(criticalOnly ? 8 : 1));
      setLoadError(null);
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, [criticalOnly]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000); // "live" feed
    return () => clearInterval(t);
  }, [refresh]);

  async function resolve(id) {
    try {
      await setStatus(id, 'resolved');
      notify('success', 'Marked as resolved.');
      refresh();
    } catch (e) {
      notify('error', e.message);
    }
  }

  async function toggleUpvote(id) {
    const had = upvoted.has(id);
    try {
      await (had ? removeUpvote(id) : upvote(id));
      const next = new Set(upvoted);
      if (had) next.delete(id); else next.add(id);
      setUpvoted(next);
      try { localStorage.setItem(VOTE_KEY, JSON.stringify([...next])); } catch { /* storage unavailable */ }
      refresh();
    } catch (e) {
      notify('error', e.message);
    }
  }

  const mapOnly = tab === 'map';

  return (
    <div className="mx-auto flex h-[100dvh] max-w-md flex-col">
      <header className="flex items-center justify-between px-4 pb-2 pt-3">
        <div className="flex items-center gap-2">
          <Logo size={34} />
          <h1 className="bg-gradient-to-r from-cyan-600 to-purple-700 bg-clip-text text-xl font-extrabold tracking-tight text-transparent">CivicPulse</h1>
        </div>
        <span className="text-xs font-semibold text-purple-900/70">Nagpur</span>
      </header>

      <section className={`relative flex min-h-[220px] px-3 transition-[flex-basis] duration-300 ${mapOnly ? 'shrink grow basis-0' : 'shrink-0 grow-0 basis-[40%]'}`}>
        <MapView
          reports={reports}
          expanded={mapOnly}
          criticalOnly={criticalOnly}
          onToggleCritical={() => setCriticalOnly((v) => !v)}
        />
      </section>

      {!mapOnly && (
        <main className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-3">
          {tab === 'capture' && <CaptureTab notify={notify} onSubmitted={refresh} />}
          {tab === 'reports' && (
            <ReportsTab
              reports={reports}
              loading={loading}
              error={loadError}
              criticalOnly={criticalOnly}
              onResolve={resolve}
              onRetry={refresh}
              upvoted={upvoted}
              onUpvote={toggleUpvote}
            />
          )}
        </main>
      )}

      <nav className="glass mx-3 mb-3 mt-2 flex rounded-3xl p-1.5" aria-label="Primary">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-current={tab === id ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 text-xs font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-purple-500 ${
              tab === id ? 'bg-gradient-to-br from-cyan-400 to-purple-500 text-white shadow' : 'text-purple-950/70'
            }`}
          >
            <Icon size={20} />
            {label}
          </button>
        ))}
      </nav>

      <div className="pointer-events-none fixed inset-x-0 top-3 z-[2000] mx-auto flex max-w-md flex-col gap-2 px-3" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`pointer-events-auto flex items-start gap-2 rounded-2xl px-4 py-3 text-sm font-medium shadow-lg ${TOAST_STYLE[t.kind]}`}>
            {t.kind === 'success' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0" />}
            <span className="flex-1">{t.text}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="rounded p-0.5 hover:bg-white/20">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
