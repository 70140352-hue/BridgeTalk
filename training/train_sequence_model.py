#!/usr/bin/env python3
"""
BridgeTalk v7 — Sequence (LSTM) model trainer for dynamic signs.

This is a scaffold. You must provide your own labelled sequence dataset
(see `load_dataset` below). The script handles:
  - Defining a small 2-layer LSTM classifier
  - Training with early stopping on a validation split
  - Exporting to ONNX with input name="input" and output names
    "logits", "probabilities" (matches js/sequence-model.js's contract)

Dataset contract:
  X : (N, T, F) float32 — N sequences, T timesteps, F features per frame
                          T should match settings.sequenceWindowFrames (30)
                          F should match js/sequence-model.js FEATURE_DIM (150)
  y : (N,) int           — class index per sequence
  classes : List[str]    — class names (idx → label)

A loader stub is provided that errors out with instructions; replace it
with code that reads YOUR data. Don't ship a model trained on fabricated
data — it will be worse than no model.

Requirements:
  pip install torch numpy

Run:
  cd training
  python train_sequence_model.py --data path/to/your/dataset.npz
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np

try:
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, TensorDataset
except ImportError:
    sys.exit("PyTorch not installed. Run: pip install torch")


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = ROOT / 'models' / 'sequence_model.onnx'
DEFAULT_CLASSES = ROOT / 'models' / 'sequence_model.classes.json'

# Must match js/sequence-model.js
WINDOW_FRAMES = 30
FEATURE_DIM = 150


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------
class SignLSTM(nn.Module):
    """
    Small 2-layer LSTM → linear classifier.
    Designed to be tiny: ~120K parameters. Trains fast and runs in
    onnxruntime-web well under the 10 ms budget per inference.
    """
    def __init__(self, num_classes, feature_dim=FEATURE_DIM, hidden=64):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=feature_dim,
            hidden_size=hidden,
            num_layers=2,
            batch_first=True,
            dropout=0.2,
        )
        self.head = nn.Linear(hidden, num_classes)

    def forward(self, x):
        # x: (B, T, F)
        out, _ = self.lstm(x)
        # Take the last timestep's hidden state — standard pattern for
        # sequence classification.
        last = out[:, -1, :]
        logits = self.head(last)
        return logits


# ---------------------------------------------------------------------------
# Dataset loader — REPLACE THIS with your own dataset code
# ---------------------------------------------------------------------------
def load_dataset(path):
    """
    Load training data from a .npz containing X, y, classes.
      X.shape == (N, WINDOW_FRAMES, FEATURE_DIM)
      y.shape == (N,)
      classes : object array of label strings

    See js/sequence-model.js::extractFeatures for how runtime features
    are laid out — your training features MUST match that layout exactly,
    or the model will see garbage at inference time.
    """
    p = Path(path)
    if not p.exists():
        sys.exit(
            f"Dataset {path} not found.\n\n"
            f"This is a scaffold — you need to bring your own labelled\n"
            f"sequence data. Required format (.npz):\n"
            f"  X       float32  (N, {WINDOW_FRAMES}, {FEATURE_DIM})\n"
            f"  y       int      (N,)\n"
            f"  classes object   list of class names\n\n"
            f"Capture features at runtime using the same\n"
            f"`extractSequenceFeatures` shape used by js/sequence-model.js,\n"
            f"label the resulting windows, then save with numpy.savez."
        )
    data = np.load(p, allow_pickle=True)
    X = data['X'].astype(np.float32)
    y = data['y'].astype(np.int64)
    classes = list(data['classes'])
    assert X.shape[1:] == (WINDOW_FRAMES, FEATURE_DIM), (
        f"Expected X shape (N, {WINDOW_FRAMES}, {FEATURE_DIM}), "
        f"got {X.shape}"
    )
    return X, y, classes


# ---------------------------------------------------------------------------
# Training loop
# ---------------------------------------------------------------------------
def train(model, train_loader, val_loader, epochs, lr, device):
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    loss_fn = nn.CrossEntropyLoss()
    best_val = float('inf')
    best_state = None
    patience = 5
    stale = 0
    for ep in range(1, epochs + 1):
        model.train()
        train_loss = 0
        n = 0
        for xb, yb in train_loader:
            xb, yb = xb.to(device), yb.to(device)
            opt.zero_grad()
            logits = model(xb)
            loss = loss_fn(logits, yb)
            loss.backward()
            opt.step()
            train_loss += loss.item() * xb.size(0)
            n += xb.size(0)
        train_loss /= max(n, 1)

        model.eval()
        val_loss = 0
        correct = 0
        total = 0
        with torch.no_grad():
            for xb, yb in val_loader:
                xb, yb = xb.to(device), yb.to(device)
                logits = model(xb)
                val_loss += loss_fn(logits, yb).item() * xb.size(0)
                correct += (logits.argmax(1) == yb).sum().item()
                total += xb.size(0)
        val_loss /= max(total, 1)
        val_acc = correct / max(total, 1)
        print(f"ep {ep:3d}  train {train_loss:.4f}  val {val_loss:.4f}  acc {val_acc:.3f}")

        if val_loss < best_val - 1e-4:
            best_val = val_loss
            best_state = {k: v.detach().clone() for k, v in model.state_dict().items()}
            stale = 0
        else:
            stale += 1
            if stale >= patience:
                print(f"early stop at epoch {ep}")
                break
    if best_state:
        model.load_state_dict(best_state)
    return model


# ---------------------------------------------------------------------------
# ONNX export
# ---------------------------------------------------------------------------
def export_onnx(model, num_classes, out_path):
    """
    Export with two named outputs: logits and probabilities.
    The runtime prefers probabilities and falls back to softmaxing logits,
    but we provide both so downstream code never has to guess.
    """
    class Wrapper(nn.Module):
        def __init__(self, m):
            super().__init__()
            self.m = m
            self.sm = nn.Softmax(dim=-1)

        def forward(self, x):
            logits = self.m(x)
            return logits, self.sm(logits)

    wrapper = Wrapper(model).eval()
    dummy = torch.zeros(1, WINDOW_FRAMES, FEATURE_DIM, dtype=torch.float32)
    torch.onnx.export(
        wrapper,
        dummy,
        out_path,
        input_names=['input'],
        output_names=['logits', 'probabilities'],
        dynamic_axes={'input': {0: 'batch'}, 'logits': {0: 'batch'}, 'probabilities': {0: 'batch'}},
        opset_version=14,
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', required=True, help='Path to .npz with X, y, classes')
    ap.add_argument('--out', default=str(DEFAULT_OUT))
    ap.add_argument('--classes-out', default=str(DEFAULT_CLASSES))
    ap.add_argument('--epochs', type=int, default=40)
    ap.add_argument('--batch-size', type=int, default=32)
    ap.add_argument('--lr', type=float, default=1e-3)
    ap.add_argument('--val-frac', type=float, default=0.15)
    ap.add_argument('--seed', type=int, default=42)
    args = ap.parse_args()

    np.random.seed(args.seed)
    torch.manual_seed(args.seed)

    X, y, classes = load_dataset(args.data)
    print(f"Dataset: X={X.shape}  y={y.shape}  classes={len(classes)}")

    # Stratified-ish split
    idx = np.arange(len(X))
    np.random.shuffle(idx)
    cut = int(len(idx) * (1 - args.val_frac))
    tr, va = idx[:cut], idx[cut:]
    Xtr, ytr = torch.from_numpy(X[tr]), torch.from_numpy(y[tr])
    Xva, yva = torch.from_numpy(X[va]), torch.from_numpy(y[va])

    train_loader = DataLoader(TensorDataset(Xtr, ytr), batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(TensorDataset(Xva, yva), batch_size=args.batch_size)

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = SignLSTM(num_classes=len(classes)).to(device)
    print(f"Model parameters: {sum(p.numel() for p in model.parameters()):,}")

    model = train(model, train_loader, val_loader, args.epochs, args.lr, device)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    model.cpu()
    export_onnx(model, len(classes), str(out_path))
    print(f"Wrote {out_path} ({out_path.stat().st_size / 1024:.1f} KB)")

    Path(args.classes_out).write_text(json.dumps(list(classes)))
    print(f"Wrote {args.classes_out}")


if __name__ == '__main__':
    main()
