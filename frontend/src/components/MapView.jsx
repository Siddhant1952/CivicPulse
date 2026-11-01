import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { Filter } from 'lucide-react';
import { severityMeta } from '../lib.js';
import { MAP } from '../mapConfig.js';

const LEGEND = [
  ['#ef4444', 'Critical 8–10'],
  ['#f97316', 'High 6–7'],
  ['#eab308', 'Moderate 4–5'],
  ['#06b6d4', 'Low 1–3'],
  ['#16a34a', 'Resolved'],
];

function Resizer({ expanded }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 350); // after the height transition
    return () => clearTimeout(t);
  }, [expanded, map]);
  return null;
}

export default function MapView({ reports, expanded, criticalOnly, onToggleCritical }) {
  const [tileError, setTileError] = useState(false);
  return (
    <div className="relative flex-1 overflow-hidden rounded-3xl border border-white/70 bg-white/40 shadow-lg">
      <MapContainer center={MAP.center} zoom={MAP.zoom} className="absolute inset-0" zoomControl={false}>
        <TileLayer
          url={MAP.tileUrl}
          attribution={MAP.attribution}
          subdomains="abcd"
          maxZoom={20}
          eventHandlers={{ tileerror: () => setTileError(true), tileload: () => setTileError(false) }}
        />
        <Resizer expanded={expanded} />
        {reports.map((r) => {
          const meta = severityMeta(r);
          return (
            <CircleMarker
              key={r.id}
              center={[r.lat, r.lng]}
              radius={r.severity >= 8 && r.status !== 'resolved' ? 13 : 10}
              pathOptions={{ color: '#ffffff', weight: 3, fillColor: meta.color, fillOpacity: 0.95 }}
            >
              <Popup>
                <div className="min-w-[140px]">
                  <div className="text-xs font-semibold text-purple-700">{r.category}</div>
                  <div className="text-sm font-bold leading-snug">{r.title}</div>
                  <div className="mt-1 text-xs">Severity {r.severity}/10 · {meta.label}</div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {MAP.missingKey && (
        <p role="alert" className="absolute inset-x-3 top-14 z-[1000] rounded-2xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white shadow">
          CARTO needs a free map key. Add VITE_MAP_API_KEY to frontend/.env and restart the dev server.
        </p>
      )}

      {tileError && !MAP.missingKey && (
        <p role="alert" className="absolute inset-x-3 top-14 z-[1000] rounded-2xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white shadow">
          Map tiles could not load. Check your internet connection, VITE_MAP_API_KEY and VITE_MAP_TILE_URL in frontend/.env.
        </p>
      )}

      <button
        onClick={onToggleCritical}
        aria-pressed={criticalOnly}
        className={`absolute left-3 top-3 z-[1000] flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
          criticalOnly ? 'bg-red-500 text-white shadow' : 'glass'
        }`}
      >
        <Filter size={13} />
        Severity ≥ 8
      </button>

      {expanded && (
        <ul className="glass absolute bottom-3 left-3 z-[1000] space-y-1 rounded-2xl px-3 py-2 text-xs font-medium">
          {LEGEND.map(([c, l]) => (
            <li key={l} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
              {l}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
