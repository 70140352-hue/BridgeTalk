/* ============================================================
   BridgeTalk v7 — Motion Gate
   ============================================================
   Computes per-frame wrist-position deltas over a small rolling window
   and decides whether the user is "actively signing" or "at rest".

   Used to short-circuit expensive inference when hands are still:
   - In signs mode: rule evaluation is comparatively cheap, but we still
     skip the modelHook (LSTM) when at rest.
   - In alphabet mode: skip the network round-trip / ONNX session.run
     entirely when the hand isn't moving (but allow the last steady letter
     to keep registering — see `isSteadyHold()`).

   Threshold units match MediaPipe's normalized landmark coordinates
   (x/y in 0..1 image space). A value of 0.005 means "summed wrist
   movement across the window must exceed half a percent of the frame".

   Edge cases handled:
   - If no hand is present at all, gate returns `noHand` (caller decides
     what to do — usually reset their candidate).
   - If the hand just appeared (buffer too short), gate returns `moving`
     so first appearance always runs through inference.
   ============================================================ */

export class MotionGate {
  constructor(opts = {}) {
    this.threshold = opts.threshold ?? 0.005;
    this.window = opts.window ?? 3;
    this.buffer = []; // [{ x, y, t }]
  }

  configure(opts = {}) {
    if (opts.threshold != null) this.threshold = opts.threshold;
    if (opts.window != null) {
      this.window = opts.window;
      // Trim if shrunk
      while (this.buffer.length > this.window) this.buffer.shift();
    }
  }

  reset() {
    this.buffer.length = 0;
  }

  /**
   * Push a wrist landmark (or null if no hand) and get a verdict.
   * Returns one of: 'moving' | 'still' | 'noHand'.
   */
  push(wrist, t) {
    if (!wrist) {
      this.buffer.length = 0;
      return 'noHand';
    }
    this.buffer.push({ x: wrist.x, y: wrist.y, t });
    while (this.buffer.length > this.window) this.buffer.shift();

    if (this.buffer.length < this.window) return 'moving';

    // Summed Euclidean delta across the window
    let total = 0;
    for (let i = 1; i < this.buffer.length; i++) {
      const dx = this.buffer[i].x - this.buffer[i - 1].x;
      const dy = this.buffer[i].y - this.buffer[i - 1].y;
      total += Math.sqrt(dx * dx + dy * dy);
    }
    return total >= this.threshold ? 'moving' : 'still';
  }

  /** Current movement magnitude — useful for debug overlays. */
  magnitude() {
    if (this.buffer.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < this.buffer.length; i++) {
      const dx = this.buffer[i].x - this.buffer[i - 1].x;
      const dy = this.buffer[i].y - this.buffer[i - 1].y;
      total += Math.sqrt(dx * dx + dy * dy);
    }
    return total;
  }
}
