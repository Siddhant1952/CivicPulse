import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// Demo persistence: an in-memory array mirrored to a JSON file (atomic write).
export class Store {
  constructor(dir) {
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, 'reports.json');
    const loaded = fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, 'utf8')) : [];
    // Older records may predate `description` / `upvotes`.
    this.items = loaded.map((r) => ({ description: '', upvotes: 0, ...r }));
  }
  _save() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.items, null, 2));
    fs.renameSync(tmp, this.file);
  }
  list({ minSeverity = 1 } = {}) {
    return this.items
      .filter((r) => r.severity >= minSeverity)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  get(id) {
    return this.items.find((r) => r.id === id) || null;
  }
  insert(data) {
    const report = { id: randomUUID(), ...data, created_at: data.created_at ?? new Date().toISOString() };
    this.items.push(report);
    this._save();
    return report;
  }
  update(id, patch) {
    const r = this.get(id);
    if (!r) return null;
    Object.assign(r, patch);
    this._save();
    return r;
  }
}
