#!/usr/bin/env python3
"""
BridgeTalk v5 — Alphabet RandomForest trainer
================================================

Trains a RandomForest classifier on hand-keypoint feature vectors for the
26 ASL alphabet letters.

By default this script uses **synthetic, anatomically-plausible keypoints**
generated procedurally from canonical handshapes (see `synthesize_letter`
below). Synthetic training is a stand-in so the demo runs end-to-end out
of the box; it should not be relied on for real users.

To train on REAL data, replace the synthesize block with a loader for your
own dataset. The expected feature contract is:

  X : (N, 63) float — flattened 21x3 MediaPipe Hand landmarks (x, y, z),
                     each row already normalized via `normalize_landmarks`
  y : (N,) str/int  — label per row, one of 'a'..'z'

Output:
  ../models/alphabet_rf.pkl  — joblib-pickled dict
                               { 'model': RandomForest, 'classes': [...],
                                 'feature_dim': 63, 'normalization': 'wrist-anchor' }

Run:
  cd training
  python train_model.py
"""
import os
import sys
import json
import time
import math
import random
import argparse
from pathlib import Path

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import joblib

# ----------------------------------------------------------------------
# Canonical hand template (21 landmarks at rest, palm flat facing camera)
# Coordinates are in a hand-local frame: wrist at origin, middle MCP up.
# Values are tuned to look like a right hand at "neutral" pose.
# ----------------------------------------------------------------------

# MediaPipe 21-pt indices:
#  0: WRIST
#  1-4: thumb (CMC, MCP, IP, TIP)
#  5-8: index (MCP, PIP, DIP, TIP)
#  9-12: middle (MCP, PIP, DIP, TIP)
# 13-16: ring (MCP, PIP, DIP, TIP)
# 17-20: pinky (MCP, PIP, DIP, TIP)

CANONICAL = np.array([
    # WRIST
    [ 0.00,  0.00, 0.0],
    # THUMB (extended outward to the right at rest)
    [-0.07,  0.04, 0.0],
    [-0.13, -0.02, 0.0],
    [-0.16, -0.08, 0.0],
    [-0.18, -0.13, 0.0],
    # INDEX
    [-0.05, -0.18, 0.0],
    [-0.05, -0.28, 0.0],
    [-0.05, -0.34, 0.0],
    [-0.05, -0.40, 0.0],
    # MIDDLE
    [ 0.00, -0.20, 0.0],
    [ 0.00, -0.31, 0.0],
    [ 0.00, -0.38, 0.0],
    [ 0.00, -0.45, 0.0],
    # RING
    [ 0.05, -0.18, 0.0],
    [ 0.05, -0.28, 0.0],
    [ 0.05, -0.34, 0.0],
    [ 0.05, -0.40, 0.0],
    # PINKY
    [ 0.10, -0.15, 0.0],
    [ 0.10, -0.23, 0.0],
    [ 0.10, -0.28, 0.0],
    [ 0.10, -0.33, 0.0],
], dtype=np.float64)

# Finger joint chains (MCP, PIP, DIP, TIP)
FINGERS = {
    'thumb':  [1, 2, 3, 4],
    'index':  [5, 6, 7, 8],
    'middle': [9, 10, 11, 12],
    'ring':   [13, 14, 15, 16],
    'pinky':  [17, 18, 19, 20],
}

# ----------------------------------------------------------------------
# ASL letter handshape spec
# ----------------------------------------------------------------------
# Each letter is described by the curl state of each finger:
#   'ext'   — fully extended
#   'curl'  — fully curled into palm
#   'half'  — bent at PIP only (used for E, O, etc.)
#   'cross' — index/middle crossed (R)
# Plus optional thumb position overrides.
#
# This is a simplified static representation; real ASL fingerspelling has
# subtle thumb placements that vary by letter. Good enough as a stand-in.

LETTER_SPEC = {
    'a': {'thumb': 'ext_side', 'index': 'curl', 'middle': 'curl', 'ring': 'curl', 'pinky': 'curl'},
    'b': {'thumb': 'tucked',   'index': 'ext',  'middle': 'ext',  'ring': 'ext',  'pinky': 'ext'},
    'c': {'thumb': 'curve',    'index': 'half', 'middle': 'half', 'ring': 'half', 'pinky': 'half'},
    'd': {'thumb': 'touch_m',  'index': 'ext',  'middle': 'curl', 'ring': 'curl', 'pinky': 'curl'},
    'e': {'thumb': 'tucked',   'index': 'half', 'middle': 'half', 'ring': 'half', 'pinky': 'half'},
    'f': {'thumb': 'touch_i',  'index': 'half', 'middle': 'ext',  'ring': 'ext',  'pinky': 'ext'},
    'g': {'thumb': 'side',     'index': 'ext_h','middle': 'curl', 'ring': 'curl', 'pinky': 'curl'},
    'h': {'thumb': 'tucked',   'index': 'ext_h','middle': 'ext_h','ring': 'curl', 'pinky': 'curl'},
    'i': {'thumb': 'tucked',   'index': 'curl', 'middle': 'curl', 'ring': 'curl', 'pinky': 'ext'},
    'j': {'thumb': 'tucked',   'index': 'curl', 'middle': 'curl', 'ring': 'curl', 'pinky': 'ext'},  # motion - same static as I
    'k': {'thumb': 'between',  'index': 'ext',  'middle': 'ext',  'ring': 'curl', 'pinky': 'curl'},
    'l': {'thumb': 'ext_side', 'index': 'ext',  'middle': 'curl', 'ring': 'curl', 'pinky': 'curl'},
    'm': {'thumb': 'under3',   'index': 'curl', 'middle': 'curl', 'ring': 'curl', 'pinky': 'curl'},
    'n': {'thumb': 'under2',   'index': 'curl', 'middle': 'curl', 'ring': 'curl', 'pinky': 'curl'},
    'o': {'thumb': 'touch_i',  'index': 'half', 'middle': 'half', 'ring': 'half', 'pinky': 'half'},
    'p': {'thumb': 'between',  'index': 'ext_d','middle': 'ext_d','ring': 'curl', 'pinky': 'curl'},
    'q': {'thumb': 'side_d',   'index': 'ext_d','middle': 'curl', 'ring': 'curl', 'pinky': 'curl'},
    'r': {'thumb': 'tucked',   'index': 'cross_m','middle': 'cross_i','ring': 'curl', 'pinky': 'curl'},
    's': {'thumb': 'over',     'index': 'curl', 'middle': 'curl', 'ring': 'curl', 'pinky': 'curl'},
    't': {'thumb': 'between_im','index': 'curl', 'middle': 'curl', 'ring': 'curl', 'pinky': 'curl'},
    'u': {'thumb': 'tucked',   'index': 'ext',  'middle': 'ext',  'ring': 'curl', 'pinky': 'curl'},
    'v': {'thumb': 'tucked',   'index': 'ext_l','middle': 'ext_r','ring': 'curl', 'pinky': 'curl'},
    'w': {'thumb': 'touch_p',  'index': 'ext_l','middle': 'ext',  'ring': 'ext_r','pinky': 'curl'},
    'x': {'thumb': 'tucked',   'index': 'hook', 'middle': 'curl', 'ring': 'curl', 'pinky': 'curl'},
    'y': {'thumb': 'ext_side', 'index': 'curl', 'middle': 'curl', 'ring': 'curl', 'pinky': 'ext'},
    'z': {'thumb': 'tucked',   'index': 'ext',  'middle': 'curl', 'ring': 'curl', 'pinky': 'curl'},  # motion
}

LETTERS = sorted(LETTER_SPEC.keys())


def curl_finger(landmarks, finger_name, mode):
    """Apply a curl mode to a finger by rotating its joint chain.

    Modes:
      ext     — fully extended (no change)
      curl    — fold into palm (roll all joints)
      half    — bent at MCP only (knuckle bend)
      hook    — bent only at PIP (X letter)
      ext_h   — extended but pointing horizontally
      ext_l   — extended, splayed left
      ext_r   — extended, splayed right
      ext_d   — extended, pointing down (P, Q)
      cross_i — extended and crossed over index
      cross_m — extended and crossed over middle
    """
    chain = FINGERS[finger_name]
    mcp, pip, dip, tip = chain
    pts = landmarks.copy()

    base = pts[mcp].copy()
    # Vector from MCP to TIP at rest
    tip_dir = pts[tip] - base
    finger_len = np.linalg.norm(tip_dir[:2])
    if finger_len < 1e-6:
        return pts

    if mode == 'ext':
        pass
    elif mode == 'curl':
        # Curl: bring tip down toward palm (rotate ~150° around MCP)
        for j_idx, j in enumerate([pip, dip, tip], start=1):
            offset = pts[j] - base
            ang = math.radians(150) * (j_idx / 3.0)
            cos, sin = math.cos(ang), math.sin(ang)
            # Rotate in y-z plane: into the palm (z increases ~= forward)
            new_y = offset[1] * cos + offset[2] * sin
            new_z = -offset[1] * sin + offset[2] * cos
            pts[j] = base + np.array([offset[0], new_y, new_z])
        # Bring curled tip closer to palm in y
        pts[tip][1] = base[1] + 0.04
        pts[dip][1] = base[1] + 0.02
    elif mode == 'half':
        # Knuckle bend ~70° (used for C, E, O)
        for j_idx, j in enumerate([pip, dip, tip], start=1):
            offset = pts[j] - base
            ang = math.radians(75) * (j_idx / 3.0)
            cos, sin = math.cos(ang), math.sin(ang)
            new_y = offset[1] * cos + offset[2] * sin
            new_z = -offset[1] * sin + offset[2] * cos
            pts[j] = base + np.array([offset[0], new_y, new_z])
    elif mode == 'hook':
        # Bent only at PIP (~90°), DIP nearly straight
        offset_pip = pts[pip] - base
        ang = math.radians(40)
        cos, sin = math.cos(ang), math.sin(ang)
        pts[pip] = base + np.array([offset_pip[0],
                                     offset_pip[1] * cos + offset_pip[2] * sin,
                                     -offset_pip[1] * sin + offset_pip[2] * cos])
        # DIP/TIP relative to PIP, bent further
        for j_idx, j in enumerate([dip, tip], start=1):
            offset = pts[j] - pts[pip] + np.array([0, 0.02 * j_idx, 0.05 * j_idx])
            pts[j] = pts[pip] + offset
    elif mode == 'ext_h':
        # Point horizontally (rotate 90° toward thumb side)
        for j in [pip, dip, tip]:
            offset = pts[j] - base
            ang = math.radians(-80)
            cos, sin = math.cos(ang), math.sin(ang)
            new_x = offset[0] * cos - offset[1] * sin
            new_y = offset[0] * sin + offset[1] * cos
            pts[j] = base + np.array([new_x, new_y, offset[2]])
    elif mode == 'ext_l':
        for j in [pip, dip, tip]:
            offset = pts[j] - base
            ang = math.radians(-15)
            cos, sin = math.cos(ang), math.sin(ang)
            new_x = offset[0] * cos - offset[1] * sin
            new_y = offset[0] * sin + offset[1] * cos
            pts[j] = base + np.array([new_x, new_y, offset[2]])
    elif mode == 'ext_r':
        for j in [pip, dip, tip]:
            offset = pts[j] - base
            ang = math.radians(15)
            cos, sin = math.cos(ang), math.sin(ang)
            new_x = offset[0] * cos - offset[1] * sin
            new_y = offset[0] * sin + offset[1] * cos
            pts[j] = base + np.array([new_x, new_y, offset[2]])
    elif mode == 'ext_d':
        # Point downward
        for j in [pip, dip, tip]:
            offset = pts[j] - base
            ang = math.radians(180)
            cos, sin = math.cos(ang), math.sin(ang)
            new_y = offset[1] * cos + offset[2] * sin
            new_z = -offset[1] * sin + offset[2] * cos
            pts[j] = base + np.array([offset[0], new_y, new_z])
    elif mode == 'cross_i':
        # Cross over index: shift to negative-x slightly
        for j in [pip, dip, tip]:
            offset = pts[j] - base
            pts[j] = base + np.array([offset[0] - 0.06, offset[1] * 0.95, offset[2]])
    elif mode == 'cross_m':
        for j in [pip, dip, tip]:
            offset = pts[j] - base
            pts[j] = base + np.array([offset[0] + 0.04, offset[1] * 0.95, offset[2]])
    return pts


def thumb_pose(landmarks, mode):
    """Apply a thumb-position override."""
    pts = landmarks.copy()
    # Thumb chain: 1 (CMC), 2 (MCP), 3 (IP), 4 (TIP)
    if mode == 'ext_side':
        # Extended outward to the side - default, no change
        pass
    elif mode == 'tucked':
        pts[2] = np.array([-0.05,  0.00, 0.02])
        pts[3] = np.array([-0.04, -0.05, 0.02])
        pts[4] = np.array([-0.02, -0.10, 0.02])
    elif mode == 'curve':
        # C-shape thumb (curved arc opposite fingers)
        pts[2] = np.array([-0.13, -0.05, 0.0])
        pts[3] = np.array([-0.12, -0.13, 0.0])
        pts[4] = np.array([-0.05, -0.18, 0.0])
    elif mode == 'touch_m':
        # Thumb tip touches middle finger MCP (D-shape)
        pts[4] = pts[9].copy() + np.array([0, 0.01, 0])
        pts[3] = (pts[2] + pts[4]) / 2
    elif mode == 'touch_i':
        # F/O thumb-index pinch
        pts[4] = pts[8].copy() + np.array([0.02, 0.01, 0])
        pts[3] = (pts[2] + pts[4]) / 2
    elif mode == 'touch_p':
        # W: thumb to pinky
        pts[4] = pts[20].copy() + np.array([0.01, 0.02, 0])
        pts[3] = (pts[2] + pts[4]) / 2
    elif mode == 'side':
        pts[3] = pts[3] + np.array([0.02, -0.05, 0])
        pts[4] = pts[4] + np.array([0.04, -0.10, 0])
    elif mode == 'side_d':
        pts[3] = pts[3] + np.array([0.02, 0.10, 0])
        pts[4] = pts[4] + np.array([0.04, 0.20, 0])
    elif mode == 'between':
        # K: thumb between index and middle
        pts[4] = (pts[5] + pts[9]) / 2 + np.array([0, -0.02, 0])
        pts[3] = (pts[2] + pts[4]) / 2
    elif mode == 'between_im':
        # T: thumb wedged between bent index and middle
        pts[4] = (pts[6] + pts[10]) / 2 + np.array([0, 0.02, 0])
        pts[3] = (pts[2] + pts[4]) / 2
    elif mode == 'over':
        # S: thumb crosses over fist
        pts[4] = np.array([0.03, -0.06, 0.0])
        pts[3] = np.array([-0.06, -0.04, 0.0])
    elif mode == 'under3':
        # M: thumb under three fingers
        pts[4] = np.array([0.06, 0.05, 0.02])
    elif mode == 'under2':
        # N: thumb under two fingers
        pts[4] = np.array([0.02, 0.05, 0.02])
    return pts


def synthesize_letter(letter, jitter=0.012, scale_jit=0.10, rot_jit=12.0):
    """Generate one synthetic 21x3 keypoint sample for the given letter.

    Adds small Gaussian noise on positions plus a global rotation and scale
    to approximate real-camera variation.
    """
    spec = LETTER_SPEC[letter]
    pts = CANONICAL.copy()

    # Apply finger curls (apply curls before thumb so thumb-touch positions
    # land on correctly curled fingertips).
    for f in ['index', 'middle', 'ring', 'pinky']:
        pts = curl_finger(pts, f, spec[f])
    # Thumb: handled by thumb_pose
    pts = thumb_pose(pts, spec['thumb'])
    # Some letters have specific thumb finger curl too (e.g. ext_side)
    if spec['thumb'] in ('ext_side',):
        pts = curl_finger(pts, 'thumb', 'ext')

    # Per-point Gaussian jitter
    pts = pts + np.random.normal(0, jitter, pts.shape)

    # Global scale jitter
    s = 1.0 + np.random.normal(0, scale_jit)
    pts = pts * s

    # Global 2D rotation jitter (around wrist)
    theta = math.radians(np.random.normal(0, rot_jit))
    cos, sin = math.cos(theta), math.sin(theta)
    R = np.array([[cos, -sin, 0], [sin, cos, 0], [0, 0, 1]])
    pts = pts @ R.T

    # Global translation (simulating the user's hand being anywhere in frame)
    pts = pts + np.array([np.random.uniform(0.2, 0.8),
                          np.random.uniform(0.2, 0.8),
                          0.0])

    return pts


def normalize_landmarks(pts):
    """Translate to wrist origin, scale by hand size (wrist→middle MCP).

    Returns a flat (63,) feature vector. This MUST match the normalization
    used in the browser before posting to /api/predict.
    """
    wrist = pts[0]
    centered = pts - wrist
    # Hand size: distance from wrist to middle MCP (landmark 9)
    size = np.linalg.norm(centered[9])
    if size < 1e-6:
        size = 1.0
    normalized = centered / size
    return normalized.flatten()


def build_dataset(samples_per_letter=400):
    print(f"Generating synthetic dataset: {samples_per_letter} samples × {len(LETTERS)} letters "
          f"= {samples_per_letter * len(LETTERS)} total")
    X = []
    y = []
    for letter in LETTERS:
        for _ in range(samples_per_letter):
            pts = synthesize_letter(letter)
            feat = normalize_landmarks(pts)
            X.append(feat)
            y.append(letter)
    return np.array(X), np.array(y)


def main():
    parser = argparse.ArgumentParser(description="Train BridgeTalk alphabet RandomForest")
    parser.add_argument('--samples-per-letter', type=int, default=400)
    parser.add_argument('--n-estimators', type=int, default=200)
    parser.add_argument('--max-depth', type=int, default=20)
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--output', type=str,
                        default=str(Path(__file__).parent.parent / 'models' / 'alphabet_rf.pkl'))
    parser.add_argument('--no-cv', action='store_true', help='Skip cross-validation')
    args = parser.parse_args()

    np.random.seed(args.seed)
    random.seed(args.seed)

    X, y = build_dataset(args.samples_per_letter)
    print(f"Dataset shape: X={X.shape}, y={y.shape}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=args.seed, stratify=y)

    print(f"Training RandomForest (n_estimators={args.n_estimators}, max_depth={args.max_depth}) ...")
    t0 = time.time()
    clf = RandomForestClassifier(
        n_estimators=args.n_estimators,
        max_depth=args.max_depth,
        n_jobs=-1,
        random_state=args.seed,
        class_weight='balanced',
    )
    clf.fit(X_train, y_train)
    print(f"  trained in {time.time() - t0:.1f}s")

    train_acc = clf.score(X_train, y_train)
    test_acc = clf.score(X_test, y_test)
    print(f"Train accuracy: {train_acc:.4f}")
    print(f"Test  accuracy: {test_acc:.4f}")

    if not args.no_cv:
        print("Running 5-fold cross-validation ...")
        cv = cross_val_score(clf, X, y, cv=5, n_jobs=-1)
        print(f"CV accuracy: {cv.mean():.4f} ± {cv.std():.4f}")

    print("\nPer-letter performance (test set):")
    print(classification_report(y_test, clf.predict(X_test), digits=3))

    # Save bundle
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    bundle = {
        'model': clf,
        'classes': list(clf.classes_),
        'feature_dim': 63,
        'normalization': 'wrist-anchor, scale by ||p9 - p0||',
        'trained_on': 'synthetic',
        'samples_per_letter': args.samples_per_letter,
        'sklearn_version': __import__('sklearn').__version__,
    }
    joblib.dump(bundle, out_path)
    print(f"\nSaved model bundle → {out_path}")
    print(f"  size: {out_path.stat().st_size / 1024:.1f} KB")


if __name__ == '__main__':
    main()
