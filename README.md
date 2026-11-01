# CivicPulse

Mobile-first web app where citizens report local infrastructure problems with a photo, an optional voice note and a location. A triage step scores severity (1–10) and picks a department category, high-severity reports are **mock-dispatched** (terminal log only), and everything appears on a public map and feed.

- **Backend** (`backend/`): JSON API on Node's built-in `http`. **Zero npm dependencies.** Reports persist to `backend/data/reports.json`, uploads to `backend/data/uploads/`.
- **Frontend** (`frontend/`): React 18 + Vite + Tailwind + lucide-react + react-leaflet (CARTO Voyager tiles).

## Prerequisites

- Node.js **22.9 or newer** (the backend uses `--env-file-if-exists` and global `fetch`/`FormData`)
- npm 10+ and internet access for the frontend install, fonts and map tiles

## Run locally

Two terminals:

```bash
# 1) API  -> http://localhost:4000   (seeds 5 demo reports on first start)
cd backend
cp .env.example .env     # a ready-to-use .env is already included
npm start
```

```bash
# 2) UI   -> http://localhost:5173   (proxies /api and /uploads to the API)
cd frontend
cp .env.example .env     # a ready-to-use .env is already included
npm install
npm run dev
```

Open http://localhost:5173 on your phone (same network, `npm run dev -- --host`) or in a desktop browser with device emulation. Camera/microphone/GPS need `localhost` or HTTPS.

## Test and build

```bash
cd backend  && npm test          # 14 tests covering AC1-AC3, description, upvotes and all error paths
cd frontend && npm run build     # production build (AC4)
```

## Map setup

The map uses `leaflet` + `react-leaflet`, both listed in `frontend/package.json`, so `npm install` is the whole installation (Leaflet's CSS is imported in `src/main.jsx`). The default tiles are CARTO Voyager, which need **no account and no API key**. To use another tile provider, change `VITE_MAP_TILE_URL` and `VITE_MAP_ATTRIBUTION` in `frontend/.env` (and add the provider's key to the URL if it needs one). `VITE_MAP_CENTER_LAT/LNG` and `VITE_MAP_ZOOM` set the starting view.

## Configuration (all defaults are filled in `.env.example`)

Two values are blank on purpose: `GEMINI_API_KEY` is a secret (only needed after the manual Gemini wiring), and `VITE_API_BASE_URL` stays empty in development because the Vite proxy handles API calls.


| Variable | Where | Default | Purpose |
|---|---|---|---|
| `PORT` | backend | `4000` | API port |
| `DATA_DIR` | backend | `backend/data` | JSON store + uploads |
| `CORS_ORIGIN` | backend | `http://localhost:5173` | Allowed browser origin |
| `TRIAGE_MODE` | backend | `stub` | Only `stub` exists today |
| `TRIAGE_TIMEOUT_MS` | backend | `8000` | AI call timeout |
| `SEED_DEMO_DATA` | backend | `true` | Seed demo reports when the store is empty |
| `GEMINI_API_KEY` | backend | – | Reserved for the manual Gemini wiring |
| `VITE_API_BASE_URL` | frontend | empty | API origin when not using the dev proxy |
| `VITE_DEV_PROXY_TARGET` | frontend | `http://localhost:4000` | Dev proxy target |
| `VITE_MAP_TILE_URL` / `VITE_MAP_ATTRIBUTION` | frontend | CARTO Voyager | Map tiles and credit |
| `VITE_MAP_CENTER_LAT` / `_LNG` / `VITE_MAP_ZOOM` | frontend | Nagpur, 13 | Initial map view |

## API

All JSON keys follow the spec schema: `id, lat, lng, image_url, audio_text, category, severity, status` (plus `title`, `description`, `upvotes`, `neighbourhood`, `created_at`).

| Method & path | Description |
|---|---|
| `POST /api/reports` | multipart: `image` (JPEG/PNG ≤ 5 MB, required), `description` (required, ≤ 500 chars), `audio` (WebM/OGG ≤ 2 MB), `lat`+`lng` **or** `neighbourhood`. → `201 {report}` |
| `GET /api/map-data[?min_severity=8]` | GeoJSON `FeatureCollection`; each feature's `properties` is the full report |
| `GET /api/reports`, `GET /api/reports/:id` | Plain report list / single report |
| `PATCH /api/reports/:id` | `{ "status": "resolved" }` (also accepts `pending`, `routed`) |
| `POST /api/reports/:id/upvote` | Adds one upvote ("same problem"); `DELETE` on the same path undoes it. Returns `{report}` |
| `POST /api/dispatch` | `{ "report_id" }` – mock dispatch for severity ≥ 8, logs to the terminal |
| `GET /api/health` | Liveness |

Errors are `{ "error": "..." }`:

| Case | Response |
|---|---|
| Photo > 5 MB | `413` "Please upload a smaller photo for this demo." |
| File named `not-an-issue.jpg` | `422` "No civic issue detected. Please take a clearer picture." (nothing saved) |
| AI fails or times out | `503` "Triage engine offline, saving as Uncategorised." – body also has `saved: true` and the saved `report` (Uncategorised, severity 1) |
| Wrong file type | `415`; missing photo, description or location, or bad coordinates: `400` |

Try it with curl:

```bash
curl -s localhost:4000/api/map-data | head -c 400
curl -s -F image=@photo.jpg -F lat=21.15 -F lng=79.09 localhost:4000/api/reports
```

Demo files: rename any JPEG to `not-an-issue.jpg` (422 path) or `ai-timeout.jpg` (simulated AI outage, 503 path).

## Behaviour notes

- **Severity ≥ 8** → status `routed` and the full payload is printed as `[MOCK DISPATCH] {...}` in the API terminal. Nothing is ever emailed, texted or sent to a third party.
- **Triage stub**: `analyzeReport(image, audio)` in `backend/src/triage.js` returns `{category: "Roads", severity: 8}`. Output is schema-validated by `validateTriage`; anything invalid or low-confidence becomes `Uncategorised`/`1`. The AI layer never writes to the store.
- **Location denied**: the UI shows "Location required" and a neighbourhood field; the report is then saved with the Nagpur sample coordinates (21.1458, 79.0882).
- **Tabs**: *Capture* (file a report), *Reports* (the live list) and *Map*.
- **Description**: a typed description is required; the voice note stays optional and can be played back before submitting.
- **Upvotes**: on the Reports tab, *Same problem* adds an upvote to an existing report instead of filing a duplicate. Reports can be sorted by Newest or Top.
- **Dispatcher view**: the "Severity ≥ 8" chip on the map filters map and reports; each report card has *View JSON* and *Resolve*.
- **Privacy**: no accounts, no names; uploads are stored under random filenames.

## Assumptions

- `civicai_4.tsx` was **not included** with the spec, so the UI recreates the described look (mesh gradient, glassmorphism, cyan/purple accents, rounded corners). Swap in the original components if you have them; `src/api.js` is the only integration surface.
- AC1 says "an array of GeoJSON points"; `/api/map-data` returns a standard GeoJSON `FeatureCollection` whose `features` is that array.
- Low severity (1–3) pins are cyan, since the spec only defines red, orange/yellow and green.
- "Map in the top half" is applied on Report and Feed; the Map tab expands it to full height.
- The "NMC Grid Active" badge from the spec was removed: it implied a live link to municipal systems, and routing here is mock-only.
- The 503 AI-outage response still saves the report, so the UI treats it as a warning rather than a failure.

## Known limitations

- **TODO(manual):** Gemini image analysis and audio transcription are not wired (`backend/src/triage.js`); `audio_text` is always `null` in stub mode.
- JSON-file storage is for demos only (single process, no concurrency control).
- Photos are not EXIF-stripped (no image library by design); GPS metadata in a photo would be kept in the stored file.
- Safari records audio as MP4, which the API rejects (spec allows WebM/OGG only); the UI then reports the error and you can submit without audio.
- No auth or rate limiting (out of scope per spec). Upvotes are remembered per device in the browser, so they are easy to repeat from another browser.

## Troubleshooting

- *"Cannot reach the CivicPulse server"*: start the backend first; check `PORT` and `VITE_DEV_PROXY_TARGET` match.
- *Map is blank grey*: tiles need internet; resize the window once if the map was hidden on load.
- *Location prompt never appears*: browsers require `localhost` or HTTPS; use the neighbourhood fallback otherwise.
- *`node: bad option: --env-file-if-exists`*: upgrade to Node 22.9+.
