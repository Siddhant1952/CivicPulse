import { NAGPUR } from './config.js';

const mins = (n) => new Date(Date.now() - n * 60000).toISOString();

// Fictional demo reports scattered around Nagpur. No photos, no personal data.
const SAMPLES = [
  { dlat: 0.012, dlng: -0.008, category: 'Roads', severity: 8, status: 'routed', title: 'Large pothole on main carriageway', description: 'A deep pothole in the middle of the lane. Two-wheelers are swerving to avoid it.', upvotes: 12, neighbourhood: 'Sitabuldi', age: 25 },
  { dlat: -0.018, dlng: 0.014, category: 'Electricity', severity: 9, status: 'routed', title: 'Live wire hanging near bus stop', description: 'An electric wire has come loose and hangs low over the footpath next to the bus stop.', upvotes: 7, neighbourhood: 'Dharampeth', age: 70 },
  { dlat: 0.025, dlng: 0.02, category: 'Water', severity: 5, status: 'pending', title: 'Slow leak from pipeline joint', description: 'Water has been seeping out of the pipe joint since morning and pooling on the road.', upvotes: 3, neighbourhood: 'Sadar', age: 180 },
  { dlat: -0.006, dlng: -0.022, category: 'Sanitation', severity: 3, status: 'pending', title: 'Overflowing community bin', description: 'The bin has not been cleared for days and waste is spilling onto the street.', upvotes: 1, neighbourhood: 'Itwari', age: 320 },
  { dlat: 0.004, dlng: 0.006, category: 'Roads', severity: 6, status: 'resolved', title: 'Broken divider repaired', description: 'The broken road divider was fixed by the roads team.', upvotes: 0, neighbourhood: 'Civil Lines', age: 900 },
];

export function seedIfEmpty(store) {
  if (store.items.length) return 0;
  for (const s of SAMPLES) {
    store.insert({
      lat: +(NAGPUR.lat + s.dlat).toFixed(6),
      lng: +(NAGPUR.lng + s.dlng).toFixed(6),
      image_url: null,
      audio_text: null,
      category: s.category,
      severity: s.severity,
      status: s.status,
      title: s.title,
      description: s.description,
      upvotes: s.upvotes,
      neighbourhood: s.neighbourhood,
      created_at: mins(s.age),
    });
  }
  return SAMPLES.length;
}
