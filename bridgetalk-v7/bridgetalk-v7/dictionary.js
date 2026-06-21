/* ============================================================
   BridgeTalk v4 — Unified PSL/ASL Dictionary
   ============================================================
   Each entry:
     word         — canonical English token (lowercase)
     urdu         — Urdu translation (optional)
     category     — semantic group
     type         — 'static' | 'dynamic' | 'spell'
                    static  : single recognizable handshape
                    dynamic : motion-based (recognized by trajectory + handshape sequence)
                    spell   : no dedicated sign, fallback to fingerspelling
     keyframes    — array of poses for the animator (text→sign)
                    each pose = { hand: 'open'|'fist'|'point'|'peace'|'thumb'|'pinky'|'flat'|'l'|'c',
                                  rot: deg, x: %, y: %, palm: 'in'|'out',
                                  hold: ms }
   ============================================================ */

const DICTIONARY = (() => {
  // Reusable keyframe presets
  const wave = (rotBase = 0) => [
    { hand: 'open', rot: rotBase - 18, x: 50, y: 35, palm: 'out', hold: 200 },
    { hand: 'open', rot: rotBase + 18, x: 50, y: 35, palm: 'out', hold: 200 },
    { hand: 'open', rot: rotBase - 18, x: 50, y: 35, palm: 'out', hold: 200 },
    { hand: 'open', rot: rotBase + 18, x: 50, y: 35, palm: 'out', hold: 200 },
  ];
  const pointSelf = [
    { hand: 'point', rot: 0, x: 50, y: 50, palm: 'in', hold: 500 },
  ];
  const pointOut = [
    { hand: 'point', rot: 0, x: 50, y: 50, palm: 'out', hold: 500 },
  ];
  const flat = (rot = 0, hold = 500) => [
    { hand: 'flat', rot, x: 50, y: 45, palm: 'in', hold },
  ];

  return [
    // ============ GREETINGS ============
    { word: 'hello', urdu: 'سلام', category: 'Greetings', type: 'dynamic', keyframes: wave() },
    { word: 'hi', urdu: 'ہائے', category: 'Greetings', type: 'dynamic', keyframes: wave() },
    { word: 'goodbye', urdu: 'الوداع', category: 'Greetings', type: 'dynamic', keyframes: [
      { hand: 'open', rot: 0, x: 50, y: 35, palm: 'out', hold: 250 },
      { hand: 'fist', rot: 0, x: 50, y: 35, palm: 'out', hold: 250 },
      { hand: 'open', rot: 0, x: 50, y: 35, palm: 'out', hold: 250 },
      { hand: 'fist', rot: 0, x: 50, y: 35, palm: 'out', hold: 250 },
    ]},
    { word: 'bye', urdu: 'الوداع', category: 'Greetings', type: 'dynamic', keyframes: wave() },
    { word: 'welcome', urdu: 'خوش آمدید', category: 'Greetings', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: -30, x: 35, y: 55, palm: 'in', hold: 350 },
      { hand: 'flat', rot: 0, x: 50, y: 50, palm: 'in', hold: 350 },
    ]},
    { word: 'morning', urdu: 'صبح', category: 'Greetings', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: -45, x: 40, y: 60, palm: 'in', hold: 250 },
      { hand: 'flat', rot: 30, x: 50, y: 35, palm: 'in', hold: 350 },
    ]},
    { word: 'afternoon', urdu: 'دوپہر', category: 'Greetings', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 50, y: 30, palm: 'down', hold: 350 },
      { hand: 'flat', rot: -30, x: 50, y: 45, palm: 'down', hold: 350 },
    ]},
    { word: 'evening', urdu: 'شام', category: 'Greetings', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 30, x: 50, y: 35, palm: 'down', hold: 350 },
      { hand: 'flat', rot: 0, x: 50, y: 50, palm: 'down', hold: 350 },
    ]},
    { word: 'night', urdu: 'رات', category: 'Greetings', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 90, x: 50, y: 30, palm: 'down', hold: 250 },
      { hand: 'flat', rot: 30, x: 50, y: 45, palm: 'down', hold: 350 },
    ]},
    { word: 'thanks', urdu: 'شکریہ', category: 'Greetings', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 45, y: 45, palm: 'in', hold: 300 },
      { hand: 'flat', rot: 0, x: 60, y: 55, palm: 'in', hold: 300 },
    ]},
    { word: 'thank', urdu: 'شکریہ', category: 'Greetings', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 45, y: 45, palm: 'in', hold: 300 },
      { hand: 'flat', rot: 0, x: 60, y: 55, palm: 'in', hold: 300 },
    ]},
    { word: 'please', urdu: 'برائے مہربانی', category: 'Greetings', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 50, y: 50, palm: 'in', hold: 250 },
      { hand: 'flat', rot: 15, x: 50, y: 48, palm: 'in', hold: 250 },
      { hand: 'flat', rot: -15, x: 50, y: 52, palm: 'in', hold: 250 },
    ]},
    { word: 'sorry', urdu: 'معاف کیجیے', category: 'Greetings', type: 'dynamic', keyframes: [
      { hand: 'fist', rot: 0, x: 50, y: 50, palm: 'in', hold: 280 },
      { hand: 'fist', rot: 15, x: 50, y: 48, palm: 'in', hold: 280 },
      { hand: 'fist', rot: -15, x: 50, y: 52, palm: 'in', hold: 280 },
    ]},
    { word: 'excuse', urdu: 'معاف کریں', category: 'Greetings', type: 'spell' },
    { word: 'pardon', urdu: 'معاف کریں', category: 'Greetings', type: 'spell' },

    // ============ PRONOUNS ============
    { word: 'i', urdu: 'میں', category: 'Pronouns', type: 'static', keyframes: pointSelf },
    { word: 'me', urdu: 'مجھے', category: 'Pronouns', type: 'static', keyframes: pointSelf },
    { word: 'my', urdu: 'میرا', category: 'Pronouns', type: 'static', keyframes: [
      { hand: 'flat', rot: 0, x: 50, y: 50, palm: 'in', hold: 500 },
    ]},
    { word: 'mine', urdu: 'میرا', category: 'Pronouns', type: 'static', keyframes: [
      { hand: 'flat', rot: 0, x: 50, y: 50, palm: 'in', hold: 500 },
    ]},
    { word: 'you', urdu: 'تم', category: 'Pronouns', type: 'static', keyframes: pointOut },
    { word: 'your', urdu: 'تمہارا', category: 'Pronouns', type: 'static', keyframes: [
      { hand: 'flat', rot: 0, x: 50, y: 45, palm: 'out', hold: 500 },
    ]},
    { word: 'we', urdu: 'ہم', category: 'Pronouns', type: 'dynamic', keyframes: [
      { hand: 'point', rot: 0, x: 35, y: 50, palm: 'in', hold: 250 },
      { hand: 'point', rot: 0, x: 65, y: 50, palm: 'in', hold: 250 },
    ]},
    { word: 'us', urdu: 'ہمیں', category: 'Pronouns', type: 'dynamic', keyframes: [
      { hand: 'point', rot: 0, x: 35, y: 50, palm: 'in', hold: 250 },
      { hand: 'point', rot: 0, x: 65, y: 50, palm: 'in', hold: 250 },
    ]},
    { word: 'they', urdu: 'وہ', category: 'Pronouns', type: 'static', keyframes: [
      { hand: 'point', rot: 30, x: 65, y: 45, palm: 'out', hold: 500 },
    ]},
    { word: 'he', urdu: 'وہ', category: 'Pronouns', type: 'static', keyframes: pointOut },
    { word: 'she', urdu: 'وہ', category: 'Pronouns', type: 'static', keyframes: pointOut },
    { word: 'it', urdu: 'یہ', category: 'Pronouns', type: 'static', keyframes: pointOut },
    { word: 'this', urdu: 'یہ', category: 'Pronouns', type: 'static', keyframes: [
      { hand: 'point', rot: 0, x: 50, y: 60, palm: 'down', hold: 500 },
    ]},
    { word: 'that', urdu: 'وہ', category: 'Pronouns', type: 'static', keyframes: [
      { hand: 'point', rot: 30, x: 65, y: 50, palm: 'out', hold: 500 },
    ]},

    // ============ COMMON VERBS ============
    { word: 'is', urdu: 'ہے', category: 'Verbs', type: 'static', keyframes: [
      { hand: 'pinky', rot: 0, x: 50, y: 45, palm: 'out', hold: 400 },
    ]},
    { word: 'am', urdu: 'ہوں', category: 'Verbs', type: 'static', keyframes: [
      { hand: 'thumb', rot: 0, x: 45, y: 45, palm: 'in', hold: 400 },
    ]},
    { word: 'are', urdu: 'ہیں', category: 'Verbs', type: 'static', keyframes: [
      { hand: 'flat', rot: 0, x: 50, y: 45, palm: 'out', hold: 400 },
    ]},
    { word: 'was', urdu: 'تھا', category: 'Verbs', type: 'spell' },
    { word: 'were', urdu: 'تھے', category: 'Verbs', type: 'spell' },
    { word: 'be', urdu: 'ہونا', category: 'Verbs', type: 'spell' },
    { word: 'have', urdu: 'رکھنا', category: 'Verbs', type: 'static', keyframes: [
      { hand: 'flat', rot: 0, x: 50, y: 50, palm: 'in', hold: 500 },
    ]},
    { word: 'has', urdu: 'رکھتا', category: 'Verbs', type: 'static', keyframes: [
      { hand: 'flat', rot: 0, x: 50, y: 50, palm: 'in', hold: 500 },
    ]},
    { word: 'do', urdu: 'کرنا', category: 'Verbs', type: 'dynamic', keyframes: [
      { hand: 'fist', rot: 0, x: 40, y: 55, palm: 'down', hold: 250 },
      { hand: 'fist', rot: 0, x: 60, y: 55, palm: 'down', hold: 250 },
    ]},
    { word: 'go', urdu: 'جانا', category: 'Verbs', type: 'dynamic', keyframes: [
      { hand: 'point', rot: -30, x: 35, y: 55, palm: 'out', hold: 250 },
      { hand: 'point', rot: 30, x: 65, y: 35, palm: 'out', hold: 250 },
    ]},
    { word: 'come', urdu: 'آنا', category: 'Verbs', type: 'dynamic', keyframes: [
      { hand: 'point', rot: 30, x: 65, y: 35, palm: 'in', hold: 250 },
      { hand: 'point', rot: -30, x: 35, y: 55, palm: 'in', hold: 250 },
    ]},
    { word: 'eat', urdu: 'کھانا', category: 'Verbs', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 55, y: 55, palm: 'in', hold: 250 },
      { hand: 'flat', rot: 0, x: 50, y: 40, palm: 'in', hold: 250 },
    ]},
    { word: 'drink', urdu: 'پینا', category: 'Verbs', type: 'dynamic', keyframes: [
      { hand: 'c', rot: 0, x: 55, y: 55, palm: 'in', hold: 250 },
      { hand: 'c', rot: -30, x: 50, y: 40, palm: 'in', hold: 250 },
    ]},
    { word: 'sleep', urdu: 'سونا', category: 'Verbs', type: 'dynamic', keyframes: [
      { hand: 'open', rot: 0, x: 50, y: 35, palm: 'in', hold: 250 },
      { hand: 'fist', rot: 0, x: 50, y: 40, palm: 'in', hold: 350 },
    ]},
    { word: 'work', urdu: 'کام', category: 'Verbs', type: 'dynamic', keyframes: [
      { hand: 'fist', rot: 0, x: 40, y: 50, palm: 'down', hold: 200 },
      { hand: 'fist', rot: 0, x: 60, y: 50, palm: 'down', hold: 200 },
      { hand: 'fist', rot: 0, x: 40, y: 50, palm: 'down', hold: 200 },
    ]},
    { word: 'live', urdu: 'رہنا', category: 'Verbs', type: 'dynamic', keyframes: [
      { hand: 'thumb', rot: 0, x: 40, y: 60, palm: 'in', hold: 250 },
      { hand: 'thumb', rot: 0, x: 50, y: 40, palm: 'in', hold: 250 },
    ]},
    { word: 'know', urdu: 'جاننا', category: 'Verbs', type: 'static', keyframes: [
      { hand: 'flat', rot: 0, x: 55, y: 30, palm: 'in', hold: 500 },
    ]},
    { word: 'think', urdu: 'سوچنا', category: 'Verbs', type: 'static', keyframes: [
      { hand: 'point', rot: 0, x: 55, y: 25, palm: 'in', hold: 500 },
    ]},
    { word: 'see', urdu: 'دیکھنا', category: 'Verbs', type: 'dynamic', keyframes: [
      { hand: 'peace', rot: 0, x: 45, y: 30, palm: 'in', hold: 250 },
      { hand: 'peace', rot: 0, x: 60, y: 35, palm: 'out', hold: 250 },
    ]},
    { word: 'look', urdu: 'دیکھو', category: 'Verbs', type: 'static', keyframes: [
      { hand: 'peace', rot: 0, x: 50, y: 35, palm: 'out', hold: 500 },
    ]},
    { word: 'hear', urdu: 'سننا', category: 'Verbs', type: 'static', keyframes: [
      { hand: 'point', rot: 0, x: 65, y: 30, palm: 'in', hold: 500 },
    ]},
    { word: 'speak', urdu: 'بولنا', category: 'Verbs', type: 'dynamic', keyframes: [
      { hand: 'point', rot: 90, x: 50, y: 40, palm: 'in', hold: 200 },
      { hand: 'point', rot: 90, x: 60, y: 45, palm: 'in', hold: 200 },
    ]},
    { word: 'say', urdu: 'کہنا', category: 'Verbs', type: 'dynamic', keyframes: [
      { hand: 'point', rot: 90, x: 50, y: 40, palm: 'in', hold: 200 },
      { hand: 'point', rot: 90, x: 60, y: 45, palm: 'in', hold: 200 },
    ]},
    { word: 'love', urdu: 'محبت', category: 'Verbs', type: 'static', keyframes: [
      { hand: 'fist', rot: 0, x: 50, y: 50, palm: 'in', hold: 300 },
      { hand: 'fist', rot: 0, x: 50, y: 48, palm: 'in', hold: 300 },
    ]},
    { word: 'like', urdu: 'پسند', category: 'Verbs', type: 'dynamic', keyframes: [
      { hand: 'open', rot: 0, x: 50, y: 50, palm: 'in', hold: 200 },
      { hand: 'l', rot: 0, x: 50, y: 50, palm: 'in', hold: 250 },
    ]},
    { word: 'want', urdu: 'چاہیے', category: 'Verbs', type: 'dynamic', keyframes: [
      { hand: 'open', rot: 0, x: 50, y: 40, palm: 'in', hold: 200 },
      { hand: 'open', rot: 0, x: 50, y: 55, palm: 'in', hold: 250 },
    ]},
    { word: 'need', urdu: 'ضرورت', category: 'Verbs', type: 'dynamic', keyframes: [
      { hand: 'point', rot: 0, x: 50, y: 35, palm: 'down', hold: 200 },
      { hand: 'point', rot: 0, x: 50, y: 55, palm: 'down', hold: 200 },
    ]},
    { word: 'help', urdu: 'مدد', category: 'Verbs', type: 'dynamic', keyframes: [
      { hand: 'fist', rot: 0, x: 50, y: 55, palm: 'in', hold: 250 },
      { hand: 'fist', rot: 0, x: 50, y: 40, palm: 'in', hold: 250 },
    ]},
    { word: 'meet', urdu: 'ملاقات', category: 'Verbs', type: 'dynamic', keyframes: [
      { hand: 'point', rot: -30, x: 30, y: 50, palm: 'out', hold: 250 },
      { hand: 'point', rot: 0, x: 50, y: 50, palm: 'out', hold: 350 },
    ]},
    { word: 'learn', urdu: 'سیکھنا', category: 'Verbs', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 50, y: 60, palm: 'down', hold: 250 },
      { hand: 'fist', rot: 0, x: 55, y: 30, palm: 'in', hold: 350 },
    ]},
    { word: 'teach', urdu: 'سکھانا', category: 'Verbs', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 50, y: 30, palm: 'out', hold: 250 },
      { hand: 'flat', rot: 0, x: 60, y: 45, palm: 'out', hold: 350 },
    ]},
    { word: 'study', urdu: 'پڑھنا', category: 'Verbs', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 45, y: 50, palm: 'in', hold: 200 },
      { hand: 'open', rot: 0, x: 55, y: 35, palm: 'down', hold: 200 },
    ]},
    { word: 'read', urdu: 'پڑھنا', category: 'Verbs', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 40, y: 50, palm: 'up', hold: 200 },
      { hand: 'peace', rot: 0, x: 60, y: 50, palm: 'in', hold: 250 },
    ]},
    { word: 'write', urdu: 'لکھنا', category: 'Verbs', type: 'dynamic', keyframes: [
      { hand: 'point', rot: -30, x: 40, y: 55, palm: 'down', hold: 200 },
      { hand: 'point', rot: 30, x: 60, y: 50, palm: 'down', hold: 200 },
    ]},
    { word: 'play', urdu: 'کھیلنا', category: 'Verbs', type: 'dynamic', keyframes: [
      { hand: 'pinky', rot: -20, x: 50, y: 45, palm: 'in', hold: 200 },
      { hand: 'pinky', rot: 20, x: 50, y: 45, palm: 'in', hold: 200 },
      { hand: 'pinky', rot: -20, x: 50, y: 45, palm: 'in', hold: 200 },
    ]},
    { word: 'sit', urdu: 'بیٹھنا', category: 'Verbs', type: 'dynamic', keyframes: [
      { hand: 'peace', rot: 0, x: 45, y: 40, palm: 'down', hold: 250 },
      { hand: 'peace', rot: 0, x: 55, y: 55, palm: 'down', hold: 350 },
    ]},
    { word: 'stand', urdu: 'کھڑے ہونا', category: 'Verbs', type: 'spell' },
    { word: 'walk', urdu: 'چلنا', category: 'Verbs', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 40, y: 55, palm: 'down', hold: 200 },
      { hand: 'flat', rot: 0, x: 60, y: 55, palm: 'down', hold: 200 },
      { hand: 'flat', rot: 0, x: 40, y: 55, palm: 'down', hold: 200 },
    ]},
    { word: 'run', urdu: 'دوڑنا', category: 'Verbs', type: 'spell' },
    { word: 'open', urdu: 'کھولنا', category: 'Verbs', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 50, y: 50, palm: 'out', hold: 200 },
      { hand: 'open', rot: 0, x: 50, y: 50, palm: 'out', hold: 250 },
    ]},
    { word: 'close', urdu: 'بند', category: 'Verbs', type: 'dynamic', keyframes: [
      { hand: 'open', rot: 0, x: 50, y: 50, palm: 'out', hold: 200 },
      { hand: 'fist', rot: 0, x: 50, y: 50, palm: 'out', hold: 250 },
    ]},
    { word: 'give', urdu: 'دینا', category: 'Verbs', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 35, y: 55, palm: 'up', hold: 250 },
      { hand: 'flat', rot: 0, x: 65, y: 50, palm: 'up', hold: 250 },
    ]},
    { word: 'take', urdu: 'لینا', category: 'Verbs', type: 'dynamic', keyframes: [
      { hand: 'open', rot: 0, x: 65, y: 50, palm: 'down', hold: 250 },
      { hand: 'fist', rot: 0, x: 35, y: 55, palm: 'in', hold: 250 },
    ]},
    { word: 'make', urdu: 'بنانا', category: 'Verbs', type: 'spell' },
    { word: 'find', urdu: 'تلاش', category: 'Verbs', type: 'spell' },

    // ============ KEY NOUNS ============
    { word: 'name', urdu: 'نام', category: 'Identity', type: 'dynamic', keyframes: [
      { hand: 'peace', rot: 30, x: 45, y: 45, palm: 'down', hold: 200 },
      { hand: 'peace', rot: -30, x: 55, y: 50, palm: 'down', hold: 200 },
      { hand: 'peace', rot: 30, x: 45, y: 45, palm: 'down', hold: 200 },
    ]},
    { word: 'age', urdu: 'عمر', category: 'Identity', type: 'dynamic', keyframes: [
      { hand: 'fist', rot: 0, x: 50, y: 50, palm: 'in', hold: 200 },
      { hand: 'flat', rot: 0, x: 50, y: 60, palm: 'down', hold: 250 },
    ]},
    { word: 'student', urdu: 'طالب علم', category: 'Education', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 45, y: 50, palm: 'up', hold: 200 },
      { hand: 'fist', rot: 0, x: 55, y: 30, palm: 'in', hold: 250 },
    ]},
    { word: 'teacher', urdu: 'استاد', category: 'Education', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 50, y: 30, palm: 'out', hold: 200 },
      { hand: 'flat', rot: 0, x: 50, y: 50, palm: 'down', hold: 250 },
    ]},
    { word: 'school', urdu: 'سکول', category: 'Education', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 45, y: 50, palm: 'down', hold: 200 },
      { hand: 'flat', rot: 0, x: 55, y: 50, palm: 'up', hold: 200 },
      { hand: 'flat', rot: 0, x: 45, y: 50, palm: 'down', hold: 200 },
    ]},
    { word: 'university', urdu: 'یونیورسٹی', category: 'Education', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 45, y: 55, palm: 'down', hold: 200 },
      { hand: 'flat', rot: 0, x: 50, y: 35, palm: 'down', hold: 250 },
    ]},
    { word: 'class', urdu: 'کلاس', category: 'Education', type: 'spell' },
    { word: 'book', urdu: 'کتاب', category: 'Education', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 50, y: 50, palm: 'in', hold: 200 },
      { hand: 'open', rot: 0, x: 50, y: 50, palm: 'up', hold: 250 },
    ]},
    { word: 'pen', urdu: 'قلم', category: 'Education', type: 'spell' },
    { word: 'paper', urdu: 'کاغذ', category: 'Education', type: 'spell' },
    { word: 'language', urdu: 'زبان', category: 'Communication', type: 'dynamic', keyframes: [
      { hand: 'l', rot: 0, x: 45, y: 50, palm: 'down', hold: 200 },
      { hand: 'l', rot: 0, x: 55, y: 50, palm: 'down', hold: 200 },
    ]},
    { word: 'sign', urdu: 'اشارہ', category: 'Communication', type: 'dynamic', keyframes: [
      { hand: 'point', rot: -20, x: 40, y: 40, palm: 'in', hold: 200 },
      { hand: 'point', rot: 20, x: 60, y: 40, palm: 'in', hold: 200 },
      { hand: 'point', rot: -20, x: 40, y: 40, palm: 'in', hold: 200 },
    ]},
    { word: 'word', urdu: 'لفظ', category: 'Communication', type: 'static', keyframes: [
      { hand: 'peace', rot: 0, x: 50, y: 50, palm: 'out', hold: 500 },
    ]},
    { word: 'home', urdu: 'گھر', category: 'Places', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 45, y: 55, palm: 'in', hold: 200 },
      { hand: 'flat', rot: 0, x: 55, y: 45, palm: 'in', hold: 250 },
    ]},
    { word: 'house', urdu: 'گھر', category: 'Places', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: -45, x: 40, y: 35, palm: 'down', hold: 250 },
      { hand: 'flat', rot: 0, x: 50, y: 50, palm: 'in', hold: 250 },
    ]},
    { word: 'family', urdu: 'خاندان', category: 'Family', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 45, y: 50, palm: 'out', hold: 250 },
      { hand: 'flat', rot: 0, x: 55, y: 50, palm: 'in', hold: 250 },
    ]},
    { word: 'mother', urdu: 'ماں', category: 'Family', type: 'static', keyframes: [
      { hand: 'open', rot: 0, x: 55, y: 50, palm: 'out', hold: 500 },
    ]},
    { word: 'father', urdu: 'باپ', category: 'Family', type: 'static', keyframes: [
      { hand: 'open', rot: 0, x: 50, y: 35, palm: 'out', hold: 500 },
    ]},
    { word: 'mom', urdu: 'امی', category: 'Family', type: 'static', keyframes: [
      { hand: 'open', rot: 0, x: 55, y: 50, palm: 'out', hold: 500 },
    ]},
    { word: 'dad', urdu: 'ابو', category: 'Family', type: 'static', keyframes: [
      { hand: 'open', rot: 0, x: 50, y: 35, palm: 'out', hold: 500 },
    ]},
    { word: 'brother', urdu: 'بھائی', category: 'Family', type: 'spell' },
    { word: 'sister', urdu: 'بہن', category: 'Family', type: 'spell' },
    { word: 'son', urdu: 'بیٹا', category: 'Family', type: 'spell' },
    { word: 'daughter', urdu: 'بیٹی', category: 'Family', type: 'spell' },
    { word: 'friend', urdu: 'دوست', category: 'Family', type: 'dynamic', keyframes: [
      { hand: 'point', rot: 0, x: 45, y: 50, palm: 'down', hold: 200 },
      { hand: 'point', rot: 0, x: 55, y: 50, palm: 'up', hold: 250 },
    ]},

    // ============ FEELINGS ============
    { word: 'happy', urdu: 'خوش', category: 'Feelings', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 50, y: 50, palm: 'in', hold: 200 },
      { hand: 'flat', rot: 0, x: 50, y: 40, palm: 'in', hold: 200 },
      { hand: 'flat', rot: 0, x: 50, y: 50, palm: 'in', hold: 200 },
    ]},
    { word: 'sad', urdu: 'اداس', category: 'Feelings', type: 'dynamic', keyframes: [
      { hand: 'open', rot: 0, x: 50, y: 35, palm: 'in', hold: 200 },
      { hand: 'open', rot: 0, x: 50, y: 55, palm: 'in', hold: 350 },
    ]},
    { word: 'fine', urdu: 'ٹھیک', category: 'Feelings', type: 'static', keyframes: [
      { hand: 'open', rot: 0, x: 50, y: 50, palm: 'out', hold: 500 },
    ]},
    { word: 'good', urdu: 'اچھا', category: 'Feelings', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 50, y: 40, palm: 'in', hold: 200 },
      { hand: 'flat', rot: 0, x: 50, y: 55, palm: 'up', hold: 250 },
    ]},
    { word: 'great', urdu: 'بہترین', category: 'Feelings', type: 'static', keyframes: [
      { hand: 'thumb', rot: 0, x: 50, y: 50, palm: 'in', hold: 500 },
    ]},
    { word: 'bad', urdu: 'برا', category: 'Feelings', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 50, y: 40, palm: 'in', hold: 200 },
      { hand: 'flat', rot: 0, x: 50, y: 55, palm: 'down', hold: 250 },
    ]},
    { word: 'nice', urdu: 'اچھا', category: 'Feelings', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 35, y: 50, palm: 'down', hold: 200 },
      { hand: 'flat', rot: 0, x: 65, y: 50, palm: 'down', hold: 200 },
    ]},
    { word: 'angry', urdu: 'غصہ', category: 'Feelings', type: 'static', keyframes: [
      { hand: 'c', rot: 0, x: 50, y: 40, palm: 'in', hold: 500 },
    ]},
    { word: 'tired', urdu: 'تھکا', category: 'Feelings', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 50, y: 45, palm: 'in', hold: 200 },
      { hand: 'flat', rot: 30, x: 50, y: 55, palm: 'in', hold: 250 },
    ]},
    { word: 'okay', urdu: 'ٹھیک', category: 'Feelings', type: 'static', keyframes: [
      { hand: 'l', rot: 0, x: 50, y: 50, palm: 'out', hold: 500 },
    ]},
    { word: 'ok', urdu: 'ٹھیک', category: 'Feelings', type: 'static', keyframes: [
      { hand: 'l', rot: 0, x: 50, y: 50, palm: 'out', hold: 500 },
    ]},
    { word: 'beautiful', urdu: 'خوبصورت', category: 'Feelings', type: 'dynamic', keyframes: [
      { hand: 'open', rot: 0, x: 50, y: 50, palm: 'in', hold: 200 },
      { hand: 'fist', rot: 0, x: 50, y: 50, palm: 'in', hold: 250 },
    ]},
    { word: 'cold', urdu: 'سرد', category: 'Feelings', type: 'dynamic', keyframes: [
      { hand: 'fist', rot: -20, x: 40, y: 50, palm: 'in', hold: 200 },
      { hand: 'fist', rot: 20, x: 60, y: 50, palm: 'in', hold: 200 },
      { hand: 'fist', rot: -20, x: 40, y: 50, palm: 'in', hold: 200 },
    ]},
    { word: 'hot', urdu: 'گرم', category: 'Feelings', type: 'dynamic', keyframes: [
      { hand: 'c', rot: 0, x: 50, y: 45, palm: 'in', hold: 200 },
      { hand: 'c', rot: 90, x: 60, y: 45, palm: 'down', hold: 250 },
    ]},
    { word: 'hungry', urdu: 'بھوک', category: 'Feelings', type: 'dynamic', keyframes: [
      { hand: 'c', rot: 0, x: 50, y: 40, palm: 'in', hold: 200 },
      { hand: 'c', rot: 0, x: 50, y: 55, palm: 'in', hold: 250 },
    ]},

    // ============ QUESTIONS ============
    { word: 'what', urdu: 'کیا', category: 'Questions', type: 'dynamic', keyframes: [
      { hand: 'open', rot: -20, x: 40, y: 50, palm: 'up', hold: 250 },
      { hand: 'open', rot: 20, x: 60, y: 50, palm: 'up', hold: 250 },
    ]},
    { word: 'who', urdu: 'کون', category: 'Questions', type: 'static', keyframes: [
      { hand: 'l', rot: 0, x: 50, y: 35, palm: 'in', hold: 500 },
    ]},
    { word: 'where', urdu: 'کہاں', category: 'Questions', type: 'dynamic', keyframes: [
      { hand: 'point', rot: -20, x: 50, y: 50, palm: 'out', hold: 200 },
      { hand: 'point', rot: 20, x: 50, y: 50, palm: 'out', hold: 200 },
      { hand: 'point', rot: -20, x: 50, y: 50, palm: 'out', hold: 200 },
    ]},
    { word: 'when', urdu: 'کب', category: 'Questions', type: 'static', keyframes: [
      { hand: 'point', rot: 0, x: 50, y: 50, palm: 'in', hold: 500 },
    ]},
    { word: 'why', urdu: 'کیوں', category: 'Questions', type: 'dynamic', keyframes: [
      { hand: 'open', rot: 0, x: 55, y: 30, palm: 'in', hold: 200 },
      { hand: 'pinky', rot: 0, x: 55, y: 35, palm: 'in', hold: 250 },
    ]},
    { word: 'how', urdu: 'کیسے', category: 'Questions', type: 'dynamic', keyframes: [
      { hand: 'fist', rot: 0, x: 50, y: 50, palm: 'down', hold: 200 },
      { hand: 'open', rot: 0, x: 50, y: 50, palm: 'up', hold: 250 },
    ]},
    { word: 'which', urdu: 'کونسا', category: 'Questions', type: 'dynamic', keyframes: [
      { hand: 'thumb', rot: 0, x: 45, y: 50, palm: 'in', hold: 200 },
      { hand: 'thumb', rot: 0, x: 55, y: 50, palm: 'in', hold: 200 },
    ]},

    // ============ YES / NO / RESPONSES ============
    { word: 'yes', urdu: 'ہاں', category: 'Responses', type: 'dynamic', keyframes: [
      { hand: 'fist', rot: 0, x: 50, y: 40, palm: 'out', hold: 200 },
      { hand: 'fist', rot: 30, x: 50, y: 50, palm: 'down', hold: 200 },
      { hand: 'fist', rot: 0, x: 50, y: 40, palm: 'out', hold: 200 },
    ]},
    { word: 'no', urdu: 'نہیں', category: 'Responses', type: 'dynamic', keyframes: [
      { hand: 'peace', rot: 0, x: 50, y: 45, palm: 'out', hold: 200 },
      { hand: 'fist', rot: 0, x: 50, y: 45, palm: 'out', hold: 250 },
    ]},
    { word: 'maybe', urdu: 'شاید', category: 'Responses', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 40, y: 50, palm: 'up', hold: 200 },
      { hand: 'flat', rot: 0, x: 60, y: 50, palm: 'up', hold: 200 },
      { hand: 'flat', rot: 0, x: 40, y: 50, palm: 'up', hold: 200 },
    ]},
    { word: 'sure', urdu: 'یقیناً', category: 'Responses', type: 'static', keyframes: [
      { hand: 'point', rot: 0, x: 50, y: 35, palm: 'in', hold: 500 },
    ]},
    { word: 'not', urdu: 'نہیں', category: 'Responses', type: 'dynamic', keyframes: [
      { hand: 'thumb', rot: 0, x: 50, y: 45, palm: 'in', hold: 200 },
      { hand: 'thumb', rot: 0, x: 65, y: 45, palm: 'out', hold: 250 },
    ]},

    // ============ NUMBERS 0-20 + tens ============
    ...[
      ['zero','صفر'], ['one','ایک'], ['two','دو'], ['three','تین'], ['four','چار'],
      ['five','پانچ'], ['six','چھ'], ['seven','سات'], ['eight','آٹھ'], ['nine','نو'],
      ['ten','دس'], ['eleven','گیارہ'], ['twelve','بارہ'], ['thirteen','تیرہ'],
      ['fourteen','چودہ'], ['fifteen','پندرہ'], ['sixteen','سولہ'], ['seventeen','سترہ'],
      ['eighteen','اٹھارہ'], ['nineteen','انیس'], ['twenty','بیس'],
      ['thirty','تیس'], ['forty','چالیس'], ['fifty','پچاس'], ['sixty','ساٹھ'],
      ['seventy','ستر'], ['eighty','اسی'], ['ninety','نوے'], ['hundred','سو'],
    ].map(([w, u]) => ({
      word: w, urdu: u, category: 'Numbers', type: 'static',
      keyframes: numberKeyframe(w),
    })),

    // ============ TIME ============
    { word: 'today', urdu: 'آج', category: 'Time', type: 'dynamic', keyframes: [
      { hand: 'thumb', rot: 0, x: 45, y: 50, palm: 'down', hold: 200 },
      { hand: 'thumb', rot: 0, x: 55, y: 50, palm: 'down', hold: 200 },
    ]},
    { word: 'tomorrow', urdu: 'کل', category: 'Time', type: 'dynamic', keyframes: [
      { hand: 'thumb', rot: 0, x: 50, y: 50, palm: 'in', hold: 200 },
      { hand: 'thumb', rot: 30, x: 60, y: 45, palm: 'in', hold: 250 },
    ]},
    { word: 'yesterday', urdu: 'گزرا کل', category: 'Time', type: 'dynamic', keyframes: [
      { hand: 'thumb', rot: 0, x: 50, y: 50, palm: 'in', hold: 200 },
      { hand: 'thumb', rot: -30, x: 35, y: 45, palm: 'in', hold: 250 },
    ]},
    { word: 'now', urdu: 'ابھی', category: 'Time', type: 'dynamic', keyframes: [
      { hand: 'l', rot: 0, x: 50, y: 40, palm: 'up', hold: 200 },
      { hand: 'l', rot: 0, x: 50, y: 55, palm: 'up', hold: 250 },
    ]},
    { word: 'later', urdu: 'بعد میں', category: 'Time', type: 'dynamic', keyframes: [
      { hand: 'l', rot: -30, x: 50, y: 50, palm: 'in', hold: 200 },
      { hand: 'l', rot: 30, x: 50, y: 50, palm: 'in', hold: 250 },
    ]},
    { word: 'time', urdu: 'وقت', category: 'Time', type: 'static', keyframes: [
      { hand: 'point', rot: 0, x: 55, y: 50, palm: 'down', hold: 500 },
    ]},
    { word: 'day', urdu: 'دن', category: 'Time', type: 'dynamic', keyframes: [
      { hand: 'point', rot: -45, x: 35, y: 35, palm: 'in', hold: 200 },
      { hand: 'point', rot: 45, x: 65, y: 35, palm: 'in', hold: 250 },
    ]},
    { word: 'week', urdu: 'ہفتہ', category: 'Time', type: 'dynamic', keyframes: [
      { hand: 'point', rot: 0, x: 35, y: 50, palm: 'down', hold: 200 },
      { hand: 'point', rot: 0, x: 65, y: 50, palm: 'down', hold: 250 },
    ]},
    { word: 'month', urdu: 'مہینہ', category: 'Time', type: 'dynamic', keyframes: [
      { hand: 'point', rot: 0, x: 50, y: 35, palm: 'in', hold: 200 },
      { hand: 'point', rot: 0, x: 50, y: 60, palm: 'in', hold: 250 },
    ]},
    { word: 'year', urdu: 'سال', category: 'Time', type: 'dynamic', keyframes: [
      { hand: 'fist', rot: -90, x: 45, y: 50, palm: 'in', hold: 200 },
      { hand: 'fist', rot: 90, x: 55, y: 50, palm: 'in', hold: 250 },
    ]},

    // ============ PLACES & CITIES ============
    { word: 'pakistan', urdu: 'پاکستان', category: 'Places', type: 'dynamic', keyframes: [
      { hand: 'point', rot: 30, x: 45, y: 30, palm: 'in', hold: 250 },
      { hand: 'point', rot: 0, x: 50, y: 50, palm: 'in', hold: 250 },
    ]},
    { word: 'lahore', urdu: 'لاہور', category: 'Places', type: 'spell' },
    { word: 'karachi', urdu: 'کراچی', category: 'Places', type: 'spell' },
    { word: 'islamabad', urdu: 'اسلام آباد', category: 'Places', type: 'spell' },
    { word: 'peshawar', urdu: 'پشاور', category: 'Places', type: 'spell' },
    { word: 'quetta', urdu: 'کوئٹہ', category: 'Places', type: 'spell' },
    { word: 'multan', urdu: 'ملتان', category: 'Places', type: 'spell' },
    { word: 'faisalabad', urdu: 'فیصل آباد', category: 'Places', type: 'spell' },
    { word: 'rawalpindi', urdu: 'راولپنڈی', category: 'Places', type: 'spell' },
    { word: 'india', urdu: 'انڈیا', category: 'Places', type: 'spell' },
    { word: 'america', urdu: 'امریکہ', category: 'Places', type: 'spell' },
    { word: 'city', urdu: 'شہر', category: 'Places', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: -45, x: 40, y: 40, palm: 'down', hold: 200 },
      { hand: 'flat', rot: 45, x: 55, y: 50, palm: 'down', hold: 200 },
      { hand: 'flat', rot: -45, x: 40, y: 40, palm: 'down', hold: 200 },
    ]},
    { word: 'country', urdu: 'ملک', category: 'Places', type: 'dynamic', keyframes: [
      { hand: 'l', rot: 0, x: 50, y: 50, palm: 'in', hold: 200 },
      { hand: 'l', rot: 90, x: 50, y: 50, palm: 'in', hold: 250 },
    ]},
    { word: 'street', urdu: 'گلی', category: 'Places', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 90, x: 35, y: 50, palm: 'in', hold: 200 },
      { hand: 'flat', rot: 90, x: 65, y: 50, palm: 'in', hold: 200 },
    ]},
    { word: 'office', urdu: 'دفتر', category: 'Places', type: 'spell' },
    { word: 'shop', urdu: 'دکان', category: 'Places', type: 'spell' },
    { word: 'hospital', urdu: 'ہسپتال', category: 'Places', type: 'spell' },
    { word: 'park', urdu: 'پارک', category: 'Places', type: 'spell' },
    { word: 'mosque', urdu: 'مسجد', category: 'Places', type: 'spell' },

    // ============ FOOD ============
    { word: 'food', urdu: 'کھانا', category: 'Food', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 55, y: 55, palm: 'in', hold: 200 },
      { hand: 'flat', rot: 0, x: 50, y: 40, palm: 'in', hold: 250 },
    ]},
    { word: 'water', urdu: 'پانی', category: 'Food', type: 'dynamic', keyframes: [
      { hand: 'peace', rot: 0, x: 50, y: 40, palm: 'in', hold: 200 },
      { hand: 'peace', rot: 0, x: 50, y: 50, palm: 'in', hold: 200 },
    ]},
    { word: 'tea', urdu: 'چائے', category: 'Food', type: 'spell' },
    { word: 'milk', urdu: 'دودھ', category: 'Food', type: 'dynamic', keyframes: [
      { hand: 'open', rot: 0, x: 50, y: 50, palm: 'in', hold: 200 },
      { hand: 'fist', rot: 0, x: 50, y: 50, palm: 'in', hold: 200 },
      { hand: 'open', rot: 0, x: 50, y: 50, palm: 'in', hold: 200 },
    ]},
    { word: 'bread', urdu: 'روٹی', category: 'Food', type: 'spell' },
    { word: 'rice', urdu: 'چاول', category: 'Food', type: 'spell' },
    { word: 'meat', urdu: 'گوشت', category: 'Food', type: 'spell' },
    { word: 'fruit', urdu: 'پھل', category: 'Food', type: 'spell' },
    { word: 'apple', urdu: 'سیب', category: 'Food', type: 'dynamic', keyframes: [
      { hand: 'fist', rot: 0, x: 55, y: 50, palm: 'in', hold: 200 },
      { hand: 'fist', rot: 30, x: 55, y: 50, palm: 'in', hold: 200 },
    ]},
    { word: 'banana', urdu: 'کیلا', category: 'Food', type: 'spell' },
    { word: 'coffee', urdu: 'کافی', category: 'Food', type: 'dynamic', keyframes: [
      { hand: 'fist', rot: 0, x: 50, y: 40, palm: 'down', hold: 200 },
      { hand: 'fist', rot: 0, x: 50, y: 55, palm: 'down', hold: 200 },
      { hand: 'fist', rot: 0, x: 50, y: 40, palm: 'down', hold: 200 },
    ]},

    // ============ COMMON ADJECTIVES ============
    { word: 'big', urdu: 'بڑا', category: 'Adjectives', type: 'dynamic', keyframes: [
      { hand: 'l', rot: 0, x: 40, y: 50, palm: 'in', hold: 200 },
      { hand: 'l', rot: 0, x: 60, y: 50, palm: 'in', hold: 250 },
    ]},
    { word: 'small', urdu: 'چھوٹا', category: 'Adjectives', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 40, y: 50, palm: 'in', hold: 200 },
      { hand: 'flat', rot: 0, x: 50, y: 50, palm: 'in', hold: 250 },
    ]},
    { word: 'new', urdu: 'نیا', category: 'Adjectives', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 35, y: 50, palm: 'up', hold: 200 },
      { hand: 'flat', rot: 0, x: 60, y: 50, palm: 'up', hold: 200 },
    ]},
    { word: 'old', urdu: 'پرانا', category: 'Adjectives', type: 'dynamic', keyframes: [
      { hand: 'fist', rot: 0, x: 50, y: 40, palm: 'in', hold: 200 },
      { hand: 'fist', rot: 0, x: 50, y: 55, palm: 'in', hold: 250 },
    ]},
    { word: 'fast', urdu: 'تیز', category: 'Adjectives', type: 'dynamic', keyframes: [
      { hand: 'l', rot: 0, x: 50, y: 50, palm: 'in', hold: 150 },
      { hand: 'fist', rot: 0, x: 50, y: 50, palm: 'in', hold: 150 },
    ]},
    { word: 'slow', urdu: 'دھیما', category: 'Adjectives', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 60, y: 55, palm: 'down', hold: 250 },
      { hand: 'flat', rot: 0, x: 40, y: 45, palm: 'down', hold: 350 },
    ]},
    { word: 'easy', urdu: 'آسان', category: 'Adjectives', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 40, y: 50, palm: 'up', hold: 200 },
      { hand: 'flat', rot: 0, x: 60, y: 50, palm: 'up', hold: 200 },
    ]},
    { word: 'hard', urdu: 'مشکل', category: 'Adjectives', type: 'static', keyframes: [
      { hand: 'fist', rot: 0, x: 50, y: 50, palm: 'down', hold: 500 },
    ]},
    { word: 'right', urdu: 'صحیح', category: 'Adjectives', type: 'static', keyframes: [
      { hand: 'point', rot: 30, x: 65, y: 50, palm: 'in', hold: 500 },
    ]},
    { word: 'wrong', urdu: 'غلط', category: 'Adjectives', type: 'static', keyframes: [
      { hand: 'pinky', rot: 0, x: 50, y: 50, palm: 'in', hold: 500 },
    ]},
    { word: 'many', urdu: 'بہت', category: 'Adjectives', type: 'dynamic', keyframes: [
      { hand: 'fist', rot: 0, x: 50, y: 50, palm: 'up', hold: 200 },
      { hand: 'open', rot: 0, x: 50, y: 50, palm: 'up', hold: 250 },
    ]},
    { word: 'little', urdu: 'تھوڑا', category: 'Adjectives', type: 'dynamic', keyframes: [
      { hand: 'thumb', rot: 0, x: 50, y: 50, palm: 'in', hold: 200 },
      { hand: 'point', rot: 0, x: 50, y: 50, palm: 'in', hold: 200 },
    ]},
    { word: 'all', urdu: 'سب', category: 'Adjectives', type: 'dynamic', keyframes: [
      { hand: 'open', rot: 0, x: 35, y: 40, palm: 'in', hold: 200 },
      { hand: 'open', rot: 0, x: 65, y: 50, palm: 'in', hold: 250 },
    ]},
    { word: 'some', urdu: 'کچھ', category: 'Adjectives', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 90, x: 45, y: 50, palm: 'down', hold: 200 },
      { hand: 'flat', rot: 90, x: 55, y: 50, palm: 'down', hold: 200 },
    ]},

    // ============ COMMON CONNECTORS ============
    { word: 'and', urdu: 'اور', category: 'Connectors', type: 'dynamic', keyframes: [
      { hand: 'open', rot: 0, x: 40, y: 50, palm: 'in', hold: 200 },
      { hand: 'fist', rot: 0, x: 60, y: 50, palm: 'in', hold: 250 },
    ]},
    { word: 'or', urdu: 'یا', category: 'Connectors', type: 'spell' },
    { word: 'but', urdu: 'لیکن', category: 'Connectors', type: 'dynamic', keyframes: [
      { hand: 'point', rot: 0, x: 40, y: 50, palm: 'in', hold: 200 },
      { hand: 'point', rot: 30, x: 60, y: 50, palm: 'out', hold: 250 },
    ]},
    { word: 'with', urdu: 'ساتھ', category: 'Connectors', type: 'static', keyframes: [
      { hand: 'fist', rot: 0, x: 50, y: 50, palm: 'in', hold: 500 },
    ]},
    { word: 'for', urdu: 'کے لیے', category: 'Connectors', type: 'dynamic', keyframes: [
      { hand: 'point', rot: 0, x: 55, y: 30, palm: 'in', hold: 200 },
      { hand: 'point', rot: 30, x: 65, y: 35, palm: 'out', hold: 200 },
    ]},
    { word: 'in', urdu: 'میں', category: 'Connectors', type: 'static', keyframes: [
      { hand: 'fist', rot: 0, x: 55, y: 50, palm: 'in', hold: 500 },
    ]},
    { word: 'on', urdu: 'پر', category: 'Connectors', type: 'static', keyframes: [
      { hand: 'flat', rot: 0, x: 50, y: 45, palm: 'down', hold: 500 },
    ]},
    { word: 'at', urdu: 'پر', category: 'Connectors', type: 'static', keyframes: [
      { hand: 'point', rot: 0, x: 55, y: 50, palm: 'down', hold: 500 },
    ]},
    { word: 'to', urdu: 'کو', category: 'Connectors', type: 'static', keyframes: [
      { hand: 'point', rot: 30, x: 65, y: 50, palm: 'out', hold: 500 },
    ]},
    { word: 'from', urdu: 'سے', category: 'Connectors', type: 'dynamic', keyframes: [
      { hand: 'l', rot: 0, x: 65, y: 50, palm: 'out', hold: 200 },
      { hand: 'fist', rot: 0, x: 50, y: 50, palm: 'in', hold: 250 },
    ]},
    { word: 'of', urdu: 'کا', category: 'Connectors', type: 'spell' },
    { word: 'a', urdu: 'ایک', category: 'Articles', type: 'static', keyframes: [
      { hand: 'fist', rot: 0, x: 50, y: 50, palm: 'out', hold: 400 },
    ]},
    { word: 'an', urdu: 'ایک', category: 'Articles', type: 'static', keyframes: [
      { hand: 'fist', rot: 0, x: 50, y: 50, palm: 'out', hold: 400 },
    ]},
    { word: 'the', urdu: '', category: 'Articles', type: 'spell' },

    // ============ COLORS ============
    { word: 'red', urdu: 'سرخ', category: 'Colors', type: 'dynamic', keyframes: [
      { hand: 'point', rot: 0, x: 50, y: 40, palm: 'in', hold: 200 },
      { hand: 'point', rot: 0, x: 50, y: 50, palm: 'in', hold: 200 },
    ]},
    { word: 'blue', urdu: 'نیلا', category: 'Colors', type: 'dynamic', keyframes: [
      { hand: 'open', rot: -30, x: 50, y: 50, palm: 'in', hold: 200 },
      { hand: 'open', rot: 30, x: 50, y: 50, palm: 'in', hold: 200 },
    ]},
    { word: 'green', urdu: 'سبز', category: 'Colors', type: 'dynamic', keyframes: [
      { hand: 'peace', rot: -30, x: 50, y: 50, palm: 'in', hold: 200 },
      { hand: 'peace', rot: 30, x: 50, y: 50, palm: 'in', hold: 200 },
    ]},
    { word: 'yellow', urdu: 'پیلا', category: 'Colors', type: 'dynamic', keyframes: [
      { hand: 'pinky', rot: -30, x: 50, y: 50, palm: 'in', hold: 200 },
      { hand: 'pinky', rot: 30, x: 50, y: 50, palm: 'in', hold: 200 },
    ]},
    { word: 'white', urdu: 'سفید', category: 'Colors', type: 'dynamic', keyframes: [
      { hand: 'open', rot: 0, x: 50, y: 45, palm: 'in', hold: 200 },
      { hand: 'fist', rot: 0, x: 50, y: 50, palm: 'in', hold: 200 },
    ]},
    { word: 'black', urdu: 'کالا', category: 'Colors', type: 'dynamic', keyframes: [
      { hand: 'point', rot: 90, x: 35, y: 35, palm: 'down', hold: 200 },
      { hand: 'point', rot: 90, x: 65, y: 35, palm: 'down', hold: 200 },
    ]},
    { word: 'color', urdu: 'رنگ', category: 'Colors', type: 'spell' },

    // ============ COMMON PHRASES (compound) ============
    { word: 'please', urdu: 'برائے مہربانی', category: 'Greetings', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 50, y: 50, palm: 'in', hold: 250 },
      { hand: 'flat', rot: 15, x: 50, y: 48, palm: 'in', hold: 250 },
    ]},
    { word: 'understand', urdu: 'سمجھنا', category: 'Communication', type: 'dynamic', keyframes: [
      { hand: 'fist', rot: 0, x: 55, y: 30, palm: 'in', hold: 200 },
      { hand: 'point', rot: 0, x: 55, y: 30, palm: 'in', hold: 250 },
    ]},
    { word: 'remember', urdu: 'یاد', category: 'Communication', type: 'dynamic', keyframes: [
      { hand: 'thumb', rot: 0, x: 55, y: 30, palm: 'in', hold: 200 },
      { hand: 'thumb', rot: 0, x: 55, y: 50, palm: 'in', hold: 250 },
    ]},
    { word: 'forget', urdu: 'بھولنا', category: 'Communication', type: 'dynamic', keyframes: [
      { hand: 'flat', rot: 0, x: 40, y: 30, palm: 'in', hold: 200 },
      { hand: 'thumb', rot: 0, x: 65, y: 30, palm: 'in', hold: 250 },
    ]},
    { word: 'ask', urdu: 'پوچھنا', category: 'Communication', type: 'dynamic', keyframes: [
      { hand: 'point', rot: 0, x: 50, y: 45, palm: 'out', hold: 200 },
      { hand: 'point', rot: 30, x: 50, y: 50, palm: 'in', hold: 250 },
    ]},
    { word: 'answer', urdu: 'جواب', category: 'Communication', type: 'dynamic', keyframes: [
      { hand: 'point', rot: 0, x: 45, y: 35, palm: 'in', hold: 200 },
      { hand: 'point', rot: 0, x: 55, y: 50, palm: 'out', hold: 250 },
    ]},
    { word: 'practice', urdu: 'مشق', category: 'Education', type: 'dynamic', keyframes: [
      { hand: 'fist', rot: 0, x: 40, y: 50, palm: 'down', hold: 200 },
      { hand: 'fist', rot: 0, x: 60, y: 50, palm: 'down', hold: 200 },
      { hand: 'fist', rot: 0, x: 40, y: 50, palm: 'down', hold: 200 },
    ]},

    // ============ ALPHABET (used by fingerspelling fallback) ============
    ...'abcdefghijklmnopqrstuvwxyz'.split('').map(letter => ({
      word: letter,
      urdu: '',
      category: 'Alphabet',
      type: 'static',
      keyframes: [{ hand: letterHand(letter), rot: 0, x: 50, y: 50, palm: 'out', hold: 350 }],
    })),
  ];

  function numberKeyframe(word) {
    const map = {
      zero: 'fist', one: 'point', two: 'peace', three: 'three', four: 'four', five: 'open',
      six: 'six', seven: 'seven', eight: 'eight', nine: 'nine', ten: 'thumb',
    };
    if (map[word]) return [{ hand: map[word], rot: 0, x: 50, y: 50, palm: 'out', hold: 500 }];
    // For larger numbers, animate two-digit handshape sequence approximation
    return [
      { hand: 'open', rot: 0, x: 45, y: 50, palm: 'out', hold: 220 },
      { hand: 'fist', rot: 0, x: 55, y: 50, palm: 'out', hold: 220 },
    ];
  }

  function letterHand(l) {
    // Maps letters to handshape categories used by the SVG renderer
    // Approximate, designed to look distinct
    const map = {
      a: 'fist', b: 'flat', c: 'c', d: 'point', e: 'fist', f: 'three',
      g: 'point', h: 'peace', i: 'pinky', j: 'pinky', k: 'three',
      l: 'l', m: 'fist', n: 'fist', o: 'c', p: 'three',
      q: 'point', r: 'peace', s: 'fist', t: 'fist', u: 'peace',
      v: 'peace', w: 'three', x: 'point', y: 'thumb', z: 'point',
    };
    return map[l] || 'fist';
  }
})();

const DICT_INDEX = (() => {
  const map = new Map();
  DICTIONARY.forEach(e => {
    if (!map.has(e.word)) map.set(e.word, e);
  });
  return map;
})();

const CATEGORIES = [...new Set(DICTIONARY.map(e => e.category))];

const QUICK_PHRASES = [
  'Hello',
  'My name is Jasim',
  'My age is 20',
  'I am a student',
  'Nice to meet you',
  'I live in Lahore',
  'This is sign language',
  'Thank you',
  'How are you',
  'I am fine',
  'What is your name',
  'Goodbye',
];

// Common grammar corrections for sentence builder
const GRAMMAR_RULES = [
  // Insert linking verbs between subject and noun/adjective
  { pattern: /\b(my\s+name)\s+(\w)/i, replace: '$1 is $2' },
  { pattern: /\b(my\s+age)\s+(\d|\w)/i, replace: '$1 is $2' },
  { pattern: /\b(i)\s+(student|teacher|fine|happy|sad|tired|hungry)\b/i, replace: '$1 am a $2' },
  { pattern: /\b(i)\s+(am)\s+a\s+(fine|happy|sad|tired|hungry|good|bad)\b/i, replace: '$1 $2 $3' },
  { pattern: /\b(you)\s+(student|teacher|fine|happy)\b/i, replace: '$1 are a $2' },
  { pattern: /\b(he|she)\s+(student|teacher|fine|happy)\b/i, replace: '$1 is a $2' },
  // 'how you' -> 'how are you'
  { pattern: /\b(how)\s+(you)\b/i, replace: '$1 are $2' },
  // 'what your name' -> 'what is your name'
  { pattern: /\b(what)\s+(your\s+name)\b/i, replace: '$1 is $2' },
  // 'i live lahore' -> 'i live in lahore'
  { pattern: /\b(live)\s+(lahore|karachi|islamabad|peshawar|quetta|multan|faisalabad|rawalpindi|pakistan|america|india)\b/i, replace: '$1 in $2' },
  // 'nice meet you' -> 'nice to meet you'
  { pattern: /\b(nice)\s+(meet)\b/i, replace: '$1 to $2' },
  // 'hello my' -> 'hello, my'   (comma after greeting)
  { pattern: /^(hello)\s+(my|i|you|how|what)\b/i, replace: '$1, $2' },
  // 'fine thank' -> 'fine, thank'
  { pattern: /\b(fine|good|great|okay)\s+(thank)\b/i, replace: '$1, $2' },
];

function applyGrammar(rawTokens) {
  let s = rawTokens.join(' ').toLowerCase();
  // Apply each rule only ONCE on the original sentence to prevent cascading re-matches.
  // Rules are designed to be independent of each other.
  GRAMMAR_RULES.forEach(r => { s = s.replace(r.pattern, r.replace); });
  // Capitalize first letter; capitalize sentence breaks; capitalize 'i'
  s = s.charAt(0).toUpperCase() + s.slice(1);
  s = s.replace(/\bi\b/g, 'I');
  // Add period if missing
  if (!/[.?!]$/.test(s)) {
    // If question-like, use ?
    // Match question word at the start, OR after a comma (e.g. "Hello, how are you")
    if (/^(what|who|where|when|why|how|which|is|are|do|does)\b/i.test(s) ||
        /,\s+(what|who|where|when|why|how|which)\b/i.test(s)) s += '?';
    else s += '.';
  }
  // Capitalize proper nouns we know
  ['Jasim', 'Summaiya', 'Lahore', 'Karachi', 'Islamabad', 'Peshawar', 'Quetta',
   'Multan', 'Faisalabad', 'Rawalpindi', 'Pakistan', 'America', 'India'].forEach(p => {
    s = s.replace(new RegExp('\\b' + p + '\\b', 'gi'), p);
  });
  return s;
}

// Tokenize a typed sentence into dictionary-resolvable units (word or letter sequence)
function tokenizeForSigning(text) {
  const cleaned = text.toLowerCase().replace(/[.,!?;:]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const words = cleaned.split(' ');
  const tokens = [];
  for (const w of words) {
    const entry = DICT_INDEX.get(w);
    if (entry && entry.type !== 'spell') {
      tokens.push({ kind: 'sign', word: w, entry });
    } else if (entry && entry.type === 'spell') {
      // Fingerspell each letter
      tokens.push({ kind: 'spell', word: w, letters: w.split('').filter(c => /[a-z]/.test(c)) });
    } else if (/^\d+$/.test(w)) {
      // Number sequence — sign each digit
      tokens.push({ kind: 'spell', word: w, letters: w.split('') });
    } else {
      // Unknown word -> fingerspell
      const letters = w.split('').filter(c => /[a-z]/.test(c));
      if (letters.length) tokens.push({ kind: 'spell', word: w, letters });
    }
  }
  return tokens;
}

// Expose globally
window.BridgeTalkDict = {
  DICTIONARY,
  DICT_INDEX,
  CATEGORIES,
  QUICK_PHRASES,
  applyGrammar,
  tokenizeForSigning,
};
