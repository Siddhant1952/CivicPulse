const env = import.meta.env;

// CARTO basemaps need a free key (https://carto.com/basemaps/apikey), sent as ?key=... on each tile URL.
// CARTO paths are case-sensitive; the replace repairs `.env` files from the first release (rasterTiles).
const BASE = (env.VITE_MAP_TILE_URL || 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png').replace('/rasterTiles/', '/rastertiles/');
const KEY = (env.VITE_MAP_API_KEY || '').trim();
const needsKey = /cartocdn\.com/.test(BASE) && !/[?&]key=/.test(BASE);

export const MAP = {
  tileUrl: KEY && needsKey ? `${BASE}${BASE.includes('?') ? '&' : '?'}key=${encodeURIComponent(KEY)}` : BASE,
  missingKey: needsKey && !KEY,
  attribution: env.VITE_MAP_ATTRIBUTION || '© OpenStreetMap contributors © CARTO',
  center: [Number(env.VITE_MAP_CENTER_LAT) || 21.1458, Number(env.VITE_MAP_CENTER_LNG) || 79.0882],
  zoom: Number(env.VITE_MAP_ZOOM) || 13,
};
