/* ============================================================
   BridgeTalk v4 — SVG Hand Animator
   ============================================================
   Procedurally renders a stylized hand into an SVG container
   and animates it through keyframes coming from dictionary entries.
   Each handshape is a parameterized SVG path (palm + 5 fingers).
   ============================================================ */

(function () {
  'use strict';

  // ---------- Handshape geometry ----------
  // All handshapes share a base palm; fingers are described as a list of
  // {extended, curl, splay} per finger [thumb, index, middle, ring, pinky].

  const HANDSHAPES = {
    open:   { fingers: [[1, 0.05, 0.20], [1, 0.05, 0.10], [1, 0.05, 0.10], [1, 0.05, 0.10], [1, 0.05, 0.18]] },
    flat:   { fingers: [[0, 0.20, 0.05], [1, 0.05, 0.02], [1, 0.05, 0.02], [1, 0.05, 0.02], [1, 0.05, 0.02]] },
    fist:   { fingers: [[0, 0.85, 0.00], [0, 0.95, 0.00], [0, 0.95, 0.00], [0, 0.95, 0.00], [0, 0.95, 0.00]] },
    point:  { fingers: [[0, 0.80, 0.00], [1, 0.05, 0.00], [0, 0.95, 0.00], [0, 0.95, 0.00], [0, 0.95, 0.00]] },
    peace:  { fingers: [[0, 0.80, 0.00], [1, 0.05, 0.10], [1, 0.05, 0.10], [0, 0.95, 0.00], [0, 0.95, 0.00]] },
    three:  { fingers: [[1, 0.05, 0.15], [1, 0.05, 0.10], [1, 0.05, 0.10], [0, 0.95, 0.00], [0, 0.95, 0.00]] },
    four:   { fingers: [[0, 0.80, 0.00], [1, 0.05, 0.05], [1, 0.05, 0.05], [1, 0.05, 0.05], [1, 0.05, 0.05]] },
    six:    { fingers: [[1, 0.05, 0.10], [1, 0.05, 0.05], [1, 0.05, 0.05], [1, 0.05, 0.05], [0, 0.95, 0.00]] },
    seven:  { fingers: [[1, 0.05, 0.10], [1, 0.05, 0.05], [1, 0.05, 0.05], [0, 0.95, 0.00], [1, 0.05, 0.05]] },
    eight:  { fingers: [[1, 0.05, 0.10], [1, 0.05, 0.05], [0, 0.95, 0.00], [1, 0.05, 0.05], [1, 0.05, 0.05]] },
    nine:   { fingers: [[1, 0.05, 0.10], [0, 0.95, 0.00], [1, 0.05, 0.05], [1, 0.05, 0.05], [1, 0.05, 0.05]] },
    thumb:  { fingers: [[1, 0.05, 0.30], [0, 0.95, 0.00], [0, 0.95, 0.00], [0, 0.95, 0.00], [0, 0.95, 0.00]] },
    pinky:  { fingers: [[0, 0.80, 0.00], [0, 0.95, 0.00], [0, 0.95, 0.00], [0, 0.95, 0.00], [1, 0.05, 0.00]] },
    y:      { fingers: [[1, 0.05, 0.30], [0, 0.95, 0.00], [0, 0.95, 0.00], [0, 0.95, 0.00], [1, 0.05, 0.00]] },
    l:      { fingers: [[1, 0.05, 0.40], [1, 0.05, 0.00], [0, 0.95, 0.00], [0, 0.95, 0.00], [0, 0.95, 0.00]] },
    c:      { fingers: [[1, 0.50, 0.10], [1, 0.55, 0.05], [1, 0.55, 0.05], [1, 0.55, 0.05], [1, 0.55, 0.05]] },
    rock:   { fingers: [[0, 0.85, 0.00], [1, 0.05, 0.05], [0, 0.95, 0.00], [0, 0.95, 0.00], [1, 0.05, 0.05]] },
  };

  // Finger anchor positions on palm (relative to palm centroid)
  // Layout: thumb left, then index→pinky from left to right along knuckle line
  const FINGER_ANCHORS = [
    { ax: -34, ay:  6,  baseAngle: -65, length: 60 },   // thumb
    { ax: -22, ay: -38, baseAngle: -10, length: 78 },   // index
    { ax:  -4, ay: -42, baseAngle:  0,  length: 86 },   // middle
    { ax:  14, ay: -38, baseAngle:  10, length: 80 },   // ring
    { ax:  30, ay: -30, baseAngle:  22, length: 64 },   // pinky
  ];

  // ---------- SVG Construction ----------

  function createSvg(container) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('id', 'signerSvg');
    svg.setAttribute('viewBox', '0 0 400 400');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // Defs: gradients for hand
    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = `
      <linearGradient id="palmGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#22d3ee"/>
        <stop offset="100%" stop-color="#a78bfa"/>
      </linearGradient>
      <linearGradient id="fingerGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#67e8f9" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="#a78bfa" stop-opacity="0.95"/>
      </linearGradient>
      <radialGradient id="glowGrad">
        <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/>
      </radialGradient>
      <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    `;
    svg.appendChild(defs);

    // Glow background
    const glow = document.createElementNS(NS, 'circle');
    glow.setAttribute('cx', '200');
    glow.setAttribute('cy', '200');
    glow.setAttribute('r', '160');
    glow.setAttribute('fill', 'url(#glowGrad)');
    glow.setAttribute('id', 'handGlow');
    svg.appendChild(glow);

    // The hand group — translated/rotated to position the hand
    const handGroup = document.createElementNS(NS, 'g');
    handGroup.setAttribute('id', 'handGroup');
    handGroup.setAttribute('transform', 'translate(200 200)');
    svg.appendChild(handGroup);

    // Palm (rounded shape)
    const palm = document.createElementNS(NS, 'path');
    palm.setAttribute('id', 'palm');
    palm.setAttribute('fill', 'url(#palmGrad)');
    palm.setAttribute('stroke', 'rgba(255,255,255,0.35)');
    palm.setAttribute('stroke-width', '1.2');
    palm.setAttribute('filter', 'url(#softGlow)');
    palm.setAttribute('d', palmPath());
    handGroup.appendChild(palm);

    // 5 fingers as paths
    for (let i = 0; i < 5; i++) {
      const finger = document.createElementNS(NS, 'path');
      finger.setAttribute('id', `finger-${i}`);
      finger.setAttribute('fill', 'url(#fingerGrad)');
      finger.setAttribute('stroke', 'rgba(255,255,255,0.4)');
      finger.setAttribute('stroke-width', '1.2');
      finger.setAttribute('stroke-linejoin', 'round');
      finger.setAttribute('filter', 'url(#softGlow)');
      handGroup.appendChild(finger);
    }

    // Wrist accent
    const wrist = document.createElementNS(NS, 'rect');
    wrist.setAttribute('x', '-26');
    wrist.setAttribute('y', '50');
    wrist.setAttribute('width', '52');
    wrist.setAttribute('height', '14');
    wrist.setAttribute('rx', '6');
    wrist.setAttribute('fill', 'rgba(167, 139, 250, 0.35)');
    wrist.setAttribute('stroke', 'rgba(255,255,255,0.2)');
    wrist.setAttribute('stroke-width', '1');
    handGroup.appendChild(wrist);

    if (container) {
      container.innerHTML = '';
      container.appendChild(svg);
    }
    return svg;
  }

  function palmPath() {
    // Rounded palm: top is wider (where fingers attach), bottom is wrist
    return `
      M -38 -42
      C -42 -10, -42 30, -28 50
      L 28 50
      C 42 30, 42 -10, 38 -42
      C 30 -52, -30 -52, -38 -42
      Z
    `.replace(/\s+/g, ' ').trim();
  }

  function fingerPath(anchor, finger) {
    const [extended, curl, splay] = finger;
    const len = anchor.length * (extended ? 1 : 0.42);
    const baseRad = (anchor.baseAngle + splay * 30) * Math.PI / 180;

    // Three segments to allow curl
    // Segment 1: anchor → joint1
    // Segment 2: joint1 → joint2 (curled if curl > 0)
    // Segment 3: joint2 → tip
    const segLen = len / 3;
    const curlAngle = curl * Math.PI * 0.85; // up to ~150°

    const x0 = anchor.ax;
    const y0 = anchor.ay;

    // Segment 1: straight from anchor in baseAngle direction (upward)
    const dx1 = Math.sin(baseRad);
    const dy1 = -Math.cos(baseRad);
    const x1 = x0 + dx1 * segLen;
    const y1 = y0 + dy1 * segLen;

    // Segment 2: rotated by curlAngle around joint1
    const ang2 = baseRad + curlAngle * 0.55;
    const x2 = x1 + Math.sin(ang2) * segLen;
    const y2 = y1 - Math.cos(ang2) * segLen;

    // Segment 3
    const ang3 = ang2 + curlAngle * 0.45;
    const x3 = x2 + Math.sin(ang3) * segLen;
    const y3 = y2 - Math.cos(ang3) * segLen;

    // Build a thick "finger" by tracing two parallel curves
    const thickness = extended ? 11 : 13;
    // Perpendicular offsets at each joint
    const perp = (dx, dy) => ({ px: -dy, py: dx });
    const p0 = perp(dx1, dy1);
    const p1 = perp(Math.sin(ang2), -Math.cos(ang2));
    const p2 = perp(Math.sin(ang3), -Math.cos(ang3));

    const t = thickness / 2;
    const ax = x0 + p0.px * t, ay = y0 + p0.py * t;
    const bx = x0 - p0.px * t, by = y0 - p0.py * t;
    const cx = x1 + p1.px * t, cy = y1 + p1.py * t;
    const dx = x1 - p1.px * t, dy = y1 - p1.py * t;
    const ex = x2 + p2.px * t, ey = y2 + p2.py * t;
    const fx = x2 - p2.px * t, fy = y2 - p2.py * t;
    const tipR = thickness / 2;

    return `
      M ${ax.toFixed(1)} ${ay.toFixed(1)}
      Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}
      Q ${x3.toFixed(1)} ${(y3 - tipR * 0.2).toFixed(1)} ${fx.toFixed(1)} ${fy.toFixed(1)}
      Q ${dx.toFixed(1)} ${dy.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}
      Z
    `.replace(/\s+/g, ' ').trim();
  }

  // ---------- Animator ----------

  class HandAnimator {
    constructor(svg) {
      this.svg = svg;
      this.handGroup = svg.querySelector('#handGroup');
      this.fingerEls = [0, 1, 2, 3, 4].map(i => svg.querySelector(`#finger-${i}`));
      this.speed = 1;
      this.playing = false;
      this.queue = [];
      this.queueIdx = 0;
      this.activeAnim = null;
      this.onTokenStart = () => {};
      this.onTokenDone = () => {};
      this.onComplete = () => {};
      this.applyPose({ hand: 'open', rot: 0, x: 50, y: 50, palm: 'out', hold: 0 });
    }

    setSpeed(s) { this.speed = Math.max(0.25, Math.min(3, s)); }

    /**
     * Set the queue of tokens to animate.
     * tokens: array of { kind: 'sign'|'spell', word, entry?, letters? }
     */
    setQueue(tokens) {
      this.queue = tokens;
      this.queueIdx = 0;
    }

    play() {
      if (this.playing) return;
      this.playing = true;
      this.runNext();
    }

    pause() {
      this.playing = false;
      if (this.activeAnim) {
        clearTimeout(this.activeAnim);
        this.activeAnim = null;
      }
    }

    stop() {
      this.pause();
      this.queueIdx = 0;
      this.applyPose({ hand: 'open', rot: 0, x: 50, y: 50, palm: 'out', hold: 0 });
    }

    seekTo(idx) {
      this.pause();
      this.queueIdx = Math.max(0, Math.min(idx, this.queue.length - 1));
    }

    runNext() {
      if (!this.playing) return;
      if (this.queueIdx >= this.queue.length) {
        this.playing = false;
        this.onComplete();
        return;
      }
      const tok = this.queue[this.queueIdx];
      this.onTokenStart(tok, this.queueIdx);

      // Build keyframes for this token
      let frames;
      if (tok.kind === 'sign') {
        frames = tok.entry.keyframes || [{ hand: 'open', rot: 0, x: 50, y: 50, palm: 'out', hold: 500 }];
      } else if (tok.kind === 'spell') {
        // Spell each letter
        frames = [];
        for (const ch of tok.letters) {
          const entry = window.BridgeTalkDict.DICT_INDEX.get(ch);
          if (entry && entry.keyframes && entry.keyframes.length) {
            frames.push({ ...entry.keyframes[0], hold: 320 });
          } else {
            frames.push({ hand: 'fist', rot: 0, x: 50, y: 50, palm: 'out', hold: 280 });
          }
        }
      }

      this.runFrames(frames, 0, () => {
        this.onTokenDone(tok, this.queueIdx);
        this.queueIdx++;
        // Brief gap between words
        this.activeAnim = setTimeout(() => this.runNext(), 200 / this.speed);
      });
    }

    runFrames(frames, idx, done) {
      if (!this.playing) return;
      if (idx >= frames.length) {
        done();
        return;
      }
      const f = frames[idx];
      this.applyPose(f);
      const hold = (f.hold ?? 350) / this.speed;
      this.activeAnim = setTimeout(() => this.runFrames(frames, idx + 1, done), hold);
    }

    applyPose(pose) {
      const { hand = 'open', rot = 0, x = 50, y = 50, palm = 'out' } = pose;
      const shape = HANDSHAPES[hand] || HANDSHAPES.open;

      // Update finger paths
      shape.fingers.forEach((finger, i) => {
        const path = fingerPath(FINGER_ANCHORS[i], finger);
        this.fingerEls[i].setAttribute('d', path);
      });

      // Position & rotation of the whole hand
      // x,y are 0..100 percentages mapped to the 400x400 viewBox
      const px = x * 4;
      const py = y * 4;
      // Palm facing: 'in' (toward signer) = mirrored, 'out' = normal
      // 'down' = palm faces ground (rotate 90), 'up' = rotate -90
      let scaleX = 1;
      let extraRot = 0;
      if (palm === 'in') scaleX = -1;
      if (palm === 'down') extraRot = 90;
      if (palm === 'up') extraRot = -90;

      this.handGroup.setAttribute(
        'transform',
        `translate(${px} ${py}) rotate(${rot + extraRot}) scale(${scaleX} 1)`
      );
      // Smooth transitions
      this.handGroup.style.transition = `transform ${250 / this.speed}ms cubic-bezier(0.65, 0, 0.35, 1)`;
      this.fingerEls.forEach(el => {
        el.style.transition = `d ${250 / this.speed}ms cubic-bezier(0.65, 0, 0.35, 1)`;
      });
    }
  }

  // Expose
  window.BridgeTalkAnim = {
    createSvg,
    HandAnimator,
  };
})();
