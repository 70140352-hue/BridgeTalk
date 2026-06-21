# BridgeTalk v6 — Multimodal Sign Language Communication

A browser-based sign-language communication system with two complementary
recognition modes:

1. **Signs mode** — rule-based recognizer for ~90 location/shape/motion
   signs (handshape × body anchor × motion), running entirely in the
   browser via MediaPipe Holistic.
2. **Alphabet ML mode** — a RandomForest classifier for the 26 ASL
   fingerspelling letters, served from a local Python backend.

Plus a **Text → Sign** page that renders typed sentences as animated
handshapes.

> **Read the [Honest scope](#honest-scope) section before deploying.**
> This is real recognition infrastructure, not a "full sign language
> translator." Anyone claiming the latter in a browser today is selling
> snake oil.

---

## What's new in v6

v6 is a usability + robustness pass over v5. The recognition core is the
same; everything around it got better.

- **In-app settings panel** — adjust confidence threshold, hold time,
  cooldown, alphabet-ML stability filter, overlay layers, TTS speed,
  and theme without touching code. Settings persist in localStorage.
- **Sentence history** — every Speak / Copy / Clear records the
  finalized sentence, viewable in a side panel. Replay TTS, copy, or
  export the whole log as JSON.
- **Top-3 alternatives** — alphabet ML mode now shows its three highest-
  confidence guesses as a ladder, not just the winner. Makes M/N/T and
  J/I confusion visible instead of mysterious.
- **Working contact highlight** — v5's `drawContacts()` was a no-op.
  v6 actually shows a glowing ring + label when your fingertip lands
  on a body anchor, so you know *why* the recognizer fired.
- **FPS counter** (toggleable) — pinned top-right of the camera.
- **Audio click feedback** (toggleable) — a soft 880 Hz tick when a sign
  is emitted.
- **Keyboard shortcuts** — Space (start/stop), 1/2 (mode), U (undo),
  C (copy), Enter (speak), Esc (clear), S (settings).
- **Theme toggle** — auto/dark/light. Honoured app-wide; no FOUC.
- **Vocab search** — quick filter over the ~90 signs.
- **Camera disconnect recovery** — if the OS hot-plugs the camera away,
  the UI degrades gracefully instead of going silent.
- **Auto-retry on backend** — if you start the page before `serve.py`,
  the alphabet mode polls `/api/health` every 10 s and switches on once
  it's up.
- **Backend stats endpoint** — `/api/health` now reports uptime,
  request count, error count, and p95 latency.
- **Batch prediction endpoint** — `POST /api/predict_batch` for
  evaluating many frames in one round-trip.
- **CORS on /api/\*** — the page can now be served from a different
  origin (e.g. a Vite dev server) and still hit the local backend.
- **Text-to-sign improvements** — speed slider, pause/resume, loop,
  progress bar, live token preview, quick-pick example phrases,
  active-token highlighting.
- **Mobile sidebar** — collapses to a horizontal nav bar on phones
  instead of disappearing entirely.

Behavioural & UX bugs fixed:
- v5's `app.js` had a dead `isCommunicate` variable and a
  mode-switching path that could leave Holistic stopped after toggling
  back from Alphabet. v6 has explicit start/stop transitions.
- v5's Start button never let you stop the camera; v6's toggles.
- v5's overlay `drawContacts` highlighted nothing.

---

## Quick start

```bash
cd bridgetalk-v6

# (optional) Python dependencies for the alphabet backend.
# Pre-trained model already shipped, so this is only needed if you
# want to retrain:
pip install scikit-learn numpy joblib

# run the server (serves static files + alphabet ML endpoint):
python3 serve.py

# Browser opens automatically. Or visit:
#   http://localhost:8080/index.html
```

Useful flags:

```
python3 serve.py --port 9000        # custom port
python3 serve.py --no-open          # don't open the browser (SSH/CI)
python3 serve.py --host 0.0.0.0     # bind all interfaces (LAN demo)
```

Tested in Chrome 120+, Edge 120+, Safari 17+. Firefox works but the
MediaPipe builds are slower there.

The server logs whether the alphabet model loaded; if it didn't, the
"Alphabet ML" toggle in the UI shows a clear error and starts retrying
every 10 seconds. Signs mode keeps working without the backend.

---

## Keyboard shortcuts (communicate page)

| Key       | Action                       |
|-----------|------------------------------|
| `Space`   | Start / stop camera          |
| `1`       | Switch to Signs mode         |
| `2`       | Switch to Alphabet ML mode   |
| `U`       | Undo last word               |
| `C`       | Copy sentence                |
| `Enter`   | Speak sentence               |
| `Esc`     | Clear sentence / close panel |
| `S`       | Toggle settings panel        |

---

## What works today

### Signs mode (rule-based, browser-only)

- **543-point holistic landmarks** per frame (21 × 2 hands + 33 pose +
  468 face) via MediaPipe Holistic.
- **14 named body anchors** computed every frame from face + pose:
  `chin, forehead, nose, mouth, cheek_l, cheek_r, ear_l, ear_r,
  temple_l, temple_r, chest, shoulder_l, shoulder_r, neutral_space,
  lap`. Radii scale with face width so signs work near or far from the
  camera.
- **Contact engine** that detects which fingertip touches which anchor,
  with dwell-time tracking to filter out accidental brushes.
- **~90 signs** distributed across location, shape, and motion
  categories.
- **Real-time sentence builder** with auto-spacing, light grammar,
  undo / clear / copy / text-to-speech (Web Speech API).
- **Skeleton overlay** drawing hands, pose, face mesh, body anchors,
  and contact highlights.

### Alphabet ML mode

- **MediaPipe Hands** (single-hand, 21 landmarks) replaces Holistic when
  the user toggles to Alphabet mode. Hands is faster and more accurate
  than Holistic for fingerspelling-only.
- **POST /api/predict** sends raw landmarks to the backend. The server
  normalizes (wrist-anchor + scale by hand size) and runs the
  RandomForest. Single source of truth for normalization → no
  client/server drift.
- **StableLetterFilter** in the browser requires N consecutive frames
  (default 3) of the same prediction at ≥ minConf (default 0.55) before
  emitting, with a 700 ms cooldown. All three numbers are tunable from
  the settings panel.
- **Top-3 ladder** shows the three highest-probability letters with
  confidence bars, so you can see when the model is uncertain.

### Text → Sign

- Type any English; words in the dictionary play their canonical
  handshape sequence; unknown words and numbers are fingerspelled
  letter-by-letter.
- Speed control (0.5×–2×), pause/resume, loop, live token preview.
- Quick-pick example phrases to try the rendering instantly.

---

## Architecture

```
bridgetalk-v6/
├── index.html              landing page + hero
├── communicate.html        live signing studio (sign → text)
├── text-to-sign.html       reverse: typed text → animated signs
├── style.css               unified design system
├── serve.py                local server + /api/{health,predict,predict_batch,version}
├── dictionary.js           text-to-sign word dictionary
├── models/
│   └── alphabet_rf.pkl     pre-trained RandomForest (synthetic data)
├── training/
│   └── train_model.py      retrain the alphabet model
└── js/
    ├── app.js              entry: page wiring, MediaPipe boot
    ├── handshapes.js       angle-based finger curl + bit-pattern shapes
    ├── anchors.js          14 body regions from face + pose
    ├── contact.js          fingertip ↔ anchor proximity + dwell
    ├── features.js         per-frame multimodal feature extraction
    ├── vocabulary.js       ~90 sign rules
    ├── recognizer.js       pipeline orchestrator with smoothing
    ├── sentence.js         sentence builder + Web Speech TTS
    ├── overlay.js          canvas skeleton drawing
    ├── animations.js       text-to-sign hand renderer
    ├── alphabet-ml.js      MediaPipe Hands + /api/predict client
    ├── settings.js         persisted settings store (v6)
    ├── history.js          persisted sentence log (v6)
    └── audio.js            click/blip feedback (v6)
```

---

## Pipeline (Signs mode)

```
   Webcam
     │
     ▼
  MediaPipe Holistic (browser, WebAssembly)
     │   leftHand, rightHand, pose, face
     ▼
  anchors.js  →  14 named body regions
     │
     ▼
  features.js →  per-frame { hands, anchors, faceWidth, gaze, ... }
     │
     ▼
  recognizer.js
     ├─ ContactTracker (per hand, dwell)
     ├─ ring buffer (1.5 s)
     ├─ vocabulary rules (location → motion → shape)
     ├─ smoothing + cooldown
     └─ token emission
     │
     ▼
  sentence.js → text → SpeechSynthesis
     │
     ▼
  history.js (on Speak/Copy/Clear)
```

## Pipeline (Alphabet ML mode)

```
   Webcam
     │
     ▼
  MediaPipe Hands (browser)  →  21 landmarks
     │
     ▼
  alphabet-ml.js (rate-limited POST every ~220 ms)
     │
     ▼
  /api/predict (Python, RandomForest)
     ├─ wrist-anchor normalization
     ├─ scale by ||p9 - p0|| (hand size)
     └─ predict_proba → {letter, confidence, top3}
     │
     ▼
  StableLetterFilter (N-of-N + cooldown, all tunable)
     │
     ▼
  sentence.js (fingerspell tokens merge into words)
```

---

## API reference

The backend exposes these endpoints (CORS-enabled):

### `GET /api/health`

Returns model status and server stats.

```json
{
  "ok": true,
  "model_loaded": true,
  "error": null,
  "classes": ["a", "b", ..., "z"],
  "trained_on": "synthetic",
  "stats": {
    "uptime_s": 412.3,
    "predict_count": 1845,
    "predict_errors": 2,
    "latency_avg_ms": 3.4,
    "latency_p95_ms": 6.1
  },
  "version": "6.0"
}
```

### `POST /api/predict`

```json
// request
{ "landmarks": [[x, y, z], ...21 points] }

// response
{ "letter": "a", "confidence": 0.78,
  "top3": [{"letter":"a","confidence":0.78},
           {"letter":"e","confidence":0.09},
           {"letter":"s","confidence":0.06}] }
```

### `POST /api/predict_batch`

```json
// request
{ "samples": [{"landmarks": [...]}, ...] }

// response
{ "count": 12, "results": [{...}, ...] }
```

Useful for offline evaluation: feed a CSV of frames through the same
pipeline as live inference.

### `GET /api/version`

```json
{ "version": "6.0", "name": "BridgeTalk" }
```

---

## Honest scope

- **There is no browser-shippable model in 2026 that does general PSL
  or ASL conversation reliably.** Research models like WLASL/How2Sign
  need server GPUs and still top out around 60–70% top-1 on isolated
  signs over a few-thousand-word vocabulary. Continuous sign translation
  is harder still.
- **The ~90 rule-based signs work because their signature is unambiguous**
  (specific shape × specific body anchor × specific motion). Adding many
  more signs past this point causes confusion between similar signs
  unless you train a model.
- **The shipped alphabet model was trained on synthetic keypoint data**
  generated procedurally from canonical ASL handshapes. Cross-validation
  reports ~95% accuracy on the synthetic test set, but real-user
  performance will be lower — somewhere in the 60–80% range depending
  on lighting and signing style. Letters that depend on motion (J, Z)
  or subtle thumb position (M/N, I/J) are inherently ambiguous in a
  static-frame model. The training script and feature contract are
  documented so you can retrain on real data when you have it.
- **The recognizer exposes a `modelHook` seam in `js/recognizer.js`**.
  A learned isolated-sign model can be plugged in there to augment or
  replace the rules.

If you need true PSL conversation translation today, you need:
(a) a partner with a labeled PSL video dataset (FESF Pakistan,
Connect Hear), and (b) a server-side GPU to run a sequence-to-sequence
model. Neither is in this repo.

---

## Retraining the alphabet model on real data

The shipped model is trained on synthetic data so the demo works out of
the box. To retrain on real keypoint data:

1. **Collect data.** For each letter a–z, record yourself signing it 30+
   times in varied positions and lighting. The easiest way: open the
   communicate page in dev tools and copy out the 21 landmarks each
   frame the hand is held still. Or use any MediaPipe Hands recorder.
2. **Format data.** Save as a CSV or JSON with one row per sample:
   `letter, x0, y0, z0, x1, y1, z1, ..., x20, y20, z20` (raw, not
   normalized — the script will normalize).
3. **Edit `training/train_model.py`** — replace `build_dataset()` with
   a loader that returns `(X, y)` where `X` is `(N, 63)` and each row
   has been passed through `normalize_landmarks()`.
4. **Train**:
   ```bash
   cd training
   python train_model.py --samples-per-letter 0 --output ../models/alphabet_rf.pkl
   ```
5. **Restart serve.py.** The model is loaded lazily on first request.

Realistic accuracy on real data with ~50 samples per letter and a
single signer: 80–92% top-1 in good lighting. With multiple signers
and varied conditions, expect 70–85%.

---

## Adding more signs

Sign rules live in `js/vocabulary.js`. Each rule is a function:

```js
{
  word: 'newsign',
  kind: 'location',           // or 'shape' or 'motion'
  test: (frame, contacts, history) => {
    // frame.hands.primary  — features of the active hand
    // contacts.left/right  — stable contact (after dwell)
    // history.frameBuffer  — last 1.5 s of frames
    // history.leftTracker  — sequence of recent contacts
    if (...) return null;
    return { confidence: 0.8 };
  },
}
```

Returning `null` means no match; returning `{confidence: 0..1}` proposes
the sign. The recognizer picks the highest-confidence match per frame,
requires it held for `holdTime` ms (`motionHoldTime` for motion-kind
signs, default 200 ms), then emits with a cooldown.

Both `holdTime` and the per-frame `confThreshold` are now adjustable
live from the settings panel, so you can tune sensitivity without
editing code.

---

## Known limitations

- **Two-hand signs are limited.** Only `love`, `meet`, `name` use both
  hands meaningfully. Many real ASL signs have a non-dominant hand
  acting as a base (WORK, SCHOOL); these are approximated or missing.
- **Lighting matters.** Below ~50 lux MediaPipe loses tracking on dark
  hands and the recognizer goes silent. The alphabet model is
  particularly sensitive to this since it has only 21 points to work
  with.
- **Camera angle.** The system assumes the user is facing the camera
  with upper torso visible. Side-on or below-shoulder framing breaks
  the anchor computation.
- **J, Z (alphabet).** These letters require motion in real ASL. The
  static model can't distinguish them from their motionless equivalents
  (J ≈ I, Z ≈ index pointing). The model still emits them as guesses,
  but precision is ~50%.
- **M, N, T (alphabet).** Differ only by thumb-under-finger position,
  which MediaPipe Hands tracks unreliably. Confusion expected.
- **Speed.** Very fast signing (>2 signs/sec) outpaces the hold time.
  Lower `holdTime` from the settings panel if needed.
- **No facial expression recognition.** Sign languages use eyebrows
  and mouth shape grammatically (e.g. yes/no questions). FaceMesh gives
  us the data; we don't yet use it.
- **PSL vs ASL.** The current rules and alphabet model lean ASL because
  that's where datasets exist. PSL has different handshape and
  contact-zone conventions. Roadmap item: a `language` setting is
  already in the settings store, awaiting PSL rule files.

---

## Roadmap

In order of increasing scope:

1. **Per-user calibration.** A 30-second "teach me your signs" flow
   that records user-specific landmark trajectories per sign and
   overrides the default rule. No model training — just store a 1-NN
   exemplar and compare with DTW (dynamic time warping). Big quality
   win for users with non-standard hand sizes.
2. **TFJS isolated-sign classifier.** A small (1–2 MB) LSTM or
   transformer trained on WLASL-100 / MS-ASL-100. Input is the
   per-frame feature vector we already extract. Plug in via the
   `modelHook` callback in `recognizer.js`. Realistic accuracy:
   ~55–70% top-1 on 100 signs.
3. **Continuous recognition.** Sequence-to-sequence transformer with
   CTC loss, trained on How2Sign / PHOENIX-2014T. Browser-impractical
   (~200 MB+); runs on a server endpoint. The `modelHook` can `fetch()`
   against that.
4. **PSL coverage.** Partner with FESF Pakistan or Connect Hear for
   ground-truth annotated PSL video, then add PSL rules and a separate
   PSL-trained alphabet model. The architecture already supports
   side-by-side languages.

---

## Credits

Created by Jasim for accessibility research.

Uses:
- [MediaPipe Holistic](https://google.github.io/mediapipe/) — Apache 2.0
- [MediaPipe Hands](https://google.github.io/mediapipe/) — Apache 2.0
- [scikit-learn](https://scikit-learn.org/) — BSD-3
- [Fraunces](https://fonts.google.com/specimen/Fraunces),
  [Inter Tight](https://fonts.google.com/specimen/Inter+Tight),
  [JetBrains Mono](https://www.jetbrains.com/lp/mono/) — open fonts

PSL reference: [psl.org.pk](https://psl.org.pk) (FESF Pakistan).
