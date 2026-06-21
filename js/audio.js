/* ============================================================
   BridgeTalk v6 — Audio Feedback
   ============================================================
   Tiny WebAudio "click" played when a sign is emitted. Optional —
   gated by settings.audioFeedback.

   Why a click and not a chime? In a live signing studio you want
   the cue to be informationally dense and non-distracting; a soft
   tick at ~880 Hz takes ~50 ms and won't compete with TTS.
   ============================================================ */

let ctx = null;

function getCtx() {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    return null;
  }
  return ctx;
}

/** Brief tick — emit on token */
export function tick(volume = 0.08) {
  const c = getCtx();
  if (!c) return;
  // Resume context (Chrome autoplay policy)
  if (c.state === 'suspended') c.resume?.();
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, t);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.1);
}

/** Lower tick — emit on errors / unrecognised */
export function blip(volume = 0.05) {
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume?.();
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(220, t);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.18);
}
