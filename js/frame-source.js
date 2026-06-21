/* ============================================================
   BridgeTalk v7 — Frame Source
   ============================================================
   Wraps the <video> element and optionally returns a downscaled
   offscreen canvas instead. MediaPipe accepts either an HTMLVideoElement
   or an HTMLCanvasElement as `image:`, so callers don't need to know
   which one they're getting.

   Why this exists: feeding MediaPipe 640x480 when 320x240 gives the same
   landmark quality for close-range webcam wastes ~3x the per-frame work.
   The downscale runs on a 2D canvas which the browser composites on the
   GPU — cheaper than MediaPipe's internal resize at the original size.

   Set targetLongEdge to 0 to bypass downscaling entirely.
   ============================================================ */

export class FrameSource {
  constructor(videoEl, opts = {}) {
    this.video = videoEl;
    this.targetLongEdge = opts.targetLongEdge ?? 320;
    this._canvas = null;
    this._ctx = null;
  }

  configure(opts = {}) {
    if (opts.targetLongEdge != null) {
      this.targetLongEdge = opts.targetLongEdge;
      // Force canvas recreation on next frame in case dimensions change
      this._canvas = null;
      this._ctx = null;
    }
  }

  /**
   * Return the input that should be passed to MediaPipe `.send({ image: ... })`.
   * Either the raw <video> element (no downscale) or a freshly redrawn
   * offscreen canvas at the target size.
   */
  getInput() {
    if (!this.targetLongEdge || this.targetLongEdge <= 0) {
      return this.video;
    }
    if (this.video.readyState < 2) return this.video;

    const vw = this.video.videoWidth;
    const vh = this.video.videoHeight;
    if (!vw || !vh) return this.video;

    // If the video is already at or below target, skip the copy.
    if (Math.max(vw, vh) <= this.targetLongEdge) return this.video;

    const scale = this.targetLongEdge / Math.max(vw, vh);
    const tw = Math.round(vw * scale);
    const th = Math.round(vh * scale);

    if (!this._canvas || this._canvas.width !== tw || this._canvas.height !== th) {
      this._canvas = document.createElement('canvas');
      this._canvas.width = tw;
      this._canvas.height = th;
      this._ctx = this._canvas.getContext('2d', {
        alpha: false,
        desynchronized: true,
      });
    }
    this._ctx.drawImage(this.video, 0, 0, tw, th);
    return this._canvas;
  }
}
