/* ============================================================
   BridgeTalk v6 — Multimodal Recognizer
   ============================================================
   Orchestrates the recognition pipeline:

   1. Per frame: extractFrame(results, t) → features
   2. Update contact trackers per hand (dwell tracking)
   3. Push frame into rolling buffer (last 1.5s)
   4. Run vocabulary rules (location → motion → shape order)
   5. Apply temporal smoothing on candidate
   6. Emit token when held long enough + cooldown ok

   v6: thresholds (confThreshold, holdTime, cooldown, motionHoldTime)
   are now reconfigurable at runtime via configure(), so the UI's
   settings panel can adjust them without rebuilding the recognizer.
   Plus a `stats` object exposes FPS for the live counter.
   ============================================================ */

import { extractFrame } from './features.js';
import { ContactTracker } from './contact.js';
import { VOCABULARY } from './vocabulary.js';

const BUFFER_DURATION_MS = 1500;

export class MultimodalRecognizer {
  constructor(opts = {}) {
    this.frameBuffer = [];
    this.lastT = 0;
    this.leftTracker = new ContactTracker({ minDwell: 180 });
    this.rightTracker = new ContactTracker({ minDwell: 180 });

    this.lastEmit = '';
    this.lastEmitTime = 0;
    this.cooldown = opts.cooldown ?? 1000;
    this.holdTime = opts.holdTime ?? 500;
    this.motionHoldTime = opts.motionHoldTime ?? 200;
    this.confThreshold = opts.confThreshold ?? 0.55;
    this.smoothFrames = opts.smoothFrames ?? 4;

    this.currentCandidate = null;
    this.onTokenEmit = opts.onTokenEmit || (() => {});
    this.onCandidateChange = opts.onCandidateChange || (() => {});
    this.onFrame = opts.onFrame || (() => {});

    // Hook for future model: recognizeWithModel(features, buffer) → {word, confidence} | null
    this.modelHook = opts.modelHook || null;

    // Stats — exposed for UI (FPS, frame count)
    this.stats = {
      frames: 0,
      lastFrameT: 0,
      fps: 0,
      _fpsBuf: [],
    };
  }

  /** Reconfigure thresholds at runtime. */
  configure(opts = {}) {
    if (opts.confThreshold != null) this.confThreshold = opts.confThreshold;
    if (opts.holdTime != null) this.holdTime = opts.holdTime;
    if (opts.motionHoldTime != null) this.motionHoldTime = opts.motionHoldTime;
    if (opts.cooldown != null) this.cooldown = opts.cooldown;
  }

  reset() {
    this.frameBuffer.length = 0;
    this.leftTracker.reset();
    this.rightTracker.reset();
    this.currentCandidate = null;
    this.lastEmit = '';
    this.lastEmitTime = 0;
    this.stats.frames = 0;
    this.stats._fpsBuf.length = 0;
  }

  _updateFps(t) {
    this.stats.frames++;
    const buf = this.stats._fpsBuf;
    buf.push(t);
    while (buf.length && t - buf[0] > 1000) buf.shift();
    this.stats.fps = buf.length;
    this.stats.lastFrameT = t;
  }

  update(results, t) {
    this._updateFps(t);

    const frame = extractFrame(results, t, this.lastT);
    this.lastT = t;

    const leftStable = this.leftTracker.update(t, frame.hands.left?.contact || null);
    const rightStable = this.rightTracker.update(t, frame.hands.right?.contact || null);
    if (frame.hands.left)  frame.hands.left.stableContact  = leftStable;
    if (frame.hands.right) frame.hands.right.stableContact = rightStable;

    this.frameBuffer.push(frame);
    while (this.frameBuffer.length && t - this.frameBuffer[0].t > BUFFER_DURATION_MS) {
      this.frameBuffer.shift();
    }

    this.onFrame(frame);

    if (this.frameBuffer.length < this.smoothFrames) return;

    const history = {
      frameBuffer: this.frameBuffer,
      leftTracker: this.leftTracker,
      rightTracker: this.rightTracker,
    };

    const contacts = {
      left: leftStable,
      right: rightStable,
    };

    let best = null;

    for (const rule of VOCABULARY.location) {
      const r = rule.test(frame, contacts, history);
      if (!r) continue;
      const conf = r.confidence;
      if (conf >= this.confThreshold && (!best || conf > best.confidence)) {
        best = { word: rule.word, gloss: rule.gloss || rule.word, kind: rule.kind, confidence: conf };
      }
    }

    for (const rule of VOCABULARY.motion) {
      const r = rule.test(frame, contacts, history);
      if (!r) continue;
      const conf = r.confidence;
      if (conf >= this.confThreshold && (!best || conf > best.confidence)) {
        best = { word: rule.word, gloss: rule.gloss || rule.word, kind: rule.kind, confidence: conf };
      }
    }

    const primaryHasContact = !!frame.hands.primary?.stableContact;
    if (!primaryHasContact) {
      for (const rule of VOCABULARY.shape) {
        const r = rule.test(frame, contacts, history);
        if (!r) continue;
        const conf = r.confidence;
        if (conf >= this.confThreshold && (!best || conf > best.confidence)) {
          best = {
            word: rule.word,
            gloss: rule.gloss || rule.word,
            kind: rule.kind,
            confidence: conf,
            isLetter: !!rule.isLetter,
          };
        }
      }
    }

    if (this.modelHook) {
      const mr = this.modelHook(frame, history);
      if (mr && mr.confidence > (best?.confidence ?? 0)) {
        best = { word: mr.word, gloss: mr.gloss || mr.word, kind: 'model', confidence: mr.confidence };
      }
    }

    if (!best) {
      if (this.currentCandidate) {
        this.currentCandidate = null;
        this.onCandidateChange(null);
      }
      return;
    }

    if (!this.currentCandidate || this.currentCandidate.word !== best.word) {
      this.currentCandidate = { ...best, since: t };
      this.onCandidateChange(this.currentCandidate);
      return;
    }
    this.currentCandidate.confidence = Math.max(this.currentCandidate.confidence, best.confidence);
    this.onCandidateChange(this.currentCandidate);

    const heldFor = t - this.currentCandidate.since;
    const requiredHold = best.kind === 'motion' ? this.motionHoldTime : this.holdTime;
    if (heldFor < requiredHold) return;

    if (best.word === this.lastEmit && t - this.lastEmitTime < this.cooldown) return;
    if (t - this.lastEmitTime < 350) return;

    this.lastEmit = best.word;
    this.lastEmitTime = t;
    this.onTokenEmit({ ...this.currentCandidate, t });
    this.currentCandidate = null;
    this.onCandidateChange(null);
  }
}
