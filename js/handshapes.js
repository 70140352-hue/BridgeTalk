/* ============================================================
   BridgeTalk v5 — Handshape Classifier
   ============================================================
   Pure, stateless classification of a 21-point MediaPipe hand
   into a handshape name. Uses joint-angle finger curl and a
   strict 5-bit signature lookup (no fall-through defaults that
   would default to 'four' or 'flat' for ambiguous poses).
   ============================================================ */

export const TIPS  = { thumb: 4, index: 8,  middle: 12, ring: 16, pinky: 20 };
export const DIPS  = { thumb: 3, index: 7,  middle: 11, ring: 15, pinky: 19 };
export const PIPS  = { thumb: 2, index: 6,  middle: 10, ring: 14, pinky: 18 };
export const MCPS  = { thumb: 1, index: 5,  middle: 9,  ring: 13, pinky: 17 };
export const WRIST = 0;

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const dist3 = (a, b) =>
  Math.hypot(a.x - b.x, a.y - b.y, ((a.z || 0) - (b.z || 0)));

/**
 * Angle at point B formed by A-B-C in degrees (0..180).
 * 180° = straight line, 0° = fully folded.
 */
export function jointAngle(a, b, c) {
  const v1x = a.x - b.x, v1y = a.y - b.y;
  const v2x = c.x - b.x, v2y = c.y - b.y;
  const dot = v1x * v2x + v1y * v2y;
  const m1 = Math.hypot(v1x, v1y) || 1e-6;
  const m2 = Math.hypot(v2x, v2y) || 1e-6;
  const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Is non-thumb finger extended? (PIP and DIP both roughly straight) */
function nonThumbExtended(lm, finger) {
  const mcp = lm[MCPS[finger]];
  const pip = lm[PIPS[finger]];
  const dip = lm[DIPS[finger]];
  const tip = lm[TIPS[finger]];
  const pipAngle = jointAngle(mcp, pip, dip);
  const dipAngle = jointAngle(pip, dip, tip);
  return pipAngle > 150 && dipAngle > 140;
}

/** Thumb extended via IP joint angle and tip distance from index MCP. */
function thumbExtended(lm) {
  const mcp = lm[PIPS.thumb];     // 2
  const ip  = lm[DIPS.thumb];     // 3
  const tip = lm[TIPS.thumb];     // 4
  const indexMcp = lm[MCPS.index];
  const pinkyMcp = lm[MCPS.pinky];
  const palmWidth = dist(indexMcp, pinkyMcp) || 0.1;
  const ipAngle = jointAngle(mcp, ip, tip);
  const tipToIndex = dist(tip, indexMcp) / palmWidth;
  if (ipAngle > 150 && tipToIndex > 0.8) return true;
  if (tipToIndex > 1.2) return true;
  return false;
}

export function fingerExtended(lm, finger) {
  if (finger === 'thumb') return thumbExtended(lm);
  return nonThumbExtended(lm, finger);
}

export function fingerSignature(lm) {
  return [
    fingerExtended(lm, 'thumb'),
    fingerExtended(lm, 'index'),
    fingerExtended(lm, 'middle'),
    fingerExtended(lm, 'ring'),
    fingerExtended(lm, 'pinky'),
  ];
}

/**
 * Strict shape classifier — exact bit-pattern match only. Returns
 * 'unknown' for ambiguous poses (no fall-through).
 */
export function classifyHandshape(lm) {
  const [t, i, m, r, p] = fingerSignature(lm);
  const code = (t?16:0) + (i?8:0) + (m?4:0) + (r?2:0) + (p?1:0);

  switch (code) {
    case 0b00000: return 'fist';
    case 0b10000: return 'thumb';
    case 0b01000: return 'point';
    case 0b00001: return 'pinky';
    case 0b10001: return 'y';
    case 0b11000: return 'l';
    case 0b01100: return 'peace';
    case 0b01110: return 'three';
    case 0b01111: return 'four';
    case 0b11111: return 'open';
    case 0b11110: return 'flat';
    case 0b01001: return 'rock';
    case 0b11100: return 'three-t';
    case 0b11001: return 'y';
    case 0b00100: return 'middle';
    case 0b00010: return 'ring';
    case 0b00011: return 'pinky-ring';
    case 0b00111: return 'three';
  }
  return 'unknown';
}

export function handCenter(lm) {
  const pts = [WRIST, MCPS.index, MCPS.middle, MCPS.ring, MCPS.pinky].map(i => lm[i]);
  const cx = pts.reduce((s, q) => s + q.x, 0) / pts.length;
  const cy = pts.reduce((s, q) => s + q.y, 0) / pts.length;
  return { x: cx, y: cy };
}

export function palmAngle(lm) {
  const w = lm[WRIST], m = lm[MCPS.middle];
  return Math.atan2(m.x - w.x, w.y - m.y) * (180 / Math.PI);
}

export function palmFacing(lm, handedness) {
  const w = lm[WRIST], i = lm[MCPS.index], p = lm[MCPS.pinky];
  const v1x = i.x - w.x, v1y = i.y - w.y;
  const v2x = p.x - w.x, v2y = p.y - w.y;
  const cross = v1x * v2y - v1y * v2x;
  const sign = handedness === 'Left' ? -1 : 1;
  return cross * sign > 0 ? 'out' : 'in';
}

export function handSize(lm) {
  return Math.max(0.001, dist(lm[WRIST], lm[MCPS.middle]));
}

/** Tip of a given finger (returns landmark point). */
export function fingertip(lm, finger) {
  return lm[TIPS[finger]];
}
