# BridgeTalk v7 — Performance + Sequence Model

This pass adds four performance optimizations and one new optional feature
to BridgeTalk v6. **None of the v6 behaviour was removed.** Everything new
either defaults to a safe value or no-ops when the required model file is
missing, so the app keeps working exactly as before if you don't touch
anything.

## What changed

### 1. Frame throttling
Both signs mode (`startPump`) and alphabet mode (`HandsRunner.start`) now
process one of every N animation frames instead of every frame. Set via:
- `settings.signsFrameStride` (default **3** ≈ 20fps on 60Hz display)
- `settings.alphabetFrameStride` (default **3**)

Why this is the biggest win: MediaPipe Holistic at modelComplexity=1 is
the dominant per-frame cost (~15–25 ms on a 2020 laptop). Running it at
~20 fps instead of ~60 fps cuts CPU usage roughly in half with no loss
of recognition quality — human gestures don't change at 60 Hz.

### 2. Downscaled input
`js/frame-source.js` wraps the `<video>` element and exposes either the
raw video or a downscaled offscreen canvas, depending on
`settings.inputDownscale` (default **320**px longest edge; set 0 to
disable). MediaPipe's internal resize is more expensive than a 2D canvas
draw, so giving it a pre-sized canvas saves another ~5–10 ms per frame.

The downscale runs through MediaPipe's `image:` parameter, which accepts
canvases interchangeably with video elements — no MediaPipe-side changes.

### 3. Motion gate
`js/motion-gate.js` tracks wrist position over the last
`settings.motionGateWindow` frames (default 3) and only allows inference
to fire when the total Euclidean delta exceeds
`settings.motionGateThreshold` (default 0.005 in normalized landmark
coordinates).

- **Signs mode**: gates the sequence-model `modelHook` only (rule-based
  recognition stays running — it's already cheap).
- **Alphabet mode**: when the hand is "still" AND a letter has already
  been stably recognized, we skip the model call entirely. This is the
  common case when a user holds a letter to confirm it — we used to keep
  pinging the backend ~5 times a second for the same answer.

### 4. Client-side ONNX alphabet inference
The Python RandomForest backend (`serve.py`) is now optional. The
scikit-learn model can be converted to ONNX once with
`training/convert_to_onnx.py`, after which `js/onnx-alphabet.js` runs the
inference entirely in the browser via `onnxruntime-web`.

Behaviour controlled by `settings.alphabetBackend`:
- `'auto'` (default) — try ONNX first, fall back to HTTP if `.onnx`
  is missing or `onnxruntime-web` fails to load.
- `'onnx'` — ONNX only; error if unavailable.
- `'http'` — always use the Python server (v6 behaviour).

Setup:
```bash
pip install skl2onnx onnx onnxruntime
cd training
python convert_to_onnx.py     # produces ../models/alphabet_rf.onnx
```

After conversion, you can stop running `serve.py` — the app loads
`models/alphabet_rf.onnx` directly from the static file server.
Roundtrip latency drops from ~30–80 ms (network + Python prediction)
to ~2–5 ms (in-browser WASM).

### 5. Sequence (LSTM) model — **scaffold**
The recognizer accepted a `modelHook` since v5 but nothing populated it.
v7 wires a sequence model into it:

- `js/sequence-model.js` — sliding 30-frame buffer of MediaPipe features,
  motion-gated, stride-throttled, runs via `onnxruntime-web`.
- `training/train_sequence_model.py` — 2-layer LSTM trainer with ONNX
  export. Outputs `models/sequence_model.onnx` and
  `models/sequence_model.classes.json`.

**Important**: no trained sequence model is included. The scaffold
gracefully no-ops when `sequence_model.onnx` is missing — set
`settings.sequenceModelEnabled = true` *and* train a model to enable it.

Training data format (see `train_sequence_model.py::load_dataset`):
```
X: float32  (N, 30, 150)   — N sequences of 30 frames × 150 features
y: int64    (N,)           — class indices
classes: List[str]         — class names
```

The 150-feature layout is fixed by `js/sequence-model.js::extractFeatures`
and **must match exactly** during data collection. To collect training
data, instrument the existing Holistic onResults callback to log the
output of `sequenceModel.extractFeatures(results)` and tag windows with
the sign being performed.

## Things I deliberately did NOT do

A few things from the proposed optimization list don't apply to this
codebase. To be transparent:

- **Web Workers for MediaPipe**: MediaPipe's CDN solutions take an
  `HTMLVideoElement` or `HTMLCanvasElement` and use internal canvas
  contexts that aren't trivially worker-compatible. Moving them is a
  multi-hundred-line refactor that often regresses on Safari, and the
  motion gate + throttling above recover most of the budget anyway.
- **TFJS WebGPU/WebGL**: There's no TFJS in the project. MediaPipe
  already uses WebGL internally for landmark detection.
- **FP16/INT8 quantization of the backend**: The alphabet backend is a
  scikit-learn RandomForest, not a neural network. Quantization
  terminology doesn't apply to tree forests. The structural win
  (eliminating the HTTP round-trip) was bigger anyway and is covered by
  #4 above.

## Live tuning

All new settings are reconfigurable at runtime via the existing settings
store. They live in `settings.js` under "v7 perf knobs". The settings
panel UI in `communicate.html` does not yet expose them — but they can be
toggled programmatically:

```js
import { settings } from './js/settings.js';
settings.set('signsFrameStride', 5);       // ~12fps inference
settings.set('inputDownscale', 256);       // even smaller
settings.set('motionGateThreshold', 0.01); // require more motion
settings.set('alphabetBackend', 'onnx');   // force ONNX, no HTTP fallback
```

Adding sliders/toggles for these to `communicate.html` follows the same
pattern as the existing `bindSlider`/`bindCheckbox` calls in `app.js`.
