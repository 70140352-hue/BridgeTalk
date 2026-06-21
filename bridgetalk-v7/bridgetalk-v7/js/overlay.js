/* ============================================================
   BridgeTalk v6 — Skeleton Overlay
   ============================================================
   Canvas drawing for hands + pose + face mesh + body anchors.
   Mirrors the input video coordinates (normalized 0..1).

   v6:
   - drawContacts is no longer a no-op: when a fingertip is in
     contact with an anchor, that anchor gets a brighter ring +
     glow + label, so users get visual confirmation of "BridgeTalk
     thinks you're touching your chin".
   - Render flags (showAnchors, showFace, showPose) allow the
     overlay to be toggled from the settings panel.
   - Per-anchor labels appear when contacts are active.
   ============================================================ */

// Hand connections (MediaPipe Hands convention)
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17],
];

const POSE_CONNECTIONS = [
  [11,12],         // shoulders
  [11,13],[13,15], // left arm
  [12,14],[14,16], // right arm
  [11,23],[12,24], // torso sides
  [23,24],         // hips
];

export class Overlay {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mirror = true;
    this.flags = {
      anchors: true,
      face: true,
      pose: true,
    };
  }

  setFlags(flags = {}) {
    Object.assign(this.flags, flags);
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  draw(results, anchors, contacts) {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    if (this.flags.pose && results.poseLandmarks) this.drawPose(results.poseLandmarks, W, H);
    if (this.flags.face && results.faceLandmarks) this.drawFace(results.faceLandmarks, W, H);
    if (results.leftHandLandmarks)  this.drawHand(results.leftHandLandmarks, W, H, '#22d3ee');
    if (results.rightHandLandmarks) this.drawHand(results.rightHandLandmarks, W, H, '#a78bfa');

    // Determine which anchors are currently contacted (for highlight)
    const activeAnchors = new Set();
    if (contacts) {
      if (contacts.left?.anchor) activeAnchors.add(contacts.left.anchor);
      if (contacts.right?.anchor) activeAnchors.add(contacts.right.anchor);
    }

    if (this.flags.anchors && anchors) this.drawAnchors(anchors, W, H, activeAnchors);
    if (contacts) this.drawContacts(contacts, anchors, W, H);
  }

  px(p, W, H) {
    const x = this.mirror ? (1 - p.x) * W : p.x * W;
    return [x, p.y * H];
  }

  drawHand(lm, W, H, color) {
    const ctx = this.ctx;
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const [a, b] of HAND_CONNECTIONS) {
      const [ax, ay] = this.px(lm[a], W, H);
      const [bx, by] = this.px(lm[b], W, H);
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
    }
    ctx.stroke();
    for (const p of lm) {
      const [x, y] = this.px(p, W, H);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Larger dot at fingertip 8 (index tip) for emphasis
    const tip = lm[8];
    if (tip) {
      const [x, y] = this.px(tip, W, H);
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = color + '88';
      ctx.fill();
    }
  }

  drawPose(lm, W, H) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const [a, b] of POSE_CONNECTIONS) {
      if (!lm[a] || !lm[b]) continue;
      const [ax, ay] = this.px(lm[a], W, H);
      const [bx, by] = this.px(lm[b], W, H);
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(167, 139, 250, 0.85)';
    [11, 12, 23, 24].forEach(i => {
      if (!lm[i]) return;
      const [x, y] = this.px(lm[i], W, H);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  drawFace(lm, W, H) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(148, 163, 184, 0.20)';
    for (let i = 0; i < lm.length; i += 8) {
      const [x, y] = this.px(lm[i], W, H);
      ctx.beginPath();
      ctx.arc(x, y, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawAnchors(anchors, W, H, activeAnchors = new Set()) {
    const ctx = this.ctx;
    for (const [name, a] of Object.entries(anchors)) {
      if (!a) continue;
      const isActive = activeAnchors.has(name);
      const [x, y] = this.px(a, W, H);
      const r = a.radius * Math.min(W, H);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      if (isActive) {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.5;
      } else {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.05)';
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
        ctx.lineWidth = 1.2;
      }
      ctx.fill();
      ctx.stroke();
    }
  }

  drawContacts(contacts, anchors, W, H) {
    const ctx = this.ctx;
    if (!anchors) return;

    for (const side of ['left', 'right']) {
      const c = contacts[side];
      if (!c) continue;
      const a = anchors[c.anchor];
      if (!a) continue;
      const [x, y] = this.px(a, W, H);
      const r = a.radius * Math.min(W, H);

      // Pulsing outer ring
      ctx.save();
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Label
      const label = `${c.anchor.replace('_', ' ')}`;
      ctx.font = '600 12px ui-monospace, "JetBrains Mono", Menlo, monospace';
      const padding = 6;
      const metrics = ctx.measureText(label);
      const labelW = metrics.width + padding * 2;
      const labelH = 20;
      const labelX = x - labelW / 2;
      const labelY = y - r - labelH - 8;
      ctx.fillStyle = 'rgba(6, 9, 22, 0.78)';
      this._roundRect(ctx, labelX, labelY, labelW, labelH, 6);
      ctx.fill();
      ctx.fillStyle = '#f59e0b';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, labelX + padding, labelY + labelH / 2 + 1);
    }
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
