/* ============================================================
   BridgeTalk v5 — Body Anchors
   ============================================================
   Computes 14 named body regions every frame from MediaPipe
   Holistic outputs (poseLandmarks + faceLandmarks). Returns a
   dictionary { regionName -> {x, y, radius} } in normalized
   image coordinates (0..1).

   Anchors:
     chin, forehead, nose, mouth, cheek_l, cheek_r,
     ear_l, ear_r, temple_l, temple_r,
     chest, shoulder_l, shoulder_r,
     neutral_space  (the signing space in front of chest)
   ============================================================ */

// MediaPipe FaceMesh canonical landmark indices
// (468-point face mesh — these are stable across face orientations)
const FACE = {
  CHIN: 152,
  FOREHEAD: 10,
  NOSE_TIP: 1,
  UPPER_LIP: 13,
  LOWER_LIP: 14,
  LEFT_EYE: 33,
  RIGHT_EYE: 263,
  LEFT_EAR_TRAGUS: 234,
  RIGHT_EAR_TRAGUS: 454,
  LEFT_CHEEK: 117,
  RIGHT_CHEEK: 346,
  LEFT_TEMPLE: 127,
  RIGHT_TEMPLE: 356,
};

// MediaPipe Pose canonical indices
const POSE = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * Compute all body anchors for the current frame.
 *
 * @param {Array|null} face — 468-pt face mesh array, or null
 * @param {Array|null} pose — 33-pt pose array, or null
 * @returns {Object} { anchors, faceWidth, available }
 *
 * Each anchor is { x, y, radius } in normalized coords. Radius
 * is the contact threshold tuned to face proportions, so signs
 * work whether the user is close to or far from the camera.
 */
export function computeAnchors(face, pose) {
  const anchors = {};
  let faceWidth = null;
  let faceAvailable = false;
  let poseAvailable = false;

  // ---- Face-derived anchors ----
  if (face && face.length >= 468) {
    faceAvailable = true;
    const leftEar = face[FACE.LEFT_EAR_TRAGUS];
    const rightEar = face[FACE.RIGHT_EAR_TRAGUS];
    faceWidth = dist(leftEar, rightEar);
    // Sanity: occasionally MediaPipe loses tracking and emits zero-width.
    if (!faceWidth || faceWidth < 0.02) faceWidth = 0.15;

    const r = faceWidth * 0.18;       // generic small-region radius
    const rMid = faceWidth * 0.22;    // medium
    const rBig = faceWidth * 0.28;    // big

    anchors.chin     = anchorAt(face[FACE.CHIN], r);
    anchors.forehead = anchorAt(face[FACE.FOREHEAD], rMid);
    anchors.nose     = anchorAt(face[FACE.NOSE_TIP], r * 0.85);
    anchors.mouth    = anchorAt(mid(face[FACE.UPPER_LIP], face[FACE.LOWER_LIP]), r);
    anchors.cheek_l  = anchorAt(face[FACE.LEFT_CHEEK], r);
    anchors.cheek_r  = anchorAt(face[FACE.RIGHT_CHEEK], r);
    anchors.ear_l    = anchorAt(face[FACE.LEFT_EAR_TRAGUS], r * 0.9);
    anchors.ear_r    = anchorAt(face[FACE.RIGHT_EAR_TRAGUS], r * 0.9);
    anchors.temple_l = anchorAt(face[FACE.LEFT_TEMPLE], r);
    anchors.temple_r = anchorAt(face[FACE.RIGHT_TEMPLE], r);
  }

  // ---- Pose-derived anchors ----
  if (pose && pose.length >= 25) {
    poseAvailable = true;
    const lShoulder = pose[POSE.LEFT_SHOULDER];
    const rShoulder = pose[POSE.RIGHT_SHOULDER];
    const lHip = pose[POSE.LEFT_HIP];
    const rHip = pose[POSE.RIGHT_HIP];
    const shoulderWidth = dist(lShoulder, rShoulder);

    // If face missing, fallback face-width estimate from shoulder width
    if (!faceWidth || faceWidth < 0.02) {
      faceWidth = shoulderWidth * 0.5;
    }

    const r = faceWidth * 0.22;
    const rChest = shoulderWidth * 0.30;

    anchors.shoulder_l = anchorAt(lShoulder, r);
    anchors.shoulder_r = anchorAt(rShoulder, r);

    // Chest = midpoint between shoulders, biased downward slightly
    const shoulderMid = mid(lShoulder, rShoulder);
    anchors.chest = anchorAt(
      { x: shoulderMid.x, y: shoulderMid.y + shoulderWidth * 0.18 },
      rChest
    );

    // Neutral signing space: in front of chest, bigger zone
    anchors.neutral_space = anchorAt(
      { x: shoulderMid.x, y: shoulderMid.y + shoulderWidth * 0.35 },
      shoulderWidth * 0.55
    );

    // Lap: below hips
    if (lHip && rHip) {
      const hipMid = mid(lHip, rHip);
      anchors.lap = anchorAt(
        { x: hipMid.x, y: hipMid.y + shoulderWidth * 0.25 },
        shoulderWidth * 0.4
      );
    }
  }

  return {
    anchors,
    faceWidth: faceWidth || 0.15,
    available: { face: faceAvailable, pose: poseAvailable },
  };
}

function anchorAt(point, radius) {
  if (!point) return null;
  return { x: point.x, y: point.y, radius };
}

/**
 * Region groupings for sign rules. Lets a sign say "near upper face"
 * instead of having to enumerate forehead/temples/eyes.
 */
export const REGION_GROUPS = {
  upper_face:   ['forehead', 'temple_l', 'temple_r'],
  mid_face:     ['nose', 'cheek_l', 'cheek_r'],
  lower_face:   ['mouth', 'chin'],
  ears:         ['ear_l', 'ear_r'],
  shoulders:    ['shoulder_l', 'shoulder_r'],
  torso:        ['chest', 'neutral_space'],
};

export function regionGroupOf(anchorName) {
  for (const [group, names] of Object.entries(REGION_GROUPS)) {
    if (names.includes(anchorName)) return group;
  }
  return null;
}
