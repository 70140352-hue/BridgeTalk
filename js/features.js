/* ============================================================
   BridgeTalk v5 — Feature Extraction
   ============================================================
   Combines hands + face + pose into a single per-frame feature
   record that recognition rules consume:

   {
     t, dt,
     hands: { left: HandFeatures, right: HandFeatures, primary: HandFeatures },
     anchors, faceWidth,
     gaze: { tilt, yaw },         // approx face orientation
     bothHands: boolean,
     handsTouching: boolean,      // are the two hands in contact?
   }

   HandFeatures:
   {
     handedness, lm, shape, sig, sigCode,
     center, palmAngle, facing,
     contact: { anchor, finger, confidence } | null,
     stableContact: same shape as contact, or null,
   }
   ============================================================ */

import {
  classifyHandshape, fingerSignature, handCenter, palmAngle,
  palmFacing, handSize, dist,
} from './handshapes.js';
import { computeAnchors } from './anchors.js';
import { detectContact } from './contact.js';

const FACE_ANCHOR_FOR_GAZE = 1; // nose tip

export function extractHandFeatures(lm, handedness, anchors, faceWidth) {
  const sig = fingerSignature(lm);
  const sigCode = (sig[0]?16:0)+(sig[1]?8:0)+(sig[2]?4:0)+(sig[3]?2:0)+(sig[4]?1:0);
  return {
    handedness,
    lm,
    shape: classifyHandshape(lm),
    sig, sigCode,
    center: handCenter(lm),
    palmAngle: palmAngle(lm),
    facing: palmFacing(lm, handedness),
    size: handSize(lm),
    contact: detectContact(lm, anchors, faceWidth),
  };
}

/**
 * Build a complete frame feature record from MediaPipe Holistic results.
 *
 * @param {Object} results — { leftHandLandmarks, rightHandLandmarks,
 *                             poseLandmarks, faceLandmarks }
 * @param {number} t — frame timestamp (ms)
 * @param {number} prevT — previous frame timestamp (ms)
 */
export function extractFrame(results, t, prevT) {
  const dt = prevT ? (t - prevT) / 1000 : 0;
  const { faceLandmarks, poseLandmarks, leftHandLandmarks, rightHandLandmarks } = results;

  const { anchors, faceWidth, available } = computeAnchors(faceLandmarks, poseLandmarks);

  const hands = { left: null, right: null, primary: null };
  if (leftHandLandmarks) {
    hands.left = extractHandFeatures(leftHandLandmarks, 'Left', anchors, faceWidth);
  }
  if (rightHandLandmarks) {
    hands.right = extractHandFeatures(rightHandLandmarks, 'Right', anchors, faceWidth);
  }

  // Choose the primary (active) hand: whichever has a contact, else the more
  // motion-y one, else right by default.
  if (hands.left && hands.right) {
    if (hands.left.contact && !hands.right.contact) hands.primary = hands.left;
    else if (hands.right.contact && !hands.left.contact) hands.primary = hands.right;
    else hands.primary = hands.right; // default
  } else {
    hands.primary = hands.left || hands.right;
  }

  // Are the two hands touching each other?
  let handsTouching = false;
  if (hands.left && hands.right) {
    const d = dist(hands.left.center, hands.right.center);
    handsTouching = d < faceWidth * 0.7;
  }

  // Approximate face yaw/tilt from facemesh (cheap heuristic)
  let gaze = null;
  if (faceLandmarks && faceLandmarks.length >= 468) {
    const nose = faceLandmarks[FACE_ANCHOR_FOR_GAZE];
    const lEar = faceLandmarks[234], rEar = faceLandmarks[454];
    const earMid = { x: (lEar.x + rEar.x) / 2, y: (lEar.y + rEar.y) / 2 };
    gaze = {
      yaw: nose.x - earMid.x,         // + = looking right (image)
      tilt: nose.y - earMid.y,        // + = looking down
    };
  }

  return {
    t, dt,
    hands,
    anchors,
    faceWidth,
    available,
    bothHands: !!(hands.left && hands.right),
    handsTouching,
    gaze,
  };
}
