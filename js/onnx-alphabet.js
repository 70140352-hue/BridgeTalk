/* ============================================================
   BridgeTalk v7 — Client-side Alphabet Inference (ONNX)
   ============================================================
   Replaces the HTTP round-trip to serve.py with in-browser inference
   using onnxruntime-web. Must produce results identical to serve.py's
   /api/predict (same normalization, same class order).

   Conversion path (run once on the workstation):
     cd training
     python convert_to_onnx.py
   Produces: models/alphabet_rf.onnx + models/alphabet_rf.classes.json

   Runtime:
     const ort = new OnnxAlphabetRunner();
     await ort.load();           // downloads ort + the .onnx (cached)
     const out = await ort.predict(landmarks); // {letter, confidence, top3}

   Why ONNX runtime and not TFJS:
     scikit-learn → ONNX has a maintained converter (skl2onnx) that
     preserves RandomForestClassifier exactly. There's no clean
     sklearn → TFJS path. ONNX runtime web is ~1.2 MB gzipped after
     tree-shake, and we only load the WASM execution provider since
     a forest isn't a GPU workload.

   Falls back gracefully: if the .onnx isn't present or ort fails to
   load, `load()` rejects and the caller can use AlphabetMLClient.
   ============================================================ */

const ORT_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort.wasm.min.js';
const ORT_WASM_BASE = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/';
const MODEL_URL = 'models/alphabet_rf.onnx';
const CLASSES_URL = 'models/alphabet_rf.classes.json';

export class OnnxAlphabetRunner {
  constructor(opts = {}) {
    this.modelUrl = opts.modelUrl || MODEL_URL;
    this.classesUrl = opts.classesUrl || CLASSES_URL;
    this.session = null;
    this.classes = null;
    this.inputName = null;
    this.outputNames = null;
    this.loaded = false;
    this.loadError = null;
    this._inFlight = false;
  }

  async load() {
    if (this.loaded) return;
    if (this.loadError) throw this.loadError;

    try {
      // 1. Load ORT runtime if not already on window
      if (!window.ort) {
        await loadScript(ORT_CDN);
      }
      if (!window.ort) {
        throw new Error('onnxruntime-web failed to attach to window');
      }
      window.ort.env.wasm.wasmPaths = ORT_WASM_BASE;
      // CPU-only — RF is a tree forest, no GPU benefit.
      window.ort.env.wasm.numThreads = 1;

      // 2. Fetch class label list
      const classResp = await fetch(this.classesUrl, { cache: 'force-cache' });
      if (!classResp.ok) {
        throw new Error(`Class file ${this.classesUrl} returned ${classResp.status}`);
      }
      this.classes = await classResp.json();

      // 3. Create inference session
      this.session = await window.ort.InferenceSession.create(this.modelUrl, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
      this.inputName = this.session.inputNames[0];
      this.outputNames = this.session.outputNames;
      this.loaded = true;
    } catch (e) {
      this.loadError = e;
      throw e;
    }
  }

  /**
   * Normalize 21 MediaPipe landmarks the same way serve.py does:
   *   wrist-anchored, scaled by ||middle-finger MCP - wrist||
   * Returns Float32Array(63).
   */
  _normalize(landmarks) {
    const out = new Float32Array(63);
    const wx = landmarks[0].x;
    const wy = landmarks[0].y;
    const wz = landmarks[0].z ?? 0;
    // Middle-finger MCP is index 9
    const m9 = landmarks[9];
    const dx = m9.x - wx;
    const dy = m9.y - wy;
    const dz = (m9.z ?? 0) - wz;
    let size = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (size < 1e-6) size = 1.0;
    for (let i = 0; i < 21; i++) {
      const p = landmarks[i];
      out[i * 3 + 0] = (p.x - wx) / size;
      out[i * 3 + 1] = (p.y - wy) / size;
      out[i * 3 + 2] = ((p.z ?? 0) - wz) / size;
    }
    return out;
  }

  /**
   * Predict letter from 21 MediaPipe hand landmarks.
   * Returns { letter, confidence, top3 } or { error } — matches the
   * HTTP backend's response shape exactly so callers don't branch.
   *
   * Drops requests while one is in flight (RF is fast enough that this
   * is rare, but it keeps memory pressure flat).
   */
  async predict(landmarks) {
    if (!this.loaded) return { error: 'onnx runner not loaded' };
    if (this._inFlight) return null;
    if (!landmarks || landmarks.length !== 21) {
      return { error: `expected 21 landmarks, got ${landmarks?.length}` };
    }
    this._inFlight = true;
    try {
      const feat = this._normalize(landmarks);
      const tensor = new window.ort.Tensor('float32', feat, [1, 63]);
      const feeds = { [this.inputName]: tensor };
      const results = await this.session.run(feeds);

      // skl2onnx for RandomForestClassifier emits two outputs:
      //   label        — shape [1], int64 or string class
      //   probabilities — sequence of dicts OR a flat 2D tensor depending
      //                   on options used during conversion.
      // We trained with `--zipmap False`, so probabilities is a [1, 26]
      // tensor of float, in the same order as session classes.
      const probsOut = results[this.outputNames[1]] || results.probabilities;
      if (!probsOut || !probsOut.data) {
        return { error: 'onnx output missing probabilities' };
      }
      const probs = probsOut.data; // Float32Array length 26
      // Top-3
      const ranked = [];
      for (let i = 0; i < probs.length; i++) ranked.push([i, probs[i]]);
      ranked.sort((a, b) => b[1] - a[1]);
      const top3 = ranked.slice(0, 3).map(([i, p]) => ({
        letter: this.classes[i],
        confidence: p,
      }));
      return {
        letter: this.classes[ranked[0][0]],
        confidence: ranked[0][1],
        top3,
      };
    } catch (e) {
      return { error: `${e.name || 'Error'}: ${e.message}` };
    } finally {
      this._inFlight = false;
    }
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
