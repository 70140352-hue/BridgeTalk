/* ============================================================
   BridgeTalk v6 — Alphabet ML Bridge
   ============================================================
   When ML alphabet mode is enabled, this module:
     1. Loads MediaPipe Hands (separately from Holistic — Hands is faster
        and more accurate for fingerspelling-only recognition).
     2. On each frame, takes the 21 hand landmarks and POSTs them to the
        local backend's /api/predict endpoint.
     3. Returns a {letter, confidence, top3} via callback that the caller can
        feed into the sentence builder as a fingerspell token.

   v6 improvements:
   - StableLetterFilter is reconfigurable at runtime (required, minConf,
     cooldown) so the settings panel can tune it.
   - AlphabetMLClient retries health every 10s when initially unhealthy
     (e.g. user started the server after the page loaded).
   - HandsRunner exposes a `loaded` flag and clean stop/restart so toggling
     modes back and forth doesn't leak instances.
   ============================================================ */

const API_PREDICT = '/api/predict';
const API_HEALTH = '/api/health';

export class AlphabetMLClient {
  constructor(opts = {}) {
    this.minInterval = opts.minInterval ?? 200;
    this.lastRequestT = 0;
    this.inFlight = false;
    this.lastResult = null;
    this.healthChecked = false;
    this.healthy = false;
    this.healthError = null;
    this._healthRetryTimer = null;
  }

  configure(opts = {}) {
    if (opts.minInterval != null) this.minInterval = opts.minInterval;
  }

  async checkHealth() {
    try {
      const r = await fetch(API_HEALTH, { cache: 'no-store' });
      const j = await r.json();
      this.healthy = !!j.ok;
      this.healthError = j.error || null;
      this.healthChecked = true;
      return this.healthy;
    } catch (e) {
      this.healthy = false;
      this.healthError = e.message;
      this.healthChecked = true;
      return false;
    }
  }

  /** Retry health every `intervalMs` until healthy. Calls onChange on each result. */
  startHealthPolling(intervalMs = 10000, onChange = null) {
    this.stopHealthPolling();
    const tick = async () => {
      const prev = this.healthy;
      await this.checkHealth();
      if (onChange && prev !== this.healthy) onChange(this.healthy, this.healthError);
      if (!this.healthy) this._healthRetryTimer = setTimeout(tick, intervalMs);
    };
    tick();
  }

  stopHealthPolling() {
    if (this._healthRetryTimer) {
      clearTimeout(this._healthRetryTimer);
      this._healthRetryTimer = null;
    }
  }

  async predict(landmarks) {
    if (this.inFlight) return null;
    const now = performance.now();
    if (now - this.lastRequestT < this.minInterval) return null;
    if (!landmarks || landmarks.length !== 21) return null;

    this.inFlight = true;
    this.lastRequestT = now;
    try {
      const payload = {
        landmarks: landmarks.map(p => [p.x, p.y, p.z ?? 0]),
      };
      const r = await fetch(API_PREDICT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok || j.error) {
        this.lastResult = { error: j.error || `HTTP ${r.status}` };
      } else {
        this.lastResult = j;
      }
      return this.lastResult;
    } catch (e) {
      this.lastResult = { error: e.message };
      return this.lastResult;
    } finally {
      this.inFlight = false;
    }
  }
}

export class HandsRunner {
  constructor(opts = {}) {
    this.video = opts.video;
    this.frameSource = opts.frameSource || null; // optional FrameSource for downscaling
    this.getStride = opts.getStride || (() => 1); // function returning current stride
    this.onResults = opts.onResults || (() => {});
    this.hands = null;
    this.running = false;
    this.loaded = false;
  }

  async load() {
    if (this.loaded) return;
    if (!window.Hands) {
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.js');
    }
    this.hands = new window.Hands({
      locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}`,
    });
    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5,
    });
    this.hands.onResults((r) => this.onResults(r));
    this.loaded = true;
  }

  start() {
    if (this.running) return;
    this.running = true;
    let frameIdx = 0;
    const tick = async () => {
      if (!this.running) return;
      try {
        const stride = Math.max(1, this.getStride() | 0);
        if (frameIdx++ % stride === 0 && this.video.readyState >= 2) {
          // Prefer the downscaled source when provided. MediaPipe Hands
          // accepts a canvas just as happily as a video element.
          const img = this.frameSource ? this.frameSource.getInput() : this.video;
          await this.hands.send({ image: img });
        }
      } catch (e) {
        console.warn('Hands send error', e);
      }
      requestAnimationFrame(tick);
    };
    tick();
  }

  stop() {
    this.running = false;
  }
}

function loadScript(url) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = url;
    s.crossOrigin = 'anonymous';
    s.onload = res;
    s.onerror = () => rej(new Error('Failed to load ' + url));
    document.head.appendChild(s);
  });
}

export class StableLetterFilter {
  constructor(opts = {}) {
    this.required = opts.required ?? 3;
    this.minConf = opts.minConf ?? 0.55;
    this.cooldown = opts.cooldown ?? 700;
    this.consecutive = 0;
    this.lastLetter = null;
    this.lastEmit = '';
    this.lastEmitT = 0;
  }

  configure(opts = {}) {
    if (opts.required != null) this.required = opts.required;
    if (opts.minConf != null) this.minConf = opts.minConf;
    if (opts.cooldown != null) this.cooldown = opts.cooldown;
  }

  push(pred, t) {
    if (!pred || !pred.letter || pred.confidence < this.minConf) {
      this.consecutive = 0;
      this.lastLetter = null;
      return null;
    }
    if (pred.letter !== this.lastLetter) {
      this.lastLetter = pred.letter;
      this.consecutive = 1;
      return null;
    }
    this.consecutive++;
    if (this.consecutive < this.required) return null;
    if (pred.letter === this.lastEmit && t - this.lastEmitT < this.cooldown) {
      return null;
    }
    this.lastEmit = pred.letter;
    this.lastEmitT = t;
    return pred.letter;
  }

  reset() {
    this.consecutive = 0;
    this.lastLetter = null;
    this.lastEmit = '';
    this.lastEmitT = 0;
  }
}
