/* ============================================================
   BridgeTalk v5 — Contact Engine
   ============================================================
   For each frame, computes which body anchor (if any) each
   active fingertip is "touching". Touching means within the
   anchor's radius (which is normalized to face width, so it's
   distance-invariant).

   Output per hand:
     {
       contact: 'chin' | 'forehead' | ... | null,
       finger:  'index' | 'thumb' | ... | null,
       distance: number,       // normalized, lower = closer
       confidence: number,     // 0..1
     }

   Also tracks dwell: how long a contact has been held, so the
   recognizer can require sustained contact (vs accidental brush).
   ============================================================ */

import { TIPS, dist } from './handshapes.js';

const FINGER_NAMES = ['thumb', 'index', 'middle', 'ring', 'pinky'];

/**
 * Find the best contact between a single hand and the body anchors.
 * "Best" = closest anchor that's within its radius, weighted by which
 * fingertip is closest.
 */
export function detectContact(handLandmarks, anchors, faceWidth) {
  if (!handLandmarks || !anchors) return null;

  let best = null;

  for (const finger of FINGER_NAMES) {
    const tip = handLandmarks[TIPS[finger]];
    if (!tip) continue;

    for (const [name, anchor] of Object.entries(anchors)) {
      if (!anchor) continue;
      const d = dist(tip, anchor);
      if (d > anchor.radius) continue;
      // Confidence: how deep inside the radius the tip is (0 = on edge, 1 = at center)
      const conf = 1 - d / anchor.radius;

      // Score: prefer index finger contacts (most signs use index), but
      // any tip works. Apply small bonus for index/middle/thumb.
      const fingerWeight =
        finger === 'index'  ? 1.0  :
        finger === 'middle' ? 0.95 :
        finger === 'thumb'  ? 0.9  :
        finger === 'pinky'  ? 0.85 :
        0.85;
      const score = conf * fingerWeight;

      if (!best || score > best.score) {
        best = {
          anchor: name,
          finger,
          distance: d,
          confidence: conf,
          score,
        };
      }
    }
  }

  return best;
}

/**
 * Rolling contact tracker for a single hand. Tracks dwell time and
 * provides "stable contact" detection (anchor held for ≥minDwell ms).
 */
export class ContactTracker {
  constructor(opts = {}) {
    this.minDwell = opts.minDwell ?? 200;          // ms before contact is "stable"
    this.releaseGrace = opts.releaseGrace ?? 100;  // ms of no-contact before clearing
    this.history = [];                             // {t, contact}
    this.activeContact = null;                     // current stable contact
    this.activeSince = 0;
    this.lastContactT = 0;
  }

  reset() {
    this.history.length = 0;
    this.activeContact = null;
    this.activeSince = 0;
    this.lastContactT = 0;
  }

  /**
   * Update with the latest contact detection (or null if no contact).
   * Returns the current stable contact name (or null).
   */
  update(t, contact) {
    this.history.push({ t, contact });
    while (this.history.length && t - this.history[0].t > 1500) {
      this.history.shift();
    }

    if (contact) {
      this.lastContactT = t;
      // New anchor → start dwell timer
      if (!this.activeContact || this.activeContact.anchor !== contact.anchor) {
        this.activeContact = contact;
        this.activeSince = t;
      } else {
        // Same anchor — refine confidence to running max
        this.activeContact.confidence = Math.max(
          this.activeContact.confidence,
          contact.confidence
        );
      }
    } else {
      // No contact this frame — but allow grace period before clearing
      if (t - this.lastContactT > this.releaseGrace) {
        this.activeContact = null;
        this.activeSince = 0;
      }
    }

    if (!this.activeContact) return null;
    if (t - this.activeSince < this.minDwell) return null;
    return this.activeContact;
  }

  /** Was a given anchor touched within the last `windowMs`? */
  touchedRecently(anchor, t, windowMs = 800) {
    for (let i = this.history.length - 1; i >= 0; i--) {
      const h = this.history[i];
      if (t - h.t > windowMs) break;
      if (h.contact && h.contact.anchor === anchor) return true;
    }
    return false;
  }

  /** Sequence of distinct anchors touched in recent history (for multi-step signs). */
  recentSequence(t, windowMs = 1500) {
    const seq = [];
    let last = null;
    for (const h of this.history) {
      if (t - h.t > windowMs) continue;
      const a = h.contact?.anchor || null;
      if (a !== last) {
        if (a) seq.push(a);
        last = a;
      }
    }
    return seq;
  }
}
