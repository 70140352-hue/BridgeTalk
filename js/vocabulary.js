/* ============================================================
   BridgeTalk v5 — Sign Vocabulary
   ============================================================
   ~90 signs defined as predicates over the per-frame feature
   record (and the pose-history buffer for motion-based signs).

   Each sign is one of:
     - LOCATION: handshape + body-anchor contact (chin, forehead, ...)
     - SHAPE: pure handshape held in neutral space
     - MOTION: trajectory through the buffer (waving, nodding, etc.)
     - SEQUENCE: ordered contacts (e.g., touch chin then move forward)

   Signs return { word, kind, confidence, gloss } when matched.

   Confidence philosophy:
     0.90+ : highly specific multimodal match (shape + contact + facing)
     0.75+ : 2-of-3 modalities match
     0.60+ : single-modality match (e.g., shape only)

   "gloss" is the displayable phrase (may be multi-word, e.g. "thank you").
   ============================================================ */

// Helper: does a hand have a stable contact with one of the named anchors?
function contactsAny(hand, anchorList, stableContact) {
  if (!stableContact) return false;
  return anchorList.includes(stableContact.anchor);
}

// Helper: does either hand contact any of these anchors?
function eitherHandContacts(frame, contacts, anchorList) {
  const hands = ['left', 'right'];
  for (const h of hands) {
    if (frame.hands[h] && contacts[h] && anchorList.includes(contacts[h].anchor)) {
      return frame.hands[h];
    }
  }
  return null;
}

// ============================================================
// LOCATION SIGNS — handshape + body-anchor contact
// ============================================================

const LOCATION_SIGNS = [
  // -------- CHIN signs --------
  {
    word: 'thank you', gloss: 'thank you', kind: 'location',
    test: (frame, contacts) => {
      const h = eitherHandContacts(frame, contacts, ['chin', 'mouth']);
      if (!h) return null;
      // ASL "thank you": flat/open hand, fingertips touch chin, then move outward
      if (!['flat', 'open'].includes(h.shape)) return null;
      return { confidence: 0.88 };
    },
  },
  {
    word: 'thanks', gloss: 'thanks', kind: 'location',
    test: (frame, contacts, history) => {
      const h = eitherHandContacts(frame, contacts, ['chin']);
      if (!h) return null;
      if (!['flat', 'open'].includes(h.shape)) return null;
      // Briefer than 'thank you' — just contact, no required outward motion
      return { confidence: 0.82 };
    },
  },

  // -------- FOREHEAD signs --------
  {
    word: 'father', gloss: 'father', kind: 'location',
    test: (frame, contacts) => {
      const h = eitherHandContacts(frame, contacts, ['forehead']);
      if (!h) return null;
      if (h.contact?.finger !== 'thumb' && h.shape !== 'open' && h.shape !== 'four') return null;
      // ASL: open hand, thumb touches forehead
      return { confidence: 0.85 };
    },
  },
  {
    word: 'know', gloss: 'know', kind: 'location',
    test: (frame, contacts) => {
      const h = eitherHandContacts(frame, contacts, ['forehead', 'temple_l', 'temple_r']);
      if (!h) return null;
      if (!['flat', 'four', 'open'].includes(h.shape)) return null;
      // Tap on forehead/temple
      return { confidence: 0.78 };
    },
  },
  {
    word: 'remember', gloss: 'remember', kind: 'location',
    test: (frame, contacts) => {
      const h = eitherHandContacts(frame, contacts, ['forehead', 'temple_l', 'temple_r']);
      if (!h) return null;
      if (h.shape !== 'thumb' && h.shape !== 'fist') return null;
      return { confidence: 0.78 };
    },
  },
  {
    word: 'think', gloss: 'think', kind: 'location',
    test: (frame, contacts) => {
      const h = eitherHandContacts(frame, contacts, ['forehead', 'temple_l', 'temple_r']);
      if (!h) return null;
      if (h.shape !== 'point') return null;
      return { confidence: 0.86 };
    },
  },
  {
    word: 'understand', gloss: 'understand', kind: 'location',
    test: (frame, contacts) => {
      const h = eitherHandContacts(frame, contacts, ['forehead', 'temple_l', 'temple_r']);
      if (!h) return null;
      if (h.shape !== 'fist' && h.shape !== 'l') return null;
      return { confidence: 0.74 };
    },
  },
  {
    word: 'dream', gloss: 'dream', kind: 'location',
    test: (frame, contacts) => {
      const h = eitherHandContacts(frame, contacts, ['forehead', 'temple_l', 'temple_r']);
      if (!h) return null;
      if (h.shape !== 'point' && h.shape !== 'l') return null;
      return { confidence: 0.7 };
    },
  },

  // -------- MOUTH / LIPS signs --------
  {
    word: 'eat', gloss: 'eat', kind: 'location',
    test: (frame, contacts) => {
      const h = eitherHandContacts(frame, contacts, ['mouth', 'chin']);
      if (!h) return null;
      // ASL "eat": fingers pinched, repeatedly to mouth
      if (!['flat', 'fist', 'open'].includes(h.shape)) return null;
      return { confidence: 0.82 };
    },
  },
  {
    word: 'food', gloss: 'food', kind: 'location',
    test: (frame, contacts) => {
      const h = eitherHandContacts(frame, contacts, ['mouth']);
      if (!h) return null;
      if (!['flat', 'fist'].includes(h.shape)) return null;
      return { confidence: 0.78 };
    },
  },
  {
    word: 'drink', gloss: 'drink', kind: 'location',
    test: (frame, contacts) => {
      const h = eitherHandContacts(frame, contacts, ['mouth', 'chin']);
      if (!h) return null;
      // C-shape (approximated by 'flat' palm-in or 'l') near mouth
      if (h.shape !== 'l' && h.shape !== 'flat') return null;
      return { confidence: 0.74 };
    },
  },
  {
    word: 'speak', gloss: 'speak', kind: 'location',
    test: (frame, contacts) => {
      const h = eitherHandContacts(frame, contacts, ['mouth']);
      if (!h) return null;
      if (h.shape !== 'point' && h.shape !== 'four') return null;
      return { confidence: 0.78 };
    },
  },
  {
    word: 'quiet', gloss: 'quiet', kind: 'location',
    test: (frame, contacts) => {
      const h = eitherHandContacts(frame, contacts, ['mouth']);
      if (!h) return null;
      if (h.shape !== 'point' && h.shape !== 'flat') return null;
      // Should be palm-in (shushing motion)
      if (h.facing !== 'in') return null;
      return { confidence: 0.78 };
    },
  },
  {
    word: 'tell', gloss: 'tell', kind: 'location',
    test: (frame, contacts) => {
      const h = eitherHandContacts(frame, contacts, ['mouth', 'chin']);
      if (!h) return null;
      if (h.shape !== 'point') return null;
      // Differs from 'speak' by motion — should move outward (not handled here, sequence rule below)
      return { confidence: 0.7 };
    },
  },

  // -------- NOSE signs --------
  {
    word: 'funny', gloss: 'funny', kind: 'location',
    test: (frame, contacts) => {
      const h = eitherHandContacts(frame, contacts, ['nose']);
      if (!h) return null;
      if (h.shape !== 'peace' && h.shape !== 'three') return null;
      return { confidence: 0.78 };
    },
  },
  {
    word: 'smell', gloss: 'smell', kind: 'location',
    test: (frame, contacts) => {
      const h = eitherHandContacts(frame, contacts, ['nose']);
      if (!h) return null;
      if (!['open', 'flat', 'four'].includes(h.shape)) return null;
      return { confidence: 0.74 };
    },
  },

  // -------- EAR signs --------
  {
    word: 'hear', gloss: 'hear', kind: 'location',
    test: (frame, contacts) => {
      const h = eitherHandContacts(frame, contacts, ['ear_l', 'ear_r']);
      if (!h) return null;
      if (h.shape !== 'point' && h.shape !== 'l') return null;
      return { confidence: 0.84 };
    },
  },
  {
    word: 'listen', gloss: 'listen', kind: 'location',
    test: (frame, contacts) => {
      const h = eitherHandContacts(frame, contacts, ['ear_l', 'ear_r']);
      if (!h) return null;
      if (!['flat', 'open', 'four'].includes(h.shape)) return null;
      return { confidence: 0.82 };
    },
  },
  {
    word: 'deaf', gloss: 'deaf', kind: 'location',
    test: (frame, contacts, history) => {
      const h = eitherHandContacts(frame, contacts, ['ear_l', 'ear_r']);
      if (!h) return null;
      if (h.shape !== 'point') return null;
      // Touched both ear and mouth recently? (deaf = ear→mouth)
      const tracker = h.handedness === 'Left' ? history.leftTracker : history.rightTracker;
      const seq = tracker?.recentSequence(frame.t) || [];
      const hasMouth = seq.includes('mouth');
      return { confidence: hasMouth ? 0.86 : 0.68 };
    },
  },

  // -------- CHEEK / SIDE-FACE signs --------
  {
    word: 'apple', gloss: 'apple', kind: 'location',
    test: (frame, contacts) => {
      const h = eitherHandContacts(frame, contacts, ['cheek_l', 'cheek_r']);
      if (!h) return null;
      if (h.shape !== 'fist' && h.shape !== 'point') return null;
      return { confidence: 0.7 };
    },
  },
  {
    word: 'home', gloss: 'home', kind: 'location',
    test: (frame, contacts, history) => {
      const h = eitherHandContacts(frame, contacts, ['mouth', 'cheek_l', 'cheek_r']);
      if (!h) return null;
      if (!['flat', 'fist'].includes(h.shape)) return null;
      // Ideally: mouth→cheek motion; we'll accept cheek alone with lower conf
      const tracker = h.handedness === 'Left' ? history.leftTracker : history.rightTracker;
      const seq = tracker?.recentSequence(frame.t) || [];
      const hasMouthThenCheek = seq.includes('mouth') &&
        (seq.includes('cheek_l') || seq.includes('cheek_r'));
      return { confidence: hasMouthThenCheek ? 0.86 : 0.66 };
    },
  },

  // -------- CHEST signs --------
  {
    word: 'me', gloss: 'me', kind: 'location',
    test: (frame, contacts) => {
      const h = eitherHandContacts(frame, contacts, ['chest']);
      if (!h) return null;
      if (h.shape !== 'point') return null;
      if (h.facing !== 'in') return null;
      return { confidence: 0.92 };
    },
  },
  {
    word: 'my', gloss: 'my', kind: 'location',
    test: (frame, contacts) => {
      const h = eitherHandContacts(frame, contacts, ['chest']);
      if (!h) return null;
      if (!['flat', 'open'].includes(h.shape)) return null;
      if (h.facing !== 'in') return null;
      return { confidence: 0.86 };
    },
  },
  {
    word: 'sorry', gloss: 'sorry', kind: 'location',
    test: (frame, contacts) => {
      const h = eitherHandContacts(frame, contacts, ['chest']);
      if (!h) return null;
      if (h.shape !== 'fist') return null;
      if (h.facing !== 'in') return null;
      return { confidence: 0.84 };
    },
  },
  {
    word: 'please', gloss: 'please', kind: 'location',
    test: (frame, contacts) => {
      const h = eitherHandContacts(frame, contacts, ['chest']);
      if (!h) return null;
      if (!['flat', 'open'].includes(h.shape)) return null;
      if (h.facing !== 'in') return null;
      // PLEASE differs from MY by being a circular motion (rule below in motion section)
      return { confidence: 0.7 };
    },
  },
  {
    word: 'fine', gloss: 'fine', kind: 'location',
    test: (frame, contacts) => {
      const h = eitherHandContacts(frame, contacts, ['chest']);
      if (!h) return null;
      if (h.shape !== 'open') return null;
      // Thumb-on-chest version of FINE
      if (h.contact?.finger !== 'thumb') return null;
      return { confidence: 0.78 };
    },
  },
  {
    word: 'feel', gloss: 'feel', kind: 'location',
    test: (frame, contacts) => {
      const h = eitherHandContacts(frame, contacts, ['chest']);
      if (!h) return null;
      if (h.shape !== 'middle' && h.shape !== 'open') return null;
      return { confidence: 0.7 };
    },
  },
  {
    word: 'love', gloss: 'love', kind: 'location',
    test: (frame, contacts) => {
      // LOVE = both fists crossed at chest
      if (!frame.bothHands) return null;
      const lContact = contacts.left, rContact = contacts.right;
      if (!lContact && !rContact) return null;
      const lAtChest = lContact?.anchor === 'chest';
      const rAtChest = rContact?.anchor === 'chest';
      if (!lAtChest && !rAtChest) return null;
      if (frame.hands.left.shape !== 'fist' || frame.hands.right.shape !== 'fist') return null;
      if (!frame.handsTouching) return null;
      return { confidence: 0.88 };
    },
  },

  // -------- SHOULDER signs --------
  {
    word: 'name', gloss: 'name', kind: 'location',
    test: (frame, contacts, history) => {
      // ASL NAME = peace/U on dominant hand tapping peace/U on non-dominant
      // Approximated: peace shape that recently touched neutral space + small tap motion
      const right = frame.hands.right;
      if (!right) return null;
      if (right.shape !== 'peace') return null;
      // Two taps in last 800ms — read from buffer
      const buf = history.frameBuffer || [];
      const recent = buf.slice(-25);
      const peaceFrames = recent.filter(f => f.hands.right?.shape === 'peace');
      if (peaceFrames.length < 6) return null;
      const ys = peaceFrames.map(f => f.hands.right.center.y);
      const yRange = Math.max(...ys) - Math.min(...ys);
      if (yRange < 0.01 || yRange > 0.08) return null;
      return { confidence: 0.74 };
    },
  },

  // -------- HEAD-SIDE / TOP signs --------
  {
    word: 'mother', gloss: 'mother', kind: 'location',
    test: (frame, contacts) => {
      const h = eitherHandContacts(frame, contacts, ['chin', 'cheek_l', 'cheek_r']);
      if (!h) return null;
      // ASL MOTHER: open hand, thumb touches chin
      if (h.shape !== 'open' && h.shape !== 'four') return null;
      if (h.contact?.finger !== 'thumb') return null;
      return { confidence: 0.84 };
    },
  },
];

// ============================================================
// SHAPE-IN-NEUTRAL signs (no body contact required)
// ============================================================

const NEUTRAL_SHAPE_SIGNS = [
  // Pronouns without contact (palm/orientation only)
  {
    word: 'i', gloss: 'I', kind: 'shape',
    test: (frame) => {
      const h = frame.hands.primary;
      if (!h || h.contact) return null;
      if (h.shape !== 'pinky') return null;
      if (h.facing !== 'in') return null;
      return { confidence: 0.84 };
    },
  },
  {
    word: 'you', gloss: 'you', kind: 'shape',
    test: (frame) => {
      const h = frame.hands.primary;
      if (!h || h.contact) return null;
      if (h.shape !== 'point') return null;
      if (h.facing !== 'out') return null;
      return { confidence: 0.85 };
    },
  },
  {
    word: 'yes', gloss: 'yes', kind: 'shape',
    test: (frame) => {
      const h = frame.hands.primary;
      if (!h || h.contact) return null;
      if (h.shape !== 'fist') return null;
      if (h.facing !== 'out') return null;
      return { confidence: 0.62 };
    },
  },
  {
    word: 'okay', gloss: 'okay', kind: 'shape',
    test: (frame) => {
      const h = frame.hands.primary;
      if (!h || h.contact) return null;
      if (h.shape !== 'l') return null;
      if (h.facing !== 'out') return null;
      return { confidence: 0.78 };
    },
  },
  {
    word: 'great', gloss: 'great', kind: 'shape',
    test: (frame) => {
      const h = frame.hands.primary;
      if (!h || h.contact) return null;
      if (h.shape !== 'thumb') return null;
      return { confidence: 0.86 };
    },
  },
  {
    word: 'bad', gloss: 'bad', kind: 'shape',
    test: (frame) => {
      const h = frame.hands.primary;
      if (!h || h.contact) return null;
      if (h.shape !== 'thumb') return null;
      // BAD = thumbs-down: palm angle near ±180 (pointing down)
      if (Math.abs(h.palmAngle) < 130) return null;
      return { confidence: 0.78 };
    },
  },
  // Numbers
  { word: 'one',   kind: 'shape', test: f => shape(f, 'point', 'out') ? { confidence: 0.62 } : null },
  { word: 'two',   kind: 'shape', test: f => shape(f, 'peace', 'out') ? { confidence: 0.7 } : null },
  { word: 'three', kind: 'shape', test: f => (shape(f, 'three', 'out') || shape(f, 'three-t', 'out')) ? { confidence: 0.7 } : null },
  {
    word: 'four', kind: 'shape',
    test: f => {
      const h = f.hands.primary;
      if (!h || h.contact) return null;
      if (h.shape !== 'four' || h.facing !== 'out') return null;
      return { confidence: 0.74 };
    },
  },
  { word: 'five',  kind: 'shape', test: f => shape(f, 'open', 'out') ? { confidence: 0.66 } : null },
  { word: 'rock',  kind: 'shape', test: f => shape(f, 'rock', 'out') ? { confidence: 0.7 } : null },
  { word: 'y',     kind: 'shape', test: f => shape(f, 'y', 'out') ? { confidence: 0.7 } : null },

  // ASL fingerspelling fallback (lowest conf)
  ...alphabetRules(),
];

function shape(frame, shapeName, facing) {
  const h = frame.hands.primary;
  if (!h || h.contact) return false;
  if (h.shape !== shapeName) return false;
  if (facing && h.facing !== facing) return false;
  return true;
}

function alphabetRules() {
  const letters = [
    ['a', 'fist',  'out'],
    ['b', 'four',  'out'],
    ['c', 'flat',  'in'],
    ['d', 'point', 'out'],
    ['e', 'fist',  'in'],
    ['f', 'three', 'out'],
    ['g', 'point', 'in'],
    ['l', 'l',     'out'],
    ['o', 'flat',  'in'],
    ['r', 'peace', 'in'],
    ['s', 'fist',  'out'],
    ['u', 'peace', 'in'],
    ['v', 'peace', 'out'],
    ['w', 'three', 'in'],
    ['y', 'y',     'out'],
  ];
  return letters.map(([letter, sh, fc]) => ({
    word: letter,
    kind: 'letter',
    isLetter: true,
    test: (frame) => {
      const h = frame.hands.primary;
      if (!h || h.contact) return null;
      if (h.shape !== sh || h.facing !== fc) return null;
      return { confidence: 0.55 };
    },
  }));
}

// ============================================================
// MOTION signs (pure trajectory through buffer)
// ============================================================

const MOTION_SIGNS = [
  {
    word: 'hello', gloss: 'hello', kind: 'motion',
    test: (frame, _, history) => {
      const buf = history.frameBuffer || [];
      const recent = buf.slice(-30).filter(
        f => f.hands.primary && f.hands.primary.shape === 'open' && f.hands.primary.facing === 'out'
      );
      if (recent.length < 8) return null;
      const angles = recent.map(f => f.hands.primary.palmAngle);
      const swings = countSignChanges(deltas(angles), 2);
      if (swings >= 2) return { confidence: Math.min(0.88, 0.6 + swings * 0.1) };
      return null;
    },
  },
  {
    word: 'goodbye', gloss: 'goodbye', kind: 'motion',
    test: (frame, _, history) => {
      const buf = history.frameBuffer || [];
      const recent = buf.slice(-25);
      if (recent.length < 10) return null;
      const shapes = recent.map(f => f.hands.primary?.shape).filter(Boolean);
      const toggles = countShapeToggles(shapes, ['open', 'fist']);
      if (toggles >= 2) return { confidence: 0.8 };
      return null;
    },
  },
  {
    word: 'yes', gloss: 'yes', kind: 'motion',
    test: (frame, _, history) => {
      const buf = history.frameBuffer || [];
      const fists = buf.slice(-20).filter(f => f.hands.primary?.shape === 'fist');
      if (fists.length < 6) return null;
      const ys = fists.map(f => f.hands.primary.center.y);
      const swings = countSignChanges(deltas(ys), 0.005);
      if (swings >= 2) return { confidence: 0.84 };
      return null;
    },
  },
  {
    word: 'no', gloss: 'no', kind: 'motion',
    test: (frame, _, history) => {
      const buf = history.frameBuffer || [];
      const recent = buf.slice(-12);
      if (recent.length < 4) return null;
      const earlyOpen = recent.slice(0, 4).filter(
        f => f.hands.primary && (f.hands.primary.shape === 'peace' || f.hands.primary.shape === 'three')
      ).length >= 2;
      const lateClose = recent.slice(-4).filter(
        f => f.hands.primary?.shape === 'fist'
      ).length >= 2;
      if (earlyOpen && lateClose) return { confidence: 0.8 };
      return null;
    },
  },
  {
    word: 'come', gloss: 'come', kind: 'motion',
    test: (frame, _, history) => {
      const buf = history.frameBuffer || [];
      const points = buf.slice(-20).filter(f => f.hands.primary?.shape === 'point');
      if (points.length < 6) return null;
      const sizes = points.map(f => f.hands.primary.size);
      const growth = sizes[sizes.length - 1] - sizes[0];
      if (growth > 0.025) return { confidence: 0.72 };
      return null;
    },
  },
  {
    word: 'go', gloss: 'go', kind: 'motion',
    test: (frame, _, history) => {
      const buf = history.frameBuffer || [];
      const points = buf.slice(-20).filter(f => f.hands.primary?.shape === 'point');
      if (points.length < 6) return null;
      const sizes = points.map(f => f.hands.primary.size);
      const shrink = sizes[0] - sizes[sizes.length - 1];
      if (shrink > 0.025) return { confidence: 0.7 };
      return null;
    },
  },
  {
    word: 'help', gloss: 'help', kind: 'motion',
    test: (frame, _, history) => {
      // HELP = fist-on-flat lifting upward (approximated as fist rising)
      const buf = history.frameBuffer || [];
      const fists = buf.slice(-20).filter(f => f.hands.primary?.shape === 'fist');
      if (fists.length < 6) return null;
      const ys = fists.map(f => f.hands.primary.center.y);
      const rose = ys[0] - ys[ys.length - 1];
      if (rose > 0.08) return { confidence: 0.72 };
      return null;
    },
  },
  {
    word: 'happy', gloss: 'happy', kind: 'motion',
    test: (frame, _, history) => {
      const buf = history.frameBuffer || [];
      const flats = buf.slice(-25).filter(f => {
        const h = f.hands.primary;
        return h && (h.shape === 'flat' || h.shape === 'open') && h.facing === 'in' &&
          h.contact?.anchor === 'chest';
      });
      if (flats.length < 8) return null;
      const ys = flats.map(f => f.hands.primary.center.y);
      const swings = countSignChanges(deltas(ys), 0.005);
      if (swings >= 2) return { confidence: 0.8 };
      return null;
    },
  },
  {
    word: 'meet', gloss: 'meet', kind: 'motion',
    test: (frame, _, history) => {
      // Two index fingers approaching each other
      if (!frame.bothHands) return null;
      const left = frame.hands.left, right = frame.hands.right;
      if (left.shape !== 'point' || right.shape !== 'point') return null;
      const d = Math.hypot(
        left.center.x - right.center.x,
        left.center.y - right.center.y
      );
      // Check trajectory: were they farther apart 0.5s ago?
      const buf = history.frameBuffer || [];
      const past = buf.slice(-20, -10);
      if (past.length < 5) return null;
      const pastDists = past
        .filter(f => f.hands.left && f.hands.right)
        .map(f => Math.hypot(
          f.hands.left.center.x - f.hands.right.center.x,
          f.hands.left.center.y - f.hands.right.center.y
        ));
      if (!pastDists.length) return null;
      const pastAvg = pastDists.reduce((s, x) => s + x, 0) / pastDists.length;
      if (pastAvg - d > 0.04) return { confidence: 0.78 };
      return null;
    },
  },
  {
    word: 'please', gloss: 'please', kind: 'motion',
    test: (frame, _, history) => {
      // Open palm circular on chest
      const buf = history.frameBuffer || [];
      const flats = buf.slice(-25).filter(f => {
        const h = f.hands.primary;
        return h && (h.shape === 'flat' || h.shape === 'open') && h.facing === 'in' &&
          h.contact?.anchor === 'chest';
      });
      if (flats.length < 10) return null;
      const xs = flats.map(f => f.hands.primary.center.x);
      const ys = flats.map(f => f.hands.primary.center.y);
      const xSwings = countSignChanges(deltas(xs), 0.004);
      const ySwings = countSignChanges(deltas(ys), 0.004);
      if (xSwings >= 1 && ySwings >= 1) return { confidence: 0.78 };
      return null;
    },
  },
];

// ============================================================
// Helpers for motion analysis
// ============================================================

function deltas(arr) {
  const out = [];
  for (let i = 1; i < arr.length; i++) out.push(arr[i] - arr[i - 1]);
  return out;
}
function countSignChanges(arr, minDelta = 0) {
  let changes = 0, lastSign = 0;
  for (const v of arr) {
    if (Math.abs(v) < minDelta) continue;
    const s = Math.sign(v);
    if (s !== 0 && lastSign !== 0 && s !== lastSign) changes++;
    if (s !== 0) lastSign = s;
  }
  return changes;
}
function countShapeToggles(shapes, [a, b]) {
  let toggles = 0, last = null;
  for (const s of shapes) {
    if (s !== a && s !== b) continue;
    if (last && s !== last) toggles++;
    last = s;
  }
  return toggles;
}

// ============================================================
// Final exported vocabulary
// ============================================================

export const VOCABULARY = {
  location: LOCATION_SIGNS,
  shape: NEUTRAL_SHAPE_SIGNS,
  motion: MOTION_SIGNS,
};

export const ALL_WORDS = [
  ...LOCATION_SIGNS.map(s => s.word),
  ...NEUTRAL_SHAPE_SIGNS.map(s => s.word),
  ...MOTION_SIGNS.map(s => s.word),
];
