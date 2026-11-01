import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, MapPin, Mic, Send, X, CheckCircle2 } from 'lucide-react';
import { ApiError, createReport } from '../api.js';
import { severityMeta } from '../lib.js';

const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_AUDIO = 2 * 1024 * 1024;
const MAX_DESCRIPTION = 500;
const MAX_RECORD_MS = 30000;
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'];

export default function CaptureTab({ notify, onSubmitted }) {
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [audio, setAudio] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [description, setDescription] = useState('');
  const [recording, setRecording] = useState(false);
  const [geo, setGeo] = useState({ state: 'idle', lat: null, lng: null });
  const [hood, setHood] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);
  const recRef = useRef(null);
  const holdRef = useRef(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!photo) return setPreview(null);
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  useEffect(() => {
    if (!audio) return setAudioUrl(null);
    const url = URL.createObjectURL(audio);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audio]);

  function locate() {
    if (!navigator.geolocation) return setGeo({ state: 'denied', lat: null, lng: null });
    setGeo({ state: 'loading', lat: null, lng: null });
    navigator.geolocation.getCurrentPosition(
      (p) => setGeo({ state: 'granted', lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setGeo({ state: 'denied', lat: null, lng: null }),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }
  useEffect(locate, []);

  function onPhoto(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > MAX_IMAGE) return notify('error', 'Please upload a smaller photo for this demo.');
    if (!['image/jpeg', 'image/png'].includes(f.type)) return notify('error', 'Photos must be JPEG or PNG.');
    setPhoto(f);
    setResult(null);
  }

  async function startRec() {
    if (recording || scanning) return;
    holdRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MIME_CANDIDATES.find((t) => window.MediaRecorder?.isTypeSupported?.(t));
      const rec = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32000 });
      const chunks = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        clearTimeout(timerRef.current);
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType });
        setRecording(false);
        if (blob.size > MAX_AUDIO) notify('error', 'Voice note is too long. Hold for up to 30 seconds.');
        else if (blob.size) setAudio(blob);
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
      timerRef.current = setTimeout(stopRec, MAX_RECORD_MS);
      if (!holdRef.current) stopRec(); // finger lifted while permission prompt was open
    } catch {
      notify('error', 'Microphone unavailable. You can still submit without a voice note.');
    }
  }
  function stopRec() {
    holdRef.current = false;
    const r = recRef.current;
    if (r && r.state === 'recording') r.stop();
  }

  const hasLocation = geo.state === 'granted' || hood.trim().length > 0;
  const canSubmit = !!photo && description.trim().length > 0 && hasLocation && !scanning;

  async function submit() {
    const fd = new FormData();
    fd.append('image', photo, photo.name);
    fd.append('description', description.trim());
    if (audio) fd.append('audio', audio, `note.${audio.type.includes('ogg') ? 'ogg' : 'webm'}`);
    if (geo.state === 'granted') {
      fd.append('lat', geo.lat);
      fd.append('lng', geo.lng);
    } else {
      fd.append('neighbourhood', hood.trim());
    }
    setScanning(true);
    setResult(null);
    const minWait = new Promise((r) => setTimeout(r, 1800)); // let the scan animation play
    try {
      const [res] = await Promise.all([createReport(fd), minWait]);
      setResult(res.report);
      notify('success', 'Report received and triaged.');
      setPhoto(null); setAudio(null); setHood(''); setDescription('');
      onSubmitted();
    } catch (e) {
      await minWait;
      if (e instanceof ApiError && e.body?.saved) {
        setResult(e.body.report);
        notify('warn', e.message);
        setPhoto(null); setAudio(null); setHood(''); setDescription('');
        onSubmitted();
      } else {
        notify('error', e.message || 'Could not submit the report.'); // form stays filled
      }
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="glass relative aspect-[4/3] overflow-hidden rounded-3xl">
        {preview ? (
          <img src={preview} alt="Selected issue" className="h-full w-full object-cover" />
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-purple-900 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-500"
          >
            <span className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 text-white shadow-lg">
              <Camera size={28} />
            </span>
            <span className="text-sm font-bold">Take or upload a photo</span>
            <span className="text-xs text-purple-900/70">JPEG or PNG, up to 5 MB</span>
          </button>
        )}
        {scanning && (
          <div className="absolute inset-0 bg-slate-900/25">
            <div className="scan-line" />
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/70 px-3 py-1 text-xs font-bold text-cyan-100">
              AI is reviewing your report…
            </span>
          </div>
        )}
        {preview && !scanning && (
          <button
            onClick={() => setPhoto(null)}
            aria-label="Remove photo"
            className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-slate-900/60 text-white"
          >
            <X size={16} />
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png" capture="environment" className="hidden" onChange={onPhoto} />
      </div>

      <label className="glass block rounded-2xl px-3 py-2.5 text-xs font-semibold text-purple-950/80">
        <span className="flex items-center justify-between">
          <span>Describe the problem <span className="text-red-600">*</span></span>
          <span className="font-medium text-purple-900/60">{description.length}/{MAX_DESCRIPTION}</span>
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION))}
          required
          aria-required="true"
          rows={3}
          disabled={scanning}
          placeholder="What is wrong, and where exactly? e.g. Deep pothole near the bus stop, cars are swerving."
          className="mt-1.5 w-full resize-none rounded-xl border border-purple-200 bg-white/80 px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:ring-2 focus:ring-purple-500"
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); startRec(); }}
          onPointerUp={stopRec}
          onPointerCancel={stopRec}
          onContextMenu={(e) => e.preventDefault()}
          disabled={scanning}
          style={{ touchAction: 'none' }}
          className={`flex flex-1 select-none items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
            recording ? 'bg-red-500 text-white' : 'glass text-purple-900'
          }`}
        >
          <Mic size={18} className={recording ? 'animate-pulse' : ''} />
          {recording ? 'Recording… release to stop' : audio ? 'Hold to re-record' : 'Hold to talk (any language)'}
        </button>
        {audio && !recording && (
          <button onClick={() => setAudio(null)} aria-label="Remove voice note" className="glass grid h-11 w-11 place-items-center rounded-2xl text-purple-900">
            <X size={18} />
          </button>
        )}
      </div>

      {audioUrl && !recording && (
        <div className="glass rounded-2xl px-3 py-2.5">
          <p className="mb-1 text-xs font-semibold text-purple-950/80">Your voice note ({(audio.size / 1024).toFixed(0)} KB)</p>
          <audio controls src={audioUrl} className="h-10 w-full" />
        </div>
      )}

      <div className="glass rounded-2xl px-3 py-2.5 text-sm">
        {geo.state === 'loading' && (
          <p className="flex items-center gap-2 font-medium text-purple-900"><Loader2 size={16} className="animate-spin" /> Finding your location…</p>
        )}
        {geo.state === 'granted' && (
          <p className="flex items-center gap-2 font-medium text-emerald-700"><MapPin size={16} /> Location ready ({geo.lat.toFixed(4)}, {geo.lng.toFixed(4)})</p>
        )}
        {(geo.state === 'denied' || geo.state === 'idle') && (
          <div className="space-y-2">
            <p className="flex items-center justify-between gap-2 font-semibold text-red-700">
              <span className="flex items-center gap-2"><MapPin size={16} /> Location required</span>
              <button onClick={locate} className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-purple-900">Try again</button>
            </p>
            <label className="block text-xs font-medium text-purple-950/80">
              Or enter your neighbourhood
              <input
                value={hood}
                onChange={(e) => setHood(e.target.value)}
                maxLength={80}
                placeholder="e.g. Dharampeth"
                className="mt-1 w-full rounded-xl border border-purple-200 bg-white/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
              />
            </label>
          </div>
        )}
      </div>

      <button
        onClick={submit}
        disabled={!canSubmit}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-3.5 text-sm font-extrabold text-white shadow-lg outline-none transition focus-visible:ring-2 focus-visible:ring-purple-300 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {scanning ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        Submit for AI Review
      </button>

      {result && (
        <div className="glass rounded-3xl p-4 text-sm" aria-live="polite">
          <p className="flex items-center gap-2 font-bold text-emerald-700"><CheckCircle2 size={18} /> Report saved</p>
          <p className="mt-2">
            <span className="font-semibold">{result.category}</span> · severity {result.severity}/10{' '}
            <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold ${severityMeta(result).cls}`}>{severityMeta(result).label}</span>
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {result.status === 'routed' ? 'Routed to the department (mock — nothing was sent externally).' : 'Queued for review.'}
          </p>
        </div>
      )}
    </div>
  );
}
