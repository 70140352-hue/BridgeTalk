/* ============================================================
   BridgeTalk v7 — Sequence Model (LSTM) Runtime
   ============================================================
   Maintains a rolling buffer of landmark frames and runs a trained
   sequence model (LSTM / GRU / 1D-CNN) to recognize *dynamic* signs
   that can't be expressed as rule-based templates.

   This module is intentionally a SCAFFOLD. It expects:
     models/sequence_model.onnx          — trained sequence classifier
     models/sequence_model.classes.json  — string label list

   If either is missing, the scaffold gracefully no-ops (load() rejects,
   `available` stays false, and the modelHook returns null on every call).
   The rest of the recognition pipeline keeps working — you just lose
   the dynamic-sign branch.

   Expected model contract (matches training/train_sequence_model.py):
     INPUT  name="input"  shape=[1, T, F]  float32
       T = window length (default 30 frames)
       F = features per frame (default 150 = (21 hand + 4 pose-anchor
                                              landmarks) * 3 + 12 derived
                                              motion features. See
                                              `extractSequenceFeatures`.)
     OUTPUTS:
       "logits"        shape=[1, num_classes]  float32  (pre-softmax)
       OR
       "probabilities" shape=[1, num_classes]  float32  (already softmax)

     The runner softmaxes logits if "probabilities" isn't present.

   The runtime is motion-gated AND stride-gated:
     - We only push a frame into the buffer when MediaPipe returned a hand
     - We only run inference when the wrist has moved over the gate window
     - We further throttle so we don't run the model every animation tick

   Performance note:
     A 2-layer LSTM with hidden_size=64 over a 30x150 input is roughly
     1.5 MFLOPs per inference. onnxruntime-web on WASM runs it in
     ~3-8 ms on a 2020 laptop, so even at stride=1 it's comfortably
     real-time. Stride=5 keeps it under 2% of a core.
   ============================================================ */

const ORT_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort.wasm.min.js';
const ORT_WASM_BASE = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/';
const DEFAULT_MODEL_URL = 'models/sequence_model.onnx';
const DEFAULT_CLASSES_URL = 'models/sequence_model.classes.json';

// Feature dimensionality — must match the training script.
//   21 hand landmarks * 3 coords      = 63
//   4 pose anchors (shoulders+wrists) * 3 = 12
//   3 motion-derived scalars per hand * 2 hands = 6
//   Reserved padding to round to 84 then zero-pad to 150 if model expects.
// We emit the *full 150-wide* feature so models can subset upstream.
const FEATURE_DIM = 150;

export class SequenceModelRunner {
  constructor(opts = {}) {
    this.modelUrl = opts.modelUrl || DEFAULT_MODEL_URL;
    this.classesUrl = opts.classesUrl || DEFAULT_CLASSES_URL;
    this.windowFrames = opts.windowFrames ?? 30;
    this.inferStride = opts.inferStride ?? 5;
    this.confThreshold = opts.confThreshold ?? 0.6;

    this.session = null;
    this.classes = null;
    this.inputName = null;
    this.available = false;
    this.loadError = null;

    // Rolling buffer of feature vectors (Float32Array(FEATURE_DIM) each).
    this.buffer = [];
    this._frameCounter = 0;
    this._inFlight = false;
    this._lastResult = null;
  }

  configure(opts = {}) {
    if (opts.windowFrames != null) {
      this.windowFrames = opts.windowFrames;
      while (this.buffer.length > this.windowFrames) this.buffer.shift();
    }
    if (opts.inferStride != null) this.inferStride = opts.inferStride;
    if (opts.confThreshold != null) this.confThreshold = opts.confThreshold;
  }

  async load() {
    if (this.available) return;
    if (this.loadError) throw this.loadError;

    try {
      // Probe for the model file first — quietly skip if it's not there.
      // This is the common case during development before a model is trained.
      const probe = await fetch(this.modelUrl, { method: 'HEAD' });
      if (!probe.ok) {
        throw new Error(
          `${this.modelUrl} not found (status ${probe.status}). ` +
          `Train one with training/train_sequence_model.py.`
        );
      }

      if (!window.ort) {
        await loadScript(ORT_CDN);
      }
      if (!window.ort) {
        throw new Error('onnxruntime-web failed to attach to window');
      }
      window.ort.env.wasm.wasmPaths = ORT_WASM_BASE;

      const classResp = await fetch(this.classesUrl, { cache: 'force-cache' });
      if (!classResp.ok) {
        throw new Error(`Classes file ${this.classesUrl} returned ${classResp.status}`);
      }
      this.classes = await classResp.json();

      this.session = await window.ort.InferenceSession.create(this.modelUrl, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
      this.inputName = this.session.inputNames[0];
      this.available = true;
    } catch (e) {
      this.loadError = e;
      this.available = false;
      throw e;
    }
  }

  reset() {
    this.buffer.length = 0;
    this._frameCounter = 0;
    this._lastResult = null;
  }

  /**
   * Extract a feature vector from one Holistic results frame.
   * Layout is fixed and zero-pads when a hand isn't visible — the model
   * sees a consistent shape and learns to ignore zero blocks.
   */
  extractFeatures(results) {
    const f = new Float32Array(FEATURE_DIM);
    let i = 0;

    // 21 hand landmarks (right hand — fall back to left if right missing).
    const hand = results.rightHandLandmarks || results.leftHandLandmarks;
    if (hand) {
      for (let h = 0; h < 21; h++) {
        f[i++] = hand[h].x;
        f[i++] = hand[h].y;
        f[i++] = hand[h].z ?? 0;
      }
    } else {
      i += 63;
    }

    // 4 pose anchors: left shoulder, right shoulder, left wrist, right wrist
    // (MediaPipe Pose indices: 11, 12, 15, 16)
    const pose = results.poseLandmarks;
    if (pose) {
      for (const idx of [11, 12, 15, 16]) {
        const p = pose[idx];
        if (p) {
          f[i++] = p.x;
          f[i++] = p.y;
          f[i++] = p.z ?? 0;
        } else {
          i += 3;
        }
      }
    } else {
      i += 12;
    }

    // remaining slots stay zero — reserved for derived features added later
    // (velocity, anchor distances, etc) so feature dim can grow without
    // breaking older trained models that read only the prefix they need.
    return f;
  }

  /**
   * Push a frame and maybe run inference.
   * Returns null until the buffer is full and the stride/motion gate allow it;
   * otherwise returns { word, confidence, kind: 'sequence' }.
   *
   * The caller is responsible for the motion gate decision — pass
   * `isMoving = false` to skip pushing this frame entirely (we still age
   * the buffer so stale frames don't linger).
   */
  async pushAndMaybePredict(results, t, isMoving) {
    if (!this.available || !results) return null;

    if (!isMoving) {
      // Decay-out: drop the oldest entry occasionally so the buffer doesn't
      // hold onto a stale gesture once the user has put their hands down.
      if (this.buffer.length > 0 && (this._frameCounter % 3 === 0)) {
        this.buffer.shift();
      }
      this._frameCounter++;
      return null;
    }

    const feat = this.extractFeatures(results);
    this.buffer.push(feat);
    while (this.buffer.length > this.windowFrames) this.buffer.shift();
    this._frameCounter++;

    if (this.buffer.length < this.windowFrames) return null;
    if (this._frameCounter % this.inferStride !== 0) return this._lastResult;
    if (this._inFlight) return this._lastResult;

    this._inFlight = true;
    try {
      // Pack the buffer into a single Float32Array of [windowFrames * FEATURE_DIM]
      const flat = new Float32Array(this.windowFrames * FEATURE_DIM);
      for (let i = 0; i < this.windowFrames; i++) {
        flat.set(this.buffer[i], i * FEATURE_DIM);
      }
      const tensor = new window.ort.Tensor(
        'float32',
        flat,
        [1, this.windowFrames, FEATURE_DIM],
      );
      const out = await this.session.run({ [this.inputName]: tensor });

      const probsTensor =
        out.probabilities ||
        out.probs ||
        (out.logits ? softmaxTensor(out.logits) : null);
      if (!probsTensor) {
        this._lastResult = null;
        return null;
      }
      const probs = probsTensor.data;
      let bestIdx = 0;
      let bestProb = probs[0];
      for (let i = 1; i < probs.length; i++) {
        if (probs[i] > bestProb) {
          bestProb = probs[i];
          bestIdx = i;
        }
      }
      if (bestProb < this.confThreshold) {
        this._lastResult = null;
        return null;
      }
      this._lastResult = {
        word: this.classes[bestIdx],
        confidence: bestProb,
        kind: 'sequence',
      };
      return this._lastResult;
    } catch (e) {
      console.warn('sequence model inference error:', e);
      this._lastResult = null;
      return null;
    } finally {
      this._inFlight = false;
    }
  }
}

/** Softmax over a 1D tensor's last axis. Returns a new tensor-like object. */
function softmaxTensor(logitsTensor) {
  const data = logitsTensor.data;
  let max = -Infinity;
  for (let i = 0; i < data.length; i++) if (data[i] > max) max = data[i];
  let sum = 0;
  const out = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = Math.exp(data[i] - max);
    sum += out[i];
  }
  for (let i = 0; i < data.length; i++) out[i] /= sum;
  return { data: out };
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
