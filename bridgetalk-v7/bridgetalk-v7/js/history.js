/* ============================================================
   BridgeTalk v6 — Sentence History
   ============================================================
   Persistent log of completed sentences for the current
   browser/device. Auto-saves on every completion (defined as
   "user pressed Speak / Copy / Clear with a non-empty sentence")
   so the user can pull back earlier conversations.

   Storage: localStorage under 'bridgetalk.history.v1', capped at
   50 entries (FIFO eviction). Per-entry: {id, t, text, tokens}.
   ============================================================ */

const STORAGE_KEY = 'bridgetalk.history.v1';
const MAX_ENTRIES = 50;

export class HistoryStore {
  constructor() {
    this.entries = [];
    this.listeners = new Set();
    this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) this.entries = parsed.slice(-MAX_ENTRIES);
    } catch (e) {
      console.warn('history load failed:', e);
    }
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries.slice(-MAX_ENTRIES)));
    } catch (e) {
      console.warn('history save failed:', e);
    }
  }

  /** Add an entry. Skips duplicates of the most recent. */
  add(text, tokens) {
    if (!text || !text.trim()) return;
    const last = this.entries[this.entries.length - 1];
    if (last && last.text === text) return; // dedupe consecutive
    const entry = {
      id: `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      t: Date.now(),
      text,
      tokens: tokens?.map(t => ({ word: t.word, kind: t.kind })) ?? [],
    };
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(-MAX_ENTRIES);
    }
    this._save();
    this._emit();
  }

  remove(id) {
    const before = this.entries.length;
    this.entries = this.entries.filter(e => e.id !== id);
    if (this.entries.length !== before) {
      this._save();
      this._emit();
    }
  }

  clear() {
    this.entries.length = 0;
    this._save();
    this._emit();
  }

  list() {
    return this.entries.slice().reverse(); // newest first
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit() {
    for (const fn of this.listeners) {
      try { fn(this.list()); } catch (e) { console.warn(e); }
    }
  }

  /** Export everything as JSON Blob URL (for download). */
  exportBlob() {
    const payload = {
      app: 'bridgetalk',
      version: 6,
      exportedAt: new Date().toISOString(),
      entries: this.entries,
    };
    return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  }

  /** Export as plain text (one sentence per line, with timestamps). */
  exportText() {
    return this.entries.map(e => {
      const d = new Date(e.t);
      return `[${d.toLocaleString()}] ${e.text}`;
    }).join('\n');
  }
}

export const history = new HistoryStore();
