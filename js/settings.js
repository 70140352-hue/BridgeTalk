/* ============================================================
   BridgeTalk v6 — Settings Store
   ============================================================
   Centralized, persistent (localStorage) settings used across
   pages. Emits change events so live UI can update.

   Why a single store? Recognizer thresholds, theme choice, audio
   feedback, language selection, and keyboard prefs were each living
   in their own corner — this consolidates them and survives reload.
   ============================================================ */

const STORAGE_KEY = 'bridgetalk.settings.v1';

const DEFAULTS = {
  // Recognizer tuning
  confThreshold: 0.55,
  holdTime: 500,
  motionHoldTime: 200,
  cooldown: 1000,

  // Alphabet ML
  alphabetMinConfidence: 0.55,
  alphabetRequiredFrames: 3,
  alphabetCooldown: 700,
  alphabetMinInterval: 220,

  // UI
  theme: 'auto',          // 'auto' | 'dark' | 'light'
  showAnchors: true,
  showFace: true,
  showPose: true,
  showFps: false,
  showTop3: true,

  // Behaviour
  audioFeedback: false,   // beep on emit
  autoCapitalize: true,
  ttsRate: 0.95,
  ttsPitch: 1.0,

  // Language (scaffold for future PSL support)
  language: 'asl',        // 'asl' | 'psl'

  // Mirror video (camera default)
  mirror: true,

  // -----------------------------------------------------------------
  // v7 perf knobs (all reconfigurable at runtime)
  // -----------------------------------------------------------------

  // Frame throttling: process 1 of every N animation frames.
  // 1 = process every frame (≈ display rate), 3 ≈ 20fps on a 60Hz monitor,
  // 5 ≈ 12fps. MediaPipe is the dominant cost so this is the biggest lever.
  signsFrameStride: 3,
  alphabetFrameStride: 3,

  // Downscale: feed MediaPipe a smaller canvas instead of the raw 640x480.
  // 0 disables downscaling. Holistic+Hands both tolerate 256-320 well for
  // close-range single-person webcam input.
  inputDownscale: 320,        // longest edge, px; 0 to disable

  // Motion gate: skip inference when the wrist hasn't moved appreciably
  // over the last N frames. Threshold is in normalized landmark units
  // (MediaPipe x/y are 0..1), so 0.005 ≈ "half a percent of the frame".
  motionGateEnabled: true,
  motionGateThreshold: 0.005, // wrist-delta sum over the window
  motionGateWindow: 3,        // frames

  // Alphabet inference backend.
  //   'auto'   — prefer onnx in-browser, fall back to http server
  //   'onnx'   — fail if onnx not available (no fallback)
  //   'http'   — always use the python server (v6 behaviour)
  alphabetBackend: 'onnx',

  // Sequence model (LSTM) for dynamic signs. Optional — requires a
  // trained sequence_model.onnx in /models. If absent, this is a no-op.
  sequenceModelEnabled: false,
  sequenceWindowFrames: 30,   // landmarks history window for the LSTM
  sequenceInferStride: 5,     // run the model every N frames
};

class SettingsStore {
  constructor() {
    this.values = { ...DEFAULTS };
    this.listeners = new Set();
    this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      // Merge with defaults so newly-added keys appear
      for (const k of Object.keys(DEFAULTS)) {
        if (k in parsed) this.values[k] = parsed[k];
      }
    } catch (e) {
      console.warn('settings load failed:', e);
    }
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.values));
    } catch (e) {
      console.warn('settings save failed:', e);
    }
  }

  get(key) {
    return key in this.values ? this.values[key] : DEFAULTS[key];
  }

  set(key, value) {
    if (!(key in DEFAULTS)) {
      console.warn('unknown setting key:', key);
      return;
    }
    if (this.values[key] === value) return;
    this.values[key] = value;
    this._save();
    this._emit({ key, value });
  }

  patch(obj) {
    let any = false;
    for (const [k, v] of Object.entries(obj)) {
      if (!(k in DEFAULTS)) continue;
      if (this.values[k] === v) continue;
      this.values[k] = v;
      any = true;
      this._emit({ key: k, value: v });
    }
    if (any) this._save();
  }

  reset() {
    this.values = { ...DEFAULTS };
    this._save();
    for (const k of Object.keys(DEFAULTS)) this._emit({ key: k, value: this.values[k] });
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit(payload) {
    for (const fn of this.listeners) {
      try { fn(payload); } catch (e) { console.warn(e); }
    }
  }

  /** Apply theme attribute to <html>. Resolves 'auto' against system pref. */
  applyTheme() {
    const t = this.get('theme');
    const root = document.documentElement;
    if (t === 'auto') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', t);
    }
  }
}

export const settings = new SettingsStore();

// Apply theme as early as possible
if (typeof document !== 'undefined') {
  settings.applyTheme();
  settings.on(({ key }) => {
    if (key === 'theme') settings.applyTheme();
  });
}
