/* ============================================================
   BridgeTalk v6 — App Entry
   ============================================================
   Boots MediaPipe Holistic from CDN, manages camera, dispatches
   frames into the recognizer, drives the UI on communicate.html.

   v6 features wired here:
   - Settings panel (live-bound to recognizer + filter thresholds)
   - History drawer (sentences persist across sessions)
   - FPS counter
   - Audio click on token emit
   - Keyboard shortcuts (Space=start/stop, U=undo, Esc=clear, Enter=speak)
   - Top-3 alphabet predictions display
   - Theme toggle
   - Camera disconnect recovery
   ============================================================ */

import { MultimodalRecognizer } from './recognizer.js';
import { SentenceBuilder, TextSpeaker } from './sentence.js';
import { Overlay } from './overlay.js';
import { ALL_WORDS } from './vocabulary.js';
import { AlphabetMLClient, HandsRunner, StableLetterFilter } from './alphabet-ml.js';
import { settings } from './settings.js';
import { history } from './history.js';
import { tick as audioTick } from './audio.js';

// v7 perf additions
import { FrameSource } from './frame-source.js';
import { MotionGate } from './motion-gate.js';
import { OnnxAlphabetRunner } from './onnx-alphabet.js';
import { SequenceModelRunner } from './sequence-model.js';

// Normalize the path so this works under both `/communicate.html` and
// Netlify/Vercel "pretty URLs" (`/communicate`, or `/communicate/`).
const path = location.pathname.replace(/\/+$/, ''); // strip trailing slash

// communicate.html is the main signing page. Match the bare route too,
// since static hosts commonly serve it without the .html extension.
if (path.endsWith('communicate.html') || path.endsWith('/communicate') || path.endsWith('communicate')) {
  bootCommunicatePage();
}

async function bootCommunicatePage() {
  // ---------- DOM references ----------
  const video = document.getElementById('cam');
  const overlayCanvas = document.getElementById('overlay');
  const recogBox = document.getElementById('recogBox');
  const recogWord = document.getElementById('recogWord');
  const recogConf = document.getElementById('recogConf');
  const recogConfBar = document.getElementById('recogConfBar');
  const recogKind = document.getElementById('recogKind');
  const top3El = document.getElementById('top3');
  const sentenceEl = document.getElementById('sentence');
  const tokensEl = document.getElementById('tokens');
  const undoBtn = document.getElementById('undoBtn');
  const clearBtn = document.getElementById('clearBtn');
  const copyBtn = document.getElementById('copyBtn');
  const speakBtn = document.getElementById('speakBtn');
  const startBtn = document.getElementById('startBtn');
  const statusEl = document.getElementById('status');
  const vocabList = document.getElementById('vocabList');
  const vocabSearch = document.getElementById('vocabSearch');
  const fpsEl = document.getElementById('fps');

  // History
  const historyList = document.getElementById('historyList');
  const historyClearBtn = document.getElementById('historyClearBtn');
  const historyExportBtn = document.getElementById('historyExportBtn');

  // Settings panel
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const settingsCloseBtn = document.getElementById('settingsCloseBtn');
  const themeSelect = document.getElementById('s-theme');
  const confSlider = document.getElementById('s-confThreshold');
  const confValue = document.getElementById('s-confThreshold-val');
  const holdSlider = document.getElementById('s-holdTime');
  const holdValue = document.getElementById('s-holdTime-val');
  const cooldownSlider = document.getElementById('s-cooldown');
  const cooldownValue = document.getElementById('s-cooldown-val');
  const alphaMinConf = document.getElementById('s-alphabetMinConfidence');
  const alphaMinConfV = document.getElementById('s-alphabetMinConfidence-val');
  const alphaReqFrames = document.getElementById('s-alphabetRequiredFrames');
  const alphaReqFramesV = document.getElementById('s-alphabetRequiredFrames-val');
  const showAnchorsChk = document.getElementById('s-showAnchors');
  const showFaceChk = document.getElementById('s-showFace');
  const showPoseChk = document.getElementById('s-showPose');
  const showFpsChk = document.getElementById('s-showFps');
  const showTop3Chk = document.getElementById('s-showTop3');
  const audioFbChk = document.getElementById('s-audioFeedback');
  const autoCapChk = document.getElementById('s-autoCapitalize');
  const ttsRateSlider = document.getElementById('s-ttsRate');
  const ttsRateValue = document.getElementById('s-ttsRate-val');
  const resetSettingsBtn = document.getElementById('s-reset');

  // ---------- Vocab browser ----------
  const uniqueVocab = Array.from(new Set(ALL_WORDS)).sort();
  function renderVocab(filter = '') {
    if (!vocabList) return;
    const q = filter.trim().toLowerCase();
    const filtered = q
      ? uniqueVocab.filter(w => w.toLowerCase().includes(q))
      : uniqueVocab;
    if (!filtered.length) {
      vocabList.innerHTML = `<span class="vocab-empty">No matches for "${escapeHtml(q)}"</span>`;
      return;
    }
    vocabList.innerHTML = filtered
      .map(w => `<span class="vocab-chip">${escapeHtml(w)}</span>`)
      .join('');
  }
  renderVocab();
  vocabSearch?.addEventListener('input', (e) => renderVocab(e.target.value));

  // ---------- Overlay + sentence builder ----------
  const overlay = new Overlay(overlayCanvas);
  overlay.setFlags({
    anchors: settings.get('showAnchors'),
    face: settings.get('showFace'),
    pose: settings.get('showPose'),
  });

  const speaker = new TextSpeaker({
    rate: settings.get('ttsRate'),
    pitch: settings.get('ttsPitch'),
    onStart: () => speakBtn?.classList.add('is-speaking'),
    onEnd: () => speakBtn?.classList.remove('is-speaking'),
  });
  if (!speaker.available()) speakBtn?.setAttribute('disabled', '');

  const sentence = new SentenceBuilder({
    autoCapitalize: settings.get('autoCapitalize'),
    onChange: ({ tokens, text }) => {
      sentenceEl.textContent = text || '\u00A0';
      tokensEl.innerHTML = tokens.map(t => {
        const cls = t.kind === 'fingerspell' ? 'token token-spell' : 'token';
        return `<span class="${cls}">${escapeHtml(t.word)}</span>`;
      }).join('');
    },
    onCommit: ({ text, tokens }) => history.add(text, tokens),
  });
  sentence.fire();

  // ---------- Recognizer ----------
  // v7: motion gate + sequence model are shared between signs and alphabet modes.
  // frameSource handles the downscale; signs mode reads via it, alphabet mode too.
  const frameSource = new FrameSource(video, {
    targetLongEdge: settings.get('inputDownscale'),
  });
  const signsMotionGate = new MotionGate({
    threshold: settings.get('motionGateThreshold'),
    window: settings.get('motionGateWindow'),
  });
  const alphabetMotionGate = new MotionGate({
    threshold: settings.get('motionGateThreshold'),
    window: settings.get('motionGateWindow'),
  });
  // Sequence model — load lazily on first start. Stays unavailable if no
  // sequence_model.onnx is present, which is the default.
  const sequenceModel = new SequenceModelRunner({
    windowFrames: settings.get('sequenceWindowFrames'),
    inferStride: settings.get('sequenceInferStride'),
  });
  // Latest sequence prediction, kept here so the recognizer's synchronous
  // modelHook can return it without awaiting. The actual inference runs
  // asynchronously in the holistic onResults handler below.
  let _latestSequencePred = null;

  const recog = new MultimodalRecognizer({
    confThreshold: settings.get('confThreshold'),
    holdTime: settings.get('holdTime'),
    motionHoldTime: settings.get('motionHoldTime'),
    cooldown: settings.get('cooldown'),
    // The sequence model runs async; modelHook is called synchronously from
    // recognizer.update(). We return whatever the most recent inference
    // produced, but only if it was generated in the last ~500ms — otherwise
    // a stale prediction could keep firing when the user has stopped moving.
    modelHook: (frame, history) => {
      if (!_latestSequencePred) return null;
      const ageMs = performance.now() - _latestSequencePred.t;
      if (ageMs > 500) return null;
      return _latestSequencePred;
    },
    onCandidateChange: (cand) => {
      if (!cand) {
        recogBox.classList.remove('active');
        recogWord.textContent = '—';
        recogWord.classList.add('empty');
        recogConf.textContent = '';
        recogConfBar.style.width = '0%';
        recogKind.textContent = '';
        return;
      }
      recogBox.classList.add('active');
      recogWord.textContent = cand.gloss || cand.word;
      recogWord.classList.remove('empty');
      const pct = Math.round(cand.confidence * 100);
      recogConf.textContent = pct + '%';
      recogConfBar.style.width = pct + '%';
      recogKind.textContent = cand.kind;
    },
    onTokenEmit: (tok) => {
      sentence.add(tok);
      recogBox.classList.add('emitted');
      setTimeout(() => recogBox.classList.remove('emitted'), 200);
      if (settings.get('audioFeedback')) audioTick();
    },
    onFrame: (frame) => {
      overlay.draw(
        window.__lastResults || {},
        frame.anchors,
        { left: frame.hands.left?.stableContact, right: frame.hands.right?.stableContact }
      );
    },
  });

  // ---------- Sentence controls ----------
  undoBtn?.addEventListener('click', () => sentence.undo());
  clearBtn?.addEventListener('click', () => sentence.clear());
  copyBtn?.addEventListener('click', async () => {
    const txt = sentence.commit('copy');
    if (!txt) return;
    try {
      await navigator.clipboard.writeText(txt);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => copyBtn.textContent = 'Copy', 1200);
    } catch (e) {
      console.warn(e);
    }
  });
  speakBtn?.addEventListener('click', () => {
    const txt = sentence.commit('speak');
    if (!txt) return;
    speaker.speak(txt);
  });

  // ---------- History ----------
  function renderHistory() {
    if (!historyList) return;
    const entries = history.list();
    if (!entries.length) {
      historyList.innerHTML = '<div class="history-empty">No sentences yet — speak, copy, or clear to save.</div>';
      return;
    }
    historyList.innerHTML = entries.map(e => {
      const d = new Date(e.t);
      const ts = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const ds = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      return `
        <div class="history-item" data-id="${e.id}">
          <div class="history-meta">${ds} · ${ts}</div>
          <div class="history-text">${escapeHtml(e.text)}</div>
          <div class="history-actions">
            <button class="btn btn-ghost btn-sm" data-action="replay">Speak</button>
            <button class="btn btn-ghost btn-sm" data-action="copy">Copy</button>
            <button class="btn btn-ghost btn-sm" data-action="remove">Remove</button>
          </div>
        </div>`;
    }).join('');
  }
  history.on(renderHistory);
  renderHistory();

  historyList?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const item = btn.closest('.history-item');
    const id = item?.dataset.id;
    const action = btn.dataset.action;
    const entry = history.list().find(x => x.id === id);
    if (!entry) return;
    if (action === 'replay') {
      speaker.speak(entry.text);
    } else if (action === 'copy') {
      try { await navigator.clipboard.writeText(entry.text); btn.textContent = 'Copied!'; setTimeout(()=>btn.textContent='Copy', 1000); } catch {}
    } else if (action === 'remove') {
      history.remove(id);
    }
  });

  historyClearBtn?.addEventListener('click', () => {
    if (confirm('Clear all saved sentences? This cannot be undone.')) history.clear();
  });
  historyExportBtn?.addEventListener('click', () => {
    const blob = history.exportBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bridgetalk-history-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  });

  // ---------- Settings panel wiring ----------
  function openSettings() { settingsPanel?.classList.add('open'); }
  function closeSettings() { settingsPanel?.classList.remove('open'); }
  settingsBtn?.addEventListener('click', openSettings);
  settingsCloseBtn?.addEventListener('click', closeSettings);
  settingsPanel?.addEventListener('click', (e) => {
    if (e.target === settingsPanel) closeSettings();
  });

  function bindSlider(input, valEl, key, formatter = (v) => v) {
    if (!input) return;
    input.value = settings.get(key);
    if (valEl) valEl.textContent = formatter(settings.get(key));
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      settings.set(key, v);
      if (valEl) valEl.textContent = formatter(v);
    });
  }
  function bindCheckbox(input, key) {
    if (!input) return;
    input.checked = !!settings.get(key);
    input.addEventListener('change', () => settings.set(key, input.checked));
  }
  function bindSelect(input, key) {
    if (!input) return;
    input.value = settings.get(key);
    input.addEventListener('change', () => settings.set(key, input.value));
  }

  bindSelect(themeSelect, 'theme');
  bindSlider(confSlider, confValue, 'confThreshold', v => v.toFixed(2));
  bindSlider(holdSlider, holdValue, 'holdTime', v => `${Math.round(v)} ms`);
  bindSlider(cooldownSlider, cooldownValue, 'cooldown', v => `${Math.round(v)} ms`);
  bindSlider(alphaMinConf, alphaMinConfV, 'alphabetMinConfidence', v => v.toFixed(2));
  bindSlider(alphaReqFrames, alphaReqFramesV, 'alphabetRequiredFrames', v => `${Math.round(v)}`);
  bindCheckbox(showAnchorsChk, 'showAnchors');
  bindCheckbox(showFaceChk, 'showFace');
  bindCheckbox(showPoseChk, 'showPose');
  bindCheckbox(showFpsChk, 'showFps');
  bindCheckbox(showTop3Chk, 'showTop3');
  bindCheckbox(audioFbChk, 'audioFeedback');
  bindCheckbox(autoCapChk, 'autoCapitalize');
  bindSlider(ttsRateSlider, ttsRateValue, 'ttsRate', v => `${v.toFixed(2)}×`);
  resetSettingsBtn?.addEventListener('click', () => {
    if (confirm('Reset all settings to defaults?')) settings.reset();
  });

  // Live-apply settings changes
  settings.on(({ key, value }) => {
    if (key === 'confThreshold' || key === 'holdTime' || key === 'cooldown') {
      recog.configure({ [key]: value });
    } else if (key === 'showAnchors' || key === 'showFace' || key === 'showPose') {
      overlay.setFlags({
        anchors: settings.get('showAnchors'),
        face: settings.get('showFace'),
        pose: settings.get('showPose'),
      });
    } else if (key === 'showFps') {
      if (fpsEl) fpsEl.classList.toggle('hidden', !value);
    } else if (key === 'showTop3') {
      if (top3El) top3El.classList.toggle('hidden', !value);
    } else if (key === 'autoCapitalize') {
      sentence.configure({ autoCapitalize: value });
    } else if (key === 'ttsRate') {
      speaker.configure({ rate: value });
    } else if (key === 'alphabetMinConfidence' || key === 'alphabetRequiredFrames' || key === 'alphabetCooldown') {
      letterFilter?.configure({
        minConf: settings.get('alphabetMinConfidence'),
        required: settings.get('alphabetRequiredFrames'),
        cooldown: settings.get('alphabetCooldown'),
      });
    } else if (key === 'inputDownscale') {
      frameSource.configure({ targetLongEdge: value });
    } else if (key === 'motionGateThreshold' || key === 'motionGateWindow') {
      const cfg = {
        threshold: settings.get('motionGateThreshold'),
        window: settings.get('motionGateWindow'),
      };
      signsMotionGate.configure(cfg);
      alphabetMotionGate.configure(cfg);
    } else if (key === 'sequenceWindowFrames' || key === 'sequenceInferStride') {
      sequenceModel.configure({
        windowFrames: settings.get('sequenceWindowFrames'),
        inferStride: settings.get('sequenceInferStride'),
      });
    }
    // Re-apply UI toggles that read settings at render
    if (key === 'showFps' && fpsEl) fpsEl.classList.toggle('hidden', !value);
  });

  // Apply initial visibility
  if (fpsEl) fpsEl.classList.toggle('hidden', !settings.get('showFps'));
  if (top3El) top3El.classList.toggle('hidden', !settings.get('showTop3'));

  // ---------- Mode switching ----------
  let currentMode = 'signs';
  const modeBtns = document.querySelectorAll('[data-mode]');
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (mode === currentMode) return;
      switchMode(mode);
    });
  });

  function switchMode(mode) {
    currentMode = mode;
    modeBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    if (!cameraReady) {
      setStatus(`${mode === 'alphabet' ? 'Alphabet' : 'Signs'} selected — press Start to begin.`);
      return;
    }
    if (mode === 'alphabet') startAlphabetMode();
    else startSignsMode();
  }

  // ---------- Boot ----------
  const setStatus = (s) => { if (statusEl) statusEl.textContent = s; };
  setStatus('Click start to begin');

  let cameraReady = false;
  let holistic = null;
  let handsRunner = null;
  let mlClient = null;
  // v7: in-browser alphabet inference. Loaded lazily; null until needed.
  let onnxRunner = null;
  let letterFilter = null;
  let pumpRunning = false;

  startBtn?.addEventListener('click', async () => {
    if (cameraReady) {
      // Toggle stop
      stopAll();
      cameraReady = false;
      startBtn.textContent = 'Start camera';
      const camChip = document.getElementById('camChip');
      camChip?.classList.remove('live');
      setStatus('Stopped — press start to resume.');
      return;
    }
    startBtn.disabled = true;
    startBtn.textContent = 'Loading…';
    setStatus('Requesting camera…');
    try {
      await startCamera(video);
      cameraReady = true;
      if (currentMode === 'alphabet') await startAlphabetMode();
      else await startSignsMode();
      const camChip = document.getElementById('camChip');
      camChip?.classList.add('live');
      startBtn.disabled = false;
      startBtn.textContent = 'Stop';
    } catch (e) {
      console.error(e);
      setStatus('Error: ' + (e.message || e));
      startBtn.disabled = false;
      startBtn.textContent = 'Retry';
    }
  });

  function stopAll() {
    pumpRunning = false;
    handsRunner?.stop();
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(t => t.stop());
      video.srcObject = null;
    }
    overlay.clear();
  }

  async function startSignsMode() {
    handsRunner?.stop();
    setStatus('Loading sign-recognition model…');
    if (!holistic) {
      try {
        await loadHolistic();
      } catch (e) {
        setStatus('Failed to load MediaPipe Holistic: ' + e.message);
        return;
      }
    }
    setStatus('Recognising — try a sign! (touch chin = thank you, point at chest = me)');
    if (!pumpRunning) startPump();
  }

  async function startAlphabetMode() {
    pumpRunning = false;
    setStatus('Loading alphabet model…');

    // v7: choose backend. Try ONNX first when policy is 'auto' or 'onnx',
    // fall back to the HTTP server when 'auto' or 'http'.
    const backendPref = settings.get('alphabetBackend');
    let useOnnx = false;

    if (backendPref === 'auto' || backendPref === 'onnx') {
      if (!onnxRunner) onnxRunner = new OnnxAlphabetRunner();
      try {
        if (!onnxRunner.loaded) {
          setStatus('Loading in-browser alphabet model (ONNX)…');
          await onnxRunner.load();
        }
        useOnnx = true;
        setStatus('Alphabet (in-browser ONNX) ready.');
      } catch (e) {
        console.info('[bridgetalk] ONNX alphabet unavailable:', e.message);
        if (backendPref === 'onnx') {
          setStatus('ONNX alphabet model not available: ' + e.message);
          return;
        }
        // else fall through to HTTP
      }
    }

    if (!useOnnx) {
      if (!mlClient) {
        mlClient = new AlphabetMLClient({
          minInterval: settings.get('alphabetMinInterval'),
        });
      }
      await mlClient.checkHealth();
      if (!mlClient.healthy) {
        setStatus('Alphabet ML unavailable: ' + (mlClient.healthError || 'backend not reachable. Retrying every 10s.'));
        mlClient.startHealthPolling(10000, (healthy) => {
          if (healthy) setStatus('Alphabet backend now available — switching now.');
          if (healthy && currentMode === 'alphabet') startAlphabetMode();
        });
        return;
      }
    }

    if (!letterFilter) {
      letterFilter = new StableLetterFilter({
        required: settings.get('alphabetRequiredFrames'),
        minConf: settings.get('alphabetMinConfidence'),
        cooldown: settings.get('alphabetCooldown'),
      });
    } else {
      letterFilter.reset();
    }

    if (!handsRunner) {
      handsRunner = new HandsRunner({
        video,
        frameSource,
        getStride: () => settings.get('alphabetFrameStride'),
        onResults: async (r) => {
          const lm = (r.multiHandLandmarks && r.multiHandLandmarks[0]) || null;
          overlay.draw({ rightHandLandmarks: lm }, null, {});
          if (!lm) {
            alphabetMotionGate.push(null, performance.now());
            recogBox.classList.remove('active');
            recogWord.textContent = '—';
            recogWord.classList.add('empty');
            recogConf.textContent = '';
            recogConfBar.style.width = '0%';
            recogKind.textContent = '';
            if (top3El) top3El.innerHTML = '';
            return;
          }

          // v7: motion gate. We still run inference on the first 'still'
          // frame after a 'moving' run, so a held letter gets locked in;
          // we only fully skip when settled into the resting state and
          // there's already been at least one prediction.
          if (settings.get('motionGateEnabled')) {
            const verdict = alphabetMotionGate.push(lm[0], performance.now());
            if (verdict === 'still' && letterFilter.consecutive >= letterFilter.required) {
              // Hand at rest after a confirmed letter — no need to keep
              // pinging the model. Save the CPU; UI stays as it was.
              return;
            }
          }

          // Run inference — ONNX in-browser preferred, HTTP fallback.
          const pred = useOnnx
            ? await onnxRunner.predict(lm)
            : await mlClient.predict(lm);
          if (!pred || pred.error) return;
          recogBox.classList.add('active');
          recogWord.textContent = pred.letter.toUpperCase();
          recogWord.classList.remove('empty');
          const pct = Math.round(pred.confidence * 100);
          recogConf.textContent = pct + '%';
          recogConfBar.style.width = pct + '%';
          recogKind.textContent = useOnnx ? 'alphabet (onnx)' : 'alphabet (ml)';

          // Top-3 ladder
          if (top3El && pred.top3 && settings.get('showTop3')) {
            top3El.innerHTML = pred.top3.map((t, i) => `
              <div class="top3-row ${i===0?'top3-best':''}">
                <span class="top3-letter">${t.letter.toUpperCase()}</span>
                <div class="top3-bar"><div style="width:${Math.round(t.confidence*100)}%"></div></div>
                <span class="top3-pct">${Math.round(t.confidence*100)}%</span>
              </div>
            `).join('');
          }
          const emit = letterFilter.push(pred, performance.now());
          if (emit) {
            sentence.add({
              kind: 'fingerspell',
              word: emit,
              isLetter: true,
              confidence: pred.confidence,
              t: performance.now(),
            });
            recogBox.classList.add('emitted');
            setTimeout(() => recogBox.classList.remove('emitted'), 200);
            if (settings.get('audioFeedback')) audioTick();
          }
        },
      });
      await handsRunner.load();
    }
    const backendLabel = useOnnx ? 'in-browser ONNX' : 'HTTP backend';
    setStatus(`Fingerspell letters — ASL alphabet via ${backendLabel}. (J, Z require motion and are guessed.)`);
    handsRunner.start();
  }

  async function loadHolistic() {
    if (!window.Holistic) {
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675471629/holistic.js');
    }
    holistic = new window.Holistic({
      locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675471629/${f}`,
    });
    holistic.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      refineFaceLandmarks: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    holistic.onResults((results) => {
      window.__lastResults = results;
      const t = performance.now();
      recog.update(results, t);

      // v7: feed motion gate and sequence model. We use the right hand
      // wrist (idx 0) since that's the primary signing hand in our rules.
      const hand = results.rightHandLandmarks || results.leftHandLandmarks;
      const wrist = hand ? hand[0] : null;
      const verdict = signsMotionGate.push(wrist, t);
      const moving = verdict === 'moving';

      if (sequenceModel.available) {
        // Fire-and-forget: the recognizer's modelHook reads _latestSequencePred.
        sequenceModel.pushAndMaybePredict(results, t, moving).then((pred) => {
          if (pred) _latestSequencePred = { ...pred, t: performance.now() };
        }).catch(() => { /* swallowed — logged inside */ });
      }
    });
  }

  async function startCamera(video) {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 640, height: 480 },
      audio: false,
    });
    video.srcObject = stream;
    await new Promise(r => video.onloadedmetadata = r);
    await video.play();
    overlay.resize(video.videoWidth, video.videoHeight);
    overlayCanvas.style.width = '100%';
    overlayCanvas.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
    // Detect track-ended
    stream.getVideoTracks().forEach(track => {
      track.addEventListener('ended', () => {
        setStatus('Camera disconnected. Press start to retry.');
        cameraReady = false;
        startBtn.textContent = 'Start camera';
        const camChip = document.getElementById('camChip');
        camChip?.classList.remove('live');
        pumpRunning = false;
        handsRunner?.stop();
      });
    });
  }

  function startPump() {
    pumpRunning = true;
    let frameIdx = 0;

    // Try to load the sequence model on first start. Failure is fine —
    // it just means dynamic-sign recognition is unavailable. The rule-based
    // recognizer keeps working either way.
    if (settings.get('sequenceModelEnabled') && !sequenceModel.available && !sequenceModel.loadError) {
      sequenceModel.load().catch((e) => {
        console.info('[bridgetalk] sequence model not loaded:', e.message);
      });
    }

    const tick = async () => {
      if (!pumpRunning) return;
      if (currentMode !== 'signs') return;
      try {
        // Frame stride: process 1 of every N rAF ticks. The rest are pure
        // requestAnimationFrame returns — almost free. This is the single
        // biggest CPU saving.
        const stride = settings.get('signsFrameStride') || 1;
        if (frameIdx++ % stride === 0 && video.readyState >= 2) {
          // Use the (possibly downscaled) frame source.
          await holistic.send({ image: frameSource.getInput() });
        }
      } catch (e) {
        console.warn(e);
      }
      requestAnimationFrame(tick);
    };
    tick();
  }

  // ---------- FPS counter ----------
  function updateFps() {
    if (fpsEl && settings.get('showFps')) {
      const fps = recog.stats.fps;
      fpsEl.textContent = `${fps} fps`;
    }
    requestAnimationFrame(updateFps);
  }
  updateFps();

  // ---------- Keyboard shortcuts ----------
  document.addEventListener('keydown', (e) => {
    // Don't intercept typing inputs
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === ' ') {
      e.preventDefault();
      startBtn?.click();
    } else if (e.key === 'u' || e.key === 'U') {
      sentence.undo();
    } else if (e.key === 'Escape') {
      if (settingsPanel?.classList.contains('open')) closeSettings();
      else sentence.clear();
    } else if (e.key === 'Enter') {
      speakBtn?.click();
    } else if (e.key === 'c' || e.key === 'C') {
      copyBtn?.click();
    } else if (e.key === 's' || e.key === 'S') {
      // Toggle settings
      if (settingsPanel?.classList.contains('open')) closeSettings();
      else openSettings();
    } else if (e.key === '1') {
      document.querySelector('[data-mode="signs"]')?.click();
    } else if (e.key === '2') {
      document.querySelector('[data-mode="alphabet"]')?.click();
    }
  });

  // Show a brief shortcut hint after the first start
  let hintShown = sessionStorage.getItem('bridgetalk.hintShown');
  startBtn?.addEventListener('click', () => {
    if (hintShown) return;
    sessionStorage.setItem('bridgetalk.hintShown', '1');
    hintShown = '1';
    const hint = document.getElementById('hintToast');
    if (hint) {
      hint.classList.add('show');
      setTimeout(() => hint.classList.remove('show'), 4000);
    }
  });
}

// ---------- Utilities ----------
function loadScript(url) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = url;
    s.crossOrigin = 'anonymous';
    s.onload = res;
    s.onerror = () => rej(new Error('Failed to load ' + url));
    document.head.appendChild(s);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
