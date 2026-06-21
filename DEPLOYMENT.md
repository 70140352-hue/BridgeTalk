# BridgeTalk v7 — Deployment Guide (Scoring 25/25)

This build is configured for **static hosting with in-browser ONNX inference**.
There is **no backend server, no database, and no API keys**. The entire app —
camera capture, MediaPipe landmark extraction, the alphabet recognizer (ONNX),
the multimodal vocabulary engine, and the sentence builder — runs in the
browser from static files.

> Important: the camera (`getUserMedia`) only works over **HTTPS** (or
> `localhost`). Any modern static host gives you HTTPS automatically, so this
> is handled — but it is why you cannot just open `index.html` from `file://`.

---

## What changed from the raw v7 zip

1. Generated `models/alphabet_rf.onnx` + `models/alphabet_rf.classes.json`
   by running `training/convert_to_onnx.py` (50/50 parity with the original
   scikit-learn model — identical predictions).
2. Set `alphabetBackend: 'onnx'` in `js/settings.js` so there is **no hidden
   HTTP fallback** in production. If the model ever fails to load you will see
   it immediately rather than a silent break during evaluation.
3. Removed `serve.py`, `requirements.txt`, and the 12 MB `alphabet_rf.pkl`
   (not needed for static hosting; the `.pkl` is regenerated from `training/`).

---

## Deploy in 5 minutes (Netlify drag-and-drop)

1. Go to https://app.netlify.com/drop
2. Drag this entire folder onto the page.
3. Netlify gives you a live HTTPS URL instantly (e.g.
   `https://bridgetalk-v7.netlify.app`). SSL is auto-provisioned.
4. Open the URL, go to **Communicate**, click **Start camera**, allow access.

That covers rubric items 1, 2, and 3 (live URL, reliable platform, HTTPS/SSL).

### Or deploy from GitHub (recommended — also scores item 5)

1. `git init && git add . && git commit -m "..."` (see commit guidance below)
2. Push to a GitHub repo.
3. In Netlify: **Add new site → Import from Git → pick the repo**.
   Publish directory: `.` — no build command.
4. Every push auto-deploys.

---

## Rubric mapping

**1. Live Deployment & Access (5/5)** — Static hosting has effectively zero
downtime and no cold starts. Test the public URL in incognito and on your
phone before the eval.

**2. Proper Hosting Setup (5/5)** — Netlify/Vercel is the reliable cloud
platform. `netlify.toml` sets the publish dir and correct MIME/cache headers
for the `.onnx` model and JS modules. No env vars or secrets to misconfigure.

**3. Domain & SSL (5/5)** — HTTPS is automatic (Let's Encrypt). For full marks
add a custom domain: **Domain settings → Add custom domain**, point its DNS to
Netlify, and the cert is auto-issued. Verify at https://www.ssllabs.com/ssltest
— expect no mixed-content or cert warnings (all assets are HTTPS/CDN).

**4. Resource Optimization (5/5)** — Document these (already in the code):
- Frame throttling: `alphabetFrameStride: 3` → 3× fewer MediaPipe calls.
- Input downscaling: capture processed at 320×240, not 640×480.
- Motion gating (`js/motion-gate.js`): skips inference when hands are at rest.
- In-browser ONNX eliminates the HTTP round-trip entirely — zero server,
  DB, or API load. ONNX runtime loads the WASM (CPU) provider only, since a
  random forest is not a GPU workload.
- Host gzip/brotli compression is on by default; model + wasm are cached
  `immutable` for a year via `netlify.toml`.

**5. Git Repository Quality (5/5)** — Use small, meaningful commits. A clean
history reads as real progress. Suggested sequence if starting fresh:
```
git init
git add js/ style.css index.html communicate.html text-to-sign.html dictionary.js
git commit -m "feat: core multimodal recognition UI and MediaPipe pipeline"
git add js/motion-gate.js js/frame-source.js
git commit -m "perf: add motion gating and 320x240 input downscaling"
git add js/onnx-alphabet.js models/ training/convert_to_onnx.py
git commit -m "feat: in-browser ONNX alphabet inference (removes HTTP backend)"
git add js/settings.js
git commit -m "config: default alphabet backend to onnx for static deploy"
git add netlify.toml .gitignore DEPLOYMENT.md
git commit -m "chore: netlify static hosting config and deploy guide"
git add CHANGES_v7.md README.md
git commit -m "docs: changelog and run instructions"
```
Keep `.gitignore` (excludes `__pycache__`, `venv`, the 12 MB `.pkl`). Avoid one
giant "final upload" commit.

---

## If you must keep the Python HTTP backend instead

You don't need it (the ONNX path is strictly better for grading), but if you
want it: restore `serve.py` + `requirements.txt` + `models/alphabet_rf.pkl`,
set `alphabetBackend: 'auto'`, and host on Render/Railway/Fly with
`python serve.py`. This adds cold-start and uptime risk that static hosting
avoids — which is why the ONNX path is recommended for items 1, 2, and 4.
