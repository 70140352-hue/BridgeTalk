#!/usr/bin/env python3
"""
BridgeTalk v7 — Convert the trained alphabet RandomForest to ONNX.

Produces two artefacts under ../models/:
  alphabet_rf.onnx          — the model itself, runnable by onnxruntime-web
  alphabet_rf.classes.json  — class label list in the same order as the
                              model's probability outputs

The conversion is deterministic and reproducible: same .pkl in → same
.onnx out. Run this after `train_model.py` and whenever you retrain.

Why we set zipmap=False:
  By default skl2onnx wraps the probability output in a "ZipMap" node
  that returns a list of {class: prob} dicts. onnxruntime-web does
  support ZipMap, but parsing it on the JS side is significantly slower
  and more fragile. With zipmap=False we get a clean (N, num_classes)
  Float32 tensor — easier and faster to consume.

Requirements:
  pip install scikit-learn joblib skl2onnx onnx
"""
import json
import sys
from pathlib import Path

import joblib
import numpy as np

try:
    from skl2onnx import convert_sklearn
    from skl2onnx.common.data_types import FloatTensorType
except ImportError:
    sys.exit(
        "skl2onnx is not installed. Run: pip install skl2onnx onnx\n"
        "Note: skl2onnx version must be compatible with your scikit-learn "
        "version. If conversion fails, try `pip install -U skl2onnx`."
    )


ROOT = Path(__file__).resolve().parent.parent
PKL_PATH = ROOT / 'models' / 'alphabet_rf.pkl'
ONNX_PATH = ROOT / 'models' / 'alphabet_rf.onnx'
CLASSES_PATH = ROOT / 'models' / 'alphabet_rf.classes.json'


def main():
    if not PKL_PATH.exists():
        sys.exit(f"Missing {PKL_PATH}. Run train_model.py first.")

    print(f"Loading {PKL_PATH} ...")
    bundle = joblib.load(PKL_PATH)
    model = bundle['model']
    classes = bundle['classes']
    print(f"  classes: {len(classes)}  ({', '.join(classes[:5])}, ...)")

    initial_type = [('input', FloatTensorType([None, 63]))]

    # `zipmap=False` returns probabilities as a (N, num_classes) tensor
    # instead of a list of dicts — friendlier for the JS consumer.
    print("Converting to ONNX (this can take 10-30s for a 200-tree forest) ...")
    onnx_model = convert_sklearn(
        model,
        initial_types=initial_type,
        options={id(model): {'zipmap': False}},
        target_opset=15,
    )

    ONNX_PATH.write_bytes(onnx_model.SerializeToString())
    size_kb = ONNX_PATH.stat().st_size / 1024
    print(f"  wrote {ONNX_PATH} ({size_kb:.1f} KB)")

    CLASSES_PATH.write_text(json.dumps(list(classes)))
    print(f"  wrote {CLASSES_PATH}")

    # Quick parity sanity check: a few random inputs through both models
    # should produce the same argmax.
    print("\nSanity check: comparing sklearn vs ONNX on random inputs ...")
    try:
        import onnxruntime as ort
    except ImportError:
        print("  (skip — install `onnxruntime` to enable this check)")
        return

    sess = ort.InferenceSession(str(ONNX_PATH), providers=['CPUExecutionProvider'])
    rng = np.random.default_rng(0)
    mismatches = 0
    N = 50
    for _ in range(N):
        x = rng.standard_normal((1, 63)).astype(np.float32)
        sk_pred = model.predict(x)[0]
        onnx_outs = sess.run(None, {'input': x})
        # outs[0] = labels, outs[1] = probabilities (N, num_classes)
        onnx_probs = onnx_outs[1]
        onnx_pred = classes[int(np.argmax(onnx_probs[0]))]
        if str(sk_pred) != str(onnx_pred):
            mismatches += 1
    print(f"  {N - mismatches}/{N} agreed")
    if mismatches:
        print("  WARNING: outputs differ — usually a skl2onnx version mismatch.")


if __name__ == '__main__':
    main()
