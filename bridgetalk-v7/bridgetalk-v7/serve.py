#!/usr/bin/env python3
"""
BridgeTalk v6 — local development server with ML alphabet endpoint.

Serves the current directory on http://localhost:8080 and provides:
  GET  /api/health         — model status + server stats
  POST /api/predict        — single-frame letter classification
  POST /api/predict_batch  — batch of frames (returns one result each)

v6 improvements over v5:
  - CORS headers for /api/* so the page can be opened on a different
    origin (e.g. served by a Vite/Webpack dev server elsewhere).
  - Request-count + latency stats surfaced in /api/health.
  - Cleaner error responses (consistent shape, predictable status codes).
  - Argparse: --port, --host, --no-open, --debug.
  - Optional auto-open browser on startup (default true).
  - Compression on JSON responses larger than 1 KB.

Run:  python3 serve.py
"""
import http.server
import socketserver
import os
import sys
import json
import time
import gzip
import argparse
import threading
import traceback
import webbrowser
from pathlib import Path
from collections import deque


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / 'models' / 'alphabet_rf.pkl'


# ---------------------------------------------------------------------------
# Lazy model loader
# ---------------------------------------------------------------------------
_model_bundle = None
_model_error = None
_model_lock = threading.Lock()


def get_model():
    """Load the model on first call. Thread-safe."""
    global _model_bundle, _model_error
    if _model_bundle is not None or _model_error is not None:
        return _model_bundle, _model_error
    with _model_lock:
        # Double-check after acquiring lock
        if _model_bundle is not None or _model_error is not None:
            return _model_bundle, _model_error
        try:
            import joblib
            if not MODEL_PATH.exists():
                _model_error = (
                    f"Model file not found at {MODEL_PATH}. "
                    f"Run: cd training && python train_model.py"
                )
                return None, _model_error
            _model_bundle = joblib.load(MODEL_PATH)
            _ = _model_bundle['model']
            _ = _model_bundle['classes']
            return _model_bundle, None
        except Exception as e:
            _model_error = f"Failed to load model: {type(e).__name__}: {e}"
            traceback.print_exc()
            return None, _model_error


def _normalize(landmarks_np):
    """Wrist-anchor + scale by middle-finger MCP distance. Must match
    train_model.normalize_landmarks exactly."""
    import numpy as np
    wrist = landmarks_np[0]
    centered = landmarks_np - wrist
    size = np.linalg.norm(centered[9])
    if size < 1e-6:
        size = 1.0
    return (centered / size).flatten()


def predict_letter(landmarks):
    """Run the model on a 21x3 keypoint array.

    Returns dict with one of:
      success: {letter, confidence, top3}
      failure: {error}
    """
    bundle, err = get_model()
    if err:
        return {'error': err}
    try:
        import numpy as np
        pts = np.array(landmarks, dtype=np.float64)
        if pts.shape != (21, 3):
            return {'error': f'Expected 21x3 landmarks, got shape {pts.shape}'}
        feat = _normalize(pts).reshape(1, -1)
        model = bundle['model']
        classes = bundle['classes']
        probs = model.predict_proba(feat)[0]
        idx_sorted = probs.argsort()[::-1]
        top3 = [
            {'letter': classes[i], 'confidence': float(probs[i])}
            for i in idx_sorted[:3]
        ]
        return {
            'letter': classes[idx_sorted[0]],
            'confidence': float(probs[idx_sorted[0]]),
            'top3': top3,
        }
    except Exception as e:
        traceback.print_exc()
        return {'error': f'{type(e).__name__}: {e}'}


# ---------------------------------------------------------------------------
# Server stats — exposed via /api/health
# ---------------------------------------------------------------------------
class Stats:
    def __init__(self):
        self.started = time.time()
        self.predict_count = 0
        self.predict_errors = 0
        self.latencies_ms = deque(maxlen=200)
        self.lock = threading.Lock()

    def record(self, latency_ms, error):
        with self.lock:
            self.predict_count += 1
            if error:
                self.predict_errors += 1
            self.latencies_ms.append(latency_ms)

    def summary(self):
        with self.lock:
            lats = list(self.latencies_ms)
        avg = sum(lats) / len(lats) if lats else 0.0
        p95 = sorted(lats)[int(0.95 * len(lats))] if len(lats) >= 20 else None
        return {
            'uptime_s': round(time.time() - self.started, 1),
            'predict_count': self.predict_count,
            'predict_errors': self.predict_errors,
            'latency_avg_ms': round(avg, 1),
            'latency_p95_ms': round(p95, 1) if p95 is not None else None,
        }


STATS = Stats()


# ---------------------------------------------------------------------------
# HTTP handler
# ---------------------------------------------------------------------------
class Handler(http.server.SimpleHTTPRequestHandler):
    server_version = 'BridgeTalk/6.0'

    def end_headers(self):
        # Same-origin policy headers for static; /api/* responses use _send_json
        if not self.path.startswith('/api/'):
            self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
            self.send_header('Cross-Origin-Embedder-Policy', 'credentialless')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def guess_type(self, path):
        if path.endswith('.js') or path.endswith('.mjs'):
            return 'application/javascript'
        if path.endswith('.css'):
            return 'text/css'
        if path.endswith('.svg'):
            return 'image/svg+xml'
        return super().guess_type(path)

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode('utf-8')
        # Optional gzip for larger responses
        accept_encoding = self.headers.get('Accept-Encoding', '')
        gzipped = False
        if len(body) > 1024 and 'gzip' in accept_encoding:
            body = gzip.compress(body)
            gzipped = True
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        if gzipped:
            self.send_header('Content-Encoding', 'gzip')
        # CORS
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        # CORS preflight — applies to /api/* only
        if self.path.startswith('/api/'):
            self.send_response(204)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.send_header('Access-Control-Max-Age', '86400')
            self.end_headers()
            return
        return super().do_OPTIONS() if hasattr(super(), 'do_OPTIONS') else self.send_error(405)

    def do_GET(self):
        if self.path == '/api/health':
            bundle, err = get_model()
            payload = {
                'ok': err is None,
                'model_loaded': bundle is not None,
                'error': err,
                'classes': bundle['classes'].tolist() if bundle and hasattr(bundle['classes'], 'tolist') else (bundle['classes'] if bundle else None),
                'trained_on': bundle.get('trained_on', '?') if bundle else None,
                'stats': STATS.summary(),
                'version': '6.0',
            }
            self._send_json(200, payload)
            return
        if self.path == '/api/version':
            self._send_json(200, {'version': '6.0', 'name': 'BridgeTalk'})
            return
        return super().do_GET()

    def do_POST(self):
        if self.path == '/api/predict':
            self._handle_predict_single()
            return
        if self.path == '/api/predict_batch':
            self._handle_predict_batch()
            return
        self._send_json(404, {'error': 'not found'})

    def _handle_predict_single(self):
        t0 = time.perf_counter()
        try:
            length = int(self.headers.get('Content-Length', 0))
            if length <= 0 or length > 1_000_000:
                self._send_json(400, {'error': 'invalid content length'})
                STATS.record((time.perf_counter() - t0) * 1000, True)
                return
            raw = self.rfile.read(length)
            data = json.loads(raw.decode('utf-8'))
            landmarks = data.get('landmarks')
            if not landmarks:
                self._send_json(400, {'error': 'missing landmarks'})
                STATS.record((time.perf_counter() - t0) * 1000, True)
                return
            result = predict_letter(landmarks)
            status = 200
            if 'error' in result:
                status = 503 if 'Model file not found' in result.get('error', '') else 400
            self._send_json(status, result)
            STATS.record((time.perf_counter() - t0) * 1000, 'error' in result)
        except json.JSONDecodeError as e:
            self._send_json(400, {'error': f'bad json: {e}'})
            STATS.record((time.perf_counter() - t0) * 1000, True)
        except Exception as e:
            traceback.print_exc()
            self._send_json(500, {'error': f'{type(e).__name__}: {e}'})
            STATS.record((time.perf_counter() - t0) * 1000, True)

    def _handle_predict_batch(self):
        """Accept {samples: [{landmarks}, ...]} → {results: [{letter,...}, ...]}.
        Lets callers test the model on many frames at once (e.g. exporting
        a training session)."""
        t0 = time.perf_counter()
        try:
            length = int(self.headers.get('Content-Length', 0))
            if length <= 0 or length > 10_000_000:
                self._send_json(400, {'error': 'invalid content length'})
                return
            raw = self.rfile.read(length)
            data = json.loads(raw.decode('utf-8'))
            samples = data.get('samples') or []
            if not isinstance(samples, list):
                self._send_json(400, {'error': 'samples must be a list'})
                return
            results = []
            for s in samples[:500]:  # safety cap
                lm = s.get('landmarks')
                if not lm:
                    results.append({'error': 'missing landmarks'})
                    continue
                results.append(predict_letter(lm))
            self._send_json(200, {'results': results, 'count': len(results)})
            STATS.record((time.perf_counter() - t0) * 1000, False)
        except Exception as e:
            traceback.print_exc()
            self._send_json(500, {'error': f'{type(e).__name__}: {e}'})

    def log_message(self, fmt, *args):
        msg = fmt % args
        if any(x in msg for x in ('.png', '.jpg', '.svg', '.ico', '.woff', '.woff2', '.ttf')):
            return
        sys.stderr.write(f"[bridgetalk] {self.address_string()} {msg}\n")


# ---------------------------------------------------------------------------
# Entry
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description='BridgeTalk v6 local server.')
    parser.add_argument('--port', type=int, default=int(os.environ.get('PORT', 8080)),
                        help='Port to bind (default 8080).')
    parser.add_argument('--host', default='', help='Host to bind (default all interfaces).')
    parser.add_argument('--no-open', action='store_true', help='Do not auto-open the browser.')
    parser.add_argument('--debug', action='store_true', help='Verbose logging.')
    args = parser.parse_args()

    os.chdir(ROOT)

    # Warm up the model so first request isn't slow
    bundle, err = get_model()
    if err:
        print(f"WARNING: alphabet ML disabled — {err}")
    else:
        n_classes = len(bundle['classes'])
        trained_on = bundle.get('trained_on', '?')
        print(f"Alphabet model loaded ({n_classes} classes, trained on {trained_on} data)")

    address = (args.host, args.port)
    try:
        httpd = socketserver.ThreadingTCPServer(address, Handler)
    except OSError as e:
        print(f"ERROR: could not bind to port {args.port}: {e}")
        print(f"       Either close the program using it, or run with --port=<other>.")
        sys.exit(2)

    httpd.allow_reuse_address = True
    print()
    print(f"  BridgeTalk v6 — serving on http://localhost:{args.port}")
    print(f"  Open      http://localhost:{args.port}/index.html")
    print(f"  Health    http://localhost:{args.port}/api/health")
    print(f"  Press Ctrl+C to stop.")
    print()

    if not args.no_open:
        # Fire-and-forget; if the user is over SSH this no-ops gracefully.
        try:
            threading.Timer(0.4, lambda: webbrowser.open(f'http://localhost:{args.port}/index.html')).start()
        except Exception:
            pass

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')
        httpd.server_close()
        sys.exit(0)


if __name__ == '__main__':
    main()
